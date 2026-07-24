#!/usr/bin/env node
/**
 * Creates one immutable publication bundle for one or more binding-
 * specification revisions and records them in binding-specs/publications.json.
 *
 * A bundle preserves the repository-relative context needed to read the
 * defining documents and the publication-time conformance evidence. The
 * mutable family paths remain convenient "latest" mirrors; the manifest and
 * bundle are the durable publication record.
 *
 * Usage:
 *   node scripts/publish-binding-specifications.mjs \
 *     --publication 2026-07-23-initial \
 *     --published-at 2026-07-23 \
 *     --core-release 0.2.0 \
 *     --families operation-graph@1,usage@1,openapi@1,mcp@1,grpc@1,connect@1,asyncapi@1
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");
const BINDING_ROOT = join(ROOT, "binding-specs");
const RELEASES_ROOT = join(BINDING_ROOT, "releases");
const MANIFEST_PATH = join(BINDING_ROOT, "publications.json");

const FAMILIES = {
  "operation-graph": {
    identifier: "openbindings.operation-graph",
    document: "binding-specs/operation-graph/openbindings.operation-graph.md",
  },
  usage: {
    identifier: "openbindings.usage",
    document: "binding-specs/usage/openbindings.usage.md",
  },
  openapi: {
    identifier: "openbindings.openapi",
    document: "binding-specs/openapi/openbindings.openapi.md",
  },
  mcp: {
    identifier: "openbindings.mcp",
    document: "binding-specs/mcp/openbindings.mcp.md",
  },
  grpc: {
    identifier: "openbindings.grpc",
    document: "binding-specs/grpc/openbindings.grpc.md",
  },
  connect: {
    identifier: "openbindings.connect",
    document: "binding-specs/connect/openbindings.connect.md",
  },
  asyncapi: {
    identifier: "openbindings.asyncapi",
    document: "binding-specs/asyncapi/openbindings.asyncapi.md",
  },
  graphql: {
    identifier: "openbindings.graphql",
    document: "binding-specs/graphql/openbindings.graphql.md",
  },
};
const PUBLICATION_CATALOG_ENTRIES = new Set([
  "README.md",
  "errata.json",
  "errata",
  ...Object.keys(FAMILIES),
]);

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(2);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      console.log(
        "Usage: publish-binding-specifications.mjs --publication <id> --published-at YYYY-MM-DD --core-release X.Y.Z --families family@revision,..."
      );
      process.exit(0);
    }
    if (!arg.startsWith("--")) fail(`unexpected argument ${arg}`);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) fail(`${arg} requires a value`);
    out[arg.slice(2)] = value;
    i += 1;
  }
  return out;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function listFiles(root) {
  const out = [];
  function visit(dir) {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isSymbolicLink()) fail(`publication bundles cannot contain symlinks: ${full}`);
      if (st.isDirectory()) visit(full);
      else if (st.isFile()) out.push(full);
    }
  }
  visit(root);
  return out;
}

function copyTree(source, destination, filter = () => true) {
  if (!existsSync(source)) return;
  function visit(srcDir, destDir) {
    mkdirSync(destDir, { recursive: true });
    for (const name of readdirSync(srcDir).sort()) {
      const src = join(srcDir, name);
      const rel = relative(source, src);
      if (rel.split(/[\\/]/).includes("node_modules") || !filter(rel)) continue;
      const dest = join(destDir, name);
      const st = statSync(src);
      if (st.isSymbolicLink()) fail(`publication sources cannot contain symlinks: ${src}`);
      if (st.isDirectory()) visit(src, dest);
      else if (st.isFile()) copyFileSync(src, dest);
    }
  }
  visit(source, destination);
}

const args = parseArgs(process.argv.slice(2));
const publication = args.publication;
const publishedAt = args["published-at"];
const coreRelease = args["core-release"];
const requested = (args.families || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

if (!publication || !/^[a-z0-9][a-z0-9.-]*$/.test(publication)) {
  fail("--publication must be a stable lowercase publication id");
}
if (!publishedAt || !/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) {
  fail("--published-at must be YYYY-MM-DD");
}
if (!coreRelease || !/^\d+\.\d+\.\d+$/.test(coreRelease)) {
  fail("--core-release must be X.Y.Z");
}
if (requested.length === 0) fail("--families must name at least one family@revision");

const selected = requested.map((item) => {
  const match = item.match(/^([a-z0-9-]+)@([1-9][0-9]*)$/);
  if (!match) fail(`invalid family revision ${item}`);
  const family = match[1];
  const revision = Number(match[2]);
  const config = FAMILIES[family];
  if (!config) fail(`unknown published family ${family}`);
  return {
    family,
    revision,
    identifier: `${config.identifier}@${revision}`,
    document: config.document,
  };
});

if (new Set(selected.map((entry) => entry.family)).size !== selected.length) {
  fail("--families contains a duplicate family");
}

const publicationDir = join(RELEASES_ROOT, publication);
if (existsSync(publicationDir)) fail(`publication already exists: ${publicationDir}`);

let manifest = {
  format: "openbindings.binding-spec-publications@1",
  latest: {},
  publications: [],
};
if (existsSync(MANIFEST_PATH)) {
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
}
if (manifest.format !== "openbindings.binding-spec-publications@1") {
  fail(`unsupported manifest format ${manifest.format}`);
}

const existingIds = new Set(manifest.publications.map((entry) => entry.identifier));
for (const entry of selected) {
  if (existingIds.has(entry.identifier)) fail(`${entry.identifier} is already published`);
  const priorRevisions = manifest.publications
    .filter((candidate) => candidate.family === entry.family)
    .map((candidate) => candidate.revision);
  const expectedRevision = priorRevisions.length === 0 ? 1 : Math.max(...priorRevisions) + 1;
  if (entry.revision !== expectedRevision) {
    fail(
      `${entry.identifier} is not the next revision; expected ${FAMILIES[entry.family].identifier}@${expectedRevision}`
    );
  }
  const text = readFileSync(join(ROOT, entry.document), "utf8");
  if (!text.includes(entry.identifier)) {
    fail(`${entry.document} does not name ${entry.identifier}`);
  }
}

const snapshotRoot = join(publicationDir, "root");
const manifestTempPath = `${MANIFEST_PATH}.${process.pid}.tmp`;
mkdirSync(snapshotRoot, { recursive: true });

try {
  for (const file of ["openbindings.md", "openbindings.schema.json", "EDITORS.md"]) {
    copyFileSync(join(ROOT, file), join(snapshotRoot, file));
  }

  copyTree(join(ROOT, "binding-specs"), join(snapshotRoot, "binding-specs"), (rel) => {
    const first = rel.split(/[\\/]/)[0];
    return (
      first !== "releases" &&
      rel !== "publications.json" &&
      PUBLICATION_CATALOG_ENTRIES.has(first) &&
      !rel.split(/[\\/]/).includes(".DS_Store")
    );
  });
  copyTree(
    join(ROOT, "conformance", "binding-specs"),
    join(snapshotRoot, "conformance", "binding-specs")
  );
  copyTree(
    join(ROOT, "conformance", "operation-graph"),
    join(snapshotRoot, "conformance", "operation-graph")
  );
  // The binding-specification corpus README derives its fixture convention
  // from the core corpus schema by relative link; retain that dependency so
  // the archived evidence remains self-contained.
  if (existsSync(join(ROOT, "conformance", "fixture.schema.json"))) {
    mkdirSync(join(snapshotRoot, "conformance"), { recursive: true });
    copyFileSync(
      join(ROOT, "conformance", "fixture.schema.json"),
      join(snapshotRoot, "conformance", "fixture.schema.json")
    );
  }
  // The informative catalog links publications.json. A publication bundle
  // cannot embed the live top-level manifest (its digest points back to this
  // bundle), so preserve a non-circular, publication-local context record at
  // that path instead. It is sufficient to identify the exact cohort without
  // pretending to be the live registry.
  writeFileSync(
    join(snapshotRoot, "binding-specs", "publications.json"),
    `${JSON.stringify(
      {
        format: "openbindings.binding-spec-publication-context@1",
        publication,
        publishedAt,
        coreRelease,
        identifiers: selected.map((entry) => entry.identifier).sort(),
      },
      null,
      2
    )}\n`
  );

  const files = listFiles(snapshotRoot).map((full) => ({
    path: relative(publicationDir, full).split("\\").join("/"),
    sha256: sha256(readFileSync(full)),
  }));

  const publicationRecord = {
    format: "openbindings.binding-spec-publication@1",
    publication,
    publishedAt,
    coreRelease,
    identifiers: selected.map((entry) => entry.identifier).sort(),
    files,
  };
  writeFileSync(
    join(publicationDir, "publication.json"),
    `${JSON.stringify(publicationRecord, null, 2)}\n`
  );

  const publicationRecordPath = relative(ROOT, join(publicationDir, "publication.json"))
    .split("\\")
    .join("/");
  const publicationRecordSha256 = sha256(
    readFileSync(join(publicationDir, "publication.json"))
  );

  for (const entry of selected) {
    const archivedDocument = join("binding-specs", "releases", publication, "root", entry.document)
      .split("\\")
      .join("/");
    manifest.publications.push({
      identifier: entry.identifier,
      family: entry.family,
      revision: entry.revision,
      publishedAt,
      coreRelease,
      publication,
      publicationRecord: publicationRecordPath,
      publicationRecordSha256,
      document: archivedDocument,
      canonicalUrl: `https://openbindings.com/binding-specs/${entry.family}/${entry.revision}`,
      rawUrl: `https://openbindings.com/raw/binding-specs/${entry.family}/${entry.revision}.md`,
    });
    manifest.latest[entry.family] = entry.identifier;
  }

  manifest.publications.sort((a, b) => a.identifier.localeCompare(b.identifier));
  manifest.latest = Object.fromEntries(
    Object.entries(manifest.latest).sort(([a], [b]) => a.localeCompare(b))
  );
  writeFileSync(manifestTempPath, `${JSON.stringify(manifest, null, 2)}\n`);
  renameSync(manifestTempPath, MANIFEST_PATH);

  console.log(
    `published ${selected.map((entry) => entry.identifier).join(", ")} in ${relative(
      ROOT,
      publicationDir
    )}`
  );
} catch (error) {
  rmSync(manifestTempPath, { force: true });
  rmSync(publicationDir, { recursive: true, force: true });
  throw error;
}
