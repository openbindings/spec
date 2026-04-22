# OpenBindings Reference Tool Behaviors

**This document is NOT part of the normative OpenBindings specification.** It describes the behaviors and conventions of the openbindings project's reference tools (the `ob` CLI, the `openbindings-go` and `openbindings-ts` SDKs, and any future official tooling) and is the target third-party tools align with when they want to interoperate with them. The normative specification for what an OBI document IS lives in `openbindings.md`; that document neither references this one nor depends on it.

This document describes what the reference tools DO with OBI documents: how they compare operation schemas, how they derive verdicts, how they execute transforms, how they resolve security methods, and how they handle related behavioral concerns.

Third-party tools are free to adopt these conventions, extend them, or diverge entirely. A tool claiming "reference-aligned" behavior should follow the procedures in this document. A tool that diverges on any of these procedures is still spec-conformant as long as it conforms to `openbindings.md`.

This document is versioned independently of the OBI spec. Its content has historically lived in the spec and has been moved here to cleanly separate "what an OBI is" (spec) from "what reference tooling does with one" (this document).

Content below carries its original prose for now and will be reorganized in subsequent passes. Sections that used to be normative in the spec are marked as reference-normative where the reference tools commit to the behavior; third-party tools are not obligated to follow them.

- Licensed under Apache 2.0 (see `LICENSE`).
- BCP 14 keywords, where they appear in all capitals, bind reference-conformant tools only; they do not impose obligations on tools that claim only OBI spec conformance.

---

# Original content (to be reorganized)

What follows is the previous content of the working-draft OBI spec, preserved here verbatim so nothing is lost during the transition. Each section will be reframed (or in some cases, restored to `openbindings.md` if it turns out to be load-bearing for document meaning rather than tool behavior). For now, treat the entire document below as describing the reference tools' behavior.

## Table of contents

