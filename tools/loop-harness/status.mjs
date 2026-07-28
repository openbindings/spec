// Distance to measured-complete: diffs observed reason codes against the
// adjudicated-codes registry and prints the MC checklist. Computed, not asserted.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1]]); return a;
}, []));
const RUN = args.run ?? (() => { throw new Error("--run <dir> required"); })();
const REG = args.registry ?? join(RUN, "..", "..", "adjudicated-codes.json");

const agg = JSON.parse(readFileSync(join(RUN, "aggregate.json"), "utf8"));
const registry = JSON.parse(readFileSync(REG, "utf8"));
const DELTA = Number(args.delta ?? 0.005);

const observed = new Set([
  ...Object.keys(agg.exclusions ?? {}),
  ...Object.keys(agg.alternativeExclusions ?? {}),
  ...Object.keys(agg.loadFailures ?? {}),
]);
const unadjudicated = [...observed].filter((c) => !registry[c]);
const implLoss = (agg.targets?.implementationUnsupported ?? 0)
  + Object.values(agg.resourceCaps ?? {}).reduce((s, v) => s + (v.artifacts ?? 0), 0)
  + Object.entries(agg.loadFailures ?? {})
      .filter(([c]) => registry[c]?.category !== "upstream-defective")
      .reduce((s, [, v]) => s + (v.artifacts ?? 0), 0);
const population = agg.run?.sampled ?? 1;
const topOpen = unadjudicated
  .map((c) => ({ code: c, artifacts: (agg.exclusions[c] ?? agg.loadFailures[c] ?? agg.alternativeExclusions[c])?.artifacts ?? 0 }))
  .sort((a, b) => b.artifacts - a.artifacts)[0];

const mc = {
  MC1_zero_unadjudicated: { pass: unadjudicated.length === 0, open: unadjudicated },
  MC2_implementation_losses_zero: { pass: implLoss === 0, lostArtifacts: implLoss },
  MC3_marginal_yield_below_floor: {
    pass: !topOpen || topOpen.artifacts / population < DELTA,
    top: topOpen ?? null, floor: DELTA,
    note: "requires K=2 consecutive passing revolutions — track across runs",
  },
  MC4_faithfulness_verified: { pass: null, note: "external evidence: portable scenarios + invocation conformance per widening" },
  MC5_stable_two_vintages: { pass: null, note: "compare reason-code sets across two corpus refreshes" },
};
console.log(JSON.stringify(mc, undefined, 2));
const done = Object.values(mc).every((v) => v.pass === true);
console.error(done ? "MEASURED-COMPLETE (computable criteria)" : "NOT measured-complete");
