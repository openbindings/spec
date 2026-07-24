# Cloudflare Workers RPC binding specification promotion candidate

## 1. Status and proposed identifier

**Status: design-review candidate — no identifier is minted by this document.** This is the complete proposed contract for a future **`openbindings.workers-rpc@1`** binding specification, arranged under the project's [authoring template](../README.md#authoring-a-new-binding-specification). Publication still requires design approval, conformance fixtures, and coordinated TypeScript runtime adoption. Until then an OBI MUST NOT claim `openbindings.workers-rpc@1` on the authority of this page.

If promoted, `openbindings.workers-rpc@1` is exact and opaque under core [OBI-B-01](../../openbindings.md#104-binding-specification-rules), and an incompatible change publishes `openbindings.workers-rpc@2` under [OBI-B-03](../../openbindings.md#104-binding-specification-rules). The proposed rule identifiers below organize review and may change before publication.

The key words "MUST", "MUST NOT", "REQUIRED", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" describe the contract proposed for promotion and are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in all capitals. They carry no present conformance claim while this page remains a candidate.

## 2. Scope and incorporated authorities

This is the OpenBindings project's proposed binding specification for calls from a Cloudflare Worker to a `WorkerEntrypoint` exposed through a service binding using RPC. Cloudflare's Workers RPC model, service-binding contract, compatibility behavior, and Wrangler service-binding configuration are incorporated from the official `cloudflare/cloudflare-docs` repository at immutable commit [`65d8126a201af30378db7010e76da46c5fe8e193`](https://github.com/cloudflare/cloudflare-docs/tree/65d8126a201af30378db7010e76da46c5fe8e193). The exact source files are linked in [§11](#11-references); rendered documentation and later revisions are informative. This pin may still change while the document remains an unminted candidate; promotion freezes it for the identifier. This candidate defines only the narrower OpenBindings overlay.

Cloudflare RPC can carry values and capabilities outside OpenBindings' JSON value domain. Revision 1 intentionally binds only zero- or one-argument entrypoint methods whose result is absent (`undefined`) or one finite JSON-compatible value. It excludes multiple positional arguments, streams, async iterables, functions, `RpcTarget`/RPC stubs, and every other capability-bearing or non-JSON structured-clone value. Unsupported values are refused at the OpenBindings boundary rather than assigned a project-specific encoding.

Workers RPC must be enabled by the caller's Cloudflare compatibility date or flag under the incorporated platform rules. That deployment prerequisite is runtime state, not OBI content; an environment where the resolved binding does not support RPC cannot dispatch this family.

The candidate defines portable binding meaning, not a Workers client API. Registry resolution, property access, the zero-or-one-value boundary, result correspondence, and cancellation effects below describe the interaction the binding denotes. Request wrappers, environment injection APIs, promise orchestration, and local cancellation plumbing remain runtime and SDK surface.

## 3. Accepted source representations

This family accepts one representation: a **symbolic service-binding address** in `location`. It has no carried interface artifact. `content` is therefore forbidden rather than ignored (**proposed WRPC-D-01**). TypeScript declarations, deployed class source, Wrangler configuration objects, and runtime stubs are not alternate `content` representations in revision 1.

The absence of an interface artifact means this binding cannot synthesize or validate a method schema. An OBI is authored from an independently known service contract; only resolution against a live registry and action against the remote service can establish the target slot's availability and the method's existence.

## 4. `location`

`location` is REQUIRED and has exactly this binding-specification-defined absolute-address form (**proposed WRPC-D-02**):

```text
workers-rpc:///<encoded-service-binding-name>
```

The URI has an empty authority and exactly one non-empty path segment. The segment is the service-binding name encoded as UTF-8 under this OpenBindings address convention: URI-unreserved bytes appear literally; every other byte is percent-encoded with uppercase hexadecimal; an unreserved byte MUST NOT be percent-encoded. Decoding therefore yields exactly one Unicode string with one canonical URI spelling, preserving case and admitting binding names that are not JavaScript identifier spellings. `workers-rpc:///WORKER_B` names `WORKER_B`; a binding key containing `/` carries `%2F`. The form has no query, fragment, user information, host, or port. It is not dereferenced as an HTTP URL.

This custom encoding is a last-resort OpenBindings convention because Cloudflare supplies a registry key but no portable URI for that key. It preserves every string key instead of narrowing the platform to dot-accessible JavaScript identifiers or treating the apparent authority as a DNS host. The decoded name addresses the exact request-scoped environment binding (`env[name]`) or the same key in an explicitly supplied equivalent registry.

Resolving the binding against a runtime registry requires that exact key to exist; an absent key or a registry that supplies only an unrelated singleton is a pre-dispatch refusal. Runtime state supplies the handle, but `location` supplies its identity; the address is never decorative. Cloudflare RPC stubs deliberately appear to implement every possible method, so a processor does not claim to prove locally that the value is RPC-capable. RPC capability and remote method existence are established only by attempting the addressed call; the platform's rejection is a dispatch failure.

Under this candidate, the named service-binding slot itself — not an out-of-band globally stable Cloudflare service identifier — is the semantic target. Supplying a live handle for that exact slot is symbolic-name resolution under core [OBI-D-13](../../openbindings.md#102-document-rules); consulting configuration to discover a different target name or reinterpret the carried key is not. Authors who require identity stable independently of deployment configuration cannot express that stronger identity in revision 1 and MUST NOT treat this address as if it did.

## 5. `content`

`content` MUST be absent. A source with `content` present — including `null` — is not conformant to this candidate (**proposed WRPC-D-01**).

## 6. Composition

There is no composition case because `location` is required and `content` is forbidden. Runtime registry state resolves the symbolic address but is not source content, a reference base, or a competing target identity.

## 7. `ref`

`ref` is REQUIRED and is the non-empty, exact property key of the public `WorkerEntrypoint` method to call (**proposed WRPC-D-03**). It is matched byte-for-byte with no case folding, path segmentation, or percent-decoding. A slash or percent sign is literal rather than syntax. Revision 1 refuses the pinned platform's non-RPC or disallowed `WorkerEntrypoint` names — `fetch`, `connect`, `dup`, `constructor`, `alarm`, `webSocketMessage`, `webSocketClose`, and `webSocketError` — at binding resolution. `fetch` has Fetch semantics rather than RPC semantics, `connect` is reserved, and the remaining names are disallowed for this target class; silently invoking any of them would violate this family's declared RPC boundary.

For any other `ref`, the processor performs ordinary property access on the resolved service binding and invokes the resulting Cloudflare RPC method proxy. Because an RPC-capable stub appears to define every possible method name, an unknown or non-callable remote property is not preflighted or reclassified as resolution failure: the call is attempted and Cloudflare's remote rejection is a dispatch failure. There is no whole-entrypoint invocation.

## 8. Target and interaction

The target is the pair of the service-binding name from `location` and method key from `ref`. The binding denotes one Cloudflare RPC method call. The caller supplies zero or one input value:

- no input value calls the method with **zero arguments**;
- one input value calls the method with **exactly one argument**, the value wholesale.

An array input remains one array argument; it is never spread into multiple arguments. This preserves the OpenBindings value boundary and avoids guessing a JavaScript signature that no accepted artifact declares.

The call completes with zero outputs when the resolved method result is JavaScript `undefined`, or one output when it is a JSON-compatible value. It terminates with an error when dispatch, serialization, the remote method, promise resolution, or output-boundary validation fails. Streaming and capability-returning methods are excluded in revision 1.

## 9. Operation-boundary correspondence

### 9.1. JSON subset

The one input and any emitted output MUST be finite, acyclic values recursively composed only of JSON null, booleans, finite numbers, strings, arrays, and string-keyed objects (**proposed WRPC-P-01**). No `undefined` occurs inside a carried value. BigInt, Date, Map, Set, ArrayBuffer or typed arrays, streams, functions, errors-as-values, symbols, class instances, RPC stubs, and `RpcTarget` values are outside the revision-1 boundary even when Cloudflare RPC itself can serialize them.

Input is validated before dispatch. A non-JSON input refuses without calling the service. After Cloudflare resolves the method's return (including a returned promise/thenable), `undefined` produces clean completion with no output; a JSON-compatible result emits verbatim; every other result is a terminal boundary-decode failure. The candidate does not stringify, clone down, or Base64-encode unsupported values.

### 9.2. Dispatch and classification

The binding denotes exact local-registry-key resolution, ordinary property access for the exact method name, and a call with zero or one argument as defined in [§8](#8-target-and-interaction) (**proposed WRPC-P-02**). An absent local registry key is a pre-dispatch refusal. A synchronous local throw, Cloudflare dispatch rejection (including a non-RPC binding or unknown remote method), rejected remote promise, serialization failure, or output-subset violation is a terminal interaction error carrying the information Cloudflare RPC makes available. Only a clean `undefined` or JSON-compatible return is successful.

No decode, classification, routing, or target fallback is configurable: the platform and the explicit revision-1 subset answer those questions. In particular, consumer configuration cannot reinterpret a thrown error as an output or spread an input array into arguments.

### 9.3. Cancellation

Cancellation before dispatch means no call occurs. After dispatch, the caller observes local termination and no later result, but when the Cloudflare runtime exposes no abort mechanism the remote method MAY continue. An implementation MUST NOT represent that outcome as confirmed remote cancellation (**proposed WRPC-P-03**). The cancellation API and local task mechanics are implementation surface.

### 9.4. Authentication and transform positions

This layer defines no credentials. Reachability is established by Cloudflare service-binding configuration; the candidate neither derives nor maps application credentials. It also defines no context bindings at the core's binding-level transform positions, which evaluate in the core's closed environment.

### 9.5. Implementation note (informative)

The reference TypeScript implementation should dispatch through the service stub's ordinary method property (`binding[method](...)`). It should not detach the method or force a receiver with `Function.prototype.call`; Cloudflare service stubs are runtime proxies and their method wrappers own the required dispatch context. This is implementation guidance, not a new wire rule and not part of target identity.

## 10. Proposed conformance rules

These identifiers organize review and future fixtures; they are not published rules until promotion. They test preservation of binding meaning and observable Workers RPC interaction, not conformance to one client API.

- **WRPC-D-01**: `content` is absent; no carried interface representation is accepted.
- **WRPC-D-02**: `location` is required and has exactly the canonical, case-preserving `workers-rpc:///<encoded-service-binding-name>` form of [§4](#4-location).
- **WRPC-D-03**: `ref` is required and denotes one exact non-empty remote method property key, with no path or encoding semantics; pinned reserved/disallowed `WorkerEntrypoint` names are refused and every other name's remote existence is determined only by dispatch.
- **WRPC-P-01**: Input and output use only the finite JSON subset; unsupported Cloudflare-serializable values are refused rather than coerced.
- **WRPC-P-02**: Target resolution, zero/one-argument dispatch, `undefined` completion, JSON output, and terminal-failure classification follow [§8](#8-target-and-interaction) and [§9](#9-operation-boundary-correspondence).
- **WRPC-P-03**: Cancellation claims distinguish local cancellation from confirmed remote abort.

## Promotion decisions and remaining gates

The targeted design review resolves three boundary questions: revision 1 is strictly zero-or-one argument and never spreads an array; top-level JavaScript `undefined` is clean completion with zero output values; and the address is the canonical opaque-registry form `workers-rpc:///<encoded-name>`. Those decisions are part of the candidate above, not choices left to implementations.

The artifactless shape is admissible under the catalog's existing doctrine: `location` plus `ref` supplies concrete target identity, the pinned Cloudflare platform supplies dispatch and failure behavior, and this candidate explicitly defines the narrower zero/one-JSON-value boundary where no interface artifact speaks. Its inability to synthesize schemas or preflight remote method signatures is a declared mode limitation, like other artifactless sources, not permission for private policy. A future accepted TypeScript/IDL carriage may add a schema mode only through a compatibility review of this identifier.

The remaining promotion gates are evidence and adoption, not unresolved semantics: add source fixtures and portable processor scenarios for every proposed rule, execute them through the Cloudflare runtime adapter, and coordinate runtime support before minting the identifier. Until those gates pass, keep the page candidate-only and outside the 0.2.0 published-spec release gate.

## 11. References

- [Cloudflare Workers: RPC over service bindings](https://github.com/cloudflare/cloudflare-docs/blob/65d8126a201af30378db7010e76da46c5fe8e193/src/content/docs/workers/runtime-apis/bindings/service-bindings/rpc.mdx), pinned source
- [Cloudflare Workers RPC](https://github.com/cloudflare/cloudflare-docs/blob/65d8126a201af30378db7010e76da46c5fe8e193/src/content/docs/workers/runtime-apis/rpc/index.mdx), pinned source
- [Cloudflare Workers RPC compatibility behavior](https://github.com/cloudflare/cloudflare-docs/blob/65d8126a201af30378db7010e76da46c5fe8e193/src/content/docs/workers/configuration/compatibility-flags.mdx), pinned source
- [Cloudflare Workers RPC reserved methods](https://github.com/cloudflare/cloudflare-docs/blob/65d8126a201af30378db7010e76da46c5fe8e193/src/content/docs/workers/runtime-apis/rpc/reserved-methods.mdx), pinned source
- [Cloudflare Workers RPC visibility](https://github.com/cloudflare/cloudflare-docs/blob/65d8126a201af30378db7010e76da46c5fe8e193/src/content/docs/workers/runtime-apis/rpc/visibility.mdx), pinned source
- [Cloudflare Wrangler: service bindings](https://github.com/cloudflare/cloudflare-docs/blob/65d8126a201af30378db7010e76da46c5fe8e193/src/content/docs/workers/wrangler/configuration.mdx), pinned source
- [OpenBindings core specification](../../openbindings.md)
- [Binding-specification authoring guidance](../README.md)
