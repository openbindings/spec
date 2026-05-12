# Changelog

## 0.2.0

This release narrows the spec to what an OBI document IS: shape, identity, discovery, references, versioning, and the conformance floor. Behavioral material from 0.1.0 (comparison rules, matching algorithms, transform execution, security method shapes) moves out of the spec; how tools handle these concerns is now tool-defined. Many breaking changes; per OBI-T-04, a 0.1.x tool MUST refuse a 0.2.0 document.

### Breaking

- **Spec scope narrowed.** Spec body shrunk from ~1700 lines to ~830. Schema comparison rules, normalization, operation matching, transform execution flow, security method type definitions, interface conformance framing, and binding actionability are all removed. These are now tool-defined concerns.
- **`executor` renamed to `invoker`** across the spec ecosystem. Role interface `openbindings.binding-executor` becomes `openbindings.binding-invoker`; `executeBinding` becomes `invokeBinding`; SDK types follow (`BindingExecutor` to `BindingInvoker`, `OperationExecutor` to `OperationInvoker`, etc.); CLI `ob op exec` / `ob binding exec` become `ob op invoke` / `ob binding invoke`. Hard rename, no aliases.
- **`openbindings.context-store` narrowed to three operations.** `listContexts` removed — the operation returned raw `ContextEntry[]` including credential payloads, which production implementations refused to honor (the reference `ob serve` did not expose it). Listing, inspection, rotation, and audit are now implementation-defined surfaces outside the role contract, matching the docker-credential-helper / git-credential / OS-keychain precedent. The `ContextEntry` wrapper schema is also gone: with no list operation, the `{key, context}` shape served no purpose. `getContext` now returns `Context | null` (the opaque payload directly, with explicit nullability for "no entry"), aligning the spec with what the reference SDKs already do.
- **Transform shape changed.** Named transforms changed from `{"type": "jsonata", "expression": "..."}` objects to plain JSONata 2.0 expression strings. Inline `inputTransform`/`outputTransform` accept a JSONata string or `{"$ref": "..."}` object. The `type` field on transforms is gone.
- **Map key pattern enforced.** All map keys (operations, bindings, sources, transforms, roles, schemas, security, examples) and all aliases MUST match `^[A-Za-z_][A-Za-z0-9_.-]*$`. v0.1.0 allowed any JSON string.
- **`$schema` pinned to 2020-12.** When `$schema` appears in any schema within the document, it MUST be exactly `https://json-schema.org/draft/2020-12/schema`.
- **`$vocabulary` forbidden.** The `$vocabulary` keyword MUST NOT appear in schemas within the document.
- **SemVer enforced on `openbindings` field.** The JSON Schema now enforces a full SemVer 2.0.0 pattern. v0.1.0 had no pattern constraint.
- **Security method type definitions removed.** The per-scheme field shapes (`bearer`, `oauth2`, `basic`, `apiKey`) are gone from both the spec prose and the JSON Schema. `SecurityMethod` retains `type` (required) and `description` (optional) with `additionalProperties: true`. Scheme semantics defer to upstream RFCs.
- **Format token normalization removed.** The 0.1.0 rules (case-insensitive matching, trailing `.0` stripping) are gone. Token equivalence is each format community's concern.
- **Operation matching algorithm removed.** The 0.1.0 deterministic matching cascade (primary key, alias, explicit satisfies) is gone. Data-model fields (`aliases`, `satisfies`, `roles`) remain; matching procedure is tool-defined.
- **`version` field is opaque.** The 0.1.0 SemVer requirement and "breaking changes bump major" rule are removed. Tools define no behavior in terms of `version`.
- **YAML support dropped.** v0.1.0 had normative YAML support (YAML 1.2, no 1.1 coercion). v0.2.0 is JSON only.
- **Example validation strengthened.** `examples[*].input` and `examples[*].output` MUST validate against their operation schemas (OBI-D-15). Was SHOULD in 0.1.0.
- **Pre-1.0 minor version refusal.** Tools MUST refuse documents declaring a higher minor version while pre-1.0 (OBI-T-04). v0.1.0 only had major-version refusal.
- **`$ref` cycle handling changed.** v0.1.0 required detection and fail-closed (treat as incompatible). v0.2.0 permits cycles in schemas and requires tools to handle them without infinite loops.

### Added

