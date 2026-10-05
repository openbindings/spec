#!/usr/bin/env node
// Focused current-kind evidence, deliberately separate from pre-kind SDK corpora.
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const suite = join(root, "conformance", "kinds", "openapi-3.2");
function run(command, args) {
  const result = spawnSync(command, args, { cwd: suite, stdio: "inherit", env: { ...process.env, SPEC_ROOT: root } });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run("python3", ["tests.py"]);
run("ajv", ["validate", "-s", join(root, "openbindings.schema.json"),
  "--spec=draft2020", "--strict=false", "-d", "*.obi.json"]);
console.log("OpenAPI 3.2: current-core fixture shapes and focused native interpretation passed; not full implementation conformance.");
