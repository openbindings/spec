# Binding-specification conformance subcorpus

Source fixtures (D-rules) and portable processor scenarios (P-rules) for the
ten standalone brownfield synthesis binding specifications, keyed to each specification under
[`binding-specs/`](../../binding-specs/):

| Family   | Identifier                | Specification                                                                                | Source rules   | Processor rules   |
| -------- | ------------------------- | -------------------------------------------------------------------------------------------- | -------------- | ----------------- |
| usage    | `openbindings.usage@1`    | [`usage/openbindings.usage.md`](../../binding-specs/usage/openbindings.usage.md)             | USAGE-D-01..03 | USAGE-P-01..08    |
| openapi-2.0 | `openbindings.openapi-2.0@1` | [`openapi-2.0/openbindings.openapi-2.0.md`](../../binding-specs/openapi-2.0/openbindings.openapi-2.0.md) | OAPI20-D-01..02 | OAPI20-P-01..36 |
| openapi-3.0 | `openbindings.openapi-3.0@1` | [`openapi-3.0/openbindings.openapi-3.0.md`](../../binding-specs/openapi-3.0/openbindings.openapi-3.0.md) | OAPI30-D-01..02 | OAPI30-P-01..59 |
| openapi-3.1 | `openbindings.openapi-3.1@1` | [`openapi-3.1/openbindings.openapi-3.1.md`](../../binding-specs/openapi-3.1/openbindings.openapi-3.1.md) | OAPI31-D-01..02 | OAPI31-P-01..58 |
| openapi-3.2 | `openbindings.openapi-3.2@1` | [`openapi-3.2/openbindings.openapi-3.2.md`](../../binding-specs/openapi-3.2/openbindings.openapi-3.2.md) | OAPI32-D-01..02 | OAPI32-P-01..62 |
| mcp      | `openbindings.mcp@1`      | [`mcp/openbindings.mcp.md`](../../binding-specs/mcp/openbindings.mcp.md)                     | MCP-D-01..03   | MCP-P-01..04,06..08 |
| grpc     | `openbindings.grpc@1`     | [`grpc/openbindings.grpc.md`](../../binding-specs/grpc/openbindings.grpc.md)                 | GRPC-D-01..03  | GRPC-P-01..07     |
| connect  | `openbindings.connect@1`  | [`connect/openbindings.connect.md`](../../binding-specs/connect/openbindings.connect.md)     | CONN-D-01..03  | CONN-P-01..07     |
| asyncapi | `openbindings.asyncapi@1` | [`asyncapi/openbindings.asyncapi.md`](../../binding-specs/asyncapi/openbindings.asyncapi.md) | ASYNC-D-01..03 | ASYNC-P-01..07    |
| graphql  | `openbindings.graphql@1`  | [`graphql/openbindings.graphql.md`](../../binding-specs/graphql/openbindings.graphql.md)     | GQL-D-01..03   | GQL-P-01..05      |

This is a per-family subcorpus, governed by the family binding
specifications, not by the core OBI-D / OBI-T rules. It lives alongside the
core corpus but is verified separately: the core tooling
(`verify-corpus.mjs`, `generate-conformance-manifest.mjs`) scans only
`document/` and `tool/`, so it neither picks up nor is broken by this
directory. The dedicated verifier is `scripts/verify-binding-specs.mjs`
(run in CI). The ten specifications share one source-fixture shape in
[`fixture.schema.json`](fixture.schema.json), one portable behavior shape in
[`processor-scenario.schema.json`](processor-scenario.schema.json), and one
portable authoring shape in
[`synthesis-scenario.schema.json`](synthesis-scenario.schema.json). Source
fixtures live in ten specification directories; processor scenarios live in
[`processor/`](processor/), and synthesis scenarios live in
[`synthesis/`](synthesis/).

As with the core corpus, fixtures are reference material, not part of any
specification: each family spec's prose is the sole source of conformance,
where prose and corpus disagree the prose governs, and a rule without
fixtures is no less binding.

## Verdict semantics

Each test embeds a complete OBI document and a `valid` verdict for the named
family rule. The verdict is defined precisely:

