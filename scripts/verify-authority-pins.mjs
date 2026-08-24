#!/usr/bin/env node
// Verifies the tracked authority-pin manifest (binding-specs/AUTHORITY-PINS.json)
// against the live upstream sources and against the binding-specification texts.
//
// The manifest records, for every upstream authority a binding specification
// incorporates, the exact pinned source (immutable URL, or git repo + commit +
// path) and the sha256 over the exact bytes at that source. Bytes are not
// stored in this repository; verification re-fetches them into a gitignored
// cache (.authority-cache/) and re-digests.
//
// Checks performed:
//   1. Manifest shape: every entry carries the fields its kind requires and
//      names either one `family` or a non-empty `families` set.
//   2. Byte fidelity: each entry's source is fetched and re-digested.
//      A digest or size mismatch is MOVED. A git-tree entry pins a commit and
//      digests a probe file inside the pinned tree (git content addressing
//      makes the commit immutable; the probe proves the commit still serves
//      its bytes).
//   3. Tag fidelity: each entry naming a tag has that tag resolved via
//      `git ls-remote` (annotated tags peeled); a tag that no longer resolves
//      to the pinned commit is TAG-MOVED.
//   4. Pin completeness, named -> pinned: every http(s) URL and every 40-hex
//      commit SHA in the binding-spec texts is covered by a manifest entry or
//      by the manifest's explicit informative-citation list. An uncovered
//      citation is NAMED-UNPINNED.
//   5. Pin completeness, pinned -> cited: every manifest entry's citedBy files
//      exist and contain at least one of its match tokens. A dangling entry is
//      PINNED-UNUSED.
//      An entry carrying "status": "reference-only" pins bytes deliberately
//      cited by nothing. Its completeness check is INVERTED rather than
//      skipped: its match tokens must appear in NO spec text, so the moment a
//      specification cites it the entry fails as REFERENCE-ONLY-CITED and the
//      status has to be dropped deliberately. Byte and tag fidelity are
//      unchanged.
//
// Network failure is a distinct, named condition (UNREACHABLE), never a
// silent pass.
//
// Exits 0 when every entry is OK and both completeness directions hold;
// 1 on any MOVED, TAG-MOVED, NAMED-UNPINNED, PINNED-UNUSED,
// REFERENCE-ONLY-CITED, or manifest defect; 3 when the only failures are
// UNREACHABLE (network); 2 on usage/IO error.
//
// Usage: node scripts/verify-authority-pins.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_ROOT = resolve(__dirname, "..");
const MANIFEST = join(SPEC_ROOT, "binding-specs", "AUTHORITY-PINS.json");
const CACHE = join(SPEC_ROOT, ".authority-cache");

const BINDING_SPECS = join(SPEC_ROOT, "binding-specs");
const SPEC_TEXTS = readdirSync(BINDING_SPECS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) =>
    readdirSync(join(BINDING_SPECS, entry.name))
      .filter((name) => /^openbindings\..+\.md$/.test(name))
      .map((name) => `binding-specs/${entry.name}/${name}`),
  )
  .sort();
SPEC_TEXTS.push("binding-specs/README.md");

const problems = []; // { kind, message } — kind: moved | unreachable | completeness | manifest
const seenProblems = new Set();
function problem(kind, message) {
  const key = `${kind}\0${message}`;
  if (seenProblems.has(key)) return;
  seenProblems.add(key);
  problems.push({ kind, message });
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
} catch (err) {
  console.error(`cannot read manifest ${MANIFEST}: ${err.message}`);
  process.exit(2);
}
const entries = manifest.entries ?? [];
if (!Array.isArray(entries) || entries.length === 0) {
  console.error("manifest has no entries");
  process.exit(2);
}

// ---------------------------------------------------------------------------
// 1. Manifest shape.
// ---------------------------------------------------------------------------

const REFERENCE_ONLY = "reference-only";
const isReferenceOnly = (e) => e.status === REFERENCE_ONLY;

