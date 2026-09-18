# OpenAPI generation correspondence witnesses

These informative witnesses distinguish the binding family's portable correspondence rules from a reference generator's chosen output strategy. They are not a generator interface, reporting schema, or requirement to support every generation strategy. The four binding specifications and Core govern conformance.

The existing OpenAPI `synthesis/` files additionally test the reference tooling's full-document generation and exhaustive reports. Their exact generated names, shapes, and report representation are not requirements for all conforming tools. See [the assertion-scope map](#reference-fixture-assertion-scope).

## W1–W4: selected generation, two shapes, and an unnecessary transform

### Base OBI (OpenAPI 3.1)

This complete OBI represents only `/pets/{id}`. The source also declares `/health`, but no inventory, coverage report, or selection metadata accompanies the OBI. The `name` and `petId` input fields express application meaning; the binding's explicit transform constructs protocol locations.

```json
{
  "openbindings": "0.2.0",
  "operations": {
    "renamePet": {
      "input": {
        "type": "object",
        "properties": {"petId": {"type": "string"}, "name": {"type": "string"}},
        "required": ["petId", "name"],
        "additionalProperties": false
      },
      "output": {"type": "string"}
    }
  },
  "sources": {
    "api": {
      "bindingSpec": "openbindings.openapi-3.1@1",
      "content": {
        "openapi": "3.1.2",
        "info": {"title": "Pets", "version": "1"},
        "servers": [{"url": "https://example.test"}],
        "paths": {
          "/pets/{id}": {
            "post": {
              "parameters": [{"in": "path", "name": "id", "required": true, "schema": {"type": "string"}}],
              "requestBody": {
                "required": true,
                "content": {"application/json": {"schema": {
                  "type": "object", "properties": {"name": {"type": "string"}},
                  "required": ["name"], "additionalProperties": false
                }}}
              },
              "responses": {"200": {"description": "Renamed", "content": {"application/json": {"schema": {"type": "string"}}}}}
            }
          },
          "/health": {"get": {"responses": {"200": {"description": "Health", "content": {"application/json": {"schema": {"type": "string"}}}}}}}
        }
      }
    }
  },
  "bindings": {
    "rename": {
      "operation": "renamePet", "source": "api", "selector": "#/paths/~1pets~1{id}/post",
      "inputTransform": "{\"parameters\": {\"id\": petId}, \"body\": {\"name\": name}}"
    }
  }
}
```

### Nested-contract alternative

In a separate copy of the base OBI, replace `operations.renamePet.input` and `bindings.rename.inputTransform` with the following values respectively. Everything else stays the same.

```json
{
  "input": {
    "type": "object",
    "properties": {"pet": {
      "type": "object", "properties": {"identity": {"type": "string"}, "newName": {"type": "string"}},
      "required": ["identity", "newName"], "additionalProperties": false
    }},
    "required": ["pet"], "additionalProperties": false
  },
  "inputTransform": "{\"parameters\": {\"id\": pet.identity}, \"body\": {\"name\": pet.newName}}"
}
```

Flat input `{"petId":"p1","name":"Miso"}` and nested input `{"pet":{"identity":"p1","newName":"Miso"}}` both map to exactly `{"parameters":{"id":"p1"},"body":{"name":"Miso"}}`. The effective path parameter determines routing; both denote POST `/pets/p1` with the same JSON body value. A successful JSON response `"renamed"` is the same successful operation output in both copies. No particular JSON object member ordering is asserted here.

- **W1 permitted:** both shapes, with their explicit transforms (all siblings §12.2; Core §5.5).
- **W1 disallowed control:** an expression that drops `parameters.id` produces an envelope missing a required path parameter and must not dispatch (§§7–8). An expression dropping required `body.name` makes a false faithful-correspondence claim even if this binding does not automatically validate the native schema (§12.2; Core §5.3). Do not confuse this latter authoring failure with a new automatic runtime validator.
- **W2 permitted:** deriving only `renamePet`, without a report or selection manifest (§12.2).
- **W2 disallowed control:** attaching the claim “this represents every operation in the source” to that same output is false: `/health` is not represented. Omitting that claim requires no compensating metadata.
- **W3 permitted:** the same OBI may be hand-authored and invoked by a tool with no generation capability. Its source interpretation and explicit transforms still apply (§§3–8, 12.2).
- **W3 disallowed control:** making the selected path parameter declaration invalid cannot be excused by the absence of a generator. The selected target still refuses before dispatch. An unrelated confined defect does not remove this target (§3.2).

