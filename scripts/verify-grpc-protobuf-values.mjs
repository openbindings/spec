#!/usr/bin/env node

import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { verifyOracleBridge } from "./verify-grpc-protobuf-oracle-bridge.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS = join(ROOT, "conformance", "binding-specs", "grpc-fixtures", "protobuf", "value-cases.json");
const GO_DIR = join(ROOT, "conformance", "binding-specs", "grpc-runners", "go");
const TS_DIR = join(ROOT, "conformance", "binding-specs", "grpc-runners", "typescript");
const PROTOC_ROOT = process.env.OPENBINDINGS_PROTOC_36_1_ROOT || "/private/tmp/protoc-36.1";

function execute(runtime, corpus, expectSuccess = true) {
  const command = runtime === "go" ? "go" : "node";
  const args = runtime === "go" ? ["run", "protobuf.go", "protojson_strict.go", corpus, PROTOC_ROOT] : ["protobuf.mjs", corpus];
  const cwd = runtime === "go" ? GO_DIR : TS_DIR;
  const result = spawnSync(command, args, { cwd, encoding:"utf8", env:{...process.env,GOCACHE:"/private/tmp/openbindings-grpc-go-build-cache"} });
  if ((result.status === 0) !== expectSuccess) {
    process.stderr.write(result.stdout || ""); process.stderr.write(result.stderr || "");
    throw new Error(`${runtime} protobuf value adapter unexpectedly ${result.status === 0 ? "accepted" : "rejected"} ${corpus}`);
  }
  return result.status === 0 ? JSON.parse(result.stdout) : null;
}

const go = execute("go", CORPUS);
const typescript = execute("typescript", CORPUS);
const stripRuntime = ({runtime, ...value}) => value;
if (!isDeepStrictEqual(stripRuntime(go), stripRuntime(typescript))) throw new Error("Go/TypeScript protobuf value results differ");
if (go.caseCount !== 188 || go.results.length !== 188) throw new Error(`expected 188 protobuf value cases, observed ${go.caseCount}`);

