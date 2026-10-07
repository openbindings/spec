#!/usr/bin/env node
// Negative and positive controls for scripts/verify-corpus.mjs.
//
// Each control copies the spec text and the core corpus into a temporary
// spec root, applies one mutation, runs the verifier on it, and checks the
// result: a negative control must fail with an error naming the defect; a
// positive control must pass. A verifier that stops catching a defect fails
// this script.
//
// Exits 0 when every control behaves as stated, 1 otherwise.
//
// Usage: node scripts/test-verify-corpus.mjs

import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_ROOT = resolve(__dirname, "..");
const VERIFIER = join(__dirname, "verify-corpus.mjs");
const COPIED = [
  "openbindings.md",
  "conformance/README.md",
  "conformance/fixture.schema.json",
  "conformance/scenario.schema.json",
  "conformance/document",
  "conformance/scenarios",
];

function freshRoot() {
  const root = mkdtempSync(join(tmpdir(), "verify-corpus-control-"));
  for (const p of COPIED) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    cpSync(join(SPEC_ROOT, p), join(root, p), { recursive: true });
  }
  return root;
}

// Numbers are kept at their source text, so a control changes only what it names.
const readJSON = (root, p) => JSON.parse(readFileSync(join(root, p), "utf8"), (k, v, ctx) => (typeof v === "number" ? JSON.rawJSON(ctx.source) : v));
const writeJSON = (root, p, v) => writeFileSync(join(root, p), JSON.stringify(v, null, 2) + "\n");
const editJSON = (p, f) => (root) => {
  const v = readJSON(root, p);
  f(v);
  writeJSON(root, p, v);
};
const editText = (p, f) => (root) => writeFileSync(join(root, p), f(readFileSync(join(root, p), "utf8")));
const scenario = (file, id) => file.scenarios.find((s) => s.id === id);
const NAMES = "conformance/scenarios/5.1-names.json";
const EXAMPLES = "conformance/scenarios/5.1-examples.json";
const VALUES = "conformance/scenarios/5.2-value-contracts.json";
const KINDS = "conformance/scenarios/6-kinds.json";
const CONFORMANCE = "conformance/scenarios/10-conformance.json";
const OBI02 = "conformance/document/OBI-02.json";

