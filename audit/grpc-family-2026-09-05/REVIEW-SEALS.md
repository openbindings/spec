# Review seals

No semantic phase is sealed yet.

## Architecture review 1 — rejected

- HEAD: `c5cbec60a739d26ff1bbc3ea9e8cf7fd8eaf25af`
- complete snapshot: `8c2bb41ecb3d47287d9514a105d598645ae0fb784804f3c90d49aeede7f0833e`
- authority reader: REJECT
- conformance attacker: REJECT
- publisher editor: REJECT

The batch was reopened for authority installation, Edition 2026 enum JSON
semantics, stateful reflection and separate discovery context, eager streaming
open, metadata equivalence, TLS name/authority separation, raw DATA/TLS peer
evidence, adverse action results, semantic transcript parity, format `@7`,
immutable companion-module publication, post-promotion transactional review,
affirmative status validation, and complete OBI-B-03 wording.

## Seal requirements

A seal records:

- phase and scope;
- exact HEAD;
- complete tracked-plus-untracked SHA-256;
- any corpus/apparatus root digests;
- focused and full gate outputs;
- authority-reader verdict;
- conformance-attacker verdict;
- publisher-editor verdict;
- P0/P1/P2/P3 disposition;
- statement that the bytes were unchanged between initial and final locks.

`ACCEPT` requires no unresolved P0-P2 and no unexplained P3. A nominal green
verifier, passing counts, or a review of different bytes is not a seal.

## Architecture review 2 — rejected

The second review covered the complete specification, module, D/P/S
apparatus, exact compiler and TLS witnesses, trusted apparatus manifest, and
staged publication lifecycle.

- HEAD: `c5cbec60a739d26ff1bbc3ea9e8cf7fd8eaf25af`
- source snapshot:
  `25cffb3e7decadf4493fcf0a6a9f6a087ce7c9c5edb85af3e16fec45f7270256`
  over 282 files
- stage record:
  `c6614de86c381c02ac897a6f2c993dbcbded73897a881eb2f8c6b1787f19c9ad`
- stage root:
  `b6da1ac881660c03f17a58585cab0d6cb1b59073df68b433b13841a99456eaa0`
  over 226 files
- apparatus root:
  `52ef8efcd9bfdbc15de413f1031f2cb3d64a99c38ca041408e4692ff8095efba`
  over 65 files
- evidence:
  `c09afe14a6ac68cf00194042844aee7cd37f3502fcd6c3702b120a3d0c699e6c`
- authority reader: ACCEPT
- conformance attacker: REJECT
- publisher editor: REJECT

The batch was reopened because processor runners did not yet execute the full
descriptor-driven Protobuf correspondence, response header/trailer placement
was not closed, and native send evidence was order-insensitive. Publisher
review also found an inaccurate released-Core claim, mutable module-revision
mapping, insufficient review independence, and status/catalog contradictions.
The reviewed stage remains an immutable rejected artifact outside the
repository and is not publication evidence for a later stage.

## Architecture review 3 — rejected

The third review exercised descriptor-driven processor parity, closed response
fields, exact ordered native evidence, candidate/released-Core separation, and
revision-keyed module closure.

- HEAD: `c5cbec60a739d26ff1bbc3ea9e8cf7fd8eaf25af`
- source snapshot:
  `3c97ed52bb4ed48555f9de68e8b14c6fd8d11790b52077373560f3094a4c2a4f`
  over 285 files
- stage record:
  `d846cea79ff51a04169bb6e7388251b493ee512eb04f2ead8d64f5aaeb678739`
- stage root:
  `62c68862ee8c239369d0edce06abf225487cc8f654106fc229ef78ed7ac5fbbd`
  over 230 files
- apparatus root:
  `bea5d435bc321cd0eac8058a109342ccd080ba79c07a7828eb5acdc9e9174740`
  over 68 files
- evidence:
  `442768082b41a3503b492212df4815f6b1c7bcfc7724e83393adb09c2319e030`
- authority reader: REJECT
- conformance attacker: REJECT
- publisher editor: ACCEPT for the non-finalizable candidate-review state

