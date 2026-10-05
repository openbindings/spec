# Independent OAS 3.0 interpretation evidence

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

This is a bounded, independently written executable interpretation of the frozen
candidate. It is **not** a production SDK, a complete OAS implementation, a core
conformance validator, or a claim of full support for this kind. Inputs and native
expectations were written without reading historical binding drafts, sibling
3.1/3.2 binding specifications or probes, old conformance corpora, SDKs, author
notes, or reviews. No subagents, installs, publication, or candidate edits were
used. The only 3.1 text consulted was the exact upstream header correction that
the 3.0 candidate incorporates.

## Frozen authority

- Kind: `openbindings.openapi-3.0@1`.
- Candidate/canonical SHA-256:
  `1f4b76b52706996f5061ec8f81a01fc3852d7599b0a34d8d07440daae0cd986b`.
- Core SHA-256:
  `36754319dc7146787ca7df13dfa2ea8d44d4e6ac4eeb54f4997e1de7fc80f80e`.
- Candidate's incorporated OAS 3.0.4 interpretation governs admitted `3.0.0`
  through `3.0.4`; patch admission is explicitly tested for every patch.
- PB-02 was read as publication policy, not a core conformance class.

`run.py` verifies the candidate hash before constructing its listener and records the core hash. It honors
`SPEC_ROOT`; by default it uses this repository root. It always hashes the
[canonical candidate](../../../binding-specs/openapi-3.0/openbindings.openapi-3.0.md)
and [current core](../../../openbindings.md), never an untracked draft.

