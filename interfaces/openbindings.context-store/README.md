# Context Store

The context store holds opaque per-target runtime data keyed by stable identifiers. Binding invokers read context before invocation and write it back when new context is resolved (typically after a successful auth flow).

## What lives in context

Context is whatever a binding invoker needs to call a target on the user's behalf. Common shapes:

- **Credentials**: `bearerToken`, `apiKey`, `basic.username`/`basic.password`, OAuth `accessToken`/`refreshToken`/`expiresAt`.
- **Transport additions**: `headers`, `cookies`, `environment`, `metadata` (arbitrary per-invoker fields).
- **Session and consent state**: anything an invoker accumulates between calls that should persist across processes.

Credentials are one kind of context, not the whole concept. Implementations and callers MAY add fields for any invoker-managed runtime data. The store treats the payload as opaque.

## Key conventions

The key is typically a normalized API origin (`https://api.example.com`), so that all calls to the same target share context. Callers SHOULD normalize before reading or writing (lowercase host, default port stripped, no trailing slash) and SHOULD pick a single normalization function and stick with it.

## What the role does NOT prescribe

This role is the minimum surface a runtime needs at invocation time. It deliberately omits richer management capability:

- **Listing keys** is not part of the role. An implementation MAY expose a separate listing operation under its own contract.
- **Inspection and rotation** are not part of the role. Implementations that want a credential manager UI should expose those as additional operations beyond this contract.
- **Auditing** is not part of the role.

The intent is that any binding invoker can read and write context using just `getContext` / `setContext` / `deleteContext`; richer surfaces remain implementation-defined.

## Concurrency

`getContext` is idempotent. `setContext` fully replaces existing context for the key (it is not a partial merge). `deleteContext` is a no-op when the key does not exist (returns success). Concurrent access is the store implementation's concern; the contract does not specify whether reads observe a consistent snapshot across keys.
