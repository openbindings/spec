# Changelog

## 0.2.0 (unreleased, in draft)

Version 0.2.0 has never been released; this section is its living draft
record. Entries under **Draft changes** describe the draft's own evolution;
the sections after them describe 0.2.0 as a whole against 0.1.0.

### Draft changes

- **Wholesale draft rewrite (OBI-AD-001..027).** The draft was rewritten end-to-end from a content analysis and ledgered decision record (`openbindings-analysis.md`, `openbindings-analysis-decisions.md` in this repository), blind-validated across three evaluation rounds, and adversarially reviewed. Headlines: the **per-value contract** and **enables-invocation-but-does-not-define-an-invoker** stances stated up front and enforced throughout (§1, §2 core invariants); sources name a **binding specification** via the renamed `bindingSpec` field (was `format`), with a new `OBI-B-##` rule family defining identifier semantics and a seven-item completeness floor (§6, §10.4); a verification-reporting vocabulary — conformant / non-conformant / conformance undetermined, with rule-level satisfied / violated / unverified evidence (§10.5, OBI-T-17); version processing recast to **explicit supported sets**, with version refusal reported distinctly from non-conformance (§8.1, OBI-T-04); correspondence vocabulary — an operation **corresponds to** a shared contract's operation by name adoption; "satisfies" retired; **boolean schemas** admitted at every schema position and literal `null` removed as a second spelling of an absent operation schema (§5.1–5.2); the name grammar admits leading digits, exact-match only (OBI-D-03); binding `preference` is a bounded signed-integer author signal and the core defines **no selection algorithm**; transforms pin **JSONata 2.1** with jsonata-js 2.1.1 as the normative behavioral tiebreak and a JSON-value result domain (§5.5, OBI-T-10); example validation's conformance force is scoped to **document-internal schema graphs**, making every core document rule offline-decidable and conformance time-stable (OBI-D-11); schema well-formedness (**OBI-D-17**) and transform parse-validity (**OBI-D-18**) are document rules; boundary validation is **claim-triggered** (OBI-T-16), never invocation-triggered. Retired identifiers, reserved as historical references (§10.6): OBI-D-14, OBI-D-15, OBI-T-07, OBI-T-08, OBI-T-09, OBI-T-13, OBI-T-14, OBI-T-15. The canonical-form material moved to an informative appendix stating RFC 8785's actual input requirements (I-JSON subset; incompatible input fails, never coerced).

- **HTTP discovery extracted to a normative companion** (`http-discovery.md`). The core no longer defines the well-known endpoint; §1.4 keeps one informative acquisition pointer. The companion pins the serving and fetching contract as `DISC-S-01..04` / `DISC-C-01..04` — preserving the rule that a version refusal is never collapsed into "no OBI published" — and carries the IANA well-known URI suffix registration; the core retains the `application/vnd.openbindings+json` media-type registration.

- **Binding-specifications catalog** (`binding-specs/`, renamed from `formats/`). One normative genre replaces the companion-spec/conventions-record split: a page mints its identifier only when it meets the OBI-B-02 floor. Seven specifications published, each authored spec-first and adversarially reviewed with upstream verification: `openbindings.usage@1`, `openbindings.openapi@1`, `openbindings.mcp@1`, `openbindings.grpc@1`, `openbindings.connect@1`, `openbindings.asyncapi@1`, and `openbindings.operation-graph@1` (migrated from the `openbindings.operation-graph@0.2.0` token; graph semantics byte-preserved, the graph-unit format keeps its own version field). Behavior corrections landed spec-side against the prior conventions records, notably: **asyncapi's `send`/`receive` mapping inverted** to AsyncAPI 3.0's application-perspective rule (invoking `send` subscribes, `receive` publishes) with **conjunctive** security derivation; grpc/connect **unknown input fields refused** per ProtoJSON's own default (was silent discard); grpc accepts `FileDescriptorSet` content in canonical JSON with bound-method-closure acceptance and a pinned v1→v1alpha reflection fallback; connect gains a defined descriptorless mode, 200-exact unary classification, and a GET-lane exclusion; mcp pins pagination-exhausted listings, a presence-preserving progress-value shape behind a solicitation-off configuration point, and always-array resource results; openapi specifies `style`/`explode` serialization, request media negotiation, and the OAS effective-server list; usage legalizes `exec:` addresses behind a normative default-deny gate. The catalog README carries the identifier discipline (`openbindings.<name>@<rev>`, integer revisions, citations denote revisions), the authoring template, and the completeness doctrine. Reference-tool adoption of the identifiers rides the coordinated cross-repo change.

