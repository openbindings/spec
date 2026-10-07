#!/usr/bin/env node
// Generates conformance/manifest.json by walking the validity fixtures in
// conformance/document/ and the scenarios in conformance/scenarios/. Re-run
// after changing any of them.
//
// The manifest records, per file, its counts and the rule or section it
// cites; per action, how many cases use it; and totals, including how many
// rules of openbindings.md section 10 have a complete fixture file.
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

const RULE = /^OBI-\d{2}$/;
const actions = {};
const files = listJSON("document").map(({ relPath, absPath }) => {
  const fixture = load(absPath);
  const tests = fixture.tests || [];
  actions["validity fixture"] = (actions["validity fixture"] || 0) + tests.length;
  return {
    path: relPath,
    ...(fixture.rule ? { rule: fixture.rule } : {}),
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
  }
  return {
    path: relPath,
    section: file.section,
    format: file.format,
    scenarios: file.scenarios?.length ?? 0,
    actions: Object.fromEntries(Object.entries(byAction).sort(byKey)),
  };
});

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
    rulesCoveredDocument: files.filter((f) => RULE.test(f.rule ?? "") && isComplete(f)).length,
    rulesPartialDocument: files.filter((f) => RULE.test(f.rule ?? "") && !isComplete(f)).length,
    sectionsCited: [...new Set([...files, ...scenarioFiles].filter((f) => !f.rule).map((f) => f.section))].sort((a, b) => a.localeCompare(b, "en", { numeric: true })),
  },
  actions: Object.fromEntries(Object.entries(actions).sort(byKey)),
  files,
  scenarioFiles,
};

const outPath = join(CONFORMANCE_ROOT, "manifest.json");
writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
console.log(`  ${files.length} fixture files, ${manifest.totals.tests} tests (${manifest.totals.positives} positive, ${manifest.totals.negatives} negative); rules with complete fixtures: ${manifest.totals.rulesCoveredDocument}`);
console.log(`  ${scenarioFiles.length} scenario files, ${manifest.totals.scenarios} scenarios; sections cited: ${manifest.totals.sectionsCited.join(", ")}`);
