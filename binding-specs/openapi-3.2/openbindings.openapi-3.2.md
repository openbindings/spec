# `openbindings.openapi-3.2` Binding Specification

## 1. Identifier and rule labels

**[B — convention]** The opaque binding-specification identifier has exactly the spelling **`openbindings.openapi-3.2@1`**.

**[C]** Publication mints §1's identifier under Core [OBI-B-01](../../openbindings.md#104-binding-specification-rules), and an incompatible change to the accepted domain or portable meaning requires a different identifier under Core [OBI-B-03](../../openbindings.md#104-binding-specification-rules).

**[A]** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) only when they appear in all capitals.

**[B — convention]** Every normative paragraph and normative table row carries one visible provenance label: **A** is derived from incorporated authority and cites it, **C** is derived from the OpenBindings Core, and **B** is this specification's explicitly classified bridge (`convention`, `pin`, `configuration point`, `exclusion`, or `limit`). A `convention` is a choice this specification makes where no authority speaks; a `pin` fixes one reading of an ambiguous or versioned authority; a `configuration point` names a decision deferred to the consumer; an `exclusion` removes something from the accepted surface behind a stated reopen trigger; a `limit` states a boundary this specification does not cross.

## 2. Scope and incorporated authorities

**[B — convention]** This binding specification defines how OpenAPI 3.2 artifacts govern OpenBindings sources: which documents are accepted and when loading refuses, how operation targets are addressed and synthesized, what an invocation's inputs and outputs mean, and which wire mechanics the artifact fixes. It builds on the OpenBindings Core specification (`../../openbindings.md`).

