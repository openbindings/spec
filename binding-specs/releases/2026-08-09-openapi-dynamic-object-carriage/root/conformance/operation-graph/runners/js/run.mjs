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
//     It opens with the graph and its output is consumed immediately. Arriving
//     events are written into it in order; a mock with `closesAfter`
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
const EXEC_DIR = process.env.OG_EXEC_DIR
  ? resolve(process.env.OG_EXEC_DIR)
  : resolve(__dirname, "..", "..", "execution");

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

function multisetEqual(a, b, key = canonical) {
  if (a.length !== b.length) return false;
  const sa = a.map(key).sort();
  const sb = b.map(key).sort();
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

// JSONata 2.0 boolean cast ($boolean) for filter-expression results:
// empty composites are false, and an array is true only if some member
// casts to true. (Callers handle undefined separately: it fails the node
// with TRANSFORM_UNDEFINED per the Transforms rule.)
function truthy(r) {
  if (r === null || r === undefined) return false;
  if (typeof r === "boolean") return r;
  if (typeof r === "number") return r !== 0;
  if (typeof r === "string") return r !== "";
  if (Array.isArray(r)) return r.some(truthy);
  if (typeof r === "function") return false;
  if (typeof r === "object") return Object.keys(r).length > 0;
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

async function runGraph(graph, mockOps, writes, sched, awaitOutputsBeforeWrites) {
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
  const pendingEach = []; // deferred each-invocations, settled by the scheduler
  const enqueueFrom = (fromKey, events) => {
    for (const ev of events)
      for (const to of outEdges[fromKey])
        queue.push({ to, from: fromKey, event: ev });
  };

  // Per-event failure: route { error, event } per onError, or terminate with
  // that complete error event as the graph's terminal detail.
  const routePerEventError = (node, message, event) => {
    const errorEvent = { error: message, event: event.value };
    if (node.onError) {
      queue.push({
        to: node.onError,
        from: null,
        event: {
          value: errorEvent,
          counts: event.counts,
          rootId: event.rootId,
        },
      });
      return;
    }
    queue.push({ terminal: { error: true, errorDetail: errorEvent } });
  };

  // Evaluation throws have one portable graph-visible identifier. Engine- or
  // expression-specific prose is diagnostic-only and must not change events.
  const evaluateForNode = async (node, event) => {
    try {
      return { ok: true, value: await evalExpr(node.transform, event) };
    } catch {
      routePerEventError(node, "EXPRESSION_EVALUATION_FAILED", event);
      return { ok: false };
    }
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
    // Fatal to the graph invocation, but routed through the queue behind the
    // outputs this conduit already enqueued: the drain emits those before it
    // reaches this terminal marker (the identity law's terminal-status clause
    // — the terminal follows the stream it terminates). The graph's terminal
    // error is the inner terminal error itself (the value direct invocation
    // would surface), not an error-event wrapper around it.
    queue.push({ terminal: { error: true, errorDetail: message } });
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
    // A response may emit, fail, or emit-then-fail. The emitted events are the
    // outputs the invocation produced before any terminal; enqueue them first,
    // then route the terminal error behind them (the identity law: a conduit's
    // pre-failure outputs surface before the graph terminates).
    const emitted = resp.emit ?? [];
    if (emitted.length)
      enqueueFrom(
        nodeKey,
        emitted.map((v) => ({ value: v, counts: { ...c.counts }, rootId }))
      );
    if ("fail" in resp) {
      conduitTerminalError(nodeKey, node, resp.fail, c.counts, rootId);
      return true;
    }
    return emitted.length > 0 || outEdges[nodeKey].length === 0;
  };

  // Open a held invocation. Every operation conduit is opened at graph start,
  // before caller writes are admitted, and output available on open is queued
  // immediately. Startup output has no caller-write lineage, so $input is
  // undefined downstream until an event with a root contributes.
  const openConduit = (nodeKey) => {
    const c = conduits[nodeKey];
    const node = nodes[nodeKey];
    const mock = mockOps?.[node.operation];
    if (!mock)
      throw new Error(`fixture has no mock for operation '${node.operation}'`);
    const opened = mock.onOpen;
    const emitted = opened?.emit ?? [];
    if (emitted.length)
      enqueueFrom(
        nodeKey,
        emitted.map((value) => ({ value, counts: {}, rootId: NO_ROOT }))
      );
    if (opened && "fail" in opened) {
      c.done = true;
      c.accepting = false;
      conduitTerminalError(nodeKey, node, opened.fail, {}, NO_ROOT);
      return;
    }
    if (mock.closesAfter === 0) completeConduit(nodeKey);
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

  // Settle one `each` invocation: match its single write against the mock and
  // either route a per-event failure or emit its outputs downstream.
  function settleEach(t) {
    const mock = mockOps?.[t.node.operation];
    if (!mock)
      throw new Error(`fixture has no mock for operation '${t.node.operation}'`);
    const opened = mock.onOpen;
    const openedEmitted = opened?.emit ?? [];
    if (openedEmitted.length)
      enqueueFrom(
        t.nodeKey,
        openedEmitted.map((v) => ({
          value: v,
          counts: { ...t.counts },
          rootId: t.rootId,
        }))
      );
    if (opened && "fail" in opened) {
      routePerEventError(t.node, opened.fail, {
        value: t.value,
        counts: t.counts,
        rootId: t.rootId,
      });
      return;
    }
    const resp = matchResponse(mock, t.node.operation, [t.value]);
    // Emit-then-fail is symmetric to the conduit: emit the invocation's
    // outputs first, then route the per-event failure.
    const emitted = resp.emit ?? [];
    if (emitted.length)
      enqueueFrom(
        t.nodeKey,
        emitted.map((v) => ({
          value: v,
          counts: { ...t.counts },
          rootId: t.rootId,
        }))
      );
    if ("fail" in resp) {
      routePerEventError(t.node, resp.fail, {
        value: t.value,
        counts: t.counts,
        rootId: t.rootId,
      });
    }
  }

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
        const token = { nodeKey, node, value: event.value, counts, rootId: event.rootId };
        // Each invocation is independent. In adversarial mode it is deferred so
        // the scheduler can settle concurrently-pending invocations in any order
        // (modelling the spec's implementation-defined `each` interleaving); in
        // default mode it settles immediately, preserving FIFO behavior.
        if (sched) pendingEach.push(token);
        else settleEach(token);
        return;
      }
      case "filter": {
        let pass;
        if ("schema" in node) {
          pass = schemaPass(node.schema, event.value);
        } else {
          const evaluated = await evaluateForNode(node, event);
          if (!evaluated.ok) return;
          const r = evaluated.value;
          if (r === undefined) {
            routePerEventError(node, "TRANSFORM_UNDEFINED", event);
            return;
          }
          pass = truthy(r);
        }
        if (pass) enqueueFrom(nodeKey, [event]);
        return;
      }
      case "transform": {
        const evaluated = await evaluateForNode(node, event);
        if (!evaluated.ok) return;
        const r = evaluated.value;
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
        const evaluated = await evaluateForNode(node, event);
        if (!evaluated.ok) return;
        const r = evaluated.value;
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
    if (!sched) {
      while (queue.length && !terminated) {
        const item = queue.shift();
        if (item.terminal) {
          // A conduit's fatal terminal, reached in FIFO order after the
          // outputs it enqueued ahead of this marker: terminate now.
          terminated = true;
          errorResult = item.terminal;
          break;
        }
        await processArrival(item.to, item.from, item.event);
      }
      return;
    }
    // Adversarial scheduling: at each step choose uniformly at random among the
    // legal next actions — deliver any queued event that is the head of its
    // (from,to) edge (per-edge order preserved; cross-edge interleaving free),
    // or settle any pending `each` invocation (their completion order is
    // implementation-defined). Seeded, so a failing interleaving reproduces.
    while ((queue.length || pendingEach.length) && !terminated) {
      const choices = [];
      for (let i = 0; i < queue.length; i++) {
        const it = queue[i];
        if (it.terminal) {
          // A fatal terminal follows the stream it terminates: it fires only
          // once every event enqueued ahead of it has drained, i.e. when it
          // reaches the head of the queue.
          if (i === 0) choices.push({ q: i });
          continue;
        }
        let blocked = false;
        for (let j = 0; j < i; j++) {
          const pj = queue[j];
          if (!pj.terminal && pj.from === it.from && pj.to === it.to) {
            blocked = true;
            break;
          }
        }
        if (!blocked) choices.push({ q: i });
      }
      for (let p = 0; p < pendingEach.length; p++) choices.push({ e: p });
      const pick = choices[Math.floor(sched.rng() * choices.length)];
      if ("q" in pick) {
        const it = queue[pick.q];
        if (it.terminal) {
          queue.splice(pick.q, 1);
          terminated = true;
          errorResult = it.terminal;
        } else {
          const [{ to, from, event }] = queue.splice(pick.q, 1);
          await processArrival(to, from, event);
        }
      } else {
        settleEach(pendingEach.splice(pick.e, 1)[0]);
      }
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

  // Initiate every held invocation and begin consuming startup output before
  // accepting or awaiting the first caller write. This is the causal part of
  // the identity law: a direct operation's output-before-input cannot become
  // input-dependent merely because it is wrapped by a graph.
  for (const key of Object.keys(conduits)) openConduit(key);
  await drain();
  if (
    !terminated &&
    awaitOutputsBeforeWrites != null &&
    output.length < awaitOutputsBeforeWrites
  )
    throw new Error(
      `startup deadlock: caller awaited ${awaitOutputsBeforeWrites} output(s) before writing, graph produced ${output.length}`
    );

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
  const arrayOrdering = expected.arrayOrdering ?? "exact";
  if (expected.error === true) {
    if (!actual.error)
      return "expected fatal termination, but graph completed normally";
    if (!deepEqual(actual.errorDetail, expected.errorDetail))
      return `error detail mismatch\n      got:    ${canonical(actual.errorDetail)}\n      expect: ${canonical(expected.errorDetail)}`;
  } else if (actual.error) {
    return `graph terminated with an error (${canonical(actual.errorDetail)}), but the fixture expected output`;
  }
  if (
    expected.refusedWrites != null &&
    actual.refusedWrites !== expected.refusedWrites
  )
    return `refused-write mismatch\n      got:    ${actual.refusedWrites}\n      expect: ${expected.refusedWrites}`;
  // `ordering` governs the order of output *events*. `arrayOrdering: "set"`
  // additionally treats an array-valued output event as a multiset, for a
  // collector (e.g. a buffer) fed by concurrent `each` invocations or fan-in
  // paths whose element order the spec's "Determinism and portability" section
  // leaves implementation-defined.
  const eventKey = (e) =>
    arrayOrdering === "set" && Array.isArray(e)
      ? "[" + e.map(canonical).sort().join(",") + "]"
      : canonical(e);
  const ok =
    ordering === "set"
      ? multisetEqual(actual.output, expected.output, eventKey)
      : actual.output.length === expected.output.length &&
        actual.output.every((e, i) => eventKey(e) === eventKey(expected.output[i]));
  if (!ok)
    return `output mismatch (ordering=${ordering}, arrayOrdering=${arrayOrdering})\n      got:    ${canonical(actual.output)}\n      expect: ${canonical(expected.output)}`;
  return null;
}

// Default: one deterministic FIFO run per fixture (fast). `--adversarial`: run
// each fixture under many seeded-random legal interleavings and require every
// trial to satisfy its declared ordering/arrayOrdering. This is what turns the
// portability labels from author-asserted into machine-verified: a fixture
// labeled stricter than its graph actually guarantees fails here, with a seed
// that reproduces the offending interleaving.
const argv = process.argv.slice(2);
const adversarial = argv.includes("--adversarial");
const numArg = (name, dflt) => {
  const a = argv.find((x) => x.startsWith(`--${name}=`));
  return a ? Number(a.slice(name.length + 3)) : dflt;
};
const TRIALS = numArg("trials", 64);
const SEED0 = numArg("seed", 0x9e3779b9) >>> 0;

// Small seeded PRNG (mulberry32) so a failing interleaving is reproducible.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const files = readdirSync(EXEC_DIR)
  .filter((n) => n.endsWith(".json"))
  .sort();

let pass = 0;
let fail = 0;
for (const file of files) {
  const doc = JSON.parse(readFileSync(join(EXEC_DIR, file), "utf8"));
  for (const fx of doc.fixtures) {
    if (!adversarial) {
      let actual;
      try {
        actual = await runGraph(
          fx.graph,
          fx.operations,
          fx.writes,
          undefined,
          fx.awaitOutputsBeforeWrites
        );
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
      continue;
    }
    // Adversarial: many seeded interleavings; every trial must satisfy compare().
    let bad = null;
    for (let k = 0; k < TRIALS && !bad; k++) {
      const seed = (SEED0 + Math.imul(k, 0x9e3779b1)) >>> 0;
      try {
        const actual = await runGraph(
          fx.graph,
          fx.operations,
          fx.writes,
          { rng: mulberry32(seed) },
          fx.awaitOutputsBeforeWrites
        );
        const problem = compare(actual, fx.expected);
        if (problem) bad = { seed, msg: problem };
      } catch (e) {
        bad = { seed, msg: "threw: " + e.message };
      }
    }
    if (bad) {
      console.log(
        `FAIL ${fx.id} ${fx.name} [reproduce: --seed=${bad.seed} --trials=1]: ${bad.msg}`
      );
      fail++;
    } else {
      console.log(`PASS ${fx.id} ${fx.name} (${TRIALS} interleavings)`);
      pass++;
    }
  }
}

console.log(
  `\n${pass} passed, ${fail} failed${adversarial ? ` (${TRIALS} interleavings each)` : ""}`
);
process.exit(fail ? 1 : 0);
