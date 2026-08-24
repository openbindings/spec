# AsyncAPI artifact-fidelity qualification

Generated on 2026-08-10 from the internal qualification corpus. This
distilled report is the published evidence; the corpus of third-party
artifacts and its per-artifact machine reports are local qualification
assets and are not redistributed (see [`../EVIDENCE-POLICY.md`](../EVIDENCE-POLICY.md)).
The holdout cohort seal below commits the sealed selection.

## Goal and authority

For every artifact valid under the unreleased first
`openbindings.asyncapi@1` candidate and every operation inside its declared
coverage, synthesis must produce a protocol-blind OBI that is as useful for
correct invocation as bespoke code written to the artifact. Concrete protocol
facts may be used inside the runtime and driver, but ordinary values, failures,
and lifecycle must not require protocol knowledge. Unsupported meaning is
excluded or refused loudly; it is never silently discarded or approximated.

The semantic target comes from exact AsyncAPI editions 2.0.0–2.6.0, 3.0.0,
and 3.1.0 plus each artifact-declared protocol binding. AsyncAPI Core owns the
document and operation model. Nested protocol bindings own concrete transport
meaning. The OpenBindings candidate supplies only the operation-boundary
correspondence. Synthesis does not depend on which protocol drivers happen to
be installed.

## Anti-overfitting controls

- 250 immutable artifacts came from 250 independent GitHub repositories and
  206 owners; only 10 specimens are exact-content duplicates.
- The corpus contains 218 structural signatures, 1,009 operations, and 1,131
  capability observations.
- A 63-repository holdout was selected by repository hash and sealed before
  the initial implementation tuning. Its cohort SHA-256 is
  `ad9a78e13914a343f1e7dc37a7de22b749e0fbbbceba1995b17a83c59663a3da`.
- During the WebSocket reply loop this cohort exposed the static
  distinct-endpoint shape. The resulting rule came from the AsyncAPI Reply
  Object and independent two-endpoint live fixtures rather than copying a
  specimen, but this cohort is now disclosed as opened for tuning and is not
  treated as independent validation of that particular rule. A future release
  claim for it needs a fresh sealed holdout.
- All 51 authority-derived semantic cells occur in the development cohort.
  Rare text, JSON-Schema-format, and Protobuf cells remain explicit red flags;
  their low frequency supplies no implementation rule.
- The sample spans 48 AsyncAPI 2.0, 91 later 2.x/RC artifacts, 95 AsyncAPI 3.0,
  nine AsyncAPI 3.1, and seven whose edition could not be observed.

## Corrected model

Earlier candidate drafts treated AsyncAPI as an HTTP/WebSocket family and
could silently flatten request/reply intent into a simpler publish or
subscription cell. The corrected first candidate instead treats AsyncAPI as a
protocol-extensible artifact family:

1. the standalone artifact runtime parses and normalizes AsyncAPI 2.x and 3.x;
2. synthesis preserves every bindable authored operation, both directions of
   declared replies, and the exact native selector without consulting driver
   availability;
3. a protocol driver receives the normalized artifact and owns the nested
   protocol binding's execution semantics;
4. absent driver capability fails locally before dispatch;
5. ordinary OpenBindings values remain payload values, while message headers
   and raw protocol evidence stay excluded or diagnostic.

The built-in HTTP and WebSocket drivers retain the execution cells they can
implement faithfully. WebSocket request/reply is now a full-duplex standalone
runtime capability for both operation perspectives. Concurrent calls are
connection-isolated when the artifact supplies no correlation routing, and a
static reply channel may use either the operation endpoint or another endpoint
on the same server. Runtime-expression reply addresses and cross-protocol or
cross-server reply routing remain explicit driver gaps, not AsyncAPI
binding-specification exclusions; they require no OBI or Core change.

The same pass aligned Reference Object sibling handling, retained exact source
identity through external reference resolution, resolved operation and message
traits, validated required root information, preserved `$id` reference bases,
and made exact-edition refusal precede external-reference loading.

## Result

| Measure | Final qualification |
| --- | ---: |
| Corpus artifacts | 250 |
| Independently adjudicated valid supported artifacts | 247 |
| Exact TypeScript/Go results in supported envelope | 247/247 (100%) |
| Exact TypeScript/Go results overall | 250/250 (100%) |
| TypeScript artifacts synthesized | 209 |
| Go artifacts synthesized | 209 |
| TypeScript synthesized operations | 658 |
| Go synthesized operations | 658 |
| Fully represented artifacts | 130 in each SDK |

The sole raw cross-SDK mismatch is an invalid external YAML closure whose flow
syntax is tolerated by `js-yaml` and rejected by `yaml.v3`. It remains visible
as parser-tolerance evidence outside the supported-artifact denominator rather
than receiving corpus-specific preprocessing.

The operation-count difference outside the supported envelope reflects invalid
or noncandidate inputs, not a semantic or interface mismatch within the
adjudicated envelope. The final parity report records zero supported semantic,
schema, selector, coverage, or operation-boundary mismatches.

### WebSocket reply loop

The refreshed structural pass finds 58 WebSocket-family reply operations in 11
repositories. The qualified runtime profile admits 55 operations in 10
repositories: 50 same-endpoint operations and five static distinct-endpoint
operations. Three remain explicit exclusions:

- two operations declare `websockets` as the literal server protocol rather
  than a dialable `ws` or `wss` scheme; the runtime does not silently reinterpret
  the artifact's open protocol vocabulary;
- one operation derives its reply address from an AsyncAPI application header,
  but the document supplies no WebSocket serialization rule for carrying that
  header. The payload-only session refuses it rather than inventing an envelope
  or leaking a header field into OpenBindings Core.

These counts are exposure evidence, not the definition of support. The admitted
rules are frozen in the standalone runtime's authority matrix and real
TypeScript/Go server tests; both OpenBindings adapters execute the same runtime
through protocol-independent values.

## Remaining boundary

Within the accepted editions and declared application-value boundary, synthesis
and cross-SDK coverage parity are release-quality. The remaining work is
concrete driver breadth and explicit value-carriage breadth:

- install or build drivers for additional protocol ecosystems;
- add faithful message-header handling only if an application-level mapping can
  be defined without exposing protocol fields;
- add binary and codec-specific payload lanes only where an artifact-defined
  JSON/application value correspondence exists;
- continue native driver differentials for lifecycle, cancellation,
  backpressure, and request/reply behavior.

No result requires a Core document-model field, cardinality declaration,
universal failure vocabulary, or protocol-shaped OBI output. The major
remaining gaps are implementation and ecosystem coverage below the thin
AsyncAPI adapter, not limitations of the Core or binding-specification concept.
