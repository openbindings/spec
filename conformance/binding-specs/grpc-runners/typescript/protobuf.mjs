#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import protobuf from "protobufjs";
import { decodeProtoMessage, parseProtoJsonMessage, parseUniqueJson, protoJsonMessageFromInternal, protoJsonMessageToValue, protoJsonText, protoUnknownMaterial, strictUtf8 } from "./protojson-lossless.mjs";

const fail = (message) => { throw new Error(message); };
const canonicalText = (value) => protoJsonText(value);
const lowerCamel = (value) => value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
const canonicalBase64 = (value) => {
  if (typeof value !== "string" || (value !== "" && !/^(?:[A-Za-z0-9+/_-]{2,})(?:={0,2})?$/.test(value)) || value.length % 4 === 1) fail("invalid Base64");
  const bytes = Buffer.from(value.replace(/-/g,"+").replace(/_/g,"/"), "base64");
  return bytes;
};

function schemaFacts(type, direction) {
  const facts = new Set(["closed-object"]);
  for (const field of type.fieldsArray) {
    const jsonName = field.options?.json_name ?? lowerCamel(field.name);
    if (field.name !== jsonName) facts.add(direction === "input" ? "original-and-json-name" : "json-name-only");
    if (field.partOf) facts.add("oneof-exclusive");
    if (["int64","sint64","sfixed64","uint64","fixed64"].includes(field.type)) facts.add("int64-string");
    if (field.resolvedType instanceof protobuf.Enum) facts.add(direction === "input" ? "open-enum-string-or-number" : "open-enum-known-string-or-number");
    if (field.resolvedType === type) facts.add("recursive-ref");
    if (field.resolvedType?.fullName === ".google.protobuf.Any") facts.add("any-closed-union");
  }
  return [...facts].sort();
}

const corpusPath = process.argv[2];
if (!corpusPath) fail("usage: node protobuf.mjs <value-cases.json>");
const corpusBytes = readFileSync(corpusPath); const corpus = parseUniqueJson(strictUtf8(corpusBytes, "value corpus UTF-8"));
if (corpus.format !== "openbindings.protobuf-value-cases@1") fail("wrong corpus format");
const fixtureRoot = dirname(resolve(corpusPath));
const protocRoot = process.env.OPENBINDINGS_PROTOC_36_1_ROOT || "/private/tmp/protoc-36.1";
const root = new protobuf.Root();
root.resolvePath = (origin, target) => target === "google/protobuf/json_enumvalue_options.proto"
  ? resolve(protocRoot, "include", target)
  : target.startsWith("google/protobuf/")
    ? resolve(dirname(fileURLToPath(import.meta.url)), "node_modules", "protobufjs", target)
    : resolve(origin ? dirname(origin) : fixtureRoot, target);
await root.load([corpus.source, ...corpus.editionSources].map((name) => join(fixtureRoot, name)), { keepCase: true }); root.resolveAll();
const results = [];
for (const test of corpus.cases) {
  const type = root.lookupType(test.type); let accepted = false; let canonicalJson; let facts;
  try {
    if (test.kind === "input") {
      const parsed = parseProtoJsonMessage(type, parseUniqueJson(test.valueJson), root);
      const message = protoJsonMessageFromInternal(type,parsed.internal);
      const encoded = type.encode(message).finish();
      try {
        const decoded = decodeProtoMessage(type,encoded,root);
        canonicalJson = canonicalText(protoJsonMessageToValue(type, decoded, root));
      } catch (error) {
        if (!String(error?.message).includes("unknown closed enum output value")) throw error;
      }
      accepted = true;
    }
    else if (test.kind === "binary" || test.kind === "binary-equivalent") {
      const decode = (value) => decodeProtoMessage(type,canonicalBase64(value),root);
      const left = decode(test.kind === "binary" ? test.dataBase64 : test.leftBase64); accepted = true;
      if (test.kind === "binary-equivalent") { const right = decode(test.rightBase64); if (canonicalText(protoJsonMessageToValue(type,left,root)) !== canonicalText(protoJsonMessageToValue(type,right,root)) || canonicalText(protoUnknownMaterial(left)) !== canonicalText(protoUnknownMaterial(right))) accepted = false; }
      if (accepted) canonicalJson = canonicalText(protoJsonMessageToValue(type,left,root));
    } else if (test.kind === "schema") { facts = schemaFacts(type,test.direction); accepted = true; }
    else fail(`unknown kind ${test.kind}`);
  } catch (error) { if (process.env.OPENBINDINGS_DEBUG_VALUE === "1") console.error(test.id,error); accepted = false; }
  const result = {id:test.id,accepted}; if (canonicalJson !== undefined) result.canonicalJson=canonicalJson; if (facts) result.facts=facts;
  if (accepted !== test.accepted || (test.canonicalJson !== undefined && canonicalJson !== test.canonicalJson) || (test.requiredFacts && canonicalText(facts) !== canonicalText(test.requiredFacts))) fail(`${test.id} mismatch ${JSON.stringify(result)}`);
  results.push(result);
}
process.stdout.write(`${JSON.stringify({format:"openbindings.protobuf-value-result@1",runtime:"typescript-protobufjs",corpusSha256:createHash("sha256").update(corpusBytes).digest("hex"),caseCount:results.length,results})}\n`);
