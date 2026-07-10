# `openbindings.operation-graph` Format Specification (v0.2.0)

**Status**: This is **version 0.2.0** of the `openbindings.operation-graph` format specification. It is pre-1.0, and minor-version revisions MAY include breaking changes. Released format versions are identified by the format token (`openbindings.operation-graph@0.2.0`); this document, at this path, is the normative text for that token. Version 0.2.0 is a ground-up rewrite of the format around the transparency principle (see [Transparency](#transparency-the-identity-law)); it supersedes all earlier revisions, which are available in version control history for comparison only.

This document defines the `openbindings.operation-graph` binding source format. It is a companion specification to the [OpenBindings Specification v0.2.0](../../openbindings.md) and depends on concepts defined there (operations, bindings, sources, transforms, invocations).

This format is versioned independently via its format token (`openbindings.operation-graph@<version>`).

- This document is licensed under the Apache 2.0 License (see `LICENSE`).
- The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in all capitals.

## Table of contents

- [Overview](#overview)
- [Invocation model](#invocation-model)
- [Transparency (the identity law)](#transparency-the-identity-law)
- [Format identifier](#format-identifier)
- [Source documents](#source-documents)
- [Binding `ref` syntax](#binding-ref-syntax)
- [Operation graph definition](#operation-graph-definition)
- [Node model](#node-model)
- [Node definitions](#node-definitions) (`input`, `output`, `operation`, `each`, `transform`, `filter`, `map`, `buffer`, `combine`, `exit`)
- [Edge definition](#edge-definition)
- [Execution semantics](#execution-semantics)
- [Determinism and portability](#determinism-and-portability)
- [Runtime context](#runtime-context)
- [Validation rules](#validation-rules)
- [Conformance](#conformance)
- [Extensions](#extensions)
- [Normative examples](#normative-examples)
- [Security considerations](#security-considerations)
- [Deferred from 0.2.0](#deferred-from-020)

---

## Overview

### At a glance

An operation graph is a small dataflow program that *is* a binding: it implements one operation's contract by wiring other operations together. Nodes are steps; edges carry streams of events between them. The smallest graph is a bare passthrough — `input → output`, piping every caller write straight back out — but the canonical graph wraps a single operation:

```json
{
  "openbindings.operation-graph": "0.2.0",
  "nodes": {
    "in":  { "type": "input" },
    "get": { "type": "operation", "operation": "users.get" },
    "out": { "type": "output" }
  },
  "edges": [
    { "from": "in",  "to": "get" },
    { "from": "get", "to": "out" }
  ]
}
```

Three ideas carry the whole format:

- **Nodes are *what*; edges are *how data flows*.** A node's `type` fixes its behavior; an edge is a plain wire with no logic on it.
- **Every node is an operation invocation.** An `operation` node invokes an operation chosen at runtime; the built-ins (`each`, `transform`, `filter`, `map`, `buffer`, `combine`, `exit`) invoke behavior this spec defines; `input` and `output` are the graph's own invocation, surfaced.
- **Cardinality is never declared — it emerges.** Nothing says how many inputs or outputs a graph has; that falls out of its contents and the bindings selected at runtime. The governing guarantee is the [identity law](#transparency-the-identity-law): the wrapper above must behave exactly like invoking `users.get` directly.

New readers may prefer to skim the [normative examples](#normative-examples) first — they trace eight graphs end to end — and return here for the precise model.

### The model

An operation graph is a **binding**. It satisfies an operation's contract by composing other operations as a directed graph of typed nodes connected by edges.

Everything in a graph is an operation invocation. An `operation` node invokes an operation whose behavior is bound at runtime through the processor's ordinary binding selection. Every other processing node invokes an operation whose behavior is bound by this specification — a **built-in**. Two binding authorities, one node model. The `input` and `output` nodes are the graph's own invocation, surfaced as nodes: `input` is the stream of values the caller writes; `output` is the stream of values the caller reads.

Edges carry **streams of events**. A node receives the merged streams of its incoming edges and emits a stream along all of its outgoing edges. Cardinality appears nowhere in this format: a graph does not declare how many inputs it accepts or how many outputs it produces, an `operation` node does not know or assume the cardinality of the operation it invokes, and no behavior anywhere is conditioned on cardinality. Cardinality belongs to bindings, is resolved at runtime, and is delegated to exactly the place the core specification delegates it. A graph's boundary cardinality is **emergent** from its contents.

## Invocation model

The core specification deliberately defines no invocation semantics: invocation is a processor concern ([core §1.2](../../openbindings.md#12-out-of-scope)), and an operation's interaction pattern is determined by its selected binding, not declared ([core §6.1](../../openbindings.md#61-operations)). This format's subject matter *is* invocation, so it needs names for the surface the core delegates. This section defines that vocabulary as used by the rest of this document. It names the observable surface of an operation invocation; it does not constrain how processors implement it.

- **Invocation**: one use of an operation through a selected binding, from initiation until terminal status.
- **Input side**: the sequence of values the caller **writes** into the invocation, in order, followed by a **close**. **Close responsibility**: the input side is closed by the caller, or *from below* by the selected binding when the binding can know that no further input is meaningful (a unary binding closes after its first read). When the binding cannot know, closure rests with the caller; a caller that neither writes nor closes owns the resulting hang.
- **Output side**: the sequence of values the invocation emits, in order, ending in completion.
- **Terminal status**: an invocation ends in exactly one of **normal completion** or a **terminal error**; a terminal error carries the error the processor surfaces to the caller.
- **Cancellation**: the caller may cancel an invocation at any point; cancellation tears down the invocation and any work it carries.

Cardinality descriptors used in this document — no-input, unary, server-streaming, client-streaming, bidirectional — are informal names for observed write/read counts under a selected binding, not declarations; per the core specification, neither an operation nor this format declares them.

*Correspondence (informative).* The openbindings project's `binding-invoker` interface expresses this same surface as a typed frame stream (`open`/`input`/`close` in; `output`/`complete`/`error` out, with `input_closed` signalling closure from below), and states the same principle: cardinality is observed by how the caller drives the frames, not declared. That interface is an informational artifact, not part of this format's normative dependencies; the definitions above stand on their own.

## Transparency (the identity law)

The format's governing principle, stated as a conformance requirement:

> **The identity law.** A graph consisting of `input → operation(y) → output` MUST be observationally indistinguishable from a direct invocation of the operation `y`.

Observational equivalence is defined over the surface named in [Invocation model](#invocation-model):

- **Input acceptance**: which caller writes are accepted, and when the invocation's input side closes (including closure initiated by the implementation; see [Input-side closure](#input-side-closure-back-closure)).
- **Output stream**: the contents and ordering of emitted values, within the guarantees of [Determinism and portability](#determinism-and-portability).
- **Terminal status**: normal completion versus terminal error, and the error surfaced.
- **Cancellation response**: caller cancellation tears down the underlying invocation.

Explicitly **excluded** from the equivalence surface:

- **Transport metadata.** Operation graphs are a format that carries no leading or trailing metadata; a graph binding's metadata is empty regardless of inner operations' metadata.
- **Timing and buffering.** The wrapper may add latency or buffering hops; equivalence is over streams and outcomes, not schedules.

The law is testable. A conforming implementation's acceptance criterion is: the trivial wrapper graph, executed over a controlled binding, passes the same invocation-conformance scenarios as a direct invocation of the wrapped operation — across no-input, unary, server-streaming, client-streaming, and bidirectional selected bindings.

Consequences of the law, which the rest of this document realizes:

1. An `operation` node is a pure conduit to one invocation (see [`operation`](#operation)); per-invocation-per-event behavior is a distinct built-in (see [`each`](#each)).
2. An empty input stream is piped as an empty input stream: a graph invoked with zero writes invokes a directly-wrapped operation with zero writes, which is exactly a no-input invocation. No value is synthesized.
3. The graph closes its caller-facing input side when its contents stop accepting input, mirroring a directly-invoked binding that closes its own input (see [Input-side closure](#input-side-closure-back-closure)).
4. An unhandled terminal error on an `operation` conduit terminates the graph invocation with that error: a direct invocation that errors terminally surfaces the error, so the bare wrapper must as well. Conduit terminal errors are therefore fatal by default, and only an explicit `onError` on the node opts them into in-graph handling (see [Errors](#errors)).

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

A single document MAY contain multiple operation graphs, including graphs declaring different versions of this format. Each graph carries its own version field; the document itself has no version field. A document whose root is itself a graph definition is valid; so is a graph embedded at any other JSON Pointer location within an arbitrary host document. Tools MUST NOT reject a document because its shape does not match the conventional layout below.

### Conventional shape (non-normative)

For files whose primary purpose is to hold operation graphs, the recommended top-level shape is a `graphs` map keyed by graph name:

```json
{
  "graphs": {
    "getAllUserDetails": {
      "openbindings.operation-graph": "0.2.0",
      "nodes": { ... },
      "edges": [ ... ]
    }
  }
}
```

This is a convention, not a requirement (see [Source documents](#source-documents) for the normative statement of what containing shapes are valid).

## Binding `ref` syntax

A binding whose `source` references an `openbindings.operation-graph` document MUST address its target operation graph using a [JSON Pointer (RFC 6901)](https://www.rfc-editor.org/rfc/rfc6901) fragment.

The Pointer carried by the fragment is evaluated against the operation graph source document. The resolved value MUST be a valid [Operation graph definition](#operation-graph-definition). The empty JSON Pointer is represented as the fragment `"#"` and resolves to the whole document, so a document whose root is a graph definition is addressable without naming.

The leading `#` is part of the syntax; it denotes a fragment identifier per RFC 3986. Tools that resolve `ref` MUST treat the value as a JSON Pointer and MUST NOT accept bare graph keys (e.g., `"paginateAll"`) as shorthand.

A `ref` that does not resolve, or whose resolved value is not a valid operation graph definition, is a binding error; tools acting on the binding MUST surface it.

`ref` is REQUIRED on bindings using this format. To target a graph at the document root, use the JSON Pointer fragment `"#"`. This format does not define a "whole document" interpretation for an absent `ref`.

## Operation graph definition

An operation graph is a JSON object:

```json
{
  "openbindings.operation-graph": "0.2.0",
  "description": "Fetches a user.",
  "nodes": {
    "in":  { "type": "input" },
    "get": { "type": "operation", "operation": "users.get" },
    "out": { "type": "output" }
  },
  "edges": [
    { "from": "in",  "to": "get" },
    { "from": "get", "to": "out" }
  ]
}
```

- `openbindings.operation-graph` (REQUIRED, string): the version of this format the graph was authored against. MUST match the SemVer 2.0.0 pattern. Tools MUST refuse graphs declaring a higher major version than they support and, while this format is pre-1.0, graphs declaring a higher minor version ([OG-T-02](#conformance)), mirroring the core spec's OBI-T-04. Each graph in a document declares its own version independently.
- `description` (OPTIONAL, string): a human-readable description of what the graph does.
- `nodes` (REQUIRED): a map of named nodes. Each key is a node identifier matching `^[A-Za-z_][A-Za-z0-9_.-]*$`; each value is a [Node](#node-definitions). Node keys MUST be unique within the graph (enforced by JSON object semantics).
- `edges` (REQUIRED): an array of [Edge](#edge-definition) objects defining the connections between nodes.

**Version precedence.** Two version signals may be present: the source `format` token (`openbindings.operation-graph@X.Y.Z`) and each graph's own `openbindings.operation-graph` field. The graph's field governs how that graph is interpreted and executed, and is the value the core spec's OBI-T-04 version refusal is applied against; the source token identifies the format family and its version is advisory for binding selection. Because one document may hold graphs at differing versions, the token cannot govern per-graph execution. A tool MAY surface a diagnostic when the token version and a graph's field disagree, but MUST NOT let the token override the graph's field.

There is no explicit `entry` field. The entry point is the `input` node and the exit point is the `output` node; see [Validation rules](#validation-rules) for structural constraints.

## Node model

Every node has the same shape: it receives the merged event streams of its incoming edges and emits an event stream along all of its outgoing edges (the `input` node has no incoming edges; the `output` and `exit` nodes have no outgoing edges). Every node is a JSON object with a REQUIRED `type` field, the discriminator that determines its behavior and which other fields are valid. All processing nodes — every type except the boundary nodes `input` and `output`, which are not invocations of their own and cannot fail as nodes — support:

- `onError` (OPTIONAL, string): the key of a node to route error events to if this node fails. The error event shape is:

```json
{
  "error": "TIMEOUT_EXCEEDED",
  "event": { "id": "item-1" }
}
```

  - `error` (any): the failure's identifier string (see [Error identifiers](#errors)) or, for a failure originating in an inner invocation, the inner terminal error value surfaced verbatim (which need not be a string).
  - `event` (any, OPTIONAL): the event being processed when the failure occurred. Present exactly when the failure is attributable to a single event (a per-event failure); absent for an `operation` conduit's terminal error, which belongs to the invocation as a whole, not to any one write (see [`operation`](#operation)).

  Error policy follows the two liftings. **Per-event failures** — an `each` invocation failing, a `WRITE_REJECTED` at a non-accepting `operation` node, `MAP_NOT_ARRAY`, `TRANSFORM_UNDEFINED` — are silent by default: if `onError` is not set, the error event is dropped and does not propagate. Graphs often process many events, and one transient failure should not kill the stream. **Conduit terminal errors** are fatal by default: if an `operation` node's held invocation terminates with an error and the node does not set `onError`, the graph invocation terminates with that error. The [identity law](#transparency-the-identity-law) forces this asymmetry — terminal status is on the equivalence surface, so the bare wrapper must surface the inner invocation's terminal error exactly as direct invocation would. Setting `onError` on an `operation` node opts its terminal error into in-graph handling instead. In both regimes the author is in control: wire `onError` to a `transform` for fallback values, to an operation for logging, or to an `exit` node with `error: true` to make per-event failures fatal. A node type with no defined failure modes (`exit`, `buffer`, `combine`, and a schema-based `filter`) never fires `onError`; declaring it on such a node is valid and inert.

**Two binding authorities.** Every node is an operation invocation. An `operation` node invokes an operation whose behavior is bound at runtime by binding selection; a **built-in** node invokes an operation whose behavior is bound by this specification — its documented operational expectation is its binding. The built-ins are `each`, `transform`, `filter`, `map`, `buffer`, `combine`, and `exit`. The boundary nodes `input` and `output` are not invocations of their own; they are the graph's own invocation, surfaced.

> **Note on terms.** A graph *is a binding* in the [core sense](../../openbindings.md#63-bindings): a `bindings` entry selects it as an operation's target. When this document says "two binding **authorities**," it means *what fixes a node's behavior* — runtime selection for an `operation` node, this specification for a built-in — not a second kind of core `bindings` entry.

**The lifting rule.** A node's behavior over a stream follows from what it is:

- *Stateless per-event built-ins* (`transform`, `filter`, `map`) have exactly one lifting over a stream — apply per event — because for a stateless function, "one instance over the stream" and "an instance per event" are indistinguishable. No choice exists, so none is offered.
- *Stateful built-ins* (`buffer`, `combine`) are by definition one instance per graph invocation; their cross-event state is what they are.
- *Operations* carry session identity — state, connection, side-effect scope, lifecycle — so two distinct liftings exist: one invocation written every arriving event (`operation`, the conduit) and one invocation per arriving event (`each`). Both are cardinality-agnostic toward the inner operation: the conduit asserts nothing, and `each` fixes only the graph's own write count per session, which any caller of any operation is entitled to do. The two coincide when exactly one event arrives, and differ at zero events and at two or more (see [`operation`](#operation) and [`each`](#each)).

Built-ins exist exactly where external operations cannot reach — cross-event state within a graph invocation (`buffer`, `combine`), invocation instantiation (`each`), control (`exit`) — or where hermeticity demands it: `transform`, `filter`, and `map` could be modeled as external operations, but binding them in the spec keeps graphs executable without network dependencies and keeps their evaluation deterministic.

**Closed type set.** A conformant `openbindings.operation-graph@0.2.0` graph uses only the node types defined in this document. Unlike an unknown metadata field, an unknown node `type` is an executable step a tool cannot safely skip: a graph containing one is non-invocable under this format version (OG-V-14). Custom execution nodes require a distinct format token or profile.

## Node definitions

### `input`

```json
{ "type": "input" }
```

The graph's caller-facing input side, surfaced as a node. Each value the caller writes to the graph invocation becomes one event emitted by this node, in write order. Each such event roots a **lineage** (see [Lineage](#maxiterations-and-event-lineage)). The node's output stream completes when the caller closes the input side, or when the implementation closes it on the caller's behalf per [Input-side closure](#input-side-closure-back-closure).

A graph invoked with zero writes emits zero events here: an empty input stream is an empty stream. No value is synthesized.

An operation graph MUST have exactly one `input` node. The `input` node MUST NOT have any incoming edges.

### `output`

```json
{ "type": "output" }
```

The graph's caller-facing output side, surfaced as a node. Every event that reaches this node is emitted to the caller as one output of the graph-bound operation. Per the core specification, output validation (OBI-T-08) applies per item at the operation boundary and is the invoking layer's concern, not this format's.

An operation graph MUST have exactly one `output` node. The `output` node MUST NOT have any outgoing edges.

### `operation`

```json
{
  "type": "operation",
  "operation": "users.get",
  "timeout": 30000
}
```

The conduit: the invocation handle, as a node. An `operation` node holds **one invocation** of the named operation per graph invocation and pipes its incoming stream into it:

- The invocation is created inert and is first driven by the node's first arriving event, or by the completion of the node's incoming edges if no event ever arrives (the empty stream — a no-input invocation).
- Each arriving event is written to the invocation as one input, in arrival order.
- When the node's incoming edges complete, the node closes the invocation's input side.
- Each output the invocation emits flows downstream as one event, in emission order.
- The node has no knowledge of, opinion on, or behavior conditioned by the operation's cardinality. Binding selection at runtime determines everything, exactly as for a top-level invocation.

Fields:

- `operation` (REQUIRED, string): the operation key to invoke.
- `timeout` (OPTIONAL, integer >= 1): total budget in milliseconds for the invocation, measured from the moment the node first drives it until its output stream completes; not an idle or per-event timeout. On expiry the invocation terminates with `TIMEOUT_EXCEEDED`, handled as a conduit terminal error (see **Failure** below).

The containing OBI document is the operation namespace: `operation` resolves against that document's `operations` map only (OG-V-11), and this format defines no cross-document operation reference. To orchestrate an external service, declare an operation for it in the containing OBI and bind that operation to the external service's artifact through an ordinary source; the graph then references it by its local key like any other operation.

An operation node invokes the named operation through the containing OBI processor's ordinary operation-invocation path. This format does not inspect or interpret the referenced operation's bindings directly: binding selection, context resolution, input/output transforms, source loading, and format-specific `ref` handling are performed by the processor the same way they are for a top-level invocation. Because binding selection is a processor concern, a graph whose behavior depends on which of several non-equivalent bindings is selected is not fully portable; authors who need portable behavior should ensure referenced operations have behaviorally equivalent bindings, or only one actionable binding in the relevant processing environment.

**Acceptance.** The node mirrors its invocation's input side. While the invocation accepts input, the node accepts events. When the invocation's input side closes from below (the selected binding closes it, e.g. a unary binding after its first read) or the invocation terminates, the node becomes **non-accepting**: subsequent arriving events are not written; each becomes a `WRITE_REJECTED` error event routed per `onError` (dropped if unset). Non-acceptance participates in [Input-side closure](#input-side-closure-back-closure).

**Failure.** A terminal error on the held invocation (including `TIMEOUT_EXCEEDED` from this node's `timeout`) is a failure of the invocation as a whole, not of any single write, and is handled in one of two ways:

- If the node sets `onError`, an error event carrying the terminal error is routed to the named node — without an `event` member, since the failure is not attributable to one event — the node's output completes, the node is non-accepting thereafter, and the graph continues.
- If the node does not set `onError`, the graph invocation terminates with the invocation's terminal error, exactly as if an `exit` node with `error: true` had been reached with the inner terminal error as the error detail: previously emitted outputs are not retracted, in-flight events and inner invocations are cancelled, and the caller-facing input side is closed.

The fatal default is forced by the [identity law](#transparency-the-identity-law): terminal status is on the equivalence surface, so the bare wrapper must surface the inner invocation's terminal error identically to direct invocation. Write rejections at a non-accepting node are per-event failures, not terminal errors; they are routed per `onError` (with the rejected event attached) or dropped, and never terminate the graph by default.

**Cardinality notes (informative).** With exactly one arriving event, `operation` and [`each`](#each) coincide: one invocation, one write. With zero events, `operation` performs one no-input invocation (required by the identity law) while `each` performs none. With two or more, `operation` writes them all into one session while `each` opens a session per event. The old per-event behavior of this format lived entirely at the one-event point where the two forms are indistinguishable.

An `operation` node MUST NOT participate in a cycle (OG-V-10): a node whose inner input closes only on upstream completion cannot sit on a loop whose completion depends on it.

**Diagnostic (non-normative).** A multi-emission path — most commonly a `map` — feeding an `operation` node is usually a missing `each`: with a unary selected binding it yields one result and converts the remaining events into write-rejection error events. The pattern is legitimate when the inner operation genuinely consumes an input stream, so validators SHOULD warn, not fail.

### `each`

```json
{
  "type": "each",
  "operation": "users.get",
  "maxIterations": 100,
  "timeout": 5000
}
```

A built-in, higher-order: invoke the referenced operation **once per arriving event**. For each event, the node opens one invocation through the processor's ordinary invocation path, writes the event as that invocation's only input, closes its input side, and emits its outputs downstream as events. Zero arriving events means zero invocations.

Fields:

- `operation` (REQUIRED, string): the operation key to invoke per event. Resolved against the containing OBI's `operations` map, identically to [`operation`](#operation).
- `maxIterations` (OPTIONAL, integer >= 1): the maximum number of invocations this node may open per event lineage. REQUIRED if the node is part of a cycle (OG-V-09). When an arriving event's lineage count for this node has reached the limit, the event is dropped rather than invoked — a safety bound, not an error; other events are unaffected.
- `timeout` (OPTIONAL, integer >= 1): per-invocation budget in milliseconds, from drive until that invocation's output stream completes. On expiry, that invocation fails as a node failure for the triggering event.

Invocations spawned by an `each` node MAY run concurrently. Outputs of a single invocation flow downstream in emission order; the interleaving of outputs across concurrently running invocations is implementation-defined (see [Determinism and portability](#determinism-and-portability)).

A failed invocation (terminal error, `TIMEOUT_EXCEEDED`) produces an error event carrying the triggering event, routed per `onError`; other in-flight invocations and events continue normally.

`each` fixes the graph's contribution — one write per session — and asserts nothing about the operation's nature; a single write-and-close is a complete invocation of any operation under the [invocation model](#invocation-model).

### `transform`

```json
{
  "type": "transform",
  "transform": "{ \"id\": user_id, \"name\": full_name }"
}
```

Reshapes events. A stateless per-event built-in: for each arriving event, the expression is evaluated with the event as `$` and the lineage's root input as `$input` ([Runtime context](#runtime-context)); the result replaces the event and flows downstream.

- `transform` (REQUIRED, string): a [Transform](#transforms) expression.

### `filter`

Gates events: passing events flow downstream; failing events are dropped. Two mechanisms, mutually exclusive (OG-V-12):

**Schema-based:**

```json
{ "type": "filter", "schema": { "required": ["nextCursor"] } }
```

- `schema` (object): a JSON Schema 2020-12 object. Events that validate pass; others are dropped.

**Expression-based:**

```json
{ "type": "filter", "transform": "role = $input.requiredRole" }
```

- `transform` (string): a [Transform](#transforms) expression evaluated with the event as `$` and the lineage's root input as `$input`. The event passes when the boolean cast of the defined result is `true`, per JSONata 2.0's boolean casting rules (the semantics of its `$boolean()` function: `false`, `null`, `0`, the empty string, an empty array, an array whose members all cast to `false`, and the empty object cast to `false`; everything else casts to `true`); otherwise the event is dropped. An undefined result neither passes nor drops: it fails the node with `TRANSFORM_UNDEFINED` per [Transforms](#transforms).

### `map`

```json
{ "type": "map", "transform": "ids" }
```

Unpacks an array into individual events. The expression is evaluated with the event as `$` and `$input` as the lineage root; the result MUST be an array, and each element is emitted as a separate event downstream, in array order. A defined non-array result fails the node with `MAP_NOT_ARRAY`; an undefined result fails it with `TRANSFORM_UNDEFINED` per [Transforms](#transforms).

- `transform` (REQUIRED, string): a [Transform](#transforms) expression.

### `buffer`

```json
{ "type": "buffer", "limit": 10 }
```

Accumulates incoming events into a batch and emits the batch as a single array event. One accumulator instance per graph invocation.

- `limit` (OPTIONAL, integer >= 1): flush after accumulating this many events, then reset and continue (a tumbling window of disjoint batches). "No more than N": if upstream completes first, the partial batch is flushed.
- `until` (OPTIONAL, JSON Schema): flush when an event matches; the matching event is **not** included and is dropped. Reset and continue. Mutually exclusive with `through`.
- `through` (OPTIONAL, JSON Schema): flush when an event matches; the matching event **is** included. Reset and continue. Mutually exclusive with `until`.

With no conditions (`{ "type": "buffer" }`), the buffer drains all upstream events and flushes a single array when all incoming edges complete; if it received no events, it emits nothing (not an empty array), consistent with the conditional variants. With conditions, any remaining partial batch is flushed when all incoming edges complete; no variant silently discards a trailing partial batch. A buffer MAY combine `limit` with `until` or `through`; when multiple conditions would fire on the same event, `limit` takes precedence.

The buffer's output is always an array of the accumulated events. In a graph invocation with multiple input lineages, a buffer accumulates across lineages; for per-lineage batching, see the [per-event scoping idiom](#per-event-scoping-idiom-informative).

### `combine`

```json
{ "type": "combine" }
```

Joins multiple incoming sources by pairing the latest event from each into a keyed object. Keys are the source node names (from incoming edges); values are the most recent event from each source. One instance per graph invocation.

A combine node is **ready** once every incoming source has either produced at least one event or completed. It emits nothing before readiness. Once ready, it emits a combined object, and emits again on every subsequent event from any still-active source. A source that completed without producing contributes `null`. If source completion makes the node ready, it emits one combined object immediately. The node completes when all incoming sources have completed and any readiness-triggered emission has been delivered.

The combined object's keys are node identifiers, so renaming a source node changes the shape every downstream expression reads; treat the names of nodes feeding a `combine` as part of the graph's internal contract.

**Portability.** A `combine` driven by sources that each emit exactly once produces exactly one combined emission and is fully portable. When a source emits more than once, emission count and contents depend on cross-path interleaving and are implementation-defined. Authors who require portable output SHOULD drive `combine` only with single-emission sources. In multi-lineage graph invocations, sources commonly multi-emit; for per-lineage joins, see the [per-event scoping idiom](#per-event-scoping-idiom-informative).

### `exit`

```json
{ "type": "exit" }
```

```json
{ "type": "exit", "error": true }
```

Terminates the graph invocation immediately when an event reaches this node.

- `error` (OPTIONAL, boolean, default `false`): if `false`, the event is emitted to the graph's output stream before termination (early return). If `true`, the graph terminates with an error and the event is the error detail, not emitted as output.

In both cases: previously emitted outputs are not retracted; all in-flight events (including partial buffer contents and combine state) are discarded; all inner invocations — `operation` conduits and `each` spawns — are cancelled; and the caller-facing input side is closed.

The `exit` node MUST NOT have any outgoing edges.

### Transforms

Wherever a node embeds a dynamic expression, the value is a plain [JSONata 2.0](https://docs.jsonata.org/) expression string. Tools claiming `openbindings.operation-graph@0.2.0` conformance MUST support JSONata 2.0 transforms ([OG-T-03](#conformance)), following the [core specification's Transforms section](../../openbindings.md#65-transforms).

If a transform expression evaluates to `undefined` (no result), the node fails with `TRANSFORM_UNDEFINED`. If it evaluates to `null`, the event becomes `null` and flows downstream normally. This applies to all nodes that use transforms (`transform`, `map`, `filter`).

### Embedded schemas

Wherever a node embeds a JSON Schema (`filter.schema`, `buffer.until`, `buffer.through`), the schema is subject to the [core specification's schema constraints (§6.2)](../../openbindings.md#62-schemas): JSON Schema 2020-12 in object form, `$schema` (when present) pinned to the 2020-12 meta-schema URI, and no `$vocabulary`.

## Edge definition

```json
{ "from": "fetchPage", "to": "collectPages" }
```

- `from` (REQUIRED, string): the key of the source node.
- `to` (REQUIRED, string): the key of the target node.

Edges carry no logic — no conditions, no transforms, no priorities. They are wires carrying event streams.

**Fan-out**: a node with multiple outgoing edges sends every event it produces to ALL targets. Combined with `filter` nodes, this is the graph's branching mechanism.

**Fan-in**: multiple edges targeting one node merge their streams. Per-event nodes process merged events in arrival order; `buffer` accumulates them together; `combine` tracks latest-per-source; an `operation` node writes them into its one invocation in arrival order.

**Dead ends**: a node with no path to `output` is legal; its events are discarded, but its side effects (inner invocations) occur. This is the fire-and-forget pattern.

**Ordering**: events delivered along a single edge preserve the order the source produced them; cross-edge interleaving at fan-in is implementation-defined (see [Determinism and portability](#determinism-and-portability)).

## Execution semantics

### Invocation start

When a graph-bound operation is invoked, the graph binding surfaces the invocation through the boundary nodes: each value the caller writes is accepted (subject to [Input-side closure](#input-side-closure-back-closure)) and emitted as one event at the `input` node, in write order, each rooting a lineage; each event reaching the `output` node is emitted to the caller as one output. The caller closing the input side completes the `input` node's output stream.

A binding that selects an operation-graph source MAY carry the core specification's binding-level `inputTransform`/`outputTransform`. Per the core, they apply per item at the operation boundary, outside the graph: `inputTransform` reshapes each caller write before it becomes an event at the `input` node, and `outputTransform` reshapes each event the `output` node emits before output validation (OBI-T-08). The graph itself never sees untransformed input or emits untransformed output when those fields are declared.

### Per-event processing

When an event arrives at a node, the node processes it per its [definition](#node-definitions): an `operation` node writes it into its held invocation (or rejects it as an error event if non-accepting); an `each` node opens one invocation for it (or drops it if its lineage count has reached `maxIterations`); `transform`, `filter`, and `map` evaluate per event; `buffer` accumulates and checks flush conditions in the precedence order limit, until/through; `combine` records latest-per-source and emits if ready; `exit` terminates the invocation; `output` emits to the caller. After a node produces output events, each is sent along every outgoing edge.

### Completion propagation

When a node has processed all incoming events and will produce no more output, its output stream is complete. Completion propagates along edges:

- The `input` node completes when the caller closes the input side or the implementation closes it per [Input-side closure](#input-side-closure-back-closure).
- An `operation` node's incoming completion closes its invocation's input side; the node's output completes when the invocation's output stream completes (or on terminal failure with `onError` set, after the error event is routed; an unhandled terminal failure terminates the graph instead — see [Errors](#errors)).
- An `each` node's output completes when its incoming edges are complete and all spawned invocations have completed.
- `transform`, `filter`, and `map` complete when their incoming edges complete.
- A `buffer` flushes any remaining accumulated events (per its variant) when all incoming edges complete, then completes; if nothing is accumulated, it emits no final batch.
- A `combine` follows its readiness rules: if source completion makes it ready it emits once, then completes when all sources have completed.
- A node's output is complete when the node itself is complete and all its output events have been delivered.
- For completion purposes, a declared `onError` reference counts as an incoming edge from the declaring node: a node fed only by error routes completes when every node declaring it as an `onError` target has completed. This matches how `onError` references already count for reachability (OG-V-06) and cycle safety (OG-V-09) — a node that could still receive a routed error event is not complete, and error events routed to it are never dropped as late arrivals.

### Input-side closure (back-closure)

The graph's input side closes from below, mirroring a directly-invoked binding that closes its own input. An implementation MUST close the caller-facing input side when **every node targeted by an outgoing edge of the `input` node is non-accepting**. Non-acceptance is defined for `operation` nodes (the held invocation's input side has closed, or the invocation has terminated) and arises globally when an `exit` node has terminated the invocation. Built-in nodes, including `each`, are always accepting.

Consequently: a graph whose input feeds only `operation` nodes closes its caller's input exactly when its contents do — the trivial unary wrapper closes input after the first write, identically to direct invocation — while a graph whose input feeds an `each` node or other built-in genuinely cannot know when input is done, so closure rests with the caller, consistent with the [invocation model](#invocation-model)'s close-responsibility rule for bindings that cannot know. Authors should note which case a graph is in; a caller that neither writes nor closes against a graph awaiting input is the same documented caller-owned hang as for any such binding.

### Graph completion

The graph invocation is complete when either (a) an `exit` node is reached, which terminates it immediately, or (b) the `input` node has completed, all events have finished flowing — reached `output`, reached a dead end, or been dropped — and no events or inner invocations are in flight. *Note (non-normative): in cyclic graphs, a cycle completes when all events within it have been dropped or have left the cycle and no new events are entering it; the detection mechanism (reference counting, liveness tracking, drain detection) is implementation-defined.*

### Cancellation

If the caller cancels the graph invocation, or an `exit` node is reached, cancellation propagates to all inner invocations — `operation` conduits and `each` spawns. Buffers discard accumulated contents without flushing; combines discard latest values without emitting.

### Errors

**Per-event failures.** When a node fails while processing an event (an `each` invocation's terminal error or `TIMEOUT_EXCEEDED`, `MAP_NOT_ARRAY`, `TRANSFORM_UNDEFINED`, a `WRITE_REJECTED` at a non-accepting `operation` node, or any other failure attributable to a single event), the failing event does not propagate along the node's normal outgoing edges. If `onError` is set, an error event (`{ "error": "<error>", "event": <eventBeingProcessed> }`) is routed to the named node; otherwise it is dropped. Other in-flight events continue normally. To make per-event failures fatal, wire `onError` to an `exit` node with `error: true`.

**Conduit terminal errors.** When an `operation` node's held invocation terminates with an error, the failure belongs to the invocation as a whole. If the node sets `onError`, an error event (`{ "error": "<error>" }`, with no `event` member) is routed to the named node, the node completes and is non-accepting, and the graph continues. If the node does not set `onError`, the graph invocation terminates with that error — previously emitted outputs are not retracted, in-flight events and inner invocations are cancelled, and the caller-facing input side closes — exactly as for an `exit` node with `error: true` whose error detail is the inner terminal error. The graph's terminal error is the inner terminal error itself, the value direct invocation would surface, not an error-event wrapper around it; the `{ "error": ... }` shape exists only for events routed inside the graph. This fatal default is required by the [identity law](#transparency-the-identity-law)'s terminal-status clause; see [`operation`](#operation).

**Error identifiers.** When the failure is one this specification defines, the `error` member carries its identifier, in SCREAMING_SNAKE_CASE per the identifier convention of the openbindings interfaces (e.g., the binding-invoker's `CONTEXT_REQUIRED` and `ERR_*` codes):

| Identifier | Raised by |
|---|---|
| `TIMEOUT_EXCEEDED` | an `operation` or `each` node whose `timeout` budget expires |
| `WRITE_REJECTED` | a non-accepting `operation` node receiving an event |
| `MAP_NOT_ARRAY` | a `map` node whose expression yields a defined, non-array result |
| `TRANSFORM_UNDEFINED` | a `transform`, `filter`, or `map` node whose expression yields no result (undefined) |

A failure originating inside an inner invocation (the operation itself fails) surfaces the inner terminal error as the `error` value verbatim; such values are processor- and service-defined, need not be strings, and are not drawn from this table. A graph cannot distinguish an inner error that happens to equal a spec identifier from the node's own failure; authors routing on `error` values should account for that. Future versions of this format may add identifiers; graphs that route on `error` values should treat unrecognized identifiers as ordinary failure values, not errors in themselves.

### `maxIterations` and event lineage

`maxIterations` protects against unbounded loops in cyclic graphs. The counter is tracked **per event lineage**, per `each` node. Each event entering at the `input` node roots a lineage with every count at zero. Counts propagate:

- An `each` node increments its own count for the event it processes before invoking; the spawned invocation's output events inherit the incremented counts. Once an arriving event's count for the node would exceed `maxIterations`, the event is dropped — not an error.
- `transform` and `filter` pass counts through unchanged; a filtered-out event propagates nothing.
- `map` copies the input event's counts onto every element event it emits (the amplification noted under [Security considerations](#security-considerations)).
- A node that merges several events into one output — `buffer` on flush, `combine` on emit, and an `operation` node, whose single invocation's outputs follow from every event written into it — gives the merged output, for each `each` node, the **maximum** of that count among the contributing events. A merge never lowers a count, so merges cannot be used to escape a bound.
- An `onError` route carries the failing event's lineage; for a conduit terminal error, which has no single failing event, the error event carries the merged lineage of all events written into the invocation, per the merge rule above. `onError` references count as edges for cycle detection (OG-V-09), so error loops are bounded identically to data loops.

For `$input` attribution at merge points, see [Runtime context](#runtime-context).

Because counts only increase along a lineage and merges take the maximum, a cycle containing an `each` node with `maxIterations` cannot spawn invocations indefinitely within any single lineage. This is a per-lineage bound; it does not bound total event count or total invocations when `map` or fan-out creates additional lineage branches.

### Flow control

Events in transit between nodes are held in implementation-managed queues; this specification does not fix their capacity. Implementations SHOULD bound them. In particular, an `operation` or `each` node SHOULD consume its inner invocations' output with bounded read-ahead, so that a saturated downstream path propagates backpressure to the invocation — and through it to the transport — rather than accumulating unbounded in-graph state; and admission of caller writes at the `input` node SHOULD be similarly bounded, so a saturated graph backpressures its caller. Bounding strategy does not affect the portable behavior defined in [Determinism and portability](#determinism-and-portability); it affects resource behavior only. The event-amplification limits under [Security considerations](#security-considerations) are a termination backstop, not flow control.

### Per-event scoping idiom (informative)

`buffer` and `combine` are scoped to the graph invocation. When a graph processes multiple lineages (multiple caller writes, or multiplication via `map`), per-lineage batching or joining is expressed by **nesting**: place the per-event logic — the parallel fan-out, the `combine`, the `buffer` — in a separate graph, bind it to an operation, and reference that operation from an `each` node. Each event then receives its own sub-invocation, and invocation scope one level down *is* lineage scope. See [Example 5](#example-5-per-event-parallel-join-via-nesting).

## Determinism and portability

A graph's output is the events that reach `output`, plus any event emitted by an `exit` with `error: false`. These guarantees concern the graph engine given fixed node behavior; a non-deterministic operation or transform propagates its non-determinism to the output.

Portable behavior (every conforming implementation MUST honor it):

- **Per-edge order.** Events along a single edge preserve production order.
- **Conduit fidelity.** An `operation` node writes arriving events in arrival order and emits the invocation's outputs in emission order: a faithful, lossless, in-order conduit.
- **`map` order.** Elements are emitted in array order.
- **Element-node evaluation.** For a deterministic expression, the result of `transform`, `filter`, or `map` is a function of the event and `$input` alone.
- **The output multiset.** Given deterministic operations and expressions, and a graph in which every node receives its events in a fixed order, the multiset of output events is determined by the graph and its input stream. A graph with a single caller write and no reconverging concurrent paths has a fully determined output; the identity-law wrapper is fully determined for every cardinality.
- **Eventual completion.** A graph that these semantics say completes will complete under every conforming implementation; completion is determined by the data, not by timing.

Implementation-defined behavior (conforming implementations MAY differ):

- **Interleaving across concurrent paths** reconverging at a fan-in node.
- **Interleaving across concurrent `each` invocations'** outputs.
- **`combine` emission count and content** when any source emits more than once.
- **Order within a flushed `buffer`** fed by concurrent paths (same multiset, unspecified element order).
- **Completion-detection mechanism and timing**, especially for cycles.
- **Output-event order across concurrent paths.**

Authors who need a byte-stable output order should funnel results through a single path before `output` — for example, collect into a `buffer` and sort within a `transform` — or keep concurrency inside nested single-write sub-graphs.

### What is not guaranteed (informative)

A graph's *topology* is easily mistaken for an *ordering*; they are not the same. The clearest trap is the `map → each → buffer` shape of [Example 4](#example-4-map-and-collect): `map` emits the ids in array order, but `each` opens one invocation per id and those invocations run concurrently. Because **interleaving across concurrent `each` invocations' outputs** is implementation-defined, the order in which results arrive at the `buffer`, and so the element order of the single array it emits, is not guaranteed. Example 4 guarantees the *multiset* of results, not the *sequence*: a consumer reading `[Alice, Bob, Carol]` positionally relies on one implementation's scheduling, not on this format. The "single linear path" of edges is a red herring — the `each` node is a concurrency point sitting on it.

A second instance is concurrent paths racing a shared sink. A `map` or fan-out feeding both an `output` path and an `exit` does not guarantee *how many* events reach `output` before the `exit` fires; `exit` terminates "when an event reaches this node," and which concurrently-in-flight events were already emitted is a timing property the [identity law](#transparency-the-identity-law)'s equivalence surface excludes.

Both are removed by the techniques above, not by assuming a schedule. The exit race also has a structural fix: route the racing events through a `buffer`, whose partial contents an `exit` discards (it never emits mid-race), so the early return is deterministic. Pinning an order the engine does not promise is the most common portability defect in operation graphs.

## Runtime context

Transform and filter expressions evaluate with:

- `$` — the current event.
- `$input` — the **root input event of the current event's lineage**: the caller-written value this event descends from. Immutable. For an event descending from a merge (`buffer` flush, `combine` emission, or an `operation` conduit written from multiple lineages), `$input` is defined if and only if all contributing events share one root; otherwise `$input` is unbound (undefined) during evaluation. The expression's overall result then governs, per the undefined-result rule under [Transforms](#transforms): an expression whose result is undefined fails the node with `TRANSFORM_UNDEFINED`, while an expression that handles the undefined `$input` and yields a defined result proceeds normally (a `filter` expression yielding a defined falsy result drops the event as usual). In a graph invoked with a single write — the common case — every event shares that root and `$input` behaves as a constant.

There is no accumulated state (`$steps` or similar). Events carry their own data; if a downstream node needs upstream data, it must flow through the edges, or via `$input`, or via the [per-event scoping idiom](#per-event-scoping-idiom-informative).

## Validation rules

The following rules apply to each operation graph definition (the value at which a binding's `ref` resolves). Enforcement is a tool obligation: a tool acting on an operation-graph binding MUST validate the graph against these rules before acting on it ([OG-T-01](#conformance)). Each rule carries a stable identifier (`OG-V-##`) so validators, fixtures, and errata can cite it unambiguously; identifiers are stable within a major version of this format and MUST NOT be reused or renumbered. The per-node field-presence requirements marked (REQUIRED) in the node definitions above are equally normative and are encoded by this format's JSON Schema; a validator applies both the enumerated rules and node well-formedness.

- **OG-V-01**: The graph MUST declare an `openbindings.operation-graph` field matching the SemVer 2.0.0 pattern.
- **OG-V-02**: The graph MUST contain exactly one node with `"type": "input"`.
- **OG-V-03**: The graph MUST contain exactly one node with `"type": "output"`.
- **OG-V-04**: The `input` node MUST NOT be the target of any edge.
- **OG-V-05**: The `output` node MUST NOT be the source of any edge.
- **OG-V-06**: Every node MUST be reachable from the `input` node by transitively following edges and `onError` references (no orphan nodes).
- **OG-V-07**: Every edge MUST reference valid node keys in both `from` and `to`.
- **OG-V-08**: There MUST NOT be duplicate edges (same `from` and `to` pair).
- **OG-V-09**: Every cycle in the graph MUST contain at least one `each` node with `maxIterations` declared. Cycle detection follows both data edges and `onError` references: an `onError` route is a control edge for this purpose.
- **OG-V-10**: `operation` nodes MUST NOT participate in any cycle (following data edges and `onError` references).
- **OG-V-11**: `operation` and `each` nodes MUST reference operations that exist in the containing OBI's `operations` map.
- **OG-V-12**: `filter` nodes MUST have exactly one of `schema` or `transform`.
- **OG-V-13**: `buffer` nodes MUST NOT have both `until` and `through`.
- **OG-V-14**: Every node MUST have a `type` whose value is one of the types defined by this specification (`input`, `output`, `operation`, `each`, `transform`, `filter`, `map`, `buffer`, `combine`, `exit`). A graph containing any other `type` is not a conformant graph of this format version; a tool acting on such a binding MUST fail it rather than execute partially.
- **OG-V-15**: If a node declares `onError`, the referenced node key MUST exist in the graph.
- **OG-V-16**: `exit` nodes MUST NOT have any outgoing edges.
- **OG-V-17**: The `input` and `output` nodes MUST NOT declare `onError`. The boundary nodes are not invocations of their own and cannot fail as nodes; only processing nodes support `onError` (see [Node model](#node-model)).

**Diagnostics (non-normative).** Validators SHOULD warn when a multi-emission path (e.g., a `map`) feeds an `operation` node — usually a missing `each` — and MAY warn when none of the `input` node's direct consumers is an `operation` node, since back-closure considers only direct consumers ([Input-side closure](#input-side-closure-back-closure)) and such a graph's callers always own input closure. The latter covers the `input → transform → operation` shape, which does not back-close like the bare wrapper even though an `operation` node sits one hop away; see [Deferred from 0.2.0](#deferred-from-020) (transitive back-closure).

These rules apply to the graph definition itself; the enclosing JSON document has no specified shape and is not subject to validation by this specification.

## Conformance

A tool's obligations follow the capabilities it exercises, mirroring the [core specification's conformance model (§14.1)](../../openbindings.md#141-tool-obligations). Tool rules carry stable identifiers (`OG-T-##`) under the same stability guarantee as the validation rules: stable within a major version of this format, never reused or renumbered.

- **OG-T-01** (acting on an operation-graph binding: validating, generating code, invoking): MUST validate the target graph definition against the [validation rules](#validation-rules) (OG-V-01 through OG-V-17) and MUST fail the binding rather than act on a graph that violates them.
- **OG-T-02** (all processors): MUST refuse graphs declaring a higher major `openbindings.operation-graph` version than the tool supports, and MUST refuse graphs declaring a version below the minimum it supports; while this format is pre-1.0, both refusals extend to minor versions (a higher minor, or a lower minor outside the supported range, refuses). A tool MUST NOT accept a graph declaring a prerelease version unless it declares support for that specific prerelease. This mirrors the core spec's OBI-T-04, applied to this format's own version field.
- **OG-T-03** (executing graphs): MUST evaluate node expressions as JSONata 2.0, per the [core specification's Transforms section](../../openbindings.md#65-transforms) and the [Transforms](#transforms) rules of this document.
- **OG-T-04** (executing graphs): MUST implement the [Execution semantics](#execution-semantics), including the portable behavior in [Determinism and portability](#determinism-and-portability), and MUST satisfy the [identity law](#transparency-the-identity-law); the acceptance criterion is the identity-law test stated there.

The specification repository carries a conformance corpus for this format under `conformance/operation-graph/` — execution fixtures (including the identity-law suite), validation fixtures keyed to `OG-V-##` identifiers, and a reference runner. The corpus is the empirical check for these obligations; running an independent implementation against it unmodified is the intended conformance test.

## Extensions

- Graph definitions MAY include extension fields whose keys begin with `x-` at any object location within the graph (the graph itself, nodes, edges).
- Tools MUST ignore `x-` fields they do not understand.
- `x-` fields MUST NOT change the meaning of any defined field for purposes of validation, execution, or compatibility.

The enclosing JSON document is unconstrained, so extension schemes outside the graph definition are the host document's concern.

## Normative examples

### Example 1: The identity wrapper

```json
{
  "graphs": {
    "getUser": {
      "openbindings.operation-graph": "0.2.0",
      "nodes": {
        "in":  { "type": "input" },
        "get": { "type": "operation", "operation": "users.get" },
        "out": { "type": "output" }
      },
      "edges": [
        { "from": "in",  "to": "get" },
        { "from": "get", "to": "out" }
      ]
    }
  }
}
```

**Execution (unary selected binding)**: the caller writes `{ "id": "u1" }`; the event is written into the held `users.get` invocation; the inner binding reads it and closes its input; `get` becomes non-accepting; with `in`'s only consumer non-accepting, the graph closes the caller's input side — the caller never closes, exactly as with direct invocation. The invocation's single output flows to `out`. **Execution (other cardinalities)**: the same graph pipes every caller write into the one invocation and every output back out; for a client-streaming or bidirectional selected binding, the caller writes and closes exactly as it would directly. **Execution (terminal error)**: if the inner invocation terminates with an error, the graph invocation terminates with that error — `get` has no `onError`, so the conduit's fatal default applies and terminal status is preserved. This graph is the conformance anchor for the [identity law](#transparency-the-identity-law).

### Example 2: Pagination aggregation

Fetches pages in a cycle until no more exist, collects the results, returns the aggregate.

```json
{
  "graphs": {
    "paginateAll": {
      "openbindings.operation-graph": "0.2.0",
      "nodes": {
        "in": { "type": "input" },
        "fetchPage": {
          "type": "each",
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

**Execution trace**:

1. The caller writes `{ "filter": "active" }` and **closes input** (`in` feeds an `each`, so closure is caller-owned). The event roots a lineage and flows to `fetchPage`.
2. `fetchPage` invokes `items.fetchPage` once for the event → `{ "items": ["a","b"], "nextCursor": "pg2" }`. The output fans to `collectPages` (buffered) and `hasMore`.
3. `hasMore` passes (has `nextCursor`); `prepareCursor` produces `{ "filter": "active", "cursor": "pg2" }` (lineage preserved, `$input` is the root write); the event re-enters `fetchPage` — lineage count 2.
4. The second invocation returns `{ "items": ["c"] }` (no `nextCursor`); buffered; `hasMore` drops it. The cycle drains.
5. Completion propagates: `in` is complete (caller closed), the cycle is drained, `collectPages`' incoming edges complete → flush `[{...pg1}, {...pg2}]` → `aggregate` → `out` emits `{ "items": ["a","b","c"] }`.

### Example 3: Parallel combine

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

**Execution**: the caller's single write fans into both conduits, which run concurrently; each unary inner binding reads its one input and closes, both nodes become non-accepting, and the graph back-closes the caller's input. `combine` waits for readiness and emits one object: `{ "customer": {...}, "orders": [...] }`. Single-emission sources, fully portable.

### Example 4: Map and collect

```json
{
  "graphs": {
    "getAllUserDetails": {
      "openbindings.operation-graph": "0.2.0",
      "nodes": {
        "in": { "type": "input" },
        "listUsers": { "type": "operation", "operation": "users.list" },
        "unpack": { "type": "map", "transform": "ids" },
        "getDetails": { "type": "each", "operation": "users.get" },
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

**Execution**: the caller writes `{}`; `listUsers` (a conduit) returns `{ "ids": ["u1","u2","u3"] }` and back-closes the input; `unpack` emits three events; `getDetails` opens three invocations (possibly concurrent), one per id; `collect` flushes the three results when `getDetails` completes; `out` emits the array, whose element order is not guaranteed because `getDetails` runs concurrently (see [What is not guaranteed](#what-is-not-guaranteed-informative)). The `map → each` pairing is the canonical per-item pattern; `map → operation` here would pipe three ids into one unary invocation and reject two — the diagnostic case.

### Example 5: Per-event parallel join via nesting

A stream of order ids, each enriched by a per-event parallel join. The join lives in a nested single-write graph (Example 3), referenced as an operation:

```json
{
  "graphs": {
    "enrichOrders": {
      "openbindings.operation-graph": "0.2.0",
      "nodes": {
        "in": { "type": "input" },
        "enrich": { "type": "each", "operation": "orders.enrichOne" },
        "out": { "type": "output" }
      },
      "edges": [
        { "from": "in", "to": "enrich" },
        { "from": "in", "to": "out" },
        { "from": "enrich", "to": "out" }
      ]
    }
  }
}
```

Here `orders.enrichOne` is bound to the `enrichOrder` graph of Example 3. The caller streams order events and closes when done; each event receives its own sub-invocation, whose internal `combine` is scoped to exactly that event. Invocation scope one level down is lineage scope: this is how per-lineage joins and batches are expressed without per-lineage primitives. (The `in → out` edge also passes the raw events through, illustrating fan-out; omit it to emit enrichments only.)

### Example 6: Streaming fan-out with filters

```json
{
  "graphs": {
    "routeEvents": {
      "openbindings.operation-graph": "0.2.0",
      "nodes": {
        "in": { "type": "input" },
        "stream": { "type": "operation", "operation": "events.subscribe" },
        "isError": { "type": "filter", "schema": { "required": ["error"] } },
        "isSuccess": { "type": "filter", "transform": "$not($exists(error))" },
        "handleError": { "type": "each", "operation": "errors.log" },
        "handleSuccess": { "type": "each", "operation": "results.store" },
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

**Execution**: the caller's subscription request is piped into one `events.subscribe` invocation; its output stream fans through the filters; each routed event gets its own handler invocation; results from both paths reach `out`. The graph completes when the subscription's output completes.

### Example 7: Error handling with `onError`

```json
{
  "graphs": {
    "fetchWithFallback": {
      "openbindings.operation-graph": "0.2.0",
      "nodes": {
        "in": { "type": "input" },
        "fetchDetail": {
          "type": "each",
          "operation": "items.get",
          "timeout": 5000,
          "onError": "fallback"
        },
        "fallback": {
          "type": "transform",
          "transform": "{ \"id\": event.id, \"name\": \"unknown\", \"error\": error }"
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

**Execution (error path)**: an item's fetch times out; the error event `{ "error": "TIMEOUT_EXCEEDED", "event": { "id": "item-1" } }` routes to `fallback`, which reads `event.id` and `error` as fields of the error event (distinct from `$input`, the lineage root) and emits `{ "id": "item-1", "name": "unknown", "error": "TIMEOUT_EXCEEDED" }` to `out`. Other items continue unaffected.

### Example 8: Fatal per-event error with `exit`

Conduit terminal errors are fatal by default (see [Errors](#errors)), so a bare `operation` node already terminates the graph on failure. Per-event failures at an `each` node are silent by default; this example makes any single item's failure fatal by wiring `onError` to an `exit` node:

```json
{
  "graphs": {
    "strictFetchAll": {
      "openbindings.operation-graph": "0.2.0",
      "nodes": {
        "in": { "type": "input" },
        "fetch": {
          "type": "each",
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

**Execution (error)**: one item's invocation times out; the error event `{ "error": "TIMEOUT_EXCEEDED", "event": { ... } }` routes to `die`; the graph terminates with the error event as the error detail. Previously emitted outputs are not retracted; in-flight invocations for other items are cancelled; the stream closes as failed. Without `onError`, the failed item would be dropped silently and the other items would proceed — Example 7's behavior minus the fallback.

## Security considerations

Operation graphs inherit the security considerations of the [core OpenBindings specification v0.2.0](../../openbindings.md#13-security-considerations), including transform evaluation sandboxing, artifact fetching restrictions, and schema processing limits. Format-specific concerns:

- **Event amplification**: `map` converts one event into many, and `each` converts each event into an invocation. A `map` inside a cycle is the primary amplification vector: N events per iteration under `maxIterations` M can reach N^M. Implementations SHOULD enforce a maximum total event count per graph invocation and terminate with an error when exceeded.
- **Cycle amplification**: fan-out within a cycle multiplies events per iteration; `maxIterations` bounds per-lineage invocations, not total event count.
- **Error chains**: `onError` routing can chain invocations in response to failures. The primary bound is normative: error events inherit lineage and `onError` routes count as cycle edges, so error loops must pass through an `each` with `maxIterations` (OG-V-09, OG-V-10). Implementations MAY additionally cap error-chain depth as defense in depth.
- **Held invocations**: `operation` conduits hold live invocations (and their connections) for the graph invocation's lifetime; the [Flow control](#flow-control) bounds and the caller's cancellation are the containment mechanisms.

## Deferred from 0.2.0

The following are out of scope for `openbindings.operation-graph@0.2.0` and candidates for future versions:

- **Reusable sub-graphs**: `$ref` within graphs to other graphs or shared node subgraphs. (Nesting via graph-bound operations covers reuse today; see the [per-event scoping idiom](#per-event-scoping-idiom-informative).)
- **Per-event regions**: an inline subgraph instantiated per event, scoping `buffer` and `combine` per lineage natively. `each` is the special case `region(operation)`; the nesting idiom covers the general case meanwhile.
- **Transitive back-closure**: propagating non-acceptance backward through pure nodes (`transform`, `filter`, `map`) so that `input → transform → operation` back-closes like the bare wrapper. Today back-closure considers only the `input` node's direct consumers.
- **Combine timeout**: emitting a combined object before readiness, on a timer, with `null` for not-yet-produced sources.
- **Time-based buffer windows**: flush conditions based on elapsed time.
- **Tee (emit and continue)**: emitting to `output` while forwarding along the same path. Achievable today via fan-out.
- **Detach mode**: running a side-effect branch independently of the graph invocation's lifecycle.
