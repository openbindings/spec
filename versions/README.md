# Spec Snapshots

This directory contains **immutable, versioned snapshots** of the OpenBindings specification.

Each snapshot captures the normative core at the time of release: the core spec, JSON Schema, editors list, and core conformance corpus. Binding specifications (under `binding-specs/`) and the published interfaces (in [openbindings/interfaces](https://github.com/openbindings/interfaces)) are independently versioned and are **not** snapshotted; see [`RELEASING.md`](../RELEASING.md) for details.

The latest release is **0.1.0**. Version 0.2.0 is the repository's working
draft (the root documents), unreleased: it gains a snapshot here at the
moment it is tagged, never before.

To cut a release, see [`RELEASING.md`](../RELEASING.md) or run `scripts/release.sh <version>`.

- `0.1.0/`
  - Spec: `0.1.0/openbindings.md`
  - Schema: `0.1.0/openbindings.schema.json`
  - Editors: `0.1.0/editors.md`
  - Conformance: `0.1.0/conformance/`
