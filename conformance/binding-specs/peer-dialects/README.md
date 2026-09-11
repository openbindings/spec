# AsyncAPI revision-6/7 peer and native dialects

This directory defines the portable scripted-peer boundary used by processor
scenario formats `openbindings.binding-spec-processor-scenarios@6` and `@7`.
The JSON Schemas close the data shapes. This document closes scheduling, event
release, and normalization; neither an adapter API nor an implementation log is
part of the comparison surface. Unless the revision-7 HTTP scaffold section
says otherwise, the established rules below describe the revision-6/@1
exchange.

## Scheduling

Every scripted event has exactly one `after` trigger:

- `{"kind":"start"}` fires after the adapter has installed the script and
  immediately before it begins the invocation;
- `{"kind":"action","index":N}` fires after caller action `N` has completed
  at the operation boundary (an await action completes only after its barrier is
  satisfied); and
- `{"kind":"native","name":X,"count":N}` fires immediately after the
  timeline has recorded the `N`th native event named `X`.

Indexes are zero based and counts are one based. Events are released and their
mapped observations are recorded in array order, including when adjacent events
name different triggers. Releasing an event is synchronous from the harness's
point of view: the adapter must make the event available to the protocol peer
before advancing to a later peer event or caller action. One timeline occurrence
can satisfy only one peer mapping. A trigger
whose mapped peer observation does not occur later in the exact timeline, or
that cannot occur in every expected alternative, is invalid corpus data. An
`await-output` or `await-native` action is likewise invalid unless its cumulative
count is reachable in every expected alternative. These rules make the action
list a finite schedule rather than a set of timing hints.

The WebSocket `handshake` and MQTT `connection` records are installed before
invocation and consumed by the first connection attempt. They are not array
events and need no `after` member. Kafka has no implicit connection outcome.
Each peer script is exactly one lifecycle. A rejected or protocol-error
WebSocket handshake and every WebSocket Close, disconnect, invalid frame, or
invalid-text closure is terminal, so no later peer event is permitted. A
rejected MQTT CONNACK is likewise terminal. MQTT reconnect attempts increase
strictly within the script and are admitted only after transport loss or peer
DISCONNECT. Packet and subscription activity requires connected state; a
reconnect returns it to connected state. Starting a new script is the only
lifecycle reset.
An HTTP `before-request` disconnect uses `start`; every later `disconnectAt`
phase uses the HTTP `dispatch` native event as its trigger. The mapped close
occurs before dispatch for `before-request` and after dispatch otherwise.

## Normalized native observations

Each timeline `native` event is validated against the `*-native-1.schema.json`
file paired with the selected peer dialect. Fields not admitted by that schema,
including implementation diagnostics, are forbidden. Ordered header/property
arrays preserve duplicates. Every member whose name ends in `Base64` is the
canonical RFC 4648 Base64 spelling of the represented octets.

Peer events cause these normalized observations:

| Dialect | Peer fact | Native observation |
| --- | --- | --- |
| HTTP | final `response` | `acknowledgement`, with one terminal status from 200 through 599; revision 6 has no interim-response sequence |
| HTTP | `disconnect` | `connection-closed`, with `origin: "peer"` |
| WebSocket | accepted handshake | `connection-opened`, preserving status 101 and the raw ordered `Upgrade` value and `Connection` tokens, whose `websocket`/`upgrade` comparison is ASCII case-insensitive, plus the derived `Sec-WebSocket-Accept` and null/empty subprotocol and extension selections |
| WebSocket | rejected handshake | peer-originated `connection-closed`, with `clean: false`, `code: null`, and reason `handshake-rejected` |
| WebSocket | wire-expressible hostile 101 | peer-originated unclean `connection-closed` with reason `handshake-protocol-error:` followed by the exact wrong/missing Accept, subprotocol, extension, Upgrade, or Connection classification |
| WebSocket | text/binary/fragmented message | `delivery`; text is UTF-8, fragments are concatenated in order, and `fragmentCount` records the physical fragment count |
| WebSocket | invalid UTF-8 or protocol-invalid frame | peer-originated unclean `connection-closed`, using code 1007 for invalid text and 1002 for other frame violations |
| WebSocket | close | `connection-closed`, with the declared code/reason and `clean: true`; peer-originated 1010 instead maps to unclean code 1002 and reason `peer-close-1010` |
| WebSocket | disconnect | `connection-closed`, with `clean: false`, `code: null`, and an empty reason |
| Kafka | `produce-ack` | `acknowledgement`, with topic/partition/offset and boundary `broker-accepted` |
| Kafka | `record` | `delivery`, preserving topic, partition, offset, key, value, ordered headers, and redelivery flag; omitted key and headers normalize to `null` and `[]` |
| Kafka | `rebalance` | `subscription-opened`, with the declared topic and partition set |
| Kafka | `reconnect` | `reconnected`, with the declared attempt |
| Kafka | `disconnect` | `connection-closed`, with empty facts |
| MQTT 3.1.1 | accepted/rejected connection | `connection-opened` with `sessionPresent`, or peer-originated `connection-closed` labeled `CONNACK` with its `returnCode` |
| MQTT 5 | accepted/rejected connection | `connection-opened` with reason code zero, `sessionPresent`, and ordered CONNACK properties, or peer-originated `connection-closed` labeled `CONNACK` with the failure reason code and ordered properties |
| MQTT 3.1.1 | `puback`, `pubrec`, `pubrel`, `pubcomp`, `suback`, or `unsuback` | `acknowledgement`, using the corresponding uppercase packet type and packet identifier; `SUBACK` carries its granted QoS or `0x80` failure code and every other acknowledgement carries `grantedQos: null` |
| MQTT 5 | `puback`, `pubrec`, `pubrel`, `pubcomp`, `suback`, or `unsuback` | `acknowledgement`, using the corresponding uppercase packet type, packet identifier, reason code (defaulting to zero when omitted), and ordered MQTT 5 properties |
| MQTT 3.1.1 | `publish` | `delivery`, preserving packet id, topic, QoS, DUP, retain, and payload; QoS 0 has a null packet id and QoS 1 or 2 has the declared packet id |
| MQTT 5 | `publish` | `delivery`, preserving packet id, topic, QoS, DUP, retain, payload, and the ordered MQTT 5 properties |
| MQTT 3.1.1 | `reconnect` | `reconnected`, with attempt and `sessionPresent` |
| MQTT 5 | `reconnect` | `reconnected`, with attempt, `sessionPresent`, the complete non-secret effective reconnect CONNECT facts, and the new successful CONNACK's complete ordered properties |
| MQTT 5 | `disconnect` | peer-originated `connection-closed` labeled `DISCONNECT`, preserving reason code (including 161) and ordered properties |
| MQTT 3.1.1 or 5 | `transport-loss` | peer-originated `connection-closed` labeled `TRANSPORT-LOSS`; MQTT 3.1.1 has no broker DISCONNECT packet |

