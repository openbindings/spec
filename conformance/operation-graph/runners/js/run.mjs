#!/usr/bin/env node
// Reference runner for the openbindings.operation-graph execution conformance
// fixtures. It executes each fixture's graph against its mocked operations and
// caller writes, then diffs the produced output stream against `expected`.
//
// Operations are mocked (the fixtures supply canned responses matched per
// invocation), so this runner needs only a graph engine, a JSONata evaluator,
// and a JSON Schema validator. It does NOT depend on any binding-invocation
// stack.
//
// Semantics implemented (the transparency rewrite):
//   - `operation` is the conduit: one held invocation per graph invocation.
//     Arriving events are written into it in order; a mock with `closesAfter`
//     closes its input from below after that many writes (the node becomes
//     non-accepting and later events are write-rejection error events); a mock
//     without it consumes the stream and responds at input completion. An
//     unhandled terminal error (`fail`) terminates the graph invocation.
//   - `each` opens one single-write invocation per arriving event;
//     `maxIterations` bounds it per event lineage; failures are per-event.
//   - Caller writes are admitted sequentially; back-closure refuses remaining
//     writes once every direct consumer of the input node is non-accepting.
//   - `$input` is the lineage root: each caller write roots a lineage, and a
//     merged event's `$input` is defined only when all contributors share one
//     root.
//
// The engine is a deterministic, single-threaded drain-to-fixpoint
// interpreter: each caller write is admitted and the FIFO queue drained to
// quiescence; then completion propagates in dependency order (a stateful node
// — conduit, buffer, combine — completes only once no other live stateful
// node can still reach it), re-draining after each step. Determinism makes
// `ordering: exact` fixtures reproducible; `ordering: set` fixtures are
// compared as a multiset, matching the spec's "Determinism and portability"
// section.
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

// Match a completed invocation's write list against a mock's response rules.
function matchResponse(mock, opKey, writes) {
  for (const r of mock.responses) {
    if ("whenInputs" in r) {
      if (deepEqual(r.whenInputs, writes)) return r;
    } else if ("whenInput" in r) {
      if (writes.length === 1 && deepEqual(r.whenInput, writes[0])) return r;
    } else {
      return r; // wildcard
    }
  }
  throw new Error(
    `no mocked response for '${opKey}' writes ${canonical(writes)}`
  );
}

// --- engine ----------------------------------------------------------------

// Events are { value, counts, rootId }. `counts` is the per-`each`-node
// lineage counter map; `rootId` identifies the caller write this event
// descends from (null when contributors of a merge disagree, making $input
// undefined per the Runtime context section).
const NO_ROOT = null;
const mergedRoot = (ids) => {
  const set = new Set(ids);
  return set.size === 1 ? [...set][0] : NO_ROOT;
};

