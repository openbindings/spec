# Focused binding/resources draft checks

These cases exercise the proposed model in [the working specification](../../openbindings.md).
They are separate from the historical core corpus, whose documents still use
the preceding source/schema model. They do not enter that corpus's manifest.

Run from the repository root:

```sh
npm ci --prefix .github --ignore-scripts
node scripts/test-resource-model-draft.mjs
node scripts/check-canonical-order.mjs examples/*.obi.json
```

The checks cover the derived structural schema, the document's schemas as §7
defines them, their validity against the pinned 2020-12 meta-schemas, the
same-document references OBI-12 covers in the document resource, the
`$dynamicAnchor` placement OBI-14 excludes, and the shared-value lookup in §7.6.
They also check the example files and complete OBIs in the core, overview, and
migration guide's JSON blocks.

[recognition.json](recognition.json) supplies documents and expected inventories.
Its paths are decoded JSON Pointers, not URI fragments. `entries` lists each
operation `input` and `output` and each `schemas` entry; `schemas` lists every
schema the document contains; `unresolved` lists the same-document references in
the document resource that identify no such schema; `documentDynamicAnchors`
lists the schemas in the document resource that declare `$dynamicAnchor`.
`metaValid` concerns the entries' meta-schema validity only. No one field states
whole-document conformance.

The cases distinguish `schemas` entries, used or not, from data in `resources`,
binding content, examples, and unknown keywords; pointers into `resources` and
to non-schema locations from pointers that reach schemas, including inside a
schema that declares `$id`; and copies of standalone schemas with and without
their `$id`.

[The runner](../../scripts/test-resource-model-draft.mjs) adds shared-value lookup
cases into `resources` and `schemas` for escaped tokens, arrays, null, malformed
references, literal `$ref` values, and unchanged artifact contents. It checks
each case with operations and map entries in both orders.

[The helper](../../scripts/resource-model-draft.mjs) is informative draft code.
It is not a general JSON Schema implementation or a full OBI validator. These
checks do not cover absolute-URI references or OBI-12's extension to them,
URI/identifier equality rules, anchor uniqueness,
dynamic evaluation, validation of operation values, exact JSON numbers, duplicate
JSON members, or kind execution. Those remain work for the revised corpus and
SDKs described in [the draft status](../../RESOURCE-MODEL-DRAFT.md).
