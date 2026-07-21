# `openbindings.asyncapi` Binding Specification

## 1. Status and identifier

This document is the normative text for the binding specification identifier **`openbindings.asyncapi@1`**, published by the openbindings project as its defining authority. The identifier is exact and opaque per core [OBI-B-01](../../openbindings.md#104-binding-specification-rules): no range or normalization semantics attach to it. An incompatible change to this specification publishes `openbindings.asyncapi@2` ([OBI-B-03](../../openbindings.md#104-binding-specification-rules)); compatible clarification may revise this document in place. It publishes with the OpenBindings core 0.2.0 change set, and reference tooling adopts the identifier — replacing the pre-bindingSpec `asyncapi@…` tokens — in the same coordinated change.

The key words "MUST", "MUST NOT", "REQUIRED", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in all capitals.

## 2. Scope and incorporated authorities

This is the **openbindings project's** binding specification for [AsyncAPI](https://www.asyncapi.com/docs/reference/specification/v3.0.0) documents. It is published under this project's authority, not by or for the AsyncAPI Initiative: the AsyncAPI Specification is incorporated by reference and remains authoritative over the artifact — document structure and reference resolution, channels, addresses and parameters, operations and their actions, messages and content types, servers and their variables, protocol `bindings` objects, and security scheme declarations. Plain HTTP semantics are [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)'s; WebSocket mechanics are [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455)'s; the `text/event-stream` framing is the [WHATWG server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html) section's, incorporated for **event framing only** ([§8](#8-target-and-interaction)). This specification defines only the OpenBindings overlay: how a source carries or addresses an AsyncAPI document, how a binding selects an operation, and how caller-facing operation values correspond to messages on the wire.

Revision 1 binds the **`http`, `https`, `ws`, and `wss` protocols**. Other AsyncAPI protocols — kafka, mqtt, amqp, and the rest — are **excluded** from revision 1: each is a definition-level exclusion, not an open item, and a future revision may bind them. Resource policy — delivery-unit size caps, subscription buffering bounds, idle timeouts — is consumer and implementation policy, outside this document (with one integrity floor at [§9.4](#94-classification)).

## 3. Accepted source representations

This specification accepts **AsyncAPI documents of the 3.0.x line**, in two carried representations (a later 3.x line is adopted by compatible revision of this document, never sight-unseen):

- **Object** `content`: the parsed AsyncAPI document as a JSON object.
- **String** `content`: the document's source text. This specification pins the string grammar — its own pin: string content parses as **YAML 1.2** under the AsyncAPI specification's JSON-compatibility recommendations — this specification's pin, not an AsyncAPI mandate — of which JSON is a valid subset, so one grammar covers both spellings deterministically. Duplicate mapping keys are refused loudly.

Discrimination is the artifact's own **`asyncapi` field**: `3.0.*` values are accepted; any other value — AsyncAPI 2.x included — is refused loudly at load (**ASYNC-P-01**). No other representation is defined.

## 4. `location`

A source's `location`, when present, is an **absolute URI addressing the AsyncAPI document itself** (**ASYNC-D-02**) — `https://example.com/asyncapi.json`, `file:///srv/api/asyncapi.yaml`. Dereferencing it yields an accepted representation ([§3](#3-accepted-source-representations)). A bare filesystem path is a relative reference in form and is not a conformant `location` (core [OBI-D-05](../../openbindings.md#102-document-rules)). This family is artifact-located: connection targets come from the artifact's `servers`, not from `location`.

## 5. `content`

A source's `content`, when present, MUST be one of the two accepted representations of [§3](#3-accepted-source-representations) (**ASYNC-D-01**). No other JSON type is an accepted `content` value under this specification.

## 6. Composition

When `content` is present it is the artifact the processor interprets, per the core's content-primacy floor ([§5.4](../../openbindings.md#54-sources)).

A co-present `location` is the document's origin, and it serves as the embedded artifact's **base URI**: references internal to the embedded document (relative `$ref`s) resolve against it per the AsyncAPI specification's own reference-resolution rules, exactly as they would had the document been retrieved from that address. The base travels in the OBI, so resolution is identical everywhere; the OBI's own retrieval URI is never a base (core [§7](../../openbindings.md#7-reference-resolution)). Embedded content with **no** co-present `location` has no base and MUST be self-contained (bundle before embedding). Self-containment is RECOMMENDED even with a `location`. For a `location`-only source, the document's base URI is the `location`.

## 7. `ref`

A binding's `ref` is REQUIRED and MUST be a JSON Pointer of the form `#/operations/<operation-key>`, addressing an entry of the artifact's `operations` map (**ASYNC-D-03**) — one spelling; a bare operation key without the pointer prefix is not conformant, and keys containing `/` or `~` carry [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) escaping. That one spelling is **verbatim**: the `#/` prefix is pointer notation, not URI processing — no percent-decoding is ever applied, and a `ref` matches its target byte-for-byte, RFC 6901 escapes included, per the core's literal-form doctrine (core [§7](../../openbindings.md#7-reference-resolution)). A percent-encoded rendering (`#/operations/tasks%2Fcreate` for the key `tasks/create`, whose one spelling is `#/operations/tasks~1create`) is not that spelling and denotes nothing. An entry that is a Reference Object resolves through it before the operation-object test, per the artifact's own reference rules. Only operations are addressable: channels, messages, servers, and the artifact as a whole are not binding targets, and this family defines no whole-artifact invocation. A well-formed `ref` whose operation is absent from the artifact makes the binding unresolvable; verification requires the artifact, per the core's partial-verification posture.

## 8. Target and interaction

**Perspective — pinned.** An AsyncAPI artifact describes the application it documents: `send` declares that the described application sends to the channel, and `receive` that it expects to receive from it — the AsyncAPI specification's own perspective rule. An invocation is the **counterparty**: invoking a `send` operation **subscribes** to what the application sends; invoking a `receive` operation **publishes** what the application expects to receive. This complementary reading is normative for this specification (**ASYNC-P-02**); the artifact is never read as describing the invoker.

The binding target is the addressed operation's channel, reached through a resolved server and expanded address ([§9.2](#92-configuration-points)). The interaction shape is the operation's `action` crossed with the resolved connection's protocol — the resolved server's `protocol`, or the scheme of a consumer-supplied connection URL — statically decidable:

| `action` × protocol | Interaction |
| --- | --- |
| `receive` × http/https | **Unary publish**: exactly one input value, dispatched as the message with the request method the artifact's http operation binding declares, else POST; at most one output value — a non-empty response body decodes to one output, an empty body (202/204 acknowledgments included) yields none: an acknowledgment is not a message and emits no value |
| `receive` × ws/wss | **Client-streaming publish**: one input value per message frame, the caller closes input; zero output values — frames the server sends during the exchange are **discarded**, a defined disposal |
| `send` × http/https | **Server-streaming subscription** over `text/event-stream` — the subscription framing is **this specification's own pin**, not an artifact claim: the request is a GET (unless the http operation binding declares otherwise) and establishment requires a 2xx response bearing the `text/event-stream` content type; anything else is an establishment failure. No input values. Each event emits one output value per the WHATWG event framing — `data` lines joined with U+000A, comment-only and empty-`data` events emit nothing, `event`/`id`/`retry` never enter the output value. Transport close **completes** the subscription: reconnection (`retry`, `Last-Event-ID`) is excluded from revision 1 — one transport, one invocation |
| `send` × ws/wss | **Streaming subscription**: each received frame emits one output value; caller-supplied input values forward as frames (full duplex), and **closing input does not end the subscription** — it ends when the transport closes or the consumer cancels |

Declared protocol **`bindings` objects are authoritative where they speak**, incorporated: an http operation binding's `method` selects the request method above; a websockets channel binding's `method`, `query`, and `headers` govern the upgrade request, with declared query and header values supplied like address parameters ([§9.2](#92-configuration-points)) and any unsatisfied required declaration a pre-dispatch refusal. Where bindings are silent, the defaults above apply. One invocation is one publish or one subscription.

## 9. Operation-boundary correspondence

### 9.1. Input mapping and encoding

There is no field routing in this family: the input value is the **message payload, wholesale** (**ASYNC-P-03**). Input **encoding** follows the governing request-side declaration — the effective content type of the operation's messages, each resolved per the AsyncAPI rule (the message's `contentType`, else the document's `defaultContentType`): a JSON-family type serializes the value as JSON; a text-family type sends a string value raw (a non-string value there is refused); no declaration at all serializes as JSON, this specification's default; any other declared family (binary, avro, protobuf, …) is **excluded** from revision 1 and refused before dispatch. Forwarded frames on the duplex subscription cell use the same rule.

Presence per cell: a **publish** invocation (`receive`-action) requires an input value — absent input is refused before dispatch, because the input *is* the message and this family defines no empty message. An SSE **subscription** takes no input; its input side is closed at establishment, so the binding invoker ignores any input a caller supplies per its frame protocol (a late input frame is never a loud refusal). A ws subscription's input values are optional.

### 9.2. Configuration points

This family has **three** named configuration points, consulted per-invocation configuration → consumer-level configuration → the defaults below; a declined override falls through (**ASYNC-P-04**). Classification is not configurable ([§9.4](#94-classification)). All defaults are **content-independent** — decided by declarations, never payload bytes:

| Point | Default | Meaning |
| --- | --- | --- |
| **server** | the first candidate of the operation's **effective server set** whose `protocol` revision 1 binds — the channel's declared `servers` subset when present **and non-empty** (in the artifact's own array order), else the document's `servers` map (in lexicographic key order; the map is unordered and this ordering is this specification's determinism rule) | Which declared server the connection targets. Consumer configuration may select another member of the effective set or supply a complete connection URL outright; under a full-URL override the URL's scheme decides the protocol (out-of-revision schemes refused), and the declared security of the server the default would have selected still applies ([§9.5](#95-credentials)). No resolvable server is a pre-dispatch refusal. |
| **address** | the channel's declared `address`, with every `{name}` expression expanded from consumer-supplied parameter values, else the declared parameter's `default` | The channel's concrete address. An absent or `null` address with no consumer-supplied address, or any expression left unresolved after defaults, is a **pre-dispatch refusal**, never a guess (this specification does not assume the channel key is an address, and never dials literal braces). |
| **decode** | the governing declared content types, per direction ([§9.3](#93-decode)) | How each delivery unit becomes an output value — the decode **lane** (JSON vs text). Overriding the lane is this point's role; envelope unwrapping (`{data}`/`{error}` conventions) is the operation's output transform's job ([§9.6](#96-transform-positions)), not a decode override. |

**Configuration value shapes.** Each point's `context.configuration` value is pinned so two implementations carry it identically: **`server`** is an object — `{ "key": "<server-name>" }` selects a member of the effective server set, xor `{ "url": "<connection-url>" }` overrides with a complete URL whose scheme picks the protocol (an out-of-revision scheme is refused); the two forms are mutually exclusive. **`address`** is an object of parameter values, `{ "<name>": "<value>" }`, supplying the channel address's `{name}` expressions over the declared defaults. **`decode`** is `{ "lane": "json" | "text" }`.

**Target URL assembly** (part of the server default): scheme from the resolved `protocol`; authority from the server's `host` with every variable substituted from consumer-supplied values, else the variable's declared `default` — an unsubstitutable variable is a pre-dispatch refusal; path = the server's `pathname` (if any) concatenated with the expanded address, normalized to exactly one `/` at the join. Concatenation, not RFC 3986 resolution: the pathname prefix is preserved.

### 9.3. Decode

The decode point applies **per delivery unit** — the HTTP response body, each SSE event's joined data, each WS frame — and output values are emitted as units arrive (**ASYNC-P-05**). The governing declarations are direction-correct: a **publish** invocation's output (the response) decodes by the operation's **reply**-side messages' effective content types; a **subscription**'s outputs decode by the operation's message declarations. Effective content type resolves per message first (its `contentType`, else `defaultContentType`); when the governing set yields **more than one distinct** effective type, the declaration is ambiguous and decode falls to the text lane rather than guessing; when it yields none, the text lane applies. The split: strict JSON for `application/json`/`+json` (malformed declared-JSON is a loud error), text otherwise — decided by declaration, never sniffed. Text-lane bytes become strings per the declared charset where the transport carries one, defaulting to UTF-8, invalid sequences a loud error.

### 9.4. Classification

Classification is **transport-native and not a configuration point** (**ASYNC-P-06**): this family declares no message-level failure semantics, so an invocation's outcomes are its transport's, per cell. A unary publish succeeds **iff** the final status, after any redirects, is 2xx. A client-streaming publish succeeds **iff** the closing handshake completes after the caller's clean input close — peer close codes and message content are never consulted. A subscription is established per its cell's rule ([§8](#8-target-and-interaction)) — establishment applies to the final response after any redirects — completes on the transport's clean close, and otherwise fails as the transport fails or as a **declared implementation bound** is exceeded — and where implementation policy bounds a subscription's undelivered output, exceeding the bound fails that subscription **loudly**: output values are never silently discarded, the integrity floor this family adds. Message content never reclassifies an outcome (an `{error}` envelope is a successful delivery whose meaning is the consumer's business, unwrapped by the operation's output transform).

### 9.5. Credentials

Security metadata is never extracted into the OBI: the artifact's declarations are read at invocation time (**ASYNC-P-07**). The declaration semantics are the AsyncAPI specification's, incorporated — and they are **conjunctive**: the targeted server's `security` applies (the server the connection actually goes to, or, under a full-URL override, the server the default selection would have targeted), and the operation's `security`, when declared, applies **in addition**; within each declared list, satisfying one entry suffices. Each entry is a security-scheme object or `$ref` into `components.securitySchemes`.

What this specification pins is **wire application**: an `httpApiKey` scheme's credential rides its declared `in`/`name` (header, query, or cookie); `http`/`basic` and `http`/`bearer` — matched case-insensitively per RFC 9110 — ride the `Authorization` header per their RFCs; `oauth2` and `openIdConnect` access tokens ride `Authorization: Bearer`. For WebSocket connections, credentials ride the **upgrade request** — headers, or the upgrade URL's query string for schemes whose declared location is `query`. A scheme this list does not pin (`apiKey`, `scramSha256`, `X509`, an `http` scheme value other than `basic`/`bearer`, and any other type) is **surfaced to the consumer** rather than silently skipped — and so is a **pinned** scheme whose carriage the platform cannot apply (a header credential on an upgrade request the platform strips): surfaced, never silently dropped or rerouted. Alternate carriage — query tokens for header schemes, in-band auth frames — is consumer configuration, never this specification's coverage: **no credential ever rides a message body or a first frame** under this document.

Where an implementation pools or reuses connections, a pooled connection MUST NOT be shared across differing credential identities; pooling itself remains implementation policy. How a consumer acquires credentials is a runtime concern; the project's [`binding-invoker`](https://openbindings.com/interfaces/binding-invoker) interface defines one such negotiation surface (informative).

### 9.6. Transform positions

This specification defines **no** context bindings at transform positions: a transform on an asyncapi binding evaluates in the core's closed environment, unaugmented.

## 10. Conformance

Rules carry stable identifiers under the same discipline as the core's: never reused, never renumbered. Source rules bind OBI content governed by this specification; processor rules bind implementations claiming support for `openbindings.asyncapi@1`. Verification follows the core's partial-verification posture.

- **ASYNC-D-01**: `content`, when present, is the parsed AsyncAPI document object or its source text as a string under [§3](#3-accepted-source-representations)'s grammar pin.
- **ASYNC-D-02**: `location`, when present, is an absolute URI addressing the AsyncAPI document, per [§4](#4-location).
- **ASYNC-D-03**: `ref` is present and is a JSON Pointer `#/operations/<operation-key>` addressing an operations-map entry — the only conformant spelling, RFC 6901-escaped, never percent-decoded, Reference Objects resolved — per [§7](#7-ref).
- **ASYNC-P-01**: Accepted lines and loud refusal discriminate on the artifact's `asyncapi` field: 3.0.x accepted, everything else refused, per [§3](#3-accepted-source-representations).
- **ASYNC-P-02**: The complementary perspective is normative — invoking `send` subscribes, invoking `receive` publishes — and the interaction shape follows [§8](#8-target-and-interaction)'s table, with declared protocol `bindings` authoritative where they speak and out-of-revision protocols refused pre-dispatch.
- **ASYNC-P-03**: The input value is the whole message payload, encoded per the governing declared content type with [§9.1](#91-input-mapping-and-encoding)'s refusals, and each cell's presence rule holds, all refusals pre-dispatch.
- **ASYNC-P-04**: The server, address, and decode configuration points behave per [§9.2](#92-configuration-points) — effective-set order, no-guess address and parameter refusals, default-substituted server variables, the concatenation URL-assembly rule.
- **ASYNC-P-05**: Decode applies per delivery unit with direction-correct governing declarations, the distinct-effective-type conflict rule, and the defined text lane, per [§9.3](#93-decode).
- **ASYNC-P-06**: Classification is transport-native per [§9.4](#94-classification)'s per-cell rules, final-status on the unary cell, never message-content-driven, never configurable; bounded subscriptions fail loudly, never silently dropping values.
- **ASYNC-P-07**: No security metadata is derived or written into OBI documents; requirement derivation is conjunctive per [§9.5](#95-credentials); wire application follows its pins; no credential rides in-band; unpinned and unapplyable schemes are surfaced; pooled connections never span credential identities.

Conformance fixtures keyed to these identifiers are published with the project's conformance corpus. Deterministic *generation* of OBI documents from AsyncAPI artifacts is a synthesis concern outside this specification; the project's interface-synthesizer and reference-tool documentation record those conventions.

## 11. References

- **[AsyncAPI]** AsyncAPI Initiative, "AsyncAPI Specification," 3.0. <https://www.asyncapi.com/docs/reference/specification/v3.0.0>. Incorporated authority for the artifact, its perspective rule, and its protocol `bindings` ([§2](#2-scope-and-incorporated-authorities)).
- **[RFC 9110]** "HTTP Semantics." <https://www.rfc-editor.org/rfc/rfc9110>
- **[RFC 6455]** "The WebSocket Protocol." <https://www.rfc-editor.org/rfc/rfc6455>
- **[RFC 6901]** "JavaScript Object Notation (JSON) Pointer." <https://www.rfc-editor.org/rfc/rfc6901>
- **[SSE]** WHATWG, "HTML Living Standard," §Server-sent events. <https://html.spec.whatwg.org/multipage/server-sent-events.html>. Incorporated for event framing only ([§8](#8-target-and-interaction)).
- **[OpenBindings]** The OpenBindings core specification, `openbindings.md` in this repository.
- **[BCP 14]** RFC 2119 / RFC 8174 (key words).
- The [catalog README](../README.md) (informative) — completeness doctrine and configuration-point semantics this specification instantiates.
