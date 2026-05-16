# OpenBindings Guides

Guides are advisory, human-oriented material for understanding and implementing OpenBindings patterns.

They are not part of the core specification and do not define conformance requirements. When a guide conflicts with the core spec, `../openbindings.md` governs. When a guide discusses official SDK or CLI behavior that is also covered by a machine-verifiable convention, `../conventions/` governs.

Use guides for:

- onboarding and examples
- implementation patterns
- SDK architecture context
- binding-format and invocation concepts

Do not use guides as:

- conformance criteria
- wire-format contracts
- stable report schemas
- fixture expectations

## Guide Index

- `getting-started.md` — first walkthrough for the `ob` CLI and a minimal OBI document.
- `faq.md` — short conceptual answers for new readers.
- `creators-and-invokers.md` — concepts behind binding invokers, interface creators, and source inspectors.
- `implementing-a-binding-format.md` — step-by-step walkthrough for implementing a new binding format, with Go and TypeScript examples.
- `binding-format-conventions.md` — advisory catalog of known binding-format conventions used by current implementations.
- `binding-invocation-context.md` — SDK guidance for runtime context, credentials, and platform callbacks.
- `interface-client.md` — pattern for consuming an OpenBindings interface from a target service.
