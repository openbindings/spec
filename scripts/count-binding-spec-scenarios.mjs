#!/usr/bin/env node
// Derives the binding-specification subcorpus's scenario counts from the
// corpus files themselves.
//
// The subcorpus README quotes three of these numbers in prose. A count
// offered as reproducible ships the script that reproduces it, so this file
// is both the CLI a reader runs and the single derivation that
// `verify-binding-specs.mjs` asserts the README against. There is exactly one
// implementation of each count; the verifier does not re-derive them.
//
// It counts only what is on disk. Whether all seven family files exist, and
// whether every defined P-rule is covered, stay the verifier's checks.
//
// Usage:
//   node scripts/count-binding-spec-scenarios.mjs           # human-readable
//   node scripts/count-binding-spec-scenarios.mjs --json     # machine-readable

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SPEC_ROOT = resolve(__dirname, "..");

function readScenarioFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => ({
      family: basename(name, ".json"),
      file: JSON.parse(readFileSync(join(dir, name), "utf8")),
    }));
}

/**
 * Counts the portable scenario corpora under conformance/binding-specs/.
 *
 * @param {string} [specRoot] repository root of the spec repo
 * @returns {{
 *   processor: { files: number, scenarios: number, coveredRules: string[], perFamily: Record<string, number> },
 *   synthesis: { files: number, scenarios: number, perFamily: Record<string, number> },
 * }}
 */
export function countBindingSpecScenarios(specRoot = DEFAULT_SPEC_ROOT) {
  const corpus = join(specRoot, "conformance", "binding-specs");

  const processorFiles = readScenarioFiles(join(corpus, "processor"));
  const coveredRules = new Set();
  const processorPerFamily = {};
  let processorScenarios = 0;
  for (const { family, file } of processorFiles) {
    processorPerFamily[family] = file.scenarios.length;
    processorScenarios += file.scenarios.length;
    for (const scenario of file.scenarios) {
      for (const rule of scenario.rules ?? []) coveredRules.add(rule);
    }
  }

  const synthesisFiles = readScenarioFiles(join(corpus, "synthesis"));
  const synthesisPerFamily = {};
  let synthesisScenarios = 0;
  for (const { family, file } of synthesisFiles) {
    synthesisPerFamily[family] = file.scenarios.length;
    synthesisScenarios += file.scenarios.length;
  }

  return {
    processor: {
      files: processorFiles.length,
      scenarios: processorScenarios,
      coveredRules: [...coveredRules].sort(),
      perFamily: processorPerFamily,
    },
    synthesis: {
      files: synthesisFiles.length,
      scenarios: synthesisScenarios,
      perFamily: synthesisPerFamily,
    },
  };
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const counts = countBindingSpecScenarios();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(counts, undefined, 2));
  } else {
    const families = [
      ...new Set([
        ...Object.keys(counts.processor.perFamily),
        ...Object.keys(counts.synthesis.perFamily),
      ]),
    ].sort();
    console.log("family      processor  synthesis");
    for (const family of families) {
      console.log(
        `${family.padEnd(11)} ${String(counts.processor.perFamily[family] ?? 0).padStart(9)}  ${String(counts.synthesis.perFamily[family] ?? 0).padStart(9)}`
      );
    }
    console.log(
      `${"total".padEnd(11)} ${String(counts.processor.scenarios).padStart(9)}  ${String(counts.synthesis.scenarios).padStart(9)}`
    );
    console.log(
      `\nPortable processor scenarios: ${counts.processor.scenarios} in ${counts.processor.files} files, citing ${counts.processor.coveredRules.length} distinct P-rules`
    );
    console.log(
      `Portable synthesis scenarios: ${counts.synthesis.scenarios} in ${counts.synthesis.files} files`
    );
  }
}
