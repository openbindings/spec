# Releasing the OpenBindings specification

This repo uses **immutable snapshots** for released spec versions, and regular pull requests for improvements.

## Principles

- Released versions are **immutable**: once published under `versions/X.Y.Z/`, they should not change.
- Changes happen via PRs and are released as a **new version**.

## Workflow

1. Merge changes to the working copy

   - Ensure `openbindings.md` reflects what you intend to release.

2. Cut a release snapshot

   - Create a new directory: `versions/<next>/`
   - Copy `openbindings.md` and supporting files into it:
     - `openbindings.md` → `versions/<next>/openbindings.md`
     - `EDITORS.md` → `versions/<next>/editors.md`
   - Update `versions/README.md` to include the new version.
   - (Optional) Use the helper script: `scripts/release.sh <next>`

3. Tag the release
   - Tag the repo with `v<next>` (e.g., `v0.1.1`).
