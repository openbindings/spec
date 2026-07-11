# `grpc` binding conventions

**Status: non-normative conventions of record.** Not part of the core specification. This document records how the OpenBindings project binds the gRPC format — the answers to the [format authoring checklist](README.md#authoring-a-new-binding-format), as implemented by the reference packages (the Go SDK's `formats/grpc`; there is no TypeScript counterpart by design — browser consumers delegate to a local `ob start`). A third-party implementation MAY diverge anywhere no core-spec rule binds; this document exists so it can know, without reading reference source, what it would be diverging from.

Each answer carries a tier tag: **[format-spec]** — pinned by the format's own authorities (the protobuf language and JSON mapping, the gRPC protocol); **[convention]** — the OB convention of record as the reference packages implement it; **[assumption]** — a content-independent default a consumer hook may override; **[open]** — deliberately unanswered.

## Format token

`grpc`, versionless. **[convention]** No version segment is defined; a tool advertising `grpc` matches only the bare token (a source declaring `grpc@1.0` matches nothing). Protocol/schema versioning is carried by the protobuf definitions themselves, not the token.

## `ref` syntax

`package.Service/Method` — the protobuf fully-qualified service name, a `/`, and the unqualified RPC name (`blend.CoffeeShop/GetMenu`). **[convention]** (the ecosystem-standard gRPC path form). Matching is byte-exact; no case folding. A `ref` is **required**: the format defines no whole-artifact binding, and an absent or malformed ref is an invocation error before any I/O. **[convention]**

## Source expectations

The format is **service-addressed** (see [the catalog](README.md)): at invocation, `location` is always the dial address — a `host:port`, optionally scheme-prefixed. **[convention]**

- **TLS.** Dialing uses TLS when the address ends in `:443` or carries an `https://`/`grpcs://` prefix, plaintext otherwise; a scheme prefix is this convention's affordance for forcing the choice and is stripped before dialing. **[convention]** Caller-supplied transport credentials replace the auto-detection entirely.
- **`content`** carries protobuf **source text** (a `.proto` file's contents) and MUST be self-contained — imports cannot resolve, per OBI-D-15. **[convention]** Compiled descriptor sets (`FileDescriptorSet`) are not an accepted content form; see Open points.
- **Both present**: `content` pins the artifact (descriptors are built from it; reflection is never consulted) and `location` remains the dial target — the OBI-T-15 service-addressed pairing. This is the publishing form for servers without reflection enabled. **[convention]**
- **Artifact discovery** (synthesis/inspection lane): a `.proto` file (by location path or embedded content) is compiled directly; otherwise the location is dialed and the artifact is obtained by gRPC server reflection. Infrastructure services (`grpc.reflection.*`, `grpc.health.*`) are excluded from synthesis. **[convention]**

## Input conventions

The wire contract is the proto3 JSON mapping. **[format-spec]** The input value must be a JSON object; it unmarshals into the request message with canonical protobuf-JSON semantics (camelCase names, well-known-type canonical forms). Unknown fields are discarded rather than refused. **[convention]** There is no required-field enforcement (proto3 has none; absent fields are zero values). **[format-spec]**

Synthesized contracts mirror the same mapping: well-known types emit their canonical JSON-mapping schemas (`Timestamp` → `string`/`date-time`, `Struct` → `object`, wrappers, `Any` with `@type`), int64-family fields emit `{"type": "integer", "format": "int64"}` (wire carriage precision is the invoker's concern; codegen reads `format`), and a single oneof group emits a top-level `oneOf`. **[convention]**

## Invocation shape

Cardinality follows the protobuf method kind. **[format-spec]** Unary: one input value, one output value. Server-streaming: one input value, one output per received message, with handle backpressure flow-controlling the stream. The reference packages implement unary and server-streaming; client-streaming and bidirectional methods are refused before dispatch (a reference-coverage limitation, not a format convention — see Open points).

## Wire answers (routing / decode / classify)

gRPC is a complete specification: all three wire questions are answered by the format, so the consumer-hook seam is not consulted and no provenance stamps are emitted (`ob plan` reports the axes `not-consulted`). **[convention]** (per the catalog's completeness doctrine).

- **Routing**: protobuf. **[format-spec]**
- **Decode**: responses decode by the canonical protobuf-JSON mapping (camelCase, enums as strings, unpopulated fields omitted). **[format-spec/convention]**
- **Classify**: the gRPC status code is the verdict — `OK` is success, everything else is an invocation error. **[format-spec]** The reference mapping to error codes: `Unauthenticated` → `ERR_AUTH_REQUIRED`, `PermissionDenied` → `ERR_PERMISSION_DENIED`, `Unavailable` → `ERR_CONNECT_FAILED`, `DeadlineExceeded` → `ERR_TIMEOUT`; error details always carry the status (`grpcCode`) and decoded status details (`grpcDetails`). **[convention]** (error-code vocabulary is SDK convention, not spec — see the binding-invoker interface README).
- gRPC leading/trailing metadata maps verbatim onto the invocation's header/trailer metadata. **[convention]**

## Authentication and context

Protobuf declares no security metadata, so nothing is extracted into the OBI (per the catalog's credentials rule) and the invoker issues no static preflight challenge: an unauthenticated call surfaces post-dispatch as `ERR_AUTH_REQUIRED`, and credential resolution happens above the binding. **[convention]**

Credentials ride outgoing gRPC metadata: `bearerToken` → `authorization: Bearer …`; else `apiKey` → `authorization: ApiKey …`; else `basic` → `authorization: Basic base64(user:pass)`. Context `headers` forward as additional metadata (keys lowercased). The `metadata.baseURL` context key serves as a dial-address fallback when the source has no usable `location`. **[convention]**

## Open points

- **Compiled descriptor sets as `content`**: refused today (use `.proto` source text or a reflection address). A future convention would need to bless a textual or JSON encoding, since raw binary cannot ride `content` (OBI-D-14).
- **Client-streaming / bidirectional coverage** in the reference packages.
- **Per-target mTLS** as a context requirement family (`auth.mtls`) — named design intent; transport identity is currently process-level configuration.
- Resource policy (deadlines, message-size caps, connection reuse) is tool-defined throughout; the reference packages impose no deadlines and delegate caps to the gRPC library defaults.