The ordered peer-originated observation list is an exact bijection with this
table: no mapped event may be omitted, duplicated, partially copied, reordered,
or supplemented by another peer-originated observation. The portable mapping
probes mutate every field and nested field of every row above.

Client-originated protocol activity is normalized by the same closed native
schemas. A WebSocket opening request records method, target, Host, the exact
`Connection: Upgrade`, `Upgrade: websocket`, `Sec-WebSocket-Key`, and
`Sec-WebSocket-Version: 13` facts, empty offered subprotocol/extension lists,
an optional Authorization value digest, and the ordered names/value digests of
API-key headers. `given.configuration.websocketHeaders` declares the exact
ordered name/value-digest evidence for every remaining ordinary binding header;
the opening request's required `headers` array must equal it with no dropped,
added, reordered, or altered header. An accepted response must carry the SHA-1-derived
`Sec-WebSocket-Accept` and may select no undeclared protocol or extension. A
Host or offered header value containing CR, LF, another HTTP control character,
or an API-key header name that is not an HTTP field-name token is invalid
corpus data. An `invalid-frame` stimulus supplies `fin`, `opcode`, `masked`,
and exact payload bytes; those facts must themselves prove its declared
invalid-UTF-8, unexpected-continuation, fragmented-control, or masked-server
violation. Invalid-UTF-8 proof is restricted to a final text frame, so an
incomplete prefix is never misclassified without streaming state. The label
alone is never evidence. Every text/binary dispatch requires open state, text
dispatch bytes must decode as fatal UTF-8, and no data/output/native activity
may follow handshake failure or terminal Close except the single matching
Close-handshake suffix. A
client Close is a `dispatch`; a clean local closure requires that earlier
boundary and preserves its wire-valid code and reason. MQTT CONNECT records
client id, version-specific `cleanSession`/`cleanStart` and keepalive facts,
credential-presence booleans, exact configured credential digests but never
credential values, plus MQTT 5 CONNECT properties. Password presence requires
username presence. A client DISCONNECT is likewise a dispatch and is required
before a client-disconnect local close only after `connection-opened`.
Cancellation or local transport loss may instead close while awaiting CONNACK,
without sending DISCONNECT. Only a peer-originated close participates in peer
mapping. An emitted HTTP request, WebSocket message,
Kafka record, or MQTT PUBLISH/control packet is `dispatch`; a peer-originated MQTT control packet is
`acknowledgement`; a successfully opened or closed subscription is
`subscription-opened` or `subscription-closed`; caller half-close and
cancellation propagation are `input-half-closed` and
`cancellation-propagated`. The profile specification, not the harness, decides
which of those events an interaction must produce.

