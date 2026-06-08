# Comparison Finding Catalog

**Catalog version:** v1
**Companion to:** comparison convention v1
**Applies to:** the official OpenBindings tooling — `ob` CLI, `openbindings-go`, `openbindings-ts`

This document is the catalog of finding rules used by the official tooling's comparison engine. Description strings are normative for formatters claiming OB-catalog conformance — they render the strings verbatim. External citations may quote them, and changing them across catalog versions requires a deprecation cycle.

Third-party tools using a different finding-rule scheme are spec-conformant; they may reuse part of this catalog (e.g., the subsumption rules like `required.*`, `type.*`) and add their own under a vendor namespace (`<vendor>/<slug>`) per `comparison.md` §9.2.

## 1. Overview

Every comparison finding has a stable slug `kind`. The catalog records, for each kind:

- **kind** — the slug wire identifier (e.g., `required.added`)
- **description** — one normative sentence; formatters MUST render this verbatim
- **default categories** — one or more of `breaking`, `non_breaking`, `compliance`, `structural`
- **default severity** — `info`, `warn`, or `error`
- **applies under modes** — which comparison modes can produce this kind

A top-level `aliases:` map records slug renames over time (catalog-level, not per-entry); the map is empty at v1 and grows on slug-rename events.

A finding's `category` array may grow at runtime when policy tags activate `compliance` (see `comparison.md` §10). The defaults below describe the categories absent any policy activation.

