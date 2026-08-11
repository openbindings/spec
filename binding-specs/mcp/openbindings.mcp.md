# `openbindings.mcp` Binding Specification

## 1. Status and identifier

**Status: unreleased first-revision candidate.** This document proposes **`openbindings.mcp@1`** as the first project identifier for this family. The identifier has not been published and this candidate remains mutable. Publication will mint the exact, opaque identifier under core [OBI-B-01](../../openbindings.md#104-binding-specification-rules); later incompatible changes will require a different identifier under [OBI-B-03](../../openbindings.md#104-binding-specification-rules).

The key words "MUST", "MUST NOT", "REQUIRED", "SHOULD", "SHOULD NOT", "MAY", and "OPTIONAL" are interpreted as described in BCP 14 when, and only when, they appear in all capitals.

## 2. Scope and incorporated authorities

This is the openbindings project's binding specification for Model Context Protocol revision **2025-11-25**. The normative upstream authority is the official repository at tag commit [`38c84e9f93ad191d9eb26d92b945d17bd0efcaf3`](https://github.com/modelcontextprotocol/modelcontextprotocol/tree/38c84e9f93ad191d9eb26d92b945d17bd0efcaf3): its prose under `docs/specification/2025-11-25` and generated `schema/2025-11-25/schema.json`. That authority governs JSON-RPC, initialization and version negotiation, Streamable HTTP, sessions, capability advertisement, pagination, and MCP entity and result shapes. This specification defines only the OpenBindings overlay.

The accepted MCP revision envelope is the singleton `2025-11-25`. The MCP handshake and negotiation algorithm remain upstream's; after negotiation, another revision is refused before listing or invocation (**MCP-P-01**). Later MCP revisions do not silently alter this identifier.

An MCP server's source artifact is its pagination-exhausted listing. The concrete MCP session remains available to the binding implementation so it can interact correctly. MCP envelopes, content blocks, progress notifications, transport fields, and other native observations do not thereby become ordinary OpenBindings operation values.

## 3. Accepted source representations

The artifact is the aggregate of every page of each capability-advertised `tools/list`, `resources/list`, `resources/templates/list`, and `prompts/list` collection. It has two carriages:

- With no `content`, the processor initializes the addressed server, checks the negotiated revision, and obtains every advertised collection to pagination exhaustion. The `resources` capability gates both resource collections (**MCP-P-02**).
- Present `content` is a pinned listing: a JSON object whose only permitted members are `tools`, `resources`, `resourceTemplates`, and `prompts`, each an optional array of the corresponding MCP 2025-11-25 entity objects (**MCP-D-01**). Each array is already the pagination-exhausted aggregate. Pagination members such as `nextCursor` and `_meta`, and every other top-level member, make the pin invalid.

There is no other source representation. The complete listing remains the discovery inventory even though this candidate deliberately binds only an eligible subset of its entries.

## 4. `location`

`location` is REQUIRED and MUST be an absolute `http` or `https` URI addressing an MCP Streamable HTTP endpoint (**MCP-D-02**). This family is service-addressed: pinned content describes a server but does not address it.

The stdio and deprecated HTTP+SSE transports are excluded. Stdio requires executable-address and process-lifecycle semantics that this revision does not define.

## 5. `content`

Present `content` MUST be the pinned-listing object defined in [§3](#3-accepted-source-representations) (**MCP-D-01**). No other JSON value is accepted.

## 6. Composition

Present `content` is authoritative for listing interpretation under core content primacy. It displaces live list requests, while `location` remains the invocation target. The pin contains no references requiring a base, so `location` has no reference-base role.

The pin may be stale. Dispatch still proceeds against the addressed server; a server response showing that the declared target is no longer available is an unsuccessful invocation, not permission to substitute a live listing. A processor MAY compare the pin to live discovery diagnostically.

## 7. `ref` and eligible targets

A candidate binding `ref` is REQUIRED and MUST be `tools/<name>`, where `<name>` is the non-empty remainder after the first `/` and is matched byte-exactly to a listed tool name (**MCP-D-03**). Exactly one tool must match. Zero matches and duplicate matches are unresolvable; declaration order never resolves ambiguity.

The matched tool MUST declare an `outputSchema` (**MCP-P-04**). MCP defines that member as the schema for the application object returned in `CallToolResult.structuredContent`; it is therefore the source's application-level output contract. A tool without `outputSchema` is not bindable in this candidate because its remaining result lanes are MCP-native representations, not a protocol-independent application contract.

A tool declaring `execution.taskSupport: required` is also unresolvable (**MCP-P-08**). Task creation and retrieval are not ordinary tool-result invocation. Absent, `forbidden`, and `optional` task support use an ordinary `tools/call`; choosing ordinary invocation for `optional` is one of the alternatives the artifact expressly permits.

Resources, resource templates, and prompts remain part of the listing inventory but are not binding targets in this candidate. Their listing entries do not declare application output schemas. Recompiling their MCP result and content-block shapes into OBI output schemas would expose the protocol rather than abstract it. Coverage-aware synthesis and inspection report these entries as excluded rather than silently omitting them.

## 8. Target and interaction

The target is the listed tool selected by `ref`, invoked with one `tools/call`. The abstract interaction is unary: zero or one input application value and exactly one successful output application value.

This candidate does not solicit MCP progress. Progress notifications are protocol-native observability and do not cross as operation values. Task augmentation, resources, prompts, subscriptions, sampling, elicitation, roots, and log streams are excluded. These are coverage boundaries, not invitations for processors to approximate them.

## 9. Operation-boundary correspondence

### 9.1. Input mapping

The caller input maps whole to the `tools/call` `arguments` member (**MCP-P-03**). When supplied it MUST be a JSON object and is carried verbatim. When absent, `arguments` is omitted. A non-object is refused before dispatch. There is no field-routing convention.

### 9.2. Successful output mapping

For a successful call, the single operation output is `CallToolResult.structuredContent`, unchanged (**MCP-P-04**). It MUST be present and MUST satisfy the selected tool's `outputSchema`; absence or nonconformance makes the invocation unsuccessful. The tool's `outputSchema` is the complete application output schema available to synthesis; no MCP wrapper is added around it.

`content`, `_meta`, an explicit false `isError`, progress, JSON-RPC carriage, HTTP fields, and session facts are not additional operation values or output-schema members. A binding implementation may use them internally and may retain them through an explicit diagnostic surface. Correct ordinary operation use MUST NOT depend on their native representation.

### 9.3. Classification and unsuccessful completion

Classification is protocol-native and not configurable (**MCP-P-06**). A `tools/call` result with `isError: true`, a JSON-RPC error response, an unsuccessful Streamable HTTP interaction, or a missing/nonconforming `structuredContent` value completes the invocation unsuccessfully. No such outcome is emitted as an operation output.

The binding uses native facts internally but defines no universal error vocabulary and requires no MCP code, result envelope, HTTP status, header, or entity bytes to cross the ordinary boundary. Implementations MAY retain those facts diagnostically. An implementation may surface a tool-authored human message without requiring callers to understand its MCP representation.

MCP does not define redirect following for its Streamable HTTP endpoint. Redirect policy is runtime surface. Any followed redirect MUST preserve the request method, complete body, MCP representation fields, protocol-version field, and established session identity; a redirect requiring method rewriting is not followed.

### 9.4. Credentials

MCP listings declare no per-tool security metadata, so none is synthesized into an OBI (**MCP-P-07**). Credentials ride the Streamable HTTP requests as HTTP headers: a bearer token uses `Authorization: Bearer`; another credential must name its header destination. A credential without an expressible header destination is surfaced for context resolution. Credential collisions with one another or with processor-owned transport/session fields are refused before the affected request.

### 9.5. Transform positions

This specification defines no context bindings at transform positions. Transforms evaluate in the core's closed environment, unaugmented.

## 10. Conformance

- **MCP-D-01**: Present `content` is the pinned-listing object of §3 and §5.
- **MCP-D-02**: `location` is a required absolute HTTP(S) Streamable HTTP endpoint.
- **MCP-D-03**: `ref` is a required `tools/<name>` reference resolving byte-exactly and unambiguously to one listed tool.
- **MCP-P-01**: Negotiation follows MCP and accepts only revision `2025-11-25`.
- **MCP-P-02**: Live advertised listings are capability-gated and pagination-exhausted; a pin displaces live listing; resolution precedes dispatch.
- **MCP-P-03**: Caller input maps whole and verbatim to an optional object-valued `arguments` member.
- **MCP-P-04**: Only non-task-required tools with `outputSchema` are bindable; successful output is exactly conforming `structuredContent`; native result lanes and progress do not become operation values.
- **MCP-P-06**: `isError`, JSON-RPC error, transport failure, and missing/nonconforming structured output complete unsuccessfully; native evidence is not required on the ordinary boundary; redirect handling preserves MCP semantics.
- **MCP-P-07**: Listings yield no security metadata; credentials use explicit HTTP-header carriage and collisions refuse.
- **MCP-P-08**: Required-task tools are unresolvable; optional task support uses ordinary invocation.

Conformance fixtures keyed to these identifiers are maintained in the project corpus. Operation-key naming is tooling policy, not part of this binding specification.

## 11. References

- Model Context Protocol 2025-11-25, official source snapshot at commit `38c84e9f93ad191d9eb26d92b945d17bd0efcaf3`.
- The OpenBindings core specification, `openbindings.md` in this repository.
- BCP 14: RFC 2119 and RFC 8174.
