# Independent 3.1 evidence maintenance, public r5

**310/310 checks pass in both actual loopback HTTP and in-memory debug modes.**
Native execution records 31 artifact acquisitions and 168 operation dispatches.
The executed directory contains 188 complete OBIs: 167 independently observed
request fixtures and 21 additional complete refusal fixtures. The test count
also includes focused interpreter/completion/oracle checks; it is not an HTTP
request count.

This is a new maintainer's update to an existing independently authored probe,
not a fresh-origin claim. The full public text and unchanged current core were
read, and source-fragment/null expectations recorded before implementation edits.
No prior SDK, corpus, reviewer report, author rationale, or sibling interpreter
was used. Exact current pins:

- Candidate r5: `92896520b7726c577186ecf0e7a0a5064c9c61867d6343baf60ea1c3eb5bd7a0`.
- Core: `afaa04552f5330db6baa13deeb0516d8df0698ae57be26301e2f4bdd341dc1b5`.

The 16 fragment checks refuse nonempty fragments for acquired and embedded
object/text sources before any acquisition or dispatch, strip an empty fragment
before retrieval/resource registration, and observe contributing-document
references, relative servers, redirects, encoded `#` in URI path/query, and the
separation of schema `$id` from physical server bases. Nine negative cases record
zero artifact requests and zero dispatches. Positive expectations contain exact
resolver URLs, resource registrations, native acquisition paths, and operation
paths authored independently of the resolver.

The 53 null behavior checks cover required/optional explicit/default JSON,
`+json`, whole-array-property null, ordered null array items, URL-encoded whole
arrays, multipart repeats, text/raw optional omission versus required/item
refusal, supplied-null media selection, absent-property behavior, and null whole
form body. Twelve refusals dispatch nothing. JSON values are decoded by the
independent oracle, and multipart selected Content-Type is checked separately.
3.1 style-based URL-encoded and multipart/form-data null behavior is unchanged;
multipart/mixed ignores style controls. One additional oracle test rejects three
meaning mutations: omission, JSON string `"null"`, and an empty value.

Only minimal source-location validation/normalization and content-null handling
changed in the interpreter. Native request expectations import no serializer or
schema inspection helpers. The final successful run followed a stronger multipart
media assertion. The empty-value mutation initially raised a JSON
parse error rather than an assertion; the harness now treats either as a detected
invalid observation.

Previous r3 native and r4 offline evidence remains in the separate local
working record; repository history retains the original integrated suite. The
r4 stage was offline-only and is not claimed as native evidence. Current complete
fixtures, observations and exact pins are reproduced by this suite.

No ambiguity witness was established by these bounded cases. Existing README
limits remain: no full core/schema validation, complete reference graph/dynamic
scope, exhaustive media grammar, arbitrary authentication, invocation redirect,
TLS/HTTP2/3, streaming, or general SDK claim. This follow-up specifically proves
the exercised acquisition, invocation, and refusal observations; untested
combinations remain unproved.
