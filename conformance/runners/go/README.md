# Go reference runner

Reference Go harness for the OpenBindings core conformance corpus. It executes every case `manifest.json` counts, with the `openbindings-go` SDK and its `schemaeval` evaluator: the validity fixtures under `document/` and the scenarios (format `openbindings.core-scenarios@3`) under `scenarios/`. It judges each answer as the corpus README's "Judging" table says, reports each case in one run category (corpus README, "Run categories"), gives every case that is not a pass its reason, and reconciles its cases with the manifest.

This is exemplar code for SDK authors writing harnesses in other languages. The pattern is the same in any language; only the SDK invocation differs.

## Run

The runner builds against the SDK checked out beside the spec repository, at `../openbindings-go` relative to the spec checkout (its `go.mod` `replace` directives), as spec CI lays them out:

```sh
cd spec/conformance/runners/go
go run .
```

Inside the `openbindings/` monorepo, the project's `go.work` may exclude this directory; if so, set `GOWORK=off`.

Flags:

```
  -corpus PATH  the conformance/ directory (found from the working directory by default)
  -verbose      print every case's category (by default, only the cases that are not a pass)
  -json         print {"pin", "reconciliation", "cases": [{"id", "status", "signature"}]}
                for scripts/check-runner-results.mjs
  -pin SHA      the SDK commit under test, recorded in the JSON results
```

`go test ./...` runs the runner's controls: a small synthetic corpus run through the SDK, with a deliberately wrong expectation for every row of the Judging table and every judging branch (each must fail or fall short) beside a correct twin that must pass; an omitted action; and the loading of `document/` and `@3` scenario files and their reconciliation with the manifest. The controls read the rule identifiers the SDK reports from the SDK itself, so they hold whichever identifiers it emits. They do not cover every way an SDK can misbehave, only the checks listed.

## How it judges

The SDK's answer is one of three kinds: a result (a conclusion, an outcome, or a value verdict), or a decline. A decline is any answer that gives none: a conclusion of conformance undetermined, a version refusal, a no-verdict, or an inconclusive call. Why the SDK declined is its own reporting, which the corpus does not test, so every decline is judged alike.

| Action | SDK call | Passes | Otherwise |
|---|---|---|---|
| validity fixture | `ValidateDocument` | a conforming text concluded conformant; a non-conforming one concluded non-conformant with every rule in `violates` violated (a minimum set) and none in `notViolated` | a wrong conclusion FAILs; a decline on a non-conforming text FAILs; a decline on a conforming text is a SHORTFALL (fixtures carry no `dependsOn`) |
| `validate-document` | `ValidateDocument` | as a fixture, and also a decline on a conforming text under a `dependsOn` feature the profile declares unsupported | as a fixture |
| `resolve-operation` | `Document.ResolveOperation`, `Document.OperationBindings` | the same outcome, with the same binding keys in any order | another outcome, a decline included, FAILs |
| `check-dependency-kind` | `Dependency.AcceptsKind` on the binding's source kind | the same outcome | another outcome, a decline included, FAILs |
| `validate-operation-values` | `ValueContractCompiler.Resolve`, `CompileInput` or `CompileOutput`, `ValueContract.ValidateJSON` | `satisfies` or `fails`: the same result, or a decline where the value carries `orNoVerdict` or depends (by the case's `dependsOn`, or the value's own, which replaces it) on a feature the profile declares unsupported; `undefined`, `external`, `no-contract`: any decline | a wrong result, or any result where a decline is expected, FAILs; a decline of `satisfies` or `fails` under declared support is a SHORTFALL |
| `check-examples` | a composition of value validation (the Go core has no example checker) | `true` and `false` as `satisfies` and `fails`; `undefined`, `external`, and `no-claim` as their value results | as for values; and every example of the operation and every side it supplies must have exactly one expected result |

A case fails when any value or claim fails, and falls short when none fails and one falls short. A document the SDK declines to carry or resolve declines every value. A case whose `dependsOn` names a feature the profile does not declare FAILs. An action the SDK does not implement is OMITTED with its reason (the `unimplemented` map, empty for the Go core); an action the format does not define FAILs.

## Feature profile

The profile (`profile` in `actions.go`) is what the SDK with `schemaeval` declares for each feature the corpus README lists under "Features":

| Feature | Declared |
|---|---|
| `recursive-references` | supported |
| `document-resource-dynamic-scope` | supported |
| `supplied-resources` | supported |
| `ecma262-unicode-property-escapes` | unsupported: Go's Unicode tables are not ECMA-262's |
| `repeated-member-detection` | supported |
| `draft-07-dialect` | unsupported |
| `exact-numbers` | supported |
| `exact-lone-surrogate-strings` | unsupported: the Go core does not carry a string escaping a lone surrogate, so it concludes nothing about a text holding one |

A SHORTFALL, a decline where the profile supports every feature the case depends on, fails the run: the profile is the SDK's own declaration.

## Exit codes

- `0`: no case failed or fell short, and every case is accounted for
- `1`: a case failed or fell short, or the reconciliation found a problem
- `2`: usage or IO error

## Spec CI

The `reference-go-core` job in `.github/workflows/ci.yml` runs this runner with the SDK pinned to one commit and compares its `-json` results with the corpus's complete case set and with [`expected-failures.json`](expected-failures.json), whose failures, shortfalls, and omissions are keyed by case, pin, status, and signature (`scripts/check-runner-results.mjs`): an unexpected failure, shortfall, or omission, a status outside the four run categories, an expected failure or omission that is executed or not run, a changed signature, a missing, extra, or unexplained case, and a reconciliation problem all fail. The pin is the Go commit that adopts this text; a later Go commit reaches the job only by changing the pin and re-keying the expected results with it, in a spec change.
