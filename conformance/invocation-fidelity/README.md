# Invocation-fidelity corpus

This corpus tests the project goal that a synthesized OBI remains as useful
for invoking and consuming an abstract operation as bespoke binding code for
the supported brownfield source. The governing boundary is the informative
[`ABSTRACTION-FIDELITY.md`](../../ABSTRACTION-FIDELITY.md): correct ordinary
use must not require knowing which binding or protocol was selected.

It is deliberately separate from the binding-specification P-rule corpus.
Published family prose remains the conformance authority; these scenarios
exercise the joined source → synthesis → binding invocation → operation
surface.

## Two evidence layers

The corpus keeps two kinds of evidence separate.

1. **Abstract-operation evidence** observes caller-facing application values,
   ordering, partial outputs, input closure, cancellation, and normal or
   unsuccessful completion. It excludes protocol-shaped status, header,
   trailer, framing, and byte assertions. This layer decides whether the
   OpenBindings fidelity goal is met.
2. **Concrete-binding evidence** compares the implementation with a native
   client or scripted peer. It may assert exact statuses, metadata, frames, or
   bytes to prove request construction, decoding, classification, and other
   internal binding behavior. This is an implementation oracle;
   equality here does not require those facts to cross the ordinary operation
   boundary.

Artifact runtimes, native-client differentials, logs, and traces may retain
native evidence below the abstract invocation boundary. The abstract
`InvocationError` has exactly `code` and optional `data`; `data` is reserved
for interface- or binding-owned portable data, including an opaque
application-authored failure value identified by governing binding rules. It
is never a native-evidence catchall. Frame-relay tests likewise validate an
optional invoker interface rather than enlarge the OBI document model.

The active slices cover the seven candidate families that accept a standalone
brownfield source from which an application operation contract can be derived:
OpenAPI, AsyncAPI, gRPC, Connect, GraphQL, MCP, and Usage. Every slice executes
the joined source → synthesis → operation-invocation path in both reference
SDKs. OpenAPI also runs an independent native-client differential; the other
families use controlled protocol peers or process runtimes, with native
integration suites supplying additional lower-layer evidence. Exact statuses,
metadata, envelopes, frames, bytes, and process results are asserted only in
lower artifact runtimes, protocol harnesses, or out-of-band tooling. The
abstract assertions are application values, ordering, partial outputs, and
completion behavior.

The project also publishes `openbindings.operation-graph@1`. It is an
invocation-only composition binding, not an eighth standalone synthesis
source: a graph names operations in its containing OBI and deliberately does
not redeclare their application input/output contracts. Inventing those
contracts from the graph would violate the synthesis boundary. Its invocation
fidelity is covered by the separate portable Operation Graph identity-law and
execution corpus in both SDKs; it is not counted as a joined brownfield
synthesis slice.

The current state and remaining gates are tracked in
[`STATUS.md`](STATUS.md).
