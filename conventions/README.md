# OpenBindings Tooling Conventions

This directory contains versioned, machine-verifiable contracts for optional OpenBindings ecosystem behaviors used by the **official OpenBindings tooling** (`ob` CLI, `openbindings-go`, and `openbindings-ts`).

## What this is

The spec at `../openbindings.md` defines what an OBI document is and the structural rules every implementation must enforce. It deliberately leaves several behaviors tool-defined: comparison semantics, matching strategies, security resolution, transform runtime policy (sandboxing, error handling, resource limits), and similar choices that reasonable tools may answer differently. (The spec does define the transform evaluation language itself -- JSONata 2.0 -- for Invoking-class tools; what's tool-defined is the surrounding runtime.)

These conventions are non-normative for core OpenBindings spec conformance, but normative for tools that claim support for a named convention, profile, catalog, or report format published here. The official tooling is expected to follow them. Third-party tools may ignore them and still be core-spec-conformant; if a third-party tool claims support for a convention such as `OB-2020-12`, `OB-catalog v1`, or `ob-comparison-report/v1`, it is expected to satisfy the schemas and fixtures published here.

## What this is not

These conventions are not part of the core spec. Conformance to them is not required for an implementation to be a conforming OpenBindings tool per `OBI-T-##`. Tools may answer the same tool-defined questions differently and still be fully core-spec-conformant, as long as they do not claim support for the convention/profile/catalog/report format defined here.

The directory is also not pre-committing to anything that doesn't have a real use case yet: no third-party vendor extension surfaces, no certification artifacts, no migration scaffolding for non-existent prior consumers, no multi-tenant policy override system. Those can land here when use cases arrive.

## Layout

```
conventions/
  README.md                   (this file)
  comparison.md               (comparison analysis convention — main entry point)
  subsumption-profile.md      (the OB-2020-12 subsumption profile, used by comparison)
  findings.md                 (kind catalog with descriptions, severities, categories)
  findings.yaml               (machine-readable catalog; SDK code-generation input)
  schemas/
    fixture.schema.json       (JSON Schema for a single comparison-fixture file)
    findings.schema.json      (JSON Schema for findings.yaml)
    report.schema.json        (JSON Schema for ComparisonReport)
  scripts/
    verify-catalog.mjs        (CI gate: validates findings.yaml ↔ findings.md)
    verify-comparison-corpus.mjs
                               (CI gate: validates comparison fixtures and manifest)
    package.json              (script dependencies)
```

The comparison fixture corpus lives at the repository root under `../conformance/comparison/`, alongside the spec-level conformance fixtures.

## Versioning

- Comparison convention: **v1** (paired with report `format_version: ob-comparison-report/v1`).
- Subsumption profile: **OB-2020-12** (versioned by name plus a corpus-sha computed over the fixture set).
- Catalog: **v1** (advances independently of the convention).

Future conventions (matching, security resolution, transform runtime policy, drift) land here as separate documents alongside `comparison.md` when their implementations need a testable contract.
