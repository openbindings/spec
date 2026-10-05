#!/usr/bin/env node
// Focused current-kind evidence, deliberately separate from pre-kind SDK corpora.
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const suite = join(root, "conformance", "kinds", "openapi-3.2");
function run(command, args) {
  const result = spawnSync(command, args, { cwd: suite, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run("ajv", ["validate", "-s", join(root, "openbindings.schema.json"),
  "--spec=draft2020", "--strict=false", "-d", "hand-authored.obi.json", "-d", "synthesized.obi.json"]);
run("python3", ["tests.py"]);
console.log("OpenAPI 3.2: current-core example shape and focused interpretation checks passed; not full implementation conformance.");
