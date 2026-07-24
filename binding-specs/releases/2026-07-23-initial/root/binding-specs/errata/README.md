# Binding-specification errata

Published binding-specification documents are immutable. A clarification that
does not change the accepted source domain or any required, permitted, or
refused observable behavior is published as an append-only erratum under the
same identifier rather than by rewriting its defining document.

Each erratum is a new immutable Markdown file:

```text
binding-specs/errata/<family>/<revision>/<sequence>.md
```

and a new entry in `binding-specs/errata.json`. An entry names the exact binding
specification identifier, publication date, erratum document, and SHA-256
digest. Existing entries and files never change.

An erratum states:

1. the exact passage being clarified;
2. the clarification;
3. why the clarification changes no accepted source, required or permitted
   interaction, value correspondence, classification, or refusal; and
4. the rule identifiers affected.

If that argument cannot be made, the change is not errata. It publishes the
next binding-specification revision instead. Editorial mistakes that do not
affect interpretation may also use this mechanism so the published base bytes
remain recoverable.

The permanent website page for a revision presents its immutable defining text
and any subsequently published errata together. The base text remains the
publication record; errata never replace it.
