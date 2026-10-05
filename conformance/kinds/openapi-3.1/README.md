# Independent bounded OAS 3.1 interpretation evidence

**JSONata migration:** transforms now use upstream JSONata 2.1.1; install its
[test dependency](../jsonata/README.md) before reproducing this suite. Earlier
structural-language coverage descriptions below are historical; current
expressions and embedding cases are listed in that evidence note.

**2026-10-05 authority repair:** see the [current repair evidence](../openapi-authority/README.md).
The original authorship narrative below is historical. This maintenance changed
probe algorithms and expectations; it is not another independent implementation.
Candidate bytes remain an executable gate. Core bytes are recorded as run metadata;
the wrapper validates complete OBI fixture shapes against the current core schema.
Neither mechanism proves complete core or kind conformance.

This directory was independently authored from the public candidate, current
core, and incorporated primary authorities. No old binding document,
implementation, corpus, 3.2 probe, author note, or other review was read.

**Current result: 310/310 checks pass against the maintained candidate with actual loopback
HTTP: 31 artifact/reference acquisitions and 168 operation dispatches.** The
in-memory debug run also passes 310/310. Native execution requires permission to
bind ephemeral loopback listeners; the debug mode is not native HTTP evidence.

## Pinned inputs

| Input | SHA-256 |
| --- | --- |
| OAS 3.1 clarified candidate | `d7c3a65d9303696f11fb05ac589f098d17d32385d9bcd7534beeb4ec5a57a9a0` |
| Core 0.2.0 working-draft text | `36754319dc7146787ca7df13dfa2ea8d44d4e6ac4eeb54f4997e1de7fc80f80e` |

The candidate is [the active 3.1 definition](../../../binding-specs/openapi-3.1/openbindings.openapi-3.1.md).
The core is [the current 0.2 draft](../../../openbindings.md).
The first test checks the candidate hash; the run records the current core hash. A semantic revision
requires rereading the public text, reviewing the interpretation and expectations,
repinning, and rerunning. R1 was read at
`33f4a31fc7f50edac3243be86c260e817f66854de1453c911ed9178b5a0e0421`;
the complete r2 public text was subsequently read at
`f7e27a0b7ab3aad3da959eff6cf6f2230fc59676070318882e10307073ff8492`.
The original author read the complete r3 text. A new maintainer read the full
r4/r5 public texts and current core before deriving the follow-up expectations.

## Commands and artifacts

Run from this directory with Python 3.10+ and Ruby with its standard Psych/JSON
libraries. No package installation is required. Development used Python 3.13
and macOS system Ruby.

```sh
python3 test_suite.py --offline
python3 test_suite.py
```

From the repository root, run `node scripts/verify-openapi-31-kind.mjs` to run
the full native suite and validate complete example/generated fixture shapes.
`SPEC_ROOT` may override the specification directory; by default it is resolved
relative to this suite. The candidate hash remains an executable assertion; the core hash is metadata.

`--offline` is an explicit in-memory debugging mode. It creates no sockets and
does not claim source acquisition or dispatch over HTTP. Its result is in
`results-offline.json` and `results-offline.txt`; counts of actual acquisitions
and dispatches are zero. In-memory fixture records are labeled accordingly.

The normal command opens one ephemeral **127.0.0.1-only** HTTP server, acquires
descriptions through HTTP (including a redirect), sends requests through
`http.client`, observes them at the server, and consumes native responses. It
does not need the public internet. Its outputs are `results.json`, `results.txt`,
and `fixtures/executed/`. The current `results.json`/`.txt` record the successful
310-test r5 native run. The actual-HTTP evidence gate is satisfied for the bounded
cases described here. HTTP acquisition and dispatch counts exclude in-memory
tests and direct completion-unit probes.

Each run replaces only its own generated fixture directory. The authored fixture
and the other mode's results are retained.

