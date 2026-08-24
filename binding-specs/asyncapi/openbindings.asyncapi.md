# `openbindings.asyncapi` Binding Specification

## 1. Status and identifier

**Status: unreleased first-revision candidate.** This document proposes **`openbindings.asyncapi@1`** as the first project identifier for this family. No AsyncAPI binding specification has been published by the OpenBindings project. This candidate remains mutable until its first release. Publication will mint the exact, opaque identifier under core [OBI-B-01](../../openbindings.md#104-binding-specification-rules); a later incompatible change will require a different identifier under [OBI-B-03](../../openbindings.md#104-binding-specification-rules).

The key words "MUST", "MUST NOT", "REQUIRED", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" are interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) only when they appear in all capitals.

## 2. Purpose, scope, and authority

This is the **OpenBindings project's** candidate overlay for [AsyncAPI](https://www.asyncapi.com/docs/reference/specification/latest) documents. As the governing authority for `openbindings.asyncapi@1`, this specification deliberately incorporates AsyncAPI Core and the applicable AsyncAPI protocol-binding specifications on the terms below. It could define a different relationship under a different identifier; this candidate chooses close deference because duplicating or contradicting those capable authorities would reduce brownfield fidelity and reuse. It is not an alternative protocol description language and it does not re-specify the protocols AsyncAPI can describe.

The layering is intentionally thin:

1. This specification incorporates AsyncAPI Core as authoritative over the artifact, its application perspective, channels, operations, messages, schemas, servers, security declarations, references, and traits.
2. It incorporates the selected AsyncAPI protocol-binding specifications as authoritative over concrete protocol semantics wherever they speak.
3. A protocol driver or codec interprets those concrete declarations and performs the exchange, preferably through mature protocol-native libraries.
4. This specification defines only the OpenBindings correspondence: source carriage, operation addressing, complementary caller perspective, application-value mapping, and the boundary between successful outputs and unsuccessful completion.

An implementation MUST NOT substitute an OpenBindings interpretation for a concrete semantic already defined by AsyncAPI or the selected AsyncAPI protocol binding. Conversely, concrete protocol facts MUST NOT be placed in ordinary OpenBindings operation inputs, outputs, or invocation errors merely to make them visible. Status codes, broker frames, topics, partitions, acknowledgements, protocol headers, and binding objects remain below the abstraction. Artifact runtimes, native clients, logs, and traces may retain raw evidence below this boundary; correct application behavior MUST NOT require interpreting it.

Like Core, this document specifies portable meaning rather than a client API, driver registry, connection pool, retry policy, or command-line interface. A protocol driver is an implementation capability, not an OBI field and not a new binding-specification type.

**Normative upstream snapshot.** Every authority incorporated above is pinned to an immutable text, so a claim about what an authority says is checkable against the exact bytes the claim was made from. AsyncAPI Core is the nine editions listed in [§3](#3-accepted-asyncapi-editions-and-source-representations), each read at its own tag in the [`asyncapi/spec`](https://github.com/asyncapi/spec) repository — commits [`b21cf1d8`](https://github.com/asyncapi/spec/blob/b21cf1d854994a8488c6575ae0dda461b51eb1d4/versions/2.0.0/asyncapi.md) (2.0.0, at `versions/2.0.0/asyncapi.md`), [`3470a638`](https://github.com/asyncapi/spec/blob/3470a6386736cf6002846d8eb7535308b79c75e8/spec/asyncapi.md) (2.1.0), [`01ffd5b4`](https://github.com/asyncapi/spec/blob/01ffd5b48875dc478b81c393f0595a4bc7f816bb/spec/asyncapi.md) (2.2.0), [`22c6f2c7`](https://github.com/asyncapi/spec/blob/22c6f2c7a61846338bfbd43d81024cb12cf4ed5f/spec/asyncapi.md) (2.3.0), [`65d58696`](https://github.com/asyncapi/spec/blob/65d58696f8c3ab6471aa48b12d878221b8d8109e/spec/asyncapi.md) (2.4.0), [`4ed40555`](https://github.com/asyncapi/spec/blob/4ed405556e5fe546cad389676c272ff29534e375/spec/asyncapi.md) (2.5.0), [`1824379b`](https://github.com/asyncapi/spec/blob/1824379ba6252bfb52550337a86ca9b10a33b3aa/spec/asyncapi.md) (2.6.0), [`d78dcea7`](https://github.com/asyncapi/spec/blob/d78dcea70c9b094a3df72f9a4e811828cec778cc/spec/asyncapi.md) (3.0.0), and [`b3fac5bb`](https://github.com/asyncapi/spec/blob/b3fac5bb522771428ea57b16129b273cd3ea0180/spec/asyncapi.md) (3.1.0), each at `spec/asyncapi.md` except where noted. The AsyncAPI protocol-binding authority is the published collection [`asyncapi/bindings`](https://github.com/asyncapi/bindings) at tag `v3.1.0`, commit [`ec5c590d4212905a13014cfd43f72fb086c00e85`](https://github.com/asyncapi/bindings/tree/ec5c590d4212905a13014cfd43f72fb086c00e85) — every protocol binding specification published there, since [§9.1](#91-protocol-and-driver-delegation) defines no protocol allowlist. The named payload-schema correspondence of [§9.2](#92-application-values-messages-and-schemas) incorporates the Apache Avro Specification at edition **1.9.0** — the sole Avro version every accepted edition's schemaFormat registry registers — read at the immutable [`apache/avro`](https://github.com/apache/avro) tag `release-1.9.0`, commit [`3c76495e9524ef322726d03d7ee406be89e8fde0`](https://github.com/apache/avro/blob/3c76495e9524ef322726d03d7ee406be89e8fde0/doc/src/content/xdocs/spec.xml), at `doc/src/content/xdocs/spec.xml`. The string carriage grammar is [YAML 1.2.2](https://yaml.org/spec/1.2.2/). The rendered documentation at <https://www.asyncapi.com/docs/reference/specification/> and every later upstream revision — including unreleased revisions on the bindings repository's default branch — are informative and do not alter this identifier. Accepting another edition or advancing a normative authority pin publishes a new binding-specification identifier.

## 3. Accepted AsyncAPI editions and source representations

This candidate accepts exactly these published AsyncAPI editions, each interpreted under its own official specification text at the immutable commit pinned in [§2](#2-purpose-scope-and-authority): **2.0.0, 2.1.0, 2.2.0, 2.3.0, 2.4.0, 2.5.0, 2.6.0, 3.0.0, and 3.1.0**. A future edition is not accepted merely because its version shares a major or minor line (**ASYNC-P-01**).

Two carried representations are accepted:

- **Object `content`**: the parsed AsyncAPI document as a JSON object.
- **String `content`**: YAML 1.2.2 source text, of which JSON is a subset. Duplicate mapping keys and invalid UTF-8 are refused loudly.

Discrimination uses the artifact's own `asyncapi` field. Internal normalization MAY place different editions into a shared runtime model, but it MUST preserve the selected operation's native identity and MUST NOT change the edition's perspective, reference, inheritance, security, or protocol-binding semantics.

## 4. `location`

A source's `location`, when present, is an **absolute URI addressing the AsyncAPI document itself** (**ASYNC-D-02**), such as `https://example.com/asyncapi.yaml` or `file:///srv/api/asyncapi.yaml`. A bare filesystem path is relative in form and is not a conformant `location` under core [OBI-D-05](../../openbindings.md#102-document-rules). Connection targets come from the artifact's servers, not from `location`.

## 5. `content`

A source's `content`, when present, MUST be one of the two representations in [§3](#3-accepted-asyncapi-editions-and-source-representations) (**ASYNC-D-01**). No other JSON value is accepted as an AsyncAPI artifact.

## 6. Composition and reference resolution

When `content` is present it is the artifact the processor interprets, following Core's content-primacy rule. A co-present `location` is that content's origin and base URI. Relative references resolve exactly as the governing AsyncAPI edition specifies. Embedded content without a co-present `location` MUST be self-contained; location-only sources use their location as the artifact base.

The artifact processor, not the OBI processor, owns AsyncAPI `$ref`, trait, component, and protocol-binding resolution. Resolution MUST retain enough native identity for diagnostics, coverage, and exact `selector` round trips.

## 7. `selector`

A binding's `selector` is REQUIRED and selects exactly one native AsyncAPI operation target (**ASYNC-D-03**):

- In AsyncAPI **3.x**, it is `#/operations/<operation-key>`.
- In AsyncAPI **2.x**, it is `#/channels/<channel-key>/publish` or `#/channels/<channel-key>/subscribe`.

Map keys use RFC 6901 escaping. These are literal JSON Pointer spellings: no percent-decoding is applied, and a bare operation or channel key is not conformant. A syntactically correct pointer whose selected entry does not resolve to the governing edition's operation object is unresolvable. Channels, messages, servers, and whole documents are not independently invocable targets.

A runtime that normalizes a 2.x operation internally MUST still report and synthesize its native 2.x pointer. An OBI therefore remains stable against the brownfield artifact supplied by its author rather than exposing an implementation's normalized AST.

## 8. Caller perspective and operation correspondence

AsyncAPI describes an application. OpenBindings invokes that application as its counterparty (**ASYNC-P-02**).

The equivalent correspondences are:

| Artifact form | Described application | OpenBindings caller |
| --- | --- | --- |
| AsyncAPI 3.x `receive` | receives operation messages | supplies operation-message payload values |
| AsyncAPI 3.x `send` | sends operation messages | observes operation-message payload values |
| AsyncAPI 2.x channel `publish` | receives the published message | supplies the message payload value |
| AsyncAPI 2.x channel `subscribe` | sends the subscribed message | observes the message payload value |

For a 3.x operation with `reply`, reply-message payloads travel in the opposite direction from the operation messages. A `receive` operation therefore maps operation messages to caller input and replies to caller output. A `send` operation maps operation messages to caller output and replies to caller input. Whether a concrete protocol realizes that exchange as unary, streaming, session-oriented, multiplexed, acknowledged, or otherwise is emergent from the artifact and its selected driver; it is not declared as cardinality in the OBI.

No interaction is invented for an artifact that does not declare one. A processor MUST NOT reverse an edition's perspective, infer an opposite operation, or manufacture request/reply behavior from a transport convention.

## 9. Delegation and invocation semantics

### 9.1. Protocol and driver delegation

After source and operation resolution, the artifact's effective server selection determines the concrete protocol. AsyncAPI's corresponding server, channel, operation, message, and protocol-binding objects then govern execution under this specification's incorporation (**ASYNC-P-02**). The driver MUST honor the binding version and all applicable binding locations defined by the AsyncAPI binding authority; it MUST refuse a declaration it cannot interpret rather than falling back to a superficially similar protocol behavior.

Source validity, portable binding meaning, and installed runtime capability are distinct. If the incorporated AsyncAPI and protocol-binding authorities leave behavior necessary to invocation undefined, an implementation may complete that gap locally, but the completion is implementation-defined and does not become portable meaning of `openbindings.asyncapi@1`. Before publication, this candidate instead closes every such case it claims through an explicit rule, named interpretation point, permitted set, or exclusion. A missing implementation driver is different again: the governing meaning may be complete even when one runtime cannot perform it.

This specification defines **no protocol allowlist**. MQTT, AMQP, Kafka, WebSocket, HTTP, and a future community-defined AsyncAPI binding all occupy the same outer OpenBindings family. Supporting one at runtime requires a conforming driver and any codecs its artifact needs. The absence of such a driver is a local, pre-dispatch capability failure. It does not make the AsyncAPI operation invalid, change synthesis, or authorize another protocol to be selected silently.

Driver registration, dependency injection, and packaging are SDK/runtime concerns. A standalone AsyncAPI runtime MAY expose them without any OBI dependency; an OpenBindings adapter SHOULD delegate to that same runtime rather than duplicate its artifact interpretation.

### 9.2. Application values, messages, and schemas

The ordinary OpenBindings value at this boundary is the selected AsyncAPI **message payload, wholesale** (**ASYNC-P-03**). Protocol binding objects, frames, addresses, acknowledgements, transport headers, and status values do not become fields in the payload schema.

When an operation declares several message alternatives, the artifact's identity or correlation rules and the driver's protocol semantics govern selection. If the artifact leaves an invocation-time choice that cannot be derived without inspecting or guessing from the payload, the runtime requests an explicit `message` configuration choice before dispatch. It MUST NOT select an alternative by payload sniffing.

Every accepted edition's default Schema Object is a superset of JSON Schema Draft 07, while an OBI schema position requires JSON Schema 2020-12 (core [OBI-D-06](../../openbindings.md#102-document-rules)). An AsyncAPI Schema Object therefore enters an OBI input or output schema only under a semantic-preserving translation into the OBI dialect, after reference resolution. A verbatim copy is faithful only where the two dialects already agree; a copy that silently changes or discards a declared constraint — for example a Draft 07 assertion keyword that 2020-12 does not define — misstates the artifact's contract and, on the input direction, makes the OBI's minimum-acceptance claim false. The exact keyword mapping is a synthesis concern recorded with the project's synthesis and reference-tool documentation and pinned by the portable conformance scenarios, not restated here. A foreign `schemaFormat` identifying a non-JSON-Schema representation does not authorize copying or translating that representation into an OBI JSON Schema position; the values still ride the JSON application-value boundary, so the operation remains invocable, that direction is represented by an unconstrained JSON Schema unless a faithful conversion exists, and synthesis coverage records the degraded direction. **Named correspondences (the correspondence ladder's incorporation step).** This candidate names a closed list of payload schema languages whose own upstream authorities define a JSON encoding of their data; a declared format on this list crosses the boundary as **logical application values** under that incorporated encoding, never as opaque bytes. For `openbindings.asyncapi@1` the list is exactly: **Avro** (`application/vnd.apache.avro;version=1.9.0` and later 1.x, via the Avro specification's own JSON Encoding). The proto3 JSON Mapping is named as the reserved next correspondence for a future revision; no other format is on the list, and no implementation judges whether a conversion "exists" — it reads the list.

For an Avro-declared payload, synthesis derives the direction's OBI schema from the Avro schema as the JSON Schema of its Avro-JSON-encoded data, under this pinned mapping: `null`→`{"type":"null"}`; `boolean`→`{"type":"boolean"}`; `int`→`{"type":"integer","minimum":-2147483648,"maximum":2147483647}`; `long`→`{"type":"integer"}` (the JSON-number precision hazard past 2⁵³ is Avro's own encoding's, inherited by incorporation); `float`/`double`→`{"type":"number"}`; `string`→`{"type":"string"}`; `bytes`→`{"type":"string","pattern":"^[\\u0000-\\u00ff]*$"}` (the encoding's ISO-8859-1 codepoint image); `fixed(n)`→ the bytes schema with `"minLength":n,"maxLength":n`; `enum`→`{"enum":[...symbols]}` in declaration order; `array(T)`→`{"type":"array","items":derive(T)}`; `map(V)`→`{"type":"object","additionalProperties":derive(V)}`; `record`→`{"type":"object","properties":{...},"required":[all field names in declaration order],"additionalProperties":false}` (the encoding emits every field; read-side defaults are resolution, not encoding); a union → `"oneOf"` of its branches in declaration order, where a `null` branch is the null schema and every other branch is the encoding's single-key wrapper `{"type":"object","properties":{"<branchName>":derive(branch)},"required":["<branchName>"],"additionalProperties":false}` with the branch name being the named type's fullname or the type keyword; logical types derive as their underlying type (the JSON encoding is of the underlying data); named-type definitions materialize once under the operation schema's `$defs` keyed by Avro fullname, with in-schema references as `$ref` to that entry. A declaration under an on-list format identifier that is not a valid schema of that language is the artifact's defect under its own declared dialect. For Avro, whose resolution scope is the single JSON parse tree and which defines no cross-document import, that includes a schema using a name it does not itself define ("a name must be defined before it is used"). Where the direction's carriage is the byte rule below, such a declaration is an inexpressible contract there; on JSON-family or text-family carriage the affected direction is **invalid** rather than represented by an unconstrained schema, confined to exactly that operation per **ASYNC-P-05**. At invocation, the wire representation follows the declared media: a JSON-family content type carries the Avro-JSON encoding directly, and binary media carries the Avro binary encoding of the datum under the artifact's schema — a **codec capability**: an implementation that has not qualified the codec for a declared on-list format MUST refuse before dispatch, exactly as it refuses an unqualified protocol driver, and MUST NOT fall back to the byte boundary (the emitted schema is the logical one; base64 strings do not satisfy it). Wire framing around the binary encoding is a named configuration point, `framing`: `"bare"` (the default — the binary encoding alone) or `"confluent"` (the Confluent wire prefix: magic byte `0x00` plus the big-endian 4-byte schema id supplied as `configuration.schemaId`).

**The JSON and text families.** A `contentType` of `application/json` or a `+json` suffix type is **JSON-family**: the direction's payload crosses the boundary as its JSON value. A `contentType` whose primary type is `text` is **text-family**: the direction's payload crosses as characters, decoded and encoded under the declared `charset`, which this revision pins to UTF-8 and refuses otherwise. That character carriage is an **explicitly labeled OpenBindings convention**, for the same reason `openbindings.openapi@1` §9.2 labels its string-carriage lane: no accepted AsyncAPI edition supplies a serialization for those media, so the rule is this specification speaking. It authors no correspondence and installs no codec — the characters of the value are the payload — which is why one sentence covers the whole family rather than a list of admitted subtypes. The two specifications differ only in what the lane is keyed on, and deliberately: an AsyncAPI direction declares one payload contract under one effective media type, so the media type decides here, while an OpenAPI operation offers several media alternatives at once and must decide per declaration.

A `contentType` or protocol codec declaring media outside the JSON and text families, whose declared contract is NOT under a named correspondence, invokes the **artifact-authorized byte rule** (mirroring `openbindings.openapi@1`'s raw-byte lane): the direction carries the exact wire octets, and the boundary value is their canonical RFC 4648 §4 Base64 string — standard alphabet, required padding, no whitespace, zero unused pad bits; a non-canonical boundary string refuses before dispatch. Synthesis represents such a direction with the boundary schema `{ "type": "string", "contentEncoding": "base64" }` plus a pinned `description` stating the declared media and, when a declared contract is inexpressible, that fact — the loss is stated in the schema itself, not only in synthesis coverage. When the artifact declares no payload contract for that direction — or declares exactly the boundary schema — nothing is lost; any other declared contract is not expressible at the byte boundary, and synthesis coverage records the direction as lossy. A consumer codec installed at the invocation encode/decode seam may still enrich the floor; that seam is implementation surface, never a synthesis concern. A payload declaration that is invalid under its own declared dialect — the edition's own Schema Object, or an on-list foreign schema language under the named correspondences above — is the artifact's defect. In every case the consequence stays at its unit: a schema defect excludes or degrades the affected operation direction, never the sibling operations and never the artifact (**ASYNC-P-05**).

**The routed operation envelope (ruled 2026-08-14).** A channel parameter without a `location` runtime expression is per-invocation application data — the address is spelled from its values anew each invocation — and a declared Message Object `headers` contract is application data by AsyncAPI's own definition. Both are operation input or output under the amortization discriminator (binding-specs README): a value that varies per invocation is operation data regardless of the protocol position it rides. When the resolved operation's channel declares such parameters, or a governing message declares `headers`, the affected direction's operation-facing value is one JSON object — the **routed envelope** — in place of the bare payload: the message payload rides the protocol-neutral field `payload`, declared headers ride `headers` (valued under the artifact's headers schema), and each location-less channel parameter rides a field of its own name on the input direction. Deterministic collision-free field naming is a synthesis concern, mirroring `openbindings.openapi@1`. A direction with neither location-less parameters nor declared headers keeps the bare wholesale payload — the envelope never appears undeclared, so the ordinary §9.2 correspondence is unchanged for it. When several governing messages cover one direction, the envelope pairs each alternative's payload with its own declared headers (the union is over per-message envelopes, never a cross-product that would accept one message's payload with another's headers). A subscribe-perspective operation on a parameterized channel gains a parameter-only input envelope: addressing data is caller input even when no payload travels.

The envelope's field destinations are binding facts, not payload content: parameter values expand the channel address, headers ride the selected protocol's native header carriage, and neither destination enters the payload schema (the ASYNC-P-03 sentence above governs the `payload` field itself unchanged). A parameter whose `location` declares a runtime expression stays derived from that expression's source — the artifact's own bridge — and does not become an envelope field. On input, invocation context MAY pre-fill parameter fields (`configuration.address.parameters`, the amortized supply of an input); an explicitly supplied envelope field wins over the pre-fill, and a parameter with neither is the ordinary pre-dispatch context negotiation, never a guess. At the binding's transform boundary the source-facing representation is the routed one-tuple mirroring `openbindings.openapi@1` (OAPI-P-03): a one-item array `[{"$openbindings": "openbindings.asyncapi@1", "value": {...}, "parameters": [{"name": ..., "field": ...}], "payload": "<field>", "headers": "<field>"}]`, structurally disjoint from every envelope object, binding-private, and never copied into the operation schema.

Header carriage is a **per-protocol-cell capability**, exactly like the driver matrix: a protocol with native per-message header carriage (HTTP fields, Kafka record headers, MQTT 5 user properties, AMQP application properties) carries `headers` there; a cell with no native carriage (MQTT 3.1.1 publishes, raw WebSocket frames, SSE events) MUST refuse a headers-bearing direction before dispatch — never a silent drop, never a payload injection, and never a synthesis exclusion (synthesis does not know or judge the runtime cell). Header carriage adds no protocol-metadata member to the operation boundary or to the core document model: the envelope is application data riding the operation value.

### 9.3. Configuration, security, and context

Artifact declarations remain authoritative for server alternatives, variables, channel parameters, message alternatives, correlation, security requirements, and protocol-binding configuration (**ASYNC-P-04**). When the artifact supplies one unambiguous answer it is used. When it declares alternatives or a required value without choosing one, the runtime obtains an explicit application-level choice through invocation context before any observable dispatch. An artifact that declares no server at all still names a complete operation target: a server is reachability, not identity, so the operation is synthesized with a declared server-configuration requirement and the runtime obtains the connection target through the same context negotiation before any observable dispatch — never a synthesis exclusion, and never a guessed default.

Context names what is needed without turning protocol fields into operation input; the discriminator is amortization, not protocol position. A value that holds across invocations (a server choice, a credential, a message selection for a fixed workload) is context. A location-less channel parameter varies per invocation, so it is operation input riding the routed envelope (§9.2), with `configuration.address.parameters` remaining available as the amortized pre-fill of that input. At minimum, implementations distinguish the `server`, `message`, and artifact-declared credential requirements they can identify. A selected complete security alternative is satisfied as the governing AsyncAPI edition defines; requirements from different alternatives MUST NOT be combined into an undeclared hybrid. The driver applies resolved credentials through the selected protocol binding. Credentials and concrete protocol fields are never synthesized into the operation schema (**ASYNC-P-07**).

When the project's portable invocation interface is used, a requirement
derived from an artifact-authored reusable security declaration carries
`durable: true`. That flag permits a surrounding runtime to persist the
resolved credential; it neither requires persistence nor claims the credential
never expires. Driver-discovered live challenges and one-shot proofs remain
non-durable unless the governing protocol-binding rules explicitly make them
reusable.

Credential requirements are classified by the application material needed,
not by copying a protocol mechanism into Core. AsyncAPI `userPassword`,
`scramSha256`, and `scramSha512` declarations all request the existing abstract
username/password credential family. The exact selected declaration remains
available to the driver, which applies PLAIN, SCRAM-SHA-256, SCRAM-SHA-512, or
another binding-governed mechanism as appropriate. This classification does
not make the mechanisms equivalent and does not authorize a driver to replace
one with another.

A driver MAY define additional protocol-native configuration inside its standalone API. When used through OpenBindings, its adapter MUST keep that configuration in context or runtime setup, not in ordinary operation values, and MUST surface a missing required choice before dispatch whenever it is knowable then.

### 9.4. Lifecycle, outputs, and unsuccessful completion

The driver preserves the selected interaction's ordering, delivery-unit boundaries, input half-close, outputs already observed before a later failure, cancellation, and completion semantics (**ASYNC-P-06**). These properties are observable binding behavior, emergent from the artifact and the selected protocol; whatever invocation surface carries them observes them rather than declaring them, and this document adds no cardinality field to Core or OBI.

Application-authored messages selected by the correspondence in §8 are ordinary outputs, including payload variants whose domain meaning is an error object. A protocol, broker, server, authorization, timeout, cancellation, driver, codec, or local runtime failure is instead unsuccessful invocation completion. This specification deliberately defines no cross-protocol failure vocabulary: the selected driver decides from its upstream authorities whether the interaction completed successfully.

This specification admits **application-authored failure data** on an
unsuccessful completion only when an incorporated artifact or protocol-binding
rule identifies a faithfully decoded JSON-domain value as application-authored
failure data distinct from an ordinary message payload. A conforming driver
marks that admission explicitly at its artifact-runtime boundary; merely
exposing a driver error's details, reason, acknowledgement, headers, or native
envelope does not qualify. An unsuccessful completion with no admitted value
carries none. How an invocation surface carries the admitted value is that
surface's contract, not this specification's: when the project's portable
invocation interface is used, the admitted value rides its optional error
`data` member opaquely, including JSON null, and an unadmitted completion is
code-only. This rule gives future AsyncAPI bindings room to define application
failure data without turning today's known protocol evidence into a universal
vocabulary.

A driver MUST NOT turn a concrete protocol failure into an ordinary output merely to avoid an error path. It also MUST NOT discard output values already delivered before a later failure. Missing drivers and codecs fail locally before dispatch; cancellation and deadlines propagate to the active driver.

### 9.5. Diagnostics and abstraction boundary

Protocol evidence—for example broker reason codes, HTTP status and headers, connection metadata, or driver traces—MUST NOT cross the abstract invocation boundary as output or failure data. Artifact runtimes and protocol tooling may expose it below that boundary. Such evidence is not an operation result, is not portable application data, and MUST NOT be required for correct use of the operation (**ASYNC-P-07**). SDK bugs and local programming errors remain ordinary language/runtime errors; they are not synthesized outputs.

## 10. Synthesis

Synthesis inventories the accepted artifact independently of the drivers installed in the synthesizing process:

1. Emit one OBI operation and binding for each structurally valid native operation target whose application-value boundary is representable.
2. Preserve the native operation pointer from §7.
3. Derive input and output directions only from §8's application perspective.
4. Derive schemas only from application data declarations under §9.2 — payload declarations, declared Message `headers` contracts, and location-less channel parameters through the routed envelope. Protocol bindings, server protocols, status codes, addresses, and driver configuration MUST NOT alter the ordinary operation schema.
5. Account for every target and independently selectable message/server alternative as represented, invalid, explicitly excluded by this specification, or implementation-unsupported. A missing installed driver is neither an artifact exclusion nor a reason to omit a target.

Synthesis may inspect protocol bindings for coverage and diagnostics, but those concrete facts do not gain authority over the OBI operation model. Two AsyncAPI artifacts describing the same application contract over different protocols should synthesize the same operation schemas and perspective, differing only in their source and binding references.

## 11. Conformance

Document rules:

- **ASYNC-D-01**: `content`, when present, is an accepted AsyncAPI object or YAML 1.2.2 string representation (§5).
- **ASYNC-D-02**: `location`, when present, is an absolute URI addressing the artifact (§4).
- **ASYNC-D-03**: `selector` is the exact edition-native operation pointer and resolves to an operation (§7).

Processor rules:

- **ASYNC-P-01**: accept only the exact editions in §3 and preserve edition semantics through normalization.
- **ASYNC-P-02**: preserve application perspective and delegate concrete protocol behavior to AsyncAPI's binding objects and a capable driver (§8, §9.1).
- **ASYNC-P-03**: carry application message payload values without protocol-shaped ordinary fields; declared headers and location-less channel parameters are application data riding the routed envelope, never payload fields (§9.2).
- **ASYNC-P-04**: resolve artifact-declared alternatives and missing choices — including an artifact that declares no server, whose reachability is consumer configuration — explicitly through context, never payload guessing and never a synthesis exclusion (§9.3).
- **ASYNC-P-05**: delegate encoding and decoding to the artifact's schema, format, binding, driver, and codec authorities; carry a Schema Object into an OBI schema position only under semantic-preserving dialect translation, with the unconstrained-and-accounted fallback for declared non-JSON-Schema representations; carry declared binary media through the artifact-authorized byte rule (canonical Base64 boundary, lossy-accounted when a declared contract is not the boundary schema); and confine any schema defect to the affected operation direction (§9.2).
- **ASYNC-P-06**: preserve emergent lifecycle and distinguish outputs from unsuccessful completion (§9.4).
- **ASYNC-P-07**: keep security and protocol evidence below the ordinary operation-value boundary (§9.3, §9.5).

Conformance to this binding candidate and conformance to a particular protocol driver are separately reportable. A processor can conform to the outer family while advertising only a subset of drivers, provided it reports missing capability loudly and never misrepresents that subset as the binding specification's protocol scope.

## 12. References

- **[AsyncAPI]** AsyncAPI Initiative, "AsyncAPI Specification," exact editions 2.0.0, 2.1.0, 2.2.0, 2.3.0, 2.4.0, 2.5.0, 2.6.0, 3.0.0, and 3.1.0, each at the immutable [`asyncapi/spec`](https://github.com/asyncapi/spec) commit enumerated in [§2](#2-purpose-scope-and-authority). Incorporated authority for the artifact and its application perspective. The [rendered specification pages](https://www.asyncapi.com/docs/reference/specification/) are informative for this identifier.
- **[AsyncAPI Bindings]** AsyncAPI Initiative, "AsyncAPI protocol bindings," the published collection at [`asyncapi/bindings`](https://github.com/asyncapi/bindings) tag `v3.1.0`, commit [`ec5c590d4212905a13014cfd43f72fb086c00e85`](https://github.com/asyncapi/bindings/tree/ec5c590d4212905a13014cfd43f72fb086c00e85). Incorporated authority for concrete protocol semantics wherever a binding speaks ([§9.1](#91-protocol-and-driver-delegation)); the repository's default branch is informative.
- **[Avro]** Apache Software Foundation, "Apache Avro Specification," edition **1.9.0**, at the immutable [`apache/avro`](https://github.com/apache/avro) tag `release-1.9.0`, commit [`3c76495e9524ef322726d03d7ee406be89e8fde0`](https://github.com/apache/avro/blob/3c76495e9524ef322726d03d7ee406be89e8fde0/doc/src/content/xdocs/spec.xml), at `doc/src/content/xdocs/spec.xml`. Incorporated authority for the named Avro correspondence and its JSON Encoding ([§9.2](#92-application-values-messages-and-schemas)), including the Names rule that decides whether a declared Avro schema is valid at all; 1.9.0 is the sole Avro version every accepted AsyncAPI edition registers. The [rendered specification page](https://avro.apache.org/docs/1.9.0/spec.html) — the page AsyncAPI's own schemaFormat registry hyperlinks — is informative for this identifier.
- [Migrating to AsyncAPI 3.0.0](https://www.asyncapi.com/docs/migration/migrating-to-v3) (informative)
- **[RFC 6901]** "JavaScript Object Notation (JSON) Pointer." <https://www.rfc-editor.org/rfc/rfc6901>
- **[YAML 1.2.2]** YAML Language Development Team, "YAML Ain't Markup Language, version 1.2.2." <https://yaml.org/spec/1.2.2/>. Binding-specification pin for string-carried documents.
