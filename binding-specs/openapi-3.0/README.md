# OpenAPI 3.0 kind candidate

[openbindings.openapi-3.0.md](openbindings.openapi-3.0.md) is the unreleased
candidate for `openbindings.openapi-3.0@1`. This page is informative and adds no
requirements.

## Publication completeness

| [PB-02](../PROJECT-POLICY.md#pb-02-publication-completeness) item | Where the candidate answers it |
| --- | --- |
| 1. Artifact, representations and editions | §1, §2 |
| 2. Address interpretation and acquisition | §2 |
| 3. Source content and absence | §2 |
| 4. Composition and bases | §2, §3 |
| 5. Target and binding content | §3 |
| 6. Interaction and lifecycle | §4, §6 |
| 7. Value correspondence, success, failure and runtime choices | §§4 to 7, §9 |

## Migration from pre-kind drafts

| Earlier draft | Candidate |
| --- | --- |
| `source.bindingSpec` | `source.kind` |
| An OAS object or string as `source.content` | `source.content.document` |
| Top-level `source.location` | `source.content.location` |
| `binding.selector: "#/paths/..."` | `binding.content.target: "/paths/..."`, a string-form JSON Pointer without `#` |
| Core `inputTransform` and `outputTransform` | `binding.content.input` and `output`, JSONata expressions; `failure` maps a non-2xx response into an output |
