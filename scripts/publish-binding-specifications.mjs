#!/usr/bin/env node
/** Finalize an exact-byte, independently reviewed binding-specification stage. */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  DEPENDENCY_INSTALL_COMMAND,
  FAMILIES,
  GRPC_RUNNER_COMMANDS,
  REQUIRED_DEPENDENCY_INSTALLS,
  REQUIRED_GATES,
  assertExactCoreAuthority,
  assertManifestGovernedStatus,
  assertPublicationState,
  candidateDocument,
  copyTree,
  dependencyAttestation,
  exactModuleRecord,
  executionResultSha256,
  expectedModuleClosure,
  fail,
  fileRecords,
  grpcApparatusRoot,
  grpcApparatusFileSha256,
  grpcProtobufOracleClosure,
  grpcProtobufOracleEvidence,
  moduleSourceDocument,
  parseArgs,
  readCanonicalJson,
  recordRoot,
  selectedFromIdentifiers,
  sha256,
  workingSnapshot,
  writeCanonicalJson,
} from "./binding-spec-publication-support.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BINDING_ROOT = join(ROOT, "binding-specs");
const RELEASES_ROOT = join(BINDING_ROOT, "releases");
const MANIFEST_PATH = join(BINDING_ROOT, "publications.json");
const DIGEST = /^[0-9a-f]{64}$/;

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function requireExactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  if (!sameJson(Object.keys(value).sort(), [...keys].sort())) fail(`${label} fields differ from the closed format`);
}

function stageDocument(entry, sourcePath, stageRoot) {
  return {
    canonicalUrl: `https://openbindings.com/binding-specs/${entry.family}/${entry.revision}`,
    family: entry.family,
    identifier: entry.identifier,
    path: `root/${entry.document}`,
    rawUrl: `https://openbindings.com/raw/binding-specs/${entry.family}/${entry.revision}.md`,
    revision: entry.revision,
    sha256: sha256(readFileSync(join(stageRoot, entry.document))),
    sourcePath,
  };
}

function coreVersions(markdown) {
  return [...markdown.matchAll(/^This is \*\*version (\d+\.\d+\.\d+)\*\* of the OpenBindings specification\./gm)].map((match) => match[1]);
}

function taggedCoreBytes(version) {
  const tagRef = `refs/tags/v${version}`;
  const type = spawnSync("git", ["cat-file", "-t", tagRef], { cwd: ROOT, encoding: "utf8" });
  if (type.status !== 0 || type.stdout.trim() !== "tag") fail(`Core ${version} is not proven by annotated tag v${version}`);
  const commit = spawnSync("git", ["rev-parse", `${tagRef}^{commit}`], { cwd: ROOT, encoding: "utf8" });
  if (commit.status !== 0) fail(`annotated tag v${version} does not peel to a commit`);
  const sourcePath = `versions/${version}/openbindings.md`;
  const tagged = spawnSync("git", ["show", `${commit.stdout.trim()}:${sourcePath}`], { cwd: ROOT, encoding: null });
  if (tagged.status !== 0) fail(`annotated tag v${version} does not contain immutable ${sourcePath}`);
  if (tagged.stdout.toString("utf8").includes("unreleased working draft")) fail(`immutable Core ${version} snapshot still claims to be an unreleased working draft`);
  return { bytes: tagged.stdout, sourcePath };
}

