# Independent OpenAPI 3.2 family follow-up

The final native run passes **74 test methods**, with zero failures, errors or
skips. These are focused executable interpretation probes, including real
localhost HTTP acquisition and dispatch. They are not a full OpenAPI SDK,
complete kind-conformance suite, general schema engine, or core-conformance
conclusion.

## Exact inputs and isolation

- Candidate: [canonical candidate](../../../binding-specs/openapi-3.2/openbindings.openapi-3.2.md).
- Candidate SHA-256: `47ebae7d9a13274c639c22932025c2e3b3b609e3c2d47085b4131aaf6dcec4c8`.
- Linked current core: [current core](../../../openbindings.md).
- Core SHA-256: `afaa04552f5330db6baa13deeb0516d8df0698ae57be26301e2f4bdd341dc1b5`.

Both pins are executable assertions. `results.json` repeats the observed pins,
counts, test names and hashes of the executed probe/OBI artifacts. `run.log` is
the final full-run output. The complete public candidate was read before making
these changes; its linked core governs the OBI fixtures.

This directory started as a copy of this implementer's own previously integrated
48-test probe at `conformance/kinds/openapi-3.2`. The extension adds one core-pin
assertion and 15 focused family test methods, several with multiple cases. The
prior pilot evidence remains in repository history. The separate development
record also preserves all 18 artifacts of the prior 64-test family run, including
code, fixtures, results, traces and a manifest of their hashes. That archive pins
candidate `66b297c4d37ec1fc39ef50155f9114b54adb1a3e519234450a4f0a45873b1418`.
The final r6 extension adds ten methods in `family_r6_tests.py`; both complete
public texts were read again before this extension. No sibling candidate, sibling probe, old
conformance corpus, author note or reviewer report was read. The independent implementer did not edit the canonical specification or CI.

