# `graphql` binding conventions

**Status: pre-promotion draft — mints no identifier.** Seed material for the future `openbindings.graphql` binding specification: no `openbindings.graphql@<rev>` identifier exists until this page is restructured to the [authoring template](../README.md#authoring-a-new-binding-specification) and meets the completeness floor of [OBI-B-02](../../openbindings.md#104-binding-specification-rules). Until promotion it remains a non-normative conventions record, not part of the core specification, and its citations may still reference pre-rewrite core numbering and retired rules; both are corrected at promotion. This document records how the OpenBindings project binds GraphQL — the answers to the [format authoring checklist](../README.md#authoring-a-new-binding-specification), as implemented by the reference packages (Go `formats/graphql`, TS `@openbindings/graphql`). A third-party implementation MAY diverge anywhere no core-spec rule binds.

Tier tags: **[format-spec]** — pinned by the GraphQL specification and the graphql-over-http/graphql-transport-ws conventions; **[convention]** — the OB convention of record as the reference packages implement it; **[assumption]** — a content-independent default a consumer hook may override; **[open]** — deliberately unanswered.

## Format token

`graphql`, versionless — any endpoint supporting introspection. **[convention]**

## `ref` syntax

`<RootType>/<field>` with the root type exactly one of `Query`, `Mutation`, `Subscription` (case-sensitive PascalCase), and the field matched case-sensitively against the schema. **[convention]** A ref is required; there is no whole-artifact binding. **[convention]**

## Source expectations

**Service-addressed**: `location` is the live GraphQL HTTP endpoint, used for POST execution and (scheme-swapped `http`→`ws`) the subscription upgrade. **[convention]** `content` may pin the schema as an inline introspection result — accepted as the full response (`{"data":{"__schema":…}}`), the wrapper (`{"__schema":…}`), or the bare schema object — in which case live introspection is skipped and `location` remains the invocation target (the OBI-T-15 service-addressed pairing). **[convention]**

## Input conventions

The input value is the GraphQL **variables** object. **[convention]** The `_query` input convention: when an operation's input schema declares a `_query` property with a string `const`, that constant is the complete query document — introspection is skipped, `_query` is stripped, and the remaining fields pass as variables verbatim. The reference synthesizer embeds `_query` on every synthesized operation. **[convention]** Without `_query`, the query is synthesized from introspection (auto-generated selection sets, depth-bounded and cycle-safe, with `__typename` + inline fragments for unions/interfaces — an exploration fallback, not necessarily optimal) and variables are filtered to the field's declared arguments. **[convention]**

## Invocation shape

Queries and mutations are unary HTTP POSTs of `{query, variables}`. **[format-spec/convention]** Subscriptions are server-streaming over WebSocket with the `graphql-transport-ws` subprotocol (`connection_init` → `connection_ack` → `subscribe`; each `next` payload is one output; `complete` closes cleanly). **[format-spec/convention]**

## Wire answers (routing / decode / classify)

GraphQL's envelope answers decode and classify natively, so the consumer-hook seam is not consulted and no provenance stamps are emitted. **[convention]**

- **Decode**: the response is JSON; the emitted output is the requested field's bare value, `data[<field>]`. **[convention]**
- **Classify** (the 200-with-errors question): a response with a non-empty `errors` array is a **terminal invocation error**, even alongside partial `data` — errors win, and the error detail carries the full `errors` list. **[convention]** A subscription `next` payload with errors is likewise terminal. HTTP-level: a successful execution is a 2xx with the envelope; 401/403 map to auth/permission errors. **[convention]**

## Authentication and context

GraphQL introspection exposes no security metadata, so no `CONTEXT_REQUIRED` challenge is derivable and none is issued — credentials are supplied up front, and runtime 401/403 surface as terminal auth/permission errors. **[convention]** Credentials apply as HTTP headers (fallback chain bearer → apiKey → basic on `Authorization`), plus context `headers` and `cookies`. **[convention]** Subscription credentials ride the WebSocket upgrade request where the platform allows; where upgrade headers are unavailable (browsers), the `Authorization` value is forwarded in the `connection_init` payload as `{authorization: …}` — a server must accept both placements to serve all clients. **[convention]**

## Open points

- Partial-data delivery alongside errors (currently discarded; a consumer needing partials would need a format-level election that does not exist yet).
- Persisted queries / APQ; GET transport; `@defer`/`@stream`.
- Schema-pinning freshness (introspection is cached per normalized endpoint for the invoker's lifetime; refresh policy is tool-defined).
