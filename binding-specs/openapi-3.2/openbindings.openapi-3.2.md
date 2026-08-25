# `openbindings.openapi-3.2` Binding Specification

## 1. Status, identifier, and rule labels

**Status: unreleased first-revision candidate.**

**[C]** The proposed opaque binding-specification identifier is **`openbindings.openapi-3.2@1`**; publication mints that exact identifier under Core [OBI-B-01](../../openbindings.md#104-binding-specification-rules), and an incompatible change to the accepted domain or portable meaning requires a different identifier under Core [OBI-B-03](../../openbindings.md#104-binding-specification-rules).

**[A]** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) only when they appear in all capitals.

**[B — convention]** Every normative paragraph and normative table row carries one visible provenance label: **A** is derived from incorporated authority and cites it, **C** is derived from the OpenBindings Core, and **B** is this specification's explicitly classified bridge (`convention`, `pin`, `configuration point`, `exclusion`, or `limit`).

## 2. Scope and incorporated authorities

**[A]** This specification accepts exactly OpenAPI Specification (OAS) edition [`3.2.0`](https://spec.openapis.org/oas/v3.2.0.html); the artifact's `openapi` value MUST be that exact value, and no wildcard or compatible-looking value widens this closed set ([OAS 3.2.0 §§2.1, 4.1.1](https://spec.openapis.org/oas/v3.2.0.html#oas-version)).

**[A]** OAS governs the artifact and every HTTP mechanic it declares, including object structure, reference resolution, parameter serialization, media declarations, server selection, responses, and security ([OAS 3.2.0 §4](https://spec.openapis.org/oas/v3.2.0.html#objects-and-fields)); [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) governs the remaining HTTP semantics.

**[C]** This document defines portable binding meaning, not an invocation API: request objects, retry and redirect APIs, cancellation, credential acquisition, receiver deployment, and dependency composition remain runtime or application concerns under Core [§1.2](../../openbindings.md#12-out-of-scope).

## 3. Source carriage and refusal architecture

### 3.1 Accepted representations

**[C]** `content` is either the parsed OpenAPI document object or string content; `location` is an absolute URI for the OpenAPI document; content has primacy, a co-present location supplies its retrieval URI, and the OBI retrieval URI is never an OpenAPI base (Core [§5.4](../../openbindings.md#54-sources), [§7](../../openbindings.md#7-reference-resolution)).

**[B — pin]** String content MUST parse under the YAML 1.2.2 grammar, of which JSON is a subset; a duplicate mapping key or grammar error refuses at load ([YAML 1.2.2 §§3.2.1, 10.2.1](https://yaml.org/spec/1.2.2/)).

**[A]** YAML processing follows OAS 3.2's RFC 9512-based JSON-compatibility regime, and any resolved value with no JSON image refuses at load ([OAS 3.2.0 §§3, 3.1](https://spec.openapis.org/oas/v3.2.0.html#json-and-yaml-compatibility)).

**[A]** The root MUST be a JSON object and its `openapi` field MUST be exactly `3.2.0`; an absent, mismatched, or other value refuses at load ([OAS 3.2.0 §§3, 4.1.1](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields)).

### 3.2 Closed load gates and confined defects

**[B — limit]** The load gates are the following closed ordered set: accepted-representation grammar, YAML-to-JSON compatibility, JSON-object root shape, and exact edition discrimination; no condition outside this set is a load gate.

**[B — limit]** After those gates pass, and apart from §5.2's named source-scope dialect exclusion, a defect confines to the smallest selected unit that owns it; an unreachable defect destroys no target, and a whole source refuses only when every position that could contain an addressable target is defective so that no conformant selector can resolve (Core [OBI-B-03](../../openbindings.md#104-binding-specification-rules)).

**[A]** A conforming artifact that declares no operation target is accepted and synthesizes no operation: the Paths Object and each Path Item Object may be empty, and the root may instead contain `components` or `webhooks` ([OAS 3.2.0 §§4.1.1, 4.8, 4.9](https://spec.openapis.org/oas/v3.2.0.html#openapi-object)).

**[B — limit]** A target that is addressable but unusable because of a missing choice, unsupported alternative, or exclusion refuses at invocation or is reported as synthesis coverage loss; it never becomes a whole-source load refusal.

**[A]** Unknown non-extension fields create no binding behavior and are ignored only where the governing OAS object permits them; no unknown member is guessed into a known field ([OAS 3.2.0 §4](https://spec.openapis.org/oas/v3.2.0.html#objects-and-fields)).

## 4. `location`, `content`, and composition

**[C]** A present `location` MUST be an absolute URI addressing the OpenAPI document itself, and dereferencing it MUST yield an accepted representation; a bare filesystem path is not conformant (Core [OBI-D-05](../../openbindings.md#102-document-rules)).

**[C]** A present `content` MUST be one of §3.1's two representations, and no other JSON type is accepted (Core [OBI-D-01](../../openbindings.md#102-document-rules)).

**[A]** A present root `$self` establishes the document's self-assigned URI and OpenAPI-description base; a relative `$self` first resolves against the next available RFC 3986 base, ordinarily the retrieval URI supplied by `location`. Without `$self`, that retrieval URI is the ordinary document base ([OAS 3.2.0 §§4.1.1, 4.1.2.2.1](https://spec.openapis.org/oas/v3.2.0.html#establishing-the-base-uri)).

**[A]** Relative non-Schema references then use the document base; Schema Object references use the nearest schema-resource base established by `$id`; JSON or YAML document fragments are JSON Pointers ([OAS 3.2.0 §§4.1.2.1, 4.1.2.2](https://spec.openapis.org/oas/v3.2.0.html#relative-references-in-api-description-uris)).

**[C]** Embedded content without a co-present `location` MUST establish every needed base through an absolute `$self`, absolute schema identifiers, or other self-contained references; a location-only source uses its location as the retrieval URI.

## 5. References, dialects, and confinement

### 5.1 Reference semantics

**[A]** A reference composes its target plus the transitive closure of references reachable from that target, not unrelated material in the same retrieved document; every provided possible OAD document MUST be fully parsed before a selected reference is deemed unresolvable ([OAS 3.2.0 §§4.1.2, 4.1.2.1](https://spec.openapis.org/oas/v3.2.0.html#parsing-documents)).

**[B — convention]** When one JSON or YAML node is reached from reference positions requiring different OAS Object types, each reference context interprets the node independently as its own required Object type; this is the deterministic choice within OAS's implementation-defined multi-context license ([OAS 3.2.0 Appendix G.2](https://spec.openapis.org/oas/v3.2.0.html#conflicts-between-field-types-and-reference-contexts)).

**[A]** A Schema Object `$ref` is the JSON Schema applicator and its siblings remain meaningful; a Reference Object has only its fixed `$ref`, `summary`, and `description` fields, and every added property is ignored ([OAS 3.2.0 §§4.23, 4.24](https://spec.openapis.org/oas/v3.2.0.html#reference-object)).

**[A]** Reference traversal MUST detect and handle cycles without resource exhaustion ([OAS 3.2.0 §6.6](https://spec.openapis.org/oas/v3.2.0.html#handling-reference-cycles)).

**[C]** A cyclic but resolvable graph is legitimate: cycle detection terminates traversal and is not itself a refusal (Core [OBI-T-11](../../openbindings.md#103-tool-rules)).

**[B — exclusion]** When a selected Path Item carries `$ref`, the selected operation target is excluded only if a fixed field used by that target appears in both the referenced Path Item and its adjacent declaration, because OAS defines that collision as undefined; collisions confined to unused fields and all non-colliding adjacent fields leave the target usable, and the exclusion is permanent under this identifier unless an incorporated OAS edition defines the collision ([OAS 3.2.0 §4.9.1](https://spec.openapis.org/oas/v3.2.0.html#path-item-ref)).

**[A]** The following confinement table applies ([OAS 3.2.0 §§4.1.2, 4.9](https://spec.openapis.org/oas/v3.2.0.html#openapi-description-structure)):

| condition | owning unit and effect |
| --- | --- |
| **[A]** Unresolvable selected Path Item `$ref` | the referenced Path Item and its operations are unaddressable |
| **[A]** Unresolvable reference reached by one selected parameter, request body, response, server, or security requirement | that selected operation or its affected declared alternative is unusable; unrelated operations survive |
| **[A]** Unresolvable Schema Object or Media Type Object reference reached only by one media alternative | that media alternative is unavailable; sibling alternatives survive |
| **[C]** Unresolvable reference reachable only from an unused description position | invocation is unaffected; synthesis reports the unrepresented position |
| **[C]** Defect outside the target-plus-reachable closure | no effect on that target |

### 5.2 Schema dialect

**[A]** The supported default Schema Object dialect is `https://spec.openapis.org/oas/3.1/dialect/base`; root `jsonSchemaDialect` changes the document default, and a schema-resource-root `$schema` overrides that default only within its schema resource ([OAS 3.2.0 §§4.24.1, 4.24.7](https://spec.openapis.org/oas/v3.2.0.html#specifying-schema-dialects)).

**[B — pin]** For this identifier, that base-dialect URI is fixed to the official [`2024-11-10` revision](https://spec.openapis.org/oas/3.1/dialect/2024-11-10); a later change in the alias's resolution does not alter this specification.

**[B — exclusion]** A root `jsonSchemaDialect` naming any other URI excludes the whole source because it changes every contained Schema Object; this exclusion is permanent under this identifier and reopens only if that exact dialect becomes incorporated authority.

**[B — exclusion]** A schema-resource-root `$schema` naming any other URI excludes only each selected unit whose reachable closure enters that resource; this exclusion is permanent under this identifier and reopens only if that exact dialect becomes incorporated authority.

## 6. Selector and inbound dependencies

### 6.1 Selector

**[B — convention]** `selector` is REQUIRED and has exactly one of two literal spellings: `#/paths/<escaped-path>/<lowercase-method>` for a fixed-field operation, where `<lowercase-method>` is one of `get`, `put`, `post`, `delete`, `options`, `head`, `patch`, `trace`, or `query`; or `#/paths/<escaped-path>/additionalOperations/<METHOD-as-spelled>` for an additional operation. Each map-key segment is escaped once under [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901), and the additional-operation method retains its exact case after that unescaping (Core [OBI-D-03](../../openbindings.md#102-document-rules), [OAS 3.2.0 §4.9.1](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-6)).

**[A]** An `additionalOperations` key MUST be an HTTP method token in the exact capitalization sent on the wire and MUST NOT denote a method represented by a fixed Operation field; the fixed `query` field denotes QUERY under the pinned draft-11 target that OAS links despite displaying a draft-08 label ([OAS 3.2.0 §4.9.1](https://spec.openapis.org/oas/v3.2.0.html#path-item-additional-operations), [RFC 9110 §9.1](https://www.rfc-editor.org/rfc/rfc9110#section-9.1), [HTTP QUERY draft-11](https://www.ietf.org/archive/id/draft-ietf-httpbis-safe-method-w-body-11.html)).

**[A]** Selector evaluation never percent-decodes the pointer and fails unresolvable when the selected operation is absent ([RFC 6901 §§3–4](https://www.rfc-editor.org/rfc/rfc6901#section-3), [OAS 3.2.0 §§4.8, 4.9](https://spec.openapis.org/oas/v3.2.0.html#path-item-object)).

**[B — convention]** After the pointer selects a Path Item, selector evaluation resolves that Path Item's `$ref` before reading the fixed method field or `additionalOperations` entry; this deliberate extra resolution keeps bundled referenced Path Items addressable ([RFC 6901 §4](https://www.rfc-editor.org/rfc/rfc6901#section-4), [OAS 3.2.0 §4.9.1](https://spec.openapis.org/oas/v3.2.0.html#path-item-ref)).

**[A]** An operation remains addressable when it omits `responses`, because `responses` is optional in the 3.2 Operation Object ([OAS 3.2.0 §4.10.1](https://spec.openapis.org/oas/v3.2.0.html#operation-responses)).

### 6.2 Callbacks and webhooks

**[A]** A callback Path Item describes a request initiated by the service and expected responses, while a root webhook describes an incoming request the API consumer may implement; neither is an operation invocable through the addressed parent operation ([OAS 3.2.0 §§4.1.1, 4.10.1, 4.18](https://spec.openapis.org/oas/v3.2.0.html#oas-webhooks)).

**[B — convention]** Synthesis MUST represent every supported callback and webhook operation as a Core dependency with a deterministic slot-derived key and a role-inverted consumed-operation contract: input is the request the service sends and output is the response the service expects (Core [§5.6](../../openbindings.md#56-dependencies)).

**[C]** Such a dependency carries no `target` (Core [§5.6](../../openbindings.md#56-dependencies)).

**[B — convention]** Such a dependency also carries no `bindingSpecs`, because the originating artifact has no authority to constrain the consumer's description format.

**[A]** Callback runtime-expression keys describe service-selected request destinations ([OAS 3.2.0 §§4.18, 4.20.3](https://spec.openapis.org/oas/v3.2.0.html#runtime-expressions)).

**[B — limit]** Dependencies add no invocation behavior to this binding; receiver deployment and dependency composition are permanently outside this operation boundary under this identifier (Core [§1.2](../../openbindings.md#12-out-of-scope)).

## 7. Target interaction and caller envelope

**[A]** An addressed operation denotes its declared HTTP method, completed target URL, parameters, optional request body, security requirements, and final HTTP response ([OAS 3.2.0 §4.10](https://spec.openapis.org/oas/v3.2.0.html#operation-object)).

**[B — convention]** The caller-facing correspondence value is exactly `{parameters?: {...}, body?: <one JSON value>}`; absence means not supplied, `body: null` is a supplied JSON null, and the artifact alone determines parameter location and serialization.

**[B — convention]** When every effective parameter name is unique across locations, its caller key is the exact declared name; if any name is repeated across legal locations, the target uses qualified mode for every parameter and each key is `<location>/<RFC6901-escaped-name>`, making the flat map injective without depending on map order.

**[A]** Duplicate effective parameters in the same location are upstream-invalid and exclude their smallest owning operation; legal cross-location duplicates remain independently supplied through §7's qualified mode ([OAS 3.2.0 §§4.9.1, 4.10.1, 4.12](https://spec.openapis.org/oas/v3.2.0.html#operation-parameters)).

**[B — limit]** Two effective header parameters whose names differ only by ASCII case exclude the selected target permanently under this identifier because OAS parameter identity is case-sensitive while HTTP field names are case-insensitive; the wire cannot preserve the distinction ([OAS 3.2.0 §§3.2, 4.12.2.1](https://spec.openapis.org/oas/v3.2.0.html#case-sensitivity), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — convention]** Every unknown caller-envelope parameter key refuses before dispatch, regardless of whether a body exists; no unmatched-field passthrough exists.

**[A]** Missing required parameters and a missing `required: true` request body refuse before dispatch; path parameters are always required ([OAS 3.2.0 §§4.12.2.1, 4.13.1](https://spec.openapis.org/oas/v3.2.0.html#parameter-required)).

**[A]** A request body is fully supported where RFC 9110 explicitly defines body semantics; where HTTP discourages content, including GET and DELETE, OAS permits `requestBody` but says its semantics are not well-defined and it should be avoided ([OAS 3.2.0 §4.10.1](https://spec.openapis.org/oas/v3.2.0.html#operation-request-body)).

**[B — convention]** The binding preserves any supplied declared body in those permitted cases rather than deleting it; preservation is the least-authored reading because the artifact permits the body and supplies no instruction to ignore it.

## 8. Parameter serialization

### 8.1 Effective declarations and scalar conversion

**[A]** Operation parameters override Path Item parameters only at the same exact name-plus-location identity, and every remaining effective `path`, `query`, `querystring`, `header`, or `cookie` Parameter Object governs its own contribution ([OAS 3.2.0 §§4.9.1, 4.10.1, 4.12.1](https://spec.openapis.org/oas/v3.2.0.html#parameter-locations)).

**[A]** A Header Parameter whose name ASCII-case-insensitively denotes `Accept`, `Content-Type`, or `Authorization` MUST be ignored and creates no effective parameter, caller-envelope key, or emitted field ([OAS 3.2.0 §§3.2, 4.12.2.1](https://spec.openapis.org/oas/v3.2.0.html#parameter-name), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — configuration point]** For `schema`-form Parameter serialization and §9.3 Encoding/style serialization of form or multipart property values, `parameterConversion` is the same deterministic consumer-supplied conversion from each supplied JSON boolean or number to a string; strings pass identically, and any supplied boolean or number without a configured conversion refuses before dispatch ([OAS 3.2.0 Appendix B](https://spec.openapis.org/oas/v3.2.0.html#appendix-b-data-type-conversion)).

**[B — configuration point]** This specification defines no partial canonicalization default for `parameterConversion`; the boolean/number conversion rule applies recursively to array members and object values before serialization and MUST be deterministic for every accepted boolean or number, while strings remain identical and null follows §8.2 without entering the converter.

**[A]** JSON null is an RFC 6570 undefined value on this line, not an absent caller value and not an empty string; for every admitted `style`/`explode` cell, it serializes exactly as the `undefined` column in §8.2's table ([OAS 3.2.0 §4.12.6](https://spec.openapis.org/oas/v3.2.0.html#style-examples), [RFC 6570 §2.3](https://www.rfc-editor.org/rfc/rfc6570#section-2.3)).

### 8.2 Closed `style`, `explode`, and undefined-value table

**[A]** The following table is the complete admitted `schema`-form matrix; `operator` states the RFC 6570 mapping where one exists, and each `undefined` entry is the exact serialization for a supplied JSON null. For `deepObject`, any explicit `explode` is ignored because the field has no effect; otherwise a style/location/shape, explicit `explode`, or undefined-value combination outside these cells refuses before dispatch ([OAS 3.2.0 §§4.12.2.2, 4.12.3, 4.12.6, Appendix C.1](https://spec.openapis.org/oas/v3.2.0.html#style-values)):

| style | location | admitted shapes | explode | operator | undefined serialization |
| --- | --- | --- | --- | --- | --- |
| **[A]** `matrix` | path | primitive, array, object | `false` | `;` | `;name` |
| **[A]** `matrix` | path | primitive, array, object | `true` | `;` plus `*` | `;name` |
| **[A]** `label` | path | primitive, array, object | `false` | `.` | `.` |
| **[A]** `label` | path | primitive, array, object | `true` | `.` plus `*` | `.` |
| **[A]** `simple` | path, header | primitive, array, object | `false` | none | empty serialization |
| **[A]** `simple` | path, header | primitive, array, object | `true` | `*` | empty serialization |
| **[A]** `form` | query, cookie | primitive, array, object | `false` | `?` (`+` when `allowReserved: true`) | `name=` |
| **[A]** `form` | query, cookie | primitive, array, object | `true` | `?` plus `*` (`+` manually when reserved) | `name=` |
| **[A]** `spaceDelimited` | query | array, object | `false` | OAS bytes | `n/a` — refuse |
| **[A]** `pipeDelimited` | query | array, object | `false` | OAS bytes | `n/a` — refuse |
| **[A]** `deepObject` | query | object with scalar properties | `n/a` — ignored | OAS bytes | `n/a` — refuse |
| **[A]** `cookie` | cookie | primitive, array, object | `false` | RFC 6265 bytes | `name=` |
| **[A]** `cookie` | cookie | primitive, array, object | `true` | RFC 6265 bytes | `name=` |

**[A]** Default style is `form` for query and cookie and `simple` for path and header; default `explode` is `true` for `form` and `cookie` and `false` otherwise; `allowReserved` applies only where the destination/style percent-encodes ([OAS 3.2.0 §4.12.2.2](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-for-use-with-schema)).

**[A]** RFC 6570 serialization MUST use the table's operator, `*` for `explode: true`, and a comma for non-exploded label lists/maps. Multiple regular form-style query parameters share one `?` variable list; separately expanding multiple `?` templates is not conformant ([OAS 3.2.0 Appendix C.1](https://spec.openapis.org/oas/v3.2.0.html#equivalences-between-fields-and-rfc6570-operators)).

**[A]** Because RFC 6570 prefix operators cannot combine, a query mixing regular form expansion with `allowReserved: true` MUST be constructed manually per parameter: reserved-permitting values use reserved expansion, and `[`, `]`, `#`, `&`, `=`, and `+` are pre-percent-encoded where Appendix C requires ([OAS 3.2.0 Appendix C.3–C.4.2](https://spec.openapis.org/oas/v3.2.0.html#non-rfc6570-field-values-and-combinations)).

**[B — convention]** The manual path assembles all present per-parameter contributions into one query component with one leading `?` and `&` between contributions; this assembled result is the single-query rule's equivalent at the authority's construction seam.

**[A]** A Parameter name that is not a legal RFC 6570 variable name MUST be percent-encoded before use in the template construction ([OAS 3.2.0 Appendix C.3–C.4.4](https://spec.openapis.org/oas/v3.2.0.html#illegal-variable-names-as-parameter-names)).

**[B — convention]** That variable-name encoding is internal to URL assembly and never changes the exact caller-envelope key defined by §7.

**[A]** For `spaceDelimited`, `pipeDelimited`, and `deepObject`, the exact bytes are the corresponding OAS Style Examples: delimiters and deep-object brackets are percent-encoded, object names and values retain their shown alternation, and no unstated escape convention is added ([OAS 3.2.0 §§4.12.4, 4.12.6](https://spec.openapis.org/oas/v3.2.0.html#style-examples)).

**[B — convention]** Before dispatch, the binding refuses a supplied parameter or property name or scalar value containing its non-RFC style's structural delimiter: U+0020 SPACE for `spaceDelimited`, `|` for `pipeDelimited`, or any of `[`, `]`, `=`, and `&` for `deepObject`; no escape-convention configuration point is offered.

**[B — exclusion]** An explicit `explode` value in a Style Examples `n/a` cell excludes that parameter; otherwise a compound-capable style is excluded only when its resolved declaration proves an unsupported compound member—an array whose resolved `items` schema declares only `object` or `array`, or an object with at least one declared property whose resolved schema declares only `object` or `array`. A typeless member proves no compound shape, a choice with multiple non-null possibilities supplies no single resolved member schema, and an object declaring no properties proves no compound member, so none triggers this exclusion; in particular, a declaration that still admits a scalar is never excluded, and candidate admission never inspects the supplied runtime value. The rule applies symmetrically to every compound-capable Parameter style and to §9.3's Encoding style path, where the smallest owner is the selected media alternative rather than the target. OAS/RFC 6570 defines no expansion for the excluded cells, so the owning unit is excluded permanently under this identifier unless an incorporated authority defines that exact cell ([OAS 3.2.0 §§4.12.3, 4.12.6, Appendix C.1](https://spec.openapis.org/oas/v3.2.0.html#style-values), [RFC 6570 §3.2.1](https://www.rfc-editor.org/rfc/rfc6570#section-3.2.1)).

**[A]** Every path-template expression MUST have one corresponding effective path parameter, MUST occur no more than once, and an expanded path value containing unescaped `/`, `?`, or `#` refuses before dispatch ([OAS 3.2.0 §4.8.2](https://spec.openapis.org/oas/v3.2.0.html#path-templating)).

**[A]** Completed URL parsing and percent-decoding follow RFC 3986; `application/x-www-form-urlencoded` query content also parses and percent-decodes under the pinned WHATWG URL rules, including unescaped `+` as space, while structural delimiters remain encoded or unencoded exactly as OAS requires ([OAS 3.2.0 §4.12.4](https://spec.openapis.org/oas/v3.2.0.html#url-percent-encoding), [WHATWG URL](https://url.spec.whatwg.org/)).

### 8.3 Content-form, querystring, empty, header, and cookie parameters

**[A]** A `content`-form Parameter Object MUST contain exactly one media-type entry; its application value serializes under that entry, and when a non-`querystring` contribution enters a URL the resulting representation is percent-encoded as one parameter value ([OAS 3.2.0 §§4.12.2.3, 4.12.4](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-for-use-with-content)).

**[A]** One effective `querystring` Parameter is permitted and it is mutually exclusive with every ordinary query Parameter on the operation and Path Item; it MUST use `content`, its declared `name` is not serialized, and its selected media representation supplies the entire query string. For `application/x-www-form-urlencoded`, Encoding Objects apply exactly as for a request body of that media type and the resulting representation receives no further encoding or escaping ([OAS 3.2.0 §§4.12.1, 4.12.2.1](https://spec.openapis.org/oas/v3.2.0.html#parameter-locations), [§4.15.3](https://spec.openapis.org/oas/v3.2.0.html#encoding-the-x-www-form-urlencoded-media-type)).

**[B — exclusion]** A `querystring` media entry whose format has no serialization incorporated by this specification excludes only that parameter lane; this exclusion is permanent under this identifier and reopens only when a pinned authority incorporated by this specification defines that mapping.

**[A]** For a query parameter with `allowEmptyValue: true`, a supplied empty string emits a present zero-length value; absence still means omitted, the empty string remains distinct from §8.2's undefined null, and this binding infers no schema-validity consequence because OAS leaves that interaction implementation-defined ([OAS 3.2.0 §§4.12.2.1, 4.12.6](https://spec.openapis.org/oas/v3.2.0.html#parameter-allow-empty-value)).

**[A]** Header `schema` serialization performs no URI percent-encoding and adds no automatic quotes; header and `style: cookie` parsing does not decode apparent percent encodings ([OAS 3.2.0 §4.12.2.2](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-for-use-with-schema)).

**[A]** `style: cookie` follows RFC 6265 Cookie syntax: contributions preserve exact names and values, use `; ` between pairs, and apply no percent-encoding or other escaping; values needing escaping MUST arrive already escaped ([OAS 3.2.0 §4.12.3](https://spec.openapis.org/oas/v3.2.0.html#style-values), [RFC 6265](https://httpwg.org/specs/rfc6265.html)).

**[B — convention]** An effective Header Parameter named `Cookie` supplies one raw Cookie field only when no effective cookie-location Parameter and no selected cookie credential contributes; the binding does not parse or merge the raw string, and a raw/structured collision refuses the target or makes the selected credential alternative unusable.

**[B — limit]** An effective Header Parameter named `Host` or `Content-Length` excludes the target because those fields are processor-owned and cannot be replaced by caller input.

## 9. Request and response media

### 9.1 Media identity, alternatives, and request election

**[A]** Media types parse under RFC 9110: type, subtype, and parameter names compare case-insensitively while parameter values retain their media-defined comparison rules ([RFC 9110 §§8.3.1, 8.3.2](https://www.rfc-editor.org/rfc/rfc9110#section-8.3.1)).

**[B — convention]** A declaration matches a concrete media type only when every declared parameter is present with an equal value; matches order by exact type/subtype before `type/*` before `*/*`, then by greatest declared-parameter count, and equal-specificity ties refuse.

**[B — limit]** Distinct content-map keys that normalize to one parsed media identity collide only for that identity and refuse selection through it; non-colliding entries survive, and map order never breaks the tie.

**[A]** A no-body invocation bypasses request-body media selection and emits neither a body nor `Content-Type`, because an absent optional Request Body contributes no HTTP content ([OAS 3.2.0 §§4.10.1, 4.13.1](https://spec.openapis.org/oas/v3.2.0.html#request-body-object)).

**[B — configuration point]** A body-emitting invocation preserves every admissible declared request alternative: a sole concrete declaration selects itself; multiple declarations or a range-only declaration require a concrete `requestMedia` choice before input consumption; the choice MUST match under §9.1 and never substitutes another declaration's schema.

**[B — configuration point]** A missing required choice, unmatched or ambiguous choice, unsupported selected lane, or body-emitting invocation with no admissible candidate refuses before dispatch; no body bytes, media registry entry, or example is sniffed to select a lane.

**[A]** A content-map Media Type Object or `components.mediaTypes` reference MUST resolve before lane selection; examples distinguish data and serialized forms but never select a declaration, carriage lane, or media type ([OAS 3.2.0 §§4.7.1, 4.14.1, 4.19](https://spec.openapis.org/oas/v3.2.0.html#media-type-object)).

**[B — limit]** The live OpenAPI Media Type Registry does not widen this pinned identifier: OAS makes support for later registry additions optional, so only media behavior defined by incorporated pinned authority is available ([OAS 3.2.0 §4.14.2.1](https://spec.openapis.org/oas/v3.2.0.html#openapi-media-type-registry)).

**[B — convention]** The binding sends no `Accept` header: OAS ignores a Header Parameter named `Accept`, request-body content declares what the operation consumes, and response content supplies no portable instruction to advertise a preference ([OAS 3.2.0 §§4.12.2.1, 4.13, 4.17](https://spec.openapis.org/oas/v3.2.0.html#parameter-name)).

### 9.2 Common carriage lanes

**[A]** A non-sequential exact `application/json` or `+json` selection serializes the supplied value as strict JSON on requests and parses strict JSON on responses; JSON text uses UTF-8 ([RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)).

**[B — convention]** `text/json` is not a member of that JSON lane; as a `text/*` type it can use the character-data lane only when its schema declares `type: string`. This convention reopens under a new identifier only if the IANA media-type registry registers `text/json` with JSON semantics.

**[B — convention]** A concrete character-data selection governed by a schema declaring `type: string` carries the supplied string under its declared `charset`, defaulting to UTF-8; the closed character-data set is `text/*`, `application/xml`, and `+xml`, while `application/json`, `+json`, and §9.5's sequential forms are claimed by their own lanes ([RFC 6838 §4.2.1](https://www.rfc-editor.org/rfc/rfc6838#section-4.2.1), [RFC 2046 §4.1](https://www.rfc-editor.org/rfc/rfc2046#section-4.1), [RFC 7303 §§3, 9](https://www.rfc-editor.org/rfc/rfc7303#section-3)).

**[B — convention]** The charset parameter is the only character-encoding source this lane consults; BOMs and XML declarations do not alter it, and unsupported or invalid character decoding refuses.

**[A]** OAS 3.2 describes raw binary by omitting Schema Object `type`; a non-JSON, non-form concrete selection whose Media Type Object omits `schema`, or whose present schema declares no `type`, therefore uses the raw-octet lane. A schema-omitted media range does not gain this lane because it declares no single concrete representation ([OAS 3.2.0 §§4.13.2, 4.24.4.2, 4.24.4.3](https://spec.openapis.org/oas/v3.2.0.html#working-with-binary-data)).

**[A]** Every other keyword in a no-`type` schema still applies, and `maxLength` on raw content measures wire octets rather than the Base64 boundary string ([OAS 3.2.0 §§4.14.3.2, 4.24.4.3](https://spec.openapis.org/oas/v3.2.0.html#binary-streams)).

**[A]** A schema declaring `type: string` with `contentEncoding` carries the caller's artifact-encoded string as text and does not trigger OpenBindings Base64 decoding; `contentMediaType` is ignored when it contradicts the governing Media Type or Encoding Object, and schema encoding is distinct from HTTP `Content-Encoding` ([OAS 3.2.0 §4.24.4.3](https://spec.openapis.org/oas/v3.2.0.html#working-with-binary-data)).

**[A]** For a non-JSON text serialization, the binding determines each value's type by following the applicable `$ref` and `allOf` closure and by inspecting validated runtime data when available; OAS leaves the result implementation-defined when those sources do not determine one type ([OAS 3.2.0 §4.24.4.2](https://spec.openapis.org/oas/v3.2.0.html#non-json-data)).

**[B — limit]** If that type ambiguity remains when serialization or parsing is required, the invocation or response decoding fails rather than choosing one privately; a declaration remains usable when validated runtime data resolves its type.

**[B — pin]** Every OpenBindings raw-octet value is a JSON string containing canonical RFC 4648 §4 Base64: standard alphabet, required padding, no ignored non-alphabet characters, and zero unused pad bits; requests decode before dispatch and responses encode the exact octets ([RFC 4648 §§3.3, 3.5, 4](https://www.rfc-editor.org/rfc/rfc4648)).

**[B — exclusion]** This specification does not generate XML from an object model because OAS 3.2 still leaves ordinary object-node order and null serialization implementation-defined and identifies adjacent text nodes as ambiguous; the selected media alternative is excluded permanently under this identifier until incorporated authority defines those remaining bytes, while string and raw-octet XML carriage remain admitted ([OAS 3.2.0 §§4.26.1, 4.26.2.2, 4.26.5](https://spec.openapis.org/oas/v3.2.0.html#xml-object)).

**[B — convention]** Because `readOnly` and `writeOnly` are annotations whose enforcement OAS leaves to the application, this binding never uses them to delete a supplied wire member or synthesize an absent one ([OAS 3.2.0 §4.24.5.2](https://spec.openapis.org/oas/v3.2.0.html#validating-readonly-and-writeonly)).

### 9.3 Form bodies, multipart parts, and Encoding Objects

**[A]** `application/x-www-form-urlencoded` and name-based `multipart` serialization map object properties through the governing Schema and Encoding Objects; array properties repeat the same name in item order, cross-property pair order is implementation-defined, and an `encoding` key with no corresponding property is ignored ([OAS 3.2.0 §4.14.5.1](https://spec.openapis.org/oas/v3.2.0.html#encoding-by-name)).

**[A]** Encoding `style`, `explode`, and `allowReserved` controls apply only to form-urlencoded and multipart/form-data; explicit presence of any control selects the §8.2 style path and ignores `contentType`, while absence of all three selects content-based encoding under the explicit or default `contentType` ([OAS 3.2.0 §§4.15.1.1, 4.15.1.2](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-for-rfc6570-style-serialization)).

**[A]** Form-urlencoded content uses the pinned WHATWG URL algorithm after each complex value is serialized; its style path removes RFC 6570's leading `?`. Multipart style serialization places names in `Content-Disposition`, values in part bodies, applies no URI percent-encoding, and gives `allowReserved` no effect ([OAS 3.2.0 §§4.12.4, 4.15.3, Appendix C](https://spec.openapis.org/oas/v3.2.0.html#encoding-the-x-www-form-urlencoded-media-type), [WHATWG URL](https://url.spec.whatwg.org/)).

**[A]** Encoding `contentType` defaults are exactly: omitted `type` or string with `contentEncoding` → `application/octet-stream`; plain string, number, integer, or boolean → `text/plain`; object or array → `application/json`. An explicit single concrete value fixes the part type ([OAS 3.2.0 §4.15.1.1](https://spec.openapis.org/oas/v3.2.0.html#common-fixed-fields-0)).

**[B — limit]** A supplied null reaching content-based encoding with neither an explicit concrete `contentType` nor a determined default refuses that invocation before dispatch because the authority supplies no part media type; other values and alternatives remain usable, and no private null default is available under this identifier.

**[B — configuration point]** A wildcard or comma-separated multi-valued Encoding `contentType` requires a concrete per-value `partMedia` choice; the choice MUST satisfy one declared member under §9.1, and an absent, unmatched, or ambiguous required choice refuses before dispatch.

**[A]** A no-`type` part uses the raw-octet lane and §9.2's canonical Base64 boundary; a string part with `contentEncoding` remains artifact-encoded text. For multipart, that `contentEncoding` also declares the equivalent `Content-Transfer-Encoding`, and an explicit Encoding header that disallows the value makes serialization undefined ([OAS 3.2.0 §§4.15.4.2, 4.24.4.3](https://spec.openapis.org/oas/v3.2.0.html#content-transfer-encoding-and-contentencoding)).

**[B — exclusion]** Such an explicit Encoding-header contradiction excludes only the selected media alternative; the exclusion is permanent under this identifier and reopens only if incorporated authority defines the contradictory serialization.

**[A]** Name-based `encoding` is mutually exclusive with `prefixEncoding` and `itemEncoding`. Positional encoding applies only to `multipart`, requires `itemSchema` or an array `schema`, models one part per array item in order, applies each `prefixEncoding` entry to its corresponding position, ignores surplus prefix entries, and applies `itemEncoding` to every remaining item ([OAS 3.2.0 §§4.14.1, 4.14.5.2](https://spec.openapis.org/oas/v3.2.0.html#encoding-by-position)).

**[C]** A violation of those mutual-exclusion, media-scope, or positional-prerequisite rules makes only the selected media alternative unavailable; sibling alternatives and unrelated targets survive under §3.2's confinement rule.

**[A]** Positional `multipart/form-data` has no property name to infer part names; each applicable Encoding Object therefore MUST declare a `Content-Disposition` header supplying the part name, and the binding never invents one ([OAS 3.2.0 §4.14.5.3](https://spec.openapis.org/oas/v3.2.0.html#additional-encoding-approaches), [RFC 7578 §4.2](https://www.rfc-editor.org/rfc/rfc7578#section-4.2)).

**[B — limit]** Encoding `headers` are descriptive at this operation boundary and produce no caller channel: the binding emits only a header value fixed completely by the artifact and never emits an undeclared header or `Content-Transfer-Encoding`; a positional form-data name or other required part header that the artifact does not fix leaves the selected alternative unavailable.

**[A]** An Encoding Object's nested `encoding`, `prefixEncoding`, and `itemEncoding` fields apply recursively, and every processor MUST support one level of nesting ([OAS 3.2.0 §4.15.2](https://spec.openapis.org/oas/v3.2.0.html#nested-encoding)).

**[B — exclusion]** A selected media alternative requiring more than one nested Encoding level is excluded because OAS makes deeper support optional; the exclusion belongs only to that alternative, is permanent under this identifier, and reopens only if an incorporated authority requires the deeper level.

### 9.4 HTTP content codings

**[A]** HTTP `Content-Encoding` is distinct from media type and from Schema Object `contentEncoding`; request codings apply in listed wire order and response codings decode in reverse order before the selected media lane ([RFC 9110 §8.4](https://www.rfc-editor.org/rfc/rfc9110#section-8.4), [OAS 3.2.0 §4.24.4.3](https://spec.openapis.org/oas/v3.2.0.html#working-with-binary-data)).

**[A]** The artifact declaration surfaces are an effective request Header Parameter named `Content-Encoding` and a governing response Header Object of that name; field-name comparison is ASCII case-insensitive ([OAS 3.2.0 §§3.2, 4.12, 4.17](https://spec.openapis.org/oas/v3.2.0.html#header-object), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — configuration point]** `requestContentCodings` and `responseContentCodings` are finite consumer maps from case-insensitive content-coding tokens to deterministic encoders and decoders; the artifact-declared field value fixes the ordered stack, and no configuration preference narrows its declared alternatives.

**[B — configuration point]** An unsupported token, a field value not admitted by its governing Header declaration, an ambiguous coding declaration, or an actual response coding with no governing Header Object refuses rather than being skipped or sniffed; configuring a codec supplies capability but never declares a coding the artifact omitted.

### 9.5 Sequential media and server-sent events

**[A]** OAS sequential media consist of a repeating structure with no modeled header, footer, envelope, or other metadata; the sequence maps to a JSON array in wire order. This binding incorporates the forms OAS 3.2 itself defines: `application/jsonl`, `application/x-ndjson`, `application/json-seq`, `+json-seq`, `text/event-stream`, and positional `multipart` sequences ([OAS 3.2.0 §§4.14.3.1, 4.14.5.2, 4.14.6.2](https://spec.openapis.org/oas/v3.2.0.html#sequential-media-types), [RFC 7464](https://www.rfc-editor.org/rfc/rfc7464), [RFC 8091](https://www.rfc-editor.org/rfc/rfc8091)).

**[B — exclusion]** A purported sequential media type whose item framing is not defined by incorporated pinned authority is unavailable because neither payload sniffing nor the live media registry may supply missing framing; the exclusion belongs to that selected alternative and reopens only when its framing authority is incorporated under a new identifier.

**[A]** `schema`, when present, applies to the complete sequence as its ordered JSON array; `itemSchema`, when present, applies independently to each item, and both MAY coexist ([OAS 3.2.0 §§4.14.1, 4.14.3](https://spec.openapis.org/oas/v3.2.0.html#complete-vs-streaming-content)).

**[A]** A sequential request consumes exactly one caller `body` value: the JSON array in media order. Serialization emits one media item per array element; `schema` governs the complete array and `itemSchema` governs each emitted element, so request streaming never changes the unary caller-input boundary ([OAS 3.2.0 §§4.14.3.1, 4.14.3.1.1](https://spec.openapis.org/oas/v3.2.0.html#streaming-sequential-media-types)).

**[A]** A sequential response is server-streaming and emits one successful operation value for each parsed item in order; `itemSchema` governs each value independently, while a co-present `schema` remains an aggregate constraint over the complete ordered sequence ([OAS 3.2.0 §§4.14.3.1, 4.14.3.1.1](https://spec.openapis.org/oas/v3.2.0.html#streaming-sequential-media-types), Core [§5.1](../../openbindings.md#51-operations)).

**[B — convention]** A malformed or `itemSchema`-invalid item is not emitted and ends the interaction unsuccessfully; earlier emitted values remain successful values. A complete-sequence `schema` failure likewise ends the interaction unsuccessfully when detected and does not retract values already emitted.

**[A]** `text/event-stream` MUST first be parsed under OAS's incorporated event-stream processing rules, including ignored comments and fields, multi-line data combination, and field-specific parsing. Each item is then an object with required string `data`, optional string `event` and `id`, and optional nonnegative integer `retry`; no field is collapsed into a data-only value ([OAS 3.2.0 §§4.14.4, 4.14.6.3](https://spec.openapis.org/oas/v3.2.0.html#special-considerations-for-server-sent-events)).

**[A]** Non-sequential media remain unary: one HTTP response body produces at most one operation value ([OAS 3.2.0 §4.14.3](https://spec.openapis.org/oas/v3.2.0.html#complete-vs-streaming-content)).

### 9.6 Response declaration, classification, and decoding

**[A]** Response keys are closed to exact HTTP status codes, the five ranges `1XX` through `5XX`, `default`, and specification extensions; an exact key overrides its matching range ([OAS 3.2.0 §§4.16.1–4.16.3](https://spec.openapis.org/oas/v3.2.0.html#responses-object)).

**[B — convention]** The governing Response Object lookup order is exact status, then the single matching range, then `default`; range-over-default is this specification's reading, and declarations never reclassify the native status.

**[A]** Success is the final RFC 9110 status in the 2xx class ([RFC 9110 §15.3](https://www.rfc-editor.org/rfc/rfc9110#section-15.3)).

**[B — convention]** Redirect following is runtime policy; a followed redirect MUST preserve the bound method and complete body, while a method-rewriting redirect is treated as the final response ([RFC 9110 §15.4](https://www.rfc-editor.org/rfc/rfc9110#section-15.4)).

**[A]** A 3.2 Response Object may carry `summary` and optional `description`; neither field is required for the response declaration to govern ([OAS 3.2.0 §4.17.1](https://spec.openapis.org/oas/v3.2.0.html#fixed-fields-14)).

**[A]** A non-empty response selects its concrete media type from `Content-Type` and then the most-specific matching governing content declaration; an unmatched, ambiguous, or normalized-colliding result is a protocol error ([OAS 3.2.0 §§4.16, 4.17](https://spec.openapis.org/oas/v3.2.0.html#response-object)).

**[B — convention]** When a non-empty response omits `Content-Type`, the binding takes RFC 9110's permitted `application/octet-stream` assumption before ordinary matching; the resulting type still MUST match a governing declaration ([RFC 9110 §8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3)).

**[C]** Empty responses emit no output value; failure bodies use the same selected lanes and remain opaque application-authored failure data.

**[B — limit]** A non-empty response with no governing Response Object is a loud protocol error, even though omission of `responses` leaves the operation addressable; response headers and Link Objects have no operation-value representation under this identifier ([OAS 3.2.0 §§4.10.1, 4.17](https://spec.openapis.org/oas/v3.2.0.html#operation-responses)).

## 10. Servers and target URL

**[A]** Server declarations are scoped at Operation, Path Item, and root levels, with the more specific declaration overriding the outer scope; an absent or empty root list is equivalent to one Server Object whose URL is `/` ([OAS 3.2.0 §§4.1.1, 4.5, 4.9.1, 4.10.1](https://spec.openapis.org/oas/v3.2.0.html#server-object)).

**[B — convention]** An empty Operation or Path Item `servers` array supplies no local alternative and falls through to the next outer scope, matching the root empty-equals-absent precedent.

**[B — configuration point]** One effective server selects itself; multiple members require one consumer `server` choice before dispatch, the same value carries exact variable substitutions, and no member, optional `name`, or variable preference is inferred.

**[A]** Server variables substitute their declared value, use `default` when no consumer value is supplied, and MUST satisfy a nonempty declared `enum`; an unresolved variable refuses before dispatch ([OAS 3.2.0 §4.6.1](https://spec.openapis.org/oas/v3.2.0.html#server-variable-object)).

**[A]** Server URLs satisfy the 3.2 Server URL field rules, may be relative to the retrieval location of the document containing the Server Object, and MUST contain neither query nor fragment. The root `$self` identifies the OpenAPI document and MUST NOT replace that retrieval-URI base for API URLs ([OAS 3.2.0 §§4.5.1, 4.5.2](https://spec.openapis.org/oas/v3.2.0.html#relative-references-in-api-urls)).

**[A]** After resolving and expanding the selected Server URL, the operation path is appended verbatim with no second relative-reference resolution, slash normalization, or path repair ([OAS 3.2.0 §4.8.1](https://spec.openapis.org/oas/v3.2.0.html#paths-path)).

**[B — limit]** When embedded content has no `location` to supply the API URL base, a relative Server URL leaves the target unresolved even if `$self` is absolute and refuses before dispatch; the complete configured URL below remains the available recovery.

**[A]** After path and query serialization, the completed target MUST parse and percent-decode under RFC 3986; an unusable target refuses before dispatch ([OAS 3.2.0 §§4.8.2, 4.12.4](https://spec.openapis.org/oas/v3.2.0.html#url-percent-encoding), [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)).

**[C]** A complete configured URL MAY replace the selected target without replacing the artifact's method, parameters, body, response, or security semantics (Core [§5.3](../../openbindings.md#53-bindings)).

## 11. Security and channel assembly

**[A]** Operation `security` replaces root `security`; `[]` means no security requirement, array members are OR alternatives, every nonempty Security Requirement Object is an AND of its named schemes, and `{}` is a complete anonymous alternative ([OAS 3.2.0 §§4.10.1, 4.30](https://spec.openapis.org/oas/v3.2.0.html#security-requirement-object)).

**[B — configuration point]** The binding preserves every complete alternative and invents no anonymous-versus-credentialed preference; the consumer selects one complete alternative, and fragments from different alternatives are never combined.

**[A]** Requirement arrays for OAuth 2.0 and OpenID Connect contain scopes, arrays for other schemes may contain roles, and this binding surfaces those exact strings without interpreting roles in-band or executing acquisition flows ([OAS 3.2.0 §4.30.1](https://spec.openapis.org/oas/v3.2.0.html#security-requirements-name)).

**[A]** Each Security Requirement name first matches an exact entry-document Security Scheme component name; if no component name matches, it MUST be a URI identifying a Security Scheme Object, and `./` disambiguates a single-segment relative URI from a colliding component name ([OAS 3.2.0 §4.30](https://spec.openapis.org/oas/v3.2.0.html#security-requirement-object)).

**[B — configuration point]** For a component-name requirement occurring in a referenced non-entry document, `implicitConnectionScope` selects `entry` or `referring` resolution and defaults to `entry`, preserving OAS's implementation-defined multi-document choice while following its recommendation; URI-identified requirements bypass this point ([OAS 3.2.0 §§4.1.2.3, Appendix G.3](https://spec.openapis.org/oas/v3.2.0.html#resolving-implicit-connections)).

**[A]** HTTP authentication-scheme tokens compare ASCII case-insensitively ([RFC 9110 §11.1](https://www.rfc-editor.org/rfc/rfc9110#section-11.1), [OAS 3.2.0 §4.27.1](https://spec.openapis.org/oas/v3.2.0.html#security-scheme-scheme)).

**[A]** `apiKey` credentials use their declared name and location, and HTTP `basic` and `bearer` credentials use the `Authorization` field ([OAS 3.2.0 §4.27](https://spec.openapis.org/oas/v3.2.0.html#security-scheme-object), [RFC 9110 §11.6.2](https://www.rfc-editor.org/rfc/rfc9110#section-11.6.2)).

**[B — pin]** A selected `basic` scheme consumes the runtime's `auth.basic` credential context and constructs `Authorization: Basic base64(user-id ":" password)` under [RFC 7617 §2](https://www.rfc-editor.org/rfc/rfc7617#section-2), including its user-id, password, character-encoding, and Base64 constraints.

**[B — convention]** `mutualTLS` is a transport prerequisite rather than a header credential; a selected alternative requiring it is complete only when the runtime has established the declared client-certificate condition.

**[B — pin]** OAuth 2.0 and OpenID Connect access tokens use the `Bearer` authorization scheme under [RFC 6750 §2.1](https://www.rfc-editor.org/rfc/rfc6750#section-2.1); another token type has no wire carriage under this identifier.

**[B — limit]** Any other declared HTTP authentication scheme remains visible as a consumer prerequisite, but this binding synthesizes no credential bytes for it; an alternative requiring it is unusable unless the runtime satisfies it as a complete prerequisite.

**[C]** Credentials and credential-acquisition state MUST NOT be embedded in an OBI document (Core [§9](../../openbindings.md#9-security-considerations)).

**[B — convention]** A credential destination that collides with an effective parameter, another credential in the same AND requirement, binding/processor-owned `Host`, `Content-Length`, `Content-Type`, or `Accept`, or a raw `Cookie` field makes only the selected security alternative unusable; another complete non-colliding alternative may still be selected, while §8.3 governs parameter-only processor-owned and raw/structured collisions.

**[B — convention]** Header names compare ASCII case-insensitively, cookie names compare exactly, and structured cookie contributions preserve membership and join as `name=value` separated by `; `; cookie order is not portable meaning ([RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1), [OAS 3.2.0 §4.12.3](https://spec.openapis.org/oas/v3.2.0.html#style-values)).

## 12. Configuration, synthesis, and conformance

### 12.1 Configuration vocabulary

**[B — configuration point]** The complete binding-specific configuration vocabulary is `requestMedia` (one concrete media type), `server` (one effective Server alternative plus exact variable values), `parameterConversion` (deterministic boolean/number converter), `implicitConnectionScope` (`entry` or `referring`), `requestContentCodings` (coding-to-encoder map), `responseContentCodings` (coding-to-decoder map), and conditional `partMedia` (concrete media type per affected encoded value).

**[B — configuration point]** Every requirement is typed, discoverable from declarations, and preflightable; no configuration member appears in the caller envelope or operation contract, and decode and classification are fixed rules rather than configuration points.

### 12.2 Synthesis boundary and coverage

**[C]** Operation contracts remain protocol-neutral and MAY remain flat; synthesis emits an `inputTransform` that constructs §7's envelope, and transforms never route values to HTTP locations (Core [§5.5](../../openbindings.md#55-transforms)).

**[B — convention]** This binding defines no status, header, selected-media, or other context bindings at `inputTransform` or `outputTransform` positions; evaluation uses Core's closed environment unaugmented (Core [§5.5 clause 5](../../openbindings.md#55-transforms), [OBI-T-10](../../openbindings.md#103-tool-rules)).

**[B — limit]** Operation/dependency key spelling, flattening, output-schema choice, and Schema Object translation are synthesis policy, not binding semantics; no dynamic-object trigger, declaration-complex trigger, dialect trigger, `body.properties`, `body.whole`, routed tuple, or unmatched-field passthrough exists.

**[C]** A synthesizer MUST account for every fixed or additional addressable operation and every callback/webhook dependency as represented, excluded with §12.3's exact reason, or unsupported; a failure in an unused description position is coverage loss rather than invocation behavior (Core [OBI-B-02](../../openbindings.md#104-binding-specification-rules)).

**[C]** Every binding-specific configuration requirement remains in coverage accounting and invocation context, assigned to its represented target or declared alternative, and MUST NOT enter the operation input schema (Core [OBI-B-02](../../openbindings.md#104-binding-specification-rules)).

**[C]** Dependencies are synthesis outputs only and add no invocation target or receiver behavior.

### 12.3 Conformance rules

**[C]** A document conforms to **OAPI32-D-01** when its `content`, if present, satisfies §§3–5 and its `location`, if present, satisfies §4.

**[C]** A binding conforms to **OAPI32-D-02** when it names `openbindings.openapi-3.2@1`, carries one literal selector form from §6.1, and identifies a source that passes the exact edition gate.

**[C]** A processor conforms to **OAPI32-P-01** when it implements the closed load gates, smallest-owner confinement, source/dialect exclusions, reference closure, and selector semantics of §§3–6.

**[C]** A processor conforms to **OAPI32-P-02** when it accepts only §7's envelope, applies §8's effective-parameter, collision, conversion, closed-style, undefined-value, content, querystring, header, cookie, and path rules, and refuses every unknown or unroutable input before dispatch.

**[C]** A processor conforms to **OAPI32-P-03** when it preserves media alternatives and applies §9's matching, request election, carriage, form, multipart, Encoding, content-coding, sequential/SSE, response lookup, classification, and value-boundary rules without sniffing or undeclared fallback.

**[C]** A processor conforms to **OAPI32-P-04** when it resolves servers and complete target URLs under §10 and security alternatives, credentials, prerequisites, and channel collisions under §11.

**[C]** A synthesizer conforms to **OAPI32-S-01** when it preserves §12.2's binding/transform boundary, emits §6.2's targetless unconstrained dependencies, and reports complete coverage under Core OBI-B-02.

**[B — exclusion]** Every exclusion in this document is permanent under `openbindings.openapi-3.2@1`, belongs to the smallest owner stated beside it, and reopens only on its stated incorporated-authority trigger; no exclusion promises later work.

## 13. Normative references

- [OpenAPI Specification 3.2.0](https://spec.openapis.org/oas/v3.2.0.html)
- [OpenAPI 3.1 base dialect, revision 2024-11-10](https://spec.openapis.org/oas/3.1/dialect/2024-11-10)
- [YAML 1.2.2](https://yaml.org/spec/1.2.2/)
- [HTTP QUERY method, draft-11](https://www.ietf.org/archive/id/draft-ietf-httpbis-safe-method-w-body-11.html)
- [WHATWG URL Standard](https://url.spec.whatwg.org/)
- [RFC 2046](https://www.rfc-editor.org/rfc/rfc2046)
- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119)
- [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)
- [RFC 4648](https://www.rfc-editor.org/rfc/rfc4648)
- [RFC 6265](https://httpwg.org/specs/rfc6265.html)
- [RFC 6570](https://www.rfc-editor.org/rfc/rfc6570)
- [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750)
- [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838)
- [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)
- [RFC 7303](https://www.rfc-editor.org/rfc/rfc7303)
- [RFC 7464](https://www.rfc-editor.org/rfc/rfc7464)
- [RFC 7578](https://www.rfc-editor.org/rfc/rfc7578)
- [RFC 7617](https://www.rfc-editor.org/rfc/rfc7617)
- [RFC 8091](https://www.rfc-editor.org/rfc/rfc8091)
- [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)
- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)