- **`valid: false`** means: a conformant processor of the named binding
  specification **refuses this document's family-scoped material at or
  before bind time** — a refusal decidable offline from the document plus
  the family specification alone, with no network access and no live
  source. That covers grammar violations (a malformed `location` or `selector`,
  a `content` value outside the family's accepted representations) and
  resolution failures against **embedded** content (a `selector` that does not
  resolve in the artifact the document itself carries).
- **`valid: true`** means: the document's family-scoped material gives such
  a processor **nothing to refuse**. Where resolution would require a live
  source (a location-only source), a grammar-valid document is a positive:
  the unverified remainder falls under the core's partial-verification
  posture (`openbindings.md` §10.2), not under refusal.

Documents are otherwise valid 0.2.0 OBI documents (core-valid): in negative
cases the named family rule is the only thing at issue, except where an
overlap with a core rule is inherent (a relative-in-form `location` also
violates core OBI-D-05; such fixtures list both in `violates`).

Two boundaries keep the verdicts honest:

- **Resolution-dependent tests always embed content.** A `selector`-resolution
  negative is only offline-decidable when the artifact rides in the
  document; a location-only source leaves resolution unverified and is
  never fixtured as a resolution negative (the operation-graph subcorpus's
  OG-D-03 precedent).
- **Capability gaps are unverified, not failed.** Judging embedded-artifact
  tests takes the family's artifact processor — a KDL descriptor parser for
  usage, a protobuf compiler for grpc/connect, an OpenAPI/AsyncAPI processor
  for those families. A validator without the capability reports those tests
  unverifiable rather than passing or failing them, mirroring the core
  corpus's posture for OBI-D-11/OBI-D-18. Type-level and grammar-level tests
  (content JSON type, address form, selector spelling) are decidable by any
  validator.

D-rules bind documents; each family's P-rules bind processors (wire
behavior, configuration points, classification). The rule-keyed D fixture
format remains document-only. A separate portable processor-scenario format
under `processor/` covers all ten standalone brownfield synthesis specifications. Where a
family attributes a constraint to a P-rule (the YAML
grammar pin and exact OpenAPI/AsyncAPI edition discrimination under the
OAPI20/OAPI30/OAPI31/OAPI32-P-01 and ASYNC-P-01 rules, gRPC's bound-closure
schema range under GRPC-P-03),
the D fixtures deliberately do not duplicate it, even when the constraint
reads document-shaped; the fixture files note each such exclusion.

The portable P-rule corpus follows the catalog's deference order. Its
expected outcome is one of: a required behavior inherited or defined by
the specification; a permitted set preserved from the upstream authority; a
behavior selected by declared consumer configuration; or a required loud
refusal. It MUST NOT turn an artifact-permitted alternative into one
OpenBindings-preferred byte sequence merely to make SDK traces identical.

## Portable processor scenarios

[`processor-scenario.schema.json`](processor-scenario.schema.json) defines a
family-neutral harness exchange. Each scenario carries native source material,
one binding, semantic configuration-point values, caller input, and an optional
scripted peer/process outcome. A family adapter translates those semantic
inputs into an implementation's configuration API and normalizes the observed
dispatch, outputs, and terminal disposition. The scenario passes when the
normalized observation satisfies every assertion in any one `expected`
alternative.

`disposition` and `phase` carry refusal and failure semantics directly. Extra
assertions are limited to wire dispatch and operation-value facts fixed by the
governing binding specification. Portable scenarios do not compare diagnostic
error codes, error payloads, or the record shape through which an invocation
interface presents a context requirement; those belong to that interface's
own conformance suite. An empty assertion list is therefore meaningful when
the expected disposition and phase completely state the governed result.

Several alternatives are a feature: they preserve an artifact-permitted set
without giving array order preference semantics. `OAPI31-PS-04` permits either
declared JSON request media, and `USAGE-PS-07` permits either artifact-allowed
optional-delimiter spelling. Configuration objects name specification points
(`server`, `message`, `protocolFields`, `target`, `route`) but deliberately do
not prescribe an SDK's concrete configuration type.

Portable codec facts live under `given.runtime`. The four directional maps are
`requestCharacterEncodings`, `responseCharacterEncodings`,
`requestContentCodings`, and `responseContentCodings`; their keys compare
case-insensitively. The reserved action `unavailable` makes that exact
directional capability absent even when an adapter has a built-in codec, while
`fail` installs a sentinel capability that raises if invoked, and `identity`
copies the exact test bytes or code points unchanged. Other nonempty action
names select deterministic corpus codecs, including `unwrap` and `reverse`.
These are harness facts rather than binding configuration points:
they exist so a scenario can distinguish directionality, absence, failure, and
the requirement not to invoke a decoder on a no-content response.

