# OpenBindings Core Specification Content Analysis

## Status and scope

This document is a non-normative analysis of the OpenBindings core specification. It is not part of the specification and does not define conformance. Its purpose is to separate the specification's content by its distance from the central OpenBindings premise, then evaluate whether each major commitment is necessary, well placed, proportionate, and sufficiently justified.

The analysis is intentionally skeptical without presuming that smaller is always better. A feature may deserve to remain because it solves a real ecosystem problem even when it is not logically part of the core premise. Conversely, a decision may be necessary in kind while its current form remains contingent or unnecessarily restrictive.

This document analyzes only the core specification and its schema:

- `openbindings.md`
- `openbindings.schema.json`

Companion binding formats are outside scope.

## Executive summary

The irreducible OpenBindings idea is small and strong:

> A named operation has a protocol-independent value contract and may be connected to one or more protocol-specific interaction targets.

The current specification adds five broad layers around that idea:

1. a document model for operations, bindings, and sources;
2. a portability profile for JSON Schema, references, identifiers, and versions;
3. practical adaptation and selection features such as transforms, aliases, preferences, and deprecation;
4. deployment and publication features such as well-known discovery and media-type registration;
5. conformance, security, governance, and explanatory material needed for a serious public standard.

Most of these layers address real problems. The principal concern is not that the specification is bloated with obviously useless fields. It is that several choices with very different levels of necessity are presented at one normative level, while some behavior needed to make the central abstraction operationally substitutable remains deliberately undefined.

The most important conclusions of this analysis are:

- The operation/binding/source separation is the true core and should remain unmistakably central.
- Binding sufficiency, internal referential integrity, stable operation-name resolution, and boundary validation are critical interoperability requirements rather than optional conveniences.
- The specification should decide whether it promises a portable **per-value contract** or a portable **operation contract**. The latter requires at least some treatment of interaction shape, completion, failures, and behavioral equivalence among bindings.
- Transforms solve a problem created directly by "one operation, many bindings," but making JSONata a mandatory core runtime is a consequential layering choice. Keeping transform semantics portable is valuable; whether transforms belong in the irreducible core is less clear.
- Discovery is useful and standardizable but orthogonal to the document model. It can remain in the publication while being clearly identified as a discovery profile rather than part of the core semantic model.
- Aliases currently carry too many jobs: rename continuity, alternate vendor names, and cross-document contract correspondence. The flat unqualified namespace is simple, but weak as a foundation for shared-contract identity.
- `preference`, source-level preference inheritance, and the mandatory deprecated-binding tier are useful selection policy, but do not appear necessary to the portable contract. They are strong candidates for an optional selection profile or simplification.
- `idempotent` expresses a valuable claim but is not precise enough for the uses the prose associates with it. It should be refined or removed until its semantics are narrower.
- JSON Schema validity, transform parse validity, and transform `undefined` behavior should be made more deterministic. The current posture permits conformant documents that fail for statically knowable reasons only when invoked.
- The distinction between document conformance and a validator's incomplete verification is intellectually defensible but operationally difficult. Tools need standard verification levels or result vocabulary.
- Some restrictions look more arbitrary than necessary: object-only schemas at operation positions, object-or-string source content, the identifier character set, explicit `null` as a second spelling of omission, and the absolute prohibition on base-dependent references inside embedded artifacts.

No single item above proves that the specification should be radically reduced. It suggests a clearer layering: a small semantic core, a mandatory portability profile, and separately identifiable practical profiles for transforms, discovery, annotations, and selection.

## 1. Method

Every significant piece of content is evaluated using the following questions:

| Question | Purpose |
|---|---|
| What problem does it solve? | Prevents deletion merely because a feature is not part of the premise. |
| What breaks if it is removed? | Distinguishes necessities from conveniences. |
| Is some decision required? | Separates the need for a choice from the current choice. |
| Is this particular decision required? | Exposes arbitrary or weakly justified commitments. |
| Where should it live? | Distinguishes core semantics, profiles, guidance, and implementation policy. |
| What does it cost? | Includes runtime dependencies, validation complexity, conceptual load, and governance. |
| What is the judgment? | Keep, simplify, relocate, make informative, remove, or revisit. |

The categories used below are:

1. **Core premise** — the reason OpenBindings exists.
2. **Semantic necessities** — rules needed for the premise to have one meaning.
3. **Interoperability necessities** — choices independent implementations must share.
4. **Practical ecosystem necessities** — features needed for realistic usefulness or adoption.
5. **Optional ergonomics** — useful conveniences that do not determine interoperability.
6. **Policy choices** — places where several reasonable designs exist.
7. **Publication and governance** — material required for a public specification rather than for the data model.
8. **Security and operational guidance** — threats, requirements, and mitigations.
9. **Negative space** — behavior deliberately left out of scope.
10. **Redundancy or misplaced content** — content that may be repeated or live at the wrong layer.
11. **Missing necessities** — omissions that may prevent the premise from delivering its stated value.

### Source map

The analysis deliberately reorganizes the specification rather than following its chapter order. The principal source sections are:

