#!/usr/bin/env node
// Reference runner for the openbindings.operation-graph execution conformance
// fixtures. It executes each fixture's graph against its mocked operations and
// input, then diffs the produced output stream against `expected`.
//
// Operations are mocked (the fixtures supply canned emit/fail responses), so
// this runner needs only a graph engine, a JSONata evaluator, and a JSON Schema
// validator. It does NOT depend on any binding-invocation stack.
//
// The engine is a deterministic, single-threaded drain-to-fixpoint interpreter:
// it processes events from a FIFO queue to quiescence, then performs an
// end-of-stream pass (flush no-condition buffers, complete combines) and
// repeats until nothing new is produced. Determinism makes `ordering: exact`
// fixtures reproducible; `ordering: set` fixtures are compared as a multiset,
// matching the spec's "Determinism and portability" section.
//
// Usage: node run.mjs   (exit 0 = all fixtures pass, 1 = a mismatch, 2 = error)

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import jsonata from "jsonata";
import ajv2020 from "ajv/dist/2020.js";

const Ajv2020 = ajv2020.Ajv2020 ?? ajv2020.default ?? ajv2020;
const ajv = new Ajv2020({ strict: false, allErrors: false });

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXEC_DIR = resolve(__dirname, "..", "..", "execution");

// --- helpers ---------------------------------------------------------------

function canonical(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  return (
    "{" +
    Object.keys(v)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonical(v[k]))
      .join(",") +
    "}"
  );
}
const deepEqual = (a, b) => canonical(a) === canonical(b);

function multisetEqual(a, b) {
  if (a.length !== b.length) return false;
  const sa = a.map(canonical).sort();
  const sb = b.map(canonical).sort();
  return sa.every((x, i) => x === sb[i]);
}

function mergeMax(a, b) {
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = Math.max(out[k] ?? 0, b[k]);
  return out;
}

async function evalJsonata(expr, data, graphInput) {
  return jsonata(expr).evaluate(data, { input: graphInput });
}

function schemaPass(schema, value) {
  return ajv.compile(schema)(value);
}

// JSONata-style truthiness for filter expressions.
function truthy(r) {
  if (r === false || r === undefined || r === null) return false;
  if (r === 0 || r === "") return false;
  if (Array.isArray(r) && r.length === 0) return false;
  return true;
}

// --- engine ----------------------------------------------------------------

