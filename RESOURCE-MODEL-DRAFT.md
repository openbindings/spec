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
- Optional `resources` replaces both shared source storage and `schemas`.
  Entries are arbitrary JSON values with no required wrapper or type tag.
  The specification assigns meaning through use, not storage.
- A kind can adopt the shared-value reference form
  `{"$ref":"#/resources/name"}` at specified content positions. Lookup returns
  the selected value unchanged. There is no global reference expansion,
  automatic merging, or scanning of unfamiliar content. Each kind determines
  how inline and referenced material are interpreted; the draft no longer
  requires those interpretations to be equivalent.
- Operation schemas use JSON Schema references. A kind's shared-value reference
  and a schema's `$ref` have different semantics even when their spelling is
  identical. Artifact reference roots and bases remain the kind's responsibility.
- Dependencies compare their `kinds` constraints directly with `binding.kind`.

[inline.obi.json](examples/inline.obi.json) demonstrates the three-field shape:
`openbindings`, `operations`, and `bindings`. An OBI publishing a set of operations
can omit bindings. [shared-resources.obi.json](examples/shared-resources.obi.json)
shows two bindings sharing an embedded OpenAPI artifact and operation schemas
explicitly using shared schema values.

## Schema discovery choice

[Section 7.1](openbindings.md#71-schema-recognition) starts with operation input
and output schemas, traverses schema-valued keywords, and follows document-local
schema pointers into `resources`. Recognition reaches a fixed inventory before
value evaluation. Repeated references to one location do not duplicate its
declarations; reference cycles terminate during inventory construction.

An unused resource is opaque. Its `$id`, `$schema`, anchors, and reference-looking
data declare no schemas under OpenBindings. Kind use alone does not change that.
This lets resources hold artifacts of different dialects without making the
entire OBI subject to those artifacts' validation rules.

The cost is explicit discovery: an absolute-URI or anchor reference cannot find
an otherwise unrecognized stored schema by searching its contents. A local
pointer must establish it first, or the schema must be supplied externally.
This is a deliberate change from the dedicated `schemas` map, where placing a
schema in the map declared it even if no operation used it.

Selecting a nested stored value does not interpret its ancestors. If another
schema use also recognizes an ancestor with `$id`, a no-ID child cannot belong
both to that identified resource and to the anonymous document resource. The
draft rejects that conflict rather than depending on traversal order. Selecting
the root of a nested schema with its own absolute `$id` preserves its identity.

These discovery and embedding rules are the main part of the proposal that
needs implementation review. Consolidating storage reduces the document model;
it does not remove the need to specify schema boundaries.

## Draft coverage and remaining migration

| Area | Status |
| --- | --- |
| Specification text and derived structural schema | Updated |
| Top-level examples, overview, changelog, migration guide | Updated |
| Focused structural, recognition, and shared-value lookup checks | Added; see [draft checks](conformance/resource-model-draft/README.md) |
| Historical document corpus and its manifest | Still describe preceding 0.2 source/schema semantics |
| Binding family candidates and their corpora | Still require individual content, reference, and base-preservation designs |
| SDKs and conformance runner adapters | Not migrated or claimed compatible |
| Released snapshots and published binding bundles | Unchanged |

In particular, this draft changes OBI-07 from the old binding-source reference
rule to the required binding-kind rule, and changes the scope of OBI-09 through
OBI-13 through schema recognition. Existing corpus results do not prove these
revised rules. The focused checks are an executable design aid, not a complete
conformance validator or proof that the illustrative kinds can execute.

Before releasing this revision, migrate the document corpus and implementations,
resolve each candidate kind's new content shape, test its reference and
interpretation rules, and run independent implementations against the revised corpus.
Do not mechanically merge old source content with binding content: both can
already be arbitrary JSON, and only the kind can define that migration.
