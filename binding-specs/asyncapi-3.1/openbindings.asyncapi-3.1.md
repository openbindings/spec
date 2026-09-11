# `openbindings.asyncapi-3.1` Binding Specification

**Status: unreleased `@1` common-kernel plus payloadless plaintext-HTTP candidate.** This mutable page does not
mint `openbindings.asyncapi-3.1@1`. Its remaining publication gates include
completion of Core OBI-B-02 items 6 and 7 outside the cell admitted by §5,
additional protocol-profile specifications,
portable conformance evidence, independent implementation review, and the
explicit promotion change required by the [binding-specification
lifecycle](../README.md#publication-lifecycle). Until then, implementations
may cite it only as a candidate.

## 1. Identifier and rule labels

**[convention]** The opaque proposed identifier has exactly the spelling
**`openbindings.asyncapi-3.1@1`**.

**[convention]** OpenBindings Project publication mints §1's proposed
identifier; before that lifecycle event, this page is mutable and the
identifier is not project-published.

**[incorporated]** Once minted, the identifier is exact and stable under Core
[OBI-B-01](../../openbindings.md#104-binding-specification-rules), and an
incompatible change requires a different identifier under Core
[OBI-B-03](../../openbindings.md#104-binding-specification-rules).

**[incorporated]** The key words **MUST**, **MUST NOT**, **REQUIRED**,
**SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this
document are interpreted as described in [BCP
14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC
8174](https://www.rfc-editor.org/rfc/rfc8174) only when they appear in all
capitals.

**[convention]** Every normative paragraph and normative table row carries one
visible provenance label. `incorporated` attributes a rule to a cited
authority; `convention` chooses where no authority speaks; `pin` fixes one
reading; `configuration point` defers a named decision; `exclusion` removes a
feature behind a stated reopen condition; and `limit` states a boundary this
candidate does not cross.

## 2. Scope and incorporated authorities

**[convention]** This candidate defines the AsyncAPI 3.1 common kernel and one
payloadless plaintext HTTP/1.1 client profile:
artifact loading, source carriage, root-operation addressing, effective
channel/server membership, reference confinement, and exact §5 interaction.
It is independent of, and changes no rule in, the legacy
multi-edition AsyncAPI candidate.

**[pin]** This specification incorporates exactly version **0.2.0** of the
[OpenBindings Specification](../../openbindings.md) as its Core authority.
Throughout this document, **Core** means that exact version; no other Core
version is incorporated.

**[pin]** The sole artifact authority is [AsyncAPI Specification 3.1.0 at
commit
`b3fac5bb522771428ea57b16129b273cd3ea0180`](https://github.com/asyncapi/spec/blob/b3fac5bb522771428ea57b16129b273cd3ea0180/spec/asyncapi.md).
No mutable rendered page or later upstream edition alters this candidate.

**[incorporated]** [JSON Reference
draft-03](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03)
governs AsyncAPI Reference Objects at the scope AsyncAPI 3.1.0 incorporates it;
[RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) governs JSON Pointer
fragments and [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) governs their
URI-fragment percent encoding. [YAML 1.2.2](https://yaml.org/spec/1.2.2/) is
incorporated only at §3's pinned string-representation gate.

**[limit]** Operation and message trait merge processing is not part of this
slice, so this document does not incorporate RFC 7386. Recursive schema graphs,
schema-format semantics, schema translation, message payloads or headers,
replies, security, parameters, correlation, TLS, and every profile not
expressly admitted by §5 are likewise not interpreted.

**Where Core's completeness items are discharged.** Core
[OBI-B-02](../../openbindings.md#104-binding-specification-rules) names seven
required items. This reader map is informative rather than normative; the
numbered sections govern.

| Core OBI-B-02 item | Carried by | Incomplete boundary |
| --- | --- | --- |
| 1 — accepted artifact modes, representations, discrimination, non-JSON encoding | §§2–3 | none for the common-kernel domain |
| 2 — `location` syntax and meaning | §3 | retrieval success remains the address scheme's decision |
| 3 — `content` values and forbidden modes | §3 | none; no accepted source mode forbids `content` |
| 4 — `location`/`content` composition and reference base | §3 | none for the common-kernel domain |
| 5 — `selector`, including absence | §4 | none for the common-kernel domain |
| 6 — target and interaction identification | §§4–5 | complete only for §5's admitted payloadless plaintext HTTP cell; incomplete elsewhere |
| 7 — caller values and interaction outcomes | §5 | complete only for §5's exact empty-object input and HTTP outcome; incomplete elsewhere |

**[limit]** The incomplete item-map rows license no implementation choice as
portable meaning. They must be closed before this candidate can publish.

## 3. Source loading, carriage, and composition

**[incorporated]** A present `location` satisfies Core's absolute-location
floor (Core [OBI-D-05](../../openbindings.md#102-document-rules)). That floor
applies independently of how this candidate constrains the address or decodes
the retrieved representation.

**[convention]** This candidate accepts only an RFC 3986 absolute,
fragment-free URI,
and that URI addresses the entry document. This syntax is validated whenever
`location` is present, including when co-present `content` has interpretation
primacy. A location-only source dereferences to UTF-8
bytes, which MUST satisfy the same YAML/object gate as string `content`. This
URI-only entry-document convention does not change Core's generic location
model.

**[pin]** URI syntax and relative-reference resolution are the exact RFC 3986
grammar and §5 algorithm. Raw space or control characters and malformed
percent triplets are invalid. Resolution removes dot segments as RFC 3986
requires but otherwise preserves the authored retrieval identity, including
scheme and authority spelling and percent-triplet spelling; WHATWG URL
normalization is not applied.

**[incorporated]** When an RFC 3986 URI authority is present it has exactly
`[userinfo@]host[:port]`: at most one `@`, a decimal-or-empty port, and a host
that is an IP-literal, an IPv4address on first-match, or otherwise a reg-name.
An IP-literal is a complete IPv6address (including IPv4-form `ls32`) or
IPvFuture beginning with `v` or `V`. Userinfo, reg-name, and every other URI
component apply the RFC character and percent-encoding grammar without
normalizing the authored spelling.
The dotted IPv4address spelling of `ls32` is terminal in the IPv6address: it
may finish an uncompressed address or the right side of `::`, but it MUST NOT
occur to the left of `::` (so `[192.0.2.1::]` and `[192.0.2.1::1]` are not
IPv6 literals).

**[convention]** `content` is either a parsed document object or a string.
With `content` and `location` co-present, `content` is the interpreted entry
artifact and `location` supplies its base URI; retrieval MUST NOT replace the
content. The OBI retrieval URI is never that base (Core
[§5.4](../../openbindings.md#54-sources),
[§7](../../openbindings.md#7-reference-resolution)).

**[pin]** String content MUST parse and compose as exactly one complete YAML
1.2.2 document, of which JSON is a subset. The full block and flow grammar,
comments, indentation, anchors, and aliases are supported; an alias cycle has
no finite JSON image and refuses. Duplicate mapping keys, non-scalar mapping keys,
explicit tags outside YAML's JSON-compatible tag set, resolved values with no
JSON image (`.inf`, `-.inf`, `.nan`), and a multi-document stream refuse at
this grammar gate ([YAML 1.2.2 §§3.2.1, 10.2.1,
10.3.2](https://yaml.org/spec/1.2.2/)).

**[incorporated]** A reserved directive whose name is not understood is
ignored with its parameters as YAML 1.2.2 requires; it is not a fatal
composition error. Every mapping member, including the exact spellings
`__proto__`, `constructor`, and `prototype`, remains an ordinary own data
member and cannot be inherited or interpreted through an implementation
object prototype.

**[pin]** A `%YAML` directive with major version other than `1` is an
incompatible-version composition failure. A `1.x` directive is processed with
this candidate's pinned 1.2.2 rules (with the authority-permitted warning for
a higher minor); it is not treated like an unknown reserved directive.

**[pin]** Plain-scalar value resolution uses YAML 1.2.2's recommended Core
schema and no other. Every admitted value MUST still have a JSON image.
Mapping-key resolution instead uses the Failsafe schema's scalar string tag:
a scalar key is a string, while a sequence or mapping in key position refuses
([YAML 1.2.2 §§10.1.1,
10.3.2](https://yaml.org/spec/1.2.2/#1032-tag-resolution)).

**[pin]** A leading byte-order mark is accepted and consumed by the YAML
grammar; it is not part of the composed document. For byte resources YAML's
BOM and BOM-less initial-octet patterns detect UTF-8, UTF-16LE/BE, or
UTF-32LE/BE before the same parser and composer is applied.

**[incorporated]** AsyncAPI 3.1.0's format rule limits tags to its YAML JSON
schema ruleset and keys to scalar strings under the Failsafe ruleset
([AsyncAPI 3.1.0 Format](https://github.com/asyncapi/spec/blob/b3fac5bb522771428ea57b16129b273cd3ea0180/spec/asyncapi.md#format)).

**[exclusion]** The composed entry value MUST be a JSON-data-model object. String
content composing to a scalar, sequence, or null and a non-object `content`
value are outside this candidate's accepted representations. This local
restriction can reopen before publication only with a replacement that still
gives every processor one deterministic AsyncAPI Object.

**[exclusion]** The root `asyncapi` value MUST be exactly the string `3.1.0`.
Another patch, prerelease, minor, or major spelling is excluded even where the
upstream version prose permits patch-compatible tooling. This closed edition
pin can reopen before publication only by an explicit authority review.

**[incorporated]** The entry AsyncAPI Object requires an `info` object whose
`title` and `version` members are strings. Root `servers`, `channels`,
`operations`, and `components`, when present, MUST be maps ([AsyncAPI 3.1.0
AsyncAPI and Info
Objects](https://github.com/asyncapi/spec/blob/b3fac5bb522771428ea57b16129b273cd3ea0180/spec/asyncapi.md#schema)).

**[convention]** For common-kernel inventory, an absent root `servers`,
`channels`, `operations`, or `components` map contributes the corresponding
empty set of slots. This does not treat the absent member as authored content.

**[limit]** §3 validates only the entry envelope and root container shapes. It
does not validate every entry below those maps. Operation, channel, and server
entries are validated only when §4's common-kernel closure reaches them, and a
malformed reached entry is charged to its exact smallest owner rather than to
the whole-entry load gate.

**[incorporated]** For a root operation, omitted `messages` means all messages
of its effective channel and explicit `messages: []` means none ([AsyncAPI
3.1.0 Operation
Object](https://github.com/asyncapi/spec/blob/b3fac5bb522771428ea57b16129b273cd3ea0180/spec/asyncapi.md#operationObject)).
This slice preserves that upstream distinction only as source inventory; §5
does not expose message-state or assign message semantics.

**[incorporated]** An AsyncAPI Reference Object has exactly one required
`$ref`; added properties are ignored. Its URI-reference resolution follows
JSON Reference draft-03, and a JSON or YAML target fragment beginning with `/`
is evaluated as RFC 6901 JSON Pointer ([AsyncAPI 3.1.0 Reference
Object](https://github.com/asyncapi/spec/blob/b3fac5bb522771428ea57b16129b273cd3ea0180/spec/asyncapi.md#referenceObject),
[JSON Reference
draft-03](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03),
[RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)).

**[incorporated]** RFC 6901 pointer tokens use `~0` for `~` and `~1` for `/`;
other tilde escapes are malformed. Its empty pointer addresses the complete
resource. These JSON Pointer facts are distinct from §4's local conceptual
selector convention.

**[pin]** Every external resource reached through §4's closure is composed
independently by the same loader used for entry YAML. A textual resource and an
admitted UTF-8 byte resource MUST pass the same complete one-document YAML
1.2.2 grammar, duplicate-key, scalar-key, tag,
Core-value, Failsafe-key, JSON-image, and leading-BOM rules as string entry
`content`. Unlike the entry document, the composed external resource root MAY
be any JSON image before its fragment is selected. A resource already supplied
as a parsed JSON image is used as supplied.

**[pin]** Portable byte-resource evidence uses the closed
`openbindings.resource-bytes@1` envelope defined by the conformance README. Its
canonical Base64 value is decoded to exact octets, and YAML 1.2.2's encoding
detection is applied before composition. UTF-8 is admitted. A well-formed
UTF-16LE, UTF-16BE, UTF-32LE, or UTF-32BE resource that would satisfy the
preceding YAML/object gate is upstream-valid but locally unadmitted; §5 accounts
its affected external owner as an excluded target rather than an invalid owner.
That exclusion provenance is cumulative across a Reference Object chain: once
a reached hop is carried by valid UTF-16/32, a later same-resource or
cross-resource Reference Object cannot erase the exclusion by selecting an
otherwise admitted UTF-8 concrete object.

**[exclusion]** Valid non-UTF-8 YAML external resources are outside this
candidate's accepted encoding profile. This exclusion can reopen before
publication only with an explicit decision to admit those already
deterministically detected and decoded representations.
Octets that fail decoding or composition under every YAML-recognized encoding
are malformed, not an excluded encoding choice; when reached they invalidate
the smallest owner under §4 and **ASYNC31-S-02**. A lone `0xff`, for example,
is not a complete valid UTF-16 or UTF-32 resource.

**[pin]** A reference with an empty fragment selects the complete composed
resource. RFC 3986 percent-encoded octets are decoded exactly once as UTF-8;
the resulting nonempty fragment in this candidate MUST begin with `/` and is
evaluated only as an RFC 6901 JSON Pointer. An ill-formed percent triplet or UTF-8
sequence and a named-anchor fragment are malformed. Each external resource's
exact retrieval URI becomes the base for relative references authored in that
resource. A reached external grammar failure, malformed or unaddressable
fragment, or wrong-kind selected value is charged to §4's smallest reached
owner; it does not retroactively fail the entry load gate. §4's conceptual
selector remains a separate convention and is never percent-decoded.

**[convention]** **ASYNC31-D-01** — A source naming this identifier conforms at
bind time only when its source carriage, deterministic object/YAML
representation, exact edition, Info envelope, and root map-container shapes
satisfy §3.

**[convention]** **ASYNC31-P-01** — A processor accepts exactly §3's parsed
object or deterministic one-document YAML representations for the entry
document and refuses every excluded entry representation at load. This rule
does not classify a lazily reached external resource; that occurs during
**ASYNC31-P-04** resolution.

**[convention]** **ASYNC31-P-02** — A processor requires exact edition
`3.1.0`, the required Info strings, and only the root envelope/container
shapes §3 makes global; a failure of one of those facts refuses at load.

**[convention]** **ASYNC31-P-03** — A processor implements Core's absolute
location floor, this candidate's UTF-8 location-only decoding, content
primacy, and the co-present location reference base exactly as §3 states.

## 4. Common-kernel closure, selector, and effective membership

**[convention]** The common-kernel reachable closure begins at a selected or
inventoried entry-root Operation slot. The root slot key remains the operation
identity even when its Reference Object resolves to a concrete object authored
in `components` or an external resource.

**[incorporated]** A reached Operation slot is either a concrete Operation
Object or a Reference Object resolving to one. Its concrete object requires
`action` exactly `send` or `receive` and a `channel` Reference Object resolving
to a Channel Object. When the concrete operation is authored in the root
Operations Object, `channel` MUST reference a root Channel slot; an operation
authored in Components MAY reference a Channel Object at another allowed
location ([AsyncAPI 3.1.0 Operation and Components
Objects](https://github.com/asyncapi/spec/blob/b3fac5bb522771428ea57b16129b273cd3ea0180/spec/asyncapi.md#operationObject)).

**[pin]** Reference resolution preserves the exact authored location of each
concrete Operation, Channel, and Server Object. The preceding upstream
root-versus-component constraints are applied from the complete authored-hop
ledger. A root Operation, Channel, or Server slot entered as a Reference target
after leaving the initial inventory slot remains root-authored even when an
intervening component or external alias precedes or follows that hop; a final
concrete entry-root object is therefore never given component placement
permission. This does not change the next paragraph's direct root-slot to
component branch. An external concrete object whose ledger never enters a root
slot has the location selected within its own composed resource.

**[pin]** A Reference Object reached through an entry-root Operation slot and
targeting another entry-root Operation slot preserves that target slot's root
authorship through the complete alias chain. It cannot acquire component
placement permission merely because that targeted root operation later
references a component operation. A root slot referencing a component
Operation directly still uses the component-authored branch.

**[pin]** A concrete Operation or Channel Object authored in an external
resource follows the component-permissive branch of AsyncAPI's location-sensitive
rules. In particular, an external Channel Object with absent or empty `servers`
is available on every structurally usable entry-root Server slot; its nonempty
list MAY contain root-slot references and direct non-root references, with the
latter handled only by §5's exclusion.

**[incorporated]** A root-authored Channel Object's nonempty `servers` array
MUST reference through root Server slots, while a Channel Object authored in
Components MAY reference a Server Object at another allowed location. At either
location, absent or empty `servers` means all Servers Object entries ([AsyncAPI
3.1.0 Channel and Components
Objects](https://github.com/asyncapi/spec/blob/b3fac5bb522771428ea57b16129b273cd3ea0180/spec/asyncapi.md#channelObject)).

**[pin]** In this common-kernel cell model, the Servers Object in the preceding
all-server rule is the entry-root Servers Object. An explicit reference through
a root Server slot identifies the first such root slot traversed anywhere in
the complete Reference ledger as the cell, even when an earlier component or
external alias precedes it or a later root slot is also traversed. Referent
equality MUST NOT manufacture
a root-slot membership for a reference that did not traverse that slot.

**[exclusion]** A direct component/external-only server membership is
upstream-valid but identifies no root-server cell in this candidate. §5 records
it as an excluded target without `bindingSelector`; it is never reclassified as
invalid. This exclusion can reopen before publication only with a reviewed
target identity that names non-root servers without referent inference.

**[incorporated]** Every reached root server key MUST match
`^[A-Za-z0-9_-]+$`, and every reached concrete Server Object requires string
`host` and string `protocol`. Added members beside `$ref` on every reached
Operation, Channel, or Server Reference Object are ignored ([AsyncAPI 3.1.0
Server and Reference
Objects](https://github.com/asyncapi/spec/blob/b3fac5bb522771428ea57b16129b273cd3ea0180/spec/asyncapi.md#serverObject)).

**[incorporated]** A reached key in Components Object `operations`, `channels`,
or `servers` MUST match `^[a-zA-Z0-9._-]+$` ([AsyncAPI 3.1.0 Components
Object](https://github.com/asyncapi/spec/blob/b3fac5bb522771428ea57b16129b273cd3ea0180/spec/asyncapi.md#componentsObject)).

**[incorporated]** When present, each typed Components Object member used by
this slice — `operations`, `channels`, and `servers` — MUST itself be a map
whose values have that member's declared type ([AsyncAPI 3.1.0 Components
Object](https://github.com/asyncapi/spec/blob/b3fac5bb522771428ea57b16129b273cd3ea0180/spec/asyncapi.md#componentsObject)).

**[pin]** The component-key grammar is checked only when §4's closure reaches
that component slot. A bad reached Operation, Channel, or Server key invalidates
that exact smallest owner; a bad key in an unreachable component map remains
inert in this bounded slice.

**[exclusion]** Every reached root or component Operation, Channel, or Server
map key MUST be a well-formed Unicode scalar string. A lone UTF-16 high or low
surrogate is unadmitted and invalidates its containing typed map owner under
**ASYNC31-S-02**; it cannot participate
in pointer, selector, coverage, or generated-key identity. Literal U+FFFD
remains distinct and admitted wherever the upstream key grammar otherwise
admits it; an implementation MUST NOT replace a surrogate with U+FFFD.

**[convention]** A non-scalar key invalidates its containing reached typed map,
not a fabricated slot. The canonical owners are `#/operations`, `#/channels`,
and `#/servers` for root containers and the corresponding
`#/components/{operations,channels,servers}` pointer (or canonical external
equivalent) for a reached component container. A root Operations container
owner is deduplicated once with no `operationKey`; a Channel container owner
is repeated once per affected scalar root operation key; a Server container
owner is deduplicated once with no `operationKey`, followed by each otherwise
usable operation's independent **ASYNC31-S-05** entry when no root cell
remains. Multiple non-scalar keys in one map still yield one map owner. The
invalid key is never serialized into a pointer, selector, coverage entry, or
generated key.

**[pin]** The typed component-container map requirement is likewise checked
only when §4 traversal first requires that container. A reached non-map
`components.operations` or `components.channels` container is an invalid
Operation-class or Channel-class owner respectively and is repeated once per
affected root `operationKey`; a reached non-map `components.servers` container
is an invalid Server-class owner, deduplicated once with no `operationKey`.
Its canonical owner pointer is the container pointer itself. A non-map typed
container that no selected or inventoried closure reaches remains inert.

**[convention]** An Operation, Channel, or Server slot in this closure may
itself be a Reference Object. Internal and relative external references are
resolved under §3's source-composition and per-resource rebasing rules. A
missing base for a reached relative external reference, an external composition
failure, an unaddressable target, a wrong target kind, or a pure non-schema
Reference cycle with no concrete effective object invalidates the smallest
reached operation, channel, or server owner. A valid sibling owner survives.

**[pin]** Reference processing has one precedence order. The processor first
validates and resolves the reference URI; then detects a YAML-supported byte
encoding, decodes and composes the referenced resource; then resolves its empty
or RFC 6901 fragment; and only then validates the selected value's expected
upstream kind and structure. A selected scalar, sequence, wrong typed object,
or concrete object with an invalid required field is upstream-invalid even
when carried in valid UTF-16/32. **ASYNC31-S-07** applies only when the selected
Operation, Channel, or Server owner would otherwise be upstream-valid and its
UTF-16/32 carriage is the sole unadmitted fact. Reached valid UTF-16/32 is a
lazy resolution exclusion under **ASYNC31-P-04**, never an entry-document
**ASYNC31-P-01** load refusal; an unreachable byte resource is inert.

**[convention]** Reference-failure ownership is selected before its
`sourceRef` is encoded. A structurally invalid concrete Operation, Channel, or
Server value owns itself. For a pure same-kind Reference Object chain that
reaches no concrete object, including a missing tail or a tail-cycle, the owner
is the first canonical target slot entered after leaving the containing owner.
If the failing URI or fragment cannot canonically identify a target slot — for
example an ill-formed percent triplet, named fragment, or malformed RFC 6901
escape — the containing current Operation, Channel, or Server owner is charged.
This rule is applied at every chain hop and yields one owner independently of
traversal order.

**[limit]** Only the Operation/Channel/Server closure defined in this section is traversed.
References beneath traits, messages, reply, security, parameters,
correlation, bindings, schemas, and every other deferred field are inert in
this slice, even when dangling. An unselected malformed root operation and an
unreachable malformed component are likewise not promoted into a whole-entry
load failure. Recursive schema graphs are not traversed.

**[convention]** A present `selector` has one canonical spelling:
`#/servers/<server>/operations/<operation>`. `<server>` is one root Servers
Object key and `<operation>` is one root Operations Object key. AsyncAPI's
server-key grammar makes `<server>` literal in this selector; `<operation>` is
escaped exactly once as an RFC 6901 token. This is a conceptual-cell selector,
not a claim that `operations` is nested beneath a server in the artifact.

**[convention]** An absent selector selects the sole represented conceptual
cell only when exactly one remains after synthesis. Zero represented cells
refuse as no target and more than one refuses as ambiguous, both at resolution
and before dispatch (Core [OBI-B-02 item
5](../../openbindings.md#104-binding-specification-rules)). In the common-kernel
only domain zero represented cells still means absence cannot succeed; §5
supplies the first case in which exactly one represented cell can survive.

**[convention]** The selector's `#` and `/` separators are literal. Selector
tokens are never percent-decoded; a percent triplet is matched as literal text.
`~0` and `~1` are the only escapes and MUST be canonical.
Missing or extra segments, malformed escape, missing root key, and a
component-operation spelling are unaddressable and refuse at resolution
without dispatch. Selector absence instead follows the zero/one/many rule
above and is not malformed syntax.

**[incorporated]** A root channel is available on every root server when its
`servers` member is absent or empty; otherwise it is available exactly on the
root server definitions named by that list ([AsyncAPI 3.1.0 Channel
Object](https://github.com/asyncapi/spec/blob/b3fac5bb522771428ea57b16129b273cd3ea0180/spec/asyncapi.md#channelObject)).

**[convention]** A conceptual cell is addressable only when both selector keys
exist, the selected server and operation closures are structurally usable, the
operation resolves to a structurally usable channel allowed by its authored
location, and that channel is effectively available through the selected root
Server slot. A selected closure defect refuses at resolution; a defect outside
that selected closure is inert for the invocation.

**[limit]** Addressability and usability are distinct. §5's profile exclusions
do not erase an addressable cell: its canonical selector resolves, then
invocation refuses before dispatch. A malformed selector reaches no cell; an
absent selector follows the represented-cell cardinality rule above.

**[convention]** **ASYNC31-D-02** — A binding conforms only when a present
selector has §4's canonical form and names existing root server and operation
keys; an absent selector is resolved by §4's zero/one/many rule.

**[convention]** **ASYNC31-D-03** — The named conceptual cell conforms only
when its §4 operation/channel/server closure is structurally usable and its
resolved root channel is effectively available on the selected root server.

**[convention]** **ASYNC31-P-04** — A processor traverses exactly §4's
common-kernel reachable closure, resolves its internal and relative external
Reference Objects using authored-location constraints and per-resource bases,
applies §4's URI/encoding/fragment/kind precedence and owner-selection rule,
and confines malformed, missing, cyclic, wrong-kind, excluded-encoding, and
unreachable material to the exact owners §4 defines.

**[convention]** **ASYNC31-P-05** — A processor parses a present selector with
§4's exact conceptual grammar and escape rules and resolves its two tokens
against entry-root server and operation keys; it applies the absent-selector
zero/one/many rule separately.

**[convention]** **ASYNC31-P-06** — A processor computes effective
channel/server membership exactly: absent and explicit-empty `servers` mean
all usable entry-root servers, while a nonempty list names exactly its
resolved usable root-slot subset plus any explicit component/external-only
members that §5 accounts as excluded targets.

## 5. Synthesis and the payloadless plaintext HTTP profile

**[convention]** Synthesis inventories every structurally usable root
operation paired with exactly the root servers on which its effective channel
is available. Each conceptual cell's identity is §4's canonical selector.
Component operations are reusable declarations, not root inventory targets.

**[convention]** A structurally usable root operation with no addressable root
Server cell contributes one target-coverage entry with `sourceRef` equal to
`#/operations/<operation>`, where `<operation>` is escaped once as an RFC 6901
token, `scope: "target"`, `status: "excluded"`, its literal `operationKey`, no
`bindingSelector`, and no requirements. It emits no operation or binding.

**[convention]** Each explicit component/external-only server membership is
accounted separately at target scope with `sourceRef` equal to
`#/operations/<operation>#server[<index>]=<reference>`, using the escaped root
operation token, zero-based membership-array index, and authored reference URI
spelling. It has `status: "excluded"`, the literal `operationKey`, no
`bindingSelector`, and no requirements. Root-slot and non-root memberships are
never collapsed merely because they resolve to equal Server Objects. These
excluded entries preserve membership-array order, and two authored occurrences
remain two entries even when their raw references or resolved referents are
equal.

**[convention]** Invalid-owner `sourceRef` is canonical and injective by authored
location. A root or component Operation, Channel, or Server owner uses the
canonical JSON Pointer to its exact map slot, with every token escaped once by
RFC 6901. An external owner uses its resolved absolute retrieval URI without a
fragment, followed by `#` and its canonical pointer. That pointer is encoded as
UTF-8 and then strict uppercase percent encoding, leaving only RFC 3986
unreserved bytes plus `/` and `~` literal; an empty pointer therefore leaves a
trailing `#`.

**[convention]** A reached non-map typed component container uses the canonical
container pointer `#/components/operations`, `#/components/channels`, or
`#/components/servers`. A reference failure uses the owner selected by §4
before applying this paragraph's pointer/URI encoding, so a malformed fragment
cannot create a second noncanonical spelling for one containing owner.

**[convention]** An invalid Operation or Channel owner contributes one target
entry for each affected entry-root operation key, carrying that literal
`operationKey`; the same canonical `sourceRef` MAY recur only with distinct
affected operation keys. An invalid Server owner is deduplicated to one target
entry per canonical owner and carries no `operationKey`. Duplicate traversals
never duplicate either entry. After invalid-owner accounting, every otherwise
structurally usable root operation with zero addressable root-server cells is
accounted separately by **ASYNC31-S-05**.

**[limit]** Outside the admitted cell below, the only normalized common-kernel
result this slice exposes is the exact exhaustive coverage inventory of source
owners and canonical conceptual-cell identities. It performs no trait, schema,
payload, header, reply, security, parameter, or value translation.

**[incorporated]** The sole incorporated protocol binding is [AsyncAPI HTTP
Binding 0.3.0 at immutable commit
`ec5c590d4212905a13014cfd43f72fb086c00e85`](https://github.com/asyncapi/bindings/blob/ec5c590d4212905a13014cfd43f72fb086c00e85/http/README.md).
For this client profile the application-facing `receive` action maps to an
HTTP request. A concrete inline Operation HTTP Binding Object is REQUIRED;
`method`, when present, is exactly `POST`, and absent `method` means `POST`.
`bindingVersion`, when present, is exactly `0.3.0`; omission is pinned to that
same version rather than upstream's mutable latest version. `query` is absent.
An absent or empty Operation `security` array selects no security mechanism;
a nonempty array is outside this slice.

**[pin]** A conceptual cell is represented only when all these facts hold. The
root Operation is structurally usable, has `action: receive`, omits `messages`,
`traits`, and `reply`, and has only the concrete HTTP operation binding just
defined. Its Channel has a static address beginning `/`, no `?`, `#`, `{`, or
`}`, no `parameters`, exactly one direct concrete message-map entry whose
Message Object is `{}`, and only an absent or empty inline HTTP channel binding.
Its Server has `protocol: http`, absent or exact `1.1` `protocolVersion`, a
static `host` consisting only of an RFC 3986 authority host with an optional
numeric port, an absent or static absolute-path `pathname`, no `variables` or
`security`, and only an absent or empty inline HTTP server binding. Invocation
configuration is absent or exactly `{}`.

**[exclusion]** The sole Message map identifier MUST be a Unicode scalar
string. A non-scalar Message identifier makes the otherwise addressable cell
profile-excluded before identity generation; it is never serialized or
replacement-decoded. Literal U+FFFD remains a distinct scalar identifier.

**[pin]** These profile predicates consume the concrete Operation, Channel,
and Server values produced by §4 reference resolution; they do not require the
concrete objects to be authored inline at their root slots. Root operation and
root server slot keys still define the conceptual-cell identity, and effective
Channel `servers` membership is applied before profile admission. An explicit
selector naming a root server outside that membership refuses at resolution.
An absent selector succeeds only when exactly one represented cell remains;
zero refuses as no target and two or more refuse as ambiguous. The Message
Object is the one deliberate exception in this slice: it MUST be the direct
concrete `{}` value in the resolved Channel's `messages` map; a Message
Reference Object remains excluded.

**[pin]** The admitted Server `host` is the exact RFC 3986 authority spelling
closed below. The optional Server `pathname` and required
Channel `address` are static RFC 3986 path strings: each begins `/`, contains
only `pchar` or `/`, preserves every valid uppercase percent triplet verbatim,
and contains no query, fragment, template, raw space, control character, or
malformed percent encoding.

**[exclusion]** A valid cell that differs from the preceding admitted subset —
including HTTPS; another protocol, action, method, binding version, or binding
shape; a missing Operation HTTP binding; an Operation message list (including
`[]`); traits, reply, or nonempty `security`; multiple, referenced, or nonempty messages; payload,
headers, correlation, schema, parameters, query, security, variables, or
templates — is excluded before dispatch. Deferred references beneath those
fields remain inert under §4. This exclusion can reopen before publication
only when the corresponding complete common or protocol semantics and portable
evidence are incorporated.

**[pin]** The sole effective message is selected by the Operation's omitted
`messages` member from the Channel's sole message. It carries one application
value: exactly the JSON object `{}`. The caller supplies that value once;
absence, `null`, a nonempty object, another JSON type, or more than one write
refuses before any network event. The governing authored OBI operation has
exactly the input schema `{ "type": "object", "properties": {},
"additionalProperties": false }`, no `output`, and its binding has neither
`inputTransform` nor `outputTransform`; a mismatch refuses before delivery.
Acceptance is recorded before connection attempt. The message has zero
request-body octets and produces zero successful application outputs. This is
not a signal-zero interaction.

**[pin]** Processor selection and synthesis consume the same §3/§4
common-kernel evaluation result; this profile does not reload, re-resolve, or
reinvent root slots. Consequently content/location composition, lazy external
resources, authored locations, canonical owner identities, effective server
membership, smallest-owner confinement, and **ASYNC31-S-02**, **S-05**,
**S-06**, and **S-07** coverage have one outcome in both directions. An
unselected or unreachable defect remains inert.

**[pin]** Server `host` is the exact RFC 3986 HTTP authority spelling: one
nonempty reg-name, IPv4address, or bracketed IP-literal, optionally followed by
one decimal port from 0 through 65535. Reg-name permits the RFC unreserved,
sub-delimiter, and canonical uppercase percent-triplet spellings, including a
numeric reg-name such as `123`. An IPv6 literal admits every RFC 3986 spelling,
including uppercase, noncompressed, leading-zero `h16`, and IPv4-form `ls32`;
the dotted IPv4 form is terminal and therefore never occurs to the left of
`::`; IPvFuture follows the RFC grammar. Authored host spelling is preserved; no
case-folding or address canonicalization is performed. Userinfo, path, query,
fragment, raw whitespace/control, malformed brackets/triplets, an empty host,
and a nondecimal or out-of-range port are excluded. Server `pathname`, or `/` when
omitted, and the Channel address join at exactly one boundary slash to form
the origin-form; neither component nor any valid percent triplet is otherwise
normalized. The request is exact
`POST <origin-form> HTTP/1.1`; `Host` is first and sole field and equals the
authority. Query is empty, body is absent, and Content-Type, Content-Length,
Transfer-Encoding, Content-Encoding, and Expect are absent. The processor
follows no redirect, retries no request, and performs no proxy or TLS action.

**[incorporated]** HTTP response message syntax and semantics follow [RFC
9112](https://www.rfc-editor.org/rfc/rfc9112.txt) and [RFC
9110](https://www.rfc-editor.org/rfc/rfc9110). Zero or more 100–199 responses
other than 101 may precede exactly one final response; 101 is a loud protocol
failure. A final 2xx completes successfully only with zero content octets and
still emits no output. A final non-2xx completes unsuccessfully with no output;
its content may be consumed and ignored only when exactly framed. Status 304
has no content; an absent Content-Length or one canonical nonnegative decimal
metadata value is admitted and no body octet may follow. A 2xx with nonzero
content is a loud protocol failure.

**[pin]** Response framing is the narrow deterministic C19A subset. Each field
name/value satisfies RFC 9110 field grammar, including a Unicode-scalar value
with no NUL, CR, LF, DEL, or disallowed control. Transfer-Encoding, Trailer, and
Content-Encoding are forbidden. Content-Type media-type and parameter grammar
is RFC 9110 exact: optional whitespace may surround semicolon separators, but
bad whitespace around `=` is rejected, and quoted-string/quoted-pair is parsed
without treating an escaped quote as the end of the value. RFC 9110's optional
parameter member means an empty member, including a trailing semicolon after
permitted OWS, is admitted. A payload-bearing or ordinary zero-content
final response has exactly one canonical nonnegative decimal Content-Length
equal to received octets. A 204 has no Content-Length or content; 205 has
exactly `Content-Length: 0` and no content. `Connection: close`, when present,
does not replace exact length framing. Content-Type occurs at most once, must
have valid field grammar, is ignored and never decoded because no Reply is
selected. Duplicate, noncanonical, or mismatched length, close-delimited
content, malformed framing, or missing completion is a loud protocol failure.
Extra material after a framed response is a trace-protocol failure under the
separate terminal and qualification rules below.

**[pin]** RFC 9112 §6.3 determines message completion; §9.3 permits persistent
connections. A completely framed response does not wait for EOF. The processor
establishes its single live terminal at that boundary, before inspecting any
next octet, including a coalesced octet already buffered by the transport.

**[convention]** Live invocation disposition, phase and timeline are immutable
after that terminal. Qualification of the surrounding finite peer trace is a
separate observation and may remain incomplete while a connection is open.
Extra body material, an unsolicited second final response, a false stage or
trigger, or other invalid post-terminal activity fails trace qualification;
it cannot replace the terminal, emit another terminal, or become operation
output. On unsolicited post-terminal bytes the connection MUST NOT be reused.
Clean transport closure and connection-poisoning telemetry may be recorded on
the trace axis; neither is another invocation event or terminal.
This connection-poisoning policy is a profile convention, not a claim that
RFC 9112 mandates this particular recovery policy. The same separation applies
to successful and unsuccessful framed completion. A test with incomplete trace
observation cannot claim complete exchange qualification.

**[pin]** A clean non-2xx final is an unsuccessful completion, distinct from a
loud response-protocol failure. Status 304 has no content regardless of its
optional Content-Length metadata; that metadata never declares body octets.

**[pin]** The revision-7 processor maps the closed
`openbindings.asyncapi-http-peer@2` script through the generic peer mapper and
applies the repository-qualified C20B HTTP field, framing, trigger, and total
FSM predicates without a weaker AsyncAPI-only duplicate. The complete framed
prefix determines the live result; the whole observed script determines trace
qualification. Portable C21 alternatives explicitly carry `trace.status`
(`valid`, `invalid`, or `not-observed`) and `trace.afterTerminal`, separately
from the live `disposition`, `phase` and pre-terminal `timeline`. The latter
trace array contains only governed native observations after the terminal,
never new input acceptance or operation output. A refused invocation observes
no peer trace. A valid cancellation qualifies only its causally admitted
prefix, not an unacknowledged suffix. Every peer event's
`after` trigger names the exact immediately available native fact and count.
The processor derives the stage only from the actual native/peer prefix and
then requires a peer-authored `stage` label to equal it; the label never drives
the derivation. The mapper records closed qualification tokens for map entry,
response-head, interim, final, body, and disconnect branches and exactly one
classification token: successful-final, unsuccessful-final, incomplete,
peer-disconnect, or protocol-error. These tokens are harness coverage evidence,
not an OBI operation surface.
This first represented cell requires that exact peer-dialect identifier and
`script.transport` equal to `cleartext`. A missing or different dialect, or a
TLS script, refuses before dispatch and cannot contribute a cleartext native
timeline.
A local cancellation may occur after the connection attempt but before open,
after open but before request start, during request, or after dispatch/interim
response, or after a final head whose declared content is not yet complete; it
propagates once, closes exactly once if and only if the transport opened, and
terminates cancelled. A cancel after an already complete final disposition
cannot replace that disposition. An `await-native` action admits exactly the
peer prefix needed to establish that named fact and count. The next caller
action then wins over every unacknowledged peer suffix; no wall-clock ordering
is inferred from the two arrays. An unsatisfied await is an interaction error.
A peer disconnect may occur after open before request, during
request, after dispatch before response, after an interim response, or after a
completely framed final response; its trigger and derived stage determine the
exact accepted prefix and closure. A stale dispatch trigger after an interim or
final response, invalid protocol/application activity after a complete disposition, or a false stage label
is loud on the trace axis if completion has already occurred, and otherwise
determines the invocation's response failure. Both preserve the zero-output prefix and
neither permits an implicit retry. Acknowledgements correspond exactly to the
peer interim/final sequence, request dispatch follows input acceptance and
connection opening, and exactly one terminal disposition is produced.

**[exclusion]** Every otherwise usable conceptual cell not satisfying this
section's admitted profile MUST be recorded in exhaustive synthesis coverage at
`protocol-cell` scope with status `excluded`.

**[limit]** An invalid or excluded protocol cell emits no OBI operation or binding. An
absent or empty root `operations` map declares no conceptual cell and likewise
emits none. A represented cell emits exactly the operation and binding defined
below; declaration alone never creates a ghost operation.

**[convention]** Invocation of an addressable excluded cell refuses at
pre-dispatch with no native event. No endpoint, payload, header, security, or
transport behavior is inferred from `protocol`, `bindings`, message content,
or library defaults.

**[convention]** **ASYNC31-P-07** — A processor presented with an addressable
cell outside §5's admitted profile refuses before dispatch and emits no native
event.

**[convention]** **ASYNC31-D-04** — A binding names a represented HTTP cell
only when its Operation, Channel, Server, HTTP bindings, static address, and
configuration satisfy §5's closed admission subset.

**[convention]** **ASYNC31-D-05** — A represented binding accepts exactly one
caller value `{}` under §5's effective direct-empty-message rule, and its OBI
operation/input and absent output/transforms match §5 exactly.

**[convention]** **ASYNC31-D-06** — A represented binding derives exactly
§5's HTTP/1.1 POST target, origin-form, Host-only header block, and absent body.

**[convention]** **ASYNC31-D-07** — A represented binding applies exactly
§5's response framing, outcome, cancellation, disconnect, terminal, no-output,
and no-retry rules.

**[convention]** **ASYNC31-P-08** — A processor consumes the single §3/§4
common-kernel result and admits a cell if and only if
every closed Operation/Channel/Server/HTTP-binding/configuration predicate in
§5 holds after §4 resolution and membership, applying both POST and
binding-version defaults exactly. Absent and explicit-empty Operation security
are equivalent in this profile; every nonempty security array is excluded.

**[convention]** **ASYNC31-P-09** — A processor derives the sole effective
direct empty Message and accepts exactly one `{}` input before network activity;
it first requires the exact authored OBI input schema and absent output and
binding transforms. Every other contract, input shape, or cardinality refuses
pre-dispatch.

**[convention]** **ASYNC31-P-10** — A processor derives and records exactly
the HTTP/1.1 connection and POST dispatch facts in §5, including one-boundary
path joining, Host-only ordered headers, empty query, and absent body.

**[convention]** **ASYNC31-P-11** — A processor consumes interim and final
responses, validates field grammar and exact framing, rejects 101 and forbidden
or inconsistent framing, and assigns successful, clean-unsuccessful-completion,
and loud response-failure outcomes exactly as §5 states.

**[convention]** **ASYNC31-P-12** — A processor emits no output for this
payloadless/no-Reply cell and treats any 2xx response content as a loud protocol
failure while consuming exactly framed non-2xx content without exposing it.

**[convention]** **ASYNC31-P-13** — A processor enforces §5's total lifecycle,
including acceptance-before-network, ordered acknowledgements, single terminal
outcome established at the framed boundary without waiting for EOF, exact
peer-trigger correspondence, cancellation/disconnect propagation, separate
qualification of post-terminal activity without changing the live terminal,
connection poisoning on unsolicited bytes, and no implicit retry.

**[convention]** **ASYNC31-S-01** — A synthesizer produces the exact exhaustive
coverage inventory of every reached invalid smallest owner and every effective
root-server/root-operation cell, plus every excluded target §5 requires for a
usable operation with no root cell or for a direct component/external-only
server membership. It assigns each cell §4's canonical selector and invents no
owner, target, or cell for unreachable material, an unavailable server, a
component operation, or an absent root operation.

**[convention]** **ASYNC31-S-02** — A synthesizer applies reachable-reference
precedence, deterministic owner selection, and smallest-owner confinement per
inventory target, preserving unrelated cells and accounting each affected
owner `invalid` with §5's canonical, deduplicated `sourceRef` and
`operationKey` rules rather than refusing the source globally.

**[convention]** **ASYNC31-S-03** — A synthesizer accounts every otherwise
usable cell outside §5's admitted profile as an `excluded` protocol cell in
exhaustive coverage.

**[convention]** **ASYNC31-S-04** — A synthesizer emits no OBI operation or
binding for an invalid or excluded owner, an absent/empty root operation map,
or a component operation; only a §5 represented root cell emits one.

**[convention]** **ASYNC31-S-05** — A synthesizer accounts each structurally
usable root operation with zero addressable root-server cells by exactly §5's
single excluded target entry, with no `bindingSelector`, operation, or binding.

**[convention]** **ASYNC31-S-06** — A synthesizer accounts each explicit
component/external-only server membership by exactly §5's indexed excluded
target entry, in authored membership-array order including duplicates, and
never infers a root cell from referent equality.

**[convention]** **ASYNC31-S-07** — A synthesizer accounts an affected external
owner whose selected value is otherwise upstream-valid and whose sole
unadmitted fact is valid UTF-16/32 YAML carriage as an excluded target with
§5's canonical external `sourceRef` and Operation/Channel/Server deduplication
rules, no `bindingSelector`, and no operation or binding.

**[convention]** **ASYNC31-S-08** — A synthesizer represents exactly the
§5-eligible protocol cells and records each with `protocol-cell` scope, its
canonical selector, `status: represented`, and no requirements; every other
usable cell remains excluded under **ASYNC31-S-03**.

**[convention]** Generated keys use this specification's local, frozen,
injective convention, not a Core-generated algorithm. For source index `N`,
let `<sourcehex>` be lowercase hexadecimal UTF-8 of the canonical decimal
spelling of `N`. The source key is `asyncapi31.source.<sourcehex>`. For a root
operation key `<op>`, the operation key is
`asyncapi31.operation.<sourcehex>00<ophex>`, where `<ophex>` is lowercase
hexadecimal UTF-8 of the literal root key. For canonical selector `<selector>`,
the binding key is
`asyncapi31.binding.<sourcehex>00<selectorhex>`. Nothing is truncated,
case-folded, normalized, or percent-decoded before encoding.
The decimal index, root key, and selector MUST first be Unicode-scalar strings;
§4's non-scalar-key exclusion runs before this UTF-8 step, so replacement-byte
encoding can never alias a lone surrogate with literal U+FFFD.

**[convention]** **ASYNC31-S-09** — For each represented root operation a
synthesizer emits one OBI operation whose input is exactly
`{ "type": "object", "properties": {}, "additionalProperties": false }`,
whose output is absent, and whose key is derived by the preceding local
convention. The emitted OBI carries the exact source under its generated source
key.

**[convention]** **ASYNC31-S-10** — For each represented conceptual cell a
synthesizer emits exactly one binding from the §4 selector to the operation for
that root operation, with the generated source key, exact selector, and neither
`inputTransform` nor `outputTransform`; no invalid, excluded, unavailable, or
component-only cell creates a ghost.

**[convention]** **ASYNC31-S-11** — A synthesizer records the represented sole
message as one `message-alternative` coverage entry owned by its protocol cell,
emits no output or transform for it, and sets `fullyRepresented` true exactly
when every exhaustive entry is represented.

## 6. Conformance

**[convention]** A document conforms to this candidate when every source and
binding naming it satisfies **ASYNC31-D-01** through **ASYNC31-D-07**.

**[convention]** A processor conforms to this slice when it satisfies
**ASYNC31-P-01** through **ASYNC31-P-13**. A synthesizer conforms when it
satisfies **ASYNC31-S-01** through **ASYNC31-S-11**. This discharges Core
OBI-B-02 items 6 and 7 only for §5's admitted cell.

### 6.1 Exclusion and limit register

The following table is an informative index. The labeled paragraphs it points
to are normative.

| Kind | Section | Boundary | Reopen condition |
| --- | --- | --- | --- |
| exclusion | §3 | non-object content | deterministic AsyncAPI Object composition before publication |
| exclusion | §3 | editions other than exact 3.1.0 | explicit authority review before publication |
| exclusion | §3 | valid UTF-16/32 external YAML resources become excluded targets, while universally malformed bytes invalidate the smallest owner | explicit admission of the deterministically decoded non-UTF-8 representations |
| limit | §2 | traits, schemas, payloads/headers, replies, security, parameters, correlation, TLS, and other protocol bindings | separately reviewed semantics before publication |
| limit | §3 | reachable-only reference gate; non-schema cycles invalid; recursive schema graphs deferred | reviewed schema/reference semantics before publication |
| exclusion | §4–5 | direct component/external-only server membership has no root cell | a future target model that names non-root servers without referent inference |
| exclusion | §4 | reached typed-map key is not a Unicode scalar string | an injective non-scalar transport and identity algebra reviewed before publication |
| limit | §4 | addressability does not imply protocol usability | a separately reviewed protocol profile |
| exclusion | §5 | every cell outside the closed payloadless plaintext HTTP subset | separately reviewed complete common/profile semantics |
| limit | §5 | no operation or binding emitted for invalid, excluded, or absent cells | additional represented profile semantics and evidence |

## 7. Normative references

- **[incorporated]** [OpenBindings Specification 0.2.0](../../openbindings.md)
- **[incorporated]** [AsyncAPI Specification 3.1.0, immutable commit `b3fac5bb522771428ea57b16129b273cd3ea0180`](https://github.com/asyncapi/spec/blob/b3fac5bb522771428ea57b16129b273cd3ea0180/spec/asyncapi.md)
- **[incorporated]** [JSON Reference draft-03](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03)
- **[incorporated]** [YAML 1.2.2](https://yaml.org/spec/1.2.2/)
- **[incorporated]** [RFC 6901: JavaScript Object Notation (JSON) Pointer](https://www.rfc-editor.org/rfc/rfc6901)
- **[incorporated]** [RFC 3986: Uniform Resource Identifier (URI): Generic Syntax](https://www.rfc-editor.org/rfc/rfc3986)
- **[incorporated]** [AsyncAPI HTTP Binding 0.3.0, immutable commit `ec5c590d4212905a13014cfd43f72fb086c00e85`](https://github.com/asyncapi/bindings/blob/ec5c590d4212905a13014cfd43f72fb086c00e85/http/README.md)
- **[incorporated]** [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110)
- **[incorporated]** [RFC 9112: HTTP/1.1](https://www.rfc-editor.org/rfc/rfc9112.txt)
- **[incorporated]** [BCP 14](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)