The structured companion `findings.yaml` is the implementation source-of-truth: SDKs and the conformance corpus runner consume the YAML, while this Markdown is rendered for human reading. CI verifies they match. When this document and the YAML disagree on description text, the YAML wins (it's machine-readable and tested); the Markdown is regenerated on every catalog change.

## 2. Slug grammar

```
^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$
```

Lowercase ASCII, underscore-within-segment, dot-separator between segments. Vendor-namespaced kinds (third-party catalogs) use `<vendor>/<slug>` form (see `comparison.md` §9.2).

The leading segment of a slug names the entity it concerns: `type`, `required`, `numeric`, `string`, `array`, `object`, `field`, `schema`, `source`, `binding`, `transform`, `security`, `operation`, `roles`, `metadata`, `extension`, `pair`, `profile`, `identical`, etc. Subsequent segments describe the change or violation. Subsumption slugs are position-neutral: `required.added` fires for both input and output schemas, with the schema position recorded in the containing `SchemaCompatibility.direction` field rather than the slug.

There are no sub-ranges, no prefix-based filters, no four-digit allocations.

**Vocabulary conventions for change-suffixes:**

- `narrowed` / `widened` — set or structural operations: type set, items shape. The smaller/larger set determines the suffix.
- `tightened` / `loosened` — bounded numeric/string ranges and counts: minimum, maximum, minLength, maxLength, minItems, maxItems, minProperties, maxProperties.
- `enabled` / `disabled` — boolean toggles: uniqueItems, additionalProperties.
- `added` / `removed` — presence of a keyword or property.
- `changed` / `modified` — value mutation when none of the directional suffixes apply.

These vocabularies coexist; the conventions above describe which applies where.

## 3. Severity defaults

| Severity | Use when |
|---|---|
| `error` | The finding indicates a contract break under at least one mode. |
| `warn`  | The finding indicates a contract change that does not break under default mode but warrants review. |
| `info`  | The finding records a structural change with no semantic effect. |

Severities in this catalog are defaults. When a direction is evaluated (`ob compat`, `ob conform`), the engine projects effective severity and categories based on the subsumption profile's per-direction judgment (see `comparison.md` §10.0). Users may further override per project via suppression files.

## 4. Modes

Modes (from `comparison.md` §7): `subsume`, `equivalent`, `identical`. The "modes" column lists which modes will surface a rule.

---

## 5. Pairing and identification kinds

Kinds describing how operations are paired between L and R, or fail to pair. Most pairing metadata is carried as structured fields on `OperationDelta.match` and `OperationDelta.status`; only error-shaped events surface as findings.

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `pair.unknown_role` | error | structural | all | A satisfies claim references a role not declared in the document's roles map. |
| `pair.unknown_operation` | error | structural | all | A satisfies claim references an operation not present in the role document. |
| `pair.ambiguous` | error | structural | all | Multiple matching strategies produced different pairings; the engine selected the highest-priority one but the ambiguity suggests a document defect. |
| `operation.added` | info | non_breaking | all | An operation present only in the right side; the right has surface area not in the contract. |
| `operation.removed` | error | breaking | all | An operation present only in the left side (the contract); no counterpart in the right. |

Direct, alias, and satisfies pairings are NOT findings; they are metadata recorded in `OperationDelta.match.strategy`. The summary's `paired_via.{direct, alias, satisfies}` aggregates per-strategy counts across all paired operations.

---

## 6. Subsumption kinds

### 6.1 Type-set kinds

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `type.set.narrowed` | error | breaking | subsume, equivalent | The schema's type set is strictly smaller than the contract's; values valid for the contract may be rejected. |
| `type.set.widened` | error | breaking | subsume, equivalent | The schema's type set is strictly larger than the contract's; values not promised by the contract may appear. |
| `required.added` | error | breaking | subsume, equivalent | A required property is required by the schema but not by the contract. |
| `required.removed` | error | breaking | subsume, equivalent | A property required by the contract is not required by the schema. |
| `required.optional_to_required` | error | breaking | subsume, equivalent | An optional property in the contract became required in the schema. |
| `required.required_to_optional` | warn | non_breaking | subsume, equivalent | A required property in the contract became optional in the schema. |
| `type.integer_to_number` | error | breaking | subsume, equivalent | A type widened from `integer` to `number`; non-integers may appear. |
| `type.number_to_integer` | warn | non_breaking | subsume, equivalent | A type narrowed from `number` to `integer`; floats no longer accepted. |

### 6.2 Numeric bounds

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `numeric.minimum.tightened` | error | breaking | subsume, equivalent | A numeric `minimum` increased; values previously accepted are now rejected. |
| `numeric.minimum.loosened` | warn | non_breaking | subsume, equivalent | A numeric `minimum` decreased; new lower values are now accepted. |
| `numeric.maximum.tightened` | error | breaking | subsume, equivalent | A numeric `maximum` decreased; values previously accepted are now rejected. |
| `numeric.maximum.loosened` | warn | non_breaking | subsume, equivalent | A numeric `maximum` increased. |
| `numeric.exclusive_bound.changed` | warn | non_breaking | subsume, equivalent | A numeric bound's exclusivity flipped (inclusive vs exclusive). |
| `numeric.multiple_of.changed` | error | breaking | subsume, equivalent | A `multipleOf` constraint changed in a way not strictly tighter or looser. |

### 6.3 String bounds

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `string.min_length.tightened` | error | breaking | subsume, equivalent | `minLength` increased; shorter strings are now rejected. |
| `string.min_length.loosened` | warn | non_breaking | subsume, equivalent | `minLength` decreased. |
| `string.max_length.tightened` | error | breaking | subsume, equivalent | `maxLength` decreased; longer strings are now rejected. |
| `string.max_length.loosened` | warn | non_breaking | subsume, equivalent | `maxLength` increased. |
| `string.pattern.added` | error | breaking | subsume, equivalent | A `pattern` constraint was added; some previously valid strings may be rejected. |
| `string.pattern.removed` | warn | non_breaking | subsume, equivalent | A `pattern` constraint was removed. |
| `string.pattern.modified` | warn | non_breaking | subsume, equivalent | A `pattern` was modified to a non-equal regex; subsumption is unverified (see `unverified.regex_containment`). |
| `string.format.added` | warn | non_breaking | subsume, equivalent | A `format` constraint was added; under format-assertion mode this restricts the value space. (Requires `--assert-format`.) |
| `string.format.removed` | warn | non_breaking | subsume, equivalent | A `format` constraint was removed. (Requires `--assert-format`.) |
| `string.format.incompatible` | error | breaking | subsume, equivalent | A `format` value changed to a disjoint or non-subsuming format per the format vocabulary (e.g., `ipv4` → `ipv6`, `email` → `uri`). (Requires `--assert-format`.) |

### 6.4 Array rules

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `array.items.narrowed` | error | breaking | subsume, equivalent | The `items` schema became more restrictive; previously valid arrays may be rejected. |
| `array.items.widened` | warn | non_breaking | subsume, equivalent | The `items` schema became less restrictive. |
| `array.prefix_items.narrowed` | error | breaking | subsume, equivalent | A `prefixItems` entry became more restrictive at a given position. |
| `array.prefix_items.widened` | warn | non_breaking | subsume, equivalent | A `prefixItems` entry became less restrictive. |
| `array.min_items.tightened` | error | breaking | subsume, equivalent | `minItems` increased. |
| `array.min_items.loosened` | warn | non_breaking | subsume, equivalent | `minItems` decreased. |
| `array.max_items.tightened` | error | breaking | subsume, equivalent | `maxItems` decreased. |
| `array.max_items.loosened` | warn | non_breaking | subsume, equivalent | `maxItems` increased. |
| `array.unique_items.enabled` | error | breaking | subsume, equivalent | `uniqueItems` was set to true; arrays with duplicates are now rejected. |
| `array.unique_items.disabled` | warn | non_breaking | subsume, equivalent | `uniqueItems` was set to false. |
| `array.contains.added` | error | breaking | subsume, equivalent | A `contains` constraint was added. |
| `array.contains.removed` | warn | non_breaking | subsume, equivalent | A `contains` constraint was removed. |

### 6.5 Object rules

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `object.additional_properties.disabled` | error | breaking | subsume, equivalent | `additionalProperties` became `false`; previously accepted extra properties are now rejected. |
| `object.additional_properties.enabled` | warn | non_breaking | subsume, equivalent | `additionalProperties` became `true` (or absent). |
| `object.property_names.added` | error | breaking | subsume, equivalent | A `propertyNames` constraint was added. |
| `object.property_names.removed` | warn | non_breaking | subsume, equivalent | A `propertyNames` constraint was removed. |
| `object.dependent_required.added` | error | breaking | subsume, equivalent | A `dependentRequired` constraint was added. |
| `object.dependent_required.removed` | warn | non_breaking | subsume, equivalent | A `dependentRequired` constraint was removed. |
| `object.min_properties.tightened` | error | breaking | subsume, equivalent | `minProperties` increased. |
| `object.min_properties.loosened` | warn | non_breaking | subsume, equivalent | `minProperties` decreased. |
| `object.max_properties.tightened` | error | breaking | subsume, equivalent | `maxProperties` decreased. |
| `object.max_properties.loosened` | warn | non_breaking | subsume, equivalent | `maxProperties` increased. |

### 6.6 Mode-gated kinds

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `identical.subsumption_only` | error | breaking | identical | The schema is `compatible` (subsumes correctly) but not `identical` (post-normalization equivalence). Fires under `--mode=identical` to flag the failure surface that subsumption-only modes pass silently. |

### 6.7 Enum / const rules

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `enum.value.removed` | error | breaking | subsume, equivalent | A value was removed from an `enum`. |
| `enum.value.added` | warn | non_breaking | subsume, equivalent | A value was added to an `enum`. |
| `const.changed` | error | breaking | subsume, equivalent | A `const` value changed. |
| `enum.collapsed_to_const` | warn | non_breaking | subsume, equivalent | An `enum` of multiple values was reduced to a single-value `const`. |
| `const.expanded_to_enum` | warn | non_breaking | subsume, equivalent | A `const` was replaced by an `enum` containing additional values. |

### 6.8 Combinator rules

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `oneof.pairing.failed` | warn | non_breaking | subsume, equivalent | `oneOf` branches could not be paired by subsumption (see `unverified.combinator_pairing`). |
| `anyof.pairing.failed` | warn | non_breaking | subsume, equivalent | `anyOf` branches could not be paired by subsumption. |
| `allof.branch.added` | error | breaking | subsume, equivalent | An `allOf` branch was added; the schema is strictly more constrained. |
| `allof.branch.removed` | warn | non_breaking | subsume, equivalent | An `allOf` branch was removed; the schema is less constrained. |
| `not.subsumption.flipped` | warn | non_breaking | subsume, equivalent | A `not` schema's inner subsumption is undecidable in this position; see `unverified.combinator_pairing`. |

### 6.9 Conditional rules

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `conditional.if.differs` | warn | non_breaking | subsume, equivalent | The `if` schemas of two conditionals are not byte-identical; subsumption is unverified (see `unverified.conditional_not_byte_equal`). |
| `conditional.then.incompatible` | error | breaking | subsume, equivalent | When the `if` schemas match, the `then` branches are incompatible. |
| `conditional.else.incompatible` | error | breaking | subsume, equivalent | When the `if` schemas match, the `else` branches are incompatible. |

### 6.10 Unverified outcomes

These rules accompany a `verdict: "unverified"` with the reason. Severity is `warn` by default; under `--strict-undecidable` they are escalated to `error`.

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `unverified.external_ref` | warn | non_breaking | subsume, equivalent | Subsumption depends on a `$ref` the engine did not resolve (external document). |
| `unverified.cycle_depth` | warn | non_breaking | subsume, equivalent | Subsumption traversal hit the cycle-depth bound without resolving. |
| `unverified.regex_containment` | warn | non_breaking | subsume, equivalent | Pattern subsumption beyond byte-equality is not decided by the profile. |
| `unverified.combinator_pairing` | warn | non_breaking | subsume, equivalent | `oneOf` / `anyOf` branches could not be paired soundly. |
| `unverified.conditional_not_byte_equal` | warn | non_breaking | subsume, equivalent | `if`/`then`/`else` schemas with non-byte-equal `if` schemas. |
| `unverified.dynamic_ref_external` | warn | non_breaking | subsume, equivalent | A `$dynamicRef` resolves outside the current document. |
| `unverified.unsupported_keyword` | warn | non_breaking | subsume, equivalent | The schema uses a keyword the profile does not recognize. |

---

## 7. Structural-change rules

These kinds describe document changes (additions, removals, modifications). They appear as findings (with slug `kind`), unified into the same `findings[]` array as subsumption kinds. Their default category includes `structural` or `non_breaking`/`breaking` per the table.

### 7.1 Field-level

`field.removed` is `error` rather than `warn` despite being descriptive: removing a field is a breaking change for any consumer that read it, and the gate should fail by default.

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `field.added` | info | non_breaking | all | A field was added to the schema. |
| `field.removed` | error | breaking | all | A field was removed from the schema. |
| `field.deprecated.changed` | warn | non_breaking | all | The `deprecated` flag changed on a field. |
| `field.default.changed` | warn | non_breaking | all | A `default` value changed. |
| `metadata.changed` | info | structural | all | A purely descriptive metadata value changed (description, title, examples, comment, tags, or other annotation-only keyword). The pointer identifies which field changed; `before`/`after` carry the values. |

### 7.2 Schema-map

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `schema.added` | info | non_breaking | all | A top-level `schemas` entry was added. |
| `schema.removed` | error | breaking | all | A top-level `schemas` entry was removed. |

### 7.3 Source

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `source.added` | info | non_breaking | all | A `sources` entry was added. |
| `source.removed` | error | breaking | all | A `sources` entry was removed; bindings referencing it would break. |
| `source.location.changed` | warn | non_breaking | all | A source's `location` URI changed. |
| `source.format.changed` | error | breaking | all | A source's `format` token changed. |
| `source.content.changed` | warn | non_breaking | all | A source's inline `content` was modified. |
| `source.priority.changed` | warn | non_breaking | all | A source's `priority` changed; binding selection ordering may shift. |

### 7.4 Binding

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `binding.added` | info | non_breaking | all | A `bindings` entry was added. |
| `binding.removed` | error | breaking | all | A `bindings` entry was removed. |
| `binding.ref.changed` | warn | non_breaking | all | A binding's `ref` was changed. |
| `binding.source.changed` | warn | non_breaking | all | A binding's `source` reference was changed. |
| `binding.security.changed` | warn | non_breaking | all | A binding's `security` reference was changed. |
| `binding.input_transform.changed` | warn | non_breaking | all | A binding's `inputTransform` was changed. |
| `binding.output_transform.changed` | warn | non_breaking | all | A binding's `outputTransform` was changed. |
| `binding.priority.changed` | warn | non_breaking | all | A binding's `priority` value changed; affects selection order when multiple bindings match. |
| `binding.deprecated.changed` | warn | non_breaking | all | A binding's `deprecated` flag changed. |

### 7.5 Transform

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `transform.added` | info | non_breaking | all | A `transforms` entry was added. |
| `transform.removed` | warn | non_breaking | all | A `transforms` entry was removed. |
| `transform.expression.changed` | warn | non_breaking | all | A transform's JSONata expression was modified. |

### 7.6 Security

These rules carry `compliance` in every occurrence (see §9.2).

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `security.entry.added` | info | non_breaking, compliance | all | A `security` entry was added. |
| `security.entry.removed` | error | breaking, compliance | all | A `security` entry was removed. |
| `security.method.type.changed` | error | breaking, compliance | all | A security method's `type` changed (e.g., `bearer` to `oauth2`). |
| `security.method.scopes.changed` | warn | non_breaking, compliance | all | A security method's OAuth2 scopes changed. |
| `security.method.authorize_url.changed` | warn | non_breaking, compliance | all | A security method's `authorizeUrl` changed. |
| `security.method.token_url.changed` | warn | non_breaking, compliance | all | A security method's `tokenUrl` changed. |
| `security.method.client_id.changed` | warn | non_breaking, compliance | all | A security method's `clientId` changed. |
| `security.method.api_key_name.changed` | warn | non_breaking, compliance | all | A `type: apiKey` method's `name` field changed. |
| `security.method.api_key_in.changed` | error | breaking, compliance | all | A `type: apiKey` method's `in` field changed (header/query/cookie). |
| `security.method.added` | info | non_breaking, compliance | all | A new security method was added to an existing security entry's preference array. |
| `security.method.removed` | error | breaking, compliance | all | A security method was removed from an existing security entry's preference array. |
| `security.method.reordered` | warn | non_breaking, compliance | all | The preference order of methods within a security entry's array changed. |

### 7.7 Operation-level

These rules apply at the operation level rather than per-field.

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `operation.aliases.changed` | warn | non_breaking | all | An operation's `aliases` array changed. |
| `operation.satisfies.changed` | warn | non_breaking | all | An operation's `satisfies` claims changed. |
| `operation.idempotent.changed` | warn | non_breaking | all | An operation's `idempotent` flag changed. |

(`operation.added` and `operation.removed` live in §5 alongside other pairing-related rules.)

### 7.8 Operation declaration transitions

The OBI spec distinguishes three states for `input`/`output`: absent (field omitted), null (`"input": null`), or present (any schema). Transitions between these are contract-meaningful.

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `operation.input.declared` | info | non_breaking | all | The `input` field was added (absent → declared). |
| `operation.input.undeclared` | error | breaking | all | The `input` field was removed (declared → absent). |
| `operation.input.null_to_schema` | warn | non_breaking | all | `input: null` (no inputs accepted) became a schema. |
| `operation.input.schema_to_null` | error | breaking | all | A schema became `input: null`. |
| `operation.output.declared` | info | non_breaking | all | The `output` field was added. |
| `operation.output.undeclared` | error | breaking | all | The `output` field was removed. |
| `operation.output.null_to_schema` | warn | non_breaking | all | `output: null` (no output emitted) became a schema; consumers may ignore the new data. |
| `operation.output.schema_to_null` | error | breaking | all | A schema became `output: null`. |
| `operation.deprecated.changed` | warn | non_breaking | all | An operation's `deprecated` flag changed. |

### 7.9 Top-level metadata

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `metadata.name.changed` | warn | non_breaking | all | The document's `name` changed. |
| `metadata.openbindings_version.changed` | warn | non_breaking | all | The document's `openbindings` (spec version) field changed. |
| `roles.entry.added` | info | non_breaking | all | A `roles` entry was added. |
| `roles.entry.removed` | error | breaking | all | A `roles` entry was removed. |
| `roles.entry.changed` | warn | non_breaking | all | A `roles` entry's URI changed. |

### 7.10 Extensions

OBI extension fields (those with the `x-` prefix) are tool-defined. The catalog tracks their changes generically; specific `x-policy-*` extensions activate `compliance` automatically.

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `extension.added` | info | structural | all | An `x-*` extension field was added at this position. |
| `extension.removed` | info | structural | all | An `x-*` extension field was removed. |
| `extension.changed` | info | structural | all | An `x-*` extension field's value changed. |
| `extension.policy.added` | warn | non_breaking, compliance | all | A `x-policy-*` extension field was added; compliance review warranted. |
| `extension.policy.removed` | warn | non_breaking, compliance | all | A `x-policy-*` extension field was removed. |
| `extension.policy.changed` | warn | non_breaking, compliance | all | A `x-policy-*` extension field's value changed. |

---

## 8. Profile / engine rules

Findings about the comparison process itself, not about the documents being compared.

| Kind | Severity | Categories | Modes | Description |
|---|---|---|---|---|
| `profile.schema.invalid_type_array` | error | structural | all | A schema declares `type` as an empty array or contains a non-2020-12 value. |
| `profile.schema.not_2020_12` | error | structural | all | A schema does not conform to JSON Schema 2020-12 (e.g., uses draft-04 boolean exclusiveMinimum). |
| `profile.schema.unsupported_keyword` | warn | structural | all | A schema uses a keyword the profile does not understand; subsumption may be incomplete. |
| `profile.schema.profile_version_mismatch` | error | structural | all | One side declares a JSON Schema dialect not supported by the OB-2020-12 profile. |
| `profile.ref.resolution_failed` | error | structural | all | A `$ref` could not be resolved; subsumption was abandoned for that branch. |
| `profile.ref.cycle_depth_exceeded` | warn | structural | all | Reference traversal exceeded the cycle-depth bound. |
| `profile.schema.vocabulary_present` | error | structural | all | A schema declares `$vocabulary` (forbidden by OBI-D-08). |
| `profile.suppressions.rule_expired` | warn | structural | all | A suppression rule's `until:` timestamp has passed; the rule is not applied. |
| `profile.format_version_mismatch` | warn | structural | all | A consumer is reading a report whose `format_version` differs from the consumer's expected version; best-effort interpretation may be lossy. |
| `profile.policy.tag_unknown` | info | structural | all | A `--policy=<file>` declared a tag the catalog's activation map does not recognize; the tag is preserved but does not activate any compliance dimension. |
| `profile.kind_unknown` | warn | structural | all | A finding's `kind` slug is not in the catalog and does not carry a recognized vendor namespace; consumers see the kind verbatim and SHOULD treat severity as `info`. |
| `profile.timeout_exceeded` | warn | structural | all | Comparison run hit the configured timeout; the report's verdict is `unverified` for any operation not yet fully evaluated. |
| `profile.alias.cycle` | error | structural | all | A graph cycle was detected during alias-based operation pairing or `satisfies` resolution; the affected branch is not paired. |
| `profile.kind_translated` | info | structural | all | A suppression rule referenced a kind that was translated via the catalog's top-level `aliases:` table; the new slug applies. |

---

## 9. Compliance category activation

Some rules activate the `compliance` category at runtime when policy tags fire. Activation is deterministic given the document's tags and any external `--policy=<file>`.

### 9.1 Tag-driven activation

| Rule | Activates `compliance` when... |
|---|---|
| `field.added` | the added field has any `x-policy-*` tag |
| `field.removed` | the removed field had any `x-policy-*` tag |
| `required.added` | the field has `x-policy-sensitive` |
| `required.required_to_optional` | the field has `x-policy-sensitive` |
| `string.pattern.added` | the field has `x-policy-sensitive` |
| `string.pattern.removed` | the field has `x-policy-sensitive` |
| `enum.value.removed` | the field has `x-policy-sensitive` |
| `enum.value.added` | the field has `x-policy-sensitive` |

### 9.2 Always-compliance kinds

These kinds carry `compliance` in every occurrence regardless of tags, because the events they describe are inherently compliance-relevant. They are listed in §7.6 (security) and §7.10 (extension.policy.*) above with the `compliance` category baked into their default category set.

### 9.3 Side-of-tag activation

For tag-driven activation: the engine checks for the policy tag on the side where the change is observed. `field.added` checks the right side; `field.removed` checks the left side. For paired-field kinds (`required.added`, `string.pattern.removed`, etc.), either side's tag activates compliance. See `comparison.md` §10.2.

### 9.4 SARIF projection

When `compliance` is in a finding's `category` array, the SARIF projection's `properties.security-severity` is set per `comparison.md` §11.2.

---

## 10. Annex A — Format vocabulary containment

Used by `--assert-format` mode (off by default). When format assertion is enabled, the profile compares `format` values per these containment relations.

Notation: `X ⊆ Y` means "every value validating as X also validates as Y" (X is the smaller value set).

```
uuid                   ⊆ string
email                  ⊆ string
idn-email              ⊆ string
hostname               ⊆ string
idn-hostname           ⊆ string
ipv4                   ⊆ string         (disjoint from ipv6)
ipv6                   ⊆ string         (disjoint from ipv4)
uri                    ⊆ uri-reference
uri                    ⊆ iri
iri                    ⊆ iri-reference
uri-reference          ⊆ iri-reference
uri-template           ⊆ string
json-pointer           ⊆ string
relative-json-pointer  ⊆ string
regex                  ⊆ string
date                   ⊆ string         (disjoint from time and date-time)
time                   ⊆ string         (disjoint from date and date-time)
date-time              ⊆ string         (disjoint from date and time;
                                          date-time = date "T" time
                                          per RFC 3339, not a superset)
duration               ⊆ string
```

`date` and `time` are NOT subsets of `date-time`. RFC 3339 defines `date-time` as `full-date "T" full-time` — a bare date or bare time is not a `date-time` value.

Disjoint formats (`ipv4` vs `ipv6`, `date` vs `time` vs `date-time`, `email` vs `uri`) produce `string.format.incompatible` findings. Strict containment (e.g., `uuid` → `string`) is compatible in the output direction (covariance) and incompatible in the input direction (contravariance) per the standard subsumption rules. Equality of format strings is `identical`.

---

## 11. Annex B — Optional `hint:` field per rule

The catalog MAY carry a curated `hint:` line per rule. When present, human renderers print it as `→ <hint>` on the line below the finding. The hint is optional and may be added incrementally without bumping the catalog version (description strings are normative; hints are advisory).

Example entries with hints:

```
required.added
  description: A required property is required by the schema but not by the contract.
  hint: New required input fields break clients that didn't send the field. Make it optional or coordinate a SemVer-major release.

enum.value.removed
  description: A value was removed from an enum.
  hint: Output: clients that expected this value get unmatched responses. Input: clients that sent it get rejected.
```

The hint is rendered verbatim, like the description. Authoring guidelines: short, action-oriented, no LLM-generated content.

---

## 12. Versioning

Catalog version: **v1**. Companion to comparison convention v1.

- New rules added in minor catalog versions; existing rules never change wire identifier or description meaning.
- Renaming a rule adds a new slug and keeps the old slug as an alias. Aliases are documented in this catalog and preserved indefinitely.
- Retiring a rule (full removal of both the slug and its alias) is a major catalog version bump.
- Description strings are normative for formatters claiming OB-catalog conformance; rewording requires bumping the catalog patch version and noting the change in CHANGELOG.

The catalog version advances independently of the convention version.

The catalog is published at `https://openbindings.com/conventions/v1/kinds/` with a per-kind page at `https://openbindings.com/conventions/v1/kinds/<slug>` (e.g., `required.added`). Vendor-namespaced slugs use URL-encoding for the `/` separator. The `helpUri` field in SARIF output and the docs URL rendered by the human formatter both point at this URL. The URL slot is pinned to the catalog version (`/v1/`), not the convention version.
