# OpenAPI 2.0 candidate: migration to OpenBindings 0.2

The [active candidate](openbindings.openapi-2.0.md) uses the OpenBindings 0.2.0
core model. It is an unreleased proposal for `openbindings.openapi-2.0@1`.
This record describes migration and evidence; it adds no interpretation rules
and makes no publication or SDK-support claim.

The shared [value-flow example](../openapi-value-flow.md) traces source and
binding content, caller input, `each/up`, absence/null, a native request and
response, and output adaptation. It is informative.

The [scope and limits index](../openapi-scope-limits.md) records reasons,
reopening conditions and unresolved design choices. Earlier review grades do not
establish readiness for the current candidates.

## Content migration

| Earlier draft | Current candidate |
| --- | --- |
| `source.bindingSpec` | `source.kind` |
| An OAS object/string directly in `source.content` | `{ "document": <object-or-string> }` inside `source.content` |
| Top-level `source.location` | `source.content.location`; also the retrieval base for embedded content |
| `binding.selector: "#/paths/..."` | `binding.content.target: "/paths/..."`, a literal string-form JSON Pointer |
| Core expression transforms | Optional kind-owned `binding.content.input` / `output` structural mappings |
| Prescribed processing phases and generation reports | Observable interpretation, truthful contract claims and implementation-specific diagnostics |

Mappings support selection, constants, object/array construction and ordered
array-item mapping with enclosing input. Arbitrary expressions and dynamic
object-key iteration need deliberate redesign, not a field rename. Application
contracts need not expose the intermediate HTTP request envelope. A source
location identifies a whole document: nonempty fragments are invalid, and an
empty fragment is removed before retrieval and base-URI use.

## Edition and completeness

The candidate incorporates OAS 2.0 and accepts `swagger` exactly `"2.0"`.
It retains this edition's schemes/host/basePath, consumes/produces, seven method
slots, body/formData parameters, collectionFormat, closed draft-04 Schema Object
vocabulary, readOnly request-property prohibition and entry-root
securityDefinitions. It imports no Server or Encoding Objects, style/explode,
anchors, schema dialects, callbacks, webhooks or sequential response model.
Default-only response maps are admitted; an absent response schema denotes no
body. Draft-04 constraints cannot be silently reinterpreted as current-core
JSON Schema during synthesis.

| [PB-02](../PROJECT-POLICY.md#pb-02-publication-completeness) item | Candidate answer |
| --- | --- |
| 1. Artifacts, representations and editions | §§1–2: exact edition, embedded object/text, acquired descriptions and referenced object roots |
| 2. Address interpretation and acquisition | §2: whole-document absolute URI, scheme resolver, successful acquisition and unavailable resources |
| 3. Source content and absence | §2: closed document/location wrapper with at least one member |
| 4. Composition and bases | §§2–3: embedded artifact precedence, contributing-document bases and entry-root mounted inheritance |
| 5. Target and binding content | §§3–4: literal path/method pointer and finite structural mappings |
| 6. Interaction and lifecycle | §§4–10: unary input, at most one complete success value, failure and cancellation |
| 7. Correspondence and runtime choices | §§4–11: routing, representation, security, prerequisites and faithful synthesis |

Independent reduction and completeness reviews passed the complete text at
SHA-256 `397afbf81fec6e41d279e7e47e5b7f52558d1ec1dacca63e3221cb0f52842b8d`.
The [independent interpretation suite](../../conformance/kinds/openapi-2.0/README.md)
passes 182 cases: 92 successful interactions, 75 predispatch refusals and 15
postdispatch failures that emit no values. It observes 109 real HTTP service
requests and 14 artifact acquisitions. Five complete synthesized OBIs are checked
against independent native expectations. Four semantic mutations are detected,
and three deliberately varied conforming wire presentations pass.
Run `node scripts/verify-openapi-20-kind.mjs` for the native suite and structural
checks of all 182 complete OBIs against the core schema. The suite's README
states the limits of its interpreter, codecs, transport and synthesis subset.

## Historical evidence and semantic changes

The old source fixtures and 211 processor/synthesis scenarios remain
[historical evidence](../../conformance/binding-specs/legacy/README.md), bound
to the frozen pre-kind draft. Their old fields, expression machinery, rule IDs,
phase labels and exact generated layouts do not govern this candidate. An old
runner's result does not establish support for the current kind.

This is more than shortening. General inline assertion validation is no longer
an implied invocation step; declaration and serialization checks remain, as do
OAS 2.0's explicit readOnly sender duties. Declared method payloads follow HTTP
sender conditions instead of the old blanket method exclusion. Empty-value
spellings and equivalent multipart metadata may vary while preserving data.
Repeated or overlapping media declarations do not create false ambiguity.
Multipart file media can come from context or the octet-stream fallback.

Exact numeric values replace silent rounding, YAML encoding detection replaces
UTF-8-only acquisition, and XML character encoding follows RFC 7303. Unused
unsupported projections are confined to the interactions that need them.
Negotiation and diagnostic APIs remain runtime choices; required context,
credential destinations, actual contribution collisions and output meaning
remain binding requirements. Non-2xx bodies may be inspected for diagnostics
outside operation outputs, without mandatory failure-data carriage.

Production adapters, general schema translation and a rebuilt full portable
conformance corpus remain separate work. The probes provide bounded evidence;
they do not qualify a production SDK or establish exhaustive kind conformance.

The [text-clarification maintenance record](../../conformance/kinds/openapi-text-clarifications.md)
records the subsequent bounded wording repairs, current text hashes and suite
replays. Earlier review hashes above identify the text those reviews examined.