MQTT requires a client CONNECT dispatch followed by an accepted CONNACK before
any broker packet, delivery, operation output, acknowledgement, or subscription
activity. Only a genuine refusal/cancellation path with no protocol interaction
may omit CONNECT. MQTT QoS and subscription control packets form state machines
keyed by packet identifier and direction. An outbound QoS 1 PUBLISH consumes the matching
PUBACK. An outbound QoS 2 PUBLISH consumes matching PUBREC, emits PUBREL with
the same identifier, and consumes matching PUBCOMP. In MQTT 5, a PUBREC reason
code of `0x80` or greater terminates that QoS 2 flow negatively; it never opens
a PUBREL/PUBCOMP stage. The inbound sequences are
the direction-reversed PUBACK and PUBREC/PUBREL/PUBCOMP exchanges. SUBSCRIBE
and UNSUBSCRIBE dispatches consume matching SUBACK and UNSUBACK packets. MQTT 5
SUBSCRIBE native facts retain the exact ordered property sequence. Every peer
SUBACK carries the associated topic filter, requested QoS, and ordered
SUBSCRIBE properties, and that evidence must exactly equal the preceding
native dispatch with the same packet identifier. A
subscription opens only after a successful SUBACK result in 0 through 2 that
exactly equals the requested QoS; a lower grant is an unsuccessful terminal
result, discards buffered publications, and emits no subscription boundary or
output. The normalized open topic/QoS equals the SUBSCRIBE dispatch and exact
result. A
subscription closes only after a successful UNSUBACK, preserving the active
subscription's exact topic/QoS; failure results create neither boundary. A
completed alternative cannot leave one of these flows pending, reuse an active
identifier in the same direction, change identifiers between stages, or skip
a stage.

Before SUBACK, inbound publications occupy arrival-ordered slots without
operation output. Topic-filter matching implements whole-level `+`, terminal
whole-level `#`, and the MQTT `$` rule: a filter not beginning with `$` does
not match a topic beginning with `$`. After an exact successful SUBACK, every
valid prior slot is emitted in order, then the interaction errors at the first
stored topic/QoS/buffer failure and never emits later slots. A stored failure
cannot silently complete. Protocol acknowledgement still precedes output or
stored failure, including buffer exhaustion. `mqttPreSubackBufferLimit` counts
complete admitted slots and may be zero. The first over-limit arrival records
the exhaustion marker and is acknowledged; after exact SUBACK, any admitted
prefix drains before that marker fails the interaction. An inbound QoS 2 retransmission received either before the
first PUBREC dispatch or while awaiting PUBREL has the same packet identifier
and staged facts with only DUP changed to one; every duplicate creates one
repeated-PUBREC debt without replacing or advancing state and the whole flow
can produce only one operation output.

Kafka offsets are signed 64-bit protocol integers but are exchanged as their
exact nonnegative decimal strings. This avoids silently rounding a legal offset
in a JavaScript or other binary64-backed harness; leading zeros, signs, values
above `9223372036854775807`, and JSON-number offsets are invalid corpus data.

## MQTT revision split

The one MQTT dialect token carries a required `protocolVersion`. Version
`3.1.1` forbids reason-code and property members. Version `5.0` uses distinct
closed property sets for CONNACK, PUBLISH, acknowledgement, and DISCONNECT
packets and packet-specific reason-code sets. A property that is singleton in
the MQTT packet may occur at most once; User Property remains ordered and
repeatable, and Subscription Identifier is repeatable only where the PUBLISH
profile admits it. Reconnect is a harness lifecycle fact, not an MQTT packet;
its MQTT 5 `properties` are the ordered successful-CONNACK facts for the new
connection, while MQTT 3.1.1 carries none. Adding a property kind, peer event, or
observation field incompatible with this contract requires a new peer-dialect
revision.

MQTT UTF-8 fields use Unicode scalar values and exclude U+0000. For a single
portable outcome across conforming brokers, this deterministic profile also
rejects the MQTT-specified control ranges and Unicode noncharacters rather than
depending on a receiver's permitted choice to reject them. The rule covers
client identifiers, topic names and filters, and every string-valued property;
credential values remain outside normalized observations.
Every applicable MQTT UTF-8 field is additionally limited to 65535 encoded
octets, and every MQTT Binary Data property to 65535 decoded octets. These are
wire-length limits, not JavaScript string-length or Base64-text limits.

For MQTT 5, `assigned-client-identifier` is admitted only when CONNECT supplied
an empty Client ID with clean start. Peer DISCONNECT cannot use client-only
reason 4. A peer Server Reference is admitted only with Use Another Server
(156) or Server Moved (157); a client DISCONNECT never carries it.
Client dispatch admits PUBACK, PUBREC, PUBREL, and PUBCOMP control packets but
never SUBACK or UNSUBACK; server acknowledgements admit all six in their legal
flow positions. Server DISCONNECT forbids Session Expiry Interval. A client
DISCONNECT cannot change the current connection's CONNECT expiry of zero to
nonzero; every reconnect replaces the value used for that check. CONNACK
Authentication Method is an exact optional-value match with CONNECT: an
offered method is required back with the same value, while no offer requires
the CONNACK method to be absent. Response Information requires CONNECT Request
Response Information=1. Client-originated
PUBLISH forbids Subscription Identifier, and every Response Topic is a Topic
Name without `+` or `#`.

