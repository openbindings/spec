# Getting Started

OpenBindings is an open standard for describing **what a service does** separately from **how you access it**. A single OpenBindings Interface (OBI) can carry bindings for REST, gRPC, MCP, and any other protocol without redefining the contract for each one.

The fastest way to see this in action is with the `ob` CLI.

## Install

```bash
brew install openbindings/tap/ob
```

Or with Go:

```bash
go install github.com/openbindings/cli/cmd/ob@latest
```

## Start the demo

`ob` ships with a built-in demo: OpenBlendings, a coffee shop exposed over six protocols simultaneously (REST, Connect, gRPC, MCP, GraphQL, and AsyncAPI), all described by a single OBI.

```bash
ob demo
```

Leave that running and open a second terminal.

## Execute an operation

You can point `ob` directly at a running service. No need to download anything first:

```bash
ob op exec http://localhost:8080 getMenu
```

That returned the menu. But how? The CLI fetched the OBI from `localhost:8080/.well-known/openbindings`, found the `getMenu` operation, selected the highest-priority binding (REST in this case), read the OpenAPI source to know the HTTP method and path, and made the call.

Now run the same operation over gRPC:

```bash
ob op exec http://localhost:8080 --binding getMenu.grpc
```

Same operation, same result, different protocol. This time the CLI selected the gRPC binding, read the proto definition from the gRPC source, and called the service using the gRPC protocol instead. The operation contract didn't change. Only the binding did.

Try placing an order:

```bash
ob op exec http://localhost:8080 placeOrder \
  --input '{"drink": "Schema Latte", "size": "v2", "customer": "Alice"}'
```

And stream live order updates over SSE:

```bash
ob op exec http://localhost:8080 orderUpdates
```

You can also save the interface locally with `ob fetch localhost:8080` and work against the file instead of the URL. Either way works.

## How that worked

The demo server publishes a single OBI that wires five operations to six protocol sources. Each binding maps an operation to a specific entry point in a source. The source declares its format (`openapi@3.1`, `grpc`, etc.) and location. When you run `ob op exec`, the CLI selects a binding, resolves its source, and hands off to a format-aware **binding executor** that knows how to speak that protocol.

The OBI doesn't implement protocol logic. It just tells binding executors where to look. See [Creators and Executors](creators-and-executors.md) and [Interface Client](interface-client.md) for more on how this works.

This is the core idea behind OpenBindings:

- **Operations** define what a service can do: named units of capability with input and output schemas.
- **Sources** point to existing binding artifacts (an OpenAPI doc, a proto file, an MCP server).
- **Bindings** map each operation to a specific entry point in a source.

Operations define meaning. Bindings define access. Change one without touching the other.

## What an OBI looks like

An OBI is just JSON (or YAML). You can write one by hand, generate one with `ob create`, or edit an existing one in any text editor. Here's a minimal interface for an echo service with one operation and one REST binding:

```json
{
  "openbindings": "0.1.0",
  "name": "Echo Service",
  "version": "1.0.0",
  "operations": {
    "echo": {
      "description": "Echo a message back unchanged.",
      "input": {
        "type": "object",
        "properties": {
          "message": { "type": "string" }
        },
        "required": ["message"]
      },
      "output": {
        "type": "object",
        "properties": {
          "message": { "type": "string" }
        }
      }
    }
  },
  "sources": {
    "restApi": {
      "format": "openapi@3.1",
      "location": "./openapi.json"
    }
  },
  "bindings": {
    "echo.restApi": {
      "operation": "echo",
      "source": "restApi",
      "ref": "#/paths/~1echo/post"
    }
  }
}
```

The `operations` section is the authoritative contract. The `sources` and `bindings` sections wire it to your existing specs. Adding a second protocol means adding a source and a binding. The operations don't change.

## Create an interface from an existing API

If you already have an OpenAPI spec, a proto file, or another supported artifact, `ob create` can generate an OBI from it:

```bash
ob create openapi.json
```

This reads the spec, extracts operations, and produces a starting point. You can add more sources later with `ob source add`, or just open the file and edit it directly.

## Key concepts

| Concept | What it means |
|---------|---------------|
| **Operation** | A named unit of capability with input/output schemas. The building block of an interface. |
| **Source** | A reference to a binding artifact, identified by format and location. |
| **Binding** | A mapping from an operation to a specific entry point in a source. |
| **Interface** | The full OBI document: operations, schemas, sources, and bindings together. |
| **Binding executor** | A format-aware component that knows how to execute bindings in a specific protocol (OpenAPI, gRPC, etc.). |
| **Role** | A published interface that other services can declare they satisfy, like a trait or protocol. |
| **Discovery** | Services publish their OBI at `/.well-known/openbindings` so tools can find them automatically. |

## Next steps

- [Read the full specification](../openbindings.md) for normative details
- [Explore the ob CLI](cli.md) for the complete command reference
- [Browse examples](../examples/) to see real-world OBIs
- [Download the JSON Schema](../openbindings.schema.json) for editor validation
- [Join the community](https://github.com/openbindings/spec/discussions) to contribute and discuss
