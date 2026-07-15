# `workers-rpc` binding conventions

**Status: pre-promotion draft — mints no identifier.** Seed material for the future `openbindings.workers-rpc` binding specification: no `openbindings.workers-rpc@<rev>` identifier exists until this page is restructured to the [authoring template](../README.md#authoring-a-new-binding-specification) and meets the completeness floor of [OBI-B-02](../../openbindings.md#104-binding-specification-rules). Until promotion it remains a non-normative conventions record, not part of the core specification, and its citations may still reference pre-rewrite core numbering and retired rules; both are corrected at promotion. This document records how the OpenBindings project binds Cloudflare Workers RPC — the answers to the [format authoring checklist](../README.md#authoring-a-new-binding-specification), as implemented by the reference packages (TS `@openbindings/workers-rpc` is the runtime; the Go SDK ships a recognition stub, since Go cannot run inside the Workers runtime — the stub lets `ob synthesize`/`validate`/`diff`/`codegen` handle the token while invocation errors with a pointer to the TS package). A third-party implementation MAY diverge anywhere no core-spec rule binds.

The format binds calls from one Cloudflare Worker to a sibling Worker exposing a `WorkerEntrypoint` class over a service binding: the transport is `env[binding][method](args)` with structured-clone serialization handled by the Cloudflare runtime — no HTTP, no JSON round-trip, no URL at runtime.

Tier tags: **[format-spec]** — pinned by Cloudflare's Workers RPC semantics; **[convention]** — the OB convention of record as the reference packages implement it; **[open]** — deliberately unanswered.

## Format token

`workers-rpc@^1.0.0`, declared verbatim by sources (the caret is part of the token: 1.0 denotes the stable `WorkerEntrypoint` GA contract, and the source pins compatibility with that line rather than an artifact version). **[convention]**

## `ref` syntax

The literal method name on the target `WorkerEntrypoint` class (`getUser`). No path encoding, no HTTP method. A ref is required; a name that resolves to no function on the binding is a not-found invocation error. **[convention]**

## Source expectations

**There is no artifact**: the contract is the TypeScript class itself, so OBIs for this format are hand-authored (operations and bindings written directly) and there is nothing to synthesize or inspect. **[convention]** `location` is symbolic — `workers-rpc://<service-name>` by convention — never fetched and never dispatched to; the actual target is supplied out of band at invoker construction (`new WorkersRpcInvoker({ binding: env.MY_SERVICE })`, constructed per-request because Workers `env` is request-scoped). `content` is unused. **[convention]**

## Input conventions

One input message, passed as the method's single argument via structured clone — values pass through unserialized (Dates, Maps, and other structured-clonables survive; no JSON coercion). A clean close with no message is a zero-argument call. No field routing. **[format-spec/convention]**

## Invocation shape

Unary only — one output per call. Workers RPC's async-iterable streaming is not yet bound. **[convention]**

## Wire answers (routing / decode / classify)

The runtime answers everything; the consumer-hook seam is not consulted and no provenance stamps are emitted. **[convention]**

- **Decode**: the method's return value, verbatim (structured clone). **[format-spec]**
- **Classify**: a thrown error propagating across the binding boundary is a terminal invocation error (name and message survive the clone; custom error subclasses flatten — services wanting structured failure shapes return discriminated unions instead). **[format-spec/convention]**

Implementation note a third party must copy: dispatch via plain property access (`binding[method](…)`), never `Function.prototype.call` — Cloudflare's service stub is a Proxy whose methods capture the stub in a closure, and `.call` forces the runtime to attempt serializing the non-serializable stub.

## Authentication and context

None at this layer: the Cloudflare runtime is the trust boundary — only Workers that declare the service binding in their configuration can reach the target. No credentials apply and no `CONTEXT_REQUIRED` challenge exists. **[format-spec/convention]**

## Open points

- Async-iterable (streaming) RPC methods.
- Cancellation (service bindings expose no abort plumbing; only pre-dispatch aborts are honored).
- Synthesis from TypeScript types (today the OBI is hand-authored; codegen consumes it, nothing produces it).
