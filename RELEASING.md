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
- **Releases are dated by their tags.** Release tags are annotated
  (`git tag -a vX.Y.Z -m ...`; from 0.2.0 on — the v0.1.0 tag predates
  this convention and is lightweight). The CHANGELOG's in-progress
  section is headed `## X.Y.Z (working draft)`; at release it is
  retitled `## X.Y.Z — YYYY-MM-DD`, the date being the day the tag is
  created.

## What gets snapshotted

A release snapshot captures the normative core spec at the time of release:

- `openbindings.md` — the core specification
- `openbindings.schema.json` — the normative JSON Schema
- `EDITORS.md` — editors list
- `conformance/` — the **core** conformance test corpus only: `document/`,
  `tool/`, `scenarios/`, both core fixture/scenario meta-schemas, the manifest,
  README, and core runner. Snapshotted because the corpus is keyed to the
  OBI-D-##/OBI-T-## rule identifiers in the snapshotted spec; the rule-
  stability promise ([§10.6](openbindings.md#106-retired-rule-identifiers))
  binds rule IDs to specific spec text, so the corpus and spec must be
  reachable together at the snapshot version. (The 0.1.0 snapshot predates
  this corpus layout; its `conformance/` holds that era's three flat fixture
  files, and stays as released.)

**Not snapshotted:**

- The project's shared interfaces are **no longer in this repository** — they live in [openbindings/interfaces](https://github.com/openbindings/interfaces), independently versioned with location-based identity. They were never snapshotted with the core spec: copying a contract into a spec snapshot would create a second URL for the same contract, fragmenting identity.
- `binding-specs/` — published binding specifications revise on their own cadence and are cited by identifier, never by core release version. They are not copied into `versions/<core>/`; instead, each exact revision already has its own immutable, digest-recorded publication bundle under `binding-specs/releases/`, indexed by `binding-specs/publications.json` and served from its permanent revision URL. The core snapshot therefore does not duplicate that independent archive. An incompatible change publishes the next binding-specification revision ([OBI-B-03](openbindings.md#104-binding-specification-rules)).
- The **non-core** conformance corpora — `conformance/binding-specs/`, `conformance/operation-graph/`, `conformance/transforms/`. These are keyed to binding-specification identifiers and to the transform language, not to the core rule identifiers, so they follow what they test rather than the core release. Copy only the directories listed in step 2; taking `conformance/` wholesale would freeze corpora that are not the core spec's to freeze.
- `scripts/` — repo-wide tooling (canonical-order checker, manifest generator, corpus verifier). These operate on the current working tree and aren't part of any specific release.

## Workflow

1. Merge changes to the working copy

   - Ensure `openbindings.md` reflects what you intend to release.
   - Ensure any binding specifications under `binding-specs/` that ship with this change set are ready. They are not snapshotted, but a core release that cites a specification still being drafted publishes a dangling citation.
   - Run `node scripts/verify-binding-spec-publications.mjs`. Every binding-specification identifier cited as published must already be present in `binding-specs/publications.json`, with its immutable bundle and permanent URLs.
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
       - `conformance/tool-scenario.schema.json`
       - `conformance/document/`
       - `conformance/tool/`
       - `conformance/scenarios/`
       - `conformance/runners/`
   - Update `versions/README.md` to include the new version.
   - (Optional) Use the helper script: `scripts/release.sh <next>`

3. Tag the release
   - Retitle the CHANGELOG's `## <next> (working draft)` section to
     `## <next> — YYYY-MM-DD`, dated to the tag.
   - Tag the repo with an annotated tag: `git tag -a v<next> -m ...`
     (e.g., `v0.1.1`), in the same sitting as step 2 — the snapshot must
     never exist untagged.

4. Open the next draft
   - Start a new top section in the CHANGELOG for the next version, headed
     `(working draft)`.
   - When the first breaking change lands, bump the draft's self-declared
     version in `openbindings.md` and the examples' `openbindings` fields.

## Errata

Errors discovered in released snapshots are tracked via GitHub issues labeled `errata:<version>` and corrected in the next patch release. Released snapshots are never modified in place.
