# `openbindings.mcp` Binding Specification

## 1. Status and identifier

This document is the normative text for the binding specification identifier **`openbindings.mcp@1`**, published by the openbindings project as its defining authority. The identifier is exact and opaque per core [OBI-B-01](../../openbindings.md#104-binding-specification-rules): no range or normalization semantics attach to it. An incompatible change to this specification publishes `openbindings.mcp@2` ([OBI-B-03](../../openbindings.md#104-binding-specification-rules)); compatible clarification may revise this document in place. It publishes with the OpenBindings core 0.2.0 change set, and reference tooling adopts the identifier — replacing the pre-bindingSpec `mcp@…` tokens — in the same coordinated change.

The key words "MUST", "MUST NOT", "REQUIRED", "SHOULD", "SHOULD NOT", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in all capitals.

## 2. Scope and incorporated authorities

This is the **openbindings project's** binding specification for [Model Context Protocol revision 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) (MCP). It is published under this project's authority, not by or for MCP's maintainers: the MCP specification is incorporated by reference and remains authoritative over the protocol — JSON-RPC message shapes, the initialize handshake and its version negotiation, the Streamable HTTP transport including session semantics, capability advertisement, list-request pagination, the tool/resource/prompt object shapes, task-support declarations, and MCP's authorization framework. This specification defines only the OpenBindings overlay: how a source addresses an MCP server and optionally pins its listing, how a binding selects a tool, resource, or prompt, and how caller-facing operation values correspond to MCP requests and results.

**Normative upstream snapshot.** The revision's prose under [`docs/specification/2025-11-25`](https://github.com/modelcontextprotocol/modelcontextprotocol/tree/38c84e9f93ad191d9eb26d92b945d17bd0efcaf3/docs/specification/2025-11-25) and its generated protocol schema [`schema/2025-11-25/schema.json`](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/38c84e9f93ad191d9eb26d92b945d17bd0efcaf3/schema/2025-11-25/schema.json), at official tag commit [`38c84e9f93ad191d9eb26d92b945d17bd0efcaf3`](https://github.com/modelcontextprotocol/modelcontextprotocol/tree/38c84e9f93ad191d9eb26d92b945d17bd0efcaf3), are the incorporated authority. The rendered dated documentation is informative if it ever differs from that source snapshot; the mutable latest specification and later repository revisions do not alter this identifier.

Revision 1's accepted MCP revision envelope is the singleton **`2025-11-25`**. The MCP handshake and negotiation algorithm remain upstream's; the OpenBindings constraint is only the post-negotiation gate: a different negotiated revision is refused before listing or invocation because this revision has not evaluated its entity and result semantics. A compatible clarification of this document may add an upstream revision after establishing that every boundary rule below still holds; implementations do not adopt revisions sight-unseen.

An MCP server's surface is discovered live rather than carried in a standalone artifact, so this family's "artifact" is the server's **listing** — the aggregate of its declared tools, resources, resource templates, and prompts. Sessions, transport lifecycle, and reconnection are the MCP specification's own mechanics, incorporated; connection pooling and client identity are implementation policy, outside this document.

## 3. Accepted source representations

The artifact is the server's listing — always the **pagination-exhausted aggregate**: the list operations paginate via `nextCursor`, and a listing is complete only when every page has been followed to exhaustion. The listing comes in one of two carriages:

- **No `content`** — the listing is obtained live from the addressed server: an MCP initialize handshake, then the list requests (`tools/list`, `resources/list`, `resources/templates/list`, `prompts/list`) — each followed to pagination exhaustion — for each entity family the server's advertised capabilities include; the `resources` capability gates both resource lists (**MCP-P-02**). Version negotiation is the handshake's, per the MCP specification; a processor MUST refuse loudly unless the negotiated protocol revision is in this binding specification's accepted envelope — `2025-11-25` in revision 1 (**MCP-P-01**).
- **`content` present** — a **pinned listing**: a JSON object whose members are `tools` (an array of Tool objects), `resources` (Resource objects), `resourceTemplates` (ResourceTemplate objects), and `prompts` (Prompt objects), each optional, in the result shapes of MCP revision 2025-11-25 (**MCP-D-01**). Each member is the concatenation of that entity's arrays across all pages of an exhausted listing; pagination members (`nextCursor`, `_meta`) and any other member are not part of the representation, and their presence makes the `content` invalid under this specification. A pinned listing makes `ref` resolution offline-checkable and processing independent of list calls.

There is no other representation.

## 4. `location`

A source's `location` is REQUIRED and MUST be an absolute `http`/`https` URI addressing an MCP server's **Streamable HTTP** endpoint (**MCP-D-02**). This family is service-addressed: a listing describes a server, so a `content`-only source addresses nothing and is not conformant under this specification, even though the core's at-least-one-of rule would admit its shape.

The **stdio transport and the deprecated HTTP+SSE transport are excluded** from revision 1: a stdio server is identified by process-lifecycle configuration rather than an address, and binding it would import an executable address form and its security surface (compare [`openbindings.usage@1`](../usage/openbindings.usage.md) §4); a future revision may define one. The exclusion is a definition, not an open item.

## 5. `content`

A source's `content`, when present, MUST be a pinned listing per [§3](#3-accepted-source-representations) (**MCP-D-01**). No other JSON type or shape is an accepted `content` value under this specification.

## 6. Composition

When `content` is present it is the artifact the processor interprets, per the core's content-primacy floor ([§5.4](../../openbindings.md#54-sources)): `ref` resolution and input-surface questions are answered from the pinned listing, and the list requests are not consulted. `location` remains the invocation target — the service-addressed pairing, here defined rather than inherited. A pinned listing contains no references that need a base; this specification defines no reference-base role for `location` (OBI-B-02 item 4: the answer is _none_).

Staleness is the pin's failure mode, and it is defined rather than surprising: the pin stays authoritative for interpretation, dispatch proceeds against it, and a server that no longer serves a pinned entry answers with its own error — a failure outcome under [§9.4](#94-classification), not a resolution failure. A processor MAY compare a pinned listing against the live listing as a freshness diagnostic.

## 7. `ref`

A binding's `ref` is REQUIRED and MUST be `<entity>/<remainder>` (**MCP-D-03**): `<entity>` is exactly one of `tools`, `resources`, `resourceTemplates`, `prompts`, and `<remainder>` is **everything after the first `/`**, taken verbatim for every entity (it may itself contain `/`), and matched **byte-exactly**:

- `tools/<name>` — a declared tool's `name` (`tools/get_weather`).
- `prompts/<name>` — a declared prompt's `name` (`prompts/summarize`).
- `resources/<uri>` — a declared resource's `uri`, from the `resources/list` collection (`resources/file:///logs`).
- `resourceTemplates/<uriTemplate>` — a declared resource template's `uriTemplate` string, from the `resources/templates/list` collection, matched byte-exact — never by a URI that the template happens to expand to (`resourceTemplates/file:///logs/{date}`).

The four entities mirror MCP's own four listable collections (`tools/list`, `resources/list`, `resources/templates/list`, `prompts/list`), each addressed in its own namespace. Because resources and resource templates are separate entities, a resource `uri` and a template `uriTemplate` that happen to be byte-identical (an RFC 6570 template may carry zero expressions) never collide — they are reached by distinct `ref`s.

Resolution is against the listing ([§3](#3-accepted-source-representations)) and is REQUIRED before dispatch for every entity — a processor does not dispatch a `tools/call` or `prompts/get` blind on the ref name: a `ref` matching nothing in its entity's collection makes the binding unresolvable and is refused, uniformly across entities. MCP names are only SHOULD-unique; a listing in which a `ref` matches more than one entry **within its entity's collection** makes that `ref` ambiguous, and the binding is likewise unresolvable — loudly, never first-match. With a pinned listing, resolution is offline-checkable; without one it is checkable only against the live (exhausted) listing, per the core's partial-verification posture.

MCP 2025-11-25 lets a tool declare `execution.taskSupport` as `forbidden`, `optional`, or `required`. Revision 1 does not bind task augmentation: a tool declaring `required` is therefore unresolvable and is refused before dispatch (**MCP-P-08**). A tool with absent or `forbidden` support is invoked normally; a tool declaring `optional` is also invoked normally, one of the two behaviors the artifact expressly permits. A later binding-specification revision may incorporate task creation, result retrieval, status lifecycle, and cancellation. Revision 1 never invokes a required-task tool as an ordinary call and never mistakes a task-creation result for the tool result.

## 8. Target and interaction

Each entity family invokes through its MCP request and carries its own interaction shape:

| Target              | MCP request                                                                         | Interaction                                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool                | `tools/call`                                                                        | Zero or one input value; an output stream per [§9.2](#92-the-tool-output-stream): exactly one result value, preceded by progress values only when solicited |
| Resource (static)   | `resources/read`                                                                    | No input value; one output value                                                                                                                    |
| Resource (template) | `resources/read` after [RFC 6570](https://www.rfc-editor.org/rfc/rfc6570) expansion | Zero or one input value (the template's variables); one output value ([§9.1](#91-input-mapping))                                                    |
| Prompt              | `prompts/get`                                                                       | Zero or one input value; one output value                                                                                                           |

One invocation is one MCP request (plus the notifications MCP attaches to it), after the required-task refusal above. Progress solicitation applies to tool invocations only: processors do not solicit or surface progress for `resources/read` or `prompts/get` in revision 1. Task augmentation and server-initiated MCP features — subscriptions, sampling, elicitation, roots, and log streams — are **excluded** from revision 1's binding surface. Each exclusion is a definition, not an open item.

## 9. Operation-boundary correspondence

### 9.1. Input mapping

There is no field routing in this family; the input value maps whole (**MCP-P-03**). Every refusal below is loud and happens **before the invocation request is dispatched**:

- **Tools**: the input value is the `tools/call` `arguments` object, verbatim. It MUST be a JSON object when supplied; a non-object input is refused. An absent input value omits the `arguments` member.
- **Prompts**: the input value is the `prompts/get` `arguments` object. It MUST be a JSON object when supplied, and MCP prompt arguments are string-typed: every member value MUST be a string — a non-object input or a non-string member is refused, never coerced. An absent input value omits the `arguments` member.
- **Resource templates**: the input value is a JSON object of the template's variables, and a member naming a variable the template does not declare is refused. Values use RFC 6570's own data model, which fits the OpenBindings JSON domain without a new encoding: a string scalar, an array of strings, or a string-keyed object whose values are strings. `null`, numbers, booleans, nested containers, and mixed arrays are refused rather than coerced. The target URI is the template expanded with those values per RFC 6570 — including list/associative expansion and explode/prefix operators — before `resources/read` is sent; a declared variable the input does not supply is undefined under RFC 6570. An absent input value expands with all variables undefined.
- **Static resources** take no input, and a supplied input value is refused.

### 9.2. The tool output stream

A tool invocation's output is a stream whose shape is fixed (**MCP-P-04**): **exactly one result value, always last**, preceded by zero or more progress values — and progress values occur only when solicited.

- **Solicitation is a named configuration point** ([§9.3](#93-configuration-and-result-correspondence)), preserving both protocol-permitted choices. When neither configuration tier chooses, the default is **not solicited**: the processor attaches no `progressToken`, and the stream is the result value alone. This is explicitly an **OpenBindings convention**, reached only after the protocol's alternatives have been exposed as configuration; a determinate stream shape requires a choice, and the no-token alternative adds no protocol traffic or extra operation values. Consumers that want progress opt in knowingly.
- **A progress value's shape is defined**: each correlated progress notification emits one output value that is the notification's `params` object with `progressToken` removed — `{progress, total?, message?}`, **presence-preserving** (an explicit `total: 0` survives; an absent `total` stays absent).
- When solicitation is enabled, the operation's `output` schema governs every value crossing the boundary (core per-value contract): it must admit both the progress shape and the result shape, by alternation or otherwise. It does not filter values.
- The result value terminates the stream. MCP guarantees servers stop _sending_ progress after completion, not that delivery is ordered across streams; a correlated notification arriving after the result is **discarded**, as enforcement of the declared shape — a defined disposal, not silent behavior.

### 9.3. Configuration and result correspondence

This family has **one** named configuration point, consulted per-invocation configuration → consumer-level configuration → the default below; a declined override falls through. Classification is not configurable here ([§9.4](#94-classification)). The default is **content-independent** — decided by protocol structure, never payload bytes (**MCP-P-05**):

| Point                    | Default       | Meaning                                                                                 |
| ------------------------ | ------------- | --------------------------------------------------------------------------------------- |
| **solicit** (tools only) | not solicited | Whether `tools/call` carries a `progressToken`, per [§9.2](#92-the-tool-output-stream). |

For every successful method, the final output is the method's complete MCP result object **sans the JSON-RPC envelope**, preserved in the protocol's JSON shape:

- **Tool results** preserve `content`, `structuredContent` when present, `isError` when present and false, `_meta`, and every other member the incorporated result shape permits. `structuredContent` never suppresses content blocks: MCP permits the two lanes to coexist and does not make every content block a redundant encoding. A result with `isError: true` is classified as failure before this success correspondence applies.
- **Resource results** preserve the complete `{contents, _meta?}` result. Every content item's required `uri`, its `text` or Base64 `blob`, optional `mimeType`, annotations, and metadata remain in place. Neither a single item nor a declared JSON media type unwraps or reparses the protocol object.
- **Prompt results** preserve the complete `{messages, description?, _meta?}` result and every protocol-defined content-block member.

This lossless result boundary is deliberate deference: MCP has already defined the result representation, so OpenBindings has no missing wire question to answer. An OBI author who wants a text scalar, `structuredContent` alone, a decoded resource body, or another projection declares `outputTransform`; processors do not sniff, prefer, unwrap, or discard protocol fields by default.

### 9.4. Classification

Classification is **protocol-native and not a configuration point** (**MCP-P-06**): a `tools/call` result with `isError: true` is a failure outcome, whatever its content; a JSON-RPC error response is a failure outcome; every other completed result is the success correspondence above. Failure outcomes are not operation results and have no representation in this specification; transport-level failures (an HTTP 401/403 on the endpoint included) are likewise the consumer's to surface, and no error-code vocabulary is defined here.

MCP does not define redirect following for its Streamable HTTP endpoint, so whether to follow is runtime policy. Any followed redirect MUST preserve the request's MCP-defined HTTP method, complete body, representation fields, protocol-version field, and established session identity. A redirect whose semantics require, or whose configured client policy would perform, a method rewrite is not followed and remains a transport failure response. Redirect limits and cross-origin credential policy remain runtime concerns; redirect handling never converts a protocol POST into the transport's semantically different GET stream.

### 9.5. Credentials

MCP declares no per-tool security metadata, so nothing is extracted into the OBI and no security requirements are derived from the listing (**MCP-P-07**). Credentials ride the Streamable HTTP transport as ordinary HTTP header fields ([RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)) — a bearer token as `Authorization: Bearer`, any other credential naming a header (`Cookie` included) on that header — on **every** request of the session, the initialize handshake included, per MCP's authorization requirements. A credential that cannot be expressed as a request header is surfaced to the consumer rather than silently skipped.

Credential destinations MUST be pairwise non-colliding and MUST NOT replace a processor-owned transport or MCP session field: `host`, `content-length`, `content-type`, `accept`, `origin`, `mcp-protocol-version`, `mcp-session-id`, or `last-event-id`. Header names compare ASCII case-insensitively. A collision refuses before the affected request rather than assigning precedence or allowing credential material to redefine framing, version negotiation, session routing, or stream resumption. MCP's authorization framework (its OAuth-based flow discovery) is transport-level upstream mechanics, incorporated; how a consumer acquires and refreshes credentials is a runtime concern, and the project's [`binding-invoker`](https://openbindings.com/interfaces/binding-invoker) interface defines one such negotiation surface (informative).

### 9.6. Transform positions

This specification defines **no** context bindings at transform positions: a transform on an mcp binding evaluates in the core's closed environment, unaugmented.

## 10. Conformance

Rules carry stable identifiers under the same discipline as the core's: never reused, never renumbered. Source rules bind OBI content governed by this specification; processor rules bind implementations claiming support for `openbindings.mcp@1`. Verification follows the core's partial-verification posture.

- **MCP-D-01**: `content`, when present, is a pinned listing — pagination-exhausted entity arrays under `tools`/`resources`/`resourceTemplates`/`prompts` members in the 2025-11-25 result shapes, no other members — per [§3](#3-accepted-source-representations) and [§5](#5-content).
- **MCP-D-02**: `location` is present and is an absolute `http`/`https` URI addressing a Streamable HTTP MCP endpoint; a `content`-only source is not conformant, per [§4](#4-location).
- **MCP-D-03**: `ref` is present and is `<entity>/<remainder>` with the remainder taken verbatim after the first `/` for every entity, matched byte-exactly per [§7](#7-ref).
- **MCP-P-01**: Protocol-revision negotiation follows the MCP handshake, and a negotiated revision outside this binding specification's accepted envelope — the singleton `2025-11-25` in revision 1 — is refused loudly before listing or invocation, per [§2](#2-scope-and-incorporated-authorities) and [§3](#3-accepted-source-representations).
- **MCP-P-02**: Live listings are obtained via the capability-gated list requests, each followed to pagination exhaustion; a pinned listing displaces them entirely; resolution against the listing precedes dispatch for every entity, and ambiguous matches are unresolvable, per [§3](#3-accepted-source-representations), [§6](#6-composition), and [§7](#7-ref).
- **MCP-P-03**: Input values map per [§9.1](#91-input-mapping), with each stated pre-dispatch refusal (non-object tool or prompt input, non-string prompt argument, a resource-template variable outside RFC 6570's string/list/associative data model, undeclared template variable, input supplied to a static resource).
- **MCP-P-04**: A tool invocation's stream is exactly one result value, last, preceded by progress values only when solicited; the progress value is the notification's `params` minus `progressToken`, presence-preserving; correlated notifications after the result are discarded, per [§9.2](#92-the-tool-output-stream).
- **MCP-P-05**: `solicit` is the family's sole configuration point and defaults to not solicited; successful tool, resource, and prompt results preserve the complete MCP method-result object sans JSON-RPC envelope, with no sniffing, lane preference, unwrapping, reparsing, or discarded protocol fields, per [§9.3](#93-configuration-and-result-correspondence).
- **MCP-P-06**: Classification is protocol-native per [§9.4](#94-classification) and is not a configuration point; redirect following is runtime policy, but any followed redirect preserves the MCP request method, complete body, protocol fields, and session identity.
- **MCP-P-07**: No security metadata is derived from listings or written into OBI documents; credentials ride the transport as HTTP headers on every session request, inexpressible credentials are surfaced, and collisions with other credentials or processor-owned transport/session fields refuse before the affected request, per [§9.5](#95-credentials).
- **MCP-P-08**: A tool declaring `execution.taskSupport: required` is unresolvable and refused before dispatch; absent/`forbidden` tools and `optional` tools invoked through revision 1 use ordinary `tools/call`, per [§7](#7-ref). Task augmentation is excluded rather than approximated.

Conformance fixtures keyed to these identifiers are published with the project's conformance corpus. Deterministic _generation_ of OBI documents from MCP listings (operation-key derivation from tool names, schema carriage) is a synthesis concern outside this specification; the project's interface-synthesizer and reference-tool documentation record those conventions.

## 11. References

- **[MCP]** "Model Context Protocol," specification revision 2025-11-25, official source snapshot [`38c84e9f93ad191d9eb26d92b945d17bd0efcaf3`](https://github.com/modelcontextprotocol/modelcontextprotocol/tree/38c84e9f93ad191d9eb26d92b945d17bd0efcaf3). Incorporated authority for the protocol ([§2](#2-scope-and-incorporated-authorities)); the [rendered dated documentation](https://modelcontextprotocol.io/specification/2025-11-25) is informative if it differs.
- **[RFC 6570]** "URI Template." <https://www.rfc-editor.org/rfc/rfc6570>. Incorporated for resource-template expansion ([§9.1](#91-input-mapping)).
- **[RFC 9110]** "HTTP Semantics." <https://www.rfc-editor.org/rfc/rfc9110>. Cited for header-field credential carriage ([§9.5](#95-credentials)).
- **[OpenBindings]** The OpenBindings core specification, `openbindings.md` in this repository.
- **[BCP 14]** RFC 2119 / RFC 8174 (key words).
- The [catalog README](../README.md) (informative) — completeness doctrine and configuration-point semantics this specification instantiates.
