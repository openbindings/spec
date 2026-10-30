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
transforms, and HTTP discovery leave this specification; kinds, dependencies,
per-value schemas, location-independent references, and numbered conformance rules
arrive. The specification specifies the document model only.

### Sources revision (2026-10-29)

This unreleased revision returns `sources` to the document and removes
`resources` and the binding `kind` (breaking relative to the preceding working
draft). A source carries `kind` and optional `data`; a binding carries
`operation`, `source`, and optional `data`; both data values are read under the
source's kind, which also defines how they combine (§§5.2, 5.3, 6). `content`
becomes `data` on both. OBI-07 is again the binding's `source` reference, and a
source's kind being a non-empty string is structural under OBI-02. The
specification still reads no data and makes no claim about what data refers to
(invariant 4), and nothing in `sources` or in binding data is one of the
document's schemas (§7). Of the preceding revision, described below, the typed
`schemas` map and the removal of §7.6 stand; its binding-owned kinds and
`resources` do not. The core corpus, examples, and the focused draft checks
follow. [SOURCE-MODEL-DRAFT.md](SOURCE-MODEL-DRAFT.md) records the decisions
and migration status. §3 identifies the model's core nouns in one line each,
with the definitions in their sections, gains a Schema entry, and defines in
full only the three terms no other section defines: caller-facing, field, and
absolute URI. A review pass then made explicit that an alias is never an
operation reference (§5.1), that a `$schema` anywhere in a contained schema
violates no rule (§5.5), that the latest release of a line governs every
document declaring it (§8.1), that source and binding data travel with the
document (§9), and that the meta-schemas exclude a non-empty fragment from
`$id` (OBI-11); it condensed the undefined-result rules (§5.5), dropped a
sentence on copying bindings between documents that the model no longer
supports (§6), and renamed `examples/inline.obi.json` to
`kind-only.obi.json`. A further pass gave each release's schema an `$id` of
its own, with the line URL serving the latest (OBI-02, §10); noted that an
implementation may mint a private base URI for the document's schemas
(§7.2); and noted that anchors inside an `$id` resource follow JSON Schema
(OBI-13). A second review pass stated the domain of a dependency's `kinds`
constraint (the kind under which a candidate realization is described,
wherever that description lives, §5.4), split the undefined-result rules into
their two cases (§5.5), made §7.4's restatement of OBI-12 descriptive, spelled
§7.5's cross-document examples with their document part, and tightened
wording in §1.1, §3, §5, §7.2, §8.1, §9 and OBI-13.

### Binding/resources revision (2026-10-26, superseded)

This unreleased revision replaces the preceding 0.2 source model. Bindings
carry their own required `kind`; `sources` and `bindings[*].source` are removed.
Optional `resources` stores any JSON value binding content refers to, without a
wrapper, and the `schemas` map stays: where a value sits decides how
OpenBindings reads it. Every `schemas` entry is one of the document's schemas;
nothing in `resources` is, and a schema reference into `resources` identifies
no schema the document contains, which violates OBI-12. OBI-07 now constrains
binding kinds. OBI-12 also covers references that resolve into a schema
resource the document contains, and the new OBI-14 excludes `$dynamicAnchor`
from the document resource. No released snapshot is changed. Its draft note,
`RESOURCE-MODEL-DRAFT.md`, is replaced by
[SOURCE-MODEL-DRAFT.md](SOURCE-MODEL-DRAFT.md).

The glossary omits ordinary-language terms and duplicate definitions. Undefined
results, plain names, and version declarations are defined in §§5.5, 7.3, and
8.1. Schema references in the document resource are named directly.

**Kind interpretation boundary (breaking relative to the preceding working
draft).** Equivalent interpretation of inline and referenced material is no
longer required; each kind defines how its content is read (§6). Bindings declare
realizations without requiring a separate target concept. The empty-object
prescription for operations with no meaningful input or output and the advice
that callers must distinguish errors through schemas are removed. The draft
also trims repeated explanations and examples, makes security guidance about
kind processing conditional, and consolidates the compatibility guarantees for
kinds in §8.1. Schema evaluation and the shared `idempotent` field are unchanged.

