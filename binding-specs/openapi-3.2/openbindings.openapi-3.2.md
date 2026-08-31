# `openbindings.openapi-3.2` Binding Specification

## 1. Identifier and rule labels

**[convention]** The opaque binding-specification identifier has exactly the spelling **`openbindings.openapi-3.2@1`**.

**[incorporated]** Publication mints §1's identifier under Core [OBI-B-01](../../openbindings.md#104-binding-specification-rules), and an incompatible change to the accepted domain or portable meaning requires a different identifier under Core [OBI-B-03](../../openbindings.md#104-binding-specification-rules).

**[incorporated]** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) only when they appear in all capitals.

**[convention]** Every normative paragraph and normative table row carries one visible provenance label. An `incorporated` rule is one the cited source states, and the citation names that source, whether an incorporated authority or the OpenBindings Core; the remaining five are this specification's own explicitly classified bridge. A `convention` is a choice this specification makes where no authority speaks; a `pin` fixes one reading of an ambiguous or versioned authority; a `configuration point` names a decision deferred to the consumer; an `exclusion` removes something from the accepted surface behind a stated reopen trigger; a `limit` states a boundary this specification does not cross.

## 2. Scope and incorporated authorities

**[convention]** This binding specification defines how OpenAPI 3.2 artifacts govern OpenBindings sources: which documents are accepted and when loading refuses, how operation targets are addressed and synthesized, what an invocation's inputs and outputs mean, and which wire mechanics the artifact fixes. It builds on the OpenBindings Core specification (`../../openbindings.md`).

