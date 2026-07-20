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
  <a href="openbindings.md">Read the spec</a> &middot;
  <a href="https://github.com/openbindings/ob">CLI</a>
</p>

---

## What is OpenBindings?

OpenBindings defines a standard way to describe **what a service does** — its operations and their input/output contracts — separately from **how you reach it** over any particular protocol.

A single OpenBindings Interface (OBI) can point at bindings in OpenAPI, AsyncAPI, MCP, gRPC, GraphQL, or any other binding specification, without redefining the contract for each one. OBI sits one layer above those formats: each format stays authoritative over its own wire shape, and OBI adds the operation-level overlay that survives across protocols.

```
┌────────────────────────────────────────────┐
│          OpenBindings Interface            │
│                                            │
│  operations:                               │
│    placeOrder   (aliases: orders.create)   │
│    getMenu                                 │
│    orderUpdates (event)                    │
│                                            │
│  bindings:                                 │
│    placeOrder   → OpenAPI   POST /orders   │
│    placeOrder   → MCP       tools/order    │
│    orderUpdates → AsyncAPI  SSE /events    │
└────────────────────────────────────────────┘
```

### Core concepts

- **Operations** are the contract: named units of behavior with input/output schemas and semantic metadata (idempotency, tags, examples).
- **Bindings** map an operation to a concrete protocol target without redefining the contract. One operation can carry many bindings.
- **Sources** reference external binding artifacts (OpenAPI documents, AsyncAPI specs, MCP servers, …) by format and location.
- **Aliases** give an operation additional names with equal standing to its key, including a shared-contract name so consumers can recognize it across services. The name is author-asserted; the spec attaches no trust semantics to it.

## The specification

The spec defines what an OBI document **is**: its shape, discovery, reference resolution, and versioning, plus a thin conformance floor for tools. It specifies the transform language ([JSONata 2.1](https://docs.jsonata.org/)) for tools that evaluate transforms, but deliberately leaves higher-level tool behavior — beyond the [§10](openbindings.md#10-conformance) floor — to implementations: comparison and matching, binding-selection tactics past the deprecation-tier rule, credential and context resolution, and the transform runtime (sandboxing, error handling, resource limits).

Authentication in particular is **not** part of an OBI document. It is a runtime prerequisite negotiated by the binding invoker at call time and resolved into the runtime's store — see the [`binding-invoker`](https://openbindings.com/interfaces/binding-invoker) interface.

## Guides and tutorials

This repository is the **normative and reference** source. It is self-contained for understanding and implementing the standard: the spec, the schema, the conformance corpus, the binding specifications, and worked examples. The project's shared interfaces are published separately in [openbindings/interfaces](https://github.com/openbindings/interfaces).

Conceptual guides, getting-started walkthroughs, and how-to tutorials live on **[openbindings.com](https://openbindings.com)**, where they can evolve independently of any spec version.

## In this repository

| Path | What it is |
| --- | --- |
| [`openbindings.md`](openbindings.md) | The OBI specification (v0.2.0) |
| [`openbindings.schema.json`](openbindings.schema.json) | JSON Schema for validating OBI documents |
| [`binding-specs/`](binding-specs/) | Binding specifications published by the project (e.g., `openbindings.openapi@1`) |
| [`examples/`](examples/) | Worked example OBI documents |
| [`conformance/`](conformance/) | Conformance test corpus + reference runner |
| [`versions/`](versions/) | Immutable released snapshots |

The specification is self-contained and does not depend on any of the reference or tooling material above.

## Implementations

The openbindings project publishes reference implementations. The spec privileges no implementation; third-party tools are free to build their own.

| Project | Description |
| --- | --- |
| [openbindings-go](https://github.com/openbindings/openbindings-go) | Go SDK to read, write, and invoke OBI documents (with per-format packages) |
| [openbindings-ts](https://github.com/openbindings/openbindings-ts) | TypeScript SDK monorepo (core SDK + per-format packages) |
| [ob](https://github.com/openbindings/ob) | The `ob` CLI: synthesize, invoke, and serve OBIs locally (`ob start`), with a built-in multi-protocol demo (`ob demo`) |

## Status

OpenBindings is **pre-1.0**; minor versions may include breaking changes. This repository's working specification is the **v0.2.0 draft** (unreleased; the latest release is 0.1.0). Immutable released snapshots live under [`versions/`](versions/) and are cut at tag time, never before. See [CHANGELOG.md](CHANGELOG.md) for what is changing and [`openbindings.md` §8](openbindings.md#8-versioning) for the versioning model.

## Contributing

OpenBindings is developed in the open. Contributions, feedback, and discussion are welcome.

- [Contributing guide](CONTRIBUTING.md)
- [Governance](GOVERNANCE.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md)
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