Session facts are explicit at both ends of the handshake. MQTT 3.1.1 uses a
boolean `cleanSession`; an empty Client ID requires it to be true. MQTT 5 uses
a boolean `cleanStart`; a resumed session requires it to be false and a
nonempty Client ID. An empty MQTT 5 Client ID requires clean start and exactly
one `assigned-client-identifier` CONNACK property. CONNACK preserves
`sessionPresent` and all packet-legal ordered properties, including Session
Expiry Interval. Singleton cardinality, Authentication Data's dependency on
Authentication Method, and success/failure-specific property legality are
executable verifier constraints.
Every MQTT 5 reconnect boundary records the effective reconnect CONNECT Client
ID, clean-start and keepalive values, credential presence and exact digests,
and ordered CONNECT properties. The same assigned-identifier,
Authentication Method, Response Information, credential, and session
dependencies enforced for the initial CONNECT/CONNACK pair apply again. A
resumed session also requires the prior effective Client ID and a coherent
nonzero prior session lifetime. On reconnect, `sessionPresent: false` clears prior packet-identifier and
subscription flows, so a stale acknowledgement cannot complete them; it does
not revoke application values whose wire acknowledgement flow already made them
available. `sessionPresent: true` retains every expressible in-flight flow by
direction, packet identifier, and exact stage. Each retained inbound PUBLISH
must be redelivered with the same staged facts and DUP set before its client ACK;
each retained outbound QoS 1/2 PUBLISH must likewise be resent before its server
ACK. A retained outbound PUBREL awaiting PUBCOMP is replayed with the same
packet identifier, reason, and properties; PUBREL's fixed header flags are
always `0010` and expose no PUBLISH-style DUP fact. If a peer PUBREL had arrived
but client PUBCOMP had not been sent, a resumed session requires the same peer
PUBREL stage replay before the one PUBCOMP and one application output. No
lifecycle-global resume flag can discharge another packet identifier's debt.

MQTT 5 CONNACK capability properties establish effective per-network-connection
state and a reconnect's successful CONNACK replaces, rather than merges with,
the preceding connection's properties. CONNACK Receive Maximum constrains
simultaneous client-to-server QoS 1/2 PUBLISH flows. Conversely, CONNECT Receive
Maximum constrains simultaneous unacknowledged server-to-client QoS 1/2 PUBLISH
flows. Each current-connection quota charges a new or retained PUBLISH replay
and is replenished only by its terminal PUBACK, PUBCOMP, or MQTT 5 terminal
negative PUBREC boundary; a reconnect resets connection quota accounting but
not retained per-packet stage. The verifier also enforces Maximum QoS and Retain Available on client PUBLISH, and Wildcard
Subscription Available and Shared Subscription Available on represented
SUBSCRIBE topic filters. Subscription Identifier Available is recorded exactly
and forbids a later SUBSCRIBE carrying a Subscription Identifier when the
capability is zero. Successful subscription state records the identifier with
its exact topic filter. Peer PUBLISH identifiers must be caused by currently
active matching subscriptions; duplicate cardinality cannot exceed the number
of distinct matching active subscription generations that can cause the
supplied multiset. Remaking one exact filter starts a new generation and may
reuse any numeric identifier, including that filter's former identifier.

Topic Alias Maximum is directional and replaced on every connection: CONNACK
limits client-to-server aliases and CONNECT limits server-to-client aliases.
Alias zero and values above the opposite side's maximum are rejected, including
on retained retransmissions. Revision 1 keeps every PUBLISH topic nonempty, so
it never relies on alias state to reconstruct an omitted topic. Maximum Packet
Size is deliberately not admitted in the revision-1 CONNECT or CONNACK property
unions: the current normalized dialect has no exact full encoded-control-packet
length fact, and estimating one would make the limit non-binding. Supporting it
requires a future dialect revision that records authoritative encoded lengths
for every applicable control packet and enforces the opposite side's limit.

For QoS 1/2 PUBLISH, every newly allocated packet-identifier flow has DUP zero.
DUP one is tied to the same retained/retransmitted packet identifier and staged
PUBLISH facts; changing identifiers cannot create a fresh duplicate flow. The
same identity rule applies in both client-to-server and server-to-client
directions, while the separately specified in-connection QoS 2 retry remains
valid only against its already-active packet identifier. Retained identity does
not freeze every MQTT 5 property: Message Expiry Interval must retain presence
and may only decrease, Topic Alias may be removed or replaced under the current
connection's directional maximum, and peer-originated Subscription Identifier
multisets may evolve as the active matching subscription set evolves.
Subscription Identifier order is immaterial and duplicate cardinality is
preserved. For each remade matching filter, every retained PUBLISH flow may
carry the last actually observed identifier or the new current identifier until
any PUBLISH in the same correlated session interpretation observes the current
one. That observation retires the old identifier for the filter generation
across every retained flow; an unobserved intermediate generation does not
replace the carried identifier. Another active matching subscription may still
independently cause the same numeric identifier. Thus old-then-current is
valid, current-then-old is not within that correlated interpretation, and
explicit `1 -> 2 -> 1` filter generations are valid. A successful unsubscribe removes
active membership but does not reset that filter's generation counter while
retained flow state remains; a successful resubscribe starts the next
generation. An empty identifier multiset is invalid when every active matching
subscription has an identifier, and is permitted when at least one matching
subscription has none. Causality and transitions are tracked per successful
topic-filter subscription generation, not inferred from PUBLISH values alone.
Packet identifier and stage, topic, QoS, retain, payload, and
all other direction-applicable ordered properties remain exact; a client
PUBLISH still cannot carry Subscription Identifier.

