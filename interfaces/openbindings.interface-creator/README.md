# Interface Creator

An interface creator produces an OBI from a binding artifact in a specific format. Given a source artifact (an OpenAPI spec, an AsyncAPI document, a protobuf file, or any other supported format), it extracts operations, schemas, sources, and bindings into an OpenBindings interface document.

This is what powers `ob create`, on-the-fly OBI synthesis when a consumer is handed a raw binding artifact, and any tool that needs to bootstrap OBI adoption from existing specs.

## Authentication is not extracted

An OBI document carries no authentication or `security` section, so a creator does not extract credentials, security schemes, or auth requirements into the OBI. Authentication is a runtime prerequisite, not interface metadata: the binding invoker negotiates it at call time via a `CONTEXT_REQUIRED` challenge, resolved into a context store (see the [`binding-invoker`](../openbindings.binding-invoker/) interface).

A format's security metadata (for example OpenAPI's `securitySchemes`) is therefore not mapped into the document. At most it can inform what the invoker asks for at invocation time; it is never baked into the static OBI.

## Other extraction conventions

- **Operations.** Each callable target in the source becomes one operation. The operation key SHOULD be stable across regenerations: derive it from a source-level identifier (OpenAPI `operationId`, gRPC method name, GraphQL field name) rather than from positional ordering.
- **Schemas.** Resolve `$ref` pointers when the source format uses them, so the produced OBI is self-contained. Cycle-protect when the input format permits cyclical type references.
- **Sources.** Echo the input source's `format`, `location`, and (when requested) `content`/`outputLocation` faithfully. Do not normalize URLs or rewrite locations unless explicitly asked.
- **Bindings.** Each binding entry MUST carry a `ref` that the corresponding binding invoker can resolve back to the source artifact. Use the ref convention of the binding format (JSON Pointer for OpenAPI, `<RootType>/<field>` for GraphQL, fully-qualified method name for gRPC).
- **Aliases (optional).** A creator MAY add operation `aliases` to claim correspondence with a shared contract (for example, a well-known operation name a consumer can target across providers). The name is author-asserted and carries no verification semantics.

## Deterministic output

A creator SHOULD produce byte-stable output for byte-stable input. That means: stable property ordering, stable iteration order over operations, no embedded timestamps, no generated UUIDs. Determinism lets CI compare creator output against checked-in OBIs without spurious diffs.

## Idempotency

`createInterface` is declared idempotent in the contract. The creator MUST NOT mutate the input source, MUST NOT persist global state, and MUST produce the same OBI for the same input regardless of how many times it is invoked.
