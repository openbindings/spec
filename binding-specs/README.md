# Binding specifications

**Status: index and authoring guidance for unreleased first-revision candidates.** No OpenBindings binding specification has been published yet. Every family document in this directory is a mutable candidate for its first `@1` identifier. (During 0.2 development the publication lifecycle was exercised against earlier drafts of these candidates; those artifacts were withdrawn on 2026-08-11 and are not regarded as publications — the inventory is preserved in [`publications.json`](publications.json) under `developmentExercises`, and the full account is the publication-lifecycle reset entry in [`../history/0.2-development-log.md`](../history/0.2-development-log.md). Earlier drafts bearing the same `@1` spellings are superseded working texts.) The documents are used by reference implementations and conformance work during development, but they do not mint immutable identifiers until the explicit publication lifecycle below completes. This README itself is informative: it carries the cross-specification doctrine, the index, and the authoring template.

The key words MUST, SHOULD, and MAY in this document are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/info/bcp14) ([RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)) when, and only when, they appear in all capitals. Their force is scoped by this document's status: they carry no conformance weight here, but state the conventions a binding specification's own text adopts when it follows this guidance.

These are the **openbindings project's candidate** binding specifications _for_ the named source families. For example, the OpenAPI candidate proposes `openbindings.openapi@1` under this project's namespace and authority. It is not a publication of, nor endorsed by, the family's own authority (the OpenAPI Initiative, the gRPC project, and so on), and it does not speak for them. The binding specification is sovereign over the sources that name it; these project candidates choose to incorporate capable existing artifact and protocol authorities because doing so produces the most faithful and reusable brownfield bindings. An upstream community, or anyone else, may publish its own binding specification for the same family under its own identifier, with equal standing under the core and a different relationship to those upstream rules.

## Meaning first, action complete

A binding specification is a **semantic specification**, in the same sense as
the core: it defines what governed source and binding values mean. It is not an
invocation service contract. The project's binding-invoker and
operation-invoker interfaces define software requests, frames, context
negotiation, and lifecycle APIs; SDKs define language-specific configuration
and cancellation surfaces.

Portable meaning that satisfies OBI-B-02 has to be **action complete**. A
concrete binding denotes a target and interaction, so its portable meaning includes
cardinality, value-to-protocol correspondence, successful outcomes, and any
artifact-authorized choices or explicit exclusions needed to act on it without
guessing. Those facts are more operational than the core document model, but
they remain denotational: they answer _what interaction this binding denotes_,
not _which method an invoker exposes_ or _how a runtime orchestrates it_.

Accordingly, family specifications may say that a value is refused before an
interaction begins, that emitted values stand after a late failure, or that
abandoning an interaction maps to a protocol cancellation. Those are
observable boundaries of the binding's meaning. They do not standardize an
error class, retry loop, frame protocol, callback name, context store,
connection pool, or cancellation API. Imperative words such as “dispatch” and
“processor” in a conformance rule describe what an implementation must
preserve when it acts on the binding; they do not move the specification into
the invocation-interface layer.

## Sovereignty, completeness, and implementation-defined behavior

A binding specification is the governing authority for every source and
binding that names its identifier. An external artifact or protocol has no
automatic OpenBindings authority. The binding specification may incorporate
it on stated terms, accept only a subset, add extensions, override parts of it,
use it only as a representation syntax, define the artifact and interaction
itself, or govern a live surface with no artifact. Those choices may be more or
less interoperable, reusable, or surprising, but Core permits all of them.

Three states must not be collapsed:

1. A binding specification **exists** when an authority gives an identifier
   governing rules. A conformant OBI may name it regardless of its formality or
   completeness.
2. A binding specification satisfies the **OBI-B-02 portability floor** only
   when it answers the complete source, target, interaction, value, and outcome
   boundary. The OpenBindings project additionally requires that floor before
   publishing an `openbindings.*` identifier.
3. An **implementation** may supply local behavior where a specification is
   silent. That completion can make an otherwise underdefined binding useful,
   but it remains implementation-defined. It does not become portable meaning
   under the identifier merely because one or many implementations choose it.

Implementations document such completions as their own behavior and do not
attribute them to the binding specification in support or conformance claims.
If implementations diverge materially, that is ordinary ecosystem feedback:
the specification community can publish a more complete revision, preserve an
explicit permitted set, or introduce a named interpretation choice. A released
revision that narrows or changes observable behavior uses a new identifier
under OBI-B-03.

## The minimal abstraction-fidelity floor

The project's end-to-end target is the protocol-blind operation boundary in
[`ABSTRACTION-FIDELITY.md`](../ABSTRACTION-FIDELITY.md). A source's real
artifact or live surface remains available so the binding can act correctly;
it does not make the ordinary operation surface a second view of the native
protocol.

A family specification therefore defines the minimum semantics needed to:

1. identify and reach the concrete target;
2. map caller-facing application values to and from the concrete interaction;
3. determine successful values versus unsuccessful completion;
4. preserve interaction behavior that changes the abstract invocation,
   including ordering, partial outputs, closure, cancellation, and completion;
   and
5. expose genuine choices or refuse unsupported cases instead of guessing.

It stops there. A family specification does not define an SDK error class,
cross-protocol failure taxonomy, retry loop, diagnostic envelope, frame
protocol, callback name, or synthesis naming convention. It also does not turn
a native status, header, trailer, frame, or other protocol observation into an
operation value merely so the observation remains visible.

