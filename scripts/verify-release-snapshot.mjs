#!/usr/bin/env node
// Smoke-tests scripts/release.sh in an isolated temporary repository layout.
// The release helper must include every core artifact and must not accidentally
// snapshot independently versioned binding-specification subcorpora.

import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = mkdtempSync(join(tmpdir(), "openbindings-release-"));

try {
  mkdirSync(join(tempRoot, "scripts"), { recursive: true });
  mkdirSync(join(tempRoot, "versions"), { recursive: true });
  for (const file of [
    "openbindings.md",
    "openbindings.schema.json",
    "EDITORS.md",
    "LICENSE",
    "IPR.md",
  ]) {
    copyFileSync(join(root, file), join(tempRoot, file));
  }
  copyFileSync(
    join(root, "versions", "README.md"),
    join(tempRoot, "versions", "README.md")
  );
  copyFileSync(
    join(root, "scripts", "release.sh"),
    join(tempRoot, "scripts", "release.sh")
  );
  cpSync(join(root, "conformance"), join(tempRoot, "conformance"), {
    recursive: true,
  });

  const result = spawnSync(
    "bash",
    [join(tempRoot, "scripts", "release.sh"), "0.2.0"],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    process.stderr.write((result.stdout || "") + (result.stderr || ""));
    process.exitCode = 1;
  } else {
    const snapshot = join(tempRoot, "versions", "0.2.0");
    const required = [
      "openbindings.md",
      "openbindings.schema.json",
      "editors.md",
      "LICENSE",
      "IPR.md",
      "conformance/README.md",
      "conformance/manifest.json",
      "conformance/fixture.schema.json",
      "conformance/tool-scenario.schema.json",
      "conformance/document/OBI-D-01.json",
      "conformance/tool/OBI-T-01.json",
      "conformance/scenarios/OBI-T-11.json",
      "conformance/scenarios/OBI-T-17.json",
      "conformance/runners/go/main.go",
    ];
    const excluded = [
      "conformance/binding-specs",
      "conformance/operation-graph",
      "conformance/transforms",
    ];
    const missing = required.filter((path) => !existsSync(join(snapshot, path)));
    const leaked = excluded.filter((path) => existsSync(join(snapshot, path)));
    const snapshotCore = existsSync(join(snapshot, "openbindings.md"))
      ? readFileSync(join(snapshot, "openbindings.md"), "utf8")
      : "";
    const wrongState = snapshotCore.includes("unreleased working draft");
    if (missing.length > 0 || leaked.length > 0 || wrongState) {
      if (missing.length > 0) {
        console.error(`release snapshot missing:\n  ${missing.join("\n  ")}`);
      }
      if (leaked.length > 0) {
        console.error(`release snapshot contains non-core corpus:\n  ${leaked.join("\n  ")}`);
      }
      if (wrongState) console.error("release snapshot still claims to be an unreleased working draft");
      process.exitCode = 1;
    } else {
      console.log("release snapshot layout: OK");
    }
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
