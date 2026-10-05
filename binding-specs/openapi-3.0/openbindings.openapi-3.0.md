# OpenBindings kind for OpenAPI 3.0

**Status: unreleased `@1` candidate.** This document proposes the meaning of
`openbindings.openapi-3.0@1`; it does not publish the identifier.

## 1. Authority and scope

This kind incorporates [OpenBindings Specification 0.2.0](../../openbindings.md).
It incorporates [OpenAPI 3.0.4](https://spec.openapis.org/oas/v3.0.4.html)
(OAS), its normative references for the features used below, and
[HTTP Semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110).
Entry documents have `openapi` equal to `3.0.0`, `3.0.1`, `3.0.2`, `3.0.3` or `3.0.4`.
The 3.0.4 text governs interpretation for all five admitted values, including
its corrections and clarified rules; the patch value is an admission test,
not a choice of semantics. Later editions are not implicitly admitted.
The kind string is compared exactly under core.

The following table identifies the upstream rules governing each interpretation.
This document supplies the additional decisions and express restrictions below;
otherwise the incorporated authority governs, including its permitted variation.

| Subject | Incorporated OAS sections |
| --- | --- |
| Artifact structure, references, bases, dialects | §§4.2–4.4, 4.6, 4.7.23–4.7.24 |
| Servers, path construction, operation identity | §§4.7.5–4.7.10 |
| Parameter identity, overrides and serialization | §4.7.12, Appendices B–E |
| Bodies, media selection, forms and multipart | §§4.7.13–4.7.15 |
| Responses, headers and callbacks | §§4.7.1, 4.7.16–4.7.21 |
| Security requirements and schemes | §§4.3.2, 4.7.27–4.7.30, Appendix F |

Schema Objects use the closed OAS 3.0 vocabulary defined by §4.7.24, not a
later JSON Schema dialect. The JSON and XML suffix meanings use RFC 6839; Base64 uses
[RFC 4648 §4](https://www.rfc-editor.org/rfc/rfc4648#section-4).

The kind defines an HTTP request with unary input and at most one response value.
It defines no tunnel, protocol upgrade, callback receiver, retry policy,
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
schema for scalar values and requiring JSON-compatible results. This deliberately
accepts Core-schema scalar spellings beyond YAML's stricter JSON-schema resolution;
OAS's Failsafe-schema scalar-key rule governs mapping keys separately.
An entry document must produce a JSON object. A referenced Schema Object is
also an object; this edition does not admit boolean schemas. Scalar mapping keys denote their string
spellings (so plain `200:` names `200`); duplicate keys, non-scalar keys,
non-JSON values, incompatible explicit tags and multiple documents are invalid.
Retrieved documents use YAML's specified character-encoding detection; a byte
order mark is representation metadata. A JSON object supplied directly needs no
text parsing. Referenced documents use the same representation rules but need
not be OAS entry documents.

`location` supplies the retrieval URI for embedded content as well as retrieved
content. OAS references resolve against the containing document's retrieval URI;
`$id`, `$schema`, anchors and `$self` introduce no base or reference mechanism
in this edition. Relative API server URLs also use their containing document's
retrieval URI. The containing OBI's acquisition URI supplies neither
base. Without a suitable base, a relative reference or server URL requiring it
cannot be interpreted; self-contained references remain usable. Redirected
artifact acquisition uses the final retrieval URI for a location-only source.

A Reference Object replaces itself with its referenced value; adjacent
properties are ignored, including when it appears in a Schema Object position.
The reached value and its needed reference closure govern interpretation, not
unrelated material in its retrieved document. The referenced document need not
be an OAS entry document. Fragment references use RFC 6901 JSON Pointers.
Reference cycles do not by themselves invalidate a document. A node used in
different reference contexts is interpreted separately in each expected OAS
object type. Path Item references have the separate adjacent-field rule below.

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
of the form `/paths/<escaped-path>/<operation-field>`. The operation fields are
`get`, `put`, `post`, `delete`, `options`, `head`, `patch` and `trace`, denoting
the corresponding uppercase HTTP method. Decode `~0` and `~1` once; do not
URI-percent-decode the pointer. An absent or malformed target is invalid binding
content; a pointer that identifies no such operation has no target.

After selecting the Paths member, resolve its Path Item `$ref` before selecting
the operation. Noncolliding adjacent fields contribute to the effective Path
Item. A field used by the selected operation that occurs both locally and in
the referenced item is ambiguous and makes that operation unavailable. An
overridden or otherwise unused inherited field creates no such ambiguity.
An unavailable referenced item prevents determining the effective item; local
fields do not replace the missing reference. These choices resolve OAS's
otherwise undefined adjacent-Path-Item-field case.

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

Schema Objects follow OAS 3.0's extended subset of JSON Schema Wright Draft 00.
A declared `type` is one string, never an array. Boolean schemas are invalid
except for the expressly boolean-or-object `additionalProperties` field.
`nullable: true` adds null only beside an explicit `type` in the same Schema
Object; other constraints still apply. Unlisted keywords, including `const`,
`patternProperties`, `$id`, `$schema`, `contentEncoding` and `contentMediaType`,
create no interpretation under this kind. Do not import them from later editions.

Where a rule below needs a declared type or member, follow Reference Objects.
For `allOf`, intersect admitted instance categories, treating integer as a subset
of number; an absent type adds no restriction. Other inspected member
declarations must agree where combined. For `anyOf`/`oneOf`, ignore statically
empty category intersections and null-only branches: exactly one candidate must
remain, or every remaining candidate must determine the same needed declaration.
An unrestricted candidate does not establish such agreement. `not` supplies no
static declaration. An empty category intersection admits no supplied value at
an inspected position. Apparent runtime type does not substitute for a needed
declaration; if inspection supplies no answer, that position is unsupported.
This finite inspection does not establish general schema satisfiability.

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
parameter. Required effective parameters and honored required request bodies must be supplied.
For POST, PUT and PATCH, a supplied declared body follows its Request Body Object.
On GET, HEAD, DELETE and OPTIONS this kind follows OAS 3.0's rule to ignore
request-body declarations where HTTP defines no request-body semantics; these
create no required-body obligation. TRACE cannot carry a request body under HTTP.
Supplying a body for any of those five methods prevents dispatch rather than
silently discarding the supplied value. PATCH body semantics use RFC 5789.

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

OAS §4.7.12 and Appendices B–E govern effective parameters, required fields,
`style`, `explode`, `allowReserved`, `content`, path matching,
header/cookie serialization and URI escaping. RFC 6570 supplies URI-template
semantics where OAS incorporates it. Equivalent algorithms are permitted.

For schema-form parameters and Encoding's style-based path, context supplies a
deterministic conversion of booleans and numbers to strings. Strings retain their
value; null follows the selected serialization's undefined-value rules. Without
the needed conversion, the request cannot be formed. The conversion applies to
array members and object values as well. Content-based serialization instead
uses §8's media representation.

For schema-form serialization, supplied null uses OAS §4.7.12.4's undefined
column. Where the serialization incorporates RFC 6570, empty arrays and objects
contribute nothing under its §2.3 and OAS Appendix C.4.3; they are not substituted with null. An absent optional
parameter also contributes nothing; an empty string remains a supplied string.

**[pin]** Apply the matrix/label undefined-value correction published in
[OAS 3.2.1 §4.12.6](https://spec.openapis.org/oas/v3.2.1.html#style-examples):
null contributes the empty string in those two styles, as RFC 6570 requires.
This corrects those cells only; it does not incorporate another OAS feature set.

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

Schema-form Header Parameters and Header Objects use simple serialization
without URI percent-encoding or automatic quoting. This express override of
OAS 3.0.4 Appendix D applies the corrected header interpretation documented in
[OAS 3.1.2 Appendix D](https://spec.openapis.org/oas/v3.1.2.html#appendix-d-serializing-headers-and-cookies);
it incorporates only that correction, not the later edition's other features.
Header characters become UTF-8 octets and must form a valid RFC 9110 field value;
leading/trailing field-line whitespace and forbidden controls cannot be repaired
into a different value. Cookie contributions must satisfy RFC 6265; no invented
escaping repairs an invalid cookie. An effective raw Cookie header must be a
complete cookie-string. It cannot be combined with structured cookie contributions.
Schema-form cookie parameters retain OAS/RFC 6570 percent-encoding; cookie
credentials instead carry their declared values under RFC 6265 without added
escaping. A form-style cookie expansion representing multiple logical values,
whether exploded pairs or a non-exploded compound value, is unsupported. Zero
or one logical value remains subject to cookie grammar. Structured cookies join
as `name=value` pairs separated by `; `, with no required order across names.

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
rule needs a type, §3's declaration inspection supplies it. Typeless does not mean
that other schema keywords disappear; it means they do not select a type.

| Representation | Operation-side value before adaptation |
| --- | --- |
| Non-sequential application/json or a +json subtype | The JSON value. |
| Non-JSON, non-form concrete media carrying an artifact-encoded string under the `format: byte` rule below | The encoded string as text, without an additional boundary Base64 decode. |
| text/*, application/xml or +xml, with uniquely determined string type and no binary format | The string. |
| Non-JSON, non-form concrete media with omitted/typeless schema, or string with format: binary | A Base64 string carrying the exact octets. |
| Name-based form or multipart request | An object whose members supply the declared properties. |

A concrete character-media declaration without a uniquely determined string
type is unsupported in the ordinary character mapping. OAS's content-based form
property mapping below additionally defines number and boolean text values.
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

Non-XML character text uses a declared charset, defaulting to UTF-8. XML media
use [RFC 7303 §3](https://www.rfc-editor.org/rfc/rfc7303#section-3) for character
encoding: on receipt a BOM takes precedence, then a MIME charset, then XML's
encoding declaration or default. An encoding-signature BOM is metadata, not a
character in the mapped string. Requests use an encoding consistent with those
rules and the supplied text; they do not rewrite its markup or declarations.
UTF-8 is required; additional encoders/decoders are runtime capabilities. An
unavailable required codec prevents encoding or decoding rather than selecting
a different character value. XML remains one text value with no entity expansion
or object-to-XML conversion.

Raw octets use canonical RFC 4648 Base64: standard alphabet, padding and zero
unused pad bits. Noncanonical input is not repaired. This convention governs
the JSON value crossing the operation boundary, not the native body encoding.
A schema declaring string as its sole non-null type with `format: byte` carries
its artifact-encoded Base64 string as text; crossing this boundary does not
trigger another Base64 decode. `format: binary` instead denotes unencoded octets
and uses the raw mapping. Artifact-encoded text uses the character-encoding
rules above even for non-character media such as application/octet-stream.
For JSON media the ordinary JSON mapping still governs the whole value. OAS's raw-content length constraints measure octets, not the
Base64 boundary string, when schema validation is claimed. Later-edition
`contentEncoding` creates no behavior. HTTP Content-Encoding and a part's
Content-Transfer-Encoding remain separate protocol concepts.

No schema default, example, readOnly or writeOnly annotation inserts or removes
a supplied application member. Serialization's explicit omission rules below
are the exceptions. A request mapping or serialization failure prevents dispatch.
On a successful HTTP response, a failure to obtain the specified value makes
completion unsuccessful. Failure-response data follows §10 instead.

### 8.1 Forms and multipart

OAS §§4.7.14–4.7.15 and Appendices B–E govern request property encoding,
Encoding precedence and default content types. Multipart framing uses RFC 2046 and, for form-data, RFC 7578. A multipart
request requires a schema determining the property correspondence. Named parts
use OAS's Content-Disposition form-data/name correlation where the selected
subtype permits it, including multipart/mixed. This kind supplies no positional
part mapping or form/multipart response-to-object decoding. Those alternatives
are unsupported; ordinary scalar/raw mappings do not bypass missing correspondence.

For application/x-www-form-urlencoded, an explicit Encoding `style`, `explode`
or `allowReserved` selects the style path; absent sibling controls take their
defaults and `contentType` is ignored. With all three absent, content-based
encoding applies. This fixes the branch recommended by OAS 3.0.4 §4.7.15.1.2.
All multipart subtypes ignore these style controls and use content-based encoding,
as OAS requires. The style path uses §6's scalar conversion and undefined-value
rules. Form-urlencoded uses the incorporated
form-encoding semantics; equivalent representations that decode to the same
property names and values are permitted, including SPACE as `+` or `%20` and
hexadecimal percent-triplet case. The style path retains its own RFC 6570 rules.

The governing property schema determines each property's representation,
using an exact `properties` declaration or, for an otherwise undeclared member,
`additionalProperties`, with applicable `allOf` constraints. Boolean true yields
an unrestricted property declaration; false makes an undeclared supplied member
not representable and prevents dispatch. `patternProperties` adds no route in this edition. For content-based encoding, the selected media's §8 correspondence governs
supplied null as it does other values: JSON media carries JSON null. A supplied
null is one value, not an array to expand. If the selected media has no null
correspondence, an optional named property is omitted; a required property or
array item cannot be omitted and prevents dispatch. No null spelling is invented
for text or raw media. A null entire form body is not an object. A supplied
value at an inspected empty category intersection is unrepresentable; an unused
impossible property does not poison its siblings.

OAS determines default content types. Multipart array properties emit one part
per item and use the item declaration for each part. A form-urlencoded content
property is one media-serialized value; an item-derived default that cannot
serialize that whole value needs an explicit usable property media choice.
A wildcard or multiple Encoding content types likewise needs a concrete context
choice matching a declared alternative. Absent properties need no media choice.
Number/boolean form values under text/plain use a value-preserving RFC 8259
number spelling or `true`/`false`; this is not the configurable style converter.
No scalar null spelling is invented. Ordinary §8 mappings govern other values.

Repeated parts for one array preserve order; order across named properties is
free. Boundary generation, legal quoting and discardable preambles/epilogues are
implementation choices. Generated Content-Disposition preserves the exact UTF-8
property name using permitted quoting and invents no filename. An artifact-fixed
disposition may supply a filename but must preserve the name and form-data type,
and satisfy the subtype's restrictions, including RFC 7578's prohibition of
filename* for form-data. Invalid names or field values
cannot be repaired into different data.

Non-ignored Encoding headers have no implicit caller channel. They are supplied
only when a schema-form declaration fixes a raw field string through a single-string `enum`;
defaults and examples do not fix values. Content-form Header Objects supply no
fixed field value under this kind. Case-equivalent header declarations
describe one field. Their fixed values must agree and satisfy applicable finite
raw-string enum domains, intersected through `$ref`/`allOf`. A required
header with no fixed value makes the alternative unsupported; an optional
nonfixed header emits nothing. Other schema constraints do not silently become
represented in synthesis. Ignored Content-Type headers do not compete with
Encoding media selection.

A `format: byte` part retains its already encoded Base64 text. OAS equates that
format with a transfer-encoding declaration requiring base64. This declaration
equivalence alone causes no generated Content-Transfer-Encoding field, following
RFC 7578's advice for form-data. An explicit artifact-fixed `base64` field can
be emitted where the subtype permits it; this explicit declaration supplies the
reason to use the deprecated field for form-data. It causes no second encoding.
A header rejecting base64 makes the affected part unusable. A requested transfer
encoding requiring another transformation is unsupported. Conflicting fixed
header declarations are independently unusable. Neither the copied later-schema
terminology in OAS's multipart discussion nor an unknown schema keyword expands
the closed 3.0 vocabulary. No nested Encoding mechanism is inferred.

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
are interpreted; intersect any finite string enum domains reached through
`$ref`/`allOf`. This normalization fixes the value under an exact string constraint,
not the wire spelling. Other response header schemas impose no new deserialization
or operation output fields. Unsupported schema meaning cannot be claimed as
faithfully synthesized. No-content responses still check field grammar and those
constraints but do not require a decoder for nonexistent content.

## 9. Security and contribution ownership

OAS governs security inheritance, OR alternatives, AND membership, anonymous
alternatives and scheme identification. One usable complete alternative selects
itself; multiple alternatives require a context choice. Do not combine fragments
of different alternatives. A malformed scheme removes alternatives depending on
it, not unrelated alternatives.

For a component-name requirement in a non-entry document, context may select
entry or referring-document scope, defaulting to entry. Requirement keys are
component names under this edition; URI-looking keys gain no URI interpretation. Scope/role strings remain the declared strings. Credential
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
Other HTTP authentication schemes require runtime capability satisfying the
selected prerequisite; this kind defines no extra credential bytes for them.
The later OAS `mutualTLS` scheme type is not part of this edition.

Selected credentials cannot overwrite other credentials, supplied parameters or
transport-owned fields. Header destinations compare case-insensitively; query
and cookie names compare exactly. Collision with a required fixed contribution
makes that alternative unusable; a collision depending on optional or expanded
values prevents only an invocation producing both. The same rule covers raw
versus structured Cookie sources. This preserves clean alternatives
and invocations omitting an optional conflicting contribution.

Credential destinations cannot claim Host, Content-Length, Content-Type,
Content-Encoding, Connection, Keep-Alive, Proxy-Authorization, Proxy-Connection,
TE, Trailer, Transfer-Encoding or Upgrade. A credential targeting Accept or
Accept-Encoding cannot compete with a separately generated runtime negotiation
contribution: the runtime must omit its contribution or prevent dispatch.
TRACE cannot carry sensitive credential or Cookie fields; compatible anonymous
alternatives remain available. Other value sensitivity remains
the caller's responsibility where the artifact declares none.

When following a redirect, binding-selected Authorization and header API keys,
and every binding-produced Cookie contribution (ordinary parameters, raw Cookie
headers and credentials), may be forwarded only to the same origin (scheme, host
and effective port). Never append a selected query credential to the redirect's
Location. Credentials do not become application inputs or outputs.

## 10. Response and completion

OAS determines response declarations. Choose exact status before its matching
range before default. Invalid declaration content does not cause fallback to a
less-specific status key. An Operation requires a Responses Object with at least one response-code or
default entry; absent, empty or extension-only responses make the selected
operation unusable before dispatch. Documentary defects do not
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

A nonempty successful response produces one decoded value, subject
to output mapping. It is emitted only after the complete representation and its
decoding succeed; a truncated unary response supplies no partial value. There is no sequential response mapping. Media names such as
text/event-stream do not split a response into items; where admitted by §8 they
produce one whole-representation value. Headers and Link Objects do not
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

Callbacks, when represented, become dependencies with input describing
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