**Typed schema storage (2026-10-27).** An intermediate form of this revision
replaced `schemas` with `resources` and recognized schemas by following local
pointers into it. An operation schema could then point into an embedded
artifact, whose own references and dialect were read by OpenBindings rules and
gave failed or wrong readings. Restoring the `schemas` map removes that
recognition procedure: a pointer into `resources` identifies no schema the
document contains, and an `$id` there identifies nothing to the document's schemas. A pointer may reach a
schema inside a schema that declares `$id` (§7.3).

**Content kinds; shared-value lookup removed (2026-10-28, breaking relative to
the preceding working draft).** A kind is the kind of a binding's content: it
names how `content` is read, and through the meaning it gives that content the
binding declares its realization (§§3, 6). The fields keep their names, `kind`
stays required, and what absent content means stays the kind's to define. The
specification makes no claim about what content may refer to, or how. Content
is read in its document and refers to shared resources as its kind defines
(§§5.2, 6). Shared-value references and their lookup (§7.6) are removed. Lookup
was one of §8.1's guarantees for kinds, so its removal is breaking; §8.1 keeps
storage in the `resources` map. A kind that used the form defines its own
references, citing RFC 6901 for JSON Pointer. The core corpus drops
`scenarios/7.6-shared-values.json` and the `lookup-shared-value` scenario action.
Where the text says kinds and extensions leave its meaning unchanged, it now
covers any meaning it gives the document, not only the meaning of fields, which
§3 defines narrowly to exclude map keys and schema internals.

### Added

