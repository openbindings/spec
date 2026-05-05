#!/usr/bin/env node
// verify-comparison-corpus.mjs
//
// CI gate for conformance/comparison. Verifies:
//   1. Every comparison fixture validates against conventions/schemas/fixture.schema.json.
//   2. The fixture schema resolves and compiles with report.schema.json.
//   3. conformance/comparison/manifest.json matches the on-disk fixture set.
//   4. Each expected report's summary counts match its emitted findings.
//   5. Each expected input content hash matches the embedded left/right document.
//   6. Coverage, verdict collapse, and reason references are internally consistent.

import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = dirname(__filename);
const SPEC_ROOT = resolve(SCRIPT_DIR, "..", "..");
const COMPARISON_ROOT = join(SPEC_ROOT, "conformance", "comparison");

const FILES = {
  fixtureSchema: join(SPEC_ROOT, "conventions", "schemas", "fixture.schema.json"),
  reportSchema: join(SPEC_ROOT, "conventions", "schemas", "report.schema.json"),
  manifest: join(COMPARISON_ROOT, "manifest.json"),
};

const errors = [];
const note = (msg) => errors.push(msg);

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.error(`fatal: cannot read/parse ${path}: ${e.message}`);
    process.exit(2);
  }
}

function listFixtures() {
  try {
    return walkJson(COMPARISON_ROOT)
      .filter((entry) => entry.relPath !== "manifest.json")
      .sort((a, b) => a.relPath.localeCompare(b.relPath));
  } catch (e) {
    console.error(`fatal: cannot list ${COMPARISON_ROOT}: ${e.message}`);
    process.exit(2);
  }
}

function walkJson(dir, base = "") {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    const absPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkJson(absPath, relPath));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      out.push({ relPath, absPath });
    }
  }
  return out;
}

function collectFindings(report) {
  const out = [];
  for (const op of report.operations || []) {
    for (const finding of op.findings || []) out.push(finding);
  }
  for (const section of ["schemas", "metadata", "sources", "bindings", "transforms", "security"]) {
    for (const delta of report[section] || []) {
      for (const finding of delta.findings || []) out.push(finding);
    }
  }
  return out;
}

function collectPositions(report) {
  const out = [];
  for (const op of report.operations || []) {
    if (op.input) out.push(op.input);
    if (op.output) out.push(op.output);
  }
  return out;
}

function recomputeCoverage(report) {
  const coverage = {
    total_operations: 0,
    paired: 0,
    only_left: 0,
    only_right: 0,
    paired_via: { direct: 0, alias: 0, satisfies: 0 },
  };

  for (const op of report.operations || []) {
    if (op.status === "paired") {
      coverage.paired += 1;
      coverage.total_operations += 1;
      if (op.match?.strategy in coverage.paired_via) {
        coverage.paired_via[op.match.strategy] += 1;
      }
    } else if (op.status === "only_left") {
      coverage.only_left += 1;
      coverage.total_operations += 1;
    } else if (op.status === "only_right") {
      coverage.only_right += 1;
    }
  }

  return coverage;
}

function recomputeVerdict(report, findings) {
  const positions = collectPositions(report);
  if (positions.some((position) => position.verdict === "indeterminate")) return "indeterminate";
  if (
    positions.some((position) => position.verdict === "incompatible") ||
    findings.some((finding) => (finding.category || []).includes("breaking"))
  ) {
    return "incompatible";
  }
  if (positions.some((position) => position.verdict === "unverified")) return "unverified";
  return "compatible";
}

function findingKey(kind, side, pointer) {
  return `${kind}\u0000${side}\u0000${pointer}`;
}

function verifyReasonReferences(relPath, report) {
  for (const op of report.operations || []) {
    const active = new Set(
      (op.findings || []).map((finding) =>
        findingKey(finding.kind, finding.location?.side, finding.location?.pointer)
      )
    );
    for (const positionName of ["input", "output"]) {
      const position = op[positionName];
      if (!position) continue;
      for (const reason of position.reasons || []) {
        const key = findingKey(reason.kind, reason.side, reason.pointer);
        if (!active.has(key)) {
          note(`${relPath}: ${positionName}.reasons references no active operation finding: ${reason.kind} ${reason.side} ${reason.pointer}`);
        }
      }
    }
  }
}

