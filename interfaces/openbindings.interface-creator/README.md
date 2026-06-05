# Interface Creator

An interface creator produces an OBI from a binding artifact in a specific format. Given a source artifact (an OpenAPI spec, an AsyncAPI document, a protobuf file, or any other supported format), it extracts operations, schemas, sources, bindings, and security into an OpenBindings interface document.

This is what powers `ob create`, on-the-fly OBI synthesis when a consumer is handed a raw binding artifact, and any tool that needs to bootstrap OBI adoption from existing specs.

## Security population

Interface creators SHOULD populate the OBI's `security` section when the binding format provides security metadata. This happens at OBI creation time, the same moment operations, schemas, and bindings are extracted.

### Format-specific security extraction

Each binding format has its own security metadata:

| Format | Security metadata source | Mapping |
|--------|--------------------------|---------|
| OpenAPI 3.x | `securitySchemes` in `components` | `http/bearer` → `bearer`, `oauth2` → `oauth2` (with URLs), `http/basic` → `basic`, `apiKey` → `apiKey` (with name/in) |
| AsyncAPI 3.x | `securitySchemes` in `components` | Same mapping as OpenAPI |
| gRPC | No security metadata in protobuf | No security section; invoker auth retry handles 401 |
| MCP | No security metadata in MCP session | No security section; invoker auth retry handles 401 |
| Usage spec | Local CLI invocation, no network auth | No security section |

Interface creators SHOULD produce per-binding security references when the format supports per-operation security requirements (e.g., OpenAPI's operation-level `security` field). Bindings for public endpoints (no security requirement) SHOULD NOT have a `security` reference.

## Other extraction conventions

- **Operations.** Each callable target in the source becomes one operation. The operation key SHOULD be stable across regenerations: derive it from a source-level identifier (OpenAPI `operationId`, gRPC method name, GraphQL field name) rather than from positional ordering.
- **Schemas.** Resolve `$ref` pointers when the source format uses them, so the produced OBI is self-contained. Cycle-protect when the input format permits cyclical type references.
- **Sources.** Echo the input source's `format`, `location`, and (when requested) `content`/`outputLocation` faithfully. Do not normalize URLs or rewrite locations unless explicitly asked.
- **Bindings.** Each binding entry MUST carry a `ref` that the corresponding binding invoker can resolve back to the source artifact. Use the ref convention of the binding format (JSON Pointer for OpenAPI, `<RootType>/<field>` for GraphQL, fully-qualified method name for gRPC).

## Deterministic output

A creator SHOULD produce byte-stable output for byte-stable input. That means: stable property ordering, stable iteration order over operations, no embedded timestamps, no generated UUIDs. Determinism lets CI compare creator output against checked-in OBIs without spurious diffs.

## Idempotency

`createInterface` is declared idempotent in the contract. The creator MUST NOT mutate the input source, MUST NOT persist global state, and MUST produce the same OBI for the same input regardless of how many times it is invoked.
