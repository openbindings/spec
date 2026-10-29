# Migrating to the 0.2 sources draft

Version 0.2.0 remains unreleased. This guide covers released 0.1 documents and
the two preceding 0.2 working drafts: the earlier source model, whose sources
and bindings carried `content`, and the binding/resources draft of 2026-10-26
to 2026-10-28, which removed sources. Changing only the version string is
insufficient. Released snapshots are unchanged.

## Current shape

An OBI requires `openbindings` and `operations`. Each source requires a
non-empty `kind` and may carry `data`, any JSON value. Each binding requires an
`operation` key and a `source` key and may carry `data` of its own. A source's
kind governs both its data and the data of the bindings naming it, and defines
how they combine. `sources`, `bindings`, `dependencies`, and `schemas` are optional. There
is no `resources` map and no binding `kind` or `content`.

## From the binding/resources draft

1. **Make a source for each artifact and kind.** Where bindings of one kind
   referred to one `resources` entry, create one source carrying that kind and
   the entry's value as `data`. Where a binding inlined its document descriptor
   in its content, move that descriptor into a source of its own. Bindings of
   one kind that referred to nothing shared may share a source only where the
   kind reads them that way.
2. **Point each binding at its source.** Replace the binding's `kind` with
   `source`, naming the source made for it, and rename `content` to `data`,
   keeping in it only what the kind reads from the binding rather than from the
   source, such as a target. The kind's definition says what moves; a generic
   tool cannot split one JSON value into two.
3. **Remove `resources`.** Every entry has become a source's data. An artifact
   that bindings of two kinds shared becomes two sources.
4. **Keep shared schemas in `schemas`.** The map and its `#/schemas/Name`
   references are unchanged, and every entry stays one of the document's
   schemas whether or not anything uses it.
5. **Keep copies of artifact schemas as copies.** A schema reference still
   cannot reach into a source's data (§5.2, OBI-12). Translated copies held in
   `schemas` are unchanged.

## From the earlier 0.2 source model

Rename `content` to `data` on sources and bindings. The shape is otherwise the
same: a source carrying a kind, and bindings naming it. A kind name given to
that draft keeps its standing only where its definition is reissued for this
one; reusing a name does not establish compatibility.

## From 0.1

| 0.1 shape | Current 0.2 draft |
| --- | --- |
| Source `format` | Exact `kind` on the source |
| Source `location` / `content` | Source `data`, in the shape the kind defines; the core has no `location` member |
| Binding `ref` | Binding `data`, read under the source's kind |
| Root `schemas` | Root `schemas`, unchanged |
| Source/binding `priority`, lower preferred | Binding-only `preference`, higher preferred; no selection algorithm |
| Operation-level `idempotent` | Binding-level repetition claim |
| `input: null` / `output: null` to state no schema | Omit the schema field |
| Root `roles`, operation `satisfies` | Qualified aliases for correspondence where intended |
| Transforms and security fields | Kind-defined data; OpenBindings supplies neither transform language nor invocation API |
| Retrieval-relative schema references | Document-local or absolute references under §7 |

Removed unprefixed fields cause structural nonconformance. `x-` fields remain
extensions, but moving old data there does not preserve its old meaning.
`dependencies` declare consumption points and do not replace old correspondence
fields. Their `kinds` constraints compare with the kind of each binding's
source.

## Recheck schemas and references

Schemas govern individual caller-facing values. Interaction cardinality and
lifecycle belong to the kind. Omitting a schema leaves nothing to evaluate for
that direction; `true` and `{}` admit every value; `false` admits none; a null-only
schema admits `null`. The output schema, when present, covers every caller-facing
output, including error-shaped values when the kind exposes them. Other dialects
require meaning-preserving translation before becoming OpenBindings operation
schemas (§5.5).

A `$dynamicAnchor` in a schema with no enclosing `$id` violates OBI-14; place
each one inside a schema that declares `$id`. An absolute `$id` keeps a
standalone schema's internal references scoped to its schema resource. Nothing
in a source's or a binding's data becomes one of the document's schemas.

Aliases share one namespace with operation keys. Correspondence, realization,
consumption, examples, and binding idempotency remain author claims. Neither
conformance nor a matching kind establishes runtime availability or trust.

## Worked shape

For an illustrative kind whose source data carries a `location` and whose
binding data carries a `target`, a document may carry:

```json
{
  "openbindings": "0.2.0",
  "operations": { "getPet": {} },
  "sources": {
    "petApi": {
      "kind": "example.openapi@1",
      "data": { "location": "https://api.example.com/openapi.json" }
    }
  },
  "bindings": {
    "getPet.http": {
      "operation": "getPet",
      "source": "petApi",
      "data": { "target": "#/paths/~1pets/get" }
    }
  }
}
```

The source's `location` is read under its kind.
[The embedded example](examples/embedded-source.obi.json) instead carries a
complete OpenAPI document as source data.

## Validation and implementation status

First check the JSON text for invalid UTF-8, malformed JSON, duplicate member
names, a leading byte-order mark, and escapes that denote unpaired surrogates
(OBI-01). Then run structural validation and the meta-schema, reference,
identity, and dynamic-anchor checks defined by OpenBindings, and check that
each binding names a source (OBI-07). Check source and binding data separately,
under the source's kind.
The focused draft checks are documented
in [conformance/draft-checks/README.md](conformance/draft-checks/README.md).
Existing SDKs, family candidates, and earlier corpora are not presumed to
support this revision; [SOURCE-MODEL-DRAFT.md](SOURCE-MODEL-DRAFT.md) tracks the
remaining migrations. No current-schema pass alone establishes full conformance.
