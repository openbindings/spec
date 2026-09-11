# OpenBindings Protobuf Correspondence Module

**Publication state.** The immutable identifier is established only by an entry in the OpenBindings Project's canonical root `binding-specs/publications.json` manifest for these exact defining bytes; absent that entry, this document is an unpublished candidate. Any manifest copy inside an immutable publication bundle is evidence of the pre-mint source snapshot, not the canonical registry.

## 1. Identity and role

**[pin]** This module incorporates exactly version **0.2.0** of the
[OpenBindings Specification](../../openbindings.md) as its Core authority.
Throughout this document, **Core** means that exact version.

**[incorporated]** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**,
**RECOMMENDED**, **MAY**, and **OPTIONAL** are interpreted as described in
[BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) only when they appear in all
capitals.

**[convention]** The module identifier is exactly
**`openbindings.module.protobuf-correspondence@1`**. It is a companion module,
not a binding specification, and MUST NOT appear as an OBI source
`bindingSpec` value.

**[convention]** This module defines one reusable correspondence among a closed
Protobuf descriptor graph, caller-facing JSON values, Protobuf binary message
bytes, and JSON Schema 2020-12. It defines no target, network protocol,
interaction lifecycle, status classification, credential behavior, or retry
policy.

**[convention]** A consuming binding specification records this exact module
identifier and the SHA-256 of the module bytes it incorporates.

