#!/usr/bin/env node
// Controls for scripts/check-runner-results.mjs: each synthetic result set
// must produce exactly the stated mismatches. Exits 0 when all do.
//
// Usage: node scripts/test-check-runner-results.mjs

import { compare } from "./check-runner-results.mjs";

const PIN = "0123456789abcdef0123456789abcdef01234567";
const OTHER = "fedcba9876543210fedcba9876543210fedcba98";
const pass = (id) => ({ id, status: "pass", signature: "" });
const fail = (id, signature) => ({ id, status: "FAIL", signature });
const expected = { pin: PIN, failures: [{ case: "T09-S-11", signature: "got conformant; expected conformance-undetermined", reason: "control" }] };

const controls = [
  ["the expected failure and passes elsewhere match", { pin: PIN, cases: [pass("T08-S-01"), fail("T09-S-11", "got conformant; expected conformance-undetermined")] }, []],
  ["an unexpected failure", { pin: PIN, cases: [fail("T08-S-01", "x"), fail("T09-S-11", "got conformant; expected conformance-undetermined")] }, ["unexpected failure"]],
  ["an expected failure that passes", { pin: PIN, cases: [pass("T08-S-01"), pass("T09-S-11")] }, ["expected to fail, but passed"]],
  ["an expected failure not run", { pin: PIN, cases: [pass("T08-S-01")] }, ["expected to fail, but not run"]],
  ["a changed signature", { pin: PIN, cases: [fail("T09-S-11", "got non-conformant; expected conformance-undetermined")] }, ["signature changed"]],
  ["results for another pin", { pin: OTHER, cases: [fail("T09-S-11", "got conformant; expected conformance-undetermined")] }, ["keyed to"]],
  ["a short pin", { pin: "0123456", cases: [fail("T09-S-11", "got conformant; expected conformance-undetermined")] }, ["no full commit SHA", "keyed to"]],
  ["a case reported twice", { pin: PIN, cases: [pass("T08-S-01"), pass("T08-S-01"), fail("T09-S-11", "got conformant; expected conformance-undetermined")] }, ["reported twice"]],
];

let bad = 0;
for (const [label, results, want] of controls) {
  const got = compare(results, expected);
  const ok = got.length === want.length && want.every((w) => got.some((g) => g.includes(w)));
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : `: got ${JSON.stringify(got)}`}`);
}
console.log(`\n${controls.length} controls; ${bad} misbehaved`);
process.exit(bad ? 1 : 0);
