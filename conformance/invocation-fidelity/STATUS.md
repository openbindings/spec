# Invocation-fidelity loop status

This is a working engineering tracker, not normative binding-specification
text. Its pass condition is the brownfield goal: for every supported source
artifact and interaction in the declared coverage range, a synthesized OBI can
drive an invocation without erasing a source-native semantic distinction that
a bespoke client using that same artifact could observe.

Lifecycle shape remains binding-emergent. This loop never adds cardinality,
half-close, cancellation, ordering, or completion fields to the core OBI
model. It observes those facts through the selected binding's invocation.

## Gates

1. **Binding preservation** — the family invoker preserves native success
   values, failure evidence, partial outputs, metadata, and completion facts.
2. **Synthesis preservation** — synthesis retains the source carriage, target
   identity, exact ref, required interpretation points, and every supported
   operation; an unrepresentable operation is excluded loudly with a reason.
3. **Operation relay** — the operation invoker changes none of the binding
   outputs, terminal classification, effects, details, or metadata.
4. **Frame relay** — a transport-neutral invoker-frame round trip changes none
   of those observations.
5. **Differential round trip** — source artifact → synthesized OBI → operation
   invocation is compared with a native client against the same scripted peer.
   Every observable semantic distinction must match or be an explicitly named,
   intentional presentation difference with lossless native evidence.

No family is complete until all five gates pass adversarial scenarios in both
reference SDKs.

## Family matrix

| Family | Gate 1 | Gates 2–4 | Gate 5 | Highest-priority remaining fidelity debt |
| --- | --- | --- | --- | --- |
| OpenAPI | Passing: 4 scenarios | Joined source → synthesis → operation invocation passes in Go and TypeScript, including generic relay | Joined round trip passes; independent native-client comparator pending | Non-2xx SSE bodies are currently not captured; bounded oversized failure responses and Fetch header coalescing need explicit evidence semantics. |
| gRPC | Passing: 3 scenarios | Separate synthesis corpus and relay tests pass; joined proof pending | Pending | Prove rich-status and binary metadata parity against real grpc-go/grpc-js peers; Go does not expose the original serialized `grpc-status-details-bin` as a whole, though every Any payload is preserved. |
| Connect | Passing: 3 scenarios | Separate synthesis corpus exists; joined relay proof pending | Pending | Fetch may coalesce some repeated HTTP fields; adversarial malformed-envelope evidence and full-duplex native-peer parity remain. |
| GraphQL | Passing: 3 scenarios | Separate synthesis/processor tests pass; joined proof pending | Pending | Add adversarial close-frame and connection-ack payload cases, and prove browser/runtime header parity. In-band GraphQL `errors`, legacy HTTP evidence, and protocol `error` payloads are preserved. |
| MCP | Passing: 4 scenarios | Separate synthesis/processor tests and generic relay tests pass; joined proof pending | Pending | Add adversarial SSE failure and session-termination cases; response size remains a named SDK-bound exclusion. Complete `isError`, JSON-RPC, and exact HTTP evidence now share a typed preservation lane. |
| Usage | Passing: 4 scenarios | Separate synthesis/processor tests and generic relay tests pass; joined proof pending | Pending | TypeScript's default executor still needs explicit bounded capture, and real cross-platform signal-name parity needs adversarial tests. Exit/signal, exact bytes, decode failure, and truncation facts now share a typed preservation lane. |
| AsyncAPI | Pending | Separate synthesis/processor tests only | Pending | Audit each supported protocol cell independently: HTTP failure bytes, WebSocket close facts, broker reason codes/properties, acknowledgements, and subscription termination evidence. Synthesis exclusions must remain loud until cells are implemented. |

## Loop

For the next pending family:

1. inventory every native observation at the accepted protocol boundary;
2. add adversarial corpus cases before changing implementation;
3. run both SDK adapters and classify each failure as core-concept,
   binding-specification, or implementation debt;
4. change the narrowest layer that owns the loss;
5. expose typed evidence, then prove in-process and frame relay;
6. add the joined synthesis/differential gate;
7. repeat until no counterexample remains, recording any deliberate coverage
   exclusion rather than approximating it.
