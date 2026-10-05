# OpenAPI value-flow example

This is an **informative example** of the OpenAPI family's shared mapping rules.
The [3.1 candidate](openapi-3.1/openbindings.openapi-3.1.md) governs the concrete
artifact below. The [2.0](openapi-2.0/openbindings.openapi-2.0.md),
[3.0](openapi-3.0/openbindings.openapi-3.0.md) and
[3.2](openapi-3.2/openbindings.openapi-3.2.md) candidates incorporate the same JSONata
embedding; their native artifacts and edition-specific interpretation still differ.
All four kind identifiers remain unpublished candidates.

The source and binding below are entries of an OBI document. They show the whole
kind-owned content, but are not a complete OBI document or a synthesized contract.
Suppose the surrounding document declares operation `submitBatch`, source `api`
and a binding associating them. The caller's application value need not have the
HTTP request envelope's shape.

## Source and binding

Source `api` embeds a self-contained description with one server and no security
requirement. It needs no retrieval base or credential selection:

```json
{
  "kind": "openbindings.openapi-3.1@1",
  "content": {
    "document": {
      "openapi": "3.1.2",
      "info": {"title": "Batch example", "version": "1"},
      "servers": [{"url": "https://api.example.test"}],
      "paths": {
        "/tenants/{tenant}/batch": {
          "post": {
            "parameters": [
              {"name": "tenant", "in": "path", "required": true,
               "schema": {"type": "string"}}
            ],
            "requestBody": {
              "required": true,
              "content": {"application/json": {"schema": {"type": "object"}}}
            },
            "responses": {
              "200": {
                "description": "Batch accepted",
                "content": {"application/json": {"schema": {"type": "object"}}}
              },
              "204": {"description": "Batch accepted without a returned value"}
            }
          }
        }
      }
    }
  }
}
```

The binding selects the mounted path and method using a literal JSON Pointer.
Each `/` in the path key is escaped as `~1`; there is no URI-fragment prefix:

```json
{
  "operation": "submitBatch",
  "source": "api",
  "content": {
    "target": "/paths/~1tenants~1{tenant}~1batch/post",
    "input": "($root := $; $assert($type(rows) = \"array\"); {\"parameters\": {\"tenant\": tenant}, \"body\": {\"items\": [rows.{\"tenant\": $root.tenant, \"name\": name}], \"note\": note, \"traceId\": traceId}})",
    "output": "{\"count\": accepted}"
  }
}
```

## One invocation

The caller supplies this application value:

```json
{
  "tenant": "t-7",
  "rows": [{"name": "alpha"}, {"name": "beta"}],
  "note": null
}
```

The input mapping produces this request envelope:

```json
{
  "parameters": {"tenant": "t-7"},
  "body": {
    "items": [
      {"tenant": "t-7", "name": "alpha"},
      {"tenant": "t-7", "name": "beta"}
    ],
    "note": null
  }
}
```

The expression captures the original caller value in `$root`. Inside the
`rows` path, `name` reads the current row and `$root.tenant` reads the caller.
The explicit array constructor preserves empty and singleton collections.
Missing `traceId` produces absence, so that object member is omitted. Present
`note: null` remains a supplied null and is preserved by the JSON body mapping.

The native interaction is a POST to
`https://api.example.test/tenants/t-7/batch` with `Content-Type: application/json`
and the envelope's `body` as its JSON value. The `parameters` member is not sent
inside that body. The artifact supplies one server and one request media type,
so this example needs no choice between alternatives. JSON whitespace and
object-member order are not fixed by this trace.

Suppose the complete successful response is status 200 with
`Content-Type: application/json` and body `{"accepted":2}`. Decoding yields that
object; the output mapping then emits the operation value `{"count":2}`.

## Nearby cases

| Change | Result under the same binding |
| --- | --- |
| Caller omits `note` | The request body omits `note`; it does not insert null. |
| Caller supplies `rows: []` | The body contains `items: []`. |
| Caller supplies `rows: null` | The expression's array assertion fails before dispatch. |
| Caller omits `tenant` | The required path parameter is absent: invocation cannot dispatch. |
| A complete 204 response has no content | No response value is decoded, so the output mapping runs zero times and emits nothing. |
| A complete 200 response has zero content octets | It likewise emits no value. Even replacing the output mapping with a literal would not manufacture a value. |
| A 200 JSON response contains `null` | This is a present decoded null. `accepted` is absent, so this particular output mapping emits `{}`, not absence or null. |
| A nonempty unary JSON response is truncated | Completion is unsuccessful and no partial value is emitted. |
| A 400 response contains `{"accepted":2}` | Completion is unsuccessful; the body does not become an operation output. |

These outcomes describe the kind's correspondence. A surrounding operation
invoker additionally checks any declared application value contracts; this
example does not infer those contracts from the OAS schemas or prove a binding
author's realization claim.
