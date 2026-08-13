# Conformance evidence policy

This policy separates the conformance content the OpenBindings project
publishes from the qualification evidence it develops against but does not
redistribute. It exists so the two are never intermingled: published
repositories must remain fully self-contained and fully project-owned, while
third-party artifacts gathered from the wild stay local to the qualification
environment that consumed them.

## Two classes of evidence

**Published conformance content** is authored by this project to test the
normative statements of OpenBindings Core, the project invocation interfaces,
and the project's binding-specification candidates. Every fixture, scenario
source document, expected result, authority matrix, and semantic-cell
definition in this tree is written by the project, traceable to a normative
rule or specification section, and licensed under the project license. A
scenario may embed a minimal source document in an upstream format (an
OpenAPI, AsyncAPI, GraphQL, or other family document) when the project
authored that document itself; authoring a document in a format does not
appropriate the format.

**The local qualification corpus** is a separate, machine-local collection of
independently sourced third-party artifacts (and the evaluation reports
derived from them) used to detect overfitting, measure cross-SDK parity, and
find counterexamples in the wild. It is not part of any repository, is never
redistributed, and is never cited by tracked files as a resolvable path. Two
properties make this mandatory rather than merely convenient: the artifacts
are other parties' documents under their own licenses, and the per-artifact
evaluation reports embed content derived from those documents (synthesized
OBIs carry source descriptions and schemas), making the reports derivative
works of the corpus.

## What may be published

1. Authored conformance scenarios, fixtures, schemas, and runners in this
   tree.
2. Authority matrices and semantic-cell definitions. These are derived from
   upstream *specifications* — analysis the project performed — not from any
   third-party document.
3. Distilled qualification reports authored by the project, provided they
   contain the project's own analysis, aggregate counts, and rule
   conclusions, and embed no third-party document content.
4. Release-evidence summaries whose entries are cell assignments and
   evidence pointers into the project's own repositories.
5. Corpus **claims**: artifact counts, owner counts, cohort splits, parity
   percentages — always phrased as results against an internal qualification
   corpus, never as pointers to files a reader cannot reach.
6. Cohort **seal commitments**: the SHA-256 seal of a holdout cohort,
   published at qualification time. The seal makes a sealed-holdout claim
   tamper-evident without disclosing the cohort. If a sealed cohort is later
   consulted during development, that disclosure is recorded in the distilled
   report and a fresh sealed cohort is required for future release claims.

## What is not published

1. Third-party artifacts fetched from the wild, in original or lightly
   transformed form.
2. Per-artifact evaluation reports, reference closures, and any other output
   embedding content derived from third-party documents.
3. Corpus acquisition manifests identifying the collected repositories. The
   items are citations (`repository`, `commit`, `path`, `contentSha256`) and
   contain no third-party bytes, but the project currently keeps the curated
   index private. Publishing a manifest is permitted by this policy if the
   project later chooses to; publishing the artifacts themselves is not.

## The bridge between the two

The corpus influences published content through exactly two mechanisms:

**Distillation.** When a wild artifact exposes a defect or an unhandled
semantic cell, the project authors a minimal fixture expressing that cell
from the governing authority's rules — never by copying the triggering
document — and adds it to the published suite. Corpus frequency is evidence
that a cell matters; it is never specification authority.

**Commitment.** Qualification claims in published documents carry the
cohort seal hashes and counts. Anyone auditing the project can demand the
sealed manifest match its published seal; nothing else about the corpus needs
to be public for the claim to be falsifiable.

## Scope of certification

Published conformance content certifies conformance to OpenBindings Core,
the project invocation interfaces, and `openbindings.*` binding-specification
candidates only. Nothing in this tree tests, certifies, or claims authority
over conformance to OpenAPI, AsyncAPI, gRPC, GraphQL, or any other upstream
family; those families are owned by their own authorities, and the corpus
work must never be presented as an upstream conformance program.

## Citation rules for tracked files

- No tracked file may reference the local qualification lab by filesystem
  path.
- Qualification numbers in tracked documents must identify the corpus as
  internal and non-redistributed, and should carry or link the relevant
  cohort seals.
- Evidence lists in conformance ledgers may point only at files tracked in
  the project's repositories.

## Published cohort seals

| Cohort | Sealed | SHA-256 |
| --- | --- | --- |
| AsyncAPI 63-of-250 holdout | 2026-08-10 | `ad9a78e13914a343f1e7dc37a7de22b749e0fbbbceba1995b17a83c59663a3da` |
| OpenAPI fresh holdout 1 | 2026-08-09 | `b9c168ff9c81008a7f47086ead5e14030bd154e356bae224942ab0176a22a6a4` |
| OpenAPI fresh holdout 2 | 2026-08-09 | `9ddba505f83ba19f534996d915f3dd25bdf0683eecb7fa1b9f62979b065fd153` |
| OpenAPI fresh holdout 3 | 2026-08-09 | `95c04c900686c3d52d46fc856bea883b2e38d5ddb035409c9242b47b0b881a46` |

The AsyncAPI holdout's disclosure during the WebSocket reply loop is recorded
in [`abstraction-fidelity/ASYNCAPI-FIDELITY.md`](abstraction-fidelity/ASYNCAPI-FIDELITY.md);
per that record, a future AsyncAPI release claim requires a fresh sealed
cohort.
