# OpenAPI 3.1 candidate: migration to OpenBindings 0.2

The [active candidate](openbindings.openapi-3.1.md) uses the OpenBindings 0.2.0
core model. It is an unreleased proposal for `openbindings.openapi-3.1@1`.
This record describes migration and evidence; it adds no interpretation rules
and makes no publication or SDK-support claim.

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

OAS 3.1.2 governs all three admitted entry values: 3.1.0, 3.1.1 and 3.1.2.
The candidate remains unary and supports the eight 3.1 operation fields. It does
not import 3.2's additional operations, querystring parameters, positional/nested
Encoding, itemSchema, `$self`, or sequential response mapping. Security
requirement keys remain component names. Named multipart arrays emit one part
per item; whole content-based form-urlencoded values have a separate rule.

| [PB-02](../PROJECT-POLICY.md#pb-02-publication-completeness) item | Candidate answer |
| --- | --- |
| 1. Artifacts, representations and editions | §§1–2: exact governing patch, embedded object/text, acquired descriptions and typed referenced roots |
| 2. Address interpretation and acquisition | §2: absolute URI, scheme resolver, successful acquisition and unavailable resources |
| 3. Source content and absence | §2: closed document/location wrapper with at least one member |
| 4. Composition and bases | §§2–3: embedded artifact precedence, contributing-document bases and entry-root mounted inheritance |
| 5. Target and binding content | §§3–4: literal path/method pointer and finite structural mappings |
| 6. Interaction and lifecycle | §§4–10: unary input, at most one complete success value, failure and cancellation |
| 7. Correspondence and runtime choices | §§4–11: routing, representation, security, prerequisites and faithful synthesis |

Independent reduction and completeness reviews passed the complete integrated
text at SHA-256 `39c4ab98ab09f0057b57b72f626ca0b17f83460d43f51e8480da1e6347f9f2ab`.
The [independent interpretation suite](../../conformance/kinds/openapi-3.1/README.md)
passes 240 focused cases, including 22 actual artifact acquisitions and 120
operation dispatches over loopback HTTP. It includes complete hand-authored and
synthesized OBIs, separately authored native expectations, permitted variations
and semantic-negative cases. Run `node scripts/verify-openapi-31-kind.mjs`.
It also checks the complete fixture shapes against the current core schema.
This is bounded evidence, not full implementation qualification. Full resource
graphs, general schema translation and other unimplemented capabilities are
listed in the suite's limitations.

## Historical evidence and semantic changes

The old source fixtures and 274 processor/synthesis scenarios remain
[historical evidence](../../conformance/binding-specs/legacy/README.md), bound
to the frozen pre-kind draft. Their old field names, rule IDs, expressions,
phase labels and exact generated layouts do not govern this candidate. Passing
an old runner does not establish support for the current kind.

This is more than shortening. YAML byte-encoding support broadens; unsupported
dialects and optional projections are confined to where interpretation needs
them; exact numeric values replace silent rounding; equivalent wire forms and
runtime negotiation remain free; actual contribution collisions still prevent
dispatch. Mixed multipart ignores inapplicable style controls. Impossible union
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