The batch was reopened because the processor still had an abbreviated
lossless ProtoJSON edge model, inbound custom metadata values were not fully
validated, and normalized leading/trailing metadata evidence was absent. The
review also clarified inbound `user-agent` and upstream-permitted header
ordering. The reviewed stage remains immutable and cannot be reused.

## Architecture review 4 — rejected

The fourth review covered the lossless numeric/WKT cases, inbound metadata
validation and evidence, and their integrity mutations.

- HEAD: `c5cbec60a739d26ff1bbc3ea9e8cf7fd8eaf25af`
- source snapshot:
  `99cb412caba61eada578c758e16c08adf35acda759fd5e532b7601ed65fddcd8`
  over 286 files
- stage record:
  `2f22c6bc9d6a9abceb3d392d3ed3ce298ec0c78aac236432732b0c0875ea1656`
- stage root:
  `bc69c04b7f1ed55192822a741e50a1aad72a7e0076b1bccaa80cab9f8d46c80c`
  over 231 files
- apparatus root:
  `d5535c1aed6faf0e5e6c461045b4baf963bbd75ee80de2e3bb5826c5429a1aa0`
  over 69 files
- evidence:
  `72755ed784a1f3bd06944bcd1bcb5d16d2619fada9267876a920195e61937edd`
- authority reader: REJECT
- conformance attacker: REJECT
- publisher editor: ACCEPT for the non-finalizable candidate-review state

The batch was reopened because the shared TypeScript path still used
calendar-normalizing date parsing, permissive quoted-number coercion,
prefix-specific `Any` resolution, and locale metadata ordering. The reviewed
stage remains immutable and cannot be reused.

## Architecture review 5 — rejected

The fifth review exercised strict shared Timestamp, Duration, FieldMask,
float, and `Any` correspondence plus Unicode-scalar metadata ordering in both
independent processor and value lanes.

- HEAD: `c5cbec60a739d26ff1bbc3ea9e8cf7fd8eaf25af`
- source snapshot:
  `d9ac0404a41f5e8f1afde3cdf3326457cf4f46f05dd9b8306fe88f257a47b87d`
  over 286 files
- stage record:
  `b669f1e627a40e1b13f07e957a20e35068f12b445fce68f1892aaf3ab5258b60`
- stage root:
  `e78b80b5c6b144eb23224d250aa89823c887a16524793897bb6305a2a7ad687d`
  over 231 files
- apparatus root:
  `795d5822976415fee7e64141cdb843bb8b784a62e74400c3cbece748d7a93af7`
  over 69 files
- evidence:
  `93730690e34daf67e7152030659e770debab30c35f398571c87016c706033cd1`
- authority reader: REJECT
- conformance attacker: REJECT
- publisher editor: ACCEPT for the non-finalizable candidate-review state

The batch was reopened because TypeScript normalization still diverged on
float wire round trips, typed map keys, JSON whitespace, Unicode scalars,
empty bytes, direct `NullValue`, and nonfinite `Value` outputs. The reviewed
stage remains immutable and cannot be reused.

## Architecture review 6 — rejected

The sixth review exercised descriptor round-trip normalization and every
FINAL-5 reproducer in both the standalone value and end-to-end processor
lanes.

- HEAD: `c5cbec60a739d26ff1bbc3ea9e8cf7fd8eaf25af`
- source snapshot:
  `7f1bdf9d9ee55a89d22f9088f7045ed3b570cfc9f01ad8433e1de3326f41f89b`
  over 286 files
- stage record:
  `4d538025d92377c43b082ffc3bb7234a0fc15611e936c27defd521b7eb879b3d`
- stage root:
  `2e14f49d0efd31fe41c0d99696e3c88c3ca42336394d947dee48bb207da1b957`
  over 231 files
- apparatus root:
  `97379a8b9e9ef434de4bc78168c8ec8175f67dfefce343c1655c73f261eb0d5f`
  over 69 files
- evidence:
  `aa00cd23ce1916c8a2808b5476c67268e376c2a63824afae9b76a1ad99943de6`
- authority reader: REJECT
- conformance attacker: REJECT
- publisher editor: ACCEPT for the non-finalizable candidate-review state

