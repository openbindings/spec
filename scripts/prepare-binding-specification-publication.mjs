#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  PUBLICATION_CATALOG_ENTRIES,
  REQUIRED_DEPENDENCY_INSTALLS,
  assertExactCoreAuthority,
  assertManifestGovernedStatus,
  assertPublicationState,
  candidateDocument,
  copyTree,
  dependencyAttestation,
  exactModuleRecord,
  fail,
  fileRecords,
  grpcApparatusRoot,
  grpcProtobufOracleClosure,
  moduleClosure,
  moduleSourceDocument,
  parseArgs,
  parseSelected,
  readCanonicalJson,
  recordRoot,
  sha256,
  workingSnapshot,
  writeCanonicalJson,
} from "./binding-spec-publication-support.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = join(ROOT, "binding-specs", "publications.json");

function coreVersions(markdown) {
  return [...markdown.matchAll(/^This is \*\*version (\d+\.\d+\.\d+)\*\* of the OpenBindings specification\./gm)].map((match) => match[1]);
}

function git(args, encoding = "utf8") {
  return spawnSync("git", args, { cwd: ROOT, encoding });
}

function coreAuthority(version) {
  const sourcePath = `versions/${version}/openbindings.md`;
  const worktreePath = join(ROOT, sourcePath);
  const tagRef = `refs/tags/v${version}`;
  const tagType = git(["cat-file", "-t", tagRef]);
  const hasTag = tagType.status === 0;
  const hasSnapshot = existsSync(worktreePath);
  if (hasTag !== hasSnapshot) fail(`Core ${version} release proof is incomplete: immutable snapshot and annotated v${version} tag must appear together`);
  if (!hasTag) {
    const candidatePath = join(ROOT, "openbindings.md");
    const bytes = readFileSync(candidatePath);
    const text = bytes.toString("utf8");
    if (!text.includes("This text is the unreleased working draft of that version")) fail(`Core ${version} has neither complete release proof nor the canonical unreleased-working-draft declaration`);
    return { bytes, lifecycle: "unreleased-candidate", sourcePath: "openbindings.md" };
  }
  if (tagType.stdout.trim() !== "tag") fail(`v${version} must be an annotated tag`);
  const commit = git(["rev-parse", `${tagRef}^{commit}`]);
  if (commit.status !== 0) fail(`v${version} does not peel to a commit`);
  const tagged = git(["show", `${commit.stdout.trim()}:${sourcePath}`], null);
  if (tagged.status !== 0) fail(`v${version} does not contain immutable ${sourcePath}`);
  if (tagged.stdout.toString("utf8").includes("unreleased working draft")) fail(`immutable Core ${version} snapshot still claims to be an unreleased working draft`);
  const worktreeBytes = readFileSync(worktreePath);
  if (!worktreeBytes.equals(tagged.stdout)) fail(`${sourcePath} differs from the bytes in annotated tag v${version}`);
  return { bytes: tagged.stdout, lifecycle: "released", sourcePath };
}

