# OpenBindings Conformance Corpus

Test fixtures and scenarios for what an OpenBindings document means, keyed to the rules of `openbindings.md` §10 and to the sections whose text answers each case.

The corpus is reference material, not part of the specification: the spec's prose is the sole source of meaning and conformance, where prose and corpus disagree the prose governs, and a rule without fixtures is no less binding. Being outside the specification, the corpus may speak of the software it exercises; what each case asserts is what a document means.

A document given as a JSON value (`document`) stands for its serialization as UTF-8 JSON text with no byte-order mark, each number at its exact value. Inputs that a JSON value cannot carry use `documentText` (exact Unicode text) or `documentBase64` (exact bytes).

## Status

The core files in `document/` and `scenarios/` test the current unreleased
sources text, including binding source references under OBI-07, source data,
binding data, contained schema references, and OBI-14. The manifest indexes
these cases. This is a qualification baseline, not a claim that any SDK passes it.

[draft checks](draft-checks/README.md) retains focused design checks. The
[Go adapter](runners/go/README.md) and its recorded failures are historical
evidence from an earlier model, restricted to their original corpus; they do
not qualify an implementation against this baseline. A current adapter must run
the complete manifest and report its actual results.
[SOURCE-MODEL-DRAFT.md](../SOURCE-MODEL-DRAFT.md) records the remaining
implementation and family-candidate work.

## Coverage

Each row names a rule of §10 or a section of `openbindings.md`, the files that cite it, and what they cover. `node scripts/verify-corpus.mjs` checks that every rule has a row, that every rule or section a file cites has one, and that each row lists exactly the files citing it; a rule row without files must be marked **Deferred**.