| File | Purpose |
| --- | --- |
| `interpreter.py` | Fresh bounded interpretation; no repository implementation imports. |
| `yaml_nodes.rb` | YAML syntax tree only; Python applies Core scalar resolution and scalar-key spelling. Psych's YAML 1.1 scalar resolver is never used. |
| `native_oracle.py` | Independently written expected-native predicates, without importing interpreter helpers. |
| `test_suite.py` | 310 named checks, native server, explicit in-memory substitute, fixture/result writer. |
| `fixtures/hand-authored.obi.json` | Complete 0.2.0-shaped OBI with application input, two levels of `each`, `up: 1`/`up: 2`, and output adaptation. |
| `fixtures/synthesized.obi.json` | Complete OBI emitted by narrow schema-free JSON synthesis. |
| `fixtures/executed/*/interface.obi.json` | 188 complete expanded OBIs: 167 native request fixtures and 21 added refusals. |
| `fixtures/executed/*/interaction.json` | Input, context, independently authored expected request/completion, observed native message, source-resource bytes, and candidate hash. |
| `fixtures/in-memory-debug/*` | Corresponding debug fixtures, explicitly labeled in-memory. |

The generated JSON contains current-core operation/source/binding maps and exact
kind strings. This is not an overall core-conformance verdict: no complete core
validator or meta-schema walk is implemented here. The parent task can run its
separate current-core structural check. A binding's author claim is not established
merely by structural validity or by an input/output round trip.

## Evidence scope

The checks exercise these concrete meanings. Tests named for native behavior
exercise an in-memory substitute when `--offline` is used; their names do not
override the result file's explicit transport status.

| Area | Independently expected cases |
| --- | --- |
| Sources | Object, JSON text, YAML text, embedded object plus location, embedded text plus location, HTTP JSON/YAML location, redirect-final base; each at 3.1.0, 3.1.1, and 3.1.2. Embedded content wins without fetching its location. UTF-8/16/32 BOM representations, unsuccessful retrieval, malformed shapes/text, Core scalars and scalar response-code keys. |
| Target and mapping | Literal pointer escaping once, no percent decoding, malformed/missing targets, exact kind comparison, every mapping form, nested `each` with both `up` levels, absent/null, static malformed mappings, missing collection/item and non-array failures, envelope routing, output omission, no status/header channel. |
| Parameters | Effective override, ignored and unavailable projections, location qualification, six path-array style cells, repeated query order, undefined values, deepObject values containing `&`/`=`, rejected nested/structural delimiter cases, mixed reserved/regular query, illegal template variable spelling, numeric/boolean conversion context, content-form query/header, header field grammar and case collisions. Header carriage is tested at all three admitted patch values. |
| Cookies | Percent encoding of schema-form scalar values, `; ` combination, forbidden multivalue form expansions, raw cookie grammar and raw/structured collision, credential cookies without extra encoding. |
| Forms/multipart | Default string/number/boolean/JSON content forms, content null omission and required null failure, whole-array JSON form property, false property, Encoding control precedence, repeated multipart array order, named property order freedom, style parts without URI encoding/generated Content-Type, fixed/optional/required part headers, property media context. |
| R2 bridges | Mounted external Path Item inherits entry-root server/security while relative reference and server override use contributing-document retrieval base; multipart/mixed ignores style controls; false/static-empty/null union branches leave a unique string declaration; fixed matching Content-Transfer-Encoding preserves already encoded text in mixed and form-data. |
| R3 bridges | Actual content-form URI requests with literal and percent-encoded unreserved bytes, with reserved delimiters kept as data; native XML requests/responses using BOM/MIME/declaration/default precedence and optional codecs, exact retained text, no entity expansion, failure on unavailable codecs and unrepresentable characters; optional content-form Encoding headers omitted and required ones unsupported even when a nested media schema has a string const. |
| Schema/media boundaries | Local schema `$id` plus anchor, externally referenced schema root and boolean root, cycles outside needed inspection, constrained union/static dynamicRef refusal, JSON carriage without schema inspection, runtime media choice, normalized duplicate identities with clean sibling, raw Base64 canonicality, required property media selection. |
| Context/security | Multiple servers, defaults/enums/missing variable substitution, relative bases and inert `$self`, exact one-slash append, empty override fall-through, Basic/Bearer, API-key AND membership/OR choice/anonymous case, optional collisions, transport-owned credential rejection, TRACE sensitive-field/body restrictions. |
| Completion | JSON null versus no value, duplicate-last JSON, BOM, required integer endpoints, whole unary event-stream with no item framing, output mapping failure/absence, exact/range precedence without fallback, failure status emits no output, raw response default media, malformed representations, unavailable content coding, double gzip, required headers, no-content responses, and a native truncation scenario. |