- **`idempotent` is a three-state claim** (§6.1): `true` asserts idempotency
  (unchanged), an explicit `false` now asserts NON-idempotency — re-invocation
  with the same input may produce additional observable effects, so consumers
  MUST NOT treat invocations as safely repeatable — and absence remains no
  claim in either direction. Previously an explicit `false` was unreadable
  (no-claim vs asserted non-idempotency). Both SDK representations already
  preserve the distinction (Go `*bool`, TS optional boolean), so the change
  is prose-only.

- **OBI-D-05 verification floor made explicit** (verification note): the
  relative-reference clause is decidable without format knowledge — a
  location with no `:` before its first `/`, `?`, or `#` is a relative
  reference in form (RFC 3986 §4.2) and every validator rejects it, so
  `./openapi.json` fails everywhere rather than sitting unverified. A
  consequence, now stated: a bare name like `example.com` is
  relative-reference form and not a conformant location (formats wanting
  DNS-name addresses carry a scheme or another colon-bearing form). Only
  colon-bearing non-URI strings take per-format knowledge. Aligns the §14.2
  capability note with the corpus negatives and both SDK validators, which
  already used this discriminator; corpus gains the bare-name negative.

- **Clarification batch from the blind-reconstruction review** (each item
  names existing latitude, closes an inherited-RFC edge, or aligns prose
  with verified behavior in both SDKs; none changes a design decision):
  - OBI-T-08: the static resolvability judgment SHOULD precede driving the
    binding, so a doomed invocation causes no side effects (both SDKs
    already preflight both directions).
  - OBI-T-09: eager-vs-lazy candidate-set determination named tool-defined.
  - OBI-T-14: the "no OBI published" MAY-collapse does not extend to a 200
    carrying an OBI whose version the client refuses (OBI-T-04) — a version
    refusal is reported as such, preserving the upgrade/downgrade
    diagnostic (the reference SDK already surfaces it distinctly).
  - OBI-D-01: a leading byte-order mark is invalid (RFC 8259 §8.1 forbids
    adding one; I-JSON excludes it; both SDK parsers reject it).
  - §6.5: transform parse-validity named a non-document-rule — malformed
    expressions surface at evaluation, validators may warn.
  - §15/OBI-T-02: the transform-reference object (`$ref` object form of
    `inputTransform`/`outputTransform`) added to the enumerated OBI object
    locations.
  - §7.1: followable redirects enumerated (301/302/303/307/308).
  - §10/OBI-D-05: a nested `$id` inside an embedded `$id`-declaring schema
    resolves against that resource's base per 2020-12 and MAY be relative —
    the same resource-internal scope rule as `$ref`/`$anchor`; only
    OBI-position `$id`s must be absolute. Corpus positive added; both SDK
    walkers align.
  - §10/OBI-D-16: same-document fragments are the RFC 6901 §6 URI-fragment
    representation — percent-decoded before pointer evaluation
    (`#/schemas/T%61sk` ≡ `#/schemas/Task`). Corpus positive added; both
    SDK resolvers align.

- **`$dynamicRef`/`$dynamicAnchor` barred at OBI positions** (§10 clause 2,
  OBI-D-05, OBI-D-16 note): the dynamic pair resolves against the runtime
  dynamic scope — resolution dependent on the evaluation path, precisely the
  context-dependence OBI-D-05 exists to exclude — and `$dynamicAnchor` would
  be a second named-schema mechanism competing with the `schemas` map,
  exactly as the already-barred plain-name `$anchor`. A `$dynamicRef` whose
  resolution engages no dynamic anchor is `$ref` restated, so barring the
  keyword at OBI positions loses nothing. Within a schema declaring its own
  `$id`, both keywords keep full JSON Schema 2020-12 semantics as that
  resource's internal business — the same scope carve-out OBI-D-05/OBI-D-16
  already apply to `$ref` and `$anchor`. Corpus: OBI-D-05 gains dynamic-pair
  negatives, the embedded-resource positive, and a keyword-position guard (a
  property *named* `$dynamicRef` is data, not a keyword). Closes a blind
  spot found by two independent clean-room reviews: the rules previously
  constrained `$ref` by name only, so a dynamic reference at an OBI position
  defeated the context-free guarantee in spirit while passing a literal
  validator.

