# OpenBindings Specification (v0.2.0-draft)

This is a **working draft toward version 0.2.0** of the OpenBindings specification.

- This document is licensed under the Apache 2.0 License (see `LICENSE`).
- The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in all capitals.

## Scope of this spec

OpenBindings (OBI) is a **portable interface description format**. Services publish an OBI document describing their operations and how to reach them; tools consume OBIs to drive protocol-specific clients, power registries, feed agents, and so on.

This spec defines **what an OBI document is**: its shape, identity, discovery convention, reference-resolution rules, and forward-compatibility rules. It also defines **a minimum conformance floor for tools** that preserves document portability across implementations. It does not define **higher-level tool behavior**. Comparison, matching, transform execution semantics, security method resolution, binding invocation, and registry semantics are tool concerns.

The openbindings project publishes reference tools (`ob` CLI, `openbindings-go`, `openbindings-ts`) as one implementation of this spec. Third-party tools are free to adopt their conventions or publish their own.

## Table of contents

- [Overview](#overview)
- [Terminology](#terminology)
- [Document shape](#document-shape)
  - [Operations](#operations)
  - [Schemas](#schemas)
  - [Bindings](#bindings)
  - [Sources](#sources)
  - [Transforms](#transforms)
  - [Security](#security)
  - [Roles](#roles)
- [Discovery](#discovery)
- [Binding sufficiency](#binding-sufficiency)
- [Interface identity](#interface-identity)
- [Location equality](#location-equality)
- [Reference resolution](#reference-resolution)
- [Versioning](#versioning)
- [IANA considerations](#iana-considerations)
- [Security considerations](#security-considerations)
- [Conformance](#conformance)
- [Extensions](#extensions)
- [See also](#see-also)

---

## Overview

OpenBindings separates what a service does (operations with input/output schemas) from how you access it (bindings to OpenAPI, AsyncAPI, gRPC, MCP, or any other binding specification). A single OBI document can reference bindings in multiple protocols without redefining the operation contract. Services can publish their OBI at a well-known location so tools can discover and act on it.

OBI documents are JSON.

A minimal OBI document:

```json
{
  "openbindings": "0.2.0",
  "operations": {}
}
```

A more realistic OBI showing multi-protocol exposure, schema reuse, a transform, a role claim, and a security reference:

```json
{
  "openbindings": "0.2.0",
  "name": "Task Manager",
  "roles": {
    "taskmanager": "https://interfaces.example.com/task-manager/v1.json"
  },
  "schemas": {
    "Task": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        "done": { "type": "boolean" }
      },
      "required": ["id", "title"]
    }
  },
  "operations": {
    "createTask": {
      "description": "Create a new task.",
      "input": {
        "type": "object",
        "properties": { "title": { "type": "string" } },
        "required": ["title"]
      },
      "output": { "$ref": "#/schemas/Task" },
      "satisfies": [
        { "role": "taskmanager", "operation": "tasks.create" }
      ]
    },
    "listTasks": {
      "description": "List all tasks.",
      "output": {
        "type": "array",
        "items": { "$ref": "#/schemas/Task" }
      }
    }
  },
  "sources": {
    "httpApi": { "format": "openapi@3.1", "location": "./openapi.json" },
    "mcpServer": { "format": "mcp@2025-11-25", "location": "https://example.com/mcp" }
  },
  "transforms": {
    "apiToTask": {
      "type": "jsonata",
      "expression": "{ \"id\": task_id, \"title\": task_title, \"done\": is_done }"
    }
  },
  "security": {
    "apiAuth": [ { "type": "bearer" } ]
  },
  "bindings": {
    "createTask.http": {
      "operation": "createTask",
      "source": "httpApi",
      "ref": "#/paths/~1tasks/post",
      "security": "apiAuth",
      "outputTransform": { "$ref": "#/transforms/apiToTask" }
    },
    "createTask.mcp": {
      "operation": "createTask",
      "source": "mcpServer",
      "ref": "tools/create_task"
    },
    "listTasks.http": {
      "operation": "listTasks",
      "source": "httpApi",
      "ref": "#/paths/~1tasks/get"
    }
  }
}
```

## Terminology

- **OBI**: shorthand for "OpenBindings interface document."
- **Operation**: a named unit of capability with optional input/output schemas. Stored under a key in the document's `operations` map.
- **Binding**: a mapping from an operation to a specific entry in a binding-specification artifact (OpenAPI, AsyncAPI, gRPC, MCP, etc.).
- **Binding artifact**: the protocol-specific specification document or endpoint referenced by a source (e.g., an OpenAPI document, a `.proto` file, an MCP endpoint).
- **Source**: a reference to a binding-specification artifact, identified by a format token and either a location or embedded content.
- **Transform**: a shape mapping between an operation's `input`/`output` schemas and a source's expected wire shape. Stored under a key in the document's `transforms` map, or inline on a binding.
- **Role**: another OBI document referenced as a shared interface contract (its operations and schemas define the contract; any bindings it carries are ignored in the role context).
- **Location**: the URI from which a document was retrieved, or a caller-supplied base URI for documents loaded without a canonical retrieval URI.

Whether an OBI is "compatible with" another OBI, "satisfies" a role, or is "aligned with" a target interface depends on tool-defined comparison and matching semantics. This spec does not define those.

---

## Document shape

An OBI document is a JSON object. Top-level fields:

| Field | Type | Required | Purpose |
|---|---|---|---|
| `openbindings` | string | yes | Spec version the document declares (SemVer). |
| `operations` | object | yes | Map of operation keys to operation objects. |
| `name` | string | no | Human-friendly label. Not an identifier. |
| `version` | string | no | Author-declared contract version. Opaque to this spec. |
| `description` | string | no | Human-friendly description. |
| `schemas` | object | no | Map of schema names to JSON Schema objects. |
| `roles` | object | no | Map of role keys to URIs of other OBI documents referenced as shared contracts. |
| `sources` | object | no | Map of source keys to source objects. |
| `bindings` | object | no | Map of binding keys to binding objects. |
| `transforms` | object | no | Map of transform names to transform objects. |
| `security` | object | no | Map of security-entry keys to arrays of security method objects. |

Operation keys MUST be unique within a document. Binding, source, transform, role, schema, and security-entry keys MUST be unique within their respective maps. All map keys (operation, binding, source, transform, role, schema, security-entry, and example keys) and all operation aliases MUST match the pattern `^[A-Za-z_][A-Za-z0-9_.-]*$`. This constrains identifiers to a codegen-friendly ASCII subset while permitting common conventions like dotted grouping (`createTask.http`) or hyphenated names (`my-operation`).

### Operations

Operations do not prescribe execution pattern. Whether an operation is request/response, streaming, bidirectional, or pub/sub is determined by the binding, not by the operation definition. The operation model is shaped to accommodate any of these patterns that its binding implements.

Operations whose output varies in shape (e.g., distinct success and error variants, or multiple event types in a streaming binding) express the variants as alternatives in `output`, typically via `oneOf` or `anyOf`. Discrimination between variants is a binding-format and tool concern.

An operation object MAY contain:

| Field | Type | Purpose |
|---|---|---|
| `input` | JSON Schema, `null`, or absent | Shape of input to this operation. |
| `output` | JSON Schema, `null`, or absent | Shape of output from this operation. |
| `description` | string | Human-readable description. |
| `deprecated` | boolean | Hint that consumers should migrate. |
| `tags` | array of strings | Documentation labels for grouping/filtering. |
| `aliases` | array of strings | Alternate names by which this operation MAY be recognized. |
| `satisfies` | array of objects | Each object has shape `{"role": string, "operation": string}`, declaring that this operation is intended to fulfill a named operation within a role interface. |
| `idempotent` | boolean | Hint that multiple invocations with the same input produce the same observable state. |
| `examples` | object | Map of example names to `{description?, input?, output?}` objects. |

`input` and `output` are optional. Absent and `null` are equivalent; both mean "unspecified." `{}` (the empty schema) is NOT equivalent to absent; it means "documented as accepting any JSON value." This three-way distinction preserves author intent: "unspecified" lets downstream tools reject the operation or prompt for clarification, while `{}` signals that the author has chosen to accept any value and codegen tools can generate a pass-through type.

The `input` and `output` schemas are caller-facing contracts that run in opposite directions. A service implementing the operation accepts at minimum every value validating against `input` and may accept more; a caller sending any value validating against `input` is honoring the input contract. A service implementing the operation produces only values validating against `output` and may produce a narrower set; a caller receiving a successful result can rely on it validating against `output`.

`aliases` declares alternate names the author considers equivalent to the operation's key. Common cases include a prior name kept for continuity after a rename, or a vendor-specific name that some consumers look up by. Tools comparing or matching operations across documents MAY treat an operation's key and its aliases interchangeably. The spec defines only the declaration; matching semantics are a tool concern. An alias MUST NOT duplicate any operation's key or alias elsewhere in the document; a name that resolves to multiple operations doesn't identify any of them.

`aliases` and `satisfies` are both author declarations that can inform cross-contract recognition, but they declare different things. `aliases` are additional names this operation is known by; a consumer holding an alias and a consumer holding the key refer to the same operation. `satisfies` is a claim of correspondence to a named operation in a different contract; it is not a name this operation is known by, and a consumer cannot refer to this operation by the name of what it satisfies. An operation MAY use both independently.

`idempotent` is a contract-level claim that consumers (retry logic, caching layers, client-side dedup, agent planners) can rely on: every binding for this operation MUST preserve the guarantee. If a protocol-specific binding can't honor it (e.g., a non-idempotent HTTP verb wrapping a handler that creates a new resource each call), the operation should not carry the flag.

`examples` holds author-supplied sample input/output pairs for an operation. The spec defines only the structural shape; consumers such as generated docs, SDK codegen, test harnesses, and agent few-shot material apply them as they see fit. Each example's `input` SHOULD validate against the operation's `input` schema, and each `output` SHOULD validate against the `output` schema.

An operation's `input` and `output` schemas may be inlined or referenced via `$ref` into the document's `schemas` map or into an external schema document.

### Schemas

The top-level `schemas` map holds named JSON Schema objects. Operations reference them via `$ref` (e.g., `{"$ref": "#/schemas/Task"}`).

Schemas are JSON Schema documents. This spec does not restrict which JSON Schema keywords may appear. Tools that reason about schemas (for comparison, validation, code generation, etc.) decide which keywords they support; tools that simply preserve schemas through round-trips do not.

The default dialect is JSON Schema 2020-12. Schemas MAY declare a different dialect via `$schema`.

### Bindings

A binding object MUST contain:

| Field | Type | Purpose |
|---|---|---|
| `operation` | string | Key into the document's `operations` map. |
| `source` | string | Key into the document's `sources` map. |

And MAY contain:

| Field | Type | Purpose |
|---|---|---|
| `ref` | string | Pointer into the source artifact identifying the specific operation. Format-specific. |
| `priority` | number | Preference hint for binding selection. Lower is more preferred. |
| `security` | string | Key into the document's `security` map. |
| `description` | string | Human-readable description. |
| `deprecated` | boolean | Hint that this binding is being phased out. |
| `inputTransform` | transform object or `$ref` | See [Transforms]. |
| `outputTransform` | transform object or `$ref` | See [Transforms]. |

`ref` identifies a specific entry within the source artifact. Its syntax depends on the source's `format`. For formats whose artifacts are JSON or YAML structures (e.g., `openapi`, `asyncapi`), `ref` is conventionally an [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) JSON Pointer as a URI fragment (`#/paths/~1tasks/post`). Other formats adopt whatever addressing scheme is idiomatic for that format, such as a tool name for `mcp`, or a fully-qualified method name for `grpc`. The spec does not enumerate these; format communities converge on shared conventions. When `ref` is absent, the binding targets the source artifact as a whole; what "whole-artifact targeting" means is a format-community concern.

Multiple bindings MAY reference the same operation. The operation's `input` and `output` schemas form a portable contract, and each binding for that operation is an alternative target authored to honor that contract over a specific protocol. A caller invokes the operation through any one of its bindings; using one binding is a complete invocation of the operation. Selection among alternatives is a tool concern; see `priority`.

`priority` (on bindings, and on sources in the next section) is a preference signal for selecting among multiple bindings for the same operation; lower values are more preferred. The spec does not prescribe what the preference means; authors encode their own axis, such as canonical vs mirror, stable vs experimental, cheap vs expensive, or newer protocol vs fallback. Source-level priority provides a default for every binding using that source; binding-level priority, when present, overrides that default for a specific binding rather than combining with it. This keeps the common case ergonomic (set once per source) while allowing per-binding exceptions. Whether and how tools consume priority is a tool concern. When multiple bindings share the lowest priority (or omit priority entirely), selection is tool-defined; authors who want deterministic ordering set distinct priorities.

### Sources

A source object MUST contain:

| Field | Type | Purpose |
|---|---|---|
| `format` | string | Format token. See below. |

And MUST contain at least one of:

| Field | Type | Purpose |
|---|---|---|
| `location` | string | URI or relative reference to an external binding artifact. |
| `content` | value | Embedded binding content. Object for JSON-structured formats; string for text-based formats. |

And MAY contain:

| Field | Type | Purpose |
|---|---|---|
| `description` | string | Human-readable description. |
| `priority` | number | Preference hint applied to all bindings using this source. |

When `content` is a string, it holds the UTF-8 source text of the binding artifact (for example, a `.proto` file's source, or a KDL document). When `content` is an object, it holds the parsed JSON representation of the artifact. Binary artifacts MUST be carried via `location` rather than embedded; `content` is for textual and JSON-structured forms only. Format communities determine which textual or structural representation is canonical for a given format; a format may accept only one form, or both. If both `location` and `content` are present for the same source, `content` is authoritative and `location` is informational only. Authors may choose to set both when they want a self-contained document (the embedded `content` makes processing independent of network fetches) while preserving the canonical origin URL for documentation, provenance, or downstream tools that prefer a live fetch.

**Format tokens.** The `format` field is a string that identifies the binding specification for a source. Format tokens are community-extensible; what characters appear in them and how different strings relate to one another (equivalence, compatibility, ordering) is determined by each format's own community. The openbindings project recommends the convention `<name>@<version>` (e.g., `openapi@3.1`, `mcp@2025-11-25`) as an interoperable default and MAY publish a registry of well-known tokens at `openbindings.com`.

`location` is resolved per [Reference resolution].

### Transforms

Transforms map between operation schemas and source schemas when the two differ in shape. They exist so a single operation contract can be reused across bindings whose wire shapes diverge (the operation presents a clean domain model; the bound OpenAPI path wraps requests in envelopes; the MCP tool returns content blocks). Declaring transforms in the OBI keeps shape-translation intent with the interface rather than scattered across per-tool configuration.

The transform fields carry directional meaning. `inputTransform`, when declared, applies to caller-provided input on its way to the binding's source, transforming the operation's `input` shape into the source's expected input shape. `outputTransform`, when declared, applies to the binding's output on its way to the caller, transforming the source's output shape into the operation's `output` shape.

This spec defines the structural form of a transform plus a minimum interop floor for the `type` field. Tools that execute transforms SHOULD support `type: "jsonata"` so that documents using it are portable across execution tools. Other `type` values MAY be supported. Tools that do not execute transforms (validators, indexers, doc generators) MAY ignore `type` entirely. Execution semantics, including how expressions evaluate, how errors propagate, and which additional `type` values are meaningful, are tool concerns.

A transform object has:

| Field | Type | Required | Purpose |
|---|---|---|---|
| `type` | string | yes | Transform language identifier. Community-extensible. |
| `expression` | string | yes | Transform expression in the language identified by `type`. |

Named transforms MAY be defined in the top-level `transforms` map and referenced by binding entries via `$ref` (e.g., `{"$ref": "#/transforms/fromApiOutput"}`). Bindings MAY also inline transforms directly.

### Security

An OBI document MAY declare named security entries that bindings reference. Each entry is an array of security method objects in preference order:

```json
{
  "security": {
    "api-auth": [
      {"type": "oauth2", "authorizeUrl": "https://...", "tokenUrl": "https://..."},
      {"type": "bearer"}
    ]
  }
}
```

Each security method MUST contain:

| Field | Type | Required | Purpose |
|---|---|---|---|
| `type` | string | yes | Security method identifier. Community-extensible. |

And MAY contain a `description` string plus any additional fields the method's `type` requires.

This spec does not define what any particular `type` means. Security method semantics (what `bearer` requires from a client, how `oauth2` flows are driven, etc.) are tool concerns. The openbindings project aligns with well-known authentication schemes defined in external specifications (RFC 6750 for bearer, OAuth 2.0 RFCs for `oauth2`, etc.).

### Roles

Roles let a service declare that it satisfies a published interface contract — a shared definition of operations that independent services can claim to implement. This lets consumers match services by the role they play rather than by vendor-specific URLs or names.

A role is just another OBI document, referenced by URI. A role document MAY consist of only operations and schemas (a pure contract that describes what a service does without describing how to reach any particular implementation), or MAY include bindings. Role-ness is a consumption perspective, not a document type: any OBI can be used as a role, regardless of what the publishing author anticipated. This lets an author publish a single OBI that doubles as their own implementation doc and a contract others claim to satisfy, and it lets a consumer treat someone else's implementation-focused OBI as a role without coordination. When any OBI is referenced as a role, only its operations and schemas contribute to the contract; any bindings it carries describe its own implementation and are ignored by consumers of the role.

Several task-tracking services might each declare they satisfy a shared `taskmanager` role; a client written against the role can work with any of them without per-vendor code.

The top-level `roles` map declares the roles this document claims to satisfy. Each entry maps a local role key to a URI reference:

```json
{
  "roles": {
    "taskmanager": "https://interfaces.example.com/task-manager/v1.json",
    "oauth2": "./oauth2-interface.json"
  }
}
```

- Each `roles` value MUST be a valid URI or relative URI reference. Relative references are resolved per [Reference resolution].
- Role keys are local to the declaring document. The same role key in two different documents does not imply the same role; identity between two role references is determined by the resolved URIs under [Location equality].

The `satisfies` fields on operations (see [Operations]) reference `role` keys in this map plus a target operation name. For each `satisfies` entry:

- The `role` field MUST reference a key that exists in the document's top-level `roles` map. An operation that declares `satisfies` with a `role` value not present in `roles` is an invalid document.
- The `operation` field MUST be a non-empty string. The author claims it names an operation in the role interface by its key or by any of its declared aliases; the spec does not require the named operation to exist at the role URI (verification is a tool concern). It requires only that the claim be structurally well-formed.
- An operation's `satisfies` array MAY contain multiple entries, each declaring satisfaction of a different role's operation. An operation's `satisfies` array MUST NOT contain duplicate entries (same `role` + `operation` pair appearing twice).

A `satisfies` declaration is a *claim* by the document author that the declaring operation is intended to fulfill the named role's operation. It is an affirmative assertion of semantic correspondence, not a mere documentation hint: the author is stating that this operation does the job the role's operation describes. Codifying the claim as a structured field (rather than leaving it to free-form prose) makes it machine-readable, so registries, matchers, and agent routing layers can treat role correspondence as first-class metadata. The spec makes no assertion about whether the claim is accurate. Verification of satisfaction (structural, semantic, or otherwise) is a tool concern.

---

## Discovery

A service MAY publish its OBI document at the URI path `/.well-known/openbindings` on its primary origin. The `/.well-known/` namespace follows [RFC 8615](https://www.rfc-editor.org/rfc/rfc8615), which reserves this prefix for interoperable service-metadata endpoints. A 404 at this path simply means "no OBI here"; it is not an error condition. This convention addresses the one-interface-per-origin case. Origins that host multiple distinct interfaces (gateways, monorepos, multi-tenant platforms) are out of scope for the well-known convention and rely on other discovery mechanisms. Other discovery mechanisms (registries, configuration, service meshes) are out of scope for this spec.

### Response contract

When serving an OBI at `/.well-known/openbindings`:

- The method is `GET`.
- A successful response returns `200 OK` with a body containing a valid OBI document.
- The response `Content-Type` SHOULD be `application/vnd.openbindings+json`. `application/json` MAY be used and MUST be accepted by clients.
- If the service does not publish an OBI at this path, the response is `404 Not Found`.
- Any other response (including `3xx`, other `4xx`, `5xx`, or `200` whose body is not a valid OBI) is outside the scope of this spec; clients MAY treat such responses as if no OBI is published at this path.
- Discovery endpoints MAY require authentication or authorization. Whether to publish an OBI to unauthenticated clients is a deployment decision; this spec does not mandate public discovery.

---

## Binding sufficiency

Each binding in an OBI document identifies a concrete interaction target. The information required to make that identification MUST be contained in the binding itself, its referenced source, and the document's discovery context (the base URI used for relative reference resolution per [Reference resolution], plus any content the document embeds). A consumer that understands the source's format can identify the target from that information alone.

Sufficiency does not extend to reachability. Whether the identified target is currently reachable, accepts a caller's credentials, or succeeds at call time are properties of the running service and its deployment, not of the document. An OBI is conformant whether or not the target it identifies is callable at any given moment.

Format communities define the syntax and addressing semantics of `ref` values for their format, including conventions for the absent-`ref` case. If resolving a `ref` requires information beyond the OBI document and its discovery context (for example, external registries, vendor catalogs, or environment configuration), a binding using that source does not satisfy the sufficiency rule above and is non-conformant.

---

## Interface identity

An OBI document is identified by its **location**: the URI from which the document was retrieved. There is no separate `id` field. The document's location is its canonical identity for references, deduplication, and comparison with other documents.

Location-based identity keeps identity resolvable: any tool receiving a reference to an OBI can fetch and verify it in one step, without a separate name-to-location lookup. An author-declared `id` field would be authoritative only to the author and could silently drift from the URL at which the document actually lives.

The optional `name` field is a human-friendly label, not an identifier.

Published interfaces SHOULD be hosted at stable URIs. Authors who want version-stable references SHOULD use versioned path segments (e.g., `https://interfaces.example.com/task-manager/v1.json`). Interface URIs are not snapshots; if the document at a URI changes, references to it see the change.

This model works without a central registry or content-addressed store to mediate lookups. Integrity checks, version pinning, and supply-chain verification are consumer concerns that compose on top of URL fetches; none need identity-layer support.

Trust in an interface depends on the authenticated discovery context or the trust placed in the hosting location, not on the document's contents.

---

## Location equality

Location equality answers whether two URIs refer to the same OBI. It matters wherever the spec uses URIs to establish identity: comparing role values across documents, deduplicating references during processing, and recognizing the same interface seen from multiple entry points.

Two locations are equal iff they produce the same canonical form, compared byte-for-byte. Before comparison, bare filesystem paths are lifted to `file://` URIs per RFC 8089, since equality operates on URIs rather than on paths that could belong to either side of a network boundary. The canonical form is then produced by applying, in order:

1. Host labels converted to A-label form per RFC 3987 / UTS #46.
2. Syntax-based normalization per RFC 3986 §6.2.2: lowercase scheme and host, percent-encoding normalization of unreserved characters, dot-segment removal.
3. Scheme-based normalization per RFC 3986 §6.2.3: remove the default port for the scheme, and replace an empty path with `/` when the URI has an authority.
4. Fragment component stripped: fragments address *within* a document, not the document itself, so they do not change which document is identified.

The following remain significant after normalization:

- **Scheme**: `http` and `https` are distinct. The difference is a transport-level change in origin, even when the host and path match.
- **Trailing slash on non-empty paths**: `/x` and `/x/` are distinct. HTTP convention treats these as different resources, and the spec defers to that convention rather than second-guessing server routing.
- **Query component**: different query strings yield distinct locations, since queries select different resources or views.
- **Userinfo** (`user:pass@`): distinct userinfo yields distinct URIs. Authors SHOULD NOT include userinfo in role values; credentials embedded in URIs leak through logs, telemetry, and error paths.
- **Path and query case**: RFC 3986 treats these as case-sensitive; normalization does not lowercase them. Servers commonly treat case as meaningful.

The URI used for equality is the declared URI (or caller-supplied base), regardless of any HTTP redirects encountered during fetching.

---

## Reference resolution

Relative URI references appear in three places in an OBI document:

1. `roles[*]` values (role URIs).
2. `sources[*].location` values (binding artifact URIs).
3. Schema `$ref` values within inline or external schemas.

All are resolved per RFC 3986 §5 Reference Resolution, using the declaring document's canonical URI as the base URI. Resolution is directory-relative: RFC 3986's merge step strips everything after the last `/` in the base URI's path before appending the reference.

Example. Document at `https://example.com/interfaces/host.json`:

- `./foo.json` → `https://example.com/interfaces/foo.json`
- `../other/foo.json` → `https://example.com/other/foo.json`
- `/foo.json` → `https://example.com/foo.json`
- `https://other.example.com/foo.json` → unchanged (absolute URI; base not consulted)

Documents loaded without a canonical retrieval URI (e.g., from stdin, from an in-memory object) MAY accept a caller-supplied base URI. If none is available, relative references in that document are unresolvable.

Schema `$ref` values additionally follow JSON Schema 2020-12 semantics: a schema's `$id`, when present, establishes the base URI for `$ref` values within that schema, overriding the enclosing OBI's location as the base. When a `$ref` fragment is a JSON Pointer, [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) escape rules apply (`~0` for `~`, `~1` for `/`).

Schema `$ref` cycles (where resolving a chain of `$ref`s returns to an already-visited schema) are common in recursive types (trees, linked lists, comment threads, ASTs). Cycles are permitted rather than forbidden because recursive types are legitimate and widespread; excluding them would cut off a large class of real-world schemas. Tools that resolve `$ref` MUST handle cycles without infinite loops (via memoization, bisimulation, or similar techniques). The exact handling is tool-defined.

---

## Versioning

OBI documents carry two independent version concepts.

### `openbindings` field (spec version)

The `openbindings` field identifies which version of this specification the document is declared against. The value MUST be a [Semantic Versioning 2.0.0](https://semver.org/) string (e.g., `0.2.0`, `1.0.0`).

Tools MUST refuse to parse documents that declare a higher major version than the tool supports. Within the same major version (1.0.0 and later):

- New minor versions MAY add optional fields.
- Existing fields MUST NOT change meaning.
- Existing fields MUST NOT be removed.

Major-version refusal is mandatory because a major bump may change the meaning of existing fields; a tool that silently processed a newer-major document using older rules would risk applying pre-break meanings to post-break fields and produce wrong output. Post-1.0 minor bumps only add optional fields, so older tools safely ignore unknown additions.

Pre-1.0 (major version 0): minor versions MAY include breaking changes, per pre-1.0 SemVer convention. The same refusal principle applies at finer granularity: tools MUST refuse to parse pre-1.0 documents that declare a higher minor version than the tool supports.

### `version` field (contract version)

The optional `version` field describes the author's own notion of the interface's contract version. It is opaque to this spec; no tool behavior is defined in terms of it. Authors MAY use SemVer, dates, or any other convention.

---

## IANA considerations

This specification defines two registrations for IANA. Both are provisional while the spec is pre-1.0 and become permanent upon 1.0 release.

### Well-known URI suffix

Per [RFC 8615](https://www.rfc-editor.org/rfc/rfc8615):

- **URI suffix:** `openbindings`
- **Change controller:** openbindings project
- **Reference:** this specification
- **Related information:** see [Discovery](#discovery)

### Media type

Per [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838), under the vendor tree:

- **Type/subtype:** `application/vnd.openbindings+json`
- **Required parameters:** none
- **Encoding considerations:** 8-bit UTF-8 per [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)
- **Fragment identifier considerations:** JSON Pointer per [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)
- **Security considerations:** see [Security considerations](#security-considerations)
- **Interoperability considerations:** see [Conformance](#conformance)
- **Applications that use this media type:** tools that produce or consume OpenBindings documents
- **Change controller:** openbindings project
- **Published specification:** this specification

---

## Security considerations

Processing OBI documents involves fetching external artifacts, resolving references, and handling arbitrary author-supplied input. The threat surface is comparable to JSON Schema processors and artifact-fetching tools generally: SSRF, resource exhaustion, untrusted code evaluation, and content-type confusion.

The document format creates the following exposure:

- **URIs as attack vectors.** `roles` values, `sources[*].location` values, and schema `$ref` values may resolve to arbitrary network endpoints, including internal or link-local addresses such as `http://169.254.169.254/...` or `file:///etc/passwd`. Unrestricted fetching inherits SSRF and exfiltration exposure.
- **Unbounded size.** The spec imposes no size cap on OBI documents or on the artifacts and schemas they reference. Untrusted input creates memory and processing-time exhaustion exposure.
- **Schema `$ref` cycles.** Permitted by the spec (see [Reference resolution]); naive resolvers can exhaust the stack or loop indefinitely.
- **Transforms as executable code.** Transform `expression` values are source code for whatever language the `type` identifies. Untrusted documents can embed transforms designed to run without bound or access process state when evaluated.
- **Plaintext discovery.** Discovery over HTTP is subject to tampering by network intermediaries; fetched content cannot be distinguished from content planted by an on-path attacker.
- **Integrity is out of scope.** The spec does not define document signing, attestation, or integrity verification. Authenticity and integrity are established by external means (TLS, content signing, out-of-band attestation) or not at all.

Mitigation strategies, such as scheme allow-lists, size caps, cycle detection, transform sandboxing, and HTTPS enforcement, are processor concerns.

---

## Conformance

The normative shape of an OBI document is defined by this specification's prose. The accompanying `openbindings.schema.json` expresses the structural portion of that definition in JSON Schema form for validator tooling; it is a derived artifact, not a second source of truth. Where prose and schema conflict, the prose governs. Some conformance rules (such as the cross-references from `satisfies` into `roles`) cannot be expressed in JSON Schema and exist only here.

A conformant **OBI document**:

- Is valid UTF-8 encoded JSON per [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259). Duplicate JSON object keys within any object make the document invalid.
- Validates against the JSON Schema at `openbindings.schema.json`.
- Has unique operation keys within the document.
- Has every map key and every operation alias matching the pattern `^[A-Za-z_][A-Za-z0-9_.-]*$`.
- Has no collision between any two operation identifiers within the document, where an operation's identifiers are its key plus any entries in its `aliases` array.
- Has well-formed URI references (per [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) §4.1) in `roles`, `sources[*].location`, and schema `$ref` values.
- Has every `bindings[*].operation` value present as a key in the document's `operations` map.
- Has every `bindings[*].source` value present as a key in the document's `sources` map.
- Has every `bindings[*].security` value (when present) present as a key in the document's `security` map.
- Has every named-transform `$ref` in `bindings[*].inputTransform` and `bindings[*].outputTransform` resolving to a key in the document's `transforms` map.
- Has every `satisfies[*].role` value present as a key in the document's `roles` map.
- Has no duplicate entries (same `role` + `operation` pair) within any single operation's `satisfies` array.

A conformant **tool**:

- Does not fail processing a document solely because the document contains an unsupported binding format, transform type, or security method type. Tools MAY surface diagnostics; bindings depending on unsupported artifacts are unactionable.
- Ignores unknown fields that are not defined by this specification. Tools SHOULD surface diagnostics (warnings) for unknown non-`x-` fields to help catch typos.
- Treats `x-` prefixed fields as extensions. Unknown `x-` fields MUST NOT change the meaning of core fields for conformance purposes.
- Refuses documents declaring a higher major `openbindings` version than the tool supports.

The consistent "don't fail the document on unknown X" posture across these rules is deliberate. Partial tool support is the common case: a tool may understand `openapi` bindings but not `grpc`, or `jsonata` transforms but not a vendor-specific transform type. Failing the whole document on any unsupported element would force every tool to support every element, fracturing the ecosystem. The diagnostic allowance preserves visibility: authors still learn when their document contains elements a specific tool can't act on. The distinction between warning on non-`x-` unknowns and silently accepting `x-` unknowns reflects that non-`x-` typos are usually misspelled core fields, while `x-` names are explicitly reserved for extensions whose names the spec cannot know.

This spec does not define tool behavior beyond these minimum conformance rules. Behavioral conventions (comparison, transform execution, security method resolution, etc.) are documented per-tool.

---

## Extensions

- OBI documents MAY include extension fields whose keys begin with `x-` at any object location.
- Tools MUST ignore `x-` fields they do not understand.
- `x-` fields MUST NOT change the meaning of core fields defined by this spec.

---

## See also

- `openbindings.schema.json` — JSON Schema for document validity.
- `guides/` — tutorials, format-specific conventions, author guidance.
- `interfaces/` — role interfaces published by the openbindings project.
- `formats/` — companion format specifications.
- `CHANGELOG.md` — version history and diffs between spec versions.

[Operations]: #operations
[Transforms]: #transforms
[Location equality]: #location-equality
[Reference resolution]: #reference-resolution
