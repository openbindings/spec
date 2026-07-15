# OpenBindings Core Analysis: Discussion and Decision Record

## Status and purpose

This is a non-normative working record of conclusions reached while discussing [`openbindings-analysis.md`](openbindings-analysis.md). It is not part of the OpenBindings specification and does not define conformance.

The analysis identifies questions and possible directions. This record captures what the discussion subsequently establishes, including:

- the direction selected;
- the reasoning that supports it;
- its consequences for the specification;
- changes the specification may need;
- details that remain open.

Entries describe design intent before normative wording is written. An entry marked **Agreed direction** records the current conclusion but remains subject to revision through later discussion. The core specification remains authoritative until corresponding edits are adopted.

## Decision index

| ID | Subject | Status |
|---|---|---|
| OBI-AD-001 | Portable operation contract is per-value, not an invocation-shape contract | Agreed direction; specification clarification pending |
| OBI-AD-002 | OpenBindings enables invocation but does not define an invoker | Agreed direction; specification scope correction pending |
| OBI-AD-003 | Portable per-value transforms remain an optional core feature | Agreed direction; specification changes pending |
| OBI-AD-004 | Shared-contract correspondence is qualified operation-name adoption, not contract-document identity | Agreed direction; specification clarification pending |
| OBI-AD-005 | Binding preference and deprecation are author signals, not a core selection algorithm | Agreed direction; specification changes pending |
| OBI-AD-006 | Invocation belongs in an optional project-standard interface, with implementation policy documented separately | Agreed direction; companion interface and documentation work pending |
| OBI-AD-007 | Idempotency is a narrow author-attested operation-effect property, not a runtime safety authorization | Agreed direction; specification clarification pending |
| OBI-AD-008 | Source location is a binding-specification-defined address, not a universal artifact-or-service taxonomy | Agreed direction; specification simplification pending |
| OBI-AD-009 | A source names a decentralized binding specification, not merely an artifact format or implementation handler | Agreed direction; terminology and governance changes pending |
| OBI-AD-010 | OBI-contained schemas must be well-formed JSON Schema 2020-12 schemas | Agreed direction; document-conformance rule pending |
| OBI-AD-011 | Boolean schemas are valid per-value contracts at every OBI schema position | Agreed direction; schema and explanatory changes pending |
| OBI-AD-012 | Omission is the sole representation of an unspecified operation schema | Agreed direction; schema simplification and migration pending |
| OBI-AD-013 | Embedded source content may be any JSON value accepted by its binding specification | Agreed direction; source-schema and prose changes pending |
| OBI-AD-014 | Provided operation examples are positive contract claims whose known mismatch is non-conformant | Agreed direction; conformance clarification pending |
| OBI-AD-015 | Verification uses a three-conclusion model with rule-level evidence, not a linear level ladder | Agreed direction; verification vocabulary and tool rule pending |
| OBI-AD-016 | HTTP well-known discovery is a normative companion specification, not core document semantics | Agreed direction; core extraction and companion specification pending |
| OBI-AD-017 | Successful boundary validation requires the complete reachable schema graph | Agreed direction; validation clarification and invoker guidance split pending |
| OBI-AD-018 | `version` remains an opaque non-empty interface-version label | Agreed direction; metadata clarification and schema tightening pending |
| OBI-AD-019 | JCS remains an optional partial canonical serialization in an informative appendix | Agreed direction; appendix correction and implementation audit pending |
| OBI-AD-020 | Binding preference uses the interoperable signed safe-integer domain | Agreed direction; schema tightening pending |
| OBI-AD-021 | Core names use a narrow exact-match ASCII token grammar that permits leading digits | Agreed direction; identifier grammar clarification pending |
| OBI-AD-022 | Processors interpret only explicitly supported OpenBindings specification versions | Agreed direction; version-processing simplification pending |
| OBI-AD-023 | The core defines no portable failure contract | Agreed direction; scope statement pending |
| OBI-AD-024 | Example-validation conformance is scoped to document-internal schema graphs | Agreed direction; OBI-AD-014 refinement pending |
| OBI-AD-025 | The correspondence verb is "corresponds" project-wide | Agreed direction; core wording and cross-repo vocabulary updates pending |
| OBI-AD-026 | Project binding-specification identifiers use `openbindings.<name>@<rev>` | Agreed direction; example and publication convention pending |

## OBI-AD-001: Portable operation contract is per-value, not an invocation-shape contract

**Status:** Agreed direction; specification clarification pending  
**Date:** 2026-07-12  
**Analysis question:** What does a portable OpenBindings operation promise?

### Context

The current specification says that an operation's `input` and `output` schemas describe individual values and that the selected binding determines whether the interaction is request/response, streaming, bidirectional, pub/sub, or another pattern.

Despite that existing text, the specification's broader language—particularly "portable interface description," "operation contract," and "one operation, many bindings"—can leave a careful reader wondering whether the operation is intended to define a complete, binding-independent invocation signature. The analysis raised exactly that question.

The fact that the intended boundary was not immediately clear is itself useful evidence: the current stance exists, but is not yet stated prominently or precisely enough to prevent readers from inferring a larger promise.

### Agreed direction

An OpenBindings operation is a protocol-independent semantic point of correspondence with optional per-value input and output contracts.

Specifically:

- `input`, when specified, describes each caller-facing value crossing the operation's input boundary.
- `output`, when specified, describes each successful caller-facing value crossing the operation's output boundary.
- The operation does not declare how many input or output values an invocation carries.
- The operation does not declare request/response, client-streaming, server-streaming, bidirectional, pub/sub, or another interaction pattern.
- The operation does not define input closure, output completion, transport framing, scheduling, or other invocation lifecycle mechanics.
- Those mechanics remain authoritative to the selected binding and its binding format.

A binding attached to an operation is an **author-declared realization** of that logical operation. Attaching several bindings expresses the author's claim that each realizes the same logical capability through a different concrete target.

OpenBindings does not prove semantic equivalence or general substitutability among those bindings. It mechanically enforces only the portable facts represented in the OBI, including value-schema boundaries, reference integrity, and any precisely defined operation-level claims.

### Why this direction fits OpenBindings

#### 1. A signature never proves semantic substitutability

Two functions can have identical signatures while performing unrelated calculations. A richer invocation signature could establish more mechanical compatibility, but it still could not prove that two bindings have equivalent meaning, effects, failures, or suitability for a caller's purpose.

Semantic correspondence ultimately rests on author intent, documentation, tests, shared conventions, human review, and agent or tool reasoning. OpenBindings should enable that judgment without claiming to settle it.

#### 2. The smaller contract is still useful

The operation provides a stable place to:

- name a logical capability independently of protocol;
- define portable schemas for values crossing its boundary;
- attach descriptions, examples, and author claims;
- enumerate concrete realizations across binding formats;
- let tools discover, index, validate, select, and invoke supported bindings.

That is meaningful interoperability even though invocation mechanics remain binding-specific.

#### 3. Binding formats already own interaction semantics

OpenAPI, AsyncAPI, gRPC, MCP, and other formats define different interaction models. Pulling their cardinality and lifecycle semantics into the operation layer would require OpenBindings to maintain a cross-format invocation ontology.

Leaving interaction mechanics with the binding preserves the core authority boundary: OpenBindings describes the logical operation and its portable value boundary; the binding format describes how that operation is realized.

#### 4. It minimizes secondary specification baggage

An operation-level interaction model would require decisions about cardinality, optional values, closure, completion, half-closure, subscriptions, cancellation, error termination, format mapping, binding compatibility, transforms across cardinality changes, and conformance testing.

The per-value stance avoids that machinery while retaining the central operation-to-binding correspondence.

### Important qualification

Two bindings grouped under one operation are not merely unrelated targets that happen to share schemas. Their grouping is an author assertion that they realize the same logical operation.

The specification should therefore avoid both of these misleading extremes:

- **Too weak:** bindings merely correspond because their values have similar schemas.
- **Too strong:** bindings are guaranteed to be semantically equivalent or mechanically interchangeable in every caller-facing respect.

The intended position is:

> Each binding is an author-declared realization of the operation and must honor every portable contract fact the operation actually expresses. Semantic equivalence beyond those represented facts is not established by OpenBindings conformance.

### Practical consequences

#### For callers and invokers

- A caller that requires a particular interaction pattern may need to constrain or inspect binding selection.
- A tool may expose a sufficiently general invocation interface capable of representing several binding patterns.
- A tool may instead expose binding-specific or selected-binding-specific APIs.
- The core specification does not require one binding-independent ergonomic method signature for an operation.

#### For binding selection

- Binding selection chooses among author-declared realizations, not among targets whose complete behavioral equivalence has been proven.
- A tool's ability to act on a binding includes its ability to support that binding's invocation mechanics.
- Selection preferences do not imply that changing bindings preserves every unrepresented behavioral property.

#### For code generation

- Core-level code generation can produce value types, validators, operation indexes, binding inventories, and generic invocation surfaces.
- An ergonomic concrete call signature may require selecting or understanding a binding.
- OpenBindings should not imply binding-neutral code generation beyond the facts represented by the operation.

#### For transforms

- Core binding transforms operate per value and reconcile value shape.
- They are not required to convert one invocation pattern or cardinality into another.
- Bindings whose portable value boundaries cannot be reconciled per value may not be appropriate realizations of one operation, even if a human considers their broader capabilities related.

#### For shared contracts

- Matching an operation name or alias provides a correspondence claim and a portable value contract.
- It does not independently establish full behavioral substitutability.
- Humans and tools may use descriptions, examples, schemas, provenance, tests, and external conventions to assess stronger compatibility.

### Required specification clarification

The specification should state this stance early and consistently enough that readers do not have to infer it from later streaming language.

Likely clarification points include:

1. **Abstract or overview** — describe the operation contract explicitly as a semantic operation plus per-value input/output contracts.
2. **Positioning and scope** — distinguish portable value-boundary facts from binding-defined invocation mechanics.
3. **Terminology: Operation** — say directly that an operation is not a complete binding-independent invocation signature.
4. **Operations** — retain and strengthen the rule that schemas apply to individual values and cardinality belongs to the binding.
5. **Bindings** — describe bindings as author-declared realizations and define exactly what "honor the contract" means.
6. **Binding selection** — avoid implying that selected bindings are guaranteed to be interchangeable in unrepresented respects.
7. **Conformance rationale** — distinguish the portable meaning of the schemas from optional runtime enforcement, per OBI-AD-002; when validation is performed, it establishes represented boundary facts, not semantic equivalence.

### Desired wording characteristics

The normative specification should state the positive model directly. It should not need to enumerate or debate alternative models.

The clarification should be:

- short enough to remain visible;
- positive rather than defensive;
- repeated only where needed for semantic precision;
- explicit about per-value schemas;
- explicit about binding authority over interaction mechanics;
- precise about author declaration versus conformance proof.

Candidate concise language for later refinement:

> An operation is a protocol-independent semantic unit with optional schemas for each value crossing its caller-facing input and output boundaries. It does not declare the number or lifecycle of those values; the selected binding determines the interaction pattern. A binding is an author-declared realization of the operation. OpenBindings conformance establishes the portable facts represented by the operation, not general semantic equivalence among its bindings.

This is drafting material, not adopted specification text.

### What this direction does not decide

This decision does not yet settle:

- whether the term "contract" should be qualified consistently as "value contract" or "value-boundary contract";
- whether any existing claim about bindings as alternatives should be softened or merely clarified;
- how much binding-selection guidance callers need when interaction mechanics differ;
- whether shared-contract correspondence needs stronger identity or qualification;
- whether a separate processing or SDK interface should define a general invocation abstraction;
- whether particular operation-level claims beyond schemas, such as idempotency, are sufficiently precise to apply across every binding.

Those questions should be handled in their own entries as the analysis discussion proceeds.

## OBI-AD-002: OpenBindings enables invocation but does not define an invoker

**Status:** Agreed direction; specification scope correction pending  
**Date:** 2026-07-13  
**Analysis question:** Does the core specification intentionally define invocation, or only an interface document that downstream implementations can use to invoke bindings?

### Context

The OpenBindings model is intentionally actionable. Operations identify logical capabilities, bindings identify concrete realizations, sources locate binding artifacts or services, and transforms can reconcile value shapes. A downstream tool with support for the selected binding format can use that information to invoke the underlying target.

Invocation is therefore an intended use of an OBI, not an accidental byproduct of unrelated metadata.

The current specification nevertheless crosses between two distinct responsibilities:

1. defining an invocation-enabling interface description; and
2. defining part of the behavior of a conforming invoker.

Its positioning says that binding formats describe how to invoke their endpoints and that invocation and runtime semantics remain processor concerns. Elsewhere, OBI-T-07 and OBI-T-08 require invoking tools to perform runtime JSON Schema validation, prescribe validation relative to transform application, define certain conditions as invocation errors, and partly constrain when static failure should be detected relative to a side-effecting call. The informative request lifecycle reinforces the picture of a generic invocation pipeline.

The result is a scope ambiguity. The specification denies ownership of invocation in the broad sense while normatively owning selected portions of it.

### Agreed direction

OpenBindings is **invocation-enabling, not invoker-defining**.

The core specification should define a portable document whose bindings are actionable by downstream tools. It should not define a binding-neutral invocation API, lifecycle, or runtime failure model, and it should not require a tool to perform runtime contract enforcement merely because the tool invokes a binding.

Specifically:

- An operation defines the portable meaning of its caller-facing per-value schemas.
- A binding identifies an author-declared realization of the operation.
- A source and binding-format-specific `ref` provide the information from which a capable implementation can locate and act on that realization.
- The binding format remains authoritative over interaction mechanics, wire behavior, and the classification of its success and failure outcomes.
- Implementations remain authoritative over whether and when to invoke, whether to validate values dynamically, how to expose errors, how to obtain credentials, and how to handle retries, cancellation, resource limits, and other runtime policy.
- When the core standardizes the interpretation of declarative content—such as JSON Schema dialect rules or JSONata evaluation—it defines what that content means when processed. It does not thereby prescribe a complete runtime pipeline.

The intended distinction is:

> OpenBindings defines enough information for an implementation to invoke a binding, but it does not define the invoker.

### Why this direction fits OpenBindings

#### 1. It matches the stated authority boundary

OpenBindings sits above binding formats. Those formats already own request/response, streaming, pub/sub, success and failure classification, transport behavior, and addressing conventions. Implementations own operational policy. Defining a partial generic invoker in the core blurs both boundaries.

#### 2. Contract meaning does not require mandatory runtime enforcement

A schema can define the values an operation admits or guarantees without requiring every caller to execute a dynamic validator. Tools may use the same contract for documentation, code generation, static analysis, tests, gateways, runtime checks, agent planning, or human review.

Mandating runtime JSON Schema validation is an implementation requirement, not a prerequisite for the document to carry a portable contract.

#### 3. A partial invocation model creates pressure for a complete one

Once the core defines invocation errors and required runtime sequencing, adjacent questions naturally follow: error representation, side effects, partial stream failure, cancellation, credentials, retries, timeouts, and fallback after a selected binding fails. OBI-AD-001 deliberately leaves those mechanics to bindings and implementations.

Avoiding a partial invoker prevents the core from acquiring that secondary specification baggage.

#### 4. Invocation failure is not currently an interoperable OpenBindings surface

The core defines no binding-neutral invocation API or portable error value through which an "invocation error" is exchanged. Prescribing that an internal condition become an invocation error therefore constrains implementations without establishing corresponding wire interoperability.

The core can instead define failures within the semantics it owns—for example, that a transform evaluation fails—then leave the consuming tool's response to that failure to the tool and binding context.

### Consequences for transforms

This direction separates portable transform semantics from invoker behavior.

If transforms remain in OpenBindings, the core may still define:

- that `inputTransform` maps one caller-facing operation input value toward the binding's source-facing value;
- that `outputTransform` maps one source-facing output value toward the caller-facing operation value;
- that transforms apply per value and do not alter interaction cardinality or lifecycle;
- the expression language and evaluation environment;
- what counts as a transform result or transform-evaluation failure.

The core should not need to define:

- that a transform failure is an "invocation error";
- how such a failure is surfaced;
- whether another binding is attempted;
- whether both transforms are parsed before a source is driven;
- a general request lifecycle around transform application.

Under this direction, a JSONata undefined result should be described as failure to produce the JSON value required of a transform, and therefore as a **transform-evaluation failure**. It should not be given additional core-level invocation semantics. Syntax and dynamic evaluation errors belong to the same transform-evaluation category.

Preflight parsing remains sensible implementation guidance, especially before a side-effecting call, but it is not necessary to define transform meaning or document portability. A transform-specific "ready" conformance level should not be introduced. If the specification later adopts general verification levels for all statically checkable content, transform parse validity can be considered within that broader design.

This decision does **not** yet determine whether transforms remain in the core document model, move to a profile, or are removed. It narrows that later decision to the value of portable per-value adaptation and the cost of standardizing its expression language; it removes generic invocation behavior from the justification and scope.

### Consequences for schemas and validation

The operation schemas retain normative portable meaning:

- `input` describes the caller-facing values admitted by the operation contract;
- `output` describes caller-facing successful values guaranteed by the operation contract;
- the JSON Schema dialect and OBI-specific schema interpretation rules must remain consistent across tools that process those schemas.

The core should not require every invoking tool to validate those values dynamically. A tool that claims to validate OBI operation values must apply the OBI schema semantics consistently, but invocation alone should not trigger a mandatory validation capability.

This makes the distinction between the following explicit:

- **contract semantics:** which values the document declares valid; and
- **contract enforcement:** whether a particular implementation checks those values at runtime.

Example validation remains a document-integrity question because examples are values embedded in the OBI itself. It does not imply that calls made using the OBI must be dynamically validated.

### Consequences for other features

#### Binding selection

Fields such as `preference` and `deprecated` may still carry declarative selection meaning, but whether the core should impose a selection algorithm is a separate decision. Invocation is not by itself a justification for standardizing runtime selection policy.

#### Sources and references

Bindings and sources must remain sufficiently precise for capable tools to locate and interpret concrete realizations. Actionability is part of the document's intended utility even though OpenBindings does not define what a tool subsequently does with the target.

#### Security

Security considerations for fetching, resolving, and evaluating untrusted content remain useful because those are foreseeable ways of processing an OBI. They should distinguish portable semantic restrictions, such as a closed transform environment if transforms remain, from implementation-specific runtime mitigation policy.

### Required specification changes

Likely changes include:

1. **Positioning and scope** — state positively that OpenBindings supports downstream invocation without defining an invoker, and remove the apparent contradiction between invocation being out of scope and selected invocation behavior being mandatory.
2. **Operations and schemas** — preserve the meaning of the value contracts while separating that meaning from mandatory dynamic validation.
3. **Bindings and sources** — describe actionability without promising a binding-neutral invocation interface.
4. **Transforms** — define transform direction and evaluation semantics without defining consuming invocation behavior.
5. **Conformance** — remove or recast OBI-T-07 and OBI-T-08 so invocation does not itself impose runtime JSON Schema validation. Conditional rules may govern tools that explicitly claim to validate operation values.
6. **Error language** — replace core uses of "invocation error" where the specification owns only schema-processing or transform-evaluation semantics.
7. **Request lifecycle** — remove it from the core publication, move it to implementation guidance, or retain it only as a clearly non-prescriptive illustration after the normative scope is corrected.
8. **Conformance rationale** — remove the claim that mandatory runtime validation is required for document portability.

### Desired wording characteristics

The specification should not avoid the word "invoke." Invocation is an important intended use and explains why bindings, sources, and transforms matter. The wording should instead distinguish enabling an activity from standardizing that activity.

Candidate concise language for later refinement:

> An OBI is designed to make an interface actionable by downstream tools, including invokers. OpenBindings defines the portable meaning of the document and the correspondence between operations and concrete bindings; it does not define a binding-neutral invocation interface, require runtime contract enforcement, or govern binding-defined interaction mechanics.

This is drafting material, not adopted specification text.

### What this direction does not decide

This decision does not yet settle:

- whether transforms belong in the core document or a separate profile;
- whether JSONata is the right portable transform language;
- whether selection hints and ordering rules belong in core;
- whether `idempotent` is precise enough to remain an operation-level claim;
- whether a separate invoker profile or SDK contract should ever be standardized;
- which general verification levels, if any, tools should be able to claim.

