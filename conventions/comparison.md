# Comparison Analysis Convention

**Convention version:** v1
**Profile:** OB-2020-12
**Applies to:** the official OpenBindings tooling — `ob` CLI, `openbindings-go`, `openbindings-ts`

---

## 1. Voice and scope

This document describes how the **official OpenBindings tooling** answers comparison-related questions that the spec deliberately leaves tool-defined (see `openbindings.md` §2 and §16, OBI-T-09).

It is non-normative. Third-party tools may answer the same questions differently and remain fully spec-conformant. They may adopt these conventions if they wish; conformance to the conventions is not a precondition for OpenBindings ecosystem participation.

Throughout this document, prescriptive language ("the engine MUST", "the report contains", etc.) describes how the official tooling behaves, not how every OpenBindings tool must behave. The disclaimer in this section governs the entire document.

The conventions are versioned independently from the spec. Conformance fixtures in `conformance/comparison/` lock down behavior; profile changes (e.g., OB-2020-12 → OB-2021-12) require fixture changes.

## 2. The three commands

The official tooling answers three distinct questions, each via a separate CLI command and a corresponding SDK function:

| Command | Question | Direction | Primary output |
|---|---|---|---|
| `ob compat A B` | Does B satisfy A's contract? | asymmetric (A is contract) | verdict + violations |
| `ob diff A B` | How do A and B relate? | symmetric (peer) | structural delta |
| `ob conform <role> <target>` | What changes would make `<target>` satisfy `<role>`? | asymmetric, prescriptive | scaffold / patch |

These are not three views of one operation. They have different exit-code semantics, different audiences, and different default views. They share **one internal engine** and **one report data model**. Each command runs the full engine; the difference between commands is:

- which exit code is returned for a given report state
- which sections of the report are emphasized in the human renderer
- whether the command produces side effects (only `conform` writes files)

A consequence: when `ob compat A B` fails, its JSON report contains the same level of structural-delta detail in `findings[]` that `ob diff A B` would produce. Users running `compat` as a CI gate get failure-detail in the same invocation.

### 2.1 Cross-source drift is `ob drift`

Cross-source drift (catching when two sources within one OBI describe the same operation differently) is a separate single-input analysis. It is not part of `ob diff` and lives under a future `ob drift` command. Shared primitives (canonical-JSON normalization, schema-profile equality) live in `canonicaljson` and `schemaprofile` packages so `compare` and a future `drift` can both reach them.

When `ob drift` lands, it will reuse the `Finding` record type and slug catalog from this convention. Its report shell is intentionally not pre-specified here.

## 3. The comparison engine

Inputs: two OBI documents, **L** and **R**, plus a `mode` (§7).

Output: a `ComparisonReport` value (§5).

The engine performs three passes:

1. **Operation matching.** Pair each operation in L with an operation in R using the matching rules of §6.
2. **Schema subsumption.** For each paired operation, evaluate input/output schema compatibility under the requested `mode` per the OB-2020-12 profile (`subsumption-profile.md`).
3. **Structural delta.** Compute presence/absence/modification deltas for operations, schemas, security, sources, bindings, transforms, metadata.

All three passes always run. Each command's output reflects the full report; commands differ in projection, exit code, and prose, not in what data the engine computes. This avoids the failure mode where running `compat` for a CI gate leaves the user without diff-style detail when the gate fails.

## 4. Report identity

Every report is uniquely identifiable. The header carries:

- `format_version` — the report schema version (e.g., `ob-comparison-report/v1`)
- `profile` — the subsumption profile, including a corpus hash for reproducibility (`OB-2020-12@<sha>`)
- `mode` — the comparison mode used
- `tool` — name and version of the tool that produced the report
- `generated_at` — RFC 3339 UTC timestamp
- `inputs.left` and `inputs.right` — input descriptors with content SHA-256 hashes

This makes archived reports reproducible (or, when not bit-reproducible due to non-determinism in the comparison engine, at least verifiable as having been produced from specific inputs by a specific tool).

## 5. The report data model

