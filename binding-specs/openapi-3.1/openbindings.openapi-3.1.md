# `openbindings.openapi-3.1` Binding Specification

## 1. Status, identifier, and rule labels

**Status: unreleased first-revision candidate.** The proposed opaque binding-specification identifier is **`openbindings.openapi-3.1@1`**.

**[C]** Publication mints that exact identifier under Core [OBI-B-01](../../openbindings.md#104-binding-specification-rules), and an incompatible change to the accepted domain or portable meaning requires a different identifier under Core [OBI-B-03](../../openbindings.md#104-binding-specification-rules).

**[A]** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) only when they appear in all capitals.

**[C]** Every normative paragraph and normative table row carries one visible provenance label: **A** is derived from incorporated authority and cites it, **C** is derived from the OpenBindings Core, and **B** is this specification's explicitly classified bridge (`convention`, `pin`, `configuration point`, `exclusion`, or `limit`).

## 2. Scope and incorporated authorities

**[A]** This specification accepts exactly OpenAPI Specification (OAS) editions [`3.1.0`](https://spec.openapis.org/oas/v3.1.0.html), [`3.1.1`](https://spec.openapis.org/oas/v3.1.1.html), and [`3.1.2`](https://spec.openapis.org/oas/v3.1.2.html); the artifact's exact `openapi` value selects its admitted edition, and no wildcard or compatible-looking value widens this closed set ([OAS 3.1.2 §4.1](https://spec.openapis.org/oas/v3.1.2.html#versions)).

**[A]** Within that closed set, observable behavior MUST NOT turn on the patch component: each accepted edition instructs tooling to support the `3.1.*` feature set uniformly and not distinguish patch versions, so corrected patch text governs a contradiction while the accepted domain remains the three exact values above ([OAS 3.1.0 §4.1](https://spec.openapis.org/oas/v3.1.0.html#versions), [3.1.1 §4.1](https://spec.openapis.org/oas/v3.1.1.html#versions), [3.1.2 §4.1](https://spec.openapis.org/oas/v3.1.2.html#versions)).

**[A]** OAS governs the artifact and every HTTP mechanic it declares, including object structure, reference resolution, parameter serialization, media declarations, server selection, responses, and security ([OAS 3.1.2 §4.8](https://spec.openapis.org/oas/v3.1.2.html#schema-0)); [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) governs the remaining HTTP semantics.

**[C]** This document defines portable binding meaning, not an invocation API: request objects, retry and redirect APIs, cancellation, credential acquisition, receiver deployment, and dependency composition remain runtime or application concerns under Core [§1.2](../../openbindings.md#12-scope).

## 3. Source carriage and refusal architecture

### 3.1 Accepted representations

**[C]** `content` is either the parsed OpenAPI document object or string content; `location` is an absolute URI for the OpenAPI document; content has primacy, a co-present location supplies its base URI, and the OBI retrieval URI is never that base (Core [§5.4](../../openbindings.md#54-sources), [§7](../../openbindings.md#7-reference-resolution)).

**[B — pin]** String content MUST parse as YAML 1.2.2, of which JSON is a subset; duplicate mapping keys, non-scalar-string mapping keys, explicit tags outside YAML's JSON-compatible tag set, and resolved values with no JSON image (`.inf`, `-.inf`, `.nan`) refuse at load ([YAML 1.2.2 §§3.2.1, 10.2.1, 10.3.2](https://yaml.org/spec/1.2.2/)).

**[A]** The tag and key gates implement the line's corrected format rule: “Tags MUST be limited to those allowed by YAML's JSON schema ruleset,” and map keys MUST be scalar strings ([OAS 3.1.2 §4.2](https://spec.openapis.org/oas/v3.1.2.html#format)).

**[A]** The root MUST be a JSON object and its `openapi` field MUST be exactly `3.1.0`, `3.1.1`, or `3.1.2`; an absent, mismatched, or unlisted value refuses at load ([OAS 3.1.2 §§4.2, 4.8.1.1](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields)).

### 3.2 Closed load gates and confined defects

**[B — limit]** The load gates are the following closed ordered set: accepted-representation grammar, scalar/tag/key resolution, JSON-object root shape, and exact edition discrimination; no condition outside this set is a load gate.

**[B — limit]** After those gates pass, and apart from §5.2's named source-scope dialect exclusion, a defect confines to the smallest selected unit that owns it; an unreachable defect destroys no target, and a whole source refuses only when every position that could contain an addressable target is defective so that no conformant selector can resolve (Core [OBI-B-03](../../openbindings.md#104-binding-specification-rules)).

**[A]** A conforming artifact that declares no operation target is accepted and synthesizes no operation: a Paths Object and a Path Item Object may each be empty, and the root may instead contain `components` or `webhooks` ([OAS 3.1.2 §§4.8.1, 4.8.8, 4.8.9](https://spec.openapis.org/oas/v3.1.2.html#openapi-object)).

**[B — limit]** A target that is addressable but unusable because of a missing choice, unsupported alternative, or exclusion refuses at invocation or is reported as synthesis coverage loss; it never becomes a whole-source load refusal.

**[A]** Unknown non-extension fields create no binding behavior and are ignored only where the governing OAS object permits them; no unknown member is guessed into a known field ([OAS 3.1.2 §4.8](https://spec.openapis.org/oas/v3.1.2.html#schema-0)).

## 4. `location`, `content`, and composition

**[C]** A present `location` MUST be an absolute URI addressing the OpenAPI document itself, and dereferencing it MUST yield an accepted representation; a bare filesystem path is not conformant (Core [OBI-D-05](../../openbindings.md#102-document-rules)).

**[C]** A present `content` MUST be one of §3.1's two representations, and no other JSON type is accepted (Core [OBI-D-01](../../openbindings.md#102-document-rules)).

**[A]** Relative non-Schema references use the containing document's base URI; Schema Object references use the nearest schema-resource base established by `$id`; JSON or YAML document fragments are JSON Pointers ([OAS 3.1.2 §§4.3, 4.6](https://spec.openapis.org/oas/v3.1.2.html#relative-references-in-api-description-uris)).

**[C]** Embedded content without a co-present `location` MUST be self-contained; a location-only source uses its location as the entry-document base.

## 5. References, dialects, and confinement

### 5.1 Reference semantics

**[A]** A reference composes its target plus the transitive closure of references reachable from that target, not unrelated material in the same retrieved document; a referenced document need not itself be a complete OpenAPI document ([OAS 3.1.2 §§4.3.1, 4.6](https://spec.openapis.org/oas/v3.1.2.html#parsing-documents), [JSON Schema Core §8.2](https://json-schema.org/draft/2020-12/json-schema-core.html#section-8.2)).

**[A]** A Schema Object `$ref` is the JSON Schema applicator and its siblings remain meaningful; a Reference Object has only its fixed `$ref`, `summary`, and `description` fields, and every added property is ignored ([OAS 3.1.2 §§4.8.23, 4.8.24](https://spec.openapis.org/oas/v3.1.2.html#reference-object)).

**[B — exclusion]** When a selected Path Item carries `$ref`, the selected operation target is excluded only if a fixed field used by that target appears in both the referenced Path Item and its adjacent declaration, because OAS defines that collision as undefined; collisions confined to unused fields and all non-colliding adjacent fields leave the target usable, and the exclusion is permanent under this identifier unless an incorporated OAS edition defines the collision ([OAS 3.1.2 §4.8.9.1](https://spec.openapis.org/oas/v3.1.2.html#path-item-ref)).

**[A]** The following confinement table applies ([OAS 3.1.2 §§4.3, 4.6, 4.8.9](https://spec.openapis.org/oas/v3.1.2.html#openapi-description-structure)):

| condition | owning unit and effect |
| --- | --- |
| **[A]** Unresolvable selected Path Item `$ref` | the referenced Path Item and its operations are unaddressable |
| **[A]** Unresolvable reference reached by one selected parameter, request body, response, server, or security requirement | that selected operation or its affected declared alternative is unusable; unrelated operations survive |
| **[A]** Unresolvable Schema Object reference reached only by one media alternative | that media alternative is unavailable; sibling alternatives survive |
| **[C]** Unresolvable reference reachable only from an unused description position | invocation is unaffected; synthesis reports the unrepresented position |
| **[C]** Defect outside the target-plus-reachable closure | no effect on that target |

### 5.2 Schema dialect

**[A]** The supported default Schema Object dialect is `https://spec.openapis.org/oas/3.1/dialect/base`; root `jsonSchemaDialect` changes the document default, and a schema-resource-root `$schema` overrides that default only within its schema resource ([OAS 3.1.2 §§4.8.24.1, 4.8.24.5](https://spec.openapis.org/oas/v3.1.2.html#specifying-schema-dialects)).

**[B — exclusion]** A root `jsonSchemaDialect` naming any other URI excludes the whole source because it changes every contained Schema Object; this exclusion is permanent under this identifier and reopens only if that exact dialect becomes incorporated authority.

**[B — exclusion]** A schema-resource-root `$schema` naming any other URI excludes only each selected unit whose reachable closure enters that resource; this exclusion is permanent under this identifier and reopens only if that exact dialect becomes incorporated authority.

## 6. Selector and inbound dependencies

### 6.1 Selector

**[B — convention]** `selector` is REQUIRED and has exactly one literal spelling: `#/paths/<escaped-path>/<lowercase-method>`, where `<escaped-path>` is the Paths Object key escaped once under [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) and `<lowercase-method>` is one of `get`, `put`, `post`, `delete`, `options`, `head`, `patch`, or `trace` (Core [OBI-D-03](../../openbindings.md#102-document-rules)).

**[A]** Selector evaluation never percent-decodes the pointer, resolves a referenced Path Item before reading the operation field, and fails unresolvable when the selected operation is absent ([OAS 3.1.2 §§3.5, 4.8.9](https://spec.openapis.org/oas/v3.1.2.html#path-item-object)).

**[A]** An operation remains addressable when it omits `responses`, because `responses` is optional in the 3.1 Operation Object ([OAS 3.1.2 §4.8.10.1](https://spec.openapis.org/oas/v3.1.2.html#operation-responses)).

### 6.2 Callbacks and webhooks

**[A]** A callback Path Item describes a request initiated by the service and expected responses, while a root webhook describes an incoming request the API consumer may implement; neither is an operation invocable through the addressed parent operation ([OAS 3.1.2 §§4.8.1.1, 4.8.10.1, 4.8.18](https://spec.openapis.org/oas/v3.1.2.html#oas-webhooks)).

**[B — convention]** Synthesis MUST represent every supported callback and webhook operation as a Core dependency with a deterministic slot-derived key and a role-inverted consumed-operation contract: input is the request the service sends and output is the response the service expects (Core [§5.6](../../openbindings.md#56-dependencies)).

**[C]** Such a dependency carries no `target` and no `bindingSpecs`; callback runtime-expression keys therefore remain descriptions of service-selected destinations, and the originating artifact places no constraint on the consumer's description format.

**[B — limit]** Dependencies add no invocation behavior to this binding; receiver deployment and dependency composition are permanently outside this operation boundary under this identifier (Core [§1.2](../../openbindings.md#12-scope)).

## 7. Target interaction and caller envelope

**[A]** An addressed operation denotes its declared HTTP method, completed target URL, parameters, optional request body, security requirements, and final HTTP response ([OAS 3.1.2 §4.8.10](https://spec.openapis.org/oas/v3.1.2.html#operation-object)).

**[B — convention]** The caller-facing correspondence value is exactly `{parameters?: {...}, body?: <one JSON value>}`; absence means not supplied, `body: null` is a supplied JSON null, and the artifact alone determines parameter location and serialization.

**[B — convention]** When every effective parameter name is unique across locations, its caller key is the exact declared name; if any name is repeated across legal locations, the target uses qualified mode for every parameter and each key is `<location>/<RFC6901-escaped-name>`, making the flat map injective without depending on map order.

**[A]** Duplicate effective parameters in the same location are upstream-invalid and exclude their smallest owning operation; legal cross-location duplicates remain independently supplied through §7's qualified mode ([OAS 3.1.2 §§4.8.10.1, 4.8.12.2.1](https://spec.openapis.org/oas/v3.1.2.html#operation-parameters)).

**[B — limit]** Two effective header parameters whose names differ only by ASCII case exclude the selected target permanently under this identifier because OAS parameter identity is case-sensitive while HTTP field names are case-insensitive; the wire cannot preserve the distinction ([OAS 3.1.2 §3.8](https://spec.openapis.org/oas/v3.1.2.html#case-sensitivity), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — convention]** Every unknown caller-envelope parameter key refuses before dispatch, regardless of whether a body exists; no unmatched-field passthrough exists.

**[A]** Missing required parameters and a missing `required: true` request body refuse before dispatch; path parameters are always required ([OAS 3.1.2 §§4.8.12.2.1, 4.8.13.1](https://spec.openapis.org/oas/v3.1.2.html#common-fixed-fields)).

**[A]** Request bodies declared for GET, HEAD, or DELETE are permitted but have undefined HTTP semantics and should be avoided ([OAS 3.1.2 §4.8.10.1](https://spec.openapis.org/oas/v3.1.2.html#operation-request-body)).

**[B — convention]** The binding preserves such a supplied declared body rather than deleting it; preservation is the least-authored reading because the artifact permits the body and supplies no instruction to ignore it.

## 8. Parameter serialization

### 8.1 Effective declarations and scalar conversion

**[A]** Operation parameters override Path Item parameters only at the same exact name-plus-location identity, and every remaining effective `path`, `query`, `header`, or `cookie` Parameter Object governs its own contribution ([OAS 3.1.2 §§4.8.9.1, 4.8.10.1, 4.8.12.1](https://spec.openapis.org/oas/v3.1.2.html#parameter-locations)).

**[B — configuration point]** For `schema`-form Parameter serialization, `parameterConversion` is a deterministic consumer-supplied conversion from each JSON boolean or number to a string; strings pass identically, JSON null is omitted under RFC 6570's undefined-value rule, and any supplied non-string scalar without a configured conversion refuses before dispatch ([RFC 6570 §2.3](https://www.rfc-editor.org/rfc/rfc6570#section-2.3)).

**[B — configuration point]** This specification defines no partial canonicalization default for `parameterConversion`; the converter applies recursively to array members and object values before serialization and MUST be deterministic for every accepted scalar.

### 8.2 `style`, `explode`, and URL assembly

**[A]** The supported `schema`-form cells and their RFC 6570 operators are exactly the following; a style/location/shape outside the table refuses before dispatch ([OAS 3.1.2 §§4.8.12.2.2, 4.8.12.3, Appendix C](https://spec.openapis.org/oas/v3.1.2.html#style-values), [RFC 6570 §3.2](https://www.rfc-editor.org/rfc/rfc6570#section-3.2)):

| style | location | admitted shapes | operator |
| --- | --- | --- | --- |
| **[A]** `matrix` | path | primitive, array, object | `;` |
| **[A]** `label` | path | primitive, array, object | `.` |
| **[A]** `simple` | path, header | primitive, array, object | none |
| **[A]** `form` | query, cookie | primitive, array, object | `?` (`+` when `allowReserved: true`) |
| **[B — convention]** `spaceDelimited` | query | array, object | OAS Style Examples bytes |
| **[B — convention]** `pipeDelimited` | query | array, object | OAS Style Examples bytes |
| **[B — convention]** `deepObject` | query | object with scalar properties | OAS Style Examples bytes |

**[A]** Default style is `form` for query and cookie and `simple` for path and header; default `explode` is `true` only for `form` and `false` otherwise; `allowReserved` applies only to query parameters ([OAS 3.1.2 §4.8.12.2](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-9)).

**[A]** RFC 6570 serialization MUST use its declared operator, `*` for `explode: true`, a comma for non-exploded label lists/maps, and one query template containing every form-style query parameter; concatenating separately expanded `?` templates is not conformant ([OAS 3.1.2 Appendix C](https://spec.openapis.org/oas/v3.1.2.html#appendix-c-using-rfc6570-based-serialization)).

**[B — convention]** For `spaceDelimited`, `pipeDelimited`, and `deepObject`, the exact bytes are the corresponding OAS Style Examples: delimiters and deep-object brackets are percent-encoded, object names and values retain their shown alternation, and no unstated escape convention is added ([OAS 3.1.2 §4.8.12.6](https://spec.openapis.org/oas/v3.1.2.html#style-examples)).

**[B — exclusion]** An explicit `explode` value in a Style Examples `n/a` cell, a `deepObject` property that is an array or object, or any array member/object value that is itself compound under any compound-capable style excludes that parameter because OAS/RFC 6570 defines no expansion; the owning target is excluded permanently under this identifier unless an incorporated authority defines that exact cell ([OAS 3.1.2 §§4.8.12.3, E.4](https://spec.openapis.org/oas/v3.1.2.html#style-values), [RFC 6570 §3.2.1](https://www.rfc-editor.org/rfc/rfc6570#section-3.2.1)).

**[A]** Every path-template expression MUST have a corresponding effective path parameter, and an expanded path value containing unescaped `/`, `?`, or `#` refuses before dispatch ([OAS 3.1.2 §§3.5, 4.8.12.4](https://spec.openapis.org/oas/v3.1.2.html#path-templating)).

**[A]** Completed URL parsing and percent-decoding follow RFC 3986, while query delimiters and the non-RFC-style brackets above remain percent-encoded as required ([OAS 3.1.2 §4.8.12.4](https://spec.openapis.org/oas/v3.1.2.html#url-percent-encoding), [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)).

### 8.3 Content-form, empty, header, and cookie parameters

**[A]** A `content`-form Parameter Object MUST contain exactly one media-type entry; its application value serializes under that entry, and when the contribution enters a URL the resulting representation is percent-encoded as one parameter value ([OAS 3.1.2 §4.8.12.2.3](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-for-use-with-content)).

**[A]** For a query parameter with `allowEmptyValue: true`, a supplied empty string emits a present zero-length value; absence still means omitted, and this binding infers no schema-validity consequence because OAS leaves that interaction implementation-defined ([OAS 3.1.2 §4.8.12.2.1](https://spec.openapis.org/oas/v3.1.2.html#parameter-allow-empty-value)).

**[A]** Header `schema` serialization performs no URI percent-encoding and adds no automatic quotes; cookie contributions are not URI-decoded after serialization ([OAS 3.1.2 §§4.8.12.2.2, Appendix D](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-for-use-with-schema)).

**[B — convention]** An effective Header Parameter named `Cookie` supplies one raw Cookie field only when no effective cookie-location Parameter and no selected cookie credential contributes; the binding does not parse or merge the raw string, and a raw/structured collision refuses the target or makes the selected credential alternative unusable.

**[B — limit]** An effective Header Parameter named `Host` or `Content-Length` excludes the target because those fields are processor-owned and cannot be replaced by caller input.

**[B — exclusion]** A form-style cookie declaration that produces multiple values excludes the target because OAS identifies RFC 6570's `&`-separated expansion as incorrect for Cookie's `; ` delimiter; the exclusion is permanent under this identifier unless an incorporated OAS edition defines a correct multi-value mapping ([OAS 3.1.2 Appendix D](https://spec.openapis.org/oas/v3.1.2.html#appendix-d-serializing-headers-and-cookies)).

## 9. Request and response media

### 9.1 Media identity, alternatives, and request election

**[A]** Media types parse under RFC 9110: type, subtype, and parameter names compare case-insensitively while parameter values retain their media-defined comparison rules ([RFC 9110 §§8.3.1, 8.3.2](https://www.rfc-editor.org/rfc/rfc9110#section-8.3.1)).

**[B — convention]** A declaration matches a concrete media type only when every declared parameter is present with an equal value; matches order by exact type/subtype before `type/*` before `*/*`, then by greatest declared-parameter count, and equal-specificity ties refuse.

**[B — limit]** Distinct content-map keys that normalize to one parsed media identity collide only for that identity and refuse selection through it; non-colliding entries survive, and map order never breaks the tie.

**[A]** A no-body invocation bypasses request-body media selection and emits neither a body nor `Content-Type`, because an absent optional Request Body contributes no HTTP content ([OAS 3.1.2 §§4.8.10.1, 4.8.13.1](https://spec.openapis.org/oas/v3.1.2.html#request-body-object)).

**[B — configuration point]** A body-emitting invocation preserves every admissible declared request alternative: a sole concrete declaration selects itself; multiple declarations or a range-only declaration require a concrete `requestMedia` choice before input consumption; the choice MUST match under §9.1 and never substitutes another declaration's schema.

**[B — configuration point]** A missing required choice, unmatched or ambiguous choice, unsupported selected lane, or body-emitting invocation with no admissible candidate refuses before dispatch; no body bytes or examples are sniffed to select a lane.

**[A]** Examples illustrate values but never select a declaration, carriage lane, or media type ([OAS 3.1.2 §4.8.14.1](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-11)).

**[A]** The binding sends no `Accept` header: OAS ignores a Header Parameter named `Accept`, request-body content declares what the operation consumes, and response content is not an instruction to advertise a preference ([OAS 3.1.2 §§4.8.12.2.1, 4.8.13, 4.8.17](https://spec.openapis.org/oas/v3.1.2.html#common-fixed-fields)).

### 9.2 Common carriage lanes

**[A]** An exact `application/json` or `+json` selection serializes the supplied value as strict JSON on requests and parses strict JSON on responses; JSON text uses UTF-8 ([RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)).

**[B — convention]** A concrete character-data selection governed by a schema declaring `type: string` carries the supplied string under its declared `charset`, defaulting to UTF-8; the closed character-data set is `text/*`, `application/xml`, and `+xml`, while `application/json` and `+json` are claimed by the JSON lane ([RFC 6838 §4.2.1](https://www.rfc-editor.org/rfc/rfc6838#section-4.2.1), [RFC 2046 §4.1](https://www.rfc-editor.org/rfc/rfc2046#section-4.1), [RFC 7303 §§3, 9](https://www.rfc-editor.org/rfc/rfc7303#section-3)).

**[B — convention]** The charset parameter is the only character-encoding source this lane consults; BOMs and XML declarations do not alter it, and unsupported or invalid character decoding refuses.

**[B — convention]** A non-JSON, non-form concrete selection whose present schema declares no `type` uses the raw-octet lane; memberless `{}` and boolean `true` assert nothing and therefore meet this condition, while an omitted `schema` does not declare the lane and is inadmissible unless another rule supplies carriage ([OAS 3.1.2 §§4.4.2, 4.8.24](https://spec.openapis.org/oas/v3.1.2.html#working-with-binary-data)).

**[A]** Every other keyword in a no-`type` schema still applies, and `maxLength` on raw content measures wire octets rather than the Base64 boundary string ([OAS 3.1.2 §4.4.2](https://spec.openapis.org/oas/v3.1.2.html#working-with-binary-data), [JSON Schema Validation §8.4](https://json-schema.org/draft/2020-12/json-schema-validation.html#section-8.4)).

**[A]** A schema declaring `type: string` with `contentEncoding` carries the caller's artifact-encoded string as text and does not trigger OpenBindings Base64 decoding; schema encoding and HTTP `Content-Encoding` are distinct ([OAS 3.1.2 §4.4.2](https://spec.openapis.org/oas/v3.1.2.html#working-with-binary-data), [JSON Schema Validation §§8.3–8.4](https://json-schema.org/draft/2020-12/json-schema-validation.html#section-8.3)).

**[B — pin]** Every OpenBindings raw-octet value is a JSON string containing canonical RFC 4648 §4 Base64: standard alphabet, required padding, no ignored non-alphabet characters, and zero unused pad bits; requests decode before dispatch and responses encode the exact octets ([RFC 4648 §§3.3, 3.5, 4](https://www.rfc-editor.org/rfc/rfc4648)).

**[B — exclusion]** This specification does not generate XML from an object model because the OAS XML Object does not determine complete document bytes; the selected media alternative is excluded permanently under this identifier until an incorporated authority defines ordering, escaping, nulls, dynamic keys, and scalar lexical forms, while string and raw-octet XML carriage remain admitted ([OAS 3.1.2 §§4.8.14, 4.8.26](https://spec.openapis.org/oas/v3.1.2.html#xml-object)).

**[B — convention]** Because `readOnly` and `writeOnly` are annotations whose enforcement OAS leaves to the application, this binding never uses them to delete a supplied wire member or synthesize an absent one ([OAS 3.1.2 §4.8.24.3.2](https://spec.openapis.org/oas/v3.1.2.html#validating-readonly-and-writeonly)).

### 9.3 Form bodies and multipart parts

**[A]** `application/x-www-form-urlencoded` and `multipart/form-data` serialize object properties under the governing Schema and Encoding Objects; a non-object declaration has no form lane ([OAS 3.1.2 §§4.8.14.4, 4.8.14.5](https://spec.openapis.org/oas/v3.1.2.html#support-for-x-www-form-urlencoded-request-bodies)).

**[A]** For a dynamic object member, the effective property schema is the conjunction of an exact `properties` schema and every matching `patternProperties` schema, or `additionalProperties` when no exact or pattern schema matches; applicable `allOf` constraints remain in force ([JSON Schema Core §10.2](https://json-schema.org/draft/2020-12/json-schema-core.html#section-10.2)).

**[A]** Encoding `style`, `explode`, and `allowReserved` controls apply to both form-urlencoded and multipart/form-data; explicit presence of any control selects RFC 6570-style serialization and absent sibling controls take their defaults, while absence of all three selects content-based encoding ([OAS 3.1.2 §§4.8.15.1, C.4](https://spec.openapis.org/oas/v3.1.2.html#fixed-fields-12)).

**[A]** Form-urlencoded removes RFC 6570's leading `?`; multipart writes values inside named parts with no URI percent-encoding, and `allowReserved` has no multipart effect ([OAS 3.1.2 Appendix C](https://spec.openapis.org/oas/v3.1.2.html#appendix-c-using-rfc6570-based-serialization)).

**[A]** The form-urlencoded content path follows RFC 1866 form encoding while the style path follows RFC 6570; the binding preserves the permitted encodings of each path and does not collapse them to one authored byte spelling ([OAS 3.1.2 Appendix E.4](https://spec.openapis.org/oas/v3.1.2.html#appendix-e-percent-encoding-and-form-media-types), [RFC 1866 §8.2.1](https://www.rfc-editor.org/rfc/rfc1866#section-8.2.1), [RFC 6570](https://www.rfc-editor.org/rfc/rfc6570)).

**[A]** Multipart part `Content-Type` selection is: an explicit single concrete Encoding `contentType`; otherwise `application/octet-stream` for no declared `type` or a string with `contentEncoding`, `text/plain` for a plain string or number/integer/boolean, `application/json` for an object, and the item-type default for an array ([OAS 3.1.2 §4.8.15.1.1](https://spec.openapis.org/oas/v3.1.2.html#common-fixed-fields-0)).

**[B — convention]** A no-`type` part uses the raw-octet lane and §9.2's canonical Base64 boundary; a string part with `contentEncoding` remains artifact-encoded text, and neither case emits `Content-Transfer-Encoding`.

**[B — configuration point]** A wildcard or comma-separated multi-valued Encoding `contentType` requires a concrete per-property `partMedia` choice; the choice MUST satisfy one declared member under §9.1, and an absent, unmatched, or ambiguous required choice refuses before dispatch.

**[B — limit]** Encoding `headers` are descriptive at this operation boundary: the binding emits no part header merely from a Header Object schema and never emits an undeclared `Content-Transfer-Encoding`; alternatives needing caller-supplied part headers have no representation under this identifier ([OAS 3.1.2 §4.8.15.1.1](https://spec.openapis.org/oas/v3.1.2.html#encoding-headers)).

**[B — exclusion]** A multipart media type other than `multipart/form-data` is excluded because OAS defines no property-to-part correlation for it; the exclusion is permanent under this identifier and reopens only if an incorporated OAS edition defines that correlation ([OAS 3.1.2 §4.8.14.5](https://spec.openapis.org/oas/v3.1.2.html#special-considerations-for-multipart-content)).

### 9.4 HTTP content codings

**[A]** HTTP `Content-Encoding` is distinct from media type and from Schema Object `contentEncoding`; request codings apply in listed wire order and response codings decode in reverse order before the selected media lane ([RFC 9110 §8.4](https://www.rfc-editor.org/rfc/rfc9110#section-8.4), [OAS 3.1.2 §4.4.2](https://spec.openapis.org/oas/v3.1.2.html#working-with-binary-data)).

**[A]** The artifact declaration surfaces are an effective request Header Parameter named `Content-Encoding` and a governing response Header Object of that name; field-name comparison is ASCII case-insensitive ([OAS 3.1.2 §§3.8, 4.8.12, 4.8.17](https://spec.openapis.org/oas/v3.1.2.html#header-object), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — configuration point]** `requestContentCodings` and `responseContentCodings` are finite consumer maps from case-insensitive content-coding tokens to deterministic encoders and decoders; the artifact-declared field value fixes the ordered stack, and no configuration preference narrows its declared alternatives.

**[B — configuration point]** An unsupported token, a field value not admitted by its governing Header declaration, an ambiguous coding declaration, or an actual response coding with no governing Header Object refuses rather than being skipped or sniffed; configuring a codec supplies capability but never declares a coding the artifact omitted.

### 9.5 Response declaration, classification, and decoding

**[A]** Response keys are closed to exact three-digit status codes `100` through `599`, the five ranges `1XX` through `5XX`, `default`, and specification extensions; an exact key overrides its matching range ([OAS 3.1.2 §§3.7, 4.8.16](https://spec.openapis.org/oas/v3.1.2.html#responses-object)).

**[B — convention]** The governing Response Object lookup order is exact status, then the single matching range, then `default`; range-over-default is this specification's reading, and declarations never reclassify the native status.

**[A]** Success is the final RFC 9110 status in the 2xx class ([RFC 9110 §15.3](https://www.rfc-editor.org/rfc/rfc9110#section-15.3)).

**[B — convention]** Redirect following is runtime policy; a followed redirect MUST preserve the bound method and complete body, while a method-rewriting redirect is treated as the final response ([RFC 9110 §15.4](https://www.rfc-editor.org/rfc/rfc9110#section-15.4)).

**[A]** A non-empty response selects its concrete media type from `Content-Type` and then the most-specific matching governing content declaration; an unmatched, ambiguous, or normalized-colliding result is a protocol error ([OAS 3.1.2 §§4.8.16, 4.8.17](https://spec.openapis.org/oas/v3.1.2.html#response-object)).

**[B — convention]** When a non-empty response omits `Content-Type`, the binding takes RFC 9110's permitted `application/octet-stream` assumption before ordinary matching; the resulting type still MUST match a governing declaration ([RFC 9110 §8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3)).

**[C]** Empty responses emit no output value; successful non-empty responses emit the selected lane's one application value, while failure bodies use the same lanes and remain opaque application-authored failure data.

**[B — limit]** A non-empty response with no governing Response Object is a loud protocol error, even though omission of `responses` leaves the operation addressable; response headers and Link Objects have no operation-value representation under this identifier ([OAS 3.1.2 §§4.8.10.1, 4.8.17](https://spec.openapis.org/oas/v3.1.2.html#operation-responses)).

**[B — limit]** One HTTP response body produces at most one operation value: the accepted 3.1 editions define no construct that frames one response body into multiple application values, including for `text/event-stream`; this is permanent under this identifier and reopens only if an incorporated authority defines such framing.

## 10. Servers and target URL

**[A]** The effective server list is the Operation Object list, otherwise the Path Item list, otherwise the root list, with an absent or empty root list equivalent to one Server Object whose URL is `/` ([OAS 3.1.2 §§4.8.1.1, 4.8.5, 4.8.9.1, 4.8.10.1](https://spec.openapis.org/oas/v3.1.2.html#server-object)).

**[B — configuration point]** One effective server selects itself; multiple members require one consumer `server` choice before dispatch, the same value carries exact variable substitutions, and no member or variable preference is inferred.

**[A]** Server variables substitute their declared value, use `default` when no consumer value is supplied, and MUST satisfy a nonempty declared `enum`; an unresolved variable refuses before dispatch ([OAS 3.1.2 §4.8.6](https://spec.openapis.org/oas/v3.1.2.html#server-variable-object)).

**[A]** Server URLs containing a query or fragment refuse, and the expanded server URL receives the path bytes by verbatim append with no relative-reference resolution, slash normalization, or path repair ([OAS 3.1.2 §§4.8.5.1, 4.8.8.1](https://spec.openapis.org/oas/v3.1.2.html#server-url)).

**[A]** After path and query serialization, the completed target MUST parse and percent-decode under RFC 3986; an unusable target refuses before dispatch ([OAS 3.1.2 §4.8.12.4](https://spec.openapis.org/oas/v3.1.2.html#url-percent-encoding), [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)).

**[C]** A complete configured URL MAY replace the selected target without replacing the artifact's method, parameters, body, response, or security semantics (Core [§5.2](../../openbindings.md#52-bindings)).

## 11. Security and channel assembly

**[A]** Operation `security` replaces root `security`; `[]` means no security requirement, array members are OR alternatives, every nonempty Security Requirement Object is an AND of its named schemes, and `{}` is a complete anonymous alternative ([OAS 3.1.2 §§4.8.10.1, 4.8.30](https://spec.openapis.org/oas/v3.1.2.html#security-requirement-object)).

**[B — configuration point]** The binding preserves every complete alternative and invents no anonymous-versus-credentialed preference; the consumer selects one complete alternative, and fragments from different alternatives are never combined.

**[A]** Requirement arrays for OAuth 2.0 and OpenID Connect contain scopes, arrays for other schemes may contain roles, and this binding surfaces those exact strings without interpreting roles in-band or executing acquisition flows ([OAS 3.1.2 §4.8.30.1](https://spec.openapis.org/oas/v3.1.2.html#security-requirements-name)).

**[B — configuration point]** `implicitConnectionScope` selects `entry` or `referring` document resolution for Security Requirement names and defaults to `entry`, following OAS's recommended entry-document scope while preserving the explicit alternative ([OAS 3.1.2 §4.3.3](https://spec.openapis.org/oas/v3.1.2.html#resolving-implicit-connections)).

**[A]** `apiKey` credentials use their declared name and location, and HTTP `basic` and `bearer` use the `Authorization` field ([OAS 3.1.2 §4.8.27](https://spec.openapis.org/oas/v3.1.2.html#security-scheme-object), [RFC 9110 §11.6.2](https://www.rfc-editor.org/rfc/rfc9110#section-11.6.2)).

**[B — convention]** `mutualTLS` is a transport prerequisite rather than a header credential; a selected alternative requiring it is complete only when the runtime has established the declared client-certificate condition.

**[B — pin]** OAuth 2.0 and OpenID Connect access tokens use the `Bearer` authorization scheme under [RFC 6750 §2.1](https://www.rfc-editor.org/rfc/rfc6750#section-2.1); another token type has no wire carriage under this identifier.

**[B — limit]** Any other declared HTTP authentication scheme remains visible as a consumer prerequisite, but this binding synthesizes no credential bytes for it; an alternative requiring it is unusable unless the runtime satisfies it as a complete prerequisite.

**[C]** Credentials and credential-acquisition state MUST NOT be embedded in an OBI document (Core [§8](../../openbindings.md#8-security)).

**[B — convention]** A credential destination that collides with an effective parameter, another credential in the same AND requirement, processor-owned `Host` or `Content-Length`, or a raw `Cookie` field makes only the selected security alternative unusable; another complete non-colliding alternative may still be selected, while §8.3 governs parameter-only processor-owned and raw/structured collisions.

**[B — convention]** Header names compare ASCII case-insensitively, cookie names compare exactly, and structured cookie contributions preserve membership and join as `name=value` separated by `; `; cookie order is not portable meaning ([RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1), [OAS 3.1.2 Appendix D](https://spec.openapis.org/oas/v3.1.2.html#appendix-d-serializing-headers-and-cookies)).

## 12. Configuration, synthesis, and conformance

### 12.1 Configuration vocabulary

**[B — configuration point]** The complete binding-specific configuration vocabulary is `requestMedia` (one concrete media type), `server` (one effective Server alternative plus exact variable values), `parameterConversion` (deterministic scalar converter), `implicitConnectionScope` (`entry` or `referring`), `requestContentCodings` (coding-to-encoder map), `responseContentCodings` (coding-to-decoder map), and conditional `partMedia` (concrete media type per affected part).

**[B — configuration point]** Every requirement is typed, discoverable from declarations, and preflightable; no configuration member appears in the caller envelope or operation contract, and decode and classification are fixed rules rather than configuration points.

### 12.2 Synthesis boundary and coverage

**[C]** Operation contracts remain protocol-neutral and MAY remain flat; synthesis emits an `inputTransform` that constructs §7's envelope, and transforms never route values to HTTP locations (Core [§5.5](../../openbindings.md#55-transforms)).

**[B — limit]** Operation/dependency key spelling, flattening, output-schema choice, and Schema Object translation are synthesis policy, not binding semantics; no dynamic-object trigger, declaration-complex trigger, dialect trigger, `body.properties`, `body.whole`, routed tuple, or unmatched-field passthrough exists.

**[C]** A synthesizer MUST account for every addressable operation and every callback/webhook dependency as represented, excluded with §12.3's exact reason, or unsupported; a failure in an unused description position is coverage loss rather than invocation behavior (Core [OBI-B-02](../../openbindings.md#104-binding-specification-rules)).

**[C]** Dependencies are synthesis outputs only and add no invocation target or receiver behavior.

### 12.3 Conformance rules

**[C]** A document conforms to **OAPI31-D-01** when its `content`, if present, satisfies §§3–5 and its `location`, if present, satisfies §4.

**[C]** A binding conforms to **OAPI31-D-02** when it names `openbindings.openapi-3.1@1`, carries the literal selector of §6.1, and identifies a source that passes the exact edition gate.

**[C]** A processor conforms to **OAPI31-P-01** when it implements the closed load gates, smallest-owner confinement, source/dialect exclusions, reference closure, and selector semantics of §§3–6.

**[C]** A processor conforms to **OAPI31-P-02** when it accepts only §7's envelope, applies §8's effective-parameter, collision, conversion, style, content, header, cookie, and path rules, and refuses every unknown or unroutable input before dispatch.

**[C]** A processor conforms to **OAPI31-P-03** when it preserves media alternatives and applies §9's matching, request election, carriage, form, multipart, content-coding, response lookup, classification, and unary-boundary rules without sniffing or undeclared fallback.

**[C]** A processor conforms to **OAPI31-P-04** when it resolves servers and complete target URLs under §10 and security alternatives, credentials, prerequisites, and channel collisions under §11.

**[C]** A synthesizer conforms to **OAPI31-S-01** when it preserves §12.2's binding/transform boundary, emits §6.2's targetless unconstrained dependencies, and reports complete coverage under Core OBI-B-02.

**[B — exclusion]** Every exclusion in this document is permanent under `openbindings.openapi-3.1@1`, belongs to the smallest owner stated beside it, and reopens only on its stated incorporated-authority trigger; no exclusion promises later work.

## 13. Normative references

- [OpenAPI Specification 3.1.0](https://spec.openapis.org/oas/v3.1.0.html)
- [OpenAPI Specification 3.1.1](https://spec.openapis.org/oas/v3.1.1.html)
- [OpenAPI Specification 3.1.2](https://spec.openapis.org/oas/v3.1.2.html)
- [YAML 1.2.2](https://yaml.org/spec/1.2.2/)
- [JSON Schema Core 2020-12](https://json-schema.org/draft/2020-12/json-schema-core.html)
- [JSON Schema Validation 2020-12](https://json-schema.org/draft/2020-12/json-schema-validation.html)
- [RFC 1866](https://www.rfc-editor.org/rfc/rfc1866)
- [RFC 2046](https://www.rfc-editor.org/rfc/rfc2046)
- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119)
- [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)
- [RFC 4648](https://www.rfc-editor.org/rfc/rfc4648)
- [RFC 6570](https://www.rfc-editor.org/rfc/rfc6570)
- [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750)
- [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838)
- [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)
- [RFC 7303](https://www.rfc-editor.org/rfc/rfc7303)
- [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)
- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)