The old/current no-reversion frontier is session/server state keyed by topic
filter and subscription generation, not private state of one retained PUBLISH.
Observing a generation's current identifier on any PUBLISH retires its old
identifier across every retained flow in that correlated interpretation. When
overlapping subscriptions make an identifier multiset ambiguous, the processor
retains every viable global correlated state together with its per-flow
assignments. Each PUBLISH advances all compatible states through every
injective assignment of identifier occurrences to distinct matching
subscriptions, then deduplicates equivalent states. It rejects only when no
correlated state survives. Filter insertion order therefore cannot select an
interpretation, and merging alternatives into an over-permissive union is not
conforming. An explicit later subscription remake starts the next generation
and its new frontier.

On every resumed session, retained outbound PUBLISH flows that still await
PUBACK or PUBREC form a resend queue ordered by their original client send
ordinal. A DUP PUBLISH replay consumes only the queue head, including when the
current CONNACK Receive Maximum forces serialization. Retained PUBREL replays
remain governed by their distinct QoS 2 stage and are not placed in that
PUBLISH resend queue.

Across simultaneous flows, client PUBACK dispatches consume a QoS 1 queue in
peer PUBLISH receive order and client PUBREC dispatches consume a separate QoS
2 queue in peer PUBLISH receive order. There is no relative ordering constraint
between PUBACK and PUBREC. Client PUBREL dispatches consume a third queue in
peer PUBREC receive order. The queues survive a resumed MQTT session
through the retained per-flow stages and are cleared with discarded session
state; one packet identifier cannot discharge another flow's order debt.

WebSocket Close scripts describe a wire-valid RFC 6455 control frame. A
wire code is one of 1000-1003, 1007-1011, or an application/private code
3000-4999; reserved no-status codes and the unallocated 1012-2999 range are
rejected. A client may dispatch 1010. A server-originated 1010 is admitted as a
wire-expressible hostile stimulus and normalized to protocol-error closure,
not rejected as corpus shape. The reason is Unicode scalar-value text whose
UTF-8 encoding is at most 123 octets, leaving two octets for the status code
inside the 125-octet control-frame limit. Invalid UTF-8 text, unexpected
continuations, fragmented control frames, and masked server frames are likewise
executable hostile peer inputs that normalize to closure evidence.

## Revision-7 HTTP scaffold

Processor and synthesis scenario revision 7 are reserved to the AsyncAPI 3.1
family. C20A stages HTTP evidence structure only: it does not qualify
certificate paths, HTTP message semantics, or an AsyncAPI HTTP profile. The
existing HTTP peer/native `@1` schemas are byte-for-byte locked. Processor
revisions `@1` through `@6` reject HTTP peer/native `@2` and the exact new
runtime/native vocabulary by both schema and manual checks; other historic
open configuration stays open. Revision 7 rejects HTTP peer `@1` while
continuing to admit the existing WebSocket, Kafka, and MQTT `@1` dialects and
their established configuration shapes.

`asyncapi-http-peer-2.schema.json` is closed. Its `transport` is exactly
`cleartext` or `tls`. TLS requires a `tls` object with a nonempty leaf-first
`serverCertificateChainDerBase64` array and nonempty opaque
`serverPrivateKeyCapability`; selected client authentication additionally uses
exactly `requireClientCertificate: true` and one
`clientTrustAnchorsDerBase64` member. The TLS stimulus independently records
the fixed client TLS-version offer `["1.3"]`, observed SNI or `null`, the
ordered ALPN offer `["http/1.1"]`, and server TLS/ALPN selection or `null`;
these are wire facts, not truth labels. A null server TLS selection requires a
null ALPN selection. In a TLS script, any `response-head` or `body-chunk`
requires the successful pair TLS `"1.3"` and ALPN `"http/1.1"`. The same is
true of a disconnect at `during-request`, `before-response`, or
`during-response`, and any disconnect triggered by `dispatch` or
`request-started`, `acknowledgement`, or `delivery`. An empty event list and a
`during-tls` disconnect without a request/activity trigger remain available
without either selection. Cleartext forbids
`tls`. `events` is an
ordered array of closed `response-head`, `body-chunk`, or `disconnect` records
and may be empty for a local TLS failure or pre-request cancellation. Each
response head says `httpVersion: "1.1"`, status, ordered field lines, and an
exact start/action/native trigger. Body chunks carry canonical Base64 octets;
disconnect records the exact connection/request/response stage.
The scaffold chronology admits repeatable interim heads, one final head and
subsequent chunks, or terminal 101/disconnect, and rejects activity after a
terminal event or a second final head.