Those questions should be handled separately rather than reintroduced indirectly through core invocation rules.

## OBI-AD-003: Portable per-value transforms remain an optional core feature

**Status:** Agreed direction; specification changes pending  
**Date:** 2026-07-13  
**Analysis question:** Should OpenBindings standardize transforms, where should they live, and who defines the binding-side values they transform?

### Context

Bindings that realize the same logical operation frequently expose different value shapes: field names differ, envelopes are introduced or removed, and protocol-native result structures do not necessarily match the operation's clean caller-facing contract. Without a portable adaptation mechanism, authors must either require every binding to expose an already matching value shape or rely on private adapter configuration carried outside the OBI.

Transforms address this problem by mapping values between the operation boundary and a concrete binding. The discussion separated four questions:

1. whether transform portability can be composed with binding-format authority;
2. whether the feature is useful enough to retain;
3. whether it belongs in the core document or a separate profile; and
4. whether the JSONata language contract is precise enough.

All four now have an agreed direction.

### Agreed direction

OpenBindings retains optional, portable, per-value binding transforms in the core document model.

Specifically:

- `inputTransform` and `outputTransform` remain optional binding fields.
- The top-level `transforms` map remains available for named reuse; inline transforms remain available for local expressions.
- A document that declares no transforms imposes no transform evaluator requirement on any tool.
- Transform support is conditional on the capability being exercised, not a baseline requirement for all OBI processors.
- Transforms reconcile individual JSON value shapes. They do not define or alter interaction cardinality, framing, lifecycle, completion, or other binding-owned mechanics, per OBI-AD-001.
- Transform evaluation defines declarative value-mapping semantics, not an invocation runtime or error surface, per OBI-AD-002.

### Compositional portability and authority

Transform portability is compositional:

1. OpenBindings defines the operation-side value, transform direction, expression language, evaluation environment, and result requirements.
2. The binding format's governing specification or convention defines the binding-side input and output value representations.
3. A capable implementation combines those two semantic layers.

The OpenBindings project does not need to define OpenAPI-, gRPC-, MCP-, or other third-party format mappings. The relevant authority may instead be:

- the upstream format specification;
- an independent companion specification;
- a community convention;
- a vendor profile;
- an established implementation convention; or
- the OpenBindings project where it authors a format or voluntarily publishes a supported convention.

This follows the same general authority boundary as `bindings[*].ref`: the core defines the field's role while the binding format defines the format-specific semantics needed to use it.

A binding format that does not define a JSON value representation at its transform boundary cannot provide portable transform semantics for that boundary. That limitation belongs to the format or its available conventions; it does not invalidate transforms as a core facility or require the OpenBindings project to fill the gap.

Where several incompatible value-boundary conventions exist, format-token governance should make the governing convention distinguishable. The core need not create or maintain a registry to do so; authority remains with the relevant format communities, as elsewhere in OpenBindings.

### Why transforms remain

#### 1. They solve a problem created directly by one operation having many bindings

Heterogeneous bindings often differ in representation even when authors intend them to realize the same operation. A portable shape adapter preserves one clean operation value contract without requiring wire artifacts to be rewritten or private adapters to be duplicated across tools.

#### 2. The smaller per-value feature is sufficient

OBI-AD-001 removes the expectation that transforms bridge invocation patterns. The feature only needs to map one JSON value to another. That boundary is useful and implementable without defining a cross-format invocation ontology.

#### 3. Optional core fields are lighter than a transform profile

A separate profile would require profile identity, declaration, versioning, negotiation, and conformance rules. Capability-scoped processing already allows parsers, indexers, renderers, and documents without transforms to avoid a transform runtime entirely.

Keeping the optional fields in the core therefore imposes less total specification machinery while preserving one shared interoperable representation when transforms are used.

#### 4. One common language is necessary for portable expressions

Allowing arbitrary transform languages would move evaluator selection into every document and fragment the common implementation floor. Retaining one language keeps the feature portable and keeps the document shape small.

The selected language remains JSONata. OpenBindings 0.2 pins the JSONata 2.1 language rather than treating the entire evolving 2.x line as one language; the precise target and result contract are recorded below.

### Consequences for the specification

The core should say directly that:

- the operation-facing side of a transform is defined by the operation contract;
- the source-facing side is defined by the binding format's authority;
- a format lacking a shared source-facing value representation cannot promise portable transform behavior;
- this limitation does not make the OBI document invalid and does not require all tools to support the binding;
- transform evaluation applies per value;
- transforms do not define invocation behavior.

The specification should avoid suggesting that the OpenBindings project itself must publish every format mapping. Non-normative format guides may remain useful records of reference-tool conventions without becoming core authority.

### Settled transform-evaluation scope

The discussion has also established the following direction:

- Evaluation must produce a JSON value to produce a transform result.
- JSONata undefined is not a JSON value and therefore represents transform-evaluation failure rather than omission, `null`, or a cardinality change.
- Syntax errors and dynamic expression errors are likewise transform-evaluation failures.
- The core does not prescribe how a consuming tool surfaces or reacts to such a failure.
- Preflight parsing is useful implementation guidance but not part of transform meaning and does not justify a transform-specific verification level.
- The evaluation environment remains closed against host or tool extensions, because environment-specific extensions would make the expression non-portable.

The result-domain rule includes non-JSON JSONata values such as functions: they are not successful transform results.

### JSONata language and result contract

The broad choice of JSONata as the single transform language and its precise compatibility target are agreed.

The current specification says that "JSONata 2.0" denotes the entire 2.x major line and uses the documentation plus the JavaScript reference implementation, at SHOULD strength, to resolve ambiguity. That is not a fixed interoperability target:

- later 2.x releases can add syntax and functions that earlier 2.x implementations do not support;
- maintenance releases can correct observable evaluation behavior;
- alternative language implementations advertise support for different points in the 2.x line;
- a SHOULD-level reference-implementation tie-breaker still permits conforming tools to disagree where the prose is ambiguous.

OpenBindings 0.2 therefore adopts the following contract:

1. **Pinned language:** OpenBindings 0.2 uses the JSONata 2.1 language. The transform language version is bound to the OpenBindings specification version; no per-document language-version field, language registry, or transform profile is introduced.
2. **Corrected behavioral target:** The versioned JSONata 2.1 documentation defines the language. Where that documentation leaves observable behavior ambiguous, or where the initial 2.1.0 implementation was corrected within its maintenance line, the JavaScript reference implementation's 2.1.1 behavior governs. This tie-breaker is normative rather than SHOULD-level.
3. **Evaluator implementation freedom:** A tool may use a later, securely maintained evaluator package or an independent implementation, but its OpenBindings 0.2 transform capability must implement the pinned 2.1 language and governing behavior. Features added after JSONata 2.1 are not part of the OpenBindings 0.2 transform language. A later OpenBindings specification version may deliberately adopt a later JSONata language target.
4. **JSON result domain:** A successful transform evaluation produces exactly one JSON value per RFC 8259: `null`, a boolean, number, string, array, or object. JSONata undefined, a function, or any other non-JSON result is a transform-evaluation failure. An array is one JSON value; this rule does not reinterpret its elements as multiple operation values.
5. **Evaluation failures:** Syntax errors and dynamic evaluation errors are transform-evaluation failures, as is failure to produce a JSON result. The core does not prescribe the consuming tool's runtime response.
6. **Closed environment:** The evaluation environment remains closed as described above. Tool- or host-specific functions are not available to document-supplied expressions.
7. **Complete standard library:** The pinned JSONata 2.1 standard library remains available, including nondeterministic functions. Their authored use does not violate conformance, but the portability guarantee concerns correct evaluation semantics rather than deterministic or byte-identical output for a fixed input.

JSONata 2.1's nullish-coalescing operator is particularly useful under the explicit undefined-result rule: an author can deliberately replace an absent value rather than accidentally yield no transform result. This practical benefit, together with 2.1's established implementations, justifies the higher floor over JSONata 2.0.

The implementation cost is real but does not alter the specification decision. Existing evaluator choices must be checked or replaced as needed, and reference implementations should share a transform corpus covering the 2.1-only syntax, undefined, non-JSON results, sequences, and representative edge cases.

### Required specification changes

Likely changes include:

1. **Transforms** — retain the existing fields while separating operation-side and format-defined binding-side authority.
2. **Scope** — identify transforms as optional portable adaptation rather than invocation machinery.
3. **Evaluation semantics** — define transform success and failure without prescribing invocation consequences.
4. **Language reference** — replace the rolling "2.x" interpretation with the pinned JSONata 2.1 language and 2.1.1 behavioral target.
5. **Conformance rationale** — explain capability-scoped evaluator obligations without requiring every tool to ship JSONata.

### What this direction does not decide

This decision does not make the OpenBindings project responsible for third-party binding-format mappings, create a format registry, define a generic invoker, prove that a transform maps every value admitted by one schema into a value admitted by another, or choose the concrete evaluator library used by any implementation.

Those remain external authority, implementation, or static-analysis concerns as applicable.

## OBI-AD-004: Shared-contract correspondence is qualified operation-name adoption, not contract-document identity

**Status:** Agreed direction; specification clarification pending  
**Date:** 2026-07-13  
**Analysis question:** Are operation aliases sufficient for shared-contract correspondence, or does OpenBindings need explicit contract identity, version, and provenance?

### Context

The current specification gives an operation one primary key and any number of aliases, all of which resolve to the same operation in one flat, document-unique namespace. It presents aliases as serving rename continuity, alternate consumer names, and adoption of a shared contract's operation name.

The analysis initially treated those as three potentially overloaded jobs and questioned whether an unqualified string could support shared-contract identity. Actual project usage clarifies the intended model: published interfaces use qualified operation names such as `openbindings.binding-invoker.invokeBinding`, and implementations adopt those names as keys or aliases. A consumer interested in a particular contract separately holds or chooses the reference OBI and compares corresponding operations.

This is operation-name adoption and structural or tool-evaluated compatibility, not a declaration that identifies and depends on one exact contract document.

### Agreed direction

OpenBindings retains operation keys and aliases as one flat resolution namespace. It does not add a separate `satisfies`, `implements`, contract-URI, contract-version, or content-hash structure.

Specifically:

- An operation's key and aliases remain equal identifiers for name resolution.
- The reason an additional name exists—rename continuity, a consumer-facing synonym, or adoption of a shared name—does not change its resolution semantics.
- Adopting another operation's published identifier is an author assertion that the operations semantically correspond.
- Name adoption does not identify a particular contract document or document version.
- Name adoption does not prove schema compatibility, behavioral equivalence, ownership, authorization, trustworthiness, or substitutability.
- A consumer that requires compatibility assesses the operation against a separately chosen reference OBI using its own comparison policy.
- Shared operation identifiers intended for cross-document use should be qualified under a publisher-controlled or otherwise collision-resistant namespace and should include enough interface scope to avoid common-name collisions.
- A published shared identifier represents a continuing semantic operation. An intentionally incompatible semantic replacement should receive a new identifier; compatible evolution may retain the existing identifier and be assessed against the relevant reference contract.

The resulting model is:

> OpenBindings standardizes author-declared correspondence by shared operation name. Contract discovery, compatibility judgment, provenance, and trust compose externally.

### Why one alias mechanism is sufficient

#### 1. The three uses have the same operation-level meaning

Rename aliases, established consumer names, and shared contract names differ in motivation, but all assert the same fact needed by core processing: the additional identifier resolves to this operation.

A separate field would duplicate namespace and resolution rules unless OpenBindings assigned the classes different behavior. The core requires no such behavioral distinction.

#### 2. Correspondence is per operation, not an atomic whole-interface declaration

An implementation may correspond to one operation from an interface, several operations from it, or operations from several interfaces. Multiple qualified aliases naturally express this without defining whole-document implementation rules or all-or-nothing interface conformance.

This fits OBI-AD-001: represented compatibility remains per semantic operation and per-value contract, while stronger substitutability stays outside the core claim.

#### 3. The consumer already selects the compatibility target

A consumer asking whether an implementation meets a particular need starts with the contract it cares about. It can pair operations by shared identifier and compare the represented schemas, claims, descriptions, or other material according to its policy.

The implementation does not need to embed a fetchable reference to every contract document a consumer might use for that comparison.

#### 4. Document identity would create a second subsystem

Adding contract URIs or exact identities would require decisions about canonical document identity, redirects, retrieval, version selection, compatibility across versions, immutable versus mutable references, availability, hashes, trust, and whole-interface versus per-operation claims.

Those mechanisms would still not prove semantic correctness. They would make a claim more specifically addressable, but would not establish that the claimant honors it.

#### 5. Qualified names address the ordinary collision problem

Bare names such as `get`, `list`, or `create` are poor shared identifiers. Names qualified by publisher and interface scope, such as `openbindings.key-value-store.get`, can coexist in one document and function like fully qualified symbols in programming-language and schema ecosystems.

The core need not create a registry. Namespace control and collision resistance remain an authoring and ecosystem-governance responsibility.

### Terminology

The current verb **satisfies** is too strong when triggered by name adoption alone.

The specification should distinguish three ideas:

1. **Correspondence claim:** the candidate adopts the reference operation's identifier as a key or alias.
2. **Represented compatibility:** a tool compares the two operations under a stated policy and finds their represented contracts compatible.
3. **Semantic satisfaction or substitutability:** a broader conclusion involving author intent, behavior, effects, prose, tests, trust, or external conventions.

Core language should use **corresponds to** or **claims correspondence with** for the first idea. It may use **compatible with** only when a comparison policy and result are in view. It should not define alias adoption alone as proof that an operation **satisfies** another contract.

Project documentation may continue to use “satisfies” informally if it explicitly states this narrower author-asserted meaning, but the normative core should prefer the more exact correspondence terminology.

### Accepted limitations

This design deliberately does not provide:

- discovery of a contract document from an operation identifier alone;
- cryptographic or registry-backed ownership of a namespace;
- prevention of false or malicious correspondence claims;
- an exact contract-version dependency;
- a core compatibility algorithm;
- automatic proof of behavioral substitutability.

External catalogs may map qualified operation names to contract documents. Trust systems may authenticate publishers. Compatibility tools may compare against exact versions. None of those require additional core document fields.

### Required specification changes

Likely changes include:

1. **Positioning** — retain vendor-independent correspondence as a feature, but describe it as shared operation-name adoption rather than contract identity.
2. **Terminology** — replace the current definition of alias-based “satisfaction” with author-declared correspondence.
3. **Operations** — keep the flat namespace and equal key/alias resolution, while making the qualified-name convention concrete and visible.
4. **Compatibility language** — state that consumers choose a reference OBI and that comparison remains tool-defined.
5. **Version language** — make clear that a shared operation name does not select a contract document version.
6. **Conformance** — retain deterministic name resolution and collision prevention; do not attempt to verify the truth of correspondence claims.
7. **Examples** — use qualified shared identifiers rather than short examples such as `tasks.create` where the example is intended to demonstrate ecosystem-wide correspondence.

### Candidate concise language

> An operation may adopt a shared operation identifier as its key or an alias. Adoption is an author assertion that the operations correspond; it does not identify a particular contract document or version and does not establish compatibility or semantic equivalence. Consumers that require compatibility compare the operation with a chosen reference interface. Publishers of identifiers intended for cross-document use should qualify them under a namespace they control.

This is drafting material, not adopted specification text.

### What this direction does not decide

This decision does not define the compatibility algorithm tools use, mandate one global qualification syntax, create a namespace registry, or prevent an external profile from adding resolvable contract references for ecosystems that need them.

## OBI-AD-005: Binding preference and deprecation are author signals, not a core selection algorithm

**Status:** Agreed direction; specification changes pending  
**Date:** 2026-07-13  
**Analysis question:** What binding-selection meaning belongs in the core when one operation has several bindings?

### Context

The current specification defines preference at both the source and binding levels. A source preference is inherited by its bindings unless a binding overrides it. It also defines a partial selection algorithm: a tool constructs a candidate set, ranks every non-deprecated binding ahead of every deprecated binding, should rank higher effective preference within each tier, and chooses among remaining ties using tool-defined behavior.

The fields contain useful author intent, but the algorithm crosses the boundary established by OBI-AD-002. OpenBindings enables tools to discover and act on bindings; it does not define a general invoker. Which bindings a tool can use, which policies apply, whether a caller selected one explicitly, and whether cost, latency, credentials, interaction shape, locality, or other concerns dominate are all tool- or interface-level matters.

The source-level inheritance rule also reveals a useful distinction between an authoring convenience and interchange semantics. An authoring tool may let an author assign one preference to a source and then materialize that value onto every affected binding. The target document does not need to preserve the shorthand or make readers compute a nonlocal effective value.

### Agreed direction

OpenBindings retains `preference` and `deprecated` on individual bindings as standardized author signals. It does not define a binding-selection algorithm, and it removes source-level preference inheritance.

Specifically:

- `bindings[*].preference` is an optional ordinal expression of the author's preference among bindings of the same operation. Higher values express stronger preference.
- Absence of `preference` expresses no special preference and is not equivalent to any numeric value. OBI-AD-020 defines the field's exact numeric representation.
- `bindings[*].deprecated: true` states that the author recommends migration away from the binding and ordinarily does not recommend it for new use.
- The core does not mandate any ordering relationship between `deprecated` and `preference`.
- A tool decides whether and how either signal contributes to selection. Explicit caller choice or tool policy may override both.
- The core does not define candidate-set construction, filtering, fallback, tie-breaking, retries, or what happens after a selected binding cannot be used.
- `sources[*].preference` and its inheritance and override rules are removed.
- Authoring tools remain free to offer source-wide preference as an editing convenience and expand it into binding-local values when producing an OpenBindings document.
- A dedicated invoker contract or ecosystem profile may define a deterministic selection policy for its own consumers.

The resulting model is:

> The author annotates bindings; the consumer selects them.

### Why retain the binding-level signals

#### 1. Author intent remains valuable without becoming an algorithm

An interface author often knows which realization is the normal, modern, economical, or otherwise preferred path. Preserving that signal improves generated documentation, interactive choice, and default behavior in tools that elect to honor it.

A common vocabulary is useful even when the final decision remains local. Without standardized fields, every ecosystem would invent incompatible annotations for the same basic author intent.

#### 2. Selection depends on information outside the document

A tool may support only some formats, lack credentials for one source, require a particular interaction pattern, enforce deployment policy, or optimize for user-selected concerns. The current algorithm therefore cannot produce a universal result: candidate membership is already tool-defined, preference ordering is only recommended, and ties remain tool-defined.

Fully deterministic selection would require substantially more policy. That would increase, rather than resolve, the core's involvement in invocation.

#### 3. Bindings express correspondence, not proven interchangeability

Per OBI-AD-001, multiple bindings of an operation are author-declared realizations of the same semantic operation, but OpenBindings does not prove that changing between them preserves every unrepresented behavioral property. A universal selector would imply more mechanical interchangeability than the core contract establishes.

#### 4. Deprecation and preference are different dimensions

Deprecation is lifecycle guidance. Preference is relative author choice. A deprecated binding will often be disfavored, but prescribing that it always loses can be wrong when it is the only usable binding, when a caller explicitly requests it, or when a specialized tool understands why it remains present.

Keeping the signals independent avoids embedding one universal migration policy in the data model.

### Why remove source-level preference

Source-level preference is meaningful as compact author input, but it adds no information that cannot be represented on the bindings themselves.

Keeping it in the interchange format would require:

- inheritance and override semantics;
- a nonlocal calculation to determine a binding's effective value;
- care when bindings are copied, moved, or retargeted to another source;
- separate schema and prose surface for an authoring shorthand;
- decisions about how future source- and binding-level annotations compose.

Materializing preference at each binding makes the final meaning local and explicit. Repetition in a generated or tool-maintained target artifact is a smaller cost than permanent inheritance semantics in the core.

The strongest argument for retaining source preference is ergonomics: an author may genuinely prefer one deployment or protocol source across many operations, and repeating the value can be noisy in hand-authored documents. This remains a legitimate authoring-tool feature. It does not require a second normative location for the resulting selection hint.

### Consequences for tools

