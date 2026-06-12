# Source Inspector

A source inspector examines a binding source before an OBI is created. It returns bindable targets that tooling can offer to users, optionally including a suggested operation key and operation framing for each target.

This powers tooling that helps users select which operations to include when authoring an OBI without relying on non-normative ref naming conventions.

## When to use it

Source inspection is the right primitive when a user is *authoring* an OBI from an existing artifact and wants to choose which targets to bind. Typical surfaces:

- An interactive CLI flow (`ob create --interactive`) that shows the user a checklist of targets.
- A web tool that lets a user pick endpoints from an uploaded OpenAPI spec.
- A code-generation step that needs to enumerate available bindings.

For non-interactive synthesis ("give me an OBI for everything in this spec"), use the [interface creator](../openbindings.interface-creator/) directly. Inspection is the discovery step that precedes a targeted creation.

## Why this is a separate interface

Source inspection could conceptually be folded into the interface creator as an extra operation. It is a separate interface because the capabilities are independently useful: a source inspector does not need to generate full OBIs, and an interface creator does not need to surface targets to users. Splitting them lets a tool depend on exactly the capability it needs, and lets a service author publish an inspector without committing to full OBI generation.

## The `exhaustive` flag

`SourceInspection.exhaustive` tells the consumer whether `targets` is the complete enumeration of bindable targets in the source.

- `exhaustive: true` means the inspector has reported every target that could be bound. A "select all" action in the UI is safe.
- `exhaustive: false` means the inspector returned a meaningful subset (for instance because the source is huge, lazily-loaded, or because some targets were filtered for relevance). The UI should make clear that more may exist.

Inspectors SHOULD prefer `exhaustive: true` whenever the source format permits enumerating all targets up-front. Set `exhaustive: false` only when enumeration is genuinely partial, not as a defensive default.

## Operation framing is optional

`BindableTarget.operation` is optional. An inspector that knows enough to suggest input/output schemas, tags, or a description SHOULD include it; an inspector that only knows the ref MAY return targets with just `ref` (and optionally `operationKey`). Consumers MUST treat a missing `operation` as "framing not provided," not as an error.

## Idempotency

`inspectSource` is declared idempotent. Calling it repeatedly on the same source MUST return the same targets in the same order. Tooling relies on this for stable UI rendering and stable test fixtures.