`asyncapi-http-runtime-2.schema.json` is the closed revision-7 AsyncAPI HTTP
configuration. It contains optional closed string maps `serverVariables` and
`channelParameters`; `http.query` and token-named `http.headers` string maps;
two exact security layers, each either anonymous with `alternativeIndex: null`
or a nonnegative unrenumbered alternative index plus a kind-discriminated
`basic`, `bearer`, `api-key`, or `x509` credential; and optional `tls`. TLS has
exactly one canonical-Base64 trust anchor and a canonical nonnegative decimal
`validationTimeUnixSeconds`. A client certificate chain is nonempty,
leaf-first and paired with one nonempty opaque private-key capability. This is
harness configuration, so credentials may occur here; normalized observations
remain secret-safe.

`asyncapi-http-native-2.schema.json` closes each native event independently.
The union is `connection-attempted`, `connection-opened`, `request-started`,
`dispatch`, `acknowledgement`, `delivery`, `connection-closed`, and
`cancellation-propagated`. HTTP is exactly version 1.1. TLS facts preserve the
reference identity, SNI, exact TLS/ALPN offer or selection, configured time and
ordered certificate SHA-256 digests; no raw certificate key or private-key
capability is observable. TLS `connection-opened` admits an ALPN selection of
exactly `"http/1.1"` or `null`; `request-started` carries the exact boundary
sentinel `octetsSentDecimal: "1"`. Dispatch preserves raw method/scheme/authority/path,
ordered public or credential query/header contributions, whole origin-form and
header-block SHA-256 digests, and a closed body fact: exactly
`{kind:"absent"}` or `kind:"present"` with content type, canonical decimal
octet length, and lowercase SHA-256. Response chunks remain separate delivery
facts. Credential contributions are identified only by
`(securityLayer, alternativeIndex)` and carry exact component/field-line
digests, never the credential value. Every digest is lowercase 64-hex.

The tracked [`processor-v7.json`](../harness-probes/processor-v7.json) scaffold
contains exactly 50 cases: 14 accepted and 36 rejected. Its sibling schema,
exact ID set, disposition counts, canonical content root, and the raw hashes of
both HTTP `@1` schemas and all five new scaffold files are verifier-owned.
Mutations cover deletion, duplicate identity/content, same-ID replacement,
unknown fields, noncanonical Base64/digests, raw-secret/private-key leakage,
runtime typos/observation fields, security-alternative closure, body and ALPN
shape, the request-started boundary, passive TLS stimuli, dialect mismatch,
HTTP `@2` under open `@1` and `@6`, HTTP `@1` under `@7`, new runtime/native
data under older formats, and processor/synthesis `@7` under a legacy family.
Independent schema/manual and repair-to-valid mutations cover TLS/ALPN
selection correlation and pre-`@7` `serverVariables`, `channelParameters`, and
the new server/operation security-layer shape while retaining historic
OpenAPI security configuration. A separate ordinary revision-1 case prevents
that layered-security guard from depending only on the revision-5 exception.
Processor-shaped hostile HTTP `@2` scripts prove generic dispatch cannot bypass
the two-final-head or body-before-final chronology checks. Repair metamutants
prove that the digest, raw-secret, and private-key defects in 08/09/10 are each
sufficient.
The TLS DER strings in this scaffold are shape-only placeholders; no case
asserts that they form a valid certificate or path.

## C20B14 deterministic TLS and HTTP qualification

C20B remains apparatus qualification: HTTPS is still unrepresented, and this
batch adds no family D/P/S rule. The fixed test-only
[`processor-v7-tls-assets.json`](../harness-probes/processor-v7-tls-assets.json)
contains exactly 46 RSA-2048 certificates and matching PKCS8 capability keys. In
addition to the original roots, intermediate, server, and client leaves, the
closed inventory includes no-Key-Usage and keyEncipherment-only TLS leaves,
wildcard and IPv6 SAN leaves, CA-false and missing-keyCertSign intermediates,
a path-length-exhaustion chain, same-subject/wrong-key issuer, unknown-critical
leaf, DNS and IPv6 permitted/excluded Name Constraints, concrete/any-policy,
policy-mapping, explicit-policy, mapping-inhibit and any-policy-inhibit paths,
and independent client validity/Key-Usage/path witnesses. Private-key octets exist only in this
harness asset. Portable subjects and normalized evidence use opaque
`c20b-key-*` capability tokens or certificate SHA-256 digests; neither the
verifier's diagnostics nor any normalized observation contains private-key or
credential bytes.