- Documentation and discovery tools may display, group, or sort bindings using the two signals.
- An invoker may combine them with format support, source reachability, credentials, cost, latency, interaction mechanics, caller policy, and explicit selection.
- A deprecated binding remains discoverable and actionable; deprecation alone does not make the document or binding invalid.
- A tool that advertises a particular automatic-selection policy must document that policy outside the core OpenBindings conformance claim.
- The project's operation-invoker interface may define stronger selection behavior for that interface without placing the policy in the core format.

### Required specification changes

Likely changes include:

1. **Sources** — remove `sources[*].preference` and all effective-preference inheritance language.
2. **Bindings** — retain `preference` and `deprecated`, but define them as author signals rather than inputs to a core algorithm.
3. **Conformance** — remove OBI-T-09's candidate-set construction, deprecation tier, preference ranking, and tie behavior.
4. **Positioning** — state succinctly that selection policy belongs to consumers, tools, or dedicated invoker contracts.
5. **Examples** — put preference explicitly on bindings and avoid examples that depend on source defaults.
6. **Schema** — remove source-level `preference`; constrain binding-level `preference` to the signed safe-integer domain defined by OBI-AD-020.

### Candidate concise language

> `preference` is an optional author signal among bindings of the same operation; higher values express stronger preference. `deprecated: true` signals that the author recommends migration away from the binding. Tools decide whether and how to use either signal when selecting bindings. OpenBindings defines no binding-selection algorithm.

This is drafting material, not adopted specification text.

### What this direction does not decide

This decision does not define a tool's automatic-selection policy, fallback behavior, tie-breaking, retry behavior, explicit-binding API, or treatment of a binding that fails at runtime. OBI-AD-020 subsequently settles the numeric domain without changing those boundaries.

## OBI-AD-006: Invocation belongs in an optional project-standard interface, with implementation policy documented separately

**Status:** Agreed direction; companion interface and documentation work pending  
**Date:** 2026-07-13  
**Analysis question:** Should the OpenBindings Project standardize an invoker outside the core, or merely document how its own tooling invokes operations?

### Context

OBI-AD-002 establishes that the core OpenBindings specification enables invocation but does not define an invoker. OBI-AD-005 consequently removes automatic binding-selection policy from the core while preserving the author signals an invoker may use.

That separation does not make shared invocation behavior unimportant. Callers and independently implemented invocation components can benefit from a stable contract covering how an operation or binding is addressed, how values and lifecycle events cross the invocation boundary, and how validation, transforms, context, and failures are represented.

The project already publishes an `operation-invoker` interface and explanatory README. That artifact is substantially the right home for this contract. The remaining question is how to position it without turning one project-provided invocation architecture into a requirement of the OpenBindings format itself.

### Agreed direction

The OpenBindings Project should maintain a versioned, optional operation-invoker interface outside the core specification. It should define one interoperable invocation boundary that project and third-party tooling may implement. It is not the required, exclusive, or canonical mechanism by which an OpenBindings operation can be invoked.

The project should separately document the implementation policy of its reference tooling. The distinction is:

- The **core OpenBindings specification** defines the document model and portable meaning needed by tools that inspect or act on it.
- The **operation-invoker interface** defines an optional, reusable contract between callers and invoker implementations.
- **Reference-tool documentation** describes policy and behavior specific to project-maintained CLIs, SDKs, runtimes, and installed capabilities.

The existing `interfaces/operation-invoker` artifact should be reviewed and refined rather than replaced with a new monolithic “OpenBindings Invocation Specification.”

### What belongs in the operation-invoker interface

Material belongs in the versioned interface when independent callers and implementations need to agree on externally observable behavior. Likely subjects include:

- addressing an invocation by operation identifier or explicit binding key;
- operation and binding resolution;
- the request, value, lifecycle, and terminal-result shapes exposed at the interface boundary;
- input and output transform placement;
- validation behavior promised by this interface;
- context challenges and context forwarding;
- structured interface-level failure representation;
- capability reporting where callers need it for interoperability;
- any selection behavior that implementations claiming this interface are genuinely required to share.

These semantics may be expressed through a machine-readable OpenBindings interface, normative companion prose, and conformance fixtures. The artifact remains an interface published using OpenBindings, not an extension of core document conformance.

### What belongs in reference-tool documentation

Behavior belongs in implementation documentation when it describes the project tooling rather than a stable contract offered to independent implementations. Likely subjects include:

- installed or natively supported binding formats;
- cost, latency, locality, or environment-sensitive heuristics;
- command-line flags and explicit user overrides;
- retry and fallback strategies not promised by the invoker interface;
- logging, diagnostics, and error presentation;
- driver discovery and delegate configuration;
- policy that may evolve with a particular SDK or runtime release.

Such documentation may be precise and tested without being a format specification or a universal invoker requirement.

### Why this should be more than general documentation

If two independently implemented components communicate across the operation-invoker boundary, prose that merely describes the current implementation is insufficient. A versioned contract provides:

- a stable integration target for callers;
- a target that third-party invokers can implement;
- behavioral and schema compatibility across project components;
- a conformance surface separate from core OpenBindings conformance;
- a legitimate home for invocation semantics intentionally excluded from the core.

If a behavior has no such interoperability consequence and only reports what one implementation currently does, general documentation is sufficient and preferable.

### Selection-policy boundary

Automatic binding selection requires further care.

The existing operation-invoker text requires deterministic selection and recommends the highest-preference supported binding, while also calling selection implementation policy. Those statements provide per-implementation stability but do not ensure that two implementations select the same binding. “Deterministic” is incomplete without defining the inputs held constant and the final tie-breaker.

When this interface is revised, the project should choose explicitly between two coherent positions:

1. **Policy-defined automatic selection:** specify the candidate rules, ordering dimensions, handling of deprecation, and final tie-breaker completely enough for conforming implementations to agree where their capabilities are equal.
2. **Implementation-defined automatic selection:** state clearly that operation-key invocation delegates selection to the invoker's documented policy, while callers that require a particular realization address the binding explicitly.

The core author signals remain available under either position. This decision does not yet choose between the two positions.

### Positioning requirements

Future interface and project documentation should state clearly that:

- a conforming OpenBindings producer or consumer is not required to implement the project operation-invoker interface;
- other invocation APIs and runtime architectures remain valid;
- the interface is one project-published interoperability contract, not a claim that OpenBindings itself defines invocation mechanics;
- project tools may implement the interface and additionally expose behavior outside it;
- conformance to the operation-invoker interface is distinct from conformance to the core OpenBindings specification.

### Follow-up work

Likely follow-up work includes:

1. Review `interfaces/operation-invoker/README.md` and its versioned OpenBindings document against OBI-AD-001, OBI-AD-002, OBI-AD-003, and OBI-AD-005.
2. Identify which README statements are normative interface semantics and which describe the current reference implementation.
3. Move implementation-specific policy into clearly identified reference-tool documentation.
4. Settle the automatic-selection position above.
5. Add interface-specific conformance fixtures for any interoperable lifecycle, validation, transform, resolution, and error promises retained.
6. Cross-link the core and invoker interface without making the optional interface part of core conformance.

### What this direction does not decide

This decision does not settle the operation-invoker's complete protocol, automatic-selection algorithm, validation requirements, error vocabulary, context model, transport, or release schedule. It also does not declare the existing interface correct as written. Those require a dedicated review after the core's scope and semantics are settled.

## OBI-AD-007: Idempotency is a narrow author-attested operation-effect property, not a runtime safety authorization

**Status:** Agreed direction; specification clarification pending  
**Date:** 2026-07-13  
**Analysis question:** Should `idempotent` remain in the core operation model, and what exactly may a consumer infer from it?

### Context

The current specification defines `idempotent` as an author-attested contract-level claim that repeated invocations with the same input produce the same observable state. It associates the field with retry logic, caching, client-side deduplication, and agent planning.

That rationale combines several different properties. Idempotency does not imply cacheability, stable output, read-only behavior, harmlessness, deterministic execution, or absence of per-attempt ancillary effects. Whether a retry is safe can additionally depend on preserving principal, tenant, target, credentials, idempotency keys, binding choice, and other invocation context, as well as on how a partially completed or ambiguously failed attempt behaves.

At the same time, idempotency is a genuine protocol-independent semantic property. It cannot be inferred reliably from a transport verb, RPC name, or binding format, and the project already uses the field extensively in its published interfaces and examples. Retaining one optional operation-level field is lighter than introducing a general behavioral-traits system and preserves useful author intent across binding formats.

### Agreed direction

OpenBindings retains the optional boolean `idempotent` field as a narrow, author-attested claim about the intended effects of the semantic operation.

The intended meaning is approximately:

> `idempotent: true` asserts that repeating the operation with equivalent input under the same relevant execution context produces no additional intended operation-level effects after the first application.

The exact normative wording remains drafting work, but it should preserve these boundaries:

- The claim concerns intended operation-level effects, not equality of returned values, errors, timing, logs, metrics, or other per-attempt observations.
- Different repetitions may produce different outputs or failure results while the operation remains idempotent.
- Idempotency does not imply that the operation is safe, read-only, deterministic, cacheable, free, reversible, or harmless.
- Idempotency does not assert that authorization, billing, notification, audit, or other effects repeat harmlessly when those are part of the operation's intended semantics.
- The claim assumes equivalent operation input and preservation of all execution context relevant to the operation's effects. OpenBindings does not attempt to enumerate or model that context in the core document.
- Every binding attached to the operation must honor the operation-level claim when used under the relevant equivalent conditions.
- The field does not establish general substitutability among bindings or independently authorize changing bindings between attempts.
- The semantic truth of the claim remains author-attested and is not mechanically verifiable as document conformance.

### Three-state meaning

The boolean-plus-absence shape is retained, with three deliberately different meanings:

- `true` is an affirmative universal claim that repetition under the stated equivalent conditions adds no intended operation-level effects after the first application.
- `false` is an affirmative non-idempotency claim: at least one valid repetition scenario under equivalent conditions can add intended operation-level effects.
- Absence makes no claim. A consumer cannot infer either idempotency or non-idempotency.

This distinction prevents explicit `false` from collapsing into “not known to be true.” The specification should avoid defining `false` merely as “may not be idempotent,” since that wording is also true when the field is absent.

### Consequences for consumers

A consumer may use the field as one semantic input to documentation, planning, warnings, or an invocation policy. It must not treat the field alone as a complete authorization for automatic retry, caching, deduplication, or binding substitution.

For example:

- A read of changing state can be idempotent while returning a different value each time and remaining uncacheable.
- Repeated deletion can be idempotent even if the first attempt reports deletion and later attempts report absence.
- An increment operation is non-idempotent because repetition adds another intended state transition.
- An invocation layer considering a retry must additionally know whether it preserves relevant context, how ambiguous or partial failures behave, and whether it will reuse the same realization or has a stronger cross-binding guarantee.

This does not make `idempotent` a mere display hint. It remains a portable semantic assertion. It limits only the unrelated operational conclusions consumers may derive from that assertion.

### Why no separate profile or general traits system

The field is small, widely understood, protocol-independent, and applicable to the semantic operation rather than one binding. Moving it to a separate profile would add discovery and versioning machinery without clarifying its meaning. Introducing a general traits map would create a larger extensibility and governance problem to retain one established property.

The lighter solution is to keep the field in the operation model and make its semantic boundary precise.

### Required specification changes

Likely changes include:

1. **Operation definition** — replace “same observable state” with a narrow intended-effects definition that acknowledges equivalent relevant execution context.
2. **Rationale** — remove caching and client-side deduplication as direct consequences of idempotency.
3. **Retry language** — state that invocation policy may consider idempotency but cannot infer retry safety from the field alone.
4. **Three states** — define `true`, `false`, and absence as affirmative idempotency, affirmative non-idempotency, and unknown respectively.
5. **Negative implications** — state that the field does not imply stable output, cacheability, read-only behavior, safety, determinism, or binding substitutability.
6. **Binding relationship** — require each attached binding to honor the operation-level property without claiming that retries may freely switch bindings.
7. **Conformance** — retain structural validation of the boolean while leaving semantic truth author-attested.

### Candidate concise language

> `idempotent: true` is an author assertion that repeating the operation with equivalent input under the same relevant execution context produces no additional intended operation-level effects after the first application. `idempotent: false` asserts that a valid repetition can produce additional intended effects. Absence makes no claim. Idempotency does not imply equal outputs, cacheability, read-only behavior, or retry safety; an invocation policy must account separately for context preservation, partial failure, and binding choice.

This is drafting material, not adopted specification text.

### What this direction does not decide

This decision does not define generic retry behavior, an idempotency-key mechanism, equivalence of credentials or execution context, partial-transaction semantics, cache policy, deduplication policy, or a cross-binding invocation guarantee. Those belong to binding formats, invoker contracts, operation-specific documentation, or application policy as applicable.

## OBI-AD-008: Source location is a binding-specification-defined address, not a universal artifact-or-service taxonomy

**Status:** Agreed direction; specification simplification pending  
**Date:** 2026-07-13  
**Analysis question:** Is `source.location` improperly overloaded, and should the core split artifact location, service target, provenance, and reference base into separate fields?

### Context

The current source model requires `format` and at least one of `location` or `content`. Its prose then classifies formats according to whether `location` names an external binding artifact or a live service. When `content` and `location` coexist, that classification determines whether location is treated as provenance or as an invocation target. The core separately prohibits a co-present location from serving as the reference base for embedded content.

This produces complicated generic rules around concepts that binding formats do not model uniformly. An OpenAPI location may retrieve an artifact whose service targets are declared inside it. A gRPC address may be both the live target and the place where reflection obtains the contract. Embedded descriptors can still require an external target. Other formats can have no live target, several targets, or a different relationship between address and artifact.

The core already delegates interpretation of `binding.ref` to the binding format. `source.location` has the same essential shape: OpenBindings carries an address, while the format supplies the operational meaning needed to act on it.

### Agreed direction

OpenBindings retains the compact source structure of one binding-specification identifier plus at least one of `location` or `content`. OBI-AD-009 subsequently settles the field name as `bindingSpec`; this entry originally discussed it under the current `format` name. OpenBindings does not add universal `artifactLocation`, `target`, `provenance`, or `base` fields.

Specifically:

- `location` is a binding-specification-defined absolute source address.
- `content` is an embedded representation of the binding artifact.
- When `content` is present, it is the artifact representation the processor interprets rather than a fetch from `location` silently replacing it.
- When both are present, the governing binding specification defines the remaining operational role of `location`. Depending on that specification, it may be an invocation target, artifact identity, provenance, reference base, discovery address, or a combination.
- The core no longer divides binding specifications into generic “artifact-addressed” and “service-addressed” classes.
- The core does not promise that a tool can retrieve, resolve, or invoke a source from `location` without understanding its binding specification.
- A binding specification may define a co-present absolute `location` as the base for resolving references inside embedded `content`.
- The current universal rule that `location` can never serve as the base of embedded content is removed.
- Ambient document retrieval context still supplies no implicit base. A base used for embedded content must be carried explicitly and authorized by the binding specification.

The resulting division of authority is:

> OpenBindings carries the address; the binding specification defines what that address addresses.

### Why one binding-specification-scoped field is preferable

#### 1. Artifact and target are not universal independent concepts

Some source families put targets in the artifact, some use one address for artifact discovery and live communication, some need an external target beside embedded content, and some do not involve a service. A universal split would either fail to represent these shapes or acquire increasingly complicated combination rules.

#### 2. Acting on the source already requires binding-specification knowledge

A generic processor needs binding-specification-specific behavior to interpret `ref`, understand accepted content representations, identify the wire operation, and communicate with the target. Knowing that a string is generically an “artifact location” or “target” would not remove that dependency.

Tools that only catalog, copy, or inspect documents can preserve the source fields without understanding their operational semantics. Tools that act on a source must support its binding specification.

#### 3. The split would duplicate upstream authority

Binding specifications can incorporate the upstream authority that determines how artifacts are located, how endpoints are selected, how reflection or discovery works, and how internal references resolve. Re-modeling those protocol-specific rules in the core would create a second authority and require continuing protocol-specific maintenance.

#### 4. A carried base is not ambient context

The current self-containment rule correctly rejects dependence on the URI from which an OBI happened to be retrieved. Two copies of the same OBI should not acquire different meanings merely because they were loaded from different places.

An absolute location explicitly carried in the source is different. If the binding specification defines it as the embedded artifact's base, all processors supporting that specification receive the same base value. External resources may still be unavailable or mutable, but those are ordinary reference-resolution concerns shared with location-only artifacts, not ambiguity about the base.

### Required binding-specification authority

For a source to be operationally portable, its governing binding specification needs to define at least:

- what `location` addresses and which absolute-address syntax it accepts;
- which representation or representations `content` accepts;
- how `location` and `content` compose when both are present;
- whether `location` supplies a base for references inside `content`;
- how `binding.ref` identifies an entry in the artifact;
- what information is sufficient to identify the binding target.

This does not require the OpenBindings Project itself to publish the conventions for every third-party source family. OBI-AD-009 separately establishes how `bindingSpec` identifies that decentralized authority.

### Required specification changes

Likely changes include:

1. **Source definition** — define `location` as a binding-specification-defined absolute source address without assigning it one universal target type.
2. **Combined sources** — retain `content` as the interpreted embedded artifact and delegate the remaining role of co-present `location` to the binding specification.
3. **Classification prose** — remove the artifact-addressed versus service-addressed decision tree and its generic fallback.
4. **Embedded references** — remove the absolute prohibition on using co-present `location` as a base; allow it only when the binding specification defines that behavior.
5. **Context independence** — preserve the rule that the OBI document's own retrieval URI is never an implicit base for source content.
6. **Tool rules** — replace or substantially simplify OBI-T-15 so it points to binding-specification authority rather than restating a core taxonomy.
7. **Binding-specification requirements** — require binding specifications to document the address, representation, combination, base, and `ref` conventions listed above.

### Candidate concise language

> `location` is a binding-specification-defined absolute address associated with the source. `content`, when present, is the embedded binding artifact interpreted by the processor. The source's binding specification defines how a co-present `location` is used, including whether it identifies a target, records artifact identity or provenance, supports discovery, or supplies a base for references within `content`. The URI from which the OpenBindings document itself was retrieved is never an implicit base for embedded source content.

This is drafting material, not adopted specification text.

### What this direction does not decide

This decision does not require the OpenBindings Project to maintain third-party mappings, add a core-defined raw-binary encoding, or define how tools report unsupported or incompletely specified binding specifications. Identifier meaning and authority are settled separately by OBI-AD-009, and the JSON value domain of `content` is settled by OBI-AD-013.

## OBI-AD-009: A source names a decentralized binding specification, not merely an artifact format or implementation handler

**Status:** Agreed direction; terminology and governance changes pending  
**Date:** 2026-07-13  
**Analysis question:** What does the current `sources[*].format` value actually identify, how is its meaning governed without a central registry, and what should the field be called?

### Context

The current specification calls the value a **format token**, gives examples such as `openapi@3.1`, and says that the field identifies the binding specification for a source. Those ideas are not identical.

An upstream artifact format or dialect says how to recognize and interpret an artifact. An OpenBindings consumer needs a larger body of rules: which source representations are accepted, what `location` and `content` mean and how they compose, how `binding.ref` selects a target, how operation values map to the target's interaction, and which results count as successful output values at the OpenBindings boundary. An implementation handler is different again: it is code that implements those semantic rules.

The existing term therefore conflates at least three layers:

1. the upstream source artifact and its dialect or version;
2. the OpenBindings binding rules governing that source;
3. a tool's implementation of those rules.

The naming discussion exposed a substantive modeling issue rather than mere wordsmithing. If the identifier means only “this content looks like OpenAPI 3.1,” two tools can recognize the artifact while still disagreeing about how an OpenBindings binding acts on it. If it means “load whichever plugin claims this token,” the core has delegated portable meaning to local implementation configuration and become too open to establish interoperability.

At the same time, naming the field after its lexical representation alone would underspecify it. The value is encoded as a string token, but the important fact is what that token denotes. Fields normally name their semantic referent rather than the primitive syntax used to carry it.

### Agreed conceptual layers

The specification should distinguish the following concepts:

| Concept | Meaning |
|---|---|
| **Binding specification identifier** | The exact non-empty string carried by a source to denote its governing binding specification. It is a name, not a required network locator. |
| **Binding specification** | One stable semantic definition of how a defined set of sources and bindings are interpreted and acted upon. It may be expressed by several documents and may incorporate upstream standards by reference. |
| **Source artifact** | A concrete representation accepted by the binding specification, carried through `location`, `content`, or both. |
| **Binding** | The declaration connecting an OpenBindings operation to a source and, where applicable, selecting a target within it through `ref`. |
| **Binding-specification implementation** | Tool code that implements a binding specification. It is not what the identifier names. |

“One binding specification” means one semantic definition under one defining authority, not necessarily one physical specification file, one source artifact format, or one protocol. A binding specification may accept several representations—including representations governed by different upstream standards—provided that it completely and deterministically defines how to recognize and handle each accepted case.

### Agreed direction

The current `sources[*].format` field should become `sources[*].bindingSpec`.

Its formal name is the **binding specification identifier**. `bindingSpec` is field-name shorthand for that concept, not a claim that the identifier must resolve to one document.

The identifier has the following semantics:

- It is an exact, opaque, non-empty string identifier. Core processors do not decompose it, lowercase it, normalize versions, infer compatibility, or perform generic range matching.
- It denotes one stable binding specification under its defining authority.
- A binding specification may be multipart, incorporate upstream specifications, and accept more than one source representation.
- OpenBindings does not require the identifier to be a URI, URL, or other locator. A URI-shaped identifier has no special processing semantics.
- Processors do not dereference the identifier as part of interpreting the OBI. A tool may offer an explicit documentation lookup outside core processing, but understanding or acting on a binding never requires network access merely because `bindingSpec` is present.
- A binding specification may be defined privately or published for a wider ecosystem. Support for it may be compiled into a program, installed as a local package or plugin, or supplied through local configuration.
- The defining authority is responsible for the identifier and its semantic definition. Identifiers intended to circulate across independently administered environments should use collision-resistant publisher qualification; local or private identifiers are not required to participate in a global namespace.
- An incompatible change to the binding specification requires a different identifier. The core does not infer which identifiers are revisions of or compatible with one another.
- OpenBindings maintains no mandatory central registry. Decentralized authority is sufficient: a registry could aid discovery, but it is not what makes an identifier's meaning authoritative.
- The absence of a central registry does not weaken the one-identifier/one-definition rule. It means processors may encounter identifiers they do not know; it does not license competing meanings for the same identifier.
- An unknown identifier does not by itself make an otherwise structurally valid OpenBindings document invalid. A processor that does not implement the identified binding specification cannot claim support for, resolve, or act on bindings governed by it.
- An identifier names semantic rules, not an arbitrary local plugin. Implementations may use plugins internally, but local dispatch does not define the identifier's portable meaning.

The current `format` vocabulary should remain available where it truly refers to an upstream artifact format, a media format, or a JSON Schema keyword. It should no longer name the source-level authority that governs OpenBindings binding semantics.

### Offline and local use

Binding-specification identity and binding-specification distribution are separate concerns. An OpenBindings document carries the identity needed for exact dispatch; it does not carry a retrieval instruction for the specification and does not require a processor to discover or download support.

For example, a locally built CLI may contain a custom implementation for a private binding specification and consume a local `usage` artifact:

```json
{
  "bindingSpec": "my-cli.usage-json@1",
  "location": "file:///home/user/project/usage.kdl"
}
```

The CLI and document share the identifier because the CLI was built or configured with that binding-specification support. No registry, DNS ownership, published specification URL, or internet connection is involved.

This local freedom accepts the possibility of naming collisions if independently created private identifiers are later combined. The core cannot eliminate that possibility without requiring global infrastructure or cumbersome generated identifiers. Qualification is therefore proportional to circulation: a publisher of broadly shared binding specifications should choose a collision-resistant name such as `com.example.my-binding@1`, while a controlled local environment may deliberately use a shorter name.

The qualification pattern is authoring guidance rather than core syntax. OpenBindings treats both examples as opaque strings and assigns no generic meaning to dots, `@`, or a suffix that resembles a version. The project should document a prefix for its own published binding specifications, but that reservation does not create a global registry.

### Why `bindingSpec` is the strongest name

`bindingSpec` names the semantic thing selected by the identifier while remaining compact enough for a frequently used document field.

The main alternatives each emphasize the wrong layer:

- **`format`** suggests artifact syntax or dialect and hides the larger mapping and interaction contract.
- **`bindingType`** suggests the concrete kind of binding or interaction. The selected rules may govern several artifact representations or interaction kinds, so the field does not necessarily classify the individual binding in that way.
- **`bindingToken`** accurately describes the lexical carrier but says nothing about what it identifies. It can also suggest a credential or per-instance token.
- **`bindingProfile`** usefully suggests an added set of constraints, but “profile” often means a subset or overlay of a separately complete specification and is already overloaded in surrounding standards and project vocabulary.
- **`bindingDefinition`** is a credible runner-up, but is less conventional than “specification” for a published, versioned body of interoperable rules.
- **`bindingSemantics`** is precise but awkward as an identifier-bearing field and deemphasizes the specification that establishes those semantics.

The singular in `bindingSpec` is intentional at the semantic level. The identifier selects one coherent definition even when that definition is distributed across several documents or relies on several upstream standards.

### Artifact version and binding-specification revision are separate axes

A source artifact can self-identify its own dialect or version while `bindingSpec` identifies the OpenBindings rules applied to it. These axes should not be collapsed merely because the present examples use tokens such as `openapi@3.1`.

Conceptually, a source could look like:

```json
{
  "bindingSpec": "openbindings.openapi@1",
  "content": {
    "openapi": "3.1.0"
  }
}
```

Here `@1` identifies a revision of the OpenBindings binding specification published for OpenAPI sources. The embedded artifact independently declares that it uses OpenAPI 3.1.0. The binding specification determines whether that artifact version is accepted and how it is handled.

The core should not add a separate `artifactType` field merely to expose both axes. Many artifacts already self-identify; a binding specification can declare every representation it accepts and how to discriminate among them. A second required classifier would duplicate artifact data and introduce mismatch and precedence questions. A future need for an independently useful artifact classifier can be evaluated on its own evidence.

### Minimum authority a binding specification must provide

OpenBindings remains extensible, but extension cannot mean semantically unconstrained. A binding specification intended to support interoperable action needs to define enough that two independent conforming implementations can agree on the meaning of the governed source and binding.

At minimum, that includes:

- its exact identifier and publishing authority;
- the source representations and upstream versions it accepts, including deterministic discrimination when it accepts more than one;
- the accepted syntax and meaning of `location`;
- the accepted representation of `content`;
- how `location` and `content` compose when both are present, including reference-base behavior;
- the syntax and meaning of `binding.ref`, including the absent-`ref` case;
- how the binding target and its interaction are identified;
- how caller-facing input values and successful output values correspond to the source interaction, including any binding-specification-provided context available to transforms;
- any additional constraints needed to make the binding operationally unambiguous.

This is a completeness floor, not a requirement that every binding specification have one document, use one source-artifact standard, or be published by the OpenBindings Project.

### Project and third-party specifications

The OpenBindings Project should be able to publish binding specifications for the source families it voluntarily supports. Third parties should be able to publish equally valid binding specifications under their own authority without project registration or approval.

The project should provide an informative authoring template or guide so publishers do not have to rediscover the necessary sections. That template should be backed by the core's normative minimum-obligation list; the template itself need not become another conformance target.

Project reference tooling may implement additional identifiers on a best-effort basis, but implementation support must not be presented as if it creates or completes a portable binding specification. Missing semantic rules are a defect or limitation of the claimed binding-specification support, not an invitation for each tool to silently invent different behavior.

### Required specification changes

Likely changes include:

1. **Field rename** — replace source-level `format` with `bindingSpec` in the schema, prose, examples, interfaces, and reference implementations, with migration handling determined as part of the next release plan.
2. **Terminology** — define binding specification, binding specification identifier, source artifact, binding, and implementation as distinct concepts.
3. **Identifier semantics** — establish exact matching, offline and local use, defining authority, stable meaning, and a new-identifier requirement for incompatible semantic change; explicitly prohibit implicit dereferencing or URI semantics.
4. **No generic version algebra** — remove generic lowercasing, SemVer normalization, range matching, or community-defined equivalence from core semantics. A tool supports the exact identifiers it implements.
5. **Unknown identifiers** — distinguish document structural validity from a tool's ability to act on a binding governed by an unsupported identifier.
6. **Binding-specification obligations** — normatively state the completeness floor needed for portable source and binding interpretation.
7. **Examples** — stop using examples that make an upstream artifact-version token appear automatically sufficient to identify the OpenBindings mapping rules, and include a locally provisioned custom binding specification.
8. **Project publications** — treat any project-supported binding specifications as separately governed specifications rather than protocol-specific mappings embedded in the core.
9. **Authoring guidance** — publish an informative template or checklist derived from the normative completeness floor.
10. **Consistency audit** — align all project code paths so identifier comparison and support discovery follow the same exact-match model.

### Candidate concise language

> `bindingSpec` is an exact, opaque, non-empty string identifying the binding specification governing this source and every binding that references it. It is not required to be a URI and is never implicitly dereferenced. A binding specification defines the accepted source representations and the complete rules by which their locations, content, references, targets, interactions, and operation-boundary values are interpreted. One identifier denotes one stable semantic definition under its defining authority; that definition may be locally provisioned, may span multiple documents, and may incorporate multiple upstream standards. OpenBindings maintains no registry and defines no equivalence or compatibility between distinct identifiers. A processor that does not implement the identified binding specification cannot act on the governed binding.

This is drafting material, not adopted specification text.

### What this direction does not decide

This decision intentionally establishes no lexical grammar beyond a non-empty string. It does not settle the exact informative qualification convention, the prefix the OpenBindings Project will document for its own specifications, the migration and compatibility treatment of the existing `format` field, or which binding specifications the project will publish first. It also does not add a separate artifact-type field, prescribe one-document specifications, require a central registry, or require any network connectivity.

## OBI-AD-010: OBI-contained schemas must be well-formed JSON Schema 2020-12 schemas

**Status:** Agreed direction; document-conformance rule pending  
**Date:** 2026-07-13  
**Analysis question:** Is object shape sufficient for an OBI schema position, or must every schema contained directly in an OBI be a well-formed schema under the pinned JSON Schema dialect?

### Context

OpenBindings pins its operation contracts to JSON Schema 2020-12 and applies an OBI-specific portability profile. The derived OpenBindings schema can recognize that an operation's `input` or `output`, or a value in the top-level `schemas` map, has an allowed JSON container type. That does not by itself establish that the value is a syntactically valid JSON Schema.

For example:

```json
{
  "input": {
    "type": 42
  }
}
```

The `input` value is an object, but `type` cannot have a numeric value under JSON Schema 2020-12. Treating this as a conformant OpenBindings contract until an invocation happens would allow the document to claim a contract it cannot define or evaluate.

This is different from proving that a schema expresses a useful contract, that it is satisfiable, or that a concrete binding honors it. Those are semantic or compatibility questions. Whether the schema uses its pinned language with well-formed keyword values is an objective property of the document and is statically decidable.

### Agreed direction

Every schema contained directly in an OpenBindings document must be a well-formed JSON Schema 2020-12 schema under the OpenBindings schema profile.

This requirement applies to:

- every specified operation `input` schema;
- every specified operation `output` schema;
- every schema in the top-level `schemas` map;
- subschemas contained within those schemas, as governed by JSON Schema 2020-12.

Failure of an OBI-contained schema to satisfy the applicable JSON Schema meta-schema and OpenBindings profile is a document-conformance failure, not merely an invocation-time condition.

The rule includes the OBI profile restrictions already selected by the core, such as the pinned dialect, the treatment of `$schema`, the prohibition on unsupported vocabulary changes, and any OBI-specific constraints on schema references or keywords. The official JSON Schema 2020-12 meta-schemas should be available to conforming validators as local resources; checking an OBI-contained schema must not require downloading a meta-schema from the internet.

### Deliberately narrow scope

Schema well-formedness does not require a validator to:

- prove that the schema admits at least one value;
- prove that two schemas are equivalent or compatible;
- prove that an operation implementation or binding honors the schema;
- retrieve or resolve every external `$ref` merely to check the syntax of the containing schema;
- validate operation examples against the schema;
- determine the semantic truth of descriptions or other author assertions;
- reject unknown JSON Schema keywords that JSON Schema legitimately treats as annotations.

Those are separate satisfiability, resolution, example-conformance, compatibility, or extension questions.

An external schema reached through `$ref` is interpreted under its applicable JSON Schema dialect when retrieved. A malformed retrieved schema cannot successfully participate in evaluation, but its remote contents are not retroactively an embedded syntactic defect in the OBI. A processor that does not retrieve the external resource distinguishes inability to verify or evaluate it from a known well-formedness violation. OBI-AD-017 separately establishes that successful boundary validation requires the complete reachable graph to be available.

### Conformance and tool capability

Well-formedness is an objective document property even though not every OpenBindings-reading tool must implement a JSON Schema meta-validator. A lightweight parser, indexer, or renderer may leave the rule unverified under the capability-scoped conformance model. A tool claiming complete document validation must check it.

This preserves the distinction between:

- what makes an OpenBindings document conformant; and
- which parts of conformance a particular tool is capable of verifying.

The required validation is offline-decidable for OBI-contained schemas. A serious OpenBindings validator can perform it using bundled 2020-12 meta-schemas without introducing network dependence.

### Why this belongs in document conformance

Operation schemas are not incidental executable snippets. They are the primary machine-checkable expression of the caller-facing value contract. If a value occupying a schema position is not a schema in the selected language, that contract is not merely faulty at runtime; it is undefined.

Making well-formedness a document rule also gives implementations one predictable failure boundary. Without it, some tools reject a malformed schema while loading the OBI, others fail only on the first value crossing the affected operation boundary, and others may ignore an invalid keyword and silently weaken the contract.

The dependency cost is proportionate. Tools exercising full validation already need substantial JSON Schema support, while tools that do not exercise that capability remain free not to ship it.

### Relationship to transform parsing

OBI-AD-003 treats malformed JSONata as transform-evaluation failure and does not require every document processor to preflight every expression. The schema decision is intentionally stronger because schema validity is constitutive of the OBI's central value contract and the document already claims each schema position is a JSON Schema document. This does not create a general rule that every embedded language must be compiled for every kind of document processing.

### Required specification changes

Likely changes include:

1. **Document rule** — add a stable OBI-D rule requiring every OBI-contained schema to be well formed under JSON Schema 2020-12 and the OpenBindings profile.
2. **Schema-position prose** — distinguish allowed JSON representation from meta-schema validity; passing the derived OpenBindings schema alone is not sufficient.
3. **Tool obligations** — require tools claiming complete document validation to check the rule while allowing capability-limited readers to report it as unverified.
4. **Offline resources** — direct validators to bundle or otherwise provide the official 2020-12 meta-schemas without a required network fetch.
5. **Conformance corpus** — add malformed known-keyword cases, nested malformed subschemas, valid unknown annotation keywords, and profile-specific violations.
6. **Failure reporting** — distinguish a known embedded schema violation from an external schema that was not retrieved or could not be evaluated.

### Candidate concise language

> Every schema contained in an OpenBindings document MUST be a well-formed JSON Schema 2020-12 schema under the OpenBindings schema profile. This requirement applies recursively to its subschemas and is a document-conformance rule. It does not require proving schema satisfiability, resolving external schema resources, validating examples, or establishing compatibility with a binding. A validator MUST be able to check OBI-contained schemas without fetching the JSON Schema meta-schemas from the network.

This is drafting material, not adopted specification text.

### What this direction does not decide

Boolean schema forms are settled separately by OBI-AD-011, explicit schema-position `null` is removed by OBI-AD-012, example validity is settled by OBI-AD-014, and partial-verification vocabulary is settled by OBI-AD-015.

## OBI-AD-011: Boolean schemas are valid per-value contracts at every OBI schema position

**Status:** Agreed direction; schema and explanatory changes pending  
**Date:** 2026-07-13  
**Analysis question:** Should OBI schema positions accept JSON Schema 2020-12's native boolean schemas, and what would `false` mean when OpenBindings deliberately does not define interaction cardinality?

### Context

JSON Schema 2020-12 permits a schema to be either an object or a boolean. `true` accepts every instance and `false` accepts none. The current OpenBindings specification permits boolean schemas where they occur as keyword values inside an object schema but prohibits them at OBI schema roots: operation `input`, operation `output`, and entries in the top-level `schemas` map must use object form.

The restriction gives object-only consumers a superficially uniform root representation, but it does not remove boolean-schema semantics from the implementation surface. A conforming JSON Schema evaluator already needs to handle boolean subschemas. It also does not prevent authors from expressing the same meanings indirectly: `{}` is equivalent to `true`, and an object schema such as `{"not": {}}` is equivalent to `false`.

OpenBindings' per-value contract stance makes the interpretation of `false` precise but easy to misunderstand. Operation schemas constrain each value that crosses the applicable boundary; they do not declare whether the interaction carries zero, one, or many such values.

### Agreed direction

Every OBI position that accepts a JSON Schema accepts both object and boolean JSON Schema forms.

The operation-level states are:

| Form | Contract meaning |
|---|---|
| `input` or `output` absent | No contract is specified for that boundary. |
| `input` or `output` equal to `null` | Not permitted under the subsequent OBI-AD-012 decision. |
| `{}` or `true` | A contract is specified and every JSON value satisfies it. |
| `false` | A contract is specified and no JSON value satisfies it. |

`true` and `{}` are semantically equivalent under JSON Schema. OpenBindings should continue to prefer `{}` in its prose and examples for readability and continuity, while accepting `true` as the native boolean spelling.

`false` is an impossible **value** contract:

> If a value crosses this operation boundary, no value can satisfy the declared schema.

It does not assert that:

- the operation cannot be invoked;
- the operation is disabled or unavailable;
- the binding has a zero-input or zero-output interaction shape;
- an invocation must fail;
- no transport-level or failure outcome can occur.

A binding whose interaction carries zero input values can realize an operation with `input: false`; any input value that did cross the boundary would violate the contract. A binding that produces no successful output values can similarly realize `output: false`; any successful output value would fail validation. The binding specification remains authoritative over interaction cardinality and lifecycle under OBI-AD-001.

### Why the boolean forms should be admitted

#### 1. They are part of the selected schema language

OpenBindings pins JSON Schema 2020-12. Prohibiting its native root forms creates an OBI-specific schema subset and requires an additional restriction to explain, validate, test, and preserve.

#### 2. The implementation savings are negligible

JSON Schema processors already support boolean subschemas. Traversal, comparison, documentation, and code-generation tools must account for them somewhere in a schema graph even if OBI prohibits them at its three named root positions.

#### 3. `false` expresses genuine author intent

Unspecified, unconstrained, and impossible are different contracts. Absence makes no claim. `{}` or `true` deliberately permits every JSON value. `false` deliberately permits none. Keeping all three meanings lets an author state the strongest accurate per-value boundary without adding an OpenBindings-specific sentinel.

#### 4. Object-only form does not actually eliminate the semantics

Because object schemas can express both always-valid and never-valid contracts, the current restriction primarily bans the clearest standard notation. Requiring `{"not": {}}` instead of `false` adds obscurity without adding safety.

### Tooling consequences

- Schema validators evaluate boolean roots according to JSON Schema 2020-12.
- Code generators and documentation tools should represent `false` as a bottom, impossible, or never type where their target supports one. A tool that cannot represent it must surface the limitation rather than reinterpret it as absent, `null`, `{}`, or a zero-cardinality declaration.
- Schema comparison tools may recognize `true` and `{}` as semantically equivalent, but the optional JCS canonical serialization retained by OBI-AD-019 does not rewrite one spelling to the other.
- No example value can validate against `false`; OBI-AD-014 makes a provided example at that boundary a document-conformance failure.
- The OBI-AD-010 well-formedness rule applies equally to object and boolean schemas; the official JSON Schema meta-schema already defines both forms.

### Required specification changes

Likely changes include:

1. **Derived schema** — permit boolean values wherever the OpenBindings schema currently references its JSON Schema object definition.
2. **Operation field table** — describe `input` and `output` as optional JSON Schema object or boolean forms; literal `null` is excluded by OBI-AD-012.
3. **Schemas section** — remove the prohibition on boolean schemas at OBI positions.
4. **Per-value explanation** — define `false` as rejecting every value that crosses the boundary without assigning it interaction-cardinality meaning.
5. **Authoring style** — continue using `{}` as the preferred always-valid spelling in examples while making clear that `true` is conformant and equivalent.
6. **Tool behavior** — require tools that cannot represent `false` to report the limitation rather than silently weakening or changing the contract.
7. **Conformance corpus** — add `true` and `false` cases for operation schemas, top-level named schemas, `$ref` targets, zero-value-capable interactions, provided examples, and tool diagnostics.

### Candidate concise language

> An OBI schema is a JSON Schema 2020-12 object or boolean schema. `{}` and `true` are specified schemas that accept every JSON value. `false` is a specified schema that accepts no JSON value. Because operation schemas govern each value crossing a boundary, `false` means that no value may validly cross that boundary; it does not declare interaction cardinality, disable the operation, or require invocation failure. Interaction shape remains binding-specification-defined.

This is drafting material, not adopted specification text.

### What this direction does not decide

Explicit schema-position `null` is removed separately by OBI-AD-012, and example validity is settled by OBI-AD-014. This decision does not settle whether an operation needs a separate way to describe zero-value interaction cardinality or how generated APIs expose a binding-specific zero-input or zero-output interaction. Those remain binding-specification questions.

## OBI-AD-012: Omission is the sole representation of an unspecified operation schema

**Status:** Agreed direction; schema simplification and migration pending  
**Date:** 2026-07-13  
**Analysis question:** Should literal `null` remain a second spelling of an absent operation `input` or `output` schema?

### Context

The current specification permits an operation's `input` or `output` to be absent, a JSON Schema object, or literal `null`. It defines absence and literal `null` as exactly equivalent: both mean that the operation specifies no contract for that boundary.

That equivalence gives one semantic state two document representations without enabling any additional contract. It also places a non-schema value in a field otherwise described as carrying a JSON Schema and creates a visually subtle distinction from a schema that accepts the JSON value `null`.

Following OBI-AD-011, the meaningful operation-schema states can be represented directly without schema-position `null`:

| Form | Meaning |
|---|---|
| Field absent | No contract is specified for the boundary. |
| `{}` or `true` | A contract is specified and every JSON value is valid. |
| `false` | A contract is specified and no JSON value is valid. |
| `{"type": "null"}` | A contract is specified and the JSON value `null` is valid while non-null values are not. |

Literal `null` has no remaining semantic role in this model.

### Agreed direction

An operation's `input` and `output` fields accept a JSON Schema object or boolean schema when present. Omission is the sole representation of an unspecified schema. Literal `null` is not valid at either schema position.

The resulting rule is:

> An absent `input` or `output` field means that OpenBindings declares no value contract for that boundary. A present field contains a JSON Schema 2020-12 object or boolean schema.

Absence does not mean that the interaction carries zero values, and it does not mean that every value is accepted. It means only that the OBI makes no portable value-contract claim at that boundary. `{}` or `true` remains the explicit contract accepting any JSON value, while `false` remains the contract accepting none.

### Why removal is preferable

#### 1. It removes a duplicate representation without removing meaning

Every document using schema-position `null` can be converted by deleting that field. The converted document has exactly the same specified meaning under the current rules.

#### 2. It restores the native JSON Schema value domain

A JSON Schema 2020-12 schema is an object or boolean. A present OBI schema field can now be described without a special OpenBindings union branch: it either contains a schema or is absent.

#### 3. It sharpens the distinction from a null-valued contract

These declarations are intentionally different:

```json
{}
```

No `input` contract is specified.

```json
{
  "input": { "type": "null" }
}
```

An input contract is specified, and the only valid input value is JSON `null`.

Removing schema-position `null` eliminates a third visually similar form whose only meaning was omission.

#### 4. Authoring convenience does not require a semantic alias

Some host-language serializers emit `null` for absent optional fields, and some templates prefer to render every possible member. Supporting that output would be convenient, but it would make serializer behavior part of the portable document surface. OBI serializers can omit absent option values, as serializers for optional JSON properties routinely do.

OpenBindings does not define overlays, inheritance, merge patches, or field-clearing operations. It therefore has no patch-specific reason to preserve explicit `null` as a deletion marker.

#### 5. It simplifies comparison and processing

Tools no longer need to normalize two spellings of “unspecified” before semantic comparison. The derived schema, data models, documentation, and corpus also lose an unnecessary branch.

### Literal null remains an ordinary JSON value

This decision applies only to literal `null` used where an operation schema would appear. It does not remove JSON `null` from instance-value positions.

For example:

```json
{
  "output": { "type": "null" },
  "examples": {
    "completed": {
      "output": null
    }
  }
}
```

The operation has a specified output schema, and the example supplies an actual JSON `null` output value to validate against it. An absent example `output` means that the example supplies no output value; an explicitly null example `output` is a supplied value. That distinction remains necessary.

Likewise, this decision does not prohibit `null` within schemas, embedded source artifacts, extension data, or other positions whose data model admits ordinary JSON values.

### Migration and compatibility

Migration from the previous representation is mechanical:

1. For each operation, if `input` is literal `null`, remove the `input` member.
2. If `output` is literal `null`, remove the `output` member.
3. Do not alter `{"type": "null"}` schemas or null-valued operation examples.

A reader processing a document under an older OpenBindings version continues to apply that version's rules. A migration tool can recognize the older form, remove it, and optionally report the normalization. A document claiming the new specification version is non-conformant if it carries literal `null` at an operation schema position.

### Required specification changes

Likely changes include:

1. **Derived schema** — remove the `null` alternative from operation `input` and `output`; accept only the object-or-boolean JSON Schema definition when present.
2. **Operation prose** — define omission as the sole unspecified state and remove all absent-equals-null language.
3. **State table** — document the distinct meanings of omission, `{}`/`true`, `false`, and `{"type": "null"}`.
4. **Examples prose** — preserve the distinction between an absent example value and an explicitly supplied JSON `null` value.
5. **Data models** — represent operation schemas as optional object-or-boolean schema values without serializing an absent option as JSON `null`.
6. **Migration tooling** — provide a mechanical normalization that deletes old schema-position nulls without touching null-valued schemas or examples.
7. **Conformance corpus** — add rejection cases for literal-null operation schemas and positive cases for omission, boolean schemas, `{"type": "null"}`, and null-valued examples.

### Candidate concise language

> `input` and `output`, when present, contain a JSON Schema 2020-12 object or boolean schema. An absent field means that the operation specifies no value contract for that boundary. Literal `null` is not a valid schema-position value. This does not affect JSON `null` as an instance value; a schema accepting that value uses `{"type": "null"}`.

This is drafting material, not adopted specification text.

### What this direction does not decide

This decision does not define interaction cardinality, add a distinct declaration that a binding carries zero values, change the treatment of null-valued operation examples, or define a general overlay or patch model for OpenBindings documents. Example conformance is settled separately by OBI-AD-014.

## OBI-AD-013: Embedded source content may be any JSON value accepted by its binding specification

**Status:** Agreed direction; source-schema and prose changes pending  
**Date:** 2026-07-13  
**Analysis question:** Should the core restrict `sources[*].content` to a non-empty string or object, or carry any JSON value and let the governing binding specification define accepted representations?

### Context

The current source schema permits embedded `content` only as an object or a non-empty string. The prose assigns those two forms universal meanings: an object is a parsed JSON artifact and a string is UTF-8 source text. Arrays, numbers, booleans, literal `null`, and the empty string are prohibited.

That restriction reflects common current artifact shapes but does not follow from the OpenBindings abstraction. JSON documents may have any JSON value at the root, and private or future binding specifications may legitimately use scalar or array representations. OBI-AD-009 now gives each binding specification explicit authority to define the source representations it accepts, removing the need for the core to predict those representations.

All OpenBindings processors already parse the complete JSON value domain. Restricting which parsed values may occur under `content` therefore saves little generic implementation work while creating an OBI-specific limitation on extension specifications.

### Agreed direction

`sources[*].content`, when present, may contain any JSON value:

- object;
- array;
- string, including the empty string;
- number;
- boolean;
- `null`.

The source's `bindingSpec` defines which of those values are accepted representations and what they mean. The core carries the value without assigning a universal source-artifact encoding to its JSON type.

In particular:

- an object is not generically guaranteed to be a parsed document rather than a binding-specification-defined object representation;
- a string is not generically guaranteed to be UTF-8 source text rather than another binding-specification-defined string encoding;
- an array or scalar is not rejected merely because current project binding specifications rarely use one;
- empty values are not rejected merely for being empty; the binding specification decides whether they constitute valid artifacts.

### Presence is distinct from value

The source invariant continues to require at least one of `location` or `content`. For that rule, `content` is present when the object has a `content` member, regardless of the member's JSON value.

Therefore:

```json
{
  "bindingSpec": "example.null-artifact@1",
  "content": null
}
```

contains an embedded representation. It is not equivalent to omitting `content`.

Implementations must use member-presence checks rather than nullish-value checks when enforcing the source invariant, preserving documents, applying `location`/`content` composition rules, and dispatching to a binding-specification implementation. Host-language data models need an option or presence bit capable of distinguishing an absent member from a present null value.

This differs from the removed schema-position `null` of OBI-AD-012. There, the specification assigned literal `null` exactly the same meaning as omission, making it redundant. Here, the embedded JSON value itself is data interpreted by the binding specification, so presence and null value are semantically distinct.

### Binding-specification validity

Allowing every JSON value at the core structural layer does not require every binding specification to accept every value.

For example:

```json
{
  "bindingSpec": "example.array-artifact@1",
  "content": ["first", "second"]
}
```

is structurally representable by OpenBindings. It is a valid source for that identifier only if the `example.array-artifact@1` binding specification accepts that array representation and the value satisfies its requirements.

A processor that supports the binding specification can verify those constraints. A binding-specification-agnostic parser or a processor that does not support the identifier preserves the value and leaves binding-specification-specific validity unverified rather than inventing a generic rejection. This follows the same supported-versus-unknown distinction as `binding.ref`, `location`, and other binding-specification-defined source semantics.

### Binary content

JSON still cannot carry raw binary octets as a distinct primitive type. This decision does not add one and does not select a universal Base64, data-URI, or wrapper representation.

A binding specification may define an encoding using an ordinary JSON string or structured value if that is appropriate for its artifact family. Because that encoding is part of the binding specification, independent implementations supporting the identifier can agree on it without the core assigning one generic meaning to all strings.

Alternatively, a binding specification can require binary artifacts to be addressed through `location`. The choice remains specification-specific.

### Why the broad value domain is preferable

#### 1. It keeps representation authority in one place

The binding specification already defines accepted content representations. A second core-level representation taxonomy can only duplicate or conflict with that authority.

#### 2. It avoids designing around current examples

OpenAPI objects and protobuf source strings do not establish that every useful future binding source has one of those two roots. Array- or scalar-rooted JSON artifacts are valid JSON and inexpensive to preserve.

#### 3. It removes arbitrary edge restrictions

The current non-empty-string constraint rejects an empty textual artifact even when a binding specification could assign it valid meaning. The same issue applies to empty arrays and other scalar values. Validity should follow from the governing specification, not a generic non-emptiness intuition.

#### 4. It does not meaningfully enlarge the parser surface

An OBI parser must already handle every JSON value in schemas, examples, extensions, and embedded structures. The additional obligation is primarily correct presence tracking, which is necessary anywhere JSON `null` and omission have different meanings.

### Required specification changes

Likely changes include:

1. **Derived schema** — allow any JSON value for `sources[*].content` and ensure the at-least-one-of rule treats a present null member as present.
2. **Source prose** — define `content` as an embedded binding-specification-defined representation rather than generically as object-parsed JSON or string UTF-8 text.
3. **Binding-specification obligations** — require each binding specification to state the accepted JSON representations and their meaning.
4. **Presence semantics** — explicitly distinguish an absent member from `content: null` and require presence-aware processing.
5. **Binary language** — remove the universal prohibition phrased in terms of raw binary versus textual content; state instead that JSON has no binary primitive and any encoding is binding-specification-defined.
6. **Conformance corpus** — cover arrays, numbers, booleans, null, empty strings, empty arrays and objects, member-presence handling, and binding-specification-specific rejection.
7. **Reference implementations** — audit source data models, serializers, and validators for nullish-coalescing or zero-value behavior that loses content presence.

### Candidate concise language

> `content`, when present, carries an embedded source representation as any JSON value. Its binding specification defines the accepted JSON types, encodings, structure, and meaning. Member presence is independent of member value: `content: null` carries the JSON null value and is not equivalent to an absent `content` member. OpenBindings defines no universal binary encoding for embedded content.

This is drafting material, not adopted specification text.

### What this direction does not decide

This decision does not require any binding specification to accept every JSON type, define a universal binary encoding, make `content` self-describing without `bindingSpec`, or settle generic size or resource limits. Partial binding-specification verification is reported under the general model established by OBI-AD-015.

## OBI-AD-014: Provided operation examples are positive contract claims whose known mismatch is non-conformant

**Status:** Agreed direction; conformance clarification pending  
**Date:** 2026-07-13  
**Analysis question:** Should a provided operation example that violates its corresponding specified schema make the OpenBindings document non-conformant, or should example correctness be only a lint or verification hint?

### Context

Operation examples are optional, named objects that may provide caller-facing `input` and `output` values. The current specification requires each provided value to validate against its corresponding operation schema when that schema is specified.

The analysis questioned the normative strength of this rule. Examples are not needed to invoke an operation, and verifying one can require resolving external schema references. A document can therefore contain a usable operation contract while one optional example is incorrect or cannot be checked by an offline validator.

At the same time, examples are consumed as contract content by documentation generators, test harnesses, SDK generators, humans, and agents. A value presented as an example of a schema but rejected by that schema creates a direct contradiction within the document. Treating that contradiction as mere style would allow a conformant OBI to make machine-checkably false claims about its central value contract.

### Agreed direction

Operation examples remain optional and are positive examples.

When a corresponding operation schema is specified:

- a provided example `input` must validate against the operation's `input` schema;
- a provided example `output` must validate against the operation's `output` schema;
- a known validation mismatch is a document-conformance failure.

When the corresponding operation schema is absent, the example value makes no schema-validation claim and no validation check is required for that side.

The operation schema is authoritative. An example neither widens nor narrows it, and a tool must not resolve a contradiction by treating the example as an exception to the schema.

### Presence and null values

Example-member presence is distinct from the member's JSON value:

- an absent example `input` or `output` means that the example supplies no value for that side;
- an explicitly present `input: null` or `output: null` supplies the JSON value `null` and is validated like any other value.

This preserves the useful example semantics recorded in OBI-AD-012. Removing literal `null` from schema positions does not remove null-valued instances.

For example:

```json
{
  "output": { "type": "null" },
  "examples": {
    "completed": {
      "output": null
    }
  }
}
```

The provided output example validates. If the operation instead declared `output: false`, no supplied output value—including `null`—could validate, so any example providing an output would establish non-conformance.

### Scope of the claim

Example validation is deliberately limited to the caller-facing operation boundary:

- no binding is selected or invoked;
- no input or output transform is evaluated;
- no source artifact is consulted merely because an operation example exists;
- binding-specific wire representations are irrelevant;
- a valid example pair does not mechanically prove that its output can result from its input;
- a valid output example demonstrates only schema membership, not that every binding can actually produce it;
- descriptions and other prose remain author content rather than mechanically verified truth.

Because OpenBindings models successful caller-facing output values rather than a portable failure contract, ordinary operation examples likewise do not acquire generic failure-example semantics. A future feature for negative inputs, failure results, or executable scenarios would require its own explicit model rather than overloading positive examples.

### External references and unverified results

If the governing schema is fully available, example validation uses the same JSON Schema 2020-12 boundary semantics selected elsewhere by the core. A self-contained OBI can be checked entirely offline.

If an example's governing schema depends on an external resource that the validator cannot or will not retrieve, the validator has not established either validity or invalidity for that example. It must leave the rule unverified rather than treating an unresolved or partially evaluated schema as a pass. This applies the complete schema-graph rule established by OBI-AD-017.

This does not require network connectivity to parse, preserve, inspect, or otherwise process an OBI. External schema resolution is already necessary to evaluate values against such a schema at an operation boundary; examples reuse that existing dependency rather than introducing a new one.

Document conformance remains an objective property even when a particular tool cannot verify it. OBI-AD-015 establishes the result vocabulary for distinguishing verified conformance, known violation, and incomplete verification.

### Non-conformance does not mandate total refusal

A known invalid example makes the document non-conformant, but that classification does not require every tool to refuse every useful operation on the document. A tool may inspect the document, report the defect, or apply an explicitly documented recovery policy as appropriate to its task.

The important boundary is that it cannot report the entire document as conformant while preserving the contradiction. Conformance describes the correctness of the document's claims; it is not a universal instruction to discard all salvageable content after any defect.

### Why this rule earns normative weight

#### 1. Examples are consumed as actionable contract material

Generated documentation, tests, clients, and agent context can all propagate a false example. Optionality lets authors avoid the feature; it should not make examples untrustworthy when used.

#### 2. The check reuses existing semantics

No new expression language, comparison algorithm, or binding model is needed. The rule evaluates an ordinary JSON value against the already governing operation schema.

#### 3. Lint-only treatment permits internal contradiction

A warning convention varies by tool and can be ignored without affecting a conformance claim. That is too weak for two machine-readable parts of one document that directly disagree.

#### 4. Verification cost is already capability-scoped

Tools lacking the schema or validation capability may leave the rule unverified. The inability of one tool to check the rule does not require weakening what a correct example means.

### Required specification changes

Likely changes include:

1. **Examples prose** — retain the validation requirement while explicitly calling examples positive caller-facing contract claims.
2. **Schema authority** — state that examples never widen, narrow, or override operation schemas.
3. **Presence semantics** — retain the absent-versus-present-null distinction for example members.
4. **Validation scope** — exclude binding selection, transforms, invocation, source artifacts, pairwise input/output causality, and behavioral truth from the mechanical check.
5. **Unresolved schemas** — require an unverified result rather than partial validation or assumed success when the governing schema cannot be fully resolved.
6. **Recovery posture** — distinguish document non-conformance from a universal requirement that all tools refuse all processing.
7. **Conformance corpus** — cover valid and invalid input/output examples, absent schemas, absent example members, null values, boolean schemas, external-reference unavailability, and independent pair validation.

### Candidate concise language

> Operation examples are positive examples of caller-facing values. When an operation's corresponding `input` or `output` schema is specified, every provided example value for that side MUST validate against the fully resolved schema; a known mismatch makes the document non-conformant. An absent example member supplies no value, while an explicitly null member supplies the JSON value `null`. Examples do not alter schemas, invoke bindings or transforms, or establish that an example output can result from its paired input. A validator unable to fully resolve the governing schema leaves the rule unverified rather than reporting success or failure.

This is drafting material, not adopted specification text.

### What this direction does not decide

Verification-result vocabulary is settled separately by OBI-AD-015. This decision does not require validators to fetch external schemas, define negative or failure examples, turn example pairs into executable scenarios, or mandate that every processor reject all use of a non-conformant document.

## OBI-AD-015: Verification uses a three-conclusion model with rule-level evidence, not a linear level ladder

**Status:** Agreed direction; verification vocabulary and tool rule pending  
**Date:** 2026-07-13  
**Analysis question:** How should tools distinguish full verified conformance, known non-conformance, and incomplete verification without misrepresenting partial checks as a linear validation level?

### Context

OpenBindings defines document conformance as an objective property while allowing capability-limited tools to leave rules unverified. Full verification may require capabilities or resources a particular tool does not have: JSON Schema meta-validation, external schema resolution, support for every referenced binding specification, or the ability to check binding-specification-defined source and reference constraints.

A plain `valid`/`invalid` boolean cannot represent this honestly. A tool that checks only the derived JSON Schema can find no structural violation while leaving other normative rules untouched. Calling that result “valid” makes “no checked rule failed” indistinguishable from “every applicable rule was checked and passed.”

