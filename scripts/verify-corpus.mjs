#!/usr/bin/env node
// Verifies the core conformance corpus against the spec.
//
// Checks performed:
//   1. Every fixture file (conformance/document/) and scenario file
//      (conformance/scenarios/, format @3) validates against its published
//      JSON Schema.
//   2. Citations: a rule file cites a rule openbindings.md section 10 defines,
//      with section "10", and is named after it; every other file cites a
//      section that is a heading of openbindings.md and is named after it
//      (document/section-<N>.json, scenarios/<N>-<topic>.json). Every rule
//      identifier the files mention is defined, and none uses an older
//      numbering.
//   3. Fixtures: exactly one input carriage, canonical base64, violates and
//      notViolated only on a negative test, naming defined rules, disjoint.
//   4. Scenarios: case IDs unique in the corpus, one prefix per file and a
//      prefix no other file uses; per action, one result per value, absolute
//      resource URIs, named operations, dependencies, and bindings present,
//      no-contract and no-claim exactly where no contract is stated, complete
//      example expectations, which operation a string identifies and whether
//      a binding meets a kinds constraint as the document says (sections 5.1,
//      5.5, and 6), and violates only on a non-conformant outcome.
//   5. The README's coverage table has one row per cited rule or section,
//      listing exactly the files that cite it; every rule has a row, and a
//      rule row without files is marked deferred.
//
// Exits 0 on success, 1 on any drift, 2 on usage/IO error.
//
// Usage: node scripts/verify-corpus.mjs [--spec-root DIR]
//   --spec-root  the spec checkout to verify (default: this script's repo).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
let SPEC_ROOT = resolve(__dirname, "..");
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--spec-root" && argv[i + 1]) {
    SPEC_ROOT = resolve(argv[++i]);
  } else {
    console.error(`usage: node scripts/verify-corpus.mjs [--spec-root DIR] (unknown argument ${argv[i]})`);
    process.exit(2);
  }
}
const SPEC_MD = join(SPEC_ROOT, "openbindings.md");
const CONFORMANCE_ROOT = join(SPEC_ROOT, "conformance");
const README = join(CONFORMANCE_ROOT, "README.md");
const FIXTURE_SCHEMA = join(CONFORMANCE_ROOT, "fixture.schema.json");
const SCENARIO_SCHEMAS = {
  "openbindings.core-scenarios@3": join(CONFORMANCE_ROOT, "scenario.schema.json"),
};

const errors = [];
const warnings = [];
const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    console.error(`cannot read ${path}: ${e.message}`);
    process.exit(2);
  }
}

// Schema validation is batched: one ajv run per schema, over every file that
// declares it, so the schema is compiled once.
const schemaJobs = new Map();
function validateAgainstSchema(schemaPath, dataPath, label) {
  if (!schemaJobs.has(schemaPath)) schemaJobs.set(schemaPath, []);
  schemaJobs.get(schemaPath).push({ dataPath, label });
}

function runSchemaJobs() {
  for (const [schemaPath, jobs] of schemaJobs) {
    const args = ["validate", "-s", schemaPath, "--spec=draft2020", "--errors=line"];
    for (const j of jobs) args.push("-d", j.dataPath);
    const result = spawnSync("ajv", args, { encoding: "utf8" });
    if (result.error) {
      console.error("Failed to run ajv. Install it with: npm i -g ajv-cli ajv-formats");
      process.exit(2);
    }
    const byPath = new Map(jobs.map((j) => [j.dataPath, { label: j.label, verdict: null, detail: [] }]));
    let current = null;
    for (const line of ((result.stdout || "") + (result.stderr || "")).split("\n")) {
      const m = /^(.*) (valid|invalid)$/.exec(line);
      if (m && byPath.has(m[1])) {
        current = byPath.get(m[1]);
        current.verdict = m[2];
      } else if (current && line.trim() && !line.startsWith("strict mode")) {
        current.detail.push(line);
      }
    }
    for (const [dataPath, r] of byPath) {
      if (r.verdict === "invalid") err(`${r.label}: does not match ${schemaPath.split("/").at(-1)}\n${r.detail.join("\n")}`);
      else if (r.verdict !== "valid") err(`${r.label}: ajv reported no verdict for ${dataPath} against ${schemaPath.split("/").at(-1)} (exit ${result.status})\n${result.stderr || ""}`);
    }
  }
}

