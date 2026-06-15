# Key-Value Store

A generic key-value store: `get`, `set`, and `delete` opaque values by opaque key.

This interface deliberately knows nothing about *what* it stores or *how keys are formed*. The key is an opaque string and the value is an opaque blob; the interface prescribes neither a key-derivation scheme nor a value schema. That is the whole point — it is the minimum surface that lets independent stores be interchangeable.

## Operations

- `openbindings.kv-store.get` — retrieve the value for a key; returns `null` if there is no entry.
- `openbindings.kv-store.set` — store a value for a key, replacing any existing value in full.
- `openbindings.kv-store.delete` — remove the entry for a key; idempotent (deleting a missing key succeeds).

## Where the meaning lives

A key-value store is generic infrastructure, not an OpenBindings concept. The OpenBindings runtime happens to use one to hold the context a binding invoker needs (credentials, session state, and the like): when a binding raises a `CONTEXT_REQUIRED` challenge, the runtime resolves it and persists durable results in a store like this one.

Everything domain-specific about that — what a context value contains (the `bearerToken`/`apiKey`/… field conventions), and how a storage key is derived from a target (e.g. normalizing to `host[:port]` so formats sharing a host share context) — belongs to the [`binding-invoker`](../binding-invoker/) contract and the runtime that resolves its challenges, **not** to this store. This store only sees an opaque key and an opaque value.

## Not prescribed

Listing keys, inspection, rotation, auditing, TTL/expiry, and scoping are all outside this contract. An implementation that wants a richer credential-manager surface exposes those as its own additional operations; a binding invoker's runtime needs only `get`/`set`/`delete`.