- **Post-1.0 refusal granularity clarified to major-only** (§11.1,
  OBI-T-04): within a supported major, a differing minor is not a refusal
  trigger in either direction — newer minors only add optional fields
  (older tools ignore the additions) and existing fields never change
  meaning, so a higher minor reads by ignoring its additions and a lower
  minor reads under rules that still hold. Refusal triggers post-1.0 are
  major-only either way; pre-1.0 they stay minor-granular either way.
  Resolves an internal contradiction where a "range, either direction"
  sentence read as minor-granular against the same section's own trigger
  enumeration, and aligns the prose with the behavior both SDKs already
  ship (the refusal gate was major-only post-1.0; only the wording
  diverged). Prose-only; no conformance change.

- **Transform evaluation environment fully closed (both specs)**: no
  extensions for document-supplied expressions — neither host-reaching
  bindings nor pure custom functions; format-defined bindings (OG's
  `$input`) are part of the environment, not extensions. operation-graph
  additionally: embedded schemas are self-contained (`$ref` banned,
  OG-V-18 extended, corpus negative added); evaluation-failure `error`
  values pinned as strings.

- **"External" defined; resolution judged statically** — an absolute
  `$ref` matching an embedded schema's `$id` resolves within the document
  (standard 2020-12 identity resolution, no fetch); "external" means not
  resolvable within the document. T-07/T-08's fully-resolved requirement
  is judged over the whole governing schema before validating. Both align
  the text with verified behavior in both SDKs.

- **OBI-D-05 pointer-form rule gains the $id scope carve-out** (matching
  OBI-D-16): fragments within a schema declaring its own `$id` — plain-name
  anchors included — are that resource's internal business. Fixes a
  same-day over-application: both SDK validators rejected legal
  resource-internal anchors; corpus gains the positive case.

- **operation-graph security: cross-graph nesting named and bounded** —
  per-graph budgets reset at each nesting level, so mutually recursive
  graph bindings had no bound; implementations SHOULD carry a recursion
  budget across nested graph invocations (Go engine: context-carried,
  budget 32, tested; TS engine: named follow-up — the isomorphic SDK has
  no context-value channel).

- **operation-graph rules its own secondary semantics** (companion-spec
  independence principle: OG depends on core only at the absolute core —
  the concepts it plugs into — and makes its own secondary rulings). New
  rule **OG-V-18** states the embedded-schema constraints natively
  (2020-12 object form, pinned `$schema`, no `$vocabulary`; previously
  incorporated by reference from core §6.2 with no enforcement home);
  OG-T-03's evaluation semantics and the security considerations are now
  self-owned with informative core-alignment notes; OG-T-01's range
  extends to OG-V-18. Corpus gains 5 OG-V-18 fixtures (negatives failed
  both pre-fix engines, then went green); both SDK validators enforce
  with parity messages.

- **operation-graph: expression throws are not `TRANSFORM_UNDEFINED`** —
  an evaluation failure (throw) is a per-event failure whose `error`
  value is processor-defined diagnostic prose, MUST NOT be conflated
  with the undefined-result identifier; routing on it is non-portable by
  the table's existing catch-all posture. Both engines already conform.

- **operation-graph: completion counts `onError` references as incoming
  edges** — a node fed only by error routes completes when every node
  declaring it as an `onError` target has completed, completing the triad
  with reachability (OG-V-06) and cycle safety (OG-V-09). Existing corpus
  fixtures (OG-EX-06/07/17/18/19) already pin the behavior; both engines
  conform via quiescence.

- **Format-author guidance demoted to the authoring guide**: §6.3's
  JSON-Pointer-for-new-formats SHOULD and §6.4's token-convention
  recommendation now point at `formats/README.md`, the non-normative
  convention of record — the core spec binds documents and tools, never
  future format specifications. No document or tool obligation changes.

- **§14.2 states the partial-verification posture once, generally**: a
  validator lacking a capability a clause requires (duplicate-detecting
  parse, per-format knowledge, external fetching) leaves the clause
  unverified rather than failing the document. Previously stated ad hoc
  at D-01/§8/D-15; now covers D-11 and D-05's format-defined addresses
  too. No rule changes meaning.

