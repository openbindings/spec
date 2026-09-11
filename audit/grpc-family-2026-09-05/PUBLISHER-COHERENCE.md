# Publisher coherence

## Required voice and structure

The gRPC document uses the mature OpenAPI cadence:

1. identifier and rule labels;
2. scope and incorporated authorities, including exact Core 0.2.0 and the
   OBI-B-02 discharge map;
3. source carriage and refusal architecture;
4. `location`, `content`, and composition;
5. descriptor construction and resolution;
6. selector;
7. target and all four interactions;
8. Protobuf operation-value correspondence;
9. gRPC request, framing, metadata, compression, deadline, response, and
   status mechanics;
10. target, HTTP/2, and TLS;
11. credentials and transform positions;
12. configuration, synthesis, atomic conformance rules, permitted variation,
    exclusions, and limits;
13. normative references.

Every normative paragraph and normative table row carries exactly one visible
label: `[incorporated]`, `[pin]`, `[convention]`, `[configuration point]`,
`[exclusion]`, or `[limit]`. Informative summaries and evidence maps say that
they are informative.

## Cross-project module

The shared Protobuf correspondence is a first-class immutable companion module
with identifier `openbindings.module.protobuf-correspondence@1`, a recorded
digest, permanent human and raw URLs, stable module-rule labels, and full
provenance discipline. It is explicitly not a legal `bindingSpec` value. Every
consumer records the exact module identifier and digest; each publication
bundle archives that exact module, and latest-mirror verification checks the
complete closure rather than only the binding Markdown. A later Connect
publication cannot silently capture different bytes under the same module
identifier.

Connect must cite the module rather than treating the whole gRPC transport
specification as its schema authority. Any affected Connect rules/evidence are
updated in the same pre-publication batch.

## Publisher hardening

Before publication tooling may mint gRPC `@1`, it must:

- require the exact publication-state sentence shared by gRPC, the Protobuf
  module, and Connect; preparation and promotion are byte-preserving, and only
  the publication-manifest entry establishes an immutable identifier;
- enforce exact Core-version declaration and bundle closure for every mature
  project family, not only OpenAPI;
- include normative modules in the immutable bundle and digest manifest;
- require complete D/P/S rule closure and exact semantic-apparatus roots;
- refuse a publication if either language adapter did not execute the exact
  corpus snapshot;
- preserve append-only publication and errata behavior.

The final stopping review runs over the exact byte-preserved defining files and
staged manifest transaction to be minted. Its machine-readable adjudication
records cohort, HEAD, complete snapshot digest, module/corpus/apparatus roots,
exact Go and TypeScript executions, every reviewer verdict, and zero unresolved
P0-P2. The publisher verifies those fields against its inputs and records the
adjudication digest in `publications.json`; mere existence of a path is not
enough.

## Comparator snapshots

The content-complete but still unreleased OpenAPI family at commit `c5cbec60…` is the stable voice
comparator. The AsyncAPI comparator must be an exact independently accepted
snapshot recorded at review time; a moving dirty worktree cannot be cited as
organizational precedent.
