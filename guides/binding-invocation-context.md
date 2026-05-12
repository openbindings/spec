# Binding Invocation Context

**Status**: Implementation guidance. Not part of the normative specification.

This document describes how OpenBindings SDKs should manage binding
invocation context — the runtime data that invokers need to invoke
bindings. It covers what context is, how it's stored, how it flows,
and how it gets resolved when insufficient.

This is not normative — the core spec (`openbindings.md`) does not
reference or depend on it. Different SDK implementations may vary in
their API surface, but SHOULD follow the conceptual patterns described
here for consistency across the ecosystem.

---

## What context is

When an invoker invokes a binding, it often needs more than just the
operation input. It may need credentials, session state, consent flags,
custom headers, cookies, environment variables, metadata, or other
runtime data specific to the service it's talking to. All of this
runtime data is **binding invocation context**.

Context is **invoker-managed**. The invoker decides what context it
needs, resolves it when insufficient, and stores it for future use. The
SDK provides storage infrastructure and platform callbacks, but never
inspects or interprets context. To the SDK, context is an opaque object
keyed by an invoker-determined identifier.

Credentials are one kind of context — the kind most invokers need first
— but context is the umbrella. Headers, cookies, environment variables,
session state, consent flags, custom invoker fields: all context.
Implementations MAY store any of these alongside credentials in the same
opaque payload.

### Stored vs per-call context

Context divides along **lifecycle**, not along type:

| | Stored context | Per-call context |
|---|---|---|
| **Lifecycle** | Persistent across calls | Single invocation |
| **Origin** | Resolved by the invoker (auth flows, manual configuration) | Supplied by the caller at invocation time |
| **Held by** | The context store | The caller's `invokeBinding` arguments |

Both have the same opaque shape — a context object with well-known
fields (`bearerToken`, `apiKey`, `basic`, plus headers/cookies/etc.).
At invocation time the binding invoker merges them: stored context for
the target is loaded, then per-call context is layered on top with
caller-supplied values taking precedence.

There is no separate "invocation options" concept. Headers and cookies
that need to persist across calls live in the stored context; headers
and cookies that apply to a single call are supplied per-call. The
shape is the same in both cases.

### The context store

The SDK maintains a **context store** — a key-value map where keys are
invoker-determined strings and values are opaque context payloads
(satisfying the `openbindings.context-store` role, with operations
`getContext`/`setContext`/`deleteContext`).

The invoker controls the key. Typically, an invoker normalizes to the
API's domain (e.g., both `https://api.example.com` and
`wss://api.example.com` resolve to `api.example.com`). This enables
**cross-invoker context sharing**: an OpenAPI invoker and an AsyncAPI
invoker hitting the same API independently derive the same key, so
credentials and other context obtained through one invoker's flow are
available to the other without duplicate prompts.

Storage backend is SDK-configurable: in-memory (session-scoped) or
persistent (on-disk, OS keychain, hosted vault). An implementation MAY
expose richer management capabilities (listing, inspection, rotation,
audit) outside the role contract — those are implementation-defined
surfaces. The role contract itself is just `get` / `set` / `delete`.

---

## Well-known context fields

Context is an opaque object — invokers can store whatever structure
they need. But for cross-invoker interoperability, invokers SHOULD use
well-known field names:

| Field | Type | Purpose |
|---|---|---|
| `bearerToken` | `string` | Bearer token (OAuth2, JWT, etc.) |
| `apiKey` | `string` | API key |
| `basic` | `{ username, password }` | HTTP Basic credentials |
| `accessToken` / `refreshToken` / `expiresAt` | `string` | OAuth lifecycle |
| `headers` | `{ [k]: string }` | HTTP headers (request-level) |
| `cookies` | `{ [k]: string }` | HTTP cookies (request-level) |
| `environment` | `{ [k]: string }` | Environment variables (for exec-style invokers) |
| `metadata` | `{ [k]: any }` | Invoker-specific metadata (e.g., gRPC metadata) |

These are top-level fields in the context object. An invoker can store
anything else alongside them — CSRF tokens, session IDs, consent flags,
invoker-specific state. The well-known fields are a convention, not a
schema. No validation, no enforcement.

This convention is extensible. If a new protocol or auth mechanism
emerges that requires a new field, invokers adopt a new well-known
field name. No spec change needed. The convention grows through
ecosystem usage, the same way HTTP headers do.

