# `openbindings.openapi-3.0` Binding Specification

## 1. Identifier and rule labels

**[B — convention]** The opaque binding-specification identifier has exactly the spelling **`openbindings.openapi-3.0@1`**.

**[C]** Publication mints §1's identifier under Core [OBI-B-01](../../openbindings.md#104-binding-specification-rules), and an incompatible change to the accepted domain or portable meaning requires a different identifier under Core [OBI-B-03](../../openbindings.md#104-binding-specification-rules).

**[A]** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) only when they appear in all capitals.

**[B — convention]** Every normative paragraph and normative table row carries one visible provenance label: **A** is derived from incorporated authority and cites it, **C** is derived from the OpenBindings Core, and **B** is this specification's explicitly classified bridge (`convention`, `pin`, `configuration point`, `exclusion`, or `limit`). A `convention` is a choice this specification makes where no authority speaks; a `pin` fixes one reading of an ambiguous or versioned authority; a `configuration point` names a decision deferred to the consumer; an `exclusion` removes something from the accepted surface behind a stated reopen trigger; a `limit` states a boundary this specification does not cross.

## 2. Scope and incorporated authorities

**[B — convention]** This binding specification defines how OpenAPI 3.0 artifacts govern OpenBindings sources: which documents are accepted and when loading refuses, how operation targets are addressed and synthesized, what an invocation's inputs and outputs mean, and which wire mechanics the artifact fixes. It builds on the OpenBindings Core specification (`../../openbindings.md`).

**[A]** An artifact's required `openapi` string gives the exact OAS edition that the OpenAPI Document uses ([OAS 3.0.4 §§3.2, 4.7.1.1](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields)).

