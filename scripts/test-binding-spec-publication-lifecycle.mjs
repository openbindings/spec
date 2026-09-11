#!/usr/bin/env node
/** Adversarial test of exact-byte prepare/review/finalize publication. */

import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  PUBLICATION_CATALOG_STATE_LINE,
  PUBLICATION_STATE_LINE,
  RELEASE_GUIDE_BINDING_STATE_LINE,
} from "./binding-spec-publication-support.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const repo = mkdtempSync(join(tmpdir(), "binding-spec-publication-lifecycle-repo-"));
const scratch = mkdtempSync(join(tmpdir(), "binding-spec-publication-lifecycle-stage-"));
const schemaEngineRequire = createRequire(join(SCRIPT_DIR, "..", "conformance", "binding-specs", "schema-engine", "package.json"));
const Ajv2020 = schemaEngineRequire("ajv/dist/2020").default;
const addFormats = schemaEngineRequire("ajv-formats").default;
const schemaEngine = new Ajv2020({ allErrors: true, strict: false, validateFormats: true });
addFormats(schemaEngine);
const validateStageRecord = schemaEngine.compile(JSON.parse(readFileSync(join(SCRIPT_DIR, "..", "binding-specs", "publication-stage.schema.json"), "utf8")));
const validateEvidenceRecord = schemaEngine.compile(JSON.parse(readFileSync(join(SCRIPT_DIR, "..", "binding-specs", "publication-evidence.schema.json"), "utf8")));

function write(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function run(command, args, expected = 0) {
  const result = spawnSync(command, args, { cwd: repo, encoding: "utf8" });
  const output = (result.stdout || "") + (result.stderr || "");
  if (result.status !== expected) throw new Error(`${command} ${args.join(" ")} exited ${result.status}; expected ${expected}\n${output}`);
  return output;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function canonicalText(value) {
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}

function listFiles(root) {
  const out = [];
  function visit(dir) {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      const stat = lstatSync(full);
      if (stat.isDirectory()) visit(full);
      else if (stat.isFile()) out.push(full);
    }
  }
  visit(root);
  return out;
}

function records(stageDir) {
  return listFiles(join(stageDir, "root")).map((path) => ({
    path: relative(stageDir, path).split("\\").join("/"),
    sha256: sha256(readFileSync(path)),
  }));
}

function assertStageSchema(stage, label, expected = true) {
  const actual = validateStageRecord(stage);
  if (actual !== expected) throw new Error(`${label}: publication-stage schema result ${actual}; expected ${expected}\n${JSON.stringify(validateStageRecord.errors, null, 2)}`);
}

function assertEvidenceSchema(value, label, expected = true) {
  const actual = validateEvidenceRecord(value);
  if (actual !== expected) throw new Error(`${label}: publication-evidence schema result ${actual}; expected ${expected}\n${JSON.stringify(validateEvidenceRecord.errors, null, 2)}`);
}

function recordRoot(files) {
  return sha256(Buffer.from(files.map((file) => `${file.path}\0${file.sha256}\n`).sort().join("")));
}

function sealOracleManifest(root, metadata = {}) {
  const oracleDir = join(root, "conformance", "binding-specs", "grpc-fixtures", "protobuf", "oracle");
  const manifestPath = join(oracleDir, "oracle-manifest.json");
  const prior = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  const files = listFiles(oracleDir)
    .map((path) => ({
      path: relative(oracleDir, path).split("\\").join("/"),
      sha256: sha256(readFileSync(path)),
    }))
    .filter((file) => file.path !== "oracle-manifest.json")
    .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const manifest = {
    ...prior,
    ...metadata,
    files,
    format: "openbindings.protobuf-oracle-manifest@1",
    manifestSha256: "0".repeat(64),
  };
  manifest.manifestSha256 = sha256(Buffer.from(canonicalText(manifest)));
  writeFileSync(manifestPath, canonicalText(manifest));
  return manifest;
}

function refreshStage(stageDir, mutate = () => {}) {
  const path = join(stageDir, "stage.json");
  const stage = JSON.parse(readFileSync(path, "utf8"));
  mutate(stage);
  stage.files = records(stageDir);
  stage.rootSha256 = recordRoot(stage.files);
  writeFileSync(path, canonicalText(stage));
  return stage;
}

function definingDocument(identifier, title, module = false, moduleRef = "openbindings.module.protobuf-correspondence@1", coreVersion = "0.2.0") {
  const reference = identifier;
  return [
    `# ${title}`,
    "",
    PUBLICATION_STATE_LINE,
    "",
    "## 1. Identity",
    "",
    `Defines **\`${reference}\`** and names \`${identifier}\`.`,
    "",
    "## 2. Scope and incorporated authorities",
    "",
    `This specification incorporates exactly version **${coreVersion}** of the [OpenBindings Specification](../../openbindings.md) as its Core authority. Throughout this document, **Core** means that exact version.`,
    ...(module ? [] : ["", `This specification incorporates [\`${moduleRef}\`](/binding-spec-modules/protobuf-correspondence/${moduleRef.split("@")[1]}).`]),
    "",
    "## 3. Normative references",
    "",
    `- [OpenBindings Specification ${coreVersion}](../../openbindings.md)`,
    "",
  ].join("\n");
}

function adjudication(stage, stagePath, evidencePath, withP3 = true) {
  const stageRecordSha256 = sha256(readFileSync(stagePath));
  return {
    evidenceSha256: sha256(readFileSync(evidencePath)),
    format: "openbindings.binding-spec-publication-adjudication@2",
    identifiers: stage.identifiers,
    p3Dispositions: withP3 ? [{ decision: "accepted", id: "PUB-P3-1", rationale: "Editorial note is harmless and explicitly retained." }] : [],
    publication: stage.publication,
    reviews: ["authority", "conformance", "publisher"].map((role) => ({
      findings: role === "publisher" ? [{ id: "PUB-P3-1", severity: "p3", status: "open", summary: "One documented editorial tradeoff." }] : [],
      recordedAt: "2026-09-05T12:00:00Z",
      reviewer: `${role}-reviewer`,
      role,
      rootSha256: stage.rootSha256,
      stageRecordSha256,
      unresolved: { p0: 0, p1: 0, p2: 0 },
      verdict: "ACCEPT",
    })),
    rootSha256: stage.rootSha256,
    stageRecordSha256,
    unresolvedP0P2: 0,
  };
}

function prepare(publication, revision, stageDir, date, coreVersion = "0.2.0") {
  run("node", ["scripts/prepare-binding-specification-publication.mjs", "--publication", publication, "--published-at", date, "--core-version", coreVersion, "--families", `grpc@${revision}`, "--stage", stageDir]);
  return JSON.parse(readFileSync(join(stageDir, "stage.json"), "utf8"));
}

function evidence(stageDir, path) {
  run("node", ["scripts/record-binding-spec-publication-evidence.mjs", "--from-stage", stageDir, "--out", path]);
  assertEvidenceSchema(JSON.parse(readFileSync(path, "utf8")), `evidence ${path}`);
}

function finalize(stageDir, evidencePath, adjudicationPath, expected = 0) {
  return run("node", ["scripts/publish-binding-specifications.mjs", "--from-stage", stageDir, "--evidence", evidencePath, "--adjudication", adjudicationPath], expected);
}

function configureGrpcModules(entries) {
  const supportPath = join(repo, "scripts", "binding-spec-publication-support.mjs");
  const source = readFileSync(supportPath, "utf8");
  const body = Object.entries(entries).map(([revision, ref]) => `${revision}: ["${ref}"]`).join(", ");
  const updated = source.replace(/moduleRefsByRevision: \{[^}]*\}/, `moduleRefsByRevision: { ${body} }`);
  if (updated === source) throw new Error("failed to update synthetic consumer-revision module registry");
  writeFileSync(supportPath, updated);
}

