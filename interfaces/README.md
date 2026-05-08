# Interfaces

This directory contains **unbound OpenBindings interfaces** published by the OpenBindings project.

- These interfaces are **non-normative**: they are not required by the core spec.
- They provide **shared contracts** that tools can rely on for interoperability.
- Each interface is a regular OpenBindings document and can be referenced, imported, or bound like any other interface.
- As **unbound interfaces**, they define the contract without specifying bindings. Implementations import these and add their own bindings to make them actionable.

## Interfaces

Each interface lives in its own directory with versioned files following the spec's guidance that published interfaces SHOULD use versioned URLs (major.minor as the version segment, since patch versions should not change the contract).

- `openbindings.software-descriptor/0.1.json` — base software descriptor contract. Defines the canonical `getInfo` operation and `SoftwareInfo` schema for self-identifying software in the OpenBindings ecosystem.
- `openbindings.binding-invoker/0.1.json` — binding invoker contract. Defines `listFormats` and `invokeBinding` for components that invoke bindings in specific formats (OpenAPI, AsyncAPI, gRPC, MCP, etc.).
- `openbindings.interface-creator/0.1.json` — interface creator contract. Defines `listFormats` and `createInterface` for components that produce OBIs from existing binding artifacts.
- `openbindings.source-inspector/0.1.json` — source inspector contract. Defines `listFormats` and `inspectSource` for components that inspect binding artifacts and return bindable targets before an OBI is created.
- `openbindings.context-store/0.1.json` — context store contract. Defines CRUD operations for managing stored credentials and runtime context, keyed by normalized API origin.
- `openbindings.http-client/0.1.json` — HTTP client contract. Defines a `request` operation for making HTTP requests on behalf of callers that cannot make direct requests due to platform constraints (browser CSP/CORS, network restrictions, etc.).

## Authoring conventions

These conventions apply to the role interfaces published in this directory and are recommended (but not required) for any third party authoring role interfaces.

### Output schemas SHOULD be open

Schemas used as operation **outputs** (or nested inside output schemas) SHOULD NOT use `additionalProperties: false`. Role interfaces describe **minimum** requirements: implementations MUST provide at least the listed fields, but they MAY return additional fields beyond those described. Open output schemas allow role interfaces to evolve additively in future versions without breaking strict-compatibility consumers.

Schemas used as operation **inputs** MAY use `additionalProperties: false` when the role wants to forbid unknown caller arguments (the typical RPC-style case). Strict input validation catches typos in caller code without affecting evolution: adding a field to an input schema in a future version is symmetric to a CALLER change, which is acceptable.

Some roles that mirror externally-defined schemas (e.g., OIDC) may use strict field sets where the upstream contract requires them.

### Schemas are intentionally self-contained per role

Each role interface in this directory is a self-contained document. Schemas are defined locally in each file rather than referenced across files via `$ref`, even when sibling roles use the same shape (e.g., `FormatInfo` appears in both `openbindings.binding-invoker/0.1.json` and `openbindings.interface-creator/0.1.json`).

The OpenBindings spec does not normatively define cross-document `$ref` resolution between role interface files. Self-containment means a tool can read and validate any one role file without resolving external references.

Shared-named schemas across role files SHOULD be byte-identical and should be kept in sync manually when changes are made. Drift across roles is a quality concern for the OpenBindings project, not a runtime concern for consumers (each role is checked independently against an implementation).
