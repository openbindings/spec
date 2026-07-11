# `connect` binding conventions

**Status: non-normative conventions of record.** Not part of the core specification. This document records how the OpenBindings project binds the Connect (Buf) format — the answers to the [format authoring checklist](README.md#authoring-a-new-binding-format), as implemented by the reference packages (the Go SDK's `formats/connect`; there is no TypeScript counterpart by design — browser consumers delegate to a local `ob start`). A third-party implementation MAY diverge anywhere no core-spec rule binds.

Tier tags: **[format-spec]** — pinned by the format's own authorities (the Connect protocol, protobuf); **[convention]** — the OB convention of record as the reference packages implement it; **[assumption]** — a content-independent default a consumer hook may override; **[open]** — deliberately unanswered.

## Format token

`connect`, versionless. **[convention]** The reference packages speak the Connect protocol with the JSON codec only (`Connect-Protocol-Version: 1`; `application/json` unary, `application/connect+json` streaming); gRPC-Web and the binary proto codec are not variants of this token. **[convention]** A Connect server that also serves the gRPC protocol can equally be bound with `format: "grpc"` — the two are separate wire protocols sharing protobuf definitions, and one `.proto` can yield both formats' bindings as two sources in one OBI.

## `ref` syntax

Identical to [`grpc`](grpc.md): `package.Service/Method`, byte-exact, required — no whole-artifact binding. **[convention]** Without embedded proto content the ref segments are used verbatim in the request URL, so casing flows through to the server.

## Source expectations

**Service-addressed** (see [the catalog](README.md)): `location` is the service's base URL (scheme'd; TLS follows the scheme through ordinary HTTP), and the request URL is `{location}/{service}/{method}`. **[format-spec/convention]**

- **`content`** carries self-contained protobuf **source text**, as for `grpc`. **[convention]** It is optional for unary invocation but load-bearing for three things: detecting server-streaming methods, proto-aware input encoding, and proving a request message empty (the no-input case).
- **Both present**: `location` is the invocation target; `content` pins the artifact — the OBI-T-15 service-addressed pairing. **[convention]**
- **Artifact discovery** is proto-parse only: there is no live-service discovery lane (Connect defines no reflection the reference packages consume). **[convention]**

## Input conventions

With proto content, input follows the proto3 JSON mapping exactly as for `grpc` (object required, canonical camelCase, unknown fields discarded). **[format-spec]** Without content, the input value is sent as the JSON request body verbatim — any JSON value, no proto awareness. **[convention]** No required-field enforcement (proto3). **[format-spec]**

## Invocation shape

Unary and server-streaming, each taking exactly one request message. **[format-spec]** Streaming detection requires embedded proto content; without it a method is dispatched as unary (a genuinely streaming method then fails at runtime). **[convention]** Client-streaming and bidirectional are out of the reference packages' scope. Streaming framing is the Connect envelope protocol (5-byte header, END_STREAM envelope carrying `{error?, metadata?}`); compression is refused loudly in both directions. **[format-spec/convention]**

## Wire answers (routing / decode / classify)

Connect is a complete specification; the consumer-hook seam is not consulted and no provenance stamps are emitted. **[convention]**

- **Routing / encode**: the Connect protocol with JSON codec. **[format-spec]**
- **Decode**: response bodies parse as JSON; an empty unary body yields `null`. **[convention]**
- **Classify**: HTTP status ≥ 400 is failure, refined by the Connect error envelope's `code` when present (`unauthenticated` → `ERR_AUTH_REQUIRED`, `permission_denied` → `ERR_PERMISSION_DENIED`, `unavailable` → `ERR_CONNECT_FAILED`, `deadline_exceeded` → `ERR_TIMEOUT`); streaming errors arrive in the END_STREAM envelope and map through the same table. **[format-spec/convention]** (Error-code vocabulary is SDK convention, not spec.)
- **Metadata**: unary trailing metadata follows Connect's `Trailer-` header convention (prefix stripped) plus real HTTP trailers; streaming trailing metadata is the END_STREAM envelope's `metadata`. **[format-spec]**

## Authentication and context

As for `grpc`: protobuf declares no security metadata, so no static challenge is issued and auth failures surface post-dispatch (`ERR_AUTH_REQUIRED` via the envelope/status mapping). Credentials ride HTTP headers (`bearerToken` → `Authorization: Bearer`; else `apiKey` → `Authorization: ApiKey`; else `basic`), context `headers` forward verbatim, and context `cookies` join into a `Cookie` header. **[convention]**

## Open points

- Client-streaming/bidirectional coverage; pre-dispatch refusal of descriptorless client-streaming methods (currently attempted as unary).
- The binary proto codec and gRPC-Web as potential token variants.
- Synthesis fidelity relative to `grpc` (well-known-type canonical schemas, oneof emission, int64 representation) — tracked as reference-implementation alignment work, not a format convention.
- Resource policy (response-size caps, redirect limits, timeouts) is tool-defined; the reference packages cap unary responses and stream envelopes at 10 MiB and follow at most 10 redirects.