```
ComparisonReport {
  format_version:  "ob-comparison-report/v1"
  profile:         "OB-2020-12@<corpus-sha>"
  mode:            "subsume" | "equivalent" | "identical"
  tool:            { name, version }
  generated_at:    string  // RFC 3339 UTC
  inputs: {
    left:  InputDescriptor
    right: InputDescriptor
  }
  summary: {
    verdict: "compatible" | "incompatible" | "unverified" | "indeterminate"
    coverage: {
      total_operations:   int  // count on the contract side (L)
      paired:             int
      only_left:          int
      only_right:         int
      paired_via:         { direct: int, alias: int, satisfies: int }
    }
    counts:     Map<finding_code, int>
    categories: {                       // multi-categorization; sums may exceed total
      breaking:        int
      non_breaking:    int
      compliance:      int
      structural:      int
    }
  }
  operations: OperationDelta[]
  schemas:    SchemaDelta[]
  metadata:   MetadataDelta[]
  sources:    SourceDelta[]
  bindings:   BindingDelta[]
  transforms: TransformDelta[]
  security:   SecurityDelta[]
  suppressed: SuppressedFinding[]
}

InputDescriptor {
  source:        "file" | "url" | "stdin" | "registry" | "git-ref"
  uri:           string
  content_sha256: string                // hex
  label:         string                 // human-readable, e.g. "v1.2.0"
}

OperationDelta {
  status:   "paired" | "only_left" | "only_right"
  left?:    OperationRef
  right?:   OperationRef
  match?:   MatchRecord                 // when status == "paired"
  input?:   SchemaCompatibility         // when status == "paired"
  output?:  SchemaCompatibility         // when status == "paired"
  findings: Finding[]                   // both subsumption violations AND structural changes
}

OperationRef {
  key:      string                       // operation map key on this side
  pointer:  string                       // RFC 6901 pointer to the operation object on this side
}

MatchRecord {
  strategy: "direct" | "alias" | "satisfies"
  left:     string   // operation key in L
  right:    string   // operation key in R
}

SchemaCompatibility {
  verdict:   "compatible" | "incompatible" | "unverified" | "unspecified" | "identical" | "indeterminate"
  direction: "input" | "output"
  reasons:   FindingRef[]               // by kind+pointer; canonical Finding lives in operation.findings
}

Finding {
  kind:     string                       // slug identifier; e.g. "required.added", "field.added"
  category: string[]                     // multi-valued; sorted lexicographically; see §10
  severity: string                       // "info" | "warn" | "error"  (overridable)
  location: {
    side:        "left" | "right"        // never "both"; see §5.2
    pointer:     string                  // RFC 6901 JSON Pointer rooted at the document on `side`
    counterpart?: { side, pointer }      // present when paired across L and R (e.g., operation renames)
  }
  before?:  CanonicalJSON                // RFC 8785; absent when not applicable
  after?:   CanonicalJSON
  // No prose. The human renderer derives prose from `kind` + the catalog (findings.md).
}

FindingRef {
  kind:    string
  pointer: string
  side:    "left" | "right"
}

SuppressedFinding {
  finding:           Finding
  suppressed_by:     SuppressionRule
  actual_severity:   string              // what the finding's severity would have been
}

SuppressionRule {
  // Matching axes; populated fields compose with AND semantics.
  kind?:           string             // exact kind slug, e.g. "required.added"
  kind_prefix?:    string             // segment-boundary prefix, e.g. "string.pattern."; mutually exclusive with kind
  category?:       string             // e.g. "structural"
  operation?:      string             // suppress all findings on this operation
  severity_below?: string             // suppress findings whose severity is below this threshold

  // Refinement axes (composed with AND when populated):
  pointer?:        string             // RFC 6901 JSON Pointer
  side?:           "left" | "right"   // omit to match either side
  modes?:          string[]           // suppress only when running in one of these modes

  // Bookkeeping:
  reason:          string             // human-readable; required
  until?:          string             // RFC 3339 with timezone; rule expires at this instant
}

SuppressionRuleset {
  version:        string              // suppression file schema version, e.g. "v1"
  suppressions:   SuppressionRule[]
}
```

### 5.1 One findings array; both compat and diff use it

A single `findings[]` array per `OperationDelta` carries both subsumption violations (when `compat`-style verdict gating applies) and structural changes (the descriptive deltas a `diff` view emphasizes). Every event has a slug `kind`.

The distinction between "subsumption finding" and "structural change finding" lives in:

- The `category` array (`breaking` / `non_breaking` / `compliance` / `structural`).
- The slug itself, which carries semantic meaning (e.g., `required.added` is a subsumption violation; `field.added` is a structural change). Subsumption slugs are position-neutral; whether the finding concerns input or output is determined by which `SchemaCompatibility` (input or output) references the finding via its `reasons[]` array, not the slug.
- `severity` (subsumption-failing kinds default to `error`; descriptive structural kinds default to `info`).

Each command projects the same data differently:

- `ob compat` gates on the **verdict** (§8), which is computed from per-position subsumption evaluation. Direction-aware projection (§10.0) ensures that findings which are violations in the evaluated direction carry `category: breaking` and `severity: error`, so the effective categories in the report align with the verdict. The verdict remains the authority for the exit code; categories are presentation metadata derived from the same underlying evaluation.
- `ob diff` shows all findings with no verdict gating; emphasizes `kind:`-distinguishing slugs (`field.added`, `field.removed`, `field.modified`).
- `ob conform` uses the same data to drive scaffolding output.

Example: a `required.added` finding inside `OperationDelta.input` (an input-position subsumption violation):

```json
{
  "kind": "required.added",
  "category": ["breaking"],
  "severity": "error",
  "location": {
    "side": "right",
    "pointer": "/operations/createTask/input/required/1"
  }
}
```

The slug names what happened (`required.added`). The schema position (input vs output) is the parent `SchemaCompatibility` context. The location identifies where.

For `only_left` / `only_right` operations (no pairing), the per-operation `findings[]` includes a single `operation.removed` or `operation.added` finding at the operation-key pointer. The same model handles paired and unpaired cases uniformly.

### 5.2 Pointer rooting

Pointers (in `Finding.location.pointer`, `FindingRef.pointer`, `SuppressionRule.pointer`) are RFC 6901 references rooted at **the OBI document on the side identified by `side`**.

**Findings always have `side: "left"` or `side: "right"`** — never `"both"`. The `Finding.location.counterpart` field links cross-side findings when the engine has paired them:

```
Finding.location {
  side:        "left" | "right"
  pointer:     string                  // RFC 6901, rooted at the document on `side`
  counterpart?: { side, pointer }      // present for operation renames detected via aliases
}
```

**`counterpart` is currently emitted only for operation-level renames** detected via the OBI `aliases` array. The OBI spec does not define field-level aliases, so field renames are NOT detected as renames; they appear as a `field.removed` finding on one side and a `field.added` finding on the other, both standalone (no `counterpart` link). If a future OBI spec version introduces field-level aliases, the engine will extend `counterpart` to cover those; until then, consumers should not expect rename-pairing for fields.

For symmetric structural changes whose pointer is byte-equal in both documents (e.g., the operation key path is the same on both sides), the engine emits a single Finding with `side` set to whichever side the change "originates from" (added: the side that has the field; removed: the side that had it; modified: by convention `right`).

**`$ref` resolution: definition site, not use site.** When a finding occurs inside a schema reachable via `$ref`, the canonical pointer points into the **definition site** — the path where the schema is physically defined (typically `/schemas/Foo/...`). One finding per schema mutation, not one finding per use site. Consumers wanting per-use attribution can join via the document's `$ref` graph.

