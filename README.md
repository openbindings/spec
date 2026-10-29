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

OpenBindings describes operations, their author-declared realizations,
and named consumption points independently of protocols. Operations state what
a component does. Sources name what realizes them, each read under its kind.
Bindings relate an operation to a source. Dependencies state which operations
the software described by the OBI consumes.

An OBI can be as small as `openbindings`, `operations`, `bindings`, and
`sources`. A document that only declares operations needs only `openbindings`
and `operations`. A source's data can embed an artifact such as an API
description, address one or a running service, or be absent where its kind
needs nothing beyond the source's name. An optional `schemas` map holds shared
schemas.

```json
{
  "openbindings": "0.2.0",
  "operations": { "echo": {} },
  "sources": {
    "local": { "kind": "example.echo@1" }
  },
  "bindings": {
    "echo.local": { "operation": "echo", "source": "local" }
  }
}
```

The example kind is illustrative. OpenBindings supplies no built-in invocation
behavior.

### Document concepts

- **Operations** are named capabilities with optional JSON Schema 2020-12
  input and output schemas, each applying to one value at a time. An operation's
  presence does not assert availability.
- **Sources** name what bindings realize operations through. Each requires a
  `kind` and may carry `data`: an embedded artifact, an address, a descriptor,
  or nothing. The kind names how the source's data and its bindings' data are
  read. OpenBindings never reads data as schemas.
- **Bindings** declare realizations. Each requires `operation` and `source`,
  with optional `data` read under the source's kind: a target in an artifact,
  a method name, an adaptation of values, or nothing.
- **Dependencies** are named consumption points referencing local operation
  keys, optionally constrained to acceptable kinds.
- **Schemas** are optional named JSON Schema 2020-12 schemas that operation
  schemas share. Every entry is one of the document's schemas, used or not.
- **Aliases** give an operation additional names, including names adopted
  from published sets of operations. Correspondence is an author claim, with no
  trust or compatibility proof attached.

### Sharing and references

An operation schema uses a shared schema with `{"$ref":"#/schemas/Task"}`.
Where a value sits decides how OpenBindings reads it: a schema reference cannot
reach into `sources`, so an embedded artifact's own schemas, identifiers, and
references are never read as the document's. What source and binding data refer
to is the kind's to define. OpenBindings never scans data for references, and
never expands them.

The [reference chapter](openbindings.md#7-reference-resolution) defines the
document's schemas and resource boundaries. The
[embedded-source example](examples/embedded-source.obi.json) carries one
OpenAPI document as a source's data, shared by two bindings, and a copy of its
`Task` schema for the operations. The
[kind-only example](examples/kind-only.obi.json) uses only the four fields above.

## The specification

OpenBindings defines document meaning and conformance. Kind-specific
interpretation, invocation APIs, binding selection, dependency wiring, and
credential handling are outside it.
[HTTP Discovery](http-discovery.md) is separately scoped and optional.

| Path | Purpose |
| --- | --- |
| [openbindings.md](openbindings.md) | Working 0.2.0 specification |
| [openbindings.schema.json](openbindings.schema.json) | Derived structural schema |
| [SOURCE-MODEL-DRAFT.md](SOURCE-MODEL-DRAFT.md) | This revision's decisions, validation, and migration boundaries |
| [MIGRATING-0.1-TO-0.2.md](MIGRATING-0.1-TO-0.2.md) | Migration from 0.1 and the preceding 0.2 drafts |
| [examples/](examples/) | Illustrative documents using the current draft |
| [conformance/draft-checks/](conformance/draft-checks/README.md) | Focused structural and schema-inventory cases for this revision |
| [binding-specs/](binding-specs/README.md) | Separately scoped kind candidates |
| [versions/](versions/) | Immutable released snapshots |

## Status

The current specification is the **unreleased 0.2.0 sources draft**; 0.1.0
remains the latest release. This revision returns the `sources` map, with each
source carrying `kind` and optional `data`, has each binding name its source
and carry optional `data`, keeps `schemas`, and removes `resources`.

The [core conformance corpus](conformance/README.md) tests this document
model, including the binding's source reference (OBI-07), source data,
contained schema references and OBI-14. No SDK qualification result is asserted
for this baseline. The Go adapter and its recorded failures describe an earlier
source model; family candidates and SDK adapters still require migration. The
focused draft checks remain a design aid. See
[the draft status](SOURCE-MODEL-DRAFT.md) for implementation boundaries.

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
