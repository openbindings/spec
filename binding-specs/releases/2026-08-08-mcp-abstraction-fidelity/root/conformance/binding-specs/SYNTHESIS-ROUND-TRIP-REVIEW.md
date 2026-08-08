# Synthesis and round-trip review ledger

This is an informative engineering ledger, not a normative specification. It
records findings that arose while testing:

```text
MCP server -> synthesized OBI -> OpenBindings invocation -> ob mcp
```

The purpose is to keep lessons that may apply to other binding families
without silently generalizing an MCP-specific answer.

## Three distinct guarantees

1. **Inventory coverage** asks whether every accepted upstream target is
   represented, explicitly excluded, or identified as invalid. The shared
   synthesis coverage report answers this question.
2. **Boundary fidelity** asks whether each represented operation's input,
   output, errors, cardinality, configuration choices, and metadata agree with
   the governing binding specification. An operation count cannot prove this.
3. **Re-emission fidelity** asks whether a consumer adapting an OBI back to a
   concrete protocol can expose an equivalent usable surface. This is stronger
   than ordinary synthesis and is meaningful only for the subset the binding
   specification represents.

Do not overload `SynthesisCoverage` with the third guarantee. Re-emission is a
differential property of a synthesizer, binding implementation, adapter, and
test profile together.

## Findings

| Finding | General review question | MCP disposition |
| --- | --- | --- |
| An upstream schema may govern a member of a protocol result rather than the operation's root output. | What exact value does the binding emit, and where does each artifact schema apply inside it? | `Tool.outputSchema` now constrains `CallToolResult.structuredContent`; synthesized operation output admits the complete result object. |
| A protocol-native result can contain parallel information lanes. | Does an implementation project, unwrap, sniff, or prefer one lane even though the artifact preserves all of them? | Complete tool, resource, and prompt result objects cross the OpenBindings boundary and the native bridge re-emits them. |
| Target coverage does not retain every descriptor needed for faithful re-emission. | Is the source artifact available to the adapter, or did synthesis retain only universal operation fields? | Live embedding captures the raw pagination-exhausted MCP listing into `source.content`; the bridge uses that pin for complete native descriptors. |
| Eligibility checks can accidentally impose requirements from an unused source lane. | After content/location precedence is resolved, are validators checking only the selected artifact carriage and the fields it actually requires? | The cross-family audit found and fixed a gRPC synthesizer gate that required a dialable `location` even when embedded proto content was authoritative and sufficient for offline synthesis. |
| Some abstraction mappings are not invertible. | Can the adapter recover the source request from the abstract input, or must it refuse/use an unchanged source-native lane? | An expanded RFC 6570 resource URI cannot generally recover its variable object. For untransformed MCP-origin bindings, the bridge forwards `resources/read` to the same MCP source; transformed bindings use the generic tool lane. |
| Configuration can change stream shape. | Does the synthesized per-value schema admit every value produced by each supported configuration choice? | Tool output schemas admit both solicited progress values and the final result; the default remains unsolicited. |
| Exact identifiers and revision gates are semantic. | Does tooling accidentally accept a shorthand, prefix, or a newly negotiated upstream revision? | The bridge recognizes only `openbindings.mcp@1`; both SDK discovery and invocation gate negotiated MCP revision `2025-11-25`. |
| A same-protocol adapter can accidentally become a binding-selection policy. | If an operation has several bindings, does recognizing one native protocol silently choose it over equally valid alternatives? | Native MCP re-emission is used only for an unambiguous single binding. Multi-binding operations stay on the generic lane and retain the core selection contract. |
| Failure payloads can carry source-native information useful to a same-protocol adapter. | Can the universal error classification preserve enough detail without making generic consumers understand the protocol? | MCP `isError` results remain `EXECUTION_FAILED`, with the complete MCP result in error details so `ob mcp` can re-emit it. |
| Cancellation is part of behavioral equivalence. | Does cancellation terminate only the adapter-facing handle, or the concrete upstream interaction too? | The bridge cancels the OpenBindings invocation on downstream termination; the differential test observes cancellation at the original MCP handler. |
| Credential helpers must agree with the binding specification's declared carrier. | Is a convenience context field mapped only where the binding specification defines an unambiguous destination? | `bearerToken` maps to `Authorization: Bearer`; API-key/basic values without a named header remain refused. |
| A consumer protocol can impose a stricter schema root than OpenBindings. | Can the adapter use a reversible envelope instead of changing the operation's accepted value domain? | MCP requires object tool arguments. Explicit object inputs remain direct; every other per-value input schema is preserved under an optional `input` member. |
| Per-value schemas do not publish interaction cardinality. | Does an adapter infer unary behavior from an artifact family or confuse `false`/omission with zero values? | Generic MCP input can carry zero or one value, and output always carries the complete ordered `outputs` sequence. `false` constrains a value but does not require one; zero, one, many, and explicit `null` outputs stay distinct. |
| Evidence can be lost above an otherwise coverage-capable synthesizer. | Does every acquisition helper return the coverage produced by the synthesis call? | Go `FetchInterface` and TypeScript `fetchInterface` now retain coverage; `ob mcp` can persist it or require exhaustive, fully represented synthesis before startup. |
| Adapter readiness is narrower than document validity. | Can the current process route an advertised operation without inventing selection or waiting for an inevitable wiring error? | Generic MCP registration reports and excludes no-binding, unavailable-spec, missing-source, and unresolved multi-binding operations. Explicit ordered selection uses the operation-invoker contract. |

## Cross-family check from this loop

The schema-placement finding was checked mechanically against the current Go
reference implementations:

- OpenAPI synthesizes a response-body schema and emits the decoded response
  body.
- GraphQL synthesizes and emits a complete GraphQL response envelope.
- gRPC and Connect synthesize message schemas and emit message values.
- AsyncAPI synthesizes payload schemas and emits payload values.
- usage synthesis declares the documented floor output while runtime
  interpretation remains governed by its configuration points.

No equivalent root/member mismatch was found, so this loop made no speculative
changes to those families. Future reviews should repeat the question against
both Go and TypeScript whenever an invocation boundary changes.

The generic OBI-to-MCP projection is also exercised under every installed
non-MCP binding-specification identifier. The family invoker owns the concrete
hop; the adapter sees only the resulting OpenBindings input/output values and
produces the same MCP envelope for OpenAPI, GraphQL, gRPC, Connect, AsyncAPI,
usage, and operation-graph bindings. Those tests establish adapter neutrality,
not substitute end-to-end protocol evidence: each family's processor and
synthesis corpora remain the proof of its concrete hop. A second hermetic
differential joins the layers for one representative non-MCP family by running
an OpenAPI artifact through synthesis, direct OpenAPI invocation, generic MCP
projection, and a real MCP client, then comparing the abstract outputs.

## Open follow-ups

- Run the differential profile against pinned upstream examples: the official
  MCP Everything server first, official SDK example servers second, and
  scheduled real-server canaries last. External servers do not belong in the
  deterministic unit-test lane.
- The Go MCP SDK's typed progress notification uses a scalar `total` with
  `omitempty`; a bridge cannot re-emit the distinction between absent
  `total` and explicit `total: 0` through that API. The binding invoker
  preserves the distinction from raw upstream bytes, but the downstream
  bridge needs an upstream SDK seam (or a narrowly justified transport seam)
  before the re-emission profile can claim that edge.
- Reconcile strict pinned-entity shape validation with synthesis coverage's
  useful ability to identify individual malformed entries. A future ruling
  should say whether one invalid entity invalidates the complete pin or is
  reported as an invalid coverage entry while valid siblings remain usable.