const seenIds = new Set();
for (const e of entries) {
  const where = `entry ${e.id ?? "<no id>"}`;
  if (!e.id || seenIds.has(e.id)) problem("manifest", `${where}: missing or duplicate id`);
  seenIds.add(e.id);

  if (e.family !== undefined && e.families !== undefined) {
    problem("manifest", `${where}: family and families are mutually exclusive`);
  } else if (e.family !== undefined) {
    if (typeof e.family !== "string" || e.family.trim() === "")
      problem("manifest", `${where}: family must be a non-empty string`);
  } else if (!Array.isArray(e.families) || e.families.length === 0) {
    problem("manifest", `${where}: missing family/families`);
  } else {
    if (e.families.some((family) => typeof family !== "string" || family.trim() === ""))
      problem("manifest", `${where}: families must contain only non-empty strings`);
    if (new Set(e.families).size !== e.families.length)
      problem("manifest", `${where}: families contains duplicates`);
  }

  if (e.status !== undefined && !isReferenceOnly(e))
    problem("manifest", `${where}: unknown status ${JSON.stringify(e.status)}`);
  if (isReferenceOnly(e)) {
    if (typeof e.reason !== "string" || e.reason.trim() === "")
      problem("manifest", `${where}: ${REFERENCE_ONLY} entry needs a non-empty reason`);
    if (!Array.isArray(e.citedBy) || e.citedBy.length !== 0)
      problem("manifest", `${where}: ${REFERENCE_ONLY} entry must carry an empty citedBy`);
  } else if (!Array.isArray(e.citedBy) || e.citedBy.length === 0) {
    problem("manifest", `${where}: empty citedBy`);
  }
  if (!Array.isArray(e.matchTokens) || e.matchTokens.length === 0)
    problem("manifest", `${where}: empty matchTokens`);
  if (e.kind === "url") {
    if (!e.url || !/^https?:\/\//.test(e.url)) problem("manifest", `${where}: url kind without url`);
    if (!/^[0-9a-f]{64}$/.test(e.sha256 ?? "")) problem("manifest", `${where}: missing sha256`);
  } else if (e.kind === "git-file") {
    if (!e.repo || !/^[0-9a-f]{40}$/.test(e.commit ?? "") || !e.path)
      problem("manifest", `${where}: git-file kind needs repo, 40-hex commit, path`);
    if (!/^[0-9a-f]{64}$/.test(e.sha256 ?? "")) problem("manifest", `${where}: missing sha256`);
  } else if (e.kind === "git-tree") {
    if (!e.repo || !/^[0-9a-f]{40}$/.test(e.commit ?? ""))
      problem("manifest", `${where}: git-tree kind needs repo and 40-hex commit`);
    if (!e.probe?.path || !/^[0-9a-f]{64}$/.test(e.probe?.sha256 ?? ""))
      problem("manifest", `${where}: git-tree kind needs probe {path, sha256}`);
  } else {
    problem("manifest", `${where}: unknown kind ${JSON.stringify(e.kind)}`);
  }
}

// ---------------------------------------------------------------------------
// 2. Byte fidelity (fetch into the gitignored cache, re-digest).
// ---------------------------------------------------------------------------

mkdirSync(CACHE, { recursive: true });

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function fetchTargetOf(e) {
  if (e.kind === "url") return e.url;
  const path = e.kind === "git-file" ? e.path : e.probe.path;
  return `https://raw.githubusercontent.com/${e.repo}/${e.commit}/${path}`;
}

function expectedOf(e) {
  return e.kind === "git-tree"
    ? { sha256: e.probe.sha256, bytes: e.probe.bytes }
    : { sha256: e.sha256, bytes: e.bytes };
}

async function fetchBytes(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "openbindings-authority-pins/1" },
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.httpStatus = res.status;
    throw err;
  }
  return Buffer.from(await res.arrayBuffer());
}

const CONCURRENCY = 8;
let active = 0;
const waiters = [];
async function withLimit(fn) {
  if (active >= CONCURRENCY) await new Promise((r) => waiters.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiters.shift()?.();
  }
}

