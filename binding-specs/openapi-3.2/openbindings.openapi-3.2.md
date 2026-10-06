# OpenBindings kind for OpenAPI 3.2

**Status: unreleased `@1` candidate.** This document proposes the meaning of
`openbindings.openapi-3.2@1`; it does not publish the identifier.

This document bridges OpenAPI 3.2 into OpenBindings. The OpenAPI Specification
and the standards it cites govern everything they define. This document adds
only what a binding needs beyond them. A marker covers the text from it to the
end of its paragraph or list item: `[pin]` fixes one reading where an authority
is ambiguous or leaves a choice to tools; `[convention]` decides where no
authority speaks; `[configuration point]` names a choice the consumer supplies.
Unmarked text defines this kind's content or cites an authority.

Outcomes use these words. Content that breaks a rule here is *invalid*. A
binding whose source cannot be obtained *cannot be interpreted*, which does not
make it invalid. A declaration or alternative outside what this kind accepts is
*unusable* at that position, and the alternatives that remain stay usable;
§9 lists the exclusions. An invocation that *cannot be sent* is refused before
any request. One that was sent *completes* successfully or unsuccessfully.

## 1. Kind and authorities

A source whose `kind` is exactly `openbindings.openapi-3.2@1` is read under this
document. A binding of this kind denotes one OAS operation invoked over HTTP.

