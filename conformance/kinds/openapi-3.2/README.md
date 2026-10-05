# OpenAPI 3.2 current-kind interpretation probes

The active candidate is [openbindings.openapi-3.2.md](../../../binding-specs/openapi-3.2/openbindings.openapi-3.2.md).
This suite was imported from the independent scope-reduction pilot. Integration
updated the document path and expected hash; the interpreted rules are unchanged.
The active document SHA-256 is
`1086c117655d3ec19ee022184e89435288f158f7c4a44428e345c31992567ec2`.
The historical pilot hashes below identify reviewed snapshots, not the active
file's new status/authority wording. No released kind or SDK conformance is claimed.

From the repository root run `node scripts/verify-openapi-32-kind.mjs`.
It first validates both complete OBI examples against the current core schema,
then executes this suite. CI installs Python 3.13 and Ruby 3.3; the probe uses
Ruby's standard-library YAML syntax tree with its own scalar resolution.

These are a fresh, bounded executable interpretation of the scope-reduction
candidate. The final recorded run passes **48 test methods** (with multiple
explicit examples in several methods), zero failures, zero errors, and no skips.
This is not a complete OpenAPI implementation, conformance corpus, schema
validator, security SDK, or proof that any pre-existing SDK conforms.

## Exact input and provenance

