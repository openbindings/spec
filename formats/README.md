# Binding formats

**Status: non-normative reference for binding-format authors and implementers.** Not part of the core specification.

The key words MUST, SHOULD, and MAY in this document are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/info/bcp14) ([RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)) when, and only when, they appear in all capitals. Their force is scoped by this document's status: they carry no OpenBindings-conformance weight, but state the conventions of record that a format's own documentation adopts when it follows this guidance.

OpenBindings is binding-format-agnostic. The core spec defines the OBI document (operations, sources, bindings, refs) but deliberately does not define what a `ref` looks like, how credentials are applied, or how input maps to a protocol-specific request for any particular format. Those are each format's own concern, governed by the format's authoritative specification (and, where it has none, by the convention its widely-used implementations establish).

This directory holds the **companion format specifications** the openbindings project authors (currently [operation-graph](operation-graph/openbindings.operation-graph.md)). This README catalogs the `ref` conventions for common formats and the design guidance for authoring a new one.

## Format tokens: exact vs. range

A source declares an **exact** format version (e.g., `openapi@3.1`) describing a specific artifact. A tool typically declares the **range** it can handle (e.g., `openapi@^3.0.0` — how a tool expresses its supported range is its own declaration convention; caret ranges are the reference tooling's). The core spec defines the `format` field (see [`openbindings.md` §6.4](../openbindings.md#64-sources)) but leaves token equivalence and compatibility to each format's community. The project recommends `<name>@<version>` as the default token shape for new formats.

## `ref` conventions for common formats

A binding's `ref` identifies a specific entry within its source artifact. Its syntax is the format's own; the table is a reference, not a normative requirement.

| Format | Token (as a source declares it) | `ref` shape | Example |
| --- | --- | --- | --- |
| OpenAPI | `openapi@3.1` | JSON Pointer into the document (`/` → `~1`, method lowercase) | `#/paths/~1users/get` |
| AsyncAPI | `asyncapi@3.0` | JSON Pointer to the operation | `#/operations/sendMessage` |
| gRPC | `grpc` | `package.Service/Method` | `blend.CoffeeShop/GetMenu` |
| Connect | `connect` | `package.Service/Method` (shares protobuf with gRPC) | `blend.CoffeeShop/GetMenu` |
| MCP | `mcp@2025-11-25` | `<entity>/<name>`, entity ∈ `tools`/`resources`/`prompts` | `tools/get_weather` |
| GraphQL | `graphql` | `<RootType>/<field>`, root PascalCase | `Mutation/createUser` |
| usage (CLI, [jdx usage](https://usage.jdx.dev)) | `usage@2.0` | space-separated command path into the artifact (empty = root command) | `db migrate run` |
| operation-graph | `openbindings.operation-graph@0.2.0` | JSON Pointer to a graph definition | `#/graphs/paginateAll` |

Tokens above are exact-version examples of what a **source** declares; a tool advertising the **range** it handles writes `openapi@^3.0.0` or similar (see *Format tokens: exact vs. range* above).

A source's `location` points at the artifact (a URL, file path, server address, or endpoint); `content` may inline it. When `ref` is absent, the binding targets the artifact as a whole. Refer to each format's specification or library for the precise source and addressing rules.

What a `location` names — and therefore how a source carrying both `location` and `content` is interpreted ([`openbindings.md` OBI-T-15](../openbindings.md#143-tool-rules)) — differs by format. As the reference implementations record it:

- **Artifact-located** (`openapi`, `asyncapi`, `usage`, `operation-graph`): `location` names the artifact itself (the document's URL). With `content` present, the embedded artifact is authoritative and `location` is provenance.
- **Service-addressed** (`grpc`, `connect`, `mcp`, `graphql`): `location` addresses the live service (a gRPC `host:port`, an MCP or GraphQL endpoint URL), from which the artifact is discoverable (reflection, introspection, `tools/list`). With `content` present, `content` pins the artifact and `location` remains the invocation target.

A format not listed here that documents no pairing convention is content-authoritative by the core rule's default (OBI-T-15).

## The completeness spectrum (specification + configuration = complete invocation)

A binding-source format answers three **wire questions** per operation, or leaves them to its consumers:

1. **Routing** — which transport channel does each input field ride (path/query/header/body; argv/stdin/file)?
2. **Decode** — how do the returned bytes become the output value?
3. **Classify** — which completion outcomes (HTTP statuses, exit codes) are success?

Complete specifications answer all three from the artifact (OpenAPI: parameter locations, response content types, status codes). Incomplete ones leave gaps — a [jdx usage](https://usage.jdx.dev) CLI descriptor declares flags and args but cannot declare stdout decoding, exit-code meaning, or a field's stdin routing. **The gap is made up in consumer configuration, never by OB authoring the missing coverage into a document and never by the OBI absorbing format conventions.** An OBI stays abstract; the artifact stays pristine.

Implementations SHOULD expose three generic, format-agnostic hooks — an **output decoder**, a **result classifier**, and a **field router** — consulted per axis in a decline chain: *per-invocation configuration → invoker-level configuration → the format's built-in*. An unconsulted axis and an unmentioned field fall through; a declined hook never blocks the next tier. The reference SDKs (Go and TypeScript) ship this seam as `OutputDecoder`/`ResultClassifier`/`FieldRouter`. The three-hook shape, its names, and the decline chain are the reference SDKs' design, not a required architecture: any consumer-configuration seam with equivalent reach serves, and an implementation MAY expose no seam at all — fixed built-in defaults are a legitimate design.

### Recommended built-in defaults

Where the specification does not answer, this guidance calls for a **content-independent** built-in default — decided by declarations and wire framing, never by sniffing payload bytes (a payload-dependent default makes the same document behave differently per response, and a wrong guess passes silently). The project's recommended defaults, as shipped by the reference implementations:

| Format family | Routing | Decode | Classify |
| --- | --- | --- | --- |
| OpenAPI (HTTP) | spec: parameter locations | **header rule**: the response's `Content-Type` header decides — strict JSON for `application/json` and `+json` suffixes (a declared-JSON body that fails to parse is a loud error, never a silent string), text otherwise | **2xx rule**: success iff status ∈ 2xx; declared `responses` refine failure *details*, never classification |
| AsyncAPI | spec: channel/message | the operation's declared message `contentType` (same JSON/text split); convention envelopes (`{error}`/`{data}` unwrapping) are a consumer hook, not a built-in | not consulted (transport-level HTTP errors are transport, not a format verdict) |
| usage (CLI) | assumption: argv (consumer hooks route fields to stdin / `-`-operand / temp file) | assumption: stdout as text, trailing newlines stripped (command-substitution semantics) | assumption: exit 0 |
| gRPC / Connect | spec: protobuf | spec: protobuf | spec: status codes |

Two of these are the conventions the reference implementations hold fixed across their HTTP lanes: (1) *the header decides the decode lane* — never the payload shape; (2) *success is 2xx and declared responses never change classification* — a declared 404 response documents a failure's shape, it does not bless the failure. They carry no OpenBindings-conformance weight — the core spec leaves decode and success classification to each format and its consumers — but divergence here silently changes what the same document means across tools, so an implementation that chooses differently SHOULD document its rules where its users will see them.

Implementations SHOULD report which rule answered each axis (the reference SDKs stamp `x-ob-decode`/`x-ob-classify`/`x-ob-route` provenance on invocation metadata, and warn when an assumption decoded into a contract that could not catch a wrong lane; a third-party implementation's provenance surface and names are its own).

## Authentication and credentials

Credentials and other runtime prerequisites are **not** part of an OBI document and are not extracted into it from a format's security metadata. The binding invoker applies credentials at call time and negotiates anything missing via a `CONTEXT_REQUIRED` challenge, resolved into the runtime's store — see the [`binding-invoker`](https://openbindings.com/interfaces/binding-invoker) interface. A format's own security metadata (for example OpenAPI's `securitySchemes`) may inform what the invoker asks for at invocation time, but is never baked into the static document.

## Field naming across protocol locations

Many formats present parameters from several protocol locations (path, query, headers, body) as a single object-shaped view. In that flattened representation each field name maps to at most one value, and within a JSON object property names are unique. OpenBindings works best when a binding source can be represented with unique field names across its effective input/output surface.

When collisions are unavoidable (e.g., `id` as both a path parameter and a body field), the convention of record — implemented by the reference openapi packages — is **one name, one value, delivered to every declared wire location**: the flattened contract carries one field (the body's schema, deterministically), synthesis emits a warning (`openapi.param_body_collision`) so the merge is never silent, and at invocation the single caller value rides the parameter location AND stays in the body. The flattened contract says *what*; the wire locations are plumbing. A format whose colliding declarations genuinely carry different values cannot be represented by the flatten and needs format-specific handling. Like the rest of this guide, this is the convention of record, not a conformance requirement; the load-bearing point is that a collision merge is never silent, and `openapi.param_body_collision` is the reference packages' diagnostic name — a third-party synthesizer's may differ.

## Authoring a new binding format

When defining a new format, decide and document:

1. **Format token** — name and versioning strategy (versionless, caret range, or exact).
2. **`ref` syntax** — how a `ref` unambiguously identifies an entry within the artifact, and what an absent `ref` means.
3. **Source expectations** — what `location` names for the format (the artifact itself, or the live service it describes), what `content` carries, and what a source bearing BOTH means (see [`openbindings.md` §6.4](../openbindings.md#64-sources): artifact-located formats are content-authoritative with location as provenance; service-addressed formats pin the artifact in `content` while `location` remains the invocation target; a format that says nothing is content-authoritative).
4. **Input conventions** — any format-specific input-schema properties (e.g., GraphQL's `_query` const).
5. **Invocation shape** — which operations are unary, server-streaming, client-streaming, or bidirectional, and how each maps to the invoker's I/O.
6. **The completeness test** — does the value your `ref` resolves to, plus the format's authoritative specification, amount to a *complete invocation recipe* (where each input field goes, how values are encoded, how the response decodes, which outcomes are success)? Machine-interface artifacts (OpenAPI, protobuf, MCP) pass natively. Where the artifact is **lacking** — it describes a human surface (a CLI descriptor) or otherwise omits invocation semantics — do NOT author the missing half yourself: not by extending the artifact's format, not by stowing it in OBI extension members, and not by defining a wrapper document that "completes" the artifact. Document content-independent **assumptions** for each unanswered wire question, and let implementations expose **consumer hooks** that override them (see *The completeness spectrum* above). The configuration burden a format leaves its consumers is honest information about the format's completeness; pressure to reduce it belongs upstream, on the format's own specification. (This is the project's design law for the formats it authors, offered as guidance; per the core spec, format design authority rests with each format's community — [`openbindings.md` §6.3](../openbindings.md#63-bindings): the spec binds documents and tools, not future format specifications.)

Authentication is intentionally absent from this list: it is negotiated at invocation time (above), not declared by the format in the OBI.

### Designing a JSON-based binding format

When a format's artifact is itself a JSON document (rather than a wire-protocol identifier like a gRPC method name or an MCP tool name), the author chooses what to make normative: the document shape, or just the binding unit inside it. **Prefer the latter:**

- **The format spec defines the addressable binding unit** (the value a `ref` resolves to), not the enclosing document.
- **The binding unit declares its own format version**, embedded on the unit itself, so one host document can carry units at different versions and the version travels with the unit when moved or copied.
- **`ref` is a JSON Pointer ([RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)).** Concretely, refs look like `"#/graphs/foo"` rather than `"foo"`. The empty pointer `"#"` resolves to the document root, so a document whose root *is* a binding unit can be addressed without a name. This convention exists to prevent addressing sprawl across JSON-based formats: one shared scheme keeps refs self-describing and lets tools share resolution machinery. Format authors with a concrete reason to deviate are free to do so — this guide is the convention of record, not a conformance requirement ([`openbindings.md` §6.3](../openbindings.md#63-bindings) defers `ref` syntax to each format).
- **The enclosing document's shape is the author's concern.** Units may be embedded in a dedicated file, alongside units of other formats, or at an `x-`-prefixed location inside an unrelated host document.

[`openbindings.operation-graph`](operation-graph/openbindings.operation-graph.md) follows this pattern: the spec defines a graph definition (its `nodes`, `edges`, validation rules, and required version field); the enclosing JSON document has no prescribed shape. A conventional `graphs` map at the root is documented for ergonomics but is non-normative.
