#!/usr/bin/env node
// Verifies the core conformance corpus against the spec.
//
// Checks performed:
//   1. The clause inventory (conformance/clauses.json) partitions every tool
//      rule's complete text in openbindings.md §10.3, and every incorporated
//      passage it names by anchor, into clauses: in order, with only white
//      space and punctuation between segments. Clause IDs are unique, well
//      formed, classed, and given a status the inventory defines; their
//      references resolve; no retired ID is defined or cited.
//   2. The README's clause table lists exactly the inventory's clauses, with
//      the same class and status.
//   3. Every fixture and scenario file validates against its published JSON
//      Schema (scenario files must declare format @2) and passes the
//      semantic checks below: rule and section
//      references, violates and notViolated (document rules only, disjoint,
//      only on a negative fixture), case IDs (unique, of the file's rule, never a retired
//      one), clause tags (defined, never retired, at least one of the file's
//      rule), version gates (consistent by support unit, §8.1), per-action
//      consistency (one result per value, one verdict per probe, named
//      operations, bindings, and dependencies present unless the document is
//      marked non-conformant, absolute resource URIs, complete example
//      expectations, retrieval sentinels present), collision groups, and
//      conclusions that follow from their evidence (a rule the evidence omits
//      is not established).
//   4. Every migrated case's record (clauses.json, caseIdentity) points at a
//      case that exists.
//   5. Every spec rule has a fixture or scenario file or is deferred in the
//      README, and every clause whose status claims cases has at least one.
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
const CLAUSES = join(CONFORMANCE_ROOT, "clauses.json");
const FIXTURE_SCHEMA = join(CONFORMANCE_ROOT, "fixture.schema.json");
const SCENARIO_SCHEMAS = {
  "openbindings.core-tool-scenarios@2": join(CONFORMANCE_ROOT, "tool-scenario.schema.json"),
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

function extractSpecRules(md) {
  // Lines like "- **OBI-D-01**: Is valid UTF-8 ..." and "- **OBI-T-04** (all processors): ...".
  const rules = new Map();
  const re = /^\s*-\s*\*\*(OBI-[DT]-\d+)\*\*[^:]*:\s*(.*)$/gm;
  let m;
  while ((m = re.exec(md)) !== null) rules.set(m[1], m[2].trim());
  return rules;
}

const inferSectionForRule = (ruleId) => (ruleId.startsWith("OBI-D-") ? "10.2" : "10.3");

// The normalization and block extraction the clause inventory is written
// against: markdown links reduced to their text, "**" removed, "*Note:*"
// read as "Note:", and a block made of a bullet or paragraph line with every
// continuation line (lazy continuations, indented lines, indented paragraphs
// after a blank line), until the next top-level bullet, heading, or
// unindented paragraph, its white space runs collapsed.
function normalizeMarkdown(text) {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replaceAll("**", "").replaceAll("*Note:*", "Note:");
}

function block(lines, start) {
  const out = [lines[start]];
  let i = start + 1;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length && /^\s{2,}\S/.test(lines[j])) {
        i = j;
        continue;
      }
      break;
    }
    if (/^(- |#)/.test(line)) break;
    out.push(line);
    i++;
  }
  return out.map((x) => x.trim()).join(" ").replace(/\s+/g, " ").trim();
}

function partition(body, segments, label) {
  let cursor = 0;
  for (const [i, seg] of segments.entries()) {
    const idx = body.indexOf(seg.text, cursor);
    if (idx < 0) {
      err(`${label}: segment ${i} not found in order: ${JSON.stringify(seg.text.slice(0, 60))}`);
      return;
    }
    const gap = body.slice(cursor, idx);
    if ((i === 0 && gap) || !/^[\s,;:.]*$/.test(gap)) {
      err(`${label}: text the inventory does not account for before segment ${i}: ${JSON.stringify(gap)}`);
    }
    cursor = idx + seg.text.length;
  }
  const rest = body.slice(cursor);
  if (rest.trim()) err(`${label}: text the inventory does not account for after the last segment: ${JSON.stringify(rest)}`);
}