**`$ref` inside `before`/`after`.** Values held in `before` and `after` are stored verbatim with `$ref` keywords preserved as `{"$ref": "..."}` literals. The engine does not resolve refs inside payload values. Consumers who want resolved values resolve them themselves.

**Suppression pointer + `side` field.** Suppression rules (§14) accept a `side: "left" | "right"` field; if omitted, the suppression matches findings on either side.

`before` and `after` values are canonical JSON per RFC 8785, with the `$ref` literal-preservation rule above. Mandatory for byte-equivalent reports (see §5.3 and §17).

### 5.3 Canonicalization rules

RFC 8785 (JSON Canonicalization Scheme) is necessary but not sufficient for byte-equivalent reports across implementations. The following additional rules are normative.

**`CanonicalJSON` brand.** A nominal type wrapping the JSON value space (no `undefined`, no functions, no `Date`, no `BigInt`). Any field typed as `CanonicalJSON` has been canonicalized per RFC 8785 plus the rules below. SDK consumers receive `CanonicalJSON` from the engine; producers (e.g., test fixtures) must canonicalize before submission.

**Map / object key ordering.** All maps in the report are sorted by key ascending using lexicographic byte order on the UTF-8-encoded key, before serialization. RFC 8785's per-object key sort is applied; the official tooling additionally pre-sorts in-memory map iteration so that downstream consumers traversing the deserialized form see the same key order.

**Array ordering.** Arrays in the report are sorted by these rules before serialization:

| Array | Sort key |
|---|---|
| `OperationDelta.findings[]` | same |
| `SchemaCompatibility.reasons[]` (FindingRef) | `(kind, side, pointer)` |
| `Finding.category[]` | lexicographic |
| `BulkComparisonReport.targets[]` (see §16) | preserved input order (matches CLI argument order) |
| `BulkComparisonReport.reports[]` (see §16) | aligned with `targets[]` index |
| `suppressed[]` | `(category_tier, finding.kind, finding.location.side, finding.location.pointer)` |
| `OperationDelta[]` | by canonical operation key (left's key when paired or `only_left`; right's key when `only_right`) |
| `MetadataDelta[]`, `SchemaDelta[]`, `SourceDelta[]`, `BindingDelta[]`, `TransformDelta[]`, `SecurityDelta[]` | by canonical key on the side the entry exists |

`category_tier` is computed from `Finding.category` (the **effective** category after direction-aware projection per §10.0) per a fixed order: `breaking` = 0, `compliance` = 1, `non_breaking` = 2, `structural` = 3. A finding's effective tier is the **lowest** value among its categories. This sort order puts breaking findings first, then anything compliance-relevant, then non-breaking, then pure structural. Both JSON / SARIF / ndjson consumers and human renderers see the same canonical order without re-sorting.

A finding whose `category[]` is empty (which is invalid per §10 but can appear from forward-compat passthrough of unknown vendor kinds) sorts at tier 4 — after every named tier — and emits a `profile.kind_unknown` finding alongside the original. Vendor categories not in the official set sort at tier 4 as well; a vendor that wants its kinds to interleave with official tiers MUST also include at least one official category in `Finding.category[]`.

For paired operations comparing keys across L and R after alias-match, the canonical operation key is the L-side key.

**Float representation.** Numeric values follow RFC 8785's number formatting (ECMAScript `Number.prototype.toString` semantics). Implementations MUST use a number formatter that produces the same string output as JavaScript for any value in the IEEE 754 double range. Go's `strconv.FormatFloat(v, 'g', -1, 64)` does NOT match; implementations are responsible for using a JCS-compliant formatter (e.g., the `gibson042/canonicaljson-go` package).

**Unicode normalization.** All strings (object keys, string values, pointer fragments) are NFC-normalized before sort and emission. This addresses the JSON Schema property-name case where one document was authored in NFD and another in NFC.

**`generated_at` precision.** RFC 3339 with UTC `Z` suffix and exactly **millisecond** precision (three fractional-second digits). Higher resolution is rounded down. Example: `2026-04-29T15:30:00.000Z`.

**`tool.version` form.** SemVer 2.0.0 string, no `v` prefix. Go's module system uses `v0.2.0` internally; the SDK MUST strip the prefix when populating `tool.version`.

**`paired_via` zero-count emission.** All three counters (`direct`, `alias`, `satisfies`) are always emitted, even when zero. JSON omits-empty-by-default behavior is forbidden for these fields.

**RFC 6901 pointer encoding.** Pointers are emitted with RFC 6901 escape rules applied verbatim: `/` becomes `~1`, `~` becomes `~0`. No additional encoding (URL-encoding, etc.) is applied.

**Field omission.** A `before` or `after` field is omitted entirely (not emitted as `null`) when the engine has nothing to report at that position. Tools must distinguish "field absent" (not applicable) from "field present with null" (the value was JSON null).

**Same-version determinism.** Two invocations of the same tool version on the same inputs (identical content hashes, identical mode, identical options, identical environment-relevant inputs like the suppressions file) MUST produce byte-identical reports. This is a normative requirement on implementations, gated by the conformance corpus (§17).

## 6. Matching

The official tooling pairs operations in L with operations in R using these rules in order, first match wins. Third-party tools may apply different matching rules and remain spec-conformant; the rules below describe the convention adopted by `ob`/`openbindings-go`/`openbindings-ts`.

1. **Direct key equality.** `L.operations.foo` pairs with `R.operations.foo`.
2. **Alias match.** `L.operations.foo` with `aliases: ["bar"]` pairs with `R.operations.bar`, or vice versa.
3. **Satisfies-claim match.** When the contract side declares a role and an operation in the implementation side declares `satisfies: [{role, operation}]` whose role resolves to the contract, the implementation's operation pairs with the contract's referenced operation. Requires explicit role identification.

If no rule matches, the operation appears in the report with `status: only_left` or `only_right`.

### 6.1 Role identification

Satisfies-matching needs to know which side plays the role:

