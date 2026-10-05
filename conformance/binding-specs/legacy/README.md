# Historical OpenAPI candidate evidence

## OpenAPI 3.2

[`history/binding-specs/openapi-3.2-pre-kind.md`](../../../history/binding-specs/openapi-3.2-pre-kind.md) is an exact snapshot of the pre-kind draft at spec commit
`337c3e298e50a25e7ddab9a172a40ac0820b3c9a`. SHA-256:
`453916b488ce92e73a0f18cbe718e71416a58f0d1ba3f2eda08af3c57096627d`.
It is historical text, not the active definition of the proposed kind. Its
relative links have their original repository context; use the
[original Git snapshot](https://github.com/openbindings/spec/blob/337c3e298e50a25e7ddab9a172a40ac0820b3c9a/binding-specs/openapi-3.2/openbindings.openapi-3.2.md)
when following them.

These existing files remain at their established paths for the preserved
implementation runners:

- `../openapi-3.2/OAPI32-D-01.json` and `OAPI32-D-02.json`.
- `../processor/openapi-3.2.json` (365 scenarios).
- `../synthesis/openapi-3.2.json` (34 scenarios).

`verify-binding-specs.mjs` validates their old rule IDs and sections against this
frozen snapshot, whose hash it checks. Passing these files is evidence about the
old draft only. A shared proposed identifier does not make its unpublished
revisions interchangeable.

The active current-core candidate is
[here](../../../binding-specs/openapi-3.2/openbindings.openapi-3.2.md), with
[current evidence](../../kinds/openapi-3.2/README.md). Historical phase names,
exact wire formatting and generator-report expectations must be re-evaluated
before inclusion in a current portable corpus.

## OpenAPI 3.1

The [pre-kind snapshot](../../../history/binding-specs/openapi-3.1-pre-kind.md)
is byte-identical to the draft at commit
`a42ee205afc9cead7fe5e449692fcb2af9b14693`, SHA-256
`f11f4e387a8601bccb23986272d0b1c01a81647d3d15aea6a4846acfe43cdcf5`.
Its relative links retain their original repository context; use the
[original Git snapshot](https://github.com/openbindings/spec/blob/a42ee205afc9cead7fe5e449692fcb2af9b14693/binding-specs/openapi-3.1/openbindings.openapi-3.1.md)
when following them.

The two D-rule fixture files, processor scenarios and synthesis scenarios remain
at their established `openapi-3.1` paths. The verifier checks their rule IDs against
this exact historical text. They do not establish support for the
[current candidate](../../../binding-specs/openapi-3.1/openbindings.openapi-3.1.md);
see its [migration and evidence](../../../binding-specs/openapi-3.1/README.md).

## OpenAPI 3.0

The [pre-kind snapshot](../../../history/binding-specs/openapi-3.0-pre-kind.md)
is byte-identical to the draft at commit
`a42ee205afc9cead7fe5e449692fcb2af9b14693`, SHA-256
`c4eed1a1706c5494cb93a47b827bf2194bb2207934c4289ebc37fdf2667ce5c3`.
Its relative links retain their original repository context; use the
[original Git snapshot](https://github.com/openbindings/spec/blob/a42ee205afc9cead7fe5e449692fcb2af9b14693/binding-specs/openapi-3.0/openbindings.openapi-3.0.md)
when following them.

The two D-rule fixture files and 234 processor/synthesis scenarios remain at
their established `openapi-3.0` paths. The verifier checks their rule IDs against
this exact historical text. They do not establish support for the
[current candidate](../../../binding-specs/openapi-3.0/openbindings.openapi-3.0.md);
see its [migration and evidence](../../../binding-specs/openapi-3.0/README.md).
