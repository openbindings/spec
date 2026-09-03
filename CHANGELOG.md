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

- **Named operation dependencies in the Core document model.** The optional
  `dependencies` map declares named consumption points that reference operation
  keys and may carry a nonempty, unique, unordered `bindingSpecs` any-of list of
  exact binding-specification identifiers. Operations are now explicitly neutral
  contracts: bindings attest concrete realizations, dependencies declare
  consumption, and either relationship may appear independently or together.
  Dependency satisfaction, provider matching and selection, registration,
  lifecycle/readiness, and unsatisfied-dependency behavior remain implementation
  concerns. OBI-D-19 provides same-document dependency-to-operation integrity;
  the derived schema and core conformance corpus cover the new structure.

- **`openbindings.binding-spec-synthesis-scenarios@4`**, replacing `@2` across
  two revisions. `@3` carries two optional members, and is a revision rather
  than an additive field because a
  runner that predates a member ignores it, reports the scenario green, and has
  verified none of it. A scenario may carry `resources`, the same closed,
  immutable, absolute-URI-keyed companion-document set a processor scenario
  carries under `given.resources`, served offline through the family adapter's
  own artifact resolver; without it the format could not express a
  multi-document artifact at all, so `openbindings.openapi@1` §6 "Reference
  scope" had no portable synthesis coverage. A `synthesized` scenario may carry
  `assertions`, pointer-addressed comparisons against the emitted OBI document
  reusing the processor corpus's own assertion object and evaluators. Neither
  widens the identity surface: `operations`, `bindings`, `coverage` and
  `outcome` are compared exactly as before. `@4` renames the identity member
  `bindingRef` to `bindingSelector`, tracking the core rename of the binding
  member `ref` to `selector`, and with it the usage corpus's durable
  coverage-identity spellings: reason code `usage.no_unique_command_ref`
  becomes `usage.no_unique_command_selector` and the sentinel `sourceRef`
  prefix `ambiguous-ref:` becomes `ambiguous-selector:` (`sourceRef` itself,
  a source-local unit identifier, is unchanged).
  `conformance/binding-specs/README.md` states the addressing rule that keeps an
  assertion on the authority-defined side of the line — a path may traverse
  names an authority defines and names the artifact supplies, never a name an
  implementation mints — and states the two places that rule costs the corpus
  evidence today.