- For `ob conform <role> <target>`: the first argument is the role document.
- For `ob compat A B`: A is the contract; if A declares roles via the `roles` map and self-claims via `satisfies`, those claims are honored. If A's `roles` map names another document and B's operations declare `satisfies` against it, the comparison resolves by attempting to load that document via the same source-resolution rules (§13).
- The `--role <key>` flag selects which `roles` entry is the active role for the comparison.

For `ob diff` (peer comparison), satisfies-matching is disabled by default; a peer comparison has no contract side. `--enable-satisfies` opts in.

## 7. Modes

Three modes. Earlier drafts had a `forward` mode (which was syntactic sugar for swapping the arguments to the default mode) and a `byte-identical` mode (which was admittedly a one-liner over JCS canonicalization plus `cmp`). Both are removed; users wanting their behavior swap arguments or pipe to a byte-comparison tool, respectively.

```
subsume          (default)  one-directional subsumption: R must satisfy L
                            • input contravariant: R accepts ⊇ L's accepted inputs
                            • output covariant:    R returns ⊆ L's promised outputs
                            • "Does the implementation satisfy the contract?"

equivalent                  bidirectional subsumption: subsume(L,R) AND subsume(R,L)
                            • "Are these two contracts mutually compatible?"
                            • In practice this often collapses toward `identical`
                              for typed schemas; that collapse is acknowledged, not
                              hidden. Use `equivalent` deliberately when you want
                              subsumption-symmetry rather than structural equality.

identical                   contract-equivalence ignoring cosmetic drift
                            • Schema shape, property requirements, type sets, enum
                              values must match exactly; descriptions, examples,
                              key ordering, and other annotation-only keywords are
                              ignored. (See `subsumption-profile.md` §3 for the
                              normalization rules.)
                            • This is the refactor-engineer's daily-driver mode:
                              "did the contract change, ignoring documentation churn?"
```

To get earlier-draft `forward(L,R)` behavior, swap arguments and run `subsume`.

For "byte-equal documents" use cases, run `subsume` then compare the canonical-JSON serializations of L and R with any byte-diff tool. The official tooling does not ship a fourth mode for that.

### 7.1 Modes per command

- `ob compat A B` defaults to `subsume`. `--mode=equivalent` and `--mode=identical` are accepted.
- `ob diff A B` ignores `--mode` (peer comparison has no directional verdict). Findings still carry direction-aware codes when applicable.
- `ob conform <role> <target>` defaults to `subsume` against the role.

## 8. Verdict states (per schema position)

Six states (consistent with `subsumption-profile.md` §19):

- `compatible`: subsumption holds in the requested direction.
- `incompatible`: subsumption fails. Specific failing rule reported via finding codes.
- `unverified`: subsumption is undecidable for this pair (see `subsumption-profile.md`). Reported, not treated as failure unless `--strict-undecidable` is set.
- `unspecified`: one or both sides have no schema declared at this position.
- `identical`: schemas are equivalent post-normalization (annotation-stripped, RFC 8785 canonicalized). Strictly stronger than `compatible`.
- `indeterminate`: the profile could not evaluate the position because the input schema is outside the profile or malformed. Reported with `profile.schema.*` findings and always collapses the summary verdict to `indeterminate`.

Under `--mode=identical`, only `identical` (or `unspecified`) is acceptable. A position that is `compatible` but not `identical` registers as the `identical.subsumption_only` kind (see catalog).

The summary-level `verdict` (§5) collapses per-position verdicts:

```
summary.verdict = indeterminate     if any position is indeterminate, or if the engine could not run (e.g., parse failure)
                = incompatible      if no indeterminate, but at least one position is incompatible
                = unverified        if no indeterminate/incompatible, but at least one position is unverified
                = compatible        if all positions are compatible or identical or unspecified
```

## 9. Finding kinds

Every finding has a stable slug `kind`. The catalog (`findings.md`) lists every kind; descriptions are normative for formatters claiming OB-catalog conformance.

The field is named `kind` rather than `rule` because the unified findings array carries both normative events (subsumption violations like `required.added`) and descriptive events (structural changes like `field.added`, engine errors like `profile.ref.resolution_failed`). "Kind" stays neutral about the normative vs descriptive distinction; it answers "what kind of finding is this?" without smuggling in compliance connotation that "rule" would carry for purely descriptive events.

### 9.1 Slug grammar

Kinds are slug strings matching:

```
^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$
```

Lowercase ASCII, underscore-within-segment, dot-separator between segments. Examples: `required.added`, `string.pattern.removed`, `field.added`, `source.location.changed`, `pair.unknown_role`, `profile.ref.resolution_failed`.

**Length cap.** A kind slug is at most 128 ASCII characters total (vendor prefix included). The catalog targets a typical length of 16-48 characters; segments are at most 6 dot-separated tokens (entity + up to 5 qualifiers).

The slug carries semantic meaning: the leading segment names the entity (`type`, `required`, `numeric`, `string`, `array`, `object`, `field`, `source`, `binding`, `security`, `pair`, `profile`, etc.); subsequent segments describe the change or violation. Subsumption slugs are position-neutral: `required.added` fires for both input and output schemas, with the schema position recorded in the referencing `SchemaCompatibility.direction` field, not the slug. Operation-level transition slugs (`operation.input.declared`, `operation.output.schema_to_null`, etc.) do carry position in the slug because the operation field itself is the entity changing.

### 9.2 Vendor namespacing

Third-party tools that publish their own kinds MUST use a vendor-prefixed namespace: `<vendor>/<slug>`, where `<vendor>` is a stable lowercase identifier (e.g., `acme/required.tightened`). The un-namespaced flat slug space is reserved for the official OB catalog. Vendor namespacing matches the ESLint plugin convention (`plugin/rule-name`).

**Vendor name grammar:** `^[a-z][a-z0-9_-]*$`, max 32 characters. Single-character vendors are forbidden (typosquat hardening). Mixed-case input is rejected at suppressions / catalog load time, not silently lowercased.