The verifier uses Node's `X509Certificate` only for certificate/signature and
public-key primitives plus a small repository-owned DER reader for Basic
Constraints (including path length), extension criticality, Key Usage,
Extended Key Usage, DNS/IPv4/IPv6 Subject Alternative Name, Name Constraints,
Certificate Policies, Policy Mappings, Policy Constraints, and Inhibit Any
Policy. DER is fully
consumed, duplicate extensions are rejected, and an unknown critical extension
is never ignored. The repository-owned fixed-input RFC 5280 path processor
uses the C19A validation inputs: `{any-policy}`, mapping inhibit false,
explicit policy false, any-policy inhibit false, universal permitted subtrees,
and empty excluded subtrees. It consumes carried constraint/policy extensions,
applies permitted/excluded DNS/IP subtrees and path counters, rejects anyPolicy
mappings, and enforces explicit, mapping-inhibit, and any-policy-inhibit
transitions. It
derives the unique leaf-first path to exactly one explicit self-signed anchor,
RSA-2048/PKCS8 public-key matches, inclusive validity at an arbitrary-precision
decimal time, TLS 1.3 digitalSignature when Key Usage is present (absence is
valid; keyEncipherment alone is not), serverAuth/clientAuth, ASCII-insensitive
DNS-ID with single-label wildcard matching, exact IPv4/IPv6 IP-ID without CN
fallback, exact lowercase DNS SNI with no IP SNI, TLS 1.3, and HTTP/1.1 ALPN.
It never invokes a platform OpenSSL/path validator, `checkHost`, or `checkIP`,
and never consults ambient roots, time, revocation, or the network.

[`processor-v7-tls-semantics.json`](../harness-probes/processor-v7-tls-semantics.json)
contains exactly 191 portable cases: 43 accepted and 148 rejected, split into
54 TLS/path cases, 54 secret-safe security/dispatch cases, and 83 HTTP
response/framing/chronology cases. They cover both validity boundaries,
trust/path/order/name/EKU/KU/key/critical-extension failures, wildcard/IPv6,
mTLS, version/SNI/ALPN, Basic,
Bearer, supplied OAuth/OIDC bearer tokens, query/header API keys, X509,
coincidental public bytes, provenance leaks, contribution identities and
digests, derived Host, global UTF-8 byte ordering across public and credential
sources, full-set destination uniqueness, exact unrenumbered security
alternative identity, interim/final responses, HEAD and payloadless statuses,
arbitrary-precision Content-Length, framing failures, cancellation, and
an explicit peer/native FSM with mandatory attempt/open/request/dispatch,
acknowledgement correspondence, delivery/output causality, exact uppercase
method admission, response-stage disconnects after prior interim
acknowledgements, post-framing disconnect output preservation, one terminal
outcome, cancellation propagation, and no retry. Public artifact and caller
inputs are structurally separate from credential configuration; the verifier
derives contributions rather than trusting a provenance label. Query names and
values must round-trip through the repository UTF-8 encoder with only literal
unreserved octets and uppercase percent octets; percent-encoded unreserved
bytes are rejected. Query contributions preserve those encoded records but are
globally ordered by the UTF-8 bytes of each decoded canonical exact name; the
portable crossover cases distinguish this rule from sorting encoded spellings.
Before any UTF-8 encoding, comparison, digest, percent encoding, or field-line
construction, every contributing string must be a well-formed Unicode scalar
sequence. The portable JSON never embeds an isolated surrogate. Instead its
closed mutation leaf `{format:"openbindings.utf16-code-units@1",codeUnits:[...]}`
is materialized in memory only after fatal UTF-8 decoding, duplicate-safe JSON
parsing, closed-schema validation, and a recursive scalar-only artifact check.
Every response event first exposes the envelope chronology decidable from its
kind, status, index, and the prior accepted state. Thus body-before-final,
multiple-final, status-101, interim-after-final, and after-terminal evidence is
not hidden by malformed fields or Base64. Each head then independently checks
status range, field grammar, every `Content-Length` decimal and its cardinality,
forbidden framing fields, interim/payloadless restrictions, Content-Type, and
Connection semantics before any state transition. Only a single canonical
arbitrary-precision decimal can become a framing length. A malformed or
after-terminal event cannot become a response head, append body octets, or
change terminal state. Post-terminal events still expose both their chronology
violation and every locally decidable field/body violation. The mutation suite
checks the envelope/local and post-terminal/local predicates in both guard-
suppression orders. The exact mutation matrix contains 44 cross-lane pairs,
including 18 post-terminal pairs covering every locally decidable response
guard. Three additional schema/manual repair probes reject response status
values `99`, `600`, and `200.5` and restore each to integer `200`.
Acknowledgement ownership is the
exact peer-head-prefix correspondence plus dispatch/native-suffix chronology;
there is no separate acknowledgement-order guard or state.
The manifest hashes that portable form. Node, Go `encoding/json`, and a strict
command-line parser must accept the committed JSON unchanged. Materialized
isolated high or low UTF-16 surrogates are rejected before they can reach a
replacement-byte encoder. U+FDD0 and U+10FFFF remain valid Unicode scalar
values and are directly accepted in path/query/header derivation. Portable
cases distinguish a genuine U+FFFD query name from an unpaired surrogate and
cover credential, request-header, and response-header boundaries. Destination
uniqueness is checked against both decoded names and canonical emitted wire
names.
Header
contributions are globally ordered with derived `Host` first, then by
ASCII-lowercased name UTF-8 bytes with exact-name bytes as the tie breaker;
locale and provenance never affect order. A selected X509 alternative requires
HTTPS plus an independently verified mTLS client path/capability and contributes
transport identity only; conversely, supplying a TLS client certificate
configuration without selecting X509 is rejected. Local cancellation and peer
terminal stimulus are mutually exclusive because the artifact has no
cross-stream ordering surface. A response-stage cancellation may follow an
ordered interim-response acknowledgement prefix and then requires exactly one
close and terminal error. Its
closed schema and canonical case manifest are protected by exact IDs/counts,
per-case hashes, stable expected violation identities, explicit one-operation
repair-to-valid patches and actual named semantic-guard suppression checks.
There is no violation-code dependency filter: disabling a guard records that
the predicate executed but does not activate its failure state; traversal
continues, and a later check is skipped only when its own concrete derived
input is locally unavailable. Query evidence, header evidence, origin digest,
header-block digest, native dispatch shape, every individual response field,
final framing, peer disposition, delivery, output, and terminal lifecycle are
independently evaluable lanes. Framing consumes only the locally available
fields it requires; an invalid unrelated field in the same final head or an
interim head cannot mask valid final framing facts. Final status and Reply
selection establish output cardinality without waiting for framing, while
terminal cardinality, cause, outcome, and close checks run before branch-local
chronology checks. A missing delivery therefore cannot mask output or terminal
disposition. Attempt cardinality is aggregate, while unique concrete
open/request-start/dispatch positions remain locally checkable despite an
unrelated missing or extra attempt. Native acknowledgements always equal the
exact observed peer response-head prefix, including an incomplete prefix; a
trace with no final response admits neither delivery nor output. Cross-stage
double-fault controls in both suppression orders cover signature with expiry,
signature with leaf Key Usage, Key Usage with DNS-ID, Basic username grammar
with header-block digest, request-header scalar validity with query evidence,
response-field scalar validity with native attempt, same-final and interim
field scalar validity with final framing, Content-Length syntax and mismatch
with terminal/output obligations, body Base64 with terminal outcome, attempt
and delivery order with terminal outcome, attempt cardinality with dispatch
order, incomplete peer disposition with wrong acknowledgement/delivery/output,
delivery with output cardinality, delivery cardinality with terminal outcome,
and HTTP framing with lifecycle;
verifier-owned
artifact roots, raw file hashes, and
deletion/duplicate/replacement/reassociation/disposition/key/DER/semantic-guard
metamutants. All six apparatus artifacts must be regular non-symlink files
whose realpaths remain under `harness-probes`. A second root hashes sorted
records `relative-path NUL regular NUL four-digit-octal-mode NUL file-sha256 LF`,
binding file type, mode, and bytes; a symlink-substitution metamut is required.

