# Changelog

## 0.2.0 (working draft)

This describes the diff from 0.1.0 (last released) to the current working draft.

### Changed

- **Scope of the spec dramatically narrowed.** 0.1.0 was a full-stack spec: it defined document shape AND normative schema-comparison rules AND operation-matching algorithms AND transform execution semantics AND security method semantics. The 0.2.0 draft defines only what an OBI document **is**: its shape, identity, discovery convention, reference-resolution rules, versioning, and document-level conformance. Everything behavioral has moved to the new `reference.md` companion doc (non-normative). Spec body is ~380 lines (down from ~1712).
- **`version` field** simplified to an opaque author-declared label. 0.1.0 prescribed SemVer conventions and a "breaking changes MUST bump major" rule that was unenforceable from the spec's position; removed.
- **Transform structure preserved** as `{type, expression}` but the 0.1.0 JSONata mandate and execution-flow prose moved to `reference.md`. Tools declare which transform types they support; unsupported types make bindings unactionable without failing the document.
- **Security structure preserved** as a preference-ordered array of `{type, ...}` objects. The 0.1.0 well-known method definitions (`bearer`, `oauth2`, `basic`, `apiKey` with prescribed field shapes) moved to `reference.md`. The spec defers to upstream RFCs (RFC 6750 for bearer, OAuth 2.0 RFCs, etc.) for canonical semantics.
- **Operation matching** retains the data-model fields (`aliases`, `satisfies`, `roles`) but drops the 0.1.0 matching algorithm (primary-key/alias/explicit-satisfies cascade). Matching procedure is tool-defined.
- **Format tokens** reframed as community-owned strings. 0.1.0 asserted a matching rule (case-insensitive names, exact version match with trailing `.0` stripped); 0.2.0 recognizes that format tokens are strings whose equivalence and comparison semantics belong to each format's community. The spec recommends the `<name>@<version>` convention but no longer imposes normalization rules on community-chosen strings.

### Added

- **`reference.md`** — new companion document (non-normative) capturing the openbindings project's reference-tool behaviors: comparison semantics (including a new fact vocabulary and canonical verdict derivation), transform execution (including JSONata support), operation matching, security method resolution, and related conventions. Versioned independently of the OBI spec. The core spec does not reference this document.
- **`reference-tests/`** — directory containing test fixtures for the behaviors in `reference.md`. Renamed from `conformance/` to reflect that these tests exercise reference-tool behavior, not spec conformance.
- **Scope section** at the top of the spec, explicitly distinguishing what the spec defines from what it intentionally doesn't.
- **Location equality section** defining normative URI canonicalization for comparing role URIs and document locations. Uses RFC 3986 §6.2.2 + §6.2.3, RFC 3987/UTS #46 (IDN), and RFC 8089 (`file://`). Closes a gap in 0.1.0, which relied on prose about "URLs are the identity" without defining equality.
- **Consolidated reference-resolution section** covering `roles`, `sources[*].location`, and schema `$ref` under one RFC 3986 §5 rule. 0.1.0 had three separate resolution clauses scattered across the document.
- **Discovery response contract.** Explicit `GET` / `200 application/json` / `404` semantics at `/.well-known/openbindings`. 0.1.0 described the path as a convention but did not pin the HTTP contract.

### Removed

- **Schema Comparison Rules section** (0.1.0 §456-635). Binary `compatible`/`incompatible`/`unspecified` verdicts, directional comparison rules, per-keyword comparison logic. Moved to `reference.md` (with substantial evolution: the reference tools now use a fact vocabulary rather than a binary verdict).
- **JSON Schema profile subset** (0.1.0 §487-502). The enumeration of supported keywords and the fail-closed rule. Operation schemas in 0.2.0 are valid JSON Schema 2020-12; tools decide which keywords they can reason about.
- **Normalization rules for comparison** (0.1.0 §504-527). RFC 8785 JCS, `allOf` flattening, `type`/`required` canonicalization, union sorting. Moved to `reference.md`.
- **Operation matching algorithm** (0.1.0 §443-454). The explicit-preferred / fallback / uniqueness cascade.
- **Transform execution flow** (0.1.0 §1173-1186). The numbered steps, error-propagation rules, JSONata mandate.
- **Security method type definitions** (0.1.0 §969-1025). The bearer/oauth2/basic/apiKey field schemas.
- **Binding coverage / actionability definition** (0.1.0 §912-936). The computation of whether an operation is actionable from its declared bindings.
- **End-to-end example** (0.1.0 §1428-1712). Will be reworked and moved to `guides/` in a subsequent pass.
- **Conformance test suite positioning as normative** (0.1.0 §1333-1341). Fixtures now live in `reference-tests/` and test reference-tool behavior, not spec conformance.
- **Interface Conformance section** (0.1.0 §683-704) describing "declared vs implicit conformance." Now a tool concern.

### Notes

- Conformance fixtures previously at `conformance/` moved to `reference-tests/` and are labeled as reference-tool behavior tests rather than spec conformance tests. They describe what the reference tooling does, not what the spec requires of arbitrary conformant tools. See `reference-tests/README.md`.
- `reference.md` is generous in what it preserves; it contains the full prior draft text with a reframing preamble and will be reorganized in subsequent passes. Readers evaluating the spec proper should read `openbindings.md` alone; `reference.md` is for readers building against or extending the reference tools. The core spec does not reference either `reference.md` or `reference-tests/`.
- The README and FAQ still reference "deterministic compatibility checking" framing from 0.1.0. These will be reconciled with the new scope in a subsequent pass.

## 0.1.0

Initial public release.

- Core specification: operations, schemas, bindings, sources, transforms, security
- JSON Schema (2020-12) compatibility profile with deterministic normalization
- Schema comparison rules: covariant outputs, contravariant inputs, fail-closed on unsupported keywords
- Operation matching: primary key, aliases, roles + satisfies, three-strategy cascade
- Discovery convention: `/.well-known/openbindings`
- Transform pipeline: JSONata input/output transforms with error propagation
- Security model: named entries, preference-ordered methods, binding-level references
- Conformance test suite: normalization, schema comparison, operation matching
- Companion format spec: `openbindings.operation-graph@0.1.0`
- Role interfaces: software-descriptor, binding-executor, interface-creator, context-store, host, http-client