An invoker that doesn't need cross-invoker sharing can ignore the
convention entirely and use whatever internal structure it wants.

---

## How context flows

The SDK orchestrates context around binding invocation:

```
1. SDK resolves which binding to invoke for the operation.

2. SDK calls invokeBinding with the operation input, any per-call context
   supplied by the caller, and the context store reference.

3. Binding invoker derives the context key using normalizeContextKey(source.location)
   and looks up stored context from the store. If found, it merges stored
   context with per-call context (per-call values take precedence).

4. Binding invoker applies merged context where the protocol expects each
   field (auth fields → auth headers; the headers field → HTTP headers; etc.).

5. Binding invoker returns the result.
   If the invoker resolved or refreshed context during invocation,
   it stores the update via the store reference.
```

The key convention: binding invokers derive context keys using `normalizeContextKey`,
which strips a URL to its `host[:port]` — removing scheme, path, query, and
fragment. This standardized derivation means any invoker targeting the same
API will produce the same key — no explicit "ask the invoker" step is needed.

When context is insufficient and the binding invoker
can't proceed, the resolution pattern (described below) takes over.

---

## The context gap

An OpenBindings Interface (OBI) separates **what a service does**
(operations) from **how you access it** (bindings). Bindings reference
source documents — an OpenAPI spec, an AsyncAPI spec, etc. — that
describe protocol-level details. A **binding invoker** is a component
that reads a particular source format and knows how to invoke bindings
against it. A binding invoker is often an SDK library, but could also
be a service, a CLI tool, or anything else that implements the binding
invoker interface. The OpenAPI invoker reads OpenAPI specs and makes
HTTP calls, the AsyncAPI invoker reads AsyncAPI specs and manages
WebSocket connections, and so on.

A developer points their code at an interface, picks a binding invoker, and
invokes operations. They never write HTTP client code, never parse
OpenAPI specs, never wire up protocol details.

But many services require **context** before they're usable —
authentication credentials, API keys, client certificates, user consent,
configuration. Today, the developer has to know what context each service
needs and manually build the mechanisms to obtain it — writing OAuth2
flows, prompting for API keys, handling token refresh, accepting terms of
service.

This re-couples the developer to the service. OpenBindings freed them
from "how to call the endpoint," but now they're coupled to "how to
satisfy the endpoint's prerequisites." The abstraction leaks at the
context layer.

Authentication is by far the most common case, but it's not the only
one. The problem is general: **insufficient context** — any situation
where a binding invoker can't proceed because something it needs wasn't
provided. Auth examples dominate because that's what developers hit
most, but the pattern is context-general.

### What we want

A developer writes this:

```typescript
const dispatcher = new OperationInvoker([new OpenAPIInvoker()]);
const client = new InterfaceClient(null, dispatcher, {
  contextStore: new MemoryStore(),
  platformCallbacks: browserCallbacks(),
});

await client.resolve("https://api.example.com");
for await (const event of client.invoke("listUsers", { page: 1 })) {
  // handle event.data
}
```

And everything works — even if the service requires OAuth2, an API key,
a client certificate, or terms-of-service consent. The developer never
knows what context the service needs or how to obtain it. They just say
"I'm running in a browser" and the system handles the rest.

### Why this isn't a spec concern

Context requirements are **binding-layer concerns**. The binding invoker is the
component that interacts with the service, and it's the component that
discovers what context is missing — whether from declared metadata in the
binding spec (e.g., OpenAPI security schemes) or from runtime signals
(e.g., a 401 response). Either way, the invoker knows what's needed and
how to obtain it.

The core spec explicitly scopes this out: "Pagination patterns, error
handling conventions, and authentication mechanisms are application-level
concerns outside the scope of this specification."

Context resolution lives entirely below the OBI layer. The OBI document
shape, binding resolution, and compatibility rules are not involved.
This is purely about how **binding invokers and SDKs interact at runtime**.

---

## Context resolution

### Core insight

The **binding invoker** is the only layer that knows what context is missing and
how to obtain it. It reads the binding spec — security schemes, required
configuration, service metadata — and understands the resolution protocol.
For auth, that might mean knowing the token endpoint and required scopes.
For other context, it might mean knowing what configuration values are
needed or what consent is required.

