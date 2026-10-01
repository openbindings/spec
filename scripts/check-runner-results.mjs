#!/usr/bin/env node
// Compares a reference runner's results with the expected failures for the
// implementation commit the runner was pinned to.
//
// Results (written by the runner's -json mode):
//   {"pin": "<full commit SHA of the implementation run>",
//    "cases": [{"id": "<case ID or fixture path#/tests/N>",
//               "status": "pass" | "FAIL" | "SHORTFALL" | "OMITTED" | "ADVISORY" | "UNVERIFIED",
//               "signature": "<a stable one-line description of a failure>"}]}
//
// Expected failures (conformance/runners/go/expected-failures.json):
//   {"pin": "<the same SHA>", "failures": [{"case": "...", "signature": "...", "reason": "..."}]}
//
// It fails when the pins differ, when a case fails that is not expected to,
// when an expected failure passes or is not run, or when a failure's
// signature differs from the expected one. A case is identified by its ID,
// never by a whole job, so an unrelated failure cannot hide behind a known one.
//
// Exits 0 when the results match, 1 on a mismatch, 2 on usage or IO error.
//
// Usage: node scripts/check-runner-results.mjs --results FILE --expected FILE

import { readFileSync } from "node:fs";

function args() {
  const out = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    if (!["--results", "--expected"].includes(argv[i]) || !argv[i + 1]) {
      console.error("usage: node scripts/check-runner-results.mjs --results FILE --expected FILE");
      process.exit(2);
    }
    out[argv[i].slice(2)] = argv[i + 1];
  }
  if (!out.results || !out.expected) {
    console.error("usage: node scripts/check-runner-results.mjs --results FILE --expected FILE");
    process.exit(2);
  }
  return out;
}

function load(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.error(`cannot read ${path}: ${e.message}`);
    process.exit(2);
  }
}

export function compare(results, expected) {
  const problems = [];
  if (!/^[0-9a-f]{40}$/.test(results.pin ?? "")) problems.push(`the results name no full commit SHA (pin ${JSON.stringify(results.pin)})`);
  if (results.pin !== expected.pin) problems.push(`the results are for ${results.pin}; the expected failures are keyed to ${expected.pin}`);
  const byCase = new Map();
  for (const c of results.cases || []) {
    if (byCase.has(c.id)) problems.push(`${c.id}: reported twice`);
    byCase.set(c.id, c);
  }
  const expectedByCase = new Map();
  for (const f of expected.failures || []) {
    if (expectedByCase.has(f.case)) problems.push(`${f.case}: expected twice`);
    expectedByCase.set(f.case, f);
  }
  for (const c of byCase.values()) {
    if (c.status !== "FAIL") continue;
    const f = expectedByCase.get(c.id);
    if (!f) problems.push(`${c.id}: unexpected failure: ${c.signature}`);
    else if (f.signature !== c.signature) problems.push(`${c.id}: failure signature changed: expected "${f.signature}", got "${c.signature}"`);
  }
  for (const f of expectedByCase.values()) {
    const c = byCase.get(f.case);
    if (!c) problems.push(`${f.case}: expected to fail, but not run`);
    else if (c.status !== "FAIL") problems.push(`${f.case}: expected to fail, but ${c.status === "pass" ? "passed" : c.status}`);
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { results, expected } = args();
  const problems = compare(load(results), load(expected));
  for (const p of problems) console.log(`  - ${p}`);
  console.log(problems.length ? `\n${problems.length} mismatch(es)` : "results match the expected failures");
  process.exit(problems.length ? 1 : 0);
}
