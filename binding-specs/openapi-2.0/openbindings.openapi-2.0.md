# OpenBindings kind for OpenAPI 2.0

**Status: unreleased `@1` candidate.** This document proposes the meaning of
`openbindings.openapi-2.0@1`; it does not publish the identifier.

This document bridges OpenAPI 2.0 into OpenBindings. The OpenAPI Specification
and the standards it cites govern everything they define. This document adds
only what a binding needs beyond them, and marks each decision: `[pin]` fixes
one reading where an authority is ambiguous or leaves a choice to tools;
`[convention]` decides where no authority speaks; `[configuration point]` names
a choice the consumer supplies. Exclusions are listed with their reopen
conditions in §9. Unmarked text defines this kind's content or cites an
authority.

## 1. Kind and authorities

A source whose `kind` is exactly `openbindings.openapi-2.0@1` is read under this
document.

This kind incorporates [OpenBindings Specification 0.2.0](../../openbindings.md).
It also incorporates [OpenAPI Specification 2.0](https://spec.openapis.org/oas/v2.0.html) (OAS) with
the normative references it cites for the features used here,
[HTTP Semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110), and
[JSONata 2.1](https://github.com/jsonata-js/jsonata/tree/5d1473277e0022d8580e00f891b12080eb3edd74/website/versioned_docs/version-2.1.0)
as defined by that documentation snapshot.

`[pin]` References follow [JSON Reference draft-03](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03),
which OAS's bibliography names, rather than the draft-02 link in OAS §6.4.17.

An entry document declares `swagger` `2.0`. Other editions are not accepted.

A binding of this kind denotes one HTTP request for one OAS operation, taking one
input value and returning at most one output value.

## 2. Source content

Source `content` is an object with one or both of these members and no others:

| Member | Meaning |
| --- | --- |
| `document` | The entry document: a JSON object, or a string holding one JSON or YAML document. |
| `location` | An absolute URI naming the entry document. A fragment must be empty and is removed. |

Any other `content` is invalid for this kind. `location` is the entry document's
retrieval URI whether or not `document` is present: the base for its references,
and the source of a missing `host` or `schemes` (OAS §6.4.1.1). With `location`
alone, the document is obtained through a resolver for the URI's scheme; if none
produces it, the binding cannot be interpreted, which does not make it invalid.
The URI of the OBI carrying the source is never a base; a reference that needs a
base when none exists cannot be interpreted.

`[pin]` Text is [YAML 1.2.2](https://yaml.org/spec/1.2.2/) under its Core schema, limited to values JSON can
represent. A scalar mapping key denotes its spelling, so `200:` names the
response `"200"`. Duplicate keys, non-scalar keys and multiple documents are
invalid.

`[pin]` A referenced document's root is read as the object type the referring
position expects, and a node referenced from positions expecting different types
is read once for each.

`[convention]` The entry document's representation, its root type and its
`swagger` value are the only source-wide checks; failing one makes the source
invalid. Any other defect affects only the declarations that need it. A source
that declares operations, none of which remains addressable, is invalid; one that
declares none is valid and has no targets.

## 3. Binding content and target

Binding `content` is an object with a required `target` and optional `input`,
`output` and `failure` (§4.2), and no other members.

`target` is an [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) JSON Pointer in
string form into the entry document, of the form `/paths/<path>/<method>`, where
`<method>` is `get`, `put`, `post`, `delete`, `options`, `head` or `patch`. The
pointer is not percent-decoded. A pointer to no operation is not a target.

`[pin]` A Path Item with `$ref` (OAS §6.4.6.1 leaves conflicts undefined) is
merged with its referenced Path Item: a field present in only one applies; a
field present in both, if the selected operation uses it, makes that operation
ambiguous and not addressable.

`[pin]` An operation reached through a Path Item in another document inherits the
entry document's `schemes`, `host`, `basePath`, `consumes`, `produces` and
`security`. Each relative reference keeps the base of the document that declares
it.

Specification extensions and unknown fields have no effect under this kind.

## 4. Operation values

### 4.1 Request value

The request value is absent or an object with optional `parameters` and `body`,
and nothing else; absence supplies neither. A request value of any other shape
prevents dispatch.

`parameters` is an object keyed by the names of the operation's effective `path`,
`query`, `header` and `formData` parameters (OAS §6.4.7.1, §6.4.9). `[convention]`
Where one name occurs at more than one location, every key is `<location>/<name>`,
escaping `~` and `/` as RFC 6901 does; otherwise keys are the names. Keys do not
depend on runtime context or capability. A key no effective parameter has
prevents dispatch.

`[pin]` Header parameter names compare case-insensitively (RFC 9110 §5.1). Header
parameters differing only in case within one list are duplicate parameters; an
Operation header parameter overrides a Path Item one whatever its case; the key
is the effective declaration's spelling. A header parameter named `Accept` or
`Authorization` is an ordinary parameter: it supplies that field.

`body` is the value of the operation's `body` parameter, whose declared name is
not a key. A member that is absent is not supplied; a member that is null
supplies JSON null. Required parameters and a required body must be supplied; a
supplied body is sent with every method this edition admits. `[pin]` A null for a
non-body parameter cannot be serialized and prevents dispatch. A supplied
property marked `readOnly`, at any depth the body schema reaches through
`properties`, `additionalProperties`, `items` or `allOf`, prevents dispatch (OAS
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

`[convention]` After content codings are removed (RFC 9110 §8.4), a body or a
part corresponds to a value as follows:

| Representation | Value |
| --- | --- |
| A response schema of `type: file`, or a `formData` file | The octets as a Base64 string. |
| JSON media (`application/json`, `+json`) | The JSON value. |
| Any media declared `type: string` with `format: binary` | The octets as a Base64 string. |
| Character media (`text/*` other than XML) declared as one scalar type | That string, number, integer or boolean. |

The first row that applies governs. A JSON representation needs no declaration;
any other representation needs a matching declaration, a media type the effective
`consumes` or `produces` admits with a governing schema. Values are not validated
against OAS schemas, which are inspected only for what this document names.

`[pin]` A declared type comes from the governing Schema Object's `type`, reached
by following only Reference Objects and `allOf`; a `type` array admits each type
it lists, and a schema without `type` admits every type. Keywords outside OAS
2.0's subset (§6.4.18) have no effect. For a request, the supplied value's own
type selects among several declared types. A response declaration that
determines no single type for a character representation, and a typed
declaration for media the table does not list (including XML), make that
representation unusable.

`[pin]` Character media without `charset` are UTF-8. A boolean is `true` or
`false`; a number is a JSON number spelling of its value, and an integer value is
plain decimal digits. Decoding reads exactly one such token, allowing JSON
whitespace around it. Null has no text form. These text forms also serve
parameter serialization (§5).

`[pin]` Base64 is RFC 4648 §4 with padding and zero pad bits; a non-canonical
string prevents dispatch. A string declared with `format: byte` is that Base64
string and is not decoded again.

`[pin]` In JSON, the last of duplicate member names wins, a leading byte order
mark is ignored on receipt and never sent, and unpaired surrogates cannot be
carried. A number keeps its exact value; an implementation that cannot hold one
unchanged fails that request or completion instead of substituting another.

Schema defaults and examples never add members.

## 5. Request assembly

OAS §§6.4.9 and 6.4.10 govern parameters and their `collectionFormat`, with these
decisions:

- `[pin]` An empty array is one empty value, not absence. At `query` and
  `formData` locations an empty value needs `allowEmptyValue: true`; without it,
  that invocation cannot be sent. An absent optional parameter contributes
  nothing.
- `[pin]` Path and query values are UTF-8, percent-encoded as RFC 3986 requires
  for their component; characters that would change the URI's structure,
  including the space, tab and `|` separators of `ssv`, `tsv` and `pipes`, are
  encoded. Header values are UTF-8, are not percent-encoded and must be valid
  field values (RFC 9110 §5.5).
- `[convention]` Parameters and credentials naming `Host`, `Content-Length`,
  `Content-Type`, `Connection`, `Keep-Alive`, `Proxy-Authorization`,
  `Proxy-Connection`, `TE`, `Trailer`, `Transfer-Encoding` or `Upgrade`, and
  credentials naming `Content-Encoding`, are unusable; HTTP itself or the body
  owns those fields. An invocation that would send two contributions, from
  different declarations or credentials, to one header or one query name cannot
  be sent.
- `[pin]` The effective `consumes` and `produces` are the operation's lists, else
  the entry document's. Where neither declares one, a `body` parameter uses
  `application/json`, `formData` parameters use
  `application/x-www-form-urlencoded`, or `multipart/form-data` when one is a
  file, and responses admit JSON. A declared media range matches when its
  parameters match, `charset` case-insensitively and others exactly (RFC 9110
  §8.3.1). With one usable request media type, it is used; with several, or a
  range, `requestMedia` (§7) chooses. The `Content-Type` field carries the chosen
  type and any multipart boundary.
- `[pin]` `formData` parameters form one field each, or one per item under
  `multi`, encoded as [HTML 4.01](https://www.w3.org/TR/html401/) §17.13.4
  describes with UTF-8 names and values. In `multipart/form-data`, a text field is
  `text/plain` UTF-8 and a file field carries its octets as `propertyMedia` (§7)
  describes; parts use the exact parameter name and no filename.
- `[convention]` A request body's content codings come only from a supplied
  `Content-Encoding` header parameter and are applied in order (RFC 9110 §8.4).

## 6. Responses and completion

`[pin]` Redirects are followed as RFC 9110 §15.4 describes automatic
redirection, including its change of method for 301, 302 and 303. Interim
responses do not complete the invocation. The final status selects the response
declaration, an exact code before `default` (OAS §6.4.11); an invalid declaration
does not fall back to `default`.

### 6.1 Success

A final 2xx response completes the invocation successfully. Its `Content-Type`
must be a media type the effective `produces` admits (§5). `[pin]` A missing
`Content-Type` means `application/octet-stream` (RFC 9110 §8.3). A response with
several `Content-Type` values, or whose representation is neither JSON nor
matched by a usable declaration, completes unsuccessfully, as does a failed
decoding or transform.

Empty content, meaning zero octets after content decoding or none under HTTP's
rules for the method and status, emits no value. Otherwise the response emits one
value once the whole representation is decoded; a truncated response emits none.
Headers never become output values. Whatever the request advertised for
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
| `server` | A complete absolute `http` or `https` base URL without userinfo, query or fragment, replacing scheme, host and `basePath`. | No usable scheme or host can be determined. |
| `requestMedia` | One concrete media type the effective `consumes` admits. | Several are admitted, or a range. |
| `propertyMedia` | One concrete media type for a `formData` file. | Never; without it the file is `application/octet-stream`. |
| `security` | One Security Requirement alternative (OAS §6.4.26). | More than one usable alternative. |

`[pin]` The URL is the scheme, `host` and `basePath` (OAS §6.4.1.1) followed by
the path, after removing one trailing `/` from the base. Of the declared schemes,
`https` is used when present, else `http`; `ws` and `wss` are not this kind's
interaction. A result that is not an absolute URI prevents dispatch.

Credentials are context, one for each scheme in the chosen alternative, and never
become input or output values. `[pin]` They are carried as follows:

- `basic`: [RFC 7617](https://www.rfc-editor.org/rfc/rfc7617) with UTF-8.
- `oauth2`: an access token in the Authorization field
  ([RFC 6750](https://www.rfc-editor.org/rfc/rfc6750) §2.1).
- `apiKey`: the key at its declared name, in its declared header or query
  parameter, serialized as a parameter there would be.

`[pin]` An empty Security Requirement Object is an alternative that needs no
credentials (as [OAS 3.0.4](https://spec.openapis.org/oas/v3.0.4.html) later stated). A defective scheme makes only the
alternatives using it unusable. Security Requirement names resolve in the entry
document's `securityDefinitions`.

## 8. Synthesis

An OBI generated from an OAS document must realize each operation it emits as
this document defines (core §5.3). It may cover a subset of the operations and
choose operation names and contract shapes; a claim to cover them all must be
true.

## 9. Exclusions

An invocation is sent only when its binding, input and context are fully
interpreted. Outside that, the binding has invalid content, needs a resource that
is unavailable (which does not show the binding invalid), needs a choice the
context lacks, or reaches one of these exclusions:

| Excluded | Reason | Reopens when |
| --- | --- | --- |
| Responses switching protocols (101), and the `ws` and `wss` schemes | A new protocol is not an HTTP response. | This kind defines upgrade semantics. |
| One response as a sequence of values | OAS 2.0 defines no way to frame one body as several values. | Use the OpenAPI 3.2 kind, which incorporates OAS 3.2's sequential media. |
| Form and multipart responses as objects | OAS 2.0 defines no response form encoding. | OAS defines one for this edition. |
| XML Object modeling (OAS §6.4.19) | Mapping typed XML to values is a model of its own. | This kind defines that mapping. |
| A `collectionFormat` member containing its own separator | The value's boundaries cannot be recovered. | OAS defines an escape. |
