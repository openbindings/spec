#!/usr/bin/env node
// Verifies the conformance corpus against the spec.
//
// Checks performed:
//   1. Every OBI-D-## and OBI-T-## rule defined in openbindings.md §10 has
//      either a validity fixture, a portable tool scenario file, or an entry
//      in conformance/README.md's deferred-rules table.
//   2. Every fixture file's `rule` field references a real rule defined in §10.
//   3. Every fixture file's `section` field matches the rule's actual section.
//   4. Every `violates` entry in any test case references a real rule.
//   5. Every fixture and scenario file validates against its published JSON
//      Schema and passes the additional semantic checks performed inline.
//
// Exits 0 on success, 1 on any drift, 2 on usage/IO error.
//
// Usage: node scripts/verify-corpus.mjs

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_ROOT = resolve(__dirname, "..");
const SPEC_MD = join(SPEC_ROOT, "openbindings.md");
const CONFORMANCE_ROOT = join(SPEC_ROOT, "conformance");
const README = join(CONFORMANCE_ROOT, "README.md");
const FIXTURE_SCHEMA = join(CONFORMANCE_ROOT, "fixture.schema.json");
const SCENARIO_SCHEMA = join(CONFORMANCE_ROOT, "tool-scenario.schema.json");

const errors = [];
const warnings = [];

function err(msg) {
  errors.push(msg);
}

function warn(msg) {
  warnings.push(msg);
}

