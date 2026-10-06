# OpenBindings kind for OpenAPI 3.0

**Status: unreleased `@1` candidate.** This document proposes the meaning of
`openbindings.openapi-3.0@1`; it does not publish the identifier.

This document bridges OpenAPI 3.0 into OpenBindings. The OpenAPI Specification
and the standards it cites govern everything they define. This document adds
only what a binding needs beyond them. A marker at the start of a paragraph or
list item covers that paragraph or item: `[pin]` fixes one reading where an
authority is ambiguous or leaves a choice to tools; `[convention]` decides where
no authority speaks; `[configuration point]` names a choice the consumer
supplies. Unmarked text defines this kind's content or cites an authority.

Outcomes use these words. Content that breaks a rule here is *invalid*. A
binding whose source cannot be obtained *cannot be interpreted*, which does not
make it invalid. A declaration or alternative outside what this kind accepts is
*unusable* at that position, and the alternatives that remain stay usable;
§9 lists the exclusions. An invocation that *cannot be sent* is refused before
any request. One that was sent *completes* successfully or unsuccessfully.

## 1. Kind and authorities

A source whose `kind` is exactly `openbindings.openapi-3.0@1` is read under this
document. A binding of this kind denotes one OAS operation invoked over HTTP.

This kind incorporates [OpenBindings Specification 0.2.0](../../openbindings.md).
It also incorporates [OpenAPI Specification 3.0.4](https://spec.openapis.org/oas/v3.0.4.html) (OAS)
with the normative references it cites for the features used here,
[HTTP Semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110), and
[JSONata 2.1](https://github.com/jsonata-js/jsonata/tree/5d1473277e0022d8580e00f891b12080eb3edd74/website/versioned_docs/version-2.1.0)
as defined by that documentation snapshot.

`[pin]` An entry document declares `openapi` `3.0.0`, `3.0.1`, `3.0.2`, `3.0.3`
or `3.0.4` and is read under the 3.0.4 text (OAS §4.1), whose corrections change
the meaning of some earlier documents. Later editions are not accepted.

## 2. Source content

Source `content` is an object with one or both of these members and no others:

| Member | Meaning |
| --- | --- |
| `document` | The entry document: a JSON object, or a string holding one JSON or YAML document. |
| `location` | An absolute URI naming the entry document. A fragment must be empty and is removed. |

Any other `content` is invalid. `location` is the entry document's retrieval URI
whether or not `document` is present; after a retrieval that followed redirects,
the final URI is (RFC 3986 §5.1.3). It is the base for the document's references
and its relative server URLs (OAS §4.6, §4.7.5.1). With `location` alone, the
document is obtained through a resolver for the URI's scheme, and an HTTP
retrieval produces it only with a 2xx response. When none produces it, the
binding cannot be interpreted. The URI of the OBI carrying the source is never a
base; a reference or server URL that needs a base when none exists cannot be
interpreted.

`[pin]` Text is [YAML 1.2.2](https://yaml.org/spec/1.2.2/) under the constraints
of OAS §4.2. Duplicate keys, values JSON cannot represent and multiple documents
are invalid.

`[pin]` A referenced document's root is read as the object type the referring
position expects, and a node referenced from positions expecting different types
is read once for each (OAS §4.3.1).

`[convention]` The entry document's representation, its root type and its
`openapi` value are the only source-wide checks; failing one makes the source
invalid. Any other defect affects only the declarations that need it. A source
that declares operations under `paths`, none of which can be a target, is
invalid; one that declares none is valid and has no targets.

## 3. Binding content and target

Binding `content` is an object with a required `target` and optional `input`,
`output` and `failure` (§4.2), and no other members.

`target` is an [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) JSON Pointer in
string form into the entry document, of the form `/paths/<path>/<method>`, where
`<method>` is `get`, `put`, `post`, `delete`, `options`, `head`, `patch` or
`trace`. The pointer is not percent-decoded. A pointer to no operation is not a
target.

`[pin]` A Path Item with `$ref` (OAS §4.7.9.1 leaves conflicts undefined) is
merged with its referenced Path Item: a field present in only one applies; a
field present in both, if the selected operation uses it, makes that operation
ambiguous and not a target.

`[pin]` An operation reached through a Path Item in another document inherits the
entry document's `servers` (OAS §4.3.2) and, likewise, its `security`. An empty
`servers` array on a Path Item or Operation falls through to the enclosing level.

`[pin]` Specification extensions and unknown fields have no effect under this
kind (OAS §4.8 leaves their support optional).

## 4. Operation values

### 4.1 Request value

The request value is absent or an object with optional `parameters` and `body`,
and nothing else; absence supplies neither. A request value of any other shape
cannot be sent.

`parameters` is an object keyed by the names of the operation's effective
parameters (OAS §4.7.10.1). `[convention]` Where one name occurs at more than one
location, every key is `<location>/<name>`, escaping `~` and `/` as RFC 6901
does; otherwise keys are the names. Keys do not depend on runtime context or
capability. A key no effective parameter has cannot be sent.

`[pin]` Header parameter names compare case-insensitively (OAS §3.8, RFC 9110
§5.1). Header parameters differing only in case within one list are duplicate
parameters; an Operation header parameter overrides a Path Item one whatever its
case; the key is the effective declaration's spelling. A header parameter named
`Accept`, `Content-Type` or `Authorization`, in any case, is ignored (OAS
§4.7.12.2.1) and has no key.

`body` is the request body value. A member that is absent is not supplied; a
member that is null supplies JSON null. Required parameters and a required body
must be supplied, and a body supplied for an operation without a request body
declaration cannot be sent. `[pin]` A request body applies to POST, PUT and
PATCH. OAS ignores it where HTTP leaves body semantics vague, naming GET, HEAD
and DELETE (§4.7.10.1); this kind treats every other method the same way, so a
supplied body there cannot be sent and the declaration requires nothing. A TRACE
request carries no credentials or cookies (RFC 9110 §9.3.8): a supplied cookie
parameter cannot be sent, and only security alternatives needing no credential
in a field stay usable.

### 4.2 Transforms

`input`, `output` and `failure` are JSONata expressions:

- `input` receives the operation's input value (undefined when absent); its result
  is the request value. Without `input`, the input value is the request value.
- `output` receives the decoded successful response value; its result is the
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
except that an undefined `failure` result leaves the response a failure. A failed
`input` means the invocation cannot be sent; a failed `output` or `failure`
completes it unsuccessfully.

### 4.3 Representations

`[convention]` After content codings are removed (RFC 9110 §8.4), a body, a form
field, a part or a content-form parameter corresponds to a value by the first
row that applies:

| Representation | Value |
| --- | --- |
| JSON media (`application/json`, `+json`) | The JSON value. |
| Any media declared `type: string` with `format: byte` | The Base64 string. |
| Any media declared `type: string` with `format: binary`, or with no schema | The octets as a Base64 string (OAS §4.4.2). |
| Character media (`text/*` other than XML) declared as one scalar type | That string, number, integer or boolean. |
| `application/x-www-form-urlencoded`, `multipart/form-data` | An object with one member per field (OAS §4.7.15). |

A representation no row covers is unusable. A JSON response needs no
declaration; a request body and any other response representation need a
matching declaration. Values are not validated against OAS schemas, which are
inspected only for what this document names.

`[pin]` Types come from the governing Schema Object's `type`, reached by
following only Reference Objects and `allOf` (the procedure
[OAS 3.2.1](https://spec.openapis.org/oas/v3.2.1.html) §4.24.4.2 later wrote
down, without its optional inspection of other keywords); keywords outside OAS
3.0's subset (§4.7.24) have no effect. A schema without `type` admits every type,
and `nullable` adds nothing to the text forms, since null has none. For a
request, the supplied value's own type selects among the declared types, and a
value of no declared type cannot be sent. A response declaration that leaves
more than one type for a character representation is unusable there.

`[pin]` Character media without `charset` are UTF-8, a superset of RFC 2046's
US-ASCII default. A boolean is `true` or `false`; a number is a JSON number with
its value, and an integer is written as decimal digits with a leading `-` when
negative. Decoding reads exactly one such token, allowing JSON whitespace around
it. Null has no text form. These text forms also serve parameter serialization
(§5), which OAS Appendix B leaves to implementations.

`[pin]` Base64 is RFC 4648 §4 with padding and zero pad bits; a non-canonical
string cannot be sent.

`[pin]` In JSON (RFC 8259 §4, §8.2), the last of duplicate member names wins, a
leading byte order mark is ignored on receipt and never sent, and unpaired
surrogates cannot be carried. A number keeps its exact value; an implementation
that cannot hold one unchanged fails that request or completion instead of
substituting another.

Schema defaults, examples, `readOnly` and `writeOnly` never add or remove members.

## 5. Request assembly

OAS §§4.7.12 to 4.7.15 and Appendices B to E govern serialization, with these
decisions:

- `[pin]` Null serialized by style uses OAS §4.7.12.4's undefined column, except
  that it contributes nothing in the matrix and label styles, as RFC 6570
  requires (OAS 3.2.1 corrects these cells). Where RFC 6570 applies, an empty
  array or object contributes nothing (OAS Appendix C.4.3). An empty string is a
  value; an absent optional parameter contributes nothing.
- `[pin]` Under `allowReserved`, a value containing `&`, `#` or `+` cannot be
  sent (OAS Appendix E.5). A value a declaration cannot serialize means only the
  invocation supplying it cannot be sent.
- `[pin]` Header values are not percent-encoded, whether serialized by style or
  by content ([OAS 3.1.2](https://spec.openapis.org/oas/v3.1.2.html) §4.8.12.2.2
  corrects this); a form-style cookie has no `?` prefix (OAS 3.1.2 Appendix D.1).
  A content-form path or query parameter is percent-encoded as one value (OAS
  Appendix E.3); a content-form cookie parameter is not.
- `[pin]` Header values are UTF-8 and must be valid field values (RFC 9110 §5.5).
  A serialized cookie must satisfy [RFC 6265](https://www.rfc-editor.org/rfc/rfc6265)
  §4.2.1, and one that would not cannot be sent. A parameter whose name is not a
  valid field or cookie name is unusable. A header parameter named `Cookie`
  supplies the whole Cookie field and cannot be combined with cookie parameters
  or cookie credentials.
- `[convention]` Header parameters and header credentials naming `Host`,
  `Content-Length`, `Connection`, `Keep-Alive`, `Proxy-Authorization`,
  `Proxy-Connection`, `TE`, `Trailer`, `Transfer-Encoding` or `Upgrade`, and
  header credentials naming `Content-Type` or `Content-Encoding`, are unusable
  (§9). Two contributions to one header, query name or cookie name, from
  different declarations or credentials, are never sent together: a required
  declaration colliding with a credential makes that security alternative
  unusable; otherwise only the invocation that would send both cannot be sent.
- `[pin]` A declared media range matches when its parameters match, `charset`
  case-insensitively and others exactly (RFC 9110 §8.3.1). The most specific match
  applies (OAS §4.7.13.1, §4.7.17.1): a concrete type before a range, then the
  match with more parameters; matches still equal are ambiguous and unusable. A
  Request Body whose `content` is empty admits no body. When a body is supplied,
  one usable alternative is used; with several, or a range, `requestMedia` (§7)
  chooses. The `Content-Type` field carries the chosen type and any multipart
  boundary.
- `[pin]` A form or `multipart/form-data` body may carry any member its schema
  admits through `properties`, `additionalProperties` or `allOf`; a member it
  forbids cannot be sent. An array member is one field or part per item, each
  taking the item declaration's media (as OAS 3.2.1 §4.14.5.1 later made
  explicit). A null member serialized by style follows the first bullet; one with
  media follows that media, so JSON media carry it, and otherwise an optional
  member is omitted and a required one cannot be sent. Among multipart types,
  name-based Encoding applies only to `multipart/form-data` (§9).
- `[pin]` A property whose media its declaration does not fix (a range, or
  several Encoding content types) needs `propertyMedia` (§7). Part headers come
  only from Encoding `headers` fixed by a single-valued `enum`; a required part
  header without a fixed value makes the part unusable. A part declared with
  `format: byte` carries `Content-Transfer-Encoding: base64` (OAS §4.7.15.3); a
  fixed header contradicting it makes the part unusable. Generated form-data parts
  use the exact property name and add no filename their declaration does not fix.
- `[convention]` A request body's content codings come only from a supplied
  `Content-Encoding` header parameter and are applied in order (RFC 9110 §8.4).

## 6. Responses and completion

`[pin]` A 301, 302, 303, 307 or 308 response with a `Location` is followed (RFC
9110 §15.4 leaves this to the client): 307 and 308 repeat the method and content;
301 and 302 do too, except that POST becomes GET without content; 303 becomes GET
without content, and HEAD stays HEAD. Any other final response, including other
3xx statuses, completes the invocation. Its status selects the response
declaration (OAS §4.7.16); an invalid declaration does not fall back to a less
specific one, and a Responses Object with only `default` applies it to every
status.

### 6.1 Success

A final 2xx response completes the invocation successfully. Empty content,
meaning zero octets after content decoding or none under HTTP's rules for the
method and status, emits no value. Nonempty content's `Content-Type` selects the
content declaration as in §5; `[pin]` a missing `Content-Type` means
`application/octet-stream` (RFC 9110 §8.3). A response with several
`Content-Type` values, or whose representation is neither JSON nor matched by a
usable declaration, completes unsuccessfully, as does a failed decoding or
transform. The response emits one value once its whole representation is
decoded; a truncated one emits none. Headers and links never become output
values. Whatever the request advertised for negotiation, the received
representation is interpreted the same way.

### 6.2 Failure

A final non-2xx response completes the invocation unsuccessfully, with no output
value and no failure data, unless the binding has `failure`. Then the body is
decoded under the declaration for its status as a successful body would be, a
body that cannot be decoded giving `failure` an undefined context, and `failure`
evaluates (§4.2): a result is emitted as an output value and the invocation
completes successfully; an undefined result leaves it unsuccessful.

### 6.3 Abandonment

Abandoning an invocation completes it unsuccessfully.

## 7. Context

`[configuration point]` The consumer supplies these choices, never the operation
input. An invocation that needs an unanswered choice cannot be sent.

| Name | Choice | Needed when |
| --- | --- | --- |
| `server` | One effective Server Object (OAS §4.7.5) with its variable values, or a complete absolute `http` or `https` base URL without userinfo, query or fragment. | More than one effective server, or none usable. |
| `requestMedia` | One concrete media type matching a usable request alternative. | A body is supplied and several usable alternatives, or a range, remain. |
| `propertyMedia` | One concrete media type for each affected form or multipart property. | It is supplied and its declaration does not fix its media (§5). |
| `security` | One Security Requirement alternative (OAS §4.7.30), possibly the empty one. | More than one usable alternative. |

`[pin]` Server variables take their supplied values, which must satisfy a
declared `enum`, else their defaults, as written (OAS §4.7.6); an undeclared
variable takes a supplied value. A relative server URL is resolved against its
document's base (§2). One trailing `/` is removed from the server URL, or from a
context-supplied base, before the path is appended (OAS §4.7.8). A result that
is not an absolute URI with a host cannot be sent.

Credentials are context, one for each scheme in the chosen alternative, and never
become input or output values. `[pin]` They are carried as follows:

- `http` with `basic`: [RFC 7617](https://www.rfc-editor.org/rfc/rfc7617) with
  UTF-8.
- `http` with `bearer`, `oauth2`, `openIdConnect`: an access token in the
  Authorization field ([RFC 6750](https://www.rfc-editor.org/rfc/rfc6750) §2.1); a
  token outside its `b64token` syntax cannot be sent.
- `apiKey`: the key at its declared name, percent-encoded as a query value, as a
  header field value, or unchanged as a cookie value, which must satisfy RFC 6265.

A defective scheme makes only the alternatives using it unusable. `[pin]`
Component names in a referenced document's Security Requirement resolve in the
entry document, as OAS §4.3.2 and Appendix F recommend.

## 8. Synthesis

An OBI generated from an OAS document claims, for each operation it emits, only
what this document makes true of the binding (core §5.3); a schema translation
that loses meaning is not presented as the operation's contract.

Callbacks (OAS §4.7.18) become core dependencies: the input describes the request
the API sends, and the output the response it expects. `[convention]` These
dependencies carry no `kinds` constraint.

## 9. Exclusions

An invocation is sent only when its binding, input and context are fully
interpreted. Otherwise the binding is invalid, cannot be interpreted, lacks a
context choice, or reaches one of these exclusions:

| Excluded | Reason | Reopens when |
| --- | --- | --- |
| Responses switching protocols (101) | A new protocol is not an HTTP response. | This kind defines upgrade semantics. |
| One response as a sequence of values | OAS 3.0 defines no way to frame one body as several values. | Use the OpenAPI 3.2 kind, which incorporates OAS 3.2's sequential media. |
| Form and multipart responses as objects | OAS 3.0 defines encoding fields from objects but not reading them back. | OAS defines the inverse for this edition. |
| Typed declarations for media no row of §4.3 covers, including XML Object modeling (OAS §4.7.26) | Mapping them to values is a model of its own. | This kind defines that mapping. |
| Name-based Encoding for multipart types other than `multipart/form-data` (OAS §4.7.15.3) | OAS leaves it optional. | OAS makes it normative. |
| Header parameters and credentials naming fields HTTP owns (§5) | They would contradict the message's own framing. | HTTP gives up ownership of those fields. |
| Style and value combinations OAS leaves undefined or `n/a` (§4.7.12.2.2, §4.7.12.4, Appendix C.1) | No serialization is defined. | OAS defines them. |
| Separators inside space- and pipe-delimited values; `[` or `]` in deep-object names (Appendix E.5) | The structure becomes ambiguous. | OAS defines an escape. |
| Form-style cookies with more than one pair (Appendix D) | OAS calls them incorrect: cookie pairs are not joined with `&`. | OAS defines a cookie form. |
| `http` schemes other than `basic` and `bearer` | No credential carriage is defined here. | This kind pins one. |
