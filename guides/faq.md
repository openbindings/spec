# Frequently Asked Questions

## What is OpenBindings?

OpenBindings is an open standard for describing what a service does (its operations and schemas) separately from how you access it. A single OpenBindings Interface (OBI) can reference bindings in any binding specification: OpenAPI, AsyncAPI, MCP, gRPC, or formats the spec has never heard of.

## Does this replace OpenAPI, gRPC, AsyncAPI, or MCP?

No. OpenBindings sits above binding specifications, not in place of them. Your OpenAPI document, AsyncAPI spec, gRPC protobuf, or MCP server stays exactly as it is. The OBI references those artifacts and provides a shared contract layer on top.

OpenAPI describes **how** to access a service over HTTP. gRPC describes how to call it over HTTP/2 with protobuf. MCP describes how AI agents interact with tools. OpenBindings describes **what** the service does, its operations and schemas, independently of all of them.

## When should I use OpenBindings?

If your service only speaks REST and always will, OpenAPI alone is probably sufficient. OpenBindings becomes valuable when:

- Your service is accessible through **multiple protocols** and you want one contract that connects them
- You want **transport-agnostic clients** that work with operations, not protocol details. Executors handle the transport at runtime
- You want to **delegate across boundaries**: declare that your service satisfies a shared interface (a role), and any client targeting that role works with your service. The delegate pattern, across networks, protocols, and organizations.
- You want **deterministic compatibility checking** between interface versions or across implementations

If none of these apply, use OpenAPI directly. You can always add an OBI later; it wraps your existing specs, it doesn't replace them.

## How does this relate to MCP?

MCP (Model Context Protocol) defines how AI models interact with tools. An OBI can reference an MCP server as a binding source alongside REST, gRPC, or any other binding specification. This means a service can be accessible to both traditional API clients and AI agents through the same operational contract.

## What does "binding-specification-agnostic" mean?

The OpenBindings spec doesn't know what OpenAPI, gRPC, or any other format is. It doesn't prescribe which protocols or formats you use. Binding formats are community-driven. Anyone can create a format token and a corresponding executor without modifying the spec or core tooling.

## What's the difference between an operation and a binding?

An **operation** is a named unit of capability: something a service can do, with input/output schemas. Operations are the contract. A **binding** maps that operation to a specific entry point in a specific binding specification artifact (via a source and a ref). One operation can have many bindings across different protocols.

## What are roles?

A role is a published interface that your service can declare it satisfies. For example, if your service plays the `openbindings.context-store` role, clients know it supports `getContext`, `setContext`, `listContexts`, and `deleteContext` with specific schemas. Tooling can verify conformance automatically.

Roles enable composable interfaces, like traits in Rust or protocols in Swift. Your service declares which roles it plays, individual operations use `satisfies` to map to the role's operations, and clients can check conformance at runtime or build time.

## What does compatibility checking do?

OpenBindings defines deterministic, tool-independent rules for comparing two interfaces. If interface A is compatible with interface B, a client built against B can trust A's schema shapes. This is evaluated by comparing operations and schemas, not bindings. It enables automated CI validation, safe interface evolution, and confidence when swapping implementations.

Compatibility checking evaluates whether schema claims are compatible. It does not guarantee runtime interoperability. An OBI is a claim about what software does, and claims can be incorrect or incomplete.

## What are binding executors?

A binding executor knows how to execute bindings in a specific format. Given a source (format + location), a ref within that source, and operation input, it makes the protocol-specific call and returns a stream of events. The OpenAPI executor reads your OpenAPI spec to understand endpoints and security schemes. A gRPC executor reads your proto definitions. You can build your own for any format.

Executors are pluggable. The developer chooses which formats to support at construction time. No unnecessary dependencies.

## Is OpenBindings production-ready?

The specification is at v0.1.0, the first public release. The core concepts are stable. We welcome feedback and contributions as the ecosystem matures.

## How can I contribute?

OpenBindings is developed in the open on GitHub. See the [discussions page](https://github.com/openbindings/spec/discussions) for ways to get involved, or jump straight to the [contributing guide](https://github.com/openbindings/spec/blob/main/CONTRIBUTING.md).
