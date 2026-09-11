#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ORACLE = join(ROOT, "conformance", "binding-specs", "grpc-fixtures", "protobuf", "oracle");
const MANIFEST_PATH = join(ORACLE, "oracle-manifest.json");
const CASES_PATH = join(ORACLE, "oracle-cases.json");
const RESULTS_PATH = join(ORACLE, "oracle-results.json");
const PROTOC_ROOT = process.env.OPENBINDINGS_PROTOC_36_1_ROOT || "/private/tmp/protoc-36.1";
const PROTOC = join(PROTOC_ROOT, "bin", "protoc");
const ZERO_SHA256 = "0".repeat(64);
const ORACLE_ENV = { ...process.env, LANG: "C", LC_ALL: "C" };

function fail(message) {
  throw new Error(message);
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

function canonicalJsonText(value) {
  return `${JSON.stringify(canonicalJson(value), null, 2)}\n`;
}

function readCanonicalJson(path, label) {
  const bytes = readFileSync(path);
  let value;
  try {
    value = JSON.parse(bytes);
  } catch (error) {
    fail(`${label} is not JSON: ${error.message}`);
  }
  if (canonicalJsonText(value) !== bytes.toString("utf8")) fail(`${label} is not canonical JSON`);
  return { bytes, value };
}

function assertKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${label} keys differ: ${actual.join(", ")}`);
}

function filesUnder(root) {
  const files = [];
  function visit(directory) {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) fail(`oracle closure contains a symlink: ${relative(ORACLE, path)}`);
      if (stat.isDirectory()) visit(path);
      else if (stat.isFile()) files.push(path);
      else fail(`oracle closure contains a non-file: ${relative(ORACLE, path)}`);
    }
  }
  visit(root);
  return files;
}

function records(paths) {
  return paths.map((path) => ({
    path: relative(ORACLE, path).split("\\").join("/"),
    sha256: sha256(readFileSync(path)),
  })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

function recordRoot(fileRecords) {
  return sha256(Buffer.from(fileRecords.map(({ path, sha256: digest }) => `${path}\0${digest}\n`).sort().join("")));
}

function canonicalBase64(value, label) {
  if (typeof value !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    fail(`${label} must be canonical padded standard Base64`);
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) fail(`${label} has nonzero padding bits`);
  return bytes;
}

if (!existsSync(PROTOC)) fail(`pinned protoc is absent at ${PROTOC}`);
const { bytes: manifestBytes, value: manifest } = readCanonicalJson(MANIFEST_PATH, "oracle-manifest.json");
const { bytes: caseBytes, value: cases } = readCanonicalJson(CASES_PATH, "oracle-cases.json");
const { bytes: resultBytes, value: observations } = readCanonicalJson(RESULTS_PATH, "oracle-results.json");

assertKeys(manifest, [
  "format", "authorityCommit", "protocVersion", "protocArchiveSha256", "protocBinarySha256",
  "manifestSha256", "sourceRootSha256", "caseRootSha256", "resultRootSha256", "files",
  "caseCount", "accepted", "refused",
], "oracle manifest");
if (manifest.format !== "openbindings.protobuf-oracle-manifest@1") fail("unsupported oracle manifest format");
if (manifest.authorityCommit !== "f377bfefc5e2cfab68b816903c25b23e091c439d") fail("oracle authority commit differs from Protobuf 36.1");
if (manifest.protocVersion !== "libprotoc 36.1") fail("oracle protoc version differs from 36.1");
if (manifest.protocArchiveSha256 !== "de56d57afe30c5d191b11d24ff93dd4025728d7fb43b773886b2d3613e0bdbb2") fail("oracle protoc archive digest differs from the authority pin");
if (manifest.protocBinarySha256 !== "dbd9a127dbbadd379bbea9a28a4349a0c9b1ad34b4c06f03fbe0f3853583a014") fail("oracle protoc binary digest differs from the executable pin");
if (!Array.isArray(manifest.files)) fail("oracle manifest files must be an array");

const normalizedManifest = structuredClone(manifest);
normalizedManifest.manifestSha256 = ZERO_SHA256;
const manifestSha256 = sha256(Buffer.from(canonicalJsonText(normalizedManifest)));
if (manifest.manifestSha256 !== manifestSha256) fail("oracle manifest self-seal differs from canonical normalized bytes");
if (sha256(readFileSync(PROTOC)) !== manifest.protocBinarySha256) fail("installed protoc binary digest differs from oracle manifest");
const version = spawnSync(PROTOC, ["--version"], { encoding: "utf8", env: ORACLE_ENV });
if (version.status !== 0 || version.stdout.trim() !== manifest.protocVersion) fail(`installed protoc version differs: ${(version.stdout || version.stderr).trim()}`);

const allFiles = filesUnder(ORACLE);
const sourcePaths = allFiles.filter((path) => path.endsWith(".proto"));
const allowedPaths = new Set([MANIFEST_PATH, CASES_PATH, RESULTS_PATH, ...sourcePaths]);
if (sourcePaths.length === 0 || allFiles.some((path) => !allowedPaths.has(path)) || allowedPaths.size !== allFiles.length) {
  fail("oracle directory must contain exactly its manifest, cases, results, and recursive .proto sources");
}
const fileRecords = records(allFiles.filter((path) => path !== MANIFEST_PATH));
if (JSON.stringify(manifest.files) !== JSON.stringify(fileRecords)) fail("oracle manifest file records differ from the exact closure");
const sourceRootSha256 = recordRoot(records(sourcePaths));
const caseRootSha256 = recordRoot([{ path: "oracle-cases.json", sha256: sha256(caseBytes) }]);
const resultRootSha256 = recordRoot([{ path: "oracle-results.json", sha256: sha256(resultBytes) }]);
if (manifest.sourceRootSha256 !== sourceRootSha256) fail("oracle source root differs");
if (manifest.caseRootSha256 !== caseRootSha256) fail("oracle case root differs");
if (manifest.resultRootSha256 !== resultRootSha256) fail("oracle result root differs");

assertKeys(cases, ["format", "cases"], "oracle cases");
assertKeys(observations, ["format", "results"], "oracle observations");
if (cases.format !== "openbindings.protobuf-oracle-cases@1" || !Array.isArray(cases.cases)) fail("unsupported oracle case corpus");
if (observations.format !== "openbindings.protobuf-oracle-observations@1" || !Array.isArray(observations.results)) fail("unsupported oracle observation corpus");
if (cases.cases.length !== observations.results.length || cases.cases.length !== manifest.caseCount) fail("oracle case/result/manifest counts differ");

const sources = new Set(sourcePaths.map((path) => relative(ORACLE, path).split("\\").join("/")));
const ids = new Set();
let accepted = 0;
let refused = 0;
for (let index = 0; index < cases.cases.length; index++) {
  const test = cases.cases[index];
  const expected = observations.results[index];
  assertKeys(test, ["id", "source", "messageType", "dataBase64", "expected"], `oracle case ${index}`);
  assertKeys(expected, ["id", "exitCode", "stdout", "stderr"], `oracle observation ${index}`);
  if (typeof test.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(test.id) || ids.has(test.id)) fail(`invalid or duplicate oracle case id ${test.id}`);
  ids.add(test.id);
  if (expected.id !== test.id) fail(`${test.id}: observation order/id differs`);
  if (!sources.has(test.source)) fail(`${test.id}: source is outside the manifest source closure`);
  if (typeof test.messageType !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+$/.test(test.messageType)) fail(`${test.id}: invalid message type`);
  if (!new Set(["accepted", "refused"]).has(test.expected)) fail(`${test.id}: invalid expected disposition`);
  if (!Number.isInteger(expected.exitCode) || typeof expected.stdout !== "string" || typeof expected.stderr !== "string") fail(`${test.id}: invalid observation fields`);
  const input = canonicalBase64(test.dataBase64, `${test.id}.dataBase64`);
  const execution = spawnSync(PROTOC, ["--proto_path=.", `--decode=${test.messageType}`, test.source], {
    cwd: ORACLE,
    env: ORACLE_ENV,
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (execution.error || execution.signal !== null || execution.status === null) fail(`${test.id}: protoc execution failed`);
  const actual = {
    id: test.id,
    exitCode: execution.status,
    stdout: execution.stdout.toString("utf8"),
    stderr: execution.stderr.toString("utf8"),
  };
  if (JSON.stringify(canonicalJson(actual)) !== JSON.stringify(canonicalJson(expected))) fail(`${test.id}: pinned protoc observation changed\nexpected ${JSON.stringify(expected)}\nactual   ${JSON.stringify(actual)}`);
  const disposition = actual.exitCode === 0 ? "accepted" : "refused";
  if (disposition !== test.expected) fail(`${test.id}: recorded disposition differs from execution`);
  if (disposition === "accepted") accepted++;
  else refused++;
}
if (accepted !== manifest.accepted || refused !== manifest.refused || accepted + refused !== manifest.caseCount) fail("oracle disposition counts differ from the manifest");

process.stdout.write(`${JSON.stringify(canonicalJson({
  format: "openbindings.protobuf-oracle-result@1",
  authorityCommit: manifest.authorityCommit,
  protocArchiveSha256: manifest.protocArchiveSha256,
  protocBinarySha256: manifest.protocBinarySha256,
  manifestSha256,
  sourceRootSha256,
  caseRootSha256,
  resultRootSha256,
  caseCount: manifest.caseCount,
  accepted,
  refused,
  passed: true,
}))}\n`);
