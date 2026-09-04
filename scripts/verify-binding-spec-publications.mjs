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
if (manifest.format !== "openbindings.binding-spec-publications@1") {
  errors.push(`unsupported manifest format ${manifest.format}`);
}
if (!manifest.latest || typeof manifest.latest !== "object" || Array.isArray(manifest.latest)) {
  errors.push("manifest.latest must be an object");
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
const errataEntries = Array.isArray(errataManifest.errata) ? errataManifest.errata : [];

// Candidate specifications are publication inputs, so their local links and
// exclusion triggers are release integrity rather than site polish. A revisit
// condition names an authority change or demonstrated consumer need; naming a
// future identifier merely schedules unfinished work and is not a condition.
for (const page of candidateSpecificationPages()) {
  const markdown = readFileSync(page, "utf8");
  const pageLabel = relative(ROOT, page);
  if (/^binding-specs\/openapi-(?:2\.0|3\.0|3\.1|3\.2)\//.test(pageLabel)) {
    // Published mirrors keep the Core dependency frozen in their immutable
    // publication record; only an unreleased candidate tracks the live Core
    // text that the publisher will place beside it.
    const expectedVersion = /^\*\*Status: unreleased /m.test(markdown)
      ? liveCoreVersion
      : undefined;
    verifyOpenApiCoreAuthority(markdown, pageLabel, expectedVersion);
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

const byIdentifier = new Map();
const publicationRecords = new Map();
const publicationRecordDigests = new Map();
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

for (const [publication, recordPath] of publicationRecords) {
  const record = readJson(recordPath, `${publication}/publication.json`);
  if (!record) continue;
  if (record.format !== "openbindings.binding-spec-publication@1") {
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