const results = new Map(); // id -> "OK" | "MOVED" | "UNREACHABLE"
await Promise.all(
  entries.map((e) =>
    withLimit(async () => {
      const target = fetchTargetOf(e);
      let buf;
      try {
        buf = await fetchBytes(target);
      } catch (err) {
        // A definite HTTP 404/410 at an immutable address means the bytes are
        // gone, which is movement, not weather; everything else (network
        // errors, 5xx, rate limiting) is UNREACHABLE.
        if (err.httpStatus === 404 || err.httpStatus === 410) {
          results.set(e.id, "MOVED");
          problem("moved", `${e.id}: source gone (${err.message}) at ${target}`);
        } else {
          results.set(e.id, "UNREACHABLE");
          problem("unreachable", `${e.id}: ${err.message} at ${target}`);
        }
        return;
      }
      const cacheFile = join(CACHE, e.id + (extname(target.split("?")[0]) || ".bin"));
      writeFileSync(cacheFile, buf);
      const expected = expectedOf(e);
      const actual = sha256(buf);
      if (actual !== expected.sha256 || buf.length !== expected.bytes) {
        results.set(e.id, "MOVED");
        problem(
          "moved",
          `${e.id}: bytes moved — expected sha256 ${expected.sha256.slice(0, 16)}… (${expected.bytes} bytes), ` +
            `got ${actual.slice(0, 16)}… (${buf.length} bytes) at ${target}`,
        );
      } else {
        results.set(e.id, "OK");
      }
    }),
  ),
);

// ---------------------------------------------------------------------------
// 3. Tag fidelity via `git ls-remote` (one call per unique repo+tag).
// ---------------------------------------------------------------------------

const tagPairs = new Map(); // "repo\0tag" -> [entries]
for (const e of entries) {
  if (e.tag) {
    const key = `${e.repo}\0${e.tag}`;
    if (!tagPairs.has(key)) tagPairs.set(key, []);
    tagPairs.get(key).push(e);
  }
}

