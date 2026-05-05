# OB-2020-12 Subsumption Profile

**Profile:** OB-2020-12 (v1)
**Companion to:** comparison convention v1
**Applies to:** the official OpenBindings tooling — `ob` CLI, `openbindings-go`, `openbindings-ts`

This document specifies how the official tooling decides whether one JSON Schema 2020-12 schema **subsumes** another in a given direction. It is the rule-by-rule companion to `comparison.md`.

The profile is **non-normative**. Third-party tools may publish their own profiles (`OB-2020-12-strict`, `Acme-Schema-Compat-1.0`, etc.) and remain fully spec-conformant. The official tooling exposes the profile name in every report's header (`profile: OB-2020-12@<corpus-sha>`) so consumers always know which profile produced a verdict.

## 1. Subsumption, formally

A schema `S` **subsumes** a schema `T` (written `T ⊆ S`) when every JSON value that validates against `T` also validates against `S`. The "smaller" type is `T`; the "larger" is `S`.

Comparison directions:

- **Output (covariant)**: for `R` to satisfy `L`'s output contract, R's output must be ⊆ L's output. ("R returns no surprises beyond what L promised.")
- **Input (contravariant)**: for `R` to satisfy `L`'s input contract, R's input must be ⊇ L's input. ("R accepts everything L promised to accept.")

Verdict states (per schema position) are defined in `comparison.md` §8. The profile decides which verdict applies.

## 2. The decidability boundary

Subsumption over JSON Schema 2020-12 is undecidable in general (regular-expression containment alone is PSPACE-complete; combined with `not`, the full problem is undecidable). The profile is a **sound and incomplete** approximation: when it returns `compatible` or `incompatible`, the verdict is correct. When the profile cannot decide, it returns `unverified`.

The `unverified` verdict is a first-class outcome, not a failure. CI gates choose whether to treat it as a pass or fail via `--strict-undecidable`.

The cases that produce `unverified` are enumerated through this document. Implementations MUST NOT extend the set silently — adding new `unverified` returns is a profile-version bump.

## 3. Schema normalization

Before comparison, both schemas pass through normalization. Normalized schemas are compared structurally; canonicalization is an implementation detail invisible to the verdict.

Normalization steps, applied in order:

1. **Boolean schemas** `true` and `false` are kept as-is. `true` is the universal schema (subsumes everything; subsumed by nothing except itself). `false` is the empty schema (subsumes nothing except itself; subsumed by everything).
2. **`additionalProperties: true`** is treated as **identical** to absence of `additionalProperties`. (JSON Schema 2020-12 spec: `additionalProperties` defaults to "all properties allowed.") The byte-difference is suppressed for `verdict: identical` purposes; it is a rendering choice, not a semantic one.
3. **`enum` of length 1** is normalized to `const`. `const: "x"` is treated as **identical** to `enum: ["x"]`.
4. **`type: ["X"]`** is normalized to `type: "X"` (single-element type array becomes scalar). `type: []` is invalid (not normalized; reported as `profile.schema.invalid_type_array`).
5. **Annotation-only keywords** (`title`, `description`, `default`, `examples`, `$comment`, `readOnly`, `writeOnly`, `deprecated`) are stripped before structural comparison. Their changes appear as `metadata.changed` and `field.deprecated.changed` findings with `category: structural` or `non_breaking`.
6. **`$ref` resolution** uses the original-document-relative form; refs are not inlined. (See §11.)
7. **Key ordering** is canonicalized via RFC 8785 (JCS) ordering for byte-identical comparison. Logical comparison is unaffected.

## 4. Type-level rules

JSON Schema 2020-12 `type` is either a string or array of strings from `{"null","boolean","object","array","number","integer","string"}`.

Let `types(S)` be the set of allowed types.

