#!/usr/bin/env node
// Focused current-kind evidence, separate from the pre-kind SDK corpus.
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const suite = join(root, "conformance", "kinds", "openapi-3.1");
function run(command, args) {
  const result = spawnSync(command, args, { cwd: suite, stdio: "inherit", env: { ...process.env, SPEC_ROOT: root } });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run("python3", ["test_suite.py"]);
run("ajv", ["validate", "-s", join(root, "openbindings.schema.json"),
  "--spec=draft2020", "--strict=false", "-d", "fixtures/hand-authored.obi.json",
  "-d", "fixtures/synthesized.obi.json", "-d", "fixtures/executed/*/interface.obi.json"]);
console.log("OpenAPI 3.1: current-core fixture shapes and focused native interpretation passed; not full implementation conformance.");
