// Pool runner: per-artifact subprocess with hard time and heap caps. Every
// cap is a counted disposition (resource_capped) — never a silent skip.
// Resume-aware: artifacts already present in the run's telemetry are skipped.
import { readFileSync, writeFileSync, appendFileSync, statSync, existsSync, mkdirSync, globSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1]]);
  return a;
}, []));
const CORPUS = args.corpus ?? (() => { throw new Error("--corpus <dir> required"); })();
const RUN = args.out ?? (() => { throw new Error("--out <run dir> required"); })();
const STRIDE = Number(args.stride ?? 1);
const POOL = Number(args.pool ?? 2);
const TIMEOUT_MS = Number(args.timeout ?? 45_000);
const HEAP_MB = Number(args.heap ?? 1400);
const SIZE_DEFER = Number(args["size-defer"] ?? 3 * 1024 * 1024);
const WORKER = join(dirname(fileURLToPath(import.meta.url)), "worker.mjs");

mkdirSync(RUN, { recursive: true });
const OUT = join(RUN, "telemetry.jsonl");
const all = globSync("**/*.json", { cwd: CORPUS }).sort();
const sampled = all.filter((_, i) => i % STRIDE === 0);
const done = new Set();
if (existsSync(OUT)) for (const line of readFileSync(OUT, "utf8").split("\n")) {
  if (line) try { done.add(JSON.parse(line).artifact); } catch {}
}
const todo = sampled.filter((rel) => !done.has(rel));
writeFileSync(join(RUN, "run.json"), JSON.stringify({
  corpus: resolve(CORPUS), population: all.length, stride: STRIDE, sampled: sampled.length,
  timeoutMs: TIMEOUT_MS, heapMb: HEAP_MB, sizeDeferBytes: SIZE_DEFER, startedAt: new Date().toISOString(),
}, undefined, 2));
console.error(`population=${all.length} sampled=${sampled.length} done=${done.size} todo=${todo.length}`);

let idx = 0, finished = 0;
async function runOne(rel) {
  const path = join(CORPUS, rel);
  if (statSync(path).size > SIZE_DEFER) {
    appendFileSync(OUT, JSON.stringify({ artifact: rel, outcome: "oversize_deferred" }) + "\n");
    return;
  }
  await new Promise((resolveDone) => {
    execFile(process.execPath, [`--max-old-space-size=${HEAP_MB}`, WORKER, path, rel],
      { timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024, killSignal: "SIGKILL", env: process.env },
      (err, stdout) => {
        const line = stdout?.trim().split("\n").pop();
        appendFileSync(OUT, (line ?? JSON.stringify({
          artifact: rel, outcome: "resource_capped",
          reasonCode: err?.killed ? "harness.time_capped" : "harness.heap_capped",
          message: String(err?.message ?? "").slice(0, 120),
        })) + "\n");
        resolveDone();
      });
  });
}
async function pump() {
  while (idx < todo.length) {
    await runOne(todo[idx++]);
    if (++finished % 50 === 0) console.error(`progress ${finished}/${todo.length}`);
  }
}
await Promise.all(Array.from({ length: POOL }, pump));
console.error("runner done");
