# AsyncAPI family execution

This directory implements the family-completion loop. It is not a published
binding specification or an assertion of complete AsyncAPI support.

- [Completion register](COMPLETION.md): generated from [completion.json](completion.json).
- [Edition differences](EDITION-DIFFERENCES.md): source-checked counterexamples
  and the corrected inherited 2.6 payload ruling.
- [M1a execution packet](M1A-EXECUTION.md): the first independent real-wire result
  and its remaining acceptance gates.
- [Gap-correction packet](GAP-CORRECTIONS.md): R1/R2 changes following review;
  historical M1a counts are not the current runner inventory.
- [HTTP completion packet](HTTP-COMPLETION.md): R3's explicit live/trace
  separation and independently exercised field grammar.
- [Acceptance evidence](ACCEPTANCE-EVIDENCE.md): R4's typed record, trusted
  history and universal readiness contract; no live acceptance is implied.

## Selective commands

Run from the specification worktree root:

```sh
node scripts/verify-asyncapi-family-completion.mjs
node --test scripts/test-asyncapi-completion-evidence.mjs
node scripts/test-asyncapi-family.mjs --suite=primary
node scripts/test-asyncapi-family.mjs --suite=wire
node scripts/test-asyncapi-family.mjs --suite=synthesis
node scripts/test-asyncapi-family.mjs --suite=wire --case=M1-35
node scripts/test-asyncapi-family.mjs --suite=all --mutants --clean
```

`primary` executes the existing C21 semantic evaluator over its covered P/S
range without spawning the full corpus's schema/integrity orchestration. It
does not claim semantic execution of older kernel-only fixtures. The full
`node scripts/verify-binding-specs.mjs` remains mandatory at milestone boundaries.
The selected identities must match the independent `witness/primary-inventory.json`
lock (currently 181, including review-added SS-75 and PS238–240). All selected primary/wire IDs are emitted in run output.
`--case` is supported only for explicitly partial primary/wire diagnostics and
cannot be combined with `--mutants` or treated as acceptance evidence.

`wire` builds a separately written Go witness and starts a loopback-only TCP
peer. It checks literal expected bytes against both the witness's record and
the peer's received bytes, then compares primary outcomes independently.
Neither the Go program nor the peer receives expected outcomes. Authored
`example.test` authority remains in Host; an explicit test-only mapping routes
the socket to `127.0.0.1`. No external endpoint is contacted and no production
service is mutated. Restricted environments may require permission to listen
on loopback. A listen failure is a failed test, never simulated success.

`synthesis` checks complete literal represented/excluded examples and a
registered subset of preexisting C21 scenarios, including exact document
assertions. Only declared set-valued result arrays are order-normalized; source
document arrays retain their order. Missing or unsupported registered cases fail.

`--mutants` builds disposable modified witness sources and runs ordinary tests
against them. It changes actual behavior (method, input acceptance, successful
body handling, synthesis schema, load admission, action classification, exact
synthesis ownership, authority handling, media grammar, framed completion and
terminal immutability).
Each mutation has exactly one replacement, a passing same-case control and a
required named assertion plus expected wrong value. Wrong assertions and
infrastructure failures are not kills. An unchanged binary must survive, and
a missing executable must be classified as an infrastructure failure.
An actual invalid-Go compilation is also classified as infrastructure failure.
Each emitted mutant record includes its source digest/path, match text/byte
offset/cardinality, replacement and changed-source digest, owning rules, case
and expected assertion.
`--clean` starts with an
empty Go build cache. Temporary binaries and mutation sources are removed on
exit. The source worktree is not mutated by these test options.

## Dependencies and independence

The witness module has no external Go dependencies. This packet was executed
with Go 1.24.1 and Node 22.19.0 on Darwin arm64. CI selects Go 1.24.1 explicitly;
cross-platform CI execution is still distinct from this local result. Go's
standard `net/http`, `encoding/json`, and `mime` libraries supply independent
protocol/JSON parsing. The primary evaluator retains its existing pinned
`yaml@2.8.1` dependency and lock checks. `GOTOOLCHAIN=local` prevents an implicit
toolchain download during witness execution.

The Go witness does not import the JavaScript evaluator, its private helper
functions, expected outcomes, or peer scripts. The JS orchestrator imports the
primary evaluator through a new side-effect-free entry boundary; this is a
small extraction, not a replacement verifier. Both implementations still
depend on the same normative candidate. The same author prepared this packet;
separate code and languages are not substitutes for non-authoring authority
and evidence review.

## Explicit witness limits

M1a is an execution packet, not a complete second implementation of C21:

- Only object-carried sources and the tested local reference/membership forms.
  External resource bytes, YAML/JSON text carriage, key materializations,
  general malformed-owner accounting and direct-only membership are not
  implemented. R2 adds required Info/root-map load validation and exact invalid
  action ownership for direct and tested local referenced operations.
- The exchange fixtures use already qualified Unicode-scalar JSON. Go's JSON
  decoder is not evidence for raw duplicate-key or lone-surrogate preservation.
- Live completion is framing-driven and published before EOF; a separate finite
  trace observer detects appended bytes. Causal open-connection tests verify
  that distinction. This is not a general reusable HTTP connection pool or an
  implementation of arbitrary caller action traces.
- Cancellation uses one count-1 barrier at attempt/open/first request byte/
  dispatch/first acknowledgement. More complex barriers are explicitly
  unsupported rather than passed using guessed timing.
- The peer head/body qualification surface is not fully independently covered.
  Raw HTTP media grammar is independently checked around the MIME base parser;
  this does not establish every possible field/framing partition. Current
  defensive limits are 64 KiB per head, 32 response heads,
  1 MiB body, and a three-second peer deadline; none is a specification limit.
  Deadline and head-size exhaustion now report apparatus-unsupported rather
  than a portable response error. A deadline during post-terminal observation
  leaves the live terminal unchanged and the trace explicitly incomplete.
- No richer payload, trait, schema, security, HTTPS, WS or MQTT profile is
  admitted by this packet. Unsupported witness cases are never specification
  exclusions and never count as accepted behavior cells.

The named M1 obligations remain open. Required independent evidence may be
supplied by qualified real clients and focused witnesses; it need not all live
inside this miniature Go program. Each richer feature consumes only its
qualified common-model prerequisites and must not create a profile-specific
replacement loader. A repaired bounded packet is not complete M1 or family
readiness. The R4 checker changes require frozen non-authoring review before
acceptance; its ordinary progress command is not acceptance qualification.
