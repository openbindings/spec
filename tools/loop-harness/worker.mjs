// Evaluates ONE artifact; prints a telemetry record to stdout. Run under the
// runner's time/heap caps so a pathological artifact is a bounded loss.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

function loadOpenAPI() {
  try { return require("@openbindings/openapi"); } catch {}
  const dist = process.env.OB_OPENAPI_DIST;
  if (!dist) throw new Error("install @openbindings/openapi or set OB_OPENAPI_DIST");
  return require(dist);
}

const ADAPTERS = [
  {
    family: "openbindings.openapi@1",
    match: (content) => typeof content?.openapi === "string",
    synthesize: (content) => loadOpenAPI().OpenAPISynthesizer
      ? new (loadOpenAPI().OpenAPISynthesizer)().synthesizeInterfaceWithCoverage({
          sources: [{ bindingSpec: "openbindings.openapi@1", content }],
        })
      : Promise.reject(new Error("OpenAPISynthesizer not exported")),
  },
  // Add families here: { family, match, synthesize } — one entry each.
];

const [path, rel] = process.argv.slice(2);
const record = { artifact: rel ?? path, family: null, outcome: null };
const out = () => console.log(JSON.stringify(record));

let content;
try { content = JSON.parse(readFileSync(path, "utf8")); }
catch (e) { record.outcome = "parse_failed"; record.message = String(e?.message ?? e).slice(0, 160); out(); process.exit(0); }

const adapter = ADAPTERS.find((a) => a.match(content));
if (!adapter) { record.outcome = "no_adapter"; out(); process.exit(0); }
record.family = adapter.family;

try {
  const result = await adapter.synthesize(content);
  const targets = result.coverage.entries.filter((e) => e.scope === "target");
  record.outcome = "synthesized";
  record.fullyRepresented = result.coverage.fullyRepresented;
  record.targets = targets.length;
  record.represented = targets.filter((t) => t.status === "represented").length;
  record.requirements = targets.flatMap((t) => t.requirements ?? []);
  record.exclusions = targets
    .filter((t) => t.status !== "represented")
    .map((t) => ({ ref: t.sourceRef, status: t.status, reasonCode: t.reasonCode, rule: t.rule }));
  record.alternativeExclusions = result.coverage.entries
    .filter((e) => e.scope === "alternative" && e.status === "excluded")
    .map((a) => ({ reasonCode: a.reasonCode, rule: a.rule }));
} catch (e) {
  const message = String(e?.message ?? e);
  const m = message.toLowerCase();
  record.outcome = "load_failed";
  record.reasonCode =
    m.includes("unsupported openapi version") || /only supports.*3\./.test(m) ? "openapi.version_unsupported"
    : m.includes("circular") ? "openapi.cyclic_ref_load_failed"
    : m.includes("$ref") || m.includes("resolve") ? "openapi.ref_resolution_failed"
    : m.includes("yaml") || m.includes("parse") || m.includes("json") ? "artifact.parse_failed"
    : "artifact.load_failed_other";
  record.message = message.slice(0, 200);
}
out();
