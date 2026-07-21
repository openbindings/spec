# `openbindings.usage` Binding Specification

## 1. Status and identifier

This document is the normative text for the binding specification identifier **`openbindings.usage@1`**, published by the openbindings project as its defining authority. The identifier is exact and opaque per core [OBI-B-01](../../openbindings.md#104-binding-specification-rules): no range or normalization semantics attach to it. An incompatible change to this specification publishes `openbindings.usage@2` ([OBI-B-03](../../openbindings.md#104-binding-specification-rules)); compatible clarification may revise this document in place. It publishes with the OpenBindings core 0.2.0 change set, and reference tooling adopts the identifier — replacing the pre-bindingSpec `usage@…` tokens — in the same coordinated change.

The key words "MUST", "MUST NOT", "REQUIRED", "SHOULD", "SHOULD NOT", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in all capitals.

## 2. Scope and incorporated authorities

This is the **openbindings project's** binding specification for [jdx usage](https://usage.jdx.dev) CLI descriptors. It is published under this project's authority, not by or for the usage project: the usage specification is incorporated by reference and remains authoritative over the descriptor format itself — its KDL document syntax, command trees, flags, arguments, aliases, the `min_usage_version` directive, and all descriptor semantics. This specification defines only the OpenBindings overlay: how a source carries or addresses a descriptor, how a binding selects a command, and how caller-facing operation values correspond to a command invocation.

A usage descriptor describes a human command surface and cannot declare output decoding, exit-code meaning, or a field's stdin routing. This specification does not author that missing half into artifacts or OBI documents: it defines content-independent defaults at **named configuration points** ([§9](#9-operation-boundary-correspondence)), so the gap is made up in consumer configuration — the completeness doctrine of the [catalog README](../README.md#the-completeness-spectrum-specification--configuration--complete-invocation). The artifact stays pristine; the OBI stays abstract.

## 3. Accepted source representations

This specification accepts one representation: **usage descriptor source text** — a KDL document per the usage specification — carried as string `content` ([§5](#5-content)) or addressed by `location` ([§4](#4-location)). There is no second representation, so no discrimination rule is needed, and no encoding for non-textual artifacts is defined (usage has none).

Revision 1 accepts descriptors of the usage **2.x and 3.x** lines. A descriptor's `min_usage_version` directive, when present, is a load-time gate (**USAGE-P-01**): a processor accepts the descriptor only when it implements a usage version satisfying the declared minimum, and otherwise refuses loudly before any use of the artifact. Which usage versions a processor implements is that processor's own declaration, exactly as tools declare their supported core versions.

## 4. `location`

A source's `location`, when present, is one of two absolute address forms (**USAGE-D-02**). Both are binding-specification-defined absolute addresses in the sense of core [OBI-D-05](../../openbindings.md#102-document-rules): neither takes a base, and each means the same thing wherever the document travels.

1. **Document address** — an absolute URI addressing the descriptor document itself: `https://example.com/tool/usage.kdl`, `file:///opt/tool/usage.kdl`. Dereferencing it yields the descriptor source text.
2. **Exec address** — the scheme-like prefix `exec:` followed by an argv vector: one command token and zero or more argument tokens, separated by single spaces (`exec:mytool usage`). The addressed artifact is the standard output of executing that vector **directly** — never through a shell. Tokens carry no quoting mechanism; a command whose arguments contain spaces is outside this form, and its generated descriptor is embedded as `content` instead. This form exists for tools whose descriptors are generated live; it is an absolute address by construction.

A bare filesystem path (`./usage.kdl`, `/opt/tool/usage.kdl`) is a relative reference in form and is not a conformant `location` (core OBI-D-05); local descriptors ride `file://` URIs or embedded `content` — embedding is the recommended lane for emitted documents, keeping them self-contained.

**Security.** Dereferencing an exec address executes a document-supplied command. A processor MUST NOT dereference an exec address without explicit prior authorization from its operator or configuration for that command (**USAGE-P-02**); the default is refusal. This is the one normative security floor this specification adds; all other mitigation posture follows core [§9](../../openbindings.md#9-security-considerations).

## 5. `content`

A source's `content`, when present, MUST be a JSON string carrying the UTF-8 source text of a usage descriptor (**USAGE-D-01**). No other JSON type is an accepted `content` value under this specification.

## 6. Composition

When `content` is present it is the artifact the processor interprets, per the core's content-primacy floor ([§5.4](../../openbindings.md#54-sources)). A co-present `location` is the descriptor's provenance — its document address, or the exec recipe that regenerates it — and MAY be used to refresh or compare, never as a competing artifact. Usage descriptors are self-contained: no reference internal to a descriptor needs a base, and this specification defines no reference-base role for `location` (OBI-B-02 item 4: the answer is *none*).

## 7. `ref`

A binding's `ref`, when present, MUST be a non-empty **command path**: the command names along the descriptor's command tree, separated by single spaces (`db migrate run`) (**USAGE-D-03**). Resolution walks the tree from the root command; each segment matches a command's declared name or any of its declared aliases, exactly and case-sensitively. A flag an ancestor command declares `global` accumulates onto the resolved command's effective surface. The usage specification defines the `global` attribute but does not state its scope of application; this specification pins the ancestor-chain reading — a `global` flag reaches the declaring command and its descendants — so that one descriptor yields one effective surface in every implementation.

The **root command** is addressed by omitting `ref`. An empty-string `ref` is not conformant — this specification gives each meaning one spelling. A `ref` that resolves to no command in the artifact makes the binding unresolvable; verifying resolution requires the artifact, and a validator without it leaves the check unverified per the core's partial-verification posture.

## 8. Target and interaction

The binding target is the resolved command, executed as **one direct process spawn per invocation** — argv assembled per [§9](#9-operation-boundary-correspondence), never interpreted by a shell (**USAGE-P-03**). The interaction is **unary**: at most one caller-facing input value, exactly one successful output value. An invocation supplying no input value runs the bare command. The spawned process is bound to the invocation's lifetime: cancelling the invocation terminates the process.

Interactive commands, PTY surfaces, and streaming interactions are **excluded** from revision 1. The exclusion is a definition, not an open item: a descriptor cannot express them, and a future revision that adds them is an incompatible change (`openbindings.usage@2`).

## 9. Operation-boundary correspondence

### 9.1. Input mapping

The caller-facing input value is one JSON object (or absent). Its fields map by name onto the resolved command's effective surface (**USAGE-P-04**):

- A field matching a declared **flag** (by primary, short, or long name) rides argv as that flag. Boolean fields express presence or the declared negation; count-type flags repeat per the value; array values repeat the flag once per element.
- A field matching a declared **positional** rides argv in declared order, with `--` inserted where the descriptor declares it; an array value spreads across a variadic positional.
- Non-string scalar, object, and array values are serialized onto argv as compact [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259) JSON.
- A field matching nothing on the effective surface is refused **before spawn** — loudly, never silently dropped.

Credentials are not input fields. A processor MUST NOT place credential material on argv (**USAGE-P-06**); **environment variables** are this family's credential and configuration channel, supplied from the consumer's runtime context, and a credential that cannot be expressed as an environment variable is **surfaced to the consumer** rather than silently skipped. A usage descriptor declares no security metadata, and this specification derives no security requirements from artifacts. How a consumer acquires credentials is a runtime concern; the project's [`binding-invoker`](https://openbindings.com/interfaces/binding-invoker) interface defines one such negotiation surface (informative).

### 9.2. Configuration points

Three named configuration points cover what the descriptor cannot declare (**USAGE-P-05**). What this specification pins at each is the **default** and what a consumer override *means*; the seam through which an override arrives is the implementation's own surface. Where an implementation exposes consumer configuration, it is consulted before the default — a per-invocation tier ahead of a consumer-level tier where both exist — and a declined override falls through; an implementation that exposes no configuration seam applies the defaults directly and is no less conformant for it (the [catalog README](../README.md) states this seam is not a required architecture). All defaults are content-independent: decided by declarations and framing, never by payload bytes.

| Point | Default | Overrides |
| --- | --- | --- |
| **route** (per input field) | argv, per §9.1 | stdin (as a `-` operand where the surface declares one, or the pure stdin channel), or a temporary file whose path substitutes for the value |
| **decode** | standard output as text — bytes decode as UTF-8, invalid sequences a loud decode error — trailing newlines stripped (command-substitution semantics) | any consumer-declared decoding of the completed process's output |
| **classify** | success **iff** exit status 0 | any consumer-declared classification of exit statuses |

An impossible routing — two fields routed to stdin, a stdin route with no slot on the surface — is refused before spawn. Per-CLI knowledge (a tool that emits JSON, alternate success exits, a field that must ride stdin) is packaged as consumer configuration at these points, never authored into the artifact or the OBI.

### 9.3. Success and the output value

Which outcomes of an invocation are successes is decided by the **classify** point. For a successful outcome, the operation's single output value is the product of the **decode** point applied to the process's standard output. Failure outcomes are not operation results and have no representation in this specification; what a consumer surfaces about them is its own concern.

### 9.4. Transform positions

This specification defines **no** context bindings at transform positions: a transform on a usage binding evaluates in the core's closed environment, unaugmented (OBI-B-02 item 7: the answer is *none*).

## 10. Conformance

Rules carry stable identifiers under the same discipline as the core's: never reused, never renumbered. Source rules bind OBI content governed by this specification; processor rules bind implementations claiming support for `openbindings.usage@1`. Verification follows the core's partial-verification posture.

- **USAGE-D-01**: `content`, when present, is a JSON string carrying UTF-8 usage descriptor source text.
- **USAGE-D-02**: `location`, when present, is a document address (absolute URI) or an exec address (`exec:` + space-separated argv vector), per [§4](#4-location).
- **USAGE-D-03**: `ref`, when present, is a non-empty space-separated command path resolving in the artifact's command tree per [§7](#7-ref); the root command is addressed by omitting `ref`.
- **USAGE-P-01**: A processor honors `min_usage_version` as a loud load-time gate, per [§3](#3-accepted-source-representations).
- **USAGE-P-02**: A processor MUST NOT dereference an exec address without explicit authorization; default deny, per [§4](#4-location).
- **USAGE-P-03**: Execution is a direct process spawn, never a shell, bound to the invocation lifetime, per [§8](#8-target-and-interaction).
- **USAGE-P-04**: Input fields map to the effective command surface per [§9.1](#91-input-mapping); an unmatched field is refused before spawn.
- **USAGE-P-05**: The route, decode, and classify configuration points behave per [§9.2](#92-configuration-points): their defaults, the meaning of each override, and the pre-spawn refusal of impossible routings. Where an implementation exposes configuration tiers, the more specific is consulted first and a declined override falls through; exposing no seam and applying the defaults is conformant. The carriage of a configuration value is implementation surface, not this rule's content.
- **USAGE-P-06**: Credential material never rides argv; environment variables are the credential channel, per [§9.1](#91-input-mapping).

Conformance fixtures keyed to these identifiers are published with the project's conformance corpus. Deterministic *generation* of OBI documents from usage descriptors (operation-key derivation from command paths, schema carriage) is a synthesis concern outside this specification; the project's interface-synthesizer and reference-tool documentation record those conventions.

## 11. References

- **[usage]** jdx, "usage — a specification for CLIs." <https://usage.jdx.dev>. Incorporated authority for the descriptor format ([§2](#2-scope-and-incorporated-authorities)); the descriptor's KDL syntax is defined there.
- **[OpenBindings]** The OpenBindings core specification, `openbindings.md` in this repository — the OBI-B rules this document answers, OBI-D-05's address posture, and the content-primacy floor.
- **[RFC 8259]** T. Bray, Ed., "The JavaScript Object Notation (JSON) Data Interchange Format." <https://www.rfc-editor.org/rfc/rfc8259>
- **[BCP 14]** RFC 2119 / RFC 8174 (key words).
- The [catalog README](../README.md) (informative) — completeness doctrine, configuration-point hooks, and recommended defaults this specification instantiates.
