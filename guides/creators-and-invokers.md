# Creators and Invokers

**Status**: Implementation guidance. Not part of the normative specification.

This document describes the capabilities that enable the OpenBindings ecosystem to work with binding formats: **binding invokers**, **interface creators**, and **source inspectors**. These are distinct but complementary -- they share domain knowledge about a binding format but serve different purposes.

## Capabilities

### Binding invoker

A binding invoker knows how to invoke bindings in a specific format. Given a source (format + location/content), a ref within that source, and operation input, it makes the protocol-specific call and returns a stream of events.

This is the core capability that makes OpenBindings protocol-agnostic. The developer calls a typed operation. The SDK finds the binding. The invoker handles the protocol. The developer never writes protocol-specific code.

**Role interface:** `openbindings.binding-invoker`

| Operation | Input | Output |
|-----------|-------|--------|
| `listFormats` | -- | `FormatInfo[]` |
| `invokeBinding` | `BindingInvocationInput` | stream of `StreamEvent` |

`invokeBinding` always returns a stream of events. Unary calls produce a stream of one event. Streaming calls (WebSocket subscriptions, SSE, gRPC streams) produce many events until the connection closes. There is no separate "subscribe" operation -- invocation IS streaming.

### Interface creator

An interface creator knows how to produce an OBI from a binding artifact. Given an OpenAPI spec, it extracts operations, schemas, sources, bindings, and security into an OpenBindings interface document.

This is what powers `ob create`, `InterfaceClient.resolve()` synthesis, and any tool that needs to bootstrap OBI adoption from existing specs.

**Role interface:** `openbindings.interface-creator`

| Operation | Input | Output |
|-----------|-------|--------|
| `listFormats` | -- | `FormatInfo[]` |
| `createInterface` | `CreateInput` | OBI document |

Interface creators SHOULD populate the OBI's `security` section when the binding format provides security metadata. See [Security population](#security-population) below.

### Source inspector

A source inspector knows how to inspect a binding artifact before an OBI is created. Given a source, it returns bindable targets that tooling can offer to users, optionally including a suggested operation key and operation framing for each target.

This powers tooling that helps users select which operations to include when authoring an OBI without relying on non-normative ref naming conventions. It is a separate role rather than an optional interface-creator operation: a service or library may create interfaces, inspect sources, invoke bindings, or provide any combination of those capabilities.

**Role interface:** `openbindings.source-inspector`

| Operation | Input | Output |
|-----------|-------|--------|
| `listFormats` | -- | `FormatInfo[]` |
| `inspectSource` | `InspectSourceInput` | `SourceInspection` |

### Shared `listFormats`

These roles declare `listFormats` independently. This is intentional -- a binding invoker, interface creator, and source inspector may support different sets of formats.

When an implementation satisfies both roles:

- **Same formats for both** (common case): one `listFormats` operation with `satisfies` declarations pointing to both roles. Zero friction.
- **Different formats**: two operation keys (e.g., `listInvocationFormats`, `listCreationFormats`), each satisfying the respective role via `satisfies`. Tools use the `satisfies` declarations as structured correspondence input for their own matching logic.

## Why they're separate

A binding invoker that can't create interfaces is still useful -- it invokes operations against services. That's the primary use case for most applications.

An interface creator that can't invoke bindings is also useful -- it's a build tool that produces OBIs from existing specs, used in CI/CD or during `ob create`.

Separating them means:
- A lightweight invoker doesn't need interface creation dependencies
- A build-time-only creator doesn't need runtime invocation capabilities
- Consumers check for exactly the capabilities they need, not a monolithic contract

## Why they may be packaged together

Implementations may package both capabilities in a single library or service. The reason: **domain overlap**.

An OpenAPI invoker needs to:
- Parse and cache OpenAPI documents
- Understand path templates, parameter classification, security schemes
- Resolve refs within the spec

An OpenAPI interface creator needs to:
- Parse and cache OpenAPI documents
- Understand path templates, parameter classification, security schemes
- Extract operations, schemas, and security from the spec

The domain knowledge is the same. The code that understands an OpenAPI spec is useful for both invocation and creation. Packaging them separately would mean duplicating the OpenAPI parsing and understanding, or extracting a shared base library that both depend on.

A single package that implements both `BindingInvoker` and `InterfaceCreator` avoids duplicating this domain knowledge. The roles are separate at the interface level; the implementation may share code.

## Two deployment models

Both capabilities can be deployed as a library (in-process code module) or as a service (standalone process with an OBI). The contract is identical -- only the deployment differs.

