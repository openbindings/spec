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
- `conformance/` — the core conformance test corpus: `document/`, `tool/`, fixture meta-schema, manifest, and runner. Excludes `conformance/comparison/` (see below). Snapshotted because the corpus is keyed to the OBI-D-##/OBI-T-## rule identifiers in the snapshotted spec; the rule-stability promise (§16) binds rule IDs to specific spec text, so the corpus and spec must be reachable together at the snapshot version.

**Not snapshotted:**

- `interfaces/` — role interfaces are independently versioned and use location-based identity. Each interface lives at a stable, versioned path (e.g., `interfaces/openbindings.binding-invoker/0.1.json`) that IS its identity. Copying interfaces into a version snapshot would create a second URL for the same contract, fragmenting identity. See the spec's [Interface identity](openbindings.md#9-interface-identity) section.
- `formats/` — companion format specs carry their own version in their format token (e.g., `openbindings.operation-graph@0.1.0`) and are independently versioned. They live at their canonical path and are referenced by format token, not by release version.
- `conventions/` — official tooling conventions (comparison analysis, subsumption profile, findings catalog) are non-normative and independently versioned. They are not part of the core spec release.
- `conformance/comparison/` — comparison conformance fixtures are governed by `conventions/` (schemas, prose), not by the core spec's OBI-D/OBI-T rule identifiers. They are excluded from core snapshots; their lifecycle follows the conventions they test.
- `scripts/` — repo-wide tooling (canonical-order checker, manifest generator, corpus verifier). These operate on the current working tree and aren't part of any specific release.

## Workflow

1. Merge changes to the working copy

   - Ensure `openbindings.md` reflects what you intend to release.
   - Ensure any companion format specs under `formats/` are ready.
   - Regenerate `conformance/manifest.json` (`node scripts/generate-conformance-manifest.mjs`) and run `node scripts/verify-corpus.mjs` to confirm the corpus is in sync with the spec.

2. Cut a release snapshot

   - Create a new directory: `versions/<next>/`
   - Copy the normative artifacts into it:
     - `openbindings.md` → `versions/<next>/openbindings.md`
     - `openbindings.schema.json` → `versions/<next>/openbindings.schema.json`
     - `EDITORS.md` → `versions/<next>/editors.md`
     - Core conformance artifacts → `versions/<next>/conformance/`:
       - `conformance/README.md`
       - `conformance/manifest.json`
       - `conformance/fixture.schema.json`
       - `conformance/document/`
       - `conformance/tool/`
       - `conformance/runners/`
     - Do not copy `conformance/comparison/`; it follows the conventions lifecycle.
   - Update `versions/README.md` to include the new version.
   - (Optional) Use the helper script: `scripts/release.sh <next>`

3. Tag the release
   - Tag the repo with `v<next>` (e.g., `v0.1.1`).

## Errata

Errors discovered in released snapshots are tracked via GitHub issues labeled `errata:<version>` and corrected in the next patch release. Released snapshots are never modified in place.