Synthesis intentionally selects one schema-free JSON target, chooses its own
operation name, and states `true` value contracts. It does not translate arbitrary
OAS schemas or claim complete coverage. The generated fixture is exercised
against a separately authored expected method/path/media/JSON request, not merely
reimported and compared with itself.

## Permitted alternatives and mutations

The request oracle compares URI percent-triplet case insensitively, query names
as groups while retaining array member order, headers case insensitively, cookie
name order freely, media spellings/quoting semantically, and JSON structurally.
JSON inside media-valued query/form/part carriers is also decoded before
comparison. Content-form numbers admit value-preserving JSON number spellings.
Content-form path expectations additionally permit percent-encoded unreserved
characters; reserved delimiter escapes remain distinct from URI structure.
Two internal encoder choices produce and dispatch both admitted spellings.
Form SPACE spellings are accepted through decoding. Multipart boundaries,
property ordering, quoted names, preambles, and epilogues do not prescribe a wire
transcript; repeated parts of one array retain order. Synthetic variation inputs
exercise the oracle separately from serializer output.
XML request observation compares the retained character string, allowing a UTF-8
signature BOM or either UTF-16 byte order where permitted. It does not normalize
markup, declarations, whitespace, character references, or entity references.

The oracle self-tests reject changed HTTP method/path, lost or reordered query
array items, changed JSON values, changed cookie values, reversed repeated
multipart parts, changed form numeric value, URI delimiter injection or double
encoding, and XML markup/character rewrites. These are explicit observation
mutants, not a claim that a mutation-testing tool rewrote every interpreter path.
Negative invocation cases check that request interpretation failure adds no
observed dispatch. Successful-status decode/mapping failures and non-2xx outcomes
are checked to produce no operation output.

## Explicit limitations

The support claim is bounded to the named fixture combinations. This is not a
full SDK, complete kind implementation, general schema validator, or proof that
every valid artifact is invocable. Some helpers are intentionally conservative
outside the exercised cases; callers must not treat this module as an arbitrary
OAS client.

- No exhaustive OAS or core document-conformance check; no comprehensive validation
  of required documentary fields, every duplicate/override condition, all core
  version-refusal rules, aliases, dependencies, or operation schema evaluation.
- YAML aliases are reported as a capability limit. Full YAML 1.2 Unicode/tag/alias
  and BOM-free UTF-16/32 detection combinations are not certified. JSON-compatible
  scalar resolution is implemented independently over Psych's syntax tree.
- Reference/resource handling covers the concrete pointer, external root, local
  `$id`, anchor, and contributing-base cases above. It is not a complete JSON
  Schema resource graph or dynamic-scope implementation. Productive cycles are
  not evaluated. Full alternate root dialect propagation and every contextual
  use of shared nodes are unimplemented.
- Static schema inspection does not prove arbitrary constraints. It conservatively
  rejects differing combined declarations, does not intersect every finite
  const/enum domain, and does not implement all `allOf` property-merging patterns.
  Pattern matching in fixture projections uses Python regular expressions and
  makes no claim to general ECMA-262 equivalence.
- Media parsing supports the fixture parameter syntax, not every legal quoted
  string. Selection is not a complete usability solver across all unsupported
  schema/media/server/security alternatives. Scalar conversion is caller context.
