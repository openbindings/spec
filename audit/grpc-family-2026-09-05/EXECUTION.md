# gRPC binding-family execution record

This directory records the development and review loop for the first
OpenBindings gRPC binding specification. It is evidence about the work; the
binding specification remains the normative source.

## Objective

Produce one publication-quality `openbindings.grpc@1` candidate that is
action-complete under OpenBindings Core 0.2.0, covers unary,
server-streaming, client-streaming, and bidirectional RPCs, and can be
implemented independently in Go and TypeScript without private conventions.
Core 0.2.0 is itself still an unpublished candidate. Accordingly, this work
may create an exact `candidate-review` stage and executable evidence, but it
MUST NOT create a mint-eligible stage or publish gRPC until Core 0.2.0 has its
own immutable release snapshot and annotated release tag.

The work also defines the reusable Protobuf correspondence boundary needed by
gRPC and Connect. That boundary is not itself a binding specification: it has
no live target, transport, interaction lifecycle, or outcome classification.

## Working snapshot

- Worktree: `/Users/matt/Code/ob-pj/worktrees/grpc-binding-family`
- Branch: `codex/grpc-binding-family`
- Baseline commit: `c5cbec60a739d26ff1bbc3ea9e8cf7fd8eaf25af`
- Baseline source: `origin/release/0.2`
- Baseline complete tracked-plus-untracked SHA-256:
  `df6e7b637cc18b09f7ec945841b7ba3c13b9bd6b6dd61ce5da4c8de3f05b99d9`
  over 226 non-release files under the canonical publication snapshot
  algorithm. The earlier diff-only empty digest was discarded because it did
  not authenticate the tracked baseline bytes.

The active AsyncAPI worktree is outside this execution boundary and MUST NOT
be edited here. Moving AsyncAPI bytes are not publisher precedent. Only an
exact, independently accepted AsyncAPI snapshot may be used at the later
publisher-coherence gate.

## Baseline gates

The clean baseline passed:

- `node scripts/verify-binding-specs.mjs`: 242 source tests, 981 processor
  scenarios, 256/256 P rules, and 196 synthesis scenarios.
- `node scripts/verify-binding-spec-publications.mjs`.
- `node scripts/test-binding-spec-publication-lifecycle.mjs`.
- `node scripts/count-binding-spec-scenarios.mjs`.
- `node scripts/verify-release-snapshot.mjs`.
- `node scripts/verify-design-assets.mjs`.
- `node --check scripts/verify-binding-specs.mjs`.
- all 57 binding-specification JSON files parsed.
- `git diff --check`.
- `node scripts/verify-authority-pins.mjs`: 100 exact authorities OK, 0 moved,
  0 unreachable, and both citation-completeness directions green.

## Sealed development loop

Every semantic batch follows the same inner loop:

1. record HEAD and a complete tracked-plus-untracked snapshot digest;
2. read the exact cached upstream authority bytes;
3. encode a portable counterexample before the repair;
4. update prose, atomic rules, scenarios, schemas, verifier logic, and
   registers as one bounded change;
5. run focused checks and the complete gate set;
6. freeze the resulting bytes;
7. obtain independent authority, conformance-attacker, and publisher-voice
   reviews without editing the frozen snapshot;
8. accept only if all readers review the same final digest and report no
   unresolved P0-P2; fix or explicitly adjudicate every P3.

Any change after a seal reopens the affected gate. Counts and nominal green
tests are never a substitute for mutation-discriminating evidence.

## Phase ledger

