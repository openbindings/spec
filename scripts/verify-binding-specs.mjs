#!/usr/bin/env node
// Verifies the binding-specification conformance subcorpus
// (conformance/binding-specs/) against the ten standalone brownfield
// synthesis-family specifications (the OpenAPI family has four siblings).
// Operation Graph has its own composition
// corpus and is invocation-only because its operation contracts live in the
// containing OBI.
//
// Checks performed:
//   1. Every fixture file validates against the subcorpus's shared
//      fixture.schema.json through the lockfile-pinned local AJV engine.
//   2. Each fixture's `rule` matches its filename, sits in the right family
//      directory, and its `bindingSpec` is that family's exact identifier.
//   3. Each fixture's `section` names a section heading that exists in the
//      family specification.
//   4. Every family D-rule defined in the ten brownfield specs' Conformance sections is
//      either covered by a fixture or listed as **Deferred** in the
//      subcorpus README; no rule has two fixture files.
//   5. Every negative test (`valid: false`) carries `violates`, and every
//      `violates` entry resolves to a rule its family spec or the core spec
//      actually defines. Positive tests carry no `violates`.
//   6. Every fixture has at least one positive and one negative test unless
//      marked `coverage: "positive-only"`.
//   7. Portable processor, synthesis, and fidelity scenarios cite only rules
//      owned by their family (or the core), and their normalized identities
//      and coverage evidence are internally consistent.
//   8. Adjudications resolve to live synthesis scenarios and keep core and
//      family authority in their declared lanes.
//   9. The abstraction-fidelity alignment ledger validates against its schema.
//  10. The scenario counts the subcorpus README states in prose equal the
//      counts derived from the corpus by count-binding-spec-scenarios.mjs.
//  11. The synthesis scenario schema still enforces Core's binding-source
//      presence floor without depending on a project interface contract.
//
// The verifier does not judge verdicts — that is the job of family
// processors consuming the corpus (see conformance/binding-specs/README.md).
//
// Exits 0 on success, 1 on any drift, 2 on usage/IO error.
//
// Usage: node scripts/verify-binding-specs.mjs

import {
  readFileSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { join, dirname, resolve, basename, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { countBindingSpecScenarios } from "./count-binding-spec-scenarios.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_ROOT = resolve(__dirname, "..");
const CORPUS = join(SPEC_ROOT, "conformance", "binding-specs");
const SCHEMA_ENGINE_ROOT = join(CORPUS, "schema-engine");
const SCHEMA_ENGINE_DEPENDENCIES = Object.freeze({ ajv: "8.18.0", "ajv-formats": "3.0.1" });
const FIXTURE_SCHEMA = join(CORPUS, "fixture.schema.json");
const PROCESSOR_DIR = join(CORPUS, "processor");
const PROCESSOR_SCHEMA = join(CORPUS, "processor-scenario.schema.json");
const GRPC_PROCESSOR_V7_SCHEMA = join(CORPUS, "grpc-processor-v7.schema.json");
const GRPC_BOUNDARY_MATRIX = join(CORPUS, "grpc-boundary-matrix.json");
const GRPC_APPARATUS_MANIFEST = join(CORPUS, "grpc-apparatus.manifest.json");
const GRPC_APPARATUS_MANIFEST_SCHEMA = join(CORPUS, "grpc-apparatus.manifest.schema.json");
const GRPC_APPARATUS_ROOT = "8e7d5e4f3aeed14a16a61822d93d72c7e8b3eaedc58e29ae8f2f42179781dad5";
const FIDELITY_DIR = join(SPEC_ROOT, "conformance", "invocation-fidelity");
const FIDELITY_SCHEMA = join(FIDELITY_DIR, "scenario.schema.json");
const SYNTHESIS_DIR = join(CORPUS, "synthesis");
const SYNTHESIS_SCHEMA = join(CORPUS, "synthesis-scenario.schema.json");
const ADJUDICATIONS = join(CORPUS, "adjudications.json");
const ADJUDICATION_SCHEMA = join(CORPUS, "adjudication.schema.json");
const ABSTRACTION_FIDELITY_DIR = join(SPEC_ROOT, "conformance", "abstraction-fidelity");
const ABSTRACTION_FIDELITY_LEDGER = join(ABSTRACTION_FIDELITY_DIR, "ledger.json");
const ABSTRACTION_FIDELITY_SCHEMA = join(ABSTRACTION_FIDELITY_DIR, "ledger.schema.json");
const README = join(CORPUS, "README.md");
const CORE_SPEC_MD = join(SPEC_ROOT, "openbindings.md");
const OPENAPI_FAMILY_DIRS = new Set([
  "openapi-2.0",
  "openapi-3.0",
  "openapi-3.1",
  "openapi-3.2",
]);

// Family directory → { exact identifier, rule prefix, spec path }.
const FAMILIES = {
  usage: {
    bindingSpec: "openbindings.usage@1",
    prefix: "USAGE",
    spec: join(SPEC_ROOT, "binding-specs", "usage", "openbindings.usage.md"),
  },
  "openapi-2.0": {
    bindingSpec: "openbindings.openapi-2.0@1",
    prefix: "OAPI20",
    spec: join(SPEC_ROOT, "binding-specs", "openapi-2.0", "openbindings.openapi-2.0.md"),
  },
  "openapi-3.0": {
    bindingSpec: "openbindings.openapi-3.0@1",
    prefix: "OAPI30",
    spec: join(SPEC_ROOT, "binding-specs", "openapi-3.0", "openbindings.openapi-3.0.md"),
  },
  "openapi-3.1": {
    bindingSpec: "openbindings.openapi-3.1@1",
    prefix: "OAPI31",
    spec: join(SPEC_ROOT, "binding-specs", "openapi-3.1", "openbindings.openapi-3.1.md"),
  },
  "openapi-3.2": {
    bindingSpec: "openbindings.openapi-3.2@1",
    prefix: "OAPI32",
    spec: join(SPEC_ROOT, "binding-specs", "openapi-3.2", "openbindings.openapi-3.2.md"),
  },
  mcp: {
    bindingSpec: "openbindings.mcp@1",
    prefix: "MCP",
    spec: join(SPEC_ROOT, "binding-specs", "mcp", "openbindings.mcp.md"),
  },
  grpc: {
    bindingSpec: "openbindings.grpc@1",
    prefix: "GRPC",
    spec: join(SPEC_ROOT, "binding-specs", "grpc", "openbindings.grpc.md"),
  },
  connect: {
    bindingSpec: "openbindings.connect@1",
    prefix: "CONN",
    spec: join(SPEC_ROOT, "binding-specs", "connect", "openbindings.connect.md"),
  },
  asyncapi: {
    bindingSpec: "openbindings.asyncapi@1",
    prefix: "ASYNC",
    spec: join(SPEC_ROOT, "binding-specs", "asyncapi", "openbindings.asyncapi.md"),
  },
  graphql: {
    bindingSpec: "openbindings.graphql@1",
    prefix: "GQL",
    spec: join(SPEC_ROOT, "binding-specs", "graphql", "openbindings.graphql.md"),
  },
};

const errors = [];

function loadSchemaEngine() {
  try {
    const packageJson = JSON.parse(readFileSync(join(SCHEMA_ENGINE_ROOT, "package.json"), "utf8"));
    if (JSON.stringify(packageJson.dependencies) !== JSON.stringify(SCHEMA_ENGINE_DEPENDENCIES)) {
      throw new Error("package.json does not declare the exact AJV engine versions");
    }
    const require = createRequire(join(SCHEMA_ENGINE_ROOT, "package.json"));
    for (const dependency of Object.keys(SCHEMA_ENGINE_DEPENDENCIES)) {
      const expected = join(SCHEMA_ENGINE_ROOT, "node_modules", dependency, "package.json");
      if (require.resolve(`${dependency}/package.json`) !== expected) throw new Error(`${dependency} did not resolve from the pinned local schema-engine directory`);
    }
    const ajvVersion = require("ajv/package.json").version;
    const formatsVersion = require("ajv-formats/package.json").version;
    if (ajvVersion !== SCHEMA_ENGINE_DEPENDENCIES.ajv || formatsVersion !== SCHEMA_ENGINE_DEPENDENCIES["ajv-formats"]) {
      throw new Error(`installed versions are ajv ${ajvVersion} / ajv-formats ${formatsVersion}`);
    }
    return {
      Ajv2020: require("ajv/dist/2020").default,
      addFormats: require("ajv-formats").default,
    };
  } catch (error) {
    console.error(`Failed to load the pinned JSON-schema engine: ${error.message}`);
    console.error("Install it with: npm ci --ignore-scripts --no-audit --no-fund --silent --prefix conformance/binding-specs/schema-engine");
    process.exit(2);
  }
}

const { Ajv2020, addFormats } = loadSchemaEngine();
const validators = new Map();

function ajvOk(schemaPath, dataObj) {
  let validate = validators.get(schemaPath);
  if (!validate) {
    try {
      const engine = new Ajv2020({ allErrors: true, strict: false, validateFormats: true });
      addFormats(engine);
      validate = engine.compile(JSON.parse(readFileSync(schemaPath, "utf8")));
      validators.set(schemaPath, validate);
    } catch (error) {
      return { ok: false, out: `schema compilation failed: ${error.message}` };
    }
  }
  const ok = validate(dataObj);
  return { ok, out: ok ? "" : JSON.stringify(validate.errors, null, 2) };
}

function jsonPointerValue(document, pointer) {
  let value = document;
  for (const encoded of pointer.slice(1).split("/")) {
    const token = encoded.replace(/~1/g, "/").replace(/~0/g, "~");
    if (value === null || typeof value !== "object" || !Object.hasOwn(value, token))
      return { found: false };
    value = value[token];
  }
  return { found: true, value };
}

function hasUnpairedSurrogate(codeUnits) {
  for (let i = 0; i < codeUnits.length; i++) {
    const unit = codeUnits[i];
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = codeUnits[i + 1];
      if (next >= 0xdc00 && next <= 0xdfff) {
        i++;
        continue;
      }
      return true;
    }
    if (unit >= 0xdc00 && unit <= 0xdfff) return true;
  }
  return false;
}

function semanticAssertionFormatViolations(fixture, label) {
  if (fixture?.format === "openbindings.binding-spec-processor-scenarios@5") return [];
  if (!Array.isArray(fixture?.scenarios)) return [];
  const violations = [];
  for (const [scenarioIndex, scenario] of fixture.scenarios.entries()) {
    if (!Array.isArray(scenario?.expected)) continue;
    for (const [expectedIndex, expected] of scenario.expected.entries()) {
      if (!Array.isArray(expected?.assertions)) continue;
      for (const [assertionIndex, assertion] of expected.assertions.entries()) {
        if (assertion && typeof assertion === "object" && Object.hasOwn(assertion, "semanticEquals")) {
          violations.push(
            `${label}.scenarios[${scenarioIndex}].expected[${expectedIndex}].assertions[${assertionIndex}]: semanticEquals requires processor-scenario format @5`
          );
        }
      }
    }
  }
  return violations;
}

function canonicalBase64(value) {
  if (typeof value !== "string") return false;
  try {
    return Buffer.from(value, "base64").toString("base64") === value;
  } catch {
    return false;
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  }
  return value;
}

// JSON.parse selects the last occurrence of a duplicate object member. That
// behavior is unsuitable for a conformance corpus: two readers can otherwise
// validate different effective schemas or expectations from the same bytes.
// This small recursive scanner rejects duplicates before handing the text to
// the host parser. It deliberately implements JSON syntax only; JSON5-style
// comments and trailing commas remain invalid.
function parseJsonStrict(text, label = "JSON") {
  if (Buffer.isBuffer(text) || text instanceof Uint8Array) {
    try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(text); }
    catch { throw new SyntaxError(`${label}: invalid UTF-8`); }
  }
  let cursor = 0;
  const pathName = (path) => path.length ? `$/${path.map((part) => String(part).replaceAll("~", "~0").replaceAll("/", "~1")).join("/")}` : "$";
  const fail = (message) => { throw new SyntaxError(`${label}: ${message} at character ${cursor}`); };
  const whitespace = () => { while (text[cursor] === " " || text[cursor] === "\t" || text[cursor] === "\r" || text[cursor] === "\n") cursor++; };
  const scalarString = (value) => {
    for (let index = 0; index < value.length; index++) {
      const unit = value.charCodeAt(index);
      if (unit >= 0xd800 && unit <= 0xdbff) {
        const next = value.charCodeAt(index + 1);
        if (!(next >= 0xdc00 && next <= 0xdfff)) fail("unpaired high surrogate");
        index++;
      } else if (unit >= 0xdc00 && unit <= 0xdfff) fail("unpaired low surrogate");
    }
    return value;
  };
  const string = () => {
    if (text[cursor] !== '"') fail("expected a string");
    const start = cursor++;
    let escaped = false;
    while (cursor < text.length) {
      const char = text[cursor++];
      if (escaped) { escaped = false; continue; }
      if (char === "\\") { escaped = true; continue; }
      if (char === '"') return scalarString(JSON.parse(text.slice(start, cursor)));
    }
    fail("unterminated string");
  };
  const value = (path) => {
    whitespace();
    if (text[cursor] === "{") return object(path);
    if (text[cursor] === "[") return array(path);
    if (text[cursor] === '"') { string(); return; }
    const start = cursor;
    while (cursor < text.length && ![" ","\t","\r","\n",",","]","}"].includes(text[cursor])) cursor++;
    if (start === cursor) fail("expected a value");
    JSON.parse(text.slice(start, cursor));
  };
  const object = (path) => {
    cursor++;
    whitespace();
    const keys = new Set();
    if (text[cursor] === "}") { cursor++; return; }
    while (cursor < text.length) {
      whitespace();
      const key = string();
      if (keys.has(key)) fail(`duplicate object member ${JSON.stringify(key)} at ${pathName(path)}`);
      keys.add(key);
      whitespace();
      if (text[cursor++] !== ":") fail("expected ':' after object member");
      value([...path, key]);
      whitespace();
      const separator = text[cursor++];
      if (separator === "}") return;
      if (separator !== ",") fail("expected ',' or '}' in object");
    }
    fail("unterminated object");
  };
  const array = (path) => {
    cursor++;
    whitespace();
    if (text[cursor] === "]") { cursor++; return; }
    let index = 0;
    while (cursor < text.length) {
      value([...path, index++]);
      whitespace();
      const separator = text[cursor++];
      if (separator === "]") return;
      if (separator !== ",") fail("expected ',' or ']' in array");
    }
    fail("unterminated array");
  };
  value([]);
  whitespace();
  if (cursor !== text.length) fail("unexpected trailing content");
  return JSON.parse(text);
}

function readJsonStrict(path, label = relative(SPEC_ROOT, path)) {
  return parseJsonStrict(readFileSync(path), label);
}

function jsonFilesUnder(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return ["node_modules", ".git"].includes(entry.name) ? [] : jsonFilesUnder(path);
    return entry.isFile() && entry.name.endsWith(".json") ? [path] : [];
  });
}

function filesUnder(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return ["node_modules", ".git"].includes(entry.name) ? [] : filesUnder(path);
    return entry.isFile() ? [path] : [];
  });
}

function requiredGrpcApparatusPaths() {
  const fixed = [
    "binding-specs/AUTHORITY-PINS.json",
    "binding-specs/README.md",
    "binding-specs/connect/openbindings.connect.md",
    "binding-specs/grpc/openbindings.grpc.md",
    "binding-specs/modules/openbindings.protobuf-correspondence.md",
    "binding-specs/publication-adjudication.schema.json",
    "binding-specs/publication-evidence.schema.json",
    "binding-specs/publication-stage.schema.json",
    "conformance/binding-specs/README.md",
    "conformance/binding-specs/fixture.schema.json",
    "conformance/binding-specs/grpc-apparatus.manifest.schema.json",
    "conformance/binding-specs/grpc-boundary-matrix.json",
    "conformance/binding-specs/grpc-processor-v7.schema.json",
    "conformance/binding-specs/processor-scenario.schema.json",
    "conformance/binding-specs/processor/grpc.json",
    "conformance/binding-specs/schema-engine/package-lock.json",
    "conformance/binding-specs/schema-engine/package.json",
    "conformance/binding-specs/synthesis-scenario.schema.json",
    "conformance/binding-specs/synthesis/grpc.json",
    "conformance/invocation-fidelity/grpc.json",
    "scripts/binding-spec-publication-support.mjs",
    "scripts/count-binding-spec-scenarios.mjs",
    "scripts/prepare-binding-specification-publication.mjs",
    "scripts/publish-binding-specifications.mjs",
    "scripts/record-binding-spec-publication-evidence.mjs",
    "scripts/test-binding-spec-publication-lifecycle.mjs",
    "scripts/verify-authority-pins.mjs",
    "scripts/verify-binding-spec-publications.mjs",
    "scripts/verify-binding-specs.mjs",
  ];
  const recursiveRoots = [
    join(CORPUS, "grpc"),
    join(CORPUS, "grpc-fixtures"),
    join(CORPUS, "grpc-runners"),
  ];
  const recursive = recursiveRoots.flatMap(filesUnder).map((path) => relative(SPEC_ROOT, path));
  const grpcScripts = readdirSync(join(SPEC_ROOT, "scripts"))
    .filter((name) => /^verify-grpc-.*\.mjs$/.test(name))
    .map((name) => `scripts/${name}`);
  return new Set([...fixed, ...recursive, ...grpcScripts]);
}

function grpcApparatusFileBytes(path, normalization) {
  const bytes = readFileSync(join(SPEC_ROOT, path));
  if (normalization !== "grpc-apparatus-root-v1") return bytes;
  const text = bytes.toString("utf8");
  const normalized = text.replace(
    /const GRPC_APPARATUS_ROOT = "[0-9a-f]{64}";/,
    `const GRPC_APPARATUS_ROOT = "${"0".repeat(64)}";`
  );
  if (normalized === text) throw new Error(`${path}: root normalization marker is absent`);
  return Buffer.from(normalized);
}

function grpcApparatusRoot(manifest) {
  const normalized = structuredClone(manifest);
  normalized.manifestSha256 = "0".repeat(64);
  return sha256(Buffer.from(`${JSON.stringify(canonicalJson(normalized), null, 2)}\n`));
}

