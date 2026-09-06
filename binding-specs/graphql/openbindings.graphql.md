# `openbindings.graphql` Binding Specification

**Status: unreleased `@1` candidate.** This mutable page does not mint `openbindings.graphql@1`. Its remaining publication gate is the explicit promotion and reference-tooling adoption change required by the [binding-specification lifecycle](../README.md#publication-lifecycle); until then, implementations may cite it only as a candidate, not as a published OpenBindings identifier. Sections 5 to 9 of this candidate are being drafted under the program recorded in `audit/graphql-family-2026-09-06` of the project container; each such section names its queue item in place of its text.

## 1. Identifier and rule labels

**[convention]** The opaque binding-specification identifier has exactly the spelling **`openbindings.graphql@1`**, because Core OBI-B-01 makes an identifier opaque and states no spelling, so the publisher fixes one.

**[convention]** OpenBindings Project publication mints §1's proposed identifier; before that project lifecycle event, this page is a mutable candidate and the identifier is not project-published, because Core OBI-B-01 reserves minting to the publisher and states no candidate stage of its own.

**[incorporated]** Once minted, the identifier is exact and stable under Core [OBI-B-01](../../openbindings.md#104-binding-specification-rules), and an incompatible change to the accepted domain or portable meaning requires a different identifier under Core [OBI-B-03](../../openbindings.md#104-binding-specification-rules).

**[incorporated]** One identifier may govern several exact upstream editions (Core [§6](../../openbindings.md#6-binding-specifications)). This identifier governs the three GraphQL editions §2 accepts. Accepting a later edition after publication is an incompatible change to the accepted domain and therefore a new identifier under OBI-B-03, whatever the later edition changes.

**[incorporated]** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) only when they appear in all capitals.

**[convention]** Every normative paragraph and normative table row carries one visible provenance label. An `incorporated` rule is one the cited source states, and the citation names that source, whether an incorporated authority or the OpenBindings Core; the remaining five are this specification's own explicitly classified bridge. A `convention` is a choice this specification makes where no authority speaks, and it states why the earlier rungs of the [deference order](../README.md#the-deference-order) did not answer. A `pin` resolves a question the cited authority leaves open between readings it admits, and discloses the losing reading. A `configuration point` names a choice a consumer supplies, its admissible values, and the effect of each. An `exclusion` declines an upstream-valid feature and names the authority event that would reopen it. A `limit` states a boundary of this specification's coverage that is neither a defect nor a deferral.

## 2. Scope and incorporated authorities

**[convention]** This binding specification defines how GraphQL executable documents and schemas govern OpenBindings sources against a live GraphQL service: which sources are accepted and when loading refuses, how operation targets are addressed and synthesized, what an invocation's inputs and outputs mean, and which wire mechanics the incorporated transports fix. The scope is this specification's own because Core states no scope for a family beyond OBI-B-02's floor.

**[pin]** This specification incorporates exactly version **0.2.0** of the [OpenBindings Specification](../../openbindings.md) as its Core authority. Throughout this document, **Core** means that exact version; no other Core version is incorporated.

**[convention]** This specification accepts exactly three editions of the GraphQL Specification, each incorporated as the source tree of the `graphql/graphql-spec` repository at the commit its release tag names: **September 2025** at commit `89d93ebbe05db06787646d76a696ead8de117b2b`, **October 2021** at commit `51337a9b820e296fa7d03ae77d534cb4b247c201`, and **June 2018** at commit `cdf792cf3b21584cc65b353d7f5eb90e4116f707`. Section numbers in this document cite the September 2025 edition unless another edition is named. No GraphQL artifact declares its edition, so acceptance is not an artifact gate: the three editions are the introspection shapes a live service may present (§3.3), and every carried document and schema is read under the governing text below. The accepted set is this specification's own because no artifact declares an edition and no authority states which editions a live service may speak; it is the three editions released as of this revision.

**[pin]** For every rule in this specification the governing GraphQL text is the September 2025 edition, with one stated exception: the five introspection members that October 2021 and September 2025 added (§3.3) are read, when absent from a pinned introspection result or unobserved on a live service, under the earlier edition that lacks them. This pin is between two readings the editions leave open: govern every source under the newest accepted edition, or govern each source under the edition its service is discovered to speak. The first is pinned because one identifier carries one meaning (Core OBI-B-01), because the three editions agree on every wire correspondence this specification defines, and because no artifact declares its edition, so the losing reading would make the same document mean different things under one identifier depending on a live probe. The observable consequences of the pin are stated as limits: the seven places where September 2025 validates more strictly than an earlier edition (§5), and the September 2025 grammar an older service refuses with a request error that §8's classification already carries.

**[convention]** The [GraphQL over HTTP draft](https://github.com/graphql/graphql-over-http/blob/d746195047ac4ae5c4bb11042b4941e6631726e8/spec/GraphQLOverHTTP.md) is incorporated at commit `d746195047ac4ae5c4bb11042b4941e6631726e8` of `graphql/graphql-over-http` as the transport for queries, mutations, and live introspection (§8), and for the request of the graphql-sse lane, which that protocol defers to it. The [graphql-ws protocol](https://github.com/enisdenjo/graphql-ws/blob/839ca7d652004513a063dd44e9bcfe7a3301f6f0/PROTOCOL.md) at commit `839ca7d652004513a063dd44e9bcfe7a3301f6f0` of `enisdenjo/graphql-ws` and the [graphql-sse protocol](https://github.com/enisdenjo/graphql-sse/blob/0e899300dca583cd5aa5a2fa1d4f15d6e9cafb0e/PROTOCOL.md) at commit `0e899300dca583cd5aa5a2fa1d4f15d6e9cafb0e` of `enisdenjo/graphql-sse` are incorporated as the two subscription transports (§9). Each is incorporated immutably at the cited commit; a later commit is a different authority and reopens nothing by itself. The transports are this specification's choice because the GraphQL specification defines no transport and states no rule for carrying a request over HTTP or a socket.

**[convention]** [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) governs the HTTP semantics the over-HTTP draft does not restate, [RFC 9112](https://www.rfc-editor.org/rfc/rfc9112) the HTTP/1.1 message framing fields §8 reserves, [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259) the JSON texts on every lane, [RFC 6265](https://httpwg.org/specs/rfc6265.html) the cookie contributions of §8, the [WHATWG URL Standard review draft of August 2026](https://url.spec.whatwg.org/review-drafts/2026-08/) the `application/x-www-form-urlencoded` serialization of §8's GET lane, [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455) the WebSocket handshake and closure of §9's graphql-ws lane, and the [W3C Server-Sent Events Recommendation of 3 February 2015](https://www.w3.org/TR/2015/REC-eventsource-20150203/) the event-stream format of §9's graphql-sse lane. Every authority named in §12 is incorporated at the scope its citation states, immutably at the revision cited, because the over-HTTP draft and the two protocol documents cite those authorities and the draft does not state their rules itself.

**[pin]** The graphql-sse protocol defers to the W3C event-stream text through an undated pointer to its latest version, and to the over-HTTP draft through a pointer to that repository's `main` branch. This specification pins the first to the Recommendation of 3 February 2015, the W3C's last Recommendation of the format, and the second to the over-HTTP commit §2 incorporates, because an incorporated authority must be immutable at a cited revision; the losing readings, the WHATWG HTML Living Standard's server-sent-events section that the protocol's introduction also links and the moving `main` branch, are disclosed and rejected because neither has a fixed revision to cite.

**[convention]** Where two incorporated authorities answer one decision differently, this specification states the precedence at that decision rather than in the abstract, and discloses the losing reading there, because no authority ranks another and an abstract ranking would decide cases neither authority has seen. Three such decisions exist: the `charset` parameter on a JSON response, between the over-HTTP draft's assumption and RFC 8259's encoding rule (§8); the `Accept` value of the graphql-sse request, between the over-HTTP draft's media-type requirement and graphql-sse's event-stream requirement (§9); and the `complete` event of the graphql-sse lane, between graphql-sse's own note and the W3C Recommendation's dispatch step (§9).

**[incorporated]** This document defines portable binding meaning, not an invocation API: request objects, retry and redirect APIs, cancellation, credential acquisition, socket reuse, timeout values, and proxy configuration remain runtime or application concerns under Core [§1.2](../../openbindings.md#12-out-of-scope).

**Where Core's completeness items are discharged.** Core [OBI-B-02](../../openbindings.md#104-binding-specification-rules) names seven things a binding specification defines for the sources and bindings it governs. The table below maps each to the sections that carry it. The third column names what this specification does not cover at that item: a point at which it states no portable meaning. The table is a reader's map, not a rule; where the table and a numbered section disagree, the section governs. Every entry is either "nothing recorded", a stated limit with its section, or, in this candidate only, a drafting-pending marker that the next paragraph governs.

| Core OBI-B-02 item | Carried by | what this specification does not cover there |
| --- | --- | --- |
| 1 — whether a source mode accepts an artifact, the representations accepted, deterministic discrimination between them, and the encoding for any non-JSON artifact | §2, §3.1, §3.2, §3.3 | nothing recorded: the family is service-addressed, both carried artifacts are JSON strings or JSON objects, and discrimination between the two `schema` representations is by JSON type. |
| 2 — the syntax and meaning of `location` | §3.1, §4 | nothing recorded: §4's limit states that acquisition failure at the endpoint is the address scheme's own affair and §8 classifies the responses that do arrive. |
| 3 — the accepted values and meaning of `content`, including any source mode in which `content` is forbidden | §3.1, §3.2, §3.3, §4 | nothing recorded. §4 states that no mode forbids `content` and that `content` is REQUIRED in the only mode this specification governs, so the clause is answered in the affirmative direction rather than left to entailment. |
| 4 — how `location` and `content` compose within the content-primacy floor, including whether `location` supplies a reference base for embedded content | §3.3, §4 | nothing recorded: GraphQL has no references, so `location` supplies no reference base, and §4 states the staleness posture the README asks of service-addressed families. |
| 5 — the syntax and meaning of `selector`, including the absent-`selector` case | §3.2, §5 | drafting pending under queue item P3-3. |
| 6 — how the binding target and its interaction are identified | §3.2, §3.3, §4, §5, §8, §9, §11.1, §11.2 | drafting pending under queue items P3-3, P3-4, and P5 for §5, §8, and §9. |
| 7 — how caller-facing input and successful output values correspond to the source interaction, which outcomes are successes, when the interaction instead completes unsuccessfully, how values emitted before that completion are treated, and any context bindings at transform positions | §6, §7, §8, §9, §11.1, §11.2 | drafting pending under queue items P3-4 and P5. |

**[convention]** Where §2's item map records a drafting-pending entry, that record licenses nothing: the candidate does not exist as a complete boundary until the entry is replaced, and no implementation may attribute a completion of that point to this identifier. This paragraph is removed with the last such entry; it exists because Core states no candidate stage and a reader must not mistake an unfinished boundary for a finished one.

**[convention]** OBI-B-02 is a floor, not a partition, and this document carries content above it. A rule no item above reaches is not thereby surplus: §3.3's normative introspection query, §4's staleness posture, and §10's security statement are this specification's content whether or not an item names them, because OBI-B-02 states no ceiling.

## 3. Source carriage and refusal architecture

### 3.1 Accepted representations

**[convention]** This family is **service-addressed**: `location` names a live GraphQL HTTP endpoint, and `content` carries the executable document that denotes the source's operations together with, optionally, the schema those operations are validated and typed against and the endpoint on which subscriptions are served. `content` is REQUIRED (§4); `location` is REQUIRED (§4). No other representation is accepted, because a GraphQL service is addressed by its endpoint and no artifact form names one.

**[convention]** `content` MUST be a JSON object with exactly these members and no other, because neither artifact alone can bind an operation, as the paragraph after the list states:

- `document` (REQUIRED, string): the source text of one executable GraphQL document under the governing edition's grammar (§2 of that edition). The JSON string's code points are the document's `SourceCharacter` sequence; no transport-encoding question arises because JSON carries code points, and a leading or embedded U+FEFF is an ignored token exactly as §2.1 of the governing edition states. One document per source; documents share fragments internally, which is why the unit of carriage is the document and not the operation.
- `schema` (OPTIONAL, string or object): when a string, the source text of a type-system document under §3 of the governing edition, read as `SourceCharacter` code points exactly as `document` is; when an object, the execution result of an introspection query with an object at `data.__schema` and no `errors` entry. Discrimination between the two is by JSON type. When present, `schema` is the interpreted schema and displaces live introspection (§3.3, §4); when absent, the processor introspects `location` under §3.3.
- `subscriptions` (OPTIONAL, object): exactly `{"transport": <"graphql-ws" | "graphql-sse">, "location": <absolute URI>}`, naming the endpoint and protocol on which the document's subscription operations are served. `location` MUST be an absolute URI (§4's definition) whose scheme is `ws` or `wss` when `transport` is `graphql-ws` and `http` or `https` when it is `graphql-sse`; any other pairing refuses at load (§3.2). The member is OPTIONAL in the content shape and never a load gate: when it is absent and the document contains a subscription operation, every subscription operation definition in the document is accounted `invalid` for want of a target, its selector resolves because the definition is addressable, its invocation refuses before dispatch, and queries and mutations are unaffected (§9). No default is derived, because a derived endpoint would be wrong for every deployment whose realtime endpoint differs from `location` in host or path, and would fail only at first connection rather than at load.

**[convention]** The three-member envelope is this specification's own: GraphQL has two artifacts, an executable document and a schema, and Core carries one `content` value, and neither artifact alone can bind an operation, since a document without a schema cannot be validated or typed and a schema without a document denotes no operation. The rejected alternatives were a root-field target with a derived selection (it authors wire behaviour no authority states), a selection set supplied by the caller (the output ceases to be a contract), and an introspection-only `content` (it cannot carry the executable document and refuses the normative type-system language).

**[incorporated]** Both member syntaxes are the authority's: the executable-document grammar is §2 of the governing edition, the type-system language is §3, and the introspection result shape is §4.2, whose listing defines the `__Schema`, `__Type`, `__Field`, `__InputValue`, `__EnumValue`, and `__Directive` types this specification consumes.

**[convention]** `subscriptions` lives in the carried content and not in configuration because it is target identity: Core [OBI-D-13](../../openbindings.md#102-document-rules) requires the information needed to identify a binding's target to be in the binding and its source alone, so no configuration point may supply or replace it (§11.1).

### 3.2 Closed load gates and confined defects

**[convention]** Source loading, target addressability, synthesis accounting, and invocation outcome are independent axes. A result on one axis changes another only where a rule in this document states that propagation explicitly, because no authority couples them and an implicit coupling would let a defect on one axis change an outcome on another silently.

**[convention]** A source **refuses at load** only at §3.2's closed gates. After those gates, a source **refuses as a source**, at resolution, only when no addressable target remains. A source-level **exclusion** instead declines an upstream-valid feature under a stated coverage limit; it is not a defect, and this revision declares none at source scope. This architecture is this specification's own, because no incorporated authority defines source loading, and it is stated in the three parts every project binding specification uses ([whole-source refusal](../README.md#whole-source-refusal-and-what-it-is-not)) so that a reader of a sibling can predict it.

**[convention]** An **addressable target** is an operation definition in the parsed document that a conformant `selector` can reach: a named operation definition whose name no other operation definition in the document shares, or the lone operation definition of the document, which may be anonymous. An operation definition that is anonymous while not alone, or that shares its name with another, occupies no addressable position. A defect at an addressable target or below does not erase its addressability: a `selector` naming an addressable target resolves even when that target is accounted `invalid` or `excluded`, and invocation then refuses before dispatch; a selector reaching no addressable target does not resolve and invocation refuses at resolution (§5). Addressability is defined this way because §6.1 of the governing edition resolves an operation by its name or as the document's sole operation and no authority defines any other way to reach one.

**[convention]** Synthesis accounts each operation definition as **represented** when an emitted operation and binding preserve the operation's meaning; **invalid** when the owning definition is upstream-invalid or this specification's own rules make it so; **excluded** when this specification removes an upstream-valid unit under a stated exclusion; **lossy** when an emitted operation's contract cannot state part of the source's meaning; or **implementation-unsupported** when this specification defines a behaviour an implementation does not implement. Where an operation definition qualifies for more than one, the first in the order `invalid`, `excluded`, `implementation-unsupported`, `lossy`, `represented` is its disposition. A **projection** entry records a schema-fidelity concern at one position of a represented or lossy operation, named by schema coordinate (§2.14 of the governing edition) or by §7's rule for positions no coordinate names, without being a disposition. These spellings are normative within this specification and do not depend on any interface-synthesizer contract (§11.2); they are this specification's own because Core states no coverage vocabulary and two synthesizers must report alike, and they are the spellings every project binding specification uses.

**[convention]** An addressable target that is `invalid` or `excluded`, or whose invocation requires a configuration point it lacks, **refuses before dispatch** when invoked. A **context-required** refusal names a configuration point or credential that can make the same invocation proceed; a plain **refusal** names a condition no supplied context can change. Neither reaches the wire or has an observable side effect at the service, because no authority defines a pre-dispatch refusal and a loud refusal before the wire is the choice under which nothing is guessed.

**[convention]** An interaction that reaches the wire and whose outcome §8 or §9 does not admit as successful **completes unsuccessfully**. Values already emitted before an unsuccessful completion stand as successful values at the moment they crossed the operation boundary (§7, §9); no later ending withdraws them, because Core §5.1 states the output contract per value as it crosses and no authority withdraws a delivered value.

**[limit]** The load gates are the following closed ordered set, and no condition outside it is a load gate:

1. **`location` presence, absoluteness, and scheme** (§4): absent, not a string, not an absolute URI, or a scheme other than `http` or `https`.
2. **`content` shape** (§3.1): absent, not an object, a missing `document`, a `document` that is not a string, a `schema` that is neither string nor object, an unknown member, or a `subscriptions` member that is not exactly the two-member object of §3.1 or whose `transport` and `location` scheme do not pair.
3. **Document grammar**: `document` does not parse as a `Document` under §2 of the governing edition, or parses but contains a type-system definition or extension, of which §2.3 of the governing edition says "A Document which contains TypeSystemDefinitionOrExtension must not be executed", so the failure is the document's and not one operation's.
4. **Schema grammar**: a string `schema` does not parse as a type-system document under §3 of the governing edition; an object `schema` has no object at `data.__schema` or carries an `errors` entry. With `schema` absent, the live introspection of §3.3 precedes this gate as the family's schema acquisition, exactly as a location-only OpenAPI source is dereferenced before its representation gate, and a request error result or a null `data` at either introspection step fails this gate, because no interpretable schema representation arrived.
5. **Schema validity** of the interpreted schema, carried or live-introspected alike, under exactly the subset of the governing edition's §3 type-validation rules whose violation makes correspondence undefined: a type referenced but not defined, where in an introspection result a type is referenced by `queryType`, `mutationType`, `subscriptionType`, an `interfaces` or `possibleTypes` entry, or the innermost `name` of an `ofType` chain, and is defined when `types` holds an entry of that `name`; a field or argument without a type; two fields or two arguments of one definition with the same name; a non-input type in an argument or input-field position; a non-output type in a field position; and a `query` root operation type that is absent or is not an Object type, which §3.3.1 says "must be provided and must be an Object type". In an introspection result the last is `__Schema.queryType` null or naming a type whose kind is not `OBJECT`.

**[limit]** A mutation or subscription operation whose root operation type the schema does not provide is not a load failure, because §3.3.1 of the governing edition makes those two roots optional; it is a validation failure under §5.2.1.1 of the governing edition and is handled by §5's validation rule. Documentation-only constraints of the governing edition (deprecation placement, default-value compatibility, deprecation inheritance) are never load gates, and an introspection result that carries an unreferenced built-in scalar is accepted.

**[convention]** Which §3 rules gate is this specification's choice, with this reason: a rule whose violation changes no correspondence has no binding consequence to attach to, and a rule whose violation leaves a type unresolvable or a position untyped has no confined owner, because no contract can be derived below it.

**[limit]** **§3.2's smallest-owner rule**: after the load gates pass, a defect confines to its smallest owning unit, and an unreachable defect destroys no target. The owning units are, from largest to smallest: the source's target inventory, for a validation failure under §5 of the governing edition (§5 of this document states why every such failure is inventory-wide; §5.1.1's executable-definitions rule is the one exception, because gate 3 already refuses it at load under §2.3); one operation definition, for the operation-scoped failures this specification itself defines, which are §3.3's structural-member rule and the absent `subscriptions` member of §3.1; one variable or one selection position, for a value-level projection concern (§6, §7).

**[limit]** **§3.2's source-refusal rule**: after the closed load gates, a source refuses as a source, at resolution, only when the document declares at least one operation definition and no addressable target remains: every operation definition is either anonymous while not alone or shares its name with another. A target-confined invalidity never contributes to this rule: a document whose every operation definition is accounted `invalid` under §5 loads, its selectors resolve, and every invocation refuses before dispatch.

**[incorporated]** A document with no operation definition is accepted and synthesizes no operation: §2.3 of the governing edition says such documents "may still be parsed and validated to allow client tools to represent many GraphQL uses", and an empty target inventory has nothing to invalidate; the failure its unused fragments incur under §5.5.1.4 reaches no operation, so such a document denotes no target rather than a destroyed one.

**[limit]** How a processor names or presents a confined defect is not portable meaning of this identifier. It MUST identify the affected unit and the responsible position in the document or schema well enough to make the confinement observable, but this specification defines no defect-class taxonomy, per-class authority citation, or per-defect coverage-entry vocabulary.

**[limit]** An `invalid` or `excluded` operation definition is removed from the effective inventory consumed below its owning boundary: no synthesis, dispatch, or classification rule reads it as usable. Removal does not erase its addressable position.

### 3.3 Schema interpretation

**[convention]** The **interpreted schema** is the schema every rule of this specification validates and types the document against: the carried `schema` when present, and otherwise the result of live introspection under this section. Exactly one interpreted schema exists per source per interpretation, because §6.1 of the governing edition validates and executes a document against exactly one schema.

**[incorporated]** A string `schema` is read under §3 of the governing edition as a type-system document.

**[convention]** Its definitions are applied first and its extensions after them, in document order, so that an extension may precede the definition it extends; an extension whose target the document does not define is a referenced-but-undefined type at gate 5. The order is this specification's own because §3.1 of the governing edition defines extensions and states no application order.

**[convention]** An object `schema` is read as the execution result of the following introspection query, which this specification lists normatively. A pinned result MUST carry at least the result of this query; a result that carries more is read for exactly the members below. The query is listed because no edition lists an introspection query and two implementations must consume one member set; its members are exactly the members the derivations of §5 to §7 read.

```graphql
query OpenBindingsIntrospection {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types { ...FullType }
    directives {
      name
      locations
      isRepeatable
      args(includeDeprecated: true) { ...InputValue }
    }
  }
}

fragment FullType on __Type {
  kind
  name
  specifiedByURL
  isOneOf
  fields(includeDeprecated: true) {
    name
    args(includeDeprecated: true) { ...InputValue }
    type { ...TypeRef }
    isDeprecated
    deprecationReason
  }
  inputFields(includeDeprecated: true) { ...InputValue }
  interfaces { ...TypeRef }
  enumValues(includeDeprecated: true) {
    name
    isDeprecated
    deprecationReason
  }
  possibleTypes { ...TypeRef }
}

fragment InputValue on __InputValue {
  name
  type { ...TypeRef }
  defaultValue
  isDeprecated
  deprecationReason
}

fragment TypeRef on __Type {
  kind
  name
  ofType {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

**[convention]** The members that query requests are the **consumed members**, and every derivation in this specification reads only them: on `__Schema`, `queryType`, `mutationType`, `subscriptionType`, `types`, and `directives`; on `__Type`, `kind`, `name`, `specifiedByURL`, `isOneOf`, `fields`, `inputFields`, `interfaces`, `enumValues`, `possibleTypes`, and `ofType` on every element whose `kind` is `LIST` or `NON_NULL`, which the listed query carries to nine levels; on `__Field`, `name`, `args`, `type`, `isDeprecated`, and `deprecationReason`; on `__InputValue`, `name`, `type`, `defaultValue`, `isDeprecated`, and `deprecationReason`; on `__EnumValue`, `name`, `isDeprecated`, and `deprecationReason`; and on `__Directive`, `name`, `locations`, `isRepeatable`, and `args`. Descriptions are consumed by no derivation. The directive members are consumed because §5.7.1 to §5.7.3 of the governing edition validate directive existence, location, and repetition.

**[convention]** A consumed member that is **absent**, as distinct from present with `null`, at an element a selected operation reaches has one of two consequences. An **annotative** member (`defaultValue`, `isDeprecated`, and `deprecationReason`, at any element, save the five edition exceptions below) makes the owning operation `lossy`, with a projection entry naming the element and the member, and the derivation reads the member as declaring nothing. Every other consumed member is **structural**: without it no contract can be derived, and its absence makes every operation reaching the element `invalid`. The split covers every consumed member outside the five edition exceptions. A consumed member present with `null` at a position §4.2 of the governing edition declares non-null (`queryType`, `types`, and `directives` on `__Schema`; `kind` on `__Type`; `name`, `args`, `type`, and `isDeprecated` on `__Field`; `name`, `type`, and `isDeprecated` on `__InputValue`; `name` and `isDeprecated` on `__EnumValue`; `name`, `locations`, `isRepeatable`, and `args` on `__Directive`) is read as absent, with its class's consequence, because no service can produce such a result and the fact it would have carried is missing. Absence has these two consequences because a pinned result declares no edition and the authority states no rule for a member a result omits; the structural class is the set without which no contract can be derived, and the annotative class is the set whose absence loses a declared fact and nothing else.

**[incorporated]** Five consumed members are exceptions, because a pinned result declares no edition and the earlier accepted editions lack them: `__Type.specifiedByURL` and `__Directive.isRepeatable` were added in October 2021, and `__Type.isOneOf`, `__InputValue.isDeprecated`, and `__InputValue.deprecationReason` in September 2025 (§4.2 of each edition). An absent `specifiedByURL` is read as `null`, an absent `isRepeatable` as `false`, an absent `isOneOf` as `false`, and an absent `__InputValue.isDeprecated` and `deprecationReason` as `false` and `null`, each the earlier edition's own declaration, with no `lossy` disposition.

**[limit]** A result taken from a September 2025 service by a query that omitted `isOneOf` is indistinguishable from an earlier edition's result and loses the OneOf constraint in the emitted input schema (§6 states this as one of its disclosed floor breaches); the service's request error for a violating value classifies as an unsuccessful completion under §8. An author avoids it by taking the pinned result with the listed query.

**[limit]** The introspection arguments `includeDeprecated: true` change the length of a list, not the presence of a member, and a result taken without them is indistinguishable from a schema with nothing deprecated. This specification requires a pinned result to be the complete result of the listed query and states that it cannot detect a result taken otherwise; the derived contract of such a result omits deprecated fields, arguments, input fields, and enum values the service still serves.

**[limit]** The listed query's `TypeRef` fragment carries nine nested `ofType` levels, so a named type reached through more than nine list and non-null wrappers is not carried: the tenth wrapper's `ofType` is a structural absence at the element that reaches it, and every operation reaching that position is `invalid`. A string `schema` has no such bound. Nine is this specification's choice, with the reason that a listed query must be finite and nine exceeds by a margin the deepest chain any accepted edition's own text exhibits; the losing reading, an unbounded chain, is not expressible in a listed document.

**[convention]** No derived schema is ever an empty `anyOf`: a selection on an abstract type with no possible types, an interface no object implements or a union with no member types, derives `{"type": "null"}` at a nullable position and `false` at a non-null one, because value completion under §6.4.3 of the governing edition can resolve no concrete type there and the field completes to null or to an execution error (§7).

**Live introspection.** The following rules apply when `schema` is absent.

**[convention]** The processor first sends one edition-independent **capability probe**, listed normatively and exactly the document below. That `__type(name:)` resolves an introspection type by name is stated only by its signature and, in October 2021 and September 2025, by §4.2's requirement that "any named type which can be found through a field of any introspection type must be included" in the schema's type set; no edition states what it resolves, so the probe is this specification's bridging convention in every edition, chosen because it is the one selection every accepted edition parses and answers.

```graphql
query { t: __type(name: "__Type") { fields { name args { name } } } f: __type(name: "__Field") { fields { name args { name } } } d: __type(name: "__Directive") { fields { name args { name } } } i: __type(name: "__InputValue") { fields { name } } }
```

**[convention]** The probe's four positions observe every optional member and argument the listed query carries: `specifiedByURL` and `isOneOf` on `__Type`, `isRepeatable` on `__Directive`, `isDeprecated` and `deprecationReason` on `__InputValue`, and the `includeDeprecated` argument on `__Type.inputFields`, `__Field.args`, and `__Directive.args`. Four positions suffice because those are the only consumed members and arguments any accepted edition added after June 2018; `__Schema.description`, added in October 2021, is consumed by no derivation and needs no position.

**[convention]** The processor then composes the **introspection query** from the listed query of this section by removing each optional member or argument the probe did not observe, and sends it. A probe position that resolves to `null` observes no capability for that type, and the base selection is used for it whatever `__schema.types` would have shown, so that one probe shape fixes one composition; a composed query therefore requests exactly what the service has, and a service that implemented the additions incrementally is served rather than refused. This is the preserve rung, because refusing a service on which a probe position resolves to `null` would reject a working June 2018 service, and reading a null as no capability is the only reading under which the composed query is valid on every accepted edition.

**[convention]** A request error result or a null `data` at either step refuses the source at load, at §3.2's gate 4, because a service that answers the probe or the composed query with a request error discloses no interpretable schema, no operation can be typed, and no authority states what a client does with such an answer. Gates 4 and 5 then apply to the live result exactly as to a carried one.

**[convention]** Both introspection requests are always POST, whatever §8's `httpMethod` selects, because the composed query's length has no guaranteed URL carriage and the over-HTTP draft requires POST support of every service. Both carry the same configured `protocolFields`, the same configured `extensions` map, and the same credentials the invocation will send, so the schema observed is the schema that invocation's request reaches. The interpreted schema is the one those requests obtain when the source is loaded for an invocation, so a schema-absent source is loaded with that invocation's credentials.

**[limit]** Whether a runtime loads a schema-absent source once per invocation or reuses a loaded source across invocations that carry the same credentials is runtime policy under Core §1.2; a runtime that reuses one accepts §4's staleness posture for the reused interval.

**[limit]** With `schema` absent, the interpreted schema is whatever the service discloses to the invocation's own credentials, so a role-filtered or contract-variant service yields a contract that varies by caller. Portability of a contract across callers is obtained by pinning `schema`; a live-introspected contract is a claim about one credential set. The alternative, refusing live introspection, would narrow the dominant case in which a document is carried against a service the author does not control.

**[convention]** Live introspection always composes `includeDeprecated: true` at every position the service exposes the argument, so it is subject to the `includeDeprecated` limit above only for a service that deprecates a position without exposing the argument for it, which no accepted edition permits; this specification states that as the residual case, because the arguments are the authority's own way of asking for the complete set and omitting them would hide declared facts.

## 4. `location`, `content`, and composition

**[incorporated]** A present `location` MUST be an absolute URI (Core [OBI-D-05](../../openbindings.md#102-document-rules)); a bare filesystem path is not conformant.

**[pin]** Core OBI-D-05 requires an absolute URI, and [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) defines both `URI` (§3), which admits a fragment, and `absolute-URI` (§4.3), which does not. This specification pins `absolute-URI` here and at `content.subscriptions.location` alike, because a fragment has no meaning at an HTTP or WebSocket endpoint and one grammar must decide the load gate; the losing reading, admitting a fragment, is disclosed.

**[convention]** `location` is REQUIRED and its scheme MUST be `http` or `https`; it names the GraphQL HTTP endpoint that serves the document's queries and mutations and answers live introspection. The scheme set is this specification's choice, because the over-HTTP draft is the only incorporated transport for single-result operations and defines no other scheme, so a `location` in another scheme has no incorporated mapping and refuses at load (§3.2).

**[limit]** Whether a request to `location` yields a response at all is the address scheme's own affair: a name-resolution failure, a connection failure, a TLS failure, or a runtime's timeout is decided by the scheme and the runtime, and §8 states the one outcome this specification attaches to a request that yields no response. Responses that do arrive are classified under §8.

**[convention]** `location` supplies no reference base, because GraphQL documents and schemas contain no references, so Core [§7](../../openbindings.md#7-reference-resolution) is never entered by this family.

**[convention]** `content` is REQUIRED. No source mode this specification governs forbids `content`: the only mode it governs is the one in which `content` carries the document, so the set of `content`-forbidding modes Core [OBI-B-02](../../openbindings.md#104-binding-specification-rules) item 3 asks for is empty, and a location-only source is not accepted, because a source without a document denotes no operation. This discharges item 3's forbidden-mode clause in the opposite direction, stated explicitly, at the refuse rung: the alternative, deriving a document from the schema, authors an operation no author wrote.

**[incorporated]** `content` has primacy (Core [§5.4](../../openbindings.md#54-sources)): a present `schema` is the interpreted schema and the processor never replaces it with an introspected one, and the carried `document` is the document sent, never rewritten (§5).

**[convention]** Composition is therefore fixed: `location` is the invocation target of every query and mutation and the introspection point of §3.3; `content.document` denotes the operations; `content.schema`, when present, is the interpreted schema, and when absent `location` supplies it; `content.subscriptions`, when present, is the invocation target of every subscription. No member of `content` is retrieved from `location` and no member of `location` is derived from `content`, because no authority defines a retrieval of a document from an endpoint or a derivation of an endpoint from a document.

**Staleness posture.** The README asks a service-addressed family to state what happens when a pinned artifact and the live service disagree. This family's posture has two faces.

**[convention]** A pinned `schema` is interpreted as carried, because Core §5.4 gives content primacy and no authority defines a repair of a carried schema. Dispatch proceeds against it; the processor never re-introspects to repair a pin, and a live service that rejects a document the pin validated produces that service's own request error result, which classifies as an unsuccessful completion under §8.

**[pin]** A service that has evolved beyond the pin, with a new enum value, a new implementation of an interface, or a new field, succeeds while the contract derived from the pin does not admit its value, because the derived `output` is closed exactly as the pinned schema is closed (§7). That is staleness too, not a defect of the derivation: the governing edition's own result coercion returns one of the schema's defined set of values, and the defined set is the pinned schema's, so a closed contract is the faithful contract for the schema carried. Two readings survive for the invocation: emit the value as the service returned it, or validate every execution result against `output` and fail loudly on a mismatch. This specification pins the first, because Core §5.1 makes `output` a claim the document states and the binding attests, not a check the binding performs, and the project's OpenAPI siblings decode a response without validating it against the declared schema, so this family answers alike; the losing reading is disclosed and rejected because it would make the binding's behaviour a runtime test of the document's own claim and would fail a partial result whose nulls §7 already admits. Whether a consumer validating the emitted value against `output` treats the disagreement as a contract breach is the consumer's, and the drift is the author's to repair.

**[convention]** Drift of either face is repaired by the document author, by re-pinning `schema` or by omitting it, in which case live introspection tracks the service and an additive change is absorbed at the next interpretation. Pinning is the author's choice of a stable contract over a current one, and this specification says so rather than choosing for the author, because no authority states which of the two an author wants.

## 5. Selector, operation resolution, and document validation

*Drafting pending under queue item P3-3 of the program; the settled design is §4 of the current revision of `ARCHITECTURE-RULINGS.md`.*

## 6. Caller envelope and input contract

*Drafting pending under queue item P3-4 of the program; the settled design is §5 of the current revision of `ARCHITECTURE-RULINGS.md`.*

## 7. Output contract and custom scalars

*Drafting pending under queue item P3-4 of the program; the settled design is §6 and §7 of the current revision of `ARCHITECTURE-RULINGS.md`.*

## 8. Queries and mutations over HTTP

*Drafting pending under queue item P3-4 of the program; the settled design is §6 of the current revision of `ARCHITECTURE-RULINGS.md`.*

## 9. Subscriptions

*Drafting pending under queue item P5 of the program; the settled design is §8 of the current revision of `ARCHITECTURE-RULINGS.md`.*

## 10. Security considerations

**[convention]** The binding never sends a document it did not carry: only the variables map, the configured `extensions` map, and the configured `protocolFields` and `connectionParams` vary per invocation, and none of them can alter the document text or the operation selected. Live introspection is an ordinary query against the addressed endpoint, carrying exactly the fields and credentials the invocation would carry. This family defines no executable address form, names no local resource, and runs no composition engine, so it adds no exposure beyond Core [§9](../../openbindings.md#9-security-considerations)'s threat surface and states no normative floor of its own beyond this paragraph.

**[convention]** A credential from runtime context is carried only at the declared endpoint: `location`, and `content.subscriptions.location` for a subscription. §8's redirect rule is the reason no other destination exists. GraphQL declares no security scheme, so this specification infers none: no incorporated authority defines one.

## 11. Configuration, synthesis, and conformance

### 11.1 Configuration vocabulary

**[configuration point]** The complete binding-specific configuration vocabulary is `httpMethod` (§8), `protocolFields` (§8), `extensions` (§8), `connectionParams` (§9), and `partialEvent` (§9). Every requirement is typed and preflightable from declarations; none appears in the caller envelope or the operation contract, and none supplies target identity. Zero configuration dispatches: POST, no extra fields, no `extensions`, no connection parameters, and `partialEvent: drop`; a subscription additionally needs its carried endpoint, which is document content and not configuration (§3.1). Each point's own ground is stated where it is introduced.

### 11.2 Synthesis boundary and coverage

**[incorporated]** Operation contracts remain protocol-neutral (Core [§5.1](../../openbindings.md#51-operations), [invariant 1](../../openbindings.md#2-core-invariants)).

**[convention]** Synthesis emits one operation per operation definition in the document. One operation per definition because the operation definition is the unit §6.1 of the governing edition executes. Operation keys are synthesis policy, not binding meaning, since Core states no key policy: the reference synthesizer uses the operation name, derives a key for a lone anonymous operation from the source key, and resolves a collision between two sources that expose the same name under Core [OBI-D-04](../../openbindings.md#102-document-rules) by the collision policy every project family uses. The input schema is §6's, the output schema §7's, and the operation description the executable definition's own description when the governing edition's §2.2 carries one.

**[convention]** Synthesis emits no transform: the source-facing value at `inputTransform` is the variables map itself and at `outputTransform` the `data` map of one execution result, so both are already the operation's own values (§6, §7) and none is emitted because no transform has anything to construct. This binding defines no context bindings at either position; evaluation uses Core's closed environment unaugmented (Core [§5.5](../../openbindings.md#55-transforms), [OBI-T-10](../../openbindings.md#103-tool-rules)).

**[convention]** A synthesizer MUST account for every operation definition in the document using exactly one status defined by §3.2, under §3.2's precedence, and MUST record a projection entry for every position §3.3, §6, or §7 names as one: a custom scalar position, an annotative introspection member absent at a reached element, and a deprecated field, argument, input field, or enum value the operation reaches. Root fields of the schema are not interaction units of this binding and receive no status. The status vocabulary and spellings are normative within this binding specification and do not depend on an interface-synthesizer contract; an interface may encode them differently only if it preserves their stated meaning. The accounting is this specification's own because Core states no coverage vocabulary.

**[convention]** Every binding-specific configuration requirement remains in coverage accounting and invocation context, assigned to its represented operation, and MUST NOT enter the operation input schema, because a configuration requirement is not what the operation is about and Core §5.1's `input` is the operation's own value.

### 11.3 Conformance rules

**[convention]** A document conforms to **GQL-D-01** when every source governed by this identifier carries a `location` that is an absolute URI whose scheme is `http` or `https` (§4).

**[convention]** A document conforms to **GQL-D-02** when every such source carries a `content` object with exactly §3.1's members: a string `document`, an optional `schema` that is a string or an object, and an optional `subscriptions` object of exactly `transport` and `location` whose transport and location scheme pair as §3.1 states, and no other member.

**[convention]** A document conforms to **GQL-D-03** when each such source's `document` parses as an executable document under §2 of the governing edition and contains no type-system definition or extension, and its `schema`, when present, parses as a type-system document when a string or carries an object at `data.__schema` and no `errors` entry when an object (§3.2 gates 3 and 4).

**[convention]** A document conforms to **GQL-D-04** when each such source's interpreted schema, as carried, satisfies §3.2's schema-validity gate: every referenced type is defined, every field and argument has a type, no definition repeats a field or argument name, input positions carry input types and output positions output types, and the `query` root operation type is present and is an Object type.

**[convention]** A processor conforms to **GQL-P-01** when it implements §3.2's closed load gates in their stated order and nothing else as a load gate, confines every later defect to §3.2's smallest owning unit, refuses a source as a source only under §3.2's source-refusal rule, and keeps the source, addressability, synthesis-status, and invocation-outcome axes independent, including for a document whose every operation definition is invalid.

**[convention]** A processor conforms to **GQL-P-02** when it interprets a carried `schema` as §3.3 states: a string under §3 of the governing edition; an object for exactly the consumed members of the listed query, with a structural absence making every operation reaching the element invalid, an annotative absence making the owning operation lossy with a projection entry, the five edition exceptions read as their earlier edition's declarations, a wrapping chain beyond the listed depth read as a structural absence, and a null at a position §4.2 declares non-null read as an absence.

**[convention]** A processor conforms to **GQL-P-03** when, with `schema` absent, it sends exactly §3.3's capability probe and then the introspection query composed from the listed query by removing each capability the probe did not observe, reads a null probe position as the base selection for that type, refuses the source at load, at gate 4, on a request error result or a null `data` at either step, applies gates 4 and 5 to the live result as to a carried one, sends both requests by POST whatever `httpMethod` selects, and sends them with the same configured `protocolFields`, `extensions`, and credentials the invocation will send.

**[convention]** A processor conforms to **GQL-P-04** when it dispatches against a pinned `schema` as carried, never re-introspects to repair it, classifies a service's request error against a pin-validated document as that service's own unsuccessful completion under §8, and emits a value the service returns beyond the pin's closed contract as the operation's value under §4's second staleness face.

### 11.4 Permitted variation and stated limits

This section collects the points at which two implementations conforming to `openbindings.graphql@1` may still reach different outcomes, together with what this specification declines to cover. It is an index over rules stated elsewhere in this document and carries no provenance of its own. Rows for §5 to §9 arrive with those sections.

**Declared freedoms.** At each site the specification states the latitude rather than removing it, and states what survives across implementations that take it differently.

| what may differ | where | what holds across the permitted set |
| --- | --- | --- |
| whether a runtime loads a schema-absent source once per invocation or reuses the loaded source across invocations carrying the same credentials | §3.3 | the two introspection requests, their order, their method, and the fields and credentials they carry are fixed; a reused schema is subject to §4's staleness posture for the reused interval |
| how a processor names or presents a confined defect | §3.2 | the affected unit and responsible position remain observable; no defect-class taxonomy, per-class citation, or per-defect coverage vocabulary is portable |
| operation-key spelling, and the key derived for a lone anonymous operation | §11.2 | one operation per operation definition; the emitted input and output schemas and every disposition are fixed |

**Stated limits.** Each is a boundary of this revision's coverage, stated with its reason where it is introduced, and none is a deferral.

| limit | where |
| --- | --- |
| a pinned introspection result taken without `includeDeprecated: true` is indistinguishable from a schema with nothing deprecated, and its derived contract omits what the service still serves | §3.3 |
| a pinned result taken from a September 2025 service by a query that omitted `isOneOf` loses the OneOf constraint | §3.3, §6 |
| a wrapping chain deeper than the listed query's nine `ofType` levels is a structural absence in a pinned or live-introspected result | §3.3 |
| a live-introspected contract is a claim about one credential set; portability across callers is obtained by pinning `schema` | §3.3 |
| acquisition failure at `location` is decided by the address scheme and the runtime; this specification attaches one outcome to a request that yields no response | §4, §8 |
| a pinned `schema` is never repaired by re-introspection; drift of either face is the author's to repair | §4 |

## 12. Normative references

- [OpenBindings Specification 0.2.0](../../openbindings.md)
- [GraphQL Specification, September 2025, source tree at commit `89d93ebbe05db06787646d76a696ead8de117b2b`](https://github.com/graphql/graphql-spec/tree/89d93ebbe05db06787646d76a696ead8de117b2b/spec)
- [GraphQL Specification, October 2021, source tree at commit `51337a9b820e296fa7d03ae77d534cb4b247c201`](https://github.com/graphql/graphql-spec/tree/51337a9b820e296fa7d03ae77d534cb4b247c201/spec)
- [GraphQL Specification, June 2018, source tree at commit `cdf792cf3b21584cc65b353d7f5eb90e4116f707`](https://github.com/graphql/graphql-spec/tree/cdf792cf3b21584cc65b353d7f5eb90e4116f707/spec)
- [GraphQL over HTTP draft at commit `d746195047ac4ae5c4bb11042b4941e6631726e8`](https://github.com/graphql/graphql-over-http/blob/d746195047ac4ae5c4bb11042b4941e6631726e8/spec/GraphQLOverHTTP.md)
- [graphql-ws protocol at commit `839ca7d652004513a063dd44e9bcfe7a3301f6f0`](https://github.com/enisdenjo/graphql-ws/blob/839ca7d652004513a063dd44e9bcfe7a3301f6f0/PROTOCOL.md)
- [graphql-sse protocol at commit `0e899300dca583cd5aa5a2fa1d4f15d6e9cafb0e`](https://github.com/enisdenjo/graphql-sse/blob/0e899300dca583cd5aa5a2fa1d4f15d6e9cafb0e/PROTOCOL.md)
- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119)
- [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)
- [RFC 6265](https://httpwg.org/specs/rfc6265.html)
- [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455)
- [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)
- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)
- [RFC 9112](https://www.rfc-editor.org/rfc/rfc9112)
- [W3C Server-Sent Events Recommendation, 3 February 2015](https://www.w3.org/TR/2015/REC-eventsource-20150203/)
- [WHATWG URL Standard, review draft August 2026](https://url.spec.whatwg.org/review-drafts/2026-08/)
