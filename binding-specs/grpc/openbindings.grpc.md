# `openbindings.grpc` Binding Specification

**Publication state.** The immutable identifier is established only by an entry in the OpenBindings Project's canonical root `binding-specs/publications.json` manifest for these exact defining bytes; absent that entry, this document is an unpublished candidate. Any manifest copy inside an immutable publication bundle is evidence of the pre-mint source snapshot, not the canonical registry.

## 1. Identifier and rule labels

**[convention]** The opaque binding-specification identifier has exactly the
spelling **`openbindings.grpc@1`**.

**[convention]** Only an OpenBindings Project publication-manifest entry bound
to these exact defining bytes mints §1's identifier. A mutable file path or an
unregistered promoted staging copy does not mint it.

**[incorporated]** Once minted, the identifier is exact and stable under Core
[OBI-B-01](../../openbindings.md#104-binding-specification-rules). Adding,
removing, or replacing accepted inputs, required or permitted behavior,
authorities, or normative-module meaning requires a new identifier under Core
[OBI-B-03](../../openbindings.md#104-binding-specification-rules); errata may
only clarify without changing observable meaning.

**[incorporated]** The key words **MUST**, **MUST NOT**, **REQUIRED**,
**SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are
interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119)
and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) only when they appear in
all capitals.

**[convention]** Every normative paragraph and normative table row carries
exactly one visible provenance label. `incorporated` states a cited authority's
rule; `pin` fixes one authority-permitted choice; `convention` supplies a local
bridge; `configuration point` exposes a named caller/consumer choice;
`exclusion` removes an upstream-valid feature behind a stated reopen
condition; and `limit` states a boundary this revision does not cross.

## 2. Scope and incorporated authorities

**[pin]** This specification incorporates exactly version **0.2.0** of the
[OpenBindings Specification](../../openbindings.md) as its Core authority.
Throughout this document, **Core** means that exact version.

**[convention]** This specification binds native gRPC over HTTP/2 with
Protobuf messages. It covers all four RPC cardinalities, embedded and reflected
descriptors, ProtoJSON-facing values, binary framing, metadata, compression,
deadlines, cancellation, final status, plaintext channels, and TLS channels.

**[pin]** Protobuf meaning is supplied by companion module
[`openbindings.module.protobuf-correspondence@1`](/binding-spec-modules/protobuf-correspondence/1),
incorporated at the exact SHA-256 recorded by the publication closure. That
module is not a binding specification and never appears in `source.bindingSpec`.

