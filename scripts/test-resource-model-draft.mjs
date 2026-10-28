#!/usr/bin/env node
// Focused draft checks, deliberately separate from the historical corpus.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fragmentPointer, select, sharedValue, schemaInventory } from "./resource-model-draft.mjs";

const require = createRequire(new URL("../.github/package.json", import.meta.url));
const Ajv2020 = require("ajv/dist/2020.js");
const addFormats = require("ajv-formats");
const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");
const parse = path => JSON.parse(read(path));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const structure = ajv.compile(parse("openbindings.schema.json"));
const metaAjv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
const meta = metaAjv.getSchema("https://json-schema.org/draft/2020-12/schema");
const entriesValid = (document, inventory) => inventory.entries.every(path => {
  const tokens = path.slice(1).split("/").map(t => t.replaceAll("~1", "/").replaceAll("~0", "~"));
  return meta(select(document, tokens).value);
});
const shape = (document, expected, name) => assert.equal(structure(document), expected, `${name}: ${ajv.errorsText(structure.errors)}`);

const base = () => ({ openbindings: "0.2.0", operations: { run: {} }, bindings: { local: { operation: "run", kind: "example.local@1" } } });
shape(base(), true, "inline-only binding");
shape({ openbindings: "0.2.0", operations: {} }, true, "document containing only operations");
for (const content of [null, false, 3, "text", [], {}, { operation: "kind-owned", kind: "kind-owned", source: "kind-owned" }]) {
  const document = base();
  document.bindings.local.content = content;
  document.resources = { value: content };
  shape(document, true, "arbitrary content and shared values");
}
shape({ ...base(), sources: {} }, false, "removed sources");
shape({ ...base(), schemas: {} }, true, "empty schemas map");
shape({ ...base(), schemas: { Task: { type: "object" }, Never: false } }, true, "schemas entries in object and boolean form");
for (const entry of [null, 3, "text", []]) shape({ ...base(), schemas: { bad: entry } }, false, "schemas entries are schemas");
shape({ ...base(), schemas: { "invalid/key": {} } }, false, "schema entry key syntax");
shape({ ...base(), schemas: { old: { $schema: "http://json-schema.org/draft-07/schema#" } } }, false, "a schemas entry's top-level $schema names 2020-12");
for (const kind of [undefined, null, "", 1]) {
  const document = base();
  if (kind === undefined) delete document.bindings.local.kind;
  else document.bindings.local.kind = kind;
  shape(document, false, "kind must be present and nonempty");
}
const oldBinding = base();
oldBinding.bindings.local.source = "legacy";
shape(oldBinding, false, "removed binding source");
shape({ ...base(), resources: { "invalid/key": {} } }, false, "resource entry key syntax");
shape({ ...base(), resources: { valid: { "unconstrained/key": true } } }, true, "stored member names are data");
shape({ ...base(), resources: { valid: { type: 42 } } }, true, "structure does not interpret stored schemas");

const cases = parse("conformance/resource-model-draft/recognition.json");
for (const test of cases) {
  shape(test.document, true, test.name);
  const expected = { entries: test.entries, schemas: test.schemas, unresolved: test.unresolved, documentDynamicAnchors: test.documentDynamicAnchors };
  const actual = schemaInventory(test.document);
  assert.deepEqual(actual, expected, test.name);
  assert.equal(entriesValid(test.document, actual), test.metaValid, `${test.name}: entry meta-schema validity`);
  const reordered = structuredClone(test.document);
  reordered.operations = Object.fromEntries(Object.entries(reordered.operations).reverse());
  for (const map of ["schemas", "resources"]) if (reordered[map]) reordered[map] = Object.fromEntries(Object.entries(reordered[map]).reverse());
  assert.deepEqual(schemaInventory(reordered), expected, `${test.name}: order independence`);
}

const stored = JSON.parse(`{"schemas":{"Task":{"type":"object","properties":{"id":{"$ref":"#/schemas/Id"}}}},"resources":{"data":{"a/b":{"~key":null},"array":[false,{"ok":true}],"":"empty","%2F":"percent","é":"unicode","__proto__":"own"},"literal":{"$ref":"#/resources/other"},"artifact":{"openapi":"3.1.0","nested":{"$ref":"#/components/schemas/Task"}},"other":42}}`);
const original = JSON.stringify(stored);
const found = [
  ["#/resources/data/a~1b/~0key", null],
  ["#/resources/data/array/0", false],
  ["#/resources/data/array/1/ok", true],
  ["#/resources/data/", "empty"],
  ["#/resources/data/%252F", "percent"],
  ["#/resources/data/%C3%A9", "unicode"],
  ["#/resources/data/__proto__", "own"],
  ["#/resources/literal", { $ref: "#/resources/other" }],
  ["#/resources/artifact", stored.resources.artifact],
  ["#/schemas/Task", stored.schemas.Task],
  ["#/schemas/Task/properties/id", { $ref: "#/schemas/Id" }],
];
for (const [reference, value] of found) assert.deepEqual(sharedValue(stored, { $ref: reference }), { found: true, value }, reference);
const missing = ["", "#", "#name", "#/resources", "#/resources/missing", "#/schemas", "#/schemas/Missing", "#/operations", "#/operations/run", "other.json#/resources/data", "https://example.com/#/resources/data", "#/resources/data/array/01", "#/resources/data/array/-", "#/resources/data/array/2", "#/resources/data/array/1.0", "#/resources/data/array/length", "#/resources/data/toString", "#/resources/data/a~2b", "#/resources/data/%FF", "#/resources/data/%ZZ", "#/resources/data/%", "#/resources/data/a b", "#/resources/data/é", "#/resources/data/a#b"];
for (const reference of missing) assert.deepEqual(sharedValue(stored, { $ref: reference }), { found: false }, reference);
for (const reference of [null, "#/resources/other", {}, { $ref: 42 }, { $ref: "#/resources/other", description: "sibling" }]) assert.deepEqual(sharedValue(stored, reference), { found: false });
assert.deepEqual(fragmentPointer("#/resources/data/%7E01"), ["resources", "data", "~1"], "tilde decoding occurs once");
assert.equal(JSON.stringify(stored), original, "lookup never rewrites artifact or literal references");

let checked = 0;
function example(document, name) {
  shape(document, true, name);
  const inventory = schemaInventory(document);
  assert.deepEqual(inventory.unresolved, [], `${name}: same-document references identify schemas`);
  assert.deepEqual(inventory.documentDynamicAnchors, [], `${name}: no $dynamicAnchor in the document resource`);
  assert.equal(entriesValid(document, inventory), true, `${name}: meta-schema validity`);
  checked++;
}
for (const file of readdirSync(new URL("examples/", root)).filter(file => file.endsWith(".obi.json"))) example(parse(`examples/${file}`), file);
for (const file of ["openbindings.md", "README.md", "MIGRATING-0.1-TO-0.2.md"]) {
  for (const match of read(file).matchAll(/^```json\n([\s\S]*?)^```/gm)) {
    const document = JSON.parse(match[1]);
    if (document !== null && typeof document === "object" && Object.hasOwn(document, "openbindings")) example(document, `${file}: JSON example`);
  }
}
console.log(`Draft checks passed: structural cases, ${cases.length} inventory cases (both orders), ${found.length + missing.length + 5} lookup cases, ${checked} example documents. This is not a full conformance validator.`);
