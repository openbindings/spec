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
  "sources": {
    "tasksApi": {
      "kind": "example.openapi@1",
      "data": {"location": "https://example.com/openapi.json"}
    }
  },
  "bindings": {
    "createTask.http": {
      "operation": "createTask",
      "source": "tasksApi",
      "data": {"target": "#/paths/~1tasks/post"}
    }
  }
}
```

The kinds in this document's examples (`example.openapi@1`, `example.mcp@1`, `example.grpc@1`, `my-cli.usage@1`) and the shapes of their `data`, such as `{ "location": … }` on a source and `{ "target": … }` on a binding, are illustrative; only a kind gives `data` meaning ([§6](#6-kinds)).

New readers may prefer the [§4. Overview](#4-overview-informative) walkthrough. The notational conventions below, and the text from [§1. Positioning and scope](#1-positioning-and-scope) on, are normative except where marked informative. Conformance is defined by the numbered rules of [§10](#10-conformance).

## Editors

- Matthew Clevenger ([@clevengermatt](https://github.com/clevengermatt))

See `EDITORS.md` for the current editor roster.

## Status of this document

This is **version 0.2.0** of the OpenBindings specification. This text is the unreleased working draft of that version; the latest release is **0.1.0** (immutable released snapshots live under `versions/`). It is pre-1.0, and minor-version revisions may include breaking changes per [§8. Versioning](#8-versioning). Substantive changes are recorded in `CHANGELOG.md` and cite rule identifiers (`OBI-##`) where applicable, each under the version it belongs to.

**Sources revision.** This working draft returns `sources` to the document. Each source carries a `kind` and optional `data`; each binding names its source and carries optional `data` of its own; both are read under the source's kind. There is no `resources` map and no binding `kind`. [SOURCE-MODEL-DRAFT.md](SOURCE-MODEL-DRAFT.md) records the decisions and migration status. Earlier 0.2 corpora and kind candidates have not been migrated wholesale; they are not evidence for this revised model.

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

This specification defines an interface document model, not a client-server protocol or runtime API. An OBI may be authored and supplied by anyone, independently of the software it describes.

OpenBindings sits one layer above protocol-specific interface specifications such as OpenAPI, AsyncAPI, gRPC, and MCP. Those describe how to interact with particular protocols and endpoints. An OBI describes the operations software can perform and the realizations bindings declare for them. It also describes which operations that software consumes and the published names by which operations can be recognized. It relates all of these across protocols, complementing the artifacts and services its sources carry, address, or otherwise use.

### 1.1. Out of scope

