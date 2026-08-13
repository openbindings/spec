# Invocation-fidelity loop status

This is a working engineering tracker, not normative binding-specification
text. Its pass condition is the protocol-blind brownfield goal described in
[`ABSTRACTION-FIDELITY.md`](../../ABSTRACTION-FIDELITY.md): within declared
coverage, a synthesized OBI must be as useful for invoking and consuming the
abstract operation as bespoke binding code, without requiring the caller to
know or inspect the selected protocol.

This is not native-client observational equivalence. Some concrete protocol
information is intentionally absent from the ordinary operation surface.
Native differential checks remain valuable for proving the binding
implementation underneath that surface.

Lifecycle shape remains binding-emergent. This loop never adds cardinality,
half-close, cancellation, ordering, or completion fields to the core OBI
model. It observes their caller-facing effects through the selected binding.

## Gates

1. **Concrete binding correctness** — the family implementation constructs
   and performs the governed native interaction correctly, using native facts
   internally where necessary. Native-client and scripted-peer differentials
   are the principal oracle for this gate.
2. **Synthesis abstraction** — synthesis retains source carriage, target
   identity, exact ref, required interpretation points, and every supported
   operation, while deriving schemas only from application-level declarations.
   It never recompiles protocol observations into operation fields. An
   unrepresentable operation is excluded loudly with a reason.
3. **Operation value and interaction fidelity** — the ordinary caller receives
   the correct application values, ordering, partial outputs, closure,
   cancellation, and normal or unsuccessful completion.
4. **Protocol blindness** — the same operation can be used correctly without
   knowing the selected binding. Removing access to raw status, metadata,
   frames, and bytes cannot break correct ordinary use.
5. **Lower-layer evidence separation** — native evidence used for artifact
   runtime verification stays below the OpenBindings bridge and is not
   required for ordinary operation use or treated by itself as proof that the
   abstract-operation gates pass.

No family is complete until all five gates pass adversarial scenarios in both
reference SDKs.

## Alignment decisions

The doctrine itself adds no OBI document fields. The initial contract review is
complete:

1. **Core OBI-B-02 item 7** now requires correct classification, unsuccessful
   completion, and treatment of prior outputs; raw native evidence remains
   below the abstract boundary. No document-model field changed.
2. **Binding-invoker 0.1** now uses structural unsuccessful completion and an
   exact `{code,data?}` record. `data` is JSON-domain data defined by the rule
   that owns the code or opaque application-authored failure data admitted by
   the governing binding specification. There is no portable message,
   details, diagnostics, closed category, retry-effect, or status-mapping
   system.
3. **Binding-family candidates** were audited before first publication. Every
   active family remains an unreleased `@1` candidate. The corrected GraphQL,
   MCP, OpenAPI, and AsyncAPI operation boundaries are therefore part of their
   first proposed revision; there are no older published meanings or
   compatibility revisions to retain.
4. **Authorial failure data** is distinguished from native evidence: governing
   binding rules may preserve an opaque application-authored JSON failure
   value, while protocol containers remain below the bridge. This introduces no
   universal failure vocabulary or OBI schema field.
5. **Consumer projections** were audited through the `ob` CLI and browser
   workbench. Both preserve prior outputs and structural unsuccessful
   completion without requiring binding identity, native metadata, or the
   removed presentation, diagnostics, category, and effects fields.
6. **Human-readable prose has no privileged error lane.** Application-authored
   prose may survive only inside an admitted application `data` value. Raw
   status lines, process facts, library wrappers, hook provenance, and local
   exception messages do not cross the abstract record.

No item in this queue is permission to add an error, metadata, lifecycle, or
protocol-evidence field to an OBI operation. Any future core document-model
proposal is a separate, advance design decision.

## Family matrix