The distinction is between **using** a native fact and **exposing** its native
representation. A status or metadata field may select decoding, drive context
resolution, distinguish normal from unsuccessful completion, or otherwise
change binding behavior without crossing the operation boundary. Raw native
evidence may remain available in the artifact runtime or protocol-native
tooling below the adapter; the abstract invoker frames do not provide a
diagnostic escape lane, and ordinary callers must not require one to use the
operation correctly.

Three outcomes remain separate:

1. An ordinary application result value crosses `output` normally, even when
   its own shape describes a domain condition.
2. An interaction that produces no successful result, or fails after partial
   outputs, completes unsuccessfully. The already-emitted outputs stand; the
   core document does not acquire a universal error object.
3. A local SDK or implementation defect that produced no source interaction is
   an implementation failure, not an invented source result.

Cardinality and lifecycle remain emergent from the selected binding. This
floor adds no cardinality, half-close, cancellation, completion, error, or
protocol-metadata members to an operation or to the core document model. The
core supplies neither a lowest-common-denominator lifecycle nor a protocol
simulation language.

Synthesis derives operation schemas from application-level value declarations,
not transport observations. Where the artifact does not contain enough
information to produce a useful protocol-independent contract, the smallest
affected unit is excluded or refused with evidence. A protocol-shaped output
schema is not a faithful substitute for a missing application contract.

## Identifiers

When published, project binding specifications are identified as `openbindings.<name>@<rev>`, where `<rev>` is an integer revision of the binding specification itself. Every current family candidate proposes revision `1`. Artifact and dialect versions never appear in the identifier: the artifact self-identifies where its format provides for that, and the specification's accepted-representations section states which artifact versions it accepts (core [§6](../openbindings.md#6-binding-specifications)).

