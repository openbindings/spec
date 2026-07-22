# GraphQL binding specification promotion candidate

## 1. Status and proposed identifier

**Status: design-review candidate — no identifier is minted by this document.** This is the complete proposed contract for a future **`openbindings.graphql@1`** binding specification, arranged under the project's [authoring template](../README.md#authoring-a-new-binding-specification). It is intentionally stricter and more explicit than the legacy reference implementations. Publication still requires design approval, conformance fixtures, and coordinated tooling adoption; until then an OBI MUST NOT claim `openbindings.graphql@1` on the authority of this page.

If promoted, `openbindings.graphql@1` is exact and opaque under core [OBI-B-01](../../openbindings.md#104-binding-specification-rules), and an incompatible change publishes `openbindings.graphql@2` under [OBI-B-03](../../openbindings.md#104-binding-specification-rules). The proposed rule identifiers below are reserved only within this candidate and may change before publication.

The key words "MUST", "MUST NOT", "REQUIRED", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" describe the contract proposed for promotion and are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in all capitals. They carry no present conformance claim while this page remains a candidate.

## 2. Scope and incorporated authorities

This is the OpenBindings project's proposed binding specification for GraphQL services. It does not define GraphQL. The [GraphQL Specification, September 2025](https://spec.graphql.org/September2025/) remains authoritative over schemas, executable documents, validation, variables, execution, introspection, and response shape. Query and mutation transport incorporates the [GraphQL-over-HTTP draft at commit `4d447e90519e2eb2f9b1dfa61bb1b6afc82decd3`](https://github.com/graphql/graphql-over-http/blob/4d447e90519e2eb2f9b1dfa61bb1b6afc82decd3/spec/GraphQLOverHTTP.md). Subscription transport incorporates the [`graphql-transport-ws` protocol as published by the annotated `graphql-ws` 6.1.0 tag `01ce28a5116c3016eb18fbe745480b6ec06d9907`, peeled to source commit `0b69b9b795a956c96612d0f86be48210c74e0274`](https://github.com/enisdenjo/graphql-ws/blob/0b69b9b795a956c96612d0f86be48210c74e0274/PROTOCOL.md).

This candidate defines only the OpenBindings overlay: source carriage, operation selection, the caller-facing variables boundary, target configuration, and transport/result correspondence. It binds GraphQL query, mutation, and subscription operations whose selected executable document has exactly one root field. It excludes batching, multipart incremental delivery (`@defer`/`@stream`), uploads, live queries, GET, persisted-query/APQ extensions, and subscription protocols other than the pinned `graphql-transport-ws` revision. Those exclusions are scoped revision-1 decisions, not claims that GraphQL forbids the features.

## 3. Accepted source representations

This family is **service-addressed**. It accepts a live GraphQL service identified by `location`, optionally accompanied by one pinned schema representation in `content`:

- **Object `content`**: one successful GraphQL introspection execution-result object with no `errors` member and an object at `data.__schema`. It is a pin of exactly the schema facts the response carries; omission of a field the request did not select is never interpreted as an empty or absent schema fact.
- **Absent `content`**: when schema-dependent binding resolution is required, the processor obtains the needed facts from the service through one or more introspection operations defined by the GraphQL specification. Those requests use the same resolved HTTP headers, cookies, and explicitly named credentials as the eventual invocation; an auth-gated schema is never queried anonymously by convention. Query spelling and batching of facts are implementation choices; resolution may complete only after the processor has enough information to determine the root type and field selected by `ref`, recursively materialize every type definition the configured executable document uses, and validate that document under the GraphQL specification. A disabled or incomplete introspection surface makes the binding unresolvable; processors do not fill missing facts from convention.

No wrapper-stripped `{"__schema": ...}` object, bare schema object, stringified JSON, SDL text, or executable document is accepted as `content` in revision 1. Restricting the representation avoids treating several locally convenient shapes as if GraphQL defined them to be interchangeable. Introspection-disabled services require pinned object `content`. For any binding using a pin, the carried response MUST contain the same resolution-and-validation closure required of live acquisition above; a pin that omits a needed fact makes that binding unresolvable. This per-binding sufficiency condition is testable and does not pretend GraphQL defines one canonical introspection query or one globally complete response shape.

## 4. `location`

`location` is REQUIRED and MUST be an absolute `http` or `https` URI naming the live GraphQL HTTP endpoint (**proposed GQL-D-01**). It is both the location-only schema-acquisition endpoint and the query/mutation invocation target. It is not a base URI for `content`, because introspection responses contain no external references. A WebSocket target is supplied separately; changing this URI's scheme is never used to derive one.

## 5. `content`

When present, `content` MUST be the introspection response object described in [§3](#3-accepted-source-representations) (**proposed GQL-D-02**). The candidate defines no non-JSON artifact encoding.

## 6. Composition

When `content` and `location` are both present, `content` is the schema pin used for binding resolution and validation, while `location` remains the live invocation target. The pin is not refreshed implicitly. Dispatch proceeds against the pinned contract; schema drift is surfaced through the live service's ordinary GraphQL or transport response rather than by silently replacing the pin. This is the core content-primacy floor applied to a service-addressed family.

## 7. `ref`

`ref` is REQUIRED and has exactly one of these forms (**proposed GQL-D-03**):

```text
query/<field-name>
mutation/<field-name>
subscription/<field-name>
```

The prefix selects the GraphQL operation kind, not a schema type name. Resolution follows the schema's actual root-operation type mapping and then matches `<field-name>` exactly against that type. This correctly handles schemas whose root types are not named `Query`, `Mutation`, or `Subscription`. The field portion is non-empty and contains the exact GraphQL Name; there is no percent-decoding, path hierarchy, alias interpretation, or whole-schema invocation. A missing root type or field makes the binding unresolvable.

## 8. Target and interaction

The target for query and mutation is the HTTP endpoint in `location`. Both are unary: zero or one caller input value produces one successful output value. The target for a subscription is the separately configured WebSocket URI at `subscriptionTarget`; subscription is server-streaming after zero or one caller input value. The WebSocket URI MUST use `ws` or `wss` and is never inferred by rewriting `location`.

Invocation also requires an exact executable document through the `document` configuration point. The selected GraphQL operation MUST:

1. be selected unambiguously under GraphQL's own `operationName` rules;
2. have the same operation kind as `ref`;
3. pass GraphQL validation against the acquired or pinned schema; and
4. for this invocation's coerced variable values, produce exactly one root response-key group under GraphQL's `CollectFields()` algorithm, with every field selection in that group naming the underlying root field selected by `ref` (a response alias MAY provide that group's one response key).

The fourth check is per invocation because GraphQL's built-in `@skip` and `@include` directives participate in field collection and may depend on caller variables. Zero collected root groups, two response-key groups (including two aliases of the same underlying field), or one group containing a different underlying root field is refused before dispatch. Repeated selections and fragments that GraphQL validly merges into the same one response-key group remain one field for this boundary.

The schema does not determine a selection set, so this candidate never synthesizes an executable document from introspection. The legacy `_query` input property and generated-selection-set behaviors are explicitly non-conforming to the candidate.

## 9. Operation-boundary correspondence

### 9.1. Input and request mapping

The caller input, when supplied, MUST be a JSON object and is the GraphQL **variables map wholesale** (**proposed GQL-P-01**). No input means the request omits `variables`; it does not synthesize an empty object. No field is routed to headers, cookies, the query text, `operationName`, or GraphQL `extensions`.

For query and mutation, the processor sends one HTTP `POST` with `Content-Type: application/json`. The JSON body contains the configured executable document as `query`, contains `operationName` exactly when the document point supplies it, and contains `variables` exactly when caller input was supplied. It advertises the two response media types incorporated by GraphQL-over-HTTP:

```http
Accept: application/graphql-response+json, application/json;q=0.9
```

Revision 1 does not send GET, a raw `application/graphql` body, batched request arrays, `extensions`, or multipart bodies.

For subscription, after `connection_ack` the processor sends one `subscribe` message whose payload contains the same `query`, optional `operationName`, and optional `variables` members. The caller input side then closes.

### 9.2. Configuration points

This candidate defines three named configuration points (**proposed GQL-P-02**), consulted per-invocation configuration before consumer-level configuration; a declined choice falls through. The carriage of configuration is implementation surface.

| Point                  | Artifact/protocol answer or fallback                | Meaning                                                                                                                                                                                                                                                               |
| ---------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **document**           | none; REQUIRED                                      | Supplies the exact executable-document source text and, when GraphQL requires it, the exact `operationName`. Selection must satisfy [§8](#8-target-and-interaction).                                                                                                  |
| **subscriptionTarget** | none; REQUIRED for subscriptions                    | Supplies a complete absolute `ws` or `wss` URI. It does not modify the HTTP endpoint or schema identity.                                                                                                                                                              |
| **protocolFields**     | omit optional values; no generic credential mapping | Supplies explicitly named HTTP headers/cookies, WebSocket upgrade headers/cookies, and an optional `connection_init.payload` that is an object or `null`, exactly as the pinned WebSocket protocol permits. Names and values ride only their named protocol location. |

The `document` point is not a query builder. The `protocolFields` point cannot replace `query`, `variables`, `operationName`, or the selected field, and this candidate never maps a generic credential to `Authorization`, a cookie, or `connection_init` by convention. HTTP field names are compared ASCII case-insensitively; cookie names compare exactly. Distinct explicit cookies are assembled into one `Cookie` header; their member ordering carries no binding semantic. Supplying a raw `Cookie` header and any cookie entry is a conflict, never an invitation to parse and merge one representation into the other.

A supplied HTTP field that collides with a processor-owned request field (`content-type`, `accept`, `content-length`, or `host`) is refused before dispatch. On the WebSocket upgrade, `host`, `connection`, `upgrade`, `sec-websocket-key`, `sec-websocket-version`, and `sec-websocket-protocol` are processor-owned and likewise cannot be replaced. A header or cookie destination supplied more than once through named credentials and explicit protocol fields is a pre-dispatch conflict, not a precedence rule invented here. When several independently configured fields or credentials target the same header, case-insensitive equality is enough to collide even if one spelling differs. A generic credential with no explicitly named header, cookie, or initialization location is surfaced for consumer resolution.

### 9.3. Decode and classification

The complete GraphQL response envelope is the output value (**proposed GQL-P-03**). It is never unwrapped to `data[<field>]`, and `errors` never becomes an OpenBindings terminal error merely because it is present. An author who wants an unwrapped field uses `outputTransform`.

For HTTP:

- A response with media type `application/graphql-response+json` that is valid JSON and a well-formed GraphQL response is one successful output regardless of HTTP status. The media type was designed so GraphQL-over-HTTP status semantics and the body can be interpreted together.
- A response with media type `application/json` is one successful output only with a 2xx final status and a well-formed GraphQL response. A non-2xx `application/json` response is a terminal transport failure; the candidate does not guess whether its body is a trustworthy GraphQL response.
- An unsupported media type, malformed JSON, or body that is not a well-formed GraphQL response is a terminal protocol failure.
- GraphQL-over-HTTP does not define redirect following, so whether to follow is runtime policy. Any followed redirect MUST preserve POST, the complete GraphQL request body, and processor-owned representation fields; a redirect whose semantics require, or whose configured client policy would perform, a method rewrite is not followed and remains the final response. Classification above applies to the final response after any such semantics-preserving redirects. Redirect limits and cross-origin credential policy remain runtime concerns.

For subscriptions, each `next.payload` is emitted as one complete GraphQL response value. A protocol `complete` message ends normally. A protocol `error` message, invalid message, connection failure, or connection-level close before operation completion is a terminal failure carrying the available protocol error; the candidate does not wrap an `error` payload into a synthetic GraphQL response. Caller cancellation sends the protocol's `complete` message for the operation and closes local output.

### 9.4. Subscription session

The processor offers exactly the `graphql-transport-ws` subprotocol, waits for `connection_ack`, and then subscribes. An optional configured `connection_init.payload` is sent verbatim when it is an object or `null`; any other JSON value is refused before opening the socket. Protocol timeouts, duplicate acknowledgements, close codes, operation identifiers, and message ordering follow the pinned protocol. Connection pooling MAY be used only when target, upgrade fields, and initialization identity are equal; credentials or initialization values MUST NOT leak across callers.

### 9.5. Transform positions

This candidate defines no context bindings at the core's binding-level transform positions. `inputTransform` and `outputTransform` evaluate in the core's closed environment.

## 10. Proposed conformance rules

These identifiers organize review and future fixtures; they are not published rules until promotion.

- **GQL-D-01**: `location` is required and is an absolute `http` or `https` GraphQL service endpoint.
- **GQL-D-02**: `content`, when present, is one successful introspection execution-result object with no `errors` member and object `data.__schema`; it must carry the resolution-and-validation closure each binding using it needs.
- **GQL-D-03**: `ref` is required, has a `query/`, `mutation/`, or `subscription/` prefix plus one exact GraphQL field name, and resolves through the schema's declared root type.
- **GQL-P-01**: Caller input is absent or one variables object wholesale; request mapping follows [§9.1](#91-input-and-request-mapping), with no `_query` or generated document behavior.
- **GQL-P-02**: `document`, `subscriptionTarget`, and `protocolFields` behave only at their named configuration points and never contradict the schema, selected operation, or protocol; processor-owned field collisions and unnamed credential carriage are refused or surfaced rather than assigned precedence.
- **GQL-P-03**: HTTP and WebSocket decode/classification preserve complete GraphQL response values and follow [§9.3](#93-decode-and-classification); GraphQL `errors` remain in-band, and any followed HTTP redirect preserves POST and the complete request body rather than changing the selected operation.
- **GQL-P-04**: Subscription establishment, messages, cancellation, and pooling follow the pinned `graphql-transport-ws` protocol and [§9.4](#94-subscription-session).
- **GQL-P-05**: Live schema acquisition uses GraphQL introspection operations until the binding's resolution-and-validation closure is known; pinned content displaces live introspection and missing facts are never guessed.

## Promotion decisions

The targeted design review resolves the candidate's former semantic questions as follows; promotion work must not reopen them as private implementation choices:

1. **One binding selects one root field.** The per-invocation `CollectFields()` check stays. Treating a multi-root document as this `ref`'s target would make the ref decorative; synthesizing or selecting one group would contradict the configured document.
2. **Both incorporated HTTP media lanes stay.** The GraphQL-over-HTTP authority permits the legacy `application/json` compatibility lane and gives it different status semantics. Revision 1 preserves that alternative rather than narrowing it for project preference.
3. **Subscriptions stay in scope under the exact protocol pin.** The independently versioned dependency is immutable and explicitly named; a later `graphql-ws` release does not drift this candidate. Dropping a specified upstream lane solely to avoid a second authority would reduce fidelity without removing ambiguity.
4. **Standard introspection is the live acquisition lane.** A location-only source uses standard introspection; an introspection-disabled service carries a sufficient pinned result. Missing schema facts are unresolvable and never reconstructed from naming conventions.

The remaining promotion gates are evidence and adoption, not semantic discretion: add source fixtures and portable processor scenarios for every proposed rule, execute them through an implementation adapter, and coordinate runtime support before minting the identifier.

## 11. References

- [GraphQL Specification, September 2025](https://spec.graphql.org/September2025/)
- [GraphQL-over-HTTP draft, pinned commit `4d447e90519e2eb2f9b1dfa61bb1b6afc82decd3`](https://github.com/graphql/graphql-over-http/blob/4d447e90519e2eb2f9b1dfa61bb1b6afc82decd3/spec/GraphQLOverHTTP.md)
- [`graphql-transport-ws` protocol, `graphql-ws` 6.1.0 annotated tag `01ce28a5116c3016eb18fbe745480b6ec06d9907`, peeled commit `0b69b9b795a956c96612d0f86be48210c74e0274`](https://github.com/enisdenjo/graphql-ws/blob/0b69b9b795a956c96612d0f86be48210c74e0274/PROTOCOL.md)
- [OpenBindings core specification](../../openbindings.md)
- [Binding-specification authoring guidance](../README.md)
