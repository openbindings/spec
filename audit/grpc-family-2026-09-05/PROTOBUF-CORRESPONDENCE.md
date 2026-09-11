# Protobuf correspondence boundary

## Role

This boundary converts a closed Protobuf descriptor graph to and from
caller-facing JSON values and projects those values into Core JSON Schema
2020-12. It is reusable by gRPC and Connect but has no independent target or
interaction semantics.

## Accepted descriptor domain

- proto2, proto3, Edition 2023, Edition 2024, and Edition 2026 files under
  exact Protobuf 36.1 compiler, source, documentation, and conformance pins;
- single-file `.proto` text whose imports belong to an enumerated bundled
  Google Protobuf set;
- a self-contained `FileDescriptorSet` carriage;
- a tagged canonical-Base64 binary `FileDescriptorSet` carriage, because it is
  the ordinary `protoc --descriptor_set_out` artifact and adding it after
  publication would change the accepted domain;
- a descriptor closure obtained by a consuming binding's discovery protocol;
- exact file-name, package, symbol, dependency, field-number, oneof, map,
extension, option, and feature validation before correspondence is built.

Constructs without one deterministic ProtoJSON and schema correspondence are
excluded with explicit ownership and reopen conditions. The selected
exclusions are groups/delimited message encoding, required/legacy-required
presence, MessageSet, caller-visible application extensions, user custom-option
dependence, disallowed Edition JSON format, cross-field collisions among the
accepted original/effective-JSON spellings, and unresolved or
envelope-colliding `Any` types. A default lower-camel alias for an explicitly
renamed field is a deliberately excluded redundant caller spelling and does not
participate in collision ownership.

## Input and output are not symmetric

The runtime input converter follows the project-pinned portable caller profile:
strict UTF-8 without BOM, unique members and Unicode scalars; canonical
effective or original field names with alias duplicates refused; exact-integral
32-bit JSON numbers; canonical decimal strings for 64-bit values; finite float
numbers or exact special strings; enum names/custom names or integral JSON
numbers but no quoted numeric fallback; canonical padded standard Base64;
canonical boolean and integer map keys; descriptor-sensitive null; the exact
module-pinned well-known-type runtime domains; and a nonempty `Any` type-URL
prefix.
The projected Timestamp, Duration, and FieldMask input schemas deliberately
select their canonical printer-emittable subset while runtime conversion also
accepts and normalizes the module's closed additional spellings. Upstream-known
application extensions would use bracketed fully qualified keys, but this
revision excludes their message closures before value conversion. Unknown
members are rejected.

Whole-field JSON null is an unset-field spelling for an ordinary singular,
repeated, or map property except when a singular field declares `Value` or
`NullValue`; in those cases it creates the declared value and selects a oneof
when applicable. Null inside a container is narrower: `Value` and `NullValue`
retain that pinned meaning, while a repeated wrapper item or map wrapper value
is refused. A complete input wrapper and an `Any` wrapper
`value` may be null and encode the default wrapper instance. The schema
projection carries those contexts independently: input wrapper roots are
nullable, output wrapper roots are scalar-only, and repeated/map wrapper
members are scalar-only in both directions.

The excluded upstream aliases are representations only: no Protobuf type,
semantic value, method, or RPC cardinality is removed, because each admitted
value has a canonical caller spelling. The portable input schema is the
Core-safe minimum of the caller profile; it may be narrower where JSON Schema
cannot prove a descriptor-sensitive conversion, but every schema-valid value
must convert. The recursive `Value` number branch is bounded to finite binary64
values in every direct, Struct, ListValue, and `Any` context. Output remains the
exact pinned printer domain.

Output first parses one binary Protobuf message under the response descriptor,
then renders the pinned ProtoJSON printer form. Its schema is the Core-safe
maximum needed to contain every printer result, including numeric values for
unknown members of open enums. Unknown binary fields do not become JSON
members. An instance that cannot be represented faithfully as ProtoJSON
completes unsuccessfully; it is never passed through as bytes or a protocol
wrapper.