async function runGraph(graph, mockOps, writes) {
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

  const rootValues = new Map(); // rootId -> the caller-written value
  const evalExpr = (expr, event) =>
    jsonata(expr).evaluate(event.value, {
      input: event.rootId === NO_ROOT ? undefined : rootValues.get(event.rootId),
    });

  const output = [];
  let terminated = false;
  let errorResult = null;
  let refusedWrites = 0;

  // Stateful node instances, one per graph invocation.
  const conduits = {}; // operation nodes: held-invocation state
  const buffers = {}; // key -> { acc:[values], counts:{}, roots:[], completed }
  const combines = {}; // key -> { latest:{}, counts:{}, roots:{}, produced:Set, ready, completed }
  for (const [key, node] of Object.entries(nodes)) {
    if (node.type === "operation")
      conduits[key] = {
        writes: [],
        counts: {},
        roots: [],
        accepting: true,
        done: false,
      };
    if (node.type === "buffer")
      buffers[key] = { acc: [], counts: {}, roots: [], completed: false };
    if (node.type === "combine" && inSources[key].length > 0)
      combines[key] = {
        latest: {},
        counts: {},
        roots: {},
        produced: new Set(),
        ready: false,
        completed: false,
      };
  }

  const queue = [];
  const enqueueFrom = (fromKey, events) => {
    for (const ev of events)
      for (const to of outEdges[fromKey])
        queue.push({ to, from: fromKey, event: ev });
  };

  // Per-event failure: route { error, event } per onError, or drop.
  const routePerEventError = (node, message, event) => {
    if (node.onError)
      queue.push({
        to: node.onError,
        from: null,
        event: {
          value: { error: message, event: event.value },
          counts: event.counts,
          rootId: event.rootId,
        },
      });
  };

  // Conduit terminal error: opt-in handling via onError ({ error }, no event
  // member), else fatal to the graph invocation (the identity law's
  // terminal-status clause).
  const conduitTerminalError = (nodeKey, node, message, counts, rootId) => {
    if (node.onError) {
      queue.push({
        to: node.onError,
        from: nodeKey,
        event: { value: { error: message }, counts, rootId },
      });
      return;
    }
    // The graph's terminal error is the inner terminal error itself (identity
    // law: the value direct invocation would surface), not an error-event
    // wrapper around it.
    terminated = true;
    errorResult = { error: true, errorDetail: message };
  };

  // Close the conduit's held invocation and produce its response.
  const completeConduit = (nodeKey) => {
    const c = conduits[nodeKey];
    if (c.done) return false;
    c.done = true;
    c.accepting = false;
    const node = nodes[nodeKey];
    const mock = mockOps?.[node.operation];
    if (!mock)
      throw new Error(`fixture has no mock for operation '${node.operation}'`);
    const resp = matchResponse(mock, node.operation, c.writes);
    const rootId = mergedRoot(c.roots);
    if ("fail" in resp) {
      conduitTerminalError(nodeKey, node, resp.fail, c.counts, rootId);
      return true;
    }
    enqueueFrom(
      nodeKey,
      resp.emit.map((v) => ({ value: v, counts: { ...c.counts }, rootId }))
    );
    return resp.emit.length > 0 || outEdges[nodeKey].length === 0;
  };

  const flushBuffer = (key) => {
    const b = buffers[key];
    if (!b || b.acc.length === 0) return false;
    const arr = b.acc;
    const counts = b.counts;
    const rootId = mergedRoot(b.roots);
    b.acc = [];
    b.counts = {};
    b.roots = [];
    enqueueFrom(key, [{ value: arr, counts, rootId }]);
    return true;
  };

  const combineEmit = (key) => {
    const c = combines[key];
    const obj = {};
    let counts = {};
    const roots = [];
    for (const s of inSources[key]) {
      obj[s] = s in c.latest ? c.latest[s] : null;
      if (c.counts[s]) counts = mergeMax(counts, c.counts[s]);
      if (s in c.roots) roots.push(c.roots[s]);
    }
    enqueueFrom(key, [
      { value: obj, counts, rootId: roots.length ? mergedRoot(roots) : NO_ROOT },
    ]);
  };

  async function processArrival(nodeKey, fromKey, event) {
    const node = nodes[nodeKey];
    switch (node.type) {
      case "input":
        return; // rule 4 forbids incoming edges; defensive no-op
      case "output":
        output.push(event.value);
        return;
      case "operation": {
        const c = conduits[nodeKey];
        if (!c.accepting) {
          routePerEventError(node, "WRITE_REJECTED", event);
          return;
        }
        c.writes.push(event.value);
        c.counts = mergeMax(c.counts, event.counts);
        c.roots.push(event.rootId);
        const mock = mockOps?.[node.operation];
        if (!mock)
          throw new Error(
            `fixture has no mock for operation '${node.operation}'`
          );
        if (mock.closesAfter != null && c.writes.length >= mock.closesAfter) {
          // The selected binding closes its input from below; the invocation's
          // outputs are determined and the node becomes non-accepting.
          completeConduit(nodeKey);
        }
        return;
      }
      case "each": {
        const count = (event.counts[nodeKey] ?? 0) + 1;
        if (node.maxIterations && count > node.maxIterations) return; // safety drop
        const counts = { ...event.counts, [nodeKey]: count };
        const mock = mockOps?.[node.operation];
        if (!mock)
          throw new Error(
            `fixture has no mock for operation '${node.operation}'`
          );
        const resp = matchResponse(mock, node.operation, [event.value]);
        if ("fail" in resp) {
          routePerEventError(node, resp.fail, {
            value: event.value,
            counts,
            rootId: event.rootId,
          });
          return;
        }
        enqueueFrom(
          nodeKey,
          resp.emit.map((v) => ({
            value: v,
            counts: { ...counts },
            rootId: event.rootId,
          }))
        );
        return;
      }
      case "filter": {
        let pass;
        if ("schema" in node) pass = schemaPass(node.schema, event.value);
        else pass = truthy(await evalExpr(node.transform, event));
        if (pass) enqueueFrom(nodeKey, [event]);
        return;
      }
      case "transform": {
        const r = await evalExpr(node.transform, event);
        if (r === undefined) {
          routePerEventError(node, "TRANSFORM_UNDEFINED", event);
          return;
        }
        enqueueFrom(nodeKey, [
          { value: r, counts: event.counts, rootId: event.rootId },
        ]);
        return;
      }
      case "map": {
        const r = await evalExpr(node.transform, event);
        if (!Array.isArray(r)) {
          routePerEventError(node, "MAP_NOT_ARRAY", event);
          return;
        }
        enqueueFrom(
          nodeKey,
          r.map((el) => ({
            value: el,
            counts: { ...event.counts },
            rootId: event.rootId,
          }))
        );
        return;
      }
      case "buffer": {
        const b = buffers[nodeKey];
        const val = event.value;
        // Spec order (execution semantics): add the event, then evaluate
        // limit, then until, then through. limit takes precedence, so an event
        // that both reaches the limit and matches until/through is flushed as
        // part of the batch rather than treated as a delimiter.
        b.acc.push(val);
        if (node.limit && b.acc.length >= node.limit) {
          b.counts = mergeMax(b.counts, event.counts); // triggering event is in the batch
          b.roots.push(event.rootId);
          flushBuffer(nodeKey);
          return;
        }
        if (node.until && schemaPass(node.until, val)) {
          b.acc.pop(); // exclude and drop the triggering event; lineage not merged
          flushBuffer(nodeKey);
          return;
        }
        b.counts = mergeMax(b.counts, event.counts); // event stays in the batch
        b.roots.push(event.rootId);
        if (node.through && schemaPass(node.through, val)) {
          flushBuffer(nodeKey);
          return;
        }
        return; // continue accumulating; completion flushes any partial batch
      }
      case "combine": {
        const c = combines[nodeKey];
        c.latest[fromKey] = event.value;
        c.counts[fromKey] = event.counts;
        c.roots[fromKey] = event.rootId;
        c.produced.add(fromKey);
        if (!c.ready && inSources[nodeKey].every((s) => c.produced.has(s)))
          c.ready = true;
        if (c.ready) combineEmit(nodeKey);
        return;
      }
      case "exit": {
        terminated = true;
        if (node.error === true)
          errorResult = { error: true, errorDetail: event.value };
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

  async function drain() {
    while (queue.length && !terminated) {
      const { to, from, event } = queue.shift();
      await processArrival(to, from, event);
    }
  }

  // Back-closure: the caller-facing input side closes when every node
  // targeted by an outgoing edge of the input node is non-accepting.
  // Non-acceptance is defined for operation nodes only; built-ins are always
  // accepting, so any built-in consumer keeps closure caller-owned.
  const inputBackClosed = () => {
    const consumers = outEdges[inputKey];
    if (consumers.length === 0) return false;
    return consumers.every(
      (k) => nodes[k].type === "operation" && !conduits[k].accepting
    );
  };

  // Reachability between stateful nodes (following edges and onError refs),
  // used to complete them in dependency order at end of stream.
  const statefulKeys = [
    ...Object.keys(conduits),
    ...Object.keys(buffers),
    ...Object.keys(combines),
  ];
  const succ = {};
  for (const k of Object.keys(nodes)) {
    succ[k] = [...outEdges[k]];
    if (nodes[k].onError) succ[k].push(nodes[k].onError);
  }
  const reaches = {}; // statefulKey -> Set of stateful keys reachable from it
  for (const s of statefulKeys) {
    const seen = new Set();
    const stack = [...succ[s]];
    while (stack.length) {
      const n = stack.pop();
      if (seen.has(n)) continue;
      seen.add(n);
      stack.push(...succ[n]);
    }
    reaches[s] = new Set(statefulKeys.filter((t) => seen.has(t)));
  }

  const isLive = (k) =>
    k in conduits
      ? !conduits[k].done
      : k in buffers
        ? !buffers[k].completed
        : !combines[k].completed;

  // --- run -------------------------------------------------------------

  // Caller writes are admitted sequentially; each roots a lineage.
  for (let i = 0; i < writes.length; i++) {
    if (terminated) break;
    if (inputBackClosed()) {
      refusedWrites = writes.length - i;
      break;
    }
    rootValues.set(i, writes[i]);
    enqueueFrom(inputKey, [{ value: writes[i], counts: {}, rootId: i }]);
    await drain();
  }

  // The caller closes the input side; completion propagates in dependency
  // order: a live stateful node completes only when no other live stateful
  // node can still reach it (so upstream responses land before downstream
  // flushes).
  while (!terminated) {
    await drain();
    if (terminated) break;
    const live = statefulKeys.filter(isLive);
    if (live.length === 0 && queue.length === 0) break;
    let candidates = live.filter(
      (k) => !live.some((other) => other !== k && reaches[other].has(k))
    );
    if (candidates.length === 0) candidates = live; // mutual cycles: force progress
    let producedAny = false;
    for (const k of candidates) {
      if (terminated) break;
      if (k in conduits) {
        if (completeConduit(k)) producedAny = true;
      } else if (k in buffers) {
        if (flushBuffer(k)) producedAny = true;
        buffers[k].completed = true;
      } else {
        const c = combines[k];
        if (!c.ready) {
          c.ready = true; // every source has completed
          combineEmit(k);
          producedAny = true;
        }
        c.completed = true;
      }
    }
    if (!producedAny && queue.length === 0 && candidates.length === live.length)
      break;
  }

  return {
    output,
    error: errorResult?.error === true,
    errorDetail: errorResult?.errorDetail,
    refusedWrites,
  };
}

// --- harness ---------------------------------------------------------------

function compare(actual, expected) {
  const ordering = expected.ordering ?? "exact";
  if (expected.error === true) {
    if (!actual.error)
      return "expected fatal termination, but graph completed normally";
    if (!deepEqual(actual.errorDetail, expected.errorDetail))
      return `error detail mismatch\n      got:    ${canonical(actual.errorDetail)}\n      expect: ${canonical(expected.errorDetail)}`;
  } else if (actual.error) {
    return `graph terminated with an error (${canonical(actual.errorDetail)}), but the fixture expected output`;
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
      actual = await runGraph(fx.graph, fx.operations, fx.writes);
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
