#!/usr/bin/env node
// verify-catalog.mjs
//
// CI gate for the comparison-convention catalog. Verifies:
//   1. findings.yaml validates against schemas/findings.schema.json (Ajv 2020-12)
//   2. Every kind in findings.yaml has a matching table row in findings.md
//   3. The description column in findings.md matches the YAML description verbatim
//   4. Severity, categories, and modes match between YAML and MD
//   5. Compliance activation map keys in YAML are declared in kinds[]
//   6. Slugs satisfy the §9.1 grammar and length caps
//
// Usage:
//   node scripts/verify-catalog.mjs
//
// Exit codes:
//   0 = catalog is consistent
//   1 = catalog mismatch detected (CI failure)
//   2 = a required input file is missing or malformed

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse as parseYaml } from "yaml";

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(dirname(__filename), "..");

const FILES = {
  yaml: join(ROOT, "findings.yaml"),
  md: join(ROOT, "findings.md"),
  schema: join(ROOT, "schemas", "findings.schema.json"),
};

const SLUG_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){0,5}$/;
const SLUG_MAX_LEN = 128;

const errors = [];
const note = (msg) => errors.push(msg);

function loadOrDie(path, parse) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    console.error(`fatal: cannot read ${path}: ${e.message}`);
    process.exit(2);
  }
  try {
    return parse(raw);
  } catch (e) {
    console.error(`fatal: cannot parse ${path}: ${e.message}`);
    process.exit(2);
  }
}

const yaml = loadOrDie(FILES.yaml, parseYaml);
const schema = loadOrDie(FILES.schema, JSON.parse);
const mdRaw = loadOrDie(FILES.md, (s) => s);

// 1. Schema-validate the YAML.
const Ajv2020 = (await import("ajv/dist/2020.js")).default;
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
if (!validate(yaml)) {
  for (const err of validate.errors) {
    note(`schema: ${err.instancePath} ${err.message}`);
  }
}

// 2. Extract MD table rows for kinds.
//    Tables have the form:  | `slug` | severity | category[, ...] | mode[,...] | description |
const mdRows = new Map();
const tableRowRe = /^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|\s*$/;
for (const line of mdRaw.split("\n")) {
  const m = tableRowRe.exec(line);
  if (!m) continue;
  const [, slug, severity, categories, modes, description] = m;
  if (slug === "Kind" || slug === "Legacy identifier") continue;
  if (mdRows.has(slug)) {
    note(`md: duplicate row for kind '${slug}'`);
    continue;
  }
  mdRows.set(slug, {
    severity: severity.trim(),
    categories: categories.split(",").map((s) => s.trim()),
    modes: modes.split(",").map((s) => s.trim()),
    description: description.trim(),
  });
}

// 3. Cross-check YAML kinds against MD rows.
const yamlKinds = new Set();
for (const entry of yaml.kinds || []) {
  const slug = entry.kind;
  yamlKinds.add(slug);

  if (!SLUG_RE.test(slug)) {
    note(`grammar: '${slug}' violates §9.1 slug grammar`);
  }
  if (slug.length > SLUG_MAX_LEN) {
    note(`grammar: '${slug}' exceeds 128-char cap`);
  }

  const md = mdRows.get(slug);
  if (!md) {
    note(`yaml-only: '${slug}' present in findings.yaml but no row in findings.md`);
    continue;
  }

  if (md.severity !== entry.severity) {
    note(`severity mismatch ${slug}: md='${md.severity}' yaml='${entry.severity}'`);
  }

  const yamlCats = (entry.categories || []).slice().sort();
  const mdCats = md.categories.slice().sort();
  if (yamlCats.join(",") !== mdCats.join(",")) {
    note(`categories mismatch ${slug}: md=[${mdCats}] yaml=[${yamlCats}]`);
  }

  const yamlModes = (entry.modes || []).slice().sort();
  const mdModes = md.modes.slice().sort();
  if (yamlModes.join(",") !== mdModes.join(",")) {
    note(`modes mismatch ${slug}: md=[${mdModes}] yaml=[${yamlModes}]`);
  }

  if (md.description !== entry.description) {
    note(`description mismatch ${slug}:\n  md:   ${md.description}\n  yaml: ${entry.description}`);
  }
}

for (const slug of mdRows.keys()) {
  if (!yamlKinds.has(slug)) {
    note(`md-only: '${slug}' has a row in findings.md but no entry in findings.yaml`);
  }
}

// 4. Compliance activation map symmetry.
const yamlActivation = yaml.compliance_activation || {};
for (const slug of Object.keys(yamlActivation)) {
  if (!yamlKinds.has(slug)) {
    note(`compliance_activation: '${slug}' not declared in kinds[]`);
  }
}

if (errors.length > 0) {
  console.error(`catalog verification FAILED (${errors.length} issue${errors.length === 1 ? "" : "s"}):`);
  for (const msg of errors) console.error("  - " + msg);
  process.exit(1);
}

console.log(`catalog verification OK: ${yamlKinds.size} kinds checked.`);