// ---------------------------------------------------------------- spec text

// Rule lines in section 10: "- **OBI-01**: Is valid UTF-8 ...".
function extractSpecRules(md) {
  const rules = new Map();
  const re = /^\s*-\s*\*\*(OBI-\d{2})\*\*[^:]*:\s*(.*)$/gm;
  let m;
  while ((m = re.exec(md)) !== null) rules.set(m[1], m[2].trim());
  return rules;
}

// Heading numbers: "## 5. Document model" gives 5, "### 5.1. Operations" gives 5.1.
function extractSections(md) {
  const out = new Set();
  const re = /^#{2,6}\s+(\d+(?:\.\d+)*)\.\s/gm;
  let m;
  while ((m = re.exec(md)) !== null) out.add(m[1]);
  return out;
}

// ---------------------------------------------------------------- README

// Coverage rows: | `OBI-01` or `5.1` | `document/OBI-01.json`, ... or none | coverage |
function extractCoverageRows(readme) {
  const rows = new Map();
  const re = /^\|\s*`?(OBI-\d{2}|\d+(?:\.\d+)*)`?\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*$/gm;
  let m;
  while ((m = re.exec(readme)) !== null) {
    if (rows.has(m[1])) err(`README coverage table: ${m[1]} has two rows`);
    const files = m[2] === "none" ? [] : m[2].split(",").map((f) => f.trim().replace(/^`|`$/g, ""));
    rows.set(m[1], { files, coverage: m[3] });
  }
  return rows;
}

// ---------------------------------------------------------------- corpus files

function listJSON(sub) {
  const dir = join(CONFORMANCE_ROOT, sub);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith(".json"))
    .sort()
    .map((n) => ({ relPath: `${sub}/${n}`, absPath: join(dir, n) }));
}

function loadJSON(absPath, relPath) {
  try {
    return JSON.parse(readFileSync(absPath, "utf8"));
  } catch (e) {
    err(`${relPath}: failed to parse JSON: ${e.message}`);
    return null;
  }
}

const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const own = (o, k) => isObject(o) && Object.hasOwn(o, k);

// Every rule identifier a file mentions is defined, and none uses an older numbering.
function checkMentions(text, relPath, ctx) {
  for (const m of text.matchAll(/OBI-[A-Z]-\d+/g)) err(`${relPath}: mentions ${m[0]}, an identifier this text does not use`);
  for (const id of new Set(text.match(/OBI-\d{2}(?!\d)/g) || [])) {
    if (!ctx.specRules.has(id)) err(`${relPath}: mentions ${id}, which openbindings.md section 10 does not define`);
  }
}

function cite(ctx, citation, relPath) {
  if (!ctx.citations.has(citation)) ctx.citations.set(citation, []);
  ctx.citations.get(citation).push(relPath);
}

