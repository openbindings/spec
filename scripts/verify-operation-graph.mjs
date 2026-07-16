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
//      Document-shaped tests (the OG-D source rules, which carry an OBI
//      `document` instead of a `graph`) are self-checked: the verifier judges
//      the named rule against the document's operation-graph sources and
//      bindings and compares its own verdict with the fixture's `valid`.
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

// ---------------------------------------------------------------------------
// OG-D source-rule self-checks for document-shaped validation fixtures.
// The verifier judges the named rule against the fixture document's
// operation-graph sources/bindings so fixture verdicts are machine-checked,
// the same way OG-V-11's operation-set resolution is.
// ---------------------------------------------------------------------------

const OG_BINDING_SPEC = "openbindings.operation-graph@1";

const isPlainObject = (v) =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function ogSources(doc) {
  return Object.entries(doc.sources ?? {}).filter(
    ([, src]) => src && src.bindingSpec === OG_BINDING_SPEC
  );
}

function ogBindings(doc) {
  const ogKeys = new Set(ogSources(doc).map(([k]) => k));
  return Object.entries(doc.bindings ?? {}).filter(([, b]) =>
    ogKeys.has(b?.source)
  );
}

// Parses a source's content into the source document it carries: an object
// is the parsed document; a string is JSON source text (RFC 8259). Returns
// undefined when content is absent or not an accepted representation.
function parseOgContent(src) {
  if (!("content" in src)) return undefined;
  if (isPlainObject(src.content)) return src.content;
  if (typeof src.content === "string") {
    try {
      return JSON.parse(src.content);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function pointerResolve(doc, pointer) {
  if (pointer === "") return { found: true, value: doc };
  if (!pointer.startsWith("/")) return { found: false };
  let cur = doc;
  for (const raw of pointer.slice(1).split("/")) {
    const tok = raw.replaceAll("~1", "/").replaceAll("~0", "~");
    if (Array.isArray(cur)) {
      const idx = /^\d+$/.test(tok) ? Number(tok) : -1;
      if (idx < 0 || idx >= cur.length) return { found: false };
      cur = cur[idx];
    } else if (isPlainObject(cur)) {
      if (!Object.prototype.hasOwnProperty.call(cur, tok)) return { found: false };
      cur = cur[tok];
    } else {
      return { found: false };
    }
  }
  return { found: true, value: cur };
}

// Judges an OG-D rule against a fixture document. Returns true (satisfied),
// false (violated), or undefined (rule not covered by this checker).
function checkSourceRule(rule, doc) {
  switch (rule) {
    case "OG-D-01":
      // content, when present, is the parsed source document as an object
      // or its JSON source text as a string.
      return ogSources(doc).every(
        ([, src]) =>
          !("content" in src) ||
          isPlainObject(src.content) ||
          typeof src.content === "string"
      );
    case "OG-D-02":
      // location, when present, is an absolute URI.
      return ogSources(doc).every(([, src]) => {
        if (!("location" in src)) return true;
        if (typeof src.location !== "string") return false;
        try {
          new URL(src.location);
          return true;
        } catch {
          return false;
        }
      });
    case "OG-D-03":
      // ref is present and is a JSON Pointer fragment resolving to a graph
      // definition ("#" addressing a root-level graph). Judged against
      // embedded content; fixtures for this rule always embed it.
      return ogBindings(doc).every(([, b]) => {
        if (typeof b.ref !== "string" || !b.ref.startsWith("#")) return false;
        const [, srcObj] =
          ogSources(doc).find(([k]) => k === b.source) ?? [];
        if (!srcObj) return false;
        const sourceDoc = parseOgContent(srcObj);
        if (sourceDoc === undefined) return false;
        let fragment = b.ref.slice(1);
        try {
          fragment = decodeURIComponent(fragment);
        } catch {
          return false;
        }
        const r = pointerResolve(sourceDoc, fragment);
        return (
          r.found &&
          isPlainObject(r.value) &&
          Object.prototype.hasOwnProperty.call(
            r.value,
            "openbindings.operation-graph"
          )
        );
      });
    default:
      return undefined;
  }
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
      const tlabel = `${label} rule ${block.rule} "${t.description}"`;
      // Document-shaped tests (OG-D source rules) carry an OBI document, not
      // a graph: self-check the named rule against the document's
      // operation-graph sources/bindings instead of the op-graph schema.
      if (t.document !== undefined) {
        const verdict = checkSourceRule(block.rule, t.document);
        if (verdict === undefined) {
          errors.push(`${tlabel}: document-shaped test under rule ${block.rule}, which this verifier has no source-rule check for`);
        } else if (verdict !== t.valid) {
          errors.push(
            `${tlabel}: verifier judges ${block.rule} as ${verdict ? "satisfied" : "violated"}, but fixture says valid=${t.valid}`
          );
        }
        continue;
      }
      const r = ajvOk(OG_SCHEMA, t.graph);
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
