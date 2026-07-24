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
  readFileSync,
  readdirSync,
  statSync,
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

function listFiles(root) {
  const out = [];
  function visit(dir) {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      const st = statSync(full);
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
  } else if (!readFileSync(documentPath, "utf8").includes(entry.identifier)) {
    errors.push(`${entry.identifier}: defining document does not name the identifier`);
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
for (const entry of errataEntries) {
  if (!entry || typeof entry !== "object") {
    errors.push("erratum entry must be an object");
    continue;
  }
  if (errataIds.has(entry.id)) errors.push(`duplicate erratum id ${entry.id}`);
  errataIds.add(entry.id);
  if (!byIdentifier.has(entry.identifier)) {
    errors.push(`${entry.id}: unknown binding-specification identifier ${entry.identifier}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.publishedAt || "")) {
    errors.push(`${entry.id}: publishedAt must be YYYY-MM-DD`);
  }
  const documentPath = join(ROOT, entry.document || "");
  if (!existsSync(documentPath)) {
    errors.push(`${entry.id}: missing erratum document ${entry.document}`);
  } else if (sha256(readFileSync(documentPath)) !== entry.sha256) {
    errors.push(`${entry.id}: erratum digest mismatch`);
  }
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
    if (!statSync(join(RELEASES_ROOT, name)).isDirectory()) continue;
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
