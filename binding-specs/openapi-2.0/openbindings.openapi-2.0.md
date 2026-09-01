# `openbindings.openapi-2.0` Binding Specification

## 1. Identifier and rule labels

**[convention]** The opaque binding-specification identifier has exactly the spelling **`openbindings.openapi-2.0@1`**.

**[incorporated]** Publication mints §1's identifier under Core [OBI-B-01](../../openbindings.md#104-binding-specification-rules), and an incompatible change to the accepted domain or portable meaning requires a different identifier under Core [OBI-B-03](../../openbindings.md#104-binding-specification-rules).

**[incorporated]** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are interpreted as described in [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) only when they appear in all capitals.

**[convention]** Every normative paragraph and normative table row carries one visible provenance label. An `incorporated` rule is one the cited source states, and the citation names that source, whether an incorporated authority or the OpenBindings Core; the remaining five are this specification's own explicitly classified bridge. A `convention` is a choice this specification makes where no authority speaks; a `pin` fixes one reading of an ambiguous or versioned authority; a `configuration point` names a decision deferred to the consumer; an `exclusion` removes something from the accepted surface behind a stated reopen trigger; a `limit` states a boundary this specification does not cross.

## 2. Scope and incorporated authorities

**[convention]** This binding specification defines how OpenAPI 2.0 artifacts govern OpenBindings sources: which documents are accepted and when loading refuses, how operation targets are addressed and synthesized, what an invocation's inputs and outputs mean, and which wire mechanics the artifact fixes. It builds on the OpenBindings Core specification (`../../openbindings.md`).

**[convention]** This specification accepts exactly OpenAPI Specification (OAS) edition `2.0`; no `swagger` wildcard or compatible-looking value widens this singleton domain, and a document marked only with a 3.x-style `openapi` field refuses at the `swagger` load gate.

**[incorporated]** The root `swagger` field identifies the OAS edition used by the artifact and MUST have exactly the string value `"2.0"` ([OAS 2.0 Swagger Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields)).

