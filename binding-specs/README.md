# Binding specifications

**Status: index and authoring guidance for the binding specifications published by the openbindings project.** A **published** binding specification in this directory is normative for the identifier(s) it defines: it is the defining-authority text the core specification describes in [§6. Binding specifications](../openbindings.md#6-binding-specifications) and binds through the OBI-B rules of [§10.4](../openbindings.md#104-binding-specification-rules). This README itself is informative: it carries the cross-specification doctrine, the index, and the authoring template. The template is not a conformance target; the completeness floor it derives from ([OBI-B-02](../openbindings.md#104-binding-specification-rules)) is.

The key words MUST, SHOULD, and MAY in this document are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/info/bcp14) ([RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)) when, and only when, they appear in all capitals. Their force is scoped by this document's status: they carry no conformance weight here, but state the conventions a binding specification's own text adopts when it follows this guidance.

These are the **openbindings project's** binding specifications *for* the named source families: `openbindings.openapi@1` is this project's specification for binding OpenAPI documents, published under this project's namespace and authority. It is not a publication of, nor endorsed by, the family's own authority (the OpenAPI Initiative, the gRPC project, and so on), and it does not speak for them — upstream authority over the artifact and wire protocol is incorporated by reference, exactly as the template requires. An upstream community, or anyone else, may publish its own binding specification for the same family under its own identifier, with equal standing under the core.

## Identifiers

Project-published binding specifications are identified as `openbindings.<name>@<rev>`, where `<rev>` is an integer revision of the binding specification itself. Artifact and dialect versions never appear in the identifier: the artifact self-identifies where its format provides for that, and the specification's accepted-representations section states which artifact versions it accepts (core [§6](../openbindings.md#6-binding-specifications)).