What the binding invoker might lack is **platform capability** — the ability to
open a browser, prompt a user, or pick a file. These are things only the
runtime environment can do.

The pattern is dependency injection: the SDK gives the invoker platform
callbacks at initialization. The invoker uses them when it encounters
insufficient context. Nothing above the invoker needs to know what's
missing or why.

### Layer responsibilities

```
Invoker     Knows what's wrong (from the binding spec).
            Knows how to fix it (the resolution protocol).
            May need platform interaction to complete the fix.
                ↕
SDK         Injects platform callbacks into binding invokers.
            Stores and provides context across calls.
            Does not interpret what's missing or why.
                ↕
Developer   Supplies platform callbacks. Never touches context resolution.
```

| Layer     | Knows                                                     | Doesn't know                          |
| --------- | --------------------------------------------------------- | ------------------------------------- |
| Invoker   | What context is missing, how to resolve it                | What platform it's running on         |
| SDK       | How to store/retrieve context, how to inject callbacks    | What context is missing or why        |
| Developer | What platform they're deploying to                        | What context any service requires     |

### Resolution flows

**Happy path (context already stored):**

1. SDK calls `invokeBinding` with the store reference.
2. Binding invoker derives key via `normalizeContextKey`, looks up stored context → found.
3. Binding invoker merges with developer context and invokes → success.

**Binding invoker self-resolves (e.g., token refresh):**

1. SDK calls `invokeBinding` with stored context.
2. Binding invoker makes the call. Gets 401. Existing context has a refresh
   token.
3. Invoker silently refreshes — it knows the token endpoint from the
   binding spec. Retries. Succeeds.
4. Invoker stores updated context via the SDK's store callback.
5. Invoker returns the operation result.

From the SDK's perspective, the call just took a little longer. From the
developer's perspective, nothing happened.

**Binding invoker needs platform help (e.g., OAuth2 first-time):**

1. SDK calls `invokeBinding` with empty context.
2. Binding invoker makes the call. Gets 401. No stored credentials. Invoker
   reads the OpenAPI security scheme — OAuth2 authorization code flow.
3. Invoker calls the injected `browserRedirect` callback: "open this
   URL and give me the callback."
4. Callback opens a browser. User authorizes. Callback captures the
   redirect URL with the authorization code.
5. Invoker receives the code. Exchanges it for tokens (it knows the
   token endpoint from the binding spec).
6. Invoker stores the new context via the SDK's store callback.
7. Invoker retries the original call with the new token. Succeeds.
8. Invoker returns the operation result.

Future calls for any operation against this service find stored context
and skip straight to the happy path.

**No resolution possible:**

1. SDK calls `invokeBinding` with empty context.
2. Binding invoker makes the call. Gets 401. No way to resolve — no callbacks
   provided (headless environment), or unknown auth mechanism.
3. Invoker returns an error. The error is clear: "context insufficient,
   interactive resolution not available."

The developer can pre-configure context via the store for headless
environments where interactive resolution isn't possible.

---

## Platform callbacks

Platform callbacks are **functions** injected into each binding invoker at
initialization. Each callback handles one kind of user interaction. The
invoker calls the callback when it needs platform help; it doesn't know
or care how the callback is implemented.

| Callback           | What it does                              | Example use cases                      |
| ------------------ | ----------------------------------------- | -------------------------------------- |
| `browserRedirect`  | Opens a URL, captures a redirect callback | OAuth2, SAML, any browser-based auth   |
| `prompt`           | Displays a message, collects user input   | API key entry, password, custom tokens |
| `confirmation`     | Displays a message, waits for yes/no      | Terms of service, consent screens      |
| `fileSelect`       | Lets the user pick a file                 | Client certificates, key files         |

This set is intentionally small and generic. It describes **what a
platform can do for a user**, not context-specific actions. New callbacks
can be added as the ecosystem encounters new patterns. Not all callbacks
need to be provided — if an invoker calls one that wasn't supplied, it
surfaces through the normal error path (the "no resolution possible"
flow).

SDKs SHOULD ship pre-built callback bundles for common platforms as a
convenience. For example, `browserCallbacks()` returns implementations
that use popups and modal dialogs, `cliCallbacks()` uses the system
browser and stdin. A developer can also provide individual callbacks
directly — there's no required grouping.

