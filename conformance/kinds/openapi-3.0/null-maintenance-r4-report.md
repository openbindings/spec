# OpenAPI 3.0 public r4 null-correspondence maintenance

**319/319 checks pass in full offline and native reruns**, against candidate `67f430824f51be10bcffb4c801fb387b4b65ba3c69c8cef8554524db7812600a` and unchanged core `afaa04552f5330db6baa13deeb0516d8df0698ae57be26301e2f4bdd341dc1b5`. Native counts: 186 fixture interactions, 188 actual dispatches, 22 artifact acquisitions, 116 predispatch refusals, and 372 rejected completion-oracle mutants. There are 302 complete OBI fixtures plus the 17 existing focused checks.

This is the new maintainer's update to an existing independently authored interpreter. The complete public r4 candidate was read, and expectations recorded in the separate development evidence, before implementation changes. Previous r2/r3 sources and result hashes are preserved in the local development record; repository history retains the initial integrated suite. No new fresh-origin claim is made.

Added **53 cases**, all passing: required/optional null under explicit/default JSON and +json; URL-encoded whole arrays versus multipart repeated parts retaining null item order; whole null array-declared properties as one value; non-JSON optional omission/required refusal/item refusal; raw, numeric and boolean null without invented spellings; media choice; absent property; null whole body; URL-encoded style undefined values; and 3.0 multipart's ignored style controls. The native oracle checks independently authored form values and part octets. Every refusal checks zero operation dispatch.

One previous expectation was revised to the new public text: a supplied null property under a wildcard media declaration now needs a concrete media choice before deciding correspondence. An absent optional property still needs no choice. The interpreter now selects media before null handling, permits JSON null, expands only actual arrays, and refuses unrepresentable required/item null instead of eliding it.

The 15 source-fragment cases remain included and pass natively. Exact r4 text is saved in `candidate-pinned-r4.md`; full observations and expanded OBIs are in the normal results/fixtures. No ambiguity witness was established in this bounded revision. Existing README limits remain: partial schema/URI/media/runtime support, no full kind/core conformance claim, no exhaustive coverage claim.

Final maintenance also asserts the selected multipart Content-Type independently
(application/json or application/example+json). Both full modes were rerun with
all 319 checks passing and unchanged interaction counts.
