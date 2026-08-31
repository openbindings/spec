# `openbindings.openapi-3.1` Binding Specification

## 1. Identifier and rule labels

**[convention]** The opaque binding-specification identifier has exactly the spelling **`openbindings.openapi-3.1@1`**.

**[incorporated]** Publication mints §1's identifier under Core [OBI-B-01](../../openbindings.md#104-binding-specification-rules), and an incompatible change to the accepted domain or portable meaning requires a different identifier under Core [OBI-B-03](../../openbindings.md#104-binding-specification-rules).

**[incorporated]** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) only when they appear in all capitals.

**[convention]** Every normative paragraph and normative table row carries one visible provenance label. An `incorporated` rule is one the cited source states, and the citation names that source, whether an incorporated authority or the OpenBindings Core; the remaining five are this specification's own explicitly classified bridge. A `convention` is a choice this specification makes where no authority speaks; a `pin` fixes one reading of an ambiguous or versioned authority; a `configuration point` names a decision deferred to the consumer; an `exclusion` removes something from the accepted surface behind a stated reopen trigger; a `limit` states a boundary this specification does not cross.

## 2. Scope and incorporated authorities

**[convention]** This binding specification defines how OpenAPI 3.1 artifacts govern OpenBindings sources: which documents are accepted and when loading refuses, how operation targets are addressed and synthesized, what an invocation's inputs and outputs mean, and which wire mechanics the artifact fixes. It builds on the OpenBindings Core specification (`../../openbindings.md`).

