#!/usr/bin/env node
// Verifies the binding-specification conformance subcorpus
// (conformance/binding-specs/) against the six published family
// specifications.
//
// Checks performed:
//   1. Every fixture file validates against the subcorpus's shared
//      fixture.schema.json (via ajv-cli, the same validator the CI uses for
//      the core schema).
//   2. Each fixture's `rule` matches its filename, sits in the right family
//      directory, and its `bindingSpec` is that family's exact identifier.
//   3. Each fixture's `section` names a section heading that exists in the
//      family specification.
//   4. Every family D-rule defined in the six specs' Conformance sections is
//      either covered by a fixture or listed as **Deferred** in the
//      subcorpus README; no rule has two fixture files.
//   5. Every negative test (`valid: false`) carries `violates`, and every
//      `violates` entry resolves to a rule the family specs or the core spec
//      actually define. Positive tests carry no `violates`.
//   6. Every fixture has at least one positive and one negative test unless
//      marked `coverage: "positive-only"`.
//
// The verifier does not judge verdicts — that is the job of family
// processors consuming the corpus (see conformance/binding-specs/README.md).
//
// Exits 0 on success, 1 on any drift, 2 on usage/IO error.
//
// Usage: node scripts/verify-binding-specs.mjs

import {
  readFileSync,
  readdirSync,
  existsSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_ROOT = resolve(__dirname, "..");
const CORPUS = join(SPEC_ROOT, "conformance", "binding-specs");
const FIXTURE_SCHEMA = join(CORPUS, "fixture.schema.json");
const PROCESSOR_DIR = join(CORPUS, "processor");
const PROCESSOR_SCHEMA = join(CORPUS, "processor-scenario.schema.json");
const SYNTHESIS_DIR = join(CORPUS, "synthesis");
const SYNTHESIS_SCHEMA = join(CORPUS, "synthesis-scenario.schema.json");
const README = join(CORPUS, "README.md");
const CORE_SPEC_MD = join(SPEC_ROOT, "openbindings.md");

// Family directory → { exact identifier, rule prefix, spec path }.
const FAMILIES = {
  usage: {
    bindingSpec: "openbindings.usage@1",
    prefix: "USAGE",
    spec: join(SPEC_ROOT, "binding-specs", "usage", "openbindings.usage.md"),
  },
  openapi: {
    bindingSpec: "openbindings.openapi@1",
    prefix: "OAPI",
    spec: join(SPEC_ROOT, "binding-specs", "openapi", "openbindings.openapi.md"),
  },
  mcp: {
    bindingSpec: "openbindings.mcp@1",
    prefix: "MCP",
    spec: join(SPEC_ROOT, "binding-specs", "mcp", "openbindings.mcp.md"),
  },
  grpc: {
    bindingSpec: "openbindings.grpc@1",
    prefix: "GRPC",
    spec: join(SPEC_ROOT, "binding-specs", "grpc", "openbindings.grpc.md"),
  },
  connect: {
    bindingSpec: "openbindings.connect@1",
    prefix: "CONN",
    spec: join(SPEC_ROOT, "binding-specs", "connect", "openbindings.connect.md"),
  },
  asyncapi: {
    bindingSpec: "openbindings.asyncapi@1",
    prefix: "ASYNC",
    spec: join(SPEC_ROOT, "binding-specs", "asyncapi", "openbindings.asyncapi.md"),
  },
};

const errors = [];
const tmp = mkdtempSync(join(tmpdir(), "bs-verify-"));
let counter = 0;

function ajvOk(schemaPath, dataObj) {
  const f = join(tmp, `d${counter++}.json`);
  writeFileSync(f, JSON.stringify(dataObj));
  const r = spawnSync(
    "ajv",
    ["validate", "-s", schemaPath, "-d", f, "--spec=draft2020"],
    { encoding: "utf8" }
  );
  if (r.error) {
    console.error(
      "Failed to run ajv. Install it with: npm i -g ajv-cli ajv-formats"
    );
    rmSync(tmp, { recursive: true, force: true });
    process.exit(2);
  }
  return { ok: r.status === 0, out: (r.stdout || "") + (r.stderr || "") };
}

// Extracts family D-rule ids from a family spec's Conformance section:
// lines like `- **USAGE-D-01**: ...`.
function extractFamilyRules(md, prefix) {
  const rules = new Set();
  const re = new RegExp(`^\\s*-\\s*\\*\\*(${prefix}-D-\\d+)\\*\\*[^:]*:`, "gm");
  let m;
  while ((m = re.exec(md)) !== null) rules.add(m[1]);
  return rules;
}

// Extracts every rule identifier a family spec defines (D- and P-rules),
// for resolving `violates` references.
function extractAllRuleIds(md, prefix) {
  const ids = new Set();
  const re = new RegExp(`\\*\\*(${prefix}-[DP]-\\d+)\\*\\*`, "g");
  let m;
  while ((m = re.exec(md)) !== null) ids.add(m[1]);
  return ids;
}

function extractFamilyPRules(md, prefix) {
  const rules = new Set();
  const re = new RegExp(`^\\s*-\\s*\\*\\*(${prefix}-P-\\d+)\\*\\*[^:]*:`, "gm");
  let m;
  while ((m = re.exec(md)) !== null) rules.add(m[1]);
  return rules;
}

function extractCoreRules(md) {
  const rules = new Set();
  const re = /^\s*-\s*\*\*(OBI-[DT]-\d+)\*\*[^:]*:/gm;
  let m;
  while ((m = re.exec(md)) !== null) rules.add(m[1]);
  return rules;
}

// Rows like `| USAGE-D-03 | **Deferred...` in the subcorpus README mark
// formally deferred rules.
function extractDeferredRules(readme) {
  const out = new Set();
  const re = /\|\s*((?:USAGE|OAPI|MCP|GRPC|CONN|ASYNC)-D-\d+)\s*\|\s*\*\*Deferred/g;
  let m;
  while ((m = re.exec(readme)) !== null) out.add(m[1]);
  return out;
}

function sectionExists(specMd, section) {
  // The `section` field cites a family-spec section like "4" or "9.2";
  // check a heading numbered with it exists (e.g. `## 4.` / `### 9.2.`).
  const esc = section.replace(/\./g, "\\.");
  return new RegExp(`^#{2,4}\\s+${esc}\\.\\s`, "m").test(specMd);
}

const readme = readFileSync(README, "utf8");
const coreRules = extractCoreRules(readFileSync(CORE_SPEC_MD, "utf8"));
const deferred = extractDeferredRules(readme);

const specTexts = {};
const definedDRules = new Map(); // rule id → family dir
const allRuleIds = new Set(coreRules);
for (const [dir, fam] of Object.entries(FAMILIES)) {
  const md = readFileSync(fam.spec, "utf8");
  specTexts[dir] = md;
  for (const id of extractFamilyRules(md, fam.prefix)) definedDRules.set(id, dir);
  for (const id of extractAllRuleIds(md, fam.prefix)) allRuleIds.add(id);
}

const fixtureRules = new Map(); // rule id → relPath
let files = 0;
let tests = 0;
let positives = 0;
let negatives = 0;

for (const [dir, fam] of Object.entries(FAMILIES)) {
  const famDir = join(CORPUS, dir);
  if (!existsSync(famDir)) continue;
  for (const name of readdirSync(famDir).sort()) {
    if (!name.endsWith(".json")) continue;
    const relPath = `${dir}/${name}`;
    let fixture;
    try {
      fixture = JSON.parse(readFileSync(join(famDir, name), "utf8"));
    } catch (e) {
      errors.push(`${relPath}: failed to parse JSON: ${e.message}`);
      continue;
    }
    files++;

    // 1. Shape via the shared fixture schema.
    const shape = ajvOk(FIXTURE_SCHEMA, fixture);
    if (!shape.ok) {
      errors.push(`${relPath}: does not match fixture.schema.json\n${shape.out}`);
      continue;
    }

    // 2. Identity: rule ↔ filename ↔ family directory ↔ bindingSpec.
    if (fixture.rule !== basename(name, ".json")) {
      errors.push(
        `${relPath}: rule '${fixture.rule}' does not match filename`
      );
    }
    if (!fixture.rule.startsWith(`${fam.prefix}-D-`)) {
      errors.push(
        `${relPath}: rule '${fixture.rule}' does not belong to family '${dir}' (expected prefix ${fam.prefix}-D-)`
      );
    }
    if (fixture.bindingSpec !== fam.bindingSpec) {
      errors.push(
        `${relPath}: bindingSpec '${fixture.bindingSpec}' is not this family's identifier '${fam.bindingSpec}'`
      );
    }
    if (!definedDRules.has(fixture.rule)) {
      errors.push(
        `${relPath}: rule '${fixture.rule}' is not defined in the ${dir} specification's Conformance section`
      );
    }
    if (fixtureRules.has(fixture.rule)) {
      errors.push(
        `Multiple fixture files declare rule ${fixture.rule}: ${fixtureRules.get(fixture.rule)} and ${relPath}`
      );
    } else {
      fixtureRules.set(fixture.rule, relPath);
    }

    // 3. Cited family-spec section exists.
    if (!sectionExists(specTexts[dir], fixture.section)) {
      errors.push(
        `${relPath}: section '${fixture.section}' is not a heading in the ${dir} specification`
      );
    }

    // 5./6. Test-level checks.
    let pos = 0;
    let neg = 0;
    fixture.tests.forEach((t, i) => {
      tests++;
      if (t.valid) {
        pos++;
        if ("violates" in t) {
          errors.push(`${relPath}.tests[${i}]: positive test carries 'violates'`);
        }
      } else {
        neg++;
        if (!Array.isArray(t.violates) || t.violates.length === 0) {
          errors.push(`${relPath}.tests[${i}]: negative test carries no 'violates'`);
        } else {
          for (const v of t.violates) {
            if (!allRuleIds.has(v)) {
              errors.push(
                `${relPath}.tests[${i}].violates: rule '${v}' is not defined in any family spec or the core spec`
              );
            }
          }
          if (!t.violates.includes(fixture.rule)) {
            errors.push(
              `${relPath}.tests[${i}].violates: does not include the fixture's own rule ${fixture.rule}`
            );
          }
        }
      }
    });
    positives += pos;
    negatives += neg;
    if (fixture.coverage !== "positive-only" && (pos === 0 || neg === 0)) {
      errors.push(
        `${relPath}: needs at least one positive and one negative test (found ${pos}+/${neg}-) or a 'coverage' marker`
      );
    }
  }
}

// 4. Coverage: every defined family D-rule is fixtured or deferred.
for (const [ruleId, dir] of definedDRules) {
  if (!fixtureRules.has(ruleId) && !deferred.has(ruleId)) {
    errors.push(
      `Rule ${ruleId} (${dir}) has no fixture file and is not listed as deferred in conformance/binding-specs/README.md`
    );
  }
}
for (const ruleId of deferred) {
  if (fixtureRules.has(ruleId)) {
    errors.push(
      `Rule ${ruleId} is listed as deferred in the README but also has a fixture file at ${fixtureRules.get(ruleId)}`
    );
  }
}

// Portable P-rule scenario files for all six published families. These files preserve permitted
// alternatives explicitly; the verifier checks shape, identity, citations,
// and rule coverage, while family adapters execute them against SDKs.
const processorTargets = ["usage", "openapi", "asyncapi", "mcp", "grpc", "connect"];
const processorRuleCoverage = new Map();
const processorScenarioIds = new Set();
let processorFiles = 0;
let processorScenarios = 0;

for (const dir of processorTargets) {
  const fam = FAMILIES[dir];
  const path = join(PROCESSOR_DIR, `${dir}.json`);
  if (!existsSync(path)) {
    errors.push(`processor/${dir}.json: missing portable P-rule scenario file`);
    continue;
  }
  let fixture;
  try {
    fixture = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    errors.push(`processor/${dir}.json: failed to parse JSON: ${e.message}`);
    continue;
  }
  processorFiles++;
  const shape = ajvOk(PROCESSOR_SCHEMA, fixture);
  if (!shape.ok) {
    errors.push(`processor/${dir}.json: does not match processor-scenario.schema.json\n${shape.out}`);
    continue;
  }
  if (fixture.family !== dir)
    errors.push(`processor/${dir}.json: family '${fixture.family}' does not match filename`);
  if (fixture.bindingSpec !== fam.bindingSpec)
    errors.push(`processor/${dir}.json: bindingSpec '${fixture.bindingSpec}' is not '${fam.bindingSpec}'`);

  for (const [i, scenario] of fixture.scenarios.entries()) {
    processorScenarios++;
    if (processorScenarioIds.has(scenario.id))
      errors.push(`processor/${dir}.json.scenarios[${i}]: duplicate id '${scenario.id}'`);
    processorScenarioIds.add(scenario.id);
    if (!scenario.id.startsWith(`${fam.prefix}-PS-`))
      errors.push(`processor/${dir}.json.scenarios[${i}]: id '${scenario.id}' has the wrong family prefix`);
    if (!sectionExists(specTexts[dir], scenario.section))
      errors.push(`processor/${dir}.json.scenarios[${i}]: section '${scenario.section}' is not a heading in the ${dir} specification`);
    for (const rule of scenario.rules) {
      if (!rule.startsWith(`${fam.prefix}-P-`) || !allRuleIds.has(rule))
        errors.push(`processor/${dir}.json.scenarios[${i}]: rule '${rule}' is not a defined ${dir} P-rule`);
      if (!processorRuleCoverage.has(rule)) processorRuleCoverage.set(rule, []);
      processorRuleCoverage.get(rule).push(scenario.id);
    }
  }
}

let processorPRules = 0;
for (const dir of processorTargets) {
  const fam = FAMILIES[dir];
  for (const rule of extractFamilyPRules(specTexts[dir], fam.prefix)) {
    processorPRules++;
    if (!processorRuleCoverage.has(rule))
      errors.push(`Processor rule ${rule} (${dir}) has no portable processor scenario`);
  }
}

// Portable synthesis scenarios prove artifact-inventory accounting and
// emitted target identity independently of either reference SDK's API.
const synthesisScenarioIds = new Set();
let synthesisFiles = 0;
let synthesisScenarios = 0;
for (const dir of processorTargets) {
  const fam = FAMILIES[dir];
  const path = join(SYNTHESIS_DIR, `${dir}.json`);
  if (!existsSync(path)) {
    errors.push(`synthesis/${dir}.json: missing portable synthesis scenario file`);
    continue;
  }
  let fixture;
  try {
    fixture = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    errors.push(`synthesis/${dir}.json: failed to parse JSON: ${e.message}`);
    continue;
  }
  synthesisFiles++;
  const shape = ajvOk(SYNTHESIS_SCHEMA, fixture);
  if (!shape.ok) {
    errors.push(`synthesis/${dir}.json: does not match synthesis-scenario.schema.json\n${shape.out}`);
    continue;
  }
  if (fixture.family !== dir)
    errors.push(`synthesis/${dir}.json: family '${fixture.family}' does not match filename`);
  if (fixture.bindingSpec !== fam.bindingSpec)
    errors.push(`synthesis/${dir}.json: bindingSpec '${fixture.bindingSpec}' is not '${fam.bindingSpec}'`);

  for (const [i, scenario] of fixture.scenarios.entries()) {
    synthesisScenarios++;
    const at = `synthesis/${dir}.json.scenarios[${i}]`;
    if (synthesisScenarioIds.has(scenario.id))
      errors.push(`${at}: duplicate id '${scenario.id}'`);
    synthesisScenarioIds.add(scenario.id);
    if (!scenario.id.startsWith(`${fam.prefix}-SS-`))
      errors.push(`${at}: id '${scenario.id}' has the wrong family prefix`);
    if (scenario.source.bindingSpec !== fam.bindingSpec)
      errors.push(`${at}: source bindingSpec '${scenario.source.bindingSpec}' is not '${fam.bindingSpec}'`);
    if (!scenario.expected.coverage.exhaustive)
      errors.push(`${at}: portable synthesis evidence must claim an exhaustive inventory`);

    const operations = new Set(scenario.expected.operations);
    const bindings = new Set(
      scenario.expected.bindings.map((binding) => `${binding.operationKey}\0${binding.bindingRef}`)
    );
    for (const binding of scenario.expected.bindings) {
      if (!operations.has(binding.operationKey))
        errors.push(`${at}: binding names undeclared operation '${binding.operationKey}'`);
    }
    for (const [entryIndex, entry] of scenario.expected.coverage.entries.entries()) {
      const entryAt = `${at}.expected.coverage.entries[${entryIndex}]`;
      if (entry.status === "represented") {
        if (!bindings.has(`${entry.operationKey}\0${entry.bindingRef}`))
          errors.push(`${entryAt}: represented disposition has no expected binding identity`);
      } else if (entry.rule && !allRuleIds.has(entry.rule)) {
        errors.push(`${entryAt}: rule '${entry.rule}' is not defined by the core or a published family`);
      }
    }
    const derivedFull = scenario.expected.coverage.entries.every(
      (entry) => entry.status === "represented" || entry.status === "invalid"
    );
    if (scenario.expected.coverage.fullyRepresented !== derivedFull)
      errors.push(`${at}: fullyRepresented does not match the declared dispositions`);
  }
}

rmSync(tmp, { recursive: true, force: true });

console.log(`Family D-rules defined across six specs: ${definedDRules.size}`);
console.log(`Fixture files: ${files}`);
console.log(`Rules covered by fixtures: ${fixtureRules.size}`);
console.log(`Rules deferred per README: ${deferred.size}`);
console.log(
  `Tests: ${tests} (${positives} positive, ${negatives} negative)`
);
console.log(
  `Portable processor scenarios: ${processorScenarios} in ${processorFiles} files, covering ${processorRuleCoverage.size}/${processorPRules} targeted P-rules`
);
console.log(
  `Portable synthesis scenarios: ${synthesisScenarios} in ${synthesisFiles} files, covering ${synthesisFiles}/${processorTargets.length} published families`
);

if (errors.length) {
  console.log(`\nErrors (${errors.length}):`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log("\nOK");
