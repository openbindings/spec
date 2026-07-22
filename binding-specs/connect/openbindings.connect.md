# `openbindings.connect` Binding Specification

## 1. Status and identifier

This document is the normative text for the binding specification identifier **`openbindings.connect@1`**, published by the openbindings project as its defining authority. The identifier is exact and opaque per core [OBI-B-01](../../openbindings.md#104-binding-specification-rules): no range or normalization semantics attach to it. An incompatible change to this specification publishes `openbindings.connect@2` ([OBI-B-03](../../openbindings.md#104-binding-specification-rules)); compatible clarification may revise this document in place. It publishes with the OpenBindings core 0.2.0 change set, and reference tooling adopts the identifier — replacing the pre-bindingSpec `connect` token — in the same coordinated change.

The key words "MUST", "MUST NOT", "REQUIRED", "SHOULD", "SHOULD NOT", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in all capitals.

## 2. Scope and incorporated authorities

This is the **openbindings project's** binding specification for services speaking the **Connect protocol** with the **JSON codec**. It is published under this project's authority, not by or for the Connect project: the Connect protocol is incorporated by reference and remains authoritative over routing, framing (unary bodies and enveloped streams), error shapes, compression negotiation, and transport requirements; the protobuf language, descriptor model, and canonical JSON mapping are incorporated exactly as in [`openbindings.grpc@1`](../grpc/openbindings.grpc.md).

**Normative upstream snapshot.** The Connect protocol authority is [`src/content/docs/docs/protocol.md`](https://github.com/connectrpc/connectrpc.com/blob/c547a5412ee4f8428f31fce83dd2bb2a82942b76/src/content/docs/docs/protocol.md) at official `connectrpc/connectrpc.com` commit [`c547a5412ee4f8428f31fce83dd2bb2a82942b76`](https://github.com/connectrpc/connectrpc.com/tree/c547a5412ee4f8428f31fce83dd2bb2a82942b76). The rendered protocol page and later repository revisions are informative unless this binding specification deliberately advances the pin. Protobuf authorities retain the exact pins incorporated through `openbindings.grpc@1`; Connect's protocol document governs Connect routing, headers, framing, compression, and outcome semantics, while the protobuf authorities govern schema and ProtoJSON correspondence.

**Shared schema layer.** This family shares its protobuf schema layer with `openbindings.grpc@1`, incorporated by **exact-identifier citation**: the embedded schema carriages, their parse pins, and the accepted schema range of `openbindings.grpc@1` [§3](../grpc/openbindings.grpc.md#3-accepted-source-representations) apply here identically, as do its input-correspondence and decode rules where a schema is present ([§9.2](#92-schema-mode-input-and-decode) of this document). The citation names `@1` deliberately: a future `openbindings.grpc@2` does not silently alter this specification, and citations into `openbindings.grpc@1` denote that revision's text as published, whatever its file path later holds, naming its stable rule identifiers where they exist. One `.proto` can yield both families' bindings — a server speaking both protocols is bound twice, as two sources in one OBI. Three protocol variants are **excluded** from revision 1: the binary proto codec, gRPC-Web, and the protocol's GET dispatch lane for side-effect-free unary methods — every dispatch under this identifier is a POST (the GET lane's message-in-URL carriage brings caching and logging exposure this revision does not weigh). Each exclusion is a definition, not an open item.

This family has **two modes**, discriminated structurally by `content` presence ([§3](#3-accepted-source-representations)): **schema mode** (full fidelity) and **descriptorless mode** (Connect's HTTP+JSON nature makes schemaless calls genuinely useful; the mode has defined, narrower semantics rather than being a degraded guess). Resource policy — response-size caps, redirect limits, timeouts — is consumer and implementation policy, outside this document.

## 3. Accepted source representations

- **`content` present — schema mode.** The carriages, parse pins, and accepted schema range are `openbindings.grpc@1` [§3](../grpc/openbindings.grpc.md#3-accepted-source-representations)'s (rule GRPC-D-01), incorporated: single-file proto source text (string, `google/protobuf/*` imports only) or a `FileDescriptorSet` in canonical JSON (object, unknown members and extension members refused), with acceptance evaluated per bound-method closure (**CONN-D-01**).
- **`content` absent — descriptorless mode.** There is no live schema lane: Connect defines no reflection this specification consumes, so a location-only source operates without a schema, under [§8](#8-target-and-interaction)/[§9.3](#93-descriptorless-mode-input-and-decode)'s mode rules (**CONN-P-01**).

## 4. `location`

A source's `location` is REQUIRED and MUST be an absolute `http`/`https` URI naming the service's **base URL** (**CONN-D-02**): scheme, host, optional port (ordinary HTTP defaults), and an optional path prefix without a trailing `/` — `https://api.example.com`, `https://example.com/api`. Query, fragment, and userinfo components are not part of a base URL, and a `location` carrying any of them is not conformant. Transport security follows the scheme, as ordinary HTTPS — schemes are TLS-unambiguous here, so this family has no transport configuration point (unlike `openbindings.grpc@1`); consumer-supplied channel security (a custom CA, a mutual-TLS identity) is consumer configuration, declared outside this document. This family is service-addressed: a `content`-only source is not conformant under this specification.

The request URL for an invocation is the Connect protocol's routing, incorporated: the base URL **string-concatenated** with `/<fully-qualified-service>/<method>` from the binding's `ref` — concatenation, not RFC 3986 resolution, so the path prefix is preserved.

## 5. `content`

A source's `content`, when present, MUST be one of the two **embedded** schema carriages incorporated from `openbindings.grpc@1` (**CONN-D-01**). No other JSON type or shape is an accepted `content` value under this specification.

## 6. Composition

When `content` is present it is the artifact the processor interprets, per the core's content-primacy floor ([§5.4](../../openbindings.md#54-sources)); `location` remains the invocation target — the service-addressed pairing. Embedded schemas are self-contained by construction; this specification defines no reference-base role for `location` (OBI-B-02 item 4: the answer is _none_). Staleness is defined rather than surprising: the pin stays authoritative for interpretation, dispatch proceeds against it, and a drifted server answers with its own error — a failure outcome under [§9.5](#95-classification), not a resolution failure.

## 7. `ref`

A binding's `ref` is REQUIRED — this family defines no whole-artifact invocation — and takes exactly `openbindings.grpc@1` [§7](../grpc/openbindings.grpc.md#7-ref)'s grammar (rule GRPC-D-03), incorporated: `<fully-qualified-service>/<method>`, package-qualified or bare for packageless schemas, matched **byte-exactly** in schema mode (**CONN-D-03**).

In schema mode, resolution against the schema precedes dispatch, and a `ref` matching no method makes the binding unresolvable — offline-checkable, per the core's partial-verification posture. In descriptorless mode there is nothing to resolve against: the `ref` segments ride **verbatim** into the request URL (casing flows through to the server), and an unknown method surfaces as the server's own error — a failure outcome, a stated limit of the mode.

## 8. Target and interaction

The binding target is the addressed method at the routed URL. Framing is the Connect protocol's JSON codec, incorporated (**CONN-P-05**): unary requests and responses as plain JSON bodies (`application/json`), streaming as enveloped frames (`application/connect+json`), and the END_STREAM envelope closing every stream. The protocol permits a client to send or omit `Connect-Protocol-Version`; this specification preserves both choices. When a processor sends it, the value is exactly `1`; omission may cause a server or proxy to reject the request, as the protocol warns. Compression follows the Connect protocol's negotiation; a processor advertises only the encodings it implements.

**Schema mode** — the interaction shape is the method's declared kind, all four kinds specified, with the shape semantics of `openbindings.grpc@1` [§8](../grpc/openbindings.grpc.md#8-target-and-interaction)'s table (rule GRPC-P-04) incorporated for the kinds alone (**CONN-P-04**): unary; server-streaming; client-streaming; bidirectional — the last full-duplex, output deliverable while input remains open, and available only where the transport permits it (the Connect protocol requires HTTP/2 for bidirectional streams). Stream lifecycle — half-close, cancellation propagation — is the **Connect** protocol's, incorporated. An implementation that does not cover a kind declares that as its own limitation and refuses such a method before dispatch — a coverage declaration, never a reinterpretation.

**Descriptorless mode** — the mode supports **unary interactions only**, by definition: exactly one input value and one output value, dispatched with unary framing. A method that is in fact streaming is not detected — the server's rejection of the framing is a failure outcome. This is the mode's declared limit, not a guess about the method.

## 9. Operation-boundary correspondence

### 9.1. Configuration point

This family has **one** named configuration point, **target**, consulted per-invocation configuration → consumer-level configuration → the default; a declined override falls through. The default is the source's `location`; consumer configuration may supply a replacement base URL in the same form as [§4](#4-location). Nothing else is configurable: routing and framing are protocol-answered, and decode and classification are fixed below.

### 9.2. Schema mode: input and decode

With a schema, the correspondence is `openbindings.grpc@1`'s — [§9.1](../grpc/openbindings.grpc.md#91-input-mapping) and [§9.2](../grpc/openbindings.grpc.md#92-decode), rules GRPC-P-03 and GRPC-P-05 — incorporated (**CONN-P-02**): each input value takes the request type's canonical JSON form and unmarshals per the mapping — `json_name` spellings, well-known-type forms, absent fields as defaults, **unknown fields refused loudly** — with a first input value's failure refused before dispatch and a later client-streaming or bidirectional value's failure terminating the invocation and cancelling the stream, already-emitted outputs standing, exactly as the incorporated `openbindings.grpc@1` [§9.1](../grpc/openbindings.grpc.md#91-input-mapping) rule states; an absent input value marshals as the empty request message (unary, server-streaming) or closes input with zero request messages (client-streaming, bidirectional). Each output value is the response message rendered by the canonical JSON mapping, emitted as frames arrive; a response frame that fails to unmarshal against its descriptor — **including one with an unknown JSON member** — is a failure outcome: loud, never silently passed through or dropped. Connect's JSON codec incorporates ProtoJSON, whose parser rejects unknown fields by default; binary protobuf's unknown-field skipping does not authorize a binding specification to impose that different behavior on a JSON wire.

### 9.3. Descriptorless mode: input and decode

Without a schema there is no field semantics at all (**CONN-P-03**): the input value — **any** JSON value — is serialized verbatim as the unary request body. Exactly one input value is required. An absent input value is refused before dispatch: `{}` would be correct only for an object-shaped empty protobuf message, while a descriptorless method may instead use a scalar-shaped well-known type, and revision 1 refuses rather than invents the missing request shape. The output value is the non-empty response body parsed as JSON, verbatim. A 200 response with an empty body, a parsed media type other than `application/json`, or a body that fails to parse as JSON is a loud protocol-error failure outcome, never `null` or a string: the JSON codec requires a JSON message, and without a descriptor no absent response can be reconstructed as an empty protobuf value. Ordinary HTTP media-type parameters (for example `application/json; charset=utf-8`) do not change the media type. No unknown-field posture exists in this mode, and none is implied.

### 9.4. Metadata

Connect response metadata — unary trailing metadata via the protocol's `trailer-`-prefixed response headers (unary Connect uses no HTTP trailers), streaming trailing metadata in the END_STREAM envelope — has **no representation in the output value** in revision 1, a declared exclusion; whether an implementation surfaces it out of band is its own concern.

### 9.5. Classification

Classification is **protocol-native and not a configuration point** (**CONN-P-06**), following the Connect protocol's own rules, incorporated: a **unary** invocation succeeds **iff** the final response status is 200 — the protocol makes every unary error non-200, so this is Connect's rule, not a 2xx heuristic; a **streaming** invocation succeeds **iff** the stream rode HTTP 200, as the protocol requires, and its END_STREAM envelope carries no `error` member. Output values already emitted from a stream **stand**; an END_STREAM error makes the invocation a failure without retracting them. Failure outcomes are not operation results and have no representation in this specification; the Connect error body's codes and details, and any error-code vocabulary a consumer surfaces, are its own concern, outside this document.

The Connect protocol does not define redirect following, so following one is consumer/implementation policy rather than a protocol default. A processor that follows a redirect for a Connect invocation MUST preserve the POST method, complete body, and Connect framing fields; a redirect whose HTTP semantics require or whose implementation behavior would perform a method rewrite (a `303`, or a `301`/`302` policy that rewrites POST to GET) is not followed and remains the final non-200 failure response. Classification applies to the final response only after any method-preserving redirects the implementation elects to follow. Limits, cross-origin credential policy, and whether to follow at all remain runtime policy; none may silently turn the Connect call into a GET or discard its message.

### 9.6. Credentials

Neither the schema nor the protocol declares per-method authentication semantics, so nothing is extracted into the OBI and this specification invents no bearer/basic/API-key mapping or precedence rule (**CONN-P-07**). Consumer configuration may supply explicitly named **Connect leading-metadata** fields. Names and values follow the incorporated `Custom-Metadata` grammar, including `-bin` value encoding; field-name comparison is ASCII case-insensitive. A supplied field whose lowercase name begins `connect-` is refused before dispatch because the protocol reserves that prefix. A supplied leading-metadata field also MUST NOT collide with a request field the Connect exchange owns: `host`, `content-length`, `content-type`, `content-encoding`, `accept-encoding`, or `te`. Those names are not a broader application-metadata opinion; the incorporated request grammar assigns them to routing, framing, or compression, so treating one as metadata would create two authorities for one HTTP field. For every other name, multiplicity and combination follow the incorporated HTTP/Connect metadata rules rather than a project-specific collision policy. A generic runtime credential that does not name its metadata field is surfaced for consumer resolution rather than silently mapped to `authorization`. A transport identity applies as channel security per [§4](#4-location). How a consumer acquires credentials is a runtime concern; the project's [`binding-invoker`](https://openbindings.com/interfaces/binding-invoker) interface defines one such negotiation surface (informative).

### 9.7. Transform positions

This specification defines **no** context bindings at transform positions: a transform on a connect binding evaluates in the core's closed environment, unaugmented.

## 10. Conformance

Rules carry stable identifiers under the same discipline as the core's: never reused, never renumbered. Source rules bind OBI content governed by this specification; processor rules bind implementations claiming support for `openbindings.connect@1`. Verification follows the core's partial-verification posture.

- **CONN-D-01**: `content`, when present, is one of `openbindings.grpc@1`'s two embedded schema carriages under its parse pins and accepted range, per [§3](#3-accepted-source-representations) and [§5](#5-content).
- **CONN-D-02**: `location` is present and is an absolute `http`/`https` base URL — optional path prefix, no query, fragment, or userinfo — per [§4](#4-location); a `content`-only source is not conformant.
- **CONN-D-03**: `ref` is present and is `<fully-qualified-service>/<method>`, matched byte-exactly in schema mode, per [§7](#7-ref).
- **CONN-P-01**: The mode is discriminated by `content` presence: schema mode with it, descriptorless mode without, per [§3](#3-accepted-source-representations).
- **CONN-P-02**: Schema-mode input and decode follow `openbindings.grpc@1`'s correspondence — canonical JSON forms, unknown input or response members refused, absent-input rules, and the first-value-pre-dispatch / later-streaming-value-cancellation refusal split — per [§9.2](#92-schema-mode-input-and-decode).
- **CONN-P-03**: Descriptorless mode requires exactly one input value and sends it as the verbatim JSON body; absent input refuses before dispatch. Output is the verbatim parsed non-empty JSON body; an empty or invalid JSON success body is a protocol error rather than an invented value, per [§9.3](#93-descriptorless-mode-input-and-decode).
- **CONN-P-04**: Schema-mode interaction shape is the method's declared kind, all four kinds specified with bidirectional full-duplex and its HTTP/2 requirement; descriptorless mode is unary-only by definition; uncovered kinds are refused pre-dispatch as implementation-declared limitations, per [§8](#8-target-and-interaction).
- **CONN-P-05**: Framing is the Connect protocol's JSON codec — unary plain bodies, enveloped streams, and END_STREAM. Sending or omitting `Connect-Protocol-Version` preserves the protocol's permitted alternatives; when sent its value is `1`. Compression is advertised only as implemented, per [§8](#8-target-and-interaction).
- **CONN-P-06**: Classification is protocol-native — unary success iff the final status is 200, streaming success iff the stream rode 200 and END_STREAM carries no error, emitted values standing — and is not a configuration point. Redirect following is runtime policy, but any followed redirect preserves POST, body, and framing; a method-rewriting redirect remains the final failure response, per [§9.5](#95-classification).
- **CONN-P-07**: No security metadata is derived or written into OBI documents and no application authentication convention is invented; explicitly configured leading metadata and transport identities follow their upstream rules, the upstream-reserved `connect-` prefix and request-owned routing/framing/compression field collisions are refused, and a generic credential without explicit carriage is surfaced, per [§9.6](#96-credentials).

Conformance fixtures keyed to these identifiers are published with the project's conformance corpus. Deterministic _generation_ of OBI documents from protobuf schemas is a synthesis concern outside this specification; the project's interface-synthesizer and reference-tool documentation record those conventions.

## 11. References

- **[Connect]** ["The Connect protocol"](https://github.com/connectrpc/connectrpc.com/blob/c547a5412ee4f8428f31fce83dd2bb2a82942b76/src/content/docs/docs/protocol.md) at official repository commit `c547a5412ee4f8428f31fce83dd2bb2a82942b76`. Incorporated authority for routing, framing, errors, compression, metadata, and transport requirements ([§2](#2-scope-and-incorporated-authorities)); the [rendered page](https://connectrpc.com/docs/protocol/) is informative.
- **[openbindings.grpc@1]** `openbindings.grpc@1`, [`../grpc/openbindings.grpc.md`](../grpc/openbindings.grpc.md). Incorporated by exact-identifier citation for the schema layer and schema-mode correspondence ([§2](#2-scope-and-incorporated-authorities), [§3](#3-accepted-source-representations), [§7](#7-ref), [§9.2](#92-schema-mode-input-and-decode)).
- **[protobuf] / [ProtoJSON]** As incorporated through `openbindings.grpc@1`.
- **[RFC 9110]** "HTTP Semantics." <https://www.rfc-editor.org/rfc/rfc9110>. Cited for header-field credential carriage ([§9.6](#96-credentials)) and ordinary HTTP transport ([§4](#4-location)).
- **[OpenBindings]** The OpenBindings core specification, `openbindings.md` in this repository.
- **[BCP 14]** RFC 2119 / RFC 8174 (key words).
- The [catalog README](../README.md) (informative) — completeness doctrine and configuration-point semantics this specification instantiates.
