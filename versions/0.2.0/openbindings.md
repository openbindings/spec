# OpenBindings Specification (v0.2.0)

## Abstract

OpenBindings (OBI) is a portable interface description format. A service describes its operations (input/output contracts, role claims, examples) once, and exposes them over OpenAPI, AsyncAPI, gRPC, MCP, or any other binding format. The contract lives at the operation layer; the protocols live at the binding layer.

```json
{
  "openbindings": "0.2.0",
  "operations": {
    "createTask": {
      "input":  { "type": "object", "properties": { "title": { "type": "string" } }, "required": ["title"] },
      "output": { "type": "object", "properties": { "id":    { "type": "string" } } }
    }
  },
  "sources": {
    "httpApi": { "format": "openapi@3.1", "location": "./openapi.json" }
  },
  "bindings": {
    "createTask.http": { "operation": "createTask", "source": "httpApi", "ref": "#/paths/~1tasks/post" }
  }
}
```

The body of this document defines the OBI shape, identity, discovery convention, reference-resolution rules, and conformance floor. New readers may prefer the [§4. Overview](#4-overview) walkthrough; the normative material starts at [§5. Terminology](#5-terminology).

## Editors

- Matthew Clevenger ([@clevengermatt](https://github.com/clevengermatt))

See `EDITORS.md` for the current editor roster.

## Status of this document

This is **version 0.2.0** of the OpenBindings specification. It is pre-1.0, and minor-version revisions MAY include breaking changes per [§13.1. `openbindings` field (spec version)](#131-openbindings-field-spec-version). Substantive changes are recorded in `CHANGELOG.md` and cite stable rule identifiers (`OBI-D-##`/`OBI-T-##`) where applicable.

## License and intellectual property

This specification is published under the Apache 2.0 License (see `LICENSE`). Contributions are accepted under the same license, which includes an express patent grant from each contributor covering any claims embodied by their contribution. No party has disclosed patents essential to implementing this specification.

## Notational conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in all capitals.

## Table of contents

- [1. Positioning](#1-positioning)
  - [1.1. Distinguishing features](#11-distinguishing-features)
  - [1.2. Out of scope](#12-out-of-scope)
- [2. Scope principle](#2-scope-principle)
- [3. Scope of this specification](#3-scope-of-this-specification)
- [4. Overview](#4-overview)
- [5. Terminology](#5-terminology)
- [6. Document shape](#6-document-shape)
  - [6.1. Operations](#61-operations)
  - [6.2. Schemas](#62-schemas)
  - [6.3. Bindings](#63-bindings)
  - [6.4. Sources](#64-sources)
  - [6.5. Transforms](#65-transforms)
  - [6.6. Security](#66-security)
  - [6.7. Roles](#67-roles)
- [7. Discovery](#7-discovery)
  - [7.1. Response contract](#71-response-contract)
- [8. Binding sufficiency](#8-binding-sufficiency)
- [9. Interface identity](#9-interface-identity)
- [10. Location equality](#10-location-equality)
- [11. Canonical form (informative)](#11-canonical-form-informative)
- [12. Reference resolution](#12-reference-resolution)
- [13. Versioning](#13-versioning)
  - [13.1. `openbindings` field (spec version)](#131-openbindings-field-spec-version)
  - [13.2. `version` field (contract version)](#132-version-field-contract-version)
- [14. IANA considerations](#14-iana-considerations)
  - [14.1. Well-known URI suffix](#141-well-known-uri-suffix)
  - [14.2. Media type](#142-media-type)
- [15. Security considerations](#15-security-considerations)
  - [15.1. Recommended mitigations (informative)](#151-recommended-mitigations-informative)
- [16. Conformance](#16-conformance)
  - [16.1. Conformance classes](#161-conformance-classes)
  - [16.2. Document rules](#162-document-rules)
  - [16.3. Tool rules](#163-tool-rules)
- [17. Extensions](#17-extensions)
- [18. References](#18-references)
  - [18.1. Normative references](#181-normative-references)
  - [18.2. Informative references](#182-informative-references)
- [19. See also](#19-see-also)

---

## 1. Positioning

OpenBindings operates one layer above protocol-specific interface specifications like OpenAPI, AsyncAPI, gRPC, and MCP. Those specs describe how to invoke endpoints over a particular wire format. OBI describes, at the layer above: what operations a service offers, what their input and output contracts are, and which of those operations correspond to shared interface contracts, independent of protocol.

An OBI does not replace the binding formats it points at. Each format remains authoritative over its own wire shape. An OBI adds the operation-level overlay that no single binding format alone carries, and does so in a way that survives across multiple protocols.

### 1.1. Distinguishing features

- **One operation, many bindings.** A single operation contract can be exposed over multiple protocols simultaneously without duplicating the contract.
- **Vendor-independent matching.** A service can declare, machine-readably, that it implements the same contract as other services — without a registry mediating the lookup. Consumers match by what a service does, not by who runs it.
- **Convention-driven discovery.** A service publishes its interface at `/.well-known/openbindings`, so tools can find it without configuration.
- **URI-based identity.** Any reference resolves in a single fetch, with no separate name-to-location step.

### 1.2. Out of scope

OpenBindings does not:

- **Replace underlying binding formats.** OpenAPI, AsyncAPI, gRPC, MCP, and others remain authoritative for their wire formats. OBI points at them.
- **Serve as an authoring language.** OBI is the target artifact, not a source format that compiles to multiple targets. Tools like TypeSpec and Smithy occupy that adjacent role.
- **Define runtime or protocol semantics.** Invocation, retries, credential flow, sandboxing, and rate limiting are processor concerns.
- **Maintain registries of formats, role URIs, or security-method types.** Identity is URI-based; format-token authority rests with each format's community.
- **Specify integrity, signing, or attestation.** Supply-chain verification composes externally over URI fetches.

## 2. Scope principle

OpenBindings is deliberately minimal. This specification mandates only what is necessary to guarantee portable interface descriptions and a minimum conformance floor for tools. Authority over everything else rests in two places:

- **Binding format specifications** (OpenAPI, AsyncAPI, protobuf, MCP, and others) are authoritative over their own wire formats, reference syntax, addressing conventions, version semantics, and format-token governance. OBI points at binding artifacts; it does not override them.
- **Implementations and their communities** (tools, SDKs, registries, gateways, operators) are authoritative over behavior that depends on local deployment or invocation: transform runtimes, selection heuristics, security posture, mitigation policy, comparison and matching strategies, and operational choice.

OpenBindings is intentionally thin so that adjacent specifications and implementation communities can exercise their own governance without conflict from this document. Where this spec expressly defers to "the format's specification," to "tool concerns," or to "implementation-defined behavior," that deferral is an application of this principle.

Readers evaluating conformance should read the rest of this document in light of this principle.

---

## 3. Scope of this specification

OpenBindings (OBI) is a **portable interface description format**. Services publish an OBI document describing their operations and how to reach them; tools consume OBIs to drive protocol-specific clients, power registries, feed agents, and so on.

This spec defines **what an OBI document is**: its shape, identity, discovery convention, reference-resolution rules, and forward-compatibility rules. It also defines **a minimum conformance floor for tools** that preserves document portability across implementations.

It does not define **higher-level tool behavior** (comparison, matching, security method resolution, binding invocation, registry semantics) or **binding format conventions** (`ref` syntax, format-token governance, binding-artifact addressing). Tool behavior is each tool's concern; binding format conventions are governed by each format's own authoritative specification. The openbindings project does not maintain a registry of formats. (This spec does define the transform evaluation language -- JSONata 2.0 -- for Invoking-class tools; see [Transforms]. What remains tool-defined is the surrounding runtime: sandboxing, error handling, resource limits, and invocation lifecycle.)

The openbindings project publishes reference tools (`ob` CLI, `openbindings-go`, `openbindings-ts`) as one implementation of this spec. Third-party tools are free to adopt their conventions or publish their own.

---

## 4. Overview

OpenBindings separates what a service does (operations with input/output schemas) from how you access it (bindings to OpenAPI, AsyncAPI, gRPC, MCP, or any other binding specification). A single OBI document can reference bindings in multiple protocols without redefining the operation contract. Services can publish their OBI at a well-known location so tools can discover and act on it.

Terms used informally below (operation, binding, source, transform, role, `satisfies`) are defined precisely in [Terminology]. Readers unfamiliar with the vocabulary may prefer to skim that section first.

OBI documents are JSON. JSON is chosen for properties that hold independent of any other OpenBindings decision: parser availability across every language and runtime including browsers, a frozen and unambiguous parse defined by RFC 8259, a low security surface compared to formats whose parsers evaluate tags or expressions on load, and a mature surrounding tool culture. OpenBindings also requires a transform language (see [Transforms]), so the host format had to be one with a mature cross-language expression language over its data model.

Every OBI declares a spec version and an operations map. The minimal valid document is just those two fields:

```json
{
  "openbindings": "0.2.0",
  "operations": {}
}
```

An operation is the contract, a source points at a binding artifact (e.g., an OpenAPI document), and a binding links the two. Adding one of each gives the operation a concrete target:

```json
{
  "openbindings": "0.2.0",
  "operations": {
    "createTask": {
      "input":  { "type": "object", "properties": { "title": { "type": "string" } }, "required": ["title"] },
      "output": { "type": "object", "properties": { "id":    { "type": "string" } } }
    }
  },
  "sources": {
    "httpApi": { "format": "openapi@3.1", "location": "./openapi.json" }
  },
  "bindings": {
    "createTask.http": { "operation": "createTask", "source": "httpApi", "ref": "#/paths/~1tasks/post" }
  }
}
```

The same operation can be exposed over a second protocol by adding another binding against a different source. One contract, many bindings is the spec's primary abstraction:

```json
{
  "openbindings": "0.2.0",
  "operations": {
    "createTask": {
      "input":  { "type": "object", "properties": { "title": { "type": "string" } }, "required": ["title"] },
      "output": { "type": "object", "properties": { "id":    { "type": "string" } } }
    }
  },
  "sources": {
    "httpApi":   { "format": "openapi@3.1",    "location": "./openapi.json" },
    "mcpServer": { "format": "mcp@2025-11-25", "location": "https://example.com/mcp" }
  },
  "bindings": {
    "createTask.http": { "operation": "createTask", "source": "httpApi",   "ref": "#/paths/~1tasks/post" },
    "createTask.mcp":  { "operation": "createTask", "source": "mcpServer", "ref": "tools/create_task" }
  }
}
```

A realistic OBI layers in shared schemas reused across operations, a named transform bridging a source's wire shape with the operation contract, a role claim asserting this service fulfills a published interface, and a security reference describing how callers authenticate:

```json
{
  "openbindings": "0.2.0",
  "name": "Task Manager",
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
      "satisfies": [
        { "role": "taskmanager", "operation": "tasks.create" }
      ],
      "input": {
        "type": "object",
        "properties": { "title": { "type": "string" } },
        "required": ["title"]
      },
      "output": { "$ref": "#/schemas/Task" }
    },
    "listTasks": {
      "description": "List all tasks.",
      "output": {
        "type": "array",
        "items": { "$ref": "#/schemas/Task" }
      }
    }
  },
  "roles": {
    "taskmanager": "https://interfaces.example.com/task-manager/v1.json"
  },
  "sources": {
    "httpApi": { "format": "openapi@3.1", "location": "./openapi.json" },
    "mcpServer": { "format": "mcp@2025-11-25", "location": "https://example.com/mcp" }
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
  },
  "security": {
    "apiAuth": [ { "type": "bearer" } ]
  },
  "transforms": {
    "apiToTask": "{ \"id\": task_id, \"title\": task_title, \"done\": is_done }"
  }
}
```

## 5. Terminology

- **OBI**: shorthand for "OpenBindings interface document."
- **Operation**: a named unit of capability with optional input/output schemas. Stored under a key in the document's `operations` map.
- **Binding**: a mapping from an operation to a specific entry in a binding artifact (OpenAPI, AsyncAPI, gRPC, MCP, etc.).
- **Binding artifact**: the protocol-specific specification document or endpoint referenced by a source (e.g., an OpenAPI document, a `.proto` file, an MCP endpoint).
- **Source**: a reference to a binding artifact, identified by a format token and either a location or embedded content.
- **Transform**: a shape mapping between an operation's `input`/`output` schemas and a source's expected wire shape. Stored under a key in the document's `transforms` map, or inline on a binding.
- **Role**: another OBI document referenced as a shared interface contract (its operations and schemas define the contract; any bindings it carries are ignored in the role context).
- **Location**: the URI from which a document was retrieved, or a caller-supplied base URI for documents loaded without a canonical retrieval URI.

How these relate: an **operation** is the portable contract, independent of any protocol. A **source** points at a binding artifact. A **binding** links one operation to one source and optionally attaches a **transform** that bridges shape differences. A **role** is another OBI referenced as a shared contract; operations declare which role operations they `satisfy`.

Whether an OBI is "compatible with" another OBI, "satisfies" a role, or is "aligned with" a target interface depends on tool-defined comparison and matching semantics. This spec does not define those.

---

## 6. Document shape

An OBI document is a JSON object. Top-level fields:

| Field | Type | Required | Purpose |
|---|---|---|---|
| `openbindings` | string | yes | Spec version the document declares (SemVer). |
| `name` | string | no | Human-friendly label. Not an identifier. |
| `version` | string | no | Author-declared contract version. Opaque to this spec. |
| `description` | string | no | Human-friendly description. |
| `schemas` | object | no | Map of schema names to JSON Schema objects. |
| `operations` | object | yes | Map of operation keys to operation objects. |
| `roles` | object | no | Map of role keys to URIs of other OBI documents referenced as shared contracts. |
| `sources` | object | no | Map of source keys to source objects. |
| `bindings` | object | no | Map of binding keys to binding objects. |
| `security` | object | no | Map of security-entry keys to arrays of security method objects. |
| `transforms` | object | no | Map of transform names to JSONata expression strings. |

Operation keys MUST be unique within a document. Binding, source, transform, role, schema, and security-entry keys MUST be unique within their respective maps. All map keys (operation, binding, source, transform, role, schema, security-entry, and example keys) and all operation aliases MUST match the pattern `^[A-Za-z_][A-Za-z0-9_.-]*$`. This constrains identifiers to a codegen-friendly ASCII subset while permitting common conventions like dotted grouping (`createTask.http`) or hyphenated names (`my-operation`).

### 6.1. Operations

Operations do not prescribe invocation pattern. Whether an operation is request/response, streaming, bidirectional, or pub/sub is determined by the binding, not by the operation definition. The operation model is shaped to accommodate any of these patterns that its binding implements.

Operations whose output varies in shape (e.g., distinct success and error variants, or multiple event types in a streaming binding) express the variants as alternatives in `output` using JSON Schema alternation (`oneOf`, `anyOf`). Discrimination between variants is a binding-format and tool concern.

An operation's contract is defined by its `input` and `output` schemas; the remaining fields are metadata, attested claims, and examples.

An operation object MAY contain:

| Field | Type | Purpose |
|---|---|---|
| `description` | string | Human-readable description. |
| `deprecated` | boolean | Hint that consumers should migrate. |
| `tags` | array of strings | Documentation labels for grouping/filtering. |
| `aliases` | array of strings | Alternate names by which this operation MAY be recognized. |
| `satisfies` | array of objects | Each object has shape `{"role": string, "operation": string}`, declaring that this operation is intended to fulfill a named operation within a role interface. |
| `idempotent` | boolean | Hint that multiple invocations with the same input produce the same observable state. |
| `input` | JSON Schema, `null`, or absent | Shape of input to this operation. |
| `output` | JSON Schema, `null`, or absent | Shape of output from this operation. |
| `examples` | object | Map of example names to `{description?, input?, output?}` objects. |

`input` and `output` are optional. Absent and `null` are equivalent; both mean "unspecified." A schema is "specified" when present and not `null`. `{}` (the empty schema) is NOT equivalent to absent; it means "documented as accepting any JSON value." This three-way distinction preserves author intent: "unspecified" lets downstream tools reject the operation or prompt for clarification, while `{}` signals that the author has chosen to accept any value and codegen tools can generate a pass-through type.

The `input` and `output` schemas are caller-facing contracts that run in opposite directions. A service implementing the operation accepts at minimum every value validating against `input` and may accept more; a caller sending any value validating against `input` is honoring the input contract. A service implementing the operation produces only values validating against `output` and may produce a narrower set; a caller receiving a successful result can rely on it validating against `output`.

`aliases` declares alternate names the author considers equivalent to the operation's key. Common cases include a prior name kept for continuity after a rename, or a vendor-specific name that some consumers look up by. Tools comparing or matching operations across documents MAY treat an operation's key and its aliases interchangeably. The spec defines only the declaration; matching semantics are a tool concern. An alias MUST NOT duplicate any operation's key or alias in the document; a name that resolves to multiple operations doesn't identify any of them.

`aliases` and `satisfies` both inform cross-contract recognition, but they declare different things:

| Field | What it declares | Who refers to it |
|---|---|---|
| `aliases` | Additional names by which **this** operation is known within its own document | Consumers looking up this operation by an alternate key |
| `satisfies` | A claim that this operation fulfills a **different** operation defined in another (role) document | Registries, matchers, and agent routers matching services to role contracts |

A consumer holding an alias and a consumer holding the key refer to the same operation. A consumer cannot refer to this operation by the name of what it `satisfies`; the `satisfies` field is a correspondence claim, not an additional name. An operation MAY use both independently.

`idempotent` is a contract-level claim that consumers (retry logic, caching layers, client-side dedup, agent planners) can rely on: every binding for this operation MUST preserve the guarantee. An operation whose bindings cannot uniformly honor the guarantee (for example, a non-idempotent HTTP verb wrapping a handler that creates a new resource each call) MUST NOT declare `idempotent: true`.

`aliases`, `satisfies`, and `idempotent` are author-attested claims. They assert something the spec cannot mechanically verify from the document alone: that two names refer to the same operation, that an operation corresponds to a named operation in a different contract, or that invocations are idempotent. The spec enforces structural constraints on these fields (alias format, `satisfies.role` resolving to a `roles` key, no duplicate `satisfies` entries) under [Conformance], and those structural constraints determine document validity. The attested content itself is not a conformance test: tools MUST NOT reject a document as non-conformant on the basis that an author-attested claim appears semantically inaccurate. Tools MAY surface diagnostics and MAY use author-attested claims as input to their own higher-level decisions (matching, selection, retry strategy).

`examples` holds author-supplied sample input/output pairs for an operation. The spec defines only the structural shape; consumers such as generated docs, SDK codegen, test harnesses, and agent few-shot material apply them as they see fit. Within any example, a provided `input` MUST validate against the operation's `input` schema when that schema is specified, and a provided `output` MUST validate against the operation's `output` schema when that schema is specified.

An operation's `input` and `output` schemas may be inlined or referenced via `$ref` into the document's `schemas` map or into an external schema document.

### 6.2. Schemas

The top-level `schemas` map holds named JSON Schema objects. Operations reference them via `$ref` (e.g., `{"$ref": "#/schemas/Task"}`).

Every schema object in an OBI document is a [JSON Schema 2020-12](https://json-schema.org/draft/2020-12) document. A `$schema` keyword MAY be omitted; absence means 2020-12. When `$schema` is present, its value MUST be `https://json-schema.org/draft/2020-12/schema`. The `$vocabulary` keyword MUST NOT appear in schemas within the document. Permitting vocabularies would require every OBI consumer to resolve meta-schemas to determine which keywords apply, and could fragment schema semantics across tools that disagree about unknown vocabularies. This constraint applies wherever a schema appears within the document: in the top-level `schemas` map, inlined on an operation's `input`/`output`, or nested as a subschema within another schema.

The constraint governs schemas within the OBI document itself. Schemas fetched by resolving `$ref` to external URIs are governed by their own declared dialects and are out of scope for this requirement.

This spec does not restrict which 2020-12 keywords may appear. Tools that only preserve schemas through round-trips need not interpret any keywords.

### 6.3. Bindings

A binding object MUST contain:

| Field | Type | Purpose |
|---|---|---|
| `operation` | string | Key into the document's `operations` map. |
| `source` | string | Key into the document's `sources` map. |

And MAY contain:

| Field | Type | Purpose |
|---|---|---|
| `ref` | string | Pointer into the binding artifact identifying the specific operation. Format-specific. |
| `priority` | number | Preference hint for binding selection. Lower is more preferred. |
| `security` | string | Key into the document's `security` map. |
| `description` | string | Human-readable description. |
| `deprecated` | boolean | Hint that this binding is being phased out. |
| `inputTransform` | JSONata string or `$ref` | See [Transforms]. |
| `outputTransform` | JSONata string or `$ref` | See [Transforms]. |

`ref` identifies a specific entry within the binding artifact. Its syntax is governed by the format's own specification, not by this spec. For example: JSON Pointer fragments for OpenAPI and AsyncAPI, fully-qualified method names for gRPC, tool names for MCP. Tools that resolve or act on `ref` MUST interpret it per the format's conventions. Where a format has a primary specification (OpenAPI, AsyncAPI, protobuf, MCP, etc.), that specification is the authority. Where a format lacks one, the convention established by its widely-used implementations serves as the authority. The openbindings project tracks common conventions in non-normative guides as a courtesy; these are informational, not standards. When `ref` is absent, the binding targets the binding artifact as a whole, per the same authority.

Multiple bindings MAY reference the same operation. The operation's `input` and `output` schemas form a portable contract, and each binding for that operation is an alternative target authored to honor that contract over a specific protocol. A caller invokes the operation through any one of its bindings; using one binding is a complete invocation of the operation. Selection among alternatives is a tool concern; see `priority`.

`priority` (on bindings, and on sources in the next section) is a preference signal for selecting among multiple bindings for the same operation; lower values are more preferred. The spec does not prescribe what the preference means; authors encode their own axis, such as canonical vs mirror, stable vs experimental, cheap vs expensive, or newer protocol vs fallback. Source-level priority provides a default for every binding using that source; binding-level priority, when present, overrides that default for a specific binding rather than combining with it. This keeps the common case ergonomic (set once per source) while allowing per-binding exceptions. Whether and how tools consume priority is a tool concern. When multiple bindings share the lowest priority (or omit priority entirely), selection is tool-defined; authors who want deterministic ordering set distinct priorities.

`deprecated` combines with `priority` as a coarser ordering tier. Non-deprecated bindings rank ahead of deprecated bindings regardless of priority value, and `priority` orders bindings within each tier. A non-deprecated binding with `priority: 1000` is preferred over a deprecated binding with `priority: 0`. Authors who want a deprecated binding to be selected should remove the `deprecated` flag rather than lowering its priority. The tier rule does not apply to operation-level `deprecated` (see [§6.1. Operations](#61-operations)), which signals migration intent for the operation as a whole rather than selection preference among its bindings. The tier rule is spec-level because `deprecated: true` requires a portable selection-ordering meaning to be useful; every other selection concern remains tool-defined per [§2. Scope principle](#2-scope-principle).

### 6.4. Sources

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

**Format tokens.** The `format` field is a string that identifies the binding specification for a source. Format tokens are community-extensible; what characters appear in them and how different strings relate to one another (equivalence, compatibility, ordering) is determined by each format's own community. The openbindings project recommends the convention `<name>@<version>` (e.g., `openapi@3.1`, `mcp@2025-11-25`) as an interoperable default for new format tokens. This spec does not maintain a registry of format tokens; authority over a format's conventions lies with that format's own specification or, in its absence, its implementer community.

`location` is resolved per [Reference resolution].

### 6.5. Transforms

Transforms map between operation schemas and source schemas when the two differ in shape. They exist so a single operation contract can be reused across bindings whose wire shapes diverge (the operation presents a clean domain model; the bound OpenAPI path wraps requests in envelopes; the MCP tool returns content blocks). Declaring transforms in the OBI keeps shape-translation intent with the interface rather than scattered across per-tool configuration.

A binding whose source artifact already matches its operation contract's `input`/`output` shape need not declare a transform. A document with no transforms requires no JSONata runtime at any tier.

The transform fields carry directional meaning. `inputTransform`, when declared, applies to caller-provided input on its way to the binding's source, transforming the operation's `input` shape into the source's expected input shape. `outputTransform`, when declared, applies to the binding's output on its way to the caller, transforming the source's output shape into the operation's `output` shape.

As a concrete example, consider a binding whose source returns

```json
{ "task_id": "abc", "task_title": "Buy milk", "is_done": false }
```

but the operation contract's `output` schema expects

```json
{ "id": "abc", "title": "Buy milk", "done": false }
```

The binding's `outputTransform` bridges the two:

```
{ "id": task_id, "title": task_title, "done": is_done }
```

An `inputTransform` does the same in the opposite direction, reshaping caller input to the source's expected shape.

A transform is a [JSONata](https://jsonata.org/) expression string. Tools claiming Invoking-class conformance (see [§16.1. Conformance classes](#161-conformance-classes)) MUST evaluate transforms according to the [JSONata 2.0](https://docs.jsonata.org/) specification; any implementation may provide its own JSONata 2.0 evaluator.

Where the JSONata 2.0 specification leaves behavior implementation-defined, tools SHOULD follow the behavior of the JSONata project's reference implementation (see [§18.2. Informative references](#182-informative-references)). Non-determinism inherent to JSONata's standard library (e.g., `$now()`, `$random()`, `$millis()`) is not a conformance defect: outputs MAY differ across calls and across tools whenever the transform expression itself is non-deterministic. The portability guarantee is correctness of evaluation, not byte-equivalence of outputs.

Invocation semantics, including how errors propagate, resource limits, and sandboxing, are tool concerns; see [Security considerations].

Mandating one expression language is what makes transforms portable: a pluggable choice would leave a JSONata document unusable to a consumer supporting only CEL or JMESPath, and a floor with optional alternatives collapses to the same commitment since every invoker still needs the floor's runtime for the common case. Among expression languages with mature cross-language implementations, JSONata is the one purpose-built for JSON-to-JSON shape rewriting (envelope wrapping, MCP content-block extraction, discriminated-union restructuring).

Named transforms MAY be defined in the top-level `transforms` map (keys are names, values are JSONata expression strings) and referenced by binding entries via `$ref` (e.g., `{"$ref": "#/transforms/fromApiOutput"}`). Bindings MAY also inline a transform directly as the string value of `inputTransform`/`outputTransform`.

**Request lifecycle (informative).** An Invoking-class tool at call time typically: (1) resolves a binding for the operation, taking `priority` and tool-specific preferences into account; (2) validates caller-provided input against the operation's `input` schema when specified; (3) evaluates the binding's `inputTransform` on the caller's input, if declared; (4) invokes the binding's source with the result, honoring the format's addressing conventions and any referenced `security` entry; (5) evaluates the binding's `outputTransform` on the source's output, if declared, then validates the resulting value against the operation's `output` schema when that schema is specified; (6) returns the result to the caller. This spec does not prescribe the steps; it describes where each field fits so tool authors share a common picture.

### 6.6. Security

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

### 6.7. Roles

Roles let a service declare that it satisfies a published interface contract, a shared definition of operations that independent services can claim to implement. This lets consumers match services by the role they play rather than by vendor-specific URLs or names.

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

A `satisfies` declaration is a *claim* by the document author that the declaring operation is intended to fulfill the named role's operation. It is an affirmative assertion of semantic correspondence, not a mere documentation hint: the author is stating that this operation does the job the role's operation describes. Codifying the claim as a structured field (rather than leaving it to free-form prose) makes it machine-readable, so registries, matchers, and agent routing layers can treat role correspondence as first-class metadata. The spec makes no assertion about whether the claim is accurate. Verification of satisfaction (structural, semantic, or otherwise) is a tool concern; a minimum SHOULD-level structural check appears at [OBI-T-09](#163-tool-rules).

---

## 7. Discovery

A service MAY publish its OBI document at the URI path `/.well-known/openbindings` on its primary origin. The `/.well-known/` namespace follows [RFC 8615](https://www.rfc-editor.org/rfc/rfc8615), which reserves this prefix for interoperable service-metadata endpoints. A 404 at this path simply means "no OBI here"; it is not an error condition. This convention addresses the one-interface-per-origin case. Origins that host multiple distinct interfaces (gateways, monorepos, multi-tenant platforms) are out of scope for the well-known convention and rely on other discovery mechanisms. Other discovery mechanisms (registries, configuration, service meshes) are out of scope for this spec.

### 7.1. Response contract

When serving an OBI at `/.well-known/openbindings`:

- The method is `GET`.
- A successful response returns `200 OK` with a body containing a valid OBI document.
- The response `Content-Type` SHOULD be `application/vnd.openbindings+json`. `application/json` MAY be used and MUST be accepted by clients.
- Clients SHOULD send `Accept: application/vnd.openbindings+json, application/json` to signal media-type preference. Servers MAY content-negotiate on this header but MUST NOT refuse a request that lacks it when they otherwise serve an OBI at this path.
- If the service does not publish an OBI at this path, the response is `404 Not Found`.
- Any other response (including `3xx`, other `4xx`, `5xx`, or `200` whose body is not a valid OBI) is outside the scope of this spec; clients MAY treat such responses as if no OBI is published at this path.
- Discovery endpoints MAY require authentication or authorization. Whether to publish an OBI to unauthenticated clients is a deployment decision; this spec does not mandate public discovery.
- Discovery endpoints intended for public consumption SHOULD set permissive CORS response headers (for example, `Access-Control-Allow-Origin: *`). Cross-origin discovery is a primary use case; omitting CORS silently breaks browser-side clients fetching the well-known URI. Publishers restricting discovery to specific origins MAY set CORS headers accordingly.

---

## 8. Binding sufficiency

Each binding in an OBI document identifies a concrete interaction target. The information required to make that identification MUST be contained in the binding itself, its referenced source, and the document's discovery context (the base URI used for relative reference resolution per [Reference resolution], plus any content the document embeds). A consumer that understands the source's format can identify the target from that information alone.

Sufficiency does not extend to reachability. Whether the identified target is currently reachable, accepts a caller's credentials, or succeeds at call time are properties of the running service and its deployment, not of the document. An OBI is conformant whether or not the target it identifies is callable at any given moment.

Format communities define the syntax and addressing semantics of `ref` values for their format, including conventions for the absent-`ref` case. If resolving a `ref` requires information beyond the OBI document and its discovery context (for example, external registries, vendor catalogs, or environment configuration), a binding using that source does not satisfy the sufficiency rule above and is non-conformant.

OBI's interop guarantee for a given binding is no stronger than the format's own. Where a binding format is ambiguous, that ambiguity is inherited by bindings targeting it; resolving it is the format community's work, not OBI's.

---

## 9. Interface identity

An OBI document is identified by its **location**: the URI from which the document was retrieved. There is no separate `id` field. The document's location is its canonical identity for references, deduplication, and comparison with other documents.

Location-based identity keeps identity resolvable: any tool receiving a reference to an OBI can fetch and verify it in one step, without a separate name-to-location lookup. An author-declared `id` field would be authoritative only to the author and could silently drift from the URL at which the document actually lives.

The optional `name` field is a human-friendly label, not an identifier.

Interface URIs are not snapshots; if the document at a URI changes, references to it see the change. Authors who want version-stable references can use versioned path segments (e.g., `https://interfaces.example.com/task-manager/v1.json`) or other URL schemes that do not change out from under existing consumers.

This model works without a central registry or content-addressed store to mediate lookups. Integrity checks, version pinning, and supply-chain verification are consumer concerns that compose on top of URL fetches; none need identity-layer support.

Trust in an interface depends on the authenticated discovery context or the trust placed in the hosting location, not on the document's contents.

---

## 10. Location equality

Location equality answers whether two URIs refer to the same OBI. It matters wherever the spec uses URIs to establish identity: comparing role values across documents, deduplicating references during processing, and recognizing the same interface seen from multiple entry points.

Two locations are equal iff they produce the same canonical form, compared byte-for-byte. Before comparison, bare filesystem paths are lifted to `file://` URIs per RFC 8089, since equality operates on URIs rather than on paths that could belong to either side of a network boundary. The canonical form is then produced by applying, in order:

1. Host labels converted to A-label form per UTS #46.
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

## 11. Canonical form (informative)

Some applications need a stable byte representation of an OBI document for content addressing, integrity attestation, signature verification, or prompt-cache stability when feeding OBIs to language models. This section names such a form so tools and downstream specifications can refer to it consistently. It is informative; conformance to this specification does not require producing or consuming canonical-form documents.

The canonical form of an OBI document is the document serialized per [RFC 8785 (JSON Canonicalization Scheme, JCS)](https://www.rfc-editor.org/rfc/rfc8785). JCS specifies a deterministic JSON serialization with UTF-8 encoding (no byte-order mark), lexicographic ordering of object members, ECMAScript-style number serialization, defined string-escape rules, and no insignificant whitespace.

JCS does not permit the JSON values `NaN`, `+Infinity`, or `-Infinity`; OBI documents containing such values have no canonical form. No rule in this specification generates such values; they appear only via authored input.

Canonical form is distinct from any human-readable ordering a tool may emit when authoring OBIs. Such ordering optimizes for readability; canonical form optimizes for byte stability when hashing or signing. A tool MAY use both: a readable order during authoring, JCS during canonicalization.

---

## 12. Reference resolution

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

## 13. Versioning

OBI documents carry two independent version concepts.

### 13.1. `openbindings` field (spec version)

The `openbindings` field identifies which version of this specification the document is declared against. The value MUST be a [Semantic Versioning 2.0.0](https://semver.org/) string (e.g., `0.2.0`, `1.0.0`).

Tools MUST refuse to parse documents that declare a higher major version than the tool supports. Within the same major version (1.0.0 and later):

- New minor versions MAY add optional fields.
- Existing fields MUST NOT change meaning.
- Existing fields MUST NOT be removed.

Major-version refusal is mandatory because a major bump may change the meaning of existing fields; a tool that silently processed a newer-major document using older rules would risk applying pre-break meanings to post-break fields and produce wrong output. Post-1.0 minor bumps only add optional fields, so older tools safely ignore unknown additions.

Pre-1.0 (major version 0): minor versions MAY include breaking changes, per pre-1.0 SemVer convention. The same refusal principle applies at finer granularity: tools MUST refuse to parse pre-1.0 documents that declare a higher minor version than the tool supports.

### 13.2. `version` field (contract version)

The optional `version` field describes the author's own notion of the interface's contract version. It is opaque to this spec; no tool behavior is defined in terms of it. Authors MAY use SemVer, dates, or any other convention.

---

## 14. IANA considerations

This specification defines two registrations for IANA. Both are provisional while the spec is pre-1.0 and become permanent upon 1.0 release.

### 14.1. Well-known URI suffix

Per [RFC 8615](https://www.rfc-editor.org/rfc/rfc8615):

- **URI suffix:** `openbindings`
- **Change controller:** openbindings project
- **Reference:** this specification
- **Related information:** see [§7. Discovery](#7-discovery)

### 14.2. Media type

Per [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838), under the vendor tree:

- **Type/subtype:** `application/vnd.openbindings+json`
- **Required parameters:** none
- **Encoding considerations:** 8-bit UTF-8 per [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)
- **Fragment identifier considerations:** JSON Pointer per [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)
- **Security considerations:** see [§15. Security considerations](#15-security-considerations)
- **Interoperability considerations:** see [§16. Conformance](#16-conformance)
- **Applications that use this media type:** tools that produce or consume OpenBindings documents
- **Change controller:** openbindings project
- **Published specification:** this specification

---

## 15. Security considerations

Processing OBI documents involves fetching external artifacts, resolving references, and handling arbitrary author-supplied input. The threat surface is comparable to JSON Schema processors and artifact-fetching tools generally: SSRF, resource exhaustion, untrusted code evaluation, and content-type confusion.

The document format creates the following exposure:

- **URIs as attack vectors.** `roles` values, `sources[*].location` values, and schema `$ref` values may resolve to arbitrary network endpoints, including internal or link-local addresses such as `http://169.254.169.254/...` or `file:///etc/passwd`. Unrestricted fetching inherits SSRF and exfiltration exposure.
- **Unbounded size.** The spec imposes no size cap on OBI documents or on the artifacts and schemas they reference. Untrusted input creates memory and processing-time exhaustion exposure.
- **Schema `$ref` cycles.** Permitted by the spec (see [Reference resolution]); naive resolvers can exhaust the stack or loop indefinitely.
- **Transforms as executable code.** Transforms are JSONata source code. Untrusted documents can embed expressions designed to run without bound or access process state when evaluated.
- **Plaintext discovery.** Discovery over HTTP is subject to tampering by network intermediaries; fetched content cannot be distinguished from content planted by an on-path attacker.
- **Integrity is out of scope.** The spec does not define document signing, attestation, or integrity verification. Authenticity and integrity are established by external means (TLS, content signing, out-of-band attestation) or not at all.

Mitigation strategies, such as scheme allow-lists, size caps, cycle detection, transform sandboxing, and HTTPS enforcement, are processor concerns. The spec does not mandate any particular policy; [§15.1. Recommended mitigations (informative)](#151-recommended-mitigations-informative) lists categories tools typically consider.

### 15.1. Recommended mitigations (informative)

The following are non-normative. They name categories of mitigation that tools processing OBI documents from untrusted origins typically consider. Specific limits, policies, and defaults depend on deployment; the spec does not prescribe numbers.

- **Scheme allow-list** for URI dereferencing. Rejecting `file://`, `data:`, and schemes outside an explicit allow-list by default is common practice.
- **Network-range restrictions**. Refusing to dereference URIs resolving to link-local (`169.254.0.0/16`, `fe80::/10`), loopback (`127.0.0.0/8`, `::1`), or private (RFC 1918) address ranges by default, with explicit operator opt-in for environments that legitimately need them.
- **Size caps** on fetched documents, schemas, and binding artifacts.
- **Timeouts** on fetches and on transform evaluation.
- **JSONata sandboxing**. Evaluating transforms without filesystem, network, or host-process access; disabling expression primitives that touch the host environment.
- **Transport security**. Enforcing TLS for non-loopback origins, and distinguishing declared from redirected URIs for identity purposes (see [§10. Location equality](#10-location-equality)).
- **Reference-cycle detection**. Required by [§12. Reference resolution](#12-reference-resolution) for `$ref` cycles; the same posture applies to transitive `roles` and `sources[*].location` traversal.

Whether and how to apply these is a processor concern. This subsection is informative; no rule in [§16. Conformance](#16-conformance) mandates specific mitigation policy.

---

## 16. Conformance

The normative shape of an OBI document is defined by this specification's prose. The accompanying `openbindings.schema.json` expresses the structural portion of that definition in JSON Schema form for validator tooling; it is a derived artifact, not a second source of truth. **Where prose and schema conflict, the prose governs.** Schema validation (OBI-D-02) is necessary but not sufficient for document conformance: some rules (such as the cross-references from `satisfies` into `roles`, or the recursive prohibition on `$vocabulary` per OBI-D-08) require walking the document beyond what JSON Schema validation expresses, and exist only in prose.

Each rule below carries a stable identifier (`OBI-D-##` for document rules, `OBI-T-##` for tool rules) so validators, test suites, and errata can cite it unambiguously. Identifiers are stable within a major version: they MUST NOT be reused or renumbered. Rules removed in a future major version retain their identifiers as historical references.

### 16.1. Conformance classes

Tools interacting with OBI documents fall into three conformance classes, distinguished by their relationship to transforms:

- **Inspection** — parses and validates OBI documents without evaluating transforms. Includes validators, indexers, discovery aggregators, and browser clients that surface operations for display or delegate invocation. No JSONata runtime required.
- **Codegen** — produces static artifacts (SDK types, documentation, client skeletons) from OBI documents. Transform strings pass through as opaque data. No JSONata runtime required at generation time. Codegen includes all Inspection obligations.
- **Invoking** — invokes bindings and evaluates declared transforms as part of invocation. Requires a JSONata 2.0 runtime. Invoking includes all Codegen obligations.

A tool claims the highest class it implements; lower-class obligations are implicit. Each tool rule in [§16.3. Tool rules](#163-tool-rules) is annotated with the minimum class to which it applies.

Claiming is informal: a tool self-declares its class in its documentation or metadata. The openbindings project does not maintain a registry of conformant tools; conformance is verified empirically by running the conformance test corpus, not by central registration.

### 16.2. Document rules

A conformant **OBI document**:

- **OBI-D-01**: Is valid UTF-8 encoded JSON per [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259). Duplicate JSON object keys within any object make the document invalid.
- **OBI-D-02**: Validates against the JSON Schema at `openbindings.schema.json`.
- **OBI-D-03**: Has unique operation keys within the document.
- **OBI-D-04**: Has every map key and every operation alias matching the pattern `^[A-Za-z_][A-Za-z0-9_.-]*$`.
- **OBI-D-05**: Has no collision between any two operation identifiers within the document, where an operation's identifiers are its key plus any entries in its `aliases` array.
- **OBI-D-06**: Has well-formed URI references (per [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) §4.1) in `roles`, `sources[*].location`, and schema `$ref` values.
- **OBI-D-07**: Has every `$schema` value, where present, equal to `https://json-schema.org/draft/2020-12/schema`.
- **OBI-D-08**: Has no `$vocabulary` keyword in any schema within the document.
- **OBI-D-09**: Has every `bindings[*].operation` value present as a key in the document's `operations` map.
- **OBI-D-10**: Has every `bindings[*].source` value present as a key in the document's `sources` map.
- **OBI-D-11**: Has every `bindings[*].security` value (when present) present as a key in the document's `security` map.
- **OBI-D-12**: Has every named-transform `$ref` in `bindings[*].inputTransform` and `bindings[*].outputTransform` resolving to a key in the document's `transforms` map.
- **OBI-D-13**: Has every `satisfies[*].role` value present as a key in the document's `roles` map.
- **OBI-D-14**: Has no duplicate entries (same `role` + `operation` pair) within any single operation's `satisfies` array.
- **OBI-D-15**: Has every example's provided `input` validating against its operation's `input` schema, and every example's provided `output` validating against its operation's `output` schema, when the respective schema is specified.
- **OBI-D-16**: Has an `openbindings` field whose value is a valid [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) string.
- **OBI-D-17**: Has every binding identifiable from the binding, its referenced source, and the document's discovery context alone, with no dependency on external registries, vendor catalogs, or environment configuration. (See [§8. Binding sufficiency](#8-binding-sufficiency).)

### 16.3. Tool rules

A conformant **tool**:

- **OBI-T-01** (Inspection): Does not fail processing a document solely because the document contains an unsupported binding format or security method type. Tools MAY surface diagnostics; bindings depending on unsupported artifacts are unactionable.
- **OBI-T-02** (Inspection): Ignores unknown fields that are not defined by this specification. Tools SHOULD surface diagnostics (warnings) for unknown non-`x-` fields to help catch typos.
- **OBI-T-03** (Inspection): Treats `x-` prefixed fields as extensions. Unknown `x-` fields MUST NOT change the meaning of core fields for conformance purposes.
- **OBI-T-04** (Inspection): Refuses documents declaring a higher major `openbindings` version than the tool supports. While the spec is pre-1.0 (major version 0), this refusal extends to higher minor versions, per [§13.1. `openbindings` field (spec version)](#131-openbindings-field-spec-version).
- **OBI-T-05** (Inspection; applies to tools that reason about schemas, e.g., for comparison, validation, or code generation): SHOULD surface diagnostics for semantically significant keywords the tool does not interpret.
- **OBI-T-06** (Codegen; applies to tools that resolve or act on `ref` values): Honors the addressing conventions of each binding format it claims to support.
- **OBI-T-07** (Invoking): A tool MUST validate caller-provided input against the operation's `input` schema when that schema is specified. If the binding declares an `inputTransform`, validation MUST occur before transform application. A validation failure is an invocation error for that operation; it does not render the document non-conformant.
- **OBI-T-08** (Invoking): When the operation's `output` schema is specified, a tool MUST validate the operation's result against the `output` schema. If the binding declares an `outputTransform`, the result to validate is the value produced by evaluating the transform; otherwise it is the source's output as received. A validation failure is an invocation error for that operation; it does not render the document non-conformant.
- **OBI-T-09** (Inspection; applies to tools that verify `satisfies` claims): SHOULD treat a `satisfies` claim as structurally supported only when every value satisfying the referenced role operation's `input` schema also satisfies the declaring operation's `input` schema (contravariant input), and every value satisfying the declaring operation's `output` schema also satisfies the role operation's `output` schema (covariant output). JSON Schema subsumption is undecidable in general; tools that cannot decide for a given pair MAY surface the claim as unverified rather than as a violation. A claim failing this check does not render the document non-conformant under [§6.1. Operations](#61-operations); the diagnostic surface is the intended outcome.
- **OBI-T-10** (Inspection; applies to tools that select among multiple bindings for the same operation): MUST prefer non-deprecated bindings over deprecated ones. A deprecated binding with any `priority` value is ranked after every non-deprecated binding. Within each tier, tools SHOULD prefer lower `priority` values. Tools MAY apply additional selection tactics (latency, cost, protocol preference) after the tier rule has been applied.
- **OBI-T-11** (Invoking): Evaluates declared transforms according to the [JSONata 2.0](https://docs.jsonata.org/) specification. Any implementation may provide its own JSONata 2.0 evaluator.
- **OBI-T-12** (Inspection; applies to tools that resolve `$ref` values): MUST handle cycles without infinite loops (via memoization, bisimulation, or similar techniques). The exact handling is tool-defined.

The consistent "don't fail the document on unknown X" posture across OBI-T-01 through OBI-T-04 is deliberate. Partial tool support is the common case: a tool may understand `openapi` bindings but not `grpc`, or some security method types but not others. Failing the whole document on any unsupported element would force every tool to support every element, fracturing the ecosystem. The diagnostic allowance preserves visibility: authors still learn when their document contains elements a specific tool can't act on. The distinction between warning on non-`x-` unknowns and silently accepting `x-` unknowns reflects that non-`x-` typos are usually misspelled core fields, while `x-` names are explicitly reserved for extensions whose names the spec cannot know.

OBI-T-07 through OBI-T-12 move the conformance floor past structural validity: they give tools that evaluate transforms, verify role claims, select among bindings, or resolve references something concrete to check beyond "the document parses." Each is spec-level under the [§2. Scope principle](#2-scope-principle) only where portability depends on it, and no further. OBI-T-07 and OBI-T-08 are MUSTs for Invoking-class tools because they apply at the operation-contract boundary, where values cross into and out of the portable contract; leaving these checks to tool discretion would let two conforming tools disagree on whether a given input or output honors the contract, which is the one disagreement the contract cannot survive. OBI-T-09 is a SHOULD because JSON Schema subsumption is not generally decidable, and a tool that cannot decide is permitted to surface the claim as unverified rather than pretending it has ruled on it. OBI-T-10's tier rule is a MUST because `deprecated: true` requires a portable selection-ordering meaning to be useful: without it, two conforming tools could disagree on whether a non-deprecated binding ranks ahead of a deprecated one, which the §6.3 spec-level tier prose rules out. Selection tactics beyond the tier (priority within tier, latency, cost, protocol preference, tool-specific signals) remain SHOULD- or MAY-level because they encode preferences whose meaning the spec deliberately leaves to authors and tools. OBI-T-11 is a MUST because JSONata 2.0 is the spec's mandated transform interchange language; an Invoking tool that evaluated transforms in any other language would silently produce different results from a conforming one, breaking the portability §6.5 commits to. OBI-T-12 is a MUST because §12 explicitly permits `$ref` cycles in recursive schemas; a tool that loops indefinitely on a conformant document would render the spec's permissive cycle rule unusable in practice.

This spec does not define tool behavior beyond these minimum conformance rules. Behavioral conventions (comparison, transform evaluation, security method resolution, etc.) are documented per-tool.

---

## 17. Extensions

- OBI documents MAY include extension fields whose keys begin with `x-` at any object location.
- Tools MUST ignore `x-` fields they do not understand.
- `x-` fields MUST NOT change the meaning of core fields defined by this spec.

---

## 18. References

### 18.1. Normative references

- **[BCP 14]** S. Bradner, "Key words for use in RFCs to Indicate Requirement Levels," RFC 2119 / BCP 14, March 1997. <https://www.rfc-editor.org/rfc/rfc2119>
- **[RFC 8174]** B. Leiba, "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words," RFC 8174, May 2017. <https://www.rfc-editor.org/rfc/rfc8174>
- **[RFC 8259]** T. Bray, Ed., "The JavaScript Object Notation (JSON) Data Interchange Format," RFC 8259, December 2017. <https://www.rfc-editor.org/rfc/rfc8259>
- **[RFC 3986]** T. Berners-Lee, R. Fielding, L. Masinter, "Uniform Resource Identifier (URI): Generic Syntax," RFC 3986, January 2005. <https://www.rfc-editor.org/rfc/rfc3986>
- **[RFC 6838]** N. Freed, J. Klensin, T. Hansen, "Media Type Specifications and Registration Procedures," RFC 6838, January 2013. <https://www.rfc-editor.org/rfc/rfc6838>
- **[RFC 6901]** P. Bryan, Ed., K. Zyp, M. Nottingham, Ed., "JavaScript Object Notation (JSON) Pointer," RFC 6901, April 2013. <https://www.rfc-editor.org/rfc/rfc6901>
- **[RFC 8089]** M. Kerwin, "The 'file' URI Scheme," RFC 8089, February 2017. <https://www.rfc-editor.org/rfc/rfc8089>
- **[RFC 8615]** M. Nottingham, "Well-Known Uniform Resource Identifiers (URIs)," RFC 8615, May 2019. <https://www.rfc-editor.org/rfc/rfc8615>
- **[UTS #46]** Unicode Consortium, "Unicode IDNA Compatibility Processing," Unicode Technical Standard #46. <https://www.unicode.org/reports/tr46/>
- **[SemVer 2.0.0]** Tom Preston-Werner, "Semantic Versioning 2.0.0." <https://semver.org/spec/v2.0.0.html>
- **[JSON Schema 2020-12]** JSON Schema Specification, Draft 2020-12. <https://json-schema.org/draft/2020-12>
- **[JSONata 2.0]** JSONata Project, "JSONata Documentation," version 2. <https://docs.jsonata.org/>

### 18.2. Informative references

- **[RFC 6750]** M. Jones, D. Hardt, "The OAuth 2.0 Authorization Framework: Bearer Token Usage," RFC 6750, October 2012. <https://www.rfc-editor.org/rfc/rfc6750>
- **[RFC 8785]** A. Rundgren, B. Jordan, S. Erdtman, "JSON Canonicalization Scheme (JCS)," RFC 8785, June 2020. <https://www.rfc-editor.org/rfc/rfc8785>. Cited by [§11. Canonical form (informative)](#11-canonical-form-informative).
- **JSONata reference implementation**: JSONata Project, `jsonata` (npm). <https://github.com/jsonata-js/jsonata>. The JavaScript reference implementation for [JSONata 2.0](https://docs.jsonata.org/); cited by [§6.5. Transforms](#65-transforms) as the SHOULD-level tie-breaker where the JSONata 2.0 specification does not unambiguously define behavior.
- **openbindings reference tools**: `ob` CLI, `openbindings-go`, `openbindings-ts` (see project README). One implementation of this spec among potentially many.
- **Companion guides**: `guides/` in the specification repository (tutorials, format convention summaries, author guidance; informational, not normative).

---

## 19. See also

- `openbindings.schema.json` — JSON Schema for document validity.
- `guides/` — tutorials, format convention summaries, author guidance (informational, not normative).
- `interfaces/` — role interfaces published by the openbindings project (informational).
- `formats/` — companion format specifications (authority level varies per format).
- `conformance/` — conformance test corpus keyed to OBI-D-##/OBI-T-## rule identifiers (fixtures, manifest, fixture meta-schema, reference Go runner).
- `CHANGELOG.md` — version history and diffs between spec versions.
- `EDITORS.md` — current editor roster.
- `GOVERNANCE.md` — project governance and decision-making.
- `SECURITY.md` — vulnerability reporting and security contact.

[Terminology]: #5-terminology
[Operations]: #61-operations
[Schemas]: #62-schemas
[Bindings]: #63-bindings
[Sources]: #64-sources
[Transforms]: #65-transforms
[Security]: #66-security
[Roles]: #67-roles
[Discovery]: #7-discovery
[Binding sufficiency]: #8-binding-sufficiency
[Interface identity]: #9-interface-identity
[Location equality]: #10-location-equality
[Reference resolution]: #12-reference-resolution
[Versioning]: #13-versioning
[Security considerations]: #15-security-considerations
[Conformance]: #16-conformance
