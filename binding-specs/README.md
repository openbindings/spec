# Binding specifications

**Status: index and authoring guidance for the binding specifications published by the openbindings project.** A **published** binding specification in this directory is normative for the identifier(s) it defines: it is the defining-authority text the core specification describes in [§6. Binding specifications](../openbindings.md#6-binding-specifications) and binds through the OBI-B rules of [§10.4](../openbindings.md#104-binding-specification-rules). This README itself is informative: it carries the cross-specification doctrine, the index, and the authoring template. The template is not a conformance target; the completeness floor it derives from ([OBI-B-02](../openbindings.md#104-binding-specification-rules)) is.

The key words MUST, SHOULD, and MAY in this document are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/info/bcp14) ([RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)) when, and only when, they appear in all capitals. Their force is scoped by this document's status: they carry no conformance weight here, but state the conventions a binding specification's own text adopts when it follows this guidance.

These are the **openbindings project's** binding specifications _for_ the named source families: `openbindings.openapi@1` is this project's specification for binding OpenAPI documents, published under this project's namespace and authority. It is not a publication of, nor endorsed by, the family's own authority (the OpenAPI Initiative, the gRPC project, and so on), and it does not speak for them — where an existing artifact or protocol authority exists, its rules are incorporated by reference. An upstream community, or anyone else, may publish its own binding specification for the same family under its own identifier, with equal standing under the core.

## Identifiers

Project-published binding specifications are identified as `openbindings.<name>@<rev>`, where `<rev>` is an integer revision of the binding specification itself. Artifact and dialect versions never appear in the identifier: the artifact self-identifies where its format provides for that, and the specification's accepted-representations section states which artifact versions it accepts (core [§6](../openbindings.md#6-binding-specifications)).

