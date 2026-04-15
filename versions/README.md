# Spec Snapshots

This directory contains **immutable, versioned snapshots** of the OpenBindings specification.

Each snapshot captures the full project state at the time of release: the core spec, JSON Schema, conformance suite, and any companion format specs (under `formats/`). Companion format specs carry their own version in their format token (e.g., `openbindings.operation-graph@0.1.0`), which may differ from the snapshot directory version.

The latest release is **0.1.0**.

To cut a release, see [`RELEASING.md`](../RELEASING.md) or run `scripts/release.sh <version>`.

- `0.1.0/`
  - Spec: `0.1.0/openbindings.md`
  - Schema: `0.1.0/openbindings.schema.json`
  - Editors: `0.1.0/editors.md`
  - Conformance: `0.1.0/conformance/`