The analysis initially proposed a linear sequence such as parsed, structurally valid, internally valid, binding-format-verified, and fully verified. That model is attractive for display but inaccurate as a general semantics. Verification capabilities form independent dimensions. One tool may resolve every external schema but not support a binding specification; another may support that binding specification while operating without external network or filesystem access. Neither result is inherently a higher rung of one ladder.

### Document state and verifier conclusion

A document is objectively either conformant or non-conformant under the applicable specifications. **Conformance undetermined** is not a third intrinsic document state. It is a verifier's conclusion that its current evidence is insufficient to establish either complete conformance or a violation.

The verification vocabulary therefore describes both:

- the conclusion justified by the verifier's evidence; and
- the rule-level evidence supporting or limiting that conclusion.

### Agreed overall conclusions

A tool that reports an overall OpenBindings document-conformance conclusion uses these three meanings:

| Conclusion | Exact meaning |
|---|---|
| **Conformant** | The verifier checked every applicable document-conformance rule and established no violation. |
| **Non-conformant** | The verifier established at least one violation of an applicable document-conformance rule. |
| **Conformance undetermined** | The verifier established no violation, but one or more applicable document-conformance rules remain unverified. |

A known violation is decisive. If a verifier establishes one violation while other rules remain unverified, the overall conclusion is still **non-conformant**. The report should retain the unverified rules as additional evidence, but they cannot erase the known violation.

Conversely, absence of a known violation is not enough for **conformant**. Every applicable rule must be verified before the positive conclusion is justified.

### Rule-level outcomes

Rule-level evidence uses the following vocabulary:

- **Satisfied** — the verifier checked the rule and established that it holds.
- **Violated** — the verifier checked the rule and established that it does not hold.
- **Unverified** — the verifier did not establish either satisfaction or violation.
- **Not applicable** — the rule does not apply to the particular document or feature occurrence. A report may omit such rules if applicability remains otherwise clear.

Reports should identify violated and unverified OpenBindings rules by their stable OBI rule identifiers. Where a binding specification supplies its own stable rule identifiers, a report may use those as well. A diagnostic should explain each violation and why a rule remained unverified, but the core does not initially standardize a closed enumeration of diagnostic reasons.

Common reasons for an unverified result include an unsupported binding specification, an unavailable or policy-declined external resource, a missing verification capability, or an exceeded resource limit. None of those conditions is evidence that the rule is violated.

### Scoped results and the word valid

A tool may report narrower facts such as:

- JSON parsing succeeded;
- the document satisfies the derived structural schema;
- all offline core rules were satisfied;
- a named set of binding-specification rules was satisfied.

Those are useful scoped claims, but they must identify their scope. A derived-schema pass may be called **structurally valid against the derived schema**; it must not be presented as unqualified OpenBindings document conformance.

Tools should avoid the unqualified word **valid** because it does not reveal whether the claim means parseable JSON, derived-schema validity, a subset of rule checks, or complete conformance. If a tool uses `valid` in an existing API, it needs an explicit documented scope and a separate way to represent undetermined conformance.

“No violations found” is an accurate partial statement when rules remain unverified. It is not a synonym for conformant.

### Offline-first behavior

The vocabulary does not require network access.

An offline verifier can conclude **conformant** when every applicable rule can be checked from the document and locally available resources. When an applicable external dependency is unavailable, it records the affected rule as **unverified** and, absent a known violation elsewhere, concludes **conformance undetermined**.

Declining network access, lacking a handler for a `bindingSpec`, or reaching a resource limit does not make the document non-conformant. Likewise, an unknown binding-specification identifier is not itself a violation; only a checked failure of an applicable rule establishes non-conformance.

### Document conformance versus tool conformance

This vocabulary reports document verification. It does not redefine whether a tool itself conforms to OpenBindings.

A lightweight parser, renderer, indexer, or round-trip processor can conform to all obligations associated with the capabilities it claims while being unable to establish complete document conformance. If it offers a document-verification conclusion, the honest conclusion may be **conformance undetermined**, accompanied by the rules it did and did not verify.

Conversely, a tool with broad validation capabilities does not become conformant merely because it labels documents correctly; it must still honor every applicable OBI-T obligation for the capabilities it exercises.

### No linear verification levels

The core does not standardize a numbered or named verification ladder. Such levels would:

- impose a total ordering on capabilities that are not totally ordered;
- become brittle whenever a document rule or binding-specification check is added;
- hide which external resources or semantic authorities were actually checked;
- encourage tools to report a high level despite different gaps within that level.

User interfaces may summarize common scopes for convenience, but those summaries do not replace the overall conclusion and rule-level evidence.

### No core report serialization

The core standardizes vocabulary and truth conditions, not a JSON validation-report protocol.

A machine-readable report format would require its own decisions about schema versioning, diagnostic locations, nested causes, resource identities, timestamps, severity, remediation, and compatibility. Those are useful interface concerns but do not determine what an OpenBindings document means.

A companion validator interface or project tooling convention may define such a report later using the core vocabulary. The core likewise does not initially standardize reason codes for unverified results; stable rule identifiers plus explanatory diagnostics are sufficient until implementation experience demonstrates a shared need.

### Illustrative report

The following is explanatory, not a prescribed serialization:

```text
Overall: conformance undetermined

Satisfied:
  OBI-D-01 through OBI-D-10

Unverified:
  OBI-D-11 — external schema unavailable
  OBI-D-13 — binding specification not supported
```

If OBI-D-04 were also known to be violated, the overall conclusion would become non-conformant while the two unverified entries remained in the report.

### Required specification changes

Likely changes include:

1. **Conformance model** — distinguish objective document conformance from a verifier's evidence and conclusion.
2. **Overall vocabulary** — define conformant, non-conformant, and conformance undetermined with the truth conditions above.
3. **Rule outcomes** — define satisfied, violated, unverified, and not applicable.
4. **Tool rule** — require any tool claiming an overall document-conformance result to distinguish incomplete verification and prohibit partial verification from being reported as unqualified conformance.
5. **Stable identifiers** — require violated and unverified rules to be identified by stable rule IDs when the governing specification provides them.
6. **Structural validation language** — label derived-schema results as scoped structural validation rather than full validity.
7. **Offline behavior** — state that unavailable or declined external resources yield unverified checks rather than violations merely because they were not accessed.
8. **Documentation and examples** — replace ambiguous uses of “valid” with the appropriate scoped or conformance term.

### Candidate concise language

> A verifier reports an OpenBindings document as **conformant** only when it has verified every applicable document-conformance rule and established no violation. It reports the document as **non-conformant** when it establishes any violation. When it establishes no violation but one or more applicable rules remain unverified, **document conformance is undetermined**. A verifier reporting an overall conclusion MUST identify violated and unverified rules by their stable rule identifiers and MUST NOT present partial verification as unqualified conformance. Conformance undetermined describes the verifier's evidence, not a third intrinsic state of the document.

This is drafting material, not adopted specification text.

### What this direction does not decide

This decision does not define a machine-readable verification-report schema, standardize diagnostic locations or unverified-reason codes, create named or numbered verification levels, require external-resource fetching, or settle whether the project should publish a machine-readable rule manifest. Those remain interface, tooling, or publication questions.

## OBI-AD-016: HTTP well-known discovery is a normative companion specification, not core document semantics

**Status:** Agreed direction; core extraction and companion specification pending  
**Date:** 2026-07-13  
**Analysis question:** Should the core OpenBindings document specification normatively define `/.well-known/openbindings` and its HTTP behavior, omit discovery entirely, or point to a separate project-standard discovery specification?

### Context

The current core specification defines a standard HTTP discovery endpoint at `/.well-known/openbindings`. It specifies server response behavior, status codes, accepted response media types, `Accept` handling, redirects, authentication responses, CORS guidance, and client/server tool obligations through OBI-T-13 and OBI-T-14.

Configuration-free discovery is practically useful. Independent publishers and clients need normative agreement if they are to interoperate at a well-known location. But discovery does not determine the syntax or meaning of an OBI document. Local CLIs, embedded systems, package-distributed interfaces, in-memory documents, standard-input workflows, and filesystem consumers can use OpenBindings without HTTP or any network connectivity.

Keeping HTTP discovery inside the core therefore makes a protocol-neutral, offline-capable document specification appear to impose a web-facing conformance surface on every ecosystem. Removing all mention of the standard mechanism would avoid that implication but make the project-standard discovery path unnecessarily difficult to find and could encourage competing conventions.

### Agreed direction

The OpenBindings Project retains HTTP well-known discovery as a normative companion specification. It is not part of core OBI document semantics or core processor conformance.

The core specification should contain one clearly informative pointer, approximately:

> An OBI may be obtained through any mechanism, including local files, packages, standard input, embedded resources, or network retrieval. The optional OpenBindings HTTP Discovery specification defines publication at `/.well-known/openbindings`.

The pointer preserves discoverability of the ecosystem standard while making its optional and external status explicit.

### Core boundary

The core continues to define:

- the OBI JSON document representation;
- document semantics and conformance;
- processing rules that protect the document's portable meaning;
- the OBI media type or its registration reference, because that identifies the core document representation;
- the fact that the document's meaning does not depend on where or how it was obtained.

The core no longer normatively defines:

- the `/.well-known/openbindings` resource;
- HTTP methods or response status codes for discovery;
- `Accept` or `Content-Type` behavior at that resource;
- redirect handling;
- authentication or authorization behavior for discovery;
- discovery-specific CORS guidance;
- client or server discovery conformance;
- OBI-T-13 or OBI-T-14.

The core also does not add a discovery profile field, capability declaration, or publication location to OBI documents. Discovery is external publication behavior, not a property the document needs to declare about itself.

### Companion specification authority

The companion HTTP Discovery specification is normative for implementations that claim its conformance. It should define the well-known path and every interoperability requirement removed from the core, including the precise server and client obligations.

This is not a demotion to informal tooling documentation. The path, response behavior, media-type acceptance, and redirect rules are exactly the kind of independent-party agreement that warrants normative text. They simply warrant authority in the specification whose subject is HTTP discovery.

An implementation can therefore make separate claims:

- that a document conforms to the OpenBindings core specification;
- that a processor conforms to the core obligations associated with its capabilities;
- that an HTTP publisher or client conforms to the OpenBindings HTTP Discovery specification.

None of those claims implies the others unless an implementation explicitly makes them.

### Offline and transport-neutral consequences

A conformant OBI can be authored, validated, stored, exchanged, and consumed entirely offline. A core-conforming tool acquires no HTTP stack, redirect, CORS, or network obligation merely by processing OpenBindings documents.

The companion discovery mechanism remains available when an origin wants configuration-free HTTP publication. Its existence does not make HTTP the canonical origin of every OBI and does not supply implicit base-URI semantics to a fetched document. The context-free reference decisions remain unchanged regardless of acquisition mechanism.

### Why one informative mention remains

The core should not erase the ecosystem relationship. A short informative pointer:

- helps readers find the standard mechanism at the moment they ask how an OBI may be discovered;
- signals that `/.well-known/openbindings` is project-standard rather than an implementation accident;
- discourages needless competing discovery conventions;
- does not reproduce or partially redefine the companion specification.

The core should avoid a second miniature summary of HTTP behavior. Beyond naming the companion specification, its optionality, and the well-known path, operational details belong only in the companion.

### Costs of separation

The split creates another document, another conformance label, cross-links, and some form of version relationship. A user implementing both core processing and discovery must consult two specifications instead of one.

Those costs are proportionate because the separation follows an actual capability boundary. Keeping unrelated HTTP rules in one file would reduce document count while increasing conceptual coupling and making non-HTTP implementations appear incomplete. The companion can remain short and focused; no profile-negotiation machinery or OBI field is needed.

### Required specification changes

Likely changes include:

1. **Core scope** — remove standard discovery convention from the list of semantics the core defines and state that acquisition is out of scope.
2. **Discovery section** — move current §7's normative HTTP contract to the companion specification.
3. **Tool rules** — remove OBI-T-13 and OBI-T-14 from core tool conformance and re-express them under companion client/server conformance.
4. **Informative pointer** — retain one acquisition paragraph naming the optional companion specification and `/.well-known/openbindings`.
5. **Media type** — retain the core document media type or registration reference while moving endpoint-specific negotiation rules.
6. **References and security** — relocate discovery-specific HTTP, CORS, redirect, and authentication material while retaining any acquisition-independent core considerations.
7. **Examples and positioning** — ensure introductory examples do not imply that network publication is necessary to use OpenBindings.
8. **Project organization** — publish and cross-link a focused normative HTTP Discovery document without introducing a declaration inside OBI documents.

### Candidate concise language

> Acquisition and publication of an OpenBindings document are outside the core document semantics. An OBI may be obtained through local files, packages, standard input, embedded resources, network retrieval, or any other mechanism without changing its meaning. The optional OpenBindings HTTP Discovery specification normatively defines publication and retrieval at `/.well-known/openbindings`; implementing that companion specification is not required for core document or processor conformance.

This is drafting material, not adopted specification text.

### What this direction does not decide

This decision does not settle the companion specification's filename, independent version number, release coupling with the core, IANA registration procedure, or exact conformance-class names. It does not remove the OBI media type, prohibit other discovery mechanisms, or require any implementation to support HTTP discovery.

## OBI-AD-017: Successful boundary validation requires the complete reachable schema graph

**Status:** Agreed direction; validation clarification and invoker guidance split pending  
**Date:** 2026-07-13  
**Analysis question:** May a processor report that a value satisfies an operation schema when some statically reachable schema branch or reference is unavailable, provided the value appears not to need that branch?

### Context

Operation `input` and `output` schemas are the portable caller-facing value contracts. JSON Schema processors differ in compilation strategy, reference loading, branch evaluation, annotation collection, and short-circuit behavior. Given a schema such as:

```json
{
  "anyOf": [
    { "type": "string" },
    { "$ref": "https://example.com/unavailable-object-schema" }
  ]
}
```

one implementation might accept the value `"hello"` after the first branch succeeds. Another might attempt to resolve every branch and report that evaluation cannot complete. More complicated schemas using annotation-dependent keywords such as `unevaluatedProperties` make apparently unused branches capable of affecting the result.

The current specification resolves this variability by requiring the whole schema graph statically reachable from the operation schema to be resolvable before validation succeeds. The analysis identified real implementation and availability costs but did not find a lighter portable lazy-resolution semantics. Defining which unresolved branches may be ignored would require an evaluation-order and error-propagation model layered on top of JSON Schema and could still interact subtly with annotations.

### Agreed direction

A processor may report successful validation of an operation-boundary value only when the complete schema graph statically reachable from the governing operation schema is available, well formed, and evaluable.

Specifically:

- every schema reference statically reachable from the operation schema root must resolve;
- every resolved schema resource needed by that graph must be interpretable under its applicable JSON Schema dialect;
- cycles are permitted and must be handled without infinite traversal;
- reachability follows schema-bearing positions and reference semantics defined by the applicable JSON Schema dialect, not arbitrary objects stored under unknown annotation keywords;
- an unrelated schema in the OBI's top-level `schemas` map does not participate when it is not reachable from the operation schema root;
- an unresolved branch prevents validation success even when the particular instance appears able to succeed through another branch;
- a processor must not treat a partially resolved or partially evaluated contract as if the value had satisfied the complete contract.

The requirement is a prerequisite for a successful validation conclusion. It does not prescribe one loading algorithm. A processor may eagerly compile the graph, resolve references on demand, use a local resource registry, cache prior results, or combine those techniques. Whatever its strategy, it cannot return validation success until complete reachable-graph availability has been established.

### Core semantics versus invoker timing

The core defines the semantic boundary:

> Partial contract availability cannot produce successful operation-boundary validation.

The core does not prescribe the lifecycle of an invoker. In particular, it does not mandate exactly when a tool fetches, compiles, or caches schemas relative to source selection, connection establishment, or other runtime work.

The optional project-standard invoker interface or implementation guidance should separately recommend preflighting every required input and output schema graph before performing a binding action that may cause side effects. That guidance reduces the risk of invoking a target and only afterward discovering that the output contract cannot be evaluated. It is an invocation-sequencing policy, not part of the core meaning of schema validation.

This split aligns with OBI-AD-002: OpenBindings defines what it means for a value to cross its contract boundary but does not define a general invoker lifecycle.

### Document conformance versus evaluation availability

A dangling same-document reference remains a document-conformance violation under the core's internal referential-integrity rules. The document contains everything required to establish that failure.

An absolute external reference is different. If a processor cannot or will not retrieve its target, that fact alone does not prove the OBI document non-conformant. The external resource may exist and may be valid; the processor lacks the evidence needed to evaluate the graph.

The consequences depend on context:

- **Boundary validation:** the processor cannot report validation success and therefore cannot pass the value across that OpenBindings boundary as contract-valid.
- **Document verification:** any applicable rule requiring evaluation of the unavailable graph is unverified; under OBI-AD-015, conformance is undetermined absent another known violation.
- **Known malformed external schema:** evaluation cannot succeed, while reporting of document versus external-resource conformance should identify the actual failing resource and governing rule.

The inability to evaluate a graph is not equivalent to a schema validation mismatch. Tools should distinguish “the instance violates the schema” from “the complete schema was unavailable or could not be evaluated,” even if both prevent successful boundary passage.

### Offline-first consequences

This decision does not require internet connectivity. A self-contained OBI or a graph whose referenced resources are available locally can be evaluated completely offline.

Authors who use external references deliberately introduce external schema dependencies. A processor may decline network access or may obtain those resources from an offline registry, package, cache, or preloaded resource set. OpenBindings does not require one acquisition mechanism and does not treat an absolute HTTP URI as an instruction that every processor must fetch it live.

If an explicitly external dependency is unavailable, refusing to claim full contract validation is the honest result. Allowing partial validation would make portability depend on evaluator strategy and on which branches happened to be traversed for one instance.

### Why complete graph availability is preferable

#### 1. It gives validation success one portable meaning

Two processors evaluating the same value against the same OBI cannot disagree merely because one eagerly loads references and another short-circuits after an apparently successful branch.

#### 2. It preserves the contract's atomicity

The operation schema is one contract, not a collection from which a processor may silently use whichever parts happen to be available. A success claim should mean that the governing contract was available in full.

#### 3. It avoids an OpenBindings-specific JSON Schema evaluator

A portable lazy alternative would need rules for reference errors inside `anyOf`, `oneOf`, conditionals, negation, dependent schemas, annotations, and future combinations. Complete graph availability is stricter at runtime but lighter normatively.

#### 4. Static scope limits the cost

The processor does not need every schema stored anywhere in the document or ecosystem. It needs only the graph statically reachable from the particular operation boundary being evaluated.

### Accepted costs

- A simple value can be unable to validate because an apparently irrelevant reachable branch is unavailable.
- Large graphs can increase preparation time, memory use, and external-resource access.
- Logically unreachable but syntactically schema-reachable branches still participate unless the JSON Schema dialect itself excludes them from the schema graph.
- Implementations need cycle-safe graph traversal and resource caching to handle realistic recursive schemas efficiently.

These are real costs. They are accepted because the alternatives are either partial-contract success or a substantially larger evaluator semantics in the OpenBindings core.

### Required specification changes

Likely changes include:

1. **Validation semantics** — retain and clarify complete reachable-graph availability as a prerequisite for successful input and output validation.
2. **Terminology** — define the governing or reachable schema graph using the schema-bearing positions and reference semantics of the applicable dialect.
3. **Failure distinction** — separate instance mismatch from unavailable, unresolved, malformed, or unevaluable schema graphs.
4. **Scope** — state that unreachable top-level schemas do not block an operation boundary.
5. **Implementation freedom** — clarify that the semantic prerequisite does not mandate eager fetching or prohibit caching, local registries, or incremental resolution.
6. **Invoker material** — move pre-side-effect resolution sequencing to the optional invoker interface or implementation documentation.
7. **Offline posture** — state that external URI identity does not mandate live network retrieval and document local resource options.
8. **Conformance corpus** — cover unresolved alternate branches, annotation-sensitive schemas, unreachable named schemas, cycles, local registries, instance mismatch, and unavailable-resource diagnostics.

### Candidate concise language

