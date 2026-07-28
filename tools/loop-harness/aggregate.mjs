// Builds the aggregate histogram from a run's telemetry.jsonl.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1]]); return a;
}, []));
const RUN = args.run ?? (() => { throw new Error("--run <dir> required"); })();

const runMeta = JSON.parse(readFileSync(join(RUN, "run.json"), "utf8"));
const records = readFileSync(join(RUN, "telemetry.jsonl"), "utf8")
  .split("\n").filter(Boolean).map((l) => JSON.parse(l));

const artifacts = {}, targets = { total: 0, represented: 0, excluded: 0, implementationUnsupported: 0 };
const excl = {}, altExcl = {}, loadf = {}, reqs = {}, caps = {};
const bump = (m, k, extra) => (m[k] ??= { count: 0, artifacts: 0, _seen: new Set(), ...extra });
const hit = (m, k, art, extra) => { const e = bump(m, k, extra); e.count += 1; if (!e._seen.has(art)) { e._seen.add(art); e.artifacts += 1; } };

for (const r of records) {
  artifacts[r.outcome] = (artifacts[r.outcome] ?? 0) + 1;
  if (r.outcome === "synthesized") {
    targets.total += r.targets ?? 0; targets.represented += r.represented ?? 0;
    for (const e of r.exclusions ?? []) {
      if (e.status === "implementation-unsupported") targets.implementationUnsupported += 1; else targets.excluded += 1;
      hit(excl, e.reasonCode ?? e.status ?? "unknown", r.artifact, { rule: e.rule });
    }
    for (const a of r.alternativeExclusions ?? []) hit(altExcl, a.reasonCode ?? "unknown", r.artifact, { rule: a.rule });
    for (const q of r.requirements ?? []) hit(reqs, q, r.artifact);
  } else if (r.outcome === "load_failed") hit(loadf, r.reasonCode ?? "unknown", r.artifact);
  else if (r.outcome === "resource_capped") hit(caps, r.reasonCode ?? "unknown", r.artifact);
}
const strip = (m) => Object.fromEntries(Object.entries(m)
  .sort(([, a], [, b]) => b.count - a.count)
  .map(([k, { _seen, ...v }]) => [k, v]));
const agg = { run: runMeta, artifacts, targets, exclusions: strip(excl),
  alternativeExclusions: strip(altExcl), loadFailures: strip(loadf), resourceCaps: strip(caps), requirements: strip(reqs) };
writeFileSync(join(RUN, "aggregate.json"), JSON.stringify(agg, undefined, 2));
console.log(JSON.stringify({ artifacts, targets }, undefined, 1));