try {
  const schemaProbe = join(scratch, "schema-engine-probe");
  mkdirSync(join(schemaProbe, "scripts"), { recursive: true });
  mkdirSync(join(schemaProbe, "conformance", "binding-specs", "schema-engine"), { recursive: true });
  copyFileSync(join(SCRIPT_DIR, "verify-binding-specs.mjs"), join(schemaProbe, "scripts", "verify-binding-specs.mjs"));
  copyFileSync(join(SCRIPT_DIR, "count-binding-spec-scenarios.mjs"), join(schemaProbe, "scripts", "count-binding-spec-scenarios.mjs"));
  copyFileSync(join(SCRIPT_DIR, "..", "conformance", "binding-specs", "schema-engine", "package.json"), join(schemaProbe, "conformance", "binding-specs", "schema-engine", "package.json"));
  const missingEngine = spawnSync("node", ["scripts/verify-binding-specs.mjs"], { cwd: schemaProbe, encoding: "utf8", env: { ...process.env, NODE_PATH: "" } });
  if (missingEngine.status !== 2 || !`${missingEngine.stdout}${missingEngine.stderr}`.includes("Failed to load the pinned JSON-schema engine")) throw new Error("binding verifier accepted a missing local schema engine");
  const substitutedEngine = spawnSync("node", ["scripts/verify-binding-specs.mjs"], {
    cwd: schemaProbe,
    encoding: "utf8",
    env: { ...process.env, NODE_PATH: join(SCRIPT_DIR, "..", "conformance", "binding-specs", "schema-engine", "node_modules") },
  });
  if (substitutedEngine.status !== 2 || !`${substitutedEngine.stdout}${substitutedEngine.stderr}`.includes("did not resolve from the pinned local schema-engine directory")) throw new Error("binding verifier accepted NODE_PATH/global schema-engine substitution");

  mkdirSync(join(repo, "scripts"), { recursive: true });
  for (const script of [
    "binding-spec-publication-support.mjs",
    "prepare-binding-specification-publication.mjs",
    "publish-binding-specifications.mjs",
    "record-binding-spec-publication-evidence.mjs",
    "verify-binding-spec-publications.mjs",
  ]) copyFileSync(join(SCRIPT_DIR, script), join(repo, "scripts", script));
  for (const script of [
    "count-binding-spec-scenarios.mjs", "verify-authority-pins.mjs", "verify-binding-specs.mjs",
    "verify-grpc-binding-runners.mjs", "verify-grpc-ds-witness.mjs", "verify-grpc-protobuf-compiler.mjs",
    "verify-grpc-protobuf-values.mjs", "verify-grpc-tls-fixtures.mjs",
  ]) write(join(repo, "scripts", script), "console.log('fixture gate: OK');\n");
  write(join(repo, "scripts", "verify-grpc-protobuf-oracle.mjs"), [
    "#!/usr/bin/env node",
    "import { join } from 'node:path';",
    "import { canonicalJson, grpcProtobufOracleClosure, readCanonicalJson } from './binding-spec-publication-support.mjs';",
    "const root = process.cwd();",
    "try {",
    "  const closure = grpcProtobufOracleClosure(root);",
    "  const results = readCanonicalJson(join(root, 'conformance/binding-specs/grpc-fixtures/protobuf/oracle/oracle-results.json'), 'fixture oracle results');",
    "  if (results.caseRootSha256 !== closure.caseRootSha256 || results.sourceRootSha256 !== closure.sourceRootSha256) throw new Error('fixture oracle results are stale');",
    "  if (!Number.isInteger(results.accepted) || !Number.isInteger(results.refused) || results.accepted + results.refused !== results.caseCount || results.caseCount < 1) throw new Error('fixture oracle result counts are invalid');",
    "  const observation = {",
    "    accepted: results.accepted,",
    "    authorityCommit: 'a'.repeat(40),",
    "    caseCount: results.caseCount,",
    "    caseRootSha256: closure.caseRootSha256,",
    "    format: 'openbindings.protobuf-oracle-result@1',",
    "    manifestSha256: closure.manifestSha256,",
    "    passed: true,",
    "    protocArchiveSha256: 'b'.repeat(64),",
    "    protocBinarySha256: 'c'.repeat(64),",
    "    refused: results.refused,",
    "    resultRootSha256: closure.resultRootSha256,",
    "    sourceRootSha256: closure.sourceRootSha256,",
    "  };",
    "  console.log(JSON.stringify(canonicalJson(observation)));",
    "} catch (error) { console.error(`error: ${error.message}`); process.exit(2); }",
    "",
  ].join("\n"));

  const candidateCore = "# OpenBindings 0.2.0\n\nThis is **version 0.2.0** of the OpenBindings specification. This text is the unreleased working draft of that version.\n";
  const releasedCore = "# OpenBindings 0.2.0\n\nThis is **version 0.2.0** of the OpenBindings specification.\n";
  write(join(repo, "openbindings.md"), candidateCore);
  write(join(repo, "openbindings.schema.json"), "{}\n");
  write(join(repo, "EDITORS.md"), "# Editors\n");
  write(join(repo, "binding-specs", "README.md"), `# Binding specs\n\n${PUBLICATION_CATALOG_STATE_LINE}\n`);
  write(join(repo, "RELEASING.md"), `# Releasing\n\n${RELEASE_GUIDE_BINDING_STATE_LINE}\n`);
  write(join(repo, "binding-specs", "AUTHORITY-PINS.json"), "{}\n");
  write(join(repo, "binding-specs", "errata.json"), canonicalText({ errata: [], format: "openbindings.binding-spec-errata@1" }));
  write(join(repo, "binding-specs", "publications.json"), canonicalText({ floor: { publications: 0 }, format: "openbindings.binding-spec-publications@1", latest: {}, publications: [], tombstones: [] }));
  write(join(repo, "binding-specs", "grpc", "openbindings.grpc.md"), definingDocument("openbindings.grpc@1", "gRPC"));
  write(join(repo, "binding-specs", "connect", "openbindings.connect.md"), definingDocument("openbindings.connect@1", "Connect"));
  write(join(repo, "binding-specs", "modules", "openbindings.protobuf-correspondence.md"), definingDocument("openbindings.module.protobuf-correspondence@1", "Protobuf correspondence", true));
  write(join(repo, "conformance", "binding-specs", "processor", "grpc.json"), "{}\n");
  const oracleDir = join(repo, "conformance", "binding-specs", "grpc-fixtures", "protobuf", "oracle");
  const oracleSourcePath = join(oracleDir, "source", "fixture.proto");
  const oracleCasesPath = join(oracleDir, "oracle-cases.json");
  const oracleResultsPath = join(oracleDir, "oracle-results.json");
  write(oracleSourcePath, "syntax = \"proto3\";\nmessage Fixture { string value = 1; }\n");
  write(oracleCasesPath, canonicalText({
    cases: [{ expected: "accepted", id: "accepted" }, { expected: "refused", id: "refused" }],
    format: "openbindings.protobuf-oracle-cases@1",
  }));
  const oracleSourceRoot = recordRoot([{ path: "source/fixture.proto", sha256: sha256(readFileSync(oracleSourcePath)) }]);
  const oracleCaseRoot = recordRoot([{ path: "oracle-cases.json", sha256: sha256(readFileSync(oracleCasesPath)) }]);
  write(oracleResultsPath, canonicalText({
    accepted: 1,
    caseCount: 2,
    caseRootSha256: oracleCaseRoot,
    format: "openbindings.protobuf-oracle-results@1",
    refused: 1,
    sourceRootSha256: oracleSourceRoot,
  }));
  const oracleResultRoot = recordRoot([{ path: "oracle-results.json", sha256: sha256(readFileSync(oracleResultsPath)) }]);
  sealOracleManifest(repo, {
    accepted: 1,
    authorityCommit: "a".repeat(40),
    caseCount: 2,
    caseRootSha256: oracleCaseRoot,
    protocArchiveSha256: "b".repeat(64),
    protocBinarySha256: "c".repeat(64),
    protocVersion: "fixture protoc 36.1",
    refused: 1,
    resultRootSha256: oracleResultRoot,
    sourceRootSha256: oracleSourceRoot,
  });
  const schemaEngineRoot = join(repo, "conformance", "binding-specs", "schema-engine");
  mkdirSync(schemaEngineRoot, { recursive: true });
  copyFileSync(join(SCRIPT_DIR, "..", "conformance", "binding-specs", "schema-engine", "package.json"), join(schemaEngineRoot, "package.json"));
  copyFileSync(join(SCRIPT_DIR, "..", "conformance", "binding-specs", "schema-engine", "package-lock.json"), join(schemaEngineRoot, "package-lock.json"));
  const apparatusPaths = [
    "conformance/binding-specs/schema-engine/package-lock.json",
    "conformance/binding-specs/schema-engine/package.json",
    "scripts/verify-grpc-protobuf-oracle.mjs",
  ];
  write(join(repo, "conformance", "binding-specs", "grpc-apparatus.manifest.json"), canonicalText({
    files: apparatusPaths.map((path) => ({
      path,
      sha256: sha256(readFileSync(join(repo, path))),
    })),
    format: "openbindings.grpc-apparatus-manifest@1",
  }));
  const tsRoot = join(repo, "conformance", "binding-specs", "grpc-runners", "typescript");
  write(join(tsRoot, "package.json"), canonicalText({ name: "publication-fixture", private: true, version: "1.0.0" }));
  write(join(tsRoot, "package-lock.json"), canonicalText({ lockfileVersion: 3, name: "publication-fixture", packages: { "": { name: "publication-fixture", version: "1.0.0" } }, requires: true, version: "1.0.0" }));
  write(join(tsRoot, "runner.ts"), "console.log(JSON.stringify({ok:true}));\n");
  write(join(repo, "conformance", "binding-specs", "grpc-runners", "go", "runner.go"), "package main\nimport \"fmt\"\nfunc main(){fmt.Println(\"{\\\"ok\\\":true}\")}\n");
  write(join(repo, "conformance", "binding-specs", "grpc-runners", "go", "protojson_strict.go"), "package main\n");

  run("git", ["init", "-q"]);
  run("git", ["config", "user.name", "Publication Test"]);
  run("git", ["config", "user.email", "publication-test@example.invalid"]);
  run("git", ["add", "."]);
  run("git", ["commit", "-qm", "candidate"]);

  run("git", ["tag", "-a", "v0.2.0", "-m", "incomplete Core release"]);
  const tagOnlyStage = join(scratch, "tag-only-core");
  const tagOnly = run("node", ["scripts/prepare-binding-specification-publication.mjs", "--publication", "tag-only", "--published-at", "2026-09-05", "--core-version", "0.2.0", "--families", "grpc@1", "--stage", tagOnlyStage], 2);
  if (!tagOnly.includes("release proof is incomplete")) throw new Error("prepare accepted an annotated Core tag without its version snapshot");
  run("git", ["tag", "-d", "v0.2.0"]);
  write(join(repo, "versions", "0.2.0", "openbindings.md"), releasedCore);
  const snapshotOnlyStage = join(scratch, "snapshot-only-core");
  const snapshotOnly = run("node", ["scripts/prepare-binding-specification-publication.mjs", "--publication", "snapshot-only", "--published-at", "2026-09-05", "--core-version", "0.2.0", "--families", "grpc@1", "--stage", snapshotOnlyStage], 2);
  if (!snapshotOnly.includes("release proof is incomplete")) throw new Error("prepare accepted an untagged Core version snapshot");
  rmSync(join(repo, "versions"), { recursive: true, force: true });

  const grpcPath = join(repo, "binding-specs", "grpc", "openbindings.grpc.md");
  const goodGrpc = readFileSync(grpcPath, "utf8");
  writeFileSync(grpcPath, goodGrpc.replace(PUBLICATION_STATE_LINE, ""));
  const missingState = run("node", ["scripts/prepare-binding-specification-publication.mjs", "--publication", "missing-state", "--published-at", "2026-09-05", "--core-version", "0.2.0", "--families", "grpc@1", "--stage", join(scratch, "missing-state")], 2);
  if (!missingState.includes("canonical publication-state line")) throw new Error("prepare accepted a missing publication state");
  writeFileSync(grpcPath, goodGrpc.replace(PUBLICATION_STATE_LINE, `${PUBLICATION_STATE_LINE}\n${PUBLICATION_STATE_LINE}`));
  const duplicateState = run("node", ["scripts/prepare-binding-specification-publication.mjs", "--publication", "duplicate-state", "--published-at", "2026-09-05", "--core-version", "0.2.0", "--families", "grpc@1", "--stage", join(scratch, "duplicate-state")], 2);
  if (!duplicateState.includes("canonical publication-state line")) throw new Error("prepare accepted duplicate publication state");
  writeFileSync(grpcPath, goodGrpc.replace("- [OpenBindings Specification 0.2.0](../../openbindings.md)", ""));
  const missingCore = run("node", ["scripts/prepare-binding-specification-publication.mjs", "--publication", "missing-core", "--published-at", "2026-09-05", "--core-version", "0.2.0", "--families", "grpc@1", "--stage", join(scratch, "missing-core")], 2);
  if (!missingCore.includes("references must contain")) throw new Error("prepare accepted missing exact Core reference");
  writeFileSync(grpcPath, goodGrpc);
  const wrongCore = run("node", ["scripts/prepare-binding-specification-publication.mjs", "--publication", "wrong-core", "--published-at", "2026-09-05", "--core-version", "0.2.1", "--families", "grpc@1", "--stage", join(scratch, "wrong-core")], 2);
  if (!wrongCore.includes("does not match openbindings.md")) throw new Error("prepare accepted mismatched Core flag");
  writeFileSync(grpcPath, `${goodGrpc}\n[Broken lifecycle](../README.md#missing-heading)\n`);
  if (!run("node", ["scripts/verify-binding-spec-publications.mjs"], 1).includes("missing heading")) throw new Error("publication verifier accepted a broken local heading");
  writeFileSync(grpcPath, `${goodGrpc}\n**[exclusion]** This exclusion reopens in a future revision.\n`);
  if (!run("node", ["scripts/verify-binding-spec-publications.mjs"], 1).includes("roadmap-shaped reopen trigger")) throw new Error("publication verifier accepted a roadmap-shaped reopen trigger");
  writeFileSync(grpcPath, goodGrpc);
  const symlinkPath = join(repo, "binding-specs", "grpc", "linked.md");
  symlinkSync("../../openbindings.md", symlinkPath);
  const symlinkStage = join(scratch, "symlink");
  if (!run("node", ["scripts/prepare-binding-specification-publication.mjs", "--publication", "symlink", "--published-at", "2026-09-05", "--core-version", "0.2.0", "--families", "grpc@1", "--stage", symlinkStage], 2).includes("cannot contain symlinks")) throw new Error("prepare accepted a source symlink");
  unlinkSync(symlinkPath);
  rmSync(symlinkStage, { recursive: true, force: true });

  const candidateStage = join(scratch, "candidate-review");
  const candidateStageRecord = prepare("candidate-review", 1, candidateStage, "2026-09-05");
  if (candidateStageRecord.state !== "candidate-review" || candidateStageRecord.core.lifecycle !== "unreleased-candidate" || candidateStageRecord.core.sourcePath !== "openbindings.md") throw new Error("unreleased Core did not produce an explicit candidate-review stage");
  assertStageSchema(candidateStageRecord, "candidate-review stage");
  assertStageSchema({ ...candidateStageRecord, core: { ...candidateStageRecord.core, sourcePath: "versions/0.2.0/openbindings.md" } }, "candidate lifecycle with released source path", false);
  const candidateEvidence = join(scratch, "candidate-evidence.json");
  evidence(candidateStage, candidateEvidence);
  const candidateEvidenceRecord = JSON.parse(readFileSync(candidateEvidence, "utf8"));
  if (candidateEvidenceRecord.oracle.observation.format !== "openbindings.protobuf-oracle-result@1" || candidateEvidenceRecord.oracle.observation.passed !== true) throw new Error("candidate evidence omitted the exact passing Protobuf oracle observation");

  function rejectOracleStageMutation(name, mutate, expectedFragment) {
    const stageDir = join(scratch, name);
    cpSync(candidateStage, stageDir, { recursive: true });
    mutate(join(stageDir, "root"));
    refreshStage(stageDir);
    const output = run("node", ["scripts/record-binding-spec-publication-evidence.mjs", "--from-stage", stageDir, "--out", join(scratch, `${name}-evidence.json`)], 2);
    if (!output.includes(expectedFragment)) throw new Error(`evidence recorder accepted ${name} or failed for the wrong reason:\n${output}`);
  }

  rejectOracleStageMutation("missing-oracle-manifest", (root) => {
    rmSync(join(root, "conformance", "binding-specs", "grpc-fixtures", "protobuf", "oracle", "oracle-manifest.json"));
  }, "oracle manifest is missing");
  rejectOracleStageMutation("missing-oracle-cases", (root) => {
    rmSync(join(root, "conformance", "binding-specs", "grpc-fixtures", "protobuf", "oracle", "oracle-cases.json"));
  }, "oracle cases is missing");
  rejectOracleStageMutation("missing-oracle-results", (root) => {
    rmSync(join(root, "conformance", "binding-specs", "grpc-fixtures", "protobuf", "oracle", "oracle-results.json"));
  }, "oracle results is missing");
  rejectOracleStageMutation("missing-oracle-source", (root) => {
    rmSync(join(root, "conformance", "binding-specs", "grpc-fixtures", "protobuf", "oracle", "source", "fixture.proto"));
  }, "oracle closure contains no source fixtures");
  rejectOracleStageMutation("missing-oracle-verifier", (root) => {
    rmSync(join(root, "scripts", "verify-grpc-protobuf-oracle.mjs"));
  }, "verify-grpc-protobuf-oracle.mjs failed");
  rejectOracleStageMutation("stale-oracle-result", (root) => {
    const path = join(root, "conformance", "binding-specs", "grpc-fixtures", "protobuf", "oracle", "oracle-results.json");
    const value = JSON.parse(readFileSync(path, "utf8"));
    value.sourceRootSha256 = "0".repeat(64);
    writeFileSync(path, canonicalText(value));
    sealOracleManifest(root, {
      resultRootSha256: recordRoot([{ path: "oracle-results.json", sha256: sha256(readFileSync(path)) }]),
    });
  }, "fixture oracle results are stale");
  rejectOracleStageMutation("oracle-source-drift", (root) => {
    const path = join(root, "conformance", "binding-specs", "grpc-fixtures", "protobuf", "oracle", "source", "fixture.proto");
    writeFileSync(path, `${readFileSync(path, "utf8")}\n// drift\n`);
    sealOracleManifest(root, {
      sourceRootSha256: recordRoot([{ path: "source/fixture.proto", sha256: sha256(readFileSync(path)) }]),
    });
  }, "fixture oracle results are stale");
  rejectOracleStageMutation("oracle-case-drift", (root) => {
    const path = join(root, "conformance", "binding-specs", "grpc-fixtures", "protobuf", "oracle", "oracle-cases.json");
    const value = JSON.parse(readFileSync(path, "utf8"));
    value.cases[0].id = "changed";
    writeFileSync(path, canonicalText(value));
    sealOracleManifest(root, {
      caseRootSha256: recordRoot([{ path: "oracle-cases.json", sha256: sha256(readFileSync(path)) }]),
    });
  }, "fixture oracle results are stale");
  rejectOracleStageMutation("oracle-toolchain-identity-drift", (root) => {
    sealOracleManifest(root, { protocBinarySha256: "d".repeat(64) });
  }, "protocBinarySha256 differs from the independently derived staged closure");
  const missingRunnerHelperStage = join(scratch, "missing-runner-helper");
  cpSync(candidateStage, missingRunnerHelperStage, { recursive: true });
  rmSync(join(missingRunnerHelperStage, "root", "conformance", "binding-specs", "grpc-runners", "go", "protojson_strict.go"));
  refreshStage(missingRunnerHelperStage);
  const missingRunnerHelper = run("node", ["scripts/record-binding-spec-publication-evidence.mjs", "--from-stage", missingRunnerHelperStage, "--out", join(scratch, "missing-runner-helper-evidence.json")], 2);
  if (!missingRunnerHelper.includes("protojson_strict.go")) throw new Error("evidence recorder accepted a stage missing the exact Go runner helper");
  const candidateAdjudication = join(scratch, "candidate-adjudication.json");
  writeFileSync(candidateAdjudication, canonicalText(adjudication(candidateStageRecord, join(candidateStage, "stage.json"), candidateEvidence)));

  write(join(repo, "versions", "0.2.0", "openbindings.md"), releasedCore);
  run("git", ["add", "."]);
  run("git", ["commit", "-qm", "release Core 0.2.0 snapshot"]);
  run("git", ["tag", "-a", "v0.2.0", "-m", "Core 0.2.0"]);
  const staleCandidateFinalize = finalize(candidateStage, candidateEvidence, candidateAdjudication, 2);
  if (!staleCandidateFinalize.includes("candidate-review evidence does not confer mint eligibility")) throw new Error("finalizer promoted a candidate-Core review stage after the Core tag appeared");

  const stage1 = join(scratch, "first");
  const stage1Record = prepare("first", 1, stage1, "2026-09-05");
  if (stage1Record.state !== "prepared-unminted" || stage1Record.core.lifecycle !== "released" || stage1Record.core.sourcePath !== "versions/0.2.0/openbindings.md") throw new Error("released Core did not produce a fresh finalizable stage");
  assertStageSchema(stage1Record, "released-Core stage");
  assertStageSchema({ ...stage1Record, core: { ...stage1Record.core, sourcePath: "openbindings.md" } }, "released lifecycle with candidate source path", false);
  const liveGrpc = readFileSync(join(repo, "binding-specs", "grpc", "openbindings.grpc.md"));
  const stagedGrpc = readFileSync(join(stage1, "root", "binding-specs", "grpc", "openbindings.grpc.md"));
  if (!liveGrpc.equals(stagedGrpc)) throw new Error("prepare transformed status-neutral defining bytes");
  if (!existsSync(join(stage1, "root", "scripts", "count-binding-spec-scenarios.mjs"))) throw new Error("stage omitted a transitive verifier import");
  if (existsSync(join(stage1, "root", "conformance", "binding-specs", "grpc-runners", "typescript", "node_modules"))) throw new Error("stage archived node_modules");

  const evidence1 = join(scratch, "first-evidence.json");
  const sourceDrift = join(repo, "SOURCE-DRIFT");
  writeFileSync(sourceDrift, "drift\n");
  const falseSourceEvidence = run("node", ["scripts/record-binding-spec-publication-evidence.mjs", "--from-stage", stage1, "--out", evidence1], 2);
  if (!falseSourceEvidence.includes("source-target evidence was not executed")) throw new Error("evidence recorder claimed a stale source snapshot");
  rmSync(sourceDrift);
  const evidenceDriftStage = join(scratch, "evidence-stage-drift");
  cpSync(stage1, evidenceDriftStage, { recursive: true });
  write(join(evidenceDriftStage, "root", "DRIFT"), "drift\n");
  const falseStageEvidence = run("node", ["scripts/record-binding-spec-publication-evidence.mjs", "--from-stage", evidenceDriftStage, "--out", evidence1], 2);
  if (!falseStageEvidence.includes("stage-target evidence was not executed")) throw new Error("evidence recorder claimed a stale stage root");
  evidence(stage1, evidence1);
  const adjudication1 = join(scratch, "first-adjudication.json");
  writeFileSync(adjudication1, canonicalText(adjudication(stage1Record, join(stage1, "stage.json"), evidence1)));

  const harnessDriftStage = join(scratch, "oracle-harness-drift");
  cpSync(stage1, harnessDriftStage, { recursive: true });
  const harnessDriftPath = join(harnessDriftStage, "root", "scripts", "verify-grpc-protobuf-oracle.mjs");
  writeFileSync(harnessDriftPath, `${readFileSync(harnessDriftPath, "utf8")}\n// one-sided harness drift\n`);
  const harnessDriftRecord = refreshStage(harnessDriftStage);
  const harnessDriftEvidence = join(scratch, "oracle-harness-drift-evidence.json");
  evidence(harnessDriftStage, harnessDriftEvidence);
  const harnessDriftAdjudication = join(scratch, "oracle-harness-drift-adjudication.json");
  writeFileSync(harnessDriftAdjudication, canonicalText(adjudication(harnessDriftRecord, join(harnessDriftStage, "stage.json"), harnessDriftEvidence)));
  const harnessDriftFinalize = finalize(harnessDriftStage, harnessDriftEvidence, harnessDriftAdjudication, 2);
  if (!harnessDriftFinalize.includes("staged gRPC Protobuf oracle differs from the exact source")) throw new Error("finalizer accepted an oracle harness outside the exact source closure");

  const driftStage = join(scratch, "drift");
  cpSync(stage1, driftStage, { recursive: true });
  write(join(driftStage, "root", "DRIFT"), "drift\n");
  if (!finalize(driftStage, evidence1, adjudication1, 2).includes("stage file inventory differs")) throw new Error("finalizer accepted unrecorded stage drift");

  const missingEngineStage = join(scratch, "missing-schema-engine");
  cpSync(stage1, missingEngineStage, { recursive: true });
  rmSync(join(missingEngineStage, "root", "conformance", "binding-specs", "schema-engine", "package-lock.json"));
  refreshStage(missingEngineStage);
  if (!finalize(missingEngineStage, evidence1, adjudication1, 2).includes("stage lacks runnable verifier dependency conformance/binding-specs/schema-engine/package-lock.json")) throw new Error("finalizer accepted a missing schema-engine lockfile");

  const engineDriftStage = join(scratch, "schema-engine-drift");
  cpSync(stage1, engineDriftStage, { recursive: true });
  const driftLock = join(engineDriftStage, "root", "conformance", "binding-specs", "schema-engine", "package-lock.json");
  writeFileSync(driftLock, `${readFileSync(driftLock, "utf8")}\n`);
  refreshStage(engineDriftStage);
  if (!finalize(engineDriftStage, evidence1, adjudication1, 2).includes("staged gRPC apparatus mismatch at conformance/binding-specs/schema-engine/package-lock.json")) throw new Error("finalizer accepted schema-engine lock drift outside the apparatus seal");

  const coordinatedEngineStage = join(scratch, "coordinated-schema-engine-mutation");
  cpSync(stage1, coordinatedEngineStage, { recursive: true });
  const coordinatedEngineRoot = join(coordinatedEngineStage, "root", "conformance", "binding-specs", "schema-engine");
  const coordinatedPackage = JSON.parse(readFileSync(join(coordinatedEngineRoot, "package.json"), "utf8"));
  const coordinatedLock = JSON.parse(readFileSync(join(coordinatedEngineRoot, "package-lock.json"), "utf8"));
  coordinatedPackage.dependencies.ajv = "8.17.1";
  coordinatedLock.packages[""].dependencies.ajv = "8.17.1";
  coordinatedLock.packages["node_modules/ajv"].version = "8.17.1";
  writeFileSync(join(coordinatedEngineRoot, "package.json"), canonicalText(coordinatedPackage));
  writeFileSync(join(coordinatedEngineRoot, "package-lock.json"), canonicalText(coordinatedLock));
  refreshStage(coordinatedEngineStage);
  if (!finalize(coordinatedEngineStage, evidence1, adjudication1, 2).includes("package.json dependencies differ from the closed dependency set")) throw new Error("finalizer accepted a coordinated schema-engine package/lock mutation");

  const deletedStage = join(scratch, "deleted-module");
  cpSync(stage1, deletedStage, { recursive: true });
  rmSync(join(deletedStage, "root", "binding-specs", "modules", "openbindings.protobuf-correspondence.md"));
  refreshStage(deletedStage, (stage) => { stage.modules = []; });
  if (!finalize(deletedStage, evidence1, adjudication1, 2).includes("normative-module closure")) throw new Error("finalizer accepted coordinated module deletion");

  const substitutedStage = join(scratch, "substituted-module");
  cpSync(stage1, substitutedStage, { recursive: true });
  const substitutedModule = join(substitutedStage, "root", "binding-specs", "modules", "openbindings.protobuf-correspondence.md");
  writeFileSync(substitutedModule, `${readFileSync(substitutedModule, "utf8")}\nSUBSTITUTED\n`);
  refreshStage(substitutedStage, (stage) => { stage.modules[0].sha256 = sha256(readFileSync(substitutedModule)); });
  if (!finalize(substitutedStage, evidence1, adjudication1, 2).includes("authoritative source module")) throw new Error("finalizer accepted coordinated module substitution");

  const extraStage = join(scratch, "extra-module");
  cpSync(stage1, extraStage, { recursive: true });
  refreshStage(extraStage, (stage) => { stage.modules.push({ ...stage.modules[0], identifier: "openbindings.module.extra@1", module: "extra" }); });
  if (!finalize(extraStage, evidence1, adjudication1, 2).includes("normative-module closure")) throw new Error("finalizer accepted an extra self-declared module");

  const routeStage = join(scratch, "route-mutation");
  cpSync(stage1, routeStage, { recursive: true });
  refreshStage(routeStage, (stage) => { stage.modules[0].canonicalUrl = "https://example.invalid/module"; });
  if (!finalize(routeStage, evidence1, adjudication1, 2).includes("normative-module closure")) throw new Error("finalizer accepted a module route mutation");

  const badStateStage = join(scratch, "bad-state");
  cpSync(stage1, badStateStage, { recursive: true });
  const badDocument = join(badStateStage, "root", "binding-specs", "grpc", "openbindings.grpc.md");
  writeFileSync(badDocument, readFileSync(badDocument, "utf8").replace(PUBLICATION_STATE_LINE, "**Status: nonsense candidate.**"));
  refreshStage(badStateStage, (stage) => { stage.definingDocuments[0].sha256 = sha256(readFileSync(badDocument)); });
  if (!finalize(badStateStage, evidence1, adjudication1, 2).includes("canonical publication-state line")) throw new Error("finalizer accepted malformed candidate status");

  const falseEvidencePath = join(scratch, "false-evidence.json");
  const falseEvidence = JSON.parse(readFileSync(evidence1, "utf8"));
  falseEvidence.gates.find((gate) => gate.id === "binding-specs").targetRootSha256 = "0".repeat(64);
  writeFileSync(falseEvidencePath, canonicalText(falseEvidence));
  const falseAdjudicationPath = join(scratch, "false-adjudication.json");
  writeFileSync(falseAdjudicationPath, canonicalText(adjudication(stage1Record, join(stage1, "stage.json"), falseEvidencePath)));
  if (!finalize(stage1, falseEvidencePath, falseAdjudicationPath, 2).includes("exact target root")) throw new Error("finalizer accepted a fabricated gate target");

  const missingDsEvidencePath = join(scratch, "missing-ds-evidence.json");
  const missingDsEvidence = JSON.parse(readFileSync(evidence1, "utf8"));
  missingDsEvidence.gates = missingDsEvidence.gates.filter((gate) => gate.id !== "grpc-ds-witness");
  writeFileSync(missingDsEvidencePath, canonicalText(missingDsEvidence));
  const missingDsAdjudicationPath = join(scratch, "missing-ds-adjudication.json");
  writeFileSync(missingDsAdjudicationPath, canonicalText(adjudication(stage1Record, join(stage1, "stage.json"), missingDsEvidencePath)));
  if (!finalize(stage1, missingDsEvidencePath, missingDsAdjudicationPath, 2).includes("exactly one grpc-ds-witness gate")) throw new Error("finalizer accepted evidence without the D/S witness gate");

  function rejectOracleEvidenceMutation(name, mutate, expectedFragment) {
    const path = join(scratch, `${name}.json`);
    const value = JSON.parse(readFileSync(evidence1, "utf8"));
    mutate(value);
    writeFileSync(path, canonicalText(value));
    const adjudicationPath = join(scratch, `${name}-adjudication.json`);
    writeFileSync(adjudicationPath, canonicalText(adjudication(stage1Record, join(stage1, "stage.json"), path)));
    const output = finalize(stage1, path, adjudicationPath, 2);
    if (!output.includes(expectedFragment)) throw new Error(`finalizer accepted ${name} or failed for the wrong reason:\n${output}`);
  }

  const missingOracleSchemaRecord = JSON.parse(readFileSync(evidence1, "utf8"));
  delete missingOracleSchemaRecord.oracle;
  assertEvidenceSchema(missingOracleSchemaRecord, "evidence missing oracle binding", false);
  const falseOracleSchemaRecord = JSON.parse(readFileSync(evidence1, "utf8"));
  falseOracleSchemaRecord.oracle.observation.passed = false;
  assertEvidenceSchema(falseOracleSchemaRecord, "evidence with a false oracle observation", false);
  rejectOracleEvidenceMutation("missing-oracle-gate", (value) => {
    value.gates = value.gates.filter((gate) => gate.id !== "grpc-protobuf-oracle");
  }, "exactly one grpc-protobuf-oracle gate");
  rejectOracleEvidenceMutation("oracle-command-drift", (value) => {
    value.gates.find((gate) => gate.id === "grpc-protobuf-oracle").command = ["node", "scripts/drifted-oracle.mjs"];
  }, "required command and exact target root");
  const liveSupportPath = join(repo, "scripts", "binding-spec-publication-support.mjs");
  const liveSupport = readFileSync(liveSupportPath, "utf8");
  const finalizerSideDrift = liveSupport.replace(
    '"node", "scripts/verify-grpc-protobuf-oracle.mjs"',
    '"node", "scripts/finalizer-only-oracle.mjs"',
  );
  if (finalizerSideDrift === liveSupport) throw new Error("could not construct the one-sided finalizer oracle-command mutant");
  writeFileSync(liveSupportPath, finalizerSideDrift);
  const finalizerSideOutput = finalize(stage1, evidence1, adjudication1, 2);
  writeFileSync(liveSupportPath, liveSupport);
  if (!finalizerSideOutput.includes("required command and exact target root")) throw new Error("finalizer accepted one-sided oracle-command drift from the recorder");
  rejectOracleEvidenceMutation("oracle-gate-false-pass", (value) => {
    value.gates.find((gate) => gate.id === "grpc-protobuf-oracle").resultSha256 = "0".repeat(64);
  }, "result digest differs when re-run");
  rejectOracleEvidenceMutation("oracle-source-evidence-drift", (value) => {
    value.oracle.observation.sourceRootSha256 = "0".repeat(64);
  }, "exact gRPC Protobuf oracle authority, harness, source, case, result, and toolchain observation");
  rejectOracleEvidenceMutation("oracle-harness-evidence-drift", (value) => {
    value.oracle.harnessRootSha256 = "0".repeat(64);
  }, "exact gRPC Protobuf oracle authority, harness, source, case, result, and toolchain observation");
  rejectOracleEvidenceMutation("oracle-authority-evidence-drift", (value) => {
    value.oracle.authorityRootSha256 = "0".repeat(64);
  }, "exact gRPC Protobuf oracle authority, harness, source, case, result, and toolchain observation");

  const falseRunnerEvidencePath = join(scratch, "false-runner-evidence.json");
  const falseRunnerEvidence = JSON.parse(readFileSync(evidence1, "utf8"));
  falseRunnerEvidence.runners.find((runner) => runner.language === "go").corpusSha256 = "0".repeat(64);
  writeFileSync(falseRunnerEvidencePath, canonicalText(falseRunnerEvidence));
  const falseRunnerAdjudicationPath = join(scratch, "false-runner-adjudication.json");
  writeFileSync(falseRunnerAdjudicationPath, canonicalText(adjudication(stage1Record, join(stage1, "stage.json"), falseRunnerEvidencePath)));
  if (!finalize(stage1, falseRunnerEvidencePath, falseRunnerAdjudicationPath, 2).includes("exact apparatus and corpus")) throw new Error("finalizer accepted fabricated runner evidence");

  const driftedRunnerCommandEvidencePath = join(scratch, "drifted-runner-command-evidence.json");
  const driftedRunnerCommandEvidence = JSON.parse(readFileSync(evidence1, "utf8"));
  driftedRunnerCommandEvidence.runners.find((runner) => runner.language === "go").command = driftedRunnerCommandEvidence.runners.find((runner) => runner.language === "go").command.filter((part) => !part.endsWith("/protojson_strict.go"));
  writeFileSync(driftedRunnerCommandEvidencePath, canonicalText(driftedRunnerCommandEvidence));
  const driftedRunnerCommandAdjudicationPath = join(scratch, "drifted-runner-command-adjudication.json");
  writeFileSync(driftedRunnerCommandAdjudicationPath, canonicalText(adjudication(stage1Record, join(stage1, "stage.json"), driftedRunnerCommandEvidencePath)));
  if (!finalize(stage1, driftedRunnerCommandEvidencePath, driftedRunnerCommandAdjudicationPath, 2).includes("required command and exact target root")) throw new Error("finalizer accepted one-sided Go runner command drift");

  const missingP3Path = join(scratch, "missing-p3.json");
  writeFileSync(missingP3Path, canonicalText(adjudication(stage1Record, join(stage1, "stage.json"), evidence1, false)));
  if (!finalize(stage1, evidence1, missingP3Path, 2).includes("exact union")) throw new Error("finalizer accepted incomplete P3 adjudication");

  const falseReviewPath = join(scratch, "false-review.json");
  const falseReview = adjudication(stage1Record, join(stage1, "stage.json"), evidence1);
  falseReview.reviews.find((review) => review.role === "authority").rootSha256 = "0".repeat(64);
  writeFileSync(falseReviewPath, canonicalText(falseReview));
  if (!finalize(stage1, evidence1, falseReviewPath, 2).includes("exact stage record")) throw new Error("finalizer accepted a reviewer attestation for another root");

  const sameReviewerPath = join(scratch, "same-reviewer.json");
  const sameReviewer = adjudication(stage1Record, join(stage1, "stage.json"), evidence1);
  for (const review of sameReviewer.reviews) review.reviewer = review.role === "authority" ? " ONE-REVIEWER " : "one-reviewer";
  writeFileSync(sameReviewerPath, canonicalText(sameReviewer));
  if (!finalize(stage1, evidence1, sameReviewerPath, 2).includes("three distinct normalized reviewers")) throw new Error("finalizer accepted one normalized reviewer in all three roles");

  finalize(stage1, evidence1, adjudication1);
  run("node", ["scripts/verify-binding-spec-publications.mjs"]);
  const manifestPath = join(repo, "binding-specs", "publications.json");
  const manifest1 = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest1.publications.length !== 1 || manifest1.modules.length !== 1) throw new Error("@1 publication lost the binding/module closure");
  if (manifest1.modules[0].canonicalUrl !== "https://openbindings.com/binding-spec-modules/protobuf-correspondence/1" || manifest1.modules[0].rawUrl !== "https://openbindings.com/raw/binding-spec-modules/protobuf-correspondence/1.md") throw new Error("module permanent routes are not exact");
  const firstPublicationRecordPath = join(repo, manifest1.publications[0].publicationRecord);
  const firstBundleRoot = join(dirname(firstPublicationRecordPath), "root");
  const archivedEvidencePath = join(dirname(firstPublicationRecordPath), "evidence.json");
  const archivedEvidenceText = readFileSync(archivedEvidencePath, "utf8");
  const archivedCommandDrift = JSON.parse(archivedEvidenceText);
  archivedCommandDrift.gates.find((gate) => gate.id === "grpc-protobuf-oracle").command = ["node", "scripts/archived-drifted-oracle.mjs"];
  writeFileSync(archivedEvidencePath, canonicalText(archivedCommandDrift));
  if (!run("node", ["scripts/verify-binding-spec-publications.mjs"], 1).includes("malformed, duplicate, or unrecognized gate evidence grpc-protobuf-oracle")) throw new Error("publication verifier accepted archived oracle-command drift");
  const archivedFalsePass = JSON.parse(archivedEvidenceText);
  archivedFalsePass.gates.find((gate) => gate.id === "grpc-protobuf-oracle").resultSha256 = "0".repeat(64);
  writeFileSync(archivedEvidencePath, canonicalText(archivedFalsePass));
  if (!run("node", ["scripts/verify-binding-spec-publications.mjs"], 1).includes("gRPC Protobuf oracle gate digest does not bind its canonical observation")) throw new Error("publication verifier accepted an archived oracle gate falsely marked pass");
  writeFileSync(archivedEvidencePath, archivedEvidenceText);
  const archivedOracleResultsPath = join(firstBundleRoot, "conformance", "binding-specs", "grpc-fixtures", "protobuf", "oracle", "oracle-results.json");
  const archivedOracleResults = readFileSync(archivedOracleResultsPath);
  rmSync(archivedOracleResultsPath);
  if (!run("node", ["scripts/verify-binding-spec-publications.mjs"], 1).includes("gRPC Protobuf oracle results is missing")) throw new Error("publication verifier accepted an archived bundle missing oracle results");
  writeFileSync(archivedOracleResultsPath, archivedOracleResults);
  const catalogPath = join(repo, "binding-specs", "README.md");
  const goodCatalog = readFileSync(catalogPath, "utf8");
  writeFileSync(catalogPath, `${goodCatalog}\nNo OpenBindings binding specification has been published yet.\n`);
  if (!run("node", ["scripts/verify-binding-spec-publications.mjs"], 1).includes("inventory-dependent")) throw new Error("publication verifier accepted a stale post-mint catalog status");
  writeFileSync(catalogPath, goodCatalog);
  const releaseGuidePath = join(repo, "RELEASING.md");
  const goodReleaseGuide = readFileSync(releaseGuidePath, "utf8");
  writeFileSync(releaseGuidePath, `${goodReleaseGuide}\nEvery current family document is a mutable candidate; publications.json is empty.\n`);
  if (!run("node", ["scripts/verify-binding-spec-publications.mjs"], 1).includes("inventory-dependent")) throw new Error("publication verifier accepted stale post-mint release guidance");
  writeFileSync(releaseGuidePath, goodReleaseGuide);
  const firstDocument = join(repo, manifest1.publications[0].document);
  const firstDigest = sha256(readFileSync(firstDocument));
  const firstDocumentText = readFileSync(firstDocument, "utf8");
  writeFileSync(firstDocument, firstDocumentText.replace("version **0.2.0**", "version **0.2.1**"));
  const archivedDeclaration = run("node", ["scripts/verify-binding-spec-publications.mjs"], 1);
  if (!archivedDeclaration.includes("Core declaration and normative reference must both name 0.2.0")) throw new Error("verifier accepted archived Core declaration drift");
  writeFileSync(firstDocument, firstDocumentText);
  const firstCore = join(repo, "binding-specs", "releases", "first", "root", "openbindings.md");
  const firstCoreText = readFileSync(firstCore, "utf8");
  writeFileSync(firstCore, firstCoreText.replace("version 0.2.0", "version 0.2.1"));
  const archivedCore = run("node", ["scripts/verify-binding-spec-publications.mjs"], 1);
  if (!archivedCore.includes("archived Core 0.2.1 does not match publication coreRelease 0.2.0")) throw new Error("verifier accepted archived companion Core drift");
  writeFileSync(firstCore, firstCoreText);

  run("git", ["add", "."]);
  run("git", ["commit", "-qm", "publish @1"]);
  const base = run("git", ["rev-parse", "HEAD"]).trim();
  if (!run("node", ["scripts/verify-binding-spec-publications.mjs", "--base", "not-a-commit"], 1).includes("not an available commit")) throw new Error("verifier accepted an unavailable comparison base");

  const releasedCore021 = "# OpenBindings 0.2.1\n\nThis is **version 0.2.1** of the OpenBindings specification.\n";
  write(join(repo, "versions", "0.2.1", "openbindings.md"), releasedCore021);
  run("git", ["add", "."]);
  run("git", ["commit", "-qm", "release Core 0.2.1 snapshot"]);
  run("git", ["tag", "-a", "v0.2.1", "-m", "Core 0.2.1"]);
  configureGrpcModules({ 1: "protobuf-correspondence@1", 2: "protobuf-correspondence@1" });
  const crossCoreCandidate = join(repo, "binding-specs", "candidates", "grpc", "2", "openbindings.grpc.md");
  write(crossCoreCandidate, definingDocument("openbindings.grpc@2", "gRPC @2", false, "openbindings.module.protobuf-correspondence@1", "0.2.1"));
  const crossCoreReuse = run("node", ["scripts/prepare-binding-specification-publication.mjs", "--publication", "cross-core-reuse", "--published-at", "2026-09-06", "--core-version", "0.2.1", "--families", "grpc@2", "--stage", join(scratch, "cross-core-reuse")], 2);
  if (!crossCoreReuse.includes("Core 0.2.0 cannot share a stage whose single Core authority is 0.2.1")) throw new Error("prepare accepted a published module under a different staged Core authority");
  rmSync(join(repo, "binding-specs", "candidates"), { recursive: true, force: true });
  configureGrpcModules({ 1: "protobuf-correspondence@1" });

  const erratumPath = join(repo, "binding-specs", "errata", "grpc", "1", "0001.md");
  write(erratumPath, "# `openbindings.grpc@1` erratum 1\n\nEditorial clarification only.\n");
  const errataPath = join(repo, "binding-specs", "errata.json");
  const errata = { errata: [{ document: "binding-specs/errata/grpc/1/0001.md", id: "openbindings.grpc@1-erratum-1", identifier: "openbindings.grpc@1", publishedAt: "2026-09-06", sha256: sha256(readFileSync(erratumPath)) }], format: "openbindings.binding-spec-errata@1" };
  writeFileSync(errataPath, canonicalText(errata));
  run("node", ["scripts/verify-binding-spec-publications.mjs", "--base", base]);
  run("git", ["add", "."]);
  run("git", ["commit", "-qm", "append erratum"]);
  const errataBase = run("git", ["rev-parse", "HEAD"]).trim();
  errata.errata[0].publishedAt = "2099-01-01";
  writeFileSync(errataPath, canonicalText(errata));
  if (!run("node", ["scripts/verify-binding-spec-publications.mjs", "--base", errataBase], 1).includes("published erratum entry changed")) throw new Error("append-only check accepted erratum mutation");
  errata.errata[0].publishedAt = "2026-09-06";
  writeFileSync(errataPath, canonicalText(errata));

  configureGrpcModules({ 1: "protobuf-correspondence@1", 3: "protobuf-correspondence@1" });
  const skippedPath = join(repo, "binding-specs", "candidates", "grpc", "3", "openbindings.grpc.md");
  write(skippedPath, definingDocument("openbindings.grpc@3", "gRPC @3"));
  const skippedStage = join(scratch, "skipped");
  const skipped = run("node", ["scripts/prepare-binding-specification-publication.mjs", "--publication", "skipped", "--published-at", "2026-09-06", "--core-version", "0.2.0", "--families", "grpc@3", "--stage", skippedStage], 2);
  if (!skipped.includes("not the next revision")) throw new Error("prepare accepted a skipped revision");
  rmSync(join(repo, "binding-specs", "candidates"), { recursive: true, force: true });

  const candidate2 = join(repo, "binding-specs", "candidates", "grpc", "2", "openbindings.grpc.md");
  configureGrpcModules({ 1: "protobuf-correspondence@1", 2: "protobuf-correspondence@3" });
  write(candidate2, definingDocument("openbindings.grpc@2", "gRPC @2", false, "openbindings.module.protobuf-correspondence@3"));
  const skippedModule = join(repo, "binding-specs", "candidates", "modules", "protobuf-correspondence", "3", "openbindings.protobuf-correspondence.md");
  write(skippedModule, definingDocument("openbindings.module.protobuf-correspondence@3", "Protobuf correspondence @3", true));
  const skippedModuleResult = run("node", ["scripts/prepare-binding-specification-publication.mjs", "--publication", "skipped-module", "--published-at", "2026-09-06", "--core-version", "0.2.0", "--families", "grpc@2", "--stage", join(scratch, "skipped-module")], 2);
  if (!skippedModuleResult.includes("not the next module revision")) throw new Error("prepare accepted a skipped module revision");
  rmSync(join(repo, "binding-specs", "candidates"), { recursive: true, force: true });

  configureGrpcModules({ 1: "protobuf-correspondence@1", 2: "protobuf-correspondence@1" });
  write(candidate2, definingDocument("openbindings.grpc@2", "gRPC @2"));
  const reuseStage = join(scratch, "second-reusing-module-1");
  const reuseRecord = prepare("second-reusing-module-1", 2, reuseStage, "2026-09-06");
  if (reuseRecord.modules.length !== 1 || reuseRecord.modules[0].identifier !== "openbindings.module.protobuf-correspondence@1") throw new Error("consumer @2 could not explicitly reuse unchanged module @1");

  configureGrpcModules({ 1: "protobuf-correspondence@1", 2: "protobuf-correspondence@2" });
  writeFileSync(candidate2, definingDocument("openbindings.grpc@2", "gRPC @2", false, "openbindings.module.protobuf-correspondence@2"));
  const moduleCandidate2 = join(repo, "binding-specs", "candidates", "modules", "protobuf-correspondence", "2", "openbindings.protobuf-correspondence.md");
  write(moduleCandidate2, definingDocument("openbindings.module.protobuf-correspondence@2", "Protobuf correspondence @2", true));
  run("node", ["scripts/verify-binding-spec-publications.mjs"]);
  const stage2 = join(scratch, "second");
  const stage2Record = prepare("second", 2, stage2, "2026-09-06");
  const evidence2 = join(scratch, "second-evidence.json");
  evidence(stage2, evidence2);
  const adjudication2 = join(scratch, "second-adjudication.json");
  writeFileSync(adjudication2, canonicalText(adjudication(stage2Record, join(stage2, "stage.json"), evidence2)));
  finalize(stage2, evidence2, adjudication2);
  if (existsSync(candidate2)) throw new Error("finalize left a stale @2 candidate after installing its latest mirror");
  if (existsSync(moduleCandidate2)) throw new Error("finalize left a stale module @2 candidate after installing its latest mirror");
  run("node", ["scripts/verify-binding-spec-publications.mjs", "--base", base]);
  if (sha256(readFileSync(firstDocument)) !== firstDigest) throw new Error("publishing @2 changed archived @1 bytes");
  const manifest2 = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest2.modules.length !== 2 || manifest2.latestModules["protobuf-correspondence"] !== "openbindings.module.protobuf-correspondence@2") throw new Error("module @2 did not publish append-only or become the latest module mirror");
  const firstPublication = JSON.parse(readFileSync(join(repo, manifest2.publications.find((entry) => entry.identifier === "openbindings.grpc@1").publicationRecord), "utf8"));
  if (firstPublication.modules[0].identifier !== "openbindings.module.protobuf-correspondence@1") throw new Error("registering module @2 retroactively reinterpreted grpc @1's module closure");

  configureGrpcModules({ 1: "protobuf-correspondence@1", 2: "protobuf-correspondence@2", 3: "protobuf-correspondence@1" });
  const candidate3 = join(repo, "binding-specs", "candidates", "grpc", "3", "openbindings.grpc.md");
  write(candidate3, definingDocument("openbindings.grpc@3", "gRPC @3", false, "openbindings.module.protobuf-correspondence@1"));
  const stage3 = join(scratch, "third-reusing-module-1");
  const stage3Record = prepare("third-reusing-module-1", 3, stage3, "2026-09-07");
  const evidence3 = join(scratch, "third-evidence.json");
  evidence(stage3, evidence3);
  const adjudication3 = join(scratch, "third-adjudication.json");
  writeFileSync(adjudication3, canonicalText(adjudication(stage3Record, join(stage3, "stage.json"), evidence3)));
  finalize(stage3, evidence3, adjudication3);
  const manifest3 = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest3.latestModules["protobuf-correspondence"] !== "openbindings.module.protobuf-correspondence@2") throw new Error("reusing older module @1 moved the latest module mirror backward");
  configureGrpcModules({ 1: "protobuf-correspondence@2", 2: "protobuf-correspondence@2", 3: "protobuf-correspondence@1" });
  const retroactiveRegistry = run("node", ["scripts/verify-binding-spec-publications.mjs"], 1);
  if (!retroactiveRegistry.includes("module closure")) throw new Error("publication verifier accepted retroactive consumer-revision module reinterpretation");
  configureGrpcModules({ 1: "protobuf-correspondence@1", 2: "protobuf-correspondence@2", 3: "protobuf-correspondence@1" });

  const goodManifest = readFileSync(manifestPath, "utf8");
  const changedManifest = JSON.parse(goodManifest);
  changedManifest.publications.find((entry) => entry.identifier === "openbindings.grpc@1").publishedAt = "2099-01-01";
  writeFileSync(manifestPath, canonicalText(changedManifest));
  const manifestMutation = run("node", ["scripts/verify-binding-spec-publications.mjs", "--base", base], 1);
  if (!manifestMutation.includes("published manifest entry changed")) throw new Error("append-only check accepted manifest mutation");
  writeFileSync(manifestPath, goodManifest);

  const archived = readFileSync(firstDocument, "utf8");
  writeFileSync(firstDocument, `${archived}\nTAMPER\n`);
  const tamper = run("node", ["scripts/verify-binding-spec-publications.mjs"], 1);
  if (!tamper.includes("digest mismatch")) throw new Error("archive verifier accepted bundle tamper");
  writeFileSync(firstDocument, archived);
  run("node", ["scripts/verify-binding-spec-publications.mjs"]);

  console.log("binding-spec publication lifecycle: candidate/released Core separation, annotated-tag proof, pinned schema engine, exact Protobuf oracle closure/evidence, distinct reviews, revision-keyed and cross-Core-safe module @1/@2 closure, candidate cleanup, latest isolation, append-only history, status truth, and tamper rejection: OK");
} finally {
  rmSync(repo, { recursive: true, force: true });
  rmSync(scratch, { recursive: true, force: true });
}
