# OpenBindings Conformance Corpus

Test fixtures for OpenBindings document and tool conformance, keyed to the rule identifiers defined in `openbindings.md` §10. The root document/tool corpus tests only the spec's normative rules.

The corpus is reference material, not part of the specification (per `openbindings.md` §10.1): the spec's prose is the sole source of conformance, where prose and corpus disagree the prose governs, and a rule without fixtures is no less binding.

## Status

**Document validity coverage is complete for OBI-D-02 through OBI-D-12, OBI-D-16 (same-document schema $ref integrity), OBI-D-17 (schema well-formedness), and OBI-D-18 (transform parse-validity); OBI-D-01 (JSON well-formedness) is partial because its negatives cannot be expressed in the inline fixture format, and OBI-D-13 (binding sufficiency) is partial by its per-family nature. OBI-T (tool behavior) coverage spans the parse/load-shaped rules (OBI-T-01, OBI-T-03, OBI-T-04); the remaining tool rules are deferred pending richer fixture formats or a second independent implementation (per-rule rationale below). See `manifest.json` for current counts.**

| Rule range | Coverage |
|---|---|
| OBI-D-01 | **Partial (positive-only).** Negative cases (malformed UTF-8, parser-rejected duplicate keys) cannot be expressed as inline JSON fixtures: the harness's own JSON parser would normalize or reject them before the document ever reached the validator, so they need raw-text or raw-byte fixtures outside this corpus's inline format (per the fixture's `notes`). Like OBI-D-13, it does not contribute to the manifest's `rulesCoveredDocument` count and is reported as `rulesPartialDocument` instead. |
| OBI-D-02 to OBI-D-12 | Complete |
| OBI-D-13 | **Partial (positive-only).** Binding sufficiency is a semantic property of how a tool resolves a `ref` against its source artifact. Negative cases (refs that need external registries / vendor catalogs / environment lookup to identify their target) cannot be expressed in the document-level fixture format without per-format harness logic. This rule shares OBI-T-06's testability limitation; it does not contribute to the manifest's `rulesCoveredDocument` count and is reported as `rulesPartialDocument` instead. |
| OBI-D-17 | Complete. Schema well-formedness at every schema position (boolean or object form, meta-schema-valid, recursively through subschemas), including the rule's deliberate narrowness: unknown keywords, unparseable `pattern` values, and unresolvable external `$ref`s are positives. Verifying tools need locally available 2020-12 meta-schemas; the rule itself forbids requiring a network fetch. |
| OBI-D-18 | Complete. Transform parse-validity (every value in `transforms`, every inline binding transform string, parses as JSONata 2.1 under the jsonata-js 2.1.1 tiebreak). Parse-only: expressions whose evaluation would fail are positives. Fixture expressions have parser-stable accept/reject status across known JSONata implementations; a validator without a JSONata parser leaves the rule unverified rather than failing documents (§10.2), and such a tool reports these fixtures unverifiable rather than passing/failing them. |
| OBI-T-01, OBI-T-03, OBI-T-04 | Complete (parse/load-shaped rules, same fixture format as OBI-D). OBI-T-04's downward refusal (documents below the tool's minimum supported version) is fixtured with the `requiresMinSupported` annotation (below), which skips those tests for tools whose supported range extends down to the document's version. |
| OBI-T-02, OBI-T-05 | **Deferred.** Diagnostic-emission rules (ignore unknown fields; surface diagnostics for uninterpreted schema keywords) that SHOULD warn. The spec deliberately leaves diagnostic shape tool-defined; pinning it via fixtures would extend the spec by convention. Fixtures pending a normative diagnostic-emission contract. |
| OBI-T-06 | **Deferred.** Applies to tools that resolve `ref` values per binding-format conventions. Conformance is per-format and depends on each format community's `ref` syntax; a portable corpus would need a per-format fixture set. |
| OBI-T-16 | **Deferred by doctrine.** Runtime-shaped: claim-triggered validation semantics (complete statically reachable schema graph, `format` as annotation, per value; graph unavailability reported distinctly from instance mismatch) need value + verdict-shaped fixtures, and a portable fixture format for runtime-shaped tool rules is designed only once a second independent implementation exists to keep the format from encoding one implementation's shape. The reference SDKs cover the behavior in-repo: both test the ERR_SCHEMA_UNRESOLVED vs ERR_VALIDATION_FAILED distinction behaviorally. |
| OBI-T-17 | **Deferred by doctrine.** Runtime-shaped: verification conclusions (conformant / non-conformant / undetermined under partial verification) need a conclusion-shaped outcome, not `valid: true|false`, and the fixture format awaits a second independent implementation, as with OBI-T-16. The reference SDKs test verification conclusions behaviorally in-repo. |
| OBI-T-10 | **Deferred as a rule-keyed core fixture; the rule's evaluation-agreement half is covered by the [`transforms/`](transforms/README.md) subcorpus.** `transforms/agree/` is the richer fixture shape once pending here — expression + transform input + expected outcome, with `undefined` distinct from a `null` value and error identity as a message substring — pinning the normative jsonata-js 2.1.1 outcomes (currently value- and undefined-result cases), and both reference SDK test suites run it as the cross-SDK parity gate. What remains deferred: that subcorpus is keyed to the §5.5 language pin, not to this rule identifier, and the core harness's `valid: true|false` document shape cannot express evaluate-and-compare, so no `tool/OBI-T-10.json` exists; and the closed evaluation environment (§5.5 clause 5) is not fixturable at all — no finite expression set can demonstrate the absence of host-reaching extensions. (Parse-validity of document transforms is OBI-D-18, covered above.) |
| OBI-T-11 | **Deferred.** MUST handle `$ref` cycles without infinite loops; the spec explicitly allows either successful resolution or terminating-with-error as conformant. The current `valid: true|false` shape can't express "either accept or reject is fine, but the tool must terminate." Pending either a format extension (`expected_termination: true`) or a harness convention separate from the fixture. |
| OBI-T-12 | **Deferred.** Operation-name resolution against the flat key+aliases namespace. Fixtures need a resolve-by-name scenario + the expected resolved operation (or a no-match outcome). Pending fixture format design. |
| OBI-B-01 to OBI-B-03 | **Not fixture-able.** These rules bind binding *specifications* — the semantic definitions sources name via `bindingSpec` — not documents or tool runs: there is no document to embed and no tool verdict to compare. Enforcement is editorial, at binding-specification promotion review (see `binding-specs/README.md`). |

