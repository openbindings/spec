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
| `sources.*.format` | `sources.*.bindingSpec` |
| Informal format tokens such as `openapi@3.1` | Exact governing identifiers such as `openbindings.openapi@1` |
| `bindings.*.priority` and `sources.*.priority`; lower wins | `bindings.*.preference`; higher is a stronger author preference |
| `bindings.*.ref` | `bindings.*.selector`; same meaning — the binding-specification-defined selector of a target within the governed source |
| Transform objects such as `{ "language": "jsonata", "expression": "..." }` | A JSONata expression string |
| `operation.input: null` or `operation.output: null` for unspecified | Omit the member |
| Root `roles` and operation `satisfies` | Remove; express qualified shared-contract names as operation aliases where appropriate |
| No Core operation-dependency declaration | Optional named `dependencies` entries reference local operation keys and may constrain acceptable `bindingSpecs` |
| Root `security` and `bindings.*.security` | Remove; provide credentials and other prerequisites as invocation context |
| Relative source locations and schema references | Make source locations binding-spec-valid absolute addresses; make OBI-governed references absolute or same-document |

Do not translate `priority` to `preference` mechanically. The direction
reversed and 0.2 defines no selection algorithm. Reconsider the intended
author signal, place it on individual bindings, and negate/order values only
if that faithfully expresses the original intent.

## Re-evaluate the contract

In 0.2, operation `input` and `output` are contracts on **each value**, not
declarations of unary, streaming, or other invocation shape. Cardinality and
wire behavior remain under the governing binding specification and concrete
protocol.

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
and may list one or more exact binding-specification identifiers acceptable at
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
      "bindingSpecs": ["openbindings.openapi@1"]
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

A 0.2 source names an exact binding specification, not merely an artifact
format. For every source:

1. Select the binding specification that actually governs the source and its
   bindings.
2. Replace `format` with that specification's exact identifier.
3. Validate `location`, `content`, and every binding `selector` under that
   specification.
4. Supply any required runtime choices through invocation context
   configuration; do not invent them in the OBI.
5. Refuse or exclude interactions that the binding specification cannot
   represent faithfully.

The project-published identifiers are catalogued in
[`binding-specs/README.md`](binding-specs/README.md). Their revision number is
the binding specification's revision, not the upstream artifact's version.
Each binding specification states which upstream versions it incorporates.

Authentication is no longer modeled as document data. A binding invoker
reports the context it requires, and a caller or context resolver supplies it
at invocation time. Do not move secrets from a 0.1 `security` map into an
extension field merely to preserve the old shape.

## Recheck references and transforms

OBI documents are context-free in 0.2:

- source locations cannot depend on the OBI retrieval URL;
- OBI-governed references are absolute or same-document;
- named transform references have the form `#/transforms/<key>`;
- schema reference behavior follows JSON Schema 2020-12 from the OBI document
  root, subject to nested `$id` rebasing.

Every inline and named transform is a JSONata 2.1 expression string. Transforms
operate once per input or output value and never change cardinality. A
document-supplied expression cannot rely on host-reaching extensions such as
filesystem, network, environment, or process access.

## Validation checklist

Before considering a document migrated:

1. Parse it with a 0.2 parser that rejects malformed JSON, duplicate keys, a
   byte-order mark, and invalid UTF-8.
2. Validate it against [`openbindings.schema.json`](openbindings.schema.json)
   and the normative document rules in
   [`openbindings.md` §10](openbindings.md#10-conformance).
3. Validate each source and binding against its exact binding specification.
4. Exercise every named operation and alias through the 0.2 resolution rules.
5. Evaluate transforms and validate representative values in both directions.
6. Confirm runtime context requirements, binding selection, errors,
   cancellation, ordering, and stream behavior with the implementation that
   will invoke the document.

The 0.2 conformance model permits an honest `conformance undetermined` result
when a verifier lacks binding-specific or external schema knowledge. Partial
verification must not be presented as unqualified conformance.

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
      "bindingSpec": "openbindings.openapi@1",
      "location": "https://api.example.com/openapi.json"
    }
  },
  "bindings": {
    "getPet.http": {
      "operation": "getPet",
      "source": "api",
      "selector": "#/paths/~1pets~1{id}/get"
    }
  }
}
```

The example shows document-shape changes only. Whether that `location` and
`selector` pair is sufficient and invocable depends on
[`openbindings.openapi@1`](binding-specs/openapi/openbindings.openapi.md), and
the operation schemas still need to be checked against the actual upstream
interaction.
