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
5. **Diagnostic separation** — any retained native evidence is explicitly
   diagnostic, stays out of operation values, and is not treated as proof by
   itself that the abstract-operation gates pass.

No family is complete until all five gates pass adversarial scenarios in both
reference SDKs.

## Alignment decisions

The doctrine itself adds no OBI document fields. The initial contract review is
complete:

1. **Core OBI-B-02 item 7** now requires correct classification, unsuccessful
   completion, and treatment of prior outputs; raw native evidence may be
   binding-internal or diagnostic. No document-model field changed.
2. **Binding-invoker 0.1** now uses structural unsuccessful completion, open
   codes, narrowly defined portable/application details, and an explicit
   diagnostics lane. The closed category, retry-effect, and status-mapping
   system was removed.
3. **Published family revisions** were audited without rewriting immutable
   releases. Usage revision 1 was restored to its publication; MCP revision 2
   and GraphQL revision 2 were published where the operation-value boundary
   required an incompatible correction.
4. **Authorial failure data** is distinguished from native evidence: governing
   binding rules may preserve an opaque application-authored JSON failure
   value, while protocol containers remain diagnostic. This introduces no
   universal failure vocabulary or OBI schema field.
5. **Consumer projections** were audited through the `ob` CLI and browser
   workbench. Both preserve prior outputs and structural unsuccessful
   completion without requiring binding identity, native metadata, or the
   removed closed category/effects model; diagnostics remain opt-in.
6. **Human-readable failure prose** follows the same abstraction boundary as
   structured data. Application-authored messages survive without their
   protocol wrapper; raw status lines, process facts, library wrappers, and
   hook provenance do not cross the ordinary message field.

No item in this queue is permission to add an error, metadata, lifecycle, or
protocol-evidence field to an OBI operation. Any future core document-model
proposal is a separate, advance design decision.

## Family matrix

| Family | Concrete binding evidence | Joined synthesis/operation evidence | Protocol-blind differential | Highest-priority remaining abstraction debt |
| --- | --- | --- | --- | --- |
| OpenAPI | Independent native-client and loopback HTTP scenarios, including bounded non-2xx/SSE capture, response-range/raw-byte fixtures, and dynamic object-body carriage. | Revision 5 is joined in both SDKs; immutable revisions 4, 3, 2, and 1 remain exact compatibility paths. | Passes for protocol-blind Base64 request and response boundaries, artifact-encoded strings, request and response media ranges, pre-input context, SSE selected through ranges, explicit dynamic JSON/form/multipart objects, and the prior request/response slice. | Artifact-defined codecs without a generic application-value decoder remain explicit coverage limits; omitted-open form/multipart schemas remain an authority-backed audit target rather than being inferred from corpus frequency. |
| AsyncAPI | HTTP and WebSocket protocol peers plus native integration suites. | Joined in both SDKs. | Passes for supported HTTP publish and WebSocket subscription cells. | Unsupported protocol/action cells remain explicit binding coverage exclusions. |
| gRPC | Real in-memory gRPC server in Go, scripted runtime in TypeScript, plus native integration suites. | Joined in both SDKs. | Passes for streaming partial failure, rich status diagnostics, and later-input cancellation. | Artifact-coverage loop only; no known abstraction-boundary debt. |
| Connect | Scripted unary and streaming Connect peers. | Joined in both SDKs. | Passes for values, partial failure, and END_STREAM diagnostics. | Artifact-coverage loop only; no known abstraction-boundary debt. |
| GraphQL | Revision-2 HTTP peers for aliases, transport failure, and partial data plus errors. | Joined in both SDKs. | Passes for query/mutation; native envelopes remain diagnostic. | Subscriptions remain an explicit revision-2 lifecycle exclusion. |
| MCP | Scripted Streamable HTTP/JSON-RPC peers. | Joined in both SDKs. | Passes for structured application result and all unsuccessful-completion classes. | Targets without an application output contract remain explicit revision-2 exclusions. |
| Usage | Controlled process runtimes plus native process integration suites. | Joined in both SDKs. | Passes for output values, exit/signal failure, and decode failure. | Artifact-coverage loop only; process evidence remains diagnostic. |
| Operation Graph | Portable identity-law and execution corpus against nested operation invocations. | Not applicable: the graph composes operations already declared by its containing OBI and carries no standalone operation contract to synthesize. | Passes through direct-versus-wrapped identity cases in both SDKs. | Deliberately invocation-only; advertising standalone synthesis would require invented schemas. |

