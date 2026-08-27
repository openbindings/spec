# `openbindings.openapi-3.1` Binding Specification

## 1. Identifier and rule labels

**[B — convention]** The opaque binding-specification identifier has exactly the spelling **`openbindings.openapi-3.1@1`**.

**[C]** Publication mints §1's identifier under Core [OBI-B-01](../../openbindings.md#104-binding-specification-rules), and an incompatible change to the accepted domain or portable meaning requires a different identifier under Core [OBI-B-03](../../openbindings.md#104-binding-specification-rules).

**[A]** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) only when they appear in all capitals.

**[B — convention]** Every normative paragraph and normative table row carries one visible provenance label: **A** is derived from incorporated authority and cites it, **C** is derived from the OpenBindings Core, and **B** is this specification's explicitly classified bridge (`convention`, `pin`, `configuration point`, `exclusion`, or `limit`). A `convention` is a choice this specification makes where no authority speaks; a `pin` fixes one reading of an ambiguous or versioned authority; a `configuration point` names a decision deferred to the consumer; an `exclusion` removes something from the accepted surface behind a stated reopen trigger; a `limit` states a boundary this specification does not cross.

## 2. Scope and incorporated authorities

**[B — convention]** This binding specification defines how OpenAPI 3.1 artifacts govern OpenBindings sources: which documents are accepted and when loading refuses, how operation targets are addressed and synthesized, what an invocation's inputs and outputs mean, and which wire mechanics the artifact fixes. It builds on the OpenBindings Core specification (`../../openbindings.md`).

