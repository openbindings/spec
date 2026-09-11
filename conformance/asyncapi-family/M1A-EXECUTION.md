# M1a — independent empty-HTTP execution packet

Date: 2026-09-06. Status: implemented; execution checks passed; non-authoring
review and frozen acceptance pending. M0 and M1 are not marked complete.

## Contract and evidence

The starting normative authority remains the accepted AsyncAPI 3.1 C21 §5
candidate. No normative profile is expanded by this packet. Exact upstream
files were re-fetched and checked against the repository pin hashes; the HTTP
0.3.0 binding has SHA-256
`cd2dc18c4d2aeba10889129a16b0d5c12fa70ab82fb0594fc5e50cd55a86e995`.
POST/default-version choices and the closed empty-input profile are local pins,
not attributed to the upstream binding's unspecified method or latest version.

The packet adds:

1. A 120-cell machine-readable register: 108 required behavior cells and 12
   explicit exclusion cells across 3.1, 3.0 and 2.6. The denominator,
   applicability and dependencies are independently hash-locked. The generated
   table cannot drift from the register. Historical C21 acceptance is retained
   separately, not promoted to whole-family independent acceptance.
2. A selective primary runner for 175 existing C21 processor/synthesis cases.
   The full orchestration remains unchanged when invoked normally.
3. A separately written Go processor/synthesizer plus a real loopback TCP peer.
   Forty-five literal wire cases cover defaults, path byte preservation,
   profile and contract refusals, body/framing outcomes, no redirect/retry,
   local aliases, exact edition and five cancellation boundaries.
4. Two independently stated complete synthesis expectations and 21 existing
   synthesis cases for alias provenance, membership, mixed profiles, empty
   inventories, Unicode identities, absent outputs/transforms and no ghosts.
5. Four genuine semantic mutations, plus register deletion/duplicate/premature
   acceptance/dependency/disposition integrity checks. Wire case identities
   and counts are also locked against deletion and duplication.

Existing C21 corpus expectations predate this witness. New literal wire
fixtures were written after the initial Go draft, from the normative prose and
without exporting implementation outcomes. That ordering does not satisfy the
loop's preferred expectation-before-evaluator discipline for new packets;
non-authoring expectation review is explicitly required before acceptance.
Future feature packets must commit their expected examples before evaluator
changes rather than repeating this sequencing deviation.

## Source correction and scope disposition

M0 reinspection found and corrected the inherited architecture's false claim
that AsyncAPI 2.6 requires Message `payload`. See ED-01. The correction changes
planned 2.6 semantics, not the accepted 3.1 candidate. ED-08 also records the
need for an edition-specific 2.6 trait ruling instead of copying 3.1 behavior.

MQTT5 and reduced Kafka retain explicit revision-one exclusions, consistent
with their existing non-admission and the required-profile matrix. This does
not shrink any required HTTP/HTTPS, WS/WSS or MQTT311/MQTTS cell. Exclusion
ownership/refusal/coverage evidence and review remain open; a recorded scope
decision alone is not completion. Reopening requires the precise authority
and lifecycle packages stated in the register, not merely a driver.

## Executed gates

- Full binding-specification verifier: 395 D tests, 1,218 processor scenarios,
  269/269 targeted P-rules, 270 synthesis scenarios; exit 0.
- Focused primary semantics: 175 cases; exit 0.
- Clean-cache expanded replay: 45 real-wire cases, represented/excluded
  synthesis pair, 21 existing synthesis cases and four semantic mutants;
  exit 0. The frozen snapshot is recorded in the execution checkpoint outside
  this mutable worktree.
- Publication verification: zero published revisions/bundles; exit 0.
- Publication lifecycle/tamper checks, release snapshot layout and Core corpus
  verification: exit 0.
- Completion register and `git diff --check`: exit 0.

These are execution results, not two-reader acceptance. See README for the
finite-peer, source-carriage, parsing and cancellation limits. No commit,
push, publication or production network action was performed.

## Next bounded work

After non-authoring review, M1b closes independent source/owner/reference
coverage and open-connection lifecycle semantics. Its packet must include
expected results first, explicit capability boundaries, lossless carriage,
real cancellation barriers and exact S05/S06/S07 confinement. M0 still needs
the detailed clause/evidence links for later feature packets and the final
edition-trait ruling. M2 cannot be called complete merely because the old
empty HTTP profile remains green.
