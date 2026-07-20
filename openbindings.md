# OpenBindings Specification (v0.2.0)

## Abstract

OpenBindings is a portable interface description format; its documents are OBIs (OpenBindings interface documents). A service describes its operations once — each a protocol-independent semantic unit with optional per-value input and output contracts — and connects them to concrete realizations described by OpenAPI, AsyncAPI, gRPC, MCP, or any other binding specification. The contract lives at the operation layer; the protocols live at the binding layer.

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
    "httpApi": { "bindingSpec": "openbindings.openapi@1", "location": "https://example.com/openapi.json" }
  },
  "bindings": {
    "createTask.http": { "operation": "createTask", "source": "httpApi", "ref": "#/paths/~1tasks/post" }
  }
}
```

The body of this document defines the OBI shape, its reference-resolution rules, the obligations of binding specifications, and a conformance floor for documents and tools. New readers may prefer the [§4. Overview](#4-overview) walkthrough; the normative material starts at [§2. Core invariants](#2-core-invariants).

## Editors

- Matthew Clevenger ([@clevengermatt](https://github.com/clevengermatt))

See `EDITORS.md` for the current editor roster.

## Status of this document

This is **version 0.2.0** of the OpenBindings specification. This text is the unreleased working draft of that version; the latest release is **0.1.0** (immutable released snapshots live under `versions/`). It is pre-1.0, and minor-version revisions MAY include breaking changes per [§8. Versioning](#8-versioning). Substantive changes are recorded in `CHANGELOG.md` and cite stable rule identifiers (`OBI-D-##`/`OBI-T-##`/`OBI-B-##`) where applicable.

## License and intellectual property

This specification is published under the Apache 2.0 License (see `LICENSE`). Contributions are accepted under the same license, which includes an express patent grant from each contributor covering any claims embodied by their contribution. No party has disclosed patents essential to implementing this specification.

## Notational conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in all capitals.

JSON shown inline in this document is illustrative unless the surrounding prose explicitly states a requirement. (This is distinct from the operation `examples` field, whose contents are conformance-checked under [Conformance].)

## Table of contents

