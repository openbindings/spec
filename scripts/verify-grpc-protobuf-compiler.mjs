#!/usr/bin/env node

import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS = join(ROOT, "conformance", "binding-specs", "grpc-fixtures", "protobuf", "compiler-cases.json");
const PROTOC_ROOT = process.env.OPENBINDINGS_PROTOC_36_1_ROOT || "/private/tmp/protoc-36.1";
const PROTOC = join(PROTOC_ROOT, "bin", "protoc");
const INCLUDE = join(PROTOC_ROOT, "include");
const EXPECTED_BINARY_SHA256 = "dbd9a127dbbadd379bbea9a28a4349a0c9b1ad34b4c06f03fbe0f3853583a014";
const ALLOWED_IMPORTS = new Set([
  "google/protobuf/any.proto", "google/protobuf/api.proto", "google/protobuf/descriptor.proto",
  "google/protobuf/duration.proto", "google/protobuf/empty.proto", "google/protobuf/field_mask.proto",
  "google/protobuf/json_enumvalue_options.proto", "google/protobuf/json_options.proto",
  "google/protobuf/source_context.proto", "google/protobuf/struct.proto", "google/protobuf/timestamp.proto",
  "google/protobuf/type.proto", "google/protobuf/wrappers.proto",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function run(args, input) {
  return spawnSync(PROTOC, args, { encoding: input === undefined ? "utf8" : undefined, input });
}

const binary = readFileSync(PROTOC);
if (sha256(binary) !== EXPECTED_BINARY_SHA256) throw new Error(`protoc executable digest differs from the pinned macOS aarch64 witness`);
const version = run(["--version"]);
if (version.status !== 0 || version.stdout.trim() !== "libprotoc 36.1") throw new Error(`expected libprotoc 36.1, observed ${(version.stdout || version.stderr).trim()}`);

const corpusBytes = readFileSync(CORPUS);
const corpus = JSON.parse(corpusBytes);
if (corpus.format !== "openbindings.protobuf-compiler-cases@1" || !Array.isArray(corpus.cases)) throw new Error("unsupported compiler corpus");
const ids = new Set();
const temp = mkdtempSync(join(tmpdir(), "openbindings-protoc-36.1-"));
let accepted = 0;
let refused = 0;
try {
  // The compiler never sees the bundled include tree directly.  Materialize
  // only the closed import profile so alternate quote spellings, comments,
  // or parser evolution cannot bypass a source-text import scanner.
  for (const dependency of ALLOWED_IMPORTS) {
    const destination = join(temp, dependency);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(INCLUDE, dependency), destination);
  }
  for (const test of corpus.cases) {
    if (ids.has(test.id)) throw new Error(`duplicate case id ${test.id}`);
    ids.add(test.id);
    const sourcePath = join(temp, "source.proto");
    const descriptorPath = join(temp, "descriptor.pb");
    writeFileSync(sourcePath, test.source);
    const compile = run([`--proto_path=${temp}`, "--include_imports", `--descriptor_set_out=${descriptorPath}`, sourcePath]);
    let actual = compile.status === 0;
    let decoded = "";
    if (actual) {
      const descriptor = readFileSync(descriptorPath);
      const decode = run([`--proto_path=${temp}`, "--decode=google.protobuf.FileDescriptorSet", "google/protobuf/descriptor.proto"], descriptor);
      if (decode.status !== 0 || !decode.stdout.length) throw new Error(`${test.id}: emitted FileDescriptorSet did not decode completely`);
      decoded = decode.stdout.toString("utf8");
      const dependencies = [...decoded.matchAll(/^  dependency: "([^"]+)"$/gm)].map((match) => match[1]);
      if (dependencies.some((name) => !ALLOWED_IMPORTS.has(name))) actual = false;
      if (/\btype: TYPE_GROUP\b/.test(decoded) || /\bmessage_set_wire_format: true\b/.test(decoded)) actual = false;
    }
    if (actual !== test.accepted) throw new Error(`${test.id}: expected accepted=${test.accepted}; protoc=${compile.status}; descriptorProfile=${actual}\n${compile.stderr}\n${decoded}`);
    if (actual) {
      accepted++;
    } else refused++;
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log(JSON.stringify({
  accepted,
  corpusSha256: sha256(corpusBytes),
  format: "openbindings.protobuf-compiler-result@1",
  protocSha256: EXPECTED_BINARY_SHA256,
  refused,
  total: corpus.cases.length,
}));
