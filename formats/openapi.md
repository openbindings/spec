# `openapi` binding conventions

**Status: non-normative conventions of record.** Not part of the core specification. This document records how the OpenBindings project binds OpenAPI 3.x — the answers to the [format authoring checklist](README.md#authoring-a-new-binding-format), as implemented by the reference packages (Go `formats/openapi`, TS `@openbindings/openapi`). OpenAPI's own specification is the authority over HTTP wire mechanics; this document records only the OB-overlay conventions — what the artifact alone does not decide. A third-party implementation MAY diverge anywhere no core-spec rule binds; this document exists so it can know, without reading reference source, what it would be diverging from.

Tier tags: **[format-spec]** — pinned by the OpenAPI specification or plain HTTP; **[convention]** — the OB convention of record as the reference packages implement it; **[assumption]** — a content-independent default a consumer hook may override; **[open]** — deliberately unanswered.

## Format token

Sources declare the exact version detected from the artifact's own `openapi:` field, as `openapi@<major.minor>` (`openapi@3.0`, `openapi@3.1`); tools advertise the caret range `openapi@^3.0.0`. **[convention]** Range matching is same-major with a `(minor, patch)` floor; exact-token comparison normalizes a trailing `.0` (`openapi@3.1.0` ≡ `openapi@3.1`); a versionless `openapi` token matches no versioned range. **[convention]** A mismatch between the source token and the artifact's self-declared version is not checked at invocation — the artifact governs its own interpretation. **[convention]**

## `ref` syntax

A JSON Pointer of the shape `#/paths/<escaped-path>/<method>` — addressing the **operation object** (RFC 6901 escaping for the path segment, method case-insensitive in the ref, one of the eight HTTP methods). **[convention]** A ref is **required**: OpenAPI defines no whole-artifact invocation, so an absent or non-`/paths` ref is an invocation error before any I/O. **[convention]** A well-formed ref whose path or method is missing from the artifact is a not-found invocation error.

## Source expectations

**Artifact-located**: `location` names the OpenAPI document itself. `content` may inline it — as the parsed object or as a JSON/YAML string. With both present, `content` is the authoritative artifact and `location` is provenance — the OBI-T-15 artifact-located pairing. **[convention]** References internal to a located artifact resolve per OpenAPI's own rules against the document's URL **[format-spec]**; embedded content is self-contained per OBI-D-15 (bundle before embedding).

## Input conventions — the flattened model

The operation contract presents one flat input object; each field routes by name against the operation's declared surface (path-level and operation-level `parameters` merged, operation-level winning on collision **[format-spec]**):

- `path` parameters substitute into the URL template (values percent-encoded); `query` parameters join the query string; `header` parameters ride as request headers; declared `cookie` parameters join a `Cookie` header. **[format-spec/convention]**
- A field that is both a declared parameter and a declared body property is **one name, one value, delivered to every declared wire location** — it rides the parameter location AND stays in the body (see [the catalog](README.md#field-naming-across-protocol-locations)); synthesis warns on the merge. **[convention]**
- A field matching no declared parameter or body property passes through into the JSON body when the operation declares a request body, and is dropped when it does not. **[convention]**
- Parameter `style`/`explode` serialization is **not implemented** — scalar values stringify plainly; array-valued parameters have no pinned serialization. **[open]** (a known gap against OpenAPI's serialization surface).
- Required enforcement: a bare input close (no value written) with any required parameter or required request body refuses before dispatch; a written value missing required members is sent as-is — the server's declared validation is the authority. **[convention]**
- Non-object request bodies (an array or scalar body schema) are represented in the contract under a synthetic `body` property; the invoker sends the contract shape literally. **[convention]** (a flatten-model artifact; see Open points). Multipart bodies are chosen only when `multipart/form-data` is declared and `application/json` is not; properties with `format: binary` carry bytes, other members serialize as JSON parts. **[convention]**
- Request `Content-Type` is `application/json` for every non-multipart body, regardless of what the artifact declares. **[convention]** The request `Accept` header is `application/json, text/event-stream`. **[convention]**

## Servers and the base URL

The effective server is `servers[0]`; server variables are not substituted. **[convention]** A relative server URL (`/api/v3`) resolves against the source `location`'s **origin**. **[convention]** The `metadata.baseURL` context key overrides server selection entirely — the escape hatch for environments, embedded sources with relative servers, and variable-bearing templates. **[convention]** No resolvable server is an invocation error before dispatch.

## Invocation shape

Client side is unary: exactly one input value. Responses are unary — except that a 2xx response declaring `Content-Type: text/event-stream` is a **server-streaming** invocation: each SSE event emits one output (`data:` lines joined; `event:`/`id:`/`retry:` ride per-event metadata), and stream end closes the output. **[convention]** NDJSON and other streaming framings are **[open]**.

## Wire answers (routing / decode / classify)

Routing is spec-answered (parameter locations); decode and classify are the catalog's two held-fixed HTTP-lane conventions, consulted through the decode/classify hooks (per-invocation → invoker-level → built-in):

- **Decode — the header rule**: the response `Content-Type` header decides. `application/json` and `+json` suffixes parse strictly (a declared-JSON body that fails to parse is a loud error, never a silent string); anything else — including binary types and an absent header — is the text lane; an empty body (204 included) yields `null`. **[assumption]** Never the payload bytes.
- **Classify — the 2xx rule**: success iff status ∈ 2xx; declared `responses` refine failure details, never classification. 401 → auth-required, 403 → permission-denied; failure details carry `{status, body}`. **[assumption]** Redirects are followed by the HTTP client (a surviving 3xx is a failure). **[convention]**
- Provenance: success responses stamp `x-ob-decode: header/content-type|hook` and `x-ob-classify: assumption/2xx|hook`. **[convention]** The field router is not consulted (routing is spec-answered).

## Authentication and context

Security derives from the operation's `security` (which **replaces** document-level entirely, including an explicit `[]` meaning anonymous), else the document's. **[format-spec]** Unsatisfied requirements produce a `CONTEXT_REQUIRED` challenge **before any input is read or network touched**; the OR-of-AND requirement lists map onto the challenge's `alternatives[].requirements[]`, and `target` is the resolved base URL. **[convention]**

Scheme mapping: `http`/`basic` → `auth.basic`; `http`/`bearer` → `auth.bearer`; `apiKey` → `auth.apiKey`; `oauth2` → `auth.oauth2` carrying `grantType`/`authorizeUrl`/`tokenUrl`/`scopes` (flow preference: authorizationCode, then implicit, then password, then clientCredentials; `grantType` names the selected flow); `openIdConnect` → `auth.oauth2` with `openIdConnectUrl`. A scheme with no mapping is **surfaced, not dropped**: it emits a requirement typed from the artifact's own scheme (`http`/`digest` → `auth.http.digest`; `mutualTLS` → `auth.mutualTLS`; any other unmapped type `T` → `auth.<T>`) that the reference packages cannot themselves apply — the alternative stays discoverable, unselectable only for runtimes without a resolver for that family (binding-invoker rule 10), and a document whose every alternative is unmapped produces a readable challenge instead of an unauthenticated dispatch into a blind 401. Each requirement carries the scheme's declared `name` (its `securitySchemes` key). **[convention]** Credential application is scheme-driven (API keys to their declared header/query/cookie; bearer/basic/OAuth access tokens to `Authorization`), with the no-scheme fallback chain bearer → basic → apiKey; an API-key scheme named `N` resolves its key scheme-scoped — `apiKeys[N]` first, the single `apiKey` convenience as fallback — so one alternative ANDing several API keys stays distinguishable. **[convention]**

## Synthesis conventions that shape the contract

Operation keys sanitize `operationId` (else path+method), deduplicated deterministically; paths and methods are processed in a fixed order so both reference SDKs emit identical documents. Cookie parameters are excluded from synthesized input schemas. Output schemas come from the first of 200/201/202 preferring a JSON media type. Artifact schemas translate to JSON Schema 2020-12 keyed on the artifact's declared version. Security metadata is never written into the OBI. The param/body collision warning is `openapi.param_body_collision`. **[convention]**

## Open points

- Parameter `style`/`explode` serialization (including array-valued query/header parameters) — unimplemented; documents needing them should prefer body carriage today.
- Server-variable substitution.
- Non-multipart binary request bodies; unwrapping the synthetic `body` property at the wire.
- NDJSON/chunked streaming framings.
- Content negotiation on requests (`Content-Type` is always JSON today; artifacts declaring only non-JSON request media types are not honored).
- Token-vs-artifact version mismatch diagnostics.
- Multi-file synthesis with external-file `$ref`s in a request/response body schema: the Go reference inliner resolves only internal `#/components/schemas/<name>` refs, so a genuine external-file `$ref` in an operation schema can survive into emitted embedded `content` (a dangling reference against OBI-D-15 self-containment); the TS package's full dereference resolves HTTP-reachable external refs. Single-document specs with internal refs bundle cleanly on both sides. Aligning Go to a full-closure walker is tracked as reference-implementation work.
