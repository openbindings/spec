# OpenBindings Conformance Corpus

Test fixtures for OpenBindings document and tool conformance, keyed to the rule identifiers defined in `openbindings.md` §10. The root document/tool corpus tests only the spec's normative rules.

The corpus is reference material, not part of the specification (per `openbindings.md` §10.1): the spec's prose is the sole source of conformance, where prose and corpus disagree the prose governs, and a rule without fixtures is no less binding.

## Status

**Document-validity coverage is complete for every OBI-D rule. Tool coverage includes validity fixtures for OBI-T-01, OBI-T-03, OBI-T-04, and OBI-T-10, plus portable action/outcome scenarios for OBI-T-06, OBI-T-07, OBI-T-08, and OBI-T-09. Go and TypeScript adapters exist, but their conformance to the revised value-validation cases requires a separate implementation check. OBI-T-01 fixtures show that unknown kinds do not invalidate an OBI; exact support comparison and implicit dereferencing need behavioral tests. OBI-T-11 is deferred until the scenario format can exercise example checking. See `manifest.json` for current counts.**

| Rule range | Coverage |
|---|---|
| OBI-D-01 | Complete. The fixture format's mutually exclusive `documentText` and `documentBase64` carriages preserve exact input text/bytes, covering malformed JSON, malformed UTF-8, a leading UTF-8 BOM, and duplicate keys at root and nested positions in addition to ordinary positives. |
| OBI-D-02 to OBI-D-09 | Complete |
| OBI-D-10 | Complete. Meta-schema validity for every operation input and output and every `schemas` entry (boolean or object form, recursively through subschemas). Unknown keywords, unparseable patterns, unresolvable references, and in-place recursion are positives: whether a schema can be evaluated is JSON Schema's, not a document rule. The pinned 2020-12 meta-schemas make this document rule decidable offline. |
| OBI-D-11 | Complete. Dependency operation references resolve only against operation keys, not aliases; fixtures also cover repeated operation use across named dependencies, simultaneous binding and dependency relationships, and prototype-like key handling. |
| OBI-D-12 | Complete. Same-document references at OBI positions: typos, `#` and the empty reference, pointers to operation objects, maps, strings, `x-` data, source content, and example values, pointers inside an `$id` schema, and plain names that no schema in the document's resource declares (including one declared only inside an `$id` schema or in `x-` data) are negatives; declared plain names (by `$anchor` or `$dynamicAnchor`, percent-encoded or not), references within an `$id` resource, absolute URIs, `definitions` targets, and recursion are positives. |
| OBI-D-13 | Complete. Duplicate plain names in the document's resource (across `schemas` entries and operation schemas, or one schema declaring a name with both `$anchor` and `$dynamicAnchor`) and duplicate `$id` values (including an empty-fragment spelling and a nested relative `$id`) are negatives; the same name in different resources, a repeated malformed nested `$id`, and `$id` values that differ in host case are positives. |
| OBI-T-01 | Partial. Validity fixtures show that an unknown kind does not create a core document defect. Exact support comparison and no implicit kind dereferencing need a behavioral scenario; this fixture format cannot observe them. |
| OBI-T-03, OBI-T-04 | Complete (parse/load-shaped rules, same fixture format as OBI-D). OBI-T-04's downward refusal (documents below the tool's minimum supported version) is fixtured with the `requiresMinSupported` annotation (below), which skips those tests for tools whose supported range extends down to the document's version. Its acceptance-presuming positives are gated with the `requiresSupports` annotation (below): each is administered only to tools whose own OBI-T-04 acceptance predicate accepts the annotation's version, since which versions a tool accepts is its own support declaration (§8.1), never a corpus assumption. |
| OBI-T-10 | Partial. All-positive documents whose operation names tempt plausibility heuristics show that apparent inaccuracy of a binding's `idempotent` claim does not create a core document defect. The rule covers every author claim (examples, realization, correspondence); the other claims have no rule-keyed fixture, since a validity fixture cannot distinguish a tool that would report them. |
| OBI-T-11 | **Deferred.** The rule governs how a tool that checks examples treats a mismatch, which this corpus's scenario actions do not yet exercise. Examples are author claims (§5.1), not a document rule, so no validity fixture can discriminate it. |
| OBI-T-02, OBI-T-05 | **Deferred.** A tool gives each defined field its defined meaning, presence included, and unknown fields no core meaning, and it must not claim fidelity when unsupported semantics could change its derived form. These claims need behavioral scenarios; neither rule prescribes diagnostic text or serialization. |
| OBI-T-08 | Portable scenarios distinguish success from instance mismatch; treat embedded 2020-12 `format` as annotation; apply schemas per value; and recognize an absolute `$ref` satisfied by an embedded `$id`. A value whose schema holds an external reference it never needs, in a dormant branch or an unused definition, is not given a fixed outcome here: a tool may establish its result or report that it could not validate it, since the rule prescribes no evaluation strategy. The scenario format defines normalized inputs/outcomes, not an SDK API or error serialization. Both adapters need execution against the revised cases. |
| OBI-T-09 | Portable scenarios exercise the truth condition for a claimed overall conformance verdict. `conclusion` is a corpus-normalized outcome; rule-level report lists are no longer tested because the specification does not require a report format. That a conclusion names the patch release whose text it applied is not exercised, since the scenario format has no report member to carry it. |
| OBI-T-06 | Portable scenarios use finite values under productive recursive schemas. A tool that evaluates them must preserve their JSON Schema meaning; a tool may instead report that it cannot evaluate them under its capabilities or resource limits. The rule does not prescribe termination strategy. |
| OBI-T-07 | Complete through portable tool scenarios, independently executed by the Go and TypeScript adapters. Cases cover direct keys, aliases resolving to the canonical key and its bindings, unknown identifiers, a prototype-like unknown name, and an operation actually carrying that name. |

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
  README.md            (this file)
  manifest.json        (auto-generated index of fixture files + counts)
  fixture.schema.json  (JSON Schema describing the fixture file format)
  tool-scenario.schema.json (schema for portable core tool scenarios)
  document/            (OBI-D-## rules; one file per rule)
    OBI-D-01.json
    OBI-D-02.json
    ...
    OBI-D-13.json
  tool/                (OBI-T-## rules; partial coverage)
    OBI-T-01.json
    OBI-T-03.json
    OBI-T-04.json
    OBI-T-10.json
  scenarios/           (action/outcome cases that do not fit validity)
    OBI-T-06.json
    OBI-T-07.json
    OBI-T-08.json
    OBI-T-09.json
  runners/
    go/                (reference Go harness; exemplar for SDK authors)
  binding-specs/       (per-family D-rule fixtures and portable P-rule scenarios; own README + verifier)
  operation-graph/     (operation-graph subcorpus; own README + verifier)
```

`manifest.json` is regenerated by `node ../scripts/generate-conformance-manifest.mjs`. Drift between the corpus and the spec is detected by `node ../scripts/verify-corpus.mjs`, which validates every core fixture and scenario against its published JSON Schema, applies action-specific semantic checks, checks that every spec rule is covered by a fixture or scenario or formally deferred in this README, and verifies that all rule references resolve. The verifier requires `ajv-cli`, which CI installs before running it.

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
- `rule`: the OBI-D-## or OBI-T-## identifier this fixture covers.
- `section`: the spec section the rule is defined in (`10.2` for document rules; `10.3` for tool rules).
- `description`: human-readable description of what the rule says.
- `tests[*].description`: human-readable description of what this specific case tests.
- `tests[*].document`, `tests[*].documentText`, or `tests[*].documentBase64`: exactly one input carriage. `document` embeds parsed JSON for ordinary cases. `documentText` preserves exact Unicode text for malformed-JSON and duplicate-key cases. `documentBase64` preserves exact bytes for encoding and BOM cases. A runner decodes the selected carriage and passes that input to the tool without normalizing it first.
- `tests[*].valid`: `true` if the document satisfies the named rule, `false` if it violates the rule.
- `tests[*].violates` (optional, only meaningful when `valid: false`): the set of OBI-D-## or OBI-T-## rules the document is intended to test as violated. Lists the SEMANTIC rules being exercised. By convention, OBI-D-02 (schema validation) is NOT listed when a more specific rule already names the violation, even though the schema would also catch it via `propertyNames` patterns or similar enforcement. For example, a fixture with an invalid identifier pattern lists `["OBI-D-03"]` only, not `["OBI-D-03", "OBI-D-02"]`. OBI-D-02 appears in `violates` only for purely structural failures (missing required field, wrong value type) where no more specific semantic rule applies. **Semantics: minimum set.** For a negative fixture to pass, the tool's verdict is invalid and — where the tool reports violated rules at all — its report includes at least the listed rules. The spec defines no violation-reporting surface (diagnostic shape is deliberately tool-defined); this is harness semantics for consuming the corpus, not a conformance rule. Reporting a superset (additional rules also violated) is never a defect — it indicates the tool detected violations beyond the fixture's primary purpose — and because the OBI-D-02 suppression above is a fixture-authoring convention rather than a rule, a runner must not require the report to be exactly the listed set.

In addition, fixtures MAY include a file-level `notes` field (string) holding rationale text about the rule's coverage in the corpus — for example, why some test cases are intentionally out of format, or why a rule has positive-only coverage. The `notes` field is informational and not consumed by harnesses; it documents authoring intent for human reviewers.

## Portable tool scenario format

Rules whose behavior is an action plus a semantic outcome rather than document validity use `openbindings.core-tool-scenarios@1`, described by `tool-scenario.schema.json`. These files live in `scenarios/` and remain reference material under the same prose-governs rule as validity fixtures.

| Action | Portable input and outcome |
|---|---|
| `resolve-schema-cycle` | Document, operation side, and finite value; checks the validation meaning of a productive recursive schema. |
| `resolve-operation` | Document and identifier; expects the canonical operation key plus its binding keys, or not-found. |
| `validate-operation-values` | Document, operation side, and JSON values; expects one of `valid`, `instance-mismatch`, or `graph-unavailable` for each value. The last token is corpus shorthand for a needed resource or capability being unavailable; it is not a required SDK term. |
| `conclude-conformance` | Rule-evidence map; expects only the semantic conclusion under OBI-T-09. |

The format does not standardize a public SDK method, exception type, diagnostic text, validation library, or report serialization. An adapter translates its implementation's native surface to these semantic inputs and outcomes. That boundary is deliberate: the corpus tests what the specification makes portable without turning either reference SDK's API into an undeclared part of the specification.

## Usage

A conformance test runner walks each validity fixture, passes the selected input carriage to the tool under test, and compares the tool's verdict against `valid`. It separately walks portable scenario files, invokes the named semantic action through an implementation adapter, and compares the normalized outcome. For negative fixtures with `violates` declared, a runner MAY additionally verify that the tool's reported violations include the listed set — see the minimum-set semantics under "Field semantics" above (supersets are never a defect; exact-set checking is not a valid strictness).

## Versioning

The corpus tracks the spec version it was authored against. Spec changes that affect rule semantics may require fixture updates. The corpus is currently aligned with `openbindings.md` v0.2.0.

## Coverage limits

This corpus does not replace conformance interpretation by spec text. Where prose and corpus disagree, the prose governs. Some rules have inherent testability limits: OBI-T-02/OBI-T-05 leave diagnostic shape tool-defined, and OBI-T-11 awaits a scenario action for checking examples. Gaps are noted per rule above.

## Version-gating annotations

Version acceptance follows §8.1: a document is read under its `major.minor` line, its patch number carries no meaning, and which lines a tool supports is the tool's own declaration ("Supporting one line implies nothing about another"). Two annotations follow from that, and a retired third is recorded below so its absence reads as a decision.

The acceptance gate `requiresSupports: "X.Y.Z"` administers a test only to tools that support the line of X.Y.Z, as their OBI-T-04 acceptance predicate reports; otherwise the runner skips it, reporting the skip separately (skips are never failures). For the reference SDKs that predicate is `IsSupportedVersion` (Go) / `isSupportedVersion` (TS). It exists because a tool's supported lines and its tested range are **distinct declarations**. A positive that presumes acceptance can neither be universalized, since a conformant tool may support other lines entirely, nor keyed to a tested range: the reference SDKs have tested 0.2.0, yet they support the 0.2 line and must accept 0.2.1 and later patches of it, which the OBI-T-04 patch cases assert.

**Retired: `requiresMaxTested`.** Fixtures once gated acceptance-presuming positives on the SDK's `MaxTestedVersion`, and one fixture asserted that a post-1.0 tool "should accept" a same-major-higher-minor document. Both encoded the cross-version inference §8.1 disclaims: `MaxTestedVersion` is a *tested* declaration, not an *acceptance* declaration, so gating acceptance on it is a category error — exactly the argument the `requiresSupports` paragraph above makes, which had not been applied to these cases. The gated positives moved to `requiresSupports`, and the forward-compatibility fixtures retired rather than being re-gated: under §8.1, where a tool declares the lines it supports, re-gating "a tool supporting major 1 accepts 1.5.0" with `requiresSupports: "1.5.0"` reduces it to "a tool that accepts 1.5.0 accepts 1.5.0". Across lines there is no forward-compatibility behavior to assert; within a line, §8.1 makes patches carry no meaning, and the OBI-T-04 patch cases assert that acceptance directly. The annotation is gone from `fixture.schema.json` and from the operation-graph validation schema.

The annotation `requiresMinSupported: "X.Y.Z"` marks downward-refusal tests (a document declaring a version below the tool's minimum MUST be refused, per §8.1): a runner SHOULD skip the test when the lowest version the tool supports is lower than the value, since such a tool legitimately accepts the fixture's document. The same skip-and-report-separately handling applies.

## Adding fixtures

To add a validity case, edit the rule's JSON file and append a test entry to `tests`. To add validity coverage for a new rule, create `document/OBI-D-XX.json` (or `tool/OBI-T-XX.json`). To add an action/outcome rule, first extend `tool-scenario.schema.json` only when validity cannot express the behavior, then create `scenarios/OBI-T-XX.json` and adapters for at least two independent implementations. Keep actions semantic and implementation-neutral. After any addition or edit, regenerate `manifest.json` (`node ../scripts/generate-conformance-manifest.mjs`) and run `node ../scripts/verify-corpus.mjs`.
