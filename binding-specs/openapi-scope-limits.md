# OpenAPI candidate limits and reasons

This is an informative index of the four candidates' existing boundaries. Their
normative texts govern. It supplies review reasons and reopening conditions,
not additional exclusions or a promise to add a feature in a later revision.

| Boundary | Reason | Reopen when |
| --- | --- | --- |
| Unary HTTP request; no tunnel, upgrade, callback receiver or credential-acquisition protocol (§1) | Declaring these in OAS does not supply their operation-value and lifecycle correspondence. A callback dependency is not a running receiver. | A demonstrated consumer need comes with a separately specified, faithful operation boundary for that interaction. |
| Unsupported nested/style combinations, ambiguous delimiters and deep-object names containing brackets (§6) | The adopted serialization rules do not distinguish every supplied value. Guessing would change meaning. | Upstream defines the missing correspondence, or a concrete need supports an unambiguous kind convention without reinterpreting existing values. |
| Static inspection cannot determine a required declaration, including unresolved dynamic behavior (§3) | Apparent runtime type is not evidence of the declaration's meaning. The 3.2 validated-data route remains available under its stated conditions. | A consumer need establishes a sound additional determination rule, or upstream makes the determination explicit. |
| Name-based form response decoding (§8) | The kind does not adopt the inverse correspondence, even where OAS 3.2.1 defines it. The restriction is deliberate scope, not a claim of upstream silence. | Consumers need that representation and the response-value correspondence is explicitly adopted and tested. |
| No operation-input value supplied from a schema default/example, implicit credential acquisition, or silent choice among unresolved alternatives (§§4–9) | Those actions would add caller or environment intent absent from the supplied value and selected declarations. | An explicit consumer-owned choice can express the needed behavior without treating documentation as supplied application data. |
| Schema projection may omit a claimed contract (§11) | An unsupported native schema feature does not justify publishing an inaccurate OBI contract. | A sound projection preserving the reference graph and value set is available; fuller implementation capability alone need not change kind meaning. |

Implementation capability limits are distinct from kind exclusions. Extra codecs,
numeric range beyond the required floor, schema features and recursive media
handling may become available without changing what a kind means. An
implementation must refuse or disclose cases it cannot handle as the governing
operation requires; it must not substitute a rounded value or describe an
unhandled case as handled.

The current correctness evidence is in the
[authority regression record](../conformance/kinds/openapi-authority/README.md).
Adaptation language/content, associated failure data, response negotiation and
header declaration identity still require design reconciliation. These open
choices prevent treating the candidates as frozen implementation contracts.
For example, the current structural adaptation cannot express “put `petId` in
parameters and forward every other, possibly unknown, input member as the body.”
That is a practical expressiveness question, not an upstream serialization fix.

The literal RFC 6901 target form deliberately omits the old `#` sentinel: it
names the standard string form directly and avoids suggesting URI-fragment
percent decoding. This is an identified family convention, not a claim that
core gives `content` a pointer syntax.

All four candidates remain unpublished and amendable. Once meaning is published,
an incompatible change follows the project's revision policy even if a reopening
condition has been met.