async function runGraph(graph, mockOps, input) {
  const nodes = graph.nodes;
  const edges = graph.edges;

  const outEdges = {};
  const inSources = {};
  for (const k of Object.keys(nodes)) {
    outEdges[k] = [];
    inSources[k] = [];
  }
  for (const e of edges) {
    outEdges[e.from].push(e.to);
    inSources[e.to].push(e.from);
  }

  const inputKey = Object.keys(nodes).find((k) => nodes[k].type === "input");

  const output = [];
  let terminated = false;
  let errorResult = null;

  const buffers = {}; // key -> { acc:[values], counts:{} }
  const combines = {}; // key -> { latest:{}, counts:{}, produced:Set, ready:bool }

  const queue = [];
  const enqueueFrom = (fromKey, events) => {
    for (const ev of events)
      for (const to of outEdges[fromKey])
        queue.push({ to, from: fromKey, event: ev });
  };

  const routeError = (nodeKey, node, event, message) => {
    if (node.onError)
      queue.push({
        to: node.onError,
        from: nodeKey,
        event: { value: { error: message, event: event.value }, counts: event.counts },
      });
    // otherwise the error event is dropped
  };

  const flushBuffer = (key) => {
    const b = buffers[key];
    if (!b || b.acc.length === 0) return false;
    const arr = b.acc;
    const counts = b.counts;
    buffers[key] = { acc: [], counts: {} };
    enqueueFrom(key, [{ value: arr, counts }]);
    return true;
  };

  const combineEmit = (key) => {
    const c = combines[key];
    const obj = {};
    let counts = {};
    for (const s of inSources[key]) {
      obj[s] = s in c.latest ? c.latest[s] : null;
      if (c.counts[s]) counts = mergeMax(counts, c.counts[s]);
    }
    enqueueFrom(key, [{ value: obj, counts }]);
  };

  async function processArrival(nodeKey, fromKey, event) {
    const node = nodes[nodeKey];
    switch (node.type) {
      case "input":
        enqueueFrom(nodeKey, [event]); // defensive; input normally has no incoming edge
        return;
      case "output":
        output.push(event.value);
        return;
      case "operation": {
        const count = (event.counts[nodeKey] ?? 0) + 1;
        if (node.maxIterations && count > node.maxIterations) return; // safety drop
        const counts = { ...event.counts, [nodeKey]: count };
        const mock = mockOps?.[node.operation];
        if (!mock) throw new Error(`fixture has no mock for operation '${node.operation}'`);
        const resp = mock.responses.find(
          (r) => !("whenInput" in r) || deepEqual(r.whenInput, event.value)
        );
        if (!resp)
          throw new Error(
            `no mocked response for '${node.operation}' input ${canonical(event.value)}`
          );
        if ("fail" in resp) {
          routeError(nodeKey, node, { value: event.value, counts }, resp.fail);
          return;
        }
        enqueueFrom(
          nodeKey,
          resp.emit.map((v) => ({ value: v, counts: { ...counts } }))
        );
        return;
      }
      case "filter": {
        let pass;
        if ("schema" in node) pass = schemaPass(node.schema, event.value);
        else pass = truthy(await evalJsonata(node.transform, event.value, input));
        if (pass) enqueueFrom(nodeKey, [event]);
        return;
      }
      case "transform": {
        const r = await evalJsonata(node.transform, event.value, input);
        if (r === undefined) {
          routeError(nodeKey, node, event, "transform_undefined");
          return;
        }
        enqueueFrom(nodeKey, [{ value: r, counts: event.counts }]);
        return;
      }
      case "map": {
        const r = await evalJsonata(node.transform, event.value, input);
        if (!Array.isArray(r)) {
          routeError(nodeKey, node, event, "map_not_array");
          return;
        }
        enqueueFrom(
          nodeKey,
          r.map((el) => ({ value: el, counts: { ...event.counts } }))
        );
        return;
      }
      case "buffer": {
        const b = (buffers[nodeKey] ||= { acc: [], counts: {} });
        const val = event.value;
        if (node.until && schemaPass(node.until, val)) {
          flushBuffer(nodeKey); // exclude triggering event, drop it
          return;
        }
        if (node.through && schemaPass(node.through, val)) {
          b.acc.push(val);
          b.counts = mergeMax(b.counts, event.counts);
          flushBuffer(nodeKey);
          return;
        }
        b.acc.push(val);
        b.counts = mergeMax(b.counts, event.counts);
        if (node.limit && b.acc.length >= node.limit) flushBuffer(nodeKey);
        return; // no-condition buffers flush at end of stream
      }
      case "combine": {
        const c = (combines[nodeKey] ||= {
          latest: {},
          counts: {},
          produced: new Set(),
          ready: false,
        });
        c.latest[fromKey] = event.value;
        c.counts[fromKey] = event.counts;
        c.produced.add(fromKey);
        if (!c.ready && inSources[nodeKey].every((s) => c.produced.has(s)))
          c.ready = true;
        if (c.ready) combineEmit(nodeKey);
        return;
      }
      case "exit": {
        terminated = true;
        if (node.error === true) errorResult = { error: true, errorDetail: event.value };
        else {
          output.push(event.value);
          errorResult = { error: false };
        }
        return;
      }
      default:
        throw new Error(`unsupported node type '${node.type}' at node '${nodeKey}'`);
    }
  }

  enqueueFrom(inputKey, [{ value: input, counts: {} }]);

  // drain to fixpoint
  // eslint-disable-next-line no-constant-condition
  while (true) {
    while (queue.length && !terminated) {
      const { to, from, event } = queue.shift();
      await processArrival(to, from, event);
    }
    if (terminated) break;

    // end-of-stream pass: flush no-condition buffers, complete combines
    let producedAny = false;
    for (const key of Object.keys(buffers)) if (flushBuffer(key)) producedAny = true;
    for (const key of Object.keys(combines)) {
      const c = combines[key];
      if (!c.ready) {
        c.ready = true; // all sources are now complete
        combineEmit(key);
        producedAny = true;
      }
    }
    if (!producedAny) break;
  }

  return { output, error: errorResult?.error === true, errorDetail: errorResult?.errorDetail };
}

// --- harness ---------------------------------------------------------------

function compare(actual, expected) {
  const ordering = expected.ordering ?? "exact";
  if (expected.error === true) {
    if (!actual.error) return "expected fatal termination, but graph completed normally";
    if (!deepEqual(actual.errorDetail, expected.errorDetail))
      return `error detail mismatch\n      got:    ${canonical(actual.errorDetail)}\n      expect: ${canonical(expected.errorDetail)}`;
  } else if (actual.error) {
    return "graph terminated with an error, but the fixture expected output";
  }
  const ok =
    ordering === "set"
      ? multisetEqual(actual.output, expected.output)
      : deepEqual(actual.output, expected.output);
  if (!ok)
    return `output mismatch (${ordering})\n      got:    ${canonical(actual.output)}\n      expect: ${canonical(expected.output)}`;
  return null;
}

const files = readdirSync(EXEC_DIR)
  .filter((n) => n.endsWith(".json"))
  .sort();

let pass = 0;
let fail = 0;
for (const file of files) {
  const doc = JSON.parse(readFileSync(join(EXEC_DIR, file), "utf8"));
  for (const fx of doc.fixtures) {
    let actual;
    try {
      actual = await runGraph(fx.graph, fx.operations, fx.input);
    } catch (e) {
      console.log(`FAIL ${fx.id} (${basename(file)}): threw: ${e.message}`);
      fail++;
      continue;
    }
    const problem = compare(actual, fx.expected);
    if (problem) {
      console.log(`FAIL ${fx.id} ${fx.name}: ${problem}`);
      fail++;
    } else {
      console.log(`PASS ${fx.id} ${fx.name}`);
      pass++;
    }
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