- **Invariants.** [§2](openbindings.md#2-invariants) states the six
  invariants the model rests on: per-value schemas, declaration not
  availability, bounded interpretation, location-independent references,
  self-contained conformance, and decentralized naming.
- **Named operation dependencies.** The optional `dependencies` map
  ([§5.4](openbindings.md#54-dependencies)) declares named points where the
  software described by the OBI consumes a realization of an operation. An entry
  has a required `operation` (an operation key, not an alias; OBI-08), optional
  `kinds`, and `description`. `kinds` is a non-empty, unique, unordered any-of
  constraint: a binding meets it exactly when its kind is the same
  kind as a listed one ([§6](openbindings.md#6-kinds)). The document does not
  say which realization serves a dependency.
- **Input and output schemas.** `input` and `output`, when present, each hold
  a schema governing every caller-facing value crossing the operation boundary
  in that direction, one value at a time (invariant 1,
  [§5.1](openbindings.md#51-operations)). Absent, `{}` or `true`, `false`,
  and `{"type": "null"}` are four distinct states, and boolean schemas are
  valid. Schemas constrain values that occur without determining whether or
  how many occur. An operation is the capability its identifiers name and its
  description conveys, with optional input and output schemas
  ([§3](openbindings.md#3-terminology)).
- **Author claims.** [§5](openbindings.md#5-document-model) lists the document's
  author claims
  (examples, a binding's realization claim and its `idempotent`, a
  dependency's consumption claim, and correspondence); their truth is outside
  conformance.
- **Evaluating a value against a schema.** [§5.5](openbindings.md#55-schemas)
  defines when a value satisfies or fails an operation schema: under JSON Schema
  2020-12, with `format` as an annotation, patterns as ECMA-262 regular
  expressions with Unicode semantics, references resolved as §7 defines, and
  a schema document whose root declares no `$schema` read as 2020-12, one
  value at a time. Where validity depends on a result JSON Schema leaves
  undefined, satisfaction is undefined; where it depends on a resource the
  document does not contain, it depends on that resource. Validity depends on
  such a part only when the part's outcome, with the annotations that follow
  it, would change it; a value that depends on both is, from the document
  alone, undefined only if it would be undefined whatever the resource holds,
  and with the resource the same rules decide. When a schema is absent, there is
  no schema to evaluate for that direction.
- **Numbered conformance rules.** [§10](openbindings.md#10-conformance)
  defines conformance by rules OBI-01 to OBI-14, ordered by subject, which
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

- **Sources carry kinds; bindings name their sources.** Each source carries a
  required `kind`, an exact, opaque, non-empty name with no normalization,
  version algebra, or address meaning (§6), and optional `data`. Each binding
  carries `operation`, `source`, naming a key in `sources` (OBI-07), and
  optional `data`. A binding has no kind of its own. The source's kind names how
  its data and the data of the bindings naming it are read, and how they
  combine; through that meaning each binding declares its realization (§§5.2,
  5.3). Target identification, value adaptation, and interaction mechanics are
  declared through source and binding data, read under the kind.
- **`data` replaces `location`, `content`, and `ref`.** Source data holds
  whatever the kind reads from the source: an embedded artifact, an address, a
  descriptor, or nothing, where the kind needs only the source's name. Binding
  data holds what the kind reads from the binding. OpenBindings never reads
  either as schemas: a schema reference into `sources` identifies no schema the
  document contains, and identifiers in data are not registered (§§5.2, 7).
- **`priority` becomes `preference`.** The binding's `priority` (a number,
  lower preferred, with a source-level default) is replaced by `preference`,
  an integer from -9007199254740991 to 9007199254740991 where higher means
  stronger author preference and omission states no preference. There is no
  source-level default. `preference` and `deprecated` are independent author
  signals; neither
  takes precedence over the other.
- **`idempotent` moves from operations to bindings.** It is each binding's
  author claim that repeating the operation through that binding with the
  same input adds no intended operation-level effects after the first
  application; `false` claims some repetition can, and absence claims neither
  ([§5.3](openbindings.md#53-bindings)). It no longer means safe to retry with
  the same result, and alone it establishes neither retry safety nor
  cacheability.
- **Operations are protocol-independent.** Each operation names a capability
  with optional per-value `input` and `output` schemas
  ([§5.1](openbindings.md#51-operations)). Interaction pattern and
  cardinality belong to each binding under its kind, replacing 0.1's
  model of every operation as a stream of events. `output` describes every
  value the operation returns, error-shaped values included, not only
  successful results. Declaring an operation does not by itself claim that a
  realization is available.
- **Aliases form one namespace and carry correspondence.** Keys and aliases
  form one flat, document-unique namespace (OBI-05). A string identifies an
  operation exactly when it equals its key or one of its aliases, and the
  operation's bindings are those whose `operation` holds its key
  ([§5.1](openbindings.md#51-operations)). Authors may publish sets of
  operations for adoption, including as interfaces described by OBIs. Carrying
  a published name as a key or alias claims correspondence with the operation
  that name identifies in each published set the reader holds that includes it
  ([§5.1](openbindings.md#51-operations)); the claim demonstrates no schema
  compatibility. The order of `aliases` carries no meaning, nor does that of
  `tags`, where a repeated tag adds nothing.
- **Names have a grammar.** Operation, dependency, binding, schema, source,
  and example keys, and aliases, match `^[A-Za-z0-9_][A-Za-z0-9_.-]*$` and
  compare as exact strings (OBI-04); strings are equal when their UTF-16 code
  units are ([§5](openbindings.md#5-document-model)). 0.1 left operation keys unconstrained.
- **Objects are closed except for `x-` fields.** Each OBI-defined object
  carries only the fields its table lists and fields beginning with `x-`; any
  other field violates OBI-02 ([§12](openbindings.md#12-extensions)), so a
  removed 0.1 member left in place makes a 0.2 document non-conformant. Keys
  inside the document's maps are entry names, not fields. Presence is
  distinct from value, and an `x-` field, an extension, never changes any
  meaning that OpenBindings gives the document.
- **An OBI is UTF-8 JSON.** Invalid UTF-8, malformed JSON, duplicate object
  keys, a leading byte-order mark, and an escape that denotes an unpaired
  surrogate (such as `"\ud800"`) make a document non-conformant (OBI-01).
  Surrogate pairs and noncharacters remain permitted.
- **JSON Schema 2020-12 is the dialect.** Every schema the document contains
  is a 2020-12 schema in object or boolean form, valid against the 2020-12
  meta-schemas with `format` as an annotation (OBI-10). A `$schema`, where
  present, names 2020-12 (OBI-09), and every schema the document contains is
  read as 2020-12 ([§5.5](openbindings.md#55-schemas)), so a `$schema` has no
  other effect, even where JSON Schema does not permit one. Beyond §5.5 and §7, JSON
  Schema governs meaning, resolution, and evaluation; OpenBindings defines no
  keyword or evaluation of its own. In 0.1, tools declared the dialects they
  supported, with 2020-12 the recommended default.
- **References are location-independent.** No OBI-defined reference resolves against
  the URI a document was obtained from (invariant 4,
  [§7](openbindings.md#7-reference-resolution)). `$ref` and `$dynamicRef` in
  the document resource are absolute URIs or same-document references, and an
  `$id` at an OBI position is absolute (OBI-11). A same-document reference
  there identifies what [§7.3](openbindings.md#73-same-document-references)
  defines (`#` the document itself), and each must identify a schema the
  document contains, as must every reference that resolves into a schema
  resource the document contains (OBI-12). No plain name is declared twice in
  the document resource, and no `$id` by two schemas (OBI-13). No
  `$dynamicAnchor` appears in the document resource, where it would capture
  `$dynamicRef`s throughout the document (OBI-14). A schema that declares `$id`
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
- **The derived schema governs OBI-02.** `openbindings.schema.json` has an
  `$id` naming the release that publishes it
  (`https://openbindings.com/schema/openbindings-0.2.0.json` for 0.2.0; 0.1:
  `openbindings-0.1.0.json`), and
  `https://openbindings.com/schema/openbindings-0.2.json` serves the latest
  release of the line's schema. Where it and the prose disagree, it governs
  OBI-02 until a patch release corrects it under an `$id` of its own. In 0.1
  the schema was descriptive and the prose governed. Its descriptions are short labels that cite the
  section defining each member.
- **Examples are author claims.** Each example `input` and `output` is one
  caller-facing value the author claims satisfies the corresponding schema,
  where present. A value that fails it makes the claim false, and examples
  never change the schema ([§5.1](openbindings.md#51-operations)). An
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
  reports. OpenBindings fixes only when two kinds are the same and which operation
  a string identifies ([§6](openbindings.md#6-kinds), [§5.1](openbindings.md#51-operations)).
  Correspondence through keys and aliases replaces `roles` and `satisfies`.
- **Security methods**: the `bearer`, `oauth2`, `basic`, and `apiKey` types.
- **Transforms**: transform objects, named transforms, and the JSONata
  requirement. Value adaptation is read under the source's kind, typically
  from binding `data`; OpenBindings defines no transform or expression
  language.
- **Source addressing rules**: the requirement of exactly one of `location`
  or `content`, and resolution of a relative `location` against the
  document's location.
- **Literal `null` for an unspecified `input` or `output`.** Omission is the
  only way to leave the schema unstated.
- **Binding coverage, actionability, and location-based interface identity.**
  OBI assigns no document identity; `name` and `version` are labels.
- **YAML** as an alternate serialization.
- **HTTP discovery.** This specification no longer defines
  `/.well-known/openbindings` or any discovery convention; see the HTTP
  Discovery companion below.

### Repository

- **HTTP Discovery companion.** [`http-discovery.md`](http-discovery.md),
  version 0.1.0, is an optional, independently versioned specification. A
  service MAY publish its OBI at `/.well-known/openbindings`; DISC-S-01 to
  DISC-S-04 bind servers and DISC-C-01 to DISC-C-03 bind clients, as separate
  conformance classes. It gives registration details for the well-known URI
  suffix `openbindings`. Fetching supplies the document no base URI.
- **Document conformance corpus.** `conformance/` replaces 0.1's schema-comparison,
  normalization, and operation-matching fixtures. `document/` holds validity
  fixtures, one file per rule and one per section that answers a case; each
  case carries exactly one of `document`, `documentText`, or
  `documentBase64`, an expected verdict, and optional `violates` and
  `notViolated` rule lists. `scenarios/` holds scenarios in format
  `openbindings.core-scenarios@4` (`scenario.schema.json`), grouped by the
  section that answers them: which operation a string identifies, whether
  values satisfy a schema, whether a binding meets a dependency's `kinds`,
  what examples claim, and whether a document conforms. `runners/go` keeps the
  historical runner for the preceding source-model corpus. The corpus is
  reference material; the prose governs.
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
  to the current OpenBindings specification.
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