| Analysis subject | Core specification source |
|---|---|
| Premise, positioning, and scope | [§1–§4](openbindings.md#1-positioning) |
| Terminology and document model | [§5](openbindings.md#5-terminology), [§6](openbindings.md#6-document-shape) |
| Operations and annotations | [§6.1](openbindings.md#61-operations) |
| JSON Schema profile | [§6.2](openbindings.md#62-schemas) |
| Bindings and selection | [§6.3](openbindings.md#63-bindings) |
| Sources and embedded content | [§6.4](openbindings.md#64-sources) |
| Transforms | [§6.5](openbindings.md#65-transforms) |
| Discovery | [§7](openbindings.md#7-discovery) |
| Binding sufficiency | [§8](openbindings.md#8-binding-sufficiency) |
| Canonical form and references | [§9](openbindings.md#9-canonical-form-informative), [§10](openbindings.md#10-reference-resolution) |
| Versioning and publication | [§11](openbindings.md#11-versioning), [§12](openbindings.md#12-iana-considerations) |
| Security | [§13](openbindings.md#13-security-considerations) |
| Document and tool conformance | [§14](openbindings.md#14-conformance) |
| Extensions | [§15](openbindings.md#15-extensions) |
| Structural schema | [`openbindings.schema.json`](openbindings.schema.json) |

## 2. The irreducible premise

### 2.1. The premise in one sentence

The most compact faithful statement is:

> OpenBindings separates an operation's caller-facing value contract from one or more protocol-specific targets through which the operation can be invoked.

Each part matters:

- **operation** supplies a protocol-independent unit of capability;
- **caller-facing value contract** supplies shared input and output meaning;
- **one or more targets** permits the same operation to exist over different protocols;
- **separates** prevents any one binding artifact from becoming the canonical operation contract.

The shared-contract and discovery stories are important benefits, but neither is necessary to make this sentence true. They should therefore be evaluated as higher layers rather than silently included in the premise.

### 2.2. The minimum conceptual model

A minimal OpenBindings model needs only four concepts:

1. an operation name;
2. an optional input and output contract;
3. a binding associating an operation with a protocol-specific target;
4. enough information to identify that target.

In an intentionally schematic form:

```json
{
  "operations": {
    "createTask": {
      "input": { "type": "object" },
      "output": { "type": "object" }
    }
  },
  "bindings": {
    "createTask.http": {
      "operation": "createTask",
      "format": "openapi@3.1",
      "location": "https://example.com/openapi.json",
      "ref": "#/paths/~1tasks/post"
    }
  }
}
```

The actual specification factors `format` and artifact location into reusable `sources`. That factoring is sensible, but it is not logically required by the premise. A binding could contain all target information inline. `sources` earns its place through reuse, separation of artifact identity from operation selection, and support for multiple bindings into one artifact.

### 2.3. What is not part of the irreducible premise

The following may be valuable without being constitutive:

- discovery at a well-known path;
- aliases and shared-contract name adoption;
- examples and documentation metadata;
- preference and deprecation ordering;
- transforms;
- source content embedding;
- canonical JSON;
- IANA registrations;
- the exact schema dialect;
- the exact identifier character set;
- the exact version-refusal policy.

This is not a recommendation to remove them. It is the baseline needed to assess them honestly.

## 3. Core-premise content

### 3.1. Operations

**Problem solved.** Operations provide the stable semantic unit that survives across protocols.

**Necessity.** Absolute. Without operations, OpenBindings becomes an index of unrelated protocol artifacts.

**Current design.** Operations are map entries whose keys are their primary names. `input` and `output` are optional JSON Schemas; all remaining fields are annotations, claims, or examples.

**Judgment.** Keep in core.

**Concern.** The specification calls `input` and `output` the operation's contract, but those schemas describe only individual values. They do not describe the interaction that carries the values. This is sufficient for a per-value overlay, not obviously sufficient for protocol-independent operation substitutability. That issue is analyzed under missing necessities.

### 3.2. Bindings

**Problem solved.** Bindings connect the portable operation to a specific interaction target.

**Necessity.** Absolute for executable interfaces. Contract-only documents could exist without bindings, and the specification appropriately permits that.

**Current design.** A binding references an operation key and source key, then optionally selects an entry in the artifact with format-defined `ref` syntax.

**Judgment.** Keep in core.

**Strength.** Letting the binding format govern `ref` avoids inventing a lossy universal addressing language.

**Concern.** The binding is described as an alternative target that honors the operation contract, but the spec defines little behavioral equivalence beyond per-value validation and the operation's idempotency claim. The meaning of "alternative" is therefore weaker than it first appears.

### 3.3. Sources

**Problem solved.** Sources identify binding artifacts once so multiple bindings can address entries within them. They also separate artifact information from operation-to-entry correspondence.

**Necessity.** The information is essential; the separate source object is not logically essential.

**Current design.** A source declares `format` and at least one of `location` or `content`.

**Alternatives.** Inline `format`/`location`/`content` on each binding; permit either inline or referenced sources; make sources the primary artifacts and place bindings inside them.

**Judgment.** Keep. Reuse and artifact-level defaults justify the indirection.

**Concern.** `location` is overloaded. Depending on the format, it may name the artifact or the live service. This produces the complicated `location` plus `content` interpretation rule. A clearer model might distinguish artifact provenance/base from invocation target, while allowing formats to omit whichever concept does not apply.

### 3.4. Target identification and binding sufficiency

**Problem solved.** A binding must identify something without a hidden registry or machine-local lookup.

**Necessity.** Critical. A portable binding that cannot identify its target is not portable.

**Current design.** `format`, `location` or `content`, and `ref` must be sufficient to identify the target. Reachability, credentials, and runtime success remain out of scope.

**Judgment.** Keep in core. This is one of the specification's most important and best-drawn boundaries.

**Possible simplification.** The distinction between identification and invocation should be stated once as a foundational invariant, then referenced by the document and tool rules. It is currently explained in several places.

## 4. Semantic necessities

### 4.1. Authority between operation and binding artifact

The spec correctly makes the operation authoritative for the caller-facing contract and each binding format authoritative for its wire behavior. Without this division, schema conflicts would be unresolvable.

**Judgment.** Keep and make even more prominent. This is nearly part of the premise itself.

**Open issue.** The spec says bindings are authored to honor the operation contract but provides no conformance rule for deciding whether a binding actually does so. This is understandable across arbitrary formats, but the limitation should temper claims of equivalence.

### 4.2. Multiple bindings as alternatives

The rule that any one binding is a complete invocation is necessary; otherwise bindings might be interpreted as a set of steps or required transports.

**Judgment.** Keep.

**Open issue.** Alternatives need a clearer equivalence floor. Currently two bindings can produce the same valid value types while differing materially in cardinality, completion, failure behavior, ordering, and side effects.

### 4.3. Operation-name resolution

A document needs unambiguous operation resolution. The flat namespace of keys plus aliases guarantees that a name resolves to at most one operation.

**Judgment.** The invariant is necessary if aliases remain. The particular flat, unqualified namespace is a policy choice and should be revisited with the shared-contract model.

### 4.4. Referential integrity

Bindings must name existing operation and source keys; transform references must resolve; same-document schema references must resolve.

**Judgment.** Keep. These are inexpensive, offline-decidable integrity properties that prevent deferred and confusing failures.

### 4.5. Meaning of absent, `null`, and empty schema

Distinguishing "unspecified" from "accepts any JSON value" is valuable. `{}` is the correct JSON Schema spelling of the latter.

Allowing both absence and `null` to mean unspecified is less clearly necessary. It gives two serializations the same meaning, adds schema branches, and complicates canonical comparison. The likely benefits are easier generation from nullable host-language structures and explicitness when a field is intentionally unspecified.

**Judgment.** Keep the semantic distinction between unspecified and unconstrained. Consider removing explicit `null` unless there is concrete authoring or round-trip evidence that it earns its complexity.

### 4.6. Input and output variance

The input contract is contravariant from the service's perspective and the output contract covariant: implementations may accept more and return narrower values.

**Judgment.** Keep. This is meaningful contract content.

**Clarification needed.** A conforming invoker must reject caller inputs outside the declared schema even when a particular service would accept them. Thus "the service may accept more" matters for implementation compatibility but not for invocation through a conforming OBI boundary. The prose should make that consequence explicit.

## 5. Interoperability necessities

### 5.1. JSON serialization

Some common serialization is necessary. JSON is a defensible choice because the data contracts and transforms already operate over JSON values.

**Arbitrariness.** JSON is contingent rather than logically necessary, but changing it would fragment the ecosystem and complicate the schema/transform model.

**Judgment.** Keep.

### 5.2. Identifier syntax

Some identifier rules are needed for reliable references and code generation. The exact pattern `^[A-Za-z_][A-Za-z0-9_.-]*$` is a policy choice.

**Benefits.** Portable ASCII, straightforward code generation, no normalization or confusable-character problem, usable dotted names.

**Costs.** Excludes Unicode identifiers, leading digits, spaces, slashes, colons, and URI-like qualified names. The exclusion of colon and slash is particularly relevant if shared-contract names eventually need globally qualified identifiers.

**Judgment.** Keep a constrained identifier profile, but reassess the exact alphabet alongside shared-contract identity. Document why this set is preferable to a URI, reverse-domain, or JSON Pointer token model.

### 5.3. JSON Schema dialect

Independent validators need a shared dialect. Pinning JSON Schema 2020-12 is justified.

The following are distinct decisions:

- object form only at operation and top-level schema positions;
- omitted `$schema` means 2020-12;
- present `$schema` must use the canonical 2020-12 URI;
- `$vocabulary` is forbidden;
- all keywords otherwise remain available;
- `format` is annotation-only at OBI boundaries.

**Object-only schemas.** This is weakly justified. JSON Schema 2020-12 includes boolean schemas. `{}` replaces `true`, but there is no object-form equivalent as direct and unambiguous as `false`. The restriction saves a small amount of type branching while making the claimed dialect a subset.

**Judgment.** Revisit. Allow boolean schemas unless concrete implementation evidence shows a meaningful cost.

**`$vocabulary` prohibition.** Strongly justified for a portable floor. Custom vocabularies could change assertion behavior between tools.

**Judgment.** Keep.

**`format` annotation-only.** This sacrifices some validation strength to guarantee consistent results across libraries.

**Judgment.** Keep as the portable floor. A separate strict-format profile could exist for deployments that want it.

**Missing rule.** The spec says these values are JSON Schema documents, but neither the derived schema nor a stable document rule clearly requires meta-schema validity. For example, an object with a known keyword of the wrong type can pass the OBI structural schema and fail only when a schema engine compiles it.

**Recommendation.** Add a document rule requiring each OBI schema to be a valid JSON Schema 2020-12 schema under the OBI profile.

### 5.4. Reference resolution

Context-free resolution is one of the strongest design choices in the specification. Absolute or same-document references ensure that fetching through redirects, caches, stdin, or memory does not silently change meaning.

**Judgment.** Keep the invariant.

**Cost.** Authors cannot use ordinary relative references from the OBI retrieval URI. Tooling must preserve the whole OBI document as the resolution scope when extracting schemas.

**Question.** The prohibition on relative references inside embedded binding artifacts is stronger than the OBI reference invariant itself. An embedded OpenAPI-like artifact might carry relative references that are well defined against its declared `location`. OBI-D-15 forbids that because the embedded content must be self-contained.

This is portable but restrictive. The specification should decide whether `location` may act as an explicit base for embedded artifact content. That would remain context-free because the base travels in the document; it would not depend on where the OBI was fetched.

**Judgment.** Keep absolute/same-document OBI references. Revisit the stronger self-containment rule for embedded artifacts.

### 5.5. Version negotiation

Tools need to avoid interpreting documents under incompatible semantics. Major-version refusal, pre-1.0 minor refusal, and explicit prerelease support are defensible.

**Judgment.** Keep.

**Complexity.** The downward-refusal text is lengthy because tools declare supported ranges rather than a single version. A compact normative algorithm and test table would be clearer than repeated prose.

### 5.6. Unknown fields and extensions

Accepting unknown fields supports forward compatibility; reserving `x-` makes intentional extensions distinguishable from likely typos.

**Judgment.** Keep.

**Possible simplification.** The distinction is primarily diagnostic: both unknown ordinary fields and unknown `x-` fields are ignored. State the execution rule once, then separately recommend warnings for ordinary unknown fields.

### 5.7. Boundary validation

Mandatory input and output validation gives the operation schemas actual operational force. Without it, the same document could accept different values depending on the invoker.

**Judgment.** Keep. This is critical practical interoperability.

**Cost.** Every invoker needs a conforming runtime validator and fully resolved schemas. That is a justified cost if `input` and `output` are truly contracts rather than documentation.

**Open issue.** The spec requires static resolvability of every reachable branch before invocation. This is deterministic and avoids partial validation, but potentially expensive and stricter than ordinary lazy JSON Schema evaluation. The rationale is good; the implementation consequences deserve a short dedicated note and corpus cases for large or recursive external graphs.

## 6. Practical ecosystem necessities

### 6.1. Transforms

Transforms solve a central practical problem: protocol-specific artifacts frequently use different envelopes and field names even when they implement the same logical operation. Without transforms, "one operation, many bindings" works only where all binding wire shapes already match the portable contract or where every tool carries private adapter configuration.

That makes **some portable adaptation mechanism** close to practically necessary.

It does not automatically make all current transform decisions necessary:

- transforms live in the core document;
- every evaluating tool uses JSONata 2.x;
- transforms may be inline or named;
- the environment is closed;
- parse validity is not document conformance;
- `undefined` handling is only SHOULD-level and otherwise tool-defined;
- failures and resource limits remain tool-defined.

**JSONata choice.** One language must be selected if transforms are portable. JSONata is well matched to JSON-to-JSON restructuring and has cross-language implementations. It is still a substantial runtime dependency and governance dependency on an external language whose "2.0" is defined as the 2.x line rather than a fixed formal semantics.

**Judgment.** Keep a single portable transform language if transforms remain in core. Record a more explicit decision rationale and compatibility policy for JSONata minor releases.

**Closed environment.** Necessary for portability and security.

**Judgment.** Keep.

**Parse-invalid expressions.** Treating malformed JSONata as invocation-time failure allows structurally conformant but predictably unusable bindings. Parse validity is statically decidable by any transform-capable validator.

**Judgment.** Revisit. Referenced transforms should probably be parse-valid document content. At minimum, define a stronger "invocable document" verification level.

**Undefined results.** Allowing conforming tools to disagree about whether an undefined result is an error, omission, or something else weakens transform portability precisely at the boundary where transforms exist to provide it.

**Judgment.** Make undefined a mandatory transform failure. `null` already expresses an intentional JSON null result.

**Placement.** Two coherent designs exist:

1. keep transforms in core because they are necessary to make heterogeneous bindings honor one contract; or
2. define a mandatory core contract plus an optional, separately versioned transform profile.

The current design effectively chooses the first while making the runtime conditional on use. That is reasonable, but the layer should be named explicitly rather than treated as obviously inherent in bindings.

### 6.2. Discovery

The well-known URI solves configuration-free discovery for one interface per origin. That is genuinely useful for browsers, agents, registries, and generic tooling.

It is not necessary to interpret an OBI document and is orthogonal to operation/binding semantics.

**Judgment.** Keep in the publication, but label it as the standard HTTP discovery profile. Consider separating its conformance rules from document-processor conformance so non-HTTP ecosystems do not experience it as part of the semantic core.

**Limitation.** The convention does not address multiple interfaces per origin, tenant selection, or non-HTTP origins. That is acceptable if the claim remains narrow.

### 6.3. Aliases and shared-contract correspondence

Aliases solve three different problems:

1. continuity after renaming;
2. alternate names used by existing consumers;
3. adoption of a shared contract's operation name.

The first two are ordinary ergonomics. The third is presented as a distinguishing ecosystem feature.

The current mechanism is only name adoption. It carries no contract identity, publisher identity, version, provenance, or verification. Two unrelated contracts that use the same operation name are indistinguishable, and the flat namespace prevents one implementation from adopting both names when they collide.

The spec acknowledges this and advises globally distinctive names. That advice moves identity design onto contract authors without giving them a standardized qualification mechanism.

**Judgment.** Keep aliases for rename and alternate-name resolution. Revisit the claim that aliases alone provide robust shared-contract correspondence.

Possible directions:

- explicitly narrow the feature to informal name correspondence;
- add qualified identifiers, such as contract URI plus operation name;
- define a separate shared-contract profile with document identity and version semantics;
- reserve an alias syntax capable of global qualification.

### 6.4. Binding selection hints

Some selection mechanism is practically necessary whenever an operation has multiple actionable bindings. It does not follow that the document must standardize numeric preference.

The current model includes:

- binding-level numeric preference;
- source-level default preference;
- binding preference overriding rather than combining with the source value;
- negative values;
- a mandatory non-deprecated-before-deprecated tier;
- SHOULD-level preference ordering within a tier;
- tool-defined tie-breaking and candidate-set construction.

This is a relatively large policy surface for a hint that does not produce deterministic selection.

**Source-level preference.** Pure shorthand. It saves repetition but adds inheritance and override semantics.

**Judgment.** Strong simplification candidate.

**Numeric preference.** Useful for authors, but its axis is deliberately undefined. One document may use cost, another stability, another protocol age. Consumers cannot interpret the magnitude beyond ordering.

**Judgment.** Consider relocating to an optional selection profile or retaining only binding-level ordinal priority with explicitly local meaning.

**Deprecated tier.** It gives `deprecated` portable force, but a mandatory tier may conflict with local constraints. The candidate-set escape hatch handles unsupported or policy-declined bindings, so the rule is not as rigid as it first appears.

**Judgment.** Defensible, but not core-premise content. Keep only if consistent selection behavior is considered a core interoperability guarantee.

### 6.5. Embedded source content

Embedding makes documents portable, cacheable, and usable offline. It also lets an OBI be a self-contained bundle.

**Judgment.** Keep.

**Arbitrary restriction.** `content` permits an object or non-empty string, but not an array, number, boolean, or null. If `content` represents parsed JSON, JSON arrays are legitimate document roots. Restricting to objects may match current formats but contradicts the generic claim to support arbitrary future formats.

**Recommendation.** Allow any JSON value for JSON-based formats, or explicitly constrain supported JSON artifacts to object-rooted documents and explain why.

**Location/content pairing.** The current rule has to distinguish artifact-located formats from live-service-located formats. Consider separating `artifact` provenance/base from `endpoint`, or requiring each format specification to state the roles explicitly rather than relying on a core fallback.

### 6.6. Examples

Examples support documentation, testing, generated clients, and agents. They are useful and cheap to represent.

Making example/schema agreement a document-conformance rule is more consequential. If an operation schema uses external references, determining whether an optional example is conformant may require network access. A validator without that capability leaves the rule unverified.

**Judgment.** Keep examples. Reconsider whether example validation should determine document conformance rather than a strong lint or a separately reported verification result.

## 7. Optional ergonomics and annotations

### 7.1. `name`, `description`, and tags

These are ordinary documentation metadata with low implementation cost and no effect on core semantics.

**Judgment.** Keep as optional annotations. Their non-semantic status is already mostly clear.

### 7.2. Contract `version`

An opaque author-defined version label is useful for display and registries, but the spec deliberately gives it no comparison or compatibility meaning.

**Judgment.** Keep as metadata if real consumers use it. Rename or describe it consistently as a label so users do not assume semantic compatibility behavior.

**Tension.** The project discusses shared contracts while refusing document identity and giving contract version no normative meaning. That is coherent for a context-free interface overlay, but insufficient for a strong shared-contract registry story.

### 7.3. Top-level `schemas`

Named schemas prevent duplication and make references readable. They are practical rather than logically required because schemas could be inlined or placed under a generic definitions container.

**Judgment.** Keep.

**Arbitrariness.** JSON Schema already has `$defs`, but the OBI root is not itself a schema. A dedicated `schemas` map is therefore reasonable and easier to explain than treating the whole OBI as a schema resource.

### 7.4. Named transforms

The top-level transform map provides reuse and readable binding entries.

**Judgment.** Keep if transforms remain. It is low-cost ergonomics built on a practically important feature.

### 7.5. Canonical form

JCS is useful for hashes, signatures, cache keys, and stable prompts. The section is informative and imposes no runtime burden.

**Judgment.** Keep as an informative appendix or move to a processing guide. It does not need greater prominence in the semantic flow.

### 7.6. Explicit deprecation metadata

Operation-level deprecation is a documentation and migration hint. Binding-level deprecation participates in selection.

**Judgment.** Keep operation deprecation as annotation. Evaluate binding deprecation together with the selection profile rather than as the same feature.

### 7.7. `idempotent`

The field attempts to expose valuable operational knowledge. The current prose associates it with retries, caching, deduplication, and planning.

Idempotency supports some retry decisions but does not imply:

- deterministic output;
- cacheability;
- that an operation is safe or read-only;
- that authorization, billing, or audit effects repeat harmlessly;
- that identical JSON input is the whole identity of an invocation.

"Same observable state" also needs a defined observation boundary and context: same principal, tenant, credentials, time window, and idempotency-key policy may matter.

**Judgment.** Revisit before relying on it normatively. Either define a narrow effects-based claim or move it into a traits/profile system. Remove caching from its rationale unless a separate cache contract is defined.

## 8. Policy choices and arbitrary-seeming commitments

This section collects decisions for which some choice is needed but the current choice is not inevitable.

| Decision | Why a choice is needed | Current choice | Assessment |
|---|---|---|---|
| Host format | Interchange requires serialization. | JSON only. | Strong and coherent with schemas/transforms; keep. |
| Identifier alphabet | References and code generation need stable names. | Restricted ASCII with dots and hyphens. | Sensible, but revisit for qualified shared-contract names. |
| Schema dialect | Validators need common semantics. | JSON Schema 2020-12. | Keep. |
| Root schema form | Host types need a representation. | Objects only; no boolean schemas. | Weakly justified; allow booleans unless implementation cost is material. |
| Schema formats | Libraries differ. | Annotation-only at boundaries. | Good portability choice; keep. |
| Schema vocabularies | Custom assertion semantics fragment tools. | `$vocabulary` forbidden. | Keep. |
| Transform language | Portable transforms need one language. | JSONata 2.x. | Defensible but costly; document compatibility policy. |
| Transform undefined result | JSONata can produce no value. | SHOULD error; otherwise tool-defined. | Too loose for a portability feature; make failure mandatory. |
| Reference bases | Resolution must be stable. | Absolute or same-document; fetch URI never a base. | Strong; keep. |
| Embedded artifact bases | Bundles should be portable. | Embedded content must be self-contained. | Possibly over-restrictive; allow explicit `location` as carried base if formats support it. |
| Format-token governance | Tools need handler selection. | Community authority; no registry; recommended `name@version`. | Lightweight but collision- and discoverability-prone. Needs a namespace convention or stronger authoring contract. |
| Operation correspondence | Shared contracts need matching. | Unqualified name adoption via key or alias. | Too weak for strong correspondence claims; qualify or narrow the claim. |
| Binding preference | Multiple targets need selection. | Numeric higher-is-better plus source inheritance. | Useful but policy-heavy; simplify or profile. |
| Deprecation | Consumers need migration signals. | Non-deprecated binding tier is mandatory. | Defensible selection policy, not irreducible core. |
| Unknown fields | Forward compatibility needs behavior. | Ignore all; warn for unknown non-`x-`. | Keep. |
| Version refusal | Prevent semantic misreading. | Major refusal; pre-1.0 minor refusal; exact prerelease opt-in. | Keep; express algorithmically. |
| Discovery | Unconfigured clients need a location. | HTTP well-known path, one interface per origin. | Useful profile, orthogonal to document semantics. |
| Example correctness | Examples should not lie. | Invalid examples make the document non-conformant. | Good aspiration with high verification cost; consider verification status instead. |
| Duplicate JSON keys/BOM | Parsers otherwise disagree. | Both invalid. | Strong interoperability choice; keep. |

## 9. Publication, governance, and security

### 9.1. Editors, status, license, references, and rule stability

This material does not belong to the semantic model but belongs in a serious public specification.

**Judgment.** Keep. Its category should remain visibly separate so readers do not confuse publication machinery with document requirements.

### 9.2. Media type and well-known URI registration

The media type supports correct HTTP representation and content negotiation. The well-known registration supports the discovery profile.

**Judgment.** Keep while those HTTP features remain. If discovery moves to a separate profile document, its IANA material should move with it.

### 9.3. Security considerations

The threats identified—SSRF, local-file access, reference expansion, cycles, unbounded size, and expression exhaustion—are real.

The normative closed transform environment is unusual in being both a semantic portability rule and a security boundary. It belongs in core transform semantics.

Network allow-lists, address-range restrictions, timeouts, and size caps are deployment policy. Keeping them informative is appropriate.

**Judgment.** Keep the security section. Consider a shorter core threat statement plus a maintained security processing guide if the recommendations grow substantially.

## 10. Explicit negative space

Out-of-scope decisions are part of the design and require the same scrutiny as included features.

### 10.1. Invocation semantics

The core refuses to define request/response, streaming, bidirectional, or pub/sub behavior. This keeps the operation model small and protocol-neutral.

It also means that an operation's portable contract does not tell a generic caller how many values to send, when to close, how many outputs to expect, or how completion works.

**Judgment.** This is the most consequential scope decision in the specification. Either:

- explicitly define OpenBindings as a per-value contract overlay and moderate broader substitutability claims; or
- add a minimal protocol-neutral interaction model.

Leaving the current promise and current omission together is likely to confuse implementers.

### 10.2. Error and failure semantics

Failure outcomes are binding-format concerns and are excluded from `output` validation. The portable operation cannot declare expected error categories or detail schemas.

**Cost.** SDKs, agents, orchestration systems, and alternative bindings cannot reason portably about retryability, authentication failures, not-found results, validation errors, or partial success.

**Judgment.** Revisit. A minimal optional error contract may be practically necessary.

### 10.3. Binding compatibility and equivalence

The spec says each binding is an alternative target honoring the operation contract, but comparison and matching are tool-defined.

**Judgment.** It is reasonable not to standardize general schema compatibility in 0.2. The spec should nevertheless state the minimum author obligation across bindings: equivalent caller-visible semantics to the extent represented by the operation contract.

### 10.4. Credentials and runtime context

Keeping secrets and credential resolution outside documents is correct. It avoids turning interface descriptions into deployment manifests or secret carriers.

**Judgment.** Keep out of scope.

**Possible missing bridge.** Tools may need a portable way to say that context is required without describing the secret itself. If companion formats provide that, core need not.

### 10.5. Integrity, signing, and attestation

External composition is a reasonable choice. Signature systems have distinct governance and threat models.

**Judgment.** Keep out of core. The informative canonical form makes external composition easier.

### 10.6. Format registry

Avoiding a central registry preserves extensibility and reduces governance burden. However, format tokens are executable dispatch identifiers, so collisions or ambiguous version conventions directly harm interoperability.

**Judgment.** A heavyweight registry is unnecessary, but a normative namespace convention may be. Reverse-domain or URI-based third-party tokens would reduce collisions while leaving authority decentralized.

### 10.7. Transform runtime policy

Resource limits and invocation error propagation can remain implementation-defined. Parse validity and undefined-result behavior are not resource policy; they are portable expression semantics and should be standardized more strongly.

## 11. Conformance model analysis

### 11.1. Capability-scoped tool obligations

Scoping obligations by exercised capability is a strong design. It permits renderers, validators, code generators, and invokers to conform without pretending to implement every feature.

**Judgment.** Keep.

### 11.2. Document conformance versus verification

The spec treats conformance as an objective property of the document even when a given validator cannot verify it. Such a validator reports the relevant clause as unverified rather than valid or invalid.

This is logically sound but operationally awkward:

- a tool's plain "valid" result may actually mean "no verified violation";
- two validators can report different confidence about the same document;
- full conformance may require network access and knowledge of every binding format;
- users need to know whether a document is structurally valid, internally coherent, offline resolvable, or fully verified.

**Recommendation.** Standardize verification levels or result vocabulary, for example:

1. **parsed** — RFC 8259 and duplicate/BOM checks;
2. **structurally valid** — derived schema validation;
3. **internally valid** — all offline document rules and references verified;
4. **format-verified** — supported binding formats pass sufficiency and embedded-content rules;
5. **fully verified** — external schemas and example validation completed.

This would preserve the philosophical distinction while making it useful to tools.

### 11.3. Prose and derived schema

Making prose authoritative avoids pretending JSON Schema can express every rule. That is appropriate.

**Cost.** A generic JSON Schema validator cannot determine document conformance. Implementers need a custom rule engine, and structural constraints can drift between prose, schema, corpus, and implementations.

**Recommendation.** Publish a machine-readable rule manifest mapping each OBI-D rule to whether it is schema-enforced, offline-decidable, format-dependent, or network-dependent. The conformance corpus already contains much of the necessary structure.

### 11.4. Rule-family inventory

| Rule | Category | Judgment |
|---|---|---|
| OBI-D-01 JSON, duplicates, BOM | Interoperability necessity | Keep. |
| OBI-D-02 derived-schema validation | Interoperability necessity | Keep. |
| OBI-D-03 identifier pattern | Policy choice | Keep a profile; revisit exact syntax. |
| OBI-D-04 unique operation identifiers | Semantic necessity given aliases | Keep; revisit alias identity model. |
| OBI-D-05 reference forms | Interoperability necessity | Keep core invariant; simplify scope prose if possible. |
| OBI-D-06 schema dialect | Interoperability necessity | Keep. |
| OBI-D-07 no `$vocabulary` | Interoperability necessity | Keep. |
| OBI-D-08 binding operation integrity | Semantic necessity | Keep. |
| OBI-D-09 binding source integrity | Semantic necessity | Keep. |
| OBI-D-10 transform reference integrity | Semantic necessity if transforms remain | Keep. |
| OBI-D-11 examples validate | Practical quality rule | Reconsider as conformance versus verification/lint. |
| OBI-D-12 SemVer syntax | Interoperability necessity | Keep. |
| OBI-D-13 binding sufficiency | Core practical necessity | Keep and emphasize. |
| OBI-D-14 textual/JSON source content | Representation policy | Revisit array and future-format restriction. |
| OBI-D-15 embedded content self-contained | Portability policy | Revisit explicit carried-base alternative. |
| OBI-D-16 internal schema integrity | Semantic necessity | Keep. |

| Tool rule | Category | Judgment |
|---|---|---|
| OBI-T-01 partial format support | Ecosystem necessity | Keep. |
| OBI-T-02 unknown fields | Forward-compatibility necessity | Keep. |
| OBI-T-03 extensions | Forward-compatibility necessity | Keep. |
| OBI-T-04 version refusal | Interoperability necessity | Keep; express more algorithmically. |
| OBI-T-05 schema diagnostics | Quality guidance | Keep as SHOULD or informative guidance. |
| OBI-T-06 format-specific `ref` | Semantic necessity | Keep. |
| OBI-T-07 input validation | Contract necessity for invokers | Keep. |
| OBI-T-08 output validation | Contract necessity for invokers | Keep. |
| OBI-T-09 binding ordering | Selection policy | Revisit/profile/simplify. |
| OBI-T-10 transform evaluation | Transform-profile necessity | Keep if transforms remain; strengthen undefined/parse rules. |
| OBI-T-11 cycle handling | Schema-processing necessity | Keep. |
| OBI-T-12 operation-name resolution | Semantic necessity | Keep; revisit alias model. |
| OBI-T-13 discovery serving | Discovery-profile necessity | Keep in discovery profile. |
| OBI-T-14 discovery fetching | Discovery-profile necessity | Keep in discovery profile. |
| OBI-T-15 location/content pairing | Source-policy necessity under current model | Simplify the source model if possible. |

## 12. Field-by-field placement analysis

### 12.1. Top-level fields

| Field | Category | If removed | Judgment |
|---|---|---|---|
| `openbindings` | Interoperability necessity | Tools cannot select semantics safely. | Keep. |
| `operations` | Core premise | No portable operation layer remains. | Keep. |
| `sources` | Core factoring/practical necessity | Bindings must duplicate artifact information or gain another target form. | Keep. |
| `bindings` | Core premise for executable interfaces | Documents become contract-only descriptions. | Keep optional. |
| `schemas` | Practical reuse | Schemas must be inlined or externally hosted. | Keep. |
| `transforms` | Practical adaptation | Named reuse disappears; inline transforms could remain. | Keep if transforms remain. |
| `name` | Optional ergonomics | Human presentation worsens. | Keep. |
| `description` | Optional ergonomics | Human documentation worsens. | Keep. |
| `version` | Optional ecosystem metadata | Authors lose a conventional contract-version label. | Keep but clarify non-semantic nature. |

### 12.2. Operation fields

| Field | Category | Judgment |
|---|---|---|
| `input` | Core premise | Keep; consider boolean schemas and omission-only unspecified form. |
| `output` | Core premise | Keep; consider boolean schemas and omission-only unspecified form. |
| `aliases` | Practical identity/ergonomics | Keep for alternate names; redesign or narrow shared-contract claims. |
| `idempotent` | Operational claim | Revisit or remove until precisely scoped. |
| `deprecated` | Annotation | Keep. |
| `description` | Annotation | Keep. |
| `tags` | Annotation | Keep; no core semantics. |
| `examples` | Practical documentation/testing | Keep; reconsider conformance effect. |

### 12.3. Source fields

| Field | Category | Judgment |
|---|---|---|
| `format` | Core target identification | Keep; strengthen decentralized namespace/version convention. |
| `location` | Core target identification | Keep, but reconsider overloaded artifact-versus-service meaning. |
| `content` | Practical portability/offline support | Keep; allow all appropriate JSON root forms. |
| `preference` | Selection shorthand | Strong candidate to remove or move to profile. |
| `description` | Annotation | Keep. |

### 12.4. Binding fields

| Field | Category | Judgment |
|---|---|---|
| `operation` | Core correspondence | Keep. |
| `source` | Core correspondence | Keep. |
| `ref` | Core target selection | Keep format-defined. |
| `inputTransform` | Practical adaptation | Keep if transform profile remains. |
| `outputTransform` | Practical adaptation | Keep if transform profile remains. |
| `preference` | Selection policy | Revisit/profile. |
| `deprecated` | Selection policy/annotation | Keep only with a clearly chosen selection layer. |
| `description` | Annotation | Keep. |

## 13. Redundancy and organization

The specification is thoughtful but repeats normative content and rationale across:

- field tables;
- explanatory prose;
- reference-resolution rules;
- document rules;
- tool rules;
- rule-by-rule rationale;
- schema descriptions.

The repetition helps readers but increases drift risk and makes the core idea appear larger than it is.

### 13.1. Recommended organizational kernel

The normative document could be organized around a smaller set of invariants:

1. **Operation authority** — operation schemas define the caller-facing value contract.
2. **Binding authority** — binding formats define wire behavior and target addressing.
3. **Binding sufficiency** — a binding and source identify a target without hidden lookup.
4. **Context-free resolution** — OBI-defined references do not depend on fetch location.
5. **Boundary enforcement** — invokers validate values at the operation boundary.
6. **Forward compatibility** — versions and unknown fields are processed predictably.

Fields and rules can then be derived from these invariants. Extended rationale can live in design notes or concise "why" callouts without being restated after every rule.

### 13.2. Material that could become profiles or appendices

- HTTP discovery and its IANA registration;
- transform language and runtime semantics;
- binding selection hints;
- canonicalization;
- shared-contract correspondence;
- security processing recommendations;
- format-authoring conventions.

Moving a feature into a profile does not imply making it proprietary or optional in practice. It makes dependency boundaries visible and lets each layer version at the rate its semantics require.

## 14. Missing necessities

### 14.1. Interaction shape

If OpenBindings intends to describe portable operations rather than only portable event values, it needs a minimal interaction model. Possible dimensions include:

- input count: none, one, many;
- output count: none, one, many;
- whether input and output overlap;
- caller and implementation close responsibilities;
- ordering guarantees;
- whether bindings for one operation must share this shape.

This need not import protocol details. A small abstract model could cover request/response, client streaming, server streaming, bidirectional streaming, and event subscription.

### 14.2. Failure contract

An optional operation-level failure map could describe stable error identifiers, detail schemas, and retryability without dictating how HTTP, gRPC, or other formats encode them.

Without it, successful values are portable but failure handling is not.

### 14.3. Minimum equivalence among bindings

The spec should state what an author asserts by attaching two bindings to one operation. At minimum:

- both accept every value admitted by the operation input contract after adaptation;
- both produce only values admitted by the output contract after adaptation;
- both preserve operation-level claims such as idempotency;
- any declared interaction and failure contracts are preserved;
- material differences not represented by the operation contract remain outside the equivalence guarantee.

### 14.4. Schema well-formedness

Add an explicit stable rule for JSON Schema meta-schema validity under the OBI profile. Structural object shape alone is insufficient.

### 14.5. Transform well-formedness and failure

If transforms remain portable core content:

- referenced expressions should parse;
- undefined should have one mandatory outcome;
- evaluation failures should have a defined invocation-error category even if diagnostic details remain tool-defined.

### 14.6. Verification result levels

The spec's partial-verification philosophy needs a standard surface so users can distinguish "valid," "no violation found," and "fully verified."

### 14.7. Format-token identity

Decentralized governance still needs collision resistance and discoverable ownership. A normative third-party naming convention would improve implementability without creating a registry.

### 14.8. Shared-contract identity, if correspondence remains a headline feature

If the project intends stronger meaning than informal name matching, it needs a way to identify the contract, its version, and the operation within it. If not, the specification should say plainly that correspondence is a convention over unverified strings.

## 15. Candidates to keep, simplify, relocate, remove, or revisit

### Keep in the mandatory core

- operation, binding, and source separation;
- caller-facing input/output value contracts;
- operation and binding authority boundaries;
- binding sufficiency;
- internal referential integrity;
- context-free OBI reference resolution;
- JSON Schema dialect and portability profile;
- input/output boundary validation;
- version and unknown-field behavior;
- capability-scoped conformance;
- source embedding as a concept;
- transform environment closure, if transforms remain in core.

### Simplify

- express version refusal as an algorithm/table rather than repeated prose;
- consolidate repeated authority and reference rules;
- consider omission as the sole spelling of unspecified schemas;
- remove source-level preference inheritance;
- simplify `location`/`content` semantics through clearer artifact and endpoint roles;
- provide machine-readable rule capability metadata;
- reduce repeated rule rationales after the normative conformance lists.

### Relocate or identify as profiles

- HTTP well-known discovery;
- binding selection preference and deprecated-tier behavior;
- transform language/runtime, if the project wants a smaller dependency-free semantic core;
- shared-contract correspondence stronger than ordinary aliases;
- canonicalization;
- detailed security processing recommendations.

### Revisit before stabilization

- operation interaction/cardinality omission;
- absence of portable failure contracts;
- behavioral equivalence of multiple bindings;
- aliases as shared-contract identity;
- unregistered/unqualified format tokens;
- object-only schemas;
- object-or-string-only source content;
- embedded artifact self-containment when `location` could provide an explicit carried base;
- malformed transforms remaining document-conformant;
- tool-defined undefined-transform behavior;
- example validity as document conformance;
- `idempotent` semantics;
- numeric preference and mandatory deprecated binding ordering.

### Plausible removal candidates

There are few obvious deletions. The strongest candidates are conditional:

- source-level `preference`, because it is only shorthand and creates inheritance semantics;
- explicit `null` for unspecified operation schemas, if no concrete authoring need justifies the duplicate spelling;
- `idempotent`, if it cannot be narrowed before release;
- normative selection ordering, if selection becomes a separate profile;
- the canonical-form section from the main narrative, though it remains useful as an informative appendix.

## 16. A proposed layered specification model

A clearer architecture could preserve nearly all current capabilities while making their necessity visible.

### Layer A: semantic document core

- operations;
- per-value input/output contracts;
- bindings;
- sources and target identification;
- authority boundaries;
- referential integrity.

### Layer B: mandatory portability profile

- JSON serialization;
- identifier rules;
- JSON Schema dialect/profile;
- context-free reference resolution;
- version handling;
- unknown fields/extensions;
- boundary validation;
- conformance verification vocabulary.

### Layer C: adaptation profile

- input/output transforms;
- JSONata version and closed environment;
- parse and evaluation failure semantics;
- named transform reuse.

### Layer D: selection and annotation profile

- preference;
- deprecation ordering;
- aliases and shared-contract correspondence;
- idempotency or other traits;
- examples and tags.

Some annotations could remain in the core schema while their behavioral profiles are separate.

### Layer E: discovery and publication profile

- media type;
- `/.well-known/openbindings`;
- response behavior;
- redirects and CORS;
- IANA registrations.

This architecture does not require five separate files immediately. Even explicit section-level labeling would clarify which commitments are foundational and which are composable.

## 17. Priority recommendations

Before treating the core specification as stable, resolve these questions in order:

1. **State the exact portability promise.** Is the contract per value, or does it cover the interaction as a whole?
2. **Define the minimum equivalence asserted by multiple bindings.** This is central to "one operation, many bindings."
3. **Decide whether interaction shape and failures belong in core.** Their absence limits practical substitutability more than any existing optional field improves it.
4. **Decide the layering of transforms.** Keep their semantics portable, but make the runtime dependency boundary explicit.
5. **Separate aliases from shared-contract identity.** Either add qualification or narrow the correspondence claim.
6. **Simplify source semantics.** Reassess overloaded `location`, source-level preference, content root restrictions, and embedded-reference bases.
7. **Harden statically knowable validity.** Add schema meta-validity, transform parse-validity, and mandatory undefined behavior.
8. **Make partial verification operational.** Standardize result levels rather than relying on prose distinctions between conformant and unverified.
9. **Move selection policy to a clearly named layer.** Numeric preference and deprecated-tier behavior should not look inherent to operation/binding separation.
10. **Refine or remove idempotency.** Do not let a useful but underspecified hint become a false safety guarantee.

## 18. Open design questions

1. Is OpenBindings primarily a portable value-contract overlay, or a complete protocol-neutral operation interface?
2. Must every binding of one operation have the same interaction pattern?
3. Should failures be modeled as operation results, invocation terminal states, or both?
4. Is a mandatory transform runtime acceptable for all invokers that encounter transforms, or should adaptation be a separately declared profile?
5. Does shared-contract correspondence need verifiable contract identity, or is string-name convention sufficient?
6. Should a document fetched from one location be allowed to carry an explicit base URI for embedded artifacts while remaining context-free?
7. What does a `format` token uniquely identify, and how do third parties prevent collisions without a registry?
8. Should optional examples be capable of making an otherwise usable document non-conformant?
9. What exact guarantee may a consumer derive from `idempotent: true` across principals, time, retries, and binding choices?
10. Which validation result should a user see when a tool verifies every offline rule but declines external fetches or unsupported formats?

## 19. Final assessment

The core specification is not filled with obviously unnecessary material. Most sections exist because a minimal operation/binding sketch quickly encounters real interoperability problems. Its strongest content is the content closest to portable meaning: the operation/binding authority split, binding sufficiency, context-free references, schema-boundary validation, and capability-scoped conformance.

The main opportunity is sharper layering and a more exact statement of the promise. The specification currently standardizes several secondary policies—transform language, discovery wire behavior, selection hints, deprecation ordering, and name-based correspondence—while leaving interaction shape, failures, and binding equivalence largely outside scope. That balance may be correct, but it is not self-evidently correct, and it should be an explicit design conclusion rather than an inherited shape.

The right simplification is therefore not indiscriminate deletion. It is to make the semantic core visibly small, retain the portability rules that protect it, move orthogonal behavior into named profiles where appropriate, and spend normative complexity on the missing guarantees that determine whether two bindings truly implement the same operation.