Per-family protocol rules (`…-P-…`, e.g. `GRPC-P-04`, `CONN-P-06`) are each family's binding-specification obligations and live outside this corpus. The parity mechanism at this milestone is the mirrored cross-SDK behavioral conformance suites in the reference SDKs; a portable invocation-fixture corpus is deferred on the same second-implementation rationale as the runtime-shaped tool rules above.

## Subcorpora

Three subcorpora live alongside the core corpus, none governed by the `openbindings.md` §10 rule format; the core tooling below scans only `document/` and `tool/`. Two are per-family, governed by their family specification(s), each with its own verifier script; the third is keyed to the transform language pin of §5.5 and is gated by the reference SDK test suites rather than by a repo script:

| Subcorpus | Covers | Verifier |
|---|---|---|
| [`binding-specs/`](binding-specs/README.md) | Source rules (D-rules) of the six published binding specifications — `openbindings.usage@1`, `openbindings.openapi@1`, `openbindings.mcp@1`, `openbindings.grpc@1`, `openbindings.connect@1`, `openbindings.asyncapi@1` | `node scripts/verify-binding-specs.mjs` |
| [`operation-graph/`](operation-graph/README.md) | `openbindings.operation-graph@1` — graph well-formedness rules, source rules, and replayable executions | `node scripts/verify-operation-graph.mjs` (+ reference runner) |
| [`transforms/`](transforms/README.md) | Differential transform conformance for the §5.5 language pin — `agree/` pins normative jsonata-js 2.1.1 outcomes every conformant engine must reproduce (the cross-SDK parity gate); `known-divergence/` catalogs residual implementation-engine deviations | Both reference SDK test suites (located via `OB_SPEC_CORPUS`); no repo-local verifier |

## Layout

```
conformance/
  README.md            (this file)
  manifest.json        (auto-generated index of fixture files + counts)
  fixture.schema.json  (JSON Schema describing the fixture file format)
  document/            (OBI-D-## rules; one file per rule)
    OBI-D-01.json
    OBI-D-02.json
    ...
  tool/                (OBI-T-## rules; partial coverage)
    OBI-T-01.json
    OBI-T-03.json
    OBI-T-04.json
  runners/
    go/                (reference Go harness; exemplar for SDK authors)
  binding-specs/       (per-family D-rule subcorpus; own README + verifier)
  operation-graph/     (operation-graph subcorpus; own README + verifier)
  transforms/          (transform differential subcorpus; own README; gated in the SDK suites)
```

`manifest.json` is regenerated by `node ../scripts/generate-conformance-manifest.mjs`. Drift between the corpus and the spec is detected by `node ../scripts/verify-corpus.mjs`, which checks that every spec rule is either covered by a fixture or formally deferred in this README, and that all `violates` references resolve to real rules.

## Fixture file format

