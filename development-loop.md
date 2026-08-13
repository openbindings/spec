# The OpenBindings Development Loop

*How OpenBindings decides what to widen, proves the widening faithful, and never trades honesty for coverage.*

This document is the project's development process and, once public, its governance story: anyone should be able to read it and predict what the project will do next and why. It is designed to be run by a small team (today: one person plus agents) at a cadence of one revolution at a time.

## The objective, with its constraint

Maximize the fraction of real-world, conventional artifacts — per binding family — whose operations synthesize, inspect, and invoke faithfully. Subject to one hard constraint: **coverage is gained only by faithful means.** Every widening of an OpenBindings project binding specification goes through the project's chosen deference order (incorporate → preserve → configure → refuse → default). A widening that buys coverage through an unlabeled convention, a private implementation guess presented as portable meaning, or a default that erases a genuine upstream choice is a regression, even when the measured percentage goes up. Core permits other publishers to define different authority relationships; this loop states the quality policy for `openbindings.*` specifications.

Here, _faithfully_ means fidelity to the protocol-independent operation
boundary defined by the informative
[`ABSTRACTION-FIDELITY.md`](ABSTRACTION-FIDELITY.md), not observational
equivalence with a native client. The concrete binding must perform the real
interaction correctly, but the ordinary caller must not need the selected
protocol's statuses, headers, trailers, frames, or wire bytes. Native facts
may be consumed or retained below the abstract bridge by artifact runtimes,
logs, traces, and protocol tooling; the project invocation interfaces do not
carry them, and they do not become operation fields merely so that no native
observation is lost.

Corollary: **refusal is per-unit and evidenced, never silent and never wider than the unit that earned it.** A source-level defect refuses the source; an operation-level limit excludes the operation with a durable, rule-identified coverage entry. One unrepresentable operation never vetoes its representable siblings. (This was the loop's first fix: rev 0 below.)

## The flywheel

```
   ┌─────────────────────────────────────────────────────────────┐
   │                                                             │
   │   MEASURE ──────► RANK ──────► GATE ──────► WIDEN ──────►   │
   │      ▲            (corpus      (faithful-    (spec text,    │
   │      │            histogram    ness adjudi-  both SDKs,     │
   │      │            picks the    cation with   fixtures,      │
   │      │            target)      paper trail)  scenarios)     │
   │      │                                          │           │
   │      └────────────── VERIFY ◄───────────────────┘           │
   │                      (re-run corpus; regression             │
   │                       scenarios; parity check)              │
   └─────────────────────────────────────────────────────────────┘
```

Each revolution moves exactly one gap through all five stations. Revolutions are cheap by design — the machinery below is built once and reused across families.

### 1. Measure

The **corpus harness** runs coverage synthesis over a directory of real-world artifacts and emits *refusal telemetry*: per-artifact JSONL records plus an aggregate histogram keyed by **stable reason codes and binding-spec rule IDs**. The aggregate — not intuition — is the prioritization function.

- One harness, per-family **adapters** keyed by binding-spec identifier. Adding a family = adding an adapter.
- Telemetry schema is family-independent: `{artifact, family, outcome, targets, represented, exclusions:[{ref, reasonCode, rule}]}`.
- **No silent caps.** Every bound the harness applies (size deferral, sampling stride, parse failure) is its own counted disposition in the aggregate. A number that silently omitted the hard cases is worse than no number.
- Corpora are versioned and their provenance recorded (source, vintage, known biases). A corpus that can't answer a question — e.g., a pre-converted OpenAPI 3 mirror can't measure Swagger 2 prevalence — says so in the report rather than implying the answer is zero.

### 2. Rank

Sort the histogram by **artifacts unblocked per unit of work**, not raw exclusion count. A reason code that excludes 40 operations spread across 35 artifacts outranks one that excludes 200 operations inside 3 machine-generated monsters. Prevalence claims made without a measurement are labeled **hypothesis** and never justify a widening by themselves.

### 3. Gate

Before any widening ships, it passes the **faithfulness gate** — an adversarial adjudication recorded in the conformance corpus's adjudication log:

1. **What does the upstream's own specification say?** The widening must incorporate upstream semantics, not approximate them.
2. **Is a genuine choice being decided?** If the artifact declares alternatives and the caller must pick, the widening adds a *configuration point*, never a default.
3. **Would the widening ever emit something the artifact doesn't mean?** If yes, refuse — at the smallest honest unit.
4. **Is the proposed observation part of the abstract operation contract?**
   Application values and behavior cross the operation boundary; raw protocol
   evidence does not become an operation field or required caller input.
5. **Can a caller use the result without knowing the selected binding?** A
   widening that recompiles protocol concepts into a nominally abstract schema
   fails this gate.
6. **Does correct use depend on native evidence?** If so, the abstraction or
   binding interpretation remains incomplete; the abstract invoker surface
   has no diagnostic escape lane.
7. **Does the coverage vocabulary account for whatever remains excluded?** Partiality is fine; unaccounted partiality is not.

The gate's output is an adjudication record: scenarios affected, governing rules, what changed, what supersedes what. Superseded adjudications stay in the log — the paper trail is the point. (Example: BS-A-20260728-01 re-adjudicated OAPI-SS-03 from whole-source refusal to sound-partial synthesis, superseding BS-A-20260723-01 for that scenario, on the authority of the binding spec's own "narrows coverage" resolution.)

