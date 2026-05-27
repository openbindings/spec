# openbindings.operation-graph conformance subcorpus

Fixtures for the `openbindings.operation-graph` binding format, keyed to its
companion specification at
[`formats/operation-graph/openbindings.operation-graph.md`](../../formats/operation-graph/openbindings.operation-graph.md).

This is a per-format subcorpus, governed by the operation-graph format spec, not
by the core OBI-D / OBI-T conformance rules. It lives alongside the core corpus
the same way `comparison/` does: the core verifiers (`verify-corpus.mjs`,
`generate-conformance-manifest.mjs`) only scan `document/` and `tool/`, so they
neither pick up nor are broken by this directory. The dedicated verifier is
`scripts/verify-operation-graph.mjs`.

## Layout

```
operation-graph/
  README.md             (this file)
  execution.schema.json (fixture-file shape for execution fixtures)
  validation.schema.json(fixture-file shape for validation fixtures)
  execution/            (replayable graph executions; one file per spec example)
    OG-EX-01.json ... OG-EX-07.json
  validation/           (well-formedness rules; OG-VR.json)
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
   schema.

The verifier does not execute graphs; it pins their shape and their declared
expected outputs. A reference execution runner that replays the execution
fixtures and diffs the output stream is a follow-up (see "Runner contract"
below); the fixtures are designed so one can consume them without modification.

## Execution fixtures

Each execution fixture corresponds to one normative example in the format spec.
A fixture supplies:

- `graph` — the operation graph definition under test.
- `operations` — mocked behavior for each operation an `operation` node invokes.
  Each operation has an ordered list of `responses`; the first whose `whenInput`
  deep-equals the node's input event (or whose `whenInput` is absent, a
  wildcard) applies, emitting `emit` events or failing with `fail`.
- `input` — the event handed to the `input` node.
- `expected` — the expected `output` events, an `ordering` of `exact` or `set`,
  and for fatal-exit cases `error: true` with the `errorDetail` event.

`ordering: set` is used where the graph has concurrent paths whose interleaving
is implementation-defined (see the spec's "Determinism and portability"
section); the runner compares the output as a multiset in that case.

| Fixture | Example | Exercises |
|---|---|---|
| OG-EX-01 | Pagination aggregation | cycle with `maxIterations`, `buffer` drain, `transform` reduce |
| OG-EX-02 | Parallel combine | `combine` readiness: single-emission sources yield exactly one combined event, no partial |
| OG-EX-03 | Streaming fan-out with filters | streaming op, schema and expression `filter`, fan-out to two handlers (`set`) |
| OG-EX-04 | Fire-and-forget side effect | dead-end branch excluded from output |
| OG-EX-05 | Map and collect | `map` unpack, per-element invocation, `buffer` collect |
| OG-EX-06 | Error handling with `onError` | operation failure routed to a fallback `transform` |
| OG-EX-07 | Fatal error with `exit` | `onError` to `exit` with `error: true`, fatal termination |

OG-EX-02 is the fixture that pins the corrected `combine` semantics: because
`customer` and `orders` each emit exactly once, `combine` waits until both are
ready and emits a single joined object, with no intermediate `null`-bearing
partial.

## Validation fixtures

`validation/OG-VR.json` covers the numbered well-formedness rules from the
format spec's Validation rules section. Each rule block declares
`schemaEnforced`:

- **Schema-enforced** (rules 1, 8, 11, 12, 13): the op-graph JSON Schema alone
  rejects violations. The verifier asserts schema rejection on the negative
  cases.
- **Beyond schema** (rules 2-7, 9, 14, 15): catching violations needs a
  structural validator (node-cardinality, reachability, cycle analysis,
  edge and `onError` cross-references). The negative graphs here are otherwise
  schema-valid; only the named rule is violated.

Rule 10 (operation nodes reference operations that exist in the containing OBI's
`operations` map) is intentionally not covered here: it can only be evaluated
against a containing OBI document, not against a graph in isolation, so it
belongs to OBI-level validation rather than this graph-shape corpus.

Rule 13's unsupported-node-type clause is SHOULD-level ("tools SHOULD report an
error" for an unknown `type`), not a validity failure, so an unknown node type
is schema-valid and is not represented as a negative case. Only the MUST part
(every node has a `type`) is fixtured.

## Runner contract (for a future reference runner)

A runner that executes these fixtures should, for each execution fixture:

1. Load `graph`, validate it against the op-graph schema, and bind its
   `operation` nodes to the mocked `operations` (matching `whenInput`, emitting
   `emit`, or failing with `fail`).
2. Run the graph with `input`.
3. Compare the produced output stream to `expected.output` using
   `expected.ordering`, and, when `expected.error` is true, assert fatal
   termination with `expected.errorDetail`.

Because operation responses are mocked, a runner needs only the graph engine
under test, not live services.