| Cited | Files | Coverage |
|---|---|---|
| 5 | `document/section-5.json` | Author claims. Each document carries a claim a plausibility heuristic would doubt (an `idempotent` claim either way, examples outside their contracts, and realization, consumption, and correspondence claims a description seems to contradict); whether a claim is true is outside conformance, so each document conforms. The fixtures concern the document only: whether a claim holds against a real target, consuming component, or shared contract is outside any document fixture. |
| 5.1 | `scenarios/5.1-names.json`, `scenarios/5.1-examples.json` | Which operation a string identifies: keys and aliases alike, exact strings only (case, white space, a trailing newline, prefixes, qualified segments), prototype-like names, `x-` keys, and the keys of other maps, which identify nothing; an operation's bindings are those whose `operation` holds its key, whatever their `deprecated`, `preference`, and `data`. What examples claim for each value: true, false, no claim where no schema is stated, undefined, and resting on a resource the document does not contain. |
| 5.2 | `scenarios/5.2-values.json` | Values against schemas under JSON Schema 2020-12: format annotations, pinned ECMA-262 Unicode regexes, recursion, exact numbers, supplied external schemas and dialects, no contract, and dependence on undefined or external results through applicators and annotations. Pointers into identified and nested relative resources preserve their bases. Malformed references within identified resources stay undefined. Former missing-target, ambiguous-name and document dynamic-anchor value scenarios now assert document nonconformance under OBI-12 or OBI-14. |
| 5.4 | `document/section-5.4.json` | A source's data is arbitrary JSON that the specification never reads as schemas. Schema-shaped values, dialects, IDs, duplicate anchors, dynamic anchors, malformed or dangling references and nested OBI documents in source data never enter the schema inventory or affect conformance. |
| 6 | `scenarios/6-kinds.json` | Whether a binding meets a `kinds` constraint, compared with the kind of the binding's source: kinds are exact strings, with no case folding, trimming, Unicode normalization, URI or URN normalization, decomposition, or inferred order; URI-shaped kinds are names, not addresses; the kind is read from the source the binding names, never from another source or from an extension on the binding; `kinds` is an any-of constraint, and without it a dependency places no constraint on kind. |
| 10 | `scenarios/10-conformance.json` | Whether a text conforms, beside the rule fixtures: the `version` field and an `x-openbindings` extension do not change the declared version, the patch number carries no meaning, a violating document violates the rules it breaks, and an escape that denotes an unpaired surrogate makes a text non-conformant. |
| OBI-01 | `document/OBI-01.json` | Complete. The fixture format's mutually exclusive `documentText` and `documentBase64` carriages preserve exact input text and bytes, covering malformed JSON (a truncation, a `NaN` literal, a trailing comma), malformed UTF-8, a leading UTF-8 BOM, and duplicate keys at root and nested positions, including a key that repeats another only once its escape is decoded (RFC 8259 §8.3), and escapes that denote unpaired surrogates in string values and member names, inside an embedded schema too, with a surrogate pair and an escaped noncharacter as positives, in addition to ordinary positives. A text that declares no version (§8.1, Version declaration: one that is not UTF-8, has a leading byte-order mark, does not parse as JSON, or repeats its `openbindings` member) is governed by these rules, whatever version it looks like it holds; an ill-formed byte anywhere in a text means it declares no version, so a text reading `0.3.0` with an ill-formed byte in another member violates OBI-01. A text that violates OBI-01 is non-conformant through it alone: OBI-02 to OBI-14 apply only to the JSON value of a text that meets OBI-01 (§10). |
| OBI-02 | `document/OBI-02.json` | Structural constraints and optional members of current OBI-defined objects. A binding requires `operation` and `source`; a source requires a non-empty string `kind`, and a missing, empty, or non-string kind violates OBI-02 alone, never OBI-07. Source data and binding data may be any JSON, including present `null`; a source's `description` is a string, and only the listed members and `x-` extensions are allowed. The removed root `resources` map and the removed binding `kind` and `content` members are unknown fields. `sources` must be a map of source objects whose keys follow the name grammar. Reference name syntax overlaps OBI-06, OBI-07, and OBI-08; an unfamiliar kind is valid, and a non-empty kind has no grammar. Preference covers type, both bounds and the spelling 1.0. |
| OBI-03 | `document/OBI-03.json` | Complete. An empty prerelease (`0.2.0-`) is not SemVer. Every positive declares a version on the 0.2 line, the only line with text. A missing, non-string, or non-SemVer member, one nested below the root, and a text that is not an object declare no version, so these rules govern them; a text declaring another line is governed by that line's text (§10), so the corpus has no case for it. |
| OBI-04 | `document/OBI-04.json` | Every map key category and aliases, including source keys. x- source keys are ordinary entries and obey the same grammar; names inside a source's data are unconstrained. Includes non-string aliases and names ending in a newline. |
| OBI-05 | `document/OBI-05.json` | Complete. A key repeated as another operation's alias, an alias shared by two operations or repeated within one, and an alias equal to its own key are negatives; names that differ only in case are distinct. |
| OBI-06 | `document/OBI-06.json` | Complete. A binding's `operation` matches only operation keys, not an alias or a key that differs only in case; a prototype-like name is a name like any other. |
| OBI-07 | `document/OBI-07.json` | Complete. A binding's `source` matches only source keys, not a key that differs only in case, and nothing when the document has no `sources` map; a prototype-like name is a name like any other, several bindings may name one source, and a source no binding names is permitted. |
| OBI-08 | `document/OBI-08.json` | Complete. A dependency's `operation` matches only operation keys, not an alias or a key that differs only in case; fixtures also cover repeated operation use across named dependencies, simultaneous binding and dependency relationships, and prototype-like key handling. |
| OBI-09 | `document/OBI-09.json` | Complete. Wrong `$schema` values at the top of a schema position, nested inside a schema that declares `$id`, and under the legacy `definitions` keyword are negatives; a `$schema` member in an example value or a source's data is data, and a 2020-12 `$schema` on a schema that declares no `$id` meets the rule. The near misses, the http scheme and a trailing slash, sit in nested schemas, where the derived schema does not express `$schema` and OBI-02 holds. |
| OBI-10 | `document/OBI-10.json` | Complete. Meta-schema validity for every operation input and output and every `schemas` entry (boolean or object form, recursively through subschemas, inside schemas that declare `$id` as well). Unknown keywords, unparseable patterns, unresolvable references, and in-place recursion are positives: what such a schema gives a value is for JSON Schema and §5.2 to say, not a rule. The pinned 2020-12 meta-schemas make the rule decidable offline, and cases where the 2019-09 meta-schema differs (the array form of `items`, an `$anchor` beginning with an underscore) tell them apart. Count keywords take integers by exact value, so `minLength: 1.0` is valid and `minLength: 1.5` is not. |
| OBI-11 | `document/OBI-11.json` | Complete. Relative `$ref`, `$dynamicRef`, and `$id` values at OBI positions (under `properties` and the legacy `definitions` keyword included) and strings that are not well-formed URI-references are negatives; same-document references, absolute URIs, everything inside a schema that declares `$id` (its own keywords other than `$id` included), and members named `$ref` or relative addresses inside source or binding data meet OBI-11. Document-resource dynamic anchors separately violate OBI-14. |
| OBI-12 | `document/OBI-12.json` | Same-document pointers and plain names must identify inventoried schemas. Pointers may enter identified and nested resources while preserving bases. References into any contained resource, including initial dynamic resolution, must identify a schema: missing pointers, maps, undeclared or repeated names fail. Absolute and relative resource references use exact OBI-13 identity; host-case and percent-encoding variants stay external. Source data and binding data never supply schemas or anchors, and a pointer into either identifies no schema. Malformed references within identified resources stay undefined. Document dynamic-anchor declarations separately violate OBI-14. |
| OBI-13 | `document/OBI-13.json` | Duplicate plain names in the document resource and duplicate comparable IDs, including empty fragments, dot segments and nested relative IDs. Exact host case and percent-encoding stay distinct. Malformed or uncompared IDs do not collide. Duplicate anchors in an identified resource do not violate OBI-13 and, without a reference to that name, do not violate OBI-12. Objects at schema positions count even if meta-schema-invalid. |
| OBI-14 | `document/OBI-14.json` | Document-resource dynamic anchors violate the rule in unused schemas entries and operation schemas, including malformed member values. Identified resources are permitted. Data under const, enum and unknown keywords, in extensions, binding data and source data is outside the schema inventory. |
| 12 | `document/section-12.json` | Extensions on OBI-defined objects leave the document conforming; an x- member named like a core field remains an extension. A member beginning X- is not an extension. Scenarios also show that extensions change no core meaning. |

