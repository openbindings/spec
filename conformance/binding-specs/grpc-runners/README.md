# gRPC portable-apparatus runners

These runners independently validate the revision-7 gRPC
action/peer/timeline exchange and emit one byte-identical summary. They do not
prescribe a client API; they prove that the portable exchange itself has the
same executable meaning in Go and TypeScript.

Run both and compare them with:

```sh
node scripts/verify-grpc-binding-runners.mjs
```

The independent descriptor-and-synthesis witnesses are run with:

```sh
node scripts/verify-grpc-ds-witness.mjs
```

The Go and TypeScript witnesses adjudicate every `GRPC-D-*` document fixture
and independently synthesize every gRPC revision-7 synthesis scenario from its
source text, strict JSON descriptor set, tagged binary descriptor set, or
reflection transcript. Each computes method inventory, selectors, operations,
bindings, input/output schema facts, exclusions, and exhaustive coverage before
comparing with the corpus. Neither dispatches on scenario identity. The gate
currently covers 48 descriptor tests, 19 synthesis scenarios, 144 schema
instances, and 28 independently rejected mutants. It also proves that a
single-quoted import cannot escape the materialized 13-file virtual root and
rejects flipped validity, an include-root bypass, ghost and missing
method/binding, open or illegally keyed schemas, unbounded integer projections,
and wrong coverage-owner/status mutants.

The gate uses two layers. The compact exchange validators reject duplicate
scenario/peer-event identities, noncanonical Base64, action/result gaps,
multiple or mismatched terminals, noncontiguous outputs, invalid native length
evidence, and a raw DATA stream that ends in a partial gRPC frame without a
protocol-failure disposition. Independent Go and TypeScript semantic runners
then derive and compare the complete normalized timeline and native transcript
for all 163 scenarios. Targeted corpus mutations plus strict lexical probes must be rejected
by both runners. The processor path uses descriptor-driven companion conversion
for every source carrier, including packed/repeated values, maps, recursion,
oneofs, enums, WKTs, `Any`, aliases, range errors, and Edition custom enum JSON.
Additional accepted and rejected probes establish scenario-ID independence,
Protobuf last-singular/last-oneof merge behavior, duplicate-key refusal, exact
native-send ordering, and the integrity of raw outbound gRPC frames and
reflection requests. Outbound header evidence retains an implementation-owned
`user-agent` when one is emitted, permits exactly one nonempty printable-ASCII
value, and removes only that field for cross-runtime comparison. The same
evidence gate rejects duplicate or malformed User-Agent fields and any
application or reflection `grpc-message-type` header.

The same gate also runs a real-stack differential suite. The Go side uses
`grpc-go`; the TypeScript side uses `@grpc/grpc-js` and
`@grpc/proto-loader`. Each starts a loopback controlled server and executes
unary, server-streaming, client-streaming, and bidirectional RPCs, including
ordered messages, caller half-close, metadata carriage, final status, and an
UNIMPLEMENTED method. It also exercises one independently compressed unary call.
The independently observed summaries must agree after removing the runtime
label.

Two adjacent executable gates close facts that the JSON exchange cannot prove
by itself:

```sh
node scripts/verify-grpc-protobuf-compiler.mjs
node scripts/verify-grpc-protobuf-oracle.mjs
node scripts/verify-grpc-protobuf-values.mjs
node scripts/verify-grpc-tls-fixtures.mjs
```

The compiler gate requires the exact official Protobuf 36.1 macOS aarch64
release at `OPENBINDINGS_PROTOC_36_1_ROOT` (default
`/private/tmp/protoc-36.1`) and exercises proto2, proto3, Editions 2023–2026,
the Edition 2026 enum-JSON option, future-edition refusal, and profile
exclusions. It separately proves that proto2 caller extensions and Editions
`LEGACY_REQUIRED` fields are compiler-valid inputs whose correspondence must
therefore be excluded by the module rather than mislabeled as syntax errors.
The TLS gate uses the checked-in non-secret test CA and identities to exercise
TLS 1.3, `h2`, SNI, DNS-ID validation, trust failure, and mutual TLS over an
ephemeral loopback connection.

The value gate independently executes the same ProtoJSON, binary-semantic,
and schema-projection corpus with `google.golang.org/protobuf` in Go and
`protobufjs` plus an independently written strict correspondence adapter in
TypeScript. It covers field-name aliases, duplicate assignment, unknown
members, the portable canonical integer and Base64 input profile, float32 rounding and
underflow, signed zero, 32/64-bit limits, empty and nonempty bytes, typed map
keys and normalized-key collisions, recursion, enums, NullValue, well-known
types, nonfinite `Value` refusal, Unicode-scalar strings, `Any`,
equivalent/noncanonical wire encodings, malformed wire input, and the
input/output schema facts. Its 188-case deterministic corpus, targeted semantic
metamutants, and sealed 525-pattern binary32 bit grid must agree in both
implementations.

The oracle gate separately executes 47 closed-enum, map, surviving-UTF-8,
reflection-default, and malformed-wire cases through the pinned official
Protobuf 36.1 C++ implementation (42 accepted and 5 refused). Its sealed source,
case, result, and manifest roots prevent either portable adapter from becoming
the authority for binary parser behavior.
