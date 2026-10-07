#!/usr/bin/env node
// Controls for scripts/check-runner-results.mjs: each synthetic result set
// must produce exactly the stated mismatches. Exits 0 when all do.
//
// Usage: node scripts/test-check-runner-results.mjs

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compare, corpusCases } from "./check-runner-results.mjs";

const PIN = "0123456789abcdef0123456789abcdef01234567";
const OTHER = "fedcba9876543210fedcba9876543210fedcba98";
const FIXTURE = "document/OBI-01.json#/tests/0";
const pass = (id) => ({ id, status: "pass", signature: "" });
const fail = (id, signature) => ({ id, status: "FAIL", signature });
const as = (id, status, signature) => ({ id, status, signature });
const SIG = "concluded non-conformant; expected conformant";
const expected = { pin: PIN, failures: [{ case: "CONFORMANCE-06", signature: SIG, reason: "control" }] };
const corpus = { ids: [FIXTURE, "VALUES-01", "CONFORMANCE-06", "NAMES-01"], problems: [] };
const results = (cases, extra = {}) => ({ pin: PIN, reconciliation: [], cases, ...extra });
const ordinary = [pass(FIXTURE), pass("VALUES-01"), pass("NAMES-01")];
const without = (id) => ordinary.filter((c) => c.id !== id);
const omitted = { pin: PIN, failures: expected.failures, omissions: [{ case: "VALUES-01", signature: "action not implemented", reason: "control" }] };

// A corpus whose manifest miscounts a file.
const dir = mkdtempSync(join(tmpdir(), "check-runner-results-"));
mkdirSync(join(dir, "document"));
mkdirSync(join(dir, "scenarios"));
writeFileSync(join(dir, "document", "OBI-01.json"), JSON.stringify({ tests: [{}, {}] }));
writeFileSync(join(dir, "scenarios", "10-conformance.json"), JSON.stringify({ scenarios: [{ id: "CONFORMANCE-06" }] }));
writeFileSync(join(dir, "manifest.json"), JSON.stringify({
  files: [{ path: "document/OBI-01.json", tests: 1 }],
  scenarioFiles: [{ path: "scenarios/10-conformance.json", scenarios: 1 }],
}));
const miscounted = corpusCases(dir);
rmSync(dir, { recursive: true, force: true });

