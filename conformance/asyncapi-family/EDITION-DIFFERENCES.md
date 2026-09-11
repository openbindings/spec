# M0 edition differences and authority corrections

Status: source-checked work packet, not sibling implementation acceptance.

The exact spec files were fetched and SHA-256 checked on 2026-09-06 against
`binding-specs/AUTHORITY-PINS.json`. These decisions precede implementation;
paired counterexamples below must enter each sibling's D/P/S evidence.

| Edition | Commit | SHA-256 |
| --- | --- | --- |
| 2.6.0 | `1824379ba6252bfb52550337a86ca9b10a33b3aa` | `5f2cdf48b891382993d64ca9870f82b9f37ea643c61bbb4a44d6e22562521428` |
| 3.0.0 | `d78dcea70c9b094a3df72f9a4e811828cec778cc` | `2c57c205e0c3f75fba504b4ed978064cd9f6878b8d8ca3eec57646525fc50cf8` |
| 3.1.0 | `b3fac5bb522771428ea57b16129b273cd3ea0180` | `983a9c0ccb35412d4f6f254ab1ae9ea09a560664b1e41efb0109b12d0cd91869` |

## Corrected inherited finding: ED-01

The prior architecture §6 incorrectly called a 2.6 Message Object without a
payload upstream-invalid. The [pinned 2.6 Message Object](https://github.com/asyncapi/spec/blob/1824379ba6252bfb52550337a86ca9b10a33b3aa/spec/asyncapi.md#messageObject)
does not require that field. The complete fixed-field table and surrounding
prose were inspected, not merely an example or parser result.

The local complete-message-value convention can therefore represent `{}` for
an empty message in 2.6 as in 3.x, subject to each profile's later admission
rules. No candidate may label payload absence an upstream-invalid owner.
This corrects planned 2.6 semantics; it does not change the accepted 3.1 C21
slice. Historical review records remain historical, not renewed acceptance.

Paired boundary: `message: {}` versus `message: {payload: {}}` in an otherwise
valid 2.6 operation. The former has no payload member in the application value;
the latter declares a payload schema and is not equivalent to absence.

## Required paired counterexamples

| ID | Surface | Required distinction | Provenance |
| --- | --- | --- | --- |
| ED-01 | Empty message | 2.6 no-payload Message is not upstream-invalid; absence differs from a declared unconstrained payload | Incorporated field optionality plus local value convention |
| ED-02 | Direction | 2.6 channel `publish` means application consumes; 3.x operation `receive` means application receives. Both map to caller publication in the local client profile | `channelItemObjectPublish`, `operationObjectAction`; local client role |
| ED-03 | Omitted messages | 3.1 omission includes all Channel messages; explicit `[]` includes none. 3.0 prose does not state that omission default; local architecture excludes omitted/empty 3.0 lists | 3.1 `operationObjectMessages` note; 3.0 local exclusion, NOT attributed to upstream |
| ED-04 | Message representation | 2.6 uses Operation `message` and its `oneOf` wrapper; 3.x uses an array of references to the selected Channel's message entries | `operationObjectMessage` / `operationObjectMessages` |
| ED-05 | Payload schema format | 2.6 Message-level `schemaFormat` governs payload; 3.x has direct Schema/Reference or Multi Format Schema payload | `messageObjectPayload`, 2.6 `messageObjectSchemaFormat` |
| ED-06 | HTTP binding version | Omission pins 0.1.0 / 0.2.0 / 0.3.0 respectively; explicit cross-edition revisions cannot inherit the latest profile | Local version pin, upstream binding revisions |
| ED-07 | HTTP reply | 3.0 has an Operation Reply Object but its pinned HTTP binding 0.2.0 lacks the selected statusCode correspondence; local 3.0 exclusion must not say Reply is absent upstream | Local profile exclusion |
| ED-08 | Trait merge | 2.6 directly specifies ordered RFC7386 patches; 3.x names a traits merge mechanism protecting target properties. Do not copy the 3.1 target-protection algorithm to 2.6 without an explicit edition ruling | Separate source clauses; final 2.6 trait correspondence still open |

Every row needs paired positive/negative processor and synthesis evidence before
the affected register cell can become accepted. ED-08 is an explicit unresolved
edition ruling, not permission to choose implementation defaults. The existing
C19A amendment controls 3.1 only.