function grpcApparatusSummary() {
  const scenarios = readJsonStrict(join(PROCESSOR_DIR, "grpc.json")).scenarios;
  const timeline = scenarios.flatMap((scenario) => scenario.expected.flatMap((alternative) => alternative.timeline));
  const spec = readFileSync(join(SPEC_ROOT, "binding-specs/grpc/openbindings.grpc.md"), "utf8");
  const rules = (letter) => new Set([...spec.matchAll(new RegExp(`^- \\*\\*(GRPC-${letter}-[0-9]+)\\*\\*`, "gm"))].map((match) => match[1])).size;
  return {
    rules: {
      boundaryMutants: readJsonStrict(GRPC_BOUNDARY_MATRIX).cases.length,
      definition: rules("D"), processor: rules("P"), synthesis: rules("S"),
    },
    runnerExpectation: {
      format: "openbindings.grpc-runner-result@1",
      scenarioCount: scenarios.length,
      actionCount: scenarios.reduce((total, scenario) => total + scenario.given.invocation.actions.length, 0),
      peerDataBytes: scenarios.flatMap((scenario) => scenario.given.peer.events).filter((event) => event.type === "data").reduce((total, event) => total + Buffer.from(event.dataBase64 ?? "", "base64").length, 0),
      semanticOutputCount: timeline.filter((event) => event.event === "output").length,
      terminalCount: timeline.filter((event) => event.event === "terminal").length,
    },
  };
}

function grpcHeaderValues(events, name) {
  return events
    .flatMap((event) => event.headers || [])
    .filter((group) => group.name === name)
    .flatMap((group) => group.values || []);
}

function grpcAuthority(location) {
  if (typeof location !== "string") return undefined;
  if (location.startsWith("grpc://")) return location.slice("grpc://".length);
  if (location.startsWith("grpcs://")) return location.slice("grpcs://".length);
  return location;
}

function grpcAdmittedServerName(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  if (isIP(value) !== 0) return true;
  if (Buffer.byteLength(value, "ascii") > 253 || value.endsWith(".")) return false;
  return value.split(".").every((label) =>
    label.length >= 1 && label.length <= 63
    && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label)
  );
}

function grpcStatusDetails(value) {
  const invalid = { rawBase64: value, decoded: false };
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1) return invalid;
  const unpadded = value.replace(/=+$/, "");
  if (value.slice(0, -Math.max(0, value.length - unpadded.length)).includes("=")) return invalid;
  const bytes = Buffer.from(unpadded.padEnd(Math.ceil(unpadded.length / 4) * 4, "="), "base64");
  if (bytes.toString("base64").replace(/=+$/, "") !== unpadded) return invalid;
  let cursor = 0;
  let code;
  let codePresent = false;
  const varint = () => {
    let result = 0n;
    for (let shift = 0n, count = 0; count < 10; count++, shift += 7n) {
      if (cursor >= bytes.length) throw new Error("truncated varint");
      const octet = bytes[cursor++];
      result |= BigInt(octet & 0x7f) << shift;
      if ((octet & 0x80) === 0) {
        if (count > 0 && octet === 0) throw new Error("overlong varint");
        return result;
      }
    }
    throw new Error("overlong varint");
  };
  try {
    while (cursor < bytes.length) {
      const tag = varint();
      const field = Number(tag >> 3n);
      const wire = Number(tag & 7n);
      if (field === 0) throw new Error("zero field number");
      if (field === 1) {
        if (wire !== 0) throw new Error("wrong code wire type");
        const raw = varint();
        code = Number(BigInt.asIntN(32, raw));
        codePresent = true;
      } else if (wire === 0) varint();
      else if (wire === 1) {
        if (cursor + 8 > bytes.length) throw new Error("truncated fixed64");
        cursor += 8;
      } else if (wire === 2) {
        const length = Number(varint());
        if (!Number.isSafeInteger(length) || cursor + length > bytes.length) throw new Error("truncated bytes");
        cursor += length;
      } else if (wire === 5) {
        if (cursor + 4 > bytes.length) throw new Error("truncated fixed32");
        cursor += 4;
      } else throw new Error("unsupported wire type");
    }
  } catch {
    return invalid;
  }
  return codePresent
    ? { rawBase64: value, decoded: true, codePresent: true, code }
    : { rawBase64: value, decoded: true, codePresent: false };
}

function grpcTimeoutHeader(nanoseconds) {
  const duration = BigInt(nanoseconds);
  const units = [
    ["n", 1n],
    ["u", 1_000n],
    ["m", 1_000_000n],
    ["S", 1_000_000_000n],
    ["M", 60_000_000_000n],
    ["H", 3_600_000_000_000n],
  ];
  for (const [suffix, divisor] of units) {
    const value = (duration + divisor - 1n) / divisor;
    if (value <= 99_999_999n) return `${value}${suffix}`;
  }
  return undefined;
}

function grpcMethodCardinality(source, selector) {
  if (typeof source !== "string") return undefined;
  const method = selector?.slice(selector.lastIndexOf("/") + 1);
  if (!method) return undefined;
  const escaped = method.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`\\brpc\\s+${escaped}\\s*\\(\\s*(stream\\s+)?[.A-Za-z_][.A-Za-z0-9_]*\\s*\\)\\s*returns\\s*\\(\\s*(stream\\s+)?[.A-Za-z_][.A-Za-z0-9_]*\\s*\\)`));
  return match ? { clientStreaming: Boolean(match[1]), serverStreaming: Boolean(match[2]) } : undefined;
}

function grpcFrameEvidence(peerEvents) {
  let wire = Buffer.alloc(0);
  let complete = 0;
  let ended = false;
  const frames = [];
  const progress = [];
  const violations = [];
  for (const [eventIndex, event] of peerEvents.entries()) {
    const before = complete;
    if (ended) violations.push(`peer event ${eventIndex} occurs after the RPC-ending peer event`);
    if (event.type === "data") {
      const chunk = canonicalBase64(event.dataBase64) ? Buffer.from(event.dataBase64, "base64") : Buffer.alloc(0);
      wire = Buffer.concat([wire, chunk]);
      while (wire.length >= 5) {
        const compressed = wire[0];
        if (compressed !== 0 && compressed !== 1) {
          violations.push(`peer DATA/event ${eventIndex} has compressed flag ${compressed}`);
          break;
        }
        const length = wire.readUInt32BE(1);
        if (wire.length < 5 + length) break;
        frames.push({ compressed, length, eventIndex });
        complete++;
        wire = wire.subarray(5 + length);
      }
      if (event.endStream) ended = true;
    }
    if (event.type === "trailers" || event.type === "transport-close" || (event.type === "response-headers" && event.endStream) || (event.type === "connection-outcome" && !event.success)) ended = true;
    progress.push({ before, after: complete });
  }
  return { complete, ended, frames, progress, remaining: wire.length, violations };
}

function grpcReflectionTranscriptViolations(discovery, label) {
  const violations = [];
  if (!discovery || typeof discovery !== "object" || Array.isArray(discovery)) return [`${label}: must be an object`];
  const keys = Object.keys(discovery).sort().join(",");
  if (keys !== "descriptorSetBase64,format,listedServices,requests,stream,version")
    violations.push(`${label}: fields must be exactly descriptorSetBase64, format, listedServices, requests, stream, version`);
  if (discovery.format !== "openbindings.grpc-reflection-transcript@1") violations.push(`${label}: unsupported format`);
  if (!["v1", "v1alpha"].includes(discovery.version)) violations.push(`${label}: unsupported reflection version`);
  if (discovery.stream !== 0) violations.push(`${label}: synthesis discovery must use its one stream numbered 0`);
  if (!canonicalBase64(discovery.descriptorSetBase64)) violations.push(`${label}.descriptorSetBase64: not canonical Base64`);
  const listed = Array.isArray(discovery.listedServices) ? discovery.listedServices : [];
  if (!Array.isArray(discovery.listedServices) || listed.some((service) => typeof service !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(service)))
    violations.push(`${label}.listedServices: must contain only fully-qualified service names`);
  if (new Set(listed).size !== listed.length || listed.some((service, index) => index > 0 && listed[index - 1] >= service))
    violations.push(`${label}.listedServices: must be unique and canonically ordered`);
  if (!Array.isArray(discovery.requests) || discovery.requests.length === 0) violations.push(`${label}.requests: must be nonempty`);
  else {
    const identities = new Set();
    for (const [index, request] of discovery.requests.entries()) {
      const at = `${label}.requests[${index}]`;
      if (!request || typeof request !== "object" || Array.isArray(request)) { violations.push(`${at}: must be an object`); continue; }
      if (Object.keys(request).sort().join(",") !== "kind,value") violations.push(`${at}: fields must be exactly kind and value`);
      if (!['list-services', 'file-containing-symbol'].includes(request.kind)) violations.push(`${at}: unsupported request kind`);
      if (typeof request.value !== "string") violations.push(`${at}.value: must be a string`);
      if (index === 0 && (request.kind !== "list-services" || request.value !== ""))
        violations.push(`${at}: first request must be list-services with the empty value`);
      if (index > 0 && (request.kind !== "file-containing-symbol" || request.value.length === 0))
        violations.push(`${at}: closure requests must name a nonempty service symbol`);
      const identity = `${request.kind}\0${request.value}`;
      if (identities.has(identity)) violations.push(`${at}: duplicate reflection query`);
      identities.add(identity);
    }
    const queryServices = discovery.requests.slice(1).map((request) => request.value);
    const nonInfrastructure = listed.filter((service) => service !== "grpc.reflection.v1.ServerReflection" && service !== "grpc.reflection.v1alpha.ServerReflection");
    if (JSON.stringify(queryServices) !== JSON.stringify(nonInfrastructure))
      violations.push(`${label}.requests: file-containing-symbol closure queries must exactly cover the returned non-infrastructure service list`);
  }
  return violations;
}