Per-family protocol rules (`…-P-…`, e.g. `GRPC-P-04`, `CONN-P-06`) are each family's binding-specification obligations and live in the [`binding-specs/`](binding-specs/README.md) subcorpus rather than the core rule format. Its portable processor scenarios cover every P-rule of the six standalone brownfield synthesis families without prescribing an SDK configuration API. The repository verifier checks their shape and rule coverage; they become cross-implementation execution evidence only when family adapters run them against independent processors. The invocation-only Operation Graph binding has its own identity-law and execution corpus because its operation contracts come from the containing OBI rather than its source document. Mirrored reference-SDK behavioral suites remain additional implementation evidence, not a substitute for those portable scenarios.

[`reference-sdk-correspondence.json`](reference-sdk-correspondence.json) records the
public Go/TypeScript role and family-name correspondence used for the 0.2.0
implementation proof. It is intentionally not a language-neutral API mandate:
observable behavior at the OpenBindings boundary is shared, while casing,
goroutines versus promises/async iterables, cancellation plumbing, and other
non-boundary details remain idiomatic. The names stay close enough that a reader
moving between SDKs can identify the corresponding role without translation by
guesswork.

## Subcorpora

Two pre-kind candidate subcorpora live alongside the current core corpus, each with its own fixture format. Their verifiers check consistency against unpublished family candidates, not conformance of embedded or generated OBIs to the current core `kind` model. The core tooling below scans `document/` and `scenarios/`; the subcorpora have separate repository verifiers and execution harnesses:

| Subcorpus | Covers | Verifier |
|---|---|---|
| [`binding-specs/`](binding-specs/README.md) | Source rules (D-rules), portable processor scenarios covering every P-rule, and portable artifact-to-OBI synthesis accounting for the six standalone brownfield synthesis binding specifications: `openbindings.usage@1`, `openbindings.mcp@1`, `openbindings.grpc@1`, `openbindings.connect@1`, `openbindings.asyncapi@1`, `openbindings.graphql@1` | `node scripts/verify-binding-specs.mjs` (shape and coverage; family adapters execute behavior) |
| [`operation-graph/`](operation-graph/README.md) | `openbindings.operation-graph@1`: graph well-formedness rules, source rules, and replayable executions | `node scripts/verify-operation-graph.mjs` (+ reference runner) |