**Reserved namespaces.** The vendor namespaces `ob`, `core`, `official`, `openbindings`, and `profile` are reserved against future official use. Tools should not publish kinds under these names. Beyond the un-namespaced (official) slug space, no other vendor catalog or vendor-registration mechanism is specified at this version; vendors that ship their own kinds are responsible for their own catalog and tooling.

**SARIF.** `result.ruleId` is emitted verbatim, including any `<vendor>/` prefix. GitHub code-scanning displays vendor slugs correctly without further encoding.

### 9.3 Evolution policy

- New kinds added in minor catalog versions.
- Existing kinds never change wire identifier or core meaning within a major catalog version.
- Renaming or retiring a kind is a major catalog version bump and ships with documented migration.

### 9.4 Catalog structure

The full catalog is in `findings.md`, with a structured companion `findings.yaml` as the implementation source-of-truth (the YAML is authoritative for SDK code generation; the markdown is rendered for human reading; CI verifies they match).

Each entry has:

- kind (slug, e.g., `required.added`)
- description (one normative sentence; formatters claiming OB-catalog conformance render this verbatim)
- category (default category set; one or more of `breaking`, `non_breaking`, `compliance`, `structural`). These are catalog defaults; the engine projects effective categories at runtime when a direction is evaluated (see §10.0).
- default severity (`info`, `warn`, `error`). Same projection applies.
- modes (which of `subsume` / `equivalent` / `identical` produce this kind; `all` is shorthand for "every mode")

## 10. Categories and policy

A finding's `category` array carries one or more of:

- `breaking` — would break consumers/producers under the active mode and evaluated direction
- `non_breaking` — changes the contract but does not break under the active mode and evaluated direction
- `compliance` — flagged for security, privacy, or regulatory review
- `structural` — change to surface area without semantic effect (description, ordering)

A finding may belong to multiple categories. `summary.categories` counts each occurrence in each category, so the sum of category counts may exceed `len(findings)`. Consumers wanting a single denominator use `len(findings)`.

### 10.0 Direction-aware category and severity projection

The catalog (`findings.yaml`) assigns each kind a **default** category set and severity. These defaults apply directly when no direction is evaluated (i.e., `ob diff`) and for non-directional structural findings. For direction-sensitive subsumption findings produced under `ob compat` or `ob conform`, the engine projects **effective** categories and severity by combining the catalog defaults with the subsumption profile's per-direction judgment:

1. The engine evaluates the subsumption profile for the finding's kind in the current direction (input or output, from the referencing `SchemaCompatibility.direction`).
2. If the profile determines the finding is a **violation** in the evaluated direction, the effective category set replaces `non_breaking` with `breaking`, preserves any independent categories such as `compliance`, and sets severity to `error`.
3. If the profile determines the finding is **not a violation** in the evaluated direction, the effective category set replaces `breaking` with `non_breaking`, preserves any independent categories such as `compliance`, and downgrades severity from `error` to `warn`.
4. Compliance activation (§10.1) applies independently of direction projection: a finding may be both `non_breaking` and `compliance`, or both `breaking` and `compliance`.

This means the same finding kind can produce different `category` and `severity` values depending on the direction being evaluated. For example, `required.added` defaults to `[breaking], error` in the catalog. In an output-position evaluation under subsume mode, the subsumption profile may determine it is not a violation, so the engine downgrades the effective category to `[non_breaking]` and severity to `warn`. The finding slug and location are unchanged; only the category and severity are projected.

The report always carries **effective** (projected) values, not catalog defaults. `summary.categories` counts effective categories. `category_tier` sorting (§5.3) uses effective categories. SARIF `result.level` (§11.2) uses effective severity. Consumers never need to recompute projection; the report is self-contained.

### 10.1 Compliance is a category, not a separate slug namespace

Compliance findings emerge from regular subsumption kinds (`required.*`, `type.*`, `string.*`, etc.) and structural kinds (`field.added`, `security.entry.removed`, etc.) when policy conditions activate them. There is no distinct `compliance.*` slug namespace; the same kind fires with or without the `compliance` category in its `category` array, depending on the runtime policy match.

A consumer filtering for `category: compliance` gets the union of (a) tag-driven activations on regular kinds and (b) always-compliance kinds (`security.*`, `extension.policy.*`). This is the single auditor-facing query for "all compliance-relevant findings."

### 10.2 Tag provenance

Policy tags come from one of:

- **In-document extensions.** Reserved `x-policy-*` extension keys on schema fields (`x-policy-pii`, `x-policy-sensitive`, `x-policy-auth`, etc.). These are OBI extensions, not normative spec fields.
- **External policy file** via `--policy=<path>`. YAML mapping JSON Pointer paths to tag arrays:

```yaml
tags:
  "/operations/getUser/output/properties/email": [pii]
  "/operations/createOrder/input/properties/cardNumber": [pii, sensitive]
  "/operations/adminPurge": [requires-auth, audit]
```

The external file overrides in-document tags when both are present. Multi-tenant SaaS deployments use this to apply tenant-specific policy without modifying tenant OBIs.

**Side-of-tag rule for activation.** When activating compliance on a Finding (per §9.1 of `findings.md`), the engine checks for the policy tag on the side where the change is observed:

- For added events (`field.added`): the tag is on the right side (the side that has the field).
- For removed events (`field.removed`): the tag is on the left side (the side that had the field).
- For modified or paired-field events (`required.added`, `string.pattern.removed`, etc.): the tag may live on either side. Either side's tag activates compliance. If both sides have the tag and the values disagree, left-side wins for the canonical Finding.

**External policy file precedence.** When a tag for the same JSON Pointer is declared in both an in-document `x-policy-*` extension AND an external `--policy=<file>` mapping, the external file wins. There is no fallback or merge: the external set replaces the in-document set for that pointer.

