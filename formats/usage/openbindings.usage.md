# openbindings.usage — CLI binding-unit format

**Version 0.1.0 — working draft.** This document is the authority for the
`openbindings.usage` binding format: a JSON document that wraps a
[jdx usage-spec](https://usage.jdx.dev/) CLI descriptor and adds the
invocation semantics that descriptor cannot express, so that an
OpenBindings `(source, ref)` pair resolves to a complete invocation
recipe. MUST/SHOULD/MAY carry their RFC 2119 meanings and bind any
implementation of this format.

## 1. Overview

A CLI is a machine-invocable interface (argv in, byte streams out, exit
code), but its descriptor ecosystem describes surfaces for humans: a
usage-spec document carries flags, args, and help text, and has no
vocabulary for what a machine needs — which channel a document-valued
field rides, what stdout *is*, which exit codes are results rather than
failures. This format supplies that missing half without touching the
artifact it wraps: the jdx usage.kdl is embedded or referenced verbatim
(the surface half, reused and unowned — the role JSON Schema plays inside
OpenAPI), and **units** add the invocation half (the role OpenAPI's
parameter locations, content types, and response objects play for HTTP).

Division of labor with the OpenBindings core: value adaptation (field
names, shapes, injected constants) is protocol-independent and belongs to
spec-level `inputTransform`/`outputTransform` — JSON-space in, JSON-space
out. Protocol mechanics — everything in this document — belong here and
never to core OBI vocabulary. A unit's routing members are written
against the *post-transform* input object, because the transform's output
is this transport's input.

## 2. Format token and versions

The format token is **`openbindings.usage@0.1.0`** (exact version). Three
version signals exist in a document; each governs one thing, none is
advisory:

1. **The source token** governs the *document shape* (§3) and its load
   rules. A tool MUST refuse a document whose token version it does not
   support. (The document shape is normative here — unlike formats whose
   shape is unconstrained — so the token cannot be demoted to advisory.)
2. **The per-unit version key** (§4) governs that *unit's
   interpretation*: member vocabulary, mode values, and defaulting. A
   tool MUST refuse a unit declaring a version it does not support;
   pre-1.0, any higher minor is unsupported. Units of different versions
   MAY coexist in one document (incremental migration).
3. **`spec.format`** (§3) governs the *artifact*: the jdx usage-spec
   version of the wrapped kdl, checked at load (§10).

Version discipline is structural throughout: unknown vocabulary refuses
(§3, §4), new behavior keys to new members or mode values, and a future
version of this format MUST NOT change the meaning of documents valid
under an earlier version.

## 3. The document

A JSON object. Carried as an OpenBindings source, `content` is the parsed
JSON object form; `location` is an absolute reference to the document.

```json
{
  "spec": {
    "format": "usage@2.13.1",
    "content": "…jdx usage.kdl text, verbatim…"
  },
  "units": {
    "validate": {
      "openbindings.usage": "0.1.0",
      "command": "validate",
      "delivery": { "locator": "stdin-dash" },
      "stdout": "json",
      "exit": { "ok": [0, 1] }
    }
  },
  "description": "optional"
}
```

| Member | Required | Meaning |
|---|---|---|
| `spec` | yes | The wrapped artifact (below). |
| `units` | yes | Map of unit names to units (§4). MAY be empty. Names MUST match `^[A-Za-z_][A-Za-z0-9_.-]*$`. |
| `description` | no | Human-readable. |

**Unknown-member policy, every level** (document root, `spec`, units, and
nested objects): unknown members whose names do not begin with `x-` MUST
be refused; `x-`-prefixed members MUST be ignored and SHOULD be preserved
by rewriting tools.

**`spec`**:

| Member | Required | Meaning |
|---|---|---|
| `format` | yes | The artifact's format token, e.g. `"usage@2.13.1"` — the declared jdx artifact version. Checked at load (§10). |
| `content` | one of | The kdl text, verbatim. Authoritative when present. MUST be self-contained (jdx `include`s flattened). |
| `location` | one of | Absolute reference to the kdl (URL, path, or `exec:<binary>`). Never resolved against a base URI supplied by carriage. Provenance when `content` is present. |
| `hash` | conditional | `sha256:<hex>` over the exact UTF-8 octets of the artifact text, no normalization. REQUIRED when `content` is absent; a loader MUST verify fetched text against it and refuse on mismatch. With `content` present it is optional origin provenance; loaders MUST NOT refuse on it. |

When this document is itself embedded as OpenBindings source `content`,
`spec` MUST use content mode: no fetch hides inside embedded content.
With an `exec:` location, `hash` pins the binary's emitted spec by
design; a binary upgrade that changes the emitted text is a loud refusal
until the wrapper is re-synced.

## 4. The unit

The value a binding `ref` resolves to: everything a format-capable tool
needs, beyond the artifact, to invoke one command as one operation.

| Member | Required | Meaning |
|---|---|---|
| `openbindings.usage` | yes | Format version this unit is authored against. |
| `command` | yes | Space-separated command path into the artifact (`"context set"`); empty string = the root command. |
| `delivery` | no | Field-routing map (§5). |
| `stdout` | no | Output decoding mode (§6). Absent = `"text"`. |
| `exit` | no | Exit classification (§7). Absent = `{"ok": [0]}`. |
| `description` | no | Human-readable. |

Units carry no transforms (spec-level, OBI-side) and MUST NOT restate
anything the artifact can describe (flags, args, choices, help): if the
artifact can say it, the artifact owns it.

**Artifact precedence, version-gated.** Where the artifact natively
declares a capability a unit member also addresses, an absent unit member
defaults from the artifact's declaration and a present unit member wins —
but artifact-derived defaulting applies **only** to artifact vocabulary
that the unit's declared format version recognizes. (At 0.1.0, that set
is empty: jdx usage-spec has no invocation vocabulary.) Adopting
newly-grown jdx vocabulary into defaulting is a version event of this
format, never a silent behavior change from a refreshed artifact.

