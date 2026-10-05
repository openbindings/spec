# Independent OpenAPI 2.0 bounded executable evidence

**2026-10-05 maintenance:** the current pin includes the bounded text
clarifications recorded in [the family maintenance note](../openapi-text-clarifications.md).
The independence narrative below describes the original suite authorship; this
maintenance replay is not a new independent implementation.

This directory is fresh interpretation evidence for the public, unreleased `openbindings.openapi-2.0@1` candidate. It is **not a production SDK, full kind conformance claim, full OAS validator, or publication verdict**.

Final result: **182/182 cases pass**, comprising 92 successful interactions, 75 failures before dispatch, and 15 failures after dispatch. The primary suite observed 109 real HTTP service requests and 14 real HTTP artifact acquisitions. Five cases use newly synthesized complete current-core OBIs. Four deliberately incorrect semantic mutations were detected, and three permitted wire variations passed.

## Exact authority pins and independence

The final run applied these bytes:

| Authority | SHA-256 |
| --- | --- |
| Current clarified candidate | `18d3ca4238a387d576464aa743c346498104fb55c30634c6b523187cbf501b1a` |
| Current core `openbindings.md` | `afaa04552f5330db6baa13deeb0516d8df0698ae57be26301e2f4bdd341dc1b5` |
| Project policy | `b580affc92223d5f0e75d66d17363c8befa1951ed7c4c8ad825a8470dd7a0b3c` |

Initial interpretation began from candidate r1 `c112468784fff85d38c020108cbe8c1c6851d272fe6b93e3f07575ab1347151b`. The complete revised public text was read after notification of r2. Source-fragment handling, duplicate/overlapping media declarations, and multipart permitted defaults were re-derived from that public revision before the final run. The final run refuses a differing candidate/core/policy hash. It stores the exact candidate in `candidate-pinned.md`; the current core and policy remain canonical in this repository. `pins.json` records both revisions.

This agent read only the allowed public candidate, its current core and project policy, and incorporated primary authorities. It did not read historical binding specs, corpora, SDK implementations, sibling candidates/probes, author notes, or reviews. No implementation code was copied from other work. No subagents were used.

Primary authority pages consulted:

- [OpenAPI 2.0](https://spec.openapis.org/oas/v2.0.html), especially parameter, Items, Schema, Response, and Security Objects.
- [JSON Reference draft-03](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03), [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901), and [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986.html).
- [YAML 1.2.2](https://yaml.org/spec/1.2.2/) Core representation rules.
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), [RFC 4648](https://www.rfc-editor.org/rfc/rfc4648.html), [RFC 7578](https://www.rfc-editor.org/rfc/rfc7578.html), and [RFC 7303](https://www.rfc-editor.org/rfc/rfc7303.html).
- [RFC 7617](https://www.rfc-editor.org/rfc/rfc7617.html) and [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html).

## Reproduction and files

Run from this directory with Python 3.13 and Ruby/Psych:

```sh
python3 run.py
```

Execution needs permission to bind/connect temporary `127.0.0.1` HTTP ports. The runner contacts no external service. Both servers shut down at the end. Port numbers are substituted before writing the full fixtures. The final recorded run used Python 3.13.7 and Ruby 2.6.10.

- `interpreter.py`: freshly authored bounded interpreter; it has no dependency on the native oracle or expected results.
- `yaml_ast.rb`: Psych syntax AST only. Python applies the YAML Core scalar interpretation, so Psych's YAML 1.1 resolver is not used.
- `native_oracle.py`: independent HTTP fixture and native semantic checks; imports no interpreter or synthesizer functions.
- `cases.py`: hand-authored inputs, response plans, and native expectations, plus synthesis inputs. Factories reduce repetition only.
- `synthesize.py`: deliberately narrow synthesis from an explicitly shared OAS/current-core schema subset. No encoder/oracle imports.
- `expanded-cases.json`: every complete OBI, input/context, source retrieval artifact, native expected request, and response plan, with the actual loopback addresses for the final run.
- `obis/`: 182 standalone complete OBI JSON documents, including the five synthesized documents. These are not fragments or diffs.
- `results.json`: result categories, observed native requests with body octets, and acquisition logs for every case.
- `mutation-results.json`, `permitted-variation-results.json`, `synthesis-refusals.json`: separate evidence for those claims.
- `summary.json` and `pins.json`: counts and exact public authority hashes.

## Independent observation

The interpreter sends bytes through a real TCP connection. The native server records method, target, header field lines, and body octets. The oracle checks those observations using separate stdlib parsing of JSON, query/form pairs, MIME multipart, and content codings. Expected path data, query groups, payload values, and file octets are authored literals; the oracle never calls request encoder, media selector, mapper, resolver, or decoder helpers from the interpreter.

All 75 predispatch-negative cases expect an empty native request log, in addition to the expected failure category. Artifact acquisition is logged separately and does not count as invocation. Each positive response is an independently specified native representation; it is not generated by the interpreter's decoder or by reflecting the request. Output failures emit no values.

The five synthesized OBIs use string, integer, boolean, array, and object contracts from a deliberately small shared vocabulary. Their caller-facing schemas are independently compared with expected current-core structures; values are checked separately against that supported schema subset; and invocation is checked at the native server. This is stronger than serializing and reading the synthesizer's own output. Three unsupported schema translation requests, including draft-04 boolean `exclusiveMinimum`, are refused rather than claimed faithful.

Hand-authored operation contracts deliberately use a singleton `const` for present probe inputs/outputs, or `false` where no value is supplied/emitted. This makes each OBI complete without inventing a broad application contract the fixture cannot justify. Absence remains distinct from JSON null. No general core conformance verdict is asserted; the independent operation checker covers only the explicitly used current-core subset.

## Coverage

| Area | Executed evidence |
| --- | --- |
| Source forms | Object, JSON text, YAML text, each with/without `location`; location-only JSON/YAML; UTF-16 BOM retrieval; redirected acquisition; all invalid presence/type modes; fragments; HTTP 404 and policy denial |
| References | Self-contained parameter references; ignored siblings; external mounted Path Item, external Schema and Response closure; source retrieval provenance; entry-root URL/media/security inheritance; unrelated broken material; missing base/resource; used-field collisions |
| Mapping | Every form; nested `each`/`up` with two enclosing scopes; literals/null; object omission; empty collection; illegal scopes; absence at empty pointer; input and output failures |
| OAS 2.0 schema inspection | Type unions and `allOf` intersections; empty intersection; typeless/non-string character refusal; ignored later keywords; resolved deep `readOnly` under properties/items/additionalProperties; required/readOnly contradiction; absent optional enclosing object; consuming recursive schema |
| Parameters and URL | Every location; repeated path expression; qualified names; path/query UTF-8 reserved data; all five collection formats; empty/null/absent; delimiter refusal; nested-array refusal; identity overrides/duplicates; unknown envelope keys; default non-insertion; transport-owned and case-colliding headers; raw UTF-8 headers; ordinary Authorization/Accept/Cookie |
| Forms, files, media | URL-encoded newline/space/plus preservation; multipart exact named parts and file octets, no filename; byte vs binary; canonical Base64 pad bits; body meaning across all seven methods; context selection; empty/duplicate/overlapping media lists; parameter matching; gzip/deflate request stack |
| Context/security | Complete server replacement; scheme choice; missing credentials/conversion; Basic, OAuth bearer, query/header API key through mounted root; OR/AND/anonymous/overrides; malformed alternatives; optional collision; required collision removes only dependent alternative; transport-owned credential destinations |
| Unary completion | JSON null/array, BOM/duplicate names, exact numeric limits; empty/HEAD/204; forbidden actual 204 content; exact/default response choice; unusable exact does not fall through; non-2xx diagnostic body never output; interim/final; 101; malformed/truncated representation; media mismatch/multiple Content-Type; raw/file/event-stream/XML; coding stack and case-equivalent inline header enums |
| Lifecycle | Method/body-preserving redirect; rewriting redirect ends interaction; cross-origin Authorization/Cookie stripping and no query-key reappend; cancellation before dispatch; local abandonment after response with no output |
| Synthesis | Five full current-core OBIs natively invoked and independently checked; three conservative translation refusals |

The source-form matrix covers all permitted **member/type combinations**, not all YAML productions, URI schemes, media types, or source documents.

## Mutation and permitted-variation checks

Four corrupted implementations were executed against the same native expectations, and all were caught:

1. Change encoded `/` inside a path parameter into a structural path separator.
2. Drop a supplied JSON body member.
3. Reverse repeated query-array contributions.
4. Substitute JSON null for an absent operation output.

Three valid implementation choices also execute through the native server and pass:

1. Reorder distinct query parameter groups while retaining each array's order, and use lowercase percent-triplet hex.
2. Encode a URL-encoded form SPACE as `%20` instead of `+`.
3. Omit redundant non-file `text/plain; charset=UTF-8` part headers for ASCII text whose RFC 7578 default interpretation is identical. The native oracle compares interpreted text/octet meaning, not those redundant header bytes.

Other permitted variation is exercised by the primary cases, including JSON whitespace/duplicate-name semantics, a generated multipart boundary replacing the declared boundary, and repeated/overlapping media declarations sharing one correspondence.

## Bounds and unresolved coverage

No normative ambiguity witness was found in the exercised cases. That statement is bounded evidence, not proof that the candidate has no ambiguity.

The interpreter claims support only for the enumerated fixture domain. It is intentionally insufficient as a general kind implementation:

- Native transport/resolver policy is loopback HTTP only, with 2 MiB limits and three preserving redirects. TLS, non-HTTP URI resolvers, URI edge grammars/IDNA, authentication acquisition, arbitrary proxies, streaming backpressure, and external network policy are not exercised.
- The native transport uses connection-close/Content-Length framing; chunked transfer is explicitly reported as an unsupported capability. Interim 100 is exercised; exhaustive HTTP framing and invalid wire syntax are outside scope.
- Source syntax uses Ruby/Psych's parser as a syntax frontend. YAML aliases are explicitly unsupported; the suite is not a YAML 1.2.2 parser conformance suite. Retrieval UTF-16 BOM is exercised; all encoding detection permutations are not.
- JSON integers use arbitrary-precision Python integers. Decimal spellings are accepted only when conversion followed by the implementation's decimal spelling preserves the mathematical value; other values produce a capability limit. Arbitrary decimal fidelity, all extreme exponents, and every numerical boundary are not claimed.
- Character codecs are bounded to UTF-8, UTF-16 variants, and ASCII. XML stays text; entities are never expanded. Exhaustive XML declaration/signature conflicts and arbitrary charsets are not tested.
- Gzip and deflate are implemented; other codings fail. Multipart transfer encodings and every legal name/quoting/preamble/epilogue variant are not exercised.
- Schema work is the kind's finite declaration/presence/readOnly inspection, not schema satisfiability, runtime validation of all assertions, or a full OAS-to-current-core translation. Pure non-consuming reference cycles return a capability limit. All unsupported and malformed schemas outside the enumerated domain are not comprehensively classified.
- The OBI runner supports one binding and operation per probe and checks a narrow current-core value subset. It does not establish every core document rule, global alias semantics, or arbitrary core schema reference semantics.
- Cancellation cases demonstrate this harness's local before-dispatch and after-response policies; arbitrary mid-read cancellation scheduling, retries, rollback, and distributed effects are not claimed.
- The suite provides no exhaustive coverage claim for every OAS declaration or legal media/security alternative. In particular, full OAuth scheme validation, optional/required alternatives in all combinations, Path Item multi-hop edge cases, and every header grammar are beyond this run.

## Audit notes

The first native run found one incorrect expected path: the author had counted three slashes where the candidate's exact-one-removal rule requires two. The observed request was `/api//a//b`; the expectation was corrected from `/api///a//b`, with no interpreter change for that case. The final result is the complete rerun after that correction and r2 additions.

The first loopback approval attempt failed because automatic approval review was at capacity. Retrying the same localhost-only request succeeded; no approval check was bypassed. All service traffic remained on loopback and all writes remained within this assigned evidence directory.

## Repository integration

Run `node scripts/verify-openapi-20-kind.mjs` from the repository root. It runs
the full native suite and structurally validates every generated complete OBI
against the current core schema. `run.py` honors `SPEC_ROOT`, defaulting to this
repository root, and hashes the canonical candidate, core and project policy.
Generated fixtures, snapshots and results are reproducible ignored outputs.
Integration changes file lookup and packaging only; the interpreter, separate
native oracle, cases and bounded synthesizer are unchanged from the independent
run. The original development provenance and limitations above remain applicable.
