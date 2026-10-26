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

OpenBindings describes capability contracts, their author-declared realizations,
and named consumption points independently of protocols. Operations state what
a component does. Each binding carries the kind that interprets its content.
Dependencies state which operations the described component consumes.

An OBI can be as small as `openbindings`, `operations`, and `bindings`. A
contract-only document needs only `openbindings` and `operations`. Schemas and
binding content can be inline; an optional `resources` map stores shared JSON
values when useful.

```json
{
  "openbindings": "0.2.0",
  "operations": { "echo": {} },
  "bindings": {
    "echo.local": {
      "operation": "echo",
      "kind": "example.echo@1",
      "content": {}
    }
  }
}
```

The example kind is illustrative. Core supplies no built-in invocation behavior.

### Core concepts

- **Operations** are named capability contracts with optional per-value JSON
  Schema 2020-12 inputs and outputs. An operation's presence does not assert
  availability.
- **Bindings** declare realizations. Each requires `operation` and `kind`, with
  optional kind-interpreted `content`. The kind can describe a live surface, an
  artifact and target, a complete graph, or another realization.
- **Dependencies** are named consumption points referencing local operation
  keys, optionally constrained to acceptable kinds.
- **Resources** are optional named JSON values. Schemas, embedded artifacts,
  graphs, and configuration can share one map. Their uses establish meaning;
  unreferenced values remain ordinary JSON.
- **Aliases** give an operation additional names, including published
  shared-contract names. Correspondence is an author claim, with no trust or
  compatibility proof attached.

### Sharing and references

An operation schema can use `{"$ref":"#/resources/Task"}`. This explicit use
recognizes the target as a schema; merely storing an object with `$id` or
`$schema` does not. A kind may adopt the same-document shared-value reference
form at designated content positions, without making the target a core schema.
The core never recursively expands arbitrary `$ref` objects in stored artifacts.

The [reference chapter](openbindings.md#7-reference-resolution) defines schema
recognition, resource boundaries, and shared-value lookup. The
[embedded-artifact example](examples/shared-resources.obi.json) stores one
OpenAPI document for two bindings. The
[inline example](examples/inline.obi.json) uses only the three fields above.

## The specification

Core defines document meaning and conformance. Kind-specific interpretation,
invocation APIs, binding selection, dependency wiring, and credential handling
are outside it. Context can be carried in kind content or supplied externally.
[HTTP Discovery](http-discovery.md) is separately scoped and optional.

| Path | Purpose |
| --- | --- |
| [openbindings.md](openbindings.md) | Working 0.2.0 specification |
| [openbindings.schema.json](openbindings.schema.json) | Derived structural schema |
| [RESOURCE-MODEL-DRAFT.md](RESOURCE-MODEL-DRAFT.md) | This revision's decisions, validation, and migration boundaries |
| [MIGRATING-0.1-TO-0.2.md](MIGRATING-0.1-TO-0.2.md) | Migration from 0.1 and the earlier 0.2 source model |
| [examples/](examples/) | Illustrative documents using the current draft |
| [conformance/resource-model-draft/](conformance/resource-model-draft/README.md) | Focused structural, schema-recognition, and lookup cases for this revision |
| [binding-specs/](binding-specs/README.md) | Separately scoped kind candidates |
| [versions/](versions/) | Immutable released snapshots |

## Status

The current specification is the **unreleased 0.2.0 binding/resources draft**;
0.1.0 remains the latest release. This revision replaces the preceding draft's
`sources` and `schemas` maps and moves `kind` onto bindings.

The historical core corpus, reference SDK adapters, and family candidates still
use preceding document models. Their existing checks are not evidence of
support for this revision. The focused draft checks do not claim full core
conformance or executable support for the illustrative kinds. See
[the draft status](RESOURCE-MODEL-DRAFT.md) before using implementation claims.

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
