# JSONata transform embedding

This document defines the shared embedding of JSONata used when an
OpenBindings-published binding specification incorporates it. It defines no
core OpenBindings members and does not constrain third-party kind definitions.
Each incorporating kind defines where expressions occur, their input values,
and the consequences of their results.

**Incorporated authority.** Expressions are plain strings in JSONata 2.1, as
defined by the official [2.1 documentation snapshot](https://github.com/jsonata-js/jsonata/tree/5d1473277e0022d8580e00f891b12080eb3edd74/website/versioned_docs/version-2.1.0),
with [jsonata-js 2.1.1](https://github.com/jsonata-js/jsonata/tree/5d1473277e0022d8580e00f891b12080eb3edd74)
as the behavioral tiebreak. This is an incorporated language, not a custom
expression syntax or a restricted replacement language. Language changes require
revision of the incorporating kind under its publication rules.

**Convention — evaluation boundary.** Each evaluation receives the one input
value defined by the incorporating kind as its JSONata context (`$` at entry).
An absent input is an undefined context, distinct from JSON null. The environment
contains JSONata's standard library and only additional bindings expressly
defined by the incorporating kind. Implementations MUST NOT inject custom
functions, credentials, transport state or host-access bindings. Expressions can
define their own variables and functions using JSONata. Standard-library behavior,
including time and random functions, remains governed by JSONata; this embedding
does not promise that every expression is deterministic.

**Convention — value boundary.** JSONata's sequence rules apply without an extra
OpenBindings flattening rule. A defined result must be a JSON value: null is a
value, and an array is one value, not a stream of outputs. An undefined result
is absence. A function or other non-JSON result, including one nested in a
container, is a transform failure; it must not be silently dropped or converted
to null by JSON serialization. Invalid expression syntax is invalid binding
content. An evaluation error is a transform failure. The incorporating kind
defines how absence and failure affect its interaction.

Implementations may have execution and numeric capability limits, but MUST
report inability rather than claim evaluation completed with a substituted,
truncated or silently rounded boundary value. JSONata's own defined arithmetic
semantics are not replaced by arbitrary-precision arithmetic. This document
does not prescribe an evaluator implementation, caching, compilation strategy
or resource-limit mechanism.
