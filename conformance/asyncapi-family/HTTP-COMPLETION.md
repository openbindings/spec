# R3 HTTP completion and field grammar

Status: execution verified in focused runs; final frozen review pending.
This packet makes a normative correction under the user-delegated,
source-checked terminal decision. It is not family or feature-register acceptance.

## Meaning and migration

RFC 9112 §6.3 and §9.3 determine framed completion without EOF. Candidate §5
and P11–P13 now distinguish the immutable live invocation from finite trace
qualification. Clean non-2xx completion has the same timing boundary as 2xx.
Post-terminal unsolicited bytes invalidate the trace and forbid connection
reuse; the latter is explicitly a profile convention. No second terminal or
operation output is permitted. Clean transport closure is trace-only telemetry.

Every one of the 133 C21 processing alternatives now has explicit trace status
and an exact `afterTerminal` native suffix, separate from the live timeline.
The schema permits only a single terminal-stage transport close in that suffix
and forbids the new field outside AsyncAPI 3.1 revision 7. No OpenAPI corpus or
evaluator meaning changes. Existing C20B mapper/field/framing/FSM predicates
remain the whole-trace oracle; the primary reuses them at the decisive framed
prefix instead of implementing a second HTTP validator.

- PS182 moves its clean post-terminal close from the live timeline into the
  trace suffix; completion and the close specimen are preserved.
- PS186 retains its forbidden 304 body specimen, but now asserts live
  error/completion plus invalid trace, owned by P11/P12/P13.
- PS155 explicitly disconnects with required content absent. End of a peer
  array alone cannot establish truncation or a live terminal.
- M1-28 records the actual peer EOF as an explicit primary disconnect;
  M1-29 retains its extra-byte specimen with separate live/trace expectations.
- No case identity is removed. Pending/open prefixes cannot satisfy a portable
  terminal expectation; they remain incomplete evidence, not a fourth accepted
  trace status or a portable response error.
- Review added PS238–240: malformed final before cancellation, valid
  `Connection: close` with immutable completion before trace-only close, and
  invalid Connection semantics before acknowledgement/cancellation. Head-local
  admission now projects the shared C20B rules, deferring only missing future
  lifecycle/body evidence, not locally decisive field/framing failures. Every
  trace-bearing alternative explicitly cites P13; owner deletion is rejected.

## Independent runtime proof

The Go executable uses its one HTTP parser/framing path and emits private NDJSON
terminal telemetry at completion, before reading any next octet. A separate
finite-trace report follows. The runner checks exactly one terminal and exact
immutability between that notification and the report. Neither notification nor
trace is a new public binding-invoker operation or an OBI output value.

The live peer withholds EOF until the runner receives that terminal. This
causal barrier, not a latency threshold, proves prompt completion. Real peer
bytes/connections are checked independently. Late and coalesced extra octets,
second finals, split writes, interim/final responses, cancellation before and
after completion, and decisive-error suffixes preserve the relevant boundary.
The original 55 wire cases remain; 50 R3 cases bring the selected suite to 105.
The 181 primary and 22 independent synthesis corpus cases remain required.

RFC 9110 media grammar is checked over raw scalar field text before standard
MIME base-type parsing. This prevents MIME's permissive whitespace around `=`
from widening the HTTP grammar, while admitting optional empty members and
syntactically valid duplicates that MIME parameter interpretation can reject.
Parameters are not decoded or interpreted in this no-Reply profile. Twenty-one
literal parser partitions run in Go tests and through real HTTP peers; Go tests
also reject invalid UTF-8. Canonical Content-Length above the standard parser's
int64 capacity is explicitly an apparatus limit, not a field grammar failure.

The original witness failed the frozen open-connection tests for all five
framing classes and failed five media grammar partitions. Those exact tests
passed after repair. The focused qualification suite also rejects removed or
changed trace status/suffix, legacy-format smuggling, duplicate/non-native/
wrong-stage suffixes and incomplete prefixes posing as completed results.

Fourteen registered semantic mutants cover the retained R1/R2 behavior plus raw
media grammar, 304 metadata mistaken for body framing, premature framing, and
retroactive terminal rewriting, missing length and invalid Connection before
cancellation. Mutants still require named assertions and
expected wrong values. A first media mutant failed compilation because it
removed the last UTF-8 import use: the runner correctly reported infrastructure
error, not a kill; the corrected one preserves the import and changes only the
intended grammar guard.

## Scope and remaining work

Core §6 owns observable meaning; private telemetry is not a Core or public SDK
API extension. Interfaces terminal rules were checked for correspondence but
are not claimed as adopted by this executable. No dependency, production client,
adapter, release or project-policy changes are included. The external R3
expectation/decision records and final snapshot bind the five alignment layers.

The witness remains intentionally bounded: object carriage, selected local
references, one count-1 cancellation barrier, loopback cleartext only, finite
trace observation, three-second apparatus deadline, 64-KiB heads, 32 heads and
one-MiB content. Apparatus exhaustion cannot qualify a semantic result. R5 must
qualify broader common behavior using suitable implementations. R4 evidence
admission/readiness remains unsafe for promotion; R6 edition work, R7 repaired
packet acceptance and parent M2–M12 are not closed here.