**Side-of-tag for external-only tags.** When a tag exists only in the external file (no in-document `x-policy-*`), the engine treats the tag as present on **both** sides for activation purposes. In-document tags retain their side discipline.

### 10.3 Compliance dimensions covered

The catalog (`findings.md` §9 activation map) covers, in slug form:

- PII tag added to output (`field.added` activates compliance when the added field has `x-policy-pii`)
- Validation pattern relaxed (`string.pattern.removed` activates compliance when the field has `x-policy-sensitive`)
- Required field with sensitive tag became optional (`required.required_to_optional` activates compliance when the field has `x-policy-sensitive`)
- Security entry add/remove (`security.entry.added`, `security.entry.removed`) — always compliance
- Security method changes (`security.method.type.changed`, `security.method.scopes.changed`, etc.) — always compliance
- `x-policy-*` extension changes (`extension.policy.added`, `extension.policy.removed`, `extension.policy.changed`) — always compliance

## 11. Output formats

All commands accept `--format=<value>` (`conform` excludes `sarif`; see §11.2):

- `human` — friendly renderer with prose, codes, docs URLs, and color (color disabled by `NO_COLOR` env or `--no-color`). Each finding's catalog description string is rendered verbatim alongside the code; air-gapped users get the description without needing the docs URL.
- `json` — canonical JSON of the report data model (RFC 8785).
- `ndjson` — one finding per line, with the report header repeated as the first line; suitable for log shippers.
- `markdown` — GitHub-flavored, suitable for PR comments. Stable across versions for diff-friendly review.
- `sarif` — SARIF 2.1.0 (see §11.2).

### 11.1 Default format selection

The default format is selected as follows, in order:

1. `--format` flag, if present.
2. `OB_FORMAT` environment variable, if set.
3. If a CI environment is detected, default to `json`. The CI-detection environment-variable list is normative and locked down by a conformance fixture:
   - `CI=true`
   - `GITHUB_ACTIONS`
   - `GITLAB_CI`
   - `BUILDKITE`
   - `JENKINS_URL`
   - `CIRCLECI`
   - `TF_BUILD` (Azure Pipelines)
   - `CODEBUILD_BUILD_ID` (AWS CodeBuild)
   - `TEAMCITY_VERSION`
   - `DRONE`
   - `BAMBOO_BUILD_NUMBER`
   - `APPVEYOR`
   - `CODESHIP`
4. If stdout is a TTY (per `isatty(stdout)`), default to `human`.
5. Otherwise default to `json`.

`--format` and `OB_FORMAT` always override detection.

### 11.2 SARIF mapping

Tools that emit SARIF output for OpenBindings comparison reports project findings to SARIF results as follows. Third-party tools mapping to other formats (TAP, JUnit XML, etc.) are free to define their own projection.

Every `Finding` projects to a SARIF `result`. Because every Finding carries a mandatory `kind` slug, every result has a `ruleId`.

- `result.ruleId` ← `Finding.kind` (slug; SARIF tolerates dotted slugs and slashed vendor namespacing as ruleIds — ESLint, Semgrep, PSScriptAnalyzer all do this)
- `result.level` ← projection of `Finding.severity` (effective severity after direction-aware projection per §10.0): `info → "note"`, `warn → "warning"`, `error → "error"`
- `result.message.text` ← the catalog description string for the kind
- `result.locations[0].physicalLocation.artifactLocation.uri` ← the `uri` of the side identified by `Finding.location.side`
- `result.locations[0].physicalLocation.region` ← line/column of the pointer target if the OBI parser retained source spans; otherwise the JSON Pointer is encoded as a `logicalLocation` instead. (OBI parsers in the official tooling retain source spans for file-sourced inputs; URL- and stdin-sourced inputs may not have spans.)
- `result.properties.security-severity` ← numeric 0.0-10.0 derived from `category` for findings tagged `compliance` (specifically: 4.0 for `compliance` alone, 7.0 if also `breaking`). Drives GitHub code-scanning row coloration. Vendor-namespaced kinds: vendors choose their own scoring or omit the property; the official tooling does not score vendor kinds.

The `tool.driver.rules[]` array is populated from the catalog: `id` (the slug), `helpUri`, `shortDescription`, `defaultConfiguration.level`. `helpUri` is the human-renderer docs URL: `https://openbindings.com/conventions/v1/kinds/<slug>`. Vendor-namespaced kinds appear in `result.ruleId` verbatim; they have no `tool.driver.rules[]` entry unless the official catalog has been extended to include them.

Suppressed findings appear in SARIF output as `result.suppressions[]` with `kind: "external"` and `justification` from the suppression rule's `reason` field.

`sarif` is supported for `compat` (its primary use case) and for `diff` (where structural-change findings become `note`-level results). `conform` does not have a meaningful SARIF projection and emits an error if `--format=sarif` is requested.

## 12. Exit codes

Stable. Documented.

```
0   Success.
    - compat: B satisfies A's contract.
    - diff:   reports produced (differences are not failures).
    - conform: scaffold generated successfully (or target already conforms).
1   Comparison-relevant problem.
    - compat: B does not satisfy A.
    - diff:   not used.
    - conform: scaffold generation failed (e.g., unresolvable schema).
2   Tool error: parse failure, missing input, invalid arguments, internal bug.
```

## 13. Source resolution

Inputs may be supplied as:

- Filesystem path (`./service.obi.json`)
- HTTP/HTTPS URL
- Stdin (`-`)
- Registry URL (`panjir://acme/orders@1.2.0`) when the registry source resolver is enabled
- Git ref via `--baseline=<git-ref>` or `--from-git=<ref>:<path>`

`--baseline=<git-ref>` resolves the document at that ref via `git show <ref>:<path>`. The path is the working-tree-relative file path (positional argument), so `ob compat --baseline=v1.2.0 ./service.obi.json` is "compare HEAD's service.obi.json against v1.2.0's." `--since=<tag>` is **removed** in v2 to disambiguate from `--baseline`.