- **§7.1/OBI-T-13: discovery content-negotiation deferred to HTTP** —
  the spec pins one fact (the OBI is the path's default representation;
  an Accept-less request receives it) and otherwise defers negotiation
  to RFC 9110 rather than restating its mechanics. Publishers may
  dual-serve a human HTML page to browsers; clients sending the
  recommended Accept always receive the OBI.

- **§6.2: `format` is an annotation, never an assertion, at OBI
  boundaries** (T-07/T-08, D-11). 2020-12's implementation-configurable
  format assertion is closed off: a T-07 pass must mean the same thing on
  every tool, and format semantics wobble across schema libraries.
  Enforced syntax belongs to `pattern`. Both SDKs already conform;
  behavior now pinned by tests in each.

- **OBI-T-07/T-08 validate against the fully resolved schema**: a
  governing schema the tool cannot fully resolve (an external `$ref` it
  declines or fails to fetch) is an invocation error naming the
  unresolvable reference — never a partial pass. Closes the loophole
  where §10's MAY-decline could hollow out a T-07 pass into a silent
  false positive. Both SDKs already fail closed; behavior now pinned by
  tests in each.

- **New rule OBI-D-16: same-document schema `$ref`s resolve.** A dangling
  internal pointer (`#/schemas/Missing`) now invalidates the document,
  completing one posture for internal references alongside OBI-D-08/09/10
  (binding→operation, binding→source, transform refs): same-document
  references are document integrity, offline-decidable by any validator;
  external `$ref` resolution stays an evaluation-time concern. Refs under
  a nested `$id` are that schema resource's business and out of scope.
  Matches interface-description ecosystem practice (OpenAPI/AsyncAPI
  validators, GraphQL SDL, protobuf, Smithy). Corpus: 6 fixtures.

- **OBI-D-05 tightened: same-document schema `$ref`s are JSON Pointer
  fragments** — plain-name (`$anchor`) fragments are not used at OBI
  positions; the `schemas` map is the document's named-schema mechanism.
  Closes the gap where §10 defined resolution only for pointer fragments
  while D-05's form rule admitted any fragment. Conformance corpus gains
  positive and negative cases.

- **§6.5 pins undefined-vs-null transform results**: a `null` result is a
  value; an undefined result SHOULD be treated as expression failure
  (invocation error), with undefined handling otherwise named a
  non-portable axis documents must not rely on. Matches both SDKs'
  shipped behavior and operation-graph's TRANSFORM_UNDEFINED (which
  remains MUST for graphs).

- **operation-graph OG-T-02 completes its OBI-T-04 mirror**: version refusal
  now runs downward as well (refuse below the supported minimum; pre-1.0 both
  bounds apply to minors) and prereleases refuse absent declared support —
  OG-T-02's text claimed the mirror; the core rule gained these clauses in
  this draft. Register fix in the same document: the normative
  shape-tolerance rule (tools MUST NOT reject non-conventional document
  shapes) moved from the non-normative Conventional-shape section into
  Source documents, and the section's capitalized RECOMMENDED is lowercased
  to match its non-normative stamp.
- **Schema `content` description aligned with OBI-T-15**: dropped the
  superseded blanket "implementations MUST prefer content" sentence in
  favor of the pairing-per-format-conventions rule.

- **OBI-T-08 defines its subject.** The operation's result is the value an invocation yields as its success outcome; which outcomes constitute success is the binding format's concern. Failure outcomes are invocation errors, not results, and are not subject to output validation. Previously "result" was unqualified, permitting a reading in which error envelopes had to validate against the `output` schema.

- **Version refusal runs downward (§11.1, OBI-T-04).** A tool MUST refuse documents declaring a version below the minimum it supports (pre-1.0: any unsupported lower minor). Previously only upward refusal was mandated, so a tool could conformantly process an older document under newer rules — with the `priority`→`preference` inversion, silently sorting the same numbers backwards. Legitimizes the reference SDKs' existing `MinSupportedVersion` behavior as the normative floor.