**[incorporated]** OpenAPI Specification (OAS) edition [`3.2.0`](https://spec.openapis.org/oas/v3.2.0.html) requires the root `openapi` field to carry the version number of the OpenAPI Specification the document uses, versioned `major.minor.patch`, where the `major.minor` portion SHALL designate the feature set ([OAS 3.2.0 §§2.1, 4.1.1](https://spec.openapis.org/oas/v3.2.0.html#oas-version)).

**[pin]** This specification accepts exactly the one `openapi` value `3.2.0`; no wildcard, range, or compatible-looking value widens the closed accepted domain. OAS 3.2.0 §2.1 says the opposite about patch identity — `.patch` versions address errors in, or clarifications to, that document rather than the feature set, and the patch version SHOULD NOT be considered by tooling — and this specification deliberately declines that SHOULD, disclosed here as it discloses the RFC 2046 charset displacement in §9.2. §2.1's two compatibility illustrations are anomalous copied text naming the 3.1 line rather than this one — "Tooling which supports OAS 3.1 SHOULD be compatible with all OAS `3.1.*` versions" and "making no distinction between 3.1.0 and 3.1.1 for example" — and this specification neither widens nor renames them to this line; what it declines is the patch-identity instruction those illustrations accompany, read at the generality §2.1 states it. The reason is that an accepted domain freezes at publication under Core [OBI-B-03](../../openbindings.md#104-binding-specification-rules): admitting a patch edition not yet written would admit text this specification has not verified. A later OAS `3.2.x` edition is therefore accepted only by a specification minting its own identifier for it ([OAS 3.2.0 §2.1](https://spec.openapis.org/oas/v3.2.0.html#versions-and-deprecation)).

**[convention]** OAS governs the artifact and every HTTP mechanic it declares, including object structure, reference resolution, parameter serialization, media declarations, server selection, responses, and security ([OAS 3.2.0 §4](https://spec.openapis.org/oas/v3.2.0.html#objects-and-fields)); [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) governs the remaining HTTP semantics.

**[incorporated]** This document defines portable binding meaning, not an invocation API: request objects, retry and redirect APIs, cancellation, credential acquisition, receiver deployment, and dependency composition remain runtime or application concerns under Core [§1.2](../../openbindings.md#12-out-of-scope).

**Where Core's completeness items are discharged.** Core [OBI-B-02](../../openbindings.md#104-binding-specification-rules) states seven items a binding specification defines for the sources and bindings it governs. This document is organised by subject matter rather than by those items, so the table below says where each one is discharged. The third column names what this specification does not cover at that item: a point at which it states no portable meaning. It does not claim that no rule in this document reaches the surrounding subject. No row carries a provenance label, because no row states a rule: each summarises rules stated elsewhere, and where this table and a rule differ the rule is the one to read.

| item | discharged in | what this specification does not cover there |
| --- | --- | --- |
| 1 — accepted artifact and its representations | §2 (the one accepted edition), §3.1 (the two accepted representations and their discrimination by JSON type), §3.2 (the closed load gates, source refusal, and unknown-field confinement), §4 (which JSON values are accepted, completing that discrimination), §5.1 (the UTF-8 decode and grammar gate every retrieved document passes), §5.2 (a root dialect that refuses the source) | a required `location` dereference that yields no representation at all — one that fails, is unreachable, or returns nothing. §3.2's load gates are closed to four conditions and none of them is that one, and §3.2's outcome vocabulary names no member for it. |
| 2 — `location` | §4 (absolute-URI syntax, the dereference obligation, and the base chain), §3.1 (the retrieval URI is never an OpenAPI base), §5.1 (retrieved documents' decode), §10 (that same retrieval URI as the base for a relative Server URL, and the consequence when there is none) | the dereference-failure outcome named in item 1's row. `location` has exactly two roles here — the artifact's retrieval address, and the base against which relative resolution proceeds — and §10's use is that same base role, cited there, so the meaning is not stated in one place and consumed silently in another. |
| 3 — `content` | §3.1 (the two accepted representations and their meaning), §4 (a present `content` MUST be one of them and no other JSON type is accepted, and no governed source mode forbids `content`, so Core's forbidden-mode enumeration is empty) | nothing recorded. |
| 4 — composition | §3.1 (content primacy, and a co-present `location` supplying the retrieval URI), §4 (the base chain through `$self`, the reference base a `location` supplies for embedded content, and the self-containment requirement when there is none), §10 (what a relative Server URL yields when embedded content has no `location`) | nothing recorded. |
| 5 — `selector` | §6.1 (the two literal spellings, RFC 6901 evaluation, the `additionalOperations` key rules, and the non-resolution disposition), §5.1 (effective Path Item resolution before the method field is read, and the `$ref` collision that turns on the selected map key), §3.2 (a selector naming an excluded target still resolves), §12.3 (`OAPI32-D-02`, which decides the absent and malformed cases and is decided over the interpreted artifact) | nothing recorded. |
| 6 — target and interaction identification | §3.2 (smallest-owner confinement, source refusal, and what an excluded unit is), §5.1 (the effective Path Item and reference confinement), §5.2 (dialect scope and the resolved declaration), §6.1 (selector to operation), §6.2 (callbacks and webhooks are not invocable through the addressed operation), §7 (what an addressed operation denotes), §8.2 (path-template correspondence), §9.6 (which Response Object governs an actual response), §10 (server resolution and the completed target URL), §11 (which security requirement governs, which alternative is selected, requirement-name resolution, and Security Scheme Object well-formedness), §12.1 (`server`, `security`, `implicitConnectionScope`), §12.3 (`OAPI32-D-02`, `OAPI32-P-01`, `OAPI32-P-04`) | nothing recorded. |
| 7 — caller-facing input and successful output correspondence | §7 (the envelope and its keys), §8 (parameter serialization end to end), §9 (media identity and election, carriage lanes, form and multipart bodies, content codings, sequential media and server-sent events, response classification and decoding), §3.2 (the outcome vocabulary), §5.2 (the resolved declaration every lane reads), §10 (the completed target's well-formedness check), §12.1 (what a consumer supplies and what it never reaches), §12.2 (the one rule fixing context bindings at transform positions), §12.3 (`OAPI32-P-02`, `OAPI32-P-03`) | whether a declared media-type parameter rides on the emitted request `Content-Type`; whether a schema `default` on a parameter is inserted or the parameter omitted; and an actual response carrying two `Content-Type` fields. |

**[convention]** Where §2's item map records that a chain is not completed in this revision, that record licenses nothing. It is not a permitted variation, and this specification states no portable meaning there. An implementation may complete such a point locally; that completion is implementation-defined under Core [§6](../../openbindings.md#6-binding-specifications) and is not attributed to this identifier.

§11 additionally states how a selected credential becomes wire bytes: Basic construction, `apiKey` emission at its declared destination, Bearer carriage, destination collisions, and the structured-cookie join. Those rules fix bytes this binding puts on the wire, and no item above reaches them, because a credential is neither a caller-facing input value nor a successful output value — this specification says so itself in §11. They stand above the floor OBI-B-02 sets rather than inside it, and the table records no gap for them.

## 3. Source carriage and refusal architecture

### 3.1 Accepted representations

**[convention]** `content` is either the parsed OpenAPI document object or string content; `location` is an absolute URI for the OpenAPI document; content has primacy, a co-present location supplies its retrieval URI, and the OBI retrieval URI is never an OpenAPI base (Core [§5.4](../../openbindings.md#54-sources), [§7](../../openbindings.md#7-reference-resolution)).

**[pin]** String content MUST parse as YAML 1.2.2, of which JSON is a subset; duplicate mapping keys, non-scalar-string mapping keys, explicit tags outside YAML's JSON-compatible tag set, resolved values with no JSON image (`.inf`, `-.inf`, `.nan`), and a multi-document YAML stream refuse at this grammar gate. Exactly one YAML document is accepted ([YAML 1.2.2 §§3.2.1, 10.2.1, 10.3.2](https://yaml.org/spec/1.2.2/)).

**[pin]** Plain-scalar tag resolution uses YAML 1.2.2's recommended Core schema — the resolution the preceding rule's `.inf`/`.nan` parentheticals already presuppose — and no other resolution schema is consulted ([YAML 1.2.2 §10.3.2](https://yaml.org/spec/1.2.2/#1032-tag-resolution)).

**[pin]** A leading byte-order mark on string content is accepted and consumed by the YAML grammar; it is never part of the document.

**[incorporated]** YAML processing follows OAS 3.2's RFC 9512-based JSON-compatibility regime: YAML 1.2 with RFC 9512 constraints is RECOMMENDED, and authors SHOULD NOT rely on YAML constructs that cannot be represented in the JSON data model ([OAS 3.2.0 §§3, 3.1](https://spec.openapis.org/oas/v3.2.0.html#json-and-yaml-compatibility)).

**[incorporated]** The root MUST be a JSON object and MUST carry OAS's required string-valued `openapi` field ([OAS 3.2.0 §§3, 4.1.1](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields)).

**[convention]** An absent field or any value other than §2's exact `3.2.0` refuses at the edition load gate.

### 3.2 Closed load gates and confined defects

**[convention]** Defect outcomes use a fixed vocabulary: a source **refuses at load** only at §3.2's gates; a source whose positions capable of carrying an addressable target are all defective **refuses as a source** after those gates; a declaration defect **excludes** its smallest owning unit from synthesis and selection; a `selector` that reaches no addressable target **does not resolve**, and the invocation **refuses at resolution** — an outcome distinct from an addressable target that is unusable, because no target is reached at all ([RFC 6901 §7](https://www.rfc-editor.org/rfc/rfc6901#section-7), which names a pointer referencing a nonexistent value as an error condition and directs the application to specify its handling); an addressable target whose use requires a missing choice or unsupported alternative is **unusable** and **refuses before dispatch** when invoked; a wire fact this specification cannot represent faithfully is a **loud protocol error**, for which the adverbial spellings *refuses loudly*, *fails loudly*, and *reported loudly* are exact synonyms; an interaction that reaches the wire and whose outcome §§9.5–9.6's classification does not admit as successful **completes unsuccessfully**; and synthesis reports every exclusion and inexpressible declaration as **coverage loss**. Each name in this vocabulary fixes what happens, not how a runtime reports it: "refuses before dispatch" fixes that nothing reaches the wire, and a refusal for a missing configuration point additionally names that point under §12.1, so supplying it makes the same invocation proceed. Whether a runtime surfaces that as a terminal failure or as a resolvable challenge is context negotiation and is outside this specification (Core [§6](../../openbindings.md#6-binding-specifications)).

**[convention]** A **lane** is one media-selected value-to-bytes serialization path—JSON, character-data, raw-octet, form, multipart, and this line's other incorporated forms—and the **smallest media owner** is the narrowest declared unit that owns a defective lane. An **unavailable** alternative is an excluded alternative: the word marks this vocabulary's exclusion outcome applied to a media alternative.

**[convention]** A **unit** is one member of this closed lattice, from largest to smallest: the source, an addressable operation, a declared alternative, a media alternative, a lane, and a field. A defect's **smallest owning unit** is the smallest member of that lattice whose declarations the defect reaches; a **selected unit** is a unit reached by the selected target.

**[limit]** The load gates are the following closed ordered set: accepted-representation grammar, scalar/tag/key resolution, JSON-object root shape, and exact edition discrimination; no condition outside this set is a load gate.

**[limit]** **§3.2's smallest-owner rule**: after those gates pass, a defect confines to its smallest owning unit, and an unreachable defect destroys no target.

**[limit]** An **excluded** unit is removed from synthesis and from the effective declarations of every rule in this document, §7's caller-envelope key derivation and §8's path-template correspondence included: no rule reads an excluded unit's declarations. A selector naming an excluded target still resolves — exclusion is not unresolvability — and the invocation refuses before dispatch. A target whose remaining effective declarations no longer satisfy §8's path-template correspondence is itself excluded.

**[incorporated]** A conforming artifact that declares no operation target is accepted and synthesizes no operation: the Paths Object and each Path Item Object may be empty, and the root may instead contain `components` or `webhooks` ([OAS 3.2.0 §§4.1.1, 4.8, 4.9](https://spec.openapis.org/oas/v3.2.0.html#openapi-object)).

**[incorporated]** An OpenAPI Object MUST contain at least one of `components`, `paths`, or `webhooks`; a root omitting all three is upstream-invalid, unlike any present-but-empty surface above ([OAS 3.2.0 §4.1.1](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields)).

**[limit]** **§3.2's source-refusal rule**: a source **refuses as a source** — the outcome §3.2's vocabulary names, which fires after the closed load gates and never at them — when at least one position that could carry an addressable target exists and every such position is defective, so that no conformant selector can resolve. A valid present-but-empty surface is not a defective position: it is accepted and synthesizes zero operations. The root surface this edition requires for addressable targets is itself such a position, and its absence is that defect — OAS 3.2.0 requires at least one of `components`, `paths`, or `webhooks` rather than `paths` alone, so only a source omitting all three refuses as a source ([OAS 3.2.0 §4.1.1](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields)). This stated consequence is not an additional load gate.

**[limit]** A target that is addressable but unusable because of a missing choice, unsupported alternative, or exclusion refuses before dispatch or is reported as synthesis coverage loss; it never becomes a source refusal.

**[limit]** This revision declares no source-scope exclusion: unlike the [`include`/`mount` filtering surface of `openbindings.usage@1`](../usage/openbindings.usage.md#3-accepted-source-representations), no source member or addressable target is filtered merely by its position in the source. §5.2's root `jsonSchemaDialect` rule refuses the source under §3.2's source-refusal rule rather than filtering by position.

**[limit]** An unknown non-extension field creates no binding behavior, and this specification supplies none for it: the consequence confines to the smallest owning unit that depends on it, while an unused unknown field affects no target. An `x-` specification extension remains an inert annotation under this identifier, and no unknown member is guessed into a fixed or patterned field ([OAS 3.2.0 §5](https://spec.openapis.org/oas/v3.2.0.html#specification-extensions)).

**[convention]** A root `swagger` member co-present with this specification's conforming `openapi` value is such an unknown non-extension root member: it is inert, gates nothing, and cedes the document to no sibling specification.

## 4. `location`, `content`, and composition

**[incorporated]** A present `location` MUST be an absolute URI addressing the OpenAPI document itself; a bare filesystem path is not conformant (Core [OBI-D-05](../../openbindings.md#102-document-rules)).

**[convention]** For a location-only source the dereference is required and MUST yield an accepted representation. Where `content` is co-present a processor MAY retrieve from that `location` and MAY decline to; `content` remains the interpreted artifact and is never silently replaced, the co-present `location` supplies the retrieval URI of §4's base chain from its own value rather than from any retrieval, and a failed, unreachable, or non-conforming elective retrieval has no effect on the interpreted artifact and no outcome of its own. Retrieval is therefore never observable on a content-carrying source, and two processors that differ over whether to attempt it differ in no result this specification defines (Core [§5.4](../../openbindings.md#54-sources)).

**[convention]** A present `content` MUST be one of §3.1's two representations, and no other JSON type is accepted.

**[convention]** No source mode this specification governs forbids `content`. Core [§5.4](../../openbindings.md#54-sources) admits three — `location` alone, `content` alone, and both co-present — and the preceding rule admits a present `content` in each of them without qualification; a location-only source is one in which `content` is absent, not one in which it is prohibited. The enumeration Core [OBI-B-02](../../openbindings.md#104-binding-specification-rules) item 3 asks for is therefore empty by decision rather than unconsidered. Nothing observable turns on this rule: it asserts what the preceding rule already entails.

**[incorporated]** A present root `$self` establishes the document's self-assigned URI and OpenAPI-description base; a relative `$self` first resolves against the next available RFC 3986 base, ordinarily the retrieval URI supplied by `location`. Without `$self`, that retrieval URI is the ordinary document base ([OAS 3.2.0 §§4.1.1, 4.1.2.2.1](https://spec.openapis.org/oas/v3.2.0.html#establishing-the-base-uri)).

**[incorporated]** Relative non-Schema references then use the document base; Schema Object references use the nearest schema-resource base established by `$id`; JSON or YAML document fragments are JSON Pointers ([OAS 3.2.0 §§4.1.2.1, 4.1.2.2](https://spec.openapis.org/oas/v3.2.0.html#relative-references-in-api-description-uris)).

**[convention]** Embedded content without a co-present `location` MUST establish every needed base through an absolute `$self`, absolute schema identifiers, or other self-contained references; a location-only source uses its location as the retrieval URI (Core [§7](../../openbindings.md#7-reference-resolution)).

## 5. References, dialects, and confinement

### 5.1 Reference semantics

**[convention]** A reference composes its target plus the transitive closure of references reachable from that target, not unrelated material in the same retrieved document. No accepted edition states that composition rule; this specification adopts it so that a selected target's closure is decidable ([OAS 3.2.0 §§4.1.2, 4.1.2.1](https://spec.openapis.org/oas/v3.2.0.html#parsing-documents)).

**[incorporated]** Every provided possible OAD document MUST be fully parsed before a selected reference is deemed unresolvable ([OAS 3.2.0 §4.1.2.1](https://spec.openapis.org/oas/v3.2.0.html#parsing-documents)).

**[incorporated]** A referenced document need not itself be a conforming OpenAPI Document: an OAD document may instead have a Schema Object at its root, and documents are assumed to have either an OpenAPI Object or Schema Object root unless otherwise specified. When a target document declares `$self`, references to that document MUST use the `$self` identity; a reference to a Schema Object beneath an `$id` boundary MUST use the nearest such `$id` rather than cross the resource boundary with another base plus JSON Pointer ([OAS 3.2.0 §§4.1.1–4.1.2, Appendix F.1](https://spec.openapis.org/oas/v3.2.0.html#base-uri-within-content)).

**[exclusion]** A selected reference that reaches a document with neither admitted root, uses a retrieval alias despite a declared `$self`, or crosses a nearer `$id` resource boundary noncanonically is unresolvable under this binding; §5.1's table confines the consequence to the unaddressable, unusable, or unavailable unit stated beside each condition, and no private alias fallback applies. The exclusion reopens only if incorporated authority admits the exact root or reference form.

**[pin]** Every document this binding retrieves — the primary `location` dereference of §4 and every secondarily retrieved reference document alike — decodes its bytes as UTF-8 and passes the same grammar gate as §3.1 string content; the retrieval's `Content-Type` and any charset parameter are never consulted, and a byte sequence that is not valid UTF-8 refuses at that grammar gate.

**[convention]** When one JSON or YAML node is reached from reference positions requiring different OAS Object types, each reference context interprets the node independently as its own required Object type; this is the deterministic choice within OAS's implementation-defined multi-context license ([OAS 3.2.0 Appendix G.2](https://spec.openapis.org/oas/v3.2.0.html#conflicts-between-field-types-and-reference-contexts)).

**[incorporated]** A Schema Object `$ref` is the JSON Schema applicator and its siblings remain meaningful; a Reference Object has only its fixed `$ref`, `summary`, and `description` fields, and every added property is ignored ([OAS 3.2.0 §§4.23, 4.24](https://spec.openapis.org/oas/v3.2.0.html#reference-object)).

**[pin]** OAS states in lowercase that tooling must detect and handle cycles to prevent resource exhaustion, which §1's BCP 14 clause leaves non-normative; this specification pins that statement to a deterministic requirement: reference traversal MUST detect cycles without resource exhaustion, a cyclic but resolvable graph is legitimate, and cycle detection terminates traversal rather than truncating the graph and is not itself a refusal ([OAS 3.2.0 §6.6](https://spec.openapis.org/oas/v3.2.0.html#handling-reference-cycles)).

**[pin]** A Path Item `$ref` is not a Reference Object for sibling purposes. OAS gives the Path Item its own `$ref` fixed field and states that a field appearing in both the referenced and the adjacent object has undefined behavior, which presupposes that both declarations exist; this specification pins the merge that presupposition implies. The **effective Path Item** is the referenced Path Item overlaid with every adjacent field the referenced Path Item does not itself declare: non-colliding adjacent fields contribute, and the `$ref` member itself contributes nothing. `additionalOperations` is the one fixed field this specification merges below the field, because it is the one whose fixed-field value is itself a map of addressable targets: its entries merge key by key under the same overlay, so an adjacent entry whose exact key the referenced map does not declare contributes that additional operation and an entry declared on both sides collides at that key alone. The rule that a Reference Object's added properties are ignored is scoped to Reference Objects proper and never reaches this merge. When the `$ref` itself does not resolve, no effective Path Item exists, so every target at that Paths key is unaddressable — adjacent declarations included — and a selector naming one does not resolve. This edition adds a note that the adjacent-property behavior of a Path Item `$ref` is likely to change in a future version to bring it into closer alignment with the Reference Object, which affirms its present non-alignment; the 2.0 and 3.0 lines carry no such note, and the merge rests on the collision-undefined sentence all four editions share ([OAS 3.2.0 §§4.9.1, 4.23](https://spec.openapis.org/oas/v3.2.0.html#path-item-ref), against [OAS 2.0 Path Item Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-3) and [OAS 3.0.4 §4.7.9.1](https://spec.openapis.org/oas/v3.0.4.html#path-item-ref)).

**[exclusion]** When a selected Path Item carries `$ref`, the selected operation target is excluded only if a fixed field used by that target appears in both the referenced Path Item and its adjacent declaration, because OAS defines that collision as undefined. `Used by that target` means the Path Item's `parameters` and `servers` plus the field that selects the target: the selected fixed method field for a fixed-field operation, and the selected `additionalOperations` entry — that exact map key, not the whole `additionalOperations` field — for an additional operation. An `additionalOperations` key declared on both sides but not selected is a collision confined to an unused field. The documentation fields `summary` and `description` never collide for this purpose. Collisions confined to unused fields and all non-colliding adjacent fields leave the target usable, and the exclusion reopens only if an incorporated OAS edition defines the collision ([OAS 3.2.0 §4.9.1](https://spec.openapis.org/oas/v3.2.0.html#path-item-ref)).

**[convention]** The first three reference conditions in the table below are this specification's own confinement conditions; the sections cited beside them define the reference positions and the base resolution those conditions read, not the conditions themselves ([OAS 3.2.0 §§4.1.2, 4.9](https://spec.openapis.org/oas/v3.2.0.html#openapi-description-structure)):

| condition |
| --- |
| **[convention]** Unresolvable selected Path Item `$ref` |
| **[convention]** Unresolvable reference reached by one selected parameter, request body, response, server, or security requirement |
| **[convention]** Unresolvable Schema Object or Media Type Object reference reached only by one media alternative |
| **[limit]** An unresolvable reference reachable only from an unused description position leaves invocation unaffected; synthesis reports that position as coverage loss. |
| **[limit]** A defect outside the target-plus-reachable closure has no effect on that target. |

**[limit]** In table order, the three confinement conditions confine as follows: every target at the referencing Paths key is unaddressable, adjacent declarations included, because §5.1's merge forms no effective Path Item; the selected operation or its affected declared alternative is unusable while unrelated operations survive; or the affected media alternative is unavailable while sibling alternatives survive.

### 5.2 Schema dialect

**[incorporated]** The supported default Schema Object dialect is `https://spec.openapis.org/oas/3.1/dialect/base`; root `jsonSchemaDialect` changes the document default, and a schema-resource-root `$schema` overrides that default only within its schema resource ([OAS 3.2.0 §§4.24.1, 4.24.7](https://spec.openapis.org/oas/v3.2.0.html#specifying-schema-dialects)).

**[pin]** For this identifier, that base-dialect URI is fixed to the official [`2024-11-10` revision](https://spec.openapis.org/oas/3.1/dialect/2024-11-10); a later change in the alias's resolution does not alter this specification.

**[exclusion]** A root `jsonSchemaDialect` naming any other URI **refuses as a source** under §3.2's source-refusal rule — the same source-level outcome, reached by this rule's own condition rather than by that rule's defective-position trigger — because this specification refuses to prove, per source, that no reachable Schema Object depends on that changed default; this exclusion reopens only if that exact dialect becomes incorporated authority.

**[exclusion]** A schema-resource-root `$schema` naming any other URI excludes only each selected unit whose reachable closure enters that resource; this exclusion reopens only if that exact dialect becomes incorporated authority.

**[convention]** For every lane, style, shape, and member-inspection rule in this document, a **resolved declaration** is obtained by following `$ref` and conjoining every `allOf` branch; for an `anyOf` or `oneOf` choice, a branch whose resolved declaration declares only `null` is skipped, every other branch — a typeless branch included — is a candidate, and the choice supplies a single resolved member declaration only when exactly one candidate remains; `not` and conditional applicators never participate in resolution; and absence of `type` leaves the declaration typeless. A 3.2 `type` array contributes every listed type to the resolved type set. **Declares only X** means that the resolved type set is nonempty and every member is in X. **Admits `string` as its sole non-null type** means that the resolved type set is exactly `{string}` or `{string, null}`.

## 6. Selector and inbound dependencies

### 6.1 Selector

**[convention]** `selector` is REQUIRED and has exactly one of two literal spellings: `#/paths/<escaped-path>/<lowercase-method>` for a fixed-field operation, where `<lowercase-method>` is one of `get`, `put`, `post`, `delete`, `options`, `head`, `patch`, `trace`, or `query`; or `#/paths/<escaped-path>/additionalOperations/<METHOD-as-spelled>` for an additional operation. Each map-key segment is escaped once under [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901), and the additional-operation method retains its exact case after that unescaping ([OAS 3.2.0 §4.9.1](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-6)).

**[incorporated]** An `additionalOperations` key MUST be an HTTP method token in the exact capitalization sent on the wire and MUST NOT denote a method represented by a fixed Operation field; the fixed `query` field denotes QUERY under the linked draft target. The OAS document's link text reads draft-08 while its hyperlink target is draft-11 ([OAS 3.2.0 §4.9.1](https://spec.openapis.org/oas/v3.2.0.html#path-item-additional-operations), [RFC 9110 §9.1](https://www.rfc-editor.org/rfc/rfc9110#section-9.1), [HTTP QUERY draft-11](https://www.ietf.org/archive/id/draft-ietf-httpbis-safe-method-w-body-11.html)).

**[pin]** Between the displayed draft-08 label and the linked draft-11 target, this specification follows the linked target. OAS incorporates QUERY as "the most recent IETF draft … or its RFC successor", which is a moving incorporation; this specification pins it to that one draft-11 revision, and a later draft or its RFC successor does not alter this identifier ([OAS 3.2.0 §4.9.1](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-6)).

**[exclusion]** `additionalOperations` keys compare byte-exactly for map identity and selector resolution; a key that compares ASCII case-insensitively equal to any fixed Operation field name is a declaration defect that excludes only that additional-operation entry. The exclusion reopens only if incorporated authority admits the collision and defines its unique operation mapping.

**[pin]** The selector's leading `#` is a literal sentinel: what follows is RFC 6901 §3's string representation of the JSON Pointer, carried literally, escaped once with `~0`/`~1`, and never percent-decoded; the §6 URI-fragment representation is not used. Evaluation follows RFC 6901 §§3–4; when the selected operation is absent the selector does not resolve and the invocation refuses at resolution ([RFC 6901 §§3–4, 6](https://www.rfc-editor.org/rfc/rfc6901#section-3), [OAS 3.2.0 §§4.8, 4.9](https://spec.openapis.org/oas/v3.2.0.html#path-item-object)).

**[convention]** After the pointer selects a Path Item, selector evaluation resolves that Path Item's `$ref` into §5.1's effective Path Item before reading the fixed method field or `additionalOperations` entry; this deliberate extra resolution keeps bundled referenced Path Items addressable ([RFC 6901 §4](https://www.rfc-editor.org/rfc/rfc6901#section-4), [OAS 3.2.0 §4.9.1](https://spec.openapis.org/oas/v3.2.0.html#path-item-ref)).

**[incorporated]** An operation remains addressable when it omits `responses`, because `responses` is optional in the 3.2 Operation Object ([OAS 3.2.0 §4.10.1](https://spec.openapis.org/oas/v3.2.0.html#operation-responses)).

**[incorporated]** When `responses` is present, its Responses Object MUST contain at least one response code; a present empty object is upstream-invalid, distinct from valid omission ([OAS 3.2.0 §4.16](https://spec.openapis.org/oas/v3.2.0.html#responses-object)).

**[exclusion]** A present empty Responses Object is a declaration defect that excludes only the selected target, before any response or caller value is inspected; omission remains addressable under the preceding rule. The exclusion reopens only if an incorporated OAS edition admits a present empty Responses Object.

### 6.2 Callbacks and webhooks

**[incorporated]** A callback Path Item describes a request initiated by the service and expected responses, while a root webhook describes an incoming request the API consumer may implement; neither is an operation invocable through the addressed parent operation ([OAS 3.2.0 §§4.1.1, 4.10.1, 4.18](https://spec.openapis.org/oas/v3.2.0.html#oas-webhooks)).

**[convention]** Synthesis MUST represent every callback and webhook operation that §6.1's selector forms would address were its Path Item at a Paths key — no rule partitions them further — as a Core dependency with a deterministic slot-derived key and a role-inverted consumed-operation contract: input is the request the service sends and output is the response the service expects (Core [§5.6](../../openbindings.md#56-dependencies)).

**[convention]** `Deterministic slot-derived key` requires only that the key be a deterministic function of the declaration slot; its exact spelling is synthesis policy under §12.2 and is not portable binding meaning. The dependency contract's shape is likewise synthesis policy; only the role-inverted input/output meaning above is fixed here.

**[incorporated]** Such a dependency carries no concrete target (Core [§5.6](../../openbindings.md#56-dependencies)).

**[convention]** Such a dependency also carries no `bindingSpecs`, because the originating artifact has no authority to constrain the consumer's description format.

**[incorporated]** Callback runtime-expression keys describe service-selected request destinations ([OAS 3.2.0 §§4.18, 4.20.3](https://spec.openapis.org/oas/v3.2.0.html#runtime-expressions)).

**[limit]** Dependencies add no invocation behavior to this binding; receiver deployment and dependency composition are permanently outside this operation boundary under this identifier (Core [§1.2](../../openbindings.md#12-out-of-scope)).

## 7. Target interaction and caller envelope

**[convention]** Here and below, an **effective** declaration is the declaration that remains after applying the artifact's scope, default, and override rules stated in §§8–10.

**[incorporated]** An addressed operation denotes its declared HTTP method, completed target URL, parameters, optional request body, security requirements, and final HTTP response. The method is the Path Item field name or `additionalOperations` key that selects the Operation Object, and the target URL is composed from the effective Server Object's URL with the Paths Object key ([OAS 3.2.0 §4.10](https://spec.openapis.org/oas/v3.2.0.html#operation-object), [§4.9](https://spec.openapis.org/oas/v3.2.0.html#path-item-object), [§§4.5, 4.8](https://spec.openapis.org/oas/v3.2.0.html#server-object)).

**[convention]** The caller-facing correspondence value is exactly `{parameters?: {...}, body?: <one JSON value>}`; absence means not supplied, `body: null` is a supplied JSON null, and the artifact alone determines parameter location and serialization.

**[convention]** When every effective parameter name is unique across locations, its caller key is the exact declared name; if any name is repeated across legal locations, the target uses qualified mode for every parameter and each key is `<location>/<RFC6901-escaped-name>`, making the flat map injective without depending on map order. That spelling is this binding's own envelope surface and deliberately differs from OAS's `path.id` convention for Link Object `parameters`, which this binding never reads or emits ([OAS 3.2.0 §4.20.1](https://spec.openapis.org/oas/v3.2.0.html#link-object)).

**[incorporated]** Effective parameter identity is exact name plus location; duplicate effective parameters at the same identity are upstream-invalid, while the same name in different locations denotes distinct parameters ([OAS 3.2.0 §§4.9.1, 4.10.1, 4.12](https://spec.openapis.org/oas/v3.2.0.html#operation-parameters)).

**[exclusion]** Duplicate effective parameters at the same identity exclude their smallest owning operation. The exclusion reopens only if an incorporated OAS edition admits duplicate effective parameters at one identity.

**[convention]** Legal cross-location duplicates remain independently supplied through the qualified mode above.

**[exclusion]** Two effective header parameters whose names differ only by ASCII case exclude the selected target because OAS parameter identity is case-sensitive while HTTP field names are case-insensitive; the wire cannot preserve the distinction. This exclusion reopens only if an incorporated authority defines a wire mapping that preserves such case-distinct declarations ([OAS 3.2.0 §§3.2, 4.12.2.1](https://spec.openapis.org/oas/v3.2.0.html#case-sensitivity), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[convention]** An envelope top-level key other than `parameters` or `body`, a present non-object `parameters` member, or any unknown parameter key refuses before dispatch, regardless of whether a body exists; no unmatched-field passthrough exists.

**[incorporated]** Missing required parameters and a missing `required: true` request body refuse before dispatch; path parameters are always required ([OAS 3.2.0 §§4.12.2.1, 4.13.1](https://spec.openapis.org/oas/v3.2.0.html#parameter-required)).

**[incorporated]** A request body is fully supported where RFC 9110 explicitly defines body semantics; where HTTP discourages content, including GET and DELETE, OAS permits `requestBody` but says its semantics are not well-defined and it should be avoided. TRACE alone is forbidden content: a client MUST NOT send content, so this binding emits no TRACE body under any declaration ([OAS 3.2.0 §4.10.1](https://spec.openapis.org/oas/v3.2.0.html#operation-request-body), [RFC 9110 §9.3.8](https://www.rfc-editor.org/rfc/rfc9110#section-9.3.8)).

**[convention]** The binding preserves any supplied declared body in those permitted cases rather than deleting it; a supplied `body` on `trace` refuses as unroutable before dispatch.

**[convention]** The same disposition governs every `additionalOperations` method for which the incorporated HTTP authority defines no client content — CONNECT among them ([RFC 9110 §9.3.6](https://www.rfc-editor.org/rfc/rfc9110#section-9.3.6)) — because `additionalOperations` admits arbitrary method tokens and the preceding rule's reason is the method's HTTP semantics rather than its spelling: no body is emitted under any declaration, and a supplied `body` refuses as unroutable before dispatch.

**[limit]** On such a content-forbidding method the artifact's `required: true` request body creates no caller-body requirement, so a body-free invocation dispatches and the preceding `incorporated` rule's missing-required-body refusal does not reach it. The target is therefore invocable, not permanently unusable; the declaration is reported as coverage loss at the Request Body position.

## 8. Parameter serialization

### 8.1 Effective declarations and scalar conversion

**[incorporated]** Operation parameters override Path Item parameters only at the same exact name-plus-location identity, and every remaining effective `path`, `query`, `querystring`, `header`, or `cookie` Parameter Object governs its own contribution ([OAS 3.2.0 §§4.9.1, 4.10.1, 4.12.1](https://spec.openapis.org/oas/v3.2.0.html#parameter-locations)).

**[incorporated]** Every effective Parameter Object MUST declare `name` and one of the five admissible `in` values, and MUST use exactly one of `schema` or `content`; a `path` parameter MUST declare `required: true`, a `querystring` parameter MUST use `content` and none of the schema-form fields, and a content-form map MUST contain exactly one entry ([OAS 3.2.0 §§4.12.1–4.12.2.3](https://spec.openapis.org/oas/v3.2.0.html#parameter-object)).

**[exclusion]** A selected effective Parameter Object violating any constraint in that closed declaration list is a declaration defect that excludes the selected target before caller values are inspected; sibling targets survive. The exclusion reopens only if an incorporated OAS edition removes the violated constraint or defines the malformed form's wire meaning.

**[incorporated]** A Header parameter whose name ASCII-case-insensitively denotes `Accept`, `Content-Type`, or `Authorization` MUST be ignored ([OAS 3.2.0 §§3.2, 4.12.2.1](https://spec.openapis.org/oas/v3.2.0.html#parameter-name), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[limit]** An ignored Header parameter creates no effective parameter, caller-envelope key, or emitted field.

**[configuration point]** For `schema`-form parameter serialization and §9.3 Encoding/style serialization of form or multipart property values, `parameterConversion` is the same deterministic consumer-supplied conversion from each supplied JSON boolean or number to a string; strings pass identically, and any supplied boolean or number without a configured conversion refuses before dispatch ([OAS 3.2.0 Appendix B](https://spec.openapis.org/oas/v3.2.0.html#appendix-b-data-type-conversion)).

**[configuration point]** This specification defines no partial canonicalization default for `parameterConversion`; the boolean/number conversion rule applies recursively to array members and object values before serialization and MUST be deterministic for every accepted boolean or number, while strings remain identical and null follows §8.2 without entering the converter.

**[convention]** Under §7's caller-envelope convention, a present parameter member whose value is JSON null is supplied rather than absent.

**[incorporated]** The `undefined` column is RFC 6570 §2.3's undefined set, which OAS states covers values *including but not limited to* null; the empty string is expressly not undefined. RFC 6570 §2.3 counts as undefined a variable with no value, a list with zero members, and an associative array with zero members ([OAS 3.2.0 §4.12.6](https://spec.openapis.org/oas/v3.2.0.html#style-examples), [RFC 6570 §2.3](https://www.rfc-editor.org/rfc/rfc6570#section-2.3)).

**[pin]** Mapped onto this binding's supplied JSON values, that set is exactly three and no more: JSON null, an array with zero members, and an object with zero members. A supplied value is never absent — §7's envelope makes absence mean not supplied, which omits the parameter before serialization — so RFC 6570's no-value case has no third JSON image here, and no other value joins the set.

**[convention]** For every admitted `style`/`explode` cell whose `undefined` entry states a serialization, each of those three supplied values serializes exactly as that entry. Where the entry is `n/a` the authority defines no serialization at all, and §8.2's `n/a` rule governs instead; the entry is never read as a byte string.

**[pin]** The `undefined` column governs identically on §8.2's RFC 6570 path and on its manual construction path, so one supplied value has one serialization whichever path assembles it, and an `undefined` entry stating a serialization always emits that serialization rather than being omitted. OAS 3.2.0's two statements do not agree here: §4.12.6's `form` rows give `color=` for an undefined value, while Appendix C.4.3 works `formulas: {}` through the equivalent RFC 6570 template `{?formulas*,words}`, obtains `?words=hello,world`, and concludes that a manually constructed template must leave the undefined parameter out entirely. This specification pins §4.12.6's table, which is the section that defines parameter serialization, and discloses the divergence from Appendix C.4.3's worked manual template as deliberate ([OAS 3.2.0 §4.12.6](https://spec.openapis.org/oas/v3.2.0.html#style-examples), against [OAS 3.2.0 Appendix C.4.3](https://spec.openapis.org/oas/v3.2.0.html#undefined-values-and-manual-uri-template-construction)).

### 8.2 Closed `style`, `explode`, and undefined-value table

**[incorporated]** The following table reproduces the complete authority-defined `schema`-form matrix row for row, including the rows whose every cell is `n/a`; OAS states the closure itself — combinations not represented in its table are not permitted. `operator / source` states the RFC 6570 mapping or other OAS byte source, and each `undefined` entry is the authority's result for any of §8.1's three undefined values. For `deepObject`, any explicit `explode` is ignored because the field has no effect ([OAS 3.2.0 §§4.12.2.2, 4.12.3, 4.12.6, Appendix C.1](https://spec.openapis.org/oas/v3.2.0.html#style-values)):

| style | location | admitted shapes | explode | operator / source | undefined serialization |
| --- | --- | --- | --- | --- | --- |
| **[incorporated]** `matrix` | path | primitive, array, object | `false` | `;` | `;name` |
| **[incorporated]** `matrix` | path | primitive, array, object | `true` | `;` plus `*` | `;name` |
| **[incorporated]** `label` | path | primitive, array, object | `false` | `.` | `.` |
| **[incorporated]** `label` | path | primitive, array, object | `true` | `.` plus `*` | `.` |
| **[incorporated]** `simple` | path, header | primitive, array, object | `false` | none | empty serialization |
| **[incorporated]** `simple` | path, header | primitive, array, object | `true` | `*` | empty serialization |
| **[incorporated]** `form` | query, cookie | primitive, array, object | `false` | `?` (`+` when `allowReserved: true`) | `name=` |
| **[incorporated]** `form` | query, cookie | primitive, array, object | `true` | `?` plus `*` (`+` manually when reserved) | `name=` |
| **[incorporated]** `spaceDelimited` | query | array, object | `false` | OAS bytes | `n/a` |
| **[incorporated]** `spaceDelimited` | query | none — every cell `n/a` | `true` | `n/a` | `n/a` |
| **[incorporated]** `pipeDelimited` | query | array, object | `false` | OAS bytes | `n/a` |
| **[incorporated]** `pipeDelimited` | query | none — every cell `n/a` | `true` | `n/a` | `n/a` |
| **[incorporated]** `deepObject` | query | object with scalar properties | `n/a` — ignored | OAS bytes | `n/a` |
| **[incorporated]** `cookie` | cookie | primitive, array, object | `false` | RFC 6265 bytes | `name=` |
| **[incorporated]** `cookie` | cookie | primitive, array, object | `true` | RFC 6265 bytes | `name=` |

**[exclusion]** A selected declaration whose style, location, shape, or explicit `explode` lies outside the table excludes the selected target, and so does one selecting a table row that admits no shape at all — the two `explode: true` rows above — because such a row states that the authority serializes nothing there, which is the same absence of a defined cell reached by a different route. On §9.3's Encoding style path, the smallest owner is the selected media alternative rather than the target. An undefined value reaching an authority-undefined `n/a` cell inside an otherwise admitting row instead refuses that invocation before dispatch at the affected parameter or Encoding property, without excluding other values admitted by the same cell. These exclusions reopen only if incorporated authority defines the exact missing cell.

**[convention]** An undefined member — a null, an empty array, or an empty object — inside a supplied array or object value on an RFC 6570-style path refuses the invocation before dispatch at the affected parameter or Encoding property; RFC 6570's list model has no member-level undefined value, and this binding invents no serialization.

**[incorporated]** Default style is `form` for query and cookie and `simple` for path and header; default `explode` is `true` for `form` and `cookie` and `false` otherwise; `allowReserved` applies only where the destination/style percent-encodes ([OAS 3.2.0 §4.12.2.2](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-for-use-with-schema)).

**[incorporated]** RFC 6570 serialization MUST use the table's operator and `*` for `explode: true`, and a non-exploded label list or map uses a comma. Multiple regular form-style query parameters share one `?` variable list; separately expanding multiple `?` templates is not conformant ([OAS 3.2.0 Appendix C.1](https://spec.openapis.org/oas/v3.2.0.html#equivalences-between-fields-and-rfc6570-operators), [OAS 3.2.0 §4.12.6](https://spec.openapis.org/oas/v3.2.0.html#style-examples), [RFC 6570 §3.2.5](https://www.rfc-editor.org/rfc/rfc6570#section-3.2.5)).

**[pin]** Appendix C.3 SHOULD-handles configurations with no direct RFC 6570 equivalent under RFC 6570 and says implementations MAY create a properly delimited URI Template; this specification pins that latitude to a requirement, because RFC 6570 prefix operators cannot combine. A query mixing regular form expansion with `allowReserved: true` MUST be constructed manually per parameter: reserved-permitting values use reserved expansion, and `[`, `]`, `#`, `&`, `=`, and `+` are pre-percent-encoded where Appendix C requires, the pre-encoding set being verified against C.4.2 ([OAS 3.2.0 Appendix C.3–C.4.2](https://spec.openapis.org/oas/v3.2.0.html#non-rfc6570-field-values-and-combinations)).

**[convention]** The manual path assembles all present per-parameter contributions into one query component with one leading `?` and `&` between contributions; this assembled result is the single-query rule's equivalent at the authority's construction seam.

**[convention]** On both the RFC 6570 path and the manual path, query-contribution order across distinct effective parameters is not portable meaning.

**[incorporated]** A parameter name that is not a legal RFC 6570 variable name MUST be percent-encoded before use in the template construction ([OAS 3.2.0 Appendix C.3–C.4.4](https://spec.openapis.org/oas/v3.2.0.html#illegal-variable-names-as-parameter-names)).

**[convention]** That variable-name encoding is internal to URL assembly and never changes the exact caller-envelope key defined by §7.

**[incorporated]** For `spaceDelimited`, `pipeDelimited`, and `deepObject`, the exact bytes are the corresponding OAS Style Examples: delimiters and deep-object brackets are percent-encoded, object names and values retain their shown alternation, and no unstated escape convention is added ([OAS 3.2.0 §§4.12.4, 4.12.6](https://spec.openapis.org/oas/v3.2.0.html#style-examples)).

**[pin]** Before dispatch, the binding refuses a supplied parameter or property name or scalar value containing its non-RFC style's structural delimiter: U+0020 SPACE for `spaceDelimited`, `|` for `pipeDelimited`, or `[` and `]` for `deepObject`. OAS names exactly those characters as the delimiters of those three styles and RECOMMENDS either documenting an additional escape convention or avoiding the styles; this specification declines the escape convention and offers no configuration point for one, which is the second half of that RECOMMENDED pair applied per value rather than per style. This specification additionally refuses `=` and `&` in a `deepObject` name or value, which OAS's delimiter list does not name: they are refused because OAS's own manual-construction guidance records that `&` and `=` have special behavior in `application/x-www-form-urlencoded`, which is the format a deep-object query component is read as. That widening beyond the authority's delimiter list is disclosed here as this specification's own ([OAS 3.2.0 Appendix E.6](https://spec.openapis.org/oas/v3.2.0.html#percent-encoding-and-illegal-or-reserved-delimiters), [Appendix C.4.2](https://spec.openapis.org/oas/v3.2.0.html#pre-encoding-values)).

**[exclusion]** A compound-capable style is excluded only when its resolved declaration proves an unsupported compound member—an array whose resolved `items` declaration declares only `object` or `array`, or an object with at least one declared property whose resolved declaration declares only `object` or `array`. A typeless resolved member proves no compound shape, a choice that supplies no single resolved member declaration under §5.2 proves no compound shape, and an object declaring no properties proves no compound member, so none triggers this exclusion; in particular, a declaration that still admits a scalar is never excluded, and candidate admission never inspects the supplied runtime value. The rule applies symmetrically to every compound-capable parameter style and to §9.3's Encoding style path, where the smallest owner is the selected media alternative rather than the target. OAS/RFC 6570 defines no expansion for the excluded cells, so the owning unit is excluded unless an incorporated authority defines that exact cell ([OAS 3.2.0 §§4.12.3, 4.12.6, Appendix C.1](https://spec.openapis.org/oas/v3.2.0.html#style-values), [RFC 6570 §3.2.1](https://www.rfc-editor.org/rfc/rfc6570#section-3.2.1)).

**[convention]** Independently of that static admission, a supplied value whose shape exits the admitted style-table cell refuses that invocation before dispatch at the affected parameter or Encoding property, mirroring the null rule; candidate admission still never inspects the supplied value.

**[incorporated]** The Paths Object MUST NOT contain two templated path keys with equivalent hierarchies but different template names. Within one selected target, every path-template expression MUST have exactly one corresponding effective `path` parameter, every effective `path` parameter MUST correspond to exactly one expression, and an expression MUST occur no more than once ([OAS 3.2.0 §§4.8.1–4.8.2, 4.12.2.1](https://spec.openapis.org/oas/v3.2.0.html#path-templating)).

**[exclusion]** Either path-key ambiguity or either direction of a path-expression/parameter mismatch is a declaration defect that excludes the selected target before any caller value is inspected; non-conflicting targets survive. The exclusion reopens only if incorporated authority admits the declaration or defines its unique target mapping.

**[incorporated]** An expanded path value containing unescaped `/`, `?`, or `#` refuses before dispatch ([OAS 3.2.0 §4.8.2](https://spec.openapis.org/oas/v3.2.0.html#path-templating)).

**[incorporated]** Completed URL parsing and percent-decoding follow RFC 3986; `application/x-www-form-urlencoded` query content also parses and percent-decodes under WHATWG URL rules, including unescaped `+` as space, while structural delimiters remain encoded or unencoded exactly as OAS requires ([OAS 3.2.0 §4.12.4](https://spec.openapis.org/oas/v3.2.0.html#url-percent-encoding)).

**[pin]** The WHATWG URL edition is this specification's own selection: OAS's living [WHATWG-URL] citation is pinned to the [WHATWG URL Review Draft of 18 August 2026](https://url.spec.whatwg.org/review-drafts/2026-08/), and a later change in the living text does not alter this identifier.

### 8.3 Content-form, querystring, empty, header, and cookie parameters

**[incorporated]** A `content`-form Parameter Object MUST contain exactly one media-type entry; its application value serializes under that entry, and when a non-`querystring` contribution enters a URL the resulting representation is percent-encoded as one parameter value ([OAS 3.2.0 §§4.12.2.3, 4.12.4](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-for-use-with-content)).

**[pin]** Percent-encoding a content-form parameter leaves RFC 3986 unreserved bytes literal and encodes every other UTF-8 byte as uppercase `%HH`; the exact caller-envelope key remains unchanged.

**[incorporated]** One effective `querystring` parameter is permitted and it is mutually exclusive with every ordinary query parameter on the operation and Path Item; it MUST use `content`, its declared `name` is not serialized, and its selected media representation supplies the entire query string. For `application/x-www-form-urlencoded`, Encoding Objects apply in the same way as with request bodies of that media type, and because that media type is suitable for use in query strings by definition the resulting representation receives no further encoding or escaping ([OAS 3.2.0 §§4.12.1, 4.12.2.1](https://spec.openapis.org/oas/v3.2.0.html#parameter-locations), [§4.12.8](https://spec.openapis.org/oas/v3.2.0.html#parameter-object-examples)).

**[exclusion]** More than one effective `querystring` parameter, or coexistence of one with any ordinary query parameter on the selected operation or Path Item, is a declaration defect that excludes the selected target before caller values are inspected. The exclusion reopens only if an incorporated OAS edition admits the declaration and defines its unique query construction.

**[pin]** For every admitted non-urlencoded `querystring` media lane, the incorporated serialization's bytes are percent-encoded into the query component under the preceding uppercase `%HH` rule; raw insertion is not permitted.

**[exclusion]** A `querystring` media entry whose format has no serialization incorporated by this specification excludes only that parameter lane; this exclusion reopens only when a pinned authority incorporated by this specification defines that mapping.

**[exclusion]** A `querystring` media entry selecting a sequential form is excluded because a stream as a query component has no defined use; the exclusion reopens only if incorporated authority defines sequential query-component serialization and interaction semantics.

**[incorporated]** For a query parameter with `allowEmptyValue: true`, a supplied empty string emits a present zero-length value; absence still means omitted, the empty string remains distinct from §8.2's undefined null, and this binding infers no schema-validity consequence because OAS leaves that interaction implementation-defined ([OAS 3.2.0 §§4.12.2.1, 4.12.6](https://spec.openapis.org/oas/v3.2.0.html#parameter-allow-empty-value)).

**[incorporated]** Header `schema` serialization performs no URI percent-encoding and adds no automatic quotes; header and `style: cookie` parsing does not decode apparent percent encodings ([OAS 3.2.0 §4.12.2.2](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-for-use-with-schema)).

**[pin]** A supplied header value's characters are carried as UTF-8 octets, closing the character-to-octet seam before the field-invalid-byte check below ([RFC 9110 §5.5](https://www.rfc-editor.org/rfc/rfc9110#section-5.5)).

**[convention]** A supplied header value containing CR, LF, or another field-invalid byte refuses before dispatch at the affected parameter ([RFC 9110 §§5.1, 5.5](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[incorporated]** `style: cookie` follows RFC 6265 Cookie syntax: contributions preserve exact names and values, use `; ` between pairs, and apply no percent-encoding or other escaping; values needing escaping MUST arrive already escaped ([OAS 3.2.0 §4.12.3](https://spec.openapis.org/oas/v3.2.0.html#style-values), [RFC 6265](https://httpwg.org/specs/rfc6265.html)).

**[pin]** OAS does speak here, and what it says is that the behavior is undefined: a `Cookie` Header parameter is not forbidden, but the effect of defining a cookie parameter that way is undefined and `in: cookie` should be used instead. This specification pins that undefined cell to a determinate outcome rather than excluding it, because a raw `Cookie` header carries a complete, self-consistent field value whenever it is the only cookie source. Raw-Cookie and structured-cookie declarations alone therefore exclude nothing. An invocation in which a supplied raw `Cookie` Header parameter value and any structured cookie contribution—an effective cookie parameter or selected cookie credential—would both be emitted refuses before dispatch; the binding does not parse or merge the raw string. The pin reopens only if an incorporated OAS edition defines the cell ([OAS 3.2.0 §4.12.2.1](https://spec.openapis.org/oas/v3.2.0.html#parameter-name)).

**[exclusion]** An effective header parameter named `Host` or `Content-Length` excludes the target because those fields are processor-owned and cannot be replaced by caller input; the exclusion reopens only if an incorporated HTTP authority defines caller control that preserves the processor's framing and routing obligations.

**[exclusion]** A form-style cookie declaration is statically excluded only when its effective `explode` and resolved declaration prove multi-value production: `explode: true` together with a declaration that declares only `array`, or one that declares only `object` with at least one declared property. A typeless or scalar-admitting declaration proves no such production; if a supplied value nevertheless would produce multiple cookie pairs, that invocation refuses before dispatch. OAS identifies form-style multi-value delimiters as unsuitable for Cookie, so the exclusion reopens only if an incorporated OAS edition defines a correct multi-value mapping.

## 9. Request and response media

### 9.1 Media identity, alternatives, and request election

**[incorporated]** Media types parse under RFC 9110: type and subtype compare case-insensitively, parameter names compare case-insensitively, and parameter values retain their media-defined comparison rules ([RFC 9110 §§5.6.6, 8.3.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.6.6)).

**[convention]** A **concrete media type** has no wildcard in either its type or subtype; media-type parameters do not affect concreteness.

**[convention]** A declaration matches a concrete media type only when every declared parameter is present with an equal value; matches order by exact type/subtype before `type/*` before `*/*`, then by greatest declared-parameter count, and equal-specificity ties select no declaration.

**[pin]** A declared media-type parameter value is first unquoted under [RFC 9110 §5.6.6](https://www.rfc-editor.org/rfc/rfc9110#section-5.6.6); the value of `charset` then compares ASCII case-insensitively, and every other parameter value, `boundary` included, compares by exact character sequence. RFC 9110 §5.6.6 leaves parameter-value case sensitivity to each parameter's own definition; [RFC 2046 §4.1.2](https://www.rfc-editor.org/rfc/rfc2046#section-4.1.2) marks `charset` as the exception to the general rule, and [RFC 2046 §5.1.1](https://www.rfc-editor.org/rfc/rfc2046#section-5.1.1) constructs the multipart boundary delimiter from the parameter value literally, so an inexact boundary does not delimit.

**[limit]** Distinct content-map keys that normalize to one parsed media identity collide only for that identity and support no selection through it: a request selection refuses before dispatch and a response selection is a loud protocol error. Non-colliding entries survive, and map order never breaks the tie.

**[incorporated]** A no-body invocation bypasses request-body media selection and emits neither a body nor `Content-Type`, because an absent optional Request Body contributes no HTTP content ([OAS 3.2.0 §§4.10.1, 4.13.1](https://spec.openapis.org/oas/v3.2.0.html#request-body-object)).

**[configuration point]** A body-emitting invocation preserves every admissible declared request alternative: exactly one usable concrete entry — one not excluded by this specification's confinement rules — selects itself; every other map, including two or more usable entries or a concrete declaration alongside a usable range, requires a concrete `requestMedia` choice before input consumption; the choice MUST match under §9.1 and never substitutes another declaration's schema, and supplied values never elect.

**[configuration point]** A missing required choice, unmatched or ambiguous choice, unsupported selected lane, or body-emitting invocation with no admissible candidate refuses before dispatch; no body bytes, media registry entry, or examples are sniffed to select a lane.

**[pin]** A body-emitting invocation emits the concrete media type elected above as the request `Content-Type` field value, and where a declared range was instantiated by a `requestMedia` choice the emitted value is that concrete choice, because a range is not a media type a receiver can be sent and no other value is available. The incorporated HTTP authority does speak here, and what it states is a SHOULD: "A sender that generates a message containing content SHOULD generate a Content-Type header field in that message unless the intended media type of the enclosed representation is unknown to the sender" ([RFC 9110 §8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3)). The elected media type is that intended type and is known to this sender, so the excusing condition never obtains under this identifier, and this specification pins that SHOULD to a requirement rather than leaving the field to a sender's discretion. No accepted OAS edition states the emission: OAS's only statement about a request `Content-Type` is that a Header parameter of that name MUST be ignored, so §8.1's ignore rule leaves no artifact-declared parameter competing for the field. A multipart election additionally carries §9.3's `boundary` parameter on this field ([OAS 3.2.0 §4.12.2.1](https://spec.openapis.org/oas/v3.2.0.html#parameter-name)).

**[exclusion]** A Request Body Object declaring `required: true` with an empty `content` map is a declaration defect that excludes the selected target before caller values are inspected, rather than leaving a target every invocation of which refuses: the required body admits no candidate, so no supplied value could ever be carried. OAS makes `content` REQUIRED, says the map SHOULD have at least one entry, and leaves the behavior implementation-defined when it does not; the exclusion reopens only if an incorporated OAS edition defines that behavior ([OAS 3.2.0 §4.13.1](https://spec.openapis.org/oas/v3.2.0.html#request-body-object)).

**[incorporated]** A content-map Media Type Object or `components.mediaTypes` reference MUST resolve before lane selection ([OAS 3.2.0 §§4.7.1, 4.14.1](https://spec.openapis.org/oas/v3.2.0.html#media-type-object)).

**[limit]** Examples create no operation input or output member and never select a declaration, carriage lane, or media type; their data-versus-serialized distinction is descriptive at this boundary ([OAS 3.2.0 §4.19](https://spec.openapis.org/oas/v3.2.0.html#example-object)).

**[limit]** The live OpenAPI Media Type Registry does not widen this pinned identifier: OAS makes support for later registry additions optional, so only media behavior defined by incorporated pinned authority is available ([OAS 3.2.0 §4.14.2.1](https://spec.openapis.org/oas/v3.2.0.html#openapi-media-type-registry)).

**[convention]** The binding sends no `Accept` header: OAS ignores a Header parameter named `Accept`, request-body content declares what the operation consumes, and response content supplies no portable instruction to advertise a preference ([OAS 3.2.0 §§4.12.2.1, 4.13, 4.17](https://spec.openapis.org/oas/v3.2.0.html#parameter-name)).

### 9.2 Common carriage lanes

**[pin]** A non-sequential exact `application/json` or `+json` selection serializes the supplied value as strict JSON on requests and parses strict JSON on responses; JSON text uses UTF-8 ([RFC 6839 §3.1](https://www.rfc-editor.org/rfc/rfc6839#section-3.1), [RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)).

**[pin]** [RFC 6839 §3.1](https://www.rfc-editor.org/rfc/rfc6839#section-3.1) is the incorporated `+json` suffix authority; where its registration inherits RFC 4627's UTF-16/UTF-32 latitude, [RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)'s UTF-8 requirement governs this lane.

**[pin]** Strict JSON is RFC 8259's grammar under this profile: parsing resolves duplicate object member names by taking the lexically last member, the documented common receiver behavior inside RFC 8259 §4's permitted set; a leading byte-order mark on a JSON body is ignored under RFC 8259 §8.1's parser latitude and is never part of the value; and a lone surrogate escape yields no value — it is a loud protocol error, because neither silent replacement nor invalid passthrough preserves the supplied text ([RFC 8259 §§4, 8.1–8.2](https://www.rfc-editor.org/rfc/rfc8259#section-4)).

**[limit]** JSON-lane numbers are interoperable within RFC 8259 §6's binary64 expectation; precision or range beyond it is not preserved across this lane, and that disclosed reduction is the only permitted deviation from the supplied mathematical value ([RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259#section-6)).

**[convention]** `text/json` is not a member of that JSON lane; as a `text/*` type it can use the character-data lane only when its resolved declaration admits `string` as its sole non-null type. This convention reopens under a new identifier only if the IANA media-type registry registers `text/json` with JSON semantics.

**[convention]** A concrete character-data selection governed by a resolved declaration that admits `string` as its sole non-null type carries a supplied string under its declared `charset`, defaulting to UTF-8; `type: ["string", "null"]` therefore selects this lane for its string branch, while a supplied null refuses before dispatch because the lane defines no null lexical form. Response decoding emits a string and never invents null. The closed character-data set is `text/*`, `application/xml`, and `+xml`, while `application/json`, `+json`, and §9.5's sequential forms are claimed by their own lanes. The binding does not consult the live media-type registry's `Encoding considerations`: `application/json` is registered as binary despite requiring UTF-8 text, `text/csv` records no value, and a live lookup would violate this pinned, immutable reading ([RFC 6838 §4.2.1](https://www.rfc-editor.org/rfc/rfc6838#section-4.2.1), [RFC 2046 §4.1](https://www.rfc-editor.org/rfc/rfc2046#section-4.1), [RFC 7303 §§3, 9](https://www.rfc-editor.org/rfc/rfc7303#section-3), [RFC 8259 §§8.1, 11](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)).

**[pin]** This binding is an XML-unaware MIME consumer in RFC 7303 §3's own terms — it processes XML media as opaque character data, never as parsed XML — and the charset parameter is the only character-encoding source this lane consults: consulting a BOM or XML declaration would require inspecting body bytes, which this binding never sniffs, so a charset-less non-UTF-8 XML response is a loud protocol error rather than being sniffed, and every unsupported or invalid character decoding likewise raises a loud protocol error ([RFC 7303 §3.2](https://www.rfc-editor.org/rfc/rfc7303#section-3.2)).

**[pin]** The UTF-8 default charset displaces RFC 2046 §4.1.2's US-ASCII default for `text/*`: RFC 9110 §8.3.2 leaves charset semantics to each media type's registration rather than restating a MIME-era default, and this binding pins the modern-HTTP UTF-8 reading, disclosed here as a deliberate displacement ([RFC 2046 §4.1.2](https://www.rfc-editor.org/rfc/rfc2046#section-4.1.2), [RFC 9110 §8.3.2](https://www.rfc-editor.org/rfc/rfc9110#section-8.3.2)).

**[limit]** UTF-8 decoding MUST be supported; any further charset is an implementation capability whose absence refuses loudly.

**[incorporated]** OAS 3.2 describes raw binary with a typeless resolved declaration ([OAS 3.2.0 §§4.13.2, 4.24.4.2, 4.24.4.3](https://spec.openapis.org/oas/v3.2.0.html#working-with-binary-data)).

**[convention]** A non-JSON, non-form concrete selection whose Media Type Object omits `schema`, or whose present resolved declaration is typeless, uses the raw-octet lane. A schema-omitted media range does not gain this lane because it declares no single concrete representation.

**[incorporated]** A Schema Object with no `type` MUST be considered to allow all types regardless of which other keywords are present, so every other keyword in a typeless resolved declaration still applies; and `maxLength` on raw content measures wire octets rather than the Base64 boundary string ([OAS 3.2.0 §4.24.4.2](https://spec.openapis.org/oas/v3.2.0.html#non-json-data) for the typeless-keyword clause, [§§4.14.3.2, 4.24.4.3](https://spec.openapis.org/oas/v3.2.0.html#binary-streams) for `maxLength`).

**[incorporated]** Invoking this binding does not trigger validation of any application value, including a mixed binary instance, against its governing Schema Object, and this binding elects no binary-validation technique; only a tool that separately claims validation owes Core's validation rules (Core [invariant 2](../../openbindings.md#2-core-invariants), [OBI-T-16](../../openbindings.md#103-tool-rules)).

**[incorporated]** A resolved declaration that admits `string` as its sole non-null type with `contentEncoding` carries the caller's artifact-encoded string as text and does not trigger OpenBindings Base64 decoding; `contentMediaType` is ignored when it contradicts the governing Media Type or Encoding Object, and schema encoding is distinct from HTTP `Content-Encoding` ([OAS 3.2.0 §4.24.4.3](https://spec.openapis.org/oas/v3.2.0.html#working-with-binary-data)).

**[convention]** A concrete selection in that same closed character-data set whose resolved declaration is neither sole-string nor typeless is also a character-data selection and is not excluded by §9.2's catch-all: the lane admits it, and the type determination below fixes which lexical form the lane carries. The sole-string rule above is the case where that determination is already settled by the declaration alone.

**[incorporated]** For a non-JSON text serialization, OAS requires the schema inspection represented by §5.2's resolved declaration and, when available, inspection of validated runtime data; a typeless declaration permits all types, and OAS leaves the result implementation-defined when those sources do not determine one type ([OAS 3.2.0 §4.24.4.2](https://spec.openapis.org/oas/v3.2.0.html#non-json-data)).

**[convention]** For this binding, `validated runtime data` means the supplied JSON value's own type; no validation is implied or performed. That supplied type resolves the determination when it identifies one permitted non-JSON serialization type.

**[pin]** After that type determination, a boolean serializes as exactly `true` or `false`; a number uses the shortest RFC 8259 number spelling denoting the same mathematical value, with ties preferring non-exponent form, lowercase `e` without `+` or leading exponent zeros, and `0` for zero including negative zero. The mathematical value is the supplied JSON number's exact value under Core's RFC 8259 model, with no binary64 reduction ([RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259#section-6), Core [§5](../../openbindings.md#5-document-model)).

**[limit]** If type ambiguity remains after §5.2 resolution and inspection of the supplied JSON value's own type when available, the invocation refuses before dispatch and a response decoding is a loud protocol error, rather than either choosing one privately.

**[pin]** Every OpenBindings raw-octet value is a JSON string containing canonical RFC 4648 §4 Base64: standard alphabet, required padding, no ignored non-alphabet characters, and zero unused pad bits; requests decode before dispatch and responses encode the exact octets ([RFC 4648 §§3.3, 3.5, 4](https://www.rfc-editor.org/rfc/rfc4648)).

**[convention]** A supplied raw-octet value that is not a JSON string, or that is a JSON string failing that canonicality in any respect, refuses before dispatch at the affected body or part: the decode is never partially applied, no non-alphabet character is skipped, and no repair supplies missing padding. The response direction has no counterpart because encoding the exact octets always succeeds.

**[exclusion]** This specification does not generate XML from an object model because OAS 3.2 still leaves ordinary object-node order undefined and null serialization implementation-defined and identifies adjacent text nodes as ambiguous; the selected media alternative is excluded until incorporated authority defines those remaining bytes, while string and raw-octet XML carriage remain admitted ([OAS 3.2.0 §§4.26.1, 4.26.2.2, 4.26.5](https://spec.openapis.org/oas/v3.2.0.html#xml-object)).

**[convention]** Because `readOnly` and `writeOnly` are annotations whose enforcement OAS leaves to the application, this binding never uses them to delete a supplied wire member or synthesize an absent one ([OAS 3.2.0 §4.24.5.2](https://spec.openapis.org/oas/v3.2.0.html#validating-readonly-and-writeonly)).

**[exclusion]** A concrete request or response selection admitted by none of the JSON, character-data, raw-octet, string XML carriage under §9.2's XML rule, request-only form and multipart, sequential, or other explicitly incorporated lanes is excluded at its smallest media owner because OAS supplies no value-to-bytes mapping; the exclusion reopens only if an incorporated authority defines that media/data-form cell.

### 9.3 Form bodies, multipart parts, and Encoding Objects

**[incorporated]** A Media Type Object's `encoding` is ignored outside `application/x-www-form-urlencoded` and `multipart` media, while `prefixEncoding` and `itemEncoding` are ignored outside `multipart`; an ignored field creates no binding behavior ([OAS 3.2.0 §4.14.5](https://spec.openapis.org/oas/v3.2.0.html#encoding-usage-and-restrictions)).

**[incorporated]** `application/x-www-form-urlencoded` and name-based `multipart` serialization map object properties through the governing Schema and Encoding Objects; array properties repeat the same name in item order, cross-property pair order is implementation-defined, and an `encoding` key with no corresponding property is ignored ([OAS 3.2.0 §4.14.5.1](https://spec.openapis.org/oas/v3.2.0.html#encoding-by-name)).

**[incorporated]** For `application/x-www-form-urlencoded` those encoding keys MUST map to parameter names; for `multipart` they MUST map to the `name` parameter of the `Content-Disposition: form-data` header of each part. Every emitted name-based part therefore carries a `Content-Disposition` header field whose disposition type is `form-data` and which MUST also carry a `name` parameter holding that property name, and an array property emits one part per item under that same name ([OAS 3.2.0 §4.14.5.1](https://spec.openapis.org/oas/v3.2.0.html#encoding-by-name), [RFC 7578 §§4.2, 4.3](https://www.rfc-editor.org/rfc/rfc7578#section-4.2)).

**[exclusion]** A property name that cannot be represented safely as the multipart `name` parameter, including any name containing CR or LF, excludes only that multipart media alternative; the exclusion reopens only if an incorporated authority defines an unambiguous encoding.

**[incorporated]** A multipart entity's parts are delimited with a boundary delimiter constructed from CRLF, `--`, and the value of the `boundary` parameter, which is supplied as a `boundary` parameter on the emitted media type; the boundary delimiter MUST NOT appear inside any encapsulated part. The entity opens with `--`, the boundary value, and a CRLF; each subsequent part is preceded by a CRLF, `--`, the boundary value, and a CRLF; and the entity closes with a CRLF, `--`, the boundary value, and a final `--`. The boundary value is 1 to 70 characters of RFC 2046's `bchars` not ending in white space, and a composer MUST NOT generate non-zero-length transport padding ([RFC 7578 §4.1](https://www.rfc-editor.org/rfc/rfc7578#section-4.1), [RFC 2046 §5.1.1](https://www.rfc-editor.org/rfc/rfc2046#section-5.1.1)).

**[convention]** The processor generates that boundary token and this binding declares no generation procedure: any token satisfying the incorporated grammar that appears in no encapsulated part discharges the requirement. Neither the token nor the optional quoting the incorporated authority permits for it on the media-type field is portable meaning, because every admitted spelling denotes the same delimiter. The binding emits no preamble and no epilogue, both of which the incorporated grammar makes optional and discardable.

**[exclusion]** The **name-based** form and multipart lanes are request-only: a response selection of `application/x-www-form-urlencoded`, or of a `multipart` media type whose governing declaration selects encoding by name rather than encoding by position under §9.3's mutual-exclusion rule, is excluded at its smallest media owner. The reason is the repeated-name ambiguity of the write mapping, not the placement of the authority's headings: OAS defines the name mapping in the write direction only — an array property produces one encoded value per item, each under the same name — and supplies no inverse telling a reader whether two parts sharing a name are a two-member array property or two separate declarations, nor how to recover a property that produced zero values. This specification will not invent that inverse. The exclusion reopens only if an incorporated authority defines that decoding ([OAS 3.2.0 §4.14.5.1](https://spec.openapis.org/oas/v3.2.0.html#encoding-by-name)).

**[limit]** The exclusion is scoped to that name-based mapping and reaches no further. **Positional** `multipart` is not excluded on responses: it is one of §9.5's incorporated sequential forms, its part-to-item correspondence is positional rather than name-keyed and so carries no repeated-name ambiguity, and OAS 3.2.0 works it in the response direction itself — a device streaming images to the caller under `multipart/mixed` with `itemSchema` and `itemEncoding`, and `multipart/byteranges`, which is a response-only media type. §9.5 governs such a selection end to end. Read this as an edition difference, never as sibling drift: OAS 3.2.0 introduced the positional and streaming multipart surface that carries this response direction, and the 3.0 and 3.1 lines have no equivalent ([OAS 3.2.0 §§4.14.5.2, 4.15.4.1, 4.15.4.8, 4.15.4.9](https://spec.openapis.org/oas/v3.2.0.html#encoding-by-position), [RFC 9110 §14.6](https://www.rfc-editor.org/rfc/rfc9110#section-14.6)).

**[convention]** A supplied `body: null` against a form or multipart object declaration refuses before dispatch: neither lane defines a null lexical form, mirroring §9.2's character-data rule.

**[exclusion]** A media alternative whose Encoding-style serialization generates one wire name from two declared sources — an exploded nested property colliding with a sibling top-level property — is excluded; the exclusion reopens only if an incorporated authority defines the collision's unique decoding.

**[incorporated]** Encoding `style`, `explode`, and `allowReserved` controls apply only to form-urlencoded and multipart/form-data; explicit presence of any control selects the §8.2 style path and ignores `contentType`, while absence of all three selects content-based encoding under the explicit or default `contentType` ([OAS 3.2.0 §§4.15.1.1, 4.15.1.2](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-for-rfc6570-style-serialization)).

**[incorporated]** Outside `application/x-www-form-urlencoded` and `multipart/form-data`, Encoding `style`, `explode`, and `allowReserved` are ignored and create no binding behavior ([OAS 3.2.0 §4.15.1.2](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-for-rfc6570-style-serialization)).

**[incorporated]** Form-urlencoded content uses the WHATWG URL form-urlencoded algorithm after each complex value is serialized; its style path removes RFC 6570's leading `?`. Multipart style serialization places names in `Content-Disposition`, values in part bodies, applies no URI percent-encoding, and gives `allowReserved` no effect ([OAS 3.2.0 §§4.12.4, 4.15.3, Appendix C](https://spec.openapis.org/oas/v3.2.0.html#encoding-the-x-www-form-urlencoded-media-type)).

**[pin]** OAS's normative `[WHATWG-URL]` reference is the undated URL Living Standard, so the revision is this specification's own selection and not the authority's: it is §8.2's pinned [WHATWG URL Review Draft of 18 August 2026](https://url.spec.whatwg.org/review-drafts/2026-08/) here as there, and a later change in the living text does not alter this identifier.

**[incorporated]** Encoding `contentType` defaults are exactly: a typeless resolved declaration or one that admits `string` as its sole non-null type with `contentEncoding` → `application/octet-stream`; plain string, number, integer, or boolean → `text/plain`; object or array → `application/json`. An explicit single concrete value fixes the part type. The table is keyed on the value the Encoding Object is applied to, which under encoding by name is the **array item** for a property declared `array` and the entire value for every other type — so the table's `array` row reaches only an array nested inside a top-level array, never a top-level array property ([OAS 3.2.0 §4.15.1.1](https://spec.openapis.org/oas/v3.2.0.html#common-fixed-fields-0), [§4.14.5.1](https://spec.openapis.org/oas/v3.2.0.html#encoding-by-name)).

**[convention]** The unit that determination is keyed to is therefore the **encoded value**: the resolved `items` declaration of a top-level `array` property under encoding by name, the resolved declaration of the whole value otherwise, and the resolved `itemSchema` or positional declaration under encoding by position. Every rule in this section that reads a part's resolved declaration — this default table, the typeless part rule below, and the declaration `propertyMedia` is tested against — reads it at that same unit, so an `array` property of strings takes the `text/plain` default once per emitted item rather than the `application/json` default of its container. The `propertyMedia` configuration key itself stays per property, so one supplied choice governs every item that property emits and the requirement remains preflightable under §12.1.

**[convention]** That default determination is declaration-keyed rather than value-keyed: the authority's table keys on the resolved declaration — its `type: absent` row proves the key is the schema, since a runtime value cannot lack a type — so §9.2's supplied-type rule does not reach this determination. A multi-type resolved set determines no default; the no-default refusal below and the `propertyMedia` requirement extend to it.

**[convention]** On the content-based form path a supplied null property is elided **before** any part media type is determined: it is dropped as an omitted optional member and contributes neither a form-urlencoded field nor a multipart part, so no `contentType` — explicit, defaulted, or configured — is ever consulted for it. OAS states this ordering directly: how a `null` type value is handled depends on how nulls are serialized, and if null values are entirely omitted then the `contentType` is irrelevant. This rule is separate from §8.2's style-path handling ([OAS 3.2.0 §4.15.1.1](https://spec.openapis.org/oas/v3.2.0.html#common-fixed-fields-0)).

**[limit]** Elision is available only where omission is faithful. A supplied null on a property the governing resolved declaration marks required cannot be silently dropped — omitting it would emit a form the declaration does not describe — so that invocation refuses before dispatch; sibling properties and alternatives remain usable.

**[limit]** That elision identifies `{}` and `{"x": null}` on the wire: a deliberate loss inside the authority's data-type-conversion latitude, disclosed here — the distinction between an absent optional member and an explicit null does not survive this lane ([OAS 3.2.0 Appendix B](https://spec.openapis.org/oas/v3.2.0.html#appendix-b-data-type-conversion)).

**[convention]** A supplied null positional multipart item refuses before dispatch: positional order forbids elision, and the lane defines no null part form.

**[limit]** A supplied **non-null** value reaching content-based encoding with neither an explicit concrete `contentType` nor a determined default refuses that invocation before dispatch because the authority supplies no part media type; other values and alternatives remain usable, and no private default is available under this identifier. An elided null never reaches this rule, because §9.3's elision rule above drops it before a media type is needed.

**[configuration point]** A wildcard or comma-separated multi-valued Encoding `contentType` on a content-based form-urlencoded or multipart property requires `propertyMedia`: one concrete media type per affected property. The choice MUST satisfy one declared member under §9.1, and an absent, unmatched, or ambiguous required choice refuses before dispatch.

**[incorporated]** A part whose resolved declaration admits `string` as its sole non-null type with `contentEncoding` remains artifact-encoded text. For multipart, that `contentEncoding` declares the equivalent `Content-Transfer-Encoding` header on the part, and an explicit Encoding header whose resolved declaration disallows the value makes both serialization and parsing undefined ([OAS 3.2.0 §§4.15.4.2, 4.24.4.3](https://spec.openapis.org/oas/v3.2.0.html#content-transfer-encoding-and-contentencoding)).

**[convention]** A part with a typeless resolved declaration uses the raw-octet lane and §9.2's canonical Base64 boundary.

**[convention]** A multipart part with such `contentEncoding` emits the equivalent `Content-Transfer-Encoding` header.

**[exclusion]** Such an explicit Encoding-header contradiction excludes the affected multipart field, not the whole media alternative. A body-emitting invocation that reaches the field refuses before dispatch, parsing that reaches it fails loudly, and synthesis reports that field as coverage loss; unaffected fields and media alternatives remain available. The field exclusion reopens only if incorporated authority defines both serialization and parsing for the contradiction.

**[incorporated]** Name-based `encoding` is mutually exclusive with `prefixEncoding` and `itemEncoding`. Positional encoding applies only to `multipart`, requires `itemSchema` or an array `schema`, models one part per array item in order, applies each `prefixEncoding` entry to its corresponding position, ignores surplus prefix entries, and applies `itemEncoding` to every remaining item ([OAS 3.2.0 §§4.14.1, 4.14.5.2](https://spec.openapis.org/oas/v3.2.0.html#encoding-by-position)).

**[limit]** A violation of those mutual-exclusion or positional-prerequisite rules makes only the selected media alternative unavailable; sibling alternatives and unrelated targets survive under §3.2's smallest-owner rule.

**[incorporated]** Positional `multipart/form-data` has no property name to infer part names; each applicable Encoding Object therefore MUST declare a `Content-Disposition` header supplying the part name, and the binding never invents one ([OAS 3.2.0 §4.14.5.3](https://spec.openapis.org/oas/v3.2.0.html#additional-encoding-approaches), [RFC 7578 §4.2](https://www.rfc-editor.org/rfc/rfc7578#section-4.2)).

**[incorporated]** An Encoding `headers` map is ignored outside `multipart`, and a `Content-Type` entry in that map is ignored even for multipart ([OAS 3.2.0 §4.15.1.1](https://spec.openapis.org/oas/v3.2.0.html#common-fixed-fields-0)).

**[convention]** Non-ignored Encoding `headers` keys that differ only by ASCII case exclude that media alternative, because HTTP field names are case-insensitive and the wire cannot preserve the distinction.

**[convention]** A part-header value is fixed completely by the artifact only when its resolved declaration admits exactly one value through `const` or a single-member `enum`; `default` and examples do not fix a value.

**[limit]** Non-ignored Encoding `headers` are descriptive at this operation boundary and produce no caller channel: the binding emits only such an artifact-fixed header value, plus §9.3's `contentEncoding`-declared equivalent `Content-Transfer-Encoding`, and never emits any other undeclared header; a positional form-data name or other required part header without that exact-value proof leaves the selected alternative unavailable.

**[incorporated]** An Encoding Object's nested `encoding`, `prefixEncoding`, and `itemEncoding` fields apply recursively, and every processor MUST support one level of nesting ([OAS 3.2.0 §4.15.2](https://spec.openapis.org/oas/v3.2.0.html#nested-encoding)).

**[exclusion]** A selected media alternative requiring more than one nested Encoding level is excluded because OAS makes deeper support optional; the exclusion belongs only to that alternative and reopens only if an incorporated authority requires the deeper level.

### 9.4 HTTP content codings

**[incorporated]** HTTP `Content-Encoding` is distinct from media type and from Schema Object `contentEncoding`; request codings apply in listed wire order and response codings decode in reverse order before the selected media lane ([RFC 9110 §8.4](https://www.rfc-editor.org/rfc/rfc9110#section-8.4), [OAS 3.2.0 §4.24.4.3](https://spec.openapis.org/oas/v3.2.0.html#working-with-binary-data)).

**[incorporated]** OAS declares request headers as Parameter Objects with `in: header` and response headers as a Response Object's `headers` map of Header Objects; field-name comparison is ASCII case-insensitive ([OAS 3.2.0 §§3.2, 4.12, 4.17](https://spec.openapis.org/oas/v3.2.0.html#header-object), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[convention]** That the content-coding declaration surfaces are exactly two — an effective request header parameter named `Content-Encoding` and a governing response Header Object of that name — is this specification's closure of the surface, not the authority's: OAS defines the positions, and this specification states that no other position declares a coding.

**[pin]** A `Content-Encoding` field value on either surface denotes the RFC 9110 §8.4 list of content-coding tokens in wire order: the serialized field value is split on `,`, each element is stripped of leading and trailing whitespace, and each resulting token is matched ASCII case-insensitively against the configured map keys. A caller-supplied value is serialized under §8's parameter rules first, so one string and one single-element array denote the same one-token list. The admission test below is separate from that split and runs against the **complete serialized field value**, whether the governing declaration is `schema`-form or `content`-form, because a Header Object describes one field value rather than a token; the split then supplies the codec stack from the value that test admitted ([RFC 9110 §8.4](https://www.rfc-editor.org/rfc/rfc9110#section-8.4)).

**[exclusion]** Two governing response Header Object keys that differ only by ASCII case and both govern binding behavior exclude the smallest owning response alternative before any actual response is inspected; the exclusion reopens only if an incorporated authority defines a wire mapping that preserves such case-distinct declarations. On this line the governing set has two members, not one: the content-coding surface above, and `required`, because the 3.2 Header Object carries a `required` field and §9.6 makes a declared `required: true` header mandatory in the actual response. Read this as an edition difference, never as sibling drift — the OAS 2.0 Header Object has no `required` field, so on that line the content-coding surface is the whole of it ([OAS 3.2.0 §4.21.1.1](https://spec.openapis.org/oas/v3.2.0.html#header-object), against [OAS 2.0 Header Object](https://spec.openapis.org/oas/v2.0.html#headerObject)).

**[configuration point]** `requestContentCodings` and `responseContentCodings` are finite consumer maps from case-insensitive content-coding tokens to deterministic encoders and decoders; on requests the caller-supplied effective `Content-Encoding` header parameter value fixes the encoder stack, while on responses the actual value governed by the Response Header Object fixes the decoder stack, and no configuration preference narrows either declared surface; two configuration tokens in either map that collide after ASCII case-folding are not a usable configuration, and an invocation reading that map refuses before dispatch, mirroring §9.1's normalized-identity collision rule.

**[configuration point]** An unsupported token, a field value not admitted by its governing Header declaration, an ambiguous coding declaration, or an actual response coding with no governing Header Object is never skipped or sniffed: a request-side condition refuses before dispatch and a response-side condition is a loud protocol error; configuring a codec supplies capability but never declares a coding the artifact omitted.

### 9.5 Sequential media and server-sent events

**[incorporated]** OAS sequential media consist of a repeating structure with no modeled header, footer, envelope, or other metadata; the sequence maps to a JSON array in wire order. This binding incorporates the forms OAS 3.2 itself defines: `application/jsonl`, `application/x-ndjson`, `application/json-seq`, `+json-seq`, `text/event-stream`, and positional `multipart` sequences ([OAS 3.2.0 §§4.14.3.1, 4.14.5.2, 4.14.6.2](https://spec.openapis.org/oas/v3.2.0.html#sequential-media-types), [RFC 7464](https://www.rfc-editor.org/rfc/rfc7464), [RFC 8091](https://www.rfc-editor.org/rfc/rfc8091)).

**[exclusion]** A purported sequential media type whose item framing is not defined by incorporated pinned authority is unavailable because neither payload sniffing nor the live media registry may supply missing framing; the exclusion belongs to that selected alternative. The exclusion reopens only if incorporated authority defines the missing framing.

**[pin]** Because neither `application/jsonl` nor `application/x-ndjson` is IANA-registered and their describing pages are mutable, their item framing is pinned self-contained here: items are LF-delimited JSON texts, and a CR immediately preceding a delimiting LF is consumed with it; a trailing LF after the final item terminates that item and creates no further item; a final item ended by the end of the stream without a trailing LF is a complete item; and an empty or whitespace-only line is a malformed item under §9.5's malformed-item rule.

**[incorporated]** `schema`, when present, applies to the complete sequence as its ordered JSON array; `itemSchema`, when present, applies independently to each item, and both MAY coexist ([OAS 3.2.0 §§4.14.1, 4.14.3](https://spec.openapis.org/oas/v3.2.0.html#complete-vs-streaming-content)).

**[convention]** A sequential request consumes exactly one caller `body` value—the JSON array in media order—so request streaming never changes §7's unary caller-input boundary.

**[incorporated]** Sequential request serialization emits one media item per array element; `schema` governs the complete array and `itemSchema` governs each emitted element ([OAS 3.2.0 §§4.14.3.1, 4.14.3.1.1](https://spec.openapis.org/oas/v3.2.0.html#streaming-sequential-media-types)).

**[exclusion]** Sequential request emission is available only for forms whose incorporated authority defines write-direction item serialization. OAS defines post-parse handling and supplies examples for `text/event-stream` but no object-to-event write algorithm, so a `text/event-stream` request-body alternative is excluded; the exclusion belongs only to that alternative and reopens only if incorporated authority defines the missing write mapping.

**[convention]** Synthesis determines streaming capability statically from the artifact alone. The capability bound considers every Response Object that could govern a status classified as successful by §9.6 and every media declaration such a response can select; the operation is streaming-capable when at least one admitted success declaration is sequential. This bound is synthesis-reported only and constrains no invocation behavior.

**[incorporated]** A sequential response is server-streaming; `itemSchema` applies independently to each parsed item, while a co-present `schema` remains an aggregate constraint over the complete ordered sequence ([OAS 3.2.0 §§4.14.3.1, 4.14.3.1.1](https://spec.openapis.org/oas/v3.2.0.html#streaming-sequential-media-types)).

**[convention]** When §9.6 classifies the final status as successful, each parsed sequential-response item emits one successful operation value in order (Core [§5.1](../../openbindings.md#51-operations)); under a non-successful final status the sequential body is §9.6's failure data like any other body, and no item emits an operation value. An actual response's interaction shape and media are governed only by the Response Object selected for its final status: declarations for every other status affect the static bound above but never change that response from unary to streaming or vice versa.

**[convention]** A sequential operation value, once emitted, is a successful operation value and stands whatever later ends the interaction. No condition arising after its emission withdraws or invalidates it — not a malformed later item, not a transport failure, and not a later loud protocol error anywhere in the content-coding, character-decoding, or lane chain — and the interaction's unsuccessful completion is reported alongside the values already emitted rather than in place of them. §9.6's commit rule states the corresponding rule for the unary case and reaches no sequential body, by its own first words. The two rules below are instances of this one, not its extent.

**[convention]** An item whose incorporated sequential framing is malformed is not emitted and the interaction completes unsuccessfully; earlier emitted values remain successful values. No event-stream block is malformed in that sense — the incorporated parse below either dispatches an event or dispatches nothing — so this rule reaches `text/event-stream` only through a transport failure, never through a field-shape defect. Invocation evaluates neither `itemSchema` nor complete-sequence `schema` conformance: items are emitted as parsed, and only a tool separately claiming validation owes Core's validation rules (Core [invariant 2](../../openbindings.md#2-core-invariants), [OBI-T-16](../../openbindings.md#103-tool-rules)).

**[pin]** RFC 7464 §§2.1 and 2.3 permit a parser to continue past a malformed element and equally permit the application to choose termination; this binding is the application, and termination is its pinned choice within that authority-permitted set ([RFC 7464 §§2.1, 2.3](https://www.rfc-editor.org/rfc/rfc7464#section-2.1)).

**[convention]** A clean end of stream completes a §9.6-successful line-delimited or JSON-text-sequence interaction successfully, mirroring the SSE clean-close rule below; a final item truncated by that end is a malformed item under the preceding rule; and a transport reset or truncated HTTP message completes the interaction unsuccessfully, with earlier emitted values standing.

**[incorporated]** `text/event-stream` MUST first be parsed under OAS's incorporated event-stream processing rules, including ignored comments and fields, multi-line data combination, and field-specific parsing. Each item is then an object with required string `data`, optional string `event` and `id`, and optional nonnegative integer `retry`; no field is collapsed into a data-only value ([OAS 3.2.0 §§4.14.4, 4.14.6.3](https://spec.openapis.org/oas/v3.2.0.html#special-considerations-for-server-sent-events)).

**[pin]** OAS's incorporated event-stream processing rules are a living WHATWG HTML link; this specification pins that link's revision to the [whatwg/html source snapshot at commit 24c5e48bf66ea61bc199ec6338c81258275ba9c6](https://github.com/whatwg/html/blob/24c5e48bf66ea61bc199ec6338c81258275ba9c6/source), and a later change in the living text does not alter this identifier.

**[pin]** The incorporated parse dispatches events and maintains stream state; it does not itself produce the item object the preceding rule describes, so this specification pins the projection from one dispatched event to one item, inside the set OAS's own worked equivalence permits. **One dispatched event yields exactly one item, and an item carries exactly the fields that event's own block declared.** `data` is the accumulated data buffer with its trailing LF removed, and is always present, because a block whose data buffer is empty dispatches no event and therefore contributes no item at all. `event` is present only when that block declared a non-empty event type, carrying it verbatim; no `message` default is supplied. `id` is present only when that block declared `id`, carrying that block's value; the parse's last-event-ID buffer persists across events as reconnection state and never populates a later item. `retry` is present only on the item whose block declared it, as the nonnegative integer that block's digits denote; it is never carried forward, and a non-digit `retry` value the parse ignores contributes no member. OAS 3.2.0's worked JSON Lines equivalence is exactly this projection: its three items carry `retry` on the first alone, and its ignored comment and unknown field contribute nothing ([OAS 3.2.0 §§4.14.4, 4.14.6.3](https://spec.openapis.org/oas/v3.2.0.html#server-sent-event-streams)).

**[convention]** A server-initiated clean close after zero or more valid SSE items completes a §9.6-successful interaction successfully; it never upgrades a non-successful classification.

**[limit]** `retry` crosses the operation-value boundary because the incorporated authority defines it as part of the event data model — OAS's own worked JSON Lines equivalence carries `retry` in the item value; this authority-shaped exception to the rule that transport directives do not become values is not a license to surface other transport directives ([OAS 3.2.0 §4.14.6.3](https://spec.openapis.org/oas/v3.2.0.html#server-sent-event-streams)).

**[limit]** Non-sequential media remain unary: one HTTP response body produces at most one operation value under this operation-value boundary ([OAS 3.2.0 §4.14.3](https://spec.openapis.org/oas/v3.2.0.html#complete-vs-streaming-content)).

### 9.6 Response declaration, classification, and decoding

**[incorporated]** Response keys are closed to exact HTTP status codes, the five uppercase ranges `1XX` through `5XX`, `default`, and specification extensions; an exact key overrides its matching range. An HTTP status code is a three-digit integer whose first digit selects one of five classes, so the exact-key form is bounded to `100` through `599` and no key outside that bound is an HTTP status code ([OAS 3.2.0 §§4.16.1–4.16.3](https://spec.openapis.org/oas/v3.2.0.html#responses-object), [RFC 9110 §15](https://www.rfc-editor.org/rfc/rfc9110#section-15)).

**[exclusion]** A Responses key outside that closed admitted set — a lowercase range, a non-three-digit key, or a three-digit key outside `100`–`599` among them — is a declaration defect that excludes the selected target before any actual response is inspected; the exclusion reopens only if an incorporated OAS 3.2 edition admits that exact key form.

**[exclusion]** An upstream-invalid governing Response Object — one that is not a Response Object at all, or one violating the Response Object's fixed-field constraints: a `description` that is not a string, a `content`, `headers`, or `links` value that is not a map, or a `headers` member that is not a Header Object — is a declaration defect that excludes the selected target before any actual response is inspected, because response governance is target-level; the exclusion reopens only if an incorporated OAS 3.2 edition admits the exact declaration ([OAS 3.2.0 §§4.16, 4.17](https://spec.openapis.org/oas/v3.2.0.html#response-object)).

**[limit]** The exclusion above reaches only a Response Object that can GOVERN a SUCCESSFUL response: an exact 2xx status key, the `2XX` range key, or `default` when no `2XX` range key is declared — a `2XX` key covers the whole success class, so `default` can then never govern one. A fixed-field violation in a declaration that can never govern a 2xx status incurs no coverage loss — a failure body is decoded best-effort under this same section, so a defect in a declaration that can never govern a 2xx status can only leave the failure data undecoded and can never misstate a value this operation contract carries — and therefore does not exclude: a target whose success declarations are intact stays represented. This scope is this specification's reasoning about representation and is identical on all four sibling lines; it must not be confused with the separate, AUTHORITY-owned reason stated below for why an omitted `description` is conformant on this line only ([OAS 3.2.0 §4.16](https://spec.openapis.org/oas/v3.2.0.html#responses-object)).

**[limit]** Omission of `description` is not a violation on this line, and the difference from the siblings is the AUTHORITY's rather than this specification's: OAS 3.2.0 drops the `REQUIRED` marker that OAS 3.0.4 and OAS 3.1.2 carry on the Response Object's `description`, and adds an optional `summary` beside it, so a governing Response Object that omits `description` is conformant here and governs normally, with or without declared content. The same omission is an upstream-invalid Response Object on the 3.0 and 3.1 lines and excludes the selected target there. What OAS 3.2.0 still fixes is the KIND: `description` is typed `string`, so one present with a non-string value is a fixed-field violation and excludes as above. Read this as an edition difference, never as sibling drift ([OAS 3.2.0 §4.17.1](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-14), against [OAS 3.0.4 §§4.7.16, 4.7.17](https://spec.openapis.org/oas/v3.0.4.html#response-object) and [OAS 3.1.2 §4.8.17.1](https://spec.openapis.org/oas/v3.1.2.html#response-object)).

**[convention]** The governing Response Object lookup order is exact status, then the single matching range, then `default`; range-over-default is this specification's reading, and declarations never reclassify the native status.

**[incorporated]** RFC 9110 defines the 2xx class as successful ([RFC 9110 §15.3](https://www.rfc-editor.org/rfc/rfc9110#section-15.3)).

**[convention]** For this binding, success means that the final status—the status after any interim responses and any redirects the runtime chose to follow with the bound method and complete body preserved—is in that 2xx class; a method-rewriting redirect is the final response of this interaction, and anything a runtime does after it is a different interaction outside this classification.

**[convention]** Redirect following is runtime policy. A redirect followed with the bound method and complete body preserved remains this interaction; a method-rewriting redirect is a final response of this interaction ([RFC 9110 §15.4](https://www.rfc-editor.org/rfc/rfc9110#section-15.4)).

**[limit]** Outcome classification depends on the final status, while redirect following and transport content negotiation, including a runtime-advertised `Accept-Encoding`, are runtime policy under Core §1.2. Two conformant runtimes MAY therefore classify one wire history differently, and that redirect/negotiation variance is the stated permitted set; the binding itself emits no negotiation field beyond those this specification pins (Core [§1.2](../../openbindings.md#12-out-of-scope)).

**[incorporated]** A 3.2 Response Object may carry `summary` and optional `description`; neither field is required for the response declaration to govern ([OAS 3.2.0 §4.17.1](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-14)).

**[incorporated]** A response Header Object named `Content-Type` is ignored. Every other governing response Header Object declaring `required: true` makes that header mandatory in the actual response ([OAS 3.2.0 §§4.17.1, 4.21](https://spec.openapis.org/oas/v3.2.0.html#response-headers)).

**[limit]** An actual response missing such a declared required header is a loud protocol error, in the same class as the undeclared non-empty-response error below; header carriage remains outside the operation-value boundary.

**[incorporated]** A non-empty response selects its concrete media type from `Content-Type` and then the most-specific matching governing content declaration ([OAS 3.2.0 §§4.16, 4.17](https://spec.openapis.org/oas/v3.2.0.html#response-object)).

**[convention]** An unmatched, ambiguous, normalized-colliding, or matched-but-excluded result is a loud protocol error; an unused excluded response sibling never makes the target unusable before dispatch.

**[convention]** When a non-empty response omits `Content-Type`, the binding takes RFC 9110's permitted `application/octet-stream` assumption before ordinary matching; the resulting type still MUST match a governing declaration ([RFC 9110 §8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3)).

**[convention]** An **empty response** has zero content octets after transfer decoding and content-coding decoding; a response to HEAD is empty by definition.

**[convention]** Empty responses emit no operation output value; the binding does not manufacture JSON null or an empty string at the output boundary.

**[convention]** Successful non-empty non-sequential responses emit the selected lane's one application value.

**[convention]** A failure body is decoded through the same selected carriage lanes as a successful body, and the decoded value is carried as opaque application-authored failure data on unsuccessful completion. That decoding is best-effort: when the governing content declaration is defective, or when no governing content declaration matches the actual media type, the interaction completes unsuccessfully with no failure-data value and raises no loud protocol error. A failure declaration is therefore not load-bearing for representation, which is the reason the success-scoped exclusion above gives. A governing Response Object that declares no response content at all is not such a case: it states positively that no content is returned, so an actual non-empty body under it contradicts a declaration and remains a loud protocol error whatever the final status.

**[convention]** The unary response value commits only after transfer completion and the full decode chain — content codings, then character decoding, then the selected lane — succeed; any failure after a 2xx final status and before that commit is a loud protocol error, and the interaction completes unsuccessfully with no partial unary value.

**[limit]** A non-empty response with no governing Response Object is a loud protocol error, even though omission of `responses` leaves the operation addressable. This specification defines no response-header or Link carriage in an operation value, so Response Header and Link Objects create no output members under this identifier; consequently, even a declared `Location` header on a `201` response reaches no operation value ([OAS 3.2.0 §§4.10.1, 4.17, 4.20–4.21](https://spec.openapis.org/oas/v3.2.0.html#response-object)).

## 10. Servers and target URL

**[incorporated]** Server declarations are scoped at Operation, Path Item, and root levels, with a more specific list overriding the outer scope; an absent or empty root list is equivalent to one Server Object whose URL is `/` ([OAS 3.2.0 §§4.1.1, 4.5, 4.9.1, 4.10.1](https://spec.openapis.org/oas/v3.2.0.html#server-object)).

**[convention]** An empty Operation or Path Item `servers` array supplies no local alternative and falls through to the next outer scope, matching the root empty-equals-absent precedent.

**[configuration point]** One effective server selects itself; multiple members require one consumer `server` choice before dispatch, the same value carries exact variable substitutions, and no member, optional `name`, or variable preference is inferred.

**[incorporated]** Server variables substitute their declared value, use `default` when no consumer value is supplied, MUST satisfy a nonempty declared `enum`, and each variable MUST occur no more than once in its Server URL template; an unresolved variable refuses before dispatch ([OAS 3.2.0 §§4.5.1, 4.6.1](https://spec.openapis.org/oas/v3.2.0.html#server-variable-object), with the once-per-template rule in [§4.6](https://spec.openapis.org/oas/v3.2.0.html#server-variable-object)'s introduction rather than its fixed-field table).

**[exclusion]** A Server URL template repeating a variable is a declaration defect that excludes only that Server alternative; no private repeated-substitution convention is applied and sibling alternatives survive. The exclusion reopens only if an incorporated OAS edition defines repeated-variable substitution.

**[incorporated]** Server URLs satisfy the 3.2 Server URL field rules, may be relative to the retrieval location of the document containing the Server Object, and MUST contain neither query nor fragment ([OAS 3.2.0 §§4.5.1, 4.5.2](https://spec.openapis.org/oas/v3.2.0.html#relative-references-in-api-urls)).

**[pin]** The root `$self` identifies the OpenAPI document and never replaces that retrieval-URI base for API URLs. No accepted edition states that as a requirement, and the modality here is this specification's own: what OAS 3.2.0 §4.5.2 states normatively is only that "Because the API is a distinct entity from the OpenAPI document, RFC3986's base URI rules for the OpenAPI document do not apply", while the sentence naming `$self` sits inside §4.5.2.1's worked examples and is descriptive — "For API URLs the `$self` field, which identifies the OpenAPI document, is ignored and the retrieval URI is used instead". This specification pins that descriptive reading so the API base is determinate for a document carrying both ([OAS 3.2.0 §§4.5.2, 4.5.2.1](https://spec.openapis.org/oas/v3.2.0.html#relative-references-in-api-urls)).

**[exclusion]** A Server URL containing a query or fragment excludes each target that would use that Server alternative; the exclusion reopens only if an incorporated OAS edition defines the exact cell.

**[incorporated]** After resolving and expanding the selected Server URL, the operation path is appended to it with no relative URL resolution, which the edition states in those words ([OAS 3.2.0 §4.8.1](https://spec.openapis.org/oas/v3.2.0.html#paths-path)).

**[pin]** "Appended" is pinned here to *verbatim*: no slash normalization and no path repair either. The edition forbids only relative resolution, so this is an entailment stated as this specification's own, and its consequence is stated with it — a Server URL ending in `/` and a Paths key beginning with `/`, the default server `/` included, produce a doubled slash in the completed target, and this rule forbids repairing it. Repair is excluded because a processor that silently rewrites the constructed path can address a resource the artifact did not declare, and no incorporated authority defines the rewrite.

**[limit]** When embedded content has no `location` to supply the API URL base, a relative Server URL leaves the target unresolved even if `$self` is absolute and refuses before dispatch; the complete configured URL below remains the available recovery.

**[incorporated]** After path and query serialization, the completed target MUST parse and percent-decode under RFC 3986; an unusable target refuses before dispatch ([OAS 3.2.0 §§4.8.2, 4.12.4](https://spec.openapis.org/oas/v3.2.0.html#url-percent-encoding), [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)).

**[convention]** That parse and percent-decode is a well-formedness check only: the dispatched bytes are the constructed percent-encoded bytes, and the completed target is never dispatched in decoded form.

**[exclusion]** A completed target whose scheme is not `http` or `https` refuses before dispatch, because no incorporated authority defines that scheme's HTTP-semantics mapping; the exclusion reopens only if an incorporated authority defines that mapping.

**[configuration point]** The `server` configuration point MAY instead supply one complete consumer-configured URL. That URL is itself a valid `server` value and by itself discharges any required member choice; it MUST satisfy the same scheme and no-query/no-fragment constraints as an artifact Server URL, it replaces the resolved server base, and the operation's path bytes append verbatim to it; the artifact's path template, path substitution, query construction, method, parameters, body, response, and security semantics remain unchanged.

## 11. Security and channel assembly

**[incorporated]** Operation `security` replaces root `security`; `[]` means no security requirement, array members are OR alternatives, every nonempty Security Requirement Object is an AND of its named schemes, and `{}` is a complete anonymous alternative ([OAS 3.2.0 §§4.10.1, 4.30](https://spec.openapis.org/oas/v3.2.0.html#security-requirement-object)).

**[configuration point]** The binding preserves every complete alternative and invents no anonymous-versus-credentialed preference. The named configuration point `security` selects one complete alternative: a sole declared alternative selects itself, and an effective empty `[]` or anonymous optional-security alternative counts as a complete no-security alternative; multiple alternatives require an explicit choice, fragments from different alternatives are never combined, and an invocation with no selection where one is required refuses before dispatch.

**[incorporated]** Requirement arrays for OAuth 2.0 and OpenID Connect contain scopes, arrays for other schemes may contain roles, and this binding surfaces those exact strings without interpreting roles in-band or executing acquisition flows ([OAS 3.2.0 §4.30.1](https://spec.openapis.org/oas/v3.2.0.html#security-requirements-name)).

**[incorporated]** Each Security Requirement name first matches an exact entry-document Security Scheme component name; if no component name matches, it MUST be a URI identifying a Security Scheme Object, and `./` disambiguates a single-segment relative URI from a colliding component name ([OAS 3.2.0 §4.30](https://spec.openapis.org/oas/v3.2.0.html#security-requirement-object)).

**[incorporated]** A Security Scheme Object's `type` is closed to `apiKey`, `http`, `mutualTLS`, `oauth2`, and `openIdConnect`; `apiKey` additionally requires `name` and an admissible `in`, `http` requires `scheme`, `oauth2` requires `flows`, and `openIdConnect` requires `openIdConnectUrl` ([OAS 3.2.0 §4.27.1](https://spec.openapis.org/oas/v3.2.0.html#security-scheme-object)).

**[exclusion]** A malformed Security Scheme Object—an unlisted `type`, inadmissible `apiKey.in`, or absent conditionally required field—makes every complete security alternative requiring it unusable; other OR alternatives remain selectable. The alternative-level exclusion reopens only if an incorporated OAS edition admits the exact scheme form or supplies its missing carriage.

**[configuration point]** For a component-name requirement occurring in a referenced non-entry document, `implicitConnectionScope` selects `entry` or `referring` resolution and defaults to `entry`, preserving OAS's implementation-defined multi-document choice while following its recommendation; URI-identified requirements bypass this point ([OAS 3.2.0 §§4.1.2.3, Appendix G.3](https://spec.openapis.org/oas/v3.2.0.html#resolving-implicit-connections)).

**[incorporated]** HTTP authentication-scheme tokens compare ASCII case-insensitively ([RFC 9110 §11.1](https://www.rfc-editor.org/rfc/rfc9110#section-11.1), [OAS 3.2.0 §4.27.1](https://spec.openapis.org/oas/v3.2.0.html#security-scheme-scheme)).

**[incorporated]** `apiKey` credentials use their declared name and location, and HTTP `basic` and `bearer` credentials use the `Authorization` field ([OAS 3.2.0 §4.27](https://spec.openapis.org/oas/v3.2.0.html#security-scheme-object), [RFC 9110 §11.6.2](https://www.rfc-editor.org/rfc/rfc9110#section-11.6.2)).

**[pin]** A selected `basic` scheme consumes a runtime-supplied user-id and password and constructs `Authorization: Basic base64(user-id ":" password)` under [RFC 7617 §2](https://www.rfc-editor.org/rfc/rfc7617#section-2), including its user-id, password, and Base64 constraints. Because RFC 7617 §2 deliberately leaves the default character encoding undefined, the user-id and password octets are pinned to printable US-ASCII (0x20–0x7E); a credential containing any other character leaves the selected alternative unusable, and the invocation refuses before dispatch. This pin reopens only if an incorporated authority defines a charset-parameter declaration surface for the scheme.

**[convention]** `mutualTLS` is a transport prerequisite rather than a header credential; a selected alternative requiring it is complete only when the runtime has established the declared client-certificate condition.

**[pin]** A selected `apiKey` scheme consumes a runtime-supplied key value and emits it at the declaration's exact query, header, or cookie destination.

**[pin]** OAuth 2.0 and OpenID Connect flows consume a runtime-supplied access token and use the `Bearer` authorization scheme under [RFC 6750 §2.1](https://www.rfc-editor.org/rfc/rfc6750#section-2.1); another token type has no wire carriage under this identifier.

**[limit]** Any other declared HTTP authentication scheme remains visible as a consumer prerequisite, but this binding synthesizes no credential bytes for it; an alternative requiring it is unusable unless the runtime satisfies it as a complete prerequisite.

**[convention]** A credential destination that collides with an effective parameter, another credential in the same AND requirement, or binding/processor-owned `Host`, `Content-Length`, or `Content-Type` makes only the selected security alternative unusable; `Accept` is not in that set, because §9.1 emits no `Accept` field for a credential to collide with and §8.1 already ignores an `Accept` Header parameter without excluding for it; another complete non-colliding alternative may still be selected, while §8.3 governs parameter-only processor-owned and invocation-time raw/structured cookie collisions.

**[convention]** API-key header destinations compare ASCII case-insensitively, while query and cookie destinations compare exact names. An API-key query value uses §8.3's content-form percent-encoding pin — RFC 3986 unreserved bytes literal, `~` among them, and every other UTF-8 byte as uppercase `%HH` — rather than §8.2's RFC 6570 or manual-construction paths, which govern declared parameters only; an API-key cookie value is carried as an RFC 6265 `cookie-value` with no percent-encoding and refuses before dispatch when it cannot be so carried. Credential values never enter the caller envelope or operation contract; structured cookie contributions preserve membership and join as `name=value` separated by `; `, with no portable cookie order ([RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1), [RFC 6265 §4.2.1](https://httpwg.org/specs/rfc6265.html#sane-cookie), [OAS 3.2.0 §4.12.3](https://spec.openapis.org/oas/v3.2.0.html#style-values)).

## 12. Configuration, synthesis, and conformance

### 12.1 Configuration vocabulary

**[configuration point]** The complete binding-specific configuration vocabulary is `requestMedia` (one concrete media type), `server` (one effective Server alternative plus exact variable values, or one complete consumer-configured URL replacing the resolved server base), `security` (selection of one complete security alternative), `parameterConversion` (deterministic boolean/number converter), `implicitConnectionScope` (`entry` or `referring`), `requestContentCodings` (coding-to-encoder map), `responseContentCodings` (coding-to-decoder map), and conditional `propertyMedia` (one concrete media type per affected content-based form-urlencoded or multipart property).

**[configuration point]** Every requirement is typed and discoverable from declarations. Preflightability is bounded: a requirement whose applicability is fixed by declarations alone is preflightable as an actual requirement, while `requestMedia` and `parameterConversion` are conditional on supplied values and are preflightable only as POSSIBLE requirements — a preflight can name them and their type but cannot know whether a given invocation will trigger them. No configuration member appears in the caller envelope or operation contract. Lane selection and outcome classification are fixed rules rather than configuration points: no configuration member chooses which declaration governs a response, which carriage lane decodes it, or whether the interaction completed successfully. Configuration supplies capability inside a fixed chain, never a choice about it — which is what `responseContentCodings` does, and why its presence in the vocabulary above is not an exception to this sentence.

**[limit]** Two capability-shaped variances remain inside that fixed chain and are declared here rather than left implicit: a runtime supplies content-coding codecs through §9.4's maps, and a runtime supplies character decodings beyond the UTF-8 §9.2 requires. In both, an absent capability is reported — refusing before dispatch on the request side and loudly on the response side — and never silently changes a value. No other implementation latitude exists inside the decode chain.

### 12.2 Synthesis boundary and coverage

**[incorporated]** Operation contracts remain protocol-neutral (Core [§5.1](../../openbindings.md#51-operations), [invariant 1](../../openbindings.md#2-core-invariants)) and MAY remain flat (Core [§5.5](../../openbindings.md#55-transforms)).

**[convention]** Synthesis emits an `inputTransform` that constructs §7's envelope, and transforms never route values to HTTP locations.

**[convention]** This binding defines no status, header, selected-media, or other context bindings at `inputTransform` or `outputTransform` positions; evaluation uses Core's closed environment unaugmented (Core [§5.5 clause 5](../../openbindings.md#55-transforms), [OBI-T-10](../../openbindings.md#103-tool-rules)).

**[limit]** Synthesis emits flat protocol-neutral operation contracts together with an `inputTransform` that constructs §7's envelope: the envelope is the binding-boundary value, never the emitted operation contract, and qualified location-keys appear only in the transform's output. §12.2 licenses `inputTransform` and `outputTransform` as synthesis outputs, and operation/dependency key spelling, flattening, output-schema choice, and Schema Object translation as synthesis policy; no other input-restructuring apparatus exists under this identifier.

**[convention]** Schema Object translation preserves the declared value domain up to representability: a synthesizer MUST account a lossy or non-equivalent Schema Object translation as coverage loss at its owning position, and output-schema choice carries no further soundness latitude.

**[convention]** A synthesizer MUST account for every fixed or additional addressable operation and every callback/webhook dependency as represented, excluded with the exact reason stated beside the applicable exclusion, or unsupported; a failure in an unused description position is coverage loss rather than invocation behavior.

**[convention]** Every binding-specific configuration requirement remains in coverage accounting and invocation context, assigned to its represented target or declared alternative, and MUST NOT enter the operation input schema.

**[incorporated]** Dependencies are synthesis outputs only and add no invocation target or receiver behavior (Core [§1.2](../../openbindings.md#12-out-of-scope), [§5.6](../../openbindings.md#56-dependencies)).

### 12.3 Conformance rules

**[convention]** A document conforms to **OAPI32-D-01** when its `content`, if present, satisfies §§3–5 and its `location`, if present, satisfies §4.

**[convention]** A binding conforms to **OAPI32-D-02** when it names §1's exact binding-specification identifier, carries one literal selector form from §6.1, and identifies a source that passes the exact edition gate. That verdict is decided over the interpreted artifact, never over the binding's text alone: for a location-only source it follows §4's required dereference, so conformance to this rule is not a property of the OBI document in isolation.

**[convention]** A processor conforms to **OAPI32-P-01** when it implements the closed load gates, smallest-owner confinement, the source-refusal rule and §5.2's dialect rules, reference closure, and selector semantics of §§3–6.

**[convention]** A processor conforms to **OAPI32-P-02** when it accepts only §7's envelope, applies §8's effective-parameter, collision, conversion, closed-style, undefined-value, content, querystring, header, cookie, and path rules, and refuses every unknown or unroutable input before dispatch.

**[convention]** A processor conforms to **OAPI32-P-03** when it preserves media alternatives and applies §9's matching, request election, carriage, form, multipart, Encoding, content-coding, sequential/SSE, response lookup, classification, and value-boundary rules without sniffing or undeclared fallback.

**[convention]** A processor conforms to **OAPI32-P-04** when it resolves servers and complete target URLs under §10 and security alternatives, credentials, prerequisites, and channel collisions under §11.

**[convention]** A synthesizer conforms to **OAPI32-S-01** when it preserves §12.2's binding/transform boundary, emits §6.2's targetless unconstrained dependencies, accounts every lossy or non-equivalent Schema Object translation as coverage loss, and reports complete coverage under Core OBI-B-02.

**[exclusion]** Every exclusion in this document is permanent under `openbindings.openapi-3.2@1`, belongs to the smallest owner stated beside it, and reopens only on its stated incorporated-authority trigger; no exclusion promises later work.

### 12.4 Permitted variation and stated limits

This index gathers the points at which this specification does not fix one behavior, together with the boundaries it draws around what it does fix. Every entry summarises a rule stated elsewhere in this document, shortened and stripped of its citations; the rule governs, and where this index and a rule differ the rule is the one to read. No entry carries a provenance label, because no entry states a rule, and nothing here is a claim about this document as a whole.

Two implementations that both conform to this specification may still differ at the following points. Each row names what is free and what a consumer may rely on across every implementation that is free there:

| what may differ | stated in | what holds across implementations |
| --- | --- | --- |
| whether a processor retrieves from a `location` co-present with `content` | §4 | `content` remains the interpreted artifact either way, the co-present `location` supplies the retrieval URI from its own value rather than from any retrieval, and no result this specification defines changes |
| query-contribution order across distinct effective parameters, on both the RFC 6570 path and the manual path | §8.2 | each effective parameter's own contribution and its exact bytes, one leading `?`, and `&` between contributions |
| cross-property pair order in form-urlencoded and name-based multipart bodies | §9.3 | every declared property's own name and value bytes, and, for an array property, its items in order under one repeated name |
| the multipart boundary token, and the optional quoting the incorporated grammar permits for it on the media-type field | §9.3 | the entity framing itself — opening, inter-part, and closing delimiters — and that the token appears inside no encapsulated part |
| cookie-pair order among structured cookie contributions | §11 | each contribution's exact name and value, joined `name=value` and separated by `; ` |
| whether a redirect is followed, and transport content negotiation including a runtime-advertised `Accept-Encoding` | §9.6 | classification is by the final status; a redirect followed with the bound method and complete body preserved remains this interaction, and a method-rewriting redirect ends it |
| which content codings a runtime can encode and decode | §§9.4, 12.1 | an absent codec is reported — refusing before dispatch on the request side, loudly on the response side — and never silently changes a value |
| which character decodings a runtime supports beyond UTF-8 | §§9.2, 12.1 | UTF-8 decoding is required of every implementation, and an absent decoding refuses loudly rather than being sniffed or substituted |
| the spelling of a callback or webhook dependency key, and the shape of its dependency contract | §§6.2, 12.2 | the key is a deterministic function of the declaration slot, and the contract's input is the request the service sends while its output is the response the service expects |
| operation and dependency key spelling, flattening, output-schema choice, and Schema Object translation | §12.2 | the caller-boundary envelope §7 fixes, and that a lossy or non-equivalent translation is accounted as coverage loss at its owning position |

Every configuration point this specification names, with the boundary a supplied choice must satisfy, who supplies it, and the consequence when a required choice is not supplied. §12.1 states this vocabulary and its closure, and no configuration member appears in the caller envelope or operation contract:

| point | boundary a choice must satisfy | who chooses | when no choice is supplied |
| --- | --- | --- | --- |
| `requestMedia` | one concrete media type matching a declared entry under §9.1; it never substitutes another declaration's schema, and supplied values never elect | the consumer, before input consumption | required unless exactly one usable concrete entry selects itself; a missing, unmatched, or ambiguous choice refuses before dispatch |
| `server` | one effective Server alternative plus exact variable values, or one complete consumer-configured URL under the same scheme and no-query/no-fragment constraints | the consumer, before dispatch | required when more than one effective member exists; no member, optional `name`, or variable preference is inferred, and an unresolved variable refuses before dispatch |
| `security` | one complete alternative, never fragments combined from different alternatives | the consumer | required when more than one alternative exists; an invocation with no selection where one is required refuses before dispatch |
| `parameterConversion` | a deterministic conversion from each supplied JSON boolean or number to a string, applied recursively to array members and object values; strings pass identically and null never enters it | the consumer | no partial canonicalization default is defined; any supplied boolean or number without a configured conversion refuses before dispatch |
| `implicitConnectionScope` | `entry` or `referring`, for a component-name requirement occurring in a referenced non-entry document; URI-identified requirements bypass it | the consumer | defaults to `entry`; this is the one point whose unsupplied case is a default rather than a refusal |
| `requestContentCodings` | a finite map from case-insensitive content-coding tokens to deterministic encoders; two keys colliding after ASCII case-folding are not a usable configuration | the consumer | the caller-supplied effective `Content-Encoding` value fixes the stack; an unsupported token refuses before dispatch, and no configuration narrows the declared surface |
| `responseContentCodings` | the same map shape, to deterministic decoders | the consumer | the actual value governed by the Response Header Object fixes the stack; an unsupported token is a loud protocol error |
| `propertyMedia` | one concrete media type per affected property, satisfying one declared member under §9.1 | the consumer | required only for a wildcard or comma-separated multi-valued Encoding `contentType` on a content-based property; an absent, unmatched, or ambiguous choice refuses before dispatch |

One seam in that enumeration is recorded here rather than closed. §12.1 states the vocabulary above as complete and admits no further implementation latitude inside the decode chain; a consumer-supplied bound on the size of a single delivered sequential item would be such latitude, and this specification names no point for one. This index supplies none either.

Boundaries this specification states around what it covers:

| stated in | not covered |
| --- | --- |
| §3.2 | no source-scope filtering surface: no source member or addressable target is filtered merely by its position in the source |
| §3.2 | unknown non-extension fields, and `x-` specification extensions, create no binding behavior and none is supplied for them |
| §6.2 | dependencies add no invocation behavior; receiver deployment and dependency composition are permanently outside this operation boundary |
| §7 | on a content-forbidding method a `required: true` request body creates no caller-body requirement, and the declaration is reported as coverage loss |
| §8.1 | an ignored Header parameter creates no effective parameter, caller-envelope key, or emitted field |
| §9.1 | Examples create no operation input or output member and select no declaration, lane, or media type |
| §9.1 | the live OpenAPI Media Type Registry does not widen this identifier; only media behavior defined by incorporated pinned authority is available |
| §9.2 | JSON-lane numeric precision or range beyond RFC 8259 §6's binary64 expectation is not preserved, and that reduction is the only permitted deviation from the supplied value |
| §9.2 | only UTF-8 decoding is required; every further charset is an implementation capability |
| §9.3 | an elided null on an optional content-based form property identifies `{}` and `{"x": null}` on the wire |
| §9.3 | non-ignored Encoding `headers` produce no caller channel: only an artifact-fixed value and the `contentEncoding`-declared equivalent `Content-Transfer-Encoding` are emitted |
| §9.5 | `retry` crosses the operation-value boundary because the incorporated authority places it in the event data model; no other transport directive does |
| §9.5 | non-sequential media remain unary: one HTTP response body produces at most one operation value |
| §9.6 | redirect following and transport content negotiation are runtime policy, and the resulting classification variance is the permitted set named in the first table above |
| §9.6 | no response-header or Link carriage exists in an operation value, so even a declared `Location` header on a `201` reaches none |
| §11 | no credential bytes are synthesized for any HTTP authentication scheme beyond those §11 constructs; such an alternative is a consumer prerequisite the runtime must satisfy whole |
| §12.1 | `requestMedia` and `parameterConversion` are preflightable only as possible requirements, because their applicability turns on supplied values |
| §12.2 | no context bindings are defined at `inputTransform` or `outputTransform` positions; evaluation uses Core's closed environment unaugmented |
| §12.2 | no input-restructuring apparatus exists beyond the licensed transforms and the synthesis policy named there |

Everything removed from the accepted domain, with the owner each removal confines to and the incorporated-authority condition that would reopen it. §12.3 states that every one of these is permanent under this identifier and promises no later work:

| stated in | what is outside the accepted domain | confined to | reopens when |
| --- | --- | --- | --- |
| §5.1 | a selected reference reaching a document with neither admitted root, using a retrieval alias despite a declared `$self`, or crossing a nearer `$id` boundary noncanonically | the unit named beside each condition in §5.1's table | incorporated authority admits the exact root or reference form |
| §5.1 | a Path Item `$ref` collision on a fixed field the selected target uses | the selected target | an incorporated OAS edition defines the collision |
| §5.2 | a root `jsonSchemaDialect` naming any other URI | the source | that exact dialect becomes incorporated authority |
| §5.2 | a schema-resource-root `$schema` naming any other URI | each selected unit whose closure enters that resource | that exact dialect becomes incorporated authority |
| §6.1 | an `additionalOperations` key ASCII-case-insensitively equal to a fixed Operation field name | that additional-operation entry | incorporated authority admits the collision and defines its operation mapping |
| §6.1 | a present empty Responses Object | the selected target | an incorporated OAS edition admits it |
| §7 | duplicate effective parameters at one name-plus-location identity | the smallest owning operation | an incorporated OAS edition admits them |
| §7 | two effective header parameters whose names differ only by ASCII case | the selected target | an incorporated authority defines a case-preserving wire mapping |
| §8.1 | an effective Parameter Object violating §8.1's closed declaration list | the selected target | an incorporated OAS edition removes the constraint or defines the malformed form's wire meaning |
| §8.2 | a style, location, shape, or explicit `explode` outside §8.2's table, its two shape-less rows included | the selected target, or the selected media alternative on §9.3's Encoding path | incorporated authority defines the exact missing cell |
| §8.2 | a compound-capable style whose resolved declaration proves an unsupported compound member | the selected target, or the selected media alternative | incorporated authority defines that cell |
| §8.2 | path-key ambiguity, or either direction of a path-expression/parameter mismatch | the selected target | incorporated authority admits the declaration or defines its unique target mapping |
| §8.3 | more than one effective `querystring` parameter, or one coexisting with an ordinary query parameter | the selected target | an incorporated OAS edition admits it and defines the query construction |
| §8.3 | a `querystring` media entry whose format has no serialization incorporated here | that parameter lane | a pinned authority incorporated here defines the mapping |
| §8.3 | a `querystring` media entry selecting a sequential form | that parameter lane | incorporated authority defines sequential query-component serialization and interaction semantics |
| §8.3 | an effective header parameter named `Host` or `Content-Length` | the selected target | an incorporated HTTP authority defines caller control preserving the processor's framing and routing obligations |
| §8.3 | a form-style cookie declaration whose `explode` and resolved declaration prove multi-value production | the selected target | an incorporated OAS edition defines a correct multi-value mapping |
| §9.1 | a Request Body Object declaring `required: true` with an empty `content` map | the selected target | an incorporated OAS edition defines that behavior |
| §9.2 | XML generated from an object model | the selected media alternative | incorporated authority defines node order, null serialization, and adjacent text nodes |
| §9.2 | a concrete request or response selection admitted by none of §9.2's lanes | the smallest media owner | an incorporated authority defines that media/data-form cell |
| §9.3 | a property name not safely representable as the multipart `name` parameter, any name containing CR or LF included | that multipart media alternative | an incorporated authority defines an unambiguous encoding |
| §9.3 | a response selection of name-based form or multipart carriage | the smallest media owner | an incorporated authority defines that decoding |
| §9.3 | an Encoding-style serialization generating one wire name from two declared sources | that media alternative | an incorporated authority defines the collision's unique decoding |
| §9.3 | an explicit Encoding header whose part's resolved declaration disallows its value | that multipart field | incorporated authority defines both serialization and parsing for the contradiction |
| §9.3 | a selected media alternative requiring more than one nested Encoding level | that alternative | an incorporated authority requires the deeper level |
| §9.4 | two governing response Header Object keys differing only by ASCII case that both govern binding behavior | the smallest owning response alternative | an incorporated authority defines a case-preserving wire mapping |
| §9.5 | a purported sequential media type whose item framing no pinned incorporated authority defines | that selected alternative | incorporated authority defines the missing framing |
| §9.5 | a `text/event-stream` request-body alternative | that alternative | incorporated authority defines the missing object-to-event write mapping |
| §9.6 | a Responses key outside the closed admitted set | the selected target | an incorporated OAS 3.2 edition admits that exact key form |
| §9.6 | an upstream-invalid governing Response Object that could govern a successful response | the selected target | an incorporated OAS 3.2 edition admits the exact declaration |
| §10 | a Server URL template repeating a variable | that Server alternative | an incorporated OAS edition defines repeated-variable substitution |
| §10 | a Server URL containing a query or fragment | each target that would use that Server alternative | an incorporated OAS edition defines the exact cell |
| §10 | a completed target whose scheme is neither `http` nor `https` | that invocation, which refuses before dispatch | an incorporated authority defines that scheme's HTTP-semantics mapping |
| §11 | a malformed Security Scheme Object | every complete alternative requiring it | an incorporated OAS edition admits the exact scheme form or supplies its missing carriage |

## 13. Normative references

- [OpenAPI Specification 3.2.0](https://spec.openapis.org/oas/v3.2.0.html)
- [OpenAPI 3.1 base dialect, revision 2024-11-10](https://spec.openapis.org/oas/3.1/dialect/2024-11-10)
- [YAML 1.2.2](https://yaml.org/spec/1.2.2/)
- [HTTP QUERY method, draft-11](https://www.ietf.org/archive/id/draft-ietf-httpbis-safe-method-w-body-11.html)
- [WHATWG URL Standard Review Draft, 18 August 2026](https://url.spec.whatwg.org/review-drafts/2026-08/)
- [WHATWG HTML server-sent events processing model, whatwg/html source snapshot at commit 24c5e48bf66ea61bc199ec6338c81258275ba9c6](https://github.com/whatwg/html/blob/24c5e48bf66ea61bc199ec6338c81258275ba9c6/source)
- [RFC 2046](https://www.rfc-editor.org/rfc/rfc2046)
- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119)
- [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)
- [RFC 4648](https://www.rfc-editor.org/rfc/rfc4648)
- [RFC 6265](https://httpwg.org/specs/rfc6265.html)
- [RFC 6570](https://www.rfc-editor.org/rfc/rfc6570)
- [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750)
- [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838)
- [RFC 6839](https://www.rfc-editor.org/rfc/rfc6839)
- [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)
- [RFC 7303](https://www.rfc-editor.org/rfc/rfc7303)
- [RFC 7464](https://www.rfc-editor.org/rfc/rfc7464)
- [RFC 7578](https://www.rfc-editor.org/rfc/rfc7578)
- [RFC 7617](https://www.rfc-editor.org/rfc/rfc7617)
- [RFC 8091](https://www.rfc-editor.org/rfc/rfc8091)
- [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)
- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)
- [RFC 9512](https://www.rfc-editor.org/rfc/rfc9512)
