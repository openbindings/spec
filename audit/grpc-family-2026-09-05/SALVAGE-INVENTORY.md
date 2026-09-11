# gRPC salvage inventory

## Finding

The existing 135-line gRPC candidate and its 11 processor / 5 synthesis
scenarios are a decision inventory, not a publication candidate. Retain its
sound topology; rewrite its normative architecture and evidence.

## Retain, with atomic restatement

- proposed identifier `openbindings.grpc@1`;
- one specification spanning a closed mixed Protobuf syntax/Edition domain;
- source modes for embedded `.proto`, embedded descriptor closure, and live
  reflection;
- required service address and content primacy;
- exact `<fully-qualified-service>/<method>` selector identity;
- complete unary, server-streaming, client-streaming, and bidirectional method
  cardinality;
- each caller value corresponding to one request message and each successful
  output value corresponding to one response message;
- final gRPC status classification and preservation of outputs committed before
  a later unsuccessful completion;
- application metadata remaining below the ordinary operation-value boundary;
- the absence of transform-position context bindings.

## Move to the shared Protobuf correspondence boundary

- accepted proto2, proto3, Edition 2023, and Edition 2024 descriptor semantics;
- `.proto` compilation and descriptor-graph construction;
- `FileDescriptorSet` validation, symbol resolution, and per-method transitive
  message closure;
- ProtoJSON input acceptance and canonical output rendering;
- `Any` and well-known-type handling;
- Protobuf-to-JSON-Schema synthesis and loss accounting.

The selector stays a gRPC rule even though it uses Protobuf symbol identity.
Binary Protobuf serialization, gRPC length-prefix framing, reflection,
metadata, status, deadlines, cancellation, compression, HTTP/2, and TLS stay
in the gRPC specification.

## Rewrite or remove

- Replace the old unlabeled prose with the six-label project provenance
  vocabulary and an exact Core 0.2.0 incorporation.
- Replace "canonical JSON form" for inputs: ProtoJSON parsing admits several
  spellings while output rendering has a canonical posture.
- Remove arbitrary target replacement. The carried source must identify the
  target without environment configuration; configuration may complete a bare
  target's transport or supply channel credentials, but must not silently
  select another service.
- Replace symbolic `peer.responseMessage` and `finalStatus` fixtures with a
  closed gRPC peer dialect and normalized native timeline.
- Remove generic credential-negotiation behavior from family conformance;
  retain only explicitly carried gRPC metadata and TLS identity semantics.
- Remove the claim that custom options can never affect marshaling. Define a
  closed accepted option/feature surface instead.
- Replace seven umbrella P rules with atomic D/P/S rules.
- Delete the sentence outsourcing deterministic synthesis: method inventory,
  operation identity, schema projection, exclusion, and exhaustive coverage
  are normative parts of this project specification.
- Remove `outputLocation` synthesis behavior unless and until the specification
  itself defines such a rewrite.

## Evidence debt in the old corpus

- D fixtures cannot carry exact hostile descriptor JSON text or invalid UTF-8.
- Processor format `@1` leaves `peer`, runtime, and observations open and has no
  causal action schedule.
- Existing Go and TypeScript tests branch on scenario IDs; they do not prove a
  general implementation.
- Existing peer behavior does not prove POST/path/header formation, the
  five-byte gRPC message prefix, binary Protobuf encoding, compression,
  half-close, cancellation, or terminal trailer semantics.
- Synthesis scenarios have no S-rule owners and pin method-only operation keys
  that collide across services.
- No portable evidence covers descriptor conflicts, reflection closure,
  cardinality violations, ProtoJSON edge cases, TLS, deadlines, compression,
  limits, or transport failure mapping.

## Stable publisher comparator

Publisher voice and structure come from the four completed OpenAPI candidates
at baseline commit `c5cbec60…`, especially the 3.2 document. In-flight AsyncAPI
work may inform apparatus design only after an exact accepted snapshot is
identified; dirty moving bytes are never precedent.

