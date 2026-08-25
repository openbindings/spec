#!/usr/bin/env node
// Verifies the binding-specification conformance subcorpus
// (conformance/binding-specs/) against the ten standalone brownfield
// synthesis-family specifications (the OpenAPI family has four siblings).
// Operation Graph has its own composition
// corpus and is invocation-only because its operation contracts live in the
// containing OBI.
//
// Checks performed:
//   1. Every fixture file validates against the subcorpus's shared
//      fixture.schema.json (via ajv-cli, the same validator the CI uses for
//      the core schema).
//   2. Each fixture's `rule` matches its filename, sits in the right family
//      directory, and its `bindingSpec` is that family's exact identifier.
//   3. Each fixture's `section` names a section heading that exists in the
//      family specification.
//   4. Every family D-rule defined in the ten brownfield specs' Conformance sections is
//      either covered by a fixture or listed as **Deferred** in the
//      subcorpus README; no rule has two fixture files.
//   5. Every negative test (`valid: false`) carries `violates`, and every
//      `violates` entry resolves to a rule the family specs or the core spec
//      actually define. Positive tests carry no `violates`.
//   6. Every fixture has at least one positive and one negative test unless
//      marked `coverage: "positive-only"`.
//   7. Portable processor and synthesis scenarios cite only rules owned by
//      their family (or the core), and their normalized identities and
//      coverage evidence are internally consistent.
//   8. Adjudications resolve to live synthesis scenarios and keep core and
//      family authority in their declared lanes.
//   9. The abstraction-fidelity alignment ledger validates against its schema.
//  10. The scenario counts the subcorpus README states in prose equal the
//      counts derived from the corpus by count-binding-spec-scenarios.mjs.
//  11. The synthesis scenario schema still enforces the published
//      interface-synthesizer contract's source shape (probes below).
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
import { join, dirname, resolve, basename, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { countBindingSpecScenarios } from "./count-binding-spec-scenarios.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_ROOT = resolve(__dirname, "..");
const CORPUS = join(SPEC_ROOT, "conformance", "binding-specs");
const FIXTURE_SCHEMA = join(CORPUS, "fixture.schema.json");
const PROCESSOR_DIR = join(CORPUS, "processor");
const PROCESSOR_SCHEMA = join(CORPUS, "processor-scenario.schema.json");
const FIDELITY_DIR = join(SPEC_ROOT, "conformance", "invocation-fidelity");
const FIDELITY_SCHEMA = join(FIDELITY_DIR, "scenario.schema.json");
const SYNTHESIS_DIR = join(CORPUS, "synthesis");
const SYNTHESIS_SCHEMA = join(CORPUS, "synthesis-scenario.schema.json");
const ADJUDICATIONS = join(CORPUS, "adjudications.json");
const ADJUDICATION_SCHEMA = join(CORPUS, "adjudication.schema.json");
const ABSTRACTION_FIDELITY_DIR = join(SPEC_ROOT, "conformance", "abstraction-fidelity");
const ABSTRACTION_FIDELITY_LEDGER = join(ABSTRACTION_FIDELITY_DIR, "ledger.json");
const ABSTRACTION_FIDELITY_SCHEMA = join(ABSTRACTION_FIDELITY_DIR, "ledger.schema.json");
const README = join(CORPUS, "README.md");
const CORE_SPEC_MD = join(SPEC_ROOT, "openbindings.md");

// Family directory → { exact identifier, rule prefix, spec path }.
const FAMILIES = {
  usage: {
    bindingSpec: "openbindings.usage@1",
    prefix: "USAGE",
    spec: join(SPEC_ROOT, "binding-specs", "usage", "openbindings.usage.md"),
  },
  "openapi-2.0": {
    bindingSpec: "openbindings.openapi-2.0@1",
    prefix: "OAPI20",
    spec: join(SPEC_ROOT, "binding-specs", "openapi-2.0", "openbindings.openapi-2.0.md"),
  },
  "openapi-3.0": {
    bindingSpec: "openbindings.openapi-3.0@1",
    prefix: "OAPI30",
    spec: join(SPEC_ROOT, "binding-specs", "openapi-3.0", "openbindings.openapi-3.0.md"),
  },
  "openapi-3.1": {
    bindingSpec: "openbindings.openapi-3.1@1",
    prefix: "OAPI31",
    spec: join(SPEC_ROOT, "binding-specs", "openapi-3.1", "openbindings.openapi-3.1.md"),
  },
  "openapi-3.2": {
    bindingSpec: "openbindings.openapi-3.2@1",
    prefix: "OAPI32",
    spec: join(SPEC_ROOT, "binding-specs", "openapi-3.2", "openbindings.openapi-3.2.md"),
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
  graphql: {
    bindingSpec: "openbindings.graphql@1",
    prefix: "GQL",
    spec: join(SPEC_ROOT, "binding-specs", "graphql", "openbindings.graphql.md"),
  },
};

// N8 partitions only conformance/binding-specs/. The stronger fidelity profile
// remains on the superseded unified candidate until its own graph node migrates
// it, so keep that read-only identity isolated from the active corpus families.
const LEGACY_OPENAPI_FIDELITY = {
  bindingSpec: "openbindings.openapi@1",
  prefix: "OAPI",
  spec: join(SPEC_ROOT, "binding-specs", "openapi", "openbindings.openapi.md"),
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

// Extracts family D-rule ids from a family spec's Conformance section. Older
// families use list items; the OpenAPI siblings use labeled paragraphs.
function extractFamilyRules(md, prefix) {
  const rules = new Set();
  const re = new RegExp(`\\*\\*(${prefix}-D-\\d+)\\*\\*`, "g");
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
  const re = new RegExp(`\\*\\*(${prefix}-P-\\d+)\\*\\*`, "g");
  let m;
  while ((m = re.exec(md)) !== null) rules.add(m[1]);
  return rules;
}

function extractCoreRules(md) {
  const rules = new Set();
  const re = /^\s*-\s*\*\*(OBI-[BDT]-\d+)\*\*[^:]*:/gm;
  let m;
  while ((m = re.exec(md)) !== null) rules.add(m[1]);
  return rules;
}

// Rows like `| USAGE-D-03 | **Deferred...` in the subcorpus README mark
// formally deferred rules.
function extractDeferredRules(readme) {
  const out = new Set();
  const re = /\|\s*((?:USAGE|OAPI(?:20|30|31|32)|MCP|GRPC|CONN|ASYNC|GQL)-D-\d+)\s*\|\s*\*\*Deferred/g;
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
const definedDRules = new Map(); // family-dir + rule id → { ruleId, dir }
const allRuleIds = new Set(coreRules);
for (const [dir, fam] of Object.entries(FAMILIES)) {
  const md = readFileSync(fam.spec, "utf8");
  specTexts[dir] = md;
  for (const id of extractFamilyRules(md, fam.prefix)) {
    definedDRules.set(`${dir}\0${id}`, { ruleId: id, dir });
  }
  for (const id of extractAllRuleIds(md, fam.prefix)) allRuleIds.add(id);
}
const legacyOpenapiFidelityText = readFileSync(LEGACY_OPENAPI_FIDELITY.spec, "utf8");
for (const id of extractAllRuleIds(legacyOpenapiFidelityText, LEGACY_OPENAPI_FIDELITY.prefix)) {
  allRuleIds.add(id);
}

const fixtureRules = new Map(); // family-dir + rule id → relPath
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
    const fixtureKey = `${dir}\0${fixture.rule}`;
    if (!definedDRules.has(fixtureKey)) {
      errors.push(
        `${relPath}: rule '${fixture.rule}' is not defined in the ${dir} specification's Conformance section`
      );
    }
    if (fixtureRules.has(fixtureKey)) {
      errors.push(
        `Multiple fixture files declare rule ${fixture.rule} for ${dir}: ${fixtureRules.get(fixtureKey)} and ${relPath}`
      );
    } else {
      fixtureRules.set(fixtureKey, relPath);
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
for (const [fixtureKey, { ruleId, dir }] of definedDRules) {
  if (!fixtureRules.has(fixtureKey) && !deferred.has(ruleId)) {
    errors.push(
      `Rule ${ruleId} (${dir}) has no fixture file and is not listed as deferred in conformance/binding-specs/README.md`
    );
  }
}
for (const ruleId of deferred) {
  const covered = [...fixtureRules.entries()].filter(([key]) => key.endsWith(`\0${ruleId}`));
  if (covered.length) {
    errors.push(
      `Rule ${ruleId} is listed as deferred in the README but also has fixture file(s): ${covered.map(([, path]) => path).join(", ")}`
    );
  }
}

// Portable P-rule scenario files for all ten standalone brownfield synthesis specifications. These files preserve permitted
// alternatives explicitly; the verifier checks shape, identity, citations,
// and distinct rule-id coverage, while family adapters execute them against SDKs.
const processorTargets = [
  "usage",
  "openapi-2.0",
  "openapi-3.0",
  "openapi-3.1",
  "openapi-3.2",
  "asyncapi",
  "mcp",
  "grpc",
  "connect",
  "graphql",
];
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

const processorPRules = new Map();
for (const dir of processorTargets) {
  const fam = FAMILIES[dir];
  for (const rule of extractFamilyPRules(specTexts[dir], fam.prefix)) {
    if (!processorPRules.has(rule)) processorPRules.set(rule, []);
    processorPRules.get(rule).push(dir);
  }
}
for (const [rule, dirs] of processorPRules) {
  const isOpenapiSeed = dirs.every((dir) => dir.startsWith("openapi-"));
  if (!isOpenapiSeed && !processorRuleCoverage.has(rule))
    errors.push(`Processor rule ${rule} (${dirs.join(", ")}) has no portable processor scenario`);
}

// The stronger invocation-fidelity profile is kept separate from published
// family conformance. It reuses the semantic harness but may also cite the
// core binding-specification completeness floor.
const fidelityTargets = ["openapi", "asyncapi", "grpc", "connect", "graphql", "mcp", "usage"];
let fidelityScenarios = 0;
for (const dir of fidelityTargets) {
  const fam = dir === "openapi" ? LEGACY_OPENAPI_FIDELITY : FAMILIES[dir];
  const fidelitySpecText = dir === "openapi"
    ? legacyOpenapiFidelityText
    : specTexts[dir];
  const path = join(FIDELITY_DIR, `${dir}.json`);
  if (!existsSync(path)) {
    errors.push(`invocation-fidelity/${dir}.json: missing fidelity scenario file`);
    continue;
  }
  let fixture;
  try {
    fixture = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    errors.push(`invocation-fidelity/${dir}.json: failed to parse JSON: ${e.message}`);
    continue;
  }
  const shape = ajvOk(FIDELITY_SCHEMA, fixture);
  if (!shape.ok) {
    errors.push(`invocation-fidelity/${dir}.json: does not match scenario.schema.json\n${shape.out}`);
    continue;
  }
  if (fixture.family !== dir)
    errors.push(`invocation-fidelity/${dir}.json: family '${fixture.family}' does not match filename`);
  if (fixture.bindingSpec !== fam.bindingSpec)
    errors.push(`invocation-fidelity/${dir}.json: bindingSpec '${fixture.bindingSpec}' is not '${fam.bindingSpec}'`);
  for (const [i, scenario] of fixture.scenarios.entries()) {
    fidelityScenarios++;
    if (!scenario.id.startsWith(`${fam.prefix}-FI-`))
      errors.push(`invocation-fidelity/${dir}.json.scenarios[${i}]: id '${scenario.id}' has the wrong family prefix`);
    if (!sectionExists(fidelitySpecText, scenario.section))
      errors.push(`invocation-fidelity/${dir}.json.scenarios[${i}]: section '${scenario.section}' is not a heading in the ${dir} specification`);
    for (const rule of scenario.rules) {
      if (!allRuleIds.has(rule))
        errors.push(`invocation-fidelity/${dir}.json.scenarios[${i}]: rule '${rule}' is not defined by core or the family specification`);
    }
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
    if (scenario.expected.outcome === "refused") {
      for (const rule of scenario.expected.rules) {
        if (!coreRules.has(rule) && (!rule.startsWith(`${fam.prefix}-`) || !allRuleIds.has(rule)))
          errors.push(`${at}: refusal rule '${rule}' is not defined by the core or the ${dir} family`);
      }
      continue;
    }
    if (!scenario.expected.coverage.exhaustive)
      errors.push(`${at}: portable synthesis evidence must claim an exhaustive inventory`);

    const operations = new Set(scenario.expected.operations);
    const bindings = new Set(
      scenario.expected.bindings.map((binding) => `${binding.operationKey}\0${binding.bindingSelector}`)
    );
    for (const binding of scenario.expected.bindings) {
      if (!operations.has(binding.operationKey))
        errors.push(`${at}: binding names undeclared operation '${binding.operationKey}'`);
    }
    for (const [entryIndex, entry] of scenario.expected.coverage.entries.entries()) {
      const entryAt = `${at}.expected.coverage.entries[${entryIndex}]`;
      if (entry.status === "represented") {
        if (
          entry.scope !== "dependency"
          && !bindings.has(`${entry.operationKey}\0${entry.bindingSelector}`)
        )
          errors.push(`${entryAt}: represented disposition has no expected binding identity`);
      } else if (
        entry.rule
        && !coreRules.has(entry.rule)
        && (!entry.rule.startsWith(`${fam.prefix}-`) || !allRuleIds.has(entry.rule))
      ) {
        errors.push(`${entryAt}: rule '${entry.rule}' is not defined by the core or the ${dir} family`);
      }
    }
    const derivedFull = scenario.expected.coverage.entries.every(
      (entry) => entry.status === "represented" || entry.status === "invalid"
    );
    if (scenario.expected.coverage.fullyRepresented !== derivedFull)
      errors.push(`${at}: fullyRepresented does not match the declared dispositions`);
  }
}

let adjudicationCount = 0;
try {
  const adjudications = JSON.parse(readFileSync(ADJUDICATIONS, "utf8"));
  const shape = ajvOk(ADJUDICATION_SCHEMA, adjudications);
  if (!shape.ok) {
    errors.push(`adjudications.json: does not match adjudication.schema.json\n${shape.out}`);
  } else {
    const ids = new Set();
    adjudicationCount = adjudications.records.length;
    for (const [index, record] of adjudications.records.entries()) {
      const at = `adjudications.json.records[${index}]`;
      if (ids.has(record.id)) errors.push(`${at}: duplicate id '${record.id}'`);
      ids.add(record.id);
      for (const scenario of record.scenarios) {
        if (!synthesisScenarioIds.has(scenario))
          errors.push(`${at}: scenario '${scenario}' is not present in the live synthesis corpus`);
      }
      const scenarioPrefixes = new Set(
        record.scenarios.map((scenario) => scenario.slice(0, scenario.indexOf("-SS-")))
      );
      for (const rule of record.authority.coreRules) {
        if (!coreRules.has(rule))
          errors.push(`${at}: core authority rule '${rule}' is not defined by the core`);
      }
      for (const rule of record.authority.bindingRules) {
        const prefix = rule.slice(0, rule.indexOf("-"));
        if (!allRuleIds.has(rule) || !scenarioPrefixes.has(prefix))
          errors.push(`${at}: binding authority rule '${rule}' is not defined by a scenario family`);
      }
    }
  }
} catch (e) {
  errors.push(`adjudications.json: failed to parse or validate: ${e.message}`);
}

let alignmentLedgerEntries = 0;
try {
  const ledger = JSON.parse(readFileSync(ABSTRACTION_FIDELITY_LEDGER, "utf8"));
  const shape = ajvOk(ABSTRACTION_FIDELITY_SCHEMA, ledger);
  if (!shape.ok) {
    errors.push(`abstraction-fidelity/ledger.json: does not match ledger.schema.json\n${shape.out}`);
  } else {
    alignmentLedgerEntries = ledger.entries.length;
  }
} catch (e) {
  errors.push(`abstraction-fidelity/ledger.json: failed to parse or validate: ${e.message}`);
}

// --- Invocation-interface vocabulary containment -----------------------------
// A binding specification is a semantic authority consumable by ANY invocation
// surface; the project's invoker interfaces are one informative realization
// (binding-specs/README.md, "Authentication and credentials"). A binding-spec
// rule stated in the interfaces' vocabulary — its error-record members, its
// owned code spellings, its frame model — reads as a dependency on the project's
// tooling and gives a third-party implementer false grounds to think conformance
// requires our contracts. The discipline: state the operation-boundary fact
// abstractly (e.g. "admits application-authored failure data"), then scope any
// interface mention as one realization ("when the project's portable invocation
// interface is used, ..."). This check flags a paragraph that uses coupling
// vocabulary without a scoping marker.
{
  const couplingTokens = [
    [/\bERR_[A-Z][A-Z_]+\b/, "an interface-owned error-code spelling"],
    [/\bCONTEXT_REQUIRED\b|`context-required`/, "the context-negotiation code"],
    [/invocation error's|invocation error `data`|error `data` member|`data` member/, "the invocation error record's member"],
    [/\binvocation interface\b/, "the invocation interface"],
    [/\bbinding-invoker\b|\boperation-invoker\b/, "a project interface name"],
    [/\binvocation frames?\b|\bframe protocol\b/, "the interface frame model"],
  ];
  const scopingMarkers = [
    /informative/i,
    /portable invocation interface is used/,
    /under the project's portable invocation interface/,
    /that surface's contract/,
    /one such negotiation surface/,
    /\brealization\b/,
  ];
  const specPages = readdirSync(join(SPEC_ROOT, "binding-specs"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(SPEC_ROOT, "binding-specs", entry.name))
    .flatMap((dir) => readdirSync(dir).filter((f) => /^openbindings\..*\.md$/.test(f)).map((f) => join(dir, f)));
  for (const page of specPages) {
    const text = readFileSync(page, "utf8");
    let line = 1;
    for (const rawParagraph of text.split(/\n\s*\n/)) {
      const startLine = line;
      line += rawParagraph.split("\n").length + 1;
      // Hard-wrapped prose splits phrases across lines; match on the unwrapped text.
      const paragraph = rawParagraph.replace(/\s+/g, " ");
      const hit = couplingTokens.find(([token]) => token.test(paragraph));
      if (!hit) continue;
      if (scopingMarkers.some((marker) => marker.test(paragraph))) continue;
      errors.push(
        `${relative(SPEC_ROOT, page)}:${startLine}: paragraph uses ${hit[1]} without scoping it as an invocation-surface realization (state the binding-spec fact abstractly, then scope the interface mention)`
      );
    }
  }
}

// --- 11. The synthesis source shape still matches the published contract ----
// synthesis-scenario.schema.json adopts interface-synthesizer 0.2's
// SynthesizeInterfaceSource `anyOf` verbatim, so a scenario cannot declare a
// source the published contract forbids. A constraint nothing exercises is not
// a constraint: every live scenario satisfies it, so the corpus alone cannot
// show the schema still carries it. These probes do — removing the `anyOf`
// turns the third one red.
{
  const synthesisSchema = JSON.parse(readFileSync(SYNTHESIS_SCHEMA, "utf8"));
  const probeFile = (source) => ({
    format: "openbindings.binding-spec-synthesis-scenarios@5",
    bindingSpec: "openbindings.openapi-3.1@1",
    family: "openapi-3.1",
    description: "verifier probe; not part of the corpus",
    scenarios: [
      {
        id: "OAPI31-SS-99",
        description: "verifier probe; not part of the corpus",
        source,
        expected: { outcome: "refused", rules: ["OAPI31-P-01"] },
      },
    ],
  });
  const probes = [
    ["carrying `content`", { bindingSpec: "openbindings.openapi-3.1@1", content: {} }, true],
    [
      "carrying `location`",
      { bindingSpec: "openbindings.openapi-3.1@1", location: "https://example.com/a.yaml" },
      true,
    ],
    ["carrying neither `location` nor `content`", { bindingSpec: "openbindings.openapi-3.1@1" }, false],
  ];
  for (const [what, source, shouldValidate] of probes) {
    const probe = ajvOk(SYNTHESIS_SCHEMA, probeFile(source));
    if (probe.ok === shouldValidate) continue;
    errors.push(
      shouldValidate
        ? `synthesis-scenario.schema.json rejects a scenario source ${what}, which the interface-synthesizer contract accepts\n${probe.out}`
        : `synthesis-scenario.schema.json accepts a scenario source ${what}; interface-synthesizer 0.2's SynthesizeInterfaceSource requires one of them (restore the 'anyOf' on the source object)`
    );
  }
}

rmSync(tmp, { recursive: true, force: true });

// --- 10. The README's scenario counts are derived, not hand-maintained ------
// count-binding-spec-scenarios.mjs is the single derivation; this check makes
// the README's prose fail the build when it drifts from the corpus, which is
// how three stale numbers survived several corpus growths.
{
  const counts = countBindingSpecScenarios(SPEC_ROOT);

  // The verifier's own walk and the shared derivation must agree; otherwise a
  // number could be "asserted" against a second, silently different count.
  const crossChecks = [
    ["processor scenarios", counts.processor.scenarios, processorScenarios],
    ["distinct processor rules", counts.processor.coveredRules.length, processorRuleCoverage.size],
    ["synthesis scenarios", counts.synthesis.scenarios, synthesisScenarios],
  ];
  for (const [what, derived, walked] of crossChecks) {
    if (derived !== walked)
      errors.push(
        `count-binding-spec-scenarios.mjs counts ${derived} ${what}; this verifier's own walk counts ${walked}`
      );
  }

  // The README is hard-wrapped, so match against the unwrapped text.
  const prose = readme.replace(/\s+/g, " ");
  const stated = [
    {
      what: "portable processor scenarios",
      pattern: /The current corpus contains (\d+) scenarios/,
      shape: "The current corpus contains <N> scenarios",
      actual: counts.processor.scenarios,
    },
    {
      what: "distinct P-rules the processor scenarios cover",
      pattern: /\((\d+) distinct rules\)/,
      shape: "(<N> distinct rules)",
      actual: counts.processor.coveredRules.length,
    },
    {
      what: "portable synthesis scenarios",
      pattern: /The (\d+) scenarios exercise all ten standalone brownfield synthesis specifications/,
      shape: "The <N> scenarios exercise all ten standalone brownfield synthesis specifications",
      actual: counts.synthesis.scenarios,
    },
  ];
  for (const { what, pattern, shape, actual } of stated) {
    const found = prose.match(pattern);
    if (!found) {
      errors.push(
        `conformance/binding-specs/README.md: no sentence of the form "${shape}" states the ${what}; the verifier asserts that count and needs the sentence to stay matchable`
      );
      continue;
    }
    if (Number(found[1]) !== actual)
      errors.push(
        `conformance/binding-specs/README.md states ${found[1]} ${what}; the corpus holds ${actual} (run: node scripts/count-binding-spec-scenarios.mjs)`
      );
  }
}

console.log(`Family D-rules defined across ten brownfield synthesis specs: ${definedDRules.size}`);
console.log(`Fixture files: ${files}`);
console.log(`Rules covered by fixtures: ${fixtureRules.size}`);
console.log(`Rules deferred per README: ${deferred.size}`);
console.log(
  `Tests: ${tests} (${positives} positive, ${negatives} negative)`
);
console.log(
  `Portable processor scenarios: ${processorScenarios} in ${processorFiles} files, covering ${processorRuleCoverage.size}/${processorPRules.size} distinct targeted P-rules`
);
console.log(`Invocation-fidelity scenarios: ${fidelityScenarios} across ${fidelityTargets.length} active family slice(s)`);
console.log(
  `Portable synthesis scenarios: ${synthesisScenarios} in ${synthesisFiles} files, covering ${synthesisFiles}/${processorTargets.length} standalone brownfield synthesis specifications`
);
console.log(`Conformance adjudications: ${adjudicationCount}`);
console.log(`Abstraction-fidelity ledger entries: ${alignmentLedgerEntries}`);

if (errors.length) {
  console.log(`\nErrors (${errors.length}):`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log("\nOK");