function grpcRevisionSevenViolations(scenario, label) {
  const violations = [];
  const actions = scenario?.given?.invocation?.actions || [];
  const peerEvents = scenario?.given?.peer?.events || [];
  const configuration = scenario?.given?.configuration || {};
  const reservedMetadataName = (name) => name === "content-type" || name === "te" || name === "user-agent" || name.startsWith("grpc-") || name.startsWith(":");
  const metadataBase64 = (value) => {
    if (typeof value !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1 || (value.includes("=") && value.length % 4 !== 0)) throw new Error("invalid binary metadata Base64");
    const bytes = Buffer.from(value.padEnd(Math.ceil(value.length / 4) * 4, "="), "base64");
    const encoded = bytes.toString("base64");
    if (value.includes("=") ? value !== encoded : value !== encoded.replace(/=+$/, "")) throw new Error("nonzero binary metadata pad bits");
    return encoded;
  };
  const inboundMetadata = (headers, trailers = false) => {
    const owned = new Set(trailers ? [":status", "content-type", "te", "grpc-status", "grpc-message", "grpc-status-details-bin"] : [":status", "content-type", "te", "grpc-encoding", "grpc-accept-encoding", "grpc-status", "grpc-message", "grpc-status-details-bin"]);
    const groups = new Map();
    for (const header of headers || []) {
      if (header.name.startsWith(":") || owned.has(header.name)) continue;
      if (header.name.startsWith("grpc-")) throw new Error("unknown reserved response metadata");
      groups.set(header.name, [...(groups.get(header.name) || []), ...header.values]);
    }
    return [...groups].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([name, values]) => {
      if (name.endsWith("-bin")) return { name, value: values.join(",").split(",").map(metadataBase64) };
      if (values.some((value) => value.length === 0 || !/^[\x20-\x7e]+$/.test(value))) throw new Error("invalid ASCII response metadata");
      return { name, value: values.join(",") };
    });
  };
  const legalResponseHeaderBlock = (headers, trailers = false) => {
    let regularSeen = false;
    for (const header of headers || []) {
      const name = header?.name;
      if (typeof name !== "string" || !/^(?::[a-z]+|[0-9a-z_.-]+)$/.test(name) || !Array.isArray(header.values) || header.values.length === 0 || header.values.some((value) => typeof value !== "string")) return false;
      if (name.startsWith(":")) {
        if (trailers || name !== ":status" || regularSeen) return false;
      } else regularSeen = true;
      if (trailers) {
        if (name.startsWith("grpc-") && !["grpc-status", "grpc-message", "grpc-status-details-bin"].includes(name)) return false;
        if (["content-type", "te"].includes(name)) return false;
      } else {
        if (name.startsWith("grpc-") && !["grpc-encoding", "grpc-accept-encoding", "grpc-status", "grpc-message", "grpc-status-details-bin"].includes(name)) return false;
        if (name === "te") return false;
      }
    }
    try { inboundMetadata(headers, trailers); return true; } catch { return false; }
  };
  const metadataCollisions = [];
  for (const [scope, groups] of [["metadata", configuration.metadata || []], ["discoveryMetadata", configuration.discoveryMetadata || []]]) {
    for (const [index, group] of groups.entries()) {
      if (reservedMetadataName(group.name)) metadataCollisions.push(`${scope}[${index}] '${group.name}'`);
    }
  }
  const peerIds = new Set();
  const frameEvidence = grpcFrameEvidence(peerEvents);
  for (const problem of frameEvidence.violations) violations.push(`${label}.given.peer.events: ${problem}`);
  const cancelAction = actions.findIndex((action) => action.type === "cancel");
  for (const [index, event] of peerEvents.entries()) {
    if (peerIds.has(event.id)) violations.push(`${label}.given.peer.events[${index}]: duplicate id '${event.id}'`);
    peerIds.add(event.id);
    if (event.after?.action !== undefined && event.after.action >= actions.length)
      violations.push(`${label}.given.peer.events[${index}]: trigger action ${event.after.action} does not exist`);
    if (event.after?.action !== undefined && cancelAction >= 0 && event.after.action >= cancelAction)
      violations.push(`${label}.given.peer.events[${index}]: peer event is triggered by or after cancellation action ${cancelAction}`);
    for (const field of ["dataBase64", "messageBase64"]) {
      if (event[field] !== undefined && !canonicalBase64(event[field]))
        violations.push(`${label}.given.peer.events[${index}].${field}: not canonical Base64`);
    }
  }
  const tls = scenario?.given?.peer?.tlsFixture;
  if (tls && tls.fixture !== "openbindings.grpc-tls-fixture@1")
    violations.push(`${label}.given.peer.tlsFixture.fixture: unknown TLS fixture`);
  for (const [alternativeIndex, alternative] of (scenario.expected || []).entries()) {
    const at = `${label}.expected[${alternativeIndex}]`;
    const timeline = alternative.timeline || [];
    const terminals = timeline.filter((event) => event.event === "terminal");
    if (terminals.length !== 1) violations.push(`${at}: timeline must contain exactly one terminal event`);
    else if (terminals[0].disposition !== alternative.disposition)
      violations.push(`${at}: terminal disposition does not match alternative disposition`);
    const terminalIndex = timeline.findIndex((event) => event.event === "terminal");
    if (terminalIndex >= 0 && terminalIndex !== timeline.length - 1)
      violations.push(`${at}: terminal must be the final timeline event`);
    const expectedProtocolFailure = alternative.disposition === "error" && terminals[0]?.cause === "protocol";
    const illegalHeaderPlacement = peerEvents.some((event) => event.type === "response-headers" && !legalResponseHeaderBlock(event.headers, false)
      || event.type === "trailers" && !legalResponseHeaderBlock(event.headers, true));
    if (illegalHeaderPlacement && !expectedProtocolFailure)
      violations.push(`${at}: illegal HTTP/2 pseudo/reserved response-header placement was not a protocol failure`);
    const misplacedStatus = peerEvents.some((event) => event.type === "response-headers"
      && grpcHeaderValues([event], "grpc-status").length && event.endStream !== true);
    const leadingDiagnostics = peerEvents.some((event) => event.type === "response-headers"
      && !grpcHeaderValues([event], "grpc-status").length
      && (grpcHeaderValues([event], "grpc-message").length || grpcHeaderValues([event], "grpc-status-details-bin").length));
    if ((misplacedStatus || leadingDiagnostics) && !expectedProtocolFailure)
      violations.push(`${at}: illegal response-header status/diagnostic placement was not a protocol failure`);
    const invalidHTTPStatusShape = peerEvents.some((event) => event.type === "response-headers"
      && (() => { const values = grpcHeaderValues([event], ":status"); return values.length !== 1 || !/^[0-9]{3}$/.test(values[0]); })());
    if (invalidHTTPStatusShape && !expectedProtocolFailure)
      violations.push(`${at}: malformed or nonsingleton HTTP :status was not a protocol failure`);
    let responseStarted = false;
    let responseOrderFailure = false;
    for (const event of peerEvents) {
      if (event.type === "response-headers") {
        if (responseStarted) responseOrderFailure = true;
        responseStarted = true;
      } else if (["data", "trailers"].includes(event.type) && !responseStarted) responseOrderFailure = true;
    }
    if (responseOrderFailure && !expectedProtocolFailure)
      violations.push(`${at}: response DATA/trailers ordering violation was not a protocol failure`);
    let leadingMetadata = [], trailingMetadata = [], metadataValid = true;
    try {
      for (const event of peerEvents) {
        if (event.type !== "response-headers" && event.type !== "trailers") continue;
        const trailersOnly = event.type === "trailers" || grpcHeaderValues([event], "grpc-status").length > 0;
        const observed = inboundMetadata(event.headers, trailersOnly);
        if (trailersOnly) trailingMetadata.push(...observed); else leadingMetadata.push(...observed);
      }
    } catch { metadataValid = false; }
    if (!metadataValid && !expectedProtocolFailure)
      violations.push(`${at}: invalid custom response metadata value was not a protocol failure`);
    if (metadataValid && (!expectedProtocolFailure || alternative.native?.leadingMetadata !== undefined || alternative.native?.trailingMetadata !== undefined)) {
      if (JSON.stringify(alternative.native?.leadingMetadata || []) !== JSON.stringify(leadingMetadata))
        violations.push(`${at}: leadingMetadata does not exactly retain normalized peer metadata`);
      if (JSON.stringify(alternative.native?.trailingMetadata || []) !== JSON.stringify(trailingMetadata))
        violations.push(`${at}: trailingMetadata does not exactly retain normalized peer metadata`);
    }
    if (metadataCollisions.length && !(
      alternative.disposition === "refusal"
      && terminals[0]?.cause === "configuration"
      && !timeline.some((event) => event.event === "rpc-opened")
      && !(alternative.native?.reflection || []).length
    )) violations.push(`${at}: binding-owned metadata collision (${metadataCollisions.join(", ")}) was not refused before the affected stream opened`);
    const outputIndexes = timeline.filter((event) => event.event === "output").map((event) => event.index);
    if (outputIndexes.some((value, index) => value !== index))
      violations.push(`${at}: output indexes must be contiguous in timeline order`);
    const requestIndexes = timeline.filter((event) => event.event === "request-message").map((event) => event.index);
    if (requestIndexes.some((value, index) => value !== index))
      violations.push(`${at}: request-message indexes must be contiguous in timeline order`);
    const acceptedIndexes = timeline.filter((event) => event.event === "input-accepted").map((event) => event.index);
    if (acceptedIndexes.some((value, index) => value !== index))
      violations.push(`${at}: accepted-input indexes must be contiguous in timeline order`);
    const actionResults = new Map();
    let priorActionResult = -1;
    for (const [eventIndex, event] of timeline.entries()) {
      if (["input-accepted", "input-rejected", "input-half-closed", "cancelled", "action-failed"].includes(event.event) && event.action !== undefined) {
        if (actionResults.has(event.action)) violations.push(`${at}: action ${event.action} has multiple result events`);
        actionResults.set(event.action, event.event);
        if (event.action < priorActionResult) violations.push(`${at}.timeline[${eventIndex}]: action results are out of caller order`);
        priorActionResult = event.action;
        const action = actions[event.action];
        if (!action) violations.push(`${at}.timeline[${eventIndex}]: result names nonexistent action ${event.action}`);
        else {
          const permitted = {
            write: ["input-accepted", "input-rejected", "action-failed"],
            "half-close": ["input-half-closed", "input-rejected", "action-failed"],
            cancel: ["cancelled", "action-failed"],
          }[action.type] || [];
          if (!permitted.includes(event.event))
            violations.push(`${at}.timeline[${eventIndex}]: ${event.event} cannot be the result of ${action.type} action ${event.action}`);
        }
      }
    }
    for (const [actionIndex, action] of actions.entries()) {
      if (["advance-clock", "await-output", "await-native"].includes(action.type)) continue;
      if (!actionResults.has(actionIndex)) violations.push(`${at}: action ${actionIndex} has no semantic result event`);
    }
    let halfClosedAt = -1;
    let cancelledAt = -1;
    for (const [actionIndex, action] of actions.entries()) {
      const result = actionResults.get(actionIndex);
      if (action.type === "half-close" && result === "input-half-closed") {
        if (halfClosedAt >= 0) violations.push(`${at}: half-close action ${actionIndex} was accepted after action ${halfClosedAt} already half-closed input`);
        else halfClosedAt = actionIndex;
      }
      if (action.type === "cancel" && result === "cancelled") {
        const event = timeline.find((candidate) => candidate.event === "cancelled" && candidate.action === actionIndex);
        if (event?.cause !== "caller") violations.push(`${at}: explicit cancel action ${actionIndex} must have caller cause`);
        if (cancelledAt >= 0) violations.push(`${at}: cancel action ${actionIndex} was accepted after action ${cancelledAt} already cancelled the RPC`);
        else cancelledAt = actionIndex;
      }
      if (action.type === "write" && result === "input-accepted" && ((halfClosedAt >= 0 && actionIndex > halfClosedAt) || (cancelledAt >= 0 && actionIndex > cancelledAt)))
        violations.push(`${at}: write action ${actionIndex} was accepted after the input side was closed`);
      if (action.type === "half-close" && result === "input-half-closed" && cancelledAt >= 0 && actionIndex > cancelledAt)
        violations.push(`${at}: half-close action ${actionIndex} was accepted after cancellation`);
    }
    const nativeMessages = alternative.native?.requestMessages || [];
    if (nativeMessages.length !== requestIndexes.length)
      violations.push(`${at}: native request-message count ${nativeMessages.length} differs from timeline count ${requestIndexes.length}`);
    for (const [messageIndex, message] of nativeMessages.entries()) {
	  const accepted = timeline.find((event) => event.event === "input-accepted" && event.index === messageIndex);
	  const expectedValue = accepted ? actions[accepted.action]?.value : messageIndex === 0 ? (scenario.given?.invocation?.inputPresent ? scenario.given.invocation.input : {}) : undefined;
	  let suppliedValueMatches = false;
	  if (expectedValue !== undefined && typeof message.valueJson === "string") {
	    try { suppliedValueMatches = JSON.stringify(canonicalJson(parseJsonStrict(message.valueJson))) === JSON.stringify(canonicalJson(expectedValue)); } catch { suppliedValueMatches = false; }
	  }
	  if (!suppliedValueMatches)
	    violations.push(`${at}.native.requestMessages[${messageIndex}]: valueJson is not the value supplying ordered timeline request ${messageIndex}`);
      if (message.decodedPayloadBase64 !== undefined) {
        if (!canonicalBase64(message.decodedPayloadBase64))
          violations.push(`${at}.native.requestMessages[${messageIndex}].decodedPayloadBase64: not canonical Base64`);
        else if (Buffer.from(message.decodedPayloadBase64, "base64").length !== message.decodedLength)
          violations.push(`${at}.native.requestMessages[${messageIndex}]: decodedLength does not match decoded payload`);
      }
      if (message.lengthMatchesEncodedPayload !== true)
        violations.push(`${at}.native.requestMessages[${messageIndex}]: encoded gRPC prefix length is not proved`);
      if (message.compressedFlag === 1 && message.gzipMemberValid !== true)
        violations.push(`${at}.native.requestMessages[${messageIndex}]: compressed request lacks one valid gzip-member proof`);
      if (message.compressedFlag === 0 && message.gzipMemberValid !== undefined)
        violations.push(`${at}.native.requestMessages[${messageIndex}]: identity request carries contradictory gzip evidence`);
      if (message.valueJson !== undefined) {
        try { parseJsonStrict(message.valueJson, `${at}.native.requestMessages[${messageIndex}].valueJson`); }
        catch { violations.push(`${at}.native.requestMessages[${messageIndex}].valueJson: not JSON`); }
      }
    }
    for (const [eventIndex, event] of timeline.entries()) {
      if (event.valueJson !== undefined) {
        try { parseJsonStrict(event.valueJson, `${at}.timeline[${eventIndex}].valueJson`); }
        catch { violations.push(`${at}.timeline[${eventIndex}].valueJson: not JSON`); }
      }
    }
    const nativeNames = new Set();
    if (timeline.some((event) => event.event === "channel-ready")) nativeNames.add("channel-ready");
    if (timeline.some((event) => event.event === "rpc-opened")) nativeNames.add("rpc-opened");
    if (timeline.some((event) => event.event === "input-half-closed")) nativeNames.add("request-half-closed");
    for (const index of outputIndexes) nativeNames.add(`output-${index}`);
    for (const reflection of alternative.native?.reflection || []) nativeNames.add(`reflection-${reflection.version}-query`);
    const authority = grpcAuthority(scenario.given?.source?.location);
    const nativeReflection = alternative.native?.reflection || [];
    const nsValue = (value) => typeof value === "string" && /^[0-9]+$/.test(value) ? BigInt(value) : undefined;
    const discoveryStart = nsValue(scenario.given?.runtime?.clockStartNs) ?? 0n;
    const discoveryDuration = configuration.discoveryTimeoutNs === undefined ? undefined : nsValue(configuration.discoveryTimeoutNs);
    const discoveryDeadline = discoveryDuration === undefined ? undefined : discoveryStart + discoveryDuration;
    let discoveryClock = discoveryStart;
    let discoveryExpired = false;
    const reflectionEvents = peerEvents.filter((event) => ["reflection-message", "reflection-status"].includes(event.type));
    for (const [reflectionIndex, reflection] of nativeReflection.entries()) {
      const reflectionAt = `${at}.native.reflection[${reflectionIndex}]`;
      if (reflection.host !== authority) violations.push(`${reflectionAt}: request host must equal carried authority '${authority}'`);
      const openedAt = nsValue(reflection.openedAtNs);
      if (openedAt === undefined) violations.push(`${reflectionAt}: openedAtNs is not an unsigned decimal nanosecond value`);
      else if (openedAt !== discoveryClock)
        violations.push(`${reflectionAt}: openedAtNs does not equal the controlled discovery clock ${discoveryClock}`);
      if (discoveryDeadline === undefined) {
        if (reflection.deadlineNs !== null) violations.push(`${reflectionAt}: absent discoveryTimeout requires a null deadline`);
      } else {
        if (reflection.deadlineNs !== String(discoveryDeadline)) violations.push(`${reflectionAt}: fallback refreshed or changed the one discovery deadline`);
        const remaining = discoveryDeadline - (openedAt ?? discoveryDeadline);
        const timeoutValues = (reflection.requestHeaders || []).filter((group) => group.name === "grpc-timeout").flatMap((group) => group.values || []);
        if (remaining <= 0n || timeoutValues.length !== 1 || timeoutValues[0] !== grpcTimeoutHeader(String(remaining)))
          violations.push(`${reflectionAt}: grpc-timeout is not the positive non-shortening remaining discovery duration`);
      }
      const configuredNames = new Set((configuration.discoveryMetadata || []).map((group) => group.name));
      const permittedNames = new Set([...configuredNames, ...(discoveryDeadline === undefined ? [] : ["grpc-timeout"])]);
      for (const group of reflection.requestHeaders || []) {
        if (!permittedNames.has(group.name)) violations.push(`${reflectionAt}: request header '${group.name}' was not configured for discovery`);
      }
      for (const group of configuration.discoveryMetadata || []) {
        const values = (reflection.requestHeaders || []).filter((candidate) => candidate.name === group.name).flatMap((candidate) => candidate.values || []);
        const expected = group.name.endsWith("-bin") ? group.values.map((value) => value.base64) : group.values;
        const normalized = group.name.endsWith("-bin") ? values.flatMap((value) => value.split(",")) : values;
        if (JSON.stringify(normalized) !== JSON.stringify(expected))
          violations.push(`${reflectionAt}: discovery metadata '${group.name}' differs from configured value order`);
      }
      const responses = reflectionEvents.filter((event) =>
        event.reflectionVersion === reflection.version && event.stream === reflection.stream
        && (event.type === "reflection-status" || (event.originalRequest?.kind === reflection.requestKind && event.originalRequest?.value === reflection.requestValue))
      );
      if (responses.length > 1) violations.push(`${reflectionAt}: more than one peer response claims the same outstanding request`);
      for (const response of responses) {
        if (response.type === "reflection-message" && response.originalRequest?.host !== reflection.host)
          violations.push(`${reflectionAt}: peer original_request host differs from the outstanding request`);
        const elapsed = nsValue(response.elapsedNs);
        if (elapsed === undefined) violations.push(`${reflectionAt}: peer elapsedNs is not an unsigned decimal nanosecond value`);
        else discoveryClock += elapsed;
        if (discoveryDeadline !== undefined && discoveryClock >= discoveryDeadline) discoveryExpired = true;
      }
      if (reflectionIndex > 0 && reflection.version === "v1alpha") {
        const priorV1 = reflectionEvents.some((event) => event.type === "reflection-status" && event.reflectionVersion === "v1" && event.rpcStatus === 12);
        if (!priorV1) violations.push(`${reflectionAt}: v1alpha fallback lacks an RPC-level v1 UNIMPLEMENTED result`);
      }
    }
    const validHostByStream = new Map();
    for (const [eventIndex, event] of peerEvents.entries()) {
      if (event.type !== "reflection-message") continue;
      const streamKey = `${event.reflectionVersion}\0${event.stream}`;
      if (!validHostByStream.has(streamKey)) validHostByStream.set(streamKey, event.validHost);
      else if (validHostByStream.get(streamKey) !== event.validHost)
        violations.push(`${at}: peer reflection stream ${event.stream} changes valid_host at event ${eventIndex}`);
      if (event.originalRequest?.host !== authority)
        violations.push(`${at}: peer reflection event '${event.id}' carries original_request host other than '${authority}'`);
      const matching = nativeReflection.filter((reflection) =>
        reflection.version === event.reflectionVersion && reflection.stream === event.stream
        && reflection.requestKind === event.originalRequest.kind && reflection.requestValue === event.originalRequest.value
        && reflection.host === event.originalRequest.host
      );
      if (matching.length !== 1) violations.push(`${at}: peer reflection event '${event.id}' does not correlate to exactly one native request`);
    }
    if (discoveryExpired) {
      if (timeline.some((event) => event.event === "rpc-opened")) violations.push(`${at}: application RPC opened after discovery deadline expiry`);
      if (!(terminals[0]?.cause === "deadline" && alternative.disposition === "refusal"))
        violations.push(`${at}: discovery deadline expiry must refuse the transaction with deadline cause`);
      if ((alternative.native?.cancellations || 0) < 1) violations.push(`${at}: discovery deadline expiry did not cancel the reflection stream`);
    }
    for (const [eventIndex, event] of peerEvents.entries()) {
      const trigger = event.after?.native;
      if (trigger && !nativeNames.has(trigger))
        violations.push(`${at}: peer event '${event.id}' has forward or absent native trigger '${trigger}'`);
      const outputMatch = trigger?.match(/^output-(\d+)$/);
      if (outputMatch && frameEvidence.progress[eventIndex].before <= Number(outputMatch[1]))
        violations.push(`${at}: peer event '${event.id}' is circular because ${trigger} is not produced by prior DATA`);
      const reflectionMatch = trigger?.match(/^reflection-(v1|v1alpha)-query$/);
      if (reflectionMatch && ["reflection-message", "reflection-status"].includes(event.type) && event.reflectionVersion !== reflectionMatch[1])
        violations.push(`${at}: reflection response '${event.id}' version differs from its query trigger`);
    }
    for (const [actionIndex, action] of actions.entries()) {
      if (action.type === "await-output" && !outputIndexes.includes(action.index))
        violations.push(`${at}: await-output action ${actionIndex} names absent output ${action.index}`);
      if (action.type === "await-native" && !nativeNames.has(action.name))
        violations.push(`${at}: await-native action ${actionIndex} names absent observation '${action.name}'`);
      const awaitedTimelineIndex = action.type === "await-output"
        ? timeline.findIndex((event) => event.event === "output" && event.index === action.index)
        : action.type === "await-native"
          ? timeline.findIndex((event) => ({
              "channel-ready": event.event === "channel-ready",
              "rpc-opened": event.event === "rpc-opened",
              "request-half-closed": event.event === "input-half-closed",
            })[action.name])
          : -1;
      if (awaitedTimelineIndex >= 0) {
        const premature = timeline.findIndex((event, eventIndex) =>
          eventIndex < awaitedTimelineIndex && event.action > actionIndex
          && ["input-accepted", "input-rejected", "input-half-closed", "cancelled", "action-failed"].includes(event.event)
        );
        if (premature >= 0)
          violations.push(`${at}.timeline[${premature}]: action result occurs before action ${actionIndex}'s awaited observation`);
      }
      if (action.type === "await-output") {
        const producingFrame = frameEvidence.frames[action.index];
        const producingTrigger = producingFrame && peerEvents[producingFrame.eventIndex]?.after;
        if (producingTrigger?.action !== undefined && producingTrigger.action >= actionIndex)
          violations.push(`${at}: await-output action ${actionIndex} is cyclic because output ${action.index} is released after action ${producingTrigger.action}`);
      }
    }
    const rpcOpenedIndex = timeline.findIndex((event) => event.event === "rpc-opened");
    for (const [eventIndex, event] of timeline.entries()) {
      if (event.event !== "request-message") continue;
      if (rpcOpenedIndex >= 0 && eventIndex < rpcOpenedIndex)
        violations.push(`${at}.timeline[${eventIndex}]: request message precedes RPC opening`);
      const acceptedIndex = timeline.findIndex((candidate) => candidate.event === "input-accepted" && candidate.index === event.index);
      if (acceptedIndex >= 0 && eventIndex < acceptedIndex)
        violations.push(`${at}.timeline[${eventIndex}]: streamed request message precedes acceptance of its write action`);
    }
    if (frameEvidence.ended && frameEvidence.remaining > 0 && !(alternative.disposition === "error" && terminals[0]?.cause === "protocol"))
      violations.push(`${at}: peer ended with an incomplete gRPC frame without protocol failure`);
    if (outputIndexes.length > frameEvidence.complete)
      violations.push(`${at}: ${outputIndexes.length} outputs exceed ${frameEvidence.complete} complete peer messages`);
    const cardinality = grpcMethodCardinality(scenario.given?.source?.content, scenario.given?.binding?.selector);
    if (cardinality) {
      if (cardinality.clientStreaming && scenario.given?.invocation?.inputPresent && !(alternative.disposition === "refusal" && !timeline.some((event) => event.event === "rpc-opened")))
        violations.push(`${at}: client-streaming initial input must be refused before RPC opening`);
      if (!cardinality.clientStreaming && actions.some((action) => ["write", "half-close"].includes(action.type)))
        violations.push(`${at}: unary-request method carries streaming caller actions`);
      if (!cardinality.clientStreaming && timeline.some((event) => event.event === "rpc-opened") && terminals[0]?.cause !== "limit" && nativeMessages.length !== 1)
        violations.push(`${at}: unary-request method must send exactly one request message after opening`);
      if (cardinality.clientStreaming && nativeMessages.length !== acceptedIndexes.length)
        violations.push(`${at}: client-streaming native request count differs from accepted writes`);
      if (!cardinality.serverStreaming && outputIndexes.length > 1)
        violations.push(`${at}: unary-response method exposes more than one output`);
      const finalStatus = timeline.find((event) => event.event === "final-status");
      if (!cardinality.serverStreaming && alternative.disposition === "complete" && finalStatus?.code === 0 && outputIndexes.length !== 1)
        violations.push(`${at}: successful unary response must expose exactly one output`);
    }
    const finalStatuses = timeline.filter((event) => event.event === "final-status");
    if (finalStatuses.length > 1) violations.push(`${at}: timeline contains more than one final status`);
    if (alternative.disposition === "complete" && finalStatuses[0]?.code !== 0)
      violations.push(`${at}: successful completion requires final gRPC status 0`);
    if (finalStatuses[0]?.code !== undefined) {
      const statusValues = grpcHeaderValues(peerEvents.filter((event) => ["response-headers", "trailers"].includes(event.type)), "grpc-status");
      const mappedHTTP = statusValues.length === 0 && peerEvents.some((event) => event.type === "response-headers" && event.endStream === true && grpcHeaderValues([event], "grpc-status").length === 0);
      if (statusValues.length !== 1 && !mappedHTTP)
        violations.push(`${at}: normalized final status requires one peer grpc-status or a final HTTP mapping witness`);
      else if (!mappedHTTP) {
        const raw = statusValues[0], validRaw = /^(?:0|[1-9][0-9]*)$/.test(raw);
        const normalized = validRaw && BigInt(raw) <= 16n ? Number(raw) : validRaw ? 2 : undefined;
        if (normalized !== finalStatuses[0].code)
          violations.push(`${at}: normalized final status ${finalStatuses[0].code} contradicts peer grpc-status ${JSON.stringify(raw)}`);
      }
    }
    const diagnosticEvents = peerEvents.filter((event) => ["response-headers", "trailers"].includes(event.type));
    const grpcMessages = grpcHeaderValues(diagnosticEvents, "grpc-message");
    const capturedMessages = alternative.native?.grpcMessageRaw || [];
    if ((grpcMessages.length || capturedMessages.length) && JSON.stringify(capturedMessages) !== JSON.stringify(grpcMessages))
      violations.push(`${at}: exact raw grpc-message diagnostic was not preserved`);
    if (grpcMessages.length > 1 && !expectedProtocolFailure)
      violations.push(`${at}: duplicate grpc-message values were not a protocol failure`);
    const detailValues = grpcHeaderValues(diagnosticEvents, "grpc-status-details-bin");
    const decodedDetails = detailValues.map(grpcStatusDetails);
    const capturedDetails = alternative.native?.statusDetails || [];
    if ((detailValues.length || capturedDetails.length) && JSON.stringify(capturedDetails) !== JSON.stringify(decodedDetails))
      violations.push(`${at}: raw/decoded grpc-status-details-bin evidence differs`);
    if (detailValues.length) {
      const finalCode = finalStatuses[0]?.code;
      const rawStatuses = grpcHeaderValues(diagnosticEvents, "grpc-status");
      const rawCode = rawStatuses.length === 1 && /^(?:0|[1-9][0-9]*)$/.test(rawStatuses[0]) ? BigInt(rawStatuses[0]) : undefined;
      const invalidDetails = detailValues.length !== 1 || !decodedDetails[0]?.decoded || finalCode === 0 || rawCode === undefined
        || (decodedDetails[0]?.codePresent && BigInt(decodedDetails[0].code) !== rawCode);
      if (invalidDetails && !(alternative.disposition === "error" && terminals[0]?.cause === "protocol"))
        violations.push(`${at}: invalid grpc-status-details-bin evidence must terminate as protocol error`);
    }
    const requestHeaders = alternative.native?.requestHeaders || [];
    const requestHeaderValues = (name) => requestHeaders.filter((group) => group.name === name).flatMap((group) => group.values || []);
    if (configuration.timeoutNs !== undefined && timeline.some((event) => event.event === "rpc-opened")) {
      const expectedTimeout = grpcTimeoutHeader(configuration.timeoutNs);
      const values = requestHeaderValues("grpc-timeout");
      if (expectedTimeout === undefined || values.length !== 1 || values[0] !== expectedTimeout)
        violations.push(`${at}: grpc-timeout evidence does not encode configured timeout ${configuration.timeoutNs}`);
    } else if (requestHeaderValues("grpc-timeout").length) {
      violations.push(`${at}: grpc-timeout is present without configured application timeout`);
    }
    for (const group of timeline.some((event) => event.event === "rpc-opened") ? configuration.metadata || [] : []) {
      const actual = requestHeaderValues(group.name);
      const expected = group.name.endsWith("-bin")
        ? group.values.map((value) => value.base64)
        : group.values;
      const normalizedActual = group.name.endsWith("-bin") ? actual.flatMap((value) => value.split(",")) : actual;
      if (JSON.stringify(normalizedActual) !== JSON.stringify(expected))
        violations.push(`${at}: native request metadata '${group.name}' differs from configured value order`);
    }
    const requestEncoding = requestHeaderValues("grpc-encoding");
    const requestCompression = configuration.compression || "identity";
    const applicationOpened = timeline.some((event) => event.event === "rpc-opened");
    if (!applicationOpened) {
      if (requestEncoding.length) violations.push(`${at}: request compression leaked before application RPC opening`);
    } else if (requestCompression === "identity") {
      if (requestEncoding.length) violations.push(`${at}: identity request compression must omit grpc-encoding`);
      if (nativeMessages.some((message) => message.compressedFlag !== 0)) violations.push(`${at}: identity request compression emitted a compressed message`);
    } else {
      if (requestEncoding.length !== 1 || requestEncoding[0] !== "gzip") violations.push(`${at}: gzip request compression requires one grpc-encoding: gzip`);
      if (nativeMessages.some((message) => message.compressedFlag !== 1 || message.gzipMemberValid !== true)) violations.push(`${at}: gzip request compression lacks flag-1 single-member evidence`);
    }
    if (frameEvidence.frames.some((frame) => frame.compressed === 1)) {
      const responseEncoding = grpcHeaderValues(peerEvents.filter((event) => event.type === "response-headers"), "grpc-encoding");
      const validEncoding = responseEncoding.length === 1 && responseEncoding[0] === "gzip";
      if (!validEncoding && !(alternative.disposition === "error" && terminals[0]?.cause === "protocol"))
        violations.push(`${at}: compressed response frame lacks one supported non-identity grpc-encoding and must fail as protocol`);
    }
    const initialResponseHeaders = peerEvents.filter((event) => event.type === "response-headers" && !grpcHeaderValues([event], "grpc-status").length);
    const admittedResponseType = initialResponseHeaders.length === 1 && (() => {
      const values = grpcHeaderValues(initialResponseHeaders, "content-type");
      return values.length === 1 && ["application/grpc", "application/grpc+proto"].includes(values[0].toLowerCase());
    })();
    if (frameEvidence.frames.length && !admittedResponseType && finalStatuses[0]?.code === 0 && !expectedProtocolFailure)
      violations.push(`${at}: Protobuf DATA under an unadmitted response content-type was not a protocol failure`);
    const cancelled = timeline.filter((event) => event.event === "cancelled").length;
    if ((alternative.native?.cancellations || 0) !== cancelled)
      violations.push(`${at}: native cancellation count differs from semantic timeline`);
    if (terminals[0]?.cause === "limit" && timeline.some((event) => event.event === "rpc-opened") && cancelled !== 1)
      violations.push(`${at}: a post-open limit did not cancel the still-open RPC exactly once`);
    const failedConnection = peerEvents.find((event) => event.type === "connection-outcome" && !event.success);
    if (failedConnection && (timeline.some((event) => event.event === "rpc-opened") || terminals[0]?.cause !== failedConnection.failureCause))
      violations.push(`${at}: failed connection cause or pre-open terminal classification is inconsistent`);
    const inboundLimit = configuration.limits?.maxInboundMessageBytes;
    if (inboundLimit !== undefined) {
      const uncompressedExceeds = frameEvidence.frames.some((frame) => frame.compressed === 0 && frame.length > inboundLimit);
      const allUncompressedWithin = frameEvidence.frames.length > 0 && frameEvidence.frames.every((frame) => frame.compressed === 0 && frame.length <= inboundLimit);
      if (uncompressedExceeds && terminals[0]?.cause !== "limit")
        violations.push(`${at}: an uncompressed decoded message exceeds its inbound limit without limit termination`);
      if (allUncompressedWithin && terminals[0]?.cause === "limit")
        violations.push(`${at}: inbound limit terminal contradicts all decoded uncompressed message lengths`);
    }
    const outboundLimit = configuration.limits?.maxOutboundMessageBytes;
    if (outboundLimit !== undefined && nativeMessages.some((message) => message.decodedLength > outboundLimit) && terminals[0]?.cause !== "limit")
      violations.push(`${at}: outbound message exceeds its limit without limit termination`);
    const serverName = configuration.tls?.serverName;
    if (serverName !== undefined && !grpcAdmittedServerName(serverName))
      violations.push(`${at}: serverName is outside the admitted DNS/IP grammar`);
    const channel = alternative.native?.channel;
    if (channel) {
      if (channel.dialAuthority !== authority || channel.httpAuthority !== authority)
        violations.push(`${at}: TLS identity override changed dial or HTTP authority`);
      if (channel.transport === "tls") {
        const targetHost = authority?.startsWith("[") ? authority.slice(1, authority.indexOf("]")) : authority?.replace(/:\d+$/, "");
        const identity = serverName || targetHost;
        const expectedSni = isIP(identity || "") ? null : identity;
        if (channel.sni !== expectedSni) violations.push(`${at}: native SNI does not match the effective DNS/IP reference identity`);
      }
    }
  }
  return violations;
}