- Identifiers are exact, opaque strings ([OBI-B-01](../openbindings.md#104-binding-specification-rules)): no ranges, no version algebra, no normalization, never dereferenced. A tool supports the exact identifiers it implements.
- An incompatible change publishes the next revision — a different identifier ([OBI-B-03](../openbindings.md#104-binding-specification-rules)). Compatible clarification may retain the identifier only when the accepted domain and every required, permitted, or refused observable behavior remain unchanged.
- **The accepted domain is frozen at publication.** One revision may accept one upstream edition or a finite set of exact editions, but adding or removing an edition, source mode, or previously excluded feature or interaction publishes a new binding-specification identifier. An unqualified support claim covers that complete domain; an implementation with narrower coverage reports partial support rather than presenting the identifier as fully supported.
- **The OpenBindings project publishes an `openbindings.*` identifier only when its specification meets the OBI-B-02 floor.** Draft pages in this directory mint no project-published identifier, and project tooling adopts one only at publication. Core does not make that publication policy a gate on the existence or local use of identifiers governed by other authorities.
- **Citations denote revisions, not mutable files.** A citation into a published binding specification by its identifier denotes the immutable defining document recorded for that revision in [`publications.json`](publications.json). Every revision has a permanent human-readable URL, `https://openbindings.com/binding-specs/<family>/<rev>`, and raw Markdown URL, `https://openbindings.com/raw/binding-specs/<family>/<rev>.md`. The shorter family URL is only a latest-revision alias. A superseding revision changes that alias but never either permanent URL. Cross-specification citations SHOULD name stable rule identifiers alongside the exact-revision URL.

### Publication lifecycle

The mutable family path is the candidate. After first publication it becomes a
convenience mirror of the latest published revision. Publication is one
explicit operation:

1. finish and review the candidate document and its conformance evidence;
2. run `scripts/publish-binding-specifications.mjs`, naming the exact family
   revisions in the publication cohort;
3. commit the new entry in [`publications.json`](publications.json) and the new
   self-contained bundle under `binding-specs/releases/<publication>/`; and
4. publish the corresponding permanent website routes.

The bundle preserves the defining documents, the core text and authoring
doctrine they cited, and the publication-time binding-specification and
operation-graph conformance evidence. `publication.json` hashes every archived
file, while the top-level manifest hashes that record. CI verifies the digest
chain and rejects edits, removals, or renames beneath `binding-specs/releases/`.
It also requires each mutable family path to remain byte-identical to the
revision named by the manifest's `latest` map. A future revision is authored
as a candidate, published into a new bundle, and only then becomes the latest
mirror; it never edits its predecessor. Before the first publication, the
manifest is intentionally empty and there are no release bundles or errata.
After publication, clarifications use the append-only errata process and
semantic changes use a new identifier.

Several upstream editions belong in one revision when the artifact identifies its own edition and target identity, interaction model, and operation-boundary correspondence remain one concept with finite deterministic edition branches. A fundamentally different correspondence may justify a more specific family; merely avoiding edition branches does not. A later revision may continue accepting older editions alongside a newly incorporated one, but no compatibility or range relation between the two binding-specification identifiers is inferred.

The Operation Graph candidate uses proposed binding identifier `openbindings.operation-graph@1`; each graph independently carries its graph-unit format version. Earlier development tokens remain only in version-control history.

## Artifact authority and presence

A binding specification governs a family of sources and bindings; it is not required to begin with an externally defined artifact family. Artifact **authority** and artifact **presence** are separate choices:

1. A specification may incorporate an existing artifact format and protocol. `openbindings.openapi@1` incorporates OpenAPI and HTTP.
2. A specification may define the artifact format and interaction model itself. `openbindings.operation-graph@1` defines the graph artifact, its nodes, and its execution semantics; there is no external artifact authority for it to incorporate.
3. A specification may accept an artifactless source mode. `openbindings.connect@1`'s descriptorless mode uses a service `location` and binding `ref` without schema `content`; the Connect protocol and the binding specification completely define the narrower interaction. A specification may also define absent `ref` to target `location` itself, leaving `bindingSpec` plus `location` as the complete concrete address.

The **source** remains required in every case. An artifactless source is location-only: the binding specification defines what the location addresses, what `ref` means or whether it is absent, and every interaction and operation-boundary rule an artifact would otherwise have supplied. Calling the mode artifactless does not relax [OBI-B-02](../openbindings.md#104-binding-specification-rules); it makes more of that semantic burden the binding specification's own.

## Implementation layering

The semantic boundaries above suggest an implementation architecture; they do
not add a conformance requirement or prescribe one internal API. In a processor
that follows the project's invocation pattern, responsibilities should normally
separate into three layers:

1. The general OpenBindings processor or SDK handles the core document model,
   operation lookup, binding selection policy, transforms, context negotiation,
   and the protocol-independent invocation surface.
2. A binding-specification implementation forms the smallest semantic adapter
   needed to translate between that surface and the domain governed by its exact
   `bindingSpec` identifier.
3. Binding-native machinery interprets, resolves, or invokes that domain in its
   own concepts.

That governed domain is not necessarily an upstream artifact. It may be an
externally defined artifact and protocol, an artifact and interaction model
defined by the binding specification itself, or an artifactless live surface.
The layers are boundaries of responsibility, not a requirement that every
implementation contain three separately packaged components.

Where an independently meaningful upstream ecosystem exists, binding-native
machinery should remain as ordinary to that ecosystem as practical. Prefer its
well-tested parsers, resolvers, runtimes, and execution behavior when they
preserve the binding specification's required meaning. Code concerned only with
that domain should avoid OpenBindings types where practical, remain separately
testable, and be reusable outside OpenBindings when that reflects a genuine
independent use. The binding adapter then contains the OpenBindings-specific
translation rather than reimplementing the entire upstream stack.

Where the binding specification defines the domain itself, those responsibilities
may necessarily meet. `openbindings.operation-graph@1`, for example, defines its
own graph artifact and execution model and intentionally invokes operations from
the containing OBI; independence from OpenBindings would be a false goal. Its
implementation should still keep generic SDK behavior separate from graph-owned
behavior, but the graph executor is not expected to masquerade as a standalone
upstream engine. The same qualification applies when an artifactless live
surface has no independently reusable artifact processor beneath the adapter.

In this guidance, **thin** means narrow in semantic authority, not necessarily
small in code size. A faithful adapter may require substantial parsing,
negotiation, scheduling, or lifecycle machinery. Conversely, delegating to a
large library does not make an adapter faithful merely because little local code
was written. A chosen library and an implementation's package boundaries remain
non-normative: the binding specification and every authority it incorporates
govern observable behavior. An implementation supplements, constrains, or
replaces a library that hides required facts or imposes conflicting policy.

## Index

| Specification   | Document                                                                           | Status                                                                                             | Identifier(s)                    | `ref` shape (summary)                                                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| operation-graph | [openbindings.operation-graph.md](operation-graph/openbindings.operation-graph.md) | **unreleased @1 candidate** | `openbindings.operation-graph@1` | JSON Pointer to a graph definition |
| usage           | [openbindings.usage.md](usage/openbindings.usage.md)                               | **unreleased @1 candidate** | `openbindings.usage@1`           | space-separated command path (absent ref = root) |
| openapi         | [openbindings.openapi.md](openapi/openbindings.openapi.md)                         | **unreleased @1 candidate** | `openbindings.openapi@1`         | JSON Pointer to the operation object |
| mcp             | [openbindings.mcp.md](mcp/openbindings.mcp.md)                                     | **unreleased @1 candidate** | `openbindings.mcp@1`             | `tools/<name>` for a unique non-task-required tool declaring `outputSchema` |
| grpc            | [openbindings.grpc.md](grpc/openbindings.grpc.md)                                  | **unreleased @1 candidate** | `openbindings.grpc@1`            | `<fully-qualified-service>/<method>` |
| connect         | [openbindings.connect.md](connect/openbindings.connect.md)                         | **unreleased @1 candidate** | `openbindings.connect@1`         | `<fully-qualified-service>/<method>` |
| asyncapi        | [openbindings.asyncapi.md](asyncapi/openbindings.asyncapi.md)                      | **unreleased @1 candidate** | `openbindings.asyncapi@1`        | edition-dependent operation reference |
| graphql         | [openbindings.graphql.md](graphql/openbindings.graphql.md)                         | **unreleased @1 candidate** | `openbindings.graphql@1`         | `query/<field>` or `mutation/<field>` |

A candidate page remains informational until promotion. It uses the full authoring template and proposed rule identifiers so design review can evaluate a complete boundary without mistaking the proposal for a published identifier; its status banner states the remaining publication gates.

## The authority precedence: who has already decided

The deference order below governs how a binding specification answers a
question that is *its* to answer. This precedence governs the prior
question — whether the question is its to answer at all. Consult in order,
and stop at the first authority that answers:

1. **The core OpenBindings specification.** The abstraction boundary, the
   document model, and the invocation contract. Nothing beneath may
   contradict it.
2. **The governing binding specification's own text**, including the
   project doctrine recorded here. A rule this project already wrote binds
   it until explicitly revised.
3. **The incorporated upstream artifact authority** — the artifact
   specification the binding specification defers to, *and everything that
   authority itself incorporates*: the RFCs it cites, the media-type
   registrations it relies on, the schema dialect it adopts. An answer
   reached through an incorporated citation is an incorporated answer, not
   a local invention.
4. **Only where all three are silent** does the question become this
   project's to decide, under the deference order below.

Three corollaries carry most of the practical weight.

**An implied answer is an answer.** A question is not open merely because
no text addresses it by name. If the answer follows from rules that are
already stated, adhere to it; re-deciding it privately is how two
paragraphs of one specification come to disagree.

**Contradicting our own text is a revision, not a reading.** Where a
binding specification already states a rule, discovering that the upstream
authority never required it does not silently license a different rule.
That is a specification-level change and it goes through a ruling, which
records what the prior text got wrong and why the replacement is more
faithful.

**An implementation's behavior is never an authority.** What an SDK, a
reference tool, or a widely used library happens to do carries no weight
in this precedence, at any level. Reasoning from it inverts the whole
relationship: it makes conformance mean "matches what we built" instead
of "matches what the authorities say." Where implementations and
authorities disagree, the implementations are wrong.

## The deference order

A binding specification is free to define a different relationship to an existing artifact. The OpenBindings project's brownfield specifications deliberately choose a more reusable policy: where an artifact or protocol they incorporate speaks, they avoid normalizing it into one preferred wire behavior and apply the following deference order. Where a project binding specification defines the artifact or interaction itself, those definitions are first-order rules rather than fallback defaults, and the OBI-B-02 completeness floor is unchanged.

1. **Incorporate** what the artifact or protocol defines. Restate only the OpenBindings consequence; do not replace an upstream rule with a locally convenient equivalent.
2. **Preserve alternatives** when the artifact permits several valid choices. Conformance may be a permitted set rather than one byte-identical request; a binding specification does not invent preference merely to make implementations choose alike.
3. **Expose an interpretation choice** when acting on the binding requires a choice the artifact does not make. A named configuration point defines the admissible choices and their semantic effects; where or how a runtime obtains the effective choice remains implementation surface.
4. **Refuse or exclude** behavior OpenBindings cannot represent faithfully. A loud, pre-dispatch refusal is more conformant than silently identifying distinct artifact values, discarding required information, or approximating an interaction the artifact did not declare.
5. **Define a default only as a last resort**, where the artifact is silent, actionable meaning still needs an answer, and neither an exposed choice nor a narrower supported subset is adequate. The text labels that answer as this binding specification's convention and gives it a named configuration point where consumer choice is meaningful.

### Current candidate design decisions

The adversarial review resolved the former lower-confidence questions below. These are recorded so a later implementation does not reopen them privately; changing one requires another specification-level compatibility review against the incorporated artifact.

- **Usage field identity and multiplicity:** first-long-else-first-short remains the canonical JSON field identity. Identity collisions, combined repeatable-plus-variadic declarations, and order-dependent `overrides` inputs refuse; count, repeatable, and variadic forms otherwise keep distinct argv shapes.
- **Usage optional `--`:** both artifact-permitted spellings remain an unordered permitted set through the `delimiter` point. The processor corpus accepts both and gives neither preference.
- **AsyncAPI:** the first-revision candidate is being realigned around AsyncAPI's own protocol-binding system. The outer OpenBindings specification delegates concrete protocol semantics to the selected AsyncAPI binding and runtime driver rather than maintaining an HTTP/WebSocket allowlist here.
- **Operation Graph startup:** every held `operation` invocation opens at graph start. This preserves the identity law and output-before-input causality; the eager timing consequence is explicit and covered by OG-EX-39..46.
- **GraphQL:** Query and mutation outputs are the selected root-field application value. Trusted GraphQL errors cause unsuccessful completion after any selected partial value; native envelopes remain diagnostic. Subscription targets are coverage-accounted exclusions because their per-event partial-data-plus-error lifecycle can continue, and the candidate refuses rather than approximates it.

These decisions are intentionally specific. “Let each implementation choose” is not an acceptable substitute; a future review keeps the rule, replaces it with a better incorporated/configured rule, or narrows the supported set explicitly.

The shorthand is **incorporate → preserve → configure → refuse → default**, and it applies only after the authority precedence above has established that the question is this project's to answer. It is project quality doctrine, not a restriction on what a binding specification is allowed to mean. Its governing correction is **defer before defining; never guess privately**: completeness requires a definite answer, an explicit binding-specification convention is a definite answer, and an explicit exclusion is also a definite answer. An implementation-only approximation may be useful locally but does not close the portable specification.

### The context/input discriminator (amortization)

Context negotiation is deliberately expensive — a pre-dispatch
interruption of operational flow — and it earns that cost only by
amortizing: **context is what an invocation flow resolves once and then
runs on** (credentials, server selection, environment, session). A value
that varies per invocation cannot amortize, so it was never context — it
is **operation input**, whatever protocol position it rides (ruled
2026-08-14; the contract's `durable: true` flag is this same amortization
claim in requirement form). Applied: server selection and credentials are
context; a parameterized channel address's per-invocation parameter (which
user, which sensor) is operation input, on both directions — consumer
configuration may still pre-fill an absent input parameter, which is
amortized supply of an input, not a reclassification.

### The correspondence ladder (value carriage)### The correspondence ladder (value carriage)

The deference order's specialization for the question every family must
answer completely — how application values cross the JSON boundary — is the
**correspondence ladder** (ruled 2026-08-13):

1. **Incorporate** the payload format's own canonical JSON encoding when its
   upstream authority defines one (Avro's JSON Encoding, proto3's JSON
   Mapping). Preferred because it costs no invented semantics, the upstream
   maintains the mapping's edge cases, and boundary values align with the
   format's whole ecosystem. The gRPC family has carried protobuf values
   this way from its first revision.
2. **Author** a correspondence under the binding specification's own
   authority when the upstream is silent but the data is structured. Fully
   legitimate — the specification is sovereign for its identifier, and a
   mapping where the upstream defined none contradicts nobody — but the
   specification becomes the mapping's owner, and the **falseness test**
   governs what may be authored: total and deterministic (every valid
   datum, exactly one JSON image, round-trippable given the format schema),
   pinned in specification text so two implementations cannot diverge. A
   format that resists such a mapping was not as structured as it looked.
3. **The byte boundary** for genuinely opaque media: the exact octets as
   the canonical Base64 boundary string. For this tier the boundary schema
   is not a degraded stand-in — "the exact octets" is the complete
   application contract, so the schema claim is simply true.

In every case the specification NAMES its correspondences as a closed list
per format identifier. No implementation ever judges whether a faithful
conversion "exists"; it reads the list. A declared structured contract the
named correspondences cannot express rides the byte boundary and accounts
lossy — with the loss stated in the emitted schema, not only in synthesis
coverage.

This order does not require identical requests where an incorporated authority permits alternatives.This order does not require identical requests where an incorporated authority permits alternatives. For a project specification claiming faithful upstream deference, it requires every observable choice to remain inside the incorporated authority's permitted set unless the specification labels a deliberate divergence, every OpenBindings convention to be necessary and visible, and the same declared configuration to have the same semantic effect. During review, words such as _first_, _default_, _precedence_, _discard_, _ignore_, _one value_, and _this specification's pin_ deserve an authority check: who supplied that rule, and could incorporation, configuration, or refusal preserve more of the artifact instead?

## Release-quality review loop

Use one repeatable loop for a new specification and for every release audit of
an existing one. A polished document is not the exit condition; the exit is a
complete, upstream-deferential contract with adversarial evidence.

1. **Grade from evidence.** Score authority/pinning, OBI-B-02 completeness,
   deference, abstraction preservation, diagnostic separation, determinism,
   implementability, conformance evidence, and teaching quality. Record every
   deduction as a concrete scenario, not a general impression.
2. **Choose the highest-gain change.** Prefer a change that removes ambiguity
   across several operations or implementations: an authority pin, a missing
   boundary rule, an explicit refusal, or a portable scenario. Do not raise a
   grade for editorial cleanup while a semantic deduction remains.
3. **Apply the deference order.** For each proposed answer, try incorporation,
   preservation of alternatives, configuration, and explicit refusal before
   defining an OpenBindings default. Label every surviving convention and why
   the earlier options were inadequate.
4. **Implement specification and evidence together.** Update normative prose,
   stable rule summaries, source fixtures, processor scenarios, schemas, and
   examples in the same pass. A rule with no hostile example is presumed
   under-tested.
5. **Review adversarially from a clean premise.** Attempt at least: two
   independent processors choosing different behavior; a lossy application-
   value round trip; protocol evidence smuggled into an operation value; a
   mutable or conflicting authority; absent versus explicit `null`; duplicate
   and case-colliding names; unsupported media/encoding; early and late stream
   failure; stale embedded content; configuration collision; and an artifact-
   permitted alternative that the text accidentally turns into preference.
6. **Verify mechanically.** Run every relevant schema, example, fixture,
   conformance, link, formatting, and site check. Execute portable processor
   scenarios through independent adapters when those adapters exist; a
   scenario that is only shape-checked is semantic reference, not execution
   proof.
7. **Regrade without credit for effort.** Keep the lower grade if the change
   merely moved ambiguity or if an implementation still needs private policy.
   Repeat from step 2 until the exit gates hold.

The release exit gates for a **published** binding specification are:

- every OBI-B-02 item has one definite, internally consistent answer;
- every incorporated authority is immutable or versioned, with conflict
  precedence stated when several authorities overlap;
- every application-facing choice follows the deference order, with no silent
  loss of operation values or behavior and no unlabeled OpenBindings default;
- native evidence needed only for debugging or conformance remains explicitly
  diagnostic rather than becoming required operation data;
- two conformant implementations can derive the same required behavior or the
  same explicitly unordered permitted set without private policy;
- source rules have positive and negative fixtures, processor rules have
  portable adversarial scenarios, and all mechanical checks pass;
- no release-blocking severity issue or unresolved medium-confidence semantic
  question remains; and
- a fresh hostile pass finds no new blocker and the specification grades at
  least A- in every dimension above.

Candidate pages use the same loop, but publication questions are themselves
failed exit gates. Keeping a candidate unminted is a successful doctrinal
outcome when its upstream contract or artifact boundary cannot yet support an
exemplary identifier; candidate status must never be hidden by averaging its
grade with published specifications.

## Portable actionability

For the project's artifact-backed specifications, the usual governing
relationship is **binding specification + incorporated artifact + effective
choices = complete binding interpretation**.

A binding specification answers three recurring **interaction questions** per operation — from its accepted artifacts, by its own definition, or through a declared interpretation point:

1. **Routing** — which transport channel does each input field ride (path/query/header/body; argv/stdin/file)?
2. **Decode** — how do the returned bytes become the output value?
3. **Classify** — which completion outcomes (HTTP statuses, exit codes) are success?

Complete artifacts answer all three natively (OpenAPI: parameter locations, response content types, status codes). Incomplete ones leave gaps — a [jdx usage](https://usage.jdx.dev) CLI descriptor declares flags and args but cannot declare stdout decoding, exit-code meaning, or a field's stdin routing. **The binding specification exposes the gap as a named interpretation point, never by authoring missing coverage into the artifact and never by making the OBI absorb format conventions.** An effective consumer choice completes that point when one is required. The OBI stays abstract; the artifact stays pristine.

Within the completeness floor this maps as follows: an OBI-B-02 item — most often item 7, boundary correspondence — may be satisfied by a fixed rule or by a **named configuration point**: a normatively defined set of admissible choices and the exact semantic effect of each. A point may have a content-independent fallback, or it may be **required** where any fallback would misstate source intent; in the latter case the binding denotes no actionable interaction until an effective choice is supplied. An undefined choice does not prevent the specification from existing or an implementation from completing it locally, but it means the specification has not satisfied OBI-B-02 for that boundary. A required choice or an explicitly unsupported aspect is a portable definition, not a gap.

A specification defines only the **effective choice**, not a hierarchy of
configuration scopes. Per-call versus standing configuration, callback decline
chains, flags, policy objects, and precedence among those sources are runtime
and SDK design. Whatever the surface, supplying the same effective choice has
the same semantic effect. An implementation claiming action support for a
required point necessarily provides some way to supply a choice; a fixed point
need not be configurable at all.

The reference Go and TypeScript SDKs expose output-decoder, result-classifier,
and field-router hooks with their own per-call/standing decline chain. That
architecture is documented with the SDKs and on the site's Invocation
Configuration page; it is an informative realization of these points, not
binding-specification doctrine.

### Project specifications' boundary conventions

Where the artifact does not answer and the deference order reaches its final step, a family specification may define a **content-independent** convention — decided by declarations and wire framing, never by sniffing payload bytes (a payload-dependent default makes the same document behave differently per response, and a wrong guess passes silently). Before adopting one, authors consider a named required choice or a narrower explicitly supported subset. The table summarizes conventions the project specifications define; their normative force comes from each linked family specification, not from this informative catalog or from the reference implementations:

| Specification family | Routing                                                                           | Decode                                                                                                                                                                                                                                    | Classify                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| openapi (HTTP)       | artifact: parameter locations                                                     | **declaration-and-framing rule**: status selects the Response Object; concrete `Content-Type` selects its exact/range declaration; JSON, text, SSE, and artifact-authorized raw-byte lanes then produce protocol-independent values | **2xx rule**: success iff status ∈ 2xx; declared `responses` may admit application failure _data_, never change classification |
| asyncapi             | artifact: channel/message (payload wholesale — no field routing)                  | delegated to the artifact's schema, format, binding, driver, and codec authorities (ASYNC-P-05); Schema Objects enter OBI positions only under dialect translation; envelope unwrapping is never built in | driver-decided from the incorporated AsyncAPI and protocol-binding authorities per interaction cell (ASYNC-P-06); message content never reclassifies |
| usage (CLI)          | assumption: argv (consumer hooks route fields to stdin / `-`-operand / temp file) | assumption: stdout as text, trailing newlines stripped (command-substitution semantics)                                                                                                                                                   | assumption: exit 0                                                                                                     |
| mcp                  | artifact: tool `arguments` object whole                                           | artifact: tool `outputSchema`; successful value is `structuredContent` alone; progress is not solicited                                                                                                                                   | protocol: `isError` / JSON-RPC / transport failure                                                                    |
| grpc / connect       | artifact: protobuf                                                                | artifact: protobuf                                                                                                                                                                                                                        | protocol: status codes / END_STREAM                                                                                    |

`openbindings.connect@1`'s descriptorless mode has no artifact: there, routing and classification are protocol-answered and decode is that specification's fixed verbatim-JSON rule — see its §9.3.

Two of these are the conventions the reference implementations hold fixed across the HTTP lanes where classification is a convention rather than protocol-answered (`openbindings.connect@1`'s lane is 200-exact by its protocol's own rule): (1) _the header decides the decode lane_ — never the payload shape; (2) _success is 2xx and declared responses never change classification_ — a declared 404 response documents a failure's shape, it does not bless the failure. Once a binding specification here publishes, its answers to these axes are normative for its identifier; this table records the defaults project specifications adopt. A binding specification published under another authority that chooses differently defines its own rules — the point of the identifier is that consumers can tell.

Reference tooling reports which rule answered each axis using
`x-ob-decode`/`x-ob-classify`/`x-ob-route` provenance and may warn when a
convention decoded into a contract that could not catch a wrong lane. That
out-of-band observability is implementation documentation, not an invoker
frame and not part of a binding's portable meaning.

### The bytes boundary

The operation value domain is JSON (core [§5](../openbindings.md#5-document-model)), so a value that is neither a JSON value nor a string — arbitrary bytes — needs a **boundary encoding** to cross the seam. This is one instance of the decode/routing answers above, not a separate mechanism, and it is governed by two principles in order:

1. **Follow the artifact where it declares an encoding.** OpenAPI's `contentEncoding` (`base64`/`base64url`), gRPC/Connect's ProtoJSON `bytes`, and MCP's resource `blob` all define how bytes ride; a binding specification incorporates its family's answer and does not override it. The artifact keeps authority over its own bytes.
2. **Default to Base64 only in the gap** — where a family admits bytes but the artifact signals them without an encoding (OpenAPI 3.0's `format: binary` or exact schema-omitted non-JSON declaration, or a 3.1 raw body whose Media Type Object omits `schema`). **Base64 is the project's recommended boundary encoding**, and a specification that adopts it says so in its own text (`openbindings.openapi@1` §9.2 is the pattern: "this specification's Base64 boundary representation"). This is a recommended default like the table above — not a cross-specification mandate; the catalog has no mechanism for one, so each specification restates it and a specification published under another authority may choose differently.

A family candidate that does not define bytes carriage on some axis **declares the gap** rather than leaving it silent. The current OpenAPI `@1` candidate defines artifact-authorized raw request and response carriage; the AsyncAPI `@1` candidate records its non-string, non-JSON payload boundary; and the Usage `@1` candidate keeps a text-only stdout default. A gap left in a published specification could only be closed by a later revision, following the two principles above.

## Authentication and credentials

Credentials and other runtime prerequisites are **not** part of an OBI document and are not extracted into it from an artifact's security metadata. A binding specification still defines the **meaning and wire placement** of security declarations it incorporates: which declaration governs the selected target, which alternatives are permitted, and where a supplied credential rides. It does not define credential storage, prompting, refresh, or a negotiation API. The project's [`binding-invoker`](https://openbindings.com/interfaces/binding-invoker) interface defines one informative `CONTEXT_REQUIRED` realization; another runtime may acquire the same effective credential differently.

## Field naming across protocol locations

Many source families present parameters from several protocol locations (path, query, headers, body) as a single object-shaped view. In that flattened representation each field name maps to at most one value, and within a JSON object property names are unique. OpenBindings works best when a source can be represented with unique field names across its effective input/output surface.

When declarations are distinct in the artifact but collapse to one property name, a binding MUST NOT invent equality between them. The current OpenAPI `@1` candidate uses a binding-private routed source value: synthesis preserves protocol-neutral application fields and carries the concrete name-plus-location correspondence in a core `inputTransform`. The routing envelope belongs below the operation boundary and is never copied into the caller-facing schema.

## Authoring a new binding specification

A complete binding specification makes a family of sources and bindings mean the same thing to every independent implementation wherever it requires one behavior, and identifies any permitted alternatives explicitly. The core states that portability floor normatively ([OBI-B-02](../openbindings.md#104-binding-specification-rules)); the template below is the section-by-section shape project specifications use to meet it. Third parties publish under their own collision-resistant namespace (`com.example.<name>@<rev>` fits the same shape) with no project registration. They may use this template, publish a less complete experimental specification, or deliberately make different authority choices; the resulting identifier carries only the portable meaning its governing rules actually define.

Apply the [deference order](#the-deference-order) to every answer in the template. In particular, “complete” does not mean “choose one OpenBindings behavior whenever the artifact permits several”: preserve the permitted set, expose a choice when action needs one, or narrow coverage explicitly.

### The template

1. **Status and identifier** — the exact identifier this document defines, its defining authority, and the revision discipline (OBI-B-01, OBI-B-03). The document may carry its own edition label; that label is not the identifier.
2. **Scope and authorities** — every upstream specification incorporated by reference (the OpenAPI specification, the protobuf language, the MCP revision) and the boundary between its authority and this specification's overlay; or, where no external artifact authority exists, an explicit statement of the artifact and interaction semantics this specification defines itself. A candidate MAY also incorporate a **sibling candidate** by its proposed exact identifier, scoped to named sections and rule identifiers (`openbindings.connect@1`'s schema layer, cited from the `openbindings.grpc@1` candidate, is the pattern). Both candidates must be reviewed together before either is published. After publication, the "citations denote revisions" discipline above governs.
3. **Accepted source representations** (OBI-B-02 item 1) — whether each source mode accepts an artifact; the exact upstream edition envelope and every representation accepted where one exists; deterministic discrimination when it accepts several; and the encoding for any non-JSON artifact. An artifactless mode states that fact explicitly. Every accepted edition receives conformance coverage for its edition-specific branches.
4. **`location`** (item 2) — the accepted absolute-address syntax and what it addresses. **Acquisition-failure semantics follow the address scheme:** where `location` is a URI, whether a dereference succeeded is the scheme's own affair (an HTTP status, a `file://` open error, a TLS failure), and a specification need say nothing — the terseness is deference, not an omission. A specification that mints an address form with no incorporating scheme (an executable address, say) owes the success condition itself, because none is inherited (`openbindings.usage@1`'s `exec:` requires exit 0, its stdout otherwise not an artifact, is the pattern).
5. **`content`** (item 3) — the accepted JSON values and their meaning, including any mode in which `content` is forbidden.
6. **Composition** (item 4) — the role of a co-present `location`, including whether it supplies a reference base for embedded content, within the content-primacy floor of core [§5.4](../openbindings.md#54-sources). Service-addressed families additionally define their pin's **staleness** posture (dispatch proceeds against the pin; the live server's own error is a failure outcome) — a drift question artifact-located families do not have.
7. **`ref`** (item 5) — syntax, resolution into an artifact or live surface, and the absent-`ref` case.
8. **Target and interaction** (item 6) — how the bound target and its interaction pattern are identified.
9. **Operation-boundary correspondence** (item 7) — how caller-facing input values map to the interaction, which outcomes are successes and how their values are produced, any context bindings provided at transform positions, and the named interpretation points for anything incorporated authorities do not answer (see _Portable actionability_).
10. **Conformance** (recommended) — stable rule identifiers for the specification's own requirements, and fixtures. Diagnostic and provenance-stamp names are implementation surface (reference-tool documentation), not specification content.
11. **References.**

Credential acquisition is intentionally absent from the template because it
is runtime policy, not OBI content. Where an incorporated artifact or protocol
declares security, its authority, alternatives, and wire placement still
belong in operation-boundary correspondence; the implementation-specific
negotiation surface does not.

**State boundary facts abstractly; scope interface mentions as realizations.**
A binding specification must remain consumable by any invocation surface, not
only the project's published invoker interfaces. Its rules therefore state
operation-boundary facts in the specification's own terms — "admits
application-authored failure data," "refuses before dispatch," "completes
unsuccessfully" — never in another contract's vocabulary (an error record's
member names, interface-owned code spellings, a frame model). Where naming the
project interfaces genuinely helps a reader, the mention is scoped as one
realization: *"when the project's portable invocation interface is used, the
admitted value rides its optional error `data` member."* A rule whose meaning
depends on such a mention has placed part of the binding specification's
authority in a non-normative, independently versioned contract; a third-party
implementer reading it cannot tell whether conformance requires the project's
tooling. The corpus verifier enforces this mechanically: a paragraph in a
family specification using coupling vocabulary without a scoping marker fails
`verify-binding-specs`.

A specification whose address forms, artifact forms, or **execution model** create exposure beyond the core's threat surface — an executable address form, an artifact that names local resources, a composition engine with amplification or recursion surface — adds a **security consideration** with a normative floor where the exposure is of the specification's own making; `openbindings.usage@1`'s default-deny exec-address rule and `openbindings.operation-graph@1`'s security-considerations section are the patterns.

Draft pages in this directory use the conventions-era tier tags; promotion maps them onto the template as follows: **[format-spec]** answers restate under _incorporated authorities_; **[convention]** answers become normative rules of the specification; **[assumption]** answers become normative defaults at named configuration points; **[open]** items must be resolved before promotion — as a rule, a configuration point, or an explicit exclusion.

### Promotion

A draft is promoted when every OBI-B-02 item has a definite answer under the template — a rule, a named configuration point, an explicit exclusion, or a scoped incorporation of another published binding specification by exact identifier. Promotion mints the identifier, and reference tooling adopts it — replacing the pre-bindingSpec token — in the same change. Conformance fixtures for the specification's own rules are recommended at promotion, alongside correcting the page's core citations to the current core text.

Promotion is **spec-first**: it designs the ideal specification for the family, not a codification of current reference-implementation behavior. Where shipped code and the promoted specification diverge, the code changes — each divergence is recorded as implementation work at promotion, and a specification is never weakened, nor an item left open, because an implementation has not caught up. An implementation's partial coverage is the implementation's own declaration, exactly as tools declare partial core support; it is never the specification's content.

### Designing a JSON-based binding specification

When an accepted artifact is itself a JSON document (rather than a wire-protocol identifier like a gRPC method name or an MCP tool name), the author chooses what to make normative: the document shape, or just the binding unit inside it. **Prefer the latter:**

- **The specification defines the addressable binding unit** (the value a `ref` resolves to), not the enclosing document.
- **The binding unit declares its own format version**, embedded on the unit itself, so one host document can carry units at different versions and the version travels with the unit when moved or copied. Under the identifier discipline this unit version is artifact self-identification — which unit versions a given revision accepts belongs in its _accepted source representations_ section; it is not the specification's `<rev>`.
- **`ref` is a JSON Pointer ([RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)).** Concretely, refs look like `"#/graphs/foo"` rather than `"foo"`. The empty pointer `"#"` resolves to the document root, so a document whose root _is_ a binding unit can be addressed without a name. This convention exists to prevent addressing sprawl across JSON-based sources: one shared scheme keeps refs self-describing and lets tools share resolution machinery. Authors with a concrete reason to deviate are free to do so — `ref` syntax is each binding specification's own to define (core [§5.3](../openbindings.md#53-bindings), OBI-B-02 item 5).
- **The enclosing document's shape is the author's concern.** Units may be embedded in a dedicated file, alongside units of other specifications, or at an `x-`-prefixed location inside an unrelated host document.

[`openbindings.operation-graph`](operation-graph/openbindings.operation-graph.md) follows this pattern: the specification defines a graph definition (its `nodes`, `edges`, validation rules, and required version field); the enclosing JSON document has no prescribed shape. A conventional `graphs` map at the root is documented for ergonomics but is non-normative.
