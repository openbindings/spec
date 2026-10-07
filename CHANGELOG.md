# Changelog

This file records user- and implementer-visible release deltas. The practical
0.1-to-0.2 document migration is in
[`MIGRATING-0.1-TO-0.2.md`](MIGRATING-0.1-TO-0.2.md). The much more detailed
chronological record of work on the draft is preserved in
[`history/0.2-development-log.md`](history/0.2-development-log.md).

## 0.2.0 (working draft)

Version 0.2.0 has not been released. The latest release is 0.1.0, and details
below may continue to change until the 0.2 release is cut. Entries describe
the difference from 0.1.0. Compatibility checking, security declarations,
transforms, and HTTP discovery leave the core; kinds, dependencies, value
contracts, context-free references, and numbered conformance rules arrive.

### Added

- **Core invariants.** [§2](openbindings.md#2-core-invariants) states six
  design constraints the numbered rules carry out: value contracts, enabling
  not invoking, bounded interpretation, context-free references,
  offline-decidable conformance, and decentralized extension.
- **Named operation dependencies.** The optional `dependencies` map
  ([§5.5](openbindings.md#55-dependencies)) declares named points where the
  described component consumes a realization of an operation. An entry has a
  required `operation` (an operation key, not an alias; OBI-D-11), optional
  `kinds`, and `description`. `kinds` is a non-empty, unique, unordered any-of
  constraint: a binding meets it exactly when its source's `kind` equals a
  listed kind, whatever any tool supports (OBI-T-01). Composing a dependency
  with a provider is a tool concern, and an unsatisfied dependency does not
  make a document non-conformant.
- **Value contracts.** `input` and `output` each state a value contract that
  governs every caller-facing value crossing the operation boundary in that
  direction, one value at a time (invariant 1,
  [§5.1](openbindings.md#51-operations)). Absent, `{}` or `true`, `false`,
  and `{"type": "null"}` are four distinct states, and boolean schemas are
  valid. §5.1 recommends `{"type": "object", "maxProperties": 0}` for an
  operation that takes, or returns, nothing meaningful.
- **Context and author claims.** [§5](openbindings.md#5-document-model)
  defines context: what a realization needs that the operation is not about,
  such as a credential, a target's address, or a deadline, supplied under the
  kind or by tool policy. It lists the document's author claims (examples, a
  binding's realization claim and its `idempotent`, a dependency's
  consumption claim, and correspondence); their truth is outside document
  conformance (OBI-T-09).
- **Value validation.** A tool that claims to validate a value against
  `input` or `output` evaluates each value separately under the schema's
  dialect, reads patterns as ECMA-262 with Unicode semantics, and gives no
  verdict where the result depends on a reference or capability it lacks, on
  a result JSON Schema leaves undefined, or on an absent schema (OBI-T-07). A
  tool that derives another form from a schema, such as a generated type,
  does not claim it preserves meaning it cannot represent (OBI-T-04).
- **Numbered conformance rules.** [§10](openbindings.md#10-conformance)
  judges conformance by document rules OBI-D-01 to OBI-D-13 and tool rules
  OBI-T-01 to OBI-T-10 alone, and a tool's obligations follow what it does
  and claims ([§10.1](openbindings.md#101-tool-obligations)). Every document
  rule is decidable offline from the document, the derived schema, and the
  JSON Schema 2020-12 meta-schemas (invariant 5). Rule-level evidence is
  satisfied, violated, inconclusive, or not applicable; a validator that
  lacks a capability a rule needs leaves it inconclusive, which is not a
  violation. A conclusion is conformant, non-conformant, or conformance
  undetermined ([§10.4](openbindings.md#104-conformance-conclusions)), and
  the tool reporting it names the text it applied: a patch release, a
  prerelease, or, before a first release, the working draft and its
  source-control revision (OBI-T-08).
- **Media type and canonical serialization.**
  [§11](openbindings.md#11-iana-considerations) gives registration details
  for `application/vnd.openbindings+json`.
  [Appendix A](openbindings.md#appendix-a-canonical-serialization-informative)
  (informative) names RFC 8785 JCS as a deterministic serialization, partial
  because a conformant OBI may have none.

### Changed

- **Sources carry a `kind` and kind-read `content`.** The required `format`
  token (name compared case-insensitively, trailing `.0` version segments
  ignored) is replaced by `kind`: an exact, opaque, non-empty string compared
  whole, never normalized or read for compatibility or version order, and
  never implicitly dereferenced (OBI-T-01). A source is `kind` with optional
  `content` (any JSON value) and `description`
  ([§5.4](openbindings.md#54-sources)). The core gives `content` no meaning:
  what it holds, how a binding's target is identified, value adaptation,
  interaction mechanics, binary encoding, and required context are read under
  the kind ([§6](openbindings.md#6-kinds)). Whether a tool supports a kind, or
  a definition of it exists, does not affect document conformance. Changes to
  the core provisions a kind stands on are recorded as breaking
  ([§8.1](openbindings.md#81-openbindings-field-specification-version)).
- **Bindings carry `content`.** The binding member `ref` is replaced by
  optional `content`, any JSON value read under the source's kind
  ([§5.3](openbindings.md#53-bindings)). It may identify the target and
  describe how values are adapted between the operation's value contracts and
  that target, which 0.1 expressed with transforms. A binding is an author
  claim that its target realizes the operation as the document describes it.
  The document need not suffice to identify, reach, or act on the target
  (invariant 2), and the core defines no invoker.
- **`priority` becomes `preference`.** The binding's `priority` (a number,
  lower preferred, with a source-level default) is replaced by `preference`,
  an integer from -9007199254740991 to 9007199254740991 where higher means
  stronger author preference and omission states no preference. Sources carry
  none. `preference` and `deprecated` are independent signals, and how they
  shape binding selection is up to tools.
- **`idempotent` moves from operations to bindings.** It is each binding's
  author claim that repeating the operation through that binding with the
  same input adds no intended operation-level effects after the first
  application; `false` claims some repetition can, and absence claims neither
  ([§5.3](openbindings.md#53-bindings)). It no longer means safe to retry with
  the same result, and alone it establishes neither retry safety nor
  cacheability.
- **An operation is a signature.** Its name and optional per-value `input`
  and `output` schemas are its whole signature
  ([§5.1](openbindings.md#51-operations)). Interaction pattern and
  cardinality belong to each binding under its source's kind, replacing 0.1's
  model of every operation as a stream of events. `output` describes every
  value the operation returns, error-shaped values included, not only
  successful results. Declaring an operation does not by itself claim that a
  realization is available.
- **Aliases form one namespace and carry correspondence.** Keys and aliases
  form one flat, document-unique namespace (OBI-D-04). A name resolves only by
  exact match, keys and aliases with equal standing, and a resolved
  operation's bindings are found by its key (OBI-T-06). Carrying a shared
  contract's published name as a key or alias claims correspondence with that
  contract's operation, as a consumer holding the contract reads it
  ([§5.1](openbindings.md#51-operations)); no rule verifies the claim, and it
  demonstrates no schema compatibility.
- **Names have a grammar.** Operation, dependency, binding, source, schema,
  and example keys, and aliases, match `^[A-Za-z0-9_][A-Za-z0-9_.-]*$` and
  compare as exact strings (OBI-D-03). 0.1 left operation keys unconstrained.
- **Objects are closed except for `x-` fields.** Each OBI-defined object
  carries only the fields its table lists and fields beginning with `x-`; any
  other field violates OBI-D-02 ([§12](openbindings.md#12-extensions)), so a
  removed 0.1 member left in place makes a 0.2 document non-conformant. Keys
  inside the document's maps are entry names, not fields. A tool gives each
  defined field its meaning, with presence distinct from value, and an
  unknown field none (OBI-T-02); no `x-` field changes the meaning of core
  fields (OBI-T-03).
- **An OBI is UTF-8 JSON.** Invalid UTF-8, malformed JSON, duplicate object
  keys, and a leading byte-order mark make a document non-conformant
  (OBI-D-01).
- **JSON Schema 2020-12 is the dialect.** Every schema the document contains
  is a 2020-12 schema in object or boolean form, valid against the 2020-12
  meta-schemas with `format` as an annotation (OBI-D-10). A `$schema`, where
  present, names 2020-12 (OBI-D-06), and the document resource's dialect is
  2020-12 ([§5.2](openbindings.md#52-schemas)). Beyond §5.2 and §7, JSON
  Schema governs meaning, resolution, and evaluation; the core defines no
  keyword or evaluation of its own. In 0.1, tools declared the dialects they
  supported, with 2020-12 the recommended default.
- **References are context-free.** No OBI-defined reference resolves against
  the URI a document was obtained from (invariant 4,
  [§7](openbindings.md#7-reference-resolution)). `$ref` and `$dynamicRef` in
  the document resource are absolute URIs or same-document references, and an
  `$id` at an OBI position is absolute (OBI-D-05). Same-document references
  there resolve against the OBI document, `#` names the document itself, and
  each must identify a schema at an OBI position (OBI-D-12). No plain name is
  declared twice in the document resource, and no `$id` by two schemas
  (OBI-D-13). A schema that declares `$id` begins its own resource, resolved
  as JSON Schema defines. Reference cycles are permitted (OBI-T-05), and
  declining an external resource never affects conformance. In 0.1, relative
  references resolved against the document's location and cycles failed
  closed.
- **Versions are read by line.** A document means what the text of the
  `major.minor` line its `openbindings` value names says, or of the
  prerelease it names
  ([§8.1](openbindings.md#81-openbindings-field-specification-version)). The
  patch number carries no meaning, build metadata is ignored, and a
  prerelease names itself, not its line. §8.1 defines when a text declares a
  version; a text that declares none is non-conformant under OBI-D-01 or
  OBI-D-09. The tool rules govern work done by applying a line's text to
  documents that declare that line
  ([§10.3](openbindings.md#103-tool-rules)). Whether a tool proceeds with,
  warns about, or declines a document of another line is its own choice, and
  applying another line's text establishes none of that document's rules
  ([§10.4](openbindings.md#104-conformance-conclusions)). 0.1 required
  refusal for a higher major version.
- **`version` is an opaque label.** It is a non-empty string with no
  ordering, compatibility, or identity meaning
  ([§8.2](openbindings.md#82-version-field-interface-version-label)); 0.1
  recommended SemVer.
- **The derived schema decides OBI-D-02.** `openbindings.schema.json` has the
  `$id` `https://openbindings.com/schema/openbindings-0.2.json`, which names
  the line (0.1: `openbindings-0.1.0.json`), and a title naming the patch
  release. Where it and the prose disagree, it decides OBI-D-02 until a patch
  release corrects it under the same `$id`. In 0.1 the schema was descriptive
  and the prose governed.
- **Examples are author claims.** Each example `input` and `output` is one
  caller-facing value the author claims satisfies the corresponding schema; a
  mismatch is a false claim, never an exception to the schema (OBI-T-10). An
  explicit `null` member is the JSON value `null`. In 0.1, examples were
  documentation that SHOULD validate.
- **Security considerations mandate no mitigation.**
  [§9](openbindings.md#9-security-considerations) describes the exposure the
  format creates, and §9.1 lists recommended mitigations (informative). 0.1's
  requirements on fetching, transform timeouts, and cycle rejection are gone.

### Removed

- **0.1 members**: root `roles`, `security`, and `transforms`; operation
  `satisfies` and `idempotent`; source `format`, `location`, and `priority`;
  binding `ref`, `priority`, `security`, `inputTransform`, and
  `outputTransform`. Where a replacement exists, it is described under
  Changed.
- **Compatibility checking**: the schema-comparison profile, normalization,
  the operation-matching algorithm, interface conformance, and compatibility
  reports. Comparison and matching beyond exact kind comparison and name
  resolution are tool concerns ([§1.2](openbindings.md#12-out-of-scope)).
  Correspondence through keys and aliases replaces `roles` and `satisfies`.
- **Security methods**: the `bearer`, `oauth2`, `basic`, and `apiKey` types.
  Credentials and other prerequisites are context.
- **Transforms**: transform objects, named transforms, and the JSONata
  requirement. Value adaptation is read under the source's kind, typically
  from binding `content`; the core defines no transform or expression
  language.
- **Source addressing rules**: the requirement of exactly one of `location`
  or `content`, and resolution of a relative `location` against the
  document's location.
- **Literal `null` for an unspecified `input` or `output`.** Omission is the
  only way to state no value contract.
- **Binding coverage, actionability, and location-based interface identity.**
  OBI assigns no document identity; `name` and `version` are labels.
- **YAML** as an alternate serialization.
- **HTTP discovery in the core.** The core no longer defines
  `/.well-known/openbindings` or any discovery convention; see the HTTP
  Discovery companion below.

### Repository

- **HTTP Discovery companion.** [`http-discovery.md`](http-discovery.md),
  version 0.1.0, is an optional, independently versioned specification. A
  service MAY publish its OBI at `/.well-known/openbindings`; DISC-S-01 to
  DISC-S-04 bind servers and DISC-C-01 to DISC-C-03 bind clients, as separate
  conformance classes. It gives registration details for the well-known URI
  suffix `openbindings`. Fetching supplies the document no base URI.
- **Core conformance corpus.** `conformance/` replaces 0.1's
  schema-comparison, normalization, and operation-matching fixtures.
  `document/` has one validity-fixture file per document rule; each case
  carries exactly one of `document`, `documentText`, or `documentBase64`, an
  expected verdict, and optional `violates` and `notViolated` rule lists.
  `tool/` holds validity fixtures for OBI-T-03 and OBI-T-09, and `scenarios/`
  holds tool scenarios in format `openbindings.core-tool-scenarios@2`
  (`tool-scenario.schema.json`). A scenario names an action
  (`validate-document`, `resolve-operation`, `validate-operation-values`,
  `conclude-conformance`, `check-dependency-kind`, `check-examples`, or
  `derive-form`), its input, the outcomes it allows, any version gates, and
  the tool-rule clauses it tests, which `clauses.json` inventories with their
  coverage. `runners/go` is a reference runner. The corpus is reference
  material; the prose governs.
- **Binding-specification candidates.** [`binding-specs/`](binding-specs/)
  holds unreleased first-revision candidates: one OpenAPI kind per OAS line
  (`openbindings.openapi-2.0@1`, `openbindings.openapi-3.0@1`,
  `openbindings.openapi-3.1@1`, `openbindings.openapi-3.2@1`) and candidates
  for AsyncAPI, GraphQL, gRPC, Connect, MCP, usage (CLI), and operation
  graphs. None is published. The four OpenAPI candidates are written for the
  0.2.0 kind model; the others are not yet revised to it.
  `binding-specs/PROJECT-POLICY.md` (PB-01 to PB-04: exact identifiers,
  publication completeness, revisions, JSONata for transforms) governs only
  the project's own `openbindings.*` kinds. The 0.1 operation-graph companion
  in `formats/operation-graph/` is now the `openbindings.operation-graph@1`
  candidate. The `conformance/binding-specs/` and
  `conformance/operation-graph/` subcorpora are not evidence of conformance
  to the current core.
- **Publication tooling.** `scripts/publish-binding-specifications.mjs`
  publishes named candidate revisions as immutable, self-contained bundles
  under `binding-specs/releases/`, recorded in `publications.json` with a
  hash chain that CI verifies. After publication, clarifications are
  append-only errata registered in `errata.json`, and an incompatible change
  takes a new identifier. Nothing has been published yet.
- **Interfaces and guides.** Project interfaces now live in the
  independently versioned `openbindings/interfaces` repository rather than
  `interfaces/`, and guides on openbindings.com rather than `guides/`.

## 0.1.0 — 2026-04-15

Initial public release.

- Core operations, schemas, bindings, sources, transforms, and security
  document model.
- JSON Schema compatibility profile, normalization, and operation matching.
- Well-known HTTP discovery convention.
- Initial conformance suite and operation-graph companion specification.
- Initial role interfaces.
