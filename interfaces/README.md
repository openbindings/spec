# Interfaces

This directory contains **unbound OpenBindings interfaces** published by the OpenBindings project.

- These interfaces are **non-normative**: they are not required by the core spec.
- They provide **shared contracts** that tools can rely on for interoperability.
- Each interface is a regular OpenBindings document and can be referenced, imported, or bound like any other interface.
- As **unbound interfaces**, they define the contract without specifying bindings. Implementations import these and add their own bindings to make them actionable.

## Interfaces

Each interface lives in its own directory, with one file per version. The major.minor segment of the filename is the interface's **own contract version** (its `version` field), which is independent of the `openbindings` spec version the file targets: a brand-new contract starts at `0.1.json` even though it is written against spec 0.2.0, while a previously-published contract that takes a breaking change advances to `0.2.json`. A published version file is immutable: breaking changes ship as a new version file beside the old one, never as an edit to a released file.

Interface **names** carry no `openbindings.` prefix: an interface's identity is its file location, and its `name` is a label, not an identifier. Operation **keys** are fully qualified as `openbindings.<interface>.<operation>` (for example `openbindings.binding-invoker.invokeBinding`); the rationale is in Authoring conventions.

- `software-descriptor/0.2.json` — base software descriptor contract. Defines the canonical `getInfo` operation and `SoftwareInfo` schema for self-identifying software. Generic capability.
- `binding-invoker/0.1.json` — binding invoker contract. Defines `listFormats`, `invokeBinding`, and the `prepareBinding` preflight for components that invoke bindings in specific formats (OpenAPI, AsyncAPI, gRPC, MCP, etc.). `invokeBinding` is a typed bidirectional I/O operation: the caller streams `BindingInvokerInputFrame` messages in (`open`, `input`*, `close`) and the service streams `BindingInvokerOutputFrame` messages back (`output`/`input_closed`* terminated by `complete` or `error`). The frame protocol covers unary, server-streaming, client-streaming, and bidirectional bindings under one shape. (A new contract for spec 0.2.0, so its own version starts at 0.1.0; it supersedes the unrelated-by-shape `openbindings.binding-executor` 0.1.0.)
- `interface-creator/0.2.json` — interface creator contract. Defines `listFormats` and `createInterface` for components that produce OBIs from existing binding artifacts.
- `source-inspector/0.1.json` — source inspector contract. Defines `listFormats` and `inspectSource` for components that inspect binding artifacts and return bindable targets before an OBI is created. (New for spec 0.2.0; first contract version 0.1.0.)
- `kv-store/0.1.json` — generic key-value store (`get`/`set`/`delete` over an opaque key and opaque value). Generic capability; the runtime uses one to hold binding context, but the store knows nothing about context. (Replaces the spec-0.1.0 `context-store`, which baked the context meaning into the store.)

### Prior versions (preserved)

The contracts published against spec **0.1.0** are kept unchanged so existing consumers keep resolving (these declare `"openbindings": "0.1.0"`). Using them is not recommended for new work; they are retained only so prior consumers do not break.

These keep their original `openbindings.`-prefixed directory paths, which were their published identity and are immutable.