// Extracts family D-rule ids from a family spec's Conformance section. Older
// families use list items; the OpenAPI siblings use labeled paragraphs.
function extractFamilyRules(md, prefix) {
  const rules = new Set();
  const re = new RegExp(`\\*\\*(${prefix}-D-\\d+)\\*\\*`, "g");
  let m;
  while ((m = re.exec(md)) !== null) rules.add(m[1]);
  return rules;
}

// Extracts every rule identifier a family spec defines (D-, P-, and S-rules),
// for resolving corpus citations against their owning specification.
function extractAllRuleIds(md, prefix) {
  const ids = new Set();
  const re = new RegExp(`\\*\\*(${prefix}-[DPS]-\\d+)\\*\\*`, "g");
  let m;
  while ((m = re.exec(md)) !== null) ids.add(m[1]);
  return ids;
}

function extractFamilyPRules(md, prefix) {
  const rules = new Set();
  const re = new RegExp(`\\*\\*(${prefix}-P-\\d+)\\*\\*`, "g");
  let m;
  while ((m = re.exec(md)) !== null) rules.add(m[1]);
  return rules;
}

function extractCoreRules(md) {
  const rules = new Set();
  const re = /^\s*-\s*\*\*(OBI-[BDT]-\d+)\*\*[^:]*:/gm;
  let m;
  while ((m = re.exec(md)) !== null) rules.add(m[1]);
  return rules;
}

function extractCoreSpecificationVersion(md) {
  const matches = [
    ...md.matchAll(
      /^This is \*\*version (\d+\.\d+\.\d+)\*\* of the OpenBindings specification\./gm
    ),
  ];
  return matches.map((match) => match[1]);
}