Processor-scenario revision 2 re-keys the former unified `openapi` family as
the exact `openapi-2.0`, `openapi-3.0`, `openapi-3.1`, and `openapi-3.2`
siblings and carries their exact binding-specification identifiers. The
exchange shape is otherwise unchanged. Revision-1 files for the other
families remain valid and are not rewritten merely to advance a version.

Processor-scenario revision 4 adds lossless caller-input materialization for
hostile string code units that the corpus's own JSON representation cannot
carry portably. An `inputMaterializations` entry addresses a `null` placeholder
in the JSON-safe `input` template and replaces it, before invocation, with one
string containing exactly the listed UTF-16 code units. The adapter MUST NOT
normalize or replace those units, and the materialization record itself never
reaches the processor. An adapter unable to construct the value reports the
scenario unsupported rather than substituting another value and claiming a
pass. The repository verifier requires unique, resolving paths, null
placeholders, and an unpaired surrogate in each current materialization.
Revision-1 files outside the OpenAPI family remain valid and unchanged.

Processor-scenario revision 5 adds the `semanticEquals` assertion for wire
representations that contain JSON. It prevents a scenario from choosing one
otherwise-equivalent JSON byte spelling merely to verify the value, and also
prevents weak substring checks from losing field ownership, sequential item
boundaries, or item order. The assertion first requires the complete selected
representation to parse under the named interpreter and then compares the
resulting JSON value structurally:

- `form-json-field` parses the pointed-at
  `application/x-www-form-urlencoded` body, selects exactly one field with the
  decoded `name`, parses that field's complete decoded value as JSON, and
  compares it with `value`. Parsing splits raw fields on `&` and each field on
  its first `=`, replaces `+` with SP, decodes well-formed percent triplets to
  UTF-8 bytes, and rejects invalid UTF-8. The raw name/value spelling must be a
  member of the governing sibling's complete form-content permitted set: in
  OAS 3.0, SP is `+`, every RFC 3986 unreserved byte is literal, and every
  other UTF-8 byte is uppercase `%HH`; in OAS 3.1, SP is `+` or `%20`, `~` is
  literal or `%7E`, every other unreserved byte is literal, and every remaining
  UTF-8 byte is uppercase `%HH`; in OAS 3.2, ASCII alphanumerics and `*`, `-`,
  `.`, `_` are literal, SP is `+`, and every other UTF-8 byte is uppercase
  `%HH`. Thus the interpreter checks the complete edition-specific form wrapper
  without choosing the JSON spelling inside it.
- `multipart-json-part` points at the normalized `dispatch` object, parses its
  body using the boundary in its `Content-Type`, selects exactly one
  `form-data` part with the decoded `name`, requires its generated
  `Content-Disposition` parameter list to contain only `name`, written with
  exactly the governing binding's quoted `name="..."` spelling and with
  neither `filename` nor `filename*`, requires that
  part's media-type
  essence to be exactly `application/json` case-insensitively with no media-type
  parameters, parses the complete part body as JSON, and compares it with
  `value`. MIME field names
  compare case-insensitively; quoted-string unquoting follows the governing
  HTTP grammar; the complete multipart body, including its closing delimiter,
  must parse with no unconsumed bytes.
- `query-json-parameter` parses the pointed-at URL, selects exactly one query
  contribution with the decoded `name`, parses the complete decoded value as
  JSON, and compares it with `value`. It splits the raw query on `&` and each
  contribution on its first `=`, then decodes uppercase `%HH` triplets as UTF-8
  without treating `+` as SP. Re-encoding each decoded name and value with
  exactly the RFC 3986 unreserved ASCII bytes literal and every other UTF-8
  byte as uppercase `%HH` must reproduce that raw contribution byte-for-byte.
- `querystring-json` parses the pointed-at URL, requires a present query
  component, percent-decodes that complete component once without interpreting
  it as named fields, parses it as JSON, and compares it with `value`. Its
  percent decoder and byte-for-byte re-encoding check are the same unreserved
  UTF-8/uppercase-`%HH` procedure as `query-json-parameter`, applied to the
  complete query component rather than to name/value fields.
