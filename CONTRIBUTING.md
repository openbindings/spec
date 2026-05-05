# Contributing to the OpenBindings specification

Thanks for helping improve OpenBindings.

## Where changes go

- The **working copy** of the spec is `openbindings.md`.
- Released snapshots live under `versions/<x.y.z>/` and are **immutable**.

## Rules

- PRs SHOULD target `openbindings.md`.
- PRs MUST NOT edit existing released snapshots under `versions/`.

## Workflow

1. Branch from `main`: `git checkout -b <type>/<short-description>`.
   Types: `fix`, `feat`, `docs`, `chore`, `refactor`.
2. Commit and push.
3. `gh pr create --fill --base main` with motivation and the change described.
4. Squash-merge after review (`gh pr merge --squash --delete-branch`).

Keep PRs small and reviewable where possible. Discuss tradeoffs openly; the
goal is deterministic, interoperable tooling.

All changes land on `main` via squash-merged PRs. No direct commits to `main`.

## Releasing a spec version

See [RELEASING.md](RELEASING.md) for the full release workflow, including what gets snapshotted and why.