- [Overview](#overview)
- [Terminology](#terminology)
- [Core Ideas](#core-ideas-non-normative)
- [Discovery](#discovery)
- [Interfaces & Comparison](#interfaces--comparison)
- [Bindings](#bindings)
- [Security](#security)
- [Transforms](#transforms)
- [Schema Resolution & Normalization](#schema-resolution--normalization)
- [Conformance](#conformance)
- [Security Considerations](#security-considerations)
- [Versioning](#versioning)
- [End-to-End Example](#end-to-end-example-non-normative)

---

## Overview

OpenBindings is an open-source, **binding-specification-agnostic** interface and discovery format for describing what a service can do in a way that is:

- portable across environments and implementations
- reusable across services (interface compatibility)
- bindable to multiple protocols and transports without redefining the contract

OpenBindings centers around **operations** and treats exposures as **bindings**.

The design goal is to separate **meaning** (an interface’s operations + schemas + semantics) from **access** (the bindings/protocols that expose those operations). This keeps interfaces portable across ecosystems while letting binding specifications remain spec-native and evolve independently.

## Terminology

The following terms have specific meanings throughout the specification and the broader OpenBindings ecosystem:

- **Binding executor**: an implementation of `openbindings.binding-executor` -- the component that reads a binding source format (OpenAPI, AsyncAPI, etc.) and knows how to execute bindings against it. See `interfaces/openbindings.binding-executor/0.1.json`.
- **Interface creator**: an implementation of `openbindings.interface-creator` -- the component that can produce an OBI from a binding artifact. See `interfaces/openbindings.interface-creator/0.1.json`.
- **Implementation**: the generic term for any software that satisfies a given interface.
- **OBI**: shorthand for "OpenBindings interface."

### Definitions

- **Interface**: an operational shape defined by `operations` (and schemas/semantics). Interfaces are reusable regardless of author intent.
- **Unbound interface**: an interface without bindings. Unbound interfaces define the contract (operations + schemas) but do not specify how to access the operations. They are analogous to abstract types in programming languages -- they define shape and semantics without concrete implementation details. Unbound interfaces are useful as reusable contracts, templates for composition, and targets for schema comparison.
- **Bound interface**: an interface with bindings. Bound interfaces are actionable -- tools can construct concrete interaction targets for the operations. A discovered interface (from `/.well-known/openbindings`) is typically bound.
- **Schema comparison**: the structured comparison of a candidate interface's schemas against a target interface's schemas, producing per-field facts (`covered`, `silent-by-D`, `silent-by-I`, `contradicts`, `undecidable`) and optionally a verdict under a named scheme such as `openbindings.alignment@1.0`. Comparison depends on operation matching and schema structure, not on bindings, and does not guarantee runtime interoperability. See [Schema Comparison](#schema-comparison).
- **Actionability**: whether a tool can construct concrete interaction targets for an interface in a given context. Actionability depends on bindings being present and **resolvable** (and on the tool supporting the referenced `format`s). See [Binding coverage (actionability)](#binding-coverage-actionability).

## Schema

The normative JSON Schema for the OpenBindings document shape is published alongside this spec:

- Working schema: `openbindings.schema.json`
- Versioned snapshots: `versions/<version>/openbindings.schema.json`

The schema is **descriptive**; the markdown spec remains the source of truth for semantics.

## One interface shape; optional bindings

OpenBindings uses one document shape: an **interface**.

- An interface is always meaningful as a portable contract through its `operations` (and schemas/semantics).
- An interface becomes **actionable** when it includes **bindings** that can be resolved in context.

Serialization:

- The OpenBindings data model is defined over JSON. JSON is the normative representation.
- Tools MAY support YAML as an alternate serialization. If so, the YAML document MUST be interpreted as the same JSON data model and all OpenBindings rules apply to that model. Tools supporting YAML MUST use YAML 1.2 (which aligns with JSON's type system) and MUST NOT use YAML 1.1 implicit type coercion (e.g., interpreting `no` as `false`).

Interfaces are expected to be distributed in a few common ways as the ecosystem develops, including:

- **Published interfaces**: shared as reusable contracts (e.g., in repos, registries, catalogs).
- **Discovered interfaces**: served by a deployment (often retrieved from `/.well-known/openbindings`) and expected to include bindings suitable for interacting with that deployment.

This distinction matters for tooling and UX, but it does not create different interface “kinds”: an interface is an interface.

### Project-published interfaces (non-normative)

The OpenBindings project publishes a set of **unbound interfaces** for interoperability and development velocity (e.g., the binding executor interface, the software descriptor contract).

- These interfaces are not required by the core spec.
- Each is a normal OpenBindings document, intended for composition or binding like any other interface.
- As unbound interfaces, they define the contract without specifying bindings. Implementations compose these and add their own bindings to make them actionable.

See `interfaces/` for the current set.

## Core Ideas (non-normative)

### Operations are the contract

An OpenBindings document defines a set of **operations**. An operation is a named unit of capability — something a service can do.

Each operation has:

- **names** (stable identity)
- **schemas** for `input` (what goes in) and `output` (what comes out)
- **idempotency** (optional hint for safe retries)
- documentation metadata (description, deprecated, etc.)

The **binding** determines the execution pattern (request/response, streaming, bidirectional, etc.). Operations are pure contracts — they do not prescribe how they are accessed.

Operations MAY also declare `aliases` and `satisfies` to support renames and deterministic operation matching when composing or implementing community-driven interfaces (see [Interfaces & Comparison](#interfaces--comparison)).

### Interfaces are composable capability contracts

OpenBindings intentionally models “interfaces” as **composable capability sets** (similar to traits/protocols):

- Composition is **additive**: combining interfaces forms a larger contract by **unioning required operations**. In published/discovered documents, this union is represented explicitly by listing the operations in `operations` (tools may assist in generating this).
- There is no “override” or “virtual dispatch” concept: operation names are identities; collisions are errors.
- Avoid thinking in “is-a” hierarchies (“OIDC is-a OAuth2”). Prefer “requires/uses” framing (“OIDC requires OAuth2 semantics”) expressed via **composition**.

### Bindings are exposures

Bindings answer: “How do you interact with this operation via a binding specification (protocol/transport/system)?”

OpenBindings is agnostic to binding specifications. Bindings are always expressed by referencing an external binding specification artifact via `sources` (and optionally a `ref` into that artifact).

### Schemas define compatibility (and may be made referenceable)

OpenBindings uses JSON Schema for data shapes. Interoperability requires **schema compatibility**: the schemas referenced by operations and by bindings must describe compatible shapes (according to the comparison rules in this spec).

- If you author schemas inline, that is valid and encouraged for simplicity.
- If you maintain additional specs (OpenAPI/AsyncAPI/proto/etc.) independently, you must keep schemas aligned either by:
  - referencing a shared schemas artifact, or
  - maintaining them manually (with CI/tooling checks), or
  - referencing the OpenBindings doc directly (if your tooling supports it).

If all artifacts are generated from the same source (e.g., OpenBindings SDK → OpenBindings doc + OpenAPI/AsyncAPI), drift should be zero by construction. Schema drift is most likely when additional specs are hand-authored or maintained independently.

For compatibility checking to be tool-independent, schema resolution must be deterministic. See [Schema Resolution & Normalization](#schema-resolution--normalization).

### Resolution vs reachability

Bindings are declarations of **implemented exposures** for operations.

- **Resolution (MUST)**: A binding MUST be sufficient for a tool to map it to an operation and construct a concrete interaction target using the document's context.
  - Example: bindings MUST resolve their binding source (via `location` or `content`) and then `ref` within that source.
- **Reachability (best-effort to verify)**: Whether a binding is reachable at a moment in time depends on runtime availability. Tools MAY probe bindings, but reachability failures are primarily an operational signal.

OpenBindings does not define availability guarantees for deployments or referenced artifacts. It only defines what tools can conclude from the documents and references available at evaluation time.

Normatively: a deployment that publishes `/.well-known/openbindings` MUST NOT publish bindings that it does not actually serve for the declared operations.

### Design principles

- **Operations define meaning**: schemas and semantics live in operations.
- **Bindings define protocol access**: how to call/subscribe/stream is binding-level.
- **One operation, many bindings**: multiple specs, multiple protocols, multiple routes, multiple delivery modes.
- **Interoperable escape hatches**: binding specs allow representing exposures in other ecosystems without forcing OpenBindings to become a mega-spec.

### Scope

Pagination patterns, error handling conventions, and authentication mechanisms are application-level concerns outside the scope of this specification. OpenBindings provides the tools to describe these (via operation schemas and bindings) but does not prescribe how they should be shaped.

## Discovery

Discovery is convention-driven. As a default, deployments SHOULD expose a discovered OpenBindings interface over HTTP(S) at:

```
/.well-known/openbindings
```

`/.well-known/openbindings` serves as the programmatic entry point for a service -- it declares what the service can do and how to interact with it, enabling tools to discover and bind to operations without prior configuration.

Other discovery mechanisms (registries, configuration, service meshes, package distribution, etc.) MAY be used. Standardization of non-HTTP discovery conventions is out of scope for v0.1.

OpenBindings does not define (or privilege) any “official” registry. Anyone may operate a registry or publish a collection of interfaces. Trust in a registry (or in any published interface set) is an external policy decision, not something the spec can determine.

### Response contract

When serving `/.well-known/openbindings` over HTTP(S):

- The method is `GET`.
- A successful response returns **200 OK** with `Content-Type: application/json` and a body containing a valid OpenBindings interface document.
- If the deployment does not publish an OpenBindings document at this path, the response is **404 Not Found**.

### Tooling note: synthesized OpenBindings views (non-normative)

Tools MAY synthesize an OpenBindings interface view from other artifacts (e.g., OpenAPI, AsyncAPI, protobuf descriptors) in order to evaluate compatibility, detect drift, or bootstrap adoption in ecosystems that already publish other binding specifications.

Such synthesized views:

- are a tool-side projection, not an authoritative statement by a service
- do not confer identity or trust (trust decisions remain tied to authenticated discovery context)
- may be partial (e.g., a single source format may not capture all operations)

### Interface identity (location-based)

An OpenBindings interface is identified by its **location**: the URL or path where the document can be retrieved. There is no separate `id` field — the location IS the identity.

- The **discovery address** is where you fetch the document (e.g., the origin that serves `/.well-known/openbindings`).
- The document's location (URL or file path) is its canonical identity for references, deduplication, and compatibility.
- The optional `name` field provides a human-friendly label but is not an identifier.

Recommended conventions:

- Published interfaces SHOULD be hosted at stable, versioned URLs (e.g., `https://interfaces.example.com/task-manager/v1.json`). Since interface URLs are not snapshots, versioned URLs ensure that consumers referencing the interface get a stable contract.
- Discovery addresses (the origin serving `/.well-known/openbindings`) are the identity of a discovered interface.
- Trust in an interface depends on the authenticated discovery context or the trust placed in the hosting location, not on the document's contents.


### Location equality

Two locations are equal iff they produce the same canonical form, compared byte-for-byte. The canonical form is produced by applying, in order:

1. Filesystem paths converted to `file://` URIs per RFC 8089.
2. Host labels converted to A-label form per RFC 3987 / UTS #46.
3. Syntax-based normalization per RFC 3986 §6.2.2.
4. Scheme-based normalization per RFC 3986 §6.2.3, specifically: remove the default port for the scheme, and replace an empty path with `/` when the URI has an authority.
5. Fragment component stripped. (Fragments remain significant in `$ref` resolution; see [`$ref` resolution](#ref-resolution).)

The following remain significant:

- Scheme (`http` and `https` are distinct).
- Trailing slash on non-empty paths (`/x` and `/x/` are distinct).
- Query component.
- Userinfo; authors SHOULD NOT include userinfo in role values or published interface URIs.
- Case of path and query (RFC 3986 treats these as case-sensitive).

Tools MAY follow HTTP redirects when fetching documents, but the URI used for equality is the URI declared in the document being compared (or supplied externally as the document's base), not the final URL after redirects.


### Registries and interface catalogs (non-normative)

Tools and ecosystems may use registries/catalogs to distribute and discover published interfaces. OpenBindings intentionally does not specify registry governance or trust: different environments may use different registries, and consumers choose which to trust.

Relationship to other fields:

- `roles` values reference other interfaces by URL or relative path (see [`roles`](#roles)).
- `satisfies[*].role` references a key in the document’s `roles` map.

### Published vs discovered interfaces

In practice, the same OpenBindings interface can be either **published** (as a reusable contract) or **discovered** (served by a deployment). Practically, tools often care about two checks:

- **Schema comparison**: the interface's operations and schemas align with a target interface's under the profile rules (see [Schema Comparison](#schema-comparison)).
- **Actionability**: the interface provides **binding coverage** for the operations you intend to invoke/subscribe to (see [Bindings](#bindings)).

### Actionability

A document retrieved from `/.well-known/openbindings` is a **discovered interface** and is intended to be actionable:

- it SHOULD provide binding coverage for the operations it claims (see [Bindings](#bindings))
- its bindings MUST resolve using the document + discovery context (see below)

---

## Interfaces & Comparison

An **interface** is a reusable contract: a named set of operations that services can implement. Interfaces enable interoperability: if two services implement the same interface, clients can target the interface rather than a specific service.

This document defines how interface compatibility works under the **operations** model.

### Interface Structure

An interface document contains:

- **metadata**: `openbindings` (required), `name` (optional), `version` (optional), `description` (optional). `name`, `version`, and `description` are author-chosen labels; they are not identifiers and do not participate in compatibility checking. Interface identity is location-based (see [Interface identity](#interface-identity-location-based)).
- **roles** (optional): interfaces this document intends to satisfy. See [Roles](#roles) below.
- **schemas** (optional but recommended): canonical JSON Schemas used by operations. See [Schemas](#schemas) below.
- **operations** (required): the contract surface area
- **sources** (optional): registry of binding artifacts (only needed if using bindings)
- **bindings** (optional): may exist, but interfaces SHOULD remain useful without them
- **security** (optional): named security method entries referenced by bindings. See [Security](#security) below.
- **transforms** (optional): named transform definitions referenced by bindings. See [Transforms](#transforms) below.

Minimal document shape (non-normative):

```json
{
  "openbindings": "0.1.0",
  "operations": {}
}
```

### Schemas

`schemas` is an optional top-level map of named JSON Schemas. Each key is a schema name; each value is a JSON Schema object.

Operations reference these schemas via `$ref` pointers (e.g., `{ "$ref": "#/schemas/Task" }`). Compatibility checking evaluates whichever schemas an operation's `input`/`output` slots resolve to — whether they come from the `schemas` map, are inlined directly on the operation, or are resolved via `$ref` to an external document. The `schemas` map is a convenience for reuse and readability across operations, not a separate evaluation surface.

```json
{
  "schemas": {
    "Task": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" }
      },
      "required": ["id", "title"]
    }
  }
}
```

Normatively:

- Schema keys MUST be unique within the document (as with any JSON object).
- Schemas MUST be valid JSON Schema objects under the document's declared dialect (default: JSON Schema 2020-12).
- Schemas MAY reference other schemas in the same document via `$ref` (e.g., `{ "$ref": "#/schemas/Task" }`).
- Schemas MAY also be defined inline within operations. The `schemas` map is a convenience for reuse and readability, not a requirement.

For the normalization and comparison rules that apply to these schemas, see [Schema Resolution & Normalization](#schema-resolution--normalization) and [Normalization (profile v0.1)](#normalization-profile-v01).

### Operations

Operations are stored in a single `operations` map:

```json
{
  "operations": {
    "health.check": {
      "idempotent": true,
      "input": { "type": "object" },
      "output": { "$ref": "#/schemas/HealthStatus" }
    },
    "events.stream": {
      "output": {
        "oneOf": [
          { "$ref": "#/schemas/TaskCreated" },
          { "$ref": "#/schemas/TaskCompleted" }
        ]
      }
    }
  }
}
```

Operations do not prescribe execution pattern. Whether an operation is request/response, streaming, bidirectional, or something else is determined by the **binding** -- not by the operation definition. An operation that defines polymorphic `input`/`output` schemas (using `oneOf`/`anyOf`) can naturally express multiple message types, which is how streaming and event-oriented patterns are modeled.

### Operation fields

All operations support:

- `description` (OPTIONAL): a human-readable description of the operation.
- `deprecated` (OPTIONAL): if `true`, the operation is deprecated and consumers SHOULD migrate to an alternative. Deprecation is documentation metadata; it MUST NOT affect compatibility checking or binding resolution.
- `tags` (OPTIONAL): an array of string labels for grouping and filtering (e.g., `"tags": ["public", "v2", "billing"]`). Tags are documentation metadata; they MUST NOT affect compatibility checking or binding resolution. Consumers and tooling MAY use tags for display grouping, search, and filtering.
- `aliases` (OPTIONAL): alternate names for compatibility matching. See [Operation matching](#operation-matching-aliases-and-satisfies).
- `satisfies` (OPTIONAL): explicit conformance mappings to role interfaces. See [Operation matching](#operation-matching-aliases-and-satisfies).
- `idempotent` (OPTIONAL): see [Idempotency](#idempotency) below.
- `input` (OPTIONAL): a JSON Schema describing the operation's input.
- `output` (OPTIONAL): a JSON Schema describing the operation's output.
- `examples` (OPTIONAL): named examples. See [Operation examples](#operation-examples).

#### Idempotency

`idempotent` is a declarative hint that indicates whether an operation is safe to retry without side effects. When `true`, calling the operation multiple times with the same input produces the same result and the same observable state as calling it once.

`idempotent` is **metadata**, not a normative constraint:

- `idempotent` MUST NOT affect compatibility checking. Two operations with identical schemas are equally compatible regardless of their `idempotent` values.
- `idempotent` MUST NOT affect binding resolution, transform evaluation, or any other normative behavior.
- Tools MAY use `idempotent` for operational decisions such as automatic retries, caching, or safety warnings. For example, a tool might auto-retry a failed `idempotent: true` operation but prompt before retrying an operation where `idempotent` is `false` or absent.
- If omitted, no idempotency assumption is made. Tools SHOULD treat the operation as potentially non-idempotent.

### Operation examples

Any operation MAY include an `examples` field containing named examples:

- `examples?: Record<string, OperationExample>`

Each example MAY include:

- `description?: string` — human-readable description of the example
- `input?` — example input value (SHOULD validate against the operation's `input` schema)
- `output?` — example output value (SHOULD validate against the operation's `output` schema)

Examples are documentation. They MUST NOT affect compatibility checking, binding resolution, or any other normative behavior.

### Omitted schemas

For `input` and `output`, the following forms are semantically identical and MUST be treated equivalently by implementations:

- Key absent (e.g., no `output` field in the operation)
- Key present with value `null`

All mean "unspecified." The operation may still accept input or produce output at runtime; the schema is simply undocumented.

Note: `{}` (empty schema) is NOT equivalent to absent/null. In JSON Schema, `{}` is a valid schema that accepts any JSON value. An omitted schema means "not documented"; `{}` means "documented as accepting anything."

For schema comparison: if either the target or candidate has an unspecified schema for a given slot (`input`, `output`), the slot-level fact is `silent-by-I` or `silent-by-D` respectively. No contradiction inference is made.

### Schema Comparison

Schema comparison examines the schemas of two OpenBindings interfaces and produces a structured description of their relationship. The comparison operates on operation schemas, not on bindings or runtime behavior.

Comparison is a *claim comparison*. An OBI document is a set of author-declared claims about a service. Two documents can be compared for alignment: where both describe the same field, do their claims fit together? Where only one side makes a claim, that fact is recorded as a silence rather than a conflict. Comparison produces facts; tools consume those facts to make policy decisions (filtering, gating, ranking). The spec defines the facts, not the policy.

Comparison does not guarantee runtime interoperability. An OBI is a claim about what software does, and claims can be incorrect or incomplete. Comparison evaluates whether the documents' claims are structurally aligned under the profile rules, which is a weaker assertion than runtime substitutability.

Comparison and [actionability](#binding-coverage-actionability) are independent assessments answering different questions. Comparison asks: are the candidate's and target's claims structurally aligned? Actionability asks: does the candidate have resolvable bindings that let a tool construct concrete interaction targets? A candidate may be aligned without being actionable (schemas match, no bindings present), or actionable without being aligned (bindings resolve, transforms bridge to a differently-shaped backend).

#### Inputs

Comparison takes four inputs:

- the **candidate** document \(D\),
- the candidate's **location** \(\text{loc}(D)\),
- the **target** interface \(I\),
- the target's **location** \(\text{loc}(I)\).

A document's location is the URI from which it was retrieved, or a caller-supplied base URI for documents loaded without a canonical retrieval URI. Locations are compared per [Location equality](#location-equality).

#### Fact categories (normative)

For each field path examined in the comparison, tools MUST assign exactly one of the following fact categories:

- **`covered`** — \(D\)'s claim structurally covers \(I\)'s claim on this field in the appropriate direction (contravariant for inputs, covariant for outputs). Includes the case where both sides are silent on the same sub-field.
- **`silent-by-D`** — \(I\) makes a claim on this field; \(D\) makes no claim.
- **`silent-by-I`** — \(D\) makes a claim on this field; \(I\) makes no claim.
- **`contradicts`** — \(D\) and \(I\) both make claims on this field, and no single JSON value satisfies both claims in the comparison direction.
- **`undecidable`** — the profile cannot evaluate this field (out-of-profile keywords, unresolvable `$ref`, unresolved cycles, schemas from unsupported dialects).

These categories are the normative shared vocabulary for reporting comparison results across tools.

#### Diagnostic record format (normative)

A comparison output MUST include an array of diagnostic records. Each record MUST contain:

- `path` — the field path within the comparison, as a JSON Pointer rooted at the operation slot (e.g., `/operations/tasks.create/input/properties/title`).
- `category` — one of `covered`, `silent-by-D`, `silent-by-I`, `contradicts`, `undecidable`.
- `keyword` — the JSON Schema keyword that produced this fact (e.g., `type`, `required`, `enum`).
- `direction` — `input` or `output` (which comparison direction was applied).
- `target` — the value \(I\) declared at this path, or `null` if silent.
- `candidate` — the value \(D\) declared at this path, or `null` if silent.

Tools MAY include additional fields. Tools MUST NOT omit the six fields listed above.

Tools MAY emit records for `covered` facts (useful for coverage reporting) or MAY omit them. Tools MUST emit records for every `silent-by-D`, `silent-by-I`, `contradicts`, and `undecidable` fact they produce.

#### Canonical verdict derivation (non-normative)

The spec publishes a canonical derivation from facts to a document-level verdict under the scheme name `openbindings.alignment@1.0`. Tools MAY produce this verdict alongside per-field diagnostics.

The derivation proceeds over all facts in the comparison:

- If any fact is `contradicts`, the verdict is `misaligned`.
- Else if any fact is `undecidable`, the verdict is `undecidable`.
- Else if any fact is `silent-by-D` or `silent-by-I`, the verdict is `partial`.
- Else (all facts are `covered`), the verdict is `aligned`.

Verdict meanings:

- **`aligned`** — every one of \(I\)'s claims is covered by \(D\); no silences, no contradictions.
- **`partial`** — no contradictions, but at least one silence on either side. The documents' claims are structurally consistent where both make claims.
- **`misaligned`** — at least one explicit conflict between \(D\)'s and \(I\)'s claims.
- **`undecidable`** — the comparison could not be evaluated (at least one `undecidable` fact, no `contradicts` facts).

This derivation is **non-normative**. Tools MAY adopt it, MAY define their own verdict schemes, or MAY emit only per-field diagnostics. Tools that emit verdict output under the name `openbindings.alignment@1.0` MUST implement this derivation exactly.

#### Alternative verdict schemes

Tools MAY define alternative verdict schemes for their own purposes. Alternative schemes MUST be named with a tool-specific or organization-specific prefix:

    <prefix>.<concept>@<version>

Examples: `acme.ranking@1.0`, `acme.ci-gate@2.0`.

The reserved prefix `openbindings.` is for spec-published schemes only. Tools MUST NOT use unqualified verdict names to emit anything other than `openbindings.alignment@1.0` output.

#### Tool-side strictness

Tools MAY apply strictness policies beyond the default derivation. A CI gate may treat `partial` as failure for its deployment's constraints. A registry may apply weighted scoring across fact categories. An agent may filter out anything except `aligned`.

Tool-side strictness is additive: tools tighten the acceptance threshold beyond `openbindings.alignment@1.0`'s verdicts, but MUST NOT claim their output is `openbindings.alignment@1.0` when applying different semantics. Tool-specific strictness produces tool-specific verdict output under a tool-specific scheme name.

Authors who want strict treatment of their schemas express that strictness at the JSON Schema level: `additionalProperties: false`, explicit `required` lists, bounded enums, and other JSON Schema constructs. There is no separate document-level strict-mode attribute; strictness is whatever the schema actually declares.

#### Layering summary

| Layer | Who defines it | Normative? |
|---|---|---|
| Document format, identity, discovery | Spec | Yes |
| JSON Schema profile, normalization | Spec | Yes |
| Fact categories (vocabulary) | Spec | Yes |
| Fact-generation rules (per-keyword) | Spec | Yes |
| Diagnostic record format | Spec | Yes |
| `openbindings.alignment@1.0` verdict derivation | Spec | Non-normative |
| Tool-side strictness policies | Tool | Tool's choice |
| Alternative verdict schemes | Tool | Tool's choice |
| Registry ranking, CI gating, UX | Tool | Tool's choice |

### Name identity

Within a single OpenBindings document, operation keys under `operations` MUST be unique. Operation key syntax is otherwise unconstrained by this specification: any string that satisfies JSON object key rules is permitted, and tools MUST treat operation keys as opaque strings beyond the uniqueness rule. Authors SHOULD nevertheless choose stable, descriptive keys, since binding format ref conventions and downstream tooling may impose their own character restrictions.

Across documents, interoperability is driven by the target interface’s operation keys. If two interfaces define the same operation key with different meaning, they are not interoperable unless one explicitly adapts to the other via `satisfies` (see [Operation matching](#operation-matching-aliases-and-satisfies)). `aliases` declare alternate names for the same operation within one document; they do not cross-adapt between unrelated interfaces.

### Operation matching (`aliases` and `satisfies`)

OpenBindings supports two mechanisms to keep compatibility deterministic while allowing renames and community-driven composition:

- **`aliases`**: additional names that an operation may be matched under for compatibility checks.
- **`satisfies`**: an explicit mapping that says “this operation is intended to satisfy interface X’s operation Y.”

#### `aliases`

Any operation MAY declare:

- `aliases?: string[]`

Rules:

- Within a document, aliases MUST NOT be shared across different operations (otherwise matching becomes ambiguous).
- An alias MUST NOT collide with the primary key of any other operation in the same document.
- When validating compatibility, a required operation name MAY match either an operation’s primary key or one of its `aliases`.

#### `satisfies`

Any operation MAY declare:

- `satisfies?: Array<{ role: string; operation: string }>`

Where:

- `role` is a key referencing an entry in the document’s `roles` map (see [`roles`](#roles))
- `operation` is the target operation identifier within that role’s interface, expressed as either the target operation’s primary key or one of its aliases

Rules:

- `satisfies[*].role` MUST reference a key that exists in the document’s `roles` map.
- Tools MUST resolve `satisfies[*].operation` against the referenced interface’s operation keys first, then aliases.
- If resolution matches multiple target operations, that is an error (ambiguous).
- Tools MUST honor `satisfies` mappings when present.

#### Matching algorithm (deterministic)

Comparison takes four inputs: the candidate document `D`, the candidate's location `loc(D)`, the target interface `I`, and the target's location `loc(I)`. A document's location is the URI from which it was retrieved, or a caller-supplied base URI for documents loaded without a canonical retrieval URI. See [Location equality](#location-equality) for how locations are compared.

When checking whether `D` is compatible with `I`, tools MUST evaluate each required operation key `op` in `I` as follows:

- **Explicit match (preferred)**: any operation in `D` that declares `satisfies: [{ role: <roleKey>, operation: opOrAlias }]` where `D.roles[roleKey]`, after resolution per [`roles`](#roles), equals `loc(I)` per [Location equality](#location-equality), and `opOrAlias` resolves to `op`.
- **Fallback match**: if no explicit match exists, any operation in `D` whose primary key is `op` or whose `aliases` contain `op`.

The match MUST be unique:

- 0 matches → unmatched (operation not provided by the candidate; see [Interface conformance](#interface-conformance) for partial conformance)
- 1 match → proceed to schema comparison checks
- > 1 matches → error: ambiguous compatibility mapping

### Fact-generation rules

The rules in this section define the fact each in-profile JSON Schema keyword produces. They operate on normalized schemas (see [Normalization](#normalization-profile-v01)) and emit facts per the [Fact categories](#fact-categories-normative) vocabulary.

Fact-generation MUST be spec-defined and tool-independent. A tool claiming OpenBindings support MUST implement deterministic schema resolution and normalization (see [Schema Resolution & Normalization](#schema-resolution--normalization)) and apply the rules defined in this section. Out-of-profile keywords produce `undecidable` facts for the affected fields.

#### Directionality

Schema comparison is directional. In the rules below, \(I\) refers to the target interface’s schema and \(D\) refers to the candidate’s schema.

- **Input comparison**: checks that \(D\) covers what \(I\) describes (\(D\) may accept more).
- **Output comparison**: checks that \(D\) stays within what \(I\) describes (\(D\) may return less).

#### Profile scope (v0.1)

This spec defines a **conservative, deterministic** comparison for a **restricted subset** of JSON Schema keywords. It is **not** a general JSON Schema subschema/containment checker. Schemas using keywords outside this profile produce `undecidable` facts for the affected fields.

Note (non-normative): this profile is not a JSON Schema vocabulary or dialect. It does not restrict which keywords are valid in operation schemas — any valid JSON Schema 2020-12 schema is a valid operation schema. The profile only defines which keywords the comparison engine can reason about. Tools MAY publish a meta-schema for the profile's keyword subset as a convenience for validating that schemas will be fully evaluable, but this is not required.

Normatively:

- Tools claiming OpenBindings support MUST implement this profile for fact generation.
- If a schema uses keywords outside this profile, a tool MUST emit `undecidable` facts for the affected fields; it MUST NOT emit `covered` facts for fields whose comparison depends on out-of-profile keywords.

##### Dialect and `$schema`

- The default dialect for this profile is **JSON Schema 2020-12**.
- If a schema declares `$schema` and it is not JSON Schema 2020-12, tools MUST treat that schema as **outside the profile** unless the tool explicitly supports that dialect and can guarantee identical behavior for the keywords used.

##### Supported keyword subset

The following keywords are in-scope for deterministic compatibility:

- **Structural / composition**: `$ref`, `$defs`, `allOf`
- **Type/value**: `type`, `enum`, `const`
- **Objects**: `properties`, `required`, `additionalProperties` (boolean or schema)
- **Arrays**: `items`
- **Unions**: `anyOf`, `oneOf` (accepted subject to the disjointness rule in [Normalization](#normalization-profile-v01); `oneOf` with variants that are not provably disjoint is outside the profile)
- **Numeric bounds**: `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`
- **String bounds**: `minLength`, `maxLength`
- **Array bounds**: `minItems`, `maxItems`

All other validation keywords are outside the v0.1 profile (including, but not limited to: `not`, `if`/`then`/`else`, `patternProperties`, `unevaluatedProperties`, `dependentSchemas`, `contains`, `prefixItems`, `propertyNames`, `pattern`, `multipleOf`, `uniqueItems`).

Annotation-only keywords (e.g., `title`, `description`, `examples`, `default`, `deprecated`, `readOnly`, `writeOnly`, `format`) MUST be ignored for compatibility decisions. Note: `format` is annotation-only in JSON Schema 2020-12 by default (it does not constrain validation unless the `format-assertion` vocabulary is explicitly enabled). Since this profile uses the 2020-12 default, `format` is stripped during normalization.

#### Normalization (profile v0.1)

Before performing compatibility checks, tools MUST normalize schemas deterministically:

- **Canonical JSON string**: when this profile refers to a “canonical JSON string”, it means RFC 8785 (JSON Canonicalization Scheme, JCS) applied to the normalized schema value. See [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785).
- **Resolve `$ref`** deterministically (per [`$ref` resolution](#ref-resolution)).
- **Inline `$ref` targets** for the purpose of comparison (tools may cache resolved targets, but evaluation MUST be equivalent to inlining).
- **Canonicalize keyword forms**:
  - Normalize `type` to a sorted array of strings (e.g., `"string"` → `["string"]`).
  - Normalize `required` to a sorted array of unique strings.
- **Normalize unions**:
  - For `oneOf`, tools MUST attempt to prove variants are pairwise disjoint under the supported keyword subset. If disjointness is provable, replace the `oneOf` keyword with `anyOf` containing the same variants. Otherwise, the schema MUST be treated as outside the profile (fail closed).
  - For `anyOf` (including any converted from `oneOf`), normalize each variant, then sort variants by the canonical JSON string (RFC 8785 JCS) of the normalized variant.

  Variants are provably pairwise disjoint iff, for every pair of variants, at least one of the following holds after normalization of the individual variants:

  - **Distinct `type` sets**: the two variants' `type` sets are disjoint, accounting for `integer`/`number` subsumption.
  - **Distinct `const`**: both variants use `const` at the top level, with different values.
  - **Disjoint `enum`**: both variants use `enum` at the top level, with disjoint value sets.
  - **Discriminator property**: both variants are `type: "object"`, both list a shared property in `required`, and both describe that property with `const` or `enum` whose values are disjoint across the two variants.

  Other forms of disjointness (e.g., disjoint numeric bounds, disjoint `minLength`/`maxLength` ranges, nested structural differences) are outside the profile for v0.1.

  *Note (non-normative): the Discriminator property case encodes the same structural requirement that AJV's `discriminator` keyword extension, OpenAPI 3.1's `discriminator` object (when authors use it correctly), and RFC 8927 JSON Type Definition's `discriminator` form all express. OBI states the requirement structurally so it applies to any JSON Schema 2020-12 document, without requiring a discriminator keyword or a separate schema language.*
- **Flatten `allOf`**: resolve `allOf` arrays by merging all branches into a single schema before comparison. The merge rules are:
  - `type`: intersection of allowed types, accounting for subsumption (`integer` is a subtype of `number`; see [`type`](#type)). Empty intersection is a schema error.
  - `properties`: union of all property keys. For keys appearing in multiple branches, merge their schemas recursively (apply `allOf` flattening).
  - `required`: union of all required arrays.
  - `additionalProperties`: if any branch is `false`, the result is `false`. If multiple branches define schemas, merge them recursively. If a branch is `false` and another branch defines properties not covered by any branch with `false`, that is a schema error.
  - `enum` / `const`: intersection of allowed values. Empty intersection is a schema error.
  - `items`: if multiple branches define `items`, merge them recursively.
  - Numeric/string/array bounds (`minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `minLength`, `maxLength`, `minItems`, `maxItems`): take the most restrictive value from all branches (highest minimum, lowest maximum).
  - `oneOf` or `anyOf` inside `allOf`: if any `allOf` branch contains `oneOf` or `anyOf`, the schema MUST be treated as outside the profile (fail closed). Computing the intersection of unions is combinatorial and not deterministically tractable in the general case. *Note (non-normative): this pattern is common in OpenAPI discriminated unions. Interface creators SHOULD resolve these compositions into equivalent schemas within the supported profile before writing the OBI, so that compatibility checking can evaluate them.*
  - If any branch contains keywords outside the profile, the schema MUST be treated as outside the profile (fail closed).
  - If merging produces an irreconcilable conflict (e.g., no type overlap, empty enum intersection), the schema MUST be treated as a schema error.

#### Per-keyword fact-generation rules (profile v0.1)

The rules below apply after normalization and define which fact is emitted for each in-profile keyword in each direction. `allOf` is resolved during normalization, so it does not appear here. Each rule assumes both schemas declare the keyword in question unless stated otherwise; when only one side declares it, the fact is `silent-by-D` or `silent-by-I` accordingly. Out-of-profile keywords produce `undecidable`.

##### Trivial schemas

The empty schema `{}` accepts any JSON value.

- Input: emit `covered` if \(eI\) accepts at least what \(eD\) accepts. If \(eD = \{\}\), always `covered`. If \(eI = \{\}\) and \(eD\) has any constraint, emit `contradicts` (D rejects values I accepts).
- Output: emit `covered` if \(eD\) accepts at most what \(eI\) accepts. If \(eI = \{\}\), always `covered`. If \(eD = \{\}\) and \(eI\) has any constraint, emit `contradicts` (D may emit values I forbids).

##### `type`

Treat `type` as a set of allowed JSON types. If `type` is absent from a schema, it is treated as unconstrained (all JSON types), equivalent to `type: ["array","boolean","integer","null","number","object","string"]`.

**Subsumption**: `integer` is a subtype of `number` (every JSON integer is also a JSON number). Type-set membership MUST account for this: `integer` is considered a member of any type set that contains `number`.

- Input: emit `covered` if every type in \(I\) is in \(D\) (accounting for subsumption). Otherwise emit `contradicts`.
- Output: emit `covered` if every type in \(D\) is in \(I\) (accounting for subsumption). Otherwise emit `contradicts`.

##### `const` / `enum`

- Input:
  - If \(I\) uses `const` and \(D\) accepts that constant, emit `covered`. Otherwise `contradicts`.
  - If \(I\) uses `enum` and \(D\) accepts every value in that enum, emit `covered`. Otherwise `contradicts`.
- Output:
  - If \(I\) uses `enum` and every value \(D\) may emit is in \(I\)'s enum, emit `covered`. Otherwise `contradicts`.
  - If \(I\) uses `const` and \(D\) only allows that constant, emit `covered`. Otherwise `contradicts`.

##### Objects (`properties`, `required`, `additionalProperties`)

These rules apply when `type` includes `object` (and no unsupported keywords are present). Absent `additionalProperties` is treated as `true`.

For any key \(k\), the **effective schema** of schema \(S\) for \(k\) is `properties(S)[k]` if declared, otherwise `additionalProperties(S)` (which may be a schema, `true`, or `false`).

Let \(eI = \text{effective}(I, k)\) and \(eD = \text{effective}(D, k)\). Treat `false` as "key forbidden" and `true` as the empty schema `{}` when recursing.

- **Required**:
  - Input: emit `covered` if `required(D)` is a subset of `required(I)`. Otherwise emit `contradicts` (D requires fields I does not).
  - Output: emit `covered` if `required(I)` is a subset of `required(D)`. Otherwise emit `contradicts` (D may omit fields I promises).
- **Per-key effective schemas**, applied for every \(k\) in `properties(I) ∪ properties(D)` and, separately, to `additionalProperties(I)` vs `additionalProperties(D)` (covering the infinite tail of keys in neither `properties`):
  - Input: emit `covered` if \(eI = \text{false}\) (I never sends this key), or \(eD \neq \text{false}\) AND recursive input fact generation for \(eI\) vs \(eD\) produces no `contradicts`. Otherwise emit `contradicts` for the field path.
  - Output: emit `covered` if \(eD = \text{false}\) (D never emits this key), or \(eI \neq \text{false}\) AND recursive output fact generation for \(eI\) vs \(eD\) produces no `contradicts`. Otherwise emit `contradicts` for the field path.

When only one side declares a property, the other side's effective schema is `additionalProperties`. The fact category reflects the comparison of effective schemas; if the side that does not declare the property is treated as `true` (unconstrained), the fact is derived from the comparison rule above. When both sides are silent on a specific sub-property, no fact is emitted for that sub-property.

##### Arrays (`items`)

These rules apply when `type` includes `array` (and no unsupported keywords are present).

- Input: recurse input fact generation for `items(I)` vs `items(D)`; the fact for the array reflects the recursive result.
- Output: recurse output fact generation for `items(I)` vs `items(D)`; the fact for the array reflects the recursive result.

##### Numeric bounds (`minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`)

These rules apply when `type` includes `number` or `integer`. Absent bounds mean unconstrained (no limit).

- Input:
  - If \(I\) declares a lower bound and \(D\)'s lower bound is ≤ \(I\)'s (or absent): emit `covered` on that bound.
  - If \(I\) declares a lower bound and \(D\)'s lower bound is > \(I\)'s: emit `contradicts` (D rejects values I sends).
  - Symmetric rule for upper bound: \(D\)'s upper bound must be ≥ \(I\)'s (or absent) to emit `covered`; otherwise `contradicts`.
- Output:
  - If \(I\) declares a lower bound and \(D\)'s lower bound is ≥ \(I\)'s: emit `covered`.
  - If \(I\) declares a lower bound and \(D\)'s lower bound is < \(I\)'s (or absent): emit `contradicts` (D may emit values below I's floor).
  - Symmetric rule for upper bound: \(D\)'s upper bound must be ≤ \(I\)'s to emit `covered`; if \(D\) is absent where \(I\) declares one, emit `contradicts`.

When comparing bounds, `exclusive` variants are strictly stronger than their non-exclusive counterparts (e.g., `exclusiveMinimum: 0` is stricter than `minimum: 0`).

##### String bounds (`minLength`, `maxLength`)

These rules apply when `type` includes `string`. Absent bounds mean unconstrained.

- Input:
  - `minLength(D)` ≤ `minLength(I)` (or absent) → `covered` for `minLength`. Otherwise `contradicts`.
  - `maxLength(D)` ≥ `maxLength(I)` (or absent) → `covered` for `maxLength`. Otherwise `contradicts`.
- Output:
  - `minLength(D)` ≥ `minLength(I)` → `covered` for `minLength`. Absent `minLength(D)` when \(I\) has one → `contradicts`.
  - `maxLength(D)` ≤ `maxLength(I)` → `covered` for `maxLength`. Absent `maxLength(D)` when \(I\) has one → `contradicts`.

##### Array bounds (`minItems`, `maxItems`)

These rules apply when `type` includes `array`. Absent bounds mean unconstrained. Same pattern as string bounds:

- Input:
  - `minItems(D)` ≤ `minItems(I)` (or absent) → `covered`. Otherwise `contradicts`.
  - `maxItems(D)` ≥ `maxItems(I)` (or absent) → `covered`. Otherwise `contradicts`.
- Output:
  - `minItems(D)` ≥ `minItems(I)` → `covered`. Absent when \(I\) has a bound → `contradicts`.
  - `maxItems(D)` ≤ `maxItems(I)` → `covered`. Absent when \(I\) has a bound → `contradicts`.

##### Unions (`anyOf`)

After normalization, `oneOf` has been either converted to `anyOf` (when variants are provably disjoint) or flagged outside the profile. Fact generation therefore operates on `anyOf` variants only.

Treat `anyOf` as a set of variants.

- Input: emit `covered` if for every variant \(v\) in \(I\) there exists at least one variant \(w\) in \(D\) such that recursive input fact generation for \(v\) vs \(w\) produces no `contradicts`. Otherwise emit `contradicts`.
- Output: emit `covered` if for every variant \(w\) in \(D\) there exists at least one variant \(v\) in \(I\) such that recursive output fact generation for \(v\) vs \(w\) produces no `contradicts`. Otherwise emit `contradicts`.

##### Keyword combinations

When a schema uses multiple in-profile keywords (e.g., `properties` alongside `type`), each keyword's rule is evaluated independently and each produces its own fact. The field's overall fact set is the union of per-keyword facts. Any `contradicts` among them means at least one keyword contradicts; the document-level verdict aggregation (see [Canonical verdict derivation](#canonical-verdict-derivation-non-normative)) handles rollup.

### `roles`

An interface MAY declare that it intends to satisfy other interfaces via `roles`:

```json
{
  "roles": {
    "oauth2": "https://interfaces.example.com/oauth2/v1.json",
    "oidc": "https://interfaces.example.com/oidc/v1.json"
  }
}
```

`roles` is a key-value map where:

- Each **key** is a local alias used within this document (referenced by `satisfies[*].role`)
- Each **value** is a URL or relative path to another OpenBindings interface document

Declaring a role means “this interface intends to play this role” — individual operations then use `satisfies` to map to specific operations within the role’s interface. Roles define the contract shapes an interface aims to provide; bindings and implementations are the author’s own concern.

Normatively:

- Each value in `roles` MUST be a valid URI or relative URI reference.
- Relative-path role values MUST be resolved per RFC 3986 §5 Reference Resolution, using the declaring document's canonical URI as the base URI. Resolution is directory-relative: RFC 3986's merge step strips everything after the last `/` in the base URI's path before appending the reference. For a document at `https://example.com/interfaces/host.json`:
  - `./foo.json` → `https://example.com/interfaces/foo.json`
  - `../other/foo.json` → `https://example.com/other/foo.json`
  - `/foo.json` → `https://example.com/foo.json`
  - `https://other.example.com/foo.json` → `https://other.example.com/foo.json` (absolute URI; base URI is not consulted)

  If the declaring document has no known base URI (e.g., loaded from stdin or an in-memory object without a caller-supplied base), relative role values are unresolvable, and any `satisfies` entry referencing such a role MUST be treated as unmatched.
- Resolved role URIs are compared to target locations using [Location equality](#location-equality).
- Tools MAY attempt to fetch role interfaces for conformance validation, but the document MUST remain meaningful even if retrieval is not possible at evaluation time.
- Role keys MUST be unique within a document.

`roles` is **not** required to interpret the contract surface of a document. The contract surface is always the set of operations present in `operations`.

`roles` serves multiple purposes:

- **conformance declaration**: declares which interfaces this document intends to satisfy (tooling can verify coverage)
- **reference table**: provides resolvable references for `satisfies` mappings, enabling explicit conformance declaration and resolving the diamond problem (when multiple role interfaces define operations with the same name)
- **provenance**: documents the lineage of a composed interface (“this interface bundles these contracts”)
- **tooling UX**: grouping, coverage dashboards, suggestions for `satisfies`

Normatively, interfaces intended for distribution and discovery (especially those served at `/.well-known/openbindings`) SHOULD be **self-contained for operations**: required operations MUST be listed in `operations` and MUST NOT be only “implied” by remote references.

Tools MAY use `roles` to validate that the document’s operations cover the role interfaces (using the same matching rules as compatibility), but failure to resolve a role interface should be treated as “cannot evaluate” rather than changing the meaning of the document itself.

**Versioning note**: role interface URLs are **not snapshots**. If the document at a role URL changes, conformance may break. Interface authors SHOULD use versioned URLs for stability, with the major.minor version as a path segment (e.g., `https://example.com/interfaces/task-manager/1.0.json`). Patch versions should not change the interface contract, so only major.minor is needed in the URL.

Notes:

- A “bundle interface” is typically authored by declaring roles for other interfaces and then publishing an expanded/self-contained `operations` set (often generated by tooling).
- Interfaces MAY also conform to other interfaces without declaring them as roles (“duck typing” via matching operation names and schemas). `roles` + `satisfies` is the explicit, verifiable form of conformance declaration.

### Interface conformance

An interface **conforms to** another interface if it is compatible according to the matching algorithm defined in this specification. A service whose OpenBindings interface conforms to interface X is said to be **X-conformant**.

Conformance may be:

- **Declared**: the conforming interface lists the target in `roles` and uses `satisfies` on its operations to establish explicit mappings. Declared conformance is verifiable by tooling and resilient to operation renames.
- **Implicit**: the conforming interface's operation keys or aliases happen to match the target's operation keys, without a `roles` entry or `satisfies` declarations. Implicit conformance is opportunistic — it works when names align but may break silently if either side renames an operation.

Declared conformance is RECOMMENDED for interfaces intended for distribution or discovery. Implicit conformance is useful for ad-hoc interoperability but provides weaker guarantees.

Conformance is **directional**: "A conforms to B" means A provides at least the operations B requires, with compatible schemas. It does not imply B conforms to A.

Conformance may be **partial**: an interface that satisfies a subset of another interface's operations is partially conformant. Tools SHOULD report conformance as coverage (e.g., "3/5 operations matched") rather than treating partial conformance as an error. A `roles` entry establishes a reference for `satisfies` mappings; it does not by itself assert full conformance with the role interface.

Conformance is **not identity**: two unrelated interfaces may define the same operation names with different semantics. Conformance only asserts structural compatibility (operation presence and schema direction), not semantic equivalence. Trust in conformance claims depends on the authenticated discovery context and the provenance of the interfaces involved.

### Identity (operation names)

Within an interface, the operation key in `operations` is the canonical identifier for that operation slot. `aliases` provide additional names for matching and backwards compatibility, but do not create new operation slots.

The baseline compatibility model is key/alias matching plus explicit `satisfies` when disambiguation is required.

---

## Bindings

Bindings define how binding-specification-agnostic **operations** are exposed through concrete bindings (protocols/transports/specs).

OpenBindings bindings are always expressed through external binding specifications (e.g., OpenAPI, AsyncAPI, gRPC/proto, etc.) referenced or embedded by the OpenBindings document.

### Tooling support (capabilities)

Bindings are an interoperability feature, but not every tool needs to interpret every binding specification. Tools SHOULD declare which binding specifications they support (e.g., OpenAPI, AsyncAPI).

Tools that do not implement a binding specification MUST ignore it (or surface a capability error for that binding) without failing the entire document.

### Binding shape (keyed map)

Bindings are stored in a `bindings` map, keyed by a user-chosen binding name. Each entry ties together three things: an **operation** (what to do), a **source** (where the binding artifact lives), and optionally a **ref** (where to find the operation within that artifact).

Binding keys are unique string identifiers within a document. The spec does not prescribe a naming convention — keys are opaque to the format. Tooling MAY auto-derive keys (e.g., `<operation>.<source>`) but authors are free to choose any unique string.

Multiple bindings for the same operation are allowed and expected. A single operation may be exposed through different binding specifications, different protocol versions, or different sources — each as a separate binding entry. This supports ecosystem interop, alternate representations, drift-checking, and multi-protocol expression.

### Binding entry fields

Each binding entry declares how an operation is exposed using a binding specification:

- `operation` (REQUIRED): a key in the document's `operations` map.
- `source` (REQUIRED): a key in the document's `sources` map (see [Sources](#sources) below).
- `ref` (OPTIONAL): a pointer into the binding artifact that identifies the specific operation within the source. See [`ref`](#ref-pointer-into-binding-source) below.
- `priority` (OPTIONAL): a relative preference ordering for binding selection. See [Priority](#priority) below.
- `security` (OPTIONAL): a key in the document's `security` map. Indicates the security requirements for this binding. See [Security](#security).
- `description` (OPTIONAL): a human-readable description of this binding.
- `deprecated` (OPTIONAL): if `true`, this binding is deprecated and an alternative should be preferred.
- `inputTransform` / `outputTransform` (OPTIONAL): transforms between operation schemas and binding schemas. See [Transforms](#transforms).

#### `ref` (pointer into binding source)

`ref` is an optional string that identifies a location _within_ the binding artifact referenced by the binding's source.

Normatively:

- The meaning of `ref` is **binding-format-specific** (determined by `sources[*].format`).
- If a tool cannot resolve `ref` for a supported `format`, that binding MUST be treated as **unresolvable** (and thus contributes no coverage).

##### Ref conventions

To promote interoperability across tools for the same binding format, format ecosystems SHOULD document named **ref conventions** that define the structure and resolution rules for `ref` values.

Where a well-known path syntax exists for the source format, refs SHOULD use it:

- For JSON and YAML sources, refs SHOULD use JSON Pointer (RFC 6901) URI fragments (e.g., `#/paths/~1weather/get`). JSON and YAML share a data model, so JSON Pointer applies to both.
- For XML sources, refs SHOULD use XPath expressions where applicable.

Where no standard path syntax exists, the format ecosystem defines the convention (e.g., a command name, a fully qualified method name, a node path). Format ecosystems SHOULD document their chosen convention to enable interoperability across tools.

Tools MAY record the ref convention in use via the extension field `x-ref-pattern` on the source or binding entry (e.g., `"x-ref-pattern": "jsonPointer"`). This field is advisory; its absence MUST NOT affect resolution. When present, it allows tools to determine whether they can resolve the refs in a binding without attempting resolution.

#### Priority

`priority` is an optional number providing a preference hint for binding selection. Lower numbers are more preferred.

- `priority` MUST NOT affect compatibility or validation outcomes.
- Tools MAY use `priority` when selecting among supported + resolvable bindings for an operation.
- A source MAY declare a `priority` that applies as the default for all bindings referencing that source. A binding-level `priority` overrides the source-level value.
- If neither the binding nor its source declares `priority`, the binding is less preferred than any binding with an explicit `priority` value. Among bindings with equal or omitted priority, selection order is unspecified.

### Sources

`sources` is a top-level registry of binding specifications. Each entry declares:

- `format` (REQUIRED): the binding specification and version (e.g., `openapi@3.1`, `asyncapi@3.0`). See [`format`](#format-identifier) below.
- One of:
  - `location`: a URI or path to an external binding specification.
  - `content`: the binding specification content embedded directly. For JSON-based formats, this is typically a JSON object. For text-based formats (e.g., KDL, protobuf), this is a string containing the raw content.
- `description` (OPTIONAL): a human-readable description of this source.
- `priority` (OPTIONAL): a default priority for all bindings referencing this source. A binding-level `priority` overrides the source-level value. Lower numbers are more preferred. See [Priority](#priority).

A conforming source MUST include either `location` or `content`, but not both. If a non-conforming document includes both, implementations MUST prefer `content` (the embedded content is authoritative; the location is advisory).

#### `format` (identifier)

`format` identifies **how to interpret** the referenced binding artifact.

Normatively:

- `format` MUST be a string of the form: `<name>` or `<name>@<version>`
  - `<name>` SHOULD be lowercase and SHOULD be stable over time (e.g., `openapi`, `asyncapi`).
  - `<version>`, when present, SHOULD be a SemVer-like string (e.g., `3.1`, `3.0.0`) or a date-based identifier (e.g., `2025-11-25`).
  - Formats that do not have a meaningful version (e.g., protocols discovered via reflection) MAY omit `@<version>`. A versionless format token matches only other versionless tokens with the same `<name>`.
- Tools MUST treat `format` matching as **case-insensitive** for `<name>` (tools SHOULD normalize `<name>` to lowercase).
- Tools MUST treat trailing `.0` segments as insignificant when comparing `<version>`: `openapi@3.1` and `openapi@3.1.0` identify the same format. Tools SHOULD normalize versions by stripping trailing `.0` segments (e.g., `3.1.0` → `3.1`).
- `<version>` matching is otherwise **exact** (string equality after normalization). Tools MUST NOT infer compatibility between different version strings (e.g., `3.1` and `3.2` are distinct formats).

These rules define how **tools compare** format tokens, not how format ecosystems must version their specifications. Format ecosystems are free to use any version scheme; the normalization rules ensure that tools do not treat trivially different representations of the same format as distinct.

Tools that do not support a binding `format` MUST ignore bindings that reference it (or surface a capability diagnostic) without failing the entire OpenBindings document.

#### `format` registry (non-normative guidance)

To avoid ecosystem fragmentation, the OpenBindings project MAY publish a registry of well-known `format` identifiers (e.g., on the spec site).

Guidance:

- Well-known formats SHOULD use short, unprefixed names (e.g., `openapi`, `asyncapi`).
- Vendor- or project-specific formats SHOULD use a reverse-DNS-style name to avoid collisions (e.g., `com.example.gateway-envelope@1.0`).
- Tools SHOULD surface the exact `format` strings they support (capabilities) so producers can target them.

Examples of well-known `format` identifiers (illustrative, not exhaustive):

- `openapi@3.1`
- `openapi@3.0`
- `asyncapi@3.0`
- `asyncapi@2.6`
- `grpc` (versionless; uses server reflection for discovery)
- `connect` (versionless; Connect/Buf protocol over HTTP/1.1)
- `mcp@2025-11-25` (Model Context Protocol, date-versioned)
- `protobuf@3`
- `openbindings.operation-graph@0.1.0` (native operation graph format; see [companion spec](formats/operation-graph/openbindings.operation-graph.md))

#### `location` and resolution

`location` is a string that identifies where to obtain the binding specification.

Normatively:

- If `location` is a relative URI reference (e.g., `./openapi.json`), it MUST be resolved per RFC 3986 §5 Reference Resolution using the declaring OpenBindings document's canonical URI as the base URI, following the same rules given for [`roles`](#roles). Resolution is directory-relative: `./openapi.json` in a document at `https://example.com/a/interface.json` resolves to `https://example.com/a/openapi.json`. Filesystem paths are converted to `file://` URIs before resolution.
- Tools MAY restrict which URI schemes are fetchable (e.g., allow `https:` but disallow `file:`) as a security policy, but such restrictions MUST NOT change the meaning of the OpenBindings document; they only affect actionability/coverage at evaluation time.

#### Executor interoperability

Binding executors for the same format that correctly implement the format's semantics SHOULD be interoperable. A transform targeting one conforming executor SHOULD work with any other conforming executor for that format, because both derive field handling from the same binding source.

If executors for the same format diverge in how they interpret the binding source, transforms may not be portable between them. This is a binding format ecosystem concern; OpenBindings does not mandate specific executor behavior beyond reading the binding source to determine field handling.

### Binding examples

```json
{
  "sources": {
    "publicOpenapi": {
      "format": "openapi@3.1",
      "location": "./openapi.json"
    }
  },
  "bindings": {
    "logs.get.publicOpenapi": {
      "operation": "logs.get",
      "source": "publicOpenapi",
      "ref": "#/paths/~1logs~1{id}/get",
      "priority": 0
    }
  }
}
```

Content source example (JSON object):

```json
{
  "sources": {
    "publicOpenapi": {
      "format": "openapi@3.1",
      "content": {
        "openapi": "3.1.0",
        "info": { "title": "API", "version": "1.0.0" },
        "paths": {}
      }
    }
  },
  "bindings": {
    "logs.get.publicOpenapi": {
      "operation": "logs.get",
      "source": "publicOpenapi",
      "ref": "#/paths/~1logs~1{id}/get",
      "priority": 0
    }
  }
}
```

Content source example (string, for text-based formats):

```json
{
  "sources": {
    "cliSpec": {
      "format": "usage@2.0.0",
      "content": "min_usage_version \"2.0.0\"\nbin \"hello\"\ncmd \"greet\" {\n  help \"Say hello\"\n}"
    }
  }
}
```

### Precedence and drift

Bindings are an alternate representation of exposures in another ecosystem; they do not redefine meaning.

- The OpenBindings operation definition (schemas + semantics) is authoritative.
- Referenced documents are authoritative only for spec-native knobs that do not contradict the OpenBindings operation contract.

Tools MAY surface diagnostics when bindings cannot be resolved or appear to contradict the OpenBindings operation contract. OpenBindings does not standardize diagnostic categories or reporting formats.

OpenBindings does not define uptime/SLA expectations for referenced documents. A binding that cannot be resolved simply cannot contribute to actionable coverage at that evaluation moment.

### Binding coverage (actionability)

Bindings are what make an interface _actionable_ against a running service: they let tools construct concrete interaction targets for operations.

When a tool wants to treat a service as implementing a particular interface, it should validate binding coverage against that interface’s required operations.

Coverage is evaluated against **resolvable bindings**:

Bindings are resolvable only if:

- the selected `sources[source]` exists, and
- a binding source can be obtained (via `location` or `content`), and
- `ref` (if present) resolves within that source, and
- the toolchain performing validation supports `format`

Resolution guidance (non-exhaustive):

- Bindings that reference an unsupported `format` are not resolvable for that tool.
- Bindings whose `location` cannot be retrieved (or is disallowed by tool policy) are not resolvable.
- Bindings whose `ref` cannot be interpreted for the declared `format` are not resolvable.

If an operation's only bindings are unavailable or unparseable at validation time, that operation contributes **0% coverage** until the references can be resolved again.

Required operations are determined by the referenced interface(s) and the matching rules in [Interfaces & Comparison](#interfaces--comparison) (`aliases`/`satisfies`/`roles`).

---

## Security

`security` is an optional top-level map of named security entries. Each entry declares the authentication methods available for bindings that reference it. Bindings reference security entries by key via the `security` field on a binding entry.

Security entries describe **what authentication is available**, not how to implement it. Tools and SDKs determine how to resolve security methods based on their capabilities (e.g., prompting for tokens, driving OAuth flows).

### Security entry shape

Each security entry is an array of security methods in **preference order** (first = preferred). Clients walk the array and pick the first method they support.

```json
{
  "security": {
    "api-auth": [
      {"type": "oauth2", "authorizeUrl": "https://auth.example.com/authorize", "tokenUrl": "https://auth.example.com/token"},
      {"type": "bearer", "description": "Paste your API key"}
    ]
  }
}
```

### Security method fields

Each security method is an object discriminated on the `type` field:

- `type` (REQUIRED): a string identifying the security method. Well-known types are listed below. Unknown types SHOULD be skipped by clients.
- `description` (OPTIONAL): a human-readable hint for client UIs (e.g., "Paste your API key").

Additional fields depend on the method type.

### Well-known security method types (non-normative)

The following types are documented as guidance. The `type` field is community-driven and extensible -- like format tokens, anyone can define new security method types. SDKs that encounter an unknown type SHOULD skip it and try the next method.

#### `bearer`

The client provides a token directly (API key, pre-shared session token, etc.).

```json
{"type": "bearer", "description": "Enter your API key"}
```

No additional fields beyond `type` and `description`.

#### `oauth2`

OAuth2 Authorization Code + PKCE. The client drives the flow using the provided endpoints.

```json
{
  "type": "oauth2",
  "authorizeUrl": "https://auth.example.com/authorize",
  "tokenUrl": "https://auth.example.com/token",
  "scopes": ["read", "write"],
  "clientId": "example-client"
}
```

Additional fields:

- `authorizeUrl` (REQUIRED for `oauth2`): URL for the OAuth2 authorization endpoint.
- `tokenUrl` (REQUIRED for `oauth2`): URL for the OAuth2 token endpoint.
- `scopes` (OPTIONAL): available OAuth2 scopes.
- `clientId` (OPTIONAL): public OAuth2 client identifier to use in the authorization and token requests. If omitted, the client supplies its own (e.g., from configuration or a registration flow).

#### `basic`

Username and password credentials.

```json
{"type": "basic", "description": "Enter your username and password"}
```

No additional fields beyond `type` and `description`.

#### `apiKey`

A key placed in a specific location (header, query parameter, or cookie).

```json
{"type": "apiKey", "name": "X-API-Key", "in": "header"}
```

Additional fields:

- `name` (REQUIRED for `apiKey`): the name of the header, query parameter, or cookie.
- `in` (REQUIRED for `apiKey`): where the key is sent. One of `header`, `query`, or `cookie`.

### Binding-level security references

Bindings reference security entries by key:

```json
{
  "security": {
    "api-auth": [
      {"type": "bearer"}
    ]
  },
  "bindings": {
    "placeOrder.myapi": {
      "operation": "placeOrder",
      "source": "myapi",
      "ref": "#/paths/~1orders/post",
      "security": "api-auth"
    },
    "getMenu.myapi": {
      "operation": "getMenu",
      "source": "myapi",
      "ref": "#/paths/~1menu/get"
    }
  }
}
```

In this example, `placeOrder` requires authentication (references `api-auth`). `getMenu` has no `security` field -- it is a public endpoint.

### Security and interface creators

Interface creators SHOULD populate the `security` section when the binding format provides security metadata. For example, an OpenAPI interface creator reads `securitySchemes` and per-operation `security` requirements, producing security entries and binding-level references in the OBI.

Formats without security metadata (e.g., gRPC via reflection) MAY produce a default security entry (e.g., `[{"type": "bearer"}]`) when the service is known to require authentication. This is a best-effort inference, not a guarantee.

### Security is optional

The `security` section is entirely optional. An OBI without security is valid. Tools that do not implement security resolution MUST NOT fail on documents that include it -- they SHOULD ignore the `security` section and binding-level `security` fields.

---

## Transforms

Transforms enable OpenBindings interfaces to map between abstract operation schemas and concrete binding schemas. This is essential for implementing standard interfaces without modifying existing APIs. Transforms are not considered during compatibility checking — compatibility is evaluated on operation schemas alone. However, transforms may be required to implement an interface when the underlying binding uses different shapes.

### Motivation

When an existing API implements a standard interface, the API's schema structure may differ from the standard's schema:

- Different field names (`charge_amount` vs `amount`)
- Different nesting (`user.address.city` vs flat `city`)
- Different organization (fields split across path, query, headers, body)

Transforms bridge this gap by defining JSON-to-JSON transformations that map between the abstract interface schema and the concrete binding schema.

### Transform language

OpenBindings v0.1 uses **JSONata** as the transform language.

[JSONata](https://jsonata.org/) is a lightweight query and transformation language for JSON. It is:

- JSON-native (designed specifically for JSON transformation)
- Declarative (expressions describe the output structure)
- Widely implemented (libraries available for JavaScript, Go, Python, Java, and other languages)

Tools that evaluate transforms MUST support transforms with `type` set to `"jsonata"`. Transforms with an unsupported `type` are unresolvable; bindings that depend on unresolvable transforms are not actionable. Implementations SHOULD target [JSONata 2.x](https://docs.jsonata.org/) semantics; if an implementation uses a different major version, it MUST document the version it supports.

Future versions of OpenBindings MAY define additional transform types.

### Transform definition

A transform is an object with the following fields:

- `type` (REQUIRED): The transform language identifier. For v0.1, this MUST be `"jsonata"`.
- `expression` (REQUIRED): The transform expression as a string.

```json
{
  "type": "jsonata",
  "expression": "{ \"charge_amount\": amount, \"currency_code\": currency }"
}
```

### Named transforms (`transforms`)

An OpenBindings document MAY define named transforms in a top-level `transforms` object. Named transforms can be referenced from multiple bindings.

```json
{
  "transforms": {
    "toApiInput": {
      "type": "jsonata",
      "expression": "{ \"charge_amount\": amount, \"currency_code\": currency }"
    },
    "fromApiOutput": {
      "type": "jsonata",
      "expression": "{ \"transactionId\": txn_id, \"status\": result }"
    }
  }
}
```

### Transform references

Bindings MAY reference named transforms using `$ref` with a JSON Pointer:

```json
{
  "inputTransform": { "$ref": "#/transforms/toApiInput" },
  "outputTransform": { "$ref": "#/transforms/fromApiOutput" }
}
```

Alternatively, bindings MAY include inline transform definitions.

### Binding transforms (`inputTransform` / `outputTransform`)

Binding entries MAY include:

- `inputTransform`: Transforms the abstract operation input schema to the binding's expected input structure.
- `outputTransform`: Transforms the binding's output to the abstract operation output schema.

Both fields accept either:

- A transform definition object (`{ "type": "jsonata", "expression": "..." }`)
- A reference object (`{ "$ref": "#/transforms/name" }`)

```json
{
  "bindings": {
    "processPayment.paymentApi": {
      "operation": "processPayment",
      "source": "paymentApi",
      "ref": "POST /charges",
      "inputTransform": {
        "type": "jsonata",
        "expression": "{ \"charge_amount\": amount, \"currency_code\": currency, \"merchant_id\": merchantId }"
      },
      "outputTransform": {
        "$ref": "#/transforms/fromApiOutput"
      }
    }
  }
}
```

### Transform execution flow

When executing an operation via a binding:

1. The caller provides input matching the **operation's input schema** (abstract).
2. If `inputTransform` is present, apply it to produce input matching the **binding source's expected structure** (concrete).
3. The binding executor executes the operation using the transformed input.
4. The binding executor returns output in the **binding source's structure** (concrete).
5. If `outputTransform` is present, apply it to produce output matching the **operation's output schema** (abstract).
6. The caller receives output matching the operation's schema.

Output transforms operate on JSON data delivered by the binding. Where no JSON data is available (network failure, parse error, executor exception, or any other implementation-level error representation), no transform applies and the underlying error surfaces to the caller unchanged. When JSON data is delivered, the transform maps it to the operation's `output` schema, which may include both success and error variants.

If no transform is specified, the input/output is passed through unchanged (1:1 mapping assumed).

### Transform output structure

The transform output MUST be valid JSON. The structure (object, array, scalar) must match what the binding source or operation schema expects.

For input transforms, the binding executor reads the binding source to determine how fields are handled. The transform is responsible only for data shaping, not for specifying protocol-specific details (e.g., HTTP parameter locations, CLI flag syntax). Field handling semantics are defined by the binding format, not by OpenBindings.

Note: Some binding formats may not provide sufficient information for an executor to determine field handling. Such formats may have limited compatibility with OpenBindings transforms. This is a binding format ecosystem concern, not an OpenBindings limitation.

#### Example (HTTP/OpenAPI)

If an OpenAPI operation defines `merchant_id` as a path parameter and `charge_amount` as a body field, the transform outputs:

```json
{ "merchant_id": "m123", "charge_amount": 100 }
```

The OpenAPI binding executor uses the OpenAPI specification to route `merchant_id` to the path and `charge_amount` to the body.

#### Example (CLI/Usage)

If a usage specification defines `--name` as a flag and `<files>` as positional arguments, the transform outputs:

```json
{ "name": "example", "files": ["a.txt", "b.txt"] }
```

The usage binding executor uses the usage specification to route `name` as a flag and `files` as positional arguments.

### Transform errors

If a transform expression fails to evaluate (syntax error, missing field, type error), the operation execution MUST fail. Tools SHOULD surface the transform error with sufficient context for debugging.

### Reusability

Transforms MAY be reused across multiple bindings and operations. If multiple operations share the same schema transformation requirements, they MAY reference the same named transform.

---

## Schema Resolution & Normalization

OpenBindings compatibility checking depends on tools being able to resolve schemas **deterministically**. OpenBindings does not require schemas to live in any particular place (inline vs referenced), but it does require that tools resolve to the same schema when validating compatibility.

This section defines the minimum requirements for schema resolution and normalization.

### Schemas and referenced specs (non-normative)

OpenBindings uses JSON Schema. When you maintain multiple artifacts (OpenBindings + OpenAPI/AsyncAPI/etc.), schemas must remain aligned across them.

Common drift-avoidance strategies include:

- generating all artifacts from a single source of truth
- referencing a shared JSON Schema artifact (bundle or split files)
- manually maintaining multiple artifacts with CI/tooling checks to detect divergence

Using a shared schemas artifact is optional; it can reduce drift by avoiding tool-specific schema extraction/re-encoding between ecosystems.

### Inputs to resolution

An OpenBindings document may reference schemas from:

- **Inline JSON Schema**: schema objects embedded directly in the OpenBindings document.
- **External JSON Schema documents**: `$ref` to a JSON Schema file (one-file bundle or per-schema files).
- **Extracted schemas from referenced specs** (optional): schemas extracted from OpenAPI/AsyncAPI documents _only if_ the extraction is deterministic and the extracted result is valid JSON Schema.

### JSON Schema dialect

OpenBindings uses JSON Schema. A tool claiming OpenBindings support MUST declare which JSON Schema dialect(s) it supports.

If a schema does not declare its dialect explicitly, the tool MUST assume a default dialect for OpenBindings compatibility checking (recommended: JSON Schema 2020-12).

### `$ref` resolution

Tools MUST implement deterministic `$ref` resolution:

- JSON Pointer fragments (`#/...`) MUST be supported.
- Relative references MUST be resolved against the containing document’s location.
- Cycles MUST be detected. This applies at all stages: during initial resolution, during normalization for comparison (e.g., inlining `$ref` targets), and within union variants. A schema containing a cycle MUST be treated as incompatible under this profile (fail closed). Tools SHOULD report the cycle location for debugging.

Base URI guidance (normative):

- If the document was retrieved from a URL, that URL is the base for resolving relative `$ref`s.
- If the document was loaded from a file path, the base is the file URI for that path.
- If the document has no known base (e.g., provided from stdin or an in-memory object), tools MUST treat relative `$ref`s as **outside the profile** (fail closed) unless the tool is explicitly configured with a base.

Tools MAY provide a “bundle” mode that rewrites remote `$ref`s into a single document for portability, but bundling MUST NOT change schema meaning.

### Normalization (for comparison)

To check schema compatibility across artifacts (OpenBindings vs OpenAPI vs AsyncAPI), tools need a stable way to compare schemas.

At minimum, tools SHOULD implement normalization sufficient to avoid false mismatches due to superficial differences, such as:

- object key ordering
- equivalent `$ref` targets
- inlining vs referencing (where safely resolvable)

The spec may define stricter normalization rules over time. For the specific normalization steps required by the v0.1 compatibility profile, see [Normalization (profile v0.1)](#normalization-profile-v01).

### External spec extraction (guidance)

OpenBindings MAY support extracting JSON Schemas from referenced specs (e.g., OpenAPI/AsyncAPI) if and only if:

- the extraction result is deterministic for the declared referenced spec type/version, and
- the extracted schemas can be validated as JSON Schema under the tool’s declared dialect support.

If extraction is not deterministic (or would depend on tool-specific behavior), then referenced specs should be treated as **binding detail only**, and schemas should be sourced from OpenBindings inline schemas or shared schema documents.

---

## Conformance

This section defines minimum requirements for tools that claim OpenBindings support. It does not require tools to support all binding specifications or to be able to make every document actionable.

### Unknown fields

To preserve forward compatibility of the specification:

- Tools MUST ignore unknown fields that are not defined by this specification.
- Tools SHOULD surface diagnostics (warnings) for unknown non-`x-` fields to help catch typos.
- Tools MAY provide a “strict” mode that treats unknown non-`x-` fields as errors.

### Extensions (`x-` fields)

To support clean evolution and vendor/tool metadata:

- OpenBindings documents MAY include extension fields whose keys begin with `x-` at any object location.
- Tools MUST ignore `x-` fields they do not understand.
- `x-` fields MUST NOT change the meaning of the OpenBindings core fields for the purposes of compatibility, binding coverage, or schema profile evaluation.

### Source validation

- Tools MUST validate that each source object contains at least one of `location` or `content`. Sources with neither are invalid.
- Tools SHOULD validate that no source object contains both `location` and `content`, and SHOULD surface a diagnostic when both are present. Tools that proceed despite the diagnostic MUST prefer `content` (per [Sources](#sources)); the embedded content is authoritative and the location is advisory.
- The JSON Schema (`openbindings.schema.json`) permits both fields structurally; these semantic constraints are enforced by tooling and prose.

### Binding specifications

- Tools MUST NOT fail the entire document solely because a binding specification is unsupported.
- Tools MUST ignore bindings whose `sources[*].format` is unsupported (tools MAY surface diagnostics).

### Schema comparison

- Tools MUST implement the **[Fact-generation rules](#fact-generation-rules)** and emit facts per the [Fact categories](#fact-categories-normative) vocabulary.
- Tools MUST emit per-field diagnostic records per the [Diagnostic record format](#diagnostic-record-format-normative).
- Tools MAY emit verdicts derived from facts. Tools that emit verdicts under the name `openbindings.alignment@1.0` MUST implement the [Canonical verdict derivation](#canonical-verdict-derivation-non-normative) exactly. Alternative verdict schemes MUST use a non-`openbindings.` prefix.
- Schemas that use features outside the profile MUST produce `undecidable` facts for the affected fields.

### Conformance test suite

The `reference-tests/` directory (sibling to this document) ships a test suite exercising the reference-tool behaviors described here. The suite contains JSON fixture files that define expected outcomes for:

- **Schema comparison** (`schema-comparison.json`): input/output directional compatibility for every comparison rule in the profile.
- **Normalization** (`normalization.json`): canonical forms, `allOf` flattening, annotation stripping, and `$ref` cycle detection.
- **Operation matching** (`operation-matching.json`): primary key, alias, `roles`, and `satisfies` matching; unspecified slot handling; ambiguous match detection.

Tools claiming OpenBindings support SHOULD pass all applicable conformance cases. Each case is self-contained (no external references) and specifies the expected `compatible` boolean or `error` category.

### Transforms

- Tools that execute operations via bindings MUST implement JSONata for transform evaluation.
- Tools that only perform compatibility checking or validation MAY ignore transforms.
- If a transform uses an unsupported `type`, the binding MUST be treated as unresolvable for execution purposes.

## Security Considerations

OpenBindings documents may reference external artifacts and contain executable transform expressions. Tools that process OpenBindings documents MUST consider the following security concerns.

### Artifact fetching

Binding sources reference external artifacts via `location` URIs. Processing untrusted OpenBindings documents introduces risks:

- **Server-side request forgery (SSRF)**: a malicious document could reference internal network URIs (e.g., `http://169.254.169.254/...`, `file:///etc/passwd`) to probe or exfiltrate data from the tool's network context.
- **Resource exhaustion**: a document could reference extremely large artifacts or an unbounded number of binding sources.

Tools MUST NOT automatically fetch arbitrary URIs from untrusted documents without explicit user consent or configuration. Tools SHOULD restrict fetchable URI schemes by default (e.g., allow `https:` only). Tools SHOULD enforce size limits on fetched artifacts and on OBI documents fetched from discovery endpoints; a 16 MB cap is a reasonable default for general-purpose tools.

### Transform evaluation

Transform expressions (JSONata in v0.1) are executable code embedded in OpenBindings documents. Processing transforms from untrusted documents introduces risks:

- **Resource exhaustion**: a malicious expression could consume unbounded CPU or memory.
- **Information disclosure**: depending on the JSONata implementation, expressions might access environment state beyond the intended input.

Tools that evaluate transforms MUST implement execution safeguards:

- **Timeouts**: tools MUST enforce a maximum execution time for transform evaluation.
- **Memory limits**: tools SHOULD enforce memory bounds on transform evaluation.
- **Input isolation**: transform expressions MUST only have access to the operation input/output being transformed. They MUST NOT have access to environment variables, filesystem, network, or other process state.

### Discovery trust

Documents retrieved from `/.well-known/openbindings` are claims by a deployment. Trust in a discovered document depends on the authenticated discovery context, not on the document's contents:

- Tools SHOULD require HTTPS for `/.well-known/openbindings` discovery.
- Tools MUST NOT treat document contents (`name`, `version`) as proof of identity or authenticity (see [Interface identity](#interface-identity-location-based)).
- Document integrity verification (e.g., signatures, checksums) is out of scope for v0.1. Tools MAY implement document signing as an extension.

### Schema processing

JSON Schema processing can introduce risks when handling untrusted schemas:

- **`$ref` cycles**: tools MUST detect and reject cyclic references (see [`$ref` resolution](#ref-resolution)).
- **Deeply nested schemas**: tools SHOULD enforce a maximum recursion depth during schema normalization and comparison to prevent stack exhaustion.
- **External `$ref` targets**: fetching external schema references carries the same SSRF risks as artifact fetching. The same URI restrictions SHOULD apply.

## Versioning

OpenBindings documents have two distinct version concepts:

| Field          | Meaning                                                         | Example   |
| -------------- | --------------------------------------------------------------- | --------- |
| `openbindings` | OpenBindings format/spec version (“how to parse this document”) | `"1.0.0"` |
| `version`      | Interface contract version (“what does this interface promise”) | `"1.2.0"` |

### `openbindings` (spec version)

`openbindings` identifies the OpenBindings document format version. The value MUST be a [Semantic Versioning 2.0.0](https://semver.org/) string (e.g., `"0.1.0"`, `"1.0.0"`). Tooling MUST refuse to parse documents that declare a higher major version than it supports.

Within the same major version:

- new versions may add optional fields
- existing fields MUST NOT change meaning
- existing fields MUST NOT be removed

### `version` (contract version)

`version` is OPTIONAL. When present, it is the version of the interface contract: the meaning of operations and schemas.

- If `version` is omitted, the interface is unversioned. Tooling MUST NOT assume a default version; it SHOULD treat the interface as a single, evolving snapshot.
- If `version` is present, it SHOULD follow [Semantic Versioning](https://semver.org/) conventions:
  - breaking changes to operation meanings/schemas MUST bump major version
  - additive changes MAY bump minor/patch

### Bindings and versioning

Bindings (via `sources` + binding entries that reference them) are an OpenBindings feature. Documents that use bindings SHOULD set `openbindings` to a version that declares support for them.

Tooling MAY warn if:

- a binding reference is present but cannot be resolved
- a binding reference points to a mismatched operation or schema shape

## End-to-End Example (non-normative)

This section walks through a complete example: a published interface, a discovered interface that claims compatibility, and the compatibility + actionability checks a tool would perform.

### Scenario

A community publishes a **Task Manager** interface defining three operations: creating a task, listing tasks, and receiving notifications when a task is completed. A deployment at `tasks.acme.com` claims to implement this interface via an OpenAPI binding. Its operation schemas use different field names than the target interface, and its underlying API uses yet another set of field names internally — transforms in the bindings bridge the OBI's operation schemas to the API.

### Target interface (published, unbound)

This is the community-published contract. It has no bindings — it defines only operations and schemas.

```json
{
  "openbindings": "0.1.0",
  "name": "Task Manager",
  "version": "1.0.0",
  "schemas": {
    "Task": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string", "minLength": 1, "maxLength": 255 },
        "status": { "type": "string", "enum": ["pending", "in_progress", "done"] },
        "priority": { "type": "integer", "minimum": 1, "maximum": 5 }
      },
      "required": ["id", "title", "status"]
    },
    "TaskInput": {
      "type": "object",
      "properties": {
        "title": { "type": "string", "minLength": 1, "maxLength": 255 },
        "priority": { "type": "integer", "minimum": 1, "maximum": 5 }
      },
      "required": ["title"]
    },
    "TaskFilter": {
      "type": "object",
      "properties": {
        "status": { "type": "string", "enum": ["pending", "in_progress", "done"] },
        "limit": { "type": "integer", "minimum": 1, "maximum": 100 }
      }
    }
  },
  "operations": {
    "tasks.create": {
      "description": "Create a new task.",
      "input": { "$ref": "#/schemas/TaskInput" },
      "output": { "$ref": "#/schemas/Task" }
    },
    "tasks.list": {
      "description": "List tasks with optional filters.",
      "idempotent": true,
      "input": { "$ref": "#/schemas/TaskFilter" },
      "output": {
        "type": "object",
        "properties": {
          "items": {
            "type": "array",
            "items": { "$ref": "#/schemas/Task" }
          }
        },
        "required": ["items"]
      }
    },
    "tasks.completed": {
      "description": "Emitted when a task is marked done.",
      "output": { "$ref": "#/schemas/Task" }
    }
  }
}
```

### Candidate interface (discovered, bound)

This is what `tasks.acme.com` serves at `/.well-known/openbindings`. It declares the Task Manager role and claims to satisfy its operations. Note:

- The OBI's operation schemas use `task_name` and `urgency`, while the underlying Acme REST API uses `name` and `prio` internally — transforms in the bindings bridge this gap.
- `tasks.list` accepts an additional optional `offset` parameter (the candidate accepts more input than the interface requires — compatible).
- The `tasks.completed` operation has no output schema (unspecified — the slot will be skipped during comparison).
- The operation `tasks.create` uses `satisfies` to explicitly map to the target interface.
- The operation `task.list` uses `aliases` to match the target's `tasks.list`.

```json
{
  "openbindings": "0.1.0",
  "name": "Acme Task Service",
  "version": "2.1.0",
  "roles": {
    "taskmanager": "https://interfaces.example.com/task-manager/v1.json"
  },
  "schemas": {
    "AcmeTask": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "task_name": { "type": "string", "minLength": 1, "maxLength": 500 },
        "status": { "type": "string", "enum": ["pending", "in_progress", "done", "archived"] },
        "urgency": { "type": "integer", "minimum": 0, "maximum": 10 }
      },
      "required": ["id", "task_name", "status"]
    },
    "AcmeTaskInput": {
      "type": "object",
      "properties": {
        "task_name": { "type": "string", "minLength": 1, "maxLength": 500 },
        "urgency": { "type": "integer", "minimum": 0, "maximum": 10 }
      },
      "required": ["task_name"]
    },
    "AcmeTaskFilter": {
      "type": "object",
      "properties": {
        "status": { "type": "string", "enum": ["pending", "in_progress", "done", "archived"] },
        "limit": { "type": "integer", "minimum": 1, "maximum": 200 },
        "offset": { "type": "integer", "minimum": 0 }
      }
    }
  },
  "transforms": {
    "inputToApi": {
      "type": "jsonata",
      "expression": "{ \"name\": task_name, \"prio\": urgency }"
    },
    "outputFromApi": {
      "type": "jsonata",
      "expression": "{ \"id\": id, \"task_name\": name, \"status\": status, \"urgency\": prio }"
    }
  },
  "operations": {
    "tasks.create": {
      "description": "Create a new task in the Acme system.",
      "satisfies": [
        { "role": "taskmanager", "operation": "tasks.create" }
      ],
      "input": { "$ref": "#/schemas/AcmeTaskInput" },
      "output": { "$ref": "#/schemas/AcmeTask" }
    },
    "task.list": {
      "description": "List tasks with optional filters.",
      "idempotent": true,
      "aliases": ["tasks.list"],
      "input": { "$ref": "#/schemas/AcmeTaskFilter" },
      "output": {
        "type": "object",
        "properties": {
          "items": {
            "type": "array",
            "items": { "$ref": "#/schemas/AcmeTask" }
          }
        },
        "required": ["items"]
      }
    },
    "tasks.completed": {
      "description": "Emitted when a task is marked done."
    }
  },
  "sources": {
    "acmeApi": {
      "format": "openapi@3.1",
      "location": "./openapi.json"
    }
  },
  "bindings": {
    "tasks.create.acmeApi": {
      "operation": "tasks.create",
      "source": "acmeApi",
      "ref": "#/paths/~1tasks/post",
      "inputTransform": { "$ref": "#/transforms/inputToApi" },
      "outputTransform": { "$ref": "#/transforms/outputFromApi" }
    },
    "task.list.acmeApi": {
      "operation": "task.list",
      "source": "acmeApi",
      "ref": "#/paths/~1tasks/get",
      "outputTransform": {
        "type": "jsonata",
        "expression": "{ \"items\": items.{ \"id\": id, \"task_name\": name, \"status\": status, \"urgency\": prio } }"
      }
    }
  }
}
```

### Schema comparison walkthrough

A tool compares the Acme Task Service (candidate \(D\)) with the Task Manager interface (target \(I\)) and produces per-field facts plus a document-level verdict.

#### Step 1: Operation matching

| Target operation | Match type | Candidate operation | Result |
|---|---|---|---|
| `tasks.create` | `satisfies` (explicit) | `tasks.create` | matched |
| `tasks.list` | `aliases` (fallback) | `task.list` (alias: `tasks.list`) | matched |
| `tasks.completed` | key match | `tasks.completed` | matched |

All three operations match. No ambiguities.

#### Step 2: Fact generation

**`tasks.create` — input**

Comparing `TaskInput` (target) vs `AcmeTaskInput` (candidate):

- `type`: both `"object"` → `covered`.
- `required`: target requires `["title"]`, candidate requires `["task_name"]`. `required(D) = ["task_name"]` is NOT a subset of `required(I) = ["title"]`. D requires a property I does not, so D rejects inputs I would accept. → `contradicts` on keyword `required`.

**`tasks.create` — output**

Comparing `Task` (target) vs `AcmeTask` (candidate):

- `type`: both `"object"` → `covered`.
- `required`: target requires `["id", "title", "status"]`, candidate requires `["id", "task_name", "status"]`. `title` is required by I but not by D; D may emit responses without `title`, which I forbids. → `contradicts` on keyword `required`.

**`tasks.list` — input**

Comparing `TaskFilter` (target) vs `AcmeTaskFilter` (candidate):

- `type`: both `"object"` → `covered`.
- `required`: both empty → `covered`.
- `properties.status.enum`: target `["pending","in_progress","done"]`, candidate `["pending","in_progress","done","archived"]`. For inputs, D accepts at least what I sends. → `covered`.
- `properties.limit.maximum`: target `100`, candidate `200`. D accepts a wider range than I sends. → `covered` on `maximum`.
- `properties.limit.minimum`: both `1` → `covered`.
- `offset`: D declares this property; I does not declare it. → `silent-by-I` on keyword `properties` at path `/properties/offset`.

Input facts for `tasks.list`: all `covered` except one `silent-by-I`.

**`tasks.list` — output**

Comparing target output vs candidate output:

- `type`: both `"object"` → `covered`.
- `required`: both `["items"]` → `covered`.
- `properties.items.items`: recursive comparison of `Task` vs `AcmeTask` produces the same `required` contradiction as `tasks.create` output, plus:
  - `properties.status.enum`: target `["pending","in_progress","done"]`, candidate `["pending","in_progress","done","archived"]`. D may emit `"archived"` which I forbids. → `contradicts` on keyword `enum`.

**`tasks.completed` — output**

Target defines an output schema (`Task`); candidate has no output schema. → `silent-by-D` for the entire output slot.

#### Facts and verdicts summary

| Operation | Slot | Facts | Per-slot verdict |
|---|---|---|---|
| `tasks.create` | input | 1 `contradicts` (required) | `misaligned` |
| `tasks.create` | output | 1 `contradicts` (required) | `misaligned` |
| `tasks.list` | input | 1 `silent-by-I` (offset), rest `covered` | `partial` |
| `tasks.list` | output | `contradicts` (required, enum) | `misaligned` |
| `tasks.completed` | output | 1 `silent-by-D` | `partial` |

**Document-level verdict** under `openbindings.alignment@1.0`: **`misaligned`** (at least one `contradicts` fact present).

This outcome is honest about what the two documents claim. `tasks.list` inputs align cleanly; the silent `offset` is declared by D only and imposes no contradiction. `tasks.completed` is silent on D's output, which reads as "D didn't commit to a shape" rather than as a conflict. The contradictions on `tasks.create` and `tasks.list.output` are real: D and I declare different required fields and (for list output) different enum ranges, and those declarations cannot both hold for the same JSON value.

The transforms bridge between the candidate's operation schemas and its own API. They do not bridge between the candidate and the target interface, and they are invisible to schema comparison. If the candidate wanted its `openbindings.alignment@1.0` verdict against TaskManager to be `aligned` (or at worst `partial`), the candidate would need to use the target's field names (`title`, `priority`) and enum values in its operation schemas. Its transforms would still bridge those operation schemas to its backend API; what would change is that the operation schemas themselves would stop contradicting the target's declared shape.

A tool that wants a stricter verdict than `openbindings.alignment@1.0` provides can apply its own policy on top of the same facts: a registry may demote `partial` results in ranking; a CI gate may treat `partial` as failure. Those are tool-side policies; the facts themselves are shared across tools.

### Binding coverage check

Separately from compatibility, a tool checks whether the candidate's operations are **actionable** (have resolvable bindings).

| Operation | Binding key | Source resolvable? | Ref resolvable? | Actionable? |
|---|---|---|---|---|
| `tasks.create` | `tasks.create.acmeApi` | yes (if `./openapi.json` is available) | yes | **yes** |
| `task.list` | `task.list.acmeApi` | yes | yes | **yes** |
| `tasks.completed` | (no binding) | — | — | **no** |

**Coverage**: 2 of 3 operations are actionable. `tasks.completed` has no binding — it cannot be invoked via any declared binding source.

### Transform execution flow (for `tasks.create`)

When a caller invokes `tasks.create` via the OpenAPI binding:

1. Caller provides input matching the operation schema (`AcmeTaskInput`): `{ "task_name": "Ship v1", "urgency": 3 }`
2. `inputTransform` applies, bridging to the API's field names: `{ "name": "Ship v1", "prio": 3 }`
3. The OpenAPI binding executor uses the OpenAPI spec to route fields to the HTTP request.
4. The API returns its native structure: `{ "id": "t-42", "name": "Ship v1", "status": "pending", "prio": 3 }`
5. `outputTransform` applies, bridging back to the operation schema (`AcmeTask`): `{ "id": "t-42", "task_name": "Ship v1", "status": "pending", "urgency": 3 }`
6. Caller receives output matching the operation schema.

### Comparison rules and versioning

Fact-generation rules, binding coverage semantics, and resolution requirements must remain stable within a major `openbindings` version. A document format version may introduce new optional fields and add validation guidance, but MUST NOT change the meaning of existing fields within the same major version. Revisions to the canonical verdict derivation (currently `openbindings.alignment@1.0`) are expressed as new scheme versions (`@1.1`, `@2.0`), not as breaking changes to the spec.
