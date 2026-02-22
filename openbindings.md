# OpenBindings Specification — Working Draft (v0.1.0)

This is the **working draft** of the OpenBindings specification, targeting version **0.1.0**. This document is not yet released; see [`RELEASING.md`](RELEASING.md) for the release process.

- This document is licensed under the Apache 2.0 License (see `LICENSE`).
- The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in all capitals.

## Table of contents

- [Overview](#overview)
- [Core Ideas](#core-ideas-non-normative)
- [Discovery](#discovery)
- [Interfaces & Compatibility](#interfaces--compatibility)
- [Bindings](#bindings)
- [Transforms](#transforms)
- [Schema Resolution & Normalization](#schema-resolution--normalization)
- [Conformance](#conformance)
- [Security Considerations](#security-considerations)
- [Versioning](#versioning)
- [End-to-End Example](#end-to-end-example-non-normative)

---

## Overview

OpenBindings is an open-source, **binding-specification-agnostic** interface and discovery format for describing what a service can do in a way that is:

- portable across environments and providers
- reusable across services (interface compatibility)
- bindable to multiple protocols and transports without redefining the contract

OpenBindings centers around **operations** and treats exposures as **bindings**.

The design goal is to separate **meaning** (an interface’s operations + schemas + semantics) from **access** (the bindings/protocols that expose those operations). This keeps interfaces portable across ecosystems while letting binding specifications remain spec-native and evolve independently.

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

### Definitions (Interface, Compatibility, Actionability)

- **Interface**: an operational shape defined by `operations` (and schemas/semantics). Interfaces are reusable regardless of author intent.
- **Unbound interface**: an interface without bindings. Unbound interfaces define the contract (operations + schemas) but do not specify how to access the operations. They are analogous to abstract types in programming languages—they define shape and semantics without concrete implementation details. Unbound interfaces are useful as reusable contracts, templates for composition, and targets for compatibility validation.
- **Bound interface**: an interface with bindings. Bound interfaces are actionable—tools can construct concrete interaction targets for the operations. A discovered interface (from `/.well-known/openbindings`) is typically bound.
- **Compatibility**: whether a **candidate interface** is compatible with a **target interface** under the rules in [Compatibility](#compatibility). Compatibility depends on operation matching, `kind`, and schema comparison—not on bindings. Compatibility checking does not guarantee runtime interoperability.
- **Actionability**: whether a tool can construct concrete interaction targets for an interface in a given context. Actionability depends on bindings being present and **resolvable** (and on the tool supporting the referenced `format`s). See [Binding coverage (actionability)](#binding-coverage-actionability).
- **Delegate**: a tool or service that implements an OpenBindings interface contract to receive delegated work. The reference implementation delegates binding format handling to **binding format handler** delegates, but the pattern extends to any delegatable concern. See the `interfaces/` directory for published delegate contracts.
- **OBI**: shorthand for “OpenBindings interface” (used sparingly).

### Project-published interfaces (non-normative)

The OpenBindings project publishes a set of **unbound interfaces** for interoperability and development velocity (e.g., the binding format handler interface, the software contract).

- These interfaces are not required by the core spec.
- Each is a normal OpenBindings document, intended for composition or binding like any other interface.
- As unbound interfaces, they define the contract without specifying bindings. Implementations compose these and add their own bindings to make them actionable.

See `interfaces/` for the current set.

## Core Ideas (non-normative)

### Operations are the contract

An OpenBindings document defines a set of **operations**. An operation is a named unit of behavior or emission.

- **`kind: "method"`**: something a caller invokes (request → response)
- **`kind: "event"`**: something a service emits (server → consumers)

Operations are where you define:

- **names** (stable identity)
- **schemas** for inputs/outputs/payloads (canonical data model)
- **idempotency** (for `kind: "method"` operations)
- documentation metadata (description, deprecated, etc.)

Operations MAY also declare `aliases` and `satisfies` to support renames and deterministic compatibility mapping when composing or implementing community-driven interfaces (see [Interfaces & Compatibility](#interfaces--compatibility)).

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

Other discovery mechanisms (registries, configuration, service meshes, package distribution, etc.) MAY be used. Standardization of non-HTTP discovery conventions is out of scope for v0.1.

OpenBindings does not define (or privilege) any “official” registry. Anyone may operate a registry or publish a collection of interfaces. Trust in a registry (or in any published interface set) is an external policy decision, not something the spec can determine.

### Tooling note: synthesized OpenBindings views (non-normative)

Tools MAY synthesize an OpenBindings interface view from other artifacts (e.g., OpenAPI, AsyncAPI, protobuf descriptors) in order to evaluate compatibility, detect drift, or bootstrap adoption in ecosystems that already publish other binding specifications.

Such synthesized views:

- are a tool-side projection, not an authoritative statement by a service
- do not confer identity or trust (trust decisions remain tied to authenticated discovery context)
- may be partial (e.g., OpenAPI-only sources cannot express `kind: "event"` operations)

### Interface identity (location-based)

An OpenBindings interface is identified by its **location**: the URL or path where the document can be retrieved. There is no separate `id` field — the location IS the identity.

- The **discovery address** is where you fetch the document (e.g., the origin that serves `/.well-known/openbindings`).
- The document's location (URL or file path) is its canonical identity for references, deduplication, and compatibility.
- The optional `name` field provides a human-friendly label but is not an identifier.

Recommended conventions:

- Published interfaces SHOULD be hosted at stable, versioned URLs (e.g., `https://interfaces.example.com/task-manager/v1.json`). Since interface URLs are not snapshots, versioned URLs ensure that consumers referencing the interface get a stable contract.
- Discovery addresses (the origin serving `/.well-known/openbindings`) are the identity of a discovered interface.
- Trust in an interface depends on the authenticated discovery context or the trust placed in the hosting location, not on the document's contents.


### Registries and interface catalogs (non-normative)

Tools and ecosystems may use registries/catalogs to distribute and discover published interfaces. OpenBindings intentionally does not specify registry governance or trust: different environments may use different registries, and consumers choose which to trust.

Relationship to other fields:

- `imports` values reference other interfaces by URL or relative path (see [`imports`](#imports-import-table)).
- `satisfies[*].interface` references a key in the document’s `imports` map.

### Published vs discovered interfaces

In practice, the same OpenBindings interface can be either **published** (as a reusable contract) or **discovered** (served by a deployment). Practically, tools often care about two checks:

- **Compatibility**: the interface defines compatible operations and schemas relative to a target interface (see [Compatibility](#compatibility)).
- **Actionability**: the interface provides **binding coverage** for the operations you intend to invoke/subscribe to (see [Bindings](#bindings)).

### Actionability

A document retrieved from `/.well-known/openbindings` is a **discovered interface** and is intended to be actionable:

- it SHOULD provide binding coverage for the operations it claims (see [Bindings](#bindings))
- its bindings MUST resolve using the document + discovery context (see below)

---

## Interfaces & Compatibility

An **interface** is a reusable contract: a named set of operations that services can implement. Interfaces enable interoperability: if two services implement the same interface, clients can target the interface rather than a specific service.

This document defines how interface compatibility works under the **operations** model.

### Interface Structure

An interface document contains:

- **metadata**: `openbindings` (required), `name` (optional), `version` (optional), `description` (optional), plus optional `contact`, `license`
- **schemas** (optional but recommended): canonical JSON Schemas used by operations. See [Schemas](#schemas) below.
- **operations** (required): the contract surface area
- **sources** (optional): registry of binding artifacts (only needed if using bindings)
- **bindings** (optional): may exist, but interfaces SHOULD remain useful without them

Minimal document shape (non-normative):

```json
{
  "openbindings": "0.1.0",
  "name": "Log Service",
  "version": "1.2.0",
  "schemas": {},
  "operations": {},
  "sources": {},
  "bindings": {}
}
```

### Schemas

`schemas` is an optional top-level map of named JSON Schemas. Each key is a schema name; each value is a JSON Schema object.

Operations reference these schemas via `$ref` pointers (e.g., `{ "$ref": "#/schemas/Task" }`). Schemas defined here are the canonical data model for the interface — they are what compatibility checking evaluates.

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

### Operations: Discriminated Union

Operations are stored in a single registry:

```json
{
  "operations": {
    "health.check": {
      "kind": "method",
      "idempotent": true,
      "input": { "type": "object" },
      "output": { "$ref": "#/schemas/HealthStatus" }
    },
    "log.created": {
      "kind": "event",
      "payload": { "$ref": "#/schemas/LogEntry" }
    }
  }
}
```

### Common operation fields

All operations (regardless of `kind`) support:

- `kind` (REQUIRED): `"method"` or `"event"`.
- `description` (OPTIONAL): a human-readable description of the operation.
- `deprecated` (OPTIONAL): if `true`, the operation is deprecated and consumers SHOULD migrate to an alternative. Deprecation is documentation metadata; it MUST NOT affect compatibility checking or binding resolution.
- `tags` (OPTIONAL): an array of string labels for grouping and filtering. Tags are documentation metadata; they MUST NOT affect compatibility checking or binding resolution. Consumers and tooling MAY use tags for display grouping, search, and filtering.
- `aliases` (OPTIONAL): alternate names for compatibility matching. See [Operation matching](#operation-matching-aliases-and-satisfies).
- `satisfies` (OPTIONAL): explicit conformance mappings to other interfaces. See [Operation matching](#operation-matching-aliases-and-satisfies).
- `examples` (OPTIONAL): named examples. See [Operation examples](#operation-examples).

### Method-kind operations

`kind: "method"` operations MAY additionally define:

- `idempotent?: boolean` — whether calling the operation multiple times with the same input produces the same effect as calling it once. See [Idempotency](#idempotency) below.
- `input?: JSONSchema`
- `output?: JSONSchema`

#### Idempotency

`idempotent` is a declarative hint that indicates whether a method operation is safe to retry without side effects. When `true`, calling the operation multiple times with the same input produces the same result and the same observable state as calling it once.

`idempotent` is **metadata**, not a normative constraint:

- `idempotent` MUST NOT affect compatibility checking. Two operations with identical schemas are equally compatible regardless of their `idempotent` values.
- `idempotent` MUST NOT affect binding resolution, transform evaluation, or any other normative behavior.
- Tools MAY use `idempotent` for operational decisions such as automatic retries, caching, or safety warnings. For example, a tool might auto-retry a failed `idempotent: true` operation but prompt before retrying an operation where `idempotent` is `false` or absent.
- If omitted, no idempotency assumption is made. Tools SHOULD treat the operation as potentially non-idempotent.

`idempotent` is not applicable to `kind: "event"` operations. Events are emissions, not invocations; delivery semantics are a binding-level concern.

### Event operations

`kind: "event"` operations MAY define:

- `payload?: JSONSchema`

Delivery semantics (ordering, acknowledgment, at-least-once vs at-most-once) are binding-level concerns and are outside the scope of the operation definition.

### Operation examples

Any operation MAY include an `examples` field containing named examples:

- `examples?: Record<string, OperationExample>`

Each example MAY include:

- `description?: string` — human-readable description of the example
- `input?` — example input value (method operations; SHOULD validate against the operation's `input` schema)
- `output?` — example output value (method operations; SHOULD validate against the operation's `output` schema)
- `payload?` — example payload value (event operations; SHOULD validate against the operation's `payload` schema)

Examples are documentation. They MUST NOT affect compatibility checking, binding resolution, or any other normative behavior.

### Omitted schemas

For `input`, `output`, and `payload`, the following forms are semantically identical and MUST be treated equivalently by implementations:

- Key absent (e.g., no `output` field in the operation)
- Key present with value `null`

All mean "unspecified." The operation may still accept input or produce output at runtime; the schema is simply undocumented.

Note: `{}` (empty schema) is NOT equivalent to absent/null. In JSON Schema, `{}` is a valid schema that accepts any JSON value. An omitted schema means "not documented"; `{}` means "documented as accepting anything."

For compatibility checking: if either the target or candidate has an unspecified schema for a given slot (`input`, `output`, `payload`), that slot is skipped and reported as unspecified. No inference is made.

> **Note — Unique field names:** Operation inputs, outputs, and payloads are JSON objects, so field names must be unique. If a binding source uses the same name in multiple locations (e.g., `id` as both a path parameter and a body field), the operation schema cannot distinguish them. Well-designed APIs typically avoid reusing field names across different protocol locations. If this limitation is encountered, consider adjusting the binding source design or using provider-specific workarounds.

### Compatibility

Compatibility checking compares the documentation of two OpenBindings interfaces. It does not guarantee runtime interoperability — an OBI is a claim about what software does, and claims can be incorrect or incomplete. Compatibility checking evaluates whether the claims are compatible.

Compatibility is evaluated between:

- a **candidate** interface \(D\), and
- a **target** interface \(I\).

Bindings do not affect compatibility: they only affect whether an interface is **actionable** against a particular deployment (see [Binding coverage (actionability)](#binding-coverage-actionability)).

Compatibility and actionability are independent assessments that answer different questions:

- **Compatibility** asks: do the candidate's operation schemas match the target's operation schemas under the profile rules? A "compatible" result means a client built against the target's schema shapes can trust the candidate's shapes.
- **Actionability** asks: does the candidate have resolvable bindings that let a tool construct concrete interaction targets? An "actionable" result means a client can call the candidate's operations.

A candidate can be compatible but not actionable (schemas match, but no bindings are present). A candidate can be actionable but not compatible (bindings resolve and transforms bridge the underlying API, but the operation schemas use different shapes — for example, different field names or naming conventions). Both combinations are normal. "Incompatible" is informational: it means structural confidence cannot be established from the schemas alone, not that the candidate is broken or unusable.

Compatibility checking produces a **report**, not a binary verdict. For each operation in \(I\), the report MUST convey:

- whether a matching operation exists in \(D\)
- whether the `kind` matches
- for each schema slot (`input`, `output`, `payload`): whether the schemas are **compatible**, **incompatible**, or **unspecified** (one or both sides omitted)

The semantic content of the report is defined by this spec. The serialization format and presentation of the report are tool-specific; OpenBindings does not define a standard report schema.

An interface \(D\) is **compatible** with an interface \(I\) if:

- for every operation in \(I\), \(D\) defines a matching operation (see below)
- \(D\)’s operation schemas are compatible with \(I\)’s schemas (per the [Schema Comparison Rules](#schema-comparison-rules) in this document)
- \(D\) preserves the operation’s `kind` (method stays method; event stays event)
- no schema comparisons resulted in incompatibility (unspecified slots are skipped, not treated as incompatible)

### Name identity

Within a single OpenBindings document, operation keys under `operations` MUST be unique.

Across documents, interoperability is driven by the target interface’s operation keys. If two interfaces define the same operation key with different meaning, they are not interoperable unless one explicitly adapts to the other (see `aliases` / `satisfies`).

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

- `satisfies?: Array<{ interface: string; operation: string }>`

Where:

- `interface` is an import key referencing an entry in the document’s `imports` map (see [`imports`](#imports-import-table))
- `operation` is the target operation identifier within that interface, expressed as either the target operation’s primary key or one of its aliases

Rules:

- `satisfies[*].interface` MUST reference a key that exists in the document’s `imports` map.
- Tools MUST resolve `satisfies[*].operation` against the referenced interface’s operation keys first, then aliases.
- If resolution matches multiple target operations, that is an error (ambiguous).
- Tools MUST honor `satisfies` mappings when present.

#### Matching algorithm (deterministic)

When checking whether a document `D` is compatible with interface `I`, tools MUST evaluate each required operation key `op` in `I` as follows:

- **Explicit match (preferred)**: any operation in `D` that declares `satisfies: [{ interface: <importKey>, operation: opOrAlias }]` where `D.imports[importKey]` resolves to the location of `I`, and `opOrAlias` resolves to `op`
- **Fallback match**: if no explicit match exists, any operation in `D` whose primary key is `op` or whose `aliases` contain `op`

The match MUST be unique:

- 0 matches → unmatched (operation not provided by the candidate; see [Interface conformance](#interface-conformance) for partial conformance)
- 1 match → proceed to kind + schema comparison checks
- > 1 matches → error: ambiguous compatibility mapping

### Schema Comparison Rules

Two schemas are **compatible** under this spec when all applicable comparison rules (defined below) pass. Two schemas are **incompatible** when any rule fails. A schema slot is **unspecified** when either the target or candidate omits the schema (absent or `null`); unspecified slots are skipped, not treated as incompatible.

Schema comparison MUST be spec-defined and tool-independent. A tool claiming OpenBindings support MUST implement deterministic schema resolution/normalization (see [Schema Resolution & Normalization](#schema-resolution--normalization)) and apply the comparison rules defined in this section.

**Transitivity**: compatibility under this profile is transitive. If interface \(A\) is compatible with interface \(B\), and \(B\) is compatible with interface \(C\), then \(A\) is compatible with \(C\). This holds because every comparison rule in the profile is a structural subset/superset check, and set inclusion is transitive. Transitivity enables decoupled schema evolution: a change can be validated against the previous version of an interface without re-checking all consumers.

#### Directionality

Schema comparison is directional. In the rules below, \(I\) refers to the target interface’s schema and \(D\) refers to the candidate’s schema.

- **Input comparison**: checks that \(D\) covers what \(I\) describes (\(D\) may accept more).
- **Output/Payload comparison**: checks that \(D\) stays within what \(I\) describes (\(D\) may return less).

#### Profile scope (v0.1)

This spec defines a **conservative, deterministic** compatibility relation for a **restricted subset** of JSON Schema keywords. It is **not** a general JSON Schema subschema/containment checker. Schemas using keywords outside this profile MUST be treated as incompatible under this profile (fail closed).

Note (non-normative): this profile is not a JSON Schema vocabulary or dialect. It does not restrict which keywords are valid in operation schemas — any valid JSON Schema 2020-12 schema is a valid operation schema. The profile only defines which keywords the compatibility comparison engine can reason about. Tools MAY publish a meta-schema for the profile's keyword subset as a convenience for validating that schemas will be fully evaluable, but this is not required.

Normatively:

- Tools claiming OpenBindings support MUST implement this profile for compatibility checks.
- If a schema uses keywords outside this profile, a tool MUST **fail closed**: it MUST NOT report the schemas as compatible.

##### Dialect and `$schema`

- The default dialect for this profile is **JSON Schema 2020-12**.
- If a schema declares `$schema` and it is not JSON Schema 2020-12, tools MUST treat that schema as **outside the profile** unless the tool explicitly supports that dialect and can guarantee identical behavior for the keywords used.

##### Supported keyword subset

The following keywords are in-scope for deterministic compatibility:

- **Structural / composition**: `$ref`, `$defs`, `allOf`
- **Type/value**: `type`, `enum`, `const`
- **Objects**: `properties`, `required`, `additionalProperties` (boolean or schema)
- **Arrays**: `items`
- **Unions**: `oneOf`, `anyOf`
- **Numeric bounds**: `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`
- **String bounds**: `minLength`, `maxLength`
- **Array bounds**: `minItems`, `maxItems`

All other validation keywords are outside the v0.1 profile (including, but not limited to: `not`, `if`/`then`/`else`, `patternProperties`, `unevaluatedProperties`, `dependentSchemas`, `contains`, `prefixItems`, `propertyNames`, `format`, `pattern`, `multipleOf`, `uniqueItems`).

Annotation-only keywords (e.g., `title`, `description`, `examples`, `default`, `deprecated`, `readOnly`, `writeOnly`) MUST be ignored for compatibility decisions.

#### Normalization (profile v0.1)

Before performing compatibility checks, tools MUST normalize schemas deterministically:

- **Canonical JSON string**: when this profile refers to a “canonical JSON string”, it means RFC 8785 (JSON Canonicalization Scheme, JCS) applied to the normalized schema value. See [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785).
- **Resolve `$ref`** deterministically (per [`$ref` resolution](#ref-resolution)).
- **Inline `$ref` targets** for the purpose of comparison (tools may cache resolved targets, but evaluation MUST be equivalent to inlining).
- **Canonicalize keyword forms**:
  - Normalize `type` to a sorted array of strings (e.g., `"string"` → `["string"]`).
  - Normalize `required` to a sorted array of unique strings.
- **Canonicalize union ordering**:
  - For `oneOf`/`anyOf`, normalize each variant, then sort variants by the canonical JSON string (RFC 8785 JCS) of the normalized variant.
- **Flatten `allOf`**: resolve `allOf` arrays by merging all branches into a single schema before comparison. The merge rules are:
  - `type`: intersection of allowed types. Empty intersection is a schema error.
  - `properties`: union of all property keys. For keys appearing in multiple branches, merge their schemas recursively (apply `allOf` flattening).
  - `required`: union of all required arrays.
  - `additionalProperties`: if any branch is `false`, the result is `false`. If multiple branches define schemas, merge them recursively. If a branch is `false` and another branch defines properties not covered by any branch with `false`, that is a schema error.
  - `enum` / `const`: intersection of allowed values. Empty intersection is a schema error.
  - `items`: if multiple branches define `items`, merge them recursively.
  - Numeric/string/array bounds (`minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `minLength`, `maxLength`, `minItems`, `maxItems`): take the most restrictive value from all branches (highest minimum, lowest maximum).
  - `oneOf` or `anyOf` inside `allOf`: if any `allOf` branch contains `oneOf` or `anyOf`, the schema MUST be treated as outside the profile (fail closed). Computing the intersection of unions is combinatorial and not deterministically tractable in the general case.
  - If any branch contains keywords outside the profile, the schema MUST be treated as outside the profile (fail closed).
  - If merging produces an irreconcilable conflict (e.g., no type overlap, empty enum intersection), the schema MUST be treated as a schema error.

#### Comparison rules (profile v0.1)

The rules below apply after normalization. Note that `allOf` is resolved during normalization (flattened into a single schema), so it does not appear as a comparison rule — by the time comparison runs, no `allOf` keywords remain.

##### Trivial schemas

- `{}` (empty schema) accepts any JSON value.

Rules:

- Inputs: \(D\) is `{}` → always compatible (candidate accepts anything).
- Outputs: \(D\) is `{}` → compatible only if \(I\) is also `{}`.

##### `type`

Treat `type` as a set of allowed JSON types. If `type` is absent from a schema, it is treated as unconstrained (all JSON types are allowed), equivalent to `type: ["array","boolean","integer","null","number","object","string"]`.

- Inputs: every type in \(I\) MUST also be in \(D\) (candidate accepts at least what the interface describes).
- Outputs: every type in \(D\) MUST also be in \(I\) (candidate only returns types the interface describes).

##### `const` / `enum`

- Inputs:
  - If \(I\) uses `const`, \(D\) MUST accept that constant.
  - If \(I\) uses `enum`, \(D\) MUST accept all values in that enum (candidate enum may be a superset).
- Outputs:
  - If \(I\) uses `enum`, \(D\) MUST only allow values within that enum (candidate enum must be a subset).
  - If \(I\) uses `const`, \(D\) MUST only allow that constant.

##### Objects (`properties`, `required`, `additionalProperties`)

These rules apply when `type` includes `object` (and no unsupported keywords are present).

- Inputs:
  - `required(D)` MUST be a subset of `required(I)` (candidate MUST NOT require more than the interface).
  - For each property key \(p\) in `properties(I)`:
    - If \(D\) declares `properties(D)[p]`, then the input comparison rule MUST hold recursively.
    - If \(D\) does not declare the property, it is treated as unconstrained (compatible).
  - \(D\) may accept additional properties beyond those described by \(I\).

- Outputs/Payloads:
  - `required(I)` MUST be a subset of `required(D)` (candidate MUST provide all fields the interface promises).
  - For each property key \(p\) present in both `properties(I)` and `properties(D)`:
    - The output comparison rule MUST hold recursively.
  - For each property key \(p\) in `properties(D)` not present in `properties(I)`:
    - `additionalProperties(I)` MUST NOT be `false`.
  - `additionalProperties` constraint (absent `additionalProperties` is treated as unconstrained, equivalent to `true`):
    - If `additionalProperties(I)` is `false`, then `additionalProperties(D)` MUST be `false`.
    - If `additionalProperties(I)` is a schema, then `additionalProperties(D)` (if a schema) MUST satisfy the output comparison rule recursively. If `additionalProperties(D)` is `false`, that is more restrictive and is allowed.

##### Arrays (`items`)

These rules apply when `type` includes `array` (and no unsupported keywords are present).

- Inputs: the input comparison rule MUST hold for `items(I)` vs `items(D)`.
- Outputs: the output comparison rule MUST hold for `items(I)` vs `items(D)`.

##### Numeric bounds (`minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`)

These rules apply when `type` includes `number` or `integer`. Absent bounds mean unconstrained (no limit).

- Inputs:
  - If \(I\) declares a lower bound, \(D\)'s lower bound MUST be less than or equal to \(I\)'s (candidate accepts values at least as low).
  - If \(I\) declares an upper bound, \(D\)'s upper bound MUST be greater than or equal to \(I\)'s (candidate accepts values at least as high).
  - If \(D\) has no bound where \(I\) has one, \(D\) is unconstrained on that side (compatible).
- Outputs:
  - If \(I\) declares a lower bound, \(D\)'s lower bound MUST be greater than or equal to \(I\)'s (candidate returns values no lower than the interface promises).
  - If \(I\) declares an upper bound, \(D\)'s upper bound MUST be less than or equal to \(I\)'s (candidate returns values no higher than the interface promises).
  - If \(D\) has no bound where \(I\) has one, \(D\) is unconstrained and therefore incompatible (candidate may return values outside the interface's range).

When comparing bounds, `exclusive` variants are strictly stronger than their non-exclusive counterparts (e.g., `exclusiveMinimum: 0` is stricter than `minimum: 0`).

##### String bounds (`minLength`, `maxLength`)

These rules apply when `type` includes `string`. Absent bounds mean unconstrained.

- Inputs:
  - `minLength(D)` MUST be ≤ `minLength(I)` (candidate accepts strings at least as short). Absent `minLength(D)` is unconstrained (compatible).
  - `maxLength(D)` MUST be ≥ `maxLength(I)` (candidate accepts strings at least as long). Absent `maxLength(D)` is unconstrained (compatible).
- Outputs:
  - `minLength(D)` MUST be ≥ `minLength(I)` (candidate returns strings no shorter than the interface promises). Absent `minLength(D)` when `minLength(I)` is present is incompatible.
  - `maxLength(D)` MUST be ≤ `maxLength(I)` (candidate returns strings no longer than the interface promises). Absent `maxLength(D)` when `maxLength(I)` is present is incompatible.

##### Array bounds (`minItems`, `maxItems`)

These rules apply when `type` includes `array`. Absent bounds mean unconstrained. The rules follow the same pattern as string bounds:

- Inputs:
  - `minItems(D)` MUST be ≤ `minItems(I)`. Absent is unconstrained (compatible).
  - `maxItems(D)` MUST be ≥ `maxItems(I)`. Absent is unconstrained (compatible).
- Outputs:
  - `minItems(D)` MUST be ≥ `minItems(I)`. Absent when \(I\) has a bound is incompatible.
  - `maxItems(D)` MUST be ≤ `maxItems(I)`. Absent when \(I\) has a bound is incompatible.

##### Unions (`oneOf` / `anyOf`)

Treat `oneOf`/`anyOf` as a set of variants for comparison purposes.

- Inputs:
  - For every variant \(v\) in \(I\), there MUST exist at least one variant \(w\) in \(D\) such that the input comparison rule holds for \(v\) vs \(w\).
- Outputs:
  - For every variant \(w\) in \(D\), there MUST exist at least one variant \(v\) in \(I\) such that the output comparison rule holds for \(v\) vs \(w\).

##### Keyword combinations

When a schema uses multiple in-profile keywords (e.g., `properties` alongside `oneOf`, or `type` alongside `enum`), each keyword's comparison rule is evaluated independently. All applicable rules MUST pass for the schemas to be compatible. If any rule fails, the schemas are incompatible.

### `imports` (import table)

An interface MAY declare that it references other interfaces via `imports`:

```json
{
  "imports": {
    "oauth2": "https://interfaces.example.com/oauth2/v1.json",
    "oidc": "https://interfaces.example.com/oidc/v1.json"
  }
}
```

`imports` is a key-value map where:

- Each **key** is a local alias used within this document (referenced by `satisfies[*].interface`)
- Each **value** is a URL or relative path to another OpenBindings interface document

Normatively:

- Each value in `imports` MUST be a valid URL or relative path.
- Tools MAY attempt to fetch imported interfaces, but the document MUST remain meaningful even if retrieval is not possible at evaluation time.
- Import keys MUST be unique within a document.

`imports` is **not** required to interpret the contract surface of a document. The contract surface is always the set of operations present in `operations`.

`imports` serves multiple purposes:

- **import table**: provides resolvable references for `satisfies` mappings, enabling explicit conformance declaration and resolving the diamond problem (when multiple imported interfaces define operations with the same name)
- **conformance declaration**: declares which interfaces this document intends to satisfy (tooling can verify coverage)
- **provenance**: documents the lineage of a composed interface (“this interface bundles these contracts”)
- **tooling UX**: grouping, coverage dashboards, suggestions for `satisfies`

Normatively, interfaces intended for distribution and discovery (especially those served at `/.well-known/openbindings`) SHOULD be **self-contained for operations**: required operations MUST be listed in `operations` and MUST NOT be only “implied” by remote references.

Tools MAY use `imports` to validate that the document’s operations cover the imported interfaces (using the same matching rules as compatibility), but failure to resolve an imported interface should be treated as “cannot evaluate” rather than changing the meaning of the document itself.

**Versioning note**: imported interface URLs are **not snapshots**. If the document at an imported URL changes, conformance may break. Interface authors SHOULD use versioned or immutable URLs for stability (e.g., `https://example.com/interfaces/task-manager/v1.json`).

Notes:

- A “bundle interface” is typically authored by importing other interfaces and then publishing an expanded/self-contained `operations` set (often generated by tooling).
- Interfaces MAY also conform to other interfaces without importing them (“duck typing” via matching operation names and schemas). `imports` + `satisfies` is the explicit, verifiable form of conformance declaration.

### Interface conformance

An interface **conforms to** another interface if it is compatible according to the matching algorithm defined in this specification. A service whose OpenBindings interface conforms to interface X is said to be **X-conformant**.

Conformance may be:

- **Declared**: the conforming interface lists the target in `imports` and uses `satisfies` on its operations to establish explicit mappings. Declared conformance is verifiable by tooling and resilient to operation renames.
- **Implicit**: the conforming interface's operation keys or aliases happen to match the target's operation keys, without an `imports` entry or `satisfies` declarations. Implicit conformance is opportunistic — it works when names align but may break silently if either side renames an operation.

Declared conformance is RECOMMENDED for interfaces intended for distribution or discovery. Implicit conformance is useful for ad-hoc interoperability but provides weaker guarantees.

Conformance is **directional**: "A conforms to B" means A provides at least the operations B requires, with compatible schemas. It does not imply B conforms to A.

Conformance may be **partial**: an interface that satisfies a subset of another interface's operations is partially conformant. Tools SHOULD report conformance as coverage (e.g., "3/5 operations matched") rather than treating partial conformance as an error. An `imports` entry establishes a reference for `satisfies` mappings; it does not by itself assert full conformance with the imported interface.

Conformance is **not identity**: two unrelated interfaces may define the same operation names with different semantics. Conformance only asserts structural compatibility (operation presence, kind, and schema direction), not semantic equivalence. Trust in conformance claims depends on the authenticated discovery context and the provenance of the interfaces involved.

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
- If `priority` is omitted, the binding is less preferred than any binding with an explicit `priority` value. Among bindings with equal or omitted priority, selection order is unspecified.

### Sources

`sources` is a top-level registry of binding specifications. Each entry declares:

- `format` (REQUIRED): the binding specification and version (e.g., `openapi@3.1`, `asyncapi@3.0`). See [`format`](#format-identifier) below.
- One of:
  - `location`: a URI or path to an external binding specification.
  - `content`: the binding specification content embedded directly. For JSON-based formats, this is typically a JSON object. For text-based formats (e.g., KDL, protobuf), this is a string containing the raw content.
- `description` (OPTIONAL): a human-readable description of this source.

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
- `mcp@2025-11-25` (Model Context Protocol, date-versioned)
- `protobuf@3`

#### `location` and resolution

`location` is a string that identifies where to obtain the binding specification.

Normatively:

- If `location` is a relative reference (e.g., `./openapi.json`), it MUST be resolved relative to the **location of the OpenBindings document**.
  - If the OpenBindings document was retrieved from a URL, resolve relative to that URL.
  - If the OpenBindings document was loaded from a file path, resolve relative to that file’s directory.
- Tools MAY restrict which URI schemes are fetchable (e.g., allow `https:` but disallow `file:`) as a security policy, but such restrictions MUST NOT change the meaning of the OpenBindings document; they only affect actionability/coverage at evaluation time.

#### Provider interoperability

Providers for the same binding format that correctly implement the format's semantics SHOULD be interoperable. A transform targeting one conforming provider SHOULD work with any other conforming provider for that format, because both derive field handling from the same binding source.

If providers for the same format diverge in how they interpret the binding source, transforms may not be portable between them. This is a binding format ecosystem concern; OpenBindings does not mandate specific provider behavior beyond reading the binding source to determine field handling.

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

Required operations are determined by the referenced interface(s) and the matching rules in [Interfaces & Compatibility](#interfaces--compatibility) (`aliases`/`satisfies`/`imports`).

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

Tools claiming OpenBindings v0.1 support MUST implement JSONata for transform evaluation. Implementations SHOULD target [JSONata 2.x](https://docs.jsonata.org/) semantics; if an implementation uses a different major version, it MUST document the version it supports.

Future versions of OpenBindings MAY support additional transform languages via a `type` field (see [Transform definition](#transform-definition)).

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
3. The binding provider executes the operation using the transformed input.
4. The binding provider returns output in the **binding source's structure** (concrete).
5. If `outputTransform` is present, apply it to produce output matching the **operation's output schema** (abstract).
6. The caller receives output matching the operation's schema.

If no transform is specified, the input/output is passed through unchanged (1:1 mapping assumed).

### Transform output structure

The transform output MUST be a JSON object with field names matching what the binding source expects.

The binding provider reads the binding source to determine how fields are handled. The transform is responsible only for field naming and structure, not for specifying protocol-specific details (e.g., HTTP parameter locations, CLI flag syntax). Field handling semantics are defined by the binding format, not by OpenBindings.

Note: Some binding formats may not provide sufficient information for a provider to determine field handling. Such formats may have limited compatibility with OpenBindings transforms. This is a binding format ecosystem concern, not an OpenBindings limitation.

#### Example (HTTP/OpenAPI)

If an OpenAPI operation defines `merchant_id` as a path parameter and `charge_amount` as a body field, the transform outputs:

```json
{ "merchant_id": "m123", "charge_amount": 100 }
```

The OpenAPI binding provider uses the OpenAPI specification to route `merchant_id` to the path and `charge_amount` to the body.

#### Example (CLI/Usage)

If a usage specification defines `--name` as a flag and `<files>` as positional arguments, the transform outputs:

```json
{ "name": "example", "files": ["a.txt", "b.txt"] }
```

The usage binding provider uses the usage specification to route `name` as a flag and `files` as positional arguments.

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
- Cycles MUST be detected and treated as a schema error (or reported clearly). This applies at all stages: during initial resolution, during normalization for comparison (e.g., inlining `$ref` targets), and within union variants. A schema containing a cycle MUST be treated as incompatible under this profile (fail closed).

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

- Tools SHOULD validate that each source object contains at least one of `location` or `content`.
- Tools SHOULD validate that no source object contains both `location` and `content`.
- The JSON Schema (`openbindings.schema.json`) permits both fields structurally; these semantic constraints are enforced by tooling and prose.

### Binding specifications

- Tools MUST NOT fail the entire document solely because a binding specification is unsupported.
- Tools MUST ignore bindings whose `sources[*].format` is unsupported (tools MAY surface diagnostics).

### Schema comparison

- Tools MUST implement the **[Schema Comparison Rules](#schema-comparison-rules)** for compatibility checks.
- Schemas that use features outside the profile MUST be treated as incompatible under that profile.

### Conformance test suite

This specification ships with a conformance test suite in the `conformance/` directory. The suite contains JSON fixture files that define expected outcomes for:

- **Schema comparison** (`schema-comparison.json`): input/output directional compatibility for every comparison rule in the profile.
- **Normalization** (`normalization.json`): canonical forms, `allOf` flattening, annotation stripping, and `$ref` cycle detection.
- **Operation matching** (`operation-matching.json`): primary key, alias, `imports`, and `satisfies` matching; kind checks; unspecified slot handling; ambiguous match detection.

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

Tools MUST NOT automatically fetch arbitrary URIs from untrusted documents without explicit user consent or configuration. Tools SHOULD restrict fetchable URI schemes by default (e.g., allow `https:` only). Tools SHOULD enforce size limits on fetched artifacts.

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

A community publishes a **Task Manager** interface defining three operations: creating a task (method), listing tasks (method), and receiving notifications when a task is completed (event). A deployment at `tasks.acme.com` claims to implement this interface via an OpenAPI binding. Its operation schemas use different field names than the target interface, and its underlying API uses yet another set of field names internally — transforms in the bindings bridge the OBI's operation schemas to the API.

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
      "kind": "method",
      "description": "Create a new task.",
      "input": { "$ref": "#/schemas/TaskInput" },
      "output": { "$ref": "#/schemas/Task" }
    },
    "tasks.list": {
      "kind": "method",
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
      "kind": "event",
      "description": "Emitted when a task is marked done.",
      "payload": { "$ref": "#/schemas/Task" }
    }
  }
}
```

### Candidate interface (discovered, bound)

This is what `tasks.acme.com` serves at `/.well-known/openbindings`. It imports and claims to satisfy the Task Manager interface. Note:

- The OBI's operation schemas use `task_name` and `urgency`, while the underlying Acme REST API uses `name` and `prio` internally — transforms in the bindings bridge this gap.
- `tasks.list` accepts an additional optional `offset` parameter (the candidate accepts more input than the interface requires — compatible).
- The `tasks.completed` event has no payload schema (unspecified — the slot will be skipped during comparison).
- The operation `tasks.create` uses `satisfies` to explicitly map to the target interface.
- The operation `task.list` uses `aliases` to match the target's `tasks.list`.

```json
{
  "openbindings": "0.1.0",
  "name": "Acme Task Service",
  "version": "2.1.0",
  "imports": {
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
      "kind": "method",
      "description": "Create a new task in the Acme system.",
      "satisfies": [
        { "interface": "taskmanager", "operation": "tasks.create" }
      ],
      "input": { "$ref": "#/schemas/AcmeTaskInput" },
      "output": { "$ref": "#/schemas/AcmeTask" }
    },
    "task.list": {
      "kind": "method",
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
      "kind": "event",
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

### Compatibility check walkthrough

A tool checks whether the Acme Task Service (candidate \(D\)) is compatible with the Task Manager interface (target \(I\)).

#### Step 1: Operation matching

| Target operation | Match type | Candidate operation | Result |
|---|---|---|---|
| `tasks.create` | `satisfies` (explicit) | `tasks.create` | matched |
| `tasks.list` | `aliases` (fallback) | `task.list` (alias: `tasks.list`) | matched |
| `tasks.completed` | key match | `tasks.completed` | matched |

All three operations match. No ambiguities.

#### Step 2: Kind check

| Operation | Target kind | Candidate kind | Result |
|---|---|---|---|
| `tasks.create` | method | method | matches |
| `tasks.list` | method | method | matches |
| `tasks.completed` | event | event | matches |

#### Step 3: Schema comparison

**`tasks.create` — input (direction: input)**

Comparing `TaskInput` (target) vs `AcmeTaskInput` (candidate):

- `type`: both `"object"` — compatible.
- `required`: target requires `["title"]`, candidate requires `["task_name"]`. `required(D)` is `["task_name"]` which is NOT a subset of `required(I)` `["title"]` — the property names differ. **Incompatible.**

This is the expected result: the candidate uses different field names (`task_name` vs `title`). The schemas are incompatible at the operation level. The candidate's transforms bridge its operation schemas to its own API — they do not affect the comparison with the target.

**`tasks.create` — output (direction: output)**

Comparing `Task` (target) vs `AcmeTask` (candidate):

- `type`: both `"object"` — compatible.
- `required`: target requires `["id", "title", "status"]`, candidate requires `["id", "task_name", "status"]`. Target requires `"title"` but candidate does not provide `"title"` — **incompatible** (same field-name mismatch).

**`tasks.list` — input (direction: input)**

Comparing `TaskFilter` (target) vs `AcmeTaskFilter` (candidate):

- `type`: both `"object"` — compatible.
- `required`: both empty — compatible.
- `properties.status.enum`: target `["pending","in_progress","done"]`, candidate `["pending","in_progress","done","archived"]`. Candidate is a superset — **compatible** (input: candidate may accept more).
- `properties.limit.maximum`: target `100`, candidate `200`. Candidate accepts higher values — **compatible** (input: wider range).
- `properties.limit.minimum`: both `1` — compatible.
- Candidate has additional property `offset` not in target — **compatible** (input: candidate may accept additional properties).

**Input schemas for `tasks.list` are compatible.**

**`tasks.list` — output (direction: output)**

Comparing target output vs candidate output:

- `type`: both `"object"` — compatible.
- `required`: both `["items"]` — compatible.
- `properties.items.items`: comparing `Task` vs `AcmeTask`:
  - `properties.status.enum`: target `["pending","in_progress","done"]`, candidate `["pending","in_progress","done","archived"]`. Candidate may return `"archived"` which target doesn't describe — **incompatible** (output: candidate must stay within target's enum).

**`tasks.completed` — payload**

Target defines a payload schema (`Task`). Candidate has no payload (unspecified). Per the omitted schemas rule, this slot is **skipped** — reported as **unspecified**.

#### Compatibility report

| Operation | Match | Kind | Input | Output | Payload |
|---|---|---|---|---|---|
| `tasks.create` | matched (satisfies) | matches | **incompatible** | **incompatible** | — |
| `tasks.list` | matched (alias) | matches | **compatible** | **incompatible** | — |
| `tasks.completed` | matched (key) | matches | — | — | **unspecified** |

**Verdict**: the candidate is **not compatible** with the target interface. Two operations have incompatible schemas.

This is the correct and expected outcome. The candidate uses different field names (`task_name`/`urgency` vs `title`/`priority`) and a wider `status` enum. These are real differences in the operation-level schemas. The candidate is **actionable** (its bindings resolve and its transforms correctly bridge its operation schemas to its underlying API), but it is **not compatible** with the target interface (a client built against the target's schema shapes cannot assume the candidate's shapes will match).

The transforms bridge between the candidate's operation schemas and its own API — they do not bridge between the candidate and the target interface. Transforms are binding plumbing, not operation semantics, and they are invisible to compatibility checking.

If the candidate wanted to be schema-compatible, it would need to use the same field names and enum values in its operation schemas as the target. Its transforms would still bridge its operation schemas to its underlying API, but its operation schemas would now match the target's shapes, and the compatibility check would pass.

### Binding coverage check

Separately from compatibility, a tool checks whether the candidate's operations are **actionable** (have resolvable bindings).

| Operation | Binding key | Source resolvable? | Ref resolvable? | Actionable? |
|---|---|---|---|---|
| `tasks.create` | `tasks.create.acmeApi` | yes (if `./openapi.json` is available) | yes | **yes** |
| `task.list` | `task.list.acmeApi` | yes | yes | **yes** |
| `tasks.completed` | (no binding) | — | — | **no** |

**Coverage**: 2 of 3 operations are actionable. The event `tasks.completed` has no binding — it cannot be subscribed to via any declared binding source.

### Transform execution flow (for `tasks.create`)

When a caller invokes `tasks.create` via the OpenAPI binding:

1. Caller provides input matching the operation schema (`AcmeTaskInput`): `{ "task_name": "Ship v1", "urgency": 3 }`
2. `inputTransform` applies, bridging to the API's field names: `{ "name": "Ship v1", "prio": 3 }`
3. The OpenAPI binding provider uses the OpenAPI spec to route fields to the HTTP request.
4. The API returns its native structure: `{ "id": "t-42", "name": "Ship v1", "status": "pending", "prio": 3 }`
5. `outputTransform` applies, bridging back to the operation schema (`AcmeTask`): `{ "id": "t-42", "task_name": "Ship v1", "status": "pending", "urgency": 3 }`
6. Caller receives output matching the operation schema.

### Compatibility and versioning

Compatibility rules (schema compatibility, binding coverage, resolution requirements) must remain stable within a major `openbindings` version. A document format version may introduce new optional fields and add validation guidance, but MUST NOT change the meaning of existing fields within the same major version.