### Mapping-free alternative

In a separate copy of the base OBI, replace its entire `operations` and `bindings` maps with these maps. The source is unchanged.

```json
{
  "operations": {
    "checkHealth": {"input": {"type": "object", "maxProperties": 0}, "output": {"type": "string"}}
  },
  "bindings": {
    "health": {"operation": "checkHealth", "source": "api", "selector": "#/paths/~1health/get"}
  }
}
```

**W4 permitted:** the operation input `{}` is already an admitted empty binding-facing envelope. No transform is needed (Core §5.5; binding §12.2). The operation contract exposes no HTTP location vocabulary. **Disallowed control:** deleting the transform from the original `renamePet` binding does not make `{petId,name}` an envelope: those unknown top-level keys refuse before dispatch (§7).

### Edition substitutions

For 3.0, change the source identifier to `openbindings.openapi-3.0@1` and the artifact version to `3.0.4`. For 3.2, use `openbindings.openapi-3.2@1` and `3.2.0`. These examples use only the shared non-streaming surface.

For 2.0, change the source identifier to `openbindings.openapi-2.0@1` and replace the complete `sources.api.content` value with this artifact. The operation contracts, transforms, selectors, supplied values, and expected binding envelopes above are unchanged.

```json
{
  "swagger": "2.0",
  "info": {"title": "Pets", "version": "1"},
  "host": "example.test", "schemes": ["https"], "basePath": "/",
  "consumes": ["application/json"], "produces": ["application/json"],
  "paths": {
    "/pets/{id}": {"post": {
      "parameters": [
        {"in": "path", "name": "id", "required": true, "type": "string"},
        {"in": "body", "name": "pet", "required": true, "schema": {
          "type": "object", "properties": {"name": {"type": "string"}},
          "required": ["name"], "additionalProperties": false
        }}
      ],
      "responses": {"200": {"description": "Renamed", "schema": {"type": "string"}}}
    }},
    "/health": {"get": {"responses": {"200": {"description": "Health", "schema": {"type": "string"}}}}}
  }
}
```

## W5: dependency identities without a naming algorithm

This separate 3.1 OBI contains two consumed-operation declarations and no callable binding. The callback expressions are literal HTTPS destinations. Two distinct callback slots remain two consumption points, even though they consume the same operation contract.

```json
{
  "openbindings": "0.2.0",
  "operations": {"receiveNotice": {"input": {"type": "string"}, "output": {
    "type": "object", "properties": {"receipt": {"type": "string"}}, "required": ["receipt"], "additionalProperties": false
  }}},
  "dependencies": {"primary": {"operation": "receiveNotice"}, "audit": {"operation": "receiveNotice"}},
  "sources": {"api": {
    "bindingSpec": "openbindings.openapi-3.1@1",
    "content": {
      "openapi": "3.1.2", "info": {"title": "Notices", "version": "1"},
      "servers": [{"url": "https://example.test"}],
      "paths": {"/subscribe": {"post": {
        "responses": {"204": {"description": "Subscribed"}},
        "callbacks": {
          "first": {"https://receiver.test/primary": {"post": {
            "requestBody": {"required": true, "content": {"application/json": {"schema": {"type": "string"}}}},
            "responses": {"200": {"description": "Acknowledged", "content": {"application/json": {"schema": {
              "type": "object", "properties": {"receipt": {"type": "string"}}, "required": ["receipt"], "additionalProperties": false
            }}}}}
          }}},
          "second": {"https://receiver.test/audit": {"post": {
            "requestBody": {"required": true, "content": {"application/json": {"schema": {"type": "string"}}}},
            "responses": {"200": {"description": "Acknowledged", "content": {"application/json": {"schema": {
              "type": "object", "properties": {"receipt": {"type": "string"}}, "required": ["receipt"], "additionalProperties": false
            }}}}}
          }}}
        }
      }}}
    }
  }}
}
```