This specification defines the document model and the input and output schemas governing each operation's caller-facing values. A source's kind determines how its data and the data of the bindings naming it are read ([§6](#6-kinds)), without changing any meaning this specification gives the document. Naming a kind does not assert that a definition exists.

This specification does not define invocation or call management, select bindings, or supply realizations for dependencies. Acquisition, publication, authoring workflows, and registries are outside its scope.

---

## 2. Invariants

The model rests on six invariants, cited elsewhere by number. Most of their terms are defined in [§3](#3-terminology).

1. **Per-value schemas.** Operation `input` and `output` schemas govern each value that crosses the operation's caller-facing boundary, one value at a time. Interaction pattern, cardinality, framing, completion, and lifecycle are interpreted according to the kind of each binding's source.
2. **Declaration, not availability.** A binding declares a realization of its operation through its data and its source's data, read under the source's kind. It does not assert that the realization is available, and the document alone need not suffice to use it. A dependency does not identify a realization to serve it ([§5.5](#55-dependencies)).
3. **Bounded interpretation.** The operation carries the schemas governing its caller-facing input and output values. A kind interprets source and binding data without changing any meaning this specification gives the document.
4. **Location-independent references.** No schema reference in the document resource ([§7](#7-reference-resolution)) resolves against the URI a document was fetched from, so the meaning this specification assigns to a document is the same however it was obtained. This specification does not scan source or binding `data` for references: what data refers to, and how, is its kind's to define (invariant 3). This specification assigns no document identity. `name` and `version` are labels.
5. **Self-contained conformance.** Whether a document conforms to a release of this specification depends only on:
   - the document;
   - that release's text;
   - the derived schema published with that release ([OBI-02](#10-conformance));
   - the normative references the text's rules cite, the JSON Schema 2020-12 meta-schemas among them ([OBI-10](#10-conformance)).

   Releases of one line differ about a document only where a later release corrects an earlier one's text ([§8.1](#81-openbindings-field-specification-version)).
6. **Decentralized naming.** Kinds and published names are author-assigned. This specification assigns no authority over them and provides no registry or ownership test. The model requires no registry, and a kind is a name, not an address ([§6](#6-kinds)).

---

## 3. Terminology

The model's core nouns are identified here and defined in the sections cited. Three terms this specification uses in a sense a reader might not assume are defined here in full: caller-facing, field, and absolute URI.

- **OBI**: an OpenBindings interface document.
- **Operation**: a named, protocol-independent capability, under a key in `operations` ([§5.1](#51-operations)).
- **Alias**: an additional name under which an operation is recognized ([§5.1](#51-operations)).
- **Correspondence**: the claim an operation makes by carrying a published name as its key or an alias ([§5.1](#51-operations)).
- **Caller-facing**: said of the values an operation is about. A caller sends them to it and receives them from it on the operation's side of a binding. The operation's input and output schemas govern them where present. Whatever else a realization needs, such as a credential, is not caller-facing.
- **Author claim**: one of the claims [§5](#5-document-model) lists, which a document makes and whose truth is outside conformance.
- **Source**: a named entry in `sources`, carrying a kind and optional data read under that kind ([§5.4](#54-sources)).
- **Binding**: an author-declared realization of an operation, under a key in `bindings`, naming its source and carrying optional data read under the source's kind ([§5.3](#53-bindings)).
- **Realization**: a concrete way of carrying out an operation. A binding declares one and a dependency consumes one ([§5.3](#53-bindings), [§5.5](#55-dependencies)).
- **Kind**: the exact, opaque, non-empty string a source carries in `kind` and a dependency may list in `kinds`; it names how data is read ([§6](#6-kinds)).
- **Dependency**: a named point, under a key in `dependencies`, where the software described by the OBI consumes a realization of an operation ([§5.5](#55-dependencies)).
- **Schema**: a JSON Schema 2020-12 schema, in object or boolean form, at an operation's `input` or `output` or in the `schemas` map, with its subschemas ([§5.2](#52-schemas); [§7](#7-reference-resolution) defines exactly which schemas the document contains).
- **OBI position**: a place where the document model puts a schema ([§7](#7-reference-resolution)).
- **Document resource**: the schema resource that the schemas at OBI positions declaring no `$id` belong to ([§7.2](#72-the-document-as-embedding)).
- **Field**: a member of an OBI-defined object (the document root, and operation, dependency, binding, source and example objects). Keys inside the document's maps and property names inside JSON Schema objects are not fields ([§12](#12-extensions), [OBI-04](#10-conformance)).
- **Absolute URI**: a URI with a scheme (RFC 3986 §3), fragment permitted; not RFC 3986's `absolute-URI` production, which excludes fragments.

Additional terms are defined where they are used.

---

## 4. Overview (informative)

OpenBindings separates operations (capabilities with per-value schemas) from the sources that realize them (each read under its kind), the bindings that relate the two, and named consumption points (dependencies). A single OBI can bind an operation over multiple protocols, depend on an operation, or do both without redefining the operation.

Every OBI declares a specification version and an operations map. The minimal conformant document is just those two fields:

```json
{
  "openbindings": "0.2.0",
  "operations": {}
}
```

Each source carries a kind and optional data, such as where an API description lives, and each binding names its source and carries optional data of its own, such as which part of that description it realizes. Both are read under the source's kind. Optional `schemas` hold shared schemas. This fuller OBI:

- binds `createTask` over two protocols, through two sources;
- shares a schema between operations;
- describes an error shape beside a result;
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
          {"$ref": "#/schemas/Task"},
          {"$ref": "#/schemas/Problem"}
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
            "items": {"$ref": "#/schemas/Task"}
          },
          {"$ref": "#/schemas/Problem"}
        ]
      }
    }
  },
  "sources": {
    "httpApi": {
      "kind": "example.openapi@1",
      "data": {"location": "https://example.com/openapi.json"}
    },
    "mcp": {
      "kind": "example.mcp@1",
      "data": {"location": "https://example.com/mcp"}
    }
  },
  "bindings": {
    "createTask.http": {
      "operation": "createTask",
      "source": "httpApi",
      "data": {"target": "#/paths/~1tasks/post"}
    },
    "createTask.mcp": {
      "operation": "createTask",
      "source": "mcp",
      "data": {"target": "tools/create_task"}
    },
    "listTasks.http": {
      "operation": "listTasks",
      "source": "httpApi",
      "data": {"target": "#/paths/~1tasks/get"}
    }
  },
  "schemas": {
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
    }
  }
}
```

A dependency declares a named consumption point for an operation:

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
| `operations`   | object | yes      | Map of operation keys to operation objects ([§5.1](#51-operations)).                                                               |
| `sources`      | object | no       | Map of source keys to source objects ([§5.4](#54-sources)). |
| `bindings`     | object | no       | Map of binding keys to binding objects ([§5.3](#53-bindings)). |
| `dependencies` | object | no       | Map of dependency keys to dependency objects ([§5.5](#55-dependencies)).                                                           |
| `schemas`      | object | no       | Map of schema names to JSON Schemas ([§5.2](#52-schemas)). |

**Names.** The map keys this specification defines (operation, source, binding, dependency, schema, and example keys) and operation aliases are names. They are opaque tokens, each matched as a whole against the grammar of [OBI-04](#10-conformance), so a name ending in a newline does not match it. Names are equal only as exact strings, case included (below). Dots and hyphens carry no structure: a dot may qualify a published name by convention ([§5.1](#51-operations)), but nothing in this specification parses the segments. A name shaped like a URI, a path, or a programming-language identifier is only a name. That is why the grammar admits a leading digit (`2fa.verify`).

**Strings and numbers.** Two strings, member names included, are equal exactly when they denote the same sequence of UTF-16 code units after unescaping ([RFC 8259](https://www.rfc-editor.org/rfc/rfc8259) §8.3). Two numbers are equal exactly when their exact decimal values are.

**Value representation.** Operation inputs and outputs are described in the JSON data model of [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259): a caller-facing value is one JSON value crossing the operation boundary (invariant 1). Which interaction data forms one value, and how it corresponds to JSON, is read under the kind of each binding's source. An array returned in one HTTP response can be one value, and the items of a gRPC stream several. A value need not travel as JSON text.

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

`output` describes every value the operation returns, whatever it means to the caller (several event types, a union of representations, a result or an error). Any JSON Schema construct can express the variation, such as `oneOf`, `anyOf`, or a `type` array. Which results of an interaction a binding returns as output values is read under the kind of its source.

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

Input and output schemas constrain values that occur; they do not determine whether or how many values occur (invariant 1).

**Aliases.** An operation's **identifiers** are its key and its aliases, one flat, document-unique namespace ([OBI-05](#10-conformance)). A string identifies an operation exactly when it equals the operation's key or one of its aliases ([§5](#5-document-model)). The operation's bindings are those whose `operation` holds its key. The key is the primary name, used in the `operation` references bindings and dependencies carry. Beyond that, choosing a key or an alias carries no meaning. Aliases commonly keep a prior name after a rename, carry a vendor-specific name some readers know it by, or adopt an operation name from a published set.

**Correspondence.** Authors may publish sets of operations for adoption, including as interfaces described by OBIs. The keys and aliases published for those operations are **published names**. By carrying a published name as its key or an alias, an operation **claims correspondence with** the operation that name identifies. A reader may read the operation as asserting that it is that name's operation in each published set the reader holds that includes the name. The claim is an author claim ([§5](#5-document-model)) made by carrying the name, whatever the author intended.

**Note.** The claim demonstrates no schema compatibility, behavioral equivalence, substitutability, ownership, or trust.

**Publishing names (informative).** Two adopted names that collide cannot coexist in one document. Publishers of names intended for adoption avoid this by qualifying them under a namespace they control with enough interface scope (`acme.tasks.createTask` rather than `create`). Such qualification also keeps claims intentional. A published name stays useful for correspondence while it names one continuing semantic operation, so an intentionally incompatible replacement is best given a new name.

**Examples.** `examples` maps names to author-supplied samples. An example object's fields are all optional:

| Field         | Type           | Purpose                              |
| ------------- | -------------- | ------------------------------------ |
| `description` | string         | Human-readable description.          |
| `input`       | any JSON value | One caller-facing input value.       |
| `output`      | any JSON value | One caller-facing output value.      |

Examples are **positive** author claims ([§5](#5-document-model)): each provided input or output value satisfies the corresponding operation schema, where present, as [§5.2](#52-schemas) defines. The fields contain values, not schemas; explicit `null` supplies the JSON value `null` ([§5](#5-document-model), Presence).

### 5.2. Schemas

Operation `input` and `output` hold schemas inline. The top-level `schemas` map holds named JSON Schemas, which schemas reference with `$ref` (for example, `{"$ref": "#/schemas/Task"}`). Every `schemas` entry is a schema the document contains, whether or not anything references it; nothing in `sources` is one ([§5.4](#54-sources), [§7](#7-reference-resolution)).

Every schema the document contains ([§3](#3-terminology)) is a [JSON Schema 2020-12](https://json-schema.org/draft/2020-12) schema in object or boolean form, valid against the 2020-12 meta-schemas ([OBI-10](#10-conformance)). An invalid schema the document contains, such as `{"type": 42}`, violates that rule.

**Dialect.** Each schema the document contains is read as JSON Schema 2020-12. A `$schema` other than 2020-12 violates [OBI-09](#10-conformance). Wherever a `$schema` the document contains appears, it names the dialect the schema is already read in and has no other effect: a value's validity is the same as without it.

JSON Schema permits `$schema` only at a resource root (JSON Schema Core §8.1.1). In an OBI, the resource roots that are themselves schemas are exactly the schemas that declare `$id` ([§7.2](#72-the-document-as-embedding)). A schema reached through an external URI follows the dialect JSON Schema assigns it (JSON Schema Core §8.1.1). Where JSON Schema leaves its dialect to the implementation, such a schema is read as 2020-12 (**Schema evaluation**, below).

Beyond this section and [§7](#7-reference-resolution), JSON Schema 2020-12 governs the document's schemas: their meaning, reference resolution, and value evaluation. This specification defines no keyword and no evaluation of its own, beyond the four provisions that **Schema evaluation** (below) sets among JSON Schema's options. OBI-09 to OBI-14 concern schemas ([§7.5](#75-notes-and-examples-informative)). OBI-01 and OBI-02 apply to them as part of the whole document.

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

**Schemas from other documents (informative).** A schema means what this specification and JSON Schema 2020-12 give it at its position in this document, whatever document it was written for. A schema inside a source's data, such as an OpenAPI component, is none of the document's schemas.

- **Dialect.** It is read as 2020-12. OpenAPI 3.0's `nullable: true` is an unknown keyword there, so `{"type": "string", "nullable": true}` admits no `null`. Draft-07's array form of `items` violates OBI-10, and its `dependencies` is not evaluated.
- **References.** Its same-document references are read from the OBI root unless it or an enclosing schema declares `$id`. `#/components/schemas/User` identifies nothing in an OBI, and `#/schemas/Owner` identifies this document's `Owner`.
- **Declarations.** Its `$id`s and anchors are declared where it sits, whether or not anything references it. A `schemas` entry whose `$id` names a schema published elsewhere is the document's schema for that URI. The same schema at two positions makes its declarations at both, so one that declares any `$id`, or an anchor in the document resource, violates OBI-13.

### 5.3. Bindings

A binding object has these fields ([OBI-02](#10-conformance)):

| Field         | Type           | Required | Purpose                                                                   |
| ------------- | -------------- | -------- | ------------------------------------------------------------------------- |
| `operation`   | string         | yes      | Key into the document's `operations` map.                                 |
| `source`      | string         | yes      | Key into the document's `sources` map ([§5.4](#54-sources)).              |
| `data`        | any JSON value | no       | Binding data, read under the source's kind ([§6](#6-kinds)).              |
| `idempotent`  | boolean        | no       | Author claim about repeating the operation through this binding; see below. |
| `preference`  | integer        | no       | Author preference signal among bindings of the same operation; see below. |
| `description` | string         | no       | Human-readable description.                                               |
| `deprecated`  | boolean        | no       | Author recommends migration away from this binding.                       |

**Source.** Every binding names one source, whose kind governs the binding's data together with the source's own ([§5.4](#54-sources), [§6](#6-kinds)). Several bindings MAY name the same source. What a binding's data holds, if anything, is for that kind to define: a pointer into an API description, a method name, an adaptation of values, or nothing, where the source alone identifies the realization.

**Realizations.** Multiple bindings MAY reference the same operation, each an author-declared realization of it. Attaching a binding asserts, as an author claim ([§5](#5-document-model)), that its declared realization carries out the operation as the document describes it:

- **Values.** It takes any value that satisfies `input` as the operation's input (a caller may send it), though it need not succeed on each. It returns only values that satisfy `output`. Each half applies where the operation states the corresponding input or output schema ([§5.1](#51-operations)).
- **Capability.** It carries out the operation its description conveys (the capability, not the wording) and its identifiers name, correspondence claims included. Those claims are read against the published sets of operations a reader holds ([§5.1](#51-operations)).

The operation's tags, deprecation, and examples are not part of the claim. Each binding claims to realize the operation on its own.

**Idempotency.** `idempotent: true` is the binding author's claim ([§5](#5-document-model)) that repeating the operation through this binding produces no additional intended operation-level effects after the first application. The repetitions the claim covers use the same input; any other supplied information differs only in ways that do not affect the operation's intended effects. `idempotent: false` claims that some such repetition through it can produce additional intended effects, and absence claims neither. Bindings of one operation may differ: a binding whose realization deduplicates retried requests can claim `true` beside one that does not. The claim does not imply that authorization, billing, or audit effects repeat without consequence. The claim covers only repetitions that all go through this binding.

**Note.** The claim concerns intended operation-level effects, not returned values, timing, or other per-attempt observations. A read of changing state can be idempotent while returning different values, and so can a deletion whose later attempts report absence. The claim does not imply that the operation, through this binding or any other, is safe, read-only, deterministic, cacheable, or harmless.

**Preference signals.** `preference` is an optional integer from -9007199254740991 through 9007199254740991. An integer has no fractional part, so `1.0` and `1` express the same preference. Among bindings of the same operation that declare it, higher values express stronger author preference; equal values express no order, and omission states no preference. `deprecated: true` recommends migration away from the binding and ordinarily against new use. Deprecation and preference are independent signals.

### 5.4. Sources

A source object has these fields ([OBI-02](#10-conformance)):

| Field         | Type           | Required | Purpose                                                                   |
| ------------- | -------------- | -------- | ------------------------------------------------------------------------- |
| `kind`        | string         | yes      | Exact, opaque, non-empty name of how this source's data and its bindings' data are read ([§6](#6-kinds)). |
| `data`        | any JSON value | no       | Source data, read under the source's kind.                                |
| `description` | string         | no       | Human-readable description.                                               |

A source is the document's name for something its bindings realize operations through, read under one kind. Its data may embed an artifact such as an API description, address one, address a running service, carry whatever the kind needs to read either, or be absent where the kind needs nothing beyond the source's name: `{"kind": "example.echo@1"}` is a complete source. Which of these a source's data does, and how a binding's data combines with it, is for the kind to define ([§6](#6-kinds)). Since JSON has no binary primitive, how a binary artifact is carried is read under the kind as well.

A source's key follows OBI-04; member names within its data are ordinary data and are not constrained by that rule. A source need not be named by any binding. Nothing relates two sources to each other: one artifact read under two kinds is two sources, each carrying or addressing it.

This specification never reads a source's data, or anything inside it, as a schema. A schema reference that points into `sources` identifies no schema the document contains, and so violates [OBI-12](#10-conformance); an `$id` inside a source's data identifies nothing to the document's schemas ([§7.2](#72-the-document-as-embedding)). Source data may hold JSON Schemas of any dialect, or whole documents that contain them; what they mean is for the source's kind.

**Note.** The source is the entry; the artifact or service is what its data holds or addresses; and the kind is neither one's format. A source may hold an OpenAPI 3.1 document while its kind is `example.openapi@1`, the name of one way of reading such documents and the bindings that use them.

### 5.5. Dependencies

A dependency's map key identifies its consumption point ([§3](#3-terminology)). The dependency names no realization to serve it, not even one of this document's own bindings.

A dependency object has these fields ([OBI-02](#10-conformance)):

| Field         | Type             | Required | Purpose                                     |
| ------------- | ---------------- | -------- | ------------------------------------------- |
| `operation`   | string           | yes      | Key into the document's `operations` map.   |
| `kinds`       | array of strings | no       | Kinds acceptable at this consumption point. |
| `description` | string           | no       | Human-readable description.                 |

**Consumption.** Declaring a dependency asserts, as an author claim ([§5](#5-document-model)), that the software described by the OBI, as a caller of the operation, sends only values that satisfy `input`. The claim also asserts that the software takes any value that satisfies `output`, error-shaped values included, as the operation's output. Each half applies where the operation states the corresponding input or output schema.

When present, `kinds` holds one or more unique kinds ([§6](#6-kinds), [OBI-02](#10-conformance)), in no meaningful order. The field is an **any-of constraint**: a binding meets it exactly when the kind of its source is the same kind as one listed ([§6](#6-kinds)). Without `kinds`, the dependency places no constraint on kind: it accepts every kind.

Multiple dependencies MAY reference the same operation, including with different `kinds` constraints. An operation MAY have both bindings and dependencies. Each dependency is a separate consumption point.

---

## 6. Kinds

A source's `kind` ([§3](#3-terminology)) names how its `data` and the `data` of each binding naming the source are read.

**Comparison.** A kind is an exact, opaque, non-empty string. Two kinds are the same exactly when their strings are equal ([§5](#5-document-model)); two different strings are unrelated kinds. A dependency's `kinds` constraint compares against the kind of the binding's source.

**Note.** Case, Unicode normalization, punctuation, and apparent version segments carry no compatibility or ordering semantics. A kind is not an address, even when it resembles a URI (invariant 6).

**Interpretation.** A kind gives source data and binding data their meaning, including that of their presence, absence, type, and members, and how a binding's data combines with its source's. Through that meaning each binding naming the source declares its realization. A kind cannot change any meaning this specification gives the document ([§1.1](#11-out-of-scope)).

What data refers to, and any reading of data as schemas, is the kind's to define. Neither makes a value in source or binding data one of the document's schemas ([§7](#7-reference-resolution)).

**Data in its document (informative).** Data is read in its document, so a source or binding copied into another document resolves its references there. A kind is as durable across lines of this specification as the parts of the document it relies on are covered by the guarantees for kinds in [§8.1](#81-openbindings-field-specification-version). A kind that relies on nothing outside source and binding data is the most durable.

**Sharing a kind (informative).** Portability extends as far as a kind's meaning is shared. Authors can describe that meaning in writing, qualify public names under a namespace they control, and give an incompatible interpretation a new name. This specification requires neither publication nor registration. The project's candidate definitions (§14) have no special standing here.

A private kind can describe a local command directly:

```json
{
  "openbindings": "0.2.0",
  "operations": {
    "status": {}
  },
  "sources": {
    "cli": {
      "kind": "my-cli.usage@1",
      "data": {"location": "file:///home/user/project/usage.kdl"}
    }
  },
  "bindings": {
    "status.local": {
      "operation": "status",
      "source": "cli",
      "data": {"command": "status"}
    }
  }
}
```

---

## 7. Reference resolution

A document's base URI is its own ([§7.2](#72-the-document-as-embedding)), so its OBI-defined references resolve identically however it was obtained (invariant 4). A same-document reference in the document resource resolves against the OBI document as [§7.2](#72-the-document-as-embedding) and [§7.3](#73-same-document-references) define. A reference to the URI that a schema the document contains declares with `$id` resolves to that schema ([§7.2](#72-the-document-as-embedding)). Other references resolve as [§7.4](#74-other-references) describes.

**OBI positions.** An **OBI position** is a place where the document model puts a schema, namely:

- an operation's `input` or `output`;
- an entry in the `schemas` map;
- every subschema reached from one of these through the keywords the JSON Schema 2020-12 meta-schema validates as schemas.

Those keywords are `$defs`, `properties`, `patternProperties`, `dependentSchemas`, `additionalProperties`, `propertyNames`, `items`, `prefixItems`, `contains`, `allOf`, `anyOf`, `oneOf`, `not`, `if`, `then`, `else`, `unevaluatedItems`, `unevaluatedProperties`, and `contentSchema`, with the legacy `definitions` and the schema values of the legacy `dependencies` (JSON Schema Validation, Appendix A). For map- and array-valued keywords, their entries are the subschemas; the map or array itself is not.

OBI positions do not extend into a schema that declares `$id` (has an `$id` member). That schema is itself at an OBI position, but nothing inside it is, its own keywords other than `$id` included. They belong to the resource it declares ([§7.2](#72-the-document-as-embedding)).

The **schemas the document contains** are:

- the schemas at OBI positions;
- every subschema reached through the same keywords from a schema at an OBI position that declares `$id`, entering nested schemas that declare `$id` as well.

Nothing else in the document is a schema it contains: no value in `sources`, in binding `data`, in an example, or in an extension, and no data under `const`, `enum`, or an unknown keyword. Following a reference never adds to these schemas. Wherever this specification uses these terms, a schema at an OBI position, or a schema the document contains, is any JSON object or boolean there. It is such a schema whether or not it is valid against the meta-schemas. Any other value there is not a schema.

### 7.1. Reference forms

The **OBI-defined references** are the `$ref` and `$dynamicRef` keywords in the [document resource](#72-the-document-as-embedding). [OBI-11](#10-conformance) fixes their form, and that of each schema `$id` at an OBI position. A same-document reference is empty or a fragment alone (RFC 3986 §4.4). A string that is not a well-formed URI-reference is not a reference of any form.

### 7.2. The document as embedding

JSON Schema lets the format that embeds a schema determine its initial base URI (JSON Schema Core §9.1.1). It leaves open how such schemas fit its resource model (JSON Schema Core §4.3.5). This specification settles both:

- **Base URI.** The document is its schemas' embedding document, with a base URI unique to it and drawn from nowhere else (RFC 3986 §5.1.4). In the document resource, a same-document reference initially resolves to what [§7.3](#73-same-document-references) says it identifies, with dynamic resolution then following JSON Schema ([§7.4](#74-other-references)).
- **Document resource.** The schemas at OBI positions that declare no `$id` are subschemas of one schema resource, the **document resource**. The plain names those schemas declare with `$anchor` or `$dynamicAnchor` belong to the document resource, though [OBI-14](#10-conformance) excludes `$dynamicAnchor` there. An evaluation that begins at one of those schemas begins in it, making the document resource the outermost in the evaluation's dynamic scope.
- **`$id` resources.** A schema that declares `$id` begins a resource of its own, as does a schema nested in it that declares `$id`. A reference to the URI such an `$id` declares resolves to that schema within the document. The references, anchors, and nested `$id`s within a schema that declares `$id`, including its own keywords other than `$id`, take any form JSON Schema allows. They resolve against its base. A plain name declared only inside a schema that declares `$id` belongs to that schema's resource.
- **Sources.** The `sources` map establishes no schema resource and no base URI. An `$id`, anchor, or reference inside a source's or a binding's `data` is data: it identifies nothing to the document's schemas, and none of them resolves to it.

The **schema resources the document contains** are the document resource and each resource begun by a schema the document contains that declares `$id`; nothing in `sources` or in binding `data` is one. A reference resolves into one of the identified resources only through that resource's `$id`, compared as [OBI-13](#10-conformance) compares `$id`s, so a resource whose `$id` OBI-13 leaves out of its comparison is never resolved into.

### 7.3. Same-document references

In the document resource, a same-document reference identifies as follows:

1. **Decoding.** Its fragment is percent-decoded once. A fragment that does not decode to valid UTF-8 identifies nothing.
2. **Empty reference or fragment.** An empty reference or an empty fragment, such as `#`, identifies the OBI document itself, not the schema that contains it.
3. **JSON Pointer.** A decoded fragment that begins with `/`, such as that of `#/schemas/Task`, is a JSON Pointer evaluated per [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) §4 from the document root. A valid pointer identifies the location it reaches. One that is not valid, or reaches no location, identifies nothing.
4. **Plain name.** Any other fragment is a plain name, and identifies a schema in the document resource that declares it ([§7.2](#72-the-document-as-embedding)).

An `$anchor` or `$dynamicAnchor` declares a plain name only when its value is a string matching, as a whole, the grammar of JSON Schema Core §8.2.2. One whose value does not match violates [OBI-10](#10-conformance).

In the document resource, what a same-document reference identifies depends only on the document.

A pointer can reach locations that are not schemas the document contains. Such locations include an operation object, a map, a string, an extension's value ([§12](#12-extensions)), a binding's `data`, an example value, and anything in `sources`. A pointer can also reach a schema inside a schema that declares `$id`. It then identifies that schema in the resource it belongs to: references within it resolve against that resource's base, and evaluation through the pointer enters that resource, as for any reference whose target lies in an embedded resource (JSON Schema Core §9.2.1, which advises reaching such a schema through the `$id` instead). [§7.5](#75-notes-and-examples-informative) tabulates cases.

### 7.4. Other references

Beyond what [§7.2](#72-the-document-as-embedding) and [§7.3](#73-same-document-references) define, references resolve as JSON Schema 2020-12 defines. Those references are:

- dynamic references;
- references within a schema resource that declares `$id` (its plain names included);
- references to external schemas.

[OBI-13](#10-conformance) compares `$id`s only after the resolution and empty-fragment removal it names, and that resolution removes dot segments. So spellings that RFC 3986 §6 normalization would equate but those steps leave different stay distinct for that rule. Examples are a host in another case and a percent-encoded unreserved character. [OBI-12](#10-conformance) uses the same comparison to decide whether a reference resolves into a resource the document contains: a reference spelled otherwise is, for that rule, a reference to an external schema. Whether such spellings name one resource is for JSON Schema to say.

A reference that resolves into a schema resource the document contains must identify a schema the document contains when its fragment is resolved in that resource as JSON Schema defines: a JSON Pointer from that resource's root, reaching into nested resources as JSON Schema Core §9.2.1 permits, or a plain name declared in that resource. One that does not violates OBI-12. Examples are a JSON Pointer that reaches no schema (JSON Schema Core §9.4.2) and a plain name declared twice in that resource (JSON Schema Core §8.2.2), or nowhere in it. Within a schema resource that declares `$id`, a `$ref`, `$dynamicRef`, or `$id` that is not a well-formed URI-reference has an undefined result ([§5.2](#52-schemas)).

**Note.** Such a result does not make the document non-conformant.

Schema reference cycles are permitted: recursive types (trees, linked lists, ASTs) are legitimate and widespread. A cycle that recurses without consuming any of the instance has an undefined result ([§5.2](#52-schemas); JSON Schema Core §9.4.1). An example is a schema whose only keyword is a `$ref` to itself.

### 7.5. Notes and examples (informative)

What each schema rule covers:

| Rule | Covers | At a schema that declares `$id` |
| ---- | ------ | -------------------------------- |
| OBI-09 | `$schema` in every schema the document contains | Applies inside the resource |
| OBI-10 | Each operation `input`/`output` and `schemas` entry, with its subschemas, against the meta-schemas | Applies inside the resource |
| OBI-11 | `$ref` and `$dynamicRef` in the document resource; `$id` at OBI positions | That schema's `$id` only; its other keywords and contents belong to its resource |
| OBI-12 | Same-document references in the document resource; every reference that resolves into a resource the document contains | Its own references too, where they resolve into a resource the document contains; a pointer may reach into it, but a plain name declared inside it does not count in the document resource |
| OBI-13 | Plain names in the document resource; `$id` in every schema the document contains | Plain names inside it belong to its resource |
| OBI-14 | `$dynamicAnchor` in the document resource | Does not apply inside the resource |

**Same-document references (example).** Given this document:

```json
{
  "openbindings": "0.2.0",
  "operations": {},
  "sources": {
    "api": {
      "kind": "example.openapi@1",
      "data": {
        "openapi": "3.1.0",
        "info": {"title": "Tasks", "version": "1"},
        "components": {"schemas": {"Task": {"type": "object"}}}
      }
    }
  },
  "schemas": {
    "Task": {
      "$anchor": "task",
      "type": "object",
      "properties": {"my type": {"type": "string"}}
    },
    "Tree": {
      "$id": "https://example.com/schemas/tree.json",
      "$anchor": "tree",
      "type": "object",
      "properties": {
        "children": {"type": "array", "items": {"$ref": "#"}}
      }
    }
  }
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
| `#/sources/api/data/components/schemas/Task` | A pointer into `sources` | Violates OBI-12: nothing in `sources` is a schema the document contains |
| `#/schemas/Tree` | A pointer landing on `Tree`, which declares `$id` | Meets OBI-11 and OBI-12 (JSON Schema Core §9.2.1 advises against this form for an embedded resource; reference `Tree` through its `$id`) |
| `#/schemas/Tree/properties/children` | A pointer into Tree's resource | Meets OBI-11 and OBI-12: identifies `children` in Tree's resource, as `https://example.com/schemas/tree.json#/properties/children` does (JSON Schema Core §9.2.1 advises that form) |
| `#task` | A plain name declared in the document resource | Meets OBI-11 and OBI-12 |
| `#t%61sk` | Decoded to the plain name `task` | Meets OBI-11 and OBI-12 (though a plain name never needs encoding: its grammar admits only characters a fragment allows) |
| `#tree` | A plain name declared only inside Tree's resource | Violates OBI-12 |
| `#%FF` | A fragment that does not decode to UTF-8 | Violates OBI-12 |
| `tree.json#/properties/children` | A relative reference that is not same-document | Violates OBI-11 |
| `https://example.com/schemas/tree.json#/properties/children` | An absolute URI that resolves into Tree's resource | Meets OBI-11 and OBI-12 |
| `https://example.com/schemas/tree.json#/properties/missing` | An absolute URI that resolves into Tree's resource and reaches nothing | Violates OBI-12 |
| `https://EXAMPLE.com/schemas/tree.json` | A spelling OBI-13's comparison keeps distinct | Meets OBI-11; for OBI-12 a reference to an external schema, and resolves as JSON Schema defines |

The `{"$ref": "#"}` inside `Tree` resolves against Tree's `$id` and names `Tree` itself, which meets OBI-12.

A schema written as a standalone file often recurses with `{"$ref": "#"}` or points into its own `$defs` with `#/$defs/Node`. In the document resource, both are read from the OBI root: the first identifies the OBI document and the second nothing, so both violate OBI-12. From the document resource, such a schema's parts are named by their place in the document, as in `#/schemas/Tree/$defs/Node`. A schema that declares an absolute `$id` resolves its own references against that `$id`, as it did standalone, with pointers per RFC 6901 §6; a pointer inside it that reaches nothing still violates OBI-12 ([§7.4](#74-other-references)). In this document, `Tree` declares one:

```json
{
  "openbindings": "0.2.0",
  "operations": {
    "getTree": {
      "input": {"type": "object", "maxProperties": 0},
      "output": {"$ref": "https://example.com/schemas/tree.json"}
    }
  },
  "schemas": {
    "Tree": {
      "$id": "https://example.com/schemas/tree.json",
      "type": "object",
      "properties": {
        "children": {"type": "array", "items": {"$ref": "#"}}
      }
    }
  }
}
```

Schemas in `schemas` that declare `$id`s resolve one another's references by those `$id`s, as the embedded resources of a JSON Schema bundle do (JSON Schema Core §9.3.1).

Addressing works in one direction. The document's base URI is drawn from nowhere a reference can name ([§7.2](#72-the-document-as-embedding)). So a schema with its own `$id` cannot address by URI the schemas that belong to the document resource. Any shared schema it references must therefore be reachable through an identified resource. Either the shared schema has its own `$id`, or a pointer or anchor within a resource that has one reaches it. The same holds across documents: `$id` is the portable handle for a schema meant to be referenced from elsewhere. A reference into a document that is not a schema lands in a structure JSON Schema does not recognize. Its result there is undefined (JSON Schema Core §9.4.2). Examples are `#/components/schemas/Task` in an OpenAPI document and `#/schemas/Task` in another OBI. An author instead copies such a schema in, translating it as [§5.2](#52-schemas) describes, or references a schema published as a schema document of its own.

Dynamic resolution could cross back into the document resource. A `$dynamicRef` inside an `$id` resource whose initially resolved fragment was created by `$dynamicAnchor` resolves, through the dynamic scope, to the outermost resource in that scope declaring the same name with `$dynamicAnchor` (JSON Schema Core §8.2.3.2). Every evaluation that begins at an operation schema declaring no `$id` begins in the document resource. A `$dynamicAnchor` declared anywhere in the document resource would therefore capture such references in every such evaluation that reaches one, including through a `schemas` entry nothing uses. [OBI-14](#10-conformance) excludes it, so a dynamic extension's `$dynamicAnchor`s sit inside schemas that declare `$id`.

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

**Version declaration examples (informative).** What each text below declares, and what follows under the 0.2 line's rules:

| Text | Declared version | Under 0.2's rules |
| ---- | ---------------- | ----------------- |
| `{"openbindings":"0.2.0","operations":{}}` | 0.2.0 | Conforms. |
| `{"openbindings":"0.2.7+build.5","operations":{}}` | 0.2.7+build.5 | Conforms; patch number and build metadata carry no meaning. |
| `{"openbindings":"0.3.0","operations":{}}` | 0.3.0 | Not governed by them: 0.3's text governs it. |
| `{"openbindings":"0.2.0-rc.1","operations":{}}` | 0.2.0-rc.1 | Not governed by them: that prerelease's text governs it. |
| `{"openbindings":"0.2.0","description":"\ud800","operations":{}}` | 0.2.0 | Violates OBI-01: the escape denotes an unpaired surrogate. |
| `{"openbindings":"0.2.0","openbindings":"0.3.0","operations":{}}` | None: the member is repeated | Violates OBI-01. |
| `{"operations":{}}` | None | Violates OBI-02 and OBI-03. |

**Release policy.** While pre-1.0, minor versions may include breaking changes, per pre-1.0 SemVer convention. Changes to the guarantees for kinds are breaking: kind comparison ([§6](#6-kinds)); data values and presence ([§5](#5-document-model), [§5.3](#53-bindings), [§5.4](#54-sources)); the binding's `source` reference ([§5.3](#53-bindings)); the boundary between kind interpretation and the document's schemas ([§6](#6-kinds), [§7](#7-reference-resolution)); operation value representation ([§5](#5-document-model), invariant 1); and binding realization claims ([§5.3](#53-bindings)). Such changes are recorded as breaking in the changelog, whether or not a particular kind's definition is affected.

### 8.2. `version` field (interface-version label)

The optional `version` field is the author's label for the described interface. It is an opaque non-empty string, the same label as another exactly when their strings are equal ([§5](#5-document-model)). This specification gives it no other meaning. Authors MAY follow SemVer, dates, or any other convention. Any stronger reading comes from an external catalog, registry, or organizational policy.

**Note.** This specification gives the `version` field no order, compatibility, or identity. The field has no effect on how a reference resolves or on the line or prerelease a document declares.

---

## 9. Security considerations

Processing OBI documents involves parsing potentially untrusted JSON and may involve resolving or evaluating schemas. Interpreting source and binding data according to the source's kind can introduce additional risks. Relevant exposures include:

- **URIs as attack vectors.** Schema references may identify arbitrary endpoints, network or local. These endpoints include internal or link-local addresses such as `http://169.254.169.254/...` and local files such as `file:///etc/passwd`. Unrestricted dereferencing creates SSRF and exfiltration exposure.
- **Unbounded size.** The specification caps the size of neither OBI documents nor referenced schemas. Untrusted input creates memory and processing-time exhaustion exposure.
- **Regular-expression cost.** Schema `pattern` and `patternProperties` values run on the evaluating tool's regular-expression engine. A backtracking engine can take exponential time on crafted input.
- **Schema `$ref` cycles.** Permitted by [§7](#7-reference-resolution); naive resolvers can exhaust the stack or loop indefinitely.
- **Identifier shadowing.** An `$id` can claim any URI, including a meta-schema's or one another document declares. A tool might register the schema resources of every document it reads in one shared registry. One document can then change how another's references, or its meta-schema lookups, resolve (JSON Schema Core §13).
- **Kind-specific processing.** A kind may interpret data as references or executable material. Risks from that interpretation and appropriate safeguards depend on the kind and execution environment.
- **Dependencies are not trust claims.** A matching operation name or kind establishes neither the authenticity nor the authorization of whatever supplies a realization. A realization found that way, and the values it supplies, stay untrusted until other means establish trust in them.
- **Integrity is out of scope.** Authenticity and integrity are established by external means (transport security, content signing, out-of-band attestation) or not at all. [Appendix A](#appendix-a-canonical-serialization-informative) names a deterministic serialization such systems can build on.

Common measures against these exposures, where documents come from untrusted origins:

- allowing only expected URI schemes and network ranges to be dereferenced, checked after DNS resolution and at each redirect;
- capping the size of documents and fetched schemas;
- bounding the cost of regular-expression matching;
- keeping each document's schema resources apart from other documents' and from the meta-schemas;
- bounding traversal through recursive schemas and schema references.

---

## 10. Conformance

The rules below govern these texts:

- a text that declares a version of the 0.2 line (in a prerelease of this specification, instead, one that declares that prerelease);
- a text that declares no version ([§8.1](#81-openbindings-field-specification-version)).

A text declaring another line or prerelease is governed by the text of that line or prerelease. A text these rules govern conforms to this specification exactly when it meets every rule below. OBI-02 to OBI-14 apply only to the JSON value of a text that meets OBI-01.

For every text they govern, the rules use the terms the other sections define. Such terms include the version a text declares, a schema at an OBI position, what a same-document reference identifies, and a declared plain name. The meaning those sections give a document's members holds only for a conformant document. Text marked *Note* in a rule, which runs to the rule's end, explains it and adds no requirement.

The prose defines the document model. The schema `openbindings.schema.json` expresses the model's structural part in JSON Schema, and the structural requirements of [§5](#5-document-model) take effect through OBI-02. The schema's `$id` names the line, and its title the release. The schema also expresses OBI-03 and OBI-04, and the name syntax of the references that OBI-06, OBI-07, and OBI-08 concern. For OBI-05 it expresses only an alias repeated within one operation's `aliases`. For OBI-09 it expresses only the value of a `$schema` at the top of each operation `input` and `output` and each `schemas` entry. It does not interpret source or binding `data`, and the remaining schema checks are separate. A document violating those parts of the rules violates OBI-02 as well. The other rules apply beyond what the schema expresses.

Each rule carries an identifier for test suites and errata to cite. A rule is cited under a line ([§8.1](#81-openbindings-field-specification-version)). An identifier means what that line's text says, and another line may number its rules differently. A patch release adds and renumbers no rule.

A conformant OBI document:

- **OBI-01**: Is valid UTF-8 ([RFC 3629](https://www.rfc-editor.org/rfc/rfc3629)) encoded JSON per [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259), with no leading byte-order mark, no member name or string value holding an escape that denotes an unpaired surrogate (RFC 8259 §8.2), and no object holding two members whose names are equal ([§5](#5-document-model)). *Note:* parsers differ on all three, so the same bytes could yield different values, or none. In `"\ud800"` the escape denotes a code point UTF-8 cannot encode (RFC 3629 §3), so excluding it applies the UTF-8 requirement to escaped text too. A surrogate pair such as `"\ud83d\ude00"` denotes one character, and noncharacters such as U+FFFF are read alike by parsers; both are permitted. The exclusions follow RFC 8259 §8.1, which forbids adding a byte-order mark, and interoperable-JSON practice ([RFC 7493](https://www.rfc-editor.org/rfc/rfc7493) §2.1, §2.3).
- **OBI-02**: Is valid against the derived JSON Schema published with this text (`openbindings.schema.json`, `$id` `https://openbindings.com/schema/openbindings-0.2.json`), its `pattern` values read as ECMA-262 regular expressions. Where the schema and the prose disagree, the schema governs this rule until a patch release corrects the erratum. A patch release that corrects the schema republishes it under the same `$id`.
- **OBI-03**: Has an `openbindings` field whose value is a valid [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) string.
- **OBI-04**: Has every map key this specification defines (operation, source, binding, dependency, schema, and example keys) and every entry of an operation's `aliases` array a string matching `^[A-Za-z0-9_][A-Za-z0-9_.-]*$`. The pattern is an ECMA-262 regular expression matched against the whole name. Property names inside JSON Schema objects are schema content, not map keys, and are unconstrained by this rule.
- **OBI-05**: Has no string occurring more than once among all operations' keys and `aliases` entries taken together.
- **OBI-06**: Has every `bindings[*].operation` value present as a key in the document's `operations` map.
- **OBI-07**: Has every `bindings[*].source` value present as a key in the document's `sources` map.
- **OBI-08**: Has every `dependencies[*].operation` value present as a key in the document's `operations` map.
- **OBI-09**: Has every `$schema` keyword in a schema the document contains ([§7](#7-reference-resolution)) equal to `https://json-schema.org/draft/2020-12/schema` or `https://json-schema.org/draft/2020-12/schema#`.
- **OBI-10**: Has every operation `input` and `output` and every entry in `schemas` valid against the JSON Schema 2020-12 meta-schemas, which validate its subschemas in turn ([§5.2](#52-schemas)). The meta-schemas are the dialect meta-schema `https://json-schema.org/draft/2020-12/schema` and the vocabulary meta-schemas it references, as published with [JSON Schema Core](#131-normative-references). They apply with `format` as an annotation, JSON Schema's default (JSON Schema Validation §7.2.1). They also apply with their `pattern` values read as ECMA-262 regular expressions, the regular-expression dialect JSON Schema names (JSON Schema Core §6.4).
- **OBI-11**: Has every schema `$ref` and `$dynamicRef` in the document resource ([§7.2](#72-the-document-as-embedding)) an absolute URI ([§3](#3-terminology)) or a same-document reference, and every schema `$id` at an OBI position an absolute URI. All of them are also well-formed URI-references per [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) §4.1 ([§7.1](#71-reference-forms)).
- **OBI-12**: Has every same-document schema `$ref` and `$dynamicRef` in the document resource identifying a schema the document contains ([§7.3](#73-same-document-references)). Has every `$ref` and `$dynamicRef`, in any schema the document contains, that resolves into a schema resource the document contains identify a schema the document contains when its fragment is resolved in that resource as JSON Schema defines ([§7.4](#74-other-references)). A reference resolves into such a resource when its value, resolved against its base URI and without its fragment, equals that resource's `$id` as OBI-13 compares `$id`s; for `$dynamicRef` this is its initial resolution, before any dynamic-scope replacement.
- **OBI-13**: Has no plain name ([§7.3](#73-same-document-references)) declared more than once in the document resource, and no `$id` declared by two schemas the document contains. In counting a plain name's declarations, each `$anchor` and each `$dynamicAnchor` that declares it counts once (JSON Schema Core §8.2.2). An `$id` is compared only when it is a well-formed URI-reference and at least one of these holds:
  - it is an absolute URI;
  - it resolves against the `$id` of the nearest enclosing schema that declares one, and that `$id` is itself compared.

  Every other `$id` is left out of the comparison ([§7.4](#74-other-references)). For that comparison, each compared `$id` is:

  1. resolved to an absolute URI per RFC 3986 §5.2 (which removes dot segments);
  2. stripped of any empty fragment;
  3. compared as a string ([§5](#5-document-model)).
- **OBI-14**: Has no schema that belongs to the document resource with a `$dynamicAnchor` member ([§7.2](#72-the-document-as-embedding)). *Note:* the document resource is outermost in the dynamic scope of every evaluation that begins at an operation schema declaring no `$id`, so such an anchor would capture `$dynamicRef`s throughout the document, whether or not anything uses the schema that declares it ([§7.5](#75-notes-and-examples-informative)). A `$dynamicAnchor` belongs inside a schema that declares `$id`.

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
- **Fragment identifier considerations:** JSON Pointer per [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901), or a plain name declared by `$anchor` in the document resource ([§7.3](#73-same-document-references); JSON Schema Core §8.2.2). Such a fragment identifies a location in the representation. The document resource itself has no portable, externally nameable base, so its schemas cannot be addressed from outside the document as schema resources ([§7.2](#72-the-document-as-embedding))
- **Additional information:** deprecated alias names, magic numbers, file extensions, and Macintosh file type codes: none
- **Person and email address to contact for further information:** the OpenBindings maintainers, hello@openbindings.com; see also [github.com/openbindings](https://github.com/openbindings)
- **Intended usage:** COMMON
- **Restrictions on usage:** none
- **Author:** the OpenBindings maintainers
- **Change controller:** openbindings project

---

## 12. Extensions

A field ([§3](#3-terminology)) whose name begins with `x-` is an **extension**. OBI documents MAY include extensions in any OBI-defined object. An extension never changes any meaning this specification gives the document. Its own meaning, if any, is defined outside this specification. Unprefixed field names are reserved ([§5](#5-document-model), [OBI-02](#10-conformance)) so this specification can add fields without colliding with a document's own data.

Keys inside the document's maps (`operations`, `sources`, `bindings`, `dependencies`, `schemas`, and an operation's `examples`) are entry names, not fields. An `x-`-prefixed key there names an ordinary entry, subject to OBI-04 like any other key. In `operations` such a key enters the identifier namespace (OBI-05).

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
- `examples/`: example OBI documents; like this text's examples, their kinds (`example.*`) and the shapes of their `data` are illustrative.
- `CHANGELOG.md`: version history and diffs between specification versions.
- `EDITORS.md`: current editor roster.
- `GOVERNANCE.md`: project governance and decision-making.
- `SECURITY.md`: vulnerability reporting and security contact.

---

## Appendix A. Canonical serialization (informative)

Some applications need a stable byte representation of an OBI document: content addressing, integrity attestation, digital signing, cache keys, prompt-cache stability.

Take an OBI whose parsed JSON value satisfies the input requirements of [RFC 8785 (JSON Canonicalization Scheme)](https://www.rfc-editor.org/rfc/rfc8785). Its JCS serialization provides deterministic bytes for the carried JSON value. The serialization carries that value exactly when every number's exact decimal value survives JCS's binary64 rendering (below). The facility is **partial**. RFC 8785 constrains its input to the I-JSON subset ([RFC 7493](https://www.rfc-editor.org/rfc/rfc7493): numbers representable in IEEE 754 binary64, strings free of surrogates and noncharacters). OBI-01 excludes unpaired surrogates, but this specification bounds neither numbers nor noncharacters, so a conformant OBI may have no JCS serialization.

The facility is JCS over the value exactly as carried. Rounding, coercing, repairing, or otherwise changing a value to manufacture compatible input yields the serialization of some other value. RFC 8785 rejects incompatible input. JCS also serializes each number from its binary64 value. So a number whose exact decimal value differs from the shortest rendering of that value is not carried exactly. For example, `1000000000000000128` is serialized as `1000000000000000100`. Under this specification's reading of numbers ([§5](#5-document-model)), such an OBI has no JCS serialization that carries its value exactly. Yet RFC 8785 itself does not reject it.

Canonical serialization is syntactic: JCS sorts object member names and preserves array order, and performs no semantic normalization. Two OBIs that mean the same thing can have different canonical bytes, and equal bytes establish equal carried JSON data. Naming a serialization defines no integrity system ([§9](#9-security-considerations)). Digest algorithms, signed-document formats, carrier fields, and trust policy belong to downstream specifications. JCS covers only the JSON value carried in the OBI itself, never fetched external resources.
