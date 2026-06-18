# Changelog

## 0.2.0

This release narrows the spec to what an OBI document IS: shape, discovery, references, versioning, and the conformance floor. Behavioral material from 0.1.0 (comparison rules, matching algorithms, transform execution, security method shapes) moves out of the spec; how tools handle these concerns is now tool-defined. Many breaking changes; per OBI-T-04, a 0.1.x tool MUST refuse a 0.2.0 document.

### Breaking

- **Spec scope narrowed.** Spec body shrunk from ~1700 lines to ~720. Schema comparison rules, normalization, operation matching, transform execution flow, security method type definitions, interface conformance framing, and binding actionability are all removed. These are now tool-defined concerns.
- **`executor` renamed to `invoker`** across the spec ecosystem. Role interface `openbindings.binding-executor` becomes `openbindings.binding-invoker`; `executeBinding` becomes `invokeBinding`; SDK types follow (`BindingExecutor` to `BindingInvoker`, `OperationExecutor` to `OperationInvoker`, etc.); CLI `ob op exec` / `ob binding exec` become `ob op invoke` / `ob binding invoke`. Hard rename, no aliases.
- **`openbindings.context-store` narrowed to three operations.** `listContexts` removed — the operation returned raw `ContextEntry[]` including credential payloads, which production implementations refused to honor (the reference `ob serve` did not expose it). Listing, inspection, rotation, and audit are now implementation-defined surfaces outside the role contract, matching the docker-credential-helper / git-credential / OS-keychain precedent. The `ContextEntry` wrapper schema is also gone: with no list operation, the `{key, context}` shape served no purpose. `getContext` now returns `Context | null` (the opaque payload directly, with explicit nullability for "no entry"), aligning the spec with what the reference SDKs already do.
- **Transform shape changed.** Named transforms changed from `{"type": "jsonata", "expression": "..."}` objects to plain JSONata 2.0 expression strings. Inline `inputTransform`/`outputTransform` accept a JSONata string or `{"$ref": "..."}` object. The `type` field on transforms is gone.
- **Map key pattern enforced.** All map keys (operations, bindings, sources, transforms, schemas, examples) and all aliases MUST match `^[A-Za-z_][A-Za-z0-9_.-]*$`. v0.1.0 allowed any JSON string.
- **`$schema` pinned to 2020-12.** When `$schema` appears in any schema within the document, it MUST be exactly `https://json-schema.org/draft/2020-12/schema`.
- **`$vocabulary` forbidden.** The `$vocabulary` keyword MUST NOT appear in schemas within the document.
- **SemVer enforced on `openbindings` field.** The JSON Schema now enforces a full SemVer 2.0.0 pattern. v0.1.0 had no pattern constraint.
- **Format token normalization removed.** The 0.1.0 rules (case-insensitive matching, trailing `.0` stripping) are gone. Token equivalence is each format community's concern.
- **Operation matching algorithm removed.** The 0.1.0 deterministic matching cascade (primary key, alias, explicit satisfies) is gone; matching procedure beyond name resolution is tool-defined.
- **`roles` map and operation `satisfies` array removed.** Cross-document correspondence collapses into one mechanism: an operation claims to fulfill a shared contract by carrying that contract's operation name as an `aliases` entry. There is no separate role table and no structured satisfies claim. Correspondence no longer carries a URL anchor or any spec-level verification or trust semantics; those are registry and tooling concerns. Removes the top-level `roles` field and the operation `satisfies` field.
- **Aliases are alternate keys.** An operation's key and its `aliases` form one flat, document-unique namespace (OBI-D-04); both resolve to the operation with equal standing. The key remains the operation's singular primary name for display, logging, identity, and the value bindings reference in `bindings[*].operation`.
- **`security` field removed.** The top-level `security` map and the `bindings[*].security` reference are removed from the document. Authentication is not interface metadata: it is a runtime prerequisite negotiated by the binding invoker, not declared statically in the OBI. The `openbindings.binding-invoker` role gains a `CONTEXT_REQUIRED` challenge (a binding may fail asking for context, the runtime resolves it into a context store and retries), with `auth.*` as the first family of requirement types. Removes the top-level `security` field and `bindings[*].security`.
- **`version` field is opaque.** The 0.1.0 SemVer requirement and "breaking changes bump major" rule are removed. Tools define no behavior in terms of `version`.
- **YAML support dropped.** v0.1.0 had normative YAML support (YAML 1.2, no 1.1 coercion). v0.2.0 is JSON only.
- **Example validation strengthened.** `examples[*].input` and `examples[*].output` MUST validate against their operation schemas (OBI-D-11). Was SHOULD in 0.1.0.
- **Pre-1.0 minor version refusal.** Tools MUST refuse documents declaring a higher minor version while pre-1.0 (OBI-T-04). v0.1.0 only had major-version refusal.
- **`$ref` cycle handling changed.** v0.1.0 required detection and fail-closed (treat as incompatible). v0.2.0 permits cycles in schemas and requires tools to handle them without infinite loops.
- **References are absolute or same-document.** No reference resolves against the document's fetch URI: every `sources[*].location` MUST be an absolute URI or a format-defined absolute address (e.g. a gRPC `host:port`), and every schema `$ref`/`$id` MUST be a same-document fragment or absolute. A document is therefore context-free, resolving identically however it was obtained (origin, cache, redirect, stdin, in-memory); §10's base-URI machinery is gone, and §10 no longer frames a document's identity in terms of the URI it was retrieved from. v0.1.0 resolved relative references against the document's retrieval URI. Relative-path authoring convenience now belongs to tooling, which absolutizes when emitting the document (as `ob serve` already does). (OBI-D-05.)