**[convention]** This specification accepts exactly OpenAPI Specification (OAS) editions [`3.1.0`](https://spec.openapis.org/oas/v3.1.0.html), [`3.1.1`](https://spec.openapis.org/oas/v3.1.1.html), and [`3.1.2`](https://spec.openapis.org/oas/v3.1.2.html); no wildcard or compatible-looking value widens this closed set.

**[convention]** Within that closed set, observable behavior MUST NOT turn on the patch component: each accepted edition instructs tooling to support the `3.1.*` feature set uniformly and not distinguish patch versions ([OAS 3.1.0 §4.1](https://spec.openapis.org/oas/v3.1.0.html#versions), [3.1.1 §4.1](https://spec.openapis.org/oas/v3.1.1.html#versions), [3.1.2 §4.1](https://spec.openapis.org/oas/v3.1.2.html#versions)).

**[pin]** For every rule in this specification the governing OAS text is the highest-numbered accepted edition's, whatever accepted patch value the artifact declares; the declared value is an admission gate only, never an edition selector. This pin is unconditional: it governs where the accepted editions contradict one another, where a later edition corrects an earlier one, and equally where a later edition states what an earlier one leaves unsaid. §§3.8, 5.5 and Appendix D.1 of the governing text are examples of the last case — 3.1.0 carries none of them — and every rule this document derives from them is therefore stated once, for all three accepted editions. Nothing in this pin reads on the artifact's own conformance to the edition it declares.

**[convention]** That governing-text pin does not widen the closed accepted domain beyond §2's three exact values.

**[convention]** OAS governs the artifact and every HTTP mechanic it declares, including object structure, reference resolution, parameter serialization, media declarations, server selection, responses, and security ([OAS 3.1.2 §4.8](https://spec.openapis.org/oas/v3.1.2.html#schema-0)); [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) governs the remaining HTTP semantics.

**[convention]** Every other authority named in §13 is incorporated at the scope its citation states, immutably at the revision cited. Where two incorporated authorities answer one decision differently, this specification states the precedence at that decision rather than in the abstract, and discloses the losing reading there. Three such decisions exist: OAS's Style Examples against RFC 6570 expansion (§8.1), RFC 8259's UTF-8 requirement against the UTF-16/UTF-32 latitude RFC 6839's `+json` registration inherits (§9.2), and RFC 9110's per-registration charset semantics against RFC 2046's US-ASCII `text/*` default (§9.2). No incorporated authority is consulted in a live or mutable form.

**[incorporated]** This document defines portable binding meaning, not an invocation API: request objects, retry and redirect APIs, cancellation, credential acquisition, receiver deployment, and dependency composition remain runtime or application concerns under Core [§1.2](../../openbindings.md#12-out-of-scope).

**Where Core's completeness items are discharged.** Core [OBI-B-02](../../openbindings.md#104-binding-specification-rules) names seven things a binding specification defines for the sources and bindings it governs. The table below maps each to the sections that carry it, and names in its third column any clause of an item this document does not reach. The table is a reader's map, not a rule: it carries no provenance label, states no requirement, and neither widens nor narrows the accepted domain. Where the table and a numbered section disagree, the section governs.

| Core OBI-B-02 item | Carried by | Clause this document does not reach |
| --- | --- | --- |
| 1 — whether a source mode accepts an artifact, the representations accepted, deterministic discrimination between them, and the encoding for any non-JSON artifact | §2, §3.1, §3.2, §4, §5.2 | The outcome of a location-only dereference that returns no representation at all — one that fails, is unreachable, or is refused at the transport — is not stated. §4 and §5.1 fix the branches where bytes do arrive, a representation outside §3.1's two and a byte sequence that is not valid UTF-8, while §3.2's load gates and defect-outcome vocabulary are both closed sets naming no condition for bytes that never arrive. |
| 2 — the syntax and meaning of `location` | §3.1, §4 | The same condition as item 1: `location`'s meaning in the location-only mode is fixed only for a dereference that returns something. |
| 3 — the accepted values and meaning of `content`, including any source mode in which `content` is forbidden | §3.1, §3.2, §4 | The forbidden-mode clause is stated in neither direction. §4's acceptance rule carves out no source mode, so the forbidden set is empty by entailment; this document nowhere says so, and a reader cannot tell "considered, and none" from "never considered". |
| 4 — how `location` and `content` compose within the content-primacy floor, including whether `location` supplies a reference base for embedded content | §3.1, §4, §10 | None. |
| 5 — the syntax and meaning of `selector`, including the absent-`selector` case | §3.2, §5.1, §6.1, §12.3 | None. The absent case is answered by §6.1's REQUIRED together with OAPI31-D-02, which is where the consequence is stated. |
| 6 — how the binding target and its interaction are identified | §3.2, §4, §5.1, §5.2, §6.1, §6.2, §7, §8.1, §8.2, §8.3, §9.5, §10, §11, §12.1, §12.3 | None. |
| 7 — how caller-facing input and successful output values correspond to the source interaction, which outcomes are successes, when the interaction instead completes unsuccessfully, how values emitted before that completion are treated, and any context bindings at transform positions | §3.2, §4, §5.1, §5.2, §7, §8.1, §8.2, §8.3, §9.1, §9.2, §9.3, §9.4, §9.5, §11, §12.1, §12.2 | An actual response carrying more than one `Content-Type` field. §9.5 fixes the field's absence and its use in selection, and §9.1 fixes how one field's value is parsed and compared, but no rule here says which value governs when the field is repeated, or that the repetition is itself a loud protocol error. The context-bindings clause is reached by exactly one rule, in §12.2. |

**[convention]** Where §2's item map records that a chain is not completed in this revision, that record licenses nothing. It is not a permitted variation, and this specification states no portable meaning there. An implementation may complete such a point locally; that completion is implementation-defined under Core [§6](../../openbindings.md#6-binding-specifications) and is not attributed to this identifier.

**OBI-B-02 is a floor, not a partition, and this document carries content above it.** A rule no item above reaches is not thereby surplus. §11's credential-construction rules — the authentication-scheme token comparison, the `basic` `Authorization` construction, `apiKey` emission at its declared destination, `mutualTLS` as a transport prerequisite, the Bearer carriage rule and its non-Bearer runtime counterpart, and the other-scheme prerequisite limit — fix observables this specification is answerable for, from emitted credential bytes to whether a selected alternative is usable, while serving no item: item 7 reaches caller-facing input and output values, and §11 itself states that credential values never become either, while item 6's verb reaches which requirement governs and no further. They are recorded here as content above the floor rather than as a gap, and §12.4 indexes the freedoms and limits among them.

## 3. Source carriage and refusal architecture

### 3.1 Accepted representations

**[convention]** `content` is either the parsed OpenAPI document object or string content; `location` is an absolute URI for the OpenAPI document; content has primacy, a co-present location supplies its base URI, and the OBI retrieval URI is never that base (Core [§5.4](../../openbindings.md#54-sources), [§7](../../openbindings.md#7-reference-resolution)).

**[pin]** String content MUST parse as YAML 1.2.2, of which JSON is a subset; duplicate mapping keys, non-scalar-string mapping keys, explicit tags outside YAML's JSON-compatible tag set, resolved values with no JSON image (`.inf`, `-.inf`, `.nan`), and a multi-document YAML stream refuse at this grammar gate. Exactly one YAML document is accepted ([YAML 1.2.2 §§3.2.1, 10.2.1, 10.3.2](https://yaml.org/spec/1.2.2/)).

**[pin]** Plain-scalar tag resolution uses YAML 1.2.2's recommended Core schema — the resolution the preceding rule's `.inf`/`.nan` parentheticals already presuppose — and no other resolution schema is consulted ([YAML 1.2.2 §10.3.2](https://yaml.org/spec/1.2.2/#1032-tag-resolution)).

**[pin]** A leading byte-order mark on string content is accepted and consumed by the YAML grammar; it is never part of the document.

**[incorporated]** The tag gate implements the line's corrected format rule: "Tags MUST be limited to those allowed by YAML's JSON schema ruleset." The same section states the key rule as "Keys used in YAML maps MUST be limited to a scalar string, **as defined by the YAML Failsafe schema ruleset**" ([OAS 3.1.2 §4.2](https://spec.openapis.org/oas/v3.1.2.html#format)).

**[pin]** That qualifier is load-bearing and this specification does not adopt it: under the Failsafe ruleset every plain scalar key resolves to a string, so `1:` and `true:` would be conforming map keys, while §3.1's key gate applies the preceding Core-schema resolution uniformly to keys and values and refuses a plain scalar key that Core resolves to a non-string. This specification pins the uniform Core reading, because one resolution schema per document is the only reading under which a key and the same characters as a value denote the same thing, and discloses the narrowing here: an artifact conforming to OAS §4.2 under the Failsafe qualifier may still refuse at this grammar gate. The pin reopens only if an incorporated OAS edition removes the qualifier or states the key resolution schema as Core ([YAML 1.2.2 §§10.2.1, 10.3.2](https://yaml.org/spec/1.2.2/#1032-tag-resolution)).

**[incorporated]** The root MUST be a JSON object with the required `openapi` field ([OAS 3.1.2 §§4.2, 4.8.1.1](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields)).

**[convention]** That field MUST be exactly `3.1.0`, `3.1.1`, or `3.1.2`; an absent, mismatched, or unlisted value refuses at load under §2's closed accepted domain.

### 3.2 Closed load gates and confined defects

**[convention]** Defect outcomes use a fixed vocabulary: a source **refuses at load** only at §3.2's gates; a source whose positions capable of carrying an addressable target are all defective **refuses as a source** after those gates; a declaration defect **excludes** its smallest owning unit from synthesis and selection; an addressable target whose use requires a missing choice or unsupported alternative is **unusable** and **refuses before dispatch** when invoked; a wire fact this specification cannot represent faithfully is a **loud protocol error**, for which the adverbial spellings *refuses loudly*, *fails loudly*, and *reported loudly* are exact synonyms; an interaction that reaches the wire and whose outcome §9.5's classification does not admit as successful **completes unsuccessfully**; and synthesis reports every exclusion and inexpressible declaration as **coverage loss**. Synthesis accounting adds one further status and no other: a unit this specification admits, and states no exclusion over, whose representation nevertheless depends on an implementation capability this specification does not require is accounted **implementation-unsupported**. §9.2's character decodings beyond the required UTF-8 are the only such capability under this identifier: everything else a consumer must supply is a §12.1 configuration point and is accounted as a requirement of a represented unit, never under this status. It is neither represented nor excluded, no other condition carries it, and a unit removed for an upstream-invalid declaration is accounted excluded with that reason rather than under it.

**[convention]** A **lane** is one media-selected value-to-bytes serialization path—JSON, character-data, raw-octet, form, multipart, and this line's other incorporated forms—and the **smallest media owner** is the narrowest declared unit that owns a defective lane. An **unavailable** alternative is an excluded alternative: the word marks this vocabulary's exclusion outcome applied to a media alternative.

**[convention]** A **unit** is one member of this closed lattice, from largest to smallest: the source, an addressable operation, a declared alternative, a media alternative, a lane, and a field. A defect's **smallest owning unit** is the smallest member of that lattice whose declarations the defect reaches; a **selected unit** is a unit reached by the selected target.

**[limit]** The load gates are the following closed ordered set: accepted-representation grammar, scalar/tag/key resolution, JSON-object root shape, and exact edition discrimination; no condition outside this set is a load gate.

**[limit]** **§3.2's smallest-owner rule**: after those gates pass, a defect confines to its smallest owning unit, and an unreachable defect destroys no target.

**[limit]** An **excluded** unit is removed from synthesis and from the effective declarations of every rule in this document, §7's caller-envelope key derivation and §8's path-template correspondence included: no rule reads an excluded unit's declarations. A selector naming an excluded target still resolves — exclusion is not unresolvability — and the invocation refuses before dispatch. A target whose remaining effective declarations no longer satisfy §8's path-template correspondence is itself excluded.

**[incorporated]** A conforming artifact that declares no operation target is accepted and synthesizes no operation: a Paths Object and a Path Item Object may each be empty, and the root may instead contain `components` or `webhooks` ([OAS 3.1.2 §§4.8.1, 4.8.8, 4.8.9](https://spec.openapis.org/oas/v3.1.2.html#openapi-object)).

**[incorporated]** An OpenAPI Description MUST contain at least one of `paths`, `components`, or `webhooks`; a root omitting all three is upstream-invalid, unlike any present-but-empty surface above ([OAS 3.1.2 §§3.1, 4.8.1.1](https://spec.openapis.org/oas/v3.1.2.html#openapi-object)).

**[limit]** **§3.2's source-refusal rule**: a source **refuses as a source** — the outcome §3.2's vocabulary names, which fires after the closed load gates and never at them — when at least one position that could carry an addressable target exists and every such position is defective, so that no conformant selector can resolve. A valid present-but-empty surface is not a defective position: it is accepted and synthesizes zero operations. The root surface this edition requires for addressable targets is itself such a position, and its absence is that defect — OAS 3.1.2 requires at least one of `paths`, `components`, or `webhooks` rather than `paths` alone, so only a source omitting all three refuses as a source ([OAS 3.1.2 §§3.1, 4.8.1.1](https://spec.openapis.org/oas/v3.1.2.html#openapi-object)). This stated consequence is not an additional load gate.

**[limit]** A target that is addressable but unusable because of a missing choice, unsupported alternative, or exclusion refuses before dispatch or is reported as synthesis coverage loss; it never becomes a source refusal.

**[limit]** This revision declares no source-scope exclusion: unlike the [`include`/`mount` filtering surface of `openbindings.usage@1`](../usage/openbindings.usage.md#3-accepted-source-representations), no source member or addressable target is filtered merely by its position in the source. §5.2's root `jsonSchemaDialect` rule refuses the source under §3.2's source-refusal rule rather than filtering by position.

**[limit]** An unknown non-extension field creates no binding behavior, and this specification supplies none for it: the consequence confines to the smallest owning unit that depends on it, while an unused unknown field affects no target. An `x-` specification extension remains an inert annotation under this identifier, and no unknown member is guessed into a fixed or patterned field ([OAS 3.1.2 §4.9](https://spec.openapis.org/oas/v3.1.2.html#specification-extensions)).

**[convention]** A root `swagger` member co-present with this specification's conforming `openapi` value is such an unknown non-extension root member: it is inert, gates nothing, and cedes the document to no sibling specification.

## 4. `location`, `content`, and composition

**[incorporated]** A present `location` MUST be an absolute URI addressing the OpenAPI document itself; a bare filesystem path is not conformant (Core [OBI-D-05](../../openbindings.md#102-document-rules)).

**[convention]** For a location-only source the dereference is required and MUST yield an accepted representation; a representation outside §3.1's two refuses at load, at the accepted-representation gate. Where `content` is co-present a processor MAY retrieve from `location` and MAY decline to; `content` remains the interpreted artifact and is never silently replaced, the retrieved bytes establish nothing but the base URI's identity, and a failed, unreachable, or non-conforming retrieval has no effect on the interpreted artifact and no outcome of its own. Retrieval is therefore never observable on a content-carrying source, and the two processors differ in no result this specification defines (Core [§5.4](../../openbindings.md#54-sources)).

**[convention]** A present `content` MUST be one of §3.1's two representations, and no other JSON type is accepted.

**[incorporated]** Relative references in Schema Objects, `$id` values included, use the nearest parent `$id` as their base URI. Relative references in every other Object, **and in Schema Objects where no parent schema contains an `$id`**, MUST resolve against the referring document's base URI. A fragment SHOULD be interpreted as a JSON Pointer when the referenced document's representation is JSON or YAML ([OAS 3.1.2 §§4.3, 4.6](https://spec.openapis.org/oas/v3.1.2.html#relative-references-in-api-description-uris), [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)).

**[pin]** This specification pins that SHOULD to a requirement with one carve-out, so that fragment interpretation is decidable without inspecting the target: a fragment reached from a Schema Object reference position that is neither empty nor begins with `/` is a JSON Schema 2020-12 plain-name fragment and resolves against the `$anchor` and `$dynamicAnchor` declarations of the schema resource its base identifies; every other fragment, in every other position, is a JSON Pointer. A plain-name fragment matching no anchor in that resource is unresolvable and confines under §5.1. The carve-out is not a widening of OAS's SHOULD but the reading under which it stays true of Schema Objects, whose keyword definitions this edition takes from JSON Schema ([OAS 3.1.2 §4.8.24](https://spec.openapis.org/oas/v3.1.2.html#schema-object), [JSON Schema Core §§8.2.2, 8.2.3.2](https://json-schema.org/draft/2020-12/json-schema-core.html#section-8.2.2)).

**[convention]** Embedded content without a co-present `location` MUST be self-contained; a location-only source uses its location as the entry-document base (Core [§7](../../openbindings.md#7-reference-resolution)).

## 5. References, dialects, and confinement

### 5.1 Reference semantics

**[convention]** A reference composes its target plus the transitive closure of references reachable from that target, not unrelated material in the same retrieved document. No accepted edition states that composition rule; this specification adopts it so that a selected target's closure is decidable ([OAS 3.1.2 §§4.3.1, 4.6](https://spec.openapis.org/oas/v3.1.2.html#parsing-documents)).

**[incorporated]** A referenced document need not itself be a conforming OpenAPI Document: the edition's own detection list admits a JSON Schema document and a document carrying a referenceable Object at its root beside an OpenAPI document ([OAS 3.1.2 §4.3.1](https://spec.openapis.org/oas/v3.1.2.html#parsing-documents)).

**[pin]** Every document this binding retrieves — the primary `location` dereference of §4 and every secondarily retrieved reference document alike — decodes its bytes as UTF-8 and passes the same grammar gate as §3.1 string content; the retrieval's `Content-Type` and any charset parameter are never consulted, and a byte sequence that is not valid UTF-8 does not yield an accepted representation: for the entry artifact that is a refusal at load at the accepted-representation gate, and for a secondarily retrieved document it is the unresolvable reference §5.1 states.

**[pin]** A retrieved reference document's base URI, absent a base the document itself establishes, is its retrieval URI in the authority's current-actual-location sense: the final URI after any redirects, never a user-supplied expected location ([OAS 3.1.2 §4.6](https://spec.openapis.org/oas/v3.1.2.html#relative-references-in-api-description-uris)).

**[incorporated]** Before a Schema Object reference may be deemed unresolvable, its complete containing document MUST be parsed for schema resources, reference targets, and keywords that establish or change a base URI ([OAS 3.1.2 §4.3.1](https://spec.openapis.org/oas/v3.1.2.html#parsing-documents)).

**[convention]** When one JSON or YAML node is reached from reference positions requiring different OAS Object types, each reference context interprets the node independently as its own required Object type; this is the deterministic choice within OAS's implementation-defined multi-context license ([OAS 3.1.2 §4.3.2](https://spec.openapis.org/oas/v3.1.2.html#structural-interoperability)).

**[incorporated]** A Schema Object `$ref` is the JSON Schema applicator and its siblings remain meaningful; a Reference Object has only its fixed `$ref`, `summary`, and `description` fields, and every added property is ignored ([OAS 3.1.2 §§4.8.23, 4.8.24](https://spec.openapis.org/oas/v3.1.2.html#reference-object)).

**[pin]** OAS states in lowercase that tooling must detect and handle cycles to prevent resource exhaustion, which §1's BCP 14 clause leaves non-normative; this specification pins that statement to a deterministic requirement: reference traversal MUST detect cycles without resource exhaustion, a cyclic but resolvable graph is legitimate, and cycle detection terminates traversal rather than truncating the graph and is not itself a refusal ([OAS 3.1.2 §5.5](https://spec.openapis.org/oas/v3.1.2.html#handling-reference-cycles)).

**[pin]** A Path Item `$ref` is not a Reference Object for sibling purposes. OAS gives the Path Item its own `$ref` fixed field and states that a field appearing in both the referenced and the adjacent object has undefined behavior, which presupposes that both declarations exist; this specification pins the merge that presupposition implies. The **effective Path Item** is the referenced Path Item overlaid with every adjacent field the referenced Path Item does not itself declare: non-colliding adjacent fields contribute, and the `$ref` member itself contributes nothing. The rule that a Reference Object's added properties are ignored is scoped to Reference Objects proper and never reaches this merge. This edition adds a note that the adjacent-property behavior of a Path Item `$ref` is likely to change in a future version to bring it into closer alignment with the Reference Object, which affirms its present non-alignment; the 2.0 and 3.0 lines carry no such note, and the merge rests on the collision-undefined sentence all four editions share ([OAS 3.1.2 §§4.8.9.1, 4.8.23](https://spec.openapis.org/oas/v3.1.2.html#path-item-ref), against [OAS 2.0 Path Item Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-3) and [OAS 3.0.4 §4.7.9.1](https://spec.openapis.org/oas/v3.0.4.html#path-item-ref)).

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

**[exclusion]** A root `jsonSchemaDialect` naming any other URI **refuses as a source** under §3.2's source-refusal rule — the same source-level outcome, reached by this rule's own condition rather than by that rule's defective-position trigger — because the changed default governs every Schema Object in the source that does not carry its own `$schema`, which is the source's whole schema surface and admits no smaller owner. This is a scope fact, not a claim that the analysis is infeasible: the `$schema` rule below confines precisely because a schema-resource root bounds what it governs, and a document default bounds nothing. This exclusion reopens only if that exact dialect becomes incorporated authority.

**[exclusion]** A schema-resource-root `$schema` naming any other URI excludes only each selected unit whose reachable closure enters that resource; this exclusion reopens only if that exact dialect becomes incorporated authority.

**[convention]** For every lane, style, shape, and member-inspection rule in this document, a **resolved declaration** is obtained by following `$ref` and `$dynamicRef` and conjoining every `allOf` branch; for an `anyOf` or `oneOf` choice, a branch whose resolved declaration declares only `null` is skipped, every other branch — a typeless branch included — is a candidate, and the choice supplies a single resolved member declaration only when exactly one candidate remains; `not` and conditional applicators never participate in resolution; and absence of `type` leaves the declaration typeless. A 3.1 `type` array contributes every listed type to the resolved type set. **Declares only X** means that the resolved type set is nonempty and every member is in X. **Admits `string` as its sole non-null type** means that the resolved type set is exactly `{string}` or `{string, null}`.

**[convention]** Following `$dynamicRef` uses this edition's incorporated JSON Schema rule — the first matching `$dynamicAnchor` on the path from the schema entry point to the reference, and otherwise the reference's own lexical target — where the **schema entry point** is the Schema Object the rule under inspection names, and the path is the resolution walk this paragraph defines. That walk is fixed by the declarations alone, so the resolved declaration never depends on a supplied value or on an evaluation this specification does not perform; `$dynamicAnchor` is a resolution target only and contributes no type. This makes `$dynamicRef` decidable in the same static walk as `$ref` rather than routing an artifact-declared type to the untyped raw-octet lane ([OAS 3.1.2 §4.8.24.5](https://spec.openapis.org/oas/v3.1.2.html#schema-object), [JSON Schema Core §8.2.3.2](https://json-schema.org/draft/2020-12/json-schema-core.html#section-8.2.3.2)).

## 6. Selector and inbound dependencies

### 6.1 Selector

**[convention]** `selector` is REQUIRED and has exactly one literal spelling: `#/paths/<escaped-path>/<lowercase-method>`, where `<escaped-path>` is the Paths Object key escaped once under [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) and `<lowercase-method>` is one of `get`, `put`, `post`, `delete`, `options`, `head`, `patch`, or `trace`.

**[pin]** The selector's leading `#` is a literal sentinel: what follows is RFC 6901 §3's string representation of the JSON Pointer, carried literally, escaped once with `~0`/`~1`, and never percent-decoded; RFC 6901 §6's URI-fragment representation is not used. Evaluation follows RFC 6901 §§3–4; when the selected operation is absent the selector does not resolve and the invocation refuses before dispatch ([RFC 6901 §§3–4, 6](https://www.rfc-editor.org/rfc/rfc6901#section-3), [OAS 3.1.2 §§3.5, 4.8.9](https://spec.openapis.org/oas/v3.1.2.html#path-item-object)).

**[convention]** After the pointer selects a Path Item, selector evaluation resolves that Path Item's `$ref` into §5.1's effective Path Item before reading the method field. Ordinary RFC 6901 evaluation does not traverse a 2020-12 `$ref`, because `$ref` is an applicator and substitutes no JSON node; the deliberate extra resolution keeps bundled referenced Path Items addressable ([RFC 6901 §4](https://www.rfc-editor.org/rfc/rfc6901#section-4), [JSON Schema Core §8.2.3.1](https://json-schema.org/draft/2020-12/json-schema-core.html#section-8.2.3.1), [OAS 3.1.2 §4.8.9.1](https://spec.openapis.org/oas/v3.1.2.html#path-item-ref)).

**[incorporated]** An operation remains addressable when it omits `responses`, because `responses` is optional in the 3.1 Operation Object ([OAS 3.1.2 §4.8.10.1](https://spec.openapis.org/oas/v3.1.2.html#operation-responses)).

**[incorporated]** When `responses` is present, its Responses Object MUST contain at least one response code; a present empty object is upstream-invalid, distinct from valid omission ([OAS 3.1.2 §4.8.16](https://spec.openapis.org/oas/v3.1.2.html#responses-object)).

**[exclusion]** A present empty Responses Object is a declaration defect that excludes only the selected target, before any response or caller value is inspected; omission remains addressable under the preceding rule. The exclusion reopens only if an incorporated OAS 3.1 edition admits a present empty Responses Object.

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

**[convention]** The same absent-versus-supplied rule reaches one level further, into the `parameters` member: an absent key is not supplied, and a key present with `null` is a supplied JSON null. A supplied null therefore satisfies a required parameter and is never "missing" under the requirement rule below; it then serializes under §8.1's undefined-value rule, including on a `path` parameter, whose `undefined` cell this specification does not override — a null `simple` path parameter expands to an empty segment and the completed target is dispatched with it. This closes the question in the direction the incorporated Style Examples answer it, rather than inventing a refusal the table does not state.

**[convention]** When every effective parameter name is unique across locations, its caller key is the exact declared name; if any name is repeated across legal locations, the target uses qualified mode for every parameter and each key is `<location>/<RFC6901-escaped-name>`, making the flat map injective without depending on map order.

**[incorporated]** Effective parameter identity is exact name plus location; duplicate effective parameters at the same identity are upstream-invalid, while the same name in different locations denotes distinct parameters ([OAS 3.1.2 §§4.8.10.1, 4.8.12.2.1](https://spec.openapis.org/oas/v3.1.2.html#operation-parameters)).

**[exclusion]** Duplicate effective parameters at the same identity exclude their smallest owning operation; this exclusion reopens only if an incorporated OAS edition admits such duplicates.

**[convention]** Legal cross-location duplicates remain independently supplied through the qualified mode above.

**[exclusion]** Two effective header parameters whose names differ only by ASCII case exclude the selected target. The authority is divided and this specification does not hide it: `Parameter names are case sensitive` makes them two parameters, while the case-sensitivity section says the case sensitivity of names mapping directly to HTTP concepts follows HTTP's rules, under which they are one field and therefore an upstream duplicate the rule above already excludes. Both readings remove the target, so the exclusion holds under either, and this rule states it once rather than resting on the reading that happens to be cited. It reopens only if an incorporated authority defines a wire mapping that preserves such case-distinct declarations ([OAS 3.1.2 §4.8.12.2.1](https://spec.openapis.org/oas/v3.1.2.html#common-fixed-fields), [§3.8](https://spec.openapis.org/oas/v3.1.2.html#case-sensitivity), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[convention]** A supplied envelope that is not a JSON object refuses before dispatch, whatever JSON type it is; an envelope top-level key other than `parameters` or `body`, a present non-object `parameters` member, or any unknown parameter key likewise refuses before dispatch, regardless of whether a body exists; no unmatched-field passthrough exists.

**[incorporated]** Missing required parameters and a missing `required: true` request body refuse before dispatch; path parameters are always required ([OAS 3.1.2 §§4.8.12.2.1, 4.8.13.1](https://spec.openapis.org/oas/v3.1.2.html#common-fixed-fields)).

**[incorporated]** `requestBody` is fully supported in HTTP methods where the HTTP specification has explicitly defined semantics for request bodies; "in other cases where the HTTP spec is vague (such as GET, HEAD and DELETE), `requestBody` is permitted but does not have well-defined semantics and SHOULD be avoided if possible." GET, HEAD and DELETE are given as examples of that class, not as its extent, and the edition names no other method ([OAS 3.1.2 §4.8.10.1](https://spec.openapis.org/oas/v3.1.2.html#operation-request-body)).

**[pin]** Two things in that sentence are this specification's, not the edition's. First, the edition hooks its "explicitly defined semantics" test to [RFC 7231 §4.3.1](https://www.rfc-editor.org/rfc/rfc7231#section-4.3.1) — a pointer at GET, which is an upstream error — and this specification re-bases the test to [RFC 9110 §§9.3.1–9.3.8](https://www.rfc-editor.org/rfc/rfc9110#section-9.3.1), the current statement of the same per-method semantics, which is what admits `patch` under [RFC 5789 §2](https://www.rfc-editor.org/rfc/rfc5789#section-2). Second, the edition's open example class is closed here over this binding's closed selector set: `requestBody` is honored on `post`, `put`, and `patch`; it is permitted-but-undefined on `get`, `head`, `delete`, and `options`, `options` being this specification's assignment and named by no accepted edition; and it emits no body on `trace`, because a TRACE client MUST NOT send content ([RFC 9110 §9.3.8](https://www.rfc-editor.org/rfc/rfc9110#section-9.3.8)). Both pins reopen only if an incorporated OAS edition states the method set itself.

**[convention]** On the permitted-but-undefined methods the binding preserves a supplied declared body rather than deleting it, since the edition's own disposition is advice to authors (`SHOULD be avoided`) and not a consumer instruction to drop content; a supplied `body` on `trace` refuses as unroutable before dispatch.

## 8. Parameter serialization

### 8.1 Effective declarations and scalar conversion

**[incorporated]** Operation parameters override Path Item parameters only at the same exact name-plus-location identity, and every remaining effective `path`, `query`, `header`, or `cookie` Parameter Object governs its own contribution ([OAS 3.1.2 §§4.8.9.1, 4.8.10.1, 4.8.12.1](https://spec.openapis.org/oas/v3.1.2.html#parameter-locations)).

**[exclusion]** A selected effective Parameter Object missing required `name`, using an `in` outside `path`, `query`, `header`, or `cookie`, failing to use exactly one of `schema` or `content`, declaring a non-required path parameter, or giving a content map other than exactly one entry is a declaration defect that excludes the selected target before caller values are inspected. The exclusion reopens only if an incorporated OAS 3.1 edition admits the exact malformed declaration or defines its wire meaning ([OAS 3.1.2 §§4.8.12.1–4.8.12.2.3](https://spec.openapis.org/oas/v3.1.2.html#parameter-object)).

**[incorporated]** A Header parameter whose name ASCII-case-insensitively denotes `Accept`, `Content-Type`, or `Authorization` MUST be ignored and creates no effective parameter, caller-envelope key, or emitted field ([OAS 3.1.2 §§3.8, 4.8.12.2.1](https://spec.openapis.org/oas/v3.1.2.html#common-fixed-fields), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[configuration point]** For `schema`-form parameter serialization and for §9.3's RFC 6570-style Encoding path — and for those two only, never for §9.3's content-based path, which §9.3 serializes by media type — `parameterConversion` is the same deterministic consumer-supplied conversion from each JSON boolean or number to a string; strings pass identically, and any supplied boolean or number without a configured conversion refuses before dispatch ([OAS 3.1.2 Appendix B](https://spec.openapis.org/oas/v3.1.2.html#appendix-b-data-type-conversion)).

**[incorporated]** On those RFC 6570-style paths the undefined values are RFC 6570 §2.3's, which the edition points at for exactly this purpose: "[RFC6570] Section 2.3 specifies which values, including but not limited to null, are considered undefined". The set is therefore a supplied JSON null, a supplied array of zero members, and a supplied object of zero members or all of whose member values are undefined; the empty string is expressly not undefined ([OAS 3.1.2 Appendix B](https://spec.openapis.org/oas/v3.1.2.html#appendix-b-data-type-conversion), [§4.8.12.6](https://spec.openapis.org/oas/v3.1.2.html#style-examples), [RFC 6570 §2.3](https://www.rfc-editor.org/rfc/rfc6570#section-2.3)).

**[convention]** Because the rule below refuses a null member outright, no supplied object reaches the all-member-values-undefined case through null members, and no other supplied member value is undefined at member level; the three conditions above are the whole set under this identifier.

**[incorporated]** An undefined value MUST serialize exactly as the governing effective `style` and `explode` row's `undefined` cell. That column replaced the `empty` column of previous editions "in order to better align with [RFC6570] Section 2.3 terminology" and expressly distinguishes the empty string; OAS 3.1.0 carries only the superseded `empty` column, and under §2's unconditional patch pin the corrected column governs every accepted edition. The governing bytes are `;name` for `matrix`, `.` for `label`, an empty serialization for `simple`, and `name=` for `form` before §8.2's enclosing query assembly; the remaining style cells are `n/a` ([OAS 3.1.0 §4.8.12.4](https://spec.openapis.org/oas/v3.1.0.html#style-examples), [OAS 3.1.1 §4.8.12.4](https://spec.openapis.org/oas/v3.1.1.html#style-examples), [OAS 3.1.2 §4.8.12.6](https://spec.openapis.org/oas/v3.1.2.html#style-examples)).

**[pin]** Those bytes are not RFC 6570's. RFC 6570 §3.2.1 ignores an undefined variable entirely, so its own expansions omit the contribution — `{?x,y,undef}` yields `?x=1024&y=768` — whereas the `undefined` cells above emit the same bytes RFC 6570 produces for the empty string. This is the first of §2's three named precedence decisions and it resolves for OAS: where the Style Examples table and RFC 6570 expansion disagree on an undefined value's bytes, the table governs, RFC 6570 supplies only the definition of which values are undefined, and the departure from RFC 6570 §3.2.1 is disclosed here rather than left to a reader to discover ([RFC 6570 §3.2.1](https://www.rfc-editor.org/rfc/rfc6570#section-3.2.1)).

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

**[pin]** Appendix C.3 SHOULD-handles configurations with no direct RFC 6570 equivalent under RFC 6570 and says implementations MAY create a properly delimited URI Template; this specification pins that latitude to a requirement, because RFC 6570 prefix operators cannot combine. A query mixing regular form expansion with `allowReserved: true` MUST be constructed manually per parameter: reserved-permitting values use reserved expansion, and `[`, `]`, `#`, `&`, `=`, and `+` are pre-percent-encoded where Appendix C requires, the pre-encoding set being verified against C.4.2 ([OAS 3.1.2 §§C.3–C.4.2](https://spec.openapis.org/oas/v3.1.2.html#non-rfc6570-field-values-and-combinations)).

**[convention]** The manual path assembles all present per-parameter contributions into one query component with one leading `?` and `&` between contributions; this assembled result is the single-query rule's equivalent at the authority's construction seam.

**[convention]** Query-contribution order across distinct effective parameters is not portable meaning.

**[incorporated]** A parameter name that is not a legal RFC 6570 variable name MUST be percent-encoded before use in the template construction ([OAS 3.1.2 §§C.3, C.4.4](https://spec.openapis.org/oas/v3.1.2.html#illegal-variable-names-as-parameter-names)).

**[convention]** That variable-name encoding is internal to URL assembly and never changes the exact caller-envelope key defined by §7.

**[convention]** For `spaceDelimited`, `pipeDelimited`, and `deepObject`, the exact bytes are the corresponding OAS Style Examples: delimiters and deep-object brackets are percent-encoded, object names and values retain their shown alternation, and no unstated escape convention is added ([OAS 3.1.2 §4.8.12.6](https://spec.openapis.org/oas/v3.1.2.html#style-examples)).

**[pin]** Before dispatch, the binding refuses a supplied parameter or property name or scalar value containing its non-RFC style's structural delimiter: U+0020 SPACE for `spaceDelimited`, `|` for `pipeDelimited`, or any of `[`, `]`, `=`, and `&` for `deepObject`; no escape-convention configuration point is offered. The authority is not silent here, and this is a narrowing of what it permits. Appendix E.6 names `[`, `]`, `|`, and space as the delimiters of these three styles, requires that they "all MUST be percent-encoded to comply with [RFC3986]", and then places the remedy outside itself: it RECOMMENDS defining "an additional escape convention while percent-encoding the delimiters for these styles, or … avoid[ing] these styles entirely", and states that "the exact method of additional encoding/escaping is left to the API designer, and is expected to be performed before serialization … and reversed after". Because that escape convention is an artifact-external agreement this binding cannot read from the artifact, no configuration point could make the round trip decidable, so this specification takes the second of the authority's two recommendations and refuses the ambiguous value instead of inventing a convention. The refusal set adds `=` and `&` beyond the four Appendix E.6 enumerates, because an exploded `deepObject` also uses those two bytes to delimit its own `name[key]=value` pairs on the wire ([OAS 3.1.2 Appendix E.6](https://spec.openapis.org/oas/v3.1.2.html#percent-encoding-and-illegal-or-reserved-delimiters), [RFC 3986 §2.2](https://www.rfc-editor.org/rfc/rfc3986#section-2.2)).

**[exclusion]** An effective `style`/`explode` combination, including a defaulted `explode`, whose entire Style Examples row is `n/a` excludes that parameter; therefore omitted `explode` on `deepObject` computes to the excluded `false` row, which the edition itself calls undefined. The test is the whole row and never a single cell: a row carrying `n/a` in some columns and real bytes in others — `spaceDelimited` with `explode: false`, for instance — is a supported combination, and only the values falling in its `n/a` columns are refused: a supplied undefined value by the rule above, and a shape this section's table does not admit for that style by the rule introducing that table. OAS/RFC 6570 defines no expansion for a wholly `n/a` row, so the owning unit is excluded unless an incorporated authority defines that exact combination ([OAS 3.1.2 §§4.8.12.2, 4.8.12.3, 4.8.15.1, C.1](https://spec.openapis.org/oas/v3.1.2.html#style-values), [RFC 6570 §3.2.1](https://www.rfc-editor.org/rfc/rfc6570#section-3.2.1)).

**[exclusion]** Otherwise a compound-capable style is excluded only when its resolved declaration proves an unsupported compound member—an array whose resolved `items` declaration declares only `object` or `array`, or an object with at least one declared property whose resolved declaration declares only `object` or `array`. OAS/RFC 6570 defines no expansion for the excluded cells, so the owning unit is excluded unless an incorporated authority defines that exact cell ([OAS 3.1.2 §§4.8.12.2, 4.8.12.3, 4.8.15.1, C.1](https://spec.openapis.org/oas/v3.1.2.html#style-values), [RFC 6570 §3.2.1](https://www.rfc-editor.org/rfc/rfc6570#section-3.2.1)).

**[convention]** A typeless resolved member proves no compound shape, a choice that supplies no single resolved member declaration under §5.2 proves no compound shape, and an object declaring no properties proves no compound member, so none triggers this exclusion; in particular, a declaration that still admits a scalar is never excluded, and candidate admission never inspects the supplied runtime value.

**[convention]** The rule applies symmetrically to every compound-capable parameter style and to §9.3's Encoding style path, where the smallest owner is the selected media alternative rather than the target.

**[incorporated]** The Paths Object MUST NOT contain two templated path keys with equivalent hierarchies but different template names. Within one selected target, every path-template expression MUST have a corresponding effective `path` parameter, and every effective `path` parameter MUST correspond to a template expression ([OAS 3.1.2 §§3.5, 4.8.8.1, 4.8.12.2.1](https://spec.openapis.org/oas/v3.1.2.html#path-templating)).

**[convention]** The two authority-grounded correspondence directions are one-to-one under this binding, so a template expression occurring more than once is a declaration defect; 3.1.2 does not itself state that duplicate-expression consequence.

**[exclusion]** Equivalent-hierarchy path-key ambiguity, either direction of a path-expression/parameter mismatch, or a duplicate expression is a declaration defect that excludes the selected target before any caller value is inspected; non-conflicting targets survive. The exclusion reopens only if incorporated authority admits the declaration or defines its unique target mapping.

**[incorporated]** An expanded path value containing unescaped `/`, `?`, or `#` refuses before dispatch ([OAS 3.1.2 §§3.5, 4.8.12.4](https://spec.openapis.org/oas/v3.1.2.html#path-templating)).

**[incorporated]** Completed URL parsing and percent-decoding follow RFC 3986, while query delimiters and the non-RFC-style brackets above remain percent-encoded as required ([OAS 3.1.2 §4.8.12.4](https://spec.openapis.org/oas/v3.1.2.html#url-percent-encoding), [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)).

### 8.3 Content-form, empty, header, and cookie parameters

**[incorporated]** A `content`-form Parameter Object MUST contain exactly one media-type entry; its application value serializes under that entry, and when the contribution enters a URL the resulting representation is percent-encoded as one parameter value ([OAS 3.1.2 §4.8.12.2.3](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-for-use-with-content) for the one-entry requirement, [§4.8.12.4](https://spec.openapis.org/oas/v3.1.2.html#url-percent-encoding) for the percent-encoding of a value serialized through a Media Type Object).

**[pin]** Percent-encoding a content-form parameter leaves RFC 3986 unreserved bytes literal and encodes every other UTF-8 byte as uppercase `%HH`; the exact caller-envelope key remains unchanged.

**[incorporated]** For a query parameter with `allowEmptyValue: true`, a supplied empty string emits a present zero-length value; absence still means omitted, and this binding infers no schema-validity consequence because OAS leaves that interaction implementation-defined ([OAS 3.1.2 §4.8.12.2.1](https://spec.openapis.org/oas/v3.1.2.html#parameter-allow-empty-value)).

**[incorporated]** Header `schema` serialization performs no URI percent-encoding and adds no automatic quotes: the governing text requires that URI percent-encoding MUST NOT be applied to header values and that they pass through unchanged, a correction this edition states expressly against the advice its two predecessors gave ([OAS 3.1.2 §4.8.12.2.2](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-for-use-with-schema), [Appendix D.1](https://spec.openapis.org/oas/v3.1.2.html#appendix-d-serializing-headers-and-cookies)).

**[pin]** No accepted edition extends that exemption to cookies, and this specification does not invent one: a declared cookie parameter serialized on the `schema` path is percent-encoded by ordinary RFC 6570 expansion, because `allowReserved` is valid only for query parameters and no cookie-specific exemption exists. Appendix D's observation that RFC 6570 percent-encoding "is not always appropriate" for cookies, and its recommendation to use `content` instead, are advice to artifact authors rather than a serialization rule, and this specification acts on neither. The consequence is an asymmetry stated here rather than left to be discovered: the same characters ride percent-encoded in a declared cookie **parameter** and unencoded in an `apiKey` cookie **credential**, which §11 carries as an RFC 6265 `cookie-value`. §11 also states the single assembly both use — structured cookie contributions join as `name=value` separated by `; `, with no portable order ([OAS 3.1.2 Appendix D](https://spec.openapis.org/oas/v3.1.2.html#appendix-d-serializing-headers-and-cookies), [RFC 6570 §3.2](https://www.rfc-editor.org/rfc/rfc6570#section-3.2)).

**[pin]** A supplied header value's characters are carried as UTF-8 octets, closing the character-to-octet seam before the field-invalid-byte check below ([RFC 9110 §5.5](https://www.rfc-editor.org/rfc/rfc9110#section-5.5)).

**[convention]** A supplied header value containing CR, LF, or another field-invalid byte refuses before dispatch at the affected parameter ([RFC 9110 §§5.1, 5.5](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[convention]** Raw-Cookie and structured-cookie declarations alone exclude nothing. An invocation in which a supplied raw `Cookie` Header parameter value and any structured cookie contribution—an effective cookie parameter or selected cookie credential—would both be emitted refuses before dispatch; the binding does not parse or merge the raw string.

**[exclusion]** An effective header parameter named `Host` or `Content-Length` excludes the target because those fields are processor-owned and cannot be replaced by caller input; the exclusion reopens only if an incorporated HTTP authority defines caller control that preserves the processor's framing and routing obligations.

**[exclusion]** A form-style cookie declaration is statically excluded only when its effective `explode` and resolved declaration prove multi-value production: `explode: true` together with a declaration that declares only `array`, or one that declares only `object` with at least one declared property. A typeless or scalar-admitting declaration proves no such production; if a supplied value nevertheless would produce multiple cookie pairs, that invocation refuses before dispatch. OAS identifies RFC 6570's `&`-separated expansion as incorrect for Cookie's `; ` delimiter, so the exclusion reopens only if an incorporated OAS edition defines a correct multi-value mapping ([OAS 3.1.2 Appendix D](https://spec.openapis.org/oas/v3.1.2.html#appendix-d-serializing-headers-and-cookies)).

## 9. Request and response media

### 9.1 Media identity, alternatives, and request election

**[incorporated]** Media types parse under RFC 9110: type and subtype compare case-insensitively, parameter names compare case-insensitively, and parameter values retain their media-defined comparison rules ([RFC 9110 §§5.6.6, 8.3.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.6.6)).

**[convention]** A **concrete media type** has no wildcard in either its type or subtype; media-type parameters do not affect concreteness.

**[convention]** A declaration matches a concrete media type only when every declared parameter is present with an equal value; matches order by exact type/subtype before `type/*` before `*/*`, then by greatest declared-parameter count, and equal-specificity ties select no declaration.

**[pin]** A declared media-type parameter value is first unquoted under [RFC 9110 §5.6.6](https://www.rfc-editor.org/rfc/rfc9110#section-5.6.6); the value of `charset` then compares ASCII case-insensitively, and every other parameter value, `boundary` included, compares by exact character sequence. RFC 9110 §5.6.6 leaves parameter-value case sensitivity to each parameter's own definition; [RFC 2046 §4.1.2](https://www.rfc-editor.org/rfc/rfc2046#section-4.1.2) marks `charset` as the exception to the general rule, and [RFC 2046 §5.1.1](https://www.rfc-editor.org/rfc/rfc2046#section-5.1.1) constructs the multipart boundary delimiter from the parameter value literally, so an inexact boundary does not delimit.

**[limit]** Distinct content-map keys that normalize to one parsed media identity collide only for that identity and support no selection through it: a request selection refuses before dispatch and a response selection is a loud protocol error. Non-colliding entries survive, and map order never breaks the tie. That normalization is the media-type parse this section already states and nothing further: the case-insensitive type, subtype, and parameter names of §9.1's opening rule, together with the parameter-value comparison the pin above fixes.

**[incorporated]** A no-body invocation bypasses request-body media selection and emits neither a body nor `Content-Type`, because an absent optional Request Body contributes no HTTP content ([OAS 3.1.2 §§4.8.10.1, 4.8.13.1](https://spec.openapis.org/oas/v3.1.2.html#request-body-object)).

**[configuration point]** A body-emitting invocation preserves every admissible declared request alternative: exactly one usable concrete entry — one not excluded by this specification's confinement rules — selects itself; every other map, including two or more usable entries or a concrete declaration alongside a usable range, requires a concrete `requestMedia` choice before input consumption; the choice MUST match under §9.1 and never substitutes another declaration's schema, and supplied values never elect.

**[configuration point]** A missing required choice, unmatched or ambiguous choice, unsupported selected lane, or body-emitting invocation with no admissible candidate refuses before dispatch; no body bytes or examples are sniffed to select a lane.

**[pin]** A body-emitting invocation emits a request `Content-Type` field carrying the concrete media type elected under §9.1; no declaration key, example, or supplied body value substitutes another media type, and beyond a `multipart/form-data` election's `boundary` parameter — which the incorporated authority supplies as a parameter of that media type — this specification adds no parameter of its own to the emitted value. The authority here is non-normative rather than silent, and this specification pins it: RFC 9110 states that "A sender that generates a message containing content SHOULD generate a Content-Type header field in that message unless the intended media type of the enclosed representation is unknown to the sender", which leaves a conforming sender free to omit the field and so fixes no bytes. That SHOULD is pinned to a requirement on this path, and its stated exception never reaches it, an election having already made the intended media type known. No accepted OAS edition states the emission: the edition's only statement about the request `Content-Type` field is that a Header parameter of that name is ignored, which §8.1 already carries ([RFC 9110 §8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3), [RFC 7578 §4.1](https://www.rfc-editor.org/rfc/rfc7578#section-4.1), [OAS 3.1.2 §4.8.12.2.1](https://spec.openapis.org/oas/v3.1.2.html#common-fixed-fields)).

**[incorporated]** Examples illustrate values ([OAS 3.1.2 §4.8.14.1](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-11)).

**[limit]** Examples create no operation input or output member and never select a declaration, carriage lane, or media type.

**[convention]** The binding sends no `Accept` header: OAS ignores a Header parameter named `Accept`, request-body content declares what the operation consumes, and response content supplies no portable instruction to advertise a preference ([OAS 3.1.2 §§4.8.12.2.1, 4.8.13, 4.8.17](https://spec.openapis.org/oas/v3.1.2.html#common-fixed-fields)).

### 9.2 Common carriage lanes

**[pin]** An exact `application/json` or `+json` selection serializes the supplied value as strict JSON on requests and parses strict JSON on responses; JSON text uses UTF-8 ([RFC 6839 §3.1](https://www.rfc-editor.org/rfc/rfc6839#section-3.1), [RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)).

**[pin]** [RFC 6839 §3.1](https://www.rfc-editor.org/rfc/rfc6839#section-3.1) is the incorporated `+json` suffix authority; where its registration inherits RFC 4627's UTF-16/UTF-32 latitude, [RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)'s UTF-8 requirement governs this lane.

**[pin]** Strict JSON is RFC 8259's grammar under this profile: parsing resolves duplicate object member names by taking the lexically last member, the documented common receiver behavior inside RFC 8259 §4's permitted set; a leading byte-order mark on a JSON body is ignored under RFC 8259 §8.1's parser latitude and is never part of the value; and a lone surrogate escape yields no value — it is a loud protocol error, because neither silent replacement nor invalid passthrough preserves the supplied text ([RFC 8259 §§4, 8.1–8.2](https://www.rfc-editor.org/rfc/rfc8259#section-4)).

**[limit]** JSON-lane numbers are interoperable within RFC 8259 §6's binary64 expectation. The permitted set is explicit and has two members: an implementation MAY preserve the supplied mathematical value exactly, and it MAY reduce it to the nearest binary64 value; nothing else is permitted, and no other deviation from the supplied value is. A conformant implementation therefore never fails or refuses for range or precision alone, and two conformant implementations MAY differ on a value outside binary64 — that difference is this declared set and not a defect ([RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259#section-6)).

**[convention]** `text/json` is not a member of that JSON lane; as a `text/*` type it can use the character-data lane only when its resolved declaration admits `string` as its sole non-null type. This convention reopens under a new identifier only if the IANA media-type registry registers `text/json` with JSON semantics.

**[convention]** A concrete character-data selection governed by a resolved declaration that admits `string` as its sole non-null type carries a supplied string under its declared `charset`, defaulting to UTF-8; `type: ["string", "null"]` therefore selects this lane for its string branch, while a supplied null refuses before dispatch because the lane defines no null lexical form. Response decoding emits a string and never invents null. The closed character-data set is `text/*`, `application/xml`, and `+xml`, while `application/json` and `+json` are claimed by the JSON lane. The binding does not consult the live media-type registry's `Encoding considerations`: `application/json` is registered as binary, `text/csv` records no value, and a live lookup would violate this pinned, immutable reading ([RFC 6838 §4.2.1](https://www.rfc-editor.org/rfc/rfc6838#section-4.2.1), [RFC 2046 §4.1](https://www.rfc-editor.org/rfc/rfc2046#section-4.1), [RFC 7303 §§3, 9](https://www.rfc-editor.org/rfc/rfc7303#section-3)).

**[pin]** This binding is an XML-unaware MIME consumer in RFC 7303 §3's own terms — it processes XML media as opaque character data, never as parsed XML — and the charset parameter is the only character-encoding source this lane consults: consulting a BOM or XML declaration would require inspecting body bytes, which this binding never sniffs, so a charset-less non-UTF-8 XML response is a loud protocol error rather than being sniffed, and every unsupported or invalid character decoding likewise raises a loud protocol error ([RFC 7303 §3.2](https://www.rfc-editor.org/rfc/rfc7303#section-3.2)).

**[pin]** The UTF-8 default charset displaces RFC 2046 §4.1.2's US-ASCII default for `text/*`: RFC 9110 §8.3.2 leaves charset semantics to each media type's registration rather than restating a MIME-era default, and this binding pins the modern-HTTP UTF-8 reading, disclosed here as a deliberate displacement ([RFC 2046 §4.1.2](https://www.rfc-editor.org/rfc/rfc2046#section-4.1.2), [RFC 9110 §8.3.2](https://www.rfc-editor.org/rfc/rfc9110#section-8.3.2)).

**[limit]** UTF-8 decoding MUST be supported; any further charset is an implementation capability whose absence refuses loudly.

**[incorporated]** OAS permits a concrete binary media declaration to omit `schema`; a memberless Schema Object and boolean `true` likewise assert no instance type, so all three forms have a typeless resolved declaration ([OAS 3.1.2 §§4.4.2, 4.8.14.3, 4.8.24](https://spec.openapis.org/oas/v3.1.2.html#working-with-binary-data)).

**[convention]** A non-JSON, non-form concrete selection whose Media Type Object omits `schema`, or whose present resolved declaration is typeless, uses the raw-octet lane. A schema-omitted media range does not gain this lane because it declares no single concrete representation.

**[incorporated]** Every other keyword in a typeless resolved declaration still applies, because an assertion defined for one instance type succeeds for instances of other types rather than removing them from the declaration's reach. Separately, `maxLength` on raw content measures wire octets rather than the Base64 boundary string: the governing text says of unencoded binary that "the length is the number of octets" ([JSON Schema Core §7.6.1](https://json-schema.org/draft/2020-12/json-schema-core.html#section-7.6.1) for the first clause, [OAS 3.1.2 §4.4.2](https://spec.openapis.org/oas/v3.1.2.html#working-with-binary-data) for the second).

**[incorporated]** A resolved declaration that admits `string` as its sole non-null type with `contentEncoding` carries the caller's artifact-encoded string as text and does not trigger OpenBindings Base64 decoding, the governing text requiring that implementations "MUST NOT automatically decode, parse, and/or validate the string contents by default"; schema encoding and HTTP `Content-Encoding` are distinct ([OAS 3.1.2 §4.4.2](https://spec.openapis.org/oas/v3.1.2.html#working-with-binary-data), [JSON Schema Validation §8.2](https://json-schema.org/draft/2020-12/json-schema-validation.html#section-8.2) for the no-automatic-decoding requirement, [§8.3](https://json-schema.org/draft/2020-12/json-schema-validation.html#section-8.3) for the distinction from HTTP's header).

**[incorporated]** On a resolved declaration whose type set excludes `string`, `contentEncoding` and `contentMediaType` are inert annotations: they cause no refusal, select no encoded-string handling, and emit no `Content-Transfer-Encoding`, because both keywords apply only when the instance is a string ([JSON Schema Validation §§8.3–8.4](https://json-schema.org/draft/2020-12/json-schema-validation.html#section-8.3), [OAS 3.1.2 §§4.4, 4.8.15.3](https://spec.openapis.org/oas/v3.1.2.html#data-types)).

**[pin]** Every OpenBindings raw-octet value is a JSON string containing canonical RFC 4648 §4 Base64: standard alphabet, required padding, no ignored non-alphabet characters, and zero unused pad bits; requests decode before dispatch and responses encode the exact octets ([RFC 4648 §§3.3, 3.5, 4](https://www.rfc-editor.org/rfc/rfc4648)).

**[exclusion]** This specification does not generate XML from an object model because the OAS XML Object does not determine complete document bytes; the selected media alternative is excluded until an incorporated authority defines ordering, escaping, nulls, dynamic keys, and scalar lexical forms, while string and raw-octet XML carriage remain admitted ([OAS 3.1.2 §§4.8.14, 4.8.26](https://spec.openapis.org/oas/v3.1.2.html#xml-object)).

**[convention]** Because `readOnly` and `writeOnly` are annotations whose enforcement OAS leaves to the application, this binding never uses them to delete a supplied wire member or synthesize an absent one ([OAS 3.1.2 §4.8.24.3.2](https://spec.openapis.org/oas/v3.1.2.html#validating-readonly-and-writeonly)).

**[exclusion]** A concrete request or response selection admitted by none of the JSON, character-data, raw-octet, string XML carriage under §9.2's XML rule, request-only form and multipart, or other explicitly incorporated lanes is excluded at its smallest media owner because OAS supplies no value-to-bytes mapping; the exclusion reopens only if an incorporated authority defines that media/data-form cell.

**[incorporated]** Invoking this binding does not trigger validation of any application value against its governing Schema Object; only a tool that separately claims validation owes Core's validation rules (Core [invariant 2](../../openbindings.md#2-core-invariants), [OBI-T-16](../../openbindings.md#103-tool-rules)).

### 9.3 Form bodies and multipart parts

**[incorporated]** `application/x-www-form-urlencoded` and `multipart/form-data` serialize object properties under the governing Schema and Encoding Objects. A `schema` is REQUIRED to define the input parameters when using multipart content — every accepted edition says so, 3.1.0 as "in contrast to 2.0" and 3.1.1/3.1.2 as "in contrast to OpenAPI 2.0" ([OAS 3.1.2 §§4.8.15.2, 4.8.15.3](https://spec.openapis.org/oas/v3.1.2.html#encoding-the-x-www-form-urlencoded-media-type); §§4.8.14.4 and 4.8.14.5 are pointers to those two sections and carry none of the substance).

**[exclusion]** A `multipart/form-data` alternative declaring no `schema` is excluded at its smallest media owner, because the edition's REQUIRED marker leaves the part set undetermined and this specification derives no part from an absent declaration; the exclusion reopens only if an incorporated OAS edition removes that requirement, as the 3.2 line does. Note that a schema-omitted **non-multipart** binary declaration is expressly permitted and takes §9.2's raw-octet lane; the requirement here is multipart-specific.

**[exclusion]** The form and multipart lanes are request-only: the incorporated authority's form and multipart sections are request-scoped by their own headings and supply no reverse mapping from those bytes to an application value, so a response selection of either lane is excluded at its smallest media owner. The exclusion reopens only if an incorporated authority defines that decoding.

**[convention]** A supplied `body: null` against a form or multipart object declaration refuses before dispatch. The reason is not that the lane has no null lexical form — the property rule below elides a null property precisely because none is needed — but that these lanes serialize the **members** of an object and a null body supplies no member set at all, so there is nothing to elide and nothing to write. A null property is a member that is present and empty; a null body is the absence of the structure the lane consumes.

**[limit]** A non-object declaration excludes the form lane at its smallest owning unit under §3.2's smallest-owner rule.

**[incorporated]** For a dynamic object member, the resolved property declaration conjoins an exact `properties` schema and every matching `patternProperties` schema, or uses `additionalProperties` when no exact or pattern schema matches; applicable `allOf` constraints remain in force ([JSON Schema Core §10.3.2](https://json-schema.org/draft/2020-12/json-schema-core.html#section-10.3.2)).

**[convention]** For form-carriage selection, a resolved property declaration uses §5.2's sole-non-null-choice member; the 3.1 spelling `type: [<non-null-type>, "null"]` contributes the same resolved type set ([OAS 3.1.2 §§4.4, 4.8.15.1.1, Appendix B](https://spec.openapis.org/oas/v3.1.2.html#appendix-b-data-type-conversion)).

**[incorporated]** When any Encoding `style`, `explode`, or `allowReserved` control selects the RFC 6570 style path, a supplied JSON null follows §8.1's corrected `undefined` cell for the effective `style` and `explode`; it is not blanket-elided ([OAS 3.1.2 §§4.8.15.1, C.4](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-12)).

**[convention]** After content-based form encoding selects an explicit concrete `contentType` or determines its default, a supplied null property is elided as an omitted optional member and contributes neither a form-urlencoded field nor a multipart part; this rule is separate from §8.1's style-path handling.

**[limit]** That elision identifies `{}` and `{"x": null}` on the wire: a deliberate loss inside the authority's data-type-conversion latitude, disclosed here — the distinction between an absent optional member and an explicit null does not survive this lane ([OAS 3.1.2 Appendix B](https://spec.openapis.org/oas/v3.1.2.html#appendix-b-data-type-conversion)).

**[incorporated]** Encoding `style`, `explode`, and `allowReserved` controls apply to both form-urlencoded and multipart/form-data; explicit presence of any control selects RFC 6570-style serialization and absent sibling controls take their defaults, while absence of all three selects content-based encoding ([OAS 3.1.2 §§4.8.15.1, C.4](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-12)).

**[incorporated]** Form-urlencoded removes RFC 6570's leading `?`; multipart writes values inside named parts with no URI percent-encoding, and `allowReserved` has no multipart effect ([OAS 3.1.2 Appendix C](https://spec.openapis.org/oas/v3.1.2.html#appendix-c-using-rfc6570-based-serialization)).

**[incorporated]** The form-urlencoded content path follows RFC 1866 form encoding while the style path follows RFC 6570, which "does not use `+` for form-urlencoded"; the two paths therefore spell one value differently and this specification does not collapse them into one ([OAS 3.1.2 Appendix E.4](https://spec.openapis.org/oas/v3.1.2.html#appendix-e-percent-encoding-and-form-media-types), [RFC 1866 §8.2.1](https://www.rfc-editor.org/rfc/rfc1866#section-8.2.1), [RFC 6570](https://www.rfc-editor.org/rfc/rfc6570)).

**[convention]** Within the content-based form-urlencoded path the authority permits more than one byte spelling and this specification declares the set rather than picking one, because picking one would collapse an expressly permitted alternative the paragraph above says it preserves. The permitted spellings are exactly these, and no others: SPACE is written `+` or `%20` — "while the encoding algorithm given by RFC1866 requires escaping the space character as `+`, percent-encoding it as `%20` also meets the above requirements" — and `~` is written literally or as `%7E`, the authority recommending the encoded form "to align with the historical requirements of [RFC1738]" while its own interoperability guidance points both ways; every other RFC 3986 unreserved byte stays literal, and every other UTF-8 byte is written as uppercase `%HH`. Every member of this set percent-decodes, under form-urlencoded decoding, to the supplied value, which is the property that makes the set safe to leave open. Two conformant processors may therefore emit different bytes here, and that is the declared permitted set, not a divergence ([OAS 3.1.2 §4.8.12.4](https://spec.openapis.org/oas/v3.1.2.html#url-percent-encoding), [Appendix E.4.1–E.5](https://spec.openapis.org/oas/v3.1.2.html#appendix-e-percent-encoding-and-form-media-types)).

**[incorporated]** **On the content-based path only**, a property's Encoding media type is selected as follows: an explicit single concrete Encoding `contentType`; otherwise `application/octet-stream` for a typeless resolved declaration or one that admits `string` as its sole non-null type with `contentEncoding`, `text/plain` for a plain string or number/integer/boolean, `application/json` for an object, and the item-type default for an array. This selection governs both lanes that carry Encoding Objects — the content-based form-urlencoded path and multipart parts — because the edition places `contentType` among the Encoding Object fields that "MAY be used either with or without the RFC6570-style serialization fields" and attaches the multipart-only restriction to `headers` instead; on the multipart path the selected type is the part's `Content-Type`. The path scope is the authority's own: of each of `style`, `explode` and `allowReserved` the edition says "if a value is explicitly defined, then the value of `contentType` (**implicit or explicit**) SHALL be ignored", so on the style path neither an explicit `contentType` nor this default table applies ([OAS 3.1.2 §§4.8.15.1.1, 4.8.15.1.2](https://spec.openapis.org/oas/v3.1.2.html#common-fixed-fields-0)).

**[convention]** A style-path part therefore carries no `Content-Type` header at all: the authority removes every `contentType` input and states no replacement, and the part's content is RFC 6570-serialized text, for which an absent part `Content-Type` already means `text/plain` ([RFC 7578 §4.4](https://www.rfc-editor.org/rfc/rfc7578#section-4.4)). A part whose media type this specification cannot state is never given a guessed one.

**[pin]** On both content-based lanes, a supplied JSON number or boolean written into a `text/plain` part or form field is written as its shortest RFC 8259 lexical form — `true` and `false` for booleans, and for a number the shortest spelling that round-trips the supplied value under RFC 8259 §6. This is a serialization by media type and not a `parameterConversion` site: §8.1's converter is scoped to the `schema`-form and RFC 6570-style paths, and requiring configuration to write `7` into a `text/plain` part would make an artifact-determined byte depend on a consumer choice ([RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259#section-6), [OAS 3.1.2 §4.8.15.1.1](https://spec.openapis.org/oas/v3.1.2.html#common-fixed-fields-0)).

**[incorporated]** Every `multipart/form-data` part carries `Content-Disposition: form-data` with the schema-property name in its `name` parameter; an array property emits one part per element under that same name ([OAS 3.1.2 §§4.8.15, 4.8.15.3](https://spec.openapis.org/oas/v3.1.2.html#encoding-multipart-media-types)).

**[exclusion]** A property name that cannot be represented safely as the multipart `name` parameter, including any name containing CR or LF, excludes only that multipart media alternative; the exclusion reopens only if an incorporated authority defines an unambiguous encoding.

**[convention]** Repeated parts for one array preserve element order; cross-property part order has no portable meaning, while property-to-name membership is fixed.

**[convention]** A part with a typeless resolved declaration uses the raw-octet lane and §9.2's canonical Base64 boundary; a part whose resolved declaration admits `string` as its sole non-null type with `contentEncoding` remains artifact-encoded text.

**[pin]** Neither case emits a `Content-Transfer-Encoding` field, and the departure this represents is disclosed rather than left implicit. The edition states an equivalence — "using `contentEncoding` for a multipart field is equivalent to specifying an Encoding Object with a `headers` field containing `Content-Transfer-Encoding` with a schema that requires the value used in `contentEncoding`" — from which an emitted field could be read. The same section states that the field "is deprecated for `multipart/form-data` ([RFC7578] Section 4.7) where binary data is supported, as it is in HTTP", and the Encoding `headers` rule below makes every surviving declared part header descriptive at this boundary. This specification pins the non-emitting reading on those two grounds: the equivalence describes what a declaration means, not a field a serializer adds, and emitting a deprecated field is not something an equivalence sentence requires. The pin reopens only if an incorporated OAS edition states the emission as a serialization requirement ([OAS 3.1.2 §4.8.15.3](https://spec.openapis.org/oas/v3.1.2.html#encoding-multipart-media-types), [RFC 7578 §4.7](https://www.rfc-editor.org/rfc/rfc7578#section-4.7)).

**[configuration point]** On the content-based path for either `application/x-www-form-urlencoded` or `multipart/form-data`, a wildcard or comma-separated multi-valued Encoding `contentType` requires one concrete `propertyMedia` choice for each affected form or multipart property; the choice MUST satisfy a declared member under §9.1, and an absent, unmatched, or ambiguous required choice refuses before dispatch.

**[incorporated]** Two Encoding `headers` cases are ignored before any rule of this section reads the map: the map itself "SHALL be ignored if the request body media type is not a `multipart`", and within it "`Content-Type` is described separately and SHALL be ignored in this section" ([OAS 3.1.2 §4.8.15.1.1](https://spec.openapis.org/oas/v3.1.2.html#encoding-headers)).

**[limit]** What survives that ignore rule is descriptive at this operation boundary: the binding emits no part header merely from a Header Object schema and never emits an undeclared `Content-Transfer-Encoding` ([OAS 3.1.2 §4.8.15.1.1](https://spec.openapis.org/oas/v3.1.2.html#encoding-headers)).

**[exclusion]** A multipart media alternative declaring a **non-ignored** required part Header Object whose value the artifact does not itself fix is excluded, because this specification defines no caller channel for part headers and the needed value cannot be carried under this identifier; detection is exactly a governing Encoding Header Object that survives the ignore rule above, carries `required: true`, and fixes no value. An ignored entry, `Content-Type` included, never triggers this exclusion whatever it declares. The exclusion reopens only if an incorporated authority defines caller part-header carriage.

**[exclusion]** Where a multipart field carries `contentEncoding` and a surviving Encoding `Content-Transfer-Encoding` Header Object whose schema disallows that value, the edition states in terms that "the result is undefined for serialization and parsing"; this specification therefore excludes the multipart media alternative rather than choosing between two encodings the artifact declares at once. The owner is the alternative, matching the two exclusions above, and the exclusion reopens only if an incorporated OAS edition defines that conflict's outcome ([OAS 3.1.2 §4.8.15.3](https://spec.openapis.org/oas/v3.1.2.html#encoding-multipart-media-types)).

**[exclusion]** A multipart media type other than `multipart/form-data` is excluded because OAS defines no property-to-part correlation for it; the exclusion reopens only if an incorporated OAS edition defines that correlation ([OAS 3.1.2 §4.8.14.5](https://spec.openapis.org/oas/v3.1.2.html#special-considerations-for-multipart-content)).

### 9.4 HTTP content codings

**[incorporated]** HTTP `Content-Encoding` is distinct from media type and from Schema Object `contentEncoding`; request codings apply in listed wire order and response codings decode in reverse order before the selected media lane ([RFC 9110 §8.4](https://www.rfc-editor.org/rfc/rfc9110#section-8.4), [OAS 3.1.2 §4.4.2](https://spec.openapis.org/oas/v3.1.2.html#working-with-binary-data)).

**[incorporated]** HTTP field names compare ASCII case-insensitively, and the case sensitivity of OAS names that map directly to HTTP concepts follows HTTP's rules ([OAS 3.1.2 §3.8](https://spec.openapis.org/oas/v3.1.2.html#case-sensitivity), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[convention]** That a content coding is declared through an effective request Header Parameter named `Content-Encoding` and a governing response Header Object of that name, and through nothing else, is this specification's closure: OAS designates no declaration surface for content codings, so the enumeration is authored here rather than incorporated ([OAS 3.1.2 §§4.8.12, 4.8.17](https://spec.openapis.org/oas/v3.1.2.html#header-object)).

**[exclusion]** Two governing response Header Object keys that differ only by ASCII case exclude the smallest owning response alternative before any actual response is inspected, whenever both govern binding behavior under this specification — the content-coding surface above, and any Header Object declaring `required: true`, whose absence §9.5 makes a loud protocol error. This edition's Header Object carries a `required` field, so the second case is real here and the enumeration is not narrowed to the first. The exclusion reopens only if an incorporated authority defines a wire mapping that preserves such case-distinct declarations ([OAS 3.1.2 §4.8.21](https://spec.openapis.org/oas/v3.1.2.html#header-object)).

**[configuration point]** `requestContentCodings` and `responseContentCodings` are finite consumer maps from case-insensitive content-coding tokens to deterministic encoders and decoders; on requests the caller-supplied effective `Content-Encoding` header parameter value fixes the encoder stack, while on responses the actual value governed by the Response Header Object fixes the decoder stack, and no configuration preference narrows either declared surface. The request-side coding list is the caller's supplied value before §8.2 serializes it — a supplied array is that list in order, a supplied string is a one-token list — and the serialized field is never parsed back into tokens; the response-side coding list is the actual field value split on `,` with optional whitespace stripped, under [RFC 9110 §5.6.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.6.1)'s list production. Two configuration tokens in either map that collide after ASCII case-folding are not a usable configuration, and an invocation reading that map refuses before dispatch, mirroring §9.1's normalized-identity collision rule.

**[configuration point]** An unsupported token, a field value not admitted by its governing Header declaration, an ambiguous coding declaration, or an actual response coding with no governing Header Object is never skipped or sniffed: a request-side condition refuses before dispatch and a response-side condition is a loud protocol error; configuring a codec supplies capability but never declares a coding the artifact omitted.

### 9.5 Response declaration, classification, and decoding

**[convention]** Throughout this section, every Response Object, Header Object, and Media Type Object named is the declaration that remains after §5.1's reference resolution. The edition types a Responses member as `Response Object | Reference Object` and a `headers` member as `Header Object | Reference Object`, so the fixed-field rules below read the resolved declaration and never treat a Reference Object as a violation of the object it references ([OAS 3.1.2 §§4.8.16, 4.8.17.1](https://spec.openapis.org/oas/v3.1.2.html#responses-object)).

**[incorporated]** Response keys are closed to exact three-digit status codes `100` through `599`, the five ranges `1XX` through `5XX`, `default`, and specification extensions; an exact key overrides its matching range ([OAS 3.1.2 §§3.7, 4.8.16](https://spec.openapis.org/oas/v3.1.2.html#responses-object), [RFC 9110 §15](https://www.rfc-editor.org/rfc/rfc9110#section-15)).

**[exclusion]** A Responses key outside that closed admitted set is a declaration defect that excludes the selected target before any actual response is inspected; the exclusion reopens only if an incorporated OAS 3.1 edition admits that exact key form.

**[exclusion]** An upstream-invalid governing Response Object — one that is not a Response Object at all, or one violating the Response Object's fixed-field constraints: a `description` that is not a string, a `content`, `headers`, or `links` value that is not a map, or a `headers` member that is not a Header Object — is a declaration defect that excludes the selected target before any actual response is inspected, because response governance is target-level; the exclusion reopens only if an incorporated OAS 3.1 edition admits the exact declaration ([OAS 3.1.2 §4.8.17.1](https://spec.openapis.org/oas/v3.1.2.html#response-object)).

**[limit]** The exclusion above reaches only a Response Object that can GOVERN a SUCCESSFUL response: an exact 2xx status key, the `2XX` range key, or `default` when no `2XX` range key is declared — a `2XX` key covers the whole success class, so `default` can then never govern one. A fixed-field violation in a declaration that can never govern a 2xx status incurs no coverage loss — a failure body is decoded best-effort under this same section, so a defect in a declaration that can never govern a 2xx status can only leave the failure data undecoded and can never misstate a value this operation contract carries — and therefore does not exclude: a target whose success declarations are intact stays represented. It is the same no-coverage-loss reasoning that carves out the `description` omission below ([OAS 3.1.2 §4.8.16](https://spec.openapis.org/oas/v3.1.2.html#responses-object)).

**[limit]** One violation is carved out and does not exclude: a governing Response Object that omits its REQUIRED `description` while declaring no content incurs no coverage loss — nothing it states about a response body is misdeclared — and the selected target remains represented. The same omission WITH declared content excludes as above, and a `description` that is present with a non-string value is a fixed-field violation rather than an omission and excludes as above.

**[limit]** The reasoning above is this specification's and is identical on all four sibling lines; the AUTHORITY it reads is not, and the difference must not be confused with sibling drift. OAS 3.0.4 and OAS 3.1.2 both mark the Response Object's `description` **REQUIRED**, which is what makes its omission a violation at all; OAS 3.2.0 drops that marker and adds a `summary` field, so on the 3.2 line the omission is not a violation and there is nothing to carve out. Read this as an edition difference, never as sibling drift ([OAS 3.1.2 §4.8.17.1](https://spec.openapis.org/oas/v3.1.2.html#response-object) and [OAS 3.0.4 §4.7.17.1](https://spec.openapis.org/oas/v3.0.4.html#response-object) against [OAS 3.2.0 §4.17.1](https://spec.openapis.org/oas/v3.2.0.html#response-object)).

**[convention]** The governing Response Object lookup order is exact status, then the single matching range, then `default`; range-over-default is this specification's reading, and declarations never reclassify the native status.

**[incorporated]** RFC 9110 defines the 2xx class as successful ([RFC 9110 §15.3](https://www.rfc-editor.org/rfc/rfc9110#section-15.3)).

**[convention]** For this binding, success means that the final status—the status after any interim responses and any redirects the runtime chose to follow with the bound method and complete body preserved—is in that 2xx class; a method-rewriting redirect is the final response of this interaction, and anything a runtime does after it is a different interaction outside this classification.

**[convention]** Redirect following is runtime policy. A redirect followed with the bound method and complete body preserved remains this interaction; a method-rewriting redirect is a final response of this interaction ([RFC 9110 §15.4](https://www.rfc-editor.org/rfc/rfc9110#section-15.4)).

**[limit]** Outcome classification depends on the final status, while redirect following and transport content negotiation, including a runtime-advertised `Accept-Encoding`, are runtime policy under Core §1.2. Two conformant runtimes MAY therefore classify one wire history differently, and that redirect/negotiation variance is the stated permitted set; the binding itself emits no negotiation field beyond those this specification pins (Core [§1.2](../../openbindings.md#12-out-of-scope)).

**[incorporated]** A response Header Object named `Content-Type` is ignored. Every other governing response Header Object declaring `required: true` makes that header mandatory in the actual response ([OAS 3.1.2 §§4.8.17, 4.8.21](https://spec.openapis.org/oas/v3.1.2.html#response-headers)).

**[limit]** An actual response missing such a declared required header is a loud protocol error, in the same class as the undeclared non-empty-response error below; header carriage remains outside the operation-value boundary.

**[incorporated]** A non-empty response selects its concrete media type from `Content-Type` and then the most-specific matching governing content declaration ([OAS 3.1.2 §§4.8.16, 4.8.17](https://spec.openapis.org/oas/v3.1.2.html#response-object)).

**[convention]** An unmatched, ambiguous, or normalized-colliding result is a loud protocol error.

**[convention]** When a non-empty response omits `Content-Type`, the binding takes RFC 9110's permitted `application/octet-stream` assumption before ordinary matching; the resulting type still MUST match a governing declaration ([RFC 9110 §8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3)).

**[convention]** An **empty response** has zero content octets after transfer decoding and content-coding decoding; a response to HEAD is empty by definition.

**[convention]** Empty responses emit no output value; successful non-empty responses emit the selected lane's one application value.

**[convention]** A failure body is decoded through the same selected carriage lanes as a successful body, and the decoded value is carried as opaque application-authored failure data on unsuccessful completion. That decoding is best-effort: when the governing content declaration is defective, or when no governing content declaration matches the actual media type, the interaction completes unsuccessfully with no failure-data value and raises no loud protocol error. A failure declaration is therefore not load-bearing for representation, which is the reason the success-scoped exclusion above gives. A governing Response Object that declares no response content at all is not such a case: it states positively that no content is returned, so an actual non-empty body under it contradicts a declaration and remains a loud protocol error whatever the final status.

**[convention]** The unary response value commits only after transfer completion and the full decode chain — content codings, then character decoding, then the selected lane — succeed; any failure after a 2xx final status and before that commit is a loud protocol error, and the interaction completes unsuccessfully with no partial unary value.

**[limit]** A non-empty response with no governing Response Object is a loud protocol error, even though omission of `responses` leaves the operation addressable. This specification defines no response-header or Link carriage in an operation value, so Response Header and Link Objects create no output members under this identifier; consequently, even a declared `Location` header on a `201` response reaches no operation value ([OAS 3.1.2 §§4.8.10.1, 4.8.17](https://spec.openapis.org/oas/v3.1.2.html#operation-responses)).

**[limit]** One HTTP response body produces at most one operation value: the accepted 3.1 editions define no construct that frames one response body into multiple application values, including for `text/event-stream`.

## 10. Servers and target URL

**[incorporated]** Server declarations are scoped at Operation, Path Item, and root levels, with the more specific declaration overriding the outer scope; an absent or empty root list is equivalent to one Server Object whose URL is `/` ([OAS 3.1.2 §§4.8.1.1, 4.8.5, 4.8.9.1, 4.8.10.1](https://spec.openapis.org/oas/v3.1.2.html#server-object)).

**[convention]** An empty Operation or Path Item `servers` array supplies no local alternative and falls through to the next outer scope, matching the root empty-equals-absent precedent.

**[configuration point]** One effective server selects itself; multiple members require one consumer `server` choice before dispatch, the same value carries exact variable substitutions, and no member or variable preference is inferred.

**[incorporated]** Server variables substitute into the URL where named in braces, and `default` is REQUIRED and "SHALL be sent if an alternate value is not supplied". A declared `enum` "MUST NOT be empty", and where an enum is defined the **`default`** value "MUST exist in the enum's values" ([OAS 3.1.2 §4.8.6.1](https://spec.openapis.org/oas/v3.1.2.html#server-variable-object)).

**[pin]** That membership MUST binds `default` alone; the edition constrains no consumer-supplied value and states no consequence for one outside the enum. This specification extends the constraint and supplies the consequence: a consumer-supplied value for a variable with a declared `enum` MUST be a member of it, and a variable left unresolved by declaration and configuration together refuses before dispatch. The extension is disclosed rather than carried under the authority label, because a declaration that enumerates its own admitted values and a consumer value outside them cannot both be honored, and refusing is the only outcome that neither guesses nor dispatches an undeclared host.

**[incorporated]** A Server URL MUST contain neither query nor fragment. Before path assembly, an expanded relative Server URL—including the implied `/`—resolves against the location of the document containing that Server Object; the operation's path bytes are then appended to the resolved Server URL with no relative URL resolution, which the edition states in those words ([OAS 3.1.2 §§4.7, 4.8.5.1, 4.8.8.1](https://spec.openapis.org/oas/v3.1.2.html#server-url)).

**[pin]** "Appended" is pinned here to *verbatim*: no slash normalization and no path repair either. The edition forbids only relative resolution, so this is an entailment stated as this specification's own, and its consequence is stated with it — a Server URL ending in `/` and a Paths key beginning with `/`, the default server `/` included, produce a doubled slash in the completed target, and this rule forbids repairing it. Repair is excluded because a processor that silently rewrites the constructed path can address a resource the artifact did not declare, and no incorporated authority defines the rewrite.

**[exclusion]** A Server URL containing a query or fragment excludes each target that would use that Server alternative; the exclusion reopens only if an incorporated OAS edition defines the exact cell.

**[limit]** When embedded content has no document location to supply that base, a relative Server URL leaves the target unresolved and refuses before dispatch; the complete configured URL below remains the available recovery.

**[incorporated]** After path and query serialization, the completed target MUST parse and percent-decode under RFC 3986; an unusable target refuses before dispatch ([OAS 3.1.2 §4.8.12.4](https://spec.openapis.org/oas/v3.1.2.html#url-percent-encoding), [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)).

**[convention]** That parse and percent-decode is a well-formedness check only: the dispatched bytes are the constructed percent-encoded bytes, and the completed target is never dispatched in decoded form.

**[exclusion]** A Server Object whose URL declares a scheme other than `http` or `https` excludes each target that would use that Server alternative, before any caller value is inspected, because no incorporated authority defines that scheme's HTTP-semantics mapping; the exclusion reopens only if an incorporated authority defines that mapping.

**[convention]** A scheme reached only at invocation — through a Server Variable substitution or a complete configured URL — excludes nothing, because it is not a declaration fact: the completed target refuses before dispatch on the same ground instead. The two halves are stated separately so that the static half reaches synthesis coverage and the invocation half does not pretend to.

**[configuration point]** The `server` configuration point MAY instead supply one complete consumer-configured URL. That URL is itself a valid `server` value and by itself discharges any required member choice; it MUST satisfy the same scheme and no-query/no-fragment constraints as an artifact Server URL, it replaces the resolved server base, and the operation's path bytes append verbatim to it; the artifact's path template, path substitution, query construction, method, parameters, body, response, and security semantics remain unchanged.

## 11. Security and channel assembly

**[incorporated]** Operation `security` replaces root `security`; `[]` means no security requirement, array members are OR alternatives, every nonempty Security Requirement Object is an AND of its named schemes, and `{}` is a complete anonymous alternative ([OAS 3.1.2 §§4.8.10.1, 4.8.30](https://spec.openapis.org/oas/v3.1.2.html#security-requirement-object)).

**[configuration point]** The binding preserves every complete alternative and invents no anonymous-versus-credentialed preference. The named configuration point `security` selects one complete alternative: a sole declared alternative selects itself, and an effective empty `[]` or anonymous optional-security alternative counts as a complete no-security alternative; multiple alternatives require an explicit choice, fragments from different alternatives are never combined, and an invocation with no selection where one is required refuses before dispatch.

**[incorporated]** Requirement arrays for OAuth 2.0 and OpenID Connect contain scopes, arrays for other schemes may contain roles, and this binding surfaces those exact strings without interpreting roles in-band or executing acquisition flows ([OAS 3.1.2 §4.8.30.1](https://spec.openapis.org/oas/v3.1.2.html#security-requirements-name)).

**[configuration point]** `implicitConnectionScope` selects `entry` or `referring` document resolution for Security Requirement names and defaults to `entry`, following OAS's recommended entry-document scope while preserving the explicit alternative ([OAS 3.1.2 §4.3.3](https://spec.openapis.org/oas/v3.1.2.html#resolving-implicit-connections)).

**[incorporated]** HTTP authentication-scheme tokens compare ASCII case-insensitively ([RFC 9110 §11.1](https://www.rfc-editor.org/rfc/rfc9110#section-11.1), [OAS 3.1.2 §4.8.27.1](https://spec.openapis.org/oas/v3.1.2.html#security-scheme-scheme)).

**[incorporated]** A Security Scheme Object declares a REQUIRED `type` from the closed set `apiKey`, `http`, `mutualTLS`, `oauth2`, `openIdConnect`, and each type carries its own REQUIRED fields: `apiKey` requires `name` and `in` from `query`, `header`, or `cookie`; `http` requires `scheme`; `oauth2` requires `flows`; `openIdConnect` requires `openIdConnectUrl`. `apiKey` credentials use their declared name and location, and HTTP `basic` and `bearer` credentials use the `Authorization` field ([OAS 3.1.2 §4.8.27.1](https://spec.openapis.org/oas/v3.1.2.html#security-scheme-object), [RFC 9110 §11.6.2](https://www.rfc-editor.org/rfc/rfc9110#section-11.6.2)).

**[exclusion]** A Security Scheme Object that is not one — a missing or unlisted `type`, or an absent or wrong-typed field its `type` makes REQUIRED — excludes every security alternative naming it, before any runtime credential is inspected, because the declaration fixes neither what to send nor where. Every remaining complete alternative survives, and a target left with no complete alternative is itself excluded under §3.2's smallest-owner rule. The exclusion reopens only if an incorporated OAS 3.1 edition admits the exact declaration.

**[pin]** A selected `basic` scheme consumes a runtime-supplied user-id and password and constructs `Authorization: Basic base64(user-id ":" password)` under [RFC 7617 §2](https://www.rfc-editor.org/rfc/rfc7617#section-2), including its user-id, password, and Base64 constraints. Because RFC 7617 §2 deliberately leaves the default character encoding undefined, the user-id and password octets are pinned to printable US-ASCII (0x20–0x7E); a credential containing any other character leaves the selected alternative unusable, and the invocation refuses before dispatch. This pin reopens only if an incorporated authority defines a charset-parameter declaration surface for the scheme.

**[convention]** `mutualTLS` is a transport prerequisite rather than a header credential; a selected alternative requiring it is complete only when the runtime has established the declared client-certificate condition.

**[pin]** A selected `apiKey` scheme consumes a runtime-supplied key value and emits it at the declaration's exact query, header, or cookie destination.

**[exclusion]** OAuth 2.0 and OpenID Connect flows consume a runtime-supplied access token and use the `Bearer` authorization scheme under [RFC 6750 §2.1](https://www.rfc-editor.org/rfc/rfc6750#section-2.1). [RFC 6749 §7.1](https://www.rfc-editor.org/rfc/rfc6749#section-7.1) defines access-token types as extensible, and every token type other than Bearer is excluded from wire carriage under this identifier: no rule of this specification constructs a field for one. That exclusion is a statement about this specification's carriage surface, not about any artifact declaration, so it removes no alternative from synthesis and appears in no coverage entry — an `oauth2` alternative remains represented and its Bearer carriage remains complete. The exclusion reopens only if an incorporated authority defines another token type's carriage.

**[convention]** The runtime half is separate and is a prerequisite, not an exclusion: a runtime whose supplied token is not Bearer-typed leaves the selected alternative unusable, and the invocation refuses before dispatch, exactly as the other-scheme sentence below provides. Token type is a runtime fact and never a declaration fact, so it can reach no coverage entry.

**[limit]** Any other declared HTTP authentication scheme remains visible as a consumer prerequisite, but this binding synthesizes no credential bytes for it; an alternative requiring it is unusable unless the runtime satisfies it as a complete prerequisite.

**[convention]** A credential destination that collides with an effective parameter, another credential in the same AND requirement, or binding/processor-owned `Host`, `Content-Length`, `Content-Type`, or `Accept` makes only the selected security alternative unusable. `Accept` belongs on that list although §9.1 emits none: emitting no `Accept` is this specification's decision about response-media negotiation, not a free field, and a credential placed there would make a security choice decide a negotiation question the binding has closed. Another complete non-colliding alternative may still be selected, while §8.3 governs parameter-only processor-owned and invocation-time raw/structured cookie collisions.

**[convention]** API-key header destinations compare ASCII case-insensitively, while query and cookie destinations compare exact names. An API-key query value uses §8.2's query percent-encoding; an API-key cookie value is carried as an RFC 6265 `cookie-value` with no percent-encoding and refuses before dispatch when it cannot be so carried. Credential values never enter the caller envelope or operation contract; structured cookie contributions preserve membership and join as `name=value` separated by `; `, with no portable cookie order ([RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1), [RFC 6265 §4.2.1](https://www.rfc-editor.org/rfc/rfc6265#section-4.2.1), [OAS 3.1.2 Appendix D](https://spec.openapis.org/oas/v3.1.2.html#appendix-d-serializing-headers-and-cookies)).

## 12. Configuration, synthesis, and conformance

### 12.1 Configuration vocabulary

**[configuration point]** The complete binding-specific configuration vocabulary is `requestMedia` (one concrete media type), `server` (one effective Server alternative plus exact variable values, or one complete consumer-configured URL replacing the resolved server base), `security` (selection of one complete security alternative), `parameterConversion` (deterministic boolean/number converter), `implicitConnectionScope` (`entry` or `referring`), `requestContentCodings` (coding-to-encoder map), `responseContentCodings` (coding-to-decoder map), and conditional `propertyMedia` (one concrete media type per affected form or multipart property).

**[configuration point]** Every requirement is typed and discoverable from declarations. Preflightability is bounded: a requirement whose applicability is fixed by declarations alone is preflightable as an actual requirement, while `requestMedia` and `parameterConversion` are conditional on supplied values and are preflightable only as POSSIBLE requirements — a preflight can name them and their type but cannot know whether a given invocation will trigger them. No configuration member appears in the caller envelope or operation contract, and decoding and response classification are fixed rules rather than configuration points.

### 12.2 Synthesis boundary and coverage

**[incorporated]** Operation contracts remain protocol-neutral (Core [§5.1](../../openbindings.md#51-operations), [invariant 1](../../openbindings.md#2-core-invariants)) and MAY remain flat (Core [§5.5](../../openbindings.md#55-transforms)).

**[convention]** Synthesis emits an `inputTransform` that constructs §7's envelope, and transforms never route values to HTTP locations.

**[convention]** This binding defines no status, header, selected-media, or other context bindings at `inputTransform` or `outputTransform` positions; evaluation uses Core's closed environment unaugmented (Core [§5.5 clause 5](../../openbindings.md#55-transforms), [OBI-T-10](../../openbindings.md#103-tool-rules)).

**[limit]** Synthesis emits flat protocol-neutral operation contracts together with an `inputTransform` that constructs §7's envelope: the envelope is the binding-boundary value, never the emitted operation contract, and qualified location-keys appear only in the transform's output. §12.2 licenses `inputTransform` and `outputTransform` as synthesis outputs, and operation/dependency key spelling, flattening, output-schema choice, and Schema Object translation as synthesis policy; no other input-restructuring apparatus exists under this identifier.

**[convention]** Schema Object translation preserves the declared value domain up to representability: a synthesizer MUST account a lossy or non-equivalent Schema Object translation as coverage loss at its owning position, and output-schema choice carries no further soundness latitude.

**[convention]** A synthesizer MUST account for every addressable operation and every callback/webhook dependency as represented, excluded with the exact reason stated beside the applicable exclusion, or implementation-unsupported under §3.2's declared accounting status; a failure in an unused description position is coverage loss rather than invocation behavior.

**[convention]** Every binding-specific configuration requirement remains in coverage accounting and invocation context, assigned to its represented target or declared alternative, and MUST NOT enter the operation input schema.

**[incorporated]** Dependencies are synthesis outputs only and add no invocation target or receiver behavior (Core [§1.2](../../openbindings.md#12-out-of-scope), [§5.6](../../openbindings.md#56-dependencies)).

### 12.3 Conformance rules

**[convention]** A document conforms to **OAPI31-D-01** when its `content`, if present, satisfies §§3–5 and its `location`, if present, satisfies §4.

**[convention]** A binding conforms to **OAPI31-D-02** when it names §1's binding-specification identifier, carries the literal selector of §6.1, and identifies a source whose interpreted artifact passes the exact edition gate. That verdict is decided over the interpreted artifact, never over the binding's text alone: for a location-only source it follows §4's required dereference, so conformance to this rule is not a property of the OBI document in isolation.

**[convention]** A processor conforms to **OAPI31-P-01** when it implements the closed load gates, §3.2's smallest-owner rule, the source-refusal rule and §5.2's dialect rules, reference closure, and selector semantics of §§3–6.

**[convention]** A processor conforms to **OAPI31-P-02** when it accepts only §7's envelope, applies §8's effective-parameter, collision, conversion, style, content, header, cookie, and path rules, and refuses every unknown or unroutable input before dispatch.

**[convention]** A processor conforms to **OAPI31-P-03** when it preserves media alternatives and applies §9's matching, request election, carriage, form, multipart, content-coding, response lookup, classification, and unary-boundary rules without sniffing or undeclared fallback.

**[convention]** A processor conforms to **OAPI31-P-04** when it resolves servers and complete target URLs under §10 and security alternatives, credentials, prerequisites, and channel collisions under §11.

**[convention]** A synthesizer conforms to **OAPI31-S-01** when it preserves §12.2's binding/transform boundary, emits §6.2's targetless unconstrained dependencies, accounts every lossy or non-equivalent Schema Object translation as coverage loss, and reports complete coverage under Core OBI-B-02.

**[exclusion]** Every exclusion in this document is permanent under `openbindings.openapi-3.1@1`, belongs to the smallest owner stated beside it, and reopens only on its stated incorporated-authority trigger; no exclusion promises later work.

### 12.4 Permitted variation and stated limits

This section collects the points at which two implementations conforming to `openbindings.openapi-3.1@1` may still emit different bytes or reach different outcomes, together with what this specification declines to cover. It is an index over rules stated elsewhere in this document. It carries no provenance label, states no requirement, and creates no latitude its cited rule does not already state; each entry names a site, and the rule at that site governs where the two differ. This section is placed after §12.3 because §§1–12.3 are numbered as published and nothing here renumbers them.

**Freedoms declared and not closed.** At each site the specification states the latitude rather than removing it, and states what survives across implementations that take it differently.

| Site | What may differ | What holds across the difference |
| --- | --- | --- |
| §4 | whether a processor dereferences a co-present `location` | `content` remains the interpreted artifact and is never silently replaced; the retrieved bytes establish nothing but the base URI's identity, and §4 states that the two processors differ in no result this specification defines |
| §8.2 | query-contribution order across distinct effective parameters | each parameter's own contribution bytes are fixed, as is §7's caller-envelope key, which the variable-name encoding of §8.2 never changes |
| §9.2 | a JSON-lane number outside binary64: preserved as the supplied mathematical value, or reduced to the nearest binary64 value | the permitted set has exactly these two members; no other deviation from the supplied value is permitted, and a conformant implementation never fails or refuses for range or precision alone |
| §9.2 | which character decodings beyond UTF-8 an implementation supports | UTF-8 decoding MUST be supported; an absent further capability refuses loudly rather than sniffing or substituting, and §3.2 accounts the affected unit **implementation-unsupported** |
| §9.3 | content-based form-urlencoded bytes: SPACE written `+` or `%20`, and `~` written literally or as `%7E` | every member of the declared set percent-decodes, under form-urlencoded decoding, to the supplied value; every other RFC 3986 unreserved byte stays literal and every other UTF-8 byte is uppercase `%HH` |
| §9.3 | multipart part order across distinct properties | repeated parts for one array property preserve element order, and property-to-name membership is fixed |
| §9.5 | whether a runtime follows a redirect, and what it advertises in transport content negotiation | classification depends on the final status; a redirect followed with the bound method and complete body preserved remains this interaction, a method-rewriting redirect is a final response of it, and the binding emits no negotiation field beyond those this specification pins |
| §11 | the order of structured cookie contributions | membership is preserved and the join is `name=value` separated by `; ` |
| §6.2, §12.2 | operation and dependency key spelling, contract flattening, output-schema choice, and Schema Object translation | these are synthesis policy rather than portable binding meaning; a dependency key remains a deterministic function of its declaration slot, the role-inverted input/output meaning of §6.2 is fixed, and a lossy or non-equivalent Schema Object translation is accounted as coverage loss |

**Configuration points.** Eight, enumerated at §12.1 and no others. None appears in the caller envelope or the operation contract, and none is inferred from a supplied value.

| Point | Boundary | Chosen by | Consequence when no choice is supplied |
| --- | --- | --- | --- |
| `requestMedia` (§9.1) | one concrete media type matching a declared request alternative under §9.1; it never substitutes another declaration's schema, and supplied values never elect | the consumer | required only where more than one usable entry, or a concrete declaration beside a usable range, is declared; a missing, unmatched, or ambiguous choice refuses before dispatch, and no body bytes or examples are sniffed |
| `server` (§10) | one effective Server alternative plus exact variable values, or one complete configured URL that replaces the resolved base under the same scheme and no-query/no-fragment constraints | the consumer | required only where more than one effective member is declared; an unsupplied required member choice leaves the target unusable and refuses before dispatch under §3.2's vocabulary, a variable left unresolved by declaration and configuration together refuses before dispatch, and no member or variable preference is inferred |
| `security` (§11) | one complete alternative; fragments from different alternatives are never combined | the consumer | required only where more than one complete alternative is declared; an invocation with no selection where one is required refuses before dispatch |
| `parameterConversion` (§8.1) | a deterministic conversion from each JSON boolean or number to a string, applied recursively to array members and object values, with strings passing identically; scoped to the `schema`-form and RFC 6570-style paths and never to §9.3's content-based path | the consumer | a supplied boolean or number with no configured conversion refuses before dispatch |
| `implicitConnectionScope` (§11) | `entry` or `referring` document resolution for Security Requirement names | the consumer | defaults to `entry`; it is the only one of the eight carrying a default |
| `requestContentCodings` (§9.4) | a finite map from case-insensitive coding tokens to deterministic encoders; two tokens colliding after ASCII case-folding are not a usable configuration | the consumer | the caller-supplied effective `Content-Encoding` value fixes the stack, and an unsupported token, or a value not admitted by its governing Header declaration, refuses before dispatch; configuring a codec supplies capability but never declares a coding the artifact omitted |
| `responseContentCodings` (§9.4) | a finite map from case-insensitive coding tokens to deterministic decoders, under the same collision rule | the consumer | the actual value governed by the Response Header Object fixes the stack, and an unsupported token, an ambiguous declaration, or an actual coding with no governing Header Object is a loud protocol error; nothing is skipped or sniffed |
| `propertyMedia` (§9.3) | one concrete media type for each form or multipart property whose Encoding `contentType` is a wildcard or comma-separated, satisfying a declared member under §9.1 | the consumer | an absent, unmatched, or ambiguous required choice refuses before dispatch |

**Exclusions and their reopen triggers.** §12.3's closing rule governs all of them: each is permanent under this identifier, belongs to the smallest owner stated beside it, and promises no later work.

| Site | Removed from the accepted domain | Reopens only if |
| --- | --- | --- |
| §5.1 Path Item `$ref` collision | the selected target, where a field it uses is declared both in the referenced Path Item and adjacent to the `$ref` | an incorporated OAS edition defines the collision |
| §5.2 root `jsonSchemaDialect` | the whole source, which **refuses as a source**, the default having no smaller owner | that exact dialect becomes incorporated authority |
| §5.2 schema-resource-root `$schema` | each selected unit whose reachable closure enters that resource | that exact dialect becomes incorporated authority |
| §6.1 present empty Responses Object | the selected target, before any response or caller value is inspected | an incorporated OAS 3.1 edition admits a present empty Responses Object |
| §7 duplicate effective parameters | the smallest owning operation | an incorporated OAS edition admits such duplicates |
| §7 case-distinct header parameters | the selected target, under either of the two readings §7 discloses | an incorporated authority defines a wire mapping preserving such declarations |
| §8.1 malformed Parameter Object | the selected target, before caller values are inspected | an incorporated OAS 3.1 edition admits the exact malformed declaration or defines its wire meaning |
| §8.2 wholly `n/a` style row | that parameter; the test is the whole row and never a single cell | an incorporated authority defines that exact combination |
| §8.2 unsupported compound member | the owning unit, and only where the resolved declaration proves the member | an incorporated authority defines that exact cell |
| §8.2 path-template mismatch | the selected target, for path-key ambiguity, either mismatch direction, or a duplicate expression; non-conflicting targets survive | incorporated authority admits the declaration or defines its unique target mapping |
| §8.3 `Host` or `Content-Length` header parameter | the target, those fields being processor-owned | an incorporated HTTP authority defines caller control preserving the processor's framing and routing obligations |
| §8.3 multi-value form-style cookie | that declaration, and only where `explode` and the resolved declaration prove multi-value production | an incorporated OAS edition defines a correct multi-value mapping |
| §9.2 XML from an object model | the selected media alternative; string and raw-octet XML carriage remain admitted | an incorporated authority defines ordering, escaping, nulls, dynamic keys, and scalar lexical forms |
| §9.2 selection matching no defined lane | that selection, at its smallest media owner | an incorporated authority defines that media/data-form cell |
| §9.3 schemaless `multipart/form-data` | that alternative, at its smallest media owner; a schemaless non-multipart binary declaration is unaffected and takes the raw-octet lane | an incorporated OAS edition removes the requirement, as the 3.2 line does |
| §9.3 form or multipart on a response | that response selection, at its smallest media owner | an incorporated authority defines that decoding |
| §9.3 unrepresentable multipart `name` | that multipart alternative, CR or LF in a property name included | an incorporated authority defines an unambiguous encoding |
| §9.3 required part header fixing no value | that multipart alternative; an ignored entry, `Content-Type` included, never triggers it | an incorporated authority defines caller part-header carriage |
| §9.3 `contentEncoding` against a surviving `Content-Transfer-Encoding` | that multipart alternative, rather than choosing between two declared encodings | an incorporated OAS edition defines that conflict's outcome |
| §9.3 multipart other than `form-data` | that media alternative, no property-to-part correlation being defined | an incorporated OAS edition defines that correlation |
| §9.4 case-distinct response header keys | the smallest owning response alternative, where both govern binding behavior | an incorporated authority defines a wire mapping preserving such declarations |
| §9.5 Responses key outside the admitted set | the selected target, before any actual response is inspected | an incorporated OAS 3.1 edition admits that exact key form |
| §9.5 upstream-invalid Response Object | the selected target, and only for a declaration that can govern a successful response | an incorporated OAS 3.1 edition admits the exact declaration |
| §10 Server URL with query or fragment | each target that would use that Server alternative | an incorporated OAS edition defines the exact cell |
| §10 non-`http`/`https` Server scheme | each target that would use that Server alternative, as a declaration fact only; a scheme reached at invocation refuses before dispatch instead | an incorporated authority defines that scheme's HTTP-semantics mapping |
| §11 invalid Security Scheme Object | every security alternative naming it; a target left with no complete alternative is itself excluded | an incorporated OAS 3.1 edition admits the exact declaration |
| §11 access-token types other than Bearer | wire carriage under this identifier only; no artifact declaration is removed, so this exclusion reaches no synthesis or coverage entry | an incorporated authority defines another token type's carriage |

**Stated limits.** Each names a boundary this specification does not cross.

| Site | The boundary it states |
| --- | --- |
| §3.2 load gates | a closed ordered set of four conditions; no condition outside it is a load gate |
| §3.2 smallest-owner rule | after the gates a defect confines to its smallest owning unit, and an unreachable defect destroys no target |
| §3.2 excluded units | an excluded unit leaves the effective declarations of every rule here; a selector naming it still resolves, and the invocation refuses before dispatch |
| §3.2 source refusal | fires only where at least one target-capable position exists and every such position is defective; a valid present-but-empty surface is not a defective position |
| §3.2 unusable targets | an addressable-but-unusable target refuses before dispatch or is reported as coverage loss, and never becomes a source refusal |
| §3.2 source-scope filtering | none exists: no source member or addressable target is filtered merely by its position in the source |
| §3.2 unknown fields | an unknown non-extension field creates no binding behavior, `x-` extensions stay inert, and no unknown member is guessed into a fixed or patterned field |
| §5.1 unused description positions | an unresolvable reference there leaves invocation unaffected and is reported as synthesis coverage loss |
| §5.1 defects outside the closure | a defect outside the target-plus-reachable closure has no effect on that target |
| §5.1 confinement consequences | the three conditions confine to exactly the three consequences stated in table order |
| §6.2 dependencies | add no invocation behavior; receiver deployment and dependency composition are permanently outside this operation boundary |
| §9.1 normalized media collisions | a colliding identity supports no selection through it: a request selection refuses before dispatch, a response selection is a loud protocol error, and map order never breaks the tie |
| §9.1 examples | create no operation input or output member and never select a declaration, carriage lane, or media type |
| §9.2 JSON-lane numbers | interoperable within RFC 8259 §6's binary64 expectation, over the two-member permitted set indexed above |
| §9.2 character decodings | UTF-8 MUST be supported; any further charset is an implementation capability whose absence refuses loudly |
| §9.3 non-object form declarations | exclude the form lane at their smallest owning unit |
| §9.3 null-property elision | identifies `{}` and `{"x": null}` on the wire; the distinction between an absent optional member and an explicit null does not survive this lane |
| §9.3 surviving part headers | are descriptive at this boundary: none is emitted from a Header Object schema, and no undeclared `Content-Transfer-Encoding` is emitted |
| §9.5 success-scoped exclusion | the Response Object exclusion reaches only a declaration that can govern a successful response |
| §9.5 `description` carve-out | an omitted REQUIRED `description` with no declared content does not exclude; the same omission with declared content does |
| §9.5 edition difference | the carve-out's reasoning is identical across the sibling lines while the authority it reads is not, OAS 3.2.0 having dropped the REQUIRED marker |
| §9.5 redirect and negotiation | classification depends on the final status; redirect following and transport content negotiation are runtime policy under Core §1.2 |
| §9.5 required response headers | a missing declared required header is a loud protocol error, and header carriage remains outside the operation-value boundary |
| §9.5 undeclared response bodies | a non-empty response with no governing Response Object is a loud protocol error, and Response Header and Link Objects create no output members |
| §9.5 value cardinality | one HTTP response body produces at most one operation value, `text/event-stream` included |
| §10 unresolvable relative Server URL | embedded content with no document location leaves it unresolved and refuses before dispatch; the complete configured URL remains the recovery |
| §11 other HTTP authentication schemes | remain visible as a consumer prerequisite; no credential bytes are synthesized for them |
| §12.2 input restructuring | synthesis emits flat contracts plus an `inputTransform`; no other input-restructuring apparatus exists under this identifier |

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
- [RFC 6265](https://www.rfc-editor.org/rfc/rfc6265)
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
