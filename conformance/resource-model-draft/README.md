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

The checks cover the derived structural schema, the recognition procedure in
§7.1, schema entry-point validity against the pinned 2020-12 meta-schemas, and
the shared-value lookup in §7.6. They also check the example files and complete
OBIs in the core, overview, and migration guide's JSON blocks.

[recognition.json](recognition.json) supplies documents and expected inventories.
Its paths are decoded JSON Pointers, not URI fragments. `entries` lists the
initial and reference-selected schema entry points; `schemas` lists all
recognized schema locations; `conflicts` lists locations with incompatible
schema-resource membership. `metaValid` concerns entry-point meta-schema
validity only. No one field states whole-document conformance.

The cases distinguish unused data from used schemas, document-wide recognition
from binding interpretation, static discovery from absolute-ID lookup, and
stored values from identified schema resources. They include pointer chains,
cycles, boolean schemas, nested artifact data, and membership conflicts.

[The runner](../../scripts/test-resource-model-draft.mjs) adds shared-value lookup
cases for escaped tokens, arrays, null, malformed references, literal `$ref`
values, and unchanged artifact contents. It exercises membership conflicts in
both operation orders to check that discovery order does not resolve them.

[The helper](../../scripts/resource-model-draft.mjs) is informative draft code.
It is not a general JSON Schema implementation or a full OBI validator. These
checks do not cover all URI/identifier equality rules, anchor uniqueness,
dynamic evaluation, value-contract evaluation, exact JSON numbers, duplicate
JSON members, or kind execution. Those remain work for the revised corpus and
SDKs described in [the draft status](../../RESOURCE-MODEL-DRAFT.md).
