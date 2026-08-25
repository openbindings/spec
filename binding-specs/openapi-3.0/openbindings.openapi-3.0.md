# `openbindings.openapi-3.0` Binding Specification

## 1. Status, identifier, and rule labels

**Status: unreleased first-revision candidate.**

**[B — convention]** The proposed opaque binding-specification identifier has exactly the spelling **`openbindings.openapi-3.0@1`**.

**[C]** Publication mints §1's identifier under Core [OBI-B-01](../../openbindings.md#104-binding-specification-rules), and an incompatible change to the accepted domain or portable meaning requires a different identifier under Core [OBI-B-03](../../openbindings.md#104-binding-specification-rules).

**[A]** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) only when they appear in all capitals.

**[B — convention]** Every normative paragraph and normative table row carries one visible provenance label: **A** is derived from incorporated authority and cites it, **C** is derived from the OpenBindings Core, and **B** is this specification's explicitly classified bridge (`convention`, `pin`, `configuration point`, `exclusion`, or `limit`).

## 2. Scope and incorporated authorities

**[A]** An artifact's required `openapi` string gives the exact OAS edition that the OpenAPI Document uses ([OAS 3.0.4 §§3.2, 4.7.1.1](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields)).

**[B — convention]** This specification accepts exactly OAS editions [`3.0.0`](https://spec.openapis.org/oas/v3.0.0.html), [`3.0.1`](https://spec.openapis.org/oas/v3.0.1.html), [`3.0.2`](https://spec.openapis.org/oas/v3.0.2.html), [`3.0.3`](https://spec.openapis.org/oas/v3.0.3.html), and [`3.0.4`](https://spec.openapis.org/oas/v3.0.4.html); no wildcard or compatible-looking value widens this closed set.

**[B — convention]** Within that closed set, observable behavior MUST NOT turn on the patch component: the admitted editions are read as one `3.0` feature set, corrected patch text governs a contradiction, and the accepted domain remains the five exact values above. This applies the editions' explicit patch-compatibility instruction without allowing anomalous copied examples in 3.0.4 §4.1 to widen or rename this line ([OAS 3.0.0 §4.1](https://spec.openapis.org/oas/v3.0.0.html#versions), [3.0.1 §4.1](https://spec.openapis.org/oas/v3.0.1.html#versions), [3.0.2 §4.1](https://spec.openapis.org/oas/v3.0.2.html#versions), [3.0.3 §4.1](https://spec.openapis.org/oas/v3.0.3.html#versions), [3.0.4 §4.1](https://spec.openapis.org/oas/v3.0.4.html#versions)).

**[A]** OAS governs the artifact and every HTTP mechanic it declares, including object structure, reference resolution, parameter serialization, media declarations, server selection, responses, and security ([OAS 3.0.4 §4.7](https://spec.openapis.org/oas/v3.0.4.html#schema-0)); [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) governs the remaining HTTP semantics.

**[C]** This document defines portable binding meaning, not an invocation API: request objects, retry and redirect APIs, cancellation, credential acquisition, receiver deployment, and dependency composition remain runtime or application concerns under Core [§1.2](../../openbindings.md#12-out-of-scope).

## 3. Source carriage and refusal architecture

### 3.1 Accepted representations

**[C]** `content` is either the parsed OpenAPI document object or string content; `location` is an absolute URI for the OpenAPI document; content has primacy, a co-present location supplies its base URI, and the OBI retrieval URI is never that base (Core [§5.4](../../openbindings.md#54-sources), [§7](../../openbindings.md#7-reference-resolution)).

**[B — pin]** String content MUST parse as YAML 1.2.2, of which JSON is a subset; duplicate mapping keys, non-scalar-string mapping keys, explicit tags outside YAML's JSON-compatible tag set, and resolved values with no JSON image (`.inf`, `-.inf`, `.nan`) refuse at load ([YAML 1.2.2 §§3.2.1, 10.2.1, 10.3.2](https://yaml.org/spec/1.2.2/)).

**[A]** The line's format rule historically calls the admitted tag set the “JSON Schema ruleset” in editions 3.0.0–3.0.3 and clarifies it as “YAML's JSON schema ruleset,” unrelated to JSON Schema, in 3.0.4; the clarified reading governs, and YAML map keys MUST be scalar strings ([OAS 3.0.0 §4.2](https://spec.openapis.org/oas/v3.0.0.html#format), [3.0.1 §4.2](https://spec.openapis.org/oas/v3.0.1.html#format), [3.0.2 §4.2](https://spec.openapis.org/oas/v3.0.2.html#format), [3.0.3 §4.2](https://spec.openapis.org/oas/v3.0.3.html#format), [3.0.4 §4.2](https://spec.openapis.org/oas/v3.0.4.html#format)).

**[A]** The root MUST be a JSON object with the required `openapi` string that identifies the OAS edition it uses ([OAS 3.0.4 §§4.2, 4.7.1.1](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields)).

**[B — convention]** The `openapi` value MUST be exactly `3.0.0`, `3.0.1`, `3.0.2`, `3.0.3`, or `3.0.4`; an absent, mismatched, or unlisted value refuses at this binding's edition load gate.

### 3.2 Closed load gates and confined defects

**[B — limit]** The load gates are the following closed ordered set: accepted-representation grammar, scalar/tag/key resolution, JSON-object root shape, and exact edition discrimination; no condition outside this set is a load gate.

**[B — limit]** After those gates pass, a defect confines to the smallest selected unit that owns it; an unreachable defect destroys no target, and a whole source refuses only when every position that could contain an addressable target is defective so that no conformant selector can resolve (Core [OBI-B-03](../../openbindings.md#104-binding-specification-rules)).

**[A]** A conforming artifact that declares no operation target is accepted and synthesizes no operation: the required Paths Object may contain no path entries, and a Path Item Object may be empty ([OAS 3.0.4 §§4.7.1.1, 4.7.8, 4.7.9](https://spec.openapis.org/oas/v3.0.4.html#paths-object)).

**[B — limit]** A target that is addressable but unusable because of a missing choice, unsupported alternative, or exclusion refuses at invocation or is reported as synthesis coverage loss; it never becomes a whole-source load refusal.

**[B — limit]** This revision declares no source-scope exclusion: unlike the `include`/`mount` filtering surface of `openbindings.usage@1`, no source member or addressable target is filtered merely by its position in the source.

**[A]** Unknown non-extension fields create no binding behavior and are ignored only where the governing OAS object permits them; no unknown member is guessed into a known field ([OAS 3.0.4 §§4.7, 4.8](https://spec.openapis.org/oas/v3.0.4.html#specification-extensions)).

## 4. `location`, `content`, and composition

**[C]** A present `location` MUST be an absolute URI addressing the OpenAPI document itself, and dereferencing it MUST yield an accepted representation; a bare filesystem path is not conformant (Core [OBI-D-05](../../openbindings.md#102-document-rules)).

**[C]** A present `content` MUST be one of §3.1's two representations, and no other JSON type is accepted (Core [OBI-D-01](../../openbindings.md#102-document-rules)).

**[A]** A relative `$ref` resolves under JSON Reference against the URL of the document containing it; other relative URL fields use their own OAS-defined base rules ([OAS 3.0.4 §4.6](https://spec.openapis.org/oas/v3.0.4.html#relative-references-in-urls)).

**[C]** Embedded content without a co-present `location` MUST be self-contained; a location-only source uses its location as the entry-document base.

## 5. References, schema dialect, and confinement

### 5.1 Reference semantics

**[A]** A Reference Object is JSON Reference transclusion: the resolved target replaces the referencing object, and its transitive reachable references compose with it; unrelated material in the same retrieved document is not part of that selected closure ([OAS 3.0.4 §§4.6, 4.7.23](https://spec.openapis.org/oas/v3.0.4.html#reference-object), [JSON Reference draft-03 §4](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03#section-4)).

**[A]** Only the entry document is required to be an OpenAPI Document; a retrieved document containing a referenced value need not itself be a conforming OpenAPI Document ([OAS 3.0.4 §§3.1–3.2, 4.3](https://spec.openapis.org/oas/v3.0.4.html#openapi-description-structure)).

**[B — convention]** When one JSON or YAML node is reached from reference positions requiring different OAS Object types, each reference context interprets the node independently as its own required Object type; this is the deterministic choice within OAS's implementation-defined multi-context license ([OAS 3.0.4 §4.3.1](https://spec.openapis.org/oas/v3.0.4.html#structural-interoperability)).

**[A]** A Reference Object has only its required `$ref` field; every adjacent property is ignored, including when a Reference Object appears where a Schema Object is allowed ([OAS 3.0.4 §§4.7.23, 4.7.24.1](https://spec.openapis.org/oas/v3.0.4.html#reference-object)).

**[A]** Reference traversal MUST detect and handle cycles without resource exhaustion ([OAS 3.0.4 §5.5](https://spec.openapis.org/oas/v3.0.4.html#handling-reference-cycles)).

**[C]** A cyclic but resolvable graph is legitimate: cycle detection terminates traversal and is not itself a refusal (Core [OBI-T-11](../../openbindings.md#103-tool-rules)).

**[B — exclusion]** When a selected Path Item carries `$ref`, the selected operation target is excluded only if a fixed field used by that target appears in both the referenced Path Item and its adjacent declaration, because OAS defines that named collision as undefined; collisions confined to unused fields and all non-colliding adjacent fields leave the target usable, and the exclusion is permanent under this identifier unless an incorporated OAS edition defines the collision ([OAS 3.0.4 §4.7.9.1](https://spec.openapis.org/oas/v3.0.4.html#path-item-ref)).

**[A]** The following confinement table applies ([OAS 3.0.4 §§4.3, 4.6, 4.7.9](https://spec.openapis.org/oas/v3.0.4.html#openapi-description-structure)):

| condition | owning unit and effect |
| --- | --- |
| **[A]** Unresolvable selected Path Item `$ref` | the referenced Path Item and its operations are unaddressable |
| **[A]** Unresolvable reference reached by one selected parameter, request body, response, server, or security requirement | that selected operation or its affected declared alternative is unusable; unrelated operations survive |
| **[A]** Unresolvable Schema Object reference reached only by one media alternative | that media alternative is unavailable; sibling alternatives survive |
| **[C]** Unresolvable reference reachable only from an unused description position | invocation is unaffected; synthesis reports the unrepresented position |
| **[C]** Defect outside the target-plus-reachable closure | no effect on that target |

### 5.2 Schema dialect

**[A]** A Schema Object uses OAS 3.0's extended subset of JSON Schema Wright Draft 00: the keywords enumerated in OAS plus OAS's fixed fields are the complete supported vocabulary; unlisted JSON Schema keywords are strictly unsupported and create no binding behavior ([OAS 3.0.4 §§4.4, 4.7.24](https://spec.openapis.org/oas/v3.0.4.html#schema-object)).

**[A]** `type` MUST be one string rather than an array; a boolean in a Schema Object position is upstream-invalid; an empty Schema Object `{}` asserts no instance type; and a Reference Object may be used in place of a Schema Object under §5.1's transclusion semantics ([OAS 3.0.4 §§4.4, 4.7.24.1](https://spec.openapis.org/oas/v3.0.4.html#json-schema-keywords)).

**[A]** `nullable: true` admits JSON null only when `type` is explicitly present in the same Schema Object, leaves the named non-null type in force, and does not disable any other constraint ([OAS 3.0.4 §4.7.24.2](https://spec.openapis.org/oas/v3.0.4.html#schema-nullable)).

**[A]** Unsupported keywords, including `$id`, `$schema`, `patternProperties`, `contentEncoding`, and `contentMediaType`, decide as if absent; specification extensions remain non-behavioral metadata unless another incorporated rule explicitly assigns them meaning ([OAS 3.0.4 §§4.7.24.1, 4.8](https://spec.openapis.org/oas/v3.0.4.html#json-schema-keywords)).

## 6. Selector and inbound dependencies

### 6.1 Selector

**[B — convention]** `selector` is REQUIRED and has exactly one literal spelling: `#/paths/<escaped-path>/<lowercase-method>`, where `<escaped-path>` is the Paths Object key escaped once under [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) and `<lowercase-method>` is one of `get`, `put`, `post`, `delete`, `options`, `head`, `patch`, or `trace` (Core [OBI-D-03](../../openbindings.md#102-document-rules)).

**[A]** Selector evaluation never percent-decodes the pointer and fails unresolvable when the selected operation is absent ([RFC 6901 §§3–4](https://www.rfc-editor.org/rfc/rfc6901#section-3), [OAS 3.0.4 §§3.5, 4.7.9](https://spec.openapis.org/oas/v3.0.4.html#path-item-object)).

**[B — convention]** After the pointer selects a Path Item, selector evaluation resolves that Path Item's `$ref` transclusion before reading the method field; the deliberate extra resolution keeps bundled referenced Path Items addressable ([JSON Reference draft-03 §4](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03#section-4), [OAS 3.0.4 §4.7.9.1](https://spec.openapis.org/oas/v3.0.4.html#path-item-ref)).

**[A]** An Operation Object without its required `responses`, or with a Responses Object containing no response code, is upstream-invalid and makes that operation unusable without affecting unrelated operations ([OAS 3.0.4 §§4.7.10.1, 4.7.16](https://spec.openapis.org/oas/v3.0.4.html#operation-responses)).

### 6.2 Callbacks

**[A]** A callback Path Item describes a request initiated by the API provider and the responses it expects; its runtime-expression key identifies a service-selected request destination, and the callback is not an operation invocable through the addressed parent operation ([OAS 3.0.4 §§4.7.10.1, 4.7.18, 4.7.20.4](https://spec.openapis.org/oas/v3.0.4.html#callback-object)).

**[B — convention]** Synthesis MUST represent every supported callback operation as a Core dependency with a deterministic slot-derived key and a role-inverted consumed-operation contract: input is the request the service sends and output is the response the service expects (Core [§5.6](../../openbindings.md#56-dependencies)).

**[C]** Such a dependency carries no `target` (Core [§5.6](../../openbindings.md#56-dependencies)).

**[B — convention]** Such a dependency also carries no `bindingSpecs`, because the originating artifact has no authority to constrain the consumer's description format.

**[B — limit]** Dependencies add no invocation behavior to this binding; receiver deployment and dependency composition are permanently outside this operation boundary under this identifier (Core [§1.2](../../openbindings.md#12-out-of-scope)).

## 7. Target interaction and caller envelope

**[A]** An addressed operation denotes its declared HTTP method, completed target URL, parameters, effective request body, security requirements, and final HTTP response ([OAS 3.0.4 §4.7.10](https://spec.openapis.org/oas/v3.0.4.html#operation-object)).

**[B — convention]** The caller-facing correspondence value is exactly `{parameters?: {...}, body?: <one JSON value>}`; absence means not supplied, `body: null` is a supplied JSON null, and the artifact alone determines parameter location and serialization.

**[B — convention]** When every effective parameter name is unique across locations, its caller key is the exact declared name; if any name is repeated across legal locations, the target uses qualified mode for every parameter and each key is `<location>/<RFC6901-escaped-name>`, making the flat map injective without depending on map order.

**[A]** Effective parameter identity is exact name plus location; duplicate effective parameters at the same identity are upstream-invalid, while the same name in different locations denotes distinct parameters ([OAS 3.0.4 §§4.7.9.1, 4.7.10.1, 4.7.12](https://spec.openapis.org/oas/v3.0.4.html#operation-parameters)).

**[B — exclusion]** Duplicate effective parameters at the same identity exclude their smallest owning operation permanently under this identifier; this exclusion reopens only if an incorporated OAS edition admits such duplicates.

**[B — exclusion]** Two effective header parameters whose names differ only by ASCII case exclude the selected target permanently under this identifier because OAS parameter identity is case-sensitive while HTTP field names are case-insensitive; the wire cannot preserve the distinction. This exclusion reopens only if an incorporated authority defines a wire mapping that preserves such case-distinct declarations ([OAS 3.0.4 §§3.8, 4.7.12](https://spec.openapis.org/oas/v3.0.4.html#case-sensitivity), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — convention]** Every unknown caller-envelope parameter key refuses before dispatch, regardless of whether a body exists; no unmatched-field passthrough exists.

**[A]** Missing required parameters and a missing `required: true` effective request body refuse before dispatch; path parameters are always required ([OAS 3.0.4 §§4.7.12.2.1, 4.7.13.1](https://spec.openapis.org/oas/v3.0.4.html#common-fixed-fields)).

**[A]** A `requestBody` declaration on GET, HEAD, or DELETE is ignored and therefore creates no body requirement, accepted body value, emitted body bytes, or `Content-Type` ([OAS 3.0.4 §4.7.10.1](https://spec.openapis.org/oas/v3.0.4.html#operation-request-body)).

**[B — convention]** A supplied `body` for a target whose `requestBody` is ignored refuses as unroutable before dispatch.

## 8. Parameter serialization

### 8.1 Effective declarations and scalar conversion

**[A]** Operation parameters override Path Item parameters only at the same exact name-plus-location identity, and every remaining effective `path`, `query`, `header`, or `cookie` Parameter Object governs its own contribution ([OAS 3.0.4 §§4.7.9.1, 4.7.10.1, 4.7.12.1](https://spec.openapis.org/oas/v3.0.4.html#parameter-locations)).

**[A]** A Header Parameter whose name ASCII-case-insensitively denotes `Accept`, `Content-Type`, or `Authorization` MUST be ignored and creates no effective parameter, caller-envelope key, or emitted field ([OAS 3.0.4 §§3.8, 4.7.12.2.1](https://spec.openapis.org/oas/v3.0.4.html#common-fixed-fields), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — configuration point]** Whenever a `schema`-form Parameter or §9.3 form/part property must convert a JSON scalar to a string, `parameterConversion` is the same deterministic consumer-supplied conversion: strings pass identically, and any supplied boolean or number without a configured conversion refuses before dispatch. JSON null does not enter this conversion point; §8.2 governs RFC 6570-style paths and §9.3 governs content-based form and multipart paths ([OAS 3.0.4 Appendix B](https://spec.openapis.org/oas/v3.0.4.html#appendix-b-data-type-conversion), [RFC 6570 §2.3](https://www.rfc-editor.org/rfc/rfc6570#section-2.3)).

**[B — configuration point]** This specification defines no partial canonicalization default for `parameterConversion`; the converter applies recursively to scalar array members and object values before style serialization and MUST be deterministic for every accepted scalar.

### 8.2 `style`, `explode`, and URL assembly

**[A]** The supported `schema`-form cells and their RFC 6570 operators are exactly the following; a style/location/shape outside the table refuses before dispatch ([OAS 3.0.4 §§4.7.12.2.2, 4.7.12.3, Appendix C](https://spec.openapis.org/oas/v3.0.4.html#style-values), [RFC 6570 §3.2](https://www.rfc-editor.org/rfc/rfc6570#section-3.2)):

| style | location | admitted shapes | operator |
| --- | --- | --- | --- |
| **[A]** `matrix` | path | primitive, array, object | `;` |
| **[A]** `label` | path | primitive, array, object | `.` |
| **[A]** `simple` | path, header | primitive, array, object | none |
| **[A]** `form` | query, cookie | primitive, array, object | `?` (`+` when `allowReserved: true`) |
| **[B — convention]** `spaceDelimited` | query | array, object | OAS Style Examples bytes |
| **[B — convention]** `pipeDelimited` | query | array, object | OAS Style Examples bytes |
| **[B — convention]** `deepObject` | query | object with scalar properties | OAS Style Examples bytes |

**[A]** Default style is `form` for query and cookie and `simple` for path and header; default `explode` is `true` only for `form` and `false` otherwise; `allowReserved` applies only to query parameters ([OAS 3.0.4 §4.7.12.2.2](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields-for-use-with-schema)).

**[A]** On a `schema`-form Parameter or an Encoding RFC 6570-style path, JSON null is an undefined value and uses the effective style and `explode` cell: the Style Examples bytes are `;name` for `matrix`, `.` for `label`, an empty representation for `simple`, and `?name=` for `form`; a form-urlencoded body removes the leading `?` but retains `name=`. The empty string is not undefined, and every `n/a` cell remains undefined behavior ([OAS 3.0.4 §§4.7.12.4, 4.7.15.1.2, Appendix B](https://spec.openapis.org/oas/v3.0.4.html#style-examples)).

**[A]** RFC 6570 serialization MUST use its declared operator, `*` for `explode: true`, and a comma for non-exploded label lists/maps. Multiple regular form-style query parameters share one `?` variable list; separately expanding multiple `?` templates is not conformant ([OAS 3.0.4 §§C.1–C.2](https://spec.openapis.org/oas/v3.0.4.html#equivalences-between-fields-and-rfc6570-operators)).

**[A]** Because RFC 6570 prefix operators cannot combine, a query mixing regular form expansion with `allowReserved: true` MUST be constructed manually per parameter: reserved-permitting values use reserved expansion, and `[`, `]`, `#`, `&`, `=`, and `+` are pre-percent-encoded where Appendix C requires ([OAS 3.0.4 §§C.3–C.4.2](https://spec.openapis.org/oas/v3.0.4.html#non-rfc6570-field-values-and-combinations)).

**[B — convention]** The manual path assembles all present per-parameter contributions into one query component with one leading `?` and `&` between contributions; this assembled result is the single-query rule's equivalent at the authority's construction seam.

**[A]** A Parameter name that is not a legal RFC 6570 variable name MUST be percent-encoded before use in the template construction ([OAS 3.0.4 §§C.3, C.4.4](https://spec.openapis.org/oas/v3.0.4.html#illegal-variable-names-as-parameter-names)).

**[B — convention]** That variable-name encoding is internal to URL assembly and never changes the exact caller-envelope key defined by §7.

**[B — convention]** For `spaceDelimited`, `pipeDelimited`, and `deepObject`, the exact bytes are the corresponding OAS Style Examples: delimiters and deep-object brackets are percent-encoded, object names and values retain their shown alternation, and no unstated escape convention is added ([OAS 3.0.4 §4.7.12.4](https://spec.openapis.org/oas/v3.0.4.html#style-examples)).

**[B — convention]** Before dispatch, the binding refuses a supplied parameter or property name or scalar value containing its non-RFC style's structural delimiter: U+0020 SPACE for `spaceDelimited`, `|` for `pipeDelimited`, or any of `[`, `]`, `=`, and `&` for `deepObject`; no escape-convention configuration point is offered.

**[B — exclusion]** An effective `explode` value, including its default, in a Style Examples `n/a` cell excludes that parameter; therefore omitted `explode` on `deepObject` computes to the excluded `false` cell. Otherwise a compound-capable style is excluded only when its resolved declaration proves an unsupported compound member—an array whose resolved `items` schema declares only `object` or `array`, or an object with at least one declared property whose resolved schema declares only `object` or `array`. A typeless member proves no compound shape, a choice with multiple non-null possibilities supplies no single resolved member schema, and an object declaring no properties proves no compound member, so none triggers this exclusion; in particular, a declaration that still admits a scalar is never excluded, and candidate admission never inspects the supplied runtime value. The rule applies symmetrically to every compound-capable Parameter style and to §9.3's URL-encoded Encoding style path, including its defaulted `explode`, where the smallest owner is the selected media alternative rather than the target. OAS/RFC 6570 defines no expansion for the excluded cells, so the owning unit is excluded permanently under this identifier unless an incorporated authority defines that exact cell ([OAS 3.0.4 §§4.7.12.2.2–4.7.12.4, 4.7.15.1.2, C.1](https://spec.openapis.org/oas/v3.0.4.html#style-values), [RFC 6570 §3.2.1](https://www.rfc-editor.org/rfc/rfc6570#section-3.2.1)).

**[A]** Every path-template expression MUST have a corresponding effective path parameter, and an expanded path value containing unescaped `/`, `?`, or `#` refuses before dispatch ([OAS 3.0.4 §§3.5, 4.7.12.2.1](https://spec.openapis.org/oas/v3.0.4.html#path-templating)).

### 8.3 Content-form, empty, header, and cookie parameters

**[A]** A Parameter Object MUST contain exactly one of `schema` or `content`, and a `content` map MUST contain exactly one media-type entry; violating either cardinality or a path name/template requirement is an acceptance-floor defect owned by the affected operation ([OAS 3.0.4 §§4.7.12.2, 4.7.12.2.3](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields-for-use-with-content)).

**[B — convention]** A `content`-form Parameter application value serializes under its sole media type and then follows its destination: path and query representations are percent-encoded as one URI parameter value, while header serialization adds no URI percent-encoding and cookie serialization follows the cookie rules below. This is the minimal URI-validity assignment where the line defines the media representation but not the destination step.

**[A]** For a query parameter with `allowEmptyValue: true`, a supplied empty string emits a present zero-length value; absence still means omitted, and this binding infers no schema-validity consequence because OAS leaves that interaction implementation-defined ([OAS 3.0.4 §4.7.12.2.1](https://spec.openapis.org/oas/v3.0.4.html#parameter-allow-empty-value)).

**[A]** Header `schema` serialization performs no URI percent-encoding and adds no automatic quotes; cookie contributions are not URI-decoded after serialization ([OAS 3.0.4 §§4.7.12.2.2, Appendix D](https://spec.openapis.org/oas/v3.0.4.html#appendix-d-serializing-headers-and-cookies)).

**[B — convention]** An effective Header Parameter named `Cookie` supplies one raw Cookie field only when no effective cookie-location Parameter and no selected cookie credential contributes; the binding does not parse or merge the raw string, and a raw/structured collision refuses the target or makes the selected credential alternative unusable.

**[B — exclusion]** An effective Header Parameter named `Host` or `Content-Length` excludes the target permanently under this identifier because those fields are processor-owned and cannot be replaced by caller input; the exclusion reopens only if an incorporated HTTP authority defines caller control that preserves the processor's framing and routing obligations.

**[B — exclusion]** A form-style cookie declaration that produces multiple values excludes the target because OAS identifies RFC 6570's `&`-separated expansion as incorrect for Cookie's `; ` delimiter; the exclusion is permanent under this identifier unless an incorporated OAS edition defines a correct multi-value mapping ([OAS 3.0.4 Appendix D](https://spec.openapis.org/oas/v3.0.4.html#appendix-d-serializing-headers-and-cookies)).

## 9. Request and response media

### 9.1 Media identity, alternatives, and request election

**[A]** Media types parse under RFC 9110: type, subtype, and parameter names compare case-insensitively while parameter values retain their media-defined comparison rules ([RFC 9110 §§8.3.1, 8.3.2](https://www.rfc-editor.org/rfc/rfc9110#section-8.3.1)).

**[B — convention]** A declaration matches a concrete media type only when every declared parameter is present with an equal value; matches order by exact type/subtype before `type/*` before `*/*`, then by greatest declared-parameter count, and equal-specificity ties refuse.

**[B — limit]** Distinct content-map keys that normalize to one parsed media identity collide only for that identity and refuse selection through it; non-colliding entries survive, and map order never breaks the tie.

**[A]** A no-body invocation bypasses request-body media selection and emits neither a body nor `Content-Type`, because an absent optional effective Request Body contributes no HTTP content ([OAS 3.0.4 §§4.7.10.1, 4.7.13.1](https://spec.openapis.org/oas/v3.0.4.html#request-body-object)).

**[B — configuration point]** A body-emitting invocation preserves every admissible declared request alternative: a sole concrete declaration selects itself; multiple declarations or a range-only declaration require a concrete `requestMedia` choice before input consumption; the choice MUST match under §9.1 and never substitutes another declaration's schema.

**[B — configuration point]** A missing required choice, unmatched or ambiguous choice, unsupported selected lane, or body-emitting invocation with no admissible candidate refuses before dispatch; no body bytes or examples are sniffed to select a lane.

**[A]** Examples illustrate values ([OAS 3.0.4 §4.7.14.1](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields-11)).

**[B — limit]** Examples create no operation input or output member and never select a declaration, carriage lane, or media type.

**[B — convention]** The binding sends no `Accept` header: OAS ignores a Header Parameter named `Accept`, request-body content declares what the operation consumes, and response content supplies no portable instruction to advertise a preference ([OAS 3.0.4 §§4.7.12.2.1, 4.7.13, 4.7.17](https://spec.openapis.org/oas/v3.0.4.html#common-fixed-fields)).

### 9.2 Common carriage lanes

**[A]** An exact `application/json` or `+json` selection serializes the supplied value as strict JSON on requests and parses strict JSON on responses; JSON text uses UTF-8 ([RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)).

**[B — convention]** `text/json` is not a member of that JSON lane; as a `text/*` type it can use the character-data lane only when its schema declares `type: string` without `format: binary`. This convention reopens under a new identifier only if the IANA media-type registry registers `text/json` with JSON semantics.

**[B — convention]** A concrete character-data selection governed by a schema declaring `type: string` without `format: binary` carries the supplied string under its declared `charset`, defaulting to UTF-8; the closed character-data set is `text/*`, `application/xml`, and `+xml`, while `application/json` and `+json` are claimed by the JSON lane. The binding does not consult the live media-type registry's `Encoding considerations`: `application/json` is registered as binary, `text/csv` records no value, and a live lookup would violate this pinned, immutable reading ([RFC 6838 §4.2.1](https://www.rfc-editor.org/rfc/rfc6838#section-4.2.1), [RFC 2046 §4.1](https://www.rfc-editor.org/rfc/rfc2046#section-4.1), [RFC 7303 §§3, 9](https://www.rfc-editor.org/rfc/rfc7303#section-3)).

**[B — convention]** The charset parameter is the only character-encoding source this lane consults; BOMs and XML declarations do not alter it, and unsupported or invalid character decoding refuses.

**[A]** A resolved `type: string, format: binary` declaration authorizes unencoded octets, while `type: string, format: byte` denotes an artifact-encoded RFC 4648 Base64 string; the latter remains text, uses its Base64 character bytes outside JSON and form lanes, and is never decoded merely by crossing the OpenBindings raw-octet boundary ([OAS 3.0.4 §§4.4.1–4.4.2](https://spec.openapis.org/oas/v3.0.4.html#working-with-binary-data)).

**[B — convention]** A non-JSON, non-form concrete selection whose Media Type Object omits `schema`, whose present schema declares no `type`, or whose schema declares `format: binary` uses the raw-octet lane. A schema-omitted media range does not gain this lane because it declares no single concrete representation.

**[A]** Every other supported keyword in a no-`type` schema still applies, and `maxLength` on raw content measures decoded wire octets rather than the Base64 boundary string ([OAS 3.0.4 §4.4.2](https://spec.openapis.org/oas/v3.0.4.html#working-with-binary-data)).

**[A]** `contentEncoding` and `contentMediaType` are outside the closed 3.0 Schema Object vocabulary and therefore decide as if absent; although 3.0.4's multipart guidance discusses those names, it does not enlarge the same edition's strictly supported keyword inventory or create binding behavior ([OAS 3.0.4 §§4.7.24.1, 4.7.15.3](https://spec.openapis.org/oas/v3.0.4.html#json-schema-keywords)).

**[B — pin]** Every OpenBindings raw-octet value is a JSON string containing canonical RFC 4648 §4 Base64: standard alphabet, required padding, no ignored non-alphabet characters, and zero unused pad bits; requests decode before dispatch and responses encode the exact octets ([RFC 4648 §§3.3, 3.5, 4](https://www.rfc-editor.org/rfc/rfc4648)).

**[B — exclusion]** This specification does not generate XML from an object model because the OAS XML Object does not determine complete document bytes; the selected media alternative is excluded permanently under this identifier until an incorporated authority defines ordering, escaping, nulls, dynamic keys, and scalar lexical forms, while string and raw-octet XML carriage remain admitted ([OAS 3.0.4 §§4.7.14, 4.7.26](https://spec.openapis.org/oas/v3.0.4.html#xml-object)).

**[B — convention]** `readOnly` and `writeOnly` retain their OAS request/response validation meaning, but this binding never uses either annotation to delete a supplied wire member or synthesize an absent one ([OAS 3.0.4 §4.7.24.2](https://spec.openapis.org/oas/v3.0.4.html#schema-read-only)).

### 9.3 Form bodies and multipart parts

**[A]** `application/x-www-form-urlencoded` and `multipart/form-data` serialize object properties under the governing Schema and Encoding Objects; a non-object declaration has no form lane, and a multipart alternative without its required schema is upstream-invalid and unavailable ([OAS 3.0.4 §§4.7.14.4, 4.7.14.5, 4.7.15.3](https://spec.openapis.org/oas/v3.0.4.html#encoding-multipart-media-types)).

**[A]** For a dynamic object member, the effective property schema is the applicable exact `properties` schema, or `additionalProperties` when no exact property schema exists; applicable `allOf` constraints remain in force, and unsupported schema keywords create no additional property-routing behavior ([OAS 3.0.4 §4.7.24.1](https://spec.openapis.org/oas/v3.0.4.html#json-schema-keywords)).

**[B — convention]** For form-carriage selection, a resolved property declaration with exactly one non-null branch plus any null admission uses that sole non-null branch; `nullable: true` at the same level as `type` contributes null admission but no second carriage shape ([OAS 3.0.4 §§4.7.15.1.1, Appendix B](https://spec.openapis.org/oas/v3.0.4.html#common-fixed-fields-0)).

**[B — convention]** On the content-based form-urlencoded path and on the multipart path, a supplied JSON null for an optional property is elided as an omitted member and contributes neither a form-urlencoded field nor a multipart part. The Encoding RFC 6570-style path instead follows §8.2's authority-derived undefined-value bytes.

**[A]** Encoding `style`, `explode`, and `allowReserved` controls apply only to `application/x-www-form-urlencoded`; explicit presence of any control selects RFC 6570-style serialization and absent sibling controls take their defaults, while absence of all three selects content-based encoding. All three controls are ignored for multipart bodies ([OAS 3.0.4 §§4.7.15.1.2, C](https://spec.openapis.org/oas/v3.0.4.html#fixed-fields-for-rfc6570-style-serialization)).

**[A]** Form-urlencoded removes RFC 6570's leading `?`; its content path follows RFC 1866 form encoding while its style path follows RFC 6570, and the binding preserves the permitted encodings of each path rather than collapsing them to one authored byte spelling. On the content path, Encoding `contentType` routes a property's serialization and may declare a concrete type, wildcard, or comma-separated list ([OAS 3.0.4 §§4.7.15.1.1–4.7.15.2, Appendix E](https://spec.openapis.org/oas/v3.0.4.html#encoding-the-x-www-form-urlencoded-media-type), [RFC 1866 §8.2.1](https://www.rfc-editor.org/rfc/rfc1866#section-8.2.1), [RFC 6570](https://www.rfc-editor.org/rfc/rfc6570)).

**[A]** Multipart part `Content-Type` selection is: an explicit single concrete Encoding `contentType`; otherwise `application/octet-stream` for `type: string` with `format: binary` or `format: byte`, `text/plain` for a plain string or number/integer/boolean, `application/json` for an object, and the item-type default for an array. A no-`type` part has no default concrete type ([OAS 3.0.4 §4.7.15.1.1](https://spec.openapis.org/oas/v3.0.4.html#common-fixed-fields-0)).

**[A]** Every `multipart/form-data` part carries `Content-Disposition: form-data` with the schema-property name in its `name` parameter; an array property emits one part per element under that same name ([OAS 3.0.4 §4.7.15.3](https://spec.openapis.org/oas/v3.0.4.html#encoding-multipart-media-types)).

**[B — convention]** Repeated parts for one array preserve element order; cross-property multipart part order and cross-property form-urlencoded field order have no portable meaning. An implementation MAY emit a deterministic cross-property order, but the binding exposes and requires none; property-to-name membership and array-member order remain separate.

**[A]** For a multipart field, `format: byte` is declaration-equivalent to an Encoding `Content-Transfer-Encoding` Header schema that requires `base64`; OAS also notes that `Content-Transfer-Encoding` is deprecated for `multipart/form-data`, and defines serialization and parsing as undefined when an explicit Encoding Header schema conflicts by disallowing `base64` ([OAS 3.0.4 §4.7.15.3](https://spec.openapis.org/oas/v3.0.4.html#encoding-multipart-media-types)).

**[B — convention]** A no-`type` or `format: binary` part uses the raw-octet lane and §9.2's canonical Base64 boundary; a `format: byte` part rides as artifact-encoded Base64 text. The declaration equivalence alone emits no `Content-Transfer-Encoding`; when the artifact explicitly declares that Encoding header and its schema admits `base64`, the emitted field is `Content-Transfer-Encoding: base64`.

**[B — exclusion]** A `format: byte` part whose explicit Encoding `Content-Transfer-Encoding` Header schema disallows `base64` is unusable and any invocation that would emit it refuses loudly before dispatch; the defect is confined to that declared part. This exclusion is permanent under this identifier and reopens only if an incorporated OAS edition defines serialization and parsing for the conflict ([OAS 3.0.4 §4.7.15.3](https://spec.openapis.org/oas/v3.0.4.html#encoding-multipart-media-types)).

**[B — configuration point]** `propertyMedia` supplies one concrete media type per affected form or multipart property. It is required for a content-based form-urlencoded property whose Encoding `contentType` is a wildcard or comma-separated list, and for a multipart part whose resolved schema declares no `type` or whose Encoding `contentType` is a wildcard or comma-separated list. The choice MUST satisfy a declared member under §9.1, and an absent, unmatched, or ambiguous required choice refuses the selected media alternative before dispatch.

**[B — limit]** Except for the artifact-declared `Content-Transfer-Encoding: base64` case above, Encoding `headers` are descriptive at this operation boundary: the binding emits no part header merely from a Header Object schema and never emits an undeclared `Content-Transfer-Encoding`; alternatives needing caller-supplied part headers have no representation under this identifier ([OAS 3.0.4 §§4.7.15.1.1, 4.7.15.3](https://spec.openapis.org/oas/v3.0.4.html#encoding-headers)).

**[B — exclusion]** A multipart media type other than `multipart/form-data` is excluded because OAS defines no property-to-part correlation for unnamed ordered parts; the exclusion is permanent under this identifier and reopens only if an incorporated OAS edition defines that correlation ([OAS 3.0.4 §4.7.15.3](https://spec.openapis.org/oas/v3.0.4.html#encoding-multipart-media-types)).

### 9.4 HTTP content codings

**[A]** HTTP `Content-Encoding` is distinct from media type, from `format: byte`, and from the unsupported Schema Object keyword `contentEncoding`; request codings apply in listed wire order and response codings decode in reverse order before the selected media lane ([RFC 9110 §8.4](https://www.rfc-editor.org/rfc/rfc9110#section-8.4), [OAS 3.0.4 §4.4.2](https://spec.openapis.org/oas/v3.0.4.html#working-with-binary-data)).

**[A]** The artifact declaration surfaces are an effective request Header Parameter named `Content-Encoding` and a governing response Header Object of that name; field-name comparison is ASCII case-insensitive ([OAS 3.0.4 §§3.8, 4.7.12, 4.7.17](https://spec.openapis.org/oas/v3.0.4.html#response-headers), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — configuration point]** `requestContentCodings` and `responseContentCodings` are finite consumer maps from case-insensitive content-coding tokens to deterministic encoders and decoders; the artifact-declared field value fixes the ordered stack, and no configuration preference narrows its declared alternatives.

**[B — configuration point]** An unsupported token, a field value not admitted by its governing Header declaration, an ambiguous coding declaration, or an actual response coding with no governing Header Object refuses rather than being skipped or sniffed; configuring a codec supplies capability but never declares a coding the artifact omitted.

### 9.5 Response declaration, classification, and decoding

**[A]** Response keys are closed to exact three-digit status codes `100` through `599`, the five ranges `1XX` through `5XX`, `default`, and specification extensions; an exact key overrides its matching range ([OAS 3.0.4 §§3.7, 4.7.16](https://spec.openapis.org/oas/v3.0.4.html#responses-object)).

**[B — convention]** The governing Response Object lookup order is exact status, then the single matching range, then `default`; range-over-default is this specification's reading, and declarations never reclassify the native status.

**[A]** Success is the final RFC 9110 status in the 2xx class ([RFC 9110 §15.3](https://www.rfc-editor.org/rfc/rfc9110#section-15.3)).

**[B — convention]** Redirect following is runtime policy; a followed redirect MUST preserve the bound method and complete body, while a method-rewriting redirect is treated as the final response ([RFC 9110 §15.4](https://www.rfc-editor.org/rfc/rfc9110#section-15.4)).

**[A]** A response Header Object named `Content-Type` is ignored. Every other governing response Header Object declaring `required: true` makes that header mandatory in the actual response ([OAS 3.0.4 §§4.7.17, 4.7.21](https://spec.openapis.org/oas/v3.0.4.html#response-headers)).

**[B — limit]** An actual response missing such a declared required header is a loud protocol error, in the same class as the undeclared non-empty-response error below; header carriage remains outside the operation-value boundary.

**[A]** A non-empty response selects its concrete media type from `Content-Type` and then the most-specific matching governing content declaration ([OAS 3.0.4 §§4.7.16, 4.7.17](https://spec.openapis.org/oas/v3.0.4.html#response-object)).

**[B — convention]** An unmatched or ambiguous response media selection is a protocol error; a normalized collision follows §9.1's smallest-identity limit.

**[B — convention]** When a non-empty response omits `Content-Type`, the binding takes RFC 9110's permitted `application/octet-stream` assumption before ordinary matching; the resulting type still MUST match a governing declaration ([RFC 9110 §8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3)).

**[B — convention]** Empty responses emit no output value; successful non-empty responses emit the selected lane's one application value, while failure bodies use the same lanes and remain opaque application-authored failure data.

**[B — limit]** A non-empty response with no governing Response Object is a loud protocol error. Because Core provides no response-header or Link carriage in an operation value, Response Header and Link Objects create no output members under this identifier; consequently, even a declared `Location` header on a `201` response has no output representation ([OAS 3.0.4 §§4.7.16, 4.7.17](https://spec.openapis.org/oas/v3.0.4.html#response-object), Core [§5.1](../../openbindings.md#51-operations)).

**[B — limit]** One HTTP response body produces at most one operation value: the accepted 3.0 editions define no construct that frames one response body into multiple application values, including for `text/event-stream`; this is permanent under this identifier and reopens only if an incorporated authority defines such framing ([OAS 3.0.0 §4.7.17](https://spec.openapis.org/oas/v3.0.0.html#response-object), [3.0.1 §4.7.17](https://spec.openapis.org/oas/v3.0.1.html#response-object), [3.0.2 §4.7.17](https://spec.openapis.org/oas/v3.0.2.html#response-object), [3.0.3 §4.7.17](https://spec.openapis.org/oas/v3.0.3.html#response-object), [3.0.4 §4.7.17](https://spec.openapis.org/oas/v3.0.4.html#response-object)).

## 10. Servers and target URL

**[A]** Server declarations are scoped at Operation, Path Item, and root levels, with the more specific declaration overriding the outer scope; an absent or empty root list is equivalent to one Server Object whose URL is `/` ([OAS 3.0.4 §§4.7.1.1, 4.7.5, 4.7.9.1, 4.7.10.1](https://spec.openapis.org/oas/v3.0.4.html#server-object)).

**[B — convention]** An empty Operation or Path Item `servers` array supplies no local alternative and falls through to the next outer scope, matching the root empty-equals-absent precedent.

**[B — configuration point]** One effective server selects itself; multiple members require one consumer `server` choice before dispatch, the same value carries exact variable substitutions, and no member or variable preference is inferred.

**[A]** Server variables substitute their declared value, use `default` when no consumer value is supplied, and MUST satisfy a nonempty declared `enum`; an unresolved variable refuses before dispatch ([OAS 3.0.4 §4.7.6](https://spec.openapis.org/oas/v3.0.4.html#server-variable-object)).

**[A]** Before path assembly, an expanded relative Server URL—including the implied `/`—resolves against the location of the document containing that Server Object; the operation's path bytes are then appended verbatim to the expanded Server URL with no second relative-reference resolution, slash normalization, or path repair ([OAS 3.0.4 §§4.7.5.1, 4.7.8.1](https://spec.openapis.org/oas/v3.0.4.html#server-url)).

**[B — exclusion]** A Server URL containing a query or fragment excludes each target that would use it because the accepted editions define path append but no concatenation meaning for either component; the exclusion is permanent under this identifier and reopens only if an incorporated OAS edition defines that exact cell ([OAS 3.0.4 §§4.7.5.1, 4.7.8.1](https://spec.openapis.org/oas/v3.0.4.html#server-url)).

**[B — limit]** When embedded content has no document location to supply its base, a relative Server URL leaves the target unresolved and refuses before dispatch; the complete configured URL below remains the available recovery.

**[B — convention]** After path and query serialization, the completed target MUST parse and percent-decode under RFC 3986; an unusable target refuses before dispatch ([RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)).

**[C]** A complete configured URL MAY replace the selected target without replacing the artifact's method, parameters, body, response, or security semantics (Core [§5.3](../../openbindings.md#53-bindings)).

## 11. Security and channel assembly

**[A]** Operation `security` replaces root `security`; `[]` means no security requirement, array members are OR alternatives, every nonempty Security Requirement Object is an AND of its named schemes, and `{}` is a complete anonymous alternative ([OAS 3.0.4 §§4.7.10.1, 4.7.30](https://spec.openapis.org/oas/v3.0.4.html#security-requirement-object)).

**[B — configuration point]** The binding preserves every complete alternative and invents no anonymous-versus-credentialed preference; the consumer selects one complete alternative, and fragments from different alternatives are never combined.

**[A]** Requirement arrays for OAuth 2.0 and OpenID Connect contain scopes and may be empty; arrays for every other scheme type MUST be empty, and this binding surfaces the exact OAuth/OpenID scope strings ([OAS 3.0.4 §4.7.30.1](https://spec.openapis.org/oas/v3.0.4.html#security-requirements-name)).

**[B — configuration point]** `implicitConnectionScope` selects `entry` or `referring` document resolution for Security Requirement names and defaults to `entry`, following OAS's recommended entry-document scope while preserving the explicit alternative ([OAS 3.0.4 §4.3.2](https://spec.openapis.org/oas/v3.0.4.html#resolving-implicit-connections)).

**[A]** HTTP authentication-scheme tokens compare ASCII case-insensitively ([RFC 9110 §11.1](https://www.rfc-editor.org/rfc/rfc9110#section-11.1), [OAS 3.0.4 §4.7.27.1](https://spec.openapis.org/oas/v3.0.4.html#security-scheme-scheme)).

**[A]** `apiKey` credentials use their declared name and `query`, `header`, or `cookie` location, and HTTP `basic` and `bearer` credentials use the `Authorization` field ([OAS 3.0.4 §4.7.27](https://spec.openapis.org/oas/v3.0.4.html#security-scheme-object-0), [RFC 9110 §11.6.2](https://www.rfc-editor.org/rfc/rfc9110#section-11.6.2)).

**[B — pin]** A selected `basic` scheme consumes the runtime's `auth.basic` credential context and constructs `Authorization: Basic base64(user-id ":" password)` under [RFC 7617 §2](https://www.rfc-editor.org/rfc/rfc7617#section-2), including its user-id, password, character-encoding, and Base64 constraints.

**[B — pin]** OAuth 2.0 and OpenID Connect access tokens use the `Bearer` authorization scheme under [RFC 6750 §2.1](https://www.rfc-editor.org/rfc/rfc6750#section-2.1); another token type has no wire carriage under this identifier.

**[B — limit]** Any other declared HTTP authentication scheme remains visible as a consumer prerequisite, but this binding synthesizes no credential bytes for it; an alternative requiring it is unusable unless the runtime satisfies it as a complete prerequisite.

**[C]** Credentials and credential-acquisition state MUST NOT be embedded in an OBI document (Core [§9](../../openbindings.md#9-security-considerations)).

**[B — convention]** A credential destination that collides with an effective parameter, another credential in the same AND requirement, binding/processor-owned `Host`, `Content-Length`, `Content-Type`, or `Accept`, or a raw `Cookie` field makes only the selected security alternative unusable; another complete non-colliding alternative may still be selected, while §8.3 governs parameter-only processor-owned and raw/structured collisions.

**[B — convention]** Header names compare ASCII case-insensitively, cookie names compare exactly, and structured cookie contributions preserve membership and join as `name=value` separated by `; `; cookie order is not portable meaning ([RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1), [OAS 3.0.4 Appendix D](https://spec.openapis.org/oas/v3.0.4.html#appendix-d-serializing-headers-and-cookies)).

## 12. Configuration, synthesis, and conformance

### 12.1 Configuration vocabulary

**[B — configuration point]** The complete binding-specific configuration vocabulary is `requestMedia` (one concrete media type), `server` (one effective Server alternative plus exact variable values), `parameterConversion` (deterministic scalar converter), `implicitConnectionScope` (`entry` or `referring`), `requestContentCodings` (coding-to-encoder map), `responseContentCodings` (coding-to-decoder map), and conditional `propertyMedia` (one concrete media type per affected form or multipart property).

**[B — configuration point]** Every requirement is typed, discoverable from declarations, and preflightable; no configuration member appears in the caller envelope or operation contract, and decode and classification are fixed rules rather than configuration points.

### 12.2 Synthesis boundary and coverage

**[C]** Operation contracts remain protocol-neutral and MAY remain flat (Core [§5.5](../../openbindings.md#55-transforms)).

**[B — convention]** Synthesis emits an `inputTransform` that constructs §7's envelope, and transforms never route values to HTTP locations.

**[B — convention]** This binding defines no status, header, selected-media, or other context bindings at `inputTransform` or `outputTransform` positions; evaluation uses Core's closed environment unaugmented (Core [§5.5 clause 5](../../openbindings.md#55-transforms), [OBI-T-10](../../openbindings.md#103-tool-rules)).

**[B — limit]** Operation/dependency key spelling, flattening, output-schema choice, and Schema Object translation are synthesis policy, not binding semantics; no dynamic-object trigger, declaration-complex trigger, dialect trigger, `body.properties`, `body.whole`, routed tuple, or unmatched-field passthrough exists.

**[C]** A synthesizer MUST account for every addressable operation and every callback dependency as represented, excluded with §12.3's exact reason, or unsupported; a failure in an unused description position is coverage loss rather than invocation behavior (Core [OBI-B-02](../../openbindings.md#104-binding-specification-rules)).

**[C]** Every binding-specific configuration requirement remains in coverage accounting and invocation context, assigned to its represented target or declared alternative, and MUST NOT enter the operation input schema (Core [OBI-B-02](../../openbindings.md#104-binding-specification-rules)).

**[C]** Dependencies are synthesis outputs only and add no invocation target or receiver behavior.

### 12.3 Conformance rules

**[C]** A document conforms to **OAPI30-D-01** when its `content`, if present, satisfies §§3–5 and its `location`, if present, satisfies §4.

**[C]** A binding conforms to **OAPI30-D-02** when it names `openbindings.openapi-3.0@1`, carries the literal selector of §6.1, and identifies a source that passes the exact edition gate.

**[C]** A processor conforms to **OAPI30-P-01** when it implements the closed load gates, smallest-owner confinement, Schema Object subset, reference closure, and selector semantics of §§3–6.

**[C]** A processor conforms to **OAPI30-P-02** when it accepts only §7's envelope, applies §8's effective-parameter, collision, conversion, style, content, header, cookie, and path rules, and refuses every unknown or unroutable input before dispatch.

**[C]** A processor conforms to **OAPI30-P-03** when it preserves media alternatives and applies §9's matching, request election, carriage, form, multipart, content-coding, response lookup, classification, and unary-boundary rules without sniffing or undeclared fallback.

**[C]** A processor conforms to **OAPI30-P-04** when it resolves servers and complete target URLs under §10 and security alternatives, credentials, prerequisites, and channel collisions under §11.

**[C]** A synthesizer conforms to **OAPI30-S-01** when it preserves §12.2's binding/transform boundary, emits §6.2's targetless unconstrained dependencies, and reports complete coverage under Core OBI-B-02.

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
- [RFC 6570](https://www.rfc-editor.org/rfc/rfc6570)
- [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750)
- [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838)
- [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)
- [RFC 7303](https://www.rfc-editor.org/rfc/rfc7303)
- [RFC 7617](https://www.rfc-editor.org/rfc/rfc7617)
- [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)
- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)