For this witness, `primary` corresponds to `callbacks.first` and `audit` to `callbacks.second`; this explanatory association is test evidence, not a required document metadata field. The request the service sends is consumed-operation input, and the response it expects is output. Neither the destination in the source nor the declaration creates a receiver deployment or a binding target in the OBI.

Concretely, request `"notice"` is input and response `{"receipt":"received"}` is output. Swapping the operation schemas reverses this meaning and rejects these respective values; renaming a dependency does neither.

Renaming the dependency keys to `delivery` and `receipt` while preserving those associations is permitted. Core references still resolve, and both consumption points remain distinct. A claim that one merged dependency represents both distinct slots is disallowed (§6.2). Adding an artifact-derived `bindingSpecs` restriction or an invented callable receiver binding is also disallowed. Omitting one slot is permitted selective generation, but is not representation of both.

Use the ordinary 3.0/3.2 version substitutions above for callbacks. For 3.1 and 3.2 also exercise a webhook variant: move the `first` and `second` Path Item values (the values under the literal URLs) to root `webhooks.first` and `webhooks.second`, and remove `callbacks`. The two dependencies now correspond to those webhook slots; the same role and naming rules apply. No callbacks/webhooks variant is created for 2.0: generating an inbound dependency from that edition would invent a surface the binding does not define (§6.2).

## W6: diagnostic detail is optional, effects are not

For every edition's W1 artifact, make the selected path parameter non-required. It is upstream-invalid and removes the selected target before invocation. A concise error and a source-position diagnostic may differ publicly while both preserve the same refusal and no dispatch. The unaffected `/health` target remains available. These are semantic observations a test harness can make; no public `/dispatch` field is required (§3.2 and §8.1).

For example, one tool may say “The selected target cannot be invoked”; another may identify the non-required `id` declaration at `#/paths/~1pets~1{id}/post/parameters/0`. Neither message here claims to report overall document conformance.

A tool that dispatches anyway is not conforming. A tool that reports document conformance must still honor Core OBI-T-17; a tool whose schema translation loses meaning must still disclose the limitation required by OBI-T-05. Optional presentation does not waive either duty.

## W7: OpenAPI 3.2 streaming without a capability report

Use the 3.2 health OBI, changing the success content declaration to `application/jsonl` with `itemSchema: {"type":"string"}`. Its complete operation output schema remains `{"type":"string"}`. No static streaming report is supplied. A response body consisting of `"first"\n"second"\n` emits those two values in order; it is not one array-valued output. A later malformed item is not emitted and does not revoke prior successful values (§§9.5–9.6). Omitting generation-time capability metadata is permitted; changing these actual interaction semantics is not.

## W8: equivalent encoder techniques

For each 3.x edition, take the `/health` GET source target and add two optional query parameters with string schemas and `style: form`, `explode: false`. Parameter `ordinary` has `allowReserved: false`; `reserved` has `allowReserved: true`. At the binding-facing boundary, supply `{"parameters":{"ordinary":"a/b","reserved":"a/b&c+d"}}`. This is a direct parameter-serialization witness, not an operation input claimed to satisfy W4's empty-object contract.

Both a URI-template-style calculation and a direct character encoder must yield contributions `ordinary=a%2Fb` and `reserved=a/b%26c%2Bd`. Either contribution order is permitted; within each contribution the specified bytes are fixed. The assembled query has one leading `?` and one joining `&`. Producing `reserved=a/b&c+d` instead is disallowed: reserved delimiters escape their value and change its interpretation (§8.2). These two algorithms are witness techniques, not two configuration modes.

## W9: selection is not schema-loss permission

For each edition's W1 artifact, the generated output schema `{"type":"string"}` agrees with the declared successful string response. Selecting only this operation is not itself translation loss. If a generator instead claims that `{"type":"integer"}` faithfully represents that successful response, the claim is false (§12.2; Core §5.3). A surfaced representability limitation is distinct from a claim of faithful representation and is governed by Core OBI-T-05. A warning does not make an incompatible realization's contract true.

## Before/after verdicts and evidence limits

