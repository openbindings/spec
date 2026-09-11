#!/usr/bin/env node
/**
 * Verifies the binding-specification publication manifest, immutable bundles,
 * current-family mirrors, permanent URLs, and (optionally) append-only history
 * relative to a git base commit.
 *
 * Usage:
 *   node scripts/verify-binding-spec-publications.mjs
 *   node scripts/verify-binding-spec-publications.mjs --base <git-sha>
 */

import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  DEPENDENCY_INSTALL_COMMAND,
  FAMILIES,
  GRPC_RUNNER_COMMANDS,
  MODULES,
  PUBLICATION_STATE_LINE,
  REQUIRED_DEPENDENCY_INSTALLS,
  REQUIRED_GATES,
  assertExactCoreAuthority,
  assertManifestGovernedStatus,
  dependencyAttestation,
  expectedModuleClosure,
  grpcProtobufOracleEvidence,
} from "./binding-spec-publication-support.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");
const MANIFEST_PATH = join(ROOT, "binding-specs", "publications.json");
const ERRATA_MANIFEST_PATH = join(ROOT, "binding-specs", "errata.json");
const RELEASES_ROOT = join(ROOT, "binding-specs", "releases");
const errors = [];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push(`${label}: ${error.message}`);
    return null;
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  }
  return value;
}

function readCanonicalJson(path, label) {
  const text = readFileSync(path, "utf8");
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    errors.push(`${label}: ${error.message}`);
    return null;
  }
  if (text !== `${JSON.stringify(canonicalJson(value), null, 2)}\n`) {
    errors.push(`${label}: JSON is not canonical sorted-key serialization`);
  }
  return value;
}

function recordRoot(records) {
  return sha256(
    Buffer.from(
      records.map(({ path, sha256: digest }) => `${path}\0${digest}\n`).sort().join("")
    )
  );
}

function sameArray(a, b) {
  return Array.isArray(a) && Array.isArray(b) && JSON.stringify(a) === JSON.stringify(b);
}

function coreSpecificationVersions(markdown) {
  return [
    ...markdown.matchAll(
      /^This is \*\*version (\d+\.\d+\.\d+)\*\* of the OpenBindings specification\./gm
    ),
  ].map((match) => match[1]);
}