function verifyFixture(fixture, relPath, ctx) {
  const name = relPath.split("/").at(-1);
  if ("rule" in fixture) {
    if (!/^OBI-\d{2}$/.test(fixture.rule ?? "") || !ctx.specRules.has(fixture.rule)) {
      err(`${relPath}: rule ${JSON.stringify(fixture.rule)} is not defined in openbindings.md section 10`);
    } else {
      if (fixture.section !== "10") err(`${relPath}: section is ${JSON.stringify(fixture.section)}; a rule file cites section "10"`);
      if (name !== `${fixture.rule}.json`) err(`${relPath}: a file for ${fixture.rule} is named ${fixture.rule}.json`);
      cite(ctx, fixture.rule, relPath);
    }
  } else {
    if (!ctx.sections.has(fixture.section)) err(`${relPath}: section ${JSON.stringify(fixture.section)} is not a heading of openbindings.md`);
    if (name !== `section-${fixture.section}.json`) err(`${relPath}: a file citing section ${fixture.section} is named section-${fixture.section}.json`);
    cite(ctx, fixture.section, relPath);
  }
  if (!Array.isArray(fixture.tests) || fixture.tests.length === 0) {
    err(`${relPath}: tests must be a non-empty array`);
    return;
  }
  fixture.tests.forEach((t, i) => {
    const label = `${relPath}#/tests/${i}`;
    if (!isObject(t)) return;
    const inputs = ["document", "documentText", "documentBase64"].filter((f) => f in t);
    if (inputs.length !== 1) err(`${label}: exactly one of document, documentText, or documentBase64 is required`);
    if ("documentBase64" in t && !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(t.documentBase64)) {
      err(`${label}: documentBase64 is not canonical base64 text`);
    }
    for (const member of ["violates", "notViolated"]) {
      if (!(member in t)) continue;
      if (t.valid !== false) err(`${label}: ${member} is meaningful only when valid is false`);
      for (const v of t[member] || []) {
        if (!ctx.specRules.has(v)) err(`${label}: ${member} names ${v}, which openbindings.md section 10 does not define`);
      }
    }
    const both = (t.violates || []).filter((v) => (t.notViolated || []).includes(v));
    if (both.length) err(`${label}: ${both.join(", ")} is listed both in violates and in notViolated`);
    ctx.fixtureCases.set(label, t);
  });
}

// What the document says a string identifies (section 5.1): the operation
// whose key or one of whose aliases equals it, and that operation's bindings.
function identify(d, name) {
  const operations = isObject(d.operations) ? d.operations : {};
  const matches = Object.keys(operations).filter((k) => k === name || (Array.isArray(operations[k]?.aliases) && operations[k].aliases.includes(name)));
  if (matches.length !== 1) return { outcome: "not-found", matches };
  const key = matches[0];
  const bindings = isObject(d.bindings) ? d.bindings : {};
  return { outcome: "resolved", operationKey: key, bindingKeys: Object.keys(bindings).filter((b) => bindings[b]?.operation === key) };
}

// Whether a binding meets a dependency's kinds constraint (sections 5.5 and 6).
function meets(d, dependency, binding) {
  const dep = d.dependencies[dependency];
  if (!own(dep, "kinds")) return true;
  const kind = d.sources?.[d.bindings[binding].source]?.kind;
  return dep.kinds.some((k) => k === kind);
}

