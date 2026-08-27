# `openbindings.openapi-2.0` Binding Specification

## 1. Identifier and rule labels

**[B — convention]** The opaque binding-specification identifier has exactly the spelling **`openbindings.openapi-2.0@1`**.

**[C]** Publication mints §1's identifier under Core [OBI-B-01](../../openbindings.md#104-binding-specification-rules), and an incompatible change to the accepted domain or portable meaning requires a different identifier under Core [OBI-B-03](../../openbindings.md#104-binding-specification-rules).

**[A]** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) only when they appear in all capitals.

**[B — convention]** Every normative paragraph and normative table row carries one visible provenance label: **A** is derived from incorporated authority and cites it, **C** is derived from the OpenBindings Core, and **B** is this specification's explicitly classified bridge (`convention`, `pin`, `configuration point`, `exclusion`, or `limit`). A `convention` is a choice this specification makes where no authority speaks; a `pin` fixes one reading of an ambiguous or versioned authority; a `configuration point` names a decision deferred to the consumer; an `exclusion` removes something from the accepted surface behind a stated reopen trigger; a `limit` states a boundary this specification does not cross.

## 2. Scope and incorporated authorities

**[B — convention]** This binding specification defines how OpenAPI 2.0 artifacts govern OpenBindings sources: which documents are accepted and when loading refuses, how operation targets are addressed and synthesized, what an invocation's inputs and outputs mean, and which wire mechanics the artifact fixes. It builds on the OpenBindings Core specification (`../../openbindings.md`).

**[B — convention]** This specification accepts exactly OpenAPI Specification (OAS) edition `2.0`; no `swagger` wildcard or compatible-looking value widens this singleton domain, and a document marked only with a 3.x-style `openapi` field refuses at the `swagger` load gate.

**[A]** The root `swagger` field identifies the OAS edition used by the artifact and MUST have exactly the string value `"2.0"` ([OAS 2.0 Swagger Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields)).