**[A]** OpenAPI Specification (OAS) edition [`3.2.0`](https://spec.openapis.org/oas/v3.2.0.html) defines the required `openapi` field as the semantic-version string `3.2.0` identifying that edition ([OAS 3.2.0 §§2.1, 4.1.1](https://spec.openapis.org/oas/v3.2.0.html#oas-version)).

**[B — convention]** This specification accepts exactly that one edition; no wildcard, range, or compatible-looking `openapi` value widens the closed accepted domain.

**[B — convention]** OAS governs the artifact and every HTTP mechanic it declares, including object structure, reference resolution, parameter serialization, media declarations, server selection, responses, and security ([OAS 3.2.0 §4](https://spec.openapis.org/oas/v3.2.0.html#objects-and-fields)); [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) governs the remaining HTTP semantics.

**[C]** This document defines portable binding meaning, not an invocation API: request objects, retry and redirect APIs, cancellation, credential acquisition, receiver deployment, and dependency composition remain runtime or application concerns under Core [§1.2](../../openbindings.md#12-out-of-scope).

## 3. Source carriage and refusal architecture

### 3.1 Accepted representations

**[B — convention]** `content` is either the parsed OpenAPI document object or string content; `location` is an absolute URI for the OpenAPI document; content has primacy, a co-present location supplies its retrieval URI, and the OBI retrieval URI is never an OpenAPI base (Core [§5.4](../../openbindings.md#54-sources), [§7](../../openbindings.md#7-reference-resolution)).

**[B — pin]** String content MUST parse as YAML 1.2.2, of which JSON is a subset; duplicate mapping keys, non-scalar-string mapping keys, explicit tags outside YAML's JSON-compatible tag set, resolved values with no JSON image (`.inf`, `-.inf`, `.nan`), and a multi-document YAML stream refuse at this grammar gate. Exactly one YAML document is accepted ([YAML 1.2.2 §§3.2.1, 10.2.1, 10.3.2](https://yaml.org/spec/1.2.2/)).

**[B — pin]** Plain-scalar tag resolution uses YAML 1.2.2's recommended Core schema — the resolution the preceding rule's `.inf`/`.nan` parentheticals already presuppose — and no other resolution schema is consulted ([YAML 1.2.2 §10.3.2](https://yaml.org/spec/1.2.2/#1032-tag-resolution)).

**[B — pin]** A leading byte-order mark on string content is accepted and consumed by the YAML grammar; it is never part of the document.

**[A]** YAML processing follows OAS 3.2's RFC 9512-based JSON-compatibility regime: YAML 1.2 with RFC 9512 constraints is RECOMMENDED, and authors SHOULD NOT rely on YAML constructs that cannot be represented in the JSON data model ([OAS 3.2.0 §§3, 3.1](https://spec.openapis.org/oas/v3.2.0.html#json-and-yaml-compatibility)).

**[A]** The root MUST be a JSON object and MUST carry OAS's required string-valued `openapi` field ([OAS 3.2.0 §§3, 4.1.1](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields)).

**[B — convention]** An absent field or any value other than §2's exact `3.2.0` refuses at the edition load gate.

### 3.2 Closed load gates and confined defects

**[B — convention]** Defect outcomes use a fixed vocabulary: a source **refuses at load** only at §3.2's gates; a declaration defect **excludes** its smallest owning unit from synthesis and selection; an addressable target whose use requires a missing choice or unsupported alternative is **unusable** and **refuses before dispatch** when invoked; a wire fact this specification cannot represent faithfully is a **loud protocol error**; and synthesis reports every exclusion and inexpressible declaration as **coverage loss**.

**[B — convention]** A **lane** is one media-selected value-to-bytes serialization path—JSON, character-data, raw-octet, form, multipart, and this line's other incorporated forms—and the **smallest media owner** is the narrowest declared unit that owns a defective lane.

**[B — limit]** The load gates are the following closed ordered set: accepted-representation grammar, scalar/tag/key resolution, JSON-object root shape, and exact edition discrimination; no condition outside this set is a load gate.

**[B — limit]** After those gates pass, and apart from §5.2's named source-scope dialect exclusion, a defect confines to the smallest selected unit that owns it; an unreachable defect destroys no target, and a whole source refuses only when every position that could contain an addressable target is defective so that no conformant selector can resolve.

**[A]** A conforming artifact that declares no operation target is accepted and synthesizes no operation: the Paths Object and each Path Item Object may be empty, and the root may instead contain `components` or `webhooks` ([OAS 3.2.0 §§4.1.1, 4.8, 4.9](https://spec.openapis.org/oas/v3.2.0.html#openapi-object)).

**[A]** An OpenAPI Object MUST contain at least one of `components`, `paths`, or `webhooks`; a root omitting all three is upstream-invalid, unlike any present-but-empty surface above ([OAS 3.2.0 §4.1.1](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields)).

**[B — limit]** Because that three-field omission leaves no position that could contain an addressable target, it triggers §3.2's whole-source refusal rule after the load gates; it is not a fifth load gate and does not reach a valid present-but-empty surface.

**[B — limit]** A target that is addressable but unusable because of a missing choice, unsupported alternative, or exclusion refuses at invocation or is reported as synthesis coverage loss; it never becomes a whole-source load refusal.

**[B — limit]** §5.2's root `jsonSchemaDialect` exclusion is this revision's only source-scope exclusion: unlike the [`include`/`mount` filtering surface of `openbindings.usage@1`](../usage/openbindings.usage.md#3-accepted-source-representations), no other source member or addressable target is filtered merely by its position in the source.

**[B — limit]** An unknown non-extension field creates no binding behavior and confines as an unsupported field at the smallest selected owner that depends on it; an unused unknown field affects no target. An `x-` specification extension remains an inert annotation under this identifier, and no unknown member is guessed into a fixed or patterned field ([OAS 3.2.0 §5](https://spec.openapis.org/oas/v3.2.0.html#specification-extensions)).

**[B — convention]** A root `swagger` member co-present with this specification's conforming `openapi` value is such an unknown non-extension root member: it is inert, gates nothing, and cedes the document to no sibling specification.

## 4. `location`, `content`, and composition

**[C]** A present `location` MUST be an absolute URI addressing the OpenAPI document itself; a bare filesystem path is not conformant (Core [OBI-D-05](../../openbindings.md#102-document-rules)).

**[B — convention]** When a processor elects to retrieve from that `location` — always, for a location-only source — the dereference MUST yield an accepted representation; a co-present `content` remains the interpreted artifact and is never silently replaced (Core [§5.4](../../openbindings.md#54-sources)).

**[B — convention]** A present `content` MUST be one of §3.1's two representations, and no other JSON type is accepted.

**[A]** A present root `$self` establishes the document's self-assigned URI and OpenAPI-description base; a relative `$self` first resolves against the next available RFC 3986 base, ordinarily the retrieval URI supplied by `location`. Without `$self`, that retrieval URI is the ordinary document base ([OAS 3.2.0 §§4.1.1, 4.1.2.2.1](https://spec.openapis.org/oas/v3.2.0.html#establishing-the-base-uri)).

**[A]** Relative non-Schema references then use the document base; Schema Object references use the nearest schema-resource base established by `$id`; JSON or YAML document fragments are JSON Pointers ([OAS 3.2.0 §§4.1.2.1, 4.1.2.2](https://spec.openapis.org/oas/v3.2.0.html#relative-references-in-api-description-uris)).

**[B — convention]** Embedded content without a co-present `location` MUST establish every needed base through an absolute `$self`, absolute schema identifiers, or other self-contained references; a location-only source uses its location as the retrieval URI (Core [§7](../../openbindings.md#7-reference-resolution)).

## 5. References, dialects, and confinement

### 5.1 Reference semantics

**[A]** A reference composes its target plus the transitive closure of references reachable from that target, not unrelated material in the same retrieved document; every provided possible OAD document MUST be fully parsed before a selected reference is deemed unresolvable ([OAS 3.2.0 §§4.1.2, 4.1.2.1](https://spec.openapis.org/oas/v3.2.0.html#parsing-documents)).

**[A]** A referenced document need not itself be a conforming OpenAPI Document: an OAD document may instead have a Schema Object at its root, and documents are assumed to have either an OpenAPI Object or Schema Object root unless otherwise specified. When a target document declares `$self`, references to that document MUST use the `$self` identity; a reference to a Schema Object beneath an `$id` boundary MUST use the nearest such `$id` rather than cross the resource boundary with another base plus JSON Pointer ([OAS 3.2.0 §§4.1.1–4.1.2, Appendix F.1](https://spec.openapis.org/oas/v3.2.0.html#base-uri-within-content)).

**[B — exclusion]** A selected reference that reaches a document with neither admitted root, uses a retrieval alias despite a declared `$self`, or crosses a nearer `$id` resource boundary noncanonically is unresolvable under this binding; §5.1's table confines the loud consequence, and no private alias fallback applies. The exclusion reopens only if incorporated authority admits the exact root or reference form.

**[B — pin]** A secondarily retrieved reference document's bytes decode as UTF-8 and pass the same grammar gate as §3.1 string content; the retrieval's `Content-Type` and any charset parameter are never consulted.

**[B — convention]** When one JSON or YAML node is reached from reference positions requiring different OAS Object types, each reference context interprets the node independently as its own required Object type; this is the deterministic choice within OAS's implementation-defined multi-context license ([OAS 3.2.0 Appendix G.2](https://spec.openapis.org/oas/v3.2.0.html#conflicts-between-field-types-and-reference-contexts)).

**[A]** A Schema Object `$ref` is the JSON Schema applicator and its siblings remain meaningful; a Reference Object has only its fixed `$ref`, `summary`, and `description` fields, and every added property is ignored ([OAS 3.2.0 §§4.23, 4.24](https://spec.openapis.org/oas/v3.2.0.html#reference-object)).

**[A]** Reference traversal MUST detect and handle cycles without resource exhaustion ([OAS 3.2.0 §6.6](https://spec.openapis.org/oas/v3.2.0.html#handling-reference-cycles)).

**[B — convention]** A cyclic but resolvable graph is legitimate: cycle detection terminates traversal and is not itself a refusal.

**[B — exclusion]** When a selected Path Item carries `$ref`, the selected operation target is excluded only if a fixed field used by that target appears in both the referenced Path Item and its adjacent declaration, because OAS defines that collision as undefined. `Used by that target` means the selected method field plus the Path Item's `parameters` and `servers`; documentation fields never collide for this purpose. Collisions confined to unused fields and all non-colliding adjacent fields leave the target usable, and the exclusion reopens only if an incorporated OAS edition defines the collision ([OAS 3.2.0 §4.9.1](https://spec.openapis.org/oas/v3.2.0.html#path-item-ref)).

**[A]** The first three reference conditions in the table below are defined by OAS 3.2.0's description-structure and Path Item rules ([OAS 3.2.0 §§4.1.2, 4.9](https://spec.openapis.org/oas/v3.2.0.html#openapi-description-structure)):

| condition |
| --- |
| **[A]** Unresolvable selected Path Item `$ref` |
| **[A]** Unresolvable reference reached by one selected parameter, request body, response, server, or security requirement |
| **[A]** Unresolvable Schema Object or Media Type Object reference reached only by one media alternative |
| **[B — limit]** An unresolvable reference reachable only from an unused description position leaves invocation unaffected; synthesis reports the unrepresented position. |
| **[B — limit]** A defect outside the target-plus-reachable closure has no effect on that target. |

**[B — limit]** In table order, the three authority-backed conditions confine as follows: the referenced Path Item and its operations are unaddressable; the selected operation or its affected declared alternative is unusable while unrelated operations survive; or the affected media alternative is unavailable while sibling alternatives survive.

### 5.2 Schema dialect

**[A]** The supported default Schema Object dialect is `https://spec.openapis.org/oas/3.1/dialect/base`; root `jsonSchemaDialect` changes the document default, and a schema-resource-root `$schema` overrides that default only within its schema resource ([OAS 3.2.0 §§4.24.1, 4.24.7](https://spec.openapis.org/oas/v3.2.0.html#specifying-schema-dialects)).

**[B — pin]** For this identifier, that base-dialect URI is fixed to the official [`2024-11-10` revision](https://spec.openapis.org/oas/3.1/dialect/2024-11-10); a later change in the alias's resolution does not alter this specification.

**[B — exclusion]** A root `jsonSchemaDialect` naming any other URI excludes the whole source because this specification refuses to prove, per source, that no reachable Schema Object depends on that changed default; this exclusion reopens only if that exact dialect becomes incorporated authority.

**[B — exclusion]** A schema-resource-root `$schema` naming any other URI excludes only each selected unit whose reachable closure enters that resource; this exclusion reopens only if that exact dialect becomes incorporated authority.

**[B — convention]** For every lane, style, shape, and member-inspection rule in this document, a **resolved declaration** is obtained by following `$ref` and conjoining every `allOf` branch; for an `anyOf` or `oneOf` choice, a branch whose resolved declaration declares only `null` is skipped, every other branch — a typeless branch included — is a candidate, and the choice supplies a single resolved member declaration only when exactly one candidate remains; `not` and conditional applicators never participate in resolution; and absence of `type` leaves the declaration typeless. A 3.2 `type` array contributes every listed type to the resolved type set. **Declares only X** means that the resolved type set is nonempty and every member is in X. **Admits `string` as its sole non-null type** means that the resolved type set is exactly `{string}` or `{string, null}`.

## 6. Selector and inbound dependencies

### 6.1 Selector

**[B — convention]** `selector` is REQUIRED and has exactly one of two literal spellings: `#/paths/<escaped-path>/<lowercase-method>` for a fixed-field operation, where `<lowercase-method>` is one of `get`, `put`, `post`, `delete`, `options`, `head`, `patch`, `trace`, or `query`; or `#/paths/<escaped-path>/additionalOperations/<METHOD-as-spelled>` for an additional operation. Each map-key segment is escaped once under [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901), and the additional-operation method retains its exact case after that unescaping ([OAS 3.2.0 §4.9.1](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-6)).

**[A]** An `additionalOperations` key MUST be an HTTP method token in the exact capitalization sent on the wire and MUST NOT denote a method represented by a fixed Operation field; the fixed `query` field denotes QUERY under the linked draft target. The OAS document's link text reads draft-08 while its hyperlink target is draft-11 ([OAS 3.2.0 §4.9.1](https://spec.openapis.org/oas/v3.2.0.html#path-item-additional-operations), [RFC 9110 §9.1](https://www.rfc-editor.org/rfc/rfc9110#section-9.1), [HTTP QUERY draft-11](https://www.ietf.org/archive/id/draft-ietf-httpbis-safe-method-w-body-11.html)).

**[B — pin]** Between the displayed draft-08 label and the linked draft-11 target, this specification follows the linked target.

**[B — exclusion]** `additionalOperations` keys compare byte-exactly for map identity and selector resolution; a key that compares ASCII case-insensitively equal to any fixed Operation field name is a declaration defect that excludes only that additional-operation entry. The exclusion reopens only if incorporated authority admits the collision and defines its unique operation mapping.

**[B — pin]** The selector's leading `#` is a literal sentinel: what follows is RFC 6901 §3's string representation of the JSON Pointer, carried literally, escaped once with `~0`/`~1`, and never percent-decoded; the §6 URI-fragment representation is not used. Evaluation follows RFC 6901 §§3–4 and fails unresolvable when the selected operation is absent ([RFC 6901 §§3–4, 6](https://www.rfc-editor.org/rfc/rfc6901#section-3), [OAS 3.2.0 §§4.8, 4.9](https://spec.openapis.org/oas/v3.2.0.html#path-item-object)).

**[B — convention]** After the pointer selects a Path Item, selector evaluation resolves that Path Item's `$ref` before reading the fixed method field or `additionalOperations` entry; this deliberate extra resolution keeps bundled referenced Path Items addressable ([RFC 6901 §4](https://www.rfc-editor.org/rfc/rfc6901#section-4), [OAS 3.2.0 §4.9.1](https://spec.openapis.org/oas/v3.2.0.html#path-item-ref)).

**[A]** An operation remains addressable when it omits `responses`, because `responses` is optional in the 3.2 Operation Object ([OAS 3.2.0 §4.10.1](https://spec.openapis.org/oas/v3.2.0.html#operation-responses)).

**[A]** When `responses` is present, its Responses Object MUST contain at least one response code; a present empty object is upstream-invalid, distinct from valid omission ([OAS 3.2.0 §4.16](https://spec.openapis.org/oas/v3.2.0.html#responses-object)).

**[B — exclusion]** A present empty Responses Object is a declaration defect that excludes only the selected target, before any response or caller value is inspected; omission remains addressable under the preceding rule. The exclusion reopens only if an incorporated OAS edition admits a present empty Responses Object.

### 6.2 Callbacks and webhooks

**[A]** A callback Path Item describes a request initiated by the service and expected responses, while a root webhook describes an incoming request the API consumer may implement; neither is an operation invocable through the addressed parent operation ([OAS 3.2.0 §§4.1.1, 4.10.1, 4.18](https://spec.openapis.org/oas/v3.2.0.html#oas-webhooks)).

**[B — convention]** Synthesis MUST represent every supported callback and webhook operation as a Core dependency with a deterministic slot-derived key and a role-inverted consumed-operation contract: input is the request the service sends and output is the response the service expects (Core [§5.6](../../openbindings.md#56-dependencies)).

**[B — convention]** `Deterministic slot-derived key` requires only that the key be a deterministic function of the declaration slot; its exact spelling is synthesis policy under §12.2 and is not portable binding meaning. The dependency contract's shape is likewise synthesis policy; only the role-inverted input/output meaning above is fixed here.

**[C]** Such a dependency carries no concrete target (Core [§5.6](../../openbindings.md#56-dependencies)).

**[B — convention]** Such a dependency also carries no `bindingSpecs`, because the originating artifact has no authority to constrain the consumer's description format.

**[A]** Callback runtime-expression keys describe service-selected request destinations ([OAS 3.2.0 §§4.18, 4.20.3](https://spec.openapis.org/oas/v3.2.0.html#runtime-expressions)).

**[B — limit]** Dependencies add no invocation behavior to this binding; receiver deployment and dependency composition are permanently outside this operation boundary under this identifier (Core [§1.2](../../openbindings.md#12-out-of-scope)).

## 7. Target interaction and caller envelope

**[B — convention]** Here and below, an **effective** declaration is the declaration that remains after applying the artifact's scope, default, and override rules stated in §§8–10.

**[A]** An addressed operation denotes its declared HTTP method, completed target URL, parameters, optional request body, security requirements, and final HTTP response ([OAS 3.2.0 §4.10](https://spec.openapis.org/oas/v3.2.0.html#operation-object)).

**[B — convention]** The caller-facing correspondence value is exactly `{parameters?: {...}, body?: <one JSON value>}`; absence means not supplied, `body: null` is a supplied JSON null, and the artifact alone determines parameter location and serialization.

**[B — convention]** When every effective parameter name is unique across locations, its caller key is the exact declared name; if any name is repeated across legal locations, the target uses qualified mode for every parameter and each key is `<location>/<RFC6901-escaped-name>`, making the flat map injective without depending on map order.

**[A]** Effective parameter identity is exact name plus location; duplicate effective parameters at the same identity are upstream-invalid, while the same name in different locations denotes distinct parameters ([OAS 3.2.0 §§4.9.1, 4.10.1, 4.12](https://spec.openapis.org/oas/v3.2.0.html#operation-parameters)).

**[B — exclusion]** Duplicate effective parameters at the same identity exclude their smallest owning operation. The exclusion reopens only if an incorporated OAS edition admits duplicate effective parameters at one identity.

**[B — convention]** Legal cross-location duplicates remain independently supplied through the qualified mode above.

**[B — exclusion]** Two effective header parameters whose names differ only by ASCII case exclude the selected target because OAS parameter identity is case-sensitive while HTTP field names are case-insensitive; the wire cannot preserve the distinction. This exclusion reopens only if an incorporated authority defines a wire mapping that preserves such case-distinct declarations ([OAS 3.2.0 §§3.2, 4.12.2.1](https://spec.openapis.org/oas/v3.2.0.html#case-sensitivity), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — convention]** An envelope top-level key other than `parameters` or `body`, a present non-object `parameters` member, or any unknown parameter key refuses before dispatch, regardless of whether a body exists; no unmatched-field passthrough exists.

**[A]** Missing required parameters and a missing `required: true` request body refuse before dispatch; path parameters are always required ([OAS 3.2.0 §§4.12.2.1, 4.13.1](https://spec.openapis.org/oas/v3.2.0.html#parameter-required)).

**[A]** A request body is fully supported where RFC 9110 explicitly defines body semantics; where HTTP discourages content, including GET and DELETE, OAS permits `requestBody` but says its semantics are not well-defined and it should be avoided. TRACE alone is forbidden content: a client MUST NOT send content, so this binding emits no TRACE body under any declaration ([OAS 3.2.0 §4.10.1](https://spec.openapis.org/oas/v3.2.0.html#operation-request-body), [RFC 9110 §9.3.8](https://www.rfc-editor.org/rfc/rfc9110#section-9.3.8)).

**[B — convention]** The binding preserves any supplied declared body in those permitted cases rather than deleting it; a supplied `body` on `trace` refuses as unroutable before dispatch.

## 8. Parameter serialization

### 8.1 Effective declarations and scalar conversion

**[A]** Operation parameters override Path Item parameters only at the same exact name-plus-location identity, and every remaining effective `path`, `query`, `querystring`, `header`, or `cookie` Parameter Object governs its own contribution ([OAS 3.2.0 §§4.9.1, 4.10.1, 4.12.1](https://spec.openapis.org/oas/v3.2.0.html#parameter-locations)).

**[A]** Every effective Parameter Object MUST declare `name` and one of the five admissible `in` values, and MUST use exactly one of `schema` or `content`; a `path` Parameter MUST declare `required: true`, a `querystring` Parameter MUST use `content` and none of the schema-form fields, and a content-form map MUST contain exactly one entry ([OAS 3.2.0 §§4.12.1–4.12.2.3](https://spec.openapis.org/oas/v3.2.0.html#parameter-object)).

**[B — exclusion]** A selected effective Parameter Object violating any constraint in that closed declaration list is a declaration defect that excludes the selected target before caller values are inspected; sibling targets survive. The exclusion reopens only if an incorporated OAS edition removes the violated constraint or defines the malformed form's wire meaning.

**[A]** A Header Parameter whose name ASCII-case-insensitively denotes `Accept`, `Content-Type`, or `Authorization` MUST be ignored ([OAS 3.2.0 §§3.2, 4.12.2.1](https://spec.openapis.org/oas/v3.2.0.html#parameter-name), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — limit]** An ignored Header Parameter creates no effective parameter, caller-envelope key, or emitted field.

**[B — configuration point]** For `schema`-form Parameter serialization and §9.3 Encoding/style serialization of form or multipart property values, `parameterConversion` is the same deterministic consumer-supplied conversion from each supplied JSON boolean or number to a string; strings pass identically, and any supplied boolean or number without a configured conversion refuses before dispatch ([OAS 3.2.0 Appendix B](https://spec.openapis.org/oas/v3.2.0.html#appendix-b-data-type-conversion)).

**[B — configuration point]** This specification defines no partial canonicalization default for `parameterConversion`; the boolean/number conversion rule applies recursively to array members and object values before serialization and MUST be deterministic for every accepted boolean or number, while strings remain identical and null follows §8.2 without entering the converter.

**[B — convention]** Under §7's caller-envelope convention, a present parameter member whose value is JSON null is supplied rather than absent.

**[A]** JSON null is an RFC 6570 undefined value on this line and is not an empty string; for every admitted `style`/`explode` cell, it serializes exactly as the `undefined` column in §8.2's table ([OAS 3.2.0 §4.12.6](https://spec.openapis.org/oas/v3.2.0.html#style-examples), [RFC 6570 §2.3](https://www.rfc-editor.org/rfc/rfc6570#section-2.3)).

### 8.2 Closed `style`, `explode`, and undefined-value table

**[A]** The following table is the complete authority-defined `schema`-form matrix; `operator / source` states the RFC 6570 mapping or other OAS byte source, and each `undefined` entry is the authority's result for a supplied JSON null. For `deepObject`, any explicit `explode` is ignored because the field has no effect ([OAS 3.2.0 §§4.12.2.2, 4.12.3, 4.12.6, Appendix C.1](https://spec.openapis.org/oas/v3.2.0.html#style-values)):

| style | location | admitted shapes | explode | operator / source | undefined serialization |
| --- | --- | --- | --- | --- | --- |
| **[A]** `matrix` | path | primitive, array, object | `false` | `;` | `;name` |
| **[A]** `matrix` | path | primitive, array, object | `true` | `;` plus `*` | `;name` |
| **[A]** `label` | path | primitive, array, object | `false` | `.` | `.` |
| **[A]** `label` | path | primitive, array, object | `true` | `.` plus `*` | `.` |
| **[A]** `simple` | path, header | primitive, array, object | `false` | none | empty serialization |
| **[A]** `simple` | path, header | primitive, array, object | `true` | `*` | empty serialization |
| **[A]** `form` | query, cookie | primitive, array, object | `false` | `?` (`+` when `allowReserved: true`) | `name=` |
| **[A]** `form` | query, cookie | primitive, array, object | `true` | `?` plus `*` (`+` manually when reserved) | `name=` |
| **[A]** `spaceDelimited` | query | array, object | `false` | OAS bytes | `n/a` |
| **[A]** `pipeDelimited` | query | array, object | `false` | OAS bytes | `n/a` |
| **[A]** `deepObject` | query | object with scalar properties | `n/a` — ignored | OAS bytes | `n/a` |
| **[A]** `cookie` | cookie | primitive, array, object | `false` | RFC 6265 bytes | `name=` |
| **[A]** `cookie` | cookie | primitive, array, object | `true` | RFC 6265 bytes | `name=` |

**[B — exclusion]** A selected declaration whose style, location, shape, or explicit `explode` lies outside the table excludes the selected target; on §9.3's Encoding style path, the smallest owner is the selected media alternative rather than the target. A supplied null reaching an authority-undefined `n/a` cell instead refuses that invocation before dispatch at the affected Parameter or Encoding property, without excluding other values admitted by the same cell. These exclusions reopen only if incorporated authority defines the exact missing cell.

**[B — convention]** A null member of a supplied array or object value on an RFC 6570-style path refuses the invocation before dispatch at the affected Parameter or Encoding property; RFC 6570's list model has no member-level undefined value, and this binding invents no serialization.

**[A]** Default style is `form` for query and cookie and `simple` for path and header; default `explode` is `true` for `form` and `cookie` and `false` otherwise; `allowReserved` applies only where the destination/style percent-encodes ([OAS 3.2.0 §4.12.2.2](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-for-use-with-schema)).

**[A]** RFC 6570 serialization MUST use the table's operator, `*` for `explode: true`, and a comma for non-exploded label lists/maps. Multiple regular form-style query parameters share one `?` variable list; separately expanding multiple `?` templates is not conformant ([OAS 3.2.0 Appendix C.1](https://spec.openapis.org/oas/v3.2.0.html#equivalences-between-fields-and-rfc6570-operators)).

**[A]** Because RFC 6570 prefix operators cannot combine, a query mixing regular form expansion with `allowReserved: true` MUST be constructed manually per parameter: reserved-permitting values use reserved expansion, and `[`, `]`, `#`, `&`, `=`, and `+` are pre-percent-encoded where Appendix C requires ([OAS 3.2.0 Appendix C.3–C.4.2](https://spec.openapis.org/oas/v3.2.0.html#non-rfc6570-field-values-and-combinations)).

**[B — convention]** The manual path assembles all present per-parameter contributions into one query component with one leading `?` and `&` between contributions; this assembled result is the single-query rule's equivalent at the authority's construction seam.

**[B — convention]** On both the RFC 6570 path and the manual path, query-contribution order across distinct effective Parameters is not portable meaning.

**[A]** A Parameter name that is not a legal RFC 6570 variable name MUST be percent-encoded before use in the template construction ([OAS 3.2.0 Appendix C.3–C.4.4](https://spec.openapis.org/oas/v3.2.0.html#illegal-variable-names-as-parameter-names)).

**[B — convention]** That variable-name encoding is internal to URL assembly and never changes the exact caller-envelope key defined by §7.

**[A]** For `spaceDelimited`, `pipeDelimited`, and `deepObject`, the exact bytes are the corresponding OAS Style Examples: delimiters and deep-object brackets are percent-encoded, object names and values retain their shown alternation, and no unstated escape convention is added ([OAS 3.2.0 §§4.12.4, 4.12.6](https://spec.openapis.org/oas/v3.2.0.html#style-examples)).

**[B — convention]** Before dispatch, the binding refuses a supplied parameter or property name or scalar value containing its non-RFC style's structural delimiter: U+0020 SPACE for `spaceDelimited`, `|` for `pipeDelimited`, or any of `[`, `]`, `=`, and `&` for `deepObject`; no escape-convention configuration point is offered.

**[B — exclusion]** A compound-capable style is excluded only when its resolved declaration proves an unsupported compound member—an array whose resolved `items` declaration declares only `object` or `array`, or an object with at least one declared property whose resolved declaration declares only `object` or `array`. A typeless resolved member proves no compound shape, a choice that supplies no single resolved member declaration under §5.2 proves no compound shape, and an object declaring no properties proves no compound member, so none triggers this exclusion; in particular, a declaration that still admits a scalar is never excluded, and candidate admission never inspects the supplied runtime value. The rule applies symmetrically to every compound-capable Parameter style and to §9.3's Encoding style path, where the smallest owner is the selected media alternative rather than the target. OAS/RFC 6570 defines no expansion for the excluded cells, so the owning unit is excluded unless an incorporated authority defines that exact cell ([OAS 3.2.0 §§4.12.3, 4.12.6, Appendix C.1](https://spec.openapis.org/oas/v3.2.0.html#style-values), [RFC 6570 §3.2.1](https://www.rfc-editor.org/rfc/rfc6570#section-3.2.1)).

**[B — convention]** Independently of that static admission, a supplied value whose shape exits the admitted style-table cell refuses that invocation before dispatch at the affected Parameter or Encoding property, mirroring the null rule; candidate admission still never inspects the supplied value.

**[A]** The Paths Object MUST NOT contain two templated path keys with equivalent hierarchies but different template names. Within one selected target, every path-template expression MUST have exactly one corresponding effective `path` Parameter, every effective `path` Parameter MUST correspond to exactly one expression, and an expression MUST occur no more than once ([OAS 3.2.0 §§4.8.1–4.8.2, 4.12.2.1](https://spec.openapis.org/oas/v3.2.0.html#path-templating)).

**[B — exclusion]** Either path-key ambiguity or either direction of a path-expression/Parameter mismatch is a declaration defect that excludes the selected target before any caller value is inspected; non-conflicting targets survive. The exclusion reopens only if incorporated authority admits the declaration or defines its unique target mapping.

**[A]** An expanded path value containing unescaped `/`, `?`, or `#` refuses before dispatch ([OAS 3.2.0 §4.8.2](https://spec.openapis.org/oas/v3.2.0.html#path-templating)).

**[A]** Completed URL parsing and percent-decoding follow RFC 3986; `application/x-www-form-urlencoded` query content also parses and percent-decodes under WHATWG URL rules, including unescaped `+` as space, while structural delimiters remain encoded or unencoded exactly as OAS requires ([OAS 3.2.0 §4.12.4](https://spec.openapis.org/oas/v3.2.0.html#url-percent-encoding)).

**[B — pin]** The WHATWG URL edition is this specification's own selection: OAS's living [WHATWG-URL] citation is pinned to the [WHATWG URL Review Draft of 18 August 2026](https://url.spec.whatwg.org/review-drafts/2026-08/), and a later change in the living text does not alter this identifier.

### 8.3 Content-form, querystring, empty, header, and cookie parameters

**[A]** A `content`-form Parameter Object MUST contain exactly one media-type entry; its application value serializes under that entry, and when a non-`querystring` contribution enters a URL the resulting representation is percent-encoded as one parameter value ([OAS 3.2.0 §§4.12.2.3, 4.12.4](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-for-use-with-content)).

**[B — pin]** Percent-encoding a content-form Parameter leaves RFC 3986 unreserved bytes literal and encodes every other UTF-8 byte as uppercase `%HH`; the exact caller-envelope key remains unchanged.

**[A]** One effective `querystring` Parameter is permitted and it is mutually exclusive with every ordinary query Parameter on the operation and Path Item; it MUST use `content`, its declared `name` is not serialized, and its selected media representation supplies the entire query string. For `application/x-www-form-urlencoded`, Encoding Objects apply exactly as for a request body of that media type and the resulting representation receives no further encoding or escaping ([OAS 3.2.0 §§4.12.1, 4.12.2.1](https://spec.openapis.org/oas/v3.2.0.html#parameter-locations), [§4.15.3](https://spec.openapis.org/oas/v3.2.0.html#encoding-the-x-www-form-urlencoded-media-type)).

**[B — exclusion]** More than one effective `querystring` Parameter, or coexistence of one with any ordinary query Parameter on the selected operation or Path Item, is a declaration defect that excludes the selected target before caller values are inspected. The exclusion reopens only if an incorporated OAS edition admits the declaration and defines its unique query construction.

**[B — pin]** For every admitted non-urlencoded `querystring` media lane, the incorporated serialization's bytes are percent-encoded into the query component under the preceding uppercase `%HH` rule; raw insertion is not permitted.

**[B — exclusion]** A `querystring` media entry whose format has no serialization incorporated by this specification excludes only that parameter lane; this exclusion reopens only when a pinned authority incorporated by this specification defines that mapping.

**[B — exclusion]** A `querystring` media entry selecting a sequential form is excluded because a stream as a query component has no defined use; the exclusion reopens only if incorporated authority defines sequential query-component serialization and interaction semantics.

**[A]** For a query parameter with `allowEmptyValue: true`, a supplied empty string emits a present zero-length value; absence still means omitted, the empty string remains distinct from §8.2's undefined null, and this binding infers no schema-validity consequence because OAS leaves that interaction implementation-defined ([OAS 3.2.0 §§4.12.2.1, 4.12.6](https://spec.openapis.org/oas/v3.2.0.html#parameter-allow-empty-value)).

**[A]** Header `schema` serialization performs no URI percent-encoding and adds no automatic quotes; header and `style: cookie` parsing does not decode apparent percent encodings ([OAS 3.2.0 §4.12.2.2](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-for-use-with-schema)).

**[B — pin]** A supplied header value's characters are carried as UTF-8 octets, closing the character-to-octet seam before the field-invalid-byte check below ([RFC 9110 §5.5](https://www.rfc-editor.org/rfc/rfc9110#section-5.5)).

**[B — convention]** A supplied header value containing CR, LF, or another field-invalid byte refuses before dispatch at the affected Parameter ([RFC 9110 §§5.1, 5.5](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[A]** `style: cookie` follows RFC 6265 Cookie syntax: contributions preserve exact names and values, use `; ` between pairs, and apply no percent-encoding or other escaping; values needing escaping MUST arrive already escaped ([OAS 3.2.0 §4.12.3](https://spec.openapis.org/oas/v3.2.0.html#style-values), [RFC 6265](https://httpwg.org/specs/rfc6265.html)).

**[B — convention]** Raw-Cookie and structured-cookie declarations alone exclude nothing. An invocation in which a supplied raw `Cookie` Header Parameter value and any structured cookie contribution—an effective cookie Parameter or selected cookie credential—would both be emitted refuses before dispatch; the binding does not parse or merge the raw string.

**[B — exclusion]** An effective Header Parameter named `Host` or `Content-Length` excludes the target because those fields are processor-owned and cannot be replaced by caller input; the exclusion reopens only if an incorporated HTTP authority defines caller control that preserves the processor's framing and routing obligations.

**[B — exclusion]** A form-style cookie declaration is statically excluded only when its effective `explode` and resolved declaration prove multi-value production: `explode: true` together with a declaration that declares only `array`, or one that declares only `object` with at least one declared property. A typeless or scalar-admitting declaration proves no such production; if a supplied value nevertheless would produce multiple cookie pairs, that invocation refuses before dispatch. OAS identifies form-style multi-value delimiters as unsuitable for Cookie, so the exclusion reopens only if an incorporated OAS edition defines a correct multi-value mapping.

## 9. Request and response media

### 9.1 Media identity, alternatives, and request election

**[A]** Media types parse under RFC 9110: type, subtype, and parameter names compare case-insensitively while parameter values retain their media-defined comparison rules ([RFC 9110 §§8.3.1, 8.3.2](https://www.rfc-editor.org/rfc/rfc9110#section-8.3.1)).

**[B — convention]** A **concrete media type** has no wildcard in either its type or subtype; media-type parameters do not affect concreteness.

**[B — convention]** A declaration matches a concrete media type only when every declared parameter is present with an equal value; matches order by exact type/subtype before `type/*` before `*/*`, then by greatest declared-parameter count, and equal-specificity ties refuse.

**[B — limit]** Distinct content-map keys that normalize to one parsed media identity collide only for that identity and refuse selection through it; non-colliding entries survive, and map order never breaks the tie.

**[A]** A no-body invocation bypasses request-body media selection and emits neither a body nor `Content-Type`, because an absent optional Request Body contributes no HTTP content ([OAS 3.2.0 §§4.10.1, 4.13.1](https://spec.openapis.org/oas/v3.2.0.html#request-body-object)).

**[B — configuration point]** A body-emitting invocation preserves every admissible declared request alternative: exactly one usable concrete entry — one not excluded by this specification's confinement rules — selects itself; every other map, including two or more usable entries or a concrete declaration alongside a usable range, requires a concrete `requestMedia` choice before input consumption; the choice MUST match under §9.1 and never substitutes another declaration's schema, and supplied values never elect.

**[B — configuration point]** A missing required choice, unmatched or ambiguous choice, unsupported selected lane, or body-emitting invocation with no admissible candidate refuses before dispatch; no body bytes, media registry entry, or examples are sniffed to select a lane.

**[A]** A content-map Media Type Object or `components.mediaTypes` reference MUST resolve before lane selection ([OAS 3.2.0 §§4.7.1, 4.14.1](https://spec.openapis.org/oas/v3.2.0.html#media-type-object)).

**[B — limit]** Examples create no operation input or output member and never select a declaration, carriage lane, or media type; their data-versus-serialized distinction is descriptive at this boundary ([OAS 3.2.0 §4.19](https://spec.openapis.org/oas/v3.2.0.html#example-object)).

**[B — limit]** The live OpenAPI Media Type Registry does not widen this pinned identifier: OAS makes support for later registry additions optional, so only media behavior defined by incorporated pinned authority is available ([OAS 3.2.0 §4.14.2.1](https://spec.openapis.org/oas/v3.2.0.html#openapi-media-type-registry)).

**[B — convention]** The binding sends no `Accept` header: OAS ignores a Header Parameter named `Accept`, request-body content declares what the operation consumes, and response content supplies no portable instruction to advertise a preference ([OAS 3.2.0 §§4.12.2.1, 4.13, 4.17](https://spec.openapis.org/oas/v3.2.0.html#parameter-name)).

### 9.2 Common carriage lanes

**[A]** A non-sequential exact `application/json` or `+json` selection serializes the supplied value as strict JSON on requests and parses strict JSON on responses; JSON text uses UTF-8 ([RFC 6839 §3.1](https://www.rfc-editor.org/rfc/rfc6839#section-3.1), [RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)).

**[B — pin]** [RFC 6839 §3.1](https://www.rfc-editor.org/rfc/rfc6839#section-3.1) is the incorporated `+json` suffix authority; where its registration inherits RFC 4627's UTF-16/UTF-32 latitude, [RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)'s UTF-8 requirement governs this lane.

**[B — pin]** Strict JSON is RFC 8259's grammar under this profile: parsing resolves duplicate object member names by taking the lexically last member, the documented common receiver behavior inside RFC 8259 §4's permitted set; a leading byte-order mark on a JSON body is ignored under RFC 8259 §8.1's parser latitude and is never part of the value; and a lone surrogate escape yields no value — it is a loud protocol error, because neither silent replacement nor invalid passthrough preserves the supplied text ([RFC 8259 §§4, 8.1–8.2](https://www.rfc-editor.org/rfc/rfc8259#section-4)).

**[B — limit]** JSON-lane numbers are interoperable within RFC 8259 §6's binary64 expectation; precision or range beyond it is not preserved across this lane, and that disclosed reduction is the only permitted deviation from the supplied mathematical value ([RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259#section-6)).

**[B — convention]** `text/json` is not a member of that JSON lane; as a `text/*` type it can use the character-data lane only when its resolved declaration admits `string` as its sole non-null type. This convention reopens under a new identifier only if the IANA media-type registry registers `text/json` with JSON semantics.

**[B — convention]** A concrete character-data selection governed by a resolved declaration that admits `string` as its sole non-null type carries a supplied string under its declared `charset`, defaulting to UTF-8; `type: ["string", "null"]` therefore selects this lane for its string branch, while a supplied null refuses before dispatch because the lane defines no null lexical form. Response decoding emits a string and never invents null. The closed character-data set is `text/*`, `application/xml`, and `+xml`, while `application/json`, `+json`, and §9.5's sequential forms are claimed by their own lanes. The binding does not consult the live media-type registry's `Encoding considerations`: `application/json` is registered as binary despite requiring UTF-8 text, `text/csv` records no value, and a live lookup would violate this pinned, immutable reading ([RFC 6838 §4.2.1](https://www.rfc-editor.org/rfc/rfc6838#section-4.2.1), [RFC 2046 §4.1](https://www.rfc-editor.org/rfc/rfc2046#section-4.1), [RFC 7303 §§3, 9](https://www.rfc-editor.org/rfc/rfc7303#section-3), [RFC 8259 §§8.1, 11](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)).

**[B — pin]** This binding is an XML-unaware MIME consumer in RFC 7303 §3's own terms — it processes XML media as opaque character data, never as parsed XML — and the charset parameter is the only character-encoding source this lane consults: consulting a BOM or XML declaration would require inspecting body bytes, which this binding never sniffs, so a charset-less non-UTF-8 XML response refuses rather than being sniffed, and every unsupported or invalid character decoding likewise refuses ([RFC 7303 §3.2](https://www.rfc-editor.org/rfc/rfc7303#section-3.2)).

**[B — pin]** The UTF-8 default charset displaces RFC 2046 §4.1.2's US-ASCII default for `text/*`: RFC 9110 §8.3.2 leaves charset semantics to each media type's registration rather than restating a MIME-era default, and this binding pins the modern-HTTP UTF-8 reading, disclosed here as a deliberate displacement ([RFC 2046 §4.1.2](https://www.rfc-editor.org/rfc/rfc2046#section-4.1.2), [RFC 9110 §8.3.2](https://www.rfc-editor.org/rfc/rfc9110#section-8.3.2)).

**[B — limit]** UTF-8 decoding MUST be supported; any further charset is an implementation capability whose absence refuses loudly.

**[A]** OAS 3.2 describes raw binary with a typeless resolved declaration ([OAS 3.2.0 §§4.13.2, 4.24.4.2, 4.24.4.3](https://spec.openapis.org/oas/v3.2.0.html#working-with-binary-data)).

**[B — convention]** A non-JSON, non-form concrete selection whose Media Type Object omits `schema`, or whose present resolved declaration is typeless, uses the raw-octet lane. A schema-omitted media range does not gain this lane because it declares no single concrete representation.

**[A]** Every other keyword in a typeless resolved declaration still applies, and `maxLength` on raw content measures wire octets rather than the Base64 boundary string ([OAS 3.2.0 §§4.14.3.2, 4.24.4.3](https://spec.openapis.org/oas/v3.2.0.html#binary-streams)).

**[C]** Invoking this binding does not trigger validation of any application value, including a mixed binary instance, against its governing Schema Object, and this binding elects no binary-validation technique; only a tool that separately claims validation owes Core's validation rules (Core [invariant 2](../../openbindings.md#2-core-invariants), [OBI-T-16](../../openbindings.md#103-tool-rules)).

**[A]** A tool that does claim such mixed binary-instance validation may use either technique OAS licenses—substituting a placeholder value, with the stated conditional-schema hazards, or decomposing through `properties`, `prefixItems`, and related subschemas ([OAS 3.2.0 §4.24.4.3.1](https://spec.openapis.org/oas/v3.2.0.html#schema-evaluation-and-binary-data)).

**[A]** A resolved declaration that admits `string` as its sole non-null type with `contentEncoding` carries the caller's artifact-encoded string as text and does not trigger OpenBindings Base64 decoding; `contentMediaType` is ignored when it contradicts the governing Media Type or Encoding Object, and schema encoding is distinct from HTTP `Content-Encoding` ([OAS 3.2.0 §4.24.4.3](https://spec.openapis.org/oas/v3.2.0.html#working-with-binary-data)).

**[A]** For a non-JSON text serialization, OAS requires the schema inspection represented by §5.2's resolved declaration and, when available, inspection of validated runtime data; a typeless declaration permits all types, and OAS leaves the result implementation-defined when those sources do not determine one type ([OAS 3.2.0 §4.24.4.2](https://spec.openapis.org/oas/v3.2.0.html#non-json-data)).

**[B — convention]** For this binding, `validated runtime data` means the supplied JSON value's own type; no validation is implied or performed. That supplied type resolves the determination when it identifies one permitted non-JSON serialization type.

**[B — pin]** After that type determination, a boolean serializes as exactly `true` or `false`; a number uses the shortest RFC 8259 number spelling denoting the same mathematical value, with ties preferring non-exponent form, lowercase `e` without `+` or leading exponent zeros, and `0` for zero including negative zero. The mathematical value is the supplied JSON number's exact value under Core's RFC 8259 model, with no binary64 reduction ([RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259#section-6), Core [§5](../../openbindings.md#5-document-model)).

**[B — limit]** If type ambiguity remains after §5.2 resolution and inspection of the supplied JSON value's own type when available, the invocation or response decoding fails rather than choosing one privately.

**[B — pin]** Every OpenBindings raw-octet value is a JSON string containing canonical RFC 4648 §4 Base64: standard alphabet, required padding, no ignored non-alphabet characters, and zero unused pad bits; requests decode before dispatch and responses encode the exact octets ([RFC 4648 §§3.3, 3.5, 4](https://www.rfc-editor.org/rfc/rfc4648)).

**[B — exclusion]** This specification does not generate XML from an object model because OAS 3.2 still leaves ordinary object-node order undefined and null serialization implementation-defined and identifies adjacent text nodes as ambiguous; the selected media alternative is excluded until incorporated authority defines those remaining bytes, while string and raw-octet XML carriage remain admitted ([OAS 3.2.0 §§4.26.1, 4.26.2.2, 4.26.5](https://spec.openapis.org/oas/v3.2.0.html#xml-object)).

**[B — convention]** Because `readOnly` and `writeOnly` are annotations whose enforcement OAS leaves to the application, this binding never uses them to delete a supplied wire member or synthesize an absent one ([OAS 3.2.0 §4.24.5.2](https://spec.openapis.org/oas/v3.2.0.html#validating-readonly-and-writeonly)).

**[B — exclusion]** A concrete request or response selection admitted by none of the JSON, character-data, raw-octet, string XML carriage under §9.2's XML rule, request-only form and multipart, sequential, or other explicitly incorporated lanes is excluded at its smallest media owner because OAS supplies no value-to-bytes mapping; the exclusion reopens only if an incorporated authority defines that media/data-form cell.

### 9.3 Form bodies, multipart parts, and Encoding Objects

**[A]** A Media Type Object's `encoding` is ignored outside `application/x-www-form-urlencoded` and `multipart` media, while `prefixEncoding` and `itemEncoding` are ignored outside `multipart`; an ignored field creates no binding behavior ([OAS 3.2.0 §4.14.5](https://spec.openapis.org/oas/v3.2.0.html#encoding-usage-and-restrictions)).

**[A]** `application/x-www-form-urlencoded` and name-based `multipart` serialization map object properties through the governing Schema and Encoding Objects; array properties repeat the same name in item order, cross-property pair order is implementation-defined, and an `encoding` key with no corresponding property is ignored ([OAS 3.2.0 §4.14.5.1](https://spec.openapis.org/oas/v3.2.0.html#encoding-by-name)).

**[B — exclusion]** The form and multipart lanes are request-only: the incorporated authority's form and multipart sections are request-scoped by their own headings and supply no reverse mapping from those bytes to an application value, so a response selection of either lane is excluded at its smallest media owner. The exclusion reopens only if an incorporated authority defines that decoding.

**[B — limit]** Repeated-name form decoding therefore does not arise under this identifier: the form and multipart lanes have no response direction.

**[B — convention]** A supplied `body: null` against a form or multipart object declaration refuses before dispatch: neither lane defines a null lexical form, mirroring §9.2's character-data rule.

**[B — exclusion]** A media alternative whose Encoding-style serialization generates one wire name from two declared sources — an exploded nested property colliding with a sibling top-level property — is excluded; the exclusion reopens only if an incorporated authority defines the collision's unique decoding.

**[A]** Encoding `style`, `explode`, and `allowReserved` controls apply only to form-urlencoded and multipart/form-data; explicit presence of any control selects the §8.2 style path and ignores `contentType`, while absence of all three selects content-based encoding under the explicit or default `contentType` ([OAS 3.2.0 §§4.15.1.1, 4.15.1.2](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-for-rfc6570-style-serialization)).

**[A]** Outside `application/x-www-form-urlencoded` and `multipart/form-data`, Encoding `style`, `explode`, and `allowReserved` are ignored and create no binding behavior ([OAS 3.2.0 §4.15.1.2](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-for-rfc6570-style-serialization)).

**[A]** Form-urlencoded content uses the August 2026 WHATWG URL Review Draft algorithm after each complex value is serialized; its style path removes RFC 6570's leading `?`. Multipart style serialization places names in `Content-Disposition`, values in part bodies, applies no URI percent-encoding, and gives `allowReserved` no effect ([OAS 3.2.0 §§4.12.4, 4.15.3, Appendix C](https://spec.openapis.org/oas/v3.2.0.html#encoding-the-x-www-form-urlencoded-media-type), [WHATWG URL Review Draft, 18 August 2026](https://url.spec.whatwg.org/review-drafts/2026-08/)).

**[A]** Encoding `contentType` defaults are exactly: a typeless resolved declaration or one that admits `string` as its sole non-null type with `contentEncoding` → `application/octet-stream`; plain string, number, integer, or boolean → `text/plain`; object or array → `application/json`. An explicit single concrete value fixes the part type ([OAS 3.2.0 §4.15.1.1](https://spec.openapis.org/oas/v3.2.0.html#common-fixed-fields-0)).

**[B — convention]** That default determination is declaration-keyed: the authority's table keys on the resolved declaration — its `type: absent` row proves the key is the schema, since a runtime value cannot lack a type — so §9.2's supplied-type rule does not reach this determination. A multi-type resolved set determines no default; the no-default refusal below and the `propertyMedia` requirement extend to it.

**[B — convention]** After content-based form encoding selects an explicit concrete `contentType` or determines its default, a supplied null property is elided as an omitted optional member and contributes neither a form-urlencoded field nor a multipart part; this rule is separate from §8.2's style-path handling.

**[B — limit]** That elision identifies `{}` and `{"x": null}` on the wire: a deliberate loss inside the authority's data-type-conversion latitude, disclosed here — the distinction between an absent optional member and an explicit null does not survive this lane ([OAS 3.2.0 Appendix B](https://spec.openapis.org/oas/v3.2.0.html#appendix-b-data-type-conversion)).

**[B — convention]** A supplied null positional multipart item refuses before dispatch: positional order forbids elision, and the lane defines no null part form.

**[B — limit]** A supplied null reaching content-based encoding with neither an explicit concrete `contentType` nor a determined default refuses that invocation before dispatch because the authority supplies no part media type; other values and alternatives remain usable, and no private null default is available under this identifier.

**[B — configuration point]** A wildcard or comma-separated multi-valued Encoding `contentType` on a content-based form-urlencoded or multipart property requires `propertyMedia`: one concrete media type per affected property. The choice MUST satisfy one declared member under §9.1, and an absent, unmatched, or ambiguous required choice refuses before dispatch.

**[A]** A part whose resolved declaration admits `string` as its sole non-null type with `contentEncoding` remains artifact-encoded text. For multipart, that `contentEncoding` declares the equivalent `Content-Transfer-Encoding` header on the part, and an explicit Encoding header whose resolved declaration disallows the value makes both serialization and parsing undefined ([OAS 3.2.0 §§4.15.4.2, 4.24.4.3](https://spec.openapis.org/oas/v3.2.0.html#content-transfer-encoding-and-contentencoding)).

**[B — convention]** A part with a typeless resolved declaration uses the raw-octet lane and §9.2's canonical Base64 boundary.

**[B — convention]** A multipart part with such `contentEncoding` emits the equivalent `Content-Transfer-Encoding` header.

**[B — exclusion]** Such an explicit Encoding-header contradiction excludes the affected multipart field, not the whole media alternative. A body-emitting invocation that reaches the field refuses before dispatch, parsing that reaches it fails loudly, and synthesis reports that field as excluded coverage loss; unaffected fields and media alternatives remain available. The field exclusion reopens only if incorporated authority defines both serialization and parsing for the contradiction.

**[A]** Name-based `encoding` is mutually exclusive with `prefixEncoding` and `itemEncoding`. Positional encoding applies only to `multipart`, requires `itemSchema` or an array `schema`, models one part per array item in order, applies each `prefixEncoding` entry to its corresponding position, ignores surplus prefix entries, and applies `itemEncoding` to every remaining item ([OAS 3.2.0 §§4.14.1, 4.14.5.2](https://spec.openapis.org/oas/v3.2.0.html#encoding-by-position)).

**[B — limit]** A violation of those mutual-exclusion or positional-prerequisite rules makes only the selected media alternative unavailable; sibling alternatives and unrelated targets survive under §3.2's confinement rule.

**[A]** Positional `multipart/form-data` has no property name to infer part names; each applicable Encoding Object therefore MUST declare a `Content-Disposition` header supplying the part name, and the binding never invents one ([OAS 3.2.0 §4.14.5.3](https://spec.openapis.org/oas/v3.2.0.html#additional-encoding-approaches), [RFC 7578 §4.2](https://www.rfc-editor.org/rfc/rfc7578#section-4.2)).

**[A]** An Encoding `headers` map is ignored outside `multipart`, and a `Content-Type` entry in that map is ignored even for multipart ([OAS 3.2.0 §4.15.1.1](https://spec.openapis.org/oas/v3.2.0.html#common-fixed-fields-0)).

**[B — convention]** Non-ignored Encoding `headers` keys that differ only by ASCII case refuse that media alternative's selection, because HTTP field names are case-insensitive and the wire cannot preserve the distinction.

**[B — convention]** A part-header value is fixed completely by the artifact only when its resolved declaration admits exactly one value through `const` or a single-member `enum`; `default` and examples do not fix a value.

**[B — limit]** Non-ignored Encoding `headers` are descriptive at this operation boundary and produce no caller channel: the binding emits only such an artifact-fixed header value, plus §9.3's `contentEncoding`-declared equivalent `Content-Transfer-Encoding`, and never emits any other undeclared header; a positional form-data name or other required part header without that exact-value proof leaves the selected alternative unavailable.

**[A]** An Encoding Object's nested `encoding`, `prefixEncoding`, and `itemEncoding` fields apply recursively, and every processor MUST support one level of nesting ([OAS 3.2.0 §4.15.2](https://spec.openapis.org/oas/v3.2.0.html#nested-encoding)).

**[B — exclusion]** A selected media alternative requiring more than one nested Encoding level is excluded because OAS makes deeper support optional; the exclusion belongs only to that alternative and reopens only if an incorporated authority requires the deeper level.

### 9.4 HTTP content codings

**[A]** HTTP `Content-Encoding` is distinct from media type and from Schema Object `contentEncoding`; request codings apply in listed wire order and response codings decode in reverse order before the selected media lane ([RFC 9110 §8.4](https://www.rfc-editor.org/rfc/rfc9110#section-8.4), [OAS 3.2.0 §4.24.4.3](https://spec.openapis.org/oas/v3.2.0.html#working-with-binary-data)).

**[A]** The artifact declaration surfaces are an effective request Header Parameter named `Content-Encoding` and a governing response Header Object of that name; field-name comparison is ASCII case-insensitive ([OAS 3.2.0 §§3.2, 4.12, 4.17](https://spec.openapis.org/oas/v3.2.0.html#header-object), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — exclusion]** Two governing response Header Object keys that differ only by ASCII case and govern binding behavior — the content-coding surface — exclude the smallest owning response alternative before any actual response is inspected; the exclusion reopens only if an incorporated authority defines a wire mapping that preserves such case-distinct declarations.

**[B — configuration point]** `requestContentCodings` and `responseContentCodings` are finite consumer maps from case-insensitive content-coding tokens to deterministic encoders and decoders; on requests the caller-supplied effective `Content-Encoding` Header Parameter value fixes the encoder stack, while on responses the actual value governed by the Response Header Object fixes the decoder stack, and no configuration preference narrows either declared surface.

**[B — configuration point]** An unsupported token, a field value not admitted by its governing Header declaration, an ambiguous coding declaration, or an actual response coding with no governing Header Object refuses rather than being skipped or sniffed; configuring a codec supplies capability but never declares a coding the artifact omitted.

### 9.5 Sequential media and server-sent events

**[A]** OAS sequential media consist of a repeating structure with no modeled header, footer, envelope, or other metadata; the sequence maps to a JSON array in wire order. This binding incorporates the forms OAS 3.2 itself defines: `application/jsonl`, `application/x-ndjson`, `application/json-seq`, `+json-seq`, `text/event-stream`, and positional `multipart` sequences ([OAS 3.2.0 §§4.14.3.1, 4.14.5.2, 4.14.6.2](https://spec.openapis.org/oas/v3.2.0.html#sequential-media-types), [RFC 7464](https://www.rfc-editor.org/rfc/rfc7464), [RFC 8091](https://www.rfc-editor.org/rfc/rfc8091)).

**[B — exclusion]** A purported sequential media type whose item framing is not defined by incorporated pinned authority is unavailable because neither payload sniffing nor the live media registry may supply missing framing; the exclusion belongs to that selected alternative. The exclusion reopens only if incorporated authority defines the missing framing.

**[B — pin]** Because neither `application/jsonl` nor `application/x-ndjson` is IANA-registered and their describing pages are mutable, their item framing is pinned self-contained here: items are LF-delimited JSON texts, and a CR immediately preceding a delimiting LF is consumed with it; a trailing LF after the final item terminates that item and creates no further item; a final item ended by the end of the stream without a trailing LF is a complete item; and an empty or whitespace-only line is a malformed item under §9.5's malformed-item rule.

**[A]** `schema`, when present, applies to the complete sequence as its ordered JSON array; `itemSchema`, when present, applies independently to each item, and both MAY coexist ([OAS 3.2.0 §§4.14.1, 4.14.3](https://spec.openapis.org/oas/v3.2.0.html#complete-vs-streaming-content)).

**[B — convention]** A sequential request consumes exactly one caller `body` value—the JSON array in media order—so request streaming never changes §7's unary caller-input boundary.

**[A]** Sequential request serialization emits one media item per array element; `schema` governs the complete array and `itemSchema` governs each emitted element ([OAS 3.2.0 §§4.14.3.1, 4.14.3.1.1](https://spec.openapis.org/oas/v3.2.0.html#streaming-sequential-media-types)).

**[B — exclusion]** Sequential request emission is available only for forms whose incorporated authority defines write-direction item serialization. OAS defines post-parse handling and supplies examples for `text/event-stream` but no object-to-event write algorithm, so a `text/event-stream` request-body alternative is excluded; the exclusion belongs only to that alternative and reopens only if incorporated authority defines the missing write mapping.

**[B — convention]** Synthesis determines streaming capability statically from the artifact alone. The capability bound considers every Response Object that could govern a status classified as successful by §9.6 and every media declaration such a response can select; the operation is streaming-capable when at least one admitted success declaration is sequential. This bound is synthesis-reported only and constrains no invocation behavior.

**[A]** A sequential response is server-streaming; `itemSchema` applies independently to each parsed item, while a co-present `schema` remains an aggregate constraint over the complete ordered sequence ([OAS 3.2.0 §§4.14.3.1, 4.14.3.1.1](https://spec.openapis.org/oas/v3.2.0.html#streaming-sequential-media-types)).

**[B — convention]** When §9.6 classifies the final status as successful, each parsed sequential-response item emits one successful operation value in order (Core [§5.1](../../openbindings.md#51-operations)); under a non-successful final status the sequential body is §9.6's failure data like any other body, and no item emits an operation value. An actual response's interaction shape and media are governed only by the Response Object selected for its final status: declarations for every other status affect the static bound above but never change that response from unary to streaming or vice versa.

**[B — convention]** An item whose incorporated sequential framing is malformed, or whose parsed SSE value lacks required string `data`, carries non-string `event` or `id`, or carries a `retry` other than a nonnegative integer, is not emitted and ends the interaction unsuccessfully; earlier emitted values remain successful values. Invocation evaluates neither `itemSchema` nor complete-sequence `schema` conformance: items are emitted as parsed, and only a tool separately claiming validation owes Core's validation rules (Core [invariant 2](../../openbindings.md#2-core-invariants), [OBI-T-16](../../openbindings.md#103-tool-rules)).

**[B — pin]** RFC 7464 §§2.1 and 2.3 permit a parser to continue past a malformed element and equally permit the application to choose termination; this binding is the application, and termination is its pinned choice within that authority-permitted set ([RFC 7464 §§2.1, 2.3](https://www.rfc-editor.org/rfc/rfc7464#section-2.1)).

**[B — convention]** A clean end of stream completes a §9.6-successful line-delimited or JSON-text-sequence interaction successfully, mirroring the SSE clean-close rule below; a final item truncated by that end is a malformed item under the preceding rule; and a transport reset or truncated HTTP message ends the interaction unsuccessfully, with earlier emitted values standing.

**[A]** `text/event-stream` MUST first be parsed under OAS's incorporated event-stream processing rules, including ignored comments and fields, multi-line data combination, and field-specific parsing. Each item is then an object with required string `data`, optional string `event` and `id`, and optional nonnegative integer `retry`; no field is collapsed into a data-only value ([OAS 3.2.0 §§4.14.4, 4.14.6.3](https://spec.openapis.org/oas/v3.2.0.html#special-considerations-for-server-sent-events)).

**[B — pin]** OAS's incorporated event-stream processing rules are a living WHATWG HTML link; this specification pins that link's revision to the [whatwg/html source snapshot at commit 24c5e48bf66ea61bc199ec6338c81258275ba9c6](https://github.com/whatwg/html/blob/24c5e48bf66ea61bc199ec6338c81258275ba9c6/source), and a later change in the living text does not alter this identifier.

**[B — convention]** A server-initiated clean close after zero or more valid SSE items completes a §9.6-successful interaction successfully; it never upgrades a non-successful classification.

**[B — limit]** `retry` crosses the operation-value boundary because the incorporated authority defines it as part of the event data model — OAS's own worked JSON Lines equivalence carries `retry` in the item value; this authority-shaped exception to the rule that transport directives do not become values is not a license to surface other transport directives ([OAS 3.2.0 §4.14.6.3](https://spec.openapis.org/oas/v3.2.0.html#server-sent-event-streams)).

**[B — limit]** Non-sequential media remain unary: one HTTP response body produces at most one operation value under this operation-value boundary ([OAS 3.2.0 §4.14.3](https://spec.openapis.org/oas/v3.2.0.html#complete-vs-streaming-content)).

### 9.6 Response declaration, classification, and decoding

**[A]** Response keys are closed to exact HTTP status codes, the five ranges `1XX` through `5XX`, `default`, and specification extensions; an exact key overrides its matching range ([OAS 3.2.0 §§4.16.1–4.16.3](https://spec.openapis.org/oas/v3.2.0.html#responses-object)).

**[B — exclusion]** A Responses key outside that closed admitted set is a declaration defect that excludes the selected target before any actual response is inspected; the exclusion reopens only if an incorporated OAS 3.2 edition admits that exact key form.

**[B — exclusion]** An upstream-invalid governing Response Object — one that is not a Response Object at all, or one violating the Response Object's fixed-field constraints: a `description` that is not a string, a `content`, `headers`, or `links` value that is not a map, or a `headers` member that is not a Header Object — is a declaration defect that excludes the selected target before any actual response is inspected, because response governance is target-level; the exclusion reopens only if an incorporated OAS 3.2 edition admits the exact declaration ([OAS 3.2.0 §§4.16, 4.17](https://spec.openapis.org/oas/v3.2.0.html#response-object)).

**[B — limit]** The exclusion above reaches only a Response Object that can GOVERN a SUCCESSFUL response: an exact 2xx status key, the `2XX` range key, or `default` when no `2XX` range key is declared — a `2XX` key covers the whole success class, so `default` can then never govern one. A fixed-field violation in a declaration that can never govern a 2xx status loses no representation — a failure body is opaque application-authored failure data under this same section, so nothing the target carries is misdeclared — and therefore does not exclude: a target whose success declarations are intact stays represented. This scope is this specification's reasoning about representation and is identical on all four sibling lines; it must not be confused with the separate, AUTHORITY-owned reason stated below for why an omitted `description` is conformant on this line only ([OAS 3.2.0 §4.16](https://spec.openapis.org/oas/v3.2.0.html#responses-object)).

**[B — limit]** Omission of `description` is not a violation on this line, and the difference from the siblings is the AUTHORITY's rather than this specification's: OAS 3.2.0 drops the `REQUIRED` marker that OAS 3.0.4 and OAS 3.1.2 carry on the Response Object's `description`, and adds an optional `summary` beside it, so a governing Response Object that omits `description` is conformant here and governs normally, with or without declared content. The same omission is an upstream-invalid Response Object on the 3.0 and 3.1 lines and excludes the selected target there. What OAS 3.2.0 still fixes is the KIND: `description` is typed `string`, so one present with a non-string value is a fixed-field violation and excludes as above. Read this as an edition difference, never as sibling drift ([OAS 3.2.0 §4.17.1](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-14), against [OAS 3.0.4 §§4.7.16, 4.7.17](https://spec.openapis.org/oas/v3.0.4.html#response-object) and [OAS 3.1.2 §4.8.17.1](https://spec.openapis.org/oas/v3.1.2.html#response-object)).

**[B — convention]** The governing Response Object lookup order is exact status, then the single matching range, then `default`; range-over-default is this specification's reading, and declarations never reclassify the native status.

**[A]** RFC 9110 defines the 2xx class as successful ([RFC 9110 §15.3](https://www.rfc-editor.org/rfc/rfc9110#section-15.3)).

**[B — convention]** For this binding, success means that the final status—the status after any interim responses and any redirects the runtime chose to follow with the bound method and complete body preserved—is in that 2xx class; a method-rewriting redirect is the final response of this interaction, and anything a runtime does after it is a different interaction outside this classification.

**[B — convention]** Redirect following is runtime policy. A redirect followed with the bound method and complete body preserved remains this interaction; a method-rewriting redirect is a final response of this interaction ([RFC 9110 §15.4](https://www.rfc-editor.org/rfc/rfc9110#section-15.4)).

**[B — limit]** Outcome classification depends on the final status, while redirect following and transport content negotiation, including a runtime-advertised `Accept-Encoding`, are runtime policy under Core §1.2. Two conformant runtimes MAY therefore classify one wire history differently, and that redirect/negotiation variance is the stated permitted set; the binding itself emits no negotiation field beyond those this specification pins (Core [§1.2](../../openbindings.md#12-out-of-scope)).

**[A]** A 3.2 Response Object may carry `summary` and optional `description`; neither field is required for the response declaration to govern ([OAS 3.2.0 §4.17.1](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-14)).

**[A]** A response Header Object named `Content-Type` is ignored. Every other governing response Header Object declaring `required: true` makes that header mandatory in the actual response ([OAS 3.2.0 §§4.17.1, 4.21](https://spec.openapis.org/oas/v3.2.0.html#response-headers)).

**[B — limit]** An actual response missing such a declared required header is a loud protocol error, in the same class as the undeclared non-empty-response error below; header carriage remains outside the operation-value boundary.

**[A]** A non-empty response selects its concrete media type from `Content-Type` and then the most-specific matching governing content declaration ([OAS 3.2.0 §§4.16, 4.17](https://spec.openapis.org/oas/v3.2.0.html#response-object)).

**[B — convention]** An unmatched, ambiguous, normalized-colliding, or matched-but-excluded result is a loud protocol error; an unused excluded response sibling never makes the target unusable before dispatch.

**[B — convention]** When a non-empty response omits `Content-Type`, the binding takes RFC 9110's permitted `application/octet-stream` assumption before ordinary matching; the resulting type still MUST match a governing declaration ([RFC 9110 §8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3)).

**[B — convention]** An **empty response** has zero content octets after transfer decoding and content-coding decoding; a response to HEAD is empty by definition.

**[B — convention]** Empty responses emit no operation output value; the binding does not manufacture JSON null or an empty string at the output boundary.

**[B — convention]** Successful non-empty non-sequential responses emit the selected lane's one application value.

**[B — convention]** The unary response value commits only after transfer completion and the full decode chain — content codings, then character decoding, then the selected lane — succeed; any failure after a 2xx final status and before that commit is a loud protocol error, and the interaction completes unsuccessfully with no partial unary value.

**[B — convention]** Failure bodies use the same selected carriage lanes as successful bodies and remain opaque application-authored failure data.

**[B — limit]** A non-empty response with no governing Response Object is a loud protocol error, even though omission of `responses` leaves the operation addressable. This specification defines no response-header or Link carriage in an operation value, so Response Header and Link Objects create no output members under this identifier; consequently, even a declared `Location` header on a `201` response has no output representation ([OAS 3.2.0 §§4.10.1, 4.17, 4.20–4.21](https://spec.openapis.org/oas/v3.2.0.html#response-object)).

## 10. Servers and target URL

**[A]** Server declarations are scoped at Operation, Path Item, and root levels, with a nonempty more specific list overriding the outer scope; an absent or empty root list is equivalent to one Server Object whose URL is `/` ([OAS 3.2.0 §§4.1.1, 4.5, 4.9.1, 4.10.1](https://spec.openapis.org/oas/v3.2.0.html#server-object)).

**[B — convention]** An empty Operation or Path Item `servers` array supplies no local alternative and falls through to the next outer scope, matching the root empty-equals-absent precedent.

**[B — configuration point]** One effective server selects itself; multiple members require one consumer `server` choice before dispatch, the same value carries exact variable substitutions, and no member, optional `name`, or variable preference is inferred.

**[A]** Server variables substitute their declared value, use `default` when no consumer value is supplied, MUST satisfy a nonempty declared `enum`, and each variable MUST occur no more than once in its Server URL template; an unresolved variable refuses before dispatch ([OAS 3.2.0 §§4.5.1, 4.6.1](https://spec.openapis.org/oas/v3.2.0.html#server-variable-object)).

**[B — exclusion]** A Server URL template repeating a variable is a declaration defect that excludes only that Server alternative; no private repeated-substitution convention is applied and sibling alternatives survive. The exclusion reopens only if an incorporated OAS edition defines repeated-variable substitution.

**[A]** Server URLs satisfy the 3.2 Server URL field rules, may be relative to the retrieval location of the document containing the Server Object, and MUST contain neither query nor fragment. The root `$self` identifies the OpenAPI document and MUST NOT replace that retrieval-URI base for API URLs ([OAS 3.2.0 §§4.5.1, 4.5.2](https://spec.openapis.org/oas/v3.2.0.html#relative-references-in-api-urls)).

**[B — exclusion]** A Server URL containing a query or fragment excludes each target that would use that Server alternative; the exclusion reopens only if an incorporated OAS edition defines the exact cell.

**[A]** After resolving and expanding the selected Server URL, the operation path is appended verbatim with no second relative-reference resolution, slash normalization, or path repair ([OAS 3.2.0 §4.8.1](https://spec.openapis.org/oas/v3.2.0.html#paths-path)).

**[B — limit]** When embedded content has no `location` to supply the API URL base, a relative Server URL leaves the target unresolved even if `$self` is absolute and refuses before dispatch; the complete configured URL below remains the available recovery.

**[A]** After path and query serialization, the completed target MUST parse and percent-decode under RFC 3986; an unusable target refuses before dispatch ([OAS 3.2.0 §§4.8.2, 4.12.4](https://spec.openapis.org/oas/v3.2.0.html#url-percent-encoding), [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)).

**[B — convention]** That parse and percent-decode is a well-formedness check only: the dispatched bytes are the constructed percent-encoded bytes, and the completed target is never dispatched in decoded form.

**[B — exclusion]** A completed target whose scheme is not `http` or `https` refuses before dispatch, because no incorporated authority defines that scheme's HTTP-semantics mapping; the exclusion reopens only if an incorporated authority defines that mapping.

**[B — configuration point]** The `server` configuration point MAY instead supply one complete consumer-configured URL. That URL is itself a valid `server` value and by itself discharges any required member choice; it MUST satisfy the same scheme and no-query/no-fragment constraints as an artifact Server URL, it replaces the resolved server base, and the operation's path bytes append verbatim to it; the artifact's path template, path substitution, query construction, method, parameters, body, response, and security semantics remain unchanged.

## 11. Security and channel assembly

**[A]** Operation `security` replaces root `security`; `[]` means no security requirement, array members are OR alternatives, every nonempty Security Requirement Object is an AND of its named schemes, and `{}` is a complete anonymous alternative ([OAS 3.2.0 §§4.10.1, 4.30](https://spec.openapis.org/oas/v3.2.0.html#security-requirement-object)).

**[B — configuration point]** The binding preserves every complete alternative and invents no anonymous-versus-credentialed preference. The named configuration point `security` selects one complete alternative: a sole declared alternative selects itself, and an effective empty `[]` or anonymous optional-security alternative counts as a complete no-security alternative; multiple alternatives require an explicit choice, fragments from different alternatives are never combined, and an invocation with no selection where one is required refuses before dispatch.

**[A]** Requirement arrays for OAuth 2.0 and OpenID Connect contain scopes, arrays for other schemes may contain roles, and this binding surfaces those exact strings without interpreting roles in-band or executing acquisition flows ([OAS 3.2.0 §4.30.1](https://spec.openapis.org/oas/v3.2.0.html#security-requirements-name)).

**[A]** Each Security Requirement name first matches an exact entry-document Security Scheme component name; if no component name matches, it MUST be a URI identifying a Security Scheme Object, and `./` disambiguates a single-segment relative URI from a colliding component name ([OAS 3.2.0 §4.30](https://spec.openapis.org/oas/v3.2.0.html#security-requirement-object)).

**[A]** A Security Scheme Object's `type` is closed to `apiKey`, `http`, `mutualTLS`, `oauth2`, and `openIdConnect`; `apiKey` additionally requires `name` and an admissible `in`, `http` requires `scheme`, `oauth2` requires `flows`, and `openIdConnect` requires `openIdConnectUrl` ([OAS 3.2.0 §4.27.1](https://spec.openapis.org/oas/v3.2.0.html#security-scheme-object)).

**[B — exclusion]** A malformed Security Scheme Object—an unlisted `type`, inadmissible `apiKey.in`, or absent conditionally required field—makes every complete security alternative requiring it unusable; other OR alternatives remain selectable. The alternative-level exclusion reopens only if an incorporated OAS edition admits the exact scheme form or supplies its missing carriage.

**[B — configuration point]** For a component-name requirement occurring in a referenced non-entry document, `implicitConnectionScope` selects `entry` or `referring` resolution and defaults to `entry`, preserving OAS's implementation-defined multi-document choice while following its recommendation; URI-identified requirements bypass this point ([OAS 3.2.0 §§4.1.2.3, Appendix G.3](https://spec.openapis.org/oas/v3.2.0.html#resolving-implicit-connections)).

**[A]** HTTP authentication-scheme tokens compare ASCII case-insensitively ([RFC 9110 §11.1](https://www.rfc-editor.org/rfc/rfc9110#section-11.1), [OAS 3.2.0 §4.27.1](https://spec.openapis.org/oas/v3.2.0.html#security-scheme-scheme)).

**[A]** `apiKey` credentials use their declared name and location, and HTTP `basic` and `bearer` credentials use the `Authorization` field ([OAS 3.2.0 §4.27](https://spec.openapis.org/oas/v3.2.0.html#security-scheme-object), [RFC 9110 §11.6.2](https://www.rfc-editor.org/rfc/rfc9110#section-11.6.2)).

**[B — pin]** A selected `basic` scheme consumes a runtime-supplied user-id and password and constructs `Authorization: Basic base64(user-id ":" password)` under [RFC 7617 §2](https://www.rfc-editor.org/rfc/rfc7617#section-2), including its user-id, password, and Base64 constraints. Because RFC 7617 §2 deliberately leaves the default character encoding undefined, the user-id and password octets are pinned to printable US-ASCII (0x20–0x7E); a credential containing any other character is not usable, and the invocation completes context-required awaiting a usable credential. This pin reopens only if an incorporated authority defines a charset-parameter declaration surface for the scheme.

**[B — convention]** `mutualTLS` is a transport prerequisite rather than a header credential; a selected alternative requiring it is complete only when the runtime has established the declared client-certificate condition.

**[B — pin]** A selected `apiKey` scheme consumes a runtime-supplied key value and emits it at the declaration's exact query, header, or cookie destination.

**[B — pin]** OAuth 2.0 and OpenID Connect flows consume a runtime-supplied access token and use the `Bearer` authorization scheme under [RFC 6750 §2.1](https://www.rfc-editor.org/rfc/rfc6750#section-2.1); another token type has no wire carriage under this identifier.

**[B — limit]** Any other declared HTTP authentication scheme remains visible as a consumer prerequisite, but this binding synthesizes no credential bytes for it; an alternative requiring it is unusable unless the runtime satisfies it as a complete prerequisite.

**[B — convention]** Credentials and credential-acquisition state MUST NOT be embedded in an OBI document.

**[B — convention]** A credential destination that collides with an effective parameter, another credential in the same AND requirement, or binding/processor-owned `Host`, `Content-Length`, `Content-Type`, or `Accept` makes only the selected security alternative unusable; another complete non-colliding alternative may still be selected, while §8.3 governs parameter-only processor-owned and invocation-time raw/structured cookie collisions.

**[B — convention]** API-key header destinations compare ASCII case-insensitively, while query and cookie destinations compare exact names. An API-key query value uses §8.2's query percent-encoding; an API-key cookie value is carried as an RFC 6265 `cookie-value` with no percent-encoding and refuses before dispatch when it cannot be so carried. Credential values never enter the caller envelope or operation contract; structured cookie contributions preserve membership and join as `name=value` separated by `; `, with no portable cookie order ([RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1), [RFC 6265 §4.2.1](https://httpwg.org/specs/rfc6265.html#sane-cookie), [OAS 3.2.0 §4.12.3](https://spec.openapis.org/oas/v3.2.0.html#style-values)).

## 12. Configuration, synthesis, and conformance

### 12.1 Configuration vocabulary

**[B — configuration point]** The complete binding-specific configuration vocabulary is `requestMedia` (one concrete media type), `server` (one effective Server alternative plus exact variable values, or one complete consumer-configured URL replacing the resolved server base), `security` (selection of one complete security alternative), `parameterConversion` (deterministic boolean/number converter), `implicitConnectionScope` (`entry` or `referring`), `requestContentCodings` (coding-to-encoder map), `responseContentCodings` (coding-to-decoder map), and conditional `propertyMedia` (one concrete media type per affected content-based form-urlencoded or multipart property).

**[B — configuration point]** Every requirement is typed, discoverable from declarations, and preflightable; no configuration member appears in the caller envelope or operation contract, and decode and classification are fixed rules rather than configuration points.

### 12.2 Synthesis boundary and coverage

**[C]** Operation contracts remain protocol-neutral (Core [§5.1](../../openbindings.md#51-operations), [invariant 1](../../openbindings.md#2-core-invariants)) and MAY remain flat (Core [§5.5](../../openbindings.md#55-transforms)).

**[B — convention]** Synthesis emits an `inputTransform` that constructs §7's envelope, and transforms never route values to HTTP locations.

**[B — convention]** This binding defines no status, header, selected-media, or other context bindings at `inputTransform` or `outputTransform` positions; evaluation uses Core's closed environment unaugmented (Core [§5.5 clause 5](../../openbindings.md#55-transforms), [OBI-T-10](../../openbindings.md#103-tool-rules)).

**[B — limit]** Synthesis emits flat protocol-neutral operation contracts together with an `inputTransform` that constructs §7's envelope: the envelope is the binding-boundary value, never the emitted operation contract, and qualified location-keys appear only in the transform's output. §12.2 licenses `inputTransform` and `outputTransform` as synthesis outputs, and operation/dependency key spelling, flattening, output-schema choice, and Schema Object translation as synthesis policy; no other input-restructuring apparatus exists under this identifier.

**[B — convention]** A synthesizer MUST account for every fixed or additional addressable operation and every callback/webhook dependency as represented, excluded with the exact reason stated beside the applicable exclusion, or unsupported; a failure in an unused description position is coverage loss rather than invocation behavior.

**[B — convention]** Every binding-specific configuration requirement remains in coverage accounting and invocation context, assigned to its represented target or declared alternative, and MUST NOT enter the operation input schema.

**[C]** Dependencies are synthesis outputs only and add no invocation target or receiver behavior (Core [§1.2](../../openbindings.md#12-out-of-scope), [§5.6](../../openbindings.md#56-dependencies)).

### 12.3 Conformance rules

**[B — convention]** A document conforms to **OAPI32-D-01** when its `content`, if present, satisfies §§3–5 and its `location`, if present, satisfies §4.

**[B — convention]** A binding conforms to **OAPI32-D-02** when it names §1's exact binding-specification identifier, carries one literal selector form from §6.1, and identifies a source that passes the exact edition gate.

**[B — convention]** A processor conforms to **OAPI32-P-01** when it implements the closed load gates, smallest-owner confinement, source/dialect exclusions, reference closure, and selector semantics of §§3–6.

**[B — convention]** A processor conforms to **OAPI32-P-02** when it accepts only §7's envelope, applies §8's effective-parameter, collision, conversion, closed-style, undefined-value, content, querystring, header, cookie, and path rules, and refuses every unknown or unroutable input before dispatch.

**[B — convention]** A processor conforms to **OAPI32-P-03** when it preserves media alternatives and applies §9's matching, request election, carriage, form, multipart, Encoding, content-coding, sequential/SSE, response lookup, classification, and value-boundary rules without sniffing or undeclared fallback.

**[B — convention]** A processor conforms to **OAPI32-P-04** when it resolves servers and complete target URLs under §10 and security alternatives, credentials, prerequisites, and channel collisions under §11.

**[B — convention]** A synthesizer conforms to **OAPI32-S-01** when it preserves §12.2's binding/transform boundary, emits §6.2's targetless unconstrained dependencies, and reports complete coverage under Core OBI-B-02.

**[B — exclusion]** Every exclusion in this document is permanent under `openbindings.openapi-3.2@1`, belongs to the smallest owner stated beside it, and reopens only on its stated incorporated-authority trigger; no exclusion promises later work.

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
