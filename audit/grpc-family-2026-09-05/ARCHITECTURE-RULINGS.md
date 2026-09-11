# Native gRPC architecture rulings

This ledger records design decisions to be transcribed as provenance-labeled,
atomic rules. It is not itself normative.

## Target and address

- A governed source is service-addressed and always carries `location`.
- Accepted address spellings are closed and port-explicit: `grpc://` for
  plaintext, `grpcs://` for TLS, and a bare authority requiring a transport
  configuration choice before dispatch.
- DNS names have a closed ASCII label grammar with no trailing dot; IPv4 uses
  unambiguous dotted decimal and IPv6 uses bracketed RFC 3986 address syntax.
  Zone identifiers, IPvFuture, and non-DNS reg-names are excluded.
- RFC 3986's IPv4-first alternative is applied before DNS/reg-name handling. A
  canonical value such as `1.2.3.4` is an IP reference and produces no SNI;
  a dotted value that is not valid IPv4, such as `999.999.999.999`, may remain
  a DNS name only if it satisfies the binding's closed DNS grammar.
- Configuration cannot replace the carried target with another service.
- Resolver-specific gRPC target URI schemes are excluded in revision 1.
- Selector is exactly `<fully-qualified-service>/<method>` and the HTTP/2 path
  is exactly `/<fully-qualified-service>/<method>`.

## One invocation and four cardinalities

- One OpenBindings invocation opens at most one application RPC. The binding
  performs no transparent replay, retry, or hedging.
- Unary and server-streaming send exactly one request message. Absence of a
  caller input value selects the request type's default instance.
- Client-streaming and bidi accept zero or more caller writes until one input
  half-close.
- Client-streaming and bidi require the invocation's initial input member to be
  absent; indexed `write` actions are their sole request-message domain. A
  present initial value refuses before the application RPC opens.
- Client-streaming and bidi open at invocation start after source, selector,
  configuration, and channel resolution, before any caller write. A server may
  therefore produce a bidi output before the first write. Every streaming
  write conversion failure occurs on an open RPC and cancels it.
- Unary and client-streaming succeed only with exactly one response message;
  server-streaming and bidi admit zero or more.
- Response values commit in receive order. A later failure never retracts
  committed outputs.
- Bidi is truly full duplex: output may arrive while caller input remains open.
- A caller cancel propagates to the HTTP/2 stream and completes unsuccessfully.
- A local conversion failure before the RPC opens is pre-dispatch refusal; a
  later streaming conversion failure cancels the open RPC and completes
  unsuccessfully.

## Native request

- Method is POST; scheme/authority come from the effective channel; path is the
  exact selected method; `te` is `trailers`; content type is
  `application/grpc+proto`.
- Each message uses the five-byte gRPC prefix and one Protobuf binary message.
  HTTP/2 DATA frame boundaries have no semantic relationship to message
  boundaries.
- Outbound serialization bytes are not generally canonical. Conformance
  compares decoded Protobuf meaning plus exact framing facts, not arbitrary
  field/map order.
- Application metadata is a named configuration point with closed ASCII and
  binary representations. The portable value sequence for one name is
  retained, but HTTP field-line grouping is not: duplicate fields may be
  comma-joined upstream. Binary joined values are split before Base64 decode;
  ASCII joined-field equivalence and comma-bearing values are defined
  explicitly. Unstable cross-name HTTP field order is not portable.
- Application and discovery metadata cannot collide with HTTP/2 pseudo-fields,
  any `grpc-` name, or the binding-owned `content-type`, `te`, and `user-agent`
  call fields; collision refuses before the affected stream opens.

## Half-close, terminal state, and failure

- Unary/server-streaming request half-close follows their one request message.
- Explicit input half-close is legal once for client-streaming/bidi; writes
  after it fail locally and do not reach the peer.
- Exactly one terminal condition closes the invocation. No output is accepted
  after terminal trailers, transport closure, caller cancel, or deadline.
- A final valid gRPC status of zero is successful subject to response
  cardinality and decode. Every nonzero status is unsuccessful.
- Any syntactically valid, present `grpc-status` governs even when the HTTP
  status or gRPC response content type is otherwise broken. HTTP-to-gRPC status
  mapping is chosen only after the stream proves that `grpc-status` is absent.
- Invalid `grpc-message` percent encoding is nonfatal: the exact raw value is
  retained as diagnostic evidence, with only the upstream-permitted decoded
  companion forms varying.
- `grpc-message` and `grpc-status-details-bin` occur only beside
  `grpc-status` in terminal trailers or a trailers-only response. Leading
  placement is a protocol failure. Multiple `grpc-message` field-line values
  are also a protocol failure, while one value containing a comma remains one
  diagnostic value.
- `grpc-status-details-bin` is admitted only on non-OK status and decodes as
  the exact pinned `google.rpc.Status`. Malformed detail bytes fail; a code
  field that occurred on the wire must equal `grpc-status`, while absence of
  that proto3 scalar field is not treated as an asserted zero.
- Broken HTTP/gRPC responses, malformed framing, decompression failure,
  malformed Protobuf, response-cardinality violations, and missing/invalid
  terminal status follow one explicitly pinned mapping and complete
  unsuccessfully.

## Deadline

- Deadline is an optional semantic configuration point expressed as a
  positive duration, independently of any SDK clock API.
- No deadline means no `grpc-timeout` field.
- The specification pins one exact duration-to-header rounding/overflow
  algorithm and uses a logical clock in conformance.
- In a totally ordered observation, a committed final status wins if observed
  before expiry; otherwise expiry cancels the RPC and is the terminal cause.

