#!/usr/bin/env node
// Generates conformance/manifest.json by walking the fixture files in
// conformance/document/ and conformance/tool/. Re-run after adding or
// modifying fixtures.
//
// Usage: node scripts/generate-conformance-manifest.mjs

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_ROOT = resolve(__dirname, "..");
const CONFORMANCE_ROOT = join(SPEC_ROOT, "conformance");
const SUBDIRS = ["document", "tool"];

function listFixtures() {
  const out = [];
  for (const sub of SUBDIRS) {
    const dir = join(CONFORMANCE_ROOT, sub);
    let entries;
    try {
      entries = readdirSync(dir);
    } catch (e) {
      if (e.code === "ENOENT") continue;
      throw e;
    }
    for (const name of entries.sort()) {
      if (!name.endsWith(".json")) continue;
      out.push({ relPath: `${sub}/${name}`, absPath: join(dir, name) });
    }
  }
  return out;
}

function loadFixture(absPath) {
  const data = readFileSync(absPath, "utf8");
  return JSON.parse(data);
}

function readSpecVersion() {
  const md = readFileSync(join(SPEC_ROOT, "openbindings.md"), "utf8");
  const match = md.match(/^# OpenBindings Specification \(v([^)]+)\)/m);
  return match ? match[1] : "unknown";
}

function summarize(fixture) {
  const tests = fixture.tests || [];
  const positives = tests.filter((t) => t.valid === true).length;
  const negatives = tests.filter((t) => t.valid === false).length;
  return { tests: tests.length, positives, negatives };
}

const fixtures = listFixtures();
const files = fixtures.map(({ relPath, absPath }) => {
  const fixture = loadFixture(absPath);
  const { tests, positives, negatives } = summarize(fixture);
  return {
    path: relPath,
    rule: fixture.rule,
    section: fixture.section,
    tests,
    positives,
    negatives,
  };
});

const totals = files.reduce(
  (acc, f) => {
    acc.tests += f.tests;
    acc.positives += f.positives;
    acc.negatives += f.negatives;
    return acc;
  },
  { tests: 0, positives: 0, negatives: 0 }
);

const documentRules = files.filter((f) => f.rule.startsWith("OBI-D-")).length;
const toolRules = files.filter((f) => f.rule.startsWith("OBI-T-")).length;

const manifest = {
  specVersion: readSpecVersion(),
  corpusVersion: "0.1.0",
  totals: {
    files: files.length,
    tests: totals.tests,
    positives: totals.positives,
    negatives: totals.negatives,
    rulesCoveredDocument: documentRules,
    rulesCoveredTool: toolRules,
  },
  files,
};

const outPath = join(CONFORMANCE_ROOT, "manifest.json");
writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
console.log(`  ${files.length} files, ${totals.tests} tests (${totals.positives} positive, ${totals.negatives} negative)`);
