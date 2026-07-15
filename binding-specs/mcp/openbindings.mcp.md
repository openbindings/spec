# `openbindings.mcp` Binding Specification

## 1. Status and identifier

This document is the normative text for the binding specification identifier **`openbindings.mcp@1`**, published by the openbindings project as its defining authority. The identifier is exact and opaque per core [OBI-B-01](../../openbindings.md#104-binding-specification-rules): no range or normalization semantics attach to it. An incompatible change to this specification publishes `openbindings.mcp@2` ([OBI-B-03](../../openbindings.md#104-binding-specification-rules)); compatible clarification may revise this document in place. It publishes with the OpenBindings core 0.2.0 change set, and reference tooling adopts the identifier — replacing the pre-bindingSpec `mcp@…` tokens — in the same coordinated change.

The key words "MUST", "MUST NOT", "REQUIRED", "SHOULD", "SHOULD NOT", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in all capitals.

## 2. Scope and incorporated authorities

This is the **openbindings project's** binding specification for the [Model Context Protocol](https://modelcontextprotocol.io/specification/) (MCP). It is published under this project's authority, not by or for MCP's maintainers: the MCP specification is incorporated by reference and remains authoritative over the protocol — JSON-RPC message shapes, the initialize handshake and its version negotiation, the Streamable HTTP transport including session semantics, capability advertisement, list-request pagination, the tool/resource/prompt object shapes, and MCP's authorization framework. This specification is defined against MCP revision **2025-11-25** and defines only the OpenBindings overlay: how a source addresses an MCP server and optionally pins its listing, how a binding selects a tool, resource, or prompt, and how caller-facing operation values correspond to MCP requests and results.

An MCP server's surface is discovered live rather than carried in a standalone artifact, so this family's "artifact" is the server's **listing** — the aggregate of its declared tools, resources, resource templates, and prompts. Sessions, transport lifecycle, and reconnection are the MCP specification's own mechanics, incorporated; connection pooling and client identity are implementation policy, outside this document.

## 3. Accepted source representations

The artifact is the server's listing — always the **pagination-exhausted aggregate**: the list operations paginate via `nextCursor`, and a listing is complete only when every page has been followed to exhaustion. The listing comes in one of two carriages:

- **No `content`** — the listing is obtained live from the addressed server: an MCP initialize handshake, then the list requests (`tools/list`, `resources/list`, `resources/templates/list`, `prompts/list`) — each followed to pagination exhaustion — for each entity family the server's advertised capabilities include; the `resources` capability gates both resource lists (**MCP-P-02**). Version negotiation is the handshake's, per the MCP specification; a processor MUST refuse loudly a session whose negotiated protocol revision it does not implement (**MCP-P-01**). Which revisions a processor implements is its own declaration.
- **`content` present** — a **pinned listing**: a JSON object whose members are `tools` (an array of Tool objects), `resources` (Resource objects), `resourceTemplates` (ResourceTemplate objects), and `prompts` (Prompt objects), each optional, in the result shapes of MCP revision 2025-11-25 (**MCP-D-01**). Each member is the concatenation of that entity's arrays across all pages of an exhausted listing; pagination members (`nextCursor`, `_meta`) and any other member are not part of the representation, and their presence makes the `content` invalid under this specification. A pinned listing makes `ref` resolution offline-checkable and processing independent of list calls.

There is no other representation.

## 4. `location`

A source's `location` is REQUIRED and MUST be an absolute `http`/`https` URI addressing an MCP server's **Streamable HTTP** endpoint (**MCP-D-02**). This family is service-addressed: a listing describes a server, so a `content`-only source addresses nothing and is not conformant under this specification, even though the core's at-least-one-of rule would admit its shape.

The **stdio transport and the deprecated HTTP+SSE transport are excluded** from revision 1: a stdio server is identified by process-lifecycle configuration rather than an address, and binding it would import an executable address form and its security surface (compare [`openbindings.usage@1`](../usage/openbindings.usage.md) §4); a future revision may define one. The exclusion is a definition, not an open item.

## 5. `content`

A source's `content`, when present, MUST be a pinned listing per [§3](#3-accepted-source-representations) (**MCP-D-01**). No other JSON type or shape is an accepted `content` value under this specification.

## 6. Composition

When `content` is present it is the artifact the processor interprets, per the core's content-primacy floor ([§5.4](../../openbindings.md#54-sources)): `ref` resolution and input-surface questions are answered from the pinned listing, and the list requests are not consulted. `location` remains the invocation target — the service-addressed pairing, here defined rather than inherited. A pinned listing contains no references that need a base; this specification defines no reference-base role for `location` (OBI-B-02 item 4: the answer is *none*).

Staleness is the pin's failure mode, and it is defined rather than surprising: the pin stays authoritative for interpretation, dispatch proceeds against it, and a server that no longer serves a pinned entry answers with its own error — a failure outcome under [§9.4](#94-classification), not a resolution failure. A processor MAY compare a pinned listing against the live listing as a freshness diagnostic.

## 7. `ref`

A binding's `ref` is REQUIRED and MUST be `<entity>/<remainder>` (**MCP-D-03**): `<entity>` is exactly one of `tools`, `resources`, `prompts`, and `<remainder>` is **everything after the first `/`**, taken verbatim for every entity (it may itself contain `/`), and matched **byte-exactly**:

- `tools/<name>` — a declared tool's `name` (`tools/get_weather`).
- `prompts/<name>` — a declared prompt's `name` (`prompts/summarize`).
- `resources/<uri-or-template>` — matched first against declared resources' `uri` values, then against declared resource templates' `uriTemplate` values (`resources/file:///logs`, `resources/file:///logs/{date}`). A template is addressed by its template string, byte-exact — never by a URI that the template happens to match.

Resolution is against the listing ([§3](#3-accepted-source-representations)) and is REQUIRED before dispatch for every entity — a processor does not dispatch a `tools/call` or `prompts/get` blind on the ref name: a `ref` matching nothing in the listing makes the binding unresolvable and is refused, uniformly across entities. MCP names are only SHOULD-unique; a listing in which a `ref` matches more than one entry makes that `ref` ambiguous, and the binding is likewise unresolvable — loudly, never first-match. With a pinned listing, resolution is offline-checkable; without one it is checkable only against the live (exhausted) listing, per the core's partial-verification posture.

## 8. Target and interaction

Each entity family invokes through its MCP request and carries its own interaction shape:

| Target | MCP request | Interaction |
| --- | --- | --- |
| Tool | `tools/call` | One input value; an output stream per [§9.2](#92-the-tool-output-stream): exactly one result value, preceded by progress values only when solicited |
| Resource (static) | `resources/read` | No input value; one output value |
| Resource (template) | `resources/read` after [RFC 6570](https://www.rfc-editor.org/rfc/rfc6570) expansion | One input value (the template's variables); one output value ([§9.1](#91-input-mapping)) |
| Prompt | `prompts/get` | One input value; one output value |

One invocation is one MCP request (plus the notifications MCP attaches to it). Progress solicitation applies to tool invocations only: processors do not solicit or surface progress for `resources/read` or `prompts/get` in revision 1. Server-initiated MCP features — subscriptions, sampling, elicitation, roots, and log streams — are **excluded** from revision 1's binding surface. Each exclusion is a definition, not an open item.

## 9. Operation-boundary correspondence

### 9.1. Input mapping

There is no field routing in this family; the input value maps whole (**MCP-P-03**). Every refusal below is loud and happens **before the invocation request is dispatched**:

- **Tools**: the input value is the `tools/call` `arguments` object, verbatim. It MUST be a JSON object when supplied; a non-object input is refused. An absent input value omits the `arguments` member.
- **Prompts**: the input value is the `prompts/get` `arguments` object. It MUST be a JSON object when supplied, and MCP prompt arguments are string-typed: every member value MUST be a string — a non-object input or a non-string member is refused, never coerced. An absent input value omits the `arguments` member.
- **Resource templates**: the input value is a JSON object of the template's variables; every member value MUST be a string, and a member naming a variable the template does not declare is refused. The target URI is the template expanded with those values per RFC 6570 before `resources/read` is sent; a declared variable the input does not supply follows RFC 6570's undefined-value expansion. An absent input value expands with all variables undefined.
- **Static resources** take no input, and a supplied input value is refused.

### 9.2. The tool output stream

A tool invocation's output is a stream whose shape is fixed (**MCP-P-04**): **exactly one result value, always last**, preceded by zero or more progress values — and progress values occur only when solicited.

- **Solicitation is a named configuration point** ([§9.3](#93-configuration-points)). The default is **not solicited**: the processor attaches no `progressToken`, and the stream is the result value alone. The default keeps a binding's observable stream realization-neutral — the same operation bound over another family yields just its result — and consumers that want progress opt in knowingly.
- **A progress value's shape is defined**: each correlated progress notification emits one output value that is the notification's `params` object with `progressToken` removed — `{progress, total?, message?}`, **presence-preserving** (an explicit `total: 0` survives; an absent `total` stays absent).
- When solicitation is enabled, the operation's `output` schema governs every value crossing the boundary (core per-value contract): it must admit both the progress shape and the result shape, by alternation or otherwise. It does not filter values.
- The result value terminates the stream. MCP guarantees servers stop *sending* progress after completion, not that delivery is ordered across streams; a correlated notification arriving after the result is **discarded**, as enforcement of the declared shape — a defined disposal, not silent behavior.

### 9.3. Configuration points

This family has **two** named configuration points, consulted per-invocation configuration → consumer-level configuration → the defaults below; a declined override falls through. Classification is not configurable here ([§9.4](#94-classification)). All defaults are **content-independent** — decided by declarations and protocol structure, never payload bytes (**MCP-P-05**):

| Point | Default | Meaning |
| --- | --- | --- |
| **solicit** (tools only) | not solicited | Whether `tools/call` carries a `progressToken`, per [§9.2](#92-the-tool-output-stream). |
| **decode** | the rules below | How successful results become output values. |

- **Tool results**: `structuredContent` — MCP's declared structured lane — wins outright when present. Absent it, a result whose `content` is a **single text block** decodes to that text, **verbatim as a string** (a JSON-emitting server that only writes text blocks is handled by consumer opt-in at this point, never by sniffing). Any other `content` shape passes through as the content array, verbatim in MCP's block shapes.
- **Resource results**: the output value is **always the array** of decoded contents items, in order — uniformly, so the value's shape never depends on how many items the server returned (`contents: []` yields `[]`; authors who want a bare single value declare an `outputTransform`). Each item decodes by protocol structure first: a `blob` item passes as its Base64 string as MCP carries it, whatever `mimeType` it declares; a `text` item decodes by its declared `mimeType`, exactly as the HTTP header rule — strict JSON for `application/json`/`+json` (malformed declared-JSON is a loud error), text otherwise, text when no `mimeType` is declared.
- **Prompt results**: the `prompts/get` result sans JSON-RPC envelope — `{messages, description?}` in MCP's shapes — is the output value, verbatim.

### 9.4. Classification

Classification is **protocol-native and not a configuration point** (**MCP-P-06**): a `tools/call` result with `isError: true` is a failure outcome, whatever its content; a JSON-RPC error response is a failure outcome; every other completed result is the success the decode rules above apply to. Failure outcomes are not operation results and have no representation in this specification; transport-level failures (an HTTP 401/403 on the endpoint included) are likewise the consumer's to surface, and no error-code vocabulary is defined here.

### 9.5. Credentials

MCP declares no per-tool security metadata, so nothing is extracted into the OBI and no security requirements are derived from the listing (**MCP-P-07**). Credentials ride the Streamable HTTP transport as ordinary HTTP header fields ([RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)) — a bearer token as `Authorization: Bearer`, any other credential naming a header (`Cookie` included) on that header — on **every** request of the session, the initialize handshake included, per MCP's authorization requirements. A credential that cannot be expressed as a request header is surfaced to the consumer rather than silently skipped. MCP's authorization framework (its OAuth-based flow discovery) is transport-level upstream mechanics, incorporated; how a consumer acquires and refreshes credentials is a runtime concern, and the project's [`binding-invoker`](https://openbindings.com/interfaces/binding-invoker) interface defines one such negotiation surface (informative).

### 9.6. Transform positions

This specification defines **no** context bindings at transform positions: a transform on an mcp binding evaluates in the core's closed environment, unaugmented.

## 10. Conformance

Rules carry stable identifiers under the same discipline as the core's: never reused, never renumbered. Source rules bind OBI content governed by this specification; processor rules bind implementations claiming support for `openbindings.mcp@1`. Verification follows the core's partial-verification posture.

- **MCP-D-01**: `content`, when present, is a pinned listing — pagination-exhausted entity arrays under `tools`/`resources`/`resourceTemplates`/`prompts` members in the 2025-11-25 result shapes, no other members — per [§3](#3-accepted-source-representations) and [§5](#5-content).
- **MCP-D-02**: `location` is present and is an absolute `http`/`https` URI addressing a Streamable HTTP MCP endpoint; a `content`-only source is not conformant, per [§4](#4-location).
- **MCP-D-03**: `ref` is present and is `<entity>/<remainder>` with the remainder taken verbatim after the first `/` for every entity, matched byte-exactly per [§7](#7-ref).
- **MCP-P-01**: Protocol-revision negotiation follows the MCP handshake, and an unimplemented negotiated revision is refused loudly, per [§3](#3-accepted-source-representations).
- **MCP-P-02**: Live listings are obtained via the capability-gated list requests, each followed to pagination exhaustion; a pinned listing displaces them entirely; resolution against the listing precedes dispatch for every entity, and ambiguous matches are unresolvable, per [§3](#3-accepted-source-representations), [§6](#6-composition), and [§7](#7-ref).
- **MCP-P-03**: Input values map per [§9.1](#91-input-mapping), with each stated pre-dispatch refusal (non-object tool or prompt input, non-string prompt argument or template variable, undeclared template variable, input supplied to a static resource).
- **MCP-P-04**: A tool invocation's stream is exactly one result value, last, preceded by progress values only when solicited; the progress value is the notification's `params` minus `progressToken`, presence-preserving; correlated notifications after the result are discarded, per [§9.2](#92-the-tool-output-stream).
- **MCP-P-05**: The solicit and decode configuration points apply the defaults of [§9.3](#93-configuration-points) — solicitation off; `structuredContent` first, single-text-block verbatim, content passthrough; resource results always the array of structurally decoded items; prompt results verbatim.
- **MCP-P-06**: Classification is protocol-native per [§9.4](#94-classification) and is not a configuration point.
- **MCP-P-07**: No security metadata is derived from listings or written into OBI documents; credentials ride the transport as HTTP headers on every session request, and inexpressible credentials are surfaced, per [§9.5](#95-credentials).

Conformance fixtures keyed to these identifiers are published with the project's conformance corpus. Deterministic *generation* of OBI documents from MCP listings (operation-key derivation from tool names, schema carriage) is a synthesis concern outside this specification; the project's interface-synthesizer and reference-tool documentation record those conventions.

## 11. References

- **[MCP]** "Model Context Protocol," specification revision 2025-11-25. <https://modelcontextprotocol.io/specification/>. Incorporated authority for the protocol ([§2](#2-scope-and-incorporated-authorities)).
- **[RFC 6570]** "URI Template." <https://www.rfc-editor.org/rfc/rfc6570>. Incorporated for resource-template expansion ([§9.1](#91-input-mapping)).
- **[RFC 9110]** "HTTP Semantics." <https://www.rfc-editor.org/rfc/rfc9110>. Cited for header-field credential carriage ([§9.5](#95-credentials)).
- **[OpenBindings]** The OpenBindings core specification, `openbindings.md` in this repository.
- **[BCP 14]** RFC 2119 / RFC 8174 (key words).
- The [catalog README](../README.md) (informative) — completeness doctrine and configuration-point semantics this specification instantiates.
