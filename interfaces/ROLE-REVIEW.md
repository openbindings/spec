# Role interface review

**Date:** 2026-05-12
**Scope:** All `openbindings.*` role interfaces under this directory.
**Status:** Findings document, not a normative spec change.

This review walks through every role contract individually, then surfaces cross-cutting issues and a priority ranking. The goal is to identify which roles are well-designed today, which need targeted cleanup, and which require a greenfield redesign.

## 1. `openbindings.software-descriptor` — mostly clean

**Purpose:** Identify yourself. Generic identity contract any software can implement.

**Strengths**

- Single coherent capability
- Schema fields are universally meaningful (`name`, `version`, `description`, `homepage`, `repository`, `maintainer`)
- Permissive `additionalProperties` (no `: false`) explicitly invites extensions per the role description
- Minimal required field set (just `name`)

**Weaknesses**

- Description text leaks "participating in the OpenBindings ecosystem". Cosmetic. The contract itself is generic.

**Verdict:** No rethink. One-line description polish is the most we'd touch.

## 2. `openbindings.binding-invoker` — one real schema problem

**Purpose:** Invoke bindings in a specific format. The workhorse role behind `invokeBinding`.

**Strengths**

- Clear single capability with the streaming-as-default model (unary calls produce one event, streaming calls produce many)
- `oneOf` on `location` / `content` for `InvokeSource` is elegant
- `BindingContext` is opaque (`additionalProperties: true`) so any credential shape passes through
- `InvocationOptions` has the right knobs (`headers`, `cookies`, `environment`, `metadata`)

**Weaknesses**

- **`InvokeBindingOutput` duplicates the StreamEvent envelope.** The role declares output as `{ output, status, durationMs, error }`. The actual runtime yields a StreamEvent envelope shaped `{ data, error, status, durationMs }`, where `data` IS the operation's actual output rather than a wrapper containing it. The role spec and the wire are out of sync.
- The `error` field appears both on the envelope and on the payload, which is confusing for any conforming implementation.

**Verdict:** Modest rethink. Drop `InvokeBindingOutput` as a wrapper and declare `invokeBinding`'s output as `unknown` (or whatever the bound operation actually returns). The envelope is the SDK's concern, not the role's.

## 3. `openbindings.interface-creator` — mostly clean

**Purpose:** Synthesize OBI documents from binding source artifacts.

**Strengths**

- Clean single capability (`listFormats` + `createInterface`)
- `oneOf` `location`/`content` pattern again
- Sources array carries `format`, `name`, `outputLocation`, `embed`, `description` — appropriately rich for the synthesis case
- `OpenBindingsInterface` output is open (`additionalProperties: true`)

**Weaknesses**

- The role-level `OpenBindingsInterface` schema is `{type: object, additionalProperties: true}`. It does not constrain to a valid OBI. Consumers cannot validate creator output against the role alone; they need the spec-level meta-schema separately. This is defensible (role / spec version decoupling) but worth noting.
- `createInterface` is idempotent for the same input but is not flagged `idempotent: true`.

**Verdict:** No rethink. The opaque-OBI tradeoff is reasonable. Optionally flag idempotence.

## 4. `openbindings.source-inspector` — clean, rightly OB-specific

**Purpose:** Discover bindable targets in a source artifact.

**Strengths**

- Symmetric with binding-invoker (`listFormats` + `inspectSource`)
- `BindableTarget.operation` is a subset of OBI Operation, not the full thing. Appropriate, because an inspector cannot know `satisfies` relationships from a source artifact alone.
- `exhaustive: false` flag is honest about truncation/pagination
- Permissive `additionalProperties: true` on returned shapes

**Weaknesses**

- Description hints at "generic source inspection" but the role is genuinely OB-specific because it returns OBI Operation framings. Worth a description tweak to remove the ambiguity.
- `inspectSource` is idempotent but not flagged `idempotent: true`.

**Verdict:** No rethink. Minor description tweak. Flag idempotence.

## 5. `openbindings.context-store` — needs greenfield redesign

**Purpose:** Store and retrieve credentials by a key.

**Strengths**

- `ContextEntry.context` is opaque (`additionalProperties: true`)
- Standard 4-op CRUD shape feels familiar

**Weaknesses** (compounding)