- Multipart supports named correspondence and the exercised fixed headers. Fixed
  Content-Disposition/filename constraints, all transfer-encoding tokens, every
  subtype restriction, and nested multipart are not implemented. No response
  form-to-object mapping is offered.
- Authentication covers the exercised Basic, Bearer, and API-key cases. OAuth,
  OpenID, mutual TLS, arbitrary HTTP auth schemes, referring-document security
  lookup context, scopes/roles, and exhaustive clean-alternative preservation are
  outside this probe.
- Invocation follows no redirects; therefore credential forwarding across
  redirect origins is not exercised. Acquisition redirects are separately tested.
  No retries, cancellation API, callback/webhook synthesis or receiver, upgrade,
  HTTP/2/3, TLS handshake, real DNS, or streaming item decoder is implemented.
- XML character capabilities are UTF-8, UTF-16/LE/BE, ISO-8859-1, and ASCII;
  the native fixtures exercise UTF-8, UTF-16, and ISO-8859-1. Unknown codecs and
  UTF-32 are refused as capability limits. The bounded producer conservatively
  declines conflicting MIME/declaration indications instead of rewriting text.
  The reader tests authority precedence even for conflicting indications.
  XML prologue recognition is bounded; this is not an XML syntax validator and
  does not expand entities. Non-XML character mapping remains UTF-8-only.
- Gzip is the exercised content coding. Truncation uses HTTP/1.1
  Content-Length. Forbidden actual HEAD payloads cannot be recovered through
  `http.client`'s ordinary HEAD semantics, so the direct completion probe covers
  forbidden-content handling separately.
- Numeric tests preserve arbitrary Python integers and Decimal values at the
  in-memory JSON boundary, but exhaustive resource/precision limits are not
  certified. No timing, performance, concurrency, or interoperability benchmark
  is claimed.

No unresolved candidate ambiguity was established in the bounded cases. The
unimplemented surfaces above remain unproved. The r5 native HTTP gate passed.
Future semantic candidate changes invalidate the pin and
require renewed review.

## Primary authority consulted

- [OpenAPI 3.1.2](https://spec.openapis.org/oas/v3.1.2.html), especially Parameters,
  Encoding, References, Security, and Appendices B–F.
- [YAML 1.2.2](https://yaml.org/spec/1.2.2/).
- [RFC 6570](https://www.rfc-editor.org/rfc/rfc6570),
  [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901.html),
  [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html),
  [RFC 6265](https://www.rfc-editor.org/rfc/rfc6265),
  [RFC 7578](https://www.rfc-editor.org/rfc/rfc7578), and
  [RFC 4648](https://www.rfc-editor.org/rfc/rfc4648.html).
- [RFC 7303 §3](https://www.rfc-editor.org/rfc/rfc7303.html#section-3), XML
  producer/consumer encoding priority and encoding-signature handling.

The pinned OAS dialect resource was named from the candidate; a direct browser
retrieval failed. This probe makes no meta-schema validation claim.

## Integration provenance

This suite was developed independently from the public candidate. The original repository
integration changed only file lookup and packaging: the canonical candidate is
hashed, and the root defaults to a relative path. The later authority repair changed interpreter behavior and native expectations;
its scope is recorded in the current maintenance note. Historical r2/r3 reviews and the full obligation
audit are maintained in the separate development-loop record.

## Public r5 maintenance follow-up

The [maintenance report](maintenance-r5-report.md) records the added 16 fragment
checks, 53 selected-media null checks and three rejected null mutations. Negative
source cases assert zero acquisition and dispatch; positives verify physical
reference/server bases and real HTTP requests. JSON null survives required and
optional content properties and array positions. Non-JSON and style boundaries
remain explicit. Multipart media is checked independently as well as its values.
The full native and offline runs pass at the current pin. This is maintenance of
the original independent suite, not another fresh-origin implementation claim.
