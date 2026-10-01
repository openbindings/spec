# Go reference runner

Reference Go harness for the OpenBindings core conformance corpus. It executes every case `manifest.json` counts, with the `openbindings-go` SDK and its `schemaeval` evaluator: the validity fixtures under `document/` and `tool/`, and the tool scenarios (format `@2`) under `scenarios/`. It reports each case in one run category (corpus README, "Run categories"), gives every omission its reason, and reconciles its cases with the manifest.

This is exemplar code for SDK authors writing harnesses in other languages. The pattern is the same in any language; only the SDK invocation differs.

## Run

The runner builds against the SDK checked out beside the spec repository, at `../openbindings-go` relative to the spec checkout (its `go.mod` `replace` directives), as spec CI lays them out:

```sh
cd spec/conformance/runners/go
go run . $(go run ./declared -sdk ../../../../openbindings-go -spec ../..) -strict
```

`./declared` prints the applied text the SDK declares, as `-applied` and `-applied-sha256`, by parsing the SDK's source: `appliedRelease` and `appliedRevision` (`version.go`) and the hash its corpus adapter pins for that revision (`appliedTextRevision`, `appliedTextSHA256`). It refuses, with exit status 1, a missing or non-literal constant, a release that is not SemVer, a revision that is not a full 40-hex commit of the spec history, and a hash pinned for another revision. `go test ./...` here runs the controls for both programs:

- the applied-text parsing and verification, and `./declared`'s reading of the SDK;
- the judges against wrong expectations: a small synthetic corpus run through the pinned SDK, with at least one deliberately wrong expectation for every action and for the judging branches a correct SDK can reach (binding keys, `violates` and `notViolated`, `conformant` in both directions, refusals expected or not, `forbidReasons`, `orNoVerdict` and `dependsOn`, shortfalls, example results, kind, conclusion, collision candidates), each of which must fail beside a correct twin;
- the checks that fire only when the SDK misbehaves, each held at its call site: a stand-in for the misbehaving call drives the judge, which must fail (a retrieval the sentinel observes, a conclusion naming another applied text, a ParseDocument refusal that comes with a document, a value-contract refusal that comes with contracts), beside direct controls of the residue helpers and the http sentinel.

They do not cover every way an SDK can misbehave, only the checks listed.

Inside the `openbindings/` monorepo, the project's `go.work` may exclude this directory; if so, set `GOWORK=off`.

Flags:

```
  -corpus PATH      the conformance/ directory (found from the working directory by default)
  -rule RULE        run one rule's cases, e.g. OBI-T-08 (skips the reconciliation)
  -verbose          print every case's category
  -json             print {"pin", "applied", "appliedSHA256", "reconciliation", "cases": [{"id", "status", "signature"}]}
                    for scripts/check-runner-results.mjs
  -pin SHA          the SDK commit under test, recorded in the JSON results
  -applied R@REV    the release and full 40-hex revision whose text the SDK declares it applies,
                    or a release alone (reported unverified: no release-snapshot verification exists)
  -applied-sha256 H the sha256 of the openbindings.md the SDK declares it applies
  -strict           report an applied text that cannot be verified as FAIL, not UNVERIFIED
```

## What it checks

- **Validity fixtures:** `ValidateDocument`'s report. A conforming case is neither refused nor non-conformant (undetermined is not non-conformant). A violating case is non-conformant, with every rule in `violates` violated and no rule in `notViolated` violated.
- **Scenarios:** each action through the SDK's API: `ValidateDocument` (a version refusal must come with nothing else, at `ParseDocument` too), `Document.ResolveOperation` and `Document.OperationBindings`, `ConcludeConformance` (`conformant` admits `conformance-undetermined`), `Dependency.AcceptsKind`, and value contracts under `schemaeval` for value and example cases. `derive-form` is omitted: the SDK derives no forms.
- **Retrieval sentinels:** for the whole check-dependency-kind action, a TCP listener bound to an ephemeral local port, whose address the kind names, counts every accepted connection whatever client made it; a FIFO observes the file channel where the platform has FIFOs.
- **Capability profile:** the features the SDK with `schemaeval` declares. A SHORTFALL, no verdict where the profile supports every feature the case depends on, fails the run: the profile is the SDK's own declaration.
- **Version gates:** judged against the SDK's declaration, `SupportedVersions`, never against its version decision.
- **Applied text:** a conclusion names exactly the `-applied` release and revision, always compared first; then the revision must be a commit of the history of the specification repository holding the corpus (`git rev-parse --verify REV^{commit}` gives it back), and its `openbindings.md`, read with `git show`, must hash to `-applied-sha256`. The text checked out beside the corpus, and the index, play no part, so the spec checkout needs that revision in its history. An empty or malformed release or revision, a symbolic revision included, is a usage error.

## Exit codes

- `0`: no case failed or fell short, and every case is accounted for
- `1`: a case failed or fell short, or the reconciliation found a problem
- `2`: usage or IO error, a malformed `-applied` or `-applied-sha256` included

## Spec CI

The `reference-go-core` job in `.github/workflows/ci.yml` runs this runner with the SDK pinned to one commit and compares its `-json` results with the corpus's complete case set and with [`expected-failures.json`](expected-failures.json), whose failures and omissions are keyed by case, pin, declared applied text, status, and signature (`scripts/check-runner-results.mjs`): an unexpected failure, shortfall, unverified case, or omission, a status outside the six run categories, ADVISORY on a case that is not a collision case or pass on one that is, an applied text other than the one the expected results record, an expected failure or omission that is executed or not run, a changed signature, a missing, extra, or unexplained case, and a reconciliation problem all fail. The pin is the Go commit the runner was repaired against; the job stays disabled until integration publishes it, or the commit that adopts this corpus, and keys the pin and the expected failures to it.