function verifyStage(stageDir, stage, manifest) {
  requireExactKeys(stage, [
    "apparatusRootSha256", "authoritySha256", "core",
    "corpusRootSha256", "definingDocuments", "files", "format",
    "grpcProcessorCorpusSha256", "identifiers", "modules", "publication",
    "publishedAt", "rootSha256", "sourceFileCount", "sourceHead", "sourceSnapshotSha256", "state",
  ], "stage.json");
  if (stage.format !== "openbindings.binding-spec-publication-stage@3") fail("unsupported stage record; finalization requires a freshly prepared @3 stage");
  if (stage.state !== "prepared-unminted" || stage.core?.lifecycle !== "released") fail("candidate-review evidence does not confer mint eligibility; prepare a fresh stage after the Core release is immutable");
  requireExactKeys(stage.core, ["lifecycle", "path", "sha256", "sourcePath", "version"], "stage Core authority");
  if (stage.core.path !== "root/openbindings.md" || stage.core.sourcePath !== `versions/${stage.core.version}/openbindings.md`) fail("released stage Core paths are not exact");
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(stage.publication || "")) fail("stage publication id is unsafe");
  for (const field of ["apparatusRootSha256", "authoritySha256", "corpusRootSha256", "grpcProcessorCorpusSha256", "rootSha256", "sourceSnapshotSha256"]) {
    if (!DIGEST.test(stage[field] || "")) fail(`stage ${field} must be a SHA-256 digest`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(stage.core.version || "") || !DIGEST.test(stage.core.sha256 || "")) fail("stage Core authority is not exact");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(stage.publishedAt || "")) fail("stage publishedAt must be YYYY-MM-DD");
  if (!Number.isInteger(stage.sourceFileCount) || stage.sourceFileCount < 1) fail("stage sourceFileCount must be a positive integer");
  const stageRoot = join(stageDir, "root");
  const actual = fileRecords(stageRoot, stageDir);
  if (!sameJson(actual, stage.files)) fail("stage file inventory differs from stage.json");
  if (recordRoot(actual) !== stage.rootSha256) fail("stage root digest differs from stage.json");
  const taggedCore = taggedCoreBytes(stage.core.version);
  const worktreeCorePath = join(ROOT, taggedCore.sourcePath);
  if (!existsSync(worktreeCorePath) || !readFileSync(worktreeCorePath).equals(taggedCore.bytes)) fail(`${taggedCore.sourcePath} differs from annotated tag v${stage.core.version}`);
  const stagedCore = readFileSync(join(stageRoot, "openbindings.md"));
  if (sha256(stagedCore) !== stage.core.sha256 || !stagedCore.equals(taggedCore.bytes)) fail("stage Core bytes are not the exact immutable tagged release snapshot");
  if (!sameJson(coreVersions(stagedCore.toString("utf8")), [stage.core.version])) fail("stage Core text does not declare the recorded authority version exactly once");
  assertManifestGovernedStatus(
    readFileSync(join(stageRoot, "binding-specs", "README.md"), "utf8"),
    readFileSync(join(stageRoot, "RELEASING.md"), "utf8"),
  );
  if (sha256(readFileSync(join(stageRoot, "binding-specs", "AUTHORITY-PINS.json"))) !== stage.authoritySha256) fail("stage authority digest mismatch");
  if (sha256(readFileSync(join(stageRoot, "conformance", "binding-specs", "processor", "grpc.json"))) !== stage.grpcProcessorCorpusSha256) fail("stage gRPC processor corpus digest mismatch");
  for (const path of [
    "scripts/count-binding-spec-scenarios.mjs",
    "scripts/verify-binding-specs.mjs",
    "scripts/verify-binding-spec-publications.mjs",
    "scripts/verify-grpc-binding-runners.mjs",
    "scripts/verify-grpc-ds-witness.mjs",
    "scripts/verify-grpc-protobuf-compiler.mjs",
    "scripts/verify-grpc-protobuf-oracle.mjs",
    "scripts/verify-grpc-protobuf-values.mjs",
    "scripts/verify-grpc-tls-fixtures.mjs",
    "conformance/binding-specs/schema-engine/package-lock.json",
    "conformance/binding-specs/schema-engine/package.json",
  ]) if (!existsSync(join(stageRoot, path))) fail(`stage lacks runnable verifier dependency ${path}`);
  for (const id of Object.keys(REQUIRED_DEPENDENCY_INSTALLS)) dependencyAttestation(stageRoot, id);
  const stagedOracleClosure = grpcProtobufOracleClosure(stageRoot);
  const sourceOracleClosure = grpcProtobufOracleClosure(ROOT);
  if (!sameJson(stagedOracleClosure, sourceOracleClosure)) fail("staged gRPC Protobuf oracle differs from the exact source authority, harness, source, case, result, or counts");

  const selected = selectedFromIdentifiers(stage.identifiers);
  const expectedDocuments = selected.map((entry) => stageDocument(
    entry,
    candidateDocument(ROOT, entry.family, entry.revision, manifest),
    stageRoot,
  )).sort((a, b) => a.identifier.localeCompare(b.identifier));
  if (!sameJson(stage.definingDocuments, expectedDocuments)) fail("stage defining-document closure is not the independently derived exact closure");
  for (const document of expectedDocuments) {
    const bytes = readFileSync(join(stageDir, document.path));
    const markdown = bytes.toString("utf8");
    assertPublicationState(markdown, document.identifier);
    assertExactCoreAuthority(markdown, document.identifier, stage.core.version);
    const source = join(ROOT, document.sourcePath);
    if (!existsSync(source) || !readFileSync(source).equals(bytes)) fail(`${document.identifier}: staged defining bytes differ from their candidate source`);
  }

  const derivedModules = expectedModuleClosure(stage.identifiers).map((module) => ({
    ...module,
    sourceDocument: moduleSourceDocument(module.module, module.revision, manifest),
  }));
  for (const module of derivedModules) if (!existsSync(join(stageRoot, module.document))) fail(`stage normative-module closure is missing ${module.identifier}`);
  const existingModules = new Map((manifest.modules || []).map((entry) => [entry.identifier, entry]));
  for (const module of derivedModules) {
    if (!existingModules.has(module.identifier)) {
      const revisions = (manifest.modules || []).filter((entry) => entry.module === module.module).map((entry) => entry.revision);
      const expected = revisions.length === 0 ? 1 : Math.max(...revisions) + 1;
      if (module.revision !== expected) fail(`${module.identifier} is not the next module revision; expected @${expected}`);
    }
  }
  const expectedModules = derivedModules.map((module) => exactModuleRecord(module, stageRoot, "root/", module.sourceDocument));
  if (!sameJson(stage.modules, expectedModules)) fail("stage normative-module closure is not the independently derived exact closure");
  for (const module of expectedModules) {
    const bytes = readFileSync(join(stageDir, module.path));
    const markdown = bytes.toString("utf8");
    assertPublicationState(markdown, module.identifier);
    assertExactCoreAuthority(markdown, module.identifier, stage.core.version);
    const source = join(ROOT, module.sourcePath);
    if (!existsSync(source) || !readFileSync(source).equals(bytes)) fail(`${module.identifier}: staged module bytes differ from the authoritative source module`);
  }
  for (const document of expectedDocuments) {
    const markdown = readFileSync(join(stageDir, document.path), "utf8");
    for (const module of expectedModules.filter((candidate) => candidate.consumers.includes(document.identifier))) {
      const route = `/binding-spec-modules/${module.module}/${module.revision}`;
      if (!markdown.includes(`](${route})`) || /\]\(\.\.\/modules\/openbindings\./.test(markdown)) fail(`${document.identifier}: normative module citation must use permanent route ${route}`);
    }
  }

  const apparatus = readCanonicalJson(join(stageRoot, "conformance", "binding-specs", "grpc-apparatus.manifest.json"), "staged gRPC apparatus manifest");
  if (!Array.isArray(apparatus.files)) fail("staged gRPC apparatus manifest lacks files");
  const paths = new Set();
  for (const file of apparatus.files) {
    if (paths.has(file.path)) fail(`staged gRPC apparatus repeats ${file.path}`);
    paths.add(file.path);
    const path = join(stageRoot, file.path);
    if (!existsSync(path) || grpcApparatusFileSha256(stageRoot, file) !== file.sha256) fail(`staged gRPC apparatus mismatch at ${file.path}`);
  }
  if (grpcApparatusRoot(apparatus) !== stage.apparatusRootSha256) fail("stage apparatus root is not derived from the closed apparatus manifest");
  return { expectedDocuments, expectedModules, stageRoot };
}

