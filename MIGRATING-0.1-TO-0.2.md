# Migrating to the 0.2 binding/resources draft

Version 0.2.0 remains unreleased. This guide covers both released 0.1 documents
and the preceding 0.2 working draft that used `sources`. Changing
only the version string is insufficient. Released snapshots are unchanged.

## Current shape

An OBI requires `openbindings` and `operations`. Each binding requires an
`operation` key and its own non-empty `kind`. Kind-specific content remains
nested in optional `content`, which accepts any JSON value. `dependencies`,
`schemas`, and `resources` are optional. Root `sources` and binding `source` are
no longer part of the document model.

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
3. **Keep shared schemas in `schemas`.** The `schemas` map and its
   `#/schemas/Name` references are unchanged. Every entry remains one of the
   document's schemas whether or not anything uses it, so its identifiers and
   anchors take effect by placement.
4. **Copy schemas out of artifacts you move into `resources`.** A schema
   reference cannot reach into `resources`. Where an operation needs a schema
   from an artifact now kept there, hold a translated copy in `schemas` (§5.2).
   Rewrite the copy's references that are relative to the artifact's root.
   Keep or assign an absolute `$id` for references relative to the schema's own
   root, choosing one that does not displace a published schema unless that is
   intended.
5. **Move dynamic anchors into `$id` resources.** A `$dynamicAnchor` in a schema
   with no enclosing `$id` now violates OBI-14; place each one inside a schema
   that declares `$id`.
6. **Preserve reference context.** An absolute `$id` keeps a standalone schema's
   internal references scoped to its schema resource. When migrating an
   artifact, follow the kind's rules for its root, base, and references.

Nothing binding content refers to becomes one of the document's schemas.

## From the intermediate draft that stored schemas in `resources`

An intermediate form of this revision dropped `schemas` and kept shared schemas
in `resources`. For a document written to it:

1. **Move shared schemas back to `schemas`,** and rewrite their
   `#/resources/Name` references in operation and shared schemas to
   `#/schemas/Name`. Leave references inside embedded artifacts alone.
2. **Replace pointers into artifacts with copies.** An operation schema that
   pointed into an artifact in `resources` now identifies no schema and violates
   OBI-12; copy and translate the schema as step 4 above describes.
3. **Check what placement now declares.** Every `schemas` entry is checked and
   takes effect whether used or not, and OBI-14 and the extended OBI-12 apply. OpenBindings conformance does not require loading a kind definition
or interpreting its content. Whether that kind accepts the content remains a
separate question.

## Additional changes from 0.1

| 0.1 shape | Current 0.2 draft |
| --- | --- |
| Source `format` | Exact `kind` on each binding |
| Source `location` / `content`, binding `ref` | Kind-defined binding `content`, referring to shared values as its kind defines |
| Root `schemas` | Root `schemas`, unchanged; other shared values in `resources` |
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

First check the JSON text for invalid UTF-8, malformed JSON, duplicate member
names, a leading byte-order mark, and escapes that denote unpaired surrogates
(OBI-01). Then run structural validation and the meta-schema, reference,
identity, and dynamic-anchor checks defined by OpenBindings. Check kind content
separately and verify the kind-defined interpretation of any inline or shared
material.
The focused draft checks are documented
in [conformance/resource-model-draft/README.md](conformance/resource-model-draft/README.md).
Existing SDKs, family candidates, and the earlier corpus are not presumed to
support this revision; [RESOURCE-MODEL-DRAFT.md](RESOURCE-MODEL-DRAFT.md) tracks the
remaining migrations. No current-schema pass alone establishes full conformance.
