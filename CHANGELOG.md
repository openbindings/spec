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
  exact kinds. Operations are now explicitly neutral
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

### Changed

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