Source resolution is a separate concern from comparison; see `ob/internal/source/`.

## 14. Suppression

The official tooling supports a YAML suppression file via `--ignore-file=<path>` (or `--suppressions=<path>`, alias). Third-party tools adopting this convention follow the format below; tools using a different format are not non-conformant. A JSON Schema for editor support will be published at the URL below when the suppression format stabilizes:

```yaml
# yaml-language-server: $schema=https://openbindings.com/conventions/v1/suppressions.schema.json
version: v1

suppressions:
  # Suppress by kind, globally, with expiry
  - kind: field.added
    reason: "We accept added optional fields fleet-wide."
    until: "2026-12-31T23:59:59Z"

  # Suppress by kind at a specific pointer on a specific side
  - kind: required.added
    pointer: "/operations/internal_debug_ping/input"
    side: "right"
    reason: "Required field added is internal-only; clients don't send it."

  # Suppress everything on a deprecated operation (matches both sides)
  - operation: "internal_debug_ping"
    reason: "Internal-only operation removed by design."

  # Suppress an entire category fleet-wide
  - category: "structural"
    reason: "We don't gate on description-only changes."

  # Suppress a slug-prefix range
  - kind_prefix: "string.pattern."
    reason: "We don't gate on regex-pattern changes; reviewed manually."

  # Suppress findings below a severity floor
  - severity_below: "warn"
    reason: "Info-level findings don't block."

  # Suppress only in a specific mode
  - kind: enum.value.removed
    modes: ["equivalent"]
    reason: "Acceptable under equivalent; checked under subsume and identical only."

  # Vendor-namespaced kind (third-party tool's catalog)
  - kind: acme/required.tightened
    reason: "Acme custom kind; we accept tightening."
```

Suppressed findings appear in `report.suppressed[]` as `SuppressedFinding` records with the rule and reason that matched. They do not appear in `findings[]`, so CI gates pass, but the audit trail is preserved.

Suppression is applied before summary verdict collapse. A suppressed subsumption violation is removed from `SchemaCompatibility.reasons[]`; if no unsuppressed reasons remain for that position, its effective verdict becomes `compatible` for the report. The original finding is preserved in `report.suppressed[]` with `actual_severity`.

### 14.1 Suppression rule semantics

Within a single rule entry, all populated fields are matched with **AND** semantics: a finding is suppressed by that rule only if it matches every populated criterion (`kind` AND `pointer` AND `side` AND `category` AND `severity_below`, etc.). Across rule entries, **OR** semantics apply: a finding is suppressed if any rule matches.

When multiple rules match, the first rule by file order wins for the `suppressed_by` attribution.

### 14.2 `until` expiry

`until:` accepts an RFC 3339 timestamp with explicit timezone (e.g., `2026-12-31T23:59:59Z`). Bare dates without timezone are rejected. The engine evaluates expiry at the start of each comparison; expired rules are loaded but produce a `profile.suppressions.rule_expired` warning and do NOT suppress.

### 14.3 `kind_prefix` matching semantics

`kind_prefix:` matches a kind string at **slug-segment boundaries**. The match succeeds when the finding's `kind` either:

- exactly equals the prefix value, OR
- starts with the prefix value followed immediately by a `.` (segment separator) or `/` (vendor separator).

A trailing dot or slash on the prefix is OPTIONAL but recommended for clarity. So `kind_prefix: "string.pattern"` and `kind_prefix: "string.pattern."` match identically: both match `string.pattern.added`, `string.pattern.removed`, `string.pattern.modified`, but neither matches `string.patterns_for_validation` (no boundary).

`kind_prefix: "acme/"` matches all kinds in the `acme` vendor namespace.

`kind_prefix: ""` (empty) is rejected at suppression-file load time as a likely footgun. Use `category:` or `severity_below:` to express "suppress all" intent.

`kind_prefix:` cannot be combined with `kind:` in the same suppression entry; pick one identifier-matching field.

## 15. Provenance

The report header (§4) carries provenance fields sufficient to identify the producer (`tool.name`, `tool.version`), pin the subsumption rules (`profile` with corpus-sha), pin the inputs (`inputs.*.content_sha256`), and timestamp the run (`generated_at`). Reports are reproducible against the same inputs and tool version.

## 16. Bulk mode

`ob compat A B [B2 B3 ...]` evaluates A against each `Bi`. The result is a `BulkComparisonReport`, not an array. The envelope shape is fixed at v1; concurrency, fail-fast semantics, cross-target finding aggregation, and bulk SARIF projection are intentionally not specified at this version. The official tooling MAY ship them later as additive extensions; consumers MUST tolerate their absence.

```
BulkComparisonReport {
  format_version: "ob-bulk-comparison-report/v1"
  profile:        "OB-2020-12@<corpus-sha>"
  mode:           "subsume" | "equivalent" | "identical"
  tool:           { name, version }
  generated_at:   string
  contract:       InputDescriptor          // the shared L; authoritative
  targets:        InputDescriptor[]        // each Bi (preserved input order)
  reports:        ComparisonReport[]       // index-aligned with targets
  bulk_summary: {
    total_targets: int
    compatible:    int
    incompatible:  int
    unverified:    int
    errored:       int
  }
}
```

When a target errors, its `reports[index]` entry is a stub `ComparisonReport` with `summary.verdict = "indeterminate"` and one `profile.*` finding describing the error. Index alignment with `targets[]` is preserved.

The contract document (L) is parsed once per bulk run and shared across targets; per-target `inputs.left.content_sha256` MUST equal the bulk header's `contract.content_sha256`.

`ob diff` and `ob conform` do not have bulk modes.

## 17. Conformance fixtures

`conformance/comparison/` holds fixtures locking down the convention behavior. Both SDK implementations (Go, TS) MUST produce reports that are byte-equivalent to each fixture's expected report.

### 17.1 Fixture file format

