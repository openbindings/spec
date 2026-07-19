# Releasing the OpenBindings specification

This repo uses **immutable snapshots** for released spec versions, and regular pull requests for improvements.

## Principles

- Released versions are **immutable**: once published under `versions/X.Y.Z/`, they should not change.
- Changes happen via PRs and are released as a **new version**.
- **A snapshot exists only for a tagged release.** The snapshot and the tag
  are cut together (workflow steps 2–3, one sitting); a `versions/X.Y.Z/`
  directory with no `vX.Y.Z` tag is a lie about what has shipped. The root
  documents are the working draft of the NEXT version, and `versions/`
  contains only what was actually released.
- **One version string, one text.** The moment the working draft would
  diverge breakingly from the latest released snapshot, the draft's
  self-declared version (the `openbindings.md` heading, the CHANGELOG
  section) must already be the next version. Two normative texts under one
  identifier is exactly the divergence OBI-T-04 exists to prevent.

## What gets snapshotted

A release snapshot captures the normative core spec at the time of release:

- `openbindings.md` — the core specification
- `openbindings.schema.json` — the normative JSON Schema
- `EDITORS.md` — editors list
- `conformance/` — the **core** conformance test corpus only: `document/`, `tool/`, fixture meta-schema, manifest, and runner. Snapshotted because the corpus is keyed to the OBI-D-##/OBI-T-## rule identifiers in the snapshotted spec; the rule-stability promise ([§10.6](openbindings.md#106-retired-rule-identifiers)) binds rule IDs to specific spec text, so the corpus and spec must be reachable together at the snapshot version.

**Not snapshotted:**

- The project's shared interfaces are **no longer in this repository** — they live in [openbindings/interfaces](https://github.com/openbindings/interfaces), independently versioned with location-based identity. They were never snapshotted with the core spec: copying a contract into a spec snapshot would create a second URL for the same contract, fragmenting identity.
- `binding-specs/` — published binding specifications revise on their own cadence and are cited by identifier, never by release version. An identifier is `openbindings.<name>@<rev>`, where `<rev>` is a revision of the binding specification itself; artifact and dialect versions never appear in it, so a binding specification's standing does not move when the core spec releases. An incompatible change publishes the next revision, which is a different identifier ([OBI-B-03](openbindings.md#104-binding-specification-rules)).
- The **non-core** conformance corpora — `conformance/binding-specs/`, `conformance/operation-graph/`, `conformance/transforms/`. These are keyed to binding-specification identifiers and to the transform language, not to the core rule identifiers, so they follow what they test rather than the core release. Copy only the directories listed in step 2; taking `conformance/` wholesale would freeze corpora that are not the core spec's to freeze.
- `scripts/` — repo-wide tooling (canonical-order checker, manifest generator, corpus verifier). These operate on the current working tree and aren't part of any specific release.

## Workflow

1. Merge changes to the working copy

   - Ensure `openbindings.md` reflects what you intend to release.
   - Ensure any binding specifications under `binding-specs/` that ship with this change set are ready. They are not snapshotted, but a core release that cites a specification still being drafted publishes a dangling citation.
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
   - Update `versions/README.md` to include the new version.
   - (Optional) Use the helper script: `scripts/release.sh <next>`

3. Tag the release
   - Tag the repo with `v<next>` (e.g., `v0.1.1`), in the same sitting as
     step 2 — the snapshot must never exist untagged.

4. Open the next draft
   - Retitle the CHANGELOG's top section to the next version, marked
     `(unreleased, in draft)`.
   - When the first breaking change lands, bump the draft's self-declared
     version in `openbindings.md` and the examples' `openbindings` fields.

## Errata

Errors discovered in released snapshots are tracked via GitHub issues labeled `errata:<version>` and corrected in the next patch release. Released snapshots are never modified in place.