function verifyScenarios(file, relPath, ctx) {
  const name = relPath.split("/").at(-1);
  if (!ctx.sections.has(file.section)) err(`${relPath}: section ${JSON.stringify(file.section)} is not a heading of openbindings.md`);
  else if (!name.startsWith(`${file.section}-`)) err(`${relPath}: a file citing section ${file.section} is named ${file.section}-<topic>.json`);
  cite(ctx, file.section, relPath);
  const prefixes = new Set();
  for (const [i, s] of (file.scenarios || []).entries()) {
    const label = `${relPath}#${s?.id ?? i}`;
    if (!isObject(s)) continue;
    const m = /^([A-Z]+)-\d{2}$/.exec(s.id ?? "");
    if (!m) err(`${label}: case ID ${JSON.stringify(s.id)} is not of the form PREFIX-NN`);
    else {
      prefixes.add(m[1]);
      if (ctx.caseIds.has(s.id)) err(`${label}: duplicate case ID ${s.id} (also ${ctx.caseIds.get(s.id)})`);
      else ctx.caseIds.set(s.id, label);
    }
    ctx.scenarioCases.set(s.id, { scenario: s, file: relPath });
    const g = isObject(s.given) ? s.given : {};
    const e = isObject(s.expected) ? s.expected : {};
    const d = isObject(g.document) ? g.document : null;
    const operations = d && isObject(d.operations) ? d.operations : {};
    switch (s.action) {
      case "validate-operation-values": {
        if (Array.isArray(e.results) && e.results.length !== (g.values || []).length) {
          err(`${label}: ${e.results.length} results for ${(g.values || []).length} values`);
        }
        const uris = (g.resources || []).map((r) => r.uri);
        if (new Set(uris).size !== uris.length) err(`${label}: a resource URI repeats`);
        for (const u of uris) {
          if (!/^[A-Za-z][A-Za-z0-9+.-]*:/.test(u) || u.replace(/#$/, "").includes("#")) err(`${label}: resource URI ${JSON.stringify(u)} is not absolute without a fragment`);
        }
        if (!own(operations, g.operation)) {
          err(`${label}: operation ${JSON.stringify(g.operation)} is not in the document`);
          break;
        }
        const stated = own(operations[g.operation], g.side);
        for (const [j, r] of (e.results || []).entries()) {
          if ((r === "no-contract") === stated) err(`${label}: result ${j} is ${JSON.stringify(r)}, but the operation ${stated ? "states" : "states no"} ${g.side} contract (section 5.2)`);
        }
        break;
      }
      case "check-examples": {
        const op = own(operations, g.operation) ? operations[g.operation] : null;
        if (!isObject(op)) {
          err(`${label}: operation ${JSON.stringify(g.operation)} is not in the document`);
          break;
        }
        const examples = isObject(op.examples) ? op.examples : {};
        const want = Object.keys(examples).sort();
        const have = Object.keys(e.examples || {}).sort();
        if (JSON.stringify(want) !== JSON.stringify(have)) err(`${label}: expectations cover ${have.join(", ")}; the operation's examples are ${want.join(", ")}`);
        for (const [exName, ex] of Object.entries(examples)) {
          const sides = ["input", "output"].filter((k) => own(ex, k));
          const expectedSides = Object.keys(e.examples?.[exName] || {}).sort();
          if (JSON.stringify(sides) !== JSON.stringify(expectedSides)) err(`${label}: example ${exName} supplies ${sides.join(", ") || "no value"}; expectations cover ${expectedSides.join(", ") || "none"}`);
          for (const side of sides) {
            const r = e.examples?.[exName]?.[side];
            if (r !== undefined && (r === "no-claim") === own(op, side)) err(`${label}: example ${exName} ${side} is ${JSON.stringify(r)}, but the operation ${own(op, side) ? "states" : "states no"} ${side} contract (section 5.1)`);
          }
        }
        break;
      }
      case "check-dependency-kind": {
        if (!d || !own(d.dependencies, g.dependency) || !own(d.bindings, g.binding)) {
          err(`${label}: the named dependency or binding is not in the document`);
          break;
        }
        const want = meets(d, g.dependency, g.binding) ? "meets" : "does-not-meet";
        if (e.outcome !== want) err(`${label}: expected ${e.outcome}, but the document says ${want} (sections 5.5 and 6)`);
        break;
      }
      case "resolve-operation": {
        if (!d) break;
        const got = identify(d, g.name);
        if (got.matches?.length > 1) err(`${label}: ${JSON.stringify(g.name)} is an identifier of ${got.matches.join(" and ")}, which OBI-05 forbids`);
        if (got.outcome !== e.outcome) err(`${label}: expected ${e.outcome}, but the document says ${got.outcome} (section 5.1)`);
        else if (got.outcome === "resolved") {
          if (e.operationKey !== got.operationKey) err(`${label}: expected operation ${e.operationKey}, but the string identifies ${got.operationKey}`);
          const a = [...(e.bindingKeys || [])].sort(), b = [...got.bindingKeys].sort();
          if (JSON.stringify(a) !== JSON.stringify(b)) err(`${label}: expected bindings ${a.join(", ")}; the operation's bindings are ${b.join(", ")}`);
        }
        break;
      }
      case "validate-document":
        if ("violates" in e && e.outcome !== "non-conformant") err(`${label}: violates without a non-conformant outcome`);
        for (const r of e.violates || []) if (!ctx.specRules.has(r)) err(`${label}: violates names ${r}, which openbindings.md section 10 does not define`);
        break;
      default:
        err(`${label}: unknown action ${JSON.stringify(s.action)}`);
    }
  }
  if (prefixes.size > 1) err(`${relPath}: case IDs use several prefixes (${[...prefixes].join(", ")})`);
  for (const p of prefixes) {
    if (ctx.prefixes.has(p)) err(`${relPath}: prefix ${p} is also used by ${ctx.prefixes.get(p)}`);
    else ctx.prefixes.set(p, relPath);
  }
}

// ---------------------------------------------------------------- main

const md = readText(SPEC_MD);
const readme = readText(README);
const specRules = extractSpecRules(md);
const sections = extractSections(md);
if (specRules.size === 0) err("openbindings.md: no rule lines (- **OBI-NN**: ...) found in section 10");

const ctx = {
  specRules,
  sections,
  citations: new Map(),
  caseIds: new Map(),
  prefixes: new Map(),
  fixtureCases: new Map(),
  scenarioCases: new Map(),
};

const fixtures = listJSON("document");
for (const { relPath, absPath } of fixtures) {
  validateAgainstSchema(FIXTURE_SCHEMA, absPath, relPath);
  checkMentions(readFileSync(absPath, "utf8"), relPath, ctx);
  const fixture = loadJSON(absPath, relPath);
  if (!isObject(fixture)) continue;
  verifyFixture(fixture, relPath, ctx);
}

const formats = new Map();
const scenarioFiles = listJSON("scenarios");
for (const { relPath, absPath } of scenarioFiles) {
  checkMentions(readFileSync(absPath, "utf8"), relPath, ctx);
  const file = loadJSON(absPath, relPath);
  if (!isObject(file)) continue;
  const schema = SCENARIO_SCHEMAS[file.format];
  if (!schema) {
    err(`${relPath}: unsupported format ${JSON.stringify(file.format)}`);
    continue;
  }
  validateAgainstSchema(schema, absPath, relPath);
  formats.set(file.format, (formats.get(file.format) || 0) + 1);
  if (!Array.isArray(file.scenarios) || file.scenarios.length === 0) {
    err(`${relPath}: scenarios must be a non-empty array`);
    continue;
  }
  verifyScenarios(file, relPath, ctx);
}

runSchemaJobs();

// README coverage table: one row per citation, listing exactly its files.
const rows = extractCoverageRows(readme);
for (const [citation, row] of rows) {
  if (/^OBI-/.test(citation) ? !specRules.has(citation) : !sections.has(citation)) {
    err(`README coverage table: ${citation} is neither a rule of section 10 nor a heading of openbindings.md`);
  }
  const want = [...(ctx.citations.get(citation) || [])].sort();
  const have = [...row.files].sort();
  if (JSON.stringify(want) !== JSON.stringify(have)) {
    err(`README coverage table: ${citation} lists ${have.join(", ") || "none"}; the files citing it are ${want.join(", ") || "none"}`);
  }
  if (have.length === 0 && !row.coverage.startsWith("**Deferred")) err(`README coverage table: ${citation} lists no file and is not marked **Deferred**`);
}
for (const citation of ctx.citations.keys()) if (!rows.has(citation)) err(`README coverage table: no row for ${citation}, which ${ctx.citations.get(citation).join(", ")} cite`);
for (const rule of specRules.keys()) if (!rows.has(rule)) err(`README coverage table: no row for ${rule}`);
const deferred = [...rows].filter(([, r]) => r.files.length === 0).map(([c]) => c);

// Report
console.log(`Spec rules found in section 10: ${specRules.size}; headings: ${sections.size}`);
console.log(`Fixture files: ${fixtures.length} (${ctx.fixtureCases.size} tests)`);
console.log(`Scenario files: ${scenarioFiles.length} (${[...formats].map(([f, n]) => `${n} ${f}`).join(", ")}; ${ctx.scenarioCases.size} scenarios)`);
console.log(`Citations: ${ctx.citations.size} (${[...ctx.citations.keys()].join(", ")}); README coverage rows: ${rows.size}; deferred: ${deferred.length}`);
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
