# OpenBindings project policy for published kinds

This is the OpenBindings project's authoring and publication policy for kinds
published under `openbindings.*`. It is not part of the [core document
model](../openbindings.md), and it imposes no requirement on a third-party or
private kind. A conformant OBI may name a kind with no written definition or
implementation. The candidate family documents in this directory predate the
core's `kind` and `kinds` fields; they are not yet evidence that this policy has
been met for publication.

## PB-01. Exact project identifiers

A project publication names each kind it defines with one non-empty, exact,
opaque identifier. The project's spelling convention is
`openbindings.<name>@<rev>`. The revision suffix is part of the string, not an
ordering or compatibility rule. Project tooling does not infer support from a
similar spelling, a range, or a prefix, and does not dereference the identifier
to learn its meaning. These are project choices for the identifiers it
publishes, alongside the core's exact comparison of document kind strings.

## PB-02. Publication completeness

Before publishing a kind, the project requires its defining document to name
the exact kind and give an actionable answer for every source and binding form
it accepts. It may incorporate an upstream authority, define behavior itself,
name a configuration choice, or explicitly exclude a case. In particular, the
document must state:

1. Whether an artifact is involved, which representations and editions it
   accepts, and how they are distinguished.
2. How an address or reference carried in source `content` is interpreted and
   how acquisition succeeds or fails, if such an address is accepted.
3. Which source `content` values and presence or absence modes it accepts.
4. How co-present embedded and referenced material compose, including any
   reference base, if it accepts both.
5. How binding `content` identifies a target, including what absence or an
   invalid target means.
6. What target and interaction a binding denotes, including cardinality and
   lifecycle behavior that affects the operation boundary.
7. How caller-facing inputs and successful outputs correspond to that
   interaction, which outcomes count as success, how failure and partial
   output behave, and which runtime choices remain open.

This is a project publication gate, not a conformance class in the core. It
does not require every third-party kind to have a document, and it does not
make an unpublished candidate authoritative over the meaning of any OBI field.

## PB-03. Published meaning and revisions

The project records a defining document and permanent revision URL when it
publishes a kind. A published identifier keeps its accepted domain and
required, permitted, and refused observable behavior. An incompatible change
uses a different identifier. A clarification may retain the identifier only
when those facts remain unchanged. Before first publication, candidates can
change in place. This policy does not govern how another publisher evolves
its kinds.
