# Binding-specification conformance subcorpus

Source fixtures (D-rules) and portable processor scenarios (P-rules) for the
seven published artifact/protocol binding specifications, keyed to each family's specification under
[`binding-specs/`](../../binding-specs/):

| Family   | Identifier                | Specification                                                                                | Source rules   | Processor rules   |
| -------- | ------------------------- | -------------------------------------------------------------------------------------------- | -------------- | ----------------- |
| usage    | `openbindings.usage@1`    | [`usage/openbindings.usage.md`](../../binding-specs/usage/openbindings.usage.md)             | USAGE-D-01..03 | USAGE-P-01..08    |
| openapi  | `openbindings.openapi@1`  | [`openapi/openbindings.openapi.md`](../../binding-specs/openapi/openbindings.openapi.md)     | OAPI-D-01..03  | OAPI-P-01..10     |
| mcp      | `openbindings.mcp@1`      | [`mcp/openbindings.mcp.md`](../../binding-specs/mcp/openbindings.mcp.md)                     | MCP-D-01..03   | MCP-P-01..08      |
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
(run in CI). The seven families share one source-fixture shape in
[`fixture.schema.json`](fixture.schema.json), one portable behavior shape in
[`processor-scenario.schema.json`](processor-scenario.schema.json), and one
portable authoring shape in
[`synthesis-scenario.schema.json`](synthesis-scenario.schema.json). Source
fixtures live in seven family directories; processor scenarios live in
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
  source. That covers grammar violations (a malformed `location` or `ref`,
  a `content` value outside the family's accepted representations) and
  resolution failures against **embedded** content (a `ref` that does not
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

- **Resolution-dependent tests always embed content.** A `ref`-resolution
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
  (content JSON type, address form, ref spelling) are decidable by any
  validator.

D-rules bind documents; each family's P-rules bind processors (wire
behavior, configuration points, classification). The rule-keyed D fixture
format remains document-only. A separate portable processor-scenario format
under `processor/` covers all seven published artifact/protocol families. Where a
family attributes a constraint to a P-rule (the YAML
grammar pin and exact `openapi`/`asyncapi` edition discrimination under
OAPI-P-01/ASYNC-P-01, gRPC's bound-closure schema range under GRPC-P-03),
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

Several alternatives are a feature: they preserve an artifact-permitted set
without giving array order preference semantics. `OAPI-PS-04` permits either
declared JSON request media, and `USAGE-PS-07` permits either artifact-allowed
optional-delimiter spelling. Configuration objects name specification points
(`server`, `message`, `protocolFields`, `target`, `route`) but deliberately do
not prescribe an SDK's concrete configuration type.

The current corpus contains 109 scenarios covering every P-rule of usage,
OpenAPI, AsyncAPI, MCP, gRPC, Connect, and GraphQL (52 distinct rules). It includes
artifact-permitted alternatives, required configuration, pre-dispatch refusal,
late streaming failure, lossless result preservation, and reserved-protocol
collision cases. Independent adapters in `openbindings-go` and
`openbindings-ts` execute every scenario for every family. The corpus is
therefore cross-implementation behavioral evidence, while the family prose
remains authoritative and the adapters remain responsible for demonstrating
that each normalized observation came from the real family implementation.

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
artifact-to-OBI proof boundary. Its version-2 exchange distinguishes two
outcomes. A `synthesized` scenario contains one native source and expects the
exact operation-key set, the exact `(operationKey, bindingRef)` target
identities, and an exhaustive coverage ledger normalized to stable semantic
fields (`sourceRef`, scope, status, rule/reason identity, and runtime
requirements). A `refused` scenario proves creation-time soundness: when an
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
`fullyRepresented` is true only when every upstream-valid entry is represented
(`invalid` source units do not count as upstream-valid). The twenty-three
scenarios exercise all seven published artifact/protocol families and mix
faithful targets with artifact alternatives, binding-spec exclusions, invalid
source units, and required whole-source refusals. This corpus is designed to
grow with newly discovered upstream edge cases; it is neither a crawler corpus
nor an index format.

## Fixture file format

One JSON file per rule, in the family's directory, named for the rule
(`usage/USAGE-D-02.json`). The shape derives from the core corpus's
[`fixture.schema.json`](../fixture.schema.json) with three changes, pinned
by this subtree's own [`fixture.schema.json`](fixture.schema.json):

- `rule` matches the seven family prefixes (`^(USAGE|OAPI|MCP|GRPC|CONN|ASYNC|GQL)-D-[0-9]+$`).
- `bindingSpec` (required) carries the exact governing identifier
  (`"openbindings.usage@1"`), exact and opaque per core OBI-B-01.
- `section` cites the **family** specification's section — the section the
  rule is substantively defined in (`"5"` for content rules, `"4"` for
  location rules, `"7"` for ref rules; the family specs share this
  skeleton) — never a core-spec section.

`violates` keeps the core corpus's **minimum-set semantics** verbatim: for
a negative fixture, a tool that reports violated rules at all must report
at least the listed set; supersets are never a defect, and exact-set
checking is not a valid strictness. Core OBI rules appear in `violates`
only where the overlap is inherent (OBI-D-05 on relative-in-form
locations). The optional file-level `notes` field documents authoring
intent, exactly as in the core corpus.

## Coverage

All 21 rules are fixtured with at least one positive and one negative case;
no rule needed a deferral row — every family D-rule has an offline-decidable
core, and resolution clauses are fixtured via embedded content.

| Rule       | Tests (+/−) | Notes                                                                                                                                                                                |
| ---------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| USAGE-D-01 | 1/3         | content string; number/object/null negatives                                                                                                                                         |
| USAGE-D-02 | 4/5         | document + exec address forms; relative-in-form, empty-token, and empty-command negatives                                                                                            |
| USAGE-D-03 | 4/4         | command-path grammar, alias segment, omitted-ref root; empty-string, empty-segment, case, and dangling-path negatives (embedded KDL)                                                 |
| OAPI-D-01  | 2/3         | object + string representations; number/array/null negatives                                                                                                                         |
| OAPI-D-02  | 2/3         | absolute-URI address; relative-in-form negatives                                                                                                                                     |
| OAPI-D-03  | 3/10        | pointer form incl. 3.1 `components.pathItems` resolution; lowercase-exact method, escaping, percent-encoded-spelling, webhooks, and dangling-target negatives                        |
| MCP-D-01   | 2/7         | pinned-listing grammar; pagination-member, stray-member, shape, and type negatives                                                                                                   |
| MCP-D-02   | 2/4         | required absolute http/https address; content-only-source negative                                                                                                                   |
| MCP-D-03   | 5/8         | entity/remainder grammar, verbatim remainders, template addressing; unknown-entity, byte-exactness, dangling, and ambiguity negatives (pinned listings)                              |
| GRPC-D-01  | 4/5         | proto-string + FDS carriages, shared-type (DAG-reuse) source; import-prefix, unknown-member, extension-member, and type negatives                                                    |
| GRPC-D-02  | 6/9         | all three port-explicit address forms and host shapes; component, portless, undefined-scheme, and content-only negatives                                                             |
| GRPC-D-03  | 3/7         | packaged + packageless service refs; separator, empty-segment, byte-exactness, and dangling negatives (embedded schemas)                                                             |
| CONN-D-01  | 4/3         | incorporated carriages + descriptorless-mode positive + shared-type (DAG-reuse) source; import, type, unknown-member negatives                                                       |
| CONN-D-02  | 3/8         | base-URL grammar incl. path prefix; trailing-slash, component, scheme, and content-only negatives                                                                                    |
| CONN-D-03  | 2/4         | schema-mode + descriptorless-mode positives; separator, empty-segment, byte-exactness negatives                                                                                      |
| ASYNC-D-01 | 2/3         | object + string representations; number/array/null negatives                                                                                                                         |
| ASYNC-D-02 | 2/3         | absolute-URI address; relative-in-form negatives                                                                                                                                     |
| ASYNC-D-03 | 5/7         | pointer spelling incl. RFC 6901 `~1`/`~0`/`~01` escapes and Reference Object resolution; bare-key, non-operation-target, unescaped, percent-encoded-spelling, and dangling negatives |
| GQL-D-01   | 2/3         | absolute HTTP(S) GraphQL endpoint; missing, relative, and WebSocket-location negatives                                                                                                |
| GQL-D-02   | 2/4         | successful introspection execution-result object; bare schema, wrapper-stripped, stringified, and errored-result negatives                                                           |
| GQL-D-03   | 2/4         | exact lower-case root-kind/field refs with actual root-type mapping; case, path-shape, and dangling-field negatives                                                                  |

## Layout

```
binding-specs/
  README.md            (this file)
  fixture.schema.json  (shared fixture shape for all seven families)
  processor-scenario.schema.json (portable P-rule scenario shape)
  synthesis-scenario.schema.json (portable artifact-to-OBI scenario shape)
  adjudication.schema.json (discrepancy-disposition record shape)
  adjudications.json    (review decisions from corpus findings)
  processor/            usage.json, openapi.json, asyncapi.json,
                        mcp.json, grpc.json, connect.json, graphql.json
  synthesis/            one portable authoring file per published family
  usage/               USAGE-D-01.json ... USAGE-D-03.json
  openapi/             OAPI-D-01.json  ... OAPI-D-03.json
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
spec; every family D-rule extracted from the seven specifications is either
fixtured here or listed as deferred in this README; every negative test
carries `violates`, and every `violates` entry names a rule the family spec
or the core spec actually defines. Processor scenario files validate against
their own schema; family, identifier, section, scenario ids, and every
referenced P-rule are cross-checked, and the verifier requires complete P-rule
coverage for all seven families. Synthesis scenario files are likewise checked
for all seven families, including target/disposition consistency. It does not
judge D verdicts or execute processor/synthesis scenarios — those are the jobs
of family processors and adapters.

The spec repository's CI also checks out both reference SDKs and executes every
portable processor and synthesis scenario against each family implementation.
The SDK repositories run the same corpus independently. This makes a corpus
change, a Go behavior change, and a TypeScript behavior change part of one
observable gate while preserving the authority order above: a mismatch is
adjudicated before any layer is changed.

## Adding fixtures

Append test entries to the rule's file (or add `family/RULE-ID.json` for a
newly published rule) following the format above, then run
`node scripts/verify-binding-specs.mjs`. Keep embedded artifacts minimal
and legible; embed content whenever a test's verdict depends on resolution.

The corpus is currently aligned with the revision-1 texts of all seven
identifiers, published with core 0.2.0.
