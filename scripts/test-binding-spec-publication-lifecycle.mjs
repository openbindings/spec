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
  symlinkSync,
  unlinkSync,
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
    join(temp, "conformance", "binding-specs", "adjudication-fixture.md"),
    "# Lifecycle-test adjudication record\n"
  );
  write(
    join(temp, "binding-specs", "openapi-3.1", "openbindings.openapi-3.1.md"),
    "# OpenAPI 3.1\n\nDefines `openbindings.openapi-3.1@1`.\n"
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
    "--adjudication",
    "conformance/binding-specs/adjudication-fixture.md",
    "--families",
    "openapi-3.1@1",
  ]);
  run("node", ["scripts/verify-binding-spec-publications.mjs"]);

  const candidatePath = join(
    temp,
    "binding-specs",
    "openapi-3.1",
    "openbindings.openapi-3.1.md"
  );
  const goodCandidate = readFileSync(candidatePath, "utf8");
  writeFileSync(
    candidatePath,
    `${goodCandidate}\n[Broken lifecycle](../README.md#missing-heading)\n`
  );
  const brokenHeading = run(
    "node",
    ["scripts/verify-binding-spec-publications.mjs"],
    1
  );
  if (!brokenHeading.includes("local Markdown link names a missing heading")) {
    throw new Error("publication verification did not reject a missing local Markdown heading");
  }
  writeFileSync(
    candidatePath,
    `${goodCandidate}\n**[exclusion]** This exclusion reopens only if a future binding identifier implements it.\n`
  );
  const roadmapTrigger = run(
    "node",
    ["scripts/verify-binding-spec-publications.mjs"],
    1
  );
  if (!roadmapTrigger.includes("roadmap-shaped reopen trigger")) {
    throw new Error("publication verification did not reject a roadmap-shaped reopen trigger");
  }
  writeFileSync(candidatePath, goodCandidate);

  const firstDoc = join(
    temp,
    "binding-specs",
    "releases",
    "first",
    "root",
    "binding-specs",
    "openapi-3.1",
    "openbindings.openapi-3.1.md"
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

  const erratumPath = join(
    temp,
    "binding-specs",
    "errata",
    "openapi-3.1",
    "1",
    "0001.md"
  );
  write(
    erratumPath,
    "# `openbindings.openapi-3.1@1` erratum 1\n\nEditorial clarification only.\n"
  );
  const errataPath = join(temp, "binding-specs", "errata.json");
  const errataManifest = {
    format: "openbindings.binding-spec-errata@1",
    errata: [
      {
        id: "openbindings.openapi-3.1@1-erratum-1",
        identifier: "openbindings.openapi-3.1@1",
        publishedAt: "2026-07-24",
        document: "binding-specs/errata/openapi-3.1/1/0001.md",
        sha256: digest(erratumPath),
      },
    ],
  };
  writeFileSync(errataPath, `${JSON.stringify(errataManifest, null, 2)}\n`);
  run("node", ["scripts/verify-binding-spec-publications.mjs", "--base", base]);

  run("git", ["add", "."]);
  run("git", ["commit", "-qm", "append erratum"]);
  const errataBase = run("git", ["rev-parse", "HEAD"]).trim();
  errataManifest.errata[0].publishedAt = "2099-01-01";
  writeFileSync(errataPath, `${JSON.stringify(errataManifest, null, 2)}\n`);
  const errataFailure = run(
    "node",
    ["scripts/verify-binding-spec-publications.mjs", "--base", errataBase],
    1
  );
  if (!errataFailure.includes("published erratum entry changed")) {
    throw new Error("base comparison did not reject mutation of an existing erratum");
  }
  errataManifest.errata[0].publishedAt = "2026-07-24";
  writeFileSync(errataPath, `${JSON.stringify(errataManifest, null, 2)}\n`);

  write(
    join(temp, "binding-specs", "openapi-3.1", "openbindings.openapi-3.1.md"),
    "# OpenAPI\n\nDefines `openbindings.openapi-3.1@3`.\n"
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
      "--adjudication",
    "conformance/binding-specs/adjudication-fixture.md",
    "--families",
      "openapi-3.1@3",
    ],
    2
  );
  if (!skippedRevision.includes("is not the next revision")) {
    throw new Error("publisher did not reject a skipped binding-specification revision");
  }

  write(
    join(temp, "binding-specs", "openapi-3.1", "openbindings.openapi-3.1.md"),
    "# OpenAPI\n\nDefines `openbindings.openapi-3.1@2`.\n"
  );
  const sourceSymlink = join(temp, "binding-specs", "openapi-3.1", "linked.md");
  symlinkSync("../../openbindings.md", sourceSymlink);
  const symlinkFailure = run(
    "node",
    [
      "scripts/publish-binding-specifications.mjs",
      "--publication",
      "symlinked",
      "--published-at",
      "2026-07-24",
      "--core-release",
      "0.2.0",
      "--adjudication",
    "conformance/binding-specs/adjudication-fixture.md",
    "--families",
      "openapi-3.1@2",
    ],
    2
  );
  if (!symlinkFailure.includes("publication sources cannot contain symlinks")) {
    throw new Error("publisher did not reject a source symlink");
  }
  unlinkSync(sourceSymlink);
  rmSync(join(temp, "binding-specs", "releases", "symlinked"), {
    recursive: true,
    force: true,
  });
  run("node", [
    "scripts/publish-binding-specifications.mjs",
    "--publication",
    "second",
    "--published-at",
    "2026-07-24",
    "--core-release",
    "0.2.0",
    "--adjudication",
    "conformance/binding-specs/adjudication-fixture.md",
    "--families",
    "openapi-3.1@2",
  ]);
  run("node", ["scripts/verify-binding-spec-publications.mjs", "--base", base]);

  if (digest(firstDoc) !== firstDigest) {
    throw new Error("publishing @2 changed the archived @1 document");
  }

  const manifestPath = join(temp, "binding-specs", "publications.json");
  const goodManifest = readFileSync(manifestPath, "utf8");
  const changedManifest = JSON.parse(goodManifest);
  changedManifest.publications.find(
    (entry) => entry.identifier === "openbindings.openapi-3.1@1"
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
