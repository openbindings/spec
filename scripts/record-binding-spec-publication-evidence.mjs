#!/usr/bin/env node

import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  DEPENDENCY_INSTALL_COMMAND,
  GRPC_RUNNER_COMMANDS,
  REQUIRED_DEPENDENCY_INSTALLS,
  REQUIRED_GATES,
  dependencyAttestation,
  executionResultSha256,
  fail,
  fileRecords,
  grpcProtobufOracleEvidence,
  parseArgs,
  readCanonicalJson,
  recordRoot,
  sha256,
  workingSnapshot,
  writeCanonicalJson,
} from "./binding-spec-publication-support.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function execute(command, cwd, environment = process.env) {
  const result = spawnSync(command[0], command.slice(1), { cwd, encoding: "utf8", env: environment });
  const exitCode = result.status ?? 1;
  if (exitCode !== 0) {
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    fail(`${command.join(" ")} failed with exit ${exitCode}`);
  }
  return {
    exitCode,
    resultSha256: executionResultSha256(result.stdout || ""),
    status: "pass",
    stdout: result.stdout || "",
  };
}

const ephemeralNodeModules = [];
try {
  const args = parseArgs(process.argv.slice(2));
  if (!args["from-stage"] || !args.out) fail("--from-stage and --out are required");
  const stageDir = resolve(args["from-stage"]);
  const stagePath = join(stageDir, "stage.json");
  if (!existsSync(stagePath)) fail(`stage record not found: ${stagePath}`);
  const stage = readCanonicalJson(stagePath, "stage.json");
  if (stage.format !== "openbindings.binding-spec-publication-stage@3" || !["candidate-review", "prepared-unminted"].includes(stage.state)) fail("unsupported stage record");
  if (stage.state === "candidate-review" && stage.core?.lifecycle !== "unreleased-candidate") fail("candidate-review stage must identify an unreleased Core authority");
  if (stage.state === "prepared-unminted" && stage.core?.lifecycle !== "released") fail("prepared-unminted stage must identify a released Core authority");
  const sourceSnapshot = workingSnapshot(ROOT);
  if (sourceSnapshot.head !== stage.sourceHead || sourceSnapshot.sha256 !== stage.sourceSnapshotSha256 || sourceSnapshot.files !== stage.sourceFileCount) fail("repository source snapshot changed after the stage was prepared; source-target evidence was not executed");
  const stageRoot = join(stageDir, "root");
  for (const rule of Object.values(REQUIRED_DEPENDENCY_INSTALLS)) {
    const nodeModules = join(stageRoot, rule.directory, "node_modules");
    ephemeralNodeModules.push(nodeModules);
    rmSync(nodeModules, { recursive: true, force: true });
  }
  const actualStageFiles = fileRecords(stageRoot, stageDir);
  if (JSON.stringify(actualStageFiles) !== JSON.stringify(stage.files) || recordRoot(actualStageFiles) !== stage.rootSha256) fail("stage file inventory or root changed after preparation; stage-target evidence was not executed");
  const dependencyInstalls = [];
  for (const id of Object.keys(REQUIRED_DEPENDENCY_INSTALLS).sort()) {
    const before = dependencyAttestation(stageRoot, id);
    const installRoot = join(stageRoot, before.directory);
    const nodeModules = join(installRoot, "node_modules");
    rmSync(nodeModules, { recursive: true, force: true });
    const install = execute(DEPENDENCY_INSTALL_COMMAND, installRoot);
    const after = dependencyAttestation(stageRoot, id, true);
    dependencyInstalls.push({
      command: DEPENDENCY_INSTALL_COMMAND,
      dependencies: after.dependencies,
      directory: after.directory,
      exitCode: install.exitCode,
      id,
      packageLockSha256: after.packageLockSha256,
      packageSha256: after.packageSha256,
      resultSha256: install.resultSha256,
      status: install.status,
      target: "stage",
      targetRootSha256: stage.rootSha256,
    });
  }

  const gates = [];
  let oracle;
  for (const [id, rule] of Object.entries(REQUIRED_GATES).sort(([a], [b]) => a.localeCompare(b))) {
    const result = execute(rule.command, rule.target === "stage" ? stageRoot : ROOT);
    if (id === "grpc-protobuf-oracle") oracle = grpcProtobufOracleEvidence(stageRoot, result.stdout);
    gates.push({
      command: rule.command,
      exitCode: result.exitCode,
      id,
      resultSha256: result.resultSha256,
      status: result.status,
      target: rule.target,
      targetRootSha256: rule.target === "stage" ? stage.rootSha256 : stage.sourceSnapshotSha256,
    });
  }
  if (!oracle) fail("gRPC Protobuf oracle evidence was not recorded");

  const runnerOutputs = {};
  const runners = Object.entries(GRPC_RUNNER_COMMANDS).map(([language, command]) => {
    const environment = language === "go" ? { ...process.env, GOCACHE: "/private/tmp/openbindings-grpc-go-build-cache" } : process.env;
    const result = spawnSync(command[0], command.slice(1), { cwd: stageRoot, encoding: "utf8", env: environment });
    if ((result.status ?? 1) !== 0) fail(`${language} runner failed: ${(result.stderr || result.stdout || "").trim()}`);
    runnerOutputs[language] = (result.stdout || "").trim();
    return {
      apparatusRootSha256: stage.apparatusRootSha256,
      command,
      corpusSha256: stage.grpcProcessorCorpusSha256,
      exitCode: 0,
      id: `grpc-runner-${language}`,
      language,
      resultSha256: executionResultSha256(result.stdout || ""),
      status: "pass",
      target: "stage",
      targetRootSha256: stage.rootSha256,
    };
  });
  if (runnerOutputs.go !== runnerOutputs.typescript) fail("Go and TypeScript runner outputs differ");

  writeCanonicalJson(resolve(args.out), {
    dependencyInstalls,
    format: "openbindings.binding-spec-publication-evidence@1",
    gates,
    oracle,
    publication: stage.publication,
    runners,
    stageRecordSha256: sha256(readFileSync(stagePath)),
  });
  console.log(`recorded exact-root publication evidence at ${resolve(args.out)}`);
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exitCode = 2;
} finally {
  for (const path of ephemeralNodeModules) rmSync(path, { recursive: true, force: true });
}
