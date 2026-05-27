# `openbindings.operation-graph` Format Specification (v0.2.0)

**Status**: Working draft, targeting release alongside OpenBindings v0.2.0. Not yet tagged or snapshotted.

This document defines the `openbindings.operation-graph` binding source format. It is a companion specification to the [OpenBindings Specification v0.2.0](../../openbindings.md) and depends on concepts defined there (operations, sources, bindings, transforms).

This format is versioned independently via its format token (`openbindings.operation-graph@<version>`).

- This document is licensed under the Apache 2.0 License (see `LICENSE`).
- The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in all capitals.

## Table of contents

- [Overview](#overview)
- [Format identifier](#format-identifier)
- [Source documents](#source-documents)
- [Binding `ref` syntax](#binding-ref-syntax)
- [Operation graph definition](#operation-graph-definition)
- [Node definitions](#node-definitions) (`input`, `output`, `operation`, `buffer`, `filter`, `transform`, `map`, `combine`, `exit`)
- [Edge definition](#edge-definition)
- [Execution algorithm](#execution-algorithm)
- [Determinism and portability](#determinism-and-portability)
- [Runtime context](#runtime-context)
- [Validation rules](#validation-rules)
- [Normative examples](#normative-examples)
- [Security considerations](#security-considerations)
- [Deferred from v1](#deferred-from-v1)

---

## Overview

An operation graph is a **binding**. It defines how to fulfill an operation's contract by orchestrating other operations as a directed graph of typed nodes connected by edges. The `openbindings.operation-graph` format is maintained by the OpenBindings project, as indicated by the `openbindings.` prefix.

Operation graphs are streaming operations. Each event is processed independently as it arrives at each node: an event enters at an input node, passes through operation, filter, transform, map, buffer, combine, and exit nodes as determined by the edges, and exits at an output node. An operation graph's output is itself a stream — the sequence of all events that reach the output node.

The graph has two structural primitives:

- **Nodes** define _what_ happens. Each node has a `type` that determines its behavior. Nodes do not contain routing logic.
- **Edges** define _how data flows_. Each edge is a simple wire connecting one node's output to another node's input. Edges carry no logic, conditions, or transforms.

This separation keeps each primitive focused: nodes are processors, edges are plumbing.

## Format identifier

The format token for this specification is:

```
openbindings.operation-graph@0.2.0
```

This token is used in the `format` field of an OpenBindings `sources` entry:

```json
{
  "sources": {
    "myGraph": {
      "format": "openbindings.operation-graph@0.2.0",
      "content": { ... }
    }
  }
}
```

The `openbindings.` prefix indicates formats governed by the OpenBindings project. Third-party formats SHOULD use their own prefix to avoid misrepresenting governance.

## Source documents

The addressable unit of this binding format is the [Operation graph definition](#operation-graph-definition), not the JSON document that contains it. An operation graph source document is therefore any JSON document containing at least one operation graph definition addressable by JSON Pointer. The shape of the surrounding document is unconstrained.

A single document MAY contain multiple operation graphs, including graphs declaring different versions of this format. Each graph carries its own version field (see [Operation graph definition](#operation-graph-definition)); the document itself has no version field.

### Conventional shape (non-normative)

For files whose primary purpose is to hold operation graphs, the RECOMMENDED top-level shape is a `graphs` map keyed by graph name:

```json
{
  "graphs": {
    "paginateAll": {
      "openbindings.operation-graph": "0.2.0",
      "nodes": { ... },
      "edges": [ ... ]
    }
  }
}
```

This is a convention, not a requirement. Tools MUST NOT reject documents that do not match it. A document whose root is itself a graph definition is also valid; so is a graph embedded at any other JSON Pointer location within an arbitrary host document.

## Binding `ref` syntax

A binding whose `source` references an `openbindings.operation-graph` document MUST address its target operation graph using a [JSON Pointer (RFC 6901)](https://www.rfc-editor.org/rfc/rfc6901) fragment.

The Pointer is evaluated against the operation graph source document. The resolved value MUST be a valid [Operation graph definition](#operation-graph-definition). The empty Pointer (`""`) is permitted and resolves to the whole document, so a document whose root is a graph definition is addressable without naming.

Example:

```json
{
  "bindings": {
    "items.listAll.pagination": {
      "operation": "items.listAll",
      "source": "pagination",
      "ref": "#/graphs/paginateAll"
    }
  }
}
```

The leading `#` is part of the syntax; it denotes a fragment identifier per RFC 3986. Tools that resolve `ref` MUST treat the value as a JSON Pointer and MUST NOT accept bare graph keys (e.g., `"paginateAll"`) as shorthand.

A `ref` that does not resolve, or whose resolved value is not a valid operation graph definition, is a binding error; tools acting on the binding (Codegen, Invoking) MUST surface it.

`ref` is REQUIRED on bindings using this format. To target a graph at the document root, use the empty Pointer `""`. This format does not define a "whole document" interpretation for an absent `ref`.

## Operation graph definition

An operation graph is the addressable unit of this binding format. It is a JSON object with the following shape:

```json
{
  "openbindings.operation-graph": "0.2.0",
  "description": "Processes items and returns the result.",
  "nodes": {
    "in": { "type": "input" },
    "process": { "type": "operation", "operation": "items.process" },
    "out": { "type": "output" }
  },
  "edges": [
    { "from": "in", "to": "process" },
    { "from": "process", "to": "out" }
  ]
}
```

- `openbindings.operation-graph` (REQUIRED, string): the version of this format the graph was authored against. MUST match the SemVer 2.0.0 pattern. Tools MUST refuse graphs declaring a higher minor version while pre-1.0, per the core spec's OBI-T-04. Each graph in a document declares its own version independently.
- `description` (OPTIONAL, string): a human-readable description of what the operation graph does.
- `nodes` (REQUIRED): a map of named nodes. Each key is a node identifier matching `^[A-Za-z_][A-Za-z0-9_.-]*$`; each value is a [Node](#node-definitions). Node keys MUST be unique within the operation graph (enforced by JSON object semantics).
- `edges` (REQUIRED): an array of [Edge](#edge-definition) objects defining the connections between nodes.

There is no explicit `entry` field. The entry point is the `input` node (identified by `"type": "input"`), and the exit point is the `output` node (identified by `"type": "output"`). See [Validation rules](#validation-rules) for structural constraints.

## Node definitions

Every node is a JSON object with a REQUIRED `type` field that determines the node's behavior. The `type` field is the discriminator: it determines which other fields are valid on the node.

All nodes support the following optional field:

- `onError` (OPTIONAL, string): the key of a node to route error events to if this node fails. When a node fails during event processing, an error event is sent to the named node. If `onError` is not set, the error event is dropped and does not propagate further. The error event shape is:

```json
{
  "error": "timeout_exceeded",
  "input": { "filter": "active", "cursor": "pg2" }
}
```

- `error` (string): the error message or error type.
- `input` (any): the event that was being processed when the failure occurred.

Errors are silent by default. Operation graphs often process many events (e.g., fetching details for 100 items), and one transient failure should not kill the entire stream. Authors who want errors handled wire `onError` to a transform for fallback values, to an operation for logging, or to an `exit` node with `error: true` to make failures fatal. The graph author is always in control of error policy.

This specification defines the node types below. Documents MAY use other `type` values for custom node types, but tooling is only required to support the types defined here. Custom node types are not portable across implementations.

### `input`

```json
{ "type": "input" }
```

The operation graph's entry point. The operation graph's input (provided by the caller) enters the graph at this node and flows to all downstream nodes connected by edges. An operation graph MUST have exactly one `input` node. The `input` node MUST NOT have any incoming edges.

### `output`

```json
{ "type": "output" }
```

The operation graph's output sink. Every event that reaches this node is emitted as an operation graph output event. An operation graph MUST have exactly one `output` node. The `output` node MUST NOT have any outgoing edges.

### `operation`

```json
{
  "type": "operation",
  "operation": "items.fetchPage",
  "maxIterations": 100,
  "timeout": 30000
}
```

Invokes an operation defined in the containing OBI's `operations` map.

- `operation` (REQUIRED, string): the operation key to invoke.
- `maxIterations` (OPTIONAL, integer >= 1): the maximum number of times this node may be invoked per event lineage. REQUIRED if the node is reachable from itself (part of a cycle). See [Execution algorithm](#execution-algorithm).
- `timeout` (OPTIONAL, integer >= 1): maximum time in milliseconds to wait for the operation to complete. If the operation does not complete within this time, the invocation fails with `timeout_exceeded`.

When an event arrives at an operation node, the event becomes the operation's input. The operation is invoked, and its output events flow downstream independently. If the operation produces multiple output events (streaming), each event flows through the graph on its own.

### `buffer`

```json
{ "type": "buffer", "limit": 10 }
```

Accumulates incoming events into a batch. When the buffer's condition is met (or all upstream edges complete), it emits the accumulated events as an array downstream.

- `limit` (OPTIONAL, integer >= 1): flush after accumulating this many events. The buffer resets and begins accumulating again (windowing). "No more than N" — if upstream completes before the limit is reached, the partial batch is flushed.
- `until` (OPTIONAL, JSON Schema): flush when an event matches this schema. The matching event is **not** included in the batch and is dropped (it does not flow downstream or remain in the buffer). The buffer resets and continues accumulating. Mutually exclusive with `through`.
- `through` (OPTIONAL, JSON Schema): flush when an event matches this schema. The matching event **is** included in the batch (inclusive). The buffer resets and continues accumulating. Mutually exclusive with `until`.

If no conditions are specified (`{ "type": "buffer" }`), the buffer drains all upstream events and flushes once when all incoming edges complete.

When `limit` is specified, the buffer operates as a sliding window: it flushes every N events, resets, and continues accumulating. When all upstream edges complete, any remaining partial batch is flushed regardless of whether the limit was reached.

The buffer's output is always an array of the accumulated events.

### `filter`

A filter gates events. Events that pass the gate flow downstream; events that fail are dropped.

Two mechanisms are available (mutually exclusive):

**Schema-based filter:**

```json
{
  "type": "filter",
  "schema": { "required": ["nextCursor"] }
}
```

- `schema` (object): a [JSON Schema 2020-12](../../openbindings.md#62-schemas) object. The event is validated against it. If the event validates, it passes; otherwise it is dropped.

**Expression-based filter:**

```json
{
  "type": "filter",
  "transform": "role = $input.requiredRole"
}
```

- `transform` (string): a [Transform](#transforms) expression string as defined in this document. The expression is evaluated with the event as `$` and the operation graph's original input as `$input`. If the expression evaluates to a truthy value, the event passes; otherwise it is dropped.

A filter MUST have exactly one of `schema` or `transform`.

### `transform`

```json
{
  "type": "transform",
  "transform": "{ \"filter\": $input.filter, \"cursor\": nextCursor }"
}
```

Reshapes events using a transform expression.

- `transform` (REQUIRED, string): a [Transform](#transforms) expression string as defined in this document. The expression is evaluated with the incoming event as `$` and the operation graph's original input as `$input`. The expression's result replaces the event and flows downstream.

### `map`

```json
{
  "type": "map",
  "transform": "items"
}
```

Unpacks an array into individual events. The transform expression is evaluated against the incoming event and MUST produce an array. Each element of the array is emitted as a separate event downstream.

- `transform` (REQUIRED, string): a [Transform](#transforms) expression string as defined in this document. The expression is evaluated with the incoming event as `$` and the operation graph's original input as `$input`. The result MUST be an array; if it is not, the node fails with `map_not_array`.

This enables patterns like "fetch a list of IDs, then process each one":

```json
{
  "nodes": {
    "in": { "type": "input" },
    "listIds": { "type": "operation", "operation": "items.list" },
    "unpack": { "type": "map", "transform": "ids" },
    "fetchDetail": { "type": "operation", "operation": "items.get" },
    "collect": { "type": "buffer" },
    "out": { "type": "output" }
  },
  "edges": [
    { "from": "in", "to": "listIds" },
    { "from": "listIds", "to": "unpack" },
    { "from": "unpack", "to": "fetchDetail" },
    { "from": "fetchDetail", "to": "collect" },
    { "from": "collect", "to": "out" }
  ]
}
```

### `combine`

```json
{ "type": "combine" }
```

Joins multiple incoming sources by pairing the latest event from each into a keyed object. The keys are the names of the source nodes (determined from incoming edges); the values are the most recent event received from each source.

A combine node is **ready** once every incoming source has either produced at least one event or completed. It emits nothing before it is ready. Once ready, it emits a combined object, and after that it emits again every time any still-active source produces a new event (carrying that source's new value alongside the latest value held for every other source).

- While not ready, the node accumulates the latest event from each source silently, emitting nothing.
- A source that completes without ever producing an event contributes `null` for its key. A source that has produced at least one event always contributes its latest event, so before readiness a key is `null` only for a source that has completed empty.
- If a source produces multiple events, the latest event replaces the previous one for that source.
- The combine node completes when all incoming sources have completed.

Waiting for readiness is what makes `combine` a parallel join: two sources that each emit once produce exactly one combined emission rather than a sequence of partial objects. Emitting a partial object early, before every source is ready, is out of scope for this version (see [Deferred from v1](#deferred-from-v1)).

### `exit`

```json
{ "type": "exit" }
```

```json
{ "type": "exit", "error": true }
```

Terminates the operation graph immediately when an event reaches this node. All in-flight events are cancelled.

- `error` (OPTIONAL, boolean, default `false`): if `false`, the event is emitted to the operation graph's output stream before the operation graph terminates (early return). If `true`, the operation graph terminates with an error; the event becomes the error detail and is not emitted to the output stream. In both cases, any events previously emitted to the `output` node are not retracted. Any in-flight events, including partial buffer contents, are discarded.

The `exit` node MUST NOT have any outgoing edges.

Use cases:

- **Early return**: wire a filter's output to `exit` to stop the operation graph when a condition is met, returning the matching event as the final output.
- **Fatal error**: wire `onError` to `exit` with `error: true` to make a node's failure terminate the operation graph.

### Transforms

Wherever a node embeds a dynamic expression, the value is a plain JSONata 2.0 expression string. Tools claiming `openbindings.operation-graph@0.2.0` conformance MUST support JSONata 2.0 transforms.

```json
"{ \"filter\": $input.filter, \"cursor\": nextCursor }"
```

This follows the [core specification v0.2.0 Transforms section](../../openbindings.md#65-transforms), which defines transforms as plain expression strings.

If a transform expression evaluates to `undefined` (no result), the node fails. If it evaluates to `null`, the event becomes `null` and flows downstream normally. This applies to all nodes that use transforms (`transform`, `map`, `filter`).

## Edge definition

An edge connects one node's output to another node's input:

```json
{ "from": "fetchPage", "to": "collectPages" }
```

- `from` (REQUIRED, string): the key of the source node.
- `to` (REQUIRED, string): the key of the target node.

Edges carry no logic — no conditions, no transforms, no priorities. They are simple wires.

**Fan-out**: when a node has multiple outgoing edges, every event the node produces is sent to ALL downstream targets. This is the operation graph's branching mechanism — combined with filter nodes, it enables conditional routing.

**Fan-in**: when multiple edges target the same node, events from all sources merge into that node. For most node types, merged events are processed independently in arrival order. For `buffer` nodes, merged events are accumulated together. For `combine` nodes, each event updates the latest value held for its source; once the node is ready (every source has produced an event or completed), each such update triggers a new combined emission.

**Ordering**: a `map` node emits elements in array order. Within a single edge, events are delivered in the order they are produced. Across concurrent paths (for example, two fan-out branches that reconverge), event ordering is implementation-defined; see [Determinism and portability](#determinism-and-portability) for the full portability contract.

## Execution algorithm

Given an operation graph with input node `IN`, output node `OUT`, and composite operation input `I`:

1. **Start**: emit `I` as the initial event at `IN`. The event flows along all edges from `IN`.

2. **Per-event processing**: when an event arrives at a node, the node processes it according to its type:
   - **`operation`**: invoke the operation with the event as input. Each output event from the operation flows downstream independently. If the node has `maxIterations` and this event lineage has already traversed this node that many times, the event is dropped (it does not propagate further). This is not an operation graph failure; the graph continues processing any other in-flight events normally.

   - **`buffer`**: add the event to the buffer's accumulator. Check the buffer's conditions:
     - If `limit` is set and the accumulator has reached the limit, flush: emit the accumulated array downstream, reset the accumulator.
     - If `until` is set and the event validates against the schema, flush the accumulator (excluding this event), drop the triggering event, reset.
     - If `through` is set and the event validates against the schema, flush the accumulator (including this event), reset.
     - Otherwise, continue accumulating.

   - **`filter`**: evaluate the event against the filter's `schema` or `transform` expression. If it passes, the event flows downstream. If it fails, the event is dropped (does not propagate further along this path).

   - **`transform`**: evaluate the transform expression with the event as `$` and `$input` as the operation graph input. The result replaces the event and flows downstream.

   - **`map`**: evaluate the transform expression with the event as `$` and `$input` as the operation graph input. The result MUST be an array. Each element of the array is emitted as a separate event downstream. If the result is not an array, the node fails with `map_not_array`.

   - **`combine`**: record the event as the latest value for its source node. If the node is not yet ready (some incoming source has neither produced an event nor completed), emit nothing. Once ready, emit a combined object `{ "<sourceNodeName>": <latestEvent>, ... }` downstream, using each source's latest event (or `null` for a source that completed without ever producing one). After the node becomes ready, every subsequent event from any active source triggers a new combined emission.

   - **`exit`**: terminate the operation graph immediately. If `error` is `false` (default), emit the event to the operation graph's output stream, then cancel all in-flight events and operation invocations. If `error` is `true`, the operation graph terminates with an error; the event is the error detail.

   - **`output`**: emit the event as an operation graph output event.

3. **Fan-out**: after a node produces output event(s), each event is sent along every outgoing edge to the connected target nodes.

4. **Stream completion propagation**: when a node has processed all incoming events and will produce no more output, its output stream is complete. Completion propagates along edges:
   - A `buffer` with no conditions flushes its contents when all incoming edges are complete.
   - A `buffer` with `limit` flushes any remaining partial batch when all incoming edges are complete.
   - A `combine` node becomes ready once every incoming source has produced at least one event or completed; it completes once all incoming sources have completed. A source that completed without ever producing an event contributes `null` for its key in every emission.
   - A node's output is complete when the node itself is complete and all its output events have been delivered.

5. **Operation graph completion**: the operation graph is complete when either (a) an `exit` node is reached, which terminates the operation graph immediately, or (b) all events have finished flowing through the graph — they have reached the output node, reached a dead end, or been dropped by filters — and no events are in-flight. *Note (non-normative): in cyclic graphs, a cycle completes when all events within it have been dropped by filters or reached nodes outside the cycle, and no new events are entering the cycle. The mechanism for detecting this (reference counting, liveness tracking, drain detection, etc.) is implementation-defined.*

6. **Cancellation**: if the caller cancels the operation graph (e.g., via an abort signal) or an `exit` node is reached, cancellation propagates to all active operation invocations. Buffer nodes discard accumulated contents without flushing. Combine nodes discard latest values without emitting. All pending operations are cancelled.

7. **Errors**: when a node fails (operation failure, `timeout_exceeded`, `map_not_array`, or any other node-level error), the failing event does not propagate along the node's normal outgoing edges. If the node has `onError` set, an error event (`{ "error": "<message>", "input": <eventBeingProcessed> }`) is routed to the named node. If `onError` is not set, the error event is dropped. In both cases, other in-flight events in the graph continue processing normally. To make errors fatal, wire `onError` to an `exit` node with `error: true`.

### `maxIterations` and event lineage

`maxIterations` protects against infinite loops in cyclic graphs. The counter is tracked **per event lineage**: each original event entering a cycle maintains its own independent iteration count. If an event fans out, each copy carries its own counter for each node. When the count for a given node exceeds `maxIterations`, that event is dropped. Other events in the graph are unaffected. This is a safety bound, not an error condition.

**Lineage through every node kind.** Each event carries, as part of its lineage, a traversal count for each `operation` node. The counts propagate node by node:

- An event originating at the `input` node starts with every count at zero.
- An `operation` node increments its own count for the event it processes, then emits the operation's output event(s); each output event inherits the incremented counts. A node with `maxIterations` drops the event rather than processing it once its count would exceed the limit.
- `filter` and `transform` pass the counts of their input event through to their single output event unchanged. A filtered-out event propagates nothing.
- `map` gives every element event it emits the counts of the single input event it unpacked. A `map` inside a cycle therefore copies the input's counts onto each element, which is the amplification described under [Security considerations](#security-considerations).
- A node that merges several events into one output (`buffer` on flush, `combine` on emit) gives the merged output event, for each node, the maximum of that node's count among all events combined into it. Taking the maximum guarantees that a merge never lowers a count, so a merge cannot be used to escape a `maxIterations` bound on a cycle that passes through it.

Because counts only increase along a path and merges take the maximum, every cycle that contains an `operation` node with `maxIterations` (required by validation rule 9) is bounded no matter which buffer, combine, or map nodes also lie on the cycle.

## Determinism and portability

An operation graph's output is the set of events that reach the `output` node, together with any event emitted by an `exit` node with `error: false`. This section states which aspects of that output are portable across conforming implementations and which are not, so authors know what they can rely on.

These guarantees concern the graph engine given fixed node behavior. An operation or transform that is itself non-deterministic propagates that non-determinism to the output: per the [core specification's Transforms section](../../openbindings.md#65-transforms), JSONata primitives such as `$now()` and `$random()` MAY yield different results across calls and across tools, and operations are arbitrary invocations whose results need not be reproducible. The ordering guarantees below always hold; the value-level guarantees (element-node evaluation, output multiset) hold only insofar as the nodes they cover are deterministic.

Portable behavior (every conforming implementation MUST honor it):

- **Per-edge order.** Events delivered along a single edge preserve the order in which the source node produced them.
- **`map` order.** A `map` node emits the elements of its array in array order.
- **Element-node evaluation.** For a deterministic expression, the result of a `filter`, `transform`, or `map` is a function of the incoming event and `$input` alone; the same input event yields the same result.
- **The output multiset.** Given deterministic operations and transform expressions, and a graph in which every node receives its events in a fixed order, the multiset of output events is determined by the graph and its input. A graph whose only concurrency is `combine` nodes fed by single-emission sources (the common parallel-join case) therefore has a fully determined output.
- **Eventual completion.** A graph that the [Execution algorithm](#execution-algorithm) says completes will complete under every conforming implementation. Completion is determined by the data, not by timing.

Implementation-defined behavior (conforming implementations MAY differ):

- **Interleaving across concurrent paths.** When two paths from a fan-out reconverge at a fan-in node, the relative arrival order of their events is not specified.
- **`combine` emission count and content for multi-emission sources.** Because `combine` emits on each event from a ready source, the number and contents of its emissions depend on cross-path interleaving whenever a source emits more than once. Sources that each emit exactly once yield exactly one combined emission.
- **Order within a flushed `buffer`.** A `buffer` fed by concurrent paths flushes the same multiset of events under every implementation, but the order of elements within the flushed array is not specified.
- **The mechanism and timing of completion detection.** How an implementation detects that a cycle has drained (reference counting, liveness tracking, drain detection, and so on) is its own concern; only the eventual result is portable.
- **Output-event order along concurrent paths.** When output events are produced by concurrent paths, their order in the output stream follows the implementation's interleaving.

Authors who need a byte-stable output order across all implementations should funnel results through a single path before `output`: for example, collect into a `buffer` and sort within a `transform`, or drive a `combine` only with single-emission sources.

## Runtime context

During execution, transform and filter expressions have access to a runtime context:

- `$` — the current event being processed. This is the incoming event at the node.
- `$input` — the operation graph's original input (the value provided by the caller). This is immutable and available at every node.

There is no accumulated state (`$steps` or similar). Events carry their own data through the graph. If a downstream node needs data from an upstream node's output, the data must flow through the edges — either directly as the event, or via a transform node that reshapes the event to include the needed context.

## Validation rules

Implementations MUST enforce the following well-formedness rules on each operation graph definition (the value at which a binding's `ref` resolves):

1. The operation graph MUST declare an `openbindings.operation-graph` field whose value matches the SemVer 2.0.0 pattern.
2. The operation graph MUST contain exactly one node with `"type": "input"`.
3. The operation graph MUST contain exactly one node with `"type": "output"`.
4. The `input` node MUST NOT be the target of any edge (no incoming edges).
5. The `output` node MUST NOT be the source of any edge (no outgoing edges).
6. Every node MUST be reachable from the `input` node by transitively following edges and `onError` references (no orphan nodes).
7. Every edge MUST reference valid node keys in both `from` and `to`.
8. There MUST NOT be duplicate edges (same `from` and `to` pair).
9. Every cycle in the graph MUST contain at least one `operation` node with `maxIterations` declared.
10. `operation` nodes MUST reference operations that exist in the containing OBI's `operations` map.
11. `filter` nodes MUST have exactly one of `schema` or `transform` (mutual exclusivity).
12. `buffer` nodes MUST NOT have both `until` and `through` (mutual exclusivity).
13. Every node MUST have a `type` field. Tools MUST support the node types defined in this specification (`input`, `output`, `operation`, `buffer`, `filter`, `transform`, `map`, `combine`, `exit`). Documents MAY use other `type` values; tools that encounter an unsupported node type SHOULD report an error.
14. If a node declares `onError`, the referenced node key MUST exist in the operation graph.
15. `exit` nodes MUST NOT have any outgoing edges.

These rules apply to the operation graph definition itself. The enclosing JSON document has no specified shape and is not subject to validation by this specification.

## Extensions

Operation graph definitions follow the same extension convention as the [core OpenBindings specification v0.2.0](../../openbindings.md#17-extensions):

- Operation graph definitions MAY include extension fields whose keys begin with `x-` at any object location within the graph (on the graph itself, on nodes, on edges).
- Tools MUST ignore `x-` fields they do not understand.
- `x-` fields MUST NOT change the meaning of any defined operation graph field for purposes of validation, execution, or compatibility.

The shape of the enclosing JSON document is unconstrained by this specification, so any extension scheme applied outside the graph definition is the host document's concern, not this format's.

## Normative examples

### Example 1: Pagination aggregation

This example fetches pages of results in a cycle until no more pages exist, collects all page results, and returns the aggregated items.

#### OBI document (abbreviated)

```json
{
  "openbindings": "0.2.0",
  "operations": {
    "items.listAll": {
      "description": "Fetch all items across all pages.",
      "input": { "type": "object", "properties": { "filter": { "type": "string" } } },
      "output": {
        "type": "object",
        "properties": { "items": { "type": "array" } },
        "required": ["items"]
      }
    },
    "items.fetchPage": {
      "input": {
        "type": "object",
        "properties": {
          "filter": { "type": "string" },
          "cursor": { "type": "string" }
        }
      },
      "output": {
        "type": "object",
        "properties": {
          "items": { "type": "array" },
          "nextCursor": { "type": "string" }
        },
        "required": ["items"]
      }
    }
  },
  "sources": {
    "pagination": {
      "format": "openbindings.operation-graph@0.2.0",
      "location": "./pagination.operation-graph.json",
      "description": "Operation graph source — full content shown in the next code block"
    }
  },
  "bindings": {
    "items.listAll.pagination": {
      "operation": "items.listAll",
      "source": "pagination",
      "ref": "#/graphs/paginateAll"
    }
  }
}
```

#### Operation graph source

```json
{
  "graphs": {
    "paginateAll": {
      "openbindings.operation-graph": "0.2.0",
      "nodes": {
        "in": { "type": "input" },
        "fetchPage": {
          "type": "operation",
          "operation": "items.fetchPage",
          "maxIterations": 100
        },
        "hasMore": {
          "type": "filter",
          "schema": { "required": ["nextCursor"] }
        },
        "prepareCursor": {
          "type": "transform",
          "transform": "{ \"filter\": $input.filter, \"cursor\": nextCursor }"
        },
        "collectPages": { "type": "buffer" },
        "aggregate": {
          "type": "transform",
          "transform": "{ \"items\": $reduce($, function($a, $v){ $append($a, $v.items) }, []) }"
        },
        "out": { "type": "output" }
      },
      "edges": [
        { "from": "in", "to": "fetchPage" },
        { "from": "fetchPage", "to": "collectPages" },
        { "from": "fetchPage", "to": "hasMore" },
        { "from": "hasMore", "to": "prepareCursor" },
        { "from": "prepareCursor", "to": "fetchPage" },
        { "from": "collectPages", "to": "aggregate" },
        { "from": "aggregate", "to": "out" }
      ]
    }
  }
}
```

#### Execution trace

1. **Event `{ "filter": "active" }` enters at `in`**, flows to `fetchPage`.
2. **`fetchPage`** invokes `items.fetchPage` with `{ "filter": "active" }`. Returns `{ "items": ["a","b"], "nextCursor": "pg2" }`.
3. **Fan-out**: the result event flows to both `collectPages` and `hasMore`.
4. **`collectPages`** buffers the event (no conditions — will drain all).
5. **`hasMore`** validates: event has `nextCursor` → passes. Event flows to `prepareCursor`.
6. **`prepareCursor`** transforms: `{ "filter": "active", "cursor": "pg2" }`. Flows to `fetchPage`.
7. **`fetchPage` (iteration 2)** invokes with cursor. Returns `{ "items": ["c"] }` (no `nextCursor`).
8. **Fan-out**: result flows to `collectPages` and `hasMore`.
9. **`collectPages`** buffers the second event.
10. **`hasMore`** validates: no `nextCursor` → event is dropped. Nothing flows to `prepareCursor`. The cycle stops.
11. **Completion propagates**: `hasMore` is complete → `prepareCursor` has no more input → `fetchPage` has no more input → `fetchPage` output is complete → `collectPages` incoming edges are complete → buffer flushes `[{ "items": ["a","b"], "nextCursor": "pg2" }, { "items": ["c"] }]`.
12. **`aggregate`** transforms the array: `{ "items": ["a", "b", "c"] }`.
13. **`out`** emits: `{ "items": ["a", "b", "c"] }`.

### Example 2: Parallel combine

This example calls two operations concurrently and combines their results.

```json
{
  "graphs": {
    "enrichOrder": {
      "openbindings.operation-graph": "0.2.0",
      "nodes": {
        "in": { "type": "input" },
        "customer": { "type": "operation", "operation": "customers.get" },
        "orders": { "type": "operation", "operation": "orders.list" },
        "combined": { "type": "combine" },
        "out": { "type": "output" }
      },
      "edges": [
        { "from": "in", "to": "customer" },
        { "from": "in", "to": "orders" },
        { "from": "customer", "to": "combined" },
        { "from": "orders", "to": "combined" },
        { "from": "combined", "to": "out" }
      ]
    }
  }
}
```

**Execution**: the input event fans out to both `customer` and `orders`, which execute concurrently. The `combine` node waits until both sources are ready (here, until each has produced its single event), then emits one combined object: `{ "customer": { "name": "Alice", ... }, "orders": [{ "id": 1, ... }] }`. Because each source emits exactly once, `combine` emits exactly once, which is the parallel join with no intermediate partial. If a source emitted more than once, `combine` would emit again on each later event, always carrying the latest value from every source.

### Example 3: Streaming fan-out with filters

This example routes events from a streaming operation to different handlers based on their shape.

```json
{
  "graphs": {
    "routeEvents": {
      "openbindings.operation-graph": "0.2.0",
      "nodes": {
        "in": { "type": "input" },
        "stream": { "type": "operation", "operation": "events.subscribe" },
        "isError": { "type": "filter", "schema": { "required": ["error"] } },
        "isSuccess": {
          "type": "filter",
          "transform": "$not($exists(error))"
        },
        "handleError": { "type": "operation", "operation": "errors.log" },
        "handleSuccess": { "type": "operation", "operation": "results.store" },
        "out": { "type": "output" }
      },
      "edges": [
        { "from": "in", "to": "stream" },
        { "from": "stream", "to": "isError" },
        { "from": "stream", "to": "isSuccess" },
        { "from": "isError", "to": "handleError" },
        { "from": "isSuccess", "to": "handleSuccess" },
        { "from": "handleError", "to": "out" },
        { "from": "handleSuccess", "to": "out" }
      ]
    }
  }
}
```

**Execution**: each event from `events.subscribe` fans out to both filters. `isError` passes events with an `error` field (schema-based filter); `isSuccess` passes events without (expression-based filter). Each path processes independently, and results from both handlers reach the output.

### Example 4: Fire-and-forget side effect

This example processes events and also triggers a notification as a side effect. The notification result is not part of the operation graph output.

```json
{
  "graphs": {
    "processAndNotify": {
      "openbindings.operation-graph": "0.2.0",
      "nodes": {
        "in": { "type": "input" },
        "process": { "type": "operation", "operation": "items.process" },
        "notify": { "type": "operation", "operation": "notifications.send" },
        "out": { "type": "output" }
      },
      "edges": [
        { "from": "in", "to": "process" },
        { "from": "in", "to": "notify" },
        { "from": "process", "to": "out" }
      ]
    }
  }
}
```

**Execution**: the input fans out to both `process` and `notify`. Only `process` has a path to `out`, so only its result becomes operation graph output. `notify` is a dead end — its result is discarded. The notification still executes (fire-and-forget).

### Example 5: Map and collect

This example fetches a list of user IDs, then fetches details for each user, and collects the results.

```json
{
  "graphs": {
    "getAllUserDetails": {
      "openbindings.operation-graph": "0.2.0",
      "nodes": {
        "in": { "type": "input" },
        "listUsers": { "type": "operation", "operation": "users.list" },
        "unpack": { "type": "map", "transform": "ids" },
        "getDetails": { "type": "operation", "operation": "users.get" },
        "collect": { "type": "buffer" },
        "out": { "type": "output" }
      },
      "edges": [
        { "from": "in", "to": "listUsers" },
        { "from": "listUsers", "to": "unpack" },
        { "from": "unpack", "to": "getDetails" },
        { "from": "getDetails", "to": "collect" },
        { "from": "collect", "to": "out" }
      ]
    }
  }
}
```

**Execution**:

1. **`in`** receives `{}`, flows to `listUsers`.
2. **`listUsers`** invokes `users.list`. Returns `{ "ids": ["u1", "u2", "u3"] }`.
3. **`unpack`** evaluates `ids` on the event, producing the array `["u1", "u2", "u3"]`. Each element is emitted as a separate event: `"u1"`, `"u2"`, `"u3"`.
4. **`getDetails`** is invoked three times (once per event). Returns `{ "id": "u1", "name": "Alice" }`, `{ "id": "u2", "name": "Bob" }`, `{ "id": "u3", "name": "Carol" }`.
5. **`collect`** buffers all three results. When `getDetails` completes, the buffer flushes: `[{ "id": "u1", "name": "Alice" }, { "id": "u2", "name": "Bob" }, { "id": "u3", "name": "Carol" }]`.
6. **`out`** emits the collected array.

### Example 6: Error handling with `onError`

This example fetches details for each item, falling back to a default value if the fetch fails.

```json
{
  "graphs": {
    "fetchWithFallback": {
      "openbindings.operation-graph": "0.2.0",
      "nodes": {
        "in": { "type": "input" },
        "fetchDetail": {
          "type": "operation",
          "operation": "items.get",
          "timeout": 5000,
          "onError": "fallback"
        },
        "fallback": {
          "type": "transform",
          "transform": "{ \"id\": input.id, \"name\": \"unknown\", \"error\": error }"
        },
        "out": { "type": "output" }
      },
      "edges": [
        { "from": "in", "to": "fetchDetail" },
        { "from": "fetchDetail", "to": "out" },
        { "from": "fallback", "to": "out" }
      ]
    }
  }
}
```

**Execution (success path)**:

1. **`in`** receives `{ "id": "item-1" }`, flows to `fetchDetail`.
2. **`fetchDetail`** invokes `items.get`. Returns `{ "id": "item-1", "name": "Widget" }`.
3. Event flows to `out`. Output: `{ "id": "item-1", "name": "Widget" }`.

**Execution (error path)**:

1. **`in`** receives `{ "id": "item-1" }`, flows to `fetchDetail`.
2. **`fetchDetail`** invokes `items.get`. The operation times out after 5000ms.
3. Because `onError` is set, an error event `{ "error": "timeout_exceeded", "input": { "id": "item-1" } }` is routed to `fallback`. (Without `onError`, the error would be silently dropped.)
4. **`fallback`** receives the error event as `$`. The expression accesses `input.id` and `error` as fields of the error event (not `$input`, which is the operation graph's original input). Result: `{ "id": "item-1", "name": "unknown", "error": "timeout_exceeded" }`.
5. Event flows to `out`. Output: `{ "id": "item-1", "name": "unknown", "error": "timeout_exceeded" }`.

### Example 7: Fatal error with `exit`

This example makes any operation failure terminate the operation graph.

```json
{
  "graphs": {
    "strictFetch": {
      "openbindings.operation-graph": "0.2.0",
      "nodes": {
        "in": { "type": "input" },
        "fetch": {
          "type": "operation",
          "operation": "items.get",
          "timeout": 5000,
          "onError": "die"
        },
        "die": { "type": "exit", "error": true },
        "out": { "type": "output" }
      },
      "edges": [
        { "from": "in", "to": "fetch" },
        { "from": "fetch", "to": "out" }
      ]
    }
  }
}
```

**Execution (success)**: `in` -> `fetch` succeeds -> `out` emits the result.

**Execution (error)**: `fetch` times out. The error event `{ "error": "timeout_exceeded", "input": { ... } }` is routed to `die`. The `exit` node terminates the operation graph with an error. Any previously emitted output events are not retracted, but the stream is closed as failed.

## Security considerations

Operation graphs inherit the security considerations defined in the [core OpenBindings specification v0.2.0](../../openbindings.md#15-security-considerations), including transform evaluation sandboxing, artifact fetching restrictions, and schema processing limits. Operation-graph-specific concerns:

- **Event amplification**: `map` nodes convert one event into many. Combined with cycles, a small input can produce a large number of operation invocations. A `map` inside a cycle is the primary amplification vector: if the map produces N events per iteration and `maxIterations` is M, the total can reach N^M events. Implementations SHOULD enforce a maximum total event count per operation graph execution and terminate with an error when the limit is exceeded.
- **Cycle amplification**: fan-out within a cycle multiplies events per iteration. `maxIterations` bounds per-lineage traversals but does not bound total event count if fan-out occurs within the cycle.
- **Error chains**: `onError` routing can create chains of operation invocations in response to failures. Implementations SHOULD enforce a maximum error chain depth to prevent unbounded error processing.

## Deferred from v1

The following features are out of scope for `openbindings.operation-graph@0.2.0`:

- **Imported operation references**: operation nodes may only reference operations in the containing OBI's `operations` map, not operations from imported interfaces.
- **Reusable sub-graphs**: `$ref` within operation graphs to reference other operation graphs or shared node subgraphs.
- **Combine timeout**: emit a combined object before the node is ready (before every source has produced an event or completed), filling not-yet-produced sources with `null`, after a timeout. Today `combine` always waits for readiness; an early partial emission on a timer is out of scope.
- **Tee (emit and continue)**: emitting an event to the operation graph output while also forwarding it to another node from the same path. Achievable today via fan-out to a path that reaches `output` and a separate path that continues processing.
- **Time-based buffer windows**: buffer conditions based on elapsed time (e.g., flush every 30 seconds).
- **Detach mode**: running a side-effect branch independently of the main graph's lifecycle.
