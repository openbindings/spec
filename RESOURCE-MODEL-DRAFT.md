# Binding/resources revision

This is an unreleased revision of the 0.2 working draft. The normative proposal
is in [openbindings.md](openbindings.md); this note records its scope and the
implementation work still needed. It is not a new released version.

## Decisions in this draft

- Each binding carries `operation`, `kind`, and optional `content`. Keeping
  content nested gives the kind its own namespace and preserves room for future
  fields on the binding. Content can be any JSON value, including `null`.
- `sources` and `bindings[*].source` are removed. A kind decides whether its
  binding needs an artifact, a target selector, both, or neither.
- The `schemas` map stays, and optional `resources` replaces shared source
  storage. Every `schemas` entry is one of the document's schemas, used or not.
  `resources` entries are arbitrary JSON values with no required wrapper or type
  tag, and OpenBindings never reads them as schemas.
- A kind can adopt the shared-value reference form
  `{"$ref":"#/resources/name"}` or `{"$ref":"#/schemas/name"}` at specified
  content positions. Lookup returns the selected value unchanged. There is no
  global reference expansion, automatic merging, or scanning of unfamiliar
  content. Each kind determines how inline and referenced material are
  interpreted; the draft no longer requires those interpretations to be
  equivalent. A kind that reads a `schemas` entry as JSON Schema reads the
  document's schema.
- Operation schemas use JSON Schema references. A kind's shared-value reference
  and a schema's `$ref` have different semantics even when their spelling is
  identical. Artifact reference roots and bases remain the kind's responsibility.
- Dependencies compare their `kinds` constraints directly with `binding.kind`.

[inline.obi.json](examples/inline.obi.json) demonstrates the three-field shape:
`openbindings`, `operations`, and `bindings`. An OBI publishing a set of operations
can omit bindings. [shared-resources.obi.json](examples/shared-resources.obi.json)
shows two bindings sharing an embedded OpenAPI artifact, and operation schemas
using a copy of its `Task` schema held in `schemas`.

## Schema placement

Where a value sits decides how OpenBindings reads it. The document's schemas are
each operation's `input` and `output`, each `schemas` entry, and their subschemas
through the schema keywords (§7). Following a reference never adds to them.

An intermediate form of this revision dropped `schemas` and recognized a schema
in `resources` when an operation schema pointed at it. That let an operation
schema point into an embedded artifact, such as an OpenAPI component or an MCP
tool's input schema. The artifact's own references were then read from the OBI
root, and its dialect as 2020-12: `#/components/schemas/User` found nothing, a
reference inside an OBI stored as a resource found the outer document's schema
of the same name, and OpenAPI 3.0's `nullable` or draft-07's `dependencies`
silently stopped applying. The procedure also needed ancestor and
resource-membership rules that the typed map makes unnecessary.

With the map restored, a schema reference into `resources` identifies no schema
the document contains and so violates OBI-12, loudly, and an `$id` inside a
resource identifies nothing to the document's schemas. An operation that wants a schema from an artifact holds a
translated copy in `schemas`; §5.2 notes how a schema from another document is read there.

Three rules come with placement:

- A pointer may reach a schema inside a schema that declares `$id`, and
  identifies it in that resource (§7.3). Membership is fixed by placement, so
  the pointer cannot give the schema a second reading.
- A reference that resolves into a schema resource the document contains must
  identify a schema there (OBI-12), instead of having an undefined result.
- A `$dynamicAnchor` in the document resource violates OBI-14. The document
  resource is outermost in every evaluation's dynamic scope, so such an anchor
  would capture `$dynamicRef`s throughout the document, including through a
  `schemas` entry nothing uses.

Placement has costs. An embedded artifact's schema is copied rather than reused
in place, and the copy can drift from the artifact. Everything in `schemas` takes
effect whether used or not, including `$id`s that replace published schemas, so
unfinished or untranslated material waits in `resources`.

## Draft coverage and remaining migration

| Area | Status |
| --- | --- |
| Specification text and derived structural schema | Updated |
| Top-level examples, overview, changelog, migration guide | Updated |
| Focused structural, schema-inventory, and shared-value lookup checks | Added; see [draft checks](conformance/resource-model-draft/README.md) |
| Historical document corpus and its manifest | Still describe the preceding source model; its schema cases match the restored `schemas` map, except where OBI-12's extension or OBI-14 now differ |
| Binding family candidates and their corpora | Still require individual content, reference, and base-preservation designs |
| SDKs and conformance runner adapters | Not migrated or claimed compatible |
| Released snapshots and published binding bundles | Unchanged |

In particular, this draft changes OBI-07 from the old binding-source reference
rule to the required binding-kind rule, permits pointers into schemas that
declare `$id`, extends OBI-12 to references that resolve into a schema resource
the document contains, and adds OBI-14. Existing corpus results do not
prove these revised rules. The focused checks are an executable design aid, not a complete
conformance validator or proof that the illustrative kinds can execute.

Before releasing this revision, migrate the document corpus and implementations,
resolve each candidate kind's new content shape, test its reference and
interpretation rules, and run independent implementations against the revised corpus.
Do not mechanically merge old source content with binding content: both can
already be arbitrary JSON, and only the kind can define that migration.