for (const [key, group] of tagPairs) {
  const [repo, tag] = key.split("\0");
  const r = spawnSync(
    "git",
    ["ls-remote", `https://github.com/${repo}`, `refs/tags/${tag}`, `refs/tags/${tag}^{}`],
    { encoding: "utf8", timeout: 60_000 },
  );
  if (r.status !== 0 || r.error) {
    problem("unreachable", `tag ${repo}#${tag}: ls-remote failed (${r.error?.message ?? r.stderr.trim()})`);
    continue;
  }
  const lines = r.stdout.trim().split("\n").filter(Boolean);
  if (lines.length === 0) {
    problem("moved", `tag ${repo}#${tag}: tag no longer exists`);
    continue;
  }
  // Prefer the peeled (^{}) line — that is the commit an annotated tag names.
  const peeled = lines.find((l) => l.endsWith("^{}"));
  const sha = (peeled ?? lines[0]).split("\t")[0];
  for (const e of group) {
    if (sha !== e.commit) {
      problem("moved", `${e.id}: TAG-MOVED — ${repo}#${tag} now resolves to ${sha}, pin says ${e.commit}`);
      if (results.get(e.id) === "OK") results.set(e.id, "MOVED");
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Completeness, named -> pinned: every URL / commit SHA the binding-spec
//    texts cite is either pinned or explicitly informative.
// ---------------------------------------------------------------------------

function normalizeUrl(u) {
  let s = u.replace(/[.,;:'"”’]+$/, "");
  s = s.replace(/#.*$/, "");
  s = s.replace(/\/+$/, "");
  return s;
}

const pinnedCommits = new Set(entries.filter((e) => e.commit).map((e) => e.commit));
const pinnedUrls = new Set();
for (const e of entries) {
  if (e.url) pinnedUrls.add(normalizeUrl(e.url));
  for (const c of e.citedUrls ?? []) pinnedUrls.add(normalizeUrl(c));
}
const informative = manifest.informativeCitations ?? { exact: [], prefixes: [] };
const informativeExact = new Set((informative.exact ?? []).map(normalizeUrl));
const informativePrefixes = (informative.prefixes ?? []).map((p) => p.replace(/\/+$/, ""));

function urlCovered(url) {
  const n = normalizeUrl(url);
  if (pinnedUrls.has(n)) return true;
  if (informativeExact.has(n)) return true;
  if (informativePrefixes.some((p) => n === p || n.startsWith(p + "/"))) return true;
  const sha = n.match(/\b[0-9a-f]{40}\b/);
  if (sha && pinnedCommits.has(sha[0])) return true;
  return false;
}

for (const rel of SPEC_TEXTS) {
  const file = join(SPEC_ROOT, rel);
  if (!existsSync(file)) {
    problem("manifest", `spec text missing: ${rel}`);
    continue;
  }
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/https?:\/\/[^\s<>()`"'\]]+/g)) {
    if (!urlCovered(m[0])) {
      problem("completeness", `NAMED-UNPINNED: ${rel} cites ${normalizeUrl(m[0])} with no manifest entry`);
    }
  }
  for (const m of text.matchAll(/\b[0-9a-f]{40}\b/g)) {
    if (!pinnedCommits.has(m[0])) {
      problem("completeness", `NAMED-UNPINNED: ${rel} names commit ${m[0]} with no manifest entry`);
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Completeness, pinned -> cited: every entry is actually cited where the
//    manifest says it is.
// ---------------------------------------------------------------------------

const textCache = new Map();
function specText(rel) {
  if (!textCache.has(rel)) {
    const file = join(SPEC_ROOT, rel);
    textCache.set(rel, existsSync(file) ? readFileSync(file, "utf8") : null);
  }
  return textCache.get(rel);
}

for (const e of entries) {
  if (isReferenceOnly(e)) {
    for (const rel of SPEC_TEXTS) {
      const text = specText(rel);
      if (text === null) continue;
      const hit = (e.matchTokens ?? []).find((token) => text.includes(token));
      if (hit !== undefined) {
        problem(
          "completeness",
          `REFERENCE-ONLY-CITED: ${e.id} is marked ${REFERENCE_ONLY} but ${rel} cites ${JSON.stringify(hit)} — ` +
            `drop the status and give the entry a citedBy, or remove the citation`,
        );
      }
    }
    continue;
  }
  for (const rel of e.citedBy ?? []) {
    const text = specText(rel);
    if (text === null) {
      problem("completeness", `PINNED-UNUSED: ${e.id} cites missing file ${rel}`);
      continue;
    }
    if (!e.matchTokens.some((t) => text.includes(t))) {
      problem("completeness", `PINNED-UNUSED: ${e.id} is not cited by ${rel} (no match token found)`);
    }
  }
}

// ---------------------------------------------------------------------------
// Report.
// ---------------------------------------------------------------------------

const counts = { OK: 0, MOVED: 0, UNREACHABLE: 0 };
for (const e of entries) {
  const status = results.get(e.id) ?? "UNREACHABLE";
  counts[status] = (counts[status] ?? 0) + 1;
  if (status !== "OK") console.log(`${status.padEnd(11)} ${e.id}`);
}
const referenceOnly = entries.filter(isReferenceOnly);
console.log(
  `\nauthority pins: ${counts.OK} OK, ${counts.MOVED} MOVED, ${counts.UNREACHABLE} UNREACHABLE ` +
    `(${entries.length} entries; ${tagPairs.size} tags checked; ` +
    `${referenceOnly.length} reference-only: ${referenceOnly.map((e) => e.id).join(", ") || "none"})`,
);

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  [${p.kind}] ${p.message}`);
  const hard = problems.some((p) => p.kind !== "unreachable");
  process.exit(hard ? 1 : 3);
}
console.log("authority-pin manifest verified: all entries OK, completeness holds both directions.");
