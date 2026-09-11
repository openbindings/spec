# Private family acceptance evidence

This is the R4 consistency contract for the existing completion register, not
a portable binding specification, invoker API, signing authority, release
policy or replacement feature inventory. It implements the approved corrective
loop's evidence/history/readiness requirements. The register's 120 identities
and dispositions are unchanged; no actual cell is promoted by these tests.

## Two command boundaries

`node scripts/verify-asyncapi-family-completion.mjs` checks the frozen semantic
contract, graph, progress shapes and generated table. Without an independently
selected prior checkpoint it allows only unaccepted, history-empty progress.
It explicitly does **not** qualify acceptance, append-only history or readiness.
Do not interpret its zero exit as any of those claims.

For acceptance/history validation supply a trusted prior checkpoint path and
its independently obtained SHA-256. Both are caller inputs, never fields in
the candidate register or a candidate-selected history file. The checkpoint is
canonical JSON with `format: openbindings.asyncapi-acceptance-history@1`, the
checker-pinned `contract` digest, and `histories`, a complete object mapping
every frozen feature ID to its previously recorded event-reference array.
The initial explicitly trusted checkpoint may contain empty arrays. Subsequent
runs must use the last retained trusted checkpoint, not regenerate empty arrays
from the candidate. Selecting an old or fabricated checkpoint defeats the
trust assumption; this checker does not authenticate a caller or create a new
governance authority. Retain the accepted checkpoint independently after review.

```sh
node scripts/verify-asyncapi-family-completion.mjs \
  --trusted-history=/absolute/path/to/retained-checkpoint.json \
  --trusted-history-sha256=INDEPENDENTLY_OBTAINED_SHA256 \
  --repository=interfaces=/absolute/path/to/interfaces-checkout
```

`--repository=id=path` registers each additional governing checkout; `spec` is
always the actual checker checkout. Revisions come from each checkout's actual
HEAD, and input inventories from sorted unique `git ls-files --cached --others
--exclude-standard`. Dirty input bytes are hashed independently of HEAD. A
clean commit alone cannot certify dirty or changed dependencies.

`--ready` additionally requires every frozen register cell to be accepted,
including exclusions and all three M12 readiness cells. A `family-ready` status
has the same gate. Accepting any M12 cell already requires all non-M12 cells
across the family and explicit evidence for all seven Core OBI-B-02 items.
Dependencies still control sequencing and stale-acceptance invalidation; they
do not define the readiness denominator. This is not publication authorization.

## Sealed inputs and out-of-subject reports

Subject inputs include the exact full nonignored tracked/untracked inventory
of every participating checkout. Only the fixed evidence directory below and
the two progress files (`completion.json`, `COMPLETION.md`) are omitted. The
checker separately pins a semantic projection of the register: all per-cell
fields except state, evidence, findings and history, plus contractVersion and
scopeDecision. Therefore criteria, authority, normative rules, dependencies
and exclusions cannot hide in mutable status. `obiB02` remains an informational
progress summary, not the readiness oracle.

The subject records repository IDs/revisions and each input's relative path,
regular-file type, permission mode and SHA-256. Deletion, retyping, changed
mode/bytes, omitted paths, or new unsealed inputs fail current acceptance.
This revision deliberately supports regular-file checkouts only: symlinked
inputs or path components fail closed, including links outside a checkout.
Ignored installed dependencies are represented by the actual manifest/lock,
selected toolchain version and reviewed clean-execution evidence; installation
directories are not silently asserted to be sealed. No package manager runs
during record verification.

Records live under `conformance/asyncapi-family/evidence/` in the spec checkout.
They are outside the subject to avoid a subject/report hash cycle. Only typed
reports belong there; semantic configuration belongs in sealed inputs. Record
references are closed `{path, sha256}` objects. Each record recursively sorts
object keys (arrays retain order), then uses UTF-8 bytes of
`JSON.stringify(value, null, 2) + '\n'`; a duplicate-key, lossy-number or otherwise
noncanonical encoding is rejected rather than silently reparsed into a
different hashed claim. Hashes cover the exact canonical bytes, not pretty-print
normalizations of arbitrary input. Expected corpus files retain their existing
formats and are sealed by their original byte digest.

The private validator in `scripts/asyncapi-completion-evidence.mjs` is the
versioned record-shape and linkage authority. Its closed object-shape checks
reject unknown and missing fields; no dependency or parallel JSON-schema
framework is introduced. Existing portable D/P/S schemas remain unchanged.

## Record graph

Every format below has prefix `openbindings.asyncapi-acceptance-` and suffix
`@1`. The names below identify the middle component. All references are exact;
arrays of identities reject duplicates. A subject may cover several feature
IDs, but execution/review scope must equal that subject's feature set.

| Record | Required content and checked correspondence |
| --- | --- |
| `subject` | `contract`, `features`, `authors`, `repositories`, `artifacts`, `dimensions`, `obligations`, `decisions`, `cases`. Frozen before observations or review results. |
| `observations` | `subject` digest and `cases`; each case has planned `id`, actual fixture `scenario`, original `fixtureSha256`, `status: executed`, and exact assertion `id`/`actual` values. |
| `execution` | `subject`, `features`, sealed `implementation`/`runner` artifact keys, nonempty `command`, `environment` (toolchains/platform/architecture), `classification: complete`, `exitCode: 0`, exact executed `cases`, and an `observations` reference. |
| `review` | `subject`, `features`, exact execution digests, `role` (authority/evidence), `reviewer`, `relationship: non-author`, reasoned `decision: accept`, no unresolved `findings`, and explicit reviewed obligation IDs, dimension keys, artifact paths and decision IDs. |
| `decision` | Required decision `id`, matching subject/scope/owner/source/clause, `decision: approved`, and a nonempty rationale. This checks ruling correspondence, not the authority of the person who issued it. |
| `event` | Unique `id`, one `feature`, `contract`, subject reference, execution/review/decision references, exact current dependency-event digests, and `previous` event digest or null. Stored in that cell's existing `acceptedHistory`. |