**[A]** OAS governs the artifact and every HTTP mechanic it declares, including object structure, canonical references, parameters, media declarations, target construction, responses, and security ([OAS 2.0 §6](https://spec.openapis.org/oas/v2.0.html#specification)); [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) governs the remaining HTTP semantics fixed by this binding.

**[C]** This document defines portable binding meaning, not an invocation API: request objects, retry and redirect APIs, cancellation, credential acquisition, and receiver deployment remain runtime or application concerns under Core [§1.2](../../openbindings.md#12-out-of-scope).

## 3. Source carriage and refusal architecture

### 3.1 Accepted representations

**[B — convention]** `content` is either the parsed Swagger document object or string content; `location` is an absolute URI for that document; content has primacy, a co-present location supplies its base URI, and the OBI retrieval URI is never that base (Core [§5.4](../../openbindings.md#54-sources), [§7](../../openbindings.md#7-reference-resolution)).

**[A]** The edition cites [YAML 1.2 (2009)](https://yaml.org/spec/1.2-old/spec.html) as its serialization target, requires the resulting representation to be a JSON object, and makes field names case-sensitive ([OAS 2.0 §§6.1–6.2](https://spec.openapis.org/oas/v2.0.html#format)).

**[B — pin]** As this specification's rendering of that YAML 1.2 language, string content MUST parse as YAML 1.2.2, of which JSON is a subset; duplicate mapping keys, non-scalar-string mapping keys, explicit tags outside YAML's JSON-compatible tag set, resolved values with no RFC 7159 JSON image (`.inf`, `-.inf`, `.nan`), and a multi-document YAML stream refuse at this grammar gate. Exactly one YAML document is accepted ([YAML 1.2.2 §§3.2.1, 10.2.1, 10.3.2](https://yaml.org/spec/1.2.2/), [RFC 7159](https://www.rfc-editor.org/rfc/rfc7159)).

**[A]** The root MUST be a JSON object and its required `swagger` field MUST be exactly `"2.0"` ([OAS 2.0 Format and Swagger Object](https://spec.openapis.org/oas/v2.0.html#swagger-object)).

**[B — convention]** An absent, mismatched, or differently typed `swagger` value fails exact edition discrimination and refuses at the `swagger` load gate.

### 3.2 Closed load gates and confined defects

**[B — convention]** Defect outcomes use a fixed vocabulary: a source **refuses at load** only at §3.2's gates; a declaration defect **excludes** its smallest owning unit from synthesis and selection; an addressable target whose use requires a missing choice or unsupported alternative is **unusable** and **refuses before dispatch** when invoked; a wire fact this specification cannot represent faithfully is a **loud protocol error**; and synthesis reports every exclusion and inexpressible declaration as **coverage loss**.

**[B — convention]** A **lane** is one media-selected value-to-bytes serialization path—JSON, character-data, raw-octet, form, multipart, and this line's other incorporated forms—and the **smallest media owner** is the narrowest declared unit that owns a defective lane.

**[B — limit]** The load gates are the following closed ordered set: accepted-representation grammar, scalar/tag/key resolution, JSON-object root shape, and the `swagger` load gate for exact edition discrimination; no condition outside this set is a load gate.

**[B — limit]** After those gates pass, a defect confines to the smallest selected unit that owns it; an unreachable defect destroys no target, and a whole source refuses only when every position that could contain an addressable target is defective so that no conformant selector can resolve.

**[A]** The root `paths` field is required, while a present Paths Object and each Path Item Object may be empty, including when documentation is filtered by access control; a present empty Paths Object is upstream-valid and synthesizes zero operations ([OAS 2.0 Swagger, Paths, and Path Item Objects](https://spec.openapis.org/oas/v2.0.html#paths-object)).

**[B — limit]** After the closed load gates pass, an absent root `paths` is an upstream declaration defect that leaves no position capable of containing an addressable operation; the source therefore refuses under §3.2's whole-source refusal rule. This stated consequence is not an additional load gate.

**[B — limit]** A target that is addressable but unusable because of a missing choice, unsupported alternative, or exclusion refuses at invocation or is reported as synthesis coverage loss; it never becomes a whole-source load refusal.

**[B — limit]** This revision declares no source-scope exclusion: unlike the [`include`/`mount` filtering surface of `openbindings.usage@1`](../usage/openbindings.usage.md#3-accepted-source-representations), no source member or addressable target is filtered merely by its position in the source.

**[B — limit]** An unknown non-extension field creates no binding behavior and confines as an unsupported field at the smallest selected owner that depends on it; an unused unknown field affects no target. An `x-` specification extension remains an inert annotation under this identifier, and no unknown member is guessed into a fixed or patterned field ([OAS 2.0 §6.4 and Specification Extensions](https://spec.openapis.org/oas/v2.0.html#specification-extensions)).

## 4. `location`, `content`, and composition

**[C]** A present `location` MUST be an absolute URI addressing the Swagger document itself, and dereferencing it MUST yield an accepted representation; a bare filesystem path is not conformant (Core [OBI-D-05](../../openbindings.md#102-document-rules)).

**[B — convention]** A present `content` MUST be one of §3.1's two representations, and no other JSON type is accepted.

**[A]** Relative references resolve against the referring document, and JSON or YAML document fragments are JSON Pointers; canonical dereferencing preserves the base of each containing resource rather than resetting every reference to the entry document ([OAS 2.0 Reference Object](https://spec.openapis.org/oas/v2.0.html#reference-object), [JSON Reference draft-03 §§3–4](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03)).

**[B — convention]** Embedded content without a co-present `location` MUST be self-contained; a location-only source uses its location as the entry-document base (Core [§7](../../openbindings.md#7-reference-resolution)).

## 5. References, Schema Objects, and confinement

### 5.1 Reference semantics

**[A]** A Reference Object contains one required `$ref`; non-`$ref` siblings have no effect, the value is a URI, relative values use the referring-document base, and fragment resolution uses RFC 6901 JSON Pointer under canonical dereferencing ([OAS 2.0 Reference Object](https://spec.openapis.org/oas/v2.0.html#reference-object), [JSON Reference draft-03 §§3–4](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03), [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)).

**[A]** A reference composes its target plus the transitive closure of references reachable from that target, not unrelated material in the same retrieved document; a referenced document need not itself be a conforming Swagger Document ([OAS 2.0 Reference Object](https://spec.openapis.org/oas/v2.0.html#reference-object)).

**[A]** Reusable root definitions, parameters, and responses create no global declaration until referenced ([OAS 2.0 File Structure, Definitions, Parameters Definitions, and Responses Definitions](https://spec.openapis.org/oas/v2.0.html#file-structure)).

**[A]** OAS 2.0 Schema Objects omit draft-04 `id`, so no in-schema member changes a Schema Object's resource base; external and fragment references retain the containing schema resource URI ([OAS 2.0 Schema Object](https://spec.openapis.org/oas/v2.0.html#schema-object), [JSON Schema Core draft-04 §7](https://tools.ietf.org/html/draft-zyp-json-schema-04#section-7)).

**[B — pin]** JSON Reference draft-03 recommends appropriate checks against infinite recursion; this specification pins that recommendation to a deterministic requirement: reference traversal MUST detect cycles without resource exhaustion, a cyclic but resolvable graph is legitimate, and cycle detection terminates traversal rather than truncating the graph ([JSON Reference draft-03 §7](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03#section-7)).

**[B — exclusion]** When a selected Path Item carries `$ref`, the selected operation target is excluded only if a fixed field used by that target appears in both the referenced Path Item and its adjacent declaration, because OAS defines that collision as undefined. `Used by that target` means the selected method field plus the Path Item's `parameters`; documentation fields never collide for this purpose. Collisions confined to unused fields and all non-colliding adjacent fields leave the target usable. The exclusion reopens only if an incorporated OAS 2.0 authority defines the collision ([OAS 2.0 Path Item Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-3)).

**[A]** The first three reference conditions in the table below are defined by OAS 2.0's File Structure, Reference Object, and Path Item Object rules ([OAS 2.0 File Structure, Reference Object, and Path Item Object](https://spec.openapis.org/oas/v2.0.html#reference-object)):

| condition |
| --- |
| **[A]** Unresolvable selected Path Item `$ref` |
| **[A]** Unresolvable reference reached by one selected Parameter or Response Object |
| **[A]** Unresolvable Schema Object reference reached only by one request or response lane |
| **[B — limit]** An unresolvable reference reachable only from an unused reusable or documentation position leaves invocation unaffected; synthesis reports the unrepresented position. |
| **[B — limit]** A defect outside the target-plus-reachable closure has no effect on that target. |

**[B — limit]** In table order, the three authority-backed conditions confine as follows: the referenced Path Item and its operations are unaddressable; the selected operation or its affected declared alternative is unusable while unrelated operations survive; or the affected lane is unavailable while unrelated operations survive.

### 5.2 Schema Object dialect and data forms

**[A]** The supported Schema Object dialect is exactly OAS 2.0's predefined subset of JSON Schema draft 04, not full draft 04 and not any later JSON Schema dialect ([OAS 2.0 Data Types and Schema Object](https://spec.openapis.org/oas/v2.0.html#schema-object)).

**[A]** Its closed JSON-Schema-derived keyword inventory is `$ref`, `format`, `title`, `description`, `default`, `multipleOf`, `maximum`, `exclusiveMaximum`, `minimum`, `exclusiveMinimum`, `maxLength`, `minLength`, `pattern`, `maxItems`, `minItems`, `uniqueItems`, `maxProperties`, `minProperties`, `required`, `enum`, `type`, `items`, `allOf`, `properties`, and `additionalProperties`; OAS additionally defines `discriminator`, `readOnly`, `xml`, `externalDocs`, and `example` ([OAS 2.0 Schema Object](https://spec.openapis.org/oas/v2.0.html#schema-object)).

**[A]** A Schema Object `type` may be one primitive type name or a nonempty unique array of primitive type names, including `null`; every declared draft-04 assertion remains active across admitted alternatives ([JSON Schema Core draft-04 §3.5](https://tools.ietf.org/html/draft-zyp-json-schema-04#section-3.5), [JSON Schema Validation draft-04 §5.5.2](https://tools.ietf.org/html/draft-fge-json-schema-validation-00#section-5.5.2)).

**[A]** Keywords absent from the closed inventory—including `$schema`, `id`, `anyOf`, `oneOf`, `not`, `dependencies`, `patternProperties`, and `additionalItems`—have no OAS 2.0 Schema Object semantics ([OAS 2.0 Schema Object](https://spec.openapis.org/oas/v2.0.html#schema-object)).

**[B — convention]** For every lane, style, shape, and member-inspection rule in this document, a **resolved declaration** is obtained by following `$ref` and conjoining every `allOf` branch; absence of `type` leaves the declaration typeless. **Declares only X** means that the resolved type set is nonempty and every member is in X. **Admits `string` as its sole non-null type** means that the resolved type set is exactly `{string}` or `{string, null}`.

**[B — limit]** A selected position depends on one of those absent keywords only when the keyword appears in a resolved declaration this specification consults for a binding decision: lane admission, form-property typing, or parameter shape. Such a consulted dependency is outside the upstream dialect and confines at its smallest owning lane; presence in an unconsulted schema position creates no exclusion or invocation effect.

**[A]** `allOf` preserves every component assertion; `discriminator` names a property defined at that same schema and included in its `required` list, and its value MUST name either that schema or a schema that inherits it. Discrimination never skips validation, invents coercion, admits an unrelated definition, or makes an inline schema addressable by friendly name ([OAS 2.0 Schema Object and Composition and Inheritance](https://spec.openapis.org/oas/v2.0.html#composition-and-inheritance-polymorphism)).

**[A]** The known format pairs retain their OAS meanings: integer `int32`/`int64`, number `float`/`double`, and string `byte`, `binary`, `date`, `date-time`, and `password`; `date` and `date-time` use RFC 3339, while an unknown `format` remains an annotation ([OAS 2.0 Data Types](https://spec.openapis.org/oas/v2.0.html#data-types), [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339)).

**[A]** The defined `byte` format denotes Base64 characters, `binary` denotes an octet sequence, and `file` is an additional non-body Parameter or response-root type rather than a general Schema Object primitive ([OAS 2.0 Data Types](https://spec.openapis.org/oas/v2.0.html#data-types)).

**[A]** A `default` declared by a Parameter Object, Items Object, Header Object, or Schema Object MUST conform to that object's declared type ([OAS 2.0 Parameter Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-6), [Items Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-7), [Header Object](https://spec.openapis.org/oas/v2.0.html#header-object), and [Schema Object](https://spec.openapis.org/oas/v2.0.html#schema-object)).

**[B — convention]** An artifact `default` describes server or instance behavior and never supplies a missing caller member or response value at the binding boundary.

**[B — limit]** A nonconforming `default` is a declaration defect confined to the dependents of its declaring Parameter, Items, Header, or Schema Object at the smallest owner; its effect is declaration-keyed and does not depend on whether a caller value is supplied.

**[A]** A property marked `readOnly: true` MAY appear in a response and MUST NOT be sent in a request ([OAS 2.0 Schema Object fixed fields](https://spec.openapis.org/oas/v2.0.html#fixed-fields-12)).

**[B — convention]** Supplying a `readOnly: true` request property refuses the selected request lane rather than silently deleting caller data.

**[B — exclusion]** A resolved request declaration that, across its conjoined branches, both requires and marks the same property `readOnly: true` excludes that request lane because no instance can satisfy both request obligations; the exclusion reopens only if incorporated authority defines a reconciliation.

**[B — limit]** Schema translation is loss-accounted synthesis policy: a synthesizer may project only assertions it preserves exactly and MUST report an unrepresented or non-equivalent assertion at the smallest owning operation or media lane; it never silently translates this dialect as 2020-12.

## 6. Selector

**[B — convention]** `selector` is REQUIRED and has exactly one literal spelling: `#/paths/<escaped-path>/<lowercase-method>`, where `<escaped-path>` is the Paths Object key escaped once under RFC 6901 and `<lowercase-method>` is one of `get`, `put`, `post`, `delete`, `options`, `head`, or `patch` ([OAS 2.0 Path Item Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-3)).

**[A]** Selector evaluation never percent-decodes the JSON Pointer and fails unresolvable when the selected operation is absent ([RFC 6901 §§3–4](https://www.rfc-editor.org/rfc/rfc6901#section-3), [OAS 2.0 Paths Object](https://spec.openapis.org/oas/v2.0.html#paths-object)).

**[B — convention]** After the pointer selects a Path Item, selector evaluation canonically resolves that Path Item's `$ref` before reading the method field; this deliberate extra resolution keeps bundled and external referenced Path Items addressable ([OAS 2.0 Path Item and Reference Objects](https://spec.openapis.org/oas/v2.0.html#path-item-object)).

## 7. Target interaction and caller envelope

**[B — convention]** Here and below, an **effective** declaration is the declaration that remains after applying the artifact's scope, default, and override rules stated in §§8–10.

**[A]** An addressed operation denotes its declared HTTP method, completed target URL, effective Parameters, optional payload, security requirements, and final HTTP response ([OAS 2.0 Operation Object](https://spec.openapis.org/oas/v2.0.html#operation-object)).

**[B — convention]** The caller-facing correspondence value is exactly `{parameters?: {...}, body?: <one JSON value>}`; absence means not supplied, `body: null` is a supplied JSON null, and the artifact alone determines parameter location and serialization.

**[B — convention]** The four named non-body locations—`path`, `query`, `header`, and `formData`—use `parameters`; the single `in: body` Parameter uses `body`.

**[A]** A body Parameter's declared `name` has documentation meaning but no wire role ([OAS 2.0 Parameter Object](https://spec.openapis.org/oas/v2.0.html#parameter-object)).

**[B — convention]** When every effective non-body Parameter name is unique across locations, its caller key is the exact declared name; if any name is repeated across legal locations, the target uses qualified mode for every non-body Parameter and each key is `<location>/<RFC6901-escaped-name>`, making the flat map injective without depending on map order.

**[A]** Operation Parameters override Path Item Parameters only at the same exact name-plus-location identity; duplicate effective Parameters in one location are upstream-invalid, while same-name Parameters in different locations are distinct ([OAS 2.0 Path Item, Operation, and Parameter Objects](https://spec.openapis.org/oas/v2.0.html#fixed-fields-4)).

**[B — exclusion]** Duplicate effective Parameters in one location exclude their smallest owning operation; this exclusion reopens only if an incorporated OAS 2.0 authority admits such duplicates.

**[B — convention]** Legal cross-location duplicates remain independently supplied through the qualified mode above.

**[B — exclusion]** Two effective header Parameters whose names differ only by ASCII case exclude the selected target because OAS Parameter names are case-sensitive while HTTP field names are case-insensitive; the wire cannot preserve the distinction. This exclusion reopens only if an incorporated authority defines a wire mapping that preserves such case-distinct declarations ([OAS 2.0 Parameter Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-6), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — convention]** An envelope top-level key other than `parameters` or `body`, a present non-object `parameters` member, or any unknown parameter key refuses before dispatch, regardless of whether a body exists; no unmatched-field passthrough exists.

**[A]** A missing required Parameter refuses before dispatch; every path Parameter is required, while a non-path Parameter defaults to optional, and an artifact `default` describes server behavior rather than a value the binding may insert ([OAS 2.0 Parameter Object fixed fields](https://spec.openapis.org/oas/v2.0.html#fixed-fields-6)).

**[A]** Every selected effective Parameter requires `name` and an `in` value from `query`, `header`, `path`, `formData`, or `body`; an `in: body` Parameter requires `schema`, every other Parameter requires `type`, and `type: array` requires `items` ([OAS 2.0 Parameter Object fixed fields](https://spec.openapis.org/oas/v2.0.html#fixed-fields-6)).

**[B — limit]** A selected effective Parameter missing one of those wire-critical fields or carrying an inadmissible `in` is a declaration defect that excludes the selected target. The disposition is declaration-keyed and never changes with the presence, absence, or value of caller input.

**[A]** The effective Parameter set MUST NOT contain both an `in: body` Parameter and any `in: formData` Parameter, and it contains at most one body Parameter ([OAS 2.0 Parameter Object](https://spec.openapis.org/oas/v2.0.html#parameter-object)).

**[B — limit]** Violating either upstream constraint excludes the selected operation under §3.2's smallest-owner rule.

## 8. Non-body Parameters and form payloads

### 8.1 Types, conversion, and empty values

**[A]** Every non-body Parameter uses its own `type`, `format`, `items`, and inline validation fields rather than a Schema Object; its admitted `type` is `string`, `number`, `integer`, `boolean`, `array`, or, only for `formData`, `file` ([OAS 2.0 Parameter and Items Objects](https://spec.openapis.org/oas/v2.0.html#fixed-fields-6)).

**[A]** An Items Object requires its own internal `type`, whose closed domain is `string`, `number`, `integer`, `boolean`, or `array`; files and models are inadmissible, and an internal `type: array` requires a nested `items` ([OAS 2.0 Items Object fixed fields](https://spec.openapis.org/oas/v2.0.html#fixed-fields-7)).

**[B — limit]** A malformed selected Items Object is a declaration defect that excludes the selected target at its smallest owner independently of caller or response values.

**[B — convention]** Every supplied non-null Parameter value MUST satisfy its declared type and inline assertions before serialization; `allowEmptyValue` changes only empty-value carriage and does not erase another assertion ([OAS 2.0 Parameter Object fixed fields](https://spec.openapis.org/oas/v2.0.html#fixed-fields-6)).

**[B — convention]** A supplied non-null Parameter value that fails its declared type or any inline assertion refuses before dispatch.

**[B — pin]** Draft-04's `integer` type is literal: a JSON number with a fraction or exponent part does not satisfy `integer`, so a supplied `1.0` refuses before dispatch ([JSON Schema Core draft-04 §3.5](https://tools.ietf.org/html/draft-zyp-json-schema-04#section-3.5)).

**[B — configuration point]** `parameterConversion` is one deterministic consumer-supplied conversion from each supplied JSON boolean, number, or null to a string; strings pass identically, arrays apply the converter to each member, and any supplied non-string scalar without a configured result refuses before dispatch.

**[B — configuration point]** Non-body JSON null is conversion-required and is never authored as omission: OAS excludes `null` from non-body Parameter types and supplies no JSON-null serialization, so only the configured deterministic string result can make it usable ([OAS 2.0 Parameter Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-6)).

**[A]** `allowEmptyValue` applies only to `query` and `formData` and defaults to `false`; a supplied empty string with `allowEmptyValue: true` may be represented as a name alone or as a present empty value ([OAS 2.0 Parameter Object fixed fields](https://spec.openapis.org/oas/v2.0.html#fixed-fields-6)).

**[B — convention]** A supplied empty string with `allowEmptyValue` absent or `false` refuses before dispatch because the declaration does not admit an empty value.

**[B — convention]** Absence from the caller envelope omits the Parameter.

**[B — configuration point]** Where those two admitted empty spellings produce distinct bytes, `emptyValueForm` MUST select `name-only` or `empty`; no binding default prefers one, a supplied empty string without that required choice refuses before dispatch, and multipart represents either choice as one named zero-length part.

### 8.2 `collectionFormat` and location assembly

**[A]** An array Parameter uses the following complete `collectionFormat` table; omitted `collectionFormat` means `csv`, and `multi` is admitted only for `query` and `formData` ([OAS 2.0 Parameter and Items Objects](https://spec.openapis.org/oas/v2.0.html#items-object)):

| `collectionFormat` | structural spelling |
| --- | --- |
| **[A]** `csv` | converted members joined with `,` |
| **[A]** `ssv` | converted members joined with U+0020 SPACE |
| **[A]** `tsv` | converted members joined with U+0009 TAB |
| **[A]** `pipes` | converted members joined with `\|` |
| **[A]** `multi` | one repeated contribution per converted member; `query` and `formData` only |

**[B — convention]** Array-member order is preserved.

**[B — convention]** A supplied array whose converted member contains its selected structural delimiter refuses that invocation before dispatch because OAS defines no escaping that preserves the array boundary; the Parameter remains usable for other caller values.

**[B — exclusion]** A `multi` declaration on a `path` or `header` Parameter is a declaration defect that excludes the selected target before caller values are inspected; the exclusion reopens only if an incorporated OAS 2.0 authority admits `multi` at that location or defines its wire meaning.

**[B — exclusion]** A non-body array whose resolved Items declaration declares only `array` is excluded because OAS defines no unambiguous composition of the inner and outer `collectionFormat` delimiters; the exclusion reopens only if incorporated authority defines nested-array serialization ([OAS 2.0 Items Object](https://spec.openapis.org/oas/v2.0.html#items-object)).

**[A]** A response Header Object array uses `csv`, `ssv`, `tsv`, or `pipes`, defaults to `csv`, and never admits `multi` ([OAS 2.0 Header Object](https://spec.openapis.org/oas/v2.0.html#header-object)).

**[B — limit]** Header declarations affect decoding and coverage but do not by themselves create operation output members.

**[B — convention]** Query and path names or converted values encode each UTF-8 byte outside RFC 3986's unreserved set as uppercase `%HH`; structural delimiters introduced by `collectionFormat`, `?`, `&`, and `=` remain structural, and caller keys never change ([RFC 3986 §§2.1–2.3, 3.3–3.4](https://www.rfc-editor.org/rfc/rfc3986)).

**[A]** Every effective path Parameter name MUST correspond to an expression in the associated Paths key ([OAS 2.0 Path Templating and Parameter Object](https://spec.openapis.org/oas/v2.0.html#path-templating)).

**[B — convention]** Every path-template expression MUST have one corresponding effective path Parameter because an unfillable expression cannot dispatch; path substitution cannot alter the host, base path, query boundary, or fragment.

**[B — limit]** A missing, extra, or mismatched effective path Parameter is a declaration defect that excludes the selected target independently of caller values.

**[B — convention]** Query contributions use one leading `?`, exact percent-encoded names, `=` before a present value, repeated pairs for `multi`, and `&` between contributions; map or Parameter-array order is not portable meaning.

**[B — convention]** Header values perform no URI percent-encoding and add no automatic quotes.

**[B — convention]** A supplied header value containing CR, LF, or another field-invalid byte refuses before dispatch at the affected Parameter ([RFC 9110 §§5.1, 5.5](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — exclusion]** An effective Header Parameter whose name compares ASCII case-insensitively to `Host`, `Content-Length`, or `Content-Type` excludes the target because those fields are processor- or binding-owned and cannot be replaced by caller input; the exclusion reopens only if an incorporated HTTP authority defines caller control that preserves the processor's framing, routing, and selected-body-media obligations.

**[B — convention]** The binding emits no implicit `Accept` field; an artifact-declared header Parameter named `Accept` remains an ordinary caller-supplied Parameter because OAS 2.0 defines no ignored-header rule. It therefore leaves the processor-owned credential-collision list: a credential destined for `Accept` collides, if at all, under the ordinary parameter-collision rule ([RFC 7231 §5.3.2](https://www.rfc-editor.org/rfc/rfc7231#section-5.3.2), [OAS 2.0 Parameter Object](https://spec.openapis.org/oas/v2.0.html#parameter-object)).

### 8.3 `formData` payloads

**[A]** Effective `formData` is usable only when effective `consumes` includes `application/x-www-form-urlencoded`, `multipart/form-data`, or both; the selected concrete request media fixes which form encoding is used ([OAS 2.0 Parameter Object](https://spec.openapis.org/oas/v2.0.html#parameter-object)).

**[A]** URL-encoded form names and converted values replace SPACE with `+`, percent-encode other non-alphanumeric bytes as `%HH`, separate name and value with `=`, and separate pairs with `&` ([HTML 4.01 §17.13.4.1](https://www.w3.org/TR/html401/interact/forms.html#h-17.13.4.1)).

**[B — convention]** The HTML control-order rule does not transfer to an OAS Parameter list.

**[B — convention]** Before that algorithm, form names and converted values use UTF-8 bytes; OAS exposes no form-character-set choice, so this single encoding closes the otherwise unwarranted character-to-octet seam.

**[B — pin]** URL-encoded form percent-encoding leaves RFC 3986 unreserved bytes literal; after SPACE becomes `+`, every other UTF-8 byte is encoded as uppercase `%HH`, matching §8.2's query-encoding pin.

**[B — convention]** URL-encoded cross-Parameter pair order has no portable meaning; `multi` preserves array-member order through repeated pairs, and every other array format contributes its single joined value.

**[B — exclusion]** A `file` Parameter selected through `application/x-www-form-urlencoded` is excluded because OAS and its incorporated form authority do not determine how file octets and file metadata become that character form; the exclusion reopens only if incorporated authority defines that cell.

**[A]** Multipart form data emits one part per present Parameter, or one part per member for `collectionFormat: multi`; every part has `Content-Disposition: form-data` with the exact Parameter name in `name`, while other array formats put the joined value in one part ([OAS 2.0 Parameter Object](https://spec.openapis.org/oas/v2.0.html#parameter-object), [HTML 4.01 §17.13.4.2](https://www.w3.org/TR/html401/interact/forms.html#h-17.13.4.2)).

**[B — convention]** Multipart part order across different Parameters has no portable meaning; repeated parts for one array preserve member order, part boundaries MUST NOT occur in content, and no `Content-Transfer-Encoding` is emitted.

**[A]** A non-file multipart value is character data whose part `Content-Type` defaults to `text/plain`; a `file` value is exact octets at the operation boundary and requires an appropriate concrete part `Content-Type` ([HTML 4.01 §17.13.4.2](https://www.w3.org/TR/html401/interact/forms.html#h-17.13.4.2)).

**[B — convention]** The binding emits a non-file part as `text/plain; charset=utf-8`, closing the character-to-octet choice without changing its artifact value.

**[B — configuration point]** Each present `file` Parameter requires one concrete `propertyMedia` choice for its multipart part because the artifact declares no file-part media type; the choice never supplies filename metadata, and an absent or invalid choice refuses before dispatch.

**[B — exclusion]** A form Parameter name that cannot be represented safely as the multipart `name` parameter, including CR or LF, excludes only that multipart media alternative; the exclusion reopens only if incorporated authority defines an unambiguous encoding.

## 9. Request and response media

### 9.1 Media identity, effective declarations, and request election

**[A]** Root `consumes` and `produces` provide operation defaults; a present Operation list replaces its root list, including an empty list ([OAS 2.0 Swagger and Operation Objects](https://spec.openapis.org/oas/v2.0.html#fixed-fields-4)).

**[B — convention]** List order supplies no preference.

**[A]** Media types parse under RFC 9110: type, subtype, and parameter names compare case-insensitively while parameter values retain their media-defined comparison rules ([RFC 9110 §§8.3.1–8.3.2](https://www.rfc-editor.org/rfc/rfc9110#section-8.3.1), [OAS 2.0 MIME Types](https://spec.openapis.org/oas/v2.0.html#mime-types)).

**[B — convention]** A **concrete media type** has no wildcard in either its type or subtype; media-type parameters do not affect concreteness.

**[B — convention]** A declaration matches a concrete media type only when every declared parameter is present with an equal value; matches order by exact type/subtype before `type/*` before `*/*`, then by greatest declared-parameter count, and equal-specificity ties refuse.

**[B — limit]** Distinct list entries that normalize to one parsed media identity collide only for that identity and refuse selection through it; non-colliding entries survive, and list order never breaks the tie.

**[B — convention]** A no-payload invocation bypasses request-media selection and emits neither a body nor `Content-Type`; absence of every optional body or `formData` value is not a supplied empty payload ([OAS 2.0 Parameter Object](https://spec.openapis.org/oas/v2.0.html#parameter-object)).

**[B — configuration point]** A payload-emitting invocation preserves every admissible effective `consumes` alternative: exactly one usable concrete candidate — one not excluded by this specification's confinement rules — selects itself; every other effective set, including two or more usable candidates, a range-only candidate, or a concrete candidate alongside a usable range, requires one concrete `requestMedia` choice before input consumption; the choice MUST match under §9.1 and never substitutes another lane's schema or form rules, and supplied values never elect.

**[B — exclusion]** A supplied body Parameter with an empty effective `consumes` set refuses only that body lane because OAS supplies no body-media default; the exclusion reopens only if incorporated OAS 2.0 authority defines such a default.

**[B — configuration point]** A missing required media choice, unmatched or ambiguous choice, unsupported selected lane, or form selection inconsistent with effective `formData` refuses before dispatch; no body bytes or examples are sniffed to select a lane.

**[A]** Examples illustrate values ([OAS 2.0 Example Object](https://spec.openapis.org/oas/v2.0.html#example-object)).

**[B — limit]** Examples create no operation input or output member and never select a declaration, carriage lane, or media type.

**[B — exclusion]** A supplied body or `formData` payload on GET, HEAD, DELETE, or OPTIONS is excluded at that request lane because the incorporated HTTP authority assigns no portable payload semantics for those method cells; the operation remains usable without an optional payload. The exclusion reopens only if incorporated authority defines the cell ([RFC 7231 §§4.3.1–4.3.2, 4.3.5, 4.3.7](https://www.rfc-editor.org/rfc/rfc7231#section-4.3.1)).

### 9.2 Common carriage lanes

**[B — pin]** An exact `application/json` or `+json` selection serializes a request value as strict RFC 8259 JSON and parses a response as strict RFC 8259 JSON; JSON text uses UTF-8, and a typeless resolved declaration preserves the four-byte body `null` as supplied data distinct from no payload ([OAS 2.0 Format and Schema Object](https://spec.openapis.org/oas/v2.0.html#schema-object), [RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)).

**[B — convention]** `text/json` is not a member of that JSON lane; as `text/*`, it can use the character-data lane only when the resolved governing declaration admits `string` as its sole non-null type. This convention reopens under a new identifier only if the IANA media-type registry registers `text/json` with JSON semantics.

**[B — convention]** A concrete character-data selection whose resolved governing declaration admits `string` as its sole non-null type carries the supplied string under its declared `charset`, defaulting to UTF-8; the closed character-data set is `text/*`, `application/xml`, and `+xml`, while JSON media are claimed by the JSON lane. The binding does not consult the live media-type registry's `Encoding considerations`: `application/json` is registered as binary, `text/csv` records no value, and a live lookup would violate this pinned, immutable reading ([RFC 6838 §4.2.1](https://www.rfc-editor.org/rfc/rfc6838#section-4.2.1), [RFC 2046 §4.1](https://www.rfc-editor.org/rfc/rfc2046#section-4.1), [RFC 7303 §§3, 9](https://www.rfc-editor.org/rfc/rfc7303#section-3)).

**[B — convention]** The charset parameter is the only character-encoding source this lane consults; consulting a BOM or XML declaration would require inspecting body bytes, which this binding never sniffs, so a charset-less non-UTF-8 XML response refuses rather than being sniffed, and every unsupported or invalid character decoding likewise refuses.

**[B — limit]** UTF-8 decoding MUST be supported; any further charset is an implementation capability whose absence refuses loudly.

**[A]** A resolved declaration that admits `string` as its sole non-null type with `format: byte` carries the caller's Base64-character string as artifact data and does not trigger the OpenBindings raw-octet boundary; it is never double-decoded ([OAS 2.0 Data Types](https://spec.openapis.org/oas/v2.0.html#data-types)).

**[A]** A resolved body or response declaration that admits `string` as its sole non-null type with `format: binary`, and a response root or `formData` Parameter of `type: file`, denotes exact octets ([OAS 2.0 Data Types, Parameter Object, and Response Object](https://spec.openapis.org/oas/v2.0.html#data-types)).

**[B — pin]** Every OpenBindings raw-octet value is a JSON string containing canonical RFC 4648 §4 Base64: standard alphabet, required padding, no ignored non-alphabet characters, and zero unused pad bits; requests decode before dispatch and responses encode the exact octets ([RFC 4648 §§3.3, 3.5, 4](https://www.rfc-editor.org/rfc/rfc4648)).

**[B — exclusion]** This specification does not generate XML from an object model because the finite XML Object annotations do not determine ordering, escaping, nulls, dynamic keys, or scalar lexical forms; the selected XML media lane is excluded at its smallest owner unless incorporated authority defines those bytes, while string and raw-octet XML carriage remain admitted ([OAS 2.0 XML Object](https://spec.openapis.org/oas/v2.0.html#xml-object)).

**[B — exclusion]** A selected non-JSON lane admitted by none of the character-data, artifact-encoded `byte`, raw-octet, string XML, or §8.3 form lanes is excluded at its smallest media owner because OAS supplies no value-to-bytes mapping; the exclusion reopens only if incorporated authority defines that media/data-form cell.

**[C]** Invoking this binding does not trigger validation of any application value against its governing Schema Object; only a tool that separately claims validation owes Core's validation rules (Core [invariant 2](../../openbindings.md#2-core-invariants), [OBI-T-16](../../openbindings.md#103-tool-rules)).

### 9.3 HTTP content codings

**[A]** HTTP `Content-Encoding` is distinct from media type; request codings apply in listed wire order and response codings decode in reverse order before the selected media lane ([RFC 9110 §8.4](https://www.rfc-editor.org/rfc/rfc9110#section-8.4)).

**[A]** The artifact declaration surfaces are an effective request header Parameter named `Content-Encoding` and a governing response Header Object of that name; field-name comparison is ASCII case-insensitive ([OAS 2.0 Parameter, Response, and Header Objects](https://spec.openapis.org/oas/v2.0.html#header-object), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[B — configuration point]** `requestContentCodings` and `responseContentCodings` are finite consumer maps from case-insensitive content-coding tokens to deterministic encoders and decoders; the artifact-declared field value fixes the ordered stack, and no configuration preference narrows its declared alternatives.

**[B — configuration point]** An unsupported token, a field value not admitted by its governing declaration, an ambiguous coding declaration, or an actual response coding with no governing Header Object refuses rather than being skipped or sniffed; configuring a codec supplies capability but never declares a coding the artifact omitted.

### 9.4 Response declaration, classification, and decoding

**[A]** Every Operation requires a Responses Object, and that object contains at least one exact status or `default` Response ([OAS 2.0 Operation and Responses Objects](https://spec.openapis.org/oas/v2.0.html#responses-object)).

**[B — exclusion]** Omitting the required Responses Object or providing one with no exact status or `default` Response is a declaration defect that excludes the selected operation under §3.2's smallest-owner rule. The exclusion reopens only if an incorporated OAS 2.0 authority admits the exact declaration.

**[A]** A Responses Object is closed to exact HTTP status-code keys, `default`, and specification extensions, with no range-key form ([OAS 2.0 Responses Object](https://spec.openapis.org/oas/v2.0.html#responses-object)).

**[B — exclusion]** A Responses key outside that closed admitted set is a declaration defect that excludes the selected target before any actual response is inspected; the exclusion reopens only if an incorporated OAS 2.0 authority admits that exact key form.

**[B — convention]** The governing Response Object lookup order is exact status, then `default`; declarations never reclassify the native status.

**[A]** RFC 9110 defines the 2xx class as successful ([RFC 9110 §15.3](https://www.rfc-editor.org/rfc/rfc9110#section-15.3)).

**[B — convention]** For this binding, success means that the final status—the status after any interim responses and any redirects the runtime chose to follow—is in that 2xx class.

**[B — convention]** Redirect following is runtime policy. A redirect followed with the bound method and complete body preserved remains this interaction; a method-rewriting redirect is a final response of this interaction ([RFC 9110 §15.4](https://www.rfc-editor.org/rfc/rfc9110#section-15.4)).

**[B — limit]** Outcome classification depends on the final status, while redirect following and transport content negotiation, including a runtime-advertised `Accept-Encoding`, are runtime policy under Core §1.2. Two conformant runtimes MAY therefore classify one wire history differently, and that redirect/negotiation variance is the stated permitted set; the binding itself emits no negotiation field beyond those this specification pins (Core [§1.2](../../openbindings.md#12-out-of-scope)).

**[A]** A governing Response Object without `schema` declares that no response content is returned ([OAS 2.0 Response Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-9)).

**[A]** A response Header Object has no `required` field; the required-response-header question is therefore inapplicable ([OAS 2.0 Header Object](https://spec.openapis.org/oas/v2.0.html#header-object)).

**[B — limit]** An actual nonempty body governed by a Response Object without `schema` refuses as a protocol error.

**[A]** Effective `produces` describes the MIME types an operation can produce: the Operation list replaces the root list, including an empty list that clears it ([OAS 2.0 Swagger, Operation, and Response Objects](https://spec.openapis.org/oas/v2.0.html#response-object)).

**[B — convention]** A nonempty response with a governing schema selects its concrete media type from `Content-Type`, which MUST match the effective `produces` set under §9.1 before the schema's carriage lane decodes it.

**[B — convention]** When a nonempty response omits `Content-Type`, the binding takes RFC 9110's permitted `application/octet-stream` assumption before ordinary matching; the resulting type still MUST match an effective `produces` declaration ([RFC 9110 §8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3)).

**[B — convention]** An unmatched, ambiguous, normalized-colliding, or absent effective response media declaration is a loud protocol error; no bytes are sniffed and no undeclared fallback is invented.

**[B — convention]** An **empty response** has zero content octets after transfer decoding; a response to HEAD is empty by definition.

**[B — convention]** Empty responses emit no output value; successful non-empty responses emit the selected lane's one application value, while failure bodies use the same lanes and remain opaque application-authored failure data.

**[B — limit]** A non-empty response with no governing exact or `default` Response Object is a loud protocol error.

**[B — limit]** This specification defines no response-header carriage in an operation value, so Response Header Objects create no output members under this identifier; consequently, even a declared `Location` header on a `201` response has no output representation ([OAS 2.0 Response and Header Objects](https://spec.openapis.org/oas/v2.0.html#response-object)).

**[B — limit]** One HTTP response body produces at most one operation value: OAS 2.0 defines the response schema as the complete body and supplies no construct that frames it into multiple application values ([OAS 2.0 Response Object](https://spec.openapis.org/oas/v2.0.html#response-object)).

## 10. Target URL

**[A]** The target is the effective scheme plus `://`, effective `host`, effective `basePath`, and the exact Paths key: Operation `schemes` replaces root `schemes`; absent root schemes use the document-retrieval scheme; absent `host` uses the host serving the document; and absent `basePath` means `/` ([OAS 2.0 Swagger, Operation, and Paths Objects](https://spec.openapis.org/oas/v2.0.html#fixed-fields)).

**[A]** An absent `host` inherits both the host and port from the document-retrieval URI; omitting the retrieval port would not preserve the authority that serves the document ([OAS 2.0 Swagger Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields)).

**[B — configuration point]** One effective `http` or `https` scheme selects itself; multiple usable schemes require one consumer `server` choice before dispatch, and no list-order preference is inferred.

**[B — limit]** When an omitted scheme inherits a document-retrieval scheme outside `http`, `https`, `ws`, or `wss`, the target is unusable and refuses before dispatch.

**[B — limit]** An empty effective scheme list, or an omitted scheme or host without a document location from which its default can be obtained, leaves the target unresolved and refuses before dispatch; a complete configured URL below remains the available recovery.

**[B — exclusion]** An effective `ws` or `wss` scheme is unusable under this identifier because OAS 2.0 defines only the target URI scheme and supplies no handshake, subprotocol, direction, message, framing, or close correspondence. The exclusion reopens only if incorporated authority defines those semantics ([OAS 2.0 Swagger and Operation Objects](https://spec.openapis.org/oas/v2.0.html#fixed-fields-4)).

**[A]** `host` contains neither scheme nor sub-path, `basePath` begins with `/`, and each Paths key begins with `/` and is appended to `basePath` ([OAS 2.0 Swagger and Paths Objects](https://spec.openapis.org/oas/v2.0.html#paths-object)).

**[B — convention]** Target construction performs no slash normalization, path repair, dot-segment rewrite, query merge, or second relative-reference resolution; exact base-path and Paths-key bytes are concatenated before Parameter assembly.

**[B — convention]** After path and query serialization, the completed target MUST parse and percent-decode under RFC 3986; an unusable target refuses before dispatch ([RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)).

**[B — configuration point]** The `server` configuration point MAY supply a complete consumer-configured URL that replaces the resolved scheme, authority, and base path; the artifact's path template, path substitution, query construction, method, Parameters, payload, response, and security semantics remain unchanged.

## 11. Security and channel assembly

**[A]** Operation `security` replaces root `security`; `[]` clears the root requirement, array members are OR alternatives, and every named member of one Security Requirement Object is required as an AND ([OAS 2.0 Swagger, Operation, and Security Requirement Objects](https://spec.openapis.org/oas/v2.0.html#security-requirement-object)).

**[B — convention]** `{}` is a vacuously satisfiable empty AND and therefore a complete anonymous alternative; this is this specification's reading of OAS's stated AND semantics, not an assertion that OAS assigns separate prose to the empty object.

**[B — configuration point]** The binding preserves every complete alternative and invents no anonymous-versus-credentialed preference. The named configuration point `security` selects one complete alternative: a sole declared alternative selects itself, and an effective empty `[]` or anonymous optional-security alternative counts as a complete no-security alternative; multiple alternatives require an explicit choice, fragments from different alternatives are never combined, and an invocation with no selection where one is required refuses before dispatch.

**[A]** Only root `securityDefinitions` names schemes, and a Security Requirement activates a named definition ([OAS 2.0 Security Definitions and Security Requirement Objects](https://spec.openapis.org/oas/v2.0.html#security-definitions-object)).

**[B — limit]** An unknown security-scheme name makes only that requirement alternative unusable rather than activating an extension or similarly named declaration.

**[A]** A Security Scheme has exactly type `basic`, `apiKey`, or `oauth2`; an API key uses its declared `query` or `header` name, and OAuth2 uses exactly the `implicit`, `password`, `application`, or `accessCode` flow with its required authorization/token URLs and declared scopes ([OAS 2.0 Security Scheme Object](https://spec.openapis.org/oas/v2.0.html#security-scheme-object)).

**[A]** An OAuth2 Security Requirement array contains every scope required for execution, while the array for a `basic` or `apiKey` requirement MUST be empty ([OAS 2.0 Security Requirement Object](https://spec.openapis.org/oas/v2.0.html#security-requirement-object)).

**[B — limit]** A nonempty requirement array for `basic` or `apiKey` makes only that security alternative unusable; the defect is confined and reported loudly, and another complete alternative may still be selected. An OAuth2 alternative is complete only when runtime credential context satisfies every required scope.

**[B — pin]** A selected `basic` scheme consumes a runtime-supplied user-id and password and constructs `Authorization: Basic base64(user-id ":" password)` under [RFC 7617 §2](https://www.rfc-editor.org/rfc/rfc7617#section-2), including its user-id, password, character-encoding, and Base64 constraints.

**[B — pin]** A selected `apiKey` scheme consumes a runtime-supplied key value and emits it at the declaration's exact query or header destination.

**[B — pin]** A selected OAuth2 scheme consumes a runtime-supplied access token satisfying the artifact's required scopes and uses the `Bearer` authorization scheme under [RFC 6750 §2.1](https://www.rfc-editor.org/rfc/rfc6750#section-2.1); token acquisition and every non-Bearer token type have no wire carriage under this identifier.

**[B — convention]** Credentials and credential-acquisition state MUST NOT be embedded in an OBI document.

**[B — convention]** A credential destination that collides with an effective Parameter, another credential in the same AND requirement, or binding/processor-owned `Host`, `Content-Length`, or `Content-Type` makes only the selected security alternative unusable; another complete non-colliding alternative may still be selected. `Accept` is an ordinary effective Parameter destination and collides under that ordinary Parameter rule.

**[B — convention]** Header destinations compare ASCII case-insensitively, query destinations compare exact names, and an API-key query value uses §8.2's query percent-encoding; credential values never enter the caller envelope or operation contract ([RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

## 12. Configuration, synthesis, and conformance

### 12.1 Configuration vocabulary

**[B — configuration point]** The complete binding-specific configuration vocabulary is `requestMedia` (one concrete media type), `server` (one effective scheme plus the artifact's effective `host`/`basePath` target, or one complete consumer-configured URL replacing the selected target), `security` (selection of one complete security alternative), `parameterConversion` (deterministic non-string-scalar converter), `emptyValueForm` (`name-only` or `empty`), `requestContentCodings` (coding-to-encoder map), `responseContentCodings` (coding-to-decoder map), and conditional `propertyMedia` (one concrete media type for the multipart part of each present `file` form Parameter).

**[B — configuration point]** Every requirement is typed, discoverable from declarations, and preflightable; no configuration member appears in the caller envelope or operation contract, and decoding and response classification are fixed rules rather than configuration points.

### 12.2 Synthesis boundary and coverage

**[C]** Operation contracts remain protocol-neutral (Core [§5.1](../../openbindings.md#51-operations), [invariant 1](../../openbindings.md#2-core-invariants)) and MAY remain flat (Core [§5.5](../../openbindings.md#55-transforms)).

**[B — convention]** Synthesis emits an `inputTransform` that constructs §7's envelope, and transforms never route values to HTTP locations.

**[B — convention]** This binding defines no status, header, selected-media, or other context bindings at `inputTransform` or `outputTransform` positions; evaluation uses Core's closed environment unaugmented (Core [§5.5 clause 5](../../openbindings.md#55-transforms), [OBI-T-10](../../openbindings.md#103-tool-rules)).

**[B — limit]** §12.2 licenses the §7 envelope as the operation input shape, `inputTransform` and `outputTransform` as synthesis outputs, and operation/dependency key spelling, flattening, output-schema choice, and Schema Object translation as synthesis policy; no other input-restructuring apparatus exists under this identifier.

**[A]** OAS 2.0's closed object inventory contains no callback or webhook declaration, so this sibling synthesizes no inbound dependency surface from the artifact ([OAS 2.0 §6.4](https://spec.openapis.org/oas/v2.0.html#specification)).

**[B — convention]** A synthesizer MUST account for every addressable operation as represented, excluded with the exact reason stated beside the applicable exclusion, or unsupported; a failure in an unused description position is coverage loss rather than invocation behavior.

**[B — convention]** Every binding-specific configuration requirement remains in coverage accounting and invocation context, assigned to its represented target or declared alternative, and MUST NOT enter the operation input schema.

### 12.3 Conformance rules

**[B — convention]** A document conforms to **OAPI20-D-01** when its `content`, if present, satisfies §§3–5 and its `location`, if present, satisfies §4.

**[B — convention]** A binding conforms to **OAPI20-D-02** when it names `openbindings.openapi-2.0@1`, carries the literal selector of §6, and identifies a source that passes the `swagger` load gate.

**[B — convention]** A processor conforms to **OAPI20-P-01** when it implements the closed load gates, smallest-owner confinement, reference closure, Schema Object dialect, and selector semantics of §§3–6.

**[B — convention]** A processor conforms to **OAPI20-P-02** when it accepts only §7's envelope, applies §8's effective-Parameter, collision, conversion, collection, location, empty, and form rules, and refuses every unknown or unroutable input before dispatch.

**[B — convention]** A processor conforms to **OAPI20-P-03** when it preserves media alternatives and applies §9's matching, request election, carriage, content-coding, response lookup, classification, and unary-boundary rules without sniffing or undeclared fallback.

**[B — convention]** A processor conforms to **OAPI20-P-04** when it resolves complete target URLs under §10 and security alternatives, credentials, scopes, and channel collisions under §11.

**[B — convention]** A synthesizer conforms to **OAPI20-S-01** when it preserves §12.2's binding/transform boundary, emits no artifact-derived inbound dependency, preserves or accounts for every Schema Object assertion, and reports complete operation coverage under Core OBI-B-02.

**[B — exclusion]** Every exclusion in this document is permanent under `openbindings.openapi-2.0@1`, belongs to the smallest owner stated beside it, and reopens only on its stated incorporated-authority trigger; no exclusion promises later work.

## 13. Normative references

- [OpenAPI Specification 2.0](https://spec.openapis.org/oas/v2.0.html)
- [YAML 1.2, 1 October 2009](https://yaml.org/spec/1.2-old/spec.html)
- [YAML 1.2.2](https://yaml.org/spec/1.2.2/)
- [HTML 4.01 §17.13.4](https://www.w3.org/TR/html401/interact/forms.html#h-17.13.4)
- [JSON Reference draft-03](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03)
- [JSON Schema Core draft-04](https://tools.ietf.org/html/draft-zyp-json-schema-04)
- [JSON Schema Validation draft-04](https://tools.ietf.org/html/draft-fge-json-schema-validation-00)
- [RFC 2046](https://www.rfc-editor.org/rfc/rfc2046)
- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119)
- [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339)
- [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)
- [RFC 4648](https://www.rfc-editor.org/rfc/rfc4648)
- [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750)
- [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838)
- [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)
- [RFC 7159](https://www.rfc-editor.org/rfc/rfc7159)
- [RFC 7231](https://www.rfc-editor.org/rfc/rfc7231)
- [RFC 7303](https://www.rfc-editor.org/rfc/rfc7303)
- [RFC 7617](https://www.rfc-editor.org/rfc/rfc7617)
- [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)
- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)