### Added

- **OBI-T-12 (operation-name resolution).** MUST-level rule: a tool resolving an operation by name matches against the flat key+aliases namespace, treats key and alias matches as equally authoritative, never privileges the key, never resolves a non-matching name, and selects bindings by the resolved operation's key. Closes the prior gap where name resolution was unspecified and two conforming tools could disagree.
- **Positioning (section 1).** Distinguishing features, explicit out-of-scope list. Replaces the old Overview.
- **Scope principle (section 2).** Normative statement that OBI is deliberately minimal. Authority over wire formats rests with binding format specs; authority over behavior rests with implementations.
- **Discovery response contract (section 7.1).** Explicit `GET` / `200` / `404` semantics at `/.well-known/openbindings`, with `Content-Type` guidance, SHOULD-level `3xx` redirect following, and permissive CORS recommendation.
- **OBI-T-13 / OBI-T-14 (discovery response contract).** The §7.1 serving and fetching obligations are now pinned to citable rule identifiers. OBI-T-13 (serving) requires a `200` with a valid OBI body, forbids refusing a request solely for a missing or non-OBI `Accept`, and recommends the OBI `Content-Type`; OBI-T-14 (fetching) requires accepting `application/json`, recommends sending the OBI `Accept` and following `3xx` redirects, and permits treating any non-OBI response as "none published." Closes the prior gap where §7.1's normative MUST/SHOULD behavior carried no `OBI-T-##` identifier and was therefore not citable by the conformance corpus.
- **Binding sufficiency (section 8).** Each binding's interaction target MUST be identifiable from the binding and its referenced source alone. Replaces 0.1.0's "actionability" concept.
- **Canonical form (section 9, informative).** Names RFC 8785 (JCS) as the byte-stable serialization for content-addressing and signing.
- **Reference resolution (section 10).** Single section establishing that documents are context-free: no `id` field, and every OBI-defined reference (`sources[*].location`, schema `$ref`/`$id`, and named-transform `$ref`) absolute or same-document, so a document resolves identically wherever it was obtained (`bindings[*].ref` is format-governed and exempt). Covers reference forms, the initial base URI for resolving same-document schema `$ref`s (the OBI document root, until a nested `$id` rebases), and `$ref` cycle handling.
- **Versioning (section 11).** Two-axis model: `openbindings` (spec version, SemVer 2.0.0) and `version` (opaque contract version). Version comparison follows SemVer 2.0.0 precedence; a prerelease is not accepted unless a tool declares support for that specific prerelease.
- **IANA considerations (section 12).** Defines registration details for the OpenBindings well-known URI suffix and JSON media type; IANA registries are authoritative for current status.
- **Input/output contract direction (section 6.1).** `input` is a lower bound on service acceptance; `output` an upper bound on service emission. Three-way distinction between absent, `null`, and `{}`.
- **Transform direction (section 6.5).** `inputTransform` reshapes caller input toward the source's expected input; `outputTransform` reshapes source output toward the operation's `output`.
- **Capability-scoped tool obligations (section 14.1).** A tool's obligations follow the capabilities it exercises (parsing, reference resolution, binding selection, operation-name resolution, invocation, transform evaluation), not a fixed conformance class. A JSONata runtime is required only of tools that evaluate transforms.
- **Stable rule identifiers (section 14).** Every conformance rule carries an `OBI-D-##` (document) or `OBI-T-##` (tool) identifier. Identifiers are stable within a major version.
- **Document rules OBI-D-01 through OBI-D-13.** Covering UTF-8 JSON, schema validity, unique operation keys, identifier patterns (keys and aliases), identifier-namespace collisions, URI references, `$schema` value, `$vocabulary` prohibition, binding cross-references (to operations and sources), named-transform `$ref` resolution, example schema validation, SemVer for `openbindings`, and binding sufficiency.
- **Tool rules OBI-T-01 through OBI-T-12.** Covering don't-fail-on-unknown postures, ignoring unknown fields, `x-` extension semantics, version refusal, schema-keyword diagnostics, `ref` resolution per format conventions, input/output validation, deprecated-tier binding selection (MUST), JSONata 2.0 transform evaluation (MUST), `$ref` cycle handling (MUST), and operation-name resolution (MUST).
- **Conformance corpus (`conformance/`).** Fixture-based test corpus keyed to rule IDs. 102 tests across 13 document rules and 3 tool rules. Includes `manifest.json`, `fixture.schema.json`, a reference Go runner, plus verification and manifest generation scripts.
- **Abstract, editors, license/IP, and notational conventions** as standalone front-matter sections.
- **Normative and informative references (section 16).**
- **`minLength: 1`** on `sources[*].format`, `sources[*].location`, and string `content` in the JSON Schema. Empty-string format tokens, locations, and content are now invalid.
- **`propertyNames` constraints** in the JSON Schema enforcing the key pattern on every map.
- **Schema-level enforcement of cross-reference patterns and uniqueness.** Cross-reference values (`bindings[*].operation`, `bindings[*].source`) and `TransformOrRef.$ref` are now pattern-constrained in the JSON Schema. The `aliases` array carries `uniqueItems: true`. These backstop existing prose rules (OBI-D-04, OBI-D-08 through OBI-D-13) with structural validation that catches typos before cross-reference resolution.