> Validation against an operation `input` or `output` schema succeeds only when the complete schema graph statically reachable from that schema is available, well formed, and evaluable. A processor MUST NOT report successful validation against a partially available graph, even when the instance appears not to exercise an unavailable branch. This requirement does not prescribe eager fetching or a network acquisition mechanism; processors may use local resources, caches, registries, or any other resolution strategy. Schema unavailability and instance mismatch are distinct failures.

This is drafting material, not adopted specification text.

### What this direction does not decide

This decision does not prohibit external schema references, require processors to fetch network resources, mandate a cache or resource-registry API, prescribe invoker sequencing, define resource limits, or make external-resource availability itself a document-conformance rule.

## OBI-AD-018: `version` remains an opaque non-empty interface-version label

**Status:** Agreed direction; metadata clarification and schema tightening pending  
**Date:** 2026-07-13  
**Analysis question:** Should the optional top-level `version` field be removed, renamed, or given stronger compatibility semantics because it sits beside the normative `openbindings` specification-version field?

### Context

An OBI currently has two version-related fields with deliberately different authority:

- required `openbindings` selects the OpenBindings specification semantics under which the document is interpreted and participates in mandatory tool version acceptance or refusal;
- optional `version` is the author's own interface contract version and is opaque to the core.

The proximity of the fields can cause confusion, and project documentation repeatedly explains that an interface's release version differs from the OpenBindings format version. At the same time, the project makes real use of the optional field across its published shared interfaces, release filenames, catalogs, and compatibility workflows. Removing it would push a common practical label into unrelated extensions, while giving it universal SemVer or compatibility behavior would impose one ecosystem's release policy on every OBI author.

### Agreed direction

The core retains the optional top-level field named `version`.

When present, it is a non-empty, opaque **interface-version label** controlled by the document author. OpenBindings assigns it no:

- ordering or comparison semantics;
- Semantic Versioning interpretation;
- compatibility or substitutability meaning;
- document identity;
- reference-resolution role;
- selection, negotiation, or refusal behavior.

Tools may preserve, display, index, search, or group by its exact value. Any stronger interpretation comes from an explicitly external publication, catalog, registry, compatibility, or organizational policy rather than from core OpenBindings semantics.

The defining comparison is:

| Field | Meaning |
|---|---|
| `openbindings` | Normative version of the OpenBindings specification governing document interpretation and tool compatibility. |
| `version` | Author-controlled label for the described interface; opaque to the core. |

### Why the field remains useful

Interfaces evolve independently of the specification language used to express them. A newly created interface can begin at its author's version `0.1.0` while being written as an OpenBindings `0.2.0` document. A later interface release may change its own label without changing the governing OpenBindings version, and a later OpenBindings serialization may represent the same interface release without assigning the interface a new semantic identity through the core.

Catalogs, documentation, package layouts, immutable-publication policies, and human workflows commonly need such a label. Providing one interoperable metadata field is lower-cost than encouraging every ecosystem to invent `x-interface-version`, `x-release`, or another incompatible extension.

### Why the name remains `version`

The alternatives do not improve the model enough to justify a rename:

- **`interfaceVersion`** is clearer in isolation but can imply that OpenBindings defines a formal interface identity to which the version attaches.
- **`contractVersion`** can imply core-defined compatibility or evolution semantics.
- **`revision`** suggests ordering or monotonic succession.
- **`versionLabel`** is precise but awkward and uncommon in authored documents.

At the top level of an OpenBindings interface document, `version` is conventional and already used throughout the project. The ambiguity is better resolved by placing the comparison with `openbindings` prominently and using **interface-version label** consistently in prose.

### Non-empty when present

The derived schema should require `version` to have at least one character when present. An empty string provides no usable label and creates a second practical spelling of absence.

The core does not trim, normalize, case-fold, or otherwise constrain the label's contents. It does not attempt to reject whitespace-only labels or enforce a version grammar; doing so would introduce arbitrary text policy after deliberately choosing an opaque value. Authors and publishers remain responsible for selecting useful labels.

### External policies remain possible

An interface publisher may require SemVer, calendar versions, immutable versioned files, content hashes, or another discipline. A compatibility tool may accept a reference interface identified through an external catalog and use its `version` label in display or policy. Those systems compose with the field without becoming OpenBindings-wide rules.

The OpenBindings Project may therefore continue its own convention of SemVer-like shared-interface releases and immutable publication. That convention is project policy governing project artifacts, not a semantic consequence every consumer can derive from another author's `version` string.

### Required specification changes

Likely changes include:

1. **Field definition** — describe `version` consistently as an optional opaque interface-version label.
2. **Derived schema** — add `minLength: 1` without adding a version pattern or format.
3. **Version comparison** — place a compact `openbindings` versus `version` table near the root-field definition or versioning discussion.
4. **Negative implications** — state that `version` provides no core identity, compatibility, ordering, selection, negotiation, or refusal semantics.
5. **Organization** — fold the current standalone contract-version prose into the metadata or root-field discussion if the separate subsection no longer earns its place.
6. **Project documentation** — continue distinguishing interface release policy from core semantics and avoid presenting the project's convention as universal.
7. **Conformance corpus** — add an empty-string rejection case and representative opaque labels using SemVer, dates, and non-version-like author conventions.

### Candidate concise language

> `version`, when present, is a non-empty author-controlled label for the described interface. It is opaque to OpenBindings and does not identify the document or imply ordering, compatibility, Semantic Versioning, selection, negotiation, or tool-version behavior. The required `openbindings` field separately identifies the OpenBindings specification version governing document interpretation.

This is drafting material, not adopted specification text.

### What this direction does not decide

This decision does not define interface identity, prescribe an interface publication or immutability policy, require SemVer, or standardize compatibility across interface releases. OBI-AD-022 separately revises the OpenBindings specification-version acceptance rules attached to `openbindings`.

## OBI-AD-019: JCS remains an optional partial canonical serialization in an informative appendix

**Status:** Agreed direction; appendix correction and implementation audit pending  
**Date:** 2026-07-13  
**Analysis question:** Should the core retain, relocate, or remove its RFC 8785 canonical-form section, and does every conformant OBI actually have a JCS representation?

### Context

