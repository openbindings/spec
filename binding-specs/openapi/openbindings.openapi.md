# `openbindings.openapi` Binding Specification

## 1. Status and identifier

This document is the normative text for the binding specification identifier **`openbindings.openapi@1`**, published by the openbindings project as its defining authority. The identifier is exact and opaque per core [OBI-B-01](../../openbindings.md#104-binding-specification-rules): no range or normalization semantics attach to it. An incompatible change to this specification publishes `openbindings.openapi@2` ([OBI-B-03](../../openbindings.md#104-binding-specification-rules)); compatible clarification may revise this document in place. It publishes with the OpenBindings core 0.2.0 change set, and reference tooling adopts the identifier — replacing the pre-bindingSpec `openapi@…` tokens — in the same coordinated change.

The key words "MUST", "MUST NOT", "REQUIRED", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in all capitals.

## 2. Scope and incorporated authorities

This is the **openbindings project's** binding specification for [OpenAPI](https://spec.openapis.org/) documents. It is published under this project's authority, not by or for the OpenAPI Initiative: the OpenAPI Specification (OAS) is incorporated by reference and remains authoritative over the artifact and the HTTP mechanics it describes — document structure and reference resolution, parameter locations and serialization, request/response media declarations and encodings, server objects and variables, security scheme declarations, and everything else the artifact says about the wire. Plain HTTP semantics are [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)'s; the `text/event-stream` framing is the [WHATWG HTML server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html) processing model's. This specification defines only the OpenBindings overlay: how a source carries or addresses an OpenAPI document, how a binding selects an operation, and how caller-facing operation values correspond to an HTTP exchange.

OpenAPI artifacts are substantially complete for invocation — routing, media types, and status declarations are native — so this specification's configuration points ([§9.3](#93-servers-and-the-target-url), [§9.4](#94-configuration-points)) are fewer and narrower than an incomplete family's (compare [`openbindings.usage@1`](../usage/openbindings.usage.md)).

## 3. Accepted source representations

This specification accepts **OpenAPI documents of the 3.0.x and 3.1.x lines**, in two carried representations:

- **Object** `content`: the parsed OpenAPI document as a JSON object.
- **String** `content`: the document's source text. This specification pins the string grammar — its own pin, not an OAS mandate: string content parses as **YAML 1.2** under the OAS's JSON-compatibility recommendations, of which JSON is a valid subset, so one grammar covers both spellings deterministically. Duplicate mapping keys are refused loudly.

Discrimination between the accepted lines is the artifact's own **`openapi` field**: `3.0.*` and `3.1.*` are accepted and interpreted under their respective OAS editions, both governed by this one identifier; any other value (including Swagger 2.0's `swagger` field) is refused loudly at load (**OAPI-P-01**). No other representation is defined; there is no non-textual artifact form.

## 4. `location`

A source's `location`, when present, is an **absolute URI addressing the OpenAPI document itself** (**OAPI-D-02**) — `https://example.com/openapi.json`, `file:///srv/api/openapi.yaml`. Dereferencing it yields an accepted representation ([§3](#3-accepted-source-representations)). A bare filesystem path is a relative reference in form and is not a conformant `location` (core [OBI-D-05](../../openbindings.md#102-document-rules)).

## 5. `content`

A source's `content`, when present, MUST be one of the two accepted representations of [§3](#3-accepted-source-representations): the parsed document object, or its source text as a string (**OAPI-D-01**). No other JSON type is an accepted `content` value under this specification.

## 6. Composition

When `content` is present it is the artifact the processor interprets, per the core's content-primacy floor ([§5.4](../../openbindings.md#54-sources)).