**[convention]** OAS governs the artifact and every HTTP mechanic it declares, including object structure, canonical references, parameters, media declarations, target construction, responses, and security ([OAS 2.0 §6](https://spec.openapis.org/oas/v2.0.html#specification)); [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) governs the remaining HTTP semantics fixed by this binding.

**[convention]** The authorities incorporated under this identifier are exactly those listed in §13, each within a stated boundary: OAS 2.0 for the artifact; the authorities OAS 2.0 itself incorporates, each only where OAS routes to it — YAML 1.2 (1 October 2009) as the serialization language it names and YAML 1.2.2 as §3.1's rendering of that language, JSON Reference draft-03 and RFC 6901 for references, JSON Schema Core and Validation draft-04 for the Schema Object dialect, HTML 4.01 §17.13.4 for form and multipart payload construction, RFC 3339 for date formats, RFC 6838 for media-type spelling; RFC 9110 for HTTP semantics OAS leaves to HTTP, with RFC 3986 for URI syntax, RFC 8259 and RFC 6839 for the JSON lane, RFC 7159 for the JSON image the YAML grammar gate requires, RFC 4648 for the raw-octet boundary, RFC 2046 for character-data carriage and, where RFC 9110 §8.3.3 routes to it, multipart entity syntax, and RFC 7303 for character-data carriage, and RFC 7617 and RFC 6750 for credential construction; and BCP 14 with RFC 8174 for the key words of §1. No authority outside §13 is incorporated, and no authority is consulted in a live or mutable form.

**[pin]** RFC 9110 obsoletes RFC 7231 and governs wherever the two overlap; RFC 7231 is not incorporated under this identifier and no rule below cites it ([RFC 9110 §19.1](https://www.rfc-editor.org/rfc/rfc9110#section-19.1)).

**[pin]** The pinned OAS 2.0 page's Reference Object prose links inline to JSON Reference draft-02 while its bibliography names draft-03; draft-03 governs every OAS JSON Reference use under this identifier, the inline draft-02 link is treated as an upstream citation defect, and the differences between the two drafts are immaterial to draft-03 §§3–4 as used here.

**[incorporated]** This document defines portable binding meaning, not an invocation API: request objects, retry and redirect APIs, cancellation, credential acquisition, and receiver deployment remain runtime or application concerns under Core [§1.2](../../openbindings.md#12-out-of-scope).

The table below maps each item Core [OBI-B-02](../../openbindings.md#104-binding-specification-rules) requires a binding specification to define onto the sections of this document that discharge it. It is a map of this document, not a rule: it states no requirement of its own, and every claim it summarizes is stated normatively in the sections it names. Its rows carry no provenance label for that reason. Item wordings are abbreviated; Core's text governs. The third column names what this specification does not cover at that item: a point at which it states no portable meaning. It does not claim that no rule in this document reaches the surrounding subject.

| OBI-B-02 item (abbreviated) | discharged in | what this specification does not cover there |
| --- | --- | --- |
| 1 — whether a source mode accepts an artifact; the representations accepted; deterministic discrimination among them; the encoding for a non-JSON artifact | §2, §3.1, §3.2, §4, §5.1 | — |
| 2 — the syntax and meaning of `location` | §3.1, §4, §10 | nothing recorded: §4's limit states the acquisition-failure disposition and defers the success condition to the address scheme.  |
| 3 — the accepted values and meaning of `content`, including any source mode in which `content` is forbidden | §3.1, §4 | — |
| 4 — how `location` and `content` compose, including whether `location` supplies a reference base for embedded content | §3.1, §4, §5.1 | — |
| 5 — the syntax and meaning of `selector`, including the absent-`selector` case | §3.2, §5.1, §6, §12.3 | — |
| 6 — how the binding target and its interaction are identified | §3.2, §5.1, §6, §7, §8.1, §8.2, §9.1, §9.4, §10, §11, §12.1, §12.3 | — |
| 7 — how caller-facing input values and successful output values correspond to the interaction, which outcomes are successes, when the interaction instead completes unsuccessfully, how values emitted before that completion are treated, and any context bindings at transform positions | §5.1, §5.2, §7, §8.1, §8.2, §8.3, §9.1, §9.2, §9.3, §9.4, §10, §12.1, §12.2 | — |

**[convention]** Where §2's item map records that a chain is not completed in this revision, that record licenses nothing. It is not a permitted variation, and this specification states no portable meaning there. An implementation may complete such a point locally; that completion is implementation-defined under Core [§6](../../openbindings.md#6-binding-specifications) and is not attributed to this identifier.

**[convention]** Item 5's absent and malformed cases terminate in **OAPI20-D-02** and Core [§10.5](../../openbindings.md#105-verification-conclusions), which make such a binding non-conformant; they have no separate runtime disposition, and that is the whole of the answer this specification gives. Item 2's `location` is additionally read by §10 for the default scheme, host, and port, which is why §10 appears in that row; §4 states the syntax and the retrieval, and §10 states that second role.

**[convention]** Core's OBI-B-02 states a floor rather than a partition, so content this map routes to no item is not thereby surplus. Under this identifier that content is: §1's identifier, key words, and label legend; §2's scope, incorporated-authority list, and the precedence pins the rules below stand on; §3.2's statement that no defect taxonomy is owed, which fixes what a processor must report; §11's credential-construction rules — the `basic` Base64 construction, the `apiKey` destination emission, the `Bearer` carriage, the destination-collision rule, and the destination comparison — which fix wire bytes for a value that is runtime context rather than a caller-facing input or a successful output value, so no item's words reach them; §12.2's synthesis and coverage rules, other than the closed-environment statement item 7's context-bindings clause reaches; §12.3's document, processor, and synthesizer conformance rules, which index rules stated elsewhere, and **OAPI20-D-02**'s verification posture, which indexes Core [§10.5](../../openbindings.md#105-verification-conclusions), together with its statement of the exclusion discipline; and §13's reference list. **OAPI20-D-02** is the one §12.3 rule that is not an index: the consequence of an absent or malformed `selector` is stated nowhere else.

## 3. Source carriage and refusal architecture

### 3.1 Accepted representations

**[convention]** `content` is either the parsed Swagger document object or string content; `location` is an absolute URI for that document; content has primacy, a co-present location supplies its base URI, and the OBI retrieval URI is never that base (Core [§5.4](../../openbindings.md#54-sources), [§7](../../openbindings.md#7-reference-resolution)).

**[incorporated]** The edition represents the artifact as a JSON object conforming to the JSON standards, admits YAML as a superset of JSON for that same representation, and makes every field name case-sensitive ([OAS 2.0 §6.1 Format](https://spec.openapis.org/oas/v2.0.html#format)). The YAML edition it normatively cites is [YAML 1.2, 1 October 2009](https://yaml.org/spec/1.2-old/spec.html) ([OAS 2.0 A.1 Normative references, `[YAML]`](https://spec.openapis.org/oas/v2.0.html#a-1-normative-references)). §6.2 File Structure states no part of this rule and is not cited for it.

**[pin]** As this specification's rendering of that YAML 1.2 language, string content MUST parse as YAML 1.2.2, of which JSON is a subset; duplicate mapping keys, non-scalar-string mapping keys, explicit tags outside YAML's JSON-compatible tag set, resolved values with no RFC 7159 JSON image (`.inf`, `-.inf`, `.nan`), and a multi-document YAML stream refuse at this grammar gate. Exactly one YAML document is accepted ([YAML 1.2.2 §§3.2.1, 10.2.1, 10.3.2](https://yaml.org/spec/1.2.2/), [RFC 7159](https://www.rfc-editor.org/rfc/rfc7159)).

**[pin]** Plain-scalar tag resolution uses YAML 1.2.2's recommended Core schema — the resolution the preceding rule's `.inf`/`.nan` parentheticals already presuppose — and no other resolution schema is consulted ([YAML 1.2.2 §10.3.2](https://yaml.org/spec/1.2.2/#1032-tag-resolution)).

**[pin]** Key resolution differs deliberately from the value resolution the preceding rule pins. The accepted edition is decisive: it represents the artifact as a JSON object conforming to the JSON standards and admits YAML as a superset of JSON for that same representation, so a YAML mapping key is the representation of a JSON member name, which is a string whatever tag resolution would assign the same characters in value position. A plain scalar key therefore never refuses on its resolved type, and an unquoted `200:` Responses key is the string `200`. What refuses at the key gate is a key that is not a scalar at all — a sequence or a mapping in key position — which no representation makes a member name. The asymmetry between key and value resolution is the incorporated edition's and not this specification's; what the edition does not state is the consequence of violating the key gate, which is pinned here ([OAS 2.0 §6.1 Format](https://spec.openapis.org/oas/v2.0.html#format)).

**[pin]** A leading byte-order mark on string content is accepted and consumed by the YAML grammar; it is never part of the document.

**[pin]** **§3.1's retrieval-decoding rule**: whenever this specification obtains a document as octets rather than as an already-decoded string — a location-only source, an elective retrieval, and every secondarily retrieved reference document alike — those octets decode as UTF-8, and neither the retrieval's `Content-Type`, its charset parameter, nor any byte-order mark selects a different decoding. Octets that are not valid UTF-8 do not yield an accepted representation: for the entry artifact that is a refusal at load at the accepted-representation grammar gate, and for a secondarily retrieved document it is the unresolvable reference §5.1 states.

**[exclusion]** That rule narrows an incorporated requirement, and the narrowing is disclosed here rather than presented as a reading. [YAML 1.2.2 §5.2](https://yaml.org/spec/1.2.2/#52-character-encodings) obliges a YAML processor to support the UTF-8 and UTF-16 character encodings on input and, for JSON compatibility, the UTF-32 encodings as well, and it lets a leading byte-order mark decide which of them a stream uses. This specification supports UTF-8 alone and lets no byte-order mark select an encoding, because a binding that never sniffs body bytes cannot take an encoding decision from them, and because [RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1) already requires UTF-8 of JSON text "exchanged between systems that are not part of a closed ecosystem", which a retrieved API description is. A document encoded in UTF-16 or UTF-32 therefore leaves the accepted domain however conformant it is upstream — the whole source where the entry artifact is so encoded, and the referring selection alone where a secondarily retrieved document is. This reopens only if an incorporated authority defines a declaration surface stating a retrieved document's character encoding without inspecting its bytes.

**[incorporated]** The root MUST be a JSON object and its required `swagger` field MUST be exactly `"2.0"` ([OAS 2.0 Format and Swagger Object](https://spec.openapis.org/oas/v2.0.html#swagger-object)).

**[convention]** An absent, mismatched, or differently typed `swagger` value fails exact edition discrimination and refuses at the `swagger` load gate.

### 3.2 Closed load gates and confined defects

**[convention]** Defect outcomes use a fixed vocabulary: a source **refuses at load** only at §3.2's gates; a source whose positions capable of carrying an addressable target are all defective **refuses as a source** after those gates; a declaration defect removes its smallest owning unit from synthesis and selection — accounted **invalid** where the declaration is upstream-invalid, and **excluded** where this specification removes an upstream-valid unit under a stated exclusion, the two statuses the published interface-synthesizer contract keeps distinct; a `selector` that reaches no addressable target **does not resolve**, and the invocation **refuses at resolution** — an outcome distinct from an addressable target that is unusable, because no target is reached at all ([RFC 6901 §7](https://www.rfc-editor.org/rfc/rfc6901#section-7), which names a pointer referencing a nonexistent value as an error condition and directs the application to specify its handling); an addressable target whose use requires a missing choice or unsupported alternative is **unusable** and **refuses before dispatch** when invoked — and that refusal has two species: **context-required**, where a named configuration point or credential is awaited and the refusal carries its own resolution path, and plain **refusal**, where no supplied context could change the answer; both occur before dispatch and both guarantee no observable side effect; a wire fact this specification cannot represent faithfully is a **loud protocol error**, for which the adverbial spellings *refuses loudly*, *fails loudly*, and *reported loudly* are exact synonyms; an interaction that reaches the wire and whose outcome §9.4's classification does not admit as successful **completes unsuccessfully**; and synthesis reports every exclusion and inexpressible declaration as **coverage loss**. **Completes unsuccessfully** is defined there by a sufficient condition, not by its whole extension. An interaction that reaches a final status the classification admits as successful and then fails loudly also completes unsuccessfully; and where any other rule of this specification states that outcome after such a status, that rule fixes it and this entry does not narrow it.

**[convention]** A **lane** is one media-selected value-to-bytes serialization path—JSON, character-data, raw-octet, form, multipart, and this line's other incorporated forms, which are exactly artifact-encoded `byte` and string XML—and the **smallest media owner** is the narrowest declared unit that owns a defective lane. An **unavailable** alternative is an excluded alternative: the word marks this vocabulary's exclusion outcome applied to a media alternative.

**[convention]** A **unit** is one member of this closed lattice, from largest to smallest: the source, an addressable operation, a declared alternative, a media alternative, a lane, and a field. A defect's **smallest owning unit** is the smallest member of that lattice whose declarations the defect reaches; a **selected unit** is a unit reached by the selected target.

**[limit]** The load gates are the following closed ordered set: accepted-representation grammar, scalar/tag/key resolution, JSON-object root shape, and the `swagger` load gate for exact edition discrimination; no condition outside this set is a load gate.

**[limit]** **§3.2's smallest-owner rule**: after those gates pass, a defect confines to its smallest owning unit, and an unreachable defect destroys no target.

**[limit]** An **excluded** unit is removed from synthesis and from the effective declarations of every rule in this document, §7's caller-envelope key derivation and §8's path-template correspondence included: no rule reads an excluded unit's declarations. A selector naming an excluded target still resolves — exclusion is not unresolvability — and the invocation refuses before dispatch. A target whose remaining effective declarations no longer satisfy §8's path-template correspondence is itself excluded.

**[limit]** This specification states which unit a defect confines to, not a taxonomy for naming defects. A conformant 2.0 processor reports that a target is excluded and identifies the declaration position responsible; it is NOT required to classify that defect into a named class, to cite a per-class authority alongside it, or to emit a per-defect coverage entry, and this specification defines no such classes for this edition. Coverage loss is reported at the unit, as §3.2's vocabulary states. This is a stated limit rather than a deferral: the exclusions this specification defines are decidable without a defect taxonomy, and none of them is weakened by its absence.

**[incorporated]** The root `paths` field is required, while a present Paths Object and each Path Item Object may be empty, including when documentation is filtered by access control; a present empty Paths Object is upstream-valid and synthesizes zero operations ([OAS 2.0 Swagger, Paths, and Path Item Objects](https://spec.openapis.org/oas/v2.0.html#paths-object)).

**[limit]** **§3.2's source-refusal rule**: a source **refuses as a source** — the outcome §3.2's vocabulary names, which fires after the closed load gates and never at them — when at least one position that could carry an addressable target exists and every such position is defective, so that no conformant selector can resolve. A valid present-but-empty surface is not a defective position: it is accepted and synthesizes zero operations. The root surface this edition requires for addressable targets is itself such a position, and its absence is that defect — OAS 2.0 makes the root `paths` field required, so a source with no root `paths` refuses as a source ([OAS 2.0 Swagger Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields)). This stated consequence is not an additional load gate.

**[limit]** A target that is addressable but unusable because of a missing choice, unsupported alternative, or exclusion refuses before dispatch or is reported as synthesis coverage loss; it never becomes a source refusal.

**[limit]** This revision declares no source-scope exclusion: unlike the [`include`/`mount` filtering surface of `openbindings.usage@1`](../usage/openbindings.usage.md#3-accepted-source-representations), no source member or addressable target is filtered merely by its position in the source.

**[limit]** An unknown non-extension field creates no binding behavior, and this specification supplies none for it: the consequence confines to the smallest owning unit that depends on it, while an unused unknown field affects no target. An `x-` specification extension remains an inert annotation under this identifier, and no unknown member is guessed into a fixed or patterned field ([OAS 2.0 §6.4 and Specification Extensions](https://spec.openapis.org/oas/v2.0.html#specification-extensions)).

**[convention]** A root `openapi` member co-present with this specification's conforming `swagger` value is such an unknown non-extension root member: it is inert, gates nothing, and cedes the document to no sibling specification.

## 4. `location`, `content`, and composition

**[incorporated]** A present `location` MUST be an absolute URI addressing the Swagger document itself; a bare filesystem path is not conformant (Core [OBI-D-05](../../openbindings.md#102-document-rules)).

**[convention]** For a location-only source the processor always retrieves from that `location`, and the retrieved octets are the artifact: they decode under §3.1's retrieval-decoding rule and MUST then satisfy §3.1's accepted representations, failing which the source refuses at load at the §3.2 gate the condition reaches. When `content` is present the retrieval is elective and carries no obligation: `content` remains the interpreted artifact and is never silently replaced, and an elective retrieval that does not complete, or that yields something other than an accepted representation, changes no observable and is not a defect under this specification (Core [§5.4](../../openbindings.md#54-sources)).

**[limit]** Whether that dereference yields a representation at all is the address scheme's own affair and no outcome of this specification. `location` is an absolute URI, so an HTTP status, a `file://` open error, a name-resolution failure, or a transport failure is decided by the scheme that owns the address; this specification incorporates no retrieval protocol and states no condition of its own for acquisition success. What it does fix begins at the representation: octets that arrive are gated as the preceding rule states. A dereference that yields nothing produces no artifact to gate, so no load gate is reached and §3.2's closed set is unchanged; the invocation refuses before dispatch for want of a source, and because nothing was dispatched that refusal carries the no-observable-side-effect guarantee. How the underlying acquisition failure is reported alongside that refusal is diagnostic and not portable meaning of this identifier.

**[convention]** A present `content` MUST be one of §3.1's two representations, and no other JSON type is accepted.

**[convention]** No source mode this specification governs forbids `content`. The modes are the three Core [§5.4](../../openbindings.md#54-sources) admits — `location` alone, `content` alone, and both co-present — and in the location-only mode `content` is absent rather than prohibited. No rule in this document refuses a source because `content` is present: §3.1 defines its two accepted representations without conditioning either on a mode, the acceptance rule above constrains a present `content`'s representation rather than its presence, and the elective-retrieval rule above admits a `content` co-present with `location` rather than refusing either member. The set of source modes forbidding `content` under Core [OBI-B-02](../../openbindings.md#104-binding-specification-rules) item 3 is therefore empty. Stating that negative changes no outcome any other rule in this document fixes; it is stated so a reader need not read the empty set out of this specification's silence.

**[incorporated]** Relative references resolve against the referring document, and JSON or YAML document fragments are JSON Pointers ([OAS 2.0 Reference Object](https://spec.openapis.org/oas/v2.0.html#reference-object), [JSON Reference draft-03 §§3–4](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03)).

**[pin]** OAS 2.0 supports only "canonical dereferencing" and defines neither that term nor its consequence for the base of a referenced resource; JSON Reference draft-03 §4 says only that resolution is performed relative to the referring document. This specification pins the reading that carries that sentence through a chain: canonical dereferencing preserves the base of each containing resource rather than resetting every reference to the entry document ([OAS 2.0 Reference Object](https://spec.openapis.org/oas/v2.0.html#reference-object), [JSON Reference draft-03 §4](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03)).

**[convention]** Embedded content without a co-present `location` MUST be self-contained; a location-only source uses its location as the entry-document base (Core [§7](../../openbindings.md#7-reference-resolution)).

## 5. References, Schema Objects, and confinement

### 5.1 Reference semantics

**[incorporated]** A Reference Object contains one required `$ref`; non-`$ref` siblings have no effect, the value is a URI, relative values use the referring-document base, and fragment resolution uses RFC 6901 JSON Pointer under canonical dereferencing ([OAS 2.0 Reference Object](https://spec.openapis.org/oas/v2.0.html#reference-object), [JSON Reference draft-03 §§3–4](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03), [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)).

**[convention]** A Schema Object containing `$ref` is such a JSON Reference: every non-`$ref` sibling, including a sibling `allOf`, is ignored, and §5.2's resolved-declaration conjunction reaches only the referenced schema's own branches, never siblings of a `$ref`.

**[convention]** A reference composes its target plus the transitive closure of references reachable from that target, not unrelated material in the same retrieved document. No accepted edition states that composition rule; this specification adopts it so that a selected target's closure is decidable ([OAS 2.0 Reference Object](https://spec.openapis.org/oas/v2.0.html#reference-object)).

**[incorporated]** A referenced document need not itself be a conforming Swagger Document: OAS admits splitting the definitions into separate files at the user's discretion, and its own relative-reference examples target files whose root is a bare Schema Object ([OAS 2.0 §6.2 File Structure](https://spec.openapis.org/oas/v2.0.html#file-structure), [§6.4.17.3 Relative Schema File Example](https://spec.openapis.org/oas/v2.0.html#relative-schema-file-example), [§6.4.17.4 Relative Files With Embedded Schema Example](https://spec.openapis.org/oas/v2.0.html#relative-files-with-embedded-schema-example)).

**[limit]** A secondarily retrieved reference document decodes under §3.1's retrieval-decoding rule and MUST then satisfy §3.1's grammar requirements. §3.2's closed load-gate set reaches only the entry artifact: a secondary document that fails decoding or those grammar requirements makes every reference into it an **unresolvable reference**, confined by whichever of §5.1's three conditions the referring position falls under, and it is never a load refusal of the source.

**[incorporated]** Reusable root parameters and responses create no global declaration until referenced: OAS states in as many words that neither object defines global operation parameters or global operation responses ([OAS 2.0 §6.4.21 Parameters Definitions Object](https://spec.openapis.org/oas/v2.0.html#parameters-definitions-object), [§6.4.22 Responses Definitions Object](https://spec.openapis.org/oas/v2.0.html#responses-definitions-object)).

**[convention]** OAS states no such sentence for the Definitions Object, whose prose only says it holds data types that operations consume and produce ([OAS 2.0 §6.4.20 Definitions Object](https://spec.openapis.org/oas/v2.0.html#definitions-object)). This specification extends the same reading to it: a root `definitions` member creates no declaration reaching any operation until a reference reaches it, so an unreferenced entry is an unused reusable position and never a defect of a target.

**[incorporated]** OAS 2.0 Schema Objects omit draft-04 `id`, so no in-schema member changes a Schema Object's resource base; external and fragment references retain the containing schema resource URI ([OAS 2.0 Schema Object](https://spec.openapis.org/oas/v2.0.html#schema-object), [JSON Schema Core draft-04 §7](https://tools.ietf.org/html/draft-zyp-json-schema-04#section-7)).

**[pin]** JSON Reference draft-03 recommends appropriate checks against infinite recursion; this specification pins that recommendation to a deterministic requirement: reference traversal MUST detect cycles without resource exhaustion, a cyclic but resolvable graph is legitimate, and cycle detection terminates traversal rather than truncating the graph ([JSON Reference draft-03 §7](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03#section-7)).

**[pin]** A Path Item `$ref` is not a Reference Object for sibling purposes. OAS gives the Path Item its own `$ref` fixed field and states that a conflict between the referenced definition and the adjacent one has undefined behavior, which presupposes that both declarations exist; this specification pins the merge that presupposition implies. The **effective Path Item** is the referenced Path Item overlaid with every adjacent field the referenced Path Item does not itself declare: non-colliding adjacent fields contribute, and the `$ref` member itself contributes nothing. The rule that a Reference Object's non-`$ref` siblings have no effect is scoped to Reference Objects proper and never reaches this merge. This edition carries no note about that `$ref`'s adjacent-property behavior; the 3.1 and 3.2 lines add one saying it is likely to change in a future version to align with the Reference Object, which affirms the present non-alignment on every line, and the merge rests on the collision-undefined sentence all four editions share ([OAS 2.0 Path Item Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-3) and [Reference Object](https://spec.openapis.org/oas/v2.0.html#reference-object), against [OAS 3.1.2 §4.8.9.1](https://spec.openapis.org/oas/v3.1.2.html#path-item-ref) and [OAS 3.2.0 §4.9.1](https://spec.openapis.org/oas/v3.2.0.html#path-item-ref)).

**[exclusion]** When a selected Path Item carries `$ref`, the selected operation target is excluded only if a fixed field used by that target appears in both the referenced Path Item and its adjacent declaration, because OAS defines that collision as undefined. `Used by that target` means the selected method field plus the Path Item's `parameters`; this edition's Path Item declares no documentation field, so none is exempt on that ground. Collisions confined to unused fields and all non-colliding adjacent fields leave the target usable. The exclusion reopens only if an incorporated OAS 2.0 authority defines the collision ([OAS 2.0 Path Item Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-3)).

**[convention]** The first three reference conditions in the table below are this specification's own confinement conditions. The nearest upstream statement is JSON Reference draft-03 §5, which says only that evaluation of a JSON Reference SHOULD fail to complete in an error condition and assigns that failure no scope; the OAS sections cited alongside define the reference positions and the base resolution those conditions read, not the conditions themselves ([JSON Reference draft-03 §5](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03#section-5), [OAS 2.0 File Structure, Reference Object, and Path Item Object](https://spec.openapis.org/oas/v2.0.html#reference-object)):

| condition |
| --- |
| **[convention]** Unresolvable selected Path Item `$ref` |
| **[convention]** Unresolvable reference reached by one selected parameter or Response Object |
| **[convention]** Unresolvable Schema Object reference reached only by one request or response lane |
| **[limit]** An unresolvable reference reachable only from an unused reusable or documentation position leaves invocation unaffected; synthesis reports that position as coverage loss. |
| **[limit]** A defect outside the target-plus-reachable closure has no effect on that target. |

**[limit]** In table order, the three conditions confine as follows: the referenced Path Item and its operations are unaddressable; the selected operation or its affected declared alternative is unusable while unrelated operations survive; or the affected lane is unavailable while the same operation's other lanes and unrelated operations alike survive.

### 5.2 Schema Object dialect and data forms

**[incorporated]** The supported Schema Object dialect is exactly OAS 2.0's predefined subset of JSON Schema draft 04, not full draft 04 and not any later JSON Schema dialect ([OAS 2.0 Data Types and Schema Object](https://spec.openapis.org/oas/v2.0.html#schema-object)).

**[incorporated]** Its closed JSON-Schema-derived keyword inventory is `$ref`, `format`, `title`, `description`, `default`, `multipleOf`, `maximum`, `exclusiveMaximum`, `minimum`, `exclusiveMinimum`, `maxLength`, `minLength`, `pattern`, `maxItems`, `minItems`, `uniqueItems`, `maxProperties`, `minProperties`, `required`, `enum`, `type`, `items`, `allOf`, `properties`, and `additionalProperties`; OAS additionally defines `discriminator`, `readOnly`, `xml`, `externalDocs`, and `example` ([OAS 2.0 Schema Object](https://spec.openapis.org/oas/v2.0.html#schema-object)).

**[incorporated]** A Schema Object `type` may be one primitive type name or a unique array of primitive type names, including `null`; every declared draft-04 assertion remains active across admitted alternatives ([JSON Schema Core draft-04 §3.5](https://tools.ietf.org/html/draft-zyp-json-schema-04#section-3.5), [JSON Schema Validation draft-04 §5.5.2](https://tools.ietf.org/html/draft-fge-json-schema-validation-00#section-5.5.2)).

**[pin]** Draft-04 §5.5.2.1 requires that array's elements be strings and be unique but does not require it to be nonempty; an empty array is therefore upstream-admitted and asserts a type set no instance satisfies. This specification pins the consequence rather than narrowing the authority: an empty `type` array yields an empty resolved type set, which satisfies neither **Declares only X** nor **Admits `string` as its sole non-null type** below, so every lane, style, and shape rule that consults it finds no admitted alternative and excludes at its smallest owning unit.

**[incorporated]** Keywords absent from the closed inventory—including `$schema`, `id`, `anyOf`, `oneOf`, `not`, `dependencies`, `patternProperties`, and `additionalItems`—have no OAS 2.0 Schema Object semantics ([OAS 2.0 Schema Object](https://spec.openapis.org/oas/v2.0.html#schema-object)).

**[convention]** For every lane, style, shape, and member-inspection rule in this document, a **resolved declaration** is obtained by following `$ref` and conjoining every `allOf` branch — the branches' type sets INTERSECT, because an instance satisfies `allOf` only if "it validates successfully against all schemas defined by this keyword's value", so a type no branch admits jointly is admitted by none, and an empty intersection is a declaration admitting no instance ([JSON Schema draft-04 §5.5.3.2](https://tools.ietf.org/html/draft-fge-json-schema-validation-00#section-5.5.3.2)); A typeless branch contributes no constraint to that intersection — its identity is the universal set — and an empty intersection is a declaration admitting no instance: every supplied value against it fails every admission test below and refuses before dispatch at its owning position, and synthesis accounts the position invalid. absence of `type` leaves the declaration typeless. **Declares only X** means that the resolved type set is nonempty and every member is in X. **Admits `string` as its sole non-null type** means that the resolved type set is exactly `{string}` or `{string, null}`.

**[limit]** A selected position depends on one of those absent keywords only when the keyword appears in a resolved declaration this specification consults for a binding decision: lane admission, form-property typing, or parameter shape. Such a consulted dependency is outside the upstream dialect and confines at its smallest owning lane; presence in an unconsulted schema position creates no exclusion or invocation effect.

**[incorporated]** `allOf` preserves every component assertion; `discriminator` names a property defined at that same schema and included in its `required` list, and its value MUST name either that schema or a schema that inherits it. Discrimination never skips validation, invents coercion, admits an unrelated definition, or makes an inline schema addressable by friendly name ([OAS 2.0 Schema Object and Composition and Inheritance](https://spec.openapis.org/oas/v2.0.html#composition-and-inheritance-polymorphism)).

**[incorporated]** The known format pairs retain their OAS meanings: integer `int32`/`int64`, number `float`/`double`, and string `byte`, `binary`, `date`, `date-time`, and `password`; `date` and `date-time` use RFC 3339, while an unknown `format` remains an annotation ([OAS 2.0 Data Types](https://spec.openapis.org/oas/v2.0.html#data-types), [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339)).

**[incorporated]** The defined `byte` format denotes Base64 characters, `binary` denotes an octet sequence, and `file` is an additional non-body parameter or response-root type rather than a general Schema Object primitive ([OAS 2.0 Data Types](https://spec.openapis.org/oas/v2.0.html#data-types)).

**[incorporated]** A `default` declared by a Parameter Object, Items Object, Header Object, or Schema Object MUST conform to that object's declared type ([OAS 2.0 Parameter Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-6), [Items Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-7), [Header Object](https://spec.openapis.org/oas/v2.0.html#header-object), and [Schema Object](https://spec.openapis.org/oas/v2.0.html#schema-object)).

**[convention]** An artifact `default` describes server or instance behavior and never supplies a missing caller member or response value at the binding boundary.

**[limit]** A nonconforming `default` is a declaration defect confined to the dependents of its declaring parameter, Items, Header, or Schema Object at the smallest owner; its effect is declaration-keyed and does not depend on whether a caller value is supplied. Its boundary inertness above does not spare it the way §9.4's carve-out spares a `description` omission: `default` is projected into the synthesized contract at its declaring position, so a value that contradicts the declared type misdeclares that position and is exactly the representation loss the carve-out reasoning requires be absent.

**[incorporated]** A property marked `readOnly: true` MAY appear in a response and MUST NOT be sent in a request ([OAS 2.0 Schema Object fixed fields](https://spec.openapis.org/oas/v2.0.html#fixed-fields-12)).

**[convention]** Supplying a `readOnly: true` request property refuses before dispatch at the selected request lane rather than silently deleting caller data. This is a sender obligation the artifact states, not validation of the caller's value against its governing Schema Object, and §9.2's no-validation rule is scoped so as not to reach it: the check reads the declaration's `readOnly` marks and the presence of the correspondingly named members, never any other assertion.

**[pin]** That obligation has one traversal, fixed here because the authority states none: every position of the resolved request declaration reachable, at any depth, through `properties` members, `additionalProperties`, `items`, and the branches conjoined by `allOf`, with each position's own resolved declaration read at that position. No other keyword extends the traversal, and a `readOnly: true` mark outside it — reachable only from an unconsulted or response-only position — imposes no request obligation.

**[exclusion]** A resolved request declaration that, across its conjoined branches, both requires and marks the same property `readOnly: true` excludes that request lane because no instance can satisfy both request obligations; the exclusion reopens only if incorporated authority defines a reconciliation.

**[limit]** A synthesizer may project only assertions it preserves exactly, and it never silently translates this dialect as 2020-12.

## 6. Selector

**[convention]** `selector` is REQUIRED and has exactly one literal spelling: `#/paths/<escaped-path>/<lowercase-method>`, where `<escaped-path>` is the Paths Object key escaped once under RFC 6901 and `<lowercase-method>` is one of `get`, `put`, `post`, `delete`, `options`, `head`, or `patch` ([OAS 2.0 Path Item Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-3)).

**[pin]** The selector's leading `#` is a literal sentinel: what follows is RFC 6901 §3's string representation of the JSON Pointer, carried literally, escaped once with `~0`/`~1`, and never percent-decoded; the §6 URI-fragment representation is not used. Evaluation follows RFC 6901 §§3–4; when the selected operation is absent the selector does not resolve and the invocation **refuses at resolution** ([RFC 6901 §§3–4, 6](https://www.rfc-editor.org/rfc/rfc6901#section-3), [OAS 2.0 Paths Object](https://spec.openapis.org/oas/v2.0.html#paths-object)).

**[convention]** After the pointer selects a Path Item, selector evaluation canonically resolves that Path Item's `$ref` into §5.1's effective Path Item before reading the method field; this deliberate extra resolution keeps bundled and external referenced Path Items addressable ([OAS 2.0 Path Item and Reference Objects](https://spec.openapis.org/oas/v2.0.html#path-item-object)).

## 7. Target interaction and caller envelope

**[convention]** Here and below, an **effective** declaration is the declaration that remains after applying every artifact scope, default, and override rule this document states for the declaration in question — §7's parameter override, §§8–10's parameter, media, and target rules, and §11's `security` override alike.

**[incorporated]** An addressed operation denotes its declared HTTP method, completed target URL, effective parameters, optional payload, security requirements, and final HTTP response. The method is the Path Item field name that selects the Operation Object, and the target URL is composed from the Swagger Object's `schemes`, `host`, and `basePath` with the Paths Object key ([OAS 2.0 Operation Object](https://spec.openapis.org/oas/v2.0.html#operation-object), [Path Item Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-3), [Swagger Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields), [Paths Object](https://spec.openapis.org/oas/v2.0.html#paths-object)).

**[convention]** The caller-facing correspondence value is exactly `{parameters?: {...}, body?: <one JSON value>}`; absence means not supplied, `body: null` is a supplied JSON null, and the artifact alone determines parameter location and serialization.

**[convention]** The four named non-body locations—`path`, `query`, `header`, and `formData`—use `parameters`; the single `in: body` parameter uses `body`.

**[incorporated]** A body parameter's declared `name` has documentation meaning but no wire role ([OAS 2.0 Parameter Object](https://spec.openapis.org/oas/v2.0.html#parameter-object)).

**[convention]** When every effective non-body parameter name is unique across locations, its caller key is the exact declared name; if any name is repeated across legal locations, the target uses qualified mode for every non-body parameter and each key is `<location>/<RFC6901-escaped-name>`, making the flat map injective without depending on map order.

**[incorporated]** Operation parameters override Path Item parameters only at the same exact name-plus-location identity; duplicate effective parameters in one location are upstream-invalid, while same-name parameters in different locations are distinct ([OAS 2.0 Path Item, Operation, and Parameter Objects](https://spec.openapis.org/oas/v2.0.html#fixed-fields-4)).

**[exclusion]** Duplicate effective parameters in one location exclude their smallest owning operation; this exclusion reopens only if an incorporated OAS 2.0 authority admits such duplicates.

**[convention]** Legal cross-location duplicates remain independently supplied through the qualified mode above.

**[exclusion]** Two effective header parameters whose names differ only by ASCII case exclude the selected target because OAS parameter identity is case-sensitive while HTTP field names are case-insensitive; the wire cannot preserve the distinction. This exclusion reopens only if an incorporated authority defines a wire mapping that preserves such case-distinct declarations ([OAS 2.0 Parameter Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-6), [RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[convention]** An envelope top-level key other than `parameters` or `body`, a present non-object `parameters` member, or any unknown parameter key refuses before dispatch, regardless of whether a body exists; no unmatched-field passthrough exists.

**[incorporated]** A missing required parameter refuses before dispatch; every path parameter is required, while a non-path parameter defaults to optional ([OAS 2.0 Parameter Object fixed fields](https://spec.openapis.org/oas/v2.0.html#fixed-fields-6)).

**[incorporated]** A Parameter, Items, or Header Object `default` documents what the receiver assumes when a value is not provided; it is never inserted by this binding. An unsupplied optional parameter carrying a `default` is omitted before serialization, exactly as one carrying none. Each of the three objects states this in its own words — the value "the server will use if none is provided" for a parameter, an item, and a header respectively — and each adds that `default` has no meaning for a required one ([OAS 2.0 Parameter Object fixed fields](https://spec.openapis.org/oas/v2.0.html#fixed-fields-6), [Items Object fixed fields](https://spec.openapis.org/oas/v2.0.html#fixed-fields-7), [Header Object](https://spec.openapis.org/oas/v2.0.html#header-object)).

**[incorporated]** Every selected effective parameter requires `name` and an `in` value from `query`, `header`, `path`, `formData`, or `body`; an `in: body` parameter requires `schema`, every other parameter requires `type`, and `type: array` requires `items` ([OAS 2.0 Parameter Object fixed fields](https://spec.openapis.org/oas/v2.0.html#fixed-fields-6)).

**[limit]** A selected effective parameter missing one of those wire-critical fields or carrying an inadmissible `in` is a declaration defect that excludes the selected target. The disposition is declaration-keyed and never changes with the presence, absence, or value of caller input.

**[incorporated]** The effective parameter set MUST NOT contain both an `in: body` parameter and any `in: formData` parameter, and it contains at most one body parameter ([OAS 2.0 Parameter Object](https://spec.openapis.org/oas/v2.0.html#parameter-object)).

**[limit]** Violating either upstream constraint excludes the selected operation under §3.2's smallest-owner rule.

## 8. Non-body Parameters and form payloads

### 8.1 Types, conversion, and empty values

**[incorporated]** Every non-body parameter uses its own `type`, `format`, `items`, and inline validation fields rather than a Schema Object; its admitted `type` is `string`, `number`, `integer`, `boolean`, `array`, or, only for `formData`, `file` ([OAS 2.0 Parameter and Items Objects](https://spec.openapis.org/oas/v2.0.html#fixed-fields-6)).

**[incorporated]** An Items Object requires its own internal `type`, whose closed domain is `string`, `number`, `integer`, `boolean`, or `array`; files and models are inadmissible, and an internal `type: array` requires a nested `items` ([OAS 2.0 Items Object fixed fields](https://spec.openapis.org/oas/v2.0.html#fixed-fields-7)).

**[limit]** A malformed selected Items Object is a declaration defect that excludes the selected target at its smallest owner independently of caller or response values.

**[convention]** Every supplied non-null parameter value MUST satisfy its declared type and inline assertions before serialization; `allowEmptyValue` changes only empty-value carriage and does not erase another assertion ([OAS 2.0 Parameter Object fixed fields](https://spec.openapis.org/oas/v2.0.html#fixed-fields-6)).

**[convention]** A supplied non-null parameter value that fails its declared type or any inline assertion refuses before dispatch.

**[pin]** Draft-04's `integer` type is literal: a JSON number with a fraction or exponent part does not satisfy `integer`, so a supplied `1.0` refuses before dispatch ([JSON Schema Core draft-04 §3.5](https://tools.ietf.org/html/draft-zyp-json-schema-04#section-3.5)).

**[configuration point]** `parameterConversion` is one deterministic consumer-supplied conversion from each supplied JSON boolean, number, or null to a string; strings pass identically, arrays apply the converter to each member, and any supplied non-string scalar without a configured result refuses before dispatch. A non-injective configured conversion is the consumer's own value collapse — disclosed here, it is not a binding defect.

**[configuration point]** Non-body JSON null is conversion-required and is never authored as omission: OAS excludes `null` from non-body parameter types and supplies no JSON-null serialization, so only the configured deterministic string result can make it usable ([OAS 2.0 Parameter Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-6)).

**[incorporated]** `allowEmptyValue` applies only to `query` and `formData` and defaults to `false`; a supplied empty string with `allowEmptyValue: true` may be represented as a name alone or as a present empty value ([OAS 2.0 Parameter Object fixed fields](https://spec.openapis.org/oas/v2.0.html#fixed-fields-6)).

**[convention]** That refusal is scoped to the two locations the flag reaches. At a `query` or `formData` parameter, a supplied empty string with `allowEmptyValue` absent or `false` refuses before dispatch because the declaration does not admit an empty value. At a `path` or `header` parameter the flag is inapplicable and can never be true, so it withholds nothing: a supplied empty string is an ordinary value of a `string` declaration and is carried as zero characters — for a header the empty field value RFC 9110 admits, for a path expression an empty substitution ([OAS 2.0 Parameter Object fixed fields](https://spec.openapis.org/oas/v2.0.html#fixed-fields-6), [RFC 9110 §5.5](https://www.rfc-editor.org/rfc/rfc9110#section-5.5)).

**[convention]** Absence from the caller envelope omits the parameter.

**[configuration point]** Where those two admitted empty spellings produce distinct bytes — that is, at a `query` or `formData` parameter declaring `allowEmptyValue: true`, and nowhere else — `emptyValueForm` MUST select `name-only` or `empty`; no binding default prefers one, a supplied empty string at such a parameter without that required choice refuses before dispatch, and multipart represents either choice as one named zero-length part.

### 8.2 `collectionFormat` and location assembly

**[incorporated]** An array parameter uses the following complete `collectionFormat` table; omitted `collectionFormat` means `csv`, and `multi` is admitted only for `query` and `formData`. The five-value domain and `multi` belong to the Parameter Object; the Items Object's own `collectionFormat` has the narrower domain `csv`, `ssv`, `tsv`, `pipes` with the same `csv` default and no `multi`, and the delimiter spellings below are the ones both objects share ([OAS 2.0 Parameter Object fixed fields](https://spec.openapis.org/oas/v2.0.html#fixed-fields-6), [Items Object fixed fields](https://spec.openapis.org/oas/v2.0.html#fixed-fields-7)):

| `collectionFormat` | structural spelling |
| --- | --- |
| **[incorporated]** `csv` | converted members joined with `,` |
| **[incorporated]** `ssv` | converted members joined with U+0020 SPACE |
| **[incorporated]** `tsv` | converted members joined with U+0009 TAB |
| **[incorporated]** `pipes` | converted members joined with `\|` |
| **[incorporated]** `multi` | one repeated contribution per converted member; `query` and `formData` only |

**[convention]** Array-member order is preserved.

**[convention]** A supplied array with zero members is an **empty value** under every `collectionFormat`, `multi` included: the four join formats join over no members and `multi` contributes one instance carrying no value, so a supplied zero-member array never becomes indistinguishable from absence. That empty value is the one §8.1 governs: at a `query` or `formData` parameter it refuses before dispatch unless the declaration carries `allowEmptyValue: true`, in which case `emptyValueForm` selects between `name-only` and `empty` exactly as for a supplied empty string; at a `path` or `header` parameter, where the flag is inapplicable, it substitutes as zero characters.

**[convention]** A supplied array whose converted member contains its selected structural delimiter refuses that invocation before dispatch because OAS defines no escaping that preserves the array boundary; the parameter remains usable for other caller values.

**[exclusion]** A `multi` declaration on a `path` or `header` parameter is a declaration defect that excludes the selected target before caller values are inspected; the exclusion reopens only if an incorporated OAS 2.0 authority admits `multi` at that location or defines its wire meaning.

**[exclusion]** A non-body array whose resolved Items declaration declares only `array` is excluded because OAS defines no unambiguous composition of the inner and outer `collectionFormat` delimiters; the exclusion reopens only if incorporated authority defines nested-array serialization ([OAS 2.0 Items Object](https://spec.openapis.org/oas/v2.0.html#items-object)).

**[incorporated]** A response Header Object array uses `csv`, `ssv`, `tsv`, or `pipes`, defaults to `csv`, and never admits `multi` ([OAS 2.0 Header Object](https://spec.openapis.org/oas/v2.0.html#header-object)).

**[limit]** Header declarations affect decoding and coverage but do not by themselves create operation output members.

**[convention]** Query and path names or converted values encode each UTF-8 byte outside RFC 3986's unreserved set as uppercase `%HH`; structural delimiters introduced by `collectionFormat`, `?`, `&`, and `=` remain structural, and caller keys never change ([RFC 3986 §§2.1–2.3, 3.3–3.4](https://www.rfc-editor.org/rfc/rfc3986)).

**[incorporated]** Every effective path parameter name MUST correspond to an expression in the associated Paths key ([OAS 2.0 Path Templating and Parameter Object](https://spec.openapis.org/oas/v2.0.html#path-templating)).

**[convention]** Every path-template expression MUST have one corresponding effective path parameter because an unfillable expression cannot dispatch; path substitution cannot alter the host, base path, query boundary, or fragment.

**[limit]** A missing, extra, or mismatched effective path parameter is a declaration defect that excludes the selected target independently of caller values.

**[convention]** Query contributions use one leading `?`, exact percent-encoded names, `=` before a present value, repeated pairs for `multi`, and `&` between contributions; map or parameter-array order is not portable meaning.

**[convention]** Header values perform no URI percent-encoding and add no automatic quotes.

**[pin]** A supplied header value's characters are carried as UTF-8 octets, closing the character-to-octet seam before the field-invalid-byte check below ([RFC 9110 §5.5](https://www.rfc-editor.org/rfc/rfc9110#section-5.5)).

**[convention]** A supplied header value containing CR, LF, or another field-invalid byte refuses before dispatch at the affected parameter ([RFC 9110 §§5.1, 5.5](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[exclusion]** An effective header parameter whose name compares ASCII case-insensitively to `Host`, `Content-Length`, or `Content-Type` excludes the target because those fields are processor- or binding-owned and cannot be replaced by caller input; the exclusion reopens only if an incorporated HTTP authority defines caller control that preserves the processor's framing, routing, and selected-body-media obligations.

**[convention]** The binding emits no implicit `Accept` field; an artifact-declared header parameter named `Accept` remains an ordinary caller-supplied parameter because OAS 2.0 defines no ignored-header rule. `Accept` is therefore not on the processor-owned field list at all: a credential destined for `Accept` collides, if at all, under the ordinary parameter-collision rule ([RFC 9110 §12.5.1](https://www.rfc-editor.org/rfc/rfc9110#section-12.5.1), [OAS 2.0 Parameter Object](https://spec.openapis.org/oas/v2.0.html#parameter-object)).

### 8.3 `formData` payloads

**[incorporated]** Effective `formData` is usable only when effective `consumes` includes `application/x-www-form-urlencoded`, `multipart/form-data`, or both; the selected request media — concrete in §9.1's sense — fixes which form encoding is used ([OAS 2.0 Parameter Object](https://spec.openapis.org/oas/v2.0.html#parameter-object)).

**[incorporated]** URL-encoded form names and converted values replace SPACE with `+`, percent-encode other non-alphanumeric bytes as `%HH`, separate name and value with `=`, and separate pairs with `&` ([HTML 4.01 §17.13.4.1](https://www.w3.org/TR/html401/interact/forms.html#h-17.13.4.1)).

**[convention]** The HTML control-order rule does not transfer to an OAS parameter list.

**[convention]** Before that algorithm, form names and converted values use UTF-8 bytes; OAS exposes no form-character-set choice, so this single encoding closes the otherwise unwarranted character-to-octet seam.

**[pin]** URL-encoded form percent-encoding leaves RFC 3986 unreserved bytes literal; after SPACE becomes `+`, every other UTF-8 byte is encoded as uppercase `%HH`, matching §8.2's query-encoding pin. Where HTML 4.01's non-alphanumeric prose and this RFC 3986 unreserved pin differ — the characters `-`, `.`, `_`, and `~` — the RFC 3986 pin governs and those bytes stay literal. No line-break normalization is performed: supplied characters encode as-is, and HTML 4.01's CR LF representation of line breaks is not applied.

**[convention]** URL-encoded cross-parameter pair order has no portable meaning; `multi` preserves array-member order through repeated pairs, and every other array format contributes its single joined value.

**[exclusion]** A `file` parameter selected through `application/x-www-form-urlencoded` is excluded because OAS and its incorporated form authority do not determine how file octets and file metadata become that character form; the exclusion reopens only if incorporated authority defines that cell.

**[incorporated]** Multipart form data emits one part per present parameter, or one part per member for `collectionFormat: multi`; every part has `Content-Disposition: form-data` with the exact parameter name in `name`, while other array formats put the joined value in one part ([OAS 2.0 Parameter Object](https://spec.openapis.org/oas/v2.0.html#parameter-object), [HTML 4.01 §17.13.4.2](https://www.w3.org/TR/html401/interact/forms.html#h-17.13.4.2)).

**[pin]** That `name` parameter value is emitted as a quoted-string. [RFC 9110 §5.6.6](https://www.rfc-editor.org/rfc/rfc9110#section-5.6.6) permits either spelling and states that "the quoted and unquoted values are equivalent", so the authority fixes no bytes here; this specification pins the quoted spelling, which is the only one any incorporated authority exhibits and which needs no conditional token test.

**[convention]** Multipart part order across different parameters has no portable meaning; repeated parts for one array preserve member order.

**[incorporated]** A multipart entity's parts are delimited with a boundary delimiter constructed from CRLF, `--`, and the value of the `boundary` parameter, which is supplied as a `boundary` parameter on the emitted media type; the boundary delimiter MUST NOT appear inside any encapsulated part. The entity opens with `--`, the boundary value, and a CRLF; each subsequent part is preceded by a CRLF, `--`, the boundary value, and a CRLF; and the entity closes with a CRLF, `--`, the boundary value, and a final `--`. Only CRLF represents a line break between body parts. The boundary value is 1 to 70 characters of RFC 2046's `bchars` not ending in white space, and a composer MUST NOT generate non-zero-length transport padding ([RFC 9110 §8.3.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3.3), which routes all multipart syntax to RFC 2046 §5.1.1 by name and states the sender-side CRLF requirement, [RFC 2046 §5.1.1](https://www.rfc-editor.org/rfc/rfc2046#section-5.1.1), and [HTML 4.01 §17.13.4.2](https://www.w3.org/TR/html401/interact/forms.html#h-17.13.4.2), which exhibits the same framing and states the same line rule).

**[convention]** The processor generates that boundary token and this binding declares no generation procedure: any token satisfying the incorporated grammar that appears in no encapsulated part discharges the requirement. Neither the token nor the optional quoting the incorporated authority permits for it on the media-type field is portable meaning, because every admitted spelling denotes the same delimiter. The binding emits no preamble and no epilogue, both of which the incorporated grammar makes optional and discardable.

**[convention]** A `boundary` parameter carried by an effective `consumes` entry or by a `requestMedia` choice takes part in §9.1's declaration matching and is then discarded for emission: the token the processor generates is the one emitted in the request `Content-Type` field and the one that delimits the entity. This is the one exception §9.1's parsed-form spelling pin names. Honoring a declared value instead would make load-bearing a value the rule above has already declared free.

**[incorporated]** A multipart part's `Content-Type` header is optional and defaults to `text/plain`; a `file` value is exact octets at the operation boundary whose content should be identified by an appropriate content type, and HTML 4.01 permits a part to be encoded with a `Content-Transfer-Encoding` header ([HTML 4.01 §17.13.4.2](https://www.w3.org/TR/html401/interact/forms.html#h-17.13.4.2)).

**[convention]** The binding emits a non-file part as `text/plain; charset=utf-8`, closing the character-to-octet choice without changing its artifact value.

**[exclusion]** The HTML-permitted transfer-encoded part alternative is excluded: no `Content-Transfer-Encoding` is emitted, because its interaction with this binding's exact-octet part carriage is undefined; the exclusion reopens only if an incorporated authority defines that interaction.

**[exclusion]** The HTML-permitted untyped file part is excluded: each present `file` parameter requires one `propertyMedia` choice — a concrete media type in §9.1's sense — for its multipart part because the artifact declares no file-part media type, and an absent or invalid choice refuses before dispatch; the exclusion reopens only if an incorporated authority defines an untyped file part's receiver semantics.

**[pin]** No `filename` parameter is emitted on any part. This departs from an incorporated SHOULD and is disclosed as such: HTML 4.01 §17.13.4.2 says the user agent "should attempt to supply a file name for each submitted file", and a user agent has a file system to take that name from where this binding has only a JSON string of octets at the operation boundary. Inventing a name would put a value on the wire that the artifact never declared and the caller never supplied, so the SHOULD is deliberately not followed and no configuration point restores it ([HTML 4.01 §17.13.4.2](https://www.w3.org/TR/html401/interact/forms.html#h-17.13.4.2)).

**[exclusion]** A form parameter name that cannot be represented safely as the multipart `name` parameter, including CR or LF, excludes only that multipart media alternative; the exclusion reopens only if incorporated authority defines an unambiguous encoding.

## 9. Request and response media

### 9.1 Media identity, effective declarations, and request election

**[incorporated]** Root `consumes` and `produces` provide operation defaults and describe the MIME types the operation can consume and produce; a present Operation list replaces its root list, including an empty list that clears it ([OAS 2.0 Swagger Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields), [Operation Object](https://spec.openapis.org/oas/v2.0.html#operation-object)).

**[convention]** List order supplies no preference.

**[incorporated]** Media types parse under RFC 9110: type and subtype compare case-insensitively, parameter names compare case-insensitively, and parameter values retain their media-defined comparison rules ([RFC 9110 §§5.6.6, 8.3.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.6.6)). OAS 2.0 states only that media-type spellings should comply with RFC 6838 and names no comparison rule, so it is not cited for this one ([OAS 2.0 §5.2 Mime Types](https://spec.openapis.org/oas/v2.0.html#mime-types), [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838)).

**[pin]** A declared media-type parameter value is first unquoted under [RFC 9110 §5.6.6](https://www.rfc-editor.org/rfc/rfc9110#section-5.6.6); the value of `charset` then compares ASCII case-insensitively, and every other parameter value, `boundary` included, compares by exact character sequence. RFC 9110 §5.6.6 leaves parameter-value case sensitivity to each parameter's own definition; [RFC 2046 §4.1.2](https://www.rfc-editor.org/rfc/rfc2046#section-4.1.2) marks `charset` as the exception to the general rule, and [RFC 2046 §5.1.1](https://www.rfc-editor.org/rfc/rfc2046#section-5.1.1) constructs the multipart boundary delimiter from the parameter value literally, so an inexact boundary does not delimit.

**[convention]** A **concrete media type** has no wildcard in either its type or subtype; media-type parameters do not affect concreteness.

**[convention]** A declaration matches a concrete media type only when every declared parameter is present with an equal value; matches order by exact type/subtype before `type/*` before `*/*`, then by greatest declared-parameter count, and equal-specificity ties select no declaration.

**[limit]** Distinct list entries that normalize to one parsed media identity collide only for that identity and support no selection through it: a request selection refuses before dispatch and a response selection is a loud protocol error on a successful response; on an unsuccessful one the best-effort failure-body rule below governs, and no loud protocol error is raised. Non-colliding entries survive, and list order never breaks the tie.

**[convention]** A no-payload invocation bypasses request-media selection and emits neither a body nor `Content-Type`; absence of every optional body or `formData` value is not a supplied empty payload ([OAS 2.0 Parameter Object](https://spec.openapis.org/oas/v2.0.html#parameter-object)).

**[configuration point]** A payload-emitting invocation preserves every admissible effective `consumes` alternative: exactly one usable concrete candidate — one not excluded by this specification's confinement rules — selects itself; every other effective set, including two or more usable candidates, a range-only candidate, or a concrete candidate alongside a usable range, requires one concrete `requestMedia` choice before input consumption; the choice MUST match under §9.1 and never substitutes another lane's schema or form rules, and supplied values never elect.

**[exclusion]** An operation whose effective `consumes` set is empty has no request media alternative at all: the preceding configuration point does not reach it, because a choice it could name does not exist, and no other lane substitutes, since OAS supplies no body-media default. Its body and `formData` lanes are excluded, so a payload-emitting invocation refuses before dispatch and synthesis accounts those lanes as coverage loss rather than as a `requestMedia` requirement. The exclusion reopens only if incorporated OAS 2.0 authority defines such a default.

**[limit]** The mirror response case is decided on the same declaration and at the same time, and differs only in the outcome the phase admits. An operation whose effective `produces` set is empty while a Response Object that can govern a successful response declares a `schema` can match no actual `Content-Type` under §9.1, so every non-empty successful response to it is the loud protocol error §9.4 already states. Because the condition is decidable on the declaration alone, synthesis accounts that governing content declaration as coverage loss rather than reporting it as represented; it is not an exclusion, because the target remains addressable and an empty successful response to it still completes. An empty effective `produces` with no such `schema` declares that no content is returned and is not a defect. The request side refuses before dispatch instead only because a request lane is chosen before any wire fact exists.

**[configuration point]** A missing required media choice, unmatched or ambiguous choice, unsupported selected lane, or form selection inconsistent with effective `formData` refuses before dispatch; no body bytes or examples are sniffed to select a lane.

**[pin]** A payload-emitting invocation emits the elected concrete media type as the request `Content-Type` field value; the election is never re-decided from the body bytes. An incorporated authority speaks here without fixing the observable, and the non-normativity is disclosed rather than presented as silence: [RFC 9110 §8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3) says that "A sender that generates a message containing content SHOULD generate a Content-Type header field in that message unless the intended media type of the enclosed representation is unknown to the sender", which leaves a conforming sender free to omit the field; this specification removes that latitude and requires the emission. No accepted edition supplies the value: OAS 2.0 describes `consumes` as the MIME types the API can consume and assigns the list no wire consequence, and the nearest it comes to the field is the `formData` prose saying those form types "are used as the content type of the request (in Swagger's definition, the `consumes` property of an operation)" — descriptive, scoped to form parameters, and naming neither a field nor an obligation. The elected media type is therefore the selected-body-media obligation §8.2's processor-owned exclusion reserves to the binding, which is why an artifact-declared header parameter of that name excludes the target instead of supplying this value. One further parameter joins the type in that field on the multipart lane alone, because §8.3's incorporated form authority frames a `multipart/form-data` entity with a boundary; this rule neither supplies that parameter nor removes it ([OAS 2.0 Swagger and Operation Objects](https://spec.openapis.org/oas/v2.0.html#fixed-fields-4), [Parameter Object](https://spec.openapis.org/oas/v2.0.html#parameter-object), [RFC 9110 §8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3)).

**[pin]** The emitted value is the elected concrete media type in its parsed form: type and subtype and every parameter name in lowercase, each parameter value in the characters the declaration or choice supplied after unquoting, and re-quoted only where the `token` production does not admit it. A `multipart/form-data` election's `boundary` parameter is the one exception: §8.3 discards the declared value for emission, and the generated token is emitted in its place. Which spelling matched — a range-keyed effective `consumes` entry instantiated by a `requestMedia` choice, a concrete effective `consumes` entry, or the choice itself — never changes the emitted bytes. The authority states that the alternative spellings "are equivalent" and that the normalized one "is preferred for consistency", which fixes no bytes on its own; this specification pins the preferred spelling ([RFC 9110 §8.3.1](https://www.rfc-editor.org/rfc/rfc9110#section-8.3.1)).

**[incorporated]** Examples illustrate values ([OAS 2.0 Example Object](https://spec.openapis.org/oas/v2.0.html#example-object)).

**[limit]** Examples create no operation input or output member and never select a declaration, carriage lane, or media type.

**[exclusion]** A supplied body or `formData` payload on GET, HEAD, DELETE, or OPTIONS is excluded at that request lane because the incorporated HTTP authority assigns no portable payload semantics for those method cells. The exclusion reopens only if incorporated authority defines the cell ([RFC 9110 §§9.3.1–9.3.2, 9.3.5, 9.3.7](https://www.rfc-editor.org/rfc/rfc9110#section-9.3.1)).

**[limit]** That exclusion is stated over a supplied payload, so its two cases separate. Where every effective body and `formData` parameter of such an operation is optional, the operation stays addressable and represented and only a payload-supplying invocation refuses before dispatch; where the operation declares a REQUIRED `in: body` or `in: formData` parameter, no invocation of it can both satisfy §7's missing-required-parameter rule and avoid the excluded lane, so the operation itself is excluded before caller values are inspected. This is the one place a caller-value condition and a declaration-keyed condition meet, and the split is stated rather than left to the reader.

### 9.2 Common carriage lanes

**[pin]** An exact `application/json` or `+json` selection serializes a request value as strict RFC 8259 JSON and parses a response as strict RFC 8259 JSON; JSON text uses UTF-8, and a typeless resolved declaration preserves the four-byte body `null` as supplied data distinct from no payload ([OAS 2.0 Format and Schema Object](https://spec.openapis.org/oas/v2.0.html#schema-object), [RFC 6839 §3.1](https://www.rfc-editor.org/rfc/rfc6839#section-3.1), [RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)).

**[pin]** [RFC 6839 §3.1](https://www.rfc-editor.org/rfc/rfc6839#section-3.1) is the incorporated `+json` suffix authority; where its registration inherits RFC 4627's UTF-16/UTF-32 latitude, [RFC 8259 §8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)'s UTF-8 requirement governs this lane.

**[pin]** Strict JSON is RFC 8259's grammar under this profile: parsing resolves duplicate object member names by taking the last member in document order — the last one the parse encounters, never an ordering of the names themselves — which is the documented common receiver behavior inside RFC 8259 §4's permitted set; a leading byte-order mark on a JSON body is ignored under RFC 8259 §8.1's parser latitude and is never part of the value; and a lone surrogate escape yields no value in either direction — on a response it is a loud protocol error and on a caller-supplied request value it refuses before dispatch, because neither silent replacement nor invalid passthrough preserves the supplied text ([RFC 8259 §§4, 8.1–8.2](https://www.rfc-editor.org/rfc/rfc8259#section-4)).

**[limit]** JSON-lane numeric fidelity is a declared latitude, not a requirement in either direction. RFC 8259 §6 expressly allows an implementation to set limits on the range and precision of numbers it accepts and states that good interoperability follows from expecting no more than binary64 provides; this specification therefore permits exactly two behaviors for a supplied or received number outside binary64's range or precision — carrying its exact lexical form through, or reducing it to the nearest finite binary64 value — and permits nothing else. Silent replacement by any other value, refusal, and truncation of the surrounding document are all outside the permitted set. Two conformant processors MAY differ here on which mathematical **value** a number outside binary64 carries; every number representable in binary64 carries exactly one value. That is a latitude over values and is distinct from the lexical latitude §12.4 also declares, under which two processors may spell one fixed value differently ([RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259#section-6)).

**[convention]** `text/json` is not a member of that JSON lane; as `text/*`, it can use the character-data lane only when its resolved declaration admits `string` as its sole non-null type and does not carry `format: binary`. This convention reopens under a new identifier only if the IANA media-type registry registers `text/json` with JSON semantics.

**[convention]** A concrete character-data selection whose resolved declaration admits `string` as its sole non-null type and does not carry `format: binary` carries the supplied string under its declared `charset`, defaulting to UTF-8; a resolved type set of `{string, null}` therefore selects this lane for its string branch, while a supplied null refuses before dispatch because the lane defines no null lexical form. Response decoding emits a string and never invents null. The closed character-data set is `text/*`, `application/xml`, and `+xml`, while JSON media are claimed by the JSON lane. The binding does not consult the live media-type registry's `Encoding considerations`: `application/json` is registered as binary, `text/csv` records no value, and a live lookup would violate this pinned, immutable reading ([RFC 6838 §4.2.1](https://www.rfc-editor.org/rfc/rfc6838#section-4.2.1), [RFC 2046 §4.1](https://www.rfc-editor.org/rfc/rfc2046#section-4.1), [RFC 7303 §§3, 9](https://www.rfc-editor.org/rfc/rfc7303#section-3)).

**[pin]** This binding is an XML-unaware MIME consumer in RFC 7303 §3's own terms — it processes XML media as opaque character data, never as parsed XML — and the charset parameter is the only character-encoding source this lane consults: a BOM or XML declaration is never read, so an XML response is decoded under its charset parameter and, absent one, under this lane's UTF-8 default, while every unsupported or invalid character decoding raises a loud protocol error ([RFC 7303 §3.2](https://www.rfc-editor.org/rfc/rfc7303#section-3.2)).

**[pin]** That rule departs from RFC 7303 §3.2 on both of its clauses, and the departure is disclosed here as a departure rather than presented as a reading of the section. RFC 7303 §3.2 states an unambiguous precedence — a BOM is authoritative if present in an XML MIME entity, and in the absence of a BOM the charset parameter is authoritative if present — and it advises that "XML-unaware MIME consumers SHOULD NOT assume a default encoding" where neither is present, an advisory §8.5 repeats. This specification inverts the first and declines the second: a BOM is a body byte, and a binding that decides no other lane by inspecting body bytes will not make an exception for this one, while refusing every charset-less XML entity would leave a large, ordinary, and in practice UTF-8 population of artifacts undecodable for a hazard the charset parameter already exists to signal. A caller or receiver that needs BOM-authoritative decoding cannot obtain it under this identifier; the departure reopens only under a new identifier ([RFC 7303 §§3.2, 8.5](https://www.rfc-editor.org/rfc/rfc7303#section-3.2)).

**[pin]** Absent a `charset` parameter, a `text/*` representation decodes as UTF-8. The ground is RFC 6838 §4.2.1, already incorporated: "the 'UTF-8' charset [RFC3629] SHOULD be selected as the default", and every new `text/*` registration "MUST clearly specify how the charset is determined; relying on the US-ASCII default defined in Section 4.1.2 of [RFC2046] is no longer permitted". This specification pins that SHOULD to a requirement, because a default left to each implementation makes the decoded value unportable. RFC 2046 §4.1.2's US-ASCII default is displaced for this binding, and the displacement is the newer registration authority's rather than this specification's — what is pinned here is only the SHOULD's strength ([RFC 6838 §4.2.1](https://www.rfc-editor.org/rfc/rfc6838#section-4.2.1), displacing [RFC 2046 §4.1.2](https://www.rfc-editor.org/rfc/rfc2046#section-4.1.2)).

**[limit]** UTF-8 decoding MUST be supported; any further charset is an implementation capability whose absence refuses loudly.

**[incorporated]** The `byte` format denotes Base64-encoded characters, which are themselves the artifact's data ([OAS 2.0 Data Types](https://spec.openapis.org/oas/v2.0.html#data-types)).

**[convention]** OAS assigns that format no boundary meaning, so this specification assigns one: a resolved declaration that admits `string` as its sole non-null type with `format: byte` carries the caller's Base64-character string as artifact data and does not trigger the OpenBindings raw-octet boundary, so it is never double-decoded. The alternative reading — treating those characters as an encoding this binding should undo — would emit octets no artifact position declares.

**[incorporated]** A resolved body or response declaration that admits `string` as its sole non-null type with `format: binary`, and a response root or `formData` parameter of `type: file`, denotes exact octets ([OAS 2.0 Data Types, Parameter Object, and Response Object](https://spec.openapis.org/oas/v2.0.html#data-types)).

**[convention]** A non-JSON, non-form concrete selection whose resolved declaration is typeless, or whose resolved declaration admits `string` as its sole non-null type with `format: binary`, uses the raw-octet lane. This is the assignment that keeps a typeless declaration on a concrete non-JSON media from falling to the catch-all exclusion below: OAS 2.0 admits a typeless Schema Object exactly as it admits any other, and the octet lane is the only one that carries an undeclared value form without inventing a serialization for it.

**[pin]** Every OpenBindings raw-octet value is a JSON string containing canonical RFC 4648 §4 Base64: standard alphabet, required padding, no ignored non-alphabet characters, and zero unused pad bits; requests decode before dispatch and responses encode the exact octets ([RFC 4648 §§3.3, 3.5, 4](https://www.rfc-editor.org/rfc/rfc4648)).

**[convention]** A caller-supplied request value on that lane which is not a JSON string, or which is a JSON string outside that canonical form, does not decode, and the invocation refuses before dispatch; no non-canonical spelling is repaired and no undeclared fallback is invented. The pin above requires the decode before dispatch but assigns its failure no outcome, and only one outcome is available to it: §3.2's vocabulary reserves a loud protocol error for a wire fact, and at that point no wire fact exists. It is the disposition this section already states for a lone surrogate escape on a supplied request value and for a supplied null at the character-data lane.

**[exclusion]** This specification does not generate XML from an object model because the finite XML Object annotations do not determine ordering, escaping, nulls, dynamic keys, or scalar lexical forms; the selected XML media lane is excluded at its smallest owner unless incorporated authority defines those bytes, while string and raw-octet XML carriage remain admitted ([OAS 2.0 XML Object](https://spec.openapis.org/oas/v2.0.html#xml-object)).

**[exclusion]** A selected non-JSON lane admitted by none of the character-data, artifact-encoded `byte`, raw-octet, string XML, or request-only §8.3 form lanes is excluded at its smallest media owner because OAS supplies no value-to-bytes mapping; the exclusion reopens only if incorporated authority defines that media/data-form cell.

**[exclusion]** The form and multipart lanes are request-only: the incorporated authority's form and multipart sections are request-scoped by their own headings and supply no reverse mapping from those bytes to an application value, so a response selection of either lane is excluded at its smallest media owner. The exclusion reopens only if an incorporated authority defines that decoding.

**[incorporated]** Invoking this binding does not trigger validation of any application value against its governing Schema Object; only a tool that separately claims validation owes Core's validation rules (Core [invariant 2](../../openbindings.md#2-core-invariants), [OBI-T-16](../../openbindings.md#103-tool-rules)). This rule does not reach the two declaration-reading checks this specification states in its own right — §5.2's `readOnly` request obligation and §8.1's inline non-body assertions — neither of which is validation of an application value against a governing Schema Object.

### 9.3 HTTP content codings

**[incorporated]** HTTP `Content-Encoding` is distinct from media type; request codings apply in listed wire order and response codings decode in reverse order before the selected media lane ([RFC 9110 §8.4](https://www.rfc-editor.org/rfc/rfc9110#section-8.4)).

**[incorporated]** HTTP field names compare ASCII case-insensitively ([RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

**[convention]** OAS 2.0 designates no surface for content codings, so this specification designates the only two positions in which the artifact can name a field: an effective request header parameter named `Content-Encoding`, and a governing response Header Object of that name. No other artifact position declares a content coding under this identifier, and the case-insensitive comparison above applies to both ([OAS 2.0 Parameter Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-6), [Header Object](https://spec.openapis.org/oas/v2.0.html#header-object)).

**[exclusion]** Two governing response Header Object keys that differ only by ASCII case and govern binding behavior — the content-coding surface — exclude the smallest owning response alternative before any actual response is inspected; the exclusion reopens only if an incorporated authority defines a wire mapping that preserves such case-distinct declarations.

**[configuration point]** `requestContentCodings` and `responseContentCodings` are finite consumer maps from case-insensitive content-coding tokens to deterministic encoders and decoders; on requests the caller-supplied effective `Content-Encoding` header parameter value fixes the encoder stack, while on responses the actual value governed by the Response Header Object fixes the decoder stack, and no configuration preference narrows either declared surface; two configuration tokens in either map that collide after ASCII case-folding are not a usable configuration, and an invocation reading that map refuses before dispatch, mirroring §9.1's normalized-identity collision rule.

**[configuration point]** An unsupported token, a field value not admitted by its governing declaration, an ambiguous coding declaration, or an actual response coding with no governing Header Object is never skipped or sniffed: a request-side condition refuses before dispatch and a response-side condition is a loud protocol error; configuring a codec supplies capability but never declares a coding the artifact omitted.

### 9.4 Response declaration, classification, and decoding

**[incorporated]** Every Operation requires a Responses Object, and that object MUST contain at least one response code ([OAS 2.0 Operation and Responses Objects](https://spec.openapis.org/oas/v2.0.html#responses-object)).

**[pin]** OAS's "at least one response code" names the Responses Object's patterned status-code fields, not its `default` fixed field, so a Responses Object carrying `default` alone violates that MUST. This specification pins the permissive reading and discloses it: at least one exact status Response **or** `default` satisfies the requirement here, because `default` governs every status not covered individually and a Responses Object carrying it is therefore not a Responses Object that governs nothing. A `default`-only artifact remains upstream-invalid on OAS's own terms; this specification declines to make that upstream violation destroy a target it can address ([OAS 2.0 Responses Object](https://spec.openapis.org/oas/v2.0.html#responses-object)).

**[exclusion]** Omitting the required Responses Object or providing one with no exact status or `default` Response is a declaration defect that excludes the selected operation under §3.2's smallest-owner rule. The exclusion reopens only if an incorporated OAS 2.0 authority admits the exact declaration.

**[incorporated]** A Responses Object is closed to exact HTTP status-code keys, `default`, and specification extensions, with no range-key form ([OAS 2.0 Responses Object](https://spec.openapis.org/oas/v2.0.html#responses-object)).

**[pin]** "Exact HTTP status-code key" is pinned here as a grammar, not delegated to a registry. An admitted status key is exactly three ASCII digits whose first digit is `1` through `5`, with no sign, no leading or trailing whitespace, no leading-zero or four-digit variant, and no reason phrase; `default` and `x-` prefixed keys are the only other admitted members. Registration status is irrelevant: `299` and `599` are admitted keys whether or not IANA has registered them, and `0`, `99`, `600`, `20`, `0200`, and `200 OK` are not admitted. OAS 2.0 reaches the mutable IANA Status Code Registry through its own §5.3, and this specification does not follow it there, for the same reason §9.2 refuses the live media-type registry: a mutable authority must not decide an exclusion ([OAS 2.0 §5.3 HTTP Status Codes](https://spec.openapis.org/oas/v2.0.html#http-status-codes), [RFC 9110 §15](https://www.rfc-editor.org/rfc/rfc9110#section-15)).

**[exclusion]** A Responses key outside that closed admitted set is a declaration defect that excludes the selected target before any actual response is inspected; the exclusion reopens only if an incorporated OAS 2.0 authority admits that exact key form.

**[exclusion]** An upstream-invalid governing Response Object — one that is not a Response Object at all, or one violating the Response Object's fixed-field constraints: a `description` that is not a string, a `schema` that is not a Schema Object, a `headers` or `examples` value that is not a map, or a `headers` member that is not a Header Object — is a declaration defect that excludes the selected target before any actual response is inspected, because response governance is target-level; the exclusion reopens only if an incorporated OAS 2.0 authority admits the exact declaration ([OAS 2.0 Response Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-9)).

**[limit]** The exclusion above reaches only a Response Object that can GOVERN a SUCCESSFUL response: an exact 2xx status key, or `default`. `default` is always such a declaration here, and that is a stated rule rather than a consequence of the key set: an artifact could enumerate `200` through `299` and leave `default` unable to govern any success, but making the exclusion turn on an exhaustiveness computation over a hundred keys would put a target's existence behind an arithmetic the reader must redo, so `default` counts as a potential governing success declaration in every artifact. A fixed-field violation in a declaration that can never govern a 2xx status incurs no coverage loss — a failure body is decoded best-effort under this same section, so a defect in a declaration that can never govern a 2xx status can only leave the failure data undecoded and can never misstate a value this operation contract carries — and therefore does not exclude: a target whose success declarations are intact stays represented. It is the same no-coverage-loss reasoning that carves out the `description` omission below ([OAS 2.0 Responses Object](https://spec.openapis.org/oas/v2.0.html#responses-object)).

**[limit]** One violation is carved out and does not exclude: a governing Response Object that omits its REQUIRED `description` while declaring no `schema` incurs no coverage loss — nothing it states about a response body is misdeclared — and the selected target remains represented. The same omission WITH a declared `schema` excludes as above, and a `description` that is present with a non-string value is a fixed-field violation rather than an omission and excludes as above.

**[convention]** The governing Response Object lookup order is exact status, then `default`; declarations never reclassify the native status.

**[incorporated]** RFC 9110 defines the 2xx class as successful ([RFC 9110 §15.3](https://www.rfc-editor.org/rfc/rfc9110#section-15.3)).

**[convention]** For this binding, success means that the final status—the status after any interim responses and any redirects the runtime chose to follow with the bound method and complete body preserved—is in that 2xx class; a method-rewriting redirect is the final response of this interaction, and anything a runtime does after it is a different interaction outside this classification.

**[convention]** Redirect following is runtime policy. A redirect followed with the bound method and complete body preserved remains this interaction; a method-rewriting redirect is a final response of this interaction ([RFC 9110 §15.4](https://www.rfc-editor.org/rfc/rfc9110#section-15.4)).

**[limit]** Outcome classification depends on the final status, while redirect following and transport content negotiation, including a runtime-advertised `Accept-Encoding`, are runtime policy under Core §1.2. Two conformant runtimes MAY therefore classify one wire history differently, and that redirect/negotiation variance is the stated permitted set; the binding itself emits no negotiation field beyond those this specification pins (Core [§1.2](../../openbindings.md#12-out-of-scope)).

**[incorporated]** A governing Response Object without `schema` declares that no response content is returned ([OAS 2.0 Response Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-9)).

**[incorporated]** A response Header Object has no `required` field; the required-response-header question is therefore inapplicable ([OAS 2.0 Header Object](https://spec.openapis.org/oas/v2.0.html#header-object)).

**[limit]** An actual nonempty body governed by a Response Object without `schema` is a loud protocol error.

**[incorporated]** The effective `produces` this section reads is the operation-level set §9.1 states. The Response Object declares no `produces` of its own and contributes nothing to that set: its fixed fields are `description`, `schema`, `headers`, and `examples`, and the only `produces` its prose mentions is the operation's ([OAS 2.0 Response Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields-9)).

**[convention]** A non-empty response with a governing schema selects its concrete media type from `Content-Type`, which MUST match the effective `produces` set under §9.1 before the schema's carriage lane decodes it.

**[convention]** When a non-empty response omits `Content-Type`, the binding takes RFC 9110's permitted `application/octet-stream` assumption before ordinary matching; the resulting type still MUST match an effective `produces` declaration ([RFC 9110 §8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3)).

**[convention]** A response carrying two or more `Content-Type` fields, or one whose single field value is a list of media types, selects no media type: RFC 9110 §8.3 names that shape by name as an interoperability and security hazard and defines no resolution for it, and picking the first, the last, or a most-specific member would be this binding choosing an application value from an ambiguity the sender created. On a successful response it is a loud protocol error; on an unsuccessful one it is an unmatched media type under the best-effort failure-body rule below, yielding no failure-data value and no protocol error ([RFC 9110 §8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.3)).

**[convention]** An unmatched, ambiguous, normalized-colliding, or absent effective response media declaration is a loud protocol error on a successful response; on an unsuccessful one the best-effort failure-body rule governs, and no loud protocol error is raised; no bytes are sniffed and no undeclared fallback is invented.

**[convention]** An **empty response** has zero content octets after transfer decoding and content-coding decoding; a response to HEAD is empty by definition.

**[convention]** Empty responses emit no output value; successful non-empty responses emit the selected lane's one application value.

**[convention]** A failure body is decoded through the same selected carriage lanes as a successful body, and the decoded value is carried as opaque application-authored failure data on unsuccessful completion. That decoding is best-effort: when the governing content declaration is defective, or when no governing content declaration matches the actual media type, the interaction completes unsuccessfully with no failure-data value and raises no loud protocol error. A failure declaration is therefore not load-bearing for representation, which is the reason the success-scoped exclusion above gives. A governing Response Object that declares no response content at all is not such a case: it states positively that no content is returned, so an actual non-empty body under it contradicts a declaration and remains a loud protocol error whatever the final status.

**[convention]** The unary response value commits only after transfer completion and the full decode chain — content codings, then character decoding, then the selected lane — succeed; any failure after a 2xx final status and before that commit is a loud protocol error, and the interaction completes unsuccessfully with no partial unary value.

**[limit]** A non-empty response with no governing exact or `default` Response Object is a loud protocol error.

**[limit]** This specification defines no response-header carriage in an operation value, so Response Header Objects create no output members under this identifier; consequently, even a declared `Location` header on a `201` response reaches no operation value ([OAS 2.0 Response and Header Objects](https://spec.openapis.org/oas/v2.0.html#response-object)).

**[limit]** One HTTP response body produces at most one operation value: OAS 2.0 defines the response schema as the complete body and supplies no construct that frames it into multiple application values ([OAS 2.0 Response Object](https://spec.openapis.org/oas/v2.0.html#response-object)).

## 10. Target URL

**[incorporated]** The target is the effective scheme plus `://`, effective `host`, effective `basePath`, and the exact Paths key: Operation `schemes` replaces root `schemes`; absent root schemes use the document-retrieval scheme; absent `host` uses the host serving the document; and an absent `basePath` means the API is served directly under the host ([OAS 2.0 Swagger, Operation, and Paths Objects](https://spec.openapis.org/oas/v2.0.html#fixed-fields)).

**[pin]** An absent `basePath` therefore contributes no path segment: the exact Paths key is appended directly to the host with no synthetic `/` and no `//` composition. An authored `basePath: "/"` instead keeps its authored byte, and the resulting `//` stands under the no-normalization rule below.

**[incorporated]** An absent `host` inherits both the host and port from the document-retrieval URI; omitting the retrieval port would not preserve the authority that serves the document ([OAS 2.0 Swagger Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields)).

**[configuration point]** One effective `http` or `https` scheme selects itself; multiple usable schemes require one consumer `server` choice before dispatch, and no list-order preference is inferred.

**[limit]** When an omitted scheme inherits a document-retrieval scheme outside `http`, `https`, `ws`, or `wss`, the target is unusable and refuses before dispatch.

**[limit]** An empty effective scheme list, or an omitted scheme or host without a document location from which its default can be obtained, leaves the target unresolved and refuses before dispatch; a complete configured URL below remains the available recovery.

**[exclusion]** An effective `ws` or `wss` scheme is unusable under this identifier because OAS 2.0 defines only the target URI scheme and supplies no handshake, subprotocol, direction, message, framing, or close correspondence. The exclusion reopens only if incorporated authority defines those semantics ([OAS 2.0 Swagger and Operation Objects](https://spec.openapis.org/oas/v2.0.html#fixed-fields-4)).

**[incorporated]** `host` contains neither scheme nor sub-path, `basePath` begins with `/`, and each Paths key begins with `/` and is appended to `basePath` ([OAS 2.0 Swagger and Paths Objects](https://spec.openapis.org/oas/v2.0.html#paths-object)).

**[exclusion]** Those constraints carry a stated consequence, because concatenation without them silently dispatches somewhere the artifact never named. A root `host` that contains a scheme, a sub-path, userinfo, a query, or a fragment, an effective `basePath` that does not begin with `/` or that carries a query or fragment, or a Paths key that does not begin with `/`, is a declaration defect: a defective `host` or `basePath` excludes every operation the Swagger Object governs, and a defective Paths key excludes only the operations under it. The check is on the declaration, before caller values and before §10's RFC 3986 well-formedness check, which does not catch these cases — `basePath: "v1"` concatenated onto `api.example.com` parses cleanly as the authority `api.example.comv1`. The exclusion reopens only if an incorporated OAS 2.0 authority defines the repair ([OAS 2.0 Swagger Object](https://spec.openapis.org/oas/v2.0.html#fixed-fields), [Paths Object](https://spec.openapis.org/oas/v2.0.html#paths-object)).

**[limit]** The resolved target base therefore carries no query component and no fragment, and this is the constraint the `server` configuration point below requires a complete configured URL to satisfy.

**[convention]** Target construction performs no slash normalization, path repair, dot-segment rewrite, query merge, or second relative-reference resolution; exact base-path and Paths-key bytes are concatenated before parameter assembly.

**[convention]** After path and query serialization, the completed target MUST parse and percent-decode under RFC 3986; an unusable target refuses before dispatch ([RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)).

**[convention]** That parse and percent-decode is a well-formedness check only: the dispatched bytes are the constructed percent-encoded bytes, and the completed target is never dispatched in decoded form.

**[configuration point]** The `server` configuration point MAY instead supply one complete consumer-configured URL. That URL is itself a valid `server` value and by itself discharges any required member choice; it MUST satisfy the same scheme and no-query/no-fragment constraints as an artifact-resolved target base, it replaces the resolved server base — the effective scheme, `host`, and `basePath` — and the operation's path bytes append verbatim to it; the artifact's path template, path substitution, query construction, method, parameters, payload, response, and security semantics remain unchanged.

## 11. Security and channel assembly

**[incorporated]** Operation `security` replaces root `security`; `[]` clears the root requirement, array members are OR alternatives, and every named member of one Security Requirement Object is required as an AND ([OAS 2.0 Swagger, Operation, and Security Requirement Objects](https://spec.openapis.org/oas/v2.0.html#security-requirement-object)).

**[convention]** `{}` is a vacuously satisfiable empty AND and therefore a complete anonymous alternative; this is this specification's reading of OAS's stated AND semantics, not an assertion that OAS assigns separate prose to the empty object.

**[configuration point]** The binding preserves every complete alternative and invents no anonymous-versus-credentialed preference. The named configuration point `security` selects one complete alternative: a sole declared alternative selects itself, and an effective empty `[]` or anonymous optional-security alternative counts as a complete no-security alternative; multiple alternatives require an explicit choice, fragments from different alternatives are never combined, and an invocation with no selection where one is required refuses before dispatch.

**[incorporated]** Only root `securityDefinitions` names schemes, and a Security Requirement activates a named definition ([OAS 2.0 Security Definitions and Security Requirement Objects](https://spec.openapis.org/oas/v2.0.html#security-definitions-object)).

**[pin]** "Root" is the entry document's root, always. §5.1 admits an externally referenced Path Item, whose own document has a root of its own and may carry its own `securityDefinitions`; OAS 2.0 states no scope rule for that case. This specification closes it in one direction and names no configuration point for the other: a Security Requirement name — whether it appears in root `security` or in an Operation reached through an external Path Item reference — resolves in the entry document's `securityDefinitions` and nowhere else, and a referenced document's `securityDefinitions` is an unused reusable position that contributes no scheme and no coverage ([OAS 2.0 Security Definitions Object](https://spec.openapis.org/oas/v2.0.html#security-definitions-object)).

**[limit]** An unknown security-scheme name makes only that requirement alternative unusable rather than activating an extension or similarly named declaration.

**[incorporated]** A Security Scheme has exactly type `basic`, `apiKey`, or `oauth2`; an API key uses its declared `query` or `header` name, and OAuth2 uses exactly the `implicit`, `password`, `application`, or `accessCode` flow with its required authorization/token URLs and declared scopes ([OAS 2.0 Security Scheme Object](https://spec.openapis.org/oas/v2.0.html#security-scheme-object)).

**[exclusion]** A Security Scheme Object that is not one — a missing or unlisted `type`, or an absent or wrong-typed field its `type` makes REQUIRED — excludes every security alternative naming it, before any runtime credential is inspected, because the declaration fixes neither what to send nor where. Every remaining complete alternative survives, and a target left with no complete alternative is itself excluded under §3.2's smallest-owner rule. The exclusion reopens only if an incorporated OAS 2.0 authority admits the exact declaration ([OAS 2.0 Security Scheme Object](https://spec.openapis.org/oas/v2.0.html#security-scheme-object)).

**[incorporated]** An OAuth2 Security Requirement array contains every scope required for execution, while the array for a `basic` or `apiKey` requirement MUST be empty ([OAS 2.0 Security Requirement Object](https://spec.openapis.org/oas/v2.0.html#security-requirement-object)).

**[limit]** A nonempty requirement array for `basic` or `apiKey` makes only that security alternative unusable; the defect is confined and reported loudly, and another complete alternative may still be selected.

**[pin]** A selected `basic` scheme consumes a runtime-supplied user-id and password and constructs `Authorization: Basic base64(user-id ":" password)` under [RFC 7617 §2](https://www.rfc-editor.org/rfc/rfc7617#section-2), including its user-id, password, and Base64 constraints. Because RFC 7617 §2 deliberately leaves the default character encoding undefined, the user-id and password octets are pinned to printable US-ASCII (0x20–0x7E); a credential containing any other character leaves the selected alternative unusable, and the invocation refuses before dispatch. This pin reopens only if an incorporated authority defines a charset-parameter declaration surface for the scheme.

**[pin]** A selected `apiKey` scheme consumes a runtime-supplied key value and emits it at the declaration's exact query or header destination.

**[pin]** A selected OAuth2 scheme consumes a runtime-supplied access token and uses the `Bearer` authorization scheme under [RFC 6750 §2.1](https://www.rfc-editor.org/rfc/rfc6750#section-2.1); token acquisition and every non-Bearer token type have no wire carriage under this identifier.

**[convention]** Whether a supplied credential satisfies a required scope is the counterparty's own determination and is never evaluated by this binding: a scope string is surfaced exactly as declared — in the alternative's requirement data and in any context challenge — and no incorporated authority defines a way for a client to read a token's grants without invoking an endpoint, which this binding never does. An OAuth 2.0 alternative is complete when its scheme's runtime access token is supplied; a token the counterparty finds insufficient produces that counterparty's own response, which classifies under §9's ordinary response rules like any other outcome.

**[convention]** The runtime half is separate and is a prerequisite, not an exclusion: a runtime whose supplied token is not Bearer-typed leaves the selected alternative unusable, and the invocation refuses before dispatch, exactly as a Basic credential outside the pinned octet range does under §11. Token type is a runtime fact and never a declaration fact, so it can reach no coverage entry.

**[convention]** A credential destination that collides with an effective parameter, another credential in the same AND requirement, or binding/processor-owned `Host`, `Content-Length`, or `Content-Type` makes only the selected security alternative unusable; another complete non-colliding alternative may still be selected. `Accept` is an ordinary effective parameter destination and collides under that ordinary parameter rule.

**[convention]** Header destinations compare ASCII case-insensitively, query destinations compare exact names, and an API-key query value uses §8.2's query percent-encoding; credential values never enter the caller envelope or operation contract ([RFC 9110 §5.1](https://www.rfc-editor.org/rfc/rfc9110#section-5.1)).

## 12. Configuration, synthesis, and conformance

### 12.1 Configuration vocabulary

**[configuration point]** The complete binding-specific configuration vocabulary is `requestMedia` (one concrete media type), `server` (one effective scheme plus the artifact's effective `host`/`basePath` target, or one complete consumer-configured URL replacing the resolved server base), `security` (selection of one complete security alternative), `parameterConversion` (deterministic non-string-scalar converter), `emptyValueForm` (`name-only` or `empty`), `requestContentCodings` (coding-to-encoder map), `responseContentCodings` (coding-to-decoder map), and conditional `propertyMedia` (one concrete media type for the multipart part of each `file` form parameter).

**[configuration point]** Every requirement is typed and discoverable from declarations. Preflightability is bounded: a requirement whose applicability is fixed by declarations alone is preflightable as an actual requirement, while `requestMedia` and `parameterConversion` are conditional on supplied values and are preflightable only as POSSIBLE requirements — a preflight can name them and their type but cannot know whether a given invocation will trigger them. No configuration member appears in the caller envelope or operation contract. Lane selection, carriage, and response classification are fixed rules rather than configuration points; content-coding codecs are the one exception and are configured, by `requestContentCodings` and `responseContentCodings`, which supply capability for a coding the artifact declares and never declare one it omitted.

### 12.2 Synthesis boundary and coverage

**[incorporated]** Operation contracts remain protocol-neutral (Core [§5.1](../../openbindings.md#51-operations), [invariant 1](../../openbindings.md#2-core-invariants)) and MAY remain flat (Core [§5.5](../../openbindings.md#55-transforms)).

**[convention]** Synthesis emits an `inputTransform` that constructs §7's envelope, and transforms never route values to HTTP locations.

**[convention]** This binding defines no status, header, selected-media, or other context bindings at `inputTransform` or `outputTransform` positions; evaluation uses Core's closed environment unaugmented (Core [§5.5 clause 5](../../openbindings.md#55-transforms), [OBI-T-10](../../openbindings.md#103-tool-rules)).

**[limit]** Synthesis emits flat protocol-neutral operation contracts together with an `inputTransform` that constructs §7's envelope: the envelope is the binding-boundary value, never the emitted operation contract, and qualified location-keys appear only in the transform's output. §12.2 licenses `inputTransform` and `outputTransform` as synthesis outputs, and operation/dependency key spelling, flattening, output-schema choice, and Schema Object translation as synthesis policy; no other input-restructuring apparatus exists under this identifier.

**[convention]** Schema Object translation preserves the declared value domain up to representability: a synthesizer MUST account a lossy or non-equivalent Schema Object translation as coverage loss at its owning position, and output-schema choice carries no further soundness latitude.

**[incorporated]** OAS 2.0's closed object inventory contains no callback or webhook declaration, so this sibling synthesizes no inbound dependency surface from the artifact ([OAS 2.0 §6.4](https://spec.openapis.org/oas/v2.0.html#specification)).

**[convention]** A synthesizer MUST account for every addressable operation as represented; invalid, where its declaration is upstream-invalid; excluded, with the exact reason stated beside the applicable exclusion; lossy, where a translation loses declared domain; or implementation-unsupported. The statuses and their spellings are the published interface-synthesizer contract's own, adopted here rather than respelled; a failure in an unused description position is coverage loss rather than invocation behavior.

**[convention]** Every binding-specific configuration requirement remains in coverage accounting and invocation context, assigned to its represented target or declared alternative, and MUST NOT enter the operation input schema.

### 12.3 Conformance rules

**[convention]** A document conforms to **OAPI20-D-01** when its `content`, if present, satisfies §§3–5 and its `location`, if present, satisfies §4.

**[convention]** A binding conforms to **OAPI20-D-02** when it names `openbindings.openapi-2.0@1`, carries the literal selector of §6, and identifies a source that passes the `swagger` load gate. That verdict is decided over the interpreted artifact, never over the binding's text alone: for a location-only source it follows §4's required retrieval, so conformance to this rule is not a property of the OBI document in isolation.

**[convention]** Where a location-only source's dereference does not yield a representation, this rule is **unverified** rather than violated, and a verifier reporting an overall conclusion reports **conformance undetermined** absent an established violation elsewhere; an unavailable or policy-declined external resource is not evidence of violation. Core [§10.5](../../openbindings.md#105-verification-conclusions) states that treatment for Core's own rules over network-inaccessible resources; this specification extends the same treatment, by its own convention, to this network-dependent rule of its own.

**[convention]** A processor conforms to **OAPI20-P-01** when it implements the closed load gates, smallest-owner confinement, reference closure, Schema Object dialect, and selector semantics of §§3–6.

**[convention]** A processor conforms to **OAPI20-P-02** when it accepts only §7's envelope, applies §8's effective-parameter, collision, conversion, collection, location, empty, and form rules, and refuses every unknown or unroutable input before dispatch.

**[convention]** A processor conforms to **OAPI20-P-03** when it preserves media alternatives and applies §9's matching, request election, carriage, content-coding, response lookup, classification, and unary-boundary rules without sniffing or undeclared fallback.

**[convention]** A processor conforms to **OAPI20-P-04** when it resolves complete target URLs under §10 and security alternatives, credentials, scopes, and channel collisions under §11.

**[convention]** A synthesizer conforms to **OAPI20-S-01** when it preserves §12.2's binding/transform boundary, emits no artifact-derived inbound dependency, accounts every lossy or non-equivalent Schema Object translation as coverage loss, and reports complete operation coverage under Core OBI-B-02.

**[exclusion]** Every exclusion in this document is permanent under `openbindings.openapi-2.0@1`, belongs to the smallest owner stated beside it, and reopens only on its stated incorporated-authority trigger; no exclusion promises later work.

### 12.4 Permitted variation and stated limits

**[convention]** This section is a register. It collects in one place the variation this specification permits — the points at which a rule stated here lets two implementations conforming to `openbindings.openapi-2.0@1` produce different bytes or different outcomes and both remain conformant — together with the consumer choices this specification defers, the exclusions that bound its accepted domain, and the things it states it does not cover. It does not collect divergence at a point §2's item map records as an incomplete chain, because it does not permit such divergence; the closing paragraph of this section states what that record does and does not license. It creates nothing: every entry names the section that states it, and where an entry and that section differ, the section governs. Its tables carry no per-row provenance label for that reason. The register is a statement about the rules it names and about nothing else; it makes no claim about this document as a whole.

**[convention]** These are the points at which a rule of this specification permits two conformant implementations to differ. Each row names what varies, where the rule permitting it is stated, and what holds across the permitted set.

| what varies | where | what holds across the permitted set |
| --- | --- | --- |
| the order in which query contributions from different parameters appear in the completed request-target | §8.2 | each contribution's own percent-encoded bytes, and array-member order within one parameter |
| the order in which `application/x-www-form-urlencoded` pairs from different parameters appear | §8.3 | each pair's bytes, and array-member order across the repeated pairs of one `multi` parameter |
| the order in which multipart parts belonging to different parameters appear | §8.3 | each part's own bytes and headers, and member order across the repeated parts of one array |
| the multipart boundary token, and the optional quoting the incorporated grammar permits for it on the media-type field | §8.3 | the entity framing itself — opening, inter-part, and closing delimiters — and that the token appears inside no encapsulated part |
| the wire form of a JSON number outside binary64's range or precision | §9.2 | exactly two behaviors are permitted — the exact lexical form carried through, or reduction to the nearest finite binary64 value. Any other substitution, refusal, and truncation of the surrounding document are outside the permitted set, and every number binary64 represents has one answer |
| which character encodings beyond UTF-8 a processor can decode | §9.2 | UTF-8 decoding is required; the absence of any further charset refuses loudly rather than substituting, guessing, or sniffing |
| whether a redirect is followed, and what transport content negotiation a runtime performs | §9.4 | outcome classification depends on the final status alone, and the binding emits no negotiation field beyond those this specification pins. Two conformant runtimes MAY therefore classify one wire history differently |
| whether a processor retrieves from a `location` co-present with `content` | §4 | nothing turns on it: `content` remains the interpreted artifact, and an elective retrieval that does not complete, or that yields something else, changes no observable and is not a defect |
| how a processor names and presents a confined defect | §3.2 | the excluded target and the declaration position responsible are reported; no defect class, per-class authority citation, or per-defect coverage entry is required, and this specification defines no such classes |
| the serialized bytes of any JSON image this specification emits — a JSON-lane request body, a content-form parameter value, or a compound form or multipart property riding as `application/json`: object member order, insignificant whitespace, which of `\uXXXX` or a literal the escapable characters take, and the lexical spelling of a number whose value is fixed | §9.2 | the JSON **value** is identical, which is what this specification fixes and what every rule of it is stated over; RFC 8259 constrains the grammar and not the choice among its equivalent spellings, so this latitude reaches wire bytes and reaches no value, no assertion, and no outcome |

**[convention]** §12.1 states the complete configuration vocabulary and bounds each member's preflightability; lane selection, carriage, and response classification are fixed rules and are not configuration points. Each member's boundary, chooser, and unsupplied-choice consequence is stated at the rule that introduces it, and is collected here.

| configuration point | boundary | who chooses | consequence when no choice is supplied |
| --- | --- | --- | --- |
| `requestMedia` (§9.1) | one concrete media type matching an admissible effective `consumes` alternative under §9.1; it never substitutes another lane's schema or form rules, and supplied values never elect | the consumer | a missing required choice, an unmatched or ambiguous choice, an unsupported selected lane, or a form selection inconsistent with effective `formData` refuses before dispatch |
| `server` (§10) | one effective `http` or `https` scheme with the artifact's effective `host` and `basePath`, or one complete URL satisfying the same scheme and no-query/no-fragment constraints and replacing the resolved server base | the consumer | multiple usable schemes require a choice before dispatch, and no list-order preference is inferred; an empty effective scheme list, or an omitted scheme or host with no document location supplying its default, leaves the target unresolved and refuses before dispatch |
| `security` (§11) | one complete declared alternative, an effective `[]` or anonymous alternative included; fragments from different alternatives are never combined | the consumer | an invocation with no selection where one is required refuses before dispatch |
| `parameterConversion` (§8.1) | one deterministic conversion from each supplied JSON boolean, number, or null to a string, applied to array members alike, with strings passing identically | the consumer | any supplied non-string scalar with no configured result refuses before dispatch |
| `emptyValueForm` (§8.1) | exactly `name-only` or `empty`, and only where those two admitted spellings produce distinct bytes — a `query` or `formData` parameter declaring `allowEmptyValue: true`, and nowhere else | the consumer | no binding default prefers either spelling; a supplied empty string at such a parameter refuses before dispatch |
| `requestContentCodings` (§9.3) | a finite map from case-insensitive coding tokens to deterministic encoders; it supplies capability and never declares a coding the artifact omitted, and no configuration preference narrows the declared surface | the consumer | an unsupported token, a field value the governing declaration does not admit, or an ambiguous coding declaration refuses before dispatch, as does a map whose tokens collide after ASCII case-folding |
| `responseContentCodings` (§9.3) | a finite map from case-insensitive coding tokens to deterministic decoders, on the same terms | the consumer | the same conditions on the response side are a loud protocol error, and a case-folding collision in the map refuses before dispatch |
| `propertyMedia` (§8.3, conditional) | one concrete media type for the multipart part of each present `file` form parameter | the consumer | an absent or invalid choice refuses before dispatch |

**[convention]** Four of those boundaries are constraints rather than enumerations: `parameterConversion`, `requestContentCodings`, and `responseContentCodings` admit any function meeting the stated determinism and finiteness conditions, and `server`'s complete-URL form admits any URL meeting the stated scheme and no-query/no-fragment constraints. Two consumers that configure them differently obtain different bytes from one artifact and one invocation. That difference is the consumer's own, as §8.1 already states of a non-injective conversion; it is not variation between implementations given the same configuration.

**[convention]** §12.3 states the exclusion discipline: every exclusion is permanent under this identifier, belongs to the smallest owner stated beside it, reopens only on its stated incorporated-authority trigger, and promises no later work. The exclusions are the following, each with the trigger that would reopen it.

| what is removed from the accepted domain | where | reopens only if |
| --- | --- | --- |
| a selected operation whose Path Item `$ref` collides with the adjacent declaration in a fixed field that target uses | §5.1 | an incorporated OAS 2.0 authority defines the collision |
| a request lane whose resolved declaration both requires a property and marks it `readOnly: true` | §5.2 | incorporated authority defines a reconciliation |
| an operation carrying duplicate effective parameters in one location | §7 | an incorporated OAS 2.0 authority admits such duplicates |
| a target carrying two effective header parameters whose names differ only by ASCII case | §7 | an incorporated authority defines a wire mapping preserving such case-distinct declarations |
| a target declaring `collectionFormat: multi` on a `path` or `header` parameter | §8.2 | an incorporated OAS 2.0 authority admits `multi` at that location or defines its wire meaning |
| a non-body array whose resolved Items declaration declares only `array` | §8.2 | incorporated authority defines nested-array serialization |
| a target carrying an effective header parameter named `Host`, `Content-Length`, or `Content-Type` | §8.2 | an incorporated HTTP authority defines caller control preserving the processor's framing, routing, and selected-body-media obligations |
| a `file` parameter selected through `application/x-www-form-urlencoded` | §8.3 | incorporated authority defines that cell |
| the HTML-permitted transfer-encoded part: no `Content-Transfer-Encoding` is emitted | §8.3 | an incorporated authority defines its interaction with exact-octet part carriage |
| the HTML-permitted untyped file part | §8.3 | an incorporated authority defines an untyped file part's receiver semantics |
| the multipart alternative for a form parameter name that cannot be represented safely as the `name` parameter, CR and LF included | §8.3 | incorporated authority defines an unambiguous encoding |
| the body and `formData` lanes of an operation whose effective `consumes` set is empty | §9.1 | incorporated OAS 2.0 authority defines a body-media default |
| a supplied body or `formData` payload on GET, HEAD, DELETE, or OPTIONS, at that request lane | §9.1 | incorporated authority defines the cell |
| generation of XML from an object model, at the selected XML media lane | §9.2 | incorporated authority defines ordering, escaping, nulls, dynamic keys, and scalar lexical forms |
| a selected non-JSON lane admitted by none of the character-data, artifact-encoded `byte`, raw-octet, string XML, or request-only §8.3 form lanes | §9.2 | incorporated authority defines that media/data-form cell |
| a response selection of the form or multipart lane | §9.2 | an incorporated authority defines that decoding |
| a response alternative carrying two governing Header Object keys that differ only by ASCII case on the content-coding surface | §9.3 | an incorporated authority defines a wire mapping preserving such case-distinct declarations |
| an operation omitting the required Responses Object, or providing one with no exact status or `default` Response | §9.4 | an incorporated OAS 2.0 authority admits the exact declaration |
| a target carrying a Responses key outside the closed admitted set | §9.4 | an incorporated OAS 2.0 authority admits that exact key form |
| a target carrying an upstream-invalid Response Object that can govern a successful response | §9.4 | an incorporated OAS 2.0 authority admits the exact declaration |
| an effective `ws` or `wss` scheme | §10 | incorporated authority defines the handshake, subprotocol, direction, message, framing, and close correspondence |
| the operations governed by a `host`, `basePath`, or Paths key that violates the incorporated concatenation constraints | §10 | an incorporated OAS 2.0 authority defines the repair |
| every security alternative naming a Security Scheme Object that violates the incorporated `type` set or a field its `type` makes REQUIRED | §11 | an incorporated OAS 2.0 authority admits the exact declaration |
| a retrieved document encoded in UTF-16 or UTF-32, which YAML 1.2.2 §5.2 obliges a processor to support | §3.1 | an incorporated authority defines a declaration surface stating a retrieved document's character encoding without inspecting its bytes |

**[convention]** This register collects every statement in this document of something it does not cover, whatever provenance label that statement carries. Most carry `limit`, and that label marks two kinds of paragraph: a rule that confines a defect or an outcome to a stated scope, which is an ordinary rule and does not belong here, and a statement of something this specification does not cover, which bounds what a consumer may expect of it and does. Two further kinds meet the same test although they carry `pin` rather than `limit`, and belong here: a disclosed departure from an incorporated authority that leaves something unobtainable or unrestorable under this identifier, and a declined delegation — a route an incorporated authority offers, or a mutable registry it reaches, that this specification does not follow. The statements are the following.

| not covered under this identifier | where |
| --- | --- |
| any load gate outside §3.2's closed ordered set | §3.2 |
| a taxonomy for naming defects, a per-class authority citation, or a per-defect coverage entry | §3.2 |
| any source-scope exclusion: no source member or addressable target is filtered merely by its position in the source | §3.2 |
| binding behavior for an unknown non-extension field, which remains inert | §3.2 |
| a `filename` parameter on any multipart part, which no configuration point restores | §8.3 |
| any operation input or output member derived from an Example Object, and any selection an example could make | §9.1 |
| character encodings beyond the required UTF-8, which are an implementation capability | §9.2 |
| BOM-authoritative decoding of an XML entity, which no caller or receiver can obtain under this identifier | §9.2 |
| any consultation of a live or mutable registry: neither the media-type registry's `Encoding considerations` nor the IANA Status Code Registry that OAS 2.0 §5.3 reaches decides anything under this identifier | §9.2, §9.4 |
| numeric fidelity beyond the two permitted JSON-lane behaviors above | §9.2 |
| response-header carriage in an operation value, a declared `Location` on a `201` included | §8.2, §9.4 |
| any framing of one HTTP response body into more than one operation value | §9.4 |
| wire carriage for OAuth2 token acquisition and for every non-`Bearer` token type | §11 |
| any scheme or coverage contributed by a referenced document's own `securityDefinitions`, for which no configuration point is named | §11 |
| projection of a Schema Object assertion a synthesizer does not preserve exactly, and any silent translation of this dialect as 2020-12 | §5.2 |
| any input-restructuring apparatus beyond the `inputTransform` and `outputTransform` §12.2 licenses | §12.2 |

## 13. Normative references

- [OpenAPI Specification 2.0](https://spec.openapis.org/oas/v2.0.html)
- [YAML 1.2, 1 October 2009](https://yaml.org/spec/1.2-old/spec.html)
- [YAML 1.2.2](https://yaml.org/spec/1.2.2/)
- [HTML 4.01 §17.13.4](https://www.w3.org/TR/html401/interact/forms.html#h-17.13.4)
- [JSON Reference draft-03](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03)
- [JSON Schema Core draft-04](https://tools.ietf.org/html/draft-zyp-json-schema-04)
- [JSON Schema Validation draft-04](https://tools.ietf.org/html/draft-fge-json-schema-validation-00)
- [RFC 2046](https://www.rfc-editor.org/rfc/rfc2046)
- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119)
- [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339)
- [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)
- [RFC 4648](https://www.rfc-editor.org/rfc/rfc4648)
- [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750)
- [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838)
- [RFC 6839](https://www.rfc-editor.org/rfc/rfc6839)
- [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)
- [RFC 7159](https://www.rfc-editor.org/rfc/rfc7159)
- [RFC 7303](https://www.rfc-editor.org/rfc/rfc7303)
- [RFC 7617](https://www.rfc-editor.org/rfc/rfc7617)
- [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)
- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)