function verifyOpenApiCoreAuthority(markdown, label, expectedVersion) {
  const declarations = [
    ...markdown.matchAll(
      /incorporates exactly version \*\*(\d+\.\d+\.\d+)\*\* of the \[OpenBindings Specification\]\(\.\.\/\.\.\/openbindings\.md\) as its Core authority\. Throughout this document, \*\*Core\*\* means that exact version; no other Core version is incorporated\./g
    ),
  ].map((match) => match[1]);
  if (declarations.length !== 1) {
    errors.push(`${label}: must declare exactly one versioned OpenBindings Core authority in §2`);
  }
  const sectionMatches = [...markdown.matchAll(/^## 13\. Normative references\s*$/gm)];
  if (sectionMatches.length !== 1) {
    errors.push(`${label}: must contain exactly one §13 Normative references section`);
    return;
  }
  const references = markdown.slice(sectionMatches[0].index);
  const coreReferences = [
    ...references.matchAll(
      /^- \[OpenBindings Specification (\d+\.\d+\.\d+)\]\(\.\.\/\.\.\/openbindings\.md\)$/gm
    ),
  ].map((match) => match[1]);
  if (coreReferences.length !== 1) {
    errors.push(
      `${label}: §13 must contain exactly one versioned OpenBindings Specification reference`
    );
  }
  if (
    expectedVersion &&
    declarations.length === 1 &&
    coreReferences.length === 1 &&
    (declarations[0] !== expectedVersion || coreReferences[0] !== expectedVersion)
  ) {
    errors.push(
      `${label}: Core declaration and normative reference must both name ${expectedVersion}`
    );
  }
  if (
    declarations.length === 1 &&
    coreReferences.length === 1 &&
    declarations[0] !== coreReferences[0]
  ) {
    errors.push(`${label}: §2 Core declaration and §13 Core reference name different versions`);
  }
}

function listFiles(root) {
  const out = [];
  function visit(dir) {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      const st = lstatSync(full);
      if (st.isSymbolicLink()) {
        errors.push(`publication bundle contains a symlink: ${relative(ROOT, full)}`);
      } else if (st.isDirectory()) {
        visit(full);
      } else if (st.isFile()) {
        out.push(full);
      }
    }
  }
  if (existsSync(root)) visit(root);
  return out;
}

function githubHeadingSlugs(markdown) {
  const counts = new Map();
  const slugs = new Set();
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const base = match[1]
      .toLowerCase()
      .replace(/<[^>]*>/g, "")
      .replace(/[`*_{}\[\]()#+.!,:;?"'\\/]/g, "")
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .trim()
      .replace(/\s+/g, "-");
    const count = counts.get(base) || 0;
    counts.set(base, count + 1);
    slugs.add(count === 0 ? base : `${base}-${count}`);
  }
  return slugs;
}

function candidateSpecificationPages() {
  const root = join(ROOT, "binding-specs");
  const pages = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "releases" || entry.name === "errata") continue;
    const page = join(root, entry.name, `openbindings.${entry.name}.md`);
    if (existsSync(page)) pages.push(page);
  }
  return pages;
}

function futureCandidatePages() {
  const root = join(ROOT, "binding-specs", "candidates");
  const moduleRoot = join(root, "modules");
  return listFiles(root).filter((path) => path.endsWith(".md") && !path.startsWith(`${moduleRoot}${sep}`));
}

function futureModuleCandidatePages() {
  return listFiles(join(ROOT, "binding-specs", "candidates", "modules")).filter((path) => path.endsWith(".md"));
}

function hasCanonicalPublicationState(markdown) {
  return markdown.split(/\r?\n/).filter((line) => line === PUBLICATION_STATE_LINE).length === 1
    && !/^\*\*(?:Status|Publication):/m.test(markdown);
}

function gitShow(base, path) {
  const result = spawnSync("git", ["show", `${base}:${path}`], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout : null;
}

const args = process.argv.slice(2);
let base = null;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--base" && args[i + 1]) {
    base = args[++i];
  } else {
    errors.push(`unknown argument ${args[i]}`);
  }
}
if (base) {
  const baseCheck = spawnSync("git", ["cat-file", "-e", `${base}^{commit}`], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (baseCheck.status !== 0) {
    errors.push(`git base is not an available commit: ${base}`);
  }
}

const liveCoreMarkdown = readFileSync(join(ROOT, "openbindings.md"), "utf8");
const liveCoreVersions = coreSpecificationVersions(liveCoreMarkdown);
if (liveCoreVersions.length !== 1) {
  errors.push(
    `openbindings.md: must declare exactly one specification version (found ${liveCoreVersions.length})`
  );
}
const liveCoreVersion = liveCoreVersions[0];

const manifest = readJson(MANIFEST_PATH, "binding-specs/publications.json");
const errataManifest = readJson(ERRATA_MANIFEST_PATH, "binding-specs/errata.json");
if (!manifest) process.exit(2);
if (!errataManifest) process.exit(2);
try {
  assertManifestGovernedStatus(
    readFileSync(join(ROOT, "binding-specs", "README.md"), "utf8"),
    readFileSync(join(ROOT, "RELEASING.md"), "utf8"),
  );
} catch (error) {
  errors.push(error.message);
}
if (manifest.format !== "openbindings.binding-spec-publications@1") {
  errors.push(`unsupported manifest format ${manifest.format}`);
}
if (!manifest.latest || typeof manifest.latest !== "object" || Array.isArray(manifest.latest)) {
  errors.push("manifest.latest must be an object");
}
if (manifest.modules !== undefined && !Array.isArray(manifest.modules)) {
  errors.push("manifest.modules must be an array");
}
if (manifest.latestModules !== undefined && (!manifest.latestModules || typeof manifest.latestModules !== "object" || Array.isArray(manifest.latestModules))) {
  errors.push("manifest.latestModules must be an object");
}
// --- Withdrawal-resistant floor ---------------------------------------------
// The --base comparison has single-push memory: one violating push resets its
// baseline, so it cannot catch a deletion twice (demonstrated 2026-08-11). The
// floor is committed IN the manifest: publications may never number fewer than
// it, the publish flow raises it, and removing a published entry therefore
// requires visibly lowering the floor AND appending a dated tombstone. The
// gate's job is that no deletion is silent; a deletion with a tombstone is a
// recorded decision, which is the achievable invariant.
{
  const floor = manifest.floor;
  if (floor !== undefined) {
    if (typeof floor !== "object" || !Number.isInteger(floor.publications) || floor.publications < 0) {
      errors.push("manifest.floor.publications must be a non-negative integer");
    } else if (Array.isArray(manifest.publications) && manifest.publications.length < floor.publications) {
      errors.push(
        `publications count ${manifest.publications.length} is below the committed floor ${floor.publications}; removing a published entry requires lowering the floor and appending a tombstones entry`
      );
    }
    if (floor.modules !== undefined && (!Number.isInteger(floor.modules) || floor.modules < 0)) {
      errors.push("manifest.floor.modules must be a non-negative integer");
    } else if (floor.modules !== undefined && Array.isArray(manifest.modules) && manifest.modules.length < floor.modules) {
      errors.push(`module count ${manifest.modules.length} is below the committed floor ${floor.modules}`);
    }
  }
  for (const tombstone of Array.isArray(manifest.tombstones) ? manifest.tombstones : []) {
    for (const field of ["identifier", "withdrawnAt", "reason"]) {
      if (typeof tombstone?.[field] !== "string" || !tombstone[field]) {
        errors.push(`tombstones entry ${JSON.stringify(tombstone?.identifier ?? tombstone)} missing ${field}`);
      }
    }
    // A tombstoned identifier is spent: re-publication uses a new revision.
    if (Array.isArray(manifest.publications) && manifest.publications.some((p) => p.identifier === tombstone?.identifier)) {
      errors.push(`tombstoned identifier ${tombstone.identifier} also appears in publications`);
    }
  }
  // developmentExercises records pre-publication machinery runs the project
  // ruled non-publications (2026-08-13); their identifier spellings remain
  // available, so no publications-collision check applies. Integrity only:
  const exercises = manifest.developmentExercises;
  if (exercises !== undefined) {
    for (const field of ["withdrawnAt", "ruling", "preResetTree"]) {
      if (typeof exercises?.[field] !== "string" || !exercises[field]) {
        errors.push(`developmentExercises missing ${field}`);
      }
    }
    for (const entry of Array.isArray(exercises?.entries) ? exercises.entries : []) {
      for (const field of ["identifier", "family", "publishedAt", "publicationRecordSha256"]) {
        if (entry?.[field] === undefined) {
          errors.push(`developmentExercises entry ${entry?.identifier ?? "?"} missing ${field}`);
        }
      }
    }
  }
}

if (!Array.isArray(manifest.publications)) {
  errors.push("manifest.publications must be an array");
}
if (errataManifest.format !== "openbindings.binding-spec-errata@1") {
  errors.push(`unsupported errata manifest format ${errataManifest.format}`);
}
if (!Array.isArray(errataManifest.errata)) {
  errors.push("errata manifest entries must be an array");
}
const publications = Array.isArray(manifest.publications) ? manifest.publications : [];
const modules = Array.isArray(manifest.modules) ? manifest.modules : [];
const errataEntries = Array.isArray(errataManifest.errata) ? errataManifest.errata : [];

// Candidate specifications are publication inputs, so their local links and
// exclusion triggers are release integrity rather than site polish. A revisit
// condition names an authority change or demonstrated consumer need; naming a
// future identifier merely schedules unfinished work and is not a condition.
for (const page of candidateSpecificationPages()) {
  const markdown = readFileSync(page, "utf8");
  const pageLabel = relative(ROOT, page);
  const family = pageLabel.split("/")[1];
  const statusCount = [...markdown.matchAll(/^\*\*Status:/gm)].length;
  const publicationCount = [...markdown.matchAll(/^\*\*Publication: `openbindings\.[^`]+@[1-9][0-9]*`, \d{4}-\d{2}-\d{2}\.\*\*/gm)].length;
  const neutral = hasCanonicalPublicationState(markdown);
  if (manifest.latest?.[family] === undefined) {
    if (!neutral && (statusCount !== 1 || publicationCount !== 0 || !/^\*\*Status:.*unreleased.*candidate/im.test(markdown))) {
      errors.push(`${pageLabel}: an unpublished family must carry exactly one recognized unreleased-candidate status`);
    }
    if (["grpc", "connect"].includes(family) && !neutral) errors.push(`${pageLabel}: the gRPC publication family must use the canonical status-neutral publication-state line`);
  } else if (!neutral && (statusCount !== 0 || publicationCount !== 1)) {
    errors.push(`${pageLabel}: a published latest mirror must carry one canonical publication state (legacy bundles may retain their affirmative publication header)`);
  }
  if (/^binding-specs\/openapi-(?:2\.0|3\.0|3\.1|3\.2)\//.test(pageLabel)) {
    // Published mirrors keep the Core dependency frozen in their immutable
    // publication record; only an unreleased candidate tracks the live Core
    // text that the publisher will place beside it.
    const expectedVersion = /^\*\*Status: unreleased /m.test(markdown)
      ? liveCoreVersion
      : undefined;
    verifyOpenApiCoreAuthority(markdown, pageLabel, expectedVersion);
  }
  if (neutral) {
    const latestEntry = publications.find((entry) => entry.identifier === manifest.latest?.[family]);
    try {
      assertExactCoreAuthority(markdown, `openbindings.${family}`, latestEntry?.coreRelease || liveCoreVersion);
    } catch (error) {
      errors.push(`${pageLabel}: ${error.message}`);
    }
  }
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const href = match[1];
    if (!href.includes("#") || /^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
    const [filePart, encodedFragment] = href.split("#", 2);
    const target = resolve(dirname(page), filePart || page);
    if (!existsSync(target)) {
      errors.push(`${pageLabel}: local Markdown link target does not exist: ${href}`);
      continue;
    }
    let fragment;
    try {
      fragment = decodeURIComponent(encodedFragment);
    } catch {
      errors.push(`${pageLabel}: local Markdown fragment is not valid percent-encoding: ${href}`);
      continue;
    }
    if (!githubHeadingSlugs(readFileSync(target, "utf8")).has(fragment)) {
      errors.push(`${pageLabel}: local Markdown link names a missing heading: ${href}`);
    }
  }
  let lineNumber = 0;
  for (const line of markdown.split(/\r?\n/)) {
    lineNumber++;
    if (
      /reopen/i.test(line)
      && /(future binding identifier|later binding identifier|future revision|later revision|in `?@[1-9][0-9]*`?)/i.test(line)
    ) {
      errors.push(
        `${pageLabel}:${lineNumber}: roadmap-shaped reopen trigger names future publication work instead of an authority condition or demonstrated consumer need`
      );
    }
  }
}

for (const page of futureCandidatePages()) {
  const pageLabel = relative(ROOT, page).split("\\").join("/");
  const match = pageLabel.match(/^binding-specs\/candidates\/([a-z0-9]+(?:[.-][a-z0-9]+)*)\/([1-9][0-9]*)\/openbindings\.\1\.md$/);
  if (!match) {
    errors.push(`${pageLabel}: future candidate path must be binding-specs/candidates/<family>/<revision>/openbindings.<family>.md`);
    continue;
  }
  const [, family, revisionText] = match;
  const revision = Number(revisionText);
  const prior = publications.filter((entry) => entry.family === family).map((entry) => entry.revision);
  const expected = prior.length === 0 ? 1 : Math.max(...prior) + 1;
  const markdown = readFileSync(page, "utf8");
  if (revision !== expected) errors.push(`${pageLabel}: future candidate revision must be next @${expected}`);
  if (!hasCanonicalPublicationState(markdown)) errors.push(`${pageLabel}: future candidate must use the canonical status-neutral publication-state line`);
  const identifier = `openbindings.${family}@${revision}`;
  if (!markdown.includes(identifier)) errors.push(`${pageLabel}: future candidate does not name ${identifier}`);
  if (!FAMILIES[family]) {
    errors.push(`${pageLabel}: future candidate names unknown project binding-specification family ${family}`);
  } else {
    try { assertExactCoreAuthority(markdown, identifier, liveCoreVersion); }
    catch (error) { errors.push(`${pageLabel}: ${error.message}`); }
    for (const module of expectedModuleClosure([identifier])) {
      const route = `/binding-spec-modules/${module.module}/${module.revision}`;
      if (!markdown.includes(`](${route})`) || /\]\(\.\.\/modules\/openbindings\./.test(markdown)) errors.push(`${pageLabel}: normative module citation must use permanent route ${route}`);
    }
  }
}

for (const page of futureModuleCandidatePages()) {
  const pageLabel = relative(ROOT, page).split("\\").join("/");
  const match = pageLabel.match(/^binding-specs\/candidates\/modules\/([a-z0-9]+(?:[.-][a-z0-9]+)*)\/([1-9][0-9]*)\/openbindings\.\1\.md$/);
  if (!match) {
    errors.push(`${pageLabel}: future module path must be binding-specs/candidates/modules/<module>/<revision>/openbindings.<module>.md`);
    continue;
  }
  const [, moduleName, revisionText] = match;
  const revision = Number(revisionText);
  const prior = modules.filter((entry) => entry.module === moduleName).map((entry) => entry.revision);
  const expected = prior.length === 0 ? 1 : Math.max(...prior) + 1;
  const markdown = readFileSync(page, "utf8");
  if (!MODULES[moduleName]) errors.push(`${pageLabel}: future candidate names unknown companion module ${moduleName}`);
  if (revision !== expected) errors.push(`${pageLabel}: future module revision must be next @${expected}`);
  if (!hasCanonicalPublicationState(markdown)) errors.push(`${pageLabel}: future module candidate must use the canonical status-neutral publication-state line`);
  const identifier = `openbindings.module.${moduleName}@${revision}`;
  if (!markdown.includes(identifier)) errors.push(`${pageLabel}: future module candidate does not name ${identifier}`);
  try { assertExactCoreAuthority(markdown, identifier, liveCoreVersion); }
  catch (error) { errors.push(`${pageLabel}: ${error.message}`); }
  const ref = `${moduleName}@${revision}`;
  const consumers = Object.entries(FAMILIES).flatMap(([family, config]) => Object.entries(config.moduleRefsByRevision || {}).flatMap(([consumerRevision, refs]) => refs.includes(ref) ? [`${family}@${consumerRevision}`] : []));
  if (consumers.length === 0) errors.push(`${pageLabel}: new module revision is not registered in any exact consumer-revision closure`);
}

const byIdentifier = new Map();
const modulesByIdentifier = new Map();
const publicationRecords = new Map();
const publicationRecordDigests = new Map();
for (const module of modules) {
  if (!module || typeof module !== "object") {
    errors.push("module publication entry must be an object");
    continue;
  }
  const expectedIdentifier = `openbindings.module.${module.module}@${module.revision}`;
  if (module.identifier !== expectedIdentifier) errors.push(`${module.identifier}: expected module identifier ${expectedIdentifier}`);
  if (!MODULES[module.module]) errors.push(`${module.identifier}: unknown project companion module ${module.module}`);
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(module.publication || "")) errors.push(`${module.identifier}: publication id is unsafe`);
  if (modulesByIdentifier.has(module.identifier)) errors.push(`duplicate module identifier ${module.identifier}`);
  modulesByIdentifier.set(module.identifier, module);
  const expectedCanonical = `https://openbindings.com/binding-spec-modules/${module.module}/${module.revision}`;
  const expectedRaw = `https://openbindings.com/raw/binding-spec-modules/${module.module}/${module.revision}.md`;
  if (module.canonicalUrl !== expectedCanonical) errors.push(`${module.identifier}: canonicalUrl must be ${expectedCanonical}`);
  if (module.rawUrl !== expectedRaw) errors.push(`${module.identifier}: rawUrl must be ${expectedRaw}`);
  const expectedDocument = MODULES[module.module] ? `binding-specs/releases/${module.publication}/root/${MODULES[module.module].document}` : null;
  if (expectedDocument && module.document !== expectedDocument) errors.push(`${module.identifier}: module document must be ${expectedDocument}`);
  const expectedPublicationRecord = `binding-specs/releases/${module.publication}/publication.json`;
  if (module.publicationRecord !== expectedPublicationRecord) errors.push(`${module.identifier}: publication record must be ${expectedPublicationRecord}`);
  const documentPath = join(ROOT, module.document || "");
  if (!existsSync(documentPath)) errors.push(`${module.identifier}: missing module document ${module.document}`);
  else {
    const bytes = readFileSync(documentPath);
    if (sha256(bytes) !== module.sha256) errors.push(`${module.identifier}: module document digest mismatch`);
    const markdown = bytes.toString("utf8");
    if (hasCanonicalPublicationState(markdown)) {
      const mintingPublication = publications.find((entry) => entry.publication === module.publication);
      try { assertExactCoreAuthority(markdown, module.identifier, mintingPublication?.coreRelease || liveCoreVersion); }
      catch (error) { errors.push(`${module.identifier}: ${error.message}`); }
    }
  }
  const recordPath = join(ROOT, module.publicationRecord || "");
  if (!existsSync(recordPath)) errors.push(`${module.identifier}: missing publication record ${module.publicationRecord}`);
  else if (sha256(readFileSync(recordPath)) !== module.publicationRecordSha256) errors.push(`${module.identifier}: publication record digest mismatch`);
}
for (const entry of publications) {
  if (!entry || typeof entry !== "object") {
    errors.push("publication entry must be an object");
    continue;
  }
  const expectedIdentifier = `openbindings.${entry.family}@${entry.revision}`;
  if (entry.identifier !== expectedIdentifier) {
    errors.push(`${entry.identifier}: expected identifier ${expectedIdentifier}`);
  }
  if (byIdentifier.has(entry.identifier)) {
    errors.push(`duplicate publication identifier ${entry.identifier}`);
  }
  byIdentifier.set(entry.identifier, entry);
  if (!FAMILIES[entry.family]) errors.push(`${entry.identifier}: unknown project binding-specification family ${entry.family}`);
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(entry.publication || "")) errors.push(`${entry.identifier}: publication id is unsafe`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.publishedAt || "")) {
    errors.push(`${entry.identifier}: publishedAt must be YYYY-MM-DD`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(entry.coreRelease || "")) {
    errors.push(`${entry.identifier}: coreRelease must be X.Y.Z`);
  }
  const expectedCanonical = `https://openbindings.com/binding-specs/${entry.family}/${entry.revision}`;
  const expectedRaw = `https://openbindings.com/raw/binding-specs/${entry.family}/${entry.revision}.md`;
  if (entry.canonicalUrl !== expectedCanonical) {
    errors.push(`${entry.identifier}: canonicalUrl must be ${expectedCanonical}`);
  }
  if (entry.rawUrl !== expectedRaw) {
    errors.push(`${entry.identifier}: rawUrl must be ${expectedRaw}`);
  }
  if (!Array.isArray(entry.modules)) errors.push(`${entry.identifier}: modules must be an array`);
  for (const moduleRef of Array.isArray(entry.modules) ? entry.modules : []) {
    const module = modulesByIdentifier.get(moduleRef?.identifier);
    if (!module) errors.push(`${entry.identifier}: unknown normative module ${moduleRef?.identifier}`);
    else if (module.sha256 !== moduleRef.sha256) errors.push(`${entry.identifier}: normative module digest mismatch for ${moduleRef.identifier}`);
  }

  const expectedDocument = FAMILIES[entry.family] ? `binding-specs/releases/${entry.publication}/root/${FAMILIES[entry.family].document}` : null;
  if (expectedDocument && entry.document !== expectedDocument) errors.push(`${entry.identifier}: defining document must be ${expectedDocument}`);
  const expectedPublicationRecord = `binding-specs/releases/${entry.publication}/publication.json`;
  if (entry.publicationRecord !== expectedPublicationRecord) errors.push(`${entry.identifier}: publication record must be ${expectedPublicationRecord}`);
  const documentPath = join(ROOT, entry.document || "");
  if (!existsSync(documentPath)) {
    errors.push(`${entry.identifier}: missing defining document ${entry.document}`);
  } else {
    const documentMarkdown = readFileSync(documentPath, "utf8");
    if (!documentMarkdown.includes(entry.identifier)) {
      errors.push(`${entry.identifier}: defining document does not name the identifier`);
    }
    if (/^openapi-(?:2\.0|3\.0|3\.1|3\.2)$/.test(entry.family || "")) {
      verifyOpenApiCoreAuthority(documentMarkdown, entry.document, entry.coreRelease);
    }
    if (hasCanonicalPublicationState(documentMarkdown)) {
      try { assertExactCoreAuthority(documentMarkdown, entry.identifier, entry.coreRelease); }
      catch (error) { errors.push(`${entry.identifier}: ${error.message}`); }
    }
  }

  const recordPath = join(ROOT, entry.publicationRecord || "");
  if (!existsSync(recordPath)) {
    errors.push(`${entry.identifier}: missing publication record ${entry.publicationRecord}`);
  } else {
    const actual = sha256(readFileSync(recordPath));
    if (actual !== entry.publicationRecordSha256) {
      errors.push(`${entry.identifier}: publication record digest mismatch`);
    }
    const priorRecord = publicationRecords.get(entry.publication);
    const priorDigest = publicationRecordDigests.get(entry.publication);
    if (priorRecord && priorRecord !== recordPath) {
      errors.push(`${entry.publication}: manifest entries name different publication records`);
    }
    if (priorDigest && priorDigest !== entry.publicationRecordSha256) {
      errors.push(`${entry.publication}: manifest entries name different publication digests`);
    }
    publicationRecords.set(entry.publication, recordPath);
    publicationRecordDigests.set(entry.publication, entry.publicationRecordSha256);
  }
}

