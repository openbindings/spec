# Portable gRPC conformance apparatus

## Format decision

Use the project's next generic processor/synthesis envelope revision. The
current in-flight AsyncAPI work already assigns processor `@6`; because those
bytes are not frozen here, gRPC reserves generic processor/synthesis `@7`
rather than widening or redefining that token. A later merge may deduplicate
shared machinery without changing either already-assigned format meaning.

The generic envelope gains ordered caller actions, an ordered normalized
timeline, lossless JSON-value text, exact bytes assertions, alternative-level
rule ownership, and closed phase/disposition semantics. Only peer/native
dialects are family-specific.

## Caller actions

Closed actions are:

- `write` one request value;
- `await-output`;
- `await-native`;
- `half-close` caller input;
- `cancel` the invocation.

Actions have stable indexes. Native and peer events identify the action/event
boundary that causes them. Adverse actions remain executable test inputs:
`input-accepted`, `input-rejected`, and `action-failed` observations state their
indexed result. This permits valid tests for invalid streaming values,
duplicate half-close, write-after-close, and actions after cancellation. There
are no sleeps or wall-clock races.

## gRPC peer dialect

The closed peer dialect represents TLS/channel negotiation, one ordered initial
response-header block, ordered raw HTTP/2 DATA chunks with `endStream`, terminal
trailers or trailers-only response headers, RST_STREAM, GOAWAY, connection loss,
separate in-band reflection messages and reflection RPC status, and logical-clock
advance. Exact bytes use canonical Base64. Raw chunks can split the five-byte
prefix, split a body, coalesce messages, or end mid-message. A peer event is
triggered only by an already completed action/event identity; the verifier
proves a strict acyclic topological order and rejects every peer effect after
END_STREAM or another terminal event.

HTTP/2 DATA segmentation is peer stimulus but never a normalized semantic
output: the apparatus must catch implementations that confuse DATA frames with
gRPC message boundaries without turning a legal segmentation into portable
meaning.

## gRPC native timeline

The portable result records the ordered semantic timeline and a distinct native
transcript. The timeline uses closed action-result, RPC lifecycle, output,
status, diagnostic, cancellation, and terminal variants. The native transcript
records connection facts, complete application request headers, each exact sent
gRPC message frame, half-close/cancellation effects, and every reflection
stream/request. A reflection request includes its complete governed HTTP/2
header set and serialized `ServerReflectionRequest`; each peer
`reflection-message` includes the serialized `ServerReflectionResponse` plus a
closed normalized variant, while `reflection-status` carries only the RPC-level
terminal status. The verifier decodes the raw request/response bytes and rejects
contradictions in host, original request, oneof variant, descriptor values, or
service lists.

These normalized facts include only binding-governed observations: target,
transport/TLS facts, authority/path/request headers, ordered metadata,
compression, timeout, five-byte framing, complete message bytes and decoded
meaning, half-close/cancel cause, final status/provenance, and committed output
order. An implementation-owned outbound `user-agent` is retained as native
diagnostic evidence, validated as at most one nonempty printable-ASCII field,
and removed only for cross-runtime parity; other runtime headers, connection
IDs, logs, and SDK errors are excluded. `grpc-message-type` is rejected on both
application and reflection requests.

Normalized parity never requires equal noncanonical Protobuf serialization,
gzip byte streams, or cross-name HTTP field order. Each runtime emits the exact
frame it sent; the gate independently parses its five-byte prefix, verifies the
encoded length, enforces one complete gzip member when flagged, and compares the
decoded Protobuf payload. Runtime-varying frame bytes are removed only after
that proof. Metadata is compared by canonical name groups while preserving the
portable within-name sequence. Exact byte equality is used only for
peer-supplied bytes and authority-unique encodings.

## Semantic verifier

A separate verifier module validates:

- action/event chronology and exact terminal state;
- method cardinality and one-to-one input/output event accounting;
- write/half-close/cancel causality;
- framing length, complete consumption, compression negotiation, and
  per-message compressor context;
- descriptor-directed Protobuf decode and exact ProtoJSON mathematics;
- metadata grammar, duplicate/order preservation, and reserved collisions;
- deadline ordering and cancellation;
- reflection fallback and descriptor closure;
- TLS protocol/path/identity/SNI/ALPN facts;
- synthesis inventory, ownership, ordering, and rule closure.