- `json-lines` parses the pointed-at body using the line framing pinned by the
  OAS 3.2 binding specification. `json-sequence` applies that binding's request
  emission form, not RFC 7464's broader accepting-parser grammar: every item is
  exactly one frame beginning with RS and ending with LF, the bytes between
  them are one complete JSON text, and neither delimiter may be omitted. In
  both cases every frame must be valid, the whole body must be consumed, and
  the ordered array of parsed items is compared with `value`. The parse itself
  therefore proves delimiter cardinality, item count, boundaries, and order
  without fixing whitespace, member order, escapes, or number spelling within
  an item.

The three named interpreters require both `name` and `names`; the other three
forbid both. `names` is the exact order-insensitive multiset of every decoded
form field, multipart part, or query-contribution name in the complete parsed
wrapper, including duplicates. It prevents a correct selected value from
hiding an extra flattened field, part, or query contribution. A failed parse,
missing or duplicate selected member, unequal total-name multiset, unconsumed
wire content, wrong framing, or unequal JSON value fails the assertion. This is harness
comparison behavior only: it adds no binding configuration point and no
processor obligation beyond the wire behavior already stated by the governing
specification. The schema rejects `semanticEquals` under every earlier format,
so revision-1 files outside the OpenAPI family remain valid without silently
acquiring a new evaluator; the four OpenAPI siblings use revision 5.

For this assertion, JSON structural equality is closed as follows. Objects
must have unique member names and compare as the same name-to-value mapping
without member-order significance. Arrays compare by equal length and
recursive value equality at each position. Strings, booleans, and null compare
as their JSON values. Numbers compare by the exact mathematical value denoted
by their RFC 8259 decimal spellings, with `-0` and `0` equal. These rules let
equivalent whitespace, escaping, member order, and number spelling vary while
preventing an adapter's host-number representation from changing a verdict.

The current corpus contains 981 scenarios citing every P-rule of usage,
AsyncAPI, MCP, gRPC, Connect, and GraphQL, together with partitioned OpenAPI
3.0/3.1 scenarios, the full authority-derived 2.0 batch, the 3.2
request-surface batch and the native 3.2 response-governance, content-coding,
sequential-response, and response-reference-identity batches, the
hostile-pass fix-round and Go engine-round batches, the Round R
upstream-invalid Response Object batch, the Round R2 batch that carries
that rule onto the 2.0 and 3.2 lanes and pins its success scope on all four,
and the bounded OAS family-closure batch for cookie multiplicity, effective
required bodies, failure-media advertisement, runtime compound members, and
fixed PATCH carriage (256 distinct rules). A complete citation set is a structural guarantee: it
means no defined P-rule lacks a scenario, not that one scenario exercises every
clause collected by a legacy umbrella rule. New semantic-closure rules use one
stable P-rule identifier per observable claim so the corresponding scenario is
directly traceable without relying on an umbrella citation. The corpus includes
artifact-permitted alternatives, required configuration, pre-dispatch
refusal, late streaming failure, lossless result preservation, and
reserved-protocol collision cases. Independent adapters in `openbindings-go` and
`openbindings-ts` are intended to execute the portable scenarios for each
implemented family. A scenario becomes cross-implementation behavioral evidence
only after both adapter jobs execute it successfully; until then it is a
structurally verified semantic reference. The family prose remains authoritative,
and each adapter remains responsible for demonstrating that a normalized
observation came from the real family implementation.

Each reference SDK also keeps authoring tests beside the family implementation.
The shared `synthesis/` corpus makes the cross-implementation portion
portable: each scenario supplies native source material and pins the exact
operation keys, binding target identities, and normalized coverage
dispositions expected from both SDKs. Diagnostic prose and SDK API shape are
deliberately excluded. The processor scenarios cover invocation of the
resulting binding vocabulary. Together they enforce the authoring invariant:
inspection and synthesis use the same target-eligibility rules as invocation,
no synthesized operation is statically guaranteed to refuse, every observed
interaction or independently selectable artifact alternative receives a
durable disposition, and a direct synthesis call fails as a whole when an
accepted target cannot be represented faithfully. They do not claim that a
synthesized interface is a temporal snapshot of a live service or remains
usable after the source or peer changes.

## Portable synthesis scenarios

