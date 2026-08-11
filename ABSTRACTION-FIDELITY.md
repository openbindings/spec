# Abstraction fidelity doctrine

**Status:** informative project doctrine for design, synthesis, implementation,
and conformance work. It does not add fields to the OBI document model, define
a core failure vocabulary, or change the normative force of
[`openbindings.md`](openbindings.md).

## The goal

OpenBindings is a protocol-independent operation overlay. The named binding
specification is the governing semantic authority. A source retains its real
artifact or live surface so a binding implementation can perform the concrete
interaction correctly; an upstream artifact or protocol has authority only on
the terms the binding specification incorporates. None of that is a promise
that the operation caller can observe the underlying protocol.

The fidelity target is therefore:

> A synthesized OBI is as useful as bespoke binding code for invoking and
> consuming the abstract operation it represents. Correct use of that
> operation does not require knowing which binding was selected or inspecting
> protocol-native representations.

This is deliberately narrower than native-client observational equivalence.
OpenBindings is not a protocol debugger, packet model, or alternate pipe for
statuses, headers, trailers, frames, or wire bytes.

## The minimum-sufficient-layer rule

Every OpenBindings layer carries only the concepts needed for the layer above
it to meet that goal. For any proposed concept, field, rule, classification,
or surface, ask:

1. What operation-level capability becomes impossible without it?
2. Which is the narrowest layer that can supply it correctly?
3. Can an existing source fact, binding rule, or ordinary value carry it
   without adding a new OpenBindings concept?
4. Would a caller need to understand the selected protocol to use it?
5. Can the proposal be removed while preserving correct invocation? If so,
   remove it.

Applied by layer:

- **Core and OBI document:** contain only the portable author-declared
  operation contract, the identifier of the governing binding specification,
  and binding relationships needed to select and act through a concrete
  realization. A cross-protocol convenience or diagnostic need does not
  justify a core field.
- **Binding specification:** is sovereign over its governed sources. It may
  define semantics itself or incorporate, subset, extend, or override another
  authority. The OpenBindings project's brownfield specifications choose the
  minimum upstream-deferential semantics needed for a correct abstract
  interaction because that maximizes fidelity and reuse.
- **Synthesis:** derives only application contracts supported by the source;
  it neither invents missing intent nor recompiles protocol observations.
- **Invocation interfaces:** relay values and emergent interaction behavior.
  They need a structural distinction between normal and unsuccessful
  completion, not a presumed-complete ontology of every protocol's failures.
- **SDKs:** may add idiomatic conveniences or complete a binding
  specification's gaps locally, but those behaviors remain
  implementation-defined and do not become portable semantics by repetition.
- **Diagnostics and conformance:** may retain concrete evidence needed to
  explain or prove an implementation. That evidence stays optional for
  ordinary operation use.

Minimality is not lowest-common-denominator behavior. A small rule can still
require a sophisticated binding implementation. The test is whether the
abstract capability is complete, not whether the implementation is simple.

## The intentional loss boundary

The abstract invocation preserves, within the supported coverage of the
selected binding:

- the concrete target and request/message construction implied by the binding;
- caller-facing application input and successful output values;
- application-authored failure values when the governing binding rules can
  identify and project them without exposing their protocol container;
- value ordering and outputs emitted before a later unsuccessful completion;
- interaction behavior such as input closure, streaming, cancellation, and
  normal or unsuccessful completion, as it emerges from the binding; and
- runtime prerequisites that must be satisfied for the binding to act
  correctly, without writing them into the OBI document.

The ordinary operation surface need not expose protocol-only observations,
including native status numbers, headers or trailers as protocol structures,
redirect history, framing, close frames, exact failure bytes, or connection
diagnostics. A binding may consume any of those facts internally to produce the
correct application value or invocation behavior. Once their required effect
has been incorporated, their native representation may disappear at the
abstract boundary.

Information explicitly modeled by the operation contract is never covered by
that permission. An implementation may not call dropping or changing an
operation value "abstraction."

## Project binding-specification responsibility

To meet this project's abstraction-fidelity goal and OBI-B-02 publication
floor, an `openbindings.*` binding specification does the minimum necessary to
make a governed binding portable and actionable without private implementation
policy. It defines:

1. the accepted source forms, address, reference, and target;
2. how caller-facing application values correspond to the concrete
   interaction;
3. which concrete outcomes produce successful application values and when the
   interaction instead completes unsuccessfully, including how any
   application-authored failure value is projected without its protocol
   container;
4. interaction behavior that affects the abstract invocation, including value
   ordering and completion; and
5. genuine choices, explicit conventions, exclusions, and refusal conditions
   needed to close the portable boundary.

It does not define an SDK API, invoker frame protocol, universal failure
taxonomy, retry policy, diagnostic envelope, synthesis naming convention, or a
protocol simulation model. It does not project a protocol fact into an
operation value merely to avoid losing that fact. Once an implementation can
perform the binding and produce the correct abstract values and lifecycle, the
binding specification stops.

## Synthesis boundary

Synthesis derives operation contracts from application-level value
declarations available in the source. It may translate an upstream
application schema into the OBI JSON value domain. It does not turn transport
statuses, headers, trailers, framing, or other native observations into
invented operation fields or tagged variants.

Where a source does not contain enough information to derive a useful
protocol-independent operation contract, synthesis reports the limitation or
excludes the smallest affected unit. It does not buy apparent coverage by
emitting a protocol-shaped operation schema. A hand-authored OBI may provide
an application contract and binding transform that the brownfield artifact
alone could not establish.

An error-like application object crosses `output` only when it is already an
ordinary successful value under the governed interaction or an OBI author has
deliberately modeled it in the operation contract. An invocation interface may
instead preserve an author-intended JSON failure value as opaque failure detail
when the governing binding rules can distinguish that value from its protocol
container without guessing. That does not add the value to the operation's
output schema or give it universal semantics. Synthesis does not infer an
operation result merely because a protocol artifact documents a non-success
response.

## Unsuccessful completion and diagnostics

The abstract invocation needs a structural way to report that an attempt did
not complete normally. The core OBI document does not need an exhaustive
vocabulary for why. SDKs and optional invoker interfaces may offer idiomatic
errors, open-ended codes, or non-normative convenience classifications; no
such vocabulary is presumed complete for future binding families.

An application author may deliberately supply a structured failure value. An
invocation interface may preserve that JSON value opaquely, without assigning
it a cross-protocol category or requiring it to be described by the OBI core.
This lane is not a license to carry raw response envelopes: the binding rules
must identify the application value and discard or diagnose its status,
headers, trailers, framing, and other concrete container facts.

The same boundary applies to human-readable failure prose. A binding may
preserve a message supplied by the application author when it can identify
that message without its protocol container. A raw status line, library error
wrapper, process exit description, or decoder provenance is not made abstract
merely by placing it in a string; ordinary presentation stays
protocol-independent and any concrete evidence moves to diagnostics.

Implementations may retain binding-native evidence for debugging,
observability, conformance work, or expert escape hatches. That surface is
explicitly diagnostic: it may reveal the selected binding, may be resource
bounded when the loss is stated honestly, and must not be required for correct
ordinary use of the operation.

## Acceptance gates

Work claiming abstraction fidelity answers all of these questions:

1. **Protocol blindness:** Can a caller use the operation correctly without
   knowing the selected binding family?
2. **Value fidelity:** Are application inputs and successful outputs unchanged
   except for an operation-declared transform?
3. **Interaction fidelity:** Are ordering, partial outputs, closure,
   cancellation, and completion behavior preserved without adding lifecycle
   declarations to the OBI operation?
4. **No protocol recompilation:** Did synthesis avoid turning native protocol
   observations into operation-schema members?
5. **No private semantics:** Where the governing binding specification leaves
   a genuine application-level choice or correspondence unanswered, did the
   implementation identify its completion as implementation-defined rather
   than attributing it to the identifier? For project specifications, did the
   specification incorporate, preserve, configure, explicitly define, or
   refuse the case rather than leaving it to private policy?
6. **Diagnostic separation:** Could every raw native assertion be removed from
   the ordinary caller surface without making correct operation use
   impossible?

Native-client differential tests remain useful underneath these gates. They
prove that a binding implementation constructed the concrete interaction and
derived the abstract observation correctly. Exact native status, metadata, or
byte equality is binding implementation or diagnostic evidence, not by itself
proof of operation-level fidelity.