const errataIds = new Set();
const errataDocuments = new Set();
for (const entry of errataEntries) {
  if (!entry || typeof entry !== "object") {
    errors.push("erratum entry must be an object");
    continue;
  }
  if (errataIds.has(entry.id)) errors.push(`duplicate erratum id ${entry.id}`);
  errataIds.add(entry.id);
  if (errataDocuments.has(entry.document)) {
    errors.push(`duplicate erratum document ${entry.document}`);
  }
  errataDocuments.add(entry.document);
  if (!byIdentifier.has(entry.identifier)) {
    errors.push(`${entry.id}: unknown binding-specification identifier ${entry.identifier}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.publishedAt || "")) {
    errors.push(`${entry.id}: publishedAt must be YYYY-MM-DD`);
  }
  const documentMatch = (entry.document || "").match(
    /^binding-specs\/errata\/([a-z0-9]+(?:[.-][a-z0-9]+)*)\/([1-9][0-9]*)\/([0-9]{4})\.md$/
  );
  if (!documentMatch) {
    errors.push(`${entry.id}: document must use binding-specs/errata/<family>/<revision>/<sequence>.md`);
  } else {
    const [, family, revision, sequenceText] = documentMatch;
    const expectedIdentifier = `openbindings.${family}@${revision}`;
    const sequence = Number(sequenceText);
    if (entry.identifier !== expectedIdentifier) {
      errors.push(`${entry.id}: document path implies ${expectedIdentifier}`);
    }
    if (entry.id !== `${entry.identifier}-erratum-${sequence}`) {
      errors.push(`${entry.id}: id does not match document sequence ${sequence}`);
    }
  }
  const documentPath = join(ROOT, entry.document || "");
  if (!existsSync(documentPath)) {
    errors.push(`${entry.id}: missing erratum document ${entry.document}`);
  } else {
    const documentBytes = readFileSync(documentPath);
    if (sha256(documentBytes) !== entry.sha256) {
      errors.push(`${entry.id}: erratum digest mismatch`);
    }
    if (!documentBytes.toString("utf8").includes(entry.identifier)) {
      errors.push(`${entry.id}: erratum document does not name ${entry.identifier}`);
    }
  }
}

const actualErrataDocuments = new Set(
  listFiles(join(ROOT, "binding-specs", "errata"))
    .map((full) => relative(ROOT, full).split("\\").join("/"))
    .filter((path) => path.endsWith(".md") && path !== "binding-specs/errata/README.md")
);
for (const document of actualErrataDocuments) {
  if (!errataDocuments.has(document)) errors.push(`unregistered erratum document ${document}`);
}
for (const document of errataDocuments) {
  if (!actualErrataDocuments.has(document)) errors.push(`errata manifest names absent document ${document}`);
}

for (const [family, identifier] of Object.entries(manifest.latest || {})) {
  const entry = byIdentifier.get(identifier);
  if (!entry) {
    errors.push(`latest.${family} names unknown identifier ${identifier}`);
    continue;
  }
  if (entry.family !== family) {
    errors.push(`latest.${family} points to family ${entry.family}`);
  }
  const revisions = publications
    .filter((candidate) => candidate.family === family)
    .map((candidate) => candidate.revision);
  if (entry.revision !== Math.max(...revisions)) {
    errors.push(`latest.${family} does not point to the greatest published revision`);
  }

  const currentPath = join(
    ROOT,
    "binding-specs",
    family,
    `openbindings.${family}.md`
  );
  if (!existsSync(currentPath)) {
    errors.push(`latest.${family}: missing current-family mirror ${relative(ROOT, currentPath)}`);
  } else if (
    existsSync(join(ROOT, entry.document)) &&
    !readFileSync(currentPath).equals(readFileSync(join(ROOT, entry.document)))
  ) {
    errors.push(
      `latest.${family}: current-family mirror differs from published ${entry.identifier}`
    );
  }
}

for (const entry of publications) {
  if (manifest.latest?.[entry.family] === undefined) {
    errors.push(`${entry.identifier}: family is absent from manifest.latest`);
  }
}

for (const [moduleName, identifier] of Object.entries(manifest.latestModules || {})) {
  const entry = modulesByIdentifier.get(identifier);
  if (!entry) {
    errors.push(`latestModules.${moduleName} names unknown identifier ${identifier}`);
    continue;
  }
  if (entry.module !== moduleName) errors.push(`latestModules.${moduleName} points to module ${entry.module}`);
  const revisions = modules.filter((candidate) => candidate.module === moduleName).map((candidate) => candidate.revision);
  if (entry.revision !== Math.max(...revisions)) errors.push(`latestModules.${moduleName} does not point to the greatest published revision`);
  const currentPath = join(ROOT, "binding-specs", "modules", `openbindings.${moduleName}.md`);
  if (!existsSync(currentPath)) errors.push(`latestModules.${moduleName}: missing current module mirror`);
  else if (!readFileSync(currentPath).equals(readFileSync(join(ROOT, entry.document)))) errors.push(`latestModules.${moduleName}: current module mirror differs from ${entry.identifier}`);
}
for (const entry of modules) {
  if (manifest.latestModules?.[entry.module] === undefined) errors.push(`${entry.identifier}: module is absent from manifest.latestModules`);
}

const liveModuleRoot = join(ROOT, "binding-specs", "modules");
if (existsSync(liveModuleRoot)) {
  for (const path of listFiles(liveModuleRoot).filter((path) => path.endsWith(".md"))) {
    const markdown = readFileSync(path, "utf8");
    const label = relative(ROOT, path);
    const identifier = [...markdown.matchAll(/\*\*`(openbindings\.module\.[^`]+@[1-9][0-9]*)`\*\*/g)][0]?.[1];
    const statusCount = [...markdown.matchAll(/^\*\*Status:/gm)].length;
    const publicationCount = [...markdown.matchAll(/^\*\*Publication: `openbindings\.module\.[^`]+@[1-9][0-9]*`, \d{4}-\d{2}-\d{2}\.\*\*/gm)].length;
    const neutral = hasCanonicalPublicationState(markdown);
    if (!identifier || !modulesByIdentifier.has(identifier)) {
      if (!neutral && (statusCount !== 1 || publicationCount !== 0 || !/^\*\*Status:.*unreleased.*candidate/im.test(markdown))) errors.push(`${label}: unpublished module must carry one exact publication state`);
      if (label.endsWith("openbindings.protobuf-correspondence.md") && !neutral) errors.push(`${label}: Protobuf correspondence must use the canonical status-neutral publication-state line`);
    } else if (!neutral && (statusCount !== 0 || publicationCount !== 1)) errors.push(`${label}: published module mirror must carry one canonical publication state (legacy bundles may retain their publication header)`);
    if (neutral) {
      const publishedModule = modules.find((entry) => entry.identifier === identifier);
      const mintingPublication = publications.find((entry) => entry.publication === publishedModule?.publication);
      try {
        assertExactCoreAuthority(markdown, identifier || label, mintingPublication?.coreRelease || liveCoreVersion);
      } catch (error) {
        errors.push(`${label}: ${error.message}`);
      }
    }
  }
}

for (const [publication, recordPath] of publicationRecords) {
  const record = readJson(recordPath, `${publication}/publication.json`);
  if (!record) continue;
  if (!["openbindings.binding-spec-publication@1", "openbindings.binding-spec-publication@2", "openbindings.binding-spec-publication@3"].includes(record.format)) {
    errors.push(`${publication}: unsupported publication record format ${record.format}`);
  }
  if (record.publication !== publication) {
    errors.push(`${publication}: publication record id mismatch`);
  }
  const manifestEntries = publications.filter(
    (entry) => entry.publication === publication
  );
  if (
    manifestEntries.some(
      (entry) =>
        entry.publishedAt !== record.publishedAt || entry.coreRelease !== record.coreRelease
    )
  ) {
    errors.push(`${publication}: date or companion core release differs from manifest entries`);
  }
  if (!Array.isArray(record.identifiers)) {
    errors.push(`${publication}: publication record identifiers must be an array`);
  }
  if (!Array.isArray(record.files)) {
    errors.push(`${publication}: publication record files must be an array`);
  }
  const recordIdentifiers = Array.isArray(record.identifiers) ? record.identifiers : [];
  const recordFiles = Array.isArray(record.files) ? record.files : [];
  if (["openbindings.binding-spec-publication@2", "openbindings.binding-spec-publication@3"].includes(record.format)) {
    if (record.rootSha256 !== recordRoot(recordFiles)) errors.push(`${publication}: publication root digest mismatch`);
    if (!Array.isArray(record.modules)) errors.push(`${publication}: publication record modules must be an array`);
    const expectedModuleRefs = new Map();
    for (const entry of manifestEntries) {
      for (const moduleRef of entry.modules || []) expectedModuleRefs.set(moduleRef.identifier, moduleRef.sha256);
    }
    for (const module of record.modules || []) {
      if (expectedModuleRefs.get(module.identifier) !== module.sha256) errors.push(`${publication}: publication record module ${module.identifier} is not the consumer closure`);
      expectedModuleRefs.delete(module.identifier);
    }
    for (const identifier of expectedModuleRefs.keys()) errors.push(`${publication}: publication record omits consumer module ${identifier}`);
    const stagePath = join(dirname(recordPath), record.stage?.path || "");
    const adjudicationPath = join(dirname(recordPath), record.adjudication?.path || "");
    if (record.stage?.path !== "stage.json" || !existsSync(stagePath) || sha256(readFileSync(stagePath)) !== record.stage?.sha256) {
      errors.push(`${publication}: missing or mismatched sealed stage record`);
    }
    if (record.adjudication?.path !== "adjudication.json" || !existsSync(adjudicationPath) || sha256(readFileSync(adjudicationPath)) !== record.adjudication?.sha256) {
      errors.push(`${publication}: missing or mismatched adjudication record`);
    }
    const stage = existsSync(stagePath) ? readCanonicalJson(stagePath, `${publication}/stage.json`) : null;
    const adjudication = existsSync(adjudicationPath) ? readCanonicalJson(adjudicationPath, `${publication}/adjudication.json`) : null;
    if (stage) {
      if (stage.rootSha256 !== record.rootSha256 || JSON.stringify(stage.identifiers) !== JSON.stringify(recordIdentifiers)) errors.push(`${publication}: stage does not bind publication identifiers/root`);
      if (sha256(readFileSync(stagePath)) !== adjudication?.stageRecordSha256) errors.push(`${publication}: adjudication does not bind sealed stage record`);
    }
    if (adjudication && record.format === "openbindings.binding-spec-publication@2") {
      if (adjudication.rootSha256 !== record.rootSha256 || adjudication.unresolvedP0P2 !== 0) errors.push(`${publication}: adjudication does not accept the publication root with zero unresolved P0-P2`);
      const roles = new Map((adjudication.reviews || []).map((review) => [review.role, review]));
      for (const role of ["authority", "conformance", "publisher"]) {
        const review = roles.get(role);
        if (review?.verdict !== "ACCEPT" || review?.rootSha256 !== record.rootSha256) errors.push(`${publication}: adjudication lacks exact-root ACCEPT from ${role}`);
      }
      const languages = new Map((adjudication.runners || []).map((runner) => [runner.language, runner]));
      for (const language of ["go", "typescript"]) if (languages.get(language)?.status !== "pass") errors.push(`${publication}: adjudication lacks passing ${language} execution`);
      const gates = new Set((adjudication.gates || []).filter((gate) => gate.status === "pass").map((gate) => gate.id));
      for (const gate of ["binding-specs", "authority-pins", "publications", "grpc-protobuf-compiler", "grpc-runners", "grpc-tls", "diff-check"]) if (!gates.has(gate)) errors.push(`${publication}: adjudication lacks passing ${gate} gate`);
    }
    if (record.format === "openbindings.binding-spec-publication@3") {
      const evidencePath = join(dirname(recordPath), record.evidence?.path || "");
      if (record.evidence?.path !== "evidence.json" || !existsSync(evidencePath) || sha256(readFileSync(evidencePath)) !== record.evidence?.sha256) {
        errors.push(`${publication}: missing or mismatched machine evidence record`);
      }
      const evidence = existsSync(evidencePath) ? readCanonicalJson(evidencePath, `${publication}/evidence.json`) : null;
      const stageDigest = existsSync(stagePath) ? sha256(readFileSync(stagePath)) : null;
      const legacyStage = stage?.format === "openbindings.binding-spec-publication-stage@2";
      const currentStage = stage?.format === "openbindings.binding-spec-publication-stage@3";
      if ((!legacyStage && !currentStage) || stage?.state !== "prepared-unminted") errors.push(`${publication}: @3 bundle requires one finalizable prepared-unminted stage`);
      if (currentStage) {
        const expectedCorePath = `versions/${stage?.core?.version}/openbindings.md`;
        const releasedCorePath = join(ROOT, expectedCorePath);
        const bundleCorePath = join(dirname(recordPath), "root", "openbindings.md");
        if (stage?.core?.lifecycle !== "released" || stage?.core?.path !== "root/openbindings.md" || stage?.core?.sourcePath !== expectedCorePath || stage?.core?.version !== record.coreRelease || stage?.core?.sha256 !== (existsSync(bundleCorePath) ? sha256(readFileSync(bundleCorePath)) : null)) errors.push(`${publication}: stage does not bind an exact released Core authority`);
        if (!existsSync(releasedCorePath) || !existsSync(bundleCorePath) || !readFileSync(releasedCorePath).equals(readFileSync(bundleCorePath))) errors.push(`${publication}: archived Core differs from immutable ${expectedCorePath}`);
        if (existsSync(bundleCorePath) && readFileSync(bundleCorePath, "utf8").includes("unreleased working draft")) errors.push(`${publication}: archived released Core still claims to be an unreleased working draft`);
      }
      if (!Number.isInteger(stage?.sourceFileCount) || stage.sourceFileCount < 1) errors.push(`${publication}: stage does not bind the source file count used by source-target evidence`);
      const stageCoreVersion = currentStage ? stage?.core?.version : stage?.coreRelease;
      if (!sameArray(stage?.files, recordFiles) || !sameArray(stage?.modules, record.modules) || stage?.publication !== publication || stage?.publishedAt !== record.publishedAt || stageCoreVersion !== record.coreRelease) errors.push(`${publication}: stage does not bind the exact publication file/module closure and metadata`);
      if (evidence?.format !== "openbindings.binding-spec-publication-evidence@1" || evidence?.stageRecordSha256 !== stageDigest || evidence?.publication !== publication) errors.push(`${publication}: evidence does not bind the exact stage record`);
      if (adjudication?.format !== "openbindings.binding-spec-publication-adjudication@2" || adjudication?.evidenceSha256 !== record.evidence?.sha256 || adjudication?.stageRecordSha256 !== stageDigest) errors.push(`${publication}: adjudication does not bind exact evidence and stage records`);

      const requiredGates = new Set(Object.keys(REQUIRED_GATES));
      const installs = Array.isArray(evidence?.dependencyInstalls) ? evidence.dependencyInstalls : [];
      const requiredInstalls = new Set(Object.keys(REQUIRED_DEPENDENCY_INSTALLS));
      const bundleRoot = join(dirname(recordPath), "root");
      if (installs.length !== requiredInstalls.size) errors.push(`${publication}: evidence dependency-install set is not closed`);
      for (const install of installs) {
        let expected;
        try { expected = dependencyAttestation(bundleRoot, install?.id); }
        catch (error) { errors.push(`${publication}: ${error.message}`); }
        if (!requiredInstalls.delete(install?.id) || !expected || !sameArray(install?.command, DEPENDENCY_INSTALL_COMMAND) || install?.directory !== expected.directory || JSON.stringify(install?.dependencies) !== JSON.stringify(expected.dependencies) || install?.packageSha256 !== expected.packageSha256 || install?.packageLockSha256 !== expected.packageLockSha256 || install?.status !== "pass" || install?.exitCode !== 0 || install?.target !== "stage" || install?.targetRootSha256 !== record.rootSha256 || !/^[0-9a-f]{64}$/.test(install?.resultSha256 || "")) errors.push(`${publication}: malformed, duplicate, or unrecognized dependency-install evidence ${install?.id}`);
      }
      for (const id of requiredInstalls) errors.push(`${publication}: evidence omits ${id}`);
      const gates = Array.isArray(evidence?.gates) ? evidence.gates : [];
      if (gates.length !== requiredGates.size) errors.push(`${publication}: evidence gate set is not closed`);
      for (const gate of gates) {
        const rule = REQUIRED_GATES[gate?.id];
        const expectedRoot = rule?.target === "stage" ? record.rootSha256 : stage?.sourceSnapshotSha256;
        if (!requiredGates.delete(gate?.id) || gate?.status !== "pass" || gate?.exitCode !== 0 || gate?.target !== rule?.target || gate?.targetRootSha256 !== expectedRoot || !sameArray(gate?.command, rule?.command) || !/^[0-9a-f]{64}$/.test(gate?.resultSha256 || "")) errors.push(`${publication}: malformed, duplicate, or unrecognized gate evidence ${gate?.id}`);
      }
      for (const gate of requiredGates) errors.push(`${publication}: evidence omits ${gate} gate`);
      const oracleGate = gates.find((gate) => gate?.id === "grpc-protobuf-oracle");
      let expectedOracle;
      let oracleStdout = "";
      try {
        oracleStdout = `${JSON.stringify(canonicalJson(evidence?.oracle?.observation))}\n`;
        expectedOracle = grpcProtobufOracleEvidence(bundleRoot, oracleStdout);
      } catch (error) {
        errors.push(`${publication}: ${error.message}`);
      }
      if (!expectedOracle || JSON.stringify(evidence?.oracle) !== JSON.stringify(expectedOracle)) errors.push(`${publication}: evidence does not bind the exact gRPC Protobuf oracle authority, harness, source, case, result, and toolchain observation`);
      if (!oracleGate || oracleGate.resultSha256 !== sha256(Buffer.from(oracleStdout))) errors.push(`${publication}: gRPC Protobuf oracle gate digest does not bind its canonical observation`);
      const runners = Array.isArray(evidence?.runners) ? evidence.runners : [];
      for (const language of ["go", "typescript"]) {
        const matches = runners.filter((runner) => runner?.language === language);
        if (matches.length !== 1 || matches[0].id !== `grpc-runner-${language}` || !sameArray(matches[0].command, GRPC_RUNNER_COMMANDS[language]) || matches[0].status !== "pass" || matches[0].exitCode !== 0 || matches[0].target !== "stage" || matches[0].targetRootSha256 !== record.rootSha256 || matches[0].apparatusRootSha256 !== stage?.apparatusRootSha256 || matches[0].corpusSha256 !== stage?.grpcProcessorCorpusSha256 || !/^[0-9a-f]{64}$/.test(matches[0].resultSha256 || "")) errors.push(`${publication}: evidence lacks exact-command, exact-root ${language} runner execution`);
      }
      if (runners.length !== 2) errors.push(`${publication}: evidence runner set is not closed`);

      const reviews = Array.isArray(adjudication?.reviews) ? adjudication.reviews : [];
      const p3 = new Set();
      const findingIds = new Set();
      const reviewerIds = new Set();
      for (const role of ["authority", "conformance", "publisher"]) {
        const matches = reviews.filter((review) => review?.role === role);
        if (matches.length !== 1 || matches[0]?.verdict !== "ACCEPT" || matches[0]?.rootSha256 !== record.rootSha256 || matches[0]?.stageRecordSha256 !== stageDigest || !matches[0]?.reviewer || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(matches[0]?.recordedAt || "") || Number.isNaN(Date.parse(matches[0]?.recordedAt))) errors.push(`${publication}: adjudication lacks named, dated exact-stage ACCEPT from ${role}`);
        if (matches.length === 1 && matches[0]?.reviewer) reviewerIds.add(matches[0].reviewer.normalize("NFKC").trim().toLowerCase());
        for (const finding of matches[0]?.findings || []) {
          if (findingIds.has(finding.id)) errors.push(`${publication}: duplicate finding id ${finding.id}`);
          findingIds.add(finding.id);
          if (finding.severity === "p3") p3.add(finding.id);
          else if (["p0", "p1", "p2"].includes(finding.severity) && finding.status === "open") errors.push(`${publication}: unresolved ${finding.severity.toUpperCase()} finding ${finding.id}`);
        }
      }
      if (reviews.length !== 3 || adjudication?.unresolvedP0P2 !== 0) errors.push(`${publication}: adjudication review set is not closed with zero unresolved P0-P2`);
      if (currentStage && reviewerIds.size !== 3) errors.push(`${publication}: authority, conformance, and publisher reviews do not name three distinct normalized reviewers`);
      const dispositions = Array.isArray(adjudication?.p3Dispositions) ? adjudication.p3Dispositions : [];
      const dispositionIds = new Set(dispositions.map((entry) => entry?.id));
      if (dispositionIds.size !== dispositions.length || dispositionIds.size !== p3.size || [...p3].some((id) => !dispositionIds.has(id)) || dispositions.some((entry) => !["accepted", "deferred", "resolved"].includes(entry?.decision) || !entry?.rationale)) errors.push(`${publication}: P3 dispositions are not the exact complete reviewer P3 union`);

      let derivedModules = [];
      try {
        derivedModules = expectedModuleClosure(recordIdentifiers);
      } catch (error) {
        errors.push(`${publication}: cannot derive normative module closure: ${error.message}`);
      }
      if ((record.modules || []).length !== derivedModules.length) errors.push(`${publication}: module closure cardinality differs from authoritative family registry`);
      for (const expected of derivedModules) {
        const matches = (record.modules || []).filter((module) => module.identifier === expected.identifier);
        const expectedPath = `root/${expected.document}`;
        const expectedCanonical = `https://openbindings.com/binding-spec-modules/${expected.module}/${expected.revision}`;
        const expectedRaw = `https://openbindings.com/raw/binding-spec-modules/${expected.module}/${expected.revision}.md`;
        const modulePath = join(dirname(recordPath), expectedPath);
        const digest = existsSync(modulePath) ? sha256(readFileSync(modulePath)) : null;
        if (matches.length !== 1 || !sameArray(matches[0].consumers, expected.consumers) || matches[0].path !== expectedPath || matches[0].canonicalUrl !== expectedCanonical || matches[0].rawUrl !== expectedRaw || matches[0].sha256 !== digest) errors.push(`${publication}: ${expected.identifier} is not the independently derived exact module closure`);
        if (currentStage && matches.length === 1) {
          const manifestModule = modulesByIdentifier.get(expected.identifier);
          const expectedSourcePath = manifestModule?.publication === publication
            ? (expected.revision === 1 ? MODULES[expected.module].document : `binding-specs/candidates/modules/${expected.module}/${expected.revision}/openbindings.${expected.module}.md`)
            : manifestModule?.document;
          if (matches[0].sourcePath !== expectedSourcePath) errors.push(`${publication}: ${expected.identifier} does not record its exact immutable or candidate source path`);
        }
        if (existsSync(modulePath)) {
          const markdown = readFileSync(modulePath, "utf8");
          if (!hasCanonicalPublicationState(markdown)) errors.push(`${publication}: ${expected.identifier} archived bytes lack canonical status-neutral publication state`);
          try { assertExactCoreAuthority(markdown, expected.identifier, record.coreRelease); }
          catch (error) { errors.push(`${publication}: ${error.message}`); }
        }
      }
      const stageDocuments = Array.isArray(stage?.definingDocuments) ? stage.definingDocuments : [];
      if (stageDocuments.length !== manifestEntries.length) errors.push(`${publication}: stage defining-document closure cardinality differs from manifest cohort`);
      for (const entry of manifestEntries) {
        const archivedPath = join(ROOT, entry.document);
        const expectedStagePath = entry.document.slice(relative(ROOT, dirname(recordPath)).split("\\").join("/").length + 1);
        const matches = stageDocuments.filter((document) => document.identifier === entry.identifier);
        const markdown = existsSync(archivedPath) ? readFileSync(archivedPath, "utf8") : "";
        if (matches.length !== 1 || matches[0].path !== expectedStagePath || matches[0].canonicalUrl !== entry.canonicalUrl || matches[0].rawUrl !== entry.rawUrl || matches[0].family !== entry.family || matches[0].revision !== entry.revision || matches[0].sha256 !== (existsSync(archivedPath) ? sha256(readFileSync(archivedPath)) : null)) errors.push(`${publication}: ${entry.identifier} is not the exact staged defining-document closure`);
        if (!hasCanonicalPublicationState(markdown)) errors.push(`${publication}: ${entry.identifier} archived bytes lack canonical status-neutral publication state`);
        try { assertExactCoreAuthority(markdown, entry.identifier, record.coreRelease); }
        catch (error) { errors.push(`${publication}: ${error.message}`); }
        for (const module of derivedModules.filter((candidate) => candidate.consumers.includes(entry.identifier))) {
          const route = `/binding-spec-modules/${module.module}/${module.revision}`;
          if (!markdown.includes(`](${route})`) || /\]\(\.\.\/modules\/openbindings\./.test(markdown)) errors.push(`${publication}: ${entry.identifier} does not cite ${module.identifier} through its permanent module route`);
        }
      }
    }
  }
  const archivedCorePath = join(dirname(recordPath), "root", "openbindings.md");
  if (!existsSync(archivedCorePath)) {
    errors.push(`${publication}: immutable bundle is missing root/openbindings.md`);
  } else {
    const archivedCoreVersions = coreSpecificationVersions(
      readFileSync(archivedCorePath, "utf8")
    );
    if (archivedCoreVersions.length !== 1) {
      errors.push(
        `${publication}: archived root/openbindings.md must declare exactly one specification version`
      );
    } else if (archivedCoreVersions[0] !== record.coreRelease) {
      errors.push(
        `${publication}: archived Core ${archivedCoreVersions[0]} does not match publication coreRelease ${record.coreRelease}`
      );
    }
  }
  if (!recordFiles.some((file) => file?.path === "root/openbindings.md")) {
    errors.push(`${publication}: publication record does not hash root/openbindings.md`);
  }
  const declaredIds = new Set(recordIdentifiers);
  const manifestIds = new Set(
    manifestEntries.map((entry) => entry.identifier)
  );
  if (declaredIds.size !== recordIdentifiers.length) {
    errors.push(`${publication}: publication record contains duplicate identifiers`);
  }
  if (
    declaredIds.size !== manifestIds.size ||
    [...declaredIds].some((identifier) => !manifestIds.has(identifier))
  ) {
    errors.push(`${publication}: publication record identifiers differ from manifest entries`);
  }
  const publicationDir = dirname(recordPath);
  const actualFiles = new Set(
    listFiles(join(publicationDir, "root")).map((full) =>
      relative(publicationDir, full).split("\\").join("/")
    )
  );
  const declaredFiles = new Set();
  for (const file of recordFiles) {
    if (declaredFiles.has(file.path)) {
      errors.push(`${publication}: duplicate file record ${file.path}`);
      continue;
    }
    declaredFiles.add(file.path);
    const full = resolve(publicationDir, file.path);
    const relativeFull = relative(publicationDir, full);
    if (
      !file.path.startsWith("root/") ||
      isAbsolute(relativeFull) ||
      relativeFull === ".." ||
      relativeFull.startsWith(`..${sep}`)
    ) {
      errors.push(`${publication}: archived file path escapes its root: ${file.path}`);
      continue;
    }
    if (!existsSync(full)) {
      errors.push(`${publication}: missing archived file ${file.path}`);
    } else if (sha256(readFileSync(full)) !== file.sha256) {
      errors.push(`${publication}: digest mismatch for ${file.path}`);
    }
  }
  for (const path of actualFiles) {
    if (!declaredFiles.has(path)) errors.push(`${publication}: unrecorded archived file ${path}`);
  }
  for (const path of declaredFiles) {
    if (!actualFiles.has(path)) errors.push(`${publication}: record names absent file ${path}`);
  }
}