const controls = [
  ["the expected failure and passes elsewhere match", results([...ordinary, fail("CONFORMANCE-06", SIG)]), corpus, []],
  ["an unexpected failure", results([...without("VALUES-01"), fail("VALUES-01", "x"), fail("CONFORMANCE-06", SIG)]), corpus, ["unexpected failure"]],
  ["an expected failure that passes", results([...ordinary, pass("CONFORMANCE-06")]), corpus, ["expected FAIL, but passed"]],
  ["an expected failure not run", results(ordinary), corpus, ["expected FAIL, but not run", "CONFORMANCE-06: in the corpus, but not reported"]],
  ["a changed signature", results([...ordinary, fail("CONFORMANCE-06", "concluded conformant; expected non-conformant")]), corpus, ["signature changed"]],
  ["results for another pin", results([...ordinary, fail("CONFORMANCE-06", SIG)], { pin: OTHER }), corpus, ["keyed to"]],
  ["a short pin", results([...ordinary, fail("CONFORMANCE-06", SIG)], { pin: "0123456" }), corpus, ["no full commit SHA", "keyed to"]],
  ["a case reported twice", results([...ordinary, pass("VALUES-01"), fail("CONFORMANCE-06", SIG)]), corpus, ["reported twice"]],
  ["a missing ordinary case", results([pass(FIXTURE), pass("NAMES-01"), fail("CONFORMANCE-06", SIG)]), corpus, ["VALUES-01: in the corpus, but not reported"]],
  ["a case the corpus does not hold", results([...ordinary, pass("VALUES-99"), fail("CONFORMANCE-06", SIG)]), corpus, ["VALUES-99: reported, but not in the corpus"]],
  ["a wrong manifest count", results([pass("document/OBI-01.json#/tests/0"), pass("document/OBI-01.json#/tests/1"), fail("CONFORMANCE-06", SIG)]), miscounted, ["the manifest counts 1 cases, the file holds 2"]],
  ["an unexplained omission", results([...without("VALUES-01"), as("VALUES-01", "OMITTED", ""), fail("CONFORMANCE-06", SIG)]), corpus, ["OMITTED with no reason", "unexpected OMITTED"]],
  ["an explained but unkeyed omission", results([...without("VALUES-01"), as("VALUES-01", "OMITTED", "action not implemented"), fail("CONFORMANCE-06", SIG)]), corpus, ["unexpected OMITTED"]],
  ["a keyed omission", results([...without("VALUES-01"), as("VALUES-01", "OMITTED", "action not implemented"), fail("CONFORMANCE-06", SIG)]), corpus, [], omitted],
  ["a keyed omission with another reason", results([...without("VALUES-01"), as("VALUES-01", "OMITTED", "another reason"), fail("CONFORMANCE-06", SIG)]), corpus, ["signature changed"], omitted],
  ["a keyed omission that is executed", results([...ordinary, fail("CONFORMANCE-06", SIG)]), corpus, ["expected OMITTED, but passed"], omitted],
  ["an omission keyed under failures", results([...without("VALUES-01"), as("VALUES-01", "OMITTED", "action not implemented"), fail("CONFORMANCE-06", SIG)]), corpus, ["keyed under omissions"],
    { pin: PIN, failures: [...expected.failures, { case: "VALUES-01", status: "OMITTED", signature: "action not implemented", reason: "control" }] }],
  ["an unknown status", results([...without("VALUES-01"), as("VALUES-01", "ERROR", "no verdict"), fail("CONFORMANCE-06", SIG)]), corpus, ["not a run category"]],
  ["a misspelled status", results([...without("VALUES-01"), as("VALUES-01", "shortfall", "no verdict"), fail("CONFORMANCE-06", SIG)]), corpus, ["not a run category"]],
  ["an empty status", results([...without("VALUES-01"), as("VALUES-01", "", "no verdict"), fail("CONFORMANCE-06", SIG)]), corpus, ["not a run category"]],
  ["a missing status", results([...without("VALUES-01"), { id: "VALUES-01", signature: "no verdict" }, fail("CONFORMANCE-06", SIG)]), corpus, ["not a run category"]],
  ["a retired category (ADVISORY)", results([...without("NAMES-01"), as("NAMES-01", "ADVISORY", "key match"), fail("CONFORMANCE-06", SIG)]), corpus, ["not a run category"]],
  ["a retired category (UNVERIFIED)", results([...without("VALUES-01"), as("VALUES-01", "UNVERIFIED", "no applied text"), fail("CONFORMANCE-06", SIG)]), corpus, ["not a run category"]],
  ["an unkeyed SHORTFALL", results([...without("VALUES-01"), as("VALUES-01", "SHORTFALL", "value 0: no verdict"), fail("CONFORMANCE-06", SIG)]), corpus, ["unexpected SHORTFALL"]],
  ["a keyed SHORTFALL", results([...without("VALUES-01"), as("VALUES-01", "SHORTFALL", "value 0: no verdict"), fail("CONFORMANCE-06", SIG)]),
    corpus, [], { pin: PIN, failures: [...expected.failures, { case: "VALUES-01", status: "SHORTFALL", signature: "value 0: no verdict", reason: "control" }] }],
  ["a keyed failure that falls short instead", results([...ordinary, as("CONFORMANCE-06", "SHORTFALL", SIG)]), corpus, ["expected FAIL, got SHORTFALL"]],
  ["a keyed SHORTFALL that fails instead", results([...without("VALUES-01"), fail("VALUES-01", "value 0: got fails"), fail("CONFORMANCE-06", SIG)]),
    corpus, ["expected SHORTFALL, got FAIL"], { pin: PIN, failures: [...expected.failures, { case: "VALUES-01", status: "SHORTFALL", signature: "value 0: no verdict", reason: "control" }] }],
  ["a reconciliation problem", results([...ordinary, fail("CONFORMANCE-06", SIG)], { reconciliation: ["scenarios/5.2-value-contracts.json: the manifest counts 64 cases, the file holds 63"] }), corpus, ["reconciliation: scenarios/5.2-value-contracts.json"]],
  ["results without a reconciliation", { pin: PIN, cases: [...ordinary, fail("CONFORMANCE-06", SIG)] }, corpus, ["carry no reconciliation"]],
];

let bad = 0;
for (const [label, res, cor, want, exp = expected] of controls) {
  const got = compare(res, exp, cor);
  const ok = got.length === want.length && want.every((w) => got.some((g) => g.includes(w)));
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : `: got ${JSON.stringify(got)}`}`);
}
console.log(`\n${controls.length} controls; ${bad} misbehaved`);
process.exit(bad ? 1 : 0);
