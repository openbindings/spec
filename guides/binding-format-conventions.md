# Binding Format Conventions

**Status**: Non-normative reference. Not part of the core specification.

The OpenBindings spec is binding-specification-agnostic. It defines the structure of an OBI document (operations, sources, bindings, refs) but intentionally does not define what a ref looks like, how credentials are applied, or how input maps to protocol-specific requests for any particular format. Those details are format-specific conventions defined by each binding executor and interface creator.

This document catalogs the conventions used by the known binding format implementations. Its purpose is to prevent fragmentation by making the official conventions visible. Implementers building new executors for these formats should follow these conventions for interoperability. Implementers building executors for new formats should use this as a reference for the kind of decisions they need to make and document.

Each format's conventions are documented in full in that library's README. This document provides a summary for cross-format comparison.

### Format tokens: exact vs range

OBI sources declare **exact** format versions (e.g., `openapi@3.1`). These are precise identifiers that describe a specific binding artifact. Executors declare **format ranges** (e.g., `openapi@^3.0.0`) that describe the set of source versions they can handle. The SDK's format matching logic checks whether an OBI source's exact token falls within an executor's declared range. See the `Formats` section of `openbindings.md` for the normative rules.

---

## OpenAPI

**Executor format range**: `openapi@^3.0.0` (handles any OpenAPI 3.x source)

**Ref format**: JSON Pointer into the OpenAPI document.

```
#/paths/~1users/get
#/paths/~1users~1{id}/put
```

Path separators escaped per RFC 6901 (`/` -> `~1`, `~` -> `~0`). Method is lowercase.

**Source**: `location` is a URL or file path to the OpenAPI JSON/YAML document. `content` is an inline document.

**Credentials**: Driven by the spec's `securitySchemes`. The executor reads the OpenAPI security configuration to determine where credentials go (header, query, cookie). Falls back to bearer, then basic, then apiKey when no schemes are defined.

**Security metadata**: Extracted from `securitySchemes` and populated in the OBI's `security` section during interface creation.

