# OpenBindings Initiative Governance

OpenBindings is currently a maintainer-led, pre-1.0 interoperability
specification. The project intends to become multi-editor and vendor-neutral;
the current roster has one editor, so it does not pretend that a multi-party
governance body already exists.

## Roles

- **Editors** maintain the working specification, steward publication, and
  decide which changes are accepted. The authoritative current roster is
  [`EDITORS.md`](EDITORS.md).
- **Contributors** participate through issues, design discussions, reviews,
  and pull requests.

Editors act as individuals in the interest of interoperable implementations,
not as representatives entitled to direct the specification for an employer
or sponsor.

## Decisions

Changes are proposed in public issues and pull requests. Editors seek technical
agreement and record the important alternatives and reasons. Interoperability,
faithfulness to incorporated authorities, implementability, minimalism, and
backward compatibility where practical are the decision criteria.

The decision authority is the editor roster as it actually exists:

- with one editor, that editor decides and is identified as the decision
  maker;
- with several editors, non-conflicted editors seek rough consensus;
- if rough consensus is not possible, a majority of non-conflicted editors
  decides, with a tie leaving the proposal unaccepted.

Substantive decisions remain reviewable. A request to reconsider should
identify new interoperability evidence, an implementation result, an upstream
authority conflict, or a consequence the recorded decision did not address.

## Appointing an editor

Any contributor may nominate themselves or another willing contributor in a
pull request that adds the nominee to `EDITORS.md`. The nomination must state
the nominee's relevant work, their willingness to serve, affiliations that
could create recurring conflicts, and how they have demonstrated sound
judgment about the project's authority boundaries.

The nomination remains open for public comment for at least 14 days. Every
sitting, non-conflicted editor must approve it. This unanimity rule is
deliberately conservative while the roster is small; governance may adopt a
different threshold once it has at least three editors.

## Leaving or removing the editor role

An editor may resign by pull request or written notice. Remaining
non-conflicted editors may remove an editor:

- after six months without project activity, following 30 days' public notice;
- when the editor can no longer perform the role; or
- for sustained conduct or decision-making incompatible with this governance
  document.

Removal for reasons other than inactivity requires a public rationale to the
extent privacy and safety permit, and unanimous approval by the remaining
non-conflicted editors. An editor never votes on their own removal. If no
eligible editor remains, no normative change or release may be approved until
the OpenBindings GitHub organization owners appoint an interim editor through
a public nomination with the same 14-day comment period. Released snapshots
remain available and immutable during such an interregnum.

## Conflicts and recusal

Editors disclose material conflicts and recuse themselves when a reasonable
observer would question their impartiality. Sponsorship, employment, protocol
ownership, or authorship of a proposal does not automatically disqualify an
editor, but it must not be concealed. A recused editor does not count toward a
decision threshold.

When the sole editor is conflicted, the proposal remains unaccepted until an
independent reviewer acceptable to the affected participants records a review
or another non-conflicted editor can decide it. Delay is preferable to
presenting one interested party's choice as community consensus.

## Releases

Released versions under `versions/<x.y.z>/` and published binding-specification
bundles are immutable. [`RELEASING.md`](RELEASING.md) defines the mechanical
release gates. Intellectual-property status and the additional decision still
required before a final 0.2 release are recorded in [`IPR.md`](IPR.md).

## Sponsorship

Infrastructure and hosting are currently sponsored by
[Endpin](https://endpin.io). Sponsorship grants no specification vote or
special publication right.

## Trademarks

"OpenBindings" is intended to be a community specification name. No separate
trademark policy is currently in force; the project will state one before
representing that a neutral organization controls certification or marks.
