# HTTP Client

An HTTP client makes requests on behalf of callers that cannot make them directly. Useful when the caller's environment imposes constraints (browser CSP/CORS, network restrictions, firewalls, sandboxed embeddings) and a trusted backend can perform the request instead.

## When to use it

The HTTP client interface is the OpenBindings answer for "I have an interface to talk to, but my runtime cannot reach it directly." A browser-hosted invoker that runs into CORS or CSP can delegate the actual fetch to a backend implementation of this interface, get the response back as data, and continue processing.

This is not a general-purpose proxy contract. It is intentionally minimal: one operation, text body, no streaming. Implementations that need to relay large payloads, binary data, or streaming responses should expose a richer contract of their own.

## Security responsibilities

Because this interface makes outbound requests on the caller's behalf, the implementation is in a privileged position. Implementations SHOULD:

- **Validate URLs** before issuing requests. Reject malformed URLs.
- **Restrict private network access** by default (RFC 1918 ranges, loopback, link-local, cloud metadata endpoints). If the implementation is intended to reach private networks, that should be an explicit opt-in.
- **Cap response size** using `maxResponseBytes` so a malicious or pathological target cannot exhaust the proxy's memory.
- **Cap request duration** using `timeoutMs` so a slow target cannot hold a worker indefinitely.
- **Avoid leaking auth context across origins.** Do not automatically forward cookies or Authorization headers from one request to another.

Implementations define their own defaults and maxima for `timeoutMs` and `maxResponseBytes`. Callers MAY request lower values; implementations MAY refuse values higher than their configured maximum.

## Text body

`body` is a string. Callers that need to send binary content should base64-encode and set an appropriate `Content-Type`. This keeps the contract JSON-serializable across any transport that carries the contract.

## What this interface does NOT do

- **Streaming responses.** The full response body is returned at once. Callers that need server-streaming should pick a different binding format and invoke through `openbindings.binding-invoker`.
- **WebSocket / long-lived connections.** Same reasoning.
- **Authentication on behalf of the caller.** Callers pass `Authorization` headers themselves; the interface does not perform auth flows.