---

## Context types

The same resolution pattern handles every kind of insufficient context a
binding invoker might encounter. The invoker knows the specifics; the SDK and
developer don't.

| Context need     | Invoker detects                       | Resolution                        |
| ---------------- | ------------------------------------- | --------------------------------- |
| OAuth2           | Missing/expired bearer token          | Browser redirect → token exchange |
| API key          | No API key in context                 | Prompt user to enter key          |
| mTLS             | Missing client certificate            | File selection                    |
| Terms of service | Service requires consent              | Confirmation dialog               |
| Token refresh    | Expired but refreshable               | Silent refresh (no interaction)   |
| MFA              | Second factor required after password | Prompt for code                   |
| Configuration    | Missing required service config       | Prompt for values                 |

This list is not exhaustive. Any new context requirement follows the same
flow: invoker detects, invoker resolves (possibly with platform help),
invoker stores the result via the SDK.

---

## Implementation guidance

### For SDK implementers

1. **Implement the context store.** A key-value map honoring the
   `openbindings.context-store` role (`getContext` / `setContext` /
   `deleteContext`). Keys are strings (invoker-determined). Values are
   opaque context payloads. Support in-memory (session-scoped) and
   optionally persistent (on-disk, OS keychain) storage. Let the
   developer configure which. Management surfaces (listing, inspection,
   rotation) are implementation-specific affordances outside the role
   contract.
2. **Define platform callbacks** in your language. This is the contract
   between the SDK and binding invokers. Keep it small — the callback kinds
   above, plus a store callback for persisting context.
3. **Inject store and callbacks at invoker initialization.** When the
   SDK creates or loads a binding invoker, pass the store interface and platform
   callbacks. The invoker holds references and uses them as needed.
4. **Ship pre-built callback bundles** for common platforms. At minimum:
   browser and CLI. These should be zero-configuration — the developer
   picks one and plugs it in, or supplies their own callbacks.
5. **Handle the headless case.** If no callbacks are provided and the
   invoker needs interaction, the invoker returns a clear error.
   Support pre-configured context via the store as the alternative.
6. **Don't inspect context.** The SDK stores and retrieves context but
   never reads its contents. Context structure is the invoker's concern.

### For binding invoker implementers

1. **Read your binding spec.** Your binding spec (OpenAPI, AsyncAPI, etc.)
   describes context requirements — security schemes, configuration,
   prerequisites. Use it.
2. **Choose a stable context key.** Normalize across protocols so
   cross-invoker sharing works. A domain like `api.example.com` is
   better than `https://api.example.com` — it works for HTTP, WebSocket,
   gRPC, etc.
3. **Use well-known credential fields.** If you store a bearer token,
   call it `bearerToken`. If you store an API key, call it `apiKey`.
   This enables other invokers for the same service to find and use
   shared credentials.
4. **Check context first.** Before making a call, check if the stored
   context has what's needed. If so, use it.
5. **Handle failures gracefully.** If a call fails due to insufficient
   context, check if you can self-resolve (e.g., token refresh). If not,
   use the injected platform callbacks to request interaction.
6. **Store updated context.** After resolving context, use the store
   callback so future calls skip the resolution flow.
7. **Don't assume a specific platform.** Your invoker calls callbacks
   generically ("I need a browser redirect"). Whether that opens a popup,
   a system browser, or fails in a headless environment is the callback's
   concern, not yours.

---

## SDK implementer considerations

1. **Context lifetime**: how long does stored context live? Configurable by
   the developer (session vs persistent). Binding invokers MAY include expiry hints
   in the context object. The SDK SHOULD support explicit clearing for
   security.
2. **Sequential interactions**: can a binding invoker require multiple interactions
   in sequence (e.g., OAuth2 then MFA)? Yes — the invoker completes one
   interaction, attempts the call, and if still insufficient, requests
   another. Serial, not batched.
3. **Cross-invoker context sharing**: two binding invokers for the same service
   share a context key by independently normalizing to the same identifier.
   The well-known credential fields enable interoperability. This should be
   validated across real invoker pairs.
4. **Concurrent context resolution**: if two concurrent calls both detect
   insufficient context, both might try to resolve. SDKs should implement
   deduplication (e.g., a mutex or single-flight pattern around resolution).