if (existsSync(RELEASES_ROOT)) {
  for (const name of readdirSync(RELEASES_ROOT).sort()) {
    const releasePath = join(RELEASES_ROOT, name);
    const releaseStat = lstatSync(releasePath);
    if (releaseStat.isSymbolicLink()) {
      errors.push(`binding-specification release is a symlink: ${relative(ROOT, releasePath)}`);
      continue;
    }
    if (!releaseStat.isDirectory()) continue;
    if (!publicationRecords.has(name)) {
      errors.push(`unregistered publication bundle binding-specs/releases/${name}`);
    }
  }
}

if (base) {
  const oldText = gitShow(base, "binding-specs/publications.json");
  if (oldText !== null) {
    let oldManifest;
    try {
      oldManifest = JSON.parse(oldText);
    } catch (error) {
      errors.push(`base manifest cannot be parsed: ${error.message}`);
    }
    if (oldManifest) {
      const currentById = new Map(
        publications.map((entry) => [entry.identifier, entry])
      );
      for (const oldEntry of oldManifest.publications || []) {
        const current = currentById.get(oldEntry.identifier);
        if (!current) {
          errors.push(`published manifest entry removed: ${oldEntry.identifier}`);
        } else if (JSON.stringify(current) !== JSON.stringify(oldEntry)) {
          errors.push(`published manifest entry changed: ${oldEntry.identifier}`);
        }
      }
      const currentModulesById = new Map(modules.map((entry) => [entry.identifier, entry]));
      for (const oldEntry of oldManifest.modules || []) {
        const current = currentModulesById.get(oldEntry.identifier);
        if (!current) errors.push(`published module entry removed: ${oldEntry.identifier}`);
        else if (JSON.stringify(current) !== JSON.stringify(oldEntry)) errors.push(`published module entry changed: ${oldEntry.identifier}`);
      }
    }
  }
  const oldErrataText = gitShow(base, "binding-specs/errata.json");
  if (oldErrataText !== null) {
    let oldErrata;
    try {
      oldErrata = JSON.parse(oldErrataText);
    } catch (error) {
      errors.push(`base errata manifest cannot be parsed: ${error.message}`);
    }
    if (oldErrata) {
      const currentById = new Map(
        errataEntries.map((entry) => [entry.id, entry])
      );
      for (const oldEntry of oldErrata.errata || []) {
        const current = currentById.get(oldEntry.id);
        if (!current) {
          errors.push(`published erratum entry removed: ${oldEntry.id}`);
        } else if (JSON.stringify(current) !== JSON.stringify(oldEntry)) {
          errors.push(`published erratum entry changed: ${oldEntry.id}`);
        }
      }
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(
  `binding-spec publications: ${publications.length} revision(s), ${publicationRecords.size} immutable bundle(s), ${errataEntries.length} errata: OK`
);