There are 30 fidelity scenarios across the seven active brownfield synthesis
families, all joined by both reference SDKs. The separate Operation Graph
identity-law corpus covers the eighth published binding family. The joined
slice closes the abstraction-boundary proof for its currently declared
coverage. It does
**not** claim that every artifact in the wild is covered; coverage exclusions
and implementation losses continue through the measured family development
loop.

The 2026-08-09 OpenAPI revision-3 closure pass evaluated 170 independently
sourced GitHub artifacts spanning 1,301 semantic signatures. Eighteen were
adjudicated invalid under their declared OAS edition. Of the 152-artifact
supported envelope, 151 produced structurally identical Go and TypeScript
OBIs and exhaustive coverage ledgers (99.34%); the sole residual was an
equivalent JSON Schema `$ref` versus inline representation, not an invocation
or validation difference. Twelve authority-authored wire cases produced zero
OpenBindings wire or application mismatches in both SDKs, and the 25-repository
sealed holdout produced no OpenBindings mismatch. No corpus observation
demonstrated a Core-model or binding-concept limitation. These measurements do
not promote corpus frequency to authority: eight absent semantic-matrix cells
remain adversarial-fixture obligations. Revision 4 closes the response-range
and artifact-authorized raw-response exclusions without changing the Core
document model; the remaining exclusions continue through the next loop.

The revision-4 closure reran the complete corpus and anti-overfitting gates
against `openbindings.openapi@4`. The same 152-artifact supported envelope
again produced 151 exact cross-SDK results (99.34%); the only residual remained
the validation-equivalent Radarr `$ref` versus inline representation, affecting
eight operations and no accepted instance set. The 12 authority-authored wire
cases again produced zero OpenBindings wire or application mismatches in both
SDKs, and the 25-repository sealed holdout again produced zero OpenBindings
mismatches. Revision-4 response carriage is additionally covered by joined
processor and fidelity fixtures for OAS 3.0 binary schemas, OAS 3.1
schema-omitted raw bytes, concrete response selection through media ranges,
range-selected JSON, and range-selected SSE. No revision-4 result demonstrated
a Core-model or binding-specification-concept limitation.

The revision-5 closure repeated those gates against
`openbindings.openapi@5` and added authority-derived `patternProperties`,
explicit `additionalProperties`, and `allOf` dynamic-object cases. Explicitly
dynamic object bodies now remain one protocol-neutral application object while
the binding-private transform carries that object to the selected native body;
finite named object bodies retain the prior flat operation surface. Across the
same 152-artifact supported envelope, 151 artifacts again produced exact Go
and TypeScript synthesis (99.34%). The sole residual is the same
validation-equivalent Radarr `$ref` versus inline representation and affects
no invocation behavior. Twelve authority-authored wire cases, the sealed
25-repository holdout, and the 40-repository development differential produced
no OpenBindings wire or application mismatch. A cross-SDK transform mismatch
found by the exact-parity gate exposed and corrected a Go empty-route
`null`-versus-array defect; it required no Core or binding-concept change. No
revision-5 result demonstrated a Core-model or binding-specification-concept
limitation. The `ob` cross-surface dogfood gate separately found that local
source-key remapping discarded synthesized binding transforms; preserving the
complete binding entry and composing its private route with the public contract
adaptation closed that application-layer loss without changing either model.

## Loop

For the next pending family or counterexample:

1. state the protocol-independent application value and interaction behavior
   the operation is meant to provide;
2. inventory the native facts the binding must consume internally to provide
   it;
3. classify every observation as application contract, emergent interaction
   behavior, or diagnostic evidence;
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
