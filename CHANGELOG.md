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
contracts, location-independent references, and numbered conformance rules
arrive. The specification specifies the document model only.

### Added

- **Core invariants.** [§2](openbindings.md#2-core-invariants) states the six
  invariants the model rests on: value contracts, declaration not
  availability, bounded core meaning, location-independent references,
  self-contained conformance, and decentralized naming.
- **Named operation dependencies.** The optional `dependencies` map
  ([§5.5](openbindings.md#55-dependencies)) declares named points where the
  described component consumes a realization of an operation. An entry has a
  required `operation` (an operation key, not an alias; OBI-08), optional
  `kinds`, and `description`. `kinds` is a non-empty, unique, unordered any-of
  constraint: a binding meets it exactly when its source's kind is the same
  kind as a listed one ([§6](openbindings.md#6-kinds)). The document does not
  say which realization serves a dependency.
- **Value contracts.** `input` and `output` each state a value contract that
  governs every caller-facing value crossing the operation boundary in that
  direction, one value at a time (invariant 1,
  [§5.1](openbindings.md#51-operations)). Absent, `{}` or `true`, `false`,
  and `{"type": "null"}` are four distinct states, and boolean schemas are
  valid. §5.1 recommends `{"type": "object", "maxProperties": 0}` for an
  operation that takes, or returns, nothing meaningful. An operation's
  contract is the capability its identifiers name and its description
  conveys, with its value contracts ([§3](openbindings.md#3-terminology)).
- **Context and author claims.** [§3](openbindings.md#3-terminology)
  defines context: what a realization needs that the operation is not about,
  such as a credential, a target's address, or a deadline, carried in content
  under the source's kind or coming from outside the document. A credential
  is caller-facing only when the author describes it in `input` or `output`.
  [§5](openbindings.md#5-document-model) lists the document's author claims
  (examples, a binding's realization claim and its `idempotent`, a
  dependency's consumption claim, and correspondence); their truth is outside
  conformance.
- **Satisfying a value contract.** [§5.2](openbindings.md#52-schemas)
  defines when a value satisfies or fails a contract: under JSON Schema
  2020-12, with `format` as an annotation, patterns as ECMA-262 regular
  expressions with Unicode semantics, references resolved as §7 defines, and
  a schema document whose root declares no `$schema` read as 2020-12, one
  value at a time. Where validity depends on a result JSON Schema leaves
  undefined, satisfaction is undefined; where it depends on a resource the
  document does not contain, it depends on that resource. Validity depends on
  such a part only when the part's outcome, with the annotations that follow
  it, would change it; a value that depends on both is, from the document
  alone, undefined only if it would be undefined whatever the resource holds,
  and with the resource the same rules decide. An absent schema states no
  contract.
- **Numbered conformance rules.** [§10](openbindings.md#10-conformance)
  defines conformance by rules OBI-01 to OBI-13, ordered by subject, which
  govern texts that declare a version of the 0.2 line or none. Whether a
  document conforms depends only on the document and that release's text,
  derived schema, and normative references, the JSON Schema 2020-12
  meta-schemas among them (invariant 5). The specification gives meaning only
  to conformant documents. Text marked *Note* in a rule, and a paragraph that
  begins with **Note**, is informative.
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
  never an address ([§6](openbindings.md#6-kinds)). A source is `kind` with optional
  `content` (any JSON value) and `description`
  ([§5.4](openbindings.md#54-sources)). The core gives `content` no meaning:
  what it holds, how a binding's target is identified, value adaptation,
  interaction mechanics, binary encoding, and required context are read under
  the kind ([§6](openbindings.md#6-kinds)). Whether a definition of a kind
  exists does not affect conformance. Changes to
  the core provisions a kind stands on are recorded as breaking
  ([§8.1](openbindings.md#81-openbindings-field-specification-version)).
- **Bindings carry `content`.** The binding member `ref` is replaced by
  optional `content`, any JSON value read under the source's kind
  ([§5.3](openbindings.md#53-bindings)). It may identify the target and
  describe how values are adapted between the operation's value contracts and
  that target, which 0.1 expressed with transforms. A binding is an author
  claim that its target realizes the operation as the document describes it.
  The document need not suffice to identify or reach the target (invariant 2),
  and the core defines no invocation behavior.
- **`priority` becomes `preference`.** The binding's `priority` (a number,
  lower preferred, with a source-level default) is replaced by `preference`,
  an integer from -9007199254740991 to 9007199254740991 where higher means
  stronger author preference and omission states no preference. Sources carry
  none. `preference` and `deprecated` are independent author signals; neither
  takes precedence over the other.
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
  form one flat, document-unique namespace (OBI-05). A string identifies an
  operation exactly when it equals its key or one of its aliases, and the
  operation's bindings are those whose `operation` holds its key
  ([§5.1](openbindings.md#51-operations)). Carrying a shared
  contract's published name as a key or alias claims correspondence with that
  contract's operation, as a reader holding the contract reads it, and with
  the operation of that name in every other held contract that publishes it
  ([§5.1](openbindings.md#51-operations)); the claim demonstrates no schema
  compatibility. The order of `aliases` carries no meaning, nor does that of
  `tags`, where a repeated tag adds nothing.
- **Names have a grammar.** Operation, dependency, binding, source, schema,
  and example keys, and aliases, match `^[A-Za-z0-9_][A-Za-z0-9_.-]*$` and
  compare as exact strings (OBI-04); strings are equal when their UTF-16 code
  units are ([§5](openbindings.md#5-document-model)). 0.1 left operation keys unconstrained.
- **Objects are closed except for `x-` fields.** Each OBI-defined object
  carries only the fields its table lists and fields beginning with `x-`; any
  other field violates OBI-02 ([§12](openbindings.md#12-extensions)), so a
  removed 0.1 member left in place makes a 0.2 document non-conformant. Keys
  inside the document's maps are entry names, not fields. Presence is
  distinct from value, and an `x-` field, an extension, never changes the
  meaning of a core field.
- **An OBI is UTF-8 JSON.** Invalid UTF-8, malformed JSON, duplicate object
  keys, and a leading byte-order mark make a document non-conformant
  (OBI-01).
- **JSON Schema 2020-12 is the dialect.** Every schema the document contains
  is a 2020-12 schema in object or boolean form, valid against the 2020-12
  meta-schemas with `format` as an annotation (OBI-10). A `$schema`, where
  present, names 2020-12 (OBI-09), and every schema the document contains is
  read as 2020-12 ([§5.2](openbindings.md#52-schemas)), so a `$schema` has no
  other effect, even where JSON Schema does not permit one. Beyond §5.2 and §7, JSON
  Schema governs meaning, resolution, and evaluation; the core defines no
  keyword or evaluation of its own. In 0.1, tools declared the dialects they
  supported, with 2020-12 the recommended default.
- **References are location-independent.** No OBI-defined reference resolves against
  the URI a document was obtained from (invariant 4,
  [§7](openbindings.md#7-reference-resolution)). `$ref` and `$dynamicRef` in
  the document resource are absolute URIs or same-document references, and an
  `$id` at an OBI position is absolute (OBI-11). A same-document reference
  there identifies what [§7.3](openbindings.md#73-same-document-references)
  defines (`#` the document itself), and each must identify a schema at an
  OBI position (OBI-12). No plain name is declared twice in the document
  resource, and no `$id` by two schemas (OBI-13). A schema that declares `$id`
  begins its own resource, resolved as JSON Schema defines. Reference cycles
  are permitted, and external resources never affect conformance. In 0.1, relative
  references resolved against the document's location and cycles failed
  closed.
- **Versions are read by line.** A document means what the text of the
  `major.minor` line its `openbindings` value names says, or of the
  prerelease it names
  ([§8.1](openbindings.md#81-openbindings-field-specification-version)). The
  patch number carries no meaning, build metadata is ignored, and a
  prerelease names itself, not its line. §8.1 defines when a text declares a
  version (UTF-8 with no byte-order mark, the JSON grammar, and exactly one
  `openbindings` member holding a SemVer string); a text that declares none
  violates OBI-01 or OBI-03. Each line or prerelease is its own document
  model, and a line's rules govern texts that declare it, or no version
  ([§10](openbindings.md#10-conformance)). 0.1 required refusal for a higher
  major version.
- **`version` is an opaque label.** It is a non-empty string with no
  ordering, compatibility, or identity meaning
  ([§8.2](openbindings.md#82-version-field-interface-version-label)); 0.1
  recommended SemVer.
- **The derived schema governs OBI-02.** `openbindings.schema.json` has the
  `$id` `https://openbindings.com/schema/openbindings-0.2.json`, which names
  the line (0.1: `openbindings-0.1.0.json`), and a title naming the patch
  release. Where it and the prose disagree, it governs OBI-02 until a patch
  release corrects it under the same `$id`. In 0.1 the schema was descriptive
  and the prose governed. Its descriptions are short labels that cite the
  section defining each member.
- **Examples are author claims.** Each example `input` and `output` is one
  caller-facing value the author claims satisfies the corresponding contract;
  a value that fails it makes the claim false, and the schema alone states
  the contract ([§5.1](openbindings.md#51-operations)). An
  explicit `null` member is the JSON value `null`. In 0.1, examples were
  documentation that SHOULD validate.
- **Security considerations describe exposure.**
  [§9](openbindings.md#9-security-considerations) describes the exposure the
  format creates and names common measures against it. 0.1's requirements on
  fetching, transform timeouts, and cycle rejection are gone.

### Removed

- **0.1 members**: root `roles`, `security`, and `transforms`; operation
  `satisfies` and `idempotent`; source `format`, `location`, and `priority`;
  binding `ref`, `priority`, `security`, `inputTransform`, and
  `outputTransform`. Where a replacement exists, it is described under
  Changed.
- **Compatibility checking**: the schema-comparison profile, normalization,
  the operation-matching algorithm, interface conformance, and compatibility
  reports. The core fixes only when two kinds are the same and which operation
  a string identifies ([§6](openbindings.md#6-kinds), [§5.1](openbindings.md#51-operations)).
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
- **Core test corpus.** `conformance/` replaces 0.1's schema-comparison,
  normalization, and operation-matching fixtures. `document/` holds validity
  fixtures, one file per rule and one per section that answers a case; each
  case carries exactly one of `document`, `documentText`, or
  `documentBase64`, an expected verdict, and optional `violates` and
  `notViolated` rule lists. `scenarios/` holds scenarios in format
  `openbindings.core-scenarios@3` (`scenario.schema.json`), grouped by the
  section that answers them: which operation a string identifies, whether
  values satisfy a contract, whether a binding meets a dependency's `kinds`,
  what examples claim, and whether a document conforms. `runners/go` is a
  reference runner. The corpus is reference material; the prose governs.
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
