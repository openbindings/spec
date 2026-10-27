# Migrating to the 0.2 binding/resources draft

Version 0.2.0 remains unreleased. This guide covers both released 0.1 documents
and the preceding 0.2 working draft that used `sources` and `schemas`. Changing
only the version string is insufficient. Released snapshots are unchanged.

## Current shape

An OBI requires `openbindings` and `operations`. Each binding requires an
`operation` key and its own non-empty `kind`. Kind-specific content remains
nested in optional `content`, which accepts any JSON value. `dependencies` and
`resources` are optional. Root `sources`, root `schemas`, and binding `source`
are no longer part of the document model.

## From the preceding 0.2 draft

1. **Choose the binding's kind.** Move the intended interpretation onto each
   binding. The old source's kind interpreted two separate content values;
   a new kind definition must explicitly describe how its single binding
   content replaces them. Reusing a name does not establish compatibility.
2. **Reorganize content under that kind.** Inline material used once, or place
   shared material in `resources` and reference it from a position the kind
   defines. A generic tool cannot safely merge two arbitrary JSON values.
   Preserve absence versus explicit `null`, descriptions, and extension data
   through a documented kind-specific migration.
3. **Move shared schemas and update their uses.** Replace intended
   `#/schemas/Name` references with `#/resources/Name`, resolving name collisions
   with other shared material. Rewrite only references whose original scope
   is the OBI document resource. Do not search-and-replace pointers inside
   identified schemas or embedded artifacts.
4. **Establish schema entry points.** Operation schemas and their local pointers
   into resources determine the inventory (§7.1). An otherwise unused stored
   `$id` is not registered automatically. If an operation formerly referenced
   a schema only by its absolute identifier, use a local pointer to establish
   that schema in the document, or publish/provide it as an external schema.
   Once recognized, its identifier is available to other schema references.
5. **Preserve reference context.** An absolute `$id` keeps a standalone schema's
   internal references scoped to its schema resource. When migrating an
   artifact, follow the kind's rules for its root, base, and references.
   Shared-value lookup supplies no artifact base or guarantee that inline and
   shared representations have equivalent interpretation.
6. **Check consequences of use.** Unused resources remain arbitrary JSON. Adding
   a schema use can reveal malformed schemas, duplicate identifiers or anchors,
   or conflicting schema-resource membership. Multiple references to the same
   location count its declarations once.

A resource reference in binding content does not add a schema to the document's
inventory. OpenBindings conformance does not require loading a kind definition
or interpreting its content. Whether that kind accepts the content remains a
separate question.

## Additional changes from 0.1

| 0.1 shape | Current 0.2 draft |
| --- | --- |
| Source `format` | Exact `kind` on each binding |
| Source `location` / `content`, binding `ref` | Kind-defined binding `content`, optionally referencing shared values |
| Root `schemas` | Optional `resources`; schemas are recognized through use |
| Source/binding `priority`, lower preferred | Binding-only `preference`, higher preferred; no selection algorithm |
| Operation-level `idempotent` | Binding-level repetition claim |
| `input: null` / `output: null` to state no schema | Omit the schema field |
| Root `roles`, operation `satisfies` | Qualified aliases for correspondence where intended |
| Transforms and security fields | Kind-defined content; OpenBindings supplies neither transform language nor invocation API |
| Retrieval-relative schema references | Document-local or absolute references under §7 |

Removed unprefixed fields cause structural nonconformance. `x-` fields remain
extensions, but moving old data there does not preserve its old meaning.
`dependencies` declare consumption points and do not replace old correspondence
fields. Their `kinds` constraints now compare directly with each binding's kind.

## Recheck input and output schemas

Schemas govern individual caller-facing values. Interaction cardinality and
lifecycle belong to the kind. Omitting a schema leaves nothing to evaluate for
that direction; `true` and `{}` admit every value; `false` admits none; a null-only
schema admits `null`. The output schema, when present, covers every caller-facing
output, including error-shaped values when the kind exposes them. Other dialects
require meaning-preserving translation before becoming OpenBindings operation
schemas.

Aliases share one namespace with operation keys. Correspondence, realization,
consumption, examples, and binding idempotency remain author claims. Neither
conformance nor a matching kind establishes runtime availability or trust.

## Worked shape

For an illustrative kind accepting a `document` descriptor and `target`, a
binding may carry:

```json
{
  "openbindings": "0.2.0",
  "operations": { "getPet": {} },
  "bindings": {
    "getPet.http": {
      "operation": "getPet",
      "kind": "example.openapi@1",
      "content": {
        "document": { "$ref": "#/resources/petApi" },
        "target": "#/paths/~1pets/get"
      }
    }
  },
  "resources": {
    "petApi": { "location": "https://api.example.com/openapi.json" }
  }
}
```

The resource above is a shared descriptor whose `location` the kind interprets.
[The embedded example](examples/shared-resources.obi.json)
instead shares a complete OpenAPI document.

## Validation and implementation status

Run structural validation, then the schema recognition, meta-schema, reference,
and identity checks defined by OpenBindings. Check kind content separately and
verify the kind-defined interpretation of any inline or shared material.
The focused draft checks are documented
in [conformance/resource-model-draft/README.md](conformance/resource-model-draft/README.md).
Existing SDKs, family candidates, and the earlier corpus are not presumed to
support this revision; [RESOURCE-MODEL-DRAFT.md](RESOURCE-MODEL-DRAFT.md) tracks the
remaining migrations. No current-schema pass alone establishes full conformance.