- Identifiers are exact, opaque strings ([OBI-B-01](../openbindings.md#104-binding-specification-rules)): no ranges, no version algebra, no normalization, never dereferenced. A tool supports the exact identifiers it implements.
- An incompatible change publishes the next revision — a different identifier ([OBI-B-03](../openbindings.md#104-binding-specification-rules)). Compatible clarification may retain the identifier.
- **An identifier exists only when its specification meets the OBI-B-02 floor.** Draft pages in this directory mint no identifier, and tooling adopts an identifier only at publication.
- **Citations denote revisions, not files.** A citation into a published binding specification by its identifier denotes that revision's text as published, whatever the cited path later holds; a superseding revision leaves the prior revision's text available. Cross-specification citations SHOULD name stable rule identifiers alongside section links.

Migration note: `openbindings.operation-graph` originally published under the token `openbindings.operation-graph@0.2.0`; it now publishes as `openbindings.operation-graph@1`, with the exact graph-unit format version (`0.2.0` in this revision) carried by each graph's version field — the identifier/artifact-version split working as designed. Tooling replaces the old token in the coordinated 0.2.0 change.

## Artifact authority and presence

A binding specification governs a family of sources and bindings; it is not required to begin with an externally defined artifact family. Artifact **authority** and artifact **presence** are separate choices:

1. A specification may incorporate an existing artifact format and protocol. `openbindings.openapi@1` incorporates OpenAPI and HTTP.
2. A specification may define the artifact format and interaction model itself. `openbindings.operation-graph@1` defines the graph artifact, its nodes, and its execution semantics; there is no external artifact authority for it to incorporate.
3. A specification may accept an artifactless source mode. `openbindings.connect@1`'s descriptorless mode uses a service `location` and binding `ref` without schema `content`; the Connect protocol and the binding specification completely define the narrower interaction. A specification may also define absent `ref` to target `location` itself, leaving `bindingSpec` plus `location` as the complete concrete address.

The **source** remains required in every case. An artifactless source is location-only: the binding specification defines what the location addresses, what `ref` means or whether it is absent, and every interaction and operation-boundary rule an artifact would otherwise have supplied. Calling the mode artifactless does not relax [OBI-B-02](../openbindings.md#104-binding-specification-rules); it makes more of that semantic burden the binding specification's own.

## Index

| Specification   | Document                                                                           | Status                                                                                             | Identifier(s)                    | `ref` shape (summary)                                                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| operation-graph | [openbindings.operation-graph.md](operation-graph/openbindings.operation-graph.md) | **published** (v1; template-structured; ships with the 0.2.0 change set — tooling adoption queued) | `openbindings.operation-graph@1` | JSON Pointer to a graph definition                                                                                                                                 |
| usage           | [openbindings.usage.md](usage/openbindings.usage.md)                               | **published** (v1; ships with the 0.2.0 change set — tooling adoption queued)                      | `openbindings.usage@1`           | space-separated command path (absent ref = root)                                                                                                                   |
| openapi         | [openbindings.openapi.md](openapi/openbindings.openapi.md)                         | **published** (v1; ships with the 0.2.0 change set — tooling adoption queued)                      | `openbindings.openapi@1`         | JSON Pointer to the operation object                                                                                                                               |
| mcp             | [openbindings.mcp.md](mcp/openbindings.mcp.md)                                     | **published** (v1; ships with the 0.2.0 change set — tooling adoption queued)                      | `openbindings.mcp@1`             | `<entity>/<remainder>`, entity ∈ `tools`/`resources`/`resourceTemplates`/`prompts` (one per MCP listable collection); resource by URI, template by template string |
| grpc            | [openbindings.grpc.md](grpc/openbindings.grpc.md)                                  | **published** (v1; ships with the 0.2.0 change set — tooling adoption queued)                      | `openbindings.grpc@1`            | `<fully-qualified-service>/<method>`                                                                                                                               |
| connect         | [openbindings.connect.md](connect/openbindings.connect.md)                         | **published** (v1; ships with the 0.2.0 change set — tooling adoption queued)                      | `openbindings.connect@1`         | `<fully-qualified-service>/<method>`                                                                                                                               |
| asyncapi        | [openbindings.asyncapi.md](asyncapi/openbindings.asyncapi.md)                      | **published** (v1; ships with the 0.2.0 change set — tooling adoption queued)                      | `openbindings.asyncapi@1`        | JSON Pointer `#/operations/<operation-key>`                                                                                                                        |
| graphql         | [openbindings.graphql.md](graphql/openbindings.graphql.md)                         | **design-review candidate** — proposed v1 contract; no identifier minted                           | —                                | `query/<field>`, `mutation/<field>`, or `subscription/<field>`                                                                                                     |
| workers-rpc     | [openbindings.workers-rpc.md](workers-rpc/openbindings.workers-rpc.md)             | **design-review candidate** — proposed v1 contract; no identifier minted                           | —                                | exact `WorkerEntrypoint` method property key                                                                                                                       |

Candidate pages remain informational until promotion. They use the full authoring template and proposed rule identifiers so design review can evaluate a complete boundary without mistaking the proposal for a published identifier; each page's status banner states the remaining publication gates.

## The deference order

A binding specification is a semantic authority, often operating under divided authority. Where an existing artifact or protocol speaks, it is not an opportunity to normalize the source family into one preferred wire behavior; apply the following deference order. Where the binding specification defines the artifact or interaction itself, those definitions are first-order rules rather than fallback defaults, and the OBI-B-02 completeness floor is unchanged.

1. **Incorporate** what the artifact or protocol defines. Restate only the OpenBindings consequence; do not replace an upstream rule with a locally convenient equivalent.
2. **Preserve alternatives** when the artifact permits several valid choices. Conformance may be a permitted set rather than one byte-identical request; a binding specification does not invent preference merely to make implementations choose alike.
3. **Expose configuration** when invocation requires a choice the artifact does not make. The point defines the admissible choice and its effect; the runtime chooses, and its configuration API remains implementation surface.
4. **Refuse or exclude** behavior OpenBindings cannot represent faithfully. A loud, pre-dispatch refusal is more conformant than silently identifying distinct artifact values, discarding required information, or approximating an interaction the artifact did not declare.
5. **Define a default only as a last resort**, where the artifact is silent, invocation still needs an answer, and neither configuration nor a narrower supported subset is adequate. The text labels that answer as this binding specification's convention and gives it a named configuration point where consumer choice is meaningful.

### Targeted 0.2.0 design decisions

The adversarial review resolved the former lower-confidence questions below. These are recorded so a later implementation does not reopen them privately; changing one requires another specification-level compatibility review against the incorporated artifact.

- **Usage field identity and multiplicity:** first-long-else-first-short remains the canonical JSON field identity. Identity collisions, combined repeatable-plus-variadic declarations, and order-dependent `overrides` inputs refuse; count, repeatable, and variadic forms otherwise keep distinct argv shapes.
- **Usage optional `--`:** both artifact-permitted spellings remain an unordered permitted set through the `delimiter` point. The processor corpus accepts both and gives neither preference.
- **AsyncAPI protocol fields:** revision 1 admits only string-valued query/header fields and labels URI-component encoding as its OpenBindings convention. Non-string schemas refuse until an upstream serialization profile or later binding-specification revision supplies a faithful encoding.
- **AsyncAPI WebSocket replies:** reply-bearing `receive` operations remain excluded until a request/reply session model is specified; revision 1 neither drops replies nor turns every WebSocket publish bidirectional.
- **Operation Graph startup:** every held `operation` invocation opens at graph start. This preserves the identity law and output-before-input causality; the eager timing consequence is explicit and covered by OG-EX-39..46.
- **Candidate publication scope:** GraphQL keeps its single-root-field check, both HTTP media lanes, pinned subscription protocol, and standard-introspection acquisition. Workers RPC keeps its zero/one-argument JSON subset, zero-output `undefined` completion, opaque-registry address, and artifactless mode under the catalog's existing completeness rule. Both remain unminted until their page-specific evidence and runtime-adoption gates pass.

These decisions are intentionally specific. “Let each implementation choose” is not an acceptable substitute; a future review keeps the rule, replaces it with a better incorporated/configured rule, or narrows the supported set explicitly.

The shorthand is **incorporate → preserve → configure → refuse → default**. “Refuse rather than invent” is the governing correction: completeness requires a definite answer, but an explicit exclusion is a definite answer, while an invented approximation changes the source's meaning.

This order does not require identical requests where the upstream authority permits alternatives. It requires every observable choice to remain inside the upstream-permitted set, every OpenBindings convention to be necessary and visible, and the same declared configuration to have the same semantic effect. During review, words such as _first_, _default_, _precedence_, _discard_, _ignore_, _one value_, and _this specification's pin_ deserve an authority check: who supplied that rule, and could incorporation, configuration, or refusal preserve more of the artifact instead?

## Release-quality review loop

Use one repeatable loop for a new specification and for every release audit of
an existing one. A polished document is not the exit condition; the exit is a
complete, upstream-deferential contract with adversarial evidence.

1. **Grade from evidence.** Score authority/pinning, OBI-B-02 completeness,
   deference, information preservation, determinism, implementability,
   conformance evidence, and teaching quality. Record every deduction as a
   concrete scenario, not a general impression.
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
   independent processors choosing different behavior; a lossy round trip; a
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
- every normative upstream authority is immutable or versioned, with conflict
  precedence stated when several authorities overlap;
- every observable choice follows the deference order, with no silent loss and
  no unlabeled OpenBindings default;
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

## The completeness spectrum (specification + configuration = complete invocation)

A binding specification answers three **wire questions** per operation — from its accepted artifacts, by its own definition, or by delegating to declared consumer configuration:

1. **Routing** — which transport channel does each input field ride (path/query/header/body; argv/stdin/file)?
2. **Decode** — how do the returned bytes become the output value?
3. **Classify** — which completion outcomes (HTTP statuses, exit codes) are success?

Complete artifacts answer all three natively (OpenAPI: parameter locations, response content types, status codes). Incomplete ones leave gaps — a [jdx usage](https://usage.jdx.dev) CLI descriptor declares flags and args but cannot declare stdout decoding, exit-code meaning, or a field's stdin routing. **The gap is made up in consumer configuration, never by OB authoring the missing coverage into a document and never by the OBI absorbing format conventions.** An OBI stays abstract; the artifact stays pristine.

Within the completeness floor this maps as follows: an OBI-B-02 item — most often item 7, boundary correspondence — may be satisfied by a fixed rule or by a **named configuration point**: a normatively defined set of admissible choices and the exact effect of choosing one. A point may have a content-independent built-in that configuration overrides, or it may be **required** where any built-in would invent source semantics; in the latter case invocation without a choice refuses before dispatch. What an item may not be is silent: an undefined choice is a defect of the binding specification ([OBI-B-02](../openbindings.md#104-binding-specification-rules)), while a required choice or an explicitly unsupported aspect is a definition, not a gap.

Implementations SHOULD expose three generic, format-agnostic hooks — an **output decoder**, a **result classifier**, and a **field router** — consulted per axis in a decline chain: _per-invocation configuration → consumer-level configuration → the binding specification's built-in, if any_. An unconsulted axis and an unmentioned field fall through; a declined hook never blocks the next tier. Reaching the end of a required point without a choice refuses before dispatch. The reference SDKs (Go and TypeScript) ship this seam as `OutputDecoder`/`ResultClassifier`/`FieldRouter`. The three-hook shape, its names, and the decline chain are the reference SDKs' design, not a required architecture: any consumer-configuration seam with equivalent reach serves. An implementation MAY expose no seam for a point with a fixed built-in; an implementation claiming dispatch support for a required point necessarily provides an equivalent way to supply its choice.

### Recommended built-in defaults

Where the artifact does not answer and the deference order reaches its final step, this guidance permits a **content-independent** built-in default — decided by declarations and wire framing, never by sniffing payload bytes (a payload-dependent default makes the same document behave differently per response, and a wrong guess passes silently). Before adopting one, authors consider a named required choice or a narrower explicitly supported subset. The project's recommended defaults, as shipped by the reference implementations:

| Specification family | Routing                                                                           | Decode                                                                                                                                                                                                                                    | Classify                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| openapi (HTTP)       | artifact: parameter locations                                                     | **header rule**: the response's `Content-Type` header decides — strict JSON for `application/json` and `+json` suffixes (a declared-JSON body that fails to parse is a loud error, never a silent string), text otherwise                 | **2xx rule**: success iff status ∈ 2xx; declared `responses` refine failure _details_, never classification            |
| asyncapi             | artifact: channel/message (payload wholesale — no field routing)                  | direction-correct declared content types (reply-side for publishes, message-side for subscriptions); conflicting declarations refuse, while universal absence requires an explicit `decode` choice; envelope unwrapping is never built in | transport-native per interaction cell (2xx final status on the unary publish lane); message content never reclassifies |
| usage (CLI)          | assumption: argv (consumer hooks route fields to stdin / `-`-operand / temp file) | assumption: stdout as text, trailing newlines stripped (command-substitution semantics)                                                                                                                                                   | assumption: exit 0                                                                                                     |
| mcp                  | none — payload wholesale                                                          | protocol result object preserved losslessly sans JSON-RPC envelope; progress solicitation off                                                                                                                                             | protocol: `isError` / JSON-RPC error                                                                                   |
| grpc / connect       | artifact: protobuf                                                                | artifact: protobuf                                                                                                                                                                                                                        | protocol: status codes / END_STREAM                                                                                    |

`openbindings.connect@1`'s descriptorless mode has no artifact: there, routing and classification are protocol-answered and decode is that specification's fixed verbatim-JSON rule — see its §9.3.

Two of these are the conventions the reference implementations hold fixed across the HTTP lanes where classification is a convention rather than protocol-answered (`openbindings.connect@1`'s lane is 200-exact by its protocol's own rule): (1) _the header decides the decode lane_ — never the payload shape; (2) _success is 2xx and declared responses never change classification_ — a declared 404 response documents a failure's shape, it does not bless the failure. Once a binding specification here publishes, its answers to these axes are normative for its identifier; this table records the defaults project specifications adopt. A binding specification published under another authority that chooses differently defines its own rules — the point of the identifier is that consumers can tell.

Implementations SHOULD report which rule answered each axis (the reference SDKs stamp `x-ob-decode`/`x-ob-classify`/`x-ob-route` provenance on invocation metadata, and warn when an assumption decoded into a contract that could not catch a wrong lane; a third-party implementation's provenance surface and names are its own).

### The bytes boundary

The operation value domain is JSON (core [§5](../openbindings.md#5-document-model)), so a value that is neither a JSON value nor a string — arbitrary bytes — needs a **boundary encoding** to cross the seam. This is one instance of the decode/routing answers above, not a separate mechanism, and it is governed by two principles in order:

1. **Follow the artifact where it declares an encoding.** OpenAPI's `contentEncoding` (`base64`/`base64url`), gRPC/Connect's ProtoJSON `bytes`, and MCP's resource `blob` all define how bytes ride; a binding specification incorporates its family's answer and does not override it. The artifact keeps authority over its own bytes.
2. **Default to Base64 only in the gap** — where a family admits bytes but the artifact signals them without an encoding (OpenAPI's `format: binary`, a 3.1 raw-binary shape). **Base64 is the project's recommended boundary encoding**, and a specification that adopts it says so in its own text (`openbindings.openapi@1` §9.2 is the pattern: "this specification's boundary encoding for bytes"). This is a recommended default like the table above — not a cross-specification mandate; the catalog has no mechanism for one, so each specification restates it and a specification published under another authority may choose differently.

A family whose revision does not define bytes carriage on some axis **declares the gap** rather than leaving it silent (`openbindings.openapi@1`'s raw-binary request-body refusal and "no base64 response lane"; `openbindings.asyncapi@1`'s value-domain note on non-string, non-JSON payloads; `openbindings.usage@1`'s text-only stdout default). Closing such a gap is a later revision's work, following the two principles above.

## Authentication and credentials

Credentials and other runtime prerequisites are **not** part of an OBI document and are not extracted into it from an artifact's security metadata. The binding invoker applies credentials at call time and negotiates anything missing via a `CONTEXT_REQUIRED` challenge, resolved into the runtime's store — see the [`binding-invoker`](https://openbindings.com/interfaces/binding-invoker) interface. An artifact's own security metadata (for example OpenAPI's `securitySchemes`) may inform what the invoker asks for at invocation time, but is never baked into the static document.

## Field naming across protocol locations

Many source families present parameters from several protocol locations (path, query, headers, body) as a single object-shaped view. In that flattened representation each field name maps to at most one value, and within a JSON object property names are unique. OpenBindings works best when a source can be represented with unique field names across its effective input/output surface.

When declarations are distinct in the artifact but collapse to one property name in a flattened representation, the flatten MUST NOT invent equality between them. The `openbindings.openapi@1` rule is conservative: a same-named pair across parameter locations, or across a parameter and an object-body property, makes the operation unflattenable and is refused at binding resolution. A future revision may define a disambiguated envelope; revision 1 narrows coverage rather than duplicating one value into independent wire locations. A synthesizer should diagnose the loss at projection time as well, but a diagnostic never turns a lossy merge into faithful invocation.

## Authoring a new binding specification

A binding specification makes a family of sources and bindings mean the same thing to every independent implementation. The core states the completeness floor normatively ([OBI-B-02](../openbindings.md#104-binding-specification-rules)); the template below is the section-by-section shape project specifications use to meet it. Third parties publish under their own collision-resistant namespace (`com.example.<name>@<rev>` fits the same shape) with no project registration; the same template serves.

Apply the [deference order](#the-deference-order) to every answer in the template. In particular, “complete” does not mean “choose one OpenBindings behavior whenever the artifact permits several”: preserve the permitted set, expose a choice when invocation needs one, or narrow coverage explicitly.

### The template

1. **Status and identifier** — the exact identifier this document defines, its defining authority, and the revision discipline (OBI-B-01, OBI-B-03). The document may carry its own edition label; that label is not the identifier.
2. **Scope and authorities** — every upstream specification incorporated by reference (the OpenAPI specification, the protobuf language, the MCP revision) and the boundary between its authority and this specification's overlay; or, where no external artifact authority exists, an explicit statement of the artifact and interaction semantics this specification defines itself. A specification MAY also incorporate a **sibling published binding specification** by exact identifier, scoped to named sections and rule identifiers (`openbindings.connect@1`'s schema layer, cited from `openbindings.grpc@1`, is the pattern) — the "citations denote revisions" discipline above governs.
3. **Accepted source representations** (OBI-B-02 item 1) — whether each source mode accepts an artifact; every representation accepted where one exists; deterministic discrimination when it accepts several; and the encoding for any non-JSON artifact. An artifactless mode states that fact explicitly.
4. **`location`** (item 2) — the accepted absolute-address syntax and what it addresses. **Acquisition-failure semantics follow the address scheme:** where `location` is a URI, whether a dereference succeeded is the scheme's own affair (an HTTP status, a `file://` open error, a TLS failure), and a specification need say nothing — the terseness is deference, not an omission. A specification that mints an address form with no incorporating scheme (an executable address, say) owes the success condition itself, because none is inherited (`openbindings.usage@1`'s `exec:` requires exit 0, its stdout otherwise not an artifact, is the pattern).
5. **`content`** (item 3) — the accepted JSON values and their meaning, including any mode in which `content` is forbidden.
6. **Composition** (item 4) — the role of a co-present `location`, including whether it supplies a reference base for embedded content, within the content-primacy floor of core [§5.4](../openbindings.md#54-sources). Service-addressed families additionally define their pin's **staleness** posture (dispatch proceeds against the pin; the live server's own error is a failure outcome) — a drift question artifact-located families do not have.
7. **`ref`** (item 5) — syntax, resolution into an artifact or live surface, and the absent-`ref` case.
8. **Target and interaction** (item 6) — how the bound target and its interaction pattern are identified.
9. **Operation-boundary correspondence** (item 7) — how caller-facing input values map to the interaction, which outcomes are successes and how their values are produced, any context bindings provided at transform positions, and the named configuration points for anything incorporated authorities do not answer (see _The completeness spectrum_).
10. **Conformance** (recommended) — stable rule identifiers for the specification's own requirements, and fixtures. Diagnostic and provenance-stamp names are implementation surface (reference-tool documentation), not specification content.
11. **References.**

Authentication is intentionally absent from the template: it is negotiated at invocation time (above), not declared by the binding specification in the OBI.

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
