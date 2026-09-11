# R1/R2 corrective packet

Status: implementation and execution checkpoint; non-authoring acceptance
review outstanding. No feature-register entry is promoted. This does not
replace or retroactively modify the historical M1a acceptance record.

## Changed behavior

- G08: full C21 primary selection includes SS-28/29, using the evaluator's
  actual capability predicate checked against a separately locked 178-ID set
  (177 reviewed baseline cases plus direct S03 regression SS-75).
  Required missing/duplicate/extra identities fail; filtered runs are explicitly
  partial. Corpus evaluator semantics are unchanged by the predicate extraction.
- G09: mutant kills require a named semantic assertion and the expected wrong
  value after a successful control. No-op and infrastructure negative controls
  qualify the verdict mechanism. Deadline/head-size exhaustion is apparatus
  failure rather than a protocol result. Runner JSON/child-process failures
  cannot become valid semantic kills.
- G01: the witness now enforces required Info strings and global root map
  shapes at load, with refused synthesis/no generated artifacts and no traffic.
  It does not over-reject empty title/version strings.
- G02: an invalid action produces target-scope ASYNC31-S-02 coverage at its
  actual Operation owner. Direct and local referenced invalid operations are
  tested alongside an unaffected represented sibling. Valid `send` remains an
  excluded profile cell; it is not mislabeled upstream-invalid.
- G03: bracketed IPv4 is rejected without losing admitted IPv6 or IPvFuture
  spellings. Processing and synthesis continue to use one witness inventory.

## Reproduction and evidence

R0 froze requirements before repairs. `witness/go/gaps_test.go` was run against
the original Go witness and failed on the actual load, owner and bracketed-IP
defects, then passed after repair. Table-driven checks preserve valid controls,
authored owner identity, sibling confinement and zero generated ghosts.

The ordinary runner retains all 45 original wire cases and adds ten literal
R2 refusal probes in `witness/gap-cases.json`. A live local peer checks zero
connections and request bytes; the primary is separately compared with the
same frozen required outcomes. Literal represented/excluded synthesis and
the original 21 supported synthesis corpus cases remain required. Review added
one D04 bracketed-IPv4 negative and SS-75's exact S03 exclusion/no-ghost result,
also run through the witness, bringing the supported synthesis corpus to 22.
An additional literal invalid-owner/represented-sibling synthesis result is
checked against both implementations without deriving one from the other.

Eight semantic mutations exercise method, caller input, forbidden success
content, synthesized input, envelope admission, action classification, bracketed
IPv4 and exact S02 owner identity. The owner mutant corrupts the actual emitted
sourceRef and must fail the named synthesis-coverage assertion. Records include
source path/digest, exact match/offset/cardinality, replacement/digest and owning
rules. A real failed Go compilation passes through the infrastructure classifier.
Runner qualification also exercises wrong assertion, wrong actual value,
untagged assertion, malformed exchange, missing executable, timeout and other
infrastructure classes. Some infrastructure classes are injected unit probes,
not claims that each operating-system failure was reproduced on a live peer.

## Scope and alignment

This restores existing candidate §§3–5 behavior; it does not edit normative
meaning, the public SDK/interface contracts, dependencies, security policy or
release machinery. The standalone Go witness remains independent of primary
implementation helpers and expected outcomes. Shared-contract implementation
acceptance is not applicable to this private apparatus; real-client R5 packets
must qualify their own adopted interfaces. Core/B-02 family completeness is
still a separate gate, not established by these witness results.

The five-layer R0 alignment checklist, source-policy digests, exact execution
commands and subject manifest are recorded in the external audit checkpoint.
Applicability, architecture and evidence decisions have not yet received the
required non-authoring reviews. Passing tests are not accepted feature cells.

## Remaining gates

G04/G05 (open-connection completion and full media grammar), R4 acceptance
evidence/readiness hardening, R5 common behavior, R6 edition decisions, R7
review and parent M2–M12 remain open. Before resolving G04, obtain a maintainer
ruling on irrevocable live completion versus retrospective total-trace
invalidity. Checking only bytes already buffered is not a sound replacement
for that decision because it makes the result depend on TCP scheduling.

Existing non-admission of MQTT5/Kafka is unchanged. No commit, publication,
release, public API addition or new review agent is commissioned by this packet.
