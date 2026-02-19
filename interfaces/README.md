# Interfaces

This directory contains **unbound OpenBindings interfaces** published by the OpenBindings project.

- These interfaces are **non-normative**: they are not required by the core spec.
- They provide **shared contracts** that tools can rely on for interoperability.
- Each interface is a regular OpenBindings document and can be referenced, imported, or bound like any other interface.
- As **unbound interfaces**, they define the contract without specifying bindings. Implementations import these and add their own bindings to make them actionable.

## Interfaces

- `openbindings.software.json` — the base software contract. Defines the canonical `getInfo` operation and `SoftwareInfo` schema for self-identifying software in the OpenBindings ecosystem.
- `openbindings.binding-format-handler.json` — the binding format handler interface. An unbound interface that defines the contract for binding format handler delegates (tools that interpret binding formats). Imports `openbindings.software.json` and satisfies its `getInfo` operation. Implementations import this and add their own bindings.
- `openbindings.binding-context-provider.json` — the binding context provider interface. An unbound interface that defines the contract for delegates that produce runtime context (credentials, headers, environment, etc.) needed to execute a binding. Imports `openbindings.software.json` and satisfies its `getInfo` operation. The orchestrator calls `getContext` before `executeOperation` and passes the returned context to the format handler.
