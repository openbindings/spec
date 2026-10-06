# OpenBindings kind for OpenAPI 2.0

**Status: unreleased `@1` candidate.** This document proposes the meaning of
`openbindings.openapi-2.0@1`; it does not publish the identifier.

This document bridges OpenAPI 2.0 into OpenBindings. The OpenAPI Specification
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

A source whose `kind` is exactly `openbindings.openapi-2.0@1` is read under this
document. A binding of this kind denotes one OAS operation invoked over HTTP.

This kind incorporates [OpenBindings Specification 0.2.0](../../openbindings.md).
It also incorporates [OpenAPI Specification 2.0](https://spec.openapis.org/oas/v2.0.html) (OAS)
with the normative references it cites for the features used here,
[HTTP Semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110), and
[JSONata 2.1](https://github.com/jsonata-js/jsonata/tree/5d1473277e0022d8580e00f891b12080eb3edd74/website/versioned_docs/version-2.1.0)
as defined by that documentation snapshot.

`[pin]` References follow [JSON Reference draft-03](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03),
which OAS's bibliography names, rather than the draft-02 link in OAS §6.4.17.

`[pin]` An entry document declares `swagger` `"2.0"`; a YAML plain scalar spelled
`2.0` counts. Other editions are not accepted.

## 2. Source content

Source `content` is an object with one or both of these members and no others:

| Member | Meaning |
| --- | --- |
| `document` | The entry document: a JSON object, or a string holding one JSON or YAML document. |
| `location` | An absolute URI naming the entry document. A fragment must be empty and is removed. |

Any other `content` is invalid. `location` is the entry document's retrieval URI
whether or not `document` is present; after a retrieval that followed redirects,
the final URI is (RFC 3986 §5.1.3). It is the base for the document's references
and supplies a missing `host` or `schemes` (OAS §6.4.1.1). With `location` alone,
the document is obtained through a resolver for the URI's scheme, and an HTTP
retrieval produces it only with a 2xx response. When none produces it, the
binding cannot be interpreted. The URI of the OBI carrying the source is never a
base: a reference that needs a base when none exists cannot be interpreted, and a
missing `host` or `schemes` then needs §7 `server`.

`[pin]` Text is [YAML 1.2.2](https://yaml.org/spec/1.2.2/) under its Core schema,
except that a scalar mapping key denotes its spelling, so `200:` names the
response `"200"`. Duplicate keys, non-scalar keys and multiple documents are
invalid. A value JSON cannot represent is a defect of the declaration containing
it.

`[pin]` A referenced document's root is read as the object type the referring
position expects, and a node referenced from positions expecting different types
is read once for each.

`[convention]` The entry document's representation, its root type and its
`swagger` value are the only source-wide checks; failing one makes the source
invalid. Any other defect affects only the declarations that need it. A source
that declares operations under `paths`, none of which can be a target, is
invalid; one that declares none is valid and has no targets.

## 3. Binding content and target

Binding `content` is an object with a required `target` and optional `input`,
`output` and `failure` (§4.2), and no other members.

`target` is an [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) JSON Pointer in
string form into the entry document, of the form `/paths/<path>/<method>`, where
`<method>` is `get`, `put`, `post`, `delete`, `options`, `head` or `patch`. The
pointer is not percent-decoded; its method is looked up in the Path Item after
any `$ref` is merged. A pointer that reaches no operation in the obtained
document is invalid binding content.

`[pin]` A Path Item with `$ref` (OAS §6.4.6.1 leaves conflicts undefined) is
merged with its referenced Path Item: a field present in only one applies. A
method present in both makes that operation ambiguous; any other field present in
both makes every operation of the Path Item ambiguous. An ambiguous operation is
not a target.

`[pin]` An operation reached through a Path Item in another document inherits the
entry document's `schemes`, `host`, `basePath`, `consumes`, `produces` and
`security`.

`[pin]` Specification extensions and unknown fields have no effect under this
kind (OAS §6.5 leaves their support optional).

## 4. Operation values

### 4.1 Request value

The request value is absent or an object with optional `parameters` and `body`,
and nothing else; absence supplies neither. A request value of any other shape
cannot be sent.

`parameters` is an object keyed by the names of the operation's effective `path`,
`query`, `header` and `formData` parameters (OAS §6.4.7.1, §6.4.9). `[convention]`
Where one name occurs at more than one location, names compared exactly, every
key is `<location>/<name>`, escaping `~` and `/` as RFC 6901 does; otherwise keys
are the names. Keys do not depend on runtime context or capability. A key no
effective parameter has cannot be sent.

`[pin]` Header parameters differing only in case (RFC 9110 §5.1) within one list
are duplicate parameters; an Operation header parameter overrides a Path Item one
whatever its case; the key is the effective declaration's spelling. A header
parameter named `Accept` or `Authorization` is an ordinary parameter: it supplies
that field.

`body` is the value of the operation's `body` parameter, whose declared name is
not a key. A member that is absent is not supplied; a member that is null
supplies JSON null. Required parameters and a required body must be supplied; a
body supplied for an operation without a `body` parameter cannot be sent, and a
declared body is sent with every method this edition admits. `[pin]` A null for a
non-body parameter cannot be serialized, so it cannot be sent. A supplied
property marked `readOnly`, at any depth the body schema reaches through
`properties`, `additionalProperties`, `items` or `allOf`, cannot be sent (OAS
§6.4.18.1 says it must not be sent); it is not silently removed.

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

`[convention]` After content codings are removed (RFC 9110 §8.4), a body or a
part corresponds to a value by the first row that applies:

| Representation | Value |
| --- | --- |
| A response schema of `type: file`, or a `formData` file | The octets as a Base64 string. |
| JSON media (`application/json`, `+json`) | The JSON value. |
| Any media declared `type: string` with `format: byte` | The Base64 string. |
| Any media declared `type: string` with `format: binary` | The octets as a Base64 string. |
| Character media (`text/*` other than XML) | A string, number, integer or boolean, as below. |
| Any other media declared with no type | The octets as a Base64 string. |

A representation no row covers is unusable. A JSON response needs no
declaration; a request body and any other response representation need a
matching declaration: a media type the effective `consumes` or `produces` admits,
with a governing schema. A `type: file` response admits any media type. Values
are not validated against OAS schemas, which are inspected only for what this
document names.

`[pin]` A declaration's types come from its Schema Object's `type`, reached by
following only Reference Objects and `allOf` (the procedure
[OAS 3.2.1](https://spec.openapis.org/oas/v3.2.1.html) §4.24.4.2 later wrote
down, without its optional inspection of other keywords); keywords outside OAS
2.0's subset (§6.4.18) have no effect, and a schema without `type` admits every
type. A character response is the text as a string when its declaration admits
`string` or has no type; it is the one scalar when the declaration admits exactly
one of `number`, `integer` and `boolean` (`integer` counting as a `number`) and
not `string`; otherwise it is unusable. A request writes a scalar in the text
form of its own type; an object, array or null has no text form and cannot be
sent in character media.

`[pin]` Character media without `charset` are UTF-8, a superset of RFC 2046's
US-ASCII default. A boolean is `true` or `false`; a number is a JSON number with
its value, and an integer is written as decimal digits with a leading `-` when
negative. Decoding reads exactly one such token, allowing JSON whitespace around
it. These text forms also serve parameter serialization (§5).

`[pin]` Base64 is RFC 4648 §4 with padding and zero pad bits; a non-canonical
string cannot be sent.

`[pin]` In JSON (RFC 8259 §4, §8.1, §8.2), the last of duplicate member names
wins, a leading byte order mark is ignored on receipt and never sent, and
unpaired surrogates cannot be carried. A number keeps its exact value; an
implementation that cannot hold one unchanged fails that request or completion
instead of substituting another.

Defaults and examples, of parameters or schemas, never supply values.

## 5. Request assembly

OAS §§6.4.9 and 6.4.10 govern parameters and their `collectionFormat`, with these
decisions:

- `[pin]` An empty array is one empty value, not absence. At `query` and
  `formData` locations an empty value needs `allowEmptyValue: true`; without it,
  that invocation cannot be sent. An absent optional parameter contributes
  nothing.
- `[pin]` Path and query values are UTF-8 with every character outside RFC 3986's
  unreserved set percent-encoded, as OAS 3.2.1 §4.12.4 recommends. Array items
  are encoded and then joined by their `collectionFormat` separator, which is
  itself encoded only where RFC 3986 does not allow it (the space, tab and `|` of
  `ssv`, `tsv` and `pipes`). A path parameter value of `.` or `..` cannot be
  sent, since it would change the target path (RFC 3986 §5.2.4).
- `[pin]` Header values are UTF-8, are not percent-encoded and must be valid field
  values (RFC 9110 §5.5). A header parameter whose name is not a valid field name
  is unusable.
- `[convention]` Header parameters and header credentials naming `Host`,
  `Content-Length`, `Content-Type`, `Connection`, `Keep-Alive`,
  `Proxy-Authorization`, `Proxy-Connection`, `TE`, `Trailer`,
  `Transfer-Encoding` or `Upgrade`, and header credentials naming
  `Content-Encoding`, are unusable (§9). Two contributions to one header or one
  query name, from different declarations or credentials, are never sent
  together: a required declaration colliding with a credential, or two
  credentials of one alternative colliding, make that security alternative
  unusable; otherwise only the invocation that would send both cannot be sent.
- `[pin]` The effective `consumes` and `produces` are the operation's lists, else
  the entry document's; an operation's empty list clears the entry document's
  (OAS §6.4.7.1). Where neither declares a nonempty list, a `body` parameter uses
  `application/json`, `formData` parameters use
  `application/x-www-form-urlencoded`, or `multipart/form-data` when one is a
  file, and responses admit JSON. A declared media range matches a media type
  when each of the range's parameters appears there with the same value,
  `charset` compared case-insensitively (RFC 9110 §8.3.1); the most specific match
  applies: a concrete type, then `type/*`, then `*/*`, and among equals the match
  with more parameters; matches still equal are ambiguous and unusable. When a
  body or form data is supplied, one usable media type is used; with several, or
  a range, `requestMedia` (§7) chooses.
- `[pin]` `formData` parameters are sent only as
  `application/x-www-form-urlencoded` or `multipart/form-data`, and a `file`
  parameter only as `multipart/form-data`; an invocation supplying them otherwise
  cannot be sent. Each forms one field, or one per item under `multi`, encoded as
  [HTML 4.01](https://www.w3.org/TR/html401/) §17.13.4 describes, with UTF-8
  names and values whose line breaks are not converted. In `multipart/form-data`,
  a text field is `text/plain` UTF-8, and a file field carries its octets with the
  media type of `propertyMedia` (§7) and the parameter name as its `filename`
  (RFC 7578 §4.2); parts use the exact parameter name.
- `[convention]` A request body's content codings come only from a supplied
  `Content-Encoding` header parameter and are applied in order (RFC 9110 §8.4).

## 6. Responses and completion

`[pin]` A 301, 302, 303, 307 or 308 response with a `Location` is followed, up to
20 times (RFC 9110 §15.4 leaves this to the client): 307 and 308 repeat the
method and content; 301 and 302 do too, except that POST becomes GET without
content; 303 becomes GET without content, and HEAD stays HEAD. The `Location` is
used as given, and credentials are not sent to another origin. Any other final
response, including other 3xx statuses, completes the invocation; a transport
failure before one completes it unsuccessfully.

The final status selects the response declaration, an exact code before
`default` (OAS §6.4.11). `[pin]` A Responses Object with only `default` applies
it to every status. An invalid declaration does not fall back to `default`, and
content it governs cannot be decoded.

### 6.1 Success

A final 2xx response completes the invocation successfully. Empty content,
meaning zero octets after content decoding or none under HTTP's rules for the
method and status, emits no value. Nonempty content's `Content-Type` selects the
declaration as in §4.3 and §5; `[pin]` a missing `Content-Type` means
`application/octet-stream` (RFC 9110 §8.3). A response with several
`Content-Type` values, or whose representation is neither JSON nor matched by a
usable declaration, completes unsuccessfully, as does a failed decoding or
transform. The response emits one value once its whole representation is
decoded; a truncated one emits none. Headers never become output values.
Whatever the request advertised for negotiation, the received representation is
interpreted the same way.

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
input. A supplied choice is used wherever it applies, needed or not; an
invocation that needs an unanswered choice cannot be sent.

| Name | Choice | Needed when |
| --- | --- | --- |
| `server` | A complete absolute `http` or `https` base URL without userinfo, query or fragment, replacing scheme, host and `basePath`. | No usable scheme or host can be determined. |
| `requestMedia` | One concrete media type the effective `consumes` admits. | A body or form data is supplied and several are admitted, or a range. |
| `propertyMedia` | One concrete media type for a `formData` file. | Never; without it the file is `application/octet-stream`. |
| `security` | One Security Requirement alternative (OAS §6.4.26). | No usable alternative can be met from the credentials the context holds. |

`[pin]` Without a `security` choice, the first usable alternative in declaration
order whose credentials the context holds is used, an alternative needing
credentials before the empty one.

`[pin]` The URL is the scheme, `host` and `basePath` (OAS §6.4.1.1), or a
context-supplied base, followed by the path after one trailing `/` is removed
from the base. Of the declared schemes, `https` is used when present, else
`http`. A result that is not an absolute URI with a host cannot be sent.

Credentials are context, one for each scheme in the chosen alternative, and never
become input or output values. `[pin]` They are carried as follows:

- `basic`: [RFC 7617](https://www.rfc-editor.org/rfc/rfc7617) with UTF-8.
- `oauth2`: an access token in the Authorization field
  ([RFC 6750](https://www.rfc-editor.org/rfc/rfc6750) §2.1); a token outside its
  `b64token` syntax cannot be sent.
- `apiKey`: the key at its declared name, percent-encoded as a query value or as
  a header field value.

`[pin]` An empty Security Requirement Object is an alternative that needs no
credentials (as [OAS 3.0.4](https://spec.openapis.org/oas/v3.0.4.html) later
stated). A defective scheme makes only the alternatives using it unusable.
Security Requirement names resolve in the entry document's
`securityDefinitions`.

## 8. Synthesis

An OBI generated from an OAS document claims, for each operation it emits, only
what this document makes true of the binding (core §5.3); a schema translation
that loses meaning is not presented as the operation's contract.

## 9. Exclusions

An invocation is sent only when its binding, input and context are fully
interpreted. Otherwise the binding is invalid, cannot be interpreted, lacks a
context choice, or reaches one of these exclusions:

| Excluded | Reason | Reopens when |
| --- | --- | --- |
| Responses switching protocols (101), and the `ws` and `wss` schemes | A new protocol is not an HTTP response. | This kind defines upgrade semantics. |
| One response as a sequence of values | OAS 2.0 defines no way to frame one body as several values. | OAS defines a framing for this edition. |
| Form and multipart responses as objects | OAS 2.0 defines no response form encoding. | OAS defines one for this edition. |
| Typed declarations for media no row of §4.3 covers, including XML Object modeling (OAS §6.4.19) | Mapping them to values is a model of its own. | This kind defines that mapping. |
| Header parameters and credentials naming fields HTTP owns (§5) | They would contradict the message's own framing. | HTTP gives up ownership of those fields. |
| A `collectionFormat` member containing its own separator | The value's boundaries cannot be recovered. | OAS defines an escape. |
