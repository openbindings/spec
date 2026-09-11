# Authority and scope

## Governing hierarchy

1. OpenBindings Core 0.2.0 governs the OBI envelope, per-value operation
   contracts, exact binding-specification identity, and the OBI-B-02
   completeness floor.
2. The unpublished `openbindings.grpc@1` candidate is sovereign over its accepted
   source and binding domain.
3. Exact pinned Protobuf and gRPC sources are incorporated only on the terms
   the binding document states.
4. Explicit OpenBindings pins, conventions, configuration points, exclusions,
   and limits close behavior the upstream sources leave optional or undefined.

No moving documentation page, installed library default, or reference SDK
behavior is authority.

## Existing exact authority set

The baseline already pins Protobuf `v35.0` descriptor and bundled well-known
type files, proto2/proto3/Edition 2023/Edition 2024 language documents,
ProtoJSON, gRPC over HTTP/2 at `v1.83.0`, and reflection v1/v1alpha service
definitions. Their live bytes and tags were reverified at baseline.

That Protobuf snapshot became stale before publication work began: Protobuf
36.1 and Edition 2026 were released in August 2026. The unpublished candidate
therefore moved as one pre-publication change to the exact 36.1 compiler/source
snapshot and admits Edition 2026 rather than freezing an immediately obsolete
closed domain. gRPC likewise moved to 1.83.1. The incorporated set now includes
the exact protocol, reflection, naming, status-code, compression,
HTTP-status-mapping, and `google.rpc.Status` definition bytes at that commit.

## Authority gaps to close before normative drafting

- Protobuf binary wire encoding.
- The Protobuf conformance behavior needed to close ProtoJSON parser edges.
- Complete reflection request/response and descriptor-closure semantics, not
  only the service message definitions.
- gRPC status-code meaning and broken-HTTP-response status synthesis.
- HTTP/2 itself, including stream closure and error semantics used by gRPC.
- Base64 semantics used by binary metadata (the existing RFC 4648 pin may be
  promoted for gRPC citation).
- TLS protocol, certification-path validation, service identity, and ALPN.
- The exact gzip definition if revision 1 admits gzip compression.

The Protobuf 36.1 authority set includes the compiler/source commit, descriptor
and conformance definitions, binary encoding guide, ProtoJSON guide, Editions
feature/default documentation, and this exact import allowlist from the
official `protoc-36.1` archive: `any.proto`, `api.proto`, `descriptor.proto`,
`duration.proto`, `empty.proto`, `field_mask.proto`,
`json_enumvalue_options.proto`, `json_options.proto`, `source_context.proto`,
`struct.proto`, `timestamp.proto`, `type.proto`, and `wrappers.proto`.
Language/code-generator feature files and compiler plugins are intentionally
not admitted. A path prefix is never used as the allowlist.

Edition 2026's first-party `pb.enumvalue.json` option is part of the admitted
correspondence, not a user-option exclusion. Its descriptor is included in the
closed compiler/import pool and bootstrapped into strict JSON-FDS parsing;
input accepts the incorporated ordinary and custom enum names under the
portable caller profile, and output uses the configured JSON spelling.
Colliding or invalid configured spellings follow the pinned
compiler/conformance behavior.

The individually cached C++ files are decision anchors. Their parser/unparser
traits, reflection, lexer/writer, and coded-stream dependencies are closed by
the exact complete Protobuf source-commit pin; the anchor list is not treated as
a standalone compilable or exhaustive dependency set.

Proto2 `required`, Editions `LEGACY_REQUIRED`, and caller-visible application
extensions remain compiler-valid but are excluded by the module at the
smallest reached message closure. Their accepted compiler syntax therefore
does not imply an admitted caller-value or schema correspondence. Each has an
explicit executable-evidence and consumer-need trigger in the exclusion
register.

Each authority is added as immutable bytes with digest, exact citation
ownership, and a local cache. A cited upstream choice that remains optional
must be pinned or exposed as a named configuration point; it cannot leak in as
an implementation default.

## Scope boundary

The binding covers native gRPC over HTTP/2 with Protobuf messages. It covers
all four RPC cardinalities, static and reflected schema acquisition, binary
message framing, ProtoJSON-facing operation values, metadata, final status,
deadline and cancellation behavior, admitted compression, and plaintext/TLS
channel establishment.

It does not cover gRPC-Web, Connect, JSON transcoding, xDS/service-config load
balancing, resolver-specific target URI schemes, transparent retries/hedging,
or application semantics inferred from custom options. Those are distinct
protocols or policy systems. Every exclusion is recorded with a concrete
reopen condition in `EXCLUSION-REGISTER.md`.

## OBI-B-02 completion requirement

The publication draft must carry an informative seven-row discharge map and
normative rules that fully define:

1. the closed accepted Protobuf/gRPC artifact domain;
2. service-address `location` meaning;
3. each permitted `content` carriage;
4. content/location/reflection composition;
5. exact method selector interpretation;
6. target identity and all four interaction lifecycles; and
7. caller-value correspondence, successful completion, unsuccessful
   completion, partial outputs, cancellation, and transform context.

Publication is blocked while any row says "implementation defined," "future
revision," or otherwise leaves a governed case without a required, permitted,
configured, excluded, invalid, or limited disposition.
