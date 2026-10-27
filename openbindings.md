# OpenBindings Specification (v0.2.0)

## Abstract

OpenBindings is a portable interface description format; its documents are OBIs (OpenBindings interface documents). An OBI declares each operation once, as a protocol-independent capability with optional per-value input and output schemas, then relates it to concrete realizations through bindings and to named consumption points through dependencies.

```json
{
  "openbindings": "0.2.0",
  "operations": {
    "createTask": {
      "input": {
        "type": "object",
        "properties": {
          "title": {"type": "string"}
        },
        "required": ["title"]
      },
      "output": {
        "type": "object",
        "properties": {
          "id": {"type": "string"}
        }
      }
    }
  },
  "bindings": {
    "createTask.http": {
      "operation": "createTask",
      "kind": "example.openapi@1",
      "content": {
        "document": {"location": "https://example.com/openapi.json"},
        "target": "#/paths/~1tasks/post"
      }
    }
  }
}
```

The kinds in this document's examples (`example.openapi@1`, `example.mcp@1`, `example.grpc@1`, `my-cli.usage@1`) and the shapes of their `content`, such as `{ "document": …, "target": … }` on a binding, are illustrative; only a kind gives `content` meaning ([§6](#6-kinds)).

New readers may prefer the [§4. Overview](#4-overview-informative) walkthrough. The notational conventions below, and the text from [§1. Positioning and scope](#1-positioning-and-scope) on, are normative except where marked informative. Conformance is defined by the numbered rules of [§10](#10-conformance).

## Editors

- Matthew Clevenger ([@clevengermatt](https://github.com/clevengermatt))

See `EDITORS.md` for the current editor roster.

## Status of this document

This is **version 0.2.0** of the OpenBindings specification. This text is the unreleased working draft of that version; the latest release is **0.1.0** (immutable released snapshots live under `versions/`). It is pre-1.0, and minor-version revisions may include breaking changes per [§8. Versioning](#8-versioning). Substantive changes are recorded in `CHANGELOG.md` and cite rule identifiers (`OBI-##`) where applicable, each under the version it belongs to.

**Binding/resources revision.** This working draft places `kind` on bindings and replaces `sources` and `schemas` with optional `resources`. [RESOURCE-MODEL-DRAFT.md](RESOURCE-MODEL-DRAFT.md) records the decisions and migration status. Earlier 0.2 corpora and kind candidates have not been migrated wholesale; they are not evidence for this revised model.

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
  - [1.1. Out of scope](#11-out-of-scope)
- [2. Invariants](#2-invariants)
- [3. Terminology](#3-terminology)
- [4. Overview (informative)](#4-overview-informative)
- [5. Document model](#5-document-model)
  - [5.1. Operations](#51-operations)
  - [5.2. Schemas](#52-schemas)
  - [5.3. Bindings](#53-bindings)
  - [5.4. Resources](#54-resources)
  - [5.5. Dependencies](#55-dependencies)
- [6. Kinds](#6-kinds)
- [7. Reference resolution](#7-reference-resolution)
  - [7.1. Schema recognition](#71-schema-recognition)
  - [7.2. The document as embedding](#72-the-document-as-embedding)
  - [7.3. Same-document references](#73-same-document-references)
  - [7.4. Other references](#74-other-references)
  - [7.5. Notes and examples (informative)](#75-notes-and-examples-informative)
  - [7.6. Shared-value references](#76-shared-value-references)
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

This specification defines an interface document model, not a client-server protocol or runtime API. An OBI may be authored and supplied by anyone, independently of the software it describes.

OpenBindings sits one layer above protocol-specific interface specifications such as OpenAPI, AsyncAPI, gRPC, and MCP. Those describe how to interact with particular protocols and endpoints. An OBI describes the operations software can perform and the realizations bindings declare for them. It also describes which operations that software consumes and the published names by which operations can be recognized. It relates all of these across protocols, complementing the artifacts its bindings carry, reference, or otherwise use.

### 1.1. Out of scope

This specification defines the document envelope and the input and output schemas governing each operation's caller-facing values. How a binding is read, beginning with what its `content` means, is left to its kind (invariant 3; [§6](#6-kinds) lists the matters). Wherever this specification says a matter is read under a binding's kind, it marks this boundary. It neither asserts that the kind is defined anywhere nor lets a kind's definition change the document model.

This specification does not say:

- whether or when an operation is invoked;
- how calls are managed (lifecycle, retries, credential flow, rate limiting);
- which binding carries out a call (`preference` and `deprecated` are only author signals, [§5.3](#53-bindings));
- what realization serves a dependency beyond its `kinds` constraint ([§5.5](#55-dependencies)).

OpenBindings also does not:

- **Serve as an authoring language.** It defines the interchange document. Authoring tools and compilation workflows, such as TypeSpec and Smithy, are outside it.
- **Define acquisition or publication.**
- **Maintain registries** (invariant 6).

---

## 2. Invariants

The model rests on six invariants, cited elsewhere by number. Most of their terms are defined in [§3](#3-terminology).

1. **Per-value schemas.** Operation `input` and `output` schemas govern each value that crosses the operation's caller-facing boundary, one value at a time. Interaction pattern, cardinality, framing, completion, and lifecycle are interpreted according to each binding's kind.
2. **Declaration, not availability.** A binding declares a realization of its operation under its own kind. It does not assert that the realization is available, and the document alone need not suffice to identify or reach its target. A dependency carries no target ([§5.5](#55-dependencies)).
3. **Bounded interpretation.** The operation carries the schemas governing its caller-facing input and output values. This specification defines neither the meaning of binding `content` nor how a binding's target is addressed, represented, referenced, adapted to, or interacted with. A kind does not change the meaning this specification assigns to fields.
4. **Location-independent references.** No schema reference in the document resource ([§7](#7-reference-resolution)) resolves against the URI a document was fetched from, so the meaning this specification assigns to a document is the same however it was obtained. This specification does not scan binding `content` for references. A kind can adopt the shared-value lookup of §7.6; its other references remain outside the resolution rules defined here (invariant 3). This specification assigns no document identity. `name` and `version` are labels.
5. **Self-contained conformance.** Whether a document conforms to a release of this specification depends only on:
   - the document;
   - that release's text;
   - the derived schema published with that release ([OBI-02](#10-conformance));
   - the normative references the text's rules cite, the JSON Schema 2020-12 meta-schemas among them ([OBI-10](#10-conformance)).

   Releases of one line differ about a document only where a later release corrects an earlier one's text ([§8.1](#81-openbindings-field-specification-version)).
6. **Decentralized naming.** Kinds and published names are author-assigned. This specification assigns no authority over them and provides no registry or ownership test. The model requires no registry, and a kind is a name, not an address ([§6](#6-kinds)).

---

## 3. Terminology

- **OBI**: an OpenBindings interface document.
- **Operation**: a named, protocol-independent capability declared under a key in `operations`. Its identifiers name the capability, its description conveys what it does, and its optional input and output schemas govern each caller-facing value ([§5.1](#51-operations)).
- **Alias**: an additional name under which an operation is recognized. A string equal to it identifies the operation exactly as its key does ([§5.1](#51-operations)).
- **Correspondence**: an operation that carries a published name as its key or an alias **claims correspondence with** the operation that name identifies. The claim is read against each published set of operations a reader holds that includes the name. The claim is the author's alone ([§5.1](#51-operations)).
- **Caller-facing**: said of the values an operation is about. A caller sends them to it and receives them from it on the operation's side of a binding. The operation's input and output schemas govern them where present.
- **Author claim**: one of the claims [§5](#5-document-model) lists, which a document makes and whose truth is outside conformance.
- **Binding**: an author-declared realization of an operation under a kind, under a key in `bindings` ([§5.3](#53-bindings)).
- **Realization**: a concrete way of carrying out an operation through a target. A binding declares one ([§5.3](#53-bindings)) and a dependency consumes one ([§5.5](#55-dependencies)), each as an author claim.
- **Shared resource**: a named JSON value in `resources`, available for use by references. Its use determines its interpretation; storing it declares no kind or capability ([§5.4](#54-resources)). This is distinct from a JSON Schema resource.
- **Kind**: the exact, opaque, non-empty string a binding carries in `kind` and a dependency may list in `kinds`. It selects how the binding is read ([§6](#6-kinds)).
- **Dependency**: a named point where the software described by the OBI consumes a realization of an operation, optionally limited to declared kinds, under a key in `dependencies` ([§5.5](#55-dependencies)).
- **OBI position**: a schema position in the document resource, or the root of an identified schema resource reached from it. The **schemas the document contains** and their resource membership are determined by the recognition procedure of [§7.1](#71-schema-recognition).
- **Document resource**: the anonymous schema resource containing recognized schemas with no intervening `$id` ([§7.2](#72-the-document-as-embedding)).
- **Field**: a member of an OBI-defined object (the document root, and operation, dependency, binding and example objects). Keys inside the document's maps and property names inside JSON Schema objects are not fields ([§12](#12-extensions), [OBI-04](#10-conformance)).
- **Absolute URI**: a URI with a scheme (RFC 3986 §3), fragment permitted; not RFC 3986's `absolute-URI` production, which excludes fragments.

Additional terms are defined where they are used.

---

## 4. Overview (informative)

OpenBindings separates operations (capabilities with per-value schemas) from declared realizations (bindings carrying their own kinds) and named consumption points (dependencies). A single OBI can bind an operation over multiple protocols, depend on an operation, or do both without redefining the operation.

Every OBI declares a specification version and an operations map. The minimal conformant document is just those two fields:

```json
{
  "openbindings": "0.2.0",
  "operations": {}
}
```

Each binding carries its own kind and content. Optional resources hold shared values; their uses determine their interpretation. This fuller OBI:

- binds `createTask` over two protocols;
- shares a schema between operations;
- describes an error shape beside a result;
- adapts a target's wire shape in binding content;
- claims correspondence through a qualified alias (a reader holding a published set of operations that includes `createTask` may read its key the same way).

```json
{
  "openbindings": "0.2.0",
  "name": "Task Manager",
  "operations": {
    "createTask": {
      "description": "Create a new task.",
      "aliases": ["acme.tasks.createTask"],
      "input": {
        "type": "object",
        "properties": {
          "title": {"type": "string"}
        },
        "required": ["title"]
      },
      "output": {
        "anyOf": [
          {"$ref": "#/resources/Task"},
          {"$ref": "#/resources/Problem"}
        ]
      }
    },
    "listTasks": {
      "description": "List all tasks.",
      "input": {"type": "object", "maxProperties": 0},
      "output": {
        "anyOf": [
          {
            "type": "array",
            "items": {"$ref": "#/resources/Task"}
          },
          {"$ref": "#/resources/Problem"}
        ]
      }
    }
  },
  "bindings": {
    "createTask.http": {
      "operation": "createTask",
      "kind": "example.openapi@1",
      "content": {
        "document": {"$ref": "#/resources/httpApi"},
        "target": "#/paths/~1tasks/post",
        "outputTransform": "{ \"id\": task_id, \"title\": task_title, \"done\": is_done }"
      }
    },
    "createTask.mcp": {
      "operation": "createTask",
      "kind": "example.mcp@1",
      "content": {
        "document": {"location": "https://example.com/mcp"},
        "target": "tools/create_task"
      }
    },
    "listTasks.http": {
      "operation": "listTasks",
      "kind": "example.openapi@1",
      "content": {
        "document": {"$ref": "#/resources/httpApi"},
        "target": "#/paths/~1tasks/get",
        "outputTransform": "[$.{ \"id\": task_id, \"title\": task_title, \"done\": is_done }]"
      }
    }
  },
  "resources": {
    "Task": {
      "type": "object",
      "properties": {
        "id": {"type": "string"},
        "title": {"type": "string"},
        "done": {"type": "boolean"}
      },
      "required": ["id", "title"]
    },
    "Problem": {
      "type": "object",
      "properties": {
        "problem": {"type": "string"}
      },
      "required": ["problem"],
      "additionalProperties": false
    },
    "httpApi": {"location": "https://example.com/openapi.json"}
  }
}
```

Here `target` and `outputTransform` illustrate one possible reading of `example.openapi@1` ([§5.3](#53-bindings)). Under that reading, each HTTP binding's transform applies to success responses and an error response's body passes through as a `Problem` value.

Declaring an operation does not assert that a realization is available. A binding declares a realization of it under a kind, and a dependency declares a named consumption point for which a realization can be supplied:

```json
{
  "openbindings": "0.2.0",
  "operations": {
    "events.deliver": {
      "aliases": ["acme.events.deliver"],
      "input": {"type": "object"},
      "output": {"type": "object", "maxProperties": 0}
    }
  },
  "dependencies": {
    "customerDelivery": {
      "operation": "events.deliver",
      "kinds": ["example.openapi@1", "example.grpc@1"]
    }
  }
}
```

The alias adopts a published name, so this operation claims correspondence with the operation that name identifies in a published set of operations ([§5.1](#51-operations)).

---

## 5. Document model

An OBI document is a JSON text ([RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)) whose value is an object. Top-level fields:

| Field          | Type   | Required | Purpose                                                                                                                            |
| -------------- | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `openbindings` | string | yes      | Specification version the document declares (SemVer).                                                                              |
| `name`         | string | no       | Human-friendly label. Not an identifier.                                                                                           |
| `version`      | string | no       | Interface-version label, opaque to this specification ([§8.2](#82-version-field-interface-version-label)). Non-empty when present. |
| `description`  | string | no       | Human-friendly description.                                                                                                        |
| `operations`   | object | yes      | Map of operation keys to operation objects.                                                                                        |
| `dependencies` | object | no       | Map of dependency keys to dependency objects.                                                                                      |
| `bindings`     | object | no       | Map of binding keys to binding objects. |
| `resources`    | object | no       | Map of names to shared JSON values, interpreted where used. |

**Names.** The map keys this specification defines (operation, dependency, binding, resource, and example keys) and operation aliases are names. They are opaque tokens, each matched as a whole against the grammar of [OBI-04](#10-conformance), so a name ending in a newline does not match it. Names are equal only as exact strings, case included (below). Dots and hyphens carry no structure: a dot may qualify a published name by convention ([§5.1](#51-operations)), but nothing in this specification parses the segments. A name shaped like a URI, a path, or a programming-language identifier is only a name. That is why the grammar admits a leading digit (`2fa.verify`).

**Strings and numbers.** Two strings, member names included, are equal exactly when they denote the same sequence of UTF-16 code units after unescaping ([RFC 8259](https://www.rfc-editor.org/rfc/rfc8259) §8.3). Two numbers are equal exactly when their exact decimal values are.

**Value representation.** Operation inputs and outputs are described in the JSON data model of [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259): a caller-facing value is one JSON value crossing the operation boundary (invariant 1). Which interaction data forms one value, and how it corresponds to JSON, is read under each binding's kind. An array returned in one HTTP response can be one value, and the items of a gRPC stream several. A value need not travel as JSON text.

**Fields and extensions.** Each OBI-defined object carries only the fields its table lists and extension fields whose names begin with `x-` ([OBI-02](#10-conformance), [§12](#12-extensions)).

**Presence.** For every optional field, presence is distinct from value: a field present with the JSON value `null` is present, and a field is absent only when omitted.

**Author claims.** Some of what a document says is its author's claim, namely:

- an operation's `examples` ([§5.1](#51-operations));
- a binding's claim to realize its operation, and its `idempotent` claim ([§5.3](#53-bindings));
- a dependency's claim to consume its operation according to its input and output schemas ([§5.5](#55-dependencies));
- correspondence ([§5.1](#51-operations)).

This specification defines what each asserts; whether it is true is outside conformance.

### 5.1. Operations

Each entry in `operations` declares a named capability with optional input and output schemas.

Interaction pattern and cardinality (request/response, streaming, bidirectional, pub/sub; how many values cross) belong to each binding under its kind (invariant 1). This keeps the operation binding-independent. An operation's declaration alone makes no claim that a realization is available (invariant 2).

`output` describes every value the operation returns, whatever it means to the caller (several event types, a union of representations, a result or an error). Any JSON Schema construct can express the variation, such as `oneOf`, `anyOf`, or a `type` array. Which results of an interaction a binding returns as output values is read under its kind.

An operation object's fields are all optional:

| Field         | Type                  | Purpose                                                            |
| ------------- | --------------------- | ------------------------------------------------------------------ |
| `description` | string                | Human-readable description of the capability, which bindings claim to carry out ([§5.3](#53-bindings)). |
| `deprecated`  | boolean               | Author recommends migration away from the operation.               |
| `tags`        | array of strings      | Documentation labels for grouping and filtering, in no meaningful order; a repeated tag adds nothing. |
| `aliases`     | array of strings      | Additional names, in no meaningful order. A string equal to one identifies the operation exactly as its key does (**Aliases**, below). |
| `input`       | JSON Schema or absent | Schema governing each caller-facing input value. |
| `output`      | JSON Schema or absent | Schema governing each caller-facing output value. |
| `examples`    | object                | Map of example names to example objects; see below.                |

**Schema states.** `input` and `output`, when present, hold a JSON Schema 2020-12 object or boolean schema ([§5.2](#52-schemas)). Omission is the only way to state no schema for that direction, and literal `null` is not valid at either position. The states are distinct (satisfying a schema is defined in [§5.2](#52-schemas)):

| Form               | Meaning                                        |
| ------------------ | ---------------------------------------------- |
| field absent       | No schema is stated for that direction.         |
| `{}` or `true`      | Every JSON value satisfies the schema.          |
| `false`            | No JSON value satisfies the schema.             |
| `{"type": "null"}` | Only the JSON value `null` satisfies the schema. |

For an operation that takes no meaningful input, a schema that admits only the empty object fits: `{"type": "object", "maxProperties": 0}`. An operation that returns nothing meaningful on any outcome, error or otherwise, uses the same schema for `output`.

**Note.** Kinds differ on whether a call to an operation that takes no meaningful input carries an empty value or no value at all. That empty-object input schema suits both. The empty value satisfies it, and where no value crosses, the input schema has nothing to apply to. An MCP tool's `{}` arguments and a gRPC `Empty` message are empty values. Omitting `input` would state no input schema, and `false` leaves a caller that must send `{}` nothing it may send. For an operation that returns nothing meaningful, `output: false` would misdescribe one realized under a kind that surfaces an empty result as `{}`.

**Aliases.** An operation's **identifiers** are its key and its aliases, one flat, document-unique namespace ([OBI-05](#10-conformance)). A string identifies an operation exactly when it equals the operation's key or one of its aliases ([§5](#5-document-model)). The operation's bindings are those whose `operation` holds its key. The key is the primary name, used for display, logging, and the `operation` references bindings and dependencies carry. Beyond that, choosing a key or an alias carries no meaning. Aliases commonly keep a prior name after a rename, carry a vendor-specific name some readers know it by, or adopt an operation name from a published set.

**Correspondence.** Authors may publish sets of operations for adoption, including as interfaces described by OBIs. The keys and aliases published for those operations are **published names**. By carrying a published name as its key or an alias, an operation **claims correspondence with** the operation that name identifies. A reader may read the operation as asserting that it is that name's operation in each published set the reader holds that includes the name. The claim is an author claim ([§5](#5-document-model)) made by carrying the name, whatever the author intended.

**Note.** The claim demonstrates no schema compatibility, behavioral equivalence, substitutability, ownership, or trust.

**Publishing names (informative).** Two adopted names that collide cannot coexist in one document. Publishers of names intended for adoption avoid this by qualifying them under a namespace they control with enough interface scope (`acme.tasks.createTask` rather than `create`). Such qualification also keeps claims intentional. A published name stays useful for correspondence while it names one continuing semantic operation, so an intentionally incompatible replacement is best given a new name.

**Examples.** `examples` maps names to author-supplied samples. An example object's fields are all optional:

| Field         | Type           | Purpose                              |
| ------------- | -------------- | ------------------------------------ |
| `description` | string         | Human-readable description.          |
| `input`       | any JSON value | One caller-facing input value.       |
| `output`      | any JSON value | One caller-facing output value.      |

Examples are **positive** author claims ([§5](#5-document-model)): the author claims that each value an example provides satisfies the corresponding input or output schema, where one is present ([§5.2](#52-schemas)). A value that fails it makes the claim false. Where whether a value satisfies the schema is undefined, so is the claim's truth. Where that question rests on a resource the document does not contain, so does the claim's truth. An example's `input` and `output` are values, not schemas. So an explicitly `null` one supplies the JSON value `null` ([§5](#5-document-model), Presence), which the claim covers like any other value. An operation whose `output` is `{"type": "null"}` can therefore carry an example. Examples claim only that each value satisfies the schema.

**Note.** An example never changes what the operation's schema states.

### 5.2. Schemas

Operation `input` and `output` hold schemas inline. A schema can refer to a shared value, for example `{"$ref": "#/resources/Task"}`. The recognition procedure in [§7.1](#71-schema-recognition) determines which stored values are schemas. An unreferenced resource is ordinary JSON, even if it looks like a schema; merely storing it declares no dialect, `$id`, or anchor.

Every schema the document contains ([§3](#3-terminology)) is a [JSON Schema 2020-12](https://json-schema.org/draft/2020-12) schema in object or boolean form, valid against the 2020-12 meta-schemas ([OBI-10](#10-conformance)). An invalid schema the document contains, such as `{"type": 42}`, violates that rule.

**Dialect.** Each schema the document contains is read as JSON Schema 2020-12. A `$schema` other than 2020-12 violates [OBI-09](#10-conformance). Wherever a `$schema` the document contains appears, it names the dialect the schema is already read in and has no other effect: a value's validity is the same as without it.

JSON Schema permits `$schema` only at a resource root (JSON Schema Core §8.1.1). In an OBI, the resource roots that are themselves schemas are exactly the schemas that declare `$id` ([§7.2](#72-the-document-as-embedding)). A schema reached through an external URI follows the dialect JSON Schema assigns it (JSON Schema Core §8.1.1). Where JSON Schema leaves its dialect to the implementation, such a schema is read as 2020-12 (**Schema evaluation**, below).

Beyond this section and [§7](#7-reference-resolution), JSON Schema 2020-12 governs the document's schemas: their meaning, reference resolution, and value evaluation. This specification defines no keyword and no evaluation of its own, beyond the four provisions that **Schema evaluation** (below) sets among JSON Schema's options. OBI-09 to OBI-13 concern schemas ([§7.5](#75-notes-and-examples-informative)). OBI-01 and OBI-02 apply to them as part of the whole document.

**Note.** A schema that breaks another of JSON Schema's requirements does not by that alone violate a rule.

**Schema evaluation.** A value **satisfies** an operation's `input` or `output` schema when it is valid against that schema. It **fails** the schema when it is invalid. That schema is read as JSON Schema 2020-12, with four provisions that hold wherever its evaluation reaches:

- `format` is an annotation where JSON Schema leaves its assertion optional;
- `pattern` values and `patternProperties` names are ECMA-262 regular expressions with Unicode semantics (the `u` flag, JSON Schema Core §6.4);
- references resolve as [§7](#7-reference-resolution) defines;
- a schema document whose root declares no `$schema` is read as 2020-12 (JSON Schema Core §8.1.1 leaves its dialect to the implementation).

An operation's input or output schema applies to each value separately, never to several values taken together (invariant 1).

An **undefined result** is any of these:

- one JSON Schema leaves undefined, such as evaluating a cycle that recurses without consuming any of the instance (JSON Schema Core §9.4.1);
- one [§7.4](#74-other-references) names;
- one that depends on a keyword value the four provisions make invalid, such as a pattern that is invalid with Unicode semantics.

A value's validity depends on an undefined result exactly when that validity would differ between two ways the result could come out. Such ways include a keyword valid or invalid, and a property name matching a pattern or not. A value's validity depends on a resource the document does not contain exactly when that validity would differ between two contents the resource could have. In both tests, the annotations JSON Schema collects follow each way.

Where a value's validity depends on an undefined result, whether the value satisfies the schema is undefined. But where its validity also depends on a resource the document does not contain, from the document alone whether it satisfies that schema is undefined only if it would be undefined whatever that resource holds. Where its validity depends on such a resource and whether it satisfies is not undefined, the document alone does not settle it: it is what JSON Schema, read with the four provisions, gives with that resource. With that resource, whether the value satisfies the schema follows these same rules, so it can still be undefined.

Where every way gives the same validity, that validity stands: a value that satisfies one branch of an `anyOf` satisfies it whatever another branch's undefined result would be.

Where `input` or `output` is absent, no corresponding schema is stated ([§5.1](#51-operations)), and a value neither satisfies nor fails one.

**Schemas from other dialects (informative).** Under a 2020-12 reading, OpenAPI 3.0's `nullable: true` is an unknown keyword, which JSON Schema ignores. So a `null` the service returns fails `{"type": "string", "nullable": true}`. Draft-07's array form of `items` violates OBI-10. Translating such schemas to 2020-12 when bringing them in keeps their meaning.

### 5.3. Bindings

A binding object has these fields ([OBI-02](#10-conformance)):

| Field         | Type           | Required | Purpose                                                                   |
| ------------- | -------------- | -------- | ------------------------------------------------------------------------- |
| `operation`   | string         | yes      | Key into the document's `operations` map.                                 |
| `kind`        | string         | yes      | Exact, opaque, non-empty interpretation name ([§6](#6-kinds)). |
| `content`     | any JSON value | no       | Content read under this binding's kind.                                     |
| `idempotent`  | boolean        | no       | Author claim about repeating the operation through this binding; see below. |
| `preference`  | integer        | no       | Author preference signal among bindings of the same operation; see below. |
| `description` | string         | no       | Human-readable description.                                               |
| `deprecated`  | boolean        | no       | Author recommends migration away from this binding.                       |

A binding's **target** is what it claims realizes its operation, identified according to its kind. It can be an entry in an artifact, a member of a live surface such as a running service's tool listing, or another form.

A binding's `content` might carry a complete realization description, identify the target that realizes the operation, or describe how the operation's input and output values are adapted to and from that target. The `content` might also serve any other purpose its kind gives it. A JSON Pointer into an OpenAPI document, a fully qualified gRPC method name with a value mapping, and an MCP tool name are examples. This specification assigns no meaning to its presence, absence, type, or members.

**Realizations.** Multiple bindings MAY reference the same operation, each an author-declared realization of it. Attaching a binding asserts, as an author claim ([§5](#5-document-model)), that its target realizes the operation as the document describes it:

- **Values.** It takes any value that satisfies `input` as the operation's input (a caller may send it), though it need not succeed on each. It returns only values that satisfy `output`. Each half applies where the operation states the corresponding input or output schema ([§5.1](#51-operations)).
- **Capability.** It carries out the operation its description conveys (the capability, not the wording) and its identifiers name, correspondence claims included. Those claims are read against the published sets of operations a reader holds ([§5.1](#51-operations)).

The operation's tags, deprecation, and examples are not part of the claim. Each binding claims to realize the operation on its own.

**Idempotency.** `idempotent: true` is the binding author's claim ([§5](#5-document-model)) that repeating the operation through this binding produces no additional intended operation-level effects after the first application. The repetitions the claim covers use the same input; any other supplied information differs only in ways that do not affect the operation's intended effects. `idempotent: false` claims that some such repetition through it can produce additional intended effects, and absence claims neither. Bindings of one operation may differ: a binding whose target deduplicates retried requests can claim `true` beside one that does not. The claim does not imply that authorization, billing, or audit effects repeat without consequence. The claim covers only repetitions that all go through this binding.

**Note.** The claim concerns intended operation-level effects, not returned values, timing, or other per-attempt observations. A read of changing state can be idempotent while returning different values, and so can a deletion whose later attempts report absence. The claim does not imply that the operation, through this binding or any other, is safe, read-only, deterministic, cacheable, or harmless.

**One operation, several bindings (informative).** All bindings of an operation make the same input and output claims against its schemas, and no field defined by this specification marks one output value apart from another. Callers that must tell output values apart, such as a result from an error, therefore rely on the schema (a required property, say). Bindings' values might not share a per-value shape: an HTTP binding might return a list as one array value, and a streaming binding its items one at a time. In that case, `output` admits both shapes, a kind's value adaptation reconciles them, or they realize different operations.

**Preference signals.** `preference` is an optional signed integer from -9007199254740991 through 9007199254740991 (the exactly representable interoperable range). An integer is a number with no fractional part, so `1.0` and `1` are the same preference. Among bindings of the same operation that declare it, a higher value expresses stronger author preference and equal values no order. Omission states no preference, and zero and negative values mean nothing beyond their numeric order. `deprecated: true` states that the author recommends migration away from the binding and ordinarily does not recommend it for new use. The two signals are independent: `deprecated` does not change a binding's `preference`, and `preference` states nothing about deprecation.

**Note.** `deprecated: true` does not remove the binding.

### 5.4. Resources

The optional `resources` map stores named JSON values for reference from elsewhere in the document. Each entry MAY be any JSON value. An entry has no required wrapper, `kind`, or type declaration. Its name follows OBI-04; names and object member names within the stored value are ordinary data and are not constrained by that rule.

A shared value can be an embedded artifact, a schema, a graph, configuration, an array, a scalar, or `null`. Presence in `resources` declares no operation, realization, consumption point, schema, or availability. The context of each use determines interpretation. The same value can be used under more than one kind and, separately, as a schema. Schema use is recognized by §7.1; a kind's use does not enter a value into the document's schema inventory.

Sharing is optional. Operations can state schemas inline and bindings can carry all their content inline. A document with no shared values omits `resources`. A resource can exist before any use; this specification assigns no schema or kind meaning to its unreferenced contents.

A schema reaches shared values through its schema references (§7). A kind can designate content positions that use the common shared-value reference form (§7.6). No search, expansion, merging, or rewriting of arbitrary values is defined here. References within an embedded artifact retain the interpretation its kind assigns them.

**Note.** A resource's map key gives a storage location, not a globally meaningful identity. A resource need not be used twice, and absence of a known reference does not establish that an unfamiliar kind cannot use it.

### 5.5. Dependencies

A dependency's map key identifies its consumption point ([§3](#3-terminology)) for configuration, wiring, and diagnostics. The dependency names no realization to serve it, not even one of this document's own bindings.

A dependency object has these fields ([OBI-02](#10-conformance)):

| Field         | Type             | Required | Purpose                                     |
| ------------- | ---------------- | -------- | ------------------------------------------- |
| `operation`   | string           | yes      | Key into the document's `operations` map.   |
| `kinds`       | array of strings | no       | Kinds acceptable at this consumption point. |
| `description` | string           | no       | Human-readable description.                 |

**Consumption.** Declaring a dependency asserts, as an author claim ([§5](#5-document-model)), that the software described by the OBI, as a caller of the operation, sends only values that satisfy `input`. The claim also asserts that the software takes any value that satisfies `output`, error-shaped values included, as the operation's output. Each half applies where the operation states the corresponding input or output schema.

When present, `kinds` holds one or more unique kinds ([§6](#6-kinds), [OBI-02](#10-conformance)), in no meaningful order. The field is an **any-of constraint**: a binding meets it exactly when its kind is the same kind as one listed ([§6](#6-kinds)). Without `kinds`, the dependency places no constraint on kind: it accepts every kind.

Multiple dependencies MAY reference the same operation, including with different `kinds` constraints. An operation MAY have both bindings and dependencies. Each dependency is a separate consumption point.

---

## 6. Kinds

A binding's `kind` ([§3](#3-terminology)) names how its `content` and realization are read.

**Comparison.** A kind is an exact, opaque, non-empty string. Two kinds are the same exactly when their strings are equal ([§5](#5-document-model)); two different strings are unrelated kinds. A dependency's `kinds` constraint compares against the binding's own `kind`.

**Note.** Case, Unicode normalization, punctuation, and apparent version segments carry no compatibility or ordering semantics. A kind is not an address, even when it resembles a URI (invariant 6).

**What a kind decides.** This specification leaves to a binding's kind:

- what `content` may contain and what it means, including whether any artifact or separately selected target is needed;
- how the realization's target is identified, possibly with information outside the document;
- how caller-facing values correspond to interaction data, including adaptation and which data forms one value;
- which interaction results become output values;
- interaction pattern, cardinality, framing, completion, and lifecycle;
- encoding of binary artifacts;
- which content positions, if any, adopt the shared-value reference mechanism of §7.6, and how an artifact's own reference root and base are established.

A kind in turn relies on these provisions of this specification, changes to which are breaking ([§8.1](#81-openbindings-field-specification-version)):

- **Kind strings.** A kind is compared as a whole, exactly (above).
- **Content values.** `content` is any JSON value; its presence is distinct from its value (§5).
- **Shared values.** Resources carry ordinary JSON. A shared-value lookup returns the identified value without modifying it, interpreting its members, or establishing an artifact base (§7.6).
- **Content references.** A kind chooses where it adopts shared-value references. Other content references remain its responsibility; schema-looking data in content does not enter the document's schema inventory.
- **Caller-facing values.** They are JSON values, and operation schemas apply to each separately (§5, invariant 1).
- **Binding claims.** Each binding claims to realize its operation, accepting any input that satisfies the operation's input schema without promising success on each, and returning only values that satisfy the operation's output schema, in each direction where a schema is present (§5.3).

**Sharing a kind (informative).** Portability extends as far as a kind's meaning is shared. Authors can describe that meaning in writing, qualify public names under a namespace they control, and give an incompatible interpretation a new name. This specification requires neither publication nor registration. The project's candidate definitions (§14) have no special standing here.

A private kind can describe a local command directly:

```json
{
  "openbindings": "0.2.0",
  "operations": {
    "status": {}
  },
  "bindings": {
    "status.local": {
      "operation": "status",
      "kind": "my-cli.usage@1",
      "content": {"location": "file:///home/user/project/usage.kdl", "command": "status"}
    }
  }
}
```

---

## 7. Reference resolution

An OBI has a document-local schema embedding base drawn from nowhere else (§7.2). Obtaining the same document at another location changes no reference meaning defined by this specification. Schema references (§7.1–§7.5) and kind-adopted shared-value references (§7.6) are distinct uses of addressing. Neither mechanism searches all stored JSON for `$id`, anchors, or `$ref`.

### 7.1. Schema recognition

Schema recognition depends only on the document. It performs no instance evaluation, network retrieval, kind interpretation, or dynamic-reference evaluation. The following procedure defines the **schema entry points**, **schemas the document contains**, and their schema-resource membership. Locations are compared by their resolved JSON locations, so differently escaped pointers reaching one location do not create two declarations.

1. **Start.** Each object or boolean at an operation's `input` or `output` is a schema entry point. Every entry point begins in the document resource, unless it declares `$id`, in which case it begins its own resource. A present value of any other type violates OBI-02.
2. **Traverse schemas.** From each entry point, visit subschemas through the keywords listed below. Visiting an object or boolean recognizes it as a schema, even when it fails the meta-schemas. Resource membership is inherited, except that a schema with an `$id` member begins its own resource, identified for this procedure by that schema's location. A schema in the document resource, or a schema declaring `$id` reached directly from that resource, is at an **OBI position**. Traversal continues inside identified resources, although their contents are not OBI positions by that traversal.
3. **Follow local schema uses.** For each recognized schema in the document resource, inspect its `$ref` and `$dynamicRef`. If a well-formed same-document JSON Pointer (§7.3) reaches an object or boolean within a `resources` entry, add that target as a schema entry point. A pointer can select an entire entry or a nested value. Other references add no entry point. References inside an identified schema resource resolve under JSON Schema and never activate an OBI resource by this step.
4. **Close.** Repeat steps 2–3 until no location/resource-membership pair or entry point is added. Visit each such pair once; references may form cycles. The result is the least set reached by these rules, independent of traversal order. Recognizing one location repeatedly does not duplicate its `$id` or anchor declarations.
5. **Check membership.** A location reached both as a subschema of an identified resource and as a new document-resource entry point would have conflicting membership unless that location declares its own absolute `$id` and therefore names the same resource in both readings. Conflicting membership violates OBI-12. No traversal or reference overrides another's resource boundary.

The schema-valued keywords are `$defs`, `properties`, `patternProperties`, `dependentSchemas`, `additionalProperties`, `propertyNames`, `items`, `prefixItems`, `contains`, `allOf`, `anyOf`, `oneOf`, `not`, `if`, `then`, `else`, `unevaluatedItems`, `unevaluatedProperties`, and `contentSchema`, with legacy `definitions` and schema values of legacy `dependencies`. For map- and array-valued keywords, their entries are the subschemas; the map or array itself is not. These are the schema positions of the JSON Schema 2020-12 meta-schemas. Malformed keyword values are handled by OBI-10, not reinterpreted to manufacture schemas.

Only schemas reached by this procedure are **schemas the document contains**. Data under `const`, `enum`, `examples`, unknown schema keywords, extension values, or binding content is not traversed as schemas. Within `resources`, a direct schema-use pointer may explicitly select such a stored value; its otherwise uninterpreted ancestors supply no schema base or declarations. Once selected, it is subject to the same schema rules as every other entry point.

**Identifiers do not discover schemas.** Plain-name and absolute-URI references resolve using the completed inventory. A `$id` stored only in an unrecognized resource is not registered merely because an operation references that URI. To make that schema locally known, an operation schema or a schema already in the document resource uses a local pointer to it. After recognition, its `$id` is available to all schema references that JSON Schema resolves to it. No installed kind or processing order can change this inventory.

**Note.** An unused resource such as `{"type": 42}` is ordinary data and does not violate OBI-10. Adding a schema reference to it makes it a schema entry point and exposes that violation. A resource consumed only by a binding kind remains outside this schema recognition procedure, even if that kind interprets it as a schema of another dialect.

### 7.2. The document as embedding

JSON Schema allows the embedding format to establish an initial base and resource model (JSON Schema Core §§9.1.1, 4.3.5). An OBI establishes these as follows:

- **Document resource.** Recognized schemas without an intervening `$id` belong to one anonymous schema resource, the document resource. Its base is unique to the document and independent of its retrieval URI (RFC 3986 §5.1.4). Its anchors are those declared by recognized schemas belonging to it. Evaluation beginning at one of these schemas begins in the document resource, which is outermost in that evaluation's dynamic scope.
- **Identified resources.** A recognized schema declaring `$id` begins its own resource. An `$id` at an OBI position must be absolute (OBI-11); nested `$id`s otherwise follow JSON Schema. Each resource's own references and anchors belong to it. A reference to an identifier declared by a recognized schema resolves to that schema within the document, as JSON Schema defines.
- **Stored values.** Membership in the top-level `resources` map does not itself establish a schema resource or base URI. Recognition and `$id` establish those boundaries. A shared resource and a schema resource are different concepts.

A schema with its own `$id` cannot address the anonymous document resource by URI. A shared schema it references must be reachable through an identified schema resource or through JSON Schema's dynamic scope. A schema meant to retain standalone internal references when embedded can declare an absolute `$id`.

### 7.3. Same-document references

Each `$ref` and `$dynamicRef` in the document resource must be an absolute URI or a same-document reference; each `$id` at an OBI position must be an absolute URI. All are well-formed URI-references (RFC 3986 §4.1; OBI-11). A same-document reference is empty or a fragment alone (RFC 3986 §4.4).

In the document resource, a same-document reference identifies a location as follows:

1. Percent-decode its fragment once as UTF-8. Invalid UTF-8 identifies nothing.
2. An empty reference or empty fragment, such as `#`, identifies the OBI document itself.
3. A decoded fragment beginning with `/` is a JSON Pointer evaluated from the OBI root under RFC 6901. A malformed pointer or one reaching no location identifies nothing.
4. Any other fragment is a **plain name**, such as `task` in `#task`, identifying the recognized schema in the document resource that declares it with `$anchor` or `$dynamicAnchor`. Anchor grammar follows JSON Schema Core §8.2.2 (OBI-10).

After recognition (§7.1), every such schema reference must identify a schema at an OBI position, with no conflicting resource membership (OBI-12). A resource-use pointer can establish a schema entry point as §7.1 defines. A pointer elsewhere can only reach an already recognized OBI position; it cannot promote arbitrary binding content, examples, extensions, maps, or non-schema values into schemas. Plain-name references do not recognize new schemas.

The empty reference and `#` violate OBI-12 in the document resource because the OBI root is not a schema. A pointer into an identified schema resource must respect §7.1's membership check; reach its contents through its `$id` instead of assigning them a second document-resource interpretation.

### 7.4. Other references

Dynamic resolution, references within identified schema resources, and external schema references follow JSON Schema 2020-12. Recognition uses only the static, document-resource pointer cases of §7.1; dynamic scope does not extend the schema inventory.

OBI-13 compares declared `$id`s only after RFC 3986 resolution (including dot-segment removal) and removal of an empty fragment. Other normalization, such as case-folding a host or decoding an unreserved character, is not applied for that rule. Whether other spellings identify one resource is for JSON Schema to determine.

Within an identified schema resource, these results are undefined (§5.2): a pointer reaching no schema; a plain name declared twice or nowhere in that resource; or a `$ref`, `$dynamicRef`, or `$id` that is not a well-formed URI-reference. Such a result alone does not make the OBI non-conformant. Recursive schemas are permitted; a cycle that consumes none of the instance has an undefined evaluation result (JSON Schema Core §9.4.1).

External schemas are not added to the document's inventory and do not affect document conformance. An absolute reference to an otherwise unrecognized stored `$id` is handled as an external reference unless another recognized local schema supplies that identifier. Whether external data permits value evaluation remains separate from conformance (§5.2).

### 7.5. Notes and examples (informative)

This document stores both a schema and ordinary data. The operation's pointer establishes `Tree` as a schema; the unused `notes` value stays opaque.

```json
{
  "openbindings": "0.2.0",
  "operations": {
    "getTree": {
      "output": {"$ref": "#/resources/Tree"}
    }
  },
  "resources": {
    "Tree": {
      "$id": "https://example.com/schemas/tree.json",
      "type": "object",
      "properties": {
        "children": {
          "type": "array",
          "items": {"$ref": "#"}
        }
      }
    },
    "notes": {"type": 42, "$id": "https://example.com/not-a-schema"}
  }
}
```

The reference inside `Tree` resolves to Tree's identified resource. An additional operation may reference its absolute `$id`, because the pointer already establishes it locally. Replacing the only entry pointer with that absolute URI would leave Tree unrecognized in this document; the URI's resolution would then depend on an externally supplied schema. Recognition does not fetch or search for it.

Without `$id`, a shared schema belongs to the document resource. Its `#` would identify the OBI root. Recursive references in that form name their actual location, such as `#/resources/Tree`. Copying a standalone schema into resources therefore preserves its reference meaning only when its base and pointers are preserved, for example by retaining an absolute `$id`.

| Case | Result under this specification |
| --- | --- |
| A schema-use pointer to `#/resources/Task` holding an object or boolean | Recognizes that value, then applies the schema rules |
| The same pointer from an adopted kind content position | Looks up a shared value; does not add a schema to the document's inventory |
| A resource contains `$schema`, `$id`, or `$anchor` but has no schema use | Those members remain ordinary data |
| An operation schema points to `#/resources/Task/properties/id` | Recognizes the selected object/boolean; uninterpreted ancestors supply no base |
| Both a parent schema with `$id` and its no-ID subschema are selected as entry points | Conflicting membership violates OBI-12 |
| Two references select the same schema location | One declaration; no duplicate-ID or duplicate-anchor violation merely from reuse |
| Two distinct recognized schema locations declare the same normalized `$id` | Violates OBI-13 |
| `#/resources/api` selects an artifact as a shared value | Internal artifact references retain kind-defined meaning |
| `#%FF`, a missing target, or a schema reference to an ordinary scalar | Does not identify a schema; violates OBI-11 or OBI-12 as applicable |

All recognized no-ID schemas share the document resource. Adding a schema-use pointer can add anchors or reveal identifier conflicts, even if its operation is never invoked. The inventory is document-wide and fixed before value evaluation; it does not vary with an instance or selected binding. Dynamic resolution can reach a document-resource `$dynamicAnchor` from an identified resource when JSON Schema's dynamic scope permits it.

### 7.6. Shared-value references

A kind MAY designate positions in its binding content that use a **shared-value reference**: an object with exactly one member, `$ref`, whose value is a string. The string is a well-formed URI fragment containing a JSON Pointer that identifies a `resources` entry or a location within one. For example:

```json
{"$ref": "#/resources/tasksApi"}
```

Decode and evaluate the pointer by §7.3 steps 1–3. Its decoded first token must be `resources`, and it must include a token naming an existing entry. An array index follows RFC 6901, including its leading-zero rule. Empty pointers, plain-name fragments, external URIs, malformed encoding, and missing targets do not identify a shared value. A target whose value is `null` is present and is a successful lookup.

Lookup returns the JSON value at that location unchanged. It neither follows a `$ref` contained in that value nor merges siblings, substitutes strings, or performs a recursive expansion. Sharing does not create mutable shared runtime state.

The kind defines which positions use this form, any inline alternative and literal/reference disambiguation, and how a failed lookup affects use of the binding. This specification does not inspect kind content to discover such references; their failure does not by itself violate document conformance. Schema `$ref` keywords instead follow §7.1–§7.5, including their JSON Schema sibling and resource rules.

A storage pointer supplies no artifact base URI. In a kind that accepts either inline or shared material for the same input, that material has the same interpretation in both forms, with the same artifact root and kind-specified base. A kind must carry or obtain any needed base separately; moving an OpenAPI document into `resources`, for example, does not make its internal `#/components/...` refer to the OBI root. The kind interprets the value in its artifact context, not as text pasted into the binding. A kind that needs a location-dependent interpretation defines that distinction explicitly rather than treating the two forms as interchangeable.

**Note.** Generic tools can perform a requested lookup. Enumerating every use of a resource requires knowing the reference-bearing positions of all relevant kinds. Scanning arbitrary JSON for `$ref`, or treating every unrecognized resource as unused, does not establish those facts.

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

- **URIs as attack vectors.** Addresses a tool reads from a binding's `content`, and schema `$ref` values, may resolve to arbitrary endpoints, network or local. These endpoints include internal or link-local addresses such as `http://169.254.169.254/...` and local files such as `file:///etc/passwd`. Unrestricted dereferencing inherits SSRF and exfiltration exposure. Moving a document does not change what schema references in its document resource resolve to (invariant 4).
- **Unbounded size.** The specification caps the size of neither OBI documents nor the artifacts and schemas they reference. Untrusted input creates memory and processing-time exhaustion exposure.
- **Regular-expression cost.** Schema `pattern` and `patternProperties` values run on the evaluating tool's regular-expression engine. A backtracking engine can take exponential time on crafted input.
- **Schema `$ref` cycles.** Permitted by [§7](#7-reference-resolution); naive resolvers can exhaust the stack or loop indefinitely.
- **Identifier shadowing.** An `$id` can claim any URI, including a meta-schema's or one another document declares. A tool might register the schema resources of every document it reads in one shared registry. One document can then change how another's references, or its meta-schema lookups, resolve (JSON Schema Core §13).
- **Executable content.** `content` may carry expressions or other executable material. Untrusted documents can embed expressions designed to run without bound or to reach host state.
- **Dependencies are not trust claims.** A matching operation name or kind establishes neither the authenticity nor the authorization of whatever supplies a realization. A realization found that way, and the values it supplies, stay untrusted until other means establish trust in them.
- **Integrity is out of scope.** Authenticity and integrity are established by external means (transport security, content signing, out-of-band attestation) or not at all. [Appendix A](#appendix-a-canonical-serialization-informative) names a deterministic serialization such systems can build on.

Common measures against these exposures, where documents come from untrusted origins:

- allowing only expected URI schemes and network ranges to be dereferenced, checked after DNS resolution and at each redirect;
- capping the size of fetched documents, schemas, and artifacts;
- bounding the cost of regular-expression matching;
- isolating and bounding the evaluation of any expressions `content` carries;
- enforcing transport security;
- keeping each document's schema resources apart from other documents' and from the meta-schemas;
- bounding traversal through recursive schemas and through references followed in `content`.

---

## 10. Conformance

The rules below govern these texts:

- a text that declares a version of the 0.2 line (in a prerelease of this specification, instead, one that declares that prerelease);
- a text that declares no version ([§8.1](#81-openbindings-field-specification-version)).

A text declaring another line or prerelease is governed by the text of that line or prerelease. A text these rules govern conforms to this specification exactly when it meets every rule below. OBI-02 to OBI-13 apply only to the JSON value of a text that meets OBI-01.

For every text they govern, the rules use the terms the other sections define. Such terms include the version a text declares, a schema at an OBI position, what a same-document reference identifies, and a declared plain name. The meaning those sections give a document's members holds only for a conformant document. Text marked *Note* in a rule, which runs to the rule's end, explains it and adds no requirement.

The prose defines the document model. The schema `openbindings.schema.json` expresses the model's structural part in JSON Schema, and the structural requirements of [§5](#5-document-model) take effect through OBI-02. The schema's `$id` names the line, and its title the release. The schema also expresses OBI-03, OBI-04, OBI-07, and the name syntax of the operation references that OBI-06 and OBI-08 concern. For OBI-05 it expresses only an alias repeated within one operation's `aliases`. For OBI-09 it expresses only the value of a `$schema` at the top of each operation `input` and `output`. It does not interpret stored resources; recognition and the remaining schema checks are separate. A document violating those parts of the rules violates OBI-02 as well. The other rules apply beyond what the schema expresses.

Each rule carries an identifier for test suites and errata to cite. A rule is cited under a line ([§8.1](#81-openbindings-field-specification-version)). An identifier means what that line's text says, and another line may number its rules differently. A patch release adds and renumbers no rule.

A conformant OBI document:

- **OBI-01**: Is valid UTF-8 ([RFC 3629](https://www.rfc-editor.org/rfc/rfc3629)) encoded JSON per [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259), with no leading byte-order mark and no object holding two members whose names are equal ([§5](#5-document-model)). *Note:* parsers differ on repeated names and on a leading byte-order mark, so the same bytes could yield different values. Excluding both follows RFC 8259 §8.1, which forbids adding a byte-order mark, and interoperable-JSON practice ([RFC 7493](https://www.rfc-editor.org/rfc/rfc7493) §2.3).
- **OBI-02**: Is valid against the derived JSON Schema published with this text (`openbindings.schema.json`, `$id` `https://openbindings.com/schema/openbindings-0.2.json`), its `pattern` values read as ECMA-262 regular expressions. Where the schema and the prose disagree, the schema governs this rule until a patch release corrects the erratum. A patch release that corrects the schema republishes it under the same `$id`.
- **OBI-03**: Has an `openbindings` field whose value is a valid [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) string.
- **OBI-04**: Has every map key this specification defines (operation, dependency, binding, resource, and example keys) and every entry of an operation's `aliases` array a string matching `^[A-Za-z0-9_][A-Za-z0-9_.-]*$`. The pattern is an ECMA-262 regular expression matched against the whole name. Property names inside JSON Schema objects are schema content, not map keys, and are unconstrained by this rule.
- **OBI-05**: Has no string occurring more than once among all operations' keys and `aliases` entries taken together.
- **OBI-06**: Has every `bindings[*].operation` value present as a key in the document's `operations` map.
- **OBI-07**: Has every `bindings[*].kind` value a non-empty string, compared exactly as §6 defines.
- **OBI-08**: Has every `dependencies[*].operation` value present as a key in the document's `operations` map.
- **OBI-09**: Has every `$schema` keyword in a schema the document contains ([§3](#3-terminology)) equal to `https://json-schema.org/draft/2020-12/schema` or `https://json-schema.org/draft/2020-12/schema#`.
- **OBI-10**: Has every operation `input` and `output` and every recognized shared-resource schema entry point valid against the JSON Schema 2020-12 meta-schemas, which validate its subschemas in turn ([§5.2](#52-schemas)). The meta-schemas are the dialect meta-schema `https://json-schema.org/draft/2020-12/schema` and the vocabulary meta-schemas it references, as published with [JSON Schema Core](#131-normative-references). They apply with `format` as an annotation, JSON Schema's default (JSON Schema Validation §7.2.1). They also apply with their `pattern` values read as ECMA-262 regular expressions, the regular-expression dialect JSON Schema names (JSON Schema Core §6.4).
- **OBI-11**: Has every schema `$ref` and `$dynamicRef` in the document resource ([§3](#3-terminology)) an absolute URI or a same-document reference, and every schema `$id` at an OBI position an absolute URI. All of them are also well-formed URI-references per [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) §4.1 ([§7.3](#73-same-document-references)).
- **OBI-12**: Has every same-document schema `$ref` and `$dynamicRef` in the document resource identifying a recognized schema at an OBI position, and no recognized schema location assigned conflicting resource membership ([§7.1](#71-schema-recognition), [§7.3](#73-same-document-references)).
- **OBI-13**: Has no plain name ([§7.3](#73-same-document-references)) declared more than once in the document resource, and no `$id` declared by two distinct schema locations the document contains. Repeated references to one location count its declarations once. In counting a plain name's declarations, each `$anchor` and each `$dynamicAnchor` that declares it counts once (JSON Schema Core §8.2.2). An `$id` is compared only when it is a well-formed URI-reference and at least one of these holds:
  - it is an absolute URI;
  - it resolves against the `$id` of the nearest enclosing schema that declares one, and that `$id` is itself compared.

  Every other `$id` is left out of the comparison ([§7.4](#74-other-references)). For that comparison, each compared `$id` is:

  1. resolved to an absolute URI per RFC 3986 §5.2 (which removes dot segments);
  2. stripped of any empty fragment;
  3. compared as a string ([§5](#5-document-model)).

**Note.** No rule depends on evaluating a value against the document's schemas.

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
- **Fragment identifier considerations:** JSON Pointer per [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901), or a plain name declared by `$anchor` or `$dynamicAnchor` in the document resource ([§7.3](#73-same-document-references); JSON Schema Core §8.2.2). Such a fragment identifies a location in the representation. The document resource itself has no portable, externally nameable base, so its schemas cannot be addressed from outside the document as schema resources ([§7.2](#72-the-document-as-embedding))
- **Additional information:** deprecated alias names, magic numbers, file extensions, and Macintosh file type codes: none
- **Person and email address to contact for further information:** the OpenBindings maintainers, hello@openbindings.com; see also [github.com/openbindings](https://github.com/openbindings)
- **Intended usage:** COMMON
- **Restrictions on usage:** none
- **Author:** the OpenBindings maintainers
- **Change controller:** openbindings project

---

## 12. Extensions

A field ([§3](#3-terminology)) whose name begins with `x-` is an **extension**. OBI documents MAY include extensions in any OBI-defined object. An extension never changes the meaning this specification assigns to a field. Its own meaning, if any, is defined outside this specification. Unprefixed field names are reserved ([§5](#5-document-model), [OBI-02](#10-conformance)) so this specification can add fields without colliding with a document's own data.

Keys inside the document's maps (`operations`, `dependencies`, `bindings`, `resources`, and an operation's `examples`) are entry names, not fields. An `x-`-prefixed key there names an ordinary entry, subject to OBI-04 like any other key. In `operations` such a key enters the identifier namespace (OBI-05).

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
- The openbindings project's published interfaces containing sets of operations for adoption, available at [openbindings.com/interfaces](https://openbindings.com/interfaces).
- `binding-specs/`: candidate kind definitions this project is drafting, with authoring guidance ([§6](#6-kinds)).
- `conformance/`: test corpus keyed to rule identifiers and sections.
- `examples/`: example OBI documents; like this text's examples, their kinds (`example.*`) and the shapes of their `content` are illustrative.
- `CHANGELOG.md`: version history and diffs between specification versions.
- `EDITORS.md`: current editor roster.
- `GOVERNANCE.md`: project governance and decision-making.
- `SECURITY.md`: vulnerability reporting and security contact.

---

## Appendix A. Canonical serialization (informative)

Some applications need a stable byte representation of an OBI document: content addressing, integrity attestation, digital signing, cache keys, prompt-cache stability.

Take an OBI whose parsed JSON value satisfies the input requirements of [RFC 8785 (JSON Canonicalization Scheme)](https://www.rfc-editor.org/rfc/rfc8785). Its JCS serialization provides deterministic bytes for the carried JSON value. The serialization carries that value exactly when every number's exact decimal value survives JCS's binary64 rendering (below). The facility is **partial**. RFC 8785 constrains its input to the I-JSON subset ([RFC 7493](https://www.rfc-editor.org/rfc/rfc7493): numbers representable in IEEE 754 binary64, strings expressible as Unicode). But this specification pins RFC 8259 JSON and JSON Schema 2020-12, which bound neither. So a conformant OBI may have no JCS serialization.

The facility is JCS over the value exactly as carried. Rounding, coercing, repairing, or otherwise changing a value to manufacture compatible input yields the serialization of some other value. RFC 8785 rejects incompatible input. JCS also serializes each number from its binary64 value. So a number whose exact decimal value differs from the shortest rendering of that value is not carried exactly. For example, `1000000000000000128` is serialized as `1000000000000000100`. Under this specification's reading of numbers ([§5](#5-document-model)), such an OBI has no JCS serialization that carries its value exactly. Yet RFC 8785 itself does not reject it.

Canonical serialization is syntactic: JCS sorts object member names and preserves array order, and performs no semantic normalization. Two OBIs that mean the same thing can have different canonical bytes, and equal bytes establish equal carried JSON data. Naming a serialization defines no integrity system ([§9](#9-security-considerations)). Digest algorithms, signed-document formats, carrier fields, and trust policy belong to downstream specifications. JCS covers only the JSON value carried in the OBI itself, never fetched external resources.
