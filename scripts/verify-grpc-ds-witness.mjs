#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GO_DIR = join(ROOT, "conformance", "binding-specs", "grpc-runners", "go");
const TS_DIR = join(ROOT, "conformance", "binding-specs", "grpc-runners", "typescript");
const PROTOC_ROOT = process.env.OPENBINDINGS_PROTOC_36_1_ROOT || "/private/tmp/protoc-36.1";
const MUTANTS = [
  "flipped-d-validity",
  "single-quote-import-bypass",
  "ghost-method",
  "missing-method",
  "ghost-binding",
  "missing-binding",
  "illegal-schema-key",
  "open-schema-object",
  "unbounded-int64-string",
  "noncanonical-base64-schema",
  "admit-integer-map-alias-schema",
  "admit-quoted-int32-schema",
  "admit-json-int64-schema",
  "admit-quoted-enum-schema",
  "admit-third-field-alias-schema",
  "admit-noncanonical-wkt-schema",
  "open-unicode-string-schema",
  "nullable-wrapper-container-schema",
  "nullable-wrapper-output-schema",
  "unbounded-value-number-schema",
  "reject-value-null-schema",
  "empty-any-typeurl-prefix",
  "admit-any-envelope-collision",
  "admit-cross-field-json-collision",
  "open-proto2-closed-enum-output",
  "open-editions-closed-enum-output",
  "wrong-coverage-owner",
  "wrong-coverage-status"
];

function execute(runtime, mutant = "", expectSuccess = true) {
  const command = runtime === "go" ? "go" : "node";
  const arguments_ = runtime === "go"
    ? ["run", "ds_witness.go", ROOT, PROTOC_ROOT]
    : ["ds-witness.mjs", ROOT, PROTOC_ROOT];
  if (mutant) arguments_.push(mutant);
  const completed = spawnSync(command, arguments_, {
    cwd: runtime === "go" ? GO_DIR : TS_DIR,
    encoding: "utf8",
    env: { ...process.env, GOCACHE: "/private/tmp/openbindings-grpc-go-build-cache" }
  });
  if ((completed.status === 0) !== expectSuccess) {
    process.stderr.write(completed.stdout || "");
    process.stderr.write(completed.stderr || "");
    throw new Error(`${runtime} D/S witness unexpectedly ${completed.status === 0 ? "accepted" : "rejected"}${mutant ? ` mutant ${mutant}` : " the corpus"}`);
  }
  if (!expectSuccess) return;
  try { return JSON.parse(completed.stdout); }
  catch (error) { throw new Error(`${runtime} D/S witness emitted invalid JSON: ${error.message}`); }
}

const go = execute("go");
const typescript = execute("typescript");
if (!isDeepStrictEqual(go, typescript)) {
  throw new Error(`Go/TypeScript D/S summaries differ\nGo: ${JSON.stringify(go)}\nTypeScript: ${JSON.stringify(typescript)}`);
}
if (go.format !== "openbindings.grpc-ds-witness-result@1") throw new Error(`unexpected witness format ${go.format}`);
if (go.dFiles < 1 || go.dTests < 1 || go.synthesisScenarios < 1) throw new Error("D/S witness did not execute both corpora");
if (go.operations !== go.bindings) throw new Error("D/S summary operation/binding counts differ");

for (const mutant of MUTANTS) {
  execute("go", mutant, false);
  execute("typescript", mutant, false);
}

console.log(`gRPC D/S Go/TypeScript witness: ${JSON.stringify({ ...go, rejectedMutants: MUTANTS.length })}`);