- `openbindings.openapi@1` §9.1 and OAPI-P-02 state that a `form`,
  `spaceDelimited`, `pipeDelimited` or `deepObject` declaration whose resolved
  schema carries a member with **no defined expansion** is refused at admission
  and its exclusion accounted. Each of those styles expands a composite value
  exactly one level, so every member becomes a member string; an array whose
  resolved items resolve to `object` or `array`, or an object one of whose
  resolved property schemas does, therefore declares a member with no
  representation. The refusal is decided by the DECLARATION, because every
  value conforming to it carries that member as a composite — the unit was
  previously published as represented and refused only once a caller populated
  it. The authority is read per edition: the `form` row cites [RFC 6570] §3.2.8
  on every accepted edition and those expansions append member strings, while
  `spaceDelimited`, `pipeDelimited` and `deepObject` cite no RFC section on any
  edition; the `deepObject` row governs the case without defining it on 3.0.0,
  3.0.1, 3.0.2, 3.0.3 and 3.1.0 ("Provides a simple way of rendering nested
  objects using form parameters"), and 3.0.4, 3.1.1 and 3.1.2 state it outright
  ("The representation of array or object properties is not defined"). No
  representation is authored, and whether to expose an interpretation choice
  for these declarations is left open. The excluded unit is the smallest one
  that owns the defect: a parameter's **target**, a form-body property's
  **alternative**. A typeless member, a choice with more than one non-null
  branch, and an object declaring no members at all are deliberately not
  reached, because a declaration-keyed rule must not refuse a declaration that
  admits a scalar value. `simple`, `label` and `matrix` are not addressed.

- **Three portable synthesis scenarios for the style-lane composite-member
  rule** (`OAPI-SS-36`–`OAPI-SS-38`). `OAPI-SS-36` pins both positions and
  their two accountings side by side with the controls the rule must not
  reach; `OAPI-SS-37` and `OAPI-SS-38` are an edition-scoped pair with
  identical member bytes and opposite answers, because the 3.1 line reads an
  array-valued `type` as a union under [JSON Schema 2020-12] §6.1.1 while every
  3.0 edition states that "Multiple types via an array are not supported". Both
  of the first two fail in both runners when the synthesis gate is reverted;
  the 3.0 twin stays green, which is what scopes the collapse to one line.

- **Five portable synthesis scenarios for `openbindings.openapi@1` §6
  "Reference scope"** (`OAPI-SS-25`–`OAPI-SS-29`), authored from the
  multi-document case table the three engines already share. A dangling
  reference outside the composed closure synthesizes; the same defect inside it
  refuses; a pointer into one property composes that property and not its
  siblings; and two sequence cases pin index-scoped retention, where a sequence
  keeps its length and every index and an uncomposed element cannot decide the
  artifact. Four of the five fail when the pointer-scope implementation is
  reverted, in both runners, proven by execution; the refusing twin stays green
  because a whole-file composer refuses that artifact too, which is why it
  cannot carry the proof alone.

- **`OAPI-SS-17` gains four assertions** pinning that a date-, time- or
  boolean-word-shaped plain scalar crosses the boundary as the string the
  artifact wrote. That value is decided by every accepted edition's "Tags MUST
  be limited to those allowed by [YAML's] JSON schema ruleset" and YAML 1.2.2
  §10.3.2, and it was previously invisible to the corpus: the scenario passed
  while one implementation emitted `{}`.

- `openbindings.openapi@1` §9.2 and OAPI-P-04 state, per edition, what a form
  part whose resolved Schema Object declares no `type` defaults to. Every
  accepted 3.1 edition states `application/octet-stream` for it — 3.1.1 and
  3.1.2 tabulate a `type`-absent first row in the Encoding Object's own default
  table, and 3.1.0 reaches the same answer through the total catch-all closing
  its prose enumeration — and this revision defines no boundary from a JSON
  application value to octets for a form part, so such a part refuses before
  dispatch there and its alternative is an accounted exclusion. The 3.0 line
  states no row that reaches it: 3.0.0 through 3.0.3 enumerate a `string` with
  `format: binary`, other primitive types, `object`, and `array` without a
  catch-all, and 3.0.4 tabulates the same cases keyed on a declared `type`.
  This specification's own convention answers there, keyed the same way those
  editions key their stated rows, and it now says which five editions it
  covers.

  **This revises a prior draft position, and the prior text was wrong.** §9.2
  read an unconstrained part as asserting nothing and applied the convention on
  every edition, which displaced a stated authority row on three of the eight.
  Two portable scenarios asserted the displaced reading and are corrected:
  OAPI-SS-14 moves to `openapi: 3.0.3`, and OAPI-PS-50 keeps only its
  nullable-choice half. New scenarios pin the corrected split: OAPI-SS-23
  (3.1.1, the tabulated row), OAPI-SS-24 (3.1.0, the catch-all), OAPI-PS-56
  (the 3.0-line convention) and OAPI-PS-57 (the 3.1 refusal). The convention's
  predicate is also stated exactly — `type`-absence, the key the editions' own
  rows use — rather than the narrower "memberless or boolean `true`" the prior
  text named, which never matched the behavior a `description`-carrying part
  received.

- The unreleased first `openbindings.asyncapi@1` candidate. It treats AsyncAPI
  Core and each artifact-declared protocol binding as authority incorporated
  by this candidate's deliberate upstream-deferential policy,
  normalizes AsyncAPI 2.0.0–2.6.0 and 3.0.0–3.1.0 operations, and leaves
  concrete execution to protocol drivers. Synthesis is independent of which
  drivers happen to be installed; unsupported execution fails locally before
  dispatch. No Core OBI document-model field changed.

- **The OpenAPI binding-specification family**: four sibling
  specifications, one per published OAS minor line — `openbindings.openapi-2.0@1`
  (edition 2.0), `openbindings.openapi-3.0@1` (3.0.0–3.0.4),
  `openbindings.openapi-3.1@1` (3.1.0–3.1.2), and `openbindings.openapi-3.2@1`
  (3.2.0) — replacing the earlier unified `openbindings.openapi@1` candidate,
  which is deleted. Each sibling states its own line's rules flatly with
  per-clause provenance labels and pinned authority citations. The
  caller-facing correspondence value is the `{parameters?, body?}` envelope
  with artifact-derived routing; the flattening trigger apparatus, routed
  tuple, and unmatched-field passthrough are removed, with flat synthesized
  contracts carried by emitted `inputTransform`s. Callbacks and webhooks
  synthesize as targetless Core dependencies with role-inverted contracts.
  The 3.2 sibling incorporates OAS 3.2's sequential-media, `itemSchema`, and
  SSE event model; 3.0 and 3.1 state the one-body/one-value limit their
  editions force. The naming convention
  `openbindings.<family>-<upstream-line>@<rev>` is recorded in the
  binding-specs README. Earlier working-draft entries below that cite
  `openbindings.openapi@1` or `OAPI-*` rule identifiers record development
  history now carried forward — where their rules survived — under the
  family identifiers and `OAPI20`/`OAPI30`/`OAPI31`/`OAPI32` rule prefixes,
  with the conformance corpus partitioned per family
  (`processor-scenarios@2`, `synthesis-scenarios@5`).

- A small, explicit set of core invariants: per-value contracts,
  enabling-not-invoking, split authority, context-free documents,
  offline-decidable core conformance, and decentralized extension.
- Exact `bindingSpec` identifiers and the `OBI-B-01` through `OBI-B-03`
  completeness and revision rules for binding specifications.
- Unreleased first-revision candidates for AsyncAPI, GraphQL, gRPC,
  Connect, MCP, usage/CLI, and operation graphs, alongside the OpenAPI
  family above, plus publication tooling for
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

- The portable synthesis scenario schema adopts the published
  `interface-synthesizer` 0.2 contract's `SynthesizeInterfaceSource`
  constraint verbatim: a scenario's `source` declares `location`, `content`,
  or both. A scenario can no longer demand behavior from an input shape no
  conformant synthesizer accepts. Every one of the 63 existing scenarios
  already satisfied it; the corpus is unchanged and no runner behavior moves.

- The binding-specification subcorpus README's scenario counts are now derived
  rather than maintained by hand. Three of them had gone stale across several
  corpus growths, each restated in prose with nothing checking it: 138
  processor scenarios, 52 distinct P-rules, thirty synthesis scenarios, against
  a corpus holding 148, 51 and 63. The new
  `scripts/count-binding-spec-scenarios.mjs` derives all three from the corpus
  files and prints them per family, and `scripts/verify-binding-specs.mjs`
  fails when the README and the corpus disagree.

- `openbindings.openapi@1` §6 now states **reference traversal** — what a
  reference's fragment means when its own path runs below another reference
  (`#/components/schemas/Alias/properties/name`, where `Alias` is a `$ref`
  object) — and the accepted editions answer it differently, so both branches
  are stated. Under OAS 3.0.0–3.0.4 the reference standing in the path is
  resolved and evaluation continues into the target, because those editions
  process `$ref` as per JSON Reference, which frames itself as transclusion,
  ignores every other member, and resolves to the referenced value. Under
  OAS 3.1.0–3.1.2 it is not, and the reference is unresolvable: §4.6 makes the
  fragment a JSON-Pointer over the referenced document, and the 3.1 Schema
  Object's JSON Schema 2020-12 dialect makes `$ref` an applicator that
  substitutes nothing, so the next token identifies no member and RFC 6901 §4's
  error condition arises. The governing edition is the artifact's own. Three
  citations are corrected with it: §6 and §11 qualify `[JSON Reference]` to the
  five 3.0 editions that name it, §11 adds the JSON Schema 2020-12 **core**
  vocabulary that every reference semantic actually lives in beside the
  validation vocabulary it already cited, and §7 no longer attributes its
  path-item `$ref` rule to "OAS reference resolution" — no accepted edition
  states it, and the rule is this specification's under core OBI-B-02 item 5
  and RFC 6901 §7's delegation to an application of JSON Pointer. No Core OBI
  document-model field changed.

- The invocation interfaces now define unsuccessful completion as exactly
  `{code,data?}`. They have no portable message or diagnostic escape lane;
  application-authored JSON failure values may cross only when the governing
  binding specification admits them, while native protocol and implementation
  evidence stays below the bridge. Context challenges retain their
  `CONTEXT_REQUIRED` data contract, use relative JSON Pointer paths for
  `config.value`, and make durability an explicit permission rather than a
  persistence default. Frame and operation validation mechanics use distinct
  owned codes, and caller-supplied invocation deadlines are cancellation at
  this abstract boundary. Operation Graph preserves the complete minimal
  terminal record, including absent versus explicitly null data. No Core OBI
  document-model field changed.

- Binding-specification authority is now explicit: the named binding
  specification is sovereign and may define, incorporate, subset, extend, or
  override other authorities. OBI-B-02 remains the completeness floor for
  portable claims and `openbindings.*` publication, not a gate on a
  specification's existence or implementation. Implementations may complete
  underdefined specifications locally, but those choices remain
  implementation-defined and cannot be attributed to the identifier's
  portable meaning. This clarification changes no OBI document-model field.

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
- The binding member `ref` was renamed `selector`: the
  binding-specification-defined selector of a specific target within the
  governed source. Only the member name changed — syntax, meaning, the
  absent-`selector` case, and binding-specification ownership are unchanged,
  and rule identifiers (OBI-*, family rules) are untouched.
- Source `location`/`content` pairing and binding `selector` meaning are
  governed by the exact binding specification. Relative,
  retrieval-context-dependent OBI references are no longer portable.
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