## 5. Delivery

`delivery` maps **post-transform input field names** to a mode. Unlisted
fields ride argv (§8).

| Mode | Bytes go to | Argv slot receives | Slot requirement |
|---|---|---|---|
| `"stdin-dash"` | child stdin | the literal `-` | MUST name a value-taking flag or a positional arg |
| `"stdin"` | child stdin | nothing | MUST name no flag or arg (the no-operand filter class) |
| `"file"` | a temp file | the file's absolute path | MUST name a value-taking flag or a positional arg |

Rules:

- At most one field may declare a `stdin-dash` or `stdin` mode; a unit
  declaring more than one MUST be rejected regardless of which fields the
  runtime input carries (the rule is static).
- A delivery-listed field absent from the input, or present with JSON
  `null`, is a no-op; stdin is then left unconnected and no token is
  emitted.
- **Byte encoding** (both channels): a string value is written raw (exact
  UTF-8 bytes, nothing added); any other JSON value is written as its
  compact JSON serialization. A routed value larger than 10 MiB MUST be
  refused before spawn.
- **Temp files**: the path passed MUST be absolute; files MUST live in a
  private per-invocation directory removed after the process exits
  (removal cannot outlive the invoking process); a JSON-encoded value's
  file name MUST end in `.json` and a raw string's MUST NOT; the base
  name is otherwise implementation-chosen.

## 6. Output decoding (`stdout`)

Applied on declared-ok exits (§7):

| Mode | Meaning |
|---|---|
| `"text"` (default) | The output value is stdout as one string with trailing newline characters (`\n`, `\r`) stripped — command-substitution semantics; interior newlines preserved. Deterministic and total: never guesses, never fails to decode. |
| `"json"` | stdout MUST parse as exactly one JSON value (surrounding whitespace stripped first; numbers included). Empty or whitespace-only stdout decodes as `null`. A parse failure is a terminal invocation error, never a silent wrap. |
| `"none"` | stdout is not consulted. The output value is `null` unless `exit.values` (§7) supplies it. |

