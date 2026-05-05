#!/usr/bin/env node
// Verifies the conformance corpus against the spec.
//
// Checks performed:
//   1. Every OBI-D-## and OBI-T-## rule defined in openbindings.md §16 has
//      either a fixture file OR an entry in conformance/README.md's deferred
//      rules table.
//   2. Every fixture file's `rule` field references a real rule defined in §16.
//   3. Every fixture file's `section` field matches the rule's actual section.
//   4. Every `violates` entry in any test case references a real rule.
//   5. Every fixture file conforms structurally to the shape declared in
//      conformance/fixture.schema.json (basic checks performed inline; full
//      schema validation requires a JSON Schema validator).
//
// Exits 0 on success, 1 on any drift, 2 on usage/IO error.
//
// Usage: node scripts/verify-corpus.mjs

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_ROOT = resolve(__dirname, "..");
const SPEC_MD = join(SPEC_ROOT, "openbindings.md");
const CONFORMANCE_ROOT = join(SPEC_ROOT, "conformance");
const README = join(CONFORMANCE_ROOT, "README.md");

const errors = [];
const warnings = [];

function err(msg) {
  errors.push(msg);
}

function warn(msg) {
  warnings.push(msg);
}

function extractSpecRules(md) {
  // Match lines like:
  //   - **OBI-D-01**: Is valid UTF-8 ...
  //   - **OBI-T-04** (Inspection): Refuses ...
  const rules = new Map();
  const re = /^\s*-\s*\*\*(OBI-[DT]-\d+)\*\*[^:]*:\s*(.*)$/gm;
  let m;
  while ((m = re.exec(md)) !== null) {
    const id = m[1];
    const desc = m[2].trim();
    rules.set(id, desc);
  }
  return rules;
}

function inferSectionForRule(ruleId) {
  return ruleId.startsWith("OBI-D-") ? "16.2" : "16.3";
}

function listFixtures() {
  const out = [];
  for (const sub of ["document", "tool"]) {
    const dir = join(CONFORMANCE_ROOT, sub);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith(".json")) continue;
      out.push({ relPath: `${sub}/${name}`, absPath: join(dir, name) });
    }
  }
  return out;
}

function loadFixture(absPath) {
  return JSON.parse(readFileSync(absPath, "utf8"));
}

function extractDeferredRules(readme) {
  // Look in the status table for rows mentioning OBI-T-## with "Deferred"
  const out = new Set();
  const re = /\|\s*(OBI-[DT]-\d+(?:\s*,\s*OBI-[DT]-\d+)*)\s*\|\s*\*\*Deferred/g;
  let m;
  while ((m = re.exec(readme)) !== null) {
    for (const id of m[1].split(/\s*,\s*/)) {
      out.add(id);
    }
  }
  return out;
}

function validateFixtureShape(fixture, label) {
  if (typeof fixture !== "object" || fixture === null) {
    err(`${label}: not an object`);
    return;
  }
  for (const f of ["rule", "section", "description", "tests"]) {
    if (!(f in fixture)) {
      err(`${label}: missing required field '${f}'`);
    }
  }
  if ("rule" in fixture && !/^OBI-[DT]-\d+$/.test(fixture.rule)) {
    err(`${label}: rule '${fixture.rule}' does not match OBI-[DT]-NN pattern`);
  }
  if ("tests" in fixture) {
    if (!Array.isArray(fixture.tests)) {
      err(`${label}: tests is not an array`);
      return;
    }
    if (fixture.tests.length === 0) {
      err(`${label}: tests array is empty`);
    }
    fixture.tests.forEach((t, i) => {
      const tlabel = `${label}.tests[${i}]`;
      for (const f of ["description", "document", "valid"]) {
        if (!(f in t)) {
          err(`${tlabel}: missing required field '${f}'`);
        }
      }
      if ("valid" in t && typeof t.valid !== "boolean") {
        err(`${tlabel}: valid is not a boolean`);
      }
      if ("violates" in t) {
        if (!Array.isArray(t.violates)) {
          err(`${tlabel}: violates is not an array`);
        } else {
          t.violates.forEach((v, j) => {
            if (!/^OBI-[DT]-\d+$/.test(v)) {
              err(`${tlabel}.violates[${j}]: '${v}' does not match OBI-[DT]-NN pattern`);
            }
          });
        }
      }
    });
  }
}

const md = readFileSync(SPEC_MD, "utf8");
const readme = readFileSync(README, "utf8");
const specRules = extractSpecRules(md);
const deferredRules = extractDeferredRules(readme);
const fixtures = listFixtures();

const fixtureRules = new Map();
for (const { relPath, absPath } of fixtures) {
  let fixture;
  try {
    fixture = loadFixture(absPath);
  } catch (e) {
    err(`${relPath}: failed to parse JSON: ${e.message}`);
    continue;
  }
  validateFixtureShape(fixture, relPath);
  if (fixture.rule && /^OBI-[DT]-\d+$/.test(fixture.rule)) {
    if (fixtureRules.has(fixture.rule)) {
      err(`Multiple fixture files declare rule ${fixture.rule}: ${fixtureRules.get(fixture.rule)} and ${relPath}`);
    } else {
      fixtureRules.set(fixture.rule, relPath);
    }
    if (!specRules.has(fixture.rule)) {
      err(`${relPath}: rule '${fixture.rule}' is not defined in openbindings.md §16`);
    }
    const expectedSection = inferSectionForRule(fixture.rule);
    if (fixture.section !== expectedSection) {
      err(`${relPath}: section is '${fixture.section}', expected '${expectedSection}' for ${fixture.rule}`);
    }
    // Verify violates references resolve
    for (let i = 0; i < (fixture.tests || []).length; i++) {
      const t = fixture.tests[i];
      if (Array.isArray(t.violates)) {
        for (const v of t.violates) {
          if (!specRules.has(v)) {
            err(`${relPath}.tests[${i}].violates: rule '${v}' is not defined in openbindings.md §16`);
          }
        }
      }
    }
  }
}

// Coverage check: every spec rule is either covered by a fixture OR deferred
for (const ruleId of specRules.keys()) {
  if (!fixtureRules.has(ruleId) && !deferredRules.has(ruleId)) {
    err(`Spec rule ${ruleId} has no fixture file and is not listed as deferred in conformance/README.md`);
  }
}

// Sanity: deferred rules should not also have fixtures
for (const ruleId of deferredRules) {
  if (fixtureRules.has(ruleId)) {
    warn(`Rule ${ruleId} is listed as deferred in README but also has a fixture file at ${fixtureRules.get(ruleId)}`);
  }
}

// Report
console.log(`Spec rules found in §16: ${specRules.size}`);
console.log(`Fixture files: ${fixtures.length}`);
console.log(`Rules covered by fixtures: ${fixtureRules.size}`);
console.log(`Rules deferred per README: ${deferredRules.size}`);
console.log(`Rules accounted for: ${fixtureRules.size + deferredRules.size} of ${specRules.size}`);

if (warnings.length > 0) {
  console.log(`\nWarnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  - ${w}`);
}
if (errors.length > 0) {
  console.log(`\nErrors (${errors.length}):`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}

console.log(`\nOK`);
