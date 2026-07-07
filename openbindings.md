# OpenBindings Specification (v0.2.0)

## Abstract

OpenBindings (OBI) is a portable interface description format. A service describes its operations (input/output contracts, examples) once, and exposes them over OpenAPI, AsyncAPI, gRPC, MCP, or any other binding format. The contract lives at the operation layer; the protocols live at the binding layer.

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
    "httpApi": { "format": "openapi@3.1", "location": "https://example.com/openapi.json" }
  },
  "bindings": {
    "createTask.http": { "operation": "createTask", "source": "httpApi", "ref": "#/paths/~1tasks/post" }
  }
}
```

The body of this document defines the OBI shape, discovery convention, reference-resolution rules, and conformance floor. New readers may prefer the [§4. Overview](#4-overview) walkthrough; the normative material starts at [§5. Terminology](#5-terminology).

## Editors

- Matthew Clevenger ([@clevengermatt](https://github.com/clevengermatt))

See `EDITORS.md` for the current editor roster.

## Status of this document

This is **version 0.2.0** of the OpenBindings specification. It is pre-1.0, and minor-version revisions MAY include breaking changes per [§11.1. `openbindings` field (spec version)](#111-openbindings-field-spec-version). Substantive changes are recorded in `CHANGELOG.md` and cite stable rule identifiers (`OBI-D-##`/`OBI-T-##`) where applicable.

## License and intellectual property

This specification is published under the Apache 2.0 License (see `LICENSE`). Contributions are accepted under the same license, which includes an express patent grant from each contributor covering any claims embodied by their contribution. No party has disclosed patents essential to implementing this specification.

## Notational conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in all capitals.

