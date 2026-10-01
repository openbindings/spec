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
const FIXTURE = "document/OBI-D-01.json#/tests/0";
const pass = (id) => ({ id, status: "pass", signature: "" });
const fail = (id, signature) => ({ id, status: "FAIL", signature });
const as = (id, status, signature) => ({ id, status, signature });
const SIG = "got conformant; expected conformance-undetermined";
const expected = { pin: PIN, failures: [{ case: "T09-S-11", signature: SIG, reason: "control" }] };
const corpus = { ids: [FIXTURE, "T08-S-01", "T09-S-11", "T07-S-12"], collisions: ["T07-S-12"], problems: [] };
const results = (cases, extra = {}) => ({ pin: PIN, reconciliation: [], cases, ...extra });
const ordinary = [pass(FIXTURE), pass("T08-S-01"), as("T07-S-12", "ADVISORY", "no single resolution")];
const without = (id) => ordinary.filter((c) => c.id !== id);
const omitted = { pin: PIN, failures: expected.failures, omissions: [{ case: "T08-S-01", signature: "gate: requires 9.9.9", reason: "control" }] };

// A corpus whose manifest miscounts a file.
const dir = mkdtempSync(join(tmpdir(), "check-runner-results-"));
mkdirSync(join(dir, "document"));
mkdirSync(join(dir, "scenarios"));
writeFileSync(join(dir, "document", "OBI-D-01.json"), JSON.stringify({ tests: [{}, {}] }));
writeFileSync(join(dir, "scenarios", "OBI-T-09.json"), JSON.stringify({ scenarios: [{ id: "T09-S-11" }] }));
writeFileSync(join(dir, "manifest.json"), JSON.stringify({
  files: [{ path: "document/OBI-D-01.json", tests: 1 }],
  scenarioFiles: [{ path: "scenarios/OBI-T-09.json", scenarios: 1 }],
}));
const miscounted = corpusCases(dir);
rmSync(dir, { recursive: true, force: true });

const controls = [
  ["the expected failure and passes elsewhere match", results([...ordinary, fail("T09-S-11", SIG)]), corpus, []],
  ["an unexpected failure", results([...ordinary.filter((c) => c.id !== "T08-S-01"), fail("T08-S-01", "x"), fail("T09-S-11", SIG)]), corpus, ["unexpected failure"]],
  ["an expected failure that passes", results([...ordinary, pass("T09-S-11")]), corpus, ["expected FAIL, but passed"]],
  ["an expected failure not run", results(ordinary), corpus, ["expected FAIL, but not run", "T09-S-11: in the corpus, but not reported"]],
  ["a changed signature", results([...ordinary, fail("T09-S-11", "got non-conformant; expected conformance-undetermined")]), corpus, ["signature changed"]],
  ["results for another pin", results([...ordinary, fail("T09-S-11", SIG)], { pin: OTHER }), corpus, ["keyed to"]],
  ["a short pin", results([...ordinary, fail("T09-S-11", SIG)], { pin: "0123456" }), corpus, ["no full commit SHA", "keyed to"]],
  ["a case reported twice", results([...ordinary, pass("T08-S-01"), fail("T09-S-11", SIG)]), corpus, ["reported twice"]],
  ["a missing ordinary case", results([pass(FIXTURE), as("T07-S-12", "ADVISORY", "no single resolution"), fail("T09-S-11", SIG)]), corpus, ["T08-S-01: in the corpus, but not reported"]],
  ["a case the corpus does not hold", results([...ordinary, pass("T08-S-99"), fail("T09-S-11", SIG)]), corpus, ["T08-S-99: reported, but not in the corpus"]],
  ["a wrong manifest count", results([pass("document/OBI-D-01.json#/tests/0"), pass("document/OBI-D-01.json#/tests/1"), fail("T09-S-11", SIG)]), miscounted, ["the manifest counts 1 cases, the file holds 2"]],
  ["an unexplained omission", results([...without("T08-S-01"), as("T08-S-01", "OMITTED", ""), fail("T09-S-11", SIG)]), corpus, ["OMITTED with no reason", "unexpected OMITTED"]],
  ["an explained but unkeyed omission", results([...without("T08-S-01"), as("T08-S-01", "OMITTED", "the model cannot carry this non-conformant document"), fail("T09-S-11", SIG)]), corpus, ["unexpected OMITTED"]],
  ["a keyed omission", results([...without("T08-S-01"), as("T08-S-01", "OMITTED", "gate: requires 9.9.9"), fail("T09-S-11", SIG)]), corpus, [], omitted],
  ["a keyed omission with another reason", results([...without("T08-S-01"), as("T08-S-01", "OMITTED", "the model cannot carry it"), fail("T09-S-11", SIG)]), corpus, ["signature changed"], omitted],
  ["a keyed omission that is executed", results([...ordinary, fail("T09-S-11", SIG)]), corpus, ["expected OMITTED, but passed"], omitted],
  ["an unknown status", results([...without("T08-S-01"), as("T08-S-01", "ERROR", "no verdict"), fail("T09-S-11", SIG)]), corpus, ["not a run category"]],
  ["a misspelled status", results([...without("T08-S-01"), as("T08-S-01", "shortfall", "no verdict"), fail("T09-S-11", SIG)]), corpus, ["not a run category"]],
  ["an empty status", results([...without("T08-S-01"), as("T08-S-01", "", "no verdict"), fail("T09-S-11", SIG)]), corpus, ["not a run category"]],
  ["a missing status", results([...without("T08-S-01"), { id: "T08-S-01", signature: "no verdict" }, fail("T09-S-11", SIG)]), corpus, ["not a run category"]],
  ["ADVISORY on a case that is not a collision case", results([...without("T08-S-01"), as("T08-S-01", "ADVISORY", "key match"), fail("T09-S-11", SIG)]), corpus, ["not a collision case"]],
  ["an unkeyed SHORTFALL", results([...without("T08-S-01"), as("T08-S-01", "SHORTFALL", "value 0: no verdict"), fail("T09-S-11", SIG)]), corpus, ["unexpected SHORTFALL"]],
  ["a keyed SHORTFALL", results([...without("T08-S-01"), as("T08-S-01", "SHORTFALL", "value 0: no verdict"), fail("T09-S-11", SIG)]),
    corpus, [], { pin: PIN, failures: [...expected.failures, { case: "T08-S-01", status: "SHORTFALL", signature: "value 0: no verdict", reason: "control" }] }],
  ["a keyed failure that falls short instead", results([...ordinary, as("T09-S-11", "SHORTFALL", SIG)]), corpus, ["expected FAIL, got SHORTFALL"]],
  ["an unkeyed UNVERIFIED", results([...without("T08-S-01"), as("T08-S-01", "UNVERIFIED", "no applied text"), fail("T09-S-11", SIG)]), corpus, ["unexpected UNVERIFIED"]],
  ["a reconciliation problem", results([...ordinary, fail("T09-S-11", SIG)], { reconciliation: ["scenarios/OBI-T-08.json: the manifest counts 64 cases, the file holds 63"] }), corpus, ["reconciliation: scenarios/OBI-T-08.json"]],
  ["results without a reconciliation", { pin: PIN, cases: [...ordinary, fail("T09-S-11", SIG)] }, corpus, ["carry no reconciliation"]],
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
