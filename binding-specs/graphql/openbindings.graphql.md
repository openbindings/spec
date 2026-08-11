# `openbindings.graphql` Binding Specification

## 1. Status and identifier

**Status: unreleased first-revision candidate.** This document proposes **`openbindings.graphql@1`** as the first project identifier for this family. The identifier has not been published and this candidate remains mutable. Publication will mint the exact, opaque identifier under core [OBI-B-01](../../openbindings.md#104-binding-specification-rules); later incompatible changes will require a different identifier under [OBI-B-03](../../openbindings.md#104-binding-specification-rules).

The key words "MUST", "MUST NOT", "REQUIRED", "SHOULD", "SHOULD NOT", "MAY", and "OPTIONAL" are interpreted as described in BCP 14 when, and only when, they appear in all capitals.

## 2. Scope and incorporated authorities

This is the OpenBindings project's binding specification for GraphQL services. Under this candidate's authority, it incorporates the [GraphQL Specification, September 2025](https://spec.graphql.org/September2025/) to govern schemas, executable documents, validation, variables, execution, introspection, and response shape. Query and mutation transport incorporates the [GraphQL-over-HTTP draft at commit `4d447e90519e2eb2f9b1dfa61bb1b6afc82decd3`](https://github.com/graphql/graphql-over-http/blob/4d447e90519e2eb2f9b1dfa61bb1b6afc82decd3/spec/GraphQLOverHTTP.md). This specification deliberately defines only the OpenBindings overlay; that upstream deference is its chosen meaning, not a Core requirement on all GraphQL-shaped binding specifications.

This candidate binds query and mutation root fields. It excludes subscriptions, batching, multipart incremental delivery, uploads, live queries, GET, persisted-query extensions, and documents that collect more than one root response-key group. Those are explicit coverage boundaries, not approximations.

The concrete GraphQL service and response envelope remain available to the binding implementation so it can interact and classify correctly. Their native representations do not thereby become ordinary OpenBindings values.

## 3. Accepted source representations

This family is service-addressed. It accepts a live service at `location`, optionally accompanied by one pinned schema representation in `content`:

- Present `content` is one successful GraphQL introspection execution-result object with no `errors` member and an object at `data.__schema` (**GQL-D-02**). It must carry the root-resolution and type facts needed by each represented binding.
- With absent `content`, the processor obtains the needed facts through GraphQL introspection using the same resolved HTTP fields as invocation (**GQL-P-05**). Disabled or incomplete introspection makes an affected target unresolvable.

No wrapper-stripped schema, SDL, stringified JSON, or executable document is accepted as source content.

## 4. `location`

`location` is REQUIRED and MUST be an absolute `http` or `https` URI naming the live GraphQL HTTP endpoint (**GQL-D-01**). It is both the live schema-acquisition endpoint and the query/mutation invocation target. It is not a reference base for `content`.

## 5. `content` and composition

Present `content` MUST be the pinned introspection response of §3 (**GQL-D-02**). It is authoritative for schema interpretation and displaces live introspection. `location` remains the invocation target. Schema drift is surfaced by the live interaction; processors do not silently replace the pin.

## 6. `ref` and eligible targets

A candidate `ref` is REQUIRED and has exactly one of these forms (**GQL-D-03**):

```text
query/<field-name>
mutation/<field-name>
```

The non-empty field portion is one exact GraphQL Name. Resolution follows the schema's actual query or mutation root-type mapping and matches the field exactly. A missing root type or field is unresolvable. Subscription root fields remain part of schema inventory but are not candidate binding targets.

## 7. Target and interaction

The target is the HTTP endpoint in `location`. The abstract interaction is unary: zero or one input application value and exactly one successful output application value.

An exact executable document is REQUIRED through the `document` interpretation point. The selected GraphQL operation MUST be selected unambiguously under GraphQL's `operationName` rules, have the kind named by `ref`, and, for the supplied variables, collect exactly one root response-key group whose selections all name the root field selected by `ref` (**GQL-P-02**). Aliasing that group is allowed. This check yields the response key used for output projection.

The live service remains authoritative for full GraphQL request validation and variable coercion. A processor does not synthesize an executable document from introspection and does not consume a legacy `_query` input member.

## 8. Operation-boundary correspondence

### 8.1. Input and request mapping

Supplied caller input MUST be a JSON object and maps whole to the GraphQL variables map (**GQL-P-01**). Absent input omits `variables`. No field is routed to headers, cookies, document text, `operationName`, or `extensions`.

The processor sends one HTTP `POST` with `Content-Type: application/json` and:

```http
Accept: application/graphql-response+json, application/json;q=0.9
```

The body contains `query`, optional `operationName`, and optional `variables` exactly as described above.

### 8.2. Interpretation points

This candidate defines two interpretation points (**GQL-P-02**):

| Point | Artifact answer or fallback | Meaning |
|---|---|---|
| `document` | none; REQUIRED | Exact executable-document source and optional exact `operationName`; it must satisfy §7. |
| `protocolFields` | omit optional values | Explicitly named HTTP headers and cookies only. |

Processor-owned `content-type`, `accept`, `content-length`, and `host` fields cannot be replaced. Duplicate destinations collide case-insensitively and are refused before dispatch. A generic credential without an explicitly named HTTP destination is surfaced for context resolution rather than assigned a carrier by convention.

### 8.3. Successful output projection

A well-formed successful response MUST contain object `data` with the selected response key. The single operation output is `data[responseKey]`, unchanged (**GQL-P-03**). The response envelope, `errors`, `extensions`, HTTP status, headers, and bytes are not output-schema members or additional operation values.

Synthesis derives the operation output schema from the selected root field's GraphQL output type (**GQL-P-03**). Built-in scalar, enum, list, nullability, and composite JSON shapes are represented to the extent the introspection artifact determines them. Selection-set spelling, nested aliases, and runtime concrete types remain document-dependent, so a synthesized composite schema MUST NOT reject fields merely because introspection did not determine their response key.

### 8.4. Classification and unsuccessful completion

For `application/graphql-response+json`, a valid well-formed GraphQL response is interpreted regardless of HTTP status. For legacy `application/json`, only a 2xx final status is trusted as a GraphQL response; a non-2xx response is an unsuccessful transport interaction. Unsupported media, malformed JSON, or a malformed GraphQL response is unsuccessful (**GQL-P-03**).

When a trusted GraphQL response contains `errors`, the invocation completes unsuccessfully. If object `data` contains the selected response key, its application value is emitted first and remains authoritative; unsuccessful completion follows without retracting it. If the selected value is absent, no operation value is invented. This preserves GraphQL partial data through the existing output-then-error lifecycle without making GraphQL errors ordinary output values.

The binding defines no universal error vocabulary and requires no GraphQL error object, HTTP field, or response envelope on the ordinary boundary. It MAY retain the complete response and transport evidence through an explicit diagnostic surface. Correct ordinary operation use MUST NOT depend on those native representations.

GraphQL-over-HTTP does not define redirect following. Runtime policy may follow only a redirect that preserves POST, the complete request body, and processor-owned representation fields; a method-rewriting redirect remains the final response.

### 8.5. Transform positions

This specification defines no context bindings at core transform positions. Transforms evaluate in the core's closed environment.

## 9. Synthesis coverage

Every non-introspection query and mutation root field is eligible for representation. Subscription fields are reported as excluded with a stable reason rather than silently omitted (**GQL-P-04**). Operation-key naming is tooling policy, not binding meaning.

## 10. Conformance

- **GQL-D-01**: `location` is a required absolute HTTP(S) GraphQL endpoint.
- **GQL-D-02**: Present `content` is one successful introspection execution result with object `data.__schema` and no `errors` member, sufficient for each represented target.
- **GQL-D-03**: `ref` is a required exact `query/<field>` or `mutation/<field>` reference resolving through the schema's declared root type.
- **GQL-P-01**: Supplied caller input is one variables object wholesale; absent input omits `variables`.
- **GQL-P-02**: `document` and `protocolFields` act only at their named interpretation points; document/root correspondence and field-collision refusals follow §7 and §8.2.
- **GQL-P-03**: HTTP classification, root-value projection, synthesized output shape, partial-value preservation, and unsuccessful completion follow §8.3 and §8.4; native envelopes and transport facts are not ordinary values.
- **GQL-P-04**: Subscription targets are excluded with coverage evidence rather than approximated.
- **GQL-P-05**: Live schema acquisition uses GraphQL introspection until required facts are known; pinned content displaces live introspection and incomplete facts make the affected target unresolvable.

Conformance fixtures keyed to these identifiers are maintained in the project corpus.

## 11. References

- GraphQL Specification, September 2025.
- GraphQL-over-HTTP draft at commit `4d447e90519e2eb2f9b1dfa61bb1b6afc82decd3`.
- OpenBindings core specification, `openbindings.md` in this repository.
- BCP 14: RFC 2119 and RFC 8174.
