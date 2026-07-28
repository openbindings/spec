# OpenBindings Loop Harness

Corpus-driven refusal telemetry for the development loop (see `development-loop.md`).
Family-agnostic: adding a family means adding an adapter in `worker.mjs`, nothing else.

## Design invariants

- **No silent caps.** Every bound (size deferral, time cap, heap cap, sampling stride)
  is a counted disposition in the output, never a silent skip.
- **Per-artifact subprocess isolation.** A pathological artifact costs one bounded
  subprocess (`--timeout`, `--heap`), not the run. Learned the hard way: unbounded
  in-process runs OOM on cyclic-`$ref` Azure specs.
- **Resume-aware.** Artifacts already present in the output JSONL are not re-run;
  kill and relaunch freely.
- **Termination is computed.** `status.mjs` diffs observed reason codes against the
  adjudicated-codes registry and prints the measured-complete (MC1–MC5) checklist.

## Usage

```sh
# 1. Measure (resumable; runs a deterministic stride sample)
node runner.mjs --corpus ./corpora/apis-guru/api --out ./runs/2026-07-28 --stride 3 --pool 4

# 2. Aggregate the histogram
node aggregate.mjs --run ./runs/2026-07-28

# 3. Check distance to measured-complete
node status.mjs --run ./runs/2026-07-28 --registry ./adjudicated-codes.json
```

`worker.mjs` resolves the family SDK via `@openbindings/openapi` if installed, else
the `OB_OPENAPI_DIST` env var (path to the package's built `index.cjs`).

## Output schema (family-independent)

Per artifact (JSONL): `{artifact, family, outcome, targets, represented,
exclusions:[{ref, status, reasonCode, rule}], alternativeExclusions, requirements}`
with outcomes `synthesized | load_failed | parse_failed | no_adapter |
oversize_deferred | resource_capped`.

Aggregate: artifact/target counters plus histograms keyed by stable reason code and
binding-spec rule, with artifact-affected counts (rank by artifacts unblocked per
unit of work, not raw operation count).

## Corpus provenance

Record source, vintage, and known biases with every run. The reference OpenAPI
corpus is the APIs.guru mirror (`npm i openapi-directory`) — note it is
pre-converted to OAS 3.x and therefore cannot measure Swagger 2.0 prevalence.
