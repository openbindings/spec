# Numerical-latitude scenarios

These reference scenarios exercise Core §5.5 clause 7 and its boundary with
OBI-D-18 and OBI-T-10. **Core prose, not this corpus or an SDK, is authoritative.**
No finite scenario set certifies a complete evaluator.

## Read the columns as whole-model witnesses

`reference` means the pinned jsonata-js 2.1.1 numerical behavior, with input
JSON text decoded as native JavaScript numbers. `exact34` is an illustrative
alternative for the operations exercised here: finite-decimal inputs, decimal
literals and numeric strings retain their exact mathematical values; comparison,
addition, subtraction and multiplication are exact; terminating division is
exact; nonterminating division rounds once to 34 significant decimal digits,
nearest with ties to an even significand. The computed decimal, not a hidden
rational quotient, is then the value. All remaining exercised language rules
are pinned. The witness supports the magnitudes in this file (through `1e616`
and `1e-400`). It does not specify a complete evaluator or the official SDK.

These labels are **test witnesses, not required implementation modes**. An
implementation with different eligible rules derives its expected outcomes
from those rules and Core. It cannot pick a column separately for each test.
The 34-digit example is not a conformance minimum or a runtime configuration.

`inputJSON` and successful `json` outcomes carry JSON **text** so a harness does
not round fixture numbers while loading the outer fixture. Error text/codes
are not fixed here. `failure` includes undefined and non-JSON results under
clause 4; `null` remains a successful JSON value. For syntactically invalid
expressions evaluation, if attempted, fails, but the document verdict is also
invalid. A supported grammar with an unsupported literal magnitude has a valid
document verdict and may have an evaluation failure. `$eval`'s inner syntax
is checked when that function is evaluated, not by OBI-D-18 on the outer text.

`capacity` rows test rounded radix contexts, not whole evaluators. Their
minimum/maximum magnitudes and underflow step are exact decimal quantities;
the two `binary64-*` tokens denote the exact endpoints stated in Core. A
capacity pass alone is insufficient: operators, rounding, comparisons and all
other language rules still have to conform. In particular a finite context
may round a longer number on `+ 0` consistently with general conformance while
failing a publisher's stronger unchanged-value preservation policy.

## Invariants and rejected shortcuts

- Equal assigned numeric values compare equally regardless of origin. Comparison
  cannot re-round exact operands just because one operand uses a native carrier.
  Numeric equality is reflexive, symmetric and transitive; ordering is coherent
  with equality. The same relation is used in deep equality, membership,
  distinctness, sorting, minima and maxima where JSONata compares numbers.
- A rounded quotient is compared as the assigned rounded result. It cannot
  compare equal to its decimal value in one place and to the pre-rounding
  rational in another.
- Higher capacity is not permission for `2 + 2 = 5`, altered explicit rounding,
  string display rules, singleton/sequence behavior, a visible object carrier,
  undefined becoming null, or a custom host function.
- Underflow/range differences and their dependent branches are allowed only
  under an eligible, consistently applied numerical model. Saturating overflow
  to a finite maximum is not a newly permitted arithmetic policy.
- Merely ignoring a pinned parser's S0102 does not verify syntax: `1e400 +`
  remains invalid. No language extensions, document fields or custom functions
  are introduced.

## Running checks

`node scripts/verify-transform-numerical.mjs` checks corpus integrity, capacity
arithmetic and independent relation-law witnesses, including deliberate bad
models. It **does not execute JSONata**. CI also validates the fixture schema.
Evaluator harnesses must run the expressions separately and state their numeric
rules before interpreting model-sensitive outcomes. The existing `agree/`
corpus remains a regression gate for unchanged language semantics; it is not
permission to waive non-numeric divergences.

General conformance and official-SDK fidelity qualification are different claims.
Passing these scenarios does not establish exact JSON carriage, schema/identity
fidelity, all standard-library arithmetic, packaging, browser support, or
end-to-end invocation readiness.