A co-present `location` is the document's origin, and it serves as the embedded artifact's **base URI**: references internal to the embedded document (relative `$ref`s, relative server URLs) resolve against it per the OAS's own reference-resolution rules, exactly as they would had the document been retrieved from that address. The base travels in the OBI, so resolution is identical everywhere the OBI goes; the OBI's own retrieval URI is never a base (core [§7](../../openbindings.md#7-reference-resolution)). Embedded content with **no** co-present `location` has no base and MUST be self-contained: every internal reference resolves without one (bundle before embedding).

Self-containment is RECOMMENDED even when a `location` is present: a document whose embedded artifact leans on its base for `$ref` resolution requires that address to be reachable to interpret, which reintroduces the network dependence embedding exists to remove.

For a `location`-only source, the document's base URI is the `location`, per the OAS.

## 7. `ref`

A binding's `ref` is REQUIRED — the OAS defines no whole-artifact invocation — and MUST be a JSON Pointer of the form `#/paths/<escaped-path>/<method>`, addressing an **operation object**: the path segment carries [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) escaping (`/` → `~1`), and `<method>` is one of the OAS's HTTP method keys, **lowercase exactly as the artifact spells them** (**OAPI-D-03**). `#/paths/~1tasks/post` addresses the POST operation on `/tasks`.

The pointer is a **verbatim string**. Its `#/` shape is JSON Pointer notation, not an invitation to URI processing: no percent-decoding is ever applied, at authoring or at resolution. Each addressable operation has exactly one conformant spelling — the RFC 6901-escaped form above — and a `ref` matches it byte-for-byte, extending the core specification's literal-form doctrine (core [§7](../../openbindings.md#7-reference-resolution)) to this family's selector. A percent-encoded rendering of that spelling (`#/paths/~1users~1%7BuserId%7D/get` for `#/paths/~1users~1{userId}/get`) is not the spelling and denotes nothing.

Pointer evaluation follows **OAS reference resolution**, not raw JSON traversal: a path item that is a `$ref` (including a 3.1 `components.pathItems` target) is resolved before the method segment evaluates, so bundled artifacts using path-item references stay addressable. A well-formed `ref` whose path or method is absent from the resolved artifact makes the binding unresolvable; verification requires the artifact, per the core's partial-verification posture.

Only `paths` operations are addressable. **Webhooks and callbacks are excluded** from revision 1: they describe inbound calls the service makes to the consumer, an interaction this revision does not bind. The exclusion is a definition, not an open item.

## 8. Target and interaction

The binding target is the addressed operation, invoked as **one HTTP exchange per invocation** against the resolved server ([§9.3](#93-servers-and-the-target-url)).

**Success responses**, for this specification, are the operation's response entries keyed by a 2xx status literal or the `2XX` range; the `default` entry never participates in shape or media determination.

The interaction shape is bounded by declaration and selected by framing (**OAPI-P-06**):

- An operation is **streaming-capable** iff `text/event-stream` appears among the declared media types of its success responses. Capability is static: a consumer knows from the artifact alone whether streaming can occur.
- For a streaming-capable operation, the response's `Content-Type` header — framing, the same lane-decider as the decode rule, never payload bytes — selects among the **declared** shapes: `text/event-stream` yields a **server-streaming** interaction; any other declared success media type yields a **unary** interaction.
- For an operation that is not streaming-capable, the interaction is unary, and a `text/event-stream` response contradicts the declaration: a protocol error, not a reclassification.

A **unary** interaction carries one input value and one output value. A **server-streaming** interaction carries one input value; each received SSE event emits one output value per the WHATWG processing model: the event's `data` lines joined with U+000A form the event's text, comment-only and empty-`data` events emit no value, and the `event`, `id`, and `retry` fields **never enter the output value** — whether an implementation surfaces them out of band is its own concern. Stream end completes the interaction; abnormal termination — transport failure before stream end — is a failure outcome, and output values already emitted **stand**. NDJSON and other streaming framings are excluded from revision 1.

## 9. Operation-boundary correspondence

### 9.1. Input mapping — the flattened model

The caller-facing input value is one JSON object (or absent). It is the **flattened view** of the operation's declared surface: parameters from every location and the request body merged into one object. Fields map by name (**OAPI-P-03**):

- The declared parameter set is the merge of path-level and operation-level `parameters`, operation-level winning on same name-and-location collision (per the OAS).
- `path` parameters substitute into the URL template; `query` parameters join the query string; `header` parameters ride as request headers; `cookie` parameters join the `Cookie` header ([§9.6](#96-security-declarations-credentials-and-channel-assembly) defines channel assembly).
- **Serialization follows the OAS's `style`/`explode`/`allowReserved` rules, incorporated wholesale** — including their per-location defaults and their array and object expansions (**OAPI-P-02**). A `content`-form parameter (schema-less, per the OAS's parameter `content` map) serializes its value per its declared media type and rides its location as that serialized string. This specification adds no serialization of its own.
- Two declared parameters sharing one name across **different locations** (legal per the OAS's name-plus-location identity) cannot be represented by the flatten: such an operation is refused loudly at binding resolution as unflattenable.
- A field that is both a declared parameter and a declared body property is **one name, one value, delivered to every declared wire location** — it rides the parameter location AND stays in the body; the merge is never silent (processors surface it as a diagnostic).
- A field matching no declared parameter or body property **passes through into the body** when the operation declares a request body, and is **refused before dispatch** — loudly, never silently dropped — when it declares none. No schema evaluation participates in this routing; enforcing the body schema is the server's business.
- A non-object request body schema (array or scalar) is represented in the flattened contract under the synthetic **`body`** property; at the wire, that property's value **is** the request body, unwrapped.

**Required declarations.** An invocation supplying **no input value** while the operation declares any required parameter or a required request body is refused before dispatch. A **supplied** input object missing required members is sent as-is — the server's declared validation is the authority — with one exception: a missing declared **path** parameter always refuses before dispatch, because the URL cannot be built without it.

**The remaining body.** When a JSON-family request body is selected and every input field was consumed by parameters, the body is `{}` if the artifact declares the request body required, and omitted otherwise.

### 9.2. Request and response media

Media-type matching throughout this section compares type and subtype, ignoring parameters (`application/json; charset=utf-8` matches `application/json`); media ranges (`*/*`, `application/*`) never participate in selection.

The request's media type is selected from the operation's **declared** `requestBody.content`, in preference order (**OAPI-P-04**): exact `application/json`, then the lexicographically least `+json` type, then `multipart/form-data`, then `application/x-www-form-urlencoded` (fields serialize per the OAS's `encoding` rules), then `text/plain` when the body value is a string. Two refusals are pre-dispatch and loud: an operation declaring only media types outside these families (a raw binary request body, for instance — its request carriage is undefined in revision 1), and a selection whose condition fails (`text/plain` selected with a non-string body value). Non-JSON *response* bodies are not excluded; they decode through the text lane of [§9.4](#94-configuration-points).

**Multipart parts.** A part is binary-signaled per the artifact's edition: 3.0.x by `format: binary`, 3.1.x by a string schema carrying `contentMediaType`/`contentEncoding`, per the OAS. A binary-signaled part's bytes come from the caller's string value: decoded per the schema's declared `contentEncoding` where one is declared, and by **Base64** where the artifact signals binary without declaring an encoding — this specification's boundary encoding for bytes, since the operation value domain is JSON (core [§5](../../openbindings.md#5-document-model)). Parts that are not binary-signaled serialize per the artifact's `encoding` object where present, else per the OAS's per-type part defaults. Nothing here is decided by the value's bytes; the artifact's declarations decide.

The request `Accept` header advertises the declared **concrete** media types of the operation's success responses ([§8](#8-target-and-interaction)); absent any declaration, `application/json`. The membership of that set is normative; its ordering and parameters are not.

### 9.3. Servers and the target URL

The target URL is the resolved server joined with the operation's path template. Server resolution is a **named configuration point** (**OAPI-P-05**), consulted per [§9.4](#94-configuration-points)'s order:

- The **effective server list** is the OAS's: the operation's `servers`, else the path item's, else the document's, else the OAS-defined implied server of `url: "/"`.
- The default — this specification's own choice, not an OAS rule — selects the effective list's **first entry**, with each server variable substituted by its declared default.
- Consumer configuration may instead select another entry of the effective list, supply server-variable values, or supply a complete base URL outright.

A relative effective-server URL (the implied `/` included) resolves against the artifact's base URI ([§6](#6-composition)) per RFC 3986. The one pre-dispatch refusal is a server URL that cannot resolve to an absolute URL — the implied `/` with no base URI, for instance.

### 9.4. Configuration points

This family has **three** named configuration points — server resolution ([§9.3](#93-servers-and-the-target-url)) and the two wire-question points below. At each, consultation order is per-invocation configuration → consumer-level configuration → the default, and a declined override falls through. All defaults are content-independent: decided by declarations and framing, never payload bytes.

| Point | Default | Meaning |
| --- | --- | --- |
| **decode** | **the header rule** (**OAPI-P-07**) | The response's `Content-Type` header decides. `application/json` and `+json` types parse as strict JSON — a declared-JSON body that fails to parse is a loud error, never a silent string. Every other type, including an absent header, is the **text lane**: bytes become a string per the header's `charset` parameter, defaulting to UTF-8, and invalid sequences are a loud decode error (a consumer needing raw or non-text bytes overrides at this point; revision 1 defines no base64 response lane). An empty body (204 included) yields `null`. For a server-streaming interaction the point applies **per event**, to the event's U+000A-joined data text ([§8](#8-target-and-interaction)); the per-event default is that text itself — SSE events carry no per-event framing to decide otherwise, so JSON-emitting endpoints decode via consumer configuration at this point. |
| **classify** | **the 2xx rule** (**OAPI-P-08**) | Success **iff** the final status ∈ 2xx. Declared `responses` refine what a failure *means*, never whether it is one — a declared 404 documents a failure's shape, it does not bless the failure. Implementations SHOULD follow redirects per ordinary HTTP client norms (limits and policy are theirs); classification applies to the **final** status, and a surviving 3xx is not a success. |

Field routing is not a configuration point in this family: the artifact answers routing ([§9.1](#91-input-mapping--the-flattened-model)).

### 9.5. Success and the output value

Which outcomes are successes is decided by the **classify** point; for a successful outcome, the operation's output value (or each streamed output value) is the product of the **decode** point. Response headers have **no representation in the output value** in revision 1 — a declared exclusion. Failure outcomes are not operation results and have no representation in this specification; what a consumer surfaces about them — and any error-code vocabulary — is its own concern, outside this document.

### 9.6. Security declarations, credentials, and channel assembly

Security metadata is never extracted into the OBI: the artifact's declarations are read at invocation time. The declaration semantics are the OAS's, incorporated: the operation's `security` **replaces** the document's entirely (an explicit `[]` means anonymous), requirements are an OR of ANDed schemes, and each scheme's definition lives in `components.securitySchemes`.

What this specification pins is **wire application** (**OAPI-P-09**): an `apiKey` scheme's credential rides its declared `in`/`name` (header, query, or cookie); `http` schemes with values `basic` and `bearer` — matched case-insensitively, per RFC 9110's auth-scheme rules — ride the `Authorization` header per their RFCs; `oauth2` and `openIdConnect` access tokens ride `Authorization: Bearer`. A scheme, or an `http` scheme value, that this list does not pin (`http`/`digest`, `mutualTLS`, and any future type) is **surfaced to the consumer** rather than silently skipped.

**Channel assembly** (**OAPI-P-10**): declared cookie parameters and cookie-riding credentials merge into the single `Cookie` header — parameters in declaration order, credentials appended after. A name collision between a credential and a caller-supplied field on the same channel (a cookie, header, or query credential whose `name` matches a declared parameter the caller populated) is refused before dispatch — loud, never a silent overwrite in either direction.

How missing credentials are discovered, requested, and resolved is a consumer and runtime concern, not this specification's: the project's [`binding-invoker`](https://openbindings.com/interfaces/binding-invoker) interface defines one such negotiation surface (informative).

### 9.7. Transform positions

This specification defines **no** context bindings at transform positions: a transform on an openapi binding evaluates in the core's closed environment, unaugmented.

## 10. Conformance

Rules carry stable identifiers under the same discipline as the core's: never reused, never renumbered. Source rules bind OBI content governed by this specification; processor rules bind implementations claiming support for `openbindings.openapi@1`. Verification follows the core's partial-verification posture.

- **OAPI-D-01**: `content`, when present, is the parsed OpenAPI document object or its source text as a string, per [§5](#5-content).
- **OAPI-D-02**: `location`, when present, is an absolute URI addressing the OpenAPI document, per [§4](#4-location).
- **OAPI-D-03**: `ref` is present, and is a JSON Pointer `#/paths/<escaped-path>/<lowercase-method>` addressing an operation object under OAS reference resolution, in the pointer's one verbatim spelling — never percent-decoded — per [§7](#7-ref).
- **OAPI-P-01**: Accepted lines, the string-content grammar pin, and loud refusal discriminate per [§3](#3-accepted-source-representations).
- **OAPI-P-02**: Parameter serialization follows the OAS `style`/`explode`/`allowReserved` rules and defaults, with `content`-form parameters serialized per their declared media type, per [§9.1](#91-input-mapping--the-flattened-model).
- **OAPI-P-03**: Input fields map per the flattened model — merge rules, cross-location same-name refusal, collision delivery, evaluation-free body passthrough, pre-dispatch refusal of unmatched fields when no body is declared, required-declaration refusals including the missing-path-parameter case, the remaining-body rule, and synthetic `body` unwrapping — per [§9.1](#91-input-mapping--the-flattened-model).
- **OAPI-P-04**: Request media selection, its deterministic tiebreaks, its pre-dispatch refusals, multipart part encoding including the Base64 boundary encoding for binary-signaled parts, and the `Accept` membership rule follow [§9.2](#92-request-and-response-media).
- **OAPI-P-05**: Server resolution uses the OAS effective server list with this specification's first-entry-plus-variable-defaults default, honors consumer overrides, and refuses pre-dispatch only an unresolvable server URL, per [§9.3](#93-servers-and-the-target-url).
- **OAPI-P-06**: Interaction shape is bounded by declared success-response media (streaming capability is static) and selected by the response's `Content-Type` framing among declared shapes; an undeclared `text/event-stream` response is a protocol error; SSE events are extracted per the WHATWG processing model, per [§8](#8-target-and-interaction).
- **OAPI-P-07**: The decode configuration point defaults to the header rule, including the defined text lane and the per-event text default for streams, per [§9.4](#94-configuration-points).
- **OAPI-P-08**: The classify configuration point defaults to the 2xx rule, applied to the final status, per [§9.4](#94-configuration-points).
- **OAPI-P-09**: Credentials apply to the wire per scheme as [§9.6](#96-security-declarations-credentials-and-channel-assembly) pins; unpinned schemes are surfaced, never silently skipped; security metadata is never written into OBI documents.
- **OAPI-P-10**: Channel assembly merges parameters and credentials deterministically and refuses credential/field name collisions before dispatch, per [§9.6](#96-security-declarations-credentials-and-channel-assembly).

Conformance fixtures keyed to these identifiers are published with the project's conformance corpus. Deterministic *generation* of OBI documents from OpenAPI artifacts (operation-key derivation, output-schema selection, schema translation) is a synthesis concern outside this specification; the project's interface-synthesizer and reference-tool documentation record those conventions.

## 11. References

- **[OAS]** OpenAPI Initiative, "OpenAPI Specification," versions 3.0.x and 3.1.x. <https://spec.openapis.org/>. Incorporated authority for the artifact and its HTTP mechanics ([§2](#2-scope-and-incorporated-authorities)).
- **[RFC 9110]** "HTTP Semantics." <https://www.rfc-editor.org/rfc/rfc9110>
- **[SSE]** WHATWG, "HTML Living Standard," §Server-sent events (`text/event-stream`). <https://html.spec.whatwg.org/multipage/server-sent-events.html>. Incorporated authority for stream framing and event extraction ([§8](#8-target-and-interaction)).
- **[RFC 6901]** "JavaScript Object Notation (JSON) Pointer." <https://www.rfc-editor.org/rfc/rfc6901>
- **[RFC 3986]** "Uniform Resource Identifier (URI): Generic Syntax." <https://www.rfc-editor.org/rfc/rfc3986>
- **[OpenBindings]** The OpenBindings core specification, `openbindings.md` in this repository.
- **[BCP 14]** RFC 2119 / RFC 8174 (key words).
- The [catalog README](../README.md) (informative) — completeness doctrine, configuration points, and the recommended defaults this specification makes normative for its identifier.
