# Releasing the OpenBindings specification

This repo uses **immutable snapshots** for released spec versions, and regular pull requests for improvements.

## Principles

- Released versions are **immutable**: once published under `versions/X.Y.Z/`, they should not change.
- Changes happen via PRs and are released as a **new version**.

## What gets snapshotted

A release snapshot captures the normative core spec at the time of release:

- `openbindings.md` — the core specification
- `openbindings.schema.json` — the normative JSON Schema
- `EDITORS.md` — editors list

**Not snapshotted:**

- `reference.md` and `reference-tests/` — non-normative reference-tool material. These are not part of the OBI spec; they describe what the openbindings project's reference tooling does and are versioned independently. Snapshotting them alongside the spec would imply a coupling the spec deliberately avoids.
- `interfaces/` — role interfaces are independently versioned and use location-based identity. Each interface lives at a stable, versioned path (e.g., `interfaces/openbindings.host/0.1.json`) that IS its identity. Copying interfaces into a version snapshot would create a second URL for the same contract, fragmenting identity. See the spec's [Interface identity](#interface-identity-location-based) section.
- `formats/` — companion format specs carry their own version in their format token (e.g., `openbindings.operation-graph@0.1.0`) and are independently versioned. They live at their canonical path and are referenced by format token, not by release version.

## Workflow

1. Merge changes to the working copy

   - Ensure `openbindings.md` reflects what you intend to release.
   - Ensure any companion format specs under `formats/` are ready.

2. Cut a release snapshot

   - Create a new directory: `versions/<next>/`
   - Copy the normative artifacts into it:
     - `openbindings.md` → `versions/<next>/openbindings.md`
     - `openbindings.schema.json` → `versions/<next>/openbindings.schema.json`
     - `EDITORS.md` → `versions/<next>/editors.md`
   - Update `versions/README.md` to include the new version.
   - (Optional) Use the helper script: `scripts/release.sh <next>`

3. Tag the release
   - Tag the repo with `v<next>` (e.g., `v0.1.1`).

## Errata

Errors discovered in released snapshots are tracked via GitHub issues labeled `errata:<version>` and corrected in the next patch release. Released snapshots are never modified in place.
