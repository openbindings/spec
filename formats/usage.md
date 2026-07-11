# `usage` binding conventions

**Status: non-normative conventions of record.** Not part of the core specification. This document records how the OpenBindings project binds [jdx usage](https://usage.jdx.dev) CLI descriptors — the answers to the [format authoring checklist](README.md#authoring-a-new-binding-format), as implemented by the reference package (the Go SDK's `formats/usage`; there is no TypeScript counterpart by design). This is the catalog's exemplar *incomplete* format: the artifact describes a human command surface and cannot declare output decoding, exit-code meaning, or stdin routing, so the completeness-spectrum doctrine (assumptions + consumer hooks) does its heaviest lifting here.

Tier tags: **[format-spec]** — pinned by the usage specification; **[convention]** — the OB convention of record as the reference package implements it; **[assumption]** — a content-independent default a consumer hook may override; **[open]** — deliberately unanswered.

## Format token

Sources declare the exact usage-tool version (`usage@2.13.1`); tools advertise the ranges `usage@^2.0.0` and `usage@^3.0.0`. **[convention]** The artifact's own `min_usage_version` is gated against the supported range at load, loudly. **[convention]**

## `ref` syntax

A space-separated command path into the artifact's command tree (`db migrate run`); the **empty ref is the root command**. **[convention]** Path resolution honors command aliases and accumulates inherited global flags. **[convention]**

## Source expectations

**Artifact-located**, and the artifact is a pristine bare usage-spec KDL document — never a wrapper (the spec+configuration doctrine: the OBI stays abstract, the artifact stays pristine). **[convention]**

- The conformant document shape carries the artifact as **embedded `content`** (the project's embed-default lane for local artifacts): a CLI descriptor is a local file, and local paths are not conformant `location` values (OBI-D-05 — a bare filesystem path is a relative reference; URLs are refused by this format as "not fetchable"). **[convention]**
- An **`exec:` locator** (`exec:mytool usage`) names a command whose output is the artifact, for tools whose descriptors are generated live. **[convention]** (Note: a locator with spaces is not a well-formed URI and thus not a conformant document `location`; see Open points.)
- At invocation intake the reference package is liberal — it reads absolute file paths and exec: locators — but the authoring lanes absolutize and embed so emitted documents validate. Both present: content is authoritative, location is provenance. **[convention]**

## Input conventions

One optional input object; fields map to the declared CLI surface: flags (primary/short/long names), positionals (declared order, `--` inserted when declared), boolean presence/negation, count flags, arrays repeating flags or spreading positionals; non-string values ride argv as compact canonical JSON. Unknown fields refuse loudly. **[convention]**

The **field router** hook is consulted per field before argv assembly (the one format in the reference SDKs that consults it): the default route is argv **[assumption]**; consumer overrides route a field to stdin (`-`-operand or pure channel) or a temp file, with loud pre-spawn refusals for impossible routings (two stdin fields, a routed field with no slot, and the like). **[convention]** Secrets never ride argv; credentials and configuration ride **environment variables** from the context's `environment` field. **[convention]**

## Invocation shape

Unary only: one optional input, one output; a bare close runs the bare command. Streaming and interactivity are inexpressible in the descriptor and out of scope. **[convention]** The process is bound to the invocation lifetime (cancellation kills it); execution is direct process spawn, never a shell. **[convention]**

## Wire answers (routing / decode / classify)

The descriptor answers none of the three wire questions, so all three are assumptions with hook overrides (the catalog's recommended defaults for the CLI family):

- **Routing**: argv. **[assumption]**
- **Decode**: stdout as text, trailing newline stripped (command-substitution semantics). **[assumption]**
- **Classify**: success iff exit 0; the native failure detail carries the exit code, stdout, and a stderr tail. **[assumption]**
- Provenance: `x-ob-decode: assumption/text|hook`, `x-ob-classify: assumption/exit-0|hook`, and per-field `x-ob-route` stamps; exit code and stderr tail always ride the metadata. **[convention]**

Per-CLI knowledge (a tool that emits JSON, alternate success exits, field routes) is packaged as consumer configuration — compiled, format-guarded hooks — never authored into the artifact or the OBI. **[convention]** (the spec+configuration ruling).

## Authentication and context

Local execution has no wire auth; no `CONTEXT_REQUIRED` challenge is derivable from the descriptor. Environment variables from context are the credential channel. **[convention]**

## Open points

- A conformant *reference* form for live-generated descriptors: `exec:` locators with arguments contain spaces and are not well-formed URI locations (embedding the generated artifact is the conformant answer today).
- Synthesis emitting path-form locations (a dev-flow convenience) produces documents that fail OBI-D-05 — tracked as reference-implementation alignment with the embed-default ruling, not a convention.
- Interactive and long-running commands; PTY surfaces.
