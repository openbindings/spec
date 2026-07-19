# Transform differential-conformance corpus

JSONata transforms ([§5.5](../../openbindings.md#55-transforms)) are pinned to
**jsonata-js 2.1.1** as the normative behavioral tiebreak (OBI-D-18 /
[§5.5](../../openbindings.md#55-transforms)). This corpus is the cross-SDK
**parity gate**: it verifies that each SDK's transform engine reproduces that
normative output, and it catalogs the residual places where an implementation
engine deviates.

It is located via `OB_SPEC_CORPUS` (the conformance root); harnesses append the
`transforms` subpath. The TypeScript SDK evaluates with jsonata-js directly; the
Go path (ob) evaluates with **gnata** (a pure-Go JSONata 2.x engine), and this
corpus is how that engine is held to the normative one.

## `agree/` — the gate

Expressions that **every** conformant engine evaluates identically to
jsonata-js. Each case carries the normative `expected` outcome. Both SDK test
suites run these and assert a match:

- Go: `ob` runs them through its adopted engine (`internal/app`, the same
  `evalTransform` path invocation uses).
- TS: `@openbindings/sdk` runs them through jsonata-js.

A failure means an engine has drifted from the parity contract.

## `known-divergence/` — the catalog

The places the Go engine (gnata) deviates from normative jsonata-js **in ob's
actual pipeline**. Each case records both the normative `expected` and the
engine's `actual`, under a root-cause label. **None is reachable by any shipped
OB transform** (verified against ob's production transforms and the conformance
corpora). The catalog is regression-guarded: ob asserts each divergence still
holds, so a future engine change that *closes* one fails the test, prompting the
case to be re-verified and promoted to `agree/`.

The four residual root causes (gnata 0.2.x): `$filter` returning one match
yields `[x]` not `x`; `$match` returns `{match,start,end,groups}` where
jsonata-js returns `{match,index,groups}`; wildcard-over-array nests rather than
flattens; and RE2 (Go's `regexp`) rejects Perl lookahead/lookbehind/backreferences
that jsonata-js evaluates. (The big-integer-precision difference gnata shows on
raw bytes does **not** occur in ob — its pipeline rounds large integers to
float64 before the transform runs, so ob and jsonata-js agree.)

**The spec's normative requirement remains full jsonata-js.** This corpus
documents an implementation-engine residual, not a specification concession.