There is no heuristic mode: an undeclared lane means `"text"`, a
declaration in itself. Machine lanes declare `"json"`. Exact-content CLIs
whose trailing newlines are payload are outside `"text"`'s semantics; a
raw mode is anticipated future vocabulary, not present.

## 7. Exit classification (`exit`)

```json
"exit": { "ok": [0, 1], "values": { "0": true, "1": false } }
```

| Member | Meaning |
|---|---|
| `ok` | Exit codes that are successful completions. Integers 0–255. REQUIRED if `exit` is present, and MUST be non-empty — an empty or missing `ok` list MUST be rejected at parse. Absent `exit` = `{"ok": [0]}`. |
| `values` | Optional map from decimal-string codes to literal JSON output values, for CLIs whose entire result is the exit code (`grep -q`, `cmp -s`, `git diff --quiet`). Every `values` key MUST appear in `ok`. `values` REQUIRES `stdout: "none"` (one producer of the output value). |

A declared-ok exit proceeds to output decoding; when `values` maps its
code, the mapped literal is the output value. Any other exit is a
terminal invocation error carrying `{exitCode, output: {stdout, stderr}}`
detail. A child terminated without an exit code (signal death) is never a
declared-ok completion, regardless of `ok`; tools report it as exit code
`-1` in diagnostics — a sentinel meaning "no exit code existed", not a
code a unit can declare.

## 8. Argv value grammar and assembly

Unlisted (argv-delivered) fields render as: strings verbatim (argv is an
exec array — no shell, no quoting); every other value as its compact
canonical JSON (`1000000`, never `1e+06`; `{"k":"v"}`, never Go's
`map[k:v]`). Booleans on value-less flags use presence semantics (`true`
emits the flag; `false` emits the flag's declared `negate`, else
nothing; count flags repeat by value). `null` fields are omitted. Arrays
repeat a flag per item or spread across a variadic arg, items per the
same rules.

Assembly: flags first, in lexicographic field-name order (long names
`--`, single-character names `-`); positional args follow in the
command's declared order, with `--` inserted before the first arg that
declares `double_dash`. Field names MUST match the command's flag or
clean-arg names exactly (inherited global flags participate; flag short
names and command aliases match as the artifact defines them); an input
field matching neither is an error, except a `stdin`-routed field per §5.
The transport performs no usage-spec validation and applies no defaults:
`default`, `env`, `choices`, and requiredness are the CLI's own to
enforce. A later optional positional present while an earlier one is
absent is an error (the gap cannot be expressed on argv).

Argv tokens are subject to OS ceilings; document-valued fields SHOULD
declare `delivery` rather than ride argv as JSON tokens.

## 9. Diagnostics

stderr and the exit code are diagnostics, never part of the output value.
On declared-ok exits they ride trailing metadata:

- `x-exit-code`: always present; base-10 decimal string, single entry.
- `x-stderr`: the **last** 64 KiB of captured stderr (tails carry the
  operative lines), single entry, omitted when empty; byte-truncated
  (payload may end mid-UTF-8-sequence).
- `x-stderr-truncated`: `"true"` when `x-stderr` was truncated by the
  trailer bound or the capture cap.

Capture: stdout up to 10 MiB, overflow a terminal error (a truncated
value is corrupt); stderr capture keeps the most recent bytes and its
volume never fails a successful invocation. Any transport carrying these
trailers across a header-framed protocol MUST encode them byte-safely.

Error classes: refusals driven by declarations or values before spawn
(unknown vocabulary, version refusal, one-stdin, unknown field, delivery
cap, load-time validation) are validation failures; environmental and
process failures (spawn errors, temp-file IO, non-ok exits, `"json"`
parse failures) are execution failures. The classification is normative;
the code vocabulary is the invoking SDK's.

## 10. Loading and validation