Primary authorities consulted for this follow-up were
[OAS 3.2.0](https://spec.openapis.org/oas/v3.2.0.html), especially the multipart
Encoding and transfer-encoding rules, and
[RFC 7303 §3](https://www.rfc-editor.org/rfc/rfc7303#section-3), for XML character
encoding. Bridge choices are taken from the pinned candidate rather than inferred
from the old implementation.

## Reproduction and execution

From this directory:

```sh
python3 tests.py > run.log 2>&1
```

Requires Python 3 and Ruby with standard-library Psych/JSON; no pip/npm packages
are needed. The final run used Python 3.13 and Psych 3.1.0. Ruby provides a YAML
syntax tree only; the probe applies the candidate's Core scalar rules itself.

Three tests bind ephemeral listeners on `127.0.0.1`; the environment must permit
local listeners. The final recorded run has no skipped HTTP tests. No external
API is called by the test runner.

## Concrete evidence for repaired boundaries

| Candidate boundary | Executed evidence and independent expectation |
| --- | --- |
| §2 whole-document location | Nonempty fragments are rejected before resolver use for location-only and embedded object/JSON/YAML forms. Empty fragments are removed before retrieval/base use. `%23` within the URI remains data. The real HTTP acquisition begins from an empty-fragment location and follows a redirect. |
| §3 impossible union branches | False, statically empty category intersections and null-only branches no longer obscure the remaining scalar declaration. Number/integer and agreeing-string cases work; no surviving scalar and unrestricted/conflicting surviving branches refuse. A complete OBI produces native numeric XML bytes `7`. |
| §3 mounted inheritance | Entry-root server/security inheritance is asserted against a foreign root deliberately containing wrong alternatives. Operation, referenced Path Item and local Path Item server declarations use their own physical retrieval bases. An empty override falls through. `$self` resolves a relative parameter reference while the server still uses its retrieval base. Scheme lookup can select entry or referring scope without changing inheritance. |
| §6 URI spellings | Content-form path/query data `A/~?&=Z` stays one path segment and one query value. Literal and encoded unreserved characters, and percent-triplet case, have the same native meaning. Unescaped slash/question/ampersand mutations change meaning and fail the native oracle. Both unreserved spellings are sent through real HTTP. |
| §6 deep object and delimiters | Property name `a&b` and value `x=y&z` preserve exactly one deep-object contribution after decoding; bracket characters in property names refuse. Encoded value brackets stay data. Nested/undefined members refuse. Space/pipe array separators work, and a scalar containing that structural separator refuses. |
| §8 XML encoding | BOM precedence over MIME charset, MIME precedence over a conflicting declaration, declaration-driven ISO-8859-1 and default UTF-8 are asserted directly. The encoding signature is removed once; another U+FEFF remains a character. Request markup, declarations and entity-looking text are preserved without expansion. Missing codecs and unrepresentable characters fail. |
| §8 common scalar correspondence | XML and ordinary text retain the same boolean/number rules. JSON whitespace and integer-declaration numeric decoding are exercised. XML BOM metadata is removed before scalar conversion; ordinary text's U+FEFF does not become numeric whitespace. Null, second tokens, non-JSON whitespace and NaN refuse. |
| §8.1 fixed Encoding headers | Schema-form string `const`/single-string `enum`, finite `$ref`/`allOf` domain intersection and case-equivalent agreement supply fixed fields. Defaults do not. Content-form Header schemas never become fixed raw header values; required nonfixed headers refuse. Ignored Content-Type declarations stay ignored. |
| §8.1 content transfer encoding | A `contentEncoding` annotation alone emits no CTE field. An explicit coherent Base64 header is emitted with the supplied `SGk=` text unchanged; neither Base64 decoding nor a second Base64 encoding occurs. Contradictory declarations, a required extra transform, wrong disposition names and forbidden form-data headers refuse. Alternate multipart boundaries yield identical independently parsed native parts. |

Final r6 coverage adds these independently stated cases:

| Candidate boundary | Executed evidence and independent expectation |
| --- | --- |
| §8.1 JSON named null | Required and optional named null both produce a part with JSON media and exactly `6e756c6c` (four bytes). Missing parts, empty bytes and the string `"null"` are wrong-meaning negatives. Media spelling, boundary choice and order between distinct named properties may vary. |
| §8.1 array and positional null | Named `[1, null, 2]` yields three parts with payloads `1`, `null`, `2` in that order. A whole nullable-array property set to null yields one `null` part. Positional `[null, 7, null]` preserves all three positions, including a `+json` part. Coalescing, dropping and reordering items fail the native oracle. |
| §8.1 non-JSON null and choice | Optional named null omits under text/raw media; required null and actual array/positional null items refuse. A present null under multiple media or a range needs a concrete context choice; absence needs none. JSON choice emits null; text choice omits it. A null whole form body refuses. The existing style route still produces `q=` for null and no query for absence. |
| §2 typed standalone roots | Complete OBI fixtures reference external Path Item, Parameter, Response and Header roots. Path Item and Response redirects change physical bases; nested references and the relative server use the final physical locations. The unused 500 Response reference is never acquired. Missing required response Header produces unsuccessful completion. |
| §2 multiple expected types | The same external node is used first as a Parameter and then as a Response: native query `q=7` and decoded numeric output `7` are independently asserted. Reverse explicit reads also retain each interpretation. Arbitrary untyped embedding is not granted extra reference semantics. |

`family_r6_tests.py` reads literal native observations from
`family-r6-native-expectations.json`. Those observations were written separately
from the composer, then compared with the independent standard-library MIME
parser. JSON null, named item order and positional order are compared before
any bridge response decoding.

`family_tests.py` states expected native values independently of the bridge
encoder/decoder. Its URI oracle uses URI segmentation and percent-decoding rather
than the serializer. Its multipart oracle uses Python's independent MIME parser
and inspects the raw part payload, not the bridge decoder. Wrong native meaning
is tested alongside permitted spelling variation. These checks go beyond
round-trip self-consistency.

## Actual interactions and complete OBIs

`hand-authored.obi.json` and `synthesized.obi.json` retain the complete pilot
fixtures. Their tests resolve the binding's `operation` and `source` relationship
from those documents before interpreting source/binding content. The finite
synthesis test still checks six independently enumerated native values and
rejects a mapping mutation that drops the native object. Output contracts remain
unspecified where native output schema validation is not performed.

`family.obi.json` is a new complete OBI for XML, numeric XML, deep-object queries,
content-form URI parameters and multipart requests. The live test constructs a
complete location-source OBI around that fixture and adds two mounted targets;
it performs actual HTTP acquisition and seven requests. The independently
expected service-side observations are:

- XML is sent as the declaration-selected ISO-8859-1 bytes, retaining `&amp;` and
  the encoding declaration. A UTF-16 response with a conflicting UTF-8 MIME
  charset decodes to the exact supplied reply markup and snowman character.
- The deep-object request has one decoded pair, `filter[a&b] = x=y&z`.
- Two native URI spellings both carry path/query value `A/~?&=Z`, with the path
  value confined to one segment.
- The multipart part is named `payload`, has no invented filename, uses
  `text/plain`, declares Base64 CTE, and carries raw text `SGk=`.
- Mounted targets dispatch to `/service/mounted` and
  `/refs/physical/mounted-physical`, respectively. Every request carries the
  entry-selected `X-Entry-Key` credential; the foreign root's security is not
  inherited.

`family-http-trace.json` records the actual captured request targets, headers
and exact body hex, plus acquisition paths. It is produced by the live test.
`family-mounted.obi.json` and `family-mounted-foreign.oas.json` save the baseline
mounted fixture returned by the independent fixture constructor; variant tests
make local copies to exercise override/base combinations.

The r6 fixtures `family-r6-null.obi.json` and
`family-r6-references.obi.json` include current-core operations, sources and
bindings. Their operations deliberately leave input/output contracts unspecified
where this bounded runtime does not validate the whole native schema. Five
`family-r6-*.oas.json` files supply the standalone Path Item, Parameter, Response,
Header and shared-context roots. The live test saves the complete actually used
location-source OBIs as `family-r6-live-null.obi.json` and
`family-r6-live-references.obi.json`; their ephemeral port is evidence from the
last run, and the reproducible test regenerates it.

The new live test acquires both OAS descriptions, follows two reference-resource
redirects, fetches nested standalone roots, and dispatches seven requests. Five
multipart requests cover the required/optional JSON-null pair, named array plus
whole-property null, positional null, optional text-null omission, and explicit
JSON media selection for null. Two GETs check the mounted physical path and the
node interpreted in both Parameter and Response contexts. Expected request paths
and exact response values are hard-coded independently of reference resolution.
`family-r6-http-trace.json` records all ten acquisition paths and seven request
observations, including exact body hex. All three HTTP tests execute in the
reported 74-method run.

The retained live pilot test separately exercises an HTTP artifact redirect,
a mapped POST and two streamed NDJSON outputs. Retained tests also cover
querystring present-empty vs absent, ordinary scalar/media rules, mappings and
nested `each`/`up`, exact status selection, unary failure, retained values after
late sequential failures, and the optional validated-data route.

## Bounded added components

`xml_probe.py` supplies encoding selection and character carriage, not an XML
parser. Its declared extra codecs are UTF-16/LE/BE, ISO-8859-1 and ASCII in
addition to UTF-8. UTF-32 signatures are detected but that codec is deliberately
unsupported. XML well-formedness, entities, DTDs, XInclude and markup rewriting
are not implemented. General encoding autodetection, including EBCDIC and
arbitrary declaration layouts, is not claimed. The tests avoid requiring a
policy for contradictory request-side charset/declaration production; receipt
precedence is explicitly tested.

`multipart_probe.py` provides a small fixed-header inspector and flat multipart
composition: named scalar/array properties for form-data, and positional
prefix/item encoding for mixed multipart. Explicit media declarations are
required; concrete context choices handle the tested multiple/range cases.
No default-media inference is claimed. Schema-reference inspection is limited
to the displayed finite raw-string header domains; it is not a general schema
evaluator. The composer uses safe test boundaries and simple quoted names.
It does not claim complete Encoding Objects, nested multipart, MIME quoting,
filename or recursive-schema behavior. Style-based multipart is unsupported;
style-null preservation is separately checked through the ordinary query route.
Fixed-header tests for other Content-* fields are decision probes; the real
multipart exchanges use only permitted fields.

The main request interpreter now tracks field provenance through the tested
single-hop Path Item mounts and accepts the existing focused header-apiKey
component when credentials are supplied. The r6 extension additionally retains physical context for the tested standalone
roots and resolves only the selected Response and its required Header. It does
not validate arbitrary OAS roots or register a persistent global object type.
Standalone roots reached with empty fragments in the explicit expected-type
subset are supported; arbitrary fragments into standalone non-OAS roots are
outside this probe. This does not establish arbitrary reference chains, complete
OAS resource identity, multiple security alternatives,
Basic/Bearer/OAuth/TLS protocols, cookie variants or real credential-forwarding
redirect execution. The retained security tests establish bounded ownership and
redirect decisions only.

`validated_data_probe.py` retains the optional validated-data route for one
finite string-or-number domain. Its independent test predicate evaluates the
whole fixture schema, accepts `7`/`seven`, rejects booleans and invalid strings,
and never accepts a claimed type alone. General JSON Schema validation remains
unimplemented.

## Remaining limits and conclusions

- No full OAS or current-core document validator, unrestricted synthesis,
  contract-equivalence checker, callback/webhook dependency generator or
  complete-coverage report is provided. Examples establish only their own
  correspondences and native traces.
- YAML aliases/cycles, full YAML conformance, `$id`/anchor resource indexing,
  arbitrary cyclic references, cross-context cases beyond the shared fixture,
  and general schema-reference/type
  member inspection remain outside the claim. The type inspector remains
  narrower than general JSON Schema.
- Parameter styles beyond the displayed scalar, query, deep-object and
  nonexploded delimiter cases, full reserved expansion, full cookie grammar,
  compound Header serialization and URL-encoded querystring media are not
  established. URI grammar validation is bounded to the shown cases.
- Full MIME/media-parameter grammar, alternate usability analysis, positional
  multipart beyond the flat displayed cases, recursive Encoding and arbitrary
  part headers remain unprobed.
- NDJSON responses and injected late transport failures are retained. Sequence
  requests, SSE, JSON text sequences, streaming codec errors, actual socket
  truncation/cancellation and resource-limit behavior remain unprobed. An
  injected chunk-iterator failure is not proof of connection lifecycle behavior.
- JSON integer range and exact response-decimal examples remain covered. General
  arbitrary-precision request serialization and all non-XML charsets/codecs are
  not claimed.

No unresolved candidate ambiguity blocked the addressed family cases. This is a
bounded interpretation result under the two exact pins, not a finding that every
remaining rule or every third-party implementation is conformant.

## Repository integration

Run `node scripts/verify-openapi-32-kind.mjs` from the spec root. It runs all 74
methods, then validates every saved complete OBI in this directory against the
current core schema, including the regenerated location-source fixtures. The
wrapper sets `SPEC_ROOT`; direct execution defaults to this repository root.
Canonical spec/core hashes are mandatory. Integration changes lookup/packaging
only; the interpreter, native expectations and fixtures retain their independently
authored meanings. HTTP traces, live fixture addresses and result files are
reproducible ignored outputs. Prior revisions remain in repository history and
the separate development-loop archive.
