import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";

export const FAMILIES = {
  "operation-graph": { identifier: "openbindings.operation-graph", document: "binding-specs/operation-graph/openbindings.operation-graph.md" },
  usage: { identifier: "openbindings.usage", document: "binding-specs/usage/openbindings.usage.md" },
  "openapi-2.0": { identifier: "openbindings.openapi-2.0", document: "binding-specs/openapi-2.0/openbindings.openapi-2.0.md" },
  "openapi-3.0": { identifier: "openbindings.openapi-3.0", document: "binding-specs/openapi-3.0/openbindings.openapi-3.0.md" },
  "openapi-3.1": { identifier: "openbindings.openapi-3.1", document: "binding-specs/openapi-3.1/openbindings.openapi-3.1.md" },
  "openapi-3.2": { identifier: "openbindings.openapi-3.2", document: "binding-specs/openapi-3.2/openbindings.openapi-3.2.md" },
  mcp: { identifier: "openbindings.mcp", document: "binding-specs/mcp/openbindings.mcp.md" },
  grpc: {
    identifier: "openbindings.grpc",
    document: "binding-specs/grpc/openbindings.grpc.md",
    moduleRefsByRevision: { 1: ["protobuf-correspondence@1"] },
  },
  connect: {
    identifier: "openbindings.connect",
    document: "binding-specs/connect/openbindings.connect.md",
    moduleRefsByRevision: { 1: ["protobuf-correspondence@1"] },
  },
  asyncapi: { identifier: "openbindings.asyncapi", document: "binding-specs/asyncapi/openbindings.asyncapi.md" },
  graphql: { identifier: "openbindings.graphql", document: "binding-specs/graphql/openbindings.graphql.md" },
};

export const MODULES = {
  "protobuf-correspondence": {
    identifier: "openbindings.module.protobuf-correspondence",
    document: "binding-specs/modules/openbindings.protobuf-correspondence.md",
  },
};

export const PUBLICATION_CATALOG_ENTRIES = new Set([
  "README.md", "AUTHORITY-PINS.json", "errata.json", "errata.schema.json", "errata",
  "modules", "publications.json", "publication-stage.schema.json",
  "publication-adjudication.schema.json", "publication-evidence.schema.json", ...Object.keys(FAMILIES),
]);

export const PUBLICATION_STATE_LINE = "**Publication state.** The immutable identifier is established only by an entry in the OpenBindings Project's canonical root `binding-specs/publications.json` manifest for these exact defining bytes; absent that entry, this document is an unpublished candidate. Any manifest copy inside an immutable publication bundle is evidence of the pre-mint source snapshot, not the canonical registry.";
export const PUBLICATION_CATALOG_STATE_LINE = "**Publication state is manifest-governed.** The OpenBindings Project's canonical root [`binding-specs/publications.json`](publications.json) is the sole registry of minted binding-specification and companion-module identifiers; an exact identifier absent from that manifest is an unpublished candidate. Status labels below describe that rule and do not hard-code the current inventory.";
export const RELEASE_GUIDE_BINDING_STATE_LINE = "Binding-specification and companion-module publication state is determined solely by the OpenBindings Project's canonical root `binding-specs/publications.json`; entries are immutable publications, while exact identifiers absent from that manifest remain candidates.";

export const GRPC_PROTOBUF_ORACLE_COMMAND = Object.freeze([
  "node", "scripts/verify-grpc-protobuf-oracle.mjs",
]);

export const GRPC_PROTOBUF_ORACLE_PATHS = Object.freeze({
  cases: "conformance/binding-specs/grpc-fixtures/protobuf/oracle/oracle-cases.json",
  directory: "conformance/binding-specs/grpc-fixtures/protobuf/oracle",
  manifest: "conformance/binding-specs/grpc-fixtures/protobuf/oracle/oracle-manifest.json",
  results: "conformance/binding-specs/grpc-fixtures/protobuf/oracle/oracle-results.json",
  verifier: "scripts/verify-grpc-protobuf-oracle.mjs",
});