const source = JSON.parse(readFileSync(CORPUS,"utf8"));
const mutations = [
  ...["input-value-binary64-max", "input-value-positive-overflow", "input-value-negative-overflow", "input-value-recursive-overflow", "input-struct-overflow", "input-listvalue-overflow", "input-any-value-overflow"].map((id) => [id, (value) => { const test = value.cases.find((entry) => entry.id === id); test.accepted = !test.accepted; }]),
  ["edition-integral-number", (value) => { value.cases.find((test) => test.id === "input-edition-enum-integral-number").accepted = false; }],
  ["edition-original-name", (value) => { value.cases.find((test) => test.id === "input-edition-enum-original-name").canonicalJson = "{}"; }],
  ["edition-alias-duplicate", (value) => { value.cases.find((test) => test.id === "input-edition-enum-alias-duplicate").accepted = true; }],
  ["edition-null-unset", (value) => { value.cases.find((test) => test.id === "input-edition-enum-null-unset").canonicalJson = '{"state":"ready-value"}'; }],
  ["unknown-member", (value) => { value.cases.find((test) => test.id === "input-original-name").valueJson = "{\"unknown\":1}"; }],
  ["explicit-json-name-default-camel", (value) => { value.cases.find((test) => test.id === "input-explicit-json-name-default-camel-refused").accepted = true; }],
  ["wrong-binary-equivalence", (value) => { value.cases.find((test) => test.id === "wire-equivalent-packed").rightBase64 = "CAE="; }],
  ["gutted-schema-facts", (value) => { value.cases.find((test) => test.id === "schema-node-output").requiredFacts = ["closed-object"]; }],
  ["flipped-verdict", (value) => { value.cases.find((test) => test.id === "input-int64-overflow").accepted = true; }],
  ["civil-date-normalization", (value) => { value.cases.find((test) => test.id === "input-timestamp-february-30").accepted = true; }],
  ["quoted-float-coercion", (value) => { value.cases.find((test) => test.id === "input-float-hex-string").accepted = true; }],
  ["field-mask-underscore", (value) => { value.cases.find((test) => test.id === "input-field-mask-underscore").accepted = true; }],
  ["any-url-final-component", (value) => { value.cases.find((test) => test.id === "input-any-missing-slash").accepted = true; }],
  ["decoded-duration-invariant", (value) => { value.cases.find((test) => test.id === "wire-duration-sign-mismatch").accepted = true; }],
  ["empty-bytes", (value) => { value.cases.find((test) => test.id === "input-bytes-empty").accepted = false; }],
  ["negative-zero", (value) => { value.cases.find((test) => test.id === "input-double-negative-zero").canonicalJson = "{\"precise\":0}"; }],
  ["float32-underflow", (value) => { value.cases.find((test) => test.id === "input-float32-underflow").canonicalJson = "{\"ratio\":1e-50}"; }],
  ["float32-min-rounding", (value) => { value.cases.find((test) => test.id === "input-float32-min-subnormal").canonicalJson = "{\"ratio\":1.40129846e-45}"; }],
  ["float32-max-rounding", (value) => { value.cases.find((test) => test.id === "input-float32-max-round").canonicalJson = "{\"ratio\":3.4028234663852886e+38}"; }],
  ["map-leading-zero", (value) => { value.cases.find((test) => test.id === "input-map-int-leading-zero").canonicalJson = "{\"ints\":{\"01\":\"x\"}}"; }],
  ["map-bool-spelling", (value) => { value.cases.find((test) => test.id === "input-map-bool-uppercase").accepted = true; }],
  ["map-key-kind", (value) => { value.cases.find((test) => test.id === "input-map-int-nonnumeric").accepted = true; }],
  ["map-key-range", (value) => { value.cases.find((test) => test.id === "input-map-int-range").accepted = true; }],
  ["map-key-normalized-collision", (value) => { value.cases.find((test) => test.id === "input-map-normalized-collision").canonicalJson = "{\"ints\":{\"1\":\"a\"}}"; }],
  ["json-nbsp", (value) => { value.cases.find((test) => test.id === "input-nbsp-whitespace").accepted = true; }],
  ["json-line-separator", (value) => { value.cases.find((test) => test.id === "input-line-separator-whitespace").accepted = true; }],
  ["lone-surrogate-value", (value) => { value.cases.find((test) => test.id === "input-lone-surrogate-value").accepted = true; }],
  ["lone-surrogate-key", (value) => { value.cases.find((test) => test.id === "input-lone-surrogate-key").accepted = true; }],
  ["direct-nullvalue", (value) => { value.cases.find((test) => test.id === "input-direct-nullvalue").accepted = false; }],
  ["value-nan-output", (value) => { value.cases.find((test) => test.id === "wire-value-nan").accepted = true; }],
  ["value-positive-infinity-output", (value) => { value.cases.find((test) => test.id === "wire-value-positive-infinity").accepted = true; }],
  ["value-negative-infinity-output", (value) => { value.cases.find((test) => test.id === "wire-value-negative-infinity").accepted = true; }]
  ,["ordinary-null-before-oneof", (value) => { value.cases.find((test) => test.id === "input-oneof-all-null").accepted = false; }]
  ,["field-mask-leading-uppercase", (value) => { value.cases.find((test) => test.id === "input-field-mask-leading-uppercase").accepted = false; }]
  ,["empty-any", (value) => { value.cases.find((test) => test.id === "input-any-empty").accepted = false; }]
  ,["empty-message-any", (value) => { value.cases.find((test) => test.id === "input-any-empty-message").accepted = false; }]
  ,["empty-message-any-value", (value) => { value.cases.find((test) => test.id === "input-any-empty-message-value").accepted = true; }]
  ,["wrapper-null-any", (value) => { value.cases.find((test) => test.id === "input-any-wrapper-null").accepted = false; }]
  ,["float32-rounded-boundary", (value) => { value.cases.find((test) => test.id === "input-float32-rounded-max").accepted = false; }]
  ,["float32-next-overflow", (value) => { value.cases.find((test) => test.id === "input-float32-next-overflow").accepted = true; }]
  ,["float32-negative-zero", (value) => { value.cases.find((test) => test.id === "input-float32-negative-zero").canonicalJson = "{\"ratio\":0}"; }]
  ,["signed-map-plus", (value) => { value.cases.find((test) => test.id === "input-map-signed-plus").accepted = true; }]
  ,["unsigned-map-plus", (value) => { value.cases.find((test) => test.id === "input-map-unsigned-plus").accepted = true; }]
  ,["signed-map-negative-zero", (value) => { value.cases.find((test) => test.id === "input-map-signed-negative-zero").accepted = true; }]
  ,["unsigned-map-negative-zero", (value) => { value.cases.find((test) => test.id === "input-map-unsigned-negative-zero").accepted = true; }]
  ,["signed-map-bounds", (value) => { value.cases.find((test) => test.id === "input-map-signed-bounds").accepted = false; }]
  ,["unsigned-map-max", (value) => { value.cases.find((test) => test.id === "input-map-unsigned-max").accepted = false; }]
  ,["plus-map-collision", (value) => { value.cases.find((test) => test.id === "input-map-plus-collision").canonicalJson = "{\"ints\":{\"1\":\"a\"}}"; }]
  ,["rfc-json-whitespace", (value) => { value.cases.find((test) => test.id === "input-rfc-json-whitespace").accepted = false; }]
  ,["paired-surrogate", (value) => { value.cases.find((test) => test.id === "input-paired-surrogate").accepted = false; }]
  ,["direct-wrapper-null", (value) => { value.cases.find((test) => test.id === "input-direct-wrapper-null").accepted = false; }]
  ,["empty-message", (value) => { value.cases.find((test) => test.id === "input-empty-message").accepted = false; }]
  ,["empty-wire-message", (value) => { value.cases.find((test) => test.id === "wire-empty-default-message").accepted = false; }]
  ,["empty-wire-any", (value) => { value.cases.find((test) => test.id === "wire-empty-any").accepted = false; }]
  ,["unset-value-output", (value) => { value.cases.find((test) => test.id === "wire-value-unset-kind").accepted = true; }]
  ,["composed-trailing-json", (value) => { value.cases.find((test) => test.id === "input-composed-trailing-json").accepted = true; }]
  ,["composed-duplicate-json", (value) => { value.cases.find((test) => test.id === "input-composed-duplicate-json").accepted = true; }]
  ,["composed-surrogate-json", (value) => { value.cases.find((test) => test.id === "input-composed-surrogate-json").accepted = true; }]
  ,["composed-nbsp-json", (value) => { value.cases.find((test) => test.id === "input-composed-nbsp-json").accepted = true; }]
  ,["alias-null-duplicate", (value) => { value.cases.find((test) => test.id === "input-alias-null-duplicate").accepted = true; }]
  ,["oneof-null-presence", (value) => { value.cases.find((test) => test.id === "input-oneof-null-then-present").accepted = false; }]
  ,["singular-wrapper-null", (value) => { value.cases.find((test) => test.id === "input-singular-wrapper-null").accepted = false; }]
  ,["repeated-wrapper-null", (value) => { value.cases.find((test) => test.id === "input-repeated-wrapper-null").accepted = true; }]
  ,["map-wrapper-null", (value) => { value.cases.find((test) => test.id === "input-map-wrapper-null").accepted = true; }]
  ,["duration-leading-plus", (value) => { value.cases.find((test) => test.id === "input-duration-leading-plus").accepted = true; }]
  ,["duration-leading-fraction", (value) => { value.cases.find((test) => test.id === "input-duration-leading-fraction").accepted = true; }]
  ,["duration-empty-fraction", (value) => { value.cases.find((test) => test.id === "input-duration-empty-fraction").accepted = true; }]
  ,["duration-negative-leading-fraction", (value) => { value.cases.find((test) => test.id === "input-duration-negative-leading-fraction").accepted = true; }]
  ,["digit-looking-long-hash", (value) => { value.cases.find((test) => test.id === "wire-map-uint64-digit-hash").canonicalJson = "{\"uints\":{\"12345678\":\"x\"}}"; }]
  ,["mixed-base64-standard-url", (value) => { value.cases.find((test) => test.id === "input-bytes-mixed-standard-url").accepted = true; }]
  ,["mixed-base64-url-standard", (value) => { value.cases.find((test) => test.id === "input-bytes-mixed-url-standard").accepted = true; }]
  ,["wrapper-field-null-presence", (value) => { value.cases.find((test) => test.id === "input-singular-wrapper-null").canonicalJson = "{\"singular\":\"\"}"; }]
  ,["wrapper-oneof-null-presence", (value) => { value.cases.find((test) => test.id === "input-oneof-wrapper-null").canonicalJson = "{\"wrapped\":\"\"}"; }]
  ,["value-oneof-null-skip", (value) => { value.cases.find((test) => test.id === "input-oneof-value-null").canonicalJson = "{}"; }]
  ,["quoted-enum-number", (value) => { value.cases.find((test) => test.id === "input-open-enum-quoted-number").accepted = true; }]
  ,["closed-enum-singular", (value) => { value.cases.find((test) => test.id === "wire-closed-proto2-enum-unknown-singular").accepted = false; }]
  ,["closed-enum-unknown-material", (value) => { value.cases.find((test) => test.id === "wire-closed-proto2-enum-unknown-distinct").accepted = true; }]
  ,["closed-enum-expanded", (value) => { value.cases.find((test) => test.id === "wire-closed-proto2-enum-unknown-expanded").accepted = false; }]
  ,["closed-enum-packed", (value) => { value.cases.find((test) => test.id === "wire-closed-proto2-enum-unknown-packed").accepted = false; }]
  ,["proto-own-key", (value) => { value.cases.find((test) => test.id === "input-proto-key").accepted = false; }]
  ,["proto-unknown-key", (value) => { value.cases.find((test) => test.id === "input-proto-key-unknown").accepted = true; }]
  ,["proto2-recursive-utf8", (value) => { value.cases.find((test) => test.id === "wire-proto2-string-invalid-any").accepted = true; }]
  ,["proto2-overwritten-utf8", (value) => { value.cases.find((test) => test.id === "wire-proto2-string-invalid-overwritten-singular").accepted = false; }]
  ,["proto2-map-overwrite", (value) => { value.cases.find((test) => test.id === "wire-proto2-string-invalid-overwritten-map").accepted = false; }]
  ,["closed-enum-map", (value) => { value.cases.find((test) => test.id === "wire-closed-proto2-enum-unknown-map").accepted = false; }]
  ,["closed-enum-oneof", (value) => { value.cases.find((test) => test.id === "wire-closed-proto2-enum-unknown-oneof").canonicalJson = "{}"; }]
  ,["enum-simple-atoi", (value) => { value.cases.find((test) => test.id === "input-open-enum-simple-atoi").accepted = true; }]
  ,["enum-exponent-refusal", (value) => { value.cases.find((test) => test.id === "input-open-enum-quoted-exponent").accepted = true; }]
  ,["base64-nonzero-pad-bits", (value) => { value.cases.find((test) => test.id === "input-bytes-nonzero-pad-bits").accepted = true; }]
  ,["json-bom", (value) => { value.cases.find((test) => test.id === "input-json-bom").accepted = true; }]
  ,["field-spelling-collision", (value) => { value.cases.find((test) => test.id === "input-ambiguous-effective-original").accepted = true; }]
  ,["varint-overflow", (value) => { value.cases.find((test) => test.id === "wire-varint-overflow-tag").accepted = true; }]
  ,["varint-overflow-nested", (value) => { value.cases.find((test) => test.id === "wire-varint-overflow-nested").accepted = true; }]
  ,["varint-overflow-any", (value) => { value.cases.find((test) => test.id === "wire-varint-overflow-any").accepted = true; }]
  ,["oracle-closed-map-default", (value) => { value.cases.find((test) => test.id === "oracle-closed-map-missing-value").canonicalJson = "{}"; }]
  ,["oracle-closed-map-effective-last-value", (value) => { value.cases.find((test) => test.id === "oracle-closed-map-known-then-unknown-value").canonicalJson = "{\"sintMap\":{\"-1\":\"MAP_FIRST\"}}"; }]
  ,["oracle-closed-map-duplicate-entry", (value) => { value.cases.find((test) => test.id === "oracle-closed-map-duplicate-entry").canonicalJson = "{\"sintMap\":{\"-1\":\"MAP_FIRST\"}}"; }]
  ,["oracle-fixed-map-wire-kind", (value) => { value.cases.find((test) => test.id === "oracle-fixed-map-key").canonicalJson = "{\"fixedMap\":{\"0\":\"MAP_FIRST\"}}"; }]
  ,["oracle-bool-map-nonzero", (value) => { value.cases.find((test) => test.id === "oracle-bool-map-nonzero-key").canonicalJson = "{\"boolMap\":{\"false\":\"MAP_SECOND\"}}"; }]
  ,["oracle-message-map-merge", (value) => { value.cases.find((test) => test.id === "oracle-message-map-value-merge").canonicalJson = "{\"messageMap\":{\"a\":{\"left\":1}}}"; }]
  ,["oracle-enum-tenth-octet-two", (value) => { value.cases.find((test) => test.id === "oracle-enum-varint-tenth-byte-two").accepted = false; }]
  ,["oracle-surviving-proto2-utf8", (value) => { value.cases.find((test) => test.id === "oracle-proto2-string-invalid-then-valid").accepted = false; }]
  ,["oracle-retained-invalid-proto2-utf8", (value) => { value.cases.find((test) => test.id === "oracle-proto2-string-valid-then-invalid").accepted = true; }]
];
const temp = mkdtempSync(join(tmpdir(),"openbindings-protobuf-values-"));
try {
  for (const name of [source.source, "value-closed.proto", ...source.editionSources]) {
    copyFileSync(join(dirname(CORPUS), name), join(temp, name));
  }
  for (const [name, mutate] of mutations) {
    const value = structuredClone(source); mutate(value);
    const path = join(temp,`${name}.json`); writeFileSync(path,`${JSON.stringify(value,null,2)}\n`);
    execute("go",path,false); execute("typescript",path,false);
  }

  const replacement = structuredClone(source);
  replacement.cases = [{id:"outer-invalid-utf8",kind:"input",type:"demo.Node",valueJson:'{"customName":"�"}',accepted:true,canonicalJson:'{"customName":"�"}'}];
  const replacementBytes = Buffer.from(`${JSON.stringify(replacement)}\n`);
  const marker = Buffer.from("�");
  const markerAt = replacementBytes.indexOf(marker);
  if (markerAt < 0) throw new Error("invalid UTF-8 metamutant marker missing");
  const invalidBytes = Buffer.concat([replacementBytes.subarray(0,markerAt),Buffer.from([0xff]),replacementBytes.subarray(markerAt+marker.length)]);
  const invalidPath = join(temp,"outer-invalid-utf8.json"); writeFileSync(invalidPath,invalidBytes);
  execute("go",invalidPath,false); execute("typescript",invalidPath,false);
  const duplicateOuter = readFileSync(CORPUS,"utf8").replace(/^\{/,`{"format":"${source.format}",`);
  const duplicateOuterPath = join(temp,"outer-duplicate.json"); writeFileSync(duplicateOuterPath,duplicateOuter);
  execute("go",duplicateOuterPath,false); execute("typescript",duplicateOuterPath,false);

  const floatBits = new Set([0, 0x80000000, 1, 0x80000001, 0x007fffff, 0x00800000, 0x7f7fffff, 0xff7fffff,
    0x7f800000, 0xff800000, 0x7fc00000, 0xca2c95d5, 0x49fbaa12]);
  let state = 0x6d2b79f5;
  for (let index = 0; index < 512; index++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    floatBits.add(state);
  }
  const grid = structuredClone(source);
  for (const bits of floatBits) {
    const wire = Buffer.alloc(6);
    wire[0] = 0xa5; wire[1] = 0x01; wire.writeUInt32LE(bits, 2);
    grid.cases.push({id:`float32-grid-${bits.toString(16).padStart(8,"0")}`,kind:"binary",type:"demo.Node",dataBase64:wire.toString("base64"),accepted:true});
  }
  const gridPath = join(temp,"float32-grid.json");
  writeFileSync(gridPath,`${JSON.stringify(grid,null,2)}\n`);
  const gridGo = execute("go",gridPath), gridTs = execute("typescript",gridPath);
  if (!isDeepStrictEqual(stripRuntime(gridGo),stripRuntime(gridTs))) throw new Error("Go/TypeScript deterministic float32 bit grid differs");
  if (gridGo.caseCount !== 188 + floatBits.size) throw new Error(`float32 grid size drift: ${gridGo.caseCount}`);
  const expected = new Map([["float32-grid-ca2c95d5","{\"ratio\":-2827637.2}"],["float32-grid-49fbaa12","{\"ratio\":2061634.2}"]]);
  for (const [id, canonicalJson] of expected) {
    const result = gridGo.results.find((entry)=>entry.id===id);
    if (result?.canonicalJson !== canonicalJson) throw new Error(`${id} shortest-decimal lock drift: ${result?.canonicalJson}`);
  }
} finally { rmSync(temp,{recursive:true,force:true}); }

const oracleBridge = await verifyOracleBridge(execute, PROTOC_ROOT);
console.log(`gRPC Protobuf Go/TypeScript value correspondence: ${JSON.stringify({ ...stripRuntime(go), oracleBridge })}`);
