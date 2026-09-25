# Migrating an OBI from 0.1 to the 0.2 draft

OpenBindings 0.2 is an unreleased, pre-1.0 working draft. It deliberately
changes the 0.1 document model. Changing only `openbindings` from `0.1.0` to
`0.2.0` is not a migration: review every item below and validate the result
with a 0.2 implementation.

This guide covers OBI documents. SDK and CLI APIs may also change before the
0.2 release; their repositories document their language-specific surfaces.

## Mechanical document changes

| 0.1 | 0.2 draft |
| --- | --- |
| `sources.*.format` | `sources.*.kind` |
| Informal format tokens such as `openapi@3.1` | Exact kind strings such as `openbindings.openapi-3.1@1`, selected for the tool behavior intended to handle the source |
| `bindings.*.priority` and `sources.*.priority`; lower wins | `bindings.*.preference`; higher is a stronger author preference |
| `bindings.*.ref` | `bindings.*.content`: optional JSON content read under the source's kind; it may identify the target |
| `sources.*.location` and `sources.*.content` | `sources.*.content` alone, in the shape the intended tool behavior reads; the core has no `location` member |
| Root `transforms`, binding `inputTransform`/`outputTransform`, and transform objects such as `{ "language": "jsonata", "expression": "..." }` | Remove; any value adaptation is read under the source's kind, possibly through `bindings.*.content` |
| `operation.input: null` or `operation.output: null` for unspecified | Omit the member |
| Root `roles` and operation `satisfies` | Remove; express qualified shared-contract names as operation aliases where appropriate |
| No Core operation-dependency declaration | Optional named `dependencies` entries reference local operation keys and may constrain acceptable `kinds` |
| Root `security` and `bindings.*.security` | Remove; provide credentials and other prerequisites as invocation context |
| Relative schema references | Make schema references absolute or same-document |

A 0.1 member left in place (`format`, `priority`, `ref`, `location`, `security`, `roles`, `satisfies`, `transforms`, `inputTransform`, `outputTransform`) makes a 0.2 document non-conformant: an object the specification defines carries no unprefixed field it does not define (§12). The intermediate draft's `bindingSpec` and `bindingSpecs` are likewise not members of the current 0.2 model. Keep private data under an `x-` name.

Do not translate `priority` to `preference` mechanically. The direction
reversed and 0.2 defines no selection algorithm. Reconsider the intended
author signal, place it on individual bindings, and negate/order values only
if that faithfully expresses the original intent.

## Re-evaluate the contract

In 0.2, operation `input` and `output` are contracts on **each value**, not
declarations of unary, streaming, or other invocation shape. Cardinality and
wire behavior are read under the source's kind and concrete protocol.

- An absent schema means unspecified.
- `{}` or `true` accepts any JSON value.
- `false` accepts no value.
- `{ "type": "null" }` accepts only the JSON value `null`.
- `output` constrains successful output values, not protocol error envelopes.

Boolean JSON Schemas are valid at every schema position. If a 0.1 document or
consumer inferred invocation cardinality from schema presence, that inference
must be removed.

Operation aliases now share one flat, document-wide namespace with operation
keys. Keys and aliases have equal standing during name resolution, and every
name must be unique. A qualified alias may assert correspondence with a shared
contract operation, but OpenBindings does not verify the semantic truth of
that author claim.

The 0.2 `idempotent` field is an author-attested claim about intended
operation-level effects under equivalent input and relevant context. It is not
authorization to retry, cache, or assume stable output. Recheck any 0.1 value
that was written with the broader “safe to retry” description in mind.

## Declare consumed operations where applicable

The 0.2 draft can describe operations the component consumes as named entries
in `dependencies`. Each entry references an operation key in the same document
and may list one or more exact kinds acceptable at
that consumption point:

```json
{
  "openbindings": "0.2.0",
  "operations": {
    "events.deliver": {}
  },
  "dependencies": {
    "customerDelivery": {
      "operation": "events.deliver",
      "kinds": ["openbindings.openapi-3.1@1"]
    }
  }
}
```

