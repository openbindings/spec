# Transform conformance reference corpus

Core [§5.5](../../openbindings.md#55-transforms) pins JSONata 2.1 with
jsonata-js 2.1.1 as its behavioral tiebreak, **subject to clause 7's numerical
latitude**. The prose is authoritative. These reference fixtures expose
regressions; neither fixtures nor an official SDK define additional Core rules.

Harnesses locate this directory beneath `OB_SPEC_CORPUS` (the conformance root).
The existing file shapes and case identifiers remain available to SDK harnesses.
Their adoption status must be checked at the implementation revision being
qualified; this corpus does not assert current shipping-engine readiness.

## `agree/` — pinned reference regression cases

Each case records the pinned reference outcome. Unchanged language semantics
remain a parity gate. A numerical departure is acceptable only when justified
by the evaluator's consistently specified, eligible clause 7 rules. An engine
cannot waive an arbitrary mismatch by naming a numeric library. The dedicated
[`numerical/`](numerical/README.md) scenarios make this distinction explicit.

## `known-divergence/` — recorded implementation observations

Each case records a reference outcome and an observed implementation outcome,
with a root-cause label. These are historical regression witnesses, not a claim
about every current engine or which production documents can reach a behavior.
Requalify them against the exact implementation snapshot under review.

The recorded differences concern singleton filtering, match-result shape,
wildcard flattening and regular-expression support. Numerical latitude does
not waive those unrelated language differences. A closed divergence should be
reverified and promoted to `agree/`; preserving a known defect is not a
conformance requirement.

## `numerical/` — bounded permission and invariant witnesses

Raw-JSON fixtures distinguish reference numerical behavior from an illustrative
exact-input/decimal-computation model. They also cover capacity rejection,
computed-value meaning, comparison consistency, syntax versus range, and fixed
language controls. The model labels are test descriptions, not OBI configuration
or a requirement that implementations support two modes.

CI validates both fixture schemas and runs the repository's structural and
numerical-contract verifiers. Those verifiers do not evaluate JSONata; actual
engine execution remains a separate harness responsibility. Full conformance
also requires behavior no finite corpus can establish, such as the absence of
all possible host-environment extensions.

General transform conformance does **not** establish the stronger official-SDK
value-fidelity promise. Exact JSON carriage, copy/identity preservation and
end-to-end invocation qualification require separate implementation tests;
they are not silently imposed on every conforming implementation by this corpus.
