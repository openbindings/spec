#!/usr/bin/env node
// Focused current-kind evidence; historical SDK corpus remains separate.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const suite = join(root, "conformance", "kinds", "openapi-2.0");
function run(command, args) {
  const result = spawnSync(command, args, { cwd: suite, stdio: "inherit", env: { ...process.env, SPEC_ROOT: root } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited ${result.status}`);
}
run("python3", ["run.py"]);
const temp = mkdtempSync(join(tmpdir(), "openapi20-obi-"));
try {
  const cases = JSON.parse(readFileSync(join(suite, "expanded-cases.json"), "utf8"));
  cases.forEach((fixture, i) => writeFileSync(join(temp, `${i}.obi.json`), JSON.stringify(fixture.obi)));
  run("ajv", ["validate", "-s", join(root, "openbindings.schema.json"),
    "--spec=draft2020", "--strict=false", "-d", join(temp, "*.obi.json")]);
} finally { rmSync(temp, { recursive: true, force: true }); }
console.log("OpenAPI 2.0: current-core fixture shapes and focused native interpretation passed; not full implementation conformance.");