Each rule has one JSON file. The file declares the rule identifier, section reference, description, and an array of test cases. Each test case bundles an OBI document with the expected validity verdict.

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
- `tests[*].document`: an OBI document, embedded inline.
- `tests[*].valid`: `true` if the document satisfies the named rule, `false` if it violates the rule.
- `tests[*].violates` (optional, only meaningful when `valid: false`): the set of OBI-D-## or OBI-T-## rules the document is intended to test as violated. Lists the SEMANTIC rules being exercised. By convention, OBI-D-02 (schema validation) is NOT listed when a more specific rule already names the violation, even though the schema would also catch it via `propertyNames` patterns or similar enforcement. For example, a fixture with an invalid identifier pattern lists `["OBI-D-03"]` only, not `["OBI-D-03", "OBI-D-02"]`. OBI-D-02 appears in `violates` only for purely structural failures (missing required field, wrong value type) where no more specific semantic rule applies. **Semantics: minimum set.** For a negative fixture to pass, the tool's verdict is invalid and — where the tool reports violated rules at all — its report includes at least the listed rules. The spec defines no violation-reporting surface (diagnostic shape is deliberately tool-defined); this is harness semantics for consuming the corpus, not a conformance rule. Reporting a superset (additional rules also violated) is never a defect — it indicates the tool detected violations beyond the fixture's primary purpose — and because the OBI-D-02 suppression above is a fixture-authoring convention rather than a rule, a runner must not require the report to be exactly the listed set.

In addition, fixtures MAY include a file-level `notes` field (string) holding rationale text about the rule's coverage in the corpus — for example, why some test cases are intentionally out of format, or why a rule has positive-only coverage. The `notes` field is informational and not consumed by harnesses; it documents authoring intent for human reviewers.

## Usage

A conformance test runner walks each fixture file, applies the embedded `document` to a tool under test, and compares the tool's verdict against `valid`. For negative fixtures with `violates` declared, a runner MAY additionally verify that the tool's reported violations include the listed set — see the minimum-set semantics under "Field semantics" above (supersets are never a defect; exact-set checking is not a valid strictness).

## Versioning

The corpus tracks the spec version it was authored against. Spec changes that affect rule semantics may require fixture updates. The corpus is currently aligned with `openbindings.md` v0.2.0.

## Coverage limits

This corpus does not replace conformance interpretation by spec text. Where prose and corpus disagree, the prose governs. Some rules have inherent testability limits (notably the diagnostic-shape rules OBI-T-02/OBI-T-05, the per-format `ref` rule OBI-T-06, and the runtime-shaped rules OBI-T-10 through OBI-T-12, OBI-T-16, and OBI-T-17 — though OBI-T-10's evaluation-agreement half is covered by the `transforms/` subcorpus, per the rule table) and are documented as deferred until a richer fixture format exists — for the runtime-shaped rules, until a second independent implementation exists to design it against; gaps are noted per-rule above.

OBI-D-11 (example validation) fixtures depend on the tool under test having a JSON Schema 2020-12 validator wired into validation; tools without that capability will report mismatches on the negative cases. This is a capability gap in the tool under test — OBI-D-11 goes unverified for it, per the spec's partial-verification posture (§10.2) — not a corpus defect and not a conformance failure; runners should report such cases as unverifiable for that tool rather than as failures.

## Forward-compatibility annotation: `requiresMaxTested`

Some fixtures test forward-compatible behavior that is meaningful only when the SDK's `MaxTestedVersion` is at or above a particular SemVer. For example, "post-1.0 forward-compat: SDK supporting major 1 should accept same-major-higher-minor" cannot be evaluated against a pre-1.0 SDK without contradicting OBI-T-04, which mandates refusal of higher-major (and pre-1.0 higher-minor) versions.

Such test cases set `requiresMaxTested: "X.Y.Z"` on the test entry. A runner SHOULD skip the test when the SDK's `MaxTestedVersion` is lower than the value (i.e. when the SDK would correctly refuse the document via OBI-T-04 today). Skipped tests are NOT failures; they MUST be reported separately so the gap stays visible. The reference Go runner reports them as `(N skipped)` in the by-rule summary.

The mirror annotation `requiresMinSupported: "X.Y.Z"` marks downward-refusal tests (a document declaring a version below the tool's minimum MUST be refused, per §8.1): a runner SHOULD skip the test when the SDK's `MinSupportedVersion` is lower than the value, since such an SDK legitimately accepts the fixture's document. The same skip-and-report-separately handling applies.

## Adding fixtures

To add a test case for a covered rule, edit the rule's JSON file and append a test entry to `tests`. To add coverage for a new rule, create `document/OBI-D-XX.json` (or `tool/OBI-T-XX.json`) following the format above. After any addition or edit, regenerate `manifest.json` (`node ../scripts/generate-conformance-manifest.mjs`) and run `node ../scripts/verify-corpus.mjs` to confirm the corpus stays in sync with the spec.