JSON shown inline in this document is illustrative unless the surrounding prose explicitly states a requirement. (This is distinct from the operation `examples` field, whose contents are conformance-checked under [Conformance].)

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
- [7. Discovery](#7-discovery)
  - [7.1. Response contract](#71-response-contract)
- [8. Binding sufficiency](#8-binding-sufficiency)
- [9. Canonical form (informative)](#9-canonical-form-informative)
- [10. Reference resolution](#10-reference-resolution)
- [11. Versioning](#11-versioning)
  - [11.1. `openbindings` field (spec version)](#111-openbindings-field-spec-version)
  - [11.2. `version` field (contract version)](#112-version-field-contract-version)
- [12. IANA considerations](#12-iana-considerations)
  - [12.1. Well-known URI suffix](#121-well-known-uri-suffix)
  - [12.2. Media type](#122-media-type)
- [13. Security considerations](#13-security-considerations)
  - [13.1. Recommended mitigations (informative)](#131-recommended-mitigations-informative)
- [14. Conformance](#14-conformance)
  - [14.1. Tool obligations](#141-tool-obligations)
  - [14.2. Document rules](#142-document-rules)
  - [14.3. Tool rules](#143-tool-rules)
- [15. Extensions](#15-extensions)
- [16. References](#16-references)
  - [16.1. Normative references](#161-normative-references)
  - [16.2. Informative references](#162-informative-references)
- [17. See also](#17-see-also)

---

## 1. Positioning

OpenBindings operates one layer above protocol-specific interface specifications like OpenAPI, AsyncAPI, gRPC, and MCP. Those specs describe how to invoke endpoints over a particular wire format. OBI describes, at the layer above: what operations a service offers, what their input and output contracts are, and the shared-contract names by which those operations can be recognized, independent of protocol.

An OBI does not replace the binding formats it points at. Each format remains authoritative over its own wire shape. An OBI adds the operation-level overlay that no single binding format alone carries, and does so in a way that survives across multiple protocols.

### 1.1. Distinguishing features

- **One operation, many bindings.** A single operation contract can be exposed over multiple protocols simultaneously without duplicating the contract.
- **Vendor-independent correspondence.** An operation can carry the same name a shared contract uses, so consumers recognize it by that shared name rather than by who runs the service (see [§6.1. Operations](#61-operations)).
- **Convention-driven discovery.** A service publishes its interface at `/.well-known/openbindings`, so tools can find it without configuration.
- **Context-free references.** Every OBI-defined document reference is absolute or same-document, so a document resolves identically wherever it was obtained (origin, cache, redirect, stdin, or memory): no such reference takes its base from the fetch location, and no separate name-to-location registry step. (`bindings[*].ref` is interpreted by the binding format, not by this rule; see [§10. Reference resolution](#10-reference-resolution).)

### 1.2. Out of scope

OpenBindings does not:

- **Replace underlying binding formats.** OpenAPI, AsyncAPI, gRPC, MCP, and others remain authoritative for their wire formats. OBI points at them.
- **Serve as an authoring language.** OBI is the target artifact, not a source format that compiles to multiple targets. Tools like TypeSpec and Smithy occupy that adjacent role.
- **Define runtime or protocol semantics.** Invocation, retries, credential flow, sandboxing, and rate limiting are processor concerns.
- **Maintain registries of formats.** Addressing is URI-based; format-token authority rests with each format's community.
- **Specify integrity, signing, or attestation.** Supply-chain verification composes externally over URI fetches.

## 2. Scope principle

OpenBindings is deliberately minimal. This specification mandates only what is necessary to guarantee portable interface descriptions and a minimum conformance floor for tools. Authority over everything else rests in two places:

- **Binding format specifications** (OpenAPI, AsyncAPI, protobuf, MCP, and others) are authoritative over their own wire formats, reference syntax, addressing conventions, version semantics, and format-token governance. OBI points at binding artifacts; it does not override them.
- **Implementations and their communities** (tools, SDKs, registries, gateways, operators) are authoritative over behavior that depends on local deployment or invocation: transform runtimes, selection heuristics, security posture, mitigation policy, comparison and matching strategies, and operational choice.

OpenBindings is intentionally thin so that adjacent specifications and implementation communities can exercise their own governance without conflict from this document. Where this spec expressly defers to "the format's specification," to "tool concerns," or to "implementation-defined behavior," that deferral is an application of this principle.

Readers evaluating conformance should read the rest of this document in light of this principle.

---

## 3. Scope of this specification

This spec defines **what an OBI document is** (its shape, discovery convention, reference-resolution rules, and versioning) and **a minimum conformance floor for tools** that preserves document portability. It does not define higher-level tool behavior or binding-format conventions; those rest with implementations and with each format's own specification, per [§2. Scope principle](#2-scope-principle) and the out-of-scope list in [§1.2. Out of scope](#12-out-of-scope). The conformance floor in [§14. Conformance](#14-conformance) does bind tool behavior, but only at the points where portability would otherwise break (version refusal, input/output validation at the invocation boundary, binding-selection ordering, `$ref`-cycle handling, operation-name resolution, and the discovery response contract). The only place that floor mandates a specific external language is the transform evaluation language: JSONata 2.0 is mandated for tools that evaluate transforms (see [Transforms]), while the runtime around it (sandboxing, error handling, resource limits, invocation lifecycle) stays tool-defined.

---

## 4. Overview

OpenBindings separates what a service does (operations with input/output schemas) from how you access it (bindings to OpenAPI, AsyncAPI, gRPC, MCP, or any other binding specification). A single OBI document can reference bindings in multiple protocols without redefining the operation contract. Services can publish their OBI at a well-known location so tools can discover and act on it.

Terms used informally below (operation, binding, source, transform, alias) are defined precisely in [Terminology]. Readers unfamiliar with the vocabulary may prefer to skim that section first.

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
    "httpApi": { "format": "openapi@3.1", "location": "https://example.com/openapi.json" }
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
    "httpApi":   { "format": "openapi@3.1",    "location": "https://example.com/openapi.json" },
    "mcpServer": { "format": "mcp@2025-11-25", "location": "https://example.com/mcp" }
  },
  "bindings": {
    "createTask.http": { "operation": "createTask", "source": "httpApi",   "ref": "#/paths/~1tasks/post" },
    "createTask.mcp":  { "operation": "createTask", "source": "mcpServer", "ref": "tools/create_task" }
  }
}
```

A realistic OBI layers in shared schemas reused across operations, a named transform bridging a source's wire shape with the operation contract, and an alias making an operation addressable by a shared contract name:

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
      "aliases": ["tasks.create"],
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
  "sources": {
    "httpApi": { "format": "openapi@3.1", "location": "https://example.com/openapi.json" },
    "mcpServer": { "format": "mcp@2025-11-25", "location": "https://example.com/mcp" }
  },
  "bindings": {
    "createTask.http": {
      "operation": "createTask",
      "source": "httpApi",
      "ref": "#/paths/~1tasks/post",
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
- **Alias**: an additional name under which an operation is recognized, beyond its key. An operation's key plus its aliases form one flat, document-unique namespace of names that all resolve to that operation.

How these relate: an **operation** is the portable contract, independent of any protocol. A **source** points at a binding artifact. A **binding** links one operation to one source and optionally attaches a **transform** that bridges shape differences. An operation is addressable by its key or any of its **aliases**; both are equally valid for resolution.

Whether one OBI is compatible with another is a matter of tool-defined comparison and matching semantics; this spec defines neither. Cross-document correspondence — an operation claiming to satisfy a shared contract by carrying that contract's name as its key or an alias — is detailed in [§6.1. Operations](#61-operations).

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
| `sources` | object | no | Map of source keys to source objects. |
| `bindings` | object | no | Map of binding keys to binding objects. |
| `transforms` | object | no | Map of transform names to JSONata expression strings. |

Operation keys MUST be unique within a document. Binding, source, transform, and schema keys MUST be unique within their respective maps. All map keys (operation, binding, source, transform, schema, and example keys) and all operation aliases MUST match the pattern `^[A-Za-z_][A-Za-z0-9_.-]*$`. This constrains identifiers to a codegen-friendly ASCII subset while permitting common conventions like dotted grouping (`createTask.http`) or hyphenated names (`my-operation`).

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
| `aliases` | array of strings | Additional names, equal in standing to the operation's key, by which this operation is recognized. |
| `idempotent` | boolean | Hint that multiple invocations with the same input produce the same observable state. |
| `input` | JSON Schema, `null`, or absent | Shape of input to this operation. |
| `output` | JSON Schema, `null`, or absent | Shape of output from this operation. |
| `examples` | object | Map of example names to `{description?, input?, output?}` objects. |

`input` and `output` are optional. Absent and `null` are equivalent; both mean "unspecified." A schema is "specified" when present and not `null`. `{}` (the empty schema) is NOT equivalent to absent; it means "documented as accepting any JSON value." This three-way distinction preserves author intent: "unspecified" lets downstream tools reject the operation or prompt for clarification, while `{}` signals that the author has chosen to accept any value and codegen tools can generate a pass-through type.

The `input` and `output` schemas are caller-facing contracts that run in opposite directions. A service implementing the operation accepts at minimum every value validating against `input` and may accept more; a caller sending any value validating against `input` is honoring the input contract. A service implementing the operation produces only values validating against `output` and may produce a narrower set; a caller receiving a successful result can rely on it validating against `output`.

`aliases` declares additional names for the operation. An operation's **identifiers** are its key plus its aliases, and they share one flat namespace: every identifier is equally valid for resolving the operation, and the choice of which name to place in the key versus in `aliases` carries no semantic weight beyond the key being the operation's primary, singular name for display, logging, and binding references (the value bindings carry in `bindings[*].operation`). The namespace is document-unique across all operation identifiers, including within a single operation: an identifier MUST NOT collide with any other identifier in the document, an alias MUST NOT equal its own operation's key, and an operation's aliases MUST be distinct from one another (per [OBI-D-04](#142-document-rules)). So any identifier resolves to at most one operation. A consumer holding an alias and a consumer holding the key refer to the same operation.

Common uses of `aliases`: a prior name kept for continuity after a rename, a vendor-specific name some consumers look up by, or a shared-contract name that makes this operation addressable as the implementation of a published interface (e.g., `tasks.create` on a `createTask` operation). The last is one way an OBI claims cross-document correspondence: it adopts the contract's operation name as an alias. An operation can equally claim correspondence by using the contract's name as its key; key and alias are equal identifiers for resolution, so the alias form matters only when the operation keeps a different primary key. The name is an ordinary identifier. The spec attaches no verification, ownership, or trust semantics to it; whether an alias legitimately names a published contract is a registry and tooling concern, not a property the document can assert or a tool can confirm from the document alone.

Because an operation's identifiers share one flat, document-unique namespace ([OBI-D-04](#142-document-rules)), a document that claims correspondence with several published contracts at once cannot adopt two names that collide. Bare operation names that many interfaces share (a `listFormats`, a `get`, a `request`) collide the moment one document adopts them from two contracts at once. The spec prescribes no naming scheme. It does advise authors of published contracts to choose operation names with a high likelihood of global uniqueness, so that an implementation can correspond to several contracts at once without its adopted names clashing; qualifying a name with the publishing project's or interface's namespace is one way to achieve that, but the spec mandates none. How uniqueness is achieved is the contract author's choice; the spec constrains only the identifier syntax ([OBI-D-03](#142-document-rules)) and the document-unique namespace.

How tools must resolve an operation by name is fixed by [OBI-T-12](#143-tool-rules) so that two conforming tools never disagree on which operation a name selects.

`idempotent` is a contract-level claim that consumers (retry logic, caching layers, client-side dedup, agent planners) can rely on: every binding for this operation MUST preserve the guarantee. An operation whose bindings cannot uniformly honor the guarantee (for example, a non-idempotent HTTP verb wrapping a handler that creates a new resource each call) MUST NOT declare `idempotent: true`. Absence of `idempotent: true` is not an assertion that the operation is non-idempotent; it means the document makes no portable idempotency claim, and a consumer MUST NOT infer one in either direction from its absence.

`aliases` and `idempotent` carry author-attested meaning the spec cannot mechanically verify from the document alone: that an alias legitimately names what the author intends (a prior name, a vendor name, a shared-contract name) and that invocations are idempotent. The spec enforces structural constraints on these fields (alias format and the document-unique identifier namespace) under [Conformance], and those structural constraints determine document validity. The attested content itself is not a conformance test: tools MUST NOT reject a document as non-conformant on the basis that an author-attested claim appears semantically inaccurate. Tools MAY surface diagnostics and MAY use author-attested claims as input to their own higher-level decisions (matching, selection, retry strategy).

The metadata fields carry different *kinds* of authority. The following table is informative; the prose and conformance rules govern.

| Field | Kind | Conformance meaning |
|---|---|---|
| `aliases` | structural + author-attested | syntax and the document-unique namespace are enforced (OBI-D-03, OBI-D-04); whether a name legitimately matches an external contract is not verified |
| `idempotent` | author-attested | consumers MAY rely on it; its semantic truth is not mechanically verified, and absence asserts nothing |
| `deprecated` (binding) | selection signal | the binding-level tier rule is normative (OBI-T-09); operation-level `deprecated` is a migration hint only |
| `preference` | preference signal | SHOULD order bindings among the viable candidate set (OBI-T-09); not a deterministic selector |
| `examples` | checked samples | provided `input`/`output` MUST validate when the respective schema is specified (OBI-D-11) |

`examples` holds author-supplied sample input/output pairs for an operation. The spec defines only the structural shape; consumers such as generated docs, SDK codegen, test harnesses, and agent few-shot material apply them as they see fit. Within any example, a provided `input` MUST validate against the operation's `input` schema when that schema is specified, and a provided `output` MUST validate against the operation's `output` schema when that schema is specified.

An operation's `input` and `output` schemas may be inlined or referenced via `$ref` into the document's `schemas` map or into an external schema document.

### 6.2. Schemas

The top-level `schemas` map holds named JSON Schema objects. Operations reference them via `$ref` (e.g., `{"$ref": "#/schemas/Task"}`).

Schemas at OBI document positions (the value of `input`, `output`, and entries in `schemas`) are in JSON Schema 2020-12's object form; the boolean schemas `true` and `false` are not used at those positions. The empty schema `{}` expresses "accepts any value" per [§6.1. Operations](#61-operations). Boolean values inside a schema's own keyword definitions (such as `additionalProperties: false`) are JSON Schema 2020-12 keyword arguments and are unaffected.

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
| `preference` | number | Preference hint for binding selection. Higher is more preferred; absent is treated as 0. |
| `description` | string | Human-readable description. |
| `deprecated` | boolean | Hint that this binding is being phased out. |
| `inputTransform` | JSONata string or `$ref` | See [Transforms]. |
| `outputTransform` | JSONata string or `$ref` | See [Transforms]. |

`ref` identifies a specific entry within the binding artifact. Its syntax is governed by the format's own specification, not by this spec. For example: JSON Pointer fragments for OpenAPI and AsyncAPI; fully-qualified method names for gRPC; tool names for MCP. Tools that resolve or act on `ref` MUST interpret it per the format's conventions. Where a format has a primary specification (OpenAPI, AsyncAPI, protobuf, MCP, etc.), that specification is the authority. Where a format lacks one, the convention established by its widely-used implementations serves as the authority. The openbindings project tracks common conventions in non-normative guides as a courtesy; these are informational, not standards. When `ref` is absent, the binding targets the binding artifact as a whole, per the same authority.

For new binding formats whose artifact is a JSON document and whose addressing scheme is the format's own design choice (rather than inherited from an upstream protocol like MCP or gRPC), the format specification SHOULD adopt [JSON Pointer (RFC 6901)](https://www.rfc-editor.org/rfc/rfc6901) as its `ref` syntax. This recommendation exists to prevent convention sprawl across JSON-based formats: a single shared addressing scheme keeps refs self-describing and lets tools share resolution machinery. Format authors with a concrete reason to deviate are free to do so.

Multiple bindings MAY reference the same operation. The operation's `input` and `output` schemas form a portable contract, and each binding for that operation is an alternative target authored to honor that contract over a specific protocol. A caller invokes the operation through any one of its bindings; using one binding is a complete invocation of the operation. Selection among alternatives is a tool concern; see `preference`.

`preference` (on bindings, and on sources in the next section) is a preference signal for selecting among multiple bindings for the same operation; higher values are more preferred. A binding's effective preference is its own `preference` when present, otherwise its source's `preference` when present, and otherwise 0; an absent preference is therefore the neutral baseline of 0. Negative values are permitted and rank below the baseline, for explicitly burying a binding beneath the unannotated default. The spec does not prescribe what the preference means; authors encode their own axis, such as canonical vs mirror, stable vs experimental, cheap vs expensive, or newer protocol vs fallback. Source-level preference provides a default for every binding using that source; binding-level preference, when present, overrides that default for a specific binding rather than combining with it. This keeps the common case ergonomic (set once per source) while allowing per-binding exceptions. Whether and how tools consume preference is a tool concern. Preference orders the bindings a tool can actually act on; it is a preference signal over that candidate set, not a universal deterministic selector (see [OBI-T-09](#143-tool-rules)). When multiple bindings share the highest effective preference, selection among them is tool-defined; authors who want deterministic ordering set distinct preferences.

`deprecated` combines with `preference` as a coarser ordering tier. Non-deprecated bindings rank ahead of deprecated bindings regardless of preference value, and `preference` orders bindings within each tier. A non-deprecated binding with `preference: 0` is preferred over a deprecated binding with `preference: 1000`. Authors who want a deprecated binding to be selected should remove the `deprecated` flag rather than raising its preference. The tier rule does not apply to operation-level `deprecated` (see [§6.1. Operations](#61-operations)), which signals migration intent for the operation as a whole rather than selection preference among its bindings. The tier rule is spec-level because `deprecated: true` requires a portable selection-ordering meaning to be useful; every other selection concern remains tool-defined per [§2. Scope principle](#2-scope-principle).

### 6.4. Sources

A source object MUST contain:

| Field | Type | Purpose |
|---|---|---|
| `format` | string | Format token. See below. |

And MUST contain at least one of:

| Field | Type | Purpose |
|---|---|---|
| `location` | string | Absolute URI (or format-defined absolute address) of an external binding artifact. |
| `content` | value | Embedded binding content. Object for JSON-structured formats; string for text-based formats. |

And MAY contain:

| Field | Type | Purpose |
|---|---|---|
| `description` | string | Human-readable description. |
| `preference` | number | Preference hint applied to all bindings using this source. |

When `content` is a string, it holds the UTF-8 source text of the binding artifact (for example, a `.proto` file's source, or a KDL document). When `content` is an object, it holds the parsed JSON representation of the artifact. Binary artifacts MUST be carried via `location` rather than embedded; `content` is for textual and JSON-structured forms only. Format communities determine which textual or structural representation is canonical for a given format; a format may accept only one form, or both. If both `location` and `content` are present for the same source, a processor MUST interpret the binding artifact from `content`; `location` is then provenance and documentation only, unless a processor explicitly chooses to refresh or compare against the external artifact. Embedded `content` carries no fetch location of its own, so OBI defines no base URI for references internal to the embedded artifact (a relative `$ref` in an embedded OpenAPI document, a protobuf `import`). Embedded `content` MUST therefore be self-contained: every reference internal to the artifact resolves without an external base (for example, bundled, or a compiled form such as a protobuf `FileDescriptorSet`). An artifact that relies on a base URI to resolve its own references is carried via `location` instead, where the format resolves those references per its own rules. When `location` is also present alongside `content`, it remains provenance only and is never a resolution base for the embedded artifact; this keeps a document with embedded `content` resolvable identically everywhere, consistent with the context-free guarantee of [§10. Reference resolution](#10-reference-resolution). A consequence worth noting (non-normative): when `content` is present, `location` does not reflect what a processor interprets, so it should not be read as the source of the processed artifact for provenance, signing, or review. Authors may set both when they want a self-contained document (the embedded `content` makes processing independent of network fetches) while preserving the canonical origin URL for documentation, provenance, or downstream tools that prefer a live fetch.

**Format tokens.** The `format` field is a string that identifies the binding specification for a source. Format tokens are community-extensible; what characters appear in them and how different strings relate to one another (equivalence, compatibility, ordering) is determined by each format's own community. The openbindings project recommends the convention `<name>@<version>` (e.g., `openapi@3.1`, `mcp@2025-11-25`) as an interoperable default for new format tokens. This spec does not maintain a registry of format tokens; authority over a format's conventions lies with that format's own specification or, in its absence, its implementer community.

`location` is an absolute reference; see [Reference resolution].

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

A transform is a [JSONata](https://jsonata.org/) expression string. A tool that evaluates transforms (see [§14.1. Tool obligations](#141-tool-obligations)) MUST do so according to [JSONata 2.0](https://docs.jsonata.org/); any implementation may provide its own JSONata 2.0 evaluator.

"JSONata 2.0" here denotes the language at its 2.x major version as defined by its published documentation and reference implementation, not a separate formal standard maintained by this project. Where that documentation leaves behavior unspecified or ambiguous, tools SHOULD follow the behavior of the JSONata reference implementation (see [§16.2. Informative references](#162-informative-references)). Non-determinism inherent to JSONata's standard library (e.g., `$now()`, `$random()`, `$millis()`) is not a conformance defect: outputs MAY differ across calls and across tools whenever the transform expression itself is non-deterministic. The portability guarantee is correctness of evaluation, not byte-equivalence of outputs.

Invocation semantics, including how errors propagate, resource limits, and sandboxing, are tool concerns; see [Security considerations].

Mandating one expression language is what makes transforms portable: a pluggable choice would leave a JSONata document unusable to a consumer supporting only CEL or JMESPath, and a floor with optional alternatives collapses to the same commitment since every invoker still needs the floor's runtime for the common case. Among expression languages with mature cross-language implementations, JSONata is the one purpose-built for JSON-to-JSON shape rewriting (envelope wrapping, MCP content-block extraction, discriminated-union restructuring).

Named transforms MAY be defined in the top-level `transforms` map (keys are names, values are JSONata expression strings) and referenced by binding entries via `$ref` (e.g., `{"$ref": "#/transforms/fromApiOutput"}`). Bindings MAY also inline a transform directly as the string value of `inputTransform`/`outputTransform`.

**Request lifecycle (informative).** A tool invoking a binding at call time typically: (1) resolves a binding for the operation, taking into account `preference`, which bindings the tool can actually act on (e.g., choosing a less-preferred binding whose format it supports over a more-preferred one whose format it cannot parse, per [OBI-T-01](#143-tool-rules)), and tool-specific preferences such as latency, cost, or protocol; (2) validates caller-provided input against the operation's `input` schema when specified; (3) evaluates the binding's `inputTransform` on the caller's input, if declared; (4) invokes the binding's source with the result, honoring the format's addressing conventions, and supplying any runtime context the binding requires (credentials and the like are resolved by the invoker, not declared in the OBI document); (5) evaluates the binding's `outputTransform` on the source's output, if declared, then validates the resulting value against the operation's `output` schema when that schema is specified; (6) returns the result to the caller. This spec does not prescribe the steps; it describes where each field fits so tool authors share a common picture.

---

## 7. Discovery

A service MAY publish its OBI document at the URI path `/.well-known/openbindings` on its primary origin. The `/.well-known/` namespace follows [RFC 8615](https://www.rfc-editor.org/rfc/rfc8615), which reserves this prefix for interoperable service-metadata endpoints. A 404 at this path simply means "no OBI here"; it is not an error condition. This convention addresses the one-interface-per-origin case. Origins that host multiple distinct interfaces (gateways, monorepos, multi-tenant platforms) are out of scope for the well-known convention and rely on other discovery mechanisms. Other discovery mechanisms (registries, configuration, service meshes) are out of scope for this spec.

### 7.1. Response contract

When serving an OBI at `/.well-known/openbindings`:

- The method is `GET`.
- A successful response returns `200 OK` with a body containing a valid OBI document.
- The response `Content-Type` SHOULD be `application/vnd.openbindings+json`. `application/json` MAY be used and MUST be accepted by clients.
- Clients SHOULD send `Accept: application/vnd.openbindings+json, application/json` to signal media-type preference. Servers MAY content-negotiate on this header but MUST NOT refuse a request that lacks it when they otherwise serve an OBI at this path.
- If the service does not publish an OBI at this path, the response is `404 Not Found`. An endpoint that gates discovery behind authentication or authorization MAY instead respond `401`/`403` and need not reveal whether an OBI exists behind it; the `404` expectation applies to a request the endpoint would otherwise serve.
- Clients SHOULD follow `3xx` redirects when fetching this path, subject to their own redirect policy and limits. Redirects are routine deployment artifacts (HTTP-to-HTTPS upgrades, trailing-slash normalization, CDN frontends); a client that treated them as "no OBI published" would silently disagree with one that followed them. Because a document's OBI-defined references are absolute or same-document, following a redirect does not change how it resolves ([§10. Reference resolution](#10-reference-resolution)); any identity or cache key a client derives from the fetched URI is its own concern.
- Any other response (other `4xx`, `5xx`, or `200` whose body is not a valid OBI) is outside the scope of this spec; clients MAY treat such responses as if no OBI is published at this path.
- Discovery endpoints MAY require authentication or authorization. Whether to publish an OBI to unauthenticated clients is a deployment decision; this spec does not mandate public discovery.
- Discovery endpoints intended for public consumption SHOULD set permissive CORS response headers (for example, `Access-Control-Allow-Origin: *`). Cross-origin discovery is a primary use case; omitting CORS silently breaks browser-side clients fetching the well-known URI. Publishers restricting discovery to specific origins MAY set CORS headers accordingly.

The serving and fetching obligations in this section are pinned as conformance rules [OBI-T-13](#143-tool-rules) (serving) and [OBI-T-14](#143-tool-rules) (fetching) in [§14.3. Tool rules](#143-tool-rules).

---

## 8. Binding sufficiency

Each binding in an OBI document identifies a concrete interaction target, and the information needed to identify it MUST be contained in the binding and its referenced source alone: the source's `format` plus its absolute `location` or embedded `content`, and the binding's `ref`. A consumer that understands the source's format can identify the target from that information without consulting any external registry, vendor catalog, or environment configuration. A binding that needs such an out-of-band lookup is non-conformant ([OBI-D-13](#142-document-rules)).

Sufficiency does not extend to reachability. Whether the identified target is currently reachable, accepts a caller's credentials, or succeeds at call time are properties of the running service and its deployment, not of the document. An OBI is conformant whether or not the target it identifies is callable at any given moment.

`ref` syntax (including the absent-`ref` case) is each format's own concern, so verifying sufficiency for a given binding takes the same per-format knowledge as [OBI-T-06](#143-tool-rules): a format-agnostic validator confirms the formats it understands and leaves the rest unverified rather than failing the document, consistent with [OBI-T-01](#143-tool-rules). Conformance is a fixed property of the document; a binding a validator cannot check is unverified, not non-conformant.

OBI's interop guarantee for a given binding is no stronger than the format's own. Where a binding format is ambiguous, that ambiguity is inherited by bindings targeting it; resolving it is the format community's work, not OBI's.

---

## 9. Canonical form (informative)

Some applications need a stable byte representation of an OBI document — for content addressing, integrity attestation, signature verification, or prompt-cache stability when feeding OBIs to language models. This section names one so tools and downstream specifications can refer to it consistently; it is informative, and conformance does not require producing or consuming canonical-form documents.

The canonical form of an OBI document is the document serialized per [RFC 8785 (JSON Canonicalization Scheme, JCS)](https://www.rfc-editor.org/rfc/rfc8785), a deterministic byte serialization of JSON. JCS does not permit `NaN` or `±Infinity`, so a document containing those has no canonical form (no rule here generates them). Canonical form is distinct from any readable ordering a tool emits while authoring; a tool MAY use both: a readable order for authoring, JCS for canonicalization.

---

## 10. Reference resolution

OBI documents define no `id` field, and no reference in them resolves against the URI a document was fetched from, so a document resolves identically however it was obtained: from its origin, a cache, a redirect, stdin, or an in-memory object. Resolution never depends on where the document came from, and a document has no "home" it must be retrieved from to be understood. OBI assigns no identity of its own; the `name` and `version` fields are labels, not identifiers.

Every **OBI-defined document reference** is absolute or same-document. For this section, an OBI-defined document reference is one of:

1. `sources[*].location`: an absolute URI, or a format-defined absolute address that needs no base URI to interpret (for example, a gRPC `host:port`). It is never a relative reference. A source MAY instead embed its artifact as `content`.
2. A schema `$ref` (whether on an operation `input`/`output`, in the `schemas` map, or nested as a subschema within any of these): a same-document fragment (beginning with `#`) or an absolute URI. A schema `$id`, when present, is absolute.
3. A named-transform `$ref` in `bindings[*].inputTransform` or `bindings[*].outputTransform`: a same-document fragment resolving into the `transforms` map (per [OBI-D-10](#142-document-rules)).

`bindings[*].ref` is **not** an OBI-defined document reference. It is an address into the binding artifact, interpreted by the binding format identified by the referenced source's `format` (see [§6.3. Bindings](#63-bindings)). Its syntax (a JSON Pointer for OpenAPI, a fully-qualified method name for gRPC, a tool name for MCP, and so on) is that format's concern, and it is exempt from the absolute-or-same-document requirement above.

Schema `$ref` and `$id` resolution follows [JSON Schema 2020-12](https://json-schema.org/draft/2020-12): a `$id`, when present, establishes the schema resource and the base URI for the `$ref`s inside it. OBI does not override that; it only constrains the forms (OBI-D-05: each schema `$ref` a same-document fragment or an absolute URI, each `$id` absolute), which is what keeps schema resolution independent of where the OBI document was fetched. A fragment `$ref` that is a JSON Pointer uses [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) escapes (`~0` for `~`, `~1` for `/`). An absolute `$ref` addresses an external schema a tool fetches; a tool MAY decline to fetch external schemas, and a document whose `$ref`s are all same-document fragments is resolvable with no network access at all, as the OpenBindings project's published interfaces are.

For schemas embedded in an OBI document, the initial base URI for resolving same-document fragments is the OBI document root, not the URI the document was fetched from. A same-document fragment `$ref` (such as `#/schemas/Task`) is therefore evaluated as an [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) JSON Pointer from that root, and a bare `#` addresses the root, until resolution enters a schema that declares its own `$id` (which, per JSON Schema 2020-12, establishes a new base URI for the `$ref`s within it). JSON Schema 2020-12 leaves the resolution context of schemas embedded in a non-schema document to the embedding application; OBI fixes that context here so a `#/schemas/...` reference resolves identically across tools. A consequence (informative): a tool that extracts an operation's `input` or `output` subschema and resolves it through a JSON Schema implementation in isolation must preserve the OBI document as the resolution scope (for example, by bundling or registering it), or the same-document fragment will not resolve.

Schema `$ref` cycles (where resolving a chain of `$ref`s returns to an already-visited schema) are common in recursive types (trees, linked lists, comment threads, ASTs). Cycles are permitted rather than forbidden because recursive types are legitimate and widespread; excluding them would cut off a large class of real-world schemas. Tools that resolve `$ref` MUST handle cycles without infinite loops (via memoization, bisimulation, or similar techniques). The exact handling is tool-defined.

Comparing two URIs for identity (for example, to cache or deduplicate fetched documents) is a tool concern; this spec defines no canonical equality. A tool that normalizes for this purpose should keep two questions distinct: which *document* was fetched, where the fragment is irrelevant, versus which *schema* a `$ref` targets, where `…#/$defs/A` and `…#/$defs/B` address different schemas and must stay distinct (including for the cycle handling above).

---

## 11. Versioning

OBI documents carry two independent version concepts.

### 11.1. `openbindings` field (spec version)

The `openbindings` field identifies which version of this specification the document is declared against. The value MUST be a [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) string (e.g., `0.2.0`, `1.0.0`).

Tools MUST refuse to parse documents that declare a higher major version than the tool supports. Within the same major version (1.0.0 and later):

- New minor versions MAY add optional fields.
- Existing fields MUST NOT change meaning.
- Existing fields MUST NOT be removed.

Major-version refusal is mandatory because a major bump may change the meaning of existing fields; a tool that silently processed a newer-major document using older rules would risk applying pre-break meanings to post-break fields and produce wrong output. Post-1.0 minor bumps only add optional fields, so older tools safely ignore unknown additions.

Pre-1.0 (major version 0): minor versions MAY include breaking changes, per pre-1.0 SemVer convention. The same refusal principle applies at finer granularity: tools MUST refuse to parse pre-1.0 documents that declare a higher minor version than the tool supports.

These refusal rules compare versions by [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) precedence (which ignores build metadata). A prerelease (for example `0.2.0-rc.1`) sorts below its release and is a distinct, potentially incompatible draft: a tool MUST NOT accept a prerelease unless it declares support for that specific prerelease, so supporting `0.2.0` does not imply supporting `0.2.0-rc.1`. Patch is never a refusal trigger (only major, and pre-1.0 minor, are), so a higher patch within a supported minor is accepted as non-breaking.

### 11.2. `version` field (contract version)

The optional `version` field describes the author's own notion of the interface's contract version. It is opaque to this spec; no tool behavior is defined in terms of it. Authors MAY use SemVer, dates, or any other convention.

---

## 12. IANA considerations

This specification defines IANA registration details for the OpenBindings well-known URI suffix and JSON media type. The IANA registries are authoritative for current registration status.

### 12.1. Well-known URI suffix

Registration details per [RFC 8615](https://www.rfc-editor.org/rfc/rfc8615), in the [IANA Well-Known URIs registry](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml):

- **URI suffix:** `openbindings`
- **Change controller:** openbindings project
- **Reference:** this specification
- **Related information:** see [§7. Discovery](#7-discovery)

### 12.2. Media type

Per [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838), under the vendor tree:

- **Type/subtype:** `application/vnd.openbindings+json`
- **Required parameters:** none
- **Encoding considerations:** 8-bit UTF-8 per [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)
- **Fragment identifier considerations:** JSON Pointer per [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)
- **Security considerations:** see [§13. Security considerations](#13-security-considerations)
- **Interoperability considerations:** see [§14. Conformance](#14-conformance)
- **Applications that use this media type:** tools that produce or consume OpenBindings documents
- **Change controller:** openbindings project
- **Published specification:** this specification

---

## 13. Security considerations

Processing OBI documents involves fetching external artifacts, resolving references, and handling arbitrary author-supplied input. The threat surface is comparable to JSON Schema processors and artifact-fetching tools generally: SSRF, resource exhaustion, untrusted code evaluation, and content-type confusion.

The document format creates the following exposure:

- **URIs as attack vectors.** `sources[*].location` values and schema `$ref` values may resolve to arbitrary network endpoints, including internal or link-local addresses such as `http://169.254.169.254/...` or `file:///etc/passwd`. Unrestricted fetching inherits SSRF and exfiltration exposure.
- **Unbounded size.** The spec imposes no size cap on OBI documents or on the artifacts and schemas they reference. Untrusted input creates memory and processing-time exhaustion exposure.
- **Schema `$ref` cycles.** Permitted by the spec (see [Reference resolution]); naive resolvers can exhaust the stack or loop indefinitely.
- **Transforms as executable code.** Transforms are JSONata source code. Untrusted documents can embed expressions designed to run without bound or access process state when evaluated.
- **Plaintext discovery.** Discovery over HTTP is subject to tampering by network intermediaries; fetched content cannot be distinguished from content planted by an on-path attacker.
- **Integrity is out of scope.** The spec does not define document signing, attestation, or integrity verification. Authenticity and integrity are established by external means (TLS, content signing, out-of-band attestation) or not at all.

Mitigation strategies, such as scheme allow-lists, size caps, cycle detection, transform sandboxing, and HTTPS enforcement, are processor concerns. The spec does not mandate any particular policy; [§13.1. Recommended mitigations (informative)](#131-recommended-mitigations-informative) lists categories tools typically consider.

### 13.1. Recommended mitigations (informative)

The following are non-normative. They name categories of mitigation that tools processing OBI documents from untrusted origins typically consider. Specific limits, policies, and defaults depend on deployment; the spec does not prescribe numbers.

- **Scheme allow-list** for URI dereferencing. Rejecting `file://`, `data:`, and schemes outside an explicit allow-list by default is common practice.
- **Network-range restrictions**. Refusing to dereference URIs resolving to link-local (`169.254.0.0/16`, `fe80::/10`), loopback (`127.0.0.0/8`, `::1`), or private (RFC 1918) address ranges by default, with explicit operator opt-in for environments that legitimately need them.
- **Size caps** on fetched documents, schemas, and binding artifacts.
- **Timeouts** on fetches and on transform evaluation.
- **JSONata sandboxing**. Evaluating transforms without filesystem, network, or host-process access; disabling expression primitives that touch the host environment.
- **Transport security**. Enforcing TLS for non-loopback origins, and distinguishing the URI a document was requested at from the URI a redirect resolves to when deriving an identity or cache key for it (this spec defines no canonical identity, and resolution depends on neither URI; see [§10. Reference resolution](#10-reference-resolution)).
- **Reference-cycle detection**. Required by [§10. Reference resolution](#10-reference-resolution) for `$ref` cycles; the same posture applies to transitive `sources[*].location` traversal.

Whether and how to apply these is a processor concern. This subsection is informative; no rule in [§14. Conformance](#14-conformance) mandates specific mitigation policy.

---

## 14. Conformance

The normative shape of an OBI document is defined by this specification's prose. The accompanying `openbindings.schema.json` expresses the structural portion of that definition in JSON Schema form for validator tooling; it is a derived artifact, not a second source of truth. **Where prose and schema conflict, the prose governs.** Schema validation (OBI-D-02) is necessary but not sufficient for document conformance: some rules (such as the document-unique operation-identifier namespace per OBI-D-04, or the recursive prohibition on `$vocabulary` per OBI-D-07) require walking the document beyond what JSON Schema validation expresses, and exist only in prose.

Each rule below carries a stable identifier (`OBI-D-##` for document rules, `OBI-T-##` for tool rules) so validators, test suites, and errata can cite it unambiguously. Identifiers are stable within a major version: they MUST NOT be reused or renumbered. Rules removed in a future major version retain their identifiers as historical references.

### 14.1. Tool obligations

A tool's obligations follow the capabilities it exercises, not a fixed class. A tool that only parses, validates against the document rules, indexes, or renders OBI documents owes the rules marked *all processors*. A tool that also resolves references, reasons about schemas, selects among bindings, resolves operation names, invokes bindings, or serves and fetches discovery documents additionally owes the rules scoped to those activities. Each tool rule in [§14.3. Tool rules](#143-tool-rules) names the capability it applies to.

Two capabilities carry a notable runtime dependency: a tool needs **runtime** JSON Schema validation when it **invokes** bindings (to check input and output against the operation's schemas), and a JSONata 2.0 runtime when it **evaluates transforms** (a document with no transforms needs no JSONata runtime from any tool). Non-invoking tools may still process schemas, for example to validate examples, inspect or compare schemas, or generate types, but they need no invocation machinery.

A tool self-declares the capabilities it implements in its documentation or metadata. The openbindings project does not maintain a registry of conformant tools; conformance is verified empirically by running the conformance test corpus, not by central registration.

### 14.2. Document rules

A conformant **OBI document**:

- **OBI-D-01**: Is valid UTF-8 encoded JSON per [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259). Duplicate JSON object keys within any object make the document invalid. Verification note (informative): RFC 8259 leaves duplicate-name handling unspecified, and most JSON parsers silently keep one value rather than reporting the duplicate, so checking this clause requires a duplicate-detecting parse. A validator whose parser cannot surface duplicates leaves the clause unverified rather than failing the document; this is the same partial-verification posture as [§8. Binding sufficiency](#8-binding-sufficiency).
- **OBI-D-02**: Validates against the JSON Schema at `openbindings.schema.json`.
- **OBI-D-03**: Has every map key (operation, binding, source, transform, schema, and example keys) and every operation alias matching the pattern `^[A-Za-z_][A-Za-z0-9_.-]*$`. The rule covers the maps this spec defines (per [§6. Document shape](#6-document-shape)); property names inside JSON Schema objects are schema content, not map keys, and are unconstrained by this rule.
- **OBI-D-04**: Has no collision between any two operation identifiers within the document, where an operation's identifiers are its key plus any entries in its `aliases` array.
- **OBI-D-05**: Carries only absolute or same-document OBI-defined references. Every `sources[*].location` is an absolute URI or a format-defined absolute address (never a relative reference); every schema `$ref` is a same-document fragment or an absolute URI; every schema `$id` is absolute; every named-transform `$ref` in `bindings[*].inputTransform`/`bindings[*].outputTransform` is a same-document fragment. Every URI-form reference here is a well-formed URI reference per [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) §4.1: absolute-URI `location`s, absolute schema `$ref`/`$id`, and same-document fragments. A format-defined absolute address used as a `location` (for example, a gRPC `host:port`) is well-formed per its own format, not RFC 3986, and is exempt from this clause. `bindings[*].ref` is interpreted by the binding format and is out of scope for this rule entirely (see [§10. Reference resolution](#10-reference-resolution)).
- **OBI-D-06**: Has every `$schema` value, where present, equal to `https://json-schema.org/draft/2020-12/schema`.
- **OBI-D-07**: Has no `$vocabulary` keyword in any schema within the document.
- **OBI-D-08**: Has every `bindings[*].operation` value present as a key in the document's `operations` map.
- **OBI-D-09**: Has every `bindings[*].source` value present as a key in the document's `sources` map.
- **OBI-D-10**: Has every named-transform `$ref` in `bindings[*].inputTransform` and `bindings[*].outputTransform` resolving to a key in the document's `transforms` map.
- **OBI-D-11**: Has every example's provided `input` validating against its operation's `input` schema, and every example's provided `output` validating against its operation's `output` schema, when the respective schema is specified.
- **OBI-D-12**: Has an `openbindings` field whose value is a valid [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) string.
- **OBI-D-13**: Has every binding identifiable from the binding and its referenced source alone, with no dependency on external registries, vendor catalogs, or environment configuration. (See [§8. Binding sufficiency](#8-binding-sufficiency).)

### 14.3. Tool rules

A conformant **tool**:

- **OBI-T-01** (all processors): Does not fail processing a document solely because the document contains an unsupported binding format. Tools MAY surface diagnostics; bindings depending on unsupported artifacts are unactionable.
- **OBI-T-02** (all processors): Ignores unknown fields that are not defined by this specification. "Fields" here are the properties of OBI-defined objects (the document root and the operation, source, binding, and example objects); property names inside JSON Schema objects (at `input`, `output`, and `schemas` positions) are schema content, not OBI fields, and are out of scope for this rule, mirroring [OBI-D-03](#142-document-rules). Their handling follows [§6.2. Schemas](#62-schemas), and tool diagnostics for uninterpreted schema keywords are [OBI-T-05](#143-tool-rules)'s concern. Tools SHOULD surface diagnostics (warnings) for unknown non-`x-` OBI fields to help catch typos.
- **OBI-T-03** (all processors): Treats `x-` prefixed fields as extensions. Unknown `x-` fields MUST NOT change the meaning of core fields for conformance purposes.
- **OBI-T-04** (all processors): Applies the version acceptance and refusal rules of [§11.1. `openbindings` field (spec version)](#111-openbindings-field-spec-version). A tool MUST refuse documents declaring a higher major `openbindings` version than it supports; while the spec is pre-1.0 (major version 0), this refusal extends to higher minor versions. Versions are compared by [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) precedence: build metadata is ignored, and a higher patch within a supported major/minor is not a refusal trigger (it is accepted as non-breaking). A prerelease (for example `0.2.0-rc.1`) sorts below its release and is a distinct, potentially incompatible draft; a tool MUST NOT accept a prerelease unless it declares support for that specific prerelease.
- **OBI-T-05** (applies when reasoning about schemas, e.g., for comparison, validation, or code generation): SHOULD surface diagnostics for semantically significant keywords the tool does not interpret.
- **OBI-T-06** (applies when resolving or acting on `ref` values): Honors the addressing conventions of each binding format it claims to support.
- **OBI-T-07** (applies when invoking): A tool MUST validate caller-provided input against the operation's `input` schema when that schema is specified. If the binding declares an `inputTransform`, validation MUST occur before transform application. A validation failure is an invocation error for that operation; it does not render the document non-conformant.
- **OBI-T-08** (applies when invoking): When the operation's `output` schema is specified, a tool MUST validate the operation's result against the `output` schema. If the binding declares an `outputTransform`, the result to validate is the value produced by evaluating the transform; otherwise it is the source's output as received. A validation failure is an invocation error for that operation; it does not render the document non-conformant. For a streaming binding that carries more than one value, OBI-T-07 and OBI-T-08 apply to each value individually as it crosses the operation boundary (per input item before send, per output item as received or transformed), not to a collected aggregate of the stream; the `input`/`output` schema describes one such value, and heterogeneous streams express their variants with JSON Schema alternation (`oneOf`/`anyOf`).
- **OBI-T-09** (applies when selecting among multiple bindings for the same operation): Selection applies only among the *candidate* bindings the tool can act on. A tool need not include in the candidate set a binding whose source format it does not support, whose `ref` it cannot resolve, or that it declines for local policy. Among the candidates, a tool MUST prefer non-deprecated bindings over deprecated ones. A deprecated binding with any `preference` value is ranked after every non-deprecated binding. Within each tier, tools SHOULD prefer higher effective `preference` values, where a binding's effective `preference` is its own `preference` when present, otherwise its source's `preference` when present, and otherwise 0 (binding-level `preference` overrides the source default rather than combining with it, per [§6.3. Bindings](#63-bindings)); an absent preference is thus the neutral baseline of 0, and bindings that share the highest effective `preference` are ordered tool-defined per [§6.3](#63-bindings). Tools MAY apply additional selection tactics (latency, cost, protocol preference) after the tier rule has been applied.
- **OBI-T-10** (applies when evaluating transforms): Evaluates declared transforms according to [JSONata 2.0](https://docs.jsonata.org/). Any implementation may provide its own JSONata 2.0 evaluator.
- **OBI-T-11** (applies when resolving `$ref` values): MUST handle cycles without infinite loops (via memoization, bisimulation, or similar techniques). The exact handling is tool-defined.
- **OBI-T-12** (applies when resolving operation names): MUST resolve a name against the flat namespace of operation identifiers (each operation's key together with its `aliases`), treating key and alias matches as equally authoritative. Because OBI-D-04 makes that namespace document-unique, a name resolves to at most one operation; a tool MUST NOT privilege key matches over alias matches, and MUST NOT resolve a name that matches no identifier. When resolution fails, a tool SHOULD surface a diagnostic naming the unresolved name so the indirection is debuggable. A binding referenced for a resolved operation is selected by the operation's key (the value bindings carry in `bindings[*].operation`), not by the alias used to reach it.
- **OBI-T-13** (applies when serving an OBI at the discovery URI): When a service serves an OBI at `/.well-known/openbindings`, it MUST answer a `GET` with `200 OK` and a body that is a valid OBI document, and MUST NOT refuse the request solely because the `Accept` header is absent or omits an OBI media type. The response `Content-Type` SHOULD be `application/vnd.openbindings+json`. Where the service would serve the request but publishes no OBI at the path, the response is `404 Not Found`; an endpoint that gates discovery behind authentication or authorization MAY instead respond `401`/`403`. A discovery endpoint intended for public consumption SHOULD set permissive CORS response headers (for example, `Access-Control-Allow-Origin: *`). (See [§7. Discovery](#7-discovery).)
- **OBI-T-14** (applies when fetching an OBI from the discovery URI): A client fetching `/.well-known/openbindings` MUST accept a `200 OK` response served as `application/json` as well as one served as `application/vnd.openbindings+json`, SHOULD send `Accept: application/vnd.openbindings+json, application/json`, and SHOULD follow `3xx` redirects subject to its own redirect policy and limits. A client MAY treat any response that is not a `200 OK` carrying a valid OBI (a `404`, another `4xx`/`5xx`, or a `200` whose body is not a valid OBI) as "no OBI published at this path." (See [§7. Discovery](#7-discovery).)

The consistent "don't fail the document on unknown X" posture across OBI-T-01 through OBI-T-04 is deliberate. Partial tool support is the common case: a tool may understand `openapi` bindings but not `grpc`. Failing the whole document on any unsupported element would force every tool to support every element, fracturing the ecosystem. The diagnostic allowance preserves visibility: authors still learn when their document contains elements a specific tool can't act on. The distinction between warning on non-`x-` unknowns and silently accepting `x-` unknowns reflects that non-`x-` typos are usually misspelled core fields, while `x-` names are explicitly reserved for extensions whose names the spec cannot know.

OBI-T-05 through OBI-T-14 scope the conformance floor to specific capabilities, giving tools that reason about schemas, resolve references, select among bindings, resolve operation names, invoke and evaluate transforms, or serve and fetch discovery documents something concrete to check beyond "the document parses." Each is spec-level under the [§2. Scope principle](#2-scope-principle) only where portability depends on it, and no further. The per-rule rationale:

- **OBI-T-05** is a SHOULD: a diagnostic aid, not a portability requirement.
- **OBI-T-06**, though a MUST, defers the actual `ref` syntax to each binding format rather than defining an OBI-native one.
- **OBI-T-07 and OBI-T-08** are MUSTs because they apply at the operation-contract boundary, where values cross into and out of the portable contract; leaving these checks to tool discretion would let two conforming tools disagree on whether a given input or output honors the contract, the one disagreement the contract cannot survive.
- **OBI-T-09**'s tier rule is a MUST because `deprecated: true` requires a portable selection-ordering meaning to be useful: without it, two conforming tools could disagree on whether a non-deprecated binding ranks ahead of a deprecated one, which the §6.3 spec-level tier prose rules out. Selection tactics beyond the tier (preference within tier, latency, cost, protocol preference, tool-specific signals) remain SHOULD- or MAY-level because they encode preferences whose meaning the spec deliberately leaves to authors and tools.
- **OBI-T-10** is a MUST because JSONata 2.0 is the spec's mandated transform interchange language; a tool that evaluated transforms in any other language would silently produce different results from a conforming one, breaking the portability §6.5 commits to.
- **OBI-T-11** is a MUST because §10 explicitly permits `$ref` cycles in recursive schemas; a tool that loops indefinitely on a conformant document would render the spec's permissive cycle rule unusable in practice.
- **OBI-T-12** is a MUST because operation-name resolution is the same kind of portability boundary as OBI-T-07/T-08: if two conforming tools resolved the same name against the same document to different operations (or one consulted aliases and the other did not), every downstream guarantee built on operation-name resolution would silently diverge. The identifier namespace is unambiguous by OBI-D-04, so the only thing left to pin is that all tools read it the same way.
- **OBI-T-13 and OBI-T-14** are spec-level at the discovery boundary: the well-known endpoint is the one place an independent publisher and an unconfigured client must agree on the wire contract (status, media-type acceptance, redirect-following) for configuration-free discovery to interoperate, so §7.1's response-contract MUSTs are pinned as rules. The softer choices there (CORS, authentication, content negotiation) stay SHOULD/MAY because they are deployment posture, not interop-breaking.

This spec does not define tool behavior beyond these minimum conformance rules. Behavioral conventions (comparison, transform runtime policy such as error handling, resource limits, and sandboxing, credential resolution, and the like) are documented per-tool. The transform *language* itself is specified (JSONata 2.0, OBI-T-10); what stays per-tool is the runtime around it.

---

## 15. Extensions

- OBI documents MAY include extension fields whose keys begin with `x-` at any object location.
- Tools MUST ignore `x-` fields they do not understand.
- `x-` fields MUST NOT change the meaning of core fields defined by this spec.

---

## 16. References

### 16.1. Normative references

- **[BCP 14]** S. Bradner, "Key words for use in RFCs to Indicate Requirement Levels," RFC 2119 / BCP 14, March 1997. <https://www.rfc-editor.org/rfc/rfc2119>
- **[RFC 8174]** B. Leiba, "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words," RFC 8174, May 2017. <https://www.rfc-editor.org/rfc/rfc8174>
- **[RFC 8259]** T. Bray, Ed., "The JavaScript Object Notation (JSON) Data Interchange Format," RFC 8259, December 2017. <https://www.rfc-editor.org/rfc/rfc8259>
- **[RFC 3986]** T. Berners-Lee, R. Fielding, L. Masinter, "Uniform Resource Identifier (URI): Generic Syntax," RFC 3986, January 2005. <https://www.rfc-editor.org/rfc/rfc3986>
- **[RFC 6838]** N. Freed, J. Klensin, T. Hansen, "Media Type Specifications and Registration Procedures," RFC 6838, January 2013. <https://www.rfc-editor.org/rfc/rfc6838>
- **[RFC 6901]** P. Bryan, Ed., K. Zyp, M. Nottingham, Ed., "JavaScript Object Notation (JSON) Pointer," RFC 6901, April 2013. <https://www.rfc-editor.org/rfc/rfc6901>
- **[RFC 8615]** M. Nottingham, "Well-Known Uniform Resource Identifiers (URIs)," RFC 8615, May 2019. <https://www.rfc-editor.org/rfc/rfc8615>
- **[SemVer 2.0.0]** Tom Preston-Werner, "Semantic Versioning 2.0.0." <https://semver.org/spec/v2.0.0.html>
- **[JSON Schema 2020-12]** JSON Schema Specification, Draft 2020-12. <https://json-schema.org/draft/2020-12>
- **[JSONata 2.0]** JSONata Project, "JSONata Documentation," version 2. <https://docs.jsonata.org/>

### 16.2. Informative references

- **[RFC 8785]** A. Rundgren, B. Jordan, S. Erdtman, "JSON Canonicalization Scheme (JCS)," RFC 8785, June 2020. <https://www.rfc-editor.org/rfc/rfc8785>. Cited by [§9. Canonical form (informative)](#9-canonical-form-informative).
- **JSONata reference implementation**: JSONata Project, `jsonata` (npm). <https://github.com/jsonata-js/jsonata>. The JavaScript reference implementation for [JSONata 2.0](https://docs.jsonata.org/); cited by [§6.5. Transforms](#65-transforms) as the SHOULD-level tie-breaker where JSONata 2.0's documentation does not unambiguously define behavior.
- **openbindings reference tools**: `ob` CLI, `openbindings-go`, `openbindings-ts` (see project README). One implementation of this spec among potentially many.

---

## 17. See also

- `openbindings.schema.json` — JSON Schema for document validity.
- The openbindings project's shared-contract interfaces — published at [openbindings.com/interfaces](https://openbindings.com/interfaces) (informational).
- `formats/` — companion format specifications in this repository (authority level varies per format).
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
[Discovery]: #7-discovery
[Binding sufficiency]: #8-binding-sufficiency
[Reference resolution]: #10-reference-resolution
[Versioning]: #11-versioning
[Security considerations]: #13-security-considerations
[Conformance]: #14-conformance