// ---------------------------------------------------------------- versions

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

// The unit a tool supports a version under (§8.1): a release's major.minor
// line, build metadata ignored; a prerelease's full version.
function supportUnit(v) {
  const m = SEMVER.exec(v);
  return m[4] ? `${m[1]}.${m[2]}.${m[3]}-${m[4]}` : `${m[1]}.${m[2]}`;
}

function compareRelease(a, b) {
  const pa = SEMVER.exec(a);
  const pb = SEMVER.exec(b);
  for (let i = 1; i <= 3; i++) {
    const x = BigInt(pa[i]);
    const y = BigInt(pb[i]);
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

function checkGates(item, label) {
  const sup = item.requiresSupports;
  const uns = item.requiresUnsupported;
  const low = item.requiresMinSupported;
  for (const [k, v] of [["requiresSupports", sup], ["requiresUnsupported", uns], ["requiresMinSupported", low]]) {
    if (v !== undefined && (typeof v !== "string" || !SEMVER.test(v))) err(`${label}: ${k} ${JSON.stringify(v)} is not a SemVer 2.0.0 version`);
  }
  const ok = (v) => typeof v === "string" && SEMVER.test(v);
  if (ok(sup) && ok(uns) && supportUnit(sup) === supportUnit(uns)) {
    err(`${label}: ${sup} is required supported and ${uns} unsupported, but both are support unit ${supportUnit(sup)} (§8.1)`);
  }
  if (ok(sup) && ok(low) && compareRelease(sup, low) < 0) {
    err(`${label}: ${sup} is required supported, below the required lowest supported version ${low}`);
  }
}

// ---------------------------------------------------------------- inventory

const CLAUSE_ID = /^(OBI-T-\d\d)\/c\d+[a-z]?(?:\.[pi]\d+)?$/;
const CLASSES = new Set(["obligation", "specialization", "alternative", "definition", "permission", "incorporation"]);
const UNIT_CLASSES = new Set(["obligation", "specialization", "alternative"]);
// Statuses that claim at least one case cites the clause.
const STATUSES_WITH_CASES = new Set(["tested", "tested (adapter)", "composition only", "contrast tools only", "expressible, no executor"]);
// Statuses that a parent obligation earns through its alternatives or specializations.
const STATUSES_THROUGH_CHILDREN = new Set([
  "tested through its alternatives",
  "tested through its specializations",
  "tested through its exercised alternative",
]);

function verifyInventory(md, inventory, specRules) {
  const lines = normalizeMarkdown(md).split("\n");
  const bodies = new Map();
  for (const [n, line] of lines.entries()) {
    const m = /^- (OBI-T-\d\d) /.exec(line);
    if (m) bodies.set(m[1], block(lines, n).slice(m[0].length));
  }
  const toolRules = [...specRules.keys()].filter((r) => r.startsWith("OBI-T-")).sort();
  const inventoried = (inventory.rules || []).map((r) => r.rule).sort();
  if (JSON.stringify(inventoried) !== JSON.stringify(toolRules)) {
    err(`clauses.json: inventoried rules ${inventoried.join(", ")} differ from the spec's tool rules ${toolRules.join(", ")}`);
  }
  const statuses = new Set(Object.keys(inventory.statuses || {}));
  if (statuses.size === 0) err("clauses.json: no statuses defined");
  const items = new Map();
  const define = (item, rule, label) => {
    if (!CLAUSE_ID.test(item.id ?? "")) {
      err(`${label}: clause ID ${JSON.stringify(item.id)} is not of the form OBI-T-NN/cK`);
      return;
    }
    if (CLAUSE_ID.exec(item.id)[1] !== rule) err(`${label}: clause ${item.id} is not a clause of ${rule}`);
    if (items.has(item.id)) err(`clauses.json: duplicate clause ID ${item.id}`);
    items.set(item.id, item);
    if (!CLASSES.has(item.class)) err(`${item.id}: unknown class ${JSON.stringify(item.class)}`);
    if (!statuses.has(item.status)) err(`${item.id}: status ${JSON.stringify(item.status)} is not one clauses.json defines`);
    const nonUnit = { definition: "definition", permission: "permission", incorporation: "incorporation" }[item.class];
    if (nonUnit && item.status !== nonUnit) err(`${item.id}: a ${item.class} has status ${nonUnit}, not ${JSON.stringify(item.status)}`);
    if (UNIT_CLASSES.has(item.class) && ["definition", "permission", "incorporation"].includes(item.status)) {
      err(`${item.id}: an ${item.class} cannot have status ${item.status}`);
    }
  };
  for (const rule of inventory.rules || []) {
    const name = rule.rule;
    const body = bodies.get(name);
    if (body === undefined) continue;
    partition(body, rule.segments || [], name);
    if (rule.segments?.[0]?.kind !== "trigger") err(`${name}: the first segment is not the trigger`);
    const placed = new Set();
    for (const seg of rule.segments || []) {
      if (seg.kind === "clause") {
        if (!seg.clauses?.length) err(`${name}: a clause segment names no clause`);
        for (const c of seg.clauses || []) placed.add(c);
      } else if (!["trigger", "note"].includes(seg.kind)) {
        err(`${name}: unknown segment kind ${JSON.stringify(seg.kind)}`);
      }
    }
    const defined = new Set();
    for (const c of rule.clauses || []) {
      define(c, name, name);
      defined.add(c.id);
    }
    const unplaced = [...placed].filter((c) => !defined.has(c)).concat([...defined].filter((c) => !placed.has(c)));
    if (unplaced.length) err(`${name}: clause IDs ${unplaced.join(", ")} are not both defined and placed in a segment`);
    for (const inc of rule.incorporations || []) {
      const starts = lines.flatMap((l, n) => (l.startsWith(inc.anchor) ? [n] : []));
      if (starts.length !== 1) {
        err(`${name}: incorporation anchor ${JSON.stringify(inc.anchor)} found ${starts.length} times`);
        continue;
      }
      let passage = block(lines, starts[0]);
      if (passage.startsWith("- ")) passage = passage.slice(2);
      partition(passage, inc.segments || [], `${name} ${inc.source}`);
      for (const seg of inc.segments || []) {
        if (seg.kind === "context") continue;
        define(seg, name, `${name} ${inc.source}`);
      }
    }
  }
  for (const item of items.values()) {
    for (const ref of [item.of, ...(item.incorporates || []), item.claim].filter(Boolean)) {
      if (!items.has(ref)) err(`${item.id}: refers to unknown clause ${ref}`);
    }
  }
  const retired = new Set();
  for (const r of inventory.retiredClauses || []) {
    if (!CLAUSE_ID.test(r.id ?? "") || !r.reason) err(`clauses.json: retired clause entry ${JSON.stringify(r)} needs an ID and a reason`);
    if (items.has(r.id)) err(`clauses.json: retired clause ${r.id} is defined again`);
    retired.add(r.id);
  }
  return { items, retired };
}

// README clause table: | OBI-T-NN/cK | class | status | notes |
function verifyReadmeTable(readme, items) {
  const rows = new Map();
  const re = /^\|\s*(OBI-T-\d\d\/c[0-9a-z.]+)\s*\|\s*([a-z]+)\s*\|\s*([^|]+?)\s*\|/gm;
  let m;
  while ((m = re.exec(readme)) !== null) {
    if (rows.has(m[1])) err(`README clause table: ${m[1]} appears twice`);
    rows.set(m[1], { cls: m[2], status: m[3] });
  }
  for (const [id, item] of items) {
    const row = rows.get(id);
    if (!row) {
      err(`README clause table: ${id} is missing`);
      continue;
    }
    if (row.cls !== item.class) err(`README clause table: ${id} has class ${row.cls}; clauses.json says ${item.class}`);
    if (row.status !== item.status) err(`README clause table: ${id} has status "${row.status}"; clauses.json says "${item.status}"`);
  }
  for (const id of rows.keys()) if (!items.has(id)) err(`README clause table: ${id} is not in clauses.json`);
  return rows.size;
}

function extractDeferredRules(readme) {
  const out = new Set();
  const re = /\|\s*(OBI-[DT]-\d+(?:\s*,\s*OBI-[DT]-\d+)*)\s*\|\s*\*\*Deferred/g;
  let m;
  while ((m = re.exec(readme)) !== null) for (const id of m[1].split(/\s*,\s*/)) out.add(id);
  return out;
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

function checkClauseTags(tags, fileRule, label, ctx) {
  if (!Array.isArray(tags) || tags.length === 0) {
    err(`${label}: names no clause`);
    return;
  }
  for (const c of tags) {
    if (ctx.retired.has(c)) err(`${label}: cites retired clause ${c}`);
    else if (!ctx.items.has(c)) err(`${label}: cites undefined clause ${c}`);
    ctx.citations.set(c, (ctx.citations.get(c) || 0) + 1);
  }
  if (!tags.some((c) => c.startsWith(`${fileRule}/`))) err(`${label}: names no clause of ${fileRule}`);
}

function verifyFixture(fixture, relPath, ctx) {
  for (const f of ["rule", "section", "description", "tests"]) if (!(f in fixture)) err(`${relPath}: missing required field '${f}'`);
  if (!/^OBI-[DT]-\d+$/.test(fixture.rule ?? "")) {
    err(`${relPath}: rule '${fixture.rule}' does not match OBI-[DT]-NN`);
    return;
  }
  if (!ctx.specRules.has(fixture.rule)) err(`${relPath}: rule '${fixture.rule}' is not defined in openbindings.md §10`);
  if (fixture.section !== inferSectionForRule(fixture.rule)) {
    err(`${relPath}: section is '${fixture.section}', expected '${inferSectionForRule(fixture.rule)}' for ${fixture.rule}`);
  }
  const isTool = relPath.startsWith("tool/");
  if (isTool !== fixture.rule.startsWith("OBI-T-")) err(`${relPath}: a ${isTool ? "tool" : "document"} fixture file names ${fixture.rule}`);
  if (!Array.isArray(fixture.tests) || fixture.tests.length === 0) {
    err(`${relPath}: tests must be a non-empty array`);
    return;
  }
  fixture.tests.forEach((t, i) => {
    const label = `${relPath}#/tests/${i}`;
    const inputs = ["document", "documentText", "documentBase64"].filter((f) => f in t);
    if (inputs.length !== 1) err(`${label}: exactly one of document, documentText, or documentBase64 is required`);
    if ("documentBase64" in t && !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(t.documentBase64)) {
      err(`${label}: documentBase64 is not canonical base64 text`);
    }
    for (const member of ["violates", "notViolated"]) {
      if (!(member in t)) continue;
      if (t.valid !== false) err(`${label}: ${member} is meaningful only when valid is false`);
      for (const v of t[member] || []) {
        if (!/^OBI-D-\d+$/.test(v)) err(`${label}: ${member} names ${v}; a tool rule is never a document violation`);
        else if (!ctx.specRules.has(v)) err(`${label}: ${member} names ${v}, which openbindings.md §10 does not define`);
      }
    }
    const both = (t.violates || []).filter((v) => (t.notViolated || []).includes(v));
    if (both.length) err(`${label}: ${both.join(", ")} is listed both in violates and in notViolated`);
    checkGates(t, label);
    if (isTool) checkClauseTags(t.clauses, fixture.rule, label, ctx);
    else if ("clauses" in t) err(`${label}: clauses are tool-rule tags; document fixtures are keyed by rule`);
    ctx.fixtureCases.set(label, t);
  });
}

// ---- @2 ------------------------------------------------------------------------

function recordCaseId(id, rule, label, ctx) {
  const expected = new RegExp(`^${rule.replace("OBI-T-", "T")}-S-[0-9]{2}$`);
  if (typeof id !== "string" || !expected.test(id)) err(`${label}: case ID ${JSON.stringify(id)} does not match ${rule}`);
  else if (ctx.caseIds.has(id)) err(`${label}: duplicate case ID ${id} (also ${ctx.caseIds.get(id)})`);
  else ctx.caseIds.set(id, label);
  if (ctx.retiredCases.has(id)) err(`${label}: reuses retired case ID ${id}`);
}

function checkConclusion(evidence, conclusion, label, ctx) {
  const drules = [...ctx.specRules.keys()].filter((r) => r.startsWith("OBI-D-"));
  for (const [id, status] of Object.entries(evidence)) {
    if (!ctx.specRules.has(id) || !id.startsWith("OBI-D-")) err(`${label}: evidence names ${id}, not a document rule of §10.2`);
    if (!["satisfied", "violated", "inconclusive", "not-applicable"].includes(status)) err(`${label}: evidence ${id}=${JSON.stringify(status)}`);
  }
  // OBI-T-09: a violation establishes non-conformance; otherwise any rule not
  // established, inconclusive or absent from the evidence, leaves it undetermined.
  const statuses = drules.map((r) => evidence[r] ?? "absent");
  const want = statuses.includes("violated")
    ? "non-conformant"
    : statuses.some((s) => s === "inconclusive" || s === "absent")
      ? "conformance-undetermined"
      : "conformant";
  if (conclusion !== want) err(`${label}: expected conclusion ${conclusion} does not follow from the evidence (OBI-T-09 gives ${want})`);
}

function verifyScenarioV2(file, relPath, ctx) {
  for (const [i, s] of (file.scenarios || []).entries()) {
    const label = `${relPath}#${s.id ?? i}`;
    recordCaseId(s.id, file.rule, label, ctx);
    checkClauseTags(s.clauses, file.rule, label, ctx);
    checkGates(s, label);
    ctx.scenarioCases.set(s.id, { scenario: s, file: relPath, format: "@2" });
    const g = isObject(s.given) ? s.given : {};
    const e = isObject(s.expected) ? s.expected : {};
    const d = isObject(g.document) ? g.document : null;
    const nonConformant = Array.isArray(g.nonConformant) && g.nonConformant.length > 0;
    for (const r of g.nonConformant || []) if (!ctx.specRules.has(r)) err(`${label}: nonConformant names ${r}, which §10.2 does not define`);
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
        if (d && !nonConformant && !(g.operation in operations)) err(`${label}: operation ${JSON.stringify(g.operation)} is not in the document`);
        break;
      }
      case "derive-form":
        if ((e.probeVerdicts || []).length !== (g.probes || []).length) err(`${label}: probe and verdict counts differ`);
        if (d && !(g.operation in operations)) err(`${label}: operation ${JSON.stringify(g.operation)} is not in the document`);
        break;
      case "check-examples": {
        const op = operations[g.operation];
        if (!isObject(op)) {
          err(`${label}: operation ${JSON.stringify(g.operation)} is not in the document`);
          break;
        }
        const examples = isObject(op.examples) ? op.examples : {};
        const want = Object.keys(examples).sort();
        const have = Object.keys(e.examples || {}).sort();
        if (JSON.stringify(want) !== JSON.stringify(have)) err(`${label}: expectations cover ${have.join(", ")}; the operation's examples are ${want.join(", ")}`);
        for (const [name, ex] of Object.entries(examples)) {
          const sides = ["input", "output"].filter((k) => k in ex);
          const expectedSides = Object.keys(e.examples?.[name] || {}).sort();
          if (JSON.stringify(sides) !== JSON.stringify(expectedSides)) err(`${label}: example ${name} supplies ${sides.join(", ") || "no value"}; expectations cover ${expectedSides.join(", ") || "none"}`);
        }
        break;
      }
      case "check-dependency-kind": {
        if (d && !nonConformant && (!isObject(d.dependencies) || !(g.dependency in d.dependencies) || !isObject(d.bindings) || !(g.binding in d.bindings))) {
          err(`${label}: the named dependency or binding is not in the document`);
        }
        const text = JSON.stringify(g.document);
        for (const channel of ["file", "http"]) {
          const token = `{retrieval-sentinel:${channel}}`;
          const listed = (g.retrievalSentinels || []).includes(channel);
          if (listed !== text.includes(token)) err(`${label}: retrieval sentinel ${channel} is ${listed ? "listed but not in the document" : "in the document but not listed"}`);
        }
        break;
      }
      case "resolve-operation":
        if (e.outcome === "collision") {
          if (!nonConformant || !g.nonConformant.includes("OBI-D-04")) err(`${label}: a collision document violates OBI-D-04 and is marked so`);
          if (!(e.keyMatch in operations) || !(operations[e.aliasMatch]?.aliases || []).includes(g.name) || e.keyMatch !== g.name) {
            err(`${label}: the collision's keyMatch and aliasMatch do not match the document`);
          }
          (ctx.groups.get(e.group) || ctx.groups.set(e.group, []).get(e.group)).push(s.id);
        }
        break;
      case "validate-document":
        if ("violates" in e && e.outcome !== "non-conformant") err(`${label}: violates without a non-conformant outcome`);
        for (const r of e.violates || []) if (!ctx.specRules.has(r)) err(`${label}: violates names ${r}, which §10.2 does not define`);
        break;
      case "conclude-conformance":
        checkConclusion(g.evidence || {}, e.conclusion, label, ctx);
        break;
      default:
        err(`${label}: unknown action ${JSON.stringify(s.action)}`);
    }
  }
}

// ---------------------------------------------------------------- main

const md = readText(SPEC_MD);
const readme = readText(README);
const specRules = extractSpecRules(md);
const inventory = JSON.parse(readText(CLAUSES));
const { items, retired } = verifyInventory(md, inventory, specRules);
const tableRows = verifyReadmeTable(readme, items);
const deferredRules = extractDeferredRules(readme);

const ctx = {
  specRules,
  items,
  retired,
  citations: new Map(),
  caseIds: new Map(),
  retiredCases: new Set((inventory.caseIdentity?.retired || []).map((r) => r.id)),
  groups: new Map(),
  fixtureCases: new Map(),
  scenarioCases: new Map(),
};

const fixtureRules = new Map();
const fixtures = [...listJSON("document"), ...listJSON("tool")];
for (const { relPath, absPath } of fixtures) {
  validateAgainstSchema(FIXTURE_SCHEMA, absPath, relPath);
  const fixture = loadJSON(absPath, relPath);
  if (!isObject(fixture)) continue;
  verifyFixture(fixture, relPath, ctx);
  if (/^OBI-[DT]-\d+$/.test(fixture.rule ?? "")) {
    if (fixtureRules.has(fixture.rule)) err(`Multiple fixture files declare rule ${fixture.rule}: ${fixtureRules.get(fixture.rule)} and ${relPath}`);
    else fixtureRules.set(fixture.rule, relPath);
  }
}

const scenarioRules = new Map();
const formats = new Map();
const scenarioFiles = listJSON("scenarios");
for (const { relPath, absPath } of scenarioFiles) {
  const file = loadJSON(absPath, relPath);
  if (!isObject(file)) continue;
  const schema = SCENARIO_SCHEMAS[file.format];
  if (!schema) {
    err(`${relPath}: unsupported format ${JSON.stringify(file.format)}`);
    continue;
  }
  validateAgainstSchema(schema, absPath, relPath);
  formats.set(file.format, (formats.get(file.format) || 0) + 1);
  if (!/^OBI-T-\d+$/.test(file.rule ?? "") || !specRules.has(file.rule)) {
    err(`${relPath}: rule '${file.rule}' is not a tool rule defined in openbindings.md §10`);
    continue;
  }
  if (file.section !== "10.3") err(`${relPath}: section is '${file.section}', expected '10.3'`);
  if (relPath.split("/").at(-1) !== `${file.rule}.json`) err(`${relPath}: filename must be '${file.rule}.json'`);
  if (scenarioRules.has(file.rule)) err(`Multiple scenario files declare rule ${file.rule}: ${scenarioRules.get(file.rule)} and ${relPath}`);
  else scenarioRules.set(file.rule, relPath);
  if (!Array.isArray(file.scenarios) || file.scenarios.length === 0) {
    err(`${relPath}: scenarios must be a non-empty array`);
    continue;
  }
  verifyScenarioV2(file, relPath, ctx);
}

for (const [group, members] of ctx.groups) if (members.length < 2) err(`collision group ${group} has ${members.length} member`);

runSchemaJobs();

// Migrated cases: each record points at a case that exists.
const migratedFrom = new Set();
for (const m of inventory.caseIdentity?.migrated || []) {
  if (migratedFrom.has(m.from)) err(`clauses.json: migration source ${m.from} appears twice`);
  migratedFrom.add(m.from);
  const [path, anchor] = m.to.split("#");
  if (path.startsWith("scenarios/")) {
    const c = ctx.scenarioCases.get(anchor);
    if (!c || c.file !== path) err(`clauses.json: migration ${m.from} -> ${m.to}: no such scenario`);
  } else {
    const t = ctx.fixtureCases.get(m.to);
    if (!t) err(`clauses.json: migration ${m.from} -> ${m.to}: no such fixture test`);
    else if (t.description !== m.fromDescription) err(`clauses.json: migration ${m.from} -> ${m.to}: the test's description differs from the migrated one`);
  }
}

// Rule coverage: every spec rule has a file or is deferred in the README.
for (const ruleId of specRules.keys()) {
  if (!fixtureRules.has(ruleId) && !scenarioRules.has(ruleId) && !deferredRules.has(ruleId)) {
    err(`Spec rule ${ruleId} has no fixture or scenario file and is not listed as deferred in conformance/README.md`);
  }
}
for (const ruleId of deferredRules) {
  if (fixtureRules.has(ruleId) || scenarioRules.has(ruleId)) warn(`Rule ${ruleId} is listed as deferred in README but also has a corpus file`);
}

// Clause coverage: a status that claims cases has them; a parent's status
// rests on children that are themselves covered.
const children = new Map();
for (const item of items.values()) if (item.of && ["alternative", "specialization"].includes(item.class)) (children.get(item.of) || children.set(item.of, []).get(item.of)).push(item.id);
for (const item of items.values()) {
  if (STATUSES_WITH_CASES.has(item.status) && !ctx.citations.get(item.id)) err(`${item.id}: status "${item.status}" but no case cites it`);
  if (STATUSES_THROUGH_CHILDREN.has(item.status)) {
    const kids = children.get(item.id) || [];
    if (kids.length === 0) err(`${item.id}: status "${item.status}" but it has no alternatives or specializations`);
    const tested = kids.filter((k) => items.get(k).status.startsWith("tested"));
    if (item.status !== "tested through its exercised alternative" && tested.length !== kids.length) {
      err(`${item.id}: status "${item.status}" but ${kids.filter((k) => !tested.includes(k)).join(", ")} ${kids.length - tested.length === 1 ? "is" : "are"} not tested`);
    }
    if (item.status === "tested through its exercised alternative" && tested.length === 0) err(`${item.id}: no alternative is tested`);
  }
}

// Report
const units = [...items.values()].filter((i) => UNIT_CLASSES.has(i.class));
console.log(`Spec rules found in §10: ${specRules.size}`);
console.log(`Clause inventory: ${items.size} clause IDs (${units.length} obligation-type units) partitioning ${inventory.rules?.length ?? 0} tool rules; README clause table rows: ${tableRows}`);
console.log(`Fixture files: ${fixtures.length} (${ctx.fixtureCases.size} tests); rules covered by fixtures: ${fixtureRules.size}`);
console.log(`Tool scenario files: ${scenarioFiles.length} (${[...formats].map(([f, n]) => `${n} ${f}`).join(", ")}; ${ctx.scenarioCases.size} scenarios); rules covered by tool scenarios: ${scenarioRules.size}`);
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
