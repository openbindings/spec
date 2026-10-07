# OpenBindings Conformance Corpus

Test fixtures and scenarios for what an OpenBindings document means, keyed to the rules of `openbindings.md` §10 and to the sections whose text answers each case.

The corpus is reference material, not part of the specification: the spec's prose is the sole source of meaning and conformance, where prose and corpus disagree the prose governs, and a rule without fixtures is no less binding. Being outside the specification, the corpus may speak of the software it exercises; what each case asserts is what a document means.

A document given as a JSON value (`document`) stands for its serialization as UTF-8 JSON text with no byte-order mark, each number at its exact value. Inputs that a JSON value cannot carry use `documentText` (exact Unicode text) or `documentBase64` (exact bytes).

## Status

**Every rule of §10, OBI-01 to OBI-13, has a complete fixture file. Section-cited fixtures cover author claims (§5) and extensions (§12), and portable scenarios cover the meaning §5.1, §5.2, §6, and §10 define: which operation a string identifies, what examples claim, whether a value satisfies a value contract, whether a binding meets a kinds constraint, and whether a text conforms. See `manifest.json` for current counts, per file and per action.**

## Coverage

Each row names a rule of §10 or a section of `openbindings.md`, the files that cite it, and what they cover. `node scripts/verify-corpus.mjs` checks that every rule has a row, that every rule or section a file cites has one, and that each row lists exactly the files citing it; a rule row without files must be marked **Deferred**.

