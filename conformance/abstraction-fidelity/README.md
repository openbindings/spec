# Abstraction-alignment ledger

This directory tracks the project-wide application of the informative
[`ABSTRACTION-FIDELITY.md`](../../ABSTRACTION-FIDELITY.md) doctrine. It is an
engineering and governance aid, not a normative OpenBindings contract.

[`ledger.json`](ledger.json) records every known alignment question, its
narrowest owning layer, normative impact, disposition, and evidence. An item is
resolved only when the relevant prose and implementations agree and the
protocol-blind conformance gate exists. An honest unsupported-source exclusion
may resolve an item; undocumented approximation may not.

The ledger distinguishes a core document-model proposal from a core prose
clarification. A `core-model` entry cannot move to `in-progress` without an
explicit advance design decision. No current entry proposes a core document-
model change.

## Severity order

The next revolution selects the highest item in this order:

1. a core or interface contradiction with the abstraction boundary;
2. binding knowledge required by an ordinary caller;
3. protocol observations recompiled into an operation contract;
4. lost application values or interaction behavior;
5. excessive binding-specification or SDK policy;
6. implementation-only defects; and
7. additional source coverage.

Conceptual misalignment is never economically deferred. The affected behavior
is corrected, made explicitly diagnostic, or removed from the claimed support
range.

## Evidence rule

Native-client and scripted-peer comparisons prove concrete binding
correctness. Protocol-blind operation scenarios prove abstraction fidelity.
Neither substitutes for the other. A resolved family entry requires both when
the family performs a concrete interaction.
