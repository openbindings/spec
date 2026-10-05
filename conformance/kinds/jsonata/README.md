# JSONata embedding evidence

The OpenAPI 2.0, 3.0, 3.1 and 3.2 current-kind probes use upstream `jsonata@2.1.1`
through this test bridge. They no longer implement the removed structural
transform language. This is test infrastructure, not a Go SDK implementation,
another independent JSONata implementation or proof of full kind support.

From the spec root:

```sh
npm ci --prefix conformance/kinds/jsonata --ignore-scripts --no-audit --no-fund
npm test --prefix conformance/kinds/jsonata
```

Then run the four `scripts/verify-openapi-*-kind.mjs` entry points. Node.js and
this installed dependency are required in addition to those suites' existing
prerequisites. Their native HTTP cases require temporary loopback listeners.

The 22 direct tests trace to [the shared embedding](../../../binding-specs/jsonata.md)
and its incorporated upstream language: sequence normalization (zero, one and
many results), explicit arrays, object omission, absence versus null, ordinary
arithmetic and author functions, expression errors, non-JSON results, and the
closed host-binding boundary. Two literal expected results exercise the OpenAPI
§4 open-body example, including an empty remainder and unknown future members.
The family suites separately exercise native request bodies, per-value output
adaptation, input refusal and unsuccessful completion after emitted outputs.

The Python bridge refuses integer inputs outside the interoperable range and
decimal inputs it cannot preserve. This is a disclosed test-bridge capability
limit, not a new restriction on kind implementations. It uses one subprocess
per Python test process; that mechanism is not a specification requirement.
The direct tests use the incorporated reference implementation, so they test
the embedding and witnesses, not independent language conformance. The native
probes retain independently authored HTTP expectations; migrated expressions
and changed expectations are maintenance work, not fresh independent authorship.