try {
  const args = parseArgs(process.argv.slice(2));
  const publication = args.publication;
  const publishedAt = args["published-at"];
  const coreVersion = args["core-version"];
  const stageDir = resolve(args.stage || "");
  if (!publication || !/^[a-z0-9][a-z0-9.-]*$/.test(publication)) fail("--publication must be a stable lowercase publication id");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt || "")) fail("--published-at must be YYYY-MM-DD");
  if (args["core-release"] !== undefined) fail("--core-release is not valid for review preparation; use --core-version because an authority version is not necessarily released");
  if (!/^\d+\.\d+\.\d+$/.test(coreVersion || "")) fail("--core-version must be X.Y.Z");
  if (!args.stage || stageDir === ROOT || stageDir.startsWith(`${ROOT}${sep}`)) fail("--stage must name a new directory outside the repository");
  if (existsSync(stageDir)) fail(`stage already exists: ${stageDir}`);

  const selected = parseSelected(args.families);
  const modules = moduleClosure(selected);
  const core = coreAuthority(coreVersion);
  const coreLifecycle = core.lifecycle;
  const coreBytes = core.bytes;
  const versions = coreVersions(coreBytes.toString("utf8"));
  if (versions.length !== 1 || versions[0] !== coreVersion) fail(`--core-version ${coreVersion} does not match ${core.sourcePath}`);

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  assertManifestGovernedStatus(
    readFileSync(join(ROOT, "binding-specs", "README.md"), "utf8"),
    readFileSync(join(ROOT, "RELEASING.md"), "utf8"),
  );
  for (const id of Object.keys(REQUIRED_DEPENDENCY_INSTALLS)) dependencyAttestation(ROOT, id);
  const publishedIds = new Set((manifest.publications || []).map((entry) => entry.identifier));
  for (const entry of selected) {
    if (publishedIds.has(entry.identifier)) fail(`${entry.identifier} is already published`);
    const revisions = (manifest.publications || []).filter((prior) => prior.family === entry.family).map((prior) => prior.revision);
    const expected = revisions.length === 0 ? 1 : Math.max(...revisions) + 1;
    if (entry.revision !== expected) fail(`${entry.identifier} is not the next revision; expected @${expected}`);
    entry.sourceDocument = candidateDocument(ROOT, entry.family, entry.revision, manifest);
    const sourcePath = join(ROOT, entry.sourceDocument);
    if (!existsSync(sourcePath)) fail(`${entry.identifier}: candidate document does not exist at ${entry.sourceDocument}`);
    const text = readFileSync(sourcePath, "utf8");
    assertPublicationState(text, entry.identifier);
    assertExactCoreAuthority(text, entry.identifier, coreVersion);
    for (const module of modules.filter((candidate) => candidate.consumers.includes(entry.identifier))) {
      const route = `/binding-spec-modules/${module.module}/${module.revision}`;
      if (!text.includes(`](${route})`) || /\]\(\.\.\/modules\/openbindings\./.test(text)) fail(`${entry.identifier}: normative module citation must use permanent route ${route}`);
    }
  }

  const existingModules = new Map((manifest.modules || []).map((entry) => [entry.identifier, entry]));
  for (const module of modules) {
    module.sourceDocument = moduleSourceDocument(module.module, module.revision, manifest);
    const sourcePath = join(ROOT, module.sourceDocument);
    if (!existsSync(sourcePath)) fail(`${module.identifier}: module source does not exist at ${module.sourceDocument}`);
    const text = readFileSync(sourcePath, "utf8");
    assertPublicationState(text, module.identifier);
    const existing = existingModules.get(module.identifier);
    if (existing) {
      if (sha256(readFileSync(sourcePath)) !== existing.sha256) fail(`${module.identifier}: published module source differs from its immutable bytes`);
      const mintingPublication = (manifest.publications || []).find((entry) => entry.publication === existing.publication);
      if (!mintingPublication?.coreRelease) fail(`${module.identifier}: cannot derive the module's Core authority from its minting publication`);
      if (mintingPublication.coreRelease !== coreVersion) fail(`${module.identifier}: Core ${mintingPublication.coreRelease} cannot share a stage whose single Core authority is ${coreVersion}; publish a new module revision`);
      assertExactCoreAuthority(text, module.identifier, mintingPublication.coreRelease);
    } else {
      const revisions = (manifest.modules || []).filter((entry) => entry.module === module.module).map((entry) => entry.revision);
      const expected = revisions.length === 0 ? 1 : Math.max(...revisions) + 1;
      if (module.revision !== expected) fail(`${module.identifier} is not the next module revision; expected @${expected}`);
      assertExactCoreAuthority(text, module.identifier, coreVersion);
    }
  }

  const snapshot = workingSnapshot(ROOT);
  const rootDir = join(stageDir, "root");
  mkdirSync(rootDir, { recursive: true });
  for (const file of ["openbindings.md", "openbindings.schema.json", "EDITORS.md", "RELEASING.md"]) {
    copyTree(ROOT, rootDir, (rel) => rel === file);
  }
  copyFileSync(join(ROOT, core.sourcePath), join(rootDir, "openbindings.md"));
  copyTree(join(ROOT, "binding-specs"), join(rootDir, "binding-specs"), (rel) => {
    const first = rel.split(/[\\/]/)[0];
    return first !== "releases" && PUBLICATION_CATALOG_ENTRIES.has(first) && !rel.split(/[\\/]/).includes(".DS_Store");
  });
  copyTree(join(ROOT, "conformance"), join(rootDir, "conformance"));
  copyTree(join(ROOT, "scripts"), join(rootDir, "scripts"));

  // The first revision is authored at the mutable family path. Later
  // candidates live beside it so the latest published mirror can remain
  // byte-identical to its immutable archive until this transaction commits.
  for (const entry of selected) {
    const sourcePath = join(ROOT, entry.sourceDocument);
    const stagedPath = join(rootDir, entry.document);
    mkdirSync(dirname(stagedPath), { recursive: true });
    copyFileSync(sourcePath, stagedPath);
    if (!readFileSync(sourcePath).equals(readFileSync(stagedPath))) fail(`${entry.identifier}: prepare changed defining bytes`);
  }

  for (const module of modules) {
    const stagedPath = join(rootDir, module.document);
    mkdirSync(dirname(stagedPath), { recursive: true });
    copyFileSync(join(ROOT, module.sourceDocument), stagedPath);
    if (!readFileSync(join(ROOT, module.sourceDocument)).equals(readFileSync(stagedPath))) fail(`${module.identifier}: prepare changed module defining bytes`);
    const existing = existingModules.get(module.identifier);
    if (existing) {
      const digest = sha256(readFileSync(stagedPath));
      if (digest !== existing.sha256) fail(`${module.identifier}: live module differs from its published bytes`);
    }
  }

  grpcProtobufOracleClosure(rootDir);

  const files = fileRecords(rootDir, stageDir);
  const definingDocuments = selected.map((entry) => ({
    canonicalUrl: `https://openbindings.com/binding-specs/${entry.family}/${entry.revision}`,
    family: entry.family,
    identifier: entry.identifier,
    path: `root/${entry.document}`,
    rawUrl: `https://openbindings.com/raw/binding-specs/${entry.family}/${entry.revision}.md`,
    revision: entry.revision,
    sha256: sha256(readFileSync(join(rootDir, entry.document))),
    sourcePath: entry.sourceDocument,
  })).sort((a, b) => a.identifier.localeCompare(b.identifier));
  const moduleRecords = modules.map((module) => exactModuleRecord(module, rootDir, "root/", module.sourceDocument));
  const corpusRecords = files.filter((entry) => entry.path.startsWith("root/conformance/"));
  const apparatusManifest = readCanonicalJson(join(rootDir, "conformance", "binding-specs", "grpc-apparatus.manifest.json"), "staged gRPC apparatus manifest");
  const stage = {
    apparatusRootSha256: grpcApparatusRoot(apparatusManifest),
    authoritySha256: sha256(readFileSync(join(rootDir, "binding-specs", "AUTHORITY-PINS.json"))),
    core: {
      lifecycle: coreLifecycle,
      path: "root/openbindings.md",
      sha256: sha256(readFileSync(join(rootDir, "openbindings.md"))),
      sourcePath: core.sourcePath,
      version: coreVersion,
    },
    corpusRootSha256: recordRoot(corpusRecords),
    definingDocuments,
    files,
    format: "openbindings.binding-spec-publication-stage@3",
    grpcProcessorCorpusSha256: sha256(readFileSync(join(rootDir, "conformance", "binding-specs", "processor", "grpc.json"))),
    identifiers: selected.map((entry) => entry.identifier).sort(),
    modules: moduleRecords,
    publication,
    publishedAt,
    rootSha256: recordRoot(files),
    sourceFileCount: snapshot.files,
    sourceHead: snapshot.head,
    sourceSnapshotSha256: snapshot.sha256,
    state: coreLifecycle === "released" ? "prepared-unminted" : "candidate-review",
  };
  writeCanonicalJson(join(stageDir, "stage.json"), stage);
  console.log(`prepared ${stage.identifiers.join(", ")} at ${stageDir}`);
  console.log(`stage root ${stage.rootSha256}; source ${stage.sourceHead}/${stage.sourceSnapshotSha256}`);
  if (stage.state === "candidate-review") console.log(`candidate-review only: Core ${coreVersion} has no immutable versions/${coreVersion}/openbindings.md snapshot; evidence may be recorded, but finalization will refuse this stage`);
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(2);
}
