#!/usr/bin/env node
/**
 * Adversarial smoke test for the binding-specification publication lifecycle:
 * publish @1, publish @2 without changing @1, verify append-only history
 * against a git base, and prove both manifest mutation and bundle tampering
 * are rejected.
 */

import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const temp = mkdtempSync(join(tmpdir(), "binding-spec-publication-lifecycle-"));

function write(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function run(command, args, expected = 0) {
  const result = spawnSync(command, args, {
    cwd: temp,
    encoding: "utf8",
  });
  if (result.status !== expected) {
    process.stderr.write((result.stdout || "") + (result.stderr || ""));
    throw new Error(
      `${command} ${args.join(" ")} exited ${result.status}; expected ${expected}`
    );
  }
  return (result.stdout || "") + (result.stderr || "");
}

function digest(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

try {
  mkdirSync(join(temp, "scripts"), { recursive: true });
  for (const script of [
    "publish-binding-specifications.mjs",
    "verify-binding-spec-publications.mjs",
  ]) {
    copyFileSync(join(SCRIPT_DIR, script), join(temp, "scripts", script));
  }

  write(join(temp, "openbindings.md"), "# OpenBindings 0.2.0\n");
  write(join(temp, "openbindings.schema.json"), "{}\n");
  write(join(temp, "EDITORS.md"), "# Editors\n");
  write(join(temp, "binding-specs", "README.md"), "# Binding specs\n");
  write(
    join(temp, "binding-specs", "openapi", "openbindings.openapi.md"),
    "# OpenAPI\n\nDefines `openbindings.openapi@1`.\n"
  );
  write(
    join(temp, "binding-specs", "errata.json"),
    '{\n  "format": "openbindings.binding-spec-errata@1",\n  "errata": []\n}\n'
  );
  mkdirSync(join(temp, "conformance", "binding-specs"), { recursive: true });
  mkdirSync(join(temp, "conformance", "operation-graph"), { recursive: true });

  run("node", [
    "scripts/publish-binding-specifications.mjs",
    "--publication",
    "first",
    "--published-at",
    "2026-07-23",
    "--core-release",
    "0.2.0",
    "--families",
    "openapi@1",
  ]);
  run("node", ["scripts/verify-binding-spec-publications.mjs"]);

  const firstDoc = join(
    temp,
    "binding-specs",
    "releases",
    "first",
    "root",
    "binding-specs",
    "openapi",
    "openbindings.openapi.md"
  );
  const firstDigest = digest(firstDoc);

  run("git", ["init", "-q"]);
  run("git", ["config", "user.name", "Publication Test"]);
  run("git", ["config", "user.email", "publication-test@example.invalid"]);
  run("git", ["add", "."]);
  run("git", ["commit", "-qm", "publish @1"]);
  const base = run("git", ["rev-parse", "HEAD"]).trim();
  const unavailableBase = run(
    "node",
    ["scripts/verify-binding-spec-publications.mjs", "--base", "not-a-commit"],
    1
  );
  if (!unavailableBase.includes("git base is not an available commit")) {
    throw new Error("base comparison did not reject an unavailable commit");
  }

  write(
    join(temp, "binding-specs", "openapi", "openbindings.openapi.md"),
    "# OpenAPI\n\nDefines `openbindings.openapi@3`.\n"
  );
  const skippedRevision = run(
    "node",
    [
      "scripts/publish-binding-specifications.mjs",
      "--publication",
      "skipped",
      "--published-at",
      "2026-07-24",
      "--core-release",
      "0.2.0",
      "--families",
      "openapi@3",
    ],
    2
  );
  if (!skippedRevision.includes("is not the next revision")) {
    throw new Error("publisher did not reject a skipped binding-specification revision");
  }

  write(
    join(temp, "binding-specs", "openapi", "openbindings.openapi.md"),
    "# OpenAPI\n\nDefines `openbindings.openapi@2`.\n"
  );
  run("node", [
    "scripts/publish-binding-specifications.mjs",
    "--publication",
    "second",
    "--published-at",
    "2026-07-24",
    "--core-release",
    "0.2.0",
    "--families",
    "openapi@2",
  ]);
  run("node", ["scripts/verify-binding-spec-publications.mjs", "--base", base]);

  if (digest(firstDoc) !== firstDigest) {
    throw new Error("publishing @2 changed the archived @1 document");
  }

  const manifestPath = join(temp, "binding-specs", "publications.json");
  const goodManifest = readFileSync(manifestPath, "utf8");
  const changedManifest = JSON.parse(goodManifest);
  changedManifest.publications.find(
    (entry) => entry.identifier === "openbindings.openapi@1"
  ).publishedAt = "2099-01-01";
  writeFileSync(manifestPath, `${JSON.stringify(changedManifest, null, 2)}\n`);
  const manifestFailure = run(
    "node",
    ["scripts/verify-binding-spec-publications.mjs", "--base", base],
    1
  );
  if (!manifestFailure.includes("published manifest entry changed")) {
    throw new Error("base comparison did not report the changed @1 manifest entry");
  }

  writeFileSync(manifestPath, goodManifest);
  writeFileSync(firstDoc, `${readFileSync(firstDoc, "utf8")}\nTAMPERED\n`);
  const bundleFailure = run(
    "node",
    ["scripts/verify-binding-spec-publications.mjs"],
    1
  );
  if (!bundleFailure.includes("digest mismatch")) {
    throw new Error("bundle verification did not report archived-file tampering");
  }

  console.log(
    "binding-spec publication lifecycle: @2 coexistence, append-only manifest, and bundle tamper rejection: OK"
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