On load, a tool MUST: refuse an unsupported document token (§2); check
`spec.format` against this specification's accepted artifact versions
(§12) and, when the kdl declares `min_usage_version`, against that;
verify `hash` where §3 requires it; apply the unknown-member policy.

Unit validation — every check statically decidable against the parsed
artifact: `command` resolves to a command; every `stdin-dash`/`file`
delivery key names a value-taking flag (one that declares a flag
argument) or a positional arg — a key naming a boolean or count flag is
invalid, and a `stdin-dash` key whose slot declares `choices` not
containing `-` is invalid; every `stdin` key names no flag or arg; §5's
one-stdin rule; §7's `ok`/`values` rules.

**Failure granularity is per-unit**: a unit that fails validation makes
bindings referencing *it* unactionable (excluded from binding selection,
with a diagnostic); other units stay invocable. Whole-document refusal is
reserved for the document-level checks in the first paragraph.

## 11. Refs and generated names

A binding's `ref` MUST be an RFC 3986 fragment carrying a JSON Pointer
(`#/units/validate`). Bare unit names MUST NOT be accepted. The resolved
value MUST be a unit — `#` and `#/spec` are not valid targets. An absent
ref, non-resolution, or an invalid resolved value is a binding error
tools MUST surface.

Tools that generate units (synthesis from a bare kdl, sync backfill) MUST
name them deterministically: the command path joined with `.`
(`context set` → `context.set`); the root command is named after the
artifact's `bin` (falling back to `name`). Hand-authored names are free
within the identifier pattern; multiple units MAY target the same
`command` with different elections.

Binary resolution at invocation: the executable is the artifact's `bin`,
falling back to `name`; neither present is a configuration error;
resolution uses the platform's normal executable search.

## 12. Accepted artifact versions

This version accepts jdx usage-spec artifacts declaring (or defaulting
to) versions `>= 2.0.0, < 3.0.0`. (jdx's version numbers track its tool,
which is what `min_usage_version` pins.) Widening to 3.x is a minor
revision of this format after verification.

## 13. Sync (tooling guidance, non-normative)

The kdl is often a living artifact regenerated from an upstream CLI
framework. The recommended resync algorithm — origin is `spec.location`
when present, else external bookkeeping, else an explicit argument:

1. Refresh `spec.content`/`spec.hash` from the origin.
2. Re-validate every unit (§10). Passing units keep `delivery`,
   `stdout`, and `exit` **verbatim** — elections are authored content
   and are never regenerated.
3. A unit with no election members and no inbound binding refs is
   derived content: it refreshes or retires silently. A unit with
   elections or inbound refs that fails validation is reported and the
   sync fails loudly — never silently dropped or rewritten; a prune
   option MAY remove failing units and then MUST report each destroyed
   election member by name.
4. Commands with no unit gain trivial units, named per §11.
5. Every binding ref into this source must resolve to a surviving unit;
   a dangling ref fails the sync.

## 14. Security considerations

A unit author is a code author: units direct where caller data is
written (disk, stdin) and how output is interpreted; treat wrappers from
untrusted origins accordingly. Fields whose values may be sensitive
SHOULD declare a stdin mode, not `"file"`: stdin never touches
persistent storage, while a temp file leaves residue if the invoking
process dies before cleanup. The argv grammar emits caller data into
operand positions; content-carrying string fields SHOULD be
delivery-routed rather than passed as argv tokens. `hash` verification
protects unit-to-artifact coherence, not artifact-to-binary fidelity:
what the installed binary actually does is out of scope, as it is for
every binding format.

## 15. Relationship to the jdx usage spec

This format adds no vocabulary to jdx's format and expects none: a
pristine, unmodified usage.kdl is the only artifact form. Facts that are
honestly CLI description (exit-code meanings, stdin acceptance) live
here only because the artifact cannot yet express them; §4's
version-gated precedence rule exists so that if jdx grows such
vocabulary, this format absorbs it by explicit revision instead of
conflicting with it. Proposals for that vocabulary belong upstream, and
this project intends to file them.
