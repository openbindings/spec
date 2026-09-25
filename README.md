<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="icon-dark.svg">
    <img alt="OpenBindings" src="icon.svg" width="80">
  </picture>
</p>

<h1 align="center">OpenBindings</h1>

<p align="center">
  One interface. Any binding. Describe what a service does separately from how you access it.
</p>

<p align="center">
  <a href="https://openbindings.com">Website</a> &middot;
  <a href="openbindings.md">Read the spec</a> &middot;
  <a href="agent-primer.md">AI agent primer</a> &middot;
  <a href="https://github.com/openbindings/ob">CLI</a>
</p>

---

## What is OpenBindings?

OpenBindings defines a standard way to declare protocol-independent operation contracts, describe concrete realizations a component provides, and name operation dependencies it consumes without coupling either side to one protocol.

A single OpenBindings Interface (OBI) can point at sources read as OpenAPI,
AsyncAPI, MCP, gRPC, GraphQL, or under a private kind, without redefining the
operation contract for each one. OBI sits one layer above those artifacts and
protocols. Its core document model does not define kind-specific source or
binding behavior. The OpenBindings project's brownfield binding specifications
are separate, optional descriptions of kinds that deliberately defer to capable
upstream standards.

```
┌────────────────────────────────────────────┐
│          OpenBindings Interface            │
│                                            │
│  operations:                               │
│    placeOrder   (aliases: orders.create)   │
│    getMenu                                 │
│    orderUpdates (event)                    │
│    payments.authorize                      │
│                                            │
│  dependencies:                             │
│    payment → payments.authorize            │
│                                            │
│  bindings:                                 │
│    placeOrder   → OpenAPI   POST /orders   │
│    placeOrder   → MCP       tools/order    │
│    orderUpdates → AsyncAPI  SSE /events    │
└────────────────────────────────────────────┘
```

### Core concepts

- **Operations** are neutral contracts: named units of behavior with input/output schemas and semantic metadata (idempotency, tags, examples). Presence alone does not assert availability.
- **Dependencies** are named consumption points that reference operations and may constrain acceptable kinds. They carry no concrete target.
- **Bindings** map an operation to a concrete protocol target without redefining the contract. One operation can carry many bindings.
- **Sources** carry an exact, opaque `kind` and optional `content` read under it. The core gives no meaning to that content; it might embed an artifact, contain an address, or describe a live surface.
- **Aliases** give an operation additional names with equal standing to its key, including a shared-contract name so consumers can recognize it across services. The name is author-asserted; the spec attaches no trust semantics to it.

## The specification

The spec defines what an OBI document **is**: its shape, reference resolution, versioning, and exact kind comparison, plus a thin conformance floor for tools. Higher-level tool behavior beyond the [§10](openbindings.md#10-conformance) floor is deliberately left to implementations: comparison and matching, dependency composition, provider and binding selection, and credential and context resolution. How a binding reaches its target and adapts values between the operation and that target is read under its source's kind, outside the core. [HTTP Discovery](http-discovery.md) is an independently versioned, optional specification, not part of the core document model.

Authentication in particular is **not** part of an OBI document. It is a
runtime prerequisite negotiated by the binding invoker at call time and
resolved into effective invocation context; a runtime may persist durable
values in a document store or somewhere else, but no store architecture is
required — see the
[`binding-invoker`](https://openbindings.com/interfaces/binding-invoker)
interface.

## Guides and tutorials

This repository is the **normative and reference** source. It is self-contained for understanding and implementing the core standard: the spec, the schema, the conformance corpus, project binding-specification candidates, and worked examples. The project's shared interfaces are published separately in [openbindings/interfaces](https://github.com/openbindings/interfaces).

Conceptual guides, getting-started walkthroughs, and how-to tutorials live on **[openbindings.com](https://openbindings.com)**, where they can evolve independently of any spec version. The informative [`agent-primer.md`](agent-primer.md) is kept beside the working specification; it is pending revision for the kind pass, so the core specification governs any disagreement. The website renders that same file rather than maintaining another copy.

## In this repository

| Path | What it is |
| --- | --- |
| [`openbindings.md`](openbindings.md) | The OBI specification (v0.2.0) |
| [`http-discovery.md`](http-discovery.md) | Optional, independently versioned HTTP Discovery specification |
| [`openbindings.schema.json`](openbindings.schema.json) | JSON Schema for validating OBI documents |
| [`agent-primer.md`](agent-primer.md) | Informative, version-aligned orientation for AI agents |
| [`ABSTRACTION-FIDELITY.md`](ABSTRACTION-FIDELITY.md) | Informative doctrine for protocol-blind synthesis and invocation work |
| [`MIGRATING-0.1-TO-0.2.md`](MIGRATING-0.1-TO-0.2.md) | Practical migration guide for 0.1 documents |
| [`binding-specs/`](binding-specs/) | Unreleased first-`@1` binding-specification candidates and authoring guidance |
| [`examples/`](examples/) | Worked example OBI documents |
| [`conformance/`](conformance/) | Conformance test corpus + reference runner |
| [`versions/`](versions/) | Immutable released snapshots |
| [`history/`](history/) | Archived, non-normative design records; not current requirements or issue lists |

The specification is self-contained and does not depend on any of the reference or tooling material above.

## Implementations

The openbindings project publishes reference implementations. The spec privileges no implementation; third-party tools are free to build their own.

| Project | Description |
| --- | --- |
| [openbindings-go](https://github.com/openbindings/openbindings-go) | Go SDK to read, write, and invoke OBI documents, with separately installable binding implementations |
| [openbindings-ts](https://github.com/openbindings/openbindings-ts) | TypeScript SDK monorepo: core SDK plus separately installable binding implementations |
| [ob](https://github.com/openbindings/ob) | The `ob` CLI: synthesize, invoke, and serve OBIs locally (`ob start`), with a built-in multi-protocol demo (`ob demo`) |

## Status

OpenBindings is **pre-1.0**; minor versions may include breaking changes. This repository's working specification is the **v0.2.0 draft** (unreleased; the latest release is 0.1.0). Immutable released snapshots live under [`versions/`](versions/) and are cut at tag time, never before. See [the 0.1-to-0.2 migration guide](MIGRATING-0.1-TO-0.2.md), [CHANGELOG.md](CHANGELOG.md) for the release delta, and [`openbindings.md` §8](openbindings.md#8-versioning) for the versioning model.

## Contributing

OpenBindings is developed in the open. Contributions, feedback, and discussion are welcome.

- [Contributing guide](CONTRIBUTING.md)
- [Governance](GOVERNANCE.md)
- [Intellectual-property status](IPR.md)
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