function compareObject(label, actual, expected) {
  const a = stableStringify(actual);
  const e = stableStringify(expected);
  if (a !== e) note(`${label}: expected ${e}, got ${a}`);
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  return "{" + Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",") + "}";
}

function contentSha256(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

const Ajv2020 = (await import("ajv/dist/2020.js")).default;
const ajv = new Ajv2020({ allErrors: true, strict: false });
const reportSchema = readJson(FILES.reportSchema);
const fixtureSchema = readJson(FILES.fixtureSchema);
ajv.addSchema(reportSchema, "report.schema.json");
const validateFixture = ajv.compile(fixtureSchema);

const manifest = readJson(FILES.manifest);
const fixtures = listFixtures();
const manifestByPath = new Map((manifest.files || []).map((entry) => [entry.path, entry]));

for (const { relPath, absPath } of fixtures) {
  const fixture = readJson(absPath);

  if (!validateFixture(fixture)) {
    for (const err of validateFixture.errors || []) {
      note(`${relPath}: schema ${err.instancePath} ${err.message}`);
    }
    continue;
  }

  const report = fixture.expected;
  const findings = collectFindings(report);

  if (report.inputs?.left?.content_sha256 !== contentSha256(fixture.left)) {
    note(`${relPath}: expected.inputs.left.content_sha256 does not match fixture.left`);
  }
  if (report.inputs?.right?.content_sha256 !== contentSha256(fixture.right)) {
    note(`${relPath}: expected.inputs.right.content_sha256 does not match fixture.right`);
  }

  const counts = {};
  const categories = { breaking: 0, non_breaking: 0, compliance: 0, structural: 0 };
  for (const finding of findings) {
    counts[finding.kind] = (counts[finding.kind] || 0) + 1;
    for (const category of finding.category || []) {
      if (category in categories) categories[category] += 1;
    }
  }

  compareObject(`${relPath}: summary.counts`, report.summary.counts, counts);
  compareObject(`${relPath}: summary.categories`, report.summary.categories, categories);
  compareObject(`${relPath}: summary.coverage`, report.summary.coverage, recomputeCoverage(report));
  compareObject(`${relPath}: summary.verdict`, report.summary.verdict, recomputeVerdict(report, findings));
  verifyReasonReferences(relPath, report);

  const entry = manifestByPath.get(relPath);
  if (!entry) {
    note(`manifest: missing entry for ${relPath}`);
    continue;
  }
  const firstPosition = report.operations?.find((op) => op.input || op.output);
  const direction = firstPosition?.input ? "input" : firstPosition?.output ? "output" : null;
  compareObject(`${relPath}: manifest`, entry, {
    path: relPath,
    mode: fixture.mode,
    direction,
    verdict: report.summary.verdict,
    findings: findings.map((f) => f.kind),
  });
}

for (const path of manifestByPath.keys()) {
  if (!fixtures.some((fixture) => fixture.relPath === path)) {
    note(`manifest: entry for missing fixture ${path}`);
  }
}

const verdicts = {};
const modes = {};
for (const { absPath } of fixtures) {
  const fixture = readJson(absPath);
  const v = fixture.expected.summary.verdict;
  verdicts[v] = (verdicts[v] || 0) + 1;
  modes[fixture.mode] = (modes[fixture.mode] || 0) + 1;
}
compareObject("manifest.totals", manifest.totals, {
  files: fixtures.length,
  modes,
  verdicts,
});

if (errors.length > 0) {
  console.error(`comparison corpus verification FAILED (${errors.length} issue${errors.length === 1 ? "" : "s"}):`);
  for (const msg of errors) console.error("  - " + msg);
  process.exit(1);
}

console.log(`comparison corpus verification OK: ${fixtures.length} fixture${fixtures.length === 1 ? "" : "s"} checked.`);
