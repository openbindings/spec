# OpenBindings Specification (v0.2.0)

## Abstract

OpenBindings is a portable interface description format; its documents are OBIs (OpenBindings interface documents). An OBI declares operations once, each a protocol-independent contract with optional per-value input and output schemas, then relates those contracts to concrete realizations through bindings and to named consumption points through dependencies. The contract lives at the operation layer; protocols live at the binding layer.

```json
{
  "openbindings": "0.2.0",
  "operations": {
    "createTask": {
      "input": {
        "type": "object",
        "properties": { "title": { "type": "string" } },
        "required": ["title"]
      },
      "output": {
        "type": "object",
        "properties": { "id": { "type": "string" } }
      }
    }
  },
  "sources": {
    "httpApi": {
      "kind": "example.openapi@1",
      "content": { "location": "https://example.com/openapi.json" }
    }
  },
  "bindings": {
    "createTask.http": {
      "operation": "createTask",
      "source": "httpApi",
      "content": { "target": "#/paths/~1tasks/post" }
    }
  }
}
```

The kinds in this document's examples (`example.openapi@1`, `example.mcp@1`, `example.grpc@1`) are illustrative, as are the shapes of their `content`, such as `{ "location": … }` on a source and `{ "target": … }` on a binding. This specification assigns no meaning to either content shape.