**[B — convention]** This specification accepts exactly OAS editions [`3.0.0`](https://spec.openapis.org/oas/v3.0.0.html), [`3.0.1`](https://spec.openapis.org/oas/v3.0.1.html), [`3.0.2`](https://spec.openapis.org/oas/v3.0.2.html), [`3.0.3`](https://spec.openapis.org/oas/v3.0.3.html), and [`3.0.4`](https://spec.openapis.org/oas/v3.0.4.html); no wildcard or compatible-looking value widens this closed set.

**[B — convention]** Within that closed set, observable behavior MUST NOT turn on the patch component: the admitted editions are read as one `3.0` feature set, and the accepted domain remains the five exact values above.

**[B — pin]** Where accepted patch editions contradict one another, the corrected patch text governs; the corrected patch text is the highest-numbered accepted edition's text. This applies the editions' explicit patch-compatibility instruction without allowing anomalous copied examples in 3.0.4 §4.1 to widen or rename this line ([OAS 3.0.0 §4.1](https://spec.openapis.org/oas/v3.0.0.html#versions), [3.0.1 §4.1](https://spec.openapis.org/oas/v3.0.1.html#versions), [3.0.2 §4.1](https://spec.openapis.org/oas/v3.0.2.html#versions), [3.0.3 §4.1](https://spec.openapis.org/oas/v3.0.3.html#versions), [3.0.4 §4.1](https://spec.openapis.org/oas/v3.0.4.html#versions)).

**[B — convention]** OAS governs the artifact and every HTTP mechanic it declares, including object structure, reference resolution, parameter serialization, media declarations, server selection, responses, and security ([OAS 3.0.4 §4.7](https://spec.openapis.org/oas/v3.0.4.html#schema-0)); [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) governs the remaining HTTP semantics.

**[C]** This document defines portable binding meaning, not an invocation API: request objects, retry and redirect APIs, cancellation, credential acquisition, receiver deployment, and dependency composition remain runtime or application concerns under Core [§1.2](../../openbindings.md#12-out-of-scope).

## 3. Source carriage and refusal architecture

### 3.1 Accepted representations

**[B — convention]** `content` is either the parsed OpenAPI document object or string content; `location` is an absolute URI for the OpenAPI document; content has primacy, a co-present location supplies its base URI, and the OBI retrieval URI is never that base (Core [§5.4](../../openbindings.md#54-sources), [§7](../../openbindings.md#7-reference-resolution)).

**[B — pin]** String content MUST parse as YAML 1.2.2, of which JSON is a subset; duplicate mapping keys, non-scalar-string mapping keys, explicit tags outside YAML's JSON-compatible tag set, resolved values with no JSON image (`.inf`, `-.inf`, `.nan`), and a multi-document YAML stream refuse at this grammar gate. Exactly one YAML document is accepted ([YAML 1.2.2 §§3.2.1, 10.2.1, 10.3.2](https://yaml.org/spec/1.2.2/)).

**[B — pin]** Plain-scalar tag resolution uses YAML 1.2.2's recommended Core schema — the resolution the preceding rule's `.inf`/`.nan` parentheticals already presuppose — and no other resolution schema is consulted. This is a disclosed widening of the line's own format rule, which limits tags to YAML's JSON schema ruleset: the two schemas share a tag set but not a resolution, so `True`, `0x3A`, and `.5` resolve to a boolean, an integer, and a float here where JSON-schema resolution would terminate in an error. This specification pins Core resolution because JSON-schema resolution rejects plain scalars that every widely deployed YAML reader accepts, which would make a document's acceptance turn on the reader rather than the artifact; the widening admits values, never rejects them, and every admitted value must still have a JSON image under the preceding rule ([YAML 1.2.2 §§10.2.2, 10.3.2](https://yaml.org/spec/1.2.2/#1032-tag-resolution), widening [OAS 3.0.4 §4.2](https://spec.openapis.org/oas/v3.0.4.html#format)).

**[B — pin]** A leading byte-order mark on string content is accepted and consumed by the YAML grammar; it is never part of the document.

**[A]** The line's format rule historically calls the admitted tag set the "JSON Schema ruleset" in editions 3.0.0–3.0.3 and clarifies it as "YAML's JSON schema ruleset," unrelated to JSON Schema, in 3.0.4; the clarified reading governs, and YAML map keys MUST be scalar strings ([OAS 3.0.0 §4.2](https://spec.openapis.org/oas/v3.0.0.html#format), [3.0.1 §4.2](https://spec.openapis.org/oas/v3.0.1.html#format), [3.0.2 §4.2](https://spec.openapis.org/oas/v3.0.2.html#format), [3.0.3 §4.2](https://spec.openapis.org/oas/v3.0.3.html#format), [3.0.4 §4.2](https://spec.openapis.org/oas/v3.0.4.html#format)).

**[A]** The root MUST be a JSON object with the required `openapi` string that identifies the OAS edition it uses ([OAS 3.0.4 §§4.2, 4.7.1.1](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields)).

**[B — convention]** The `openapi` value MUST be exactly `3.0.0`, `3.0.1`, `3.0.2`, `3.0.3`, or `3.0.4`; an absent, mismatched, or unlisted value refuses at this binding's edition load gate.

### 3.2 Closed load gates and confined defects

**[B — convention]** Defect outcomes use a fixed vocabulary: a source **refuses at load** only at §3.2's gates; a source whose positions capable of carrying an addressable target are all defective **refuses as a source** after those gates; a declaration defect **excludes** its smallest owning unit from synthesis and selection; an addressable target whose use requires a missing choice or unsupported alternative is **unusable** and **refuses before dispatch** when invoked; a wire fact this specification cannot represent faithfully is a **loud protocol error**, for which the adverbial spellings *refuses loudly*, *fails loudly*, and *reported loudly* are exact synonyms; an interaction that reaches the wire and yields no successful operation value **completes unsuccessfully**; and synthesis reports every exclusion and inexpressible declaration as **coverage loss**.

**[B — convention]** A **lane** is one media-selected value-to-bytes serialization path, and the lanes are exactly these five: JSON, character-data, raw-octet, form, and multipart. The set is closed — no sixth lane exists under this identifier, and a selection admitted by none of the five is excluded under §9.2's lane-admission rule rather than carried by an unnamed path. The **smallest media owner** is the narrowest declared unit that owns a defective lane. An **unavailable** alternative is an excluded alternative: the word marks this vocabulary's exclusion outcome applied to a media alternative.

**[B — convention]** A **unit** is one member of this closed lattice, from largest to smallest: the source, an addressable operation, a declared alternative, a media alternative, a lane, and a field. A defect's **smallest owning unit** is the smallest member of that lattice whose declarations the defect reaches; a **selected unit** is a unit reached by the selected target.

**[B — limit]** The load gates are the following closed ordered set: accepted-representation grammar, scalar/tag/key resolution, JSON-object root shape, and exact edition discrimination; no condition outside this set is a load gate.

**[B — limit]** **§3.2's smallest-owner rule**: after those gates pass, a defect confines to its smallest owning unit, and an unreachable defect destroys no target.

**[B — limit]** An **excluded** unit is removed from synthesis and from the effective declarations of every rule in this document, §7's caller-envelope key derivation and §8's path-template correspondence included: no rule reads an excluded unit's declarations. A selector naming an excluded target still resolves — exclusion is not unresolvability — and the invocation refuses before dispatch. A target whose remaining effective declarations no longer satisfy §8's path-template correspondence is itself excluded.

**[A]** A conforming artifact that declares no operation target is accepted and synthesizes no operation: the required Paths Object may contain no path entries, and a Path Item Object may be empty ([OAS 3.0.4 §§4.7.1.1, 4.7.8, 4.7.9](https://spec.openapis.org/oas/v3.0.4.html#paths-object)).

**[B — limit]** **§3.2's source-refusal rule**: a source **refuses as a source** — the outcome §3.2's vocabulary names, which fires after the closed load gates and never at them — when at least one position that could carry an addressable target exists and every such position is defective, so that no conformant selector can resolve. A valid present-but-empty surface is not a defective position: it is accepted and synthesizes zero operations. The root surface this edition requires for addressable targets is itself such a position, and its absence is that defect — each accepted 3.0 edition makes the root `paths` field REQUIRED, so a source with no root `paths` refuses as a source ([OAS 3.0.4 §4.7.1.1](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields)). This stated consequence is not an additional load gate.

**[B — limit]** A target that is addressable but unusable because of a missing choice, unsupported alternative, or exclusion refuses before dispatch or is reported as synthesis coverage loss; it never becomes a source refusal.

**[B — limit]** This revision declares no source-scope exclusion: unlike the [`include`/`mount` filtering surface of `openbindings.usage@1`](../usage/openbindings.usage.md#3-accepted-source-representations), no source member or addressable target is filtered merely by its position in the source.

**[B — limit]** An unknown non-extension field creates no binding behavior, and this specification supplies none for it: the consequence confines to the smallest owning unit that depends on it, while an unused unknown field affects no target. An `x-` specification extension remains an inert annotation under this identifier, and no unknown member is guessed into a fixed or patterned field ([OAS 3.0.4 §4.8](https://spec.openapis.org/oas/v3.0.4.html#specification-extensions)).

**[B — convention]** A root `swagger` member co-present with this specification's conforming `openapi` value is such an unknown non-extension root member: it is inert, gates nothing, and cedes the document to no sibling specification.

## 4. `location`, `content`, and composition

**[C]** A present `location` MUST be an absolute URI addressing the OpenAPI document itself; a bare filesystem path is not conformant (Core [OBI-D-05](../../openbindings.md#102-document-rules)).

**[B — convention]** When a processor elects to retrieve from that `location` — always, for a location-only source — the dereference MUST yield an accepted representation; a co-present `content` remains the interpreted artifact and is never silently replaced (Core [§5.4](../../openbindings.md#54-sources)).

**[B — convention]** A present `content` MUST be one of §3.1's two representations, and no other JSON type is accepted.

**[A]** A relative `$ref` resolves under JSON Reference against the URL of the document containing it; other relative URL fields use their own OAS-defined base rules ([OAS 3.0.4 §4.6](https://spec.openapis.org/oas/v3.0.4.html#relative-references-in-urls)).

**[B — convention]** Embedded content without a co-present `location` MUST be self-contained; a location-only source uses its location as the entry-document base (Core [§7](../../openbindings.md#7-reference-resolution)).

## 5. References, schema dialect, and confinement

### 5.1 Reference semantics

**[A]** A Reference Object is JSON Reference transclusion: the resolved target replaces the referencing object ([OAS 3.0.4 §§4.6, 4.7.23](https://spec.openapis.org/oas/v3.0.4.html#reference-object), [JSON Reference draft-03 §4](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03#section-4)).

**[B — convention]** A reference composes its target plus the transitive closure of references reachable from that target, not unrelated material in the same retrieved document. No accepted edition states that composition rule; this specification adopts it so that a selected target's closure is decidable ([OAS 3.0.4 §§4.6, 4.7.23](https://spec.openapis.org/oas/v3.0.4.html#reference-object)).

**[A]** Only the entry document is required to be an OpenAPI Document; a retrieved document containing a referenced value need not itself be a conforming OpenAPI Document ([OAS 3.0.4 §§3.1–3.2, 4.3](https://spec.openapis.org/oas/v3.0.4.html#openapi-description-structure)).

**[B — pin]** A secondarily retrieved reference document's bytes decode as UTF-8 and pass the same grammar gate as §3.1 string content; the retrieval's `Content-Type` and any charset parameter are never consulted.

**[B — convention]** When one JSON or YAML node is reached from reference positions requiring different OAS Object types, each reference context interprets the node independently as its own required Object type; this is the deterministic choice within OAS's implementation-defined multi-context license ([OAS 3.0.4 §4.3.1](https://spec.openapis.org/oas/v3.0.4.html#structural-interoperability)).

**[A]** A Reference Object has only its required `$ref` field; every adjacent property is ignored, including when a Reference Object appears where a Schema Object is allowed ([OAS 3.0.4 §§4.7.23, 4.7.24.1](https://spec.openapis.org/oas/v3.0.4.html#reference-object)).

**[B — pin]** OAS states in lowercase that tooling must detect and handle cycles to prevent resource exhaustion, which §1's BCP 14 clause leaves non-normative; this specification pins that statement to a deterministic requirement: reference traversal MUST detect cycles without resource exhaustion, a cyclic but resolvable graph is legitimate, and cycle detection terminates traversal rather than truncating the graph and is not itself a refusal ([OAS 3.0.4 §5.5](https://spec.openapis.org/oas/v3.0.4.html#handling-reference-cycles)).

**[B — pin]** A Path Item `$ref` is not a Reference Object for sibling purposes. OAS gives the Path Item its own `$ref` fixed field and states that a field appearing in both the referenced and the adjacent object has undefined behavior, which presupposes that both declarations exist; this specification pins the merge that presupposition implies. The **effective Path Item** is the referenced Path Item overlaid with every adjacent field the referenced Path Item does not itself declare: non-colliding adjacent fields contribute, and the `$ref` member itself contributes nothing. The rule that a Reference Object's adjacent properties are ignored is scoped to Reference Objects proper and never reaches this merge. This edition carries no note about that `$ref`'s adjacent-property behavior; the 3.1 and 3.2 lines add one saying it is likely to change in a future version to align with the Reference Object, which affirms the present non-alignment on every line, and the merge rests on the collision-undefined sentence all four editions share ([OAS 3.0.4 §§4.7.9.1, 4.7.23](https://spec.openapis.org/oas/v3.0.4.html#path-item-ref), against [OAS 3.1.2 §4.8.9.1](https://spec.openapis.org/oas/v3.1.2.html#path-item-ref) and [OAS 3.2.0 §4.9.1](https://spec.openapis.org/oas/v3.2.0.html#path-item-ref)).

**[B — exclusion]** When a selected Path Item carries `$ref`, the selected operation target is excluded only if a fixed field used by that target appears in both the referenced Path Item and its adjacent declaration, because OAS defines that named collision as undefined. `Used by that target` means the selected method field plus the Path Item's `parameters` and `servers`; the documentation fields `summary` and `description` never collide for this purpose. Collisions confined to unused fields and all non-colliding adjacent fields leave the target usable, and the exclusion reopens only if an incorporated OAS edition defines the collision ([OAS 3.0.4 §4.7.9.1](https://spec.openapis.org/oas/v3.0.4.html#path-item-ref)).

**[B — convention]** The first three reference conditions in the table below are this specification's own confinement conditions; the sections cited beside them define the reference positions and the base resolution those conditions read, not the conditions themselves ([OAS 3.0.4 §§4.3, 4.6, 4.7.9](https://spec.openapis.org/oas/v3.0.4.html#openapi-description-structure)):

| condition |
| --- |
| **[B — convention]** Unresolvable selected Path Item `$ref` |
| **[B — convention]** Unresolvable reference reached by one selected parameter, request body, response, server, or security requirement |
| **[B — convention]** Unresolvable Schema Object reference reached only by one media alternative |
| **[B — limit]** An unresolvable reference reachable only from an unused description position leaves invocation unaffected; synthesis reports that position as coverage loss. |
| **[B — limit]** A defect outside the target-plus-reachable closure has no effect on that target. |

**[B — limit]** In table order, the three confinement conditions confine as follows: the referenced Path Item and its operations are unaddressable; the selected operation or its affected declared alternative is unusable while unrelated operations survive; or the affected media alternative is unavailable while sibling alternatives survive.

### 5.2 Schema dialect

**[A]** A Schema Object uses OAS 3.0's extended subset of JSON Schema Wright Draft 00: the keywords enumerated in OAS plus OAS's fixed fields are the complete supported vocabulary; unlisted JSON Schema keywords are strictly unsupported and create no binding behavior ([OAS 3.0.4 §§4.4, 4.7.24](https://spec.openapis.org/oas/v3.0.4.html#schema-object)).

**[A]** `type` MUST be one string rather than an array; an empty Schema Object `{}` asserts no instance type; and a Reference Object may be used in place of a Schema Object under §5.1's transclusion semantics. A boolean is upstream-invalid in every Schema Object position but one: `additionalProperties`, whose value the edition expressly admits as "boolean or object", and which §9.3 reads accordingly ([OAS 3.0.4 §§4.4, 4.7.24.1](https://spec.openapis.org/oas/v3.0.4.html#json-schema-keywords)).

**[A]** `nullable: true` admits JSON null only when `type` is explicitly present in the same Schema Object, leaves the named non-null type in force, and does not disable any other constraint ([OAS 3.0.4 §4.7.24.2](https://spec.openapis.org/oas/v3.0.4.html#schema-nullable)).

**[A]** Unsupported keywords, including `$id`, `$schema`, `patternProperties`, `contentEncoding`, and `contentMediaType`, decide as if absent; specification extensions remain non-behavioral metadata unless another incorporated rule explicitly assigns them meaning ([OAS 3.0.4 §§4.7.24.1, 4.8](https://spec.openapis.org/oas/v3.0.4.html#json-schema-keywords)).

**[B — convention]** For every lane, style, shape, and member-inspection rule in this document, a **resolved declaration** is obtained by following `$ref` and conjoining every `allOf` branch; for an `anyOf` or `oneOf` choice, a branch whose resolved declaration declares only `null` is skipped, every other branch — a typeless branch included — is a candidate, and the choice supplies a single resolved member declaration only when exactly one candidate remains; `not` and conditional applicators never participate in resolution; and absence of `type` leaves the declaration typeless. A 3.0 `type` contributes its single string, and `nullable: true` co-located with an explicit `type` adds `null` to the resolved type set. **Declares only X** means that the resolved type set is nonempty and every member is in X. **Admits `string` as its sole non-null type** means that the resolved type set is exactly `{string}` or `{string, null}`.

## 6. Selector and inbound dependencies

### 6.1 Selector

**[B — convention]** `selector` is REQUIRED and has exactly one literal spelling: `#/paths/<escaped-path>/<lowercase-method>`, where `<escaped-path>` is the Paths Object key escaped once under [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) and `<lowercase-method>` is one of `get`, `put`, `post`, `delete`, `options`, `head`, `patch`, or `trace`.

**[B — pin]** The selector's leading `#` is a literal sentinel: what follows is RFC 6901 §3's string representation of the JSON Pointer, carried literally, escaped once with `~0`/`~1`, and never percent-decoded; the §6 URI-fragment representation is not used. Evaluation follows RFC 6901 §§3–4; when the selected operation is absent the selector does not resolve and the invocation refuses before dispatch ([RFC 6901 §§3–4, 6](https://www.rfc-editor.org/rfc/rfc6901#section-3), [OAS 3.0.4 §§3.5, 4.7.9](https://spec.openapis.org/oas/v3.0.4.html#path-item-object)).

**[B — convention]** After the pointer selects a Path Item, selector evaluation resolves that Path Item's `$ref` into §5.1's effective Path Item before reading the method field; the deliberate extra resolution keeps bundled referenced Path Items addressable ([JSON Reference draft-03 §4](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03#section-4), [OAS 3.0.4 §4.7.9.1](https://spec.openapis.org/oas/v3.0.4.html#path-item-ref)).

**[A]** An Operation Object requires `responses`, and its Responses Object requires at least one response code ([OAS 3.0.4 §§4.7.10.1, 4.7.16](https://spec.openapis.org/oas/v3.0.4.html#operation-responses)).

**[B — exclusion]** Omitting `responses` or providing a present empty Responses Object is a declaration defect that excludes only the selected operation under §3.2's smallest-owner rule. The exclusion reopens only if an incorporated OAS 3.0 edition admits the exact declaration.

### 6.2 Callbacks

**[A]** A callback Path Item describes a request initiated by the API provider and the responses it expects; its runtime-expression key identifies a service-selected request destination, and the callback is not an operation invocable through the addressed parent operation ([OAS 3.0.4 §§4.7.10.1, 4.7.18, 4.7.20.4](https://spec.openapis.org/oas/v3.0.4.html#callback-object)).

**[B — convention]** Synthesis MUST represent every supported callback operation as a Core dependency with a deterministic slot-derived key and a role-inverted consumed-operation contract: input is the request the service sends and output is the response the service expects (Core [§5.6](../../openbindings.md#56-dependencies)).

**[B — convention]** `Deterministic slot-derived key` requires only that the key be a deterministic function of the declaration slot; its exact spelling is synthesis policy under §12.2 and is not portable binding meaning. The dependency contract's shape is likewise synthesis policy; only the role-inverted input/output meaning above is fixed here.

**[C]** Such a dependency carries no concrete target (Core [§5.6](../../openbindings.md#56-dependencies)).

**[B — convention]** Such a dependency also carries no `bindingSpecs`, because the originating artifact has no authority to constrain the consumer's description format.

**[B — limit]** Dependencies add no invocation behavior to this binding; receiver deployment and dependency composition are permanently outside this operation boundary under this identifier (Core [§1.2](../../openbindings.md#12-out-of-scope)).

**[A]** The 3.0 OpenAPI Object defines no `webhooks` field, so this sibling synthesizes only callback dependencies and no root-webhook dependency surface ([OAS 3.0.4 §4.7.1.1](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields)).

## 7. Target interaction and caller envelope

**[B — convention]** Here and below, an **effective** declaration is the declaration that remains after applying the artifact's scope, default, override, and method-disposition rules stated in §§7–10. The method-disposition rule below is one of them: on a method whose `requestBody` that rule ignores, no effective request body exists, so no such declaration can make an invocation refuse for a missing required body.

**[A]** An addressed operation denotes its declared HTTP method, completed target URL, parameters, effective request body, security requirements, and final HTTP response. The method is the Path Item field name that selects the Operation Object, and the target URL is composed from the effective Server Object's URL with the Paths Object key ([OAS 3.0.4 §4.7.10](https://spec.openapis.org/oas/v3.0.4.html#operation-object), [§4.7.9](https://spec.openapis.org/oas/v3.0.4.html#path-item-object), [§§4.7.5, 4.7.8](https://spec.openapis.org/oas/v3.0.4.html#server-object)).

**[B — convention]** The caller-facing correspondence value is exactly `{parameters?: {...}, body?: <one JSON value>}`; absence means not supplied, `body: null` is a supplied JSON null, and the artifact alone determines parameter location and serialization.

**[B — convention]** When every effective parameter name is unique across locations, its caller key is the exact declared name; if any name is repeated across legal locations, the target uses qualified mode for every parameter and each key is `<location>/<RFC6901-escaped-name>`, making the flat map injective without depending on map order.

**[A]** Effective parameter identity is exact name plus location; duplicate effective parameters at the same identity are upstream-invalid, while the same name in different locations denotes distinct parameters ([OAS 3.0.4 §§4.7.9.1, 4.7.10.1, 4.7.12](https://spec.openapis.org/oas/v3.0.4.html#operation-parameters)).

**[B — exclusion]** Duplicate effective parameters at the same identity exclude their smallest owning operation; this exclusion reopens only if an incorporated OAS edition admits such duplicates.

**[B — convention]** Legal cross-location duplicates remain independently supplied through the qualified mode above.

**[B — exclusion]** Two effective header parameters whose names differ only by ASCII case exclude the selected target because OAS parameter identity is case-sensitive while HTTP field names are case-insensitive; the wire cannot preserve the distinction. This exclusion reopens only if an incorporated authority defines a wire mapping that preserves such case-distinct declarations ([OAS 3.0.4 §§3.8, 4.7.12](https://spec.openapis.org/oas/v3.0.4.html#case-sensitivity), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — convention]** An envelope top-level key other than `parameters` or `body`, a present non-object `parameters` member, or any unknown parameter key refuses before dispatch, regardless of whether a body exists; no unmatched-field passthrough exists.

**[A]** Missing required parameters and a missing `required: true` effective request body refuse before dispatch; path parameters are always required ([OAS 3.0.4 §§4.7.12.2.1, 4.7.13.1](https://spec.openapis.org/oas/v3.0.4.html#common-fixed-fields)).

**[A]** OAS requires a `requestBody` to be ignored for every method where HTTP does not explicitly define request-body semantics, with GET, HEAD, and DELETE only examples of that class. Within this binding's closed selector set, `requestBody` is ignored on `get`, `head`, `delete`, and `options`, honored on `post`, `put`, and `patch`, and emits no body on `trace` because a TRACE client MUST NOT send a message body; `patch` body semantics are defined by RFC 5789 ([OAS 3.0.4 §4.7.10.1](https://spec.openapis.org/oas/v3.0.4.html#operation-request-body), [RFC 7231 §§4.3.1–4.3.8](https://www.rfc-editor.org/rfc/rfc7231#section-4.3.1), [RFC 5789 §2](https://www.rfc-editor.org/rfc/rfc5789#section-2)).

**[B — convention]** A supplied `body` on `get`, `head`, `delete`, `options`, or `trace` refuses as unroutable before dispatch.

## 8. Parameter serialization

### 8.1 Effective declarations and scalar conversion

**[A]** Operation parameters override Path Item parameters only at the same exact name-plus-location identity, and every remaining effective `path`, `query`, `header`, or `cookie` Parameter Object governs its own contribution ([OAS 3.0.4 §§4.7.9.1, 4.7.10.1, 4.7.12.1](https://spec.openapis.org/oas/v3.0.4.html#parameter-locations)).

**[A]** A Header parameter whose name ASCII-case-insensitively denotes `Accept`, `Content-Type`, or `Authorization` MUST be ignored and creates no effective parameter, caller-envelope key, or emitted field ([OAS 3.0.4 §§3.8, 4.7.12.2.1](https://spec.openapis.org/oas/v3.0.4.html#common-fixed-fields), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — configuration point]** Whenever a `schema`-form parameter or §9.3 form/part property must convert a JSON scalar to a string, `parameterConversion` is the same deterministic consumer-supplied conversion: strings pass identically, and any supplied boolean or number without a configured conversion refuses before dispatch. JSON null does not enter this conversion point; §8.2 governs RFC 6570-style paths and §9.3 governs content-based form and multipart paths ([OAS 3.0.4 Appendix B](https://spec.openapis.org/oas/v3.0.4.html#appendix-b-data-type-conversion), [RFC 6570 §2.3](https://www.rfc-editor.org/rfc/rfc6570#section-2.3)).

**[B — configuration point]** This specification defines no partial canonicalization default for `parameterConversion`; the converter applies recursively to array members and object values before style serialization and MUST be deterministic for every accepted scalar.

### 8.2 `style`, `explode`, and URL assembly

**[A]** The supported `schema`-form cells and their RFC 6570 operators are exactly the following; a style/location/shape outside the table refuses before dispatch ([OAS 3.0.4 §§4.7.12.2.2, 4.7.12.3, Appendix C](https://spec.openapis.org/oas/v3.0.4.html#style-values), [RFC 6570 §3.2](https://www.rfc-editor.org/rfc/rfc6570#section-3.2)):

| style | location | admitted shapes | operator / source |
| --- | --- | --- | --- |
| **[A]** `matrix` | path | primitive, array, object | `;` |
| **[A]** `label` | path | primitive, array, object | `.` |
| **[A]** `simple` | path, header | primitive, array, object | none |
| **[A]** `form` | query, cookie | primitive, array, object | `?` (`+` when `allowReserved: true`) |
| **[B — convention]** `spaceDelimited` | query | array, object | OAS Style Examples bytes |
| **[B — convention]** `pipeDelimited` | query | array, object | OAS Style Examples bytes |
| **[B — convention]** `deepObject` | query | object with scalar properties | OAS Style Examples bytes |

**[A]** Default style is `form` for query and cookie and `simple` for path and header; default `explode` is `true` only for `form` and `false` otherwise; `allowReserved` applies only to query parameters ([OAS 3.0.4 §4.7.12.2.2](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields-for-use-with-schema)).

**[A]** On a `schema`-form parameter or an Encoding RFC 6570-style path, JSON null is an undefined value and uses the effective style and `explode` cell: the Style Examples bytes are `;name` for `matrix`, `.` for `label`, an empty representation for `simple`, and `name=` for `form`. The empty string is not undefined, and the table marks the remaining cells `n/a` ([OAS 3.0.4 §§4.7.12.4, 4.7.15.1.2, Appendix B](https://spec.openapis.org/oas/v3.0.4.html#style-examples)).

**[B — pin]** **§8.2's presentational-prefix rule**: the `?` that the Style Examples print before every `form`, `spaceDelimited`, `pipeDelimited`, and `deepObject` cell is presentation, not a per-parameter contribution. The edition says so in the table's own preamble — each such example "is shown prefixed with `?` **as if it were the only query parameter**", directing the reader to Appendix C for constructing query strings from multiple parameters — so a parameter's contribution under these styles is the cell's bytes with that prefix removed, and the single leading `?` is supplied once by the query assembly below. Reading the prefix as content would emit one `?` per parameter and contradict the single-`?` rule in the next paragraph. The edition already states the removal for one destination, requiring that the prefix "MUST be removed (if using an RFC6570 implementation) or simply not added (if constructing the string manually)" in `application/x-www-form-urlencoded` message bodies; this specification pins the same reading for the query and cookie destinations, which the edition leaves to Appendix C and to implementation-defined choice respectively ([OAS 3.0.4 §4.7.12.4](https://spec.openapis.org/oas/v3.0.4.html#style-examples), [§4.7.15.1.2](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields-for-rfc6570-style-serialization), [Appendix D](https://spec.openapis.org/oas/v3.0.4.html#appendix-d-serializing-headers-and-cookies)).

**[B — pin]** For a cookie destination the contribution is therefore `name=value`, never `?name=value`. Appendix D declares this exact cell implementation-defined — `style: "form"` "is specified to be equivalent to RFC6570 form expansion which includes the `?` character … which is not part of the cookie syntax", while "examples of this style in past versions of this specification have not included the `?` prefix", so "it is implementation-defined as to which of the two results is correct" — and this specification pins the prefix-free result, which is the one §11's `; `-separated cookie assembly can carry ([OAS 3.0.4 Appendix D](https://spec.openapis.org/oas/v3.0.4.html#appendix-d-serializing-headers-and-cookies)).

**[B — convention]** A supplied null whose governing effective `style`/`explode` row has `n/a` in the corrected `undefined` cell refuses the invocation before dispatch at the affected parameter or Encoding property; other values admitted by the same declaration remain usable.

**[A]** RFC 6570 serialization MUST use its declared operator and `*` for `explode: true`, and a non-exploded label list or map uses a comma. Multiple regular form-style query parameters share one `?` variable list; separately expanding multiple `?` templates is not conformant ([OAS 3.0.4 §§C.1–C.2](https://spec.openapis.org/oas/v3.0.4.html#equivalences-between-fields-and-rfc6570-operators), [OAS 3.0.4 §4.7.12.4](https://spec.openapis.org/oas/v3.0.4.html#style-examples), [RFC 6570 §3.2.5](https://www.rfc-editor.org/rfc/rfc6570#section-3.2.5)).

**[B — pin]** Appendix C.3 SHOULD-handles configurations with no direct RFC 6570 equivalent under RFC 6570 and says implementations MAY create a properly delimited URI Template; this specification pins that latitude to a requirement, because RFC 6570 prefix operators cannot combine. A query mixing regular form expansion with `allowReserved: true` MUST be constructed manually per parameter: reserved-permitting values use reserved expansion, and `[`, `]`, `#`, `&`, `=`, and `+` are pre-percent-encoded where Appendix C requires, the pre-encoding set being verified against C.4.2 ([OAS 3.0.4 §§C.3–C.4.2](https://spec.openapis.org/oas/v3.0.4.html#non-rfc6570-field-values-and-combinations)).

**[B — convention]** The manual path assembles all present per-parameter contributions into one query component with one leading `?` and `&` between contributions; this assembled result is the single-query rule's equivalent at the authority's construction seam.

**[B — convention]** Query-contribution order across distinct effective parameters is not portable meaning.

**[A]** A parameter name that is not a legal RFC 6570 variable name MUST be percent-encoded before use in the template construction ([OAS 3.0.4 §§C.3, C.4.4](https://spec.openapis.org/oas/v3.0.4.html#illegal-variable-names-as-parameter-names)).

**[B — convention]** That variable-name encoding is internal to URL assembly and never changes the exact caller-envelope key defined by §7.

**[B — convention]** For `spaceDelimited`, `pipeDelimited`, and `deepObject`, the exact bytes are the corresponding OAS Style Examples read under §8.2's presentational-prefix rule: delimiters and deep-object brackets are percent-encoded, object names and values retain their shown alternation, and no unstated escape convention is added ([OAS 3.0.4 §4.7.12.4](https://spec.openapis.org/oas/v3.0.4.html#style-examples)).

**[B — pin]** Before dispatch, the binding refuses a supplied parameter or property name or scalar value containing its non-RFC style's structural delimiter: U+0020 SPACE for `spaceDelimited`, `|` for `pipeDelimited`, or any of `[`, `]`, `=`, and `&` for `deepObject`; no escape-convention configuration point is offered. The authority is not silent here, and this is a narrowing of what it permits. Appendix E.5 names `[`, `]`, `|`, and space as the delimiters of these three styles, requires that they "all MUST be percent-encoded to comply with [RFC3986]", and then places the remedy outside itself: it RECOMMENDS defining "an additional escape convention while percent-encoding the delimiters for these styles, or … avoid[ing] these styles entirely", and states that "the exact method of additional encoding/escaping is left to the API designer, and is expected to be performed before serialization … and reversed after". Because that escape convention is an artifact-external agreement this binding cannot read from the artifact, no configuration point could make the round trip decidable, so this specification takes the second of the authority's two recommendations and refuses the ambiguous value instead of inventing a convention. The refusal set adds `=` and `&` beyond the four Appendix E.5 enumerates, because an exploded `deepObject` also uses those two bytes to delimit its own `name[key]=value` pairs on the wire ([OAS 3.0.4 Appendix E.5](https://spec.openapis.org/oas/v3.0.4.html#percent-encoding-and-illegal-or-reserved-delimiters), [RFC 3986 §2.2](https://www.rfc-editor.org/rfc/rfc3986#section-2.2)).

**[B — exclusion]** An effective `style`/`explode` combination, including a defaulted `explode`, whose entire Style Examples row is `n/a` excludes that parameter; therefore omitted `explode` on `deepObject` computes to the excluded `false` row, which the edition itself calls undefined. The test is the whole row and never a single cell: a row carrying `n/a` in some columns and real bytes in others — `spaceDelimited` with `explode: false`, for instance — is a supported combination, and only the values falling in its `n/a` columns are refused, by the null rule above. OAS/RFC 6570 defines no expansion for a wholly `n/a` row, so the owning unit is excluded unless an incorporated authority defines that exact combination ([OAS 3.0.4 §§4.7.12.2.2–4.7.12.4, 4.7.15.1.2, C.1](https://spec.openapis.org/oas/v3.0.4.html#style-values), [RFC 6570 §3.2.1](https://www.rfc-editor.org/rfc/rfc6570#section-3.2.1)).

**[B — exclusion]** Otherwise a compound-capable style is excluded only when its resolved declaration proves an unsupported compound member—an array whose resolved `items` declaration declares only `object` or `array`, or an object with at least one declared property whose resolved declaration declares only `object` or `array`. OAS/RFC 6570 defines no expansion for the excluded cells, so the owning unit is excluded unless an incorporated authority defines that exact cell ([OAS 3.0.4 §§4.7.12.2.2–4.7.12.4, 4.7.15.1.2, C.1](https://spec.openapis.org/oas/v3.0.4.html#style-values), [RFC 6570 §3.2.1](https://www.rfc-editor.org/rfc/rfc6570#section-3.2.1)).

**[B — convention]** A typeless resolved member proves no compound shape, a choice that supplies no single resolved member declaration under §5.2 proves no compound shape, and an object declaring no properties proves no compound member, so none triggers this exclusion; in particular, a declaration that still admits a scalar is never excluded, and candidate admission never inspects the supplied runtime value.

**[B — convention]** The rule applies symmetrically to every compound-capable parameter style and to §9.3's URL-encoded Encoding style path, including its defaulted `explode`, where the smallest owner is the selected media alternative rather than the target.

**[A]** The Paths Object MUST NOT contain two templated path keys with equivalent hierarchies but different template names ([OAS 3.0.4 §§4.7.8.1–4.7.8.2](https://spec.openapis.org/oas/v3.0.4.html#path-templating-matching)).

**[B — exclusion]** Equivalent-hierarchy path-key ambiguity is a declaration defect that excludes each selected operation on a participating Path Item before any caller value is inspected, mirroring the duplicate-parameter precedent; non-conflicting targets survive. The exclusion reopens only if an incorporated authority admits the declaration or defines its unique target mapping.

**[A]** Every path-template expression MUST have a corresponding effective path parameter ([OAS 3.0.4 §3.5](https://spec.openapis.org/oas/v3.0.4.html#path-templating)).

**[B — convention]** An expanded path value containing unescaped `/`, `?`, or `#` refuses before dispatch. No accepted 3.0 edition states this restriction: each edition's §3.5 is two sentences and stops at the correspondence requirement above, and the accepted editions' Parameter Object sections say nothing about path-value characters. The sentence that does state it — "The value for these path parameters MUST NOT contain any unescaped 'generic syntax' characters described by [RFC3986] Section 3: forward slashes ( / ), question marks ( ? ), or hashes ( # )" — first appears on the 3.1 line and is carried forward on the 3.2 line, both of which are outside §2's accepted set. This specification adopts the restriction as its own safety rule so that one supplied value cannot silently restructure the completed target's path, query, or fragment; the rule is stated here rather than borrowed, and §2's corrected-patch pin does not reach it because every accepted edition is silent rather than in conflict ([OAS 3.0.4 §§3.5, 4.7.12.2.1](https://spec.openapis.org/oas/v3.0.4.html#path-templating), against [OAS 3.1.2 §3.5](https://spec.openapis.org/oas/v3.1.2.html#path-templating) and [OAS 3.2.0 §4.8.2](https://spec.openapis.org/oas/v3.2.0.html#path-templating)).

### 8.3 Content-form, empty, header, and cookie parameters

**[A]** Every Parameter Object requires `name` and an `in` value from `path`, `query`, `header`, or `cookie`; it MUST contain exactly one of `schema` or `content`, a `content` map MUST contain exactly one media-type entry, and a path parameter requires `required: true` with a name corresponding to a path-template expression ([OAS 3.0.4 §§4.7.12.1–4.7.12.2.3](https://spec.openapis.org/oas/v3.0.4.html#parameter-object)).

**[B — exclusion]** A selected effective Parameter Object violating any constraint in that closed declaration list is a declaration defect that excludes the selected target before caller values are inspected. The exclusion reopens only if an incorporated OAS 3.0 edition admits the exact malformed declaration or defines its wire meaning.

**[B — convention]** A `content`-form parameter application value serializes under its sole media type and then follows its destination: path and query representations are percent-encoded as one URI parameter value, while header serialization adds no URI percent-encoding and cookie serialization follows the cookie rules below. This is the minimal URI-validity assignment where the line defines the media representation but not the destination step.

**[B — pin]** Percent-encoding a content-form parameter leaves RFC 3986 unreserved bytes literal and encodes every other UTF-8 byte as uppercase `%HH`; the exact caller-envelope key remains unchanged.

**[A]** For a query parameter with `allowEmptyValue: true`, a supplied empty string emits a present zero-length value; absence still means omitted, and this binding infers no schema-validity consequence because OAS leaves that interaction implementation-defined ([OAS 3.0.4 §4.7.12.2.1](https://spec.openapis.org/oas/v3.0.4.html#parameter-allow-empty-value)).

**[B — pin]** Header `schema` serialization performs no URI percent-encoding and adds no automatic quotes; cookie contributions are not URI-decoded after serialization. This is a disclosed displacement of the accepted editions' own text, in the manner of §9.2's RFC 2046 charset displacement. OAS 3.0.4's Appendix D applies RFC 6570 percent-encoding to `in: "header"` parameters: it opens "[RFC6570]'s percent-encoding behavior is not always appropriate for `in: "header"` and `in: "cookie"` parameters", warns that the standard Base64 alphabet "includes non-URL-safe characters that are percent-encoded by RFC6570 expansion", and reasons that with `style: "simple"` the `;` delimiter preceding an HTTP field parameter "would itself be percent-encoded, violating the general HTTP field syntax" — a warning that is intelligible only if the encoding does apply. OAS 3.1.2 later corrected this, and says so in its own words: "OAS v3.0.4 and v3.1.1 applied the advice in this section to avoid RFC6570-style serialization to both headers and cookies. However, further research has indicated that percent-encoding was never intended to apply to headers, so this section has been corrected to apply only to cookies." This specification pins the corrected reading for the 3.0 line, because percent-encoding a header value produces a field an HTTP peer cannot read back and no accepted edition defines a decoding that recovers it. Because 3.1.2 and 3.2.0 lie outside §2's accepted set, §2's corrected-patch pin does not reach this. The correction is nevertheless the authority's own erratum rather than an edition difference: 3.1.2 names the editions it corrects, 3.0.4 among them, and says the section "has been corrected". An authority's self-identified erratum states what the earlier text always meant, so it reaches every accepted edition the erratum names, while a deliberate change between editions does not ([OAS 3.0.4 §§4.7.12.2.2, Appendix D, C.2](https://spec.openapis.org/oas/v3.0.4.html#appendix-d-serializing-headers-and-cookies), displaced by [OAS 3.1.2 Appendix D.1](https://spec.openapis.org/oas/v3.1.2.html#percent-encoding-and-cookies) and [OAS 3.2.0 Appendix D](https://spec.openapis.org/oas/v3.2.0.html#appendix-d-serializing-headers-and-cookies)).

**[B — pin]** A supplied header value's characters are carried as UTF-8 octets, closing the character-to-octet seam before the field-invalid-byte check below ([RFC 9110 §5.5](https://www.rfc-editor.org/rfc/rfc9110#section-5.5)).

**[B — convention]** A supplied header value containing CR, LF, or another field-invalid byte refuses before dispatch at the affected parameter ([RFC 9110 §§5.1, 5.5](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — convention]** Raw-Cookie and structured-cookie declarations alone exclude nothing. An invocation in which a supplied raw `Cookie` Header parameter value and any structured cookie contribution—an effective cookie parameter or selected cookie credential—would both be emitted refuses before dispatch; the binding does not parse or merge the raw string.

**[B — exclusion]** An effective header parameter named `Host` or `Content-Length` excludes the target because those fields are processor-owned and cannot be replaced by caller input; the exclusion reopens only if an incorporated HTTP authority defines caller control that preserves the processor's framing and routing obligations.

**[B — exclusion]** A form-style cookie declaration that produces multiple values excludes the target because OAS identifies RFC 6570's `&`-separated expansion as incorrect for Cookie's `; ` delimiter; the exclusion reopens only if an incorporated OAS edition defines a correct multi-value mapping ([OAS 3.0.4 Appendix D](https://spec.openapis.org/oas/v3.0.4.html#appendix-d-serializing-headers-and-cookies)).

## 9. Request and response media

### 9.1 Media identity, alternatives, and request election

**[A]** Media types parse under RFC 9110: type and subtype compare case-insensitively, parameter names compare case-insensitively, and parameter values retain their media-defined comparison rules ([RFC 9110 §§5.6.6, 8.3.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.6.6)).

**[B — convention]** A **concrete media type** has no wildcard in either its type or subtype; media-type parameters do not affect concreteness.

**[B — convention]** A declaration matches a concrete media type only when every declared parameter is present with an equal value; matches order by exact type/subtype before `type/*` before `*/*`, then by greatest declared-parameter count, and equal-specificity ties select no declaration.

**[B — limit]** Distinct content-map keys that normalize to one parsed media identity collide only for that identity and support no selection through it: a request selection refuses before dispatch and a response selection is a loud protocol error. Non-colliding entries survive, and map order never breaks the tie.

**[A]** A no-body invocation bypasses request-body media selection and emits neither a body nor `Content-Type`, because an absent optional effective Request Body contributes no HTTP content ([OAS 3.0.4 §§4.7.10.1, 4.7.13.1](https://spec.openapis.org/oas/v3.0.4.html#request-body-object)).

**[B — configuration point]** A body-emitting invocation preserves every admissible declared request alternative: exactly one usable concrete entry — one not excluded by this specification's confinement rules — selects itself; every other map, including two or more usable entries or a concrete declaration alongside a usable range, requires a concrete `requestMedia` choice before input consumption; the choice MUST match under §9.1 and never substitutes another declaration's schema, and supplied values never elect.

**[B — configuration point]** A missing required choice, unmatched or ambiguous choice, unsupported selected lane, or body-emitting invocation with no admissible candidate refuses before dispatch; no body bytes or examples are sniffed to select a lane.

**[A]** Examples illustrate values ([OAS 3.0.4 §4.7.14.1](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields-11)).

**[B — limit]** Examples create no operation input or output member and never select a declaration, carriage lane, or media type.

**[B — convention]** The binding sends no `Accept` header: OAS ignores a Header parameter named `Accept`, request-body content declares what the operation consumes, and response content supplies no portable instruction to advertise a preference ([OAS 3.0.4 §§4.7.12.2.1, 4.7.13, 4.7.17](https://spec.openapis.org/oas/v3.0.4.html#common-fixed-fields)).

### 9.2 Common carriage lanes

**[B — pin]** An exact `application/json` or `+json` selection serializes the supplied value as strict JSON on requests and parses strict JSON on responses; JSON text uses UTF-8 ([RFC 6839 §3.1](https://www.rfc-editor.org/rfc/rfc6839#section-3.1), [RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)).

**[B — pin]** [RFC 6839 §3.1](https://www.rfc-editor.org/rfc/rfc6839#section-3.1) is the incorporated `+json` suffix authority; where its registration inherits RFC 4627's UTF-16/UTF-32 latitude, [RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)'s UTF-8 requirement governs this lane.

**[B — pin]** Strict JSON is RFC 8259's grammar under this profile: parsing resolves duplicate object member names by taking the lexically last member, the documented common receiver behavior inside RFC 8259 §4's permitted set; a leading byte-order mark on a JSON body is ignored under RFC 8259 §8.1's parser latitude and is never part of the value; and a lone surrogate escape yields no value — it is a loud protocol error, because neither silent replacement nor invalid passthrough preserves the supplied text ([RFC 8259 §§4, 8.1–8.2](https://www.rfc-editor.org/rfc/rfc8259#section-4)).

**[B — limit]** JSON-lane numbers are interoperable within RFC 8259 §6's binary64 expectation; precision or range beyond it is not preserved across this lane, and that disclosed reduction is the only permitted deviation from the supplied mathematical value ([RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259#section-6)).

**[B — convention]** `text/json` is not a member of that JSON lane; as a `text/*` type it can use the character-data lane only when its resolved declaration admits `string` as its sole non-null type and does not carry `format: binary`. This convention reopens under a new identifier only if the IANA media-type registry registers `text/json` with JSON semantics.

**[B — convention]** A concrete character-data selection governed by a resolved declaration that admits `string` as its sole non-null type and does not carry `format: binary` carries the supplied string under its declared `charset`, defaulting to UTF-8; `type: string` with `nullable: true` therefore selects this lane for its string branch, while a supplied null refuses before dispatch because the lane defines no null lexical form. Response decoding emits a string and never invents null. The closed character-data set is `text/*`, `application/xml`, and `+xml`, while `application/json` and `+json` are claimed by the JSON lane. The binding does not consult the live media-type registry's `Encoding considerations`: `application/json` is registered as binary, `text/csv` records no value, and a live lookup would violate this pinned, immutable reading ([RFC 6838 §4.2.1](https://www.rfc-editor.org/rfc/rfc6838#section-4.2.1), [RFC 2046 §4.1](https://www.rfc-editor.org/rfc/rfc2046#section-4.1), [RFC 7303 §§3, 9](https://www.rfc-editor.org/rfc/rfc7303#section-3)).

**[B — pin]** This binding is an XML-unaware MIME consumer in RFC 7303 §3's own terms — it processes XML media as opaque character data, never as parsed XML — and the charset parameter is the only character-encoding source this lane consults: consulting a BOM or XML declaration would require inspecting body bytes, which this binding never sniffs, so a charset-less non-UTF-8 XML response is a loud protocol error rather than being sniffed, and every unsupported or invalid character decoding likewise raises a loud protocol error ([RFC 7303 §3.2](https://www.rfc-editor.org/rfc/rfc7303#section-3.2)).

**[B — pin]** The UTF-8 default charset displaces RFC 2046 §4.1.2's US-ASCII default for `text/*`: RFC 9110 §8.3.2 leaves charset semantics to each media type's registration rather than restating a MIME-era default, and this binding pins the modern-HTTP UTF-8 reading, disclosed here as a deliberate displacement ([RFC 2046 §4.1.2](https://www.rfc-editor.org/rfc/rfc2046#section-4.1.2), [RFC 9110 §8.3.2](https://www.rfc-editor.org/rfc/rfc9110#section-8.3.2)).

**[B — limit]** UTF-8 decoding MUST be supported; any further charset is an implementation capability whose absence refuses loudly.

**[A]** A resolved declaration that admits `string` as its sole non-null type with `format: binary` authorizes unencoded octets, while one with `format: byte` denotes binary data embedded in a text-only format as an RFC 4648 Base64 string ([OAS 3.0.4 §§4.4.1–4.4.2](https://spec.openapis.org/oas/v3.0.4.html#working-with-binary-data)).

**[B — convention]** A `format: byte` value remains text under this binding: it uses its Base64 character bytes outside the JSON and form lanes, and it is never decoded merely by crossing the OpenBindings raw-octet boundary. §4.4.2 states the `binary`/`byte` distinction but assigns neither format a boundary-crossing rule, so this specification supplies one to keep a single value from being Base64-decoded twice — once by the artifact's own declaration and once by §9.2's raw-octet boundary.

**[B — convention]** A non-JSON, non-form concrete selection whose Media Type Object omits `schema`, whose present resolved declaration is typeless, or whose resolved declaration admits `string` as its sole non-null type with `format: binary` uses the raw-octet lane. A schema-omitted media range does not gain this lane because it declares no single concrete representation.

**[B — convention]** In the preceding rule, a concrete selection is the concretely keyed declared alternative: a concrete `requestMedia` choice or actual response type matched by a range-keyed entry is governed by the range sentence and gains no raw lane through the match.

**[A]** Every other supported keyword in a typeless resolved declaration still applies, because JSON Schema keywords and formats do not implicitly require the expected type; and `maxLength` on raw content measures decoded wire octets rather than the Base64 boundary string, because for unencoded binary the length is the number of octets ([OAS 3.0.4 §4.4](https://spec.openapis.org/oas/v3.0.4.html#data-types), [§4.4.2](https://spec.openapis.org/oas/v3.0.4.html#working-with-binary-data)).

**[A]** `contentEncoding` and `contentMediaType` are outside the closed 3.0 Schema Object vocabulary and therefore decide as if absent; although 3.0.4's multipart guidance discusses those names, it does not enlarge the same edition's strictly supported keyword inventory or create binding behavior ([OAS 3.0.4 §§4.7.24.1, 4.7.15.3](https://spec.openapis.org/oas/v3.0.4.html#json-schema-keywords)).

**[B — pin]** Every OpenBindings raw-octet value is a JSON string containing canonical RFC 4648 §4 Base64: standard alphabet, required padding, no ignored non-alphabet characters, and zero unused pad bits; requests decode before dispatch and responses encode the exact octets ([RFC 4648 §§3.3, 3.5, 4](https://www.rfc-editor.org/rfc/rfc4648)).

**[B — exclusion]** This specification does not generate XML from an object model because the OAS XML Object does not determine complete document bytes; the selected media alternative is excluded until an incorporated authority defines ordering, escaping, nulls, dynamic keys, and scalar lexical forms, while string and raw-octet XML carriage remain admitted ([OAS 3.0.4 §§4.7.14, 4.7.26](https://spec.openapis.org/oas/v3.0.4.html#xml-object)).

**[B — convention]** `readOnly` and `writeOnly` retain their OAS request/response validation meaning, but this binding never uses either annotation to delete a supplied wire member or synthesize an absent one ([OAS 3.0.4 §4.7.24.2](https://spec.openapis.org/oas/v3.0.4.html#schema-read-only)).

**[B — exclusion]** A concrete request or response selection admitted by none of §3.2's five closed lanes — JSON, character-data including the string XML carriage under §9.2's XML rule, raw-octet, and the request-only form and multipart lanes — is excluded at its smallest media owner because OAS supplies no value-to-bytes mapping; the exclusion reopens only if an incorporated authority defines that media/data-form cell.

**[C]** Invoking this binding does not trigger validation of any application value against its governing Schema Object; only a tool that separately claims validation owes Core's validation rules (Core [invariant 2](../../openbindings.md#2-core-invariants), [OBI-T-16](../../openbindings.md#103-tool-rules)).

### 9.3 Form bodies and multipart parts

**[A]** `application/x-www-form-urlencoded` and `multipart/form-data` serialize object properties under the governing Schema and Encoding Objects, and a multipart alternative requires a schema ([OAS 3.0.4 §§4.7.14.4, 4.7.14.5, 4.7.15.3](https://spec.openapis.org/oas/v3.0.4.html#encoding-multipart-media-types)).

**[B — exclusion]** The form and multipart lanes are request-only: the incorporated authority's form and multipart sections are request-scoped by their own headings and supply no reverse mapping from those bytes to an application value, so a response selection of either lane is excluded at its smallest media owner. The exclusion reopens only if an incorporated authority defines that decoding.

**[B — convention]** A supplied `body: null` against a form or multipart object declaration refuses before dispatch: neither lane defines a null lexical form, mirroring §9.2's character-data rule.

**[B — limit]** A non-object declaration excludes the form lane at its smallest owning unit under §3.2's smallest-owner rule, and a multipart alternative without its required schema is unavailable.

**[A]** For a dynamic object member, the resolved property declaration uses the applicable exact `properties` declaration, or `additionalProperties` when no exact property declaration exists; applicable `allOf` constraints remain in force, and unsupported schema keywords create no additional property-routing behavior ([OAS 3.0.4 §4.7.24.1](https://spec.openapis.org/oas/v3.0.4.html#json-schema-keywords)).

**[B — convention]** Boolean `additionalProperties` resolves deterministically: `true` yields a typeless-equivalent resolved property declaration for an undeclared supplied member, and `false` yields no resolved property declaration, so an undeclared supplied member is unroutable and refuses before dispatch.

**[B — convention]** For form-carriage selection, a resolved property declaration uses §5.2's sole-non-null-choice member; `nullable: true` at the same level as `type` contributes null admission but no second carriage shape ([OAS 3.0.4 §§4.7.15.1.1, Appendix B](https://spec.openapis.org/oas/v3.0.4.html#common-fixed-fields-0)).

**[B — convention]** On the content-based form-urlencoded path and on the multipart path, a supplied JSON null for an optional property is elided as an omitted member and contributes neither a form-urlencoded field nor a multipart part. The Encoding RFC 6570-style path instead follows §8.2's authority-derived undefined-value bytes.

**[B — limit]** That elision identifies `{}` and `{"x": null}` on the wire: a deliberate loss inside the authority's data-type-conversion latitude, disclosed here — the distinction between an absent optional member and an explicit null does not survive this lane ([OAS 3.0.4 Appendix B](https://spec.openapis.org/oas/v3.0.4.html#appendix-b-data-type-conversion)).

**[A]** Encoding `style`, `explode`, and `allowReserved` controls apply only to `application/x-www-form-urlencoded`: each SHALL be ignored if the request body media type is not that type, so all three are ignored for multipart bodies on this line ([OAS 3.0.4 §4.7.15.1.2](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields-for-rfc6570-style-serialization)). This scope is edition-keyed and narrower than the 3.1 and 3.2 lines, whose same three fields extend to `multipart/form-data`; read that as an edition difference, never as sibling drift ([OAS 3.1.2 §4.8.15.1.2](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-for-rfc6570-style-serialization), [OAS 3.2.0 §4.15.1.2](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-for-rfc6570-style-serialization)).

**[B — pin]** Explicit presence of any one of those controls selects RFC 6570-style serialization and absent sibling controls take their defaults, while absence of all three selects content-based encoding. The accepted editions frame both branches only as advice: 3.0.4 introduces the first with "it is RECOMMENDED that whenever any of `style`, `explode`, or `allowReserved` are present with an explicit value" the `contentType` value "is to be ignored" and the absent siblings "treated as if they were present with their default values", and the second with "However, if all three of `style`, `explode`, and `allowReserved` fields are absent, it is RECOMMENDED that" the keywords be entirely ignored and "Encoding is to be based on `contentType` alone". This specification pins both to fixed rules, because a RECOMMENDED branch selection leaves two conformant processors emitting different bytes for one declaration. The 3.1 and 3.2 lines raise the same selection to SHALL, so this pin anticipates the correction rather than departing from it ([OAS 3.0.4 §4.7.15.1.2](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields-for-rfc6570-style-serialization), against [OAS 3.1.2 §4.8.15.1.2](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-for-rfc6570-style-serialization)).

**[A]** Form-urlencoded removes RFC 6570's leading `?`; its content path follows RFC 1866 form encoding while its style path follows RFC 6570, and the two paths remain distinct rather than being collapsed into a single serialization route. On the content path, Encoding `contentType` routes a property's serialization and may declare a concrete type, wildcard, or comma-separated list ([OAS 3.0.4 §§4.7.15.1.1–4.7.15.2, Appendix E](https://spec.openapis.org/oas/v3.0.4.html#encoding-the-x-www-form-urlencoded-media-type), [RFC 1866 §8.2.1](https://www.rfc-editor.org/rfc/rfc1866#section-8.2.1), [RFC 6570](https://www.rfc-editor.org/rfc/rfc6570)).

**[B — pin]** On that content-based form-urlencoded path, SPACE becomes `+`, RFC 3986 unreserved bytes remain literal, and every other UTF-8 byte is encoded as uppercase `%HH`. This fixes one spelling where the incorporated authorities give several, and is disclosed as a deliberate displacement: RFC 1866 §8.2.1 replaces every non-alphanumeric character, and Appendix E.3 assigns this path RFC 1738's safe set and recommends it for historical interoperability, whereas the RFC 3986 unreserved set pinned here leaves `~` literal where those rules encode it and encodes `!`, `*`, `'`, `(`, `)`, `,`, and `$` where RFC 1738 leaves them literal. This specification pins the RFC 3986 set because it is the set every other percent-encoding rule in this document already uses — §8.3's content-form parameters and §11's API-key query values — and one binding emitting two unreserved sets would be a worse outcome than one disclosed departure from the authority's recommendation ([OAS 3.0.4 Appendix E.3, E.3.1](https://spec.openapis.org/oas/v3.0.4.html#generating-and-validating-uris-and-form-urlencoded-strings), [RFC 1866 §8.2.1](https://www.rfc-editor.org/rfc/rfc1866#section-8.2.1), [RFC 3986 §2.3](https://www.rfc-editor.org/rfc/rfc3986#section-2.3)).

**[A]** A property's Encoding media type is selected as follows: an explicit single concrete Encoding `contentType`; otherwise `application/octet-stream` for a resolved declaration that admits `string` as its sole non-null type with `format: binary` or `format: byte`, `text/plain` for a plain string or number/integer/boolean, `application/json` for an object, and the item-type default for an array. A typeless resolved declaration has no default concrete type. This selection governs both lanes that carry Encoding Objects — the content-based form-urlencoded path and multipart parts — because the edition places it among fields that "MAY be used either with or without the RFC6570-style serialization fields", not among the multipart-only fields ([OAS 3.0.4 §4.7.15.1.1](https://spec.openapis.org/oas/v3.0.4.html#common-fixed-fields-0)).

**[B — convention]** On the content-based form-urlencoded path the selected media type routes the property's serialization through §9.2's lane for that type and the resulting bytes are then percent-encoded as one field value under the rule above; on the multipart path it is the part's `Content-Type`. A compound property value on the content path therefore rides as its `application/json` image rather than being unroutable, and no property reaches the wire without a stated lane.

**[A]** Every `multipart/form-data` part carries `Content-Disposition: form-data` with the schema-property name in its `name` parameter; an array property emits one part per element under that same name ([OAS 3.0.4 §4.7.15.3](https://spec.openapis.org/oas/v3.0.4.html#encoding-multipart-media-types)).

**[B — convention]** Repeated parts for one array preserve element order; cross-property multipart part order and cross-property form-urlencoded field order have no portable meaning. An implementation MAY emit a deterministic cross-property order, but the binding exposes and requires none; property-to-name membership and array-member order remain separate.

**[B — exclusion]** A property name that cannot be represented safely as the multipart `name` parameter, including any name containing CR or LF, excludes only that multipart media alternative; the exclusion reopens only if an incorporated authority defines an unambiguous encoding.

**[A]** For a multipart field, `format: byte` is declaration-equivalent to an Encoding `Content-Transfer-Encoding` Header schema that requires `base64`; OAS also notes that `Content-Transfer-Encoding` is deprecated for `multipart/form-data`, and defines serialization and parsing as undefined when an explicit Encoding Header schema conflicts by disallowing `base64` ([OAS 3.0.4 §4.7.15.3](https://spec.openapis.org/oas/v3.0.4.html#encoding-multipart-media-types)).

**[B — convention]** A part with a typeless resolved declaration or whose resolved declaration admits `string` as its sole non-null type with `format: binary` uses the raw-octet lane and §9.2's canonical Base64 boundary; a part whose resolved declaration admits `string` as its sole non-null type with `format: byte` rides as artifact-encoded Base64 text. The declaration equivalence alone emits no `Content-Transfer-Encoding`; when the artifact explicitly declares that Encoding header and its resolved declaration admits `base64`, the emitted field is `Content-Transfer-Encoding: base64`.

**[B — exclusion]** A `format: byte` part for which the resolved declaration of an explicit Encoding `Content-Transfer-Encoding` Header disallows `base64` is unusable, and any invocation that would emit it refuses before dispatch; the defect is confined to that declared part. This exclusion reopens only if an incorporated OAS edition defines serialization and parsing for the conflict ([OAS 3.0.4 §4.7.15.3](https://spec.openapis.org/oas/v3.0.4.html#encoding-multipart-media-types)).

**[B — configuration point]** `propertyMedia` supplies one concrete media type per affected form or multipart property. It is required, on the content-based form-urlencoded path and for a multipart part alike, whenever the preceding selection yields no single concrete media type: that is, when the Encoding `contentType` is a wildcard or a comma-separated list, or when the resolved declaration is typeless and so has no default concrete type. The choice MUST satisfy a declared member under §9.1, and an absent, unmatched, or ambiguous required choice refuses before dispatch at the selected media alternative.

**[B — limit]** Except for the artifact-declared `Content-Transfer-Encoding: base64` case above, Encoding `headers` are descriptive at this operation boundary: the binding emits no part header merely from a Header Object schema and never emits an undeclared `Content-Transfer-Encoding`; this specification defines no caller channel for part headers, so an alternative needing a caller-supplied part header cannot be carried under this identifier ([OAS 3.0.4 §§4.7.15.1.1, 4.7.15.3](https://spec.openapis.org/oas/v3.0.4.html#encoding-headers)).

**[B — exclusion]** A multipart media type other than `multipart/form-data` is excluded because OAS defines no property-to-part correlation for unnamed ordered parts; the exclusion reopens only if an incorporated OAS edition defines that correlation ([OAS 3.0.4 §4.7.15.3](https://spec.openapis.org/oas/v3.0.4.html#encoding-multipart-media-types)).

### 9.4 HTTP content codings

**[A]** HTTP `Content-Encoding` is distinct from media type, from `format: byte`, and from the unsupported Schema Object keyword `contentEncoding`; request codings apply in listed wire order and response codings decode in reverse order before the selected media lane ([RFC 9110 §8.4](https://www.rfc-editor.org/rfc/rfc9110#section-8.4), [OAS 3.0.4 §4.4.2](https://spec.openapis.org/oas/v3.0.4.html#working-with-binary-data)).

**[A]** HTTP field-name comparison is ASCII case-insensitive, and OAS follows HTTP's case-sensitivity rules for names that map directly to HTTP concepts ([OAS 3.0.4 §3.8](https://spec.openapis.org/oas/v3.0.4.html#case-sensitivity), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — convention]** The artifact declaration surfaces for content codings are an effective request header parameter named `Content-Encoding` and a governing response Header Object of that name. No accepted edition designates them: `Content-Encoding` appears once across the accepted editions, and only to record that it is unrelated to `format: byte`. This specification maps the coding surface onto the two ordinary header-declaration positions the artifact already has, rather than inventing a third ([OAS 3.0.4 §4.4.2](https://spec.openapis.org/oas/v3.0.4.html#working-with-binary-data), [§4.7.12](https://spec.openapis.org/oas/v3.0.4.html#parameter-object), [§4.7.17](https://spec.openapis.org/oas/v3.0.4.html#response-headers)).

**[B — exclusion]** Two governing response Header Object keys that differ only by ASCII case exclude the smallest owning response alternative before any actual response is inspected, because OAS Header Object keys are case-sensitive while HTTP field names are not and the wire cannot preserve the distinction; the exclusion reopens only if an incorporated authority defines a wire mapping that preserves such case-distinct declarations. The rule reaches every governing response Header Object key, not only the content-coding surface: on this line a Header Object also carries `required`, so a case-distinct pair would equally leave §9.5's required-presence check with no determinate subject. This mirrors §7's request-side exclusion for case-distinct header parameters ([OAS 3.0.4 §§3.8, 4.7.17, 4.7.21](https://spec.openapis.org/oas/v3.0.4.html#response-headers), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — configuration point]** `requestContentCodings` and `responseContentCodings` are finite consumer maps from case-insensitive content-coding tokens to deterministic encoders and decoders; on requests the caller-supplied effective `Content-Encoding` header parameter value fixes the encoder stack, while on responses the actual value governed by the Response Header Object fixes the decoder stack, and no configuration preference narrows either declared surface; two configuration tokens in either map that collide after ASCII case-folding are not a usable configuration, and an invocation reading that map refuses before dispatch, mirroring §9.1's normalized-identity collision rule.

**[B — configuration point]** An unsupported token, a field value not admitted by its governing Header declaration, an ambiguous coding declaration, or an actual response coding with no governing Header Object is never skipped or sniffed: a request-side condition refuses before dispatch and a response-side condition is a loud protocol error; configuring a codec supplies capability but never declares a coding the artifact omitted.

### 9.5 Response declaration, classification, and decoding

**[A]** Response keys are closed to exact three-digit status codes `100` through `599`, the five ranges `1XX` through `5XX`, `default`, and specification extensions; an exact key overrides its matching range ([OAS 3.0.4 §§3.7, 4.7.16](https://spec.openapis.org/oas/v3.0.4.html#responses-object), [RFC 9110 §15](https://www.rfc-editor.org/rfc/rfc9110#section-15)).

**[B — exclusion]** A Responses key outside that closed admitted set is a declaration defect that excludes the selected target before any actual response is inspected; the exclusion reopens only if an incorporated OAS 3.0 edition admits that exact key form.

**[B — exclusion]** An upstream-invalid governing Response Object — one that is not a Response Object at all, or one violating the Response Object's fixed-field constraints: a `description` that is not a string, a `content`, `headers`, or `links` value that is not a map, or a `headers` member that is not a Header Object — is a declaration defect that excludes the selected target before any actual response is inspected, because response governance is target-level; the exclusion reopens only if an incorporated OAS 3.0 edition admits the exact declaration ([OAS 3.0.4 §§4.7.16, 4.7.17](https://spec.openapis.org/oas/v3.0.4.html#response-object)).

**[B — limit]** The exclusion above reaches only a Response Object that can GOVERN a SUCCESSFUL response: an exact 2xx status key, the `2XX` range key, or `default` when no `2XX` range key is declared — a `2XX` key covers the whole success class, so `default` can then never govern one. A fixed-field violation in a declaration that can never govern a 2xx status incurs no coverage loss — a failure body is decoded best-effort under this same section, so a defect in a declaration that can never govern a 2xx status can only leave the failure data undecoded and can never misstate a value this operation contract carries — and therefore does not exclude: a target whose success declarations are intact stays represented. It is the same no-coverage-loss reasoning that carves out the `description` omission below ([OAS 3.0.4 §4.7.16](https://spec.openapis.org/oas/v3.0.4.html#responses-object)).

**[B — limit]** One violation is carved out and does not exclude: a governing Response Object that omits its REQUIRED `description` while declaring no content incurs no coverage loss — nothing it states about a response body is misdeclared — and the selected target remains represented. The same omission WITH declared content excludes as above, and a `description` that is present with a non-string value is a fixed-field violation rather than an omission and excludes as above.

**[B — convention]** The governing Response Object lookup order is exact status, then the single matching range, then `default`; range-over-default is this specification's reading, and declarations never reclassify the native status.

**[A]** RFC 9110 defines the 2xx class as successful ([RFC 9110 §15.3](https://www.rfc-editor.org/rfc/rfc9110#section-15.3)).

**[B — convention]** For this binding, success means that the final status—the status after any interim responses and any redirects the runtime chose to follow with the bound method and complete body preserved—is in that 2xx class; a method-rewriting redirect is the final response of this interaction, and anything a runtime does after it is a different interaction outside this classification.

**[B — convention]** Redirect following is runtime policy. A redirect followed with the bound method and complete body preserved remains this interaction; a method-rewriting redirect is a final response of this interaction ([RFC 9110 §15.4](https://www.rfc-editor.org/rfc/rfc9110#section-15.4)).

**[B — limit]** Outcome classification depends on the final status, while redirect following and transport content negotiation, including a runtime-advertised `Accept-Encoding`, are runtime policy under Core §1.2. Two conformant runtimes MAY therefore classify one wire history differently, and that redirect/negotiation variance is the stated permitted set; the binding itself emits no negotiation field beyond those this specification pins (Core [§1.2](../../openbindings.md#12-out-of-scope)).

**[A]** A response Header Object named `Content-Type` is ignored. Every other governing response Header Object declaring `required: true` makes that header mandatory in the actual response ([OAS 3.0.4 §§4.7.17, 4.7.21](https://spec.openapis.org/oas/v3.0.4.html#response-headers)).

**[B — limit]** An actual response missing such a declared required header is a loud protocol error, in the same class as the undeclared non-empty-response error below; header carriage remains outside the operation-value boundary.

**[A]** A non-empty response selects its concrete media type from `Content-Type` and then the most-specific matching governing content declaration ([OAS 3.0.4 §§4.7.16, 4.7.17](https://spec.openapis.org/oas/v3.0.4.html#response-object)).

**[B — convention]** An unmatched, ambiguous, or normalized-colliding result is a loud protocol error.

**[B — convention]** When a non-empty response omits `Content-Type`, the binding takes RFC 9110's permitted `application/octet-stream` assumption before ordinary matching; the resulting type still MUST match a governing declaration ([RFC 9110 §8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3)).

**[B — convention]** An **empty response** has zero content octets after transfer decoding and content-coding decoding; a response to HEAD is empty by definition.

**[B — convention]** Empty responses emit no output value; successful non-empty responses emit the selected lane's one application value.

**[B — convention]** A failure body is decoded through the same selected carriage lanes as a successful body, and the decoded value is carried as opaque application-authored failure data on unsuccessful completion. That decoding is best-effort: when the governing content declaration is defective, or when no governing content declaration matches the actual media type, the interaction completes unsuccessfully with no failure-data value and raises no loud protocol error. A governing Response Object that survives the success-scoped exclusion above by violating a fixed field is read the same way at every other point it would govern: its defective member is treated as absent, so a non-map `headers` enforces no required response header and a non-map `content` selects no lane, and neither omission is a loud protocol error. A failure declaration is therefore not load-bearing for representation, which is the reason the success-scoped exclusion above gives. A governing Response Object that declares no response content at all is not such a case: it states positively that no content is returned, so an actual non-empty body under it contradicts a declaration and remains a loud protocol error whatever the final status.

**[B — convention]** The unary response value commits only after transfer completion and the full decode chain — content codings, then character decoding, then the selected lane — succeed; any failure after a 2xx final status and before that commit is a loud protocol error, and the interaction completes unsuccessfully with no partial unary value.

**[B — limit]** A non-empty response with no governing Response Object is a loud protocol error. This specification defines no response-header or Link carriage in an operation value, so Response Header and Link Objects create no output members under this identifier; consequently, even a declared `Location` header on a `201` response reaches no operation value ([OAS 3.0.4 §§4.7.16, 4.7.17](https://spec.openapis.org/oas/v3.0.4.html#response-object)).

**[B — limit]** One HTTP response body produces at most one operation value: the accepted 3.0 editions define no construct that frames one response body into multiple application values, including for `text/event-stream` ([OAS 3.0.0 §4.7.17](https://spec.openapis.org/oas/v3.0.0.html#response-object), [3.0.1 §4.7.17](https://spec.openapis.org/oas/v3.0.1.html#response-object), [3.0.2 §4.7.17](https://spec.openapis.org/oas/v3.0.2.html#response-object), [3.0.3 §4.7.17](https://spec.openapis.org/oas/v3.0.3.html#response-object), [3.0.4 §4.7.17](https://spec.openapis.org/oas/v3.0.4.html#response-object)).

## 10. Servers and target URL

**[A]** Server declarations are scoped at Operation, Path Item, and root levels, with a more specific list overriding the outer scope; an absent or empty root list is equivalent to one Server Object whose URL is `/` ([OAS 3.0.4 §§4.7.1.1, 4.7.5, 4.7.9.1, 4.7.10.1](https://spec.openapis.org/oas/v3.0.4.html#server-object)).

**[B — pin]** An empty Operation or Path Item `servers` array supplies no local alternative and falls through to the next outer scope, matching the root empty-equals-absent precedent. The accepted editions say only that an outer `servers` array "will be overridden by this value", without qualifying the overriding list as nonempty, so a plain reading also admits an empty array overriding into no server at all; this specification pins the fall-through reading because the alternative leaves a target with no completed URL and no stated recovery ([OAS 3.0.4 §§4.7.9.1, 4.7.10.1](https://spec.openapis.org/oas/v3.0.4.html#path-item-object)).

**[B — configuration point]** One effective server selects itself; multiple members require one consumer `server` choice before dispatch, the same value carries exact variable substitutions, and no member or variable preference is inferred.

**[B — exclusion]** OAS 3.0.4 requires a Server Variable `default` and sends it when no alternate is supplied, but only recommends that an `enum` be nonempty and that the default belong to it. For cross-line determinism this specification removes three declarations from the accepted surface — an empty `enum`, an out-of-enum default, and an otherwise unresolved variable — and rejects one caller value, an out-of-enum substitution. The first three are decidable from declarations alone and the fourth from a supplied value, but all four converge on one stated outcome: the selected target is unusable and the invocation **refuses before dispatch** at the affected Server Object. That outcome is a refusal and not §3.2's `excludes`, deliberately, because a `server` configuration point or a complete configured URL can still discharge the invocation and the target must therefore stay selectable and represented. Refusing the empty-enum-plus-default case deviates from the authority's SHALL-send-default instruction and is disclosed as this specification's own narrowing; this exclusion belongs to the Server Object that owns the variable and reopens only if an incorporated OAS edition defines the excluded declarations' unique substitution ([OAS 3.0.4 §4.7.6](https://spec.openapis.org/oas/v3.0.4.html#server-variable-object)).

**[A]** Before path assembly, an expanded relative Server URL—including the implied `/`—resolves against the location of the document containing that Server Object; the operation's path bytes are then appended verbatim to the expanded Server URL with no second relative-reference resolution, slash normalization, or path repair ([OAS 3.0.4 §§4.7.5.1, 4.7.8.1](https://spec.openapis.org/oas/v3.0.4.html#server-url)).

**[B — exclusion]** A Server URL containing a query or fragment excludes each target that would use it because the accepted editions define path append but no concatenation meaning for either component; the exclusion reopens only if an incorporated OAS edition defines that exact cell ([OAS 3.0.4 §§4.7.5.1, 4.7.8.1](https://spec.openapis.org/oas/v3.0.4.html#server-url)).

**[B — limit]** When embedded content has no document location to supply its base, a relative Server URL leaves the target unresolved and refuses before dispatch; the complete configured URL below remains the available recovery.

**[B — convention]** After path and query serialization, the completed target MUST parse and percent-decode under RFC 3986; an unusable target refuses before dispatch ([RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)).

**[B — convention]** That parse and percent-decode is a well-formedness check only: the dispatched bytes are the constructed percent-encoded bytes, and the completed target is never dispatched in decoded form.

**[B — exclusion]** A completed target whose scheme is not `http` or `https` refuses before dispatch, because no incorporated authority defines that scheme's HTTP-semantics mapping. The stated outcome is a refusal rather than §3.2's `excludes`, for the same reason as the Server Variable rule above: the scheme belongs to the completed target, which a `server` choice or a complete configured URL can still change, so the target stays selectable and represented. This exclusion belongs to the Server Object or configured URL that supplied the scheme, and reopens only if an incorporated authority defines that mapping.

**[B — configuration point]** The `server` configuration point MAY instead supply one complete consumer-configured URL. That URL is itself a valid `server` value and by itself discharges any required member choice; it MUST satisfy the same scheme and no-query/no-fragment constraints as an artifact Server URL, it replaces the resolved server base, and the operation's path bytes append verbatim to it; the artifact's path template, path substitution, query construction, method, parameters, body, response, and security semantics remain unchanged.

## 11. Security and channel assembly

**[A]** Operation `security` replaces root `security`; `[]` means no security requirement, array members are OR alternatives, every nonempty Security Requirement Object is an AND of its named schemes, and `{}` is a complete anonymous alternative ([OAS 3.0.4 §§4.7.10.1, 4.7.30](https://spec.openapis.org/oas/v3.0.4.html#security-requirement-object)).

**[B — configuration point]** The binding preserves every complete alternative and invents no anonymous-versus-credentialed preference. The named configuration point `security` selects one complete alternative: a sole declared alternative selects itself, and an effective empty `[]` or anonymous optional-security alternative counts as a complete no-security alternative; multiple alternatives require an explicit choice, fragments from different alternatives are never combined, and an invocation with no selection where one is required refuses before dispatch.

**[A]** Requirement arrays for OAuth 2.0 and OpenID Connect contain scopes and may be empty; arrays for every other scheme type MUST be empty, and this binding surfaces the exact OAuth/OpenID scope strings ([OAS 3.0.4 §4.7.30.1](https://spec.openapis.org/oas/v3.0.4.html#security-requirements-name)).

**[B — limit]** A nonempty requirement array for any other scheme type makes only that security alternative unusable; the defect is confined and reported loudly, and another complete alternative may still be selected.

**[B — configuration point]** `implicitConnectionScope` selects `entry` or `referring` document resolution for Security Requirement names and defaults to `entry`, following OAS's recommended entry-document scope while preserving the explicit alternative ([OAS 3.0.4 §4.3.2](https://spec.openapis.org/oas/v3.0.4.html#resolving-implicit-connections)).

**[A]** HTTP authentication-scheme tokens compare ASCII case-insensitively ([RFC 9110 §11.1](https://www.rfc-editor.org/rfc/rfc9110#section-11.1), [OAS 3.0.4 §4.7.27.1](https://spec.openapis.org/oas/v3.0.4.html#security-scheme-scheme)).

**[A]** `apiKey` credentials use their declared name and `query`, `header`, or `cookie` location, and HTTP `basic` and `bearer` credentials use the `Authorization` field ([OAS 3.0.4 §4.7.27](https://spec.openapis.org/oas/v3.0.4.html#security-scheme-object-0), [RFC 9110 §11.6.2](https://www.rfc-editor.org/rfc/rfc9110#section-11.6.2)).

**[B — pin]** A selected `basic` scheme consumes a runtime-supplied user-id and password and constructs `Authorization: Basic base64(user-id ":" password)` under [RFC 7617 §2](https://www.rfc-editor.org/rfc/rfc7617#section-2), including its user-id, password, and Base64 constraints. Because RFC 7617 §2 deliberately leaves the default character encoding undefined, the user-id and password octets are pinned to printable US-ASCII (0x20–0x7E); a credential containing any other character leaves the selected alternative unusable, and the invocation refuses before dispatch. This pin reopens only if an incorporated authority defines a charset-parameter declaration surface for the scheme.

**[B — pin]** A selected `apiKey` scheme consumes a runtime-supplied key value and emits it at the declaration's exact query, header, or cookie destination.

**[B — pin]** OAuth 2.0 and OpenID Connect flows consume a runtime-supplied access token and use the `Bearer` authorization scheme under [RFC 6750 §2.1](https://www.rfc-editor.org/rfc/rfc6750#section-2.1); another token type has no wire carriage under this identifier.

**[B — limit]** Any other declared HTTP authentication scheme remains visible as a consumer prerequisite, but this binding synthesizes no credential bytes for it; an alternative requiring it is unusable unless the runtime satisfies it as a complete prerequisite.

**[B — convention]** Credentials and credential-acquisition state MUST NOT be embedded in an OBI document.

**[B — convention]** A credential destination that collides with an effective parameter, another credential in the same AND requirement, or binding/processor-owned `Host`, `Content-Length`, `Content-Type`, or `Accept` makes only the selected security alternative unusable; another complete non-colliding alternative may still be selected, while §8.3 governs parameter-only processor-owned and invocation-time raw/structured cookie collisions.

**[B — convention]** API-key header destinations compare ASCII case-insensitively, while query and cookie destinations compare exact names. An API-key query value uses §8.2's query percent-encoding; an API-key cookie value is carried as an RFC 6265 `cookie-value` with no percent-encoding and refuses before dispatch when it cannot be so carried. Credential values never enter the caller envelope or operation contract; structured cookie contributions preserve membership and join as `name=value` separated by `; `, with no portable cookie order ([RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1), [RFC 6265 §4.2.1](https://httpwg.org/specs/rfc6265.html#sane-cookie), [OAS 3.0.4 Appendix D](https://spec.openapis.org/oas/v3.0.4.html#appendix-d-serializing-headers-and-cookies)).

## 12. Configuration, synthesis, and conformance

### 12.1 Configuration vocabulary

**[B — configuration point]** The complete binding-specific configuration vocabulary is `requestMedia` (one concrete media type), `server` (one effective Server alternative plus exact variable values, or one complete consumer-configured URL replacing the resolved server base), `security` (selection of one complete security alternative), `parameterConversion` (deterministic boolean/number converter), `implicitConnectionScope` (`entry` or `referring`), `requestContentCodings` (coding-to-encoder map), `responseContentCodings` (coding-to-decoder map), and conditional `propertyMedia` (one concrete media type per affected form or multipart property).

**[B — configuration point]** Every requirement is typed and discoverable from declarations. Preflightability is bounded: a requirement whose applicability is fixed by declarations alone is preflightable as an actual requirement, while `requestMedia` and `parameterConversion` are conditional on supplied values and are preflightable only as POSSIBLE requirements — a preflight can name them and their type but cannot know whether a given invocation will trigger them. No configuration member appears in the caller envelope or operation contract, and decoding and response classification are fixed rules rather than configuration points.

### 12.2 Synthesis boundary and coverage

**[C]** Operation contracts remain protocol-neutral (Core [§5.1](../../openbindings.md#51-operations), [invariant 1](../../openbindings.md#2-core-invariants)) and MAY remain flat (Core [§5.5](../../openbindings.md#55-transforms)).

**[B — convention]** Synthesis emits an `inputTransform` that constructs §7's envelope, and transforms never route values to HTTP locations.

**[B — convention]** This binding defines no status, header, selected-media, or other context bindings at `inputTransform` or `outputTransform` positions; evaluation uses Core's closed environment unaugmented (Core [§5.5 clause 5](../../openbindings.md#55-transforms), [OBI-T-10](../../openbindings.md#103-tool-rules)).

**[B — limit]** Synthesis emits flat protocol-neutral operation contracts together with an `inputTransform` that constructs §7's envelope: the envelope is the binding-boundary value, never the emitted operation contract, and qualified location-keys appear only in the transform's output. §12.2 licenses `inputTransform` and `outputTransform` as synthesis outputs, and operation/dependency key spelling, flattening, output-schema choice, and Schema Object translation as synthesis policy; no other input-restructuring apparatus exists under this identifier.

**[B — convention]** Schema Object translation preserves the declared value domain up to representability: a synthesizer MUST account a lossy or non-equivalent Schema Object translation as coverage loss at its owning position, and output-schema choice carries no further soundness latitude.

**[B — convention]** A synthesizer MUST account for every addressable operation and every callback dependency as represented, excluded with the exact reason stated beside the applicable exclusion, or unsupported; a failure in an unused description position is coverage loss rather than invocation behavior.

**[B — convention]** Every binding-specific configuration requirement remains in coverage accounting and invocation context, assigned to its represented target or declared alternative, and MUST NOT enter the operation input schema.

**[C]** Dependencies are synthesis outputs only and add no invocation target or receiver behavior (Core [§1.2](../../openbindings.md#12-out-of-scope), [§5.6](../../openbindings.md#56-dependencies)).

### 12.3 Conformance rules

**[B — convention]** A document conforms to **OAPI30-D-01** when its `content`, if present, satisfies §§3–5 and its `location`, if present, satisfies §4.

**[B — convention]** A binding conforms to **OAPI30-D-02** when it names `openbindings.openapi-3.0@1`, carries the literal selector of §6.1, and identifies a source that passes the exact edition gate.

**[B — convention]** A processor conforms to **OAPI30-P-01** when it implements the closed load gates, smallest-owner confinement, Schema Object subset, reference closure, and selector semantics of §§3–6.

**[B — convention]** A processor conforms to **OAPI30-P-02** when it accepts only §7's envelope, applies §8's effective-parameter, collision, conversion, style, content, header, cookie, and path rules, and refuses every unknown or unroutable input before dispatch.

**[B — convention]** A processor conforms to **OAPI30-P-03** when it preserves media alternatives and applies §9's matching, request election, carriage, form, multipart, content-coding, response lookup, classification, and unary-boundary rules without sniffing or undeclared fallback.

**[B — convention]** A processor conforms to **OAPI30-P-04** when it resolves servers and complete target URLs under §10 and security alternatives, credentials, prerequisites, and channel collisions under §11.

**[B — convention]** A synthesizer conforms to **OAPI30-S-01** when it preserves §12.2's binding/transform boundary, emits §6.2's targetless unconstrained dependencies, accounts every lossy or non-equivalent Schema Object translation as coverage loss, and reports complete coverage under Core OBI-B-02.

**[B — exclusion]** Every exclusion in this document is permanent under `openbindings.openapi-3.0@1`, belongs to the smallest owner stated beside it, and reopens only on its stated incorporated-authority trigger; no exclusion promises later work.

## 13. Normative references

- [OpenAPI Specification 3.0.0](https://spec.openapis.org/oas/v3.0.0.html)
- [OpenAPI Specification 3.0.1](https://spec.openapis.org/oas/v3.0.1.html)
- [OpenAPI Specification 3.0.2](https://spec.openapis.org/oas/v3.0.2.html)
- [OpenAPI Specification 3.0.3](https://spec.openapis.org/oas/v3.0.3.html)
- [OpenAPI Specification 3.0.4](https://spec.openapis.org/oas/v3.0.4.html)
- [YAML 1.2.2](https://yaml.org/spec/1.2.2/)
- [JSON Reference draft-03](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03)
- [RFC 1866](https://www.rfc-editor.org/rfc/rfc1866)
- [RFC 2046](https://www.rfc-editor.org/rfc/rfc2046)
- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119)
- [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)
- [RFC 4648](https://www.rfc-editor.org/rfc/rfc4648)
- [RFC 5789](https://www.rfc-editor.org/rfc/rfc5789)
- [RFC 6265](https://httpwg.org/specs/rfc6265.html)
- [RFC 6570](https://www.rfc-editor.org/rfc/rfc6570)
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
