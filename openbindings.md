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

The body of this document defines the OBI shape, its reference-resolution rules, how kinds are compared, and conformance rules for documents and tools. New readers may prefer the [§4. Overview](#4-overview-informative) walkthrough; the normative material starts at [§2. Core invariants](#2-core-invariants).

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

Requirements are stated with these key words, in the definitions of the document model, and in the numbered rules of [§10](#10-conformance); sections and notes marked informative state none. JSON shown inline in this document is illustrative unless the surrounding prose explicitly states a requirement. (This is distinct from the operation `examples` field, whose contents are the author's claims about an operation's values ([§5.1](#51-operations)).)

## Table of contents

- [1. Positioning and scope](#1-positioning-and-scope)
  - [1.1. Distinguishing features](#11-distinguishing-features)
  - [1.2. Out of scope](#12-out-of-scope)
  - [1.3. Obtaining an OBI](#13-obtaining-an-obi)
- [2. Core invariants](#2-core-invariants)
- [3. Terminology](#3-terminology)
- [4. Overview (informative)](#4-overview-informative)
- [5. Document model](#5-document-model)
  - [5.1. Operations](#51-operations)
  - [5.2. Schemas](#52-schemas)
  - [5.3. Bindings](#53-bindings)
  - [5.4. Sources](#54-sources)
  - [5.5. Dependencies](#55-dependencies)
- [6. Kinds](#6-kinds)
- [7. Reference resolution](#7-reference-resolution)
  - [7.1. Reference forms](#71-reference-forms)
  - [7.2. The document as embedding](#72-the-document-as-embedding)
  - [7.3. Same-document pointers](#73-same-document-pointers)
  - [7.4. Other references](#74-other-references)
  - [7.5. Notes for authors and tools (informative)](#75-notes-for-authors-and-tools-informative)
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

This specification defines an interface document model, not a client–server protocol or runtime API. An OBI may be authored and supplied independently of the software it describes, and that software need not publish, receive, or interpret it.

OpenBindings sits one layer above protocol-specific interface specifications such as OpenAPI, AsyncAPI, gRPC, and MCP, which describe how to interact with endpoints over a particular wire format. An OBI describes what a service can do, not how it does it: protocol-independent operations, the concrete realizations bindings declare for them, the operations a described component consumes, and the shared names by which operations can be recognized. It does not replace the artifacts its sources carry or point at, and a source may instead address a live surface without a separate artifact; a source's `kind` says how the source and its bindings are read ([§6](#6-kinds)). Two invariants shape the rest: an operation's contract is per value (invariant 1), and the document enables invocation without defining an invoker (invariant 2).

### 1.1. Distinguishing features

- **One operation, many bindings.** A single operation contract can be realized over multiple protocols simultaneously without duplicating the contract.
- **One contract, either direction.** Bindings declare realizations of an operation; named dependencies declare where the described component consumes realizations, without splitting the operation registry into provider and consumer copies.
- **Vendor-independent correspondence.** An operation can adopt the name a shared contract publishes, so consumers recognize it by that shared name rather than by who runs the service ([§5.1](#51-operations)).
- **Portable, offline-decidable documents.** A document's references never depend on where it was obtained, and every document rule is decidable from the document and locally available resources (invariants 4 and 5).

### 1.2. Out of scope

The core defines the document envelope and each operation's caller-facing value contract. Two other parties decide the rest:

- **The source's kind** decides how a source and its bindings are read: what their `content` means, how a target is identified, how values are adapted, and the mechanics of the interaction ([§6](#6-kinds) lists these matters). Wherever this specification says a matter is read under a source's kind, it marks this boundary: it neither asserts that a definition or implementation of the kind exists nor gives one authority over the document model.
- **Tools** decide whether and when to invoke, whether to validate values at runtime, how to choose among bindings, how to compose dependencies with providers, their security posture, and their comparison and matching strategies (invariant 2).

OpenBindings also does not:

- **Serve as an authoring language.** It defines the interchange document; authoring tools and compilation workflows, such as TypeSpec and Smithy, are outside it.
- **Define acquisition or publication** ([§1.3](#13-obtaining-an-obi)).
- **Maintain registries.** Kinds, correspondence names, and format conventions are author-assigned; this specification provides no registry or ownership test.
- **Specify integrity, signing, or attestation.** These compose externally ([Appendix A](#appendix-a-canonical-serialization-informative)).

### 1.3. Obtaining an OBI

An OBI may be obtained through local files, packages, standard input, embedded resources, network retrieval, or any other mechanism without changing its meaning, since no OBI-defined reference resolves against the location it was obtained from ([§7](#7-reference-resolution)).

---

## 2. Core invariants

The rules in this specification instantiate six invariants; other sections cite them by number.

1. **Per-value contract.** Operation `input` and `output` schemas govern each value that crosses the operation's caller-facing boundary, one value at a time. Interaction pattern, cardinality, framing, completion, and lifecycle are read under the source's kind.
2. **Enabling, not invoking.** A binding declares a realization of its operation through a source; the document alone need not suffice to identify, reach, or act on a target. A dependency carries no target and becomes actionable only through tool-defined composition with a realization. No rule in this specification obligates a tool to invoke, satisfy a dependency, validate values at runtime because it invokes, or handle failures in a prescribed way. Rules about validation semantics apply to tools that claim the corresponding capability.
3. **Bounded interpretation.** The operation carries the caller-facing value contract. This specification defines neither the meaning of source or binding `content` nor the addresses, representations, references, value adaptation, and interaction a tool may use when acting on them. A kind does not change the meaning of core fields.
4. **Context-free references.** No OBI-defined reference ([§7](#7-reference-resolution)) resolves against the URI a document was fetched from, so the document model means the same thing however a document was obtained. Source and binding `content` are outside that reference rule (invariant 3). OBI assigns no document identity; `name` and `version` are labels.
5. **Offline-decidable conformance.** Document conformance is an objective property of the document, decidable from the document plus locally available resources (bundled meta-schemas included). No document rule's outcome depends on network state, so a document's conformance changes only when a patch release corrects the text it is judged under ([§8.1](#81-openbindings-field-specification-version)). A validator's inability to decide a rule is not itself evidence of non-conformance.
6. **Decentralized extension.** This specification assigns no authority over kinds or shared correspondence names. Nothing in the model requires a registry, and no kind is implicitly dereferenced to be understood.

---

## 3. Terminology

- **OBI**: shorthand for "OpenBindings interface document."
- **Tool**: any software that acts on OBI documents. A tool's obligations follow the capabilities it exercises, not a fixed class ([§10.1](#101-tool-obligations)); the rules of [§10.3](#103-tool-rules) are addressed to "a conformant tool."
- **Processor**: a tool that takes an OBI document as input. Its baseline capacity is reading (parsing, validating, indexing, or rendering), which it MAY extend with resolving references, validating values, resolving operation names, and acting on sources. Rules marked "(all processors)" bind every processor, including one that does no more than read; a processor that exercises further capabilities owes the rules this specification scopes to them ([§10.1](#101-tool-obligations)).
- **Operation**: a named protocol-independent capability contract with optional per-value input/output schemas. Stored under a key in the document's `operations` map. An operation is neutral as to whether the document binds it, depends on it, both, or neither. Its name and per-value schemas are its whole signature: what the service can do, not how. Interaction pattern and cardinality belong to each binding, which is what keeps the operation binding-independent (invariant 1).
- **Binding**: an author-declared realization of an operation through a source, optionally with content read under the source's kind. Stored under a key in the document's `bindings` map.
- **Dependency**: a named declaration that the described component consumes a realization of an operation, optionally constrained to one of a declared set of kinds. Stored under a key in the document's `dependencies` map. A dependency is not itself a realization or target.
- **Core**: this specification, as distinct from behavior for particular kinds.
- **Caller-facing**: on the operation's side of a binding. Caller-facing values are the ones a caller of the operation sends and receives, under its `input` and `output` contracts; how they correspond to the source interaction, including any adaptation between them, is read under the source's kind. Values a tool needs only to reach or authorize a target, such as credentials, are not caller-facing values unless the operation is about them; they are supplied under the kind or by tool policy.
- **Realization**: a concrete way of carrying out an operation's contract through a target. In a document, a binding declares one, as its author's claim ([§5.3](#53-bindings)); a dependency consumes one supplied from elsewhere ([§5.5](#55-dependencies)).
- **Target**: what a binding is intended to act on under its source's kind: an entry in an artifact, a member of a live surface, or another form ([§5.3](#53-bindings), [§5.4](#54-sources)).
- **Interaction**: the exchange with a target that acting on a binding involves, such as a request and response, a stream, or a subscription. Its mechanics are read under the source's kind ([§6](#6-kinds)).
- **Validator**: a processor that checks a document against the document rules of [§10.2](#102-document-rules) and reports what it established ([§10.4](#104-conformance-conclusions)).
- **Invoker**: a tool that acts on bindings to carry out operations. This specification defines none ([§1.2](#12-out-of-scope)).
- **Kind**: the exact, opaque, non-empty string a source carries in `kind` and a dependency may list in `kinds`. It is used to select an interpretation of a source and its bindings, not as a locator ([§6](#6-kinds)).
- **Source**: a kind together with optional content read under that kind ([§5.4](#54-sources)).
- **Source artifact**: when an interpretation of a source uses one, a concrete representation such as an OpenAPI document, a `.proto` source, an operation graph, or an MCP endpoint's tool listing. It may be carried in or referenced from source `content`, or obtained otherwise; this specification prescribes none of these arrangements.
- **OBI position**: a place where the document model puts a schema: an operation's `input` or `output`, an entry in the `schemas` map, and every subschema reached from one of these through the locations the JSON Schema 2020-12 meta-schema validates as schemas, which include the legacy JSON Schema keywords `definitions` and the schema values of `dependencies` (JSON Schema Validation, Appendix A), without entering a schema that declares its own `$id`. Such a schema is at an OBI position, but the resource it declares, including that schema's own keywords other than `$id` and every schema within it, is that resource's own ([§7](#7-reference-resolution)). The **schemas the document contains** are the schemas at OBI positions and every subschema within the resources declared there.
- **Absolute URI**: a URI with a scheme (RFC 3986 §3), which may carry a fragment; RFC 3986's `absolute-URI` production, which excludes fragments, is not what is meant.
- **Alias**: an additional name under which an operation is recognized, beyond its key. An operation's key plus its aliases form one flat, document-unique namespace of names that all resolve to that operation; binding and dependency references use the key.
- **Correspondence**: an operation **corresponds to** a shared contract's operation when it carries that operation's name as its key or an alias. The claim is the author's: it identifies no contract document or version and establishes no compatibility, ownership, or substitutability, which tools judge by their own comparison ([§5.1](#51-operations)).

---

## 4. Overview (informative)

OpenBindings separates capability contracts (operations with per-value schemas) from declared realizations (bindings through sources) and named consumption points (dependencies). A single OBI can bind an operation over multiple protocols, depend on an operation, or do both without redefining the contract. Terms used informally below are defined in [Terminology]. OBI documents are JSON (RFC 8259).

Every OBI declares a specification version and an operations map. The minimal conformant document is just those two fields:

```json
{
  "openbindings": "0.2.0",
  "operations": {}
}
```

An operation is the contract, a source carries the kind under which it and its bindings are read, and a binding links the two. Extending the Abstract's example, the same operation is realized over a second protocol by a second binding against a different source; one contract, many bindings is the specification's primary abstraction:

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

**Names.** All map keys this specification defines (operation, dependency, binding, source, schema, and example keys) and all operation aliases MUST match the pattern `^[A-Za-z0-9_][A-Za-z0-9_.-]*$` ([OBI-D-03](#102-document-rules)). Names are opaque ASCII tokens compared by exact, case-sensitive string equality: processors do not trim, case-fold, Unicode-normalize, or otherwise rewrite them. Dot and hyphen carry no structural semantics; a dot may be used by authoring convention to qualify a shared name ([§5.1](#51-operations)), but nothing in this specification parses the segments. Names are not URIs, paths, or native programming-language identifiers merely because their spelling resembles one; code generators apply their own deterministic naming policy. The grammar admits a leading digit (`2fa.verify`) for the same reason. The pattern is an [ECMA-262](#131-normative-references) regular expression, as patterns are in JSON Schema: it must match the whole name, so a name with a trailing newline does not match. Keys within one map are distinct because a document repeats no member name ([OBI-D-01](#102-document-rules)); operation keys and aliases also share one namespace ([OBI-D-04](#102-document-rules)).

**Value representation.** Operation inputs and outputs are described in terms of the JSON data model per [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259). A caller-facing value is one JSON value crossing the operation boundary. Which data of an interaction forms one value, and how that data corresponds to the JSON representation, is read under the source's kind: an array returned in one HTTP response can be one value, and the items of a gRPC stream several. An operation's schemas apply to each value, never to a sequence of values as a whole (invariant 1). This does not prescribe the data types a tool uses internally or exposes through its own APIs, nor require it to materialize JSON text.

**Presence.** For every optional member, presence is distinct from value: a member present with the JSON value `null` is present, and only omitting the member omits it. Implementations therefore track presence rather than testing for nullish values.

### 5.1. Operations

An operation declares what a service can do: its name and optional schemas for each caller-facing input and output value, which together are its whole signature ([§3](#3-terminology), invariant 1). Whether an interaction is request/response, streaming, bidirectional, or pub/sub, and how many values cross, is each binding's; the schemas describe **one value** at a time ([§5](#5-document-model)).

Output values may vary in shape: several event types, a union of representations, a result or an error. `output` describes them all, with any JSON Schema construct, such as `oneOf`, `anyOf`, or a `type` array. `output` describes the values the operation returns, whatever they mean to the caller; which results of an interaction a binding returns as output values is read under its source's kind.

An operation object MAY contain:

| Field         | Type                  | Purpose                                                            |
| ------------- | --------------------- | ------------------------------------------------------------------ |
| `description` | string                | Human-readable description.                                        |
| `deprecated`  | boolean               | Hint that consumers should migrate away from the operation.        |
| `tags`        | array of strings      | Documentation labels for grouping/filtering.                       |
| `aliases`     | array of strings      | Additional names, equal in standing to the operation's key.        |
| `idempotent`  | boolean               | Author-attested effect claim; see below.                           |
| `input`       | JSON Schema or absent | Contract on each caller-facing input value.                        |
| `output`      | JSON Schema or absent | Contract on each caller-facing output value.                       |
| `examples`    | object                | Map of example names to example objects; see below.                |

**Schema states.** `input` and `output`, when present, contain a JSON Schema 2020-12 object or boolean schema ([§5.2](#52-schemas)). Omission is the sole representation of an unspecified contract; literal `null` is not a valid value at either position. The states are deliberately distinct:

| Form               | Meaning                                                           |
| ------------------ | ----------------------------------------------------------------- |
| field absent       | No contract is specified for that boundary.                       |
| `{}` or `true`     | A contract is specified; every JSON value satisfies it.           |
| `false`            | A contract is specified; no JSON value satisfies it.              |
| `{"type": "null"}` | A contract is specified; only the JSON value `null` satisfies it. |

Absence means the document makes no portable claim at that boundary: not that the interaction carries no values, and not that every value is accepted. `false` is an impossible **value** contract (no value crossing the boundary can satisfy it), not a cardinality declaration: a binding that delivers no caller-facing input values can realize an operation with `input: false`. An operation that takes no meaningful input can therefore omit `input` (no claim), describe the empty value callers send (`{"type": "object", "maxProperties": 0}`), or use `false` (no input value is valid, so a realization receives none). This specification prefers `{}` for the always-valid contract in its examples; `true` is the equivalent native spelling.

**Contract directions.** The `input` and `output` schemas are caller-facing contracts running in opposite directions. `input` states that a realization accepts at minimum every value validating against it and may accept more. Accepting a value means treating it as a request for the operation and answering within the contract; answering it with an error value described in `output`, or failing for reasons the value does not determine, such as state, authorization, or availability, does not make it unaccepted. A caller sending any value validating against `input` is honoring the input contract. `output` states that every value produced by a realization validates against it, and the realization may produce a narrower set; a caller receiving a value relies on it validating against `output` exactly as far as it trusts the document's claims. A binding attests that its concrete target realizes this contract; a dependency declares that the described component consumes a realization of it. The operation alone does not assert that any realization is available.

**Aliases and correspondence.** An operation's **identifiers** are its key plus its aliases, sharing one flat namespace: every identifier is equally valid for resolving the operation, and the choice of key versus alias carries no semantic weight beyond the key being the operation's primary name for display, logging, and same-document relationship references (the value bindings and dependencies carry in their `operation` fields). The namespace is document-unique: no string occurs more than once among all operations' keys and aliases taken together ([OBI-D-04](#102-document-rules)), so an alias never equals its own operation's key, another operation's identifier, or another of its aliases. Any identifier resolves to at most one operation, and tools resolve names identically per [OBI-T-07](#103-tool-rules).

Common uses of `aliases`: a prior name kept for continuity after a rename, a vendor-specific name some consumers look up by, or a shared contract's operation name. The last is the correspondence claim of [§3. Terminology](#3-terminology): by adopting a published identifier as its key or an alias, the operation **claims correspondence with** the published operation. The claim is an author assertion: it identifies no particular contract document or version, establishes no schema compatibility, behavioral equivalence, ownership, or trust, and no rule in this specification verifies it. Consumers that require compatibility compare the operation against a reference OBI of their choosing, under their own policy. Because the claim is made by adopting a name, a consumer may read any key or alias that matches a published name as such a claim; qualified names keep claims intentional.

Because the identifier namespace is document-unique, two adopted names that collide cannot coexist in one document; publishers of identifiers intended for adoption avoid this by qualifying them under a namespace they control, with enough interface scope (`acme.tasks.createTask` rather than `create`). Dotted qualification is a convention; the specification constrains only the name syntax ([OBI-D-03](#102-document-rules)). A published identifier is useful for correspondence only while it names one continuing semantic operation, and giving an intentionally incompatible replacement a new identifier keeps it so. Both conventions reduce collisions and ambiguity; neither is a conformance requirement.

**Idempotency.** `idempotent: true` is an author assertion that repeating the operation with equivalent input under the same relevant execution context produces no additional intended operation-level effects after the first application. `idempotent: false` asserts the opposite: some valid repetition can produce additional intended effects. Absence makes no claim in either direction.

The claim concerns intended operation-level effects, not equality of returned values, timing, or other per-attempt observations: a read of changing state can be idempotent while returning different values; repeated deletion can be idempotent though later attempts report absence. Idempotency does not imply that the operation is safe, read-only, deterministic, cacheable, or harmless, and does not assert that authorization, billing, or audit effects repeat without consequence. Attaching a binding to the operation asserts that it honors the operation-level claim under the equivalent conditions ([§5.3](#53-bindings)); the field does not itself authorize switching bindings between attempts. An invocation policy MAY consider the field but cannot derive retry safety from it alone. Its truth is author-attested: structural validity is enforced, and whether it is accurate is outside document conformance ([OBI-T-10](#103-tool-rules)).

**Examples.** `examples` holds named, author-supplied sample values: each entry MAY provide `description`, and an `input` and an `output` member, each one caller-facing value. Examples are **positive** claims about the caller-facing contract: the author asserts that each provided value validates against the corresponding operation schema, where that schema is specified. Like `idempotent`, the claim is the author's. A tool that checks it evaluates the value as any other value ([§5.2](#52-schemas)), and what it finds is not a document-rule verdict. The schema is authoritative; an example never widens, narrows, or overrides it, and a tool MUST NOT resolve a mismatch by treating the example as an exception ([OBI-T-11](#103-tool-rules)).

Example members are values, not schemas, so presence is distinct from value ([§5](#5-document-model)): an absent member supplies no value, while an explicitly `null` member supplies the JSON value `null`, which the claim covers like any other value; otherwise an operation whose `output` is `{"type": "null"}` could carry no example. Examples make no claim beyond schema membership: no binding is acted on, and an example's input and output values do not establish that the output can result from the input.

### 5.2. Schemas

The top-level `schemas` map holds named JSON Schemas. Operations reference them via `$ref` (e.g., `{"$ref": "#/schemas/Task"}`).

Every schema in an OBI document is a [JSON Schema 2020-12](https://json-schema.org/draft/2020-12) schema, in object or boolean form (`true` accepts every value; `false` accepts none; `{}` is equivalent to `true`), and MUST be valid against the 2020-12 meta-schemas ([OBI-D-10](#102-document-rules)): a value occupying a schema position that is not a schema, such as `{"type": 42}`, is a document defect. A `$schema` keyword MAY be omitted; absence means 2020-12. When `$schema` is present, its value MUST be `https://json-schema.org/draft/2020-12/schema` or the same with an empty fragment (`…/schema#`) ([OBI-D-06](#102-document-rules)). A schema obtained by resolving a reference to an external URI follows its own declared dialect.

Beyond this section and the reference forms of [§7](#7-reference-resolution), JSON Schema 2020-12 governs the document's schemas: what they mean, how their references resolve, and how values are evaluated against them. This specification defines no keyword and no evaluation of its own. The document rules test the schemas only for meta-schema validity (OBI-D-10), for the reference forms and dialect of OBI-D-05 and OBI-D-06, and for same-document pointers that land on a schema (OBI-D-12). JSON Schema's other requirements, such as where `$schema` may appear, and conditions that arise at evaluation, such as an external reference that cannot be obtained or a regular expression an engine cannot compile, are JSON Schema's: they surface when a tool uses the schema and create no document-rule violation.

**Validation semantics.** A tool that claims to check a value against an operation's contract evaluates it under JSON Schema ([OBI-T-08](#103-tool-rules)): the document's schemas under 2020-12, and an externally referenced schema under the dialect it declares. If an external resource or required evaluation capability is unavailable, that limitation establishes neither a match nor a mismatch. A tool that only preserves schemas through round-trips need not interpret them; a tool claiming to derive a contract from a schema answers for the scope of that claim ([OBI-T-05](#103-tool-rules)).

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

A binding's `content`, read under its source's kind, identifies the target that realizes the operation (an entry in an artifact or a member of a live surface), describes how values are adapted between the operation's contract and that target, or both: for example, a JSON Pointer into an OpenAPI document, a fully qualified gRPC method name with a value mapping, or an MCP tool name. The core gives its type and members no meaning; its presence is distinct from its value ([§5](#5-document-model)).

**Realizations.** Multiple bindings MAY reference the same operation. Each is an author-declared realization: attaching a binding asserts that its target realizes the operation's logical capability and honors the facts the operation represents, namely its `input` and `output` schemas ([§5.1](#51-operations)) and its `idempotent` claim. Descriptions, tags, deprecation, examples, and aliases are not facts a binding vouches for. The assertion is the author's, like `idempotent` itself: a binding that does not honor those facts makes the document's claim false, which no document rule detects ([OBI-T-10](#103-tool-rules)). A caller interacts with the operation through any one of its bindings; using one binding is a complete use of the operation. Bindings are interchangeable only as far as those facts reach (invariant 1); a caller that needs a particular interaction pattern chooses among bindings accordingly.

**Preference signals.** `preference` is an optional signed integer from -9007199254740991 through 9007199254740991 (the exactly representable interoperable range). Integer means a number with no fractional part, however it is written: `1.0` and `1` are the same preference. Among bindings for the same operation that declare it, a higher value expresses stronger author preference; equal values express no ordering through this field. Omission states no preference and is not equivalent to zero or any other value; zero and negative values have no privileged meaning beyond numeric order. `deprecated: true` states that the author recommends migration away from the binding and ordinarily does not recommend it for new use; deprecation does not remove the binding or change what it declares. The two signals are independent dimensions (lifecycle guidance and relative choice), and this specification mandates no ordering relationship between them.

How these signals shape a tool's choice among bindings is up to the tool ([§1.2](#12-out-of-scope)); explicit caller choice and tool policy may override both, and a tool that chooses automatically documents its policy.

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

A source's `kind` selects how its `content` and its bindings' `content` are read ([§5.3](#53-bindings), [§6](#6-kinds)). The optional `content` can embed an artifact, address one, address a live service, name something a processor's environment provides, or combine these; no JSON type or member within it has a core meaning of its own, and its presence is distinct from its value ([§5](#5-document-model)). Naming a kind does not make a source retrievable or actionable by any given tool. JSON has no binary primitive; how a binary artifact is encoded in `content` is read under the kind.

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

The kind test is only one constraint. The candidates are whatever a tool's composition supplies, which may include this document's own bindings for the operation; discovering them, judging their compatibility, choosing among them, and registering, configuring, authenticating, or monitoring the chosen target are tool concerns ([§1.2](#12-out-of-scope)), and correspondence may be author-asserted through operation names ([§3](#3-terminology)). A processor may be unable to act on a binding whose kind meets this constraint ([OBI-T-01](#103-tool-rules)). A dependency therefore carries no concrete target and is not actionable by itself.

Multiple dependencies MAY reference the same operation, including with different `kinds` constraints. An operation MAY also have both one or more bindings and one or more dependencies: the bindings declare realizations of it, while each dependency declares a separate consumption point. With neither relationship, an operation is a contract declaration only.

A dependency declaration says nothing about when the consuming behavior runs or what happens when no realization is supplied. An unsatisfied dependency does not make the OBI non-conformant and does not by itself show that the described component is unavailable or unhealthy; startup requirements, feature availability, conditional use, readiness, and failure behavior are application and deployment policy.

---

## 6. Kinds

Every source has a `kind`: an exact, opaque, non-empty string naming how the source and its bindings are read. A dependency may list the kinds it accepts in `kinds` ([§5.5](#55-dependencies)).

**Comparison.** Kinds are compared as whole strings, by exact equality ([OBI-T-01](#103-tool-rules)), so two different strings are two unrelated kinds. A kind has no internal structure: dots, `@`, and version-like suffixes are simply part of the string, and a URI-shaped kind is a name, never implicitly dereferenced.

**Interpretation.** Supporting a kind means knowing how to read the `content` of its sources and their bindings for whatever work a tool does with them, such as identifying a target, carrying out the interaction, or adapting values at the operation boundary. That knowledge may be built into a tool, supplied by a plugin, or configured locally, and it may be written down or exist only in code. A document conforms whether or not any tool supports its kinds, and a tool may preserve, index, or display a source whose kind it does not support.

**What a kind decides.** Everything the core leaves to a source's kind:

- what a source's `content` and its bindings' `content` may contain, and what they mean ([§5.3](#53-bindings), [§5.4](#54-sources));
- how a binding's target is identified ([§5.4](#54-sources));
- how caller-facing values correspond to interaction data: value adaptation, which data forms one value, and which results of an interaction are returned as output values ([§5](#5-document-model), [§5.1](#51-operations));
- interaction mechanics: pattern, cardinality, framing, completion, and lifecycle (invariant 1);
- how a binary artifact is encoded in `content` ([§5.4](#54-sources)).

A kind in turn stands on these core provisions, whose changes [§8.1](#81-openbindings-field-specification-version) records as breaking: `content` is any JSON value, and its presence is distinct from its value ([§5](#5-document-model)); `content` is exempt from the reference rules of [§7](#7-reference-resolution); caller-facing values are JSON values, and an operation's schemas apply to each value (invariant 1); and a binding vouches for its operation's `input`, `output`, and `idempotent` ([§5.3](#53-bindings)).

**Sharing a kind.** A kind is portable as far as its meaning is shared. Authors who want independent tools to agree on a kind describe it in writing and give an incompatible meaning a new kind, since a document offers tools no way to tell two meanings of one kind apart. A kind meant to circulate widely can be qualified under a name its publisher controls. These are interoperability practices, not conformance requirements. This project publishes definitions of some kinds ([§14](#14-see-also)); they have no special standing here. Matching a kind establishes neither provenance nor authorization ([§9](#9-security-considerations)).

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

OBI documents define no `id` field, and no OBI-defined reference resolves against the URI a document was fetched from, so a document's references resolve identically however it was obtained (invariant 4).

### 7.1. Reference forms

The **OBI-defined document references** are the schema references at OBI positions: each `$ref` and `$dynamicRef`. Each MUST be an [absolute URI](#3-terminology) or a same-document reference (empty, or a fragment alone; RFC 3986 §4.4), each schema `$id` at an OBI position MUST be an absolute URI, and all of them MUST be well-formed URI-references (RFC 3986 §4.1) ([OBI-D-05](#102-document-rules)). A source's or binding's `content` is not an OBI-defined reference: it is read under the source's kind and exempt from these forms.

### 7.2. The document as embedding

JSON Schema lets the format that embeds a schema determine its initial base URI (JSON Schema Core §9.1.1) and leaves open how such schemas fit its resource model (JSON Schema Core §4.3.5). OBI settles both:

- The document is its schemas' embedding document, with a base URI unique to it and drawn from nowhere else (RFC 3986 §5.1.4). A same-document reference addresses a location in the document, read as an [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) JSON Pointer from the document root, so `#` names the OBI document itself, not the schema that contains it.
- The schemas at OBI positions that declare no `$id` are subschemas of one schema resource, the document's. The plain names they declare with `$anchor` or `$dynamicAnchor` belong to it, and an evaluation that begins at one of them begins in it, which makes that resource the outermost in the evaluation's dynamic scope.
- A schema that declares `$id` begins a resource of its own. The references, anchors, and nested `$id`s within it, including its own keywords other than `$id`, take any form JSON Schema allows and resolve against its base.

### 7.3. Same-document pointers

A same-document reference at an OBI position that is empty or has a JSON Pointer fragment MUST point at a schema at an OBI position ([OBI-D-12](#102-document-rules)). This is a lookup in the document, not an evaluation. `#` and the empty reference never qualify, and neither does a pointer to a location that holds no schema (an operation object, a map, a string, `x-` data, a source's `content`, or an example value) or to a location inside a schema that declares `$id`, whose contents are reached through that `$id`.

### 7.4. Other references

Everything else resolves as JSON Schema 2020-12 defines: plain-name fragments, dynamic references, references within a schema resource that declares `$id`, and references to external schemas. In the document's own resource, no plain name is declared twice, and no `$id` is declared by two schemas the document contains ([OBI-D-13](#102-document-rules)). Where JSON Schema leaves a result undefined, the reference's meaning in an OBI is undefined too, though the document conforms: within a schema resource that declares `$id`, a pointer that reaches no schema or a plain name declared twice (JSON Schema Core §9.4.2, §8.2.2).

A tool MAY decline to obtain external resources; a document whose references all resolve within it needs no network access. Declining an external resource needed to evaluate a particular value prevents a validation verdict for that value ([OBI-T-08](#103-tool-rules)); it does not make the document non-conformant. Schema reference cycles are permitted: recursive types (trees, linked lists, ASTs) are legitimate and widespread, and a cycle by itself does not make a reference invalid ([OBI-T-06](#103-tool-rules)).

### 7.5. Notes for authors and tools (informative)

Which schemas each document rule walks:

| Rule | What it walks | At a schema that declares `$id` |
| ---- | ------------- | -------------------------------- |
| OBI-D-05 | `$ref`, `$dynamicRef`, and `$id` at OBI positions | Checks that schema's `$id`; its other keywords and contents belong to its resource |
| OBI-D-06 | `$schema` in every schema the document contains | Continues inside the resource |
| OBI-D-10 | Each operation `input`/`output` and `schemas` entry, with its subschemas, against the meta-schemas | Continues inside the resource |
| OBI-D-12 | Same-document references at OBI positions | Skips that schema's own references; a pointer may land on it, not inside it |
| OBI-D-13 | Plain names in the document's resource; `$id` in every schema the document contains | Plain names inside it belong to its resource |

Schemas pasted in from standalone files are the usual source of mistakes. Such a schema often recurses with `{"$ref": "#"}` or points into its own `$defs` with `#/$defs/Node`. Embedded without an `$id`, both resolve from the OBI document root: the first names the OBI document and the second a location that does not exist, and both violate OBI-D-12. Either rewrite the pointers to the schema's place in the document (`#/schemas/Tree`, `#/schemas/Tree/$defs/Node`), or give the embedded schema an absolute `$id`, which keeps its internal references working as they did standalone:

```json
{
  "openbindings": "0.2.0",
  "schemas": {
    "Tree": {
      "$id": "https://example.com/schemas/tree.json",
      "type": "object",
      "properties": {
        "children": { "type": "array", "items": { "$ref": "#" } }
      }
    }
  },
  "operations": {
    "getTree": { "output": { "$ref": "https://example.com/schemas/tree.json" } }
  }
}
```

Inside `Tree`, `#` resolves against its `$id` and names `Tree` itself; the operation reaches `Tree` through that `$id`.

A JSON Schema library reads `schemas`, `operations`, and the document's other members as unknown keywords, so it neither finds the `$id`s and anchors at OBI positions nor reliably resolves pointers into them (JSON Schema Core §9.4.2). A tool therefore locates those identifiers itself, as OpenAPI requires of its tools, and presents the document's schemas to its library in a form the library resolves. Evaluating an operation's schema in isolation leaves its references to the document's other schemas unresolved and, where the schema declares no `$id`, reads its same-document references from the wrong root.

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
- A document whose `openbindings` member is absent, not a string, or not a SemVer version declares no version, so there is nothing to refuse: it violates OBI-D-09, and a validator reports that non-conformance under the rules of a line it supports, naming that line.
- Unknown fields have no core meaning under a supported line ([OBI-T-02](#103-tool-rules)); that rule does not authorize interpreting an unsupported line by ignoring its additions.

**Release policy (project).** While pre-1.0, minor versions MAY include breaking changes, per pre-1.0 SemVer convention. A patch release only corrects this text: it defines no new field and changes no document's meaning, and its corrections apply to the whole line. Changes to the provisions [§6](#6-kinds) lists as those a kind stands on are recorded in the changelog as breaking changes to this specification. This is a commitment about this specification's own provisions, not a compatibility judgment about external behavior. Declaring the earliest line sufficient for a document's content maximizes the processors able to interpret it.

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

The normative shape of an OBI document is defined by this specification's prose; `openbindings.schema.json` expresses its structural portion in JSON Schema. OBI-D-02 applies that schema as published for the document's line, with its `pattern` values read as ECMA-262 regular expressions, and the structural requirements of [§5](#5-document-model) take effect through it. A disagreement between the schema and the prose is an erratum, corrected in the schema by a patch release; until then, the published schema decides OBI-D-02. The other document rules walk the document beyond what the schema expresses.

**The document and its data.** Conformance is a property of a JSON text; a claim about an in-memory value is a claim about its serialization. Document rules read the text as RFC 8259 defines it: member names are compared as the sequences of code units they denote after unescaping (RFC 8259 §8.3), and numbers by their exact decimal value. A validator whose parser cannot represent a name or number exactly has not decided a clause that depends on it.

Each rule carries an identifier (`OBI-D-##` document rules, `OBI-T-##` tool rules) so validators, test suites, and errata can cite it. An identifier means what the line of this specification that states it says it means: a rule is cited under a line, as a document is interpreted under the line its version names ([§8.1](#81-openbindings-field-specification-version)), and another line may number its rules differently. A patch release adds and renumbers no rule.

### 10.1. Tool obligations

A tool's obligations follow the capabilities it exercises, not a fixed class. A tool that only parses, validates against the document rules, indexes, or renders OBI documents owes the rules marked (all processors). A tool that also resolves references, validates values against operation contracts, or resolves operation names additionally owes the rules scoped to those activities. How a tool acts on a source is outside this specification, and invoking a binding, by itself, triggers no additional core rule (invariant 2).

There is no central registry of tool capabilities. A conformance test corpus is published as reference material (not part of this specification); a rule without fixtures is no less binding.

**Implementer map (informative).** The following is a dependency map into the normative rules, not a required class hierarchy or one mandatory processing pipeline. A tool performs only the rows for capabilities it claims. A processor interprets the document under this version's semantics only when OBI-T-04 permits it; no processing order is prescribed.

| Capability checkpoint | Normative entry points | Boundary to preserve |
| --------------------- | ---------------------- | -------------------- |
| Accept document bytes or text | OBI-D-01 | Preserve the exact input through duplicate-key, UTF-8, and BOM checks; a normalized host object can no longer prove this rule. |
| Decide whether this specification applies | OBI-D-09, OBI-T-04, [§8.1](#81-openbindings-field-specification-version) | Version refusal is distinct from document non-conformance and prohibits interpretation under a different version. |
| Validate document conformance | OBI-D-02 through OBI-D-13, [§10.4](#104-conformance-conclusions) | A positive conformance claim needs every applicable document rule; a partial check is scoped to what it established. |
| Resolve an operation identifier | OBI-T-07, [§5.1](#51-operations) | Resolve keys and aliases in one flat namespace, then use the canonical operation key to find bindings. |
| Index a dependency declaration | OBI-D-03, OBI-D-11, [§5.5](#55-dependencies) | Preserve its local dependency key, resolve `operation` only as an operation key, and treat `kinds` as an optional exact-match any-of constraint. |
| Resolve schema references | OBI-D-05, OBI-D-12, OBI-D-13, OBI-T-06, [§7](#7-reference-resolution) | Resolve references at OBI positions against the document, never the location it was obtained from; within an `$id` resource and in external schemas, follow JSON Schema's bases; a reference cycle is permitted. |
| Validate operation-boundary values | OBI-T-08, [§5.2](#52-schemas) | Validation is optional until claimed; once claimed, apply the governing JSON Schema dialect to each value without changing its keyword semantics. |
| Check examples | OBI-T-11, [§5.1](#51-operations) | Examples are author claims; a mismatch is a finding about the claim, not a document-rule violation, and never an exception to the schema. |
| Resolve or act on a binding target | The source's kind ([§6](#6-kinds)) | Core defines the envelope; source and binding `content`, target identity, value adaptation, and interaction mapping are read under the source's kind; invocation behavior is outside this specification. |


### 10.2. Document rules

Document rules bind the document; deciding a clause takes capabilities. A validator that lacks a capability a clause requires (a duplicate-detecting parse for OBI-D-01) has not thereby established that the document violates it: conformance is a property of the document, not of any validator ([§10.4](#104-conformance-conclusions)).

A conformant **OBI document**:

- **OBI-D-01**: Is valid UTF-8 encoded JSON per [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259). Duplicate JSON object keys within any object make the document non-conformant. A leading byte-order mark makes the document non-conformant: RFC 8259 §8.1 forbids adding one, interoperable-JSON practice ([RFC 7493](https://www.rfc-editor.org/rfc/rfc7493)) excludes it, and tolerating it would let two parsers disagree over the same bytes. Validation note (informative): most JSON parsers silently keep one duplicate value, so checking the duplicate clause requires a duplicate-detecting parse; a validator whose parser cannot surface duplicates cannot establish whether the clause holds.
- **OBI-D-02**: Validates against the derived JSON Schema published for its line (`openbindings.schema.json`, `$id` `https://openbindings.com/schema/openbindings-0.2.json`); a patch release that corrects the schema republishes it under the same `$id`.
- **OBI-D-03**: Has every map key this specification defines (operation, dependency, binding, source, schema, and example keys) and every operation alias matching `^[A-Za-z0-9_][A-Za-z0-9_.-]*$`. Property names inside JSON Schema objects are schema content, not map keys, and are unconstrained by this rule.
- **OBI-D-04**: Has no string occurring more than once among all operations' keys and `aliases` entries taken together.
- **OBI-D-05**: Has every schema `$ref` and `$dynamicRef` at an OBI position an absolute URI or a same-document reference, and every schema `$id` at an OBI position an absolute URI, all of them well-formed URI-references per [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) §4.1 ([§7.1](#71-reference-forms)).
- **OBI-D-06**: Has every `$schema` in a schema the document contains ([§3](#3-terminology)) equal to `https://json-schema.org/draft/2020-12/schema` or `https://json-schema.org/draft/2020-12/schema#`.
- **OBI-D-07**: Has every `bindings[*].operation` value present as a key in the document's `operations` map.
- **OBI-D-08**: Has every `bindings[*].source` value present as a key in the document's `sources` map.
- **OBI-D-09**: Has an `openbindings` field whose value is a valid [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) string.
- **OBI-D-10**: Has every operation `input` and `output` and every entry in `schemas` valid against the JSON Schema 2020-12 meta-schemas, which validate its subschemas in turn, with `format` as an annotation, JSON Schema's default (JSON Schema Validation §7.2.1) ([§5.2](#52-schemas)). The pinned meta-schemas make the rule decidable offline; it resolves none of the document's references and evaluates no value against the document's schemas.
- **OBI-D-11**: Has every `dependencies[*].operation` value present as a key in the document's `operations` map.
- **OBI-D-12**: Has every same-document schema `$ref` and `$dynamicRef` at an OBI position that is empty or has a JSON Pointer fragment pointing at a schema at an OBI position; `""` and `"#"` never do ([§3](#3-terminology), [§7.3](#73-same-document-pointers)). Absolute URIs, plain-name fragments, and references within a schema resource that declares `$id` are outside this rule. The check is a lookup in the document; it resolves no other reference and evaluates no value.
- **OBI-D-13**: Has no plain name declared more than once, by `$anchor` or `$dynamicAnchor` in any combination, among the schemas at OBI positions that declare no `$id`, and no `$id` declared by two schemas the document contains, each `$id` resolved to an absolute URI with any empty fragment removed and compared character for character ([§7.4](#74-other-references)).

### 10.3. Tool rules

A conformant **tool** meets each of the following that applies to it. Each item states a requirement, whether or not it uses a BCP 14 keyword:

- **OBI-T-01** (applies when comparing kinds under core rules): Compares complete kind strings by exact equality. For that comparison it MUST NOT normalize, case-fold, or decompose kinds, or infer compatibility or version order from their spelling. A kind is not implicitly dereferenced merely because it resembles a URI. Whether a processor supports the kind or acts on a source is its own capability and policy; lack of support does not change document conformance or a dependency's exact-match `kinds` constraint ([§5.5](#55-dependencies)).
- **OBI-T-02** (applies when interpreting OBI-defined fields): Gives an unknown field no core meaning. "Fields" are the properties of OBI-defined objects (the document root; operation, dependency, source, binding, and example objects); property names inside JSON Schema objects are schema content, out of scope for this rule, mirroring OBI-D-03. An unknown field whose name does not begin with `x-` makes the document non-conformant under OBI-D-02 ([§12](#12-extensions)); this rule does not require a processor to continue work on a non-conformant document or prescribe its diagnostics.
- **OBI-T-03** (all processors): Treats `x-` prefixed fields as extensions. An `x-` field, whether or not the tool understands it, does not change the meaning of core fields; a tool may act on an `x-` field it understands in ways that leave that meaning intact.
- **OBI-T-04** (all processors): Interprets a document under this specification's semantics only when the `major.minor` line of its declared `openbindings` version is one the processor supports, and produces a version refusal otherwise, reported distinctly from document non-conformance. The patch number does not enter this decision; a prerelease is supported only when explicitly included. A document that declares no valid version is not refused: it is non-conformant under OBI-D-09. [§8.1](#81-openbindings-field-specification-version) governs prerelease and build-metadata handling and what a refusal prohibits and permits.
- **OBI-T-05** (applies when claiming to derive a contract from a schema, e.g., through comparison or code generation): Does not claim that the derived contract preserves the schema's meaning when semantically significant keywords or values it cannot represent could change that meaning. Whether and how to report a narrower result or an unsupported feature is a tooling concern.
- **OBI-T-06** (applies when resolving `$ref` or `$dynamicRef` values): Does not treat a reference cycle alone as an invalid reference or a schema mismatch. Implementation strategy and resource limits are tool concerns.
- **OBI-T-07** (applies when resolving operation names): Resolves a name against the flat namespace of operation identifiers (each operation's key together with its `aliases`), treating key and alias matches as equally authoritative. OBI-D-04 makes the namespace document-unique, so a name resolves to at most one operation; a tool MUST NOT privilege key matches over alias matches, and MUST NOT resolve a name to an operation unless the name exactly equals one of that operation's identifiers (no trimming, case-folding, or approximate matching). The bindings for a resolved operation are found by the operation's key (the value in `bindings[*].operation`), not by the alias used to reach it.
- **OBI-T-08** (applies when claiming to validate a value against an operation's `input` or `output` schema): Evaluates the value under the schema's applicable JSON Schema dialect, with the OBI document as the resolution context for embedded schemas, including every `$id` and plain name declared at its OBI positions ([§5.2](#52-schemas), [§7](#7-reference-resolution)). The operation schema applies separately to each value crossing that boundary. A required reference or capability that is unavailable cannot establish either validation success or instance mismatch. This rule does not require a whole-graph readiness check or prescribe evaluation strategy, resource acquisition, or report shape; invoking, rendering, or indexing alone does not trigger validation.
- **OBI-T-09** (applies when claiming overall document conformance): Claims conformance only when every applicable document rule has been established with no violation. A known violation establishes non-conformance; absence of a found violation alone does not establish conformance. A tool may report a narrower scope or an inability to reach an overall conclusion in its own form ([§10.4](#104-conformance-conclusions)).
- **OBI-T-10** (applies when reporting document conformance): Does not treat the apparent inaccuracy of an author claim as a document-rule violation: an operation's `idempotent` or `examples` ([§5.1](#51-operations)), a binding's claim to realize its operation ([§5.3](#53-bindings)), or a correspondence claim ([§3](#3-terminology)). Tools may independently decide whether to rely on such a claim or act on the document.
- **OBI-T-11** (applies when checking examples): Does not resolve an example–schema mismatch by treating the example as an exception ([§5.1](#51-operations)): the schema is authoritative, and an example never widens, narrows, or overrides it. A mismatch it finds is a false example claim, not a document-rule violation.

These rules fix the meaning of core fields and what the claims made under them assert. They do not require a tool to act on every valid document or to continue processing a non-conformant one; selection, invocation, runtime policy, diagnostics, and report serialization are tool concerns ([§1.2](#12-out-of-scope)).

### 10.4. Conformance conclusions

A document is objectively conformant or non-conformant under this specification (invariant 5). A validator may also lack enough evidence to decide. The following terms describe the possible conclusions; they do not prescribe a tool's API or report vocabulary ([OBI-T-09](#103-tool-rules)):

| Conclusion                   | Exact meaning                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| **Conformant**               | Every applicable document rule was decided and no violation established.           |
| **Non-conformant**           | At least one violation of an applicable document rule was established.             |
| **Conformance undetermined** | No violation established, but one or more applicable rules have not been decided.  |

The applicable rules are the document rules of [§10.2](#102-document-rules) for the line the document is interpreted under. A rule with nothing to govern in a particular document holds vacuously.

A known violation is decisive even if other rules have not been decided. Absence of a known violation is not sufficient for a positive conformance conclusion.

A tool may describe rule-level evidence as satisfied, violated, undecided, or not applicable (holding vacuously), and may name the governing rule identifiers. An unavailable resource, missing capability, or exceeded resource limit is not by itself evidence of a document-rule violation. Scoped claims such as "valid against the derived structural schema" are possible when their scope is clear. This specification does not define a report vocabulary, serialization, or ladder of validation levels.

---

## 11. IANA considerations

This specification defines the registration details for the OpenBindings JSON media type. The IANA registries are authoritative for current registration status.

Per [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838), under the vendor tree:

- **Type/subtype:** `application/vnd.openbindings+json`
- **Required parameters:** none
- **Encoding considerations:** binary, as for `application/json` ([RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)); OBI documents are UTF-8 encoded JSON ([OBI-D-01](#102-document-rules))
- **Fragment identifier considerations:** JSON Pointer per [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901); within a schema, a plain name declared by `$anchor` or `$dynamicAnchor` (JSON Schema Core §8.2.2)
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
- **[RFC 8259]** T. Bray, Ed., "The JavaScript Object Notation (JSON) Data Interchange Format," RFC 8259, December 2017. <https://www.rfc-editor.org/rfc/rfc8259>
- **[RFC 3986]** T. Berners-Lee, R. Fielding, L. Masinter, "Uniform Resource Identifier (URI): Generic Syntax," RFC 3986, January 2005. <https://www.rfc-editor.org/rfc/rfc3986>
- **[RFC 6838]** N. Freed, J. Klensin, T. Hansen, "Media Type Specifications and Registration Procedures," RFC 6838, January 2013. <https://www.rfc-editor.org/rfc/rfc6838>
- **[RFC 6901]** P. Bryan, Ed., K. Zyp, M. Nottingham, Ed., "JavaScript Object Notation (JSON) Pointer," RFC 6901, April 2013. <https://www.rfc-editor.org/rfc/rfc6901>
- **[SemVer 2.0.0]** Tom Preston-Werner, "Semantic Versioning 2.0.0." <https://semver.org/spec/v2.0.0.html>
- **[JSON Schema Core]** A. Wright, H. Andrews, B. Hutton, G. Dennis, "JSON Schema: A Media Type for Describing JSON Documents," draft-bhutton-json-schema-01 (Draft 2020-12), June 2022, including its meta-schemas. <https://json-schema.org/draft/2020-12/json-schema-core>
- **[JSON Schema Validation]** A. Wright, H. Andrews, B. Hutton, "JSON Schema Validation: A Vocabulary for Structural Validation of JSON," draft-bhutton-json-schema-validation-01 (Draft 2020-12), June 2022. <https://json-schema.org/draft/2020-12/json-schema-validation>
- **[ECMA-262]** Ecma International, "ECMAScript 2020 Language Specification," ECMA-262, 11th edition, June 2020, for its regular-expression grammar and semantics, the edition JSON Schema 2020-12 cites. <https://262.ecma-international.org/11.0/>

### 13.2. Informative references

- **[RFC 7493]** T. Bray, Ed., "The I-JSON Message Format," RFC 7493, March 2015. <https://www.rfc-editor.org/rfc/rfc7493>. Cited by [OBI-D-01](#102-document-rules) and [Appendix A](#appendix-a-canonical-serialization-informative).
- **[RFC 8785]** A. Rundgren, B. Jordan, S. Erdtman, "JSON Canonicalization Scheme (JCS)," RFC 8785, June 2020. <https://www.rfc-editor.org/rfc/rfc8785>. Cited by [Appendix A](#appendix-a-canonical-serialization-informative).
- **openbindings reference tools**: `ob` CLI, `openbindings-go`, `openbindings-ts` (see project README). One implementation of this specification among potentially many.

---

## 14. See also

- `openbindings.schema.json`: derived JSON Schema for structural document validity.
- The openbindings project's shared-contract interfaces, published at [openbindings.com/interfaces](https://openbindings.com/interfaces) (informational).
- `binding-specs/`: definitions of kinds this project publishes, with authoring guidance. They have no special standing in this specification.
- The project's optional operation-invoker interface, one place a tool's binding-selection policy can live, published with the shared-contract interfaces above.
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
