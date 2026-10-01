#!/usr/bin/env node
// Compares a reference runner's results with the corpus and with the
// expected failures for the implementation commit the runner was pinned to.
//
// Results (written by the runner's -json mode):
//   {"pin": "<full commit SHA of the implementation run>",
//    "reconciliation": ["<a problem the runner found reconciling its cases with the manifest>"],
//    "cases": [{"id": "<case ID or fixture path#/tests/N>",
//               "status": "pass" | "FAIL" | "SHORTFALL" | "OMITTED" | "ADVISORY" | "UNVERIFIED",
//               "signature": "<a stable one-line description of a failure or omission>"}]}
//
// Expected failures (conformance/runners/go/expected-failures.json):
//   {"pin": "<the same SHA>", "failures": [{"case": "...", "status": "FAIL" | "SHORTFALL" | "UNVERIFIED" (default FAIL),
//                                          "signature": "...", "reason": "..."}]}
//
// The corpus (its conformance/ directory) gives the complete set of case IDs:
// the manifest's files, each holding the number of cases the manifest counts.
//
// It fails when the pins differ; when the runner reported a reconciliation
// problem; when the corpus's case set and the reported one differ; when a
// case is reported twice; when a case is not a pass and gives no reason;
// when a case fails, falls short, or is unverified and is not keyed to that
// status; when an expected failure has another status or is not run; and
// when a keyed signature differs. A case is identified by its ID, never by a
// whole job, so an unrelated failure cannot hide behind a known one. A
// SHORTFALL is no verdict where the profile the implementation declares
// supports every feature the case depends on: the declaration is the
// implementation's own, so falling short of it is unexpected unless keyed.
//
// Exits 0 when the results match, 1 on a mismatch, 2 on usage or IO error.
//
// Usage: node scripts/check-runner-results.mjs --results FILE --expected FILE --corpus DIR

import { readFileSync } from "node:fs";
import { join } from "node:path";

const KEYED = new Set(["FAIL", "SHORTFALL", "UNVERIFIED"]);

function args() {
  const out = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    if (!["--results", "--expected", "--corpus"].includes(argv[i]) || !argv[i + 1]) usage();
    out[argv[i].slice(2)] = argv[i + 1];
  }
  if (!out.results || !out.expected || !out.corpus) usage();
  return out;
}

function usage() {
  console.error("usage: node scripts/check-runner-results.mjs --results FILE --expected FILE --corpus DIR");
  process.exit(2);
}

function load(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.error(`cannot read ${path}: ${e.message}`);
    process.exit(2);
  }
}

// corpusCases reads the manifest under dir and returns every case ID the
// files it lists hold, with any disagreement between a file and the
// manifest's count of it.
export function corpusCases(dir) {
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const ids = [];
  const problems = [];
  for (const f of manifest.files || []) {
    const tests = JSON.parse(readFileSync(join(dir, f.path), "utf8")).tests || [];
    if (tests.length !== f.tests) problems.push(`${f.path}: the manifest counts ${f.tests} cases, the file holds ${tests.length}`);
    tests.forEach((_, i) => ids.push(`${f.path}#/tests/${i}`));
  }
  for (const f of manifest.scenarioFiles || []) {
    const scenarios = JSON.parse(readFileSync(join(dir, f.path), "utf8")).scenarios || [];
    if (scenarios.length !== f.scenarios) problems.push(`${f.path}: the manifest counts ${f.scenarios} cases, the file holds ${scenarios.length}`);
    for (const s of scenarios) ids.push(s.id);
  }
  return { ids, problems };
}

export function compare(results, expected, corpus) {
  const problems = [...corpus.problems];
  if (!/^[0-9a-f]{40}$/.test(results.pin ?? "")) problems.push(`the results name no full commit SHA (pin ${JSON.stringify(results.pin)})`);
  if (results.pin !== expected.pin) problems.push(`the results are for ${results.pin}; the expected failures are keyed to ${expected.pin}`);
  if (!Array.isArray(results.reconciliation)) problems.push("the results carry no reconciliation");
  for (const r of results.reconciliation || []) problems.push(`reconciliation: ${r}`);
  const byCase = new Map();
  for (const c of results.cases || []) {
    if (byCase.has(c.id)) problems.push(`${c.id}: reported twice`);
    byCase.set(c.id, c);
  }
  const inCorpus = new Set(corpus.ids);
  for (const id of corpus.ids) if (!byCase.has(id)) problems.push(`${id}: in the corpus, but not reported`);
  for (const id of byCase.keys()) if (!inCorpus.has(id)) problems.push(`${id}: reported, but not in the corpus`);
  const expectedByCase = new Map();
  for (const f of expected.failures || []) {
    if (expectedByCase.has(f.case)) problems.push(`${f.case}: expected twice`);
    expectedByCase.set(f.case, { ...f, status: f.status ?? "FAIL" });
  }
  for (const c of byCase.values()) {
    if (c.status !== "pass" && !c.signature) problems.push(`${c.id}: ${c.status} with no reason`);
    if (!KEYED.has(c.status)) continue;
    const f = expectedByCase.get(c.id);
    if (!f) problems.push(`${c.id}: unexpected ${c.status === "FAIL" ? "failure" : c.status}: ${c.signature}`);
    else if (f.status !== c.status) problems.push(`${c.id}: expected ${f.status}, got ${c.status}: ${c.signature}`);
    else if (f.signature !== c.signature) problems.push(`${c.id}: ${c.status} signature changed: expected "${f.signature}", got "${c.signature}"`);
  }
  for (const f of expectedByCase.values()) {
    const c = byCase.get(f.case);
    if (!c) problems.push(`${f.case}: expected ${f.status}, but not run`);
    else if (!KEYED.has(c.status)) problems.push(`${f.case}: expected ${f.status}, but ${c.status === "pass" ? "passed" : c.status}`);
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { results, expected, corpus } = args();
  let cases;
  try {
    cases = corpusCases(corpus);
  } catch (e) {
    console.error(`cannot read the corpus at ${corpus}: ${e.message}`);
    process.exit(2);
  }
  const problems = compare(load(results), load(expected), cases);
  for (const p of problems) console.log(`  - ${p}`);
  console.log(problems.length ? `\n${problems.length} mismatch(es)` : "results match the corpus and the expected failures");
  process.exit(problems.length ? 1 : 0);
}
