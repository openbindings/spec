# OpenAPI family text-clarification maintenance — 2026-10-05

This maintenance follows a full cold foundation audit of all four candidates.
It repairs three wording boundaries and adds an informative worked example.
The existing probe interpretations and expectations are unchanged; only their
exact-text pins change. This is a maintenance replay, not a new independent
implementation or full adapter qualification.

## Repairs

- §4 distinguishes excluded parameter projections from runtime capability,
  context and value-dependent failures. The latter never change parameter keys.
- §8 includes artifact-encoded strings in its media table and explicitly applies
  its character-encoding rules to that text even under non-character media.
  The existing JSON, raw-octet and sequential precedence rules still apply.
- §9 in 3.x names authentication scheme names as case-insensitive and preserves
  credential values. The 2.0 wording already limits the freedom to scheme spelling.
- The shared [value-flow example](../../binding-specs/openapi-value-flow.md)
  traces source/binding content, `each/up`, absent versus null members, a native
  JSON request, mapped output and completion cases. It adds no normative rules.

## Exact text revisions

All prior reduction/audit hashes remain historical evidence for their own bytes.
The current replay uses these hashes of the canonical normative texts:

| Edition | Before clarification | Current |
| --- | --- | --- |
| 2.0 | `397afbf81fec6e41d279e7e47e5b7f52558d1ec1dacca63e3221cb0f52842b8d` | `18d3ca4238a387d576464aa743c346498104fb55c30634c6b523187cbf501b1a` |
| 3.0 | `67f430824f51be10bcffb4c801fb387b4b65ba3c69c8cef8554524db7812600a` | `0761b376c9c978eeb0836b1be7a2ae3434fd53dcc1fd00bb7739d45c8d42f8a4` |
| 3.1 | `92896520b7726c577186ecf0e7a0a5064c9c61867d6343baf60ea1c3eb5bd7a0` | `71740a12de79325a90b132d91c080910f68c59f21c3d2f812b82d5b44960c5b3` |
| 3.2 | `47ebae7d9a13274c639c22932025c2e3b3b609e3c2d47085b4131aaf6dcec4c8` | `1105086f6b0acf82766918e5c0a77b9ab1121ea75bbdc1990b721ec6d1e28c99` |

Core remains byte-identical at SHA-256
`afaa04552f5330db6baa13deeb0516d8df0698ae57be26301e2f4bdd341dc1b5`.
The incorporated authorities, admitted editions and unpublished status are unchanged.

## Validation

| Command | Result |
| --- | --- |
| `node scripts/verify-openapi-20-kind.mjs` | 182 cases passed, native loopback HTTP and core fixture shapes |
| `node scripts/verify-openapi-30-kind.mjs` | 319 checks passed, native loopback HTTP and core fixture shapes |
| `node scripts/verify-openapi-31-kind.mjs` | 310 checks passed, native loopback HTTP and core fixture shapes |
| `node scripts/verify-openapi-32-kind.mjs` | 74 test methods passed, no failures/errors/skips; native loopback HTTP and core fixture shapes |

The example's four JSON blocks were parsed and assembled into a complete OBI for
structural validation against the current core schema. Its input/output mappings,
prepared native URL/headers/body, and every nearby-case row were checked through
the existing 3.1 probe without sending an HTTP request. Publication verification
against the parent revision confirms that no immutable bundle or published
identifier changed.

These replays retain the suites' documented limits. They do not newly prove every
combination suggested by the clarified prose, such as all capability-dependent
parameter cases or every charset. No production SDK, client or interpreter
algorithm was changed, and no general implementation-support claim is added.