There is no direct 0.1 equivalent and no automatic migration. In particular,
do not translate former `roles` or `satisfies` declarations into dependencies:
those fields expressed cross-document correspondence, while a dependency is a
local consumption point. Provider discovery, compatibility, registration,
selection, readiness, and behavior when a dependency is unsatisfied remain
outside the document model.

## Rebind every source

A 0.2 source carries an exact kind. For every source:

1. Select a kind supported by the tool that will read or act on the source.
2. Replace `format` with that exact kind string.
3. Carry source and binding `content` in the shapes that tool expects for the kind. The core does not validate their kind-specific meaning.
4. Supply any required runtime choices through invocation context configuration; do not invent them in the OBI.
5. Check that the intended tool can faithfully perform the interactions the OBI claims.

The project's candidate kinds and its own authoring policy are described in
[`binding-specs/README.md`](binding-specs/README.md). The core imposes no
definition, publication, or revision requirement on other kinds.

Authentication is no longer modeled as document data. A binding invoker
reports the context it requires, and a caller or context resolver supplies it
at invocation time. Do not move secrets from a 0.1 `security` map into an
extension field merely to preserve the old shape.

## Recheck references and transforms

OBI documents are context-free in 0.2:

- what a source's or binding's `content` means, including any address or
  reference within it, is read under the source's kind and is outside the core;
- OBI-governed references are absolute or same-document;
- schema reference behavior follows JSON Schema 2020-12 from the OBI document
  root, subject to nested `$id` rebasing.

The 0.2 core defines no transforms. A 0.1 transform adapted values between
the operation's contract and the source; in 0.2 any such adaptation is read
under the source's kind. Carry a mapping in binding `content` only if the
intended tool reads one there. The operation's schemas still describe the
caller-facing values.

## Validation checklist

Before considering a document migrated:

1. Parse it with a 0.2 parser that rejects malformed JSON, duplicate keys, a
   byte-order mark, and invalid UTF-8.
2. Validate it against [`openbindings.schema.json`](openbindings.schema.json)
   and the normative document rules in
   [`openbindings.md` §10](openbindings.md#10-conformance).
3. Check source and binding `content` with the intended kind-specific tool, if one is available; this is separate from document conformance.
4. Exercise every named operation and alias through the 0.2 resolution rules.
5. Validate representative values in both directions, through any value
   adaptation the intended tool performs.
6. Confirm runtime context requirements, binding selection, errors,
   cancellation, ordering, and stream behavior with the implementation that
   will invoke the document.

The 0.2 conformance model permits an honest `conformance undetermined` result
when a validator lacks a capability needed for a document rule. Kind-specific
behavior and external schema availability are not document-conformance checks.
Partial validation must not be presented as unqualified conformance.

## Minimal shape comparison

0.1:

```json
{
  "openbindings": "0.1.0",
  "operations": {
    "getPet": {
      "input": null,
      "output": { "type": "object" }
    }
  },
  "sources": {
    "api": {
      "format": "openapi@3.1",
      "location": "./openapi.json"
    }
  },
  "bindings": {
    "getPet.http": {
      "operation": "getPet",
      "source": "api",
      "ref": "#/paths/~1pets~1{id}/get",
      "priority": 0
    }
  }
}
```

0.2 draft:

```json
{
  "openbindings": "0.2.0",
  "operations": {
    "getPet": {
      "output": { "type": "object" }
    }
  },
  "sources": {
    "api": {
      "kind": "openbindings.openapi-3.1@1",
      "content": { "location": "https://api.example.com/openapi.json" }
    }
  },
  "bindings": {
    "getPet.http": {
      "operation": "getPet",
      "source": "api",
      "content": { "target": "#/paths/~1pets~1{id}/get" }
    }
  }
}
```

The example shows document-shape changes only. The `content` shown on the
source and binding is illustrative; the core does not interpret it. Check the
operation schemas against the actual interaction performed by the intended
kind-specific tool. The project's OpenAPI candidates are described in
[binding-specs/README.md](binding-specs/README.md).
