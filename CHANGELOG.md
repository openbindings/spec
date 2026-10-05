# Changelog

This file records user- and implementer-visible release deltas. The practical
0.1-to-0.2 document migration is in
[`MIGRATING-0.1-TO-0.2.md`](MIGRATING-0.1-TO-0.2.md). The much more detailed
chronological record of work on the draft is preserved in
[`history/0.2-development-log.md`](history/0.2-development-log.md).

## 0.2.0 (working draft)

Version 0.2.0 has not been released. The latest release is 0.1.0, and details
below may continue to change until the 0.2 release is cut.
Entries below retain the chronology of the working draft; the kind change in
the first Changed entry supersedes earlier draft descriptions of `bindingSpec`,
`bindingSpecs`, and OBI-B rules.

### Added

- **The core's deferral boundary is explicit.** [§6](openbindings.md#6-kinds)
  states what the document model defines about a kind and what it leaves to
  tools that interpret sources and bindings. The core makes no claim that a
  written definition or implementation exists for a kind. [§8.1](openbindings.md#81-openbindings-field-specification-version)
  records changes to the core provisions for source content, binding content,
  and caller-facing values as breaking for tools that interpret kinds.

- **Named operation dependencies in the Core document model.** The optional
  `dependencies` map declares named consumption points that reference operation
  keys and may carry a nonempty, unique, unordered `kinds` any-of list of
  exact kinds and a human-readable `description`. Operations are now explicitly neutral
  contracts: bindings attest concrete realizations, dependencies declare
  consumption, and either relationship may appear independently or together.
  Dependency satisfaction, provider matching and selection, registration,
  lifecycle/readiness, and unsatisfied-dependency behavior remain implementation
  concerns. OBI-D-14 provides same-document dependency-to-operation integrity;
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

- A small, explicit set of core invariants: value contracts,
  enabling-not-invoking, split authority, context-free references,
  offline-decidable core conformance, and decentralized extension.
- Exact `bindingSpec` identifiers and the `OBI-B-01` through `OBI-B-03`
  completeness and revision rules for binding specifications.
- Unreleased first-revision candidates for AsyncAPI, GraphQL, gRPC,
  Connect, MCP, usage/CLI, and operation graphs, alongside the OpenAPI
  family above, plus publication tooling for
  creating immutable, content-addressed defining bundles with portable
  conformance evidence and append-only errata when a candidate is actually
  released. No binding specification has yet been published.
- Document and tool rule identifiers, honest partial-validation
  conclusions, and portable action/outcome conformance scenarios.
- Operation-name resolution over one flat key-and-alias namespace.
- Explicit version acceptance and refusal rules, including prereleases and
  pre-1.0 minor-version boundaries.
- Context-free OBI reference resolution, JSON Schema 2020-12 graph rules,
  and boolean schemas.
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

- **`openbindings.core-tool-scenarios@2`**, replacing `@1` for the core tool
  rules' scenarios. Each scenario names the clauses of `conformance/clauses.json`
  it tests. The actions are `validate-document`, `resolve-operation`,
  `conclude-conformance`, `check-dependency-kind`, `validate-operation-values`,
  `check-examples`, and `derive-form`. Value results use the specification's
  three outcomes (`valid`, `instance-mismatch`, `no-verdict`), with
  `orNoVerdict` where a result does not depend on what may be missing,
  `dependsOn` naming the capability-profile features a verdict needs, and
  `forbidReasons` for no-verdict reasons a tool must not report. Version
  gates are judged against a tool's declaration, never its version decision.
  `namesAppliedText` checks that a conclusion names the applied text, verified
  against the bytes at the named revision. Each case is reported in one run
  category (pass, FAIL, SHORTFALL, OMITTED, ADVISORY, UNVERIFIED), and a
  collision group is advisory. `@1` is retired rather than extended because a
  runner reading `@1` would run none of the new actions and report green.

- **`notViolated` in validity fixtures**: the document rules a negative
  fixture's document does not violate, the mirror of `violates`. A tool that
  reports violated rules must not report these, so a rule that holds, holds
  vacuously, or does not govern the document is checked too.

- **`conformance/clauses.json`**, the clause inventory of the tool rules
  OBI-T-01 to OBI-T-11: each rule's text partitioned into clauses with
  corpus-owned IDs, each clause's class and coverage status, and the corpus's
  case-identity records (retired case IDs and migrated cases).
  `scripts/verify-corpus.mjs` checks the partition against `openbindings.md`,
  the README's clause table against the inventory, and every case's clause
  tags; `manifest.json` counts cases per clause.

### Changed

- **OpenAPI 2.0 candidate reduced and migrated to the 0.2 core.** Kind-owned
  source/binding content and finite value mappings replace removed core fields.
  Swagger 2.0 retains its closed draft-04 schema vocabulary, parameter/formData
  model, readOnly sender duty, security definitions and response semantics.
  Equivalent media and wire forms, contextual scalar conversion and faithful
  synthesis replace execution phases and generator layout requirements. Source
  locations identify whole documents. Historical evidence remains separately
  pinned; a fresh bounded native-interaction suite is added to CI. The kind
  remains unpublished.

- **OpenAPI 3.0 candidate reduced and migrated to the 0.2 core.** Kind-owned
  source/binding content and finite value mappings replace removed core fields.
  OAS 3.0.4 governs all five admitted patch values while retaining its closed
  schema vocabulary, request-body rules and binary/byte distinction. A narrow
  explicit header correction uses OAS 3.1.2 Appendix D. Equivalent URI forms,
  XML encoding, focused declaration inspection and truthful synthesis replace
  implementation mandates. Source locations identify whole documents, and JSON
  content parts preserve supplied null values. Historical evidence is separately
  pinned and a fresh bounded native-interaction suite is added to CI. The kind
  remains unpublished.

- **OpenAPI 3.1 candidate reduced and migrated to the 0.2 core.** Kind-owned
  source and binding content replace the pre-kind fields and expression hooks.
  The candidate specifies necessary interpretation and correspondence while
  leaving equivalent wire forms, execution strategies and generation policy
  free. Its [migration record](binding-specs/openapi-3.1/README.md) identifies
  deliberate semantic changes and the historical status of the old corpus.
  This updates an unreleased proposal; it does not publish a kind or SDK.

- **OpenAPI 3.2 candidate migrated to the current 0.2 core model.** Source
  `kind` and kind-owned `content` replace the pre-kind fields; explicit target
  pointers and structural input/output mappings replace removed core selectors
  and transforms. The reduced specification incorporates upstream mechanics,
  preserves meaningful interaction boundaries, and leaves equivalent encodings
  and implementation strategy open. The [migration record](binding-specs/openapi-3.2/README.md)
  describes incompatible candidate changes and bounded current-core evidence.
  The old OAPI32 rule corpus is frozen historical evidence, not validation of the
  migrated kind. The identifier remains unpublished; no SDK support is implied.


- **Withholding a positive report is not incomplete evidence.** §10.4 clarifies
  that any reported conclusion retains its defined meaning. OBI-T-09 still
  does not require reporting established conformance. The `conclude-conformance`
  corpus action now requires the exact conclusion from its supplied evidence;
  `validate-document` still permits an undetermined result when a validator
  lacks evidence.

- **OBI-T-09 forbids an unestablished non-conformance claim.** OBI-T-09's
  first sentence gains the clause "MUST NOT claim non-conformance unless it
  has established a violation of an applicable document rule", and its last
  clause now reads "MUST report non-conformance when it has established
  one"; the rest of the rule and its Note are unchanged. It governs overall
  conclusions only, not rule-level reports, and OBI-T-10 stays separate.
  No document's conformance or rule-level outcome changes. For tools it
  states explicitly what [§10.4](openbindings.md#104-conformance-conclusions)'s
  meaning of non-conformant implies; read as new, a tool that reports
  non-conformance without an established violation, such as for an
  unobtainable reference or a regular expression it cannot compile, now
  violates OBI-T-09.

- **One term for prerelease inclusion.** OBI-T-09 says "a prerelease it
  explicitly includes", the wording of OBI-T-04 and
  [§8.1](openbindings.md#81-openbindings-field-specification-version), in
  place of "an explicitly supported prerelease". Clarification: no
  conformance change.

- **What the other document rules say about a text OBI-D-01 rejects.**
  [§10](openbindings.md#10-conformance), under "The document and its data",
  states that OBI-D-02 through OBI-D-13 govern the JSON value only when
  OBI-D-01 holds. If OBI-D-01 is violated, those rules impose no further
  requirements and are not applicable in the vacuous sense of
  [§10.4](openbindings.md#104-conformance-conclusions); the OBI-D-01
  violation alone establishes non-conformance. A validator that has not
  decided OBI-D-01 may check the value it parsed, provided the data used by
  the check would be exact if OBI-D-01 held; a failed check establishes that
  OBI-D-01 or the checked rule is violated, and so non-conformance, without
  necessarily establishing which. OBI-T-04's version-declaration test is
  unchanged. Changes rule-level outcomes only
  for documents already non-conformant under OBI-D-01; no document's
  conformance changes.

- **An invalid schema is still a schema.** [§7](openbindings.md#7-reference-resolution)
  defines a schema at an OBI position, or a schema the document contains,
  as any JSON object or boolean there, whether or not it is valid against
  the meta-schemas, as JSON Schema Core §4.3 does. Any other value there is
  not a schema: the walks do not enter it and OBI-D-12 rejects it as a
  target. OBI-D-10 judges each operation `input` and `output` and each
  `schemas` entry whatever its type. [§5.2](openbindings.md#52-schemas)
  calls `{"type": 42}` "an invalid schema" in place of "a non-schema".
  Changes rule-level outcomes only for documents already non-conformant
  under OBI-D-10: a same-document reference to an invalid object schema at
  an OBI position satisfies OBI-D-12, and OBI-D-06 and OBI-D-13 walk into
  invalid object schemas. No document's conformance changes.

- **Only a grammatical anchor declares a plain name.**
  [§7.3](openbindings.md#73-same-document-references) states that an
  `$anchor` or `$dynamicAnchor` declares a plain name only when its value
  is a string matching, as a whole, the grammar of JSON Schema Core §8.2.2.
  Any other value declares no name for OBI-D-12, OBI-D-13, or the
  resolution [§7.2](openbindings.md#72-the-document-as-embedding) bases on
  OBI-D-12; OBI-D-10 reports it. OBI-D-13 cites §7.3. Changes rule-level
  outcomes only for documents already non-conformant under OBI-D-10: a
  plain-name reference to such a value violates OBI-D-12, and two such
  values no longer violate OBI-D-13. No document's conformance changes.

- **A schema resource without `$schema` inherits its dialect.**
  [§5.2](openbindings.md#52-schemas) reads each schema the document
  contains under its resource's dialect, as JSON Schema Core §9.3.2 does.
  The document resource's dialect is 2020-12, and a `$schema` in it
  declares none. A resource an `$id` declares takes the dialect its
  `$schema` names, or without one that of its enclosing resource, which for
  a schema at an OBI position is the document resource. A tool that still
  evaluates under a `$schema` other than 2020-12, which violates OBI-D-06,
  follows OBI-T-08 under that dialect and gives no verdict where it lacks
  it. Schemas reached by external URI keep their rule, and the informative
  note on schemas from other dialects now defers to this paragraph: a copied
  schema is read under the dialect it assigns, 2020-12 in the document
  resource even where a misplaced `$schema` names another. No conformance
  change and no rule-level outcome change: only the
  dialect a tool applies when evaluating against a document already
  non-conformant under OBI-D-06 changes.

- **OBI-D-03 checks every `aliases` entry.** OBI-D-03 requires every entry
  of an operation's `aliases` array to be a string matching the name
  pattern, so a non-string entry violates it as well as OBI-D-02; an
  `aliases` member that is not an array is OBI-D-02's alone. The derived
  schema already expressed this and is unchanged. Changes rule-level
  outcomes only for documents already non-conformant under OBI-D-02; no
  document's conformance changes.

- **A malformed reference string is not a reference.**
  [§7.1](openbindings.md#71-reference-forms) states that a string that is
  not a well-formed URI-reference is not a reference of any form: OBI-D-05
  reports it, OBI-D-12 does not govern it, and a value whose evaluation
  depends on it has an undefined result (OBI-T-08), so no tool gives a
  verdict through it. Changes rule-level outcomes only for documents
  already non-conformant under OBI-D-05: OBI-D-12 no longer judges a
  string such as `#%ZZ` or `#/schemas/Task/properties/my type`. No
  document's conformance changes.

- **OBI-D-01's note cites RFC 7493 for duplicate names only.** RFC 7493
  does not mention a byte-order mark; it does forbid duplicate names
  (§2.3). The note now rests the byte-order-mark rejection on RFC 8259
  §8.1 and on two parsers' agreement over the same bytes, and cites RFC
  7493 §2.3 for rejecting duplicate names. Editorial: a note adds no
  requirement, so nothing normative changes.

- **Correspondence is read from the consumer's side.** [§5.1](openbindings.md#51-operations)
  states that an operation carrying a published name claims correspondence
  as a consumer holding a shared contract that publishes the name reads it:
  the claim is read against the shared contract the consumer holds, never
  against every contract that publishes the name. Carrying the name is still
  the claim, whatever the author intended, and it is still unverified and
  demonstrates no compatibility. [§3](openbindings.md#3-terminology), the
  [§4](openbindings.md#4-overview-informative) example, and the realization
  claim of [§5.3](openbindings.md#53-bindings) say the same.

- **Rule-level evidence uses one vocabulary again.** [§10.2](openbindings.md#102-document-rules)
  and [§10.4](openbindings.md#104-conformance-conclusions) say
  **inconclusive** for a rule neither established to hold nor established
  not to hold, as the rest of the specification, the binding
  specifications, and the conformance corpus's scenario format already did;
  the working draft had briefly said "undecided". Rule-level evidence is
  **satisfied**, **violated**, **inconclusive**, or **not applicable**, and a
  rule with nothing to govern holds vacuously, recorded as satisfied or as
  not applicable. The conclusions and their truth conditions are unchanged.

- **Value contracts named.** [§3](openbindings.md#3-terminology) defines a
  **value contract**: the part of an operation's contract that governs each
  caller-facing value crossing the boundary in one direction, the **input
  contract** stated by `input` or the **output contract** stated by
  `output`; an absent field states none. Unqualified, *contract* means an
  operation's whole contract, and a shared contract is a set of operations.
  §1.2, §2, §3, §4, §5, §5.1, §5.2, §5.3, §5.5, §6, §10.1, §14, and
  Appendix A now say "value contract" or "shared contract" where they meant
  one, and the caller-facing boundary stays the operation's one boundary. OBI-T-05's trigger is restated as deriving another form from a
  schema, such as a type or a comparison model, in place of the undefined
  "contract"; its obligation is unchanged. OBI-T-08 names its two
  schema-side grounds for withholding a verdict together as an **undefined
  result**, keeping each ground as it was, and §7.4 names it; an undefined
  result withholds a verdict from every tool, a missing reference or
  capability only from the tool that lacks it. The migration guide and the
  agent primer follow, and the migration guide stops describing `output` as
  covering only successful values.

- **Worked tables.** §7.5 tabulates same-document references in one example
  document with their OBI-D-12 (or OBI-D-05) outcomes, and §8.1 tabulates
  version-declaration cases with what a processor supporting only 0.2 does,
  both informative. §7.2 evaluates a decoded pointer per RFC 6901 §4 (not
  §6, which describes the encoded form); invariant 5 cites OBI-D-02 for the
  derived schema; relative paths name files in the specification repository.
  Five OBI-D-12 fixtures pin the table's contested cases: a percent-encoded
  property name, an encoded leading slash, a fragment decoded only once, and
  a schema value and an array value of the legacy dependencies.

- **Second calibrated round.** OBI-T-08 gives no verdict on an evaluation
  JSON Schema leaves undefined, on a keyword value invalid under its readings,
  or against an absent schema (moved from its Note into the rule). §7.2
  resolves same-document references in the document resource as OBI-D-12
  looks them up. The §4 key also claims correspondence; an operation's
  `description` states the capability its bindings claim; "takes" is
  glossed; §8.1 separates display from interpretation; OBI-T-04's Note no
  longer speaks for other lines; §2 states the invariants' role; OBI-D-06
  says keyword.

- **Economy pass.** No requirement changes. Restated boundaries keep one home
  with cross-references elsewhere: tool discretion, the objects that carry
  fields, naming the text a conclusion applies, and §7.3 and §7.4's
  restatements of OBI-D-12 and OBI-D-13. Long sentences, including some
  inside rules, are split without moving a keyword; the *Note* convention is
  stated once in §10 and covers a note to its rule's end; §3 defines "shared
  contract"; §5 labels context and §5.2 the dialect; §5.3 lists the binding
  claim's two parts. The text is about 4% shorter.

- **Calibrated review round: version decoding, claim quantifiers, and value
  validation readings.**
  - OBI-T-04 locates the declared version in the text decoded as UTF-8 from
    left to right, each byte outside a well-formed sequence replaced by
    U+FFFD; OBI-D-01 still judges the bytes.
    A processor whose parser cannot tell whether the `openbindings` member is
    repeated decides the line from the value it reads, so the latitude falls
    only on texts no line accepts; the escape that let a validator leave the
    line undecided is gone, as is §10.4's clause for it.
  - A binding claims its target takes any value `input` describes, without
    promising success on each, and returns only values `output` describes,
    mirroring the dependency claim. Correspondence claims the operation a name
    identifies in each shared contract that publishes it.
  - OBI-T-08 reads `format` as an annotation where the dialect leaves its
    assertion optional, and patterns as ECMA-262 with Unicode semantics (JSON
    Schema Core §6.4); an absent schema gives no verdict.
  - Smaller: `$schema` is written only beside `$id`, and the derived schema
    checks its value, not its placement; the meta-schemas are identified; §9
    notes `$id` shadowing across documents; §7.5's library recipe covers
    dynamic scope, references into non-schema documents, and a worked
    boundary example; idempotency's context equivalence is stated; OBI-T-03
    is labeled by its trigger; OBI-T-09 names the working-draft case; §6's
    kind foundations include exact kind identity; RFC 3629 is a normative
    reference.

- **`input` and `output` describe shape; `idempotent` moves to bindings.**
  - `input` describes the values an operation takes and `output` the values
    it returns, like a function signature: shape, not behavior. The "accepts"
    and "failure" definitions are removed; no document can promise which
    values a realization succeeds on or that it is available. What a binding
    or dependency asserts is an author claim.
  - A binding's claim is that its target realizes the operation as the
    document describes it, including the operation's correspondence claims.
  - `idempotent` is now a binding field (moved from operations, schema
    included): each binding's author claim about repeating the operation
    through it. Realizations of one operation can differ. The examples, the
    OBI-T-10 fixtures, the canonical-order script, and the migration guide
    follow.
  - OBI-D-13 counts every `$anchor` and `$dynamicAnchor` declaration of a
    plain name, as JSON Schema Core §8.2.2 does, so one schema declaring a
    name with both keywords is a duplicate (the fixture that allowed it now
    rejects it).

- **Sixth review round: precision fixes.** OBI-D-10 reads the meta-schemas'
  `pattern` values as ECMA-262, the dialect JSON Schema names, so an
  `$anchor` ending in a newline fails on every validator (new fixture).
  OBI-T-04 states the version-declaration test by position (no byte-order
  mark, JSON grammar, one `openbindings` string) and says a validator that
  cannot see a repeated member may still report a violation it establishes.
  OBI-T-03 applies when a processor interprets a document. OBI-T-01 applies
  whenever a kind string is interpreted. A binding's assertion covers
  `idempotent: true`; `false` warns about the operation. `$schema`
  placement is JSON Schema's prohibition. §3 defines "field"; §5 states that
  objects are closed except for `x-` fields. §4's `listTasks` carries the
  error shape. Correspondence's publishing advice is its own informative
  paragraph.

- **Fifth review round: tool-rule voice, resolver obligation, and claim
  definitions.**
  - Every tool rule states its requirements with BCP 14 keywords, and
    explanation moves into sentences marked *Note*, as in OBI-D-01, OBI-D-10,
    and OBI-D-12. OBI-T-06 now requires reference resolution as §5.2 and §7
    define. OBI-T-04 admits an explicitly included prerelease by its full
    version and carries the definition of a declared version. OBI-T-01 names
    the comparisons it governs. OBI-T-10 cites §5's list of author claims.
    OBI-D-02 carries its ECMA-262 and erratum clauses. OBI-D-13 resolves
    `$id`s per RFC 3986 §5.2, which removes dot segments (a new fixture pins
    the case).
  - A correspondence claim asserts that the operation is the one the adopted
    name identifies in the shared contract. A failure is an outcome its kind
    reports as ending without an output value. `idempotent: false` is an
    operation-level warning every binding honors.
  - Context has one definition (§5). §6's list of what a kind stands on
    includes the binding's full claim. Invariant 5 names the derived schema
    and meta-schemas as its local resources. §10.4 places version refusal and
    an undecided line.
  - Notes on `$schema` placement, cross-document references, dynamic-anchor
    capture, unencoded plain names, and JCS number rendering; §4's example
    says how its error shape surfaces.

- **Each requirement is stated once; tools honor defined meanings.**
  - OBI-T-02 now requires a tool that interprets OBI-defined fields to give
    each defined field its defined meaning, presence included, as well as
    giving unknown fields none. Without it, a tool could render an omitted
    `idempotent` as `false` and still conform. OBI-D-03 states that its
    pattern is ECMA-262, matched against the whole name.
  - The numbered rules of §10 are the single statement of each requirement.
    The body explains the model and points to them without BCP 14 MUSTs;
    §10 opens by saying conformance is judged by those rules alone.
    Binding, source, and dependency member tables each become one table with
    a Required column. "Author claims" gets one home in §5 and §3.
  - Economy pass: repeated statements reduced to one home plus a
    cross-reference, sentences shortened, negations turned positive where a
    misreading is unlikely. The text is about 8 percent shorter; rules,
    invariants, tables, and examples are unchanged apart from the two rule
    edits above.

- **Fourth review round: determinism and claim precision.** No design
  change.
  - A text declares a version only when it is UTF-8 JSON without a
    byte-order mark whose root has exactly one `openbindings` member that is
    a SemVer string, so the line decision no longer depends on a parser's
    leniency. Interpreting a document is defined, and OBI-T-04 requires a
    version refusal only when interpretation of an unsupported line is asked
    for.
  - The schemas the document contains are reached through the same keyword
    list inside `$id` resources, and nothing else counts. OBI-D-13 compares
    only an `$id` that is absolute or resolves against an enclosing compared
    `$id`. OBI-D-12 states the UTF-8 clause §7.3 already had.
  - A binding asserts that its target carries out the operation it
    references, as the description conveys it; identifiers, keys and aliases
    alike, are not part of the assertion.
  - Acceptance applies wherever an interaction carries an input value,
    counts any returned value when `output` is absent, and turns on reasons
    the value alone determines. "Context" is defined in §3, and idempotency
    uses it.
  - `$schema` belongs only on a schema that declares `$id`; an external
    schema without `$schema` is implementation-defined under JSON Schema.
    Tool-rule items are MUST-level; the capability table lists tool rules;
    no document rule evaluates a value (§10.2). Working-draft conclusions
    name the draft and revision. §4's `createTask` describes an error shape
    beside its result.

- **The empty-object contract says "takes nothing"; dependencies make a
  caller's claim.**
  - §5.1 now names `{"type": "object", "maxProperties": 0}` as the portable
    contract for an operation that takes no meaningful input, since it holds
    whether a kind carries an empty value or none, and says the same for an
    operation that returns nothing. Omission means unspecified, and `false`
    means no value. This supersedes the earlier guidance that omission was
    the portable choice.
  - Declaring a dependency asserts that the described component, as a
    caller, sends only values valid under `input` and handles any value
    valid under `output`. OBI-T-10 lists it among the author claims that are
    not document-rule violations.
  - §4's `listTasks` uses the empty-object `input`; the dependency example
    adopts a published alias.

- **Third review round: precision and authoring notes.** No design change.
  - "Document resource" is a defined term; OBI-D-05 and OBI-D-12 scope their
    reference checks to it, so a schema that declares `$id` keeps its own
    relative references as before, now stated in the rule text.
  - OBI-D-12 reads as three cases (empty reference or fragment; JSON
    Pointer, which must be valid; plain name). A pointer with an invalid
    escape, a pointer into a binding's `content`, and a fragment that does
    not decode to UTF-8 are pinned as violations.
  - Conformance is judged by the numbered rules alone. The prose defines the
    model; the derived schema decides structural conformance through
    OBI-D-02, published with the patch release a conclusion names.
  - Judging a document against a line's rules is interpretation, so version
    refusal comes first; a prerelease is identified by its full version and
    read under its own text and schema; an unparseable text is reported like
    one that declares no version.
  - Clarified: input acceptance is interaction-neutral (any value `output`
    describes, or none, accepts); a binding claims the capability its name and
    description convey; `$schema` belongs at a resource root, per JSON
    Schema; a `$dynamicRef` can reach the document resource through dynamic
    scope; `$id`s are compared as written; non-consuming reference cycles are
    undefined under JSON Schema; tools' matching freedom stops at OBI-T-01 and
    OBI-T-07; "shared contract" is defined; the credential note moves to §5.
  - Added: an example-object field table, notes on schemas from other
    dialects and on one contract across several bindings, a library
    recipe in §7.5, the full RFC 6838 template in §11, and an OpenAPI
    reference.
  - §10.1's table drops its restating column and lists every tool rule,
    marking the rows every processor performs.
  - A conformance conclusion names the release whose text it applied, a
    patch release or an explicitly supported prerelease (invariant 5,
    OBI-D-02, OBI-T-09, §10.4); OBI-T-04 names OBI-D-01 beside OBI-D-09 for a
    document that declares no readable version.
  - Name equality is defined (two names are the same only when their
    strings are exactly equal), so every rule that compares names compares
    them exactly; §5.5 cites OBI-D-02 for the `kinds` array constraints.

- **Voice and economy pass.** No requirement changes. Each boundary and
  clarification is stated once, at its home, with cross-references
  elsewhere; §3 entries are short definitions that point to their sections;
  "OBI position" is defined at the start of §7 with the explicit list of JSON
  Schema 2020-12 keywords whose values are schemas; dependencies, sources,
  names, `version`, and `false` are defined positively; §4 drops one of its
  three `createTask` examples; §10.1 merges its prose and implementer map
  into one capability table; §12 is condensed and no longer implies that
  every map's keys enter the operation identifier namespace.

- **Plain names join OBI-D-12, and a conformance conclusion names its patch
  text.** From a second review of the specification against its own design:
  - OBI-D-12 now covers every same-document reference at an OBI position:
    a plain-name fragment such as `#task` must be declared with `$anchor` or
    `$dynamicAnchor` by a schema in the document's own resource, the same
    lookup OBI-D-13 already makes. `{"$ref": "#Missing"}` is now a violation,
    as `#/schemas/Missing` already was. Fragments are percent-decoded before
    either test. §7.3 is retitled "Same-document references".
  - OBI-D-13 counts a plain name once per declaring schema, so one schema
    that declares a name with both `$anchor` and `$dynamicAnchor` declares it
    once, and leaves out of its `$id` comparison an `$id` that cannot be
    resolved because it, or one it resolves against, is not a well-formed
    URI-reference.
  - OBI-T-09 applies to any conclusion about overall conformance and
    requires it to name the patch release whose text it applied; invariant 5
    and §8.1 say so. The patch number a document declares still carries no
    meaning.
  - OBI-T-08's resolution context covers every resource an `$id` declares in
    the schemas the document contains, not only those at OBI positions.
  - Clarified: omitting `input` is the portable way to write an operation
    that takes no input, and `input: false` and `output: false` weigh
    differently; a binding claims to carry out the operation it names (the
    undefined "logical capability" is gone); correspondence is defined once,
    with one list of what the claim does not establish; §10 names the rules
    the derived schema also expresses; a schema given its own `$id` cannot
    refer to the document's schemas that lack one; §1.3 no longer says
    obtaining a document cannot change its meaning, only that the core reads
    it the same way; §11's plain-name fragments are those of the document's
    own resource.

- **Editorial consolidation, clarifications, and duplicate names.** From a
  review that judged the specification against its own design:
  - §1 states the division of responsibility once (core, kind, tools) and
    merges the former §1.3 into §1.2; §4 is marked informative and no longer
    repeats the Abstract's example; §7 is split into reference forms, the
    document as embedding, same-document pointers, other references, and
    informative notes with a table of what each rule walks and a worked `$id`
    example; §6 lists what a kind decides and the core provisions a kind
    stands on, which scope §8.1's breaking-change promise.
  - Clarified: what `input` "accepts" (answering with an error value in
    `output` still accepts); which facts a binding vouches for (`input`,
    `output`, `idempotent`); that the kind decides which interaction data
    forms one caller-facing value; that credentials are not caller-facing
    values unless the operation is about them; how to write "no input"; that
    presence is distinct from value for every optional member; and how
    document rules read names and numbers.
  - Corrected overclaims: conformance does not establish the facts a
    document represents, and the tool rules fix what claims assert, not
    their truth.
  - New OBI-D-13: no plain name is declared twice in the document's own
    resource, and no `$id` twice in the document (exact comparison after
    resolution). The shared resource makes the first possible; both are
    lookups.
  - OBI-D-02's schema `$id` is line-scoped
    (`https://openbindings.com/schema/openbindings-0.2.json`) and republished
    by patch releases. OBI-D-04 counts occurrences, so an alias equal to its
    own key is plainly a violation. OBI-T-10 covers every author claim.
    OBI-T-06 names `$dynamicRef`. JSON Schema section citations name JSON
    Schema Core or Validation, now separate references.

- **OBI-D-12 checks same-document pointers.** A `$ref` or `$dynamicRef` at an
  OBI position that is empty or carries a JSON Pointer fragment must point at
  a schema at an OBI position. It is a lookup in the document: it catches a
  typo such as `#/schemas/Taks`, `#` (which names the OBI document, not the
  enclosing schema), pointers into data that is not a schema, and pointers
  inside a schema that declares `$id`. Plain names, references within an
  `$id` resource, and absolute URIs stay JSON Schema's.

- **An operation's signature is its name and per-value schemas, and `output`
  is whatever the operation returns.** §3 no longer calls the operation an
  incomplete signature: interaction pattern and cardinality belong to each
  binding, which is what keeps the operation binding-independent. `output`
  describes every value the operation returns, error shapes included where
  the author wants them; the core no longer distinguishes successful from
  unsuccessful values, and §1.2 no longer lists a failure vocabulary as a
  deliberate omission. Which results of an interaction a binding returns as
  output values stays with the source's kind.

- **Document conformance no longer evaluates or resolves schemas.** The core
  now says only what an operation signature needs from JSON Schema: schemas
  are JSON Schema 2020-12 and valid against its meta-schemas; `$schema`, where
  present, names 2020-12; and, for context-free references (invariant 4),
  schema references at OBI positions are absolute or same-document and `$id`s
  there are absolute. JSON Schema governs everything else, including how
  references resolve and how values are evaluated. Examples become author
  claims, like `idempotent`: a tool that checks one reports a mismatch as a
  false claim, not a document-rule violation (OBI-T-11). Removed with this:
  example validity and its static reachability, integrity of references
  between schemas, `$schema`/`$vocabulary` placement, the regex, Unicode, and
  in-place recursion requirements, the document-scope resolution model, and
  identifier comparison. This supersedes the entries below that describe
  those rules. Document rules are renumbered, following the rule that an
  identifier means what its line says it means:

  | Before | Now | Rule |
  | --- | --- | --- |
  | OBI-D-05 | OBI-D-05 | reference forms at OBI positions (narrowed: no identifier or name uniqueness, no resource-internal URI check) |
  | OBI-D-06 | OBI-D-06 | `$schema` names 2020-12 (widened: an empty fragment is accepted) |
  | OBI-D-07 | (removed) | `$schema` and `$vocabulary` placement |
  | OBI-D-08 | OBI-D-07 | binding `operation` keys |
  | OBI-D-09 | OBI-D-08 | binding `source` keys |
  | OBI-D-10 | (removed) | example values validate |
  | OBI-D-11 | OBI-D-09 | `openbindings` is a SemVer version |
  | OBI-D-12 | OBI-D-12 | narrowed: an empty or JSON Pointer same-document `$ref` at an OBI position points at a schema at an OBI position |
  | OBI-D-13 | OBI-D-10 | meta-schema validity, with `format` as an annotation (narrowed: no regex or recursion checks) |
  | OBI-D-14 | OBI-D-11 | dependency `operation` keys |

  OBI-D-01 through OBI-D-04 and every tool rule keep their numbers and
  meaning. Entries below use the numbers of their time. What JSON Schema
  leaves to the embedding format stays in §7: `$id`-less schemas at OBI
  positions share the document's resource, `#` there names the OBI document,
  and OBI positions follow what the 2020-12 meta-schema validates as schemas,
  including `definitions`. §5.2 says the document rules test only meta-schema
  validity, reference forms, and dialect, and §7 says plainly which
  references JSON Schema leaves undefined. The OBI-T-08 scenario that fixed a
  `valid` result for a value beside an unused external definition is removed,
  as the dormant-branch scenario was: the rule prescribes no evaluation
  strategy, so an eager compiler may report that it cannot validate.

- **The JSON Schema seam binds JSON Schema's own preferences where tools would
  otherwise disagree or fail to decide.** A same-document JSON Pointer may no
  longer land on or pass through a schema that declares `$id`; such a schema
  is referenced through its `$id`, as JSON Schema §9.2.1 advises and OpenAPI
  3.2 requires. `$schema` appears only on a schema that declares `$id`, the
  root of a schema resource (§8.1.1). Patterns are ECMA-262 read with the `u`
  flag (§6.4), for well-formedness and for example validity. OBI-D-13 now
  counts an invalid pattern and in-place recursion (§9.4.1) as ill-formed,
  and no longer restates OBI-D-06 and OBI-D-07. Schema identifiers compare
  resolved, without fragment, after RFC 3986 syntax-based normalization, and
  an embedded `$id` may not claim a JSON Schema 2020-12 meta-schema's
  identifier. §7's document resource is now the document scope, grounded in
  JSON Schema §9.1.1, with its dynamic-scope consequence stated; §3 stops OBI
  positions at a schema that declares `$id` and defines the schemas a
  document contains; OBI-D-06 and OBI-D-05's URI-reference clause say where
  they apply; an empty `$ref` is a same-document reference; and a fragment
  outside the JSON Pointer syntax is a plain name for OBI-D-12 to resolve,
  not a form violation. §5.2 no longer reads as forbidding the opt-in format
  assertion JSON Schema Validation §7.2.1 allows; example validity keeps the
  annotation default. A second review round then scoped the document scope's
  dynamic-scope role to evaluations that begin in it (JSON Schema §7.1); pinned
  ECMA-262 to the 11th edition JSON Schema cites and scoped the `u` reading to
  the document rules; listed the reserved meta-schema identifiers; limited
  in-place recursion to `$dynamicAnchor` targets and to `then`/`else` beside
  `if`; required normalized URI names in `$vocabulary`; compared plain names
  after percent-decoding; accepted `$schema` with an empty fragment; and
  described the compound document a tool gives its library. This supersedes
  the pointer allowance and root schema objects described in the next entry.

- **Schemas follow JSON Schema 2020-12 wherever an OBI goal does not need
  otherwise.** The core now decides only what JSON Schema leaves to an
  embedding format and what context-free references and offline-decidable
  conformance require. [§7](openbindings.md#7-reference-resolution) names the
  document resource, which holds the schemas at OBI positions; same-document
  plain-name fragments and the `$dynamicRef`/`$dynamicAnchor` pair are allowed
  at OBI positions, with `$dynamicRef` held to the same absolute-or-same-document
  forms as `$ref`. OBI-D-05 forbids declaring one fragment name twice in a
  schema resource, which JSON Schema leaves undefined. OBI-D-07 no longer bans
  `$vocabulary`, which has no effect outside a meta-schema; it now keeps
  `$schema` and `$vocabulary` where JSON Schema permits them (§8.1.1, §8.1.2),
  with [§5.2](openbindings.md#52-schemas) naming the root schema objects of an
  OBI document, and the derived schema no longer rejects a top-level
  `$vocabulary`. OBI-D-12 covers every reference whose target lies within the
  document, including references inside embedded `$id` resources, which
  standard libraries refuse to compile when they dangle. OBI-D-10's
  reachability follows a `$dynamicRef` to every same-named `$dynamicAnchor` it
  could select. A JSON Pointer may pass into an embedded `$id` resource,
  which JSON Schema advises against (§9.2.1) but defines. This supersedes the
  plain-name and dynamic-pair restrictions described in the next entry and the
  pointer restriction described in an earlier one. Fixtures for OBI-D-05,
  OBI-D-07, OBI-D-10, and OBI-D-12 follow.

- **OBI-D-10 decides its scope statically, and the reference rules say what
  they mean.** An example is checked when every schema reachable from its
  governing schema is embedded in the document; reachability follows keywords
  that apply subschemas, `$ref` and `$dynamicRef` included, whether or not the
  example would take a branch, and containment alone (an unreferenced `$defs`
  entry) does not count. This replaces the draft's test of whether an external
  schema could change the outcome, which needed evaluation with unknowns that
  standard JSON Schema libraries do not provide. OBI-D-05's plain-name
  restriction applies to same-document references, so an absolute URI may
  carry a named fragment, and its `$ref` clause applies at OBI positions. §3
  and §7 place the keywords of a schema object that declares `$id` inside the
  resource it declares, as JSON Schema does. OBI-D-12 names the references it
  covers and says a same-document fragment that resolves to nothing violates
  it. Invariant 5 says conformance changes only when a patch corrects the
  text, §5.2's keyword statement names its exceptions, OBI-D-02 reads the
  schema's patterns as ECMA-262, §10.4's Conformant means every rule was
  decided, and ECMA-262 joins the normative references. The OBI-D-10 fixtures
  follow the static rule, OBI-D-05 gains positives for both clarified
  readings, and the schema's example description matches OBI-D-10.

- **Editorial pass.** Em dashes are gone, repeated statements of the core's
  boundary are shortened where §1.3 already carries them, §1.3 states once
  that "read under the source's kind" marks that boundary wherever it appears,
  and the §12 extension bullets are merged. No field, rule, rule scope,
  normative keyword, schema, or corpus outcome changes; two independent audits
  and a blind question set confirmed the meaning is unchanged.

- **A document is read under its `major.minor` line; the patch number carries
  no meaning.** [§8.1](openbindings.md#81-openbindings-field-specification-version)
  now treats each line as one document model: a patch release corrects errors
  in the text without adding fields or changing what documents mean, so
  documents declaring `0.2.0` and `0.2.1` are read alike, under the line's
  current text, and a patch's corrections apply to the whole line. Processors
  support lines, not individual patches, and OBI-T-04 keys acceptance on the
  line; a prerelease remains outside its line. This matches OpenAPI, AsyncAPI,
  and Arazzo, whose tooling does not consider the patch version, and the
  reference Go SDK, which already supports the 0.2 line. Rule identifiers are
  cited under a line, since a patch adds or renumbers no rule. In the corpus,
  the OBI-T-04 higher-patch case now asserts acceptance for any tool that
  supports the 0.2 line, and a new case checks a patch published after the
  tool.

- **§6 states what a kind is instead of what the core leaves open.** The
  section defines comparison, what supporting a kind means, and how a kind's
  meaning is shared, and relies on §1.3 for the boundary rather than
  restating it. No rule changes.

- **Focused core tool-policy pruning.** Core rules now state document meaning and
  the truth conditions of claims under the specification without prescribing
  processing continuation, diagnostic lists, or report vocabulary. OBI-T-01,
  T-02, T-05, T-06, T-07, T-09, and T-10 have narrower obligations. OBI-T-08
  applies the governing JSON Schema dialect to each value without requiring
  a statically complete schema graph; OBI-D-10 checks examples whose match or
  mismatch is determined by embedded resources. External schemas retain their own
  dialect semantics, including `format`. Same-document JSON Pointer URI
  fragments accept standard percent encoding. The core conformance corpus
  follows these rules.

- **Kind constraints compare strings independently of tool support.** A
  binding meets a dependency's `kinds` constraint exactly when its source's
  `kind` equals a listed value; a processor's ability to act on that kind does
  not change the comparison. OBI-T-01 separates unsupported-kind action from
  this document-level test. Project publication completeness and identifier
  stability now live in `binding-specs/PROJECT-POLICY.md`, outside Core. The
  unrevised family candidate corpora and their green verifiers are explicitly
  labeled pre-kind evidence, not current Core integration evidence.

- **Sources carry `kind`; dependencies constrain `kinds`.** The required
  source field `bindingSpec` becomes `kind`, and the optional dependency field
  `bindingSpecs` becomes `kinds`. Both use exact, opaque, non-empty strings.
  Their values are not dereferenced or interpreted as versions. §6 and
  OBI-T-01 now state the processing semantics. A kind need not have a written
  definition or an implementation for its document to conform. The core gives
  no meaning to source or binding `content`, target identification,
  interaction, value adaptation, or success classification. The project may
  publish binding specifications as separate guidance; the core no longer
  defines that category or a conformance class for it. Former OBI-B-01,
  OBI-B-02, and OBI-B-03 are removed, and the former §10.5 conformance
  conclusions move to §10.4. The schema, core corpus, examples, and migration
  guide use the new fields. OBI-D-02 gains negatives for the removed members.

- **Rule identifiers belong to their version, and 0.2 numbers its rules
  without gaps.** A rule identifier means what the version of this
  specification that states it says it means: a rule is cited under a
  version, as a document is interpreted under the version it declares
  ([§10](openbindings.md#10-conformance)), and another version may number
  its rules differently. The table of retired identifiers (§10.6) and the
  note listing them in §10.2 are removed, and OBI-T-09 (conformance
  conclusions) identifies rules by their identifiers in the version the
  document is interpreted under. No earlier release defined rule
  identifiers, so 0.2 numbers its rules from one without gaps. Rule
  identifiers in the entries below this one use the draft's numbering, which
  maps to 0.2 as follows; a draft identifier not listed was retired and has
  no 0.2 number.

  | Draft | 0.2 | Rule |
  | --- | --- | --- |
  | OBI-D-11 | OBI-D-10 | example values validate |
  | OBI-D-12 | OBI-D-11 | `openbindings` is a SemVer version |
  | OBI-D-16 | OBI-D-12 | schema `$ref` targets |
  | OBI-D-17 | OBI-D-13 | schema well-formedness |
  | OBI-D-19 | OBI-D-14 | dependency operation keys |
  | OBI-T-11 | OBI-T-06 | `$ref` cycles |
  | OBI-T-12 | OBI-T-07 | operation-name resolution |
  | OBI-T-16 | OBI-T-08 | operation-value validation |
  | OBI-T-17 | OBI-T-09 | conformance conclusions |
  | OBI-T-18 | OBI-T-10 | `idempotent` claims |
  | OBI-T-19 | OBI-T-11 | example mismatches |

  At that stage, OBI-D-01 through OBI-D-09, OBI-T-01 through OBI-T-05,
  and OBI-B-01 through OBI-B-03 kept their numbers; the kind change above
  subsequently removed the OBI-B rules. The corpus files and scenario
  identifiers follow (T16-S-01 is now T08-S-01). The binding-spec
  candidates cite core rules by the new numbers, and their citations of
  rules the draft retired point at this changelog.

- **Transforms leave the core; a binding carries `content` its binding
  specification defines; OBI-D-10 and OBI-T-10 are retired.** The core no
  longer defines transforms or a transform language. §5.5 (Transforms), the
  top-level `transforms` map, and the binding members `inputTransform`,
  `outputTransform`, and `selector` are removed. A binding instead carries an
  optional `content`, any JSON value, as its source does, and the source's
  binding specification wholly defines it: typically which target realizes the
  operation and how values are adapted between the operation's contract and
  that target ([§5.3](openbindings.md#53-bindings)). A transform always sat on
  one binding under one binding specification, which already defined the
  source-side values it bridged, so the core could not decide what one meant;
  it is now handed over with the rest of the binding. §6's three provisions
  are source content, binding content, and values. OBI-B-02 item 2 covers a
  binding's `content`, including any reference within it, and item 4 covers
  any adaptation between caller-facing values and the source interaction,
  with no variable bindings. The only OBI-defined references are schema
  `$ref`s ([§7](openbindings.md#7-reference-resolution)), so OBI-D-05 loses
  its named-transform clause; OBI-D-10 (named-transform resolution) and
  OBI-T-10 (transform evaluation) are retired, and OBI-D-18, retired earlier
  in this draft, stays retired because the core defines no expression
  language. §9 treats expressions a binding's `content` may carry as that
  binding specification's concern. JSON remains the document format for the
  reasons §4 gives, which no longer include a transform language, and
  Dependencies become §5.5. These changes reach two of the provisions
  [§6](https://github.com/openbindings/spec/blob/4219c89/openbindings.md#6-binding-specifications) hands a binding
  specification, which
  [§8.1](openbindings.md#81-openbindings-field-specification-version) holds
  to be breaking for every binding specification; none is published yet, and
  the project's candidates are to be revised to define binding `content`. The
  document schema drops `transforms`, `selector`, `inputTransform`,
  `outputTransform`, and the transform definitions, and accepts any JSON value
  as a binding's `content`. In the corpus, the OBI-D-10 fixtures and the
  OBI-D-03 `transforms` case are removed, OBI-D-02 gains negatives for the
  removed members, and the other fixtures and the examples carry binding
  `content`. The transform-language corpus (`conformance/transforms/`) and its
  two verifiers leave the repository with the language they tested; a
  binding-specification-level transform profile can recover them from
  history.

- **A source is its binding specification's identifier plus content that
  specification defines; `location` leaves the core; OBI-D-13 is retired.**
  A source is now `bindingSpec` with optional `content` and `description`.
  `content` is any JSON value, and its binding specification wholly defines
  it: whether it may be absent, which values it accepts, whether it embeds an
  artifact, addresses one, addresses a live service, or names something a
  processor's environment provides, and how anything within it resolves
  ([§5.4](openbindings.md#54-sources)). The core gave `location` a meaning it
  could not check, since an address is an address only under its binding
  specification, so the member, the rule that a source carry `location` or
  `content`, content primacy, and OBI-D-05's `location` clause are removed.
  Nothing within `content` is an OBI-defined reference, and
  invariant 4, now titled "Context-free references", is stated for the
  references the core defines. OBI-B-02's first four items, which assumed a
  `location`/`content` pair, become one item on `content`. The core no
  longer claims that a binding's target is identifiable from the binding and
  its source alone: how a target is identified, including any part a
  processor's environment plays, is the binding specification's to define
  ([OBI-B-02](https://github.com/openbindings/spec/blob/4219c89/openbindings.md#104-binding-specification-rules) item 3), and
  invariant 2 states what a binding is for without a sufficiency claim.
  OBI-D-13 is retired. Every document rule is now decidable from the
  document, given a duplicate-detecting parse (OBI-D-01); no rule takes
  binding-specification
  knowledge, and OBI-T-01 no longer describes binding-specification-dependent
  rules. These changes reach provisions
  [§6](https://github.com/openbindings/spec/blob/4219c89/openbindings.md#6-binding-specifications) hands a binding
  specification, which
  [§8.1](openbindings.md#81-openbindings-field-specification-version) holds
  to be breaking for every binding specification; none is published yet, and
  the project's candidates are to be revised to define their `content`. The
  document schema drops `location` and the `location`-or-`content`
  requirement. In the corpus, the
  OBI-D-13 fixtures and OBI-D-05's `location` cases are removed; OBI-D-02
  gains positives for a source holding only `bindingSpec` and for `content`
  of every JSON type, `null` included; OBI-D-05 gains
  positives showing that nothing within `content` is judged as
  a reference; sources in other fixtures no longer carry `location`; and the
  OBI-T-17 scenarios use OBI-D-19 as their inapplicable rule.

- **The core's examples use illustrative binding-specification identifiers.**
  The Abstract, §4, §5.5, and §6 examples name `example.openapi@1`,
  `example.mcp@1`, and `example.grpc@1`, which name no published
  specification, and the Abstract says so. §5.3 explains binding content by
  protocol (a JSON Pointer into an OpenAPI document, a gRPC method name, an
  MCP tool name) rather than by project identifier, §6 no longer lists the
  project's identifiers, and §14 points to the project's binding-spec work
  without a publication status. The core corpus and the schema's description
  use the same illustrative identifiers. No rule changes.

- **Unprefixed names are reserved for the specification.** An object the
  specification defines (the root; operation, example, dependency, source,
  and binding objects) carries no field
  the specification does not define unless its name begins with `x-`: such a
  field violates OBI-D-02, as the derived schema now closes those objects
  (§12). A tool processing the document still ignores it (OBI-T-02), as
  JSON:API pairs "must not contain" with "must ignore", and OpenAPI, AsyncAPI,
  and Arazzo close the same objects in their schemas. The core cannot tell a
  misspelling from intent; the reservation keeps unprefixed names free for
  future fields, and new fields arrive only in minor versions (§8.1). A 0.1
  member left in place, such as `location` on a source, is now
  non-conformant. The corpus gains OBI-D-02 cases, and the OBI-T-16 scenario
  that put a schema-shaped member on the document root is retired, since
  that document can no longer be conformant.

- **A schema `$ref` reaches only a schema, as JSON Schema defines one.** A
  schema `$ref` at an OBI position resolves to a schema the document model
  places (OBI-D-16): a same-document fragment to a schema at an OBI position,
  and an absolute reference through an embedded schema's `$id` to that schema
  or a subschema below it. JSON Schema 2020-12 leaves a reference to anything
  else undefined (§9.4.2), so a reference to the OBI document itself (`#`),
  to a string, into `x-` data, into a source's `content`, into an
  annotation, `const`, `enum`, or a legacy `definitions` or `dependencies`
  entry now violates OBI-D-16, and a same-document pointer into a schema
  resource that declares its own `$id` does too, since JSON Schema advises
  against it (§9.2.1) and the resource's `$id` reaches it. A schemas entry
  that declares `$id` is still named `#/schemas/<name>`. Two schema resources
  declaring the same `$id` violate OBI-D-05, as JSON Schema lets a URI
  identify one schema (§9.1.2). This replaces the earlier text in this draft
  that judged any value a reference reached as a schema.
- **Second cold-read corrections.** "Tool" is again any software that acts
  on OBI documents, so no producer class is implied. §10 states OBI-D-02's
  authority once: the published schema decides it, and a disagreement with
  the prose is an erratum corrected in the schema. §3 defines Core,
  caller-facing, realization, target, interaction, validator, and invoker. §7
  defines when a reference matches an embedded `$id` (the same string once
  both are absolute and unfragmented) and says any `%` in a same-document
  fragment is non-conformant. A document with no valid `openbindings` value
  is non-conformant under OBI-D-12, not refused (§8.1, OBI-T-04). §5's names
  pattern is an ECMA-262 regular expression matching the whole name, and the
  schema's version pattern writes `[0-9]` for `\d`. OBI-T-12 forbids
  approximate name matching in place of a tautology, the tool-rule preamble
  says a SHOULD inside a requirement stays a recommendation, and the posture
  paragraph no longer groups OBI-T-04's refusal with rules that never fail a
  document. §5.2 says only an external unresolvable `$ref` passes
  well-formedness, and §5.4's opening sentence no longer reads as a source
  naming its bindings.

- **Cold-read corrections.** "OBI position" is defined in
  [§3](openbindings.md#3-terminology): the schema positions the document model
  names and the subschemas 2020-12 defines below them, stopping inside a
  resource that declares its own `$id`. OBI-D-11 decides examples under the
  validation semantics of §5.2, so `format` is an annotation there too. Every
  item under "A conformant tool" is stated to be a requirement, and the list
  that called some of them "MUST-level" is gone. OBI-T-03 now says what §12
  says: an `x-` field, understood or not, does not change the meaning of core
  fields. §6 says OBI-B-02's four items are what a binding specification owes,
  not further provisions. "Processor" is a tool that takes a document as
  input, and §5.3's heading is "Preference signals". OBI-T-13 and
  OBI-T-14 appear in the retired table. The examples no longer describe an MCP
  tool's output, and the private identifier matches its file. OBI-D-02 applies
  the schema as published, and a conflict with the prose is an erratum
  corrected in the schema. §10.5 defines the applicable rules, §7 says an
  absolute URI may carry a fragment, §5.3 says `1.0` and `1` are the same
  preference, and §9 names regular-expression cost. The corpus gains an
  OBI-D-11 case. The schema's own description now
  matches OBI-D-02.

- **The core makes only rules it can decide.** OBI-T-06 is retired: what a
  binding's `content` means, and how a tool acting on the binding follows it,
  belong to the binding specification, and a support claim already means support for the
  specification as published ([§10.4](https://github.com/openbindings/spec/blob/4219c89/openbindings.md#104-binding-specification-rules)).
  Six passages no longer say that a binding is actionable, that the document
  makes realizations available, or that several bindings reach different
  targets. [§6](https://github.com/openbindings/spec/blob/4219c89/openbindings.md#6-binding-specifications) no longer sets what
  a binding specification may cover; OBI-B-02 item 4's success requirement
  narrows to which values are successful output values, which every
  specification meeting the old item still meets, and the completeness
  test's purpose is stated for the points the core hands over; and the §1.2 failure entry
  no longer describes binding implementations or the project's invocation
  interfaces. §6 and OBI-B-02 state that behavior an implementation chooses
  where a specification is silent is implementation-defined and not the
  identifier's meaning, without rules on how implementations describe their
  support. The seam promise is stated as what it is: a change outside the
  three provisions §6 names does not reach a binding specification that
  stands on them alone
  ([§8.1](openbindings.md#81-openbindings-field-specification-version)).
  Normative keywords that addressed parties no conformance class covers
  (publishers of adoptable operation names and of binding-specification
  identifiers, consumers of `idempotent`, document authors choosing a
  version, and `x-` field definers) are now statements of meaning. Within a
  contract-validation claim, `format` is an annotation in every schema the
  claim evaluates, external subschemas included, and a tool may check
  `format` separately as its own check
  ([§5.2](openbindings.md#52-schemas)); this removes a contradiction with the
  statement that external schemas follow their own dialects. The
  binding-specification authoring guidance already carries the material that
  left the core. The corpus README and fixture schema drop OBI-T-06.

- The conformance vocabulary uses one verb. Checking a document against the
  document rules is validation, done by a validator, and
  [§10.5](openbindings.md#105-conformance-conclusions) is titled "Conformance
  conclusions". Rule-level evidence that is neither satisfied nor violated is
  **inconclusive** (the draft said *unverified*), and the rule note on how to
  check OBI-D-01 is a validation note. "Verify" keeps
  its integrity and signing sense, which the core leaves out of scope. The
  core tool-scenario action `conclude-verification` is now
  `conclude-conformance`, with `inconclusive` in place of `unverified` in its
  evidence and expected sets. No rule's meaning changes.

- Core no longer names or references a particular discovery contract or
  endpoint. The former OBI-T-13 (discovery serving) and OBI-T-14 (discovery
  fetching) identifiers remain reserved; their requirements now belong to the
  independently versioned HTTP Discovery specification. The repository README
  links that document.

- The OpenAPI 3.0 binding no longer routes number and boolean properties on
  content-based `text/plain` form or multipart lanes through the consumer's
  `parameterConversion` choice. All three 3.x siblings now keep that
  configuration point on `schema`-form and RFC 6570-style paths only, while
  content-based media serialization uses each binding's fixed RFC 8259 lexical
  form. This corrects an unjustified family divergence over byte behavior that
  the applicable OAS editions leave identically implementation-defined; the
  accepted domain and configuration vocabulary are unchanged.

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
  states it, and the rule is this specification's under core OBI-B-02 item 2
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
- The binding member `ref` gave way to `content`, any JSON value the binding
  specification defines, typically including which target realizes the
  operation and how values are adapted to it. The binding specification also
  defines what its absence means.
- A source is `bindingSpec` plus optional `content` that the binding
  specification wholly defines. The core has no `location` member; whatever a
  source addresses is carried in `content` as its binding specification
  defines. Relative, retrieval-context-dependent OBI-defined references are
  no longer portable.
- Document authentication declarations moved out of the core. Credentials,
  configuration choices, approvals, and other prerequisites are supplied as
  invocation context and may be surfaced through context requirements.
- Tool conformance is capability-scoped. A validator that lacks a capability
  a rule requires, such as a duplicate-detecting parser, reports that
  rule as inconclusive rather than claiming complete conformance. No document
  rule takes binding-specification knowledge.
- The operation-graph specification was rebuilt around the direct-invocation
  identity law, cardinality-transparent frame flow, explicit completion and
  cancellation, bounded cycles, lineage, deterministic portability claims,
  and stable validation/error identifiers.

- **The reference Go runner (`conformance/runners/go`) was repaired against
  the 0.2 Go core.** It executes every case the manifest counts, through the
  core's API and its `schemaeval` evaluator, reports each in one run category
  with every omission's reason, and reconciles its cases with the manifest. A
  shortfall against the capability profile it declares for the core fails. It
  verifies the applied text a conclusion names against the bytes at that
  revision in the specification repository's history, and observes kind
  retrieval through a local listener. Its `-json` results, reconciliation
  included, are compared with the corpus's complete case set and with the
  expected failures and omissions, keyed by Go commit and applied text, by
  `scripts/check-runner-results.mjs`. The blocking `reference-go-core` CI job
  is enabled: it runs the runner against the Go commit that adopts this text,
  pinned in `ci.yml`, and fails on any result those keys do not expect.

### Removed

- The 0.1 in-core schema-comparison, normalization, operation-matching,
  binding-selection, security-method, and discovery models.
- Literal `null` as a second spelling of an unspecified operation schema.
- Retrieval-URI-relative OBI references.
- The source `location` member and the rule that a source carry `location`,
  `content`, or both.
- Transforms and the core transform language: the `transforms` map and the
  binding `inputTransform` and `outputTransform` members. A binding
  specification defines any value adaptation, in a binding's `content`.
- YAML as an OBI serialization. A binding specification may still incorporate
  YAML or any other upstream artifact representation.
- The experimental, unminted Workers RPC binding candidate. It is absent from
  the active catalog and implementations.
- `conformance/tool/OBI-T-01.json` and `conformance/tool/OBI-T-04.json`.
  The OBI-T-01 fixtures, which showed only that an unfamiliar kind is valid,
  moved to `conformance/document/OBI-D-02.json` (tests 33 to 35); the OBI-T-04
  fixtures became `scenarios/OBI-T-04.json` scenarios, where a version refusal
  is its own outcome. `clauses.json` records each migrated case's earlier
  identity.
- Scenario format `openbindings.core-tool-scenarios@1`, replaced by `@2`.

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