| phase | state | seal |
| --- | --- | --- |
| baseline isolation and qualification | complete | baseline digest above |
| salvage inventory | complete | `SALVAGE-INVENTORY.md` |
| authority graph and version topology | implemented; replacement cold review pending | 120/120 exact authority gate |
| Protobuf correspondence | implemented; replacement cold review pending | module `@1`, exact protoc 36.1, a 47-case C++ oracle with 106 derived runtime checks, and 188-case Go/TypeScript value witnesses plus a 525-pattern binary32 grid |
| native gRPC architecture | implemented; replacement cold review pending | all four cardinalities and complete protocol lifecycle |
| portable conformance apparatus | implemented; replacement cold review pending | trusted 82-file apparatus root in main verifier |
| atomic D/P/S vertical slices | implemented; replacement cold review pending | 48 D tests, 163 P scenarios, 19 S scenarios |
| publisher coherence | implemented; replacement candidate-review stage pending | byte-preserving candidate/released-Core lifecycle, executable evidence, and revision-keyed immutable module closure |
| Go/TypeScript independent implementability | implemented; replacement cold review pending | equivalent 163-scenario structural and semantic results plus live stacks |
| final publication stopping gate | pending | — |

## Implemented gate checkpoint

- binding verifier: 256 definition tests, 1133 processor scenarios with
  268/268 targeted P-rules, 177 gRPC boundary mutants, 30 invocation-fidelity
  scenarios, and 210 synthesis scenarios; gRPC apparatus root
  `8e7d5e4f3aeed14a16a61822d93d72c7e8b3eaedc58e29ae8f2f42179781dad5`
  seals 82 closure files;
- manifest aggregates are independently derived from the specification,
  processor corpus, and boundary matrix before staging, with deletion and
  substitution checks for all ten aggregate fields;
- gRPC corpus: 48 definition tests, 163 revision-7 processor scenarios, 19
  revision-7 synthesis scenarios, and 177 boundary mutations;
- Go/TypeScript structural and semantic agreement: 163 scenarios, 19 actions,
  1074 peer DATA bytes, 38 semantic outputs, and 163 terminals over corpus
  SHA-256
  `cb31d8b74f089b94d42a1eaaba664a1225af07073f878e7dc0da80a9f378f853`;
- exact protoc 36.1 witness: 7 accepted and 6 refused compiler/profile cases,
  corpus SHA-256
  `ba39c4bef7537bedb6e354d77e14221d4281b16c64205550dab4d048c5133e25`;
- Protobuf value/schema correspondence: 188 Go/TypeScript cases and a
  525-pattern binary32 differential grid over corpus
  SHA-256
  `2b1dae755e41711fedf2edcd14cf0971b96945af7e490729c7e5b6ed10ac201e`,
  including open-enum unknown integers and Edition 2026 custom JSON enum
  input/output strings;
- exact Protobuf 36.1 C++ oracle: 47 cases (42 accepted and 5 refused),
  manifest SHA-256
  `696ac2dc1ac865fba045e929352738be6c02519105c2688350759a090a18effe`,
  source root
  `5632193e8f2835024d5d1a755762b33914131708fe811cc2c29fb266bd8512a0`,
  and result root
  `0cc22576c5d29ff9a1e2dffd7386d746cad97d105bef53dcf41b8d9ceb29165f`;
- oracle/runtime bridge: 106 derived runtime checks, 19 retained-unknown
  checks, one separately checked source-compilation refusal, 3 semantic
  metamutants, and 21 result-envelope mutants;
- live TLS fixture: TLS 1.3, `h2`, DNS SNI, IP-reference no-SNI, DNS/IP
  identity, trust failure, and mutual TLS;
- independent D/S witnesses: 48 definition tests, 19 synthesis scenarios,
  33 coverage entries, 144 schema instances, and 28 rejected metamutants;
- publication verifier and adversarial lifecycle green, including exact
  candidate-review versus released-Core separation, annotated-tag proof,
  three distinct reviewers, consumer-revision-keyed module `@1`/`@2`
  publication, historical immutability, and cross-Core reuse rejection;
- authority pins: 120 OK, 0 moved, 0 unreachable;
- count, release, design, core corpus, transform, operation-graph, JSON,
  syntax, and diff gates green.
