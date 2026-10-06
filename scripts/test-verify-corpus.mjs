#!/usr/bin/env node
// Negative and positive controls for scripts/verify-corpus.mjs.
//
// Each control copies the spec text and the core corpus into a temporary
// spec root, applies one mutation, runs the verifier on it, and checks the
// result: a negative control must fail with an error naming the defect; a
// positive control must pass, or fail only in the way it states. A verifier
// that stops catching a defect fails this script.
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
  "conformance/clauses.json",
  "conformance/fixture.schema.json",
  "conformance/tool-scenario.schema.json",
  "conformance/document",
  "conformance/tool",
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

const readJSON = (root, p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const writeJSON = (root, p, v) => writeFileSync(join(root, p), JSON.stringify(v, null, 2) + "\n");
const editJSON = (p, f) => (root) => {
  const v = readJSON(root, p);
  f(v);
  writeJSON(root, p, v);
};
const editText = (p, f) => (root) => writeFileSync(join(root, p), f(readFileSync(join(root, p), "utf8")));
const scenario = (file, id) => file.scenarios.find((s) => s.id === id);

const NEGATIVE = [
  ["a reworded tool rule breaks the clause partition", "not found in order",
    editText("openbindings.md", (t) => t.replace("It MUST NOT privilege key matches over alias matches", "It MUST NOT prefer key matches over alias matches"))],
  ["a sentence added to a tool rule is unaccounted for", "does not account for",
    editText("openbindings.md", (t) => t.replace("treating key and alias matches as equally authoritative.", "treating key and alias matches as equally authoritative. A tool MUST log every resolution."))],
  ["a duplicate clause ID", "duplicate clause ID",
    editJSON("conformance/clauses.json", (c) => { c.rules[0].clauses[1].id = "OBI-T-01/c1"; })],
  ["a clause status the inventory does not define", "is not one clauses.json defines",
    editJSON("conformance/clauses.json", (c) => { c.rules[0].clauses[0].status = "complete"; })],
  ["the README clause table disagrees with the inventory", "README clause table",
    editText("conformance/README.md", (t) => t.replace("| OBI-T-01/c4 | obligation | tested |", "| OBI-T-01/c4 | obligation | composition only |"))],
  ["the README clause table omits a clause", "is missing",
    editText("conformance/README.md", (t) => t.replace(/^\| OBI-T-03\/c2 \|.*\n/m, ""))],
  ["a case cites an undefined clause", "cites undefined clause",
    editJSON("conformance/scenarios/OBI-T-07.json", (f) => { scenario(f, "T07-S-06").clauses.push("OBI-T-07/c9"); })],
  ["a case names no clause of its file's rule", "names no clause of OBI-T-07",
    editJSON("conformance/scenarios/OBI-T-07.json", (f) => { scenario(f, "T07-S-06").clauses = ["OBI-T-08/c1"]; })],
  ["a duplicate case ID", "duplicate case ID",
    editJSON("conformance/scenarios/OBI-T-08.json", (f) => { scenario(f, "T08-S-54").id = "T08-S-53"; })],
  ["an outcome token outside the specification's vocabulary", "does not match tool-scenario.schema.json",
    editJSON("conformance/scenarios/OBI-T-08.json", (f) => { scenario(f, "T08-S-13").expected.results[0] = "graph-unavailable"; })],
  ["an old action in format @2", "does not match tool-scenario.schema.json",
    editJSON("conformance/scenarios/OBI-T-06.json", (f) => { scenario(f, "T06-S-01").action = "resolve-schema-cycle"; })],
  ["gates that contradict each other by support unit", "both are support unit",
    editJSON("conformance/scenarios/OBI-T-04.json", (f) => { scenario(f, "T04-S-02").requiresUnsupported = "0.2.5"; })],
  ["a required-supported version below the required lowest", "below the required lowest supported version",
    editJSON("conformance/scenarios/OBI-T-04.json", (f) => { scenario(f, "T04-S-01").requiresMinSupported = "0.3.0"; })],
  ["a gate that is not SemVer 2.0.0", "requiresSupports",
    editJSON("conformance/scenarios/OBI-T-04.json", (f) => { scenario(f, "T04-S-01").requiresSupports = "0.2.0-01"; })],
  ["one result too few for the values", "results for",
    editJSON("conformance/scenarios/OBI-T-08.json", (f) => { scenario(f, "T08-S-06").expected.results.pop(); })],
  ["evidence missing two rules still expected conformant (the old T09-S-01)", "does not follow from the evidence",
    editJSON("conformance/scenarios/OBI-T-09.json", (f) => {
      const s = scenario(f, "T09-S-01");
      delete s.given.evidence["OBI-D-12"];
      delete s.given.evidence["OBI-D-13"];
    })],
  ["complete evidence incorrectly expected undetermined", "does not follow from the evidence",
    editJSON("conformance/scenarios/OBI-T-09.json", (f) => { scenario(f, "T09-S-01").expected.conclusion = "conformance-undetermined"; })],
  ["a conclusion that ignores a violation", "does not follow from the evidence",
    editJSON("conformance/scenarios/OBI-T-09.json", (f) => { scenario(f, "T09-S-05").expected.conclusion = "conformance-undetermined"; })],
  ["a validity fixture that names a tool rule as violated", "OBI-T-04",
    editJSON("conformance/document/OBI-D-02.json", (f) => { f.tests[1].violates = ["OBI-T-04"]; })],
  ["violates on a positive fixture", "violates is meaningful only when valid is false",
    editJSON("conformance/document/OBI-D-02.json", (f) => { f.tests[0].violates = ["OBI-D-02"]; })],
  ["notViolated on a positive fixture", "notViolated is meaningful only when valid is false",
    editJSON("conformance/document/OBI-D-02.json", (f) => { f.tests[0].notViolated = ["OBI-D-07"]; })],
  ["a rule both in violates and in notViolated", "listed both in violates and in notViolated",
    editJSON("conformance/document/OBI-D-02.json", (f) => { f.tests[4].notViolated = ["OBI-D-07", "OBI-D-02"]; })],
  ["notViolated naming a tool rule", "notViolated names OBI-T-07",
    (root) => {
      editJSON("conformance/document/OBI-D-02.json", (f) => { f.tests[4].notViolated = ["OBI-T-07"]; })(root);
    }],
  ["notViolated naming a rule the spec does not define", "notViolated names OBI-D-14",
    editJSON("conformance/document/OBI-D-02.json", (f) => { f.tests[4].notViolated = ["OBI-D-14"]; })],
  ["an empty notViolated", "does not match fixture.schema.json",
    editJSON("conformance/document/OBI-D-02.json", (f) => { f.tests[4].notViolated = []; })],
  ["a tool fixture test with no clause", "names no clause",
    editJSON("conformance/tool/OBI-T-10.json", (f) => { delete f.tests[0].clauses; })],
  ["clause tags on a document fixture", "clauses are tool-rule tags",
    editJSON("conformance/document/OBI-D-02.json", (f) => { f.tests[0].clauses = ["OBI-T-02/c1"]; })],
  ["a collision group of one", "collision group",
    editJSON("conformance/scenarios/OBI-T-07.json", (f) => { scenario(f, "T07-S-14").expected.group = "T07-G-02"; })],
  ["example expectations that miss an example", "expectations cover",
    editJSON("conformance/scenarios/OBI-T-11.json", (f) => { delete scenario(f, "T11-S-01").expected.examples.good; })],
  ["a named operation the document lacks", "is not in the document",
    editJSON("conformance/scenarios/OBI-T-08.json", (f) => { scenario(f, "T08-S-01").given.operation = "missing"; })],
  ["a relative resource URI", "is not absolute",
    editJSON("conformance/scenarios/OBI-T-08.json", (f) => { scenario(f, "T08-S-37").given.resources[0].uri = "s.json"; })],
  ["a retrieval sentinel listed but absent from the document", "retrieval sentinel",
    editJSON("conformance/scenarios/OBI-T-01.json", (f) => { scenario(f, "T01-S-12").given.retrievalSentinels = ["http"]; })],
  ["a status that claims cases where none cites the clause", "no case cites it",
    (root) => {
      for (const id of ["T01-S-10", "T01-S-15"]) {
        editJSON("conformance/scenarios/OBI-T-01.json", (f) => { scenario(f, id).clauses = ["OBI-T-01/c1"]; })(root);
      }
    }],
  ["a parent tested through an alternative that is not tested", "is not tested",
    (root) => {
      editJSON("conformance/clauses.json", (c) => { c.rules.find((r) => r.rule === "OBI-T-06").clauses.find((x) => x.id === "OBI-T-06/c1b").status = "contrast tools only"; })(root);
      editText("conformance/README.md", (t) => t.replace("| OBI-T-06/c1b | alternative | tested |", "| OBI-T-06/c1b | alternative | contrast tools only |"))(root);
    }],
  ["an unknown scenario format", "unsupported format",
    editJSON("conformance/scenarios/OBI-T-05.json", (f) => { f.format = "openbindings.core-tool-scenarios@3"; })],
  ["a definition given a unit status", "a definition has status definition",
    (root) => {
      editJSON("conformance/clauses.json", (c) => { c.rules.find((r) => r.rule === "OBI-T-04").clauses.find((x) => x.id === "OBI-T-04/c5").status = "tested"; })(root);
      editText("conformance/README.md", (t) => t.replace("| OBI-T-04/c5 | definition | definition |", "| OBI-T-04/c5 | definition | tested |"))(root);
    }],
];

const POSITIVE = [["the unmodified corpus passes", null, () => {}]];

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
    report(status === 1 && out.includes(needle), `negative: ${label}`, status === 1 ? (out.includes(needle) ? "" : `failed without "${needle}"`) : `exit ${status}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
for (const [label, allowed, mutate] of POSITIVE) {
  const root = freshRoot();
  try {
    mutate(root);
    const { status, out } = run(root);
    if (allowed === null) {
      report(status === 0, `positive: ${label}`, status === 0 ? "" : `exit ${status}\n${out}`);
    } else {
      const errorLines = out.split("\n").filter((l) => l.startsWith("  - "));
      const unexpected = errorLines.filter((l) => !allowed.test(l));
      report(status === 1 && errorLines.length > 0 && unexpected.length === 0, `positive: ${label}`,
        unexpected.length ? `unexpected errors:\n${unexpected.join("\n")}` : `${errorLines.length} expected coverage errors only`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
console.log(`\n${NEGATIVE.length} negative and ${POSITIVE.length} positive controls; ${failures} misbehaved`);
process.exit(failures ? 1 : 0);