**[B — convention]** This specification accepts exactly OpenAPI Specification (OAS) editions [`3.1.0`](https://spec.openapis.org/oas/v3.1.0.html), [`3.1.1`](https://spec.openapis.org/oas/v3.1.1.html), and [`3.1.2`](https://spec.openapis.org/oas/v3.1.2.html); no wildcard or compatible-looking value widens this closed set.

**[A]** Within that closed set, the artifact's exact `openapi` value selects its admitted edition under OAS's version-field semantics ([OAS 3.1.2 §4.1](https://spec.openapis.org/oas/v3.1.2.html#versions)).

**[B — convention]** Within that closed set, observable behavior MUST NOT turn on the patch component: each accepted edition instructs tooling to support the `3.1.*` feature set uniformly and not distinguish patch versions ([OAS 3.1.0 §4.1](https://spec.openapis.org/oas/v3.1.0.html#versions), [3.1.1 §4.1](https://spec.openapis.org/oas/v3.1.1.html#versions), [3.1.2 §4.1](https://spec.openapis.org/oas/v3.1.2.html#versions)).

**[B — pin]** Where accepted patch editions contradict one another, the corrected patch text governs.

**[B — convention]** That corrected-patch reading does not widen the closed accepted domain beyond §2's three exact values.

**[A]** OAS governs the artifact and every HTTP mechanic it declares, including object structure, reference resolution, parameter serialization, media declarations, server selection, responses, and security ([OAS 3.1.2 §4.8](https://spec.openapis.org/oas/v3.1.2.html#schema-0)); [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) governs the remaining HTTP semantics.

**[C]** This document defines portable binding meaning, not an invocation API: request objects, retry and redirect APIs, cancellation, credential acquisition, receiver deployment, and dependency composition remain runtime or application concerns under Core [§1.2](../../openbindings.md#12-out-of-scope).

## 3. Source carriage and refusal architecture

### 3.1 Accepted representations

**[B — convention]** `content` is either the parsed OpenAPI document object or string content; `location` is an absolute URI for the OpenAPI document; content has primacy, a co-present location supplies its base URI, and the OBI retrieval URI is never that base (Core [§5.4](../../openbindings.md#54-sources), [§7](../../openbindings.md#7-reference-resolution)).

**[B — pin]** String content MUST parse as YAML 1.2.2, of which JSON is a subset; duplicate mapping keys, non-scalar-string mapping keys, explicit tags outside YAML's JSON-compatible tag set, resolved values with no JSON image (`.inf`, `-.inf`, `.nan`), and a multi-document YAML stream refuse at this grammar gate. Exactly one YAML document is accepted ([YAML 1.2.2 §§3.2.1, 10.2.1, 10.3.2](https://yaml.org/spec/1.2.2/)).

**[A]** The tag and key gates implement the line's corrected format rule: "Tags MUST be limited to those allowed by YAML's JSON schema ruleset," and map keys MUST be scalar strings ([OAS 3.1.2 §4.2](https://spec.openapis.org/oas/v3.1.2.html#format)).

**[A]** The root MUST be a JSON object with the required `openapi` field ([OAS 3.1.2 §§4.2, 4.8.1.1](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields)).

**[B — convention]** That field MUST be exactly `3.1.0`, `3.1.1`, or `3.1.2`; an absent, mismatched, or unlisted value refuses at load under §2's closed accepted domain.

### 3.2 Closed load gates and confined defects

**[B — convention]** Defect outcomes use a fixed vocabulary: a source **refuses at load** only at §3.2's gates; a declaration defect **excludes** its smallest owning unit from synthesis and selection; an addressable target whose use requires a missing choice or unsupported alternative is **unusable** and **refuses before dispatch** when invoked; a wire fact this specification cannot represent faithfully is a **loud protocol error**; and synthesis reports every exclusion and inexpressible declaration as **coverage loss**.

**[B — convention]** A **lane** is one media-selected value-to-bytes serialization path—JSON, character-data, raw-octet, form, multipart, and this line's other incorporated forms—and the **smallest media owner** is the narrowest declared unit that owns a defective lane.

**[B — limit]** The load gates are the following closed ordered set: accepted-representation grammar, scalar/tag/key resolution, JSON-object root shape, and exact edition discrimination; no condition outside this set is a load gate.

**[B — limit]** After those gates pass, and apart from §5.2's named source-scope dialect exclusion, a defect confines to the smallest selected unit that owns it; an unreachable defect destroys no target, and a whole source refuses only when every position that could contain an addressable target is defective so that no conformant selector can resolve.

**[A]** A conforming artifact that declares no operation target is accepted and synthesizes no operation: a Paths Object and a Path Item Object may each be empty, and the root may instead contain `components` or `webhooks` ([OAS 3.1.2 §§4.8.1, 4.8.8, 4.8.9](https://spec.openapis.org/oas/v3.1.2.html#openapi-object)).

**[A]** An OpenAPI Description MUST contain at least one of `paths`, `components`, or `webhooks`; a root omitting all three is upstream-invalid, unlike any present-but-empty surface above ([OAS 3.1.2 §§3.1, 4.8.1.1](https://spec.openapis.org/oas/v3.1.2.html#openapi-object)).

**[B — limit]** Because that three-field omission leaves no position that could contain an addressable target, it falls under §3.2's whole-source refusal rule after the load gates; it is not a fifth load gate and does not reach a valid present-but-empty surface.

**[B — limit]** A target that is addressable but unusable because of a missing choice, unsupported alternative, or exclusion refuses at invocation or is reported as synthesis coverage loss; it never becomes a whole-source load refusal.

**[B — limit]** §5.2's root `jsonSchemaDialect` exclusion is this revision's only source-scope exclusion: unlike the [`include`/`mount` filtering surface of `openbindings.usage@1`](../usage/openbindings.usage.md#3-accepted-source-representations), no other source member or addressable target is filtered merely by its position in the source.

**[A]** Unknown non-extension fields create no binding behavior and are ignored only where the governing OAS object permits them; no unknown member is guessed into a known field ([OAS 3.1.2 §4.8](https://spec.openapis.org/oas/v3.1.2.html#schema-0)).

## 4. `location`, `content`, and composition

**[C]** A present `location` MUST be an absolute URI addressing the OpenAPI document itself, and dereferencing it MUST yield an accepted representation; a bare filesystem path is not conformant (Core [OBI-D-05](../../openbindings.md#102-document-rules)).

**[B — convention]** A present `content` MUST be one of §3.1's two representations, and no other JSON type is accepted.

**[A]** Relative non-Schema references use the containing document's base URI; Schema Object references use the nearest schema-resource base established by `$id`; JSON or YAML document fragments are JSON Pointers ([OAS 3.1.2 §§4.3, 4.6](https://spec.openapis.org/oas/v3.1.2.html#relative-references-in-api-description-uris)).

**[B — convention]** Embedded content without a co-present `location` MUST be self-contained; a location-only source uses its location as the entry-document base (Core [§7](../../openbindings.md#7-reference-resolution)).

## 5. References, dialects, and confinement

### 5.1 Reference semantics

**[A]** A reference composes its target plus the transitive closure of references reachable from that target, not unrelated material in the same retrieved document; a referenced document need not itself be a conforming OpenAPI Document ([OAS 3.1.2 §§4.3.1, 4.6](https://spec.openapis.org/oas/v3.1.2.html#parsing-documents), [JSON Schema Core §8.2](https://json-schema.org/draft/2020-12/json-schema-core.html#section-8.2)).

**[A]** Before a Schema Object reference may be deemed unresolvable, its complete containing document MUST be parsed for schema resources, reference targets, and keywords that establish or change a base URI ([OAS 3.1.2 §4.3.1](https://spec.openapis.org/oas/v3.1.2.html#parsing-documents)).

**[B — convention]** When one JSON or YAML node is reached from reference positions requiring different OAS Object types, each reference context interprets the node independently as its own required Object type; this is the deterministic choice within OAS's implementation-defined multi-context license ([OAS 3.1.2 §4.3.2](https://spec.openapis.org/oas/v3.1.2.html#structural-interoperability)).

**[A]** A Schema Object `$ref` is the JSON Schema applicator and its siblings remain meaningful; a Reference Object has only its fixed `$ref`, `summary`, and `description` fields, and every added property is ignored ([OAS 3.1.2 §§4.8.23, 4.8.24](https://spec.openapis.org/oas/v3.1.2.html#reference-object)).

**[A]** Reference traversal MUST detect and handle cycles without resource exhaustion ([OAS 3.1.2 §5.5](https://spec.openapis.org/oas/v3.1.2.html#handling-reference-cycles)).

**[B — convention]** A cyclic but resolvable graph is legitimate: cycle detection terminates traversal and is not itself a refusal.

**[B — exclusion]** When a selected Path Item carries `$ref`, the selected operation target is excluded only if a fixed field used by that target appears in both the referenced Path Item and its adjacent declaration, because OAS defines that collision as undefined. `Used by that target` means the selected method field plus the Path Item's `parameters` and `servers`; documentation fields never collide for this purpose. Collisions confined to unused fields and all non-colliding adjacent fields leave the target usable, and the exclusion reopens only if an incorporated OAS edition defines the collision ([OAS 3.1.2 §4.8.9.1](https://spec.openapis.org/oas/v3.1.2.html#path-item-ref)).

**[A]** The first three reference conditions in the table below are defined by OAS 3.1.2's description-structure, relative-reference, and Path Item rules ([OAS 3.1.2 §§4.3, 4.6, 4.8.9](https://spec.openapis.org/oas/v3.1.2.html#openapi-description-structure)):

| condition |
| --- |
| **[A]** Unresolvable selected Path Item `$ref` |
| **[A]** Unresolvable reference reached by one selected parameter, request body, response, server, or security requirement |
| **[A]** Unresolvable Schema Object reference reached only by one media alternative |
| **[B — limit]** An unresolvable reference reachable only from an unused description position leaves invocation unaffected; synthesis reports the unrepresented position. |
| **[B — limit]** A defect outside the target-plus-reachable closure has no effect on that target. |

**[B — limit]** In table order, the three authority-backed conditions confine as follows: the referenced Path Item and its operations are unaddressable; the selected operation or its affected declared alternative is unusable while unrelated operations survive; or the affected media alternative is unavailable while sibling alternatives survive.

### 5.2 Schema dialect

**[A]** The supported default Schema Object dialect is `https://spec.openapis.org/oas/3.1/dialect/base`; root `jsonSchemaDialect` changes the document default, and a schema-resource-root `$schema` overrides that default only within its schema resource ([OAS 3.1.2 §§4.8.24.1, 4.8.24.5](https://spec.openapis.org/oas/v3.1.2.html#specifying-schema-dialects)).

**[B — pin]** For this identifier, that base-dialect URI is fixed to the official [`2024-11-10` revision](https://spec.openapis.org/oas/3.1/dialect/2024-11-10); a later change in the alias's resolution does not alter this specification.

**[B — exclusion]** A root `jsonSchemaDialect` naming any other URI excludes the whole source because this specification refuses to prove, per source, that no reachable Schema Object depends on that changed default; this exclusion reopens only if that exact dialect becomes incorporated authority.

**[B — exclusion]** A schema-resource-root `$schema` naming any other URI excludes only each selected unit whose reachable closure enters that resource; this exclusion reopens only if that exact dialect becomes incorporated authority.

**[B — convention]** For every lane, style, shape, and member-inspection rule in this document, a **resolved declaration** is obtained by following `$ref` and conjoining every `allOf` branch; an `anyOf` or `oneOf` choice supplies a single resolved member declaration only when exactly one non-null branch exists; `not` and conditional applicators never participate in resolution; and absence of `type` leaves the declaration typeless. A 3.1 `type` array contributes every listed type to the resolved type set. **Declares only X** means that the resolved type set is nonempty and every member is in X. **Admits `string` as its sole non-null type** means that the resolved type set is exactly `{string}` or `{string, null}`.

## 6. Selector and inbound dependencies

### 6.1 Selector

**[B — convention]** `selector` is REQUIRED and has exactly one literal spelling: `#/paths/<escaped-path>/<lowercase-method>`, where `<escaped-path>` is the Paths Object key escaped once under [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) and `<lowercase-method>` is one of `get`, `put`, `post`, `delete`, `options`, `head`, `patch`, or `trace`.

**[A]** Selector evaluation never percent-decodes the pointer and fails unresolvable when the selected operation is absent ([RFC 6901 §§3–4](https://www.rfc-editor.org/rfc/rfc6901#section-3), [OAS 3.1.2 §§3.5, 4.8.9](https://spec.openapis.org/oas/v3.1.2.html#path-item-object)).

**[B — convention]** After the pointer selects a Path Item, selector evaluation resolves that Path Item's `$ref` before reading the method field. Ordinary RFC 6901 evaluation does not traverse a 2020-12 `$ref`, because `$ref` is an applicator and substitutes no JSON node; the deliberate extra resolution keeps bundled referenced Path Items addressable ([RFC 6901 §4](https://www.rfc-editor.org/rfc/rfc6901#section-4), [JSON Schema Core §8.2.3.1](https://json-schema.org/draft/2020-12/json-schema-core.html#section-8.2.3.1), [OAS 3.1.2 §4.8.9.1](https://spec.openapis.org/oas/v3.1.2.html#path-item-ref)).

**[A]** An operation remains addressable when it omits `responses`, because `responses` is optional in the 3.1 Operation Object ([OAS 3.1.2 §4.8.10.1](https://spec.openapis.org/oas/v3.1.2.html#operation-responses)).

**[A]** When `responses` is present, its Responses Object MUST contain at least one response code; a present empty object is upstream-invalid, distinct from valid omission ([OAS 3.1.2 §4.8.16](https://spec.openapis.org/oas/v3.1.2.html#responses-object)).

**[B — exclusion]** A present empty Responses Object is a declaration defect that excludes only the selected target, before any response or caller value is inspected; omission remains addressable under the preceding rule. The exclusion reopens only if an incorporated OAS 3.1 edition admits a present empty Responses Object.

### 6.2 Callbacks and webhooks

**[A]** A callback Path Item describes a request initiated by the service and expected responses, while a root webhook describes an incoming request the API consumer may implement; neither is an operation invocable through the addressed parent operation ([OAS 3.1.2 §§4.8.1.1, 4.8.10.1, 4.8.18](https://spec.openapis.org/oas/v3.1.2.html#oas-webhooks)).

**[B — convention]** Synthesis MUST represent every supported callback and webhook operation as a Core dependency with a deterministic slot-derived key and a role-inverted consumed-operation contract: input is the request the service sends and output is the response the service expects (Core [§5.6](../../openbindings.md#56-dependencies)).

**[B — convention]** `Deterministic slot-derived key` requires only that the key be a deterministic function of the declaration slot; its exact spelling is synthesis policy under §12.2 and is not portable binding meaning. The dependency contract's shape is likewise synthesis policy; only the role-inverted input/output meaning above is fixed here.

**[C]** Such a dependency carries no concrete target (Core [§5.6](../../openbindings.md#56-dependencies)).

**[B — convention]** Such a dependency also carries no `bindingSpecs`, because the originating artifact has no authority to constrain the consumer's description format.

**[A]** Callback runtime-expression keys describe service-selected request destinations ([OAS 3.1.2 §§4.8.18, 4.8.20.3](https://spec.openapis.org/oas/v3.1.2.html#runtime-expressions)).

**[B — limit]** Dependencies add no invocation behavior to this binding; receiver deployment and dependency composition are permanently outside this operation boundary under this identifier (Core [§1.2](../../openbindings.md#12-out-of-scope)).

## 7. Target interaction and caller envelope

**[B — convention]** Here and below, an **effective** declaration is the declaration that remains after applying the artifact's scope, default, and override rules stated in §§8–10.

**[A]** An addressed operation denotes its declared HTTP method, completed target URL, parameters, optional request body, security requirements, and final HTTP response ([OAS 3.1.2 §4.8.10](https://spec.openapis.org/oas/v3.1.2.html#operation-object)).

**[B — convention]** The caller-facing correspondence value is exactly `{parameters?: {...}, body?: <one JSON value>}`; absence means not supplied, `body: null` is a supplied JSON null, and the artifact alone determines parameter location and serialization.

**[B — convention]** When every effective parameter name is unique across locations, its caller key is the exact declared name; if any name is repeated across legal locations, the target uses qualified mode for every parameter and each key is `<location>/<RFC6901-escaped-name>`, making the flat map injective without depending on map order.

**[A]** Effective parameter identity is exact name plus location; duplicate effective parameters at the same identity are upstream-invalid, while the same name in different locations denotes distinct parameters ([OAS 3.1.2 §§4.8.10.1, 4.8.12.2.1](https://spec.openapis.org/oas/v3.1.2.html#operation-parameters)).

**[B — exclusion]** Duplicate effective parameters at the same identity exclude their smallest owning operation; this exclusion reopens only if an incorporated OAS edition admits such duplicates.

**[B — convention]** Legal cross-location duplicates remain independently supplied through the qualified mode above.

**[B — exclusion]** Two effective header parameters whose names differ only by ASCII case exclude the selected target because OAS parameter identity is case-sensitive while HTTP field names are case-insensitive; the wire cannot preserve the distinction. This exclusion reopens only if an incorporated authority defines a wire mapping that preserves such case-distinct declarations ([OAS 3.1.2 §3.8](https://spec.openapis.org/oas/v3.1.2.html#case-sensitivity), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — convention]** An envelope top-level key other than `parameters` or `body`, a present non-object `parameters` member, or any unknown parameter key refuses before dispatch, regardless of whether a body exists; no unmatched-field passthrough exists.

**[A]** Missing required parameters and a missing `required: true` request body refuse before dispatch; path parameters are always required ([OAS 3.1.2 §§4.8.12.2.1, 4.8.13.1](https://spec.openapis.org/oas/v3.1.2.html#common-fixed-fields)).

**[A]** OAS fully supports `requestBody` where HTTP explicitly defines request-body semantics and otherwise permits it with undefined semantics, naming GET, HEAD, and DELETE only as examples. Within this binding's closed selector set, `requestBody` is honored on `post`, `put`, and `patch`; it remains permitted but undefined on `get`, `head`, `delete`, and `options`; and it emits no body on `trace` because a TRACE client MUST NOT send content; `patch` body semantics are defined by RFC 5789 ([OAS 3.1.2 §4.8.10.1](https://spec.openapis.org/oas/v3.1.2.html#operation-request-body), [RFC 9110 §§9.3.1–9.3.8](https://www.rfc-editor.org/rfc/rfc9110#section-9.3.1), [RFC 5789 §2](https://www.rfc-editor.org/rfc/rfc5789#section-2)).

**[B — convention]** The binding preserves a supplied declared body on `get`, `head`, `delete`, or `options` rather than deleting it; a supplied `body` on `trace` refuses as unroutable before dispatch.

## 8. Parameter serialization

### 8.1 Effective declarations and scalar conversion

**[A]** Operation parameters override Path Item parameters only at the same exact name-plus-location identity, and every remaining effective `path`, `query`, `header`, or `cookie` Parameter Object governs its own contribution ([OAS 3.1.2 §§4.8.9.1, 4.8.10.1, 4.8.12.1](https://spec.openapis.org/oas/v3.1.2.html#parameter-locations)).

**[B — exclusion]** A selected effective Parameter Object missing required `name`, using an `in` outside `path`, `query`, `header`, or `cookie`, failing to use exactly one of `schema` or `content`, declaring a non-required path Parameter, or giving a content map other than exactly one entry is a declaration defect that excludes the selected target before caller values are inspected. The exclusion reopens only if an incorporated OAS 3.1 edition admits the exact malformed declaration or defines its wire meaning ([OAS 3.1.2 §§4.8.12.1–4.8.12.2.3](https://spec.openapis.org/oas/v3.1.2.html#parameter-object)).

**[A]** A Header Parameter whose name ASCII-case-insensitively denotes `Accept`, `Content-Type`, or `Authorization` MUST be ignored and creates no effective parameter, caller-envelope key, or emitted field ([OAS 3.1.2 §§3.8, 4.8.12.2.1](https://spec.openapis.org/oas/v3.1.2.html#common-fixed-fields), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — configuration point]** For `schema`-form Parameter serialization and §9.3 Encoding/style serialization of form or multipart property values, `parameterConversion` is the same deterministic consumer-supplied conversion from each JSON boolean or number to a string; strings pass identically, and any supplied boolean or number without a configured conversion refuses before dispatch ([OAS 3.1.2 Appendix B](https://spec.openapis.org/oas/v3.1.2.html#appendix-b-data-type-conversion)).

**[A]** On those RFC 6570-style paths, a supplied JSON null is an undefined value and MUST serialize exactly as the governing effective `style` and `explode` row's `undefined` cell. OAS 3.1.0 omitted a null/undefined column: its `empty` column described the empty string. OAS 3.1.1 added the corrected `undefined` column, expressly included null, and distinguished the empty string; under §2's corrected-patch reading, that correction governs all accepted editions. The governing 3.1.2 bytes are `;name` for `matrix`, `.` for `label`, an empty serialization for `simple`, and `name=` for `form` before §8.2's enclosing query assembly; the remaining style cells are `n/a` ([OAS 3.1.0 §4.8.12.4](https://spec.openapis.org/oas/v3.1.0.html#style-examples), [OAS 3.1.1 §4.8.12.4](https://spec.openapis.org/oas/v3.1.1.html#style-examples), [OAS 3.1.2 §4.8.12.6](https://spec.openapis.org/oas/v3.1.2.html#style-examples), [RFC 6570 §2.3](https://www.rfc-editor.org/rfc/rfc6570#section-2.3)).

**[B — convention]** A supplied null whose governing effective `style`/`explode` row has `n/a` in that corrected `undefined` cell refuses the invocation before dispatch at the affected Parameter or Encoding property; other values admitted by the same declaration remain usable.

**[B — convention]** A null member of a supplied array or object value on an RFC 6570-style path refuses the invocation before dispatch at the affected Parameter or Encoding property; RFC 6570's list model has no member-level undefined value, and this binding invents no serialization.

**[B — configuration point]** This specification defines no partial canonicalization default for `parameterConversion`; the converter applies recursively to array members and object values before serialization and MUST be deterministic for every accepted scalar.

### 8.2 `style`, `explode`, and URL assembly

**[A]** The supported `schema`-form cells and their RFC 6570 operators are exactly the following; a style/location/shape outside the table refuses before dispatch ([OAS 3.1.2 §§4.8.12.2.2, 4.8.12.3, Appendix C](https://spec.openapis.org/oas/v3.1.2.html#style-values), [RFC 6570 §3.2](https://www.rfc-editor.org/rfc/rfc6570#section-3.2)):

| style | location | admitted shapes | operator / source |
| --- | --- | --- | --- |
| **[A]** `matrix` | path | primitive, array, object | `;` |
| **[A]** `label` | path | primitive, array, object | `.` |
| **[A]** `simple` | path, header | primitive, array, object | none |
| **[A]** `form` | query, cookie | primitive, array, object | `?` (`+` when `allowReserved: true`) |
| **[B — convention]** `spaceDelimited` | query | array, object | OAS Style Examples bytes |
| **[B — convention]** `pipeDelimited` | query | array, object | OAS Style Examples bytes |
| **[B — convention]** `deepObject` | query | object with scalar properties | OAS Style Examples bytes |

**[A]** Default style is `form` for query and cookie and `simple` for path and header; default `explode` is `true` only for `form` and `false` otherwise; `allowReserved` applies only to query parameters ([OAS 3.1.2 §4.8.12.2](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-9)).

**[A]** RFC 6570 serialization MUST use its declared operator, `*` for `explode: true`, and a comma for non-exploded label lists/maps. Multiple regular form-style query parameters share one `?` variable list; separately expanding multiple `?` templates is not conformant ([OAS 3.1.2 §§C.1–C.2](https://spec.openapis.org/oas/v3.1.2.html#equivalences-between-fields-and-rfc6570-operators)).

**[A]** Because RFC 6570 prefix operators cannot combine, a query mixing regular form expansion with `allowReserved: true` MUST be constructed manually per parameter: reserved-permitting values use reserved expansion, and `[`, `]`, `#`, `&`, `=`, and `+` are pre-percent-encoded where Appendix C requires ([OAS 3.1.2 §§C.3–C.4.2](https://spec.openapis.org/oas/v3.1.2.html#non-rfc6570-field-values-and-combinations)).

**[B — convention]** The manual path assembles all present per-parameter contributions into one query component with one leading `?` and `&` between contributions; this assembled result is the single-query rule's equivalent at the authority's construction seam.

**[B — convention]** Query-contribution order across distinct effective Parameters is not portable meaning.

**[A]** A Parameter name that is not a legal RFC 6570 variable name MUST be percent-encoded before use in the template construction ([OAS 3.1.2 §§C.3, C.4.4](https://spec.openapis.org/oas/v3.1.2.html#illegal-variable-names-as-parameter-names)).

**[B — convention]** That variable-name encoding is internal to URL assembly and never changes the exact caller-envelope key defined by §7.

**[B — convention]** For `spaceDelimited`, `pipeDelimited`, and `deepObject`, the exact bytes are the corresponding OAS Style Examples: delimiters and deep-object brackets are percent-encoded, object names and values retain their shown alternation, and no unstated escape convention is added ([OAS 3.1.2 §4.8.12.6](https://spec.openapis.org/oas/v3.1.2.html#style-examples)).

**[B — convention]** Before dispatch, the binding refuses a supplied parameter or property name or scalar value containing its non-RFC style's structural delimiter: U+0020 SPACE for `spaceDelimited`, `|` for `pipeDelimited`, or any of `[`, `]`, `=`, and `&` for `deepObject`; no escape-convention configuration point is offered.

**[B — exclusion]** An effective `explode` value—including its style-derived default when `explode` is omitted—in a Style Examples `n/a` cell excludes that parameter; in particular, omitted `explode` on `deepObject` resolves to `false` and excludes. OAS/RFC 6570 defines no expansion for the excluded cells, so the owning unit is excluded unless an incorporated authority defines that exact cell ([OAS 3.1.2 §§4.8.12.2, 4.8.12.3, 4.8.15.1, E.4](https://spec.openapis.org/oas/v3.1.2.html#style-values), [RFC 6570 §3.2.1](https://www.rfc-editor.org/rfc/rfc6570#section-3.2.1)).

**[B — exclusion]** Otherwise a compound-capable style is excluded only when its resolved declaration proves an unsupported compound member—an array whose resolved `items` declaration declares only `object` or `array`, or an object with at least one declared property whose resolved declaration declares only `object` or `array`. OAS/RFC 6570 defines no expansion for the excluded cells, so the owning unit is excluded unless an incorporated authority defines that exact cell ([OAS 3.1.2 §§4.8.12.2, 4.8.12.3, 4.8.15.1, E.4](https://spec.openapis.org/oas/v3.1.2.html#style-values), [RFC 6570 §3.2.1](https://www.rfc-editor.org/rfc/rfc6570#section-3.2.1)).

**[B — convention]** A typeless resolved member proves no compound shape, a choice that supplies no single resolved member declaration under §5.2 proves no compound shape, and an object declaring no properties proves no compound member, so none triggers this exclusion; in particular, a declaration that still admits a scalar is never excluded, and candidate admission never inspects the supplied runtime value.

**[B — convention]** The rule applies symmetrically to every compound-capable Parameter style and to §9.3's Encoding style path, where the smallest owner is the selected media alternative rather than the target.

**[A]** The Paths Object MUST NOT contain two templated path keys with equivalent hierarchies but different template names. Within one selected target, every path-template expression MUST have a corresponding effective `path` Parameter, and every effective `path` Parameter MUST correspond to a template expression ([OAS 3.1.2 §§3.5, 4.8.8.1, 4.8.12.2.1](https://spec.openapis.org/oas/v3.1.2.html#path-templating)).

**[B — convention]** The two authority-grounded correspondence directions are one-to-one under this binding, so a template expression occurring more than once is a declaration defect; 3.1.2 does not itself state that duplicate-expression consequence.

**[B — exclusion]** Equivalent-hierarchy path-key ambiguity, either direction of a path-expression/Parameter mismatch, or a duplicate expression is a declaration defect that excludes the selected target before any caller value is inspected; non-conflicting targets survive. The exclusion reopens only if incorporated authority admits the declaration or defines its unique target mapping.

**[A]** An expanded path value containing unescaped `/`, `?`, or `#` refuses before dispatch ([OAS 3.1.2 §§3.5, 4.8.12.4](https://spec.openapis.org/oas/v3.1.2.html#path-templating)).

**[A]** Completed URL parsing and percent-decoding follow RFC 3986, while query delimiters and the non-RFC-style brackets above remain percent-encoded as required ([OAS 3.1.2 §4.8.12.4](https://spec.openapis.org/oas/v3.1.2.html#url-percent-encoding), [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)).

### 8.3 Content-form, empty, header, and cookie parameters

**[A]** A `content`-form Parameter Object MUST contain exactly one media-type entry; its application value serializes under that entry, and when the contribution enters a URL the resulting representation is percent-encoded as one parameter value ([OAS 3.1.2 §4.8.12.2.3](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-for-use-with-content)).

**[B — pin]** Percent-encoding a content-form Parameter leaves RFC 3986 unreserved bytes literal and encodes every other UTF-8 byte as uppercase `%HH`; the exact caller-envelope key remains unchanged.

**[A]** For a query parameter with `allowEmptyValue: true`, a supplied empty string emits a present zero-length value; absence still means omitted, and this binding infers no schema-validity consequence because OAS leaves that interaction implementation-defined ([OAS 3.1.2 §4.8.12.2.1](https://spec.openapis.org/oas/v3.1.2.html#parameter-allow-empty-value)).

**[A]** Header `schema` serialization performs no URI percent-encoding and adds no automatic quotes; cookie contributions are not URI-decoded after serialization ([OAS 3.1.2 §§4.8.12.2.2, Appendix D](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-for-use-with-schema)).

**[B — convention]** A supplied header value containing CR, LF, or another field-invalid byte refuses before dispatch at the affected Parameter ([RFC 9110 §§5.1, 5.5](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — convention]** Raw-Cookie and structured-cookie declarations alone exclude nothing. An invocation in which a supplied raw `Cookie` Header Parameter value and any structured cookie contribution—an effective cookie Parameter or selected cookie credential—would both be emitted refuses before dispatch; the binding does not parse or merge the raw string.

**[B — exclusion]** An effective Header Parameter named `Host` or `Content-Length` excludes the target because those fields are processor-owned and cannot be replaced by caller input; the exclusion reopens only if an incorporated HTTP authority defines caller control that preserves the processor's framing and routing obligations.

**[B — exclusion]** A form-style cookie declaration is statically excluded only when its effective `explode` and resolved declaration prove multi-value production: `explode: true` together with a declaration that declares only `array`, or one that declares only `object` with at least one declared property. A typeless or scalar-admitting declaration proves no such production; if a supplied value nevertheless would produce multiple cookie pairs, that invocation refuses before dispatch. OAS identifies RFC 6570's `&`-separated expansion as incorrect for Cookie's `; ` delimiter, so the exclusion reopens only if an incorporated OAS edition defines a correct multi-value mapping ([OAS 3.1.2 Appendix D](https://spec.openapis.org/oas/v3.1.2.html#appendix-d-serializing-headers-and-cookies)).

## 9. Request and response media

### 9.1 Media identity, alternatives, and request election

**[A]** Media types parse under RFC 9110: type, subtype, and parameter names compare case-insensitively while parameter values retain their media-defined comparison rules ([RFC 9110 §§8.3.1, 8.3.2](https://www.rfc-editor.org/rfc/rfc9110#section-8.3.1)).

**[B — convention]** A **concrete media type** has no wildcard in either its type or subtype; media-type parameters do not affect concreteness.

**[B — convention]** A declaration matches a concrete media type only when every declared parameter is present with an equal value; matches order by exact type/subtype before `type/*` before `*/*`, then by greatest declared-parameter count, and equal-specificity ties refuse.

**[B — limit]** Distinct content-map keys that normalize to one parsed media identity collide only for that identity and refuse selection through it; non-colliding entries survive, and map order never breaks the tie.

**[A]** A no-body invocation bypasses request-body media selection and emits neither a body nor `Content-Type`, because an absent optional Request Body contributes no HTTP content ([OAS 3.1.2 §§4.8.10.1, 4.8.13.1](https://spec.openapis.org/oas/v3.1.2.html#request-body-object)).

**[B — configuration point]** A body-emitting invocation preserves every admissible declared request alternative: exactly one usable concrete entry — one not excluded by this specification's confinement rules — selects itself; every other map, including two or more usable entries or a concrete declaration alongside a usable range, requires a concrete `requestMedia` choice before input consumption; the choice MUST match under §9.1 and never substitutes another declaration's schema, and supplied values never elect.

**[B — configuration point]** A missing required choice, unmatched or ambiguous choice, unsupported selected lane, or body-emitting invocation with no admissible candidate refuses before dispatch; no body bytes or examples are sniffed to select a lane.

**[A]** Examples illustrate values ([OAS 3.1.2 §4.8.14.1](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-11)).

**[B — limit]** Examples create no operation input or output member and never select a declaration, carriage lane, or media type.

**[B — convention]** The binding sends no `Accept` header: OAS ignores a Header Parameter named `Accept`, request-body content declares what the operation consumes, and response content supplies no portable instruction to advertise a preference ([OAS 3.1.2 §§4.8.12.2.1, 4.8.13, 4.8.17](https://spec.openapis.org/oas/v3.1.2.html#common-fixed-fields)).

### 9.2 Common carriage lanes

**[A]** An exact `application/json` or `+json` selection serializes the supplied value as strict JSON on requests and parses strict JSON on responses; JSON text uses UTF-8 ([RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)).

**[B — convention]** `text/json` is not a member of that JSON lane; as a `text/*` type it can use the character-data lane only when its resolved declaration admits `string` as its sole non-null type. This convention reopens under a new identifier only if the IANA media-type registry registers `text/json` with JSON semantics.

**[B — convention]** A concrete character-data selection governed by a resolved declaration that admits `string` as its sole non-null type carries a supplied string under its declared `charset`, defaulting to UTF-8; `type: ["string", "null"]` therefore selects this lane for its string branch, while a supplied null refuses before dispatch because the lane defines no null lexical form. Response decoding emits a string and never invents null. The closed character-data set is `text/*`, `application/xml`, and `+xml`, while `application/json` and `+json` are claimed by the JSON lane. The binding does not consult the live media-type registry's `Encoding considerations`: `application/json` is registered as binary, `text/csv` records no value, and a live lookup would violate this pinned, immutable reading ([RFC 6838 §4.2.1](https://www.rfc-editor.org/rfc/rfc6838#section-4.2.1), [RFC 2046 §4.1](https://www.rfc-editor.org/rfc/rfc2046#section-4.1), [RFC 7303 §§3, 9](https://www.rfc-editor.org/rfc/rfc7303#section-3)).

**[B — convention]** The charset parameter is the only character-encoding source this lane consults; consulting a BOM or XML declaration would require inspecting body bytes, which this binding never sniffs, so a charset-less non-UTF-8 XML response refuses rather than being sniffed, and every unsupported or invalid character decoding likewise refuses.

**[B — limit]** UTF-8 decoding MUST be supported; any further charset is an implementation capability whose absence refuses loudly.

**[A]** OAS permits a concrete binary media declaration to omit `schema`; a memberless Schema Object and boolean `true` likewise assert no instance type, so all three forms have a typeless resolved declaration ([OAS 3.1.2 §§4.4.2, 4.8.14.3, 4.8.24](https://spec.openapis.org/oas/v3.1.2.html#working-with-binary-data)).

**[B — convention]** A non-JSON, non-form concrete selection whose Media Type Object omits `schema`, or whose present resolved declaration is typeless, uses the raw-octet lane. A schema-omitted media range does not gain this lane because it declares no single concrete representation.

**[A]** Every other keyword in a typeless resolved declaration still applies, and `maxLength` on raw content measures wire octets rather than the Base64 boundary string ([OAS 3.1.2 §4.4.2](https://spec.openapis.org/oas/v3.1.2.html#working-with-binary-data), [JSON Schema Validation §8.4](https://json-schema.org/draft/2020-12/json-schema-validation.html#section-8.4)).

**[A]** A resolved declaration that admits `string` as its sole non-null type with `contentEncoding` carries the caller's artifact-encoded string as text and does not trigger OpenBindings Base64 decoding; schema encoding and HTTP `Content-Encoding` are distinct ([OAS 3.1.2 §4.4.2](https://spec.openapis.org/oas/v3.1.2.html#working-with-binary-data), [JSON Schema Validation §§8.3–8.4](https://json-schema.org/draft/2020-12/json-schema-validation.html#section-8.3)).

**[A]** On a resolved declaration whose type set excludes `string`, `contentEncoding` and `contentMediaType` are inert annotations: they cause no refusal, select no encoded-string handling, and emit no `Content-Transfer-Encoding`, because both keywords apply only when the instance is a string ([JSON Schema Validation §§8.3–8.4](https://json-schema.org/draft/2020-12/json-schema-validation.html#section-8.3), [OAS 3.1.2 §§4.4, 4.8.15.3](https://spec.openapis.org/oas/v3.1.2.html#data-types)).

**[B — pin]** Every OpenBindings raw-octet value is a JSON string containing canonical RFC 4648 §4 Base64: standard alphabet, required padding, no ignored non-alphabet characters, and zero unused pad bits; requests decode before dispatch and responses encode the exact octets ([RFC 4648 §§3.3, 3.5, 4](https://www.rfc-editor.org/rfc/rfc4648)).

**[B — exclusion]** This specification does not generate XML from an object model because the OAS XML Object does not determine complete document bytes; the selected media alternative is excluded until an incorporated authority defines ordering, escaping, nulls, dynamic keys, and scalar lexical forms, while string and raw-octet XML carriage remain admitted ([OAS 3.1.2 §§4.8.14, 4.8.26](https://spec.openapis.org/oas/v3.1.2.html#xml-object)).

**[B — convention]** Because `readOnly` and `writeOnly` are annotations whose enforcement OAS leaves to the application, this binding never uses them to delete a supplied wire member or synthesize an absent one ([OAS 3.1.2 §4.8.24.3.2](https://spec.openapis.org/oas/v3.1.2.html#validating-readonly-and-writeonly)).

**[B — exclusion]** A concrete request or response selection admitted by none of the JSON, character-data, raw-octet, string XML carriage under §9.2's XML rule, form, multipart, or other explicitly incorporated lanes is excluded at its smallest media owner because OAS supplies no value-to-bytes mapping; the exclusion reopens only if an incorporated authority defines that media/data-form cell.

**[C]** Invoking this binding does not trigger validation of any application value against its governing Schema Object; only a tool that separately claims validation owes Core's validation rules (Core [invariant 2](../../openbindings.md#2-core-invariants), [OBI-T-16](../../openbindings.md#103-tool-rules)).

### 9.3 Form bodies and multipart parts

**[A]** `application/x-www-form-urlencoded` and `multipart/form-data` serialize object properties under the governing Schema and Encoding Objects ([OAS 3.1.2 §§4.8.14.4, 4.8.14.5](https://spec.openapis.org/oas/v3.1.2.html#support-for-x-www-form-urlencoded-request-bodies)).

**[B — limit]** A non-object declaration has no form lane under §3.2's smallest-owner rule.

**[A]** For a dynamic object member, the resolved property declaration conjoins an exact `properties` schema and every matching `patternProperties` schema, or uses `additionalProperties` when no exact or pattern schema matches; applicable `allOf` constraints remain in force ([JSON Schema Core §10.3.2](https://json-schema.org/draft/2020-12/json-schema-core.html#section-10.3.2)).

**[B — convention]** For form-carriage selection, a resolved property declaration uses §5.2's sole-non-null-choice member; the 3.1 spelling `type: [<non-null-type>, "null"]` contributes the same resolved type set ([OAS 3.1.2 §§4.4, 4.8.15.1.1, Appendix B](https://spec.openapis.org/oas/v3.1.2.html#appendix-b-data-type-conversion)).

**[A]** When any Encoding `style`, `explode`, or `allowReserved` control selects the RFC 6570 style path, a supplied JSON null follows §8.1's corrected `undefined` cell for the effective `style` and `explode`; it is not blanket-elided ([OAS 3.1.2 §§4.8.15.1, C.4](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-12)).

**[B — convention]** After content-based form encoding selects an explicit concrete `contentType` or determines its default, a supplied null property is elided as an omitted optional member and contributes neither a form-urlencoded field nor a multipart part; this rule is separate from §8.1's style-path handling.

**[A]** Encoding `style`, `explode`, and `allowReserved` controls apply to both form-urlencoded and multipart/form-data; explicit presence of any control selects RFC 6570-style serialization and absent sibling controls take their defaults, while absence of all three selects content-based encoding ([OAS 3.1.2 §§4.8.15.1, C.4](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-12)).

**[A]** Form-urlencoded removes RFC 6570's leading `?`; multipart writes values inside named parts with no URI percent-encoding, and `allowReserved` has no multipart effect ([OAS 3.1.2 Appendix C](https://spec.openapis.org/oas/v3.1.2.html#appendix-c-using-rfc6570-based-serialization)).

**[A]** The form-urlencoded content path follows RFC 1866 form encoding while the style path follows RFC 6570; the binding preserves the permitted encodings of each path and does not collapse them to one authored byte spelling ([OAS 3.1.2 Appendix E.4](https://spec.openapis.org/oas/v3.1.2.html#appendix-e-percent-encoding-and-form-media-types), [RFC 1866 §8.2.1](https://www.rfc-editor.org/rfc/rfc1866#section-8.2.1), [RFC 6570](https://www.rfc-editor.org/rfc/rfc6570)).

**[B — pin]** On that content-based form-urlencoded path, SPACE becomes `+`, RFC 3986 unreserved bytes remain literal, and every other UTF-8 byte is encoded as uppercase `%HH`.

**[A]** Multipart part `Content-Type` selection is: an explicit single concrete Encoding `contentType`; otherwise `application/octet-stream` for a typeless resolved declaration or one that admits `string` as its sole non-null type with `contentEncoding`, `text/plain` for a plain string or number/integer/boolean, `application/json` for an object, and the item-type default for an array ([OAS 3.1.2 §4.8.15.1.1](https://spec.openapis.org/oas/v3.1.2.html#common-fixed-fields-0)).

**[A]** Every `multipart/form-data` part carries `Content-Disposition: form-data` with the schema-property name in its `name` parameter; an array property emits one part per element under that same name ([OAS 3.1.2 §§4.8.15, 4.8.15.3](https://spec.openapis.org/oas/v3.1.2.html#encoding-multipart-media-types)).

**[B — exclusion]** A property name that cannot be represented safely as the multipart `name` parameter, including any name containing CR or LF, excludes only that multipart media alternative; the exclusion reopens only if an incorporated authority defines an unambiguous encoding.

**[B — convention]** Repeated parts for one array preserve element order; cross-property part order has no portable meaning, while property-to-name membership is fixed.

**[B — convention]** A part with a typeless resolved declaration uses the raw-octet lane and §9.2's canonical Base64 boundary; a part whose resolved declaration admits `string` as its sole non-null type with `contentEncoding` remains artifact-encoded text, and neither case emits `Content-Transfer-Encoding`.

**[B — configuration point]** On the content-based path for either `application/x-www-form-urlencoded` or `multipart/form-data`, a wildcard or comma-separated multi-valued Encoding `contentType` requires one concrete `propertyMedia` choice for each affected form or multipart property; the choice MUST satisfy a declared member under §9.1, and an absent, unmatched, or ambiguous required choice refuses before dispatch.

**[B — limit]** Encoding `headers` are descriptive at this operation boundary: the binding emits no part header merely from a Header Object schema and never emits an undeclared `Content-Transfer-Encoding`; alternatives needing caller-supplied part headers have no representation under this identifier ([OAS 3.1.2 §4.8.15.1.1](https://spec.openapis.org/oas/v3.1.2.html#encoding-headers)).

**[B — exclusion]** A multipart media type other than `multipart/form-data` is excluded because OAS defines no property-to-part correlation for it; the exclusion reopens only if an incorporated OAS edition defines that correlation ([OAS 3.1.2 §4.8.14.5](https://spec.openapis.org/oas/v3.1.2.html#special-considerations-for-multipart-content)).

### 9.4 HTTP content codings

**[A]** HTTP `Content-Encoding` is distinct from media type and from Schema Object `contentEncoding`; request codings apply in listed wire order and response codings decode in reverse order before the selected media lane ([RFC 9110 §8.4](https://www.rfc-editor.org/rfc/rfc9110#section-8.4), [OAS 3.1.2 §4.4.2](https://spec.openapis.org/oas/v3.1.2.html#working-with-binary-data)).

**[A]** The artifact declaration surfaces are an effective request Header Parameter named `Content-Encoding` and a governing response Header Object of that name; field-name comparison is ASCII case-insensitive ([OAS 3.1.2 §§3.8, 4.8.12, 4.8.17](https://spec.openapis.org/oas/v3.1.2.html#header-object), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — configuration point]** `requestContentCodings` and `responseContentCodings` are finite consumer maps from case-insensitive content-coding tokens to deterministic encoders and decoders; on requests the caller-supplied effective `Content-Encoding` Header Parameter value fixes the encoder stack, while on responses the actual value governed by the Response Header Object fixes the decoder stack, and no configuration preference narrows either declared surface.

**[B — configuration point]** An unsupported token, a field value not admitted by its governing Header declaration, an ambiguous coding declaration, or an actual response coding with no governing Header Object refuses rather than being skipped or sniffed; configuring a codec supplies capability but never declares a coding the artifact omitted.

### 9.5 Response declaration, classification, and decoding

**[A]** Response keys are closed to exact three-digit status codes `100` through `599`, the five ranges `1XX` through `5XX`, `default`, and specification extensions; an exact key overrides its matching range ([OAS 3.1.2 §§3.7, 4.8.16](https://spec.openapis.org/oas/v3.1.2.html#responses-object), [RFC 9110 §15](https://www.rfc-editor.org/rfc/rfc9110#section-15)).

**[B — exclusion]** A Responses key outside that closed admitted set is a declaration defect that excludes the selected target before any actual response is inspected; the exclusion reopens only if an incorporated OAS 3.1 edition admits that exact key form.

**[B — convention]** The governing Response Object lookup order is exact status, then the single matching range, then `default`; range-over-default is this specification's reading, and declarations never reclassify the native status.

**[A]** RFC 9110 defines the 2xx class as successful ([RFC 9110 §15.3](https://www.rfc-editor.org/rfc/rfc9110#section-15.3)).

**[B — convention]** For this binding, success means that the final status—the status after any interim responses and any redirects the runtime chose to follow—is in that 2xx class.

**[B — convention]** Redirect following is runtime policy. A redirect followed with the bound method and complete body preserved remains this interaction; a method-rewriting redirect is a final response of this interaction ([RFC 9110 §15.4](https://www.rfc-editor.org/rfc/rfc9110#section-15.4)).

**[B — limit]** Outcome classification depends on the final status, while redirect following and transport content negotiation, including a runtime-advertised `Accept-Encoding`, are runtime policy under Core §1.2. Two conformant runtimes MAY therefore classify one wire history differently, and that redirect/negotiation variance is the stated permitted set; the binding itself emits no negotiation field beyond those this specification pins (Core [§1.2](../../openbindings.md#12-out-of-scope)).

**[A]** A response Header Object named `Content-Type` is ignored. Every other governing response Header Object declaring `required: true` makes that header mandatory in the actual response ([OAS 3.1.2 §§4.8.17, 4.8.21](https://spec.openapis.org/oas/v3.1.2.html#response-headers)).

**[B — limit]** An actual response missing such a declared required header is a loud protocol error, in the same class as the undeclared non-empty-response error below; header carriage remains outside the operation-value boundary.

**[A]** A non-empty response selects its concrete media type from `Content-Type` and then the most-specific matching governing content declaration ([OAS 3.1.2 §§4.8.16, 4.8.17](https://spec.openapis.org/oas/v3.1.2.html#response-object)).

**[B — convention]** An unmatched, ambiguous, or normalized-colliding result is a loud protocol error.

**[B — convention]** When a non-empty response omits `Content-Type`, the binding takes RFC 9110's permitted `application/octet-stream` assumption before ordinary matching; the resulting type still MUST match a governing declaration ([RFC 9110 §8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3)).

**[B — convention]** An **empty response** has zero content octets after transfer decoding; a response to HEAD is empty by definition.

**[B — convention]** Empty responses emit no output value; successful non-empty responses emit the selected lane's one application value, while failure bodies use the same lanes and remain opaque application-authored failure data.

**[B — limit]** A non-empty response with no governing Response Object is a loud protocol error, even though omission of `responses` leaves the operation addressable. This specification defines no response-header or Link carriage in an operation value, so Response Header and Link Objects create no output members under this identifier; consequently, even a declared `Location` header on a `201` response has no output representation ([OAS 3.1.2 §§4.8.10.1, 4.8.17](https://spec.openapis.org/oas/v3.1.2.html#operation-responses)).

**[B — limit]** One HTTP response body produces at most one operation value: the accepted 3.1 editions define no construct that frames one response body into multiple application values, including for `text/event-stream`.

## 10. Servers and target URL

**[A]** Server declarations are scoped at Operation, Path Item, and root levels, with the more specific declaration overriding the outer scope; an absent or empty root list is equivalent to one Server Object whose URL is `/` ([OAS 3.1.2 §§4.8.1.1, 4.8.5, 4.8.9.1, 4.8.10.1](https://spec.openapis.org/oas/v3.1.2.html#server-object)).

**[B — convention]** An empty Operation or Path Item `servers` array supplies no local alternative and falls through to the next outer scope, matching the root empty-equals-absent precedent.

**[B — configuration point]** One effective server selects itself; multiple members require one consumer `server` choice before dispatch, the same value carries exact variable substitutions, and no member or variable preference is inferred.

**[A]** Server variables substitute their declared value, use `default` when no consumer value is supplied, and MUST satisfy a nonempty declared `enum`; an unresolved variable refuses before dispatch ([OAS 3.1.2 §4.8.6](https://spec.openapis.org/oas/v3.1.2.html#server-variable-object)).

**[A]** A Server URL MUST contain neither query nor fragment. Before path assembly, an expanded relative Server URL—including the implied `/`—resolves against the location of the document containing that Server Object; the operation's path bytes are then appended verbatim to the resolved Server URL with no second relative-reference resolution, slash normalization, or path repair ([OAS 3.1.2 §§4.7, 4.8.5.1, 4.8.8.1](https://spec.openapis.org/oas/v3.1.2.html#server-url)).

**[B — exclusion]** A Server URL containing a query or fragment excludes each target that would use that Server alternative; the exclusion reopens only if an incorporated OAS edition defines the exact cell.

**[B — limit]** When embedded content has no document location to supply that base, a relative Server URL leaves the target unresolved and refuses before dispatch; the complete configured URL below remains the available recovery.

**[A]** After path and query serialization, the completed target MUST parse and percent-decode under RFC 3986; an unusable target refuses before dispatch ([OAS 3.1.2 §4.8.12.4](https://spec.openapis.org/oas/v3.1.2.html#url-percent-encoding), [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)).

**[B — configuration point]** The `server` configuration point MAY supply a complete consumer-configured URL that replaces the resolved server base; the artifact's path template, path substitution, query construction, method, parameters, body, response, and security semantics remain unchanged.

## 11. Security and channel assembly

**[A]** Operation `security` replaces root `security`; `[]` means no security requirement, array members are OR alternatives, every nonempty Security Requirement Object is an AND of its named schemes, and `{}` is a complete anonymous alternative ([OAS 3.1.2 §§4.8.10.1, 4.8.30](https://spec.openapis.org/oas/v3.1.2.html#security-requirement-object)).

**[B — configuration point]** The binding preserves every complete alternative and invents no anonymous-versus-credentialed preference. The named configuration point `security` selects one complete alternative: a sole declared alternative selects itself, and an effective empty `[]` or anonymous optional-security alternative counts as a complete no-security alternative; multiple alternatives require an explicit choice, fragments from different alternatives are never combined, and an invocation with no selection where one is required refuses before dispatch.

**[A]** Requirement arrays for OAuth 2.0 and OpenID Connect contain scopes, arrays for other schemes may contain roles, and this binding surfaces those exact strings without interpreting roles in-band or executing acquisition flows ([OAS 3.1.2 §4.8.30.1](https://spec.openapis.org/oas/v3.1.2.html#security-requirements-name)).

**[B — configuration point]** `implicitConnectionScope` selects `entry` or `referring` document resolution for Security Requirement names and defaults to `entry`, following OAS's recommended entry-document scope while preserving the explicit alternative ([OAS 3.1.2 §4.3.3](https://spec.openapis.org/oas/v3.1.2.html#resolving-implicit-connections)).

**[A]** HTTP authentication-scheme tokens compare ASCII case-insensitively ([RFC 9110 §11.1](https://www.rfc-editor.org/rfc/rfc9110#section-11.1), [OAS 3.1.2 §4.8.27.1](https://spec.openapis.org/oas/v3.1.2.html#security-scheme-scheme)).

**[A]** `apiKey` credentials use their declared name and location, and HTTP `basic` and `bearer` credentials use the `Authorization` field ([OAS 3.1.2 §4.8.27](https://spec.openapis.org/oas/v3.1.2.html#security-scheme-object), [RFC 9110 §11.6.2](https://www.rfc-editor.org/rfc/rfc9110#section-11.6.2)).

**[B — pin]** A selected `basic` scheme consumes a runtime-supplied user-id and password and constructs `Authorization: Basic base64(user-id ":" password)` under [RFC 7617 §2](https://www.rfc-editor.org/rfc/rfc7617#section-2), including its user-id, password, character-encoding, and Base64 constraints.

**[B — convention]** `mutualTLS` is a transport prerequisite rather than a header credential; a selected alternative requiring it is complete only when the runtime has established the declared client-certificate condition.

**[B — pin]** A selected `apiKey` scheme consumes a runtime-supplied key value and emits it at the declaration's exact query, header, or cookie destination.

**[B — pin]** OAuth 2.0 and OpenID Connect flows consume a runtime-supplied access token and use the `Bearer` authorization scheme under [RFC 6750 §2.1](https://www.rfc-editor.org/rfc/rfc6750#section-2.1); another token type has no wire carriage under this identifier.

**[B — limit]** Any other declared HTTP authentication scheme remains visible as a consumer prerequisite, but this binding synthesizes no credential bytes for it; an alternative requiring it is unusable unless the runtime satisfies it as a complete prerequisite.

**[B — convention]** Credentials and credential-acquisition state MUST NOT be embedded in an OBI document.

**[B — convention]** A credential destination that collides with an effective parameter, another credential in the same AND requirement, or binding/processor-owned `Host`, `Content-Length`, `Content-Type`, or `Accept` makes only the selected security alternative unusable; another complete non-colliding alternative may still be selected, while §8.3 governs parameter-only processor-owned and invocation-time raw/structured cookie collisions.

**[B — convention]** API-key header destinations compare ASCII case-insensitively, while query and cookie destinations compare exact names. An API-key query value uses §8.2's query percent-encoding; an API-key cookie value is carried as an RFC 6265 `cookie-value` with no percent-encoding and refuses before dispatch when it cannot be so carried. Credential values never enter the caller envelope or operation contract; structured cookie contributions preserve membership and join as `name=value` separated by `; `, with no portable cookie order ([RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1), [RFC 6265 §4.2.1](https://httpwg.org/specs/rfc6265.html#sane-cookie), [OAS 3.1.2 Appendix D](https://spec.openapis.org/oas/v3.1.2.html#appendix-d-serializing-headers-and-cookies)).

## 12. Configuration, synthesis, and conformance

### 12.1 Configuration vocabulary

**[B — configuration point]** The complete binding-specific configuration vocabulary is `requestMedia` (one concrete media type), `server` (one effective Server alternative plus exact variable values, or one complete consumer-configured URL replacing the selected target), `security` (selection of one complete security alternative), `parameterConversion` (deterministic boolean/number converter), `implicitConnectionScope` (`entry` or `referring`), `requestContentCodings` (coding-to-encoder map), `responseContentCodings` (coding-to-decoder map), and conditional `propertyMedia` (one concrete media type per affected form or multipart property).

**[B — configuration point]** Every requirement is typed, discoverable from declarations, and preflightable; no configuration member appears in the caller envelope or operation contract, and decode and classification are fixed rules rather than configuration points.

### 12.2 Synthesis boundary and coverage

**[C]** Operation contracts remain protocol-neutral (Core [§5.1](../../openbindings.md#51-operations), [invariant 1](../../openbindings.md#2-core-invariants)) and MAY remain flat (Core [§5.5](../../openbindings.md#55-transforms)).

**[B — convention]** Synthesis emits an `inputTransform` that constructs §7's envelope, and transforms never route values to HTTP locations.

**[B — convention]** This binding defines no status, header, selected-media, or other context bindings at `inputTransform` or `outputTransform` positions; evaluation uses Core's closed environment unaugmented (Core [§5.5 clause 5](../../openbindings.md#55-transforms), [OBI-T-10](../../openbindings.md#103-tool-rules)).

**[B — limit]** §12.2 licenses the §7 envelope as the operation input shape, `inputTransform` and `outputTransform` as synthesis outputs, and operation/dependency key spelling, flattening, output-schema choice, and Schema Object translation as synthesis policy; no other input-restructuring apparatus exists under this identifier.

**[B — convention]** A synthesizer MUST account for every addressable operation and every callback/webhook dependency as represented, excluded with the exact reason stated beside the applicable exclusion, or unsupported; a failure in an unused description position is coverage loss rather than invocation behavior.

**[B — convention]** Every binding-specific configuration requirement remains in coverage accounting and invocation context, assigned to its represented target or declared alternative, and MUST NOT enter the operation input schema.

**[C]** Dependencies are synthesis outputs only and add no invocation target or receiver behavior (Core [§1.2](../../openbindings.md#12-out-of-scope), [§5.6](../../openbindings.md#56-dependencies)).

### 12.3 Conformance rules

**[B — convention]** A document conforms to **OAPI31-D-01** when its `content`, if present, satisfies §§3–5 and its `location`, if present, satisfies §4.

**[B — convention]** A binding conforms to **OAPI31-D-02** when it names §1's binding-specification identifier, carries the literal selector of §6.1, and identifies a source that passes the exact edition gate.

**[B — convention]** A processor conforms to **OAPI31-P-01** when it implements the closed load gates, smallest-owner confinement, source/dialect exclusions, reference closure, and selector semantics of §§3–6.

**[B — convention]** A processor conforms to **OAPI31-P-02** when it accepts only §7's envelope, applies §8's effective-parameter, collision, conversion, style, content, header, cookie, and path rules, and refuses every unknown or unroutable input before dispatch.

**[B — convention]** A processor conforms to **OAPI31-P-03** when it preserves media alternatives and applies §9's matching, request election, carriage, form, multipart, content-coding, response lookup, classification, and unary-boundary rules without sniffing or undeclared fallback.

**[B — convention]** A processor conforms to **OAPI31-P-04** when it resolves servers and complete target URLs under §10 and security alternatives, credentials, prerequisites, and channel collisions under §11.

**[B — convention]** A synthesizer conforms to **OAPI31-S-01** when it preserves §12.2's binding/transform boundary, emits §6.2's targetless unconstrained dependencies, and reports complete coverage under Core OBI-B-02.

**[B — exclusion]** Every exclusion in this document is permanent under `openbindings.openapi-3.1@1`, belongs to the smallest owner stated beside it, and reopens only on its stated incorporated-authority trigger; no exclusion promises later work.

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
- [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750)
- [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838)
- [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)
- [RFC 7303](https://www.rfc-editor.org/rfc/rfc7303)
- [RFC 7617](https://www.rfc-editor.org/rfc/rfc7617)
- [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)
- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)