export const REQUIRED_GATES = {
  "authority-pins": { command: ["node", "scripts/verify-authority-pins.mjs"], target: "source" },
  "binding-specs": { command: ["node", "scripts/verify-binding-specs.mjs"], target: "stage" },
  "diff-check": { command: ["git", "diff", "--check"], target: "source" },
  "grpc-protobuf-compiler": { command: ["node", "scripts/verify-grpc-protobuf-compiler.mjs"], target: "stage" },
  "grpc-protobuf-oracle": { command: GRPC_PROTOBUF_ORACLE_COMMAND, target: "stage" },
  "grpc-ds-witness": { command: ["node", "scripts/verify-grpc-ds-witness.mjs"], target: "stage" },
  "grpc-protobuf-values": { command: ["node", "scripts/verify-grpc-protobuf-values.mjs"], target: "stage" },
  "grpc-runners": { command: ["node", "scripts/verify-grpc-binding-runners.mjs"], target: "stage" },
  "grpc-tls": { command: ["node", "scripts/verify-grpc-tls-fixtures.mjs"], target: "stage" },
  publications: { command: ["node", "scripts/verify-binding-spec-publications.mjs"], target: "source" },
};

export const GRPC_RUNNER_COMMANDS = Object.freeze({
  go: Object.freeze([
    "go", "run",
    "conformance/binding-specs/grpc-runners/go/runner.go",
    "conformance/binding-specs/grpc-runners/go/protojson_strict.go",
    "conformance/binding-specs/processor/grpc.json",
  ]),
  typescript: Object.freeze([
    "node",
    "conformance/binding-specs/grpc-runners/typescript/runner.ts",
    "conformance/binding-specs/processor/grpc.json",
  ]),
});

export const DEPENDENCY_INSTALL_COMMAND = ["npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund", "--silent"];

export const REQUIRED_DEPENDENCY_INSTALLS = {
  "schema-engine-lockfile-install": {
    dependencies: { ajv: "8.18.0", "ajv-formats": "3.0.1" },
    directory: "conformance/binding-specs/schema-engine",
  },
  "typescript-lockfile-install": {
    dependencies: null,
    directory: "conformance/binding-specs/grpc-runners/typescript",
  },
};

export function fail(message) {
  throw new Error(message);
}