| Family | Concrete binding evidence | Joined synthesis/operation evidence | Protocol-blind differential | Highest-priority remaining abstraction debt |
| --- | --- | --- | --- | --- |
| OpenAPI | Independent native-client and loopback HTTP scenarios, including bounded non-2xx/SSE capture, response-range/raw-byte fixtures, dynamic objects, declaration-complex JSON bodies, and schema-omitted OAS 3.0 byte bodies. | The complete first `openbindings.openapi@1` candidate is joined in both SDKs over the standalone runtime. | Passes for protocol-blind Base64 request and response boundaries, including exact schema-omitted OAS 3.0 representations; artifact-encoded strings; request and response media ranges; pre-input context; SSE selected through ranges; explicit dynamic JSON/form/multipart objects; declaration-complex exact JSON values; and the prior request/response slice. | Artifact-defined codecs without a generic application-value decoder remain explicit coverage limits; omitted-open form/multipart schemas remain an authority-backed audit target rather than being inferred from corpus frequency. |
| AsyncAPI | Standalone artifact runtimes, built-in HTTP/WebSocket drivers, injectable arbitrary-protocol drivers, separately packaged MQTT 3.1.1 and Kafka profiles, and native integration peers. | The complete first `openbindings.asyncapi@1` candidate is joined in both SDKs over the standalone runtime for AsyncAPI 2.0.0–2.6.0 and 3.0.0–3.1.0. | The supported 250-artifact corpus envelope is exactly equal across SDKs for 247/247 valid artifacts. MQTT and Kafka both have live TypeScript/Go and real OpenBindings-bridge evidence. Kafka additionally proves topic/key/group/client interpretation, transient broker-loss recovery without losing prior output, and SCRAM-SHA-256 supplied through abstract username/password context without protocol fields crossing the operation boundary. | Message headers and unavailable codecs remain explicit value-boundary exclusions. Protocols without a qualified installed driver remain execution gaps. MQTT TLS/X509, persistent sessions, and Last Will retain their recorded boundaries. Kafka TLS/X509, SASL/PLAIN, SCRAM-SHA-512, Schema Registry framing, tombstones, dynamic per-record keys, and replies retain explicit excluded or unqualified cells in its authority matrix. |
| gRPC | Real in-memory gRPC server in Go, scripted runtime in TypeScript, plus native integration suites. | Joined in both SDKs. | Passes for streaming partial failure, lower-layer rich-status verification, and later-input cancellation without exposing native status. | Artifact-coverage loop only; no known abstraction-boundary debt. |
| Connect | Scripted unary and streaming Connect peers. | Joined in both SDKs. | Passes for values and partial failure while END_STREAM evidence remains below the bridge. | Artifact-coverage loop only; no known abstraction-boundary debt. |
| GraphQL | HTTP peers for aliases, transport failure, and partial data plus errors. | The first `openbindings.graphql@1` candidate is joined in both SDKs. | Passes for query/mutation; native envelopes remain below the bridge. | Subscriptions remain an explicit first-candidate lifecycle exclusion. |
| MCP | Scripted Streamable HTTP/JSON-RPC peers. | The first `openbindings.mcp@1` candidate is joined in both SDKs. | Passes for structured application result and all unsuccessful-completion classes. | Targets without an application output contract remain explicit first-candidate exclusions. |
| Usage | Controlled process runtimes plus native process integration suites. | Joined in both SDKs. | Passes for output values, exit/signal failure, and decode failure. | Artifact-coverage loop only; process evidence remains below the bridge. |
| Operation Graph | Portable identity-law and execution corpus against nested operation invocations. | Not applicable: the graph composes operations already declared by its containing OBI and carries no standalone operation contract to synthesize. | Passes through direct-versus-wrapped identity cases in both SDKs. | Deliberately invocation-only; advertising standalone synthesis would require invented schemas. |

There are 32 fidelity scenarios across the seven active brownfield synthesis
families, all joined by both reference SDKs. The separate Operation Graph
identity-law corpus covers the eighth candidate family. The joined slice
closes the abstraction-boundary proof for its currently declared coverage. It
does **not** claim that every artifact in the wild is covered; coverage
exclusions and implementation losses continue through the measured family
development loop.

The OpenAPI qualification evaluated 170 independently sourced GitHub artifacts
spanning 1,301 semantic signatures. The corpus is an internal qualification
asset and is not redistributed; its sealed holdout cohorts are committed by
the SHA-256 seals recorded in [`../EVIDENCE-POLICY.md`](../EVIDENCE-POLICY.md). Of the 152-artifact supported envelope,
151 produced structurally identical Go and TypeScript OBIs and exhaustive
coverage ledgers (99.34%); the sole residual was a validation-equivalent JSON
Schema `$ref` versus inline representation, not an invocation difference.
Successive development passes closed routed-input collisions, response ranges,
raw request and response bytes, dynamic objects, and declaration-complex JSON
without minting any binding-specification identifier. Thirteen
authority-authored wire cases, the sealed 25-repository holdout, and the
40-repository development differential produced no OpenBindings wire or
application mismatch. No result demonstrated a Core-model or
binding-specification-concept limitation.

The AsyncAPI qualification evaluated 250 immutable corpus artifacts from 250
independent GitHub repositories and 206 owners, split into a 187-repository
development cohort and a 63-repository holdout sealed before implementation
tuning (cohort seal
`ad9a78e13914a343f1e7dc37a7de22b749e0fbbbceba1995b17a83c59663a3da`; this
corpus is likewise internal and not redistributed). The distilled
qualification report, including the holdout's recorded disclosure during the
WebSocket reply loop, is
[`../abstraction-fidelity/ASYNCAPI-FIDELITY.md`](../abstraction-fidelity/ASYNCAPI-FIDELITY.md).
All 51 authority-derived semantic cells occurred in development. The
current first-revision candidate refuses unsupported request/reply sessions
before establishment and delegates arbitrary concrete protocols through an
explicit driver boundary. Its first Kafka profile delegates to Confluent's
librdkafka-backed JavaScript client and franz-go under a 31-cell authority
matrix. Go and TypeScript produced exactly equal OBIs and
exhaustive coverage ledgers for all 247 independently adjudicated valid
artifacts (100%). The sole raw residual is an invalid external YAML closure
tolerated by one parser and remains recorded outside the supported-artifact
denominator. No Core prose, OBI document field, invocation frame, or
protocol-blind output shape changed. The AsyncAPI layer now classifies
`scramSha256` and `scramSha512` as the existing abstract username/password
credential family while preserving the raw declaration for the driver; this
is a binding-layer context interpretation, not a Core vocabulary addition.

## Loop

For the next pending family or counterexample:

1. state the protocol-independent application value and interaction behavior
   the operation is meant to provide;
2. inventory the native facts the binding must consume internally to provide
   it;
3. classify every observation as application contract, emergent interaction
   behavior, or lower-layer evidence;
4. add adversarial abstract-operation and concrete-binding cases before
   changing implementation;
5. run both SDK adapters and classify each failure as core concept,
   binding-specification, synthesis, invoker, or SDK debt;
6. change only the narrowest owning layer, using the minimum new semantics and
   refusing instead of inventing;
7. prove the joined protocol-blind round trip, then use native differentials
   to diagnose any lower-layer mismatch;
8. repeat until no counterexample remains, recording deliberate coverage
   exclusions rather than approximating them.
