# `openbindings.openapi-3.1` Binding Specification

**Status: unreleased `@1` candidate.** This mutable page does not mint `openbindings.openapi-3.1@1`. Its remaining publication gate is the explicit promotion and reference-tooling adoption change required by the [binding-specification lifecycle](../README.md#publication-lifecycle); until then, implementations may cite it only as a candidate, not as a published OpenBindings identifier.

## 1. Identifier and rule labels

**[convention]** The opaque binding-specification identifier has exactly the spelling **`openbindings.openapi-3.1@1`**.

**[convention]** OpenBindings Project publication mints §1's proposed identifier; before that project lifecycle event, this page is a mutable candidate and the identifier is not project-published.

**[incorporated]** Once minted, the identifier is exact and stable under Core [OBI-B-01](../../openbindings.md#104-binding-specification-rules), and an incompatible change to the accepted domain or portable meaning requires a different identifier under Core [OBI-B-03](../../openbindings.md#104-binding-specification-rules).

**[incorporated]** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) only when they appear in all capitals.

**[convention]** Every normative paragraph and normative table row carries one visible provenance label. An `incorporated` rule is one the cited source states, and the citation names that source, whether an incorporated authority or the OpenBindings Core; the remaining five are this specification's own explicitly classified bridge. A `convention` is a choice this specification makes where no authority speaks; a `pin` fixes one reading of an ambiguous or versioned authority; a `configuration point` names a decision deferred to the consumer; an `exclusion` removes something from the accepted surface behind a stated reopen trigger; a `limit` states a boundary this specification does not cross.

## 2. Scope and incorporated authorities

**[convention]** This binding specification defines how OpenAPI 3.1 artifacts govern OpenBindings sources: which documents are accepted and when loading refuses, how operation targets are addressed and synthesized, what an invocation's inputs and outputs mean, and which wire mechanics the artifact fixes. It builds on the OpenBindings Core specification (`../../openbindings.md`).

**[convention]** This specification accepts exactly OpenAPI Specification (OAS) editions [`3.1.0`](https://spec.openapis.org/oas/v3.1.0.html), [`3.1.1`](https://spec.openapis.org/oas/v3.1.1.html), and [`3.1.2`](https://spec.openapis.org/oas/v3.1.2.html); no wildcard or compatible-looking value widens this closed set.

**[convention]** Within that closed set, observable behavior MUST NOT turn on the patch component: each accepted edition instructs tooling to support the `3.1.*` feature set uniformly and not distinguish patch versions ([OAS 3.1.0 §4.1](https://spec.openapis.org/oas/v3.1.0.html#versions), [3.1.1 §4.1](https://spec.openapis.org/oas/v3.1.1.html#versions), [3.1.2 §4.1](https://spec.openapis.org/oas/v3.1.2.html#versions)).

**[pin]** For every rule in this specification the governing OAS text is the highest-numbered accepted edition's, whatever accepted patch value the artifact declares; the declared value is an admission gate only, never an edition selector. This pin is unconditional: it governs where the accepted editions contradict one another, where a later edition corrects an earlier one, and equally where a later edition states what an earlier one leaves unsaid. §§3.8, 5.5 and Appendix D.1 of the governing text are examples of the last case — 3.1.0 carries none of them — and every rule this document derives from them is therefore stated once, for all three accepted editions. Nothing in this pin reads on the artifact's own conformance to the edition it declares.

**[convention]** That governing-text pin does not widen the closed accepted domain beyond §2's three exact values.

**[convention]** OAS governs the artifact and every HTTP mechanic it declares, including object structure, reference resolution, parameter serialization, media declarations, server selection, responses, and security ([OAS 3.1.2 §4.8](https://spec.openapis.org/oas/v3.1.2.html#schema-0)); [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) governs the remaining HTTP semantics.

**[convention]** Every other authority named in §13 is incorporated at the scope its citation states, immutably at the revision cited. Where two incorporated authorities answer one decision differently, this specification states the precedence at that decision rather than in the abstract, and discloses the losing reading there. Three such decisions exist: OAS's Style Examples against RFC 6570 expansion (§8.1), RFC 8259's UTF-8 requirement against the UTF-16/UTF-32 latitude RFC 6839's `+json` registration inherits (§9.2), and RFC 6838 §4.2.1's UTF-8 default for new `text/*` registrations against RFC 2046's US-ASCII `text/*` default (§9.2). No incorporated authority is consulted in a live or mutable form.

**[incorporated]** This document defines portable binding meaning, not an invocation API: request objects, retry and redirect APIs, cancellation, credential acquisition, receiver deployment, and dependency composition remain runtime or application concerns under Core [§1.2](../../openbindings.md#12-out-of-scope).

**Where Core's completeness items are discharged.** Core [OBI-B-02](../../openbindings.md#104-binding-specification-rules) names seven things a binding specification defines for the sources and bindings it governs. The table below maps each to the sections that carry it. The third column names what this specification does not cover at that item: a point at which it states no portable meaning. It does not claim that no rule in this document reaches the surrounding subject. The table is a reader's map, not a rule: it carries no provenance label, states no requirement, and neither widens nor narrows the accepted domain. Where the table and a numbered section disagree, the section governs.

| Core OBI-B-02 item | Carried by | what this specification does not cover there |
| --- | --- | --- |
| 1 — whether a source mode accepts an artifact, the representations accepted, deterministic discrimination between them, and the encoding for any non-JSON artifact | §2, §3.1, §3.2, §4, §5.2 | nothing recorded: §4's limit states the acquisition-failure disposition and defers the success condition to the address scheme. |
| 2 — the syntax and meaning of `location` | §3.1, §4 | nothing recorded: §4's limit states the acquisition-failure disposition and defers the success condition to the address scheme. |
| 3 — the accepted values and meaning of `content`, including any source mode in which `content` is forbidden | §3.1, §3.2, §4 | nothing recorded. §4 states the empty forbidden set beside its acceptance rule, so the clause is answered in the affirmative direction rather than left to entailment. |
| 4 — how `location` and `content` compose within the content-primacy floor, including whether `location` supplies a reference base for embedded content | §3.1, §4, §10 | nothing recorded. |
| 5 — the syntax and meaning of `selector`, including the absent-`selector` case | §3.2, §5.1, §6.1, §12.3 | nothing recorded. §3.2's outcome vocabulary names the outcome for a selector that reaches no addressable target and §6.1 states that disposition, while §3.2's own excluded-unit rule separates that outcome from an excluded target by saying that a selector naming one still resolves. The absent case is reached by §6.1's REQUIRED together with OAPI31-D-02, which is where its consequence is stated. |
| 6 — how the binding target and its interaction are identified | §3.2, §4, §5.1, §5.2, §6.1, §6.2, §7, §8.1, §8.2, §8.3, §9.5, §10, §11, §12.1, §12.3 | nothing recorded. |
| 7 — how caller-facing input and successful output values correspond to the source interaction, which outcomes are successes, when the interaction instead completes unsuccessfully, how values emitted before that completion are treated, and any context bindings at transform positions | §3.2, §4, §5.1, §5.2, §7, §8.1, §8.2, §8.3, §9.1, §9.2, §9.3, §9.4, §9.5, §11, §12.1, §12.2 | nothing recorded. The context-bindings clause is reached by exactly one rule, in §12.2. |

**[convention]** Where §2's item map records that a chain is not completed in this revision, that record licenses nothing. It is not a permitted variation, and this specification states no portable meaning there. An implementation may complete such a point locally; that completion is implementation-defined under Core [§6](../../openbindings.md#6-binding-specifications) and is not attributed to this identifier.

**[convention]** OBI-B-02 is a floor, not a partition, and this document carries content above it. A rule no item above reaches is not thereby surplus. §11's credential-construction rules — the authentication-scheme token comparison, the `basic` `Authorization` construction, `apiKey` emission at its declared destination, `mutualTLS` as a transport prerequisite, the Bearer carriage rule and its non-Bearer runtime counterpart, and the other-scheme prerequisite limit — fix observables this specification is answerable for, from emitted credential bytes to whether a selected alternative is usable, while serving no item: item 7 reaches caller-facing input and output values, and §11 itself states that credential values never become either, while item 6's verb reaches which requirement governs and no further. They are recorded here as content above the floor rather than as a gap, and §12.4 indexes the freedoms and limits among them.

## 3. Source carriage and refusal architecture

### 3.1 Accepted representations

**[convention]** `content` is either the parsed OpenAPI document object or string content; `location` is an absolute URI for the OpenAPI document; content has primacy, a co-present location supplies its base URI, and the OBI retrieval URI is never that base (Core [§5.4](../../openbindings.md#54-sources), [§7](../../openbindings.md#7-reference-resolution)).

**[pin]** String content MUST parse as YAML 1.2.2, of which JSON is a subset; duplicate mapping keys, non-scalar-string mapping keys, explicit tags outside YAML's JSON-compatible tag set, resolved values with no JSON image (`.inf`, `-.inf`, `.nan`), and a multi-document YAML stream refuse at this grammar gate. Exactly one YAML document is accepted ([YAML 1.2.2 §§3.2.1, 10.2.1, 10.3.2](https://yaml.org/spec/1.2.2/)).

**[pin]** Plain-scalar tag resolution uses YAML 1.2.2's recommended Core schema and no other, a disclosed widening of the line's JSON-schema tag gate: the two schemas share a tag set but not a resolution, so `True`, `0x3A`, and `.5` resolve to a boolean, an integer, and a float here where JSON-schema resolution would terminate in an error. Core resolution is pinned because JSON-schema resolution rejects plain scalars widely deployed YAML readers accept; the widening admits values, never rejects them, and every admitted value must still have a JSON image under the preceding rule ([YAML 1.2.2 §§10.2.2, 10.3.2](https://yaml.org/spec/1.2.2/#1032-tag-resolution), widening [OAS 3.1.2 §4.2](https://spec.openapis.org/oas/v3.1.2.html#format)).

**[pin]** A leading byte-order mark on string content is accepted and consumed by the YAML grammar; it is never part of the document.

**[incorporated]** The tag gate implements the line's corrected format rule: "Tags MUST be limited to those allowed by YAML's JSON schema ruleset." The same section states the key rule as "Keys used in YAML maps MUST be limited to a scalar string, **as defined by the YAML Failsafe schema ruleset**" ([OAS 3.1.2 §4.2](https://spec.openapis.org/oas/v3.1.2.html#format)).

**[pin]** Key resolution follows that qualifier and differs from value resolution: the Failsafe ruleset's only scalar tag is `tag:yaml.org,2002:str`, so a plain scalar key never refuses on its resolved type and an unquoted `200:` Responses key is the string `200`. A key that is not a scalar at all — a sequence or a mapping in key position — refuses at the key gate. The key/value asymmetry is the edition's; the consequence of violating the key rule is pinned here ([YAML 1.2.2 §10.1.1](https://yaml.org/spec/1.2.2/#1011-tags), [OAS 3.1.2 §4.2](https://spec.openapis.org/oas/v3.1.2.html#format)).

**[incorporated]** The root MUST be a JSON object with the required `openapi` field ([OAS 3.1.2 §§4.2, 4.8.1.1](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields)).

**[convention]** That field MUST be exactly `3.1.0`, `3.1.1`, or `3.1.2`; an absent, mismatched, or unlisted value refuses at load under §2's closed accepted domain.

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

**[limit]** How a processor names or presents a confined defect is not portable meaning of this identifier. It MUST identify the affected unit and responsible declaration position well enough to make the confinement observable, but this specification defines no defect-class taxonomy, per-class authority citation, or per-defect coverage-entry vocabulary.

**[limit]** An **excluded** unit, and equally a unit removed as **invalid**, is removed from the effective declarations consumed below its owning boundary: no serialization, routing, or translation rule reads it as usable input. Removal does not erase a structurally addressable target slot. A selector naming an invalid or excluded target still resolves and invocation refuses before dispatch. A target whose remaining effective declarations no longer satisfy §8's path-template correspondence is itself excluded.

**[incorporated]** A conforming artifact that declares no operation target is accepted and synthesizes no operation: a Paths Object and a Path Item Object may each be empty, and the root may instead contain `components` or `webhooks` ([OAS 3.1.2 §§4.8.1, 4.8.8, 4.8.9](https://spec.openapis.org/oas/v3.1.2.html#openapi-object)).

**[incorporated]** An OpenAPI Description MUST contain at least one of `paths`, `components`, or `webhooks`; a root omitting all three is upstream-invalid, unlike any present-but-empty surface above ([OAS 3.1.2 §§3.1, 4.8.1.1](https://spec.openapis.org/oas/v3.1.2.html#openapi-object)).

**[limit]** **§3.2's source-refusal rule**: after the closed load gates, a source refuses as a source when the required root inventory surface is missing or malformed, or when the artifact declares at least one target slot but inventory or reference defects prevent every slot from becoming addressable. A target-confined invalidity or exclusion never contributes to this aggregation: even when every addressable target is invalid or excluded, the source remains accepted and each selector still resolves to its own pre-dispatch refusal. A valid present-but-empty surface is accepted and synthesizes zero operations. OAS 3.1.2 requires at least one of `paths`, `components`, or `webhooks`, so a source omitting all three refuses as a source ([OAS 3.1.2 §§3.1, 4.8.1.1](https://spec.openapis.org/oas/v3.1.2.html#openapi-object)).

**[limit]** A target that is addressable but unusable because of a missing choice, unsupported alternative, or exclusion refuses before dispatch or is reported as synthesis coverage loss; it never becomes a source refusal.

**[limit]** This revision has one source-scope exclusion: §5.2 excludes a source whose root `jsonSchemaDialect` selects an unincorporated dialect. That upstream-valid feature exclusion is distinct from §3.2's defect-derived source refusal. No source member or addressable target is otherwise filtered merely by its position in the source.

**[limit]** An unknown non-extension field creates no binding behavior, and this specification supplies none for it: the consequence confines to the smallest owning unit that depends on it, while an unused unknown field affects no target. An `x-` specification extension remains an inert annotation under this identifier, and no unknown member is guessed into a fixed or patterned field ([OAS 3.1.2 §4.9](https://spec.openapis.org/oas/v3.1.2.html#specification-extensions)).

**[convention]** A root `swagger` member co-present with this specification's conforming `openapi` value is such an unknown non-extension root member: it is inert, gates nothing, and cedes the document to no sibling specification.

## 4. `location`, `content`, and composition

**[incorporated]** A present `location` MUST be an absolute URI addressing the OpenAPI document itself; a bare filesystem path is not conformant (Core [OBI-D-05](../../openbindings.md#102-document-rules)).

**[convention]** For a location-only source the dereference is required and MUST yield an accepted representation; a representation outside §3.1's two refuses at load, at the accepted-representation gate. Where `content` is co-present a processor MAY retrieve from `location` and MAY decline to; `content` remains the interpreted artifact and is never silently replaced, the retrieved bytes establish nothing but the base URI's identity, and a failed, unreachable, or non-conforming retrieval has no effect on the interpreted artifact and no outcome of its own. Retrieval is therefore never observable on a content-carrying source, and the two processors differ in no result this specification defines (Core [§5.4](../../openbindings.md#54-sources)).

**[limit]** Whether that dereference yields a representation at all is the address scheme's own affair: this specification incorporates no retrieval protocol and states no condition of its own for acquisition success, so an HTTP status, a `file://` open error, a name-resolution failure, or a transport failure is decided by the scheme that owns the absolute URI. Octets that arrive are gated as the preceding rule states; a dereference that yields nothing reaches no load gate, leaves §3.2's closed set unchanged, and the invocation refuses before dispatch for want of a source, with the no-observable-side-effect guarantee. How the acquisition failure is reported alongside that refusal is diagnostic and not portable meaning of this identifier.

**[convention]** A present `content` MUST be one of §3.1's two representations, and no other JSON type is accepted.

**[convention]** No source mode this specification governs forbids `content`: Core [§5.4](../../openbindings.md#54-sources) admits `location` alone, `content` alone, and both co-present, the location-only mode is one in which `content` is absent rather than prohibited, and the set of `content`-forbidding modes Core [OBI-B-02](../../openbindings.md#104-binding-specification-rules) item 3 asks for is empty by decision.

**[incorporated]** Relative references in Schema Objects, `$id` values included, use the nearest parent `$id` as their base URI. Relative references in every other Object, **and in Schema Objects where no parent schema contains an `$id`**, MUST resolve against the referring document's base URI. A fragment SHOULD be interpreted as a JSON Pointer when the referenced document's representation is JSON or YAML ([OAS 3.1.2 §§4.3, 4.6](https://spec.openapis.org/oas/v3.1.2.html#relative-references-in-api-description-uris), [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)).

**[pin]** This specification pins that SHOULD to a requirement with one carve-out, so that fragment interpretation is decidable without inspecting the target: a fragment reached from a Schema Object reference position that is neither empty nor begins with `/` is a JSON Schema 2020-12 plain-name fragment and resolves against the `$anchor` and `$dynamicAnchor` declarations of the schema resource its base identifies; every other fragment, in every other position, is a JSON Pointer. A plain-name fragment matching no anchor in that resource is unresolvable and confines under §5.1. The carve-out is the reading under which OAS's SHOULD stays true of Schema Objects, whose keywords this edition takes from JSON Schema ([OAS 3.1.2 §4.8.24](https://spec.openapis.org/oas/v3.1.2.html#schema-object), [JSON Schema Core §§8.2.2, 8.2.3.2](https://json-schema.org/draft/2020-12/json-schema-core.html#section-8.2.2)).

**[convention]** Embedded content without a co-present `location` MUST be self-contained; a location-only source uses its location as the entry-document base (Core [§7](../../openbindings.md#7-reference-resolution)).

## 5. References, dialects, and confinement

### 5.1 Reference semantics

**[convention]** A reference composes its target plus the transitive closure of references reachable from that target, not unrelated material in the same retrieved document. No accepted edition states that composition rule; this specification adopts it so that a selected target's closure is decidable ([OAS 3.1.2 §§4.3.1, 4.6](https://spec.openapis.org/oas/v3.1.2.html#parsing-documents)).

**[incorporated]** A referenced document need not itself be a conforming OpenAPI Document: the edition's own detection list admits a JSON Schema document and a document carrying a referenceable Object at its root beside an OpenAPI document ([OAS 3.1.2 §4.3.1](https://spec.openapis.org/oas/v3.1.2.html#parsing-documents)).

**[pin]** Every document this binding retrieves — the primary `location` dereference of §4 and every secondarily retrieved reference document alike — decodes its bytes as UTF-8 and passes the same grammar gate as §3.1 string content; the retrieval's `Content-Type` and any charset parameter are never consulted, and a byte sequence that is not valid UTF-8 does not yield an accepted representation: for the entry artifact that is a refusal at load at the accepted-representation gate, and for a secondarily retrieved document it is the unresolvable reference §5.1 states.

**[exclusion]** That rule narrows [YAML 1.2.2 §5.2](https://yaml.org/spec/1.2.2/#52-character-encodings), which obliges a YAML processor to accept UTF-8, UTF-16, and UTF-32 input with a byte-order mark deciding among them: this specification supports UTF-8 alone and lets no byte-order mark select an encoding, because a binding that never sniffs body bytes cannot take an encoding decision from them, and [RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1) already requires UTF-8 of JSON text exchanged outside a closed ecosystem. A document encoded in UTF-16 or UTF-32 leaves the accepted domain — the whole source where the entry artifact is so encoded, the referring selection alone where a secondarily retrieved document is. This reopens only if an incorporated authority defines a declaration surface stating a retrieved document's character encoding without inspecting its bytes.

**[pin]** A retrieved reference document's base URI, absent a base the document itself establishes, is its retrieval URI in the authority's current-actual-location sense: the final URI after any redirects, never a user-supplied expected location ([OAS 3.1.2 §4.6](https://spec.openapis.org/oas/v3.1.2.html#relative-references-in-api-description-uris)).

**[incorporated]** Before a Schema Object reference may be deemed unresolvable, its complete containing document MUST be parsed for schema resources, reference targets, and keywords that establish or change a base URI ([OAS 3.1.2 §4.3.1](https://spec.openapis.org/oas/v3.1.2.html#parsing-documents)).

**[convention]** When one JSON or YAML node is reached from reference positions requiring different OAS Object types, each reference context interprets the node independently as its own required Object type; this is the deterministic choice within OAS's implementation-defined multi-context license ([OAS 3.1.2 §4.3.2](https://spec.openapis.org/oas/v3.1.2.html#structural-interoperability)).

**[incorporated]** A Schema Object `$ref` is the JSON Schema applicator and its siblings remain meaningful; a Reference Object has only its fixed `$ref`, `summary`, and `description` fields, and every added property is ignored ([OAS 3.1.2 §§4.8.23, 4.8.24](https://spec.openapis.org/oas/v3.1.2.html#reference-object)).

**[pin]** OAS's lowercase statement that tooling must detect and handle cycles to prevent resource exhaustion, non-normative under §1's BCP 14 clause, is pinned to a requirement: reference traversal MUST detect cycles without resource exhaustion, a cyclic but resolvable graph is legitimate, and cycle detection terminates traversal rather than truncating the graph and is not itself a refusal ([OAS 3.1.2 §5.5](https://spec.openapis.org/oas/v3.1.2.html#handling-reference-cycles)).

**[pin]** A Path Item `$ref` is not a Reference Object for sibling purposes: OAS gives the Path Item its own `$ref` fixed field and calls a field appearing in both the referenced and the adjacent object undefined, which presupposes that both declarations exist, and this specification pins the merge that presupposition implies. The **effective Path Item** is the referenced Path Item overlaid with every adjacent field the referenced Path Item does not itself declare: non-colliding adjacent fields contribute, the `$ref` member itself contributes nothing, and the rule that a Reference Object's added properties are ignored is scoped to Reference Objects proper and never reaches this merge. ([OAS 3.1.2 §§4.8.9.1, 4.8.23](https://spec.openapis.org/oas/v3.1.2.html#path-item-ref); this edition's note that the behavior is likely to change to align with the Reference Object affirms its present non-alignment, and the 2.0 and 3.0 lines carry no such note, against [OAS 2.0 Path Item Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-3) and [OAS 3.0.4 §4.7.9.1](https://spec.openapis.org/oas/v3.0.4.html#path-item-ref)).

**[exclusion]** When a selected Path Item carries `$ref`, the selected operation target is excluded only if a fixed field used by that target appears in both the referenced Path Item and its adjacent declaration, because OAS defines that collision as undefined. `Used by that target` means the selected method field plus the Path Item's `parameters` and `servers`; the documentation fields `summary` and `description` never collide for this purpose. Collisions confined to unused fields and all non-colliding adjacent fields leave the target usable, and the exclusion reopens only if an incorporated OAS edition defines the collision ([OAS 3.1.2 §4.8.9.1](https://spec.openapis.org/oas/v3.1.2.html#path-item-ref)).

**[convention]** The first three reference conditions in the table below are this specification's own confinement conditions; the sections cited beside them define the reference positions and the base resolution those conditions read, not the conditions themselves ([OAS 3.1.2 §§4.3, 4.6, 4.8.9](https://spec.openapis.org/oas/v3.1.2.html#openapi-description-structure)):

| condition |
| --- |
| **[convention]** Unresolvable selected Path Item `$ref` |
| **[convention]** Unresolvable reference reached by one selected parameter, request body, response, server, or security requirement |
| **[convention]** Unresolvable Schema Object reference reached only by one media alternative |
| **[limit]** An unresolvable reference reachable only from an unused description position leaves invocation unaffected; synthesis reports that position as coverage loss. |
| **[limit]** A defect outside the target-plus-reachable closure has no effect on that target. |

**[limit]** In table order, the three confinement conditions confine as follows: the referenced Path Item and its operations are unaddressable; the selected operation or its affected declared alternative is unusable while unrelated operations survive; or the affected media alternative is unavailable while sibling alternatives survive.

### 5.2 Schema dialect

**[incorporated]** The supported default Schema Object dialect is `https://spec.openapis.org/oas/3.1/dialect/base`; root `jsonSchemaDialect` changes the document default, and a schema-resource-root `$schema` overrides that default only within its schema resource ([OAS 3.1.2 §§4.8.24.1, 4.8.24.5](https://spec.openapis.org/oas/v3.1.2.html#specifying-schema-dialects)).

**[pin]** For this identifier, that base-dialect URI is fixed to the official [`2024-11-10` revision](https://spec.openapis.org/oas/3.1/dialect/2024-11-10); a later change in the alias's resolution does not alter this specification.

**[exclusion]** A root `jsonSchemaDialect` naming any other URI excludes the whole source at source scope before target selection: no selector resolves because the source is not admitted, not because any declared target position is defective, and synthesis accounts the source as excluded. The changed default governs every Schema Object in the source that carries no `$schema`, which is the source's whole schema surface and admits no smaller owner, whereas a schema-resource root bounds what it governs. This exclusion is distinct from §3.2's defect-derived source refusal and reopens only if that exact dialect becomes incorporated authority.

**[exclusion]** A schema-resource-root `$schema` naming any other URI excludes only each selected unit whose reachable closure enters that resource; this exclusion reopens only if that exact dialect becomes incorporated authority.

**[convention]** For every lane, style, shape, and member-inspection rule in this document, a **resolved declaration** is obtained by following `$ref` and conjoining every `allOf` branch: the branches' type sets intersect, since an instance must satisfy every branch ([JSON Schema 2020-12 §10.2.1.1](https://json-schema.org/draft/2020-12/json-schema-core.html#section-10.2.1.1)), a typeless branch contributes no constraint, and an empty intersection is a declaration admitting no instance, against which every supplied value fails every admission test below. That refusal lives where an admission test consults the declaration — a character-data or raw-octet selection, a multipart part, a content-form property — and the value refuses before dispatch; the JSON lane and the parameter positions select carriage by media type and by location alone, consult no resolved type set, and carry the supplied value unvalidated under §9.2's no-validation rule. For an `anyOf` or `oneOf` choice, a branch whose resolved declaration declares only `null` is skipped, every other branch — a typeless branch included — is a candidate, and the choice supplies a single resolved member declaration only when exactly one candidate remains; `not` and conditional applicators never participate in resolution. Absence of `type` leaves the declaration typeless; a `type` array contributes every listed type to the resolved type set. **Declares only X** means that the resolved type set is nonempty and every member is in X; **Admits `string` as its sole non-null type** means that the resolved type set is exactly `{string}` or `{string, null}`.

**[exclusion]** `$dynamicRef` retains JSON Schema's runtime dynamic-scope semantics and is not statically followed by the preceding algorithm. When a lane, style, shape, or member-inspection rule needs a resolved declaration and its reachable schema closure encounters `$dynamicRef`, the smallest media alternative, parameter, or multipart property whose decision needs that declaration is excluded; the exclusion propagates only when its owner is required. A JSON media lane and a parameter position whose carriage rule never inspects schema type remain unaffected. This exclusion reopens for design only upon demonstrated consumer need for portable binding-governed dynamic-scope evaluation; meeting that condition does not change this identifier, and any semantics-changing addition remains subject to Core OBI-B-03 ([OAS 3.1.2 §4.8.24.5](https://spec.openapis.org/oas/v3.1.2.html#schema-object), [JSON Schema Core §8.2.3.2](https://json-schema.org/draft/2020-12/json-schema-core.html#section-8.2.3.2)).

## 6. Selector and inbound dependencies

### 6.1 Selector

**[convention]** `selector` is REQUIRED and has exactly one literal spelling: `#/paths/<escaped-path>/<lowercase-method>`, where `<escaped-path>` is the Paths Object key escaped once under [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) and `<lowercase-method>` is one of `get`, `put`, `post`, `delete`, `options`, `head`, `patch`, or `trace`.

**[pin]** The selector's leading `#` is a literal sentinel: what follows is RFC 6901 §3's string representation of the JSON Pointer, carried literally, escaped once with `~0`/`~1`, and never percent-decoded; RFC 6901 §6's URI-fragment representation is not used. Evaluation follows RFC 6901 §§3–4; when the selected operation is absent the selector does not resolve and the invocation refuses at resolution ([RFC 6901 §§3–4, 6](https://www.rfc-editor.org/rfc/rfc6901#section-3), [OAS 3.1.2 §§3.5, 4.8.9](https://spec.openapis.org/oas/v3.1.2.html#path-item-object)).

**[convention]** After the pointer selects a Path Item, selector evaluation resolves that Path Item's `$ref` into §5.1's effective Path Item before reading the method field. Ordinary RFC 6901 evaluation does not traverse a 2020-12 `$ref`, because `$ref` is an applicator and substitutes no JSON node; the deliberate extra resolution keeps bundled referenced Path Items addressable ([RFC 6901 §4](https://www.rfc-editor.org/rfc/rfc6901#section-4), [JSON Schema Core §8.2.3.1](https://json-schema.org/draft/2020-12/json-schema-core.html#section-8.2.3.1), [OAS 3.1.2 §4.8.9.1](https://spec.openapis.org/oas/v3.1.2.html#path-item-ref)).

**[incorporated]** An operation remains addressable when it omits `responses`, because `responses` is optional in the 3.1 Operation Object ([OAS 3.1.2 §4.8.10.1](https://spec.openapis.org/oas/v3.1.2.html#operation-responses)).

**[incorporated]** When `responses` is present, its Responses Object MUST contain at least one response declaration. The `default` fixed field is a fallback Response Object for codes not covered individually and satisfies that declaration requirement when present alone ([OAS 3.1.2 §4.8.16](https://spec.openapis.org/oas/v3.1.2.html#responses-object)).

**[limit]** A present Responses Object with neither a patterned response-code field nor `default` — an empty or extension-only object included — is upstream-invalid and makes only the selected target unusable and `invalid` before any response or caller value is inspected; omission remains addressable under the preceding rule. Its selector still resolves, synthesis retains the invalid target slot without an operation contract, and invocation refuses before dispatch. The confinement reopens only if an incorporated OAS 3.1 edition admits the exact declaration.

### 6.2 Callbacks and webhooks

**[incorporated]** A callback Path Item describes a request initiated by the service and expected responses, while a root webhook describes an incoming request the API consumer may implement; neither is an operation invocable through the addressed parent operation ([OAS 3.1.2 §§4.8.1.1, 4.8.10.1, 4.8.18](https://spec.openapis.org/oas/v3.1.2.html#oas-webhooks)).

**[convention]** Synthesis MUST represent every callback and webhook operation that §3.2 does not exclude as a Core dependency with a deterministic slot-derived key and a role-inverted consumed-operation contract: input is the request the service sends and output is the response the service expects (Core [§5.6](../../openbindings.md#56-dependencies)).

**[convention]** `Deterministic slot-derived key` requires only that the key be a deterministic function of the declaration slot; its exact spelling is synthesis policy under §12.2 and is not portable binding meaning. The dependency contract's shape is likewise synthesis policy; only the role-inverted input/output meaning above is fixed here.

**[incorporated]** Such a dependency carries no concrete target (Core [§5.6](../../openbindings.md#56-dependencies)).

**[convention]** Such a dependency also carries no `bindingSpecs`, because the originating artifact has no authority to constrain the consumer's description format.

**[incorporated]** A callback's Path Item key is an expression, evaluated at runtime, that identifies the URL the callback operation uses; the edition's own worked example resolves one from a consumer-supplied query-string parameter, so the destination is not characterized as service-chosen ([OAS 3.1.2 §§4.8.18, 4.8.18.3, 4.8.20.3](https://spec.openapis.org/oas/v3.1.2.html#runtime-expressions)).

**[limit]** Dependencies add no invocation behavior to this binding; receiver deployment and dependency composition are permanently outside this operation boundary under this identifier (Core [§1.2](../../openbindings.md#12-out-of-scope)).

## 7. Target interaction and caller envelope

**[convention]** Here and below, an **effective** declaration is the declaration that remains after applying the artifact's scope, default, and override rules stated in §§8–10.

**[incorporated]** An addressed operation denotes its declared HTTP method, completed target URL, parameters, optional request body, security requirements, and final HTTP response. The method is the Path Item field name that selects the Operation Object, and the target URL is composed from the effective Server Object's URL with the Paths Object key ([OAS 3.1.2 §4.8.10](https://spec.openapis.org/oas/v3.1.2.html#operation-object), [§4.8.9](https://spec.openapis.org/oas/v3.1.2.html#path-item-object), [§§4.8.5, 4.8.8](https://spec.openapis.org/oas/v3.1.2.html#server-object)).

**[convention]** The caller-facing correspondence value is exactly `{parameters?: {...}, body?: <one JSON value>}`; absence means not supplied, `body: null` is a supplied JSON null, and the artifact alone determines parameter location and serialization.

**[convention]** The same absent-versus-supplied rule reaches into the `parameters` member: an absent key is not supplied, and a key present with `null` is a supplied JSON null, which satisfies a required parameter and is never missing under the requirement rule below; it then serializes under §8.1's undefined-value rule, on a `path` parameter too, whose `undefined` cell this specification does not override — a null `simple` path parameter expands to an empty segment and the completed target is dispatched with it.

**[convention]** After §3.2 removes every invalid or excluded parameter projection, when every remaining effective parameter name is unique across locations, its caller key is the exact declared name; if any remaining name is repeated across legal locations, the target uses qualified mode for every remaining parameter and each key is `<location>/<RFC6901-escaped-name>`, making the flat map injective without depending on map order. A removed projection creates no caller key and does not activate qualified mode.

**[incorporated]** Effective parameter identity is exact name plus location; duplicate effective parameters at the same identity are upstream-invalid, while the same name in different locations denotes distinct parameters ([OAS 3.1.2 §§4.8.10.1, 4.8.12.2.1](https://spec.openapis.org/oas/v3.1.2.html#operation-parameters)).

**[limit]** Duplicate effective parameters at the same identity are upstream-invalid and remove their smallest owning operation, accounted `invalid`; this confinement reopens only if an incorporated OAS edition admits such duplicates.

**[convention]** Legal cross-location duplicates remain independently supplied through the qualified mode above.

**[exclusion]** Two effective header parameters whose names differ only by ASCII case exclude the selected target because OAS parameter identity is case-sensitive while HTTP field names are case-insensitive; the wire cannot preserve the distinction. This exclusion reopens only if an incorporated authority defines a wire mapping that preserves such case-distinct declarations ([OAS 3.1.2 §§3.8, 4.8.12.2.1](https://spec.openapis.org/oas/v3.1.2.html#case-sensitivity), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[convention]** A supplied envelope that is not a JSON object refuses before dispatch, whatever JSON type it is; an envelope top-level key other than `parameters` or `body`, a present non-object `parameters` member, or any unknown parameter key likewise refuses before dispatch, regardless of whether a body exists; no unmatched-field passthrough exists.

**[incorporated]** Missing required parameters and a missing `required: true` request body refuse before dispatch; path parameters are always required ([OAS 3.1.2 §§4.8.12.2.1, 4.8.13.1](https://spec.openapis.org/oas/v3.1.2.html#common-fixed-fields)).

**[incorporated]** `requestBody` is fully supported where HTTP has explicitly defined request-body semantics; where the HTTP spec is vague — GET, HEAD, and DELETE are the edition's examples of that class, not its extent — `requestBody` is permitted but has no well-defined semantics and SHOULD be avoided ([OAS 3.1.2 §4.8.10.1](https://spec.openapis.org/oas/v3.1.2.html#operation-request-body)).

**[pin]** Two things there are this specification's. The edition hooks its test to [RFC 7231 §4.3.1](https://www.rfc-editor.org/rfc/rfc7231#section-4.3.1), a pointer at GET and an upstream error, and this specification re-bases it to [RFC 9110 §§9.3.1–9.3.8](https://www.rfc-editor.org/rfc/rfc9110#section-9.3.1), the current statement of the same per-method semantics, which admits `patch` under [RFC 5789 §2](https://www.rfc-editor.org/rfc/rfc5789#section-2). And the open example class is closed over this binding's selector set: `requestBody` is honored on `post`, `put`, and `patch`; permitted-but-undefined on `get`, `head`, `delete`, and `options`, the last being this specification's assignment; and emits no body on `trace`, because a TRACE client MUST NOT send content ([RFC 9110 §9.3.8](https://www.rfc-editor.org/rfc/rfc9110#section-9.3.8)). Both pins reopen only if an incorporated OAS edition states the method set itself.

**[convention]** On the permitted-but-undefined methods the binding preserves a supplied declared body rather than deleting it, since the edition's own disposition is advice to authors (`SHOULD be avoided`) and not a consumer instruction to drop content; a supplied `body` on `trace` refuses as unroutable before dispatch.

**[limit]** On such a content-forbidding method the artifact's `required: true` request body creates no caller-body requirement, so a body-free invocation dispatches and the preceding `incorporated` rule's missing-required-body refusal does not reach it. The target is therefore invocable, not permanently unusable; the declaration is reported as coverage loss at the Request Body position ([RFC 9110 §9.3.8](https://www.rfc-editor.org/rfc/rfc9110#section-9.3.8)).

## 8. Parameter serialization

### 8.1 Effective declarations and scalar conversion

**[incorporated]** Operation parameters override Path Item parameters only at the same exact name-plus-location identity, and every remaining effective `path`, `query`, `header`, or `cookie` Parameter Object governs its own contribution ([OAS 3.1.2 §§4.8.9.1, 4.8.10.1, 4.8.12.1](https://spec.openapis.org/oas/v3.1.2.html#parameter-locations)).

**[limit]** A selected effective Parameter Object missing required `name`, using an `in` outside `path`, `query`, `header`, or `cookie`, failing to use exactly one of `schema` or `content`, declaring a non-required path parameter, or giving a content map other than exactly one entry is upstream-invalid and removes the selected target before caller values are inspected, accounted `invalid`. The confinement reopens only if an incorporated OAS 3.1 edition admits the exact malformed declaration or defines its wire meaning ([OAS 3.1.2 §§4.8.12.1–4.8.12.2.3](https://spec.openapis.org/oas/v3.1.2.html#parameter-object)).

**[incorporated]** A Header parameter whose name ASCII-case-insensitively denotes `Accept`, `Content-Type`, or `Authorization` MUST be ignored and creates no effective parameter, caller-envelope key, or emitted field ([OAS 3.1.2 §§3.8, 4.8.12.2.1](https://spec.openapis.org/oas/v3.1.2.html#common-fixed-fields), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[incorporated]** A Schema Object `default` documents what the receiver assumes when a value is not provided and is never inserted by this binding: an unsupplied optional parameter carrying a `default` is omitted before serialization, exactly as one carrying none. The governing text states the distinction beside the Server Variable Object's own `default`: the Schema Object keyword "documents the receiver's behavior rather than inserting the value into the data" ([OAS 3.1.2 §4.8.6.1](https://spec.openapis.org/oas/v3.1.2.html#server-variable-object)).

**[configuration point]** For `schema`-form parameter serialization and for §9.3's RFC 6570-style Encoding path — and for those two only, never for §9.3's content-based path, which §9.3 serializes by media type — `parameterConversion` is the same deterministic consumer-supplied conversion from each JSON boolean or number to a string; strings pass identically, and any supplied boolean or number without a configured conversion refuses before dispatch ([OAS 3.1.2 Appendix B](https://spec.openapis.org/oas/v3.1.2.html#appendix-b-data-type-conversion)).

**[incorporated]** On those RFC 6570-style paths the undefined values are RFC 6570 §2.3's, which the edition points at for exactly this purpose: "[RFC6570] Section 2.3 specifies which values, including but not limited to null, are considered undefined". The set is therefore a supplied JSON null, a supplied array of zero members, and a supplied object of zero members or all of whose member values are undefined; the empty string is expressly not undefined ([OAS 3.1.2 Appendix B](https://spec.openapis.org/oas/v3.1.2.html#appendix-b-data-type-conversion), [§4.8.12.6](https://spec.openapis.org/oas/v3.1.2.html#style-examples), [RFC 6570 §2.3](https://www.rfc-editor.org/rfc/rfc6570#section-2.3)).

**[convention]** Because the rule below refuses a null member outright, no supplied object reaches the all-member-values-undefined case through null members, and no other supplied member value is undefined at member level; the three conditions above are the whole set under this identifier.

**[incorporated]** An undefined value MUST serialize exactly as the governing effective `style` and `explode` row's `undefined` cell: `;name` for `matrix`, `.` for `label`, an empty serialization for `simple`, and `name=` for `form` before §8.2's enclosing query assembly; the remaining style cells are `n/a`. That column replaced earlier editions' `empty` column and expressly distinguishes the empty string; OAS 3.1.0 carries only the superseded column, and under §2's unconditional patch pin the corrected column governs every accepted edition ([OAS 3.1.0 §4.8.12.4](https://spec.openapis.org/oas/v3.1.0.html#style-examples), [OAS 3.1.1 §4.8.12.4](https://spec.openapis.org/oas/v3.1.1.html#style-examples), [OAS 3.1.2 §4.8.12.6](https://spec.openapis.org/oas/v3.1.2.html#style-examples)).

**[pin]** Those bytes are not RFC 6570's: [RFC 6570 §3.2.1](https://www.rfc-editor.org/rfc/rfc6570#section-3.2.1) ignores an undefined variable entirely, so `{?x,y,undef}` yields `?x=1024&y=768`, whereas the `undefined` cells above emit the bytes RFC 6570 produces for the empty string. This is the first of §2's three named precedence decisions and it resolves for OAS: the Style Examples table governs an undefined value's bytes, and RFC 6570 supplies only the definition of which values are undefined.

**[convention]** A supplied undefined value whose governing effective `style`/`explode` row has `n/a` in that corrected `undefined` cell refuses the invocation before dispatch at the affected parameter or Encoding property; other values admitted by the same declaration remain usable.

**[convention]** A null member of a supplied array or object value on an RFC 6570-style path refuses the invocation before dispatch at the affected parameter or Encoding property; RFC 6570's list model has no member-level undefined value, and this binding invents no serialization.

**[configuration point]** This specification defines no partial canonicalization default for `parameterConversion`; the converter applies recursively to array members and object values before serialization and MUST be deterministic for every accepted scalar.

### 8.2 `style`, `explode`, and URL assembly

**[incorporated]** The supported `schema`-form cells and their RFC 6570 operators are exactly the following; a style/location/shape outside the table refuses before dispatch ([OAS 3.1.2 §§4.8.12.2.2, 4.8.12.3, Appendix C](https://spec.openapis.org/oas/v3.1.2.html#style-values), [RFC 6570 §3.2](https://www.rfc-editor.org/rfc/rfc6570#section-3.2)):

| style | location | admitted shapes | operator / source |
| --- | --- | --- | --- |
| **[incorporated]** `matrix` | path | primitive, array, object | `;` |
| **[incorporated]** `label` | path | primitive, array, object | `.` |
| **[incorporated]** `simple` | path, header | primitive, array, object | none |
| **[incorporated]** `form` | query, cookie | primitive, array, object | `?`; `allowReserved: true` corresponds separately to `+` and does not combine with it — the authority lists that pair among the configurations with no RFC 6570 equivalent, "because only one prefix operator can be used at a time", and the manual-construction rule below governs it |
| **[convention]** `spaceDelimited` | query | array, object | OAS Style Examples bytes |
| **[convention]** `pipeDelimited` | query | array, object | OAS Style Examples bytes |
| **[convention]** `deepObject` | query | object with scalar properties | OAS Style Examples bytes |

**[incorporated]** Default style is `form` for query and cookie and `simple` for path and header; default `explode` is `true` only for `form` and `false` otherwise; `allowReserved` applies only to query parameters ([OAS 3.1.2 §4.8.12.2](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-9)).

**[incorporated]** RFC 6570 serialization MUST use its declared operator and `*` for `explode: true`, and a non-exploded label list or map uses a comma. Multiple regular form-style query parameters share one `?` variable list; separately expanding multiple `?` templates is not conformant ([OAS 3.1.2 §§C.1–C.2](https://spec.openapis.org/oas/v3.1.2.html#equivalences-between-fields-and-rfc6570-operators), [OAS 3.1.2 §4.8.12.6](https://spec.openapis.org/oas/v3.1.2.html#style-examples), [RFC 6570 §3.2.5](https://www.rfc-editor.org/rfc/rfc6570#section-3.2.5)).

**[pin]** Appendix C.3 says implementations MAY create a properly delimited URI Template for configurations with no direct RFC 6570 equivalent; this specification pins that latitude to a requirement, because RFC 6570 prefix operators cannot combine: a query mixing regular form expansion with `allowReserved: true` MUST be constructed manually per parameter, reserved-permitting values using reserved expansion and `[`, `]`, `#`, `&`, `=`, and `+` pre-percent-encoded where Appendix C.4.2 requires ([OAS 3.1.2 §§C.3–C.4.2](https://spec.openapis.org/oas/v3.1.2.html#non-rfc6570-field-values-and-combinations)).

**[convention]** The manual path assembles all present per-parameter contributions into one query component with one leading `?` and `&` between contributions; this assembled result is the single-query rule's equivalent at the authority's construction seam.

**[convention]** Query-contribution order across distinct effective parameters is not portable meaning.

**[incorporated]** A parameter name that is not a legal RFC 6570 variable name MUST be percent-encoded before use in the template construction ([OAS 3.1.2 §§C.3, C.4.4](https://spec.openapis.org/oas/v3.1.2.html#illegal-variable-names-as-parameter-names)).

**[convention]** That variable-name encoding is internal to URL assembly and never changes the exact caller-envelope key defined by §7.

**[convention]** For `spaceDelimited`, `pipeDelimited`, and `deepObject`, the exact bytes are the corresponding OAS Style Examples: delimiters and deep-object brackets are percent-encoded, object names and values retain their shown alternation, and no unstated escape convention is added ([OAS 3.1.2 §4.8.12.6](https://spec.openapis.org/oas/v3.1.2.html#style-examples)).

**[pin]** Before dispatch, the binding refuses a supplied parameter or property name or scalar value containing its non-RFC style's structural delimiter — U+0020 SPACE for `spaceDelimited`, `|` for `pipeDelimited`, or any of `[`, `]`, `=`, and `&` for `deepObject` — and offers no escape-convention configuration point. This narrows Appendix E.6, which requires those delimiters percent-encoded and RECOMMENDS either an additional escape convention left to the API designer or avoiding these styles entirely: that convention is an artifact-external agreement this binding cannot read, so no configuration point could make the round trip decidable, and this specification takes the second recommendation and refuses the ambiguous value. `=` and `&` are added beyond the four the appendix names because an exploded `deepObject` also uses them to delimit its own `name[key]=value` pairs ([OAS 3.1.2 Appendix E.6](https://spec.openapis.org/oas/v3.1.2.html#percent-encoding-and-illegal-or-reserved-delimiters), [RFC 3986 §2.2](https://www.rfc-editor.org/rfc/rfc3986#section-2.2)).

**[exclusion]** An effective `style`/`explode` combination, a defaulted `explode` included, whose entire Style Examples row is `n/a` excludes that parameter; so omitted `explode` on `deepObject` computes to the excluded `false` row, which the edition itself calls undefined. The test is the whole row and never a single cell: a row carrying `n/a` in some columns and real bytes in others — `spaceDelimited` with `explode: false`, for instance — is a supported combination, and only the values falling in its `n/a` columns are refused: a supplied undefined value by the rule above, and a shape this section's table does not admit for that style by the rule introducing that table. The exclusion reopens only if an incorporated authority defines that exact combination ([OAS 3.1.2 §§4.8.12.2, 4.8.12.3, 4.8.15.1, C.1](https://spec.openapis.org/oas/v3.1.2.html#style-values), [RFC 6570 §3.2.1](https://www.rfc-editor.org/rfc/rfc6570#section-3.2.1)).

**[exclusion]** Otherwise a compound-capable style is excluded only when its resolved declaration proves an unsupported compound member — an array whose resolved `items` declaration declares only `object` or `array`, or an object with at least one declared property whose resolved declaration declares only `object` or `array` — for which OAS/RFC 6570 defines no expansion; the owning unit is excluded unless an incorporated authority defines that exact cell ([OAS 3.1.2 §§4.8.12.2, 4.8.12.3, 4.8.15.1, C.1](https://spec.openapis.org/oas/v3.1.2.html#style-values), [RFC 6570 §3.2.1](https://www.rfc-editor.org/rfc/rfc6570#section-3.2.1)).

**[convention]** A typeless resolved member proves no compound shape, a choice that supplies no single resolved member declaration under §5.2 proves no compound shape, and an object declaring no properties proves no compound member, so none triggers this exclusion; in particular, a declaration that still admits a scalar is never excluded, and candidate admission never inspects the supplied runtime value.

**[convention]** Independently of that static admission, a supplied value whose runtime shape exits the admitted style-table cell refuses that invocation before dispatch at the affected parameter or Encoding property. In particular, a typeless or scalar-admitting member does not license a nested array or object for a cell whose member expansion is undefined; the binding performs no private stringification or JSON serialization to manufacture bytes for it.

**[convention]** The rule applies symmetrically to every compound-capable parameter style and to §9.3's Encoding style path, where the smallest owner is the selected media alternative rather than the target.

**[incorporated]** The Paths Object MUST NOT contain two templated path keys with equivalent hierarchies but different template names. Within one selected target, every path-template expression MUST have a corresponding effective `path` parameter, and every effective `path` parameter MUST correspond to a template expression ([OAS 3.1.2 §§3.5, 4.8.8.1, 4.8.12.2.1](https://spec.openapis.org/oas/v3.1.2.html#path-templating)).

**[convention]** When one path-template expression occurs more than once, its single effective `path` parameter supplies the value substituted at every occurrence. OAS 3.1.2 requires correspondence in both directions but does not forbid repetition, and repeating the same substitution introduces no ambiguity.

**[limit]** Equivalent-hierarchy path-key ambiguity or either direction of a path-expression/parameter mismatch is upstream-invalid and removes the selected target before any caller value is inspected, accounted `invalid`; non-conflicting targets survive. The confinement reopens only if incorporated authority admits the declaration or defines its unique target mapping.

**[incorporated]** An expanded path value containing unescaped `/`, `?`, or `#` refuses before dispatch ([OAS 3.1.2 §§3.5, 4.8.12.4](https://spec.openapis.org/oas/v3.1.2.html#path-templating)).

**[incorporated]** Completed URL parsing and percent-decoding follow RFC 3986, while query delimiters and the non-RFC-style brackets above remain percent-encoded as required ([OAS 3.1.2 §4.8.12.4](https://spec.openapis.org/oas/v3.1.2.html#url-percent-encoding), [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)).

### 8.3 Content-form, empty, header, and cookie parameters

**[incorporated]** A `content`-form Parameter Object MUST contain exactly one media-type entry; its application value serializes under that entry, and when the contribution enters a URL the resulting representation is percent-encoded as one parameter value ([OAS 3.1.2 §4.8.12.2.3](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-for-use-with-content) for the one-entry requirement, [§4.8.12.4](https://spec.openapis.org/oas/v3.1.2.html#url-percent-encoding) for the percent-encoding of a value serialized through a Media Type Object).

**[pin]** Percent-encoding a content-form parameter leaves RFC 3986 unreserved bytes literal and encodes every other UTF-8 byte as uppercase `%HH`; the exact caller-envelope key remains unchanged.

**[incorporated]** For a query parameter with `allowEmptyValue: true`, a supplied empty string emits a present zero-length value; absence still means omitted, and this binding infers no schema-validity consequence because OAS leaves that interaction implementation-defined ([OAS 3.1.2 §4.8.12.2.1](https://spec.openapis.org/oas/v3.1.2.html#parameter-allow-empty-value)).

**[incorporated]** A supplied empty string is an ordinary value and serializes as the governing effective `style`/`explode` row's `empty` cell — `name=` for `form`, an empty representation for `simple`, `;name` for `matrix`, `.` for `label`, and `n/a` for the remaining styles — whatever `allowEmptyValue` declares: the edition states that the `empty` column is unrelated to that field and that the empty string is not undefined ([OAS 3.1.2 §4.8.12.6](https://spec.openapis.org/oas/v3.1.2.html#style-examples)).

**[incorporated]** Header `schema` serialization performs no URI percent-encoding and adds no automatic quotes: the governing text requires that URI percent-encoding MUST NOT be applied to header values and that they pass through unchanged, a correction 3.1.2 states expressly — "this section has been corrected to apply only to cookies". Of the accepted editions only 3.1.1 gave the earlier advice and 3.1.0 carries no Appendix D, so §2's unconditional pin carries the corrected rule to all three ([OAS 3.1.2 §4.8.12.2.2](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-for-use-with-schema), [Appendix D.1](https://spec.openapis.org/oas/v3.1.2.html#appendix-d-serializing-headers-and-cookies)).

**[pin]** No accepted edition extends that exemption to cookies, and this specification invents none: a declared cookie parameter serialized on the `schema` path is percent-encoded by ordinary RFC 6570 expansion, because `allowReserved` is valid only for query parameters. Appendix D's observation that percent-encoding "is not always appropriate" for cookies and its recommendation to use `content` instead are advice to artifact authors, not a serialization rule. The resulting asymmetry is stated here: the same characters ride percent-encoded in a declared cookie **parameter** and unencoded in an `apiKey` cookie **credential**, which §11 carries as an RFC 6265 `cookie-value`; §11 also states the single `; `-separated `name=value` assembly both use, with no portable order ([OAS 3.1.2 Appendix D](https://spec.openapis.org/oas/v3.1.2.html#appendix-d-serializing-headers-and-cookies), [RFC 6570 §3.2](https://www.rfc-editor.org/rfc/rfc6570#section-3.2)).

**[pin]** The complete serialized header field value's characters are carried as UTF-8 octets, closing the character-to-octet seam before the field-invalid-byte check below ([RFC 9110 §5.5](https://www.rfc-editor.org/rfc/rfc9110#section-5.5)).

**[convention]** A complete serialized header field value that is not an RFC 9110 `field-value` after UTF-8 encoding refuses before dispatch at the affected parameter. This includes CR, LF, NUL, any other field-invalid octet, and leading or trailing SP or HTAB, which are field-line whitespace rather than part of the field value. When the effective header name is `Cookie`, that complete serialized field value MUST additionally be an RFC 6265 `cookie-string`; the binding neither repairs nor partially parses it ([RFC 9110 §§5.1, 5.5](https://www.rfc-editor.org/rfc/rfc9110#section-5.1), [RFC 6265 §4.2.1](https://httpwg.org/specs/rfc6265.html#sane-cookie)).

**[exclusion]** A raw Cookie source is an effective `Cookie` Header parameter or a header credential whose destination compares ASCII case-insensitively to `Cookie`; a structured source is an effective cookie parameter or cookie credential. Two required parameters of opposite kinds exclude the target. Within one security alternative, opposite-kind credentials in the same AND requirement, or a credential opposite to a required parameter, exclude that alternative; other OR alternatives survive, and the target is excluded only when none remains. This declaration-time propagation prevents synthesis of a statically guaranteed-refusal operation and reopens only if incorporated authority defines a coherent merge.

**[convention]** Every other raw/structured combination is invocation-conditional and declarations alone exclude nothing. An invocation that would emit at least one supplied or selected source of each kind refuses before dispatch; the binding does not parse or merge the raw string.

**[exclusion]** Every effective header parameter name MUST be an HTTP field-name `token`. A non-token name excludes that parameter projection as the smallest unsupported wire owner. If the parameter is optional, the operation remains represented and an invocation omitting it may dispatch, but the excluded parameter creates no caller-envelope key or emitted field; supplying the would-be key is therefore unknown input and refuses before dispatch. If it is required, the selected target is excluded because no conforming invocation can satisfy it. This exclusion reopens only if incorporated HTTP authority admits that exact field-name form ([RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[exclusion]** Every effective cookie parameter name MUST be the RFC 6265 cookie-name `token`. A non-token name follows the same smallest-owner and caller-envelope rule as a non-token header name: an optional parameter is excluded only at that projection and its would-be key is unknown input, while a required parameter excludes the selected target. After serialization, every supplied structured-cookie value MUST satisfy `cookie-value`; an invocation whose exact value cannot be carried refuses before dispatch rather than escaping or repairing it. This exclusion reopens only if incorporated cookie authority admits the exact name or value form ([RFC 6265 §§4.1.1, 4.2.1](https://httpwg.org/specs/rfc6265.html#sane-cookie)).

**[exclusion]** An effective header parameter whose name compares ASCII case-insensitively to `Host`, `Content-Length`, `Connection`, `Keep-Alive`, `Proxy-Authorization`, `Proxy-Connection`, `TE`, `Trailer`, `Transfer-Encoding`, or `Upgrade` excludes the target because those fields are processor-owned and cannot be replaced by caller input. The connection-specific and framing fields could otherwise change message framing, advertise a protocol switch this unary binding cannot continue, or describe hop-by-hop state the binding does not model; `Proxy-Authorization` is consumed by the first inbound proxy and therefore cannot safely carry an origin API value. The exclusion reopens only if an incorporated HTTP authority defines caller control that preserves those obligations ([RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1), [§7.6.1](https://www.rfc-editor.org/rfc/rfc9110#section-7.6.1), [§11.7.2](https://www.rfc-editor.org/rfc/rfc9110#section-11.7.2)).

**[exclusion]** A form-style cookie declaration is statically excluded when its resolved declaration proves the edition's unsupported multi-value representation: a declaration that declares only `array`, or one that declares only `object` with at least one declared property, independently of `explode`. The smallest owner is the cookie-parameter projection when optional; its would-be caller key is unknown and an invocation omitting it may dispatch. A required such parameter excludes the target because no conforming invocation can satisfy it. A typeless or scalar-admitting declaration proves no static multi-value shape; if a supplied value nevertheless would use the edition's multi-value form-cookie representation, that invocation refuses before dispatch. OAS identifies the RFC 6570 expansion as incorrect for multiple cookies whether the multiple values result from `explode: true` or not, so the exclusion reopens only if an incorporated OAS edition defines a correct multi-value mapping ([OAS 3.1.2 Appendix D](https://spec.openapis.org/oas/v3.1.2.html#appendix-d-serializing-headers-and-cookies)).

## 9. Request and response media

### 9.1 Media identity, alternatives, and request election

**[incorporated]** Media types parse under RFC 9110: type and subtype compare case-insensitively, parameter names compare case-insensitively, and parameter values retain their media-defined comparison rules ([RFC 9110 §§5.6.6, 8.3.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.6.6)).

**[convention]** A **concrete media type** has no wildcard in either its type or subtype; media-type parameters do not affect concreteness.

**[convention]** A declaration matches a concrete media type only when every declared parameter is present with an equal value; matches order by exact type/subtype before `type/*` before `*/*`, then by greatest declared-parameter count, and equal-specificity ties select no declaration.

**[pin]** A declared media-type parameter value is first unquoted under [RFC 9110 §5.6.6](https://www.rfc-editor.org/rfc/rfc9110#section-5.6.6); the value of `charset` then compares ASCII case-insensitively, and every other parameter value, `boundary` included, compares by exact character sequence. RFC 9110 §5.6.6 leaves parameter-value case sensitivity to each parameter's own definition; [RFC 2046 §4.1.2](https://www.rfc-editor.org/rfc/rfc2046#section-4.1.2) marks `charset` as the exception to the general rule, and [RFC 2046 §5.1.1](https://www.rfc-editor.org/rfc/rfc2046#section-5.1.1) constructs the multipart boundary delimiter from the parameter value literally, so an inexact boundary does not delimit.

**[limit]** Distinct content-map keys that normalize to one parsed media identity collide only for that identity and support no selection through it: a request selection refuses before dispatch and a response selection is a loud protocol error on a successful response; on an unsuccessful one the best-effort failure-body rule governs, and no loud protocol error is raised. Non-colliding entries survive, map order never breaks the tie, and the normalization is exactly §9.1's media-type parse together with the parameter-value comparison the pin above fixes.

**[incorporated]** A no-body invocation bypasses request-body media selection and emits neither a body nor `Content-Type`, because an absent optional Request Body contributes no HTTP content ([OAS 3.1.2 §§4.8.10.1, 4.8.13.1](https://spec.openapis.org/oas/v3.1.2.html#request-body-object)).

**[configuration point]** A body-emitting invocation preserves every admissible declared request alternative: exactly one usable concrete entry — one not excluded by this specification's confinement rules — selects itself; every other map, including two or more usable entries or a concrete declaration alongside a usable range, requires a concrete `requestMedia` choice before input consumption; the choice MUST match under §9.1 and never substitutes another declaration's schema, and supplied values never elect.

**[configuration point]** A missing required choice, unmatched or ambiguous choice, unsupported selected lane, or body-emitting invocation with no admissible candidate refuses before dispatch; no body bytes or examples are sniffed to select a lane.

**[pin]** A body-emitting invocation emits a request `Content-Type` field carrying the concrete media type elected under §9.1; no declaration key, example, or supplied body value substitutes another media type, and beyond a `multipart/form-data` election's `boundary` parameter, which the incorporated authority supplies as a parameter of that media type, this specification adds no parameter of its own. The incorporated HTTP authority only SHOULD-requires the field, excusing a sender to whom the intended media type is unknown; the election makes it known, so this specification pins that SHOULD to a requirement, and no accepted OAS edition states the emission. The edition's only statement about the request `Content-Type` field is that a Header parameter of that name is ignored, which §8.1 already carries ([RFC 9110 §8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3), [RFC 7578 §4.1](https://www.rfc-editor.org/rfc/rfc7578#section-4.1), [OAS 3.1.2 §4.8.12.2.1](https://spec.openapis.org/oas/v3.1.2.html#common-fixed-fields)).

**[exclusion]** After §7 applies the method-specific request-body disposition and §3.2 removes invalid or excluded media alternatives, an effective Request Body Object declaring `required: true` with no surviving request-content alternative excludes the selected target before caller values are inspected: the required body admits no candidate media type, and leaving the target represented would make every invocation refuse for the same declaration condition. A method-ignored Request Body never reaches this test, and a surviving alternative that merely needs `requestMedia` or another configuration remains usable. The exclusion reopens only if an incorporated OAS edition defines a request representation for the otherwise empty effective set ([OAS 3.1.2 §4.8.13.1](https://spec.openapis.org/oas/v3.1.2.html#request-body-object)).

**[pin]** The emitted value is the elected concrete media type in its parsed form: type, subtype, and every parameter name in lowercase, each parameter value in the characters the declaration or choice supplied after unquoting, re-quoted only where the `token` production does not admit it. A `boundary` parameter is the one exception: §9.3 discards any declared or chosen value for emission and the generated token is emitted in its place. Which spelling matched — a range-keyed declaration instantiated by a `requestMedia` choice, a concrete map key, or the choice itself — never changes the emitted bytes. RFC 9110 §8.3.1 calls the alternative spellings equivalent and the normalized one preferred, which fixes no bytes on its own; this specification pins the preferred spelling ([RFC 9110 §8.3.1](https://www.rfc-editor.org/rfc/rfc9110#section-8.3.1)).

**[incorporated]** Examples illustrate values ([OAS 3.1.2 §4.8.14.1](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-11)).

**[limit]** Examples create no operation input or output member and never select a declaration, carriage lane, or media type.

**[pin]** The binding emits one `Accept` field containing every distinct surviving, non-colliding response-content media range whose body projection has an admitted carriage lane under §§9.2–9.5. Each range uses §9.1's parsed normalized spelling with any wildcard preserved; values are ordered by ascending UTF-8 octets of that spelling and joined with exactly comma-plus-SP, with no `q` parameter added, so every advertised range has equal preference. If the set is empty, the field is omitted. The set intentionally spans admitted media declared under successful and unsuccessful response alternatives: `Accept` states representation preferences and never changes exact/range/default response lookup, status classification, or the rule that a failure-only media declaration cannot govern a successful response. OAS ignores a Header parameter named `Accept` and does not define how a client advertises response-content alternatives; this pin preserves every declared usable alternative without inventing a preference and closes the selection and list-order behavior OAS leaves unspecified ([OAS 3.1.2 §§4.8.12.2.1, 4.8.17](https://spec.openapis.org/oas/v3.1.2.html#common-fixed-fields), [RFC 9110 §12.5.1](https://www.rfc-editor.org/rfc/rfc9110#section-12.5.1)).

**[exclusion]** A response-content media range containing a parameter named `q`, compared ASCII case-insensitively, is excluded at that response-media alternative before the generated `Accept` set is formed; valid siblings remain. RFC 9110 assigns `q` in `Accept` to relative weight, so copying the parameter would reinterpret declared media identity, can make the field invalid, and cannot preserve this binding's equal-preference rule, while stripping it would advertise a different range. The exclusion reopens only if incorporated HTTP authority defines an unambiguous `Accept` representation that preserves both the declared parameter and equal preference ([RFC 9110 §12.5.1](https://www.rfc-editor.org/rfc/rfc9110#section-12.5.1)).

### 9.2 Common carriage lanes

**[pin]** An exact `application/json` or `+json` selection serializes the supplied value as strict JSON on requests and parses strict JSON on responses; JSON text uses UTF-8 ([RFC 6839 §3.1](https://www.rfc-editor.org/rfc/rfc6839#section-3.1), [RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)).

**[pin]** [RFC 6839 §3.1](https://www.rfc-editor.org/rfc/rfc6839#section-3.1) is the incorporated `+json` suffix authority; where its registration inherits RFC 4627's UTF-16/UTF-32 latitude, [RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)'s UTF-8 requirement governs this lane.

**[pin]** Strict JSON is RFC 8259's grammar under this profile: parsing resolves duplicate object member names by taking the lexically last member, the documented common receiver behavior inside RFC 8259 §4's permitted set; and a leading byte-order mark on a JSON body is ignored under RFC 8259 §8.1's parser latitude and is never part of the value ([RFC 8259 §§4, 8.1](https://www.rfc-editor.org/rfc/rfc8259#section-4)).

**[pin]** RFC 8259's grammar admits lone-surrogate escapes while warning that their interpretation is unpredictable. Under this profile, a caller-supplied JSON value containing an unpaired surrogate code unit refuses before dispatch, and a response JSON text containing a lone-surrogate escape yields no value and is a loud response-phase protocol error. The processor MUST NOT replace the surrogate with U+FFFD, pass it through, emit request bytes containing it, or otherwise substitute another value, because none preserves a portable JSON value ([RFC 8259 §8.2](https://www.rfc-editor.org/rfc/rfc8259#section-8.2)).

**[limit]** JSON-lane numbers are interoperable within RFC 8259 §6's binary64 expectation. The permitted set is explicit and has two members: an implementation MAY preserve the supplied mathematical value exactly, and it MAY reduce it to the nearest finite binary64 value; nothing else is permitted, and no other deviation from the supplied value is. A conformant implementation therefore never fails or refuses for range or precision alone, and two conformant implementations MAY differ on a value outside binary64 — that difference is this declared set and not a defect ([RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259#section-6)).

**[convention]** `text/json` is not a member of that JSON lane; as a `text/*` type it can use the character-data lane only when its resolved declaration admits `string` as its sole non-null type. This convention reopens under a new identifier only if the IANA media-type registry registers `text/json` with JSON semantics.

**[convention]** A concrete character-data selection whose resolved declaration admits `string` as its sole non-null type carries the supplied string under its declared `charset`, defaulting to UTF-8; `type: ["string", "null"]` therefore selects this lane for its string branch, while a supplied null refuses before dispatch because the lane defines no null lexical form, and response decoding emits a string and never invents null. The closed character-data set is `text/*`, `application/xml`, and `+xml`, while `application/json` and `+json` are claimed by their own lanes. The binding does not consult the live media-type registry's `Encoding considerations` — `application/json` is registered there as binary — because a live lookup would violate this pinned, immutable reading ([RFC 6838 §4.2.1](https://www.rfc-editor.org/rfc/rfc6838#section-4.2.1), [RFC 2046 §4.1](https://www.rfc-editor.org/rfc/rfc2046#section-4.1), [RFC 7303 §§3, 9](https://www.rfc-editor.org/rfc/rfc7303#section-3)).

**[pin]** This binding is an XML-unaware MIME consumer in RFC 7303 §3's own terms — it processes XML media as opaque character data, never as parsed XML — and the charset parameter is the only character-encoding source this lane consults: consulting a BOM or XML declaration would require inspecting body bytes, which this binding never sniffs, so a charset-less non-UTF-8 XML response is a loud protocol error rather than being sniffed, and every unsupported or invalid character decoding likewise raises a loud protocol error ([RFC 7303 §3.2](https://www.rfc-editor.org/rfc/rfc7303#section-3.2)).

**[pin]** Absent a `charset` parameter, a `text/*` representation decodes as UTF-8. RFC 6838 §4.2.1 says the UTF-8 charset "SHOULD be selected as the default" and no longer permits relying on RFC 2046 §4.1.2's US-ASCII default; this specification pins that SHOULD to a requirement, because a default left to each implementation makes the decoded value unportable, while the US-ASCII displacement is the newer registration authority's own ([RFC 6838 §4.2.1](https://www.rfc-editor.org/rfc/rfc6838#section-4.2.1), displacing [RFC 2046 §4.1.2](https://www.rfc-editor.org/rfc/rfc2046#section-4.1.2)).

**[limit]** UTF-8 encoding and decoding MUST be supported. Every additional charset encoder and decoder is an independent, direction-specific runtime capability: absence or failure of the encoder required for a request refuses before dispatch, while absence or failure of the decoder required for a response is a loud response-phase protocol error. An encoder-only capability never implies its decoder, nor vice versa.

**[incorporated]** OAS permits a concrete binary media declaration to omit `schema`; a memberless Schema Object and boolean `true` likewise assert no instance type, so all three forms have a typeless resolved declaration ([OAS 3.1.2 §§4.4.2, 4.8.14.3, 4.8.24](https://spec.openapis.org/oas/v3.1.2.html#working-with-binary-data)).

**[convention]** A non-JSON, non-form concrete selection whose Media Type Object omits `schema`, or whose present resolved declaration is typeless, uses the raw-octet lane. A schema-omitted media range does not gain this lane because it declares no single concrete representation.

**[incorporated]** Every other keyword in a typeless resolved declaration still applies, because an assertion defined for one instance type succeeds for instances of other types; and `maxLength` on raw content measures wire octets rather than the Base64 boundary string, since for unencoded binary "the length is the number of octets" ([JSON Schema Core §7.6.1](https://json-schema.org/draft/2020-12/json-schema-core.html#section-7.6.1), [OAS 3.1.2 §4.4.2](https://spec.openapis.org/oas/v3.1.2.html#working-with-binary-data)).

**[incorporated]** A resolved declaration that admits `string` as its sole non-null type with `contentEncoding` carries the caller's artifact-encoded string as text and does not trigger OpenBindings Base64 decoding — implementations "MUST NOT automatically decode, parse, and/or validate the string contents by default" — and schema encoding is distinct from HTTP `Content-Encoding` ([OAS 3.1.2 §4.4.2](https://spec.openapis.org/oas/v3.1.2.html#working-with-binary-data), [JSON Schema Validation §8.2](https://json-schema.org/draft/2020-12/json-schema-validation.html#section-8.2), [§8.3](https://json-schema.org/draft/2020-12/json-schema-validation.html#section-8.3)).

**[incorporated]** On a resolved declaration whose type set excludes `string`, `contentEncoding` and `contentMediaType` are inert annotations: they cause no refusal, select no encoded-string handling, and emit no `Content-Transfer-Encoding`, because both keywords apply only when the instance is a string ([JSON Schema Validation §§8.3–8.4](https://json-schema.org/draft/2020-12/json-schema-validation.html#section-8.3), [OAS 3.1.2 §§4.4, 4.8.15.3](https://spec.openapis.org/oas/v3.1.2.html#data-types)).

**[pin]** Every OpenBindings raw-octet value is a JSON string containing canonical RFC 4648 §4 Base64: standard alphabet, required padding, no ignored non-alphabet characters, and zero unused pad bits; requests decode before dispatch and responses encode the exact octets ([RFC 4648 §§3.3, 3.5, 4](https://www.rfc-editor.org/rfc/rfc4648)).

**[convention]** A supplied request value at a raw-octet boundary that is not a JSON string, or that is a JSON string failing that canonicality in any respect, refuses before dispatch at the affected body or part: the decode is never partially applied, no non-alphabet character is skipped, and no repair supplies missing padding. The response direction has no counterpart because encoding the exact octets always succeeds.

**[exclusion]** This specification does not generate XML from an object model because the OAS XML Object does not determine complete document bytes; the selected media alternative is excluded until an incorporated authority defines ordering, escaping, nulls, dynamic keys, and scalar lexical forms, while string and raw-octet XML carriage remain admitted ([OAS 3.1.2 §§4.8.14, 4.8.26](https://spec.openapis.org/oas/v3.1.2.html#xml-object)).

**[convention]** Because `readOnly` and `writeOnly` are annotations whose enforcement OAS leaves to the application, this binding never uses them to delete a supplied wire member or synthesize an absent one ([OAS 3.1.2 §4.8.24.3.2](https://spec.openapis.org/oas/v3.1.2.html#validating-readonly-and-writeonly)).

**[exclusion]** A concrete request or response selection admitted by none of §3.2's five lanes is excluded at its smallest media owner because OAS supplies no value-to-bytes mapping; the exclusion reopens only if an incorporated authority defines that media/data-form cell.

**[convention]** Invoking this binding does not trigger validation of any application value against its governing Schema Object; only a tool that separately claims validation owes Core's validation rules (Core [invariant 2](../../openbindings.md#2-core-invariants), [OBI-T-16](../../openbindings.md#103-tool-rules)).

### 9.3 Form bodies and multipart parts

**[incorporated]** `application/x-www-form-urlencoded` and `multipart/form-data` serialize object properties under the governing Schema and Encoding Objects, and a `schema` is REQUIRED to define the input parameters when using multipart content ([OAS 3.1.2 §§4.8.15.2, 4.8.15.3](https://spec.openapis.org/oas/v3.1.2.html#encoding-the-x-www-form-urlencoded-media-type)).

**[limit]** A `multipart/form-data` alternative declaring no `schema` is upstream-invalid and is removed at its smallest media owner, accounted `invalid`, because the edition's REQUIRED marker leaves the part set undetermined and this specification derives no part from an absent declaration; a schema-omitted non-multipart binary declaration is expressly permitted and takes §9.2's raw-octet lane. The confinement reopens only if an incorporated OAS edition removes that requirement, as the 3.2 line does.

**[exclusion]** The form and multipart lanes are request-only: the incorporated authority's form and multipart sections are request-scoped by their own headings and supply no reverse mapping from those bytes to an application value, so a response selection of either lane is excluded at its smallest media owner. The exclusion reopens only if an incorporated authority defines that decoding.

**[convention]** A supplied `body: null` against a form or multipart object declaration refuses before dispatch: these lanes serialize the **members** of an object, and a null body supplies no member set at all, so there is nothing to elide and nothing to write, whereas a null property is a present, empty member the rule below elides.

**[limit]** A non-object declaration is upstream-invalid for the form lane and removes that lane at its smallest owning unit under §3.2's smallest-owner rule, accounted `invalid`.

**[incorporated]** For a dynamic object member, the resolved property declaration conjoins an exact `properties` schema and every matching `patternProperties` schema, or uses `additionalProperties` when no exact or pattern schema matches; applicable `allOf` constraints remain in force ([JSON Schema Core §10.3.2](https://json-schema.org/draft/2020-12/json-schema-core.html#section-10.3.2)).

**[convention]** For form-carriage selection, a resolved property declaration uses §5.2's sole-non-null-choice member; the 3.1 spelling `type: [<non-null-type>, "null"]` contributes the same resolved type set ([OAS 3.1.2 §§4.4, 4.8.15.1.1, Appendix B](https://spec.openapis.org/oas/v3.1.2.html#appendix-b-data-type-conversion)).

**[incorporated]** When any Encoding `style`, `explode`, or `allowReserved` control selects the RFC 6570 style path, a supplied JSON null follows §8.1's corrected `undefined` cell for the effective `style` and `explode`; it is not blanket-elided ([OAS 3.1.2 §§4.8.15.1, C.4](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-12)).

**[convention]** After content-based form encoding selects an explicit concrete `contentType` or determines its default, a supplied null property is elided as an omitted optional member and contributes neither a form-urlencoded field nor a multipart part; this rule is separate from §8.1's style-path handling.

**[limit]** Elision is available only where omission is faithful. A supplied null for a property the governing resolved declaration marks required cannot be dropped without producing a form the declaration does not describe, so that invocation refuses before dispatch; sibling properties and media alternatives remain usable for other values.

**[limit]** That elision identifies `{}` and `{"x": null}` on the wire: a deliberate loss inside the authority's data-type-conversion latitude, disclosed here — the distinction between an absent optional member and an explicit null does not survive this lane ([OAS 3.1.2 Appendix B](https://spec.openapis.org/oas/v3.1.2.html#appendix-b-data-type-conversion)).

**[incorporated]** Encoding `style`, `explode`, and `allowReserved` controls apply to both form-urlencoded and multipart/form-data; explicit presence of any control selects RFC 6570-style serialization and absent sibling controls take their defaults, while absence of all three selects content-based encoding ([OAS 3.1.2 §§4.8.15.1, C.4](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-12)).

**[incorporated]** Form-urlencoded removes RFC 6570's leading `?`; multipart writes values inside named parts with no URI percent-encoding, and `allowReserved` has no multipart effect ([OAS 3.1.2 Appendix C](https://spec.openapis.org/oas/v3.1.2.html#appendix-c-using-rfc6570-based-serialization)).

**[incorporated]** The form-urlencoded content path follows RFC 1866 form encoding while the style path follows RFC 6570, which "does not use `+` for form-urlencoded"; the two paths therefore spell one value differently and this specification does not collapse them into one ([OAS 3.1.2 Appendix E.4](https://spec.openapis.org/oas/v3.1.2.html#appendix-e-percent-encoding-and-form-media-types), [RFC 1866 §8.2.1](https://www.rfc-editor.org/rfc/rfc1866#section-8.2.1), [RFC 6570](https://www.rfc-editor.org/rfc/rfc6570)).

**[convention]** Within the content-based form-urlencoded path the authority permits more than one byte spelling, and this specification declares the permitted set rather than collapsing an expressly preserved alternative: SPACE is written `+` or `%20`, `~` is written literally or as `%7E`, every other RFC 3986 unreserved byte stays literal, and every other UTF-8 byte is written as uppercase `%HH`. Every member of that set percent-decodes, under form-urlencoded decoding, to the supplied value, which is what makes the set safe to leave open; two conformant processors may therefore emit different bytes here, and that is the declared permitted set, not a divergence. §12.4's JSON-image latitude is a separate axis ([OAS 3.1.2 §4.8.12.4](https://spec.openapis.org/oas/v3.1.2.html#url-percent-encoding), [Appendix E.4.1–E.5](https://spec.openapis.org/oas/v3.1.2.html#appendix-e-percent-encoding-and-form-media-types)).

**[incorporated]** **On the content-based path only**, a property's Encoding media type is selected as follows: an explicit single concrete Encoding `contentType`; otherwise `application/octet-stream` for a typeless resolved declaration or one that admits `string` as its sole non-null type with `contentEncoding`, `text/plain` for a plain string or number/integer/boolean, `application/json` for an object, and the item-type default for an array. The selection governs both lanes that carry Encoding Objects — the content-based form-urlencoded path and multipart parts, where the selected type is the part's `Content-Type` — because the edition places `contentType` among the fields usable with or without the RFC 6570-style fields; on the style path the edition says the value of `contentType`, implicit or explicit, SHALL be ignored, so neither an explicit `contentType` nor this table applies there ([OAS 3.1.2 §§4.8.15.1.1, 4.8.15.1.2](https://spec.openapis.org/oas/v3.1.2.html#common-fixed-fields-0)).

**[limit]** A content-form property or multipart part whose resolved declaration admits no instance — a boolean `false` Schema Object, or §5.2's empty intersection — is an unreachable defect under §3.2's smallest-owner rule: no value can reach it, so it is not a routed field, it destroys neither its media alternative nor its target, both are accounted represented, and the declaration is carried into the synthesized contract as written. A value supplied for it fails every admission test and refuses before dispatch at that part or property, which is §5.2's consequence and not a new rule.

**[convention]** The item-type default for an array can select a media type — `text/plain` for primitive items — under which no accepted edition defines the serialization of the whole compound value, and this specification authors no bytes there: such a property has no governed wire form and requires an explicit choice naming a concrete media type whose lane does define the bytes, either an explicit single concrete Encoding `contentType` in the artifact or the `propertyMedia` configuration point. An invocation supplying such a property without that choice refuses before dispatch as the context-required species, carrying the `propertyMedia` requirement; the item-derived default itself is not displaced.

**[convention]** A style-path part therefore carries no `Content-Type` header at all: the authority removes every `contentType` input and states no replacement, and the part's content is RFC 6570-serialized text, for which an absent part `Content-Type` already means `text/plain` ([RFC 7578 §4.4](https://www.rfc-editor.org/rfc/rfc7578#section-4.4)). A part whose media type this specification cannot state is never given a guessed one.

**[pin]** On both content-based lanes, a supplied JSON number or boolean written into a `text/plain` part or form field is written as its shortest RFC 8259 lexical form — `true` and `false` for booleans, and for a number the shortest spelling that round-trips the supplied value under RFC 8259 §6. This is a serialization by media type and not a `parameterConversion` site, since §8.1's converter is scoped to the `schema`-form and RFC 6570-style paths and an artifact-determined byte must not depend on a consumer choice ([RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259#section-6), [OAS 3.1.2 §4.8.15.1.1](https://spec.openapis.org/oas/v3.1.2.html#common-fixed-fields-0)).

**[incorporated]** Every `multipart/form-data` part carries `Content-Disposition: form-data` with the schema-property name in its `name` parameter; an array property emits one part per element under that same name ([OAS 3.1.2 §§4.8.15, 4.8.15.3](https://spec.openapis.org/oas/v3.1.2.html#encoding-multipart-media-types)).

**[pin]** That `name` parameter value is emitted as a quoted-string over the exact schema-property-name Unicode scalar sequence encoded as UTF-8. A `qdtext` byte is emitted literally, each DQUOTE or backslash is preceded by exactly one backslash, and no other byte is escaped or percent-encoded. [RFC 9110 §5.6.6](https://www.rfc-editor.org/rfc/rfc9110#section-5.6.6) permits quoted and unquoted spellings but fixes neither choice nor quoted-pair use; this specification's single spelling closes those bytes.

**[pin]** A generated `Content-Disposition` carries neither `filename` nor `filename*`. The operation boundary supplies a value, not local file metadata, so inventing either parameter would emit information neither artifact nor caller declared. A conforming artifact-fixed Encoding Header Object may carry a literal `filename` parameter, which remains part of its verbatim field value; the binding never derives one from the supplied value.

**[exclusion]** A non-ignored Encoding `Content-Disposition` Header Object on a name-based part is admissible only when its resolved schema fixes exactly one string through `const` or a single-member `enum`, that string is a valid field value whose parsed disposition type is `form-data`, its `name` parameter equals the exact schema-property name, and it contains no `filename*` parameter. Otherwise the multipart alternative is excluded because the artifact declaration and OAS's mandatory name mapping do not determine one valid field, or because RFC 7578 expressly forbids `filename*` in `multipart/form-data`. An admissible fixed value, including any literal `filename` parameter, is emitted verbatim in place of the generated spelling above. The `filename*` exclusion reopens only if incorporated multipart authority permits that parameter ([RFC 7578 §4.2](https://www.rfc-editor.org/rfc/rfc7578#section-4.2)).

**[incorporated]** A multipart entity's parts are delimited with a boundary delimiter constructed from CRLF, `--`, and the value of the `boundary` parameter carried on the emitted media type; the delimiter MUST NOT appear inside any encapsulated part. The entity opens with `--`, the boundary value, and CRLF; each subsequent part is preceded by CRLF, `--`, the boundary value, and CRLF; the entity closes with CRLF, `--`, the boundary value, and a final `--`; and only CRLF represents a line break between parts. The boundary value is 1 to 70 characters of RFC 2046's `bchars` not ending in white space, and a composer MUST NOT generate non-zero-length transport padding ([RFC 7578 §4.1](https://www.rfc-editor.org/rfc/rfc7578#section-4.1), [RFC 9110 §8.3.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3.3), [RFC 2046 §5.1.1](https://www.rfc-editor.org/rfc/rfc2046#section-5.1.1)).

**[convention]** The processor generates that boundary token and this binding declares no generation procedure: any token satisfying the incorporated grammar that appears in no encapsulated part discharges the requirement, and neither the token nor its optional quoting on the media-type field is portable meaning. The binding emits no preamble and no epilogue, both optional and discardable under the incorporated grammar.

**[convention]** A `boundary` parameter carried by a declaration key or a `requestMedia` choice takes part in §9.1's matching and is then discarded for emission; the token this binding generates is the one emitted and the one that delimits. This is the one exception to §9.1's emitted-spelling pin: no incorporated authority makes a declared `boundary` bind the sender — RFC 2046 §5.1.1 leaves the value for the composer to choose and RFC 7578 §4.1 has the sender supply it — and honoring a declared one would make load-bearing a value the rule above declares free.

**[exclusion]** A property name containing a non-scalar lone surrogate or any byte outside RFC 9110 `qdtext` plus DQUOTE and backslash after UTF-8 encoding — CR, LF, NUL, another forbidden control, or DEL included — excludes only that multipart media alternative. The exclusion reopens only if incorporated authority defines an unambiguous encoding.

**[convention]** Repeated parts for one array preserve element order; cross-property part order has no portable meaning, while property-to-name membership is fixed.

**[convention]** A part with a typeless resolved declaration uses the raw-octet lane and §9.2's canonical Base64 boundary; a part whose resolved declaration admits `string` as its sole non-null type with `contentEncoding` remains artifact-encoded text.

**[pin]** Neither case emits a `Content-Transfer-Encoding` field. The edition's equivalence — using `contentEncoding` for a multipart field "is equivalent to specifying an Encoding Object with a `headers` field containing `Content-Transfer-Encoding`" — describes what the declaration means, not a field a serializer adds; the same section notes the field is deprecated for `multipart/form-data`, and RFC 7578 §4.7 says senders SHOULD NOT generate it. The pin reopens only if an incorporated OAS edition states the emission as a serialization requirement ([OAS 3.1.2 §4.8.15.3](https://spec.openapis.org/oas/v3.1.2.html#encoding-multipart-media-types), [RFC 7578 §4.7](https://www.rfc-editor.org/rfc/rfc7578#section-4.7)).

**[configuration point]** On the content-based path for either `application/x-www-form-urlencoded` or `multipart/form-data`, a wildcard or comma-separated multi-valued Encoding `contentType` — and equally a selected default media type under which the resolved compound type has no defined serialization, the case §9.3's compound-default rule states — requires one concrete `propertyMedia` choice for each affected form or multipart property; the choice MUST satisfy a declared member under §9.1, and an absent, unmatched, or ambiguous required choice refuses before dispatch.

**[incorporated]** Two Encoding `headers` cases are ignored before any rule of this section reads the map: the map itself "SHALL be ignored if the request body media type is not a `multipart`", and within it "`Content-Type` is described separately and SHALL be ignored in this section" ([OAS 3.1.2 §4.8.15.1.1](https://spec.openapis.org/oas/v3.1.2.html#encoding-headers)).

**[pin]** After references are resolved and invalid Header projections are confined, surviving non-ignored Encoding Header Object keys compare ASCII case-insensitively and every case-equivalent entry governs one part field; map order and key spelling supply no preference. A schema-form declaration fixes an exact value only through `const` or a single-string `enum`; `default` and examples do not fix one, and a content-form declaration fixes no exact artifact value under this identifier. A case-folded group is artifact-fixed when at least one member fixes one value, every fixed member fixes that same value, and every other binding-understood exact finite raw-string domain includes it. No inverse `simple` or content-form deserialization is invented; other schema constraints are coverage loss and impose no binding constraint on the emitted field. The group emits its fixed value once. When no member fixes a value, the group is required if any member declares `required: true`; otherwise it remains descriptive and emits nothing. This pin reopens only if incorporated OAS authority defines co-present case-variant resolution or exact content-form emission.

**[exclusion]** Every non-ignored Encoding header name MUST be an HTTP `token`, and every artifact-fixed group value MUST be a valid HTTP field value. Conflicting fixed values, a member that rejects the group's fixed value, a non-token name, or an invalid fixed field value excludes the multipart alternative before dispatch because no single safe field satisfies the declarations. Case-folded groups are resolved first, so a group-internal conflict owns that alternative-level exclusion; the narrower `contentEncoding`/`Content-Transfer-Encoding` equivalence rule applies only to a surviving coherent group. The exclusion reopens only if incorporated authority defines a different combination or safe wire mapping. Each surviving artifact-fixed header is emitted verbatim, except that `Content-Transfer-Encoding` remains governed by the no-emission pin above and `Content-Disposition` by the mandatory name-mapping rule.

**[exclusion]** A required case-folded Encoding-header group that fixes no exact value excludes the multipart alternative because this specification defines no caller part-header channel. A nonfixed optional group remains descriptive and is not emitted. An ignored entry, `Content-Type` included, triggers neither rule. This exclusion reopens only if an incorporated authority defines caller part-header carriage ([OAS 3.1.2 §4.8.15.1.1](https://spec.openapis.org/oas/v3.1.2.html#encoding-headers), [RFC 9110 §§5.1, 5.5](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[exclusion]** Where a multipart field carries `contentEncoding` and a surviving Encoding `Content-Transfer-Encoding` Header Object whose schema disallows that value, the edition states that the result is undefined for serialization and parsing; this specification excludes the multipart media alternative rather than choosing between two encodings the artifact declares at once. The exclusion reopens only if an incorporated OAS edition defines that conflict's outcome ([OAS 3.1.2 §4.8.15.3](https://spec.openapis.org/oas/v3.1.2.html#encoding-multipart-media-types)).

**[exclusion]** A multipart media type other than `multipart/form-data` is excluded because OAS defines no property-to-part correlation for it; the exclusion reopens only if an incorporated OAS edition defines that correlation ([OAS 3.1.2 §4.8.14.5](https://spec.openapis.org/oas/v3.1.2.html#special-considerations-for-multipart-content)).

### 9.4 HTTP content codings

**[incorporated]** HTTP `Content-Encoding` is distinct from media type and from Schema Object `contentEncoding`; request codings apply in listed wire order and response codings decode in reverse order before the selected media lane ([RFC 9110 §8.4](https://www.rfc-editor.org/rfc/rfc9110#section-8.4), [OAS 3.1.2 §4.4.2](https://spec.openapis.org/oas/v3.1.2.html#working-with-binary-data)).

**[incorporated]** HTTP field names compare ASCII case-insensitively, and the case sensitivity of OAS names that map directly to HTTP concepts follows HTTP's rules ([OAS 3.1.2 §3.8](https://spec.openapis.org/oas/v3.1.2.html#case-sensitivity), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[convention]** OAS 3.1 defines no specialized content-coding keyword. An effective request Header Parameter or governing response Header Object named `Content-Encoding` describes, and where applicable constrains, that ordinary HTTP field; the declaration alone neither selects a coding nor emits a field, and it is not permission the processor needs before honoring an actual field. An absent declaration therefore imposes no content-coding constraint and does not declare `identity` ([OAS 3.1.2 §§4.8.12, 4.8.17, 4.8.21](https://spec.openapis.org/oas/v3.1.2.html#header-object)).

**[exclusion]** Every response Header Object map key MUST be an HTTP field-name `token`. A non-token key excludes that header projection as subordinate coverage loss. An optional projection propagates no further; one declaring `required: true` makes the smallest owning response alternative excluded because no HTTP response can satisfy it. A successful response governed by that excluded alternative is a loud response-phase protocol error, while failure data remains governed by §9.5's best-effort rule. This exclusion reopens only if incorporated HTTP authority admits that exact field-name form ([RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[pin]** A schema-form Header contributes one binding-understood exact finite raw-string domain only when §5.2's resolved type set has `string` as its sole non-null type. After Schema `$ref` resolution, collect every applicable string-valued `const` and every `enum` at the schema root and recursively in each `allOf` branch; a `const` contributes its singleton, while an `enum` contributes its distinct string-valued members with non-string members discarded. The Header's domain is the intersection of all contributed sets, so an enum with no strings or a non-string const contributes the empty set. No contributed set means no binding value constraint. Reference Object siblings remain governed by §5.1 and are not silently composed.

**[pin]** After references are resolved, invalid Header projections are confined, and `Content-Type` is ignored, surviving Response Header Object keys compare ASCII case-insensitively and every case-equivalent member governs one actual HTTP field; map order and key spelling supply no preference. One received field satisfies the group's presence obligation, and the group is required when any surviving member declares `required: true`. For `Content-Encoding`, the actual field MUST belong to every binding-understood exact finite raw-string domain contributed by the group. No inverse `simple` or content-form deserialization is invented: other schema constraints and content-form Headers contribute presence only, are synthesis coverage loss, and impose no binding value constraint, while the actual field still fixes the coding stack. Ordinary response-header declarations create no output member, and case variation alone never excludes a response alternative. This pin reopens only if incorporated OAS authority defines co-present case-variant resolution or broader response-header validation ([OAS 3.1.2 §4.8.21](https://spec.openapis.org/oas/v3.1.2.html#header-object), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[exclusion]** A required case-equivalent `Content-Encoding` group excludes its response alternative only when its binding-understood exact finite raw-string domains have an empty intersection, including disjoint string `const` or `enum` sets; an optional group remains satisfiable by absence, and lack of proof is not exclusion. Otherwise an actual field is checked against every such domain at response time. This exclusion reopens if incorporated OAS authority defines a different co-present constraint composition.

**[pin]** The actual `Content-Encoding` field fixes the coding stack. On a request, that is the effective caller-supplied Header Parameter value after §8 serialization; on a response, it is the field received from the peer whether or not the governing Response Object declares it. Multiple field-line values are trimmed of surrounding OWS and combined in arrival order with exactly comma-plus-SP before the resulting complete string is tested against an exact raw-string domain; the coding list is then split on `,` with surrounding whitespace removed, and tokens compare ASCII case-insensitively. The request applies the listed codings in order and the response removes them in reverse order; an absent field names an empty stack, and `identity` is a no-op requiring no codec ([RFC 9110 §§5.2–5.3](https://www.rfc-editor.org/rfc/rfc9110#section-5.2), [§8.4](https://www.rfc-editor.org/rfc/rfc9110#section-8.4)).

**[exclusion]** A request `Content-Encoding` field requires a request representation to encode. Supplying that Header Parameter on an invocation that emits no body refuses before dispatch, even for `identity`. The target is excluded only when, after invalid, excluded, and method-ignored request lanes are removed, no conforming invocation can emit a request representation and the field is required; otherwise the target remains represented and only each body-free invocation required or supplied to emit the field refuses. An omitted optional field remains compatible with a body-free invocation. This exclusion reopens only if incorporated HTTP authority defines Content-Encoding on a request with no representation.

**[limit]** Content-coding implementations are runtime capabilities, not binding configuration points: this specification requires no fixed supported set and defines no codec API. A non-`identity` token for which the runtime has no single case-insensitive encoder or decoder is unsupported; capability names that collide after ASCII case-folding do not supply a single codec for that token.

**[convention]** A malformed coding list or a response field outside a binding-understood exact finite raw-string domain is never skipped or sniffed: a request-side condition refuses before dispatch and a response-side condition is a loud protocol error. An unsupported or ambiguous token or codec failure has that same outcome only when the representation is actually encoded or decoded. HEAD and the no-content statuses in §9.5 still parse the field grammar and apply every governing raw-string domain, but they neither require nor invoke a content decoder. A runtime-supplied or built-in codec supplies capability but never selects a coding, while absence of a governing response Header Object supplies no constraint and is not an error.

### 9.5 Response declaration, classification, and decoding

**[convention]** Throughout this section, every Response Object, Header Object, and Media Type Object named is the declaration that remains after §5.1's reference resolution. The edition types a Responses member as `Response Object | Reference Object` and a `headers` member as `Header Object | Reference Object`, so the fixed-field rules below read the resolved declaration and never treat a Reference Object as a violation of the object it references ([OAS 3.1.2 §§4.8.16, 4.8.17.1](https://spec.openapis.org/oas/v3.1.2.html#responses-object)).

**[incorporated]** Response keys are closed to exact three-digit status codes `100` through `599`, the five ranges `1XX` through `5XX`, `default`, and specification extensions; an exact key overrides its matching range ([OAS 3.1.2 §§3.7, 4.8.16](https://spec.openapis.org/oas/v3.1.2.html#responses-object), [RFC 9110 §15](https://www.rfc-editor.org/rfc/rfc9110#section-15)).

**[limit]** A Responses key outside that closed admitted set is upstream-invalid at that subordinate entry, is accounted `invalid`, and never participates in response lookup. It does not remove the selected target while another admitted exact, range, or `default` field keeps a present Responses Object usable; if discarding every invalid key leaves a present object with no such field, §6.1's response-declaration rule makes the target `invalid`. The entry-level confinement reopens only if an incorporated OAS 3.1 edition admits that exact key form.

**[limit]** An admitted exact, range, or `default` key retains its lookup precedence even when its value or one fixed member is upstream-invalid; invalidity never makes lookup fall through to a less-specific key. A value that is not a Response Object makes that response alternative `invalid`. Within an object, invalidity is confined to the smallest defective projection: a missing or non-string `description`, a non-map `content`, `headers`, or `links`, or one non-Header member of `headers`. An invalid header projection imposes no response constraint on success or failure, while every valid sibling Header projection still governs. The target and every valid sibling projection remain represented, and synthesis derives no contract from an invalid projection ([OAS 3.1.2 §4.8.17.1](https://spec.openapis.org/oas/v3.1.2.html#response-object)).

**[convention]** For an admitted key whose governing response value or body projection is invalid, a successful response with zero content octets completes with no output; a successful non-empty response is a loud response-phase protocol error unless a surviving valid content projection and selected media lane decode it. A failure response instead follows the best-effort rule below and carries no failure data when its governing body projection is invalid. These outcomes do not change lookup precedence or target addressability.

**[limit]** A Response Object that omits its REQUIRED `description`, or supplies a non-string one, is upstream-invalid at that documentary projection. A non-map `links` is likewise invalid only at a projection this binding never invokes. Because this binding reads neither position during invocation nor projects either into an operation value, those defects are coverage loss only and every valid content or header sibling still governs.

**[limit]** That documentary invalidity reads a REQUIRED marker OAS 3.0.4 and OAS 3.1.2 both carry on the Response Object's `description`; OAS 3.2.0 drops the marker and adds a `summary` field, so on the 3.2 line omission is not a violation — an edition difference, never sibling drift ([OAS 3.1.2 §4.8.17.1](https://spec.openapis.org/oas/v3.1.2.html#response-object) and [OAS 3.0.4 §4.7.17.1](https://spec.openapis.org/oas/v3.0.4.html#response-object) against [OAS 3.2.0 §4.17.1](https://spec.openapis.org/oas/v3.2.0.html#response-object)).

**[convention]** The governing Response Object lookup order is exact status, then the single matching range, then `default`; range-over-default is this specification's reading, and declarations never reclassify the native status.

**[incorporated]** RFC 9110 defines the 2xx class as successful ([RFC 9110 §15.3](https://www.rfc-editor.org/rfc/rfc9110#section-15.3)).

**[convention]** For this binding, success means that the final status—the status after any interim responses and any redirects the runtime chose to follow with the bound method and complete body preserved—is in that 2xx class; a method-rewriting redirect is the final response of this interaction, and anything a runtime does after it is a different interaction outside this classification.

**[convention]** Redirect following is runtime policy. A redirect followed with the bound method and complete body preserved remains this interaction; a method-rewriting redirect is a final response of this interaction ([RFC 9110 §15.4](https://www.rfc-editor.org/rfc/rfc9110#section-15.4)).

**[pin]** When the runtime follows a redirect with method and body preserved, it forwards or reconstructs binding-selected header credentials and Cookie contributions only for the same origin. Origins are equal when the lowercased scheme, case-insensitive host, and effective port agree after applying the default ports for `http` and `https`. On a different-origin hop the runtime MUST NOT forward or reconstruct Authorization, header API-key, raw Cookie, or structured Cookie contributions selected by this binding. A binding-selected query credential is never appended to a redirect Location on any hop. RFC 9110 advises removal of resource-specific fields such as Authorization and Cookie before an automatic redirect, and this pin makes that protection deterministic for binding-owned credential channels; ordinary parameter values whose sensitivity OAS cannot express remain the consumer's responsibility ([RFC 9110 §15.4](https://www.rfc-editor.org/rfc/rfc9110#section-15.4)).

**[limit]** Outcome classification depends on the final status, while redirect following and transport content negotiation, including a runtime-advertised `Accept-Encoding`, are runtime policy under Core §1.2. Two conformant runtimes MAY therefore classify one wire history differently, and that redirect/negotiation variance is the stated permitted set; the binding itself emits no negotiation field beyond those this specification pins (Core [§1.2](../../openbindings.md#12-out-of-scope)).

**[incorporated]** A response Header Object named `Content-Type` is ignored. Every other governing response Header Object declaring `required: true` makes that header mandatory in the actual response ([OAS 3.1.2 §§4.8.17, 4.8.21](https://spec.openapis.org/oas/v3.1.2.html#response-headers)).

**[limit]** An actual response missing such a declared required header is a loud protocol error, in the same class as the undeclared non-empty-response error below; header carriage remains outside the operation-value boundary.

**[incorporated]** A non-empty response selects its concrete media type from `Content-Type` and then the most-specific matching governing content declaration ([OAS 3.1.2 §§4.8.16, 4.8.17](https://spec.openapis.org/oas/v3.1.2.html#response-object)).

**[convention]** An unmatched, ambiguous, normalized-colliding, or matched-but-excluded result is a loud protocol error on a successful response; on an unsuccessful one the best-effort failure-body rule below governs, and no loud protocol error is raised; an unused excluded response sibling never makes the target unusable before dispatch.

**[convention]** When a non-empty response omits `Content-Type`, the binding takes RFC 9110's permitted `application/octet-stream` assumption before ordinary matching; the resulting type still MUST match a governing declaration ([RFC 9110 §8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3)).

**[convention]** A response carrying two or more `Content-Type` fields, or one whose single field value is a list of media types, selects no media type: RFC 9110 §8.3 defines `Content-Type` as a single `media-type`, names that shape as an interoperability and security hazard, and defines no resolution, and its `application/octet-stream` assumption is granted for an absent field, not a present one. On a successful response it is a loud protocol error; on an unsuccessful one no governing content declaration matches, so the best-effort failure-body rule below yields no failure-data value and no protocol error ([RFC 9110 §8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3)).

**[convention]** For a status that permits HTTP content, an **empty response** has zero content octets after transfer decoding and content-coding decoding. For HEAD and a status that forbids content, the no-content check instead examines transfer-decoded octets before any `Content-Encoding` removal: any nonzero octet count is forbidden content, even when those octets would decode to an empty representation. A response to HEAD is empty only for operation-output purposes.

**[incorporated]** A response to HEAD and any `1xx`, `204`, `205`, or `304` response carries no HTTP content. A `1xx` response other than `101` is interim and does not classify the interaction. A `101 Switching Protocols` response instead continues the request under a different application protocol ([RFC 9110 §§6.4.1, 15.2.2, 15.3.6](https://www.rfc-editor.org/rfc/rfc9110#section-6.4.1)).

**[convention]** Because this binding never emits `Upgrade` and defines no switched-protocol continuation, receiving `101` is immediately a loud protocol error at the response phase, and the processor MUST NOT wait for a later HTTP final response. For the remaining no-content cases the binding performs no content decoding and emits no output value regardless of declared response content. Required response-header rules still apply, and actual content where HTTP forbids it is a loud protocol error.

**[limit]** A declared response-body projection that can govern only one of those no-content cases is excluded as subordinate coverage loss while the operation remains represented. It reopens only if incorporated HTTP authority permits content for that case.

**[convention]** Empty responses emit no output value; successful non-empty responses emit the selected lane's one application value.

**[convention]** A failure body is decoded through the same selected carriage lanes as a successful body, and the decoded value is carried as opaque application-authored failure data on unsuccessful completion. That decoding is best-effort: when the governing content declaration is defective, absent, or no governing content declaration matches the actual media type, the interaction completes unsuccessfully with no failure-data value and raises no loud protocol error, which is why a failure declaration is not load-bearing for representation. A governing invalid Response alternative is read the same way wherever it governs: a non-object supplies no fixed members, and each defective member is treated as absent, so a non-map `headers` enforces no required response header and a non-map `content` selects no lane. OAS 3.1 describes `content` as potential payloads rather than stating that omission forbids a body; omission therefore selects no decodable failure-data lane. A successful non-empty response with no surviving content lane remains a loud protocol error under the rule above.

**[convention]** The unary response value commits only after transfer completion and the full decode chain — content codings, then character decoding, then the selected lane — succeed; any failure after a 2xx final status and before that commit is a loud protocol error, and the interaction completes unsuccessfully with no partial unary value.

**[limit]** A non-empty successful response with no governing Response Object is a loud protocol error because no output lane governs it, even though omission of `responses` leaves the operation addressable. A non-empty unsuccessful response with no governing Response Object completes unsuccessfully with no failure data and no added protocol error. This specification defines no response-header or Link carriage in an operation value, so Response Header and Link Objects create no output members under this identifier; consequently, even a declared `Location` header on a `201` response reaches no operation value ([OAS 3.1.2 §§4.8.10.1, 4.8.17](https://spec.openapis.org/oas/v3.1.2.html#operation-responses)).

**[limit]** One HTTP response body produces at most one operation value: the accepted 3.1 editions define no construct that frames one response body into multiple application values, including for `text/event-stream`.

## 10. Servers and target URL

**[incorporated]** Server declarations are scoped at Operation, Path Item, and root levels, with the more specific declaration overriding the outer scope; an absent or empty root list is equivalent to one Server Object whose URL is `/` ([OAS 3.1.2 §§4.8.1.1, 4.8.5, 4.8.9.1, 4.8.10.1](https://spec.openapis.org/oas/v3.1.2.html#server-object)).

**[convention]** An empty Operation or Path Item `servers` array supplies no local alternative and falls through to the next outer scope, matching the root empty-equals-absent precedent.

**[configuration point]** One effective server selects itself; multiple members require one consumer `server` choice before dispatch, the same value carries exact variable substitutions, and no member or variable preference is inferred.

**[incorporated]** Server variables substitute into the URL where named in braces, and `default` is REQUIRED and "SHALL be sent if an alternate value is not supplied". A declared `enum` "MUST NOT be empty", and where an enum is defined the **`default`** value "MUST exist in the enum's values" ([OAS 3.1.2 §4.8.6.1](https://spec.openapis.org/oas/v3.1.2.html#server-variable-object)).

**[limit]** A present Server Variable Object with an absent or wrong-typed required `default`, an empty enum, or an out-of-enum default is upstream-invalid and makes only its owning Server alternative `invalid`; sibling alternatives survive. If none remains and complete-URL replacement can recover the target, the target stays represented with `configuration.server`; without recovery the invocation refuses before dispatch. This confinement reopens only if an incorporated OAS edition admits the malformed declaration.

**[pin]** That membership MUST binds `default` alone; the edition constrains no consumer-supplied value and states no consequence for one outside the enum. This specification extends the constraint and supplies the consequence: a consumer-supplied value for a variable with a declared `enum` MUST be a member of it. A URL template expression having no matching Server Variable Object has no declaration-derived default, but an exact consumer substitution may complete it; if declaration and configuration together leave any expression unresolved, the represented target is context-required on `configuration.server` before dispatch. The Server alternative is not excluded merely because the matching declaration is absent. These outcomes neither guess nor dispatch an undeclared host.

**[incorporated]** A Server URL MUST contain neither query nor fragment. Before path assembly, an expanded relative Server URL—including the implied `/`—resolves against the location of the document containing that Server Object; the operation's path bytes are then appended to the resolved Server URL with no relative URL resolution, which the edition states in those words ([OAS 3.1.2 §§4.7, 4.8.5.1, 4.8.8.1](https://spec.openapis.org/oas/v3.1.2.html#server-url)).

**[pin]** "Appended" is pinned here to one and only one seam repair: if the resolved and expanded Server URL ends in `/` and the exact Paths key begins with `/`, exactly one slash — the Server URL's trailing slash — is removed before the Paths key is appended; otherwise both operands are unchanged. No other slash normalization, path repair, dot-segment rewrite, query merge, or relative-reference resolution occurs. Thus the implied server `/` plus `/pets` yields `/pets`, while a Paths key beginning `//` or an additional trailing Server URL slash remains observable because the rule removes only the one redundant seam slash.

**[limit]** A Server alternative whose declaration-derived expansion — literal text plus variable defaults — contains a query or fragment is upstream-invalid and removes only that Server alternative, accounted `invalid`; sibling alternatives survive, and if none remains the represented target requires a conforming complete-URL replacement. A consumer substitution that introduces either component does not make the source declaration invalid; it is a nonconforming `server` choice and refuses that invocation before dispatch. The confinement reopens only if an incorporated OAS edition defines the exact cell.

**[exclusion]** A Paths key containing a literal `?` or `#` excludes only the targets under that key because the binding's append-then-query procedure would otherwise reinterpret path data as a query or fragment; path data with either byte must use percent-encoding. The exclusion reopens only if incorporated OAS authority defines that key's target mapping.

**[limit]** When embedded content has no document location to supply that base, a relative Server URL leaves the target unresolved and refuses before dispatch; the complete configured URL below remains the available recovery.

**[incorporated]** After path and query serialization, the completed target MUST parse and percent-decode under RFC 3986; an unusable target refuses before dispatch ([OAS 3.1.2 §4.8.12.4](https://spec.openapis.org/oas/v3.1.2.html#url-percent-encoding), [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)).

**[convention]** That parse and percent-decode is a well-formedness check only: the dispatched bytes are the constructed percent-encoded bytes, and the completed target is never dispatched in decoded form.

**[incorporated]** A sender MUST NOT generate an `http` or `https` target URI with an empty host or userinfo, and an untrusted reference containing userinfo ought to be treated as an error because it can obscure the intended authority ([RFC 9110 §§4.2.1–4.2.4](https://www.rfc-editor.org/rfc/rfc9110#section-4.2.1)).

**[exclusion]** An effective Server alternative whose declaration-derived absolute `http` or `https` expansion has an empty host or contains userinfo is excluded at that Server boundary; sibling alternatives survive. If none remains and complete-URL replacement can recover the target, the target remains represented with the `configuration.server` requirement below. A consumer variable substitution or configured URL that produces either condition does not change synthesis coverage; it is not a conforming choice and refuses before dispatch. This exclusion reopens only if incorporated HTTP authority permits such target generation.

**[convention]** A completed target whose scheme is not `http` or `https` refuses before dispatch, whether the scheme came directly from the artifact or a Server Variable substitution, because no incorporated authority defines that scheme's HTTP-semantics mapping. The completed target can still be changed by another effective `server` choice or by the complete configured URL below, so the operation stays addressable and represented and no declaration is excluded. This refusal rule reopens only if an incorporated authority defines that mapping.

**[configuration point]** Whenever declaration-derived defaults and alternatives leave no completed `http` or `https` target but §10's complete-URL replacement can recover the operation, `configuration.server` is an actual requirement. Synthesis MUST record that requirement on the represented target, and invocation without a conforming replacement refuses before dispatch while awaiting `configuration.server` rather than excluding the target.

**[configuration point]** The `server` configuration point MAY instead supply one complete consumer-configured URL. That URL is itself a valid `server` value and by itself discharges any required member choice; it MUST use `http` or `https`, have a nonempty host, and contain no userinfo, query, or fragment. It replaces the resolved server base, and the operation's path bytes join to it under the preceding boundary rule; the artifact's path template, path substitution, query construction, method, parameters, body, response, and security semantics remain unchanged.

## 11. Security and channel assembly

**[incorporated]** Operation `security` replaces root `security`; `[]` means no security requirement, array members are OR alternatives, every nonempty Security Requirement Object is an AND of its named schemes, and `{}` is a complete anonymous alternative ([OAS 3.1.2 §§4.8.10.1, 4.8.30](https://spec.openapis.org/oas/v3.1.2.html#security-requirement-object)).

**[configuration point]** The binding preserves every complete alternative and invents no anonymous-versus-credentialed preference. The named configuration point `security` selects one complete alternative: a sole declared alternative selects itself, and an effective empty `[]` or anonymous optional-security alternative counts as a complete no-security alternative; multiple alternatives require an explicit choice, fragments from different alternatives are never combined, and an invocation with no selection where one is required refuses before dispatch.

**[incorporated]** A TRACE client MUST NOT generate request fields containing sensitive data; credentials and cookies are expressly within that class ([RFC 9110 §9.3.8](https://www.rfc-editor.org/rfc/rfc9110#section-9.3.8)).

**[exclusion]** On a `trace` target, every security alternative whose binding carriage would emit Basic, Bearer, or API-key credential bytes is excluded before selection because TRACE reflects the request and this binding will not place credentials in it; anonymous and `mutualTLS` alternatives remain usable. A required raw or structured Cookie parameter likewise excludes the target, while supplying an optional Cookie source refuses before dispatch. An unmodeled security prerequisite may survive only when the runtime satisfies it without adding a sensitive request field. Other ordinary parameter values have no machine-readable sensitivity classification in OAS, so their classification remains the consumer's responsibility. This exclusion reopens only if incorporated HTTP authority permits sensitive data in TRACE.

**[incorporated]** Requirement arrays for OAuth 2.0 and OpenID Connect contain scopes, arrays for other schemes may contain roles, and this binding surfaces those exact strings without interpreting roles in-band or executing acquisition flows ([OAS 3.1.2 §4.8.30.1](https://spec.openapis.org/oas/v3.1.2.html#security-requirements-name)).

**[convention]** Whether a supplied credential satisfies a required scope is the counterparty's own determination and is never evaluated by this binding: a scope string is surfaced exactly as declared, in the alternative's requirement data and in any context challenge, and no incorporated authority defines a way for a client to read a token's grants without invoking an endpoint, which this binding never does. An OAuth 2.0 or OpenID Connect alternative is complete when its scheme's runtime access token is supplied and satisfies the Bearer input rule below; a token the counterparty finds insufficient produces that counterparty's own response, classified under §9's ordinary response rules like any other outcome.

**[configuration point]** `implicitConnectionScope` selects `entry` or `referring` document resolution for Security Requirement names and defaults to `entry`, following OAS's recommended entry-document scope while preserving the explicit alternative ([OAS 3.1.2 §4.3.3](https://spec.openapis.org/oas/v3.1.2.html#resolving-implicit-connections)).

**[incorporated]** HTTP authentication-scheme tokens compare ASCII case-insensitively ([RFC 9110 §11.1](https://www.rfc-editor.org/rfc/rfc9110#section-11.1), [OAS 3.1.2 §4.8.27.1](https://spec.openapis.org/oas/v3.1.2.html#security-scheme-scheme)).

**[incorporated]** A Security Scheme Object declares a REQUIRED `type` from the closed set `apiKey`, `http`, `mutualTLS`, `oauth2`, `openIdConnect`, and each type carries its own REQUIRED fields: `apiKey` requires `name` and `in` from `query`, `header`, or `cookie`; `http` requires `scheme`; `oauth2` requires `flows`; `openIdConnect` requires `openIdConnectUrl`. `apiKey` credentials use their declared name and location, and HTTP `basic` and `bearer` credentials use the `Authorization` field ([OAS 3.1.2 §4.8.27.1](https://spec.openapis.org/oas/v3.1.2.html#security-scheme-object), [RFC 9110 §11.6.2](https://www.rfc-editor.org/rfc/rfc9110#section-11.6.2)).

**[limit]** A Security Scheme Object that is not one — a missing or unlisted `type`, or an absent or wrong-typed field its `type` makes REQUIRED — is upstream-invalid and removes every security alternative naming it before any runtime credential is inspected, each accounted `invalid`, because the declaration fixes neither what to send nor where. Every remaining complete alternative survives, and a target left with no complete alternative is itself excluded under §3.2's smallest-owner rule. The confinement reopens only if an incorporated OAS 3.1 edition admits the exact declaration.

**[pin]** A selected `basic` scheme consumes a runtime-supplied user-id and password and constructs `Authorization: Basic base64(user-id ":" password)` under [RFC 7617 §2](https://www.rfc-editor.org/rfc/rfc7617#section-2), including its user-id, password, and Base64 constraints. Because RFC 7617 §2 deliberately leaves the default character encoding undefined, the user-id and password octets are pinned to printable US-ASCII (0x20–0x7E); a credential containing any other character leaves the selected alternative unusable, and the invocation refuses before dispatch. This pin reopens only if an incorporated authority defines a charset-parameter declaration surface for the scheme.

**[pin]** A selected HTTP scheme whose `scheme` compares ASCII case-insensitively to `bearer`, and every selected OAuth 2.0 or OpenID Connect scheme, consumes one runtime-supplied Bearer access-token value. The value MUST match RFC 6750's `b64token` production — one or more permitted token characters followed only by optional `=` padding — and the binding constructs exactly `Authorization: Bearer <token>`, with exactly one U+0020 space between `Bearer` and the token. An empty value, a value containing SP, HTAB, CR, LF, or any other byte outside `b64token`, and an OAuth/OpenID runtime token typed as anything other than Bearer refuse before dispatch. Token acquisition is outside this binding ([RFC 6750 §2.1](https://www.rfc-editor.org/rfc/rfc6750#section-2.1)).

**[convention]** `mutualTLS` is a transport prerequisite rather than a header credential, and this binding synthesizes no bytes for it: OAS declares only its `type` and a free-prose `description`, so no condition is declared in machine-readable form. A selected alternative requiring it is complete only when the runtime has established the client-certificate transport it names; establishment and its verification are runtime concerns under Core [§1.2](../../openbindings.md#12-out-of-scope) ([OAS 3.1.2 §4.8.27.1](https://spec.openapis.org/oas/v3.1.2.html#security-scheme-object)).

**[pin]** A selected `apiKey` scheme consumes a runtime-supplied key value and emits it at the declaration's exact query, header, or cookie destination.

**[exclusion]** An `apiKey` security alternative is excluded when its header name is not an HTTP `token`, or when its cookie name is not the `token` required for a cookie-name; other complete alternatives remain selectable. This exclusion reopens only if incorporated authority admits the exact destination-name form ([RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1), [RFC 6265 §4.1.1](https://httpwg.org/specs/rfc6265.html#sane-set-cookie-syntax)).

**[convention]** A runtime API-key value emitted to a header MUST be a valid HTTP `field-value` after UTF-8 encoding, with no leading or trailing SP or HTAB; a value containing CR, LF, NUL, another forbidden octet, or that boundary whitespace refuses before dispatch. A header key destined for `Cookie` MUST additionally be a complete RFC 6265 `cookie-string`. Cookie-location values remain subject to the `cookie-value` refusal rule below ([RFC 9110 §5.5](https://www.rfc-editor.org/rfc/rfc9110#section-5.5), [RFC 6265 §§4.1.1, 4.2.1](https://httpwg.org/specs/rfc6265.html#sane-cookie)).

**[exclusion]** OAuth 2.0 and OpenID Connect use the Bearer construction above. [RFC 6749 §7.1](https://www.rfc-editor.org/rfc/rfc6749#section-7.1) makes access-token types extensible, and every token type other than Bearer is excluded from wire carriage under this identifier, no rule of this specification constructing a field for one. That exclusion is a statement about this specification's carriage surface, not about any artifact declaration, so it removes no alternative from synthesis and appears in no coverage entry: an `oauth2` or `openIdConnect` alternative remains represented and its Bearer carriage complete. The exclusion reopens only if an incorporated authority defines another token type's carriage.

**[convention]** The runtime half is separate and is a prerequisite, not an exclusion: a runtime whose supplied token is not Bearer-typed leaves the selected alternative unusable, and the invocation refuses before dispatch, exactly as the other-scheme sentence below provides. Token type is a runtime fact and never a declaration fact, so it can reach no coverage entry.

**[limit]** Any declared HTTP authentication scheme other than case-insensitive `basic` or `bearer` remains visible as a consumer prerequisite, but this binding synthesizes no credential bytes for it; an alternative requiring it is unusable unless the runtime satisfies it as a complete prerequisite.

**[exclusion]** Two credentials in one AND requirement with the same destination, a credential colliding with a required effective parameter whose serialization cell can emit only the declared location and name for every admitted value shape, or a credential targeting binding/processor-owned `Host`, `Content-Length`, `Content-Type`, `Content-Encoding`, `Accept`, `Accept-Encoding`, `Connection`, `Keep-Alive`, `Proxy-Authorization`, `Proxy-Connection`, `TE`, `Trailer`, `Transfer-Encoding`, or `Upgrade` excludes only that security alternative; another complete non-colliding OR alternative survives, and the target is excluded only if none remains. Repeated occurrences of that same name remain fixed. Object-exploding and deep-object cells are runtime-derived; schema property inventories do not make them fixed because invocation does not perform schema validation. Header destinations compare ASCII case-insensitively; query and cookie destinations compare exact decoded names. `Accept` protects §9.1's generated response-media advertisement, `Content-Encoding` protects the effective Header Parameter as the sole request-coding selector, `Accept-Encoding` protects runtime transport negotiation, and `Proxy-Authorization` is reserved for the first inbound proxy rather than the origin ([RFC 9110 §11.7.2](https://www.rfc-editor.org/rfc/rfc9110#section-11.7.2)).

**[convention]** After parameter serialization and security selection, every actual parameter and credential contribution destination is compared again. A selected credential colliding with an optional parameter, or with a runtime-derived destination that was not statically provable, is invocation-conditional: an invocation producing both refuses before dispatch rather than selecting one source or emitting two, while omission of the parameter contribution emits the credential once and may dispatch. A supplied ordinary Header Parameter named `Accept-Encoding` suppresses any runtime-advertised field of that name; when it is omitted, transport negotiation remains runtime policy. §8.3 separately governs parameter-only processor-owned and raw/structured Cookie collisions.

**[convention]** An API-key query name and value are independently encoded by §8.2's query percent-encoding and joined with `=`, so hostile name characters remain inside one query member; an API-key cookie value is carried as an RFC 6265 `cookie-value` with no percent-encoding and refuses before dispatch when it cannot be so carried. All ordinary-parameter and credential query contributions form one unordered multiset: their relative order is not portable, but each contribution's exact encoded bytes are preserved. Credential values never enter the caller envelope or operation contract; structured cookie contributions preserve membership and join as `name=value` separated by `; `, with no portable cookie order ([RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1), [RFC 6265 §4.2.1](https://httpwg.org/specs/rfc6265.html#sane-cookie), [OAS 3.1.2 Appendix D](https://spec.openapis.org/oas/v3.1.2.html#appendix-d-serializing-headers-and-cookies)).

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

**[convention]** A synthesizer MUST account for every addressable operation and every callback/webhook dependency using exactly one status defined by §3.2: `represented`, `invalid`, `excluded`, `lossy`, or `implementation-unsupported`. The status vocabulary and spellings are normative within this binding specification and do not depend on an interface-synthesizer contract; an interface may encode them differently only if it preserves their stated meaning. A failure in an unused description position is coverage loss rather than invocation behavior.

**[convention]** Every binding-specific configuration requirement remains in coverage accounting and invocation context, assigned to its represented target or declared alternative, and MUST NOT enter the operation input schema.

**[incorporated]** Dependencies are synthesis outputs only and add no invocation target or receiver behavior (Core [§1.2](../../openbindings.md#12-out-of-scope), [§5.6](../../openbindings.md#56-dependencies)).

### 12.3 Conformance rules

**[convention]** A document conforms to **OAPI31-D-01** when its `content`, if present, satisfies §§3–5 and its `location`, if present, satisfies §4.

**[convention]** A binding conforms to **OAPI31-D-02** when it names §1's binding-specification identifier, carries the literal selector of §6.1, and identifies a source whose interpreted artifact passes the exact edition gate. That verdict is decided over the interpreted artifact, never over the binding's text alone: for a location-only source it follows §4's required dereference, so conformance to this rule is not a property of the OBI document in isolation.

**[convention]** Where a location-only source's dereference does not yield a representation, this rule is **unverified** rather than violated, and a verifier reporting an overall conclusion reports **conformance undetermined** absent an established violation elsewhere; an unavailable or policy-declined external resource is not evidence of violation. This extends, by this specification's own convention, the treatment Core [§10.5](../../openbindings.md#105-verification-conclusions) gives its own rules over network-inaccessible resources.

**[convention]** A processor conforms to **OAPI31-P-01** when it implements the closed load gates, §3.2's smallest-owner rule, the source-refusal rule and §5.2's dialect rules, reference closure, and selector semantics of §§3–6.

**[convention]** A processor conforms to **OAPI31-P-02** when it accepts only §7's envelope, applies §8's effective-parameter, collision, conversion, style, content, header, cookie, and path rules, and refuses every unknown or unroutable input before dispatch.

**[convention]** A processor conforms to **OAPI31-P-03** when it preserves media alternatives and applies §9's matching, request election, carriage, form, multipart, content-coding, response lookup, classification, and unary-boundary rules without sniffing or undeclared fallback.

**[convention]** A processor conforms to **OAPI31-P-04** when it resolves servers and complete target URLs under §10 and security alternatives, credentials, prerequisites, and channel collisions under §11.

**[convention]** A processor conforms to **OAPI31-P-05** when §3.2's source, addressability, synthesis-status, and invocation-outcome axes remain independent, including source-scope dialect exclusion and an all-invalid target inventory.

**[convention]** A processor conforms to **OAPI31-P-06** when §5.2 preserves `$dynamicRef`'s runtime dynamic scope by excluding only a schema-inspected owner and leaving type-uninspected JSON carriage unaffected.

**[convention]** A processor conforms to **OAPI31-P-07** when §9.1 excludes a required Request Body Object whose `content` map is empty.

**[convention]** A processor conforms to **OAPI31-P-08** when §9.3 refuses a required content-based form property supplied as null instead of silently eliding it.

**[convention]** A processor conforms to **OAPI31-P-09** when §9.3 emits only safe artifact-fixed multipart headers and excludes required nonfixed or contradictory `Content-Disposition` declarations.

**[convention]** A processor conforms to **OAPI31-P-10** when §11 excludes invalid API-key destination names and rejects unsafe runtime header or cookie values before dispatch.

**[convention]** A processor conforms to **OAPI31-P-11** when an invalid failure-only Response projection remains coverage loss without removing its operation, as §9.5 requires.

**[convention]** A processor conforms to **OAPI31-P-12** when §9.5 performs no content decoding or output for HEAD, non-101 informational, `204`, `205`, and `304` responses and reports forbidden actual content as a loud response-phase protocol error.

**[convention]** A processor conforms to **OAPI31-P-13** when a declared body projection cannot cause content decoding or output for an actual no-content response.

**[convention]** A processor conforms to **OAPI31-P-14** when §9.5 retains a governing non-`Content-Type` response Header Object's `required: true` check on a no-content response.

**[convention]** A processor conforms to **OAPI31-P-15** when §8.3 excludes a non-token optional ordinary-header projection without excluding the operation, allowing an invocation that omits it to dispatch.

**[convention]** A processor conforms to **OAPI31-P-16** when §8.3 treats the would-be caller key of that excluded optional header as unknown input and refuses it before dispatch.

**[convention]** A processor conforms to **OAPI31-P-17** when §8.3 propagates a non-token required ordinary header to an excluded target that remains addressable and refuses before dispatch.

**[convention]** A processor conforms to **OAPI31-P-18** when §8.3 prevents caller control of every listed connection, framing, and routing field by excluding the addressable target before dispatch.

**[convention]** A processor conforms to **OAPI31-P-19** when §9.5 treats `101 Switching Protocols` as an immediate loud response-phase protocol error rather than waiting for a later HTTP final response.

**[convention]** A processor conforms to **OAPI31-P-20** when §10 keeps an operation whose artifact-derived completed target has a non-HTTP scheme addressable and represented while refusing that invocation before dispatch.

**[convention]** A processor conforms to **OAPI31-P-21** when §10 permits a conforming complete configured HTTP or HTTPS URL to replace that artifact-derived base and dispatch the otherwise unchanged operation.

**[convention]** A processor conforms to **OAPI31-P-22** when §8.3 excludes a non-token optional cookie-parameter projection without excluding the operation, allowing an invocation that omits it to dispatch.

**[convention]** A processor conforms to **OAPI31-P-23** when §8.3 treats the would-be caller key of that excluded optional cookie parameter as unknown input and refuses it before dispatch.

**[convention]** A processor conforms to **OAPI31-P-24** when §8.3 propagates a non-token required cookie parameter to an excluded target that remains addressable and refuses before dispatch.

**[convention]** A processor conforms to **OAPI31-P-25** when §9.4 propagates a non-token `required: true` response Header Object key to its response alternative and reports a successful response governed by it as a loud response-phase protocol error.

**[convention]** A processor conforms to **OAPI31-P-26** when §8.3 refuses before dispatch when an ordinary structured-cookie parameter's serialized value is not an RFC 6265 `cookie-value`.

**[convention]** A processor conforms to **OAPI31-P-27** when §6.1 admits a `default`-only Responses Object and uses that Response Object for an otherwise unmatched successful status.

**[convention]** A processor conforms to **OAPI31-P-28** when §§8.3 and 11 refuse any supplied ordinary-header or header-credential value that is not an RFC 9110 `field-value`, including leading or trailing SP or HTAB, and additionally require a raw `Cookie` field value to be an RFC 6265 `cookie-string`.

**[convention]** A processor conforms to **OAPI31-P-29** when §8.3 refuses an invocation that would combine any supplied raw Cookie source — a Header Parameter or selected header credential — with any structured cookie parameter or selected cookie credential.

**[convention]** A processor conforms to **OAPI31-P-30** when §9.5 confines invalid Response keys, values, and fixed members to their smallest projections without changing admitted-key precedence or removing an otherwise usable target; valid body and header siblings still govern, matched-but-excluded media fails loudly only when selected on success, and failure decoding remains best-effort.

**[convention]** A processor conforms to **OAPI31-P-31** when §9.4 groups surviving response Header declarations by ASCII-case-insensitive field identity, applies required presence and `Content-Encoding` constraints conjunctively, and excludes only a required coding group whose finite constraints are provably unsatisfiable.

**[convention]** A processor conforms to **OAPI31-P-32** when §9.3 groups Encoding Header declarations by ASCII-case-insensitive field identity, emits one coherent artifact-fixed value, and excludes a conflicting, unsafe, or required-nonfixed group at the media-alternative boundary.

**[convention]** A processor conforms to **OAPI31-P-33** when §11 confines statically unavoidable credential collisions to the smallest security alternative and preserves every non-colliding OR alternative.

**[convention]** A processor conforms to **OAPI31-P-34** when §11 checks actual serialized destinations and treats optional or runtime-derived parameter collisions as invocation-conditional rather than static exclusions.

**[convention]** A processor conforms to **OAPI31-P-35** when §§8.3 and 11 reserve each processor-owned header destination, including `Proxy-Authorization`, at the target or security-alternative boundary.

**[convention]** A processor conforms to **OAPI31-P-36** when §11 percent-encodes both an API-key query name and value with uppercase UTF-8 triplets.

**[convention]** A processor conforms to **OAPI31-P-37** when §11 preserves the unordered multiset of ordinary-parameter and credential query contributions and each contribution's fixed bytes.

**[convention]** A processor conforms to **OAPI31-P-38** when §10 excludes only an unusable declaration-derived Server alternative with query, fragment, empty HTTP host, or userinfo, permits a sibling or complete configured URL to recover, and refuses a nonconforming consumer choice before dispatch.

**[convention]** A processor conforms to **OAPI31-P-39** when §§7 and 11 emit neither content nor binding-carried credentials or Cookie fields on TRACE, preserve anonymous or mutual-TLS alternatives, and refuse or exclude the smallest unavoidable sensitive source before dispatch.

**[convention]** A processor conforms to **OAPI31-P-40** when §9.3 emits generated multipart `name` parameters with the pinned UTF-8 quoted-string escaping and excludes a name outside that admitted byte grammar.

**[convention]** A processor conforms to **OAPI31-P-41** when §9.5 strips binding-selected header credentials and Cookie contributions on a followed cross-origin redirect and never appends a binding-selected query credential to any redirect Location.

**[convention]** A processor conforms to **OAPI31-P-42** when §9.4 refuses a supplied request `Content-Encoding` field on a body-free invocation and excludes a required field only when no surviving request lane can emit a representation.

**[convention]** A processor conforms to **OAPI31-P-43** when §11 constructs HTTP-bearer, OAuth2, and OpenID Connect authorization from one valid RFC 6750 `b64token` and refuses every empty, non-Bearer-typed, or grammatically invalid token before dispatch.

**[convention]** A processor conforms to **OAPI31-P-44** when §9.4 validates no-content response `Content-Encoding` syntax and exact raw-string domains without requiring or invoking a decoder.

**[convention]** A processor conforms to **OAPI31-P-45** when §9.2 requires UTF-8 encoding and decoding, treats additional charset directions as independent capabilities, refuses an unavailable or failed request encoder before dispatch, and reports an unavailable or failed response decoder loudly.

**[convention]** A processor conforms to **OAPI31-P-46** when §9.4 derives response `Content-Encoding` raw-string domains through resolved `$ref`, recursive `allOf`, mixed-enum filtering, `const`, and conjunction, then applies every case-folded group's domains conjunctively at response time.

**[convention]** A processor conforms to **OAPI31-P-47** when §10 accounts an absent or wrong-typed required Server Variable `default`, empty `enum`, or out-of-enum default as `invalid` at its Server alternative while retaining a target recoverable through `configuration.server`.

**[convention]** A processor conforms to **OAPI31-P-48** when §10 permits an exact consumer substitution for an otherwise undeclared Server URL expression and reports a missing substitution as context-required on `configuration.server`.

**[convention]** A processor conforms to **OAPI31-P-49** when §9.2 refuses before dispatch a caller-supplied JSON value containing an unpaired surrogate code unit, without replacement, passthrough, or request-byte emission.

**[convention]** A processor conforms to **OAPI31-P-50** when §7 computes caller-key uniqueness only after invalid and excluded parameter projections are removed, so a removed projection creates no key and does not activate qualified mode.

**[convention]** A processor conforms to **OAPI31-P-51** when §9.1 emits the deterministic equal-preference `Accept` union of every admitted response-content media range across successful and unsuccessful response alternatives and omits it only when that set is empty.

**[convention]** A processor conforms to **OAPI31-P-52** when §9.3 invents neither `filename` nor `filename*`, preserves an admissible artifact-fixed literal `filename`, and excludes a fixed `filename*` at the multipart alternative.

**[convention]** A processor conforms to **OAPI31-P-53** when §9.1 excludes a response media range carrying a case-insensitive `q` parameter before `Accept` construction while preserving every valid sibling range.

**[convention]** A processor conforms to **OAPI31-P-54** when §8.3 confines a statically unsupported form-cookie array or object declaration to an optional parameter projection, propagates its required form to the target, and applies that result independently of `explode`.

**[convention]** A processor conforms to **OAPI31-P-55** when §8.3 keeps a typeless or scalar-admitting form-cookie declaration statically available but refuses a supplied runtime value that would require the edition's unsupported multi-value representation.

**[convention]** A processor conforms to **OAPI31-P-56** when §8.2 refuses a supplied nested array or object member whose runtime shape leaves the admitted style cell, without private stringification or JSON serialization.

**[convention]** A processor conforms to **OAPI31-P-57** when §9.1 applies required-body exclusion to the effective post-method, post-confinement request-content set, while preserving a method-ignored body declaration and every surviving configurable alternative.

**[convention]** A processor conforms to **OAPI31-P-58** when §9.1 advertises an admitted failure-only response media range in `Accept` without allowing that range to govern an actual successful response.

**[convention]** A synthesizer conforms to **OAPI31-S-01** when it preserves §12.2's binding/transform boundary, emits §6.2's targetless unconstrained dependencies, accounts every lossy or non-equivalent Schema Object translation as coverage loss, and reports complete coverage under Core OBI-B-02.

**[convention]** A synthesizer conforms to **OAPI31-S-02** when it uses §3.2's locally defined status vocabulary for sources, targets, dependencies, and subordinate projections without depending on any project interface contract.

**[convention]** A synthesizer conforms to **OAPI31-S-03** when §9.5's declared body projection for a no-content response is subordinate `excluded` coverage while the operation remains represented.

**[convention]** A synthesizer conforms to **OAPI31-S-04** when it reports §8.3's non-token cookie parameter and §9.4's non-token response Header Object key at their specified smallest owners and propagates only their required forms.

**[convention]** A synthesizer conforms to **OAPI31-S-05** when §6.1 represents an otherwise usable operation whose Responses Object is `default`-only and projects that fallback Response Object normally.

**[convention]** A synthesizer conforms to **OAPI31-S-06** when §8.3 propagates an unavoidable raw/structured Cookie collision to its smallest security alternative or target while retaining every non-colliding OR alternative.

**[convention]** A synthesizer conforms to **OAPI31-S-07** when §9.5 retains an operation and every valid response sibling while accounting each invalid or excluded response projection at its smallest owner.

**[convention]** A synthesizer conforms to **OAPI31-S-08** when §§8.3 and 11 remove only statically unavoidable parameter or credential combinations, preserve non-colliding OR alternatives, and never treat an optional collision as a static exclusion.

**[convention]** A synthesizer conforms to **OAPI31-S-09** when §10 retains a target recoverable from unusable Server alternatives and records its actual `configuration.server` requirement.

**[convention]** A synthesizer conforms to **OAPI31-S-10** when §11 excludes binding-carried credential alternatives from TRACE while retaining an anonymous or mutual-TLS alternative, and excludes the target only when no complete safe alternative remains.

**[convention]** A synthesizer conforms to **OAPI31-S-11** when §9.4 preserves coherent response Header groups and accounts a provably unsatisfiable required response `Content-Encoding` group at its response-alternative owner.

**[convention]** A synthesizer conforms to **OAPI31-S-12** when §9.3 preserves coherent Encoding Header groups and accounts a conflicting or required-nonfixed group at its media-alternative owner.

**[convention]** A synthesizer conforms to **OAPI31-S-13** when §9.3 accounts an unrepresentable multipart name at its media-alternative owner while preserving unrelated operations.

**[convention]** A synthesizer conforms to **OAPI31-S-14** when §9.4 accounts a required bodyless request `Content-Encoding` parameter at its target owner while preserving unrelated operations.

**[convention]** A synthesizer conforms to **OAPI31-S-15** when §10 accounts an absent or wrong-typed required Server Variable `default`, empty `enum`, or out-of-enum default as an `invalid` Server alternative while retaining each target recoverable through `configuration.server`.

**[convention]** A synthesizer conforms to **OAPI31-S-16** when §10 preserves a Server URL expression without a matching Server Variable Object, represents the target, and records its actual `configuration.server` requirement rather than excluding the alternative.

**[convention]** A synthesizer conforms to **OAPI31-S-17** when §7 derives the operation input from the post-confinement effective parameter set, leaving a surviving same-named cross-location parameter unqualified when its only collision was removed.

**[convention]** A synthesizer conforms to **OAPI31-S-18** when §9.3 preserves an admissible artifact-fixed literal multipart `filename` and accounts a fixed `filename*` exclusion at its media-alternative owner.

**[convention]** A synthesizer conforms to **OAPI31-S-19** when §9.1 accounts a response media range carrying a case-insensitive `q` parameter as excluded at that alternative while preserving a valid sibling and its target.

**[convention]** A synthesizer conforms to **OAPI31-S-20** when §8.3 accounts a statically unsupported form-cookie array or object at its optional parameter projection and propagates only the required form to the target.

**[convention]** A synthesizer conforms to **OAPI31-S-21** when §9.1 accounts a removed request-content alternative at its own owner and propagates exclusion to a required Request Body target exactly when no alternative survives after method disposition and confinement.

**[exclusion]** Every exclusion in this document is permanent under `openbindings.openapi-3.1@1`, belongs to the smallest owner stated beside it, and reopens only upon the specific authority condition or demonstrated-consumer-need condition stated beside it; no exclusion promises later work.

### 12.4 Permitted variation and stated limits

This section collects the points at which two implementations conforming to `openbindings.openapi-3.1@1` may still emit different bytes or reach different outcomes, together with what this specification declines to cover. It is an index over rules stated elsewhere in this document. It carries no provenance label, states no requirement, and creates no latitude its cited rule does not already state; each entry names a site, and the rule at that site governs where the two differ. This section is placed after §12.3 because §§1–12.3 are numbered as published and nothing here renumbers them.

**Declared freedoms.** At each site the specification states the latitude rather than removing it, and states what survives across implementations that take it differently.

| what may differ | where | what holds across the permitted set |
| --- | --- | --- |
| whether a processor dereferences a co-present `location` | §4 | `content` remains the interpreted artifact and is never silently replaced; the retrieved bytes establish nothing but the base URI's identity, and §4 states that the two processors differ in no result this specification defines |
| query-contribution order across distinct effective parameters | §8.2 | each parameter's own contribution bytes are fixed — up to the JSON-image latitude stated in the final row of this table where a contribution carries a JSON image — as is §7's caller-envelope key, which the variable-name encoding of §8.2 never changes |
| a JSON-lane number outside binary64: preserved as the supplied mathematical value, or reduced to the nearest finite binary64 value | §9.2 | the permitted set has exactly these two members; no other deviation from the supplied value is permitted, and a conformant implementation never fails or refuses for range or precision alone |
| which character encoders or decoders beyond UTF-8 an implementation supports | §9.2 | UTF-8 MUST be supported in both directions; further directions are independent capabilities, with request absence or failure refusing before dispatch and response absence or failure reported loudly |
| which content codings a runtime can encode and decode | §9.4 | the actual field still fixes the ordered stack; an absent capability refuses before dispatch on a request and fails loudly on a response, and no coding is skipped or inferred from an artifact declaration |
| how a processor names or presents a confined defect | §3.2 | the affected unit and responsible declaration position remain observable; no defect-class taxonomy, per-class citation, or per-defect coverage vocabulary is portable |
| content-based form-urlencoded bytes: SPACE written `+` or `%20`, and `~` written literally or as `%7E` | §9.3 | every member of the declared set percent-decodes, under form-urlencoded decoding, to the supplied value; every other RFC 3986 unreserved byte stays literal and every other UTF-8 byte is uppercase `%HH` |
| multipart part order across distinct properties | §9.3 | repeated parts for one array property preserve element order, and property-to-name membership is fixed |
| the multipart boundary token, and the optional quoting the incorporated grammar permits for it on the media-type field | §9.3 | the entity framing itself — opening, inter-part, and closing delimiters — and that the token appears inside no encapsulated part |
| whether a runtime follows a redirect, and what it advertises in transport content negotiation | §9.5 | classification depends on the final status; a redirect followed with the bound method and complete body preserved remains this interaction, a method-rewriting redirect is a final response of it, and the binding emits no negotiation field beyond those this specification pins |
| the order of structured cookie contributions | §11 | membership is preserved and the join is `name=value` separated by `; ` |
| operation and dependency key spelling, contract flattening, output-schema choice, and Schema Object translation | §6.2, §12.2 | these are synthesis policy rather than portable binding meaning; a dependency key remains a deterministic function of its declaration slot, the role-inverted input/output meaning of §6.2 is fixed, and a lossy or non-equivalent Schema Object translation is accounted as coverage loss |
| the serialized bytes of any JSON image this specification emits — a JSON-lane request body, a content-form parameter value, or a compound form or multipart property riding as `application/json`: object member order, insignificant whitespace, which of `\uXXXX` or a literal the escapable characters take, and the lexical spelling of a number whose value is fixed | §9.2 | the JSON **value** is identical, which is what this specification fixes and what every rule of it is stated over; RFC 8259 constrains the grammar and not the choice among its equivalent spellings, so this latitude reaches wire bytes and reaches no value, no assertion, and no outcome |

**Configuration points.** Six, enumerated at §12.1 and no others. None appears in the caller envelope or the operation contract, and none is inferred from a supplied value.

| configuration point | boundary | chosen by | consequence when no choice is supplied |
| --- | --- | --- | --- |
| `requestMedia` (§9.1) | one concrete media type matching a declared request alternative under §9.1; it never substitutes another declaration's schema, and supplied values never elect | the consumer | required only where more than one usable entry, or a concrete declaration beside a usable range, is declared; a missing, unmatched, or ambiguous choice refuses before dispatch, and no body bytes or examples are sniffed |
| `server` (§10) | one effective Server alternative plus exact variable values, or one complete configured `http` or `https` URL that replaces the resolved base under the nonempty-host/no-userinfo/no-query/no-fragment constraints | the consumer | required where more than one effective member is declared, where an expression lacks a declaration-derived default, and whenever declarations alone leave no dispatchable `http` or `https` completion but replacement can recover it; an unsupplied required choice or unresolved variable is context-required before dispatch on `configuration.server`, and no member or variable preference is inferred |
| `security` (§11) | one complete alternative; fragments from different alternatives are never combined | the consumer | required only where more than one complete alternative is declared; an invocation with no selection where one is required refuses before dispatch |
| `parameterConversion` (§8.1) | a deterministic conversion from each JSON boolean or number to a string, applied recursively to array members and object values, with strings passing identically; scoped to the `schema`-form and RFC 6570-style paths and never to §9.3's content-based path | the consumer | a supplied boolean or number with no configured conversion refuses before dispatch |
| `implicitConnectionScope` (§11) | `entry` or `referring` document resolution for Security Requirement names | the consumer | defaults to `entry`; it is the only one of the six carrying a default |
| `propertyMedia` (§9.3) | one concrete media type for each form or multipart property whose Encoding `contentType` is a wildcard or comma-separated, or whose selected default defines no serialization for its resolved compound type, satisfying a declared member under §9.1 | the consumer | an absent, unmatched, or ambiguous required choice refuses before dispatch |

**Exclusions and reopen triggers.** §12.3's closing rule governs all of them: each is permanent under this identifier, belongs to the smallest owner stated beside it, and promises no later work.

| what is removed and its smallest owner | where | reopens only if |
| --- | --- | --- |
| the selected target, where a field it uses is declared both in the referenced Path Item and adjacent to the `$ref` | §5.1 Path Item `$ref` collision | an incorporated OAS edition defines the collision |
| the whole source, accounted as a source-scope exclusion rather than a defect-derived refusal | §5.2 root `jsonSchemaDialect` | that exact dialect becomes incorporated authority |
| each selected unit whose reachable closure enters that resource | §5.2 schema-resource-root `$schema` | that exact dialect becomes incorporated authority |
| the smallest media alternative, parameter, or multipart property whose decision requires runtime dynamic-scope evaluation; type-uninspected JSON carriage remains admitted | §5.2 `$dynamicRef` | demonstrated consumer need for portable binding-governed dynamic-scope evaluation; any semantics-changing addition remains subject to OBI-B-03 |
| the selected target | §7 case-distinct header parameters | an incorporated authority defines a wire mapping preserving such declarations |
| that parameter projection when optional; the selected target when required | §8.3 non-token header parameter name | incorporated HTTP authority admits that exact field-name form |
| that parameter projection when optional; the selected target when required | §8.3 non-token cookie parameter name | incorporated cookie authority admits that exact cookie-name form |
| that parameter; the test is the whole row and never a single cell | §8.2 wholly `n/a` style row | an incorporated authority defines that exact combination |
| the owning unit, and only where the resolved declaration proves the member | §8.2 unsupported compound member | an incorporated authority defines that exact cell |
| the target when its effective name is `Host`, `Content-Length`, `Connection`, `Keep-Alive`, `Proxy-Authorization`, `Proxy-Connection`, `TE`, `Trailer`, `Transfer-Encoding`, or `Upgrade`, compared ASCII case-insensitively | §8.3 processor-owned header parameter | an incorporated HTTP authority defines caller control preserving the processor's connection, framing, and routing obligations |
| the target for required opposite-kind parameters; otherwise the owning security alternative for an unavoidable credential combination | §8.3 raw/structured Cookie collision | incorporated authority defines a coherent raw/structured Cookie merge |
| the form-style cookie parameter projection when optional, and the target when required, where the resolved declaration proves the edition's unsupported multi-value representation independently of `explode` | §8.3 multi-value form-style cookie | an incorporated OAS edition defines a correct multi-value mapping |
| the selected target, only when a required effective Request Body has no surviving content alternative after method disposition and confinement | §9.1 effective empty request content | an incorporated OAS edition defines a request representation for the otherwise empty effective set |
| the selected media alternative; string and raw-octet XML carriage remain admitted | §9.2 XML from an object model | an incorporated authority defines ordering, escaping, nulls, dynamic keys, and scalar lexical forms |
| that selection, at its smallest media owner | §9.2 selection matching no defined lane | an incorporated authority defines that media/data-form cell |
| that response selection, at its smallest media owner | §9.3 form or multipart on a response | an incorporated authority defines that decoding |
| that response-media alternative | §9.1 response media range carrying a case-insensitive `q` parameter | incorporated HTTP authority defines an unambiguous `Accept` representation preserving both the declared parameter and equal preference |
| that multipart alternative, CR or LF in a property name included | §9.3 unrepresentable multipart `name` | an incorporated authority defines an unambiguous encoding |
| that multipart alternative when the fixed field is unsafe, is not `form-data`, names a different property, or contains `filename*` | §9.3 contradictory `Content-Disposition` | an incorporated authority defines a different unambiguous property-to-part mapping, or incorporated multipart authority permits `filename*` |
| that multipart alternative; an ignored entry, `Content-Type` included, never triggers it | §9.3 invalid, conflicting, or nonfixed required part-header group | an incorporated authority admits the field form or defines a different safe composition or caller part-header carriage |
| that multipart alternative, rather than choosing between two declared encodings | §9.3 `contentEncoding` against a surviving `Content-Transfer-Encoding` | an incorporated OAS edition defines that conflict's outcome |
| that media alternative, no property-to-part correlation being defined | §9.3 multipart other than `form-data` | an incorporated OAS edition defines that correlation |
| that header projection when optional; the smallest owning response alternative when `required: true` | §9.4 non-token response Header Object key | incorporated HTTP authority admits that exact field-name form |
| the target only when no surviving request lane can emit a representation | §9.4 required bodyless request `Content-Encoding` | incorporated HTTP authority defines Content-Encoding on a request with no representation |
| that response alternative, only when the binding-understood finite raw-string domains have an empty intersection | §9.4 unsatisfiable required response `Content-Encoding` case-group | incorporated OAS authority defines a different co-present constraint composition |
| the subordinate projection that can govern only HEAD, `1xx`, `204`, `205`, or `304`; the operation remains represented | §9.5 no-content response-body projection | incorporated HTTP authority permits content for that case |
| the targets beneath a key containing a literal `?` or `#` | §10 unsafe Paths key | incorporated OAS authority defines that key's target mapping |
| that Server alternative when its absolute HTTP expansion has an empty host or userinfo | §10 unsafe declaration-derived Server authority | incorporated HTTP authority permits such target generation |
| wire carriage under this identifier only; no artifact declaration is removed, so this exclusion reaches no synthesis or coverage entry | §11 access-token types other than Bearer | an incorporated authority defines another token type's carriage |
| the security alternative whose header name is not an HTTP `token` or whose cookie name is not a cookie-name `token` | §11 invalid `apiKey` destination name | incorporated authority admits the exact destination-name form |
| the owning security alternative; the target only when no complete alternative remains | §11 credential collision or reserved destination | incorporated authority defines a safe, unambiguous assembly for the exact collision |
| the credential-emitting security alternative, or the target for a required Cookie parameter | §11 credentialed TRACE | incorporated HTTP authority permits sensitive fields on TRACE |
| a retrieved document encoded in UTF-16 or UTF-32, which YAML 1.2.2 §5.2 obliges a processor to support | §5.1 retrieval encoding | an incorporated authority defines a declaration surface stating a retrieved document's character encoding without inspecting its bytes |

**Stated limits.** Each names a boundary this specification does not cross.

| not covered or confined | where |
| --- | --- |
| a closed ordered set of four conditions; no condition outside it is a load gate | §3.2 load gates |
| no portable defect-class taxonomy, per-class authority citation, or per-defect coverage-entry vocabulary; only the affected unit and responsible declaration position are required to remain observable | §3.2 diagnostics |
| after the gates a defect confines to its smallest owning unit, and an unreachable defect destroys no target | §3.2 smallest-owner rule |
| an excluded unit leaves the effective declarations of every rule here; a selector naming it still resolves, and the invocation refuses before dispatch | §3.2 excluded units |
| after the load gates, fires only for a missing or malformed required inventory surface, or inventory/reference defects that prevent every declared target slot from becoming addressable; target-confined invalidity never aggregates into it | §3.2 source refusal |
| an addressable-but-unusable target refuses before dispatch or is reported as coverage loss, and never becomes a source refusal | §3.2 unusable targets |
| exactly §5.2's root-dialect exclusion exists; no other source member or addressable target is filtered merely by its position in the source | §3.2 source-scope filtering |
| an unknown non-extension field creates no binding behavior, `x-` extensions stay inert, and no unknown member is guessed into a fixed or patterned field | §3.2 unknown fields |
| an unresolvable reference there leaves invocation unaffected and is reported as synthesis coverage loss | §5.1 unused description positions |
| a defect outside the target-plus-reachable closure has no effect on that target | §5.1 defects outside the closure |
| the three conditions confine to exactly the three consequences stated in table order | §5.1 confinement consequences |
| add no invocation behavior; receiver deployment and dependency composition are permanently outside this operation boundary | §6.2 dependencies |
| creates no caller-body requirement: a body-free invocation dispatches, and the declaration is reported as coverage loss | §7 required body on a content-forbidding method |
| a colliding identity supports no selection through it: a request selection refuses before dispatch, a response selection on a successful response is a loud protocol error (the failure side follows the best-effort failure-body rule), and map order never breaks the tie | §9.1 normalized media collisions |
| create no operation input or output member and never select a declaration, carriage lane, or media type | §9.1 examples |
| interoperable within RFC 8259 §6's binary64 expectation, over the two-member permitted set indexed above | §9.2 JSON-lane numbers |
| UTF-8 MUST be supported in both directions; every further charset direction is an independent implementation capability with its stated request- or response-phase failure outcome | §9.2 character encoding and decoding |
| are upstream-invalid and removed at their smallest owning unit, accounted invalid | §9.3 non-object form declarations |
| identifies `{}` and `{"x": null}` on the wire; the distinction between an absent optional member and an explicit null does not survive this lane | §9.3 null-property elision |
| artifact-fixed safe Header Object values are emitted verbatim except `Content-Transfer-Encoding`; a required nonfixed header is excluded, an optional nonfixed header remains descriptive, and no caller channel exists | §9.3 surviving part headers |
| generated multipart `Content-Disposition` invents neither `filename` nor `filename*`; an admissible artifact-fixed literal `filename` is emitted verbatim, while `filename*` is excluded at the media alternative | §9.3 multipart filename boundary |
| a supplied parameter whose serialized value is not an RFC 6265 `cookie-value` refuses before dispatch; no escaping or repair is inferred | §8.3 structured-cookie value |
| invalid Response values and members remain subordinate coverage loss; admitted keys retain precedence, empty successful responses emit no output, undecodable non-empty successful responses fail loudly, and failure data is best-effort | §9.5 invalid Response handling |
| an omitted or non-string `description` is an invalid documentary projection and coverage loss only; it never changes lookup, target representation, or invocation behavior, and every valid content or header sibling still governs | §9.5 invalid `description` |
| classification depends on the final status; redirect following and transport content negotiation are runtime policy under Core §1.2 | §9.5 redirect and negotiation |
| a missing declared required header is a loud protocol error, and header carriage remains outside the operation-value boundary | §9.5 required response headers |
| a non-empty successful response with no governing Response Object is a loud protocol error; an unsuccessful one completes with no failure data or added protocol error; Response Header and Link Objects create no output members | §9.5 undeclared response bodies |
| one HTTP response body produces at most one operation value, `text/event-stream` included | §9.5 value cardinality |
| embedded content with no document location leaves it unresolved and refuses before dispatch; the complete configured URL remains the recovery | §10 unresolvable relative Server URL |
| the operation remains addressable and represented, the invocation refuses before dispatch, and a complete configured HTTP(S) URL remains the recovery; no declaration is excluded | §10 non-HTTP completed target |
| an absent or wrong-typed required `default`, empty enum, or out-of-enum default is upstream-invalid and confined to its Server alternative while the target remains represented when complete-URL recovery exists | §10 malformed Server Variable Object |
| remain visible as a consumer prerequisite; no credential bytes are synthesized for them | §11 other HTTP authentication schemes |
| synthesis emits flat contracts plus an `inputTransform`; no other input-restructuring apparatus exists under this identifier | §12.2 input restructuring |
| an empty or extension-only object is upstream-invalid and confined to the selected target before any response or caller value is inspected, accounted invalid; reopens only if an incorporated OAS 3.1 edition admits the exact declaration | §6.1 Responses Object without a response declaration |
| an upstream-invalid declaration confined to the smallest owning operation, accounted invalid; reopens only if an incorporated OAS edition admits such duplicates | §7 duplicate effective parameters |
| an upstream-invalid declaration confined to the selected target, before caller values are inspected, accounted invalid; reopens only if an incorporated OAS 3.1 edition admits the exact malformed declaration or defines its wire meaning | §8.1 malformed Parameter Object |
| an upstream-invalid declaration confined to the selected target, before caller values are inspected, accounted invalid; repeated use of one expression remains admitted and reuses its one effective parameter; reopens only if incorporated authority admits the declaration or defines its unique target mapping | §8.2 path-key ambiguity or path-expression/parameter mismatch |
| an upstream-invalid declaration confined to its smallest media owner, accounted invalid; reopens only if an incorporated OAS edition permits the form without an object model or defines its wire mapping | §9.3 non-object form declaration |
| an upstream-invalid declaration confined to that alternative, at its smallest media owner; a schemaless non-multipart binary declaration is unaffected and takes the raw-octet lane, accounted invalid; reopens only if an incorporated OAS edition removes the requirement, as the 3.2 line does | §9.3 schemaless `multipart/form-data` |
| subordinate invalid coverage ignored for lookup; if no admitted response declaration survives in a present Responses Object, the enclosing target is invalid; reopens only if an incorporated OAS 3.1 edition admits that exact key form | §9.5 Responses key outside the admitted set |
| invalidity confined to the smallest response alternative or projection, without changing lookup precedence or target addressability; reopens only if an incorporated OAS 3.1 edition admits the exact declaration | §9.5 upstream-invalid Response value or member |
| an upstream-invalid declaration-derived expansion confined to that Server alternative and accounted invalid; a consumer substitution is only a nonconforming invocation choice; reopens only if an incorporated OAS edition defines the exact cell | §10 Server URL with query or fragment |
| an upstream-invalid declaration confined to every security alternative naming it; a target left with no complete alternative is itself excluded, accounted invalid; reopens only if an incorporated OAS 3.1 edition admits the exact declaration | §11 invalid Security Scheme Object |

## 13. Normative references

- [OpenAPI Specification 3.1.0](https://spec.openapis.org/oas/v3.1.0.html)
- [OpenAPI Specification 3.1.1](https://spec.openapis.org/oas/v3.1.1.html)
- [OpenAPI Specification 3.1.2](https://spec.openapis.org/oas/v3.1.2.html)
- [OpenAPI 3.1 base dialect, revision 2024-11-10](https://spec.openapis.org/oas/3.1/dialect/2024-11-10)
- [YAML 1.2.2](https://yaml.org/spec/1.2.2/)
- [JSON Schema Core 2020-12](https://json-schema.org/draft/2020-12/json-schema-core.html)
- [JSON Schema Validation 2020-12](https://json-schema.org/draft/2020-12/json-schema-validation.html)
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
- [RFC 7578](https://www.rfc-editor.org/rfc/rfc7578)
- [RFC 7617](https://www.rfc-editor.org/rfc/rfc7617)
- [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)
- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)