function verifyOpenApiCoreAuthority(md, label, expectedVersion) {
  const declarations = [
    ...md.matchAll(
      /incorporates exactly version \*\*(\d+\.\d+\.\d+)\*\* of the \[OpenBindings Specification\]\(\.\.\/\.\.\/openbindings\.md\) as its Core authority\. Throughout this document, \*\*Core\*\* means that exact version; no other Core version is incorporated\./g
    ),
  ].map((match) => match[1]);
  if (declarations.length !== 1) {
    errors.push(
      `${label}: must declare exactly one versioned OpenBindings Core authority in §2 (found ${declarations.length})`
    );
  } else if (expectedVersion && declarations[0] !== expectedVersion) {
    errors.push(
      `${label}: declares OpenBindings Core ${declarations[0]}, but openbindings.md declares ${expectedVersion}`
    );
  }

  const sectionMatches = [...md.matchAll(/^## 13\. Normative references\s*$/gm)];
  if (sectionMatches.length !== 1) {
    errors.push(`${label}: must contain exactly one §13 Normative references section`);
    return;
  }
  const references = md.slice(sectionMatches[0].index);
  const coreReferences = [
    ...references.matchAll(
      /^- \[OpenBindings Specification (\d+\.\d+\.\d+)\]\(\.\.\/\.\.\/openbindings\.md\)$/gm
    ),
  ].map((match) => match[1]);
  if (coreReferences.length !== 1) {
    errors.push(
      `${label}: §13 must contain exactly one versioned OpenBindings Specification reference (found ${coreReferences.length})`
    );
  } else if (expectedVersion && coreReferences[0] !== expectedVersion) {
    errors.push(
      `${label}: §13 references OpenBindings ${coreReferences[0]}, but openbindings.md declares ${expectedVersion}`
    );
  }
  if (
    declarations.length === 1 &&
    coreReferences.length === 1 &&
    declarations[0] !== coreReferences[0]
  ) {
    errors.push(
      `${label}: §2 Core declaration and §13 Core reference name different versions`
    );
  }
}

// Rows like `| USAGE-D-03 | **Deferred...` in the subcorpus README mark
// formally deferred rules.
function extractDeferredRules(readme) {
  const out = new Set();
  const re = /\|\s*((?:USAGE|OAPI(?:20|30|31|32)|MCP|GRPC|CONN|ASYNC|GQL)-D-\d+)\s*\|\s*\*\*Deferred/g;
  let m;
  while ((m = re.exec(readme)) !== null) out.add(m[1]);
  return out;
}

function sectionExists(specMd, section) {
  // The `section` field cites a family-spec section like "4" or "9.2";
  // accept the catalog's top-level `## 4.` and sibling `### 9.2` styles.
  const esc = section.replace(/\./g, "\\.");
  return new RegExp(`^#{2,4}\\s+${esc}\\.?\\s`, "m").test(specMd);
}

const readme = readFileSync(README, "utf8");
const coreMd = readFileSync(CORE_SPEC_MD, "utf8");
const coreVersions = extractCoreSpecificationVersion(coreMd);
if (coreVersions.length !== 1) {
  errors.push(
    `openbindings.md: must declare exactly one specification version (found ${coreVersions.length})`
  );
}
const coreVersion = coreVersions[0];
const coreRules = extractCoreRules(coreMd);
const deferred = extractDeferredRules(readme);

// Reject duplicate members in every JSON document this verifier governs,
// including schemas. AJV and JSON.parse otherwise accept a last-member-wins
// interpretation before validation begins.
{
  const governed = [
    ...jsonFilesUnder(CORPUS),
    ...jsonFilesUnder(FIDELITY_DIR),
    ...jsonFilesUnder(ABSTRACTION_FIDELITY_DIR),
    join(SPEC_ROOT, "binding-specs", "AUTHORITY-PINS.json"),
  ];
  for (const path of new Set(governed)) {
    try { readJsonStrict(path); }
    catch (error) { errors.push(error.message); }
  }
  try {
    parseJsonStrict('{"outer":{"same":1,"same":2}}', "duplicate-key metamutant");
    errors.push("duplicate-key metamutant was accepted");
  } catch (error) {
    if (!/duplicate object member "same"/.test(error.message))
      errors.push(`duplicate-key metamutant failed for the wrong reason: ${error.message}`);
  }
}

// The gRPC family is a multi-file normative and executable closure. The
// manifest's canonical-body digest seals metadata as well as every file
// record; the verifier is included through a normalization that blanks only
// this root constant, avoiding a self-hash cycle while authenticating the
// judging code. Canonical strict JSON parsing closes duplicate-member drift.
{
  let manifest;
  const text = readFileSync(GRPC_APPARATUS_MANIFEST, "utf8");
  try {
    manifest = parseJsonStrict(text, "grpc-apparatus.manifest.json");
  } catch (error) {
    errors.push(`grpc-apparatus.manifest.json: ${error.message}`);
  }
  if (manifest) {
    if (text !== `${JSON.stringify(canonicalJson(manifest), null, 2)}\n`)
      errors.push("grpc-apparatus.manifest.json must use canonical sorted-key serialization (duplicates are forbidden)");
    const shape = ajvOk(GRPC_APPARATUS_MANIFEST_SCHEMA, manifest);
    if (!shape.ok) errors.push(`grpc-apparatus.manifest.json: schema failure\n${shape.out}`);
    try {
      const summary = grpcApparatusSummary();
      const matches = (value) => Object.keys(summary).every((group) => JSON.stringify(canonicalJson(value[group])) === JSON.stringify(canonicalJson(summary[group])));
      if (!matches(manifest)) errors.push("grpc-apparatus.manifest.json: sealed aggregates differ from independently derived spec, processor, or boundary counts");
      // Resealing hashes must not make stale summaries true. Every aggregate
      // is independently sensitive to both deletion and substitution.
      for (const [group, fields] of Object.entries(summary)) {
        for (const [key, value] of Object.entries(fields)) {
          for (const remove of [true, false]) {
            const changed = structuredClone(manifest); changed[group] ??= {};
            if (remove) delete changed[group][key];
            else changed[group][key] = typeof value === "number" ? value + 1 : `${value}-wrong`;
            if (matches(changed)) errors.push(`gRPC apparatus ${group}.${key} ${remove ? "deletion" : "substitution"} metamutant escaped`);
          }
        }
      }
    } catch (error) { errors.push(`gRPC apparatus aggregate derivation failed: ${error.message}`); }
    const paths = new Set();
    let prior = "";
    for (const [index, file] of (manifest.files || []).entries()) {
      if (paths.has(file.path)) errors.push(`grpc-apparatus.manifest.json: duplicate path ${file.path}`);
      paths.add(file.path);
      if (index > 0 && prior >= file.path) errors.push("grpc-apparatus.manifest.json: files must be strictly path-sorted");
      prior = file.path;
      const full = join(SPEC_ROOT, file.path);
      if (!existsSync(full)) errors.push(`grpc-apparatus.manifest.json: missing ${file.path}`);
      else {
        try {
          if (sha256(grpcApparatusFileBytes(file.path, file.normalization)) !== file.sha256)
            errors.push(`grpc-apparatus.manifest.json: digest mismatch for ${file.path}`);
        } catch (error) {
          errors.push(`grpc-apparatus.manifest.json: ${error.message}`);
        }
      }
    }
    const requiredPaths = requiredGrpcApparatusPaths();
    for (const path of requiredPaths) if (!paths.has(path)) errors.push(`grpc-apparatus.manifest.json: required closure file is absent: ${path}`);
    for (const path of paths) if (!requiredPaths.has(path)) errors.push(`grpc-apparatus.manifest.json: undeclared closure file is present: ${path}`);
    const verifierRecord = (manifest.files || []).find((file) => file.path === "scripts/verify-binding-specs.mjs");
    if (verifierRecord?.normalization !== "grpc-apparatus-root-v1")
      errors.push("grpc-apparatus.manifest.json: semantic verifier must use root-neutral normalization");
    const actualRoot = grpcApparatusRoot(manifest);
    if (manifest.manifestSha256 !== actualRoot)
      errors.push("grpc-apparatus.manifest.json: manifestSha256 does not seal the canonical manifest body");
    if (actualRoot !== GRPC_APPARATUS_ROOT)
      errors.push("grpc-apparatus.manifest.json: canonical apparatus root differs from verifier-owned root");
    const gutted = { ...manifest, files: (manifest.files || []).slice(1) };
    if (grpcApparatusRoot(gutted) === GRPC_APPARATUS_ROOT)
      errors.push("gRPC apparatus deletion metamutant did not change the trusted root");
    const duplicated = { ...manifest, files: [...(manifest.files || []), manifest.files?.[0]].filter(Boolean) };
    if (new Set(duplicated.files.map((file) => file.path)).size === duplicated.files.length)
      errors.push("gRPC apparatus duplicate-path metamutant was not constructed");
    if (grpcApparatusRoot(duplicated) === GRPC_APPARATUS_ROOT)
      errors.push("gRPC apparatus duplicate-path metamutant did not change the trusted root");
    const substituted = structuredClone(manifest);
    if (substituted.files?.[0]) substituted.files[0].sha256 = "0".repeat(64);
    if (grpcApparatusRoot(substituted) === GRPC_APPARATUS_ROOT)
      errors.push("gRPC apparatus substitution metamutant did not change the trusted root");
  }
}

const specTexts = {};
const familyRuleIds = {};
const definedDRules = new Map(); // family-dir + rule id → { ruleId, dir }
const allRuleIds = new Set(coreRules);
for (const [dir, fam] of Object.entries(FAMILIES)) {
  const md = readFileSync(fam.spec, "utf8");
  specTexts[dir] = md;
  if (OPENAPI_FAMILY_DIRS.has(dir)) {
    // An unreleased page is a publication input and must track the companion
    // Core text that the publisher will archive. Once published, its mutable
    // mirror remains locked to that revision's own exact Core dependency even
    // while work on a later Core release begins.
    const expectedVersion = /^\*\*Status: unreleased /m.test(md) ? coreVersion : undefined;
    verifyOpenApiCoreAuthority(md, relative(SPEC_ROOT, fam.spec), expectedVersion);
  }
  for (const id of extractFamilyRules(md, fam.prefix)) {
    definedDRules.set(`${dir}\0${id}`, { ruleId: id, dir });
  }
  familyRuleIds[dir] = extractAllRuleIds(md, fam.prefix);
  for (const id of familyRuleIds[dir]) allRuleIds.add(id);
}

const fixtureRules = new Map(); // family-dir + rule id → relPath
let files = 0;
let tests = 0;
let positives = 0;
let negatives = 0;

for (const [dir, fam] of Object.entries(FAMILIES)) {
  const famDir = join(CORPUS, dir);
  if (!existsSync(famDir)) continue;
  for (const name of readdirSync(famDir).sort()) {
    if (!name.endsWith(".json")) continue;
    const relPath = `${dir}/${name}`;
    let fixture;
    try {
      fixture = readJsonStrict(join(famDir, name));
    } catch (e) {
      errors.push(`${relPath}: failed to parse JSON: ${e.message}`);
      continue;
    }
    files++;

    // 1. Shape via the shared fixture schema.
    const shape = ajvOk(FIXTURE_SCHEMA, fixture);
    if (!shape.ok) {
      errors.push(`${relPath}: does not match fixture.schema.json\n${shape.out}`);
      continue;
    }

    // 2. Identity: rule ↔ filename ↔ family directory ↔ bindingSpec.
    if (fixture.rule !== basename(name, ".json")) {
      errors.push(
        `${relPath}: rule '${fixture.rule}' does not match filename`
      );
    }
    if (!fixture.rule.startsWith(`${fam.prefix}-D-`)) {
      errors.push(
        `${relPath}: rule '${fixture.rule}' does not belong to family '${dir}' (expected prefix ${fam.prefix}-D-)`
      );
    }
    if (fixture.bindingSpec !== fam.bindingSpec) {
      errors.push(
        `${relPath}: bindingSpec '${fixture.bindingSpec}' is not this family's identifier '${fam.bindingSpec}'`
      );
    }
    const fixtureKey = `${dir}\0${fixture.rule}`;
    if (!definedDRules.has(fixtureKey)) {
      errors.push(
        `${relPath}: rule '${fixture.rule}' is not defined in the ${dir} specification's Conformance section`
      );
    }
    if (fixtureRules.has(fixtureKey)) {
      errors.push(
        `Multiple fixture files declare rule ${fixture.rule} for ${dir}: ${fixtureRules.get(fixtureKey)} and ${relPath}`
      );
    } else {
      fixtureRules.set(fixtureKey, relPath);
    }

    // 3. Cited family-spec section exists.
    if (!sectionExists(specTexts[dir], fixture.section)) {
      errors.push(
        `${relPath}: section '${fixture.section}' is not a heading in the ${dir} specification`
      );
    }

    // 5./6. Test-level checks.
    let pos = 0;
    let neg = 0;
    fixture.tests.forEach((t, i) => {
      tests++;
      if (t.valid) {
        pos++;
        if ("violates" in t) {
          errors.push(`${relPath}.tests[${i}]: positive test carries 'violates'`);
        }
      } else {
        neg++;
        if (!Array.isArray(t.violates) || t.violates.length === 0) {
          errors.push(`${relPath}.tests[${i}]: negative test carries no 'violates'`);
        } else {
          for (const v of t.violates) {
            if (!coreRules.has(v) && !familyRuleIds[dir].has(v)) {
              errors.push(
                `${relPath}.tests[${i}].violates: rule '${v}' is not defined by the core or the ${dir} family`
              );
            }
          }
          if (!t.violates.includes(fixture.rule)) {
            errors.push(
              `${relPath}.tests[${i}].violates: does not include the fixture's own rule ${fixture.rule}`
            );
          }
        }
      }
    });
    positives += pos;
    negatives += neg;
    if (fixture.coverage !== "positive-only" && (pos === 0 || neg === 0)) {
      errors.push(
        `${relPath}: needs at least one positive and one negative test (found ${pos}+/${neg}-) or a 'coverage' marker`
      );
    }
  }
}

// 4. Coverage: every defined family D-rule is fixtured or deferred.
for (const [fixtureKey, { ruleId, dir }] of definedDRules) {
  if (!fixtureRules.has(fixtureKey) && !deferred.has(ruleId)) {
    errors.push(
      `Rule ${ruleId} (${dir}) has no fixture file and is not listed as deferred in conformance/binding-specs/README.md`
    );
  }
}
for (const ruleId of deferred) {
  const covered = [...fixtureRules.entries()].filter(([key]) => key.endsWith(`\0${ruleId}`));
  if (covered.length) {
    errors.push(
      `Rule ${ruleId} is listed as deferred in the README but also has fixture file(s): ${covered.map(([, path]) => path).join(", ")}`
    );
  }
}

// Portable P-rule scenario files for all ten standalone brownfield synthesis specifications. These files preserve permitted
// alternatives explicitly; the verifier checks shape, identity, citations,
// and distinct rule-id coverage, while family adapters execute them against SDKs.
const processorTargets = [
  "usage",
  "openapi-2.0",
  "openapi-3.0",
  "openapi-3.1",
  "openapi-3.2",
  "asyncapi",
  "mcp",
  "grpc",
  "connect",
  "graphql",
];
const processorRuleCoverage = new Map();
const processorScenarioIds = new Set();
let processorFiles = 0;
let processorScenarios = 0;
let grpcProcessorFixture;
let grpcBoundaryMutants = 0;

for (const dir of processorTargets) {
  const fam = FAMILIES[dir];
  const path = join(PROCESSOR_DIR, `${dir}.json`);
  if (!existsSync(path)) {
    errors.push(`processor/${dir}.json: missing portable P-rule scenario file`);
    continue;
  }
  let fixture;
  try {
    fixture = readJsonStrict(path);
  } catch (e) {
    errors.push(`processor/${dir}.json: failed to parse JSON: ${e.message}`);
    continue;
  }
  processorFiles++;
  errors.push(...semanticAssertionFormatViolations(fixture, `processor/${dir}.json`));
  const shape = ajvOk(PROCESSOR_SCHEMA, fixture);
  if (!shape.ok) {
    errors.push(`processor/${dir}.json: does not match processor-scenario.schema.json\n${shape.out}`);
    continue;
  }
  if (fixture.family !== dir)
    errors.push(`processor/${dir}.json: family '${fixture.family}' does not match filename`);
  if (fixture.bindingSpec !== fam.bindingSpec)
    errors.push(`processor/${dir}.json: bindingSpec '${fixture.bindingSpec}' is not '${fam.bindingSpec}'`);

  if (dir === "grpc") {
    grpcProcessorFixture = fixture;
    if (fixture.format !== "openbindings.binding-spec-processor-scenarios@7") {
      errors.push(`processor/grpc.json: gRPC requires processor-scenario format @7`);
    }
    for (const [i, scenario] of fixture.scenarios.entries()) {
      const shape = ajvOk(GRPC_PROCESSOR_V7_SCHEMA, scenario);
      if (!shape.ok)
        errors.push(`processor/grpc.json.scenarios[${i}]: does not match grpc/processor-v7.schema.json\n${shape.out}`);
      errors.push(...grpcRevisionSevenViolations(scenario, `processor/grpc.json.scenarios[${i}]`));
    }
  }

  for (const [i, scenario] of fixture.scenarios.entries()) {
    const at = `processor/${dir}.json.scenarios[${i}]`;
    processorScenarios++;
    if (processorScenarioIds.has(scenario.id))
      errors.push(`${at}: duplicate id '${scenario.id}'`);
    processorScenarioIds.add(scenario.id);
    if (!scenario.id.startsWith(`${fam.prefix}-PS-`))
      errors.push(`${at}: id '${scenario.id}' has the wrong family prefix`);
    if (!sectionExists(specTexts[dir], scenario.section))
      errors.push(`${at}: section '${scenario.section}' is not a heading in the ${dir} specification`);
    const materializations = scenario.given.invocation.inputMaterializations || [];
    if (materializations.length) {
      if (!["openbindings.binding-spec-processor-scenarios@4", "openbindings.binding-spec-processor-scenarios@5", "openbindings.binding-spec-processor-scenarios@7"].includes(fixture.format))
        errors.push(`${at}: inputMaterializations require processor-scenario format @4 or later`);
      if (!scenario.given.invocation.inputPresent)
        errors.push(`${at}: inputMaterializations require inputPresent: true`);
      if (!Object.hasOwn(scenario.given.invocation, "input"))
        errors.push(`${at}: inputMaterializations require an input template`);
      const paths = new Set();
      for (const [materializationIndex, materialization] of materializations.entries()) {
        const materializationAt = `${at}.given.invocation.inputMaterializations[${materializationIndex}]`;
        if (paths.has(materialization.path))
          errors.push(`${materializationAt}: duplicate materialization path '${materialization.path}'`);
        paths.add(materialization.path);
        const target = jsonPointerValue(scenario.given.invocation.input, materialization.path);
        if (!target.found)
          errors.push(`${materializationAt}: path '${materialization.path}' does not resolve in the input template`);
        else if (target.value !== null)
          errors.push(`${materializationAt}: path '${materialization.path}' must name a null placeholder`);
        if (!hasUnpairedSurrogate(materialization.codeUnits))
          errors.push(`${materializationAt}: codeUnits must contain an unpaired surrogate so JSON-safe parsing cannot erase the hostile boundary`);
      }
    }
    for (const expected of scenario.expected) {
      for (const assertion of expected.assertions) {
        if (dir.startsWith("openapi-") && (assertion.path.startsWith("/context/") || assertion.path.startsWith("/error/")))
          errors.push(`${at}: portable OpenAPI evidence cannot assert project-interface path '${assertion.path}'`);
      }
    }
    for (const rule of scenario.rules) {
      if (!rule.startsWith(`${fam.prefix}-P-`) || !familyRuleIds[dir].has(rule))
        errors.push(`${at}: rule '${rule}' is not a defined ${dir} P-rule`);
      if (!processorRuleCoverage.has(rule)) processorRuleCoverage.set(rule, []);
      processorRuleCoverage.get(rule).push(scenario.id);
    }
  }
}

const processorPRules = new Map();
for (const dir of processorTargets) {
  const fam = FAMILIES[dir];
  for (const rule of extractFamilyPRules(specTexts[dir], fam.prefix)) {
    if (!processorPRules.has(rule)) processorPRules.set(rule, []);
    processorPRules.get(rule).push(dir);
  }
}
for (const [rule, dirs] of processorPRules) {
  if (!processorRuleCoverage.has(rule))
    errors.push(`Processor rule ${rule} (${dirs.join(", ")}) has no portable processor scenario`);
}

// The boundary matrix is executable negative evidence. Every row starts from
// a live, schema-valid scenario and changes one boundary fact. "semantic"
// mutants must remain schema-valid and be killed by the revision-7 semantic
// verifier; "schema" mutants must be killed by the discriminated union;
// revision and duplicate-key probes exercise their owning generic gates.
{
  let matrix;
  try { matrix = readJsonStrict(GRPC_BOUNDARY_MATRIX); }
  catch (error) { errors.push(`grpc-boundary-matrix.json: ${error.message}`); }
  const scenarioMap = new Map((grpcProcessorFixture?.scenarios || []).map((scenario) => [scenario.id, scenario]));
  const grpcSynthesisFixture = readJsonStrict(join(SYNTHESIS_DIR, "grpc.json"));
  const synthesisScenarioMap = new Map(grpcSynthesisFixture.scenarios.map((scenario) => [scenario.id, scenario]));
  const cloneScenario = (id) => {
    const source = scenarioMap.get(id);
    if (!source) throw new Error(`unknown processor seed '${id}'`);
    return structuredClone(source);
  };
  const peerEvent = (scenario, type, ordinal = 0) =>
    scenario.given.peer.events.filter((event) => event.type === type)[ordinal];
  const timelineEvent = (scenario, type, ordinal = 0) =>
    scenario.expected[0].timeline.filter((event) => event.event === type)[ordinal];
  const semanticMutators = {
    "causal-output-cycle": () => { const s = cloneScenario("GRPC-PS-06"); peerEvent(s, "data").after = { native: "output-0" }; return s; },
    "causal-output-forward-reference": () => { const s = cloneScenario("GRPC-PS-06"); peerEvent(s, "trailers").after = { native: "output-2" }; return s; },
    "causal-peer-after-cancel": () => { const s = cloneScenario("GRPC-PS-17"); s.given.peer.events.push({ id: "late", after: { action: 0 }, type: "transport-close" }); return s; },
    "causal-action-forward-reference": () => { const s = cloneScenario("GRPC-PS-07"); peerEvent(s, "trailers").after = { action: s.given.invocation.actions.length }; return s; },
    "causal-await-output-forward-reference": () => { const s = cloneScenario("GRPC-PS-08"); s.given.invocation.actions.push({ type: "await-output", index: 9 }); return s; },
    "causal-await-output-cycle": () => { const s = cloneScenario("GRPC-PS-08"); peerEvent(s, "data").after = { action: 0 }; return s; },
    "causal-await-native-order": () => { const s = cloneScenario("GRPC-PS-07"); const t = s.expected[0].timeline; t.splice(2, 0, t.shift()); return s; },
    "causal-request-before-acceptance": () => { const s = cloneScenario("GRPC-PS-07"); const t = s.expected[0].timeline; [t[1], t[2]] = [t[2], t[1]]; return s; },
    "causal-peer-after-stream-end": () => { const s = cloneScenario("GRPC-PS-01"); s.given.peer.events.push({ id: "late", after: { native: "output-0" }, type: "transport-close" }); return s; },
    "state-write-after-half-close": () => { const s = cloneScenario("GRPC-PS-07"); const action = s.given.invocation.actions.length; s.given.invocation.actions.push({ type: "write", value: { text: "late" } }); peerEvent(s, "trailers").after = { action }; const t = s.expected[0].timeline; const terminal = t.splice(-2); t.push({ event: "input-accepted", action, index: 2 }, { event: "request-message", index: 2 }, ...terminal); s.expected[0].native.requestMessages.push({ compressedFlag: 0, decodedLength: 6, decodedPayloadBase64: "CgRsYXRl", lengthMatchesEncodedPayload: true, valueJson: "{\"text\":\"late\"}" }); return s; },
    "state-double-half-close": () => { const s = cloneScenario("GRPC-PS-07"); const action = s.given.invocation.actions.length; s.given.invocation.actions.push({ type: "half-close" }); peerEvent(s, "trailers").after = { action }; s.expected[0].timeline.splice(-2, 0, { event: "input-half-closed", action }); return s; },
    "state-write-after-cancel": () => { const s = cloneScenario("GRPC-PS-17"); const e = timelineEvent(s, "input-rejected"); e.event = "input-accepted"; e.index = 0; const terminal = s.expected[0].timeline.pop(); s.expected[0].timeline.push({ event: "request-message", index: 0 }, terminal); s.expected[0].native.requestMessages.push({ compressedFlag: 0, decodedLength: 0, decodedPayloadBase64: "", lengthMatchesEncodedPayload: true, valueJson: "{}" }); return s; },
    "causal-post-terminal-event": () => { const s = cloneScenario("GRPC-PS-01"); s.expected[0].timeline.push({ event: "output", index: 1, valueJson: "{}" }); return s; },
    "cardinality-unary-extra-output": () => { const s = cloneScenario("GRPC-PS-06"); s.given.source.content = s.given.source.content.replace("returns (stream Res)", "returns (Res)"); return s; },
    "framing-incomplete-success": () => { const s = cloneScenario("GRPC-PS-09"); s.expected[0].disposition = "complete"; Object.assign(timelineEvent(s, "terminal"), { disposition: "complete", cause: "status" }); return s; },
    "framing-invalid-compressed-flag": () => { const s = cloneScenario("GRPC-PS-12"); peerEvent(s, "data").dataBase64 = "AgAAAAA="; return s; },
    "metadata-capture-mismatch": () => { const s = cloneScenario("GRPC-PS-11"); s.expected[0].native.requestHeaders.find((group) => group.name === "x-tag").values.reverse(); return s; },
    "status-peer-normalized-contradiction": () => { const s = cloneScenario("GRPC-PS-14"); peerEvent(s, "trailers").headers[0].values[0] = "0"; return s; },
    "status-duplicate-final-value": () => { const s = cloneScenario("GRPC-PS-14"); peerEvent(s, "trailers").headers[0].values.push("5"); return s; },
    "reflection-version-trigger-mismatch": () => { const s = cloneScenario("GRPC-PS-02"); peerEvent(s, "reflection-message").reflectionVersion = "v1"; return s; },
    "reflection-absent-trigger": () => { const s = cloneScenario("GRPC-PS-02"); peerEvent(s, "reflection-message").after = { native: "output-0" }; return s; },
    "reflection-request-host-mismatch": () => { const s = cloneScenario("GRPC-PS-02"); s.expected[0].native.reflection[0].host = "other.example:443"; return s; },
    "reflection-valid-host-mismatch": () => { const s = cloneScenario("GRPC-PS-29"); const e = structuredClone(peerEvent(s, "reflection-message")); e.id = "v1-inconsistent-host"; e.validHost = "changed-cache-key"; s.given.peer.events.splice(1, 0, e); return s; },
    "reflection-deadline-refresh": () => { const s = cloneScenario("GRPC-PS-02"); s.expected[0].native.reflection[1].deadlineNs = "1250000000"; return s; },
    "reflection-deadline-expiry-fallback": () => { const s = cloneScenario("GRPC-PS-02"); peerEvent(s, "reflection-status").elapsedNs = "1000000000"; return s; },
    "reflection-discovery-metadata-mismatch": () => { const s = cloneScenario("GRPC-PS-02"); s.expected[0].native.reflection[0].requestHeaders[0].values[0] = "Bearer app"; return s; },
    "deadline-header-mismatch": () => { const s = cloneScenario("GRPC-PS-13"); s.given.configuration.timeoutNs = "2"; return s; },
    "cancellation-count-mismatch": () => { const s = cloneScenario("GRPC-PS-17"); s.expected[0].native.cancellations = 0; return s; },
    "limit-inbound-boundary-mismatch": () => { const s = cloneScenario("GRPC-PS-19"); s.given.configuration.limits.maxInboundMessageBytes = 100; return s; },
    "limit-outbound-boundary-mismatch": () => { const s = cloneScenario("GRPC-PS-10"); s.given.configuration = { limits: { maxOutboundMessageBytes: 3 } }; return s; },
    "compression-request-evidence-mismatch": () => { const s = cloneScenario("GRPC-PS-10"); s.given.configuration = { compression: "gzip" }; return s; },
    "compression-response-evidence-mismatch": () => { const s = cloneScenario("GRPC-PS-12"); Object.assign(timelineEvent(s, "terminal"), { cause: "transport" }); return s; },
    "action-result-kind-mismatch": () => { const s = cloneScenario("GRPC-PS-07"); const e = timelineEvent(s, "input-accepted"); e.event = "input-half-closed"; delete e.index; return s; },
    "request-native-count-mismatch": () => { const s = cloneScenario("GRPC-PS-06"); s.expected[0].native.requestMessages = []; return s; },
    "grpc-message-raw-loss": () => { const s = cloneScenario("GRPC-PS-01"); s.expected[0].native.grpcMessageRaw = ["replacement"]; return s; },
    "status-details-contradictory-code": () => { const s = cloneScenario("GRPC-PS-14"); peerEvent(s, "trailers").headers.find((group) => group.name === "grpc-status-details-bin").values = ["CAM="]; s.expected[0].native.statusDetails = [{ rawBase64: "CAM=", decoded: true, codePresent: true, code: 3 }]; return s; },
    "status-details-malformed-protobuf": () => { const s = cloneScenario("GRPC-PS-14"); peerEvent(s, "trailers").headers.find((group) => group.name === "grpc-status-details-bin").values = ["gA=="]; s.expected[0].native.statusDetails = [{ rawBase64: "gA==", decoded: false }]; return s; },
    "status-details-duplicate": () => { const s = cloneScenario("GRPC-PS-14"); peerEvent(s, "trailers").headers.find((group) => group.name === "grpc-status-details-bin").values.push("CAU="); s.expected[0].native.statusDetails.push({ rawBase64: "CAU=", decoded: true, codePresent: true, code: 5 }); return s; },
    "metadata-application-te-collision": () => { const s = cloneScenario("GRPC-PS-11"); s.given.configuration.metadata[0].name = "te"; return s; },
    "metadata-application-user-agent-collision": () => { const s = cloneScenario("GRPC-PS-11"); s.given.configuration.metadata[0].name = "user-agent"; return s; },
    "metadata-discovery-content-type-collision": () => { const s = cloneScenario("GRPC-PS-18"); s.given.configuration.discoveryMetadata[0].name = "content-type"; return s; },
    "metadata-discovery-user-agent-collision": () => { const s = cloneScenario("GRPC-PS-18"); s.given.configuration.discoveryMetadata[0].name = "user-agent"; return s; },
    "tls-server-name-trailing-dot": () => { const s = cloneScenario("GRPC-PS-16"); s.given.configuration.tls.serverName = "api.example.com."; return s; },
    "tls-server-name-port": () => { const s = cloneScenario("GRPC-PS-16"); s.given.configuration.tls.serverName = "api.example.com:443"; return s; },
    "tls-server-name-bracketed-ip": () => { const s = cloneScenario("GRPC-PS-16"); s.given.configuration.tls.serverName = "[2001:db8::1]"; return s; },
    "tls-server-name-zone": () => { const s = cloneScenario("GRPC-PS-16"); s.given.configuration.tls.serverName = "fe80::1%en0"; return s; },
    "tls-ip-sni-forbidden": () => { const s = cloneScenario("GRPC-PS-16"); s.given.configuration.tls.serverName = "10.0.0.6"; s.expected[0].native.channel.sni = "10.0.0.6"; return s; },
    "tls-override-authority-mutation": () => { const s = cloneScenario("GRPC-PS-16"); s.expected[0].native.channel.httpAuthority = "api.example.com:443"; return s; },
    "response-data-before-headers": () => { const s = cloneScenario("GRPC-PS-01"); const events=s.given.peer.events; [events[0],events[1]]=[events[1],events[0]]; return s; },
    "response-duplicate-headers": () => { const s = cloneScenario("GRPC-PS-01"); const e=structuredClone(peerEvent(s,"response-headers")); e.id="duplicate-h";s.given.peer.events.splice(1,0,e);return s; },
    "response-http-status-missing": () => { const s=cloneScenario("GRPC-PS-01"),h=peerEvent(s,"response-headers").headers;h.splice(h.findIndex((group)=>group.name===":status"),1);return s; },
    "response-http-status-duplicate": () => { const s=cloneScenario("GRPC-PS-01");peerEvent(s,"response-headers").headers.push({name:":status",values:["201"]});return s; },
    "status-grpc-message-duplicate": () => { const s=cloneScenario("GRPC-PS-88");peerEvent(s,"trailers").headers.find((group)=>group.name==="grpc-message").values=["alpha","beta"];s.expected[0].native.grpcMessageRaw=["alpha","beta"];return s; },
    "status-out-of-range-normalization": () => { const s=cloneScenario("GRPC-PS-77");timelineEvent(s,"final-status").code=3;return s; },
    "status-details-raw-pre-normalization": () => { const s=cloneScenario("GRPC-PS-78");const group=peerEvent(s,"trailers").headers.find((entry)=>entry.name==="grpc-status-details-bin");group.values=["CAI="];s.expected[0].native.statusDetails=[{rawBase64:"CAI=",decoded:true,codePresent:true,code:2}];return s; },
    "cardinality-streaming-initial-input": () => { const s=cloneScenario("GRPC-PS-07");s.given.invocation.inputPresent=true;s.given.invocation.input={text:"lost"};return s; },
    "content-type-protobuf-only": () => { const s=cloneScenario("GRPC-PS-83");peerEvent(s,"response-headers").headers.find((group)=>group.name==="content-type").values=["application/grpc+json"];return s; },
    "limit-post-open-cancellation": () => { const s=cloneScenario("GRPC-PS-56"),t=s.expected[0].timeline;t.splice(t.findIndex((event)=>event.event==="cancelled"),1);s.expected[0].native.cancellations=0;return s; },
    "connection-failure-cause": () => { const s=cloneScenario("GRPC-PS-63");peerEvent(s,"connection-outcome").failureCause="security";return s; },
    "response-pseudo-after-regular": () => { const s=cloneScenario("GRPC-PS-01"),h=peerEvent(s,"response-headers").headers;h.push(h.shift());return s; },
    "request-native-order-mismatch": () => { const s=cloneScenario("GRPC-PS-07");s.expected[0].native.requestMessages.reverse();return s; },
    "request-native-ghost": () => { const s=cloneScenario("GRPC-PS-07");s.expected[0].native.requestMessages.push(structuredClone(s.expected[0].native.requestMessages[0]));return s; },
    "reflection-native-order-mismatch": () => { const s=cloneScenario("GRPC-PS-02");s.expected[0].native.reflection.reverse();return s; },
    "reflection-native-ghost": () => { const s=cloneScenario("GRPC-PS-02");s.expected[0].native.reflection.push(structuredClone(s.expected[0].native.reflection[1]));return s; },
    "value-request-origin-mismatch": () => { const s=cloneScenario("GRPC-PS-90");s.expected[0].native.requestMessages[0].valueJson='{"numbers":[1,3]}';return s; },
    "protojson-timestamp-offset-preservation": () => { const s=cloneScenario("GRPC-PS-90");s.expected[0].native.requestMessages[0].valueJson=s.expected[0].native.requestMessages[0].valueJson.replace("2026-09-05T08:34:56-04:00","2026-09-05T12:34:56Z");return s; },
    "protojson-float-token-preservation": () => { const s=cloneScenario("GRPC-PS-90");s.expected[0].native.requestMessages[0].valueJson=s.expected[0].native.requestMessages[0].valueJson.replace('"precise":1.5','"precise":2.5');return s; },
    "protojson-any-url-preservation": () => { const s=cloneScenario("GRPC-PS-90");s.expected[0].native.requestMessages[0].valueJson=s.expected[0].native.requestMessages[0].valueJson.replace("https://schemas.example/v1/processorvalues.Wire","type.googleapis.com/processorvalues.Wire");return s; },
    "protojson-civil-date-refusal": () => { const s=cloneScenario("GRPC-PS-103"),e=s.expected[0];e.disposition="complete";e.phase="completion";Object.assign(timelineEvent(s,"terminal"),{disposition:"complete",cause:"status"});return s; },
    "protojson-decoded-wkt-invariant": () => { const s=cloneScenario("GRPC-PS-112"),e=s.expected[0];e.disposition="complete";e.phase="completion";Object.assign(timelineEvent(s,"terminal"),{disposition:"complete",cause:"status"});return s; },
    "metadata-unicode-scalar-order": () => { const s=cloneScenario("GRPC-PS-90"),m=s.expected[0].native.leadingMetadata;[m[0],m[1]]=[m[1],m[0]];return s; },
    "response-metadata-nonzero-pad-bits": () => { const s=cloneScenario("GRPC-PS-90");peerEvent(s,"response-headers").headers.find((group)=>group.name==="x-response-bin").values=["Zh"];return s; },
    "response-metadata-evidence-missing": () => { const s=cloneScenario("GRPC-PS-90");s.expected[0].native.leadingMetadata.pop();return s; },
    "response-metadata-evidence-ghost": () => { const s=cloneScenario("GRPC-PS-90");s.expected[0].native.leadingMetadata.push({name:"z-ghost",value:"1"});return s; },
    "response-metadata-evidence-reorder": () => { const s=cloneScenario("GRPC-PS-90");s.expected[0].native.leadingMetadata.reverse();return s; },
    "response-metadata-evidence-value": () => { const s=cloneScenario("GRPC-PS-90");s.expected[0].native.trailingMetadata.find((group)=>group.name==="x-trailer-bin").value[0]="AAA=";return s; },
    "protojson-negative-zero-wire": () => { const s=cloneScenario("GRPC-PS-116");s.given.invocation.input.precise="0";return s; },
    "protojson-float32-underflow-wire": () => { const s=cloneScenario("GRPC-PS-117");s.given.invocation.input.ratio="1e-45";return s; },
    "protojson-float32-min-rounding-wire": () => { const s=cloneScenario("GRPC-PS-118");s.given.invocation.input.ratio="2.80259692e-45";return s; },
    "protojson-float32-max-rounding-wire": () => { const s=cloneScenario("GRPC-PS-119");s.given.invocation.input.ratio="3e38";return s; },
    "protojson-empty-bytes-wire": () => { const s=cloneScenario("GRPC-PS-120");s.given.invocation.input.raw="AA==";return s; },
    "protojson-map-leading-zero-wire": () => { const s=cloneScenario("GRPC-PS-120");s.expected[0].native.requestMessages[0].valueJson=s.expected[0].native.requestMessages[0].valueJson.replace('"1":"x"','"1":"wrong"');return s; },
    "protojson-direct-nullvalue-wire": () => { const s=cloneScenario("GRPC-PS-120");delete s.given.invocation.input.nullValue;return s; },
    "protojson-map-bool-kind": () => { const s=cloneScenario("GRPC-PS-121"),e=s.expected[0];e.disposition="complete";e.phase="completion";Object.assign(timelineEvent(s,"terminal"),{disposition:"complete",cause:"status"});return s; },
    "protojson-map-integer-kind": () => { const s=cloneScenario("GRPC-PS-122"),e=s.expected[0];e.disposition="complete";e.phase="completion";Object.assign(timelineEvent(s,"terminal"),{disposition:"complete",cause:"status"});return s; },
    "protojson-map-int32-range": () => { const s=cloneScenario("GRPC-PS-123"),e=s.expected[0];e.disposition="complete";e.phase="completion";Object.assign(timelineEvent(s,"terminal"),{disposition:"complete",cause:"status"});return s; },
    "protojson-map-uint64-range": () => { const s=cloneScenario("GRPC-PS-124"),e=s.expected[0];e.disposition="complete";e.phase="completion";Object.assign(timelineEvent(s,"terminal"),{disposition:"complete",cause:"status"});return s; },
    "protojson-map-normalized-collision": () => { const s=cloneScenario("GRPC-PS-125");s.expected[0].disposition="complete";return s; },
    "protojson-value-nan-output": () => { const s=cloneScenario("GRPC-PS-126"),e=s.expected[0];e.disposition="complete";e.phase="completion";Object.assign(timelineEvent(s,"terminal"),{disposition:"complete",cause:"status"});return s; },
    "protojson-value-positive-infinity-output": () => { const s=cloneScenario("GRPC-PS-127"),e=s.expected[0];e.disposition="complete";e.phase="completion";Object.assign(timelineEvent(s,"terminal"),{disposition:"complete",cause:"status"});return s; },
    "protojson-value-negative-infinity-output": () => { const s=cloneScenario("GRPC-PS-128"),e=s.expected[0];e.disposition="complete";e.phase="completion";Object.assign(timelineEvent(s,"terminal"),{disposition:"complete",cause:"status"});return s; },
    "protojson-null-json-fds": () => { const s=cloneScenario("GRPC-PS-91");delete s.given.invocation.input.count;return s; },
    "protojson-null-binary-fds": () => { const s=cloneScenario("GRPC-PS-92");delete s.given.invocation.input.count;return s; },
    "protojson-null-reflection-v1": () => { const s=cloneScenario("GRPC-PS-93");delete s.given.invocation.input.count;return s; },
    "protojson-null-reflection-v1alpha": () => { const s=cloneScenario("GRPC-PS-94");delete s.given.invocation.input.count;return s; },
    "protojson-float32-rounded-boundary-processor": () => { const s=cloneScenario("GRPC-PS-129");s.expected[0].native.requestMessages[0].valueJson=s.expected[0].native.requestMessages[0].valueJson.replace("3.4028235e38","3");return s; },
    "protojson-unsigned-negative-zero-processor": () => { const s=cloneScenario("GRPC-PS-130"),e=s.expected[0];e.disposition="complete";e.phase="completion";Object.assign(timelineEvent(s,"terminal"),{disposition:"complete",cause:"status"});return s; },
    "protojson-plus-collision-processor": () => { const s=cloneScenario("GRPC-PS-131");s.expected[0].disposition="complete";return s; },
    "protojson-unset-value-output-processor": () => { const s=cloneScenario("GRPC-PS-132"),e=s.expected[0];e.disposition="complete";e.phase="completion";Object.assign(timelineEvent(s,"terminal"),{disposition:"complete",cause:"status"});return s; },
    "protojson-float32-overflow-processor": () => { const s=cloneScenario("GRPC-PS-133"),e=s.expected[0];e.disposition="complete";e.phase="completion";Object.assign(timelineEvent(s,"terminal"),{disposition:"complete",cause:"status"});return s; },
    "protojson-any-envelope-type-collision": () => { const s=cloneScenario("GRPC-PS-134"),e=s.expected[0];e.disposition="complete";e.phase="completion";Object.assign(timelineEvent(s,"terminal"),{disposition:"complete",cause:"status"});return s; },
    "protojson-duration-framing-processor": () => { const s=cloneScenario("GRPC-PS-135");s.expected[0].native.requestMessages[0].decodedLength++;return s; },
    "protojson-any-output-envelope-collision": () => { const s=cloneScenario("GRPC-PS-136"),e=s.expected[0];e.disposition="complete";e.phase="completion";Object.assign(timelineEvent(s,"terminal"),{disposition:"complete",cause:"status"});return s; },
    "protojson-direct-envelope-spelling": () => { const s=cloneScenario("GRPC-PS-137");timelineEvent(s,"output").index=1;return s; },
    "protojson-alias-null-duplicate": () => { const s=cloneScenario("GRPC-PS-138"),e=s.expected[0];e.disposition="complete";e.phase="completion";Object.assign(timelineEvent(s,"terminal"),{disposition:"complete",cause:"status"});return s; },
    "protojson-mixed-base64-standard-first": () => { const s=cloneScenario("GRPC-PS-139");s.expected[0].disposition="complete";return s; },
    "protojson-mixed-base64-url-first": () => { const s=cloneScenario("GRPC-PS-140");s.expected[0].disposition="complete";return s; },
    "protojson-wrapper-null-field": () => { const s=cloneScenario("GRPC-PS-141");s.expected[0].native.requestMessages[0].decodedLength++;return s; },
    "protojson-value-null-oneof": () => { const s=cloneScenario("GRPC-PS-141");s.expected[0].native.requestMessages[0].decodedPayloadBase64="";return s; },
    "protojson-enum-quoted-int32": () => { const s=cloneScenario("GRPC-PS-142");s.expected[0].disposition="complete";return s; },
    "protojson-closed-enum-singular-output": () => { const s=cloneScenario("GRPC-PS-143");timelineEvent(s,"output").index=1;return s; },
    "protojson-closed-enum-expanded-output": () => { const s=cloneScenario("GRPC-PS-144");timelineEvent(s,"output").index=1;return s; },
    "protojson-closed-enum-packed-output": () => { const s=cloneScenario("GRPC-PS-145");timelineEvent(s,"output").index=1;return s; },
    "protojson-closed-enum-input-wire": () => { const s=cloneScenario("GRPC-PS-146");s.expected[0].disposition="complete";return s; },
    "protojson-recursive-invalid-utf8": () => { const s=cloneScenario("GRPC-PS-147"),e=s.expected[0];e.disposition="complete";Object.assign(timelineEvent(s,"terminal"),{disposition:"complete",cause:"status"});return s; },
    "protojson-own-proto-key": () => { const s=cloneScenario("GRPC-PS-149");timelineEvent(s,"output").index=1;return s; },
    "protojson-closed-enum-composite": () => { const s=cloneScenario("GRPC-PS-150");timelineEvent(s,"output").index=1;return s; },
    "protojson-surviving-string-overwrite": () => { const s=cloneScenario("GRPC-PS-151");timelineEvent(s,"output").index=1;return s; },
    "protojson-wire-varint-bound": () => { const s=cloneScenario("GRPC-PS-152");s.expected[0].disposition="complete";return s; },
    "protojson-enum-simple-atoi": () => { const s=cloneScenario("GRPC-PS-153");s.expected[0].disposition="complete";return s; },
    "protojson-enum-exponent-refusal": () => { const s=cloneScenario("GRPC-PS-154");s.expected[0].disposition="complete";return s; },
    "protojson-any-prefix-nonempty": () => { const s=cloneScenario("GRPC-PS-155");s.expected[0].disposition="complete";return s; },
    "protojson-cross-field-collision-exclusion": () => { const s=cloneScenario("GRPC-PS-156");s.expected[0].disposition="complete";return s; },
    "protojson-collision-sibling-confinement": () => { const s=cloneScenario("GRPC-PS-157");s.expected[0].native.requestMessages[0].decodedLength++;return s; },
    "protojson-edition-closed-unknown": () => { const s=cloneScenario("GRPC-PS-158");timelineEvent(s,"output").index=1;return s; },
    "protojson-base64-nonzero-bits": () => { const s=cloneScenario("GRPC-PS-159");s.expected[0].disposition="complete";return s; },
    "protojson-explicit-json-name-default-camel": () => { const s=cloneScenario("GRPC-PS-160");s.expected[0].disposition="complete";return s; },
    "protojson-edition-enum-integral-number": () => { const s=cloneScenario("GRPC-PS-161");s.given.invocation.input.state="1";return s; },
    "protojson-edition-enum-original-name": () => { const s=cloneScenario("GRPC-PS-162");s.given.invocation.input={enumState:"STATE_READY"};return s; },
    "protojson-value-varint-context": () => { const s=cloneScenario("GRPC-PS-163");peerEvent(s,"data").dataBase64="AAAAABwI/////////////wASDgj///////////8CEgF4";s.expected[0].disposition="error";return s; },
  };
  const schemaMutators = {
    "peer-connection-outcome-required-fields": () => { const s = cloneScenario("GRPC-PS-16"); delete peerEvent(s, "connection-outcome").success; return s; },
    "peer-response-headers-required-fields": () => { const s = cloneScenario("GRPC-PS-01"); delete peerEvent(s, "response-headers").headers; return s; },
    "peer-data-required-fields": () => { const s = cloneScenario("GRPC-PS-06"); delete peerEvent(s, "data").dataBase64; return s; },
    "peer-trailers-required-fields": () => { const s = cloneScenario("GRPC-PS-05"); delete peerEvent(s, "trailers").headers; return s; },
    "peer-transport-close-closed-fields": () => { const s = cloneScenario("GRPC-PS-16"); const e = peerEvent(s, "connection-outcome"); e.type = "transport-close"; e.headers = []; delete e.success; return s; },
    "peer-goaway-required-fields": () => { const s = cloneScenario("GRPC-PS-16"); const e = peerEvent(s, "connection-outcome"); e.type = "goaway"; delete e.success; return s; },
    "peer-reflection-required-fields": () => { const s = cloneScenario("GRPC-PS-29"); delete peerEvent(s, "reflection-message").compressed; return s; },
    "timeline-channel-ready-closed-fields": () => { const s = cloneScenario("GRPC-PS-16"); timelineEvent(s, "channel-ready").code = 0; return s; },
    "timeline-rpc-opened-closed-fields": () => { const s = cloneScenario("GRPC-PS-01"); timelineEvent(s, "rpc-opened").code = 0; return s; },
    "timeline-request-message-required-fields": () => { const s = cloneScenario("GRPC-PS-01"); delete timelineEvent(s, "request-message").index; return s; },
    "timeline-input-accepted-required-fields": () => { const s = cloneScenario("GRPC-PS-07"); delete timelineEvent(s, "input-accepted").action; return s; },
    "timeline-input-rejected-required-fields": () => { const s = cloneScenario("GRPC-PS-17"); delete timelineEvent(s, "input-rejected").action; return s; },
    "timeline-input-half-closed-closed-fields": () => { const s = cloneScenario("GRPC-PS-05"); timelineEvent(s, "input-half-closed").code = 0; return s; },
    "timeline-output-required-fields": () => { const s = cloneScenario("GRPC-PS-01"); delete timelineEvent(s, "output").valueJson; return s; },
    "timeline-final-status-required-fields": () => { const s = cloneScenario("GRPC-PS-01"); delete timelineEvent(s, "final-status").code; return s; },
    "timeline-cancelled-required-fields": () => { const s = cloneScenario("GRPC-PS-17"); delete timelineEvent(s, "cancelled").cause; return s; },
    "timeline-action-failed-required-fields": () => { const s = cloneScenario("GRPC-PS-17"); const e = timelineEvent(s, "input-rejected"); e.event = "action-failed"; return s; },
    "timeline-terminal-required-fields": () => { const s = cloneScenario("GRPC-PS-01"); delete timelineEvent(s, "terminal").cause; return s; },
    "metadata-reserved-name": () => { const s = cloneScenario("GRPC-PS-11"); s.given.configuration.metadata[0].name = "grpc-test"; return s; },
    "metadata-binary-string-value": () => { const s = cloneScenario("GRPC-PS-11"); s.given.configuration.metadata.find((group) => group.name.endsWith("-bin")).values = ["AAE="]; return s; },
    "response-pseudo-path": () => { const s=cloneScenario("GRPC-PS-01");peerEvent(s,"response-headers").headers.push({name:":path",values:["/wrong"]});return s; },
    "response-unknown-grpc-header": () => { const s=cloneScenario("GRPC-PS-01");peerEvent(s,"response-headers").headers.push({name:"grpc-unknown",values:["x"]});return s; },
    "trailer-grpc-encoding": () => { const s=cloneScenario("GRPC-PS-01");peerEvent(s,"trailers").headers.push({name:"grpc-encoding",values:["gzip"]});return s; },
    "trailer-pseudo-status": () => { const s=cloneScenario("GRPC-PS-01");peerEvent(s,"trailers").headers.push({name:":status",values:["200"]});return s; },
    "trailer-content-type": () => { const s=cloneScenario("GRPC-PS-01");peerEvent(s,"trailers").headers.push({name:"content-type",values:["application/grpc"]});return s; },
    "response-metadata-invalid-base64": () => { const s=cloneScenario("GRPC-PS-90");peerEvent(s,"response-headers").headers.find((group)=>group.name==="x-response-bin").values=["%%%"];return s; },
    "trailer-metadata-control-character": () => { const s=cloneScenario("GRPC-PS-90");peerEvent(s,"trailers").headers.find((group)=>group.name==="x-trailer").values=["bad\u0000value"];return s; },
  };
  const synthesisMutators = {
    "revision-openapi-isolation": () => { const f = readJsonStrict(join(SYNTHESIS_DIR, "openapi-3.1.json")); f.format = "openbindings.binding-spec-synthesis-scenarios@4"; return f; },
    "revision-grpc-isolation": () => { const f = readJsonStrict(join(SYNTHESIS_DIR, "grpc.json")); f.format = "openbindings.binding-spec-synthesis-scenarios@5"; return f; },
    "revision-asyncapi-isolation": () => { const f = readJsonStrict(join(SYNTHESIS_DIR, "asyncapi.json")); f.format = "openbindings.binding-spec-synthesis-scenarios@5"; return f; },
  };
  const processorRevisionMutators = {
    "revision-processor-grpc-isolation": () => { const f = structuredClone(grpcProcessorFixture); f.format = "openbindings.binding-spec-processor-scenarios@6"; return f; },
    "revision-processor-asyncapi-isolation": () => { const f = readJsonStrict(join(PROCESSOR_DIR, "asyncapi.json")); f.format = "openbindings.binding-spec-processor-scenarios@7"; return f; },
  };
  const synthesisSemanticMutators = {
    "synthesis-reflection-closed-fields": () => { const s = structuredClone(synthesisScenarioMap.get("GRPC-SS-04")); s.discovery.privateState = true; return s.discovery; },
    "synthesis-reflection-first-request": () => { const s = structuredClone(synthesisScenarioMap.get("GRPC-SS-04")); s.discovery.requests[0] = { kind: "file-containing-symbol", value: "demo.S" }; return s.discovery; },
    "synthesis-reflection-duplicate-query": () => { const s = structuredClone(synthesisScenarioMap.get("GRPC-SS-04")); s.discovery.requests.push(structuredClone(s.discovery.requests[1])); return s.discovery; },
    "synthesis-reflection-list-omitted-service": () => { const s = structuredClone(synthesisScenarioMap.get("GRPC-SS-04")); s.discovery.listedServices = []; return s.discovery; },
    "synthesis-reflection-list-unqueried-service": () => { const s = structuredClone(synthesisScenarioMap.get("GRPC-SS-04")); s.discovery.listedServices.push("demo.Unqueried"); return s.discovery; },
  };
  const strictJsonMutants = {
    "duplicate-json-member": '{"same":1,"same":2}',
    "json-trailing-source": '{"same":1} trailing',
    "json-nested-duplicate": '{"outer":{"same":1,"same":2}}',
    "json-nbsp-whitespace": '{"same":\u00a01}',
    "json-line-separator-whitespace": '{"same":\u20281}',
    "json-lone-surrogate-value": '{"same":"\\ud800"}',
    "json-lone-surrogate-key": '{"\\udc00":1}',
    "json-invalid-utf8-source": Buffer.from([0x7b,0x22,0x78,0x22,0x3a,0x22,0xff,0x22,0x7d]),
    "json-outer-duplicate": '{"format":"a","format":"b"}',
    "json-leading-bom": Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from('{"same":1}')]),
  };
  const expectedIds = new Set([...Object.keys(semanticMutators), ...Object.keys(schemaMutators), ...Object.keys(synthesisMutators), ...Object.keys(processorRevisionMutators), ...Object.keys(synthesisSemanticMutators), ...Object.keys(strictJsonMutants)]);
  if (matrix) {
    if (matrix.format !== "openbindings.grpc-boundary-matrix@1" || !Array.isArray(matrix.cases))
      errors.push("grpc-boundary-matrix.json: unsupported shape or format");
    else {
      grpcBoundaryMutants = matrix.cases.length;
      const ids = new Set();
      for (const [index, test] of matrix.cases.entries()) {
        const at = `grpc-boundary-matrix.json.cases[${index}]`;
        if (!test || typeof test !== "object" || Array.isArray(test)) { errors.push(`${at}: must be an object`); continue; }
        const keys = Object.keys(test).sort().join(",");
        if (keys !== "description,detector,id,rule,seed") errors.push(`${at}: fields must be exactly description, detector, id, rule, seed`);
        if (ids.has(test.id)) errors.push(`${at}: duplicate id '${test.id}'`);
        ids.add(test.id);
        if (!expectedIds.has(test.id)) { errors.push(`${at}: no executable mutant named '${test.id}'`); continue; }
        if (!familyRuleIds.grpc.has(test.rule)) errors.push(`${at}: rule '${test.rule}' is not defined by gRPC`);
        try {
          if (test.detector === "schema") {
            const mutant = schemaMutators[test.id]();
            if (ajvOk(GRPC_PROCESSOR_V7_SCHEMA, mutant).ok) errors.push(`${at}: schema mutant survived`);
          } else if (test.detector === "semantic") {
            const mutant = semanticMutators[test.id]();
            const shape = ajvOk(GRPC_PROCESSOR_V7_SCHEMA, mutant);
            if (!shape.ok) errors.push(`${at}: semantic mutant was rejected by schema instead of exercising semantic validation\n${shape.out}`);
            else if (grpcRevisionSevenViolations(mutant, at).length === 0) errors.push(`${at}: semantic mutant survived`);
          } else if (test.detector === "synthesis-schema") {
            const mutant = synthesisMutators[test.id]();
            if (ajvOk(SYNTHESIS_SCHEMA, mutant).ok) errors.push(`${at}: synthesis revision mutant survived`);
          } else if (test.detector === "processor-schema") {
            const mutant = processorRevisionMutators[test.id]();
            if (ajvOk(PROCESSOR_SCHEMA, mutant).ok) errors.push(`${at}: processor revision mutant survived`);
          } else if (test.detector === "synthesis-semantic") {
            const discovery = synthesisSemanticMutators[test.id]();
            if (grpcReflectionTranscriptViolations(discovery, at).length === 0) errors.push(`${at}: synthesis reflection mutant survived`);
          } else if (test.detector === "strict-json") {
            try { parseJsonStrict(strictJsonMutants[test.id], at); errors.push(`${at}: strict JSON mutant survived`); }
            catch (error) {
              if (test.id === "duplicate-json-member" && !/duplicate object member/.test(error.message)) errors.push(`${at}: duplicate JSON mutant failed for the wrong reason`);
              if (test.id.includes("surrogate") && !/unpaired/.test(error.message)) errors.push(`${at}: surrogate mutant failed for the wrong reason`);
            }
          } else errors.push(`${at}: unknown detector '${test.detector}'`);
        } catch (error) {
          errors.push(`${at}: mutant construction failed: ${error.message}`);
        }
      }
      for (const id of expectedIds) if (!ids.has(id)) errors.push(`grpc-boundary-matrix.json: missing executable mutant '${id}'`);
    }
  }
}

