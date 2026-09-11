#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import { isIP } from "node:net";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { isJsonNumber, parseUniqueJson } from "./protojson-lossless.mjs";

const require = createRequire(import.meta.url);
const protobuf = require("protobufjs");

const [root, protocRoot, mutant = ""] = process.argv.slice(2);
if (!root || !protocRoot) fail("usage: node ds-witness.mjs ROOT PROTOC_ROOT [MUTANT]");
const bootstrappedDescriptorSet = descriptorSetRuntime(protocRoot);

const IDENT = "[A-Za-z_][A-Za-z0-9_]*";
const SELECTOR = new RegExp(`^${IDENT}(?:\\.${IDENT})*/${IDENT}$`);
const ALLOWED_IMPORTS = new Set([
  "google/protobuf/any.proto", "google/protobuf/api.proto",
  "google/protobuf/descriptor.proto", "google/protobuf/duration.proto",
  "google/protobuf/empty.proto", "google/protobuf/field_mask.proto",
  "google/protobuf/json_enumvalue_options.proto", "google/protobuf/json_options.proto",
  "google/protobuf/source_context.proto", "google/protobuf/struct.proto",
  "google/protobuf/timestamp.proto", "google/protobuf/type.proto",
  "google/protobuf/wrappers.proto"
]);