**[incorporated]** An observable change to the accepted descriptor domain,
value correspondence, binary meaning, or schema projection requires a new
module identifier and therefore a new identifier for every consumer whose
portable behavior changes (Core
[OBI-B-03](../../openbindings.md#104-binding-specification-rules)).

## 2. Exact authority and accepted descriptor domain

**[pin]** The compiler/source authority is Protobuf **36.1**, exact source
commit [`f377bfefc5e2cfab68b816903c25b23e091c439d`](https://github.com/protocolbuffers/protobuf/tree/f377bfefc5e2cfab68b816903c25b23e091c439d).
The documentation authority is exact commit
[`4b88f52a8f830d4b4fbdad161dee33618ebc617f`](https://github.com/protocolbuffers/protocolbuffers.github.io/tree/4b88f52a8f830d4b4fbdad161dee33618ebc617f).
Where the prose grammars are incomplete, the exact pinned C++ decision sources
and executable `protoc` witness below decide acceptance.

**[pin]** The portable compiler-execution gate uses the official macOS
aarch64 [`protoc-36.1` release archive](https://github.com/protocolbuffers/protobuf/releases/download/v36.1/protoc-36.1-osx-aarch_64.zip),
SHA-256 `de56d57afe30c5d191b11d24ff93dd4025728d7fb43b773886b2d3613e0bdbb2`.
Other platform builds are conforming only when they identify as 36.1 and
produce the same admitted/refused descriptor meaning for the portable corpus;
the archive pin is an executable witness, not a platform requirement.

**[pin]** Exact C++ decision anchors from the same source commit are the
ProtoJSON [`parser.cc`](https://github.com/protocolbuffers/protobuf/blob/f377bfefc5e2cfab68b816903c25b23e091c439d/src/google/protobuf/json/internal/parser.cc)
and [`unparser.cc`](https://github.com/protocolbuffers/protobuf/blob/f377bfefc5e2cfab68b816903c25b23e091c439d/src/google/protobuf/json/internal/unparser.cc),
binary [`wire_format.cc`](https://github.com/protocolbuffers/protobuf/blob/f377bfefc5e2cfab68b816903c25b23e091c439d/src/google/protobuf/wire_format.cc),
descriptor [`descriptor.cc`](https://github.com/protocolbuffers/protobuf/blob/f377bfefc5e2cfab68b816903c25b23e091c439d/src/google/protobuf/descriptor.cc),
[`text_format.cc`](https://github.com/protocolbuffers/protobuf/blob/f377bfefc5e2cfab68b816903c25b23e091c439d/src/google/protobuf/text_format.cc),
[`unknown_field_set.cc`](https://github.com/protocolbuffers/protobuf/blob/f377bfefc5e2cfab68b816903c25b23e091c439d/src/google/protobuf/unknown_field_set.cc),
and the protoc [`command_line_interface.cc`](https://github.com/protocolbuffers/protobuf/blob/f377bfefc5e2cfab68b816903c25b23e091c439d/src/google/protobuf/compiler/command_line_interface.cc).
These files are individually cached decision anchors for this module's JSON
conversion, field defaults and enum openness, binary unknown-field treatment,
and the oracle's text observations and `protoc --decode` path. Their delegated
traits, reflection, lexer, writer, and coded-stream dependencies remain fixed
by the exact complete source-commit pin above; the anchor list is not a claim
that those translation units execute without that closed dependency graph.
The pin does not make an implementation-specific generated API part of this
module.

**[convention]** The accepted language declarations are exactly proto2,
proto3, Edition 2023, Edition 2024, and Edition 2026 as implemented by that
compiler snapshot. An absent syntax declaration has proto2 meaning only where
the pinned compiler assigns it; an unknown edition or future syntax is outside
this module.

**[convention]** A descriptor graph is admitted only when every reached file,
dependency, public or weak import, symbol, field number, reserved range,
oneof, map entry, extension, option, feature, and type reference is accepted
by the pinned compiler and the complete graph has one unambiguous semantic
identity. Duplicate filenames with unequal meaning, missing dependencies,
illegal cycles, and conflicting symbols make their smallest owning descriptor
closure invalid.

**[pin]** Text compilation uses virtual root filename `source.proto`, no host
filesystem, environment, network, working-directory, or user include path,
and the following exact import allowlist:

- `google/protobuf/any.proto`
- `google/protobuf/api.proto`
- `google/protobuf/descriptor.proto`
- `google/protobuf/duration.proto`
- `google/protobuf/empty.proto`
- `google/protobuf/field_mask.proto`
- `google/protobuf/json_enumvalue_options.proto`
- `google/protobuf/json_options.proto`
- `google/protobuf/source_context.proto`
- `google/protobuf/struct.proto`
- `google/protobuf/timestamp.proto`
- `google/protobuf/type.proto`
- `google/protobuf/wrappers.proto`

No path-prefix wildcard expands that list. An import outside it is excluded,
even if an installed compiler happens to provide it.

**[incorporated]** Edition 2026's first-party `pb.enumvalue.json` option is
part of the accepted language and controls the ProtoJSON enum spelling under
the pinned compiler. It is not a user-defined custom-option dependency. This
exception admits the option only as compiler-interpreted descriptor metadata;
it does not admit an extension property in an application request or response
value.

**[exclusion]** A proto2 `required` field, or an Editions field whose effective
`field_presence` feature is `LEGACY_REQUIRED`, excludes the smallest containing
application message and every method value closure that reaches it. Revision 1
does not define construction, partial-message, or conversion behavior for a
caller value that omits such a field. This exclusion reopens only after a
complete bidirectional ProtoJSON, binary, default-instance, and JSON Schema
correspondence is executable across the portable corpus and demonstrated
consumer need justifies a new module identifier.

**[exclusion]** A caller-visible application message extension excludes the
smallest containing extendee message and every method value closure that
reaches it. Although the pinned ProtoJSON parser and printer spell a known
extension as `[<fully-qualified-extension-name>]`, revision 1 does not admit a
consumer-specific extension registry or project that registry into JSON Schema.
This exclusion reopens only when an exact closed extension registry and a
faithful bidirectional value and schema correspondence are executable across
the portable corpus. Descriptor options used only by the compiler remain
governed separately below.

**[exclusion]** `google.protobuf.EnumValueOptions` is the extendee of the
incorporated `pb.enumvalue.json` option. That message, and every application
method value closure that reaches it, is excluded at that extendee owner even
when the source descriptor set does not repeat the bootstrapped option
declaration. The option remains fully admitted when it occurs as descriptor
metadata controlling an enum value; the distinction is its role in the closed
descriptor graph, not whether a runtime happened to register the extension.

**[exclusion]** A descriptor whose portable application meaning depends on an
unincorporated user-defined option is excluded at the smallest message, enum,
field, or method owner. Reopen only when demonstrated consumer need identifies
the option's exact upstream authority and a new module identifier defines and
executes its closed-registry value and schema correspondence; installation of
an extension registry alone does not reopen it.

**[exclusion]** MessageSet wire format and groups are excluded. Reopen only if
an executable, bidirectional ProtoJSON and JSON-Schema correspondence is added;
their binary decodability alone is insufficient.

**[exclusion]** An application message is excluded at that message owner when
one accepted input member spelling denotes more than one of its distinct
fields. For this test, each field contributes its original Protobuf name and
its effective JSON name: the explicit `json_name` when present, otherwise the
pinned default lower-camel name. The upstream parser's additional default
lower-camel alias for an explicitly renamed field is outside the portable
caller profile below and therefore does not participate in this ownership
test. The exclusion covers two fields whose emitted JSON names collide. Every
method value closure that reaches the message is excluded, while sibling
methods and collision-free messages remain admitted. Reopen only when
demonstrated consumer need and an updated exact authority define one portable
lookup and printing rule for every such collision and a new module identifier
executes that rule in both value conversion and directional schema projection.

**[exclusion]** The reserved envelope-member set for an ordinary message packed
in `google.protobuf.Any` is exactly `{ "@type" }` in this revision. An otherwise
admitted message having any accepted original or JSON field spelling in that
set is excluded only as an `Any` alternative. Direct occurrences of the same
message remain admitted, and the exclusion does not remove an `Any`-bearing
method or any collision-free alternative from its closed union. An input `Any`
that selects the excluded type and an output `Any` decoded with that type URL
fail value conversion. Reopen this alternative only when demonstrated consumer
need and an updated exact ProtoJSON authority establish a collision-free,
bidirectional envelope and a new module identifier executes it.

## 3. Descriptor carriage

**[pin]** A JSON descriptor object is parsed as strict ProtoJSON for
`google.protobuf.FileDescriptorSet`: unique JSON member names, exact JSON
numbers, no unknown members, and no silent coercion outside the pinned
ProtoJSON parser domain. The exact `google/protobuf/json_enumvalue_options.proto`
descriptor is installed in the parser's extension registry before parsing, so
the known bracket key `[pb.enumvalue.json]` is accepted in
`EnumValueOptions`; every other bracket-keyed extension is rejected. The
bootstrap descriptor is the exact Protobuf 36.1 file and is not obtained from
the descriptor set being parsed.

**[pin]** A binary descriptor set is one Protobuf binary encoding of
`google.protobuf.FileDescriptorSet`. The carrier that contains it, not this
module, must discriminate those bytes from a JSON descriptor object. Binary
and reflected descriptor bytes use the same bootstrapped
`pb.enumvalue.json` extension registry as the JSON carrier, so that first-party
option is interpreted rather than demoted to an unknown descriptor field.
Binary encodings are compared by decoded descriptor meaning because ordinary
Protobuf serialization is not canonical.

**[convention]** Descriptor ordering, source-code locations, uninterpreted
comments, and unknown descriptor fields do not create caller-visible message
members. They remain part of descriptor validation and identity wherever the
pinned compiler makes them semantically significant.

## 4. Input JSON to a request message

**[pin]** Caller input uses the module's portable JSON profile. The byte stream
is strict UTF-8 with no leading byte-order mark; JSON member names are unique;
decoded strings and member names contain only Unicode scalar values; and
unknown members are rejected. Lossless parsing retains each JSON number token
until its descriptor-directed conversion verdict is known. Host-number
rounding or replacement-character decoding cannot change that verdict.

**[pin]** An ordinary field may use its canonical effective JSON name—its
lowerCamelCase name unless an explicit `json_name` replaces it—or its original
Protobuf field name. Supplying both spellings, or repeating either spelling, is
a duplicate assignment and is rejected. The default lower-camel alias that the
pinned C++ parser additionally recognizes for an explicitly renamed field is
not a caller-profile spelling. A known application extension would use
`[<fully-qualified-extension-name>]`, but §2 excludes caller-visible
application extensions before value conversion in this revision.

**[exclusion]** The preceding original-name rule continues to apply to a direct
ordinary message. It does not restore a message alternative excluded from an
`Any` envelope by §2: selecting that type URL is a conversion failure even when
the caller uses the field's otherwise noncolliding original name.

**[pin]** Signed and unsigned 32-bit scalar inputs are exact-integral JSON
numbers in their descriptor range; quoted forms are rejected. Signed and
unsigned 64-bit scalar inputs are canonical in-range base-10 JSON strings;
JSON numbers are rejected. A canonical integer string is `0` or a nonzero
magnitude without a leading zero, with `-` only for a negative signed value.
Float and double accept a finite in-range JSON number or exactly `"NaN"`,
`"Infinity"`, or `"-Infinity"`; quoted finite numbers are rejected. Boolean
and string use their JSON types. Bytes use canonical padded standard RFC 4648
Base64 with zero unused terminal bits.

**[pin]** Within those forms, numeric conversion follows the exact pinned C++
decision source: integer integrality and bounds are decided from the lossless
decimal token before any host-number coercion, while float and double use its
decimal-to-binary rounding, signed-zero, overflow, and underflow behavior. A
host runtime's default number parser is not an alternative authority.

**[pin]** An enum input is an ordinary or incorporated custom enum name, or an
exact-integral JSON number in the signed 32-bit range. A quoted numeric token
that is not itself a declared ordinary or custom name is rejected. Name lookup
therefore precedes numeric conversion, but the pinned parser's `SimpleAtoi`
quoted-number fallback is outside this caller profile.

**[pin]** Repeated values preserve array order; `null` elements follow the
descriptor-sensitive rule below. Boolean map keys are exactly `true` or `false`; integer
map keys are canonical in-range base-10 strings under the scalar integer rule;
string map keys are unchanged strings. Alias spellings that normalize to the
same typed key are rejected by grammar rather than resolved by encounter
order. Oneof members are mutually exclusive across every admitted field
spelling.

**[pin]** JSON `null` is descriptor-sensitive. For a field as a whole—including
a repeated or map field—it acts as absence except when the singular field's
declared type is `google.protobuf.NullValue` or `google.protobuf.Value`. In
those two singular cases, `null` creates the declared value, records presence
where the descriptor supports it, and selects the containing oneof when there
is one. Within a repeated array or map object, `null` is accepted as an element
or member value only for those same two declared types. A wrapper accepts
`null` as a complete top-level caller value or as an `Any` `value`, encoding
its default instance; an ordinary singular wrapper-valued field instead follows
the whole-field absence rule, and a repeated or map wrapper member rejects
`null`.

**[pin]** Well-known-type runtime input follows this module's closed grammar.
Timestamp is exactly `YYYY-MM-DDTHH:MM:SS`, an optional one-to-nine-digit
fraction, and either `Z` or a numeric `+HH:MM` or `-HH:MM` offset. Its year is
`0001` through `9999`, its date and time components are valid, its offset hour
is 00 through 23 and offset minute is 00 through 59, and the resulting instant
is in the Timestamp range. Duration has an optional `-`, then a canonical
nonnegative whole, an optional dot followed by one-to-nine fraction digits, and
a final `s`; the resulting seconds and nanos satisfy the Duration range.
FieldMask uses reversible lower-camel paths, Struct/Value/ListValue use their
specified forms, and wrappers use their custom form. Section 7 projects the
canonical printer-emittable subset of the Timestamp, Duration, and FieldMask
runtime domains so every schema-valid input remains convertible under Core's
directional input guarantee.

**[pin]** A nonempty `Any` `@type` URL must contain a final slash with at
least one character before it; a spelling whose final slash is the first
character is rejected. The suffix after that slash selects the exact message
name in the closed descriptor pool. Section 7 carries the same nonempty-prefix
condition into every represented `Any` alternative.

**[pin]** The first-party `pb.enumvalue.json` string is an accepted enum input
spelling and the emitted spelling for that value. Alias and collision behavior
is the pinned compiler/parser/printer behavior; no implementation-local enum
name policy may replace it.

**[exclusion]** Upstream-valid redundant ProtoJSON spellings outside this
portable caller profile are excluded as representations, not as Protobuf
types or semantic values. This includes the third default lower-camel alias of
an explicitly renamed field, quoted or noncanonical integer aliases, quoted
finite floats, quoted numeric enum fallbacks, noncanonical Base64 alphabets or
padding, and noncanonical boolean or integer map keys. Every admitted Protobuf
scalar, enum value, message, map,
well-known type, method, and RPC cardinality retains at least one caller JSON
representation. Reopen an excluded spelling only when demonstrated consumer
need and an executable, cross-language lossless contract justify a new module
identifier; upstream permissiveness alone does not reopen it.

**[convention]** An absent caller value selects a newly constructed default
instance only when the consuming interaction explicitly permits absence. The
module itself never infers an absent top-level caller value or interaction
message from JSON `null` and never decides how many messages an interaction
sends. Section 4's descriptor-sensitive field-level and well-known-type null
rules are unaffected.

## 5. Binary message correspondence

**[incorporated]** A message is encoded and decoded by the pinned Protobuf
[binary wire format](https://github.com/protocolbuffers/protocolbuffers.github.io/blob/4b88f52a8f830d4b4fbdad161dee33618ebc617f/content/programming-guides/encoding.md)
under its exact descriptor. Unknown fields are accepted on decode as the
binary format requires but do not become caller-facing JSON members.

**[pin]** When an enum is closed, an unrecognized wire number is unknown-field
material rather than a decoding failure or a typed enum value. This applies to
singular and oneof occurrences and independently to each unpacked or packed
repeated occurrence: recognized occurrences survive in the typed field and
unrecognized occurrences are retained only as unknown fields. For a map whose
value is that closed enum, first apply singular last-value semantics among all
value-field occurrences inside one encoded map entry. If that effective value
is unrecognized, the complete entry is retained as one unknown
length-delimited occurrence of the map field and contributes no typed map
entry; if the effective value is recognized, the entry remains typed. The same
rule follows the effective enum openness selected by proto2 or Editions
features. Unknown material remains round-trippable in the binary message but
is omitted from ProtoJSON output.

**[convention]** Semantic comparison decodes the complete bytes under the
governing descriptor and compares field presence, oneof case, repeated order,
map entries, scalar values, and recursively decoded messages. It does not
require byte equality where the wire format permits field reordering,
equivalent packed forms, duplicate singular occurrences, or map-entry order.
Closed-enum numbers confined to unknown fields are compared as unknown binary
material, not as typed field values.

**[pin]** The independent Protobuf oracle invokes the pinned `protoc-36.1`
executable with the exact source descriptor and message name. Each observation
is the exact process exit code, stdout, and stderr from `protoc --decode` for
the supplied binary bytes. The pinned TextFormat output distinguishes named
typed fields from numeric unknown fields and thereby observes field presence,
selected oneof case, repeated order, decoded map-entry occurrence/key/value
semantics, scalar values, descriptor-default behavior, and unknown field
number/wire shape/value.
Closed-enum singular, repeated unpacked, repeated packed, map-value, and oneof
fixtures are tested under proto2 and effective Editions openness. A recognized
value may appear in the typed observation; an unrecognized closed-enum number
appears only in the unknown observation. For a closed-enum map value, the
resolved encoded map-field occurrence is unknown material and no typed map
entry is synthesized. Within-entry duplicate keys and values are resolved by
the pinned parser before that unknown entry is retained; retaining the
unresolved input bytes is not an equivalent observation. No normalization may
discard or reorder the exact oracle observation.

**[convention]** A malformed, truncated, wrong-wire-type, or otherwise
unparseable message is a decoding failure exactly when the pinned binary parser
refuses it. `Overlong` is not an implementation-local terminal-byte rule: the
pinned C++ parser accepts some ten-byte value varints whose last byte exceeds
one. Their decoded value depends on the field's wire conversion, including
signed width and closed-enum unknown retention. Tag and length parsing are
distinct contexts; acceptance of a value varint does not authorize accepting
that encoding as a tag or length. The oracle locks accepted and refused
boundaries in these contexts. The consuming binding
determines whether an actual decoding failure is pre-dispatch refusal or
unsuccessful completion.

## 6. Response message to output JSON

**[pin]** Output first decodes one complete binary message and then uses the
pinned ProtoJSON printer defaults: canonical JSON field names (lowerCamelCase
unless replaced by an explicit `json_name`), bracketed fully qualified names
for caller-visible extensions only under a later module identifier that
satisfies §2's exact closed-registry and executable-correspondence reopening
conditions, decimal strings for 64-bit
integers, standard Base64 for bytes, omission of fields without presence, and
the special well-known-type forms. A known enum value is emitted using its
pinned ordinary or `pb.enumvalue.json` string. For an open enum, an
unrecognized numeric value is emitted as its JSON integer; a closed enum cannot
contain an unrecognized value as the decoded field value. The first-party
option's alias and collision behavior remains the pinned compiler/printer
behavior.

**[convention]** Output JSON is the application message value only. Unknown
binary fields, descriptor metadata, transport metadata, and protocol facts do
not become members.

**[convention]** If a decoded message has no faithful value in the closed
ProtoJSON output domain, conversion fails loudly. Raw bytes, a tagged wrapper,
`{}`, or implementation-specific JSON are never substituted.

**[pin]** For proto2 `string` values, UTF-8 validity is assessed on the
surviving decoded semantic value after Protobuf singular last-value, oneof
case, and typed-map key replacement semantics. An earlier invalid occurrence
that is overwritten and is absent from the final typed message does not poison
a valid survivor. Every invalid value that survives—including an element of a
repeated field or a recursively retained message—takes the conversion-failure
path. A `bytes` field is not subject to string UTF-8 validation.

**[exclusion]** An `Any` whose type URL selects the envelope-colliding message
class in §2 has no faithful output envelope and therefore takes this
conversion-failure path. The same message decoded directly continues to use its
ordinary canonical JSON field names.

**[pin]** A decoded `Any` type URL that lacks §4's nonempty prefix before its
final slash also takes the conversion-failure path; merely resolving the
suffix as a message name cannot repair the invalid envelope identity.

## 7. JSON Schema 2020-12 projection

**[incorporated]** The projection follows Core's directional contract semantics
([Core §5.1](../../openbindings.md#51-operations)): an input schema states a
portable minimum that every realization accepts, while an output schema states
a portable maximum containing every successful value a realization produces.
Runtime input correspondence is the portable caller profile in §4; output
remains the exact pinned ProtoJSON printer domain in §6. Schema validation is
not a replacement for descriptor-directed conversion. Because JSON Schema
cannot perform every descriptor-sensitive conversion and Core makes `format`
annotation-only, the input schema may state a proved subset of the caller
profile while the runtime MUST accept the whole profile; the output schema
MUST contain every successful printer value. Neither direction claims set
equality solely from schema validation.

**[convention]** Each admitted message has separate input and output schemas.
Schema-map keys are the exact fully-qualified Protobuf symbol prefixed by
`input.` or `output.`, with a leading dot removed. Every `$ref` is the literal
same-document pointer `#/schemas/<that-key>`. The graph is emitted once per
direction in Unicode-scalar key order; recursion always uses `$ref` and is never
cut off by an expansion-depth limit.

**[convention]** An ordinary message schema is exactly a JSON object with
`type: "object"`, `properties`, and `additionalProperties: false`. No field is
required merely because it has a scalar default; required and legacy-required
messages were excluded in §2. An input `properties` map contains both the
canonical JSON name and the original Protobuf name when they differ. An
explicit `json_name` never adds the excluded third default lower-camel alias. An
`allOf` entry containing `not: { required: [a, b] }` forbids assigning both
spellings of one field. Output contains only the pinned printer name. A second
such pairwise exclusion is emitted for every pair of fields in one oneof, over
every spelling admitted in that direction. The `allOf` member is omitted when
there is no exclusion. `null` is an additional accepted input property value:
the pinned parser treats it as unset except that a declared
`google.protobuf.Value` or `google.protobuf.NullValue` creates that value and
selects a containing oneof. Generic field-level nullability is not added to
repeated elements or map values; those positions admit `null` only through the
intrinsic schema of `Value` or `NullValue`. Output admits `null` only for a
well-known type whose printer can emit it.

**[convention]** Singular scalar schemas use these exact directional forms.
Input 32-bit integers admit only a JSON integer in the exact signed or unsigned
range. Input 64-bit integers admit only the canonical in-range base-10 string.
Output 32-bit integers are in-range JSON integers and output 64-bit integers are
canonical in-range base-10 strings. A canonical integer string is `0` or a
nonzero magnitude without a leading zero, with `-` only for a negative signed
value; its emitted `pattern` recognizes no value outside the governing range.
Float and double input/output schemas admit an in-range JSON number or exactly
`"NaN"`, `"Infinity"`, or `"-Infinity"`. Boolean uses its JSON type. String
schemas add an explicit pattern excluding surrogate code points, so every
schema-valid string is a Unicode-scalar sequence as required by §4. Bytes use
canonical padded standard RFC 4648 Base64.

**[convention]** A repeated field is an array whose `items` is the element
type's directional schema without generic field-level nullability and whose
order is significant. A map field is an object whose `propertyNames` is the
exact canonical string grammar for its boolean or integer key type and whose
`additionalProperties` is its value type's directional schema, again without
generic field-level nullability. The intrinsic `Value` and `NullValue` schemas
therefore retain `null` in either container, while wrapper members remain
non-null. String keys use the same Unicode-scalar `propertyNames` pattern as
string values. The synthetic map-entry message is not exposed as a caller
schema solely because it implements a map. The exact canonical key grammar is
shared by runtime input and projection.

**[convention]** An enum input schema admits every ordinary or
`pb.enumvalue.json` name accepted for a declared value and every in-range int32
JSON integer. At runtime, output emits exactly one pinned name for each
recognized number and emits an integer only for an unrecognized open-enum wire
number. The open-enum output schema deliberately uses the complete int32 branch
as a directional maximum, so it can validate a recognized number that the
runtime printer emits only by name; the closed-enum output schema has no numeric
branch. Alias and custom-name collisions are resolved by the pinned
compiler/printer before the finite emitted-name set is constructed.
Caller-visible extension properties are absent because §2 excludes their
containing method value closures.

**[convention]** The well-known types use their pinned top-level JSON shapes,
without relying on assertion behavior from `format`: an input wrapper schema is
its scalar schema plus `null`, while an output wrapper schema is the scalar
schema alone. A wrapper input `null` encodes its default binary instance, whose
later canonical output is the wrapped scalar default. A repeated wrapper item
or map wrapper value uses the non-null scalar schema in both directions; a
singular input property remains nullable under the whole-field absence rule,
and an input `Any` wrapper `value` uses the nullable top-level wrapper schema.
`Struct` is an
object whose Unicode-scalar member names have recursively projected `Value`
values; a valid `Value` is the closed recursive alternation of null, boolean, a
finite binary64-range JSON number from
`-1.7976931348623157e308` through `1.7976931348623157e308`, a Unicode-scalar
string, projected `Struct`, and projected `ListValue`, while a decoded `Value`
having no selected kind fails output
conversion; `ListValue` is an array of projected `Value`; `NullValue` is
`null`; and `Empty` is a closed ordinary empty object, not a custom-JSON
well-known type. Timestamp, Duration, and FieldMask use explicit `pattern`
assertions. Those input patterns select the canonical printer-emittable subset
of the larger module-pinned runtime domain; in particular, schema-invalid
Timestamp offsets and noncanonical Duration spellings may still be accepted and
normalized by runtime conversion. FieldMask admits
every pinned reversible camel-case input, including a leading uppercase segment
such as `Foo` for the Protobuf path `_foo`; the printer rejects a path whose
camel/snake conversion is not reversible. Input patterns select a proved subset
of the runtime caller profile; output patterns contain every canonical
printer spelling. No `format` keyword is emitted.

**[convention]** `google.protobuf.Any` projects as a closed `anyOf`. One closed
empty-object alternative represents the empty `Any`. Every resolvable admitted
ordinary message in the complete descriptor pool contributes an alternative
unless §2 excludes that alternative for an envelope collision. Each included
ordinary alternative combines a required string `@type`, whose pattern ends in
`/` followed by that exact fully-qualified name and requires at least one
character before the final slash, with that message's directional properties
and exclusions. `google.protobuf.Empty` is such an ordinary
alternative and therefore has `@type` but no `value`. A well-known type with a
custom ProtoJSON representation instead has exactly the required `@type` and
`value` properties, with `value` governed by that type's directional schema; a
wrapper `value: null` input encodes the wrapped default and its canonical output
uses the scalar default. Recursive `Any` alternatives use the same schema-map
`$ref`. An unresolvable or envelope-colliding type URL remains a runtime
conversion failure and is never represented by an open alternative.

**[convention]** A generated input schema is conforming only when every value
it validates is accepted by §4 conversion. A generated output schema is
conforming only when every successful value from §6 validates. A projection
that cannot prove those directional obligations is lossy at the smallest
projection owner. An unconstrained `{}` schema, an open ordinary object, an unconstrained numeric
string, a `format` assertion, or a host-language-rounded bound is never a
faithful fallback.

## 8. Atomic module rules

- **PB-D-01** — descriptor graphs use only the exact accepted language lines,
  imports, and compiler semantics in §2.
- **PB-D-02** — JSON and binary `FileDescriptorSet` forms decode completely
  and uniquely with the exact bootstrapped `pb.enumvalue.json` extension under
  §3.
- **PB-D-03** — invalid constructs, required/legacy-required fields,
  caller-visible extensions, cross-field JSON-name collisions, and other
  excluded descriptor constructs confine to their smallest semantic owner
  under §2.
- **PB-P-01** — input field selection, duplicate and unknown refusal,
  descriptor-sensitive null, oneof, well-known-type, and `Any` conversion
  follow §§2 and 4.
- **PB-P-02** — binary encoding, decoding, closed-enum unknown-field
  confinement, and semantic equality follow §5.
- **PB-P-03** — output ProtoJSON printing, including open-enum unknown numeric
  values, surviving proto2-string UTF-8 validation, and `Any` type-URL and
  envelope-collision failures, follows §§2 and 6.
- **PB-P-04** — `pb.enumvalue.json` bootstrap and value behavior follow §§2–6.
- **PB-P-05** — strict JSON and the portable caller profile's exact numeric,
  enum, Base64, map-key, field-spelling, and well-known-type domains follow
  §4; excluded redundant spellings never narrow Protobuf type, semantic-value,
  method, or cardinality coverage.
- **PB-S-01** — input and output schema-map identities follow §7.
- **PB-S-02** — ordinary messages, recursion, aliases, oneofs, maps, scalars,
  and enums satisfy §7's directional contract under independent
  schema-instance checks.
- **PB-S-03** — well-known types and `Any`, including the empty alternative,
  ordinary `Empty`, and excluded envelope-colliding alternatives, follow §7.
- **PB-S-04** — unrepresentable projections are explicit coverage loss, never
  silent `{}` fallback.

## 9. Permitted variation and declared limits

**[incorporated]** Semantically equivalent Protobuf binary encodings are
permitted where the pinned wire format permits them. Caller JSON conversion
does not vary outside the local profile in §4; output remains the pinned
printer behavior. Schema syntax may vary only when it proves the same
directional input-minimum and output-maximum contracts defined in §7.

**[limit]** Resource ceilings may refuse an owner before conversion or fail a
conversion already in progress; they MUST be disclosed and MUST NOT truncate,
round, reorder, or silently drop accepted values.

**[limit]** Code-generation APIs and generated source-code shape are outside
this module. Conformance is against descriptor and value meaning, not a
particular generated class surface.

## 10. Normative references

- [OpenBindings Specification 0.2.0](../../openbindings.md)
- [Protobuf 36.1 source tree](https://github.com/protocolbuffers/protobuf/tree/f377bfefc5e2cfab68b816903c25b23e091c439d)
- [Protobuf ProtoJSON parser source](https://github.com/protocolbuffers/protobuf/blob/f377bfefc5e2cfab68b816903c25b23e091c439d/src/google/protobuf/json/internal/parser.cc)
- [Protobuf ProtoJSON printer source](https://github.com/protocolbuffers/protobuf/blob/f377bfefc5e2cfab68b816903c25b23e091c439d/src/google/protobuf/json/internal/unparser.cc)
- [Protobuf binary wire-format source](https://github.com/protocolbuffers/protobuf/blob/f377bfefc5e2cfab68b816903c25b23e091c439d/src/google/protobuf/wire_format.cc)
- [Protobuf descriptor semantics source](https://github.com/protocolbuffers/protobuf/blob/f377bfefc5e2cfab68b816903c25b23e091c439d/src/google/protobuf/descriptor.cc)
- [Protobuf text-format source](https://github.com/protocolbuffers/protobuf/blob/f377bfefc5e2cfab68b816903c25b23e091c439d/src/google/protobuf/text_format.cc)
- [Protobuf unknown-field source](https://github.com/protocolbuffers/protobuf/blob/f377bfefc5e2cfab68b816903c25b23e091c439d/src/google/protobuf/unknown_field_set.cc)
- [Protobuf protoc decode-path source](https://github.com/protocolbuffers/protobuf/blob/f377bfefc5e2cfab68b816903c25b23e091c439d/src/google/protobuf/compiler/command_line_interface.cc)
- [Protobuf language and programming guides](https://github.com/protocolbuffers/protocolbuffers.github.io/tree/4b88f52a8f830d4b4fbdad161dee33618ebc617f)
- [Official protoc 36.1 macOS aarch64 archive](https://github.com/protocolbuffers/protobuf/releases/download/v36.1/protoc-36.1-osx-aarch_64.zip)
- [RFC 4648](https://www.rfc-editor.org/rfc/rfc4648)
- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119)
- [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)