**Libraries**: [openapi-go](https://github.com/openbindings/openapi-go), [@openbindings/openapi](https://github.com/openbindings/openbindings-ts)

---

## AsyncAPI

**Executor format range**: `asyncapi@^3.0.0` (handles any AsyncAPI 3.x source)

**Ref format**: JSON Pointer to the operation.

```
#/operations/sendMessage
#/operations/orderUpdates
```

**Source**: `location` is a URL or file path to the AsyncAPI JSON/YAML document. `content` is an inline document.

**Credentials**: Driven by the spec's `securitySchemes`, same mapping as OpenAPI. For WebSocket connections, bearer tokens are sent in the first message body (browsers cannot set WebSocket upgrade headers). Query-param apiKeys are appended to the WebSocket URL.

**Protocol dispatch**: The executor determines the transport from the server protocol and operation action:

| Protocol | Receive | Send |
|----------|---------|------|
| HTTP/HTTPS | SSE streaming | POST (unary) |
| WS/WSS | WebSocket streaming | WebSocket streaming |

**Security metadata**: Extracted from `securitySchemes`, same as OpenAPI.

**Libraries**: [asyncapi-go](https://github.com/openbindings/asyncapi-go), [@openbindings/asyncapi](https://github.com/openbindings/openbindings-ts)

---

## gRPC

**Executor format range**: `grpc` (versionless)

**Ref format**: Fully qualified service name + method name.

```
mypackage.UserService/GetUser
blend.CoffeeShop/GetMenu
```

**Source**: `location` is the server address (`host:port`). TLS is auto-detected for port 443 or `https://` prefixes. `content` is not used; services are discovered via server reflection.

**Credentials**: Applied as gRPC metadata: `authorization: Bearer <token>`, `authorization: ApiKey <key>`, or `authorization: Basic <encoded>`.

**Streaming**: Server-streaming RPCs produce multiple stream events. Client-streaming RPCs are skipped during interface creation.

**Security metadata**: gRPC/protobuf does not expose security metadata. Auth retry handles unauthenticated errors at runtime.

**Connect compatibility**: [Connect](https://connectrpc.com) servers expose the gRPC protocol alongside the Connect protocol by default. The gRPC executor can discover and execute against them via gRPC. The resulting OBI reflects the gRPC access path, not the Connect protocol. Connect-native access (HTTP/1.1, JSON payloads) uses the dedicated `connect` format — see [Connect (Buf)](#connect-buf) below.

**Libraries**: [grpc-go](https://github.com/openbindings/grpc-go)

---

## Connect (Buf)

**Executor format range**: `connect` (versionless)

**Ref format**: Same as gRPC: `{package.Service}/{Method}`. Both formats share protobuf service definitions.

**Source**: `location` is the Connect server base URL. The executor constructs `{location}/{service}/{method}` for each RPC. `content` accepts inline protobuf definitions for proto-aware marshaling.

**Protocol**: HTTP POST with `Content-Type: application/json` and `Connect-Protocol-Version: 1`. Works over HTTP/1.1 (no HTTP/2 required).

**Credentials**: Applied as HTTP headers: bearer, apiKey, basic. Same chain as other HTTP-based executors.

**Relationship to gRPC**: Connect and gRPC are separate wire protocols that share protobuf service definitions. The same `.proto` file can produce both `format: "grpc"` and `format: "connect"` bindings. A service that speaks both protocols would have two sources in its OBI.

**Libraries**: [connect-go](https://github.com/openbindings/connect-go)

---

## MCP

**Executor format range**: `mcp@2025-11-25` (exact, date-versioned)

**Ref format**: Entity type + name.

```
tools/get_weather
resources/file:///data.csv
resources/users/{id}
prompts/summarize
```

Three entity types: `tools`, `resources`, `prompts`. Resources use the URI as the identifier. Resource templates use the URI template.

**Source**: `location` is the MCP server endpoint URL. `content` is not used; capabilities are discovered via session initialization.

**Credentials**: Applied as HTTP headers: `Authorization: Bearer <token>` or `Authorization: ApiKey <key>`.

**Entity semantics**: Tools map to traditional API operations. Resources are read-only data access (URI stored as a `const` input property). Prompts return LLM message sequences. Each execution creates a fresh MCP session.

**Security metadata**: MCP does not expose security metadata. Auth retry handles 401 at runtime.

**Libraries**: [mcp-go](https://github.com/openbindings/mcp-go), [@openbindings/mcp](https://github.com/openbindings/openbindings-ts)

---

## GraphQL

**Executor format range**: `graphql` (versionless)

**Ref format**: Root type + field name.

```
Query/users
Mutation/createUser
Subscription/onOrderUpdated
```

Root types are PascalCase (`Query`, `Mutation`, `Subscription`), matching the canonical GraphQL type names.

**Source**: `location` is the GraphQL HTTP endpoint URL. `content` accepts an inline introspection JSON result, bypassing the network introspection call.

**Query construction**: GraphQL requires a full query string with a selection set. The executor checks the operation's input schema for a `_query` property with a `const` value. If present, that query is sent directly with the caller's input as variables. If absent, the executor falls back to building a query from introspection with an auto-generated selection set (depth-limited to 3 levels, cycle-safe).

The interface creator generates the `_query` const at OBI creation time from the introspected schema, so any generated OBI will have precise queries. The introspection fallback is for direct executor use without an OBI.

**Credentials**: Applied as HTTP headers: bearer, then apiKey, then basic auth. No spec-driven security (GraphQL introspection does not expose security metadata).

**Subscriptions**: Executed over WebSocket using the `graphql-transport-ws` sub-protocol. Events stream to the channel until completion or cancellation.

**Libraries**: [graphql-go](https://github.com/openbindings/graphql-go), [@openbindings/graphql](https://github.com/openbindings/openbindings-ts)

---

## Usage (CLI)

**Executor format range**: `usage@^2.0.0` (handles any Usage 2.x source)

**Ref format**: Space-separated command path.

```
config set
deploy
db migrate run
```

Mirrors the command-line invocation (without the binary name).

**Source**: `location` is the path to the usage-spec KDL file. Also supports `exec:<binary>` to extract the spec from the binary at runtime. `content` is inline KDL content.

**Credentials**: Local CLI execution, not network services. Configuration passed via `ExecutionOptions.Environment` as environment variables.

**Execution**: The executor builds CLI arguments from the input (flags by name, positional args by order), runs the binary via `os/exec`, and returns stdout as a single stream event with exit code as status.

**Security metadata**: Not applicable (local execution).

**Libraries**: [usage-go](https://github.com/openbindings/usage-go)

---

## Streaming patterns and the OBI execution model (non-normative)

The OBI execution model in v0.1 is "one input value, one stream of output events." This shape is a natural fit for unary RPCs (a stream of one event), server-streaming RPCs (a stream of many events), server-sent events, and subscription patterns where the client provides parameters once and then receives many results.

It is **not** a natural fit for protocol patterns where the caller needs to send multiple inputs over the lifetime of a single operation invocation. The following patterns are therefore out of scope for v0.1, and binding format libraries SHOULD skip them at interface creation time:

- **Client-streaming RPCs** (e.g., gRPC and Connect: client sends a stream of messages, server sends one response)
- **Bidirectional streaming RPCs** (both sides send streams of messages)
- **WebSocket flows where the client sends multiple messages over a single connection** beyond the initial input

`grpc-go` and `connect-go` skip client-streaming and bidirectional methods during interface creation. `asyncapi-go` handles WebSocket subscriptions as "send one input message, receive a stream of events" and does not currently support post-init client sends.

These limits are **structural** to the v0.1 OBI model, not bugs in any individual library. A future version of the spec may extend the execution model to accept a stream of inputs as well as produce a stream of outputs; until then, services that rely on these patterns should expose alternative bindings (e.g., a server-streaming or unary equivalent) for OBI consumers.

### Streaming patterns that ARE supported

- **Unary** (request/response): a stream of exactly one event.
- **Server-streaming** (one request, many responses): the executor emits each response as a separate stream event.
- **Server-Sent Events (SSE)**: the executor parses the `text/event-stream` body line by line and emits each event as a stream event.
- **Subscription with single input**: the caller provides parameters once; the executor opens a long-lived connection (e.g., WebSocket, AsyncAPI subscription, GraphQL subscription, MCP resource subscription) and forwards each server-pushed message as a stream event.
- **Progress notifications during a long-running call**: when the underlying protocol surfaces intermediate progress events during a single RPC (e.g., MCP `notifications/progress`), the executor MAY surface them as intermediate stream events, with the final result as the last event.

---

## Conventions for new formats

If you're building an executor for a new binding format, you should define and document:

1. **Format token**: Name and versioning strategy (versionless, caret range, or exact).
2. **Ref format**: How the ref identifies the operation within the source artifact. Should be unambiguous and parseable.
3. **Source expectations**: What `location` and `content` mean for this format.
4. **Credential application**: How context fields (bearerToken, apiKey, basic) map to the protocol's authentication mechanism.
5. **Security metadata**: Whether the format exposes security configuration that can be extracted during interface creation.
6. **Input conventions**: Any format-specific input schema properties (like GraphQL's `_query` const).
7. **Streaming behavior**: Which operations produce multiple stream events vs. a single event.

Document these in your library's README and consider submitting a PR to add them to this catalog.