The main binding verifier invokes this module and owns discovery/version
isolation, rule/section/citation coverage, corpus integrity, and hostile
mutation probes.

## Portable semantic qualification

Qualification artifacts are closed by schema, stable case/trial identifiers,
canonical sorted-JSON SHA-256 per trial, an exact manifest, exact verifier-owned
trial identity/count/root anchors, duplicate-key-safe parsing, and coordinated
artifact-plus-manifest deletion mutations.

Mandatory mutation families include field deletion/addition, wrong dialect,
action reorder/duplication, impossible output, write-after-close, unary count
violations, missing/duplicate final status, bad framing/length, compression
mismatch, wrong descriptor direction, lossy 64-bit handling, metadata collapse,
deadline race reversal, TLS substitution, wrong reflection fallback,
descriptor closure loss/conflict, rule-owner deletion, ID swap, and corpus
truncation.

The verifier obtains outbound request evidence from the controlled peer's raw
capture, never from an adapter's self-report. Semantic authoring shorthand, if
offered, compiles to checked-in raw vectors through an independent tool and is
verified against those vectors. The portable TLS fixture carries exact
certificate chains, trust anchors, key references, SNI/ALPN expectations, and
mTLS requirements; the peer's observed negotiation and client identity drive
the verdict. GOAWAY is normalized relative to the current RPC rather than by a
runtime-specific stream number, and channel/TLS tests use an explicitly fresh
harness channel.

The manifest hashes exact file bytes. Runtime interpretation uses
duplicate-member-safe parsing, and the value witnesses retain exact decimal
tokens where host numeric representations could lose information. Corpus
mutation probes independently reject duplicate JSON members; manifest closure
and the root-neutral verifier digest make a deleted, substituted, or ghost
apparatus file observable.

## D/P/S slices

1. descriptor loading, exact source discrimination, method inventory, and
   schema projection;
2. unary plaintext request/response and terminal status;
3. complete Protobuf/ProtoJSON scalar/composite/WKT matrix;
4. `.proto`, descriptor-set, and reflection parity;
5. server streaming;
6. client streaming;
7. bidirectional streaming;
8. metadata, compression, deadline, and declared limits;
9. TLS/security;
10. synthesis and Connect/shared-module seam.

Each slice begins with portable counterexamples and ends with the complete gate
set plus a frozen cold review. Unary is an internal slice only; publication is
blocked until all four cardinalities seal.

## Independent implementation gate

Go and TypeScript execute all 163 sealed processor scenarios without skips or
scenario-ID branches, emit canonical normalized transcripts, and agree per
scenario or satisfy an explicitly enumerated semantic alternative. Each also
runs an independent real-stack differential suite using grpc-go and grpc-js
across all four cardinalities, gzip, final status, and TLS/mTLS outcomes. The
descriptor/synthesis lane separately executes all four source modes and the
portable schema projection in both languages. The boundary matrix contains 177
schema and semantic mutants; the runner gate adds 99 full-corpus mutations and
normalized-evidence mutations for raw application frames and reflection
requests. Leading and trailing custom metadata are name-sorted, value-normalized,
and bound exactly to their peer header blocks, including binary comma splitting
and inbound `user-agent`. Descriptor-driven processor conversion is exercised end to end for
text, object-FDS, binary-FDS, reflection v1, and reflection v1alpha carriers;
native application and discovery sends are count- and position-bound to their
ordered timeline events. The common TypeScript value layer is used by both the
standalone value witness and the processor adapter; its corpus additionally
closes float32 rounding and underflow, signed zero, typed map-key normalization
and collisions, RFC JSON whitespace, Unicode-scalar strings, empty bytes,
direct NullValue, and nonfinite `google.protobuf.Value` output. The independently
sealed 188-case value corpus adds targeted metamutants and a deterministic 525-pattern
binary32 differential grid comparing the
official Go ProtoJSON implementation with the shared TypeScript companion layer
across scalar, map, presence, enum, WKT, `Any`, Unicode, JSON lexical,
binary-wire, and schema-projection categories.

The value gate also replays all 47 sealed official Protobuf observations and
derives 106 runtime checks directly from them. It compares typed values and
resolved retained-unknown material independently for each runtime, with exact
result-envelope closure and mutation checks. A source compilation refusal is
recorded separately; binary acceptance does not imply JSON representability.