- Identifiers are exact, opaque strings ([OBI-B-01](../openbindings.md#104-binding-specification-rules)): no ranges, no version algebra, no normalization, never dereferenced. A tool supports the exact identifiers it implements.
- An incompatible change publishes the next revision — a different identifier ([OBI-B-03](../openbindings.md#104-binding-specification-rules)). Compatible clarification may retain the identifier.
- **An identifier exists only when its specification meets the OBI-B-02 floor.** Draft pages in this directory mint no identifier, and tooling adopts an identifier only at publication.
- **Citations denote revisions, not files.** A citation into a published binding specification by its identifier denotes that revision's text as published, whatever the cited path later holds; a superseding revision leaves the prior revision's text available. Cross-specification citations SHOULD name stable rule identifiers alongside section links.

Migration note: `openbindings.operation-graph` originally published under the token `openbindings.operation-graph@0.2.0`; it now publishes as `openbindings.operation-graph@1`, with the graph-unit format's own version (0.2.x) carried by each graph's version field — the identifier/artifact-version split working as designed. Tooling replaces the old token in the coordinated 0.2.0 change.

## Index

| Specification | Document | Status | Identifier(s) | `ref` shape (summary) |
| --- | --- | --- | --- | --- |
| operation-graph | [openbindings.operation-graph.md](operation-graph/openbindings.operation-graph.md) | **published** (v1; template-structured; ships with the 0.2.0 change set — tooling adoption queued) | `openbindings.operation-graph@1` | JSON Pointer to a graph definition |
| usage | [openbindings.usage.md](usage/openbindings.usage.md) | **published** (v1; ships with the 0.2.0 change set — tooling adoption queued) | `openbindings.usage@1` | space-separated command path (absent ref = root) |
| openapi | [openbindings.openapi.md](openapi/openbindings.openapi.md) | **published** (v1; ships with the 0.2.0 change set — tooling adoption queued) | `openbindings.openapi@1` | JSON Pointer to the operation object |
| mcp | [openbindings.mcp.md](mcp/openbindings.mcp.md) | **published** (v1; ships with the 0.2.0 change set — tooling adoption queued) | `openbindings.mcp@1` | `<entity>/<remainder>`, entity ∈ `tools`/`resources`/`prompts`; resources by URI or template string |
| grpc | [openbindings.grpc.md](grpc/openbindings.grpc.md) | **published** (v1; ships with the 0.2.0 change set — tooling adoption queued) | `openbindings.grpc@1` | `<fully-qualified-service>/<method>` |
| connect | [openbindings.connect.md](connect/openbindings.connect.md) | **published** (v1; ships with the 0.2.0 change set — tooling adoption queued) | `openbindings.connect@1` | `<fully-qualified-service>/<method>` |
| asyncapi | [openbindings.asyncapi.md](asyncapi/openbindings.asyncapi.md) | **published** (v1; ships with the 0.2.0 change set — tooling adoption queued) | `openbindings.asyncapi@1` | JSON Pointer `#/operations/<operation-key>` |
| graphql | [openbindings.graphql.md](graphql/openbindings.graphql.md) | draft — no promotion scheduled | — | `<RootType>/<field>`, root PascalCase |
| workers-rpc | [openbindings.workers-rpc.md](workers-rpc/openbindings.workers-rpc.md) | draft — no promotion scheduled | — | `WorkerEntrypoint` method name |

Draft pages are seed material from the project's earlier per-format conventions records. Their content remains informational until promotion, and their core citations may reference pre-rewrite section numbering until then; each page's status banner says so.

## The completeness spectrum (specification + configuration = complete invocation)

A binding specification answers three **wire questions** per operation — from its accepted artifacts, by its own definition, or by delegating to declared consumer configuration:

1. **Routing** — which transport channel does each input field ride (path/query/header/body; argv/stdin/file)?
2. **Decode** — how do the returned bytes become the output value?
3. **Classify** — which completion outcomes (HTTP statuses, exit codes) are success?

Complete artifacts answer all three natively (OpenAPI: parameter locations, response content types, status codes). Incomplete ones leave gaps — a [jdx usage](https://usage.jdx.dev) CLI descriptor declares flags and args but cannot declare stdout decoding, exit-code meaning, or a field's stdin routing. **The gap is made up in consumer configuration, never by OB authoring the missing coverage into a document and never by the OBI absorbing format conventions.** An OBI stays abstract; the artifact stays pristine.

Within the completeness floor this maps as follows: an OBI-B-02 item — most often item 7, boundary correspondence — may be satisfied by a fixed rule or by a **named configuration point**: a normatively defined, content-independent assumption together with the declared configuration that overrides it. What it may not be is silent; an item left undefined is a defect of the binding specification ([OBI-B-02](../openbindings.md#104-binding-specification-rules)), and declaring an aspect explicitly unsupported is a definition, not a gap.

Implementations SHOULD expose three generic, format-agnostic hooks — an **output decoder**, a **result classifier**, and a **field router** — consulted per axis in a decline chain: *per-invocation configuration → consumer-level configuration → the binding specification's built-in*. An unconsulted axis and an unmentioned field fall through; a declined hook never blocks the next tier. The reference SDKs (Go and TypeScript) ship this seam as `OutputDecoder`/`ResultClassifier`/`FieldRouter`. The three-hook shape, its names, and the decline chain are the reference SDKs' design, not a required architecture: any consumer-configuration seam with equivalent reach serves, and an implementation MAY expose no seam at all — fixed built-in defaults are a legitimate design.

### Recommended built-in defaults

Where the artifact does not answer, this guidance calls for a **content-independent** built-in default — decided by declarations and wire framing, never by sniffing payload bytes (a payload-dependent default makes the same document behave differently per response, and a wrong guess passes silently). The project's recommended defaults, as shipped by the reference implementations:

| Specification family | Routing | Decode | Classify |
| --- | --- | --- | --- |
| openapi (HTTP) | artifact: parameter locations | **header rule**: the response's `Content-Type` header decides — strict JSON for `application/json` and `+json` suffixes (a declared-JSON body that fails to parse is a loud error, never a silent string), text otherwise | **2xx rule**: success iff status ∈ 2xx; declared `responses` refine failure *details*, never classification |
| asyncapi | artifact: channel/message (payload wholesale — no field routing) | direction-correct declared content types (reply-side for publishes, message-side for subscriptions; conflicts fall to text); envelope unwrapping a consumer override, never a built-in | transport-native per interaction cell (2xx final status on the unary publish lane); message content never reclassifies |
| usage (CLI) | assumption: argv (consumer hooks route fields to stdin / `-`-operand / temp file) | assumption: stdout as text, trailing newlines stripped (command-substitution semantics) | assumption: exit 0 |
| mcp | none — payload wholesale | `structuredContent` first, single-text-block verbatim, block passthrough; resources by declared `mimeType`; progress solicitation off | protocol: `isError` / JSON-RPC error |
| grpc / connect | artifact: protobuf | artifact: protobuf | protocol: status codes / END_STREAM |

`openbindings.connect@1`'s descriptorless mode has no artifact: there, routing and classification are protocol-answered and decode is that specification's fixed verbatim-JSON rule — see its §9.3.

Two of these are the conventions the reference implementations hold fixed across the HTTP lanes where classification is a convention rather than protocol-answered (`openbindings.connect@1`'s lane is 200-exact by its protocol's own rule): (1) *the header decides the decode lane* — never the payload shape; (2) *success is 2xx and declared responses never change classification* — a declared 404 response documents a failure's shape, it does not bless the failure. Once a binding specification here publishes, its answers to these axes are normative for its identifier; this table records the defaults project specifications adopt. A binding specification published under another authority that chooses differently defines its own rules — the point of the identifier is that consumers can tell.

Implementations SHOULD report which rule answered each axis (the reference SDKs stamp `x-ob-decode`/`x-ob-classify`/`x-ob-route` provenance on invocation metadata, and warn when an assumption decoded into a contract that could not catch a wrong lane; a third-party implementation's provenance surface and names are its own).

## Authentication and credentials

Credentials and other runtime prerequisites are **not** part of an OBI document and are not extracted into it from an artifact's security metadata. The binding invoker applies credentials at call time and negotiates anything missing via a `CONTEXT_REQUIRED` challenge, resolved into the runtime's store — see the [`binding-invoker`](https://openbindings.com/interfaces/binding-invoker) interface. An artifact's own security metadata (for example OpenAPI's `securitySchemes`) may inform what the invoker asks for at invocation time, but is never baked into the static document.

## Field naming across protocol locations

Many source families present parameters from several protocol locations (path, query, headers, body) as a single object-shaped view. In that flattened representation each field name maps to at most one value, and within a JSON object property names are unique. OpenBindings works best when a source can be represented with unique field names across its effective input/output surface.

When collisions are unavoidable (e.g., `id` as both a path parameter and a body field), the convention of record — implemented by the reference openapi packages — is **one name, one value, delivered to every declared wire location**: the flattened contract carries one field (the body's schema, deterministically), synthesis emits a warning (`openapi.param_body_collision`) so the merge is never silent, and at invocation the single caller value rides the parameter location AND stays in the body. The flattened contract says *what*; the wire locations are plumbing. A source family whose colliding declarations genuinely carry different values cannot be represented by the flatten and needs specification-specific handling. The load-bearing point is that a collision merge is never silent; `openapi.param_body_collision` is the reference packages' diagnostic name — a third-party synthesizer's may differ.

## Authoring a new binding specification

A binding specification makes a family of sources and bindings mean the same thing to every independent implementation. The core states the completeness floor normatively ([OBI-B-02](../openbindings.md#104-binding-specification-rules)); the template below is the section-by-section shape project specifications use to meet it. Third parties publish under their own collision-resistant namespace (`com.example.<name>@<rev>` fits the same shape) with no project registration; the same template serves.

### The template

1. **Status and identifier** — the exact identifier this document defines, its defining authority, and the revision discipline (OBI-B-01, OBI-B-03). The document may carry its own edition label; that label is not the identifier.
2. **Scope and incorporated authorities** — the upstream specifications incorporated by reference (the OpenAPI specification, the protobuf language, the MCP revision) and the boundary between their authority and this specification's overlay. A specification MAY also incorporate a **sibling published binding specification** by exact identifier, scoped to named sections and rule identifiers (`openbindings.connect@1`'s schema layer, cited from `openbindings.grpc@1`, is the pattern) — the "citations denote revisions" discipline above governs.
3. **Accepted source representations** (OBI-B-02 item 1) — every representation the specification accepts, deterministic discrimination when it accepts several, and the encoding for any non-JSON artifact.
4. **`location`** (item 2) — the accepted absolute-address syntax and what it addresses.
5. **`content`** (item 3) — the accepted JSON values and their meaning.
6. **Composition** (item 4) — the role of a co-present `location`, including whether it supplies a reference base for embedded content, within the content-primacy floor of core [§5.4](../openbindings.md#54-sources). Service-addressed families additionally define their pin's **staleness** posture (dispatch proceeds against the pin; the live server's own error is a failure outcome) — a drift question artifact-located families do not have.
7. **`ref`** (item 5) — syntax, resolution into the artifact, and the absent-`ref` case.
8. **Target and interaction** (item 6) — how the bound target and its interaction pattern are identified.
9. **Operation-boundary correspondence** (item 7) — how caller-facing input values map to the interaction, which outcomes are successes and how their values are produced, any context bindings provided at transform positions, and the named configuration points for anything the artifact cannot answer (see *The completeness spectrum*).
10. **Conformance** (recommended) — stable rule identifiers for the specification's own requirements, and fixtures. Diagnostic and provenance-stamp names are implementation surface (reference-tool documentation), not specification content.
11. **References.**

Authentication is intentionally absent from the template: it is negotiated at invocation time (above), not declared by the binding specification in the OBI.

A specification whose address forms, artifact forms, or **execution model** create exposure beyond the core's threat surface — an executable address form, an artifact that names local resources, a composition engine with amplification or recursion surface — adds a **security consideration** with a normative floor where the exposure is of the specification's own making; `openbindings.usage@1`'s default-deny exec-address rule and `openbindings.operation-graph@1`'s security-considerations section are the patterns.

Draft pages in this directory use the conventions-era tier tags; promotion maps them onto the template as follows: **[format-spec]** answers restate under *incorporated authorities*; **[convention]** answers become normative rules of the specification; **[assumption]** answers become normative defaults at named configuration points; **[open]** items must be resolved before promotion — as a rule, a configuration point, or an explicit exclusion.

### Promotion

A draft is promoted when every OBI-B-02 item has a definite answer under the template — a rule, a named configuration point, an explicit exclusion, or a scoped incorporation of another published binding specification by exact identifier. Promotion mints the identifier, and reference tooling adopts it — replacing the pre-bindingSpec token — in the same change. Conformance fixtures for the specification's own rules are recommended at promotion, alongside correcting the page's core citations to the current core text.

Promotion is **spec-first**: it designs the ideal specification for the family, not a codification of current reference-implementation behavior. Where shipped code and the promoted specification diverge, the code changes — each divergence is recorded as implementation work at promotion, and a specification is never weakened, nor an item left open, because an implementation has not caught up. An implementation's partial coverage is the implementation's own declaration, exactly as tools declare partial core support; it is never the specification's content.

### Designing a JSON-based binding specification

When an accepted artifact is itself a JSON document (rather than a wire-protocol identifier like a gRPC method name or an MCP tool name), the author chooses what to make normative: the document shape, or just the binding unit inside it. **Prefer the latter:**

- **The specification defines the addressable binding unit** (the value a `ref` resolves to), not the enclosing document.
- **The binding unit declares its own format version**, embedded on the unit itself, so one host document can carry units at different versions and the version travels with the unit when moved or copied. Under the identifier discipline this unit version is artifact self-identification — which unit versions a given revision accepts belongs in its *accepted source representations* section; it is not the specification's `<rev>`.
- **`ref` is a JSON Pointer ([RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)).** Concretely, refs look like `"#/graphs/foo"` rather than `"foo"`. The empty pointer `"#"` resolves to the document root, so a document whose root *is* a binding unit can be addressed without a name. This convention exists to prevent addressing sprawl across JSON-based sources: one shared scheme keeps refs self-describing and lets tools share resolution machinery. Authors with a concrete reason to deviate are free to do so — `ref` syntax is each binding specification's own to define (core [§5.3](../openbindings.md#53-bindings), OBI-B-02 item 5).
- **The enclosing document's shape is the author's concern.** Units may be embedded in a dedicated file, alongside units of other specifications, or at an `x-`-prefixed location inside an unrelated host document.

[`openbindings.operation-graph`](operation-graph/openbindings.operation-graph.md) follows this pattern: the specification defines a graph definition (its `nodes`, `edges`, validation rules, and required version field); the enclosing JSON document has no prescribed shape. A conventional `graphs` map at the root is documented for ergonomics but is non-normative.