const NEGATIVE = [
  // Spec text and citations
  ["a rule removed from section 10", "OBI-13",
    editText("openbindings.md", (t) => t.replace(/^- \*\*OBI-13\*\*.*\n/m, ""))],
  ["a heading renumbered away from a cited section", "is not a heading of openbindings.md",
    editText("openbindings.md", (t) => t.replace("## 12. Extensions", "## 12a. Extensions"))],
  ["a rule file citing a section other than 10", "a rule file cites section \"10\"",
    editJSON("conformance/document/OBI-05.json", (f) => { f.section = "10.2"; })],
  ["a rule file named after another rule", "is named OBI-06.json",
    editJSON("conformance/document/OBI-05.json", (f) => { f.rule = "OBI-06"; })],
  ["a section file citing a section that is not a heading", "is not a heading of openbindings.md",
    editJSON("conformance/document/section-12.json", (f) => { f.section = "12.9"; })],
  ["a section file named after another section", "is named section-5.5.json",
    editJSON("conformance/document/section-5.json", (f) => { f.section = "5.5"; })],
  ["a scenario file named after another section", "is named 5.5-<topic>.json",
    editJSON(KINDS, (f) => { f.section = "5.5"; })],
  ["a description mentioning an older identifier", "mentions OBI-T-07",
    editJSON(VALUES, (f) => { scenario(f, "VALUES-37").description += " (OBI-T-07)"; })],
  ["a note mentioning a rule section 10 does not define", "mentions OBI-14",
    editJSON(OBI02, (f) => { f.notes += " See OBI-14."; })],
  // Fixtures
  ["a removed fixture field (clauses)", "does not match fixture.schema.json",
    editJSON(OBI02, (f) => { f.tests[0].clauses = ["OBI-T-02/c1"]; })],
  ["a removed fixture field (requiresSupports)", "does not match fixture.schema.json",
    editJSON(OBI02, (f) => { f.tests[0].requiresSupports = "0.2.0"; })],
  ["a validity fixture that names an older identifier as violated", "does not match fixture.schema.json",
    editJSON(OBI02, (f) => { f.tests[1].violates = ["OBI-D-02"]; })],
  ["violates naming a rule the spec does not define", "violates names OBI-14",
    editJSON(OBI02, (f) => { f.tests[1].violates = ["OBI-14"]; })],
  ["violates on a positive fixture", "violates is meaningful only when valid is false",
    editJSON(OBI02, (f) => { f.tests[0].violates = ["OBI-02"]; })],
  ["notViolated on a positive fixture", "notViolated is meaningful only when valid is false",
    editJSON(OBI02, (f) => { f.tests[0].notViolated = ["OBI-06"]; })],
  ["a rule both in violates and in notViolated", "listed both in violates and in notViolated",
    editJSON(OBI02, (f) => { f.tests[4].notViolated = ["OBI-02", "OBI-06"]; })],
  ["notViolated naming a rule the spec does not define", "notViolated names OBI-14",
    editJSON(OBI02, (f) => { f.tests[4].notViolated = ["OBI-14"]; })],
  ["an empty notViolated", "does not match fixture.schema.json",
    editJSON(OBI02, (f) => { f.tests[4].notViolated = []; })],
  ["two input carriages", "exactly one of document, documentText, or documentBase64",
    editJSON(OBI02, (f) => { f.tests[0].documentText = "{}"; })],
  // Scenarios: format and vocabulary
  ["an unknown scenario format", "unsupported format",
    editJSON(KINDS, (f) => { f.format = "openbindings.core-tool-scenarios@2"; })],
  ["a value result outside the vocabulary (the old valid)", "does not match scenario.schema.json",
    editJSON(VALUES, (f) => { scenario(f, "VALUES-37").expected.results[0] = "valid"; })],
  ["the old no-verdict token", "does not match scenario.schema.json",
    editJSON(VALUES, (f) => { scenario(f, "VALUES-19").expected.results[0] = "no-verdict"; })],
  ["the old verdict member in an orNoVerdict result", "does not match scenario.schema.json",
    editJSON(VALUES, (f) => { scenario(f, "VALUES-20").expected.results[0] = { verdict: "satisfies", orNoVerdict: true }; })],
  ["a retired action (conclude-conformance)", "does not match scenario.schema.json",
    editJSON(CONFORMANCE, (f) => { scenario(f, "CONFORMANCE-03").action = "conclude-conformance"; })],
  ["a retired outcome (conformance-undetermined)", "does not match scenario.schema.json",
    editJSON(CONFORMANCE, (f) => { scenario(f, "CONFORMANCE-03").expected.outcome = "conformance-undetermined"; })],
  ["a retired field (namesAppliedText)", "does not match scenario.schema.json",
    editJSON(CONFORMANCE, (f) => { scenario(f, "CONFORMANCE-03").expected.namesAppliedText = true; })],
  ["a retired field (forbidReasons)", "does not match scenario.schema.json",
    editJSON(VALUES, (f) => { scenario(f, "VALUES-04").expected.forbidReasons = ["undefined-result"]; })],
  ["a retired field (nonConformant)", "does not match scenario.schema.json",
    editJSON(NAMES, (f) => { scenario(f, "NAMES-02").given.nonConformant = ["OBI-02"]; })],
  ["a retired field (clauses)", "does not match scenario.schema.json",
    editJSON(KINDS, (f) => { scenario(f, "KINDS-01").clauses = ["OBI-T-01/c1"]; })],
  ["a feature outside the enum", "does not match scenario.schema.json",
    editJSON(VALUES, (f) => { scenario(f, "VALUES-04").expected.dependsOn = ["recursion"]; })],
  ["violates naming a rule the spec does not define", "violates names OBI-14",
    editJSON(CONFORMANCE, (f) => { scenario(f, "CONFORMANCE-05").expected.violates = ["OBI-14"]; })],
  // Scenarios: identity
  ["a duplicate case ID", "duplicate case ID",
    editJSON(VALUES, (f) => { scenario(f, "VALUES-41").id = "VALUES-40"; })],
  ["two prefixes in one file", "several prefixes",
    editJSON(KINDS, (f) => { scenario(f, "KINDS-02").id = "KIND-02"; })],
  ["a prefix another file uses", "is also used by",
    editJSON(EXAMPLES, (f) => { f.scenarios.forEach((s, i) => { s.id = `NAMES-${String(90 + i)}`; }); })],
  // Scenarios: what the document says
  ["one result too few for the values", "results for",
    editJSON(VALUES, (f) => { scenario(f, "VALUES-37").expected.results.pop(); })],
  ["no-contract where a contract is stated", "but the operation states input contract",
    editJSON(VALUES, (f) => { scenario(f, "VALUES-37").expected.results[0] = "no-contract"; })],
  ["a result where no contract is stated", "but the operation states no input contract",
    editJSON(VALUES, (f) => { scenario(f, "VALUES-15").expected.results[0] = "satisfies"; })],
  ["a claim where no contract is stated", "but the operation states no input contract",
    editJSON(EXAMPLES, (f) => { scenario(f, "EXAMPLES-01").expected.examples.anyInput.input = "true"; })],
  ["example expectations that miss an example", "expectations cover",
    editJSON(EXAMPLES, (f) => { delete scenario(f, "EXAMPLES-04").expected.examples.good; })],
  ["a named operation the document lacks", "is not in the document",
    editJSON(VALUES, (f) => { scenario(f, "VALUES-37").given.operation = "missing"; })],
  ["a relative resource URI", "is not absolute",
    editJSON(VALUES, (f) => { scenario(f, "VALUES-43").given.resources[0].uri = "s.json"; })],
  ["an operation the string does not identify", "expected operation",
    editJSON(NAMES, (f) => { scenario(f, "NAMES-01").expected.operationKey = "op.alias"; })],
  ["bindings that are not the operation's", "expected bindings",
    editJSON(NAMES, (f) => { scenario(f, "NAMES-01").expected.bindingKeys = ["b1"]; })],
  ["not-found for a string that identifies an operation", "but the document says resolved",
    editJSON(NAMES, (f) => { scenario(f, "NAMES-03").expected = { outcome: "not-found" }; })],
  ["a kinds outcome the document contradicts", "but the document says does-not-meet",
    editJSON(KINDS, (f) => { scenario(f, "KINDS-02").expected.outcome = "meets"; })],
  ["a named dependency the document lacks", "the named dependency or binding is not in the document",
    editJSON(KINDS, (f) => { scenario(f, "KINDS-01").given.dependency = "missing"; })],
  // README coverage table
  ["a coverage row listing a file that does not cite it", "README coverage table: 5.1 lists",
    editText("conformance/README.md", (t) => t.replace("| 5.1 | `scenarios/5.1-names.json`, `scenarios/5.1-examples.json` |", "| 5.1 | `scenarios/5.1-names.json` |"))],
  ["a rule with no coverage row", "no row for OBI-05",
    editText("conformance/README.md", (t) => t.replace(/^\| OBI-05 \|.*\n/m, ""))],
  ["a rule row without files that is not deferred", "is not marked **Deferred**",
    editText("conformance/README.md", (t) => t.replace("| OBI-05 | `document/OBI-05.json` |", "| OBI-05 | none |"))],
  ["a cited section with no coverage row", "no row for 12",
    editText("conformance/README.md", (t) => t.replace(/^\| 12 \|.*\n/m, ""))],
];

const POSITIVE = [["the unmodified corpus passes", () => {}]];

function run(root) {
  const r = spawnSync(process.execPath, [VERIFIER, "--spec-root", root], { encoding: "utf8" });
  return { status: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

let failures = 0;
const report = (ok, label, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`);
};

for (const [label, needle, mutate] of NEGATIVE) {
  const root = freshRoot();
  try {
    mutate(root);
    const { status, out } = run(root);
    report(status === 1 && out.includes(needle), `negative: ${label}`, status === 1 ? (out.includes(needle) ? "" : `failed without "${needle}"\n${out}`) : `exit ${status}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
for (const [label, mutate] of POSITIVE) {
  const root = freshRoot();
  try {
    mutate(root);
    const { status, out } = run(root);
    report(status === 0, `positive: ${label}`, status === 0 ? "" : `exit ${status}\n${out}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
console.log(`\n${NEGATIVE.length} negative and ${POSITIVE.length} positive controls; ${failures} misbehaved`);
process.exit(failures ? 1 : 0);