- `openbindings.binding-executor/0.1.json` — the spec-0.1.0 binding invoker, superseded by `binding-invoker` (a new, differently-shaped contract for spec 0.2.0).
- `openbindings.host/0.1.json` — the spec-0.1.0 host contract, withdrawn for spec 0.2.0 (its concerns moved into binding-invoker and the kv-store-backed context loop).
- `openbindings.context-store/0.1.json` — the spec-0.1.0 context store, replaced by the generic `kv-store` (which no longer bakes the context meaning into the store).
- `openbindings.http-client/0.1.json` — the spec-0.1.0 HTTP client, withdrawn for spec 0.2.0 (a generic HTTP capability with no consumer; the SDK's injectable `fetch` covers the browser case).
- `openbindings.interface-creator/0.1.json`, `openbindings.software-descriptor/0.1.json` — the spec-0.1.0 shapes, superseded by the `0.2.json` files above (these two kept their names, so their contract version advanced 0.1.0 → 0.2.0).

## How these interfaces relate

They compose rather than overlap:

- **source-inspector** and **interface-creator** sit at authoring time: an inspector reports the bindable targets in a raw artifact, and a creator turns an artifact into an OBI.
- **binding-invoker** is the runtime workhorse that invokes an operation's binding. When a binding needs something the caller has not supplied (credentials, a session, configuration), the invoker raises a `CONTEXT_REQUIRED` challenge reporting its target; the runtime resolves it, persists durable results in a store (a **kv-store**), and retries. Authentication lives entirely in this loop, never in the OBI document. The store is generic; the context meaning lives in this contract.
- **software-descriptor** is a universal add-on any of the above MAY also implement, so tooling can ask "what is this?" uniformly.

A service signals that it satisfies one of these interfaces by giving the corresponding operation the contract operation's **key** as one of its own operation's identifiers — its key, or an `alias` alongside a different local key (see the spec's Operations section). Those keys are fully qualified (next section), so a single document can satisfy several of these interfaces at once without the adopted names colliding — a service that lists formats for binding invocation, interface creation, and source inspection carries all three of `openbindings.binding-invoker.listFormats`, `openbindings.interface-creator.listFormats`, and `openbindings.source-inspector.listFormats` on its one local operation. The name is author-asserted; the spec attaches no verification or trust semantics to it.

## Authoring conventions

These conventions apply to the interfaces published in this directory and are recommended (but not required) for any third party publishing shared interfaces.

### Operation keys are qualified `openbindings.<interface>.<operation>`

Every operation key in these interfaces is `openbindings.` followed by the interface name and the operation's short name: `openbindings.binding-invoker.invokeBinding`, `openbindings.kv-store.get`, `openbindings.software-descriptor.getInfo`, and so on. The short name alone (`invokeBinding`, `get`) is used in prose for readability, but the qualified form is the operation's actual key and the name a satisfying document adopts.

The keys carry the `openbindings.` project prefix deliberately, and it does two things. **Uniqueness:** interface-qualification alone (`binding-invoker.listFormats`) prevents collisions *within* a single document — a bare `listFormats` would collide across the three interfaces that define it — but it does not distinguish this project's `kv-store` from another publisher's identically-named one, since a bare `kv-store.get` from two authors is the same string. The project prefix makes the key globally unique, so `openbindings.kv-store.get` never coincides with anyone else's. **Provenance:** an operation key travels apart from its document — adopted into another service's operation identifiers, written to a log, indexed by a registry — and once it has moved, the document's source URL no longer accompanies it. The prefix carries *who minted this contract, and where to find it* inline with the name, which a co-located URL cannot once the string has left home. This is the reverse-DNS bargain (Java packages, MIME `vnd.`): one convention buys uniqueness, attribution, and a discovery pointer, and it privileges no one — every publisher qualifies under its own token, so a third party would write `acme.kv-store.get`. The prefix is still author-asserted; the spec attaches no trust semantics to it. The interface **name** carries no prefix because identity is the file location and the name is only a label. The spec advises contract authors to choose operation names with a high likelihood of global uniqueness but prescribes no scheme; project-qualification is how this project meets that advice, and third parties may meet it however they like.

Schemas used as operation **outputs** (or nested inside output schemas) SHOULD NOT use `additionalProperties: false`. Published interfaces describe **minimum** requirements: implementations MUST provide at least the listed fields, but they MAY return additional fields beyond those described. Open output schemas allow these interfaces to evolve additively in future versions without breaking strict-compatibility consumers.

Schemas used as operation **inputs** MAY use `additionalProperties: false` when the interface wants to forbid unknown caller arguments (the typical RPC-style case). Strict input validation catches typos in caller code without affecting evolution: adding a field to an input schema in a future version is symmetric to a CALLER change, which is acceptable.

Some interfaces that mirror externally-defined schemas (e.g., OIDC) may use strict field sets where the upstream contract requires them. A closed **wire-protocol enum** is also exempt: when an output schema is a fixed set of frame variants rather than an evolving data shape (as in `binding-invoker`'s `BindingInvokerOutputFrame`), `additionalProperties: false` on each variant is correct — an unknown frame property is a protocol violation, not a forward-compatible addition.

### Schemas are intentionally self-contained per interface

Each interface in this directory is a self-contained document. Schemas are defined locally in each file rather than referenced across files via `$ref`, even when sibling interfaces use the same shape (e.g., `FormatInfo` appears in both `binding-invoker/0.1.json` and `interface-creator/0.2.json`).

The OpenBindings spec does not normatively define cross-document `$ref` resolution between these interface files. Self-containment means a tool can read and validate any one interface file without resolving external references.

Shared-named schemas across interface files SHOULD be byte-identical and should be kept in sync manually when changes are made. Drift across interfaces is a quality concern for the OpenBindings project, not a runtime concern for consumers (each interface is checked independently against an implementation).
