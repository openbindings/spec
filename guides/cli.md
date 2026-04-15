# ob

One tool for every protocol. `ob` is the OpenBindings CLI: execute operations across REST, gRPC, MCP, GraphQL, and more from a single command. Create interfaces from existing APIs. Generate typed clients. Serve any service as MCP tools for AI agents.

```bash
ob op exec <url> <op>
```

Discovers the interface. Selects a binding. Delegates to the right executor. Returns the result.

**REST · gRPC · MCP · GraphQL · SSE** — same command, any protocol.

---

## See it in action

`ob` ships with a built-in demo: a coffee shop exposed over six protocols simultaneously, all described by a single OpenBindings Interface.

```bash
ob demo
```

Leave that running. In a second terminal:

```bash
# Execute an operation. ob discovers the interface, picks the best binding, makes the call.
ob op exec http://localhost:8080 getMenu

# Same operation, different protocol. Same result.
ob op exec http://localhost:8080 --binding getMenu.grpc

# Place an order over REST.
ob op exec http://localhost:8080 placeOrder \
  --input '{"drink": "Schema Latte", "size": "v2", "customer": "Alice"}'

# Stream live order updates over SSE.
ob op exec http://localhost:8080 orderUpdates
```

One interface. Six protocols. No protocol-specific code.

Configure demo ports:

```bash
ob demo --port 3000 --grpc-port 50051
```

---

## Install

```bash
brew install openbindings/tap/ob
```

Or with Go:

```bash
go install github.com/openbindings/cli/cmd/ob@latest
```

---

## Turn any API into MCP tools

`ob mcp` serves one or more OpenBindings interfaces as an MCP server. Point it at a service that publishes an OBI, a local OBI file, or any binding artifact that `ob` can synthesize into an OBI (an OpenAPI spec, a gRPC endpoint, etc.).

```bash
ob mcp https://api.example.com
```

Claude Desktop, Cursor, and other MCP clients connect via stdio (default) or HTTP and see every operation as a tool. Combine multiple services into one MCP server:

```bash
ob mcp https://api.example.com https://other.example.com
```

Operations are namespaced automatically when combining interfaces. Supports authenticated services:

```bash
ob mcp https://api.example.com --token sk-...
ob mcp https://api.example.com --token-file ./token.txt
```

Switch to HTTP transport for network-accessible MCP:

```bash
ob mcp http://localhost:8080 --transport http --port 9000
```

Set a custom server name:

```bash
ob mcp http://localhost:8080 --name my-tools
```

## Generate typed clients

Point `ob codegen` at any service (a URL or a local file) and get a typed client:

```bash
ob codegen https://api.example.com --lang typescript -o ./client.ts
```

The generated client gives you typed methods for every operation. You choose which binding executors to include. The client calls operations; the executor handles transport.

```typescript
import { OpenAPIExecutor } from "@openbindings/openapi";
import { MyServiceClient } from "./client";

const client = new MyServiceClient([new OpenAPIExecutor()]);
await client.connect("https://api.example.com", { bearerToken: "..." });

const result = await client.createWidget({ name: "foo" });
// result is typed, your editor knows the shape
```

For Go:

```bash
ob codegen ./interface.json --lang go -o ./client.go --package myclient
```

## Create from existing APIs

Already have an OpenAPI spec, AsyncAPI spec, or proto file? `ob create` generates an OBI from it. Your existing spec stays as-is. The OBI wraps it.

```bash
ob create openapi@3.1:./openapi.json -o interface.json
```

Override interface metadata:

```bash
ob create openapi.json --name "My Service" --version "1.0.0" --description "Public API"
```

## Serve

`ob serve` starts a local server that exposes ob's full capability surface. Discovery, binding execution, interface creation, context management, validation, and a native MCP endpoint, all behind a single session token.

```bash
ob serve
```

Binds to 127.0.0.1 only. A session token is generated on startup and printed to stderr. Clients present it as `Authorization: Bearer <token>`.