### 4. Widen

A widening lands as one changeset with four mandatory forms of evidence:

- **An ownership decision** identifying whether the gap is doctrine,
  binding-specification, synthesis, invoker, or SDK debt. Normative text
  changes only when the owning contract is actually incomplete or wrong; a
  code defect does not earn a specification feature. Any proposed core
  document-model change is reviewed explicitly before implementation;
- **Both SDKs** — TS and Go move together. Parity is an invariant, enforced by the shared portable scenario corpus, and any intentional divergence is itself a tracked gap;
- **Portable scenarios** — at least one new synthesis/invocation scenario in the shared conformance corpus exercising the widening, so every future implementation inherits the abstract-operation proof;
- **SDK-local tests** for surface behavior the portable format can't express (e.g., strict-surface refusal).

Only the layers that own the gap change. Raw native comparators may accompany
the changeset to prove concrete request construction and response
interpretation, but they are implementation or diagnostic evidence rather
than new operation-surface requirements.

### 5. Verify

- Re-run the corpus. The widening's reason code should shrink or vanish; nothing else should grow. A regression elsewhere fails the revolution.
- Full test suites in both SDKs, including the portable scenario runners.
- Run protocol-blind operation differentials: the comparison observes only
  application values and lifecycle behavior available without binding
  knowledge. Run native differentials separately where the implementation
  needs a lower-layer oracle.
- The re-measured histogram becomes the input to the next revolution's Rank.

## Surface doctrine (what tolerance never touches)

Two synthesis surfaces, permanently distinct:

| Surface | Posture | Rationale |
|---|---|---|
| `synthesizeInterface` (strict) | Whole-source refusal on any unrealizable target | The convenient surface must never return a silently partial interface |
| `synthesizeInterfaceWithCoverage` + `inspectSource` (evidenced) | Per-operation tolerance; sound partial OBI; every omission an `excluded` coverage entry with reason code + rule | Partiality with evidence is the contract's design; this is what indexes and tooling consume |