- [1. Positioning and scope](#1-positioning-and-scope)
  - [1.1. Distinguishing features](#11-distinguishing-features)
  - [1.2. Out of scope](#12-out-of-scope)
  - [1.3. Authority and deferral](#13-authority-and-deferral)
  - [1.4. Obtaining an OBI](#14-obtaining-an-obi)
- [2. Core invariants](#2-core-invariants)
- [3. Terminology](#3-terminology)
- [4. Overview](#4-overview)
- [5. Document model](#5-document-model)
  - [5.1. Operations](#51-operations)
  - [5.2. Schemas](#52-schemas)
  - [5.3. Bindings](#53-bindings)
  - [5.4. Sources](#54-sources)
  - [5.5. Transforms](#55-transforms)
- [6. Binding specifications](#6-binding-specifications)
- [7. Reference resolution](#7-reference-resolution)
- [8. Versioning](#8-versioning)
  - [8.1. `openbindings` field (specification version)](#81-openbindings-field-specification-version)
  - [8.2. `version` field (interface-version label)](#82-version-field-interface-version-label)
- [9. Security considerations](#9-security-considerations)
  - [9.1. Recommended mitigations (informative)](#91-recommended-mitigations-informative)
- [10. Conformance](#10-conformance)
  - [10.1. Tool obligations](#101-tool-obligations)
  - [10.2. Document rules](#102-document-rules)
  - [10.3. Tool rules](#103-tool-rules)
  - [10.4. Binding-specification rules](#104-binding-specification-rules)
  - [10.5. Verification conclusions](#105-verification-conclusions)
  - [10.6. Retired rule identifiers](#106-retired-rule-identifiers)
- [11. IANA considerations](#11-iana-considerations)
- [12. Extensions](#12-extensions)
- [13. References](#13-references)
- [14. See also](#14-see-also)
- [Appendix A. Canonical serialization (informative)](#appendix-a-canonical-serialization-informative)

---

## 1. Positioning and scope

OpenBindings operates one layer above protocol-specific interface specifications like OpenAPI, AsyncAPI, gRPC, and MCP. Those specifications describe how to interact with endpoints over a particular wire format. An OBI describes, at the layer above: what operations a service offers, the contracts on the values that cross each operation's boundary, and the shared names by which those operations can be recognized, independent of protocol.

Two stances define this specification's shape, and the rest of the document is read in their light:

**The operation contract is per-value.** An operation is a protocol-independent semantic unit with optional schemas for each value crossing its caller-facing input and output boundaries. It does not declare the number or lifecycle of those values; the selected binding determines the interaction pattern. A binding is an author-declared realization of the operation. OpenBindings conformance establishes the portable facts the document represents, not general semantic equivalence among an operation's bindings.

**OpenBindings enables invocation but does not define an invoker.** An OBI is designed to make an interface actionable by downstream tools, including invokers. This specification defines the portable meaning of the document and the correspondence between operations and concrete bindings; it does not define a binding-neutral invocation interface, require runtime contract enforcement, or govern binding-defined interaction mechanics.

An OBI does not replace the binding artifacts it points at. Each binding specification remains authoritative over its own sources and wire behavior. An OBI adds the operation-level overlay that no single protocol description alone carries, and does so in a way that survives across multiple protocols.

### 1.1. Distinguishing features

- **One operation, many bindings.** A single operation contract can be realized over multiple protocols simultaneously without duplicating the contract.
- **Vendor-independent correspondence.** An operation can adopt the name a shared contract publishes, so consumers recognize it by that shared name rather than by who runs the service (see [§5.1. Operations](#51-operations)).
- **Context-free references.** Every OBI-defined document reference is absolute or same-document, so a document resolves identically wherever it was obtained (origin, cache, redirect, stdin, or memory). (`bindings[*].ref` is interpreted by the binding specification, not by this rule; see [§7. Reference resolution](#7-reference-resolution).)
- **Offline-decidable conformance.** Every document rule in [§10.2](#102-document-rules) is decidable from the document and locally available resources; no rule's outcome depends on network state. Rules that require binding-specification knowledge are resolved by partial verification — unverified is not non-conformant ([§10.5](#105-verification-conclusions)) — never by reaching the network.

### 1.2. Out of scope

OpenBindings does not:

- **Replace binding specifications.** OpenAPI, AsyncAPI, protobuf, MCP, and the binding specifications governing them remain authoritative for their artifacts and wire behavior. OBI points at them.
- **Serve as an authoring language.** OBI is the target artifact, not a source format that compiles to multiple targets. Tools like TypeSpec and Smithy occupy that adjacent role.
- **Define an invoker.** Invocation lifecycle, runtime validation obligations, selection algorithms, retries, credential flow, sandboxing, and rate limiting are implementation concerns. The optional project-published operation-invoker interface defines one reusable invocation contract; nothing requires it.
- **Define a failure vocabulary.** An operation's `output` describes successful values only. Which outcomes of a binding are successes is its binding specification's concern; failure outcomes have no portable core representation.
- **Define acquisition or publication.** An OBI may be obtained through any mechanism without changing its meaning (see [§1.4](#14-obtaining-an-obi)).
- **Maintain registries.** Binding-specification identifiers, correspondence names, and format conventions are governed by their own authorities; there is no central registration anywhere in the model.
- **Specify integrity, signing, or attestation.** Supply-chain verification composes externally (see [Appendix A](#appendix-a-canonical-serialization-informative)).

### 1.3. Authority and deferral

OpenBindings is deliberately minimal. This specification mandates only what is necessary for portable interface descriptions and a minimum conformance floor. Authority over everything else rests in two places:

- **Binding specifications** ([§6](#6-binding-specifications)) are authoritative over their sources: accepted representations, address and reference syntax, target identification, interaction mechanics, and the classification of outcomes.
- **Implementations and their communities** are authoritative over behavior that depends on local deployment or use: whether and when to invoke, whether to validate values at runtime, selection policy, security posture, comparison and matching strategies, and operational choice.

Where this specification defers to "the binding specification" or to "implementation-defined behavior," that deferral is an application of this principle.

### 1.4. Obtaining an OBI

Acquisition and publication are outside this specification. An OBI may be obtained through local files, packages, standard input, embedded resources, network retrieval, or any other mechanism without changing its meaning; no reference in the document resolves against the location it was obtained from ([§7](#7-reference-resolution)).

The optional **OpenBindings HTTP Discovery** companion specification (`http-discovery.md`) normatively defines configuration-free publication and retrieval at `/.well-known/openbindings` for services that want it. Implementing that companion is not required for document or processor conformance under this specification.

---

## 2. Core invariants

The rules in this specification instantiate six invariants. They are stated here once; document and tool rules cite them rather than restating them.

1. **Per-value contract.** Operation `input` and `output` schemas govern each value that crosses the operation's caller-facing boundary — one value at a time. Interaction pattern, cardinality, framing, completion, and lifecycle are the selected binding's concern, defined by its binding specification.
2. **Enabling, not invoking.** The document carries enough information for a capable implementation to act on a binding. No rule in this specification obligates a tool to invoke, to validate values at runtime because it invokes, or to handle failures in a prescribed way. Rules about validation semantics apply to tools that claim the corresponding capability.
3. **Split authority.** The operation owns the caller-facing value contract. The binding specification owns everything needed to act on a source: addresses, representations, references, interaction, and success classification. Neither layer overrides the other.
4. **Context-free documents.** No OBI-defined reference resolves against the URI a document was fetched from. A document has no "home"; two copies mean the same thing everywhere. OBI assigns no document identity; `name` and `version` are labels.
5. **Offline-decidable conformance.** Document conformance is an objective property of the document, decidable from the document plus locally available resources (bundled meta-schemas included). No document rule's outcome depends on network state, so conformance is stable over time. Rules requiring binding-specification knowledge follow the partial-verification posture of [§10.5](#105-verification-conclusions): unverified is not non-conformant.
6. **Decentralized extension.** Binding specifications, their identifiers, and shared correspondence names are governed by whoever publishes them. Nothing in the model requires a registry, and no identifier is dereferenced to be understood.

---

## 3. Terminology

- **OBI**: shorthand for "OpenBindings interface document."
- **Tool**: any software that acts on OBI documents. A tool's obligations follow the capabilities it exercises, not a fixed class ([§10.1](#101-tool-obligations)); the rules of [§10.3](#103-tool-rules) are addressed to "a conformant tool."
- **Processor**: any tool that processes an OBI document. Its baseline capacity is reading — parsing, validating, indexing, or rendering — which it MAY extend with resolving references, evaluating transforms, and acting on sources. Rules marked "(all processors)" bind every processor, including one that does no more than read; a processor that exercises further capabilities owes the correspondingly scoped rules in addition.
- **Operation**: a named protocol-independent unit of capability with optional per-value input/output schemas. Stored under a key in the document's `operations` map. An operation is not a complete binding-independent invocation signature; it does not declare interaction pattern or cardinality.
- **Binding**: an author-declared realization of an operation through a specific entry in a source. Stored under a key in the document's `bindings` map.
- **Binding specification**: one stable semantic definition, under one defining authority, of how a family of sources and their bindings are interpreted and acted upon ([§6](#6-binding-specifications)). It may span several documents and incorporate upstream standards (the OpenAPI specification, the protobuf language) by reference.
- **Binding specification identifier**: the exact, opaque, non-empty string a source carries in `bindingSpec` to denote its governing binding specification. A name, not a locator.
- **Source**: a reference to a binding artifact, identified by a binding specification identifier together with a location, embedded content, or both (see [§5.4. Sources](#54-sources)).
- **Source artifact**: a concrete representation accepted by a binding specification (an OpenAPI document, a `.proto` source, an MCP endpoint's tool listing), carried via `location`, `content`, or both.
- **Transform**: a per-value shape mapping between an operation's contract and a source's expected value representation. Stored under a key in the document's `transforms` map, or inline on a binding.
- **Alias**: an additional name under which an operation is recognized, beyond its key. An operation's key plus its aliases form one flat, document-unique namespace of names that all resolve to that operation.

How these relate: an **operation** is the portable contract, independent of any protocol. A **source** carries or points at a source artifact and names the **binding specification** that governs it. A **binding** links one operation to one source and optionally attaches a **transform** that bridges shape differences. An operation is addressable by its key or any of its **aliases**; both are equally valid for resolution.

Whether one OBI is compatible with another is a matter of tool-defined comparison; this specification defines neither comparison nor matching semantics. Cross-document correspondence is claimed by name adoption: an operation **corresponds to** a shared contract's operation by carrying that contract's operation name as its key or an alias. Adoption is an author assertion of correspondence; it does not identify a particular contract document or version, and it does not establish compatibility, ownership, or substitutability. The mechanism is detailed in [§5.1. Operations](#51-operations).

---

## 4. Overview

OpenBindings separates what a service does (operations with per-value schemas) from how you reach it (bindings into sources governed by binding specifications). A single OBI can realize one operation over multiple protocols without redefining the contract.

Terms used informally below are defined precisely in [Terminology]. OBI documents are JSON. JSON is chosen for properties that hold independent of any other OpenBindings decision: parser availability across every language and runtime including browsers, a frozen and unambiguous parse defined by RFC 8259, a low security surface compared to formats whose parsers evaluate tags or expressions on load, and a mature surrounding tool culture. OpenBindings also specifies a transform language over JSON values (see [Transforms]), so the host format had to be one with a mature cross-language expression language over its data model.

Every OBI declares a specification version and an operations map. The minimal valid document is just those two fields:

```json
{
  "openbindings": "0.2.0",
  "operations": {}
}
```

An operation is the contract, a source carries or points at a binding artifact under a named binding specification, and a binding links the two:

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
    "httpApi": { "bindingSpec": "openbindings.openapi@1", "location": "https://example.com/openapi.json" }
  },
  "bindings": {
    "createTask.http": { "operation": "createTask", "source": "httpApi", "ref": "#/paths/~1tasks/post" }
  }
}
```

The same operation can be realized over a second protocol by adding another binding against a different source. One contract, many bindings is the specification's primary abstraction:

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
    "httpApi":   { "bindingSpec": "openbindings.openapi@1", "location": "https://example.com/openapi.json" },
    "mcpServer": { "bindingSpec": "openbindings.mcp@1",     "location": "https://example.com/mcp" }
  },
  "bindings": {
    "createTask.http": { "operation": "createTask", "source": "httpApi",   "ref": "#/paths/~1tasks/post" },
    "createTask.mcp":  { "operation": "createTask", "source": "mcpServer", "ref": "tools/create_task" }
  }
}
```

A realistic OBI layers in shared schemas, a named transform bridging a source's wire shape with the operation contract, and a qualified alias claiming correspondence with a published interface's operation:

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
      "aliases": ["acme.tasks.createTask"],
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
    "httpApi":   { "bindingSpec": "openbindings.openapi@1", "location": "https://example.com/openapi.json" },
    "mcpServer": { "bindingSpec": "openbindings.mcp@1",     "location": "https://example.com/mcp" }
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

---

## 5. Document model

An OBI document is a JSON object. Top-level fields:

| Field | Type | Required | Purpose |
|---|---|---|---|
| `openbindings` | string | yes | Specification version the document declares (SemVer). |
| `name` | string | no | Human-friendly label. Not an identifier. |
| `version` | string | no | Interface-version label, opaque to this specification ([§8.2](#82-version-field-interface-version-label)). Non-empty when present. |
| `description` | string | no | Human-friendly description. |
| `schemas` | object | no | Map of schema names to JSON Schemas. |
| `operations` | object | yes | Map of operation keys to operation objects. |
| `sources` | object | no | Map of source keys to source objects. |
| `bindings` | object | no | Map of binding keys to binding objects. |
| `transforms` | object | no | Map of transform names to JSONata expression strings. |

**Names.** All map keys this specification defines (operation, binding, source, transform, schema, and example keys) and all operation aliases MUST match the pattern `^[A-Za-z0-9_][A-Za-z0-9_.-]*$` ([OBI-D-03](#102-document-rules)). Names are opaque ASCII tokens compared by exact, case-sensitive string equality: processors do not trim, case-fold, Unicode-normalize, or otherwise rewrite them. Dot and hyphen carry no structural semantics; a dot may be used by authoring convention to qualify a shared name ([§5.1](#51-operations)), but nothing in this specification parses the segments. Names are not URIs, paths, or native programming-language identifiers merely because their spelling resembles one; code generators apply their own deterministic naming policy. The grammar permits a leading digit (`2fa.verify`) for the same reason: names are data labels, not host-language identifiers, and excluding spellings that only some target languages reject would push one ecosystem's lexical rules into every document. Operation keys MUST be unique within a document; binding, source, transform, and schema keys MUST be unique within their respective maps.

**Value domain.** Operation-boundary values are JSON values per [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259). A payload that is not naturally JSON (binary content, text with its own syntax) crosses the operation boundary only in a JSON representation, and which representation a binding uses is its binding specification's concern.

### 5.1. Operations

An operation is a protocol-independent semantic unit with optional schemas for each value crossing its caller-facing input and output boundaries (invariant 1). Whether an interaction is request/response, streaming, bidirectional, or pub/sub is determined by the selected binding, not by the operation. When a binding carries more than one value, the `input`/`output` schemas describe **one value** at a time as it crosses the operation boundary, never a collected aggregate of the interaction.

An operation whose successful values vary in shape (multiple event types on a streaming binding, a union of representations) expresses the variation as JSON Schema alternation (`oneOf`, `anyOf`) in `output`; each successful value validates against the alternation. Alternation in `output` never models failure outcomes: `output` describes successful values only, and which outcomes of a binding are successes is its binding specification's concern ([§1.2](#12-out-of-scope), [OBI-B-02](#104-binding-specification-rules)).

An operation object MAY contain:

| Field | Type | Purpose |
|---|---|---|
| `description` | string | Human-readable description. |
| `deprecated` | boolean | Hint that consumers should migrate away from the operation. |
| `tags` | array of strings | Documentation labels for grouping/filtering. |
| `aliases` | array of strings | Additional names, equal in standing to the operation's key. |
| `idempotent` | boolean | Author-attested effect claim; see below. |
| `input` | JSON Schema or absent | Contract on each caller-facing input value. |
| `output` | JSON Schema or absent | Contract on each successful caller-facing output value. |
| `examples` | object | Map of example names to `{description?, input?, output?}` objects. |

**Schema states.** `input` and `output`, when present, contain a JSON Schema 2020-12 object or boolean schema ([§5.2](#52-schemas)). Omission is the sole representation of an unspecified contract; literal `null` is not a valid value at either position. The states are deliberately distinct:

| Form | Meaning |
|---|---|
| field absent | No contract is specified for that boundary. |
| `{}` or `true` | A contract is specified; every JSON value satisfies it. |
| `false` | A contract is specified; no JSON value satisfies it. |
| `{"type": "null"}` | A contract is specified; only the JSON value `null` satisfies it. |

Absence does not mean the interaction carries zero values, and it does not mean every value is accepted; it means the document makes no portable claim at that boundary. `false` is an impossible **value** contract — if a value crosses this boundary, no value can satisfy the schema — not a cardinality declaration: a binding whose interaction carries no input values can realize an operation with `input: false`, and interaction shape remains binding-specification-defined. This specification prefers `{}` in examples for the always-valid contract; `true` is the equivalent native spelling.

**Contract directions.** The `input` and `output` schemas are caller-facing contracts running in opposite directions; each is a claim the document makes about the service, attested like every other operation-level claim. `input` claims that the service accepts at minimum every value validating against it and may accept more; a caller sending any value validating against `input` is honoring the input contract. `output` claims that every successful value validates against it, and the service may produce a narrower set; a caller receiving a successful value relies on it validating against `output` exactly as far as it trusts the document's claims.

**Aliases and correspondence.** An operation's **identifiers** are its key plus its aliases, sharing one flat namespace: every identifier is equally valid for resolving the operation, and the choice of key versus alias carries no semantic weight beyond the key being the operation's primary name for display, logging, and binding references (the value bindings carry in `bindings[*].operation`). The namespace is document-unique across all operation identifiers ([OBI-D-04](#102-document-rules)): an identifier MUST NOT collide with any other identifier in the document, an alias MUST NOT equal its own operation's key, and an operation's aliases MUST be distinct from one another. Any identifier resolves to at most one operation, and tools resolve names identically per [OBI-T-12](#103-tool-rules).

Common uses of `aliases`: a prior name kept for continuity after a rename, a vendor-specific name some consumers look up by, or a shared contract's operation name. The last is the correspondence claim of [§3. Terminology](#3-terminology): by adopting a published identifier as its key or an alias, the operation **claims correspondence with** the published operation. The claim is an author assertion. It does not identify a particular contract document or version, does not establish schema compatibility, behavioral equivalence, ownership, or trust, and is not verified by any rule in this specification; consumers that require compatibility compare the operation against a reference OBI of their choosing, under their own policy.

Publishers of identifiers intended for cross-document adoption SHOULD qualify them under a namespace they control and include enough interface scope to avoid common-name collisions — `acme.tasks.createTask` rather than `create` — since the document-unique namespace means two adopted names that collide cannot coexist in one document. Dotted qualification is a convention; the specification constrains only the name syntax ([OBI-D-03](#102-document-rules)). A published identifier represents a continuing semantic operation: an intentionally incompatible replacement SHOULD receive a new identifier. As with binding-specification identifiers ([§6](#6-binding-specifications)), these SHOULDs address publishers, whom no conformance class binds; the cost of ignoring them falls on the publisher whose names collide or silently change meaning, not on documents or tools.

**Idempotency.** `idempotent: true` is an author assertion that repeating the operation with equivalent input under the same relevant execution context produces no additional intended operation-level effects after the first application. `idempotent: false` asserts the opposite: some valid repetition can produce additional intended effects. Absence makes no claim in either direction, and a consumer MUST NOT infer one from absence.

The claim concerns intended operation-level effects, not equality of returned values, errors, timing, or other per-attempt observations: a read of changing state can be idempotent while returning different values; repeated deletion can be idempotent though later attempts report absence. Idempotency does not imply that the operation is safe, read-only, deterministic, cacheable, or harmless, and does not assert that authorization, billing, or audit effects repeat without consequence. Attaching a binding to the operation asserts that it honors the operation-level claim under the equivalent conditions ([§5.3](#53-bindings)); the field does not itself authorize switching bindings between attempts. An invocation policy MAY consider the field but cannot derive retry safety from it alone. Its semantic truth is author-attested: structural validity is enforced, but tools MUST NOT reject a document because the claim appears inaccurate, and MAY use it as input to their own decisions.

**Examples.** `examples` holds named, author-supplied sample values: each entry MAY provide `description`, `input`, and `output`. Examples are **positive** claims about the caller-facing contract: when the corresponding operation schema is specified, a provided example value MUST validate against it ([OBI-D-11](#102-document-rules)). The schema is authoritative; an example never widens, narrows, or overrides it, and a tool MUST NOT resolve a mismatch by treating the example as an exception.

Example members are instance values, not schemas, so presence is distinct from value: an absent `input`/`output` member supplies no value, while an explicitly `null` member supplies the JSON value `null` and is validated like any other value — otherwise an operation whose `output` is `{"type": "null"}` could carry no example. Examples make no claim beyond schema membership: no binding is selected, no transform is evaluated, and a valid example pair does not establish that its output can result from its input.

The conformance force of example validation is scoped to what the document itself decides ([OBI-D-11](#102-document-rules), invariant 5): it applies when the governing schema graph resolves entirely within the document. An example governed by a schema that reaches external resources is outside the document rule; tools MAY still validate it and surface mismatches as verification evidence ([§10.5](#105-verification-conclusions)). Authors who want conformance-checked examples keep the relevant schema graphs internal to the document.

### 5.2. Schemas

The top-level `schemas` map holds named JSON Schemas. Operations reference them via `$ref` (e.g., `{"$ref": "#/schemas/Task"}`).

**Dialect.** Every schema in an OBI document is a [JSON Schema 2020-12](https://json-schema.org/draft/2020-12) schema, in object or boolean form (`true` accepts every value; `false` accepts none; `{}` is equivalent to `true`). A `$schema` keyword MAY be omitted; absence means 2020-12. When `$schema` is present, its value MUST be `https://json-schema.org/draft/2020-12/schema` ([OBI-D-06](#102-document-rules)). The `$vocabulary` keyword MUST NOT appear in any schema within the document ([OBI-D-07](#102-document-rules)): vocabularies would require every consumer to resolve meta-schemas to determine which keywords apply, fragmenting schema semantics across tools. These constraints govern schemas within the OBI document; schemas fetched by resolving `$ref` to external URIs are governed by their own declared dialects.

**Well-formedness.** Every schema contained in the document MUST be well-formed ([OBI-D-17](#102-document-rules)): it validates against the JSON Schema 2020-12 meta-schemas and satisfies this section's constraints, recursively through its subschemas as JSON Schema defines them. A value occupying a schema position that is not a schema in the pinned dialect — `{"type": 42}` — is a document defect, not a latent runtime condition. Validators check this rule against locally available meta-schemas; checking MUST NOT require fetching a meta-schema from the network. Well-formedness is deliberately narrow: it does not establish satisfiability, compatibility, or operability of every keyword value (an unparseable `pattern` regular expression or an unresolvable `$ref` string passes the meta-schemas and surfaces when the schema is used), and unknown keywords remain legitimate annotations, not violations.

This specification does not restrict which 2020-12 keywords may appear. Tools that only preserve schemas through round-trips need not interpret any keywords, and SHOULD-level diagnostics for uninterpreted keywords are [OBI-T-05](#103-tool-rules)'s concern.

**Validation semantics.** Nothing in this specification requires any tool to validate values against operation schemas (invariant 2). When a tool does claim to check a value against an operation's contract, one portable meaning applies ([OBI-T-16](#103-tool-rules)):

- Validation success requires the complete schema graph statically reachable from the governing operation schema to be available, well-formed, and evaluable. Reachability follows schema-bearing positions and reference semantics of the applicable dialect; an unrelated entry in `schemas` does not participate unless reachable, and cycles are permitted and handled per [OBI-T-11](#103-tool-rules).
- A tool MUST NOT report successful validation against a partially available graph, even when the instance appears not to exercise an unavailable branch — annotation-dependent keywords make apparently unused branches able to affect results, and partial success would make portability depend on evaluator strategy.
- At these positions the `format` keyword is an annotation, never an assertion: a tool MUST NOT reject a value for violating `format`, whatever dialect an externally fetched subschema declares. Format-assertion behavior varies across libraries, and a pass at the operation boundary must mean the same thing on every tool. Authors needing enforced value syntax use assertion keywords such as `pattern`.
- For interactions carrying more than one value, the schemas apply to each value individually as it crosses the boundary (invariant 1).
- Schema-graph unavailability and instance mismatch are distinct outcomes and are reported distinctly.

This requirement is a semantic prerequisite for a success claim, not a loading algorithm: processors may compile eagerly, resolve on demand, use local registries or caches — anything that establishes complete-graph availability before success is reported. External references are dependencies their author chose; a processor may obtain them from any local resource set and never needs live network access merely because a URI is absolute (invariant 5 applies to document conformance; evaluation against external graphs is a capability a tool exercises or does not).

### 5.3. Bindings

A binding object MUST contain:

| Field | Type | Purpose |
|---|---|---|
| `operation` | string | Key into the document's `operations` map. |
| `source` | string | Key into the document's `sources` map. |

And MAY contain:

| Field | Type | Purpose |
|---|---|---|
| `ref` | string | Selector into the source's artifact identifying the specific target. Binding-specification-defined. |
| `preference` | integer | Author preference signal among bindings of the same operation; see below. |
| `description` | string | Human-readable description. |
| `deprecated` | boolean | Author recommends migration away from this binding. |
| `inputTransform` | JSONata string or `$ref` | See [Transforms]. |
| `outputTransform` | JSONata string or `$ref` | See [Transforms]. |

`ref` identifies a specific entry within the source's artifact. Its syntax and meaning — including the absent-`ref` case, which targets whatever the binding specification defines as the artifact-level default — are the governing binding specification's concern ([OBI-B-02](#104-binding-specification-rules)); tools that resolve or act on `ref` MUST honor those conventions ([OBI-T-06](#103-tool-rules)). For example: JSON Pointer fragments under `openbindings.openapi@1`; fully-qualified method names for gRPC-family specifications; tool names for MCP-family specifications.

**Realizations.** Multiple bindings MAY reference the same operation. Each is an author-declared realization of the operation: attaching several bindings asserts that each realizes the same logical capability through a different concrete target and that each honors every portable fact the operation represents — its per-value schemas after any declared transforms, and its operation-level claims such as `idempotent`. The assertion's truth is author-attested, like `idempotent` itself ([§5.1](#51-operations)): a binding that does not honor the represented facts makes the document's claim false, which no structural rule detects. A caller interacts with the operation through any one of its bindings; using one binding is a complete use of the operation. OpenBindings does not prove semantic equivalence or mechanical interchangeability among realizations beyond the represented facts (invariant 1); a caller that requires a particular interaction pattern constrains or inspects binding selection.

**Selection signals.** `preference` is an optional signed integer from -9007199254740991 through 9007199254740991 (the exactly representable interoperable range). Among bindings for the same operation that declare it, a higher value expresses stronger author preference; equal values express no ordering through this field. Omission states no preference and is not equivalent to zero or any other value; zero and negative values have no privileged meaning beyond numeric order. `deprecated: true` states that the author recommends migration away from the binding and ordinarily does not recommend it for new use; a deprecated binding remains discoverable and actionable. The two signals are independent dimensions — lifecycle guidance and relative choice — and this specification mandates no ordering relationship between them.

OpenBindings defines no binding-selection algorithm (invariant 2). Tools decide whether and how either signal contributes to selection; explicit caller choice and tool policy may override both, and candidate construction, filtering, fallback, and tie-breaking are tool concerns. A tool or interface that offers automatic selection documents its policy outside this specification; the project's optional operation-invoker interface is one such home.

### 5.4. Sources

A source object MUST contain:

| Field | Type | Purpose |
|---|---|---|
| `bindingSpec` | string | Binding specification identifier. See [§6](#6-binding-specifications). |

And MUST contain at least one of:

| Field | Type | Purpose |
|---|---|---|
| `location` | string | Binding-specification-defined absolute address associated with the source. |
| `content` | any JSON value | Embedded source-artifact representation. |

And MAY contain:

| Field | Type | Purpose |
|---|---|---|
| `description` | string | Human-readable description. |

`location` is an absolute address — an absolute URI, or another absolute form the binding specification defines (a gRPC `host:port`) — and never a relative reference ([OBI-D-05](#102-document-rules)). What it addresses is the binding specification's concern: depending on that specification it may identify the artifact, the live service, a discovery point, artifact provenance, or a combination. This specification assigns it no universal role and does not promise that a tool can retrieve or act on a source without understanding its binding specification.

`content`, when present, carries an embedded source-artifact representation as any JSON value — object, array, string, number, boolean, or `null`. The binding specification defines which values are accepted representations and what they mean; this specification assigns no universal encoding to a JSON type (an object is not generically "the parsed artifact," a string not generically "UTF-8 source text"). Member **presence** is distinct from member value: `content: null` carries the JSON value `null` and is a present member for the at-least-one-of rule; only omitting the member omits embedded content. Implementations therefore track presence rather than testing for nullish values. JSON has no binary primitive; whether and how a binding specification encodes binary artifacts (an ordinary string encoding, a structured value) or requires them to ride `location` is that specification's choice.

**Composition.** When `content` is present, it is the artifact representation the processor interprets; a fetch from `location` does not silently replace it. This **content-primacy floor** is part of the composition semantics every binding specification defines ([OBI-B-02](#104-binding-specification-rules)): what a specification assigns a co-present `location` is its remaining role — invocation target, artifact identity, provenance, discovery address, or a reference base for content — never a silent replacement of embedded content.

In particular, a binding specification MAY define a co-present absolute `location` as the base for resolving references internal to embedded `content`: the base then travels in the document, so every processor receives the same value and the document stays context-free. What never supplies a base is the URI the OBI document itself was obtained from (invariant 4).

Binding sufficiency is a document property ([OBI-D-13](#102-document-rules)): the information needed to identify a binding's target under its governing binding specification is contained in the binding and its referenced source alone — `bindingSpec`, `location` and/or `content`, and `ref` — with no dependency on external registries, vendor catalogs, or environment configuration. Sufficiency does not extend to reachability: whether the identified target is currently reachable, accepts a caller's credentials, or succeeds at use are properties of the running service, not of the document. Verifying sufficiency takes binding-specification knowledge; a validator without it leaves the rule unverified rather than failing the document ([§10.5](#105-verification-conclusions)).

### 5.5. Transforms

Transforms map between operation values and source values when the two differ in shape. They exist so a single operation contract can be reused across bindings whose representations diverge (the operation presents a clean domain model; the bound OpenAPI path wraps requests in envelopes; the MCP tool returns content blocks). Declaring transforms in the OBI keeps shape-translation intent with the interface rather than scattered across per-tool configuration.

A binding whose source values already match its operation contract need not declare a transform. A document with no transforms imposes no transform-evaluator requirement on any tool.

The transform fields carry directional, per-value meaning. `inputTransform`, when declared, maps one caller-facing input value toward the source's expected input representation. `outputTransform`, when declared, maps one source output value toward the caller-facing `output` contract. Transforms apply to each value individually as it crosses the operation boundary; they never apply to an interaction as a whole and do not alter cardinality, framing, or lifecycle (invariant 1). The operation-facing side of a transform is defined by the operation contract; the source-facing side is defined by the binding specification ([OBI-B-02](#104-binding-specification-rules)). A binding specification that defines no JSON value representation at a transform boundary cannot offer portable transform behavior there; that is a limitation of the specification, not a defect of the document.

As a concrete example, a source returns

```json
{ "task_id": "abc", "task_title": "Buy milk", "is_done": false }
```

but the operation's `output` schema expects

```json
{ "id": "abc", "title": "Buy milk", "done": false }
```

The binding's `outputTransform` bridges the two:

```
{ "id": task_id, "title": task_title, "done": is_done }
```

**Language.** A transform is a [JSONata](https://jsonata.org/) expression string. Mandating one language is what makes transforms portable: a pluggable choice would leave a document unusable to consumers with a different evaluator. A tool that evaluates transforms ([OBI-T-10](#103-tool-rules)) does so under this contract:

1. **Pinned language.** OpenBindings 0.2 uses the **JSONata 2.1** language as defined by its versioned documentation. Features introduced after JSONata 2.1 are not part of the 0.2 transform language; a later OpenBindings version may adopt a later target. The language version is bound to the OpenBindings specification version; documents carry no per-document language field.
2. **Behavioral tiebreak.** Where the 2.1 documentation leaves observable behavior ambiguous, or where the initial 2.1.0 implementation was corrected within its maintenance line, the behavior of the JavaScript reference implementation at **2.1.1** governs, normatively. The OpenBindings project MAY publish errata against this pin; each erratum is identified and dated, and takes normative effect only when adopted by a subsequent specification release — the pinned behavior a released specification version denotes never changes after release, so `openbindings: 0.2.0` always names one evaluation behavior. The expected correction vehicle is a patch release adopting the erratum; documents opt in by declaring the patched version. Any implementation may provide its own evaluator; its 0.2 transform capability implements this pinned behavior.
3. **Result domain.** A successful evaluation produces exactly one JSON value per RFC 8259: `null`, a boolean, number, string, array, or object. An array is one JSON value; its elements are not reinterpreted as multiple operation values.
4. **Evaluation failure.** JSONata *undefined* (the result of paths into absent data), a function, or any other non-JSON result is a **transform-evaluation failure**, as are syntax errors and dynamic evaluation errors. A `null` result is a result, distinct from undefined. This specification does not prescribe how a consuming tool surfaces or reacts to a transform-evaluation failure (invariant 2). Authors who want a fallback where data may be absent use the language's coalescing forms rather than relying on undefined-result behavior.
5. **Closed environment.** The evaluation environment is closed over the input value (bound as the JSONata evaluation context), any bindings the governing binding specification defines for the expression position, and JSONata's standard library. A tool MUST NOT extend it further for document-supplied expressions — neither with bindings that reach host state (filesystem, network, environment variables, process state) nor with pure custom functions — since an expression using an extension evaluates on no other tool.
6. **Determinism.** The standard library's nondeterministic functions (`$now()`, `$random()`, `$millis()`) remain available; their use is not a conformance defect. The portability guarantee is correctness of evaluation, not byte-equivalence of outputs.

Named transforms MAY be defined in the top-level `transforms` map and referenced by binding entries via `$ref` (e.g., `{"$ref": "#/transforms/apiToTask"}`); bindings MAY also inline a transform as the string value of `inputTransform`/`outputTransform`.

A transform expression's parse-validity is a document rule ([OBI-D-18](#102-document-rules)): every transform expression in the document parses under the pinned language. As with schema well-formedness ([OBI-D-17](#102-document-rules)), a string at a transform position that is not in the pinned language at all is a document defect, not a latent runtime condition. The rule is syntactic only — membership in the language, not success of evaluation: dynamic errors and undefined results remain evaluation outcomes under clause 4, and a tool that evaluates a malformed expression anyway encounters it as a transform-evaluation failure (document rules bind documents, not a tool's inputs). Verifying the rule takes a parser for the pinned language; a validator without one leaves it unverified rather than failing the document ([§10.5](#105-verification-conclusions)).

---

## 6. Binding specifications

A source names the authority that gives it meaning. The `bindingSpec` value is a **binding specification identifier**: an exact, opaque, non-empty string denoting one stable semantic definition — a **binding specification** — under one defining authority ([OBI-B-01](#104-binding-specification-rules)).

The layers are distinct:

| Concept | Meaning |
|---|---|
| Binding specification identifier | The exact string a source carries. A name, not a locator. |
| Binding specification | One semantic definition of how its sources and bindings are interpreted and acted upon. May span several documents and incorporate upstream standards by reference. |
| Source artifact | A concrete representation the binding specification accepts, carried via `location`, `content`, or both. |
| Binding-specification implementation | Tool code implementing the specification. Not what the identifier names. |

**Identifier semantics.** Core processors treat the identifier as opaque: they do not decompose it, case-fold it, normalize versions, infer compatibility, or perform range matching — a tool supports the exact identifiers it implements. The identifier is not required to be a URI, and a URI-shaped identifier has no special processing semantics: processors never dereference it as part of interpreting the OBI, and understanding or acting on a binding never requires network access merely because `bindingSpec` is present (invariant 6). An incompatible change to a binding specification is published under a new identifier ([OBI-B-03](#104-binding-specification-rules)); this specification defines no equivalence or compatibility between distinct identifiers.

An unknown identifier does not make an otherwise conformant document non-conformant. A processor that does not implement the identified binding specification cannot claim support for, resolve, or act on the bindings it governs ([OBI-T-01](#103-tool-rules)); binding-specification-dependent document rules are then unverified rather than violated ([§10.5](#105-verification-conclusions)).

**Decentralized authority.** A binding specification may be published for a wide ecosystem or defined privately; support may be compiled into a program, installed as a package or plugin, or supplied by local configuration. Identity and distribution are separate concerns: the document carries the identity needed for exact dispatch and no retrieval instruction. A locally built CLI consuming a private artifact is fully conformant:

```json
{
  "bindingSpec": "my-cli.usage-json@1",
  "location": "file:///home/user/project/usage.kdl"
}
```

Identifiers intended to circulate across independently administered environments SHOULD be qualified under a namespace their publisher controls; local or private identifiers need not participate in any global scheme. The SHOULD is deliberate: no authority exists to police namespace ownership, and mandating one would recreate the registry this model excludes. The cost of ignoring it is equally concrete: two specifications circulating under one identifier violate [OBI-B-01](#104-binding-specification-rules)'s one-meaning requirement, tools cannot disambiguate them, and the resulting failure belongs to the colliding publishers, not to the documents or tools caught between them. Qualification is proportional to circulation, and the specification assigns no generic meaning to dots, `@`, or version-like suffixes. An identifier names semantic rules, not a local plugin: implementations may dispatch through plugins internally, but local dispatch does not define an identifier's portable meaning, and one identifier never legitimately carries two meanings.

**Formality.** A binding specification is governing rules under a stable identifier, at whatever formality its author chooses: a published normative document, an internal design page, or rules that exist only as an implementation's committed behavior. Formality determines reach, not standing — how far conformance claims travel and who can verify them ([§10.5](#105-verification-conclusions)); [OBI-B-02](#104-binding-specification-rules)'s floor gates portable claims (and this project's catalog minting), never existence. What no formality level relaxes is the identifier contract: one identifier, one meaning ([OBI-B-01](#104-binding-specification-rules)). An implementation-defined specification is therefore pinned to the behavior committed under its identifier — the identifier abstracts the rules from the code, and changed behavior is a new identifier ([OBI-B-03](#104-binding-specification-rules)), never a silent redefinition by deployment.

**Project and third-party publication.** The OpenBindings project publishes binding specifications for the source families it supports under identifiers of the form `openbindings.<name>@<rev>` (e.g., `openbindings.openapi@1`, `openbindings.mcp@1`), where `<rev>` is an integer revision of the binding specification itself; artifact and dialect versions live in the artifact and the specification's accepted-representations list, never in the identifier. Third parties publish equally valid binding specifications under their own authority — `com.example.<name>@<rev>` fits the same shape — with no project registration or approval. The project's authoring guidance for binding specifications (`binding-specs/README.md` in this repository) provides an informative template derived from the normative floor of [OBI-B-02](#104-binding-specification-rules); the template itself is not a conformance target. Implementation support must not be presented as if it creates or completes a binding specification: missing semantic rules are a defect of the claimed specification, not an invitation for tools to invent behavior.

---

## 7. Reference resolution

OBI documents define no `id` field, and no reference in them resolves against the URI a document was fetched from, so a document resolves identically however it was obtained: from its origin, a cache, a redirect, stdin, or an in-memory object (invariant 4). OBI assigns no identity of its own; the `name` and `version` fields are labels, not identifiers.

Every **OBI-defined document reference** is absolute or same-document. For this section, an OBI-defined document reference is one of:

1. **`sources[*].location`**: an absolute URI, or a binding-specification-defined absolute address that needs no base to interpret (a gRPC `host:port`). Never a relative reference.
2. **A schema `$ref`** (on an operation `input`/`output`, in the `schemas` map, or nested as a subschema): a same-document fragment in JSON Pointer form (a bare `#`, or `#` followed by an [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) pointer) or an absolute URI.
   - **Literal form.** Same-document fragments are written with the pointer's characters unencoded, so every addressable location has exactly one conformant spelling and two references to the same location are byte-equal; a percent-encoded fragment (`#/schemas/T%61sk`) is not a conformant OBI-defined reference.
   - **RFC 6901 escaping** (`~0` for `~`, `~1` for `/`) is JSON Pointer syntax, not an encoding layer, and is permitted in literal form. It is never needed to address OBI-defined map keys, whose name grammar ([OBI-D-03](#102-document-rules)) excludes `~` and `/`; a pointer traversing property names inside schema content (which OBI-D-03 does not constrain) uses it normally.
   - **An accepted limit.** A location whose reference tokens contain characters that cannot appear literally in a URI fragment (a property name containing a space) is not addressable at an OBI position. The supported arrangement is to define that schema as a named entry in `schemas` and reference it *from* the deep position — always available, because the document author controls both ends.
   - **Other fragment forms.** Plain-name (`$anchor`) fragments are not used as same-document references at OBI positions: the `schemas` map is the document's named-schema mechanism (`#/schemas/<name>`). The dynamic pair (`$dynamicRef`/`$dynamicAnchor`) does not appear at OBI positions: a `$dynamicRef` that engages no dynamic anchor behaves exactly as `$ref` (write `$ref`), and any form that does engage one resolves against the runtime dynamic scope — context-dependence this clause exists to exclude.
   - **`$id` scope.** A schema `$id` at an OBI position, when present, is absolute. A schema resource that declares its own `$id` is that resource's internal business: `$ref`s, nested `$id`s, anchors, and the dynamic pair within it resolve against that resource's base per JSON Schema 2020-12, exactly as for an externally fetched schema.
3. **A named-transform `$ref`** in `bindings[*].inputTransform`/`bindings[*].outputTransform`: a same-document fragment in literal form resolving into the `transforms` map ([OBI-D-10](#102-document-rules)).

`bindings[*].ref` is **not** an OBI-defined document reference. It is a selector into the source's artifact, interpreted by the governing binding specification ([§5.3](#53-bindings)), and is exempt from the absolute-or-same-document requirement.

Schema `$ref` and `$id` resolution follows [JSON Schema 2020-12](https://json-schema.org/draft/2020-12): a `$id`, when present, establishes the schema resource and the base URI for the `$ref`s inside it. OBI does not override that; it constrains the forms ([OBI-D-05](#102-document-rules)), which is what keeps schema resolution independent of where the OBI was fetched. For schemas embedded in an OBI document, the initial base for resolving same-document fragments is the OBI document root — JSON Schema 2020-12 leaves the resolution context of schemas embedded in a non-schema document to the embedding application, and OBI fixes it here so `#/schemas/...` resolves identically across tools. A same-document fragment `$ref` is evaluated as an RFC 6901 pointer from that root until resolution enters a schema declaring its own `$id`. Same-document fragments actually resolve in a conformant document ([OBI-D-16](#102-document-rules)), as binding and transform references do (OBI-D-08/09/10): internal references are document integrity, offline-decidable by any validator, while external resolution is an evaluation-time capability. A consequence (informative): a tool that extracts an operation's schema and resolves it through a JSON Schema implementation in isolation preserves the OBI document as the resolution scope (by bundling or registering it), or same-document fragments will not resolve.

An absolute `$ref` resolves within the document when it matches the `$id` a schema embedded in the document declares (standard 2020-12 identity resolution — no fetching involved); otherwise it addresses an external schema resource. A tool MAY decline to obtain external resources; a document whose `$ref`s all resolve within it is evaluable with no network access at all, as the project's published interfaces are. The consequence of declining is fixed by [OBI-T-16](#103-tool-rules) for tools that claim validation: a governing graph that cannot be fully resolved validates nothing.

References internal to embedded source `content` are the binding specification's concern ([§5.4](#54-sources)): it defines whether they must be self-contained or resolve against a base it designates — a co-present absolute `location`, or a base carried within the artifact — and the OBI document's own retrieval URI is never that base.

Schema `$ref` cycles are permitted: recursive types (trees, linked lists, ASTs) are legitimate and widespread. Tools that resolve `$ref` MUST handle cycles without infinite loops ([OBI-T-11](#103-tool-rules)); the exact technique (memoization, bisimulation) is tool-defined. Comparing two URIs for identity (caching, deduplication) is a tool concern; this specification defines no canonical equality, and a tool that normalizes keeps "which document was fetched" distinct from "which schema a `$ref` targets" — `…#/$defs/A` and `…#/$defs/B` address different schemas.

---

## 8. Versioning

OBI documents carry two independent version concepts: the specification version the document is written against, and an author-controlled label for the interface itself.

### 8.1. `openbindings` field (specification version)

The `openbindings` field identifies the version of this specification the document declares. The value MUST be a [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) string ([OBI-D-12](#102-document-rules)).

**Processing.** A processor has an explicit set of specification versions it supports — individual versions, intervals, or release lines its maintainers have verified — and interprets a document under OpenBindings semantics only when the declared version belongs to that set ([OBI-T-04](#103-tool-rules)). Any other version produces a **version refusal** rather than interpretation under different-version rules. Supporting one version implies nothing about any other: Semantic Versioning governs this project's release-compatibility claims — from 1.0.0 onward a new minor is backward-compatible with documents written to the previous minor, while pre-1.0 minors MAY break (see the release policy below) — and in either regime backward compatibility is not forward comprehension: no comparison of two version strings establishes what a given implementation contains. A processor MAY deliberately support a whole release line (`0.2.x`); that is its own support declaration, not an inference this specification imposes.

- A prerelease (`0.2.0-rc.1`) is a distinct, potentially incompatible draft: it is supported only when the processor explicitly includes it, and supporting its eventual release does not imply supporting the prerelease.
- Build metadata is permitted, has no OpenBindings semantics, and is ignored when determining support: `0.2.0+build.1` denotes the same specification semantics as `0.2.0`.
- Version refusal prohibits unsupported semantic interpretation; it does not require failure before JSON parsing. A processor MAY parse, preserve, display, or route an unsupported document, and SHOULD report the declared version it refused — a refusal is distinct from document non-conformance, since the document may conform to the version it declares.
- Unknown-field tolerance ([OBI-T-02](#103-tool-rules)) applies while processing a supported version; it does not authorize accepting an unsupported version by ignoring its additions.

**Release policy (project).** While pre-1.0, minor versions MAY include breaking changes, per pre-1.0 SemVer convention; patch versions are fixes and non-breaking changes. Documents SHOULD declare the lowest specification version sufficient for their content, which maximizes the processors able to interpret them.

### 8.2. `version` field (interface-version label)

The optional `version` field is a non-empty, opaque, author-controlled label for the described interface. It is opaque to this specification: no ordering, comparison, Semantic Versioning, compatibility, identity, resolution, selection, or refusal semantics attach to it, and tools may preserve, display, index, or group by its exact value. Authors MAY use SemVer, dates, or any other convention; any stronger interpretation comes from an external catalog, registry, or organizational policy.

| Field | Meaning |
|---|---|
| `openbindings` | Version of this specification governing document interpretation and processor support. |
| `version` | Author-controlled label for the described interface; opaque to this specification. |

---

## 9. Security considerations

Processing OBI documents involves parsing untrusted JSON, optionally obtaining external artifacts and schemas, resolving references, and evaluating author-supplied expressions. The threat surface is comparable to JSON Schema processors and artifact-consuming tools generally: SSRF, resource exhaustion, untrusted code evaluation, and content confusion.

The document format creates the following exposure:

- **URIs as attack vectors.** `sources[*].location` values and schema `$ref` values may resolve to arbitrary network endpoints, including internal or link-local addresses such as `http://169.254.169.254/...` or `file:///etc/passwd`. Unrestricted dereferencing inherits SSRF and exfiltration exposure.
- **Unbounded size.** The specification imposes no size cap on OBI documents or on the artifacts and schemas they reference. Untrusted input creates memory and processing-time exhaustion exposure.
- **Schema `$ref` cycles.** Permitted by [§7](#7-reference-resolution); naive resolvers can exhaust the stack or loop indefinitely.
- **Transforms as executable code.** Transforms are JSONata source. Untrusted documents can embed expressions designed to run without bound when evaluated. On a conforming tool the exposure is bounded to computation: the closed evaluation environment ([OBI-T-10](#103-tool-rules)) bars document-supplied expressions from host state. Closure is normative because host-reaching bindings would break transform portability before they broke security; bounding evaluation time and memory remains per-tool policy.
- **Integrity is out of scope.** The specification defines no signing, attestation, or integrity verification. Authenticity and integrity are established by external means (transport security, content signing, out-of-band attestation) or not at all; [Appendix A](#appendix-a-canonical-serialization-informative) names a deterministic serialization such systems can build on.

Mitigation strategies are processor concerns; the specification does not mandate mitigation policy beyond the transform-environment closure above.

### 9.1. Recommended mitigations (informative)

Non-normative categories of mitigation that tools processing OBI documents from untrusted origins typically consider; specific limits and defaults depend on deployment.

- **Scheme allow-list** for URI dereferencing. Rejecting `file://`, `data:`, and schemes outside an explicit allow-list by default is common practice.
- **Network-range restrictions.** Refusing to dereference URIs resolving to link-local (`169.254.0.0/16`, `fe80::/10`), loopback (`127.0.0.0/8`, `::1`), private (RFC 1918, `fc00::/7`), or carrier-grade NAT (`100.64.0.0/10`) ranges by default, with explicit operator opt-in. A complete treatment checks the IANA special-purpose registries, normalizes IPv4-mapped IPv6 forms before comparison, and applies the check after DNS resolution, per redirect hop.
- **Size caps** on fetched documents, schemas, and source artifacts.
- **Timeouts** on fetches and on transform evaluation.
- **JSONata resource isolation.** Host access is barred normatively; what remains per-tool is bounding evaluation time and memory.
- **Transport security.** Enforcing TLS for non-loopback origins; distinguishing the URI a document was requested at from the URI a redirect resolved to when deriving any cache key (this specification defines no canonical identity, and resolution depends on neither URI).
- **Reference-cycle detection.** Required by [OBI-T-11](#103-tool-rules) for `$ref` cycles; the same posture applies to transitive `location` traversal.

---

## 10. Conformance

The normative shape of an OBI document is defined by this specification's prose. The accompanying `openbindings.schema.json` expresses the structural portion in JSON Schema form for validator tooling; it is a derived artifact, not a second source of truth. **Where prose and schema conflict, the prose governs.** Schema validation (OBI-D-02) is necessary but not sufficient for document conformance: some rules (the document-unique identifier namespace of OBI-D-04, the recursive prohibitions of OBI-D-06/07, well-formedness under OBI-D-17, parse-validity under OBI-D-18) require walking the document beyond what the derived schema expresses.

Each rule carries a stable identifier (`OBI-D-##` document rules, `OBI-T-##` tool rules, `OBI-B-##` binding-specification rules) so validators, test suites, and errata can cite it unambiguously. Identifiers are never reused or renumbered; rules removed by a revision retain their identifiers as historical references ([§10.6](#106-retired-rule-identifiers)).

### 10.1. Tool obligations

A tool's obligations follow the capabilities it exercises, not a fixed class. A tool that only parses, validates against the document rules, indexes, or renders OBI documents owes the rules marked *all processors*. A tool that also resolves references, validates values against operation contracts, resolves operation names, evaluates transforms, or acts on sources additionally owes the rules scoped to those activities. Invoking a binding, by itself, triggers no rule in this specification (invariant 2).

A tool self-declares its capabilities in its documentation or metadata; there is no central registration. A conformance test corpus is published as reference material (not part of this specification); a rule without fixtures is no less binding, it simply rests on self-declaration.

### 10.2. Document rules

Document rules bind the document; verifying a clause takes capabilities. A validator that lacks a capability a clause requires (a duplicate-detecting parse for OBI-D-01, binding-specification knowledge for OBI-D-05's non-URI addresses and OBI-D-13, a parser for the pinned transform language for OBI-D-18) leaves that clause **unverified** rather than failing the document: conformance is a property of the document, not of any validator, and unverified is not non-conformant ([§10.5](#105-verification-conclusions)).

A conformant **OBI document**:

- **OBI-D-01**: Is valid UTF-8 encoded JSON per [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259). Duplicate JSON object keys within any object make the document invalid. A leading byte-order mark makes the document invalid: RFC 8259 §8.1 forbids adding one, interoperable-JSON practice ([RFC 7493](https://www.rfc-editor.org/rfc/rfc7493)) excludes it, and tolerating it would let two parsers disagree over the same bytes. Verification note (informative): most JSON parsers silently keep one duplicate value, so checking the duplicate clause requires a duplicate-detecting parse; a validator whose parser cannot surface duplicates leaves the clause unverified.
- **OBI-D-02**: Validates against the JSON Schema at `openbindings.schema.json`.
- **OBI-D-03**: Has every map key this specification defines (operation, binding, source, transform, schema, and example keys) and every operation alias matching `^[A-Za-z0-9_][A-Za-z0-9_.-]*$`. Property names inside JSON Schema objects are schema content, not map keys, and are unconstrained by this rule.
- **OBI-D-04**: Has no collision between any two operation identifiers within the document, where an operation's identifiers are its key plus any entries in its `aliases` array.
- **OBI-D-05**: Carries only absolute or same-document OBI-defined references, in the forms of [§7](#7-reference-resolution): every `sources[*].location` an absolute URI or binding-specification-defined absolute address (never a relative reference); every schema `$ref` a same-document JSON Pointer fragment in literal form or an absolute URI; every schema `$id` at an OBI position absolute; every named-transform `$ref` a same-document fragment in literal form; no `$anchor`-fragment references, `$dynamicRef`, or `$dynamicAnchor` at OBI positions (all per [§7](#7-reference-resolution), including the internal-business scope of schema resources declaring their own `$id`). Every URI-form reference is well-formed per [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) §4.1. Verification note (informative): the relative-reference clause is decidable without binding-specification knowledge — a `location` with no `:` before its first `/`, `?`, or `#` cannot carry a scheme and is relative in form (RFC 3986 §4.2), rejectable by any validator; `./openapi.json` and bare `example.com` fail everywhere. Only a colon-bearing string that is not a well-formed URI takes binding-specification knowledge, and a validator without it leaves that case unverified.
- **OBI-D-06**: Has every `$schema` value, where present, equal to `https://json-schema.org/draft/2020-12/schema`.
- **OBI-D-07**: Has no `$vocabulary` keyword in any schema within the document.
- **OBI-D-08**: Has every `bindings[*].operation` value present as a key in the document's `operations` map.
- **OBI-D-09**: Has every `bindings[*].source` value present as a key in the document's `sources` map.
- **OBI-D-10**: Has every named-transform `$ref` in `bindings[*].inputTransform` and `bindings[*].outputTransform` resolving to a key in the document's `transforms` map.
- **OBI-D-11**: Has every provided example value validating against its operation's corresponding schema, where that schema is specified **and** the schema graph statically reachable from it resolves entirely within the document. An explicitly `null` example member is a provided value and is validated; an absent member is unprovided. A provided example whose governing graph reaches external resources is outside this rule; tools MAY check it and report mismatches as verification evidence, not document non-conformance ([§5.1](#51-operations)).
- **OBI-D-12**: Has an `openbindings` field whose value is a valid [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) string.
- **OBI-D-13**: Has every binding identifiable, under its source's governing binding specification, from the binding and its referenced source alone, with no dependency on external registries, vendor catalogs, or environment configuration. (See [§5.4](#54-sources).) Verification is per-binding-specification knowledge; unverified is not non-conformant.
- **OBI-D-16**: Has every schema `$ref` that is a same-document fragment resolving, from the OBI document root per [§7](#7-reference-resolution), to a location that exists within the document. A `$ref` within a schema declaring its own `$id` resolves against that resource's base and is out of this rule's scope; an absolute-URI `$ref` is out of scope unless it matches an embedded schema's `$id`. Together with OBI-D-08/09/10, this completes one posture: same-document references are document integrity, offline-decidable; only external resolution is deferred to evaluation.
- **OBI-D-17**: Has every schema contained in the document — every specified operation `input`/`output`, every entry in `schemas`, and their subschemas as JSON Schema 2020-12 defines them — well-formed: valid against the JSON Schema 2020-12 meta-schemas and satisfying the constraints of [§5.2](#52-schemas). Verification uses locally available meta-schemas and MUST NOT require a network fetch. The rule does not require proving satisfiability, resolving external resources, or rejecting unknown keywords ([§5.2](#52-schemas)).
- **OBI-D-18**: Has every transform expression in the document — every value in the `transforms` map and every inline string value of `bindings[*].inputTransform` and `bindings[*].outputTransform` — parsing as a syntactically valid expression of the pinned transform language ([§5.5](#55-transforms): JSONata 2.1, with jsonata-js 2.1.1's parse acceptance as the normative tiebreak, subject to release-adopted errata). The rule is syntactic membership only: it does not establish that evaluation succeeds, that referenced data exists, or that dynamic errors will not occur — those remain evaluation outcomes under [§5.5](#55-transforms). Verification note (informative): checking requires a parser for the pinned language; a validator without one leaves the rule unverified.

(OBI-D-14 and OBI-D-15 are retired; see [§10.6](#106-retired-rule-identifiers).)

### 10.3. Tool rules

A conformant **tool**:

- **OBI-T-01** (all processors): Does not fail processing a document solely because the document references a binding specification the tool does not support. Tools MAY surface diagnostics; bindings governed by unsupported specifications are unactionable for that tool, and binding-specification-dependent rules are unverified, not violated.
- **OBI-T-02** (all processors): Ignores unknown fields not defined by this specification. "Fields" are the properties of OBI-defined objects (the document root; operation, source, binding, and example objects; and the `$ref` object form of `inputTransform`/`outputTransform`); property names inside JSON Schema objects are schema content, out of scope for this rule, mirroring OBI-D-03. Tools SHOULD surface diagnostics for unknown non-`x-` fields to help catch typos.
- **OBI-T-03** (all processors): Treats `x-` prefixed fields as extensions. Unknown `x-` fields MUST NOT change the meaning of core fields for conformance purposes.
- **OBI-T-04** (all processors): Interprets a document under this specification's semantics only when its declared `openbindings` version belongs to the processor's explicitly supported set, and otherwise produces a version refusal, reported distinctly from document non-conformance. The version-processing semantics of [§8.1](#81-openbindings-field-specification-version) govern this rule: prerelease and build-metadata handling, what a refusal prohibits (interpretation under a different version's rules) and permits (parsing, preserving, inspecting, and reporting the declared version), and refusal reporting.
- **OBI-T-05** (applies when reasoning about schemas, e.g., for comparison, validation, or code generation): SHOULD surface diagnostics for semantically significant keywords the tool does not interpret. A tool whose output cannot represent a schema's meaning (a code generator with no bottom type for `false`) surfaces the limitation rather than silently substituting a different contract.
- **OBI-T-06** (applies when resolving or acting on `ref` values): Honors the conventions the governing binding specification defines for each `ref` it acts on, including the absent-`ref` case.
- **OBI-T-10** (applies when evaluating transforms): Evaluates document-supplied transforms under the language contract of [§5.5](#55-transforms), whose numbered clauses govern this rule: the pinned JSONata 2.1 language with jsonata-js 2.1.1 as the normative behavioral tiebreak (errata adopted only by subsequent specification releases); exactly one JSON value as the successful result; undefined, non-JSON results, syntax errors, and dynamic errors as transform-evaluation failures; and the closed evaluation environment of §5.5 clause 5 — no extension with host-reaching bindings or pure custom functions.
- **OBI-T-11** (applies when resolving `$ref` values): Handles cycles without infinite loops (memoization, bisimulation, or similar). The exact handling is tool-defined.
- **OBI-T-12** (applies when resolving operation names): Resolves a name against the flat namespace of operation identifiers (each operation's key together with its `aliases`), treating key and alias matches as equally authoritative. OBI-D-04 makes the namespace document-unique, so a name resolves to at most one operation; a tool MUST NOT privilege key matches over alias matches, and MUST NOT resolve a name that matches no identifier. On resolution failure a tool SHOULD surface a diagnostic naming the unresolved name. A binding for a resolved operation is selected by the operation's key (the value in `bindings[*].operation`), not by the alias used to reach it.
- **OBI-T-16** (applies when validating values against operation contracts — a tool that checks a value against an operation's `input` or `output` schema and reports the outcome as contract validation): Applies the validation semantics of [§5.2](#52-schemas): success only against the complete, well-formed, evaluable schema graph statically reachable from the governing schema; no success against a partially available graph, even when the instance appears not to exercise the unavailable branch; `format` as annotation only; per-value application for interactions carrying more than one value; and distinct reporting of instance mismatch versus graph unavailability. Nothing triggers this rule but the claim itself: invoking, rendering, or indexing does not.
- **OBI-T-17** (applies when reporting document-conformance conclusions): Reports an overall conclusion using the vocabulary of [§10.5](#105-verification-conclusions): **conformant** only when every applicable document rule was verified with no violation; **non-conformant** when any violation was established; **conformance undetermined** when no violation was established but applicable rules remain unverified. Violated and unverified rules are identified by their stable rule identifiers, and partial verification MUST NOT be presented as unqualified conformance.

The consistent posture across OBI-T-01 through OBI-T-04 — do not fail the document on unknown or unsupported elements — is deliberate. Partial support is the common case; failing whole documents on any unsupported element would force every tool to support everything, fracturing the ecosystem, while diagnostics preserve visibility. The MUST-level rules bind exactly where two independent tools would otherwise silently disagree about the same document: name resolution (OBI-T-12), transform meaning (OBI-T-10), validation-claim meaning (OBI-T-16), version interpretation (OBI-T-04), and honest verification reporting (OBI-T-17). Everything else — selection, invocation, runtime policy — remains outside this specification (invariant 2).

### 10.4. Binding-specification rules

These rules bind **binding specifications** — the semantic definitions sources name via `bindingSpec` ([§6](#6-binding-specifications)) — rather than documents or tools. A tool claiming support for an identifier claims support for its specification as published; this specification cannot verify third-party specifications, and these rules define what it means for one to be complete.

A conformant **binding specification**:

- **OBI-B-01**: Is denoted by an exact, opaque, non-empty string identifier under one defining authority, denoting one stable semantic definition. The identifier is never implicitly dereferenced, and no generic equivalence, normalization, or range semantics relate distinct identifiers.
- **OBI-B-02**: Defines each of the following for the sources and bindings it governs:
  1. the source representations it accepts, with deterministic discrimination when it accepts several, and the encoding for any non-JSON artifact;
  2. the syntax and meaning of `location`;
  3. the accepted values and meaning of `content`;
  4. how `location` and `content` compose when both are present — within the content-primacy floor of [§5.4](#54-sources) — including whether `location` supplies a reference base for embedded content;
  5. the syntax and meaning of `ref`, including the absent-`ref` case;
  6. how the binding target and its interaction are identified;
  7. how caller-facing input values and successful output values correspond to the source interaction, including which outcomes are successes and any context bindings provided at transform positions.

  The enumerated items are the completeness test; their purpose is that two independent implementations agree on the meaning of every governed source and binding. An item left undefined is a defect of the binding specification, not an invitation for tools to invent behavior ([§6](#6-binding-specifications)).
- **OBI-B-03**: Publishes any incompatible change under a new identifier. Compatible clarification may retain the identifier; the choice is the defining authority's, and consumers rely on one identifier never meaning two things.

### 10.5. Verification conclusions

A document is objectively conformant or non-conformant under this specification (invariant 5); **conformance undetermined** is not a third document state but a verifier's conclusion that its evidence is insufficient. A tool reporting an overall conclusion uses three meanings ([OBI-T-17](#103-tool-rules)):

| Conclusion | Exact meaning |
|---|---|
| **Conformant** | Every applicable document rule was checked and no violation established. |
| **Non-conformant** | At least one violation of an applicable document rule was established. |
| **Conformance undetermined** | No violation established, but one or more applicable rules remain unverified. |

A known violation is decisive: if one rule is violated while others remain unverified, the conclusion is non-conformant, with the unverified rules retained as evidence. Absence of a known violation is not sufficient for the positive conclusion.

Rule-level evidence uses: **satisfied** (checked, holds), **violated** (checked, does not hold), **unverified** (neither established), and **not applicable**. Common reasons a rule is unverified — an unsupported binding specification, an unavailable or policy-declined external resource, a missing capability, an exceeded resource limit — are not evidence of violation. Scoped claims are legitimate when they name their scope ("structurally valid against the derived schema"); the unqualified word "valid" is avoided because it does not reveal whether it means parseable, schema-valid, partially checked, or fully verified. This specification standardizes vocabulary and truth conditions, not a report serialization and not a ladder of named verification levels: verification capabilities are independent dimensions, not rungs.

### 10.6. Retired rule identifiers

Identifiers are stable and never reused, so retirements leave permanent numbering gaps; the gaps are deliberate. The following identifiers, assigned in earlier revisions of this specification, are retired or relocated and remain reserved as historical references.

| Identifier | Disposition |
|---|---|
| OBI-D-14 | Retired. `content` representations are binding-specification-defined ([OBI-B-02](#104-binding-specification-rules)); the core no longer restricts `content` JSON types or prescribes a binary posture. |
| OBI-D-15 | Retired. Reference-base behavior for embedded content is binding-specification-defined ([OBI-B-02](#104-binding-specification-rules)); the OBI retrieval URI is never a base ([§7](#7-reference-resolution)). |
| OBI-T-07 | Retired. Invoking does not trigger validation (invariant 2); validation claims are governed by [OBI-T-16](#103-tool-rules). |
| OBI-T-08 | Retired. As OBI-T-07; classification of successful outcomes is binding-specification-defined ([OBI-B-02](#104-binding-specification-rules)). |
| OBI-T-09 | Retired. This specification defines no binding-selection algorithm; `preference` and `deprecated` are author signals ([§5.3](#53-bindings)). |
| OBI-T-13 | Moved. Discovery serving is defined by the OpenBindings HTTP Discovery companion specification. |
| OBI-T-14 | Moved. Discovery fetching is defined by the OpenBindings HTTP Discovery companion specification. |
| OBI-T-15 | Retired. `location`/`content` composition is binding-specification-defined within the content-primacy floor of [§5.4](#54-sources) ([OBI-B-02](#104-binding-specification-rules)). |

---

## 11. IANA considerations

This specification defines the registration details for the OpenBindings JSON media type. The IANA registries are authoritative for current registration status. (The `openbindings` well-known URI suffix is registered by the OpenBindings HTTP Discovery companion specification, which defines the endpoint it names.)

Per [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838), under the vendor tree:

- **Type/subtype:** `application/vnd.openbindings+json`
- **Required parameters:** none
- **Encoding considerations:** 8-bit UTF-8 per [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)
- **Fragment identifier considerations:** JSON Pointer per [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)
- **Security considerations:** see [§9. Security considerations](#9-security-considerations)
- **Interoperability considerations:** see [§10. Conformance](#10-conformance)
- **Applications that use this media type:** tools that produce or consume OpenBindings documents
- **Optional parameters:** none
- **Restrictions on usage:** none
- **Intended usage:** COMMON
- **Contact:** the OpenBindings maintainers, via [github.com/openbindings](https://github.com/openbindings)
- **Change controller:** openbindings project
- **Published specification:** this specification

---

## 12. Extensions

- OBI documents MAY include extension fields whose keys begin with `x-` at any object location.
- Tools MUST ignore `x-` fields they do not understand.
- `x-` fields MUST NOT change the meaning of core fields defined by this specification.

"Object location" means the properties of OBI-defined objects: the document root; the operation, source, binding, and example objects; and the `$ref` object form of `inputTransform`/`outputTransform` — the same positions [OBI-T-02](#103-tool-rules) enumerates. Keys inside the document's maps (`operations`, `sources`, `bindings`, `transforms`, `schemas`, and an operation's `examples`) are entry names, not fields: an `x-`-prefixed key there defines an ordinary entry named `x-…`, entering the identifier namespace like any other key (OBI-D-03, OBI-D-04), not an extension. Property names inside JSON Schema objects are schema content and follow [§5.2. Schemas](#52-schemas).

---

## 13. References

### 13.1. Normative references

- **[BCP 14]** S. Bradner, "Key words for use in RFCs to Indicate Requirement Levels," RFC 2119 / BCP 14, March 1997. <https://www.rfc-editor.org/rfc/rfc2119>
- **[RFC 8174]** B. Leiba, "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words," RFC 8174, May 2017. <https://www.rfc-editor.org/rfc/rfc8174>
- **[RFC 8259]** T. Bray, Ed., "The JavaScript Object Notation (JSON) Data Interchange Format," RFC 8259, December 2017. <https://www.rfc-editor.org/rfc/rfc8259>
- **[RFC 3986]** T. Berners-Lee, R. Fielding, L. Masinter, "Uniform Resource Identifier (URI): Generic Syntax," RFC 3986, January 2005. <https://www.rfc-editor.org/rfc/rfc3986>
- **[RFC 6838]** N. Freed, J. Klensin, T. Hansen, "Media Type Specifications and Registration Procedures," RFC 6838, January 2013. <https://www.rfc-editor.org/rfc/rfc6838>
- **[RFC 6901]** P. Bryan, Ed., K. Zyp, M. Nottingham, Ed., "JavaScript Object Notation (JSON) Pointer," RFC 6901, April 2013. <https://www.rfc-editor.org/rfc/rfc6901>
- **[SemVer 2.0.0]** Tom Preston-Werner, "Semantic Versioning 2.0.0." <https://semver.org/spec/v2.0.0.html>
- **[JSON Schema 2020-12]** JSON Schema Specification, Draft 2020-12, including its meta-schemas. <https://json-schema.org/draft/2020-12>
- **[JSONata 2.1]** JSONata Project, "JSONata Documentation," at language version 2.1. <https://docs.jsonata.org/>
- **[jsonata-js 2.1.1]** JSONata Project, `jsonata` (npm), version 2.1.1. <https://github.com/jsonata-js/jsonata>. Normative behavioral tiebreak for the pinned transform language per [§5.5](#55-transforms); errata against the pin are adopted only by subsequent specification releases.

### 13.2. Informative references

- **[RFC 7493]** T. Bray, Ed., "The I-JSON Message Format," RFC 7493, March 2015. <https://www.rfc-editor.org/rfc/rfc7493>. Cited by [OBI-D-01](#102-document-rules) and [Appendix A](#appendix-a-canonical-serialization-informative).
- **[RFC 8785]** A. Rundgren, B. Jordan, S. Erdtman, "JSON Canonicalization Scheme (JCS)," RFC 8785, June 2020. <https://www.rfc-editor.org/rfc/rfc8785>. Cited by [Appendix A](#appendix-a-canonical-serialization-informative).
- **OpenBindings HTTP Discovery** — companion specification (`http-discovery.md` in this repository) defining publication and retrieval at `/.well-known/openbindings`.
- **openbindings reference tools**: `ob` CLI, `openbindings-go`, `openbindings-ts` (see project README). One implementation of this specification among potentially many.

---

## 14. See also

- `openbindings.schema.json` — derived JSON Schema for structural document validity.
- `http-discovery.md` — the OpenBindings HTTP Discovery companion specification.
- The openbindings project's shared-contract interfaces — published at [openbindings.com/interfaces](https://openbindings.com/interfaces) (informational).
- `binding-specs/` — binding specifications published by this project, and authoring guidance for new ones.
- `conformance/` — conformance test corpus keyed to OBI-D-##/OBI-T-##/OBI-B-## rule identifiers.
- `CHANGELOG.md` — version history and diffs between specification versions.
- `EDITORS.md` — current editor roster.
- `GOVERNANCE.md` — project governance and decision-making.
- `SECURITY.md` — vulnerability reporting and security contact.

---

## Appendix A. Canonical serialization (informative)

Some applications need a stable byte representation of an OBI document — content addressing, integrity attestation, signature systems, cache keys, prompt-cache stability. This appendix names one so tools and downstream specifications can refer to it consistently. It is informative: conformance neither requires JCS-compatible input nor requires any processor to implement canonicalization.

For an OBI whose parsed JSON value satisfies the input requirements of [RFC 8785 (JSON Canonicalization Scheme)](https://www.rfc-editor.org/rfc/rfc8785), its JCS serialization provides deterministic bytes for the complete carried JSON value. The facility is **partial**: RFC 8785 constrains its input to the I-JSON subset ([RFC 7493](https://www.rfc-editor.org/rfc/rfc7493)) — numbers representable in IEEE 754 binary64, strings expressible as Unicode — while this specification pins RFC 8259 JSON and JSON Schema 2020-12, which bound neither. A conformant OBI may therefore have no JCS serialization. The facility named here is JCS over the JSON value exactly as carried: an implementation that rounds, coerces, repairs, or otherwise changes a value to manufacture compatible input is computing some other serialization, not this one; incompatible input is reported as failure per RFC 8785. This matters most when canonical bytes feed hashes, signatures, or equality: silent coercion would attest to data other than what the author supplied.

Canonical serialization is not semantic normalization. JCS sorts object member names and preserves array order; it does not rewrite `{}` to `true`, resolve or bundle references, insert defaults, drop unknown fields, or interpret embedded `content`. Two OBIs can express equivalent contracts with different canonical bytes, and equal bytes establish equal carried JSON data, not behavioral equivalence or document identity. Naming a serialization also defines no integrity system: digest algorithms, signature envelopes, carrier fields, and trust policy belong to downstream specifications, and by default JCS covers only the JSON value carried in the OBI itself, never fetched external resources.

[Terminology]: #3-terminology
[Operations]: #51-operations
[Schemas]: #52-schemas
[Bindings]: #53-bindings
[Sources]: #54-sources
[Transforms]: #55-transforms
[Binding specifications]: #6-binding-specifications
[Reference resolution]: #7-reference-resolution
[Versioning]: #8-versioning
[Security considerations]: #9-security-considerations
[Conformance]: #10-conformance