An artifact key is `repository:path`. Roles identify normative and incorporated
authority sources, interfaces, policies, implementation, dependencies, fixtures,
runners, capability inventory, build configuration and the checker itself.
`supporting` includes remaining checkout files, not an omission mechanism.
Both checker modules and their extracted lossless JSON helper are mandatory
sealed inputs. Applicable interface
obligations require an interface-role artifact. The alignment checklist itself
is embedded in the sealed subject, not filled in after execution.

Every feature has explicit applicability and a nonempty rationale for all
eight existing evidence dimensions. Each of the five alignment layers has
at least one obligation, with applicability, rationale, exact source/clause
and proving case IDs. Applicable rows need evidence; N/A rows have no cases
and must be explicitly included in both non-authoring reviews. An omitted
layer, dimension or review coverage cannot act as N/A. Required maintainer
rulings are frozen as subject requirements and must match the resulting records.

A planned case names its unique evidence `id`, authored fixture `scenario`,
feature, principal dimension, governing rules, fixture artifact/JSON pointer,
capability artifact/JSON pointer, implementation, runner and assertion IDs with
expected-value JSON pointers into that original fixture. The scenario must
resolve exactly in the fixture and in the provider's capability inventory.
Existing definition tests without IDs use `RULE#/tests/INDEX`; P/S and other
identified cases keep their authored IDs. The evidence ID may distinguish two
implementations executing the same authored scenario. Additional boundary,
mutation or integration dimensions can cite an already executed case without
duplicating a fixture. D/P/S and independent derivation/execution dimensions
require their matching principal case classification. A normative feature's
cases must have nonempty applicable rule owners. Explicit fixture-root
`bindingSpec`, `family`, and portable P/S corpus format must match the feature's
edition and corpus kind; generic catalogs may omit these fields.

Edition admission is explicit, not inferred from a version number. Current
evidence acceptance admits only the implemented `openbindings.asyncapi-3.1@1`
sibling and its processor/synthesis `@7` corpora. New current-acceptance subjects
for 2.6/3.0 fail at `subject.unimplemented-sibling`, even with invented future
artifacts. Their required cells remain in the live denominator; the superseded
shared `openbindings.asyncapi@1` candidate is not a fallback. Later sibling work
must add and qualify actual identities, rules and corpus formats before its
evidence can be accepted. Historical records do not become current acceptance.
The positive typed-evidence graph therefore qualifies the implemented 3.1
identity only. The independent universal-readiness test leaves out each of the
actual 120 cells in turn; it does not fabricate future evidence acceptance.

The checker resolves each rule against the exact edition's anchored normative
definitions, its cell's declared rules and the original fixture's owners.
Every declared cell rule needs a proving case. Every planned case must be
executed exactly once across the linked execution records; every planned
assertion needs an exactly equal observed JSON value. Observations of merely
selected, skipped, unsupported or apparatus-failed cases cannot qualify.
The existing primary lossless JSON helpers are extracted unchanged and reused
to verify that fixture decoding loses neither mathematical values nor duplicate
keys. A fixture whose values cannot survive the host JSON representation fails
closed; it needs a qualified lossless projection such as an exact JSON-text
field, never a rounded expected value. This is an apparatus limit, not a
portable binding exclusion. Record canonicality compares actual UTF-8 bytes,
not strings after replacement of invalid bytes.
Normalized equality projections belong to the reviewed provider's sealed
runner; this checker does not replace protocol semantics with generic equality.

The live cell's evidence arrays must equal the applicable execution references
for that cell/dimension. Historical string references may remain on unaccepted
progress cells; they cannot be promoted as typed passing evidence. Existing
R1–R3 console output and prose acceptance records are retained historical
evidence, **not** silently converted into this machine format or promoted.
R5 providers must emit or faithfully project actual observations and qualify
that projection before their records support acceptance.

## History and substantive review

The complete trusted prefix is immutable even if a cell is demoted. Old subject
bytes need not remain the current checkout: historical events remain historical
and their retained record bytes/hash chain are checked, including the full
subject/execution/observation/review/decision report closure. Historical
dependency references must resolve to retained events. Every appended event
must be the current accepted event and pass current evidence validation; one
append per cell per checkpoint transition prevents inserting unvalidated
historical acceptances. Supersession names the previous digest. A changed
dependency must have a new current event, and consumers must bind that event;
an old consumer event cannot certify a new dependency subject.

The machine cannot prove that an observation was genuinely produced by the
recorded command, that a reviewer identity is authentic, that implementations
are independent, that a projection is adequate, or that a rule/ruling is
substantively correct. Actual authorized non-authoring authority and evidence
reviews must establish these facts on the exact frozen packet. Their recorded
roles, authorship relationship, scope and coverage are additional consistency
checks—not substitutes for those reviews. A fabricated internally consistent
packet is not an accepted real-world feature merely because it parses.

## Qualification

`node --test scripts/test-asyncapi-completion-evidence.mjs` runs clearly
synthetic acceptance graphs in disposable directories, including a full
120-cell graph derived from the live denominator. One-change negatives must
fail at their named gate; tests do not accept an arbitrary earlier exception.
Positive controls prove the checker can accept complete evidence, genuine
supersession and reviewed N/A. The full-family test leaves each actual cell
unfinished in turn, separately from the narrower dependency-graph test.
The CI register step runs this qualification suite. Synthetic specifications,
reviewers, decisions and accepted histories never enter the real register.