The batch was reopened for signed/unsigned map-key grammar, float32 boundary
rounding, empty/default binary messages and `Any`, wrapper null, unset
`Value`, pinned FieldMask conversion, and the `Any` `@type` collision. The
reviewed stage remains immutable and cannot be reused.

## Architecture review 7 — rejected

The seventh review exercised the expanded cross-language differential grid,
the narrow `Any` collision exclusion, and the corresponding processor and
synthesis confinement evidence.

- HEAD: `c5cbec60a739d26ff1bbc3ea9e8cf7fd8eaf25af`
- source snapshot:
  `ca5f1bbb98a5842e33a48ee4f377caee4ebc643fa6034e08f597183441ba7802`
  over 286 files
- stage record:
  `ff84cf43f5c5ea22ce5d52881182528953dc50401c05a0f0a048060549c27911`
- stage root:
  `42112fea42d09030a0559a41b1883bfc8b37aa7694686b88a7e138ab5c886dd8`
  over 231 files
- apparatus root:
  `593fa7ff840d641e51885cfb3b36d702b607292c8336be7ad24108c0635011d7`
  over 69 files
- evidence:
  `8032eea0e605232791841a8082cde212ba86848e666b7db1dd0db69c275591c2`
- authority reader: REJECT
- conformance attacker: REJECT
- publisher editor: REJECT

The batch was reopened for a strict lossless Go JSON front end, exact
binary32 rendering, unconditional typed 64-bit map-key decoding, duplicate
alias and context-sensitive null handling, the complete pinned Duration
grammar, runtime output confinement for the `Any` `@type` collision, a stale
boundary-count lock, and a mid-word module reflow. The reviewed stage remains
immutable and cannot be reused.

## Architecture review 8 — rejected

The eighth review exercised the strict Go JSON front end, exact binary32
rendering, typed 64-bit map keys, context-sensitive null handling, expanded
Duration grammar, `Any` output confinement, and staged publication replay.

- HEAD: `c5cbec60a739d26ff1bbc3ea9e8cf7fd8eaf25af`
- source snapshot:
  `5f0390394fca3218fb1c96463f9f3dcab5549aa15f2afe8d46f00819ee770693`
  over 287 files
- stage record:
  `cf9410cbd985fdffad23543320b84bc5f03910121f935c778f1d04798b9aedd4`
- stage root:
  `17dbfcfb0ddecfbea68e56644c0f6c99d41a56cf3e158113f257cb96ab3b8cc5`
  over 232 files
- apparatus root:
  `6d0ae48e39fbe609b04bd1eb01d6f64b5fc4af07de115b1d2f01b632d41f906a`
  over 70 files
- evidence:
  `6e76441d452855ed94fb6099f91921f53312dd9e77fbbc481dadbbd66b379462`
- authority reader: REJECT
- conformance attacker: REJECT
- publisher editor: ACCEPT for the non-finalizable candidate-review state

The batch was reopened for closed-enum output confinement, exact Base64
alphabet discrimination, raw UTF-8 validation before host JSON parsing,
ordinary wrapper-field and `Value` null semantics, own-property-safe JSON
members, quoted numeric enum values, and proto2 binary string UTF-8 refusal.
The reviewed stage remains immutable and cannot be reused.

## Architecture review 9 — rejected

The ninth review exercised the merged FINAL-8 authority and conformance
repairs across strict raw JSON ingestion, descriptor-driven wire validation,
and the expanded cross-carrier differential corpus.

- HEAD: `c5cbec60a739d26ff1bbc3ea9e8cf7fd8eaf25af`
- source snapshot:
  `29dbfba051126457145ec54579539b96974eeefce9872e66392796f2a33d24a2`
  over 290 files
- stage record:
  `5b9477cff0c5ea248242ec72da0a44dc060740a2525ce7dc84c3855682bce4bd`
- stage root:
  `2a3ee2f1cb84af0832b54a4b5646a0556cdd4907f3b51bfc72dd6c2f347bdc93`
  over 235 files
- apparatus root:
  `f28f7896bd6b47162277237c74f54699ac073d41d01b4ba8c7ea790c211483d3`
  over 73 files
- evidence:
  `a2e096465a6beab94c01c967dc013207721c62a79c021fbe23322212c18448ec`
