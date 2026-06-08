# Software Descriptor

A generic identity contract any piece of software MAY implement. Defines `getInfo` for self-identification: name, version, description, homepage, repository, maintainer.

This role exists so that tooling, registries, and clients have a uniform way to ask "what is this thing?" regardless of what else the software does. Any implementation that fills a domain role (binding invoker, interface creator, source inspector, anything else) can also implement this role to advertise its identity.

## When to add it

Adding `software-descriptor` to an OBI is appropriate when:

- The implementation is intended for discovery (published on a registry, listed in a catalog).
- The implementation is invoked by tools that want to log or display its identity.
- The implementation needs to expose a build version separate from the contract version (an OBI's `version` is the contract version, not the binary version).

For private or single-use implementations, the role is optional.

## Field guidance

- **`name`** (required). Human-readable display name. SHOULD be stable across versions of the same software. Distinct from the OBI's `name`, which identifies the contract.
- **`version`**. Build or release version of the software (`v1.4.2`, `2026.05.13`). Distinct from the OBI's `version`, which is the contract version.
- **`description`**. One-sentence summary of what the software does. Intended for a card or list display, not full documentation.
- **`homepage`**. URL to docs, marketing page, or project home.
- **`repository`**. URL to source code (typically a Git URL or a `https://github.com/...` URL).
- **`maintainer`**. Author or maintaining organization. Free-form string; not parsed.

Implementations MAY return additional fields beyond these. Consumers that do not recognize a field SHOULD ignore it.

## Idempotency

`getInfo` is declared idempotent. The output MAY change across releases of the software, but for a given build it MUST be stable.