function validateAgainstSchema(schemaPath, dataPath, label) {
  const result = spawnSync(
    "ajv",
    ["validate", "-s", schemaPath, "-d", dataPath, "--spec=draft2020"],
    { encoding: "utf8" }
  );
  if (result.error) {
    console.error(
      "Failed to run ajv. Install it with: npm i -g ajv-cli ajv-formats"
    );
    process.exit(2);
  }
  if (result.status !== 0) {
    err(
      `${label}: does not match ${schemaPath.split("/").at(-1)}\n${(result.stdout || "") + (result.stderr || "")}`
    );
  }
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
  return ruleId.startsWith("OBI-D-") ? "10.2" : "10.3";
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

function listScenarioFiles() {
  const dir = join(CONFORMANCE_ROOT, "scenarios");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => ({ relPath: `scenarios/${name}`, absPath: join(dir, name) }));
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
      for (const f of ["description", "valid"]) {
        if (!(f in t)) {
          err(`${tlabel}: missing required field '${f}'`);
        }
      }
      const inputs = ["document", "documentText", "documentBase64"].filter((f) => f in t);
      if (inputs.length !== 1) {
        err(`${tlabel}: exactly one of document, documentText, or documentBase64 is required`);
      }
      if ("documentText" in t && typeof t.documentText !== "string") {
        err(`${tlabel}: documentText is not a string`);
      }
      if ("documentBase64" in t) {
        if (typeof t.documentBase64 !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(t.documentBase64)) {
          err(`${tlabel}: documentBase64 is not canonical base64 text`);
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

const scenarioActions = new Map([
  ["OBI-T-11", "resolve-schema-cycle"],
  ["OBI-T-12", "resolve-operation"],
  ["OBI-T-16", "validate-operation-values"],
  ["OBI-T-17", "conclude-verification"],
]);

function validateScenarioFileShape(file, label) {
  if (typeof file !== "object" || file === null) {
    err(`${label}: not an object`);
    return;
  }
  for (const f of ["format", "rule", "section", "description", "scenarios"]) {
    if (!(f in file)) err(`${label}: missing required field '${f}'`);
  }
  if (file.format !== "openbindings.core-tool-scenarios@1") {
    err(`${label}: unsupported format '${file.format}'`);
  }
  if (!scenarioActions.has(file.rule)) {
    err(`${label}: rule '${file.rule}' is not a scenario-covered core tool rule`);
  }
  if (!Array.isArray(file.scenarios) || file.scenarios.length === 0) {
    err(`${label}: scenarios must be a non-empty array`);
    return;
  }
  const ids = new Set();
  const expectedAction = scenarioActions.get(file.rule);
  const expectedID = new RegExp(`^${file.rule?.replace("OBI-T-", "T")}-S-[0-9]{2}$`);
  file.scenarios.forEach((scenario, i) => {
    const slabel = `${label}.scenarios[${i}]`;
    if (typeof scenario !== "object" || scenario === null) {
      err(`${slabel}: not an object`);
      return;
    }
    for (const f of ["id", "description", "action", "given", "expected"]) {
      if (!(f in scenario)) err(`${slabel}: missing required field '${f}'`);
    }
    if (typeof scenario.id !== "string" || !expectedID.test(scenario.id)) {
      err(`${slabel}: id '${scenario.id}' does not match rule ${file.rule}`);
    } else if (ids.has(scenario.id)) {
      err(`${slabel}: duplicate scenario id '${scenario.id}'`);
    } else {
      ids.add(scenario.id);
    }
    if (scenario.action !== expectedAction) {
      err(`${slabel}: action '${scenario.action}' does not match ${file.rule}'s '${expectedAction}'`);
    }
    if (typeof scenario.description !== "string" || scenario.description.length === 0) {
      err(`${slabel}: description must be a non-empty string`);
    }
    if (typeof scenario.given !== "object" || scenario.given === null || Array.isArray(scenario.given)) {
      err(`${slabel}: given must be an object`);
      return;
    }
    if (typeof scenario.expected !== "object" || scenario.expected === null || Array.isArray(scenario.expected)) {
      err(`${slabel}: expected must be an object`);
      return;
    }
    validateScenarioActionShape(file.rule, scenario, slabel);
  });
}

function validateScenarioActionShape(rule, scenario, label) {
  const given = scenario.given;
  const expected = scenario.expected;
  if (rule === "OBI-T-11") {
    if (!("document" in given) || typeof given.operation !== "string" || !["input", "output"].includes(given.side) || !("value" in given)) {
      err(`${label}: schema-cycle given requires document, operation, input|output side, and value`);
    }
    const allowed = expected.allowedOutcomes;
    if (expected.terminates !== true || !Array.isArray(allowed) || allowed.length === 0 || allowed.some((v) => !["valid", "instance-mismatch", "resolver-error"].includes(v))) {
      err(`${label}: schema-cycle expected requires terminates:true and valid allowedOutcomes`);
    }
    return;
  }
  if (rule === "OBI-T-12") {
    if (!("document" in given) || typeof given.name !== "string") {
      err(`${label}: operation-resolution given requires document and name`);
    }
    if (expected.outcome === "resolved") {
      if (typeof expected.operationKey !== "string" || !Array.isArray(expected.bindingKeys) || expected.bindingKeys.some((v) => typeof v !== "string")) {
        err(`${label}: resolved outcome requires operationKey and string bindingKeys`);
      }
    } else if (expected.outcome !== "not-found") {
      err(`${label}: operation-resolution outcome must be resolved or not-found`);
    }
    return;
  }
  if (rule === "OBI-T-16") {
    if (!("document" in given) || typeof given.operation !== "string" || !["input", "output"].includes(given.side) || !Array.isArray(given.values) || given.values.length === 0) {
      err(`${label}: value-validation given requires document, operation, input|output side, and non-empty values`);
    }
    const outcomes = expected.results;
    if (!Array.isArray(outcomes) || outcomes.length !== given.values?.length || outcomes.some((v) => !["valid", "instance-mismatch", "graph-unavailable"].includes(v))) {
      err(`${label}: results must contain one valid validation outcome per input value`);
    }
    return;
  }
  if (rule === "OBI-T-17") {
    const evidence = given.evidence;
    if (typeof evidence !== "object" || evidence === null || Array.isArray(evidence) || Object.keys(evidence).length === 0) {
      err(`${label}: conclusion given requires a non-empty evidence map`);
      return;
    }
    for (const [id, status] of Object.entries(evidence)) {
      if (!/^OBI-D-[0-9]+$/.test(id) || !specRules.has(id) || !["satisfied", "violated", "unverified", "not-applicable"].includes(status)) {
        err(`${label}: invalid evidence entry ${id}=${JSON.stringify(status)}`);
      }
    }
    const violated = Object.keys(evidence).filter((id) => evidence[id] === "violated").sort();
    const unverified = Object.keys(evidence).filter((id) => evidence[id] === "unverified").sort();
    const conclusion = violated.length > 0 ? "non-conformant" : unverified.length > 0 ? "conformance-undetermined" : "conformant";
    const expectedViolated = Array.isArray(expected.violated) ? [...expected.violated].sort() : null;
    const expectedUnverified = Array.isArray(expected.unverified) ? [...expected.unverified].sort() : null;
    if (expected.conclusion !== conclusion || JSON.stringify(expectedViolated) !== JSON.stringify(violated) || JSON.stringify(expectedUnverified) !== JSON.stringify(unverified)) {
      err(`${label}: expected conclusion/lists do not follow OBI-T-17 from the supplied evidence`);
    }
  }
}

const md = readFileSync(SPEC_MD, "utf8");
const readme = readFileSync(README, "utf8");
const specRules = extractSpecRules(md);
const deferredRules = extractDeferredRules(readme);
const fixtures = listFixtures();
const scenarioFiles = listScenarioFiles();

const fixtureRules = new Map();
for (const { relPath, absPath } of fixtures) {
  validateAgainstSchema(FIXTURE_SCHEMA, absPath, relPath);
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
      err(`${relPath}: rule '${fixture.rule}' is not defined in openbindings.md §10`);
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
            err(`${relPath}.tests[${i}].violates: rule '${v}' is not defined in openbindings.md §10`);
          }
        }
      }
    }
  }
}