{
  const prose = readFileSync(README, "utf8");
  const match = prose.match(/\[`grpc-boundary-matrix\.json`\][\s\S]*?keeps (\d+) adverse/);
  if (!match) errors.push("conformance README: missing gRPC boundary-matrix count statement");
  else if (Number(match[1]) !== grpcBoundaryMutants)
    errors.push(`conformance README: gRPC boundary-matrix count ${match[1]} does not match ${grpcBoundaryMutants}`);
}

// The stronger invocation-fidelity profile is kept separate from published
// family conformance. It reuses the semantic harness but may also cite the
// core binding-specification completeness floor.
const fidelityTargets = [
  "openapi-3.0",
  "openapi-3.1",
  "asyncapi",
  "grpc",
  "connect",
  "graphql",
  "mcp",
  "usage",
];
let fidelityScenarios = 0;
for (const dir of fidelityTargets) {
  const fam = FAMILIES[dir];
  const path = join(FIDELITY_DIR, `${dir}.json`);
  if (!existsSync(path)) {
    errors.push(`invocation-fidelity/${dir}.json: missing fidelity scenario file`);
    continue;
  }
  let fixture;
  try {
    fixture = readJsonStrict(path);
  } catch (e) {
    errors.push(`invocation-fidelity/${dir}.json: failed to parse JSON: ${e.message}`);
    continue;
  }
  const shape = ajvOk(FIDELITY_SCHEMA, fixture);
  if (!shape.ok) {
    errors.push(`invocation-fidelity/${dir}.json: does not match scenario.schema.json\n${shape.out}`);
    continue;
  }
  if (fixture.family !== dir)
    errors.push(`invocation-fidelity/${dir}.json: family '${fixture.family}' does not match filename`);
  if (fixture.bindingSpec !== fam.bindingSpec)
    errors.push(`invocation-fidelity/${dir}.json: bindingSpec '${fixture.bindingSpec}' is not '${fam.bindingSpec}'`);
  for (const [i, scenario] of fixture.scenarios.entries()) {
    fidelityScenarios++;
    if (!scenario.id.startsWith(`${fam.prefix}-FI-`))
      errors.push(`invocation-fidelity/${dir}.json.scenarios[${i}]: id '${scenario.id}' has the wrong family prefix`);
    if (!sectionExists(specTexts[dir], scenario.section))
      errors.push(`invocation-fidelity/${dir}.json.scenarios[${i}]: section '${scenario.section}' is not a heading in the ${dir} specification`);
    for (const rule of scenario.rules) {
      if (!coreRules.has(rule) && !familyRuleIds[dir].has(rule))
        errors.push(`invocation-fidelity/${dir}.json.scenarios[${i}]: rule '${rule}' is not defined by core or the family specification`);
    }
  }
}

