# Interfaces

This directory contains **unbound OpenBindings interfaces** published by the OpenBindings project.

- These interfaces are **non-normative**: they are not required by the core spec.
- They provide **shared contracts** that tools can rely on for interoperability.
- Each interface is a regular OpenBindings document and can be referenced, imported, or bound like any other interface.
- As **unbound interfaces**, they define the contract without specifying bindings. Implementations import these and add their own bindings to make them actionable.

## Interfaces

Each interface lives in its own directory with versioned files following the spec's guidance that published interfaces SHOULD use versioned URLs (major.minor as the version segment, since patch versions should not change the contract).

- `openbindings.software-descriptor/0.1.json` — base software descriptor contract. Defines the canonical `getInfo` operation and `SoftwareInfo` schema for self-identifying software in the OpenBindings ecosystem.
- `openbindings.binding-invoker/0.1.json` — binding invoker contract. Defines `listFormats` and `invokeBinding` for components that invoke bindings in specific formats (OpenAPI, AsyncAPI, gRPC, MCP, etc.). `invokeBinding` is a typed bidirectional I/O operation: the caller streams `BindingInvokerInputFrame` messages in (`open`, `input`*, `close`) and the service streams `BindingInvokerOutputFrame` messages back (`output`/`input_closed`* terminated by `complete` or `error`). The frame protocol covers unary, server-streaming, client-streaming, and bidirectional bindings under one shape.
- `openbindings.interface-creator/0.1.json` — interface creator contract. Defines `listFormats` and `createInterface` for components that produce OBIs from existing binding artifacts.
- `openbindings.source-inspector/0.1.json` — source inspector contract. Defines `listFormats` and `inspectSource` for components that inspect binding artifacts and return bindable targets before an OBI is created.
- `openbindings.context-store/0.1.json` — context store contract. Defines `getContext`, `setContext`, and `deleteContext` for storing and retrieving opaque per-target context (credentials, session state, custom headers, configuration, etc.) keyed by stable identifier (typically a normalized API origin). Implementations MAY expose richer management capabilities (listing, inspection, rotation) beyond the contract itself.
- `openbindings.http-client/0.1.json` — HTTP client contract. Defines a `request` operation for making HTTP requests on behalf of callers that cannot make direct requests due to platform constraints (browser CSP/CORS, network restrictions, etc.).

## How these interfaces relate

They compose rather than overlap:

- **source-inspector** and **interface-creator** sit at authoring time: an inspector reports the bindable targets in a raw artifact, and a creator turns an artifact into an OBI.
- **binding-invoker** is the runtime workhorse that invokes an operation's binding. When a binding needs something the caller has not supplied (credentials, a session, configuration), the invoker raises a `CONTEXT_REQUIRED` challenge, which the runtime resolves into the **context-store** and then retries. Authentication lives entirely in this loop, never in the OBI document.
- **http-client** is an escape hatch for callers that cannot make direct requests (browser CSP/CORS, sandboxed environments).
- **software-descriptor** is a universal add-on any of the above MAY also implement, so tooling can ask "what is this?" uniformly.

A service signals that it satisfies one of these interfaces by giving the corresponding operation the interface's operation name as an `alias` (see the spec's Operations section). The alias is author-asserted; the spec attaches no verification or trust semantics to it.

## Authoring conventions

These conventions apply to the interfaces published in this directory and are recommended (but not required) for any third party publishing shared interfaces.

### Output schemas SHOULD be open

Schemas used as operation **outputs** (or nested inside output schemas) SHOULD NOT use `additionalProperties: false`. Published interfaces describe **minimum** requirements: implementations MUST provide at least the listed fields, but they MAY return additional fields beyond those described. Open output schemas allow these interfaces to evolve additively in future versions without breaking strict-compatibility consumers.

Schemas used as operation **inputs** MAY use `additionalProperties: false` when the interface wants to forbid unknown caller arguments (the typical RPC-style case). Strict input validation catches typos in caller code without affecting evolution: adding a field to an input schema in a future version is symmetric to a CALLER change, which is acceptable.

Some interfaces that mirror externally-defined schemas (e.g., OIDC) may use strict field sets where the upstream contract requires them.

### Schemas are intentionally self-contained per interface

Each interface in this directory is a self-contained document. Schemas are defined locally in each file rather than referenced across files via `$ref`, even when sibling interfaces use the same shape (e.g., `FormatInfo` appears in both `openbindings.binding-invoker/0.1.json` and `openbindings.interface-creator/0.1.json`).

The OpenBindings spec does not normatively define cross-document `$ref` resolution between these interface files. Self-containment means a tool can read and validate any one interface file without resolving external references.

Shared-named schemas across interface files SHOULD be byte-identical and should be kept in sync manually when changes are made. Drift across interfaces is a quality concern for the OpenBindings project, not a runtime concern for consumers (each interface is checked independently against an implementation).