## Qualification

[`../harness-probes/processor-v6.json`](../harness-probes/processor-v6.json) is
the portable qualification input for this exchange. The repository verifier
and every external conformance adapter must execute its passing and failing
matcher observations, exact positive and negative mapping cases, and valid and
invalid HTTP, WebSocket, Kafka, MQTT
3.1.1, and MQTT 5 peer scripts. They must also execute the tracked scenario
trials, which distinguish sequential caller actions from a set of hints, bind
peer facts to complete normalized events, enforce trigger causality, separate
MQTT revisions, preserve mathematical JSON values, and keep revision-6
vocabulary out of legacy formats. Passing only the repository's own scenarios
is not adapter qualification.

The main qualification input's required `semanticCasesFile` names the versioned
[`../harness-probes/processor-v6-semantics.json`](../harness-probes/processor-v6-semantics.json)
sibling. It is part of the same portable exchange, not verifier-private test
data. Adapters must execute every accepted and rejected subject with its named
validator: MQTT packet-flow chronology, MQTT connection chronology, peer-script
validation, or native-event schema validation. The sibling is closed by
`processor-v6-semantics.schema.json`; its Gate-C4 through Gate-C13 stable
case/trial IDs and exact case/accepted/rejected/trial counts are deletion- and
coverage-locked by the repository verifier. Its required
`processor-v6-semantics.manifest.json` sibling hashes each complete trial
(case ID, validator, expectation, trial ID/name/subject) with
`openbindings.sorted-json-sha256@1`: recursively sort object keys, preserve
array order, serialize as UTF-8 JSON with no insignificant whitespace, then
apply SHA-256. External adapters can verify the same content before execution;
the repository also mutation-checks omitted/gutted/swapped trials, duplicate
IDs or content, validator/subject mismatches, and coordinated artifact plus
manifest deletion.

The manifest source is parsed losslessly before ordinary JSON decoding, so a
duplicate member at the root or inside an entry object is invalid rather than
being resolved by last-member-wins behavior.

The repository verifier additionally owns the exact canonical manifest root,
the exact counts, and the complete trial-ID set. To update the qualification
set, edit the portable artifact, regenerate every manifest trial hash with the
algorithm above, review the semantic change, then update the verifier root,
counts, and ID set in the same change. External adapters need only the
self-contained artifact, schema, manifest, and manifest schema; the
verifier-owned anchor prevents a coordinated local deletion from silently
weakening repository qualification.