export function assertManifestGovernedStatus(catalog, releaseGuide) {
  if (!catalog.includes(PUBLICATION_CATALOG_STATE_LINE)) fail("binding-specification catalog lacks manifest-governed timeless status");
  if (!releaseGuide.includes(RELEASE_GUIDE_BINDING_STATE_LINE)) fail("release guide lacks manifest-governed timeless binding status");
  const stale = /No OpenBindings binding specification has been published yet|\*\*unreleased @[1-9][0-9]* candidate\*\*|every current family document is a mutable|publications\.json` is empty/i;
  if (stale.test(catalog) || stale.test(releaseGuide)) fail("binding publication guidance contains inventory-dependent candidate/publication status");
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function executionResultSha256(stdout = "") {
  return sha256(Buffer.from(stdout));
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  }
  return value;
}

export function canonicalJsonText(value) {
  return `${JSON.stringify(canonicalJson(value), null, 2)}\n`;
}

export function dependencyAttestation(root, id, requireInstalled = false) {
  const rule = REQUIRED_DEPENDENCY_INSTALLS[id];
  if (!rule) fail(`unknown dependency install ${id}`);
  const directory = join(root, rule.directory);
  const packagePath = join(directory, "package.json");
  const packageLockPath = join(directory, "package-lock.json");
  if (!existsSync(packagePath) || !existsSync(packageLockPath)) fail(`${id}: exact package and lockfile are required`);
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  const packageLock = JSON.parse(readFileSync(packageLockPath, "utf8"));
  const dependencies = packageJson.dependencies || {};
  if (rule.dependencies && JSON.stringify(canonicalJson(dependencies)) !== JSON.stringify(canonicalJson(rule.dependencies))) fail(`${id}: package.json dependencies differ from the closed dependency set`);
  if (packageLock.lockfileVersion !== 3 || JSON.stringify(canonicalJson(packageLock.packages?.[""]?.dependencies || {})) !== JSON.stringify(canonicalJson(dependencies))) fail(`${id}: package-lock root differs from package.json or lockfile version 3`);
  for (const [dependency, version] of Object.entries(dependencies)) {
    if (packageLock.packages?.[`node_modules/${dependency}`]?.version !== version) fail(`${id}: lockfile does not pin ${dependency}@${version}`);
    if (requireInstalled) {
      const installedPath = join(directory, "node_modules", dependency, "package.json");
      if (!existsSync(installedPath) || JSON.parse(readFileSync(installedPath, "utf8")).version !== version) fail(`${id}: installed ${dependency}@${version} is absent`);
    }
  }
  return {
    dependencies,
    directory: rule.directory,
    packageLockSha256: sha256(readFileSync(packageLockPath)),
    packageSha256: sha256(readFileSync(packagePath)),
  };
}

export function grpcApparatusRoot(manifest) {
  const normalized = structuredClone(manifest);
  normalized.manifestSha256 = "0".repeat(64);
  return sha256(Buffer.from(canonicalJsonText(normalized)));
}

export function grpcApparatusFileSha256(root, file) {
  const bytes = readFileSync(join(root, file.path));
  if (file.normalization === undefined) return sha256(bytes);
  if (file.normalization !== "grpc-apparatus-root-v1" || file.path !== "scripts/verify-binding-specs.mjs") fail(`unsupported apparatus normalization for ${file.path}`);
  const text = bytes.toString("utf8");
  const normalized = text.replace(
    /const GRPC_APPARATUS_ROOT = "[0-9a-f]{64}";/,
    `const GRPC_APPARATUS_ROOT = "${"0".repeat(64)}";`,
  );
  if (normalized === text) fail(`${file.path}: apparatus root normalization marker is absent`);
  return sha256(Buffer.from(normalized));
}

export function grpcProtobufOracleManifestRoot(manifest) {
  const normalized = structuredClone(manifest);
  normalized.manifestSha256 = "0".repeat(64);
  return sha256(Buffer.from(canonicalJsonText(normalized)));
}

export function grpcProtobufOracleClosure(root) {
  const directory = join(root, GRPC_PROTOBUF_ORACLE_PATHS.directory);
  const manifestPath = join(root, GRPC_PROTOBUF_ORACLE_PATHS.manifest);
  const casesPath = join(root, GRPC_PROTOBUF_ORACLE_PATHS.cases);
  const resultsPath = join(root, GRPC_PROTOBUF_ORACLE_PATHS.results);
  const verifierPath = join(root, GRPC_PROTOBUF_ORACLE_PATHS.verifier);
  for (const [label, path] of [
    ["manifest", manifestPath], ["cases", casesPath], ["results", resultsPath], ["verifier", verifierPath],
  ]) if (!existsSync(path)) fail(`gRPC Protobuf oracle ${label} is missing at ${relative(root, path)}`);

  const manifest = readCanonicalJson(manifestPath, "gRPC Protobuf oracle manifest");
  const manifestKeys = [
    "accepted", "authorityCommit", "caseCount", "caseRootSha256", "files", "format", "manifestSha256",
    "protocArchiveSha256", "protocBinarySha256", "protocVersion", "refused", "resultRootSha256", "sourceRootSha256",
  ];
  if (JSON.stringify(Object.keys(manifest).sort()) !== JSON.stringify(manifestKeys)) fail("gRPC Protobuf oracle manifest has an open or incomplete field set");
  if (manifest.format !== "openbindings.protobuf-oracle-manifest@1" || typeof manifest.protocVersion !== "string" || manifest.protocVersion.length === 0) fail("gRPC Protobuf oracle manifest format or tool version is not exact");
  if (!Array.isArray(manifest.files) || !/^[0-9a-f]{64}$/.test(manifest.manifestSha256 || "")) fail("gRPC Protobuf oracle manifest lacks its exact file closure or self-seal");
  const manifestSha256 = grpcProtobufOracleManifestRoot(manifest);
  if (manifest.manifestSha256 !== manifestSha256) fail("gRPC Protobuf oracle manifest self-seal differs from its canonical normalized bytes");

  const actualFiles = listFiles(directory).map((path) => ({
    path: relative(directory, path).split("\\").join("/"),
    sha256: sha256(readFileSync(path)),
  }));
  const manifestRelative = relative(directory, manifestPath).split("\\").join("/");
  const casesRelative = relative(directory, casesPath).split("\\").join("/");
  const resultsRelative = relative(directory, resultsPath).split("\\").join("/");
  const closedFiles = actualFiles.filter((file) => file.path !== manifestRelative);
  const sourceFiles = closedFiles.filter((file) => file.path.endsWith(".proto"));
  if (sourceFiles.length === 0) fail("gRPC Protobuf oracle closure contains no source fixtures");
  const allowed = new Set([casesRelative, resultsRelative, ...sourceFiles.map((file) => file.path)]);
  const unexpected = closedFiles.filter((file) => !allowed.has(file.path));
  if (unexpected.length > 0 || allowed.size !== closedFiles.length) fail("gRPC Protobuf oracle directory contains a file outside its cases, results, and recursive .proto closure");
  const expectedManifestFiles = [...closedFiles].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  if (JSON.stringify(manifest.files) !== JSON.stringify(expectedManifestFiles)) fail("gRPC Protobuf oracle manifest file records differ from the exact recursive closure");
  readCanonicalJson(casesPath, "gRPC Protobuf oracle cases");
  readCanonicalJson(resultsPath, "gRPC Protobuf oracle results");

  const caseRootSha256 = recordRoot(closedFiles.filter((file) => file.path === casesRelative));
  const resultRootSha256 = recordRoot(closedFiles.filter((file) => file.path === resultsRelative));
  const sourceRootSha256 = recordRoot(sourceFiles);
  const roots = { caseRootSha256, resultRootSha256, sourceRootSha256 };
  for (const key of ["caseRootSha256", "resultRootSha256", "sourceRootSha256"]) {
    if (manifest[key] !== roots[key]) fail(`gRPC Protobuf oracle manifest ${key} differs from its independently derived closure`);
  }
  if (!/^[0-9a-f]{40}$/.test(manifest.authorityCommit || "")) fail("gRPC Protobuf oracle manifest authority commit is not exact");
  for (const key of ["protocArchiveSha256", "protocBinarySha256"]) if (!/^[0-9a-f]{64}$/.test(manifest[key] || "")) fail(`gRPC Protobuf oracle manifest ${key} is not a SHA-256 digest`);
  for (const key of ["accepted", "caseCount", "refused"]) if (!Number.isInteger(manifest[key]) || manifest[key] < 0) fail(`gRPC Protobuf oracle manifest ${key} is not a non-negative integer`);
  if (manifest.caseCount === 0 || manifest.accepted + manifest.refused !== manifest.caseCount) fail("gRPC Protobuf oracle manifest result counts are not closed");

  return {
    accepted: manifest.accepted,
    authorityCommit: manifest.authorityCommit,
    caseCount: manifest.caseCount,
    caseRootSha256,
    harnessRootSha256: recordRoot([{
      path: GRPC_PROTOBUF_ORACLE_PATHS.verifier,
      sha256: sha256(readFileSync(verifierPath)),
    }]),
    manifestSha256,
    protocArchiveSha256: manifest.protocArchiveSha256,
    protocBinarySha256: manifest.protocBinarySha256,
    refused: manifest.refused,
    resultRootSha256,
    sourceRootSha256,
  };
}

export function grpcProtobufOracleEvidence(root, stdout) {
  let observation;
  try {
    observation = JSON.parse(stdout);
  } catch (error) {
    fail(`gRPC Protobuf oracle stdout is not one canonical JSON line: ${error.message}`);
  }
  if (stdout !== `${JSON.stringify(canonicalJson(observation))}\n`) fail("gRPC Protobuf oracle stdout is not one canonical JSON line");
  const keys = [
    "accepted", "authorityCommit", "caseCount", "caseRootSha256", "format", "manifestSha256", "passed",
    "protocArchiveSha256", "protocBinarySha256", "refused", "resultRootSha256", "sourceRootSha256",
  ];
  if (JSON.stringify(Object.keys(observation).sort()) !== JSON.stringify(keys)) fail("gRPC Protobuf oracle result has an open or incomplete field set");
  if (observation.format !== "openbindings.protobuf-oracle-result@1" || observation.passed !== true) fail("gRPC Protobuf oracle result is not a passing @1 observation");
  if (!/^[0-9a-f]{40}$/.test(observation.authorityCommit || "")) fail("gRPC Protobuf oracle authority commit is not exact");
  for (const key of ["caseRootSha256", "manifestSha256", "protocArchiveSha256", "protocBinarySha256", "resultRootSha256", "sourceRootSha256"]) {
    if (!/^[0-9a-f]{64}$/.test(observation[key] || "")) fail(`gRPC Protobuf oracle ${key} is not a SHA-256 digest`);
  }
  for (const key of ["accepted", "caseCount", "refused"]) if (!Number.isInteger(observation[key]) || observation[key] < 0) fail(`gRPC Protobuf oracle ${key} is not a non-negative integer`);
  if (observation.accepted + observation.refused !== observation.caseCount || observation.caseCount === 0) fail("gRPC Protobuf oracle result counts are not closed");
  const closure = grpcProtobufOracleClosure(root);
  for (const key of [
    "accepted", "authorityCommit", "caseCount", "caseRootSha256", "manifestSha256",
    "protocArchiveSha256", "protocBinarySha256", "refused", "resultRootSha256", "sourceRootSha256",
  ]) {
    if (observation[key] !== closure[key]) fail(`gRPC Protobuf oracle ${key} differs from the independently derived staged closure`);
  }
  const authorityRootSha256 = sha256(Buffer.from(canonicalJsonText({
    authorityCommit: closure.authorityCommit,
    protocArchiveSha256: closure.protocArchiveSha256,
    protocBinarySha256: closure.protocBinarySha256,
  })));
  return {
    authorityRootSha256,
    harnessRootSha256: closure.harnessRootSha256,
    observation,
  };
}

export function readCanonicalJson(path, label = path) {
  const text = readFileSync(path, "utf8");
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    fail(`${label}: ${error.message}`);
  }
  if (text !== canonicalJsonText(value)) fail(`${label}: JSON must use canonical sorted-key serialization`);
  return value;
}

export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) fail(`unexpected argument ${arg}`);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) fail(`${arg} requires a value`);
    out[arg.slice(2)] = value;
    i += 1;
  }
  return out;
}

export function parseSelected(requestedText) {
  const requested = (requestedText || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (requested.length === 0) fail("--families must name at least one family@revision");
  const selected = requested.map((item) => {
    const match = item.match(/^([a-z0-9]+(?:[.-][a-z0-9]+)*)@([1-9][0-9]*)$/);
    if (!match) fail(`invalid family revision ${item}`);
    const [ , family, revisionText ] = match;
    const config = FAMILIES[family];
    if (!config) fail(`unknown published family ${family}`);
    const revision = Number(revisionText);
    return {
      family,
      revision,
      identifier: `${config.identifier}@${revision}`,
      document: config.document,
      moduleRefs: moduleRefsForRevision(family, revision),
    };
  });
  if (new Set(selected.map((entry) => entry.family)).size !== selected.length) fail("--families contains a duplicate family");
  return selected;
}

export function parseModuleRef(ref) {
  const match = ref.match(/^([a-z0-9]+(?:[.-][a-z0-9]+)*)@([1-9][0-9]*)$/);
  if (!match || !MODULES[match[1]]) fail(`unknown normative module ${ref}`);
  const revision = Number(match[2]);
  const config = MODULES[match[1]];
  return { module: match[1], revision, identifier: `${config.identifier}@${revision}`, document: config.document };
}

export function moduleRefsForRevision(family, revision) {
  const config = FAMILIES[family];
  if (!config) fail(`unknown binding-specification family ${family}`);
  if (!config.moduleRefsByRevision) return [];
  const refs = config.moduleRefsByRevision[revision];
  if (!Array.isArray(refs)) fail(`${config.identifier}@${revision}: normative-module closure is not registered for this consumer revision`);
  return refs;
}

export function moduleClosure(selected) {
  const consumers = new Map();
  for (const entry of selected) {
    for (const ref of entry.moduleRefs) {
      if (!consumers.has(ref)) consumers.set(ref, []);
      consumers.get(ref).push(entry.identifier);
    }
  }
  return [...consumers].map(([ref, ids]) => ({ ...parseModuleRef(ref), consumers: ids.sort() })).sort((a, b) => a.identifier.localeCompare(b.identifier));
}

export function selectedFromIdentifiers(identifiers) {
  if (!Array.isArray(identifiers)) fail("publication identifiers must be an array");
  const byIdentifier = new Map(Object.entries(FAMILIES).map(([family, config]) => [config.identifier, { family, config }]));
  const selected = identifiers.map((identifier) => {
    const match = typeof identifier === "string" && identifier.match(/^(openbindings\.[a-z0-9]+(?:[.-][a-z0-9]+)*)@([1-9][0-9]*)$/);
    if (!match || !byIdentifier.has(match[1])) fail(`unknown binding-specification identifier ${identifier}`);
    const { family, config } = byIdentifier.get(match[1]);
    const revision = Number(match[2]);
    return { family, revision, identifier, document: config.document, moduleRefs: moduleRefsForRevision(family, revision) };
  });
  if (new Set(selected.map(({ family }) => family)).size !== selected.length) fail("publication identifiers contain a duplicate family");
  return selected;
}

export function candidateDocument(root, family, revision, manifest) {
  const config = FAMILIES[family];
  if (!config) fail(`unknown binding-specification family ${family}`);
  const prior = (manifest.publications || []).filter((entry) => entry.family === family);
  if (prior.length === 0) return config.document;
  return `binding-specs/candidates/${family}/${revision}/openbindings.${family}.md`;
}

export function moduleSourceDocument(module, revision, manifest) {
  const config = MODULES[module];
  if (!config) fail(`unknown normative module ${module}@${revision}`);
  const identifier = `${config.identifier}@${revision}`;
  const published = (manifest.modules || []).find((entry) => entry.identifier === identifier);
  if (published) return published.document;
  const prior = (manifest.modules || []).filter((entry) => entry.module === module);
  if (prior.length === 0) return config.document;
  return `binding-specs/candidates/modules/${module}/${revision}/openbindings.${module}.md`;
}

export function assertPublicationState(markdown, identifier) {
  const exact = markdown.split(/\r?\n/).filter((line) => line === PUBLICATION_STATE_LINE).length;
  if (exact !== 1) fail(`${identifier}: defining document must contain exactly one canonical publication-state line`);
  if (/^\*\*(?:Status|Publication):/m.test(markdown)) fail(`${identifier}: defining document must not carry a mutable status or publication-date header`);
  const identifierMatches = markdown.match(new RegExp(identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || [];
  if (identifierMatches.length === 0) fail(`${identifier}: defining document does not name its exact identifier`);
}

export function assertExactCoreAuthority(markdown, identifier, expectedVersion) {
  const declarations = [...markdown.matchAll(/incorporates exactly version \*\*(\d+\.\d+\.\d+)\*\* of the\s+\[OpenBindings Specification\]\(\.\.\/\.\.\/openbindings\.md\) as its Core authority\.\s+Throughout this document, \*\*Core\*\* means that exact version\./g)].map((match) => match[1]);
  if (declarations.length !== 1) fail(`${identifier}: must declare exactly one exact OpenBindings Core authority`);
  const headings = [...markdown.matchAll(/^## [0-9]+\. (?:Normative references|References)\s*$/gm)];
  if (headings.length !== 1) fail(`${identifier}: must contain exactly one numbered references section`);
  const references = markdown.slice(headings[0].index);
  const versions = [...references.matchAll(/\[OpenBindings Specification (\d+\.\d+\.\d+)\]\(\.\.\/\.\.\/openbindings\.md\)/g)].map((match) => match[1]);
  if (versions.length !== 1) fail(`${identifier}: references must contain exactly one versioned OpenBindings Specification link`);
  if (declarations[0] !== expectedVersion || versions[0] !== expectedVersion) fail(`${identifier}: Core declaration and normative reference must both name ${expectedVersion}`);
}

export function expectedModuleClosure(identifiers) {
  return moduleClosure(selectedFromIdentifiers(identifiers));
}

export function exactModuleRecord(module, rootDir, pathPrefix = "root/", sourcePath = module.sourceDocument || module.document) {
  const bytes = readFileSync(join(rootDir, module.document));
  return {
    canonicalUrl: `https://openbindings.com/binding-spec-modules/${module.module}/${module.revision}`,
    consumers: module.consumers,
    identifier: module.identifier,
    module: module.module,
    path: `${pathPrefix}${module.document}`,
    rawUrl: `https://openbindings.com/raw/binding-spec-modules/${module.module}/${module.revision}.md`,
    revision: module.revision,
    sha256: sha256(bytes),
    sourcePath,
  };
}

