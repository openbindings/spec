# `mcp` binding conventions

**Status: non-normative conventions of record.** Not part of the core specification. This document records how the OpenBindings project binds the Model Context Protocol — the answers to the [format authoring checklist](README.md#authoring-a-new-binding-format), as implemented by the reference packages (Go `formats/mcp`, TS `@openbindings/mcp`). A third-party implementation MAY diverge anywhere no core-spec rule binds.

Tier tags: **[format-spec]** — pinned by the MCP specification (revision 2025-11-25); **[convention]** — the OB convention of record as the reference packages implement it; **[assumption]** — a content-independent default a consumer hook may override; **[open]** — deliberately unanswered.

## Format token

Exact, date-versioned: `mcp@2025-11-25` — one token per protocol revision, no range semantics (protocol revisions are dates, not semver). **[convention]** In-session protocol-version negotiation is the MCP `initialize` handshake's job. **[format-spec]**

## `ref` syntax

`<entity>/<name>` with entity one of `tools`, `resources`, `prompts` (`tools/get_weather`, `resources/file:///logs`, `prompts/summarize`). **[convention]** All three entities are invocable: tools via `tools/call`, resources via `resources/read`, prompts via `prompts/get`. A ref is required. **[convention]**

## Source expectations

**Service-addressed**: `location` is the MCP server endpoint URL, spoken over the Streamable HTTP transport (stdio and legacy SSE transports are not bound by this convention). **[convention]** The artifact (the server's tool/resource/prompt listing) is discovered live via the initialize handshake and list requests, gated on the server's advertised capabilities. **[format-spec/convention]** Embedded `content` pinning the listing is the OBI-T-15 service-addressed intent but is not yet consumed by the reference packages — see Open points.

## Input conventions

Tools and prompts take one input message — the named-arguments object (prompt argument values stringified per MCP's string-typed prompt arguments); resources take no input. **[format-spec/convention]** A non-object tool input is refused before any I/O. There is no field routing — the arguments object is the whole wire input. **[convention]**

## Invocation shape

Tools: one input, streaming-capable output — `notifications/progress` events emit as outputs ahead of the final result, which is always last. Resources: no input, one output. Prompts: one input, one output (`{messages, description?}`). **[convention]**

## Wire answers (routing / decode / classify)

These follow the project's MCP decode ruling: outcomes are functions of declaration, never payload bytes.

- **Decode, tools**: `structuredContent` — MCP's declared structured lane — wins outright. Absent it, a **single text content block is a string, verbatim** (JSON-as-text servers are handled by consumer opt-in through the decode hook, never by sniffing); other content shapes pass through as content. **[convention]**
- **Decode, resources**: the declared `mimeType` decides, exactly as the HTTP header rule — strict JSON for `application/json`/`+json` (malformed declared-JSON is a loud error), text otherwise. **[assumption]**
- **Classify**: protocol-native — `CallToolResult.isError` is a terminal invocation error; the classify hook is not consulted. **[format-spec/convention]** JSON-RPC errors carry `{code, data}` in the error details; HTTP 401/403 map to auth/permission errors.
- Provenance: tools stamp `x-ob-decode` ∈ {`structuredContent`, `text`, `content`, `hook`} and `x-ob-classify: protocol/isError`; resources stamp `x-ob-decode` ∈ {`declared/mime-type`, `content`, `hook`}. **[convention]**

## Authentication and context

Context credentials apply as HTTP headers on the transport (`bearerToken` → `Authorization: Bearer`; else `apiKey` → `Authorization: ApiKey`; else `basic`; plus context `headers`/`cookies`). **[convention]** MCP exposes no per-tool security metadata to derive a static challenge from, so no `CONTEXT_REQUIRED` preflight is issued; an unauthenticated call surfaces as a terminal auth error and resolution happens above the binding. **[convention]**

## Open points

- Embedded `content` as a pinned listing (the OBI-T-15 service-addressed pairing's artifact half) — not yet consumed.
- RFC 6570 expansion for resource templates (template refs are addressable but invoked with the raw template URI today).
- Credentialed discovery (synthesis/inspection currently connects unauthenticated).
- Resource subscriptions, sampling, elicitation — MCP features outside the current binding surface.
- Session lifecycle (pooling vs per-invocation) and client identity are tool-defined; the reference packages differ today and alignment is tracked as SDK work, not a convention.
