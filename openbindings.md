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

The kinds in this document's examples (`example.openapi@1`, `example.mcp@1`, `example.grpc@1`) and the shapes of their `content`, such as `{ "location": … }` on a source and `{ "target": … }` on a binding, are illustrative; only a kind gives `content` meaning ([§6](#6-kinds)).

The body of this document defines the OBI shape, its reference-resolution rules, how kinds are compared, and conformance rules for documents and tools. New readers may prefer the [§4. Overview](#4-overview-informative) walkthrough; the normative material starts at [§2. Core invariants](#2-core-invariants).

## Editors

- Matthew Clevenger ([@clevengermatt](https://github.com/clevengermatt))

See `EDITORS.md` for the current editor roster.

## Status of this document

This is **version 0.2.0** of the OpenBindings specification. This text is the unreleased working draft of that version; the latest release is **0.1.0** (immutable released snapshots live under `versions/`). Until 0.2.0 is released, this working draft stands in for that release wherever this text speaks of the release a conclusion applies, and a conclusion reached under it names the draft and the revision it applied. It is pre-1.0, and minor-version revisions MAY include breaking changes per [§8. Versioning](#8-versioning). Substantive changes are recorded in `CHANGELOG.md` and cite rule identifiers (`OBI-D-##`/`OBI-T-##`) where applicable, each under the version it belongs to.

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

JSON shown inline in this document is illustrative unless the surrounding prose explicitly states a requirement.

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
  - [7.3. Same-document references](#73-same-document-references)
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

OpenBindings sits one layer above protocol-specific interface specifications such as OpenAPI, AsyncAPI, gRPC, and MCP, which describe how to interact with endpoints over a particular wire format. An OBI describes, at the layer above: operations, each saying what a service can do rather than how; the concrete realizations bindings declare for them; the operations a described component consumes; and the shared names by which operations can be recognized. It complements the artifacts its sources carry or point at rather than replacing them. What an OBI adds is the operation-level overlay that no single concrete interaction carries, in a form that holds across protocols.

### 1.1. Distinguishing features

- **One operation, many bindings.** A single operation contract can be realized over multiple protocols simultaneously without duplicating the contract.
- **One contract, either direction.** Bindings declare realizations of an operation; named dependencies declare where the described component consumes realizations, without splitting the operation map into provider and consumer copies.
- **Vendor-independent correspondence.** An operation can adopt the name a shared contract publishes, so consumers recognize it by that shared name rather than by who runs the service ([§5.1](#51-operations)).
- **Location-independent, offline-decidable documents.** A document's OBI-defined references never depend on where it was obtained, and every document rule is decidable from the document and locally available resources (invariants 4 and 5).

### 1.2. Out of scope

The core defines the document envelope and each operation's caller-facing value contract. Two other parties decide the rest:

- **The source's kind** decides how a source and its bindings are read, beginning with what their `content` means ([§6](#6-kinds) lists the matters). Wherever this specification says a matter is read under a source's kind, it marks this boundary: it neither asserts that a definition or implementation of the kind exists nor gives one authority over the document model.
- **Tools** decide whether and when to invoke, whether to validate values at runtime, how to choose among bindings (candidate construction, filtering, fallback, and tie-breaking), how to compose dependencies with providers (discovering candidate bindings, judging their compatibility, choosing among them, and registering, configuring, authenticating, or monitoring the chosen target), their security posture, and any compatibility judgment or matching beyond the exact kind comparison and name resolution the core fixes ([OBI-T-01](#103-tool-rules), [OBI-T-07](#103-tool-rules)) (invariant 2). This specification defines no invoker, a tool that acts on bindings to carry out operations: invocation lifecycle, retries, credential flow, sandboxing, and rate limiting are implementation concerns.

OpenBindings also does not:

- **Serve as an authoring language.** It defines the interchange document; authoring tools and compilation workflows, such as TypeSpec and Smithy, are outside it.
- **Define acquisition or publication** ([§1.3](#13-obtaining-an-obi)).
- **Maintain registries.** Kinds, correspondence names, and format conventions are author-assigned; this specification provides no registry or ownership test.
- **Specify integrity, signing, or attestation.** These compose externally ([Appendix A](#appendix-a-canonical-serialization-informative)).

### 1.3. Obtaining an OBI

An OBI may be obtained through local files, packages, standard input, embedded resources, network retrieval, or any other mechanism, and the core reads it the same way whichever mechanism delivered it (invariant 4, [§7](#7-reference-resolution)).

---

## 2. Core invariants

The rules in this specification instantiate six invariants; other sections cite them by number.

1. **Per-value contract.** Operation `input` and `output` schemas govern each value that crosses the operation's caller-facing boundary, one value at a time. Interaction pattern, cardinality, framing, completion, and lifecycle are read under the source's kind.
2. **Enabling, not invoking.** A binding declares a realization of its operation through a source; the document alone need not suffice to identify, reach, or act on a target. A dependency carries no target and becomes actionable only through tool-defined composition with a realization. No rule in this specification obligates a tool to invoke, satisfy a dependency, validate values at runtime because it invokes, or handle failures in a prescribed way. Rules about validation semantics apply to tools that claim the corresponding capability.
3. **Bounded interpretation.** The operation carries the caller-facing value contract. This specification defines neither the meaning of source or binding `content` nor the addresses, representations, references, value adaptation, and interaction a tool may use when acting on them. A kind does not change the meaning of core fields.
4. **Context-free references.** No OBI-defined reference ([§7](#7-reference-resolution)) resolves against the URI a document was fetched from, so the document model means the same thing however a document was obtained. Source and binding `content` are outside that reference rule (invariant 3). OBI assigns no document identity; `name` and `version` are labels.
5. **Offline-decidable conformance.** Document conformance is an objective property of the document under the text it is judged against, decidable from the document plus locally available resources (bundled meta-schemas included). No document rule's outcome depends on network state, so a document's conformance changes only when a patch release corrects that text, and a conformance conclusion names the release (a patch release, or a prerelease a processor explicitly supports) whose text it applied ([§8.1](#81-openbindings-field-specification-version), [OBI-T-09](#103-tool-rules)). A validator's inability to decide a rule is not itself evidence of non-conformance.
6. **Decentralized extension.** This specification assigns no authority over kinds or shared correspondence names. Nothing in the model requires a registry, and no kind is implicitly dereferenced to be understood.

---

## 3. Terminology

- **OBI**: an OpenBindings interface document.
- **Core**: this specification, as distinct from what particular kinds define.
- **Tool**: any software that acts on OBI documents ([§10.1](#101-tool-obligations)).
- **Processor**: a tool that takes an OBI document as input ([§10.1](#101-tool-obligations)).
- **Validator**: a processor that checks a document against the document rules of [§10.2](#102-document-rules) and reports what it established ([§10.4](#104-conformance-conclusions)).
- **Operation**: a named, protocol-independent capability contract, stored under a key in the document's `operations` map: what a service can do, as a name with optional per-value input and output schemas ([§5.1](#51-operations)).
- **Alias**: an additional name under which an operation is recognized, equal in standing to its key ([§5.1](#51-operations)).
- **Correspondence**: an operation **claims correspondence with** a shared contract's operation by carrying that operation's name as its key or an alias. The claim is the author's alone ([§5.1](#51-operations)).
- **Caller-facing**: on the operation's side of a binding. Caller-facing values are the ones a caller of the operation sends and receives under its `input` and `output` contracts; how they correspond to the source interaction, including any adaptation between them, is read under the source's kind. Which values are caller-facing is set out in [§5](#5-document-model).
- **Context**: what a realization needs that the operation is not about, such as a credential or the address of a target. The kind or tool policy supplies it ([§5](#5-document-model)).
- **Binding**: an author-declared realization of an operation through a source, stored under a key in the document's `bindings` map ([§5.3](#53-bindings)).
- **Realization**: a concrete way of carrying out an operation's contract through a target. A binding declares one, as its author's claim ([§5.3](#53-bindings)); a dependency, also by its author's claim, consumes one supplied from elsewhere ([§5.5](#55-dependencies)).
- **Target**: what a binding is intended to act on under its source's kind: an entry in an artifact, a member of a live surface, or another form ([§5.4](#54-sources)).
- **Interaction**: the exchange with a target that acting on a binding involves, such as a request and response, a stream, or a subscription. Its mechanics are read under the source's kind ([§6](#6-kinds)).
- **Source**: a kind together with optional content read under that kind, stored under a key in the document's `sources` map ([§5.4](#54-sources)).
- **Source artifact**: a concrete representation an interpretation of a source may use, such as an OpenAPI document, a `.proto` source, an operation graph, or an MCP endpoint's tool listing. It may be carried in or referenced from source `content`, or obtained otherwise ([§5.4](#54-sources)).
- **Kind**: the exact, opaque, non-empty string a source carries in `kind` and a dependency may list in `kinds`. It selects how a source and its bindings are read ([§6](#6-kinds)).
- **Dependency**: a named point where the described component consumes a realization of an operation, optionally limited to declared kinds, stored under a key in the document's `dependencies` map ([§5.5](#55-dependencies)).
- **OBI position**: a place where the document model puts a schema. The **schemas the document contains** extend these through the resources declared there, nested resources included ([§7](#7-reference-resolution)).
- **Document resource**: the schema resource that every schema at an OBI position that declares no `$id` belongs to ([§7.2](#72-the-document-as-embedding)). A schema that declares `$id` begins a resource of its own, and a schema nested in it that declares `$id` begins a further one.
- **Absolute URI**: a URI with a scheme (RFC 3986 §3), which may carry a fragment; RFC 3986's `absolute-URI` production, which excludes fragments, is not what is meant.

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

An operation is the contract, a source carries the kind under which it and its bindings are read, and a binding links the two. One contract with many bindings is the specification's primary abstraction. This fuller OBI binds `createTask` over two protocols, shares a schema between operations, describes an error shape beside a result, adapts a source's wire shape in binding content, and claims correspondence with a published interface's operation through a qualified alias:

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

An operation's presence alone declares a contract, not availability. A binding declares a realization of the operation through a source; a dependency declares a named consumption point for which a realization may be supplied through composition:

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

The alias adopts a published name, so a tool composing the component can look for a provider whose operation carries the same name; how it finds and judges one is its own ([§1.2](#12-out-of-scope)).

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

**Names.** Every map key this specification defines (operation, dependency, binding, source, schema, and example keys) and every operation alias MUST match `^[A-Za-z0-9_][A-Za-z0-9_.-]*$` ([OBI-D-03](#102-document-rules)). The pattern is an [ECMA-262](#131-normative-references) regular expression, as patterns are in JSON Schema, and must match the whole name, so a name with a trailing newline does not match. Names are opaque ASCII tokens, and two names are the same name only when their strings are exactly equal, case included: a trimmed, case-folded, Unicode-normalized, or otherwise rewritten name is a different name, so every rule that compares names compares them exactly. Dot and hyphen carry no structure; a dot may qualify a shared name by authoring convention ([§5.1](#51-operations)), but nothing in this specification parses the segments. A name is an opaque token whatever its spelling resembles (a URI, a path, a programming-language identifier), which is why the grammar admits a leading digit (`2fa.verify`); code generators apply their own deterministic naming policy. Keys within one map are distinct because a document repeats no member name ([OBI-D-01](#102-document-rules)).

**Value representation.** Operation inputs and outputs are described in terms of the JSON data model of [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259). A caller-facing value is one JSON value crossing the operation boundary. Which data of an interaction forms one value, and how that data corresponds to its JSON representation, is read under the source's kind: an array returned in one HTTP response can be one value, and the items of a gRPC stream several. An operation's schemas apply to each value, never to a sequence of values as a whole (invariant 1). A value a tool needs only to reach or authorize a target, such as a credential, is caller-facing only when the operation is about it; otherwise it is context, which the kind or tool policy supplies. A tool chooses the data types it uses internally and exposes through its own APIs, and need not materialize JSON text.

**Presence.** For every optional member, presence is distinct from value: a member present with the JSON value `null` is present, and only omitting the member omits it. Implementations therefore track presence rather than testing for nullish values.

### 5.1. Operations

An operation declares what a service can do: its name and optional schemas for each caller-facing input and output value, which together are its whole signature (invariant 1). Interaction pattern and cardinality (request/response, streaming, bidirectional, or pub/sub; how many values cross) belong to each binding, read under its source's kind, and that is what keeps the operation binding-independent. The schemas describe **one value** at a time ([§5](#5-document-model)). An operation stands on its own: the document may bind it, depend on it, do both, or neither ([§5.5](#55-dependencies)).

`output` describes every value the operation returns, whatever it means to the caller: several event types, a union of representations, a result or an error. Any JSON Schema construct can express the variation, such as `oneOf`, `anyOf`, or a `type` array. Which results of an interaction a binding returns as output values is read under its source's kind.

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

**Schema states.** `input` and `output`, when present, hold a JSON Schema 2020-12 object or boolean schema ([§5.2](#52-schemas)). Omission is the sole representation of an unspecified contract; literal `null` is not a valid value at either position. The states are deliberately distinct:

| Form               | Meaning                                                           |
| ------------------ | ----------------------------------------------------------------- |
| field absent       | No contract is specified for that boundary.                       |
| `{}` or `true`     | A contract is specified; every JSON value satisfies it.           |
| `false`            | A contract is specified; no JSON value satisfies it.              |
| `{"type": "null"}` | A contract is specified; only the JSON value `null` satisfies it. |

Absence makes no portable claim at that boundary: it says neither that the interaction carries no values nor that every value is accepted. `false` is a **value** contract that no value satisfies. It is not a cardinality declaration, though the contract directions below give it consequences: since every value a realization produces must satisfy `output`, a realization of `output: false` produces no output value; since no value satisfies `input: false`, a caller has no value it can send within the contract, and a binding that delivers no caller-facing input values can realize it.

For an operation that takes no meaningful input, the recommended contract is the empty object, `{"type": "object", "maxProperties": 0}`. Kinds differ on whether such a call carries an empty value (an MCP tool's `{}` arguments, a gRPC `Empty` message) or no value at all, and this contract suits both: the empty value satisfies it, and where no value crosses there is nothing to validate. Omitting `input` would leave the input unspecified, and `false` leaves a caller that must send `{}` nothing it may send. An operation that returns nothing meaningful on any outcome, error or otherwise, is written the same way: the empty-object `output` suits a kind that surfaces an empty result as `{}` and one that returns no value, omission leaves the output unspecified, and `output: false` states that a realization never produces a value, which no realization can honor under a kind that surfaces `{}`.

**Contract directions.** The two schemas are caller-facing contracts running in opposite directions. `input` states that, wherever a realization's interaction carries a caller-facing input value, it accepts at minimum every value validating against it, and it may accept more; this creates no input value where the interaction carries none, and a caller sending such a value honors the input contract. To accept a value is to handle it as input to the operation within the contract. Returning a value the output contract permits (one `output` describes, or any value where `output` is absent), error-shaped or not, completing without returning one, and failing for reasons the value alone does not determine (state, authorization, availability) all accept it; refusing the value for what it is, other than by returning such a value, does not. `output` states that every value a realization produces validates against it, and a realization may produce a narrower set; a caller relies on that exactly as far as it trusts the document's claims. A binding attests that its target realizes this contract, and a dependency asserts that the described component consumes a realization of it within this contract ([§5.5](#55-dependencies)); the operation by itself makes no claim that any realization is available.

**Aliases.** An operation's **identifiers** are its key and its aliases, one flat namespace in which every identifier resolves the operation equally. The key is the operation's primary name, used for display, logging, and the references bindings and dependencies carry in their `operation` fields; beyond that, choosing a key or an alias carries no meaning. No string occurs more than once among all operations' keys and aliases taken together ([OBI-D-04](#102-document-rules)): an alias never equals its own operation's key, another operation's identifier, or another of its aliases. A name therefore resolves to at most one operation, identically in every tool ([OBI-T-07](#103-tool-rules)). Aliases commonly keep a prior name after a rename, carry a vendor-specific name some consumers look up by, or adopt a shared contract's operation name.

**Correspondence.** A **shared contract** is any published set of operations offered for adoption, such as another OBI's; the keys and aliases of its operations are published names. By carrying a published operation name as its key or an alias, an operation **claims correspondence with** the published operation. The claim is an author assertion: it identifies no particular contract document or version, establishes no schema compatibility, behavioral equivalence, substitutability, ownership, or trust, and no rule in this specification verifies it. A consumer that requires compatibility compares the operation against a reference OBI of its choosing, under its own policy. Because the claim is made by carrying a name, whatever the author intended, a consumer may read any key or alias that matches a published name as such a claim.

Two adopted names that collide cannot coexist in one document, since the identifier namespace is document-unique. Publishers of names intended for adoption avoid this by qualifying them under a namespace they control, with enough interface scope (`acme.tasks.createTask` rather than `create`), which also keeps claims intentional. A published name is useful for correspondence only while it names one continuing semantic operation, and giving an intentionally incompatible replacement a new name keeps it so. Both conventions reduce collisions and ambiguity; neither is a conformance requirement.

**Idempotency.** `idempotent: true` is an author assertion that repeating the operation with equivalent input and equivalent [context](#3-terminology) produces no additional intended operation-level effects after the first application. `idempotent: false` asserts that some valid repetition can produce additional intended effects. Absence makes no claim in either direction.

The claim concerns intended operation-level effects, not equality of returned values, timing, or other per-attempt observations: a read of changing state can be idempotent while returning different values, and repeated deletion can be idempotent though later attempts report absence. Idempotency does not imply that the operation is safe, read-only, deterministic, cacheable, or harmless, and the claim does not assert that authorization, billing, or audit effects repeat without consequence. Attaching a binding to the operation asserts that it honors the claim under the equivalent conditions ([§5.3](#53-bindings)); the field does not by itself authorize switching bindings between attempts. An invocation policy MAY consider the field but cannot derive retry safety from it alone. Whether the claim is accurate is outside document conformance ([OBI-T-10](#103-tool-rules)).

**Examples.** `examples` maps names to author-supplied samples. An example object MAY contain:

| Field         | Type           | Purpose                              |
| ------------- | -------------- | ------------------------------------ |
| `description` | string         | Human-readable description.          |
| `input`       | any JSON value | One caller-facing input value.       |
| `output`      | any JSON value | One caller-facing output value.      |

Examples are **positive** claims about the caller-facing contract: the author asserts that each provided value validates against the corresponding operation schema, where that schema is specified. The schema is authoritative: a tool that checks the claim evaluates the value as any other value ([§5.2](#52-schemas)), and a mismatch is a false claim, never an exception to the schema ([OBI-T-11](#103-tool-rules)).

Example members are values, not schemas, so presence is distinct from value ([§5](#5-document-model)): an absent member supplies no value, while an explicitly `null` member supplies the JSON value `null`, which the claim covers like any other value. Otherwise an operation whose `output` is `{"type": "null"}` could carry no example. Examples make no claim beyond schema membership: no binding is selected or acted on, and an example's input and output values do not establish that the output can result from the input.

### 5.2. Schemas

The top-level `schemas` map holds named JSON Schemas, which operations reference with `$ref` (for example, `{"$ref": "#/schemas/Task"}`).

Every schema the document contains ([§3](#3-terminology)) is a [JSON Schema 2020-12](https://json-schema.org/draft/2020-12) schema in object or boolean form (`true` and `{}` accept every value; `false` accepts none), and MUST be valid against the 2020-12 meta-schemas ([OBI-D-10](#102-document-rules)). A value occupying a schema position that is not a schema, such as `{"type": 42}`, violates OBI-D-10. `$schema` belongs only on a schema that declares `$id`, the only resource root in an OBI that is itself a schema (JSON Schema Core §8.1.1, [§7.2](#72-the-document-as-embedding)); absence means 2020-12. Wherever `$schema` appears in a schema the document contains, its value MUST be `https://json-schema.org/draft/2020-12/schema`, with or without an empty fragment ([OBI-D-06](#102-document-rules)), and a misplaced one is JSON Schema's to report when a tool uses the schema. A schema obtained by resolving a reference to an external URI follows the dialect JSON Schema assigns it, which is implementation-defined for an external document whose root declares no `$schema` (JSON Schema Core §8.1.1).

Beyond this section and the reference forms of [§7](#7-reference-resolution), JSON Schema 2020-12 governs the document's schemas: what they mean, how their references resolve, and how values are evaluated against them. This specification defines no keyword and no evaluation of its own. Beyond OBI-D-01 and OBI-D-02, which read the whole document, its document rules test the schemas only for meta-schema validity (OBI-D-10), reference forms and dialect (OBI-D-05, OBI-D-06), same-document references that identify a schema (OBI-D-12), and plain names and `$id`s declared twice (OBI-D-13). JSON Schema's other requirements, such as that placement of `$schema`, surface when a tool uses the schema. So do conditions that arise at evaluation, such as an external reference that cannot be obtained or a regular expression an engine cannot compile. Neither creates a document-rule violation.

**Validation semantics.** A tool that claims to check a value against an operation's contract evaluates it under JSON Schema: the document's schemas under 2020-12, and an externally referenced schema under the dialect it declares ([OBI-T-08](#103-tool-rules)). A tool that only preserves schemas through round-trips need not interpret them; a tool claiming to derive a contract from a schema answers for the scope of that claim ([OBI-T-05](#103-tool-rules)).

**Schemas from other dialects (informative).** A schema copied from another dialect keeps its spelling but is read as 2020-12. OpenAPI 3.0's `nullable: true` is then an unknown keyword, which JSON Schema ignores, so `{"type": "string", "nullable": true}` rejects a `null` the service returns, and draft-07's array form of `items` violates OBI-D-10. Translating such schemas to 2020-12 when bringing them in keeps their meaning.

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

A binding's `content` might identify the target that realizes the operation, describe how values are adapted between the operation's contract and that target, or serve any other purpose its source's kind gives it. A JSON Pointer into an OpenAPI document, a fully qualified gRPC method name with a value mapping, and an MCP tool name are examples. Its presence, absence, type, and members carry no core meaning.

**Realizations.** Multiple bindings MAY reference the same operation, each an author-declared realization of it. Attaching a binding asserts that its target carries out the operation it references, as the operation's description conveys it where present (the capability, not the description's wording), and honors the three facts the operation represents: its `input` and `output` schemas ([§5.1](#51-operations)) and its `idempotent` claim. The operation's identifiers, keys and aliases alike, are names; neither they nor its tags, deprecation, or examples are part of the assertion. The assertion is the author's, like `idempotent` itself, and no document rule detects a false one ([OBI-T-10](#103-tool-rules)). A caller uses the operation through any one of its bindings, and using one is a complete use of the operation. OpenBindings does not establish semantic equivalence or mechanical interchangeability among realizations beyond the represented facts (invariant 1); a caller that needs a particular interaction pattern chooses among bindings accordingly.

**One contract, several bindings (informative).** Because every binding attests the same contract, `input` holds only values that every binding carrying input accepts, and `output` covers every value any binding produces: a realization that refuses some `input`-valid values for what they are answers them with values the output contract permits, or `input` excludes them. `idempotent` holds only where every binding honors it, so where bindings differ it is omitted. If callers need to tell output values apart, such as a result from an error, the schema is what distinguishes them, for example through a required property, since no core field marks one. Where one binding's values do not share another's per-value shape (an HTTP binding that returns a list as one array value, a streaming binding that returns its items one at a time), `output` describes both shapes, a kind's value adaptation reconciles them, or they realize different operations.

**Preference signals.** `preference` is an optional signed integer from -9007199254740991 through 9007199254740991 (the exactly representable interoperable range). An integer is a number with no fractional part, however it is written: `1.0` and `1` are the same preference. Among bindings of the same operation that declare it, a higher value expresses stronger author preference, and equal values express no order. Omission states no preference and is not equivalent to zero or any other value; zero and negative values mean nothing beyond their numeric order. `deprecated: true` states that the author recommends migration away from the binding and ordinarily does not recommend it for new use; deprecation neither removes the binding nor changes what it declares. The two signals are independent dimensions (lifecycle guidance and relative choice), and this specification mandates no order between them.

Whether and how these signals shape binding selection is up to tools ([§1.2](#12-out-of-scope)): explicit caller choice and tool policy may override both, and a tool or interface that offers automatic selection documents that policy outside this specification.

### 5.4. Sources

A source object MUST contain:

| Field  | Type   | Purpose                                                                |
| ------ | ------ | ---------------------------------------------------------------------- |
| `kind` | string | The source's kind ([§6](#6-kinds)). |

And MAY contain:

| Field         | Type           | Purpose                                                                  |
| ------------- | -------------- | ------------------------------------------------------------------------ |
| `content`     | any JSON value | Content read under the source's kind.                                    |
| `description` | string         | Human-readable description.                                              |

A source pairs a kind with optional content. The kind selects how the source's `content` and its bindings' `content` are read ([§5.3](#53-bindings), [§6](#6-kinds)). The content can embed an artifact, address one, address a live service, name something a processor's environment provides, or combine these; no JSON type or member within it has a core meaning of its own. JSON has no binary primitive, so how a binary artifact is encoded in `content` is read under the kind.

**Target identity.** How a binding's target is identified is read under the source's kind: from the binding and source alone, or with configuration, runtime naming, or other state. Whether a processor can retrieve, resolve, or act on a source or binding therefore depends on its support for the kind and on what it has, not on document conformance (invariant 2).

### 5.5. Dependencies

A dependency names a point where the component the OBI describes consumes a realization of an operation. Its map key identifies that consumption point for configuration, wiring, and diagnostics; the dependency names no provider, creates no operation, and does not enter the operation-identifier namespace.

A dependency object MUST contain:

| Field       | Type   | Purpose                                    |
| ----------- | ------ | ------------------------------------------ |
| `operation` | string | Key into the document's `operations` map. |

And MAY contain:

| Field         | Type             | Purpose                                     |
| ------------- | ---------------- | ------------------------------------------- |
| `kinds`       | array of strings | Kinds acceptable at this consumption point. |
| `description` | string           | Human-readable description.                 |

`operation` holds an operation's key, not an alias, as a binding's does ([OBI-D-11](#102-document-rules), [§5.1](#51-operations)).

**Consumption.** Declaring a dependency asserts that the described component, as a caller of the operation, sends only values that validate against its `input` and handles any value that validates against its `output`, error-shaped values included, each where that schema is specified; an omitted schema carries no claim at that boundary. The assertion is the author's, like a binding's, and no document rule detects a false one ([OBI-T-10](#103-tool-rules)).

When `kinds` is present, it MUST contain one or more unique kinds ([§6](#6-kinds), [OBI-D-02](#102-document-rules)), in no meaningful order. The list is an **any-of constraint**: a binding considered for the dependency meets it if and only if its referenced source's `kind` exactly equals at least one listed kind. Without `kinds`, the dependency declares no kind constraint. Whether a processor supports a kind does not change the comparison, and neither the presence nor the absence of `kinds` says anything about support: a processor may be unable to act on a binding that meets the constraint ([OBI-T-01](#103-tool-rules)).

The kind test is only one constraint. A tool's composition decides which bindings are candidates, including whether this document's own bindings for the operation are ([§1.2](#12-out-of-scope)), and correspondence may be author-asserted through operation names ([§5.1](#51-operations)). The dependency itself carries no concrete target (invariant 2).

Multiple dependencies MAY reference the same operation, including with different `kinds` constraints, and an operation MAY have both bindings and dependencies, each dependency a separate consumption point.

A dependency declaration says nothing about when the consuming behavior runs or what happens when no realization is supplied; startup requirements, feature availability, conditional use, readiness, and failure behavior are application and deployment policy. An unsatisfied dependency does not make the OBI non-conformant and does not by itself show that the described component is unavailable or unhealthy.

---

## 6. Kinds

Every source has a `kind`: an exact, opaque, non-empty string naming how the source and its bindings are read. A dependency may list the kinds it accepts in `kinds` ([§5.5](#55-dependencies)).

**Comparison.** Kinds are compared as whole strings, by exact equality ([OBI-T-01](#103-tool-rules)), so two different strings are two unrelated kinds. A kind has no internal structure: dots, `@`, and version-like suffixes are simply part of the string, and a URI-shaped kind is a name, never implicitly dereferenced.

**Interpretation.** Supporting a kind means knowing how to read the `content` of its sources and their bindings for whatever work a tool does with them, such as identifying a target, carrying out the interaction, or adapting values at the operation boundary. That knowledge may be built into a tool, supplied by a plugin, or configured locally, and it may be written down or exist only in code. A document conforms whether or not any tool supports its kinds, and a tool may preserve, index, or display a source whose kind it does not support.

**What a kind decides.** The matters the core leaves to a source's kind:

- what a source's `content` and its bindings' `content` may contain, and what they mean ([§5.3](#53-bindings), [§5.4](#54-sources));
- how a binding's target is identified ([§5.4](#54-sources));
- how caller-facing values correspond to interaction data: value adaptation, which data forms one value, and which results of an interaction are returned as output values ([§5](#5-document-model), [§5.1](#51-operations));
- interaction mechanics: pattern, cardinality, framing, completion, and lifecycle (invariant 1);
- how a binary artifact is encoded in `content` ([§5.4](#54-sources));
- what context, such as credentials, reaching or authorizing a target requires, where a tool's policy does not supply it ([§5](#5-document-model)).

A kind in turn stands on these core provisions, whose changes [§8.1](#81-openbindings-field-specification-version) records as breaking:

- `content` is any JSON value, and its presence is distinct from its value ([§5](#5-document-model));
- `content` is exempt from the reference rules of [§7](#7-reference-resolution);
- caller-facing values are JSON values, and an operation's schemas apply to each value (invariant 1);
- a binding vouches for its operation's `input`, `output`, and `idempotent` ([§5.3](#53-bindings)).

**Sharing a kind.** A kind is portable as far as its meaning is shared. Authors who want independent tools to agree on a kind describe it in writing and give an incompatible meaning a new kind, since a document offers tools no way to tell two meanings of one kind apart. A kind meant to circulate widely can be qualified under a name its publisher controls. These are interoperability practices, not conformance requirements. This project publishes definitions of some kinds ([§14](#14-see-also)); they have no special standing here. Matching a kind establishes neither provenance nor authorization ([§9](#9-security-considerations)).

A locally built CLI consuming a private artifact might use:

```json
{
  "kind": "my-cli.usage@1",
  "content": { "location": "file:///home/user/project/usage.kdl" }
}
```

---

## 7. Reference resolution

OBI documents define no `id` field. A document's base URI is its own ([§7.2](#72-the-document-as-embedding)), so its OBI-defined references resolve identically however it was obtained (invariant 4).

**OBI positions.** An **OBI position** is a place where the document model puts a schema: an operation's `input` or `output`, an entry in the `schemas` map, and every subschema reached from one of these through the keywords the JSON Schema 2020-12 meta-schema validates as schemas. The walk does not enter a schema that declares its own `$id`, which is to say has an `$id` member. Those keywords are `$defs`, `properties`, `patternProperties`, `dependentSchemas`, `additionalProperties`, `propertyNames`, `items`, `prefixItems`, `contains`, `allOf`, `anyOf`, `oneOf`, `not`, `if`, `then`, `else`, `unevaluatedItems`, `unevaluatedProperties`, and `contentSchema`, with the legacy `definitions` and the schema values of the legacy `dependencies` (JSON Schema Validation, Appendix A). A schema the walk reaches that declares `$id` is itself at an OBI position, but everything in the resource it declares, that schema's own keywords other than `$id` included, belongs to that resource ([§7.2](#72-the-document-as-embedding)). The **schemas the document contains** are the schemas at OBI positions and every subschema reached from those that declare `$id` through the same keywords, entering nested schemas that declare `$id` as well; nothing else in the document is a schema it contains.

### 7.1. Reference forms

The **OBI-defined document references** are the `$ref` and `$dynamicRef` keywords in the [document resource](#3-terminology), that is, of the schemas at OBI positions that declare no `$id`. Each MUST be an [absolute URI](#3-terminology) or a same-document reference (empty, or a fragment alone; RFC 3986 §4.4), each schema `$id` at an OBI position MUST be an absolute URI, and all of them MUST be well-formed URI-references (RFC 3986 §4.1) ([OBI-D-05](#102-document-rules)).

### 7.2. The document as embedding

JSON Schema lets the format that embeds a schema determine its initial base URI (JSON Schema Core §9.1.1) and leaves open how such schemas fit its resource model (JSON Schema Core §4.3.5). OBI settles both:

- The document is its schemas' embedding document, with a base URI unique to it and drawn from nowhere else (RFC 3986 §5.1.4). In the document resource, a same-document reference such as `#/schemas/Task` addresses a location in the document, its JSON Pointer fragment percent-decoded and read per [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) §6 from the document root, so `#` names the OBI document itself, not the schema that contains it.
- The schemas at OBI positions that declare no `$id` are subschemas of one schema resource, the **document resource**. The plain names they declare with `$anchor` or `$dynamicAnchor` belong to it, and an evaluation that begins at one of them begins in it, which makes that resource the outermost in the evaluation's dynamic scope.
- A schema that declares `$id` begins a resource of its own. The references, anchors, and nested `$id`s within it, including its own keywords other than `$id`, take any form JSON Schema allows and resolve against its base.

### 7.3. Same-document references

A same-document reference in the document resource MUST identify a schema at an OBI position ([OBI-D-12](#102-document-rules)). The check is a lookup in the document, not an evaluation, made on the reference's fragment after percent-decoding; a fragment that does not decode to valid UTF-8 identifies nothing. There are three cases:

- An empty reference, or one whose fragment is empty (`#`), never qualifies: it names the OBI document itself.
- A fragment beginning with `/` is a JSON Pointer, which qualifies only when it is a valid RFC 6901 pointer to a schema at an OBI position. A pointer that reaches no location does not qualify, and neither does one that reaches a location holding no schema (an operation object, a map, a string, `x-` data, a source's or binding's `content`, or an example value) or a location inside a schema that declares `$id`, whose contents are reached through that `$id`.
- Any other fragment is a plain name, which qualifies only when a schema in the document resource declares it with `$anchor` or `$dynamicAnchor`. A plain name declared only inside a schema that declares `$id` belongs to that schema's resource and does not qualify.

### 7.4. Other references

Beyond these lookups, references resolve as JSON Schema 2020-12 defines: plain-name fragments, dynamic references, references within a schema resource that declares `$id`, and references to external schemas. In the document resource, no plain name is declared by more than one schema, and no `$id` is declared by two schemas the document contains ([OBI-D-13](#102-document-rules)). That comparison takes each `$id` after resolution (RFC 3986 §5.2) and removal of any empty fragment, character for character and without further normalization, and leaves out an `$id` that is not itself well-formed, or is relative with no compared enclosing `$id` to resolve against, so spellings a URI library might normalize to one identifier are distinct under OBI-D-13; whether they collide in use is JSON Schema's. Where JSON Schema leaves a result undefined, the reference's meaning in an OBI is undefined too, though the document conforms: within a schema resource that declares `$id`, a pointer that reaches no schema or a plain name declared twice (JSON Schema Core §9.4.2, §8.2.2).

A tool MAY decline to obtain external resources; a document whose schema references all resolve within it needs no network access to resolve them. Declining an external resource needed to evaluate a particular value prevents a validation verdict for that value ([OBI-T-08](#103-tool-rules)); it does not make the document non-conformant. Schema reference cycles are permitted: recursive types (trees, linked lists, ASTs) are legitimate and widespread, and a cycle by itself does not make a reference invalid ([OBI-T-06](#103-tool-rules)). A cycle that recurses without consuming any of the instance, such as a schema whose only keyword is a `$ref` to itself, has undefined behavior under JSON Schema (JSON Schema Core §9.4.1).

### 7.5. Notes for authors and tools (informative)

Which schemas each document rule walks:

| Rule | What it walks | At a schema that declares `$id` |
| ---- | ------------- | -------------------------------- |
| OBI-D-05 | `$ref` and `$dynamicRef` in the document resource; `$id` at OBI positions | Checks that schema's `$id`; its other keywords and contents belong to its resource |
| OBI-D-06 | `$schema` in every schema the document contains | Continues inside the resource |
| OBI-D-10 | Each operation `input`/`output` and `schemas` entry, with its subschemas, against the meta-schemas | Continues inside the resource |
| OBI-D-12 | Same-document references in the document resource | Skips that schema's own references; a pointer may land on it, not inside it, and a plain name declared inside it does not count |
| OBI-D-13 | Plain names in the document resource; `$id` in every schema the document contains | Plain names inside it belong to its resource |

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
    "getTree": {
      "input": { "type": "object", "maxProperties": 0 },
      "output": { "$ref": "https://example.com/schemas/tree.json" }
    }
  }
}
```

Inside `Tree`, `#` resolves against its `$id` and names `Tree` itself; the operation reaches `Tree` through that `$id`. The move works in one direction for addressing: a schema with its own `$id` cannot address the document's schemas that lack one by URI, since the document's base URI is drawn from nowhere a reference can name ([§7.2](#72-the-document-as-embedding)), so a shared schema it references must carry an `$id` of its own. Dynamic resolution can still cross back: a `$dynamicRef` inside it whose initial target carries a matching `$dynamicAnchor` can resolve, through the dynamic scope, to a `$dynamicAnchor` of the document resource when evaluation begins there (JSON Schema Core §8.2.3.2).

A JSON Schema library reads `schemas`, `operations`, and the document's other members as unknown keywords, so it neither finds the `$id`s and anchors at OBI positions nor reliably resolves pointers into them (JSON Schema Core §9.4.2). A tool therefore locates those identifiers itself, as [OpenAPI](#132-informative-references) requires of its tools, and presents them to its library: for example, by giving the document a base URI used nowhere else, such as a fresh `urn:uuid:` URI, resolving same-document references against the document root under that base, and registering each schema resource an `$id` declares under its resolved `$id`. Evaluating an operation's schema in isolation leaves its references to the document's other schemas unresolved and, where the schema declares no `$id`, reads its same-document references from the wrong root.

---

## 8. Versioning

OBI documents carry two independent version concepts: the specification version the document is written against, and an author-controlled label for the interface itself.

### 8.1. `openbindings` field (specification version)

The `openbindings` field identifies the version of this specification the document declares. The value MUST be a [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) string ([OBI-D-09](#102-document-rules)).

**Lines.** A document is interpreted under the `major.minor` line its version names. Each line is one document model: a patch release corrects errors in this text without adding fields or changing what documents mean, although a correction can change a document's conformance (invariant 5), and its corrections apply to the whole line. The patch number a document declares therefore carries no meaning, and documents declaring `0.2.0` and `0.2.1` are read alike, under the text of the patch release a processor applies, which its conformance conclusions name ([OBI-T-09](#103-tool-rules)).

**Processing.** A processor supports lines, not individual patches, and interprets a document under OpenBindings semantics only when it supports the document's line ([OBI-T-04](#103-tool-rules)). Asked to interpret a document of any other version, it produces a **version refusal** rather than interpreting the document under another line's rules. Supporting one line implies nothing about another. From 1.0.0 onward a new minor is backward-compatible with documents written to the previous minor, while pre-1.0 minors MAY break (see the release policy below); in either regime, backward compatibility is not forward comprehension.

- A prerelease (`0.2.0-rc.1`) is not part of its line: it is a distinct, potentially incompatible draft identified by its full version, supported only when a processor explicitly includes it. A processor that does interprets the document under that draft's text and derived schema, and its conclusions name the draft.
- Build metadata is permitted, has no OpenBindings semantics, and is ignored when determining support: `0.2.0+build.1` denotes the same line as `0.2.0`.
- Interpreting a document means giving any of its members other than `openbindings` the meaning a line assigns, as resolving names, comparing kinds, following references, validating values, and judging conformance do. Version refusal prohibits only that: a processor MAY still parse, preserve, display, or route an unsupported document. Refusal is distinct from document non-conformance, since the document may conform to the version it declares.
- A text declares a version only when it is a JSON text (RFC 8259) in UTF-8 without a byte-order mark whose root object has exactly one `openbindings` member, a string that is a SemVer version. The line decision uses that version even when the text violates OBI-D-01 elsewhere, which only a supported line's rules judge; a validator whose parser cannot tell whether the member is repeated has not decided the line. Any other text declares no version, so there is nothing to refuse: it violates OBI-D-01 or OBI-D-09, and a validator reports that non-conformance under the rules of a line it supports, naming that line.
- Unknown fields have no core meaning under a supported line ([OBI-T-02](#103-tool-rules)); that rule does not authorize interpreting an unsupported line by ignoring its additions.

**Release policy (project).** While pre-1.0, minor versions MAY include breaking changes, per pre-1.0 SemVer convention; patch releases only correct this text (see Lines above). Changes to the provisions [§6](#6-kinds) lists as those a kind stands on are recorded in the changelog as breaking changes to this specification. This is a commitment about this specification's own provisions, not a compatibility judgment about external behavior. Declaring the earliest line sufficient for a document's content maximizes the processors able to interpret it.

### 8.2. `version` field (interface-version label)

The optional `version` field is the author's label for the described interface: a non-empty string that tools may preserve, display, index, or group by its exact value. Authors MAY follow SemVer, dates, or any other convention. The label is opaque to this specification, which attaches no ordering, comparison, Semantic Versioning, compatibility, identity, resolution, selection, or refusal semantics to it; any stronger interpretation comes from an external catalog, registry, or organizational policy.

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

This specification's prose defines the document model, and `openbindings.schema.json` expresses its structural part in JSON Schema. Structural conformance is decided by that schema through OBI-D-02, which is how the structural requirements of [§5](#5-document-model) take effect: the rule applies the schema published with the release a conclusion names ([OBI-T-09](#103-tool-rules)), with its `pattern` values read as ECMA-262 regular expressions. Where schema and prose disagree, the schema decides OBI-D-02 until a patch release corrects the erratum in it; the schema's `$id` names the line, and its title names the patch release. The schema also expresses OBI-D-03, OBI-D-09, the name syntax of the references OBI-D-07, OBI-D-08, and OBI-D-11 check, part of OBI-D-04 (an alias repeated within one operation's `aliases`), and OBI-D-06 for the `$schema` at the top of each operation `input` and `output` and each `schemas` entry. A document that violates those parts violates OBI-D-02 as well. The other document rules walk the document beyond what the schema expresses.

Conformance is judged by the numbered rules alone: a document conforms when it meets the rules of [§10.2](#102-document-rules), and a tool when it meets the rules of [§10.3](#103-tool-rules) that apply to it. The rest of this specification defines the model those rules apply to and explains it.

**The document and its data.** Conformance is a property of a JSON text; a claim about an in-memory value is a claim about its serialization. Document rules read the text as RFC 8259 defines it: member names are compared as the sequences of code units they denote after unescaping (RFC 8259 §8.3), and numbers by their exact decimal value. A validator whose parser cannot represent a name or number exactly has not decided a clause that depends on it.

Each rule carries an identifier (`OBI-D-##` document rules, `OBI-T-##` tool rules) so validators, test suites, and errata can cite it. An identifier means what the version line of this specification that states it says it means: a rule is cited under a line, as a document is interpreted under the line its version names ([§8.1](#81-openbindings-field-specification-version)), and another line may number its rules differently. A patch release adds and renumbers no rule.

### 10.1. Tool obligations

A tool's obligations follow the capabilities it exercises, not a fixed class. Every processor reads documents, whether to parse, validate, index, or render them, and the rules marked (all processors), OBI-T-03 and OBI-T-04, bind every processor, including one that does no more than read. A processor MAY also report document conformance, resolve references, validate values against operation contracts, or resolve operation names, and each of those brings the rules scoped to it. It MAY also act on sources; how it does so is outside this specification, and invoking a binding, by itself, triggers no additional core rule (invariant 2). A processor interprets a document under this line's semantics only when OBI-T-04 permits it. There is no central registry of tool capabilities. A conformance test corpus is published as reference material, not part of this specification; a rule without fixtures is no less binding.

The table below (informative) maps each capability to the tool rules it brings; the document rules are listed where a validator decides them. It is not a required class hierarchy, and a tool performs the rows marked (all processors) and the rows for capabilities it claims, in any order consistent with OBI-T-04, which decides, before any interpretation, whether this line applies.

| Capability | Rules and sections |
| ---------- | ------------------ |
| Decide whether this specification applies (all processors) | OBI-T-04, [§8.1](#81-openbindings-field-specification-version) |
| Treat `x-` fields as extensions (all processors) | OBI-T-03, [§12](#12-extensions) |
| Interpret OBI-defined fields | OBI-T-02, [§12](#12-extensions) |
| Validate and report document conformance | OBI-D-01 through OBI-D-13, OBI-T-09, OBI-T-10, [§10.4](#104-conformance-conclusions) |
| Resolve an operation identifier | OBI-T-07, [§5.1](#51-operations) |
| Compare kinds | OBI-T-01, [§5.5](#55-dependencies), [§6](#6-kinds) |
| Resolve schema references | OBI-T-06, [§7](#7-reference-resolution) |
| Validate operation-boundary values | OBI-T-08, [§5.2](#52-schemas) |
| Derive a contract from a schema | OBI-T-05, [§5.2](#52-schemas) |
| Check examples | OBI-T-11, [§5.1](#51-operations) |
| Resolve or act on a binding target | The source's kind ([§6](#6-kinds)) |


### 10.2. Document rules

Document rules bind the document, and none evaluates a value against the document's schemas. A validator that lacks a capability a clause needs has not decided that clause ([§10.4](#104-conformance-conclusions)).

A conformant **OBI document**:

- **OBI-D-01**: Is valid UTF-8 encoded JSON per [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259). Duplicate JSON object keys within any object make the document non-conformant. A leading byte-order mark makes the document non-conformant: RFC 8259 §8.1 forbids adding one, interoperable-JSON practice ([RFC 7493](https://www.rfc-editor.org/rfc/rfc7493)) excludes it, and tolerating it would let two parsers disagree over the same bytes. Validation note (informative): most JSON parsers silently keep one duplicate value, so checking the duplicate clause requires a duplicate-detecting parse; a validator whose parser cannot surface duplicates cannot establish whether the clause holds.
- **OBI-D-02**: Validates against the derived JSON Schema published with the release of this specification whose text the document is judged under, for a line or for a prerelease (`openbindings.schema.json`, `$id` `https://openbindings.com/schema/openbindings-0.2.json`); a patch release that corrects the schema republishes it under the same `$id`.
- **OBI-D-03**: Has every map key this specification defines (operation, dependency, binding, source, schema, and example keys) and every operation alias matching `^[A-Za-z0-9_][A-Za-z0-9_.-]*$`. Property names inside JSON Schema objects are schema content, not map keys, and are unconstrained by this rule.
- **OBI-D-04**: Has no string occurring more than once among all operations' keys and `aliases` entries taken together.
- **OBI-D-05**: Has every schema `$ref` and `$dynamicRef` in the document resource ([§3](#3-terminology)) an absolute URI or a same-document reference, and every schema `$id` at an OBI position an absolute URI, all of them well-formed URI-references per [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) §4.1 ([§7.1](#71-reference-forms)).
- **OBI-D-06**: Has every `$schema` in a schema the document contains ([§3](#3-terminology)) equal to `https://json-schema.org/draft/2020-12/schema` or `https://json-schema.org/draft/2020-12/schema#`.
- **OBI-D-07**: Has every `bindings[*].operation` value present as a key in the document's `operations` map.
- **OBI-D-08**: Has every `bindings[*].source` value present as a key in the document's `sources` map.
- **OBI-D-09**: Has an `openbindings` field whose value is a valid [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) string.
- **OBI-D-10**: Has every operation `input` and `output` and every entry in `schemas` valid against the JSON Schema 2020-12 meta-schemas, which validate its subschemas in turn, with `format` as an annotation, JSON Schema's default (JSON Schema Validation §7.2.1) ([§5.2](#52-schemas)). The pinned meta-schemas make the rule decidable offline; it resolves none of the document's references and evaluates no value against the document's schemas.
- **OBI-D-11**: Has every `dependencies[*].operation` value present as a key in the document's `operations` map.
- **OBI-D-12**: Has every same-document schema `$ref` and `$dynamicRef` in the document resource identifying a schema at an OBI position, its fragment read after percent-decoding (a fragment that does not decode to valid UTF-8 identifies nothing): an empty reference or an empty fragment never qualifies; a fragment beginning with `/` qualifies only as a valid JSON Pointer to a schema at an OBI position; any other fragment qualifies only as a plain name declared with `$anchor` or `$dynamicAnchor` by a schema in the document resource ([§3](#3-terminology), [§7.3](#73-same-document-references)). Absolute URIs and references within a schema resource that declares `$id` are outside this rule. The check is a lookup in the document; it resolves no other reference and evaluates no value.
- **OBI-D-13**: Has no plain name declared, by `$anchor` or `$dynamicAnchor` in any combination, by more than one of the schemas at OBI positions that declare no `$id`, and no `$id` declared by two schemas the document contains, each `$id` resolved to an absolute URI with any empty fragment removed and compared character for character. An `$id` is compared only when it is a well-formed URI-reference that is either an absolute URI or resolves against the `$id` of the nearest enclosing schema that declares one, itself compared; every other `$id` is left out of the comparison ([§7.4](#74-other-references)).

### 10.3. Tool rules

A conformant **tool** meets each of the following that applies to it. What each item requires, it requires at the level of MUST even without a BCP 14 keyword, while its permissions and explanations stay permissions and explanations; a BCP 14 keyword inside an item keeps its own force:

- **OBI-T-01** (applies when comparing kinds under core rules): Compares complete kind strings by exact equality. For that comparison it MUST NOT normalize, case-fold, or decompose kinds, or infer compatibility or version order from their spelling. A kind is not implicitly dereferenced merely because it resembles a URI. Whether a processor supports the kind or acts on a source is its own capability and policy; lack of support does not change document conformance or a dependency's exact-match `kinds` constraint ([§5.5](#55-dependencies)).
- **OBI-T-02** (applies when interpreting OBI-defined fields): Gives an unknown field no core meaning. "Fields" are the properties of OBI-defined objects (the document root; operation, dependency, source, binding, and example objects); property names inside JSON Schema objects are schema content, out of scope for this rule, mirroring OBI-D-03. An unknown field whose name does not begin with `x-` makes the document non-conformant under OBI-D-02 ([§12](#12-extensions)); this rule does not require a processor to continue work on a non-conformant document or prescribe its diagnostics.
- **OBI-T-03** (all processors): Treats `x-` prefixed fields as extensions. An `x-` field, whether or not the tool understands it, does not change the meaning of core fields; a tool may act on an `x-` field it understands in ways that leave that meaning intact.
- **OBI-T-04** (all processors): Interprets a document under this specification's semantics only when the `major.minor` line of its declared `openbindings` version is one the processor supports, and, asked to interpret a document whose declared version it does not support (an unsupported line, or a prerelease it does not explicitly include), produces a version refusal instead, reported distinctly from document non-conformance. The patch number does not enter this decision; a prerelease is supported only when explicitly included. A document that declares no valid version is not refused: it is non-conformant under OBI-D-01 or OBI-D-09. [§8.1](#81-openbindings-field-specification-version) governs prerelease and build-metadata handling and what a refusal prohibits and permits.
- **OBI-T-05** (applies when claiming to derive a contract from a schema, e.g., through comparison or code generation): Does not claim that the derived contract preserves the schema's meaning when semantically significant keywords or values it cannot represent could change that meaning. Whether and how to report a narrower result or an unsupported feature is a tooling concern.
- **OBI-T-06** (applies when resolving `$ref` or `$dynamicRef` values): Does not treat a reference cycle alone as an invalid reference or a schema mismatch. Implementation strategy and resource limits are tool concerns.
- **OBI-T-07** (applies when resolving operation names): Resolves a name against the flat namespace of operation identifiers (each operation's key together with its `aliases`), treating key and alias matches as equally authoritative. OBI-D-04 makes the namespace document-unique, so a name resolves to at most one operation; a tool MUST NOT privilege key matches over alias matches, and MUST NOT resolve a name to an operation unless the name exactly equals one of that operation's identifiers (no trimming, case-folding, or approximate matching). The bindings for a resolved operation are found by the operation's key (the value in `bindings[*].operation`), not by the alias used to reach it.
- **OBI-T-08** (applies when claiming to validate a value against an operation's `input` or `output` schema): Evaluates the value under the schema's applicable JSON Schema dialect, with the OBI document as the resolution context for embedded schemas: its own resource and every resource an `$id` declares in the schemas it contains ([§5.2](#52-schemas), [§7](#7-reference-resolution)). The operation schema applies separately to each value crossing that boundary. A required reference or capability that is unavailable cannot establish either validation success or instance mismatch. This rule does not require a whole-graph readiness check or prescribe evaluation strategy, resource acquisition, or report shape; invoking, rendering, or indexing alone does not trigger validation.
- **OBI-T-09** (applies when reporting a conclusion about overall document conformance): Claims conformance only when every applicable document rule has been established with no violation. A known violation establishes non-conformance; absence of a found violation alone does not establish conformance. The conclusion names the release of this specification whose text it applied (a patch release, or an explicitly supported prerelease), since a patch release can correct the text a conclusion rests on ([§8.1](#81-openbindings-field-specification-version)). A tool may report a narrower scope or an inability to reach an overall conclusion in its own form ([§10.4](#104-conformance-conclusions)).
- **OBI-T-10** (applies when reporting document conformance): Does not treat the apparent inaccuracy of an author claim as a document-rule violation: an operation's `idempotent` or `examples` ([§5.1](#51-operations)), a binding's claim to realize its operation ([§5.3](#53-bindings)), a dependency's claim to consume its operation within the contract ([§5.5](#55-dependencies)), or a correspondence claim ([§5.1](#51-operations)). Tools may independently decide whether to rely on such a claim or act on the document.
- **OBI-T-11** (applies when checking examples): Does not resolve an example–schema mismatch by treating the example as an exception ([§5.1](#51-operations)): the schema is authoritative, and an example never widens, narrows, or overrides it. A mismatch it finds is a false example claim, not a document-rule violation.

These rules fix the meaning of core fields and what the claims made under them assert. Whether to act on a valid document or continue with a non-conformant one, and how to diagnose and how to serialize reports, are the tool's, with the other tool concerns of [§1.2](#12-out-of-scope).

### 10.4. Conformance conclusions

A document is objectively conformant or non-conformant under this specification (invariant 5). A validator may also lack enough evidence to decide. The following terms describe the possible conclusions ([OBI-T-09](#103-tool-rules)):

| Conclusion                   | Exact meaning                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| **Conformant**               | Every applicable document rule was decided and no violation established.           |
| **Non-conformant**           | At least one violation of an applicable document rule was established, whatever remains undecided. |
| **Conformance undetermined** | No violation established, but one or more applicable rules have not been decided.  |

The applicable rules are the document rules of [§10.2](#102-document-rules) for the line or prerelease the document is interpreted under, as stated in the release the conclusion names ([OBI-T-09](#103-tool-rules)). A rule with nothing to govern in a particular document holds vacuously.

A tool may describe rule-level evidence as satisfied, violated, undecided, or not applicable (holding vacuously), and may name the governing rule identifiers. An unavailable resource, missing capability, or exceeded resource limit is not by itself evidence of a document-rule violation. Scoped claims such as "valid against the derived structural schema" are possible when their scope is clear. A tool defines its own API, report vocabulary, serialization, and any ladder of validation levels.

---

## 11. IANA considerations

This specification defines the registration details for the OpenBindings JSON media type. The IANA registries are authoritative for current registration status.

Per [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838), under the vendor tree:

- **Type name:** application
- **Subtype name:** vnd.openbindings+json
- **Required parameters:** none
- **Optional parameters:** none
- **Encoding considerations:** binary, as for `application/json` ([RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)); OBI documents are UTF-8 encoded JSON ([OBI-D-01](#102-document-rules))
- **Security considerations:** see [§9. Security considerations](#9-security-considerations)
- **Interoperability considerations:** see [§10. Conformance](#10-conformance)
- **Published specification:** this specification
- **Applications that use this media type:** tools that produce or consume OpenBindings documents
- **Fragment identifier considerations:** JSON Pointer per [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901), or a plain name declared by `$anchor` or `$dynamicAnchor` in the document resource ([§7.2](#72-the-document-as-embedding); JSON Schema Core §8.2.2)
- **Additional information:** deprecated alias names, magic numbers, file extensions, and Macintosh file type codes: none
- **Person and email address to contact for further information:** the OpenBindings maintainers, hello@openbindings.com; see also [github.com/openbindings](https://github.com/openbindings)
- **Intended usage:** COMMON
- **Restrictions on usage:** none
- **Author:** the OpenBindings maintainers
- **Change controller:** openbindings project

---

## 12. Extensions

OBI documents MAY include extension fields, whose names begin with `x-`, in any OBI-defined object: the document root and the operation, dependency, source, binding, and example objects, the positions [OBI-T-02](#103-tool-rules) enumerates. Those objects carry only the fields this specification defines and `x-` fields ([OBI-D-02](#102-document-rules)). Unprefixed names are reserved for this specification, so it can add fields without colliding with a document's own data; an unknown one has no core meaning ([OBI-T-02](#103-tool-rules)). An `x-` field never changes the meaning of core fields, whether or not a processor understands it ([OBI-T-03](#103-tool-rules)); whether a processor preserves one it does not understand, or declines work that depends on it, is a tool concern.

Keys inside the document's maps (`operations`, `dependencies`, `sources`, `bindings`, `schemas`, and an operation's `examples`) are entry names, not fields: an `x-`-prefixed key there names an ordinary entry, subject to OBI-D-03 like any other key, and in `operations` it enters the identifier namespace (OBI-D-04).

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
- **[OpenAPI]** OpenAPI Initiative, "OpenAPI Specification v3.2.0," September 2025. <https://spec.openapis.org/oas/v3.2.0.html>. Cited by [§7.5](#75-notes-for-authors-and-tools-informative).
- **openbindings project tools**: `ob` CLI, `openbindings-go`, `openbindings-ts` (see project README). One implementation of this specification among potentially many.

---

## 14. See also

- `openbindings.schema.json`: derived JSON Schema for structural document validity.
- The openbindings project's shared-contract interfaces, published at [openbindings.com/interfaces](https://openbindings.com/interfaces) (informational).
- `binding-specs/`: definitions of kinds this project publishes, with authoring guidance ([§6](#6-kinds)).
- The project's optional operation-invoker interface, published with the shared-contract interfaces above: one reusable invocation contract, and one place a tool's binding-selection policy can live.
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
