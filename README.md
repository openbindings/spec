# OpenBindings Specification

OpenBindings is an open-source standard for defining **service interfaces** as a set of named **operations** (meaning, schemas, compatibility), while allowing **flexible access** via pluggable **binding specifications** (e.g., OpenAPI, AsyncAPI, gRPC/proto) without redefining the contract.

## Read the spec

- **Working copy (open for PRs)**: `openbindings.md`
- **Latest released spec**: `versions/0.1.0/openbindings.md`
- **All released snapshots**: `versions/` (immutable, versioned for stable citation)
- **JSON Schema (working copy)**: `openbindings.schema.json`

## What OpenBindings is (at a glance)

- **Operations are the contract**: operation names + input/output/payload schemas define meaning.
- **Bindings are exposures**: bindings reference external binding artifacts via `sources` + `format` + optional `ref`.
- **Interfaces are reusable**: composition and compatibility are built into the model (`composes`, `aliases`, `satisfies`).

## Repo structure

- **`openbindings.md`**: working copy of the specification
- **`openbindings.schema.json`**: JSON Schema for the OpenBindings document shape
- **`versions/`**: immutable released snapshots
- **`examples/`**: spec examples (intentionally empty for now)
- **`interfaces/`**: unbound OpenBindings interfaces published by the project for interoperability
- **`EDITORS.md`**: current editors/maintainers (working copy)
- **`scripts/release.sh`**: helper to create a new snapshot directory

## Contributing & project docs

- **Contributing**: `CONTRIBUTING.md`
- **Releases**: `RELEASING.md`
- **Governance**: `GOVERNANCE.md`
- **Code of Conduct**: `CODE_OF_CONDUCT.md`
- **Security**: `SECURITY.md`

## Canonical home

For the canonical spec home, see `openbindings.com`.