- **§6.4's normative MUSTs get rule identifiers.** OBI-D-14 (`content` carries textual/JSON forms only; binary artifacts ride `location`), OBI-D-15 (embedded `content` is self-contained), OBI-T-15 (the location/content pairing is interpreted per the binding format's conventions; convention-less formats are content-authoritative). These MUSTs previously lived only in §6.4 prose, invisible to the conformance corpus's drift oracle. The corpus README records their coverage posture (per-format, same limitation class as OBI-D-13/OBI-T-06), and adds the missing deferral entries for OBI-T-13/OBI-T-14.

- **The `location`/`content` pairing is the binding format's concern (§6.4).** What a `location` names is format-defined: for most formats the artifact's own address (an OpenAPI document's URL); for a format whose artifact describes a live service that can serve its own description, the service's format-defined address (a gRPC `host:port`), from which the artifact is discoverable. `content` always carries the artifact. Where a location names the artifact, embedded content remains authoritative and the location is provenance (the previous rule, unchanged for that species); where a location addresses the service, there is no competition — content pins the artifact and location remains the invocation target; a format whose conventions do not address the pairing is content-authoritative. Previously an unconditional content-precedence rule demoted any co-present `location` to provenance, which mis-modeled service-addressed formats: a gRPC source pinning its schema as `content` had no conformant slot for its dial address. Embedded-content self-containment and the no-resolution-base rule are unchanged. Touches §5 (Source terminology), §6.4 prose and field table, and §10 item 1.

- **Transform evaluation environment closed (OBI-T-10).** A tool MUST NOT extend the JSONata evaluation environment with host-reaching bindings (filesystem, network, environment variables, process state) for document-supplied expressions; the same transform over the same input now portably behaves identically on every conforming tool (§6.5, OBI-T-10 + rationale, §13/§13.1 cross-references). This resolves the 2026-05-27 review's top finding (no normative security floor) at its semantics-grounded core: environment closure is normative because host bindings break transform *portability* before they break security. Mandating fetch policy and resource bounds was considered and REJECTED on scope grounds — the spec's obligation is to name the exposure its format creates (§13 does); scheme allow-lists, network-range restrictions, and size caps are processor policy per §2, documented per tool.

- **`priority` renamed to `preference`, direction inverted (breaking).** The per-binding/per-source selection hint `priority` becomes `preference`, and its direction flips: higher values are now more preferred (was: lower). An absent `preference` is the neutral baseline of `0`, so absence and the explicit floor coincide and a binding's effective preference defaults to `0` rather than a notional `+∞`. Negative values are permitted and rank below the baseline. The `deprecated` tier rule is unchanged in mechanism (a non-deprecated binding still outranks a deprecated one regardless of magnitude), but its worked example flips: a non-deprecated `preference: 0` now beats a deprecated `preference: 1000`. Hard rename, no alias: a document still using `priority` carries it as an unknown field, so the hint is ignored and identical numbers sort the opposite way. Touches §6.3 (Bindings), §6.4 (Sources), the informative request-lifecycle prose, OBI-T-09 and its rationale, and the JSON Schema.

This release narrows the spec to what an OBI document IS: shape, discovery, references, versioning, and the conformance floor. Behavioral material from 0.1.0 (comparison rules, matching algorithms, transform execution, security method shapes) moves out of the spec; how tools handle these concerns is now tool-defined. Many breaking changes; per OBI-T-04, a 0.1.x tool MUST refuse a 0.2.0 document.

### Breaking

- **Spec scope narrowed.** Spec body shrunk from ~1700 lines to ~720. Schema comparison rules, normalization, operation matching, transform execution flow, security method type definitions, interface conformance framing, and binding actionability are all removed. These are now tool-defined concerns.
- **`executor` renamed to `invoker`** across the spec ecosystem. Role interface `openbindings.binding-executor` becomes `openbindings.binding-invoker`; `executeBinding` becomes `invokeBinding`; SDK types follow (`BindingExecutor` to `BindingInvoker`, `OperationExecutor` to `OperationInvoker`, etc.); CLI `ob op exec` / `ob binding exec` become `ob op invoke` / `ob binding invoke`. Hard rename, no aliases.
- **`openbindings.context-store` narrowed to three operations.** `listContexts` removed — the operation returned raw `ContextEntry[]` including credential payloads, which production implementations refused to honor (the reference `ob serve` did not expose it). Listing, inspection, rotation, and audit are now implementation-defined surfaces outside the role contract, matching the docker-credential-helper / git-credential / OS-keychain precedent. The `ContextEntry` wrapper schema is also gone: with no list operation, the `{key, context}` shape served no purpose. `getContext` now returns `Context | null` (the opaque payload directly, with explicit nullability for "no entry"), aligning the spec with what the reference SDKs already do.
- **Transform shape changed.** Named transforms changed from `{"type": "jsonata", "expression": "..."}` objects to plain JSONata expression strings — the language pinned at JSONata 2.1 with jsonata-js 2.1.1 as normative behavioral tiebreak, and parse-validity a document rule (OBI-D-18). Inline `inputTransform`/`outputTransform` accept a JSONata string or `{"$ref": "..."}` object. The `type` field on transforms is gone.
- **Map key pattern enforced.** All map keys (operations, bindings, sources, transforms, schemas, examples) and all aliases MUST match `^[A-Za-z0-9_][A-Za-z0-9_.-]*$` — exact, case-sensitive, never normalized. v0.1.0 allowed any JSON string.
- **`format` renamed to `bindingSpec`.** A source names its governing **binding specification** by an exact, opaque identifier (`openbindings.openapi@1`), never dereferenced, with no version algebra; the binding specification defines the source's representations, addresses, `ref` syntax, composition, and boundary correspondence (§6, OBI-B-01..03). Project specifications for seven families are published in `binding-specs/`.
- **Schema-position `null` removed; boolean schemas admitted.** Omission is the sole spelling of an unspecified operation schema; `input`/`output`, when present, are JSON Schema 2020-12 object **or boolean** schemas (`false` is an impossible value contract, not a cardinality claim).
- **Source-level `preference` removed; binding `preference` is a bounded integer.** No inheritance semantics; signed safe-integer domain; omission is not a numeric baseline; the core defines no binding-selection algorithm.
- **Invocation-boundary validation is no longer mandated.** Invoking triggers no rule; validation semantics (complete reachable graph, `format` annotation-only, per-value application) bind tools that claim contract validation (OBI-T-16).
- **Discovery relocated.** The `/.well-known/openbindings` contract is the normative HTTP Discovery companion's; the core defines no HTTP behavior.
- **`$schema` pinned to 2020-12.** When `$schema` appears in any schema within the document, it MUST be exactly `https://json-schema.org/draft/2020-12/schema`.
- **`$vocabulary` forbidden.** The `$vocabulary` keyword MUST NOT appear in schemas within the document.
- **SemVer enforced on `openbindings` field.** The JSON Schema now enforces a full SemVer 2.0.0 pattern. v0.1.0 had no pattern constraint.
- **Format token normalization removed.** The 0.1.0 rules (case-insensitive matching, trailing `.0` stripping) are gone. Token equivalence is each format community's concern.
- **Operation matching algorithm removed.** The 0.1.0 deterministic matching cascade (primary key, alias, explicit satisfies) is gone; matching procedure beyond name resolution is tool-defined.
- **`roles` map and operation `satisfies` array removed.** Cross-document correspondence collapses into one mechanism: an operation claims to fulfill a shared contract by carrying that contract's operation name as an `aliases` entry. There is no separate role table and no structured satisfies claim. Correspondence no longer carries a URL anchor or any spec-level verification or trust semantics; those are registry and tooling concerns. The verb is **corresponds to** — adoption asserts correspondence, never verified satisfaction; "satisfies" is retired from normative vocabulary. Removes the top-level `roles` field and the operation `satisfies` field.
- **Aliases are alternate keys.** An operation's key and its `aliases` form one flat, document-unique namespace (OBI-D-04); both resolve to the operation with equal standing. The key remains the operation's singular primary name for display, logging, identity, and the value bindings reference in `bindings[*].operation`.
- **`security` field removed.** The top-level `security` map and the `bindings[*].security` reference are removed from the document. Authentication is not interface metadata: it is a runtime prerequisite negotiated by the binding invoker, not declared statically in the OBI. The `openbindings.binding-invoker` role gains a `CONTEXT_REQUIRED` challenge (a binding may fail asking for context, the runtime resolves it into a context store and retries), with `auth.*` as the first family of requirement types. Removes the top-level `security` field and `bindings[*].security`.
- **`version` field is opaque.** The 0.1.0 SemVer requirement and "breaking changes bump major" rule are removed. Tools define no behavior in terms of `version`.
- **YAML support dropped.** v0.1.0 had normative YAML support (YAML 1.2, no 1.1 coercion). v0.2.0 is JSON only.
- **Example validation strengthened and scoped.** Provided example values MUST validate against their operation schemas where the governing schema graph resolves within the document (OBI-D-11); external-graph examples are verification evidence, not conformance. Was SHOULD in 0.1.0.
- **Explicit-support version processing.** A processor interprets a document only when its declared `openbindings` version belongs to the processor's explicitly supported set; anything else is a version refusal, reported distinctly from non-conformance (OBI-T-04, §8.1). SemVer governs the project's release-compatibility claims, not a processor's acceptance. v0.1.0 had only major-version refusal.
- **`$ref` cycle handling changed.** v0.1.0 required detection and fail-closed (treat as incompatible). v0.2.0 permits cycles in schemas and requires tools to handle them without infinite loops.
- **References are absolute or same-document.** No reference resolves against the document's fetch URI: every `sources[*].location` MUST be an absolute URI or a format-defined absolute address (e.g. a gRPC `host:port`), and every schema `$ref`/`$id` MUST be a same-document fragment or absolute. A document is therefore context-free, resolving identically however it was obtained (origin, cache, redirect, stdin, in-memory); §10's base-URI machinery is gone, and §10 no longer frames a document's identity in terms of the URI it was retrieved from. v0.1.0 resolved relative references against the document's retrieval URI. Relative-path authoring convenience now belongs to tooling, which absolutizes when emitting the document (as `ob serve` already does). (OBI-D-05.)

### Added

- **OBI-T-12 (operation-name resolution).** MUST-level rule: a tool resolving an operation by name matches against the flat key+aliases namespace, treats key and alias matches as equally authoritative, never privileges the key, never resolves a non-matching name, and selects bindings by the resolved operation's key. Closes the prior gap where name resolution was unspecified and two conforming tools could disagree.
- **Positioning (section 1).** Distinguishing features, explicit out-of-scope list. Replaces the old Overview.
- **Scope principle (section 2).** Normative statement that OBI is deliberately minimal. Authority over wire formats rests with binding format specs; authority over behavior rests with implementations.
- **HTTP Discovery companion** (`http-discovery.md`, v0.1.0, independently versioned). The `/.well-known/openbindings` serving and fetching contract, pinned as `DISC-S-01..04` / `DISC-C-01..04` — `GET`/`200`/`404` semantics, `Content-Type` and `Accept` rules, redirect following, CORS guidance, gated-discovery (`401`/`403`) and version-refusal-is-not-absence handling — plus the IANA well-known URI suffix registration. The core keeps one informative acquisition pointer (§1.4).
- **Binding sufficiency (section 8).** Each binding's interaction target MUST be identifiable from the binding and its referenced source alone. Replaces 0.1.0's "actionability" concept.
- **Canonical serialization (Appendix A, informative).** Names RFC 8785 (JCS) as the optional deterministic serialization, with its real input requirements stated (I-JSON subset; incompatible input fails, never coerced; not semantic normalization; no integrity scheme implied).
- **Reference resolution (section 7).** Single section establishing that documents are context-free: no `id` field, and every OBI-defined reference (`sources[*].location`, schema `$ref`/`$id`, and named-transform `$ref`) absolute or same-document, so a document resolves identically wherever it was obtained (`bindings[*].ref` is format-governed and exempt). Covers reference forms, the initial base URI for resolving same-document schema `$ref`s (the OBI document root, until a nested `$id` rebases), and `$ref` cycle handling.
- **Versioning (section 8).** Two-axis model: `openbindings` (spec version, SemVer 2.0.0 syntax, explicit-support processing) and `version` (opaque non-empty interface-version label). Prereleases require explicit support; build metadata is ignored for support membership; documents SHOULD declare the lowest sufficient version.
- **IANA considerations (section 11).** The `application/vnd.openbindings+json` media-type registration; the well-known URI suffix registration moved to the HTTP Discovery companion.
- **Input/output contract direction (§5.1).** `input` is a lower bound on service acceptance; `output` an upper bound on successful emission, per value. States: absent (unspecified), `{}`/`true` (any value), `false` (no value), `{"type": "null"}` (only `null`); literal `null` is not a schema-position value.
- **Transform direction (§5.5).** `inputTransform` reshapes one caller input value toward the source's expected shape; `outputTransform` reshapes one source output value toward the operation's `output`; transforms are per-value, never cross-cardinality.
- **Core invariants (§2).** Six load-bearing invariants stated once and cited by rules: per-value contract; enabling-not-invoking; split authority; context-free documents; offline-decidable conformance; decentralized extension.
- **Binding specifications (§6, §10.4).** The `bindingSpec` identifier model and the `OBI-B-01..03` rule family: exact opaque identifiers under decentralized defining authorities, a seven-item completeness floor, and new-identifier-on-incompatible-change. The `binding-specs/` catalog publishes the project's seven specifications with an informative authoring template.
- **Capability-scoped tool obligations (§10.1).** A tool's obligations follow the capabilities it exercises, not a fixed conformance class; invoking a binding triggers no rule by itself. A JSONata runtime is required only of tools that evaluate transforms.
- **Verification conclusions (§10.5, OBI-T-17).** Overall conclusions — conformant, non-conformant, conformance undetermined — with rule-level satisfied/violated/unverified/not-applicable evidence by stable identifier; partial verification is never presented as unqualified conformance; no linear verification ladder.
- **Stable rule identifiers (§10).** Every conformance rule carries an `OBI-D-##`, `OBI-T-##`, or `OBI-B-##` identifier — never reused, never renumbered — with retired identifiers reserved historically (§10.6).
- **Document rules OBI-D-01..13, 16, 17, 18** (14 and 15 retired). Covering UTF-8 JSON with duplicate/BOM rejection, structural schema validity, identifier grammar, the operation-identifier namespace, reference forms, `$schema` and `$vocabulary` constraints, binding/transform/schema referential integrity, scoped example validation, SemVer syntax, binding sufficiency, schema well-formedness, and transform parse-validity.
- **Tool rules OBI-T-01..06, 10..12, 16, 17** (07, 08, 09, 13, 14, 15 retired). Covering don't-fail-on-unknown postures, `x-` extensions, explicit-support version processing, schema-keyword diagnostics, binding-specification `ref` conventions, pinned-JSONata transform evaluation with a closed environment, `$ref` cycle handling, operation-name resolution, claim-triggered validation semantics, and honest verification reporting.
- **Conformance corpus (`conformance/`).** Fixture-based test corpus keyed to rule IDs. 102 tests across 13 document rules and 3 tool rules. Includes `manifest.json`, `fixture.schema.json`, a reference Go runner, plus verification and manifest generation scripts.
- **Abstract, editors, license/IP, and notational conventions** as standalone front-matter sections.
- **Normative and informative references (section 16).**
- **`minLength: 1`** on `sources[*].bindingSpec`, `sources[*].location`, and `version` in the JSON Schema; `content` accepts any JSON value (its accepted forms are each binding specification's concern).
- **`propertyNames` constraints** in the JSON Schema enforcing the key pattern on every map.
- **Schema-level enforcement of cross-reference patterns and uniqueness.** Cross-reference values (`bindings[*].operation`, `bindings[*].source`) and `TransformOrRef.$ref` are now pattern-constrained in the JSON Schema. The `aliases` array carries `uniqueItems: true`. These backstop existing prose rules (OBI-D-04, OBI-D-08 through OBI-D-13) with structural validation that catches typos before cross-reference resolution.

### Changed

- **`idempotent` semantics tightened and narrowed.** A three-state author-attested claim about intended operation-level effects under equivalent context — every binding must honor it — implying nothing about cacheability, stable output, or retry safety.
- **`deprecated` and `preference` on bindings are author signals.** The draft's earlier deprecated-tier selection rule was removed with the rest of the selection algorithm; tools decide whether and how the signals contribute to selection.
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
- YAML support (for OBI documents themselves; a binding specification may accept YAML source *artifacts*, as `openbindings.openapi@1` does)
- Mandatory invocation-boundary validation (retired OBI-T-07/T-08; validation is claim-triggered, OBI-T-16)
- Binding-selection algorithm and deprecated tier (retired OBI-T-09)
- In-core discovery section and its tool rules (retired OBI-T-13/T-14; moved to the HTTP Discovery companion)
- Absent-equals-`null` for operation schemas, and the universal `content` form/self-containment rules (retired OBI-D-14/D-15; binding-specification-defined)
- The informative request-lifecycle walkthrough

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