## Compression and limits

- Identity is the default and never sets the compressed flag.
- Application RPCs advertise exactly `grpc-accept-encoding: gzip` and admit
  response identity and gzip only. Request compression is independently
  configured as identity or gzip; identity omits `grpc-encoding`, while gzip
  emits that exact coding and compresses each request message independently.
  A compressor context never crosses a message boundary.
- Reflection is identity-only: it emits neither `grpc-encoding` nor
  `grpc-accept-encoding`, and any compressed reflection response is a protocol
  failure. Application compression configuration never leaks into discovery.
- The request/response negotiation, compressed flag, decompression, and
  unsupported-encoding dispositions are closed. A received non-identity
  encoding establishes the available context; an individual flag-0 message
  remains uncompressed and is valid.
- Implementation safety ceilings are declared limitations, never truncation.
  An outbound message rejected before opening is pre-dispatch refusal; a later
  outbound or inbound limit failure cancels/fails the open RPC while committed
  outputs stand. The message ceilings count uncompressed serialized Protobuf
  message octets, excluding the five-byte gRPC prefix and compressed wire
  representation; exactly the declared ceiling is admitted. No universal
  numeric ceiling is invented without authority.

## TLS

- Plaintext and TLS are distinct effective transports; scheme spelling or a
  bare-target transport choice determines which.
- TLS uses a closed protocol floor, certification-path validation against
  configured trust anchors, service-identity verification, SNI for DNS names,
  and ALPN `h2`.
- Custom trust roots, server-name override, and mutual-TLS identity are
  semantic configuration points. Client certificate/key are an indivisible
  pair. `serverName` changes only the certificate reference identity and, when
  it is a DNS name, SNI. It never changes the dial target, HTTP/2 `:authority`,
  or reflection `host`; those remain the carried target authority. Without an
  override, a DNS target supplies the DNS reference identity and SNI, while an
  IP target supplies an IP-ID and no SNI.
- `serverName` is one unported, unbracketed admitted DNS or IP value. SNI is
  sent only for DNS, in ASCII without a trailing dot; literal IP never enters
  the RFC 6066 `HostName` field.
- The same IPv4-first classification used for targets applies to `serverName`;
  a canonical IPv4 literal selects IP-ID validation and never SNI.
- TLS-only configuration on a plaintext transport refuses before connection;
  it is never silently ignored.

## Reflection

- Embedded content suppresses reflection entirely.
- Location-only processing uses reflection v1 first and v1alpha only after an
  exact v1 `UNIMPLEMENTED` result.
- One resolution or synthesis transaction uses exactly one bidirectional
  stream of one reflection version. Every response must correlate by
  `original_request`, response variant, and `valid_host`; the transaction
  accumulates the server's stateful descriptor suppression on that stream.
- Every reflection request's `host` is exactly the carried authority including
  port and IPv6 brackets.
- RPC-level or mapped-HTTP `UNIMPLEMENTED` before a usable v1 result restarts
  the complete transaction on one v1alpha stream. A reflection
  `ErrorResponse` carrying code 12 is an ordinary query result and never a
  version signal.
- Reflection shares target, transport, and carried authority with application
  RPCs but has separately named `discoveryMetadata` and `discoveryTimeout`
  configuration. Application metadata is never replayed to infrastructure by
  implication, and the application timeout starts only when its RPC opens.
  Discovery metadata uses the same closed metadata grammar. One discovery
  deadline begins before v1 opens, covers every query and any fallback without
  refresh, sends the encoded remaining duration on fallback, cancels the active
  stream on expiry, and opens no application RPC.
- Cross-transaction reflection caches are excluded because reflection exposes
  no pre-request identity validator. Descriptor retention within the one
  stateful transaction is required accumulation, not a cache.
- Processor resolution asks for the selected service symbol and constructs its
  complete descriptor closure; synthesis enumerates services then resolves
  each service closure.
- File descriptors deduplicate by filename plus semantic identity. Conflicting
  definitions, missing dependencies, malformed descriptor bytes, and cycles
  receive explicit confined dispositions.
- The two reflection services are infrastructure and are not synthesized as
  ordinary application operations.

## Source carriage

- String content is exactly one UTF-8 `.proto` compilation unit named
  `source.proto`, compiled without filesystem, environment, network, or user
  include paths and with only the exact imports enumerated by the Protobuf
  correspondence profile.
- Ordinary object content is a strict ProtoJSON `FileDescriptorSet`.
- A disjoint tagged one-member object carries canonical-Base64 binary
  `FileDescriptorSet` bytes. No raw binary/string ambiguity is accepted.
- Absent content selects reflection. These three present/absent modes are
  frozen parts of the accepted domain.

## Synthesis

- Every admitted embedded method is inventoried exactly once. A reflected
  inventory is exhaustive over the service names actually returned in that
  transaction and their resolved closures; upstream does not promise a
  complete live-server service list. The two reflection-service method sets are
  explicit infrastructure exclusions, not a blanket exclusion of methods
  discovered by reflection.
- Canonical selector identity is the source reference and binding selector.
- Operation keys are deterministically derived from the fully qualified
  service and method using only Core name characters; collisions are refused,
  never resolved by traversal order.
- Inventory and coverage order are explicitly canonical.
- Every represented method emits an input and output per-value schema from the
  shared Protobuf correspondence, plus one binding to the carried source.
- Invalid/excluded/lossy/implementation-unsupported owners are confined to the
  smallest descriptor or method unit and exhaustively recorded. Unreachable
  descriptor defects do not poison siblings.
