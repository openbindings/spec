# `asyncapi` binding conventions

**Status: non-normative conventions of record.** Not part of the core specification. This document records how the OpenBindings project binds AsyncAPI — the answers to the [format authoring checklist](README.md#authoring-a-new-binding-format), as implemented by the reference packages (Go `formats/asyncapi`, TS `@openbindings/asyncapi`). A third-party implementation MAY diverge anywhere no core-spec rule binds.

Tier tags: **[format-spec]** — pinned by the AsyncAPI specification; **[convention]** — the OB convention of record as the reference packages implement it; **[assumption]** — a content-independent default a consumer hook may override; **[open]** — deliberately unanswered.

## Format token

Sources declare the exact detected version, `asyncapi@<major.minor>` (e.g. `asyncapi@3.0`); tools advertise the range `asyncapi@^3.0.0`. **[convention]** AsyncAPI 2.x documents are out of the supported range and refused loudly at load. **[convention]**

## `ref` syntax

JSON Pointer to the operation: `#/operations/<operationId>` (a bare operation id without the prefix is accepted on read). **[convention]** Only operations are addressable — channels, messages, and the whole artifact are not binding targets, and a ref is required. **[convention]**

## Source expectations

**Artifact-located**: `location` names the AsyncAPI document (URL); `content` may inline it (object, or a JSON/YAML string). With both present, `content` is authoritative and `location` is provenance — the OBI-T-15 artifact-located pairing. **[convention]** A synthesized source carries the artifact (location, or embedded content when synthesized from content) so it stays invocable as written. **[convention]** The `metadata.baseURL` context key redirects the connection at invocation while the document's declared security still applies. **[convention]**

## Input conventions

The input value is the message payload, wholesale — there is no per-field routing: an HTTP send POSTs the value as the JSON body, a WebSocket send writes it as one text frame. **[convention]** Requests are sent as `application/json`; the declared message `contentType` governs decoding only. **[convention]** No required-field enforcement; unmatched fields ride through.

## Invocation shape

Dispatch is the operation's `action` crossed with the selected server's `protocol`; the reference packages implement the `http`/`https`/`ws`/`wss` protocols (other protocols — kafka, mqtt, amqp — are refused loudly and remain **[open]**):

- `send` + http: unary POST (a 202/204 acknowledgment yields zero outputs).
- `send` + ws: client-streaming publish (zero outputs).
- `receive` + http: SSE subscription (server-streaming).
- `receive` + ws: WebSocket subscription; caller inputs forward as frames (bidi-capable), and closing input does not end the subscription. **[convention]**

Server selection: the first server (sorted by name) whose protocol is supported. **[convention]** A channel without an `address` is assumed addressable by its channel name (the 2.x-lineage habit). **[assumption]** WebSocket connections are pooled per server/address **and per credential identity** — sockets are never shared across differing credentials. **[convention]**

## Wire answers (routing / decode / classify)

- **Routing**: the whole value is the message. **[format-spec/convention]**
- **Decode**: the **declared message `contentType`** decides (operation messages, then reply messages, then the document's `defaultContentType`): strict JSON for `application/json`/`+json` (a declared-JSON body that fails to parse is a loud error), text otherwise — never sniffed. **[assumption]** (this is the catalog's recommended default). The decode hook is consulted per delivery unit — the HTTP response, each SSE event, each WS frame; envelope unwrapping (`{error}`/`{data}`) is deliberately a consumer hook's job, not a built-in. **[convention]**
- **Classify**: not consulted — transport-level HTTP failures are transport errors, not a format verdict (per the catalog table). **[convention]**
- Provenance: `x-ob-decode: spec/content-type|hook` and `x-ob-classify: not-consulted` stamp the HTTP-send lane. **[convention]**

## Authentication and context

Declared security produces a `CONTEXT_REQUIRED` challenge **before any I/O** when unsatisfied; the preflight (`prepareBinding`) is side-effect-free. **[convention]** Security is read from the operation, else from the **same server the connection targets**. **[format-spec/convention]** In AsyncAPI 3.0, `security` is a list of security-scheme objects (or `$ref`s to them) **[format-spec]**; scheme-to-family mapping: `http`+`bearer`/`httpBearer` → `auth.bearer`; `http`+`basic`/`userPassword` → `auth.basic`; `apiKey`/`httpApiKey` → `auth.apiKey`; `oauth2` → `auth.oauth2`. The challenge `target` is the resolved server URL. **[convention]**

Credential application is spec-driven per scheme (declared header/query/cookie for API keys; `Authorization` for bearer/basic/oauth2 access tokens), with the no-scheme fallback chain bearer → basic → apiKey. **[convention]** WebSocket credentials ride the upgrade request (headers and query); where upgrade headers are unavailable (browsers), query parameters carry them. **[convention]** A first-frame bearer message (`{"bearerToken": …}`) is sent once per pooled connection on `receive` subscriptions when a bearer-family scheme is declared — auth never rides `send` message bodies. **[convention]**

## Open points

- Non-HTTP/WS protocol bindings (kafka, mqtt, amqp, …).
- Whole-artifact (absent-ref) addressing.
- Resource policy is tool-defined; the reference packages cap events/responses at 10 MiB per delivery unit (deliberately per-unit, so long-lived subscriptions are unbounded in total) and bound WS idle at 30 s via the pool.