For an open enum, the output schema's numeric branch deliberately spans the
complete int32 range as a directional maximum. It can therefore validate a
recognized integer even though the runtime printer always emits that value's
pinned name. This schema over-approximation does not widen runtime output.

## Schema projection

- A canonical Core-valid schema-map key is derived from each fully qualified
  message symbol with `input.` or `output.` and no
  implementation-minted names.
- Recursive message graphs use JSON Schema references, not expansion depth
  limits.
- Ordinary messages are closed objects. Field presence, oneof exclusivity,
  repeated values, map-key grammar, enum domains, 32/64-bit numeric forms,
  bytes Base64, and custom `json_name` aliases are represented.
- Separate input and output projections are allowed where ProtoJSON accepts a
  wider input domain than it prints.
- Well-known types use their special top-level and nested forms.
- `Any` uses a closed union over resolvable types in the descriptor pool or is
  excluded when no finite truthful projection exists. Every represented type
  URL has a nonempty prefix before its final slash.
- Edition 2026's incorporated first-party `pb.enumvalue.json` option controls
  accepted enum aliases and the emitted enum string exactly; the user-defined
  custom-option exclusion does not reach it. Strict JSON-FDS bootstraps that
  one known bracket-keyed extension only on `EnumValueOptions`, rejects it on
  every other descriptor/options owner, and rejects every other bracket key.
- Every enum input accepts the pinned ordinary/custom names and parser-accepted
  int32 integers. Open enums emit pinned strings for known values and JSON
  integers for unknown numeric field values; a closed enum's unknown wire
  number remains an unknown field and does not widen the output property.
  Singular, oneof, unpacked/packed repeated occurrences confine each unknown
  number independently; a closed-enum map entry whose effective value after
  within-entry singular last-value semantics is unknown is retained as a whole
  unknown map-field occurrence and contributes no typed map entry. Proto2 and
  Editions use their effective enum openness.
- Proto2 string UTF-8 output validation applies after singular, oneof, and map
  overwrite semantics; an invalid occurrence that does not survive in the
  typed message cannot poison a valid surviving value.
- A projection that cannot preserve the accepted source meaning is coverage
  loss; `{}` is never used as a silent fallback.

## Conformance principle

Semantic equality is descriptor-aware. Exact serialized Protobuf bytes are
asserted only for a construct whose authority makes them unique; otherwise a
separate decoder compares the complete message value and framing. Exact JSON
number spelling is preserved in harness inputs so host floating-point types
cannot change a verdict.

The independent oracle uses the exact official `protoc-36.1` executable and
exact source descriptor. Its exact `protoc --decode` process observations
distinguish named typed fields from numeric unknown field material and expose
presence, oneof case, repeated order, decoded map-entry occurrences and their
key/value semantics, descriptor defaults, and scalar values. Closed-enum
singular, unpacked, packed, map, and oneof cases run under proto2 and effective
Editions openness. In particular, a closed-enum map entry whose effective
within-entry value is unknown remains one unknown encoded map-field occurrence
and does not synthesize a typed map entry; parser acceptance, including
ten-byte unknown enum varints, follows the pinned C++ executable rather than an
implementation-local terminal-byte rule.

The value gate now replays the sealed oracle and derives its runtime corpus
from each exact observation, rather than copying a second expected-value
table. A separate TextFormat reader projects named fields into JSON under
the source descriptor. The pinned compiler re-encodes the named observation;
numeric unknown observations are reconstructed only where their wire kind is
unambiguous. Both adapters must match the derived typed value and the complete
reconstructed material, and must distinguish removal of retained unknown
material. Every oracle case has one disposition record. Source compilation
refusals are checked against the pinned compiler separately from runtime
binary refusals and binary values that cannot be represented in JSON.
The bridge rejects unsupported observation syntax instead of silently reducing
coverage. Its own typed-value, unknown-retention, and disposition mutations
must be rejected by both runtimes.