function main() {
  const result = {
    format: "openbindings.grpc-ds-witness-result@1", dFiles: 0, dTests: 0,
    synthesisScenarios: 0, operations: 0, bindings: 0, coverageEntries: 0,
    schemaAssertions: 0, schemaInstances: 0
  };
  try {
    compileSource("syntax = \"proto3\"; import 'google/protobuf/cpp_features.proto'; message Probe {}");
    fail("single-quoted import escaped the closed 13-file virtual root");
  } catch (error) {
    if (error.message.includes("escaped the closed")) throw error;
  }
  const bootstrapProbe = { file: [{
    name: "enum.proto", package: "demo", syntax: "editions", edition: "EDITION_2026",
    enumType: [{ name: "E", value: [{
      name: "E_UNSPECIFIED", number: 0,
      options: { "[pb.enumvalue.json]": { string: "unspecified" } }
    }] }]
  }] };
  strictDescriptorJSON(bootstrapProbe);
  const bootstrapped = bootstrappedDescriptorSet.fromObject(installEnumJSONOption(bootstrapProbe));
  const enumOption = bootstrapped.file[0].enumType[0].value[0].options[".pb.enumvalue.json"];
  if (enumOption?.string !== "unspecified") fail("exact Edition 2026 pb.enumvalue.json JSON-FDS bootstrap failed");
  const dDirectory = join(root, "conformance", "binding-specs", "grpc");
  const dFiles = readdirSync(dDirectory).filter((name) => /^GRPC-D-.*\.json$/.test(name)).sort();
  if (dFiles.length === 0) fail("no GRPC-D fixtures found");
  result.dFiles = dFiles.length;
  let flipped = false;
  for (const name of dFiles) {
    const corpus = readJSON(join(dDirectory, name));
    corpus.tests.forEach((test, index) => {
      let actual;
      let error;
      try { actual = adjudicate(corpus.rule, test.document); }
      catch (caught) { actual = false; error = caught; }
      if (mutant === "flipped-d-validity" && !flipped) { actual = !actual; flipped = true; }
      if (actual !== test.valid) {
        fail(`${basename(name)} test ${index} (${test.description}): computed valid=${actual}, expected ${test.valid}${error ? ` (${error.message})` : ""}`);
      }
      result.dTests++;
    });
  }
  const synthesis = readJSON(join(root, "conformance", "binding-specs", "synthesis", "grpc.json"));
  if (synthesis.format !== "openbindings.binding-spec-synthesis-scenarios@7") fail(`unexpected synthesis corpus format ${JSON.stringify(synthesis.format)}`);
  synthesis.scenarios.forEach((scenario, index) => {
    let actual;
    try { actual = synthesize(scenario); }
    catch (error) { fail(`synthesis scenario ${index}: ${error.message}`); }
    mutate(actual, mutant, index);
    try { validateSynthesized(actual); }
    catch (error) { fail(`synthesis scenario ${index} violates witness invariant: ${error.message}`); }
    try { compareExpected(actual, scenario.expected); }
    catch (error) { fail(`synthesis scenario ${index}: ${error.message}`); }
    try { validateSchemaInstances(actual, scenario.expected.schemaInstances || []); }
    catch (error) { fail(`synthesis scenario ${index}: ${error.message}`); }
    result.synthesisScenarios++;
    result.operations += actual.operations.length;
    result.bindings += actual.bindings.length;
    result.coverageEntries += actual.coverage.entries.length;
    result.schemaAssertions += scenario.expected.assertions?.length || 0;
    result.schemaInstances += scenario.expected.schemaInstances?.length || 0;
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function fail(message) {
  process.stderr.write(`gRPC D/S TypeScript witness: ${message}\n`);
  process.exit(1);
}

function readJSON(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function adjudicate(rule, document) {
  const sources = document.sources;
  if (!sources || typeof sources !== "object" || Object.keys(sources).length === 0) throw new Error("sources missing");
  if (rule === "GRPC-D-01") {
    for (const source of Object.values(sources)) if (Object.hasOwn(source, "content")) descriptorFromValue(source.content);
    return true;
  }
  if (rule === "GRPC-D-02") {
    for (const source of Object.values(sources)) if (typeof source.location !== "string" || !validLocation(source.location)) throw new Error("invalid location");
    return true;
  }
  if (rule === "GRPC-D-03") {
    if (!document.bindings || typeof document.bindings !== "object") throw new Error("bindings missing");
    for (const binding of Object.values(document.bindings)) {
      if (typeof binding.selector !== "string" || !SELECTOR.test(binding.selector)) throw new Error("invalid selector grammar");
      const source = sources[binding.source];
      if (!source) throw new Error("binding source missing");
      if (!Object.hasOwn(source, "content")) continue;
      const graph = buildGraph(descriptorFromValue(source.content));
      if (!graph.methods.some((method) => method.selector === binding.selector)) throw new Error("selector unresolved");
    }
    return true;
  }
  if (rule === "GRPC-D-04") {
    for (const source of Object.values(sources)) if (source.bindingSpec !== "openbindings.grpc@1") throw new Error("wrong bindingSpec");
    return true;
  }
  throw new Error(`unsupported rule ${rule}`);
}

function validLocation(input) {
  let value = input;
  if (value.startsWith("grpc://")) value = value.slice(7);
  else if (value.startsWith("grpcs://")) value = value.slice(8);
  else if (value.includes("://")) return false;
  if (/[/?#@]/.test(value)) return false;
  let host;
  let port;
  if (value.startsWith("[")) {
    const close = value.indexOf("]");
    if (close < 0 || value[close + 1] !== ":" || value.indexOf("[", 1) >= 0 || value.indexOf("]", close + 1) >= 0) return false;
    host = value.slice(1, close);
    port = value.slice(close + 2);
    if (host.includes("%") || isIP(host) !== 6) return false;
  } else {
    const colon = value.lastIndexOf(":");
    if (colon < 1 || value.indexOf(":") !== colon) return false;
    host = value.slice(0, colon);
    port = value.slice(colon + 1);
    if (isIP(host) === 6) return false;
  }
  if (!/^(?:[1-9][0-9]*)$/.test(port)) return false;
  const portNumber = Number(port);
  if (portNumber < 1 || portNumber > 65535) return false;
  if (isIP(host)) return true;
  if (host.length > 253) return false;
  return host.split(".").every((label) => label.length >= 1 && label.length <= 63 && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label));
}

function descriptorFromValue(value) {
  if (typeof value === "string") return compileSource(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("content is neither source text nor descriptor object");
  if (Object.hasOwn(value, "$fileDescriptorSet")) {
    if (Object.keys(value).length !== 1 || typeof value.$fileDescriptorSet !== "string") throw new Error("binary descriptor carrier is not closed");
    const encoded = value.$fileDescriptorSet;
    if (!canonicalBase64(encoded)) throw new Error("binary descriptor is not canonical padded Base64");
    return validateDescriptorSet(bootstrappedDescriptorSet.decode(Buffer.from(encoded, "base64")));
  }
  strictDescriptorJSON(value);
  return validateDescriptorSet(bootstrappedDescriptorSet.fromObject(installEnumJSONOption(value)));
}

function canonicalBase64(value) {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return false;
  return Buffer.from(value, "base64").toString("base64") === value;
}

function compileSource(source) {
  const temporary = mkdtempSync(join(tmpdir(), "openbindings-grpc-ds-ts-"));
  try {
    writeFileSync(join(temporary, "source.proto"), source, { mode: 0o600 });
    const output = join(temporary, "source.pb");
    const include = join(protocRoot, "include");
    for (const name of ALLOWED_IMPORTS) {
      const destination = join(temporary, ...name.split("/"));
      mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
      copyFileSync(join(include, ...name.split("/")), destination);
    }
    const includeArguments = [`--proto_path=${temporary}`];
    if (mutant === "single-quote-import-bypass") includeArguments.push(`--proto_path=${include}`);
    try {
      execFileSync(join(protocRoot, "bin", "protoc"), [
        ...includeArguments,
        "--include_imports", `--descriptor_set_out=${output}`, "source.proto"
      ], { stdio: "pipe" });
    } catch (error) {
      throw new Error(`pinned protoc failed: ${String(error.stderr || error.message).trim()}`);
    }
    const set = bootstrappedDescriptorSet.decode(readFileSync(output));
    if (mutant !== "single-quote-import-bypass") {
      const sourceFile = array(set.file).find((file) => file.name === "source.proto");
      for (const dependency of array(sourceFile?.dependency)) if (!ALLOWED_IMPORTS.has(dependency)) throw new Error(`import ${JSON.stringify(dependency)} is outside the closed allowlist`);
    }
    return validateDescriptorSet(set);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

function descriptorSetRuntime(rootPath) {
  const runtime = new protobuf.Root();
  const include = join(rootPath, "include");
  runtime.resolvePath = (_origin, target) => join(include, target);
  runtime.loadSync(["google/protobuf/descriptor.proto", "google/protobuf/json_enumvalue_options.proto"]);
  runtime.resolveAll();
  const type = runtime.lookupType("google.protobuf.FileDescriptorSet");
  const option = runtime.lookup("pb.enumvalue.json");
  if (!type || !option || option.id !== 998) throw new Error("exact pb.enumvalue.json bootstrap is unavailable");
  return type;
}

function installEnumJSONOption(input) {
  const value = structuredClone(input);
  for (const file of array(value.file)) {
    visitEnums(file.enumType);
    array(file.messageType).forEach(visitMessage);
  }
  return value;

  function visitEnums(enums) {
    for (const enumType of array(enums)) {
      for (const enumValue of array(enumType.value)) {
        const options = enumValue.options;
        if (options && Object.hasOwn(options, "[pb.enumvalue.json]")) {
          options[".pb.enumvalue.json"] = options["[pb.enumvalue.json]"];
          delete options["[pb.enumvalue.json]"];
        }
      }
    }
  }
  function visitMessage(message) {
    visitEnums(message.enumType);
    array(message.nestedType).forEach(visitMessage);
  }
}

const ALLOWED_KEYS = {
  set: new Set(["file"]),
  file: new Set(["name", "package", "dependency", "publicDependency", "weakDependency", "messageType", "enumType", "service", "extension", "options", "sourceCodeInfo", "syntax", "edition"]),
  message: new Set(["name", "field", "extension", "nestedType", "enumType", "extensionRange", "oneofDecl", "options", "reservedRange", "reservedName", "visibility"]),
  field: new Set(["name", "extendee", "number", "label", "type", "typeName", "defaultValue", "options", "oneofIndex", "jsonName", "proto3Optional"]),
  service: new Set(["name", "method", "options"]),
  method: new Set(["name", "inputType", "outputType", "options", "clientStreaming", "serverStreaming"]),
  enum: new Set(["name", "value", "options", "reservedRange", "reservedName", "visibility"]),
  enumValue: new Set(["name", "number", "options"]),
  oneof: new Set(["name", "options"]),
  range: new Set(["start", "end", "options"]),
  sourceInfo: new Set(["location"]),
  location: new Set(["path", "span", "leadingComments", "trailingComments", "leadingDetachedComments"])
};

function strictDescriptorJSON(set) {
  checkKeys(set, "set");
  array(set.file).forEach((file) => {
    checkKeys(file, "file");
    array(file.messageType).forEach(checkMessage);
    array(file.enumType).forEach(checkEnum);
    array(file.service).forEach((service) => {
      checkKeys(service, "service");
      checkOptions(service.options, false);
      array(service.method).forEach((method) => { checkKeys(method, "method"); checkOptions(method.options, false); });
    });
    array(file.extension).forEach(checkField);
    checkOptions(file.options, false);
    if (file.sourceCodeInfo) {
      checkKeys(file.sourceCodeInfo, "sourceInfo");
      array(file.sourceCodeInfo.location).forEach((location) => checkKeys(location, "location"));
    }
  });
}

function checkMessage(message) {
  checkKeys(message, "message");
  array(message.field).forEach(checkField);
  array(message.extension).forEach(checkField);
  array(message.nestedType).forEach(checkMessage);
  array(message.enumType).forEach(checkEnum);
  array(message.extensionRange).forEach((range) => checkKeys(range, "range"));
  array(message.reservedRange).forEach((range) => checkKeys(range, "range"));
  array(message.oneofDecl).forEach((oneof) => { checkKeys(oneof, "oneof"); checkOptions(oneof.options, false); });
  checkOptions(message.options, false);
}

function checkField(field) { checkKeys(field, "field"); checkOptions(field.options, false); }
function checkEnum(value) {
  checkKeys(value, "enum");
  array(value.value).forEach((entry) => { checkKeys(entry, "enumValue"); checkOptions(entry.options, true); });
  array(value.reservedRange).forEach((range) => checkKeys(range, "range"));
  checkOptions(value.options, false);
}
function checkKeys(value, kind) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${kind} descriptor must be an object`);
  for (const key of Object.keys(value)) if (!ALLOWED_KEYS[kind].has(key)) throw new Error(`unknown ${kind} descriptor member ${key}`);
}
function checkOptions(value, enumValue) {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("descriptor options must be an object");
  for (const key of Object.keys(value)) if (key.startsWith("[") && !(enumValue && key === "[pb.enumvalue.json]")) throw new Error(`unknown descriptor option ${key}`);
}
function array(value) { return value === undefined ? [] : value; }

function validateDescriptorSet(set) {
  const names = new Set();
  for (const file of array(set.file)) {
    if (names.has(file.name || "")) throw new Error(`duplicate descriptor filename ${file.name || ""}`);
    names.add(file.name || "");
  }
  for (const file of array(set.file)) for (const dependency of array(file.dependency)) if (!names.has(dependency)) throw new Error(`missing descriptor dependency ${dependency}`);
  const graph = buildGraph(set);
  for (const method of graph.methods) {
    if (!graph.messages.has(method.input) || !graph.messages.has(method.output)) throw new Error(`unresolved method type in ${method.selector}`);
  }
  return set;
}

function buildGraph(set) {
  const graph = { set, methods: [], messages: new Map(), enums: new Map(), fileExtendee: new Set() };
  for (const file of array(set.file)) {
    const prefix = file.package || "";
    array(file.messageType).forEach((message) => addMessage(graph, file.name || "", prefix, message, file.syntax || ""));
    array(file.enumType).forEach((enumType) => addEnum(graph, file.name || "", prefix, enumType, file.syntax || ""));
    array(file.extension).forEach((extension) => graph.fileExtendee.add(trimDot(extension.extendee || "")));
    for (const service of array(file.service)) {
      const serviceName = joinName(prefix, service.name || "");
      for (const method of array(service.method)) graph.methods.push({
        selector: `${serviceName}/${method.name || ""}`,
        input: trimDot(method.inputType || ""), output: trimDot(method.outputType || "")
      });
    }
  }
  graph.methods.sort((a, b) => scalarCompare(a.selector, b.selector));
  return graph;
}

function addMessage(graph, file, prefix, message, syntax) {
  const name = joinName(prefix, message.name || "");
  graph.messages.set(name, { file, name, fields: array(message.field), proto: message });
  array(message.extension).forEach((extension) => graph.fileExtendee.add(trimDot(extension.extendee || "")));
  array(message.enumType).forEach((enumType) => addEnum(graph, file, name, enumType, syntax));
  array(message.nestedType).forEach((nested) => addMessage(graph, file, name, nested, syntax));
}
function addEnum(graph, file, prefix, enumType, syntax) {
  const name = joinName(prefix, enumType.name || "");
  const inputNames = new Set();
  const outputNames = [];
  const seenNumbers = new Set();
  for (const value of array(enumType.value)) {
    const custom = value.options?.[".pb.enumvalue.json"]?.string || value.options?.["[pb.enumvalue.json]"]?.string || "";
    inputNames.add(value.name || "");
    if (custom) inputNames.add(custom);
    if (!seenNumbers.has(value.number)) {
      outputNames.push(custom || value.name || "");
      seenNumbers.add(value.number);
    }
  }
  const enumFeature = enumType.options?.features?.enumType;
  const open = enumFeature === 1 || enumFeature === "OPEN" || ((enumFeature === undefined || enumFeature === 0 || enumFeature === "ENUM_TYPE_UNKNOWN") && (syntax === "proto3" || syntax === "editions"));
  graph.enums.set(name, { file, name, inputNames: [...inputNames].filter(Boolean).sort(scalarCompare), outputNames: outputNames.filter(Boolean).sort(scalarCompare), open });
}
function joinName(prefix, name) { return prefix ? `${prefix}.${name}` : name; }
function trimDot(value) { return value.startsWith(".") ? value.slice(1) : value; }
function scalarCompare(left, right) { return left < right ? -1 : left > right ? 1 : 0; }

function synthesize(scenario) {
  let content;
  if (Object.hasOwn(scenario.source, "content")) content = scenario.source.content;
  else {
    if (typeof scenario.discovery?.descriptorSetBase64 !== "string") throw new Error("location-only scenario has no reflection descriptor set");
    content = { $fileDescriptorSet: scenario.discovery.descriptorSetBase64 };
  }
  const graph = buildGraph(descriptorFromValue(content));
  const operations = [];
  const bindings = [];
  const entries = [];
  const schemas = {};
  const bare = !scenario.source.location.includes("://");
  let fullyRepresented = true;
  for (const method of graph.methods) {
    const operationKey = method.selector.replace("/", ".");
    const service = method.selector.split("/")[0];
    if (service === "grpc.reflection.v1.ServerReflection" || service === "grpc.reflection.v1alpha.ServerReflection") {
      entries.push({ sourceIndex: 0, sourceRef: method.selector, scope: "target", status: "excluded", rule: "GRPC-S-01", requirements: [] });
      fullyRepresented = false;
      continue;
    }
    const owner = exclusionOwner(graph, method.input, new Set()) || exclusionOwner(graph, method.output, new Set());
    if (owner) {
      entries.push(
        { sourceIndex: 0, sourceRef: method.selector, scope: "target", status: "excluded", operationKey, bindingSelector: method.selector, rule: "GRPC-S-07", requirements: [] },
        { sourceIndex: 0, sourceRef: owner, scope: "projection", status: "excluded", operationKey, bindingSelector: method.selector, rule: "GRPC-S-03", requirements: [] }
      );
      fullyRepresented = false;
      continue;
    }
    operations.push(operationKey);
    bindings.push({ operationKey, bindingSelector: method.selector });
    entries.push({ sourceIndex: 0, sourceRef: method.selector, scope: "target", status: "represented", operationKey, bindingSelector: method.selector, requirements: bare ? ["configuration.transport"] : [] });
    projectMessage(graph, method.input, "input", schemas, new Set());
    projectMessage(graph, method.output, "output", schemas, new Set());
  }
  entries.sort((left, right) => {
    for (const key of ["sourceRef", "scope", "operationKey", "bindingSelector"]) {
      const compared = scalarCompare(left[key] || "", right[key] || "");
      if (compared) return compared;
    }
    return 0;
  });
  return { outcome: "synthesized", operations, bindings, schemas, coverage: { exhaustive: true, fullyRepresented, entries } };
}

function exclusionOwner(graph, name, visiting) {
  if (visiting.has(name)) return "";
  const message = graph.messages.get(name);
  if (!message) return "";
  visiting.add(name);
  const prefix = `file[${Buffer.byteLength(message.file, "utf8")}]:${message.file}#${message.name}`;
  if (message.proto.options?.messageSetWireFormat || graph.fileExtendee.has(name) || name === "google.protobuf.EnumValueOptions") return prefix;
  if (mutant !== "admit-cross-field-json-collision" && hasCrossFieldSpellingCollision(message)) { visiting.delete(name); return prefix; }
  for (const field of message.fields) {
    const required = field.label === 2 || field.label === "LABEL_REQUIRED" || field.options?.features?.fieldPresence === 3 || field.options?.features?.fieldPresence === "LEGACY_REQUIRED";
    const group = field.type === 10 || field.type === "TYPE_GROUP";
    if (required || group) { visiting.delete(name); return `${prefix}/field:${field.number}`; }
    const nested = field.type === 11 || field.type === "TYPE_MESSAGE" || group;
    if (nested) {
      const owner = exclusionOwner(graph, trimDot(field.typeName || ""), visiting);
      if (owner) { visiting.delete(name); return owner; }
    }
  }
  visiting.delete(name);
  return "";
}

function projectMessage(graph, name, direction, schemas, visiting) {
  const key = `${direction}.${name}`;
  if (Object.hasOwn(schemas, key) || visiting.has(key)) return;
  const message = graph.messages.get(name);
  if (!message || message.proto.options?.mapEntry) return;
  visiting.add(key);
  schemas[key] = {};
  schemas[key] = wellKnownSchema(graph, name, direction, schemas, visiting) ?? ordinaryMessageSchema(graph, message, direction, schemas, visiting, "");
  visiting.delete(key);
}

function ordinaryMessageSchema(graph, message, direction, schemas, visiting, anyType) {
  const properties = {};
  const fieldNames = new Map();
  if (anyType) properties["@type"] = { type: "string", pattern: `^(?:[^\\uD800-\\uDFFF])+/${escapePattern(anyType)}$` };
  for (const field of message.fields) {
    const jsonName = field.jsonName || lowerCamel(field.name || "");
    const names = [jsonName];
    if (direction === "input" && field.name !== jsonName) names.push(field.name);
    fieldNames.set(field.number, names);
    let value = fieldValueSchema(graph, field, direction, schemas, visiting);
    if (direction === "input") value = nullableSchema(value);
    for (const name of names) properties[name] = value;
  }
  const schema = { type: "object", properties, additionalProperties: false };
  if (anyType) schema.required = ["@type"];
  const exclusions = [];
  for (const names of fieldNames.values()) if (names.length === 2) exclusions.push(forbiddenPair(names[0], names[1]));
  const oneofs = new Map();
  for (const field of message.fields) {
    if (!Object.hasOwn(field, "oneofIndex") || field.proto3Optional) continue;
    const names = oneofs.get(field.oneofIndex) || [];
    names.push(...fieldNames.get(field.number));
    oneofs.set(field.oneofIndex, names);
  }
  for (const names of oneofs.values()) for (let left = 0; left < names.length; left++) for (let right = left + 1; right < names.length; right++) exclusions.push(forbiddenPair(names[left], names[right]));
  if (exclusions.length) schema.allOf = exclusions;
  return schema;
}

function hasReservedAnyEnvelopeCollision(message) {
  return message.fields.some((field) => {
    const jsonName = field.jsonName || lowerCamel(field.name || "");
    return field.name === "@type" || jsonName === "@type";
  });
}

function hasCrossFieldSpellingCollision(message) {
  const owners = new Map();
  for (const field of message.fields) {
    const number = field.number;
    const jsonName = field.jsonName || lowerCamel(field.name || "");
    for (const spelling of new Set([field.name || "", jsonName])) {
      if (owners.has(spelling) && owners.get(spelling) !== number) return true;
      owners.set(spelling, number);
    }
  }
  return false;
}

function forbiddenPair(left, right) { return { not: { required: [left, right] } }; }
function nullableSchema(schema) { return { anyOf: [schema, { type: "null" }] }; }

function fieldValueSchema(graph, field, direction, schemas, visiting) {
  const entry = mapEntry(graph, field);
  if (entry) {
    const schema = { type: "object", additionalProperties: fieldScalarSchema(graph, entry.fields[1], direction, schemas, visiting, true) };
    const pattern = mapKeyPattern(entry.fields[0]);
    if (pattern) schema.propertyNames = { pattern };
    return schema;
  }
  const repeated = field.label === 3 || field.label === "LABEL_REPEATED";
  const value = fieldScalarSchema(graph, field, direction, schemas, visiting, repeated);
  if (repeated) return { type: "array", items: value };
  return value;
}

function mapEntry(graph, field) {
  if (!([3, "LABEL_REPEATED"].includes(field.label) && [11, "TYPE_MESSAGE"].includes(field.type))) return null;
  const message = graph.messages.get(trimDot(field.typeName || ""));
  return message?.proto.options?.mapEntry && message.fields.length === 2 ? message : null;
}

function fieldScalarSchema(graph, field, direction, schemas, visiting, containerMember = false) {
  const type = field.type;
  if ([11, "TYPE_MESSAGE"].includes(type)) {
    const name = trimDot(field.typeName || "");
    projectMessage(graph, name, direction, schemas, visiting);
    const wrapper = wrapperScalarSchema(name, direction);
    if (containerMember && wrapper !== null) return wrapper;
    return { $ref: `#/schemas/${direction}.${name}` };
  }
  if ([14, "TYPE_ENUM"].includes(type)) {
    if (trimDot(field.typeName || "") === "google.protobuf.NullValue") return { type: "null" };
    return enumSchema(graph.enums.get(trimDot(field.typeName || "")), direction);
  }
  if ([5, 17, 15, "TYPE_INT32", "TYPE_SINT32", "TYPE_SFIXED32"].includes(type)) return integerSchema(direction, false, "2147483647", "2147483648");
  if ([13, 7, "TYPE_UINT32", "TYPE_FIXED32"].includes(type)) return integerSchema(direction, false, "4294967295", "");
  if ([3, 18, 16, "TYPE_INT64", "TYPE_SINT64", "TYPE_SFIXED64"].includes(type)) return integerSchema(direction, true, "9223372036854775807", "9223372036854775808");
  if ([4, 6, "TYPE_UINT64", "TYPE_FIXED64"].includes(type)) return integerSchema(direction, true, "18446744073709551615", "");
  if ([2, "TYPE_FLOAT"].includes(type)) return floatSchema(3.4028234663852886e38);
  if ([1, "TYPE_DOUBLE"].includes(type)) return floatSchema(1.7976931348623157e308);
  if ([8, "TYPE_BOOL"].includes(type)) return { type: "boolean" };
  if ([9, "TYPE_STRING"].includes(type)) return scalarStringSchema();
  if ([12, "TYPE_BYTES"].includes(type)) return { type: "string", pattern: "^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/][AQgw]==|[A-Za-z0-9+/]{2}[AEIMQUYcgkosw048]=)?$" };
  return false;
}

function integerSchema(direction, quotedOutput, positiveMax, negativeMax) {
  const pattern = boundedIntegerPattern(positiveMax, negativeMax);
  if (quotedOutput) return { type: "string", pattern };
  const numeric = { type: "integer", minimum: negativeMax ? -Number(negativeMax) : 0, maximum: Number(positiveMax) };
  return numeric;
}

function floatSchema(maximum) { return { anyOf: [{ type: "number", minimum: -maximum, maximum }, { enum: ["NaN", "Infinity", "-Infinity"] }] }; }

function enumSchema(enumType, direction) {
  if (!enumType) return false;
  const names = direction === "output" ? enumType.outputNames : enumType.inputNames;
  const strings = { enum: names };
  const integers = { type: "integer", minimum: -2147483648, maximum: 2147483647 };
  return direction === "input" || enumType.open ? { anyOf: [strings, integers] } : strings;
}

function mapKeyPattern(field) {
  const type = field.type;
  if ([8, "TYPE_BOOL"].includes(type)) return "^(?:true|false)$";
  if ([9, "TYPE_STRING"].includes(type)) return "^[^\\uD800-\\uDFFF]*$";
  if ([5, 17, 15, "TYPE_INT32", "TYPE_SINT32", "TYPE_SFIXED32"].includes(type)) return boundedIntegerPattern("2147483647", "2147483648");
  if ([13, 7, "TYPE_UINT32", "TYPE_FIXED32"].includes(type)) return boundedIntegerPattern("4294967295", "");
  if ([3, 18, 16, "TYPE_INT64", "TYPE_SINT64", "TYPE_SFIXED64"].includes(type)) return boundedIntegerPattern("9223372036854775807", "9223372036854775808");
  if ([4, 6, "TYPE_UINT64", "TYPE_FIXED64"].includes(type)) return boundedIntegerPattern("18446744073709551615", "");
  return "";
}

function boundedIntegerPattern(positiveMax, negativeMagnitudeMax) {
  const positive = boundedUnsignedBody(positiveMax, true);
  return negativeMagnitudeMax ? `^(?:${positive}|-${boundedUnsignedBody(negativeMagnitudeMax, false)})$` : `^(?:${positive})$`;
}

function boundedUnsignedBody(maximum, includeZero) {
  const alternatives = includeZero ? ["0"] : [];
  for (let length = 1; length < maximum.length; length++) alternatives.push(length === 1 ? "[1-9]" : `[1-9][0-9]{${length - 1}}`);
  for (let index = 0; index < maximum.length; index++) {
    const limit = Number(maximum[index]);
    const lower = index === 0 ? 1 : 0;
    if (limit > lower) {
      const rest = maximum.length - index - 1;
      alternatives.push(`${maximum.slice(0, index)}[${lower}-${limit - 1}]${rest ? `[0-9]{${rest}}` : ""}`);
    }
  }
  alternatives.push(maximum);
  return `(?:${alternatives.join("|")})`;
}

function wrapperScalarSchema(name, direction) {
  if (["google.protobuf.DoubleValue", "google.protobuf.FloatValue"].includes(name)) return floatSchema(name.endsWith("FloatValue") ? 3.4028234663852886e38 : 1.7976931348623157e308);
  if (["google.protobuf.Int64Value", "google.protobuf.UInt64Value"].includes(name)) return integerSchema(direction, true, name.endsWith("UInt64Value") ? "18446744073709551615" : "9223372036854775807", name.endsWith("UInt64Value") ? "" : "9223372036854775808");
  if (["google.protobuf.Int32Value", "google.protobuf.UInt32Value"].includes(name)) return integerSchema(direction, false, name.endsWith("UInt32Value") ? "4294967295" : "2147483647", name.endsWith("UInt32Value") ? "" : "2147483648");
  if (name === "google.protobuf.BoolValue") return { type: "boolean" };
  if (name === "google.protobuf.StringValue") return scalarStringSchema();
  if (name === "google.protobuf.BytesValue") return { type: "string", pattern: "^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/][AQgw]==|[A-Za-z0-9+/]{2}[AEIMQUYcgkosw048]=)?$" };
  return null;
}

function wellKnownSchema(graph, name, direction, schemas, visiting) {
  const timestampInput = "^(?:[0-9]{3}[1-9]|[0-9]{2}[1-9][0-9]|[0-9][1-9][0-9]{2}|[1-9][0-9]{3})-(?:0[1-9]|1[0-2])-(?:0[1-9]|1[0-9]|2[0-8])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\\.[0-9]{3}(?:[0-9]{3}(?:[0-9]{3})?)?)?Z$";
  const timestampOutput = "^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\\.[0-9]{3}(?:[0-9]{3}(?:[0-9]{3})?)?)?Z$";
  const durationInput = "^-?(?:0|[1-9][0-9]{0,8})(?:\\.[0-9]{3}(?:[0-9]{3}(?:[0-9]{3})?)?)?s$";
  const durationOutput = "^-?(?:0|[1-9][0-9]{0,11})(?:\\.[0-9]{3}(?:[0-9]{3}(?:[0-9]{3})?)?)?s$";
  const fieldMaskInput = "^(?:[A-Za-z][A-Za-z0-9]*(?:\\.[A-Za-z][A-Za-z0-9]*)*(?:,[A-Za-z][A-Za-z0-9]*(?:\\.[A-Za-z][A-Za-z0-9]*)*)*)?$";
  const fieldMaskOutput = "^(?:[A-Za-z][A-Za-z0-9]*(?:\\.[A-Za-z][A-Za-z0-9]*)*(?:,[A-Za-z][A-Za-z0-9]*(?:\\.[A-Za-z][A-Za-z0-9]*)*)*)?$";
  if (name === "google.protobuf.Timestamp") return { type: "string", pattern: direction === "input" ? timestampInput : timestampOutput };
  if (name === "google.protobuf.Duration") return { type: "string", pattern: direction === "input" ? durationInput : durationOutput };
  if (name === "google.protobuf.FieldMask") return { type: "string", pattern: direction === "input" ? fieldMaskInput : fieldMaskOutput };
  if (name === "google.protobuf.Struct") {
    projectMessage(graph, "google.protobuf.Value", direction, schemas, visiting);
    return { type: "object", propertyNames: scalarStringSchema(), additionalProperties: { $ref: `#/schemas/${direction}.google.protobuf.Value` } };
  }
  if (name === "google.protobuf.Value") {
    projectMessage(graph, "google.protobuf.Struct", direction, schemas, visiting);
    projectMessage(graph, "google.protobuf.ListValue", direction, schemas, visiting);
    return { anyOf: [
      { type: "null" }, { type: "boolean" }, finiteBinary64NumberSchema(), scalarStringSchema(),
      { $ref: `#/schemas/${direction}.google.protobuf.Struct` },
      { $ref: `#/schemas/${direction}.google.protobuf.ListValue` }
    ] };
  }
  if (name === "google.protobuf.ListValue") {
    projectMessage(graph, "google.protobuf.Value", direction, schemas, visiting);
    return { type: "array", items: { $ref: `#/schemas/${direction}.google.protobuf.Value` } };
  }
  if (name === "google.protobuf.NullValue") return { type: "null" };
  if (name === "google.protobuf.Empty") return { type: "object", properties: {}, additionalProperties: false };
  const wrapper = wrapperScalarSchema(name, direction);
  if (wrapper !== null) return direction === "input" ? nullableSchema(wrapper) : wrapper;
  if (name === "google.protobuf.Any") return anySchema(graph, direction, schemas, visiting);
  return null;
}

function anySchema(graph, direction, schemas, visiting) {
  const alternatives = [{ type: "object", properties: {}, additionalProperties: false }];
  for (const name of [...graph.messages.keys()].sort(scalarCompare)) {
    const message = graph.messages.get(name);
    if (message.proto.options?.mapEntry || exclusionOwner(graph, name, new Set())) continue;
    if (hasReservedAnyEnvelopeCollision(message)) continue;
    if (name === "google.protobuf.Any") {
      alternatives.push({ type: "object", properties: { "@type": { type: "string", pattern: "^(?:[^\\uD800-\\uDFFF])+/google\\.protobuf\\.Any$" }, value: { $ref: `#/schemas/${direction}.google.protobuf.Any` } }, required: ["@type", "value"], additionalProperties: false });
      continue;
    }
    if (name === "google.protobuf.Empty") {
      projectMessage(graph, name, direction, schemas, visiting);
      alternatives.push(ordinaryMessageSchema(graph, message, direction, schemas, visiting, name));
      continue;
    }
    const special = wellKnownSchema(graph, name, direction, schemas, visiting);
    if (special !== null) {
      projectMessage(graph, name, direction, schemas, visiting);
      alternatives.push({ type: "object", properties: { "@type": { type: "string", pattern: `^(?:[^\\uD800-\\uDFFF])+/${escapePattern(name)}$` }, value: { $ref: `#/schemas/${direction}.${name}` } }, required: ["@type", "value"], additionalProperties: false });
    } else {
      projectMessage(graph, name, direction, schemas, visiting);
      alternatives.push(ordinaryMessageSchema(graph, message, direction, schemas, visiting, name));
    }
  }
  return { anyOf: alternatives };
}

function escapePattern(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function scalarStringSchema() { return { type: "string", pattern: "^[^\\uD800-\\uDFFF]*$" }; }

function finiteBinary64NumberSchema() {
  return { type: "number", minimum: -1.7976931348623157e308, maximum: 1.7976931348623157e308 };
}

function lowerCamel(value) {
  return value.replace(/_+([A-Za-z0-9])?/g, (_match, next) => next ? next.toUpperCase() : "");
}

function validateSynthesized(actual) {
  if (actual.operations.length !== actual.bindings.length) throw new Error("operation/binding cardinality differs");
  for (let index = 0; index < actual.operations.length; index++) {
    const key = actual.operations[index];
    if (typeof key !== "string" || (index > 0 && scalarCompare(actual.operations[index - 1], key) >= 0)) throw new Error("operations are not unique and canonically ordered");
  }
  const operationSet = new Set(actual.operations);
  for (const binding of actual.bindings) {
    if (!operationSet.has(binding.operationKey) || !SELECTOR.test(binding.bindingSelector) || binding.bindingSelector.replace("/", ".") !== binding.operationKey) throw new Error("binding has no exact operation/selector counterpart");
  }
  for (const key of Object.keys(actual.schemas)) if ((!key.startsWith("input.") && !key.startsWith("output.")) || key.includes(":")) throw new Error(`illegal schema key ${JSON.stringify(key)}`);
  const statuses = new Set(["represented", "excluded", "invalid", "lossy", "implementation-unsupported"]);
  for (const entry of actual.coverage.entries) {
    if (!statuses.has(entry.status)) throw new Error(`unknown coverage status ${JSON.stringify(entry.status)}`);
    if (entry.scope === "target" && !SELECTOR.test(entry.sourceRef)) throw new Error(`invalid target coverage owner ${JSON.stringify(entry.sourceRef)}`);
    if (entry.scope === "projection" && !entry.sourceRef.startsWith("file[")) throw new Error(`invalid projection coverage owner ${JSON.stringify(entry.sourceRef)}`);
  }
}

function compareExpected(actual, expected) {
  for (const key of ["outcome", "operations", "bindings", "coverage"]) {
    if (!isDeepStrictEqual(actual[key], expected[key])) throw new Error(`computed ${key} differs from expected\ncomputed: ${JSON.stringify(actual[key])}\nexpected: ${JSON.stringify(expected[key])}`);
  }
  for (const assertion of expected.assertions || []) {
    const [value, present] = jsonPointer(actual, assertion.path);
    if (assertion.absent === true) {
      if (present) throw new Error(`assertion ${assertion.path} expected absence`);
    } else if (!present || !isDeepStrictEqual(value, assertion.equals)) {
      throw new Error(`assertion ${assertion.path} differs: got ${JSON.stringify(value)}`);
    }
  }
}

function jsonPointer(rootValue, path) {
  if (path === "") return [rootValue, true];
  if (!path.startsWith("/")) return [undefined, false];
  let current = rootValue;
  for (const raw of path.slice(1).split("/")) {
    const token = raw.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!current || typeof current !== "object" || !Object.hasOwn(current, token)) return [undefined, false];
    current = current[token];
  }
  return [current, true];
}

function validateSchemaInstances(actual, tests) {
  tests.forEach((test, index) => {
    const schema = actual.schemas[test.schema];
    if (schema === undefined) throw new Error(`schema instance ${index} names missing schema ${JSON.stringify(test.schema)}`);
    const instance = Object.hasOwn(test, "valueJson") ? parseUniqueJson(test.valueJson) : test.value;
    const valid = schemaValid(schema, instance, actual.schemas);
    if (valid !== test.valid) throw new Error(`schema instance ${index} for ${test.schema} computed valid=${valid}, expected ${test.valid}`);
  });
}

function schemaValid(schema, instance, schemas) {
  if (typeof schema === "boolean") return schema;
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) throw new Error("schema is neither boolean nor object");
  if (schema.$ref !== undefined) {
    const prefix = "#/schemas/";
    if (!schema.$ref.startsWith(prefix)) throw new Error(`unsupported reference ${JSON.stringify(schema.$ref)}`);
    const target = schemas[schema.$ref.slice(prefix.length)];
    if (target === undefined) throw new Error(`missing reference ${JSON.stringify(schema.$ref)}`);
    return schemaValid(target, instance, schemas);
  }
  if (schema.anyOf && !schema.anyOf.some((option) => schemaValid(option, instance, schemas))) return false;
  if (schema.allOf && !schema.allOf.every((clause) => schemaValid(clause, instance, schemas))) return false;
  if (schema.not !== undefined && schemaValid(schema.not, instance, schemas)) return false;
  if (schema.required) {
    if (!isObject(instance) || !schema.required.every((name) => Object.hasOwn(instance, name))) return false;
  }
  if (schema.type && !matchesJSONType(schema.type, instance)) return false;
  if (schema.enum && !schema.enum.some((value) => isDeepStrictEqual(value, instance))) return false;
  if (schema.pattern !== undefined && (typeof instance !== "string" || !(new RegExp(schema.pattern)).test(instance))) return false;
  if (schema.minimum !== undefined && (!isSchemaNumber(instance) || compareSchemaNumbers(instance, schema.minimum) < 0)) return false;
  if (schema.maximum !== undefined && (!isSchemaNumber(instance) || compareSchemaNumbers(instance, schema.maximum) > 0)) return false;
  if (isObject(instance)) {
    const properties = schema.properties || {};
    for (const [name, value] of Object.entries(instance)) {
      if (Object.hasOwn(properties, name)) {
        if (!schemaValid(properties[name], value, schemas)) return false;
      } else if (schema.additionalProperties === false) return false;
      else if (isObject(schema.additionalProperties) && !schemaValid(schema.additionalProperties, value, schemas)) return false;
    }
    if (schema.propertyNames) for (const name of Object.keys(instance)) if (!schemaValid(schema.propertyNames, name, schemas)) return false;
  }
  if (Array.isArray(instance) && schema.items !== undefined) for (const value of instance) if (!schemaValid(schema.items, value, schemas)) return false;
  return true;
}

function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value) && !isJsonNumber(value); }
function matchesJSONType(kind, value) {
  if (kind === "null") return value === null;
  if (kind === "object") return isObject(value);
  if (kind === "array") return Array.isArray(value);
  if (kind === "string") return typeof value === "string";
  if (kind === "boolean") return typeof value === "boolean";
  if (kind === "number") return isSchemaNumber(value);
  if (kind === "integer") return isSchemaInteger(value);
  return false;
}

function schemaNumberParts(value) {
  const token = isJsonNumber(value) ? value.token : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
  const match = token.match(/^(-)?(0|[1-9][0-9]*)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/);
  if (!match) return null;
  const fraction = match[3] || "";
  const digits = `${match[2]}${fraction}`.replace(/^0+/, "");
  if (!digits) return { sign: 0, digits: "0", scale: 0n, adjusted: 0n };
  const scale = BigInt(match[4] || "0") - BigInt(fraction.length);
  return { sign: match[1] ? -1 : 1, digits, scale, adjusted: BigInt(digits.length) + scale };
}

function isSchemaNumber(value) { return schemaNumberParts(value) !== null; }

function isSchemaInteger(value) {
  const parts = schemaNumberParts(value);
  if (!parts || parts.sign === 0 || parts.scale >= 0n) return parts !== null;
  const removed = -parts.scale;
  return removed <= BigInt(parts.digits.length) && /^0*$/.test(parts.digits.slice(parts.digits.length - Number(removed)));
}

function compareSchemaNumbers(left, right) {
  const a = schemaNumberParts(left), b = schemaNumberParts(right);
  if (!a || !b) throw new Error("schema bound compared a non-number");
  if (a.sign !== b.sign) return a.sign < b.sign ? -1 : 1;
  if (a.sign === 0) return 0;
  let magnitude;
  if (a.adjusted !== b.adjusted) magnitude = a.adjusted < b.adjusted ? -1 : 1;
  else {
    const width = Math.max(a.digits.length, b.digits.length);
    const leftDigits = a.digits.padEnd(width, "0"), rightDigits = b.digits.padEnd(width, "0");
    magnitude = leftDigits === rightDigits ? 0 : leftDigits < rightDigits ? -1 : 1;
  }
  return a.sign < 0 ? -magnitude : magnitude;
}

function mutate(actual, name, scenarioIndex) {
  if (!name) return;
  if (name === "admit-cross-field-json-collision") return;
  if (name === "empty-any-typeurl-prefix") {
    if (scenarioIndex !== 11) return;
    const alternatives = actual.schemas["input.google.protobuf.Any"].anyOf;
    const nested = alternatives.find((candidate) => candidate.properties?.["@type"]?.pattern?.endsWith("/demo\\.Nested$"));
    if (!nested) fail("Any prefix mutant could not find the demo.Nested alternative");
    nested.properties["@type"].pattern = "^[\\s\\S]*/demo\\.Nested$";
    return;
  }
  if (name === "open-proto2-closed-enum-output" || name === "open-editions-closed-enum-output") {
    const targetIndex = name === "open-proto2-closed-enum-output" ? 16 : 17;
    if (scenarioIndex !== targetIndex) return;
    const packageName = targetIndex === 16 ? "closedproto2" : "closededition";
    const shape = actual.schemas[`output.${packageName}.Shape`];
    shape.properties.singular = { anyOf: [shape.properties.singular, { type: "integer", minimum: -2147483648, maximum: 2147483647 }] };
    return;
  }
  if (name === "open-schema-object" || name === "unbounded-int64-string") {
    if (scenarioIndex !== 11) return;
    const shape = actual.schemas["input.demo.Shape"];
    if (name === "open-schema-object") delete shape.additionalProperties;
    else shape.properties.big.anyOf[0].pattern = "^-?[0-9]+$";
	return;
  }
  if (name === "nullable-wrapper-container-schema" || name === "nullable-wrapper-output-schema") {
    if (scenarioIndex !== 11) return;
    if (name === "nullable-wrapper-container-schema") {
      const properties = actual.schemas["input.demo.Shape"].properties;
      properties.wrapperItems.anyOf[0].items = { $ref: "#/schemas/input.google.protobuf.StringValue" };
      properties.wrapperMap.anyOf[0].additionalProperties = { $ref: "#/schemas/input.google.protobuf.StringValue" };
    } else {
      actual.schemas["output.google.protobuf.StringValue"] = nullableSchema(actual.schemas["output.google.protobuf.StringValue"]);
    }
    return;
  }
  if (name === "unbounded-value-number-schema" || name === "reject-value-null-schema") {
    if (scenarioIndex !== 11) return;
    const schemas = actual.schemas;
    if (name === "unbounded-value-number-schema") {
      for (const direction of ["input", "output"]) {
        const number = schemas[`${direction}.google.protobuf.Value`].anyOf.find((candidate) => candidate.type === "number");
        delete number.minimum;
        delete number.maximum;
      }
    } else {
      schemas["input.google.protobuf.Value"].anyOf = schemas["input.google.protobuf.Value"].anyOf.filter((candidate) => candidate.type !== "null");
    }
    return;
  }
  if (["noncanonical-base64-schema", "admit-integer-map-alias-schema",
    "admit-quoted-int32-schema", "admit-json-int64-schema",
    "admit-quoted-enum-schema", "admit-third-field-alias-schema",
    "admit-noncanonical-wkt-schema", "open-unicode-string-schema"].includes(name)) {
	if (scenarioIndex !== 11) return;
	const shape = actual.schemas["input.demo.Shape"];
	if (name === "noncanonical-base64-schema") {
	  shape.properties.blob.anyOf[0].pattern = "^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$";
	} else if (name === "admit-integer-map-alias-schema") {
	  shape.properties.labels.anyOf[0].propertyNames.pattern = "^(?:\\+?0*[0-9]+|-0*[0-9]+)$";
	} else if (name === "admit-quoted-int32-schema") {
	  shape.properties.count.anyOf[0] = { anyOf: [shape.properties.count.anyOf[0], { type: "string", pattern: "^-?[0-9]+$" }] };
	} else if (name === "admit-json-int64-schema") {
	  shape.properties.big.anyOf[0] = { anyOf: [shape.properties.big.anyOf[0], { type: "integer" }] };
	} else if (name === "admit-quoted-enum-schema") {
	  shape.properties.state.anyOf[0].anyOf[0].enum.push("123");
	} else if (name === "admit-third-field-alias-schema") {
	  shape.properties.snakeCase = shape.properties.customName;
	} else if (name === "admit-noncanonical-wkt-schema") {
	  actual.schemas["input.google.protobuf.Timestamp"].pattern = "^[\\s\\S]+$";
	} else {
	  delete shape.properties.snake_case.anyOf[0].pattern;
	}
	return;
  }
  if (name === "admit-any-envelope-collision") {
    if (scenarioIndex !== 14) return;
    actual.schemas["input.google.protobuf.Any"].anyOf.push({
      type: "object",
      properties: {
        "@type": { type: "string", pattern: "^[\\s\\S]+/collision\\.Collision$" },
        payload: { type: "string" }
      },
      required: ["@type"],
      additionalProperties: false
    });
    return;
  }
  if (scenarioIndex !== 0) return;
  if (name === "ghost-method") actual.operations.push("ghost.Service.Call");
  else if (name === "missing-method") actual.operations.shift();
  else if (name === "ghost-binding") actual.bindings.push({ operationKey: "ghost.Service.Call", bindingSelector: "ghost.Service/Call" });
  else if (name === "missing-binding") actual.bindings.shift();
  else if (name === "illegal-schema-key") actual.schemas["input:ghost.Bad"] = { type: "object" };
  else if (name === "wrong-coverage-owner") actual.coverage.entries[0].sourceRef = "ghost.Service/Call";
  else if (name === "wrong-coverage-status") actual.coverage.entries[0].status = "excluded";
  else if (name !== "flipped-d-validity" && name !== "single-quote-import-bypass") fail(`unknown mutant ${JSON.stringify(name)}`);
}

main();