## Layout

```
conformance/
  README.md                     (this file)
  manifest.json                 (generated index: files, counts, and per-action counts)
  fixture.schema.json           (validity fixture format)
  scenario.schema.json          (scenario format @4)
  document/                     (validity fixtures)
    OBI-01.json ... OBI-14.json (one file per rule of section 10)
    section-5.json              (author claims)
    section-12.json             (extensions)
    section-5.4.json            (source data)
  scenarios/                    (scenarios, one file per section and topic)
    5.1-names.json
    5.1-examples.json
    5.2-values.json
    6-kinds.json
    10-conformance.json
  runners/
    go/                         (historical Go harness; see its status note)
  binding-specs/                (per-family D-rule fixtures and portable P-rule scenarios; own README + verifier)
  invocation-fidelity/          (per-family invocation-fidelity scenarios; checked by the binding-specs verifier)
  abstraction-fidelity/         (abstraction-alignment ledger, informative; checked by the binding-specs verifier)
  operation-graph/              (operation-graph subcorpus; own README + verifier)
  EVIDENCE-POLICY.md            (what conformance content is published, and what qualification evidence stays local)
```

`manifest.json` is regenerated by `node scripts/generate-conformance-manifest.mjs`. Drift between the corpus and the spec is detected by `node scripts/verify-corpus.mjs`, which checks that every fixture and scenario validates against its published JSON Schema, that every rule and section a file cites exists in `openbindings.md`, that the [coverage table](#coverage) matches the files' citations, and the semantic checks the script lists. `node scripts/test-verify-corpus.mjs` runs the verifier's negative controls. The verifier requires `ajv-cli`, which CI installs before running it.

## Fixture file format

Each fixture file cites either one rule of §10 or one section. A rule file is named after its rule (`document/OBI-01.json`), declares `rule` and `section` `"10"`, and quotes the rule's text as its description; a section file is named after its section (`document/section-12.json`) and declares `section` alone. Each test supplies exactly one input carriage and whether the text conforms.

```json
{
  "rule": "OBI-NN",
  "section": "10",
  "description": "The rule's text in section 10.",
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
      "violates": ["OBI-NN"]
    }
  ]
}
```

Field semantics:
- `rule` (rule files only): the identifier of the rule of §10 the file covers.
- `section`: `"10"` for a rule file; otherwise the number of the `openbindings.md` heading whose text answers the file's tests.
- `description`: the rule's or section's text, quoted or paraphrased.
- `tests[*].description`: human-readable description of what this specific case tests.
- `tests[*].document`, `tests[*].documentText`, or `tests[*].documentBase64`: exactly one input carriage. `document` embeds a parsed JSON value for ordinary cases. `documentText` preserves exact Unicode text for malformed-JSON and duplicate-key cases. `documentBase64` preserves exact bytes for encoding and BOM cases. A runner decodes the selected carriage and passes that input to the software under test without normalizing it first.
- `tests[*].valid`: `true` if the text conforms (it meets every rule of §10); `false` if it does not.
- `tests[*].violates` (optional, only with `valid: false`): rules the text violates. By convention, OBI-02 is not listed when a more specific rule already names the violation, even though the derived schema would also express it. **Semantics: minimum set.** The text violates at least the listed rules and may violate others; a runner never requires a report to be exactly the listed set.
- `tests[*].notViolated` (optional, only with `valid: false`): rules the text does not violate although it violates another, the mirror of `violates`: the rule holds, holds vacuously, or does not apply. For example, on a text that violates OBI-01, OBI-02 to OBI-14 apply only to the JSON value of a text that meets OBI-01 (§10). The two lists are disjoint.

Fixtures MAY include a file-level `notes` field (string) holding rationale about the file's coverage. It is informational and not consumed by harnesses.

A fixture test is identified by its file and position, `document/OBI-12.json#/tests/40`; a position, once published, keeps its test, and new tests are appended.

## Scenario format

What a document means beyond whether it conforms is tested by portable scenarios in format `openbindings.core-scenarios@4`, described by `scenario.schema.json`. Each file in `scenarios/` declares the `section` that answers its cases and is named after it (`5.2-values.json`). A scenario names an action, the given input, and what the document means for it. The format standardizes no SDK method, exception type, diagnostic text, validation library, or report serialization: an adapter translates its implementation's native surface to these inputs and outcomes.

Each scenario carries `id` (its file's prefix and a number, such as `VALUES-07`, unique in the corpus and never reused), `description` (what the document means, citing the section or rule that says so), `action`, `given`, and `expected`.

| Action | Section | Given | Expected |
|---|---|---|---|
| `resolve-operation` | §5.1 | `document`, `name` | `resolved` with `operationKey` and `bindingKeys` (the string identifies that operation, whose bindings those are), or `not-found` |
| `check-examples` | §5.1 | `document`, `operation` | per example and side the example supplies, the claim's truth: `true`, `false`, `undefined`, `external`, or `no-claim` |
| `validate-operation-values` | §5.2 | `document`, `operation`, `side`, `values`; optional `resources` | one result per value; optional `dependsOn` |
| `check-dependency-kind` | §5.5, §6 | `document`, `dependency`, `binding` | `meets` or `does-not-meet` |
| `validate-document` | §10 | exactly one of `document`, `documentText`, `documentBase64` | `conformant`, or `non-conformant` with optional `violates` (a minimum set); optional `dependsOn` |

**Value results.** A value result is one of:
- `satisfies` or `fails`: the value satisfies or fails the schema (§5.2);
- `undefined`: whether the value satisfies the schema is undefined, because its validity depends on an undefined result (§5.2, §7.4); where it also rests on a resource the case does not supply, only if it would be undefined whatever that resource holds;
- `external`: the result rests on a resource the document does not contain and the case does not supply, so the document alone does not settle it (§5.2);
- `no-schema`: `input` or `output` is absent, so no schema is stated, and the value neither satisfies nor fails one (§5.2);
- `{"result": ..., "orNoVerdict": true}`: that result, which software may also decline, because the schema holds an undefined or external part that this value's result does not depend on, and software that evaluates the whole schema may decline;
- `{"result": ..., "dependsOn": [...]}`: that result, with a per-value dependence that replaces the case's `dependsOn` (an empty array: this value depends on no feature).

**Example results.** `true` and `false` state the example's claim for a value (§5.1); `undefined` and `external` follow the value's result, as above; `no-claim` marks a value where no schema is stated.

**Supplied external schemas.** `given.resources` supplies schema documents for external references, each at its absolute URI; the expected results are what JSON Schema gives with them (§5.2), including the dialect JSON Schema assigns an external schema, and 2020-12 for a schema document whose root declares no `$schema`. This scenario input is separate from the document's `sources`, whose data is always ordinary data.

### Judging

The corpus states what the document means; a runner judges the software's answer against it. Why software could not answer is its own reporting and is not tested.

| Expected | Answer that passes | Otherwise |
|---|---|---|
| `satisfies` / `fails` | the same result; or a decline where the value carries `orNoVerdict`, or where a `dependsOn` feature of the case or value is one the software declares unsupported | a wrong result FAILs; a decline despite declared support is a SHORTFALL |
| `undefined` | any decline | a result FAILs |
| `external` | any decline (the corpus does not supply the resource) | a result FAILs |
| `no-schema` / `no-claim` | no result | a result FAILs |
| example claim `true` / `false` | the same claim truth | as `satisfies` / `fails` |
| fixture, `validate-document` | every rule in `violates` violated and none in `notViolated`; a conforming text concluded conformant, or (for `validate-document` only, since fixtures carry no `dependsOn`) declined under a `dependsOn` feature the software declares unsupported | a wrong conclusion FAILs; a decline on a non-conforming text FAILs; a decline on a conforming text despite declared support is a SHORTFALL |
| shared lookup `found` / `not-found` | the same outcome and, for `found`, the unchanged selected JSON value | another outcome, changed value, or decline FAILs |
| `resolved` / `not-found`, `meets` / `does-not-meet` | the same outcome | another outcome FAILs |

### Features

An adapter declares each feature the cases depend on as supported or unsupported. The list is the set of features this corpus's cases depend on, not every limitation software may have.

| Feature | Software that supports it |
|---|---|
| `recursive-references` | evaluates schemas whose references recurse |
| `supplied-resources` | accepts the schema documents a case offers in `resources` for external references |
| `ecma262-unicode-property-escapes` | matches `\p{...}` and `\P{...}` as the pinned ECMA-262 edition defines them |
| `repeated-member-detection` | detects repeated member names (OBI-01) |
| `draft-07-dialect` | evaluates a schema under the draft-07 dialect |
| `exact-numbers` | compares numbers at their exact decimal value |

### Run categories

A harness reports each case in exactly one category.

| Category | Meaning |
|---|---|
| pass | The answer is one the case allows, including a decline under a `dependsOn` feature the software declares unsupported. |
| FAIL | The answer is one the case forbids. |
| SHORTFALL | A decline where the software declares every feature the case depends on supported. The declaration is the software's own, so a harness holding software to it fails a SHORTFALL, as the Go adapter and the reference runner do. |
| OMITTED | Not administered, with the reason, such as an action the software does not implement. |

## Designated executors

Each action records its designated executor and, where one exists, its second executor; an action with none is single-executor.

| Action | Designated executor | Second executors |
|---|---|---|
| validity fixtures (`document/`) | Go core (`ValidateDocument`) | None published |
| `validate-document` | Go core (`ValidateDocument`) | None published |
| `resolve-operation` | Go core (`ResolveOperation` and `OperationBindings`) | None published |
| `validate-operation-values` | Go core with `schemaeval` (schemas) | None published |
| `check-dependency-kind` | Go core (the dependency's kind constraint) | None: single executor |
| `check-examples` | A composition of the Go core's value validation; the core has no example checker | None: single executor |

## Usage

A conformance test runner walks each validity fixture, passes the selected input carriage to the software under test, and compares its conclusion against `valid`. It separately walks the scenario files, invokes each case's action through an implementation adapter, and reports each case in one run category. For negative fixtures, where the software reports violated rules, a runner checks that the report includes every rule in `violates` (minimum-set semantics; other violations are never a defect) and none in `notViolated`. Every manifest case is executed or omitted with a stated reason.

## Versioning

The corpus tracks the spec version it was authored against: `openbindings.md` v0.2.0, a working draft until that version is released. Rule identifiers are cited under the 0.2 line (§10). Spec changes that affect meaning may require fixture and scenario updates, and the coverage table follows them.

## Coverage limits

This corpus does not replace the spec text. Where prose and corpus disagree, the prose governs. Known limits:

- **Rule-level reports are checked only where software gives them.** `violates` and `notViolated` bind software that reports violated rules; software that reports only a conclusion is judged by `valid` alone, and `notViolated` never forbids a rule the case does not list.
- **Author claims are tested against the document only.** The §5 fixtures cover plausibility heuristics over the document; whether a claim holds against a real target, consuming component, or shared contract is outside any document fixture.
- **Representative regular-expression divergences.** §5.2's ECMA-262 provision is tested through representative divergences between ECMA-262 with the `u` flag and other engines; others are not enumerated.
- **Representative fields.** The scenarios observe the fields an action reads; `description` and `tags` carry no meaning an action observes.

## Adding fixtures and scenarios

To add a validity case, append a test to the rule's or section's file in `document/`. To add a scenario, append it to the file for the section that answers it, with the next unused ID; add a file named after its section when no existing file fits, and extend `scenario.schema.json` only when no existing action can express the meaning, keeping actions semantic and implementation-neutral and recording the action's executors above. Update the [coverage table](#coverage) when a file's citation or coverage changes. After any change, regenerate `manifest.json` (`node scripts/generate-conformance-manifest.mjs`) and run `node scripts/verify-corpus.mjs`.

### Corpus identity in runner results

`scripts/check-runner-results.mjs` requires `corpusDigest` in both the observed
results and the expected failures, as well as the SDK `pin`. Use
`corpusCases(corpusDirectory).digest` from that script: SHA-256 over the sorted
paths of the manifest, both format schemas and every manifest-listed case file,
with each UTF-8 path, a NUL byte, the exact file bytes and another NUL byte.
This detects rewritten expectations even when case IDs and counts are unchanged.
The historical Go failure file deliberately has no current digest. No expected
failure set for the current corpus is asserted until an adapter actually runs it.