The current specification includes a short informative section naming [RFC 8785 JSON Canonicalization Scheme (JCS)](https://www.rfc-editor.org/rfc/rfc8785.html) as the canonical form of an OBI. It says that a document containing `NaN` or infinity has no canonical form.

That explanation is incomplete and partly misdirected. `NaN` and infinity are already outside the RFC 8259 JSON number grammar and therefore cannot occur in a conformant parsed OBI. JCS has broader input requirements: its input is adapted to the I-JSON subset, object names are unique, string data must be valid for its Unicode processing, and number data must be representable through its IEEE-754 binary64 model. A JCS implementation errors on incompatible input such as invalid Unicode strings.

OpenBindings currently selects RFC 8259 JSON and JSON Schema 2020-12 rather than the JCS input subset. [JSON Schema 2020-12 explicitly does not bound JSON numbers to an implementation's numeric precision](https://json-schema.org/draft/2020-12/json-schema-validation#section-4.2). Operation schemas, examples, extensions, and binding-specification-defined embedded source content can therefore contain valid JSON data that is not safely representable as JCS input.

Constraining all OpenBindings documents to JCS merely to make an optional digest convenience universal would narrow legitimate contract and source data, add numeric and Unicode rules to baseline document conformance, and conflict with OBI-AD-013's generic content carriage. Removing all shared convention, however, would discard an established project practice already used by SDKs and published interfaces for stable hashing and comparison.

### Agreed direction

OpenBindings retains RFC 8785 JCS as its recommended optional canonical **serialization** and moves the material to an informative appendix.

The facility is partial:

- core OBI document conformance does not require JCS input compatibility;
- no OpenBindings processor is required to implement canonical serialization;
- a parsed OBI satisfying RFC 8785's input requirements can be serialized according to JCS;
- a conformant OBI that does not satisfy those input requirements has no JCS canonical serialization;
- a JCS implementation must fail according to RFC 8785 rather than round, coerce, repair, normalize, or otherwise change a value to manufacture compatible input.

The appendix names a shared project convention without adding a baseline OBI document rule or processor capability. A downstream specification or interface requiring canonical bytes can normatively require RFC 8785 for its own purpose and must handle or prohibit inputs for which JCS is undefined.

### Canonical serialization is not semantic normalization

The term **canonical serialization** is preferable to the broader **canonical form**. JCS gives one deterministic byte encoding for one compatible parsed JSON value. It does not identify a canonical representative of every semantically equivalent OpenBindings interface.

In particular, canonical serialization does not:

- rewrite `{}` to `true` or otherwise normalize equivalent JSON Schemas;
- resolve, inline, bundle, or reorder references;
- insert defaults or remove omitted optional fields;
- normalize operation keys or aliases;
- reorder arrays;
- normalize binding-specification identifiers, locations, or refs;
- interpret or normalize embedded `content` through its `bindingSpec`;
- remove unknown fields or extensions;
- prove document conformance.

The complete carried JSON value participates, including unknown fields, extension fields, examples, schemas, and embedded source content. JCS recursively sorts object property names and preserves array order as specified by RFC 8785.

Two OBIs can therefore express equivalent represented contracts while producing different canonical bytes. Conversely, equal JCS bytes establish equal carried JSON data under the JCS model, not behavioral equivalence, shared document identity, or binding substitutability.

### No lossy adaptation

The phrase “adapted for I-JSON” in RFC 8785 must not become permission for an OpenBindings canonicalizer to silently change already parsed OBI data.

For example, converting an arbitrary-precision integer to binary64 and serializing the rounded result would produce bytes for a different JSON numeric value. A canonicalization API receiving an incompatible value must report failure unless the caller explicitly transformed its own data before asking to canonicalize it. Such caller transformation creates a different document and is outside canonical serialization.

This rule is especially important when canonical bytes feed content hashes, signatures, trust decisions, cache keys, or equality comparisons. Silent coercion would make those mechanisms attest to data other than the data the author supplied.

### Relationship to integrity and signing

Naming a deterministic serialization does not define a complete integrity or signature system. The appendix does not select:

- a digest algorithm or encoding;
- a signature algorithm or envelope;
- a field in which a digest or signature is carried;
- whether any such field is removed before serialization;
- key identity, trust, revocation, or verification policy;
- how external schemas or source artifacts are pinned;
- whether dereferenced resources participate in an attestation.

Downstream specifications must define those choices. By default, JCS covers the JSON value carried in the OBI itself and does not fetch or incorporate external resources.

### Why an appendix is the right placement

Canonical serialization is useful to content addressing, integrity systems, stable caches, and project tooling, but it is not needed to interpret operations, sources, bindings, schemas, or transforms. Keeping it in the main semantic flow gives it disproportionate prominence.

An informative appendix:

- preserves one discoverable project-wide convention;
- avoids a separate companion specification for a short reference to an existing RFC;
- makes its non-conformance status visible;
- keeps downstream specifications from inventing incompatible “sort the keys” algorithms;
- leaves the core narrative focused on interface meaning and portability.

Removing it entirely would force readers to infer the project's established JCS convention from SDKs and downstream documents. Creating a separate canonicalization specification would add versioning and publication machinery without adding meaningful OpenBindings-specific semantics.

### Implementation audit

The project implementations need review against the no-loss rule.

The current Go canonicalization helper parses JSON number lexemes through `float64` before serialization. A sufficiently large or precise numeric lexeme can therefore be rounded into a different value instead of being rejected as incompatible. The TypeScript path similarly operates in an ecosystem where ordinary JSON parsing produces JavaScript `number` values before canonicalization and may already have discarded lexical precision.

The audit should determine and document each API's input model, add incompatible-number and invalid-Unicode cases, and ensure that an API claiming to canonicalize an existing OBI never silently changes its values. A lower-level API operating only on already-created binary64 numbers may legitimately JCS-serialize those values, but it must not claim lossless canonicalization of a raw OBI whose parsing already changed them.

### Required specification changes

Likely changes include:

1. **Placement** — move the current canonical section from the main flow to an informative appendix.
2. **Terminology** — rename the concept from canonical form to optional JCS canonical serialization.
3. **Partiality** — state that core-conformant OBIs need not satisfy JCS input requirements and may have no JCS serialization.
4. **Correct prerequisites** — replace the `NaN`/infinity caveat with an accurate reference to RFC 8785's full input requirements.
5. **No coercion** — state that incompatible input produces failure rather than a rounded, repaired, or normalized document.
6. **Syntactic scope** — clarify that the complete carried JSON value participates and that semantic equivalence is not normalized.
7. **Integrity boundary** — state that canonical serialization alone defines no hashing, signing, trust, or external-resource inclusion scheme.
8. **SDK audit** — test and correct Go and TypeScript canonicalization behavior and documentation for precision-loss and invalid-string cases.

### Candidate concise language

> **Canonical serialization (informative).** For an OBI whose parsed JSON value satisfies the input requirements of RFC 8785, its JCS serialization provides deterministic bytes for the complete carried JSON value. Canonical serialization is optional and is not defined for every conformant OBI; core conformance neither requires JCS-compatible input nor requires processors to implement canonicalization. An implementation must not round, coerce, repair, or semantically normalize a document to produce JCS bytes. JCS does not resolve external resources or establish document identity, semantic equivalence, integrity, signatures, or trust.

This is drafting material, not adopted specification text.

### What this direction does not decide

This decision does not constrain all OBI numbers or strings to the JCS/I-JSON subset, define a digest or signature profile, pin external resources, create a canonicalization conformance class, or prescribe the exact SDK API used to report incompatibility.

## OBI-AD-020: Binding preference uses the interoperable signed safe-integer domain

**Status:** Agreed direction; schema tightening pending  
**Date:** 2026-07-13  
**Analysis question:** What exact numeric domain should `bindings[*].preference` use?

### Context

OBI-AD-005 retains binding-level `preference` as an optional ordinal author signal while removing source-level inheritance and any core selection algorithm. The existing schema nevertheless accepts every JSON number, including fractions, exponent forms, and integers too large for common JSON implementations to preserve exactly.

Those representations add no meaningful expressive power to an ordinal hint. Preference conveys relative ordering only; it is not a measured quantity, weighting coefficient, probability, price, or value that tools combine arithmetically. Allowing values that different implementations may parse or compare differently would create interoperability risk in a field whose only portable content is its ordering.

### Agreed direction

`bindings[*].preference` accepts signed integers from `-9007199254740991` through `9007199254740991`, inclusive. This is the interoperable exact-integer range commonly called the JSON safe-integer domain.

Specifically:

- The JSON Schema type is `integer`.
- `minimum` is `-9007199254740991` and `maximum` is `9007199254740991`.
- Higher values express stronger author preference among bindings of the same operation.
- Equal values express no ordering between those bindings through this field.
- Absence means that the author states no preference for that binding. It is not equivalent to `0` or to any other numeric value.
- Zero and negative values have no intrinsic category or baseline meaning. They are ordinary values whose only defined relation is numeric ordering against other present preference values.
- Preference values are not inherited, added, averaged, normalized, or otherwise combined by the core specification.
- Per OBI-AD-005, a tool remains free to ignore the signal or combine it with its own policy; this numeric constraint does not reintroduce a selection algorithm.

The resulting rule is:

> Preference is a precisely representable ordinal label, not a score with core-defined arithmetic or policy.

### Why use integers

Fractions and arbitrary decimal precision are unnecessary for ordering. An author can express any finite intended ordering with integers, and the safe-integer domain supplies vastly more distinct ranks than a practical OpenBindings document can require.

Restricting the field to integers also makes its intended semantics clearer. A decimal value could imply a measurement or tunable weight, while this field communicates only that one binding is more preferred than another.

### Why bound the integers

An unbounded JSON Schema integer would be mathematically clean but operationally misleading. Many JSON APIs materialize numbers using IEEE 754 binary64 values; beyond the safe-integer range, distinct integers can collapse to the same runtime value or be rounded during parsing. Requiring arbitrary-precision parsing solely for a selection hint would be disproportionate.

The chosen bounds are therefore an interoperability constraint rather than a statement that implementations should use JavaScript or binary64 internally. Languages and parsers with broader exact-number support remain free to use it.

### Why retain signed values

Non-negative integers would be sufficient to encode any ordering, but prohibiting negative values would add a restriction without improving comparison safety or semantics. Signed values let authors arrange local ranks around zero when convenient while the specification remains explicit that zero is not the meaning of omission and has no privileged status.

### Consequences for documents and tools

- Existing preference values that are fractional or outside the safe-integer range must be changed when migrating to the revised specification.
- A schema validator can enforce the complete numeric domain directly.
- A tool honoring preference can compare accepted values exactly using ordinary integer-capable representations available across common platforms.
- Tools must preserve the distinction between a missing preference and a present preference of `0`.
- The restriction applies only to `bindings[*].preference`; it does not impose a general safe-integer restriction on schemas, embedded binding content, examples, or other JSON numbers carried by OpenBindings.

### Required specification changes

Likely changes include:

1. **Schema** — change `bindings[*].preference` from unrestricted `number` to `integer` with the agreed inclusive bounds.
2. **Bindings prose** — define higher, equal, missing, zero, and negative values using the ordinal semantics above.
3. **Selection prose** — avoid describing omission as a numeric baseline and retain OBI-AD-005's statement that consumers own selection policy.
4. **Examples and fixtures** — replace any fractional or out-of-range preference values and add boundary and omission-versus-zero cases.

### Candidate concise language

> `preference` is an optional signed integer from -9007199254740991 through 9007199254740991. Among bindings for the same operation that declare it, a higher value expresses stronger author preference and equal values express no ordering through this field. Omission states no preference and is not equivalent to zero. Tools decide whether and how to use the signal; OpenBindings defines no selection algorithm.

This is drafting material, not adopted specification text.

### What this direction does not decide

This decision does not define candidate-set construction, automatic selection, the relationship between preference and deprecation, tie-breaking, fallback, retries, or any arithmetic interpretation of preference. It also does not constrain numbers elsewhere in an OpenBindings document to the safe-integer domain.

## OBI-AD-021: Core names use a narrow exact-match ASCII token grammar that permits leading digits

**Status:** Agreed direction; identifier grammar clarification pending  
**Date:** 2026-07-13  
**Analysis question:** Is the core identifier grammar justified, and should it continue to prohibit leading digits?

### Context

The current specification applies one grammar to operation, binding, source, transform, schema, and example map keys and to operation aliases:

```regex
^[A-Za-z_][A-Za-z0-9_.-]*$
```

A constrained alphabet serves real portability purposes, but the first-character rule was justified mainly as code-generation friendly. That justification is incomplete: because the grammar already permits dots and hyphens, an accepted OpenBindings name is not necessarily a native identifier in common programming languages. Code generators already need a naming or escaping policy.

The discussion of shared operation correspondence in OBI-AD-004 also establishes that dotted ASCII names are sufficient for qualified ecosystem names. Core names do not need to become URIs, paths, or a second locator system.

### Agreed direction

OpenBindings retains one narrow ASCII grammar for its defined map keys and operation aliases, but permits an ASCII digit as the first character:

```regex
^[A-Za-z0-9_][A-Za-z0-9_.-]*$
```

Specifically:

- The first character is an ASCII letter, ASCII digit, or underscore.
- Subsequent characters are ASCII letters, ASCII digits, underscores, dots, or hyphens.
- Names are non-empty as a consequence of the grammar.
- Matching and reference resolution use exact, case-sensitive string equality.
- Processors do not trim, case-fold, Unicode-normalize, punctuation-normalize, or otherwise rewrite names.
- Dot and hyphen have no core structural semantics. A dot may be used by authoring convention to qualify a shared operation identifier, but OpenBindings does not parse the resulting segments or treat them as a hierarchy.
- Names are not URIs, paths, JSON Pointers, package names, or native programming-language identifiers merely because their spelling resembles one of those forms.
- The same grammar continues to apply uniformly rather than creating separate local-name and operation-name systems.

The resulting principle is:

> A core OpenBindings name is a portable, opaque ASCII token with exact-match semantics.

### Why retain a constrained alphabet

Allowing arbitrary non-empty Unicode strings would broaden author choice but introduce normalization choices, visually confusable identifiers, invisible characters, whitespace handling, display ambiguity, and greater variance across code generators and command-line tools. OpenBindings needs none of that expressiveness for local references or qualified operation names.

The retained alphabet is sufficient for ordinary camel case, snake case, kebab case, dotted qualification, numeric components, and combinations of those conventions. It also excludes `/` and `~`, so a named transform can appear as the final token in its OpenBindings-defined JSON Pointer reference without JSON Pointer escaping. Excluding whitespace and URI-reserved punctuation similarly keeps names portable without suggesting locator semantics.

### Why permit a leading digit

Leading digits are safe in JSON object keys, exact string references, and the restricted JSON Pointer use above. Prohibiting them does not make every accepted name a source-language identifier because dots and hyphens already require generator handling.

The prohibition also rejects otherwise ordinary names such as `3dModel`, `2fa.verify`, or a qualified name whose publisher-controlled prefix begins with a digit. Widening the first-character class removes that unsupported policy choice without affecting any document accepted under the previous grammar.

### Why not permit every punctuation character

The purpose of this change is not to make names an open-ended notation surface. Colons, slashes, `@`, URI syntax, and similar punctuation would create additional apparent conventions without core semantics and are unnecessary for collision-resistant dotted qualification. A publisher that needs richer or resolvable identity can define an external catalog or profile; the core operation-name mechanism remains deliberately lighter.

### Consequences for documents and tools

- Every document accepted by the old grammar remains accepted by the new grammar.
- Documents may use leading-digit names without a special alias or prefix.
- Implementations must not rely on a core name being a valid native identifier; generators continue to apply their own deterministic escaping or naming policy.
- Name lookup, collision checks, operation alias resolution, and internal reference integrity all use exact case-sensitive comparison.
- The change does not alter `bindingSpec`, which OBI-AD-009 separately defines as an opaque non-empty string with its own decentralized naming considerations.

### Required specification changes

Likely changes include:

1. **Derived schema** — replace every occurrence of the old core-name pattern with `^[A-Za-z0-9_][A-Za-z0-9_.-]*$`, including named-transform reference constraints.
2. **Document rules** — update OBI-D-03 and the document-shape prose with the new grammar.
3. **Identifier semantics** — state exact, case-sensitive matching and the absence of normalization.
4. **Qualification guidance** — retain dotted qualification as an authoring convention while stating that punctuation is opaque to the core.
5. **Code-generation rationale** — replace claims that accepted names are directly code identifiers with the narrower portability rationale.
6. **Conformance corpus** — add leading-digit positive cases, excluded-character negative cases, case-distinct names, and exact-match reference cases.

### Candidate concise language

> Core OpenBindings names—operation, binding, source, transform, schema, and example keys, and operation aliases—match `^[A-Za-z0-9_][A-Za-z0-9_.-]*$`. Names are opaque and compared using exact, case-sensitive string equality; processors do not normalize them. Punctuation has no structural meaning in the core, although authors may use dotted qualification to reduce cross-document operation-name collisions.

This is drafting material, not adopted specification text.

### What this direction does not decide

This decision does not define a global namespace registry, make names dereferenceable, assign hierarchy or version semantics to dotted segments, prescribe a code generator's emitted identifiers, or change the unrestricted opaque-string model selected for `bindingSpec`.

## OBI-AD-022: Processors interpret only explicitly supported OpenBindings specification versions

**Status:** Agreed direction; version-processing simplification pending  
**Date:** 2026-07-13  
**Analysis question:** Which `openbindings` specification versions may a processor interpret, and what compatibility may it infer from Semantic Versioning?

### Context

The required `openbindings` field identifies the version of the OpenBindings specification against which a document is declared. The current specification requires a Semantic Versioning 2.0.0 value and defines an automatic acceptance algorithm:

- a different major version is a refusal boundary;
- before 1.0, a different unsupported minor version is also a refusal boundary;
- after 1.0, every minor within a supported major is treated as mutually readable because new minors may add only optional fields and processors ignore unknown fields;
- patch changes never trigger refusal;
- prereleases require specific support.

This combines two different concerns: how the OpenBindings Project evolves its specification, and which specification versions a particular implementation has actually implemented.

The post-1.0 minor rule also overreads Semantic Versioning. A backward-compatible `1.1` specification can preserve everything that a `1.0` document means while adding a new feature. That does not establish the inverse proposition that a `1.0` processor understands a `1.1` document that uses the feature. Treating unknown optional fields as safely ignorable would require every future minor addition to be semantically irrelevant to older processors, a restrictive forward-compatibility promise that SemVer itself does not make.

### Agreed direction

The `openbindings` field remains a Semantic Versioning 2.0.0 specification-version identifier. SemVer governs the OpenBindings Project's release compatibility claims, but does not automatically expand a processor's supported versions.

Specifically:

- A processor has an explicitly supported set of released OpenBindings specification versions. The set may be represented or documented as individual versions, intervals, release lines, or another unambiguous implementation convention.
- A processor interprets a document under OpenBindings semantics only when the declared `openbindings` version belongs to that supported set.
- A processor encountering any other version produces a version-refusal outcome rather than interpreting the document using different-version semantics.
- Supporting one version does not by itself imply support for any higher or lower major, minor, or patch version.
- A processor may deliberately support a complete compatible release line such as `0.2.x`; that is an implementation support declaration, not an inference imposed by the core.
- A prerelease is supported only when the processor explicitly includes that prerelease in its supported set. Supporting its eventual release does not imply prerelease support.
- SemVer build metadata is permitted but has no OpenBindings semantics and is ignored when determining whether a declared version belongs to the processor's supported set. For support purposes, `0.2.0+build.1` denotes the same specification semantics as `0.2.0`.
- A processor may parse, preserve, display, route, or inspect enough of an unsupported document to identify and report its declared version. “Version refusal” prohibits unsupported semantic interpretation; it does not require failure before JSON parsing or prohibit version-aware tooling.
- Unknown-field tolerance applies while processing a version the processor supports. It does not authorize a processor to accept an unsupported future version by ignoring additions.
- The core does not require a standardized machine-readable syntax through which a tool publishes its supported set.

The resulting rule is:

> SemVer describes the specification publisher's compatibility promise; explicit implementation support determines whether a processor may interpret a document.

### Why explicit support is the correct boundary

#### 1. Backward compatibility is not forward comprehension

A new minor specification may be compatible with documents written to the previous minor while still introducing document content an older processor cannot understand. A rule that accepts every same-major future minor reverses the compatibility direction.

#### 2. Unknown fields are not universally semantically inert

Ignoring unknown fields is useful for extensions, round-tripping, and additions known to be optional for a particular processing task. It cannot prove that every future core field is irrelevant to the action an older processor is about to take.

Forcing that proof as a permanent release-policy constraint would make useful future additions difficult. A new field could never qualify behavior, impose a safety condition, refine correspondence, or affect a capability unless older processors refusing to understand it remained possible.

#### 3. Actual support is already implementation-specific

Libraries and tools ship at different times, implement different conformance capabilities, and may intentionally retain several specification families. No comparison of two SemVer values can establish what code an implementation contains. An explicit support set states the relevant fact directly.

#### 4. Refusal is safer than silent reinterpretation

An unsupported document may happen to use only an older subset. Refusing it can therefore be conservative. The alternative can silently act on a document whose new semantics matter, which is a more serious failure than requiring the user to update the tool or deliberately broaden its supported set.

### Why retain SemVer

Removing automatic processor inference does not make SemVer useless. It still supplies a familiar syntax and a project-governance contract for classifying breaking changes, compatible additions, fixes, and prereleases. It also gives implementations a convenient basis for declaring supported release lines or ranges when the maintainers have verified them.

The distinction is that SemVer informs an implementation's support declaration; it does not substitute for one.

### Consequences for tools and documents

- A document's `openbindings` value remains mandatory and syntactically validated as SemVer.
- Structural schema validation can establish the field's syntax but cannot establish that a particular processor supports the declared version.
- Tools should report an unsupported specification version distinctly from document non-conformance. The document may conform to the version it declares even though this processor cannot verify or interpret it.
- A parser or editor may round-trip an unsupported document without claiming to understand its OpenBindings semantics.
- Reference implementations should publish or otherwise expose the versions they support clearly enough for users and conformance tests.
- Existing conformance fixtures and SDK helpers that infer post-1.0 forward acceptance, or describe a future same-major minor as inherently acceptable, need revision.

### Required specification changes

Likely changes include:

1. **Versioning** — separate project release compatibility from processor version support.
2. **Tool rule** — replace the higher/lower major/minor algorithm in OBI-T-04 with explicit supported-set membership and version refusal.
3. **Terminology** — replace “refuse to parse” with “version-refuse” or “refuse semantic processing,” allowing enough parsing to diagnose the version.
4. **Unknown fields** — state that unknown-field tolerance does not override version support.
5. **Derived schema** — retain SemVer syntax validation while making clear that schema success says nothing about processor support.
6. **Conformance corpus** — parameterize version tests by each implementation's declared support rather than assuming automatic post-1.0 higher-minor acceptance.
7. **SDKs** — replace inferred version-family logic with explicit supported-version configuration or constants.

### Candidate concise language

> A processor MUST interpret a document under OpenBindings semantics only when the document's `openbindings` value identifies a specification version the processor explicitly supports. Otherwise it MUST report a version refusal. A processor MAY parse, preserve, or inspect an unsupported document to identify or report its version, but MUST NOT claim to interpret it according to a different version. Semantic Versioning governs OpenBindings release compatibility; it does not cause support for one version to imply processor support for another. Prereleases require explicit support.

This is drafting material, not adopted specification text.

### What this direction does not decide

This decision does not standardize a machine-readable tool-capability document, require one particular range-expression syntax, prescribe how many historical versions a tool supports, or define a migration mechanism between specification versions.

## OBI-AD-023: The core defines no portable failure contract

**Status:** Agreed direction; scope statement pending  
**Date:** 2026-07-13  
**Analysis question:** Should the core define a portable failure contract (analysis §10.2, §14.2), which no earlier entry ruled on?

### Context

The analysis ranked the absence of portable failure semantics among the specification's most consequential gaps and suggested that "a minimal optional error contract may be practically necessary." The independent adversarial review of this record (2026-07-13) noted that every other headline analysis item received a decision entry while this one was only implicitly answered by the scope notes of OBI-AD-001, OBI-AD-002, and OBI-AD-014. The question is now closed explicitly.

The surrounding decisions already position the pieces: operation `output` describes successful caller-facing values only; which outcomes of a binding constitute success is part of the binding specification's completeness floor (OBI-AD-009); and the optional operation-invoker interface lists structured interface-level failure representation among its subjects (OBI-AD-006).

### Agreed direction

The rejection is explicit: the core OpenBindings specification defines no failure vocabulary.

Specifically:

- The core defines no error identifiers, error detail schemas, retryability classification, or failure taxonomy.
- Operation `output`, when specified, describes successful caller-facing values only. Failure outcomes are not operation results and have no portable core representation.
- Classification of a binding's outcomes into success and failure remains binding-specification authority under the OBI-AD-009 completeness floor.
- A portable failure representation, if standardized anywhere in the project, belongs to the optional operation-invoker interface (OBI-AD-006) or another companion, not to the core document model.
- Operation examples remain positive examples of successful values (OBI-AD-014); no failure-example semantics are introduced.
- The rewritten specification carries one scope sentence stating this boundary, and rewords the current success/error-variant language in §6.1 so that `output` alternation is described as covering heterogeneous successful values, never failure outcomes.

### Why rejection over a minimal failure map

A failure contract is invocation-surface machinery: failures are exchanged at invocation boundaries, and OBI-AD-002 removed the core's ownership of that surface. A cross-protocol failure taxonomy would also require exactly the kind of cross-format ontology (mapping HTTP statuses, gRPC codes, MCP errors, and future protocols into one vocabulary) that OBI-AD-001 declined for interaction shape. The seam the core actually needs already exists: the binding specification says which outcomes are successes, and everything else is not a result.

### What this direction does not decide

This decision does not prevent the operation-invoker interface from defining a structured failure representation for its own boundary, and does not prohibit a future optional companion or profile from adding failure vocabulary on its own evidence.

## OBI-AD-024: Example-validation conformance is scoped to document-internal schema graphs

**Status:** Agreed direction; OBI-AD-014 refinement pending  
**Date:** 2026-07-13  
**Analysis question:** Should a provided example whose governing schema graph requires external resources be able to determine document conformance?

### Context

OBI-AD-014 made a known example/schema mismatch a document-conformance failure. The adversarial review identified a consequence neither the analysis nor that entry confronted: when an operation schema reaches through an external `$ref`, the document's conformance becomes a function of a third party's resources over time. A document could flip between conformant and non-conformant with zero byte changes, which sits poorly with OBI-AD-015's framing of conformance as an objective property of the document.

### Agreed direction

OBI-AD-014 is refined rather than reversed. Example validation binds document conformance only where it is intrinsic to the document:

- For each provided example member (`input` or `output` side, independently): when the governing schema graph statically reachable from the corresponding operation schema (per OBI-AD-017 reachability) resolves entirely within the document, a validation mismatch is a document-conformance failure, exactly as OBI-AD-014 states.
- When that graph requires any external resource, the document-conformance rule does not apply to that example member. Tools MAY still resolve, validate, and surface a mismatch as a diagnostic, reported under the OBI-AD-015 vocabulary as verification evidence rather than as document non-conformance.
- The operation schema remains authoritative either way; an example never widens, narrows, or overrides it.

A consequence worth stating in the rewritten specification: together with OBI-AD-010's locally available meta-schemas, every core document-conformance rule is now decidable from the document and locally bundled resources alone. Binding-specification-dependent rules retain the partial-verification posture, but no core rule's outcome depends on network state, and document conformance is stable over time.

### Accepted cost

The rule's force now depends on where schemas live: an author who wants conformance-checked examples keeps the relevant schema graphs internal to the document (as the project's published interfaces already do). The specification states this asymmetry plainly rather than leaving it implicit.

### What this direction does not decide

This decision does not change OBI-AD-017's validation semantics, does not discourage or restrict external schema references, and does not require any tool to fetch external resources for diagnostic example checking.

## OBI-AD-025: The correspondence verb is "corresponds" project-wide

**Status:** Agreed direction; core wording and cross-repo vocabulary updates pending  
**Date:** 2026-07-13  
**Analysis question:** Does OBI-AD-004's terminology split (normative "corresponds", informal "satisfies") hold, or does the project adopt one verb everywhere?

### Context

OBI-AD-004 replaced satisfaction-by-name-adoption with correspondence terminology in the normative core while permitting project documentation to keep "satisfies" informally with a stated narrower meaning. The adversarial review flagged that split as institutionalized drift: the specification is the verb's only formal definition site (the current text uses "satisfies" exactly twice, both definitional — §5 and §6.1 — with no rule, field, or schema depending on the word), so a teaching layer using a verb the normative layer no longer defines would permanently carry two vocabularies for one act. The earlier project vocabulary settlement (2026-06-12) had ratified one noun (interface) and one verb (satisfies); this entry supersedes the verb half of that settlement.

### Agreed direction

One verb, project-wide: an operation **corresponds to** (or **claims correspondence with**) a shared contract's operation by adopting its identifier as a key or alias.

- The normative core uses correspondence terminology exclusively, per OBI-AD-004.
- "Satisfies" is retired everywhere: published interfaces prose, the web teaching layer, CLI help, UI copy, and the design-philosophy vocabulary canon. OBI-AD-004's allowance for informal "satisfies" is withdrawn.
- The vocabulary canon becomes: one noun (interface), one verb (corresponds). "Compatible with" remains available only where a comparison policy and result are in view, per OBI-AD-004.
- The noun settlement is unchanged: the adopted side is "a published interface" / "a shared contract", never "a role".

### Why one verb

Accuracy beats incumbency, and pre-release is the only cheap moment to change. The connotation of "satisfies" outruns its definition — the exact overselling OBI-AD-004 diagnosed — and the swap costs two sentences in the specification itself. The entire remaining cost is the coordinated teaching-layer sweep, which is a bounded rename rather than a semantic change.

### Follow-up work

Web route and page rename (`/satisfying-an-interface`), published-interfaces prose sweep, design-philosophy vocabulary-canon update, and a check for the verb in Panjir UI copy and CLI help. These ride the same cross-repo pass as the `bindingSpec` rename.

### What this direction does not decide

This decision does not reintroduce any role vocabulary, define a compatibility algorithm, or change OBI-AD-004's model of what a correspondence claim asserts.

## OBI-AD-026: Project binding-specification identifiers use `openbindings.<name>@<rev>`

**Status:** Agreed direction; example and publication convention pending  
**Date:** 2026-07-13  
**Analysis question:** What identifier convention do project-published binding specifications use, and what do specification examples show — both left open by OBI-AD-009?

### Agreed direction

Binding specifications published by the OpenBindings Project are identified as `openbindings.<name>@<rev>`:

- Examples: `openbindings.openapi@1`, `openbindings.mcp@1`, `openbindings.usage@1`.
- `<rev>` is a small integer revision of the binding specification itself. An incompatible change to the binding specification publishes the next revision — a different exact identifier, satisfying OBI-AD-009's new-identifier requirement. Compatible clarification does not change the identifier.
- Artifact and dialect versions never appear in the identifier. The artifact self-identifies where its format provides for that (an embedded OpenAPI document declares `openapi: 3.1.0`), and the binding specification's accepted-representations list states which artifact versions it accepts, per the OBI-AD-009 completeness floor.
- The core continues to treat the whole identifier as an opaque exact-match string: the dots and `@` in this convention carry no core semantics.
- Specification examples use identifiers in this convention. No example presents an upstream artifact-version token (`openapi@3.1`, `mcp@2025-11-25`) as a binding-specification identifier.
- Third-party guidance is unchanged from OBI-AD-009: qualify under a namespace you control (`com.example.<name>@<rev>` fits the same shape), with qualification proportional to circulation.

### Migration

Reference tooling, published interfaces, and project documents move from `<name>@<artifact-version>` tokens to these identifiers as part of the `format` → `bindingSpec` change. Because 0.2.0 is unreleased, this is a clean break with no dual-accept period.

### What this direction does not decide

This decision does not select which binding specifications the project publishes first, fix the contents of the authoring template (an OBI-AD-009 follow-up), or impose this lexical shape on any third-party identifier.

## OBI-AD-027: Transform parse-validity is a document rule (OBI-D-18)

**Status:** Ruled, executed  
**Date:** 2026-07-14  
**Analysis question:** Is a transform expression that does not parse under the pinned language a document defect (as OBI-D-17 treats schema garbage) or a latent evaluation condition (the rewrite's original §5.5 stance)? Surfaced by round-4 external review of the rewrite as the one residual weakness not settled by an existing ruling: OBI-D-17 and the original §5.5 closing paragraph gave opposite dispositions to the same species of defect.

### Ruling

Document defect. New rule **OBI-D-18**: every transform expression in the document — `transforms` map values and inline `inputTransform`/`outputTransform` strings — parses as a syntactically valid expression of the pinned transform language (JSONata 2.1, jsonata-js 2.1.1 parse acceptance as the normative tiebreak, subject to release-adopted errata). The rule is syntactic membership only: evaluation success, data presence, and dynamic errors remain §5.5 clause 4 evaluation outcomes. Verification takes a parser for the pinned language; a validator without one leaves the rule unverified rather than failing the document, per the §10.5 posture.

### Why

OBI-D-17's own rationale — "a document defect, not a latent runtime condition" — applies verbatim to a string at a transform position that is not in the pinned language at all. Parse-validity against a pinned, tiebroken grammar is offline-decidable from the document alone, so invariant 5 holds, and the capability posture already handles validators without a JSONata parser (exactly as OBI-D-01's duplicate detection and OBI-D-13's binding-specification knowledge). Pre-release is the free moment to add a document rule. This reverses the rewrite's original §5.5 closing paragraph. One defect keeps one home per layer: OBI-D-18 classifies the document; §5.5 clause 4 and OBI-T-10 continue to define tool behavior when a malformed expression is evaluated regardless, since document rules bind documents, not a tool's inputs.

### What this direction does not decide

It does not make evaluation success, undefined-result absence, or transform semantics a document property; does not require validators to carry a JSONata parser; and does not change the derived schema (parse-validity is not schema-expressible and is listed among the beyond-schema rules in §10).

### Follow-up

Conformance corpus needs OBI-D-18 fixtures (rides pass 2). Reference validators (ob, SDKs) gain the check whenever they already link a JSONata parser.
