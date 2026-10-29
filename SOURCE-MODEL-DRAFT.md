# Sources revision

This is an unreleased revision of the 0.2 working draft. The normative text is
in [openbindings.md](openbindings.md); this note records its scope and the
implementation work still needed. It is not a new released version.

## Decisions in this draft

- `sources` returns to the document. A source carries `kind` and optional
  `data`; a binding carries `operation`, `source`, and optional `data`. Both
  data values are any JSON, including `null`, and both are read under the
  source's kind, which also defines how they combine. A binding has no kind of
  its own.
- Why sources returned. Under the binding-owned model of 2026-10-26 to
  2026-10-28, nothing in a document said which bindings came from which
  artifact or service. A tool could not name the API a set of bindings shares,
  ask which bindings came from one description, scope what a description offers
  against what the document has, check drift per description, or regenerate a
  document from itself; and two descriptions of one kind were told apart only
  by what their content referred to, which the specification disclaims. Naming
  the source in the document answers each of these while the specification
  still reads no data.
- `data`, not `content`, on both sides: one word for both, plainly distinct
  from an operation's input and output.
- `resources` is removed. A source's data is where an artifact, an address, or
  a descriptor lives. One artifact read under two kinds is two sources.
- The specification makes no claim about what data refers to, or how
  (invariant 4). Data is read in its document. There is no global reference
  expansion, automatic merging, or scanning of unfamiliar data. A kind that uses
  JSON Pointer references cites RFC 6901 itself, and any house style the
  project's own kinds share belongs in `binding-specs/PROJECT-POLICY.md`.
- OBI-07 is the binding's `source` reference, as it was before the
  binding-owned draft. A source's `kind` being a non-empty string is structural
  (OBI-02).
- Dependencies compare their `kinds` constraints with the kind of each
  binding's source.
- Words. The source is the entry; the artifact or service is what its data
  holds or addresses; the kind is neither one's format. A source may hold an
  OpenAPI 3.1 document while its kind is `example.openapi@1`.

[kind-only.obi.json](examples/kind-only.obi.json) shows a source carrying only a
kind, and a binding carrying only `operation` and `source`.
[embedded-source.obi.json](examples/embedded-source.obi.json) carries one
OpenAPI document as source data shared by two bindings, with operation schemas
using a copy of its `Task` schema held in `schemas`.
[multi-source.obi.json](examples/multi-source.obi.json) has two sources of one
kind.

## Schema placement

Where a value sits decides how OpenBindings reads it. The document's schemas are
each operation's `input` and `output`, each `schemas` entry, and their subschemas
through the schema keywords (§7). Following a reference never adds to them.

An intermediate form of the preceding revision dropped `schemas` and recognized
a schema in `resources` when an operation schema pointed at it. That let an
operation schema point into an embedded artifact, such as an OpenAPI component
or an MCP tool's input schema. The artifact's own references were then read from
the OBI root, and its dialect as 2020-12: `#/components/schemas/User` found
nothing, a reference inside an OBI stored as a resource found the outer
document's schema of the same name, and OpenAPI 3.0's `nullable` or draft-07's
`dependencies` silently stopped applying. The typed `schemas` map, restored on
2026-10-27, stands in this revision.

A schema reference into `sources` identifies no schema the document contains
and so violates OBI-12, loudly, and an `$id` inside a source's data identifies
nothing to the document's schemas. An operation that wants a schema from an
artifact holds a translated copy in `schemas`; §5.2 notes how a schema from
another document is read there.

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
unfinished or untranslated material waits in a source's data.

## Coverage and remaining implementation work

| Area | Status |
| --- | --- |
| Specification text and derived structural schema | Updated |
| Top-level examples, overview, changelog, migration guide | Updated |
| Focused structural and schema-inventory checks | Updated; see [draft checks](conformance/draft-checks/README.md) |
| Core document corpus, scenarios and manifest | Migrated to sources, binding `source` and `data`, and OBI-07 as the source reference; see [core coverage](conformance/README.md#coverage) |
| Binding family candidates and their corpora | Still require individual data, reference, and base-preservation designs under the source model |
| SDKs and conformance runner adapters | No current qualification run recorded; the Go adapter and its failures are historical, and its manual workflow uses a pinned historical corpus |
| Released snapshots and published binding bundles | Unchanged |

The core corpus exercises OBI-07's source reference, source data as arbitrary
JSON, pointers into identified resources, OBI-12's contained-resource
requirements and OBI-14. It gives core no interpretation of source or binding
data. Corpus verification checks fixture consistency; it does not establish SDK
support. The focused checks remain an executable design aid.

Before releasing this revision, migrate implementations, resolve each candidate
kind's source and binding data shapes, test its reference and interpretation
rules, and run independent implementations against the revised corpus. Do not
mechanically split a binding-owned draft's content into source and binding
data: only the kind can define that migration.
