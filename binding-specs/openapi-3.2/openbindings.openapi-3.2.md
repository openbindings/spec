# OpenBindings kind for OpenAPI 3.2

**Status: unreleased `@1` candidate.** This document proposes the meaning of
`openbindings.openapi-3.2@1`; it does not publish the identifier.
[Migration and evidence](README.md) are informative.

## 1. Authority and scope

This kind incorporates [OpenBindings Specification 0.2.0](../../openbindings.md).
It incorporates [OpenAPI 3.2.1](https://spec.openapis.org/oas/v3.2.1.html)
(OAS), its normative references for the features used below, and
[HTTP Semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110).
Accepted entry documents have `openapi` equal to `3.2.0` or `3.2.1`; both are
interpreted under the incorporated 3.2.1 text. Later editions are not implicitly admitted. The kind string is compared exactly under core.

The following table identifies the upstream rules governing each interpretation.
This document supplies the additional decisions and express restrictions below;
otherwise the incorporated authority governs, including its permitted variation.

| Subject | Incorporated OAS sections |
| --- | --- |
| Artifact structure, references, bases, dialects | §§3–4.1.2, 4.23–4.24, Appendices F–G |
| Servers, path construction, operation identity | §§4.5–4.10 |
| Parameter identity, overrides and serialization | §§4.12, Appendices B–E |
| Bodies, media selection, forms, multipart and encoding | §§4.13–4.15 |
| Responses, headers, callbacks and webhooks | §§4.1.1, 4.16–4.21 |
| Security requirements and schemes | §§4.27–4.30 |

For stable incorporation, the default OAS schema dialect uses its
[2025-09-17 resource](https://spec.openapis.org/oas/3.2/dialect/2025-09-17),
the URL Living Standard uses the
[18 August 2026 review draft](https://url.spec.whatwg.org/review-drafts/2026-08/),
SSE parsing uses the
[WHATWG HTML snapshot 24c5e48](https://github.com/whatwg/html/blob/24c5e48bf66ea61bc199ec6338c81258275ba9c6/source),
and QUERY uses [HTTP QUERY, RFC 10008](https://www.rfc-editor.org/rfc/rfc10008.html).
The suffix and framing authorities are RFCs 6839, 7464 and 8091; Base64 is
[RFC 4648 §4](https://www.rfc-editor.org/rfc/rfc4648#section-4).

The kind defines an HTTP request with a unary input and a unary or sequential
response. It defines no tunnel, protocol upgrade, callback receiver, retry policy,
credential-acquisition flow, SDK API or invocation-service interface. Those
capabilities are not implied by an OAS declaration. Requirements below concern
the denoted interaction; they do not prescribe execution algorithms.

## 2. Source content

Source `content` is an object with only these members:

| Member | Meaning |
| --- | --- |
| `document` | An embedded OAS document object or a string containing one JSON/YAML document. |
| `location` | An absolute URI identifying the artifact and supplying its retrieval base. |

`location` identifies a whole document. Its URI fragment, if present, must be
empty; a nonempty fragment is invalid source content. Remove an empty fragment
before retrieval and base-URI use. This rule also applies when `document` is
embedded; `location` never selects a nested artifact from either representation.

At least one member is present. Absent content, null, other JSON types, an
unknown member, or a member of the wrong type is invalid for this kind.
An embedded `document` supplies the artifact; `location` does not replace it.
With `location` alone, acquisition must yield an artifact before interpretation
can proceed. An unavailable or policy-denied resource means that interpretation
cannot be completed, not that the unseen artifact is invalid. A URI is resolved
through a resolver honoring that URI scheme; this kind requires no network or
filesystem access policy. A successful HTTP retrieval supplies the selected
representation under RFC 9110; a transport failure or unsuccessful acquisition
does not supply an OAS document merely because it has a body.

Text is parsed under [YAML 1.2.2](https://yaml.org/spec/1.2.2/), using its Core
schema for scalar values, with OAS's RFC 9512 JSON-compatibility constraints.
An entry document must produce a JSON object; a referenced Schema Object may
also produce a boolean schema. Scalar mapping keys denote their string
spellings (so plain `200:` names `200`); duplicate keys, non-scalar keys,
non-JSON values, incompatible explicit tags and multiple documents are invalid.
Retrieved documents use YAML's specified character-encoding detection; a byte
order mark is representation metadata. A JSON object supplied directly needs no
text parsing. Referenced documents use the same representation rules but need
not be OAS entry documents.

`location` supplies the retrieval URI for embedded content as well as retrieved
content. OAS `$self`, schema `$id` and reference rules then govern description
references. Relative API server URLs instead use the containing document's
retrieval URI, not `$self`. The containing OBI's acquisition URI supplies neither
base. Without a suitable base, a relative reference or server URL requiring it
cannot be interpreted; self-contained references remain usable. Redirected
artifact acquisition uses the final retrieval URI for a location-only source.

OAS's full-document parsing and resource-identity rules apply. Reference cycles
do not by themselves invalidate a document. A referenced root may be an OAS Object,
a Schema Object or another referenceable OAS object in the type expected at that
position. Arbitrary untyped embeddings supply no additional reference
interpretation. A node used in different reference contexts is interpreted
separately in each expected OAS object type.

**[convention]** Source content first satisfies its stated contract. For the
entry artifact, the representation, root-shape and edition requirements above
are the closed source-load gates. Failure to acquire or interpret a referenced
resource affects its owning declarations, not these entry-artifact gates. Below
the gates, defects affect the smallest owning unit. Refuse the source if it declared targets and defects destroy every
addressable target; an artifact that conformantly declares none remains usable
and may yield an interface with no operations. An addressable target lacking a
capability, runtime prerequisite or supported representation is not thereby
destroyed. This revision adds no source-wide feature exclusion.

## 3. Target and applicable declarations

Binding `content` is an object with required `target` and optional `input` and
`output` members. It accepts no other members. Its absence or null is invalid.
`input` and `output` are value mappings defined in §4.

`target` is a literal [RFC 6901 string-form JSON Pointer](https://www.rfc-editor.org/rfc/rfc6901#section-3)
with one of these forms:

- `/paths/<escaped-path>/<fixed-operation-field>`
- `/paths/<escaped-path>/additionalOperations/<escaped-method>`

The fixed fields are `get`, `put`, `post`, `delete`, `options`, `head`, `patch`,
`trace` and `query`. Decode `~0` and `~1` once; do not URI-percent-decode the
pointer. The corresponding fixed HTTP method is uppercase. An additional method
is sent in its exact declared case. OAS prohibits additional entries for the
nine fixed method tokens; case-distinct extension tokens remain distinct.

After selecting the Paths member, resolve its Path Item `$ref` before selecting
the operation. Noncolliding adjacent fields contribute to the effective Path
Item. Merge `additionalOperations` by exact method key; a collision makes only
that selected method ambiguous. A fixed field used by the selected operation that
occurs both locally and in the referenced item is ambiguous and makes that
operation unavailable. An overridden or otherwise unused inherited field creates
no such ambiguity. An unavailable referenced item prevents determining the
effective item; local fields do not replace the missing reference. A missing
selected operation is not a target. Exact CONNECT is unsupported because
its successful interaction is a tunnel; other method tokens do not acquire
CONNECT semantics by case-insensitive comparison.

A mounted operation inherits top-level server and security declarations from
the entry OAS document, including when its Path Item was referenced from another
document. Operation and effective Path Item overrides retain their ordinary
precedence. Relative references and relative Server URLs retain the base of the
document contributing that declaration; mounting does not rebase them. The
security scheme-name lookup choice in §9 is separate from this inheritance rule.

Only declarations needed for the selected interaction govern invocation. A defect
in an unrelated operation, documentary field or unselected alternative does not
prevent it. A needed invalid or unsupported parameter, media, server or security
alternative is unusable at that position; usable siblings remain available.
When a required condition cannot be satisfied by any remaining alternative, the
operation cannot be invoked. If a missing runtime choice or capability can make
the operation usable, it remains a prerequisite rather than an invalid artifact.
Unknown fields and `x-` extensions create no behavior under this kind.

The default supported schema dialect is OAS's base dialect. A different root
`jsonSchemaDialect` or resource `$schema` is unsupported only where interpretation
actually depends on that schema. Reading an unrelated target does not require
interpreting it. This includes JSON carriage that needs no schema inspection.

Where a rule below needs a declared type or member, follow Schema `$ref`. For
`allOf`, intersect admitted instance categories, treating integer as a subset of
number; an absent type adds no restriction. Other inspected member declarations
must agree where combined. For `anyOf`/`oneOf`, ignore false schemas, statically empty category
intersections and null-only branches: exactly one candidate must remain, or every
remaining candidate must determine the same needed declaration. An unrestricted candidate does not establish such agreement.
Do not use `not` or conditionals to invent a uniquely determined declaration.
A false schema or empty category intersection admits no supplied value at an
inspected position. If needed static inspection reaches `$dynamicRef`, this kind
provides no static answer. A serializer with access to independently validated data uses that data to
determine the needed type where possible, as OAS requires. Otherwise the static
inspection rules above apply. This does not make validation mandatory. Apparent
unvalidated runtime type alone does not substitute for either determination. If neither supplies the needed
answer, the position is unsupported. Schema references remain distinct from
Reference Objects and Path Item references under OAS.

Invocation does not imply general validation against OAS schemas. Presence,
routing, encoding and the specific declaration inspections below still apply.
A separate claim of schema validation remains subject to its governing authority.

## 4. Operation-value correspondence

An input mapping adapts one caller value to a request value. An output mapping
adapts each successful decoded response value independently to an operation value.
Without a mapping, the respective value is unchanged. Mapping has no access to
credentials, status codes, headers or other transport state.

A mapping is an object containing exactly one of:

| Form | Result |
| --- | --- |
| `{"at": "<pointer>", "up": <integer>}` | Select by literal RFC 6901 string-form pointer. Optional `up` defaults to zero (current input); one selects the input enclosing the current `each.value`, two the next enclosing input, and so on. Empty pointer selects that entire input. An unresolved pointer produces absence. |
| `{"literal": <JSON value>}` | That value, including null. |
| `{"object": {"name": <mapping>, ...}}` | An object made from independently evaluated members; an absent member result is omitted. |
| `{"array": [<mapping>, ...]}` | An array of evaluated results in order; an absent element is a mapping failure. |
| `{"each": {"in": <mapping>, "value": <mapping>}}` | Evaluate `in`, then evaluate `value` separately with each selected array item as its input, preserving order. An absent collection produces absence; a non-array collection or absent item result is a mapping failure. |

Mappings are finite JSON trees. Nested mappings use their enclosing mapping
input, except that `each.value` uses the current item and adds one enclosing-input
scope; nested `each` forms apply the same rule. Object/array construction adds no
scope. `up` is allowed only on `at`, must be a nonnegative integer, and must name
an existing scope in the mapping tree; otherwise the binding is invalid. An empty
collection produces an empty array. The `each` object has exactly the two members
shown; no item index is supplied. An absent input has no selectable value, including at the empty pointer.
A malformed mapping is invalid binding content. A failed input mapping prevents
dispatch; a failed output mapping makes completion unsuccessful. Absence after
an output mapping emits no value; it does not produce JSON null. A mapping
constructs values only: it defines no arithmetic, arbitrary expressions, external
lookup or implicit coercion. The operation's claimed contract must still
be faithfully realized under core; a mapping is not evidence of that claim.

The request value is absent or an object with only optional `parameters` and
`body`. Absence is equivalent to supplying neither member. Present `parameters`
is an object keyed by effective OAS parameter names, after parameters excluded
by the governing OAS or kind rules are removed (including the ignored and
unavailable fields in §6). Missing implementation capabilities or runtime
context, and value-dependent failures, do not remove a parameter for key
construction or change any key. Where any remaining name occurs at more than
one location, all parameter keys are `<location>/<RFC6901-escaped-name>`;
otherwise they are the exact names. OAS determines identity, overrides, ignored
parameters and destinations. Unknown keys and wrong-shaped request values are
not representable and prevent dispatch. Absent members are not supplied; null members
are supplied null values, whose representability is determined below.

The request envelope is a kind-defined intermediate value, not a mandatory
operation-contract shape. For example, an input mapping can construct `body`
from application fields and map an unrelated application name into a path
parameter. Required effective parameters and request bodies must be supplied.
TRACE carries no body; supplying one prevents dispatch, while its OAS body
declaration creates no required-body obligation. Other admitted methods preserve
supplied declared bodies, including OAS's permitted but discouraged cases.

## 5. Target URL and context

OAS governs effective server scopes, variables and path appending. An empty
Operation or Path Item server list falls through to the outer scope. One usable
server alternative selects itself; multiple alternatives require a consumer
choice. Variable defaults apply; supplied substitutions must satisfy any enum.
A missing variable declaration can be completed by an explicit substitution.

Runtime context can instead supply a complete server base. It must be an
absolute `http` or `https` URL with a nonempty host and without userinfo, query
or fragment. The operation path still appends to that base; it does not replace
the method or artifact's parameter/body semantics. Append the leading-slash path
to the base, removing exactly one trailing slash from the base if present and
retaining every other path byte; do not collapse repeated slashes. An incomplete or invalid
chosen URL prevents dispatch. An unavailable declaration-derived server can be
recovered by this explicit replacement.

**[configuration point]** These names identify the choices this kind leaves to
its consumer. They are portable semantic names, not required SDK field names or
context-store keys. Each choice has the domain and effect below; §6–§9 determine
when it is needed. An unanswered necessary choice prevents dispatch. Supplying
it, discovering it and negotiating context remain outside this specification.
These choices do not become operation-input fields.

| Name | Admissible choice and effect |
| --- | --- |
| `server` | One effective server alternative with its required substitutions, or the complete replacement base allowed above. It fixes the URL base; it does not replace the operation path or method. |
| `requestMedia` | One concrete media type matching an admitted request alternative under §7. It selects that alternative's representation, without substituting another declaration's schema. |
| `security` | One complete effective Security Requirement alternative under §9, including an admitted anonymous alternative. Alternatives are never combined. Credentials satisfy the selected alternative separately. |
| `parameterConversion` | A deterministic conversion of booleans and numbers to strings for §6's schema/style paths, including array members and object values. Strings pass unchanged; null follows that section's separate rule. |
| `propertyMedia` | One concrete media type for an affected form or multipart property under §8, matching a declared alternative where one exists. It selects the property's representation. |
| `implicitConnectionScope` | `entry` or `referring` document for component-name Security Requirement lookup under §9. The default is `entry`; no unanswered-choice refusal applies to this default. |

## 6. Parameters and request assembly

OAS §4.12 and Appendices B–E govern effective parameters, required fields,
`style`, `explode`, `allowReserved`, `content`, `querystring`, path matching,
header/cookie serialization and URI escaping. RFC 6570 supplies URI-template
semantics where OAS incorporates it. Equivalent algorithms are permitted.

For schema-form parameters and Encoding's style-based path, context supplies a
deterministic conversion of booleans and numbers to strings. Strings retain their
value; null follows the selected serialization's undefined-value rules. Without
the needed conversion, the request cannot be formed. The conversion applies to
array members and object values as well. Content-based serialization instead
uses §8's media representation.

For schema-form serialization, supplied null uses OAS §4.12.6's undefined
column. Where the serialization incorporates RFC 6570, empty arrays and objects
contribute nothing under its §2.3 and OAS Appendix C.4.3; they are not substituted with null. An absent optional
parameter also contributes nothing; an empty string remains a supplied string.

A combination of parameter location, style, explode setting and value category
without OAS-defined serialization is unsupported. If only the supplied value
cannot be serialized, that invocation cannot dispatch; other invocations of the
operation remain usable. Undefined compound members and nested
compound shapes without an upstream expansion cannot be serialized by guessing.
For space/pipe-delimited forms, a scalar component containing its structural
separator is unsupported where splitting the decoded value cannot preserve it.
Deep-object property names containing `[` or `]` are unsupported because no
additional escape convention fixes their structural meaning. Deep-object scalar
values retain ordinary query-value encoding; encoded `&` or `=` in such a value
does not introduce another query member.

Mixed regular/reserved query parameters preserve each parameter's required
contribution within one query component. Order across distinct parameter
contributions is free; order within a supplied array is preserved. Illegal
RFC 6570 variable-name spelling is an assembly concern and never changes the
request-value key. For path and ordinary query content-form parameters, media
bytes are URI-encoded as one value, preserving them after percent-decoding.
Literal and percent-encoded unreserved bytes are equivalent; reserved delimiters
remain data rather than changing the URI structure. Header
and cookie content-form parameters instead carry those media bytes subject to
their field grammar, without an extra URI-encoding layer. Percent-triplet hex
case is free.

A `querystring` parameter supplies the entire query. URL-encoded content is
already query syntax; other admitted media bytes are percent-encoded as query
data. A supplied zero-byte representation produces a present empty query; an
omitted optional parameter produces none. Sequential querystring media are not
supported. Querystring and ordinary query parameter declarations cannot coexist.

Header characters become UTF-8 octets and must form a valid RFC 9110 field value;
leading/trailing field-line whitespace and forbidden controls cannot be repaired
into a different value. Cookie contributions must satisfy RFC 6265; no invented
escaping repairs an invalid cookie. An effective raw Cookie header must be a
complete cookie-string. It cannot be combined with structured cookie contributions.
An explicit `explode: false` on an `in: cookie` parameter is invalid under OAS
§4.12.2.2, including scalar parameters and both cookie styles.
Form-style cookie expansion with two or more `&`-separated pairs is unsupported;
zero or one pair remains subject to the ordinary cookie grammar. `style: cookie`
uses OAS's RFC 6265 mapping.

An invalid HTTP field or cookie name makes that parameter contribution unavailable;
required unavailable parameter contributions make invocation impossible; omitting an optional
unavailable parameter contribution does not. Case-distinct effective Header parameter names
remain distinct request keys. Supplying more than one contribution to the same
case-insensitive field is ambiguous and prevents dispatch; a single supplied
contribution remains usable. Parameters naming
transport-owned fields are likewise unavailable: Host, Content-Length, Connection, Keep-Alive,
Proxy-Authorization, Proxy-Connection, TE, Trailer, Transfer-Encoding or Upgrade.
OAS's ignored Accept, Content-Type and Authorization parameter declarations
create no request-value keys. Remaining declared parameter contributions must
not overwrite one another or selected credential contributions.

## 7. Media alternatives

Media identities use RFC 9110 parsing and comparison. A declared range matches
only when its parameters match: charset values compare case-insensitively;
other parameter values compare exactly. Prefer exact type/subtype over `type/*`
over `*/*`, then the greater declared-parameter count. Equal-specificity matches
are ambiguous; map order does not select one. Declarations normalizing to the
same identity are unusable for that identity, without removing clean siblings.

A body-free request has no body media selection. Otherwise, one usable concrete
alternative selects itself. Multiple alternatives or a usable range require
context to select a matching concrete media type. The selected type governs the
body and is emitted as Content-Type, with any necessary multipart boundary.
Examples and supplied body contents do not choose an alternative. Equivalent
media-type spelling and quoting are permitted under HTTP. A declared multipart
boundary participates in matching the chosen media identity, then the multipart
composer may replace it with a safe generated boundary and emit that value.

Response-media and transport content-coding negotiation are runtime policy.
Accept does not change response-status classification, the governing Response
Object or the interpretation of a received representation. A representation is
not excluded merely because its media parameters cannot be advertised through
Accept's weight syntax.

## 8. Values and media representations

The following mappings apply after HTTP content decoding and before output
adaptation. They also govern media-valued parameters and form parts. Where a
rule needs a type, §3's declaration or validated-data determination supplies it. Typeless does not mean
that other schema keywords disappear; it means they do not select a type.

| Representation | Operation-side value before adaptation |
| --- | --- |
| Non-sequential application/json or a +json subtype | The JSON value. |
| Non-JSON, non-form concrete media carrying an artifact-encoded string under the `contentEncoding` rule below | The encoded string as text, without an additional boundary Base64 decode. |
| text/*, application/xml or +xml, with uniquely determined string/boolean/number type | The corresponding JSON scalar. |
| Non-JSON, non-form concrete media with omitted or typeless schema | A Base64 string carrying the exact octets. |
| Name-based form or multipart request | An object whose members supply the declared properties. |
| Positional multipart and sequential JSON request | One array, with one element per item. |
| Successful sequential response | One decoded value per item, in order. |

Sequential forms take precedence over the scalar/raw rows. A concrete character
media declaration with ambiguous non-null type is unsupported where a unique
scalar type is needed and neither determination in §3 resolves it.
An unsupported media/data combination is unavailable at that alternative.

JSON uses RFC 8259 with UTF-8. Duplicate object names take the last member;
a leading BOM is ignored on receipt and not emitted. Unpaired surrogates are
not carried or replaced. Numbers retain their mathematical value; an implementation
unable to preserve a value reports a capability limit instead of substituting
another number. At least integers from -(2^53)+1 through (2^53)-1 are supported;
further numeric range and precision limits are declared capabilities. Internal
storage is unrestricted when the JSON value at each operation or native boundary
is preserved. Equivalent JSON spellings, member order and insignificant
whitespace are free.

Non-XML scalar text uses a declared charset, defaulting to UTF-8. XML media use
[RFC 7303 §3](https://www.rfc-editor.org/rfc/rfc7303#section-3) for character
encoding: on receipt a BOM takes precedence, then a MIME charset, then XML's
encoding declaration or default. An encoding-signature BOM is metadata, not a
character in the decoded text. Requests use an encoding consistent with those
rules and the supplied text; they do not rewrite its markup or declarations.
For both paths UTF-8 is required; additional encoders/decoders are runtime
capabilities. An unavailable required codec prevents encoding or decoding rather
than selecting a different character value.

After character decoding, or before character encoding, the same scalar
correspondence applies to both paths. Strings retain their characters. Booleans
use `true`/`false`; numbers use any RFC 8259 number spelling with the same
mathematical value. Scalar decoding accepts one such token with only JSON
whitespace around it, not a leading U+FEFF character or a second token. An integer
declaration selects the numeric decoder without adding runtime schema validation.
No scalar-text null spelling is defined. XML is opaque character text before any
declared scalar conversion; this kind performs no entity expansion or
object-to-XML conversion.

Raw octets use canonical RFC 4648 Base64: standard alphabet, padding and zero
unused pad bits. Noncanonical input is not repaired. This convention governs
the JSON value crossing the operation boundary, not the native body encoding.
An artifact-encoded string described using schema `contentEncoding` remains that
string; it does not trigger another OpenBindings Base64 decode. Artifact-encoded
text uses the character-encoding rules above even for non-character media such
as application/octet-stream. For JSON media the ordinary JSON mapping still
governs the whole value. Schema
`contentEncoding`, HTTP Content-Encoding and a part's Content-Transfer-Encoding
are distinct concepts governed by OAS and their respective protocols.

No schema default, example, readOnly or writeOnly annotation inserts or removes
a supplied application member. Serialization's explicit omission rules below
are the exceptions. A request mapping or serialization failure prevents dispatch.
On a successful HTTP response, a failure to obtain the specified value makes
completion unsuccessful. Failure-response data follows §10 instead.

### 8.1 Forms and multipart

OAS §§4.14.5 and 4.15 govern encoding by name/position, Encoding precedence,
default content types and nested Encoding Objects. URL encoding follows the
pinned WHATWG rules; multipart framing follows RFC 2046 and RFC 7578 as
incorporated by OAS. Member order across distinct named properties is free unless the selected
multipart subtype requires an order;
repeated elements of one array preserve its order. Boundary generation and
equivalent quoting are implementation choices. Upstream-permitted preambles and
epilogues have no operation-value meaning.

Supplied named members are not limited to names explicitly listed under
`properties`. Their governing schemas include applicable `properties`,
`patternProperties`, `additionalProperties` and `allOf` constraints. A supplied
member forbidden by those declarations cannot be represented; no undeclared
member is silently dropped. Encoding entries for absent members or positional
items create no values. For positional multipart/form-data, each array item is
the OAS-defined single-member object supplying that part's name and value; the
name determines its generated Content-Disposition. Positional order is preserved.

For content-based encoding, the selected media's §8 correspondence governs
supplied null as it does other values: JSON media carries JSON null. A supplied
null is one value, not an array to expand. If the selected media has no null
correspondence, an optional named property is omitted; a required property,
named-array item or positional item cannot be omitted and is unsupported. No
null spelling is invented for text or raw media. A null entire form body is not
an object and cannot be encoded as a form. Style-based encoding uses §6's undefined-value rules.

An encoded named array property's item declaration selects each part's media;
other properties use their whole-value declaration. A multi-type declaration
with no unique default, a range or multiple Encoding content types needs a
concrete context-supplied property media choice. That choice must match a declared
alternative where one exists, and applies to every emitted item of that property.
Absent properties need no media choice. A supplied value at an inspected false schema
is unrepresentable; an unused impossible property does not poison its siblings.

Name-based form and multipart decoding into response objects is unsupported:
this kind does not adopt OAS's name-based inverse into its response-value
correspondence. Positional
multipart response decoding remains supported. A collision between separately
declared serialized property sources is unsupported; repeated items of the same
property are not such a collision.

Generated form-data Content-Disposition identifies the exact UTF-8 property
name using any permitted quoting that preserves it; no filename is invented.
An artifact-fixed disposition may supply a filename, but must preserve that
name and satisfy the media subtype's restrictions, including RFC 7578's ban on
filename*. Illegal field names or values cannot be repaired.

Other non-ignored Encoding headers have no implicit caller channel. They are
supplied only when a schema-form declaration fixes a raw field string through
`const` or a single-string `enum`; defaults and examples are not fixed values.
Content-form Header Objects supply no fixed field value under this kind. Case-equivalent
header declarations describe one field. Their fixed values must agree and satisfy
any applicable finite raw-string domains from string `const`/`enum`, intersected
through `$ref`/`allOf`. A required header with no fixed value makes the alternative
unsupported; an optional nonfixed header emits nothing. Other schema constraints
are not silently claimed to have been represented in synthesis.

OAS's ignored Content-Type Encoding header does not compete with media selection.
A schema contentEncoding annotation alone generates no Content-Transfer-Encoding
field. An explicit artifact-fixed field matching the string's declared encoding
can be emitted where the subtype permits it; for form-data this explicit
declaration supplies the reason to use the deprecated field. It causes no second
encoding. A header rejecting the declared encoding makes the affected part
unusable; a transfer encoding requiring another transformation is unsupported.
Coherent artifact-fixed headers must also satisfy the selected multipart subtype's
rules. Encoding's
mutual exclusions and positional prerequisites remain OAS requirements.
One level of nested Encoding is required by OAS; deeper levels may be supported
under the same recursive semantics. A depth limit is a reported implementation
capability, not a different meaning of the artifact.

### 8.2 HTTP content codings

Actual Content-Encoding determines the ordered coding stack under RFC 9110 §8.4;
declarations alone do not select a coding. Request coding comes from the effective
supplied Header parameter; response coding comes from received fields. Codings
are applied in order and removed in reverse. Unknown or failed codings cannot be
silently skipped. Codec availability is runtime capability. A body-free request
cannot supply Content-Encoding for a nonexistent representation.

A non-ignored governing response Header declaring required presence must be
present. OAS ignores a response Header named Content-Type, including its required
flag. Header names compare case-insensitively. For Content-Encoding, combine field lines under
HTTP, using comma-plus-space for the string against which artifact constraints
are interpreted; intersect any finite string const/enum domains reached through
`$ref`/`allOf`. This normalization fixes the value under an exact string constraint,
not the wire spelling. Other response header schemas impose no new deserialization
or operation output fields. Unsupported schema meaning cannot be claimed as
faithfully synthesized. No-content responses still check field grammar and those
constraints but do not require a decoder for nonexistent content.

### 8.3 Sequential media

Supported sequence forms are application/jsonl, application/x-ndjson,
application/json-seq and +json-seq, text/event-stream responses, and positional
multipart. OAS §§4.14.3–4.14.6 define item/aggregate schema scope and Encoding.
A sequential request consumes one array; it does not create a caller-input stream.
This kind supplies no SSE request serialization. Other undefined sequence framings
are unsupported instead of inferred from payloads or a live registry.

JSONL/NDJSON items are LF-delimited JSON texts; a CR immediately before LF is
part of the delimiter. A final text may end at EOF. A trailing delimiter creates
no extra item; blank or whitespace-only lines are malformed. RFC 7464/8091 govern
JSON text sequences. Malformed items terminate decoding rather than being skipped.

An SSE event is parsed under the incorporated HTML rules and produces an object:
`data` is its accumulated data with the final LF removed; `event` is present only
for a nonempty type declared by that block; `id` only if that block declared it;
`retry` only if that block supplied a valid nonnegative integer. Empty-data blocks
that dispatch no event produce no item. Do not invent a `message` type or copy
last-event-ID/retry state into later items. OAS's event object is the value here,
not just its data string. Automatic reconnection does not silently extend this
interaction with a second request.

For a successful final HTTP status, each decoded item is adapted and emitted
independently. Earlier emitted values remain values when a later item, decoder,
transport or mapping fails; completion is unsuccessful alongside them. A clean
end completes successfully. Runtime resource limits may stop an interaction but
must not truncate an item into a successful value or retract prior values.
Aggregate native schema constraints do not imply automatic validation.

## 9. Security and contribution ownership

OAS governs security inheritance, OR alternatives, AND membership, anonymous
alternatives and scheme identification. One usable complete alternative selects
itself; multiple alternatives require a context choice. Do not combine fragments
of different alternatives. A malformed scheme removes alternatives depending on
it, not unrelated alternatives.

For a component-name requirement in a non-entry document, context may select
entry or referring-document scope, defaulting to entry; URI requirements use
OAS's URI rules. Scope/role strings remain the declared strings. Credential
acquisition, token-grant inspection and enforcement by the counterparty are not
performed by this kind.

Basic uses RFC 7617 with printable ASCII user-id/password because no charset
selection is declared here. Bearer and OAuth/OpenID access tokens use RFC 6750's
b64token syntax and Bearer carriage; unsupported token types cannot be guessed
into that form. HTTP authentication scheme names are case-insensitive;
equivalent protocol-permitted field spelling is free. This does not permit
changing credential values. API keys use their exact declared
destination: query name/value are separately UTF-8 percent-encoded, header values
use the field rules above, and cookies use RFC 6265 without invented escaping.
Mutual TLS and other HTTP schemes require runtime capability satisfying the
selected prerequisite; this kind defines no extra credential bytes for them.

Selected credentials cannot overwrite other credentials, supplied parameters or
transport-owned fields. Header destinations compare case-insensitively; query
and cookie names compare exactly. Collision with a required fixed contribution
makes that alternative unusable; a collision depending on optional or expanded
values prevents only an invocation producing both. The same rule covers raw
versus structured Cookie sources. A selected query credential cannot be combined
with a supplied whole-querystring parameter. This preserves clean alternatives
and invocations omitting an optional conflicting contribution.

Credential destinations cannot claim Host, Content-Length, Content-Type,
Content-Encoding, Connection, Keep-Alive, Proxy-Authorization, Proxy-Connection,
TE, Trailer, Transfer-Encoding or Upgrade. A credential targeting Accept or
Accept-Encoding cannot compete with a separately generated runtime negotiation
contribution: the runtime must omit its contribution or prevent dispatch.
TRACE cannot carry sensitive credential or Cookie fields; compatible anonymous
or mutual-TLS alternatives remain available. Other value sensitivity remains
the caller's responsibility where the artifact declares none.

When following a redirect, binding-selected Authorization and header API keys,
and every binding-produced Cookie contribution (ordinary parameters, raw Cookie
headers and credentials), may be forwarded only to the same origin (scheme, host
and effective port). Never append a selected query credential to the redirect's
Location. Credentials do not become application inputs or outputs.

## 10. Response and completion

OAS determines response declarations. Choose exact status before its matching
range before default. Invalid declaration content does not cause fallback to a
less-specific status key. Responses may be omitted; a present Responses Object
with no response-code or default entry is invalid. Documentary defects do not
invalidate usable response media or headers.

The final 2xx status is successful HTTP status. Interim responses do not complete
the interaction. Redirect following is runtime policy; a redirect preserving the
method and complete body remains within this interaction. A method-rewriting
redirect ends it; later activity is a different interaction. An unsolicited 101
is unsupported and cannot be treated as an ordinary success or awaited as if it
were an interim response.

For nonempty content, Content-Type selects the most specific matching content
declaration under §7. An absent Content-Type means application/octet-stream.
Multiple Content-Type values do not permit choosing an arbitrary one. An
unmatched, ambiguous or unusable representation under successful HTTP status
makes completion unsuccessful. A failed decoding or mapping does likewise.

An empty response emits no value, not null or an empty string. Emptiness means
zero octets after content decoding where content is permitted. For HEAD and
statuses forbidding content, HTTP's no-content semantics govern and there is no
application output; do not run a content decoder over absent content. Forbidden
actual content or violated required response-header conditions is an error.

A nonempty non-sequential successful response produces one decoded value, subject
to output mapping. It is emitted only after the complete representation and its
decoding succeed; a truncated unary response supplies no partial value. Sequential
response values and late failures follow §8.3. Headers and Link Objects do not
implicitly become output members.

A non-2xx final status completes unsuccessfully and emits no operation output
values. A runtime may inspect its body, including best-effort decoding through
the declared media mapping, for diagnostics outside this operation's value
correspondence. Such observations are not operation returns and do not acquire
an exemption from core's output contract by being called errors. Neither
diagnostic decoding nor output mapping turns them into operation outputs under
this kind. Failed diagnostic decoding does not obscure unsuccessful completion.

Cancellation or local abandonment ends this invocation unsuccessfully, with no
further operation outputs; already emitted values stand. It does not assert rollback of
remote effects. No particular cancellation API, scheduling or connection strategy
is required.

## 11. Synthesis and conformance

An emitted operation/binding correspondence must faithfully realize the claimed
operation contract through these rules. Generation may choose operation names,
contract shapes and a subset of targets. It need not generate every target or
publish a coverage report. A claim of complete coverage must be true, and a lossy
schema translation must not be presented as faithful. Core's disclosure and
conformance-reporting duties continue to apply.

Callbacks and webhooks, when represented, become dependencies with input describing
the request the service sends and output describing the response it expects.
They do not become invocable parent-operation targets or deployed receivers.
Preserve distinct consumption points; their names and schema layouts are generation
policy. These dependencies carry no `kinds` constraint.

Conformance to this kind is separate from core document conformance. A document's
unknown kind or unavailable external resource does not establish a core violation.
For kind interpretation, distinguish invalid content from unavailable resources,
unsupported capability and missing context. Implementations may report those
distinctions through their own API; no diagnostic schema or processing-phase
vocabulary is prescribed. No requested operation is dispatched when its necessary
interpretation, input correspondence or context is unresolved.

Any claim of support identifies its capabilities and limitations. It must preserve
the defined meaning in supported cases and report inability instead of silently
substituting another interpretation. Tests of this specification compare those
meanings and its permitted alternatives, not incidental wire bytes or internal
execution order.
