# Binding formats

**Status: non-normative reference for binding-format authors and implementers.** Not part of the core specification.

OpenBindings is binding-format-agnostic. The core spec defines the OBI document (operations, sources, bindings, refs) but deliberately does not define what a `ref` looks like, how credentials are applied, or how input maps to a protocol-specific request for any particular format. Those are each format's own concern, governed by the format's authoritative specification (and, where it has none, by the convention its widely-used implementations establish).

This directory holds the **companion format specifications** the openbindings project authors (currently [operation-graph](operation-graph/openbindings.operation-graph.md)). This README catalogs the `ref` conventions for common formats and the design guidance for authoring a new one.

## Format tokens: exact vs. range

A source declares an **exact** format version (e.g., `openapi@3.1`) describing a specific artifact. A tool typically declares the **range** it can handle (e.g., `openapi@^3.0.0`). The core spec defines the `format` field (see [`openbindings.md` §6.4](../openbindings.md#64-sources)) but leaves token equivalence and compatibility to each format's community. The project recommends `<name>@<version>` as the default token shape for new formats.

## `ref` conventions for common formats

A binding's `ref` identifies a specific entry within its source artifact. Its syntax is the format's own; the table is a reference, not a normative requirement.

| Format | Token | `ref` shape | Example |
| --- | --- | --- | --- |
| OpenAPI | `openapi@3.x` | JSON Pointer into the document (`/` → `~1`, method lowercase) | `#/paths/~1users/get` |
| AsyncAPI | `asyncapi@3.x` | JSON Pointer to the operation | `#/operations/sendMessage` |
| gRPC | `grpc` | `package.Service/Method` | `blend.CoffeeShop/GetMenu` |
| Connect | `connect` | `package.Service/Method` (shares protobuf with gRPC) | `blend.CoffeeShop/GetMenu` |
| MCP | `mcp@<date>` | `<entity>/<name>`, entity ∈ `tools`/`resources`/`prompts` | `tools/get_weather` |
| GraphQL | `graphql` | `<RootType>/<field>`, root PascalCase | `Mutation/createUser` |
| Usage (CLI) | `usage@2.x` | space-separated command path | `db migrate run` |
| operation-graph | `openbindings.operation-graph@0.2.0` | JSON Pointer to a graph definition | `#/graphs/paginateAll` |

A source's `location` points at the artifact (a URL, file path, server address, or endpoint); `content` may inline it. When `ref` is absent, the binding targets the artifact as a whole. Refer to each format's specification or library for the precise source and addressing rules.

## Authentication and credentials

Credentials and other runtime prerequisites are **not** part of an OBI document and are not extracted into it from a format's security metadata. The binding invoker applies credentials at call time and negotiates anything missing via a `CONTEXT_REQUIRED` challenge, resolved into the runtime's store — see the [`binding-invoker`](../interfaces/binding-invoker/) interface. A format's own security metadata (for example OpenAPI's `securitySchemes`) may inform what the invoker asks for at invocation time, but is never baked into the static document.

## Field naming across protocol locations

Many formats present parameters from several protocol locations (path, query, headers, body) as a single object-shaped view. In that flattened representation each field name maps to at most one value, and within a JSON object property names are unique. OpenBindings works best when a binding source can be represented with unique field names across its effective input/output surface. When collisions are unavoidable (e.g., `id` as both a path parameter and a body field), format-specific or invoker-specific handling is required.

## Authoring a new binding format

When defining a new format, decide and document:

1. **Format token** — name and versioning strategy (versionless, caret range, or exact).
2. **`ref` syntax** — how a `ref` unambiguously identifies an entry within the artifact, and what an absent `ref` means.
3. **Source expectations** — what `location` and `content` mean for the format.
4. **Input conventions** — any format-specific input-schema properties (e.g., GraphQL's `_query` const).
5. **Invocation shape** — which operations are unary, server-streaming, client-streaming, or bidirectional, and how each maps to the invoker's I/O.

Authentication is intentionally absent from this list: it is negotiated at invocation time (above), not declared by the format in the OBI.

### Designing a JSON-based binding format

When a format's artifact is itself a JSON document (rather than a wire-protocol identifier like a gRPC method name or an MCP tool name), the author chooses what to make normative: the document shape, or just the binding unit inside it. **Prefer the latter:**

- **The format spec defines the addressable binding unit** (the value a `ref` resolves to), not the enclosing document.
- **The binding unit declares its own format version**, embedded on the unit itself, so one host document can carry units at different versions and the version travels with the unit when moved or copied.
- **`ref` is a JSON Pointer ([RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)).** Concretely, refs look like `"#/graphs/foo"` rather than `"foo"`. The empty pointer `"#"` resolves to the document root, so a document whose root *is* a binding unit can be addressed without a name. (The core spec makes this a SHOULD for new JSON formats; see [`openbindings.md` §6.3](../openbindings.md#63-bindings).)
- **The enclosing document's shape is the author's concern.** Units may be embedded in a dedicated file, alongside units of other formats, or at an `x-`-prefixed location inside an unrelated host document.

[`openbindings.operation-graph`](operation-graph/openbindings.operation-graph.md) follows this pattern: the spec defines a graph definition (its `nodes`, `edges`, validation rules, and required version field); the enclosing JSON document has no prescribed shape. A conventional `graphs` map at the root is documented for ergonomics but is non-normative.
