# Reference-Tool Test Fixtures

These fixtures test the behaviors documented in `../reference.md` (the openbindings project's reference-tool conventions). They are **not OBI spec conformance tests**. A tool can be fully conformant to the OBI spec (`../openbindings.md`) without passing any of these fixtures; passing them means the tool implements the same semantics as the openbindings project's reference tools.

The distinction matters because the OBI spec only defines what an OBI document *is* (shape, identity, discovery, references, versioning). It does not define comparison semantics, verdict derivation, transform execution, or operation matching procedures. Those are reference-tool conventions, documented in `../reference.md` and tested here. The core spec neither references this directory nor depends on it.

Third-party tools that want to align with the openbindings project's reference tooling can target these fixtures. Tools that diverge from the reference conventions are still spec-conformant; they just publish their own semantics.

## Fixtures

### `normalization.json`

Tests the schema normalization rules the reference tools apply before comparison. Covers canonical `type`/`required` forms, `$ref` resolution and cycle detection, `allOf` flattening, `oneOf` disjointness and conversion to `anyOf`, union ordering, annotation stripping, and fail-closed behavior for out-of-profile keywords.

Each case has:
- `name` — descriptive label
- `input` — schema before normalization
- `expected` — schema after normalization, OR
- `error` — string indicating the case should fail closed or produce a schema error

### `schema-comparison.json`

Tests the reference tools' per-keyword fact generation and the canonical verdict derivation (`openbindings.alignment@1.0` as defined in `../reference.md`).

Each case has:
- `name` — descriptive label
- `direction` — `"input"` or `"output"`
- `target` — target schema (I)
- `candidate` — candidate schema (D)
- `verdict` — expected result: `"aligned"`, `"partial"`, `"misaligned"`, or `"undecidable"`

### `operation-matching.json`

Tests the reference tools' operation matching algorithm and verdict aggregation.

Each case has:
- `name` — descriptive label
- `target` — partial OBI (optional `location`)
- `candidate` — partial OBI (optional `roles`, optional `location`)
- `result` — per-operation outcomes (`match` kind, per-slot verdicts) and a document-level `verdict`

Per-slot verdicts use the verdict vocabulary plus `silent` when a slot's schema is absent on one or both sides.

The top-level `location` fields on `target` and `candidate` are test-harness affordances, not document fields defined by the OBI spec. They supply the document's canonical URI for exercising `satisfies` URL equality and relative role-value resolution.

## Running the tests

There is no reference runner in this directory. Implementors write their own harness that:

1. Reads the JSON fixture
2. Iterates over `cases` (skipping entries that only have `$comment`)
3. Runs the algorithm under test
4. Asserts the output matches `expected`, `verdict`, or `error`

The Go SDK ([openbindings-go](https://github.com/openbindings/openbindings-go)) consumes these fixtures today via `schemaprofile/conformance_test.go` and serves as a reference implementation of the reference-tool behaviors.