- **Output (covariant)**: `R` subsumes `L` ⟺ `types(R) ⊆ types(L)`. Example: L allows `string`, R allows `string` only — compatible. R allows `string|null`, L allows `string` — incompatible (R returns nulls L didn't promise).
- **Input (contravariant)**: `R` subsumes `L` ⟺ `types(R) ⊇ types(L)`. Example: L accepts `string`, R accepts `string|number` — compatible. R accepts `string` only, L accepts `string|number` — incompatible (R rejects numbers L promised to accept).

Special cases:

- **`integer` vs `number`**: every integer is a number. `integer ⊆ number`. So in output direction, R requiring integer is compatible with L promising number; R promising number is incompatible with L requiring integer.
- **Type narrowed to single from array**: `["string","null"]` → `"string"` is a covariance violation in output (reported as `type.set.narrowed`), contravariance violation in input (same slug; direction is encoded in the referencing `SchemaCompatibility.direction`, not the kind or the finding's location).
- **Absent `type`**: equivalent to `type: ["null","boolean","object","array","number","string"]` (every type except integer-by-name). Subsumption with explicit type goes through this normalization.

## 5. Numeric constraints

Apply when both schemas have `type: "number"` or `type: "integer"`.

Keywords: `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`.

A numeric schema's value space is a subset of ℝ ∪ {special values}. Subsumption:

- **Output**: `R ⊆ L` iff every value validating R also validates L. Operationally: R's bounds are at least as tight as L's. R's `minimum` ≥ L's `minimum`; R's `maximum` ≤ L's `maximum`; R's `multipleOf` is a multiple of L's `multipleOf` (or absent on L).
- **Input**: inverted.

Edge cases:

- **`exclusiveMinimum` / `exclusiveMaximum` as boolean (draft-04 form)**: not supported by 2020-12. If encountered, raise `profile.schema.not_2020_12` and return `unverified`.
- **`exclusiveMinimum: x` with `minimum: x`**: `exclusive` wins.
- **Mixed integer and number**: numeric narrowing from `number` to `integer` is contravariance violation in input (R rejects floats L accepted), covariance-compatible in output if L's range was already integer-valued.
- **`multipleOf` precision**: the profile compares `multipleOf` values using exact rational arithmetic, not float division. `multipleOf: 0.1` and `multipleOf: 0.05` are compared as the rationals 1/10 and 1/20, with subsumption holding when one is a rational multiple of the other. Implementations using `big.Rat`-equivalent (Go: `math/big.Rat`; TS: a vetted bignum library or string-rational fallback) are conformant; `float64`-based comparison is non-conformant. Values that cannot be represented as finite-decimal rationals (e.g., `multipleOf: <a value resulting from non-decimal arithmetic>`) emit `unverified.unsupported_keyword` and return `unverified`.

## 6. String constraints

Apply when both schemas have `type: "string"`.

Keywords: `minLength`, `maxLength`, `pattern`, `format`.

- **Length bounds**: same logic as numeric bounds. R's `minLength` ≥ L's; `maxLength` ≤ L's for output covariance.
- **`pattern`** (regex): subsumption between two regexes is decidable but expensive. The profile decides:
  - If `R.pattern == L.pattern` byte-equal: compatible (or identical).
  - If `L` has no `pattern` and `R` has one: covariance-compatible in output, contravariance violation in input.
  - If `R` has no `pattern` and `L` has one: covariance violation in output, contravariance-compatible in input.
  - **Otherwise (both have non-equal patterns)**: returns `unverified`. Computing regex-language-containment is technically decidable but costly; implementations MAY return a sound decision when the patterns are structurally simple (e.g., `^\d+$` ⊆ `^[0-9a-f]+$`), but the profile does not require it. Returning `unverified` is always conformant.
- **`format`**: in JSON Schema 2020-12, `format` is annotation-only by default (not asserted). The profile follows the spec default: `format` differences are reported as `metadata.changed` findings with `category: non_breaking` and do not affect the verdict.
  - With the `--assert-format` option set (orthogonal to comparison mode; not enabled by default in the official tooling), `format` is treated like a constraint: `format: "uuid"` ⊆ `format: "string"` etc., with subsumption per the format vocabulary's defined containment relations. Findings produced under `--assert-format` adopt subsumption categories (e.g., `breaking`); without the flag, they are reported as annotation-only `metadata.changed`.

## 7. Array constraints

Apply when both schemas have `type: "array"`.

Keywords: `items`, `prefixItems`, `additionalItems` (deprecated in 2020-12), `contains`, `minContains`, `maxContains`, `minItems`, `maxItems`, `uniqueItems`, `unevaluatedItems`.

- **`items`** (now schema or boolean only in 2020-12; was schema-or-array in earlier drafts): subsumption applied per-position.
- **`prefixItems`** (the array-form replacement): subsumption applied position-by-position. If `R.prefixItems` is shorter than `L.prefixItems`, the missing positions on R's side fall back to `R.items`; the profile checks `R.items` against each of `L.prefixItems[i]` at those positions.
- **`contains`**: a value validates if at least one element matches. Subsumption: R requires-contains-X is compatible with L allowing X (output) or L requiring-contains-Y where Y ⊆ X (input contra-).
- **`minContains` / `maxContains`**: numeric-bound logic, scoped to the count of matching elements.
- **`minItems` / `maxItems`**: numeric-bound logic on array length.
- **`uniqueItems`**: from `false` to `true` is contravariance violation in input (R rejects arrays L accepted with duplicates). Output: from `false` to `true` is covariance-compatible (R returns a stricter subset).
- **`unevaluatedItems`**: see §11.

## 8. Object constraints

Apply when both schemas have `type: "object"`.

Keywords: `properties`, `patternProperties`, `required`, `additionalProperties`, `propertyNames`, `minProperties`, `maxProperties`, `dependentRequired`, `dependentSchemas`, `unevaluatedProperties`.

### 8.1 `properties` and `required`

For each property name `p`:

- Both sides declare `p`: recurse on the property schemas in the same direction.
- Only L declares `p` and `p ∈ L.required`: R is missing a required property. **Output**: R's outputs may not have `p`, which violates L's promise — incompatible. **Input**: depends on R's `additionalProperties` (§8.2). If R allows additional properties (the default), R still accepts inputs containing `p` — it just doesn't validate `p`'s value — so input subsumption is not violated by the missing declaration alone. If R has `additionalProperties: false`, R rejects inputs with `p` — incompatible. Reported as `required.removed`.
- Only L declares `p` and `p ∉ L.required`: optional property absent on R. R can still validate any value L's schema validated (since R has no constraint on `p`). Compatible.
- Only R declares `p`: depends on `additionalProperties`.

### 8.2 `additionalProperties`

Default: `true` (every property allowed). Normalized identically to absent.

- `additionalProperties: false` on both: properties must match exactly. Subsumption applies per-property.
- `additionalProperties: false` on R, `true` (or absent) on L: **input**: R rejects properties L accepted — contravariance violation, incompatible. **Output**: R's outputs are a stricter subset of L's, R doesn't return the extra props — covariance-compatible.
- `additionalProperties: false` on L, `true` on R: **output**: R may return properties L didn't promise — covariance violation, incompatible. **Input**: R accepts properties L didn't accept — contravariance-compatible.
- `additionalProperties: <schema>` on either side: subsumption recurses on the additional-properties schema.

### 8.3 `required` array

`required` is a list of property names. Subsumption per direction:

- **Output**: R's required ⊇ L's required. (R promises at least as much as L.) Adding to R's required list is OK; removing is covariance violation.
- **Input**: R's required ⊆ L's required. (R doesn't demand more than L promised.) Adding to R's required is contravariance violation.

### 8.4 `patternProperties`

Like `properties` but keyed by regex. The profile compares pattern-pattern subsumption byte-equally; if patterns differ, recurse on schemas only when patterns match exactly. Otherwise return `unverified` for the pattern positions.

### 8.5 `propertyNames`

A schema constraining property name strings. Subsumption applies on the schema; tighter `propertyNames` is covariance-compatible in output, contravariance violation in input.

### 8.6 `dependentRequired` and `dependentSchemas`

Conditional requirements. Subsumption is decidable but combinatorial; the profile attempts pairwise comparison of corresponding entries:

- For each property name `p` in either side:
  - Both sides have a dependent constraint: subsume the schemas / required lists.
  - One side has it, other doesn't: tightening on R is contravariance violation in input, covariance-compatible in output.

When dependent constraints reference each other recursively, the profile follows §11's $ref handling.

## 9. Boolean combinators

`allOf`, `anyOf`, `oneOf`, `not`. The hardest cases.

### 9.1 `allOf`

`allOf: [A, B, C]` validates iff all of A, B, C validate. Equivalent to schema intersection.

The profile flattens `allOf` (associative, commutative) before comparison when all branches are simple (non-combinator) schemas. After flattening, an `allOf` schema is treated as the intersection of its branches.

- **Output**: R's intersection ⊆ L's intersection iff R is at least as constrained.
- **Input**: inverted.

`allOf` containing combinator branches (`oneOf`, `anyOf`, `not`, conditional) or recursive `$ref` is **not** flattened. The profile returns `unverified` with reason `combinator_pairing` for such cases. (Sound subsumption over intersections of unions or negations is exponential; the profile chooses `unverified` over guessing.)

### 9.2 `anyOf`

`anyOf: [A, B, C]` validates iff at least one of A, B, C validates. Equivalent to schema union.

- **Output**: R ⊆ L iff every value matching some branch of R matches some branch of L. The profile attempts:
  1. Pairwise: for each branch of R, find a branch of L that subsumes it. If every branch of R has a covering branch of L, compatible.
  2. If pairwise fails: return `unverified` (true subsumption may still hold via overlap, but pairwise is a sound approximation).
- **Input**: inverted; for each branch of L, find a branch of R that subsumes it.

### 9.3 `oneOf`

`oneOf: [A, B, C]` validates iff exactly one of A, B, C validates. Subsumption is NP-hard in general; the profile uses a bounded approach:

- If `R.oneOf` and `L.oneOf` have the same arity AND the branches can be paired with each branch of R subsuming the corresponding branch of L (in the requested direction): compatible.
- If arities differ OR pairing fails: return `unverified`.

Comparing `oneOf` against `anyOf` is non-trivial (a `oneOf` is not generally a subset of an `anyOf` with the same branches due to the exclusivity constraint). The profile returns `unverified`.

Comparing `oneOf` against a non-combinator schema: pairwise check each branch.

### 9.4 `not`

`not: A` validates iff A does not validate. Crucially: `not` **inverts variance**.

- **Output**: `not S ⊆ not T` iff `T ⊆ S` (in original direction). The profile recurses with direction flipped.
- **Input**: same flip.

When `not` wraps a complex schema, the profile may quickly hit `unverified`; that's expected.

## 10. Conditional schemas

`if`, `then`, `else`. The schema validates if either:
- `if` validates AND `then` validates, OR
- `if` does not validate AND `else` validates.

Subsumption with conditionals is in general undecidable. The profile attempts:

1. If both schemas have `if`/`then`/`else` and the `if` schemas are byte-identical (after normalization), compare `then` and `else` pairwise.
2. Otherwise, return `unverified`.

Conditional schemas without explicit `if`/`then`/`else` patterns (e.g., `dependentSchemas`) are handled in their own sections.

## 11. Reference resolution

### 11.1 `$ref`

`$ref` points to another schema. The profile resolves refs using JSON Pointer semantics:

- **Internal refs** (`#/$defs/Foo`, `#/schemas/Foo`): resolve to the named schema in the same document. Cycles are detected per §11.3.
- **Cross-document refs**: in the official OBI tooling, refs typically point at the document's `schemas` map (`#/schemas/Foo`). The comparison engine resolves these locally without network fetches. External-document refs (`https://...`) trigger a profile-level decision: the official tooling does NOT fetch external schemas during comparison and returns `unverified` for any position whose subsumption depends on an unresolved external ref. (Implementations MAY add fetching as an opt-in flag; the profile does not require it.)

### 11.2 `$dynamicRef` / `$dynamicAnchor`

JSON Schema 2020-12's dynamic-ref mechanism. The profile supports `$dynamicRef` resolution within a single document by tracking the dynamic anchor scope. When dynamic resolution would require fetching an external base URI, return `unverified`.

### 11.3 Cycle detection

`$ref` may form cycles (`#/$defs/A` references `#/$defs/B` references `#/$defs/A`). The profile uses **bisimulation up to a depth bound** (default 32 frames; configurable via `--max-ref-depth`):

- Track `(left_ref, right_ref)` pairs visited in the current traversal.
- If a pair is revisited (byte-equal ref strings), return `compatible` for that branch (coinductive: assume the cycle subsumes itself).
- If the depth bound is hit without visiting a cycle, return `unverified` with reason `cycle_depth`.

**Scope.** This applies only to byte-equal `(left_ref, right_ref)` pairs. Two structurally identical but differently-named recursive types (`Tree` vs `Node` with the same shape) are NOT paired by this rule; the profile traverses both and either eventually pairs them by structure or hits the depth bound. Implementations MAY add structural bisimulation as an extension; the profile does not require it.

Recursive tree schemas (e.g., `{type: "object", properties: {children: {type: "array", items: {$ref: "#"}}}}`) decide as `compatible` against themselves under this rule.

### 11.4 `$defs` and `definitions`

Treated as schemas-by-name maps. Subsumption is per-resolved-pair, not per-definition (since definitions are referenced, not validated against directly).

## 12. Unevaluated keywords

`unevaluatedProperties` and `unevaluatedItems` are notoriously context-sensitive. They depend on which sibling and ancestor keywords (especially `properties`, `patternProperties`, `allOf`, `anyOf`, `oneOf`, `if`/`then`/`else`) "evaluate" properties or items.

The profile follows the spec definition:

- A property is "evaluated" by `properties`, `patternProperties`, or any subschema in `allOf`/`anyOf`/`oneOf`/conditional that asserts that property.
- `unevaluatedProperties: false` means properties not evaluated by sibling annotations are forbidden.

For subsumption:

- The profile tracks the evaluated-property set produced by each schema's structure.
- Subsumption succeeds when R's evaluated-set ⊇ L's (output) or ⊆ L's (input).
- When the evaluated-set computation depends on unresolvable refs, return `unverified`.

In practice: simple cases (no refs, no combinators) decide cleanly. Complex cases with `allOf` of `$ref`s decide as `unverified`.

## 13. `format` keyword

Per JSON Schema 2020-12, `format` is annotation-only by default. The profile honors this:

- `format` differences appear as `metadata.changed` findings with `category: structural` (non-breaking).
- Under `--assert-format`, `format` is treated as a vocabulary-defined constraint. Subsumption uses defined containment: `format: "uuid"` ⊆ `format: "string"` (every UUID is a string), `format: "ipv4"` and `format: "ipv6"` are disjoint, etc. Containment relations for the standard vocabulary are listed in `findings.md` Annex A.

## 14. `const` and `enum`

After §3 normalization, `const: "x"` and `enum: ["x"]` are treated identically.

- **Output (covariance)**: R's value set ⊆ L's value set. Removing a value from R's enum is compatible. Adding is incompatible.
- **Input (contravariance)**: inverted. Adding to R's enum is compatible. Removing is incompatible.
- `const` vs `enum` of length > 1: `const` is the strictest singleton. Subsumption applies normally.
- `enum` value comparison is by canonical-JSON byte equality (RFC 8785). `1.0` equals `1` (same canonical number representation).

## 15. `content*` keywords

`contentEncoding`, `contentMediaType`, `contentSchema`. These are annotation-only by default in 2020-12. The profile follows: differences are `metadata.changed` structural findings.

## 16. Annotation-only keywords

These keywords do not affect subsumption:

`title`, `description`, `default`, `examples`, `$comment`, `readOnly`, `writeOnly`, `deprecated`

Differences are reported as `metadata.changed` structural findings with `category: structural`. They do not contribute to a `compatible` vs `incompatible` verdict.

For users who want byte-equal documents (the use case earlier drafts had a separate `byte-identical` mode for), the right path is to canonicalize both sides and run a byte-diff tool externally; the comparison engine does not provide a fourth mode for it.

## 17. Mode interactions

The mode flag (§7 of `comparison.md`) modifies the subsumption check:

- `subsume`: as defined throughout this document.
- `equivalent`: `subsume(L, R)` AND `subsume(R, L)`.
- `identical`: stricter than `equivalent`. Schemas must match structurally after normalization (§3) but ignoring annotation-only keywords (§16). Stripped: descriptions, examples, key ordering. Retained: types, constraints, combinator structure.

The profile is the same; only the verdict-translation differs:

- Under `subsume`, `compatible` and `identical` both pass.
- Under `equivalent`, both directions must pass.
- Under `identical`, only `identical` (or `compatible` reduced to `identical` by annotation stripping) passes; `compatible`-but-not-`identical` positions register as the `identical.subsumption_only` kind (`findings.md` §6.6).

## 18. The `unverified` outcome

When the profile cannot decide, it returns `unverified`. The corresponding finding's `kind` is one of the `unverified.*` slugs per the catalog (`findings.md` §6.10):

- `unverified.external_ref`: subsumption depends on a ref the engine did not resolve (cross-document or unresolvable internal ref).
- `unverified.cycle_depth`: reference traversal hit the cycle-depth bound without resolving.
- `unverified.regex_containment`: pattern containment beyond byte-equality. Also fires for `patternProperties` with non-byte-equal pattern keys.
- `unverified.combinator_pairing`: `oneOf`/`anyOf`/`allOf` pairing failed under sound-but-incomplete approximation. Also fires for cross-combinator comparisons (`oneOf` vs `anyOf`, `oneOf` vs non-combinator) where pairwise pairing is undefined.
- `unverified.conditional_not_byte_equal`: `if`/`then`/`else` comparison where the `if` schemas are not byte-identical.
- `unverified.dynamic_ref_external`: dynamic ref resolution requires external fetch.
- `unverified.unsupported_keyword`: schema uses a keyword the profile does not understand.

Two cases the profile previously left ambiguous now have explicit homes:

- **`allOf` with recursive `$ref` inside non-conjunctive combinators** (e.g., `allOf: [$ref, {oneOf: [...]}]`): returns `unverified` with rule `unverified.combinator_pairing`. The intersection cannot be soundly decided without traversing the cycle.
- **Profile-conformance errors** (invalid type array, draft-04 booleans, unsupported keyword in profile): NOT routed through `unverified`. Instead, they emit `profile.schema.*` findings and the verdict at that position is `indeterminate` (a sixth state, not `unverified`). `findings.md` §8 enumerates these meta-rules.

`--strict-undecidable` treats all `unverified` outcomes as `incompatible` for the purposes of the summary verdict. Profile-conformance errors (`indeterminate`) are not affected by `--strict-undecidable`; they always render the report's summary verdict as `indeterminate`.

## 19. Conformance

Behavior is locked down by fixtures in `conformance/comparison/subsumption/`. Each fixture is:

- Two schemas (`left`, `right`)
- A direction (`input` or `output`)
- A mode (`subsume`, `equivalent`, `identical`)
- The expected verdict, drawn from `compatible | incompatible | unverified | unspecified | identical | indeterminate` (matching `comparison.md` §8)
- For `unverified`: the expected reason category from §18 (`external_ref`, `cycle_depth`, etc.)
- For profile-conformance errors (invalid input schema): the expected `profile.*` rule and the resulting `indeterminate` outcome

Both Go and TS implementations must produce identical verdicts on identical inputs. Profile changes are gated by fixture changes; the profile name carries a corpus hash (`OB-2020-12@<sha>`) so reports are reproducible. The corpus-sha is SHA-256 of the canonical-JSON manifest of the fixture corpus (`comparison.md` §15).

## 20. Implementation notes

- **Regex-containment escape hatch.** The profile returns `unverified` for non-byte-equal patterns. Implementations MAY add sound regex-subsumption decisions for simple structural cases (e.g., `^\d+$ ⊆ ^[a-z0-9]+$`); doing so converts what would have been `unverified` outcomes into `compatible`/`incompatible`. Such extensions don't violate the profile (which is sound-but-incomplete: any decision the profile reaches is correct; converting `unverified` to a definite verdict is allowed). Implementations adding decisions MUST contribute fixtures that lock the new behavior.
- **`oneOf` branch-reordering.** Pairwise pairing (§9.3) treats branches in declared order. Implementations MAY try permutations as an optimization; if a permutation succeeds, the verdict is `compatible`. Conformant implementations that fail to find a valid permutation report `unverified` (sound).
- **`unevaluatedProperties` depth.** §12's evaluated-set tracking has no explicit depth bound separate from `--max-ref-depth`. Implementations re-using the ref-depth budget for evaluated-set traversal are conformant.
- **`format` assertion.** Off by default; users opt in via `--assert-format`.

## 21. Versioning

Profile name: **OB-2020-12**, profile version v1.

Profile rule changes (new `unverified` cases, expanded decidability, format-vocabulary updates) are corpus-fixture-gated. They change the corpus-sha but not the profile name. The profile name (`OB-2020-12`) is reserved for material rule changes that aren't backwards-compatible with the original; a future `OB-2025-12` would indicate such a break, with at least one minor convention version supporting both names side-by-side.

The profile is versioned independently from the comparison convention itself. The current pairing is convention v1 with `OB-2020-12`; a future convention release may continue with `OB-2020-12` if no rule changes are needed, or move to `OB-2025-12` if breaking profile-rule changes are required.

Reports embed the corpus-sha (`OB-2020-12@<sha>`) so any report is reproducible against the exact fixture corpus that was active at production time. The corpus-sha is computed per `comparison.md` §15.