- authority reader: REJECT
- conformance attacker: REJECT
- publisher editor: ACCEPT for the non-finalizable candidate-review state

The batch was reopened for bounded Protobuf varint overflow, UTF-8 BOM
parity, closed-enum unknown-field semantics, exact quoted-enum grammar,
surviving-value rather than raw-occurrence proto2 UTF-8 validation,
cross-field JSON-name collisions, nonempty-prefix `Any` URLs, and exact
pinned Base64 and normalized map-key-alias domains. The reviewed stage remains
immutable and cannot be reused.

## Architecture review 10 — rejected

The tenth review exercised the corrected closed-enum, surviving-value UTF-8,
JSON-name collision, `Any` URL, Base64, map-alias, varint, and BOM behavior
from an exact fresh stage.

- HEAD: `c5cbec60a739d26ff1bbc3ea9e8cf7fd8eaf25af`
- source snapshot:
  `02bf8cedfae050b9a486cd6b2d293855c89d092269904931603493c0c04b2696`
  over 290 files
- stage record:
  `6224823ea9b99725e439b3108842b59647375f675996f486f27b936c4fe716b9`
- stage root:
  `7eb0b3f76a818145c973b9b06e1c2ceca2daa8ceca6ba223706d0eb61d153ade`
  over 235 files
- apparatus root:
  `30b66cef10cb68b46afc98840d7d27c9d4b64ca8764b076b61567bb37e5e3657`
  over 73 files
- evidence:
  `aedaf6f11bae152cbf130897210229a245d46ebf77f30b902a7127601b6d0c42`
- authority reader: REJECT
- conformance attacker: REJECT
- publisher editor: REJECT

The batch remains unsealed because exact pinned behavior is still absent for
ASCII-surrounded integer map keys and quoted numeric values, closed-enum
unknown-field round trips and map-entry merge/default/key-wire semantics,
omitted proto3 defaults in reflection responses, and strict scalar typing in
JSON `FileDescriptorSet` input. The reviewed stage remains immutable and
cannot be reused.

## Architecture review 11 — rejected

The eleventh review exercised the portable caller profile, exact official C++
oracle, descriptor and binary closed-enum semantics, directional schemas, and
the candidate-Core lifecycle from a fresh immutable stage.

- HEAD: `c5cbec60a739d26ff1bbc3ea9e8cf7fd8eaf25af`
- source snapshot:
  `47512620b8d5c3cbed176f8f3d6b821c12e23cb3d0d2a8203daad7677ffa3442`
  over 298 files
- stage record:
  `8506d07dd126b9ae418ecc0ec98b2d94dfb599ee98c484135f4ac0e609616032`
- stage root:
  `dbd71612792b08577fcf350a9e4921a3922bf6c49bdfd58a004422ec2b200e95`
  over 243 files
- apparatus root:
  `c37b96375d096ba173b557438626d337ed01ab1e0b0e5bcb46ecc7b7f9d97fa9`
  over 81 files
- evidence:
  `8abdfe63447d21e9d018cfb3c743491bb08eca7219f25840bddab3570ccd40c0`
- authority reader: REJECT

The batch was reopened for context-sensitive wrapper schema nullability,
whole-field null wording and evidence, an explicit directional account of the
open-enum output schema's full-int32 maximum, complete C++ decision-anchor
wording, and the Edition enum numeric-input runtime witness. The reviewed stage
remains immutable and cannot be reused. The conformance and publisher readers
also rejected this stage: ordinary value-varint parsing differed from the
pinned C++ parser, the oracle observations were not semantically connected to
runtime results, unreachable contradictory validators remained, and the CI
oracle job used a retiring macOS runner label.

## Architecture review 12 — rejected

The replacement batch repairs the review-11 findings and adds an executable
oracle-to-runtime bridge. The bridge exposed and closed further unknown-map
normalization and Edition witness gaps, including resolved default keys. It
independently validates complete runtime result envelopes and rejects typed,
unknown-retention, disposition, and result-envelope mutations. Source
compilation refusal remains distinct from binary decoding refusal and failure
to represent a decoded value in JSON.

