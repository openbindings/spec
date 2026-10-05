# OpenBindings kind for OpenAPI 2.0

**Status: unreleased `@1` candidate.** This document proposes the meaning of
`openbindings.openapi-2.0@1`; it does not publish the identifier.

## 1. Authority and scope

This kind incorporates [OpenBindings Specification 0.2.0](../../openbindings.md).
It incorporates [OpenAPI 2.0](https://spec.openapis.org/oas/v2.0.html)
(OAS), its normative references for the features used below, and
[HTTP Semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110).
An entry document has `swagger` exactly equal to the string `2.0`. No other
edition or an `openapi` field substitutes for that discriminator. The kind
string is compared exactly under core.

This document supplies the additional decisions and express restrictions below;
otherwise the incorporated authority governs, including its permitted variation.

| Subject | Incorporated OAS sections |
| --- | --- |
| Artifact structure and references | §§6.1–6.4.1, 6.4.17 |
| Paths, operations and target construction | §§6.4.1, 6.4.5–6.4.7 |
| Parameters, collection formats and form payloads | §§6.4.9–6.4.10 |
| Responses and headers | §§6.4.11–6.4.15 |
| Schema Objects and data forms | §§6.3, 6.4.18–6.4.19 |
| Security definitions and requirements | §§6.4.23–6.4.26 |

JSON Reference draft-03, named by OAS's bibliography, governs instead of its
inline draft-02 link ([draft-03 §§3–4](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03)). Schema Objects use OAS's closed subset of JSON Schema
draft-04, not the full dialect or a later one. RFC 9110 governs where it
supersedes older HTTP references. JSON and XML suffix meanings use RFC 6839;
raw-octet values use [RFC 4648 §4](https://www.rfc-editor.org/rfc/rfc4648#section-4).

The kind defines an HTTP request with unary input and at most one response value.
It defines no tunnel, protocol upgrade, callback receiver, retry policy,
credential-acquisition flow, SDK API or invocation-service interface. Those
capabilities are not implied by an OAS declaration. Requirements concern the
denoted interaction, not execution algorithms.

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
schema for scalar values and requiring JSON-compatible results. Scalar keys
follow the string-spelling rule below, independently of value resolution.
An entry document must produce a JSON object. A referenced Schema Object is
also an object; this edition does not admit boolean schemas. Scalar mapping
keys denote their string
spellings (so plain `200:` names `200`); duplicate keys, non-scalar keys,
non-JSON values, incompatible explicit tags and multiple documents are invalid.
Retrieved documents use YAML's specified character-encoding detection; a byte
order mark is representation metadata. A JSON object supplied directly needs no
text parsing. Referenced documents use the same representation rules but need
not be OAS entry documents.

`location` supplies the retrieval URI for embedded content as well as retrieved
content. OAS references resolve against the containing document's retrieval URI;
`id`, `$id`, `$schema`, anchors and `$self` introduce no base or reference mechanism
in this edition. The containing OBI's acquisition URI supplies no base. Without a
suitable
base, a relative reference requiring it cannot be interpreted; self-contained
references remain usable. Redirected artifact acquisition uses the final
retrieval URI for a location-only source. That URI also supplies absent API
scheme or host components under §5.

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
`get`, `put`, `post`, `delete`, `options`, `head` and `patch`, denoting
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

A mounted operation inherits top-level `schemes`, `host`, `basePath`, `consumes`,
`produces` and `security` from the entry OAS document, even when its Path Item was
referenced from another document. Operation overrides retain OAS precedence.
Relative references retain the base of their contributing document; mounting
does not rebase them. Security names always use the entry root under §9.

Only declarations needed for the selected interaction govern invocation. A defect
in an unrelated operation, documentary field or unselected alternative does not
prevent it. A needed invalid or unsupported parameter, media, server or security
alternative is unusable at that position; usable siblings remain available.
When a required condition cannot be satisfied by any remaining alternative, the
operation cannot be invoked. If a missing runtime choice or capability can make
the operation usable, it remains a prerequisite rather than an invalid artifact.
Unknown fields and `x-` extensions create no behavior under this kind.

Schema Objects use the closed vocabulary of OAS §6.4.18. A declared `type` may
be one draft-04 primitive name or an array of unique primitive names, including
`null`; an empty array admits no category. `file` is available at a response root
or a formData parameter, not as a general Schema Object primitive. Boolean
schemas are invalid except expressly boolean-or-object `additionalProperties`.
Unlisted keywords, including `anyOf`, `oneOf`, `not`, `dependencies`,
`patternProperties`, `additionalItems`, `id`, `$schema`, `nullable` and later
content-encoding keywords, create no interpretation under this kind.
Non-body Parameter, Items and Header Objects use their own inline fields, not
Schema Objects; they do not acquire `$ref` or `allOf` from that vocabulary.
Parameter reference positions still admit OAS Reference Objects.

Where a rule needs a declared type or member, follow Reference Objects and
intersect declarations conjoined through `allOf`, treating integer as a subset
of number. An absent type adds no restriction; other inspected members must
agree where combined. A supplied value at an inspected empty category intersection
is unrepresentable. Apparent runtime type cannot replace a needed declaration.
This finite inspection is not general schema satisfiability or validation.
Invocation requires presence, shape and serialization checks stated below;
it does not imply validation of all OAS Schema Object or inline assertions.
Separate validation and schema-translation claims remain subject to their
respective authorities.

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

The request value is absent or an object containing only optional `parameters`
and `body`. Absence supplies neither member. Present `parameters` is an object
keyed by effective non-body parameter names, after parameters excluded by the
governing OAS or kind rules are removed (including the ignored and unavailable
fields in §6). Missing implementation capabilities or runtime context, and
value-dependent failures, do not remove a parameter for key construction or
change any key. If any remaining name occurs at more than one location, all
keys are
`<location>/<RFC6901-escaped-name>`; otherwise they are the exact names. Locations
`path`, `query`, `header` and `formData` use that map. The one body parameter uses
the envelope's `body`; its declared name is documentation only. Unknown keys or
a wrong-shaped envelope prevent dispatch. Absence is not supplied; null is
supplied data.

OAS governs parameter identity, operation-over-path overrides and required
presence. Duplicate parameters at one exact name/location are invalid; case-
distinct header names remain separate identities subject to §6's wire collision
rule. Every path parameter must correspond to a path-template expression and
vice versa. Repeated occurrences use the same value. More than one body parameter,
or both body and formData parameters, makes the operation unusable. Supplied body
without a body declaration cannot be represented and prevents dispatch.

The envelope is an intermediate value, not a mandated operation-contract shape.
Mappings may construct it from application fields. A declared body or formData
payload retains its meaning on every method this edition admits, subject to the
incorporated HTTP method's sender conditions. Where HTTP calls for prior origin
server indication of support, the runtime needs that indication; a service
artifact declaring its own payload can supply it. The kind does not waive that
condition or silently drop a supplied payload. PATCH also follows RFC 5789.

## 5. Target URL and context

Operation `schemes` replaces the root list; an absent effective list uses the
entry document's retrieval scheme. An absent `host` uses its retrieval host and
port. An absent `basePath` means no base path. One usable HTTP(S) scheme selects
itself; multiple usable schemes require a context choice. An empty declared list
supplies no scheme. `ws` and `wss` do not denote this kind's HTTP interaction.
A missing retrieval component is a prerequisite that a complete replacement
server base may satisfy.

Compose scheme, host (including a declared port), basePath and the literal Paths
key. The base must be an absolute `http` or `https` URL with a nonempty host and
no userinfo, query or fragment. A declared basePath starts with `/`.
Append the leading-slash path, removing exactly one trailing slash from the base
if present and preserving every other path byte. Do not collapse repeated
slashes or reinterpret a Paths key as a relative URL. A literal `?` or `#` in
that key is unavailable as path data; percent-encoded forms remain path data.
Substitution must not change the authority, base path, query boundary or fragment.
An incomplete or invalid final URL prevents dispatch.

Context can instead supply a complete server base satisfying those same URL
conditions. It replaces scheme/host/basePath while operation path, method and
parameter/body semantics remain.

**[configuration point]** These names identify the choices this kind leaves to
its consumer. They are portable semantic names, not required SDK field names or
context-store keys. Each choice has the domain and effect below; §6–§9 determine
when it is needed. An unanswered necessary choice prevents dispatch. Supplying
it, discovering it and negotiating context remain outside this specification.
These choices do not become operation-input fields.

| Name | Admissible choice and effect |
| --- | --- |
| `server` | One effective `http` or `https` scheme with the artifact host and basePath, or the complete replacement base allowed above. It fixes the URL base; it does not replace the operation path or method. |
| `requestMedia` | One concrete media type matching an admitted request alternative under §7. It selects that alternative's representation, without substituting another declaration's schema. |
| `security` | One complete effective Security Requirement alternative under §9, including an admitted anonymous alternative. Alternatives are never combined. Credentials satisfy the selected alternative separately. |
| `parameterConversion` | A deterministic conversion of booleans, numbers and null to strings for §6's schema/style paths, including array members. Strings pass unchanged. |
| `propertyMedia` | A concrete media type for a present file part under §8. It supplies that part's optional media metadata; omission uses §8's application/octet-stream default. |

## 6. Parameters and request assembly

OAS §§6.4.9–6.4.10 govern parameter and Items declarations. A non-body parameter
has a scalar or array shape, or is a formData file. Declared scalar parameters
carry scalar values; declared arrays carry arrays of scalar items. Objects have
no correspondence. An array requires an Items declaration. Nested arrays have no defined composite
collection correspondence under this kind. An omitted optional parameter does
not need serialization; supplying an unsupported shape prevents that invocation.

Context supplies a deterministic conversion of supplied booleans, numbers and
null to strings; strings retain their value. Arrays apply it to their scalar
members. Without a needed conversion the request cannot be formed. Null is
supplied data, not omission; its context-selected string is a bridge convention
because OAS provides no null parameter spelling. A whole null parameter uses
that conversion even beside an array declaration; it is not expanded as an array.
File values instead use §8's raw-octet correspondence. Scalar conversion does not
claim validation of the original value against inline type or other assertions.

An array uses `collectionFormat`: `csv` (the default) joins with comma, `ssv`
with SPACE, `tsv` with TAB, and `pipes` with `|`. `multi` creates repeated
contributions and is allowed only for query and formData. Preserve array order.
A member containing the selected joining separator is unsupported where splitting
the decoded value could not preserve its boundary. An empty array contributes
one empty value, including under `multi`, and does not become absence.

At query and formData locations, an empty string or empty array is admitted only
with `allowEmptyValue: true`, which otherwise defaults to false. A name-only
contribution or one with an empty value is permitted; multipart uses a named
zero-length part. At path and header locations that flag is inapplicable and an
empty value means zero characters. An absent optional parameter contributes
nothing. Defaults and examples do not supply omitted values.

Path and query data use UTF-8 and RFC 3986 percent-encoding, retaining the
structural separators required by collectionFormat. Reserved delimiter characters
inside data remain data, not new URI structure. Literal and percent-encoded
unreserved bytes and hexadecimal percent-triplet case are equivalent. Query
contributions form one query component with repeated name/value pairs for multi;
order across different parameters is free.

Header values use raw UTF-8 characters with no URI percent-encoding or automatic
quoting. They must be valid RFC 9110 field values; forbidden controls or boundary
field-line whitespace cannot be repaired into a different value. A raw Cookie
header must additionally be a complete RFC 6265 cookie-string. Non-token header
names and transport-owned headers are unavailable parameter contributions: Host, Content-Length,
Content-Type, Connection, Keep-Alive, Proxy-Authorization, Proxy-Connection, TE,
Trailer, Transfer-Encoding and Upgrade. A required unavailable contribution prevents
invocation; an omitted optional one does not. Supplying case-distinct contributions
to one HTTP field is ambiguous and prevents dispatch; a single contribution
remains usable. Unlike OAS 3.x, ordinary Accept and Authorization parameters are
not ignored. Supplied Accept or Accept-Encoding suppresses a competing runtime
negotiation contribution. Parameters cannot overwrite selected credentials.

## 7. Media alternatives

Effective `consumes` and `produces` use operation lists when present, otherwise
root lists. An empty list clears the inherited set; list order is not preference.
OAS supplies no media default for an empty set. Payload requires a usable consumes
alternative; nonempty successful response content requires a usable produces
alternative and governing response schema.

Media identities use RFC 9110 parsing and comparison. A declared range matches
only when its parameters match: charset values compare case-insensitively;
other parameter values compare exactly. A concrete media type is admitted when
at least one usable declaration matches. Repeated declarations with the same
normalized identity denote one alternative; overlapping matches do not select
different mappings, because these lists share the governing body or response
schema. List order supplies no preference.

A body-free request has no body media selection and emits no Content-Type. Otherwise, one usable concrete
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
adaptation. The same correspondences govern request bodies. Where a
rule needs a type, §3's declaration inspection supplies it. Typeless does not mean
that other schema keywords disappear; it means they do not select a type.

| Representation | Operation-side value before adaptation |
| --- | --- |
| Response-root `type: file`, or formData file | Canonical Base64 carrying exact octets, regardless of file media type. |
| application/json or a +json subtype, other than that file case | The JSON value. |
| Non-JSON, non-form concrete media carrying an artifact-encoded string under the `format: byte` rule below | The encoded string as text, without an additional boundary Base64 decode. |
| text/*, application/xml or +xml, with uniquely determined string type and no binary format | The string. |
| Non-JSON, non-form concrete media with omitted/typeless schema, or string with format: binary | A Base64 string carrying the exact octets. |
| Declared formData request | The supplied named parameter values under §8.1. |

A concrete character-media declaration without a uniquely determined string
type is unsupported in the ordinary character mapping. An unsupported media/data combination is unavailable at that alternative.

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
For JSON media the ordinary JSON mapping still governs the whole value except response-root file. Length constraints on raw content
measure octets, not the Base64 boundary string, when schema validation is claimed. Later-edition
`contentEncoding` creates no behavior. HTTP Content-Encoding and a part's
Content-Transfer-Encoding remain separate protocol concepts.

No schema default or example inserts an application member. OAS 2.0's
`readOnly: true` request-property prohibition remains a sender duty: a supplied
such property prevents dispatch rather than being silently removed. Inspect
corresponding supplied properties through resolved `properties`,
`additionalProperties`, `items` and conjoined `allOf` branches at any depth.
Unrelated or response-only marks impose no request duty. A declaration both
requiring and marking the same property readOnly has no faithful request
correspondence at that object position; an absent optional enclosing value does
not activate that contradiction. This does not turn invocation into general
schema validation.

A request mapping or serialization failure prevents dispatch. On a successful
HTTP response, failure to obtain the specified value makes completion
unsuccessful. Failure-response data follows §10 instead.

### 8.1 FormData and multipart

FormData uses application/x-www-form-urlencoded or multipart/form-data under
OAS §6.4.9 and its incorporated HTML 4.01 §17.13.4. Multipart framing uses RFC
2046 and form-data semantics use [RFC 7578](https://www.rfc-editor.org/rfc/rfc7578),
which governs where its updated rules differ. There is no Schema Object property
mapping or Encoding Object in this edition; each formData parameter supplies its
own named value. No supplied optional form value means no form entity.

URL-encoded names and converted values use UTF-8; collectionFormat builds each
value or repeated contribution first. Encoding preserves supplied characters
without newline normalization. Equivalent form encodings preserving the same
names and values are allowed, including SPACE as `+` or `%20` and percent-triplet
case. Array order remains significant. A file parameter has no URL-encoded
correspondence; it requires multipart.

Multipart emits one part per present parameter, or per member for multi; other
array formats use one joined part. Empty values use one empty named part.
Content-Disposition uses form-data and the exact UTF-8 parameter name with legal
quoting. It invents no filename: the boundary supplies file octets, not a file
name. Invalid names or field values cannot be repaired into different data.
Repeated parts for one array preserve order; order across names, safe boundary
generation, legal quoting and discardable preambles/epilogues are free.

Non-file parts contain the converted text in UTF-8 under text/plain. A part
Content-Type or charset need not be emitted when RFC 7578's defaults preserve
that text interpretation. File parts carry exact decoded octets. Context may supply a concrete
file-part media type; otherwise application/octet-stream applies. MIME transfer
encoding, when used consistently with RFC 7578's deprecation advice and
[RFC 2045 §6](https://www.rfc-editor.org/rfc/rfc2045#section-6), must preserve these decoded part octets; it creates no second boundary Base64
value. No transfer-encoding field is required by the boundary convention.

### 8.2 HTTP content codings

Actual Content-Encoding determines the ordered coding stack under RFC 9110 §8.4;
declarations alone do not select a coding. Request coding comes from the effective
supplied Header parameter; response coding comes from received fields. Codings
are applied in order and removed in reverse. Unknown or failed codings cannot be
silently skipped. Codec availability is runtime capability. A body-free request
cannot supply Content-Encoding for a nonexistent representation.

OAS 2.0 response Header Objects have inline fields, no `required`, `$ref`, `allOf`
or Schema Object. Header names compare case-insensitively. For Content-Encoding,
combine field lines under HTTP, using comma-plus-space for the string checked
against finite string `enum` domains; case-equivalent declarations constrain the
same field and their domains intersect. This fixes the comparison value, not wire
spelling. Other header schemas add no operation output fields or implicit
validation. Unsupported meaning cannot be claimed as faithfully synthesized.
No-content responses check field grammar and these constraints without requiring
a decoder for nonexistent content. Absence of a declared field is permitted.

## 9. Security and contribution ownership

OAS governs security inheritance, OR alternatives, AND membership, anonymous
alternatives and scheme identification. One usable complete alternative selects
itself; multiple alternatives require a context choice. Do not combine fragments
of different alternatives. A malformed scheme removes alternatives depending on
it, not unrelated alternatives.

Security Requirement names resolve only in entry-root `securityDefinitions`,
including requirements on externally mounted operations. URI-looking names gain
no URI semantics. OAS 2.0 supports basic, query/header apiKey and oauth2 schemes;
no HTTP scheme object, cookie apiKey, OpenID Connect or mutualTLS is inferred.
Scope strings retain their declared meaning. Credential acquisition, grant
inspection and counterparty enforcement are outside this kind.

Basic follows RFC 7617 using printable ASCII user-id/password because this kind
has no charset-selection declaration. OAuth2 access tokens use RFC 6750 b64token
syntax and Bearer carriage; unsupported token types cannot be guessed into that
form. Protocol-equivalent authentication scheme spelling and whitespace are
free. API keys use their exact declared destinations: query name/value are
separately UTF-8 percent-encoded, header values use §6's field rules, and a key
in the Cookie field must be a complete RFC 6265 cookie-string.

Selected credentials cannot overwrite other credentials, supplied parameters or
transport-owned fields. Header destinations compare case-insensitively; query names compare exactly. Collision with a required fixed contribution
makes that alternative unusable; a collision depending on optional or expanded
values prevents only an invocation producing both. This preserves clean alternatives
and invocations omitting an optional conflicting contribution.

Credential destinations cannot claim Host, Content-Length, Content-Type,
Content-Encoding, Connection, Keep-Alive, Proxy-Authorization, Proxy-Connection,
TE, Trailer, Transfer-Encoding or Upgrade. A credential targeting Accept or
Accept-Encoding cannot compete with a separately generated runtime negotiation
contribution: the runtime must omit its contribution or prevent dispatch.
Other value sensitivity remains the caller's responsibility where the artifact declares none.

When following a redirect, binding-selected Authorization and header API keys,
and every binding-produced Cookie contribution (ordinary parameters, raw Cookie
headers and credentials), may be forwarded only to the same origin (scheme, host
and effective port). Never append a selected query credential to the redirect's
Location. Credentials do not become application inputs or outputs.

## 10. Response and completion

An Operation requires a Responses Object with an exact response-code or default
entry. Default-only is admitted, consistently with OAS's
[2017-08-27 validation schema](https://spec.openapis.org/oas/2.0/schema/2017-08-27).
Exact keys are three ASCII digits from 100 through 599. This edition admits no
status ranges. Invalid keys do not remove clean siblings. Select exact status,
then default; a defective selected declaration never falls through to a less
specific one. Documentary defects do not invalidate usable schema/header siblings.

The final 2xx status is successful HTTP status. Interim responses do not complete
the interaction. Redirect following is runtime policy; a redirect preserving the
method and complete body remains within this interaction. A method-rewriting
redirect ends it; later activity is a different interaction. An unsolicited 101
is unsupported and cannot be treated as an ordinary success or awaited as if it
were an interim response.

Nonempty successful content needs a governing response schema; omission of schema
declares no body, not raw carriage. Content-Type must match effective produces
under §7. An absent Content-Type means application/octet-stream.
Multiple Content-Type values do not permit choosing an arbitrary one. An
unmatched, ambiguous or unusable representation under successful HTTP status
makes completion unsuccessful. A failed decoding or mapping does likewise.

An empty response emits no value, not null or an empty string. Emptiness means
zero octets after content decoding where content is permitted. For HEAD and
statuses forbidding content, HTTP's no-content semantics govern and there is no
application output; do not run a content decoder over absent content. Forbidden actual content is an error.

A nonempty successful response produces one decoded value, subject
to output mapping. It is emitted only after the complete representation and its
decoding succeed; a truncated unary response supplies no partial value. There is no sequential response mapping. Media names such as
text/event-stream do not split a response into items; where admitted by §8 they
produce one whole-representation value. Headers do not
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

This OAS edition has no callback or webhook declaration from which to derive
a dependency surface. Draft-04 versus current-core schema differences are not
silently erased in a translation.

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