### Library

A library is a code module that implements `BindingInvoker` and/or `InterfaceCreator` directly. It runs in-process.

```go
// Go
type BindingInvoker interface {
    Formats() []FormatInfo
    InvokeBinding(ctx context.Context, input *BindingInvocationInput) (<-chan StreamEvent, error)
}

type InterfaceCreator interface {
    Formats() []FormatInfo
    CreateInterface(ctx context.Context, input *CreateInput) (*Interface, error)
}
```

```typescript
// TypeScript
interface BindingInvoker {
    formats(): FormatInfo[];
    invokeBinding(input: BindingInvocationInput, options?: { signal?: AbortSignal }): AsyncIterable<StreamEvent>;
}

interface InterfaceCreator {
    formats(): FormatInfo[];
    createInterface(input: CreateInput, options?: { signal?: AbortSignal }): Promise<OBInterface>;
}
```

The library interfaces map directly to the role interfaces. `Formats()` returns `FormatInfo` (token + description), matching the `FormatInfo` schema in the role interface.

**Advantages:**
- Fast -- no network overhead.
- Simple -- import and use.
- Type-safe -- the compiler checks the interface implementation.

**Limitations:**
- Language-specific -- a Go implementation can't be used from TypeScript.
- Bundled -- the implementation's dependencies become the application's dependencies.

**Existing implementations:**

| Package | Language | Format range | Invoker | Creator |
|---------|----------|---------------|--------|---------|
| `openapi-go` | Go | `openapi@^3.0.0` | Yes | Yes |
| `asyncapi-go` | Go | `asyncapi@^3.0.0` | Yes | Yes |
| `grpc-go` | Go | `grpc` | Yes | Yes |
| `connect-go` | Go | `connect` | Yes | Yes |
| `mcp-go` | Go | `mcp@2025-11-25` | Yes | Yes |
| `graphql-go` | Go | `graphql` | Yes | Yes |
| `usage-go` | Go | `usage@^2.0.0` | Yes | Yes |
| `@openbindings/openapi` | TypeScript | `openapi@^3.0.0` | Yes | Yes |
| `@openbindings/asyncapi` | TypeScript | `asyncapi@^3.0.0` | Yes | Yes |
| `@openbindings/mcp` | TypeScript | `mcp@2025-11-25` | Yes | Yes |
| `@openbindings/graphql` | TypeScript | `graphql` | Yes | Yes |

### Service

A service is a standalone process that exposes the `binding-invoker` and/or `interface-creator` roles via its own OBI. Clients connect to it like any other OpenBindings service.

**How it works:**
- The service runs as a process (CLI tool, HTTP server, etc.).
- It publishes an OBI that declares the roles it satisfies.
- Clients discover it, connect, and call operations.
- The service handles the protocol-specific work internally.

**Scaffold with `ob conform`:**
```bash
ob conform binding-invoker.json my-service.obi.json --yes
ob conform interface-creator.json my-service.obi.json --yes  # optional
```

**Advantages:**
- Language-agnostic -- any language can implement the service, any client can connect.
- Isolated -- the implementation's dependencies don't affect the client.
- Discoverable -- clients find services via standard OBI discovery.
- Composable -- a host can delegate to multiple services for different formats.

**Limitations:**
- Network overhead -- every binding invocation is a remote call.
- Deployment complexity -- the service must be running and reachable.

### Delta between library and service

| Concern | Library | Service |
|---------|---------|---------|
| `listFormats` | `Formats() -> []FormatInfo` | `listFormats` operation -> `FormatInfo[]` |
| `invokeBinding` | `InvokeBinding(ctx, input) -> <-chan StreamEvent` | `invokeBinding` operation -> stream of events |
| `createInterface` | `CreateInterface(ctx, input) -> *Interface` | `createInterface` operation -> `OpenBindingsInterface` |
| Identity | Not applicable -- code dependency | Optional via `software-descriptor` role |
| Transport | In-process function calls | Network via OBI bindings |
| Discovery | Import statement | `/.well-known/openbindings` |

The contract is the same. A library can be wrapped as a service (serve its operations over the network). A service can be wrapped as a library (a thin client that implements `BindingInvoker` by calling the service).

## How the operation invoker uses them

The operation invoker maintains a registry keyed by format token. When an operation is invoked:

1. The operation invoker reads the OBI's bindings to find which source handles the operation.
2. The source declares a format token (e.g., `openapi@3.1`).
3. The operation invoker looks up a registered binding invoker for that format.
4. If the binding has a `security` reference, the operation invoker resolves the security methods from the OBI's `security` section and includes them in the binding invocation input.
5. The binding invoker invokes the binding and returns a stream of events.

