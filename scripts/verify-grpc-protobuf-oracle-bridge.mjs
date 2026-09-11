// Semantic bridge from the sealed, re-executed protoc TextFormat observations.
// This is deliberately independent of both runtime adapters' JSON/wire logic.
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ORACLE = join(ROOT, "conformance/binding-specs/grpc-fixtures/protobuf/oracle");
const require = createRequire(join(ROOT, "conformance/binding-specs/grpc-runners/typescript/package.json"));
const protobuf = require("protobufjs");
const fail = (message) => { throw new Error(`oracle bridge: ${message}`); };
const digest = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const json = (value) => JSON.stringify(canonical(value));

// Accept only the TextFormat surface exercised by this oracle. New upstream
// output syntax must extend this parser explicitly, never silently skip a node.
function parseText(text) {
  let offset = 0;
  function space() { while (/\s/.test(text[offset] ?? "") && offset < text.length) offset++; }
  function token(pattern) {
    space(); const match = pattern.exec(text.slice(offset));
    if (!match) fail(`unrecognized TextFormat at ${offset}: ${text.slice(offset, offset + 40)}`);
    offset += match[0].length; return match[0];
  }
  function nodes(nested = false) {
    const result = [];
    while (true) {
      space();
      if (offset === text.length) { if (nested) fail("unterminated TextFormat message"); return result; }
      if (text[offset] === "}") { if (!nested) fail("unexpected TextFormat close"); offset++; return result; }
      const name = token(/^(?:[A-Za-z_][A-Za-z_0-9]*|[1-9][0-9]*)/); space();
      if (text[offset] === "{") { offset++; result.push({ name, children: nodes(true) }); }
      else {
        if (text[offset++] !== ":") fail("missing TextFormat colon");
        const raw = token(/^(?:"(?:\\.|[^"\\])*"|[^\s{}:]+)/);
        result.push({ name, raw });
      }
    }
  }
  return nodes();
}
function quotedBytes(raw) {
  if (!/^"(?:\\.|[^"\\])*"$/.test(raw)) fail(`expected quoted bytes: ${raw}`);
  const bytes = [];
  for (let i = 1; i < raw.length - 1; i++) {
    if (raw[i] !== "\\") {
      const point = raw.codePointAt(i); bytes.push(...Buffer.from(String.fromCodePoint(point))); if (point > 0xffff) i++;
      continue;
    }
    i++;
    const octal = /^[0-7]{1,3}/.exec(raw.slice(i));
    if (octal) { bytes.push(parseInt(octal[0], 8)); i += octal[0].length - 1; continue; }
    const escapes = { a: 7, b: 8, f: 12, n: 10, r: 13, t: 9, v: 11, "\\": 92, '"': 34, "'": 39, "?": 63 };
    if (!(raw[i] in escapes)) fail(`unsupported TextFormat escape ${raw[i]}`);
    bytes.push(escapes[raw[i]]);
  }
  return Buffer.from(bytes);
}
class UnrepresentableString extends Error {}
function scalar(field, node) {
  if (field.resolvedType instanceof protobuf.Type) {
    if (!node.children) fail(`expected message ${field.name}`);
    return project(field.resolvedType, node.children);
  }
  if (node.children || node.raw === undefined) fail(`expected scalar ${field.name}`);
  if (field.resolvedType instanceof protobuf.Enum) {
    if (!(node.raw in field.resolvedType.values)) fail(`unrecognized oracle enum ${node.raw}`);
    // The oracle sources use ordinary enum spelling, not Edition JSON aliases.
    if (Object.keys(field.resolvedType.options ?? {}).some((key) => key.includes("json"))) fail("unsupported oracle enum JSON option");
    return node.raw;
  }
  if (field.type === "string") {
    try { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(quotedBytes(node.raw)); }
    catch (error) { if (error.code === "ERR_ENCODING_INVALID_ENCODED_DATA") throw new UnrepresentableString(); throw error; }
  }
  if (field.type === "bytes") return quotedBytes(node.raw).toString("base64");
  if (field.type === "bool") { if (!["true", "false"].includes(node.raw)) fail("invalid boolean"); return node.raw === "true"; }
  if (["int64", "uint64", "sint64", "fixed64", "sfixed64"].includes(field.type)) return BigInt(node.raw).toString();
  if (["int32", "uint32", "sint32", "fixed32", "sfixed32"].includes(field.type)) {
    const value = Number(node.raw); if (!Number.isSafeInteger(value)) fail("unsafe integer projection"); return value;
  }
  fail(`unsupported oracle scalar ${field.type}`);
}
function project(type, nodes) {
  const result = Object.create(null);
  for (const node of nodes) {
    if (/^[0-9]+$/.test(node.name)) continue; // Numeric TextFormat fields are retained unknown material, not JSON members.
    const field = type.fields[node.name]; if (!field) fail(`unknown named field ${type.fullName}.${node.name}`);
    const name = field.options?.json_name ?? field.name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    if (field.map) {
      if (!node.children || node.children.length !== 2 || node.children[0].name !== "key" || node.children[1].name !== "value") fail("unresolved map entry observation");
      const key = String(scalar({ type: field.keyType }, node.children[0]));
      (result[name] ??= Object.create(null))[key] = scalar(field, node.children[1]);
    } else if (field.repeated) (result[name] ??= []).push(scalar(field, node));
    else { if (Object.hasOwn(result, name)) fail("duplicate resolved singular observation"); result[name] = scalar(field, node); }
  }
  return result;
}
function textNodes(nodes) {
  return nodes.map((node) => node.children ? `${node.name} {\n${textNodes(node.children)}}\n` : `${node.name}: ${node.raw}\n`).join("");
}
function varint(value) {
  let number = BigInt(value); if (number < 0n || number > 0xffffffffffffffffn) fail("unknown varint outside uint64");
  const bytes = []; while (number > 127n) { bytes.push(Number(number & 127n) | 128); number >>= 7n; } bytes.push(Number(number)); return Buffer.from(bytes);
}
function unknownWire(nodes, type) {
  return Buffer.concat(nodes.map((node) => {
    if (!/^[1-9][0-9]*$/.test(node.name)) fail("named field in unknown observation");
    const id = BigInt(node.name); if (id > 536870911n) fail("unknown field number out of range");
    if (node.children) {
      // protoc's braces can mean a group or heuristic embedded bytes. Here the
      // descriptor must prove this is a closed-enum map (length-delimited).
      const field = type?.fieldsById[Number(id)];
      if (!field?.map || !(field.resolvedType instanceof protobuf.Enum)) fail("ambiguous unknown message wire kind");
      const bytes = unknownWire(node.children); return Buffer.concat([varint(id * 8n + 2n), varint(bytes.length), bytes]);
    }
    if (node.raw.startsWith('"')) { const bytes = quotedBytes(node.raw); return Buffer.concat([varint(id * 8n + 2n), varint(bytes.length), bytes]); }
    if (!/^[0-9]+$/.test(node.raw)) fail(`unsupported unknown wire scalar ${node.raw}`);
    return Buffer.concat([varint(id * 8n), varint(node.raw)]);
  }));
}

