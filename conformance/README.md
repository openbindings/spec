# OpenBindings Conformance Corpus

Test fixtures for OpenBindings document and tool conformance, keyed to the rule identifiers defined in `openbindings.md` §10. The root document/tool corpus tests only the spec's normative rules.

The corpus is reference material, not part of the specification (per `openbindings.md` §10.1): the spec's prose is the sole source of conformance, where prose and corpus disagree the prose governs, and a rule without fixtures is no less binding.

## Status

**Document-validity coverage is complete for every OBI-D rule. Every tool rule, OBI-T-01 to OBI-T-11, is split into clauses in [`clauses.json`](clauses.json), and every clause carries a status that says what tests it ([Clause coverage](#clause-coverage)). Of the 60 obligation-type clauses, 50 are tested by discriminating cases the designated executor runs (a parent clause counts as tested when its alternatives or specializations are, or, where the tool's declaration selects one alternative, when the exercised one is), one through adapter code, and 9 hold a recorded status short of that: composition only (4), contrast tools only (2), expressible with no executor (2), not portably testable (1). Tool cases are portable scenarios in format `@2` (`scenarios/`), plus validity fixtures for OBI-T-03 and OBI-T-10 (`tool/`). See `manifest.json` for current counts, per file, per action, and per clause.**

| Rule range | Coverage |
|---|---|
| OBI-D-01 | Complete. The fixture format's mutually exclusive `documentText` and `documentBase64` carriages preserve exact input text/bytes, covering malformed JSON, malformed UTF-8, a leading UTF-8 BOM, and duplicate keys at root and nested positions in addition to ordinary positives. A text that violates OBI-D-01 is non-conformant through it alone, whatever the rest would violate (§10, "The document and its data"). |
| OBI-D-02 to OBI-D-09 | Complete. A non-string `aliases` entry violates OBI-D-03 as well as OBI-D-02; an unfamiliar kind string is valid (formerly `tool/OBI-T-01.json`). |
| OBI-D-10 | Complete. Meta-schema validity for every operation input and output and every `schemas` entry (boolean or object form, recursively through subschemas). Unknown keywords, unparseable patterns, unresolvable references, and in-place recursion are positives: whether a schema can be evaluated is JSON Schema's, not a document rule. The pinned 2020-12 meta-schemas make this document rule decidable offline. Count keywords take integers by exact value, so `minLength: 1.0` is valid. |
| OBI-D-11 | Complete. Dependency operation references resolve only against operation keys, not aliases; fixtures also cover repeated operation use across named dependencies, simultaneous binding and dependency relationships, and prototype-like key handling. |
| OBI-D-12 | Complete. Same-document references at OBI positions: typos, `#` and the empty reference, pointers to operation objects, maps, strings, `x-` data, source content, and example values, pointers inside an `$id` schema, and plain names that no schema in the document's resource declares (including one declared only inside an `$id` schema or in `x-` data) are negatives; declared plain names (by `$anchor` or `$dynamicAnchor`, percent-encoded or not), references within an `$id` resource, absolute URIs, `definitions` targets, and recursion are positives. A plain name declared only by an `$anchor` outside the JSON Schema name grammar, and a pointer to an operation input holding `null`, are negatives. |
| OBI-D-13 | Complete. Duplicate plain names in the document's resource (across `schemas` entries and operation schemas, or one schema declaring a name with both `$anchor` and `$dynamicAnchor`) and duplicate `$id` values (including an empty-fragment spelling and a nested relative `$id`) are negatives; the same name in different resources, a repeated malformed nested `$id`, and `$id` values that differ in host case are positives. An object at a schema position counts even when the meta-schemas reject it, so its `$anchor` collides with another entry's. |
| OBI-T-01 to OBI-T-11 | Per clause: see [Clause coverage](#clause-coverage). |

Per-family protocol rules (`…-P-…`, e.g. `GRPC-P-04`, `CONN-P-06`) are each family's binding-specification obligations and live in the [`binding-specs/`](binding-specs/README.md) subcorpus rather than the core rule format. Its portable processor scenarios cover every P-rule of the seven standalone brownfield synthesis families without prescribing an SDK configuration API. The repository verifier checks their shape and rule coverage; they become cross-implementation execution evidence only when family adapters run them against independent processors. The invocation-only Operation Graph binding has its own identity-law and execution corpus because its operation contracts come from the containing OBI rather than its source document. Mirrored reference-SDK behavioral suites remain additional implementation evidence, not a substitute for those portable scenarios.

[`reference-sdk-correspondence.json`](reference-sdk-correspondence.json) records the
public Go/TypeScript role and family-name correspondence used for the 0.2.0
implementation proof. It is intentionally not a language-neutral API mandate:
observable behavior at the OpenBindings boundary is shared, while casing,
goroutines versus promises/async iterables, cancellation plumbing, and other
non-boundary details remain idiomatic. The names stay close enough that a reader
moving between SDKs can identify the corresponding role without translation by
guesswork.

## Subcorpora

Two pre-kind candidate subcorpora live alongside the current core corpus, each with its own fixture format. Their verifiers check consistency against unpublished family candidates, not conformance of embedded or generated OBIs to the current core `kind` model. The core tooling below scans `document/`, `tool/` and `scenarios/`; the subcorpora have separate repository verifiers and execution harnesses:

| Subcorpus | Covers | Verifier |
|---|---|---|
| [`binding-specs/`](binding-specs/README.md) | Source rules (D-rules), portable processor scenarios covering every P-rule, and portable artifact-to-OBI synthesis accounting for the ten standalone brownfield synthesis binding specifications — `openbindings.usage@1`, `openbindings.openapi-2.0@1`, `openbindings.openapi-3.0@1`, `openbindings.openapi-3.1@1`, `openbindings.openapi-3.2@1`, `openbindings.mcp@1`, `openbindings.grpc@1`, `openbindings.connect@1`, `openbindings.asyncapi@1`, `openbindings.graphql@1` | `node scripts/verify-binding-specs.mjs` (shape and coverage; family adapters execute behavior) |
| [`operation-graph/`](operation-graph/README.md) | `openbindings.operation-graph@1` — graph well-formedness rules, source rules, and replayable executions | `node scripts/verify-operation-graph.mjs` (+ reference runner) |

## Layout

```
conformance/
  README.md                     (this file)
  manifest.json                 (generated index: files, counts, per-action and per-clause coverage)
  clauses.json                  (tool-rule clause inventory, clause statuses, and case identity records)
  fixture.schema.json           (validity fixture format)
  tool-scenario.schema.json     (tool scenario format @2)
  document/                     (OBI-D-## rules; one validity fixture file per rule)
    OBI-D-01.json ... OBI-D-13.json
  tool/                         (validity fixtures for tool rules a validity verdict can observe)
    OBI-T-03.json
    OBI-T-10.json
  scenarios/                    (tool scenarios, one file per rule)
    OBI-T-01.json ... OBI-T-09.json, OBI-T-11.json
  runners/
    go/                         (reference Go harness; exemplar for SDK authors)
  binding-specs/                (per-family D-rule fixtures and portable P-rule scenarios; own README + verifier)
  operation-graph/              (operation-graph subcorpus; own README + verifier)
```

`manifest.json` is regenerated by `node scripts/generate-conformance-manifest.mjs`. Drift between the corpus and the spec is detected by `node scripts/verify-corpus.mjs`, which checks that `clauses.json` partitions every tool rule's text, that the clause table below matches it, that every fixture and scenario validates against its published JSON Schema and passes the semantic checks the script lists, and that every rule and every clause status is accounted for. `node scripts/test-verify-corpus.mjs` runs the verifier's negative controls. The verifier requires `ajv-cli`, which CI installs before running it.

## Fixture file format

Each validity-fixtured rule has one JSON file. The file declares the rule identifier, section reference, description, and an array of test cases. Each test case supplies exactly one OBI input carriage with the expected validity verdict.

```json
{
  "rule": "OBI-D-XX",
  "section": "10.2",
  "description": "Brief rule description quoted or paraphrased from the spec.",
  "tests": [
    {
      "description": "specific scenario this test exercises",
      "document": { "openbindings": "0.2.0", "operations": {} },
      "valid": true
    },
    {
      "description": "specific violation",
      "document": { "openbindings": "0.2.0", "operations": {} },
      "valid": false,
      "violates": ["OBI-D-XX"]
    }
  ]
}
```

Field semantics:
- `rule`: the OBI-D-## or OBI-T-## identifier this fixture covers. Document fixtures live in `document/`, tool-rule fixtures in `tool/`.
- `section`: the spec section the rule is defined in (`10.2` for document rules; `10.3` for tool rules).
- `description`: human-readable description of what the rule says.
- `tests[*].description`: human-readable description of what this specific case tests.
- `tests[*].document`, `tests[*].documentText`, or `tests[*].documentBase64`: exactly one input carriage. `document` embeds parsed JSON for ordinary cases. `documentText` preserves exact Unicode text for malformed-JSON and duplicate-key cases. `documentBase64` preserves exact bytes for encoding and BOM cases. A runner decodes the selected carriage and passes that input to the tool without normalizing it first.
- `tests[*].valid`: `true` if the document conforms, so a validator establishes no violation; `false` if it does not.
- `tests[*].violates` (optional, only with `valid: false`): the document rules the document is intended to exercise as violated. It names document rules only: a tool rule is never a document violation. By convention, OBI-D-02 is not listed when a more specific rule already names the violation, even though the derived schema would also catch it. **Semantics: minimum set.** For a negative fixture to pass, the tool's verdict is invalid and, where the tool reports violated rules at all, its report includes at least the listed rules. The spec defines no violation-reporting surface; this is harness semantics for consuming the corpus, not a conformance rule. Reporting a superset is never a defect, and a runner must not require the report to be exactly the listed set.
- `tests[*].notViolated` (optional, only with `valid: false`): document rules a tool must not report violated, the mirror of `violates`. It records where a rule holds, holds vacuously, or does not govern the document although another rule is violated: for example, on a text that violates OBI-D-01, OBI-D-02 to OBI-D-13 impose no further requirement (§10, "The document and its data"). Where a tool reports violated rules at all, its report includes none of the listed rules; a tool that reports no rule-level evidence is judged by `valid` alone. Like `violates`, it is harness semantics, not a report shape, and it names document rules only. The two lists are disjoint.
- `tests[*].clauses` (tool fixtures only, required there): the tool-rule clauses the test exercises ([Clause IDs](#clause-ids)). Document fixtures are keyed by rule and carry no clause tags.
- `tests[*].requiresSupports`, `tests[*].requiresMinSupported` (optional): version gates ([Version gates](#version-gates)).

Fixtures MAY include a file-level `notes` field (string) holding rationale about the rule's coverage. It is informational and not consumed by harnesses.

A fixture test is identified by its file and position, `document/OBI-D-12.json#/tests/40`; a position, once published, keeps its test.

## Tool scenario format

Tool behavior that a validity verdict cannot observe is tested by portable scenarios in format `openbindings.core-tool-scenarios@2`, described by `tool-scenario.schema.json`, one file per rule in `scenarios/`. A scenario names an action, the given input, and the outcome the specification allows. The format standardizes no SDK method, exception type, diagnostic text, validation library, or report serialization: an adapter translates its implementation's native surface to these semantic inputs and outcomes.

Each scenario carries `id` (`T<rule>-S-<n>`, never reused), `clauses` (the clauses it tests, at least one of its file's rule), `description`, `action`, `given`, and `expected`, and may carry version gates.

| Action | Given | Expected |
|---|---|---|
| `check-dependency-kind` | `document`, `dependency`, `binding`; optional `retrievalSentinels` | `meets` or `does-not-meet` |
| `resolve-operation` | `document`, `name` | `resolved` with `operationKey` and `bindingKeys`, `not-found`, `version-refusal`, or an advisory `collision` |
| `validate-document` | exactly one of `document`, `documentText`, `documentBase64` | `version-refusal`, or an `outcome`: `conformant` (which also admits `conformance-undetermined`, a validator lacking evidence), `non-conformant` (with `violates`, a minimum set), `conformance-undetermined`, or `interpreted` (any conclusion, no refusal); optional `namesAppliedText` and `duplicateBlind` |
| `validate-operation-values` | `document`, `operation`, `side`, `values`; optional `resources` | one result per value, or `version-refusal`; optional `dependsOn` and `forbidReasons` |
| `conclude-conformance` | `evidence`, a map from document rules to `satisfied`, `violated`, `inconclusive`, or `not-applicable` | `conformant` (which also admits `conformance-undetermined`, as for `validate-document`: OBI-T-09 only prohibits), `non-conformant`, or `conformance-undetermined` |
| `check-examples` | `document`, `operation` | per example and side: `holds`, `false-claim`, `no-claim` (no contract stated), or `no-verdict` |
| `derive-form` | `document`, `operation`, `side`, `probes` | the schema's verdict on each probe; a tool claiming its derived form preserves the schema's meaning must agree on every probe |

**Value outcomes** are the specification's three: `valid`, `instance-mismatch`, and `no-verdict`. A value result is one of:
- a token: `no-verdict` is required of every tool (an absent contract, an undefined result); `valid` or `instance-mismatch` is expected of a tool that supports every feature the case depends on (no verdict there is a SHORTFALL), while a tool that declares one of them unsupported must give no verdict, a correct verdict included;
- `{"verdict": ..., "orNoVerdict": true}`: that verdict, or no verdict, for every tool, because the result does not depend on what may be missing and the rule prescribes no evaluation strategy;
- `{"verdict": ..., "dependsOn": [...]}`: a per-value dependence that replaces the scenario's `dependsOn` (an empty array: this value depends on no feature).

`forbidReasons` lists no-verdict reasons a tool must not report for the values, where it reports reasons at all (`no-contract`, `undefined-result`, `missing-reference`, `missing-capability`, `resource-limit`, `invalid-reference`). A reason is an observation, never a verdict.

**Capabilities.** An adapter declares each profile feature the cases depend on as supported or unsupported. The list is the set of features this corpus's cases depend on, not the set of limitations a conforming tool may have: resource limits and evaluation strategy remain the tool's (OBI-T-06 and OBI-T-08 notes).

| Feature | A tool that supports it |
|---|---|
| `recursive-references` | evaluates schemas whose references recurse |
| `document-resource-dynamic-scope` | puts the document resource's `$dynamicAnchor`s in the dynamic scope (§7.5) |
| `supplied-resources` | accepts the schema documents a case offers in `resources` for external references |
| `ecma262-unicode-property-escapes` | matches `\p{...}` and `\P{...}` as the pinned ECMA-262 edition defines them |
| `repeated-member-detection` | detects repeated member names (OBI-D-01) |
| `draft-07-dialect` | evaluates a schema under the draft-07 dialect |
| `exact-numbers` | compares numbers at their exact decimal value |

**Non-conformant documents.** `given.nonConformant` lists the document rules a scenario's document violates. Continuing with a non-conformant document is the tool's choice (§10.3), so a tool that does not continue omits the case and reports that reason.

**Collision groups.** A `collision` expectation (group `T07-G-01`) concerns a name that is one operation's key and another's alias, which OBI-D-04 forbids. It is advisory: the harness records which candidate a tool chooses and never fails it, because no finite set of documents tells key preference from a role-neutral choice that happens to pick key matches. OBI-T-07/c2 is recorded as not portably testable.

**`duplicateBlind`.** For a tool declaring `repeated-member-detection` unsupported, a case whose `openbindings` member is repeated states the outcome required for each value the tool's parser may read (OBI-T-04/c7).

**`namesAppliedText`.** The conclusion names exactly the applied-text identity the adapter declares for the document's line or prerelease, obtained independently of the report under test (OBI-T-09/c3). The harness compares the named identity first, always, then verifies the text it names: the named revision must be a full commit of the specification repository's history, and its `openbindings.md`, read from that history, must hash to the text the tool declares it applies. The text checked out beside the corpus, and the index, play no part, so an unrelated specification commit cannot change the result. A release named alone (OBI-T-09/c3a) is reported unverified until a verification against a release snapshot exists.

### Run categories

A harness reports each case in exactly one category.

| Category | Meaning |
|---|---|
| pass | The tool's outcome is one the case allows. |
| FAIL | The tool's outcome is one the case forbids: a violation. |
| SHORTFALL | No verdict where the tool's declared profile supports every feature the case depends on. OBI-T-08 permits it, so it is never a conformance violation; it counts against the profile. A harness holding an executor to its own declaration fails it, as the Go adapter and the reference runner do: the profile is the executor's own, so falling short of it is the executor's defect. |
| OMITTED | Not administered, with the reason: a version gate, an action the tool does not implement, continuation with a non-conformant document declined, or a resource limit the tool reports. |
| ADVISORY | Recorded and never failing (collision groups). |
| UNVERIFIED | A naming case whose applied text could not be verified against the bytes it names. Never a pass. |

### Version gates

Version acceptance follows §8.1: a document is read under its `major.minor` line, its patch number carries no meaning, build metadata is ignored, a prerelease is outside its line, and which lines and prereleases a tool supports is the tool's own declaration. Gates are SemVer 2.0.0 versions, judged against that declaration, never against the tool's acceptance or refusal code, so a defect in that code cannot gate its own tests out. A gated-out case is reported separately and is never a failure.

- `requiresSupports: "X.Y.Z"` administers the case only to tools whose declared support set includes X.Y.Z (a release whose line the tool declares, or a prerelease it declares it includes).
- `requiresUnsupported: "X.Y.Z"` (scenarios) administers it only to tools whose declared support set excludes X.Y.Z.
- `requiresMinSupported: "X.Y.Z"` administers it only to tools whose lowest supported version (the first release of the lowest declared line) is at least X.Y.Z; it marks downward refusals.

The verifier rejects gates that contradict each other by support unit (a version required both supported and unsupported) or that require a version below the case's required lowest supported version.

**Retired: `requiresMaxTested`.** Fixtures once gated acceptance-presuming positives on the SDK's tested range, a tested declaration rather than an acceptance declaration. Those positives moved to `requiresSupports`, and the forward-compatibility fixtures retired: across lines there is no forward-compatibility behavior to assert, and within a line the OBI-T-04 patch cases assert acceptance directly.

### Retired format @1 and migrated fixtures

The corpus once carried format `openbindings.core-tool-scenarios@1`, which admitted OBI-T-06 to OBI-T-09 only, with the outcome tokens `graph-unavailable` and `resolver-error` that the specification's vocabulary does not have. It is retired: every scenario file is `@2`, the cases it held keep their IDs, and the verifier rejects any other format. An implementation that needs to read both corpora while it migrates does so in its own adapter.

The corpus's earlier OBI-T-04 validity fixtures (`tool/OBI-T-04.json`) migrated to scenarios, where a version refusal is its own outcome instead of `violates: ["OBI-T-04"]`; the OBI-T-01 fixtures, which showed only that an unfamiliar kind is valid, moved to `document/OBI-D-02.json`. `clauses.json` records each migrated case's earlier identity (`caseIdentity.migrated`), and the verifier checks that each record points at a case that exists.

## Clause IDs

The specification numbers no clauses; the corpus does. A clause ID names one obligation, definition, permission, or incorporation inside a tool rule: `OBI-T-NN/cK`, with a letter for an alternative or specialization (`OBI-T-08/c6a`), `.pN` for a predicate of a definition (`OBI-T-04/c4.p1`), and `.iN` for an item another passage contributes by incorporation (`OBI-T-04/c9.i3`). The rules:

- **Ownership.** IDs are defined only in `clauses.json`, which partitions each rule's complete text into them; the verifier checks the partition against `openbindings.md`, so a change to a rule's text fails verification until the inventory follows it.
- **Line scope.** An ID is cited under the line the corpus tracks (0.2), as rule identifiers are (§10): another line may number its clauses differently.
- **Stability.** When a rule's wording changes and its obligation is preserved, the ID stays and its segment text follows the new wording (OBI-T-09/c2 and c3b after OBI-T-09's 0.2.0 working-draft revision).
- **Additions.** A new obligation takes the next unused number in its rule, so existing IDs never move (OBI-T-09/c4, added by that revision). A clause that splits keeps its number and gains letters.
- **Retirement.** An obligation the text drops has its ID listed in `retiredClauses` with the revision and reason. A retired ID is never defined again or reused, and a case that cites one fails verification.
- **Case IDs.** Scenario IDs follow the same discipline: a published ID is never reused, and a retired one is listed in `caseIdentity.retired`.

## Clause coverage

Each clause's status says what tests it, judged by observable behavior, never by labels:

| Status | Meaning |
|---|---|
| tested | A discriminating case that the designated executor runs; a deliberately wrong tool that violates the clause fails it while the executor passes. |
| tested (adapter) | As tested, but the executor's part is adapter code, not the implementation's own API. |
| tested through its alternatives | A parent obligation whose alternatives are each tested. |
| tested through its specializations | A parent obligation whose specializations are each tested. |
| tested through its exercised alternative | A parent obligation whose alternatives apply by the tool's declaration; the alternative the designated executor exercises is tested. |
| composition only | Cases run only through a composition of the executor's API; no implementation code of its own executes them. |
| contrast tools only | Cases are written out; no executor can run them, so only deliberately built contrast tools exercise them. |
| expressible, no executor | Cases are written out; no implementation executes them. |
| not portably testable | No finite set of cases tells a conforming tool from a violating one; the clause stays normative. |
| definition, permission, incorporation | Not coverage units. |

A clause whose status is short of tested is incomplete coverage, and is recorded as such. The verifier requires every clause whose status claims cases to have at least one, and every parent's status to rest on its children's. The cases citing each clause are listed in `manifest.json`.

| Clause | Class | Status | Notes |
|---|---|---|---|
| OBI-T-01/c1 | obligation | tested |  |
| OBI-T-01/c2a | specialization | tested |  |
| OBI-T-01/c2b | specialization | tested |  |
| OBI-T-01/c2c | specialization | tested |  |
| OBI-T-01/c3a | obligation | tested | Tested for the kinds constraint. A kind-support decision has no action in the corpus (no action selected). |
| OBI-T-01/c3b | obligation | tested | Tested where an inferred order changes an outcome; an inferred order that changes none is not testable. |
| OBI-T-01/c4 | obligation | tested | Observed for the whole action on the http channel, through a TCP listener bound to an ephemeral local port whose address the kind names (every accepted connection counts, whatever client made it), and on the file channel through a FIFO sentinel; other channels are not observed. |
| OBI-T-02/c1 | obligation | tested | Tested through the fields an action observes (version, a binding's operation, name). preference, deprecated, and content presence: no action selected. description and tags: not testable (no behavior). |
| OBI-T-02/c2 | specialization | tested |  |
| OBI-T-02/c3 | obligation | tested | For tools that continue with a document non-conformant under OBI-D-02. |
| OBI-T-03/c1 | obligation | tested |  |
| OBI-T-03/c2 | obligation | tested | Limited to the x- names the cases use. |
| OBI-T-04/c1 | obligation | tested through its alternatives |  |
| OBI-T-04/c1a | alternative | tested |  |
| OBI-T-04/c1b | alternative | tested | The default refusal is tested; interpreting an included prerelease (T04-S-28) runs on contrast tools only, since the Go core includes no prerelease. |
| OBI-T-04/c2 | obligation | tested |  |
| OBI-T-04/c3 | obligation | tested |  |
| OBI-T-04/c4 | definition | definition |  |
| OBI-T-04/c4.p1 | definition | definition |  |
| OBI-T-04/c4.p2 | definition | definition |  |
| OBI-T-04/c4.p3 | definition | definition |  |
| OBI-T-04/c4.p4 | definition | definition |  |
| OBI-T-04/c5 | definition | definition |  |
| OBI-T-04/c6 | obligation | tested |  |
| OBI-T-04/c7 | permission | permission | Exercised as latitude: T04-S-18 and T04-S-29 admit a duplicate-blind reading. |
| OBI-T-04/c8 | obligation | tested |  |
| OBI-T-04/c9 | incorporation | incorporation |  |
| OBI-T-04/c9.i1 | definition | definition |  |
| OBI-T-04/c9.i2 | specialization | contrast tools only | No executor in the Go core, which includes no prerelease. |
| OBI-T-04/c9.i3 | specialization | tested |  |
| OBI-T-04/c9.i4 | definition | definition |  |
| OBI-T-04/c9.i5 | permission | permission | Not testable: it grants latitude and requires nothing. |
| OBI-T-04/c9.i6 | definition | definition |  |
| OBI-T-05/c1 | obligation | expressible, no executor | Assertion keywords only: finite probes refute a preservation claim and never establish one. |
| OBI-T-06/c1 | obligation | tested through its alternatives |  |
| OBI-T-06/c1a | alternative | tested |  |
| OBI-T-06/c1b | alternative | tested |  |
| OBI-T-06/c2a | obligation | tested | Discriminated for the Go core through the verdict channel and the reasons it reports: it declares recursive references supported, so no verdict on a productive cycle (T06-S-01 to 04, 06) fails it, and those cases forbid the undefined-result reason. That reason is forbidden there because each cycle consumes the instance as it recurses: §7.4 and OBI-T-08's definition of an undefined result (OBI-T-08/c7, JSON Schema Core §9.4.1) make only a cycle that recurses without consuming any of the instance undefined. The invalid-reference reason itself is not observed: the Go core reports no such reason, so that part is incomplete coverage. A tool may declare recursive references unsupported. |
| OBI-T-06/c2b | obligation | tested |  |
| OBI-T-07/c1 | obligation | tested |  |
| OBI-T-07/c2 | specialization | not portably testable | T07-G-01 (T07-S-12, T07-S-14) is an advisory observation that never fails a tool. The Go core's resolving such a name to neither operation is its own policy. |
| OBI-T-07/c3 | obligation | tested |  |
| OBI-T-07/c4 | obligation | tested |  |
| OBI-T-08/c1 | obligation | tested |  |
| OBI-T-08/c2 | specialization | tested |  |
| OBI-T-08/c3a | specialization | tested | Representative divergences between ECMA-262 with the u flag and other engines: white space, digits, word characters and boundaries, the dot and line terminators, code points outside the Basic Multilingual Plane, escaped surrogate pairs, anchors, inline modifiers, identity escapes, and property escapes. Others are not enumerated. |
| OBI-T-08/c3b | specialization | tested |  |
| OBI-T-08/c4 | obligation | tested |  |
| OBI-T-08/c5 | obligation | tested (adapter) | Holds by construction for the Go core, whose value API takes one value per call; the executor's part a deliberately wrong tool can break is the harness's composition of those calls. |
| OBI-T-08/c6 | obligation | tested through its alternatives |  |
| OBI-T-08/c6a | alternative | tested |  |
| OBI-T-08/c6b | alternative | tested |  |
| OBI-T-08/c7 | alternative | tested |  |
| OBI-T-08/c8 | alternative | tested |  |
| OBI-T-08/c9 | obligation | tested |  |
| OBI-T-09/c1 | obligation | tested |  |
| OBI-T-09/c4 | obligation | tested |  |
| OBI-T-09/c2 | obligation | tested |  |
| OBI-T-09/c3 | obligation | tested through its exercised alternative | A tool names one kind of text; the Go core declares a working draft and its revision (c3c). |
| OBI-T-09/c3a | alternative | expressible, no executor | Applies to a tool that declares a patch release; none does before 0.2.0 is released. |
| OBI-T-09/c3b | alternative | contrast tools only | No executor in the Go core, which includes no prerelease. |
| OBI-T-09/c3c | alternative | tested | Credited only when the applied text is verified: the named identity is compared first, then the text at the named revision, read from the specification repository's history, against the hash the tool declares. |
| OBI-T-10/c1 | obligation | tested through its specializations |  |
| OBI-T-10/c1a | specialization | tested | The fixtures discriminate plausibility heuristics over the document only. |
| OBI-T-10/c1b | specialization | tested | The fixtures discriminate plausibility heuristics over the document only. |
| OBI-T-10/c1c | specialization | tested | The fixtures discriminate plausibility heuristics over the document only. |
| OBI-T-10/c1d | specialization | tested | The fixtures discriminate plausibility heuristics over the document only. |
| OBI-T-10/c1e | specialization | tested | The fixtures discriminate plausibility heuristics over the document only. |
| OBI-T-10/c1.i1 | definition | definition |  |
| OBI-T-10/c1.i2 | definition | definition |  |
| OBI-T-10/c1.i3 | definition | definition |  |
| OBI-T-10/c1.i4 | definition | definition |  |
| OBI-T-10/c1.i5 | definition | definition |  |
| OBI-T-10/c1.i6 | definition | definition |  |
| OBI-T-11/c1 | obligation | composition only | The Go core has no example checker; the cases run through a composition of its value validation. |
| OBI-T-11/c2a | specialization | composition only |  |
| OBI-T-11/c2b | specialization | composition only |  |
| OBI-T-11/c2c | specialization | composition only |  |

## Designated executors

The corpus README once required adapters for two independent implementations before a new action counted. Each action now records its designated executor and, where one exists, its second executor; an action with none is single-executor.

| Action | Designated executor | Second executors |
|---|---|---|
| validity fixtures (`document/`, `tool/`) | Go core (`ValidateDocument`) | Two implementations written from the text alone, in TypeScript and Python, through a harness that maps the action to their commands |
| `validate-document` | Go core (`ValidateDocument`) | As above |
| `resolve-operation` | Go core (`ResolveOperation` and `OperationBindings`) | As above |
| `validate-operation-values` | Go core with `schemaeval` (value contracts) | As above |
| `conclude-conformance` | Go core (`ConcludeConformance`) | As above |
| `check-dependency-kind` | Go core (the dependency's kind constraint) | None: single executor |
| `check-examples` | A composition of the Go core's value validation; the core has no example checker | None: single executor |
| `derive-form` | None: the Go core derives no forms | None |

## Usage

A conformance test runner walks each validity fixture, passes the selected input carriage to the tool under test, and compares the tool's verdict against `valid`, honoring the version gates. It separately walks the scenario files, invokes each case's action through an implementation adapter, and reports each case in one run category. For negative fixtures, where the tool reports violated rules, a runner checks that the report includes every rule in `violates` (minimum-set semantics; other violations are never a defect) and none in `notViolated`. Every manifest case is executed or omitted with a stated reason.

## Versioning

The corpus tracks the spec version it was authored against: `openbindings.md` v0.2.0, a working draft until that version is released. Spec changes that affect rule semantics may require fixture updates, and changes to a tool rule's text require the clause inventory to follow (above).

## Coverage limits

This corpus does not replace conformance interpretation by spec text. Where prose and corpus disagree, the prose governs. Known limits:

- **Rule-level reports are checked only where a tool gives them.** `violates` and `notViolated` bind a tool that reports violated rules; a tool that reports only a conclusion is judged by `valid` alone, and `notViolated` never forbids a rule the case does not list.
- **Plausibility heuristics only.** The OBI-T-10 fixtures discriminate heuristics over the document; a validator judging a claim against a real target, consuming component, or shared contract is outside any document fixture.
- **Observed channels.** OBI-T-01/c4 is observed on the http channel, through a TCP listener bound to an ephemeral local port for the action whose address the kind names (every accepted connection counts, whatever client made it), and on the file channel through a FIFO sentinel; other retrieval channels are not observed.
- **Representative regular-expression divergences.** OBI-T-08/c3a is tested through representative divergences between ECMA-262 with the `u` flag and other engines; others are not enumerated.
- **Reasons are observed where an executor reports them.** OBI-T-06/c2a's `invalid-reference` reason is not observed for the designated executor, which reports no such reason; the clause is discriminated through the verdict channel and the `undefined-result` reason.
- **Representative fields.** OBI-T-02/c1 covers every defined field; the cases test the fields an action observes.

## Adding fixtures and scenarios

To add a validity case, append a test to the rule's file (tool fixtures name their clauses). To add tool coverage, add a scenario to the rule's file in `scenarios/` with the next unused ID and the clauses it tests; extend `tool-scenario.schema.json` only when no existing action can express the behavior, keep actions semantic and implementation-neutral, and record the action's executors above. When a tool rule's text changes, update `clauses.json` and the clause table under the clause-ID rules. After any change, regenerate `manifest.json` (`node scripts/generate-conformance-manifest.mjs`) and run `node scripts/verify-corpus.mjs`.