export function listFiles(root, onSymlink = (path) => fail(`publication tree contains a symlink: ${path}`)) {
  const out = [];
  function visit(dir) {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      const st = lstatSync(full);
      if (st.isSymbolicLink()) onSymlink(full);
      else if (st.isDirectory()) visit(full);
      else if (st.isFile()) out.push(full);
    }
  }
  if (existsSync(root)) visit(root);
  return out;
}

export function copyTree(source, destination, filter = () => true) {
  if (!existsSync(source)) return;
  function visit(srcDir, destDir) {
    mkdirSync(destDir, { recursive: true });
    for (const name of readdirSync(srcDir).sort()) {
      const src = join(srcDir, name);
      const rel = relative(source, src);
      if (rel.split(/[\\/]/).includes("node_modules") || !filter(rel)) continue;
      const dest = join(destDir, name);
      const st = lstatSync(src);
      if (st.isSymbolicLink()) fail(`publication sources cannot contain symlinks: ${src}`);
      if (st.isDirectory()) visit(src, dest);
      else if (st.isFile()) copyFileSync(src, dest);
    }
  }
  visit(source, destination);
}

export function fileRecords(root, recordBase = root) {
  return listFiles(root).map((full) => ({
    path: relative(recordBase, full).split("\\").join("/"),
    sha256: sha256(readFileSync(full)),
  }));
}

export function recordRoot(records) {
  return sha256(Buffer.from(records.map(({ path, sha256: digest }) => `${path}\0${digest}\n`).sort().join("")));
}

export function gitOutput(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) fail(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout;
}

export function workingSnapshot(root, excluded = []) {
  const head = gitOutput(root, ["rev-parse", "HEAD"]).trim();
  const excludedSet = new Set(excluded);
  const names = gitOutput(root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"])
    .split("\0").filter(Boolean).sort();
  const records = names.filter((path) => !path.startsWith("binding-specs/releases/") && !excludedSet.has(path)).map((path) => ({ path, sha256: sha256(readFileSync(join(root, path))) }));
  return { head, sha256: recordRoot(records), files: records.length };
}

export function writeCanonicalJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, canonicalJsonText(value));
}
