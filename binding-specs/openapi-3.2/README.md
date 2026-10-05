# OpenAPI 3.2 candidate: migration to OpenBindings 0.2

The [active candidate](openbindings.openapi-3.2.md) uses the OpenBindings 0.2.0
core model. It is an unreleased proposal for `openbindings.openapi-3.2@1`.
Updating this draft does not publish that identifier or assert SDK support.
This page records migration and evidence; it adds no interpretation requirements.

## Content migration

| Earlier draft | Current candidate |
| --- | --- |
| `source.bindingSpec` | `source.kind` |
| An OAS object/string directly in `source.content` | `{ "document": <object-or-string> }` inside `source.content` |
| Top-level `source.location` | `source.content.location`; may accompany `document` as its retrieval base |
| `binding.selector: "#/paths/..."` | `binding.content.target: "/paths/..."`; literal string-form JSON Pointer, without the old `#` sentinel |
| Core `inputTransform` / `outputTransform` | Optional kind-owned `binding.content.input` / `output` structural mappings |
| Required source/load phases and exhaustive generation-report layout | Required interaction meaning, with implementation-specific diagnostics and generation policy |

Sources, bindings, operations and dependencies retain their core-defined roles.
The kind interprets only the content assigned to it. A mapping adapts application
values into native parameters/body and decoded response values into application
outputs; an operation contract need not expose the HTTP envelope.

Expression transforms need deliberate rewriting, not a field rename. The small
mapping facility supports selection, constants, object/array construction and
array-item mapping with enclosing-value access. It does not reproduce arbitrary
expressions or iteration over dynamic object keys.

A [hand-authored OBI](../../conformance/kinds/openapi-3.2/hand-authored.obi.json)
and a [generated OBI](../../conformance/kinds/openapi-3.2/synthesized.obi.json)
exercise the current shapes. Their output contracts are unspecified where the
bounded interpreter cannot substantiate a narrower claim.

## Completeness under project policy

| [PB-02](../PROJECT-POLICY.md#pb-02-publication-completeness) item | Candidate answer |
| --- | --- |
| 1. Artifact, representations and editions | §§1–2: OAS 3.2.0; embedded object/text or acquired document; accepted referenced roots |
| 2. Address interpretation and acquisition | §2: absolute URI, scheme acquisition, failure and unavailable resources |
| 3. Source content and absence | §2: closed `document`/`location` object; at least one member |
| 4. Composition and bases | §2: embedded content wins; retrieval, `$self` and schema bases remain distinct |
| 5. Target and invalid/absent binding content | §3: closed content object and two literal pointer forms |
| 6. Interaction and lifecycle | §§4–10: unary input, unary/sequential output, completion, failure and cancellation |
| 7. Value correspondence and runtime choices | §§4–11: mappings, native representations, prerequisites, partial output, diagnostics and faithful synthesis |

The scope-reduction pilot reviewed these answers against the current core with
opposing reduction/completeness readers. Its final meaning was recorded at
SHA-256 `7ed075b2fc0d20bd017e496b89a030c86aa5e9fd8eb388e063c0105eb27b20b2`.
Integration changes only the opening status and makes the incorporated core
edition explicit in a single versioned authority citation; §§2–11 are unchanged.

## Evidence and remaining work

The [current interpretation suite](../../conformance/kinds/openapi-3.2/README.md)
contains 48 focused tests, including actual loopback HTTP acquisition/dispatch,
complete current-core OBIs, independently authored native expectations, permitted
variation, and semantic-negative cases. Run:

```sh
node scripts/verify-openapi-32-kind.mjs
```

It checks the example documents against the current core's structural schema and
runs the bounded interpreter. It is not a full implementation qualification.
Full resource graphs, general schema translation, multipart, SSE and other
protocol surfaces still need production-adapter coverage.

The old source fixtures and 399 processor/synthesis scenarios remain
[historical evidence](../../conformance/binding-specs/legacy/README.md), bound to
the frozen pre-kind draft. Their old rule IDs, expression transforms, exact
transcripts and generator layouts do not govern this candidate. Existing legacy
runners can still execute that evidence; their results do not demonstrate support
for the new candidate. Porting a production SDK and rebuilding the full portable
corpus are separate work from migrating this specification document.

The candidate also deliberately changes meanings beyond field placement:
artifact encoding and deeper nested Encoding support broaden; unsupported
schemas and optional projections are confined to where they matter; numeric
value preservation replaces silent rounding; negotiation becomes runtime policy;
and non-2xx bodies are diagnostic observations outside operation outputs. These
are changes to an unpublished draft, not a promise of compatibility with its old
implementation.