- Reviewed pilot: revision r3; its interpretation is carried by the active document linked above.
- Reviewed pilot SHA-256: `7ed075b2fc0d20bd017e496b89a030c86aa5e9fd8eb388e063c0105eb27b20b2`.
- Intermediate r2 SHA-256: `61e746d9b176e7eacbc56798527858661342ee0f4f7c77383ad0b792cf0e66bc`.
- Initial candidate r1 SHA-256: `b9e31f24a5acfb691d4e900014adabeef1cf8a49acf9ad912e30092695e507a9`.
- Governing core: [`openbindings.md`](../../../openbindings.md), source baseline commit `337c3e298e50a25e7ddab9a172a40ac0820b3c9a`; especially §§5.1–5.3 and its distinction between author claims and document conformance.
- The implementer initially inspected the main-checkout core before discovering it was older. It does **not** supply the final interpretation. The candidate-linked core was then read directly; in particular the final failure-output interpretation follows r2 and that linked core.
- No old kind specification, existing kind implementation, existing corpus, author notes, or other reviewers' reports were read. The parent sent the revised candidate and described its changed decisions; the implementer read and interpreted that candidate directly.
- Incorporated authorities consulted directly: [OAS 3.2.0](https://spec.openapis.org/oas/v3.2.0.html), particularly §§4.9, 4.12 and Appendix F, and [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901). Candidate rules supply the bridge-specific expected results. Upstream prose is not copied into these tests.

## Reproduction

From this directory:

```sh
python3 tests.py > run.log 2>&1
```

Requires Python 3 and Ruby with standard-library Psych/JSON. There are no pip or
npm dependencies. Ruby/Psych supplies a YAML syntax tree only; the probe applies
Core scalar resolution and duplicate-key checks itself, avoiding Psych's YAML
1.1 value conversion. The final run used Python 3.13 and Psych 3.1.0 on macOS.

The HTTP test binds an ephemeral port on `127.0.0.1`; it never contacts an external
service. The workspace sandbox initially denied that bind. The same command was
run with approved sandbox escalation and passed. A bind denial is an environment
failure, not a specification failure. The ordinary command on a host that permits
loopback listeners needs no special application privileges.

`results.json` (generated and gitignored) records the actually read candidate hash, target hash, counts, and
test names. `run.log` is generated when using the redirected command above. Prior pilot logs
are not carried as fresh execution results in this directory.

## What the executable evidence establishes

| Area | Concrete evidence |
| --- | --- |
| Source modes | Embedded object, embedded JSON text, embedded YAML text, location-only, embedded object/text plus location. Embedded data is not replaced by retrieval. Registered URI acquisition and real HTTP acquisition both execute. Wrong types, duplicate keys, non-scalar keys, non-JSON numbers/tags, multiple documents, wrong entry version, policy failure and a real 404 are distinguished in the tested cases. |
| Encoding and bases | UTF-8/BOM, UTF-16/32 BOM and initial-pattern detection; `$self` reference base differs from server retrieval base; final redirected acquisition URI; relative server without a base fails. |
| Targets/references | Fixed and extension method targets, exact method case, literal target percent characters, one-pass `~` escapes, same-document/external Path Item references, noncolliding fields, r2 disjoint additional-method merge, selected collisions, unavailable refs, overridden server fields, boolean schema roots. |
| Mappings | All five r3 forms; absence vs null, omission vs array failure, original-input scope, `each` item/nested scope, r3 parent/grandparent selection, static out-of-scope rejection, absent/empty/non-array collections, late output mapping failure, unary collection shaping, and request-envelope adaptation from an application-shaped input. |
| Request assembly | Path scalar escaping, query form arrays and repeat order, global parameter-key qualification, operation parameter overrides, ignored parameters, unavailable projection removal, r3 optional case-distinct headers with one contribution, whole-query present-empty vs absent, content query percent encoding, content header bytes, scalar-conversion prerequisite, body-required checks, TRACE, QUERY, GET/DELETE bodies, exact server slash append, explicit replacement and variable enum/default decisions. |
| Media and values | Concrete choice prerequisite, body-free request, media specificity/parameter matching, duplicate identities and equal specificity, JSON duplicate-last/BOM/surrogate rules, exact arbitrary-size integer and decimal response values, mandatory integer range, opaque XML string, scalar integer declaration without implicit validation, canonical raw Base64, preserved schema annotations, limited type-intersection/consensus inspection, runtime Accept policy. |
| Headers/coding | Sample forbidden/invalid fields, gzip requests and ordered double-gzip response decoding, required response headers, ignored response Content-Type declaration, no-content without codec requirement. |
| Completion | Exact/range/default selection without invalid-exact fallback, empty vs null, HEAD/101 behavior, mismatched/duplicate response Content-Type, unary no-partial-value rule, NDJSON chunk boundaries/CRLF/EOF, malformed and whitespace-only lines, late parse/mapping/transport failures retaining prior values, and no operation outputs from non-2xx responses. |
| Focused ownership/redirect decisions | Direct entry header API-key credentials targeting Accept/Accept-Encoding may be the sole contribution; competing runtime negotiation contributions refuse. Scalar ordinary structured Cookie and raw Cookie, selected header API keys and Authorization are withheld cross-origin. Same-origin forwarding is permitted, including host case/default-port equivalence. These are executed decisions with independently specified expected field maps, not live redirect-network evidence. |
| Optional validated-data route | A separate explicit predicate checks every keyword of one finite string-or-number schema domain. Validated 7 selects numeric text bytes; unvalidated apparent 7 stays unresolved; a false claimed type, an invalid string, and boolean are rejected. This establishes one fixture, not general schema evaluation. |
| Actual interaction | The HTTP server provides a redirect to an OAS artifact, observes the interpreted POST path/media/body, and returns two NDJSON items. The test asserts the independently expected server capture and the two mapped caller values. This is a real local HTTP exchange, not a parser-only or mocked-dispatch assertion. |

## Independent expectations and bounded synthesis

`hand-authored.obi.json` saves a complete current-core OBI containing the
operation input contract, source, and binding from `hand_authored()`. Its output
contract is unspecified because native responses are not schema-validated.
`synthesized.obi.json` saves the complete generated OBI. The request and
synthesis tests load these files and resolve each binding’s same-document
`operation` and `source` relationship before interpreting its content. They
check the hand-authored correspondence and the generated fixture against the
independent expected native values; no overall core conformance claim is made.

`hand_authored()` defines an application input with `key`, `name`, `labels`,
`enabled`, and `note`. Its binding maps these into a path id, query contributions,
and JSON body. `native_request_oracle()` independently states the service-side
expectation: POST `/base/things/a%2Fb`, `tag` values `x y` then `z`, `flag=true`, and
body `{"title":"alpha","done":false,"note":null}`. It does not call the bridge's
media decoder or mapping function to derive the expected result.

Equivalent JSON whitespace/member order, media type case, percent-triplet case,
and interleaved distinct query contributions pass that oracle. Changed method,
decoded path slash, removed null member, changed boolean, and reversed repeated
array values fail it. These tests distinguish semantic agreement from incidental
wire equality and from round-trip self-consistency.

The small generator emits an application-shaped input contract and an input
mapping that wraps it into the request body. Six native inputs are enumerated
independently: two `mode` strings crossed with null, a Unicode string, and a
small object payload. Every generated binding produces the separately expected
POST, target, and complete native JSON object. A mutation that drops the wrapper
object fails that comparison for all six. Unsupported synthesis keywords are
refused in the tested example. The generator leaves `output` unspecified because
it does not validate received data against the source's output schema; it does
not claim that copying a native output schema is automatically faithful.

A separate counterexample confirms that an aggregate array schema cannot simply
be copied as the output contract of a sequential binding emitting integer items.
These finite checks support the displayed mappings and examples; they do not
prove arbitrary schema translation, the service's behavior, or general schema
equivalence.

## Ambiguity witness and revision handling

R1 left disjoint local/referenced `additionalOperations` maps unclear: a reader
could merge their method entries or treat the containing fixed field as a
collision. This concrete witness was sent to the author before implementation
privately selected a meaning. R2 explicitly merges by exact method key and
confines collision to the selected method; the r2 tests exercise both independent
methods and a colliding method. R2 also made the repeated-slash append rule
explicit; the expected result preserves the base and path's other slashes.

The final tests were changed for the new `each` form, schema category/consensus
rules, boolean schema roots, unavailable parameter projections, URI-only content
parameter escaping, Accept policy, ignored response Content-Type declaration,
and failure-data boundary. R3 added explicit parent selection through `at.up`. New probes construct a
batch body from both item and parent fields, exercise nested parent/grandparent
scopes, reject malformed and statically out-of-scope selections even in an empty
collection, and detect the wrong meaning produced by silently using item scope.
Case-distinct optional Header keys now exercise one usable contribution and
refusal of two supplied contributions. The final hash has its own executable
assertion, so a later edit cannot silently inherit this pass result.

No unresolved candidate ambiguity blocked the final
tested subset. That statement is confined to this subset and is not a claim
that every bridge decision has been independently reconstructed.

## Limitations and unprobed decisions

The functions are deliberately small and intended for these executable probes;
they must not be advertised as a general conforming kind implementation. Some
out-of-subset features raise `Unsupported`; others would require additional
validation before exposing this as a public interpreter.

- YAML aliases/cycles, complete YAML 1.2 syntax conformance and tag coverage,
  resource-identity indexing, `$id`/anchor graphs, schema-reference inspection,
  cross-context reference nodes, and required cycles are not established. The
  Ruby parser's supported syntax is a dependency capability. No full OAS or core
  document validation is claimed.
- The schema helper tests a narrow type domain. It does not implement general
  JSON Schema, inspected member agreement, full `$ref`/`$id` resolution,
  conditional semantics, or a general independently validated-data capability.
  `validated_data_probe.py` exercises the optional route for one finite schema
  domain using an independent predicate in the test; all other schemas remain
  outside that validation claim.
  The boolean-root tests establish retrieval/representation only, not all
  downstream schema-reference behavior.
- Referenced Path Items with mixed-origin relative servers or parameters, all
  overridden-parameter collision combinations, and arbitrary full-description
  resource identity cases are unprobed.
- Full URI validity, arbitrary URI-scheme resolvers, HTTPS/TLS, proxies,
  authentication protocols, multiple security alternatives, general credential
  collisions, full cookie grammar/serialization and redirect method rewriting,
  interim HTTP responses, and cancellation/connection reuse are unprobed.
- Matrix/label/deep-object/space/pipe serialization, reserved expansion edge
  cases, compound/header parameter shapes, ordinary content-form path/cookie
  parameters, and form-urlencoded querystring behavior are unprobed.
- Name/position multipart, nested Encoding, per-part headers/dispositions,
  property media selection, form omission/collisions, arbitrary MIME quoted
  parameter syntax, clean-media fallback selection, and complete media
  usability analysis are unprobed. The media parser handles only its displayed
  token/quoted-string subset.
- JSONL/NDJSON **responses** are covered. Sequence **requests**, JSON text
  sequences, SSE, positional multipart sequences, codec-streaming late errors,
  resource exhaustion, and real socket truncation/cancellation are unprobed.
  Late transport failure is injected into the chunk iterator; it proves the
  interpreter's emitted-value trace, not socket lifecycle behavior.
- UTF-8 scalar media is covered; other charsets and content codings besides
  gzip are unsupported by the probe. General exact-number request serialization
  is not implemented; the mandatory integer range is covered and response
  decimals use `Decimal`. No float precision portability claim is made.
- Core dependency generation, callbacks/webhooks, operation naming policy,
  general synthesis, contract validation and a complete-coverage claim are
  deliberately absent. A pre-existing implementation was not tested.

## Added exit-gate subsets

`security_probe.py` is an independent contribution-decision component, separate
from the main request interpreter. It reads one direct Security Requirement
alternative and its direct entry-document header apiKey schemes, then combines
those with scalar string Header parameters, scalar string Cookie parameters
using `style: cookie`, and optional runtime negotiation headers. The tests read
those declarations to produce contributions before checking redirects; they do
not merely tag preconstructed Cookie bytes as safe or unsafe.

For redirects it accepts a resolved target URL and assumes the redirect preserves
the request method/body. The implementation selects one permitted policy:
forward protected fields to the same origin and remove them across scheme, host,
or effective-port changes. Target URL bytes remain unchanged; the probe never
appends old query parameters. This does not establish redirect acquisition,
connection handling, broader credential scope, query-credential carriage, or
a full authentication implementation. The main request interpreter still refuses
security outside its original subset.

`validated_data_probe.py` accepts a validation callback and evaluates it before
using the resulting data category. The independent fixture predicate implements
exactly `{"type":["string","number"],"enum":[7,"seven"]}`. It checks the
complete domain for that fixture, rejects boolean-as-number confusion, and
provides no success for a claimed type alone. This proves the displayed
validated-data branch while keeping general schema validation unimplemented.
