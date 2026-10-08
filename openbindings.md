# OpenBindings Specification (v0.2.0)

## Abstract

OpenBindings is a portable interface description format; its documents are OBIs (OpenBindings interface documents). An OBI declares each operation once, as a protocol-independent contract with optional per-value input and output schemas, then relates it to concrete realizations through bindings and to named consumption points through dependencies. The contract lives at the operation layer; protocols live at the binding layer.

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

The kinds in this document's examples (`example.openapi@1`, `example.mcp@1`, `example.grpc@1`, `my-cli.usage@1`) and the shapes of their `content`, such as `{ "location": … }` on a source and `{ "target": … }` on a binding, are illustrative; only a kind gives `content` meaning ([§6](#6-kinds)).

New readers may prefer the [§4. Overview](#4-overview-informative) walkthrough. The notational conventions below, and the text from [§1. Positioning and scope](#1-positioning-and-scope) on, are normative except where marked informative; conformance is defined by the numbered rules of [§10](#10-conformance).

## Editors

- Matthew Clevenger ([@clevengermatt](https://github.com/clevengermatt))

See `EDITORS.md` for the current editor roster.

## Status of this document

This is **version 0.2.0** of the OpenBindings specification. This text is the unreleased working draft of that version; the latest release is **0.1.0** (immutable released snapshots live under `versions/`). It is pre-1.0, and minor-version revisions may include breaking changes per [§8. Versioning](#8-versioning). Substantive changes are recorded in `CHANGELOG.md` and cite rule identifiers (`OBI-##`) where applicable, each under the version it belongs to.

## License and intellectual property

This specification is published under the Apache 2.0 License (see `LICENSE`).
Apache 2.0 defines the copyright and contribution-scoped patent grants
currently in force. The project has no separately executed
standards-essential-claims commitment, and the absence of a disclosure does
not imply one. `IPR.md` records the precise current
posture, received-disclosure status, and the additional decision required
before the final 0.2 release.

## Notational conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/info/bcp14) ([RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)) when, and only when, they appear in all capitals.

JSON shown inline in this document is illustrative unless the surrounding prose explicitly states a requirement. A paragraph that begins with **Note** is informative: it explains the text before it and adds no requirement. A file or directory named by a relative path, such as `CHANGELOG.md` or `binding-specs/`, is in the specification repository, <https://github.com/openbindings/spec>.

## Table of contents

- [1. Positioning and scope](#1-positioning-and-scope)
  - [1.1. Distinguishing features (informative)](#11-distinguishing-features-informative)
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
  - [7.3. Same-document references](#73-same-document-references)
  - [7.4. Other references](#74-other-references)
  - [7.5. Notes and examples (informative)](#75-notes-and-examples-informative)
- [8. Versioning](#8-versioning)
  - [8.1. `openbindings` field (specification version)](#81-openbindings-field-specification-version)
  - [8.2. `version` field (interface-version label)](#82-version-field-interface-version-label)
- [9. Security considerations](#9-security-considerations)
- [10. Conformance](#10-conformance)
- [11. IANA considerations](#11-iana-considerations)
- [12. Extensions](#12-extensions)
- [13. References](#13-references)
- [14. See also (informative)](#14-see-also-informative)
- [Appendix A. Canonical serialization (informative)](#appendix-a-canonical-serialization-informative)

---

## 1. Positioning and scope

This specification defines an interface document model, not a client-server protocol or runtime API: an OBI may be authored and supplied by anyone, independently of the software it describes, whether or not that software publishes, receives, or interprets it.

OpenBindings sits one layer above protocol-specific interface specifications such as OpenAPI, AsyncAPI, gRPC, and MCP, which describe how to interact with particular protocols and endpoints. An OBI describes operations (what a service can do rather than how), the realizations bindings declare for them, the operations a described component consumes, and the published names by which operations can be recognized. It relates these across protocols, complementing the artifacts its sources carry or point at.

### 1.1. Distinguishing features (informative)

- **One operation, many bindings.** One operation contract can be realized over multiple protocols at once without duplicating the contract.
- **One contract, either direction.** Bindings declare realizations of an operation; named dependencies declare where the described component consumes realizations, without a second operation map for what it consumes.
- **Vendor-independent correspondence.** An operation can adopt the name a shared contract publishes, so readers recognize it by that name rather than by who runs the service ([§5.1](#51-operations)).
- **Location-independent meaning.** OBI-defined references never depend on where a document was obtained, so its core meaning, and whether it conforms, are the same wherever it came from (invariants 4 and 5).

### 1.2. Out of scope

The core defines the document envelope and each operation's caller-facing value contracts; how a source and its bindings are read, beginning with what their `content` means, is left to the source's kind ([§6](#6-kinds) lists the matters). Wherever this specification says a matter is read under a source's kind, it marks this boundary: it neither asserts that the kind is defined anywhere nor lets a kind's definition change the document model.

The core does not say whether or when an operation is invoked or how calls are managed (lifecycle, retries, credential flow, rate limiting), which binding carries out a call (`preference` and `deprecated` are only author signals, [§5.3](#53-bindings)), or what realization serves a dependency beyond its `kinds` constraint ([§5.5](#55-dependencies)). It defines no authentication field: a credential is context unless the operation is about it ([§5](#5-document-model)).

OpenBindings also does not:

- **Serve as an authoring language.** It defines the interchange document; authoring tools and compilation workflows, such as TypeSpec and Smithy, are outside it.
- **Define acquisition or publication** ([§1.3](#13-obtaining-an-obi)).
- **Maintain registries.** Kinds and published names are author-assigned; this specification provides no registry or ownership test.
- **Specify integrity, signing, or attestation.** These compose externally ([Appendix A](#appendix-a-canonical-serialization-informative)).

### 1.3. Obtaining an OBI

An OBI may be obtained through local files, packages, standard input, resources compiled into a program, network retrieval, or any other mechanism, and its core meaning is the same whichever mechanism delivered it (invariant 4, [§7](#7-reference-resolution)).

---

## 2. Core invariants

The model rests on six invariants, cited elsewhere by number; most of their terms are defined in [§3](#3-terminology).

1. **Value contracts.** Operation `input` and `output` schemas govern each value that crosses the operation's caller-facing boundary, one value at a time. Interaction pattern, cardinality, framing, completion, and lifecycle are read, for each binding, under its source's kind.
2. **Declaration, not availability.** A binding declares a realization of its operation through a source; it does not assert that the realization is available, and the document alone need not suffice to identify or reach its target. A dependency carries no target ([§5.5](#55-dependencies)).
3. **Bounded core meaning.** The operation carries the caller-facing value contracts. This specification defines neither the meaning of source or binding `content` nor how a binding's target is addressed, represented, referenced, adapted to, or interacted with. A kind does not change the meaning of core fields.
4. **Location-independent references.** No OBI-defined reference ([§7](#7-reference-resolution)) resolves against the URI a document was fetched from, so a document has the same core meaning however it was obtained. Source and binding `content` are outside the reference resolution of §7 (invariant 3). This specification assigns no document identity; `name` and `version` are labels.
5. **Self-contained conformance.** Whether a document conforms to a release of this specification depends only on the document, that release's text, the derived schema published with that release ([OBI-02](#10-conformance)), and the normative references the text's rules cite, the JSON Schema 2020-12 meta-schemas among them ([OBI-10](#10-conformance)); not on where the document was obtained or on any other resource it references. Releases of one line differ about a document only where a later release corrects an earlier one's text ([§8.1](#81-openbindings-field-specification-version)).
6. **Decentralized naming.** Kinds and published names are author-assigned: this specification assigns no authority over them, the model requires no registry, and a kind is a name, not an address ([§6](#6-kinds)).

---

## 3. Terminology

- **OBI**: an OpenBindings interface document.
- **Core**: this specification, as distinct from what particular kinds define.
- **Described component**: the software, such as a service or a program, that an OBI describes; a dependency names a point where it consumes a realization ([§5.5](#55-dependencies)).
- **Operation**: a named, protocol-independent capability contract under a key in `operations`: what a service can do, the capability its identifiers name and its description conveys, with optional per-value input and output schemas ([§5.1](#51-operations)). Its name and schemas are its signature. Unqualified, *contract* means this whole contract.
- **Value contract**: the part of an operation's contract that governs each caller-facing value crossing the boundary in one direction, to the operation or from it, stated by a schema: the **input contract**, stated by `input`, or the **output contract**, stated by `output`. An absent field states none ([§5.1](#51-operations)).
- **Alias**: an additional name under which an operation is recognized, identifying it exactly as its key does ([§5.1](#51-operations)).
- **Shared contract**: a published set of operations offered for adoption, such as another OBI's, not one operation's contract; its operations' keys and aliases are published names ([§5.1](#51-operations)).
- **Correspondence**: an operation that carries a published name as its key or an alias **claims correspondence with** the operation that name identifies, read against each shared contract a reader holds that publishes the name; the claim is the author's alone ([§5.1](#51-operations)).
- **Caller-facing**: said of the values an operation is about, which a caller sends to it and receives from it on the operation's side of a binding, and which its value contracts govern where stated; anything else a realization needs is context ([§5](#5-document-model)).
- **Context**: what a realization needs that the operation is not about, such as a credential or a target's address; a source's or binding's content may carry it under the source's kind, or it comes from outside the document ([§5](#5-document-model)).
- **Author claim**: one of the claims [§5](#5-document-model) lists, which a document makes and whose truth is outside conformance.
- **Binding**: an author-declared realization of an operation through a source, under a key in `bindings` ([§5.3](#53-bindings)).
- **Realization**: a concrete way of carrying out an operation's contract through a target. A binding declares one ([§5.3](#53-bindings)) and a dependency consumes one ([§5.5](#55-dependencies)), each as an author claim.
- **Target**: what a binding claims realizes its operation, identified under its source's kind ([§5.4](#54-sources)): an entry in an artifact, a member of a live surface such as a running service's tool listing, or another form.
- **Interaction**: the exchange with a target through which a binding's realization is carried out, such as a request and response, a stream, or a subscription; its mechanics are read under the source's kind ([§6](#6-kinds)).
- **Source**: an object carrying a kind and optional content read under that kind, under a key in `sources` ([§5.4](#54-sources)).
- **Source artifact**: a concrete representation a source's kind may draw on, such as an OpenAPI document, a `.proto` source, an operation graph, or an MCP endpoint's tool listing, carried in or referenced from source `content`, or obtained otherwise ([§5.4](#54-sources)).
- **Kind**: the exact, opaque, non-empty string a source carries in `kind` and a dependency may list in `kinds`; it selects how a source and its bindings are read ([§6](#6-kinds)).
- **Dependency**: a named point where the described component consumes a realization of an operation, optionally limited to declared kinds, under a key in `dependencies` ([§5.5](#55-dependencies)).
- **OBI position**: a place where the document model puts a schema; the **schemas the document contains** extend these through the resources declared there, nested resources included ([§7](#7-reference-resolution) defines both).
- **Document resource**: the schema resource every schema at an OBI position that declares no `$id` belongs to; a schema that declares `$id` begins a resource of its own ([§7.2](#72-the-document-as-embedding)).
- **Field**: a member of an OBI-defined object (the document root, and operation, dependency, source, binding, and example objects). Keys inside the document's maps and property names inside JSON Schema objects are not fields ([§12](#12-extensions), [OBI-04](#10-conformance)).
- **Absolute URI**: a URI with a scheme (RFC 3986 §3), fragment permitted; not RFC 3986's `absolute-URI` production, which excludes fragments.

Other terms are defined where they are used: an operation's identifiers ([§5.1](#51-operations)); satisfying and failing a value contract, and an undefined result ([§5.2](#52-schemas)); an any-of constraint ([§5.5](#55-dependencies)); OBI-defined references ([§7.1](#71-reference-forms)); a plain name ([§7.3](#73-same-document-references)); declaring a version ([§8.1](#81-openbindings-field-specification-version)); and an extension ([§12](#12-extensions)).

---

## 4. Overview (informative)

OpenBindings separates capability contracts (operations with per-value schemas) from declared realizations (bindings through sources) and named consumption points (dependencies): a single OBI can bind an operation over multiple protocols, depend on an operation, or do both without redefining the contract. Terms used informally below are defined in [Terminology].

Every OBI declares a specification version and an operations map; the minimal conformant document is just those two fields:

```json
{
  "openbindings": "0.2.0",
  "operations": {}
}
```

An operation is the contract, a source carries the kind under which it and its bindings are read, and a binding links the two; one contract with many bindings is the specification's primary abstraction. This fuller OBI binds `createTask` over two protocols, shares a schema between operations, describes an error shape beside a result, adapts a source's wire shape in binding content, and claims correspondence through a qualified alias (a reader holding a shared contract that publishes `createTask` may read its key the same way):

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
    },
    "Problem": {
      "type": "object",
      "properties": { "problem": { "type": "string" } },
      "required": ["problem"],
      "additionalProperties": false
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
      "output": {
        "anyOf": [{ "$ref": "#/schemas/Task" }, { "$ref": "#/schemas/Problem" }]
      }
    },
    "listTasks": {
      "description": "List all tasks.",
      "input": { "type": "object", "maxProperties": 0 },
      "output": {
        "anyOf": [
          { "type": "array", "items": { "$ref": "#/schemas/Task" } },
          { "$ref": "#/schemas/Problem" }
        ]
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

Here `target` and `outputTransform` illustrate one possible reading of `example.openapi@1` ([§5.3](#53-bindings)), under which each HTTP binding's transform applies to success responses and an error response's body passes through as a `Problem` value.

An operation's presence alone declares a contract, not availability: a binding declares a realization of it through a source, and a dependency declares a named consumption point for which a realization can be supplied:

```json
{
  "openbindings": "0.2.0",
  "operations": {
    "events.deliver": {
      "aliases": ["acme.events.deliver"],
      "input": { "type": "object" },
      "output": { "type": "object", "maxProperties": 0 }
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

The alias adopts a published name, so this operation claims correspondence with the operation that name identifies in a shared contract, as does any operation, in any document, that carries the same name ([§5.1](#51-operations)).

---

## 5. Document model

An OBI document is a JSON text ([RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)) whose value is an object. Top-level fields:

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

**Names.** The map keys this specification defines (operation, dependency, binding, source, schema, and example keys) and operation aliases are names. They are opaque tokens, each matched as a whole against the grammar of [OBI-04](#10-conformance), so a name ending in a newline does not match it. Names are equal only as exact strings, case included (below). Dots and hyphens carry no structure: a dot may qualify a published name by convention ([§5.1](#51-operations)), but nothing in this specification parses the segments. A name shaped like a URI, a path, or a programming-language identifier is only a name. That is why the grammar admits a leading digit (`2fa.verify`).

**Strings and numbers.** Two strings, member names included, are equal exactly when they denote the same sequence of UTF-16 code units after unescaping ([RFC 8259](https://www.rfc-editor.org/rfc/rfc8259) §8.3). Two numbers are equal exactly when their exact decimal values are.

**Value representation.** Operation inputs and outputs are described in the JSON data model of [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259): a caller-facing value is one JSON value crossing the operation boundary (invariant 1). Which interaction data forms one value, and how it corresponds to JSON, is read under the kind of each binding's source. An array returned in one HTTP response can be one value, and the items of a gRPC stream several. A value need not travel as JSON text.

**Context.** Context ([§3](#3-terminology)) may be carried in a source's or binding's content under the source's kind, or it comes from outside the document. A credential is caller-facing only when the operation is about it, which the author decides by describing it in `input` or `output`. A credential not described there, including where neither field is present, is context.

**Fields and extensions.** Each OBI-defined object carries only the fields its table lists and extension fields whose names begin with `x-` ([OBI-02](#10-conformance), [§12](#12-extensions)).

**Presence.** For every optional field, presence is distinct from value: a field present with the JSON value `null` is present, and a field is absent only when omitted.

**Author claims.** Some of what a document says is its author's claim, namely:

- an operation's `examples` ([§5.1](#51-operations));
- a binding's claim to realize its operation, and its `idempotent` claim ([§5.3](#53-bindings));
- a dependency's claim to consume its operation within its value contracts ([§5.5](#55-dependencies));
- correspondence ([§5.1](#51-operations)).

This specification defines what each asserts; whether it is true is outside conformance.

### 5.1. Operations

An operation's name and its optional schemas for each caller-facing input and output value ([§3](#3-terminology)) are its whole signature. Interaction pattern and cardinality (request/response, streaming, bidirectional, pub/sub; how many values cross) belong to each binding under its source's kind (invariant 1). This keeps the operation binding-independent. An operation's declaration alone makes no claim that a realization is available (invariant 2).

`output` describes every value the operation returns, whatever it means to the caller (several event types, a union of representations, a result or an error). Any JSON Schema construct can express the variation, such as `oneOf`, `anyOf`, or a `type` array. Which results of an interaction a binding returns as output values is read under its source's kind.

An operation object's fields are all optional:

| Field         | Type                  | Purpose                                                            |
| ------------- | --------------------- | ------------------------------------------------------------------ |
| `description` | string                | Human-readable description of the capability, which bindings claim to carry out ([§5.3](#53-bindings)). |
| `deprecated`  | boolean               | Author recommends migration away from the operation.               |
| `tags`        | array of strings      | Documentation labels for grouping and filtering, in no meaningful order; a repeated tag adds nothing. |
| `aliases`     | array of strings      | Additional names, in no meaningful order. A string equal to one identifies the operation exactly as its key does (**Aliases**, below). |
| `input`       | JSON Schema or absent | States the input contract, which governs each caller-facing input value. |
| `output`      | JSON Schema or absent | States the output contract, which governs each caller-facing output value. |
| `examples`    | object                | Map of example names to example objects; see below.                |

**Schema states.** `input` and `output`, when present, hold a JSON Schema 2020-12 object or boolean schema ([§5.2](#52-schemas)). Omission is the only way to state no value contract, and literal `null` is not valid at either position. The states are distinct (satisfying a value contract is defined in [§5.2](#52-schemas)):

| Form               | Meaning                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| field absent       | No value contract is stated for that direction.                         |
| `{}` or `true`     | A value contract is stated; every JSON value satisfies it.              |
| `false`            | A value contract is stated; no JSON value satisfies it.                 |
| `{"type": "null"}` | A value contract is stated; only the JSON value `null` satisfies it.    |

For an operation that takes no meaningful input, a schema that admits only the empty object fits: `{"type": "object", "maxProperties": 0}`. An operation that returns nothing meaningful on any outcome, error or otherwise, uses the same schema for `output`.

**Note.** Kinds differ on whether a call to an operation that takes no meaningful input carries an empty value or no value at all. This input contract suits both. The empty value satisfies it, and where no value crosses, the input contract has nothing to apply to. An MCP tool's `{}` arguments and a gRPC `Empty` message are empty values. Omitting `input` would state no input contract, and `false` leaves a caller that must send `{}` nothing it may send. For an operation that returns nothing meaningful, `output: false` would misdescribe one realized under a kind that surfaces an empty result as `{}`.

**Signature.** Like a function signature, `input` and `output` describe shape, not behavior. A caller relies on a realization's values satisfying `output` exactly as far as it trusts the binding's author claim ([§5.3](#53-bindings)).

**Aliases.** An operation's **identifiers** are its key and its aliases, one flat, document-unique namespace ([OBI-05](#10-conformance)). A string identifies an operation exactly when it equals the operation's key or one of its aliases ([§5](#5-document-model)). The operation's bindings are those whose `operation` holds its key. The key is the primary name, used for display, logging, and the `operation` references bindings and dependencies carry. Beyond that, choosing a key or an alias carries no meaning. Aliases commonly keep a prior name after a rename, carry a vendor-specific name some readers know it by, or adopt a shared contract's operation name.

**Correspondence.** The keys and aliases of the operations of a shared contract ([§3](#3-terminology)) are **published names**. By carrying a published name as its key or an alias, an operation **claims correspondence with** the operation that name identifies. A reader may read the operation as asserting that it is that name's operation in each shared contract the reader holds that publishes the name. The claim is an author claim ([§5](#5-document-model)) made by carrying the name, whatever the author intended.

**Note.** The claim demonstrates no schema compatibility, behavioral equivalence, substitutability, ownership, or trust.

**Publishing names (informative).** Two adopted names that collide cannot coexist in one document. Publishers of names intended for adoption avoid this by qualifying them under a namespace they control with enough interface scope (`acme.tasks.createTask` rather than `create`). Such qualification also keeps claims intentional. A published name stays useful for correspondence while it names one continuing semantic operation, so an intentionally incompatible replacement is best given a new name.

**Examples.** `examples` maps names to author-supplied samples. An example object's fields are all optional:

| Field         | Type           | Purpose                              |
| ------------- | -------------- | ------------------------------------ |
| `description` | string         | Human-readable description.          |
| `input`       | any JSON value | One caller-facing input value.       |
| `output`      | any JSON value | One caller-facing output value.      |

Examples are **positive** author claims ([§5](#5-document-model)): the author claims that each value an example provides satisfies the corresponding value contract, where one is stated ([§5.2](#52-schemas)). A value that fails it makes the claim false. Where whether a value satisfies its value contract is undefined, so is the claim's truth. Where that question rests on a resource the document does not contain, so does the claim's truth. An example's `input` and `output` are values, not schemas. So an explicitly `null` one supplies the JSON value `null` ([§5](#5-document-model), Presence), which the claim covers like any other value. An operation whose `output` is `{"type": "null"}` can therefore carry an example. Examples claim only that each value satisfies its value contract.

**Note.** An example never changes what the operation's schema states.

### 5.2. Schemas

The top-level `schemas` map holds named JSON Schemas, which operations reference with `$ref` (for example, `{"$ref": "#/schemas/Task"}`).

Every schema the document contains ([§3](#3-terminology)) is a [JSON Schema 2020-12](https://json-schema.org/draft/2020-12) schema in object or boolean form, valid against the 2020-12 meta-schemas ([OBI-10](#10-conformance)). An invalid schema the document contains, such as `{"type": 42}`, violates that rule.

**Dialect.** Each schema the document contains is read as JSON Schema 2020-12. A `$schema` other than 2020-12 violates [OBI-09](#10-conformance). Wherever a `$schema` the document contains appears, it names the dialect the schema is already read in and has no other effect: a value's validity is the same as without it.

JSON Schema permits `$schema` only at a resource root (JSON Schema Core §8.1.1). In an OBI, the resource roots that are themselves schemas are exactly the schemas that declare `$id` ([§7.2](#72-the-document-as-embedding)). A schema reached through an external URI follows the dialect JSON Schema assigns it (JSON Schema Core §8.1.1). Where JSON Schema leaves its dialect to the implementation, such a schema is read as 2020-12 (**Value contracts**, below).

Beyond this section and [§7](#7-reference-resolution), JSON Schema 2020-12 governs the document's schemas: their meaning, reference resolution, and value evaluation. This specification defines no keyword and no evaluation of its own, beyond the four provisions that **Value contracts** (below) sets among JSON Schema's options. OBI-09 to OBI-13 concern schemas ([§7.5](#75-notes-and-examples-informative)). OBI-01 and OBI-02 apply to them as part of the whole document.

**Note.** A schema that breaks another of JSON Schema's requirements does not by that alone violate a rule.

**Value contracts.** A value **satisfies** the value contract an operation's `input` or `output` schema states when it is valid against that schema. It **fails** that value contract when it is invalid. That schema is read as JSON Schema 2020-12, with four provisions that hold wherever its evaluation reaches:

- `format` is an annotation where JSON Schema leaves its assertion optional;
- `pattern` values and `patternProperties` names are ECMA-262 regular expressions with Unicode semantics (the `u` flag, JSON Schema Core §6.4);
- references resolve as [§7](#7-reference-resolution) defines;
- a schema document whose root declares no `$schema` is read as 2020-12 (JSON Schema Core §8.1.1 leaves its dialect to the implementation).

A value contract applies to each value separately, never to several values taken together (invariant 1).

An **undefined result** is any of these:

- one JSON Schema leaves undefined, such as evaluating a cycle that recurses without consuming any of the instance (JSON Schema Core §9.4.1);
- one [§7.4](#74-other-references) names;
- one that depends on a keyword value the four provisions make invalid, such as a pattern that is invalid with Unicode semantics.

A value's validity depends on an undefined result exactly when that validity would differ between two ways the result could come out. Such ways include a keyword valid or invalid, and a property name matching a pattern or not. A value's validity depends on a resource the document does not contain exactly when that validity would differ between two contents the resource could have. In both tests, the annotations JSON Schema collects follow each way.

Where a value's validity depends on an undefined result, whether the value satisfies its value contract is undefined. But where its validity also depends on a resource the document does not contain, whether it satisfies that contract is undefined only if it would be undefined whatever that resource holds. Where its validity depends on such a resource and whether it satisfies is not undefined, the document alone does not settle it: it is what JSON Schema, read with the four provisions, gives with that resource. With that resource, whether the value satisfies its value contract follows these same rules, so it can still be undefined.

Where every way gives the same validity, that validity stands: a value that satisfies one branch of an `anyOf` satisfies it whatever another branch's undefined result would be.

Where `input` or `output` is absent, no value contract is stated ([§5.1](#51-operations)), and a value neither satisfies nor fails one.

**Schemas from other dialects (informative).** Under a 2020-12 reading, OpenAPI 3.0's `nullable: true` is an unknown keyword, which JSON Schema ignores. So a `null` the service returns fails `{"type": "string", "nullable": true}`. Draft-07's array form of `items` violates OBI-10. Translating such schemas to 2020-12 when bringing them in keeps their meaning.

### 5.3. Bindings

A binding object has these fields ([OBI-02](#10-conformance)):

| Field         | Type           | Required | Purpose                                                                   |
| ------------- | -------------- | -------- | ------------------------------------------------------------------------- |
| `operation`   | string         | yes      | Key into the document's `operations` map.                                 |
| `source`      | string         | yes      | Key into the document's `sources` map.                                    |
| `content`     | any JSON value | no       | Content read under the source's kind.                                     |
| `idempotent`  | boolean        | no       | Author claim about repeating the operation through this binding; see below. |
| `preference`  | integer        | no       | Author preference signal among bindings of the same operation; see below. |
| `description` | string         | no       | Human-readable description.                                               |
| `deprecated`  | boolean        | no       | Author recommends migration away from this binding.                       |

A binding's `content` might identify the target that realizes the operation, or describe how values are adapted between the operation's value contracts and that target. The `content` might also serve any other purpose its source's kind gives it. A JSON Pointer into an OpenAPI document, a fully qualified gRPC method name with a value mapping, and an MCP tool name are examples. Its presence, absence, type, and members carry no core meaning.

**Realizations.** Multiple bindings MAY reference the same operation, each an author-declared realization of it. Attaching a binding asserts, as an author claim ([§5](#5-document-model)), that its target realizes the operation as the document describes it:

- **Values.** It takes any value that satisfies `input` as the operation's input (a caller may send it), though it need not succeed on each. It returns only values that satisfy `output`. Each half applies where the operation states the corresponding value contract ([§5.1](#51-operations)).
- **Capability.** It carries out the operation its description conveys (the capability, not the wording) and its identifiers name, correspondence claims included. Those claims are read against the shared contracts a reader holds ([§5.1](#51-operations)).

The operation's tags, deprecation, and examples are not part of the claim. Each binding claims to realize the operation on its own.

**Idempotency.** `idempotent: true` is the binding author's claim ([§5](#5-document-model)) that repeating the operation through this binding produces no additional intended operation-level effects after the first application. The repetitions the claim covers use the same input, in [context](#3-terminology) that differs at most in ways the operation's effects do not depend on (a later deadline, say). `idempotent: false` claims that some such repetition through it can produce additional intended effects, and absence claims neither. Bindings of one operation may differ: a binding whose target deduplicates retried requests can claim `true` beside one that does not. The claim does not imply that authorization, billing, or audit effects repeat without consequence. The claim covers only repetitions that all go through this binding.

**Note.** The claim concerns intended operation-level effects, not returned values, timing, or other per-attempt observations. A read of changing state can be idempotent while returning different values, and so can a deletion whose later attempts report absence. The claim does not imply that the operation, through this binding or any other, is safe, read-only, deterministic, cacheable, or harmless.

**One contract, several bindings (informative).** Every binding claims the same value contracts, and no core field marks one output value apart from another. Callers that must tell output values apart, such as a result from an error, therefore rely on the schema (a required property, say). Bindings' values might not share a per-value shape: an HTTP binding might return a list as one array value, and a streaming binding its items one at a time. In that case, `output` admits both shapes, a kind's value adaptation reconciles them, or they realize different operations.

**Preference signals.** `preference` is an optional signed integer from -9007199254740991 through 9007199254740991 (the exactly representable interoperable range). An integer is a number with no fractional part, so `1.0` and `1` are the same preference. Among bindings of the same operation that declare it, a higher value expresses stronger author preference and equal values no order. Omission states no preference, and zero and negative values mean nothing beyond their numeric order. `deprecated: true` states that the author recommends migration away from the binding and ordinarily does not recommend it for new use. The two signals are independent: `deprecated` does not change a binding's `preference`, and `preference` states nothing about deprecation.

**Note.** `deprecated: true` does not remove the binding.

### 5.4. Sources

A source object has these fields ([OBI-02](#10-conformance)):

| Field         | Type           | Required | Purpose                               |
| ------------- | -------------- | -------- | ------------------------------------- |
| `kind`        | string         | yes      | The source's kind, a non-empty string ([§6](#6-kinds)). |
| `content`     | any JSON value | no       | Content read under the source's kind. |
| `description` | string         | no       | Human-readable description.           |

The content can embed a [source artifact](#3-terminology), address one or a live service, name something supplied from outside the document, or combine these. Since JSON has no binary primitive, how a binary artifact is encoded there is read under the kind ([§6](#6-kinds)).

**Target identity.** How a binding's target is identified is read under the source's kind: from the binding and source alone, or with information from outside the document.

### 5.5. Dependencies

A dependency's map key identifies its consumption point ([§3](#3-terminology)) for configuration, wiring, and diagnostics. The dependency names no realization to serve it, not even one of this document's own bindings.

A dependency object has these fields ([OBI-02](#10-conformance)):

| Field         | Type             | Required | Purpose                                     |
| ------------- | ---------------- | -------- | ------------------------------------------- |
| `operation`   | string           | yes      | Key into the document's `operations` map.   |
| `kinds`       | array of strings | no       | Kinds acceptable at this consumption point. |
| `description` | string           | no       | Human-readable description.                 |

**Consumption.** Declaring a dependency asserts, as an author claim ([§5](#5-document-model)), that the described component, as a caller of the operation, sends only values that satisfy `input`. The claim also asserts that the component takes any value that satisfies `output`, error-shaped values included, as the operation's output. Each half applies where the operation states the corresponding value contract.

When present, `kinds` holds one or more unique kinds ([§6](#6-kinds), [OBI-02](#10-conformance)), in no meaningful order. The field is an **any-of constraint**: a binding meets it exactly when its source's kind is the same kind as one listed ([§6](#6-kinds)). Without `kinds`, the dependency places no constraint on kind: it accepts every kind.

Multiple dependencies MAY reference the same operation, including with different `kinds` constraints. An operation MAY have both bindings and dependencies. Each dependency is a separate consumption point.

---

## 6. Kinds

A source's `kind` ([§3](#3-terminology)) names how the source and its bindings are read.

**Comparison.** A kind is identified by its exact string: two kinds are the same kind exactly when their strings are equal ([§5](#5-document-model)), and two different strings are two unrelated kinds.

**Note.** Strings that differ only in case or Unicode normalization are different kinds. No part of a kind's spelling implies compatibility or order. A kind is not an address, even when it resembles a URI (invariant 6).

**What a kind decides.** The core leaves to a source's kind:

- what a source's `content` and its bindings' `content` may contain, and what they mean ([§5.3](#53-bindings), [§5.4](#54-sources));
- how a binding's target is identified ([§5.4](#54-sources));
- how caller-facing values correspond to interaction data: value adaptation and which data forms one value ([§5](#5-document-model));
- which results of an interaction are returned as output values ([§5.1](#51-operations));
- interaction mechanics: pattern, cardinality, framing, completion, and lifecycle (invariant 1);
- how a binary artifact is encoded in `content` ([§5.4](#54-sources));
- what context a realization requires, such as credentials ([§5](#5-document-model)).

A kind in turn stands on these core provisions, changes to which are breaking ([§8.1](#81-openbindings-field-specification-version)):

- **Kind strings.** A kind is an exact, opaque string, compared whole (above).
- **Content values.** `content` is any JSON value, and its presence is distinct from its value ([§5](#5-document-model)).
- **Content references.** `content` is outside the reference resolution of [§7](#7-reference-resolution).
- **Caller-facing values.** Caller-facing values are JSON values, and an operation's schemas apply to each value ([§5](#5-document-model), invariant 1).
- **Binding value claims.** A binding claims that its target realizes its operation as the document describes it, taking any value that satisfies `input`, without promising success on each. It also claims that the target returns only values that satisfy `output`. The claims about the values taken and the values returned each apply where the operation states the corresponding value contract ([§5.3](#53-bindings)).

**Sharing a kind (informative).** A kind is portable as far as its meaning is shared. Authors who want a kind read alike everywhere describe it in writing. They give an incompatible meaning a new kind, since nothing in a document distinguishes two meanings of one kind. A kind meant to circulate widely can be qualified under a name its publisher controls. The kind definitions this project drafts ([§14](#14-see-also-informative)) have no special standing here.

A kind used only privately needs no qualification. A source for a locally built CLI, described by a private `usage.kdl` file, might be:

```json
{
  "kind": "my-cli.usage@1",
  "content": { "location": "file:///home/user/project/usage.kdl" }
}
```

---

## 7. Reference resolution

A document's base URI is its own ([§7.2](#72-the-document-as-embedding)), so its OBI-defined references resolve identically however it was obtained (invariant 4). A same-document reference in the document resource resolves against the OBI document as [§7.2](#72-the-document-as-embedding) and [§7.3](#73-same-document-references) define. A reference to the URI that a schema the document contains declares with `$id` resolves to that schema ([§7.2](#72-the-document-as-embedding)). Other references resolve as [§7.4](#74-other-references) describes.

**OBI positions.** An **OBI position** is a place where the document model puts a schema, namely:

- an operation's `input` or `output`;
- an entry in the `schemas` map;
- every subschema reached from one of these through the keywords the JSON Schema 2020-12 meta-schema validates as schemas.

Those keywords are `$defs`, `properties`, `patternProperties`, `dependentSchemas`, `additionalProperties`, `propertyNames`, `items`, `prefixItems`, `contains`, `allOf`, `anyOf`, `oneOf`, `not`, `if`, `then`, `else`, `unevaluatedItems`, `unevaluatedProperties`, and `contentSchema`, with the legacy `definitions` and the schema values of the legacy `dependencies` (JSON Schema Validation, Appendix A).

OBI positions do not extend into a schema that declares `$id` (has an `$id` member). That schema is itself at an OBI position, but nothing inside it is, its own keywords other than `$id` included. They belong to the resource it declares ([§7.2](#72-the-document-as-embedding)).

The **schemas the document contains** are:

- the schemas at OBI positions;
- every subschema reached through the same keywords from a schema at an OBI position that declares `$id`, entering nested schemas that declare `$id` as well.

Nothing else in the document is a schema it contains. Wherever this specification uses these terms, a schema at an OBI position, or a schema the document contains, is any JSON object or boolean there. It is such a schema whether or not it is valid against the meta-schemas. Any other value there is not a schema.

### 7.1. Reference forms

The **OBI-defined references** are the `$ref` and `$dynamicRef` keywords in the [document resource](#3-terminology). [OBI-11](#10-conformance) fixes their form, and that of each schema `$id` at an OBI position. A same-document reference is empty or a fragment alone (RFC 3986 §4.4). A string that is not a well-formed URI-reference (RFC 3986 §4.1) is not a reference of any form.

### 7.2. The document as embedding

JSON Schema lets the format that embeds a schema determine its initial base URI (JSON Schema Core §9.1.1). It leaves open how such schemas fit its resource model (JSON Schema Core §4.3.5). This specification settles both:

- **Base URI.** The document is its schemas' embedding document, with a base URI unique to it and drawn from nowhere else (RFC 3986 §5.1.4). In the document resource, a same-document reference initially resolves to what [§7.3](#73-same-document-references) says it identifies, with dynamic resolution then following JSON Schema ([§7.4](#74-other-references)).
- **Document resource.** The schemas at OBI positions that declare no `$id` are subschemas of one schema resource, the **document resource**. The plain names those schemas declare with `$anchor` or `$dynamicAnchor` belong to the document resource. An evaluation that begins at one of those schemas begins in it, making the document resource the outermost in the evaluation's dynamic scope.
- **`$id` resources.** A schema that declares `$id` begins a resource of its own, as does a schema nested in it that declares `$id`. A reference to the URI such an `$id` declares resolves to that schema within the document. The references, anchors, and nested `$id`s within a schema that declares `$id`, including its own keywords other than `$id`, take any form JSON Schema allows. They resolve against its base. A plain name declared only inside a schema that declares `$id` belongs to that schema's resource.

### 7.3. Same-document references

In the document resource, a same-document reference identifies as follows:

1. **Decoding.** Its fragment, if any, is percent-decoded once. A fragment that does not decode to valid UTF-8 identifies nothing.
2. **Empty reference or fragment.** An empty reference or an empty fragment, such as `#`, identifies the OBI document itself, not the schema that contains it.
3. **JSON Pointer.** A decoded fragment that begins with `/`, such as that of `#/schemas/Task`, is a JSON Pointer evaluated per [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) §4 from the document root. A valid pointer identifies the location it reaches. One that is not valid, or reaches no location, identifies nothing.
4. **Plain name.** Any other fragment is a plain name, and identifies a schema in the document resource that declares it ([§7.2](#72-the-document-as-embedding)).

An `$anchor` or `$dynamicAnchor` declares a plain name only when its value is a string matching, as a whole, the grammar of JSON Schema Core §8.2.2. One whose value does not match violates [OBI-10](#10-conformance).

In the document resource, what a same-document reference identifies depends only on the document.

A pointer can reach locations that are not schemas at OBI positions. Such locations include an operation object, a map, a string, an extension's value ([§12](#12-extensions)), a source's or binding's `content`, and an example value. Another is a location inside a schema that declares `$id`, whose contents are reached through that `$id`. [§7.5](#75-notes-and-examples-informative) tabulates cases.

### 7.4. Other references

Beyond what [§7.2](#72-the-document-as-embedding) and [§7.3](#73-same-document-references) define, references resolve as JSON Schema 2020-12 defines. Those references are:

- dynamic references;
- references within a schema resource that declares `$id` (its plain names included);
- references to external schemas.

[OBI-13](#10-conformance) compares `$id`s only after the resolution and empty-fragment removal it names, and that resolution removes dot segments. So spellings that RFC 3986 §6 normalization would equate stay distinct for that rule. Whether they name one resource is for JSON Schema to say.

Within a schema resource that declares `$id`, each of the following has an undefined result ([§5.2](#52-schemas)):

- a JSON Pointer that reaches no schema (JSON Schema Core §9.4.2);
- a plain name declared twice in that resource (JSON Schema Core §8.2.2), or nowhere in it;
- a `$ref`, `$dynamicRef`, or `$id` that is not a well-formed URI-reference.

**Note.** Such a result does not make the document non-conformant.

Schema reference cycles are permitted: recursive types (trees, linked lists, ASTs) are legitimate and widespread. A cycle that recurses without consuming any of the instance has an undefined result ([§5.2](#52-schemas); JSON Schema Core §9.4.1). An example is a schema whose only keyword is a `$ref` to itself.

### 7.5. Notes and examples (informative)

What each schema rule covers:

| Rule | Covers | At a schema that declares `$id` |
| ---- | ------ | -------------------------------- |
| OBI-09 | `$schema` in every schema the document contains | Applies inside the resource |
| OBI-10 | Each operation `input`/`output` and `schemas` entry, with its subschemas, against the meta-schemas | Applies inside the resource |
| OBI-11 | `$ref` and `$dynamicRef` in the document resource; `$id` at OBI positions | That schema's `$id` only; its other keywords and contents belong to its resource |
| OBI-12 | Same-document references in the document resource | Not its own references; a pointer may reach it but not into it, and a plain name declared inside it does not count |
| OBI-13 | Plain names in the document resource; `$id` in every schema the document contains | Plain names inside it belong to its resource |

**Same-document references (example).** Given this document:

```json
{
  "openbindings": "0.2.0",
  "schemas": {
    "Task": {
      "$anchor": "task",
      "type": "object",
      "properties": { "my type": { "type": "string" } }
    },
    "Tree": {
      "$id": "https://example.com/schemas/tree.json",
      "$anchor": "tree",
      "type": "object",
      "properties": {
        "children": { "type": "array", "items": { "$ref": "#" } }
      }
    }
  },
  "operations": {}
}
```

each reference below, written in the document resource (as the `$ref` of an operation added to it, `{"output": {"$ref": "…"}}`), has the outcome shown:

| Reference | Read as | Outcome |
| --------- | ------- | ------- |
| `#` or the empty reference | The OBI document itself | Violates OBI-12: the document is not a schema |
| `#/schemas/Task` | A pointer to `Task` | Meets OBI-11 and OBI-12 |
| `#/schemas/Task/properties/my%20type` | A pointer, decoded to `/schemas/Task/properties/my type` | Meets OBI-11 and OBI-12 |
| `#/schemas/Task/properties/my type` | Not a well-formed URI-reference | Violates OBI-11 |
| `#/schemas/Task/properties/my%2520type` | Decoded once, to `/schemas/Task/properties/my%20type`, which reaches nothing | Violates OBI-12 |
| `#%2Fschemas%2FTask` | Decoded to `/schemas/Task`, a pointer | Meets OBI-11 and OBI-12 |
| `#/schemas/Task/type` | A pointer to the string `"object"` | Violates OBI-12: not a schema |
| `#/operations` | A pointer to a map | Violates OBI-12: not a schema |
| `#/schemas/Missing` | A pointer that reaches nothing | Violates OBI-12 |
| `#/schemas/~2` | Not a valid JSON Pointer (`~2` is no escape) | Violates OBI-12 |
| `#/schemas/Tree` | A pointer landing on `Tree`, which declares `$id` | Meets OBI-11 and OBI-12 (JSON Schema Core §9.2.1 advises against this form for an embedded resource; reference `Tree` through its `$id`) |
| `#/schemas/Tree/properties/children` | A pointer into Tree's resource, which is not an OBI position | Violates OBI-12: reach it through the `$id` |
| `#task` | A plain name declared in the document resource | Meets OBI-11 and OBI-12 |
| `#t%61sk` | Decoded to the plain name `task` | Meets OBI-11 and OBI-12 (though a plain name never needs encoding: its grammar admits only characters a fragment allows) |
| `#tree` | A plain name declared only inside Tree's resource | Violates OBI-12 |
| `#%FF` | A fragment that does not decode to UTF-8 | Violates OBI-12 |
| `tree.json#/properties/children` | A relative reference that is not same-document | Violates OBI-11 |
| `https://example.com/schemas/tree.json#/properties/children` | An absolute URI | Meets OBI-11; outside OBI-12, and resolves as JSON Schema defines |

The `{"$ref": "#"}` inside `Tree` resolves against Tree's `$id`, names `Tree` itself, and is outside OBI-12.

Schemas pasted in from standalone files are the usual source of mistakes. Such a schema often recurses with `{"$ref": "#"}` or points into its own `$defs` with `#/$defs/Node`. Embedded without an `$id`, both are read from the OBI document root. The first then identifies the OBI document and the second nothing, and both violate OBI-12. There are two remedies:

- **Rewrite the pointers.** Rewrite the pointers to the schema's place in the document (`#/schemas/Tree`, `#/schemas/Tree/$defs/Node`). A name that needs encoding, such as `my type`, is written percent-encoded (`#/schemas/Tree/$defs/my%20type`).
- **Give it an `$id`.** Give the embedded schema an absolute `$id`. That keeps its internal references resolving as they did standalone, resolved as JSON Schema defines (pointers per RFC 6901 §6). The `$id` also moves those references outside OBI-12, so a pointer inside it that reaches nothing no longer violates OBI-12. Its result is undefined ([§7.4](#74-other-references)).

The second remedy looks like this:

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
    "getTree": {
      "input": { "type": "object", "maxProperties": 0 },
      "output": { "$ref": "https://example.com/schemas/tree.json" }
    }
  }
}
```

Addressing works in one direction. The document's base URI is drawn from nowhere a reference can name ([§7.2](#72-the-document-as-embedding)). So a schema with its own `$id` cannot address by URI the schemas that belong to the document resource. Any shared schema it references must therefore be reachable through an identified resource. Either the shared schema has its own `$id`, or a pointer or anchor within a resource that has one reaches it. The same holds across documents: `$id` is the portable handle for a schema meant to be referenced from elsewhere. A reference into a document that is not a schema lands in a structure JSON Schema does not recognize. Its result there is undefined (JSON Schema Core §9.4.2). Examples are `#/components/schemas/Task` in an OpenAPI document and `#/schemas/Task` in another OBI. An author instead copies such a schema in, translating it as [§5.2](#52-schemas) describes, or references a schema published as a schema document of its own.

Dynamic resolution can still cross back. Consider a `$dynamicRef` inside an `$id` resource whose initially resolved fragment was created by `$dynamicAnchor`. When evaluation begins in the document resource, it can resolve, through the dynamic scope, to a `$dynamicAnchor` of the document resource (JSON Schema Core §8.2.3.2). A `$dynamicAnchor` declared anywhere in the document resource can therefore capture such a reference in a schema written without it in mind.

---

## 8. Versioning

OBI documents carry two independent version concepts: the specification version the document is written against, and an author-controlled label for the interface itself.

### 8.1. `openbindings` field (specification version)

The `openbindings` field identifies the version of this specification the document declares: a [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) string ([OBI-03](#10-conformance)).

**Lines.** A document's members mean what a release of the line its declared version names (its `major.minor`) says they mean. Where a document declares a prerelease, its members mean instead what that prerelease's text says (below). Until a line's first release, its working draft stands in for that release wherever this text speaks of a release of the line. Each line or prerelease is its own document model.

A patch release corrects errors in its line's text and adds no field. A document that conforms under an earlier and a later release of its line means the same under each. But a correction can change which documents conform (invariant 5). A patch release's corrections apply to the whole line, so the patch number a document declares carries no meaning. For instance, `0.2.0` and `0.2.1` are read alike, under any release of the 0.2 line.

From 1.0.0 onward, a document that conforms to one minor would conform to the next if it declared it, and keep its meaning. Pre-1.0 minors may break (release policy, below).

- A prerelease (`0.2.0-rc.1`) is a distinct, potentially incompatible draft outside its line, identified by its full version apart from build metadata.
- A document declaring a prerelease means what that draft's text says.
- Build metadata is permitted and has no OpenBindings semantics: `0.2.0+build.1` denotes the same line as `0.2.0`, and `0.2.0-rc.1+build.1` the same prerelease as `0.2.0-rc.1`.
- Declaring the earliest line sufficient for a document's content lets the most software read the document.

**Version declaration.** A text **declares a version** exactly when all of these hold:

- it is UTF-8 ([RFC 3629](https://www.rfc-editor.org/rfc/rfc3629)) with no leading byte-order mark;
- it parses under the JSON grammar (RFC 8259 §2) as an object with exactly one `openbindings` member ([§5](#5-document-model));
- that member's value is a string that is a SemVer version.

That value is the version it declares. Repeated names elsewhere do not stop a declaration. The declared line's rules govern them. Any other text declares no version, and violates OBI-01 or OBI-03 ([§10](#10-conformance)).

**Version declaration examples (informative).** What each text below declares, and what follows under the 0.2 line's rules. In the texts, `<FF>` stands for a single byte 0xFF and `<BOM>` for the UTF-8 byte-order mark.

| Text | Declared version | Under 0.2's rules |
| ---- | ---------------- | ----------------- |
| `{"openbindings":"0.2.0","operations":{}}` | 0.2.0 | Conforms. |
| `{"openbindings":"0.2.7","operations":{}}` | 0.2.7 | Conforms; the patch number carries no meaning. |
| `{"openbindings":"0.2.0+build.5","operations":{}}` | 0.2.0+build.5 | Conforms; build metadata carries no meaning. |
| `{"openbindings":"0.3.0","operations":{}}` | 0.3.0 | Not governed by them: 0.3's text governs it. |
| `{"openbindings":"0.2.0-rc.1","operations":{}}` | 0.2.0-rc.1 | Not governed by them: that prerelease's text governs it. |
| `{"openbindings":"0.3.0","operations":{},"operations":{}}` | 0.3.0 | Not governed by them; the repeated `operations` member falls under 0.3's rules. |
| `{"openbindings":"0.2.0","operations":{},"operations":{}}` | 0.2.0 | Violates OBI-01. |
| `{"openbindings":"0.3.0","description":"x<FF>","operations":{}}` | None: the text is not UTF-8 | Violates OBI-01. |
| `<BOM>{"openbindings":"0.3.0","operations":{}}` | None | Violates OBI-01. |
| `{"openbindings":"0.2.0","openbindings":"0.3.0","operations":{}}` | None: the member is repeated | Violates OBI-01. |
| `{"openbindings":"0.3","operations":{}}` | None | Violates OBI-02 and OBI-03. |
| `{"openbindings":2,"operations":{}}` | None | Violates OBI-02 and OBI-03. |
| `{"operations":{}}` | None | Violates OBI-02 and OBI-03. |

**Release policy.** While pre-1.0, minor versions may include breaking changes, per pre-1.0 SemVer convention. Changes to the provisions [§6](#6-kinds) lists as those a kind stands on are breaking. They are recorded in the changelog as breaking, whether or not a particular kind's definition is affected.

### 8.2. `version` field (interface-version label)

The optional `version` field is the author's label for the described interface. It is an opaque non-empty string, the same label as another exactly when their strings are equal ([§5](#5-document-model)). This specification gives it no other meaning. Authors MAY follow SemVer, dates, or any other convention. Any stronger reading comes from an external catalog, registry, or organizational policy.

**Note.** This specification gives the `version` field no order, compatibility, or identity. The field has no effect on how a reference resolves or on the line or prerelease a document declares.

---

## 9. Security considerations

Processing OBI documents involves parsing untrusted JSON, optionally obtaining external artifacts and schemas, resolving references, and acting on `content` that may include author-supplied expressions. The threat surface is comparable to that of JSON Schema processors and artifact-consuming tools generally (SSRF, resource exhaustion, untrusted code evaluation, content confusion). The document format creates the following exposure:

- **URIs as attack vectors.** Addresses a tool reads from a source's or binding's `content`, and schema `$ref` values, may resolve to arbitrary endpoints, network or local. These endpoints include internal or link-local addresses such as `http://169.254.169.254/...` and local files such as `file:///etc/passwd`. Unrestricted dereferencing inherits SSRF and exfiltration exposure. Moving a document does not change what its OBI-defined references resolve to (invariant 4).
- **Unbounded size.** The specification caps the size of neither OBI documents nor the artifacts and schemas they reference. Untrusted input creates memory and processing-time exhaustion exposure.
- **Regular-expression cost.** Schema `pattern` and `patternProperties` values run on the evaluating tool's regular-expression engine. A backtracking engine can take exponential time on crafted input.
- **Schema `$ref` cycles.** Permitted by [§7](#7-reference-resolution); naive resolvers can exhaust the stack or loop indefinitely.
- **Identifier shadowing.** An `$id` can claim any URI, including a meta-schema's or one another document declares. A tool might register the schema resources of every document it reads in one shared registry. One document can then change how another's references, or its meta-schema lookups, resolve (JSON Schema Core §13).
- **Executable content.** `content` may carry expressions or other executable material. Untrusted documents can embed expressions designed to run without bound or to reach host state.
- **Dependencies are not trust claims.** A matching operation name or kind establishes neither the authenticity nor the authorization of whatever supplies a realization. A realization found that way, and the values it supplies, stay untrusted until other means establish trust in them.
- **Integrity is out of scope.** Authenticity and integrity are established by external means (transport security, content signing, out-of-band attestation) or not at all. [Appendix A](#appendix-a-canonical-serialization-informative) names a deterministic serialization such systems can build on.

Common measures against these exposures, where documents come from untrusted origins:

- allowing only expected URI schemes and network ranges to be dereferenced, checked after DNS resolution and at each redirect;
- capping the size of fetched documents, schemas, and source artifacts;
- bounding the cost of regular-expression matching;
- isolating and bounding the evaluation of any expressions `content` carries;
- enforcing transport security;
- keeping each document's schema resources apart from other documents' and from the meta-schemas;
- bounding traversal through recursive schemas and through references followed in `content`.

---

## 10. Conformance

The rules below govern two kinds of text:

- a text that declares a version of the 0.2 line (in a prerelease of this specification, instead, one that declares that prerelease);
- a text that declares no version ([§8.1](#81-openbindings-field-specification-version)).

A text declaring another line or prerelease is governed by the text of that line or prerelease. A text these rules govern conforms to this specification exactly when it meets every rule below. OBI-02 to OBI-13 apply only to the JSON value of a text that meets OBI-01.

The rules use the terms the other sections define for every text they govern. Such terms include the version a text declares, a schema at an OBI position, what a same-document reference identifies, and a declared plain name. The meaning those sections give a document's members holds only for a conformant document. Text marked *Note* in a rule, which runs to the rule's end, explains it and adds no requirement.

**Note.** No rule depends on evaluating a value against the document's schemas.

The prose defines the document model. The schema `openbindings.schema.json` expresses the model's structural part in JSON Schema, and the structural requirements of [§5](#5-document-model) take effect through OBI-02. The schema's `$id` names the line, and its title the release. The schema also expresses OBI-03, OBI-04, and the name syntax of the references OBI-06 to OBI-08 concern. For OBI-05 it expresses only an alias repeated within one operation's `aliases`. For OBI-09 it expresses only the value of a `$schema` at the top of each operation `input` and `output` and each `schemas` entry. A document violating those parts violates OBI-02 as well. The other rules apply beyond what the schema expresses.

Each rule carries an identifier for test suites and errata to cite. A rule is cited under a line ([§8.1](#81-openbindings-field-specification-version)). An identifier means what that line's text says, and another line may number its rules differently. A patch release adds and renumbers no rule.

A conformant OBI document:

- **OBI-01**: Is valid UTF-8 ([RFC 3629](https://www.rfc-editor.org/rfc/rfc3629)) encoded JSON per [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259), with no leading byte-order mark and no object holding two members whose names are equal ([§5](#5-document-model)). *Note:* parsers differ on repeated names and on a leading byte-order mark, so the same bytes could yield different values. Excluding both follows RFC 8259 §8.1, which forbids adding a byte-order mark, and interoperable-JSON practice ([RFC 7493](https://www.rfc-editor.org/rfc/rfc7493) §2.3).
- **OBI-02**: Is valid against the derived JSON Schema published with this text (`openbindings.schema.json`, `$id` `https://openbindings.com/schema/openbindings-0.2.json`), its `pattern` values read as ECMA-262 regular expressions. Where the schema and the prose disagree, the schema governs this rule until a patch release corrects the erratum. A patch release that corrects the schema republishes it under the same `$id`.
- **OBI-03**: Has an `openbindings` field whose value is a valid [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) string.
- **OBI-04**: Has every map key this specification defines (operation, dependency, binding, source, schema, and example keys) and every entry of an operation's `aliases` array a string matching `^[A-Za-z0-9_][A-Za-z0-9_.-]*$`. The pattern is an ECMA-262 regular expression matched against the whole name. Property names inside JSON Schema objects are schema content, not map keys, and are unconstrained by this rule.
- **OBI-05**: Has no string occurring more than once among all operations' keys and `aliases` entries taken together.
- **OBI-06**: Has every `bindings[*].operation` value present as a key in the document's `operations` map.
- **OBI-07**: Has every `bindings[*].source` value present as a key in the document's `sources` map.
- **OBI-08**: Has every `dependencies[*].operation` value present as a key in the document's `operations` map.
- **OBI-09**: Has every `$schema` keyword in a schema the document contains ([§3](#3-terminology)) equal to `https://json-schema.org/draft/2020-12/schema` or `https://json-schema.org/draft/2020-12/schema#`.
- **OBI-10**: Has every operation `input` and `output` and every entry in `schemas` valid against the JSON Schema 2020-12 meta-schemas, which validate its subschemas in turn ([§5.2](#52-schemas)). The meta-schemas are the dialect meta-schema `https://json-schema.org/draft/2020-12/schema` and the vocabulary meta-schemas it references, as published with [JSON Schema Core](#131-normative-references). They apply with `format` as an annotation, JSON Schema's default (JSON Schema Validation §7.2.1). Their `pattern` values are read as ECMA-262 regular expressions, the regular-expression dialect JSON Schema names (JSON Schema Core §6.4).
- **OBI-11**: Has every schema `$ref` and `$dynamicRef` in the document resource ([§3](#3-terminology)) an absolute URI or a same-document reference, and every schema `$id` at an OBI position an absolute URI. All of them are also well-formed URI-references per [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) §4.1 ([§7.1](#71-reference-forms)).
- **OBI-12**: Has every same-document schema `$ref` and `$dynamicRef` in the document resource identifying a schema at an OBI position ([§7.3](#73-same-document-references)).
- **OBI-13**: Has no plain name ([§7.3](#73-same-document-references)) declared more than once in the document resource, and no `$id` declared by two schemas the document contains. In counting a plain name's declarations, each `$anchor` and each `$dynamicAnchor` that declares it counts once (JSON Schema Core §8.2.2). An `$id` is compared only when it is a well-formed URI-reference and one of these holds:
  - it is an absolute URI;
  - it resolves against the `$id` of the nearest enclosing schema that declares one, and that `$id` is itself compared.

  Every other `$id` is left out of the comparison ([§7.4](#74-other-references)). For that comparison, each compared `$id` is:

  1. resolved to an absolute URI per RFC 3986 §5.2 (which removes dot segments);
  2. stripped of any empty fragment;
  3. compared as a string ([§5](#5-document-model)).

---

## 11. IANA considerations

This specification defines the registration details for the OpenBindings JSON media type. The IANA registries are authoritative for current registration status.

Per [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838), under the vendor tree:

- **Type name:** application
- **Subtype name:** vnd.openbindings+json
- **Required parameters:** none
- **Optional parameters:** none
- **Encoding considerations:** binary, as for `application/json` ([RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)); OBI documents are UTF-8 encoded JSON ([OBI-01](#10-conformance))
- **Security considerations:** see [§9. Security considerations](#9-security-considerations)
- **Interoperability considerations:** see [§10. Conformance](#10-conformance)
- **Published specification:** this specification
- **Applications that use this media type:** tools that produce or consume OpenBindings documents
- **Fragment identifier considerations:** JSON Pointer per [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901), or a plain name declared by `$anchor` or `$dynamicAnchor` in the document resource ([§7.3](#73-same-document-references); JSON Schema Core §8.2.2). Such a fragment identifies a location in the representation; the document resource itself has no portable, externally nameable base, so its schemas cannot be addressed from outside the document as schema resources ([§7.2](#72-the-document-as-embedding))
- **Additional information:** deprecated alias names, magic numbers, file extensions, and Macintosh file type codes: none
- **Person and email address to contact for further information:** the OpenBindings maintainers, hello@openbindings.com; see also [github.com/openbindings](https://github.com/openbindings)
- **Intended usage:** COMMON
- **Restrictions on usage:** none
- **Author:** the OpenBindings maintainers
- **Change controller:** openbindings project

---

## 12. Extensions

A field ([§3](#3-terminology)) whose name begins with `x-` is an **extension**; OBI documents MAY include extensions in any OBI-defined object. An extension never changes the meaning of a core field; its own meaning, if any, is defined outside this specification. Unprefixed field names are reserved ([§5](#5-document-model), [OBI-02](#10-conformance)) so this specification can add fields without colliding with a document's own data.

Keys inside the document's maps (`operations`, `dependencies`, `sources`, `bindings`, `schemas`, and an operation's `examples`) are entry names, not fields: an `x-`-prefixed key there names an ordinary entry, subject to OBI-04 like any other key, and in `operations` it enters the identifier namespace (OBI-05).

---

## 13. References

### 13.1. Normative references

- **[BCP 14]** Best Current Practice 14: S. Bradner, "Key words for use in RFCs to Indicate Requirement Levels," RFC 2119, March 1997; and B. Leiba, "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words," RFC 8174, May 2017. <https://www.rfc-editor.org/info/bcp14>
- **[RFC 8259]** T. Bray, Ed., "The JavaScript Object Notation (JSON) Data Interchange Format," RFC 8259, December 2017. <https://www.rfc-editor.org/rfc/rfc8259>
- **[RFC 3629]** F. Yergeau, "UTF-8, a transformation format of ISO 10646," STD 63, RFC 3629, November 2003. <https://www.rfc-editor.org/rfc/rfc3629>
- **[RFC 3986]** T. Berners-Lee, R. Fielding, L. Masinter, "Uniform Resource Identifier (URI): Generic Syntax," RFC 3986, January 2005. <https://www.rfc-editor.org/rfc/rfc3986>
- **[RFC 6838]** N. Freed, J. Klensin, T. Hansen, "Media Type Specifications and Registration Procedures," RFC 6838, January 2013. <https://www.rfc-editor.org/rfc/rfc6838>
- **[RFC 6901]** P. Bryan, Ed., K. Zyp, M. Nottingham, Ed., "JavaScript Object Notation (JSON) Pointer," RFC 6901, April 2013. <https://www.rfc-editor.org/rfc/rfc6901>
- **[SemVer 2.0.0]** Tom Preston-Werner, "Semantic Versioning 2.0.0." <https://semver.org/spec/v2.0.0.html>
- **[JSON Schema Core]** A. Wright, H. Andrews, B. Hutton, G. Dennis, "JSON Schema: A Media Type for Describing JSON Documents," draft-bhutton-json-schema-01 (Draft 2020-12), June 2022, including its meta-schemas. <https://json-schema.org/draft/2020-12/json-schema-core>
- **[JSON Schema Validation]** A. Wright, H. Andrews, B. Hutton, "JSON Schema Validation: A Vocabulary for Structural Validation of JSON," draft-bhutton-json-schema-validation-01 (Draft 2020-12), June 2022. <https://json-schema.org/draft/2020-12/json-schema-validation>
- **[ECMA-262]** Ecma International, "ECMAScript 2020 Language Specification," ECMA-262, 11th edition, June 2020, for its regular-expression grammar and semantics, the edition JSON Schema 2020-12 cites. <https://262.ecma-international.org/11.0/>

### 13.2. Informative references

- **[RFC 7493]** T. Bray, Ed., "The I-JSON Message Format," RFC 7493, March 2015. <https://www.rfc-editor.org/rfc/rfc7493>. Cited by [OBI-01](#10-conformance) and [Appendix A](#appendix-a-canonical-serialization-informative).
- **[RFC 8785]** A. Rundgren, B. Jordan, S. Erdtman, "JSON Canonicalization Scheme (JCS)," RFC 8785, June 2020. <https://www.rfc-editor.org/rfc/rfc8785>. Cited by [Appendix A](#appendix-a-canonical-serialization-informative).

---

## 14. See also (informative)

- `openbindings.schema.json`: derived JSON Schema for structural document validity.
- The openbindings project's shared-contract interfaces, published at [openbindings.com/interfaces](https://openbindings.com/interfaces).
- `binding-specs/`: candidate kind definitions this project is drafting, with authoring guidance ([§6](#6-kinds)).
- `conformance/`: test corpus keyed to rule identifiers and sections.
- `examples/`: example OBI documents; like this text's examples, their kinds (`example.*`) and the shapes of their `content` are illustrative.
- `CHANGELOG.md`: version history and diffs between specification versions.
- `EDITORS.md`: current editor roster.
- `GOVERNANCE.md`: project governance and decision-making.
- `SECURITY.md`: vulnerability reporting and security contact.

---

## Appendix A. Canonical serialization (informative)

Some applications need a stable byte representation of an OBI document: content addressing, integrity attestation, signature systems, cache keys, prompt-cache stability. This appendix names one so tools and downstream specifications can refer to it consistently.

For an OBI whose parsed JSON value satisfies the input requirements of [RFC 8785 (JSON Canonicalization Scheme)](https://www.rfc-editor.org/rfc/rfc8785), its JCS serialization provides deterministic bytes for the carried JSON value, and carries that value exactly when every number's exact decimal value survives JCS's binary64 rendering (below). The facility is **partial**: RFC 8785 constrains its input to the I-JSON subset ([RFC 7493](https://www.rfc-editor.org/rfc/rfc7493): numbers representable in IEEE 754 binary64, strings expressible as Unicode), while this specification pins RFC 8259 JSON and JSON Schema 2020-12, which bound neither, so a conformant OBI may have no JCS serialization.

The facility is JCS over the value exactly as carried. Rounding, coercing, repairing, or otherwise changing a value to manufacture compatible input yields the serialization of some other value, and RFC 8785 rejects incompatible input; where canonical bytes feed hashes, signatures, or equality, a changed value would attest to data other than what the author supplied. JCS also serializes each number from its binary64 value, so a number whose exact decimal value differs from the shortest rendering of that value (`1000000000000000128` is serialized as `1000000000000000100`) is not carried exactly. Under this specification's reading of numbers ([§5](#5-document-model)), such an OBI has no JCS serialization that carries its value exactly, though RFC 8785 itself does not reject it.

Canonical serialization is syntactic: JCS sorts object member names and preserves array order, and performs no semantic normalization such as rewriting `{}` to `true`, resolving or bundling references, inserting defaults, dropping extensions, or interpreting embedded `content`. Two OBIs that mean the same thing can have different canonical bytes, and equal bytes establish equal carried JSON data, not behavioral equivalence or document identity. Naming a serialization defines no integrity system ([§9](#9-security-considerations)): digest algorithms, signature envelopes, carrier fields, and trust policy belong to downstream specifications, and JCS covers only the JSON value carried in the OBI itself, never fetched external resources.

[Terminology]: #3-terminology
