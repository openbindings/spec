# OpenAPI 3.0 candidate: migration to OpenBindings 0.2

The [active candidate](openbindings.openapi-3.0.md) uses the OpenBindings 0.2.0
core model. It is an unreleased proposal for `openbindings.openapi-3.0@1`.
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
contracts need not expose the intermediate HTTP request envelope.

## Edition and completeness

OAS 3.0.4 governs admitted entry values 3.0.0 through 3.0.4 uniformly.
The candidate remains unary and retains this edition's closed Schema Object
vocabulary, single-string type, nullable rule, Reference Object replacement and
binary/byte distinction. It imports no schema dialects, anchors, contentEncoding,
mutualTLS, sequential responses or later operation fields. All multipart uses
content-based Encoding; the form-urlencoded branch is stated explicitly.

Schema-form Header Parameters and Header Objects use one express correction
from OAS 3.1.2 Appendix D, without importing other 3.1 features. This preserves
native raw field strings rather than percent-encoding field syntax.

| [PB-02](../PROJECT-POLICY.md#pb-02-publication-completeness) item | Candidate answer |
| --- | --- |
| 1. Artifacts, representations and editions | §§1–2: exact governing patch, embedded object/text, acquired descriptions and typed referenced roots |
| 2. Address interpretation and acquisition | §2: absolute URI, scheme resolver, successful acquisition and unavailable resources |
| 3. Source content and absence | §2: closed document/location wrapper with at least one member |
| 4. Composition and bases | §§2–3: embedded artifact precedence, contributing-document bases and entry-root mounted inheritance |
| 5. Target and binding content | §§3–4: literal path/method pointer and finite structural mappings |
| 6. Interaction and lifecycle | §§4–10: unary input, at most one complete success value, failure and cancellation |
| 7. Correspondence and runtime choices | §§4–11: routing, representation, security, prerequisites and faithful synthesis |

Independent reduction and completeness reviews passed the pre-clarification
text at SHA-256 `67f430824f51be10bcffb4c801fb387b4b65ba3c69c8cef8554524db7812600a`.
The [independent interpretation suite](../../conformance/kinds/openapi-3.0/README.md)
passes 319 checks: 302 complete OBI fixtures and 17 focused parser/completion/
variation/mutation checks. It observes 188 actual HTTP dispatches, including two
redirect followups, and 22 HTTP artifact acquisitions; 116 negative fixture cases
refuse before dispatch. Another 372 completion-oracle mutations are rejected.
Run `node scripts/verify-openapi-30-kind.mjs` for native probes and all complete
fixture shape checks against the current core schema. The interpreter, separate
native expectations, hand-authored and synthesized OBIs provide bounded evidence;
the suite README lists unimplemented capabilities and makes no full SDK claim.

## Historical evidence and semantic changes

The old source fixtures and 234 processor/synthesis scenarios remain
[historical evidence](../../conformance/binding-specs/legacy/README.md), bound
to the frozen pre-kind draft. Their old field names, rule IDs, expressions,
phase labels and exact generated layouts do not govern this candidate. Passing
an old runner does not establish support for the current kind.

This is more than shortening. YAML byte-encoding support broadens; unsupported
optional projections are confined to where interpretation needs
them; exact numeric values replace silent rounding; equivalent wire forms and
runtime negotiation remain free; actual contribution collisions still prevent
dispatch. All multipart ignores inapplicable style controls. Impossible union
branches do not defeat an otherwise unique inspected declaration. Explicit,
coherent fixed transfer-encoding fields can accompany already encoded strings
without a second encoding. Mounted operations inherit entry-root servers and
security while retaining each contributing declaration's physical base.

Non-2xx bodies may be inspected for diagnostics outside operation outputs;
mandatory failure-data carriage is removed. Production adapters, broad schema
translation and a rebuilt full portable corpus remain separate work.

The final reduction round also delegates XML text encoding to RFC 7303 and
permits equivalent unreserved-byte URI spellings. These changes remove parser
and encoder strategy restrictions while preserving characters and URI structure.

Source locations identify whole documents. Nonempty fragments are invalid and
empty fragments are removed before retrieval and base-URI use. Updated probes
cover acquired and embedded forms, redirects, physical references and URI data
containing an encoded # without treating it as a fragment.

Content-based form values use the selected representation's null correspondence.
JSON media preserves present null, including required properties and array items.
Omission/refusal applies where the selected media has no null correspondence;
style serialization retains its own rules. The current suite includes 53 focused
cases for this boundary.

The [text-clarification maintenance record](../../conformance/kinds/openapi-text-clarifications.md)
records the subsequent bounded wording repairs, current text hashes and suite
replays. Earlier review hashes above identify the text those reviews examined.