[`synthesis-scenario.schema.json`](synthesis-scenario.schema.json) defines the
artifact-to-OBI proof boundary. Its version-5 OpenAPI exchange (with version 4
retained for families that have not adopted dependency coverage) distinguishes two
outcomes. A `synthesized` scenario contains one native source and expects the
exact operation-key set, the exact `(operationKey, bindingSelector)` target
identities, and an exhaustive coverage ledger normalized to stable semantic
fields (`sourceRef`, scope, status, governing rule, and runtime requirements).
A `reasonCode`, where retained for local triage, is a diagnostic annotation:
portable adapters ignore its presence, absence, and spelling. A `refused`
scenario proves creation-time soundness: when an
upstream-valid target cannot be represented faithfully and no independent
artifact alternative preserves it, synthesis fails as a whole rather than
returning a statically unbindable partial interface. Refusal scenarios cite
the governing rules but deliberately do not compare exception types or
diagnostic prose.

Discrepancies discovered while executing this corpus are classified in
[`adjudications.json`](adjudications.json), validated by
[`adjudication.schema.json`](adjudication.schema.json). A record identifies
the governing upstream fact and rules, the owning layer, the smallest
resolution, compatibility consequences, and permanent evidence. A passing
test is not itself authority: an implementation defect is fixed in code, a
fixture defect in the corpus, and a semantic correction to a published
binding specification follows its errata/revision discipline.

`message` and family-specific `details` are intentionally absent from expected
entries: they are diagnostics, not cross-SDK behavior. Entry order is also
non-semantic. A represented entry must point to an expected binding;
`fullyRepresented` is true only when every coverage entry is represented;
`invalid`, `excluded`, `lossy`, and `implementation-unsupported` entries are all
coverage loss. The 196 scenarios
exercise all ten standalone brownfield synthesis specifications and mix faithful
targets with artifact alternatives, binding-spec exclusions, invalid source
units, and required whole-source refusals. This corpus is designed to grow
with newly discovered upstream edge cases; it is neither a crawler corpus nor
an index format.

Revision 3 adds two members, both optional and neither a new compared surface
by itself.

A scenario MAY carry `resources`: the same closed, immutable dependency set
keyed by absolute retrieval URI that a processor scenario carries under
`given.resources`, served offline through the family adapter's ordinary
artifact resolver. Without it the format could not express a multi-document
artifact at all, so `openbindings.openapi-3.1@1` §6 "Reference scope" — normative
binding-specification text about what an external reference composes — had no
portable synthesis coverage, and a divergence was created in exactly the case
§6 exists to decide with every project gate green. `resources` is harness
input: it changes no comparison semantics, and every address a scenario reaches
must be answerable from its own `content` or its own `resources`, so no runner
touches the network. A runner for a family whose corpus sources are all
self-contained refuses a scenario declaring `resources` rather than executing
it against a resolver that would never see them.

A `synthesized` scenario MAY carry `assertions`: pointer-addressed comparisons
evaluated against the emitted OBI document, reusing the same
`path`/`equals`/`absent`/`oneOf`/`setEquals`/`contains` object and the same
evaluators the processor corpus already uses. An assertion pins what it names
and nothing else, which is what keeps it on the authority-defined side of the
line drawn below under "What a synthesis scenario may pin". Author one only for
a fact a finding is about: an assertion with no finding behind it is a golden
file arriving by another route.

Revision 4 renames the binding identity member `bindingRef` to
`bindingSelector`, tracking the core rename of the binding member `ref` to
`selector`. Alongside it the usage corpus renames the coverage-identity
spellings that carried the old word: the reason code
`usage.no_unique_command_ref` becomes `usage.no_unique_command_selector`, and
the sentinel `sourceRef` prefix `ambiguous-ref:` becomes
`ambiguous-selector:`. `sourceRef` itself is unchanged — it names a
source-local unit, not the binding member. Nothing else changes.

Revision 5 adds `dependency` as a coverage scope for a source interaction that
the governing binding specification requires synthesis to represent as a
targetless Core dependency. A represented dependency entry is identified by
its authority-defined `sourceRef` and therefore carries neither an operation
key nor a binding selector. This keeps dependency-key spelling outside the
portable comparison surface, as the OpenAPI family requires. Revision-4 files
for families with no dependency scenarios remain valid and unchanged.

A scenario's `source` is shaped directly by Core's binding-source model: it
declares `location`, `content`, or both. The corpus therefore remains usable by
any synthesis surface and does not borrow its admissible inputs from a
separately versioned project interface.

The three scenario counts stated in this file are derived, not maintained by
hand. `node scripts/count-binding-spec-scenarios.mjs` prints them per family
and in total, and `verify-binding-specs.mjs` fails when the prose and the
corpus disagree; a count worth publishing is worth failing on.

