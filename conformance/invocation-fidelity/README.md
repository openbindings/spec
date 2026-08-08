# Invocation-fidelity corpus

This corpus tests the project goal that a synthesized OBI remains as useful for
invocation as the supported brownfield artifact from which it was produced.
It is deliberately separate from the binding-specification P-rule corpus:
published family prose remains the conformance authority, while these
scenarios test the stronger end-to-end preservation floor described by the
binding-specification authoring guidance and core OBI-B-02.

Each scenario runs the real family invoker against a scripted native peer and
observes both ordinary outputs and unsuccessful completion. The normalized
`error` record is the project binding-invoker presentation used by the
reference SDKs; it is not a core error value and never enters an operation's
`output`. Assertions under `error.details` prove that source-native evidence
survives the implementation boundary. Separate frame tests prove that the same
evidence survives the transport-neutral invoker frame representation. The
All active-slice SDKs expose those records through typed failure-evidence
accessors, so the test is about caller-usable evidence rather than an
unreachable internal capture.

The active vertical slices cover OpenAPI, gRPC, Connect, GraphQL, MCP, and Usage.
Further slices add the native success, failure, partial-output, metadata,
cancellation, and completion distinctions of every supported family. A family does not exit the
loop merely because this binding-level gate passes: the project goal also
requires a synthesis-to-operation-invocation round trip and differential
comparison with a native client. The current state and remaining gates are
tracked in [STATUS.md](./STATUS.md).