The body of this document defines the OBI shape, its reference-resolution rules, how kinds are compared, and conformance rules for documents and tools. New readers may prefer the [§4. Overview](#4-overview) walkthrough; the normative material starts at [§2. Core invariants](#2-core-invariants).

## Editors

- Matthew Clevenger ([@clevengermatt](https://github.com/clevengermatt))

See `EDITORS.md` for the current editor roster.

## Status of this document

This is **version 0.2.0** of the OpenBindings specification. This text is the unreleased working draft of that version; the latest release is **0.1.0** (immutable released snapshots live under `versions/`). It is pre-1.0, and minor-version revisions MAY include breaking changes per [§8. Versioning](#8-versioning). Substantive changes are recorded in `CHANGELOG.md` and cite rule identifiers (`OBI-D-##`/`OBI-T-##`) where applicable, each under the version it belongs to.

## License and intellectual property

This specification is published under the Apache 2.0 License (see `LICENSE`).
Apache 2.0 defines the copyright and contribution-scoped patent grants
currently in force. The project has no separately executed
standards-essential-claims commitment; implementers must not infer one from
the absence of a disclosure. [`IPR.md`](IPR.md) records the precise current
posture, received-disclosure status, and the additional decision required
before the final 0.2 release.

## Notational conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/info/bcp14) ([RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)) when, and only when, they appear in all capitals.

JSON shown inline in this document is illustrative unless the surrounding prose explicitly states a requirement. (This is distinct from the operation `examples` field, whose contents are the author's claims about an operation's values ([§5.1](#51-operations)).)

## Table of contents

- [1. Positioning and scope](#1-positioning-and-scope)
  - [1.1. Distinguishing features](#11-distinguishing-features)
  - [1.2. Out of scope](#12-out-of-scope)
  - [1.3. Scope and deferral](#13-scope-and-deferral)
  - [1.4. Obtaining an OBI](#14-obtaining-an-obi)
- [2. Core invariants](#2-core-invariants)
- [3. Terminology](#3-terminology)
- [4. Overview](#4-overview)
- [5. Document model](#5-document-model)
  - [5.1. Operations](#51-operations)
  - [5.2. Schemas](#52-schemas)
  - [5.3. Bindings](#53-bindings)
  - [5.4. Sources](#54-sources)
  - [5.5. Dependencies](#55-dependencies)
- [6. Kinds](#6-kinds)
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
  - [10.4. Conformance conclusions](#104-conformance-conclusions)
- [11. IANA considerations](#11-iana-considerations)
- [12. Extensions](#12-extensions)
- [13. References](#13-references)
- [14. See also](#14-see-also)
- [Appendix A. Canonical serialization (informative)](#appendix-a-canonical-serialization-informative)

---

## 1. Positioning and scope

This specification defines an interface document model, not a client–server protocol or runtime API. An OBI may be authored and supplied independently of the software it describes. This specification does not require that software to publish, receive, or interpret the OBI.

OpenBindings operates one layer above protocol-specific interface specifications like OpenAPI, AsyncAPI, gRPC, and MCP. Those specifications describe how to interact with endpoints over a particular wire format. An OBI describes, at the layer above: protocol-independent operation contracts, concrete realizations declared through bindings, named operation dependencies the described component consumes, and the shared names by which those operations can be recognized.

Two stances define this specification's shape, and the rest of the document is read in their light:

**The operation contract is per-value.** An operation is a protocol-independent semantic unit with optional schemas for each value crossing its caller-facing input and output boundaries. It does not declare the number or lifecycle of those values; the selected binding determines the interaction pattern. A binding is an author-declared realization of the operation. OpenBindings conformance establishes the portable facts the document represents, not general semantic equivalence among an operation's bindings.

**OpenBindings enables invocation but does not define an invoker.** Bindings exist so downstream tools, invokers among them, can act on an operation's realizations; dependencies deliberately carry no concrete target. This specification defines the portable meaning of both relationships. It defines no binding-neutral invocation interface, requires no runtime contract enforcement, and leaves interaction mechanics and dependency satisfaction outside its scope ([§1.2](#12-out-of-scope), [§1.3](#13-scope-and-deferral)).

An OBI does not replace the artifacts its sources carry or point at, and a source may instead address a live surface without a separate artifact. A source's `kind` selects how the source and its bindings are read ([§6](#6-kinds)). What an OBI adds is the operation-level overlay that no single concrete interaction carries, in a form that holds across protocols.

### 1.1. Distinguishing features

- **One operation, many bindings.** A single operation contract can be realized over multiple protocols simultaneously without duplicating the contract.
- **One contract, either direction.** Bindings declare realizations of an operation; named dependencies declare where the described component consumes realizations, without splitting the operation registry into provider and consumer copies.
- **Vendor-independent correspondence.** An operation can adopt the name a shared contract publishes, so consumers recognize it by that shared name rather than by who runs the service (see [§5.1. Operations](#51-operations)).
- **Context-free references.** Every OBI-defined document reference is absolute or same-document, so a document's references resolve identically wherever it was obtained (origin, cache, redirect, stdin, or memory). Source and binding `content` is outside this rule ([§7](#7-reference-resolution)).
- **Offline-decidable conformance.** Every document rule in [§10.2](#102-document-rules) is decidable from the document and locally available resources; no rule's outcome depends on network state. A validator that lacks a capability a rule requires has not thereby established a document defect ([§10.4](#104-conformance-conclusions)).

### 1.2. Out of scope

OpenBindings does not:

- **Define kind-specific behavior or other formats.** A tool may read a source through OpenAPI, AsyncAPI, protobuf, MCP, a private format, or no artifact at all; this specification does not adopt any of their semantics merely because a source uses them.
- **Serve as an authoring language.** OBI is the target artifact, not a source format that compiles to multiple targets. Tools like TypeSpec and Smithy occupy that adjacent role.
- **Define an invoker.** Invocation lifecycle, runtime validation obligations, selection algorithms, retries, credential flow, sandboxing, and rate limiting are implementation concerns. The optional project-published operation-invoker interface defines one reusable invocation contract; nothing requires it.
- **Define a failure vocabulary.** An operation's `output` describes successful values only. Which interaction results count as success is read under the source's kind, and unsuccessful completion has no core value representation.
- **Define acquisition or publication.** An OBI may be obtained through any mechanism without changing its meaning (see [§1.4](#14-obtaining-an-obi)).
- **Define dependency composition.** Provider discovery, registration, compatibility checking, dependency satisfaction, lifecycle and readiness policy, and selection among eligible providers are implementation concerns. A dependency states only the portable consumption point and any kind constraint its author declares.
- **Maintain registries.** Kinds, correspondence names, and format conventions are author-assigned; this specification provides no registry or ownership test.
- **Specify integrity, signing, or attestation.** Supply-chain verification composes externally (see [Appendix A](#appendix-a-canonical-serialization-informative)).

### 1.3. Scope and deferral

This specification defines the document envelope and the operation's caller-facing value contract. It does not define the accepted contents of a source or binding, target identification, value adaptation, interaction mechanics, or which interaction results are successful; those matters are read under the source's kind ([§6](#6-kinds)). Wherever this specification says a matter is read under a source's kind, it marks this boundary: it neither asserts that a definition or implementation exists nor gives one authority over the document model.

Whether and when to invoke, whether to validate values at runtime, dependency composition, provider and binding selection, security posture, comparison and matching strategies, and operational choice are tool concerns.

### 1.4. Obtaining an OBI

Acquisition and publication are outside this specification. An OBI may be obtained through local files, packages, standard input, embedded resources, network retrieval, or any other mechanism without changing its meaning; no OBI-defined reference in the document resolves against the location it was obtained from ([§7](#7-reference-resolution)).

---

## 2. Core invariants

The rules in this specification instantiate six invariants. They are stated here once; document and tool rules cite them rather than restating them.

1. **Per-value contract.** Operation `input` and `output` schemas govern each value that crosses the operation's caller-facing boundary, one value at a time. Interaction pattern, cardinality, framing, completion, and lifecycle are read under the source's kind.
2. **Enabling, not invoking.** A binding declares a realization of its operation through a source; the document alone need not suffice to identify, reach, or act on a target. A dependency carries no target and becomes actionable only through tool-defined composition with a realization. No rule in this specification obligates a tool to invoke, satisfy a dependency, validate values at runtime because it invokes, or handle failures in a prescribed way. Rules about validation semantics apply to tools that claim the corresponding capability.
3. **Bounded interpretation.** The operation carries the caller-facing value contract. This specification defines neither the meaning of source or binding `content` nor the addresses, representations, references, value adaptation, interaction, and success classification a tool may use when acting on them. A kind does not change the meaning of core fields.
4. **Context-free references.** No OBI-defined reference ([§7](#7-reference-resolution)) resolves against the URI a document was fetched from, so the document model means the same thing however a document was obtained. Source and binding `content` are outside that reference rule (invariant 3). OBI assigns no document identity; `name` and `version` are labels.
5. **Offline-decidable conformance.** Document conformance is an objective property of the document, decidable from the document plus locally available resources (bundled meta-schemas included). No document rule's outcome depends on network state, so a document's conformance changes only when a patch release corrects the text it is judged under ([§8.1](#81-openbindings-field-specification-version)). A validator's inability to decide a rule is not itself evidence of non-conformance.
6. **Decentralized extension.** This specification assigns no authority over kinds or shared correspondence names. Nothing in the model requires a registry, and no kind is implicitly dereferenced to be understood.

---

## 3. Terminology

- **OBI**: shorthand for "OpenBindings interface document."
- **Tool**: any software that acts on OBI documents. A tool's obligations follow the capabilities it exercises, not a fixed class ([§10.1](#101-tool-obligations)); the rules of [§10.3](#103-tool-rules) are addressed to "a conformant tool."
- **Processor**: a tool that takes an OBI document as input. Its baseline capacity is reading (parsing, validating, indexing, or rendering), which it MAY extend with resolving references, validating values, resolving operation names, and acting on sources. Rules marked "(all processors)" bind every processor, including one that does no more than read; a processor that exercises further capabilities owes the rules this specification scopes to them. Acting on a source requires behavior for its kind, outside this specification ([§10.1](#101-tool-obligations)).
- **Operation**: a named protocol-independent capability contract with optional per-value input/output schemas. Stored under a key in the document's `operations` map. An operation is neutral as to whether the document binds it, depends on it, both, or neither. It is not a complete binding-independent invocation signature; it does not declare interaction pattern or cardinality.
- **Binding**: an author-declared realization of an operation through a source, optionally with content read under the source's kind. Stored under a key in the document's `bindings` map.
- **Dependency**: a named declaration that the described component consumes a realization of an operation, optionally constrained to one of a declared set of kinds. Stored under a key in the document's `dependencies` map. A dependency is not itself a realization or target.
- **Core**: this specification, as distinct from behavior for particular kinds.
- **Caller-facing**: on the operation's side of a binding. Caller-facing values are the ones a caller of the operation sends and receives, under its `input` and `output` contracts; how they correspond to the source interaction, including any adaptation between them, is read under the source's kind.
- **Realization**: a concrete way of carrying out an operation's contract through a target. In a document, a binding declares one, as its author's claim ([§5.3](#53-bindings)); a dependency consumes one supplied from elsewhere ([§5.5](#55-dependencies)).
- **Target**: what a binding is intended to act on under its source's kind: an entry in an artifact, a member of a live surface, or another form ([§5.3](#53-bindings), [§5.4](#54-sources)).
- **Interaction**: the exchange with a target that acting on a binding involves, such as a request and response, a stream, or a subscription. Its mechanics are outside this specification ([§1.3](#13-scope-and-deferral)).
- **Validator**: a processor that checks a document against the document rules of [§10.2](#102-document-rules) and reports what it established ([§10.4](#104-conformance-conclusions)).
- **Invoker**: a tool that acts on bindings to carry out operations. This specification defines none ([§1.2](#12-out-of-scope)).
- **Kind**: the exact, opaque, non-empty string a source carries in `kind` and a dependency may list in `kinds`. It is used to select an interpretation of a source and its bindings, not as a locator ([§6](#6-kinds)).
- **Source**: a kind together with optional content read under that kind (see [§5.4. Sources](#54-sources)). This specification does not say whether it carries or addresses an artifact, a live surface, both, or something a processor's environment provides.
- **Source artifact**: when an interpretation of a source uses one, a concrete representation such as an OpenAPI document, a `.proto` source, an operation graph, or an MCP endpoint's tool listing. It may be carried in or referenced from source `content`, or obtained otherwise; this specification prescribes none of these arrangements.
- **OBI position**: a place where the document model puts a schema: an operation's `input` or `output`, an entry in the `schemas` map, and every subschema reached from one of these through the locations the JSON Schema 2020-12 meta-schema validates as schemas, which include the legacy `definitions` and the schema values of `dependencies` (JSON Schema Validation Appendix A), without entering a schema that declares its own `$id`. Such a schema is at an OBI position, but the resource it declares, including that schema's own keywords other than `$id` and every schema within it, is that resource's own ([§7](#7-reference-resolution)). The **schemas the document contains** are the schemas at OBI positions and every subschema within the resources declared there.
- **Alias**: an additional name under which an operation is recognized, beyond its key. An operation's key plus its aliases form one flat, document-unique namespace of names that all resolve to that operation.

How these relate: an **operation** is the portable contract, independent of any protocol. A **source** carries a **kind** and optional `content`; a source artifact is optional. A **binding** links one operation to one source and may carry `content`, such as a target name or value adaptation, read under the source's kind. A **dependency** identifies a named point where the described component consumes an operation and may constrain the kinds acceptable there. An operation is addressable by its key or any of its **aliases**; both are equally valid for name resolution, while binding and dependency references use its key.

Cross-document correspondence is claimed by name adoption: an operation **corresponds to** a shared contract's operation by carrying that contract's operation name as its key or an alias. Adoption is an author assertion, detailed in [§5.1. Operations](#51-operations): it does not identify a particular contract document or version, and it does not establish compatibility, ownership, or substitutability. Whether one OBI is compatible with another is a matter of tool-defined comparison; this specification defines neither comparison nor matching semantics.

---

## 4. Overview

OpenBindings separates capability contracts (operations with per-value schemas) from declared realizations (bindings through sources) and named consumption points (dependencies). A single OBI can bind an operation over multiple protocols, depend on an operation, or do both without redefining the contract.

Terms used informally below are defined precisely in [Terminology]. OBI documents are JSON. JSON is chosen for properties that hold independent of any other OpenBindings decision: parser availability across every language and runtime including browsers, a stable syntax defined by RFC 8259, a low security surface compared to formats whose parsers evaluate tags or expressions on load, and a mature surrounding tool culture.

Every OBI declares a specification version and an operations map. The minimal conformant document is just those two fields:

```json
{
  "openbindings": "0.2.0",
  "operations": {}
}
```

An operation's presence alone declares a contract, not availability. A binding declares a realization of the operation through a source; a dependency declares a named consumption point for which a realization may be supplied through composition:

```json
{
  "openbindings": "0.2.0",
  "operations": {
    "events.deliver": {
      "input": { "type": "object" }
    }
  },
  "dependencies": {
    "customerDelivery": {
      "operation": "events.deliver",
      "kinds": [
        "example.openapi@1",
        "example.grpc@1"
      ]
    }
  }
}
```

An operation is the contract, a source carries the kind under which it and its bindings are read, and a binding links the two:

```json
{
  "openbindings": "0.2.0",
  "operations": {
    "createTask": {
      "input": {
        "type": "object",
        "properties": { "title": { "type": "string" } },
        "required": ["title"]
      },
      "output": {
        "type": "object",
        "properties": { "id": { "type": "string" } }
      }
    }
  },
  "sources": {
    "httpApi": {
      "kind": "example.openapi@1",
      "content": { "location": "https://example.com/openapi.json" }
    }
  },
  "bindings": {
    "createTask.http": {
      "operation": "createTask",
      "source": "httpApi",
      "content": { "target": "#/paths/~1tasks/post" }
    }
  }
}
```

The same operation can be realized over a second protocol by adding another binding against a different source. One contract, many bindings is the specification's primary abstraction:

```json
{
  "openbindings": "0.2.0",
  "operations": {
    "createTask": {
      "input": {
        "type": "object",
        "properties": { "title": { "type": "string" } },
        "required": ["title"]
      },
      "output": {
        "type": "object",
        "properties": { "id": { "type": "string" } }
      }
    }
  },
  "sources": {
    "httpApi": {
      "kind": "example.openapi@1",
      "content": { "location": "https://example.com/openapi.json" }
    },
    "mcpServer": {
      "kind": "example.mcp@1",
      "content": { "location": "https://example.com/mcp" }
    }
  },
  "bindings": {
    "createTask.http": {
      "operation": "createTask",
      "source": "httpApi",
      "content": { "target": "#/paths/~1tasks/post" }
    },
    "createTask.mcp": {
      "operation": "createTask",
      "source": "mcpServer",
      "content": { "target": "tools/create_task" }
    }
  }
}
```

A realistic OBI layers in shared schemas, binding content that also adapts a source's wire shape to the operation contract, and a qualified alias claiming correspondence with a published interface's operation:

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
    "httpApi": {
      "kind": "example.openapi@1",
      "content": { "location": "https://example.com/openapi.json" }
    },
    "mcpServer": {
      "kind": "example.mcp@1",
      "content": { "location": "https://example.com/mcp" }
    }
  },
  "bindings": {
    "createTask.http": {
      "operation": "createTask",
      "source": "httpApi",
      "content": {
        "target": "#/paths/~1tasks/post",
        "outputTransform": "{ \"id\": task_id, \"title\": task_title, \"done\": is_done }"
      }
    },
    "createTask.mcp": {
      "operation": "createTask",
      "source": "mcpServer",
      "content": { "target": "tools/create_task" }
    },
    "listTasks.http": {
      "operation": "listTasks",
      "source": "httpApi",
      "content": {
        "target": "#/paths/~1tasks/get",
        "outputTransform": "[$.{ \"id\": task_id, \"title\": task_title, \"done\": is_done }]"
      }
    }
  }
}
```

Here `target` and `outputTransform` illustrate one possible reading of `example.openapi@1`; everything inside a binding's `content` is read under its source's kind ([§5.3](#53-bindings)).

---

## 5. Document model

An OBI document is a JSON object. Top-level fields:

| Field          | Type   | Required | Purpose                                                                                                                            |
| -------------- | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `openbindings` | string | yes      | Specification version the document declares (SemVer).                                                                              |
| `name`         | string | no       | Human-friendly label. Not an identifier.                                                                                           |
| `version`      | string | no       | Interface-version label, opaque to this specification ([§8.2](#82-version-field-interface-version-label)). Non-empty when present. |
| `description`  | string | no       | Human-friendly description.                                                                                                        |
| `schemas`      | object | no       | Map of schema names to JSON Schemas.                                                                                               |
| `operations`   | object | yes      | Map of operation keys to operation objects.                                                                                        |
| `dependencies` | object | no       | Map of dependency keys to dependency objects.                                                                                      |
| `sources`      | object | no       | Map of source keys to source objects.                                                                                              |
| `bindings`     | object | no       | Map of binding keys to binding objects.                                                                                            |

**Names.** All map keys this specification defines (operation, dependency, binding, source, schema, and example keys) and all operation aliases MUST match the pattern `^[A-Za-z0-9_][A-Za-z0-9_.-]*$` ([OBI-D-03](#102-document-rules)). Names are opaque ASCII tokens compared by exact, case-sensitive string equality: processors do not trim, case-fold, Unicode-normalize, or otherwise rewrite them. Dot and hyphen carry no structural semantics; a dot may be used by authoring convention to qualify a shared name ([§5.1](#51-operations)), but nothing in this specification parses the segments. Names are not URIs, paths, or native programming-language identifiers merely because their spelling resembles one; code generators apply their own deterministic naming policy. The grammar permits a leading digit (`2fa.verify`) for the same reason: names are data labels, not host-language identifiers, and excluding spellings that only some target languages reject would push one ecosystem's lexical rules into every document. The pattern is an [ECMA-262](#131-normative-references) regular expression, as patterns are in JSON Schema: it must match the whole name, so a name with a trailing newline does not match. Keys within one map are distinct because a document repeats no member name ([OBI-D-01](#102-document-rules)); operation keys and aliases also share one namespace ([OBI-D-04](#102-document-rules)).

**Value representation.** Operation inputs and outputs are described in terms of the JSON data model per [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259). How that representation corresponds to the data of a source interaction is read under the source's kind. This does not prescribe the data types a tool uses internally or exposes through its own APIs, nor require it to materialize JSON text. The applicable schema governs interpretation of the described values at the operation boundary; tool obligations remain scoped to the capabilities exercised ([§10.1](#101-tool-obligations)).

### 5.1. Operations

An operation is a protocol-independent semantic unit with optional schemas for each value crossing its caller-facing input and output boundaries (invariant 1). Whether an interaction is request/response, streaming, bidirectional, or pub/sub is determined by the selected binding, not by the operation. When a binding carries more than one value, the `input`/`output` schemas describe **one value** at a time as it crosses the operation boundary, never a collected aggregate of the interaction.

An operation whose successful values vary in shape (multiple event types on a streaming binding, a union of representations) expresses the variation as JSON Schema alternation (`oneOf`, `anyOf`) in `output`; each successful value validates against the alternation. Alternation in `output` never models failure outcomes: `output` describes successful values only, and which values of a binding are successful is read under its source's kind ([§1.2](#12-out-of-scope)).

An operation object MAY contain:

| Field         | Type                  | Purpose                                                            |
| ------------- | --------------------- | ------------------------------------------------------------------ |
| `description` | string                | Human-readable description.                                        |
| `deprecated`  | boolean               | Hint that consumers should migrate away from the operation.        |
| `tags`        | array of strings      | Documentation labels for grouping/filtering.                       |
| `aliases`     | array of strings      | Additional names, equal in standing to the operation's key.        |
| `idempotent`  | boolean               | Author-attested effect claim; see below.                           |
| `input`       | JSON Schema or absent | Contract on each caller-facing input value.                        |
| `output`      | JSON Schema or absent | Contract on each successful caller-facing output value.            |
| `examples`    | object                | Map of example names to `{description?, input?, output?}` objects. |

**Schema states.** `input` and `output`, when present, contain a JSON Schema 2020-12 object or boolean schema ([§5.2](#52-schemas)). Omission is the sole representation of an unspecified contract; literal `null` is not a valid value at either position. The states are deliberately distinct:

| Form               | Meaning                                                           |
| ------------------ | ----------------------------------------------------------------- |
| field absent       | No contract is specified for that boundary.                       |
| `{}` or `true`     | A contract is specified; every JSON value satisfies it.           |
| `false`            | A contract is specified; no JSON value satisfies it.              |
| `{"type": "null"}` | A contract is specified; only the JSON value `null` satisfies it. |

Absence means the document makes no portable claim at that boundary: not that the interaction carries no values, and not that every value is accepted. `false` is an impossible **value** contract (no value crossing the boundary can satisfy it), not a cardinality declaration: a binding whose interaction carries no input values can realize an operation with `input: false`. This specification prefers `{}` for the always-valid contract in its examples; `true` is the equivalent native spelling.

**Contract directions.** The `input` and `output` schemas are caller-facing contracts running in opposite directions. `input` states that a realization accepts at minimum every value validating against it and may accept more; a caller sending any value validating against `input` is honoring the input contract. `output` states that every successful value produced by a realization validates against it, and the realization may produce a narrower set; a caller receiving a successful value relies on it validating against `output` exactly as far as it trusts the document's claims. A binding attests that its concrete target realizes this contract; a dependency declares that the described component consumes a realization of it. The operation alone does not assert that any realization is available.

**Aliases and correspondence.** An operation's **identifiers** are its key plus its aliases, sharing one flat namespace: every identifier is equally valid for resolving the operation, and the choice of key versus alias carries no semantic weight beyond the key being the operation's primary name for display, logging, and same-document relationship references (the value bindings and dependencies carry in their `operation` fields). The namespace is document-unique across all operation identifiers ([OBI-D-04](#102-document-rules)): an identifier MUST NOT collide with any other identifier in the document, an alias MUST NOT equal its own operation's key, and an operation's aliases MUST be distinct from one another. Any identifier resolves to at most one operation, and tools resolve names identically per [OBI-T-07](#103-tool-rules).

Common uses of `aliases`: a prior name kept for continuity after a rename, a vendor-specific name some consumers look up by, or a shared contract's operation name. The last is the correspondence claim of [§3. Terminology](#3-terminology): by adopting a published identifier as its key or an alias, the operation **claims correspondence with** the published operation. The claim is an author assertion: it identifies no particular contract document or version, establishes no schema compatibility, behavioral equivalence, ownership, or trust, and no rule in this specification verifies it. Consumers that require compatibility compare the operation against a reference OBI of their choosing, under their own policy.

Because the identifier namespace is document-unique, two adopted names that collide cannot coexist in one document; publishers of identifiers intended for adoption avoid this by qualifying them under a namespace they control, with enough interface scope (`acme.tasks.createTask` rather than `create`). Dotted qualification is a convention; the specification constrains only the name syntax ([OBI-D-03](#102-document-rules)). A published identifier is useful for correspondence only while it names one continuing semantic operation, and giving an intentionally incompatible replacement a new identifier keeps it so. The cost of ignoring either convention falls on the publisher whose names collide or silently change meaning, not on documents or tools.

**Idempotency.** `idempotent: true` is an author assertion that repeating the operation with equivalent input under the same relevant execution context produces no additional intended operation-level effects after the first application. `idempotent: false` asserts the opposite: some valid repetition can produce additional intended effects. Absence makes no claim in either direction.

The claim concerns intended operation-level effects, not equality of returned values, errors, timing, or other per-attempt observations: a read of changing state can be idempotent while returning different values; repeated deletion can be idempotent though later attempts report absence. Idempotency does not imply that the operation is safe, read-only, deterministic, cacheable, or harmless, and does not assert that authorization, billing, or audit effects repeat without consequence. Attaching a binding to the operation asserts that it honors the operation-level claim under the equivalent conditions ([§5.3](#53-bindings)); the field does not itself authorize switching bindings between attempts. An invocation policy MAY consider the field but cannot derive retry safety from it alone. Its semantic truth is author-attested: structural validity is enforced, while an assessment of its factual accuracy is outside document conformance ([OBI-T-10](#103-tool-rules)).

**Examples.** `examples` holds named, author-supplied sample values: each entry MAY provide `description`, `input`, and `output`. Examples are **positive** claims about the caller-facing contract: the author asserts that each provided value validates against the corresponding operation schema, where that schema is specified. Like `idempotent`, the claim is the author's. A tool that checks it evaluates the value as any other value ([§5.2](#52-schemas)), and what it finds is not a document-rule verdict. The schema is authoritative; an example never widens, narrows, or overrides it, and a tool MUST NOT resolve a mismatch by treating the example as an exception ([OBI-T-11](#103-tool-rules)).

Example members are instance values, not schemas, so presence is distinct from value: an absent `input`/`output` member supplies no value, while an explicitly `null` member supplies the JSON value `null`, which the claim covers like any other value; otherwise an operation whose `output` is `{"type": "null"}` could carry no example. Examples make no claim beyond schema membership: no binding is selected or acted on, and a valid example pair does not establish that its output can result from its input.

### 5.2. Schemas

The top-level `schemas` map holds named JSON Schemas. Operations reference them via `$ref` (e.g., `{"$ref": "#/schemas/Task"}`).

Every schema in an OBI document is a [JSON Schema 2020-12](https://json-schema.org/draft/2020-12) schema, in object or boolean form (`true` accepts every value; `false` accepts none; `{}` is equivalent to `true`), and MUST be valid against the 2020-12 meta-schemas ([OBI-D-10](#102-document-rules)): a value occupying a schema position that is not a schema, such as `{"type": 42}`, is a document defect. A `$schema` keyword MAY be omitted; absence means 2020-12. When `$schema` is present, its value MUST be `https://json-schema.org/draft/2020-12/schema` or the same with an empty fragment (`…/schema#`) ([OBI-D-06](#102-document-rules)). A schema obtained by resolving a reference to an external URI follows its own declared dialect.

Beyond this section and the reference forms of [§7](#7-reference-resolution), JSON Schema 2020-12 governs the document's schemas: what they mean, how their references resolve, and how values are evaluated against them. This specification defines no keyword and no evaluation of its own. The document rules test the schemas only for meta-schema validity (OBI-D-10) and for the reference forms and dialect of OBI-D-05 and OBI-D-06. JSON Schema's other requirements, such as where `$schema` may appear, and conditions that arise at evaluation, such as a reference that cannot be resolved or a regular expression an engine cannot compile, are JSON Schema's: they surface when a tool uses the schema and create no document-rule violation.

**Validation semantics.** Nothing in this specification requires any tool to validate values against operation schemas (invariant 2). A tool that claims to check a value against an operation's contract evaluates it under JSON Schema ([OBI-T-08](#103-tool-rules)): the document's schemas under 2020-12, and an externally referenced schema under the dialect it declares. The schemas apply to each value individually as it crosses the operation boundary, even when an interaction carries more than one value (invariant 1). If an external resource or required evaluation capability is unavailable, that limitation establishes neither a match nor a mismatch. A tool that only preserves schemas through round-trips need not interpret them; a tool claiming to derive a contract from a schema answers for the scope of that claim ([OBI-T-05](#103-tool-rules)).

### 5.3. Bindings

A binding object MUST contain:

| Field       | Type   | Purpose                                   |
| ----------- | ------ | ----------------------------------------- |
| `operation` | string | Key into the document's `operations` map. |
| `source`    | string | Key into the document's `sources` map.    |

And MAY contain:

| Field         | Type           | Purpose                                                                   |
| ------------- | -------------- | ------------------------------------------------------------------------- |
| `content`     | any JSON value | Content read under the source's kind.                                      |
| `preference`  | integer        | Author preference signal among bindings of the same operation; see below. |
| `description` | string         | Human-readable description.                                               |
| `deprecated`  | boolean        | Author recommends migration away from this binding.                       |

A binding's `content` is read under its source's kind. It might identify the target that realizes the operation (an entry in an artifact or a member of a live surface) or describe how values are adapted between the operation's contract and that target. Possible readings include a JSON Pointer into an OpenAPI document, a fully qualified gRPC method name with a value mapping, or an MCP tool name. Its presence, absence, type, and members carry no core meaning. As with a source's `content` ([§5.4](#54-sources)), presence is distinct from value: `content: null` is present content, and only omitting the member omits it.

**Realizations.** Multiple bindings MAY reference the same operation. Each is an author-declared realization of the operation: attaching several bindings asserts that each realizes the same logical capability and that each honors every portable fact the operation represents: its per-value schemas and its operation-level claims such as `idempotent`. The assertion's truth is author-attested, like `idempotent` itself ([§5.1](#51-operations)): a binding that does not honor the represented facts makes the document's claim false, which no structural rule detects. A caller interacts with the operation through any one of its bindings; using one binding is a complete use of the operation. OpenBindings does not prove semantic equivalence or mechanical interchangeability among realizations beyond the represented facts (invariant 1); a caller that requires a particular interaction pattern constrains or inspects binding selection.

**Preference signals.** `preference` is an optional signed integer from -9007199254740991 through 9007199254740991 (the exactly representable interoperable range). Integer means a number with no fractional part, however it is written: `1.0` and `1` are the same preference. Among bindings for the same operation that declare it, a higher value expresses stronger author preference; equal values express no ordering through this field. Omission states no preference and is not equivalent to zero or any other value; zero and negative values have no privileged meaning beyond numeric order. `deprecated: true` states that the author recommends migration away from the binding and ordinarily does not recommend it for new use; deprecation does not remove the binding or change what it declares. The two signals are independent dimensions (lifecycle guidance and relative choice), and this specification mandates no ordering relationship between them.

OpenBindings defines no binding-selection algorithm (invariant 2). Whether and how these signals shape selection is up to tools; explicit caller choice and tool policy may override both, and candidate construction, filtering, fallback, and tie-breaking are tool concerns. A tool or interface that offers automatic selection documents its own policy; the project's optional operation-invoker interface is one place such a policy can live.

### 5.4. Sources

A source object MUST contain:

| Field  | Type   | Purpose                                                                |
| ------ | ------ | ---------------------------------------------------------------------- |
| `kind` | string | The source's kind: an exact, opaque, non-empty string. See [§6](#6-kinds). |

And MAY contain:

| Field         | Type           | Purpose                                                                  |
| ------------- | -------------- | ------------------------------------------------------------------------ |
| `content`     | any JSON value | Content read under the source's kind.                                    |
| `description` | string         | Human-readable description.                                              |

A source's `kind` selects how its `content` and its bindings' `content` are read ([§5.3](#53-bindings), [§6](#6-kinds)). The optional `content` might embed an artifact, address one, address a live service, name something a processor's environment provides, or combine these. No JSON type or member within it has a generic core meaning: an object is not thereby "the parsed artifact", nor a string "an address" or "UTF-8 source text". Naming a kind does not make a source retrievable, resolvable, or actionable by any given tool. JSON has no binary primitive; how a binary artifact is encoded in `content` is read under the kind.

Member **presence** is distinct from member value: `content: null` carries the JSON value `null` and is a present member; only omitting the member omits content. Implementations therefore track presence rather than testing for nullish values.

**Target identity.** How a binding's target is identified is read under the source's kind: from the binding and source alone, or with configuration, runtime naming, or other state. The document alone need not suffice to identify, reach, or use a target (invariant 2); whether a processor can act on a binding depends on its support for the kind and what it has, not on document conformance.

### 5.5. Dependencies

A dependency is a named declaration that the component described by the OBI consumes a realization of an operation. The dependency's map key identifies the local consumption point for configuration, wiring, and diagnostics; it does not identify a provider, create another operation, or participate in the operation-identifier namespace.

A dependency object MUST contain:

| Field       | Type   | Purpose                                    |
| ----------- | ------ | ------------------------------------------ |
| `operation` | string | Key into the document's `operations` map. |

And MAY contain:

| Field         | Type             | Purpose                                     |
| ------------- | ---------------- | ------------------------------------------- |
| `kinds`       | array of strings | Kinds acceptable at this consumption point. |
| `description` | string           | Human-readable description.                 |

`operation` references an operation by its key, not by an alias ([OBI-D-11](#102-document-rules)). This is the same key-reference posture bindings use: aliases support name resolution and cross-document correspondence, while same-document relationships carry the canonical key.

When `kinds` is present, it MUST contain one or more unique kinds. Each is an exact, opaque, non-empty string with the semantics of [§6](#6-kinds); array order has no meaning. The list is an **any-of constraint**: a binding considered for this dependency meets the declared kind constraint if and only if its referenced source's `kind` exactly equals at least one listed kind. Whether a processor supports that kind does not change the result of this comparison. When `kinds` is absent, the dependency declares no kind constraint. Absence does not mean that every binding is usable by a particular runtime, and presence does not assert that any listed kind is supported.

The kind test is only one constraint. This specification does not define how candidate provider operations are discovered, whether their contracts are compatible, which realization is selected, or how the selected target is registered, configured, authenticated, or monitored. Correspondence may be author-asserted through operation names as described in [§3](#3-terminology); candidate matching and compatibility remain tool-defined. A processor may be unable to act on a binding whose kind meets this constraint ([OBI-T-01](#103-tool-rules)). A dependency therefore carries no concrete target and is not actionable by itself.

Multiple dependencies MAY reference the same operation, including with different `kinds` constraints. An operation MAY also have both one or more bindings and one or more dependencies: the bindings declare realizations of it, while each dependency declares a separate consumption point. With neither relationship, an operation is a contract declaration only.

A dependency declaration says nothing about when the consuming behavior runs or what happens when no realization is supplied. An unsatisfied dependency does not make the OBI non-conformant and does not by itself show that the described component is unavailable or unhealthy; startup requirements, feature availability, conditional use, readiness, and failure behavior are application and deployment policy.

---

## 6. Kinds

Every source has a `kind`: an exact, opaque, non-empty string naming how the source and its bindings are read. A dependency may list the kinds it accepts in `kinds` ([§5.5](#55-dependencies)).

**Comparison.** Kinds are compared as whole strings, by exact equality ([OBI-T-01](#103-tool-rules)), so two different strings are two unrelated kinds. A kind has no internal structure: dots, `@`, and version-like suffixes are simply part of the string, and a URI-shaped kind is a name, never implicitly dereferenced.

**Interpretation.** Supporting a kind means knowing how to read the `content` of its sources and their bindings for whatever work a tool does with them, such as identifying a target, carrying out the interaction, adapting values at the operation boundary, or telling success from failure. That knowledge may be built into a tool, supplied by a plugin, or configured locally, and it may be written down or exist only in code. A document conforms whether or not any tool supports its kinds, and a tool may preserve, index, or display a source whose kind it does not support.

**Sharing a kind.** A kind is portable as far as its meaning is shared. Authors who want independent tools to agree on a kind describe it in writing and give an incompatible meaning a new kind, since a document offers tools no way to tell two meanings of one kind apart. A kind meant to circulate widely can be qualified under a name its publisher controls. These are interoperability practices, not conformance requirements. Matching a kind establishes neither provenance nor authorization ([§9](#9-security-considerations)).

A locally built CLI consuming a private artifact might use:

```json
{
  "kind": "my-cli.usage@1",
  "content": { "location": "file:///home/user/project/usage.kdl" }
}
```

Only software that supports `my-cli.usage@1` gives that `content` meaning.

---

## 7. Reference resolution

OBI documents define no `id` field, and no OBI-defined reference in them resolves against the URI a document was fetched from, so a document's references resolve identically however it was obtained: from its origin, a cache, a redirect, stdin, or an in-memory object (invariant 4).

The **OBI-defined document references** are the schema references at OBI positions: each `$ref` and `$dynamicRef`. JSON Schema 2020-12 lets the format that embeds a schema determine its initial base URI (§9.1.1). An OBI document's schemas take no base URI from where the document was obtained: the document itself is their embedding document, so a same-document reference such as `#/schemas/Task` addresses a location in the document, read as an [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) JSON Pointer from the document root. At an OBI position, `#` therefore names the OBI document itself, not the schema that contains it. JSON Schema also leaves to the embedding format how its schemas fit its resource model (§4.3.5): the schemas at OBI positions that declare no `$id` are subschemas of one schema resource, the document's, whose base is unique to the document and drawn from nowhere else (RFC 3986 §5.1.4). The plain names they declare with `$anchor` or `$dynamicAnchor` belong to that resource, and an evaluation that begins at one of them begins in it, which makes that resource the outermost in its dynamic scope. A schema that declares `$id` begins a resource of its own. Every schema `$ref` and `$dynamicRef` at an OBI position is therefore an absolute URI or a same-document reference (empty, or a fragment alone, RFC 3986 §4.4), and every schema `$id` at an OBI position is an absolute URI ([OBI-D-05](#102-document-rules)). In this specification an absolute URI is a URI with a scheme (RFC 3986 §3), and it may carry a fragment; RFC 3986's `absolute-URI` production, which excludes fragments, is not what is meant.

Otherwise, resolution follows JSON Schema 2020-12. A `$id` establishes a schema resource and the base for the references within it, which take any form JSON Schema allows; plain-name fragments, dynamic references, and references to external schemas resolve as JSON Schema defines. Where JSON Schema leaves the result undefined, so is the reference's meaning in an OBI, though the document still conforms: a pointer that reaches no schema, including `#` at an OBI position (§9.4.2); a URI two schemas declare as `$id` (§9.1.2); and a plain name declared twice in one resource (§8.2.2), which the shared resource above makes possible across `schemas` entries.

A source's or binding's `content` is **not** an OBI-defined document reference. It is read under the source's kind ([§5.3](#53-bindings), [§5.4](#54-sources)) and is exempt from the absolute-or-same-document requirement.

A consequence (informative): a JSON Schema library reads `schemas`, `operations`, and the document's other members as unknown keywords, so it neither finds the `$id`s and anchors at OBI positions nor reliably resolves pointers into them (JSON Schema 2020-12 §9.4.2). A tool therefore locates those identifiers itself, as OpenAPI requires of its tools, and presents the document's schemas to its library in a form the library resolves. Evaluating an operation's schema in isolation, without the rest of the document, leaves its references to the document's other schemas unresolved and, where the schema declares no `$id`, reads its same-document references from the wrong root.

A tool MAY decline to obtain external resources; a document whose schema references all resolve within it needs no network access to resolve them. Declining an external resource needed to evaluate a particular value prevents a validation verdict for that value ([OBI-T-08](#103-tool-rules)); it does not make the OBI document non-conformant.

Schema `$ref` cycles are permitted: recursive types (trees, linked lists, ASTs) are legitimate and widespread, and a cycle by itself does not make a reference invalid ([OBI-T-06](#103-tool-rules)).

---

## 8. Versioning

OBI documents carry two independent version concepts: the specification version the document is written against, and an author-controlled label for the interface itself.

### 8.1. `openbindings` field (specification version)

The `openbindings` field identifies the version of this specification the document declares. The value MUST be a [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) string ([OBI-D-09](#102-document-rules)).

**Lines.** A document is interpreted under the `major.minor` line its version names. Each line is one document model: a patch release corrects errors in this text without adding fields or changing what documents mean. The patch number a document declares therefore carries no meaning, and documents declaring `0.2.0` and `0.2.1` are read alike, under the line's current text.

**Processing.** A processor supports lines, not individual patches, and interprets a document under OpenBindings semantics only when it supports the document's line ([OBI-T-04](#103-tool-rules)). Any other version produces a **version refusal** rather than interpretation under another line's rules. Supporting one line implies nothing about another: from 1.0.0 onward a new minor is backward-compatible with documents written to the previous minor, while pre-1.0 minors MAY break (see the release policy below), and in either regime backward compatibility is not forward comprehension.

- A prerelease (`0.2.0-rc.1`) is not part of its line: it is a distinct, potentially incompatible draft, supported only when a processor explicitly includes it.
- Build metadata is permitted, has no OpenBindings semantics, and is ignored when determining support: `0.2.0+build.1` denotes the same line as `0.2.0`.
- Version refusal prohibits unsupported semantic interpretation; it does not require failure before JSON parsing. A processor MAY parse, preserve, display, or route an unsupported document. Refusal is distinct from document non-conformance, since the document may conform to the version it declares.
- A document whose `openbindings` member is absent, not a string, or not a SemVer version declares no version, so there is nothing to refuse: it violates OBI-D-09, and a validator reports that non-conformance under the rules of a line it supports.
- Unknown fields have no core meaning under a supported line ([OBI-T-02](#103-tool-rules)); that rule does not authorize interpreting an unsupported line by ignoring its additions.

**Release policy (project).** While pre-1.0, minor versions MAY include breaking changes, per pre-1.0 SemVer convention. A patch release only corrects this text: it defines no new field and changes no document's meaning, and its corrections apply to the whole line. Changes to the core's provisions for source `content`, binding `content`, or caller-facing values are recorded in the changelog as breaking changes to this specification. This is a commitment about this specification's own provisions, not a compatibility judgment about external behavior. Declaring the earliest line sufficient for a document's content maximizes the processors able to interpret it.

### 8.2. `version` field (interface-version label)

The optional `version` field is a non-empty, opaque, author-controlled label for the described interface. It is opaque to this specification: no ordering, comparison, Semantic Versioning, compatibility, identity, resolution, selection, or refusal semantics attach to it, and tools may preserve, display, index, or group by its exact value. Authors MAY use SemVer, dates, or any other convention; any stronger interpretation comes from an external catalog, registry, or organizational policy.

| Field          | Meaning                                                                                |
| -------------- | -------------------------------------------------------------------------------------- |
| `openbindings` | Version of this specification governing document interpretation and processor support. |
| `version`      | Author-controlled label for the described interface; opaque to this specification.     |

---

## 9. Security considerations

Processing OBI documents involves parsing untrusted JSON, optionally obtaining external artifacts and schemas, resolving references, and acting on `content` that may include author-supplied expressions. The threat surface is comparable to JSON Schema processors and artifact-consuming tools generally: SSRF, resource exhaustion, untrusted code evaluation, and content confusion.

The document format creates the following exposure:

- **URIs as attack vectors.** Addresses a tool reads from a source's or binding's `content`, and schema `$ref` values, may resolve to arbitrary network endpoints, including internal or link-local addresses such as `http://169.254.169.254/...` or `file:///etc/passwd`. Unrestricted dereferencing inherits SSRF and exfiltration exposure.
- **Unbounded size.** The specification imposes no size cap on OBI documents or on the artifacts and schemas they reference. Untrusted input creates memory and processing-time exhaustion exposure.
- **Regular-expression cost.** Schema `pattern` and `patternProperties` values run on the evaluating tool's regular-expression engine; a backtracking engine can take exponential time on crafted input.
- **Schema `$ref` cycles.** Permitted by [§7](#7-reference-resolution); naive resolvers can exhaust the stack or loop indefinitely.
- **Executable content.** A tool may interpret expressions or other executable material within `content`. Untrusted documents can embed expressions designed to run without bound or to reach host state; evaluation environment and limits are per-tool policy.
- **Dependencies are not trust claims.** A matching operation name or kind establishes neither provider authenticity nor authorization. Composition tooling that discovers or selects a provider inherits the risks of acting on untrusted interface metadata and applies its own trust, credential, and network policy before use.
- **Integrity is out of scope.** The specification defines no signing, attestation, or integrity verification. Authenticity and integrity are established by external means (transport security, content signing, out-of-band attestation) or not at all; [Appendix A](#appendix-a-canonical-serialization-informative) names a deterministic serialization such systems can build on.

Mitigation strategies are processor concerns; the specification does not mandate mitigation policy.

### 9.1. Recommended mitigations (informative)

Non-normative categories of mitigation that tools processing OBI documents from untrusted origins typically consider; specific limits and defaults depend on deployment.

- **Scheme allow-list** for URI dereferencing. Rejecting `file://`, `data:`, and schemes outside an explicit allow-list by default is common practice.
- **Network-range restrictions.** Refusing to dereference URIs resolving to link-local (`169.254.0.0/16`, `fe80::/10`), loopback (`127.0.0.0/8`, `::1`), private (RFC 1918, `fc00::/7`), or carrier-grade NAT (`100.64.0.0/10`) ranges by default, with explicit operator opt-in. A complete treatment checks the IANA special-purpose registries, normalizes IPv4-mapped IPv6 forms before comparison, and applies the check after DNS resolution, per redirect hop.
- **Size caps** on fetched documents, schemas, and source artifacts.
- **Timeouts** on fetches and on evaluating any expressions `content` carries.
- **Linear-time regular expressions**, or time limits on matching, for schema patterns.
- **Expression isolation.** Where a tool evaluates expressions in `content`, doing so without host access and with bounded time and memory.
- **Transport security.** Enforcing TLS for non-loopback origins; distinguishing the URI a document was requested at from the URI a redirect resolved to when deriving any cache key (this specification defines no canonical identity, and no OBI-defined reference resolves against either URI; an external schema's own references follow JSON Schema).
- **Reference-cycle detection.** Bounding traversals through recursive schemas and through any transitive references a tool follows in `content`.

---

## 10. Conformance

The normative shape of an OBI document is defined by this specification's prose. The accompanying `openbindings.schema.json` expresses the structural portion of that prose in JSON Schema form. It is derived from the prose, and OBI-D-02 applies it as published, with its `pattern` values read as ECMA-262 regular expressions, as JSON Schema 2020-12 intends: for OBI-D-02 the published schema is the test, so every validator applying it that way reaches the same verdict. A disagreement between the schema and the prose is an erratum, corrected in the schema; until it is corrected, the published schema decides OBI-D-02. Schema validation (OBI-D-02) is necessary but not sufficient for document conformance: some rules (the document-unique identifier namespace of OBI-D-04, the reference forms of OBI-D-05, the dialect of OBI-D-06 at every depth, binding and dependency referential integrity under OBI-D-07/08/11, and meta-schema validity under OBI-D-10) require walking the document beyond what the derived schema expresses.

Each rule carries an identifier (`OBI-D-##` document rules, `OBI-T-##` tool rules) so validators, test suites, and errata can cite it. An identifier means what the line of this specification that states it says it means: a rule is cited under a line, as a document is interpreted under the line its version names ([§8.1](#81-openbindings-field-specification-version)), and another line may number its rules differently. A patch release adds and renumbers no rule.

### 10.1. Tool obligations

A tool's obligations follow the capabilities it exercises, not a fixed class. A tool that only parses, validates against the document rules, indexes, or renders OBI documents owes the rules marked _all processors_. A tool that also resolves references, validates values against operation contracts, or resolves operation names additionally owes the rules scoped to those activities. How a tool acts on a source is outside this specification, and invoking a binding, by itself, triggers no additional core rule (invariant 2).

There is no central registry of tool capabilities. A conformance test corpus is published as reference material (not part of this specification); a rule without fixtures is no less binding.

**Implementer map (informative).** The following is a dependency map into the normative rules, not a required class hierarchy or one mandatory processing pipeline. A tool performs only the rows for capabilities it claims. A processor interprets the document under this version's semantics only when OBI-T-04 permits it; no processing order is prescribed.

| Capability checkpoint | Normative entry points | Boundary to preserve |
| --------------------- | ---------------------- | -------------------- |
| Accept document bytes or text | OBI-D-01 | Preserve the exact input through duplicate-key, UTF-8, and BOM checks; a normalized host object can no longer prove this rule. |
| Decide whether this specification applies | OBI-D-09, OBI-T-04, [§8.1](#81-openbindings-field-specification-version) | Version refusal is distinct from document non-conformance and prohibits interpretation under a different version. |
| Validate document conformance | OBI-D-02 through OBI-D-11, [§10.4](#104-conformance-conclusions) | A positive conformance claim needs every applicable document rule; a partial check is scoped to what it established. |
| Resolve an operation identifier | OBI-T-07, [§5.1](#51-operations) | Resolve keys and aliases in one flat namespace, then use the canonical operation key to find bindings. |
| Index a dependency declaration | OBI-D-03, OBI-D-11, [§5.5](#55-dependencies) | Preserve its local dependency key, resolve `operation` only as an operation key, and treat `kinds` as an optional exact-match any-of constraint. |
| Resolve schema references | OBI-D-05, OBI-T-06, [§7](#7-reference-resolution) | Resolve references at OBI positions against the document, never the location it was obtained from; within an `$id` resource and in external schemas, follow JSON Schema's bases; a reference cycle is permitted. |
| Validate operation-boundary values | OBI-T-08, [§5.2](#52-schemas) | Validation is optional until claimed; once claimed, apply the governing JSON Schema dialect to each value without changing its keyword semantics. |
| Check examples | OBI-T-11, [§5.1](#51-operations) | Examples are author claims; a mismatch is a finding about the claim, not a document-rule violation, and never an exception to the schema. |
| Resolve or act on a binding target | The source's kind ([§6](#6-kinds)) | Core defines the envelope; source and binding `content`, target identity, value adaptation, and interaction mapping are read under the source's kind; invocation behavior is outside this specification. |

Invocation is intentionally absent as a universal checkpoint: selecting or invoking a binding does not itself imply schema validation, automatic selection, retry policy, or full document validation. Those obligations attach only when the corresponding capability is exercised or claim is made.

### 10.2. Document rules

Document rules bind the document; deciding a clause takes capabilities. A validator that lacks a capability a clause requires (a duplicate-detecting parse for OBI-D-01) has not thereby established that the document violates it: conformance is a property of the document, not of any validator ([§10.4](#104-conformance-conclusions)).

A conformant **OBI document**:

- **OBI-D-01**: Is valid UTF-8 encoded JSON per [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259). Duplicate JSON object keys within any object make the document non-conformant. A leading byte-order mark makes the document non-conformant: RFC 8259 §8.1 forbids adding one, interoperable-JSON practice ([RFC 7493](https://www.rfc-editor.org/rfc/rfc7493)) excludes it, and tolerating it would let two parsers disagree over the same bytes. Validation note (informative): most JSON parsers silently keep one duplicate value, so checking the duplicate clause requires a duplicate-detecting parse; a validator whose parser cannot surface duplicates cannot establish whether the clause holds.
- **OBI-D-02**: Validates against the derived JSON Schema published with this specification (`openbindings.schema.json`, `$id` `https://openbindings.com/schema/openbindings-0.2.0.json`).
- **OBI-D-03**: Has every map key this specification defines (operation, dependency, binding, source, schema, and example keys) and every operation alias matching `^[A-Za-z0-9_][A-Za-z0-9_.-]*$`. Property names inside JSON Schema objects are schema content, not map keys, and are unconstrained by this rule.
- **OBI-D-04**: Has no collision between any two operation identifiers within the document, where an operation's identifiers are its key plus any entries in its `aliases` array.
- **OBI-D-05**: Has every schema `$ref` and `$dynamicRef` at an OBI position an absolute URI or a same-document reference, and every schema `$id` at an OBI position an absolute URI, each a URI-reference per [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) §4.1 ([§7](#7-reference-resolution)).
- **OBI-D-06**: Has every `$schema` in a schema the document contains ([§3](#3-terminology)) equal to `https://json-schema.org/draft/2020-12/schema` or `https://json-schema.org/draft/2020-12/schema#`.
- **OBI-D-07**: Has every `bindings[*].operation` value present as a key in the document's `operations` map.
- **OBI-D-08**: Has every `bindings[*].source` value present as a key in the document's `sources` map.
- **OBI-D-09**: Has an `openbindings` field whose value is a valid [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) string.
- **OBI-D-10**: Has every operation `input` and `output` and every entry in `schemas` valid against the JSON Schema 2020-12 meta-schemas, which validate its subschemas in turn, with `format` as an annotation, JSON Schema's default (Validation §7.2.1) ([§5.2](#52-schemas)). The pinned meta-schemas make the rule decidable offline; it does not require resolving references or evaluating any value.
- **OBI-D-11**: Has every `dependencies[*].operation` value present as a key in the document's `operations` map.

### 10.3. Tool rules

A conformant **tool** meets each of the following that applies to it. Each item states a requirement even where it uses no BCP 14 keyword; a BCP 14 keyword inside an item keeps its own force, so a SHOULD there is a recommendation:

- **OBI-T-01** (applies when comparing kinds under core rules): Compares complete kind strings by exact equality. For that comparison it MUST NOT normalize, case-fold, or decompose kinds, or infer compatibility or version order from their spelling. A kind is not implicitly dereferenced merely because it resembles a URI. Whether a processor supports the kind or acts on a source is its own capability and policy; lack of support does not change document conformance or a dependency's exact-match `kinds` constraint ([§5.5](#55-dependencies)).
- **OBI-T-02** (applies when interpreting OBI-defined fields): Gives an unknown field no core meaning. "Fields" are the properties of OBI-defined objects (the document root; operation, dependency, source, binding, and example objects); property names inside JSON Schema objects are schema content, out of scope for this rule, mirroring OBI-D-03. An unknown field whose name does not begin with `x-` makes the document non-conformant under OBI-D-02 ([§12](#12-extensions)); this rule does not require a processor to continue work on a non-conformant document or prescribe its diagnostics.
- **OBI-T-03** (all processors): Treats `x-` prefixed fields as extensions. An `x-` field, whether or not the tool understands it, does not change the meaning of core fields; a tool may act on an `x-` field it understands in ways that leave that meaning intact.
- **OBI-T-04** (all processors): Interprets a document under this specification's semantics only when the `major.minor` line of its declared `openbindings` version is one the processor supports, and produces a version refusal otherwise, reported distinctly from document non-conformance. The patch number does not enter this decision; a prerelease is supported only when explicitly included. A document that declares no valid version is not refused: it is non-conformant under OBI-D-09 ([§8.1](#81-openbindings-field-specification-version)). The version-processing semantics of [§8.1](#81-openbindings-field-specification-version) govern this rule: prerelease and build-metadata handling, what a refusal prohibits (interpretation under another line's rules) and permits (parsing, preserving, inspecting, and reporting the declared version), and refusal reporting.
- **OBI-T-05** (applies when claiming to derive a contract from a schema, e.g., through comparison or code generation): Does not claim that the derived contract preserves the schema's meaning when semantically significant keywords or values it cannot represent could change that meaning. Whether and how to report a narrower result or an unsupported feature is a tooling concern.
- **OBI-T-06** (applies when resolving `$ref` values): Does not treat a reference cycle alone as an invalid reference or a schema mismatch. Implementation strategy and resource limits are tool concerns.
- **OBI-T-07** (applies when resolving operation names): Resolves a name against the flat namespace of operation identifiers (each operation's key together with its `aliases`), treating key and alias matches as equally authoritative. OBI-D-04 makes the namespace document-unique, so a name resolves to at most one operation; a tool MUST NOT privilege key matches over alias matches, and MUST NOT resolve a name to an operation unless the name exactly equals one of that operation's identifiers (no trimming, case-folding, or approximate matching). A binding for a resolved operation is selected by the operation's key (the value in `bindings[*].operation`), not by the alias used to reach it.
- **OBI-T-08** (applies when claiming to validate a value against an operation's `input` or `output` schema): Evaluates the value under the schema's applicable JSON Schema dialect, with the OBI document as the resolution context for embedded schemas, including every `$id` and plain name declared at its OBI positions ([§5.2](#52-schemas), [§7](#7-reference-resolution)). The operation schema applies separately to each value crossing that boundary. A required reference or capability that is unavailable cannot establish either validation success or instance mismatch. This rule does not require a whole-graph readiness check or prescribe evaluation strategy, resource acquisition, or report shape; invoking, rendering, or indexing alone does not trigger validation.
- **OBI-T-09** (applies when claiming overall document conformance): Claims conformance only when every applicable document rule has been established with no violation. A known violation establishes non-conformance; absence of a found violation alone does not establish conformance. A tool may report a narrower scope or an inability to reach an overall conclusion in its own form ([§10.4](#104-conformance-conclusions)).
- **OBI-T-10** (applies when reporting document conformance): Does not treat the apparent factual inaccuracy of an author-attested `idempotent` claim as a document-rule violation ([§5.1](#51-operations)). Tools may independently decide whether to rely on that claim or act on the document.
- **OBI-T-11** (applies when checking examples): Does not resolve an example–schema mismatch by treating the example as an exception ([§5.1](#51-operations)): the schema is authoritative, and an example never widens, narrows, or overrides it. A mismatch it finds is a false example claim, not a document-rule violation.

These rules fix the meaning of core fields and the truth of claims made under this specification. They do not require a tool to act on every valid document or to continue processing a non-conformant one. Selection, invocation, runtime policy, diagnostics, and report serialization remain outside this specification (invariant 2).

### 10.4. Conformance conclusions

A document is objectively conformant or non-conformant under this specification (invariant 5). A validator may also lack enough evidence to decide. The following terms describe the possible conclusions; they do not prescribe a tool's API or report vocabulary ([OBI-T-09](#103-tool-rules)):

| Conclusion                   | Exact meaning                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| **Conformant**               | Every applicable document rule was decided and no violation established.           |
| **Non-conformant**           | At least one violation of an applicable document rule was established.             |
| **Conformance undetermined** | No violation established, but one or more applicable rules have not been decided.  |

The applicable rules are the document rules of [§10.2](#102-document-rules) for the line the document is interpreted under. A rule with nothing to govern in a particular document holds vacuously.

A known violation is decisive even if other rules have not been decided. Absence of a known violation is not sufficient for a positive conformance conclusion.

A tool may describe rule-level evidence as satisfied, violated, undecided, or not applicable, and may name the governing rule identifiers. An unavailable resource, missing capability, or exceeded resource limit is not by itself evidence of a document-rule violation. Scoped claims such as "valid against the derived structural schema" are possible when their scope is clear. This specification does not define a report vocabulary, serialization, or ladder of validation levels.

---

## 11. IANA considerations

This specification defines the registration details for the OpenBindings JSON media type. The IANA registries are authoritative for current registration status.

Per [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838), under the vendor tree:

- **Type/subtype:** `application/vnd.openbindings+json`
- **Required parameters:** none
- **Encoding considerations:** binary. OBI documents are UTF-8 encoded JSON ([OBI-D-01](#102-document-rules)); the value matches the `application/json` registration of [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259), which JSON carries because it has no line structure
- **Fragment identifier considerations:** JSON Pointer per [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901); within a schema, a plain name declared by `$anchor` or `$dynamicAnchor`, as JSON Schema 2020-12 defines (§8.2.2)
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
- An OBI-defined object carries only the fields this specification defines and `x-` fields ([OBI-D-02](#102-document-rules)). Unprefixed names are reserved for this specification, so it can add fields without colliding with a document's own data; an unknown one has no core meaning ([OBI-T-02](#103-tool-rules)).
- An `x-` field never changes the meaning of core fields, whether or not a processor understands it ([OBI-T-03](#103-tool-rules)); whether a processor preserves one it does not understand, or declines work that depends on it, is a tool concern.

"Object location" means the properties of OBI-defined objects: the document root; the operation, dependency, source, binding, and example objects, the same positions [OBI-T-02](#103-tool-rules) enumerates. Keys inside the document's maps (`operations`, `dependencies`, `sources`, `bindings`, `schemas`, and an operation's `examples`) are entry names, not fields: an `x-`-prefixed key there defines an ordinary entry named `x-…`, entering the identifier namespace like any other key (OBI-D-03, OBI-D-04), not an extension. Property names inside JSON Schema objects are schema content and follow [§5.2. Schemas](#52-schemas).

---

## 13. References

### 13.1. Normative references

- **[BCP 14]** Best Current Practice 14: S. Bradner, "Key words for use in RFCs to Indicate Requirement Levels," RFC 2119, March 1997; and B. Leiba, "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words," RFC 8174, May 2017. <https://www.rfc-editor.org/info/bcp14>
- **[RFC 8174]** B. Leiba, "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words," RFC 8174, May 2017. <https://www.rfc-editor.org/rfc/rfc8174>
- **[RFC 8259]** T. Bray, Ed., "The JavaScript Object Notation (JSON) Data Interchange Format," RFC 8259, December 2017. <https://www.rfc-editor.org/rfc/rfc8259>
- **[RFC 3986]** T. Berners-Lee, R. Fielding, L. Masinter, "Uniform Resource Identifier (URI): Generic Syntax," RFC 3986, January 2005. <https://www.rfc-editor.org/rfc/rfc3986>
- **[RFC 6838]** N. Freed, J. Klensin, T. Hansen, "Media Type Specifications and Registration Procedures," RFC 6838, January 2013. <https://www.rfc-editor.org/rfc/rfc6838>
- **[RFC 6901]** P. Bryan, Ed., K. Zyp, M. Nottingham, Ed., "JavaScript Object Notation (JSON) Pointer," RFC 6901, April 2013. <https://www.rfc-editor.org/rfc/rfc6901>
- **[SemVer 2.0.0]** Tom Preston-Werner, "Semantic Versioning 2.0.0." <https://semver.org/spec/v2.0.0.html>
- **[JSON Schema 2020-12]** JSON Schema Specification, Draft 2020-12, including its meta-schemas. <https://json-schema.org/draft/2020-12>
- **[ECMA-262]** Ecma International, "ECMAScript 2020 Language Specification," ECMA-262, 11th edition, June 2020, for its regular-expression grammar and semantics, the edition JSON Schema 2020-12 cites. <https://262.ecma-international.org/11.0/>

### 13.2. Informative references

- **[RFC 7493]** T. Bray, Ed., "The I-JSON Message Format," RFC 7493, March 2015. <https://www.rfc-editor.org/rfc/rfc7493>. Cited by [OBI-D-01](#102-document-rules) and [Appendix A](#appendix-a-canonical-serialization-informative).
- **[RFC 8785]** A. Rundgren, B. Jordan, S. Erdtman, "JSON Canonicalization Scheme (JCS)," RFC 8785, June 2020. <https://www.rfc-editor.org/rfc/rfc8785>. Cited by [Appendix A](#appendix-a-canonical-serialization-informative).
- **openbindings reference tools**: `ob` CLI, `openbindings-go`, `openbindings-ts` (see project README). One implementation of this specification among potentially many.

---

## 14. See also

- `openbindings.schema.json`: derived JSON Schema for structural document validity.
- The openbindings project's shared-contract interfaces, published at [openbindings.com/interfaces](https://openbindings.com/interfaces) (informational).
- `binding-specs/`: this project's binding-specification work and authoring guidance.
- `conformance/`: conformance test corpus keyed to OBI-D-##/OBI-T-## rule identifiers.
- `CHANGELOG.md`: version history and diffs between specification versions.
- `EDITORS.md`: current editor roster.
- `GOVERNANCE.md`: project governance and decision-making.
- `SECURITY.md`: vulnerability reporting and security contact.

---

## Appendix A. Canonical serialization (informative)

Some applications need a stable byte representation of an OBI document, for content addressing, integrity attestation, signature systems, cache keys, or prompt-cache stability. This appendix names one so tools and downstream specifications can refer to it consistently. It is informative: conformance neither requires JCS-compatible input nor requires any processor to implement canonicalization.

For an OBI whose parsed JSON value satisfies the input requirements of [RFC 8785 (JSON Canonicalization Scheme)](https://www.rfc-editor.org/rfc/rfc8785), its JCS serialization provides deterministic bytes for the complete carried JSON value. The facility is **partial**: RFC 8785 constrains its input to the I-JSON subset ([RFC 7493](https://www.rfc-editor.org/rfc/rfc7493): numbers representable in IEEE 754 binary64, strings expressible as Unicode), while this specification pins RFC 8259 JSON and JSON Schema 2020-12, which bound neither. A conformant OBI may therefore have no JCS serialization. The facility named here is JCS over the JSON value exactly as carried: an implementation that rounds, coerces, repairs, or otherwise changes a value to manufacture compatible input is computing some other serialization, not this one; incompatible input is reported as failure per RFC 8785. This matters most when canonical bytes feed hashes, signatures, or equality: silent coercion would attest to data other than what the author supplied.

Canonical serialization is not semantic normalization. JCS sorts object member names and preserves array order; it does not rewrite `{}` to `true`, resolve or bundle references, insert defaults, drop unknown fields, or interpret embedded `content`. Two OBIs can express equivalent contracts with different canonical bytes, and equal bytes establish equal carried JSON data, not behavioral equivalence or document identity. Naming a serialization also defines no integrity system: digest algorithms, signature envelopes, carrier fields, and trust policy belong to downstream specifications, and by default JCS covers only the JSON value carried in the OBI itself, never fetched external resources.

[Terminology]: #3-terminology
[Operations]: #51-operations
[Schemas]: #52-schemas
[Bindings]: #53-bindings
[Sources]: #54-sources
[Dependencies]: #55-dependencies
[Reference resolution]: #7-reference-resolution
[Versioning]: #8-versioning
[Security considerations]: #9-security-considerations
[Conformance]: #10-conformance
