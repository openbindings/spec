#!/usr/bin/env node
// Verifies that typed objects in OBI documents emit their known fields in canonical order.
// Canonical order is the order declared in the openbindings-go and openbindings-ts SDKs and
// mirrored in openbindings.schema.json. Unknown and "x-" extension keys are skipped: they
// MAY appear anywhere relative to known keys.
//
// The canonical order is the CURRENT spec's. Documents written against an older spec
// version (a smaller `openbindings` field than the newest among the inputs) are frozen,
// immutable snapshots and are skipped: their field order is
// canonical against their own era, which this checker does not carry. The newest cohort
// among the inputs sets "current", so this needs no edit when a future spec version lands.
//
// Usage: node check-canonical-order.mjs <file>...
//
// Exits 0 on success, 1 on any ordering violation, 2 on usage error.

import { readFileSync } from "node:fs";

const CANON = {
  Interface: [
    "openbindings", "name", "version", "description",
    "schemas", "operations", "sources", "bindings", "transforms",
  ],
  Operation: [
    "description", "deprecated", "tags", "aliases",
    "idempotent", "input", "output", "examples",
  ],
  Source: ["format", "location", "content", "description", "priority"],
  BindingEntry: [
    "operation", "source", "ref", "priority", "description",
    "deprecated", "inputTransform", "outputTransform",
  ],
  OperationExample: ["description", "input", "output"],
};

function checkOrder(typeName, obj, path, errors) {
  const canon = CANON[typeName];
  if (!canon || !obj || typeof obj !== "object" || Array.isArray(obj)) return;
  const canonIdx = new Map(canon.map((k, i) => [k, i]));
  let lastIdx = -1;
  let lastKey = null;
  for (const k of Object.keys(obj)) {
    const idx = canonIdx.get(k);
    if (idx === undefined) continue; // extension or unknown; skip
    if (idx < lastIdx) {
      errors.push(`${path}: ${typeName} key "${k}" appears after "${lastKey}" but canonical order is [${canon.join(", ")}]`);
      return; // one violation per object is enough signal
    }
    lastIdx = idx;
    lastKey = k;
  }
}

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function walk(doc, errors, path = "$") {
  if (!isObject(doc)) return;
  checkOrder("Interface", doc, path, errors);

  for (const [k, op] of Object.entries(doc.operations ?? {})) {
    if (!isObject(op)) continue;
    const opPath = `${path}.operations[${JSON.stringify(k)}]`;
    checkOrder("Operation", op, opPath, errors);
    for (const [eName, ex] of Object.entries(op.examples ?? {})) {
      checkOrder("OperationExample", ex, `${opPath}.examples[${JSON.stringify(eName)}]`, errors);
    }
  }

  for (const [k, s] of Object.entries(doc.sources ?? {})) {
    checkOrder("Source", s, `${path}.sources[${JSON.stringify(k)}]`, errors);
  }

  for (const [k, b] of Object.entries(doc.bindings ?? {})) {
    checkOrder("BindingEntry", b, `${path}.bindings[${JSON.stringify(k)}]`, errors);
  }
}

// Compares two dotted version strings ("0.2.0") numerically. Returns -1/0/1.
function cmpVersion(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: check-canonical-order.mjs <file>...");
  process.exit(2);
}

// First pass: parse, and find the newest spec version among the inputs.
const docs = [];
let currentSpec = "0.0.0";
for (const arg of args) {
  try {
    const doc = JSON.parse(readFileSync(arg, "utf8"));
    docs.push({ arg, doc });
    const ver = doc?.openbindings;
    if (typeof ver === "string" && cmpVersion(ver, currentSpec) > 0) currentSpec = ver;
  } catch (e) {
    console.error(`${arg}: parse error: ${e.message}`);
    process.exitCode = 1;
  }
}

let totalErrors = 0;
let checked = 0;
for (const { arg, doc } of docs) {
  const ver = doc?.openbindings;
  if (typeof ver === "string" && cmpVersion(ver, currentSpec) < 0) continue; // frozen prior-spec snapshot
  checked++;
  const errors = [];
  walk(doc, errors);
  if (errors.length > 0) {
    console.error(`${arg}:`);
    for (const e of errors) console.error(`  ${e}`);
    totalErrors += errors.length;
  }
}

if (totalErrors > 0) {
  console.error(`canonical-order: ${totalErrors} violation(s)`);
  process.exit(1);
}
console.log(`canonical-order: ${checked} file(s) ok (${docs.length - checked} prior-spec snapshot(s) skipped)`);