### Changed

- **`idempotent` semantics tightened.** Now a contract-level claim ("every binding for this operation MUST preserve the guarantee"), not just metadata.
- **`deprecated` on bindings.** New tier rule: non-deprecated bindings rank ahead of deprecated ones regardless of priority (OBI-T-09).
- **`aliases` reframed.** Now explicitly "author-attested claims" that tools MUST NOT reject as non-conformant based on semantic accuracy.
- **Conformance corpus restructured.** v0.1.0 had 3 monolithic JSON files (schema-comparison, normalization, operation-matching). v0.2.0 uses individual fixture files keyed to rule IDs under `conformance/document/` and `conformance/tool/`.

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

- **Interfaces relocated**: the project's shared interfaces moved out of this repository to [openbindings/interfaces](https://github.com/openbindings/interfaces), independently versioned with location-based identity served at `openbindings.com/interfaces/<name>/<version>.json`. The interface renames and additions below were made during the 0.2.0 cycle, before the move.
- **New examples**: `minimal.obi.json`, `blend-coffee-shop.obi.json`, `multi-source.obi.json`
- **New tooling**: CI workflow validating examples, corpus consistency, canonical ordering, and local links
- **Renamed interface**: `openbindings.binding-executor` to `openbindings.binding-invoker`
- **New interface**: `openbindings.source-inspector`
- **Retired interface**: `openbindings.host` (composed meta-role; no implementation ever claimed it; consumers can match its constituent roles directly)
- **Guides**: rewritten for the 0.2.0 model (the full guide set is being reworked alongside this release).
- **Companion format spec bumped**: `openbindings.operation-graph@0.1.0` to `@0.2.0`. Changes:
  - Transforms aligned with core spec to plain JSONata strings.
  - SemVer pattern enforcement and `propertyNames` constraints added to its schema.
  - **Addressable unit is the operation graph definition, not the JSON document around it.** The format spec no longer prescribes a document shape; an operation graph source document is any JSON document containing at least one graph definition.
  - **Binding `ref` is a REQUIRED JSON Pointer.** Bare graph keys (e.g., `"paginateAll"`) are no longer accepted; a binding writes `"#/graphs/paginateAll"`, or `"#"` to target a graph at the document root. A graph embedded anywhere in a host document is addressable via its Pointer.
  - **Each graph declares its own version.** The top-level `openbindings.operation-graph` field moves from the document onto the graph itself, allowing a single file to hold graphs at different format versions. The format token on the OBI source declaration continues to version the addressing convention.
  - **Conventional document shape** (a top-level `graphs` map) is documented as non-normative for files whose primary purpose is to hold operation graphs.
  - **`combine` semantics corrected to wait for readiness.** A `combine` node now emits nothing until every incoming source has produced at least one event or completed, then emits on each subsequent event (true `combineLatest` warm-up). The earlier text said it emitted on every event with `null` for not-yet-produced sources, which contradicted both the parallel-join example and the deferred "combine timeout" item. Single-emission sources now yield exactly one combined emission with no intermediate partial.
  - **Determinism and portability section added.** A new normative section states which output aspects are portable (per-edge order, `map` order, element-node evaluation, the output multiset, eventual completion) and which are implementation-defined (cross-path interleaving, multi-emission `combine` count, intra-`buffer` order, completion-detection mechanism). The portability claims are scoped to deterministic node behavior, since the core spec permits non-deterministic JSONata (`$now()`, `$random()`).
  - **Event lineage specified through merge nodes.** `maxIterations` lineage now propagates through every node kind: split nodes (`each`, `map`) copy counts to each output; merge nodes (`buffer`, `combine`, the `operation` conduit) take the element-wise maximum, so a merge cannot escape a cycle's bound.
  - **Unknown node types rejected.** The node-type set is closed (schema enum); an unknown `type` is non-conformant and a tool MUST reject the graph rather than execute it partially.
  - **Duplicate edges are now schema-enforced.** `uniqueItems: true` on `edges` backstops validation rule 8 in the JSON Schema.
  - **Error-event field renamed `input` to `event`.** The `onError` error event is now `{ "error", "event" }` (was `{ "error", "input" }`), removing the collision between that field name and the `$input` runtime variable. `event` is the spec's universal term for a node's incoming value and generalizes across node types (any node can fail, not only operations).
  - **Transparency rewrite (the identity law).** The format is rebuilt around a governing conformance requirement: `input → operation(y) → output` MUST be observationally indistinguishable from a direct invocation of `y` (input acceptance, output stream, terminal status, cancellation; metadata and timing excluded). Cardinality appears nowhere in the format; a graph's boundary cardinality is emergent from its contents.
  - **`operation` is the conduit; `each` is the per-event built-in.** An `operation` node now holds one invocation per graph invocation and pipes its incoming stream into it (the old per-event behavior survives only at the one-event point where the two coincide). Per-invocation-per-event behavior is the new `each` node. `maxIterations` moves from `operation` to `each`; cycles must be bounded by an `each` with `maxIterations` (OG-V-09) and `operation` conduits must not sit on cycles (OG-V-10). A zero-write graph pipes an empty input stream as a no-input invocation; the 0.1.0-era `null` injection is gone.
  - **Input-side closure (back-closure) defined.** The graph closes its caller-facing input side when every direct consumer of the `input` node is non-accepting, mirroring an inner binding that closes its own input; transitive back-closure through pure nodes is explicitly deferred. Write rejection at a non-accepting conduit is a defined per-event error (`WRITE_REJECTED`).
  - **Conduit error model aligned with the identity law.** A terminal error on an `operation` conduit's held invocation is fatal to the graph invocation by default (terminal-status parity with direct invocation); setting `onError` on the node opts it into in-graph handling instead. Per-event failures (`each` invocation errors, write rejections, `MAP_NOT_ARRAY`, undefined transforms) remain routed-or-dropped. The error event's `event` member is now OPTIONAL: present exactly when the failure is attributable to a single event, absent for conduit terminal errors. `onError` is restricted to processing nodes (OG-V-17: not on `input`/`output`).
  - **Invocation model section added.** The format now defines the invocation surface its semantics are stated over (writes, input-side close and close responsibility, output completion, terminal status, cancellation), since the core spec deliberately delegates invocation semantics. The `openbindings.binding-invoker` role's frame stream is cited as the informative correspondence.
  - **Error identifiers defined.** Spec-defined failures carry SCREAMING_SNAKE_CASE identifiers (`TIMEOUT_EXCEEDED`, `WRITE_REJECTED`, `MAP_NOT_ARRAY`, `TRANSFORM_UNDEFINED`), matching the role interfaces' convention (`CONTEXT_REQUIRED`, `ERR_*`); failures originating in an inner invocation surface the inner terminal error verbatim. Replaces the prior lowercase ad-hoc tokens.
  - **Stable rule identifiers and a conformance section.** Validation rules carry `OG-V-01`–`OG-V-17` and tool obligations are consolidated as `OG-T-01`–`OG-T-04` (validate-before-acting, version refusal mirroring OBI-T-04, JSONata 2.0, execution semantics + identity law), with the core spec's no-renumbering stability guarantee and a pointer to the conformance corpus.
  - **`$input` redefined as the lineage root.** Each caller write roots a lineage; `$input` is the root input event of the current event's lineage, and is defined at a merge only when all contributing events share one root.
  - **Flow control section added.** In-transit queues SHOULD be bounded; conduit/`each` nodes SHOULD consume inner outputs with bounded read-ahead so saturation backpressures the transport, and write admission at `input` SHOULD be bounded so a saturated graph backpressures its caller.
  - **Per-event scoping idiom documented.** `buffer`/`combine` are invocation-scoped; per-lineage joins and batches are expressed by nesting a single-write graph behind an operation referenced from `each` (invocation scope one level down is lineage scope).
  - **Conformance subcorpus added** under `conformance/operation-graph/`: thirty-four execution fixtures (one per normative example; an identity-law suite exercising the trivial wrapper across all five selected-binding cardinalities the law's acceptance criterion names (no-input, unary, server-streaming, client-streaming, bidirectional) plus terminal-status parity; conduit `onError` handling, write rejection, and back-closure at the boundary; the merge-in-cycle lineage rule; `combine` completion-readiness; the buffer flush conditions (`limit` precedence, `until`/`through`/`limit` tumbling windows, and empty-buffer completion); the `filter` boolean-cast table; `exit` early-return; the `MAP_NOT_ARRAY` and `TRANSFORM_UNDEFINED` failure identifiers; and `$input` at a cross-lineage merge, with mocked per-invocation operation responses and expected output streams) and validation fixtures keyed to the OG-V-## well-formedness identifiers, verified in CI by `scripts/verify-operation-graph.mjs` (which also checks every inline spec example against the op-graph schema). A reference runner (`conformance/operation-graph/runners/js/`) executes the fixtures against a deterministic engine implementing the conduit/`each`/back-closure semantics and diffs the output stream, also in CI.

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