### What a synthesis scenario may pin

The compared surface stops where it does for a reason, and the reason is worth
stating so a later widening is argued rather than assumed. **A portable
binding-specification scenario may require what Core, the governing binding
specification, or one of its incorporated authorities defines, and must not
require a project interface's record shape or what every authority delegates
to an implementation.** Interface-specific expectations belong in that
interface's own conformance suite.

The OpenAPI family specifications now define their synthesis semantics locally:
target identity, operation-key stability, reference closure, coverage status,
and creation-time soundness are portable because Core or the governing family
specification fixes them. Presentation choices that those authorities leave
free remain nonportable—for example, the name of a generated definition or
which member of a reference cycle is chosen as a cut point. That is why the
expected surface is operation-key and target identity plus an exhaustive
coverage ledger, and why emitted schema content is compared only where a
governing authority fixes the value being asserted.

Requiring a name no authority fixes would make conformance mean "matches what we
built" rather than "matches what the authorities say" — the inversion the
[binding-specs authoring doctrine](../../binding-specs/README.md) names in its
authority precedence — and it would fail an implementation that has broken no
rule. Recording agreement is different from requiring conformance: a retained
`reasonCode` can help local triage, but because no governing authority fixes its
spelling, portable adapters MUST ignore it. The portable verdict is carried by
the status, source position, governing rule, and required configuration facts.

#### The addressing rule for assertions

The same line, stated as a syntactic rule for the one place a scenario now
reaches into emitted content. **An assertion's `path` may traverse names an
authority defines and names the artifact itself supplies. It MUST NOT traverse
a name an implementation mints.**

- Authority-defined: the core document model's members (`operations`, `input`,
  `output`, `bindings`), members the governing binding specification defines,
  and the JSON Schema dialect's keywords (`properties`, `items`, `allOf`,
  `$defs`, `example`).
- Artifact-supplied: an operation identifier the artifact declares, a property
  or parameter name it declares, a media type it declares.
- Minted, and therefore out of bounds: a generated or qualified `$defs`
  cut-point key, and any operation-facing field name the artifact does not
  supply — the OpenAPI siblings send deterministic generation of the
  operation-facing field names to synthesis, so the wrapper property a
  whole-value body rides under is the implementations' own name. Both the
  [binding-specs authoring doctrine](../../binding-specs/README.md) and
  [`ABSTRACTION-FIDELITY.md`](../../ABSTRACTION-FIDELITY.md) place a "synthesis
  naming convention" outside every specification, so requiring a third-party
  implementation to reproduce such a name would make conformance mean "matches
  what we built".

The rule has a known cost, recorded rather than worked around, and it is paid
twice in the corpus as it stands. A property an authority *does* define but
that is reachable only through a minted name cannot be asserted with today's
five verbs: "these are exactly the definitions" and "no extra definition
appeared" are the worked cases, which is why the `$defs` reachability closure
behind `OAPI31-SS-19` stays pinned by SDK-local twin tests instead. And
`OAPI31-SS-27` carries no assertion at all, because the value its case is about
rides the synthesizer-named whole-body property. Both stay there until the
vocabulary gains a name-independent verb, which is a decision in its own right
and not one an authoring pass may take.

## Fixture file format

One JSON file per rule, in the family's directory, named for the rule
(`usage/USAGE-D-02.json`). The shape derives from the core corpus's
[`fixture.schema.json`](../fixture.schema.json) with three changes, pinned
by this subtree's own [`fixture.schema.json`](fixture.schema.json):

- `rule` matches the published rule prefixes (`USAGE`, `OAPI20`, `OAPI30`,
  `OAPI31`, `OAPI32`, `MCP`, `GRPC`, `CONN`, `ASYNC`, or `GQL`).
- `bindingSpec` (required) carries the exact governing identifier
  (`"openbindings.usage@1"`), exact and opaque per core OBI-B-01.
- `section` cites the **family** specification's section — the section the
  rule is substantively defined in (`"5"` for content rules, `"4"` for
  location rules, `"7"` for selector rules; the family specs share this
  skeleton) — never a core-spec section.

`violates` keeps the core corpus's **minimum-set semantics** verbatim: for
a negative fixture, a tool that reports violated rules at all must report
at least the listed set; supersets are never a defect, and exact-set
checking is not a valid strictness. Core OBI rules appear in `violates`
only where the overlap is inherent (OBI-D-05 on relative-in-form
locations). The optional file-level `notes` field documents authoring
intent, exactly as in the core corpus.