| Cited | Files | Coverage |
|---|---|---|
| 5 | `document/section-5.json` | Author claims. Each document carries a claim a plausibility heuristic would doubt (an `idempotent` claim either way, examples outside their contracts, and realization, consumption, and correspondence claims a description seems to contradict); whether a claim is true is outside conformance, so each document conforms. The fixtures concern the document only: whether a claim holds against a real target, consuming component, or shared contract is outside any document fixture. |
| 5.1 | `scenarios/5.1-names.json`, `scenarios/5.1-examples.json` | Which operation a string identifies: keys and aliases alike, exact strings only (case, white space, a trailing newline, prefixes, qualified segments), prototype-like names, `x-` keys, and the keys of other maps, which identify nothing; an operation's bindings are those whose `operation` holds its key, whatever their `deprecated`, `preference`, and `content`. What examples claim for each value: true, false, no claim where no contract is stated, undefined, and resting on a resource the document does not contain. |
| 5.2 | `scenarios/5.2-value-contracts.json` | Whether a value satisfies or fails a value contract under JSON Schema 2020-12: `format` as an annotation; `pattern` values and `patternProperties` names as ECMA-262 regular expressions with Unicode semantics, through representative divergences from other engines (white space, digits, word characters and boundaries, the dot and line terminators, code points outside the Basic Multilingual Plane, escaped surrogate pairs, anchors, inline modifiers, identity escapes, and property escapes); references resolved as §7 defines (same-document references, `$id` resources, the dynamic scope, supplied external resources and their dialect); recursion; exact numbers; each value separately. Undefined results (cycles that consume none of the instance, invalid patterns, and pointers reaching no schema, repeated plain names, and malformed references within an `$id` resource), results resting on a resource the document does not contain, and values where no contract is stated. |
| 6 | `scenarios/6-kinds.json` | Whether a binding meets a `kinds` constraint: kinds are exact strings, with no case folding, trimming, Unicode normalization, URI or URN normalization, decomposition, or inferred order; URI-shaped kinds are names, not addresses; `kinds` is an any-of constraint, and without it a dependency places no constraint on kind. |
| 10 | `scenarios/10-conformance.json` | Whether a text conforms, beside the rule fixtures: the `version` field and an `x-openbindings` extension do not change the declared version, the patch number carries no meaning, a violating document violates the rules it breaks, and an escaped lone surrogate is a string like any other. |
| OBI-01 | `document/OBI-01.json` | Complete. The fixture format's mutually exclusive `documentText` and `documentBase64` carriages preserve exact input text and bytes, covering malformed JSON (a truncation, a `NaN` literal, a trailing comma), malformed UTF-8, a leading UTF-8 BOM, and duplicate keys at root and nested positions, including a key that repeats another only once its escape is decoded (RFC 8259 §8.3), in addition to ordinary positives. A text that declares no version (§8.1, Version declaration: one that is not UTF-8, has a leading byte-order mark, does not parse as JSON, or repeats its `openbindings` member) is governed by these rules, whatever version it looks like it holds; an ill-formed byte anywhere in a text means it declares no version, so a text reading `0.3.0` with an ill-formed byte in another member violates OBI-01. A text that violates OBI-01 is non-conformant through it alone: OBI-02 to OBI-13 apply only to the JSON value of a text that meets OBI-01 (§10). |
| OBI-02 | `document/OBI-02.json` | Complete. Every constraint of the derived schema has a negative that breaks it alone (the name patterns in OBI-04's file), so a validator that drops any single constraint fails a case; the one constraint without a case, `additionalProperties: true` on the schema object form, restates JSON Schema's default. Every optional member of every OBI-defined object appears in a positive, and `preference` is covered at its type, both bounds, and the spelling `1.0`. A reference outside the name grammar violates OBI-02 beside OBI-06, OBI-07, or OBI-08, since the schema expresses the name syntax of the references those rules concern. An unfamiliar kind string is valid. |
| OBI-03 | `document/OBI-03.json` | Complete. An empty prerelease (`0.2.0-`) is not SemVer. Every positive declares a version on the 0.2 line, the only line with text. A missing, non-string, or non-SemVer member, one nested below the root, and a text that is not an object declare no version, so these rules govern them; a text declaring another line is governed by that line's text (§10), so the corpus has no case for it. |
| OBI-04 | `document/OBI-04.json` | Complete. Every kind of name has a negative: operation, dependency, binding, source, schema, and example keys, and aliases. A non-string `aliases` entry violates OBI-04 as well as OBI-02, and a key ending in a newline fails, as an ECMA-262 `$` requires. |
| OBI-05 | `document/OBI-05.json` | Complete. A key repeated as another operation's alias, an alias shared by two operations or repeated within one, and an alias equal to its own key are negatives; names that differ only in case are distinct. |
| OBI-06 | `document/OBI-06.json` | Complete. A binding's `operation` matches only operation keys, not an alias or a key that differs only in case; a prototype-like name is a name like any other. |
| OBI-07 | `document/OBI-07.json` | Complete. A binding's `source` matches only source keys; a key that differs only in case and a prototype-like name do not match. |
| OBI-08 | `document/OBI-08.json` | Complete. A dependency's `operation` matches only operation keys, not an alias or a key that differs only in case; fixtures also cover repeated operation use across named dependencies, simultaneous binding and dependency relationships, and prototype-like key handling. |
| OBI-09 | `document/OBI-09.json` | Complete. Wrong `$schema` values at the top of a schema position, nested inside a schema that declares `$id`, and under the legacy `definitions` keyword are negatives; a `$schema` member in an example value or in content is data. The near misses, the http scheme and a trailing slash, sit in nested schemas, where the derived schema does not express `$schema` and OBI-02 holds. |
| OBI-10 | `document/OBI-10.json` | Complete. Meta-schema validity for every operation input and output and every `schemas` entry (boolean or object form, recursively through subschemas, inside schemas that declare `$id` as well). Unknown keywords, unparseable patterns, unresolvable references, and in-place recursion are positives: what such a schema gives a value is for JSON Schema and §5.2 to say, not a rule. The pinned 2020-12 meta-schemas make the rule decidable offline, and cases where the 2019-09 meta-schema differs (the array form of `items`, an `$anchor` beginning with an underscore) tell them apart. Count keywords take integers by exact value, so `minLength: 1.0` is valid and `minLength: 1.5` is not. |
| OBI-11 | `document/OBI-11.json` | Complete. Relative `$ref`, `$dynamicRef`, and `$id` values at OBI positions (under `properties` and the legacy `definitions` keyword included) and strings that are not well-formed URI-references are negatives; same-document references, absolute URIs, everything inside a schema that declares `$id` (its own keywords other than `$id` included), and members named `$ref` or relative addresses inside content are positives. |
| OBI-12 | `document/OBI-12.json` | Complete. Same-document references at OBI positions: typos, `#` and the empty reference, pointers to operation objects, maps (including a `properties` map inside a schema), strings, extension values, source content, example values, and a schema-shaped `const` value, pointers inside an `$id` schema, and plain names that no schema in the document's resource declares (including one declared only inside an `$id` schema or in an extension's value) are negatives; declared plain names (by `$anchor` or `$dynamicAnchor`, percent-encoded or not, and named by `$ref` or `$dynamicRef` whichever keyword declares them), references within an `$id` resource, absolute URIs, `allOf` entries, `definitions` targets, pointers with the `~1` escape, and recursion are positives. A plain name declared only by an `$anchor` outside the JSON Schema name grammar, and a pointer to an operation input holding `null`, are negatives. |
| OBI-13 | `document/OBI-13.json` | Complete. Duplicate plain names in the document's resource (across `schemas` entries and operation schemas, or one schema declaring a name with both `$anchor` and `$dynamicAnchor`) and duplicate `$id` values (including an empty-fragment spelling and a nested relative `$id`) are negatives; the same name in different resources, a repeated malformed nested `$id`, `$id` values that differ in host case or only in percent-encoding, and a plain name declared twice inside a schema that declares `$id` (§7.4) are positives. An object at a schema position counts even when the meta-schemas reject it, so its `$anchor` collides with another entry's. |
| 12 | `document/section-12.json` | Extensions: `x-` fields on the root, operations, bindings, sources, and examples, and an `x-` member named like a core field, leave the document conforming; a member beginning `X-` is not an extension. Scenarios in the §5.1, §5.2, §6, and §10 files show that an extension changes no core field's meaning: an operation's identifiers, a binding's operation, a value contract, a `kinds` constraint, and the declared version. |

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
  scenario.schema.json          (scenario format @3)
  document/                     (validity fixtures)
    OBI-01.json ... OBI-13.json (one file per rule of section 10)
    section-5.json              (author claims)
    section-12.json             (extensions)
  scenarios/                    (scenarios, one file per section and topic)
    5.1-names.json
    5.1-examples.json
    5.2-value-contracts.json
    6-kinds.json
    10-conformance.json
  runners/
    go/                         (reference Go harness; exemplar for SDK authors)
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
- `tests[*].notViolated` (optional, only with `valid: false`): rules the text does not violate although it violates another, the mirror of `violates`: the rule holds, holds vacuously, or does not apply. For example, on a text that violates OBI-01, OBI-02 to OBI-13 apply only to the JSON value of a text that meets OBI-01 (§10). The two lists are disjoint.