The fresh source/stage/evidence hashes and three cold-reader verdicts must be
recorded outside the source snapshot; inserting them here after staging would
change the bytes under review. Preparation and green development tests are not
an acceptance seal. Core 0.2.0 remains an unreleased candidate, so this cycle
cannot authorize finalization or publication.

The conformance and publisher readers rejected a stale aggregate summary in
the otherwise hash-consistent apparatus manifest: 160 scenarios, 1035 DATA
bytes, 36 outputs, and 174 boundary cases instead of the current 163, 1074,
38, and 177. The mandatory runner gate correctly failed and no passing
evidence was written. The immutable rejected source snapshot is
`7878cde15138ccf44219f5c2ec0c5382194f194c891a75936d9f8a640f2427c0`
over 299 files; stage record
`f08f111221855032b311550d8cc50b879cb688c59f2cb6e7b38faceb8aae22e7`
seals stage root
`197eee062dbd5af521b6447a3017e7a5c7076c2e8257477cd4cf5571d67ae478`
over 244 files. This candidate cannot be reused.

The authority reader additionally rejected generic null-as-absence wording
that omitted `Value`/`NullValue` presence, an unbounded numeric branch for
recursive `Value` schemas, and canonical-only WKT input prose that contradicted
the admitted parser spellings. It also required an explicit optional outbound
header policy and correction of an obsolete oracle count in the runner README.

## Architecture review 13 — preparation

The replacement updates the manifest and its schema's aggregate constants.
The main verifier now independently derives every aggregate from the source
specification, processor scenarios, and boundary matrix, and exercises
deletion and substitution mutations for all ten aggregate fields. The runner
gate still independently compares those sealed expectations with both real
runner results. This closes the stale-summary preparation gap without
weakening the mandatory staged evidence gate.

The same replacement clarifies intrinsic JSON-null presence and WKT
caller/schema directionality, bounds recursive `Value` numbers to finite
binary64, and adds strict-lossless overflow witnesses through `Value`,
`Struct`, `ListValue`, and `Any`. Outbound `grpc-message-type` is omitted;
bounded implementation-owned `user-agent` variation is explicitly permitted,
recorded, and validated on application and reflection requests.

A bounded source check established that leading-plus, omitted-whole, and
empty-fraction Duration spellings were runtime extensions, not accepted by
the selected C++ parser. The replacement refuses those four forms in both
runtime witnesses, retains valid non-printer-canonical fractions and Timestamp
offsets, and checks Duration refusal through a mutation with internally
consistent proposed wire evidence. No published behavior was changed.

Acceptance still requires fresh complete staged evidence, three cold-reader
verdicts, and unchanged final locks recorded outside this source snapshot.
Core 0.2.0 remains unreleased; no finalization or publication is authorized.

## Architecture review 13 — completed; replacement for one P3

All ten mandatory evidence gates passed for source snapshot
`154e4c4bdb6ff7eac18cdf7d711a2fcb1df693083bd37e0fe0750fc7eab8f359`
over 299 files, stage record
`dcb2f4b8b25ae69c77d8cac72d1a6e82ed8822acffa9e7491027f45954f2971c`,
and stage root
`edad49e4c3cbd42a2ddb02c8fb73a4f2e5c1b0b1f44f22923502c697b3f61949`
over 244 files. Evidence SHA-256 is
`bba06f4d52bd524edcb01f8dac9538073fdb5c2f0a295e9081b27f35c09dced9`.
The authority, conformance, and publisher readers found no unresolved P0-P2.
Conformance identified P3-F13-DOC-001: the runner README retained obsolete
schema-instance and mutation totals, 101/24 instead of 144/28. The publisher
independently confirmed that this was the sole adjacent stale-count occurrence.
The exact reviewed stage remains immutable.

## Architecture review 14 — documentation-only replacement preparation

The replacement corrects only those two README totals, updates the apparatus
file seal and trusted root, and records this disposition. No normative text,
runtime behavior, corpus, schema, or mutation changes are included. Fresh
complete staged evidence and exact-lock review confirmation remain mandatory;
review-13 acceptance is not automatically transferred to different bytes.
Final acceptance is recorded outside the source snapshot. Core 0.2.0 remains
unreleased; this replacement also cannot authorize publication or finalization.
