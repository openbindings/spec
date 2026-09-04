# `openbindings.openapi-3.0` Binding Specification

**Status: unreleased `@1` candidate.** This mutable page does not mint `openbindings.openapi-3.0@1`. Its remaining publication gate is the explicit promotion and reference-tooling adoption change required by the [binding-specification lifecycle](../README.md#promotion); until then, implementations may cite it only as a candidate, not as a published OpenBindings identifier.

## 1. Identifier and rule labels

**[convention]** The opaque binding-specification identifier has exactly the spelling **`openbindings.openapi-3.0@1`**.

**[convention]** OpenBindings Project publication mints §1's proposed identifier; before that project lifecycle event, this page is a mutable candidate and the identifier is not project-published.

**[incorporated]** Once minted, the identifier is exact and stable under Core [OBI-B-01](../../openbindings.md#104-binding-specification-rules), and an incompatible change to the accepted domain or portable meaning requires a different identifier under Core [OBI-B-03](../../openbindings.md#104-binding-specification-rules).

**[incorporated]** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) only when they appear in all capitals.

**[convention]** Every normative paragraph and normative table row carries one visible provenance label. An `incorporated` rule is one the cited source states, and the citation names that source, whether an incorporated authority or the OpenBindings Core; the remaining five are this specification's own explicitly classified bridge. A `convention` is a choice this specification makes where no authority speaks; a `pin` fixes one reading of an ambiguous or versioned authority; a `configuration point` names a decision deferred to the consumer; an `exclusion` removes something from the accepted surface behind a stated reopen trigger; a `limit` states a boundary this specification does not cross.

## 2. Scope and incorporated authorities

**[convention]** This binding specification defines how OpenAPI 3.0 artifacts govern OpenBindings sources: which documents are accepted and when loading refuses, how operation targets are addressed and synthesized, what an invocation's inputs and outputs mean, and which wire mechanics the artifact fixes. It builds on the OpenBindings Core specification (`../../openbindings.md`).

**[incorporated]** An artifact's required `openapi` string gives the exact OAS edition that the OpenAPI Document uses ([OAS 3.0.4 §§3.2, 4.7.1.1](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields)).

**[convention]** This specification accepts exactly OAS editions [`3.0.0`](https://spec.openapis.org/oas/v3.0.0.html), [`3.0.1`](https://spec.openapis.org/oas/v3.0.1.html), [`3.0.2`](https://spec.openapis.org/oas/v3.0.2.html), [`3.0.3`](https://spec.openapis.org/oas/v3.0.3.html), and [`3.0.4`](https://spec.openapis.org/oas/v3.0.4.html); no wildcard or compatible-looking value widens this closed set.

**[convention]** Within that closed set, observable behavior MUST NOT turn on the patch component: the admitted editions are read as one `3.0` feature set, and the accepted domain remains the five exact values above.

**[pin]** For every rule in this specification the governing OAS text is the highest-numbered accepted edition's, whatever accepted patch value the artifact declares; the declared value is an admission gate only, never an edition selector. This pin is unconditional: it governs where the accepted editions contradict one another, where a later edition corrects an earlier one, and equally where a later edition states what an earlier one leaves unsaid. Each of 3.0.0–3.0.3 §4.1 instructs that the patch version SHOULD NOT be considered by tooling, "making no distinction between 3.0.0 and 3.0.1"; the anomalous copied examples in 3.0.4 §4.1, which name the 3.1 line, neither widen nor rename this one ([OAS 3.0.0 §4.1](https://spec.openapis.org/oas/v3.0.0.html#versions), [3.0.1 §4.1](https://spec.openapis.org/oas/v3.0.1.html#versions), [3.0.2 §4.1](https://spec.openapis.org/oas/v3.0.2.html#versions), [3.0.3 §4.1](https://spec.openapis.org/oas/v3.0.3.html#versions), [3.0.4 §4.1](https://spec.openapis.org/oas/v3.0.4.html#versions)).

**[convention]** OAS governs the artifact and every HTTP mechanic it declares, including object structure, reference resolution, parameter serialization, media declarations, server selection, responses, and security ([OAS 3.0.4 §4.7](https://spec.openapis.org/oas/v3.0.4.html#schema-0)); [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) governs the remaining HTTP semantics.

**[incorporated]** This document defines portable binding meaning, not an invocation API: request objects, retry and redirect APIs, cancellation, credential acquisition, receiver deployment, and dependency composition remain runtime or application concerns under Core [§1.2](../../openbindings.md#12-out-of-scope).

The table below indexes this specification against the seven things Core [OBI-B-02](../../openbindings.md#104-binding-specification-rules) requires a binding specification to define. It carries no provenance label because it states no rule: every entry points at labelled rules stated elsewhere in this document, and where an entry and a rule differ the rule governs. OBI-B-02 is a floor and not a partition, so a section this table does not name is not thereby surplus; the last row records what this document fixes above that floor. The third column names what this specification does not cover at that item: a point at which it states no portable meaning. It does not claim that no rule in this document reaches the surrounding subject. Such a point is a different thing from the exclusions and limits §12.4 enumerates, because those are declared and this is not.

| OBI-B-02 item | Where this specification discharges it | what this specification does not cover there |
| --- | --- | --- |
| 1 — whether a source mode accepts an artifact, the representations accepted, deterministic discrimination, and the encoding of a non-JSON artifact | §2 (the closed accepted-edition set), §3.1, §3.2, §4, §5.1 (the retrieval decode) | nothing recorded: §4's limit states the acquisition-failure disposition and defers the success condition to the address scheme.  |
| 2 — the syntax and meaning of `location` | §3.1, §4, §10 (`location` plays one further role, supplying the base for a relative Server URL, and §10 states the missing-`location` consequence at that point of use) | nothing recorded: §4's limit states the acquisition-failure disposition and defers the success condition to the address scheme.  |
| 3 — the accepted values and meaning of `content`, including any source mode in which `content` is forbidden | §3.1, §3.2, §4 (the acceptance rule and, beside it, the empty forbidden set) | None. |
| 4 — how `location` and `content` compose, including whether `location` supplies a reference base for embedded content | §3.1, §4, §10 | None. |
| 5 — the syntax and meaning of `selector`, including the absent-`selector` case | §3.2, §5.1, §6.1, §12.3 (**OAPI30-D-02**, the only rule stating a consequence for an absent, malformed, or non-resolving `selector`, and decided over the interpreted artifact) | None. |
| 6 — how the binding target and its interaction are identified | §3.2, §5.1, §6.1, §6.2, §7, §8.2, §8.3, §9.5, §10, §11 (which requirement governs and which alternative is selected), §12.1, §12.3 | nothing recorded: §11's counterparty-determination rule states the scope-satisfaction disposition. |
| 7 — how caller-facing input and successful output values correspond to the source interaction, which outcomes are successes, how values emitted before an unsuccessful completion are treated, and any context bindings at transform positions | §3.2, §5.1, §5.2, §6.1, §7, §8.1, §8.2, §8.3, §9.1, §9.2, §9.3, §9.4, §9.5, §10, §12.1, §12.2 (the context-bindings rule) | None. |
| above the floor | §11's credential-construction rules: the `Basic` construction, `apiKey` emission, `Bearer` carriage, destination collisions, and the cookie join | These fix real wire bytes while serving none of the seven items, because a credential is neither a caller-facing input value nor a successful output value. They are content this specification carries above OBI-B-02's floor, not an omission from it. |

**[convention]** Where §2's item map records that a chain is not completed in this revision, that record licenses nothing. It is not a permitted variation, and this specification states no portable meaning there. An implementation may complete such a point locally; that completion is implementation-defined under Core [§6](../../openbindings.md#6-binding-specifications) and is not attributed to this identifier.

## 3. Source carriage and refusal architecture

### 3.1 Accepted representations

**[convention]** `content` is either the parsed OpenAPI document object or string content; `location` is an absolute URI for the OpenAPI document; content has primacy, a co-present location supplies its base URI, and the OBI retrieval URI is never that base (Core [§5.4](../../openbindings.md#54-sources), [§7](../../openbindings.md#7-reference-resolution)).

**[pin]** String content MUST parse as YAML 1.2.2, of which JSON is a subset; duplicate mapping keys, non-scalar-string mapping keys, explicit tags outside YAML's JSON-compatible tag set, resolved values with no JSON image (`.inf`, `-.inf`, `.nan`), and a multi-document YAML stream refuse at this grammar gate. Exactly one YAML document is accepted ([YAML 1.2.2 §§3.2.1, 10.2.1, 10.3.2](https://yaml.org/spec/1.2.2/)).

**[pin]** Plain-scalar tag resolution uses YAML 1.2.2's recommended Core schema and no other, a disclosed widening of the line's format rule, which limits tags to YAML's JSON schema ruleset: the two schemas share a tag set but not a resolution, so `True`, `0x3A`, and `.5` resolve to a boolean, an integer, and a float here where JSON-schema resolution would terminate in an error. Core resolution is pinned because JSON-schema resolution rejects plain scalars every widely deployed YAML reader accepts; the widening admits values, never rejects them, and every admitted value must still have a JSON image under the preceding rule ([YAML 1.2.2 §§10.2.2, 10.3.2](https://yaml.org/spec/1.2.2/#1032-tag-resolution), widening [OAS 3.0.4 §4.2](https://spec.openapis.org/oas/v3.0.4.html#format)).

**[pin]** A leading byte-order mark on string content is accepted and consumed by the YAML grammar; it is never part of the document.

**[incorporated]** The admitted tag set is YAML's JSON schema ruleset — called the "JSON Schema ruleset" in editions 3.0.0–3.0.3 and clarified, unrelated to JSON Schema, in 3.0.4, whose reading governs — and "Keys used in YAML maps MUST be limited to a scalar string, **as defined by the YAML Failsafe schema ruleset**" ([OAS 3.0.0 §4.2](https://spec.openapis.org/oas/v3.0.0.html#format), [3.0.1 §4.2](https://spec.openapis.org/oas/v3.0.1.html#format), [3.0.2 §4.2](https://spec.openapis.org/oas/v3.0.2.html#format), [3.0.3 §4.2](https://spec.openapis.org/oas/v3.0.3.html#format), [3.0.4 §4.2](https://spec.openapis.org/oas/v3.0.4.html#format)).

**[pin]** Key resolution follows that qualifier and differs from value resolution: the Failsafe ruleset's only scalar tag is `tag:yaml.org,2002:str`, so a plain scalar key never refuses on its resolved type and an unquoted `200:` Responses key is the string `200`. A key that is not a scalar at all — a sequence or a mapping in key position — refuses at the key gate. The key/value asymmetry is the edition's; the consequence of violating the key rule is pinned here ([YAML 1.2.2 §10.1.1](https://yaml.org/spec/1.2.2/#1011-tags), [OAS 3.0.4 §4.2](https://spec.openapis.org/oas/v3.0.4.html#format)).

**[incorporated]** The root MUST be a JSON object with the required `openapi` string that identifies the OAS edition it uses ([OAS 3.0.4 §§4.2, 4.7.1.1](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields)).

**[convention]** The `openapi` value MUST be exactly `3.0.0`, `3.0.1`, `3.0.2`, `3.0.3`, or `3.0.4`; an absent, mismatched, or unlisted value refuses at this binding's edition load gate.

### 3.2 Closed load gates and confined defects

**[convention]** Source loading, target addressability, synthesis accounting, and invocation outcome are independent axes. A result on one axis changes another only where a rule in this document states that propagation explicitly.

**[convention]** A source **refuses at load** only at §3.2's closed gates. After those gates, a source **refuses as a source** only when its required inventory surface is defective or when inventory or reference defects prevent every declared target position from becoming addressable. A source-level **exclusion** instead declines an upstream-valid feature under a stated coverage limit; it is not a defect-derived source refusal.

**[convention]** An **addressable target** is a structurally declared operation slot that survives inventory and reference processing. A declaration defect at that target or below does not erase its addressability. A `selector` naming an addressable target therefore resolves even when that target is later accounted invalid or excluded; a selector reaching no addressable target does not resolve and invocation **refuses at resolution** ([RFC 6901 §7](https://www.rfc-editor.org/rfc/rfc6901#section-7)).

**[convention]** Synthesis accounts a target or subordinate projection as **represented** when its portable meaning is preserved; **invalid** when its owning declaration is upstream-invalid; **excluded** when this specification removes an upstream-valid unit under a stated exclusion; **lossy** when translation loses declared meaning; or **implementation-unsupported** when the specification defines the behavior but the synthesizer lacks the capability. A represented target MAY have a separately invalid, excluded, or lossy subordinate projection. Every invalid, excluded, lossy, or unsupported unit is **coverage loss** at that unit.

**[convention]** An addressable target that requires a missing choice or unsupported alternative is **unusable** and **refuses before dispatch** when invoked. A **context-required** refusal names a configuration point or credential that can make the same invocation proceed; a plain **refusal** names a condition no supplied context can change. Neither reaches the wire or has an observable side effect. Presentation of either refusal is context negotiation outside this specification (Core [§6](../../openbindings.md#6-binding-specifications)).

**[convention]** A wire fact this specification cannot represent faithfully is a **loud protocol error**; *refuses loudly*, *fails loudly*, and *reported loudly* are synonyms. An interaction that reaches the wire and whose outcome §9.5 does not admit as successful **completes unsuccessfully**; so does one that reaches an admitted final status and then fails loudly. Values already emitted before an unsuccessful streaming completion remain successful values where a streaming rule says so.

**[convention]** A **lane** is one media-selected value-to-bytes serialization path, and the lanes are exactly five: JSON, character-data, raw-octet, form, and multipart; a selection admitted by none of them is excluded under §9.2's lane-admission rule, never carried by an unnamed path. The **smallest media owner** is the narrowest declared unit that owns a defective lane. An **unavailable** alternative is an excluded alternative: the word marks this vocabulary's exclusion outcome applied to a media alternative.

**[convention]** A **unit** is one member of this closed lattice, from largest to smallest: the source, an addressable operation, a declared alternative, a media alternative, a lane, and a field. A defect's **smallest owning unit** is the smallest member of that lattice whose declarations the defect reaches; a **selected unit** is a unit reached by the selected target.

**[limit]** The load gates are the following closed ordered set: accepted-representation grammar, scalar/tag/key resolution, JSON-object root shape, and exact edition discrimination; no condition outside this set is a load gate.

**[limit]** **§3.2's smallest-owner rule**: after those gates pass, a defect confines to its smallest owning unit, and an unreachable defect destroys no target.

**[limit]** An **excluded** unit, and equally a unit removed as **invalid**, is removed from the effective declarations consumed below its owning boundary: no serialization, routing, or translation rule reads it as usable input. Removal does not erase a structurally addressable target slot. A selector naming an invalid or excluded target still resolves and invocation refuses before dispatch. A target whose remaining effective declarations no longer satisfy §8's path-template correspondence is itself excluded.

**[incorporated]** A conforming artifact that declares no operation target is accepted and synthesizes no operation: the required Paths Object may contain no path entries, and a Path Item Object may be empty ([OAS 3.0.4 §§4.7.1.1, 4.7.8, 4.7.9](https://spec.openapis.org/oas/v3.0.4.html#paths-object)).

**[limit]** **§3.2's source-refusal rule**: after the closed load gates, a source refuses as a source when the required root inventory surface is missing or malformed, or when the artifact declares at least one target slot but inventory or reference defects prevent every slot from becoming addressable. A target-confined invalidity or exclusion never contributes to this aggregation: even when every addressable target is invalid or excluded, the source remains accepted and each selector still resolves to its own pre-dispatch refusal. A valid present-but-empty surface is accepted and synthesizes zero operations. Each accepted 3.0 edition makes root `paths` REQUIRED, so its absence refuses as a source ([OAS 3.0.4 §4.7.1.1](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields)).

**[limit]** A target that is addressable but unusable because of a missing choice, unsupported alternative, or exclusion refuses before dispatch or is reported as synthesis coverage loss; it never becomes a source refusal.

**[limit]** This revision declares no source-scope exclusion: unlike the [`include`/`mount` filtering surface of `openbindings.usage@1`](../usage/openbindings.usage.md#3-accepted-source-representations), no source member or addressable target is filtered merely by its position in the source.

**[limit]** An unknown non-extension field creates no binding behavior, and this specification supplies none for it: the consequence confines to the smallest owning unit that depends on it, while an unused unknown field affects no target. An `x-` specification extension remains an inert annotation under this identifier, and no unknown member is guessed into a fixed or patterned field ([OAS 3.0.4 §4.8](https://spec.openapis.org/oas/v3.0.4.html#specification-extensions)).

**[convention]** A root `swagger` member co-present with this specification's conforming `openapi` value is such an unknown non-extension root member: it is inert, gates nothing, and cedes the document to no sibling specification.

## 4. `location`, `content`, and composition

**[incorporated]** A present `location` MUST be an absolute URI addressing the OpenAPI document itself; a bare filesystem path is not conformant (Core [OBI-D-05](../../openbindings.md#102-document-rules)).

**[convention]** For a location-only source the dereference is required and MUST yield an accepted representation; a representation outside §3.1's two refuses at load, at the accepted-representation gate. Where `content` is co-present a processor MAY retrieve from `location` and MAY decline to; `content` remains the interpreted artifact and is never silently replaced, and a failed, unreachable, or non-conforming retrieval has no effect on the interpreted artifact and no outcome of its own. Retrieval is therefore never observable on a content-carrying source, and the two processors differ in no result this specification defines (Core [§5.4](../../openbindings.md#54-sources)).

**[limit]** Whether that dereference yields a representation at all is the address scheme's own affair: this specification incorporates no retrieval protocol and states no condition of its own for acquisition success, so an HTTP status, a `file://` open error, a name-resolution failure, or a transport failure is decided by the scheme that owns the absolute URI. Octets that arrive are gated as the preceding rule states; a dereference that yields nothing reaches no load gate, leaves §3.2's closed set unchanged, and the invocation refuses before dispatch for want of a source, with the no-observable-side-effect guarantee. How the acquisition failure is reported alongside that refusal is diagnostic and not portable meaning of this identifier.

**[convention]** A present `content` MUST be one of §3.1's two representations, and no other JSON type is accepted.

**[convention]** No source mode this specification governs forbids `content`: Core [§5.4](../../openbindings.md#54-sources) admits `location` alone, `content` alone, and both co-present, the location-only mode is one in which `content` is absent rather than prohibited, and the set of `content`-forbidding modes Core [OBI-B-02](../../openbindings.md#104-binding-specification-rules) item 3 asks for is empty by decision.

**[incorporated]** A relative `$ref` resolves under JSON Reference against the URL of the document containing it; other relative URL fields use their own OAS-defined base rules ([OAS 3.0.4 §4.6](https://spec.openapis.org/oas/v3.0.4.html#relative-references-in-urls)).

**[convention]** Embedded content without a co-present `location` MUST be self-contained; a location-only source uses its location as the entry-document base (Core [§7](../../openbindings.md#7-reference-resolution)).

## 5. References, schema dialect, and confinement

### 5.1 Reference semantics

**[incorporated]** A Reference Object is JSON Reference transclusion: the resolved target replaces the referencing object ([OAS 3.0.4 §§4.6, 4.7.23](https://spec.openapis.org/oas/v3.0.4.html#reference-object), [JSON Reference draft-03 §4](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03#section-4)).

**[convention]** A reference composes its target plus the transitive closure of references reachable from that target, not unrelated material in the same retrieved document. No accepted edition states that composition rule; this specification adopts it so that a selected target's closure is decidable ([OAS 3.0.4 §§4.6, 4.7.23](https://spec.openapis.org/oas/v3.0.4.html#reference-object)).

**[incorporated]** Only the entry document is required to be an OpenAPI Document; a retrieved document containing a referenced value need not itself be a conforming OpenAPI Document ([OAS 3.0.4 §§3.1–3.2, 4.3](https://spec.openapis.org/oas/v3.0.4.html#openapi-description-structure)).

**[pin]** Every document this binding retrieves — the primary `location` dereference of §4 and every secondarily retrieved reference document alike — decodes its bytes as UTF-8 and passes the same grammar gate as §3.1 string content; the retrieval's `Content-Type` and any charset parameter are never consulted, and a byte sequence that is not valid UTF-8 does not yield an accepted representation: for the entry artifact that is a refusal at load at the accepted-representation gate, and for a secondarily retrieved document it is the unresolvable reference §5.1 states. The scope is every retrieval because no accepted 3.0 edition, and Core no more, assigns the OpenAPI document a character encoding (Core [§5.4](../../openbindings.md#54-sources)).

**[exclusion]** That rule narrows [YAML 1.2.2 §5.2](https://yaml.org/spec/1.2.2/#52-character-encodings), which obliges a YAML processor to accept UTF-8, UTF-16, and UTF-32 input with a byte-order mark deciding among them: this specification supports UTF-8 alone and lets no byte-order mark select an encoding, because a binding that never sniffs body bytes cannot take an encoding decision from them, and [RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1) already requires UTF-8 of JSON text exchanged outside a closed ecosystem. A document encoded in UTF-16 or UTF-32 leaves the accepted domain — the whole source where the entry artifact is so encoded, the referring selection alone where a secondarily retrieved document is. This reopens only if an incorporated authority defines a declaration surface stating a retrieved document's character encoding without inspecting its bytes.

**[convention]** When one JSON or YAML node is reached from reference positions requiring different OAS Object types, each reference context interprets the node independently as its own required Object type; this is the deterministic choice within OAS's implementation-defined multi-context license ([OAS 3.0.4 §4.3.1](https://spec.openapis.org/oas/v3.0.4.html#structural-interoperability)).

**[incorporated]** A Reference Object has only its required `$ref` field; every adjacent property is ignored, including when a Reference Object appears where a Schema Object is allowed ([OAS 3.0.4 §§4.7.23, 4.7.24.1](https://spec.openapis.org/oas/v3.0.4.html#reference-object)).

**[pin]** OAS's lowercase statement that tooling must detect and handle cycles to prevent resource exhaustion, non-normative under §1's BCP 14 clause, is pinned to a requirement: reference traversal MUST detect cycles without resource exhaustion, a cyclic but resolvable graph is legitimate, and cycle detection terminates traversal rather than truncating the graph and is not itself a refusal ([OAS 3.0.4 §5.5](https://spec.openapis.org/oas/v3.0.4.html#handling-reference-cycles)).

**[pin]** A Path Item `$ref` is not a Reference Object for sibling purposes: OAS gives the Path Item its own `$ref` fixed field and calls a field appearing in both the referenced and the adjacent object undefined, which presupposes that both declarations exist, and this specification pins the merge that presupposition implies. The **effective Path Item** is the referenced Path Item overlaid with every adjacent field the referenced Path Item does not itself declare: non-colliding adjacent fields contribute, the `$ref` member itself contributes nothing, and the rule that a Reference Object's adjacent properties are ignored is scoped to Reference Objects proper and never reaches this merge. ([OAS 3.0.4 §§4.7.9.1, 4.7.23](https://spec.openapis.org/oas/v3.0.4.html#path-item-ref)).

**[exclusion]** When a selected Path Item carries `$ref`, the selected operation target is excluded only if a fixed field used by that target appears in both the referenced Path Item and its adjacent declaration, because OAS defines that named collision as undefined. `Used by that target` means the selected method field plus the Path Item's `parameters` and `servers`; the documentation fields `summary` and `description` never collide for this purpose. Collisions confined to unused fields and all non-colliding adjacent fields leave the target usable, and the exclusion reopens only if an incorporated OAS edition defines the collision ([OAS 3.0.4 §4.7.9.1](https://spec.openapis.org/oas/v3.0.4.html#path-item-ref)).

**[convention]** The first three reference conditions in the table below are this specification's own confinement conditions; the sections cited beside them define the reference positions and the base resolution those conditions read, not the conditions themselves ([OAS 3.0.4 §§4.3, 4.6, 4.7.9](https://spec.openapis.org/oas/v3.0.4.html#openapi-description-structure)):

| condition |
| --- |
| **[convention]** Unresolvable selected Path Item `$ref` |
| **[convention]** Unresolvable reference reached by one selected parameter, request body, response, server, or security requirement |
| **[convention]** Unresolvable Schema Object reference reached only by one media alternative |
| **[limit]** An unresolvable reference reachable only from an unused description position leaves invocation unaffected; synthesis reports that position as coverage loss. |
| **[limit]** A defect outside the target-plus-reachable closure has no effect on that target. |

**[limit]** In table order, the three confinement conditions confine as follows: the referenced Path Item and its operations are unaddressable; the selected operation or its affected declared alternative is unusable while unrelated operations survive; or the affected media alternative is unavailable while sibling alternatives survive.

### 5.2 Schema dialect

**[incorporated]** A Schema Object uses OAS 3.0's extended subset of JSON Schema Wright Draft 00: the keywords enumerated in OAS plus OAS's fixed fields are the complete supported vocabulary; unlisted JSON Schema keywords are strictly unsupported and create no binding behavior ([OAS 3.0.4 §§4.4, 4.7.24](https://spec.openapis.org/oas/v3.0.4.html#schema-object)).

**[incorporated]** `type` MUST be one string rather than an array; an empty Schema Object `{}` asserts no instance type; and a Reference Object may be used in place of a Schema Object under §5.1's transclusion semantics. A boolean is upstream-invalid in every Schema Object position but one: `additionalProperties`, whose value the edition expressly admits as "boolean or object", and which §9.3 reads accordingly ([OAS 3.0.4 §§4.4, 4.7.24.1](https://spec.openapis.org/oas/v3.0.4.html#json-schema-keywords)).

**[incorporated]** `nullable: true` admits JSON null only when `type` is explicitly present in the same Schema Object, leaves the named non-null type in force, and does not disable any other constraint ([OAS 3.0.4 §4.7.24.2](https://spec.openapis.org/oas/v3.0.4.html#schema-nullable)).

**[incorporated]** Unsupported keywords, including `$id`, `$schema`, `patternProperties`, `contentEncoding`, and `contentMediaType`, decide as if absent; specification extensions remain non-behavioral metadata unless another incorporated rule explicitly assigns them meaning ([OAS 3.0.4 §§4.7.24.1, 4.8](https://spec.openapis.org/oas/v3.0.4.html#json-schema-keywords)).

**[convention]** For every lane, style, shape, and member-inspection rule in this document, a **resolved declaration** is obtained by following `$ref` and conjoining every `allOf` branch: the branches' type sets intersect, since an instance must satisfy every branch (the edition takes `allOf` from the JSON Schema definition, [OAS 3.0.4 §4.7.24](https://spec.openapis.org/oas/v3.0.4.html#json-schema-keywords)), a typeless branch contributes no constraint, and an empty intersection is a declaration admitting no instance, against which every supplied value fails every admission test below. That refusal lives where an admission test consults the declaration — a character-data or raw-octet selection, a multipart part, a content-form property — and the value refuses before dispatch; the JSON lane and the parameter positions select carriage by media type and by location alone, consult no resolved type set, and carry the supplied value unvalidated under §9.2's no-validation rule. For an `anyOf` or `oneOf` choice, a branch whose resolved declaration declares only `null` is skipped, every other branch — a typeless branch included — is a candidate, and the choice supplies a single resolved member declaration only when exactly one candidate remains; `not` and conditional applicators never participate in resolution. Absence of `type` leaves the declaration typeless; a `type` contributes its single string, and `nullable: true` co-located with an explicit `type` adds `null` to the resolved type set. **Declares only X** means that the resolved type set is nonempty and every member is in X; **Admits `string` as its sole non-null type** means that the resolved type set is exactly `{string}` or `{string, null}`.

## 6. Selector and inbound dependencies

### 6.1 Selector

**[convention]** `selector` is REQUIRED and has exactly one literal spelling: `#/paths/<escaped-path>/<lowercase-method>`, where `<escaped-path>` is the Paths Object key escaped once under [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) and `<lowercase-method>` is one of `get`, `put`, `post`, `delete`, `options`, `head`, `patch`, or `trace`.

**[pin]** The selector's leading `#` is a literal sentinel: what follows is RFC 6901 §3's string representation of the JSON Pointer, carried literally, escaped once with `~0`/`~1`, and never percent-decoded; the §6 URI-fragment representation is not used. Evaluation follows RFC 6901 §§3–4; when the selected operation is absent the selector does not resolve and the invocation **refuses at resolution** ([RFC 6901 §§3–4, 6](https://www.rfc-editor.org/rfc/rfc6901#section-3), [OAS 3.0.4 §§3.5, 4.7.9](https://spec.openapis.org/oas/v3.0.4.html#path-item-object)).

**[convention]** After the pointer selects a Path Item, selector evaluation resolves that Path Item's `$ref` into §5.1's effective Path Item before reading the method field; the deliberate extra resolution keeps bundled referenced Path Items addressable ([JSON Reference draft-03 §4](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03#section-4), [OAS 3.0.4 §4.7.9.1](https://spec.openapis.org/oas/v3.0.4.html#path-item-ref)).

**[incorporated]** An Operation Object requires `responses`, and its Responses Object requires at least one response declaration. The `default` fixed field is a fallback Response Object for codes not covered individually and satisfies that declaration requirement when present alone ([OAS 3.0.4 §§4.7.10.1, 4.7.16](https://spec.openapis.org/oas/v3.0.4.html#operation-responses)).

**[limit]** Omitting `responses`, or providing a Responses Object with neither a patterned response-code field nor `default` — an empty or extension-only object included — is upstream-invalid and makes only the selected operation unusable and `invalid` under §3.2's smallest-owner rule. Its selector still resolves, synthesis reports the retained target slot without an operation contract, and invocation refuses before dispatch. The confinement reopens only if an incorporated OAS 3.0 edition admits the exact declaration.

### 6.2 Callbacks

**[incorporated]** A callback Path Item describes a request initiated by the API provider and the responses it expects; its runtime-expression key is evaluated against runtime request or response values to identify the callback URL, and the callback is not an operation invocable through the addressed parent operation. The destination is not characterized as service-chosen: the edition's worked example derives it from a consumer-supplied query parameter ([OAS 3.0.4 §§4.7.10.1, 4.7.18, 4.7.20.4](https://spec.openapis.org/oas/v3.0.4.html#callback-object)).

**[convention]** Synthesis MUST represent every supported callback operation as a Core dependency with a deterministic slot-derived key and a role-inverted consumed-operation contract: input is the request the service sends and output is the response the service expects (Core [§5.6](../../openbindings.md#56-dependencies)).

**[convention]** `Deterministic slot-derived key` requires only that the key be a deterministic function of the declaration slot; its exact spelling is synthesis policy under §12.2 and is not portable binding meaning. The dependency contract's shape is likewise synthesis policy; only the role-inverted input/output meaning above is fixed here.

**[incorporated]** Such a dependency carries no concrete target (Core [§5.6](../../openbindings.md#56-dependencies)).

**[convention]** Such a dependency also carries no `bindingSpecs`, because the originating artifact has no authority to constrain the consumer's description format.

**[limit]** Dependencies add no invocation behavior to this binding; receiver deployment and dependency composition are permanently outside this operation boundary under this identifier (Core [§1.2](../../openbindings.md#12-out-of-scope)).

**[incorporated]** The 3.0 OpenAPI Object defines no `webhooks` field, so this sibling synthesizes only callback dependencies and no root-webhook dependency surface ([OAS 3.0.4 §4.7.1.1](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields)).

## 7. Target interaction and caller envelope

**[convention]** Here and below, an **effective** declaration is the declaration that remains after applying the artifact's scope, default, override, and method-disposition rules stated in §§7–10. The method-disposition rule below is one of them: on a method whose `requestBody` that rule ignores, no effective request body exists, so no such declaration can make an invocation refuse for a missing required body.

**[incorporated]** An addressed operation denotes its declared HTTP method, completed target URL, parameters, effective request body, security requirements, and final HTTP response. The method is the Path Item field name that selects the Operation Object, and the target URL is composed from the effective Server Object's URL with the Paths Object key ([OAS 3.0.4 §4.7.10](https://spec.openapis.org/oas/v3.0.4.html#operation-object), [§4.7.9](https://spec.openapis.org/oas/v3.0.4.html#path-item-object), [§§4.7.5, 4.7.8](https://spec.openapis.org/oas/v3.0.4.html#server-object)).

**[convention]** The caller-facing correspondence value is exactly `{parameters?: {...}, body?: <one JSON value>}`; absence means not supplied, and the artifact alone determines parameter location and serialization. The absent-versus-supplied rule reaches both members and every parameter key alike: an absent key is not supplied, and a key present with `null` — `body: null`, or a `parameters` member whose value is JSON null — is a supplied JSON null. A supplied null therefore satisfies a required parameter or a required request body and is never missing under the requirement rule below.

**[convention]** When every effective parameter name is unique across locations, its caller key is the exact declared name; if any name is repeated across legal locations, the target uses qualified mode for every parameter and each key is `<location>/<RFC6901-escaped-name>`, making the flat map injective without depending on map order.

**[incorporated]** Effective parameter identity is exact name plus location; duplicate effective parameters at the same identity are upstream-invalid, while the same name in different locations denotes distinct parameters ([OAS 3.0.4 §§4.7.9.1, 4.7.10.1, 4.7.12](https://spec.openapis.org/oas/v3.0.4.html#operation-parameters)).

**[limit]** Duplicate effective parameters at the same identity are upstream-invalid and remove their smallest owning operation, accounted `invalid`; this confinement reopens only if an incorporated OAS edition admits such duplicates.

**[convention]** Legal cross-location duplicates remain independently supplied through the qualified mode above.

**[exclusion]** Two effective header parameters whose names differ only by ASCII case exclude the selected target because OAS parameter identity is case-sensitive while HTTP field names are case-insensitive; the wire cannot preserve the distinction. This exclusion reopens only if an incorporated authority defines a wire mapping that preserves such case-distinct declarations ([OAS 3.0.4 §§3.8, 4.7.12](https://spec.openapis.org/oas/v3.0.4.html#case-sensitivity), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[convention]** An envelope top-level key other than `parameters` or `body`, a present non-object `parameters` member, or any unknown parameter key refuses before dispatch, regardless of whether a body exists; no unmatched-field passthrough exists.

**[incorporated]** Missing required parameters and a missing `required: true` effective request body refuse before dispatch; path parameters are always required ([OAS 3.0.4 §§4.7.12.2.1, 4.7.13.1](https://spec.openapis.org/oas/v3.0.4.html#common-fixed-fields)).

**[incorporated]** OAS requires a `requestBody` to be ignored for every method where HTTP does not explicitly define request-body semantics, with GET, HEAD, and DELETE only examples of that class. Within this binding's closed selector set, `requestBody` is ignored on `get`, `head`, `delete`, and `options`, honored on `post`, `put`, and `patch`, and emits no body on `trace` because a TRACE client MUST NOT send a message body; `patch` body semantics are defined by RFC 5789 ([OAS 3.0.4 §4.7.10.1](https://spec.openapis.org/oas/v3.0.4.html#operation-request-body), [RFC 7231 §§4.3.1–4.3.8](https://www.rfc-editor.org/rfc/rfc7231#section-4.3.1), [RFC 5789 §2](https://www.rfc-editor.org/rfc/rfc5789#section-2)).

**[convention]** A supplied `body` on `get`, `head`, `delete`, `options`, or `trace` refuses as unroutable before dispatch.

**[limit]** On such a content-forbidding method the artifact's `required: true` request body creates no caller-body requirement, so a body-free invocation dispatches and the preceding `incorporated` rule's missing-required-body refusal does not reach it. The target is therefore invocable, not permanently unusable; the declaration is reported as coverage loss at the Request Body position ([RFC 7231 §4.3.8](https://www.rfc-editor.org/rfc/rfc7231#section-4.3.8)).

## 8. Parameter serialization

### 8.1 Effective declarations and scalar conversion

**[incorporated]** Operation parameters override Path Item parameters only at the same exact name-plus-location identity, and every remaining effective `path`, `query`, `header`, or `cookie` Parameter Object governs its own contribution ([OAS 3.0.4 §§4.7.9.1, 4.7.10.1, 4.7.12.1](https://spec.openapis.org/oas/v3.0.4.html#parameter-locations)).

**[incorporated]** A Header parameter whose name ASCII-case-insensitively denotes `Accept`, `Content-Type`, or `Authorization` MUST be ignored and creates no effective parameter, caller-envelope key, or emitted field ([OAS 3.0.4 §§3.8, 4.7.12.2.1](https://spec.openapis.org/oas/v3.0.4.html#common-fixed-fields), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[incorporated]** A Schema Object `default` documents what the receiver assumes when a value is not provided and is never inserted by this binding: an unsupplied optional parameter carrying a `default` is omitted before serialization, exactly as one carrying none. Every accepted 3.0 edition states the receiver-side reading, and 3.0.4 adds that the keyword "documents the receiver's behavior rather than inserting the value into the data" ([OAS 3.0.0 §4.7.24.1](https://spec.openapis.org/oas/v3.0.0.html#schema-object), [3.0.1 §4.7.24.1](https://spec.openapis.org/oas/v3.0.1.html#schema-object), [3.0.2 §4.7.24.1](https://spec.openapis.org/oas/v3.0.2.html#schema-object), [3.0.3 §4.7.24.1](https://spec.openapis.org/oas/v3.0.3.html#schema-object), [3.0.4 §§4.7.6, 4.7.24.1](https://spec.openapis.org/oas/v3.0.4.html#schema-object)).

**[configuration point]** Whenever a `schema`-form parameter or §9.3 form/part property must convert a JSON scalar to a string, `parameterConversion` is the same deterministic consumer-supplied conversion: strings pass identically, and any supplied boolean or number without a configured conversion refuses before dispatch. JSON null does not enter this conversion point; §8.2 governs RFC 6570-style paths and §9.3 governs content-based form and multipart paths ([OAS 3.0.4 Appendix B](https://spec.openapis.org/oas/v3.0.4.html#appendix-b-data-type-conversion), [RFC 6570 §2.3](https://www.rfc-editor.org/rfc/rfc6570#section-2.3)).

**[configuration point]** This specification defines no partial canonicalization default for `parameterConversion`; the converter applies recursively to array members and object values before style serialization and MUST be deterministic for every accepted scalar.

### 8.2 `style`, `explode`, and URL assembly

**[incorporated]** The supported `schema`-form cells and their RFC 6570 operators are exactly the following; a style/location/shape outside the table refuses before dispatch ([OAS 3.0.4 §§4.7.12.2.2, 4.7.12.3, Appendix C](https://spec.openapis.org/oas/v3.0.4.html#style-values), [RFC 6570 §3.2](https://www.rfc-editor.org/rfc/rfc6570#section-3.2)):

| style | location | admitted shapes | operator / source |
| --- | --- | --- | --- |
| **[incorporated]** `matrix` | path | primitive, array, object | `;` |
| **[incorporated]** `label` | path | primitive, array, object | `.` |
| **[incorporated]** `simple` | path, header | primitive, array, object | none |
| **[incorporated]** `form` | query, cookie | primitive, array, object | `?`; `allowReserved: true` corresponds separately to `+` and does not combine with it — the authority lists that pair among the configurations with no RFC 6570 equivalent, "because only one prefix operator can be used at a time", and the manual-construction rule below governs it ([OAS 3.0.4 §C.3](https://spec.openapis.org/oas/v3.0.4.html#non-rfc6570-field-values-and-combinations)) |
| **[convention]** `spaceDelimited` | query | array, object | OAS Style Examples bytes |
| **[convention]** `pipeDelimited` | query | array, object | OAS Style Examples bytes |
| **[convention]** `deepObject` | query | object with scalar properties | OAS Style Examples bytes |

**[incorporated]** Default style is `form` for query and cookie and `simple` for path and header; default `explode` is `true` only for `form` and `false` otherwise; `allowReserved` applies only to query parameters ([OAS 3.0.4 §4.7.12.2.2](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields-for-use-with-schema)).

**[incorporated]** On a `schema`-form parameter or an Encoding RFC 6570-style path the undefined values are RFC 6570 §2.3's, which the edition points at for exactly this purpose as the values "including but not limited to null" that are considered undefined. An undefined value uses the effective style and `explode` cell, whose `undefined` entry is the same on both explode rows of a style: `;name` for `matrix`, `.` for `label`, an empty representation for `simple`, and `name=` for `form`; the empty string is expressly not undefined, and the remaining cells are `n/a` ([OAS 3.0.4 §§4.7.12.4, 4.7.15.1.2, Appendix B](https://spec.openapis.org/oas/v3.0.4.html#style-examples), [RFC 6570 §2.3](https://www.rfc-editor.org/rfc/rfc6570#section-2.3)).

**[pin]** Mapped onto this binding's supplied JSON values, that set is exactly three and no more: JSON null, an array with zero members, and an object with zero members. A supplied value is never absent — §7's envelope makes absence mean not supplied, which omits the parameter before serialization — and the member rule below refuses a null member outright, so RFC 6570's no-value and all-members-undefined cases have no JSON image here ([RFC 6570 §2.3](https://www.rfc-editor.org/rfc/rfc6570#section-2.3)).

**[pin]** **§8.2's presentational-prefix rule**: the `?` that the Style Examples print before every `form`, `spaceDelimited`, `pipeDelimited`, and `deepObject` cell is presentation, not a per-parameter contribution — each example "is shown prefixed with `?` **as if it were the only query parameter**" — so a parameter's contribution under these styles is the cell's bytes with that prefix removed, and the single leading `?` is supplied once by the query assembly below. The edition states the removal for `application/x-www-form-urlencoded` bodies; this specification pins the same reading for the query and cookie destinations ([OAS 3.0.4 §4.7.12.4](https://spec.openapis.org/oas/v3.0.4.html#style-examples), [§4.7.15.1.2](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields-for-rfc6570-style-serialization), [Appendix D](https://spec.openapis.org/oas/v3.0.4.html#appendix-d-serializing-headers-and-cookies)).

**[pin]** For a cookie destination the contribution is therefore `name=value`, never `?name=value`: Appendix D declares that exact cell implementation-defined between the two results, and this specification pins the prefix-free one, which §11's `; `-separated cookie assembly can carry ([OAS 3.0.4 Appendix D](https://spec.openapis.org/oas/v3.0.4.html#appendix-d-serializing-headers-and-cookies)).

**[convention]** A supplied undefined value whose governing effective `style`/`explode` row has `n/a` in the corrected `undefined` cell refuses the invocation before dispatch at the affected parameter or Encoding property; other values admitted by the same declaration remain usable.

**[convention]** A null member of a supplied array or object value on an RFC 6570-style path refuses the invocation before dispatch at the affected parameter or Encoding property; RFC 6570's list model has no member-level undefined value, and this binding invents no serialization.

**[incorporated]** RFC 6570 serialization MUST use its declared operator and `*` for `explode: true`, and a non-exploded label list or map uses a comma. Multiple regular form-style query parameters share one `?` variable list; separately expanding multiple `?` templates is not conformant ([OAS 3.0.4 §§C.1–C.2](https://spec.openapis.org/oas/v3.0.4.html#equivalences-between-fields-and-rfc6570-operators), [OAS 3.0.4 §4.7.12.4](https://spec.openapis.org/oas/v3.0.4.html#style-examples), [RFC 6570 §3.2.5](https://www.rfc-editor.org/rfc/rfc6570#section-3.2.5)).

**[pin]** Appendix C.3 says implementations MAY create a properly delimited URI Template for configurations with no direct RFC 6570 equivalent; this specification pins that latitude to a requirement, because RFC 6570 prefix operators cannot combine: a query mixing regular form expansion with `allowReserved: true` MUST be constructed manually per parameter, reserved-permitting values using reserved expansion and `[`, `]`, `#`, `&`, `=`, and `+` pre-percent-encoded where Appendix C.4.2 requires ([OAS 3.0.4 §§C.3–C.4.2](https://spec.openapis.org/oas/v3.0.4.html#non-rfc6570-field-values-and-combinations)).

**[convention]** The manual path assembles all present per-parameter contributions into one query component with one leading `?` and `&` between contributions; this assembled result is the single-query rule's equivalent at the authority's construction seam.

**[convention]** Query-contribution order across distinct effective parameters is not portable meaning.

**[incorporated]** A parameter name that is not a legal RFC 6570 variable name MUST be percent-encoded before use in the template construction ([OAS 3.0.4 §§C.3, C.4.4](https://spec.openapis.org/oas/v3.0.4.html#illegal-variable-names-as-parameter-names)).

**[convention]** That variable-name encoding is internal to URL assembly and never changes the exact caller-envelope key defined by §7.

**[convention]** For `spaceDelimited`, `pipeDelimited`, and `deepObject`, the exact bytes are the corresponding OAS Style Examples read under §8.2's presentational-prefix rule: delimiters and deep-object brackets are percent-encoded, object names and values retain their shown alternation, and no unstated escape convention is added ([OAS 3.0.4 §4.7.12.4](https://spec.openapis.org/oas/v3.0.4.html#style-examples)).

**[pin]** Before dispatch, the binding refuses a supplied parameter or property name or scalar value containing its non-RFC style's structural delimiter — U+0020 SPACE for `spaceDelimited`, `|` for `pipeDelimited`, or any of `[`, `]`, `=`, and `&` for `deepObject` — and offers no escape-convention configuration point. This narrows Appendix E.5, which requires those delimiters percent-encoded and RECOMMENDS either an additional escape convention left to the API designer or avoiding these styles entirely: that convention is an artifact-external agreement this binding cannot read, so no configuration point could make the round trip decidable, and this specification takes the second recommendation and refuses the ambiguous value. `=` and `&` are added beyond the four the appendix names because an exploded `deepObject` also uses them to delimit its own `name[key]=value` pairs ([OAS 3.0.4 Appendix E.5](https://spec.openapis.org/oas/v3.0.4.html#percent-encoding-and-illegal-or-reserved-delimiters), [RFC 3986 §2.2](https://www.rfc-editor.org/rfc/rfc3986#section-2.2)).

**[exclusion]** An effective `style`/`explode` combination, a defaulted `explode` included, whose entire Style Examples row is `n/a` excludes that parameter; so omitted `explode` on `deepObject` computes to the excluded `false` row, which the edition itself calls undefined. The test is the whole row and never a single cell: a row carrying `n/a` in some columns and real bytes in others — `spaceDelimited` with `explode: false`, for instance — is a supported combination, and only the values falling in its `n/a` columns are refused, by the undefined-value rule above. The exclusion reopens only if an incorporated authority defines that exact combination ([OAS 3.0.4 §§4.7.12.2.2–4.7.12.4, 4.7.15.1.2, C.1](https://spec.openapis.org/oas/v3.0.4.html#style-values), [RFC 6570 §3.2.1](https://www.rfc-editor.org/rfc/rfc6570#section-3.2.1)).

**[exclusion]** Otherwise a compound-capable style is excluded only when its resolved declaration proves an unsupported compound member — an array whose resolved `items` declaration declares only `object` or `array`, or an object with at least one declared property whose resolved declaration declares only `object` or `array` — for which OAS/RFC 6570 defines no expansion; the owning unit is excluded unless an incorporated authority defines that exact cell ([OAS 3.0.4 §§4.7.12.2.2–4.7.12.4, 4.7.15.1.2, C.1](https://spec.openapis.org/oas/v3.0.4.html#style-values), [RFC 6570 §3.2.1](https://www.rfc-editor.org/rfc/rfc6570#section-3.2.1)).

**[convention]** A typeless resolved member proves no compound shape, a choice that supplies no single resolved member declaration under §5.2 proves no compound shape, and an object declaring no properties proves no compound member, so none triggers this exclusion; in particular, a declaration that still admits a scalar is never excluded, and candidate admission never inspects the supplied runtime value.

**[convention]** The rule applies symmetrically to every compound-capable parameter style and to §9.3's URL-encoded Encoding style path, including its defaulted `explode`, where the smallest owner is the selected media alternative rather than the target.

**[incorporated]** The Paths Object MUST NOT contain two templated path keys with equivalent hierarchies but different template names ([OAS 3.0.4 §§4.7.8.1–4.7.8.2](https://spec.openapis.org/oas/v3.0.4.html#path-templating-matching)).

**[limit]** Equivalent-hierarchy path-key ambiguity is upstream-invalid and removes each selected operation on a participating Path Item before any caller value is inspected, accounted `invalid`, mirroring the duplicate-parameter precedent; non-conflicting targets survive. The confinement reopens only if an incorporated authority admits the declaration or defines its unique target mapping.

**[incorporated]** Every path-template expression MUST have a corresponding effective path parameter ([OAS 3.0.4 §3.5](https://spec.openapis.org/oas/v3.0.4.html#path-templating)).

**[convention]** When one path-template expression occurs more than once, its single effective `path` parameter supplies the value substituted at every occurrence. The accepted 3.0 editions require correspondence but do not forbid repetition, and repeating the same substitution introduces no ambiguity.

**[limit]** A path-template expression with no corresponding effective `path` parameter is upstream-invalid and removes the selected target before caller values are inspected, accounted `invalid`; the reverse mismatch is already one of §8.3's malformed Parameter Object cases.

**[convention]** An expanded path value containing unescaped `/`, `?`, or `#` refuses before dispatch. No accepted 3.0 edition states this restriction — it first appears on the 3.1 line and is carried forward on 3.2, both outside §2's accepted set — so this specification adopts it as its own safety rule, so that one supplied value cannot silently restructure the completed target's path, query, or fragment; §2's corrected-patch pin does not reach it because every accepted edition is silent rather than in conflict ([OAS 3.0.4 §§3.5, 4.7.12.2.1](https://spec.openapis.org/oas/v3.0.4.html#path-templating), against [OAS 3.1.2 §3.5](https://spec.openapis.org/oas/v3.1.2.html#path-templating) and [OAS 3.2.0 §4.8.2](https://spec.openapis.org/oas/v3.2.0.html#path-templating)).

### 8.3 Content-form, empty, header, and cookie parameters

**[incorporated]** Every Parameter Object requires `name` and an `in` value from `path`, `query`, `header`, or `cookie`; it MUST contain exactly one of `schema` or `content`, a `content` map MUST contain exactly one media-type entry, and a path parameter requires `required: true` with a name corresponding to a path-template expression ([OAS 3.0.4 §§4.7.12.1–4.7.12.2.3](https://spec.openapis.org/oas/v3.0.4.html#parameter-object)).

**[limit]** A selected effective Parameter Object violating any constraint in that closed declaration list is upstream-invalid and removes the selected target before caller values are inspected, accounted `invalid`. The confinement reopens only if an incorporated OAS 3.0 edition admits the exact malformed declaration or defines its wire meaning.

**[convention]** A `content`-form parameter application value serializes under its sole media type and then follows its destination: path and query representations are percent-encoded as one URI parameter value, while header serialization adds no URI percent-encoding and cookie serialization follows the cookie rules below; the line defines the media representation but not the destination step, and this is the minimal URI-validity assignment.

**[pin]** Percent-encoding a content-form parameter leaves RFC 3986 unreserved bytes literal and encodes every other UTF-8 byte as uppercase `%HH`; the exact caller-envelope key remains unchanged.

**[incorporated]** For a query parameter with `allowEmptyValue: true`, a supplied empty string emits a present zero-length value; absence still means omitted, and this binding infers no schema-validity consequence because OAS leaves that interaction implementation-defined ([OAS 3.0.4 §4.7.12.2.1](https://spec.openapis.org/oas/v3.0.4.html#parameter-allow-empty-value)).

**[incorporated]** A supplied empty string is an ordinary value and serializes as the governing effective `style`/`explode` row's `empty` cell — `name=` for `form` (the table prints it with the presentational `?` §8.2 removes), an empty representation for `simple`, `;name` for `matrix`, `.` for `label`, and `n/a` for the remaining styles — whatever `allowEmptyValue` declares: the edition states that the `empty` column is unrelated to that field and that the empty string is not undefined ([OAS 3.0.4 §4.7.12.4](https://spec.openapis.org/oas/v3.0.4.html#style-examples)).

**[pin]** Header `schema` serialization performs no URI percent-encoding and adds no automatic quotes, and cookie contributions are not URI-decoded after serialization. This is a disclosed displacement of the accepted editions' own text: OAS 3.0.4's Appendix D applies RFC 6570 percent-encoding to `in: "header"` parameters, and OAS 3.1.2 corrects it, recording that further research showed percent-encoding was never intended to apply to headers and that the section now applies only to cookies. This specification pins the corrected reading for the 3.0 line, because a percent-encoded header value is one an HTTP peer cannot read back and no accepted edition defines a decoding that recovers it. §2's corrected-patch pin does not reach 3.1.2, which lies outside the accepted set, but a self-identified erratum states what the earlier text always meant and reaches every accepted edition it names, 3.0.4 among them ([OAS 3.0.4 §§4.7.12.2.2, Appendix D, C.2](https://spec.openapis.org/oas/v3.0.4.html#appendix-d-serializing-headers-and-cookies), displaced by [OAS 3.1.2 Appendix D.1](https://spec.openapis.org/oas/v3.1.2.html#percent-encoding-and-cookies) and [OAS 3.2.0 Appendix D](https://spec.openapis.org/oas/v3.2.0.html#appendix-d-serializing-headers-and-cookies)).

**[pin]** The complete serialized header field value's characters are carried as UTF-8 octets, closing the character-to-octet seam before the field-invalid-byte check below ([RFC 9110 §5.5](https://www.rfc-editor.org/rfc/rfc9110#section-5.5)).

**[convention]** A complete serialized header field value that is not an RFC 9110 `field-value` after UTF-8 encoding refuses before dispatch at the affected parameter. This includes CR, LF, NUL, any other field-invalid octet, and leading or trailing SP or HTAB, which are field-line whitespace rather than part of the field value. When the effective header name is `Cookie`, that complete serialized field value MUST additionally be an RFC 6265 `cookie-string`; the binding neither repairs nor partially parses it ([RFC 9110 §§5.1, 5.5](https://www.rfc-editor.org/rfc/rfc9110#section-5.1), [RFC 6265 §4.2.1](https://httpwg.org/specs/rfc6265.html#sane-cookie)).

**[exclusion]** A raw Cookie source is an effective `Cookie` Header parameter or a header credential whose destination compares ASCII case-insensitively to `Cookie`; a structured source is an effective cookie parameter or cookie credential. Two required parameters of opposite kinds exclude the target. Within one security alternative, opposite-kind credentials in the same AND requirement, or a credential opposite to a required parameter, exclude that alternative; other OR alternatives survive, and the target is excluded only when none remains. This declaration-time propagation prevents synthesis of a statically guaranteed-refusal operation and reopens only if incorporated authority defines a coherent merge.

**[convention]** Every other raw/structured combination is invocation-conditional and declarations alone exclude nothing. An invocation that would emit at least one supplied or selected source of each kind refuses before dispatch; the binding does not parse or merge the raw string.

**[exclusion]** Every effective header parameter name MUST be an HTTP field-name `token`. A non-token name excludes that parameter projection as the smallest unsupported wire owner. If the parameter is optional, the operation remains represented and an invocation omitting it may dispatch, but the excluded parameter creates no caller-envelope key or emitted field; supplying the would-be key is therefore unknown input and refuses before dispatch. If it is required, the selected target is excluded because no conforming invocation can satisfy it. This exclusion reopens only if incorporated HTTP authority admits that exact field-name form ([RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[exclusion]** Every effective cookie parameter name MUST be the RFC 6265 cookie-name `token`. A non-token name follows the same smallest-owner and caller-envelope rule as a non-token header name: an optional parameter is excluded only at that projection and its would-be key is unknown input, while a required parameter excludes the selected target. After serialization, every supplied structured-cookie value MUST satisfy `cookie-value`; an invocation whose exact value cannot be carried refuses before dispatch rather than escaping or repairing it. This exclusion reopens only if incorporated cookie authority admits the exact name or value form ([RFC 6265 §§4.1.1, 4.2.1](https://httpwg.org/specs/rfc6265.html#sane-cookie)).

**[exclusion]** An effective header parameter whose name compares ASCII case-insensitively to `Host`, `Content-Length`, `Connection`, `Keep-Alive`, `Proxy-Authorization`, `Proxy-Connection`, `TE`, `Trailer`, `Transfer-Encoding`, or `Upgrade` excludes the target because those fields are processor-owned and cannot be replaced by caller input. The connection-specific and framing fields could otherwise change message framing, advertise a protocol switch this unary binding cannot continue, or describe hop-by-hop state the binding does not model; `Proxy-Authorization` is consumed by the first inbound proxy and therefore cannot safely carry an origin API value. The exclusion reopens only if an incorporated HTTP authority defines caller control that preserves those obligations ([RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1), [§7.6.1](https://www.rfc-editor.org/rfc/rfc9110#section-7.6.1), [§11.7.2](https://www.rfc-editor.org/rfc/rfc9110#section-11.7.2)).

**[exclusion]** A form-style cookie declaration that produces multiple values excludes the target because OAS identifies RFC 6570's `&`-separated expansion as incorrect for Cookie's `; ` delimiter; the exclusion reopens only if an incorporated OAS edition defines a correct multi-value mapping ([OAS 3.0.4 Appendix D](https://spec.openapis.org/oas/v3.0.4.html#appendix-d-serializing-headers-and-cookies)).

## 9. Request and response media

### 9.1 Media identity, alternatives, and request election

**[incorporated]** Media types parse under RFC 9110: type and subtype compare case-insensitively, parameter names compare case-insensitively, and parameter values retain their media-defined comparison rules ([RFC 9110 §§5.6.6, 8.3.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.6.6)).

**[convention]** A **concrete media type** has no wildcard in either its type or subtype; media-type parameters do not affect concreteness.

**[convention]** A declaration matches a concrete media type only when every declared parameter is present with an equal value; matches order by exact type/subtype before `type/*` before `*/*`, then by greatest declared-parameter count, and equal-specificity ties select no declaration.

**[pin]** A declared media-type parameter value is first unquoted under [RFC 9110 §5.6.6](https://www.rfc-editor.org/rfc/rfc9110#section-5.6.6); the value of `charset` then compares ASCII case-insensitively, and every other parameter value, `boundary` included, compares by exact character sequence. RFC 9110 §5.6.6 leaves parameter-value case sensitivity to each parameter's own definition; [RFC 2046 §4.1.2](https://www.rfc-editor.org/rfc/rfc2046#section-4.1.2) marks `charset` as the exception to the general rule, and [RFC 2046 §5.1.1](https://www.rfc-editor.org/rfc/rfc2046#section-5.1.1) constructs the multipart boundary delimiter from the parameter value literally, so an inexact boundary does not delimit.

**[limit]** Distinct content-map keys that normalize to one parsed media identity collide only for that identity and support no selection through it: a request selection refuses before dispatch and a response selection is a loud protocol error on a successful response; on an unsuccessful one the best-effort failure-body rule governs, and no loud protocol error is raised. Non-colliding entries survive, and map order never breaks the tie.

**[incorporated]** A no-body invocation bypasses request-body media selection and emits neither a body nor `Content-Type`, because an absent optional effective Request Body contributes no HTTP content ([OAS 3.0.4 §§4.7.10.1, 4.7.13.1](https://spec.openapis.org/oas/v3.0.4.html#request-body-object)).

**[configuration point]** A body-emitting invocation preserves every admissible declared request alternative: exactly one usable concrete entry — one not excluded by this specification's confinement rules — selects itself; every other map, including two or more usable entries or a concrete declaration alongside a usable range, requires a concrete `requestMedia` choice before input consumption; the choice MUST match under §9.1 and never substitutes another declaration's schema, and supplied values never elect.

**[configuration point]** A missing required choice, unmatched or ambiguous choice, unsupported selected lane, or body-emitting invocation with no admissible candidate refuses before dispatch; no body bytes or examples are sniffed to select a lane.

**[pin]** A body-emitting invocation emits the elected concrete media type as its request `Content-Type` field value; a selection made through a range-keyed declaration emits the concrete `requestMedia` choice that instantiated it, never the range key, and a `multipart/form-data` selection additionally carries the `boundary` parameter that delimits the entity's parts. The incorporated HTTP authority only SHOULD-requires the field, excusing a sender to whom the intended media type is unknown; the election makes it known, so this specification pins that SHOULD to a requirement, and no accepted OAS edition states the emission. Each accepted 3.0 edition requires only that a Header parameter named `Content-Type` be ignored ([OAS 3.0.4 §§4.7.12.2.1, 4.7.13.1](https://spec.openapis.org/oas/v3.0.4.html#request-body-object), [RFC 9110 §8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3)).

**[exclusion]** A Request Body Object declaring `required: true` with an empty `content` map excludes the selected target before caller values are inspected: the required body admits no candidate media type, and leaving the target represented would make every invocation refuse for the same declaration defect. The exclusion reopens only if an incorporated OAS edition defines that behavior ([OAS 3.0.4 §4.7.13.1](https://spec.openapis.org/oas/v3.0.4.html#request-body-object)).

**[pin]** The emitted value is the elected concrete media type in its parsed form: type, subtype, and every parameter name in lowercase, each parameter value in the characters the declaration or choice supplied after unquoting, re-quoted only where the `token` production does not admit it. A `boundary` parameter is the one exception: §9.3 discards any declared or chosen value for emission and the generated token is emitted in its place. Which spelling matched — a range-keyed declaration instantiated by a `requestMedia` choice, a concrete map key, or the choice itself — never changes the emitted bytes. RFC 9110 §8.3.1 calls the alternative spellings equivalent and the normalized one preferred, which fixes no bytes on its own; this specification pins the preferred spelling ([RFC 9110 §8.3.1](https://www.rfc-editor.org/rfc/rfc9110#section-8.3.1)).

**[incorporated]** Examples illustrate values ([OAS 3.0.4 §4.7.14.1](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields-11)).

**[limit]** Examples create no operation input or output member and never select a declaration, carriage lane, or media type.

**[convention]** The binding sends no `Accept` header: OAS ignores a Header parameter named `Accept`, request-body content declares what the operation consumes, and response content supplies no portable instruction to advertise a preference ([OAS 3.0.4 §§4.7.12.2.1, 4.7.13, 4.7.17](https://spec.openapis.org/oas/v3.0.4.html#common-fixed-fields)).

### 9.2 Common carriage lanes

**[pin]** An exact `application/json` or `+json` selection serializes the supplied value as strict JSON on requests and parses strict JSON on responses; JSON text uses UTF-8 ([RFC 6839 §3.1](https://www.rfc-editor.org/rfc/rfc6839#section-3.1), [RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)).

**[pin]** [RFC 6839 §3.1](https://www.rfc-editor.org/rfc/rfc6839#section-3.1) is the incorporated `+json` suffix authority; where its registration inherits RFC 4627's UTF-16/UTF-32 latitude, [RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)'s UTF-8 requirement governs this lane.

**[pin]** Strict JSON is RFC 8259's grammar under this profile: parsing resolves duplicate object member names by taking the lexically last member, the documented common receiver behavior inside RFC 8259 §4's permitted set; a leading byte-order mark on a JSON body is ignored under RFC 8259 §8.1's parser latitude and is never part of the value; and a lone surrogate escape yields no value — it is a loud protocol error, because neither silent replacement nor invalid passthrough preserves the supplied text ([RFC 8259 §§4, 8.1–8.2](https://www.rfc-editor.org/rfc/rfc8259#section-4)).

**[limit]** JSON-lane numbers are interoperable within RFC 8259 §6's binary64 expectation. The permitted set is explicit and has two members: an implementation MAY preserve the supplied mathematical value exactly, and it MAY reduce it to the nearest finite binary64 value; nothing else is permitted, and no other deviation from the supplied value is. A conformant implementation therefore never fails or refuses for range or precision alone, and two conformant implementations MAY differ on a value outside binary64 — that difference is this declared set and not a defect ([RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259#section-6)).

**[convention]** `text/json` is not a member of that JSON lane; as a `text/*` type it can use the character-data lane only when its resolved declaration admits `string` as its sole non-null type and does not carry `format: binary`. This convention reopens under a new identifier only if the IANA media-type registry registers `text/json` with JSON semantics.

**[convention]** A concrete character-data selection whose resolved declaration admits `string` as its sole non-null type and does not carry `format: binary` carries the supplied string under its declared `charset`, defaulting to UTF-8; `type: string` with `nullable: true` therefore selects this lane for its string branch, while a supplied null refuses before dispatch because the lane defines no null lexical form, and response decoding emits a string and never invents null. The closed character-data set is `text/*`, `application/xml`, and `+xml`, while `application/json` and `+json` are claimed by their own lanes. The binding does not consult the live media-type registry's `Encoding considerations` — `application/json` is registered there as binary — because a live lookup would violate this pinned, immutable reading ([RFC 6838 §4.2.1](https://www.rfc-editor.org/rfc/rfc6838#section-4.2.1), [RFC 2046 §4.1](https://www.rfc-editor.org/rfc/rfc2046#section-4.1), [RFC 7303 §§3, 9](https://www.rfc-editor.org/rfc/rfc7303#section-3)).

**[pin]** This binding is an XML-unaware MIME consumer in RFC 7303 §3's own terms — it processes XML media as opaque character data, never as parsed XML — and the charset parameter is the only character-encoding source this lane consults: consulting a BOM or XML declaration would require inspecting body bytes, which this binding never sniffs, so a charset-less non-UTF-8 XML response is a loud protocol error rather than being sniffed, and every unsupported or invalid character decoding likewise raises a loud protocol error ([RFC 7303 §3.2](https://www.rfc-editor.org/rfc/rfc7303#section-3.2)).

**[pin]** Absent a `charset` parameter, a `text/*` representation decodes as UTF-8. RFC 6838 §4.2.1 says the UTF-8 charset "SHOULD be selected as the default" and no longer permits relying on RFC 2046 §4.1.2's US-ASCII default; this specification pins that SHOULD to a requirement, because a default left to each implementation makes the decoded value unportable, while the US-ASCII displacement is the newer registration authority's own ([RFC 6838 §4.2.1](https://www.rfc-editor.org/rfc/rfc6838#section-4.2.1), displacing [RFC 2046 §4.1.2](https://www.rfc-editor.org/rfc/rfc2046#section-4.1.2)).

**[limit]** UTF-8 encoding and decoding MUST be supported. Every additional charset encoder and decoder is an independent, direction-specific runtime capability: absence or failure of the encoder required for a request refuses before dispatch, while absence or failure of the decoder required for a response is a loud response-phase protocol error. An encoder-only capability never implies its decoder, nor vice versa.

**[incorporated]** A resolved declaration that admits `string` as its sole non-null type with `format: binary` authorizes unencoded octets, while one with `format: byte` denotes binary data embedded in a text-only format as an RFC 4648 Base64 string ([OAS 3.0.4 §§4.4.1–4.4.2](https://spec.openapis.org/oas/v3.0.4.html#working-with-binary-data)).

**[convention]** A `format: byte` value remains text under this binding: it uses its Base64 character bytes outside the JSON and form lanes and is never decoded merely by crossing the OpenBindings raw-octet boundary. §4.4.2 states the `binary`/`byte` distinction but assigns neither format a boundary-crossing rule, so this specification supplies one that keeps a single value from being Base64-decoded twice.

**[convention]** A non-JSON, non-form concrete selection whose Media Type Object omits `schema`, whose present resolved declaration is typeless, or whose resolved declaration admits `string` as its sole non-null type with `format: binary` uses the raw-octet lane. A schema-omitted media range does not gain this lane because it declares no single concrete representation.

**[convention]** In the preceding rule, a concrete selection is the concretely keyed declared alternative: a concrete `requestMedia` choice or actual response type matched by a range-keyed entry is governed by the range sentence and gains no raw lane through the match.

**[incorporated]** Every other supported keyword in a typeless resolved declaration still applies, because JSON Schema keywords and formats do not implicitly require the expected type; and `maxLength` on raw content measures decoded wire octets rather than the Base64 boundary string, because for unencoded binary the length is the number of octets ([OAS 3.0.4 §4.4](https://spec.openapis.org/oas/v3.0.4.html#data-types), [§4.4.2](https://spec.openapis.org/oas/v3.0.4.html#working-with-binary-data)).

**[incorporated]** `contentEncoding` and `contentMediaType` are outside the closed 3.0 Schema Object vocabulary and therefore decide as if absent; although 3.0.4's multipart guidance discusses those names, it does not enlarge the same edition's strictly supported keyword inventory or create binding behavior ([OAS 3.0.4 §§4.7.24.1, 4.7.15.3](https://spec.openapis.org/oas/v3.0.4.html#json-schema-keywords)).

**[pin]** Every OpenBindings raw-octet value is a JSON string containing canonical RFC 4648 §4 Base64: standard alphabet, required padding, no ignored non-alphabet characters, and zero unused pad bits; requests decode before dispatch and responses encode the exact octets ([RFC 4648 §§3.3, 3.5, 4](https://www.rfc-editor.org/rfc/rfc4648)).

**[convention]** A supplied request value at a raw-octet boundary that is not a JSON string, or that is a string the preceding canonical reading does not decode, refuses before dispatch at the affected body or part; RFC 4648 fixes what canonical Base64 is but assigns no outcome to a value that is not, so the outcome is stated here, and the value never reaches the wire in a repaired or partially decoded form.

**[exclusion]** This specification does not generate XML from an object model because the OAS XML Object does not determine complete document bytes; the selected media alternative is excluded until an incorporated authority defines ordering, escaping, nulls, dynamic keys, and scalar lexical forms, while string and raw-octet XML carriage remain admitted ([OAS 3.0.4 §§4.7.14, 4.7.26](https://spec.openapis.org/oas/v3.0.4.html#xml-object)).

**[convention]** `readOnly` and `writeOnly` retain their OAS request/response validation meaning, but this binding never uses either annotation to delete a supplied wire member or synthesize an absent one ([OAS 3.0.4 §4.7.24.2](https://spec.openapis.org/oas/v3.0.4.html#schema-read-only)).

**[exclusion]** A concrete request or response selection admitted by none of §3.2's five closed lanes — JSON, character-data including the string XML carriage under §9.2's XML rule, raw-octet, and the request-only form and multipart lanes — is excluded at its smallest media owner because OAS supplies no value-to-bytes mapping; the exclusion reopens only if an incorporated authority defines that media/data-form cell.

**[convention]** Invoking this binding does not trigger validation of any application value against its governing Schema Object; only a tool that separately claims validation owes Core's validation rules (Core [invariant 2](../../openbindings.md#2-core-invariants), [OBI-T-16](../../openbindings.md#103-tool-rules)).

### 9.3 Form bodies and multipart parts

**[incorporated]** `application/x-www-form-urlencoded` and `multipart/form-data` serialize object properties under the governing Schema and Encoding Objects, and a multipart alternative requires a schema ([OAS 3.0.4 §§4.7.14.4, 4.7.14.5, 4.7.15.3](https://spec.openapis.org/oas/v3.0.4.html#encoding-multipart-media-types)).

**[exclusion]** The form and multipart lanes are request-only: the incorporated authority's form and multipart sections are request-scoped by their own headings and supply no reverse mapping from those bytes to an application value, so a response selection of either lane is excluded at its smallest media owner. The exclusion reopens only if an incorporated authority defines that decoding.

**[convention]** A supplied `body: null` against a form or multipart object declaration refuses before dispatch: neither lane defines a null lexical form, mirroring §9.2's character-data rule.

**[limit]** A non-object declaration removes the form lane at its smallest owning unit under §3.2's smallest-owner rule, accounted `invalid`, and a multipart alternative without its required schema is likewise unavailable because it is invalid.

**[incorporated]** For a dynamic object member, the resolved property declaration uses the applicable exact `properties` declaration, or `additionalProperties` when no exact property declaration exists; applicable `allOf` constraints remain in force, and unsupported schema keywords create no additional property-routing behavior ([OAS 3.0.4 §4.7.24.1](https://spec.openapis.org/oas/v3.0.4.html#json-schema-keywords)).

**[convention]** Boolean `additionalProperties` resolves deterministically: `true` yields a typeless-equivalent resolved property declaration for an undeclared supplied member, and `false` yields no resolved property declaration, so an undeclared supplied member is unroutable and refuses before dispatch.

**[convention]** For form-carriage selection, a resolved property declaration uses §5.2's sole-non-null-choice member; `nullable: true` at the same level as `type` contributes null admission but no second carriage shape ([OAS 3.0.4 §§4.7.15.1.1, Appendix B](https://spec.openapis.org/oas/v3.0.4.html#common-fixed-fields-0)).

**[convention]** On the content-based form-urlencoded path and on the multipart path, a supplied JSON null for an optional property is elided as an omitted member and contributes neither a form-urlencoded field nor a multipart part. The Encoding RFC 6570-style path instead follows §8.2's authority-derived undefined-value bytes.

**[limit]** Elision is available only where omission is faithful. A supplied null for a property the governing resolved declaration marks required cannot be dropped without producing a form the declaration does not describe, so that invocation refuses before dispatch; sibling properties and media alternatives remain usable for other values.

**[limit]** That elision identifies `{}` and `{"x": null}` on the wire: a deliberate loss inside the authority's data-type-conversion latitude, disclosed here — the distinction between an absent optional member and an explicit null does not survive this lane ([OAS 3.0.4 Appendix B](https://spec.openapis.org/oas/v3.0.4.html#appendix-b-data-type-conversion)).

**[incorporated]** Encoding `style`, `explode`, and `allowReserved` controls apply only to `application/x-www-form-urlencoded`: each SHALL be ignored if the request body media type is not that type, so all three are ignored for multipart bodies on this line ([OAS 3.0.4 §4.7.15.1.2](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields-for-rfc6570-style-serialization)); the 3.1 and 3.2 lines extend the same fields to `multipart/form-data`, an edition difference and not sibling drift ([OAS 3.1.2 §4.8.15.1.2](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-for-rfc6570-style-serialization), [OAS 3.2.0 §4.15.1.2](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-for-rfc6570-style-serialization)).

**[pin]** Explicit presence of any one of those controls selects RFC 6570-style serialization, absent sibling controls taking their defaults, while absence of all three selects content-based encoding. The accepted editions frame both branches only as RECOMMENDED; this specification pins both to fixed rules, because a recommended branch selection leaves two conformant processors emitting different bytes for one declaration, and the 3.1 and 3.2 lines raise the same selection to SHALL, so the pin anticipates the correction rather than departing from it ([OAS 3.0.4 §4.7.15.1.2](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields-for-rfc6570-style-serialization), against [OAS 3.1.2 §4.8.15.1.2](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-for-rfc6570-style-serialization)).

**[incorporated]** Form-urlencoded removes RFC 6570's leading `?`; its content path follows RFC 1866 form encoding while its style path follows RFC 6570, and the two paths remain distinct rather than being collapsed into a single serialization route. On the content path, Encoding `contentType` routes a property's serialization and may declare a concrete type, wildcard, or comma-separated list ([OAS 3.0.4 §§4.7.15.1.1–4.7.15.2, Appendix E](https://spec.openapis.org/oas/v3.0.4.html#encoding-the-x-www-form-urlencoded-media-type), [RFC 1866 §8.2.1](https://www.rfc-editor.org/rfc/rfc1866#section-8.2.1), [RFC 6570](https://www.rfc-editor.org/rfc/rfc6570)).

**[pin]** On that content-based form-urlencoded path, SPACE becomes `+`, RFC 3986 unreserved bytes remain literal, and every other UTF-8 byte is encoded as uppercase `%HH`. This is a disclosed displacement fixing one spelling where the incorporated authorities give several — RFC 1866 §8.2.1 replaces every non-alphanumeric character and Appendix E.3 recommends RFC 1738's safe set — pinned to the RFC 3986 set because it is the set every other percent-encoding rule in this document already uses, and one binding emitting two unreserved sets would be a worse outcome than one disclosed departure ([OAS 3.0.4 Appendix E.3, E.3.1](https://spec.openapis.org/oas/v3.0.4.html#generating-and-validating-uris-and-form-urlencoded-strings), [RFC 1866 §8.2.1](https://www.rfc-editor.org/rfc/rfc1866#section-8.2.1), [RFC 3986 §2.3](https://www.rfc-editor.org/rfc/rfc3986#section-2.3), [RFC 1738 §2.2](https://www.rfc-editor.org/rfc/rfc1738#section-2.2)).

**[incorporated]** A property's Encoding media type is selected as follows: an explicit single concrete Encoding `contentType`; otherwise `application/octet-stream` for a resolved declaration that admits `string` as its sole non-null type with `format: binary` or `format: byte`, `text/plain` for a plain string or number/integer/boolean, `application/json` for an object, and the item-type default for an array; a typeless resolved declaration has no default concrete type. The selection governs both lanes that carry Encoding Objects — the content-based form-urlencoded path and multipart parts — because the edition places `contentType` among the fields usable with or without the RFC 6570-style serialization fields ([OAS 3.0.4 §4.7.15.1.1](https://spec.openapis.org/oas/v3.0.4.html#common-fixed-fields-0)).

**[limit]** A content-form property or multipart part whose resolved declaration admits no instance — §5.2's empty intersection, this edition's dialect having no boolean form — is an unreachable defect under §3.2's smallest-owner rule: no value can reach it, so it is not a routed field, it destroys neither its media alternative nor its target, both are accounted represented, and the declaration is carried into the synthesized contract as written. A value supplied for it fails every admission test and refuses before dispatch at that part or property, which is §5.2's consequence and not a new rule.

**[convention]** On the content-based form-urlencoded path the selected media type routes the property's serialization through §9.2's lane for that type and the resulting bytes are then percent-encoded as one field value under the rule above; on the multipart path it is the part's `Content-Type`. No property reaches the wire without a stated lane; the compound-value case the item-derived default leaves undefined is governed by the rule below.

**[convention]** The item-type default for an array can select a media type — `text/plain` for primitive items — under which no accepted edition defines the serialization of the whole compound value, and this specification authors no bytes there: such a property has no governed wire form and requires an explicit choice naming a concrete media type whose lane does define the bytes, either an explicit single concrete Encoding `contentType` in the artifact or the `propertyMedia` configuration point. An invocation supplying such a property without that choice refuses before dispatch as the context-required species, carrying the `propertyMedia` requirement; the item-derived default itself is not displaced.

**[incorporated]** Every `multipart/form-data` part carries `Content-Disposition: form-data` with the schema-property name in its `name` parameter; an array property emits one part per element under that same name ([OAS 3.0.4 §4.7.15.3](https://spec.openapis.org/oas/v3.0.4.html#encoding-multipart-media-types)).

**[pin]** That `name` parameter value is emitted as a quoted-string over the exact schema-property-name Unicode scalar sequence encoded as UTF-8. A `qdtext` byte is emitted literally, each DQUOTE or backslash is preceded by exactly one backslash, and no other byte is escaped or percent-encoded. [RFC 9110 §5.6.6](https://www.rfc-editor.org/rfc/rfc9110#section-5.6.6) permits quoted and unquoted spellings but fixes neither choice nor quoted-pair use; this specification's single spelling closes those bytes.

**[exclusion]** A non-ignored Encoding `Content-Disposition` Header Object on a name-based part is admissible only when its resolved schema fixes exactly one string through a single-member `enum`, that string is a valid field value whose parsed disposition type is `form-data`, and its `name` parameter equals the exact schema-property name. Otherwise the multipart alternative is excluded because the artifact declaration and OAS's mandatory name mapping do not determine one valid field. An admissible fixed value is emitted verbatim in place of the generated spelling above.

**[incorporated]** A multipart entity's parts are delimited with a boundary delimiter constructed from CRLF, `--`, and the value of the `boundary` parameter carried on the emitted media type; the delimiter MUST NOT appear inside any encapsulated part. The entity opens with `--`, the boundary value, and CRLF; each subsequent part is preceded by CRLF, `--`, the boundary value, and CRLF; the entity closes with CRLF, `--`, the boundary value, and a final `--`; and only CRLF represents a line break between parts. The boundary value is 1 to 70 characters of RFC 2046's `bchars` not ending in white space, and a composer MUST NOT generate non-zero-length transport padding ([RFC 9110 §8.3.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3.3), [RFC 2046 §5.1.1](https://www.rfc-editor.org/rfc/rfc2046#section-5.1.1)).

**[convention]** The processor generates that boundary token and this binding declares no generation procedure: any token satisfying the incorporated grammar that appears in no encapsulated part discharges the requirement, and neither the token nor its optional quoting on the media-type field is portable meaning. The binding emits no preamble and no epilogue, both optional and discardable under the incorporated grammar. A `boundary` parameter carried by a declaration key or a `requestMedia` choice takes part in §9.1's matching and is then discarded for emission — the one exception §9.1's emitted-spelling pin names — because no incorporated authority makes a declared `boundary` bind the sender while the grammar places the choice of token with the composer ([RFC 2046 §5.1.1](https://www.rfc-editor.org/rfc/rfc2046#section-5.1.1)).

**[convention]** Repeated parts for one array preserve element order; cross-property multipart part order and cross-property form-urlencoded field order have no portable meaning. An implementation MAY emit a deterministic cross-property order, but the binding exposes and requires none; property-to-name membership and array-member order remain separate.

**[exclusion]** A property name containing a non-scalar lone surrogate or any byte outside RFC 9110 `qdtext` plus DQUOTE and backslash after UTF-8 encoding — CR, LF, NUL, another forbidden control, or DEL included — excludes only that multipart media alternative. The exclusion reopens only if incorporated authority defines an unambiguous encoding.

**[incorporated]** For a multipart field, `format: byte` is declaration-equivalent to an Encoding `Content-Transfer-Encoding` Header schema that requires `base64`; OAS also notes that `Content-Transfer-Encoding` is deprecated for `multipart/form-data`, and defines serialization and parsing as undefined when an explicit Encoding Header schema conflicts by disallowing `base64` ([OAS 3.0.4 §4.7.15.3](https://spec.openapis.org/oas/v3.0.4.html#encoding-multipart-media-types)).

**[convention]** A part with a typeless resolved declaration or whose resolved declaration admits `string` as its sole non-null type with `format: binary` uses the raw-octet lane and §9.2's canonical Base64 boundary; a part whose resolved declaration admits `string` as its sole non-null type with `format: byte` rides as artifact-encoded Base64 text. The declaration equivalence alone emits no `Content-Transfer-Encoding`; when the artifact explicitly declares that Encoding header and its resolved declaration fixes the single string `base64`, the emitted field is `Content-Transfer-Encoding: base64`.

**[exclusion]** A `format: byte` part for which the resolved declaration of an explicit Encoding `Content-Transfer-Encoding` Header disallows `base64` is unusable, and any invocation that would emit it refuses before dispatch; the defect is confined to that declared part. This exclusion reopens only if an incorporated OAS edition defines serialization and parsing for the conflict ([OAS 3.0.4 §4.7.15.3](https://spec.openapis.org/oas/v3.0.4.html#encoding-multipart-media-types)).

**[configuration point]** `propertyMedia` supplies one concrete media type per affected form or multipart property. It is required, on the content-based form-urlencoded path and for a multipart part alike, whenever the preceding selection yields no single concrete media type — a wildcard or comma-separated Encoding `contentType`, or a typeless resolved declaration with no default concrete type — and equally when the selected media type defines no serialization for the resolved compound type. The choice MUST satisfy a declared member under §9.1, and an absent, unmatched, or ambiguous required choice refuses before dispatch at the selected media alternative.

**[pin]** After references are resolved and invalid Header projections are confined, surviving non-ignored Encoding Header Object keys compare ASCII case-insensitively and every case-equivalent entry governs one part field; map order and key spelling supply no preference. A schema-form declaration fixes an exact value only through a single-string `enum`; `default` and examples do not fix one, and a content-form declaration fixes no exact artifact value under this identifier. A case-folded group is artifact-fixed when at least one member fixes one value, every fixed member fixes that same value, and every other binding-understood exact finite raw-string domain includes it. No inverse `simple` or content-form deserialization is invented; other schema constraints are coverage loss and impose no binding constraint on the emitted field. The group emits its fixed value once. When no member fixes a value, the group is required if any member declares `required: true`; otherwise it remains descriptive and emits nothing. This pin reopens only if incorporated OAS authority defines co-present case-variant resolution or exact content-form emission.

**[exclusion]** Every non-ignored Encoding header name MUST be an HTTP `token`, and every artifact-fixed group value MUST be a valid HTTP field value. Conflicting fixed values, a member that rejects the group's fixed value, a non-token name, or an invalid fixed field value excludes the multipart alternative before dispatch because no single safe field satisfies the declarations. Case-folded groups are resolved first, so a group-internal conflict owns that alternative-level exclusion; the narrower `format: byte`/`Content-Transfer-Encoding` equivalence rule applies only to a surviving coherent group. The exclusion reopens only if incorporated authority defines a different combination or safe wire mapping. Each surviving artifact-fixed header is emitted verbatim, subject to the `Content-Disposition` rule above.

**[exclusion]** A required case-folded Encoding-header group that fixes no exact value excludes the multipart alternative because this specification defines no caller part-header channel. A nonfixed optional group remains descriptive and is not emitted. An ignored entry, `Content-Type` included, triggers neither rule. This exclusion reopens only if an incorporated authority defines caller part-header carriage ([OAS 3.0.4 §§4.7.15.1.1, 4.7.15.3](https://spec.openapis.org/oas/v3.0.4.html#encoding-headers), [RFC 9110 §§5.1, 5.5](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[exclusion]** A multipart media type other than `multipart/form-data` is excluded because OAS defines no property-to-part correlation for unnamed ordered parts; the exclusion reopens only if an incorporated OAS edition defines that correlation ([OAS 3.0.4 §4.7.15.3](https://spec.openapis.org/oas/v3.0.4.html#encoding-multipart-media-types)).

### 9.4 HTTP content codings

**[incorporated]** HTTP `Content-Encoding` is distinct from media type, from `format: byte`, and from the unsupported Schema Object keyword `contentEncoding`; request codings apply in listed wire order and response codings decode in reverse order before the selected media lane ([RFC 9110 §8.4](https://www.rfc-editor.org/rfc/rfc9110#section-8.4), [OAS 3.0.4 §4.4.2](https://spec.openapis.org/oas/v3.0.4.html#working-with-binary-data)).

**[incorporated]** HTTP field-name comparison is ASCII case-insensitive, and OAS follows HTTP's case-sensitivity rules for names that map directly to HTTP concepts ([OAS 3.0.4 §3.8](https://spec.openapis.org/oas/v3.0.4.html#case-sensitivity), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[convention]** The accepted editions define no specialized content-coding keyword. An effective request Header Parameter or governing response Header Object named `Content-Encoding` describes, and where applicable constrains, that ordinary HTTP field; the declaration alone neither selects a coding nor emits a field, and it is not permission the processor needs before honoring an actual field. An absent declaration therefore imposes no content-coding constraint and does not declare `identity` ([OAS 3.0.4 §4.4.2](https://spec.openapis.org/oas/v3.0.4.html#working-with-binary-data), [§4.7.12](https://spec.openapis.org/oas/v3.0.4.html#parameter-object), [§4.7.17](https://spec.openapis.org/oas/v3.0.4.html#response-headers)).

**[exclusion]** Every response Header Object map key MUST be an HTTP field-name `token`. A non-token key excludes that header projection as subordinate coverage loss. An optional projection propagates no further; one declaring `required: true` makes the smallest owning response alternative excluded because no HTTP response can satisfy it. A successful response governed by that excluded alternative is a loud response-phase protocol error, while failure data remains governed by §9.5's best-effort rule. This exclusion reopens only if incorporated HTTP authority admits that exact field-name form ([RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[pin]** A schema-form Header contributes one binding-understood exact finite raw-string domain only when §5.2's resolved type set has `string` as its sole non-null type. After Schema `$ref` resolution, collect every applicable `enum` at the schema root and recursively in each `allOf` branch; each contributes the set of its distinct string-valued members, with non-string members discarded, and the Header's domain is the intersection of all contributed sets. An enum containing no string contributes the empty set. No contributed set means no binding value constraint. Reference Object siblings remain governed by §5.1 and are not silently composed.

**[pin]** After references are resolved, invalid Header projections are confined, and `Content-Type` is ignored, surviving Response Header Object keys compare ASCII case-insensitively and every case-equivalent member governs one actual HTTP field; map order and key spelling supply no preference. One received field satisfies the group's presence obligation, and the group is required when any surviving member declares `required: true`. For `Content-Encoding`, the actual field MUST belong to every binding-understood exact finite raw-string domain contributed by the group. No inverse `simple` or content-form deserialization is invented: other schema constraints and content-form Headers contribute presence only, are synthesis coverage loss, and impose no binding value constraint, while the actual field still fixes the coding stack. Ordinary response-header declarations create no output member, and case variation alone never excludes a response alternative. This pin reopens only if incorporated OAS authority defines co-present case-variant resolution or broader response-header validation ([OAS 3.0.4 §§3.8, 4.7.17, 4.7.21](https://spec.openapis.org/oas/v3.0.4.html#response-headers), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[exclusion]** A required case-equivalent `Content-Encoding` group excludes its response alternative only when its binding-understood exact finite raw-string domains have an empty intersection, including disjoint string `enum` sets; an optional group remains satisfiable by absence, and lack of proof is not exclusion. Otherwise an actual field is checked against every such domain at response time. This exclusion reopens if incorporated OAS authority defines a different co-present constraint composition.

**[pin]** The actual `Content-Encoding` field fixes the coding stack. On a request, that is the effective caller-supplied Header Parameter value after §8 serialization; on a response, it is the field received from the peer whether or not the governing Response Object declares it. Multiple field-line values are trimmed of surrounding OWS and combined in arrival order with exactly comma-plus-SP before the resulting complete string is tested against an exact raw-string domain; the coding list is then split on `,` with surrounding whitespace removed, and tokens compare ASCII case-insensitively. The request applies the listed codings in order and the response removes them in reverse order; an absent field names an empty stack, and `identity` is a no-op requiring no codec ([RFC 9110 §§5.2–5.3](https://www.rfc-editor.org/rfc/rfc9110#section-5.2), [§8.4](https://www.rfc-editor.org/rfc/rfc9110#section-8.4)).

**[exclusion]** A request `Content-Encoding` field requires a request representation to encode. Supplying that Header Parameter on an invocation that emits no body refuses before dispatch, even for `identity`. The target is excluded only when, after invalid, excluded, and method-ignored request lanes are removed, no conforming invocation can emit a request representation and the field is required; otherwise the target remains represented and only each body-free invocation required or supplied to emit the field refuses. An omitted optional field remains compatible with a body-free invocation. This exclusion reopens only if incorporated HTTP authority defines Content-Encoding on a request with no representation.

**[limit]** Content-coding implementations are runtime capabilities, not binding configuration points: this specification requires no fixed supported set and defines no codec API. A non-`identity` token for which the runtime has no single case-insensitive encoder or decoder is unsupported; capability names that collide after ASCII case-folding do not supply a single codec for that token.

**[convention]** A malformed coding list or a response field outside a binding-understood exact finite raw-string domain is never skipped or sniffed: a request-side condition refuses before dispatch and a response-side condition is a loud protocol error. An unsupported or ambiguous token or codec failure has that same outcome only when the representation is actually encoded or decoded. HEAD and the no-content statuses in §9.5 still parse the field grammar and apply every governing raw-string domain, but they neither require nor invoke a content decoder. A runtime-supplied or built-in codec supplies capability but never selects a coding, while absence of a governing response Header Object supplies no constraint and is not an error.

### 9.5 Response declaration, classification, and decoding

**[incorporated]** Response keys are closed to exact three-digit status codes `100` through `599`, the five ranges `1XX` through `5XX`, `default`, and specification extensions; an exact key overrides its matching range ([OAS 3.0.4 §§3.7, 4.7.16](https://spec.openapis.org/oas/v3.0.4.html#responses-object), [RFC 9110 §15](https://www.rfc-editor.org/rfc/rfc9110#section-15)).

**[limit]** A Responses key outside that closed admitted set is upstream-invalid at that subordinate entry, is accounted `invalid`, and never participates in response lookup. It does not remove the selected target while another admitted exact, range, or `default` field keeps the Responses Object usable; if discarding every invalid key leaves no such field, §6.1's required-response-declaration rule makes the target `invalid`. The entry-level confinement reopens only if an incorporated OAS 3.0 edition admits that exact key form.

**[limit]** An admitted exact, range, or `default` key retains its lookup precedence even when its value or one fixed member is upstream-invalid; invalidity never makes lookup fall through to a less-specific key. A value that is not a Response Object makes that response alternative `invalid`. Within an object, invalidity is confined to the smallest defective projection: a missing or non-string `description`, a non-map `content`, `headers`, or `links`, or one non-Header member of `headers`. An invalid header projection imposes no response constraint on success or failure, while every valid sibling Header projection still governs. The target and every valid sibling projection remain represented, and synthesis derives no contract from an invalid projection ([OAS 3.0.4 §§4.7.16, 4.7.17](https://spec.openapis.org/oas/v3.0.4.html#response-object)).

**[convention]** For an admitted key whose governing response value or body projection is invalid, a successful response with zero content octets completes with no output; a successful non-empty response is a loud response-phase protocol error unless a surviving valid content projection and selected media lane decode it. A failure response instead follows the best-effort rule below and carries no failure data when its governing body projection is invalid. These outcomes do not change lookup precedence or target addressability.

**[limit]** A Response Object that omits its REQUIRED `description`, or supplies a non-string one, is upstream-invalid at that documentary projection. A non-map `links` is likewise invalid only at a projection this binding never invokes. Because this binding reads neither position during invocation nor projects either into an operation value, those defects are coverage loss only and every valid content or header sibling still governs.

**[convention]** The governing Response Object lookup order is exact status, then the single matching range, then `default`; range-over-default is this specification's reading, and declarations never reclassify the native status.

**[incorporated]** RFC 9110 defines the 2xx class as successful ([RFC 9110 §15.3](https://www.rfc-editor.org/rfc/rfc9110#section-15.3)).

**[convention]** For this binding, success means that the final status—the status after any interim responses and any redirects the runtime chose to follow with the bound method and complete body preserved—is in that 2xx class; a method-rewriting redirect is the final response of this interaction, and anything a runtime does after it is a different interaction outside this classification.

**[convention]** Redirect following is runtime policy. A redirect followed with the bound method and complete body preserved remains this interaction; a method-rewriting redirect is a final response of this interaction ([RFC 9110 §15.4](https://www.rfc-editor.org/rfc/rfc9110#section-15.4)).

**[pin]** When the runtime follows a redirect with method and body preserved, it forwards or reconstructs binding-selected header credentials and Cookie contributions only for the same origin. Origins are equal when the lowercased scheme, case-insensitive host, and effective port agree after applying the default ports for `http` and `https`. On a different-origin hop the runtime MUST NOT forward or reconstruct Authorization, header API-key, raw Cookie, or structured Cookie contributions selected by this binding. A binding-selected query credential is never appended to a redirect Location on any hop. RFC 9110 advises removal of resource-specific fields such as Authorization and Cookie before an automatic redirect, and this pin makes that protection deterministic for binding-owned credential channels; ordinary parameter values whose sensitivity OAS cannot express remain the consumer's responsibility ([RFC 9110 §15.4](https://www.rfc-editor.org/rfc/rfc9110#section-15.4)).

**[limit]** Outcome classification depends on the final status, while redirect following and transport content negotiation, including a runtime-advertised `Accept-Encoding`, are runtime policy under Core §1.2. Two conformant runtimes MAY therefore classify one wire history differently, and that redirect/negotiation variance is the stated permitted set; the binding itself emits no negotiation field beyond those this specification pins (Core [§1.2](../../openbindings.md#12-out-of-scope)).

**[incorporated]** A response Header Object named `Content-Type` is ignored. Every other governing response Header Object declaring `required: true` makes that header mandatory in the actual response ([OAS 3.0.4 §§4.7.17, 4.7.21](https://spec.openapis.org/oas/v3.0.4.html#response-headers)).

**[limit]** An actual response missing such a declared required header is a loud protocol error, in the same class as the undeclared non-empty-response error below; header carriage remains outside the operation-value boundary.

**[incorporated]** A non-empty response selects its concrete media type from `Content-Type` and then the most-specific matching governing content declaration ([OAS 3.0.4 §§4.7.16, 4.7.17](https://spec.openapis.org/oas/v3.0.4.html#response-object)).

**[convention]** An unmatched, ambiguous, normalized-colliding, or matched-but-excluded result is a loud protocol error on a successful response; on an unsuccessful one the best-effort failure-body rule below governs, and no loud protocol error is raised; an unused excluded response sibling never makes the target unusable before dispatch.

**[convention]** When a non-empty response omits `Content-Type`, the binding takes RFC 9110's permitted `application/octet-stream` assumption before ordinary matching; the resulting type still MUST match a governing declaration ([RFC 9110 §8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3)).

**[convention]** A response carrying two or more `Content-Type` fields, or one whose single field value is a list of media types, selects no media type: RFC 9110 §8.3 defines `Content-Type` as a single `media-type`, names that shape as an interoperability and security hazard, and defines no resolution, and its `application/octet-stream` assumption is granted for an absent field, not a present one. On a successful response it is a loud protocol error; on an unsuccessful one no governing content declaration matches, so the best-effort failure-body rule below yields no failure-data value and no protocol error ([RFC 9110 §8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3)).

**[convention]** For a status that permits HTTP content, an **empty response** has zero content octets after transfer decoding and content-coding decoding. For HEAD and a status that forbids content, the no-content check instead examines transfer-decoded octets before any `Content-Encoding` removal: any nonzero octet count is forbidden content, even when those octets would decode to an empty representation. A response to HEAD is empty only for operation-output purposes.

**[incorporated]** A response to HEAD and any `1xx`, `204`, `205`, or `304` response carries no HTTP content. A `1xx` response other than `101` is interim and does not classify the interaction. A `101 Switching Protocols` response instead continues the request under a different application protocol ([RFC 9110 §§6.4.1, 15.2.2, 15.3.6](https://www.rfc-editor.org/rfc/rfc9110#section-6.4.1)).

**[convention]** Because this binding never emits `Upgrade` and defines no switched-protocol continuation, receiving `101` is immediately a loud protocol error at the response phase, and the processor MUST NOT wait for a later HTTP final response. For the remaining no-content cases the binding performs no content decoding and emits no output value regardless of declared response content. Required response-header rules still apply, and actual content where HTTP forbids it is a loud protocol error.

**[limit]** A declared response-body projection that can govern only one of those no-content cases is excluded as subordinate coverage loss while the operation remains represented. It reopens only if incorporated HTTP authority permits content for that case.

**[convention]** Empty responses emit no output value; successful non-empty responses emit the selected lane's one application value.

**[convention]** A failure body is decoded through the same selected carriage lanes as a successful body, and the decoded value is carried as opaque application-authored failure data on unsuccessful completion. That decoding is best-effort: when the governing content declaration is defective, absent, or no governing content declaration matches the actual media type, the interaction completes unsuccessfully with no failure-data value and raises no loud protocol error, which is why a failure declaration is not load-bearing for representation. A governing invalid Response alternative is read the same way wherever it governs: a non-object supplies no fixed members, and each defective member is treated as absent, so a non-map `headers` enforces no required response header and a non-map `content` selects no lane. OAS 3.0 describes `content` as potential payloads rather than stating that omission forbids a body; omission therefore selects no decodable failure-data lane. A successful non-empty response with no surviving content lane remains a loud protocol error under the rule above.

**[convention]** The unary response value commits only after transfer completion and the full decode chain — content codings, then character decoding, then the selected lane — succeed; any failure after a 2xx final status and before that commit is a loud protocol error, and the interaction completes unsuccessfully with no partial unary value.

**[limit]** A non-empty successful response with no governing Response Object is a loud protocol error because no output lane governs it. A non-empty unsuccessful response with no governing Response Object completes unsuccessfully with no failure data and no added protocol error. This specification defines no response-header or Link carriage in an operation value, so Response Header and Link Objects create no output members under this identifier; consequently, even a declared `Location` header on a `201` response reaches no operation value ([OAS 3.0.4 §§4.7.16, 4.7.17](https://spec.openapis.org/oas/v3.0.4.html#response-object)).

**[limit]** One HTTP response body produces at most one operation value: the accepted 3.0 editions define no construct that frames one response body into multiple application values, including for `text/event-stream` ([OAS 3.0.0 §4.7.17](https://spec.openapis.org/oas/v3.0.0.html#response-object), [3.0.1 §4.7.17](https://spec.openapis.org/oas/v3.0.1.html#response-object), [3.0.2 §4.7.17](https://spec.openapis.org/oas/v3.0.2.html#response-object), [3.0.3 §4.7.17](https://spec.openapis.org/oas/v3.0.3.html#response-object), [3.0.4 §4.7.17](https://spec.openapis.org/oas/v3.0.4.html#response-object)).

## 10. Servers and target URL

**[incorporated]** Server declarations are scoped at Operation, Path Item, and root levels, with a more specific list overriding the outer scope; an absent or empty root list is equivalent to one Server Object whose URL is `/` ([OAS 3.0.4 §§4.7.1.1, 4.7.5, 4.7.9.1, 4.7.10.1](https://spec.openapis.org/oas/v3.0.4.html#server-object)).

**[pin]** An empty Operation or Path Item `servers` array supplies no local alternative and falls through to the next outer scope, matching the root empty-equals-absent precedent. The accepted editions say only that an outer `servers` array is overridden, without qualifying the overriding list as nonempty; this specification pins the fall-through reading because the alternative leaves a target with no completed URL and no stated recovery ([OAS 3.0.4 §§4.7.9.1, 4.7.10.1](https://spec.openapis.org/oas/v3.0.4.html#path-item-object)).

**[configuration point]** One effective server selects itself; multiple members require one consumer `server` choice before dispatch, the same value carries exact variable substitutions, and no member or variable preference is inferred.

**[incorporated]** A Server Variable Object requires a string `default`, which is sent when no alternate is supplied. A declared `enum` SHOULD NOT be empty, and the default SHOULD belong to it ([OAS 3.0.4 §4.7.6](https://spec.openapis.org/oas/v3.0.4.html#server-variable-object)).

**[limit]** A present Server Variable Object with an absent or wrong-typed required `default` is upstream-invalid and makes only its owning Server alternative `invalid`; sibling alternatives survive. If none remains and complete-URL replacement can recover the target, the target stays represented with `configuration.server`; without recovery the invocation refuses before dispatch. This confinement reopens only if an incorporated OAS edition admits the malformed declaration.

**[exclusion]** For cross-line determinism this specification excludes a declaration-derived Server alternative with an empty `enum` or an out-of-enum default. Neither form violates a 3.0 MUST, but neither supplies one declaration-derived substitution this binding can honor. Sibling alternatives survive; if none remains, the target stays represented with `configuration.server`, and invocation without a conforming alternative or complete-URL recovery is context-required before dispatch. Refusing the empty-enum-plus-default case is a disclosed narrowing of the authority's SHALL-send-default instruction. The exclusion reopens only if an incorporated OAS edition defines the excluded declaration's unique substitution.

**[pin]** A URL template expression having no matching Server Variable Object has no declaration-derived default, but an exact consumer substitution may complete it. If declaration and configuration together leave any expression unresolved, the represented target is context-required on `configuration.server` before dispatch; the Server alternative is not excluded merely because the matching declaration is absent. This matches the later 3.1 and 3.2 lines, whose upstream Server template semantics do not materially differ on this point.

**[pin]** A consumer-supplied value for a variable with a declared nonempty `enum` MUST be a member of it. An out-of-enum consumer value is a nonconforming configuration choice that refuses that invocation before dispatch without changing synthesis coverage; a complete configured URL is a distinct replacement lane and does not weaken the selected Server Object.

**[incorporated]** Before path assembly, an expanded relative Server URL—including the implied `/`—resolves against the location of the document containing that Server Object; the operation's path bytes are then appended to the expanded Server URL with no relative URL resolution, which the editions state in the append rule's own parenthetical ([OAS 3.0.4 §§4.7.5.1, 4.7.8.1](https://spec.openapis.org/oas/v3.0.4.html#server-url)).

**[pin]** "Appended" is pinned here to one and only one seam repair: if the resolved and expanded Server URL ends in `/` and the exact Paths key begins with `/`, exactly one slash — the Server URL's trailing slash — is removed before the Paths key is appended; otherwise both operands are unchanged. No other slash normalization, path repair, dot-segment rewrite, query merge, or relative-reference resolution occurs. Thus the implied server `/` plus `/pets` yields `/pets`, while a Paths key beginning `//` or an additional trailing Server URL slash remains observable because the rule removes only the one redundant seam slash ([OAS 3.0.0 §4.7.8.1](https://spec.openapis.org/oas/v3.0.0.html#paths-object), [3.0.4 §4.7.8.1](https://spec.openapis.org/oas/v3.0.4.html#paths-object)).

**[exclusion]** A Server alternative whose declaration-derived expansion — literal text plus variable defaults — contains a query or fragment is excluded because the accepted editions define path append but no concatenation meaning for either component; sibling alternatives survive, and if none remains the represented target requires a conforming complete-URL replacement. A consumer substitution that introduces either component does not change synthesis coverage; it is a nonconforming `server` choice and refuses that invocation before dispatch. The exclusion reopens only if an incorporated OAS edition defines that exact cell ([OAS 3.0.4 §§4.7.5.1, 4.7.8.1](https://spec.openapis.org/oas/v3.0.4.html#server-url)).

**[exclusion]** A Paths key containing a literal `?` or `#` excludes only the targets under that key because the binding's append-then-query procedure would otherwise reinterpret path data as a query or fragment; path data with either byte must use percent-encoding. The exclusion reopens only if incorporated OAS authority defines that key's target mapping.

**[limit]** When embedded content has no document location to supply its base, a relative Server URL leaves the target unresolved and refuses before dispatch; the complete configured URL below remains the available recovery.

**[convention]** After path and query serialization, the completed target MUST parse and percent-decode under RFC 3986; an unusable target refuses before dispatch ([RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)).

**[convention]** That parse and percent-decode is a well-formedness check only: the dispatched bytes are the constructed percent-encoded bytes, and the completed target is never dispatched in decoded form.

**[incorporated]** A sender MUST NOT generate an `http` or `https` target URI with an empty host or userinfo, and an untrusted reference containing userinfo ought to be treated as an error because it can obscure the intended authority ([RFC 9110 §§4.2.1–4.2.4](https://www.rfc-editor.org/rfc/rfc9110#section-4.2.1)).

**[exclusion]** An effective Server alternative whose declaration-derived absolute `http` or `https` expansion has an empty host or contains userinfo is excluded at that Server boundary; sibling alternatives survive. If none remains and complete-URL replacement can recover the target, the target remains represented with the `configuration.server` requirement below. A consumer variable substitution or configured URL that produces either condition does not change synthesis coverage; it is not a conforming choice and refuses before dispatch. This exclusion reopens only if incorporated HTTP authority permits such target generation.

**[convention]** A completed target whose scheme is not `http` or `https` refuses before dispatch, because no incorporated authority defines that scheme's HTTP-semantics mapping. The scheme belongs to the completed target, which a `server` choice or a complete configured URL can still change, so the target stays addressable and represented and no declaration is excluded. This refusal rule reopens only if an incorporated authority defines that mapping.

**[configuration point]** Whenever declaration-derived defaults and alternatives leave no completed `http` or `https` target but §10's complete-URL replacement can recover the operation, `configuration.server` is an actual requirement. Synthesis MUST record that requirement on the represented target, and invocation without a conforming replacement refuses before dispatch while awaiting `configuration.server` rather than excluding the target.

**[configuration point]** The `server` configuration point MAY instead supply one complete consumer-configured URL. That URL is itself a valid `server` value and by itself discharges any required member choice; it MUST use `http` or `https`, have a nonempty host, and contain no userinfo, query, or fragment. It replaces the resolved server base, and the operation's path bytes join to it under the preceding boundary rule; the artifact's path template, path substitution, query construction, method, parameters, body, response, and security semantics remain unchanged.

## 11. Security and channel assembly

**[incorporated]** Operation `security` replaces root `security`; `[]` means no security requirement, array members are OR alternatives, every nonempty Security Requirement Object is an AND of its named schemes, and `{}` is a complete anonymous alternative ([OAS 3.0.4 §§4.7.10.1, 4.7.30](https://spec.openapis.org/oas/v3.0.4.html#security-requirement-object)).

**[configuration point]** The binding preserves every complete alternative and invents no anonymous-versus-credentialed preference. The named configuration point `security` selects one complete alternative: a sole declared alternative selects itself, and an effective empty `[]` or anonymous optional-security alternative counts as a complete no-security alternative; multiple alternatives require an explicit choice, fragments from different alternatives are never combined, and an invocation with no selection where one is required refuses before dispatch.

**[incorporated]** A TRACE client MUST NOT generate request fields containing sensitive data; credentials and cookies are expressly within that class ([RFC 7231 §4.3.8](https://www.rfc-editor.org/rfc/rfc7231#section-4.3.8), [RFC 9110 §9.3.8](https://www.rfc-editor.org/rfc/rfc9110#section-9.3.8)).

**[exclusion]** On a `trace` target, every security alternative whose binding carriage would emit Basic, Bearer, or API-key credential bytes is excluded before selection because TRACE reflects the request and this binding will not place credentials in it; an anonymous alternative remains usable. A required raw or structured Cookie parameter likewise excludes the target, while supplying an optional Cookie source refuses before dispatch. An unmodeled security prerequisite may survive only when the runtime satisfies it without adding a sensitive request field. Other ordinary parameter values have no machine-readable sensitivity classification in OAS, so their classification remains the consumer's responsibility. This exclusion reopens only if incorporated HTTP authority permits sensitive data in TRACE.

**[incorporated]** Requirement arrays for OAuth 2.0 and OpenID Connect contain scopes and may be empty; arrays for every other scheme type MUST be empty, and this binding surfaces the exact OAuth/OpenID scope strings ([OAS 3.0.4 §4.7.30.1](https://spec.openapis.org/oas/v3.0.4.html#security-requirements-name)).

**[convention]** Whether a supplied credential satisfies a required scope is the counterparty's own determination and is never evaluated by this binding: a scope string is surfaced exactly as declared, in the alternative's requirement data and in any context challenge, and no incorporated authority defines a way for a client to read a token's grants without invoking an endpoint, which this binding never does. An OAuth 2.0 or OpenID Connect alternative is complete when its scheme's runtime access token is supplied and satisfies the Bearer input rule below; a token the counterparty finds insufficient produces that counterparty's own response, classified under §9's ordinary response rules like any other outcome.

**[limit]** A nonempty requirement array for any other scheme type is an upstream-invalid declaration that removes that security alternative from selection before any runtime credential is inspected, accounted invalid under §12.2; every remaining complete alternative survives.

**[configuration point]** `implicitConnectionScope` selects `entry` or `referring` document resolution for Security Requirement names and defaults to `entry`, following OAS's recommended entry-document scope while preserving the explicit alternative ([OAS 3.0.4 §4.3.2](https://spec.openapis.org/oas/v3.0.4.html#resolving-implicit-connections)).

**[incorporated]** HTTP authentication-scheme tokens compare ASCII case-insensitively ([RFC 9110 §11.1](https://www.rfc-editor.org/rfc/rfc9110#section-11.1), [OAS 3.0.4 §4.7.27.1](https://spec.openapis.org/oas/v3.0.4.html#security-scheme-scheme)).

**[incorporated]** `apiKey` credentials use their declared name and `query`, `header`, or `cookie` location, and HTTP `basic` and `bearer` credentials use the `Authorization` field ([OAS 3.0.4 §4.7.27](https://spec.openapis.org/oas/v3.0.4.html#security-scheme-object-0), [RFC 9110 §11.6.2](https://www.rfc-editor.org/rfc/rfc9110#section-11.6.2)).

**[incorporated]** A Security Scheme Object declares a REQUIRED `type` from the closed set `apiKey`, `http`, `oauth2`, `openIdConnect`, and each type carries its own REQUIRED fields: `apiKey` requires `name` and `in` from `query`, `header`, or `cookie`; `http` requires `scheme`; `oauth2` requires `flows`; `openIdConnect` requires `openIdConnectUrl`. This line's set has no `mutualTLS` member, which the 3.1 and 3.2 lines add, an edition difference ([OAS 3.0.4 §4.7.27.1](https://spec.openapis.org/oas/v3.0.4.html#security-scheme-object-0), against [OAS 3.1.2 §4.8.27.1](https://spec.openapis.org/oas/v3.1.2.html#security-scheme-object) and [OAS 3.2.0 §4.27.1](https://spec.openapis.org/oas/v3.2.0.html#security-scheme-object)).

**[limit]** A Security Scheme Object that is not one — a missing or unlisted `type`, or an absent or wrong-typed field its `type` makes REQUIRED — is upstream-invalid and removes every security alternative naming it before any runtime credential is inspected, each accounted `invalid`, because the declaration fixes neither what to send nor where. Every remaining complete alternative survives, and a target left with no complete alternative is itself excluded under §3.2's smallest-owner rule. The confinement reopens only if an incorporated OAS 3.0 edition admits the exact declaration.

**[pin]** A selected `basic` scheme consumes a runtime-supplied user-id and password and constructs `Authorization: Basic base64(user-id ":" password)` under [RFC 7617 §2](https://www.rfc-editor.org/rfc/rfc7617#section-2), including its user-id, password, and Base64 constraints. Because RFC 7617 §2 deliberately leaves the default character encoding undefined, the user-id and password octets are pinned to printable US-ASCII (0x20–0x7E); a credential containing any other character leaves the selected alternative unusable, and the invocation refuses before dispatch. This pin reopens only if an incorporated authority defines a charset-parameter declaration surface for the scheme.

**[pin]** A selected HTTP scheme whose `scheme` compares ASCII case-insensitively to `bearer`, and every selected OAuth 2.0 or OpenID Connect scheme, consumes one runtime-supplied Bearer access-token value. The value MUST match RFC 6750's `b64token` production — one or more permitted token characters followed only by optional `=` padding — and the binding constructs exactly `Authorization: Bearer <token>`, with exactly one U+0020 space between `Bearer` and the token. An empty value, a value containing SP, HTAB, CR, LF, or any other byte outside `b64token`, and an OAuth/OpenID runtime token typed as anything other than Bearer refuse before dispatch. Token acquisition is outside this binding ([RFC 6750 §2.1](https://www.rfc-editor.org/rfc/rfc6750#section-2.1)).

**[pin]** A selected `apiKey` scheme consumes a runtime-supplied key value and emits it at the declaration's exact query, header, or cookie destination.

**[exclusion]** An `apiKey` security alternative is excluded when its header name is not an HTTP `token`, or when its cookie name is not the `token` required for a cookie-name; other complete alternatives remain selectable. This exclusion reopens only if incorporated authority admits the exact destination-name form ([RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1), [RFC 6265 §4.1.1](https://httpwg.org/specs/rfc6265.html#sane-set-cookie-syntax)).

**[convention]** A runtime API-key value emitted to a header MUST be a valid HTTP `field-value` after UTF-8 encoding, with no leading or trailing SP or HTAB; a value containing CR, LF, NUL, another forbidden octet, or that boundary whitespace refuses before dispatch. A header key destined for `Cookie` MUST additionally be a complete RFC 6265 `cookie-string`. Cookie-location values remain subject to the `cookie-value` refusal rule below ([RFC 9110 §5.5](https://www.rfc-editor.org/rfc/rfc9110#section-5.5), [RFC 6265 §§4.1.1, 4.2.1](https://httpwg.org/specs/rfc6265.html#sane-cookie)).

**[exclusion]** OAuth 2.0 and OpenID Connect use the Bearer construction above. [RFC 6749 §7.1](https://www.rfc-editor.org/rfc/rfc6749#section-7.1) makes access-token types extensible, and every token type other than Bearer is excluded from wire carriage under this identifier, no rule of this specification constructing a field for one. That exclusion is a statement about this specification's carriage surface, not about any artifact declaration, so it removes no alternative from synthesis and appears in no coverage entry: an `oauth2` or `openIdConnect` alternative remains represented and its Bearer carriage complete. The exclusion reopens only if an incorporated authority defines another token type's carriage.

**[convention]** The runtime half is separate and is a prerequisite, not an exclusion: a runtime whose supplied token is not Bearer-typed leaves the selected alternative unusable, and the invocation refuses before dispatch, exactly as the other-scheme sentence below provides. Token type is a runtime fact and never a declaration fact, so it can reach no coverage entry.

**[limit]** Any declared HTTP authentication scheme other than case-insensitive `basic` or `bearer` remains visible as a consumer prerequisite, but this binding synthesizes no credential bytes for it; an alternative requiring it is unusable unless the runtime satisfies it as a complete prerequisite.

**[exclusion]** Two credentials in one AND requirement with the same destination, a credential colliding with a required effective parameter whose serialization cell can emit only the declared location and name for every admitted value shape, or a credential targeting binding/processor-owned `Host`, `Content-Length`, `Content-Type`, `Content-Encoding`, `Accept`, `Accept-Encoding`, `Connection`, `Keep-Alive`, `Proxy-Authorization`, `Proxy-Connection`, `TE`, `Trailer`, `Transfer-Encoding`, or `Upgrade` excludes only that security alternative; another complete non-colliding OR alternative survives, and the target is excluded only if none remains. Repeated occurrences of that same name remain fixed. Object-exploding and deep-object cells are runtime-derived; schema property inventories do not make them fixed because invocation does not perform schema validation. Header destinations compare ASCII case-insensitively; query and cookie destinations compare exact decoded names. `Accept` protects this specification's no-negotiation-field decision, `Content-Encoding` protects the effective Header Parameter as the sole request-coding selector, `Accept-Encoding` protects runtime transport negotiation, and `Proxy-Authorization` is reserved for the first inbound proxy rather than the origin ([RFC 9110 §11.7.2](https://www.rfc-editor.org/rfc/rfc9110#section-11.7.2)).

**[convention]** After parameter serialization and security selection, every actual parameter and credential contribution destination is compared again. A selected credential colliding with an optional parameter, or with a runtime-derived destination that was not statically provable, is invocation-conditional: an invocation producing both refuses before dispatch rather than selecting one source or emitting two, while omission of the parameter contribution emits the credential once and may dispatch. A supplied ordinary Header Parameter named `Accept-Encoding` suppresses any runtime-advertised field of that name; when it is omitted, transport negotiation remains runtime policy. §8.3 separately governs parameter-only processor-owned and raw/structured Cookie collisions.

**[convention]** An API-key query name and value are independently encoded by §8.2's query percent-encoding and joined with `=`, so hostile name characters remain inside one query member; an API-key cookie value is carried as an RFC 6265 `cookie-value` with no percent-encoding and refuses before dispatch when it cannot be so carried. All ordinary-parameter and credential query contributions form one unordered multiset: their relative order is not portable, but each contribution's exact encoded bytes are preserved. Credential values never enter the caller envelope or operation contract; structured cookie contributions preserve membership and join as `name=value` separated by `; `, with no portable cookie order ([RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1), [RFC 6265 §4.2.1](https://httpwg.org/specs/rfc6265.html#sane-cookie), [OAS 3.0.4 Appendix D](https://spec.openapis.org/oas/v3.0.4.html#appendix-d-serializing-headers-and-cookies)).

## 12. Configuration, synthesis, and conformance

### 12.1 Configuration vocabulary

**[configuration point]** The complete binding-specific configuration vocabulary is `requestMedia` (one concrete media type), `server` (one effective Server alternative plus exact variable values, or one complete consumer-configured URL replacing the resolved server base), `security` (selection of one complete security alternative), `parameterConversion` (deterministic boolean/number converter), `implicitConnectionScope` (`entry` or `referring`), and conditional `propertyMedia` (one concrete media type per affected form or multipart property).

**[configuration point]** Every requirement is typed and discoverable from declarations. Preflightability is bounded: a requirement whose applicability is fixed by declarations alone is preflightable as an actual requirement, while `requestMedia` and `parameterConversion` are conditional on supplied values and are preflightable only as POSSIBLE requirements — a preflight can name them and their type but cannot know whether a given invocation will trigger them. No configuration member appears in the caller envelope or operation contract. Decoding and response classification are fixed rules rather than configuration points, and §9.4 treats codec availability as runtime capability.

### 12.2 Synthesis boundary and coverage

**[incorporated]** Operation contracts remain protocol-neutral (Core [§5.1](../../openbindings.md#51-operations), [invariant 1](../../openbindings.md#2-core-invariants)) and MAY remain flat (Core [§5.5](../../openbindings.md#55-transforms)).

**[convention]** Synthesis emits an `inputTransform` that constructs §7's envelope, and transforms never route values to HTTP locations.

**[convention]** This binding defines no status, header, selected-media, or other context bindings at `inputTransform` or `outputTransform` positions; evaluation uses Core's closed environment unaugmented (Core [§5.5 clause 5](../../openbindings.md#55-transforms), [OBI-T-10](../../openbindings.md#103-tool-rules)).

**[limit]** Synthesis emits flat protocol-neutral operation contracts together with an `inputTransform` that constructs §7's envelope: the envelope is the binding-boundary value, never the emitted operation contract, and qualified location-keys appear only in the transform's output. §12.2 licenses `inputTransform` and `outputTransform` as synthesis outputs, and operation/dependency key spelling, flattening, output-schema choice, and Schema Object translation as synthesis policy; no other input-restructuring apparatus exists under this identifier.

**[convention]** Schema Object translation preserves the declared value domain up to representability: a synthesizer MUST account a lossy or non-equivalent Schema Object translation as coverage loss at its owning position, and output-schema choice carries no further soundness latitude.

**[convention]** A synthesizer MUST account for every addressable operation and every callback dependency using exactly one status defined by §3.2: `represented`, `invalid`, `excluded`, `lossy`, or `implementation-unsupported`. The status vocabulary and spellings are normative within this binding specification and do not depend on an interface-synthesizer contract; an interface may encode them differently only if it preserves their stated meaning. A failure in an unused description position is coverage loss rather than invocation behavior.

**[convention]** Every binding-specific configuration requirement remains in coverage accounting and invocation context, assigned to its represented target or declared alternative, and MUST NOT enter the operation input schema.

**[incorporated]** Dependencies are synthesis outputs only and add no invocation target or receiver behavior (Core [§1.2](../../openbindings.md#12-out-of-scope), [§5.6](../../openbindings.md#56-dependencies)).

### 12.3 Conformance rules

**[convention]** A document conforms to **OAPI30-D-01** when its `content`, if present, satisfies §§3–5 and its `location`, if present, satisfies §4.

**[convention]** A binding conforms to **OAPI30-D-02** when it names `openbindings.openapi-3.0@1`, carries the literal selector of §6.1, and identifies a source that passes the exact edition gate. That verdict is decided over the interpreted artifact, never over the binding's text alone: for a location-only source it follows §4's required dereference, so conformance to this rule is not a property of the OBI document in isolation.

**[convention]** Where a location-only source's dereference does not yield a representation, this rule is **unverified** rather than violated, and a verifier reporting an overall conclusion reports **conformance undetermined** absent an established violation elsewhere; an unavailable or policy-declined external resource is not evidence of violation. This extends, by this specification's own convention, the treatment Core [§10.5](../../openbindings.md#105-verification-conclusions) gives its own rules over network-inaccessible resources.

**[convention]** A processor conforms to **OAPI30-P-01** when it implements the closed load gates, smallest-owner confinement, Schema Object subset, reference closure, and selector semantics of §§3–6.

**[convention]** A processor conforms to **OAPI30-P-02** when it accepts only §7's envelope, applies §8's effective-parameter, collision, conversion, style, content, header, cookie, and path rules, and refuses every unknown or unroutable input before dispatch.

**[convention]** A processor conforms to **OAPI30-P-03** when it preserves media alternatives and applies §9's matching, request election, carriage, form, multipart, content-coding, response lookup, classification, and unary-boundary rules without sniffing or undeclared fallback.

**[convention]** A processor conforms to **OAPI30-P-04** when it resolves servers and complete target URLs under §10 and security alternatives, credentials, prerequisites, and channel collisions under §11.

**[convention]** A processor conforms to **OAPI30-P-05** when §3.2's source, addressability, synthesis-status, and invocation-outcome axes remain independent, including when every addressable target is invalid or excluded.

**[convention]** A processor conforms to **OAPI30-P-06** when §9.1 excludes a required Request Body Object whose `content` map is empty.

**[convention]** A processor conforms to **OAPI30-P-07** when §9.3 refuses a required content-based form property supplied as null instead of silently eliding it.

**[convention]** A processor conforms to **OAPI30-P-08** when §9.3 emits only safe artifact-fixed multipart headers and excludes required nonfixed or contradictory `Content-Disposition` declarations.

**[convention]** A processor conforms to **OAPI30-P-09** when §11 excludes invalid API-key destination names and rejects unsafe runtime header or cookie values before dispatch.

**[convention]** A processor conforms to **OAPI30-P-10** when an invalid failure-only Response projection remains coverage loss without removing its operation, as §9.5 requires.

**[convention]** A processor conforms to **OAPI30-P-11** when §9.5 performs no content decoding or output for HEAD, non-101 informational, `204`, `205`, and `304` responses and reports forbidden actual content as a loud response-phase protocol error.

**[convention]** A processor conforms to **OAPI30-P-12** when a declared body projection cannot cause content decoding or output for an actual no-content response.

**[convention]** A processor conforms to **OAPI30-P-13** when §9.5 retains a governing non-`Content-Type` response Header Object's `required: true` check on a no-content response.

**[convention]** A processor conforms to **OAPI30-P-14** when §8.3 excludes a non-token optional ordinary-header projection without excluding the operation, allowing an invocation that omits it to dispatch.

**[convention]** A processor conforms to **OAPI30-P-15** when §8.3 treats the would-be caller key of that excluded optional header as unknown input and refuses it before dispatch.

**[convention]** A processor conforms to **OAPI30-P-16** when §8.3 propagates a non-token required ordinary header to an excluded target that remains addressable and refuses before dispatch.

**[convention]** A processor conforms to **OAPI30-P-17** when §8.3 prevents caller control of every listed connection, framing, and routing field by excluding the addressable target before dispatch.

**[convention]** A processor conforms to **OAPI30-P-18** when §9.5 treats `101 Switching Protocols` as an immediate loud response-phase protocol error rather than waiting for a later HTTP final response.

**[convention]** A processor conforms to **OAPI30-P-19** when §10 keeps an operation whose artifact-derived completed target has a non-HTTP scheme addressable and represented while refusing that invocation before dispatch.

**[convention]** A processor conforms to **OAPI30-P-20** when §10 permits a conforming complete configured HTTP or HTTPS URL to replace that artifact-derived base and dispatch the otherwise unchanged operation.

**[convention]** A processor conforms to **OAPI30-P-21** when §8.3 excludes a non-token optional cookie-parameter projection without excluding the operation, allowing an invocation that omits it to dispatch.

**[convention]** A processor conforms to **OAPI30-P-22** when §8.3 treats the would-be caller key of that excluded optional cookie parameter as unknown input and refuses it before dispatch.

**[convention]** A processor conforms to **OAPI30-P-23** when §8.3 propagates a non-token required cookie parameter to an excluded target that remains addressable and refuses before dispatch.

**[convention]** A processor conforms to **OAPI30-P-24** when §9.4 propagates a non-token `required: true` response Header Object key to its response alternative and reports a successful response governed by it as a loud response-phase protocol error.

**[convention]** A processor conforms to **OAPI30-P-25** when §8.3 refuses before dispatch when an ordinary structured-cookie parameter's serialized value is not an RFC 6265 `cookie-value`.

**[convention]** A processor conforms to **OAPI30-P-26** when §6.1 admits a `default`-only Responses Object and uses that Response Object for an otherwise unmatched successful status.

**[convention]** A processor conforms to **OAPI30-P-27** when §§8.3 and 11 refuse any supplied ordinary-header or header-credential value that is not an RFC 9110 `field-value`, including leading or trailing SP or HTAB, and additionally require a raw `Cookie` field value to be an RFC 6265 `cookie-string`.

**[convention]** A processor conforms to **OAPI30-P-28** when §8.3 refuses an invocation that would combine any supplied raw Cookie source — a Header Parameter or selected header credential — with any structured cookie parameter or selected cookie credential.

**[convention]** A processor conforms to **OAPI30-P-29** when §9.5 confines invalid Response keys, values, and fixed members to their smallest projections without changing admitted-key precedence or removing an otherwise usable target; valid body and header siblings still govern, matched-but-excluded media fails loudly only when selected on success, and failure decoding remains best-effort.

**[convention]** A processor conforms to **OAPI30-P-30** when §9.4 groups surviving response Header declarations by ASCII-case-insensitive field identity, applies required presence and `Content-Encoding` constraints conjunctively, and excludes only a required coding group whose finite constraints are provably unsatisfiable.

**[convention]** A processor conforms to **OAPI30-P-31** when §9.3 groups Encoding Header declarations by ASCII-case-insensitive field identity, emits one coherent artifact-fixed value, and excludes a conflicting, unsafe, or required-nonfixed group at the media-alternative boundary.

**[convention]** A processor conforms to **OAPI30-P-32** when §11 confines statically unavoidable credential collisions to the smallest security alternative and preserves every non-colliding OR alternative.

**[convention]** A processor conforms to **OAPI30-P-33** when §11 checks actual serialized destinations and treats optional or runtime-derived parameter collisions as invocation-conditional rather than static exclusions.

**[convention]** A processor conforms to **OAPI30-P-34** when §§8.3 and 11 reserve each processor-owned header destination, including `Proxy-Authorization`, at the target or security-alternative boundary.

**[convention]** A processor conforms to **OAPI30-P-35** when §11 percent-encodes both an API-key query name and value with uppercase UTF-8 triplets.

**[convention]** A processor conforms to **OAPI30-P-36** when §11 preserves the unordered multiset of ordinary-parameter and credential query contributions and each contribution's fixed bytes.

**[convention]** A processor conforms to **OAPI30-P-37** when §10 excludes only an unusable declaration-derived Server alternative with query, fragment, empty HTTP host, or userinfo, permits a sibling or complete configured URL to recover, and refuses a nonconforming consumer choice before dispatch.

**[convention]** A processor conforms to **OAPI30-P-38** when §§7 and 11 emit neither content nor binding-carried credentials or Cookie fields on TRACE, preserve an anonymous alternative, and refuse or exclude the smallest unavoidable sensitive source before dispatch.

**[convention]** A processor conforms to **OAPI30-P-39** when §9.3 emits generated multipart `name` parameters with the pinned UTF-8 quoted-string escaping and excludes a name outside that admitted byte grammar.

**[convention]** A processor conforms to **OAPI30-P-40** when §9.5 strips binding-selected header credentials and Cookie contributions on a followed cross-origin redirect and never appends a binding-selected query credential to any redirect Location.

**[convention]** A processor conforms to **OAPI30-P-41** when §9.4 refuses a supplied request `Content-Encoding` field on a body-free invocation and excludes a required field only when no surviving request lane can emit a representation.

**[convention]** A processor conforms to **OAPI30-P-42** when §11 constructs HTTP-bearer, OAuth2, and OpenID Connect authorization from one valid RFC 6750 `b64token` and refuses every empty, non-Bearer-typed, or grammatically invalid token before dispatch.

**[convention]** A processor conforms to **OAPI30-P-43** when §9.4 validates no-content response `Content-Encoding` syntax and exact raw-string domains without requiring or invoking a decoder.

**[convention]** A processor conforms to **OAPI30-P-44** when §9.2 requires UTF-8 encoding and decoding, treats additional charset directions as independent capabilities, refuses an unavailable or failed request encoder before dispatch, and reports an unavailable or failed response decoder loudly.

**[convention]** A processor conforms to **OAPI30-P-45** when §9.4 derives response `Content-Encoding` raw-string domains through resolved `$ref`, recursive `allOf`, mixed-enum filtering, and conjunction, then applies every case-folded group's domains conjunctively at response time.

**[convention]** A processor conforms to **OAPI30-P-46** when §10 accounts a Server Variable Object with an absent or wrong-typed required `default` as `invalid` at its Server alternative while retaining a target recoverable through `configuration.server`.

**[convention]** A processor conforms to **OAPI30-P-47** when §10 excludes an empty variable `enum` or out-of-enum declaration default at its Server alternative while retaining siblings and complete-URL recovery.

**[convention]** A processor conforms to **OAPI30-P-48** when §10 permits an exact consumer substitution for an otherwise undeclared Server URL expression and reports a missing substitution as context-required on `configuration.server`.

**[convention]** A processor conforms to **OAPI30-P-49** when §10 refuses a consumer substitution outside a declared nonempty variable `enum` without changing synthesis coverage or weakening the selected Server Object.

**[convention]** A synthesizer conforms to **OAPI30-S-01** when it preserves §12.2's binding/transform boundary, emits §6.2's targetless unconstrained dependencies, accounts every lossy or non-equivalent Schema Object translation as coverage loss, and reports complete coverage under Core OBI-B-02.

**[convention]** A synthesizer conforms to **OAPI30-S-02** when it uses §3.2's locally defined status vocabulary for targets and subordinate projections without depending on any project interface contract.

**[convention]** A synthesizer conforms to **OAPI30-S-03** when §9.5's declared body projection for a no-content response is subordinate `excluded` coverage while the operation remains represented.

**[convention]** A synthesizer conforms to **OAPI30-S-04** when it reports §8.3's non-token cookie parameter and §9.4's non-token response Header Object key at their specified smallest owners and propagates only their required forms.

**[convention]** A synthesizer conforms to **OAPI30-S-05** when §6.1 represents an otherwise usable operation whose Responses Object is `default`-only and projects that fallback Response Object normally.

**[convention]** A synthesizer conforms to **OAPI30-S-06** when §8.3 propagates an unavoidable raw/structured Cookie collision to its smallest security alternative or target while retaining every non-colliding OR alternative.

**[convention]** A synthesizer conforms to **OAPI30-S-07** when §9.5 retains an operation and every valid response sibling while accounting each invalid or excluded response projection at its smallest owner.

**[convention]** A synthesizer conforms to **OAPI30-S-08** when §§8.3 and 11 remove only statically unavoidable parameter or credential combinations, preserve non-colliding OR alternatives, and never treat an optional collision as a static exclusion.

**[convention]** A synthesizer conforms to **OAPI30-S-09** when §10 retains a target recoverable from unusable Server alternatives and records its actual `configuration.server` requirement.

**[convention]** A synthesizer conforms to **OAPI30-S-10** when §11 excludes binding-carried credential alternatives from TRACE while retaining an anonymous alternative, and excludes the target only when no complete safe alternative remains.

**[convention]** A synthesizer conforms to **OAPI30-S-11** when §9.4 preserves coherent response Header groups and accounts a provably unsatisfiable required response `Content-Encoding` group at its response-alternative owner.

**[convention]** A synthesizer conforms to **OAPI30-S-12** when §9.3 preserves coherent Encoding Header groups and accounts a conflicting or required-nonfixed group at its media-alternative owner.

**[convention]** A synthesizer conforms to **OAPI30-S-13** when §9.3 accounts an unrepresentable multipart name at its media-alternative owner while preserving unrelated operations.

**[convention]** A synthesizer conforms to **OAPI30-S-14** when §9.4 accounts a required bodyless request `Content-Encoding` parameter at its target owner while preserving unrelated operations.

**[convention]** A synthesizer conforms to **OAPI30-S-15** when §10 accounts a Server Variable Object with an absent or wrong-typed required `default` as an `invalid` Server alternative while retaining a target recoverable through `configuration.server`.

**[convention]** A synthesizer conforms to **OAPI30-S-16** when §10 accounts an empty variable `enum` or out-of-enum declaration default as an `excluded` Server alternative while retaining a target recoverable through `configuration.server`.

**[convention]** A synthesizer conforms to **OAPI30-S-17** when §10 preserves a Server URL expression without a matching Server Variable Object, represents the target, and records its actual `configuration.server` requirement rather than excluding the alternative.

**[exclusion]** Every exclusion in this document is permanent under `openbindings.openapi-3.0@1`, belongs to the smallest owner stated beside it, and reopens only on its stated incorporated-authority trigger; no exclusion promises later work.

### 12.4 Permitted variation and stated limits

This subsection collects the points at which two conformant implementations of `openbindings.openapi-3.0@1` may still reach different results, and the boundaries this specification declines to cross. Like §2's item table it carries no provenance label, because it states no rule: every entry points at a labelled rule stated elsewhere in this document, and where an entry and its rule differ, the rule governs. It enumerates what this specification declares.

**Configuration points.** A consumer supplies each of the six, and none appears in the caller envelope or the operation contract.

| point | boundary | who chooses | when no choice is supplied |
| --- | --- | --- | --- |
| `requestMedia` (§9.1) | one concrete media type matching a declared request alternative under §9.1; it never substitutes another declaration's schema, and supplied values never elect | the consumer | one usable concrete entry selects itself; otherwise a missing, unmatched, or ambiguous choice refuses before dispatch, and no body bytes or examples are sniffed to select a lane |
| `server` (§10) | one effective Server alternative plus exact variable substitutions, or one complete consumer-configured `http` or `https` URL under the nonempty-host/no-userinfo/no-query/no-fragment constraints | the consumer | one effective server selects itself for member selection; a choice is required with several members, and a conforming complete URL is required when declarations alone leave no dispatchable `http` or `https` completion but replacement can recover it; an absent required choice refuses before dispatch while awaiting `configuration.server` |
| `security` (§11) | one complete declared alternative; fragments from different alternatives are never combined | the consumer | a sole declared alternative selects itself, and an effective `[]` or anonymous alternative counts as a complete no-security alternative; otherwise the invocation refuses before dispatch |
| `parameterConversion` (§8.1) | a deterministic JSON-scalar-to-string conversion, applied recursively to array members and object values before style serialization | the consumer | strings pass identically; a supplied boolean or number with no configured conversion refuses before dispatch. This specification defines no partial canonicalization default |
| `implicitConnectionScope` (§11) | `entry` or `referring` document resolution for Security Requirement names | the consumer | `entry`; unlike the other five points, an unsupplied choice here has a default rather than a refusal |
| `propertyMedia` (§9.3) | one concrete media type per affected form or multipart property, satisfying a declared member under §9.1 | the consumer | required when the Encoding `contentType` is a wildcard or a comma-separated list, when the resolved declaration is typeless and so has no default concrete type, or when the selected default defines no serialization for the resolved compound type; an absent, unmatched, or ambiguous required choice refuses before dispatch at the selected media alternative |

Under §12.1 every requirement is typed and discoverable from declarations, but preflightability is bounded: `requestMedia` and `parameterConversion` are conditional on supplied values, so a preflight can name them and their type and cannot know whether a given invocation will trigger them.

**Declared freedoms.** The points at which this specification declines to fix a result.

| freedom | stated at | what may differ | what holds across the difference |
| --- | --- | --- | --- |
| Query-contribution order | §8.2 | the order in which distinct effective parameters contribute to the query component | each parameter's own contribution is byte-fixed, and array-member order within one parameter is preserved; what this specification fixes about the completed request-target is the multiset of contributions, not one byte string |
| Multipart part order and form-field order across properties | §9.3 | the cross-property order of parts and of form-urlencoded fields; an implementation MAY emit a deterministic order and this binding requires none | property-to-name membership, and the order of the repeated parts one array property emits |
| Multipart boundary token | §9.3 | the boundary token itself, and the optional quoting the incorporated grammar permits for it on the media-type field | the entity framing itself — opening, inter-part, and closing delimiters — and that the token appears inside no encapsulated part |
| Cookie order | §11 | the order of structured cookie contributions within the joined value | membership, and the `name=value` spelling joined by `; ` |
| Redirect following and transport content negotiation | §9.5 | whether a runtime follows a redirect, and what it advertises in `Accept-Encoding`; two conformant runtimes MAY classify one wire history differently | classification is decided by the final status; a redirect followed with the bound method and complete body preserved remains this interaction, and a method-rewriting redirect is a final response of it |
| Elective retrieval on a content-carrying source | §4 | whether a processor dereferences a co-present `location` | nothing observable: `content` remains the interpreted artifact, and the two processors differ in no result this specification defines |
| A JSON-lane number outside binary64 | §9.2 | whether the supplied mathematical value is preserved as supplied or reduced to the nearest finite binary64 value | the permitted set has exactly these two members; no other deviation from the supplied value is permitted, and a conformant implementation never fails or refuses for range or precision alone |
| Charset support beyond UTF-8 | §9.2 | which further charset encoders or decoders an implementation supplies | UTF-8 is always supported in both directions; request absence or failure refuses before dispatch and response absence or failure is loud |
| Content-coding capability | §9.4 | which content codings a runtime can encode and decode | the actual field still fixes the ordered stack; an absent capability refuses before dispatch on a request and fails loudly on a response, and no coding is skipped or inferred from an artifact declaration |
| Synthesis policy | §6.2, §12.2 | operation and dependency key spelling, the dependency contract's shape, flattening, output-schema choice, and Schema Object translation | the callback dependency's role-inverted input and output meaning, the `inputTransform`'s construction of §7's envelope, and coverage-loss accounting for every lossy or non-equivalent translation |
| JSON-lane request-body serialization | §9.2 | the serialized bytes of any JSON image this specification emits — a JSON-lane request body, a content-form parameter value, or a compound form or multipart property riding as `application/json`: object member order, insignificant whitespace, which of `\uXXXX` or a literal the escapable characters take, and the lexical spelling of a number whose value is fixed | the JSON **value** is identical, which is what this specification fixes and what every rule of it is stated over; RFC 8259 constrains the grammar and not the choice among its equivalent spellings, so this latitude reaches wire bytes and reaches no value, no assertion, and no outcome |

**Exclusions and their reopen triggers.** Each removes something from the accepted domain permanently under this identifier, at the smallest owner stated beside the rule.

| stated at | what leaves the accepted domain | reopens only if |
| --- | --- | --- |
| §5.1 | a selected operation whose Path Item `$ref` collides with its adjacent declaration in a fixed field that target uses | an incorporated OAS edition defines the collision |
| §7 | a target with two effective header parameters whose names differ only by ASCII case | an incorporated authority defines a wire mapping that preserves the distinction |
| §8.2 | a parameter whose effective `style`/`explode` row is wholly `n/a`, `deepObject` with a defaulted `explode` included | an incorporated authority defines that exact combination |
| §8.2 | a compound-capable style whose resolved declaration proves an unsupported compound member | an incorporated authority defines that exact cell |
| §8.3 | a non-token effective header parameter name, confined to that projection unless it is required and therefore excludes its target | incorporated HTTP authority admits that exact field-name form |
| §8.3 | a non-token effective cookie parameter name, confined to that projection unless it is required and therefore excludes its target | incorporated cookie authority admits that exact cookie-name form |
| §8.3 | a target with an effective header parameter named `Host`, `Content-Length`, `Connection`, `Keep-Alive`, `Proxy-Authorization`, `Proxy-Connection`, `TE`, `Trailer`, `Transfer-Encoding`, or `Upgrade` | an incorporated HTTP authority defines caller control that preserves the processor's connection, framing, and routing obligations |
| §8.3 | a target with required raw and structured Cookie parameters, or a security alternative with unavoidable opposite-kind Cookie credentials/required parameters | incorporated authority defines a coherent raw/structured Cookie merge |
| §8.3 | a target with a form-style cookie declaration that produces multiple values | an incorporated OAS edition defines a correct multi-value mapping |
| §9.1 | a Request Body Object declaring `required: true` with an empty `content` map | an incorporated OAS edition defines that behavior |
| §9.2 | generating XML from an object model, at the selected media alternative; string and raw-octet XML carriage remain admitted | an incorporated authority defines ordering, escaping, nulls, dynamic keys, and scalar lexical forms |
| §9.2 | a concrete request or response selection admitted by none of §3.2's five lanes, at its smallest media owner | an incorporated authority defines that media/data-form cell |
| §9.3 | a response selection of the form or multipart lane, at its smallest media owner | an incorporated authority defines that decoding |
| §9.3 | a multipart media alternative with a property name unrepresentable as the `name` parameter, CR or LF included | an incorporated authority defines an unambiguous encoding |
| §9.3 | a non-ignored `Content-Disposition` value that is unsafe, is not `form-data`, or names a different property | an incorporated authority defines a different unambiguous property-to-part mapping |
| §9.3 | a non-ignored Encoding header group with an invalid name, unsafe value, conflicting fixed values, a fixed-value rejection, or required status without one exact value | an incorporated authority admits the field form or defines a different safe composition or caller part-header carriage |
| §9.3 | a `format: byte` part whose explicit Encoding `Content-Transfer-Encoding` declaration disallows `base64` | an incorporated OAS edition defines serialization and parsing for the conflict |
| §9.3 | a multipart media type other than `multipart/form-data` | an incorporated OAS edition defines property-to-part correlation for unnamed ordered parts |
| §9.4 | a non-token response Header Object key, confined to that projection unless `required: true` propagates exclusion to its response alternative | incorporated HTTP authority admits that exact field-name form |
| §9.4 | a required request `Content-Encoding` parameter after no surviving request lane can emit a representation | incorporated HTTP authority defines Content-Encoding on a request with no representation |
| §9.4 | a required response `Content-Encoding` case-group whose binding-understood finite raw-string domains have an empty intersection | incorporated OAS authority defines a different co-present constraint composition |
| §9.5 | a response-body projection that can govern only HEAD, `1xx`, `204`, `205`, or `304` | incorporated HTTP authority permits content for that case |
| §10 | a declaration-derived Server alternative with an empty variable `enum` or an out-of-enum default | an incorporated OAS edition defines the excluded declaration's unique substitution |
| §10 | targets beneath a Paths key containing a literal `?` or `#` | incorporated OAS authority defines that key's target mapping |
| §10 | a Server alternative whose declaration-derived expansion contains a query or fragment | an incorporated OAS edition defines that exact cell |
| §10 | a declaration-derived absolute HTTP Server alternative with an empty host or userinfo | incorporated HTTP authority permits such target generation |
| §11 | wire carriage of an access-token type other than Bearer; no artifact declaration is removed, so this exclusion reaches no synthesis or coverage entry | an incorporated authority defines another token type's carriage |
| §11 | an `apiKey` security alternative whose header name is not an HTTP `token` or whose cookie name is not a cookie-name `token` | incorporated authority admits the exact destination-name form |
| §11 | a security alternative with two credentials sharing one destination, a credential colliding with a required fixed-destination parameter, or a credential targeting a binding/processor-owned field; the target only when no complete alternative remains | incorporated authority defines a safe, unambiguous assembly for the exact collision |
| §11 | a TRACE security alternative that emits credentials, or a TRACE target with a required Cookie parameter | incorporated HTTP authority permits sensitive fields on TRACE |
| §12.3 | standing rule: every exclusion above is permanent under `openbindings.openapi-3.0@1`, belongs to the smallest owner stated beside it, and promises no later work | its own stated incorporated-authority trigger fires |
| §5.1 | a retrieved document encoded in UTF-16 or UTF-32, which YAML 1.2.2 §5.2 obliges a processor to support | an incorporated authority defines a declaration surface stating a retrieved document's character encoding without inspecting its bytes |

**Stated limits.** Each `[limit]` rule of this document, with what it declines to cover or confines.

| stated at | what is not covered |
| --- | --- |
| §3.2 | the load gates are exactly four and in that order; no condition outside the set is a load gate |
| §3.2 | a defect confines to its smallest owning unit, and an unreachable defect destroys no target |
| §3.2 | no rule reads an excluded unit's declarations; a selector naming an excluded target still resolves, and the invocation refuses before dispatch |
| §3.2 | after the load gates, source refusal is limited to a missing or malformed required inventory surface, or inventory/reference defects that prevent every declared target slot from becoming addressable; target-confined invalidity never aggregates into it |
| §3.2 | an addressable-but-unusable target never becomes a source refusal |
| §3.2 | no source-scope exclusion exists: nothing is filtered merely by its position in the source |
| §3.2 | an unknown non-extension field creates no binding behavior, and an `x-` extension stays an inert annotation |
| §5.1 | an unresolvable reference reachable only from an unused description position leaves invocation unaffected and is coverage loss only |
| §5.1 | a defect outside the target-plus-reachable closure has no effect on that target |
| §5.1 | the three confinement conditions confine as §5.1's table order states |
| §6.2 | dependencies add no invocation behavior; receiver deployment and dependency composition are permanently outside this operation boundary |
| §7 | on a content-forbidding method a `required: true` request body creates no caller-body requirement, and the declaration is reported as coverage loss |
| §9.1 | content-map keys that normalize to one media identity support no selection through that identity |
| §9.1 | examples create no operation input or output member and never select a declaration, lane, or media type |
| §9.2 | JSON-lane numbers are interoperable within RFC 8259 §6's binary64 expectation, over the two-member permitted set indexed above |
| §9.2 | a charset direction beyond UTF-8 is an independent implementation capability; request-encoder absence or failure refuses before dispatch, while response-decoder absence or failure is a loud response error |
| §9.3 | a non-object form declaration and a multipart alternative without its required schema are upstream-invalid and removed at their smallest owners, accounted invalid |
| §9.3 | `{}` and `{"x": null}` are identified on the form and multipart wire: the absent-versus-explicit-null distinction does not survive that lane |
| §9.3 | artifact-fixed safe Encoding headers are emitted verbatim; a required nonfixed header is excluded, an optional nonfixed header remains descriptive, and no caller channel for part headers exists under this identifier |
| §8.3 | a supplied structured-cookie parameter whose serialized value is not an RFC 6265 `cookie-value` refuses before dispatch; no escaping or repair is inferred |
| §9.5 | invalid Response values and members remain subordinate coverage loss; admitted keys retain precedence, empty successful responses emit no output, undecodable non-empty successful responses fail loudly, and failure data is best-effort |
| §9.5 | an omitted or non-string `description` is an invalid documentary projection and coverage loss only; it never changes lookup, target representation, or invocation behavior, and every valid content or header sibling still governs |
| §9.5 | redirect and negotiation variance is the stated permitted set, and the binding emits no negotiation field beyond those it pins |
| §9.5 | header carriage is outside the operation-value boundary; a missing declared required header is a loud protocol error |
| §9.5 | a non-empty successful response with no governing Response Object is a loud protocol error; an unsuccessful one completes with no failure data or added protocol error; Response Header and Link Objects create no output members, so even a declared `Location` on a `201` reaches no operation value |
| §9.5 | one HTTP response body produces at most one operation value, `text/event-stream` included |
| §10 | embedded content with no document location leaves a relative Server URL unresolved; the complete configured URL is the available recovery |
| §10 | a completed target with a non-HTTP scheme refuses before dispatch but remains represented and recoverable; no declaration is excluded |
| §10 | a Server Variable Object missing or wrong-typing its required `default` is upstream-invalid and confined to its Server alternative, while the target remains represented when complete-URL recovery exists |
| §11 | a nonempty requirement array for a scheme type other than OAuth 2.0 or OpenID Connect is an upstream-invalid declaration that removes only that alternative from selection, accounted invalid under §12.2 |
| §11 | any other declared HTTP authentication scheme synthesizes no credential bytes, and its alternative is unusable unless the runtime satisfies it as a complete prerequisite |
| §12.2 | the envelope is the binding-boundary value and never the emitted operation contract; no input-restructuring apparatus beyond §12.2's licensed synthesis outputs exists |
| §6.1 | a selected operation omitting `responses`, or carrying a Responses Object with neither a patterned response-code field nor `default` — an empty or extension-only object included: an upstream-invalid declaration confined to its stated owner and accounted invalid; reopens only if an incorporated OAS 3.0 edition admits the exact declaration |
| §7 | an operation with duplicate effective parameters at one name-plus-location identity: an upstream-invalid declaration confined to its stated owner and accounted invalid; reopens only if an incorporated OAS edition admits such duplicates |
| §8.2 | each selected operation on a Path Item participating in equivalent-hierarchy path-key ambiguity: an upstream-invalid declaration confined to its stated owner and accounted invalid; reopens only if an incorporated authority admits the declaration or defines its unique target mapping |
| §8.2 | a selected target with a path-template expression lacking a corresponding effective `path` parameter: an upstream-invalid declaration confined to that target and accounted invalid |
| §8.3 | a target carrying a selected effective Parameter Object that violates §8.3's closed declaration list: an upstream-invalid declaration confined to its stated owner and accounted invalid; reopens only if an incorporated OAS 3.0 edition admits the malformed declaration or defines its wire meaning |
| §9.3 | a non-object form declaration or a `multipart/form-data` alternative without its required schema: an upstream-invalid declaration confined to its smallest owner and accounted invalid; reopens only if an incorporated edition removes the constraint |
| §9.5 | a Responses key outside the closed admitted set: subordinate invalid coverage ignored for lookup; if no admitted response declaration survives, the enclosing target is invalid; reopens only if an incorporated OAS 3.0 edition admits that exact key form |
| §9.5 | an admitted response key carrying an upstream-invalid Response value or fixed member: invalidity confined to the smallest response alternative or projection, without changing lookup precedence or target addressability; reopens only if an incorporated OAS 3.0 edition admits the exact declaration |
| §11 | every security alternative naming a Security Scheme Object that is not one — a missing or unlisted `type`, or an absent or wrong-typed field its `type` makes REQUIRED; a target left with no complete alternative is itself excluded: an upstream-invalid declaration confined to its stated owner and accounted invalid; reopens only if an incorporated OAS 3.0 edition admits the exact declaration |

## 13. Normative references

- [OpenAPI Specification 3.0.0](https://spec.openapis.org/oas/v3.0.0.html)
- [OpenAPI Specification 3.0.1](https://spec.openapis.org/oas/v3.0.1.html)
- [OpenAPI Specification 3.0.2](https://spec.openapis.org/oas/v3.0.2.html)
- [OpenAPI Specification 3.0.3](https://spec.openapis.org/oas/v3.0.3.html)
- [OpenAPI Specification 3.0.4](https://spec.openapis.org/oas/v3.0.4.html)
- [YAML 1.2.2](https://yaml.org/spec/1.2.2/)
- [JSON Reference draft-03](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03)
- [RFC 1738](https://www.rfc-editor.org/rfc/rfc1738)
- [RFC 1866](https://www.rfc-editor.org/rfc/rfc1866)
- [RFC 2046](https://www.rfc-editor.org/rfc/rfc2046)
- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119)
- [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)
- [RFC 4648](https://www.rfc-editor.org/rfc/rfc4648)
- [RFC 5789](https://www.rfc-editor.org/rfc/rfc5789)
- [RFC 6265](https://httpwg.org/specs/rfc6265.html)
- [RFC 6570](https://www.rfc-editor.org/rfc/rfc6570)
- [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749)
- [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750)
- [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838)
- [RFC 6839](https://www.rfc-editor.org/rfc/rfc6839)
- [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)
- [RFC 7231](https://www.rfc-editor.org/rfc/rfc7231)
- [RFC 7303](https://www.rfc-editor.org/rfc/rfc7303)
- [RFC 7617](https://www.rfc-editor.org/rfc/rfc7617)
- [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)
- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)
