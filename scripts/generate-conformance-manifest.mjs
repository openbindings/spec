#!/usr/bin/env node
// Generates conformance/manifest.json by walking validity fixtures in
// conformance/{document,tool}/ and tool scenarios in conformance/scenarios/,
// with the clause inventory in conformance/clauses.json. Re-run after
// changing any of them.
//
// The manifest records, per file, its counts; per action, how many cases
// use it; and per tool-rule clause, its class, its recorded status, and the
// cases that cite it (scenario IDs, and fixture tests as path#/tests/N).
// Coverage counts come from the clause statuses: a tool rule counts as
// covered only when every obligation-type clause of it is tested, directly or
// through all its alternatives or specializations. Adapter-only work,
// composition, contrast tools, and clauses with no executor never count.
//
// Usage: node scripts/generate-conformance-manifest.mjs

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_ROOT = resolve(__dirname, "..");
const CONFORMANCE_ROOT = join(SPEC_ROOT, "conformance");

function listJSON(sub) {
  const dir = join(CONFORMANCE_ROOT, sub);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith(".json"))
    .sort()
    .map((n) => ({ relPath: `${sub}/${n}`, absPath: join(dir, n) }));
}

const load = (absPath) => JSON.parse(readFileSync(absPath, "utf8"));
const byKey = ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0);

function readSpec() {
  const md = readFileSync(join(SPEC_ROOT, "openbindings.md"), "utf8");
  const version = md.match(/^# OpenBindings Specification \(v([^)]+)\)/m)?.[1] ?? "unknown";
  const status = md.match(/^## Status of this document\n+([^\n]+)/m)?.[1] ?? "";
  return { version, workingDraft: /unreleased working draft/.test(status) };
}

function releasedVersions() {
  const dir = join(SPEC_ROOT, "versions");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d+\.\d+\.\d+/.test(e.name))
    .map((e) => e.name)
    .sort();
}

const TESTED = new Set(["tested", "tested through its alternatives", "tested through its specializations", "tested through its exercised alternative"]);
const UNIT_CLASSES = new Set(["obligation", "specialization", "alternative"]);

const inventory = load(join(CONFORMANCE_ROOT, "clauses.json"));
const clauseItems = [];
for (const rule of inventory.rules) {
  for (const c of rule.clauses) clauseItems.push({ rule: rule.rule, ...c });
  for (const inc of rule.incorporations || []) for (const s of inc.segments) if (s.id) clauseItems.push({ rule: rule.rule, ...s });
}
const citations = new Map(clauseItems.map((c) => [c.id, []]));
const cite = (clauses, caseRef) => {
  for (const c of clauses || []) citations.get(c)?.push(caseRef);
};

const actions = {};
const files = listJSON("document")
  .concat(listJSON("tool"))
  .map(({ relPath, absPath }) => {
    const fixture = load(absPath);
    const tests = fixture.tests || [];
    tests.forEach((t, i) => cite(t.clauses, `${relPath}#/tests/${i}`));
    actions["validity fixture"] = (actions["validity fixture"] || 0) + tests.length;
    return {
      path: relPath,
      rule: fixture.rule,
      section: fixture.section,
      tests: tests.length,
      positives: tests.filter((t) => t.valid === true).length,
      negatives: tests.filter((t) => t.valid === false).length,
      ...(fixture.coverage ? { coverage: fixture.coverage } : {}),
    };
  });

const scenarioFiles = listJSON("scenarios").map(({ relPath, absPath }) => {
  const file = load(absPath);
  const byAction = {};
  for (const s of file.scenarios || []) {
    byAction[s.action] = (byAction[s.action] || 0) + 1;
    actions[s.action] = (actions[s.action] || 0) + 1;
    cite(s.clauses, s.id);
  }
  return {
    path: relPath,
    rule: file.rule,
    section: file.section,
    format: file.format,
    scenarios: file.scenarios?.length ?? 0,
    actions: Object.fromEntries(Object.entries(byAction).sort(byKey)),
  };
});

const clauses = {};
const unitsByStatus = {};
for (const c of clauseItems) {
  clauses[c.id] = { rule: c.rule, class: c.class, status: c.status, cases: citations.get(c.id) };
  if (UNIT_CLASSES.has(c.class)) unitsByStatus[c.status] = (unitsByStatus[c.status] || 0) + 1;
}
const toolRules = inventory.rules.map((r) => r.rule);
const rulesCoveredTool = toolRules.filter((rule) =>
  clauseItems.filter((c) => c.rule === rule && UNIT_CLASSES.has(c.class)).every((c) => TESTED.has(c.status)),
);
const rulesWithCases = new Set(clauseItems.filter((c) => citations.get(c.id).length > 0).map((c) => c.rule));

const isComplete = (f) => !f.coverage;
const spec = readSpec();
const manifest = {
  specVersion: spec.version,
  workingDraft: spec.workingDraft,
  releasedVersions: releasedVersions(),
  corpusVersion: "0.2.0",
  totals: {
    files: files.length + scenarioFiles.length,
    fixtureFiles: files.length,
    scenarioFiles: scenarioFiles.length,
    tests: files.reduce((n, f) => n + f.tests, 0),
    scenarios: scenarioFiles.reduce((n, f) => n + f.scenarios, 0),
    positives: files.reduce((n, f) => n + f.positives, 0),
    negatives: files.reduce((n, f) => n + f.negatives, 0),
    rulesCoveredDocument: files.filter((f) => f.rule.startsWith("OBI-D-") && isComplete(f)).length,
    rulesPartialDocument: files.filter((f) => f.rule.startsWith("OBI-D-") && !isComplete(f)).length,
    rulesCoveredTool: rulesCoveredTool.length,
    rulesPartialTool: toolRules.filter((r) => rulesWithCases.has(r) && !rulesCoveredTool.includes(r)).length,
    clauseIds: clauseItems.length,
    clauseUnits: clauseItems.filter((c) => UNIT_CLASSES.has(c.class)).length,
    clauseUnitsTested: clauseItems.filter((c) => UNIT_CLASSES.has(c.class) && TESTED.has(c.status)).length,
    clauseUnitsByStatus: Object.fromEntries(Object.entries(unitsByStatus).sort(byKey)),
  },
  actions: Object.fromEntries(Object.entries(actions).sort(byKey)),
  files,
  scenarioFiles,
  clauses,
};

const outPath = join(CONFORMANCE_ROOT, "manifest.json");
writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
console.log(`  ${files.length} fixture files, ${manifest.totals.tests} tests (${manifest.totals.positives} positive, ${manifest.totals.negatives} negative)`);
console.log(`  ${scenarioFiles.length} scenario files, ${manifest.totals.scenarios} scenarios`);
console.log(`  ${manifest.totals.clauseIds} clause IDs; ${manifest.totals.clauseUnitsTested} of ${manifest.totals.clauseUnits} obligation-type clauses tested; tool rules covered ${manifest.totals.rulesCoveredTool}, partial ${manifest.totals.rulesPartialTool}`);