## Coverage

All 26 rules are fixtured with at least one positive and one negative case;
no rule needed a deferral row — every family D-rule has an offline-decidable
core, and resolution clauses are fixtured via embedded content.

| Rule       | Tests (+/−) | Notes                                                                                                                                                                                |
| ---------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| USAGE-D-01 | 1/3         | content string; number/object/null negatives                                                                                                                                         |
| USAGE-D-02 | 4/5         | document + exec address forms; relative-in-form, empty-token, and empty-command negatives                                                                                            |
| USAGE-D-03 | 4/4         | command-path grammar, alias segment, omitted-selector root; empty-string, empty-segment, case, and dangling-path negatives (embedded KDL)                                                 |
| OAPI20-D-01 | 4/6        | object/string content plus absolute-URI location; content-type and relative-in-form negatives                                                                                       |
| OAPI20-D-02 | 2/11       | 2.0 paths selectors; literal spelling, resolution, exact identifier, and exact-edition negatives                                                                                     |
| OAPI30-D-01 | 4/6        | object/string content plus absolute-URI location; content-type and relative-in-form negatives                                                                                       |
| OAPI30-D-02 | 2/11       | 3.0 paths selectors; literal spelling, resolution, exact identifier, and exact-edition negatives                                                                                     |
| OAPI31-D-01 | 4/6        | object/string content plus absolute-URI location; content-type and relative-in-form negatives                                                                                       |
| OAPI31-D-02 | 3/12       | 3.1 paths selectors including `components.pathItems`; literal spelling, webhooks, resolution, identifier, and edition negatives                                                      |
| OAPI32-D-01 | 4/6        | object/string content plus absolute-URI location; content-type and relative-in-form negatives                                                                                       |
| OAPI32-D-02 | 5/12       | 3.2 paths, QUERY, and capitalization-preserving `additionalOperations` selectors; literal spelling, webhooks, resolution, identifier, and edition negatives                         |
| MCP-D-01   | 2/7         | pinned-listing grammar; pagination-member, stray-member, shape, and type negatives                                                                                                   |
| MCP-D-02   | 2/4         | required absolute http/https address; content-only-source negative                                                                                                                   |
| MCP-D-03   | 5/8         | entity/remainder grammar, verbatim remainders, template addressing; unknown-entity, byte-exactness, dangling, and ambiguity negatives (pinned listings)                              |
| GRPC-D-01  | 4/5         | proto-string + FDS carriages, shared-type (DAG-reuse) source; import-prefix, unknown-member, extension-member, and type negatives                                                    |
| GRPC-D-02  | 6/9         | all three port-explicit address forms and host shapes; component, portless, undefined-scheme, and content-only negatives                                                             |
| GRPC-D-03  | 3/7         | packaged + packageless service selectors; separator, empty-segment, byte-exactness, and dangling negatives (embedded schemas)                                                             |
| CONN-D-01  | 4/3         | incorporated carriages + descriptorless-mode positive + shared-type (DAG-reuse) source; import, type, unknown-member negatives                                                       |
| CONN-D-02  | 3/8         | base-URL grammar incl. path prefix; trailing-slash, component, scheme, and content-only negatives                                                                                    |
| CONN-D-03  | 2/4         | schema-mode + descriptorless-mode positives; separator, empty-segment, byte-exactness negatives                                                                                      |
| ASYNC-D-01 | 2/3         | object + string representations; number/array/null negatives                                                                                                                         |
| ASYNC-D-02 | 2/3         | absolute-URI address; relative-in-form negatives                                                                                                                                     |
| ASYNC-D-03 | 5/7         | pointer spelling incl. RFC 6901 `~1`/`~0`/`~01` escapes and Reference Object resolution; bare-key, non-operation-target, unescaped, percent-encoded-spelling, and dangling negatives |
| GQL-D-01   | 2/3         | absolute HTTP(S) GraphQL endpoint; missing, relative, and WebSocket-location negatives                                                                                                |
| GQL-D-02   | 2/4         | successful introspection execution-result object; bare schema, wrapper-stripped, stringified, and errored-result negatives                                                           |
| GQL-D-03   | 2/4         | exact lower-case root-kind/field selectors with actual root-type mapping; case, path-shape, and dangling-field negatives                                                                  |

## Layout