What the server exposes:

- **Discovery**: OBI at `/` and `/.well-known/openbindings`, OpenAPI spec at `/openapi.yaml`, AsyncAPI spec at `/asyncapi.yaml`
- **Binding execution**: execute bindings via `POST /bindings/execute` (supports HTTP and WebSocket)
- **Interface creation**: create OBIs from binding sources via `POST /interfaces/create`
- **Context management**: CRUD for stored credentials and headers at `/contexts`
- **HTTP client**: make HTTP requests on behalf of callers at `POST /http/request`
- **Authoring**: validate, diff, and check compatibility via POST endpoints
- **Native MCP endpoint**: a full MCP server at `/mcp`, exposing the same operations as tools and resources

Provide a stable token for CI/CD:

```bash
ob serve --token my-secret-token
ob serve --token-file ./token.txt
```

Configure CORS for browser-based clients:

```bash
ob serve --allow-origin http://localhost:3000
```

Set a custom port (default: 20290):

```bash
ob serve --port 9000
```

Connect as a programmatic client:

```typescript
const client = new HostClient([new OpenAPIExecutor()]);
await client.connect("http://localhost:20290", { bearerToken: token });
const info = await client.getInfo();
```

Or connect via MCP at `http://localhost:20290/mcp` using any MCP client.

---

## Execute operations

`ob op exec` is the core command. Point it at a URL or a local file, name the operation, and ob handles the rest: discovery, binding selection, protocol dispatch, and streaming.

```bash
ob op exec http://localhost:8080 getMenu
```

Target a specific binding:

```bash
ob op exec http://localhost:8080 --binding getMenu.grpc
```

Pass input as JSON:

```bash
ob op exec http://localhost:8080 placeOrder \
  --input '{"drink": "Schema Latte", "size": "v2", "customer": "Alice"}'
```

Streaming operations output one JSON value per line until the stream closes:

```bash
ob op exec http://localhost:8080 orderUpdates
```

Works with local files:

```bash
ob op exec ./my-service.obi.json getMenu
```

Use `--verbose` to see which binding was selected and how long execution took:

```bash
ob op exec http://localhost:8080 getMenu -v
```

## Discover and fetch

Download a service's OBI for local inspection or offline use:

```bash
ob fetch localhost:8080
```

Tries the URL directly, then falls back to `/.well-known/openbindings`, and writes the result to a local file.

## Manage credentials

`ob context` stores credentials and headers per service URL. These are used automatically when executing operations. Credentials are stored in the OS keychain. Non-secret fields (headers, cookies, environment) go to config files.

```bash
ob context set https://api.example.com --bearer-token sk-...
ob context set https://api.example.com --api-key my-key
ob context set https://api.example.com --header "X-Custom: value"
ob context set https://api.example.com --cookie "session=abc123"
ob context set https://internal.example.com --basic  # prompts for username/password
```

Import context from a curl command:

```bash
ob context set https://api.example.com --from-curl 'curl -H "Authorization: Bearer sk-..." https://api.example.com'
```

Scope credentials to a specific source within an interface:

```bash
ob context set https://api.example.com --source adminApi --bearer-token sk-admin-...
```

Pass environment variables for CLI-based binding executors:

```bash
ob context set https://api.example.com --env "API_ENV=production"
```

```bash
ob context list              # show all stored contexts
ob context get <url>         # show details for a URL (secrets masked)
ob context remove <url>      # delete a context
```

## Conform to shared interfaces

Roles are published interfaces that your service can declare it satisfies. `ob conform` scaffolds the operations and schemas you need:

```bash
ob conform context-store.json my-service.obi.json --yes
```

```
+ deleteContext -- scaffolded
+ getContext -- scaffolded
+ listContexts -- scaffolded
+ setContext -- scaffolded
Wrote my-service.obi.json
```

Running it again after the role interface updates detects drift and offers to replace changed schemas:

```bash
ob conform context-store.json my-service.obi.json
```

