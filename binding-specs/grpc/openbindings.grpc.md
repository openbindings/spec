# `openbindings.grpc` Binding Specification

## 1. Status and identifier

This document is the normative text for the binding specification identifier **`openbindings.grpc@1`**, published by the openbindings project as its defining authority. The identifier is exact and opaque per core [OBI-B-01](../../openbindings.md#104-binding-specification-rules): no range or normalization semantics attach to it. An incompatible change to this specification publishes `openbindings.grpc@2` ([OBI-B-03](../../openbindings.md#104-binding-specification-rules)); compatible clarification may revise this document in place. Because `openbindings.connect@1` incorporates this specification by exact-identifier citation (as its schema and correspondence layer), any in-place clarification MUST be evaluated for compatibility not in gRPC's context alone but in every citing specification's context: a change that is compatible for gRPC can be substantive under a citer that carries a different protocol context. It publishes with the OpenBindings core 0.2.0 change set, and reference tooling adopts the identifier — replacing the pre-bindingSpec `grpc` token — in the same coordinated change.

The key words "MUST", "MUST NOT", "REQUIRED", "SHOULD", "SHOULD NOT", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in all capitals.

## 2. Scope and incorporated authorities

This is the **openbindings project's** binding specification for **gRPC** services described by protobuf definitions. It is published under this project's authority, not by or for the gRPC or protobuf projects: the protobuf language and descriptor model, protobuf's canonical **JSON mapping** (ProtoJSON), the gRPC protocol (method kinds, status codes, metadata rules, framing), and the gRPC **Server Reflection Protocol** are incorporated by reference. This specification defines only the OpenBindings overlay: how a source addresses a gRPC server and carries or discovers its protobuf schema, how a binding selects an RPC method, and how caller-facing JSON operation values correspond to protobuf messages on the wire.

gRPC is a complete family — routing, encoding, and outcome classification are all answered by the incorporated authorities — so this specification fixes decode and classification as artifact-native ([§9.2](#92-decode), [§9.4](#94-classification)) and defines exactly **two** configuration points, both transport-side: the dial **target** and the channel's **transport security** ([§9.3](#93-configuration-points)). Deadlines, message-size limits, retries, and channel reuse are consumer and implementation policy, outside this document. The schema range this specification accepts is defined with the representations in [§3](#3-accepted-source-representations).

## 3. Accepted source representations

The artifact is the service's protobuf schema — concretely, the descriptor closure needed to marshal and unmarshal the addressed method's messages. Three carriages, discriminated structurally — string, object, absent — and deterministically (**GRPC-D-01**):

- **String `content`** — the source text of a **single** `.proto` file. Its imports, if any, MUST be limited to the `google/protobuf/*` path prefix — the files the protobuf distribution bundles, `descriptor.proto` included — which processors resolve from their own bundled copies; any other import is refused loudly at load. A schema needing more carries the descriptor-set form instead.
- **Object `content`** — a **`google.protobuf.FileDescriptorSet`** carried in the canonical JSON mapping: the compiled, self-contained closure (the natural carriage for multi-file schemas). The carriage is this specification's own pin, since the container message is proto2-syntax and the incorporated mapping does not cover everything a compiled set can hold: (i) unknown members in the content object are refused loudly, matching this family's input posture; (ii) bracket-keyed **extension members** — the runtime convention for compiled custom options — are refused loudly: custom options never affect the JSON mapping or wire marshaling, so a conformant pin carries option-stripped descriptors. Raw binary descriptor bytes have no carriage here.
- **No `content`** — the schema is obtained live from the addressed server via the gRPC Server Reflection Protocol: the `grpc.reflection.v1.ServerReflection` service, falling back to `v1alpha` **iff** the `v1` info stream fails with status `UNIMPLEMENTED` — any other status is that source's failure, not a version signal (**GRPC-P-01**). A server exposing neither makes a location-only source's bindings unresolvable. The invocation's resolved context applies to these reflection RPCs exactly as it does to the bound method's call ([§9.5](#95-credentials)): the reflection stream carries the same outgoing metadata — bearer and the other credential fields included — over the same dialed target and transport determination, so a source whose reflection endpoint is auth-gated resolves under the same credentials the method call would use, rather than dialing reflection anonymously.

**Accepted schema range.** Acceptance is evaluated per **bound method's transitive message closure** — the request and response types and every message, enum, and field type reachable from them. Files in a carried set outside every bound closure (a proto2 `descriptor.proto` riding along for options, for instance) are inert carriage and never grounds for refusal. Within a bound closure, the following are refused loudly at descriptor load: proto2 groups; fields with required presence (proto2 `required`, editions `field_presence = LEGACY_REQUIRED`); fields with `message_encoding = DELIMITED`; and editions files whose resolved `json_format` feature is not `ALLOW`. Proto3 files always satisfy the range. In short: every bound method's closure must sit fully inside the canonical JSON mapping.

## 4. `location`

A source's `location` is REQUIRED and is the **dial address** of the gRPC server, in one of three binding-specification-defined absolute forms (**GRPC-D-02**), each with an **explicit port** — this specification defaults no ports:

| Form | Transport security |
| --- | --- |
| `host:port` | TLS **iff** the port is 443, plaintext otherwise — so `host:8443` dials plaintext unless overridden |
| `grpc://host:port` | plaintext |
| `grpcs://host:port` | TLS |

`host` is a DNS name, an IPv4 literal, or a bracketed IPv6 literal (`[::1]:50051`). Path, query, fragment, and userinfo components are not part of a dial address; a `location` carrying any of them is not conformant. No other scheme spelling is defined — one spelling per meaning; the scheme expresses the transport choice and is stripped before dialing. This family is service-addressed: a schema with no server addresses nothing, so a `content`-only source is not conformant under this specification.

The address-form rule above is the **transport** configuration point's default (**GRPC-P-02**, [§9.3](#93-configuration-points)): consumer-supplied channel security — a custom CA, a mutual-TLS identity, or an explicit plaintext election — replaces the determination entirely, and wins even against an explicit scheme (an override is an override).

## 5. `content`

A source's `content`, when present, MUST be one of the two embedded carriages of [§3](#3-accepted-source-representations): the single-file proto source text as a string, or a `FileDescriptorSet` in canonical JSON as an object, under that section's parse pins (**GRPC-D-01**). No other JSON type or shape is an accepted `content` value under this specification.

## 6. Composition

When `content` is present it is the artifact the processor interprets, per the core's content-primacy floor ([§5.4](../../openbindings.md#54-sources)): descriptors are built from the embedded schema and **reflection is never consulted**. `location` remains the dial target — the service-addressed pairing. Embedded schemas are self-contained by construction ([§3](#3-accepted-source-representations)); this specification defines no reference-base role for `location` (OBI-B-02 item 4: the answer is *none*).

Staleness is defined rather than surprising: the pin stays authoritative for interpretation, dispatch proceeds against it, and a server whose actual schema has drifted answers with its own status — a failure outcome under [§9.4](#94-classification), not a resolution failure. A processor MAY compare an embedded schema against the live reflection listing as a freshness diagnostic; the pin stays authoritative.

## 7. `ref`

A binding's `ref` is REQUIRED — this family defines no whole-artifact invocation — and MUST be `<fully-qualified-service>/<method>` (**GRPC-D-03**): the service's protobuf fully-qualified name (its package-qualified name, or its bare name when its file declares no package), one `/`, and the unqualified RPC name — `blend.CoffeeShop/GetMenu`, or `CoffeeShop/GetMenu` for a packageless schema. Matching against the schema's declared services is **byte-exact**, no case folding. A `ref` matching no method in the schema makes the binding unresolvable; with embedded `content` that is offline-checkable, and for a location-only source it is checkable only against the live reflection listing, per the core's partial-verification posture. Resolution precedes dispatch: a processor does not dial blind on the ref name.

## 8. Target and interaction

The binding target is the resolved RPC method on the dialed server. The interaction shape **is** the method's protobuf kind, statically declared in the schema and incorporated wholesale (**GRPC-P-04**):

| Method kind | Interaction |
| --- | --- |
| Unary | One input value; one output value |
| Server-streaming | One input value; one output value per received response message |
| Client-streaming | One input value per request message, input closed by the caller; one output value |
| Bidirectional | Input values and output values interleave per the gRPC protocol; the caller closes input, and output values MUST be deliverable while input remains open — full duplex, never gated on input close |

All four kinds are specified; an implementation that does not cover a kind declares that as its own limitation and refuses such a method **before dispatch** — a coverage declaration, never a reinterpretation of the shape. Stream lifecycle — half-close, flow control, cancellation propagation — is the gRPC protocol's, incorporated; one invocation is one RPC.

## 9. Operation-boundary correspondence

### 9.1. Input mapping

There is no field routing in this family: each caller-facing input value is one request message, and the correspondence is the canonical JSON mapping, incorporated (**GRPC-P-03**). An input value's accepted shape is the request message type's **canonical JSON form** — an object for ordinary messages; the mapping's defined form where it differs (a string for a `google.protobuf.Duration`-typed request, the wrapped value for wrapper types, and so on). Unmarshalling follows the mapping's own rules — field names by `json_name` or the mapping's defined spellings, well-known types by their canonical forms, absent fields as protobuf defaults — including the mapping's **default posture on unknown fields: they are refused loudly**, never silently discarded. An input value that fails to unmarshal against the request descriptor is refused before dispatch.

An **absent input value** marshals as the empty request message for unary and server-streaming methods; for client-streaming and bidirectional methods, closing input without supplying values sends zero request messages, which the gRPC protocol permits.

### 9.2. Decode

Each output value is a response message rendered by the canonical JSON mapping (**GRPC-P-05**) — the mapping's own canonical form, incorporated rather than restated. Decode is **not a configuration point**: the schema answers it. Output values are emitted as response messages arrive; a processor does not buffer a stream to pre-confirm its final status ([§9.4](#94-classification)). A response message that fails to unmarshal against its descriptor is a failure outcome — loud, never a silently passed-through value. gRPC leading and trailing metadata have **no representation in the output value** in revision 1 — a declared exclusion; whether an implementation surfaces metadata out of band is its own concern.

### 9.3. Configuration points

This family has **two** named configuration points, consulted per-invocation configuration → consumer-level configuration → the defaults below; a declined override falls through:

| Point | Default | Meaning |
| --- | --- | --- |
| **target** | the source's `location` | The dial address, replaceable by consumer configuration in the same forms as [§4](#4-location). |
| **transport** | the address-form rule of [§4](#4-location) | Channel security: consumer-supplied credentials (CA, mutual-TLS identity, explicit plaintext) replace the address-form determination entirely and apply to whichever target is dialed. |

The **transport** point accepts an explicit election of channel security — plaintext, or TLS — which overrides the address-form determination directly, or channel-security material of a closed set of kinds: a custom root of trust (a PEM `ca`), a mutual-TLS identity (a PEM client certificate and key, which are supplied together — one without the other is not conformant), and a `serverName` overriding the hostname verified against the server certificate. Material of a kind outside that set is not accepted (matching this family's loud unknown-input posture, [§9.1](#91-input-mapping)); an election that is neither plaintext nor TLS is refused. The **target** point accepts a dial address in the [§4](#4-location) forms.

The concrete **carriage** of a transport or target value — its JSON shape in a JSON-configured runtime (the reference SDKs use the string `"plaintext"`/`"tls"` xor an object of string members `ca`/`clientCert`/`clientKey`/`serverName`), or the idiomatic type in another — is each implementation's own surface, not specification content: nothing an OBI carries depends on it. The reference SDKs document their shapes.

Nothing else is configurable: routing, encoding, decode, and classification are all schema- or protocol-answered.

### 9.4. Classification

Classification is **protocol-native and not a configuration point** (**GRPC-P-06**): the RPC's **final status** is the verdict — `OK` is the success the decode rule applies to; every other status is a failure outcome. For streaming interactions the final status arrives after response messages: output values already emitted **stand**, and a non-`OK` final status makes the invocation a failure without retracting them. Failure outcomes are not operation results and have no representation in this specification; status codes, status details, and any error-code vocabulary a consumer surfaces are its own concern, outside this document.

### 9.5. Credentials

Protobuf declares no security metadata, so nothing is extracted into the OBI and no security requirements are derived from the schema (**GRPC-P-07**). Credentials ride **outgoing gRPC metadata** per the gRPC metadata rules, incorporated (names lowercase from the restricted grammar; binary values only via `-bin` keys, which ride as binary metadata). The well-known context credential fields carry as follows: a **bearer token** rides the `authorization` metadata key as `Bearer <token>`; an **API key** rides `authorization` as `ApiKey <key>`; **basic** credentials ride `authorization` as `Basic <base64(username:password)>`. These three schemes share the single `authorization` key and are therefore mutually exclusive — at most one is placed, in the precedence bearer, then API key, then basic. Context **headers** each ride their own metadata key. Any other credential naming a valid metadata key rides that key. A credential whose key is empty, violates the metadata name grammar, or uses the protocol-reserved `grpc-` prefix is **unplaceable** — surfaced to the consumer as a loud pre-dispatch refusal, never normalized or case-folded into place. A transport identity such as mutual TLS applies at the channel via the **transport** point ([§9.3](#93-configuration-points)). Anything this specification cannot place is surfaced rather than silently skipped. How a consumer acquires credentials is a runtime concern; the project's [`binding-invoker`](https://openbindings.com/interfaces/binding-invoker) interface defines one such negotiation surface (informative).

### 9.6. Transform positions

This specification defines **no** context bindings at transform positions: a transform on a grpc binding evaluates in the core's closed environment, unaugmented.

## 10. Conformance

Rules carry stable identifiers under the same discipline as the core's: never reused, never renumbered. Source rules bind OBI content governed by this specification; processor rules bind implementations claiming support for `openbindings.grpc@1`. Verification follows the core's partial-verification posture.

- **GRPC-D-01**: `content`, when present, is single-file proto source text (string; `google/protobuf/*` imports only) or a `FileDescriptorSet` in canonical protobuf JSON (object; unknown members and bracket-keyed extension members refused), per [§3](#3-accepted-source-representations) and [§5](#5-content).
- **GRPC-D-02**: `location` is present and is a dial address in the three port-explicit forms of [§4](#4-location), free of path, query, fragment, and userinfo components; a `content`-only source is not conformant.
- **GRPC-D-03**: `ref` is present and is `<fully-qualified-service>/<method>`, matched byte-exactly, per [§7](#7-ref).
- **GRPC-P-01**: A location-only source's schema is obtained via Server Reflection, `v1` first, `v1alpha` only on `UNIMPLEMENTED`; embedded `content` displaces reflection entirely, per [§3](#3-accepted-source-representations) and [§6](#6-composition).
- **GRPC-P-02**: Transport security follows the address-form rule as the transport point's default, with consumer channel security replacing it entirely, per [§4](#4-location) and [§9.3](#93-configuration-points).
- **GRPC-P-03**: Input values take the request type's canonical JSON form, unmarshalled per the mapping with unknown fields refused; absent input follows [§9.1](#91-input-mapping)'s empty-message and zero-message rules; all refusals pre-dispatch. Acceptance of the schema itself follows [§3](#3-accepted-source-representations)'s bound-closure range.
- **GRPC-P-04**: The interaction shape is the method's declared kind, all four kinds specified, bidirectional full-duplex; an uncovered kind is refused pre-dispatch as an implementation-declared limitation, per [§8](#8-target-and-interaction).
- **GRPC-P-05**: Output values are response messages in the canonical JSON mapping, emitted as they arrive; metadata has no output representation, per [§9.2](#92-decode).
- **GRPC-P-06**: Classification is the RPC's final status, `OK` and only `OK` a success, emitted values standing on late failure, and is not a configuration point, per [§9.4](#94-classification).
- **GRPC-P-07**: No security metadata is derived or written into OBI documents; credentials ride gRPC metadata or the transport point as [§9.5](#95-credentials) pins, and unplaceable credentials are surfaced, never normalized.

Conformance fixtures keyed to these identifiers are published with the project's conformance corpus. Deterministic *generation* of OBI documents from protobuf schemas (operation-key derivation, schema translation, infrastructure-service exclusion) is a synthesis concern outside this specification; the project's interface-synthesizer and reference-tool documentation record those conventions.

## 11. References

- **[protobuf]** "Protocol Buffers" — the language, descriptor model, and editions features. <https://protobuf.dev/>. Incorporated authority ([§2](#2-scope-and-incorporated-authorities)).
- **[ProtoJSON]** "ProtoJSON Format" — the canonical JSON mapping. <https://protobuf.dev/programming-guides/json/>. Incorporated authority for the operation-boundary correspondence ([§9](#9-operation-boundary-correspondence)).
- **[gRPC]** "gRPC" — the protocol: method kinds, status codes, metadata rules, framing. <https://grpc.io/docs/>. Incorporated authority.
- **[gRPC reflection]** "gRPC Server Reflection Protocol" (`grpc.reflection.v1.ServerReflection`; `v1alpha` predecessor). <https://grpc.io/docs/guides/reflection/>. Incorporated for live schema acquisition ([§3](#3-accepted-source-representations)).
- **[OpenBindings]** The OpenBindings core specification, `openbindings.md` in this repository.
- **[BCP 14]** RFC 2119 / RFC 8174 (key words).
- The [catalog README](../README.md) (informative) — completeness doctrine and configuration-point semantics this specification instantiates.
