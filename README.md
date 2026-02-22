<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo-dark.svg">
    <img alt="OpenBindings" src="logo.svg" width="600">
  </picture>
</p>

<p align="center">
  An open standard for portable service interfaces with pluggable binding specifications.
</p>

<p align="center">
  <a href="https://openbindings.com">Website</a> &middot;
  <a href="openbindings.md">Read the Spec</a> &middot;
  <a href="https://github.com/openbindings/cli">CLI</a> &middot;
  <a href="https://demo.openbindings.com">Live Demo</a>
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

| Document                                               | Description                             |
| ------------------------------------------------------ | --------------------------------------- |
| [`openbindings.md`](openbindings.md)                   | Working draft — targeting v0.1.0        |
| [`openbindings.schema.json`](openbindings.schema.json) | JSON Schema for OBI document validation |
| [`versions/`](versions/)                               | Released snapshots (none yet)           |

## Ecosystem

| Repository                                                                      | Description                                                           |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [openbindings/cli](https://github.com/openbindings/cli)                         | `ob` — the OpenBindings CLI for browsing, syncing, and executing OBIs |
| [openbindings/openbindings-go](https://github.com/openbindings/openbindings-go) | Go SDK for reading and writing OBI documents                          |
| [openbindings/demo](https://github.com/openbindings/demo)                       | Demo server with OpenAPI, AsyncAPI, MCP, and gRPC bindings            |

## Repository structure

```
openbindings.md              Specification (working draft)
openbindings.schema.json     JSON Schema
versions/                    Immutable released snapshots
interfaces/                  Standard OBI interfaces published by the project
conformance/                 Conformance test fixtures
examples/                    Spec examples
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
          <img src="sponsors/endpin.svg" alt="Endpin LLC" height="32">
        </picture><br>
        <strong>Endpin LLC</strong>
      </a>
    </td>
    <td align="center" width="200">
      <em>Your logo here</em>
    </td>
  </tr>
</table>

## License

This specification is released under the [Apache 2.0 License](LICENSE).
