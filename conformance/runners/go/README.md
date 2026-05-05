# Go reference runner

Reference Go harness for the OpenBindings conformance corpus. Walks fixture files in `../../../conformance/{document,tool}/`, runs each embedded document through the `openbindings-go` SDK, and reports per-rule and overall pass/fail.

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
  -rule  RULE     limit to fixtures for one rule, e.g. OBI-D-04
  -verbose        print per-test pass/fail
  -json           emit JSON summary instead of human output
```

## Exit codes

- `0` — all tests passed
- `1` — one or more mismatches against the SDK
- `2` — usage / IO error

## What "pass" means here

For each test case, the runner unmarshals the embedded `document` into the SDK's `Interface` type and calls `Validate()`. It treats "no parse error AND no validate error" as the SDK's *valid* verdict. The SDK's verdict is then compared against the fixture's `valid` field.

The runner does NOT verify the fixture's `violates` set against the SDK's reported errors, because the Go SDK does not currently emit OBI-D-## rule identifiers in its error output. SDKs that do report rule IDs SHOULD additionally verify the SDK's report contains at least the listed `violates` rules (minimum-set semantics per the corpus README).

## Local SDK pinning

`go.mod` uses a `replace` directive pointing at `../../../../openbindings-go` (the sibling SDK in this monorepo). When extracting this runner outside the monorepo, replace that line with a versioned dependency on `github.com/openbindings/openbindings-go`.