- **Positioning (section 1).** Distinguishing features, explicit out-of-scope list. Replaces the old Overview.
- **Scope principle (section 2).** Normative statement that OBI is deliberately minimal. Authority over wire formats rests with binding format specs; authority over behavior rests with implementations.
- **Discovery response contract (section 7.1).** Explicit `GET` / `200` / `404` semantics at `/.well-known/openbindings`, with `Content-Type` guidance and permissive CORS recommendation.
- **Binding sufficiency (section 8).** Each binding's interaction target MUST be identifiable from the binding, its referenced source, and the document's discovery context. Replaces 0.1.0's "actionability" concept.
- **Interface identity (section 9).** Document identity is the URI from which it was retrieved. No separate `id` field.
- **Location equality (section 10).** Normative URI canonicalization for comparing role URIs and document locations, using RFC 3986 and UTS #46 (IDN).
- **Canonical form (section 11, informative).** Names RFC 8785 (JCS) as the byte-stable serialization for content-addressing and signing.
- **Reference resolution (section 12).** Single section covering `roles`, `sources[*].location`, and schema `$ref` under one RFC 3986 rule.
- **Versioning (section 13).** Two-axis model: `openbindings` (spec version, SemVer 2.0.0) and `version` (opaque contract version).
- **IANA considerations (section 14).** Provisional registrations for `/.well-known/openbindings` URI suffix and `application/vnd.openbindings+json` media type.
- **Input/output contract direction (section 6.1).** `input` is a lower bound on service acceptance; `output` an upper bound on service emission. Three-way distinction between absent, `null`, and `{}`.
- **Transform direction (section 6.5).** `inputTransform` reshapes caller input toward the source's expected input; `outputTransform` reshapes source output toward the operation's `output`.
- **Conformance classes (section 16.1).** Three tiers: Inspection, Codegen, Invoking. Each tool rule annotates its minimum class. JSONata runtime only required at the Invoking tier.
- **Stable rule identifiers (section 16).** Every conformance rule carries an `OBI-D-##` (document) or `OBI-T-##` (tool) identifier. Identifiers are stable within a major version.
- **Document rules OBI-D-01 through OBI-D-17.** Covering UTF-8 JSON, schema validity, identifier patterns, cross-references (binding to operation/source/security/transform; satisfies to roles), `$schema` value, `$vocabulary` prohibition, example schema validation, SemVer for `openbindings`, and binding sufficiency.
- **Tool rules OBI-T-01 through OBI-T-12.** Covering don't-fail-on-unknown postures, `x-` extension semantics, version refusal, schema-keyword diagnostics, `ref` resolution per format conventions, input/output validation, satisfies subsumption (SHOULD), deprecated-tier binding selection (MUST), JSONata 2.0 transform evaluation (MUST), and `$ref` cycle handling (MUST).
- **Conformance corpus (`conformance/`).** Fixture-based test corpus keyed to rule IDs. 114 tests across 17 OBI-D rules and 3 OBI-T rules. Includes `manifest.json`, `fixture.schema.json`, a reference Go runner, plus verification and manifest generation scripts. Comparison fixtures live separately under `conformance/comparison/` (30 fixtures across 6 categories).
- **Abstract, editors, license/IP, and notational conventions** as standalone front-matter sections.
- **Normative and informative references (section 18).**
- **`minLength: 1`** on `sources[*].location` and string `content` in the JSON Schema. Empty-string locations are now invalid.
- **`propertyNames` constraints** in the JSON Schema enforcing the key pattern on every map.

### Changed

- **`idempotent` semantics tightened.** Now a contract-level claim ("every binding for this operation MUST preserve the guarantee"), not just metadata.
- **`deprecated` on bindings.** New tier rule: non-deprecated bindings rank ahead of deprecated ones regardless of priority (OBI-T-10).
- **`aliases` and `satisfies` reframed.** Now explicitly "author-attested claims" that tools MUST NOT reject as non-conformant based on semantic accuracy.
- **Conformance corpus restructured.** v0.1.0 had 3 monolithic JSON files (schema-comparison, normalization, operation-matching). v0.2.0 uses individual fixture files keyed to rule IDs under `conformance/document/` and `conformance/tool/`, plus a separate `conformance/comparison/` tree.

### Removed

- Schema comparison rules section (v0.1.0 binary verdicts and per-keyword comparison logic)
- JSON Schema profile subset (the constrained keyword set for deterministic comparison)
- Normalization rules for comparison (JCS canonicalization, `$ref` inlining, `allOf` flattening)
- Operation matching algorithm (three-strategy cascade)
- Transform execution flow (numbered steps and error-propagation rules)
- Security method type definitions (per-scheme field shapes for bearer/oauth2/basic/apiKey)
- Binding actionability definition (replaced by binding sufficiency)
- Interface conformance section (declared vs. implicit conformance)
- End-to-end example (will be reworked as a guide)
- "Core Ideas," "One interface shape; optional bindings," "Design principles," and other non-normative overview sections (replaced by sections 1-4)
- Format registry guidance (well-known format token list)
- Ref conventions section (JSON Pointer / XPath guidance)
- Precedence and drift section
- YAML support

### Repository

- **New guides**: getting-started, FAQ, creators-and-invokers, binding-format-conventions, binding-invocation-context, interface-client
- **New interfaces**: `openbindings.binding-invoker` (replaces `binding-executor`), `openbindings.source-inspector`
- **New examples**: `minimal.obi.json`, `blend-coffee-shop.obi.json`, `multi-source.obi.json`
- **New tooling**: CI workflow validating examples, interfaces, corpus consistency, canonical ordering, and local links
- **Renamed interface**: `openbindings.binding-executor` to `openbindings.binding-invoker`
- **Retired interface**: `openbindings.host` (composed meta-role; no implementation ever claimed it; consumers can match its constituent roles directly)
- **Removed guides**: `cli.md`, `creators-and-executors.md`, `binding-execution-context.md` (replaced by renamed/rewritten guides)
- **Companion format spec bumped**: `openbindings.operation-graph@0.1.0` to `@0.2.0` (transforms aligned with core spec to plain JSONata strings; SemVer pattern enforcement and `propertyNames` constraints added to its schema; format spec now snapshotted under `formats/operation-graph/versions/`)

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