const scenarioRules = new Map();
for (const { relPath, absPath } of scenarioFiles) {
  validateAgainstSchema(SCENARIO_SCHEMA, absPath, relPath);
  let file;
  try {
    file = loadFixture(absPath);
  } catch (e) {
    err(`${relPath}: failed to parse JSON: ${e.message}`);
    continue;
  }
  validateScenarioFileShape(file, relPath);
  if (file.rule && /^OBI-T-\d+$/.test(file.rule)) {
    if (scenarioRules.has(file.rule)) {
      err(`Multiple scenario files declare rule ${file.rule}: ${scenarioRules.get(file.rule)} and ${relPath}`);
    } else {
      scenarioRules.set(file.rule, relPath);
    }
    if (!specRules.has(file.rule)) {
      err(`${relPath}: rule '${file.rule}' is not defined in openbindings.md §10`);
    }
    if (file.section !== inferSectionForRule(file.rule)) {
      err(`${relPath}: section is '${file.section}', expected '10.3' for ${file.rule}`);
    }
    const expectedName = `${file.rule}.json`;
    if (relPath.split("/").at(-1) !== expectedName) {
      err(`${relPath}: filename must be '${expectedName}'`);
    }
    if (fixtureRules.has(file.rule)) {
      err(`${relPath}: rule ${file.rule} is already represented by validity fixture ${fixtureRules.get(file.rule)}`);
    }
  }
}

// Coverage check: every spec rule is either covered by a fixture OR deferred
for (const ruleId of specRules.keys()) {
  if (!fixtureRules.has(ruleId) && !scenarioRules.has(ruleId) && !deferredRules.has(ruleId)) {
    err(`Spec rule ${ruleId} has no fixture/scenario file and is not listed as deferred in conformance/README.md`);
  }
}

// Sanity: deferred rules should not also have fixtures
for (const ruleId of deferredRules) {
  if (fixtureRules.has(ruleId) || scenarioRules.has(ruleId)) {
    warn(`Rule ${ruleId} is listed as deferred in README but also has evidence at ${fixtureRules.get(ruleId) || scenarioRules.get(ruleId)}`);
  }
}

// Report
console.log(`Spec rules found in §10: ${specRules.size}`);
console.log(`Fixture files: ${fixtures.length}`);
console.log(`Rules covered by fixtures: ${fixtureRules.size}`);
console.log(`Tool scenario files: ${scenarioFiles.length}`);
console.log(`Rules covered by tool scenarios: ${scenarioRules.size}`);
console.log(`Rules deferred per README: ${deferredRules.size}`);
const accounted = new Set([...fixtureRules.keys(), ...scenarioRules.keys(), ...deferredRules]);
console.log(`Rules accounted for: ${accounted.size} of ${specRules.size}`);

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
