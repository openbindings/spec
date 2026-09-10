# Transform evidence and semantic conformance

Core [§5.5](../../openbindings.md#55-transforms) incorporates the documented
JSONata 2.1 language. Core prose and those incorporated semantics govern
conformance; neither a runtime nor these fixtures adds requirements.

This is the Core binding-transform corpus. Operation Graph independently pins
its graph-expression evaluator; its binding specification and execution corpus
are not changed by this Core authority adjustment.

## Authority-linked semantic cases

[`language/scenarios.json`](language/scenarios.json) ties each expected result
to a documented language requirement or the OpenBindings integration boundary.
Inputs and results are JSON text so loading the fixture does not itself round
numbers. `failure` includes undefined, non-JSON results and evaluation errors
at the OpenBindings boundary; it does not prescribe error codes or messages.

LANG-22 deliberately compares an untouched copied value with its original
inside the expression. It does not require an exact numeric representation.
The 2.1.1 reference fails this witness because its copy path rounds through
string formatting. A reference mismatch is not automatically a defect in
another evaluator, and a reference result cannot override documented meaning.

`node scripts/verify-transform-authority.mjs` checks structure, authority links,
IDs and the separation of normative text from implementation policy. It does
not execute an evaluator. An evaluator harness executes the cases and applies
the OpenBindings result/environment boundary. Passing this finite set is not
whole-language or closed-environment certification.

## Historical implementation observations

`agree/` and `known-divergence/` retain their file shapes, IDs and recorded
outcomes for existing SDK harnesses. `expectedEngine` records provenance,
not normative authority. These files are a historical compatibility lane,
not a general conformance oracle or a statement about currently shipped SDKs.

Review a mismatch against its governing language rule. A documented semantic
violation remains a defect; a difference solely in an unspecified detail is
not made nonconformant by the reference observation. Existing SDK harnesses may
continue to use stricter parity gates as their own qualification policy.
Do not silently reinterpret those harnesses as complete language conformance.

Official-library numerical fidelity, precision choices and cross-SDK agreement
are implementation qualification concerns, separate from this corpus.
