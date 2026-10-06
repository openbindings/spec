# OpenBindings kind for OpenAPI 3.0

**Status: unreleased `@1` candidate.** This document proposes the meaning of
`openbindings.openapi-3.0@1`; it does not publish the identifier.

This document bridges OpenAPI 3.0 into OpenBindings. The OpenAPI Specification
and the standards it cites govern everything they define. This document adds
only what a binding needs beyond them, and marks each decision: `[pin]` fixes
one reading where an authority is ambiguous or leaves a choice to tools;
`[convention]` decides where no authority speaks; `[configuration point]` names
a choice the consumer supplies. Exclusions are listed with their reopen
conditions in §9. Unmarked text defines this kind's content or cites an
authority.

## 1. Kind and authorities

A source whose `kind` is exactly `openbindings.openapi-3.0@1` is read under this
document.

This kind incorporates [OpenBindings Specification 0.2.0](../../openbindings.md).
It also incorporates [OpenAPI Specification 3.0.4](https://spec.openapis.org/oas/v3.0.4.html) (OAS)
with the normative references it cites for the features used here,
[HTTP Semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110), and
[JSONata 2.1](https://github.com/jsonata-js/jsonata/tree/5d1473277e0022d8580e00f891b12080eb3edd74/website/versioned_docs/version-2.1.0)
as defined by that documentation snapshot.

`[pin]` An entry document declares `openapi` `3.0.0`, `3.0.1`, `3.0.2`, `3.0.3`
or `3.0.4` and is read under the 3.0.4 text (OAS §4.1). 3.0.4 changes the
meaning of some earlier documents: it bases a relative server URL on the
document containing the Server Object (§4.7.5.1), lists methods whose bodies are
ignored (§4.7.10.1), and adds the form encoding rules (§4.7.15) and Appendices B
to F. Later editions are not accepted.

A binding of this kind denotes one HTTP request for one OAS operation, taking one
input value and returning at most one output value.

## 2. Source content

Source `content` is an object with one or both of these members and no others:

| Member | Meaning |
| --- | --- |
| `document` | The entry document: a JSON object, or a string holding one JSON or YAML document. |
| `location` | An absolute URI naming the entry document. A fragment must be empty and is removed. |

Any other `content` is invalid for this kind. `location` is the entry document's
retrieval URI whether or not `document` is present: the base for its references
and its relative server URLs (OAS §4.6, §4.7.5.1). With `location` alone, the
document is obtained through a resolver for the URI's scheme; if none produces
it, the binding cannot be interpreted, which does not make it invalid. The URI of
the OBI carrying the source is never a base; a reference or server URL that needs
a base when none exists cannot be interpreted.

`[pin]` Text is [YAML 1.2.2](https://yaml.org/spec/1.2.2/) under the constraints of OAS §4.2. Duplicate keys,
values JSON cannot represent and multiple documents are invalid.

`[pin]` A referenced document's root is read as the object type the referring
position expects, and a node referenced from positions expecting different types
is read once for each (OAS §4.3.1).

`[convention]` The entry document's representation, its root type and its
`openapi` value are the only source-wide checks; failing one makes the source
invalid. Any other defect affects only the declarations that need it. A source
that declares operations, none of which remains addressable, is invalid; one that
declares none is valid and has no targets.

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
ambiguous and not addressable.

`[pin]` An operation reached through a Path Item in another document inherits the
entry document's `servers` and `security` (OAS §4.3.2). Each relative reference
and server URL keeps the base of the document that declares it. An empty
`servers` array on a Path Item or Operation falls through to the enclosing level.

Specification extensions and unknown fields have no effect under this kind.

## 4. Operation values

### 4.1 Request value

The request value is absent or an object with optional `parameters` and `body`,
and nothing else; absence supplies neither. A request value of any other shape
prevents dispatch.

`parameters` is an object keyed by the names of the operation's effective
parameters (OAS §4.7.10.1). `[convention]` Where one name occurs at more than one
location, every key is `<location>/<name>`, escaping `~` and `/` as RFC 6901
does; otherwise keys are the names. Keys do not depend on runtime context or
capability. A key no effective parameter has prevents dispatch.

`[pin]` Header parameter names compare case-insensitively (OAS §3.8, RFC 9110
§5.1). Header parameters differing only in case within one list are duplicate
parameters; an Operation header parameter overrides a Path Item one whatever its
case; the key is the effective declaration's spelling. A header parameter named
`Accept`, `Content-Type` or `Authorization`, in any case, is ignored (OAS
§4.7.12.2.1) and has no key.

`body` is the request body value. A member that is absent is not supplied; a
member that is null supplies JSON null. Required parameters and a required body
must be supplied. `[pin]` A request body applies to POST, PUT and PATCH. OAS
ignores it where HTTP leaves body semantics vague, naming GET, HEAD and DELETE
(§4.7.10.1); this kind treats every other method the same way, so a supplied body
there prevents dispatch and the declaration requires nothing.

### 4.2 Transforms

`input`, `output` and `failure` are JSONata expressions:

- `input` receives the operation's input value (undefined when absent); its result
  is the request value. Without `input`, the input value is the request value.
- `output` receives the decoded successful response value; its result is the
  operation output value. Without `output`, the decoded value is the output value.
- `failure` receives the decoded body of a non-2xx final response (undefined when
  there is none or it cannot be decoded), with `$status` bound to the status code
  as a number; its result is an operation output value (§6.2).

No other variables are bound, and expressions see no credentials, headers or
other transport state.

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
`input` prevents dispatch; a failed `output` or `failure` completes the
invocation unsuccessfully.

### 4.3 Representations

`[convention]` After content codings are removed (RFC 9110 §8.4), a body, a form
field, a part or a content-form parameter corresponds to a value as follows:

| Representation | Value |
| --- | --- |
| JSON media (`application/json`, `+json`) | The JSON value. |
| Any media declared `type: string` with `format: binary`, or with no schema | The octets as a Base64 string (OAS §4.4.2). |
| Character media (`text/*` other than XML) declared as one scalar type | That string, number, integer or boolean. |
| `application/x-www-form-urlencoded`, `multipart/form-data` | An object with one member per field (OAS §4.7.15). |

The first row that applies governs. A JSON representation needs no declaration;
any other representation needs a matching declaration. Values are not validated
against OAS schemas, which are inspected only for what this document names.

`[pin]` A declared type comes from the governing Schema Object's `type`, reached
by following only Reference Objects and `allOf`; `nullable: true` beside a `type`
adds null, and a schema without `type` admits every type (the procedure [OAS 3.2.1](https://spec.openapis.org/oas/v3.2.1.html)
§4.24.4.2 later wrote down). Keywords outside OAS 3.0's subset (§4.7.24) have no
effect. For a request, the supplied value's own type selects among several
declared types. A response declaration that determines no single type for a
character representation, and a typed declaration for media the table does not
list (including XML), make that representation unusable; other declared
representations remain usable.

`[pin]` Character media without `charset` are UTF-8. A boolean is `true` or
`false`; a number is a JSON number spelling of its value, and an integer value is
plain decimal digits. Decoding reads exactly one such token, allowing JSON
whitespace around it. Null has no text form. These text forms also serve
parameter serialization (§5), which OAS Appendix B leaves to implementations.

`[pin]` Base64 is RFC 4648 §4 with padding and zero pad bits; a non-canonical
string prevents dispatch. A string declared with `format: byte` is that Base64
string and is not decoded again.

`[pin]` In JSON, the last of duplicate member names wins, a leading byte order
mark is ignored on receipt and never sent, and unpaired surrogates cannot be
carried. A number keeps its exact value; an implementation that cannot hold one
unchanged fails that request or completion instead of substituting another.

Schema defaults, examples, `readOnly` and `writeOnly` never add or remove members.

## 5. Request assembly

OAS §§4.7.12 to 4.7.15 and Appendices B to E govern serialization, with these
decisions:

- `[pin]` Null uses OAS §4.7.12.4's undefined column, except that null contributes
  nothing in the matrix and label styles, as RFC 6570 requires (OAS 3.2.1 corrects
  these cells). Where RFC 6570 applies, an empty array or object contributes
  nothing (OAS Appendix C.4.3). An empty string is a value; an absent optional
  parameter contributes nothing.
- `[pin]` Under `allowReserved`, a value containing `&` or `#` cannot be sent
  (OAS Appendix E.5). A value a declaration cannot serialize prevents only the
  invocation that supplies it.
- `[pin]` Header and cookie values are not percent-encoded, whether serialized by
  style or by content (OAS Appendix D; [OAS 3.1.2](https://spec.openapis.org/oas/v3.1.2.html) states this for headers). A
  form-style cookie has no `?` prefix (OAS 3.1.2 Appendix D.1). A content-form
  path or query parameter is percent-encoded as one value.
- `[pin]` Header values are UTF-8 and must be valid field values (RFC 9110 §5.5);
  cookie values must satisfy [RFC 6265](https://www.rfc-editor.org/rfc/rfc6265)
  §4.2.1 and are not escaped. A header parameter named `Cookie` supplies the whole
  Cookie field and cannot be combined with cookie parameters.
- `[convention]` Parameters and credentials naming `Host`, `Content-Length`,
  `Connection`, `Keep-Alive`, `Proxy-Authorization`, `Proxy-Connection`, `TE`,
  `Trailer`, `Transfer-Encoding` or `Upgrade`, and credentials naming
  `Content-Type` or `Content-Encoding`, are unusable; HTTP itself or the body owns
  those fields. An invocation that would send two contributions, from different
  declarations or credentials, to one header, one query name or one cookie name
  cannot be sent.
- `[pin]` A declared media range matches when its parameters match, `charset`
  case-insensitively and others exactly (RFC 9110 §8.3.1). The most specific match
  applies (OAS §4.7.13.1); equally specific matches are ambiguous and unusable. A
  Request Body whose `content` is empty admits no body. With one usable request
  alternative, it is used; with several, or a range, `requestMedia` (§7) chooses.
  The `Content-Type` field carries the chosen type and any multipart boundary.
- `[pin]` A form or `multipart/form-data` body may carry any member its schema
  admits through `properties`, `additionalProperties` or `allOf`; a member it
  forbids cannot be sent. An array member is one field or part per item, each
  taking the item declaration's media (as OAS 3.2.1 §4.14.5.1 later made
  explicit). Null in a field or part follows the part's media: JSON media carry
  it, and otherwise an optional member is omitted and a required one prevents
  dispatch. Name-based Encoding applies only to `multipart/form-data` (the
  §4.7.15.3 workaround for other multipart types is not supported).
- `[pin]` A property whose media its declaration does not fix (a range, or several
  Encoding content types) needs `propertyMedia` (§7). Part headers come only from
  Encoding `headers` fixed by a single-valued `enum`. A part declared with
  `format: byte` carries `Content-Transfer-Encoding: base64` (OAS §4.7.15.3); a
  fixed header contradicting it makes the part unusable. Generated form-data parts
  use the exact property name and no filename.
- `[convention]` A request body's content codings come only from a supplied
  `Content-Encoding` header parameter and are applied in order (RFC 9110 §8.4).

## 6. Responses and completion

`[pin]` Redirects are followed as RFC 9110 §15.4 describes automatic
redirection, including its change of method for 301, 302 and 303. Interim
responses do not complete the invocation. The final status selects the response
declaration (OAS §4.7.16); an invalid declaration does not fall back to a less
specific one.

### 6.1 Success

A final 2xx response completes the invocation successfully. Its `Content-Type`
selects the content declaration as in §5. `[pin]` A missing `Content-Type` means
`application/octet-stream` (RFC 9110 §8.3). A response with several `Content-Type`
values, or whose representation is neither JSON nor matched by a usable
declaration, completes unsuccessfully, as does a failed decoding or transform.

Empty content, meaning zero octets after content decoding or none under HTTP's
rules for the method and status, emits no value. Otherwise the response emits one
value once the whole representation is decoded; a truncated response emits none.
Headers and links never become output values. Whatever the request advertised for
negotiation, the received representation is interpreted the same way.

### 6.2 Failure

A final non-2xx response completes the invocation unsuccessfully with no output
value, unless the binding has `failure`. Then the body is decoded under the
declaration for its status as a successful body would be, a body that cannot be
decoded giving `failure` an undefined context, and `failure` evaluates (§4.2): a
result is emitted as an output value and the invocation completes successfully;
an undefined result leaves it unsuccessful.

### 6.3 Abandonment

Abandoning an invocation completes it unsuccessfully without undoing remote
effects.

## 7. Context

`[configuration point]` The consumer supplies these choices, never the operation
input. An invocation that needs an unanswered choice is not sent.

| Name | Choice | Needed when |
| --- | --- | --- |
| `server` | One effective Server Object (OAS §4.7.5) with its variable values, or a complete absolute `http` or `https` base URL without userinfo, query or fragment. | More than one effective server, or none usable. |
| `requestMedia` | One concrete media type matching a usable request alternative. | Several usable alternatives, or a range. |
| `propertyMedia` | One concrete media type for each affected form or multipart property. | The declaration does not fix its media (§5). |
| `security` | One Security Requirement alternative (OAS §4.7.30), possibly the empty one. | More than one usable alternative. |

`[pin]` Server variables take their supplied values, else their defaults, as
written (OAS §4.7.6); an undeclared variable takes a supplied value. A relative
server URL is resolved against its document's base (§2); one trailing `/` is then
removed and the path appended (OAS §4.7.8). A result that is not an absolute URI
prevents dispatch.

Credentials are context, one for each scheme in the chosen alternative, and never
become input or output values. `[pin]` They are carried as follows:

- `http` with `basic`: [RFC 7617](https://www.rfc-editor.org/rfc/rfc7617) with
  UTF-8.
- `http` with `bearer`, `oauth2` and `openIdConnect`: an access token in the
  Authorization field ([RFC 6750](https://www.rfc-editor.org/rfc/rfc6750) §2.1).
- `apiKey`: the key at its declared name and location, serialized as a parameter
  there would be.

A defective scheme makes only the alternatives using it unusable. Component names
in a referenced document's Security Requirement resolve in the entry document
(OAS §4.3.2, Appendix F).

## 8. Synthesis

An OBI generated from an OAS document must realize each operation it emits as
this document defines (core §5.3). It may cover a subset of the operations and
choose operation names and contract shapes; a claim to cover them all must be
true.

Callbacks (OAS §4.7.18) become core dependencies: the input describes the request
the API sends, and the output the response it expects. `[convention]` These
dependencies carry no `kinds` constraint, because the OAS document has no
authority over how the consumer's side is described.

## 9. Exclusions

An invocation is sent only when its binding, input and context are fully
interpreted. Outside that, the binding has invalid content, needs a resource that
is unavailable (which does not show the binding invalid), needs a choice the
context lacks, or reaches one of these exclusions:

| Excluded | Reason | Reopens when |
| --- | --- | --- |
| Responses switching protocols (101) | A new protocol is not an HTTP response. | This kind defines upgrade semantics. |
| One response as a sequence of values | OAS 3.0 defines no way to frame one body as several values. | Use the OpenAPI 3.2 kind, which incorporates OAS 3.2's sequential media. |
| Form and multipart responses as objects | OAS 3.0 defines encoding fields from objects but not reading them back. | OAS defines the inverse for this edition. |
| XML Object modeling (OAS §4.7.26) | Mapping typed XML to values is a model of its own. | This kind defines that mapping. |
| Style and value combinations OAS leaves undefined or `n/a` (§4.7.12.2.2, §4.7.12.4, Appendix C.1) | No serialization is defined. | OAS defines them. |
| Separators inside space- and pipe-delimited values; `[` or `]` in deep-object names (Appendix E.5) | The structure becomes ambiguous. | OAS defines an escape. |
| Form-style cookies with more than one pair (Appendix D) | OAS calls them incorrect: cookie pairs are not joined with `&`. | OAS defines a cookie form. |
| `http` schemes other than `basic` and `bearer` | No credential carriage is defined here. | This kind pins one. |