**[pin]** gRPC protocol and reflection behavior use exact gRPC **v1.83.1**
source commit
[`aae267021b1ac256f8b9038d0ef528c3798cc137`](https://github.com/grpc/grpc/tree/aae267021b1ac256f8b9038d0ef528c3798cc137).
The incorporated files are `doc/PROTOCOL-HTTP2.md`, `doc/naming.md`,
`doc/statuscodes.md`, `doc/compression.md`,
`doc/http-grpc-status-mapping.md`, `doc/server-reflection.md`, the v1 and
v1alpha reflection service definitions, and
`src/proto/grpc/status/status.proto` for the exact `google.rpc.Status` carried
by `grpc-status-details-bin`.

**[pin]** HTTP/2 syntax and stream mechanics are governed by
[RFC 7540](https://www.rfc-editor.org/rfc/rfc7540); URI IP-literal syntax by
[RFC 3986](https://www.rfc-editor.org/rfc/rfc3986); ABNF by
[RFC 5234](https://www.rfc-editor.org/rfc/rfc5234); Base64 by
[RFC 4648](https://www.rfc-editor.org/rfc/rfc4648); gzip by
[RFC 1952](https://www.rfc-editor.org/rfc/rfc1952); TLS 1.3 by
[RFC 8446](https://www.rfc-editor.org/rfc/rfc8446); certification paths by
[RFC 5280](https://www.rfc-editor.org/rfc/rfc5280); service identity by
[RFC 9525](https://www.rfc-editor.org/rfc/rfc9525); ALPN by
[RFC 7301](https://www.rfc-editor.org/rfc/rfc7301); and SNI by
[RFC 6066](https://www.rfc-editor.org/rfc/rfc6066), only at the decisions this
document assigns them.

**[exclusion]** gRPC-Web, Connect, JSON transcoding, xDS, service-config load
balancing, resolver-specific target URI schemes, transparent retries, hedging,
and application behavior inferred from custom options are outside revision 1.
Each reopens only when demonstrated consumer need and exact authority permit a
new binding identifier with complete portable semantics.

**[incorporated]** This document defines binding meaning, not one SDK surface.
Connection pooling, credential acquisition, generated classes, cancellation
APIs, and deployment remain runtime concerns except where their observable
effects are fixed below (Core [§1.2](../../openbindings.md#12-out-of-scope)).

**Where Core's completeness items are discharged.** This table is informative;
the numbered rules govern.

| Core OBI-B-02 item | carried by |
| --- | --- |
| 1 — accepted source modes and representations | §§2–5 |
| 2 — `location` syntax and meaning | §4 |
| 3 — `content` values and meaning | §3 |
| 4 — content/location composition | §§3–5 |
| 5 — selector syntax and meaning | §6 |
| 6 — target and interaction | §§6–8 |
| 7 — input/output, success/failure, prior outputs, transforms | §§7–12 |

## 3. Source carriage and load gates

**[convention]** Every governed source MUST carry `location`. `content` is
optional and, when present, has primacy; `location` remains the service target
and is never a retrieval base for imports.

**[convention]** Present `content` is exactly one of three disjoint forms:

1. a string containing one UTF-8 `.proto` compilation unit;
2. an object that is strict ProtoJSON for
   `google.protobuf.FileDescriptorSet`; or
3. an object with exactly one member `$fileDescriptorSet`, whose value is
   canonical RFC 4648 Base64 for binary `FileDescriptorSet` bytes.

**[pin]** String content is compiled as virtual file `source.proto` with no
filesystem, network, environment, working-directory, or user include paths.
Only the companion module's exact import allowlist is available.

**[pin]** The tagged binary carrier's Base64 uses the standard alphabet,
required padding, no whitespace, and canonical unused bits. The decoded bytes
must decode completely as exactly one `FileDescriptorSet`; the object form
cannot carry `$fileDescriptorSet`, so discrimination is structural and
deterministic.

**[convention]** Absent `content` selects server reflection. A location-only
source is not incomplete, and a processor MUST NOT invent embedded descriptors
or use locally registered generated types as source authority.

**[limit]** The ordered load gates are: Core source shape, required location,
content JSON type, tagged-carrier shape/Base64, string UTF-8, and the companion
module's descriptor-carriage grammar. Failures at those gates refuse at load.
Descriptor-graph, selector, target, configuration, and peer defects are not
load gates.

**[limit]** After load, a descriptor defect confines to the smallest reached
file, symbol, message, enum, field, or method owner. An unreachable defect does
not poison a sibling method or the source. If no method remains addressable,
the source refuses at resolution; an addressable excluded method instead
resolves and refuses before dispatch.

## 4. Service target and channel

**[convention]** `location` has exactly one of these port-explicit forms:
`grpc://<authority>`, `grpcs://<authority>`, or bare `<authority>`. An
authority is `<host>:<port>`, where port is decimal 1–65535 with no leading
zero. Host is exactly one of: an ASCII DNS name under the next paragraph; an
IPv4 dotted decimal containing four decimal octets 0–255 with no leading zero
except the single digit `0`; or a bracketed RFC 3986 `IPv6address`. A URI form
has no userinfo, path other than empty, query, or fragment; a bare authority has
none of those URI delimiters.

**[convention]** An admitted ASCII DNS name is 1–253 octets and contains one
or more dot-separated labels, with no leading or trailing dot. Each label is
1–63 octets, contains only ASCII letters, digits, and `-`, and begins and ends
with a letter or digit. DNS comparison for service identity is
case-insensitive; the carried spelling remains unchanged in the dial target,
`:authority`, and reflection `host`.

**[pin]** Host classification uses RFC 3986's first-match-wins rule before the
DNS grammar above: a spelling that matches `IPv4address` is an IPv4 literal and
is never also a DNS name. A dotted numeric spelling that does not match
`IPv4address` may be a DNS name only when it independently satisfies the exact
DNS grammar above. The same IPv4-first classification applies to `serverName`.

**[exclusion]** DNS trailing-dot forms, zone identifiers, IPvFuture,
percent-encoded hosts, and non-DNS `reg-name` values are outside revision 1.
They reopen only when exact target, certificate-reference, SNI, and authority
semantics plus demonstrated consumer need justify a new binding identifier.

**[pin]** `grpc` means plaintext HTTP/2 prior knowledge. `grpcs` means TLS 1.3
with ALPN `h2`. A bare authority supplies no transport default and requires the
`transport` configuration point before dispatch. A port number never implies
security.

**[configuration point]** `transport` is exactly `plaintext` or `tls` and is
legal only for a bare authority. Configuration cannot replace the target
authority or contradict an explicit scheme.

**[convention]** The effective dial target and HTTP/2 `:authority` are the
carried authority, including its port. They do not change during reflection or
application invocation and are not inferred from descriptor package names.

## 5. Descriptor construction and reflection

**[convention]** Embedded content constructs one descriptor pool under the
companion module and suppresses reflection entirely. A co-present `location`
still supplies only the service target.

**[pin]** Location-only resolution opens exactly one stateful bidirectional
`grpc.reflection.v1.ServerReflection/ServerReflectionInfo` stream per
transaction. Processor resolution queries the selected service symbol and its
transitive file closure. Synthesis first lists services and then resolves every
non-infrastructure service name returned by that transaction and its closure on
that same stream. Every `ServerReflectionRequest.host` is exactly the carried
authority, including the port and IPv6 brackets; `serverName` never changes it.

**[convention]** A processor-resolution transaction begins when resolution of
one selected binding first opens reflection and ends when that method closure
has resolved or refused. A synthesis transaction begins when synthesis first
opens reflection and ends only when the complete returned service-name
inventory and its closures have been represented or the synthesis transaction
has refused. Streams, deadlines, and descriptor accumulation never leak from
one such transaction into another.

**[pin]** Every response carries the exact outstanding request in
`original_request` and the expected response variant. The first response
establishes that stream's returned `valid_host`; a different value on a later
response is an inconsistent correlation and refuses the transaction.
Descriptor bytes already returned for that state may be suppressed by the
server, so the consumer accumulates the complete transaction state
([reflection service](https://github.com/grpc/grpc/blob/aae267021b1ac256f8b9038d0ef528c3798cc137/doc/server-reflection.md)).

**[pin]** Only an RPC-level `UNIMPLEMENTED` final status, or the exact mapped
HTTP condition that synthesizes it before a usable v1 result, restarts the
entire transaction on one v1alpha stream. An `ErrorResponse` whose
`error_code` is 12 is a query result, not a version signal. No other v1 failure
falls back.

**[configuration point]** `discoveryMetadata` applies only to reflection and
uses §10's exact name, value, multiplicity, normalization, and binding-owned
field exclusions. It is validated before the first reflection stream opens.
Application metadata is not replayed to infrastructure by implication.
Discovery and application share the target, transport, `:authority`, and TLS
identity, but the application deadline begins only when the application RPC
opens.

**[configuration point]** `discoveryTimeout` is absent or a positive logical
duration in the exact domain defined for `timeout` by §11. Absent discovery
timeout sends no `grpc-timeout`. When present, one discovery deadline begins
immediately before the v1 reflection stream opens and governs the whole
resolution or synthesis transaction: every query, response, descriptor
closure, and any v1alpha fallback. The v1 request encodes the configured
duration using §11's exact non-shortening algorithm; a fallback request encodes
the positive remaining duration by the same algorithm. Expiry cancels the
active reflection stream, refuses the transaction, and opens no application
RPC. A fallback never refreshes or extends the deadline.

**[pin]** Reflection request and response messages use identity compression in
revision 1. Reflection requests send neither `grpc-encoding` nor
`grpc-accept-encoding`; a compressed reflection response is a protocol failure.
Application `compression` and its response-coding advertisement never leak into
discovery, so resolution does not depend on a runtime compression capability.

**[limit]** No cross-transaction reflection cache is permitted in revision 1:
reflection exposes no validator that can prove descriptor identity before the
required request. Within one stream, the consumer retains returned descriptors
and tracks them per `valid_host`, as required for the server's permitted
descriptor suppression; that transaction-local accumulation is not a cache.

**[convention]** Descriptor files deduplicate by filename and semantic
identity. Conflicting same-name files, missing dependencies, malformed bytes,
unresolved symbols, and inconsistent reflection correlations refuse the
selected method at resolution and confine during synthesis.

**[exclusion]** The v1 and v1alpha reflection services are infrastructure and
are never synthesized as application operations. This exclusion reopens only
when demonstrated consumer need establishes reflection itself as an
application contract and a new binding identifier defines its selectors,
invocation semantics, and coverage separately.

## 6. Selector, target identity, and synthesis key

**[convention]** `selector` is REQUIRED and is exactly
`<fully-qualified-service>/<method>`. Service and method are Protobuf
identifiers joined by dots and one slash; leading dot, percent encoding,
whitespace, empty components, extra slash, and case folding are forbidden.

**[incorporated]** The selected target is the exact MethodDescriptor reached
through the descriptor pool. Its interaction cardinality is the pair of
`client_streaming` and `server_streaming` flags.

**[convention]** The HTTP/2 `:path` is exactly `/` followed by the selector.
No URI percent encoding, path normalization, or package aliasing is applied.

**[convention]** The synthesis operation key is the selector with its single
slash replaced by a dot. Protobuf identifiers cannot contain slash, so this is
injective over admitted selectors. A collision or non-Core-valid resulting key
is a synthesis refusal, never traversal-order renaming.

## 7. Caller-value correspondence

**[pin]** Caller request values and response output values follow the exact
companion-module input and output correspondence for the selected method's
input and output descriptors. Metadata, status, descriptor names, and protocol
facts never become operation values.

**[convention]** Unary and server-streaming accept one request value. If the
invocation supplies none, a default request instance is constructed. Supplying
more than one is a local refusal.

**[convention]** Client-streaming and bidirectional interactions accept zero
or more indexed writes followed by at most one input half-close. They open the
RPC at invocation start after resolution and channel establishment, before any
write; bidi output may therefore precede the first write.

**[convention]** Client-streaming and bidirectional methods have no initial
request value; only indexed writes become their streaming request messages.
Unary and server-streaming methods instead use one sole or default request
value and admit no write action.

**[convention]** An invocation-surface realization that exposes both an
initial `input` member and streaming write actions requires that initial member
to be absent for a client-streaming or bidirectional method. A present member
refuses before the application RPC opens.

**[convention]** A unary/server-streaming request conversion failure occurs
before the application RPC opens and refuses before dispatch. A streaming
write conversion failure occurs on an open RPC, rejects that indexed write,
cancels the stream, and completes unsuccessfully. Duplicate half-close,
write-after-half-close, or action-after-terminal is rejected locally and never
reaches the peer.

**[convention]** Each decoded response commits one output immediately in wire
order. Unary and client-streaming success requires exactly one response;
server-streaming and bidi success permits zero or more. A later failure never
retracts committed outputs.

## 8. RPC lifecycle and cardinality

**[convention]** One invocation opens at most one application RPC and this
binding performs no transparent retry, replay, or hedging.

**[convention]** Unary and server-streaming convert their sole/default request,
open the stream, send one message, and end the request stream. Client-streaming
and bidi open before their first write and end the request stream only upon the
caller's half-close.

**[convention]** Bidi is full duplex: request writes, response outputs, and the
input half-close may interleave subject only to their own order. Backpressure
may delay actions but cannot reorder accepted writes or committed outputs.

**[convention]** Caller cancellation sends HTTP/2 stream cancellation when a
stream is open and completes unsuccessfully. Cancellation before an application
stream opens has no application wire effect. Deadline expiry follows the same
terminal cancellation path.

**[convention]** Exactly one terminal condition closes the invocation. No
input acceptance or output occurs after final trailers, transport terminal,
caller cancellation, deadline expiry, or local fatal conversion failure.

## 9. Native request and gRPC framing

**[incorporated]** The application request is HTTP/2 `POST` with `:scheme` from
the effective transport, carried `:authority`, exact §6 `:path`, `te: trailers`,
and `content-type: application/grpc+proto` under the pinned
[gRPC protocol](https://github.com/grpc/grpc/blob/aae267021b1ac256f8b9038d0ef528c3798cc137/doc/PROTOCOL-HTTP2.md).

**[pin]** For both application and reflection requests, revision 1 omits
the optional `grpc-message-type` field. It permits an implementation-owned
`user-agent` for diagnostics: at most one such field with exactly one nonempty
value consisting of ASCII bytes `0x20` through `0x7e`.

**[convention]** The diagnostic `user-agent` presence and value
may vary between implementations; they are not binding inputs and cannot be
set through application or discovery metadata. Native request evidence records
the field when sent and validates these constraints, but cross-implementation
conformance does not require identical `user-agent` presence or value. Apart
from this diagnostic variation, requests emit only the Call-Definition fields
specified by this binding and the applicable configured custom metadata.

**[pin]** Revision 1 admits response-message media type
`application/grpc` or `application/grpc+proto`, compared under HTTP's
case-insensitive type/subtype rules, with no media-type parameters. Both mean
that each gRPC message payload uses the companion module's Protobuf binary
correspondence. `application/grpc+json`, `application/grpc+protobuf`, every
other custom suffix, a parameterized value, a missing value, or multiple
values supplies no decodable response-message representation in this binding.
No DATA message under such a value is decoded or committed as output. The
consumer retains that defect until final status is known: a received valid
`grpc-status` still governs under §11, but `OK` cannot make present
undecodable DATA successful; when status is absent, §11's HTTP-to-gRPC mapping
applies.

**[incorporated]** Each gRPC message is a one-byte compressed flag, a
four-byte unsigned big-endian message length, and exactly that many message
octets. HTTP/2 DATA-frame boundaries have no semantic relation to message
boundaries; a prefix or body may be split, and multiple messages may be
coalesced.

**[pin]** End-of-stream with an incomplete prefix or body, a compressed flag
other than 0 or 1, length overflow, decompression failure, or malformed
Protobuf completes unsuccessfully. A complete earlier response remains
committed.

**[convention]** Outbound conformance compares the five-byte prefix exactly and
the payload descriptor-semantically. It never requires one permitted
noncanonical Protobuf byte order, DATA segmentation, header-block ordering, or
gzip byte sequence.

## 10. Metadata and compression

**[incorporated]** Application and discovery metadata names are lowercase
ASCII and follow the pinned gRPC `Custom-Metadata` grammar. HTTP/2
pseudo-fields, names beginning `grpc-`, and the remaining Call-Definition
names `content-type`, `te`, and `user-agent` are unavailable to either metadata
configuration.
The exclusions reserve `grpc-timeout`, `grpc-encoding`,
`grpc-accept-encoding`, `grpc-message-type`, and every future `grpc-` name as
well as the pseudo-fields that carry method, scheme, path, and authority. A
`-bin` name carries binary values; every other admitted name carries ASCII
values. A collision is refused before the affected reflection or application
stream opens.

**[pin]** Those binding-owned-field exclusions govern the two outbound
metadata configurations. They do not make a received `user-agent` field
malformed: in a response-header or trailer block, `user-agent` is admitted as
ASCII `Custom-Metadata` and retained as inbound diagnostic metadata. It remains
unavailable to `metadata` and `discoveryMetadata`. Response `content-type` and
the request-only `te` field retain their protocol roles and are not
reclassified as inbound custom metadata.

**[configuration point]** `metadata` and `discoveryMetadata` are each an
ordered value sequence per case-insensitive name. Cross-name order is not
portable. HTTP field-line
grouping is not preserved: ASCII comma-joining is semantically equivalent to
separate fields only under the gRPC protocol's join rule, while binary joined
fields are split on commas before independent Base64 decoding. Corpus evidence
therefore compares normalized name groups and value order, including
comma-bearing ASCII and padded or unpadded binary Base64 cases.

**[convention]** The consumer retains received leading and trailing
`Custom-Metadata` as two separate native diagnostic collections. Within each
collection, lowercase names are emitted in Unicode-scalar order. All received
field values for one ASCII name are reduced to the protocol-equivalent single
comma-joined string in their semantic encounter order. All received field
values for one `-bin` name are first joined in encounter order, split at every
comma as the gRPC protocol requires, and decoded independently under the next
paragraph; the resulting octet sequences are retained in that order and, when
represented in JSON evidence, use canonical padded standard Base64. Leading
and trailing values are never merged, and neither collection becomes an
application output.

**[pin]** Each on-wire binary-metadata value, after comma splitting, uses the
standard RFC 4648 Base64 alphabet with no whitespace. Both the correctly
padded form and omission of all trailing `=` padding are accepted, but the
unused bits in the final alphabet character MUST be zero in either form. A
nonzero unused bit, impossible length, misplaced padding, or non-alphabet
character is not a second spelling of the same bytes and completes the
affected open stream unsuccessfully as a protocol failure. Outbound encoders
always set unused bits to zero.

**[configuration point]** `compression` selects only outbound request-message
compression and is exactly `identity` or `gzip`. Identity is default, sends no
`grpc-encoding`, and requires compressed flag 0. Gzip sends exactly one
`grpc-encoding: gzip`, compresses each message independently under RFC 1952,
and uses flag 1. A compressor context never crosses a message.

**[pin]** Revision 1's inbound application-response coding set is exactly
`identity` and `gzip`, independently of the outbound `compression` choice. The
application request sends exactly one `grpc-accept-encoding` field whose value
is `gzip`; `identity` is implicit and is not listed. A response flag 1 is legal
only with exactly one
received `grpc-encoding: gzip` and is decoded as one independently framed RFC
1952 member. A new decompressor is created for every compressed message. A flag
0 message is uncompressed even when the response declares `gzip`; the encoding
header establishes a context but does not require every message to use it.
Omitted or `identity` encoding with flag 1, any other or multiple encodings, or
corrupt gzip completes unsuccessfully.

## 11. Deadline and final status

**[configuration point]** `timeout` is absent or a positive logical duration
no greater than 99,999,999 hours. A larger value is refused before the RPC
opens because it has no non-shortening `grpc-timeout` representation. Absent
timeout sends no `grpc-timeout`. For a present value, inspect units in the
exact order `n`, `u`, `m`, `S`, `M`, `H` and select the first unit whose
ceiling-divided integer is at most 99,999,999; send that integer followed by
the unit. The ceiling is at least 1, and therefore never expires earlier than
the configured duration.

**[convention]** Application timeout begins when the application RPC opens.
Discovery uses its independent timeout. In the harness logical total order, a
valid final status committed before expiry wins; otherwise expiry cancels and
is terminal.

**[pin]** A normalized final `grpc-status` is exactly one ASCII decimal gRPC
status code from 0 through 16, without a leading zero, in trailers or a
trailers-only response. A received decimal value outside that range is
normalized to `UNKNOWN` as permitted by the incorporated authority. Code 0
(`OK`) is the only successful status, subject to response cardinality and
decoding. Every nonzero code is unsuccessful. The canonical status meanings
follow pinned
[`statuscodes.md`](https://github.com/grpc/grpc/blob/aae267021b1ac256f8b9038d0ef528c3798cc137/doc/statuscodes.md).

**[incorporated]** `grpc-message` and `grpc-status-details-bin` occur only in
the same terminal trailers or trailers-only header block as `grpc-status`.
Either field in an ordinary response-header block, including a nonterminal
block without `grpc-status`, is invalid placement and completes
unsuccessfully as a protocol failure. It is neither custom metadata nor a
diagnostic that can be deferred to a later final status.

**[pin]** A missing, duplicated, or syntactically malformed final status;
duplicated `grpc-message` or `grpc-status-details-bin`; malformed Base64 or
Protobuf in the details field; status details on an `OK` response; a present
`google.rpc.Status.code` that differs from the final `grpc-status`;
an HTTP/2-invalid header block that prevents reception of a final status;
HTTP/2 stream error; or transport closure before valid final status completes
unsuccessfully. Status-details decoding preserves
whether field 1 occurred on the wire before Proto3 defaulting: an absent code
field is allowed, and a present field must equal the received nonzero decimal
status before any permitted out-of-range normalization. When decoding the
binary field, both padded and unpadded RFC 4648 Base64 are
accepted under §10's exact standard-alphabet, padding, and zero-unused-bit
rule; padded and unpadded noncanonical aliases of the same bytes are rejected.
A single syntactically valid received `grpc-status` governs final status even
when the HTTP status or content type is not gRPC-valid. Only when `grpc-status`
is absent is the exact
[HTTP-to-gRPC mapping](https://github.com/grpc/grpc/blob/aae267021b1ac256f8b9038d0ef528c3798cc137/doc/http-grpc-status-mapping.md)
applied to synthesize unsuccessful status, never `OK`; an earlier invalid HTTP
observation therefore cannot terminate processing before the consumer has
determined whether a final `grpc-status` is present.

**[incorporated]** Invalid percent encoding or invalid decoded UTF-8 in a
single `grpc-message` never changes a valid final status into a protocol
failure and never discards the diagnostic. The consumer retains its exact raw
field value and may additionally expose either a
valid-prefix/escaped-suffix decoding or a decoding with replacement
characters, as the pinned gRPC protocol permits.

**[pin]** When duplication causes the protocol failure above, the consumer
retains every exact raw field-line value in received order. A single value
containing a literal comma remains one status message; `grpc-message` defines
no comma-list combination semantics.

**[convention]** Native leading metadata, trailing metadata, `grpc-message`,
and typed status details are diagnostic protocol evidence and not application
outputs. The selected method declares no result union for them.

## 12. TLS, credentials, transforms, and limits

**[pin]** TLS transport offers exactly ALPN `h2`, accepts only TLS 1.3, and
validates a certification path under RFC 5280 against the effective trust
anchors and TLS-server usage. Revocation checking is not required in revision
1; a consumer that applies it MUST disclose it as an implementation limit and
must not report a corpus pass whose fixture does not supply revocation facts.

**[pin]** Without override, an admitted §4 ASCII DNS target, after §4's
IPv4-first classification, supplies the RFC
9525 DNS-ID reference identity and its exact carried hostname, without port,
as the RFC 6066 SNI `HostName`; an IP target supplies IP-ID and sends no SNI.
The IPv6 brackets and every port are removed before reference-identity
verification. `serverName` is exactly a §4 DNS name, a §4 IPv4 literal, or the
unbracketed `IPv6address` carried inside a §4 IPv6
host, with no port; a trailing-dot DNS name, bracketed IP, zone identifier, or
other spelling is refused. It changes only certificate
reference identity and, when it is DNS after the same IPv4-first
classification, supplies the SNI `HostName`; an IP override sends no SNI. It
never changes the dial target, `:authority`, or
reflection `host`.

**[configuration point]** `trustRoots` replaces the default trust-anchor set.
`serverName` supplies the exact reference identity above. `clientCertificate`
and `clientPrivateKey` form one indivisible mutual-TLS identity; supplying only
one refuses before connection establishment. All four fields are legal only
when the effective transport is `tls`; supplying any of them for plaintext
refuses before connection establishment rather than silently ignoring it.

**[configuration point]** Application `metadata` and `discoveryMetadata` are
the only generic credential carriage in this revision. No bearer, Basic,
API-key, or generated authentication convention is inferred. A credential
without explicit metadata or TLS carriage is surfaced for consumer resolution.

**[convention]** This specification defines no context bindings at Core
transform positions. Transforms evaluate in Core's closed environment.

**[limit]** Implementations may declare finite descriptor, message, metadata,
stream-count, or buffering ceilings. A ceiling refuses before opening when it
is known then; otherwise it terminates the open interaction unsuccessfully.
It never truncates, rounds, drops, or reorders accepted data.

**[pin]** `maxOutboundMessageBytes` and `maxInboundMessageBytes` bound the
uncompressed serialized Protobuf message, excluding the five-byte gRPC prefix
and any compressed wire representation. The outbound size is the number of
octets produced by the companion module's binary encoder before optional gzip.
The inbound size is the number of octets in an identity payload or yielded by
gzip decompression before Protobuf decoding; decompression may stop as soon as
the next octet would exceed the ceiling. A message of exactly the configured
size is admitted, and the first message larger than it triggers the limit.

**[convention]** When a ceiling is reached after a reflection or application
stream has opened and before another terminal condition has closed it, the
consumer sends HTTP/2 `RST_STREAM` with `CANCEL` exactly once. The cancellation
closes the stream and the interaction completes unsuccessfully with the limit
as its cause; it is not reclassified as caller cancellation. A limit detected
after the peer has already closed the stream has no additional wire effect.

**[limit]** Connection pooling is permitted. TLS/channel establishment facts
belong to the effective channel context rather than being required once per
invocation. Conformance uses a fresh controlled channel whenever it asserts
exact establishment evidence.

## 13. Deterministic synthesis and coverage

**[convention]** Embedded synthesis inventories every admitted application
method in the descriptor graph in canonical order by selector. Reflection
synthesis inventories every admitted application method belonging to the
non-infrastructure service names actually returned by `list_services` in that
transaction. The reflection authority does not require a server to return a
complete list, so exhaustive reflection coverage is relative to that returned
name set and its successfully resolved closures, not to undisclosed live-server
methods. Both modes exclude the two reflection service method sets as
infrastructure.

**[convention]** Every represented method emits exactly one operation and one
binding to the source, with §6's deterministic key and selector. Input and
output schemas are the companion module's directional Core contracts for the
method types: every schema-valid input is convertible, and every successfully
converted output validates, while the companion module's portable caller
profile may accept more inputs and its printer may produce a narrower output
set. Cardinality changes interaction shape but never creates extra operations.

**[convention]** Coverage is exhaustive over the applicable §13 inventory and
canonically ordered by
`sourceIndex`, source-local descriptor owner, scope, operation key, and
binding selector using Unicode scalar lexicographic order. Every admitted
method or excluded/invalid/lossy/unsupported smallest owner appears exactly
once except a shared owner cited by several methods, which is recorded once per
affected method when operation attribution is necessary.

**[convention]** A method target's `sourceRef` is its exact selector. A
descriptor owner's `sourceRef` is
`file[<decimal UTF-8-byte-length>]:<filename>#<fully-qualified-symbol>`; an
owning field or enum value appends `/field:<decimal-number>` or
`/value:<decimal-number>`. A file owner ends at `#`. The length prefix makes
the spelling injective even when a filename contains `#`; Protobuf symbols do
not contain `#` or `/`. A location-only transaction uses the exact filenames
inside returned descriptors.

**[convention]** An invalid descriptor owner is `invalid`; a module or binding
exclusion is `excluded`; an unfaithful schema projection is `lossy`; and a
defined behavior missing from an implementation is
`implementation-unsupported`. None may be silently omitted or represented by
an unconstrained schema.

**[limit]** A source with zero application methods synthesizes an OBI with no
operations or bindings and exhaustive empty coverage. One defective method
does not erase a representable sibling.

## 14. Atomic conformance rules

- **GRPC-D-01** — `content` uses exactly one §3 representation and its load
  grammar; absent content selects reflection.
- **GRPC-D-02** — `location` is required and uses exactly §4's port-explicit
  target grammar.
- **GRPC-D-03** — `selector` is required and uses §6's exact service/method
  spelling.
- **GRPC-D-04** — module identity is not legal as `bindingSpec`, and gRPC
  content cannot silently select another protocol.
- **GRPC-P-01** — embedded descriptor construction, primacy, import closure,
  and smallest-owner confinement follow §§3 and 5.
- **GRPC-P-02** — stateful v1 reflection, exact request host, identity-only
  reflection compression, one transaction deadline, fallback, correlation,
  closure, no cross-transaction cache, and infrastructure exclusion follow §5.
- **GRPC-P-03** — selector resolution, target identity, and native path follow
  §6.
- **GRPC-P-04** — initial-input versus indexed-write domain, request
  input/default conversion, and conversion-failure phase follow §7.
- **GRPC-P-05** — unary lifecycle and exactly-one response success follow §§7–8.
- **GRPC-P-06** — server-streaming lifecycle, ordered outputs, and zero-or-more
  response success follow §§7–8.
- **GRPC-P-07** — client-streaming eager open, indexed writes, half-close, and
  exactly-one response success follow §§7–8.
- **GRPC-P-08** — bidi eager open and full-duplex interleaving follow §§7–8.
- **GRPC-P-09** — framing is message-oriented across arbitrary DATA chunks and
  malformed/truncated frames fail as stated in §9.
- **GRPC-P-10** — outbound request headers, path, prefix, and descriptor-aware
  payload meaning follow §9.
- **GRPC-P-11** — outbound application/discovery metadata grammar and
  binding-owned-field exclusion, inbound `user-agent` admission, separate
  leading/trailing diagnostic retention, canonical binary decoding, and exact
  normalized duplicate/join ordering follow §§10–11.
- **GRPC-P-12** — application identity/gzip negotiation and per-message
  compression follow §10.
- **GRPC-P-13** — timeout encoding and terminal deadline ordering follow §11.
- **GRPC-P-14** — response content type, final status, nonfatal malformed
  `grpc-message`, typed status details, invalid response, and HTTP mapping
  follow §§9 and 11.
- **GRPC-P-15** — outputs commit immediately and survive every later failure;
  native diagnostics never become output values (§§7, 11).
- **GRPC-P-16** — TLS version, path, identity, SNI, ALPN, trust, and mutual TLS
  follow §12.
- **GRPC-P-17** — cancellation and action-after-terminal behavior follow §8.
- **GRPC-P-18** — application/discovery credentials remain in their exact
  metadata or TLS carriage and transforms gain no context (§12).
- **GRPC-P-19** — declared safety-ceiling units and boundaries are exact and
  non-truncating, and a post-open limit closes the affected stream exactly once
  (§12).
- **GRPC-S-01** — embedded synthesis inventories every application method;
  reflection synthesis inventories every application method under the service
  names returned by that transaction; both exclude only the two reflection
  service sets under §§5 and 13.
- **GRPC-S-02** — operation key, binding selector, path identity, and
  cardinality follow §§6, 8, and 13.
- **GRPC-S-03** — input/output schema projection proves the companion module's
  directional input-minimum and output-maximum contracts without `{}` fallback
  (§13 and module §7).
- **GRPC-S-04** — coverage is exhaustive, canonical, and smallest-owner
  confined under §13.
- **GRPC-S-05** — for every service name returned by reflection, embedded and
  reflection synthesis produce the same method inventory when their resolved
  descriptor closures have the same meaning (§5 and §13).
- **GRPC-S-06** — bare-target transport requirements and explicit-scheme
  closure are emitted without stale configuration requirements (§4).
- **GRPC-S-07** — invalid/excluded/lossy/unsupported siblings never poison a
  representable method (§13).
- **GRPC-S-08** — empty and infrastructure-only graphs emit no application
  operations or bindings with exact coverage (§13).

## 15. Permitted variation and declared exclusions

**[incorporated]** HTTP/2 frame boundaries, ordering among regular fields only
where HTTP/2 and gRPC permit more than one order, HPACK state, equivalent
Protobuf serialization order, and conforming gzip byte choices may vary.
Normalized semantic observations in §§9–10 remove only those freedoms; they do
not remove message, metadata-value, or output order.

**[convention]** SDK API shape, channel pooling, scheduling, diagnostic prose,
and error wrapper types may vary while producing the same specified target,
wire behavior, values, and terminal disposition.

**[exclusion]** Resolver schemes, retries/hedging, gRPC-Web, Connect, JSON
transcoding, xDS, and service config remain excluded for the authority/need
conditions stated in §2. Any admission is a new binding identifier, not errata.

## 16. Normative references

- [OpenBindings Specification 0.2.0](../../openbindings.md)
- [OpenBindings Protobuf Correspondence Module](/binding-spec-modules/protobuf-correspondence/1)
- [Protobuf 36.1 source](https://github.com/protocolbuffers/protobuf/tree/f377bfefc5e2cfab68b816903c25b23e091c439d)
- [Protobuf documentation snapshot](https://github.com/protocolbuffers/protocolbuffers.github.io/tree/4b88f52a8f830d4b4fbdad161dee33618ebc617f)
- [gRPC v1.83.1 source](https://github.com/grpc/grpc/tree/aae267021b1ac256f8b9038d0ef528c3798cc137)
- [`google.rpc.Status` at gRPC v1.83.1](https://github.com/grpc/grpc/blob/aae267021b1ac256f8b9038d0ef528c3798cc137/src/proto/grpc/status/status.proto)
- [RFC 5234](https://www.rfc-editor.org/rfc/rfc5234)
- [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)
- [RFC 7540](https://www.rfc-editor.org/rfc/rfc7540)
- [RFC 8446](https://www.rfc-editor.org/rfc/rfc8446)
- [RFC 5280](https://www.rfc-editor.org/rfc/rfc5280)
- [RFC 9525](https://www.rfc-editor.org/rfc/rfc9525)
- [RFC 7301](https://www.rfc-editor.org/rfc/rfc7301)
- [RFC 6066](https://www.rfc-editor.org/rfc/rfc6066)
- [RFC 1952](https://www.rfc-editor.org/rfc/rfc1952)
- [RFC 4648](https://www.rfc-editor.org/rfc/rfc4648)
- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119)
- [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)