Invariant 2 stands: selection, retry, credential policy stay out of the standard. GraphQL selection-set generation (and any synthesized default that decides a caller's choice) stays out of normative binding semantics — opt-in consumer convenience at most.

## Family cadence

OpenAPI runs first — it has the corpus, the confirmed findings, and (hypothesis) the mass. But every revolution's machinery lands family-agnostic, and each family gets its own measure → rank pass as corpora are acquired:

| Family | Corpus source (candidate) | First measurement question |
|---|---|---|
| openapi | APIs.guru mirror (done, rev 1) | Which depth gap excludes the most artifacts? |
| asyncapi | GitHub search / AsyncAPI examples registry | 2.x vs 3.0 prevalence; protocol distribution |
| graphql | Public schema registries, introspection corpus | Multi-root prevalence; document availability |
| grpc | Buf Schema Registry public modules | Reflection availability vs descriptor availability |
| mcp | Public MCP server registries | stdio vs Streamable-HTTP distribution |
| connect | Buf registry (Connect services) | Codec/protocol distribution |
| usage | Homebrew/man-page corpus | Construct frequency beyond the flat surface |

A family whose corpus contradicts a spec exclusion gets a Rank entry like any other gap; the gate then decides whether the widening is faithful or the exclusion stands.

`openbindings.operation-graph@1` is deliberately outside this standalone
artifact-synthesis table. A graph composes operations already declared by its
containing OBI and does not carry independent application contracts from which
a new interface could be synthesized. Its development loop is the portable
identity-law and execution corpus: direct and graph-wrapped invocation must
remain observationally identical at the abstract operation boundary. If a
future graph edition carries an independently authored operation contract,
that new source capability would reopen the synthesis decision; current tools
must not present a locally invented contract as portable synthesis under the
current identifier.

## Revolution log

| Rev | Date | Station output |
|---|---|---|
| 0 | 2026-07-28 | **Tolerance bootstrap.** Coverage + inspection surfaces made per-operation tolerant in both SDKs (strict unchanged). OAPI-SS-03 re-adjudicated (BS-A-20260728-01). Unblocks: telemetry was censored — one bad operation hid every good one from measurement. |
| 1 | 2026-07-28 | **First measured OpenAPI corpus.** APIs.guru mirror (Oct 2025 vintage, pre-converted to OAS 3.x — cannot measure Swagger 2 prevalence). 958 of 2,639 artifacts (deterministic stride 3). Measured: 89.8% synthesize; 95.7% of in-scope operations represented; **12.6% of loadable documents were pre-rev-0 whole-document refusals** — each excluded operation had been vetoing 8.2 representable ones. Histogram in `corpus/aggregate.json`. |
| 2a | 2026-07-28 | **Cyclic-graph synthesis, both SDKs.** Recursive components emit as `$defs`/`$ref` (same-document pointers from the OBI root, OBI-D-16-resolvable) — JSON Schema's own recursion mechanism; incorporation, not invention. Identity-level SCC detection (sibling-merged `$ref` copies break name-level detection); position-aware hoisting (a reference only means "reference" at a schema position); redundant double interface-validation removed from the coverage surface. Verified: **82 of 85 previously-lost artifacts recover**; 1 refusal now correctly surfaces a genuine upstream defect (OAS `examples` map inside 2020-12 schemas) the crash had masked; 2 remain resource-capped (validator path-explosion — rev 2b); 25/25 control artifacts byte-identical to rev 1. |
| 2b | — | **Selected by rev 1's histogram + 2a's residual:** (a) interface-validation path explosion on deep shared-component documents (the remaining resource-capped tail; probable fix is bundling all shared components as `$defs`, which changes emitted schema shape — a gate question); (b) flattening collisions (OAPI-P-03: 669 operations / 89 artifacts, 55% of them amazonaws) — the laned-envelope question goes to the gate with real numbers; (c) required-body conditional schemas (OAPI-P-04: 105 operations / ~26 artifacts) — smaller than every pre-corpus estimate assumed; (d) a portable scenario for sibling-merged recursive `$ref`s, where TS and Go emission is semantically equal but not yet fixture-pinned byte-identical. |

## Termination: the measured-complete state

The loop does not run forever, and it does not run to 100%. Perfection on this axiom is not "no refusals" — some refusals *are* the axiom when no responsible, explicit, reusable binding-specification convention can close the gap. Perfection is **no unchosen refusals**: the distance between measured coverage and 100% consists entirely of decisions with paper trails, each of which we would defend in public, each with a condition that would reopen it.

A family reaches **measured-complete** when all five hold:

- **MC1 — Zero unadjudicated exclusions.** Every reason code appearing in the family's residual maps to a logged adjudication classifying it as exactly one of:
  - *doctrine-refused* — representing it would require an unwarranted or fidelity-damaging project convention; permanent by design until that judgment changes (e.g., `openapi.reverse_direction`);
  - *upstream-defective* — the artifact violates its own upstream specification; not this project's gap;
  - *economically deferred* — a faithful widening exists, but measured prevalence is below the floor; the adjudication records the measured number and the **revisit trigger** that reopens it.
  A reason code in the histogram with no adjudication is an open work item, by definition, regardless of its count.
- **MC2 — Implementation losses at zero.** `implementation-unsupported` entries, resource caps at reasonable bounds, and load failures on upstream-valid artifacts are never acceptable residual: they are not principled refusals, and no adjudication can launder them. The only artifacts allowed to fail loading are upstream-invalid ones.
- **MC3 — Marginal yield below floor.** The top-ranked unadjudicated gap would unblock less than **δ = 0.5%** of corpus artifacts, for **K = 2** consecutive revolutions (loop-until-dry, not count-until-N). Pre-launch these constants are ours to tune; they are recorded here so changing them is a visible act.
- **MC4 — Faithfulness verified, not assumed.** Every widening since baseline carries invocation-level conformance evidence: portable scenarios plus a protocol-blind operation comparison against a reference server, with native-client comparison used as a lower-layer oracle where needed. The strict and tolerant surfaces agree exactly on the represented/excluded partition. Synthesis success or raw-protocol equality alone never counts as operation fidelity.
- **MC5 — Stable across two corpus vintages.** Two consecutive corpus refreshes produce no new reason codes and no regrowth of an adjudicated category beyond sampling noise.

Measured-complete is a **steady state, not an ending**. The family enters maintenance, and exactly four events reopen its loop: (1) a corpus refresh surfaces a new reason code; (2) the upstream specification revises; (3) an economically-deferred item crosses its recorded revisit trigger; (4) a field report contradicts the coverage evidence. Between those events, running the loop harder buys nothing — that is what termination means.

Status against these criteria is computed, not asserted: the harness's `status` tool diffs the aggregate's observed reason codes against the adjudicated-codes registry and prints the MC checklist per family. (As of rev 1, OpenAPI fails MC1 — collisions and conditional bodies are unadjudicated — and MC2, with 8.9% implementation-attributable load failures. That is the honest distance-to-done.)

## Anti-goals

- **No coverage theater.** Percentages without a corpus, prevalence claims without a measurement, and caps without a counter are all the same defect: unearned confidence.
- **No doctrine erosion under coverage pressure.** The gate exists because "one more small default" is how universal API layers have historically rotted.
- **No protocol recompilation.** A native status, header, trailer, frame, or
  wire representation does not become an output-schema variant just to keep
  it visible.
- **No native evidence on the abstract invocation.** Raw binding evidence may
  support debugging and conformance below the bridge, but ordinary application
  behavior never receives or depends on it.
- **No specification growth for implementation convenience.** Add only the
  minimum semantics needed to act faithfully; fix code in code.
- **No fifth surface.** Tolerance lives in the evidenced surfaces; strictness lives in the strict one. New use cases pick one; they don't get a new posture.
- **No lockstep stall.** OpenAPI running ahead is fine; a family is never blocked on another family's revolution — only on its own corpus.
