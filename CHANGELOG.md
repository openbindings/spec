# Changelog

This file records user- and implementer-visible release deltas. The practical
0.1-to-0.2 document migration is in
[`MIGRATING-0.1-TO-0.2.md`](MIGRATING-0.1-TO-0.2.md). The much more detailed
chronological record of work on the draft is preserved in
[`history/0.2-development-log.md`](history/0.2-development-log.md).

## 0.2.0 (working draft)

Version 0.2.0 has not been released. The latest release is 0.1.0, and details
below may continue to change until the 0.2 release is cut.

### Added

- The unreleased first `openbindings.asyncapi@1` candidate. It treats AsyncAPI
  Core and each artifact-declared protocol binding as upstream authority,
  normalizes AsyncAPI 2.0.0–2.6.0 and 3.0.0–3.1.0 operations, and leaves
  concrete execution to protocol drivers. Synthesis is independent of which
  drivers happen to be installed; unsupported execution fails locally before
  dispatch. No Core OBI document-model field changed.

- The unreleased first `openbindings.openapi@1` candidate. Its accumulated
  first-revision behavior preserves same-named input declarations through a
  binding-private route, exact and declaration-complex JSON values, dynamic
  objects, artifact-authorized raw request and response bytes through a
  protocol-independent Base64 boundary, media-range selection, forms, text,
  and SSE. Protocol facts remain below the ordinary operation boundary. No
  Core OBI document-model field changed.

- A small, explicit set of core invariants: per-value contracts,
  enabling-not-invoking, split authority, context-free documents,
  offline-decidable core conformance, and decentralized extension.
- Exact `bindingSpec` identifiers and the `OBI-B-01` through `OBI-B-03`
  completeness and revision rules for binding specifications.
- Unreleased first-revision candidates for OpenAPI, AsyncAPI, GraphQL, gRPC,
  Connect, MCP, usage/CLI, and operation graphs, plus publication tooling for
  creating immutable, content-addressed defining bundles with portable
  conformance evidence and append-only errata when a candidate is actually
  released. No binding specification has yet been published.
- Stable document and tool rule identifiers, honest partial-verification
  conclusions, and portable action/outcome conformance scenarios.
- Operation-name resolution over one flat key-and-alias namespace.
- Explicit version acceptance and refusal rules, including prereleases and
  pre-1.0 minor-version boundaries.
- Context-free OBI reference resolution, JSON Schema 2020-12 graph rules,
  boolean schemas, and named transforms.
- JSONata 2.1 per-value transforms with a closed host environment and a
  pinned behavioral tiebreak implementation.
- The independently versioned HTTP Discovery companion specification.
- A synthesis model that distinguishes represented, excluded, lossy, and
  failed upstream targets; exhaustive coverage is a qualified evidence claim,
  never inferred from a returned OBI alone.
- Cross-runtime conformance corpora for the core, schema comparison, binding
  processing, synthesis coverage, invocation frames, and operation graphs.
- Portable binding-processor scenarios can supply an absolute-URI resource
  map as harness input, allowing multi-document artifact closure, reference
  scoping, and wire behavior to be proved without adding resolver state or
  protocol concepts to the OBI document model.
- Informative binding-spec authoring doctrine, an AI-agent primer, and a
  practical 0.1-to-0.2 migration guide.

### Changed

- The OpenAPI first-revision candidate's security processing now has portable adversarial proof
  that Security Requirement Objects remain alternatives rather than being
  unioned, that ambient credentials are never volunteered for an anonymous
  operation, and that processor-owned `Host`, `Content-Length`, and structured
  cookie assembly cannot be silently replaced by declared parameters. A new
  synthesis case also requires statically unsupported parameter-content media
  to be excluded with exhaustive coverage instead of producing an operation
  guaranteed to refuse at invocation time. Another synthesis case proves that
  an unsupported custom schema dialect excludes only operations whose
  projected contracts inherit it, preserving schema-free operations and
  supported per-schema overrides. These are binding-family rules; the
  protocol-blind core document model is unchanged.

- Operation `input` and `output` now constrain each caller-facing value. They
  do not declare unary or streaming cardinality; the governing binding
  specification and concrete interaction retain that authority.
- Sources use `bindingSpec` instead of the 0.1 `format` token. Each exact
  identifier names the specification governing source representation,
  addressing, input/output mapping, errors, ordering, cancellation, runtime
  prerequisites, and declared exclusions.
- Binding `priority` became the integer author signal `preference`, with
  higher values more preferred. The core defines no automatic selection
  algorithm.
- Operation aliases have equal standing with keys and may express
  author-attested shared-contract correspondence. The 0.1 `satisfies` model
  is gone.
- `idempotent` is a narrow author-attested effect claim, not permission to
  retry or cache and not a stable-output guarantee.
- Inline transforms are JSONata expression strings. Transforms operate once
  per value and never change cardinality.
- Source `location`/`content` pairing and binding `ref` meaning are governed
  by the exact binding specification. Relative, retrieval-context-dependent
  OBI references are no longer portable.
- Document authentication declarations moved out of the core. Credentials,
  configuration choices, approvals, and other prerequisites are supplied as
  invocation context and may be surfaced through context requirements.
- Tool conformance is capability-scoped. A verifier that cannot decide a
  binding-specific or external fact reports it as unverified rather than
  claiming complete conformance.
- The operation-graph specification was rebuilt around the direct-invocation
  identity law, cardinality-transparent frame flow, explicit completion and
  cancellation, bounded cycles, lineage, deterministic portability claims,
  and stable validation/error identifiers.

### Removed

- The 0.1 in-core schema-comparison, normalization, operation-matching,
  binding-selection, security-method, and discovery models.
- Literal `null` as a second spelling of an unspecified operation schema.
- Retrieval-URI-relative OBI references.
- YAML as an OBI serialization. A binding specification may still incorporate
  YAML or any other upstream artifact representation.
- The experimental, unminted Workers RPC binding candidate. It is absent from
  the active catalog and implementations.

### Repository and publication

- The project's shared role interfaces moved to the independently versioned
  `openbindings/interfaces` repository.
- Released Core snapshots are immutable. No binding-specification publication
  bundle exists yet; when a first candidate is published, its bundle will be
  immutable, non-behavioral clarifications will use append-only,
  digest-registered errata, and incompatible behavior will require a new
  identifier revision.
- Reference Go and TypeScript implementations exercise the same portable
  corpora while retaining language-idiomatic APIs.
- The specification's design analysis and chronological draft log are
  archived under [`history/`](history/) so they cannot be confused with
  current requirements or open work.

## 0.1.0 — 2026-04-15

Initial public release.

- Core operations, schemas, bindings, sources, transforms, and security
  document model.
- JSON Schema compatibility profile, normalization, and operation matching.
- Well-known HTTP discovery convention.
- Initial conformance suite and operation-graph companion specification.
- Initial role interfaces.
