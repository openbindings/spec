# temp_ref — TEMPORARY reference material (delete before release)

This directory is **not part of the spec** and **must be deleted** before the
0.2.0 docs/site release. It holds harvested copies of ancillary documents that
were removed or are being rewritten from scratch during the 0.2.0 docs overhaul,
kept only as reference while the new docs are written.

Harvested here (originals removed from their live locations in a later step):

- `README.md` — the old repo front door (to be rewritten).
- `guides/` — the old guide set (to be rewritten / re-scoped).
- `ROLE-REVIEW.md` — a dated internal role-review artifact (cut outright).
- `conventions/` + `conformance-comparison/` — the comparison / subsumption / findings convention body and its fixture corpus. To be **republished as a neutral community convention** (compatibility semantics + finding vocabulary + report schema) on the site, with the `ob`-specific CLI surface (flags, exit codes, SARIF rendering) moving to the `ob` repo. Removed from the spec repo because the core spec defers comparison to tools; preserved here until republished, then delete.

Nothing in here is authoritative. The authoritative sources are
`openbindings.md`, the JSON Schemas, `formats/`, `conformance/`, and the role
contracts under `interfaces/*/0.1.json`. When the new docs are complete, run
`git rm -r temp_ref/`.