Each fixture is a single JSON file. One scenario per file. File names are descriptive (e.g., `subsumption/required-input-field-added.json`) and not bound to specific finding codes (a single scenario may exercise multiple codes).

```json
{
  "version":     "ob-comparison-fixture/v1",
  "description": "human-readable scenario summary",
  "left":        { /* OBI document */ },
  "right":       { /* OBI document */ },
  "mode":        "subsume",
  "options": {
    "role":               "string?",
    "profile":            "OB-2020-12",
    "without_payloads":   false,
    "max_ref_depth":      32,
    "strict_undecidable": false,
    "assert_format":      false
  },
  "policy": {
    "tags": { "/operations/foo/output/properties/email": ["pii"] }
  },
  "suppressions": {
    "version": "v1",
    "suppressions": [/* … */]
  },
  "expected": {
    /* full ComparisonReport, canonical JSON, with header placeholders */
  }
}
```

### 17.2 Header placeholders

Fields in `expected` that vary per-invocation use placeholder sentinels the runner substitutes before comparison:

- `"<generated_at>"` — runner replaces with the actual `generated_at` from the produced report; equality is checked separately (must be a valid RFC 3339 with millisecond precision).
- `"<tool.version>"` — runner replaces with the actual `tool.version`; equality is checked against the running SDK's published version.
- `"<corpus-sha>"` — runner replaces with the actual corpus-sha (computed from the on-disk corpus at runner start); equality is checked against the manifest hash.
- `"<input.left.uri>"`, `"<input.right.uri>"` — runner replaces with the URIs the runner used to load the documents; the `content_sha256` field is checked verbatim (so authors compute it once at fixture authoring time).

Authors write fixtures with placeholder sentinels in these positions, and the runner produces the same byte-equivalent output after substitution.

### 17.3 Authoring vs canonical storage

Fixtures are stored **pre-canonical** (in human-readable JSON with normal indentation). The runner canonicalizes both sides (the `expected` block and the SDK's actual output) per RFC 8785 plus the rules in §5.3 before byte-comparison. Authors do not need to hand-canonicalize.

### 17.4 Suppression and policy fixtures

`suppressions` and `policy` are inlined directly in the fixture file (not separate paths). The runner constructs in-memory equivalents of `--ignore-file` / `--policy=` from these fields.

Fixtures testing suppression behavior assert against both `expected.findings[]` (active findings) and `expected.suppressed[]` (suppressed findings).

### 17.5 Determinism

Two consecutive runs of the same fixture must produce byte-identical actual reports. The conformance runner runs each fixture twice and fails if outputs diverge.

### 17.6 Cross-SDK verification

Both Go and TS SDKs run the same fixture suite. Each fixture must pass against both implementations. Mismatches in either implementation are conformance failures.

## 18. Versioning

This convention version: **v1**. The convention version and the report `format_version` (`ob-comparison-report/v1`) bump together.

| Component | Current version | What triggers a bump |
|---|---|---|
| Convention / report `format_version` | v1 | Wire format or normative behavior changes |
| Profile | `OB-2020-12` | Profile-name change indicates a non-backward-compatible rule update |
| Profile corpus-sha | `OB-2020-12@<sha>` | Recomputed on any fixture-corpus change |
| Catalog | v1 | Kind additions; descriptions; severity/category corrections |
| Suppression file schema | v1 | Independent; declared per file via `version:` field |
| Bulk report `format_version` | `ob-bulk-comparison-report/v1` | Independent; tracks bulk envelope changes |

**Profile name vs corpus-sha.** The profile name (`OB-2020-12`) is reserved for material rule changes that aren't backwards-compatible. Within a profile name, the corpus-sha changes as fixtures are added or behaviors locked down without renaming. The corpus-sha is what makes archived reports reproducible against the exact fixtures active when they were generated.

**Tooling forward-compatibility.** A tool reading a report whose `format_version` it doesn't recognize MUST refuse with a clear error.

**Forward-compat field passthrough.** Within a single major `format_version`, a tool reading a report that contains unrecognized top-level fields, unrecognized `Finding` fields, or kinds not in its loaded catalog MUST preserve them verbatim through any pass-through processing (re-serialization, suppression-file evaluation). Unrecognized fields sort lexicographically among recognized fields during canonical-JSON ordering (§5.3). Tools MAY attach a `profile.kind_unknown` finding for unrecognized kinds (§9.2) but MUST NOT drop or rewrite the original. This lets a v1.1 catalog ship a new kind that's silently consumed by v1.0 tools without corrupting the report; major catalog bumps (v1 → v2) are the only break.

**Docs URL slot.** URLs are pinned to the catalog version (`/v1/kinds/<slug>`), not the convention version, so a future convention bump doesn't disturb existing docs URLs.

## 19. Out of scope

The convention places no bound on wall time or memory; pathological inputs (deeply nested schemas, dense `$ref` graphs) may take arbitrary time. The engine MUST be cancellable on a context deadline. The CLI gates on `--timeout` (default 60 s) and emits `profile.timeout_exceeded` (warn) instead of hanging. Performance budgets for the official tooling are documented in the SDK READMEs, not here.

Also out of scope:

- Three-way merge (separate `ob merge` work).
- Visual diff renderers, GUI, web UI.
- LLM-based explanations or migration-guide generation.
- Custom finding codes outside the slug grammar (extension is via vendor namespacing only; see §9).
- Non-2020-12 JSON Schema dialects.
- Partial-match scoring for AI-runtime ranking. The report's `summary.coverage` block plus per-finding structured detail is sufficient for runtimes to derive their own ranking. A future profile may add a normative `score` field once real-world AI-runtime usage informs the design.

## 20. Companion documents

- `subsumption-profile.md` — the OB-2020-12 profile: explicit verdicts for every JSON Schema 2020-12 keyword, edge cases, decidability boundary.
- `findings.md` — the kind catalog with descriptions, severities, and categories.
