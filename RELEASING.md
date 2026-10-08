# Releasing the OpenBindings specification

This repo uses **immutable snapshots** for released spec versions, and regular pull requests for improvements.

## Principles

- Released versions are **immutable**: once published under `versions/X.Y.Z/`, they should not change.
- Changes happen via PRs and are released as a **new version**.
- **A snapshot exists only for a tagged release.** The snapshot and the tag
  are cut together (workflow steps 2–3, one sitting); a `versions/X.Y.Z/`
  directory with no `vX.Y.Z` tag is a lie about what has shipped. The root
  documents are the working draft of the NEXT version, and `versions/`
  contains only what was actually released.
- **One version string, one text.** The moment the working draft would
  diverge breakingly from the latest released snapshot, the draft's
  self-declared version (the `openbindings.md` heading, the CHANGELOG
  section) must already be the next version. Two normative texts under one
  identifier would leave the declared version naming no single text, which
  is what it exists to name (§8.1).
- **Releases are dated by their tags.** Release tags are annotated
  (`git tag -a vX.Y.Z -m ...`; from 0.2.0 on — the v0.1.0 tag predates
  this convention and is lightweight). The CHANGELOG's in-progress
  section is headed `## X.Y.Z (working draft)`; at release it is
  retitled `## X.Y.Z — YYYY-MM-DD`, the date being the day the tag is
  created.

## What gets snapshotted

A release snapshot captures the normative core spec at the time of release:

- `openbindings.md` — the core specification
- `openbindings.schema.json` — the normative JSON Schema
- `EDITORS.md` — editors list
- `LICENSE` and `IPR.md` — the exact copyright and patent posture represented
  by the release
