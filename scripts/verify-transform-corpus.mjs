#!/usr/bin/env node

/**
 * Verifies cross-file invariants that JSON Schema cannot express by itself:
 * fixture identifiers are globally unique, every known-divergence case names
 * a declared root cause, every declared root cause is exercised, and the
 * schema's allowed root-cause labels match the catalog.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");
const CORPUS_ROOT = join(ROOT, "conformance", "transforms");
const errors = [];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push(`${path}: ${error.message}`);
    return null;
  }
}

const schema = readJson(join(CORPUS_ROOT, "transforms.schema.json"));
const catalog = readJson(join(CORPUS_ROOT, "known-divergence", "catalog.json"));
const fixturePaths = [
  ...readdirSync(join(CORPUS_ROOT, "agree"))
    .filter((name) => name.endsWith(".json"))
    .map((name) => join(CORPUS_ROOT, "agree", name)),
  join(CORPUS_ROOT, "known-divergence", "catalog.json"),
];

const ids = new Set();
for (const path of fixturePaths) {
  const fixture = readJson(path);
  if (!fixture || !Array.isArray(fixture.cases)) continue;
  for (const item of fixture.cases) {
    if (ids.has(item.id)) errors.push(`${path}: duplicate transform case id ${item.id}`);
    ids.add(item.id);
  }
}

if (schema && catalog) {
  const schemaLabels =
    schema?.$defs?.case?.properties?.rootCause?.enum?.slice().sort() || [];
  const declaredLabels = Object.keys(catalog.rootCauses || {}).sort();
  if (JSON.stringify(schemaLabels) !== JSON.stringify(declaredLabels)) {
    errors.push(
      `root-cause labels differ: schema=${schemaLabels.join(",")} catalog=${declaredLabels.join(",")}`
    );
  }

  const usedLabels = new Set();
  for (const item of catalog.cases || []) {
    if (!declaredLabels.includes(item.rootCause)) {
      errors.push(`${item.id}: undeclared root cause ${item.rootCause}`);
    }
    usedLabels.add(item.rootCause);
  }
  for (const label of declaredLabels) {
    if (!usedLabels.has(label)) errors.push(`declared root cause ${label} has no case`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(`transform corpus: ${ids.size} unique cases and aligned root-cause labels: OK`);