function execute(command, cwd, environment = process.env) {
  const result = spawnSync(command[0], command.slice(1), { cwd, encoding: "utf8", env: environment });
  return {
    exitCode: result.status ?? 1,
    resultSha256: executionResultSha256(result.stdout || ""),
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function verifyExecution(record, expected, label, cwd, environment) {
  requireExactKeys(record, expected.keys, label);
  if (!sameJson(record.command, expected.command) || record.id !== expected.id || record.target !== expected.target || record.targetRootSha256 !== expected.targetRootSha256) fail(`${label} is not bound to the required command and exact target root`);
  if (record.status !== "pass" || record.exitCode !== 0 || !DIGEST.test(record.resultSha256 || "")) fail(`${label} is not a complete passing execution record`);
  const actual = execute(record.command, cwd, environment);
  if (actual.exitCode !== 0) fail(`${label} did not pass at finalization: ${(actual.stderr || actual.stdout).trim()}`);
  if (actual.resultSha256 !== record.resultSha256) fail(`${label} result digest differs when re-run at finalization`);
  return actual.stdout;
}

function verifyEvidence(evidence, stage, stageRecordSha256, stageRoot) {
  requireExactKeys(evidence, ["dependencyInstalls", "format", "gates", "oracle", "publication", "runners", "stageRecordSha256"], "evidence");
  if (evidence.format !== "openbindings.binding-spec-publication-evidence@1" || evidence.publication !== stage.publication || evidence.stageRecordSha256 !== stageRecordSha256) fail("evidence does not bind the exact stage record");
  const installs = Array.isArray(evidence.dependencyInstalls) ? evidence.dependencyInstalls : [];
  if (installs.length !== Object.keys(REQUIRED_DEPENDENCY_INSTALLS).length) fail("evidence dependency-install set is not closed");
  const ephemeralNodeModules = [];
  try {
    for (const id of Object.keys(REQUIRED_DEPENDENCY_INSTALLS).sort()) {
      const matches = installs.filter((install) => install?.id === id);
      if (matches.length !== 1) fail(`evidence requires exactly one ${id}`);
      const before = dependencyAttestation(stageRoot, id);
      const installRoot = join(stageRoot, before.directory);
      const nodeModules = join(installRoot, "node_modules");
      ephemeralNodeModules.push(nodeModules);
      rmSync(nodeModules, { recursive: true, force: true });
      verifyExecution(matches[0], {
        command: DEPENDENCY_INSTALL_COMMAND,
        id,
        keys: ["command", "dependencies", "directory", "exitCode", "id", "packageLockSha256", "packageSha256", "resultSha256", "status", "target", "targetRootSha256"],
        target: "stage",
        targetRootSha256: stage.rootSha256,
      }, `${id} dependency install`, installRoot);
      const after = dependencyAttestation(stageRoot, id, true);
      if (matches[0].directory !== after.directory || !sameJson(matches[0].dependencies, after.dependencies) || matches[0].packageSha256 !== after.packageSha256 || matches[0].packageLockSha256 !== after.packageLockSha256) fail(`${id} does not attest the exact staged package, lockfile, and installed versions`);
    }
    if (!Array.isArray(evidence.gates)) fail("evidence gates must be an array");
    let oracle;
    for (const [id, rule] of Object.entries(REQUIRED_GATES)) {
      const matches = evidence.gates.filter((gate) => gate?.id === id);
      if (matches.length !== 1) fail(`evidence requires exactly one ${id} gate`);
      const stdout = verifyExecution(matches[0], {
        command: rule.command,
        id,
        keys: ["command", "exitCode", "id", "resultSha256", "status", "target", "targetRootSha256"],
        target: rule.target,
        targetRootSha256: rule.target === "stage" ? stage.rootSha256 : stage.sourceSnapshotSha256,
      }, `${id} gate`, rule.target === "stage" ? stageRoot : ROOT);
      if (id === "grpc-protobuf-oracle") oracle = grpcProtobufOracleEvidence(stageRoot, stdout);
    }
    if (evidence.gates.length !== Object.keys(REQUIRED_GATES).length) fail("evidence contains an unrecognized or duplicate gate");
    if (!oracle || !sameJson(evidence.oracle, oracle)) fail("evidence does not bind the exact gRPC Protobuf oracle authority, harness, source, case, result, and toolchain observation");

    if (!Array.isArray(evidence.runners)) fail("evidence runners must be an array");
    const outputs = {};
    for (const [language, command] of Object.entries(GRPC_RUNNER_COMMANDS)) {
      const matches = evidence.runners.filter((runner) => runner?.language === language);
      if (matches.length !== 1) fail(`evidence requires exactly one ${language} runner`);
      const environment = language === "go" ? { ...process.env, GOCACHE: "/private/tmp/openbindings-grpc-go-build-cache" } : process.env;
      outputs[language] = verifyExecution(matches[0], {
        command,
        id: `grpc-runner-${language}`,
        keys: ["apparatusRootSha256", "command", "corpusSha256", "exitCode", "id", "language", "resultSha256", "status", "target", "targetRootSha256"],
        target: "stage",
        targetRootSha256: stage.rootSha256,
      }, `${language} runner`, stageRoot, environment);
      if (matches[0].apparatusRootSha256 !== stage.apparatusRootSha256 || matches[0].corpusSha256 !== stage.grpcProcessorCorpusSha256) fail(`${language} runner does not bind the exact apparatus and corpus`);
    }
    if (evidence.runners.length !== 2 || outputs.go !== outputs.typescript) fail("runner evidence does not establish Go/TypeScript output parity");
  } finally {
    for (const path of ephemeralNodeModules) rmSync(path, { recursive: true, force: true });
  }
}

function verifyAdjudication(adjudication, evidenceSha256, stage, stageRecordSha256) {
  requireExactKeys(adjudication, ["evidenceSha256", "format", "identifiers", "p3Dispositions", "publication", "reviews", "rootSha256", "stageRecordSha256", "unresolvedP0P2"], "adjudication");
  if (adjudication.format !== "openbindings.binding-spec-publication-adjudication@2") fail("unsupported adjudication format");
  if (adjudication.evidenceSha256 !== evidenceSha256 || adjudication.publication !== stage.publication || adjudication.rootSha256 !== stage.rootSha256 || adjudication.stageRecordSha256 !== stageRecordSha256 || !sameJson(adjudication.identifiers, stage.identifiers)) fail("adjudication does not bind the exact reviewed stage and evidence");
  if (adjudication.unresolvedP0P2 !== 0) fail("adjudication has unresolved P0-P2 findings");
  if (!Array.isArray(adjudication.reviews) || !Array.isArray(adjudication.p3Dispositions)) fail("adjudication lacks closed review/disposition arrays");
  const p3 = new Set();
  const findingIds = new Set();
  const reviewerIds = new Set();
  for (const role of ["authority", "conformance", "publisher"]) {
    const matches = adjudication.reviews.filter((review) => review?.role === role);
    if (matches.length !== 1) fail(`adjudication requires exactly one ${role} review`);
    const review = matches[0];
    requireExactKeys(review, ["findings", "recordedAt", "reviewer", "role", "rootSha256", "stageRecordSha256", "unresolved", "verdict"], `${role} review`);
    if (review.verdict !== "ACCEPT" || review.rootSha256 !== stage.rootSha256 || review.stageRecordSha256 !== stageRecordSha256 || typeof review.reviewer !== "string" || !review.reviewer || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(review.recordedAt || "") || Number.isNaN(Date.parse(review.recordedAt))) fail(`${role} review is not a named, dated ACCEPT of the exact stage record`);
    reviewerIds.add(review.reviewer.normalize("NFKC").trim().toLowerCase());
    if (!Array.isArray(review.findings)) fail(`${role} review findings must be an array`);
    const derived = { p0: 0, p1: 0, p2: 0 };
    for (const finding of review.findings) {
      requireExactKeys(finding, ["id", "severity", "status", "summary"], `${role} finding`);
      if (findingIds.has(finding.id)) fail(`duplicate review finding id ${finding.id}`);
      findingIds.add(finding.id);
      if (!/^[A-Z][A-Z0-9-]+$/.test(finding.id || "") || !["p0", "p1", "p2", "p3"].includes(finding.severity) || !["open", "resolved"].includes(finding.status) || typeof finding.summary !== "string" || !finding.summary) fail(`${role} review contains a malformed finding`);
      if (finding.severity === "p3") p3.add(finding.id);
      else if (finding.status === "open") derived[finding.severity]++;
    }
    requireExactKeys(review.unresolved, ["p0", "p1", "p2"], `${role} unresolved counts`);
    if (!sameJson(review.unresolved, derived) || Object.values(derived).some((count) => count !== 0)) fail(`${role} review has unresolved P0-P2 findings or false counts`);
  }
  if (adjudication.reviews.length !== 3) fail("adjudication contains an unrecognized or duplicate review role");
  if (reviewerIds.size !== 3) fail("authority, conformance, and publisher reviews must name three distinct normalized reviewers");
  const dispositions = new Set();
  for (const disposition of adjudication.p3Dispositions) {
    requireExactKeys(disposition, ["decision", "id", "rationale"], "P3 disposition");
    if (dispositions.has(disposition.id) || !p3.has(disposition.id)) fail(`orphan or duplicate P3 disposition ${disposition.id}`);
    if (!["accepted", "deferred", "resolved"].includes(disposition.decision) || typeof disposition.rationale !== "string" || !disposition.rationale) fail(`P3 disposition ${disposition.id} is incomplete`);
    dispositions.add(disposition.id);
  }
  if (dispositions.size !== p3.size || [...p3].some((id) => !dispositions.has(id))) fail("P3 dispositions are not the exact union of reviewer P3 findings");
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (!args["from-stage"] || !args.evidence || !args.adjudication) fail("--from-stage, --evidence, and --adjudication are required");
  const stageDir = resolve(args["from-stage"]);
  const stagePath = join(stageDir, "stage.json");
  const evidenceSource = resolve(ROOT, args.evidence);
  const adjudicationSource = resolve(ROOT, args.adjudication);
  for (const [label, path] of [["stage record", stagePath], ["evidence record", evidenceSource], ["adjudication record", adjudicationSource]]) if (!existsSync(path)) fail(`${label} not found: ${path}`);
  const stage = readCanonicalJson(stagePath, "stage.json");
  const originalManifest = readFileSync(MANIFEST_PATH);
  const manifest = JSON.parse(originalManifest.toString("utf8"));
  const { expectedDocuments, expectedModules, stageRoot } = verifyStage(stageDir, stage, manifest);
  const stageRecordSha256 = sha256(readFileSync(stagePath));
  const evidence = readCanonicalJson(evidenceSource, args.evidence);
  verifyEvidence(evidence, stage, stageRecordSha256, stageRoot);
  const evidenceSha256 = sha256(readFileSync(evidenceSource));
  const adjudication = readCanonicalJson(adjudicationSource, args.adjudication);
  verifyAdjudication(adjudication, evidenceSha256, stage, stageRecordSha256);

  const excluded = [evidenceSource, adjudicationSource]
    .map((path) => relative(ROOT, path).split("\\").join("/"))
    .filter((path) => !path.startsWith("../"));
  const snapshot = workingSnapshot(ROOT, excluded);
  if (snapshot.head !== stage.sourceHead || snapshot.sha256 !== stage.sourceSnapshotSha256 || snapshot.files !== stage.sourceFileCount) fail("repository source snapshot changed after the reviewed stage was prepared");
  if (manifest.format !== "openbindings.binding-spec-publications@1") fail(`unsupported manifest format ${manifest.format}`);
  const publishedIds = new Set((manifest.publications || []).map((entry) => entry.identifier));
  for (const identifier of stage.identifiers) if (publishedIds.has(identifier)) fail(`${identifier} is already published`);

  const publicationDir = join(RELEASES_ROOT, stage.publication);
  if (existsSync(publicationDir)) fail(`publication already exists: ${publicationDir}`);
  const tempDir = `${publicationDir}.${process.pid}.tmp`;
  const originalMirrors = new Map();
  const consumedCandidates = new Map();
  const consumedModuleCandidates = new Map();
  const manifestTemp = `${MANIFEST_PATH}.${process.pid}.tmp`;
  mkdirSync(tempDir, { recursive: true });
  try {
    copyTree(stageRoot, join(tempDir, "root"));
    copyFileSync(stagePath, join(tempDir, "stage.json"));
    copyFileSync(evidenceSource, join(tempDir, "evidence.json"));
    copyFileSync(adjudicationSource, join(tempDir, "adjudication.json"));
    const files = fileRecords(join(tempDir, "root"), tempDir);
    if (!sameJson(files, stage.files)) fail("copied release root differs from reviewed stage");
    const record = {
      adjudication: { path: "adjudication.json", sha256: sha256(readFileSync(adjudicationSource)) },
      coreRelease: stage.core.version,
      evidence: { path: "evidence.json", sha256: evidenceSha256 },
      files,
      format: "openbindings.binding-spec-publication@3",
      identifiers: stage.identifiers,
      modules: stage.modules,
      publication: stage.publication,
      publishedAt: stage.publishedAt,
      rootSha256: stage.rootSha256,
      stage: { path: "stage.json", sha256: stageRecordSha256 },
    };
    writeCanonicalJson(join(tempDir, "publication.json"), record);
    mkdirSync(RELEASES_ROOT, { recursive: true });
    renameSync(tempDir, publicationDir);

    manifest.publications ||= [];
    manifest.modules ||= [];
    manifest.latest ||= {};
    manifest.latestModules ||= {};
    const recordPath = relative(ROOT, join(publicationDir, "publication.json")).split("\\").join("/");
    const recordDigest = sha256(readFileSync(join(publicationDir, "publication.json")));
    for (const document of expectedDocuments) {
      const archivedDocument = relative(ROOT, join(publicationDir, document.path)).split("\\").join("/");
      const moduleRefs = expectedModules.filter((module) => module.consumers.includes(document.identifier)).map(({ identifier, sha256: digest }) => ({ identifier, sha256: digest }));
      manifest.publications.push({
        canonicalUrl: document.canonicalUrl,
        coreRelease: stage.core.version,
        document: archivedDocument,
        family: document.family,
        identifier: document.identifier,
        modules: moduleRefs,
        publication: stage.publication,
        publicationRecord: recordPath,
        publicationRecordSha256: recordDigest,
        publishedAt: stage.publishedAt,
        rawUrl: document.rawUrl,
        revision: document.revision,
      });
      manifest.latest[document.family] = document.identifier;
      const mirror = join(ROOT, FAMILIES[document.family].document);
      originalMirrors.set(mirror, readFileSync(mirror));
      if (document.sourcePath !== FAMILIES[document.family].document) {
        consumedCandidates.set(join(ROOT, document.sourcePath), readFileSync(join(ROOT, document.sourcePath)));
      }
      copyFileSync(join(stageDir, document.path), `${mirror}.${process.pid}.tmp`);
      renameSync(`${mirror}.${process.pid}.tmp`, mirror);
    }
    const existingModules = new Map(manifest.modules.map((module) => [module.identifier, module]));
    for (const module of expectedModules) {
      const existing = existingModules.get(module.identifier);
      if (existing && existing.sha256 !== module.sha256) fail(`${module.identifier}: same module revision has different bytes`);
      if (!existing) {
        manifest.modules.push({
          canonicalUrl: module.canonicalUrl,
          document: relative(ROOT, join(publicationDir, module.path)).split("\\").join("/"),
          identifier: module.identifier,
          module: module.module,
          publication: stage.publication,
          publicationRecord: recordPath,
          publicationRecordSha256: recordDigest,
          publishedAt: stage.publishedAt,
          rawUrl: module.rawUrl,
          revision: module.revision,
          sha256: module.sha256,
        });
        manifest.latestModules[module.module] = module.identifier;
        const mirror = join(ROOT, "binding-specs", "modules", `openbindings.${module.module}.md`);
        originalMirrors.set(mirror, readFileSync(mirror));
        if (module.sourcePath !== `binding-specs/modules/openbindings.${module.module}.md`) {
          consumedModuleCandidates.set(join(ROOT, module.sourcePath), readFileSync(join(ROOT, module.sourcePath)));
        }
        copyFileSync(join(stageDir, module.path), `${mirror}.${process.pid}.tmp`);
        renameSync(`${mirror}.${process.pid}.tmp`, mirror);
      }
    }
    manifest.publications.sort((a, b) => a.identifier.localeCompare(b.identifier));
    manifest.modules.sort((a, b) => a.identifier.localeCompare(b.identifier));
    manifest.latest = Object.fromEntries(Object.entries(manifest.latest).sort(([a], [b]) => a.localeCompare(b)));
    manifest.latestModules = Object.fromEntries(Object.entries(manifest.latestModules).sort(([a], [b]) => a.localeCompare(b)));
    manifest.floor ||= { publications: 0 };
    manifest.floor.publications = manifest.publications.length;
    manifest.floor.modules = manifest.modules.length;
    writeCanonicalJson(manifestTemp, manifest);
    renameSync(manifestTemp, MANIFEST_PATH);
    for (const document of expectedDocuments) {
      if (document.sourcePath !== FAMILIES[document.family].document) rmSync(join(ROOT, document.sourcePath), { force: true });
    }
    for (const module of expectedModules) {
      if (!existingModules.has(module.identifier) && module.sourcePath !== `binding-specs/modules/openbindings.${module.module}.md`) rmSync(join(ROOT, module.sourcePath), { force: true });
    }
    console.log(`published ${stage.identifiers.join(", ")} from reviewed stage ${stage.rootSha256}`);
  } catch (error) {
    rmSync(manifestTemp, { force: true });
    rmSync(tempDir, { recursive: true, force: true });
    rmSync(publicationDir, { recursive: true, force: true });
    writeFileSync(MANIFEST_PATH, originalManifest);
    for (const [path, bytes] of originalMirrors) writeFileSync(path, bytes);
    for (const [path, bytes] of consumedCandidates) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, bytes);
    }
    for (const [path, bytes] of consumedModuleCandidates) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, bytes);
    }
    throw error;
  }
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(2);
}