```
Operation invocation request
        |
        v
Operation Invoker
        |  finds binding -> source format = "openapi@3.1"
        |  resolves security methods from OBI (if declared)
        |  looks up binding invoker for "openapi@3.1"
        v
OpenAPI Binding Invoker
        |  reads OpenAPI spec, resolves ref
        |  applies credentials from context
        |  makes protocol-specific call
        |  on auth error: resolves security via callbacks, retries once
        |  returns stream of events
        v
Stream of StreamEvent
```

For service implementations, the operation invoker delegates via a proxy that implements `BindingInvoker` locally and calls the service's `invokeBinding` operation over the network.

Format tokens are community-driven -- there is no central registry. Well-known formats use short names (`openapi`, `asyncapi`, `grpc`). Custom formats use reverse-DNS naming (e.g., `com.example.gateway@1.0`). Anyone can create a format token and an implementation that handles it.

## Binding invoker lifecycle

When a binding invoker receives a `BindingInvocationInput`, it follows this lifecycle:

1. **Document loading** -- loads and caches the binding spec from the source's location or content.
2. **Credential resolution** -- reads stored context from the `ContextStore`, merges with per-call context. Per-call context takes precedence over stored context. The binding invoker MUST NOT mutate the caller's input when merging.
3. **Credential application** -- applies credentials to the protocol (HTTP headers, gRPC metadata, etc.) according to the binding spec's security configuration.
4. **Invocation** -- interprets the ref within the binding spec, maps input to protocol parameters, makes the call, streams events back.
5. **Security resolution** -- if the call fails with an auth error and security methods + platform callbacks are available, resolves credentials interactively and retries once. See [Security resolution](#security-resolution) below.

### Standard error codes

Binding invokers SHOULD use standard error codes to enable protocol-agnostic error handling by the operation invoker and application code. The following codes are defined by the OpenBindings SDKs:

| Code | Meaning | Retryable? |
|------|---------|------------|
| `auth_required` | Authentication needed (HTTP 401, gRPC Unauthenticated) | Yes, with credentials |
| `permission_denied` | Authenticated but not authorized (HTTP 403) | Not with same credentials |
| `invalid_ref` | Ref is malformed or can't be parsed | No |
| `ref_not_found` | Ref is syntactically valid but doesn't resolve in the source | No |
| `invalid_input` | Input doesn't match expected schema | No |
| `source_load_failed` | Couldn't load or parse the binding source | No |
| `source_config_error` | Source loaded but missing required config (no server URL, etc.) | No |
| `connect_failed` | Couldn't establish connection to the service | Maybe (transient) |
| `invocation_failed` | Call was made but the service returned an error | Depends |
| `response_error` | Got a response but couldn't process it | No |
| `stream_error` | Error during streaming after initial connection | Depends |
| `timeout` | Operation timed out | Maybe (transient) |
| `cancelled` | Operation was cancelled by the caller | No |
| `binding_not_found` | Requested binding is not defined on the interface | No |
| `transform_error` | Transform evaluation failed | No |

These codes are SDK conventions, not spec requirements. Third-party binding invokers MAY use different codes. SDKs that consume error codes SHOULD handle unknown codes gracefully.

## Security resolution

Security resolution is how binding invokers interactively acquire credentials when a binding invocation fails due to authentication. This is an SDK-level convenience pattern, not a spec requirement. Binding invokers that don't implement security resolution are still valid -- they return auth errors to the caller, and the application handles credentials manually.

### How it works

The `BindingInvocationInput` carries two fields that enable security resolution:

- `security` -- an array of `SecurityMethod` objects (from the OBI's `security` section, passed through by the operation invoker). These describe what authentication methods are available, in preference order.
- `callbacks` -- platform callbacks (`prompt`, `browserRedirect`, `confirmation`, `fileSelect`) that the binding invoker can use to interact with the user.

When a binding invocation fails with `auth_required`:

1. The binding invoker checks if `security` methods and `callbacks` are available.
2. It walks the security methods in preference order.
3. For each method, it checks if the required callback is available.
4. It invokes the appropriate flow to acquire credentials.
5. It stores the credentials in the `ContextStore` (if available).
6. It retries the invocation once with the new credentials.

If the retry also fails, the error is returned to the caller. There is no retry loop.

### Security method resolution

Each well-known security method type maps to a callback:

| Method type | Callback | Flow |
|------------|----------|------|
| `bearer` | `prompt` | Prompt for a token. Store as `bearerToken` in context. |
| `oauth2` | `browserRedirect` | Drive PKCE flow: construct authorization URL, redirect, exchange code for token. Store as `bearerToken`. |
| `basic` | `prompt` | Prompt for username, then password. Store as `basic.username` and `basic.password` in context. |
| `apiKey` | `prompt` | Prompt for a key. Store as `apiKey` in context. |

If a method requires a callback that isn't available, it is skipped. If no method can be resolved, the auth error is returned to the caller.

SDKs provide a shared `ResolveSecurity` helper that implements this algorithm. Binding invokers call it on auth error rather than implementing the walk-and-resolve logic themselves.

```go
// Go SDK
func ResolveSecurity(ctx context.Context, methods []SecurityMethod,
    callbacks *PlatformCallbacks, httpClient *http.Client) (map[string]any, error)
```

```typescript
// TypeScript SDK
async function resolveSecurity(methods: SecurityMethod[],
    callbacks: PlatformCallbacks,
    fetchFn?: typeof globalThis.fetch): Promise<Record<string, unknown> | null>
```

The helper is a utility function. It can be called at any time -- on auth error, proactively before invocation, from a CLI login command, or from any application code that needs to resolve credentials for a set of security methods.

### When security methods are not provided

If the `BindingInvocationInput` has no `security` methods (because the OBI doesn't declare security for this binding, or because the binding invoker is used directly without an operation invoker), the binding invoker MAY fall back to a default resolution strategy:

- Prompt for a bearer token (the most common credential type across protocols).
- Skip security resolution entirely and return the auth error.

This fallback is an SDK implementation choice, not a spec requirement.

## Security population

Interface creators extract security information from binding format artifacts and populate the OBI's `security` section. This happens at OBI creation time -- the same moment operations, schemas, and bindings are extracted.

### Format-specific security extraction

Each binding format has its own security metadata:

| Format | Security metadata source | Mapping |
|--------|-------------------------|---------|
| OpenAPI 3.x | `securitySchemes` in `components` | `http/bearer` -> `bearer`, `oauth2` -> `oauth2` (with URLs), `http/basic` -> `basic`, `apiKey` -> `apiKey` (with name/in) |
| AsyncAPI 3.x | `securitySchemes` in `components` | Same mapping as OpenAPI |
| gRPC | No security metadata in protobuf | No security section; invoker auth retry handles 401 |
| MCP | No security metadata in MCP session | No security section; invoker auth retry handles 401 |
| Usage spec | Local CLI invocation, no network auth | No security section |

Interface creators SHOULD produce per-binding security references when the format supports per-operation security requirements (e.g., OpenAPI's operation-level `security` field). Bindings for public endpoints (no security requirement) SHOULD NOT have a `security` reference.

## What a binding invoker must NOT do

- **Understand operations** -- it doesn't know what `getMenu` means. It invokes a binding ref within a source.
- **Select bindings** -- that's the operation invoker's job. The binding invoker invokes what it's given.
- **Manage application state** -- the invoker does not accumulate state that affects the semantics of subsequent calls. Transport-level state (document caches, connection pools, session caches) is acceptable as internal optimization, but the caller should get the same result whether the invoker reuses a connection or opens a fresh one. Application-level state (credentials, preferences) lives in the `ContextStore`.
- **Handle transforms** -- input/output transforms are applied by the operation invoker, not the binding invoker.
- **Mutate the caller's input** -- credential merging and enrichment MUST operate on a copy.

## Why `InvokeBinding` returns a stream, not a value

The binding invoker interface returns a stream (`<-chan StreamEvent` in Go, `AsyncIterable<StreamEvent>` in TypeScript) rather than a single value. This was a deliberate design choice that was stress-tested extensively.

### The question

When the SDK was designed, a central question was whether operations should be modeled as request-response (one input, one output) or as streams (one input, zero or more outputs). The concern: REST APIs are request-response, but WebSocket subscriptions and SSE produce ongoing events. Should the interface support both, and if so, how?

### Alternatives considered

**1. Separate unary and streaming interfaces.** An `InvokeBinding` for request-response and `SubscribeBinding` for streams. Rejected because it forces the caller to know which pattern an operation uses before calling it. That's protocol knowledge leaking through the abstraction. A developer switching a binding from OpenAPI to gRPC shouldn't have to change their calling code.

**2. Bidirectional stream object.** An `OperationStream` with `Send()` for follow-up messages and `Events()` for output. This was prototyped extensively. Rejected because it solves a problem that belongs to the format library, not the SDK interface. AsyncAPI models bidirectional communication as two separate operations (send and receive) on one channel. The format library manages the shared connection internally. Multi-send at the SDK level was unnecessary complexity.

**3. Single-value return for unary, stream for streaming.** Different return types depending on the operation. Rejected because it creates two code paths and the caller must know which to use.

### Why the stream model works

The stream return handles every protocol pattern with one interface:

- **Unary request-response** (REST, gRPC unary): stream yields one event, closes.
- **Server-streaming** (SSE, gRPC server-stream): stream yields many events until done.
- **WebSocket receive** (subscription): stream yields events until cancelled.
- **Fire-and-forget** (WebSocket send with no reply): stream closes immediately (zero events).

The caller always writes the same code: iterate the stream. For unary, the loop runs once. For streaming, it runs until done. No mode switching.

### What about bidirectional?

An early design considered decomposing subscriptions into separate operations: a `subscribe` operation (client initiates) and a `receiveEvent` operation (server sends one event), where each incoming event would be a separate operation invocation. This would have made every interaction a single request-response pair.

This was informed by studying AsyncAPI 3.x, which went through its own design evolution. AsyncAPI v2 had `publish` and `subscribe` operations that caused persistent confusion about who was sending and who was receiving. AsyncAPI v3 replaced these with a simple `action` field: `send` (this application sends to the channel) or `receive` (this application receives from the channel).

AsyncAPI's model is declarative: an operation with `action: receive` declares that the application participates in a channel in the receive direction. The spec defines which message shapes are valid but does not prescribe how an SDK should map this to an imperative interface. However, the natural mapping is clear: a `receive` operation opens the channel and messages flow as an ongoing stream. This aligns with how SSE, WebSocket subscriptions, and gRPC server-streaming all work at the protocol level.

The SDK adopts this mapping:
- `sendMessage` (action: send): client sends to the channel. One `InvokeBinding` call per message.
- `receiveMessages` (action: receive): client receives from the channel. One `InvokeBinding` call, ongoing stream of events.

The client calls `InvokeBinding` for each. The format library pools the WebSocket connection internally so both operations share the same transport. Each call to `InvokeBinding` is one operation with its own input and output stream.

This means the SDK doesn't need a bidirectional stream primitive. Bidirectional communication is two unidirectional operations on a shared connection, managed by the format library.

### Known limitations

**gRPC client-streaming and bidirectional streaming RPCs** cannot be represented in the current model. The `InvokeBinding` interface accepts a single input, which maps to gRPC unary and server-streaming RPCs but not to methods where the client sends a stream of inputs. Interface creators skip these method types during OBI creation. If a future binding format requires streaming input, the interface may need to accept a channel or iterator as input. This is a known gap, not a design flaw -- the current model covers the vast majority of real-world API patterns.

### Connection pooling is a format library concern

Different protocols handle connection reuse differently:
- **HTTP**: `http.Client` pools TCP connections automatically
- **gRPC**: `ClientConn` cache multiplexes RPCs on one HTTP/2 connection
- **MCP**: Session pool shares one JSON-RPC session across tool calls
- **AsyncAPI WebSocket**: Connection pool shares one WebSocket for send operations; dedicated connections for receive operations

This is protocol-specific knowledge that belongs in the format library. The SDK interface stays clean: `InvokeBinding(input) -> stream`. The format library decides whether to open a new connection or reuse one based on the protocol semantics.

## Key principles

1. **Binding invokers and interface creators are the boundary where protocol knowledge lives.** The SDK below and the application above are agnostic.
2. **Format tokens are the routing key.** The operation invoker matches bindings to binding invokers by format.
3. **Credentials flow through the context store.** Binding invokers read and apply; they don't own credential lifecycle.
4. **Security methods flow through the OBI.** Interface creators extract them from binding formats. The operation invoker passes them to binding invokers. Binding invokers use them for interactive credential resolution.
5. **Everything is a stream.** `InvokeBinding` returns a stream of events. Unary is a stream of one.
6. **Format support is community-driven.** Anyone can create a format token and an implementation. No gating.
7. **Security method types are community-driven.** Like format tokens, anyone can define new security method types. SDKs handle well-known types and skip unknown ones.
8. **Library and service implementations satisfy the same roles.** Same contract, different deployment. The consumer doesn't know which kind it's talking to.
9. **Security resolution is an SDK convenience, not a spec requirement.** Binding invokers that implement it provide better DX. Binding invokers that don't are still valid.