This kind incorporates [OpenBindings Specification 0.2.0](../../openbindings.md).
It also incorporates [OpenAPI Specification 3.2.1](https://spec.openapis.org/oas/v3.2.1.html) (OAS)
with the normative references it cites for the features used here,
[HTTP Semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110), and
[JSONata 2.1](https://github.com/jsonata-js/jsonata/tree/5d1473277e0022d8580e00f891b12080eb3edd74/website/versioned_docs/version-2.1.0)
as defined by that documentation snapshot.

`[pin]` Where OAS cites an undated or living authority, this kind uses: the OAS
schema dialect [`2025-09-17`](https://spec.openapis.org/oas/3.2/dialect/2025-09-17);
the [WHATWG URL review draft of 18 August 2026](https://url.spec.whatwg.org/review-drafts/2026-08/)
for form URL encoding; and [WHATWG HTML at `24c5e48`](https://github.com/whatwg/html/blob/24c5e48bf66ea61bc199ec6338c81258275ba9c6/source)
for event-stream parsing.

`[pin]` An entry document declares `openapi` `3.2.0` or `3.2.1` and is read under
the 3.2.1 text (OAS §2.1), whose corrections change the meaning of some 3.2.0
documents. Later editions are not accepted.

## 2. Source content

Source `content` is an object with one or both of these members and no others:

| Member | Meaning |
| --- | --- |
| `document` | The entry document: a JSON object, or a string holding one JSON or YAML document. |
| `location` | An absolute URI naming the entry document. A fragment must be empty and is removed. |

Any other `content` is invalid. `location` is the entry document's retrieval URI
whether or not `document` is present; after a retrieval that followed redirects,
the final URI is (RFC 3986 §5.1.3). OAS determines bases from it and `$self`
(§4.1.2.2), and relative server URLs resolve against it (§4.5.2). With `location`
alone, the document is obtained through a resolver for the URI's scheme, and an
HTTP retrieval produces it only with a 2xx response. When none produces it, the
binding cannot be interpreted. The URI of the OBI carrying the source is never a
base: a reference that needs a base when none exists cannot be interpreted, and a
server URL that needs one is not usable (§7 `server` can supply a base).

`[pin]` Text is [YAML 1.2.2](https://yaml.org/spec/1.2.2/) under its Core schema
with the constraints of [RFC 9512](https://www.rfc-editor.org/rfc/rfc9512) (OAS
§3.1), except that a scalar mapping key denotes its spelling, so `200:` names the
response `"200"`. Duplicate keys, non-scalar keys and multiple documents are
invalid. A value JSON cannot represent is a defect of the declaration containing
it.

`[pin]` A reference by a document's retrieval URI reaches it even when the
document declares `$self` (OAS §4.1.1). A referenced document's root is read as
the object type the referring position expects, and a node referenced from
positions expecting different types is read once for each (OAS §4.1.2,
Appendix G.2).

`[convention]` The entry document's representation, its root type and its
`openapi` value are the only source-wide checks; failing one makes the source
invalid. Any other defect affects only the declarations that need it. A source
that declares operations under `paths`, none of which can be a target, is
invalid; one that declares none is valid and has no targets.

## 3. Binding content and target

Binding `content` is an object with a required `target` and optional `input`,
`output` and `failure` (§4.2), and no other members.

`target` is an [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) JSON Pointer in
string form into the entry document, with one of these forms:

- `/paths/<path>/<method>`, where `<method>` is `get`, `put`, `post`, `delete`,
  `options`, `head`, `patch`, `trace` or `query`;
- `/paths/<path>/additionalOperations/<method>`.

The pointer is not percent-decoded; its method is looked up in the Path Item
after any `$ref` is merged. A pointer that reaches no operation in the obtained
document is invalid binding content.

`[pin]` A Path Item with `$ref` (OAS §4.9.1 leaves conflicts undefined) is merged
with its referenced Path Item: a field present in only one applies, and
`additionalOperations` merge by method. A method present in both makes that
operation ambiguous; any other field present in both makes every operation of
the Path Item ambiguous. An ambiguous operation is not a target.

`[pin]` An operation reached through a Path Item in another document inherits the
entry document's `servers` (OAS Appendix G.3) and, likewise, its `security`. An
empty `servers` array on a Path Item or Operation falls through to the enclosing
level.

`[pin]` Specification extensions and unknown fields have no effect under this
kind (OAS §5 leaves their support optional).

## 4. Operation values

### 4.1 Request value

The request value is absent or an object with optional `parameters` and `body`,
and nothing else; absence supplies neither. A request value of any other shape
cannot be sent.

`parameters` is an object keyed by the names of the operation's effective
parameters (OAS §4.10.1). `[convention]` Where one name occurs at more than one
location, names compared exactly, every key is `<location>/<name>`, escaping `~`
and `/` as RFC 6901 does; otherwise keys are the names. Keys do not depend on
runtime context or capability. A key no effective parameter has cannot be sent.

`[pin]` Header parameters differing only in case (OAS §3.2) within one list are
duplicate parameters; an Operation header parameter overrides a Path Item one
whatever its case; the key is the effective declaration's spelling. A header
parameter named `Accept`, `Content-Type` or `Authorization` in any case is
ignored (OAS §4.12.2.1) and has no key.

`body` is the request body value. A member that is absent is not supplied; a
member that is null supplies JSON null. Required parameters and a required body
must be supplied, and a body supplied for an operation without a request body
declaration cannot be sent. A TRACE request sends no body, credentials or
cookies (RFC 9110 §9.3.8): a supplied body or cookie parameter cannot be sent, a
body declaration requires nothing, and only security alternatives needing no
credential in the request stay usable.

### 4.2 Transforms

`input`, `output` and `failure` are JSONata expressions:

- `input` receives the operation's input value (undefined when absent); its result
  is the request value. Without `input`, the input value is the request value.
- `output` receives one decoded successful response value; its result is an
  operation output value. Without `output`, the decoded value is the output value.
- `failure` receives the decoded body of a non-2xx final response (undefined when
  there is none or it cannot be decoded), with `$status` bound to the status code
  as a number; its result is an operation output value (§6.2).

Besides `$status`, an expression sees only its context and JSONata's standard
library: no credentials, headers or other transport state.

`[pin]` The JSONata documentation snapshot defines the language; the reference
implementation is informative. This kind adds no numeric model: where the
documentation leaves numeric precision, range or text form open, the evaluating
host's numbers decide; a value an expression passes through untouched keeps its
exact value; a value the host cannot compute or hold unchanged makes the
evaluation fail. Where the documentation counts or orders characters, a character
is a Unicode code point. Objects carry no member order. Regular expressions are
ECMA-262 expressions as JSONata constructs them, without the `u` flag.

A result is one JSON value; an array is one value. An expression with invalid
syntax is invalid binding content. Evaluation fails on a dynamic error, a
function or other non-JSON value anywhere in the result, or an undefined result,
except that an undefined `failure` result leaves the response a failure and an
undefined `output` result for one item of a sequential response emits no value
for that item. A failed `input` means the invocation cannot be sent; a failed
`output` or `failure` completes it unsuccessfully, and output values already
emitted stand.

### 4.3 Representations

`[convention]` After content codings are removed (RFC 9110 §8.4), a body, a form
field, a part or a content-form parameter corresponds to a value by the first
row that applies:

| Representation | Value |
| --- | --- |
| JSON media (`application/json`, `+json`) | The JSON value. |
| Any media declared as a string with `contentEncoding` | The encoded string (OAS §4.24.4.3). |
| Any media declared `type: string` with `format: binary` (OAS §4.24.4.3.2) | The octets as a Base64 string. |
| Character media (`text/*` other than XML) | A string, number, integer or boolean, as below. |
| `application/x-www-form-urlencoded`, and `multipart/form-data` encoded by name | An object with one member per field (OAS §4.14.5.1). |
| Multipart encoded by position; a sequential media type in a request | An array with one element per part or item (OAS §4.14.5.2, §4.14.5.3, §4.14.3.1). |
| Any other media declared with no type | The octets as a Base64 string (OAS §4.24.4.3). |

A representation no row covers is unusable. Sequential responses are read as
items first (§6.3). A JSON response needs no declaration; a request body and any
other response representation need a matching declaration. Values are not
validated against OAS schemas, which are inspected only for what this document
names.

`[pin]` A declaration's types come from its schema's `type`, reached by
following only `$ref` and `allOf` with their JSON Schema 2020-12 meanings (OAS
§4.24.4.2, without its optional inspection of other keywords); a schema without
`type` admits every type. A character response is the text as a string when its
declaration admits `string` or has no type; it is the one scalar when the
declaration admits exactly one of `number`, `integer` and `boolean` (`integer`
counting as a `number`) and not `string`; otherwise it is unusable. A request
writes a scalar in the text form of its own type; an object, array or null has
no text form and cannot be sent in character media.

`[pin]` Character media without `charset` are UTF-8, a superset of RFC 2046's
US-ASCII default. A boolean is `true` or `false`; a number is a JSON number with
its value, and an integer is written as decimal digits with a leading `-` when
negative. Decoding reads exactly one such token, allowing JSON whitespace around
it. These text forms also serve parameter serialization (§5), which OAS
Appendix B leaves to implementations.

`[pin]` Base64 is RFC 4648 §4 with padding and zero pad bits; a non-canonical
string cannot be sent.

`[pin]` In JSON (RFC 8259 §4, §8.1, §8.2), the last of duplicate member names
wins, a leading byte order mark is ignored on receipt and never sent, and
unpaired surrogates cannot be carried. A number keeps its exact value; an
implementation that cannot hold one unchanged fails that request or completion
instead of substituting another.

Schema defaults, examples, `readOnly` and `writeOnly` never add or remove members.

## 5. Request assembly

OAS §§4.12 to 4.15 and Appendices B to E govern serialization, with these
decisions:

- `[pin]` A null parameter value uses OAS §4.12.6's undefined column, where OAS
  departs from RFC 6570's omission; a null member of an object or array
  contributes nothing (RFC 6570 §2.3). Where RFC 6570 applies, an empty array or
  object contributes nothing (OAS Appendix C.4.3). An empty string is a value; an
  absent optional parameter contributes nothing.
- `[pin]` Where OAS applies percent-encoding and RFC 6570 does not fix the set,
  every character outside RFC 3986's unreserved set is encoded, and also `~` in
  form-urlencoded content (OAS §4.12.4). A content-form path or query parameter,
  and `querystring` media other than form, are encoded this way as one value; a
  content-form header or cookie parameter is not encoded. A `querystring`
  parameter of zero bytes produces an empty query; an omitted optional one
  produces none.
- `[pin]` Under `allowReserved`, a value containing a delimiter of its style, or
  `/`, `?`, `#`, `[` or `]` in a path, `#`, `[`, `]`, `&`, `=` or `+` in a query,
  or `&`, `=` or `+` in form-urlencoded content, cannot be sent: OAS §4.12.4
  leaves inserting them undefined, and the caller percent-encodes them. A path
  parameter value of `.` or `..` cannot be sent, since it would change the target
  path (RFC 3986 §5.2.4). A value a declaration cannot serialize means only the
  invocation supplying it cannot be sent.
- `[pin]` Header values are UTF-8 and must be valid field values (RFC 9110 §5.5).
  A serialized cookie must satisfy [RFC 6265](https://www.rfc-editor.org/rfc/rfc6265)
  §4.2.1, and one that would not cannot be sent. A header or cookie parameter
  whose name is not a valid field or cookie name is unusable. A header parameter
  named `Cookie` supplies the whole Cookie field and cannot be combined with
  cookie parameters or cookie credentials.
- `[convention]` Header parameters and header credentials naming `Host`,
  `Content-Length`, `Connection`, `Keep-Alive`, `Proxy-Authorization`,
  `Proxy-Connection`, `TE`, `Trailer`, `Transfer-Encoding` or `Upgrade`, and
  header credentials naming `Content-Type` or `Content-Encoding`, are unusable
  (§9). Two contributions to one header, query name or cookie name, from
  different declarations or credentials, are never sent together: a required
  declaration colliding with a credential, or two credentials of one alternative
  colliding, make that security alternative unusable; otherwise only the
  invocation that would send both cannot be sent. A `querystring` parameter
  cannot be combined with query credentials.
- `[pin]` A declared media range matches a media type when each of the range's
  parameters appears there with the same value, `charset` compared
  case-insensitively (RFC 9110 §8.3.1). The most specific match applies (OAS
  §4.13.1, §4.17.1): a concrete type, then `type/*`, then `*/*`, and among equals
  the match with more parameters; matches still equal are ambiguous and unusable.
  A Request Body whose `content` is empty admits no body. When a body is
  supplied, one usable alternative is used; with several, or a range,
  `requestMedia` (§7) chooses.
- `[pin]` A form or `multipart/form-data` body may carry any member its schema
  admits through `properties`, `patternProperties`, `additionalProperties` or
  `allOf`; a member it forbids cannot be sent. Multipart is encoded by position
  when its schema is an array or its media has `itemSchema` (OAS §4.14.5.2): each
  element is one part, encoded by `prefixEncoding` then `itemEncoding`, and in
  `multipart/form-data` each element is an object whose one member names the part
  (OAS §4.14.5.3). Among multipart types, name-based Encoding applies only to
  `multipart/form-data` (§9).
- `[pin]` A field or part takes its Encoding `contentType` when that names one
  type, else OAS's default content type read with the supplied value's type
  (§4.15.1.1); a `contentType` that is a range or lists several types needs
  `propertyMedia` (§7). A null member serialized by style follows the first
  bullet; one with media follows that media, so JSON media carry it, and
  otherwise an optional member is omitted and a required one cannot be sent.
- `[pin]` Part headers come only from Encoding `headers` fixed by `const` or a
  single-valued `enum`; a required part header without a fixed value makes the
  part unusable. A part whose value has `contentEncoding` carries that
  `Content-Transfer-Encoding` (OAS §4.15.4.2); a fixed header contradicting it
  makes the part unusable. Generated form-data parts use the exact property name,
  and a part carrying octets also takes that name as its `filename` unless its
  declaration fixes one (RFC 7578 §4.2).
- `[convention]` A request body's content codings come only from a supplied
  `Content-Encoding` header parameter and are applied in order (RFC 9110 §8.4).

## 6. Responses and completion

`[pin]` A 301, 302, 303, 307 or 308 response with a `Location` is followed, up to
20 times (RFC 9110 §15.4 leaves this to the client): 307 and 308 repeat the
method and content; 301 and 302 do too, except that POST becomes GET without
content; 303 becomes GET without content, and HEAD stays HEAD. The `Location` is
used as given, and credentials and the Cookie field are not sent to another
origin. Any other final response, including other 3xx statuses, completes the
invocation; a transport failure before one completes it unsuccessfully.

The final status selects the response declaration (OAS §4.16). `[pin]` A
Responses Object with only `default` applies it to every status. An invalid
declaration does not fall back to a less specific one, and content it governs
cannot be decoded.

### 6.1 Success

A final 2xx response completes the invocation successfully. Empty content,
meaning zero octets after content decoding or none under HTTP's rules for the
method and status, emits no value. Nonempty content's `Content-Type` selects the
content declaration as in §5; `[pin]` a missing `Content-Type` means
`application/octet-stream` (RFC 9110 §8.3). A response with several
`Content-Type` values, or whose representation is neither JSON nor matched by a
usable declaration, completes unsuccessfully, as does a failed decoding or
transform. A response that is not sequential emits one value once its whole
representation is decoded; a truncated one emits none. Headers and links never
become output values. Whatever the request advertised for negotiation, the
received representation is interpreted the same way.

### 6.2 Failure

A final non-2xx response completes the invocation unsuccessfully, with no output
value and no failure data, unless the binding has `failure`. Then the body is
decoded under the declaration for its status as a successful body would be, a
sequential body becoming the array of its items and a body that cannot be
decoded giving `failure` an undefined context, and `failure` evaluates (§4.2): a
result is emitted as an output value and the invocation completes successfully;
an undefined result leaves it unsuccessful.

### 6.3 Sequential responses

A sequential media type (OAS §4.14.3.1) is read as items: `application/jsonl`
and `application/x-ndjson`, `application/json-seq` and `+json-seq`
([RFC 7464](https://www.rfc-editor.org/rfc/rfc7464),
[RFC 8091](https://www.rfc-editor.org/rfc/rfc8091)), `text/event-stream`, and
multipart encoded by position. Each item becomes a value under §4.3; an
event-stream item is the object of OAS §4.14.4. Declared with `itemSchema`, each
item passes through `output` and is emitted as it arrives; otherwise the
complete content is one array of its items (OAS §4.14.3).

`[convention]` JSONL and NDJSON items are LF-delimited JSON texts: a CR before
the LF belongs to the delimiter, a final delimiter adds no item, and a blank line
is malformed. A malformed JSONL, NDJSON or JSON text sequence item ends the
response unsuccessfully; RFC 7464 §2.1 leaves that choice to the application.

`[pin]` An event-stream item has `data`, and has `event`, `id` or `retry` only
when that event's own lines set them, `event` only with a nonempty type. A block
that dispatches no event yields no item; there is no `message` default and no
carrying of `id` or `retry` between items. Reconnection is not part of the
invocation.

Values already emitted stand when a later item, the connection or a transform
fails, and the invocation then completes unsuccessfully. A clean end completes it
successfully. Abandoning an invocation completes it unsuccessfully without
retracting emitted values.

## 7. Context

`[configuration point]` The consumer supplies these choices, never the operation
input. A supplied choice is used wherever it applies, needed or not; an
invocation that needs an unanswered choice cannot be sent.

| Name | Choice | Needed when |
| --- | --- | --- |
| `server` | One effective Server Object (OAS §4.5) with its variable values, or a complete absolute `http` or `https` base URL without userinfo, query or fragment. | More than one effective server, or none usable. |
| `requestMedia` | One concrete media type matching a usable request alternative. | A body is supplied and several usable alternatives, or a range, remain. |
| `propertyMedia` | One concrete media type for a form field or multipart part. | It is supplied and its Encoding `contentType` is a range or lists several types (§5). |
| `security` | One Security Requirement alternative (OAS §4.30), possibly the empty one. | No usable alternative can be met from the credentials the context holds. |

`[pin]` Without a `security` choice, the first usable alternative in declaration
order whose credentials the context holds is used, an alternative needing
credentials before the empty one.

`[pin]` Server variables take their supplied values, else their defaults, as
written (OAS §4.6); a supplied value outside a declared `enum` cannot be sent,
and an undeclared variable takes a supplied value. A relative server URL is
resolved against the retrieval URI of the document that declares it (§2). One
trailing `/` is removed from the server URL, or from a context-supplied base,
before the path is appended (OAS §4.8.1). A result that is not an absolute URI
with a host cannot be sent.

Credentials are context, one for each scheme in the chosen alternative, and never
become input or output values. `[pin]` They are carried as follows:

- `http` with `basic`: [RFC 7617](https://www.rfc-editor.org/rfc/rfc7617) with
  UTF-8.
- `http` with `bearer`, `oauth2`, `openIdConnect`: an access token in the
  Authorization field ([RFC 6750](https://www.rfc-editor.org/rfc/rfc6750) §2.1); a
  token outside its `b64token` syntax cannot be sent.
- `apiKey`: the key at its declared name, percent-encoded as a query value, as a
  header field value, or unchanged as a cookie value, which must satisfy RFC 6265.
- `mutualTLS`: a client certificate on the connection.

A defective scheme makes only the alternatives using it unusable. `[pin]`
Component names in a referenced document's Security Requirement resolve in the
entry document, as OAS §4.1.2.3 recommends.

## 8. Synthesis

An OBI generated from an OAS document claims, for each operation it emits, only
what this document makes true of the binding (core §5.3); a schema translation
that loses meaning is not presented as the operation's contract.

Callbacks (OAS §4.18) and webhooks (OAS §4.1.1) become core dependencies: the
input describes the request the API sends, and the output the response it
expects. `[convention]` These dependencies carry no `kinds` constraint.

## 9. Exclusions

An invocation is sent only when its binding, input and context are fully
interpreted. Otherwise the binding is invalid, cannot be interpreted, lacks a
context choice, or reaches one of these exclusions:

| Excluded | Reason | Reopens when |
| --- | --- | --- |
| CONNECT, and responses switching protocols (101) | A tunnel or new protocol is not an HTTP response. | This kind defines tunnel or upgrade semantics. |
| Typed declarations for media no row of §4.3 covers, including XML Object modeling (OAS §4.26) | Mapping them to values is a model of its own. | This kind defines that mapping. |
| Schemas whose dialect gives `$ref`, `allOf` or `type` other than their JSON Schema 2020-12 meanings, where type inspection needs them | Inspection would depend on that dialect. | This kind adopts the dialect. |
| Name-based Encoding for multipart types other than `multipart/form-data` (OAS §4.14.5.3) | OAS leaves it optional and notes it is uncommon. | OAS makes it normative. |
| Header parameters and credentials naming fields HTTP owns (§5) | They would contradict the message's own framing. | HTTP gives up ownership of those fields. |
| Event-stream request bodies | OAS defines no way to write values as events. | OAS or this kind defines one. |
| Other sequential framings, and sequential `querystring` media | Item boundaries would be guessed. | OAS names their framing. |
| Style and value combinations OAS leaves undefined or `n/a` (§4.12.3, §4.12.6, Appendix C.1) | No serialization is defined. | OAS defines them. |
| Separators inside space- and pipe-delimited values; `[` or `]` in deep-object names (Appendix E.6) | The structure becomes ambiguous. | OAS defines an escape. |
| Form-style cookies with more than one pair (Appendix D.1) | Cookie pairs are joined with `; `, not the form's `&`. | OAS defines a cookie form. |
| `http` schemes other than `basic` and `bearer` | No credential carriage is defined here. | This kind pins one. |