// Portable synthesis scenarios prove artifact-inventory accounting and
// emitted target identity independently of either reference SDK's API.
const synthesisScenarioIds = new Set();
const synthesisRuleCoverage = new Map();
let synthesisFiles = 0;
let synthesisScenarios = 0;
for (const dir of processorTargets) {
  const fam = FAMILIES[dir];
  const path = join(SYNTHESIS_DIR, `${dir}.json`);
  if (!existsSync(path)) {
    errors.push(`synthesis/${dir}.json: missing portable synthesis scenario file`);
    continue;
  }
  let fixture;
  try {
    fixture = readJsonStrict(path);
  } catch (e) {
    errors.push(`synthesis/${dir}.json: failed to parse JSON: ${e.message}`);
    continue;
  }
  synthesisFiles++;
  const shape = ajvOk(SYNTHESIS_SCHEMA, fixture);
  if (!shape.ok) {
    errors.push(`synthesis/${dir}.json: does not match synthesis-scenario.schema.json\n${shape.out}`);
    continue;
  }
  if (fixture.family !== dir)
    errors.push(`synthesis/${dir}.json: family '${fixture.family}' does not match filename`);
  if (fixture.bindingSpec !== fam.bindingSpec)
    errors.push(`synthesis/${dir}.json: bindingSpec '${fixture.bindingSpec}' is not '${fam.bindingSpec}'`);

  for (const [i, scenario] of fixture.scenarios.entries()) {
    synthesisScenarios++;
    const at = `synthesis/${dir}.json.scenarios[${i}]`;
    if (synthesisScenarioIds.has(scenario.id))
      errors.push(`${at}: duplicate id '${scenario.id}'`);
    synthesisScenarioIds.add(scenario.id);
    if (!scenario.id.startsWith(`${fam.prefix}-SS-`))
      errors.push(`${at}: id '${scenario.id}' has the wrong family prefix`);
    for (const rule of scenario.rules || []) {
      if (!familyRuleIds[dir].has(rule))
        errors.push(`${at}: rule '${rule}' is not defined by the ${dir} family`);
      if (!synthesisRuleCoverage.has(rule)) synthesisRuleCoverage.set(rule, []);
      synthesisRuleCoverage.get(rule).push(scenario.id);
    }
    if (scenario.source.bindingSpec !== fam.bindingSpec)
      errors.push(`${at}: source bindingSpec '${scenario.source.bindingSpec}' is not '${fam.bindingSpec}'`);
    if (dir === "grpc") {
      if (fixture.format !== "openbindings.binding-spec-synthesis-scenarios@7")
        errors.push(`synthesis/grpc.json: gRPC requires synthesis-scenario format @7`);
      const hasContent = Object.hasOwn(scenario.source, "content");
      if (hasContent && scenario.discovery !== undefined)
        errors.push(`${at}: embedded gRPC content must suppress discovery`);
      if (!hasContent) {
        const discovery = scenario.discovery;
        if (!discovery) errors.push(`${at}: location-only gRPC synthesis requires a versioned reflection transcript`);
        else {
          errors.push(...grpcReflectionTranscriptViolations(discovery, `${at}.discovery`));
          if (scenario.expected.outcome === "synthesized") {
            const representedServices = [...new Set((scenario.expected.coverage?.entries || [])
              .filter((entry) => entry.scope === "target")
              .map((entry) => entry.sourceRef?.split("/")[0])
              .filter((service) => service && service !== "grpc.reflection.v1.ServerReflection" && service !== "grpc.reflection.v1alpha.ServerReflection"))].sort();
            const listedServices = (discovery.listedServices || [])
              .filter((service) => service !== "grpc.reflection.v1.ServerReflection" && service !== "grpc.reflection.v1alpha.ServerReflection");
            if (JSON.stringify(listedServices) !== JSON.stringify(representedServices))
              errors.push(`${at}.discovery: returned non-infrastructure service list differs from synthesized target coverage`);
          }
        }
      }
    }
    if (scenario.expected.outcome === "refused") {
      for (const rule of scenario.expected.rules) {
        if (!coreRules.has(rule) && !familyRuleIds[dir].has(rule))
          errors.push(`${at}: refusal rule '${rule}' is not defined by the core or the ${dir} family`);
      }
      continue;
    }
    if (!scenario.expected.coverage.exhaustive)
      errors.push(`${at}: portable synthesis evidence must claim an exhaustive inventory`);

    const operations = new Set(scenario.expected.operations);
    const bindings = new Set(
      scenario.expected.bindings.map((binding) => `${binding.operationKey}\0${binding.bindingSelector}`)
    );
    for (const binding of scenario.expected.bindings) {
      if (!operations.has(binding.operationKey))
        errors.push(`${at}: binding names undeclared operation '${binding.operationKey}'`);
    }
    for (const [entryIndex, entry] of scenario.expected.coverage.entries.entries()) {
      const entryAt = `${at}.expected.coverage.entries[${entryIndex}]`;
      if (dir.startsWith("openapi-") && Object.hasOwn(entry, "reasonCode"))
        errors.push(`${entryAt}: portable OpenAPI evidence cannot pin diagnostic reasonCode spelling`);
      if (entry.status === "represented") {
        if (
          entry.scope !== "dependency"
          && !bindings.has(`${entry.operationKey}\0${entry.bindingSelector}`)
        )
          errors.push(`${entryAt}: represented disposition has no expected binding identity`);
      } else if (
        entry.rule
        && !coreRules.has(entry.rule)
        && !familyRuleIds[dir].has(entry.rule)
      ) {
        errors.push(`${entryAt}: rule '${entry.rule}' is not defined by the core or the ${dir} family`);
      }
    }
    const derivedFull = scenario.expected.coverage.entries.every(
      (entry) => entry.status === "represented"
    );
    if (scenario.expected.coverage.fullyRepresented !== derivedFull)
      errors.push(`${at}: fullyRepresented does not match the declared dispositions`);
    if (dir === "grpc") {
      const entryKeys = scenario.expected.coverage.entries.map((entry) =>
        [entry.sourceIndex, entry.sourceRef, entry.scope, entry.operationKey || "", entry.bindingSelector || ""].join("\0")
      );
      const sortedEntryKeys = [...entryKeys].sort();
      if (entryKeys.some((key, index) => key !== sortedEntryKeys[index]))
        errors.push(`${at}: gRPC coverage entries are not in canonical order`);
      const representedBindings = new Set(
        scenario.expected.coverage.entries
          .filter((entry) => entry.status === "represented" && entry.scope === "target")
          .map((entry) => `${entry.operationKey}\0${entry.bindingSelector}`)
      );
      for (const binding of scenario.expected.bindings) {
        if (!representedBindings.has(`${binding.operationKey}\0${binding.bindingSelector}`))
          errors.push(`${at}: expected gRPC binding has no represented target coverage owner`);
      }
    }
  }
}

