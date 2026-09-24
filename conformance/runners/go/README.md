# Go reference runner

Reference Go harness for the OpenBindings conformance corpus. Walks fixture files in `../../../conformance/{document,tool}/`, validates each embedded document with the `openbindings-go` SDK, runs the core tool scenarios in `../../../conformance/scenarios/`, and reports per-rule and overall pass/fail.

This is exemplar code for SDK authors writing harnesses in other languages. The pattern is the same in any language; only the SDK invocation differs.

## Run

```sh
cd spec/conformance/runners/go
go run .
```

Inside the `openbindings/` monorepo, the project's `go.work` may exclude this directory; if so, set `GOWORK=off`:

```sh
GOWORK=off go run .
```

Flags:

```
  -corpus PATH    path to the conformance/ directory (auto-detected by default)
  -rule  RULE     limit to fixtures for one rule, e.g. OBI-D-03
  -verbose        print per-test pass/fail
  -json           emit JSON summary instead of human output
```

## Exit codes

- `0` — all tests passed
- `1` — one or more mismatches against the SDK
- `2` — usage / IO error

## What "pass" means here

For each test case, the runner validates the embedded document's exact bytes with `ValidateDocument` and holds its report to the fixture:

- A conforming case (`valid: true`) establishes no violation. The report may still conclude *conformance undetermined*: inconclusive is not non-conformant.
- A violating case is refused under OBI-T-04 or concludes *non-conformant*, and every document rule the fixture's `violates` lists is violated in the report's evidence (minimum-set semantics per the corpus README). `OBI-T-04` in `violates` requires the refusal.
- OBI-D-18 takes a transform parser, which the runner does not give validation, so the runner expects it inconclusive wherever a fixture expects it violated.

Version annotations are applied to the SDK's support declaration, `SupportedVersions`: `requiresMinSupported` skips a test when the lowest version the SDK supports is below the annotation, and `requiresSupports` skips one whose version `IsSupportedVersion` refuses. Skips are reported separately, never as failures.

## Local SDK pinning

`go.mod` uses a `replace` directive pointing at `../../../../openbindings-go` (the sibling SDK in this monorepo). When extracting this runner outside the monorepo, replace that line with a versioned dependency on `github.com/openbindings/openbindings-go`.