- `conformance/` — the **core** test corpus only: `document/`,
  `scenarios/`, both core fixture/scenario meta-schemas, the manifest,
  README, and core runner. Snapshotted because the corpus is keyed to the
  `OBI-##` rule identifiers and the sections of the snapshotted spec; a rule
  identifier means what the snapshotted spec says it means
  ([§10](openbindings.md#10-conformance)), so the corpus and spec must be
  reachable together at the snapshot version. (The 0.1.0 snapshot predates
  this corpus layout; its `conformance/` holds that era's three flat fixture
  files, and stays as released.)

**Not snapshotted:**

- The project's shared interfaces are **no longer in this repository** — they live in [openbindings/interfaces](https://github.com/openbindings/interfaces), independently versioned with location-based identity. They were never snapshotted with the core spec: copying a contract into a spec snapshot would create a second URL for the same contract, fragmenting identity.
- `binding-specs/` — binding specifications release on their own cadence and are cited by identifier, never by core release version. No project binding specification has been published yet: every current family document is a mutable first-`@1` candidate and `binding-specs/publications.json` is empty. A first publication will create an immutable, digest-recorded bundle under `binding-specs/releases/`, add it to that manifest, and serve it from its permanent revision URL. Core snapshots do not duplicate that independent archive. After publication, an incompatible change requires a new project kind identifier under [PB-03](binding-specs/PROJECT-POLICY.md#pb-03-published-meaning-and-revisions), which is project policy rather than a core conformance rule.
- The **non-core** conformance corpora: `conformance/binding-specs/` and `conformance/operation-graph/`. These are keyed to binding-specification identifiers, not to the core rule identifiers, so they follow what they test rather than the core release. Copy only the directories listed in step 2; taking `conformance/` wholesale would freeze corpora that are not the core spec's to freeze.
- `scripts/` — repo-wide tooling (canonical-order checker, manifest generator, corpus verifier). These operate on the current working tree and aren't part of any specific release.

## Workflow

1. Merge changes to the working copy

   - Ensure `openbindings.md` reflects what you intend to release.
   - Resolve the pre-release intellectual-property decision recorded in
     `IPR.md`, record only commitments that have actually been executed, and
     ensure every claimed assent has a durable record. Do not cut 0.2 while
     `IPR.md` still labels that decision outstanding.
   - Ensure any binding specifications under `binding-specs/` that ship with this change set are ready. They are not snapshotted, but a core release that cites a specification still being drafted publishes a dangling citation.
   - Run `node scripts/verify-binding-spec-publications.mjs`. Every binding-specification identifier cited as published must already be present in `binding-specs/publications.json`, with its immutable bundle and permanent URLs.
   - Regenerate `conformance/manifest.json` (`node scripts/generate-conformance-manifest.mjs`) and run `node scripts/verify-corpus.mjs` to confirm the corpus is in sync with the spec.
   - Confirm [release readiness](#release-readiness): every row is met, or
     the editors waive it with a reason. Record each row's final state, and
     any waiver, in the release's CHANGELOG entry.

2. Cut a release snapshot

   - Create a new directory: `versions/<next>/`
   - Copy the normative artifacts into it:
     - `openbindings.md` → `versions/<next>/openbindings.md`
     - `openbindings.schema.json` → `versions/<next>/openbindings.schema.json`
     - `EDITORS.md` → `versions/<next>/editors.md`
     - `LICENSE` → `versions/<next>/LICENSE`
     - `IPR.md` → `versions/<next>/IPR.md`
     - Core conformance artifacts → `versions/<next>/conformance/`:
       - `conformance/README.md`
       - `conformance/manifest.json`
       - `conformance/fixture.schema.json`
       - `conformance/scenario.schema.json`
       - `conformance/document/`
       - `conformance/scenarios/`
       - `conformance/runners/`
   - Update `versions/README.md` to include the new version.
   - (Optional) Use the helper script: `scripts/release.sh <next>`

3. Tag the release
   - Retitle the CHANGELOG's `## <next> (working draft)` section to
     `## <next> — YYYY-MM-DD`, dated to the tag.
   - Tag the repo with an annotated tag: `git tag -a v<next> -m ...`
     (e.g., `v0.1.1`), in the same sitting as step 2 — the snapshot must
     never exist untagged.

4. Open the next draft
   - Start a new top section in the CHANGELOG for the next version, headed
     `(working draft)`.
   - When the first breaking change lands, bump the draft's self-declared
     version in `openbindings.md` and the examples' `openbindings` fields.

## Release readiness

A release is judged by these rows, each met or not on evidence, rather than
by a grade. Every row is met before a release is tagged, unless the editors
waive it with a reason recorded in the release's CHANGELOG entry.

| Row | Met when |
|---|---|
| Scope | Every rule governs the OBI document, and the text specifies the document model only. The core defines no tool behavior, invocation, synthesis, discovery, or protocol interpretation; those belong to companion specifications and to the software that uses documents. |
| Tested rules | Every rule, and every section whose meaning the corpus can exercise, has fixtures or scenarios that tell a correct answer from a wrong one, shown by deliberately wrong implementations that CI runs against them. |
| Two implementations | Two implementations with separate code bases pass the whole core corpus at the release's revision. |
| Implementable from the text | Someone who has not worked on the specification builds a document validator from the text alone, and every disagreement between it and the corpus is resolved. |
| No open defects | No known contradiction, ambiguity, or error in the text is unresolved. |
| One vocabulary | The core's terms are used the same way across the core text, the conformance corpus, and the project's reference SDKs. |

Peer rankings are recorded beside the rows, not as one of them: reviewers
rank the core specification among successful interface-description
specifications (OpenAPI, AsyncAPI, Smithy, TypeSpec, GraphQL, Protocol
Buffers with gRPC, WSDL 2.0) on named criteria, and the release's CHANGELOG
entry states the result.

### Readiness of the 0.2.0 working draft (2026-10-08)

| Row | State |
|---|---|
| Scope | Met. |
| Tested rules | Not met. No deliberately wrong implementation is published or run in CI. |
| Two implementations | Not met: the Go SDK passes the corpus. The TypeScript SDK's runner reads the retired scenario format, and spec CI runs no TypeScript implementation on the core corpus. |
| Implementable from the text | Not met: no blind implementation run since the kind, pruning, and value-contract changes, and the restructure into a document model only. |
| No open defects | Not met: not yet triaged, each raised by one reviewer of the 2026-10-07 or 2026-10-08 ranking: what "the same input" is for objects and arrays in §5.3's idempotency; which bindings a dependency's `kinds` test applies to (§5.5); "an operation's name" in §5.1 beside its several identifiers; what OBI-12 says of a reference to a plain name declared twice; whether an operation's description is part of its contract; "contract" in three senses (§3); which releases §8.1's from-1.0 promise compares; a `$dynamicAnchor` in the document resource capturing `$dynamicRef`s inside `$id` resources, said only in §7.5; correspondence when a reader holds several contracts that publish a name (§5.1); the regular-expression dialect stated with Unicode semantics in §5.2 but not in OBI-02 and OBI-10; "display, logging" in §5.1; whether `description` text is plain or marked up; `$id` spellings that RFC 3986 §6 would equate (§7.4); the derived schema's `$id` shared by patch releases whose contents differ; whether a binding's target belongs to the described component. |
| One vocabulary | Met: §3 defines the described component, the text says reader where it said consumer and no longer says provider, §5.4 uses Source artifact, and §3 points to the terms defined in place; the Go SDK and the corpus use none of the replaced words. |

Peer ranking (2026-10-08, core text at 1ee84b2, three independent
reviewers): 2nd of 8 in all three, behind GraphQL and ahead of Smithy 2.0
(3rd in all three), Protocol Buffers with gRPC (4th in all three), OpenAPI
3.2, WSDL 2.0, AsyncAPI 3.1, and TypeSpec. First on scope discipline,
precision, and the conformance model; second on implementability; third on
evolution; fourth on economy; sixth on readability. On 2026-10-07 (text at
349e67b) it was also 2nd, fifth on economy and seventh on readability; on
2026-10-06 (one reviewer, text at 581382f) it was 3rd.

## Errata

Errors discovered in released snapshots are tracked via GitHub issues labeled `errata:<version>` and corrected in the next patch release. Released snapshots are never modified in place.