The earlier candidates required flat generation, a transform for every generated input, exhaustive coverage, diagnostic declaration positions, and slot-derived dependency keys. W1's nested case, W2's no-report selected output, W4's generated mapping-free case, and W6's concise diagnostic therefore establish concrete relaxations. W3's hand-authored invocation already followed the independent-axis architecture; it is a retained control, not a newly introduced capability. W5 establishes naming freedom and selective inbound generation; a renaming alone is not proof that an old deterministic-key requirement was violated, since either name might result from some deterministic algorithm. W7 removes a generation obligation, not a streaming rule. W8 clarifies an as-if implementation freedom without broadening query bytes. W9 preserves the existing honesty floor.

Core-schema validation and concrete transform evaluation establish only the facts they check. Normative selection/reporting verdicts require reading the binding prose. These witnesses do not claim a new selective-generation API exists in either SDK, do not establish whole-input-domain equivalence, and do not rerun runtime conformance merely by being present.

## Reference-fixture assertion scope

This map applies to all 154 OpenAPI synthesis cases: 25 for 2.0, 39 for 3.0, 56 for 3.1, and 34 for 3.2. A fixture can contain both portable semantic evidence and additional reference-tooling expectations. Matching the whole fixture tests the latter stronger promise.

| Assertion category / JSON location | Portable fact, where applicable | Additional reference-tooling promise |
| --- | --- | --- |
| `expected.operations`, binding `operationKey`, paths through generated operation names | Referenced Core operation keys resolve; each represented target has its claimed correspondence | The chosen key, complete key set, and one chosen operation per source slot |
| Binding `bindingSelector` | Exact selector meaning and target identity under §6.1 | Selecting every such target for generation |
| `expected.coverage.exhaustive`, `fullyRepresented` | A completeness/faithfulness claim cannot be false | A report exists, covers the full supplied source, and uses these fields |
| Coverage entry `sourceRef`, `scope`, `status`, `rule` | The affected source unit, semantic classification, governing rule, and confinement are correct | Exact report encoding, explicit records for every unit, and public source-position detail |
| Coverage entry requirements | Actual/conditional prerequisites and their owners retain their binding-defined meaning | Reporting these facts in this normalized record vocabulary |
| `expected.assertions` through generated schemas/transforms | Any emitted schema/correspondence must preserve the meaning it claims | Particular flatness, property names, schema factoring, output choice, and transform expression |
| Dependency entries | Correct consumption-point identity and role direction; no invented target or family restriction | Exhaustive inbound selection and normalized dependency report entries |
| `expected.outcome: refused` | The specified source/selected-unit defect or exclusion remains real | Whole-generation-call failure when a full-document faithful result cannot be delivered |
| `reasonCode`, prose | No additional portable claim | Local triage; ignored by portable semantic comparison as before |

Read mixed assertions in two parts. For example, an equality at `/operations/<chosen-key>/input/properties/<chosen-field>` can prove the declared field's schema is faithful **conditional on choosing that shape**; neither the path's chosen names nor that shape becomes compulsory. A coverage entry can prove a confined alternative is excluded without proving that every generator must emit such an entry. A source refusal remains a source refusal; the reference tool's decision to fail an entire generation call for other unrepresentable material is not silently promoted to that source rule.

Case-specific applications:

- `OAPI20-SS-02`, `OAPI31-SS-02/03/12`, `OAPI32-SS-02`, and `OAPI30-SS-31/36/65`: keep chosen shape/schema assertions as reference strategy, with faithful value correspondence as the retained semantic obligation.
- `OAPI30-SS-45`, `OAPI31-SS-45`, `OAPI32-SS-07`: keep reference dependency coverage; identity, role, and absence of invented targets remain portable, naming and exhaustive selection do not.
- `OAPI20-SS-13`, `OAPI30-SS-49`, `OAPI31-SS-51`, `OAPI32-SS-13`: removal of retired S-02 citations does not delete source/target classification evidence. Their surviving rule citations concern semantic distinctions, not the complete report shape.
- Existing invocation-fidelity examples with chosen generated shapes remain useful examples of one realization; their actual mapping and interaction observations are not relaxed by this scope distinction.

No new public reporting profile is defined here. The existing full-document reference-tooling tests retain their stronger checks; an independent generator demonstrates its own emitted correspondence without reproducing those additional product choices.
