#!/usr/bin/env node
// The guard a TRANSCRIPTION owes (decision-lens rule 2b, "delegate the
// deciding, don't transcribe it").
//
// The acceptance floor's Schema Object dialect verdict is DELEGATED on the OAS
// 3.1 line: that line's Schema Object is governed by
// `https://spec.openapis.org/oas/3.1/dialect/base`, a published JSON Schema the
// engines vendor verbatim and validate against, so the authority's own artifact
// does the discriminating and no keyword list exists in our code.
//
// The 3.0 line has no such artifact to point at. Its Schema Object is "an
// extended subset of the JSON Schema Specification Draft Wright-00", and that
// draft published no meta-schema — `https://json-schema.org/draft-05/schema` is
// 404. The OpenAPI Initiative publishes a convenience JSON Schema for whole 3.0
// documents, but its `Schema` definition is `additionalProperties: false` over
// an enumerated keyword list, a closure the OAS prose never states; adopting it
// would refuse what the edition admits (rule 2). So the engines TRANSCRIBE four
// cells on that line, and this script is the guard that keeps the transcription
// honest: each cell names the sentence it restates, and every sentence must
// still appear verbatim in EVERY accepted 3.0 edition's pinned rendering.
//
// If an edition's bytes ever stop saying what a cell restates, this goes red
// and the cell has to be re-derived rather than quietly kept.
//
// The bytes come from the same gitignored cache
// `scripts/verify-authority-pins.mjs` populates and re-digests; run that first.
// A missing cache is reported as a distinct, named condition, never a pass.
//
// Usage: node scripts/verify-openapi-30-schema-object-transcription.mjs

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_ROOT = resolve(__dirname, "..");
const CACHE = join(SPEC_ROOT, ".authority-cache");

// Every accepted 3.0 edition. A cell is grounded only if every one of them
// states it: `openbindings.openapi@1` reads the line uniformly under each
// edition's own Section 4.1 instruction, so a sentence present in only some of
// them would not be a line-uniform ground.
const EDITIONS = ["3.0.0", "3.0.1", "3.0.2", "3.0.3", "3.0.4"];

// The four cells `oas30SchemaObjectDefects` implements (schema_dialect.go and
// schema-dialect.ts, byte-twinned across the four engines), each with the
// sentence it restates. `mustFollow` additionally requires a keyword name to
// appear in the list the sentence introduces, which is how `required` and
// `enum` reach their JSON Schema definitions on this line.
const CELLS = [
  {
    cell: "required",
    restates:
      "OAS 3.0.x Section 4.7.24.1 lists `required` among the keywords taken directly from JSON Schema, whose definition makes it an array of unique elements",
    sentence: "taken directly from the JSON Schema definition and follow the same specifications",
    mustFollow: "required",
  },
  {
    cell: "enum",
    restates: "the same list reaches `enum`, whose JSON Schema definition makes it an array",
    sentence: "taken directly from the JSON Schema definition and follow the same specifications",
    mustFollow: "enum",
  },
  {
    cell: "items",
    restates: "an array-valued `items` is this line's own narrowing of the draft it extends",
    sentence: "items - Value MUST be an object and not an array",
  },
  {
    cell: "properties",
    restates:
      "a `properties` member is a Schema Object, which on this line is an object (the boolean schema literals are not in this dialect)",
    sentence: "properties - Property definitions MUST be a Schema Object and not a standard JSON Schema",
  },
];

/** Renders an edition's pinned HTML as the plain text its sentences read in. */
function editionText(edition) {
  const path = join(CACHE, `oas-${edition}.html`);
  if (!existsSync(path)) return null;
  const html = readFileSync(path, "utf8");
  const stripped = html.replace(/<[^>]+>/g, "");
  return stripped
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&");
}

let missing = 0;
let failures = 0;
const texts = new Map();
for (const edition of EDITIONS) {
  const text = editionText(edition);
  if (text === null) {
    console.error(`UNCACHED  oas-${edition}.html — run scripts/verify-authority-pins.mjs first`);
    missing += 1;
    continue;
  }
  texts.set(edition, text);
}

for (const { cell, sentence, mustFollow, restates } of CELLS) {
  for (const [edition, text] of texts) {
    const at = text.indexOf(sentence);
    if (at === -1) {
      console.error(`UNGROUNDED  ${cell} @ ${edition}: the sentence it restates is not in the pinned bytes`);
      console.error(`            restated as: ${restates}`);
      console.error(`            looked for:  ${sentence}`);
      failures += 1;
      continue;
    }
    if (mustFollow !== undefined) {
      // The sentence introduces a keyword list; the cell is grounded only if
      // its keyword is IN that list.
      const list = text.slice(at, at + 400);
      if (!list.includes(`\n${mustFollow}\n`)) {
        console.error(`UNGROUNDED  ${cell} @ ${edition}: '${mustFollow}' is not in the list that sentence introduces`);
        failures += 1;
        continue;
      }
    }
    console.log(`OK  ${cell.padEnd(10)} ${edition}`);
  }
}

if (missing > 0) {
  console.error(`\n${missing} edition rendering(s) uncached; the transcription was NOT verified.`);
  process.exit(3);
}
if (failures > 0) {
  console.error(`\n${failures} ungrounded cell/edition pair(s): the 3.0 transcription has drifted from the pinned editions.`);
  process.exit(1);
}
console.log(
  `\n3.0 Schema Object transcription verified: ${CELLS.length} cells grounded in all ${EDITIONS.length} accepted 3.0 editions.`,
);
console.log(
  "The 3.1 line states no cells at all — it validates against the OAS dialect's own artifact — so there is nothing to ground there.",
);
