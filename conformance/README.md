# Conformance Test Suite

Machine-readable test fixtures for the three core algorithms defined in the OpenBindings specification. Implementors can use these to verify their implementation produces correct results.

## Fixtures

### `normalization.json`

Tests the schema normalization rules from the [Normalization (profile v0.1)](../openbindings.md#normalization-profile-v01) section.

Each case has:
- `name` -- descriptive label
- `input` -- JSON Schema before normalization
- `expected` -- JSON Schema after normalization, OR
- `error` -- string indicating the case should fail closed or produce a schema error

An implementation normalizes `input` and compares the result to `expected`. If `error` is present instead, the implementation should detect the error condition rather than producing a normalized schema.

Coverage includes: canonical `type`/`required` forms, `$ref` resolution and cycle detection, `allOf` flattening (type intersection, properties union, required union, `additionalProperties`, `enum`/`const` intersection, `items` merge, numeric/string/array bounds including exclusive variants), union ordering, annotation stripping, and fail-closed behavior for out-of-profile keywords.

### `schema-comparison.json`

Tests the compatibility comparison rules from the [Schema Comparison Rules](../openbindings.md#schema-comparison-rules) section.

Each case has:
- `name` -- descriptive label
- `direction` -- `"input"` or `"output"` (determines covariant vs contravariant rules)
- `target` -- the target interface's schema (I)
- `candidate` -- the candidate's schema (D)
- `compatible` -- boolean expected result, OR
- `error` -- string for fail-closed or schema-error cases

An implementation normalizes both schemas, then applies the comparison rules for the given direction. The result should match `compatible`. If `error` is present, the implementation should detect the error condition.

Coverage includes: trivial schemas, `type` (with integer/number subsumption), `const`/`enum`, objects (`properties`, `required`, `additionalProperties`), arrays (`items`, absent `items`), numeric bounds (inclusive and exclusive), string bounds, array bounds, unions (`oneOf`/`anyOf`), keyword combinations, `$schema` dialect checking, annotation stripping, and fail-closed for out-of-profile keywords.

### `operation-matching.json`

Tests the operation matching algorithm and overall compatibility assessment from the [Compatibility](../openbindings.md#compatibility) section.

Each case has:
- `name` -- descriptive label
- `target` -- partial OBI with `operations` (and optional `location`)
- `candidate` -- partial OBI with `operations` (and optional `roles`)
- `result` -- object with per-operation outcomes and an overall `compatible` boolean

An implementation runs the matching algorithm (explicit match via `satisfies`, then fallback via primary key and aliases) and schema comparison for each operation. The per-operation results and overall compatibility should match `result`.

## Running the tests

There is no reference runner in this repo. Implementors write their own test harness that:

1. Reads the JSON fixture
2. Iterates over `cases` (skipping entries that only have `$comment`)
3. Runs the algorithm under test
4. Asserts the output matches `expected`, `compatible`, or `error`

The Go SDK ([openbindings-go](https://github.com/openbindings/openbindings-go)) and TypeScript SDK ([openbindings-ts](https://github.com/openbindings/openbindings-ts)) both consume these fixtures in their test suites and can serve as reference implementations.
