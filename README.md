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
  <a href="openbindings.md">Read the spec</a>
</p>

---

## What is OpenBindings?

OpenBindings defines an interface document model: protocol-independent operation contracts, author-declared realizations through bindings, and named consumption points through dependencies.

A single OpenBindings Interface (OBI) can point at sources read as OpenAPI,
AsyncAPI, MCP, gRPC, GraphQL, or under a private kind, without redefining the
operation contract for each one. OBI sits one layer above those artifacts and
protocols. Its core document model does not define kind-specific source or
binding behavior.

The protocol labels and targets below illustrate content interpreted under a
source's kind; they are not core fields or built-in protocol support.

```
┌────────────────────────────────────────────┐
│          OpenBindings Interface            │
│                                            │
│  operations:                               │
│    placeOrder   (aliases: orders.create)   │
│    getMenu                                 │
│    orderUpdates                            │
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

- **Operations** are neutral contracts: named units of behavior with optional per-value input/output schemas and descriptive metadata, including tags and examples. Presence alone does not assert availability.
- **Dependencies** are named consumption points that reference operations and may constrain acceptable kinds. They carry no concrete target.
- **Bindings** declare realizations of operations through sources, as author claims. Multiple bindings can reference one operation. An optional `idempotent` member states a claim about repetition through that particular binding.
- **Sources** carry an exact, opaque `kind` and optional `content` read under it. The core gives no meaning to that content; it might embed an artifact, contain an address, or describe a live surface.
- **Aliases** give an operation additional names with equal standing to its key, including a shared-contract name so consumers can recognize it across services. The name is author-asserted; the spec attaches no trust semantics to it.

## The specification

The spec defines what an OBI document **is** and means: its shape, reference resolution, value contracts, versioning, exact kind comparison, and the rules a conformant document meets ([§10](openbindings.md#10-conformance)). It is a document model: how software uses documents, such as comparing them, composing dependencies with providers, choosing bindings, or resolving credentials, is outside it. How a binding reaches its target and adapts values between the operation and that target is read under its source's kind, outside the core. [HTTP Discovery](http-discovery.md) is an independently versioned, optional specification, not part of the core document model.

The core defines no authentication field or invocation behavior. Context, such
as a credential used to access a target, is carried in content under a source's
kind or comes from outside the document
([§5](openbindings.md#5-document-model)).

## Guides and tutorials

This repository contains the working core specification, its derived schema,
core test corpus, and worked examples. The core specification is
self-contained; the separately scoped specifications and informative material
listed below do not add core requirements.

Conceptual guides, getting-started walkthroughs, and how-to tutorials live on **[openbindings.com](https://openbindings.com)**, where they can evolve independently of any spec version.

## In this repository

| Path | What it is |
| --- | --- |
| [`openbindings.md`](openbindings.md) | The OBI specification (v0.2.0) |
| [`http-discovery.md`](http-discovery.md) | Optional, independently versioned HTTP Discovery specification |
| [`openbindings.schema.json`](openbindings.schema.json) | JSON Schema for validating OBI documents |
| [`ABSTRACTION-FIDELITY.md`](ABSTRACTION-FIDELITY.md) | Informative doctrine for protocol-blind synthesis and invocation work |
| [`MIGRATING-0.1-TO-0.2.md`](MIGRATING-0.1-TO-0.2.md) | Practical migration guide for 0.1 documents |
| [`binding-specs/`](binding-specs/) | Unreleased first-`@1` binding-specification candidates and authoring guidance |
| [`examples/`](examples/) | Example OBI documents, with illustrative kinds and `content` |
| [`conformance/`](conformance/) | Conformance test corpus + reference runner |
| [`versions/`](versions/) | Immutable released snapshots |
| [`history/`](history/) | Archived, non-normative design records; not current requirements or issue lists |

The specification is self-contained and does not depend on any of the reference or tooling material above.

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

## CI ownership

Ordinary CI validates this repository’s schemas, examples, deterministic corpus
and publication integrity with locked validators (`npm ci --prefix .github`).
Implementation compatibility, network authority corroboration and the existing
512-trial adversarial replay are manual in `historical-compatibility.yml`. They
do not define normative expectations. The central project caller is retired.