Fixtures MAY include a file-level `notes` field (string) holding rationale about the file's coverage. It is informational and not consumed by harnesses.

A fixture test is identified by its file and position, `document/OBI-12.json#/tests/40`; a position, once published, keeps its test, and new tests are appended.

## Scenario format

What a document means beyond whether it conforms is tested by portable scenarios in format `openbindings.core-scenarios@3`, described by `scenario.schema.json`. Each file in `scenarios/` declares the `section` that answers its cases and is named after it (`5.2-value-contracts.json`). A scenario names an action, the given input, and what the document means for it. The format standardizes no SDK method, exception type, diagnostic text, validation library, or report serialization: an adapter translates its implementation's native surface to these inputs and outcomes.

Each scenario carries `id` (its file's prefix and a number, such as `VALUES-07`, unique in the corpus and never reused), `description` (what the document means, citing the section or rule that says so), `action`, `given`, and `expected`.

| Action | Section | Given | Expected |
|---|---|---|---|
| `resolve-operation` | §5.1 | `document`, `name` | `resolved` with `operationKey` and `bindingKeys` (the string identifies that operation, whose bindings those are), or `not-found` |
| `check-examples` | §5.1 | `document`, `operation` | per example and side the example supplies, the claim's truth: `true`, `false`, `undefined`, `external`, or `no-claim` |
| `validate-operation-values` | §5.2 | `document`, `operation`, `side`, `values`; optional `resources` | one result per value; optional `dependsOn` |
| `check-dependency-kind` | §5.5, §6 | `document`, `dependency`, `binding` | `meets` or `does-not-meet` |
| `validate-document` | §10 | exactly one of `document`, `documentText`, `documentBase64` | `conformant`, or `non-conformant` with optional `violates` (a minimum set); optional `dependsOn` |

**Value results.** A value result is one of:
- `satisfies` or `fails`: the value satisfies or fails the contract (§5.2);
- `undefined`: whether the value satisfies the contract is undefined, because its validity depends on an undefined result (§5.2, §7.4);
- `external`: the result rests on a resource the document does not contain and the case does not supply, so the document alone does not settle it (§5.2);
- `no-contract`: `input` or `output` is absent, so no contract is stated, and the value neither satisfies nor fails one (§5.2);
- `{"result": ..., "orNoVerdict": true}`: that result, which software may also decline, because the schema holds an undefined or external part that this value's result does not depend on, and software that evaluates the whole schema may decline;
- `{"result": ..., "dependsOn": [...]}`: that result, with a per-value dependence that replaces the case's `dependsOn` (an empty array: this value depends on no feature).

**Example results.** `true` and `false` state the example's claim for a value (§5.1); `undefined` and `external` follow the value's result, as above; `no-claim` marks a value where no contract is stated.

**Resources.** `resources` supplies schema documents for external references, each at its absolute URI; the expected results are what JSON Schema gives with them (§5.2), including the dialect JSON Schema assigns an external schema.

### Judging

The corpus states what the document means; a runner judges the software's answer against it. Why software could not answer is its own reporting and is not tested.

| Expected | Answer that passes | Otherwise |
|---|---|---|
| `satisfies` / `fails` | the same result; or a decline where the value carries `orNoVerdict`, or where a `dependsOn` feature of the case or value is one the software declares unsupported | a wrong result FAILs; a decline despite declared support is a SHORTFALL |
| `undefined` | any decline | a result FAILs |
| `external` | any decline (the corpus does not supply the resource) | a result FAILs |
| `no-contract` / `no-claim` | no result | a result FAILs |
| example claim `true` / `false` | the same claim truth | as `satisfies` / `fails` |
| fixture, `validate-document` | every rule in `violates` violated and none in `notViolated`; a conforming text concluded conformant, or (for `validate-document` only, since fixtures carry no `dependsOn`) declined under a `dependsOn` feature the software declares unsupported | a wrong conclusion FAILs; a decline on a non-conforming text FAILs; a decline on a conforming text despite declared support is a SHORTFALL |
| `resolved` / `not-found`, `meets` / `does-not-meet` | the same outcome | another outcome FAILs |

### Features

An adapter declares each feature the cases depend on as supported or unsupported. The list is the set of features this corpus's cases depend on, not every limitation software may have.

| Feature | Software that supports it |
|---|---|
| `recursive-references` | evaluates schemas whose references recurse |
| `document-resource-dynamic-scope` | puts the document resource's `$dynamicAnchor`s in the dynamic scope (§7.2, §7.5) |
| `supplied-resources` | accepts the schema documents a case offers in `resources` for external references |
| `ecma262-unicode-property-escapes` | matches `\p{...}` and `\P{...}` as the pinned ECMA-262 edition defines them |
| `repeated-member-detection` | detects repeated member names (OBI-01) |
| `draft-07-dialect` | evaluates a schema under the draft-07 dialect |
| `exact-numbers` | compares numbers at their exact decimal value |
| `exact-lone-surrogate-strings` | reads an escaped lone surrogate in a JSON string as the code unit it denotes (§5, RFC 8259 §8.2) |

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
| `validate-operation-values` | Go core with `schemaeval` (value contracts) | None published |
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
