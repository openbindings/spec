# Implementing a Binding Format

**Status**: Implementation guidance. Not part of the normative specification.

This document is a practical walkthrough for implementing a new binding format — i.e., publishing a package like `@my-org/openbindings-acme` or `github.com/my-org/openbindings-acme-go` that lets OpenBindings consumers invoke against your wire protocol.

For the conceptual layer (what these roles are, why they're separate, the deployment models), see [Creators and Invokers](./creators-and-invokers.md). For the consumer side (how application code uses your format), see [Consuming an OpenBindings Interface](./interface-client.md).

The Go and TypeScript SDKs follow the same shape; this guide shows both side-by-side. Examples assume the running example of a fictional `acme-gateway@1.0` format whose protocol is "HTTP POST to `<location>/<ref>` with the input as a JSON body and an optional bearer token."

---

## What you implement

Three interfaces, each independently optional:

| Interface | Purpose | When to implement |
|---|---|---|
| `BindingInvoker` | Run an operation against the binding format | Every format that supports invocation |
| `InterfaceCreator` | Synthesize an OBI from a format-native artifact (e.g., from an OpenAPI spec) | Format has a discoverable description document |
| `SourceInspector` | Enumerate bindable targets in a source before OBI authoring | Tooling-oriented; supports `ob create` interactive UX |

A single struct/class commonly implements all three.

```go
// Go SDK interfaces (openbindings-go/binding_invoker.go)
type BindingInvoker interface {
    Formats() []FormatInfo
    InvokeBinding(ctx context.Context, in *BindingInvocationInput) (<-chan InvocationOutput, error)
}

type InterfaceCreator interface {
    Formats() []FormatInfo
    CreateInterface(ctx context.Context, in *CreateInput) (*Interface, error)
}

type SourceInspector interface {
    Formats() []FormatInfo
    InspectSource(ctx context.Context, source *Source) (*SourceInspection, error)
}
```

```typescript
// TS SDK interfaces (@openbindings/sdk/invokers.ts)
interface BindingInvoker {
  formats(): FormatInfo[];
  invokeBinding(
    input: BindingInvocationInput,
    options?: { signal?: AbortSignal },
  ): AsyncIterable<InvocationOutput>;
}

interface InterfaceCreator {
  formats(): FormatInfo[];
  createInterface(input: CreateInput, options?: { signal?: AbortSignal }): Promise<OBInterface>;
}

interface SourceInspector {
  formats(): FormatInfo[];
  inspectSource(source: Source, options?: { signal?: AbortSignal }): Promise<SourceInspection>;
}
```

---

## Step 1: Choose a format token

The format token is the routing key — `OperationInvoker` matches OBI source format strings against the token your `Formats()` declares.

Conventions:
- Well-known formats use short names: `openapi`, `asyncapi`, `grpc`.
- Vendor- or project-specific formats use reverse-DNS: `com.acme.gateway`.
- Append `@<version>` when the format has its own version (`openapi@3.1`, `acme-gateway@1.0`).
- Consumers declare a semver range in their OBI's source (`acme-gateway@^1.0.0`); your `Formats()` returns the exact version your code targets. The SDK's format-token matcher handles the range vs exact resolution.

```go
const FormatToken = "acme-gateway@1.0"
```

```typescript
export const FORMAT_TOKEN = "acme-gateway@1.0";
```

---

## Step 2: Implement `BindingInvoker`

The invoker's job: given a source, a ref within that source, and operation input, make the protocol call and yield a stream of `InvocationOutput` events. Unary calls yield one event; streaming calls yield many.

### Skeleton

```go
package acmegateway

import (
    "context"
    "net/http"
    "time"

    openbindings "github.com/openbindings/openbindings-go"
)

type Invoker struct {
    client *http.Client
}

func NewInvoker() *Invoker {
    return &Invoker{client: http.DefaultClient}
}

func (e *Invoker) Formats() []openbindings.FormatInfo {
    return []openbindings.FormatInfo{
        {Token: FormatToken, Description: "Acme Gateway JSON-over-HTTP"},
    }
}

func (e *Invoker) InvokeBinding(
    ctx context.Context,
    in *openbindings.BindingInvocationInput,
) (<-chan openbindings.InvocationOutput, error) {
    // implementation in the next sections
}
```

```typescript
import type {
  BindingInvoker,
  BindingInvocationInput,
  InvocationOutput,
  FormatInfo,
} from "@openbindings/sdk";
import { FORMAT_TOKEN } from "./constants.js";

export class AcmeGatewayInvoker implements BindingInvoker {
  formats(): FormatInfo[] {
    return [{ token: FORMAT_TOKEN, description: "Acme Gateway JSON-over-HTTP" }];
  }

  async *invokeBinding(
    input: BindingInvocationInput,
    options?: { signal?: AbortSignal },
  ): AsyncIterable<InvocationOutput> {
    // implementation in the next sections
  }
}
```

### Enrich context from the store

If the caller configured a `ContextStore` on their `OperationInvoker`, the SDK passes it through in `input.store`. Merge stored context (per-host credentials, headers, etc.) with the per-call `input.context`. Per-call values win.

```go
func enrichContext(ctx context.Context, in *openbindings.BindingInvocationInput) *openbindings.BindingInvocationInput {
    if in.Store == nil {
        return in
    }
    key := normalizeEndpoint(in.Source.Location)
    if key == "" {
        return in
    }
    stored, err := in.Store.Get(ctx, key)
    if err != nil || len(stored) == 0 {
        return in
    }
    cp := *in
    if len(in.Context) == 0 {
        cp.Context = stored
    } else {
        merged := make(map[string]any, len(stored)+len(in.Context))
        for k, v := range stored {
            merged[k] = v
        }
        for k, v := range in.Context {
            merged[k] = v // per-call wins
        }
        cp.Context = merged
    }
    return &cp
}

func normalizeEndpoint(endpoint string) string {
    // openbindings.NormalizeContextKey strips scheme; for HTTP sources you
    // typically want a host[:port] key so http://, https://, ws:// share a
    // single entry per host.
    return openbindings.NormalizeContextKey(endpoint)
}
```

```typescript
import { normalizeContextKey, normalizeEndpoint } from "@openbindings/sdk";

async function enrichContext(
  input: BindingInvocationInput,
): Promise<BindingInvocationInput> {
  if (!input.store) return input;
  const key = normalizeEndpoint(input.source.location ?? "");
  if (!key) return input;
  const stored = await input.store.get(key);
  if (!stored) return input;
  return {
    ...input,
    context: { ...stored, ...(input.context ?? {}) }, // per-call wins
  };
}
```

### Apply credentials and make the call

Use the SDK's context accessors to pull credentials and transport headers out of the context map without re-implementing the field conventions:

| Field | Go accessor | TS accessor |
|---|---|---|
| `bearerToken` | `openbindings.ContextBearerToken(ctx)` | `contextBearerToken(ctx)` |
| `apiKey` | `openbindings.ContextAPIKey(ctx)` | `contextApiKey(ctx)` |
| `basic.username` / `password` | `openbindings.ContextBasicAuth(ctx)` | `contextBasicAuth(ctx)` |
| `headers` | `openbindings.ContextHeaders(ctx)` | `contextHeaders(ctx)` |
| `cookies` | `openbindings.ContextCookies(ctx)` | `contextCookies(ctx)` |
| `environment` | `openbindings.ContextEnvironment(ctx)` | `contextEnvironment(ctx)` |
| any string field | `openbindings.ContextString(ctx, key)` | `contextString(ctx, key)` |

For the common HTTP case, the TS SDK ships `buildAuthHeaders(ctx)` to turn `bearerToken` / `apiKey` / `basic` into the right `Authorization` header. The Go SDK leaves that to each format because the field-to-header mapping varies (some bindings use `Authorization: Bearer`, others use `X-API-Key`, etc.).

```go
func (e *Invoker) InvokeBinding(
    ctx context.Context,
    in *openbindings.BindingInvocationInput,
) (<-chan openbindings.InvocationOutput, error) {
    enriched := enrichContext(ctx, in)
    start := time.Now()

    url := strings.TrimRight(enriched.Source.Location, "/") + "/" + enriched.Ref
    body, err := openbindings.ContentToBytes(enriched.Input)
    if err != nil {
        return openbindings.SingleEventChannel(
            openbindings.FailedOutput(start, openbindings.ErrCodeInvalidInput, err.Error()),
        ), nil
    }

    req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
    if err != nil {
        return openbindings.SingleEventChannel(
            openbindings.FailedOutput(start, openbindings.ErrCodeInvalidInput, err.Error()),
        ), nil
    }
    req.Header.Set("Content-Type", "application/json")
    if token := openbindings.ContextBearerToken(enriched.Context); token != "" {
        req.Header.Set("Authorization", "Bearer "+token)
    }
    for k, v := range openbindings.ContextHeaders(enriched.Context) {
        req.Header.Set(k, v)
    }

    resp, err := e.client.Do(req)
    if err != nil {
        return openbindings.SingleEventChannel(
            openbindings.FailedOutput(start, openbindings.ErrCodeConnectFailed, err.Error()),
        ), nil
    }
    defer resp.Body.Close()

    raw, _ := io.ReadAll(resp.Body)
    if resp.StatusCode >= 400 {
        // HTTPErrorOutput maps the status code to the right ErrCode_*
        // automatically (401 -> auth_required, 403 -> permission_denied,
        // 5xx -> invocation_failed, etc.).
        return openbindings.SingleEventChannel(
            openbindings.HTTPErrorOutput(start, resp.StatusCode, resp.Status),
        ), nil
    }

    var output any
    if len(raw) > 0 && openbindings.MaybeJSON(string(raw)) {
        _ = json.Unmarshal(raw, &output)
    } else {
        output = string(raw)
    }

    return openbindings.SingleEventChannel(openbindings.InvocationOutput{
        Output:     output,
        Status:     resp.StatusCode,
        DurationMs: time.Since(start).Milliseconds(),
    }), nil
}
```

```typescript
import {
  ERR_INVALID_INPUT,
  ERR_CONNECT_FAILED,
  ERR_AUTH_REQUIRED,
  ERR_INVOCATION_FAILED,
  buildAuthHeaders,
  contextHeaders,
  maybeJSON,
} from "@openbindings/sdk";

async *invokeBinding(
  input: BindingInvocationInput,
  options?: { signal?: AbortSignal },
): AsyncIterable<InvocationOutput> {
  const start = Date.now();
  const enriched = await enrichContext(input);
  const url = `${(enriched.source.location ?? "").replace(/\/+$/, "")}/${enriched.ref}`;

  let body: string;
  try {
    body = JSON.stringify(enriched.input ?? null);
  } catch (e) {
    yield { error: { code: ERR_INVALID_INPUT, message: (e as Error).message }, durationMs: Date.now() - start };
    return;
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...buildAuthHeaders(enriched.context ?? {}),
    ...contextHeaders(enriched.context ?? {}),
  };

  let resp: Response;
  try {
    resp = await (enriched.fetch ?? fetch)(url, {
      method: "POST",
      body,
      headers,
      signal: options?.signal,
    });
  } catch (e) {
    yield { error: { code: ERR_CONNECT_FAILED, message: (e as Error).message }, durationMs: Date.now() - start };
    return;
  }

  const raw = await resp.text();
  if (resp.status === 401) {
    yield { error: { code: ERR_AUTH_REQUIRED, message: raw }, status: 401, durationMs: Date.now() - start };
    return;
  }
  if (resp.status >= 400) {
    yield { error: { code: ERR_INVOCATION_FAILED, message: raw }, status: resp.status, durationMs: Date.now() - start };
    return;
  }

  const output = maybeJSON(raw) ? JSON.parse(raw) : raw;
  yield { output, status: resp.status, durationMs: Date.now() - start };
}
```

### Auth retry (optional but recommended)

When the call returns `auth_required` and the OBI declares `security` methods for this binding, you can ask the SDK to interactively resolve credentials and retry once. The SDK ships `ResolveSecurity` (Go) / `resolveSecurity` (TS) implementing the standard walk-and-resolve algorithm.

```go
result := <-ch
if result.Error != nil && result.Error.Code == openbindings.ErrCodeAuthRequired &&
    len(enriched.Security) > 0 && enriched.Callbacks != nil {
    creds, err := openbindings.ResolveSecurity(ctx, enriched.Security, enriched.Callbacks, e.client)
    if err == nil && len(creds) > 0 {
        if enriched.Store != nil {
            _ = enriched.Store.Set(ctx, normalizeEndpoint(enriched.Source.Location), creds)
        }
        // re-issue request with merged context
        result = <-runRequest(ctx, e.client, enriched, mergeMap(enriched.Context, creds), start)
    }
}
```

```typescript
import { resolveSecurity, AuthCancelledError } from "@openbindings/sdk";

if (event.error?.code === ERR_AUTH_REQUIRED &&
    enriched.security?.length && enriched.callbacks) {
  try {
    const creds = await resolveSecurity(enriched.security, enriched.callbacks, enriched.fetch);
    if (creds && enriched.store) {
      await enriched.store.set(normalizeEndpoint(enriched.source.location ?? ""), creds);
    }
    // re-issue with merged context
    yield* this.invokeBinding({ ...enriched, context: { ...enriched.context, ...creds } }, options);
    return;
  } catch (e) {
    if (e instanceof AuthCancelledError) {
      yield event; // surface the original auth error
      return;
    }
    throw e;
  }
}
```

See [Creators and Invokers § Security resolution](./creators-and-invokers.md#security-resolution) for the resolution algorithm.

---

## Step 3: Implement `InterfaceCreator`

The creator turns a format-native artifact (e.g., a YAML config file describing the gateway's operations) into an OBI. It populates operations, schemas, bindings, sources, and security.

```go
type Creator struct{}

func NewCreator() *Creator { return &Creator{} }

func (c *Creator) Formats() []openbindings.FormatInfo {
    return []openbindings.FormatInfo{{Token: FormatToken, Description: "Acme Gateway JSON-over-HTTP"}}
}

func (c *Creator) CreateInterface(
    ctx context.Context,
    in *openbindings.CreateInput,
) (*openbindings.Interface, error) {
    if len(in.Sources) == 0 {
        return nil, openbindings.ErrNoSources
    }
    src := in.Sources[0]

    // 1. Load and parse the source artifact
    raw, err := loadSource(ctx, src.Location, src.Content)
    if err != nil {
        return nil, fmt.Errorf("acme-gateway source load: %w", err)
    }
    spec, err := parseGatewaySpec(raw)
    if err != nil {
        return nil, fmt.Errorf("acme-gateway parse: %w", err)
    }

    // 2. Build operations, bindings, sources from the parsed spec
    ops := map[string]openbindings.Operation{}
    bindings := map[string]openbindings.BindingEntry{}
    sourceName := src.Name
    if sourceName == "" {
        sourceName = "gateway"
    }

    for _, op := range spec.Operations {
        ops[op.Name] = openbindings.Operation{
            Description: op.Description,
            Input:       op.InputSchema,
            Output:      op.OutputSchema,
        }
        bindings[op.Name+"."+sourceName] = openbindings.BindingEntry{
            Operation: op.Name,
            Source:    sourceName,
            Ref:       op.Name,
        }
    }

    return &openbindings.Interface{
        OpenBindings: "0.2.0",
        Name:         in.Name,
        Version:      in.Version,
        Description:  in.Description,
        Operations:   ops,
        Bindings:     bindings,
        Sources: map[string]openbindings.Source{
            sourceName: {
                Format:   FormatToken,
                Location: src.Location,
            },
        },
        // Populate Security here if your format declares per-operation auth.
    }, nil
}
```

```typescript
export class AcmeGatewayCreator implements InterfaceCreator {
  formats(): FormatInfo[] {
    return [{ token: FORMAT_TOKEN, description: "Acme Gateway JSON-over-HTTP" }];
  }

  async createInterface(input: CreateInput): Promise<OBInterface> {
    if (!input.sources?.length) {
      throw new Error("acme-gateway: no sources provided");
    }
    const src = input.sources[0];
    const raw = await loadSource(src.location, src.content);
    const spec = parseGatewaySpec(raw);

    const sourceName = src.name ?? "gateway";
    const operations: Record<string, Operation> = {};
    const bindings: Record<string, BindingEntry> = {};

    for (const op of spec.operations) {
      operations[op.name] = {
        description: op.description,
        input: op.inputSchema,
        output: op.outputSchema,
      };
      bindings[`${op.name}.${sourceName}`] = {
        operation: op.name,
        source: sourceName,
        ref: op.name,
      };
    }

    return {
      openbindings: "0.2.0",
      name: input.name,
      version: input.version,
      description: input.description,
      operations,
      bindings,
      sources: {
        [sourceName]: { format: FORMAT_TOKEN, location: src.location },
      },
    };
  }
}
```

### Populating `security`

If your format has security metadata (OpenAPI's `securitySchemes`, GraphQL directives, etc.), interface creators SHOULD extract it and populate the OBI's `security` section. Bindings that require auth reference the security entry by name; bindings for public endpoints SHOULD NOT have a `security` reference. See [Creators and Invokers § Security population](./creators-and-invokers.md#security-population) for the format-to-method mapping table.

---

## Step 4: Implement `SourceInspector` (optional)

The inspector enumerates bindable targets in a source so authoring tools can show "here are the refs available in this artifact." Useful for `ob create` interactive flows.

```go
type Inspector struct{}

func (i *Inspector) Formats() []openbindings.FormatInfo {
    return []openbindings.FormatInfo{{Token: FormatToken, Description: "Acme Gateway JSON-over-HTTP"}}
}

func (i *Inspector) InspectSource(
    ctx context.Context,
    source *openbindings.Source,
) (*openbindings.SourceInspection, error) {
    raw, err := loadSource(ctx, source.Location, source.Content)
    if err != nil {
        return nil, err
    }
    spec, err := parseGatewaySpec(raw)
    if err != nil {
        return nil, err
    }

    targets := make([]openbindings.BindableTarget, 0, len(spec.Operations))
    for _, op := range spec.Operations {
        targets = append(targets, openbindings.BindableTarget{
            Ref:          op.Name,
            OperationKey: op.Name,
            Operation: &openbindings.Operation{
                Description: op.Description,
                Input:       op.InputSchema,
                Output:      op.OutputSchema,
            },
        })
    }
    return &openbindings.SourceInspection{
        Targets:    targets,
        Exhaustive: true,
    }, nil
}
```

```typescript
export class AcmeGatewayInspector implements SourceInspector {
  formats(): FormatInfo[] {
    return [{ token: FORMAT_TOKEN, description: "Acme Gateway JSON-over-HTTP" }];
  }

  async inspectSource(source: Source): Promise<SourceInspection> {
    const raw = await loadSource(source.location, source.content);
    const spec = parseGatewaySpec(raw);
    return {
      targets: spec.operations.map(op => ({
        ref: op.name,
        operationKey: op.name,
        operation: {
          description: op.description,
          input: op.inputSchema,
          output: op.outputSchema,
        },
      })),
      exhaustive: true,
    };
  }
}
```

---

## SDK helper inventory

The helpers below ship with `openbindings-go` and `@openbindings/sdk`. Reach for them rather than reimplementing — they encode the field conventions the rest of the ecosystem expects.

### Context accessors (read credentials/headers from `BindingContext`)

| What you need | Go | TS |
|---|---|---|
| Bearer token string | `ContextBearerToken(ctx)` | `contextBearerToken(ctx)` |
| API key string | `ContextAPIKey(ctx)` | `contextApiKey(ctx)` |
| Basic auth `(user, pass, ok)` | `ContextBasicAuth(ctx)` | `contextBasicAuth(ctx)` |
| Headers map | `ContextHeaders(ctx)` | `contextHeaders(ctx)` |
| Cookies map | `ContextCookies(ctx)` | `contextCookies(ctx)` |
| Environment map | `ContextEnvironment(ctx)` | `contextEnvironment(ctx)` |
| Metadata map | `ContextMetadata(ctx)` | `contextMetadata(ctx)` |
| Arbitrary string field | `ContextString(ctx, key)` | `contextString(ctx, key)` |
| Redact a context for logging | `RedactContext(ctx)` | `redactContext(ctx)` |
| Build `Authorization` header | (per-format) | `buildAuthHeaders(ctx)` |

### Context store keys

| What | Go | TS |
|---|---|---|
| Normalize a URL to a store key | `NormalizeContextKey(url)` | `normalizeContextKey(url)` |
| Normalize HTTP endpoint URLs to a host[:port] key | (per-format) | `normalizeEndpoint(url)` |
| In-memory `ContextStore` | `NewMemoryStore()` | `new MemoryStore()` |

### Output builders

| What | Go | TS |
|---|---|---|
| Wrap one event as a closed channel/iterable | `SingleEventChannel(out)` | (just `yield` once) |
| Build a pre-request failure event | `FailedOutput(start, code, msg)` | (literal `{ error: { code, message }, durationMs }`) |
| Build an HTTP-error event (status code → standard ErrCode mapping) | `HTTPErrorOutput(start, statusCode, statusText)` | (literal `{ error, status, durationMs }`) |

The TS side relies on plain object literals because async generators make ad-hoc shapes cheap; the Go side ships builders because returning a closed channel from one line is otherwise verbose.

### Security resolution

| What | Go | TS |
|---|---|---|
| Walk security methods + resolve via callbacks | `ResolveSecurity(ctx, methods, cb, httpClient)` | `resolveSecurity(methods, cb, fetchFn?)` |
| Detect user-cancelled auth | `IsAuthCancelled(err)` | `e instanceof AuthCancelledError` |

### URI / ref / source handling

| What | Go | TS |
|---|---|---|
| Canonicalize a source location | `CanonicalizeLocation(loc)` | `canonicalizeLocation(loc)` |
| Resolve a `$ref` within a doc | `ResolveRef(doc, ref)` | `resolveRef(doc, ref)` |
| Detect well-known unknown fields | (per-validator) | `unknownFields(doc, schema)` |
| Detect a likely-JSON string | `MaybeJSON(s)` | `maybeJSON(s)` |
| Sniff format version (e.g. `openapi@3.1` → `3.1`) | `DetectFormatVersion(s)` | `detectFormatVersion(s)` |

### Standard error codes

The SDKs export string constants for the canonical error codes. Using them lets consumers handle errors uniformly across formats.

| Code constant | When to use |
|---|---|
| `ErrCodeAuthRequired` / `ERR_AUTH_REQUIRED` | 401, JWT expired, etc. — eligible for security retry |
| `ErrCodePermissionDenied` / `ERR_PERMISSION_DENIED` | 403, scope insufficient — not retryable |
| `ErrCodeInvalidRef` / `ERR_INVALID_REF` | Ref is malformed |
| `ErrCodeRefNotFound` / `ERR_REF_NOT_FOUND` | Ref is valid but not present in the source |
| `ErrCodeInvalidInput` / `ERR_INVALID_INPUT` | Input doesn't match expected shape |
| `ErrCodeSourceLoadFailed` / `ERR_SOURCE_LOAD_FAILED` | Couldn't fetch or parse the source artifact |
| `ErrCodeSourceConfigError` / `ERR_SOURCE_CONFIG_ERROR` | Source loaded but missing required config |
| `ErrCodeConnectFailed` / `ERR_CONNECT_FAILED` | Couldn't reach the target |
| `ErrCodeInvocationFailed` / `ERR_INVOCATION_FAILED` | Target returned an error |
| `ErrCodeResponseError` / `ERR_RESPONSE_ERROR` | Got a response but couldn't process it |
| `ErrCodeStreamError` / `ERR_STREAM_ERROR` | Error mid-stream |
| `ErrCodeTimeout` / `ERR_TIMEOUT` | Call timed out |
| `ErrCodeCancelled` / `ERR_CANCELLED` | Caller cancelled |

See the full set in [`openbindings-go/errcodes.go`](https://github.com/openbindings/openbindings-go/blob/main/errcodes.go) and [`@openbindings/sdk/errcodes.ts`](https://github.com/openbindings/openbindings-ts/blob/main/packages/sdk/src/errcodes.ts).

---

## Step 5: Register with `OperationInvoker`

Consumers wire your invoker into their `OperationInvoker` at construction. There's nothing special on your side — you just need to be a `BindingInvoker`.

```go
import (
    openbindings "github.com/openbindings/openbindings-go"
    acmegateway "github.com/my-org/acmegateway-go"
)

op := openbindings.NewOperationInvoker(acmegateway.NewInvoker())
```

```typescript
import { OperationInvoker } from "@openbindings/sdk";
import { AcmeGatewayInvoker } from "@my-org/openbindings-acme";

const op = new OperationInvoker([new AcmeGatewayInvoker()]);
```

If your invoker recurses into other operations (like `operation-graph` does), accept the `OperationInvoker` in your constructor and register yourself via `addBindingInvoker` after construction to resolve the circular dependency.

---

## Step 6: Test against the conformance corpus

The spec repo's `conformance/` directory holds a corpus of OBI documents and expected behaviors. If your format is well-known enough to be in the corpus, your tests can assert against it directly. For private formats, mirror the test patterns:

- **Unary call** — yields one event with the expected output.
- **Error mapping** — protocol errors map to the right standard error codes.
- **Streaming** (if applicable) — yields multiple events, terminates cleanly on cancel.
- **Context enrichment** — stored credentials are applied automatically.
- **Auth retry** — auth_required event triggers `ResolveSecurity` and retries once.

The Go SDK ships an integration test scaffold in `openbindings-go/formats/openapi/integration_test.go` that's a useful template. The TS SDK uses Vitest with similar patterns in `@openbindings/openapi`'s `bec-integration.test.ts`.

---

## Step 7 (optional): Publish a service

The same contract works as a service. You can wrap your library implementation in an `ob serve` instance to expose `binding-invoker`, `interface-creator`, and `source-inspector` operations over HTTP and MCP. Consumers then talk to your service instead of importing the library — useful when the format requires heavyweight dependencies you don't want to bundle into every consumer. See [Creators and Invokers § Two deployment models](./creators-and-invokers.md#two-deployment-models) for the trade-off.

---

## Pre-1.0 surface notes

OpenBindings is pre-1.0. The interfaces above are stable in shape but may receive additive changes per minor version. The [STABILITY.md](https://github.com/openbindings/spec/blob/main/STABILITY.md) policy applies:

- Minor versions MAY add fields to `BindingInvocationInput`, `CreateInput`, `InvocationOutput`, etc. Your implementation must tolerate unknown fields it doesn't recognize.
- Minor versions MAY change error-code conventions; treat unknown codes as opaque strings.
- Patch versions are non-breaking.

When the spec hits 1.0, the role interfaces (`openbindings.binding-invoker`, etc.) become the stable contract; SDK-level helpers may continue to evolve.

---

## Reference implementations

The cleanest starting point is to read an existing format invoker that's close to what you're building:

| Pattern | Go reference | TS reference |
|---|---|---|
| HTTP request/response with security retry | [`formats/openapi`](https://github.com/openbindings/openbindings-go/tree/main/formats/openapi) | [`@openbindings/openapi`](https://github.com/openbindings/openbindings-ts/tree/main/packages/openapi) |
| Long-lived session pool over HTTP | [`formats/mcp`](https://github.com/openbindings/openbindings-go/tree/main/formats/mcp) | [`@openbindings/mcp`](https://github.com/openbindings/openbindings-ts/tree/main/packages/mcp) |
| RPC over JSON envelope | [`formats/connect`](https://github.com/openbindings/openbindings-go/tree/main/formats/connect) | (forthcoming) |
| WebSocket/SSE streaming | [`formats/asyncapi`](https://github.com/openbindings/openbindings-go/tree/main/formats/asyncapi) | [`@openbindings/asyncapi`](https://github.com/openbindings/openbindings-ts/tree/main/packages/asyncapi) |
| Composing other operations | [`formats/operationgraph`](https://github.com/openbindings/openbindings-go/tree/main/formats/operationgraph) | [`@openbindings/operationgraph`](https://github.com/openbindings/openbindings-ts/tree/main/packages/operationgraph) |
| Non-network local invocation | [`formats/usage`](https://github.com/openbindings/openbindings-go/tree/main/formats/usage) | — |
| Non-network in-process invocation | — | [`@openbindings/workers-rpc`](https://github.com/openbindings/openbindings-ts/tree/main/packages/workers-rpc) |
