# openbindings.operation-graph conformance subcorpus

Fixtures for the `openbindings.operation-graph` binding format, keyed to its
companion specification at
[`formats/operation-graph/openbindings.operation-graph.md`](../../formats/operation-graph/openbindings.operation-graph.md).

The corpus tracks the **transparency rewrite** of the format: `operation` is
the cardinality-agnostic conduit (one held invocation per graph invocation),
`each` is the per-event invocation built-in, caller input is a stream of
writes, and the identity law (`input → operation(y) → output` is
observationally indistinguishable from direct invocation of `y`) is pinned by
its own fixture suite.

This is a per-format subcorpus, governed by the operation-graph format spec, not
by the core OBI-D / OBI-T conformance rules. It lives alongside the core corpus
but is governed separately: the core verifiers (`verify-corpus.mjs`,
`generate-conformance-manifest.mjs`) only scan `document/` and `tool/`, so they
neither pick up nor are broken by this directory. The dedicated verifier is
`scripts/verify-operation-graph.mjs`.

## Layout

```
operation-graph/
  README.md             (this file)
  execution.schema.json (fixture-file shape for execution fixtures)
  validation.schema.json(fixture-file shape for validation fixtures)
  execution/            (replayable graph executions)
    OG-EX-01.json ... OG-EX-34.json   (files; ids run OG-EX-01 ... OG-EX-34)
  validation/           (well-formedness rules; OG-VR.json)
  runners/js/           (reference execution runner: engine + JSONata + ajv)
```

## What the verifier checks

`node scripts/verify-operation-graph.mjs` (run in CI) performs three checks. It
shells out to `ajv-cli` for JSON Schema validation, the same validator the CI
uses for the core schema.

1. **Spec examples.** Every operation-graph definition embedded in a fenced JSON
   block of the format spec validates against the op-graph JSON Schema. This
   keeps the spec's normative examples from drifting out of shape.
2. **Execution fixtures.** Each file matches `execution.schema.json`, and every
   fixture's `graph` validates against the op-graph schema and has exactly one
   `input` and one `output` node.
3. **Validation fixtures.** Each file matches `validation.schema.json`. Every
   `valid: true` graph validates against the op-graph schema. For rule blocks
   marked `schemaEnforced: true`, every `valid: false` graph is rejected by the
   schema. OG-V-11 tests additionally carry an `operations` set, and the
   verifier resolves the `operation` field of every `operation` and `each` node
   against it.