| # | Issue | Why it matters |
|---|---|---|
| 1 | `listContexts` returns raw `ContextEntry[]` | Any production-grade implementation refuses, as `ob serve` does. The contract is unsafe-by-default. |
| 2 | `getContext` returns raw `ContextEntry` | "Show me the secret" should be an explicit operation, not the default for a get-by-key. |
| 3 | Term "context" is SDK-internal jargon | A credential store role shouldn't borrow per-invocation-data terminology. The role is named for an SDK implementation detail rather than the underlying capability. |
| 4 | "Keys are normalized API origins" baked into description | Implementation convention bled into role contract. Other implementations may key differently. |
| 5 | No auth / scoping model | One bag of credentials, anyone-can-list. Fine for a single-user CLI, broken for any multi-tenant case. |
| 6 | No TTL / refresh / expiration support | OAuth tokens and expiring API keys have no representation. Implementations have to extend the contract ad hoc. |
| 7 | No credential-type discriminator | Caller cannot tell whether an entry is bearer / basic / oauth2 without inspecting the opaque blob. |

**Verdict:** Full greenfield redesign. Suggested shape:

```
openbindings.credential-store/0.2.json   (new role, new name)

Operations:
  listEntries()
    → CredentialMetadata[]
       (per entry: { key, kind, hasValue, createdAt?, expiresAt?, lastUsedAt? })

  getEntry(key)
    → CredentialMetadata | null
       (metadata only, no secret values)

  revealEntry(key)
    → { metadata: CredentialMetadata, value: CredentialValue } | null
       (explicit "show me the secret" operation; implementations may
        require re-auth, audit-log, or refuse outright)

  setEntry(key, kind, value)
    → CredentialMetadata

  deleteEntry(key)
    → void  (idempotent)
```

The core change is splitting metadata listing from secret revelation. Everything else (TTL, type discriminator, multi-tenant scoping) flows from that split. This is a new major version under a new name; the existing `openbindings.context-store/0.1` is superseded rather than patched.

## 6. `openbindings.http-client` — clean enough

**Purpose:** Make HTTP requests on behalf of callers (browser CSP bypass, firewall traversal, etc).

**Strengths**

- Genuinely generic. Any HTTP-capable service can implement.
- Sensible knobs (`timeoutMs`, `maxResponseBytes`, `followRedirects`)
- Description acknowledges SSRF risk and guides implementers ("SHOULD validate URLs and MAY restrict access to private networks")

**Weaknesses**

- **Body as string only.** No native binary support. Implementations and callers have to negotiate base64 informally. Real concern for fetching PDFs, images, binary protocols.
- Response body also string-only. Same issue.
- `followRedirects` is a binary boolean. Real HTTP libraries have max-redirect counts.

**Verdict:** Mild rethink. Add a `bodyEncoding: "text" | "base64"` discriminator (or similar) for both request and response. Other limitations are reasonable simplifications.

## Cross-cutting observations

1. **`FormatInfo` is duplicated** across binding-invoker, interface-creator, source-inspector. Could be factored into a shared types file but only worth doing during another spec revision.

2. **`Source`-shaped types are duplicated** with subtle differences. binding-invoker's `InvokeSource`, source-inspector's `Source`, and interface-creator's `CreateInterfaceSource` all carry `format` + `location` + `content` plus role-specific extras. Each shape is appropriate for its purpose; unification would lose clarity.

3. **Missing `idempotent` flags** on operations that are idempotent: `inspectSource`, `createInterface`, `deleteContext`. Trivial fix.

4. **`InvokeBindingOutput`** (binding-invoker) is the only legacy wrapper that does not match the runtime. Fix it when binding-invoker is touched for any reason.

## Priority ranking

| # | Role | Action | Effort |
|---|---|---|---|
| 1 | `context-store` | Full redesign as `credential-store`. Split list/get (metadata) from reveal (secrets). | High value, medium effort |
| 2 | `binding-invoker` | Drop `InvokeBindingOutput` wrapper, declare output as `unknown`. | Low effort |
| 3 | `http-client` | Add `bodyEncoding` (or similar) for binary support. | Low effort, low urgency |
| 4 | All roles | Add missing `idempotent` flags on inspectSource / createInterface / deleteContext. | Trivial |
| 5 | `software-descriptor`, `source-inspector` | Description text polish. | Trivial |

Item 1 is the load-bearing one. Item 2 is a quiet cleanup that also clarifies the SDK's own architecture. Item 3 may never matter depending on which downstream tools materialize. Items 4 and 5 are decoration.