```
✓ deleteContext -- in sync
~ getContext -- replace? [Y/n]
✓ listContexts -- in sync
✓ setContext -- in sync
```

Preview without modifying files:

```bash
ob conform context-store.json my-service.obi.json --dry-run
```

## Validate and compare

Check structural correctness and role conformance:

```bash
ob validate my-service.obi.json
```

```
✓ Valid

Role Conformance
  ✓ openbindings.context-store -- 4/4 operations
  ✓ openbindings.software-descriptor -- 1/1 operations
```

Use `--skip-roles` to disable conformance checking. Use `--strict` to additionally reject unknown fields and require a supported version.

Compare two interfaces for compatibility:

```bash
ob compat published-interface.json my-service.obi.json
```

The first argument is the target, the second is the candidate. Checks operation matching (by key, alias, or satisfies declaration) and schema compatibility (input/output directional rules per the spec).

Structural diff between two OBIs:

```bash
ob diff baseline.json updated.json
```

Or compare an OBI against what its binding sources currently produce:

```bash
ob diff my-service.obi.json --from-sources
```

## Sync and merge

Re-read binding sources and merge changes into your OBI:

```bash
ob sync my-service.obi.json
```

Sync preserves local edits with a three-way merge. Use `--force` to prefer source for all conflicts. Scope to specific operations with `--op`:

```bash
ob sync my-service.obi.json --op getUser --op listUsers
```

Selectively apply changes from one OBI into another:

```bash
ob merge target.obi.json source.obi.json
```

Or derive changes from the target's own binding sources:

```bash
ob merge target.obi.json --from-sources
```

Preview first with `--dry-run`, or apply everything with `--all`.

List merge conflicts between local edits and source changes:

```bash
ob conflicts my-service.obi.json
```

## Manage sources

Add, list, and remove binding source references on an OBI:

```bash
ob source add my-service.obi.json openapi@3.1:./openapi.json
ob source list my-service.obi.json
ob source remove my-service.obi.json publicApi
```

---

## Command reference

### Explore

| Command | What it does |
|---------|-------------|
| `ob demo` | Run the built-in multi-protocol demo server |
| `ob fetch` | Download an OBI from a URL or host |
| `ob op exec` | Execute an operation via its binding |
| `ob op list` | List operations in an interface |

### Integrate

| Command | What it does |
|---------|-------------|
| `ob mcp` | Serve interface URLs as an MCP server for AI agents |
| `ob serve` | Start a local HTTP server with discovery and native MCP |
| `ob codegen` | Generate typed clients from an OBI |

### Author

| Command | What it does |
|---------|-------------|
| `ob create` | Create an OBI from existing binding artifacts |
| `ob conform` | Scaffold operations to satisfy a role interface |
| `ob op add` | Add a new operation to an OBI |
| `ob op rename` | Rename an operation and update all references |
| `ob op remove` | Remove operations and their bindings from an OBI |
| `ob source` | Manage source references (`add`, `list`, `remove`) |

### Validate

| Command | What it does |
|---------|-------------|
| `ob validate` | Check structural validity and role conformance |
| `ob compat` | Compare two interfaces for compatibility |
| `ob diff` | Structural diff between two OBIs |

### Maintain

| Command | What it does |
|---------|-------------|
| `ob sync` | Re-read binding sources and merge changes |
| `ob merge` | Selectively apply changes between OBIs |
| `ob conflicts` | List merge conflicts between local edits and source changes |
| `ob context` | Manage per-URL credentials and headers |

### System

| Command | What it does |
|---------|-------------|
| `ob init` | Initialize an OpenBindings environment |
| `ob status` | Show environment or sync status |
| `ob info` | Display ob version and metadata |
| `ob formats` | List supported binding format tokens |
| `ob delegate` | Manage registered delegates (`add`, `list`, `remove`, `resolve`) |
| `ob binding exec` | Low-level binding execution for machine-to-machine use |

## Source

[GitHub](https://github.com/openbindings/cli)