`scripts/verify-operation-graph.mjs` does not execute graphs; it pins their
shape. Executing them and diffing the output stream is the job of the reference
runner under `runners/js/` (see [Reference runner](#reference-runner)), which the
CI also runs.

## Execution fixtures

A fixture supplies:

- `graph` — the operation graph definition under test.
- `operations` — mocked behavior for each operation an `operation` or `each`
  node invokes. Mocks are matched **per invocation**: a conduit's one held
  invocation collects every arriving event as a write; an `each` node opens a
  single-write invocation per event. Each operation has an ordered list of
  `responses`; the first whose `whenInputs` deep-equals the invocation's write
  list (or whose `whenInput` deep-equals the sole write of a single-write
  invocation, or which carries neither, a wildcard) applies, emitting `emit`
  events or terminating with `fail`. `closesAfter: N` models a selected binding
  that closes its input side after reading N writes (1 = unary or
  server-streaming); absent models a stream-consuming binding that responds at
  input completion.
- `writes` — the values the caller writes to the graph invocation, in order.
  Each roots an event lineage; `[]` is a no-input invocation. The caller closes
  the input side after the last write (unless back-closure closes it first).
- `expected` — the expected `output` events, an `ordering` of `exact` or `set`
  (plus an optional `arrayOrdering`, below),
  and for fatal cases `error: true` with the `errorDetail`: the event that
  reached an `exit` node with `error: true`, or for an unhandled conduit
  terminal error, the unwrapped inner terminal error value itself (the value
  direct invocation would surface, not wrapped in the error-event shape).

`ordering: set` is used where the graph has concurrent paths whose interleaving
is implementation-defined (see the spec's "Determinism and portability"
section); the runner compares the output as a multiset in that case.
`arrayOrdering: set` is the analogous knob for an array-valued output event
whose *element* order is implementation-defined — a collector (e.g. a `buffer`)
fed by concurrent `each` invocations — which `ordering` alone cannot express,
because the non-determinism lives inside one event rather than across the
event stream.

| Fixture | Keyed to | Exercises |
|---|---|---|
| OG-EX-01 | Example 2 (pagination) | cycle bounded by `each` + `maxIterations`, `buffer` drain, `transform` reduce |
| OG-EX-02 | Example 3 (parallel combine) | `combine` readiness: single-emission conduit sources yield exactly one combined event, no partial |
| OG-EX-03 | Example 6 (fan-out filters) | server-streaming conduit, schema and expression `filter`, per-event `each` handlers (`set`) |
| OG-EX-04 | Edge definition / Dead ends | fire-and-forget: dead-end branch executes but is excluded from output |
| OG-EX-05 | Example 4 (map and collect) | the canonical `map → each` pairing, `buffer` collect; concurrent `each` leaves the collected array's element order implementation-defined (`arrayOrdering: set`) |
| OG-EX-06 | Example 7 (onError fallback) | per-event `each` failure routed to a fallback `transform` (error event carries `event`) |
| OG-EX-07 | Example 8 (fatal per-event error) | `each` failure made fatal: `onError` to `exit` with `error: true` |
| OG-EX-08 | maxIterations and event lineage | merge node (buffer) on an `each` cycle; element-wise-max lineage keeps `maxIterations` bounding the loop |
| OG-EX-09 | combine | source completion makes `combine` ready; an empty source contributes `null` |
| OG-EX-10 | combine | completion-only readiness emits one all-`null` combined object |
| OG-EX-11 | buffer | `limit` precedence over `until`/`through`; the limit-reaching event is flushed as part of the batch |
| OG-EX-12 | buffer | a no-condition buffer that accumulates zero events emits nothing (not `[]`) on completion |
| OG-EX-13 | Identity law / Example 1 | the trivial wrapper, unary selected binding: one write in, one event out |
| OG-EX-14 | Identity law / consequence 2 | zero writes pipe as a no-input invocation (`whenInputs: []`); nothing is synthesized |
| OG-EX-15 | Identity law / other cardinalities | client-streaming: three writes into one held session, one aggregate out |
| OG-EX-16 | Identity law / consequence 4 | unhandled conduit terminal error terminates the graph with that error (terminal-status parity) |
| OG-EX-17 | operation / Failure | conduit terminal error opted into handling via `onError`; error event has no `event` member |
| OG-EX-18 | operation / Acceptance; back-closure | write rejection at a non-accepting conduit reached through a `transform` (back-closure is non-transitive) |
| OG-EX-19 | back-closure | input's direct consumer goes non-accepting → the boundary refuses the caller's later writes entirely |
| OG-EX-20 | filter / boolean cast | empty-array result casts to false; event dropped |
| OG-EX-21 | filter / boolean cast | all-falsy-member array casts to false; event dropped |
| OG-EX-22 | filter / boolean cast | array with a truthy member casts to true; event passes |
| OG-EX-23 | filter / boolean cast | empty-object result casts to false; event dropped |
| OG-EX-24 | filter / boolean cast | empty-string result casts to false; event dropped |
| OG-EX-25 | filter / Transforms | undefined result fails the node with `TRANSFORM_UNDEFINED`, routed per `onError` with the event attached |
| OG-EX-26 | Identity law / other cardinalities | server-streaming: one write into the held session, a three-event stream out, faithful in-order conduit |
| OG-EX-27 | Identity law / other cardinalities | bidirectional: three writes into one held session, three responses out, multi-in/multi-out conduit fidelity |
| OG-EX-28 | buffer | `until` flush: the matching event is excluded and dropped, then reset and continue; trailing partial flushed at completion |
| OG-EX-29 | buffer | `through` flush: the matching event is included, then reset and continue; accumulation ending on a match leaves no trailing batch |
| OG-EX-30 | buffer | `limit` as a tumbling window of disjoint batches, trailing partial batch flushed at completion |
| OG-EX-31 | exit / Determinism | `exit` with `error:false` emits the event to output (early return) then terminates, discarding in-flight events |
| OG-EX-32 | map / Errors | a defined non-array `map` result fails with `MAP_NOT_ARRAY`, routed per `onError` with the event attached |
| OG-EX-33 | transform / Errors | an undefined `transform` result fails with `TRANSFORM_UNDEFINED` (the table's transform-node case, complementing OG-EX-25) |
| OG-EX-34 | Runtime context | `$input` is undefined for an event merged from disagreeing lineages, so reading it fails the node with `TRANSFORM_UNDEFINED` |

File-to-id mapping: OG-EX-09.json holds OG-EX-09/10, OG-EX-13.json holds
OG-EX-13–16 and OG-EX-26–27 (the identity-law suite), OG-EX-17.json holds
OG-EX-17–19 (the conduit acceptance/error suite), OG-EX-20.json holds
OG-EX-20–25 (the filter boolean-cast suite), OG-EX-28.json holds OG-EX-28–30
(the buffer flush-condition suite), and OG-EX-32.json holds OG-EX-32–33 (the
transform/map failure-identifier suite); every other file holds the single
fixture of its own id.

OG-EX-13 through OG-EX-16 plus OG-EX-26 and OG-EX-27 are the corpus's encoding
of the spec's conformance anchor: the same trivial wrapper graph, exercised
across all five selected-binding cardinalities the identity law's acceptance
criterion names — no-input (OG-EX-14), unary (OG-EX-13), server-streaming
(OG-EX-26), client-streaming (OG-EX-15), and bidirectional (OG-EX-27) — plus
the terminal-error consequence (OG-EX-16). OG-EX-18 and OG-EX-19 pin the two
sides of the input-side closure rule: a built-in between `input` and the
conduit keeps closure caller-owned (so a late write is rejected *inside* the
graph), while a direct conduit consumer back-closes the boundary (so a late
write never enters the graph at all).

## Validation fixtures

`validation/OG-VR.json` covers the well-formedness rules from the format
spec's Validation rules section, keyed by their stable `OG-V-##` identifiers.
Each rule block declares `schemaEnforced`:

- **Schema-enforced** (OG-V-01, -08, -12, -13, -14, -17): the op-graph JSON
  Schema alone rejects violations. The verifier asserts schema rejection on the
  negative cases.
- **Beyond schema** (OG-V-02 through -07, -09, -10, -11, -15, -16): catching
  violations needs a structural validator (node-cardinality, reachability,
  cycle analysis, and edge, `onError`, and operation-key cross-references). The
  negative graphs here are otherwise schema-valid; only the named rule is
  violated.

OG-V-09 (every cycle carries an `each` with `maxIterations`) and OG-V-10
(`operation` conduits must not sit on cycles) both follow data edges *and*
`onError` references; the fixtures include onError-closed cycles for each.
OG-V-11 (operation references resolve in the containing OBI) cannot be judged
from a graph in isolation, so its tests carry an `operations` array listing the
keys the containing OBI declares. OG-V-17 (no `onError` on the boundary nodes)
is schema-enforced via the per-type field whitelists. OG-V-18 (embedded
schemas: 2020-12 object form, pinned `$schema`, no `$vocabulary` anywhere
within) is validator-enforced — the format schema types those positions as
objects but cannot check nested keywords.

## Reference runner

`runners/js/run.mjs` executes every execution fixture and diffs the produced
output stream against `expected`. Because operations are mocked, it needs only a
graph engine, a JSONata evaluator (`jsonata`), and a JSON Schema validator
(`ajv`); it does not depend on any binding-invocation stack.

```
cd runners/js
npm install
node run.mjs
```

The engine is a deterministic, single-threaded drain-to-fixpoint interpreter
implementing the transparency-rewrite semantics:

- Caller `writes` are admitted sequentially, each draining the FIFO event queue
  to quiescence before the next; back-closure refuses remaining writes once
  every direct consumer of the `input` node is non-accepting.
- An `operation` node holds one invocation: arriving events are written in
  order; `closesAfter` completes it mid-stream (later events become
  write-rejection error events); otherwise it completes at input completion.
  An unhandled `fail` terminates the run with `{ error }` as the error detail.
- An `each` node opens a single-write invocation per event, bounded per lineage
  by `maxIterations`.
- `$input` is the lineage root: merged events (buffer flush, combine emission,
  multi-write conduit responses) keep `$input` only when all contributors share
  one root.
- At end of stream, stateful nodes (conduits, buffers, combines) complete in
  dependency order: a node completes only once no other live stateful node can
  still reach it, so upstream responses land before downstream flushes.

`ordering: exact` fixtures are compared in order; `ordering: set` fixtures are
compared as a multiset, and `arrayOrdering: set` compares an array-valued output
event as a multiset too, matching the spec's determinism contract. The CI runs
the runner on every push.

This is a *reference* oracle: it and the fixtures are maintained together, so it
confirms the fixtures are self-consistent and reproduce the spec's stated
execution traces. Running an independent implementation (an SDK's operation-graph
engine) against the same corpus is the stronger cross-implementation check and is
the natural next step; the corpus is designed to be consumed unmodified.

### Adversarial scheduling (`--adversarial`)

The default run is a single deterministic FIFO drain. It is fast but has a blind
spot: it produces exactly one of the many legal event orderings, so a fixture
that pins an outcome the spec leaves *implementation-defined* (a concurrent-`each`
collection order, a cross-path race) still passes. The labels that mark those
cases (`ordering: set`, `arrayOrdering: set`) are then only as trustworthy as the
author's judgement.

`node run.mjs --adversarial` closes that gap. For each fixture it runs many
seeded trials, and on each trial the scheduler chooses uniformly at random among
the legal next actions:

- deliver any queued event that is the **head of its `(from, to)` edge**, so
  per-edge order is preserved (the spec's per-edge guarantee) while cross-edge
  interleaving is free; and
- settle any **pending `each` invocation**, since invocations run concurrently
  and their completion order is implementation-defined. Sequentially-produced
  invocations (a pagination cycle) are never pending together and stay ordered;
  concurrently-dispatched ones (one `map` fanning into an `each`) race.

Every trial must still satisfy the fixture's declared `ordering`/`arrayOrdering`.
A fixture labeled stricter than its graph actually guarantees fails, printing a
seed that reproduces the offending interleaving:

```
node run.mjs --adversarial                              # 64 trials/fixture
node run.mjs --adversarial --trials=256                 # more interleavings
node run.mjs --adversarial --seed=2027808460 --trials=1 # reproduce one
```

This turns the portability labels from author-asserted into machine-verified and
is the regression guard against the next mislabel; running it as a second CI step
(alongside the default run) is recommended. `OG_EXEC_DIR` points the runner at an
alternate corpus directory. Scope: it randomizes event interleaving and
`each`-completion order, not end-of-stream stateful-node completion order, and it
treats an `each` invocation's outputs as a unit (it does not yet reorder within a
single multi-emit invocation's output stream; no current fixture has one).
