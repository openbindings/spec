#!/usr/bin/env node
// Verifies the openbindings.operation-graph conformance subcorpus and the
// inline normative examples in the format spec.
//
// Checks performed:
//   1. Every operation-graph definition embedded in a fenced JSON block of the
//      format spec validates against the op-graph JSON Schema.
//   2. Each execution-fixture file matches execution.schema.json, and every
//      fixture's `graph` validates against the op-graph JSON Schema and passes
//      basic structural sanity (exactly one input node, exactly one output).
//   3. Each validation-fixture file matches validation.schema.json. Every
//      valid:true graph validates against the op-graph JSON Schema. For rules
//      marked schemaEnforced:true, every valid:false graph is rejected by the
//      schema (the JSON Schema alone is sufficient to catch the violation).
//
// JSON Schema validation shells out to ajv-cli, the same validator the CI uses
// for the core schema. Exits 0 on success, 1 on any failure, 2 on IO/usage.
//
// Usage: node scripts/verify-operation-graph.mjs

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
const OG_DIR = join(SPEC_ROOT, "binding-specs", "operation-graph");
const OG_SCHEMA = join(OG_DIR, "openbindings.operation-graph.schema.json");
const OG_SPEC_MD = join(OG_DIR, "openbindings.operation-graph.md");
const CORPUS = join(SPEC_ROOT, "conformance", "operation-graph");
const EXEC_SCHEMA = join(CORPUS, "execution.schema.json");
const VAL_SCHEMA = join(CORPUS, "validation.schema.json");

const errors = [];
const tmp = mkdtempSync(join(tmpdir(), "og-verify-"));
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

function walkGraphs(obj, out) {
  if (obj && typeof obj === "object") {
    if (
      !Array.isArray(obj) &&
      Object.prototype.hasOwnProperty.call(obj, "openbindings.operation-graph")
    ) {
      out.push(obj);
    }
    for (const k of Object.keys(obj)) walkGraphs(obj[k], out);
  }
}

function extractSpecGraphs(md) {
  const blocks = [...md.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1]);
  const graphs = [];
  for (const b of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(b);
    } catch {
      continue; // non-JSON snippet (e.g. a bare transform expression)
    }
    walkGraphs(parsed, graphs);
  }
  return graphs;
}

function structuralSanity(graph, label) {
  const nodes = graph.nodes || {};
  const types = Object.values(nodes).map((n) => n && n.type);
  const inputs = types.filter((t) => t === "input").length;
  const outputs = types.filter((t) => t === "output").length;
  if (inputs !== 1)
    errors.push(`${label}: expected exactly one input node, found ${inputs}`);
  if (outputs !== 1)
    errors.push(`${label}: expected exactly one output node, found ${outputs}`);
}

function listJson(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith(".json"))
    .sort()
    .map((n) => join(dir, n));
}

// 1. Inline spec examples
const specGraphs = extractSpecGraphs(readFileSync(OG_SPEC_MD, "utf8"));
let specOk = 0;
specGraphs.forEach((g, i) => {
  const r = ajvOk(OG_SCHEMA, g);
  if (!r.ok)
    errors.push(
      `spec example #${i + 1}: does not validate against op-graph schema\n${r.out}`
    );
  else specOk++;
});

// 2. Execution fixtures
let execFiles = 0;
let execGraphs = 0;
for (const file of listJson(join(CORPUS, "execution"))) {
  const label = `execution/${basename(file)}`;
  let doc;
  try {
    doc = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    errors.push(`${label}: bad JSON: ${e.message}`);
    continue;
  }
  const shape = ajvOk(EXEC_SCHEMA, doc);
  if (!shape.ok) {
    errors.push(`${label}: does not match execution.schema.json\n${shape.out}`);
    continue;
  }
  execFiles++;
  for (const fx of doc.fixtures) {
    execGraphs++;
    const r = ajvOk(OG_SCHEMA, fx.graph);
    if (!r.ok)
      errors.push(
        `${label} [${fx.id}]: graph does not validate against op-graph schema\n${r.out}`
      );
    else structuralSanity(fx.graph, `${label} [${fx.id}]`);
  }
}

// 3. Validation fixtures
let valTests = 0;
for (const file of listJson(join(CORPUS, "validation"))) {
  const label = `validation/${basename(file)}`;
  let doc;
  try {
    doc = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    errors.push(`${label}: bad JSON: ${e.message}`);
    continue;
  }
  const shape = ajvOk(VAL_SCHEMA, doc);
  if (!shape.ok) {
    errors.push(`${label}: does not match validation.schema.json\n${shape.out}`);
    continue;
  }
  for (const block of doc.rules) {
    for (const t of block.tests) {
      valTests++;
      const r = ajvOk(OG_SCHEMA, t.graph);
      const tlabel = `${label} rule ${block.rule} "${t.description}"`;
      if (t.valid && !r.ok)
        errors.push(
          `${tlabel}: expected a schema-valid graph, but the op-graph schema rejected it\n${r.out}`
        );
      if (!t.valid && block.schemaEnforced && r.ok)
        errors.push(
          `${tlabel}: rule is schemaEnforced and the graph is invalid, but the op-graph schema accepted it`
        );
      // OG-V-11 cannot be judged from the graph alone; resolve operation and
      // each node references against the containing OBI's operations supplied
      // by the test.
      if (block.rule === "OG-V-11") {
        const ops = t.operations ?? [];
        const refs = Object.values(t.graph.nodes ?? {})
          .filter((n) => n && (n.type === "operation" || n.type === "each"))
          .map((n) => n.operation);
        const allResolve = refs.every((ref) => ops.includes(ref));
        if (allResolve !== t.valid)
          errors.push(
            `${tlabel}: operation refs resolve=${allResolve} against [${ops.join(", ")}], but fixture says valid=${t.valid}`
          );
      }
    }
  }
}

rmSync(tmp, { recursive: true, force: true });

console.log(
  `Operation-graph spec examples validated: ${specOk}/${specGraphs.length}`
);
console.log(`Execution fixture files: ${execFiles} (${execGraphs} graphs)`);
console.log(`Validation fixture tests: ${valTests}`);

if (errors.length) {
  console.log(`\nErrors (${errors.length}):`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log("\nOK");