Official authorities consulted: [OAS 3.0.4](https://spec.openapis.org/oas/v3.0.4.html),
its parameter table and Encoding defaults/precedence in particular;
[OAS 3.1.2 Appendix D](https://spec.openapis.org/oas/v3.1.2.html#appendix-d-serializing-headers-and-cookies)
only for the incorporated header correction;
[YAML 1.2.2](https://yaml.org/spec/1.2.2/),
[RFC 7303 §3](https://www.rfc-editor.org/rfc/rfc7303#section-3),
[RFC 4648 §4](https://www.rfc-editor.org/rfc/rfc4648#section-4), and
[RFC 6265](https://www.rfc-editor.org/rfc/rfc6265).
The candidate's explicit HTTP and other incorporated rules govern the focused
HTTP tests; this is not an independent test of every provision of those RFCs.

## Reproduction

From this directory, with Python 3 and Ruby's standard-library Psych available:

```sh
python3 run.py
python3 run.py --native
```

For another checkout, set `SPEC_ROOT` to its spec root. `--only SUBSTRING` is a
focused debugging aid; a filtered run is not the full result. The recorded full
run used Python 3.13.7 and Ruby 2.6.10. No third-party Python packages are needed.

Native HTTP binds only `127.0.0.1` at an ephemeral port. A restricted development
host may require approval for the listener; ordinary CI requires no external service.
Both acquisition and dispatch reject non-loopback destinations; `localhost` on
the same ephemeral port is used to test a distinct origin. No outside service
receives a request. The offline command creates no listener and makes no network
calls; its report explicitly records zero HTTP acquisitions and dispatches.

## Recorded full results

Both full commands passed **319 / 319 checks** on the frozen authority hashes.
The native run completed 186 fixture interactions, **188 actual HTTP request
dispatches** (including two redirect followups), and **22 actual HTTP artifact
acquisitions**. It established 116 pre-dispatch refusals and 17 direct/parser/
variation/mutation checks. An additional 372 completion-oracle mutations were
rejected. The offline result has the same scenario outcomes and explicitly zero
HTTP activity. Counts and each observed interaction are saved in the result JSON.

## Reviewable files

- `cases.py`: independent artifacts, caller values, context, literal native
  expectations, response bytes, completion expectations, and authority labels.
  It imports no interpreter or media encoder/decoder.
- `fixtures.json`: fully expanded fixtures, including a **complete OBI in every
  `fixtures[i].obi`**. Bytes are saved as `{"$bytes_base64":"…"}`; `__PORT__`
  is the only listener placeholder. Native expectations are under
  `expected_request`; redirect expectations under `expected_followup`;
  independently authored response bytes under `response`/`responses_sequence`;
  completion expectations under `expected_completion`; artifact resource bytes
  under `resources`. The top level is an array, not an OBI fragment collection.
- `hand-authored.obi.json`: standalone complete OBI with nested JSONata lexical scopes
  input correspondence and output adaptation.
- `generated.obi.json`: complete generated OBI for the bounded rename/shape
  translation, with native names and independent caller-facing contracts.
- `generated-callbacks.obi.json`: complete generated OBI preserving two callback
  consumption points as dependencies, without inventing receivers or kind limits.
- `interpreter.py`: bounded kind interpretation, including preparation and
  response completion. It has no access to fixture expectations.
- `yaml_ast.rb`: Psych supplies only a syntax tree. Scalar resolution, duplicate
  detection, JSON-compatible values, and key spelling are handled explicitly;
  Psych's YAML 1.1 value resolver is never used.
- `run.py`: loopback server/client, source acquisition, native observations,
  independent comparisons, hash gate, and result recording.
- `results-native.json` / `results-offline.json`: per-case results, actual native
  requests, redirect followups, completion values, artifact acquisition paths,
  counts, modes, and exact authority/evidence hashes.
- `evidence-hashes.json`: hashes of executable sources and expanded fixtures.

## Coverage

The full suite has 302 OBI-based fixture cases and 17 focused checks: three YAML
value checks, four direct completion-boundary checks, four permitted-variation
checks, and six native-oracle semantic mutations. Expected native interactions
are not obtained by synthesizing then decoding the interpreter's own output.
The oracle compares literal facts and semantic properties, not a canonical wire
transcript. It separately parses MIME/form syntax and checks literal expected
values. Every invoked case also rejects changed success and changed output-value
expectations (372 completion-oracle mutations); those are counted separately,
not presented as another 372 independent interactions.

| Bridge decision | Representative evidence |
| --- | --- |
| Every admitted entry patch and source form | `patch-*`; embedded object, JSON/YAML text, location-only HTTP JSON/YAML/UTF-16, co-present object/text plus location, successful acquisition redirect/final base |
| Source refusals and representation rules | absent/null/empty/wrong members; duplicate/nonscalar keys, tags, non-JSON values, multiple docs, later patches, unsuccessful/policy-denied HTTP; exact Core scalar values and key spellings |
| Literal target and references | percent/tilde path, malformed pointers, missing target, Reference adjacency ignored, mounted external Path Item, entry inheritance, declaration-relative server, used/overridden collisions, missing reference, unused cycle |
| Adaptation and absence | JSONata expressions; nested JSONata lexical scopes; empty/missing collections; object omission; null literals; empty pointer on absent input; invalid expression syntax and legacy objects; input/output failures |
| Request and context | envelope shape, name qualification, required/optional parameters/bodies, complete server replacement with repeated slash preservation, selection, variables/defaults/enums, unrepaired invalid URLs |
| Parameters and cookies | operation override, matrix/label/simple, form/deepObject/space/pipe query, undefined/empty/absent values, scalar conversion, reserved and ordinary query coexistence, JSON content parameters, corrected UTF-8 headers, collisions/ownership, raw and structured cookies |
| Methods | POST/PUT/PATCH bodies; GET/HEAD/DELETE/OPTIONS ignored body declarations plus refused supplied bodies; TRACE body and sensitive credential boundaries |
| Media and OAS 3.0 schemas | concrete/range choices, charset/parameter matching, specificity/ambiguity/duplicate identities and clean siblings; allOf integer/number, oneOf empty/null-only branches, equivalent anyOf declarations, unsupported type arrays/boolean schemas; nullable does not infer type |
| JSON/text/raw/XML | null/empty distinction, duplicate JSON member last-wins, BOM, safe large integer, numeric capability refusal, unpaired surrogate refusal, binary canonical Base64/pad bits, byte text without another decode, ignored later contentEncoding, XML BOM/declaration and whole unexpanded text |
| Forms/multipart | content/style precedence, ignored multipart style, content-based scalar text, null omission/required null, additionalProperties and ignored patternProperties, item defaults versus whole form arrays, repeated binary parts, byte transfer behavior, safe boundary replacement, fixed enum headers and conflicting/nonfixed domains |
| Security | Basic/Bearer/OAuth/OpenID, exact query key escaping, OR/AND/anonymous choices, missing credentials, invalid sibling isolation, literal URI-looking component key, external entry/referring scope, optional and required contribution collisions, owned fields, negotiation ownership |
| Redirects | real same-origin preserving and cross-origin stripping of Authorization/header API key/all Cookie; method and body preserved; query credential not copied into Location |
| Completion | exact/range/default status selection, no invalid exact fallback, required Responses Object, required/ignored headers, repeated Content-Encoding enum normalization/gzip stack, unknown coding with no content, HEAD/204 boundaries, cancellation, 101, non-2xx/no-output, truncated unary/no partial output, text/event-stream as one value |
| Synthesis/current core | complete hand-authored and generated OBIs; rename/shape translation with independently written native expectations; callback dependencies; no callback parent target |
| Permitted differences / negatives | percent-triplet case and unreserved encoding, JSON whitespace, query-name order, form SPACE spellings, equivalent XML encodings, arbitrary safe MIME boundaries; changed method/target/value/order/header destination/body fail the oracle |

## Limits and interpretation outcomes

No unresolved candidate ambiguity was required to author these representative
cases. That finding is bounded by the cases above, not a claim that every possible
artifact is unambiguous. A few implementation defects were found and repaired:
fixture objects initially shared a mutable server declaration; explicit quoted
YAML tags needed tag-directed scalar resolution; multipart case-equivalent enum
domains needed intersection even for a nonfixed optional declaration; fully
operation-overridden Path Item parameters needed to be treated as unused. XML
fixture closing-tag typos were corrected as fixture mistakes. No candidate text
was changed to make the suite pass.

Deliberate limits:

- The interpreter supports the exercised subset. It does not claim general OAS
  document validation, schema validation, arbitrary schema satisfiability, or
  exhaustive server/media/security alternative usability analysis. An untested
  shape is not qualified by this result. Core checks establish only the simple
  emitted structural subset and links, not every OBI-D rule or author claim.
- URI resolvers are limited to the local HTTP fixture policy. Other schemes,
  remote networking, TLS, authentication of artifact retrieval, and arbitrary
  redirects are not exercised. API redirect policy follows only preserving
  307/308 responses; method-rewriting redirects are not followed. The fixture
  listener models two origins, not two actual remote services.
- YAML support is bounded to JSON-compatible, acyclic constructions and tested
  Core scalar spellings. Cyclic/forward aliases and the full YAML grammar are
  not qualified. OAS reference cycles are not treated as invalid merely for
  cycling; nonproductive resolution cycles exceed this interpreter's capability.
- General OAS composition and merging are not qualified. Inspected categories,
  selected allOf property merges, and agreeing union declarations cover the
  fixtures. Recursive validation, discriminator behavior, and other schema
  evaluation are outside the probe.
- JSON integers use Python's exact integer representation; required safe-range
  values are exercised. Decimal receipt is deliberately limited to binary-exact
  finite values. A precision-requiring decimal is refused, never rounded into
  another operation value. There is no broad decimal capability claim.
- Parameter/header grammar, percent encoding, MIME parsing, and media parsing
  cover the tested forms; they are not exhaustive RFC conformance suites. The
  interpreter does not claim every legal quoted media parameter, charset,
  content-valued parameter byte sequence, Unicode part-name spelling, multipart
  subtype, fixed Content-Disposition/filename, or legal header presentation.
- Gzip is the only content coding exercised. UTF-8 and selected UTF-16 XML and
  artifact representations are exercised; other codec behavior is unqualified.
- The loopback client cannot expose forbidden actual payload bytes after a 204
  through its ordinary body API. Those and cancellation are tested directly at
  the completion boundary and are identified as such in results. Cancellation
  timing, interim-response handling beyond the client, remote effect rollback,
  concurrency, resource limits and scheduling are not modeled.
- Multipart response-to-object decoding, tunnels, upgrades, callback receivers,
  and streaming/sequential output are not implemented, consistent with explicit
  candidate exclusions. This suite does not deploy a callback service.
- Generated contracts are deliberately small, directly expressible 2020-12
  schemas. There is no general OAS-to-core schema translator or claim that
  unsupported response header constraints can be faithfully synthesized.

Counts show bounded evidence, not proof of full kind implementation or practical
minimality on their own. The loop's reviews and obligation ledger remain separate.

## Repository integration

Run `node scripts/verify-openapi-30-kind.mjs` from the repository root. It executes
the native suite, validates all 302 expanded OBI fixture shapes against the core
schema, and checks the three standalone authored/generated OBIs. Generated
fixtures and results are reproducible outputs, ignored by Git. Integration
changes file lookup and packaging only; the interpreter, cases and native
expectations are unchanged from independent development.

## Public r3 maintenance follow-up

A new maintainer read the full revised public text and current core before
maintaining the original independent interpreter. This adds 15 source-location
cases: nine invalid nonempty fragments, three empty-fragment physical-reference
cases, a final-redirect-base case and two encoded-# data cases. All negative cases
assert zero resolver calls and zero invocation; positive cases verify actual
acquisition and native target paths. The full suite was rerun in both modes.
See [the follow-up report](source-fragment-maintenance-report.md) for provenance.
This maintenance does not claim another independent implementation origin.

## Public r4 content-null follow-up

The maintainer read the complete public r4 text and added 53 cases for JSON null
in content-based form and multipart values. Required/optional properties, explicit
and default JSON media, whole-property null, array null items, non-JSON refusal
or omission, media context and unchanged style rules are covered with independent
native expectations. The complete offline and native suites pass at the new pin.
See [the r4 report](null-maintenance-r4-report.md); this remains maintenance of the
original independent implementation with its documented limits.