for (const dir of ["openapi-2.0", "openapi-3.0", "openapi-3.1", "openapi-3.2", "grpc"]) {
  const fam = FAMILIES[dir];
  for (const rule of familyRuleIds[dir]) {
    if (!rule.startsWith(`${fam.prefix}-S-`)) continue;
    if (!synthesisRuleCoverage.has(rule))
      errors.push(`Synthesizer rule ${rule} (${dir}) has no portable synthesis scenario citation`);
  }
}

let adjudicationCount = 0;
try {
  const adjudications = readJsonStrict(ADJUDICATIONS);
  const shape = ajvOk(ADJUDICATION_SCHEMA, adjudications);
  if (!shape.ok) {
    errors.push(`adjudications.json: does not match adjudication.schema.json\n${shape.out}`);
  } else {
    const ids = new Set();
    adjudicationCount = adjudications.records.length;
    for (const [index, record] of adjudications.records.entries()) {
      const at = `adjudications.json.records[${index}]`;
      if (ids.has(record.id)) errors.push(`${at}: duplicate id '${record.id}'`);
      ids.add(record.id);
      for (const scenario of record.scenarios) {
        if (!synthesisScenarioIds.has(scenario))
          errors.push(`${at}: scenario '${scenario}' is not present in the live synthesis corpus`);
      }
      const scenarioPrefixes = new Set(
        record.scenarios.map((scenario) => scenario.slice(0, scenario.indexOf("-SS-")))
      );
      for (const rule of record.authority.coreRules) {
        if (!coreRules.has(rule))
          errors.push(`${at}: core authority rule '${rule}' is not defined by the core`);
      }
      for (const rule of record.authority.bindingRules) {
        const prefix = rule.slice(0, rule.indexOf("-"));
        if (!allRuleIds.has(rule) || !scenarioPrefixes.has(prefix))
          errors.push(`${at}: binding authority rule '${rule}' is not defined by a scenario family`);
      }
    }
  }
} catch (e) {
  errors.push(`adjudications.json: failed to parse or validate: ${e.message}`);
}

let alignmentLedgerEntries = 0;
try {
  const ledger = readJsonStrict(ABSTRACTION_FIDELITY_LEDGER);
  const shape = ajvOk(ABSTRACTION_FIDELITY_SCHEMA, ledger);
  if (!shape.ok) {
    errors.push(`abstraction-fidelity/ledger.json: does not match ledger.schema.json\n${shape.out}`);
  } else {
    alignmentLedgerEntries = ledger.entries.length;
  }
} catch (e) {
  errors.push(`abstraction-fidelity/ledger.json: failed to parse or validate: ${e.message}`);
}

// --- Invocation-interface vocabulary containment -----------------------------
// A binding specification is a semantic authority consumable by ANY invocation
// surface; the project's invoker interfaces are one informative realization
// (binding-specs/README.md, "Authentication and credentials"). A binding-spec
// rule stated in the interfaces' vocabulary — its error-record members, its
// owned code spellings, its frame model — reads as a dependency on the project's
// tooling and gives a third-party implementer false grounds to think conformance
// requires our contracts. The discipline: state the operation-boundary fact
// abstractly (e.g. "admits application-authored failure data"), then scope any
// interface mention as one realization ("when the project's portable invocation
// interface is used, ..."). This check flags a paragraph that uses coupling
// vocabulary without a scoping marker.
{
  const couplingTokens = [
    [/\bERR_[A-Z][A-Z_]+\b/, "an interface-owned error-code spelling"],
    [/\bCONTEXT_REQUIRED\b|`context-required`/, "the context-negotiation code"],
    [/invocation error's|invocation error `data`|error `data` member|`data` member/, "the invocation error record's member"],
    [/\binvocation interface\b/, "the invocation interface"],
    [/\bbinding-invoker\b|\boperation-invoker\b/, "a project interface name"],
    [/\binvocation frames?\b|\bframe protocol\b/, "the interface frame model"],
  ];
  const scopingMarkers = [
    /informative/i,
    /portable invocation interface is used/,
    /under the project's portable invocation interface/,
    /that surface's contract/,
    /one such negotiation surface/,
    /\brealization\b/,
  ];
  const specPages = readdirSync(join(SPEC_ROOT, "binding-specs"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(SPEC_ROOT, "binding-specs", entry.name))
    .flatMap((dir) => readdirSync(dir).filter((f) => /^openbindings\..*\.md$/.test(f)).map((f) => join(dir, f)));
  for (const page of specPages) {
    const text = readFileSync(page, "utf8");
    let line = 1;
    for (const rawParagraph of text.split(/\n\s*\n/)) {
      const startLine = line;
      line += rawParagraph.split("\n").length + 1;
      // Hard-wrapped prose splits phrases across lines; match on the unwrapped text.
      const paragraph = rawParagraph.replace(/\s+/g, " ");
      const hit = couplingTokens.find(([token]) => token.test(paragraph));
      if (!hit) continue;
      if (scopingMarkers.some((marker) => marker.test(paragraph))) continue;
      errors.push(
        `${relative(SPEC_ROOT, page)}:${startLine}: paragraph uses ${hit[1]} without scoping it as an invocation-surface realization (state the binding-spec fact abstractly, then scope the interface mention)`
      );
    }
  }
}

// --- 11. The synthesis source shape still matches Core ----------------------
// Core requires a binding source to carry location or content. A constraint
// nothing exercises is not a constraint: every live scenario satisfies it, so
// the corpus alone cannot show the schema still carries it. These probes do —
// removing the `anyOf` turns the third one red.
{
  const synthesisSchema = readJsonStrict(SYNTHESIS_SCHEMA);
  const probeFile = (source) => ({
    format: "openbindings.binding-spec-synthesis-scenarios@5",
    bindingSpec: "openbindings.openapi-3.1@1",
    family: "openapi-3.1",
    description: "verifier probe; not part of the corpus",
    scenarios: [
      {
        id: "OAPI31-SS-99",
        description: "verifier probe; not part of the corpus",
        source,
        expected: { outcome: "refused", rules: ["OAPI31-P-01"] },
      },
    ],
  });
  const probes = [
    ["carrying `content`", { bindingSpec: "openbindings.openapi-3.1@1", content: {} }, true],
    [
      "carrying `location`",
      { bindingSpec: "openbindings.openapi-3.1@1", location: "https://example.com/a.yaml" },
      true,
    ],
    ["carrying neither `location` nor `content`", { bindingSpec: "openbindings.openapi-3.1@1" }, false],
  ];
  for (const [what, source, shouldValidate] of probes) {
    const probe = ajvOk(SYNTHESIS_SCHEMA, probeFile(source));
    if (probe.ok === shouldValidate) continue;
    errors.push(
      shouldValidate
        ? `synthesis-scenario.schema.json rejects a scenario source ${what}, which Core admits\n${probe.out}`
        : `synthesis-scenario.schema.json accepts a scenario source ${what}; Core requires location or content (restore the 'anyOf' on the source object)`
    );
  }
}

// --- 12. Revision-5 assertion syntax stays version-gated --------------------
// A new evaluator cannot leak into a revision-1 family merely because the
// assertion union knows its shape. This probe independently exercises the
// schema gate and the family-neutral verifier check.
{
  const legacySemanticAssertion = {
    format: "openbindings.binding-spec-processor-scenarios@1",
    bindingSpec: "openbindings.asyncapi@1",
    family: "asyncapi",
    description: "verifier probe; not part of the corpus",
    scenarios: [
      {
        id: "ASYNC-PS-99",
        rules: ["ASYNC-P-01"],
        section: "1",
        description: "verifier probe; not part of the corpus",
        given: {
          source: {},
          binding: {},
          invocation: { inputPresent: false },
        },
        expected: [
          {
            disposition: "complete",
            phase: "completion",
            assertions: [
              {
                path: "/dispatch/body",
                semanticEquals: { as: "json-lines", value: [] },
              },
            ],
          },
        ],
      },
    ],
  };
  const probe = ajvOk(PROCESSOR_SCHEMA, legacySemanticAssertion);
  if (probe.ok)
    errors.push(
      "processor-scenario.schema.json accepts semanticEquals under format @1; revision-5 assertion syntax must remain version-gated"
    );
  const manualViolations = semanticAssertionFormatViolations(
    legacySemanticAssertion,
    "processor-scenario verifier probe"
  );
  if (manualViolations.length !== 1)
    errors.push(
      `semanticEquals format verifier probe expected one violation under format @1; observed ${manualViolations.length}`
    );
}

// --- 10. The README's scenario counts are derived, not hand-maintained ------
// count-binding-spec-scenarios.mjs is the single derivation; this check makes
// the README's prose fail the build when it drifts from the corpus, which is
// how three stale numbers survived several corpus growths.
{
  const counts = countBindingSpecScenarios(SPEC_ROOT);

  // The verifier's own walk and the shared derivation must agree; otherwise a
  // number could be "asserted" against a second, silently different count.
  const crossChecks = [
    ["processor scenarios", counts.processor.scenarios, processorScenarios],
    ["distinct processor rules", counts.processor.coveredRules.length, processorRuleCoverage.size],
    ["synthesis scenarios", counts.synthesis.scenarios, synthesisScenarios],
  ];
  for (const [what, derived, walked] of crossChecks) {
    if (derived !== walked)
      errors.push(
        `count-binding-spec-scenarios.mjs counts ${derived} ${what}; this verifier's own walk counts ${walked}`
      );
  }

  // The README is hard-wrapped, so match against the unwrapped text.
  const prose = readme.replace(/\s+/g, " ");
  const stated = [
    {
      what: "portable processor scenarios",
      pattern: /The current corpus contains (\d+) scenarios/,
      shape: "The current corpus contains <N> scenarios",
      actual: counts.processor.scenarios,
    },
    {
      what: "distinct P-rules the processor scenarios cover",
      pattern: /\((\d+) distinct rules\)/,
      shape: "(<N> distinct rules)",
      actual: counts.processor.coveredRules.length,
    },
    {
      what: "portable synthesis scenarios",
      pattern: /The (\d+) scenarios exercise all ten standalone brownfield synthesis specifications/,
      shape: "The <N> scenarios exercise all ten standalone brownfield synthesis specifications",
      actual: counts.synthesis.scenarios,
    },
  ];
  for (const { what, pattern, shape, actual } of stated) {
    const found = prose.match(pattern);
    if (!found) {
      errors.push(
        `conformance/binding-specs/README.md: no sentence of the form "${shape}" states the ${what}; the verifier asserts that count and needs the sentence to stay matchable`
      );
      continue;
    }
    if (Number(found[1]) !== actual)
      errors.push(
        `conformance/binding-specs/README.md states ${found[1]} ${what}; the corpus holds ${actual} (run: node scripts/count-binding-spec-scenarios.mjs)`
      );
  }
}

console.log(`Family D-rules defined across ten brownfield synthesis specs: ${definedDRules.size}`);
console.log(`Fixture files: ${files}`);
console.log(`Rules covered by fixtures: ${fixtureRules.size}`);
console.log(`Rules deferred per README: ${deferred.size}`);
console.log(
  `Tests: ${tests} (${positives} positive, ${negatives} negative)`
);
console.log(
  `Portable processor scenarios: ${processorScenarios} in ${processorFiles} files, citing ${processorRuleCoverage.size}/${processorPRules.size} distinct targeted P-rules`
);
console.log(`gRPC boundary mutants: ${grpcBoundaryMutants}`);
console.log(`Invocation-fidelity scenarios: ${fidelityScenarios} across ${fidelityTargets.length} active family slice(s)`);
console.log(
  `Portable synthesis scenarios: ${synthesisScenarios} in ${synthesisFiles} files, covering ${synthesisFiles}/${processorTargets.length} standalone brownfield synthesis specifications`
);
console.log(`Conformance adjudications: ${adjudicationCount}`);
console.log(`Abstraction-fidelity ledger entries: ${alignmentLedgerEntries}`);

if (errors.length) {
  console.log(`\nErrors (${errors.length}):`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log("\nOK");
