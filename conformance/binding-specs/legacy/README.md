# Historical OpenAPI 3.2 candidate evidence

`openapi-3.2.md` is an exact snapshot of the pre-kind draft at spec commit
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
