<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="icon-dark.svg">
    <img alt="OpenBindings" src="icon.svg" width="80">
  </picture>
</p>

<h1 align="center">OpenBindings</h1>

<p align="center">
  One interface · limitless bindings. An open standard for describing what a service does separately from how you access it.
</p>

<p align="center">
  <a href="https://openbindings.com">Website</a> &middot;
  <a href="openbindings.md">Read the Spec</a> &middot;
  <a href="https://github.com/openbindings/ob">CLI</a>
</p>

---

## What is OpenBindings?

OpenBindings defines a standard way to describe **what a service does** — its operations, schemas, and compatibility guarantees — separately from **how you access it**.

A single OpenBindings Interface (OBI) can reference bindings in OpenAPI, AsyncAPI, MCP, gRPC, or any other binding specification, without redefining the contract for each one.

```
┌─────────────────────────────────────┐
│         OpenBindings Interface      │
│                                     │
│  operations:                        │
│    echo   (method)                  │
│    greet  (method)                  │
│    tick   (event)                   │
│                                     │
│  bindings:                          │
│    echo  → OpenAPI  POST /api/echo  │
│    echo  → MCP      tools/echo      │
│    tick  → AsyncAPI  SSE /events    │
└─────────────────────────────────────┘
```

### Core concepts

- **Operations** are the contract — named units of behavior with input/output schemas and semantic metadata (idempotency, tags, examples).
- **Bindings** map operations to concrete binding specifications without redefining the contract.
- **Sources** reference external binding artifacts (OpenAPI documents, AsyncAPI specs, MCP servers) by format and location.

## Read the spec

The spec defines what an OBI document **is**: its shape, identity, discovery, reference resolution, and versioning. It deliberately does not define how tools should compare OBIs, derive verdicts, execute transforms, or resolve security methods. Those are tool concerns.

**Core specification.** The documents below define what an OBI document is. The spec is self-contained and does not reference the reference-tooling material below.

| Document                                               | Description                              |
| ------------------------------------------------------ | ---------------------------------------- |
| [`openbindings.md`](openbindings.md)                   | OBI spec (working draft toward 0.2.0)    |
| [`openbindings.schema.json`](openbindings.schema.json) | JSON Schema for OBI document validation  |
| [`versions/0.1.0/`](versions/0.1.0/)                   | v0.1.0 release snapshot                  |

**Reference tooling (non-normative).** The documents below describe the openbindings project's reference-tool behavior — what the `ob` CLI, `openbindings-go`, `openbindings-ts`, and future official tools do with OBI documents. They are NOT part of the OBI spec; a tool is spec-conformant regardless of whether it follows these conventions. They exist as an alignment target for third-party tools that want to interoperate with the project's reference tooling.

| Document                                   | Description                                                                |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| [`reference.md`](reference.md)             | Reference-tool behaviors (comparison, transforms, auth, matching, etc.)    |
| [`reference-tests/`](reference-tests/)     | Test fixtures exercising the behaviors in `reference.md`                   |

## Ecosystem

**SDKs**

| Repository                                                                      | Description                                              |
| ------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [openbindings/openbindings-go](https://github.com/openbindings/openbindings-go) | Go SDK for reading, writing, and executing OBI documents |
| [openbindings/openbindings-ts](https://github.com/openbindings/openbindings-ts) | TypeScript SDK monorepo (core SDK + format packages)     |

**CLI**

| Repository                                            | Description                                                                |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| [openbindings/ob](https://github.com/openbindings/ob) | `ob` -- the OpenBindings CLI for creating, executing, and serving OBIs. Ships with a built-in multi-protocol demo (`ob demo`). |

**Binding format libraries**

Format libraries implement binding execution and interface creation for specific binding specifications. They live inside the SDK repos as subpackages.

| Package (Go)                          | Package (TypeScript)         | Format token                         |
| ------------------------------------- | ---------------------------- | ------------------------------------ |
| `openbindings-go/formats/openapi`     | `@openbindings/openapi`      | `openapi@^3.0.0`                     |
| `openbindings-go/formats/asyncapi`    | `@openbindings/asyncapi`     | `asyncapi@^3.0.0`                    |
| `openbindings-go/formats/grpc`        |                              | `grpc`                               |
| `openbindings-go/formats/connect`     |                              | `connect`                            |
| `openbindings-go/formats/mcp`         | `@openbindings/mcp`          | `mcp@2025-11-25`                     |
| `openbindings-go/formats/graphql`     | `@openbindings/graphql`      | `graphql`                            |
| `openbindings-go/formats/usage`       |                              | `usage@^2.0.0`                       |
| `openbindings-go/formats/workersrpc`  | `@openbindings/workers-rpc`  | `workers-rpc`                        |
| `openbindings-go/formats/operationgraph` |                           | `openbindings.operation-graph@0.1.0` |

## Repository structure

```
openbindings.md              OBI specification
openbindings.schema.json     JSON Schema for OBI documents
versions/                    Immutable released snapshots of the spec
reference.md                 Reference-tool behaviors (non-normative)
reference-tests/             Test fixtures for reference-tool behaviors (non-normative)
interfaces/                  Standard OBI interfaces published by the project
examples/                    Spec examples
formats/                     Binding format specifications (e.g., operation-graph)
guides/                      Implementation guidance and patterns
scripts/                     Release tooling
```

## Contributing

OpenBindings is developed in the open. Contributions, feedback, and discussion are welcome.

- [Contributing Guide](CONTRIBUTING.md)
- [Governance](GOVERNANCE.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Releasing](RELEASING.md)
- [Editors](EDITORS.md)

## Sponsors

OpenBindings is a community-driven project. Sponsorship helps fund development, infrastructure, and outreach.

**Interested in sponsoring?** Reach out at [openbindings.com](https://openbindings.com) or open a [discussion](https://github.com/openbindings/spec/discussions).

<table>
  <tr>
    <td align="center" width="200">
      <a href="https://endpin.io">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcset="sponsors/endpin-dark.svg">
          <img src="sponsors/endpin.svg" alt="Endpin" height="32">
        </picture><br>
        <strong>Endpin</strong>
      </a>
    </td>
  </tr>
</table>

## License

This specification is released under the [Apache 2.0 License](LICENSE).