```
binding-specs/
  README.md            (this file)
  fixture.schema.json  (shared fixture shape for all ten specifications)
  processor-scenario.schema.json (portable P-rule scenario shape)
  synthesis-scenario.schema.json (portable artifact-to-OBI scenario shape)
  adjudication.schema.json (discrepancy-disposition record shape)
  adjudications.json    (review decisions from corpus findings)
  processor/            usage.json, openapi-{2.0,3.0,3.1,3.2}.json, asyncapi.json,
                        mcp.json, grpc.json, connect.json, graphql.json
  synthesis/            one portable authoring file per published specification
  usage/               USAGE-D-01.json ... USAGE-D-03.json
  openapi-2.0/         OAPI20-D-01.json ... OAPI20-D-02.json
  openapi-3.0/         OAPI30-D-01.json ... OAPI30-D-02.json
  openapi-3.1/         OAPI31-D-01.json ... OAPI31-D-02.json
  openapi-3.2/         OAPI32-D-01.json ... OAPI32-D-02.json
  mcp/                 MCP-D-01.json   ... MCP-D-03.json
  grpc/                GRPC-D-01.json  ... GRPC-D-03.json
  connect/             CONN-D-01.json  ... CONN-D-03.json
  asyncapi/            ASYNC-D-01.json ... ASYNC-D-03.json
  graphql/             GQL-D-01.json   ... GQL-D-03.json
```

## Usage and verification

A conformance runner walks each fixture file, hands the embedded `document`
to a processor claiming support for the fixture's `bindingSpec`, and
compares the processor's accept/refuse behavior for the family-scoped
material against `valid`, under the verdict semantics above.

An unqualified support claim covers the binding specification's complete
accepted edition and feature envelope. Corpus cases therefore include exact
version-boundary checks and representative edition-specific branches; a
processor that implements a narrower subset reports partial support instead
of treating a shared major/minor line as implicitly accepted.

`node scripts/verify-binding-specs.mjs` (run in CI) keeps all corpus forms
internally consistent: every D-rule fixture file validates against this subtree's
`fixture.schema.json`; each file's `rule` matches its filename, family
directory, and `bindingSpec`; the cited `section` exists in the family
spec; every family D-rule extracted from the ten specifications is either
fixtured here or listed as deferred in this README; every negative test
carries `violates`, and every `violates` entry names a rule the family spec
or the core spec actually defines. Processor scenario files validate against
their own schema; family, identifier, section, scenario ids, and every
referenced P-rule are cross-checked verbatim against the owning family
specification. The verifier requires complete P-rule citation coverage for all ten
standalone specifications, including every OpenAPI sibling. Synthesis and
invocation-fidelity scenario citations must likewise exist verbatim in their
owning family specification or, for an OBI citation, in Core; no legacy-token
or pattern-only fallback is accepted. Synthesis scenario files are also
checked for all ten specifications, including target/disposition consistency.
It asserts this README's three scenario counts against the corpus, and probes the
synthesis schema with a source declaring neither `location` nor `content` to
prove the adopted contract constraint is still enforced. It does not judge D
verdicts, prove every clause collected by an umbrella rule, or execute
processor/synthesis scenarios — those are the jobs of family processors,
adapters, and semantic acceptance review.

The cross-implementation acceptance workflow checks out both reference SDKs and
invokes their portable processor and synthesis adapters. A passing job is
evidence only for scenarios the pinned adapter revision actually loads, so its
executed counts must equal the current corpus before the result is called complete.
The SDK repositories can run the same corpus independently. Adapter lag is
reported as implementation work rather than hidden by the repository's structural
verifier. Once synchronized, a corpus change, a Go behavior change, and a
TypeScript behavior change form one observable gate while preserving the
authority order above: a mismatch is adjudicated before any layer is changed.

## Adding fixtures

Append test entries to the rule's file (or add `family/RULE-ID.json` for a
newly published rule) following the format above, then run
`node scripts/verify-binding-specs.mjs`. Keep embedded artifacts minimal
and legible; embed content whenever a test's verdict depends on resolution.

The corpus is currently aligned with each family's unreleased first `@1`
candidate under Core 0.2.0 semantics. No binding family has been published.
Operation Graph is the eighth candidate family; its invocation-only composition semantics use the
separate [`operation-graph/`](../operation-graph/) corpus because the graph's
operation contracts live in the containing OBI rather than a standalone
synthesizable source.
