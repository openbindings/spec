#!/usr/bin/env node
// Focused current-kind evidence; historical SDK corpus remains separate.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const suite = join(root, "conformance", "kinds", "openapi-3.0");
function run(command, args) {
  const result = spawnSync(command, args, { cwd: suite, stdio: "inherit", env: { ...process.env, SPEC_ROOT: root } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited ${result.status}`);
}
run("python3", ["run.py", "--native"]);
const temp = mkdtempSync(join(tmpdir(), "openapi30-obi-"));
try {
  const fixtures = JSON.parse(readFileSync(join(suite, "fixtures.json"), "utf8"));
  fixtures.forEach((fixture, i) => writeFileSync(join(temp, `${i}.obi.json`), JSON.stringify(fixture.obi)));
  run("ajv", ["validate", "-s", join(root, "openbindings.schema.json"),
    "--spec=draft2020", "--strict=false", "-d", join(temp, "*.obi.json"),
    "-d", "hand-authored.obi.json", "-d", "generated.obi.json", "-d", "generated-callbacks.obi.json"]);
} finally { rmSync(temp, { recursive: true, force: true }); }
console.log("OpenAPI 3.0: current-core fixture shapes and focused native interpretation passed; not full implementation conformance.");