function validateRuntimeResult(value, corpus, corpusBytes, runtime) {
  const keys = ["format", "runtime", "corpusSha256", "caseCount", "results"].sort();
  if (!value || json(Object.keys(value).sort()) !== json(keys) || value.format !== "openbindings.protobuf-value-result@1" || value.runtime !== runtime || value.corpusSha256 !== digest(corpusBytes) || value.caseCount !== corpus.cases.length || !Array.isArray(value.results) || value.results.length !== corpus.cases.length) fail(`unclosed ${runtime} result envelope`);
  for (let i = 0; i < corpus.cases.length; i++) {
    const test = corpus.cases[i];
    const expected = { id: test.id, accepted: test.accepted };
    if (test.accepted) expected.canonicalJson = test.canonicalJson;
    if (json(value.results[i]) !== json(expected)) fail(`${runtime} observation differs from derived ${test.id}`);
  }
}

export async function verifyOracleBridge(execute, protocRoot) {
  const verified = spawnSync(process.execPath, [join(ROOT, "scripts/verify-grpc-protobuf-oracle.mjs")], { encoding: "utf8", env: { ...process.env, OPENBINDINGS_PROTOC_36_1_ROOT: protocRoot } });
  if (verified.status !== 0) fail(`upstream replay failed: ${verified.stderr}`);
  const seal = JSON.parse(verified.stdout);
  const cases = JSON.parse(readFileSync(join(ORACLE, "oracle-cases.json"))).cases;
  const observations = JSON.parse(readFileSync(join(ORACLE, "oracle-results.json"))).results;
  const sources = [...new Set(cases.map((test) => test.source))];
  const groups = new Map(); const trace = []; let compileRefusals = 0; let unknownChecks = 0;
  const temp = mkdtempSync(join(tmpdir(), "openbindings-oracle-bridge-"));
  try {
    const manifest = JSON.parse(readFileSync(join(ORACLE, "oracle-manifest.json")));
    for (const { path: source } of manifest.files.filter((file) => file.path.endsWith(".proto"))) {
      const destination = join(temp, source); mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(join(ORACLE, source), destination);
    }
    for (const source of sources) {
      const compiled = spawnSync(join(protocRoot, "bin/protoc"), ["--proto_path=.", `--descriptor_set_out=${join(temp, "source.pb")}`, source], { cwd: ORACLE, env: { ...process.env, LANG: "C", LC_ALL: "C" } });
      const selected = cases.filter((test) => test.source === source);
      if (compiled.status !== 0) {
        for (const test of selected) {
          const observation = observations.find((entry) => entry.id === test.id);
          if (test.expected !== "refused" || observation.exitCode === 0 || observation.stderr !== compiled.stderr.toString()) fail(`unmatched source refusal ${test.id}`);
          trace.push({ id: test.id, disposition: "source-refused", observationSha256: digest(json(observation)) }); compileRefusals++;
        }
        continue;
      }
      const root = new protobuf.Root(); await root.load(join(ORACLE, source), { keepCase: true }); root.resolveAll();
      const edition = /^edition\s*=/m.test(readFileSync(join(ORACLE, source), "utf8"));
      const corpus = { format: "openbindings.protobuf-value-cases@1", source: edition ? "defaults.proto" : source, editionSources: edition ? [source] : [], cases: [] };
      for (const test of selected) {
        const observation = observations.find((entry) => entry.id === test.id);
        const base = { id: `bridge-${test.id}`, kind: "binary", type: test.messageType, dataBase64: test.dataBase64, accepted: observation.exitCode === 0 };
        let disposition = "binary-refused";
        if (base.accepted) {
          const type = root.lookupType(test.messageType); const nodes = parseText(observation.stdout);
          try { base.canonicalJson = json(project(type, nodes)); disposition = "json-representable"; }
          catch (error) { if (!(error instanceof UnrepresentableString)) throw error; base.accepted = false; disposition = "binary-accepted-json-unrepresentable"; }
          if (base.accepted) {
            const known = nodes.filter((node) => !/^[0-9]+$/.test(node.name));
            const unknown = nodes.filter((node) => /^[0-9]+$/.test(node.name));
            const encoded = spawnSync(join(protocRoot, "bin/protoc"), ["--proto_path=.", `--encode=${test.messageType}`, source], { cwd: ORACLE, input: textNodes(known) });
            if (encoded.status !== 0) fail(`known observation re-encode ${test.id}: ${encoded.stderr}`);
            const reconstructed = Buffer.concat([encoded.stdout, unknownWire(unknown, type)]);
            corpus.cases.push({ id: `${base.id}-material`, kind: "binary-equivalent", type: base.type, leftBase64: base.dataBase64, rightBase64: reconstructed.toString("base64"), accepted: true, canonicalJson: base.canonicalJson });
            if (unknown.length) {
              corpus.cases.push({ id: `${base.id}-unknown-retained`, kind: "binary-equivalent", type: base.type, leftBase64: base.dataBase64, rightBase64: encoded.stdout.toString("base64"), accepted: false }); unknownChecks++;
            }
          }
        }
        corpus.cases.push(base);
        trace.push({ id: test.id, disposition, observationSha256: digest(json(observation)) });
      }
      groups.set(source, corpus);
    }
    if (trace.length !== seal.caseCount || new Set(trace.map((entry) => entry.id)).size !== seal.caseCount) fail("oracle coverage is not bijective");
    let runtimeCases = 0; let envelopeMutants = 0;
    for (const [source, corpus] of groups) {
      // Keep the corpus at the closure root so relative source/import paths
      // retain their meaning even when the oracle sources are nested.
      const path = join(temp, `corpus-${digest(source)}.json`); const corpusBytes = `${JSON.stringify(corpus)}\n`; writeFileSync(path, corpusBytes);
      const goResult = execute("go", path); const tsResult = execute("typescript", path);
      validateRuntimeResult(goResult, corpus, corpusBytes, "go-protobuf");
      validateRuntimeResult(tsResult, corpus, corpusBytes, "typescript-protobufjs");
      const { runtime: goRuntime, ...go } = goResult;
      const { runtime: tsRuntime, ...ts } = tsResult;
      if (!isDeepStrictEqual(go, ts) || go.caseCount !== corpus.cases.length) fail(`runtime observation mismatch for ${source}`);
      runtimeCases += go.caseCount;
      for (const mutate of [
        (value) => { value.results = []; },
        (value) => { value.corpusSha256 = "0".repeat(64); },
        (value) => { value.extra = true; },
        (value) => { value.results[0].id = "substituted"; },
        (value) => { value.results[0].accepted = !value.results[0].accepted; },
        (value) => { value.results[0].canonicalJson = "null"; },
        (value) => { value.results[0].extra = true; },
      ]) {
        const changed = structuredClone(goResult); mutate(changed); let rejected = false;
        try { validateRuntimeResult(changed, corpus, corpusBytes, "go-protobuf"); } catch { rejected = true; }
        if (!rejected) fail("runtime result envelope mutation escaped"); envelopeMutants++;
      }
    }
    // Metamutants use the derived corpus: no independent expected-value table.
    // One typed-result, unknown-retention, and binary-disposition corruption
    // must each be caught by both adapters.
    const mutations = [
      ["typed", (test) => test.kind === "binary" && test.accepted && test.canonicalJson !== "{}", (test) => { test.canonicalJson = "{}"; }],
      ["unknown", (test) => test.id.endsWith("-unknown-retained"), (test) => { test.accepted = true; }],
      ["disposition", (test) => test.kind === "binary" && !test.accepted, (test) => { test.accepted = true; }],
    ];
    for (const [label, select, mutate] of mutations) {
      const original = [...groups.values()].find((corpus) => corpus.cases.some(select)); if (!original) fail(`missing ${label} bridge mutation witness`);
      const corpus = structuredClone(original); const test = corpus.cases.find(select); mutate(test); corpus.cases = [test];
      const path = join(temp, `mutant-${label}.json`); writeFileSync(path, `${JSON.stringify(corpus)}\n`);
      execute("go", path, false); execute("typescript", path, false);
    }
    return { oracleCases: seal.caseCount, runtimeCases, compileRefusals, unknownChecks, metamutants: mutations.length, envelopeMutants, manifestSha256: seal.manifestSha256, derivationSha256: digest(json([...groups])), trace };
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
