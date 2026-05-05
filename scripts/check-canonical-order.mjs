#!/usr/bin/env node
// Verifies that typed objects in OBI documents emit their known fields in canonical order.
// Canonical order is the order declared in the openbindings-go and openbindings-ts SDKs and
// mirrored in openbindings.schema.json. Unknown and "x-" extension keys are skipped: they
// MAY appear anywhere relative to known keys.
//
// Usage: node check-canonical-order.mjs <file>...
//
// Exits 0 on success, 1 on any ordering violation, 2 on usage error.

import { readFileSync } from "node:fs";

const CANON = {
  Interface: [
    "openbindings", "name", "version", "description",
    "schemas", "operations", "roles",
    "sources", "bindings",
    "security", "transforms",
  ],
  Operation: [
    "description", "deprecated", "tags", "aliases", "satisfies",
    "idempotent", "input", "output", "examples",
  ],
  Source: ["format", "location", "content", "description", "priority"],
  BindingEntry: [
    "operation", "source", "ref", "priority", "description",
    "deprecated", "security", "inputTransform", "outputTransform",
  ],
  SecurityMethod: [
    "type", "description",
    "authorizeUrl", "tokenUrl", "scopes", "clientId",
    "name", "in",
  ],
  OperationExample: ["description", "input", "output"],
  Satisfies: ["role", "operation"],
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
    (op.satisfies ?? []).forEach((s, i) => {
      checkOrder("Satisfies", s, `${opPath}.satisfies[${i}]`, errors);
    });
  }

  for (const [k, s] of Object.entries(doc.sources ?? {})) {
    checkOrder("Source", s, `${path}.sources[${JSON.stringify(k)}]`, errors);
  }

  for (const [k, b] of Object.entries(doc.bindings ?? {})) {
    checkOrder("BindingEntry", b, `${path}.bindings[${JSON.stringify(k)}]`, errors);
  }

  for (const [k, methods] of Object.entries(doc.security ?? {})) {
    if (!Array.isArray(methods)) continue;
    methods.forEach((m, i) => {
      checkOrder("SecurityMethod", m, `${path}.security[${JSON.stringify(k)}][${i}]`, errors);
    });
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: check-canonical-order.mjs <file>...");
  process.exit(2);
}

let totalErrors = 0;
for (const arg of args) {
  let doc;
  try {
    doc = JSON.parse(readFileSync(arg, "utf8"));
  } catch (e) {
    console.error(`${arg}: parse error: ${e.message}`);
    process.exitCode = 1;
    continue;
  }
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
console.log(`canonical-order: ${args.length} file(s) ok`);
