#!/usr/bin/env node
// Verifies the binding-specification conformance subcorpus
// (conformance/binding-specs/) against ten action-complete brownfield
// candidates plus one bounded AsyncAPI 3.1 common-kernel candidate.
// Operation Graph has its own composition
// corpus and is invocation-only because its operation contracts live in the
// containing OBI.
//
// Checks performed:
//   1. Every fixture file validates against the subcorpus's shared
//      fixture.schema.json (via ajv-cli, the same validator the CI uses for
//      the core schema).
//   2. Each fixture's `rule` matches its filename, sits in the right family
//      directory, and its `bindingSpec` is that family's exact identifier.
//   3. Each fixture's `section` names a section heading that exists in the
//      family specification.
//   4. Every family D-rule defined in the eleven family candidates' Conformance sections is
//      either covered by a fixture or listed as **Deferred** in the
//      subcorpus README; no rule has two fixture files.
//   5. Every negative test (`valid: false`) carries `violates`, and every
//      `violates` entry resolves to a rule its family spec or the core spec
//      actually defines. Positive tests carry no `violates`.
//   6. Every fixture has at least one positive and one negative test unless
//      marked `coverage: "positive-only"`.
//   7. Portable processor, synthesis, and fidelity scenarios cite only rules
//      owned by their family (or the core), and their normalized identities
//      and coverage evidence are internally consistent.
//   8. Adjudications resolve to live synthesis scenarios and keep core and
//      family authority in their declared lanes.
//   9. The abstraction-fidelity alignment ledger validates against its schema.
//  10. The scenario counts the subcorpus README states in prose equal the
//      counts derived from the corpus by count-binding-spec-scenarios.mjs.
//  11. The synthesis scenario schema still enforces Core's binding-source
//      presence floor without depending on a project interface contract.
//
// The verifier does not judge verdicts — that is the job of family
// processors consuming the corpus (see conformance/binding-specs/README.md).
//
// Exits 0 on success, 1 on any drift, 2 on usage/IO error.
//
// Usage: node scripts/verify-binding-specs.mjs

import {
  readFileSync,
  readdirSync,
  existsSync,
  lstatSync,
  realpathSync,
  mkdtempSync,
  mkdirSync,
  symlinkSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join, dirname, resolve, basename, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  X509Certificate,
} from "node:crypto";
import { countBindingSpecScenarios } from "./count-binding-spec-scenarios.mjs";
import { parseLosslessJson, losslessJsonEqual } from "./lossless-json.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_ROOT = resolve(__dirname, "..");
const TOOLCHAIN_PACKAGE = join(SPEC_ROOT, "conformance", "operation-graph", "runners", "js", "package.json");
const toolchainRequire = createRequire(TOOLCHAIN_PACKAGE);
const toolchainPackage = JSON.parse(readFileSync(TOOLCHAIN_PACKAGE, "utf8"));
const toolchainLock = JSON.parse(readFileSync(join(dirname(TOOLCHAIN_PACKAGE), "package-lock.json"), "utf8"));
if (toolchainPackage.dependencies?.yaml !== "2.8.1"
  || toolchainLock.packages?.["node_modules/yaml"]?.version !== "2.8.1"
  || toolchainLock.packages?.["node_modules/yaml"]?.license !== "ISC"
  || toolchainLock.packages?.["node_modules/yaml"]?.integrity
    !== "sha512-lcYcMxX2PO9XMGvAJkJ3OsNMw+/7FKes7/hgerGUYWIoWu5j/+YQqcZr5JnPZWzOsEBgMbSbiSTn/dv/69Mkpw==")
  throw new Error("AsyncAPI 3.1 YAML qualification dependency/lock integrity drift");
const YAML = toolchainRequire("yaml");
const YAML_VERSION = toolchainRequire("yaml/package.json").version;
if (YAML_VERSION !== "2.8.1") throw new Error(`AsyncAPI 3.1 YAML qualification requires repository-pinned yaml@2.8.1, found ${YAML_VERSION}`);
const CORPUS = join(SPEC_ROOT, "conformance", "binding-specs");
const FIXTURE_SCHEMA = join(CORPUS, "fixture.schema.json");
const PROCESSOR_DIR = join(CORPUS, "processor");
const PROCESSOR_SCHEMA = join(CORPUS, "processor-scenario.schema.json");
const FIDELITY_DIR = join(SPEC_ROOT, "conformance", "invocation-fidelity");
const FIDELITY_SCHEMA = join(FIDELITY_DIR, "scenario.schema.json");
const SYNTHESIS_DIR = join(CORPUS, "synthesis");
const SYNTHESIS_SCHEMA = join(CORPUS, "synthesis-scenario.schema.json");
const PEER_DIALECT_DIR = join(CORPUS, "peer-dialects");
const PROCESSOR_V6_PROBES = join(CORPUS, "harness-probes", "processor-v6.json");
const PROCESSOR_V6_PROBE_SCHEMA = join(CORPUS, "harness-probes", "processor-v6.schema.json");
const PROCESSOR_V6_SEMANTIC_PROBES = join(CORPUS, "harness-probes", "processor-v6-semantics.json");
const PROCESSOR_V6_SEMANTIC_PROBE_SCHEMA = join(CORPUS, "harness-probes", "processor-v6-semantics.schema.json");
const PROCESSOR_V6_SEMANTIC_MANIFEST = join(CORPUS, "harness-probes", "processor-v6-semantics.manifest.json");
const PROCESSOR_V6_SEMANTIC_MANIFEST_SCHEMA = join(CORPUS, "harness-probes", "processor-v6-semantics.manifest.schema.json");
const PROCESSOR_V6_SEMANTIC_MANIFEST_ROOT_SHA256 = "673f32b92543660f87c14d5a69e30f9b7a4588052b1d2d7adf99c4cd77a970a1";
const PROCESSOR_V7_PROBES = join(CORPUS, "harness-probes", "processor-v7.json");
const PROCESSOR_V7_PROBE_SCHEMA = join(CORPUS, "harness-probes", "processor-v7.schema.json");
const PROCESSOR_V7_TLS_ASSETS = join(CORPUS, "harness-probes", "processor-v7-tls-assets.json");
const PROCESSOR_V7_TLS_ASSET_SCHEMA = join(CORPUS, "harness-probes", "processor-v7-tls-assets.schema.json");
const PROCESSOR_V7_TLS_SEMANTICS = join(CORPUS, "harness-probes", "processor-v7-tls-semantics.json");
const PROCESSOR_V7_TLS_SEMANTIC_SCHEMA = join(CORPUS, "harness-probes", "processor-v7-tls-semantics.schema.json");
const PROCESSOR_V7_TLS_MANIFEST = join(CORPUS, "harness-probes", "processor-v7-tls-semantics.manifest.json");
const PROCESSOR_V7_TLS_MANIFEST_SCHEMA = join(CORPUS, "harness-probes", "processor-v7-tls-semantics.manifest.schema.json");
const HTTP_PEER_V1_SCHEMA = join(PEER_DIALECT_DIR, "asyncapi-http-peer-1.schema.json");
const HTTP_NATIVE_V1_SCHEMA = join(PEER_DIALECT_DIR, "asyncapi-http-native-1.schema.json");
const HTTP_PEER_V2_SCHEMA = join(PEER_DIALECT_DIR, "asyncapi-http-peer-2.schema.json");
const HTTP_NATIVE_V2_SCHEMA = join(PEER_DIALECT_DIR, "asyncapi-http-native-2.schema.json");
const HTTP_RUNTIME_V2_SCHEMA = join(PEER_DIALECT_DIR, "asyncapi-http-runtime-2.schema.json");
const PROCESSOR_V7_EXPECTED_CASE_IDS = new Set([
  "V7-SCAFFOLD-PEER-CLEARTEXT-01",
  "V7-SCAFFOLD-PEER-TLS-02",
  "V7-SCAFFOLD-NATIVE-DISPATCH-03",
  "V7-SCAFFOLD-RUNTIME-CLEARTEXT-04",
  "V7-SCAFFOLD-RUNTIME-TLS-05",
  "V7-SCAFFOLD-PEER-UNKNOWN-06",
  "V7-SCAFFOLD-PEER-BASE64-07",
  "V7-SCAFFOLD-NATIVE-DIGEST-08",
  "V7-SCAFFOLD-NATIVE-RAW-SECRET-09",
  "V7-SCAFFOLD-NATIVE-PRIVATE-KEY-10",
  "V7-SCAFFOLD-PROCESSOR-V6-HTTP2-11",
  "V7-SCAFFOLD-PROCESSOR-LEGACY-V7-12",
  "V7-SCAFFOLD-PROCESSOR-NONHTTP1-13",
  "V7-SCAFFOLD-PROCESSOR-HTTP1-14",
  "V7-SCAFFOLD-CORRELATION-GOOD-15",
  "V7-SCAFFOLD-CORRELATION-BAD-16",
  "V7-SCAFFOLD-RUNTIME-TYPO-17",
  "V7-SCAFFOLD-RUNTIME-OBSERVATION-18",
  "V7-SCAFFOLD-PROCESSOR-RUNTIME7-19",
  "V7-SCAFFOLD-PROCESSOR-RUNTIME6-20",
  "V7-SCAFFOLD-NATIVE-BODY-PRESENT-21",
  "V7-SCAFFOLD-NATIVE-BODY-OLD-KIND-22",
  "V7-SCAFFOLD-NATIVE-BODY-MISSING-TYPE-23",
  "V7-SCAFFOLD-NATIVE-ALPN-NULL-24",
  "V7-SCAFFOLD-PEER-TLS-PASSIVE-25",
  "V7-SCAFFOLD-PEER-TLS-BAD-ALPN-26",
  "V7-SCAFFOLD-PROCESSOR-TWO-FINALS-27",
  "V7-SCAFFOLD-PROCESSOR-EARLY-BODY-28",
  "V7-SCAFFOLD-NATIVE-REQUEST-STARTED-29",
  "V7-SCAFFOLD-NATIVE-REQUEST-ZERO-30",
  "V7-SCAFFOLD-PROCESSOR-V1-HTTP2-31",
  "V7-SCAFFOLD-PROCESSOR-V1-TLS-32",
  "V7-SCAFFOLD-PROCESSOR-ASYNC31-V6-33",
  "V7-SCAFFOLD-SYNTHESIS-WRONG-FAMILY-34",
  "V7-SCAFFOLD-PROCESSOR-V6-NEW-NATIVE-35",
  "V7-SCAFFOLD-PROCESSOR-V5-TLS-36",
  "V7-SCAFFOLD-PROCESSOR-WS-HEADERS-37",
  "V7-SCAFFOLD-RUNTIME-BASE64-38",
  "V7-SCAFFOLD-RUNTIME-DECIMAL-39",
  "V7-SCAFFOLD-RUNTIME-SECURITY-ONEOF-40",
  "V7-SCAFFOLD-RUNTIME-SECURITY-TYPO-41",
  "V7-SCAFFOLD-PEER-TLS-NULL-VERSION-ALPN-42",
  "V7-SCAFFOLD-PEER-TLS-RESPONSE-NO-SELECTION-43",
  "V7-SCAFFOLD-PEER-TLS-RESPONSE-NO-ALPN-44",
  "V7-SCAFFOLD-PEER-TLS-DURING-HANDSHAKE-DISCONNECT-45",
  "V7-SCAFFOLD-PROCESSOR-V1-SERVER-VARIABLES-46",
  "V7-SCAFFOLD-PROCESSOR-V1-CHANNEL-PARAMETERS-47",
  "V7-SCAFFOLD-PROCESSOR-V5-LAYER-SECURITY-48",
  "V7-SCAFFOLD-PEER-TLS-REQUEST-DISCONNECT-NO-SELECTION-49",
  "V7-SCAFFOLD-PROCESSOR-V1-LAYER-SECURITY-50",
  "V7-SCAFFOLD-MAPPER-SUCCESS-51",
  "V7-SCAFFOLD-MAPPER-UNSUCCESSFUL-52",
  "V7-SCAFFOLD-MAPPER-INCOMPLETE-53",
  "V7-SCAFFOLD-MAPPER-PROTOCOL-54",
  "V7-SCAFFOLD-MAPPER-DISCONNECT-55",
  "V7-SCAFFOLD-MAPPER-INTERIM-56",
  "V7-SCAFFOLD-MAPPER-BODY-57",
  "V7-SCAFFOLD-MATERIALIZE-SOURCE-58",
  "V7-SCAFFOLD-MATERIALIZE-RESOURCE-59",
  "V7-SCAFFOLD-MATERIALIZE-PEER-60",
  "V7-SCAFFOLD-MATERIALIZE-INVOCATION-61",
  "V7-SCAFFOLD-MATERIALIZE-OPERATION-62",
  "V7-SCAFFOLD-MATERIALIZE-CONFIG-63",
  "V7-SCAFFOLD-MATERIALIZE-SELF-64",
  "V7-SCAFFOLD-MATERIALIZE-EXPECTED-65",
  "V7-SCAFFOLD-MATERIALIZE-BYTES-66",
  "V7-SCAFFOLD-MATERIALIZE-ESCAPE-67",
]);
const PROCESSOR_V7_PROBE_ROOT_SHA256 = "14b1b1845461c2832741b26ac85e203eb17e5229491b9baadfdde0b9f6cc0164";
const PROCESSOR_V7_SCAFFOLD_SHA256 = Object.freeze(new Map([
  [HTTP_PEER_V1_SCHEMA, "7470f954d522e45c43984212a26d3b9bd342efcc7a9f6ba3d1f63fe869780647"],
  [HTTP_NATIVE_V1_SCHEMA, "d13a0ec9ad7a04373374661a93f6ecd0aa2547cdd572a4e87bac4cba20634c4e"],
  [HTTP_PEER_V2_SCHEMA, "40b2087014911a127b770be59ae8b1cacda9f66feb083d5f2c6bc96436c6af5c"],
  [HTTP_NATIVE_V2_SCHEMA, "e73508e58b39b810d53afdcdb8f75efe0a59d648a3eb1069cdf3cd6aaadc9d95"],
  [HTTP_RUNTIME_V2_SCHEMA, "e0ab7022879d7b69ef0365de70b6e78587348515724796b7b2234f2a4a5f1eac"],
  [PROCESSOR_V7_PROBE_SCHEMA, "8e019dd2eff697b4ca79553a9e413f969229499cd47d35b5528b4af24b07d1b0"],
  [PROCESSOR_V7_PROBES, "a6a71933ad8c3a9d81fab12be674da7ff0eef21f6d8bdbf985c19edd8789ed82"],
]));
const PROCESSOR_V7_TLS_EXPECTED_CASE_IDS = new Set([
  ...Array.from({ length: 54 }, (_, index) => `C20B-TLS-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 54 }, (_, index) => `C20B-SEC-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 83 }, (_, index) => `C20B-HTTP-${String(index + 1).padStart(2, "0")}`),
]);
const PROCESSOR_V7_TLS_ROOT_SHA256 = "232628b6c0a9d1187181231d5381322cfda892be6cef3089983463c71e3f62c0";
const PROCESSOR_V7_TLS_MANIFEST_ROOT_SHA256 = "ae369cd993742f5348ce010598fffaab8f06dcce276cf95d3043ff04902be19a";
const PROCESSOR_V7_TLS_TYPE_AWARE_ROOT_SHA256 = "f84afb9ce3e77a1cbedbd05397f69b98fb7b4b52fb8192599ff353a338eb6d8b";
const PROCESSOR_V7_TLS_FILE_SHA256 = Object.freeze(new Map([
  [PROCESSOR_V7_TLS_ASSETS, "3284c0cb6edea250d7c8814847ffbc458478ed91ed2d375b11bdde4715087241"],
  [PROCESSOR_V7_TLS_ASSET_SCHEMA, "1851c90e5fd98204bc78e2c3801f837750ec5279734df49ed89174dd83a2b7a3"],
  [PROCESSOR_V7_TLS_SEMANTICS, "a02698d922daef28406df8a9ac7de23bf36c5224b88f24bb8b0c42bc78b23b98"],
  [PROCESSOR_V7_TLS_SEMANTIC_SCHEMA, "c8f4157acbcce1d43fab65ce52b65b4a731379d5b5bb44e13614e349953d30ee"],
  [PROCESSOR_V7_TLS_MANIFEST, "392957f8350f8bdd26625232226d386363f100686a1f480a769074d3b20f554d"],
  [PROCESSOR_V7_TLS_MANIFEST_SCHEMA, "72d7358448c6171dc5b4214cf5d3a27c3342e8ac455d795b0b9c8fbd7b09bd02"],
]));
const ASYNC31_ARTIFACT_ROOT_SHA256 = "d75e93be0150fc351746927a4dc246c8040d75a2a246c174c1f38b0d1607e9e7";
const ASYNC31_ARTIFACT_RELATIVE_PATHS = Object.freeze([
  "asyncapi-3.1/ASYNC31-D-01.json",
  "asyncapi-3.1/ASYNC31-D-02.json",
  "asyncapi-3.1/ASYNC31-D-03.json",
  "asyncapi-3.1/ASYNC31-D-04.json",
  "asyncapi-3.1/ASYNC31-D-05.json",
  "asyncapi-3.1/ASYNC31-D-06.json",
  "asyncapi-3.1/ASYNC31-D-07.json",
  "processor/asyncapi-3.1.json",
  "synthesis/asyncapi-3.1.json",
]);
const ASYNC31_ARTIFACT_EXPECTED_COUNTS = Object.freeze({
  d01Tests: 50,
  d02Tests: 12,
  d03Tests: 29,
  d04Tests: 24,
  d05Tests: 17,
  d06Tests: 16,
  d07Tests: 6,
  processorScenarios: 240,
  synthesisScenarios: 75,
});
const PROCESSOR_V6_SEMANTIC_EXPECTED_COUNTS = Object.freeze({
  cases: 26,
  accepted: 47,
  rejected: 61,
  trials: 108,
});
const PROCESSOR_V6_REQUIRED_SEMANTIC_TRIAL_IDS = new Set([
  "V6-SEMANTIC-C4-MANDATORY-CONNECT-01-R01",
  "V6-SEMANTIC-C4-MANDATORY-CONNECT-01-R02",
  "V6-SEMANTIC-C4-MANDATORY-CONNECT-01-R03",
  "V6-SEMANTIC-C4-MANDATORY-CONNECT-01-R04",
  "V6-SEMANTIC-C4-MANDATORY-CONNECT-01-R05",
  "V6-SEMANTIC-C4-MANDATORY-CONNECT-01-R06",
  "V6-SEMANTIC-C4-PER-FLOW-RESUME-01-A01",
  "V6-SEMANTIC-C4-PER-FLOW-RESUME-01-A02",
  "V6-SEMANTIC-C4-PER-FLOW-RESUME-01-A03",
  "V6-SEMANTIC-C4-PER-FLOW-RESUME-01-A04",
  "V6-SEMANTIC-C4-PER-FLOW-RESUME-01-R01",
  "V6-SEMANTIC-C4-CONNACK-CAPABILITIES-01-A01",
  "V6-SEMANTIC-C4-CONNACK-CAPABILITIES-01-A02",
  "V6-SEMANTIC-C4-CONNACK-CAPABILITIES-01-A03",
  "V6-SEMANTIC-C4-CONNACK-CAPABILITIES-01-A04",
  "V6-SEMANTIC-C4-CONNACK-CAPABILITIES-01-A05",
  "V6-SEMANTIC-C4-CONNACK-CAPABILITIES-01-R01",
  "V6-SEMANTIC-C4-CONNACK-CAPABILITIES-01-R02",
  "V6-SEMANTIC-C4-CONNACK-CAPABILITIES-01-R03",
  "V6-SEMANTIC-C4-CONNACK-CAPABILITIES-01-R04",
  "V6-SEMANTIC-C4-CONNACK-CAPABILITIES-01-R05",
  "V6-SEMANTIC-C4-RFC6455-CASE-INSENSITIVITY-01-A01",
  "V6-SEMANTIC-C5-PUBREL-NATIVE-01-A01",
  "V6-SEMANTIC-C5-PUBREL-NATIVE-01-A02",
  "V6-SEMANTIC-C5-PUBREL-NATIVE-01-R01",
  "V6-SEMANTIC-C5-PUBREL-NATIVE-01-R02",
  "V6-SEMANTIC-C5-PUBREL-RESUME-01-A01",
  "V6-SEMANTIC-C5-PUBREL-RESUME-01-A02",
  "V6-SEMANTIC-C5-PUBREL-RESUME-01-R01",
  "V6-SEMANTIC-C5-PUBREL-RESUME-01-R02",
  "V6-SEMANTIC-C5-PUBREL-RESUME-01-R03",
  "V6-SEMANTIC-C5-PUBREL-RESUME-01-R04",
  "V6-SEMANTIC-C5-PUBREL-RESUME-01-R05",
  "V6-SEMANTIC-C5-INBOUND-MAXIMUM-AND-RECONNECT-CAPABILITY-01-A01",
  "V6-SEMANTIC-C5-INBOUND-MAXIMUM-AND-RECONNECT-CAPABILITY-01-A02",
  "V6-SEMANTIC-C5-INBOUND-MAXIMUM-AND-RECONNECT-CAPABILITY-01-R01",
  "V6-SEMANTIC-C5-INBOUND-MAXIMUM-AND-RECONNECT-CAPABILITY-01-R02",
  "V6-SEMANTIC-C6-DIRECTIONAL-RECEIVE-MAXIMUM-01-A01",
  "V6-SEMANTIC-C6-DIRECTIONAL-RECEIVE-MAXIMUM-01-A02",
  "V6-SEMANTIC-C6-DIRECTIONAL-RECEIVE-MAXIMUM-01-R01",
  "V6-SEMANTIC-C6-DIRECTIONAL-RECEIVE-MAXIMUM-01-R02",
  "V6-SEMANTIC-C6-RECONNECT-DEPENDENCIES-01-A01",
  "V6-SEMANTIC-C6-RECONNECT-DEPENDENCIES-01-R01",
  "V6-SEMANTIC-C6-RECONNECT-DEPENDENCIES-01-R02",
  "V6-SEMANTIC-C6-RECONNECT-DEPENDENCIES-01-R03",
  "V6-SEMANTIC-C6-RECONNECT-DEPENDENCIES-01-R04",
  "V6-SEMANTIC-C6-RECONNECT-NATIVE-EVIDENCE-01-A01",
  "V6-SEMANTIC-C6-RECONNECT-NATIVE-EVIDENCE-01-R01",
  "V6-SEMANTIC-C6-MAXIMUM-PACKET-SIZE-CLOSURE-01-R01",
  "V6-SEMANTIC-C6-TOPIC-ALIAS-01-A01",
  "V6-SEMANTIC-C6-TOPIC-ALIAS-01-A02",
  "V6-SEMANTIC-C6-TOPIC-ALIAS-01-R01",
  "V6-SEMANTIC-C6-TOPIC-ALIAS-01-R02",
  "V6-SEMANTIC-C6-PUBLISH-DUP-IDENTITY-01-R01",
  "V6-SEMANTIC-C6-PUBLISH-DUP-IDENTITY-01-R02",
  "V6-SEMANTIC-C6-PUBLISH-DUP-IDENTITY-01-R03",
  "V6-SEMANTIC-C6-PUBLISH-DUP-IDENTITY-01-R04",
  "V6-SEMANTIC-C6-PUBLISH-DUP-IDENTITY-01-R05",
  "V6-SEMANTIC-C6-PUBLISH-DUP-IDENTITY-01-R06",
  "V6-SEMANTIC-C6-PUBLISH-DUP-IDENTITY-01-R07",
  "V6-SEMANTIC-C6-PUBLISH-DUP-IDENTITY-01-R08",
  "V6-SEMANTIC-C7-AUTHENTICATION-METHOD-EQUALITY-01-R01",
  "V6-SEMANTIC-C7-AUTHENTICATION-METHOD-EQUALITY-01-R02",
  "V6-SEMANTIC-C7-AUTHENTICATION-METHOD-EQUALITY-01-R03",
  "V6-SEMANTIC-C7-AUTHENTICATION-METHOD-EQUALITY-01-R04",
  "V6-SEMANTIC-C7-RETAINED-PUBLISH-COMPARATOR-01-A01",
  "V6-SEMANTIC-C7-RETAINED-PUBLISH-COMPARATOR-01-A02",
  "V6-SEMANTIC-C7-RETAINED-PUBLISH-COMPARATOR-01-A03",
  "V6-SEMANTIC-C7-RETAINED-PUBLISH-COMPARATOR-01-R01",
  "V6-SEMANTIC-C7-RETAINED-PUBLISH-COMPARATOR-01-R02",
  "V6-SEMANTIC-C7-RETAINED-PUBLISH-COMPARATOR-01-R03",
  "V6-SEMANTIC-C7-RETAINED-PUBLISH-COMPARATOR-01-R04",
  "V6-SEMANTIC-C7-CURRENT-SESSION-EXPIRY-01-A01",
  "V6-SEMANTIC-C7-CURRENT-SESSION-EXPIRY-01-R01",
  "V6-SEMANTIC-C9-SUBSCRIPTION-IDENTIFIER-CAUSALITY-01-A01",
  "V6-SEMANTIC-C9-CROSS-FLOW-ORDER-MQTT5-01-A01",
  "V6-SEMANTIC-C9-CROSS-FLOW-ORDER-MQTT5-01-A02",
  "V6-SEMANTIC-C9-CROSS-FLOW-ORDER-MQTT5-01-A03",
  "V6-SEMANTIC-C9-CROSS-FLOW-ORDER-MQTT5-01-R01",
  "V6-SEMANTIC-C9-CROSS-FLOW-ORDER-MQTT5-01-R02",
  "V6-SEMANTIC-C9-CROSS-FLOW-ORDER-MQTT5-01-R03",
  "V6-SEMANTIC-C9-CROSS-FLOW-ORDER-MQTT311-01-A01",
  "V6-SEMANTIC-C9-CROSS-FLOW-ORDER-MQTT311-01-A02",
  "V6-SEMANTIC-C9-CROSS-FLOW-ORDER-MQTT311-01-A03",
  "V6-SEMANTIC-C9-CROSS-FLOW-ORDER-MQTT311-01-R01",
  "V6-SEMANTIC-C9-CROSS-FLOW-ORDER-MQTT311-01-R02",
  "V6-SEMANTIC-C9-CROSS-FLOW-ORDER-MQTT311-01-R03",
  "V6-SEMANTIC-C8-OUTBOUND-RESEND-ORDER-01-A01",
  "V6-SEMANTIC-C8-OUTBOUND-RESEND-ORDER-01-R01",
  "V6-SEMANTIC-C10-UNIFIED-INBOUND-ACK-ORDER-01-A01",
  "V6-SEMANTIC-C10-UNIFIED-INBOUND-ACK-ORDER-01-A02",
  "V6-SEMANTIC-C10-UNIFIED-INBOUND-ACK-ORDER-01-A03",
  "V6-SEMANTIC-C10-UNIFIED-INBOUND-ACK-ORDER-01-A04",
  "V6-SEMANTIC-C10-SUBSCRIPTION-GENERATIONS-01-A01",
  "V6-SEMANTIC-C10-SUBSCRIPTION-GENERATIONS-01-A02",
  "V6-SEMANTIC-C10-SUBSCRIPTION-GENERATIONS-01-A03",
  "V6-SEMANTIC-C10-SUBSCRIPTION-GENERATIONS-01-R01",
  "V6-SEMANTIC-C10-SUBSCRIPTION-GENERATIONS-01-R02",
  "V6-SEMANTIC-C11-UNOBSERVED-GENERATION-CARRY-01-A01",
  "V6-SEMANTIC-C11-UNOBSERVED-GENERATION-CARRY-01-R01",
  "V6-SEMANTIC-C11-UNSUBSCRIBE-RESUBSCRIBE-GENERATION-01-A01",
  "V6-SEMANTIC-C11-UNSUBSCRIBE-RESUBSCRIBE-GENERATION-01-R01",
  "V6-SEMANTIC-C12-SUBSCRIPTION-CORRELATED-STATE-01-A01",
  "V6-SEMANTIC-C12-SUBSCRIPTION-CORRELATED-STATE-01-A02",
  "V6-SEMANTIC-C12-SUBSCRIPTION-CORRELATED-STATE-01-R01",
  "V6-SEMANTIC-C13-SESSION-SUBSCRIPTION-FRONTIER-01-A01",
  "V6-SEMANTIC-C13-SESSION-SUBSCRIPTION-FRONTIER-01-A02",
  "V6-SEMANTIC-C13-SESSION-SUBSCRIPTION-FRONTIER-01-R01",
]);
const ADJUDICATIONS = join(CORPUS, "adjudications.json");
const ADJUDICATION_SCHEMA = join(CORPUS, "adjudication.schema.json");
const ABSTRACTION_FIDELITY_DIR = join(SPEC_ROOT, "conformance", "abstraction-fidelity");
const ABSTRACTION_FIDELITY_LEDGER = join(ABSTRACTION_FIDELITY_DIR, "ledger.json");
const ABSTRACTION_FIDELITY_SCHEMA = join(ABSTRACTION_FIDELITY_DIR, "ledger.schema.json");
const README = join(CORPUS, "README.md");
const CORE_SPEC_MD = join(SPEC_ROOT, "openbindings.md");
const OPENAPI_FAMILY_DIRS = new Set([
  "openapi-2.0",
  "openapi-3.0",
  "openapi-3.1",
  "openapi-3.2",
]);
const PROCESSOR_V6 = "openbindings.binding-spec-processor-scenarios@6";
const PROCESSOR_V7 = "openbindings.binding-spec-processor-scenarios@7";
const SYNTHESIS_V6 = "openbindings.binding-spec-synthesis-scenarios@6";
const SYNTHESIS_V7 = "openbindings.binding-spec-synthesis-scenarios@7";
const PEER_DIALECT_SCHEMAS = new Map([
  [
    "openbindings.asyncapi-http-peer@1",
    HTTP_PEER_V1_SCHEMA,
  ],
  [
    "openbindings.asyncapi-http-peer@2",
    HTTP_PEER_V2_SCHEMA,
  ],
  [
    "openbindings.asyncapi-websocket-peer@1",
    join(PEER_DIALECT_DIR, "asyncapi-websocket-peer-1.schema.json"),
  ],
  [
    "openbindings.asyncapi-kafka-peer@1",
    join(PEER_DIALECT_DIR, "asyncapi-kafka-peer-1.schema.json"),
  ],
  [
    "openbindings.asyncapi-mqtt-peer@1",
    join(PEER_DIALECT_DIR, "asyncapi-mqtt-peer-1.schema.json"),
  ],
]);
const NATIVE_DIALECT_SCHEMAS = new Map([
  [
    "openbindings.asyncapi-http-peer@1",
    HTTP_NATIVE_V1_SCHEMA,
  ],
  [
    "openbindings.asyncapi-http-peer@2",
    HTTP_NATIVE_V2_SCHEMA,
  ],
  [
    "openbindings.asyncapi-websocket-peer@1",
    join(PEER_DIALECT_DIR, "asyncapi-websocket-native-1.schema.json"),
  ],
  [
    "openbindings.asyncapi-kafka-peer@1",
    join(PEER_DIALECT_DIR, "asyncapi-kafka-native-1.schema.json"),
  ],
]);

function nativeDialectSchema(dialect, script) {
  if (dialect === "openbindings.asyncapi-mqtt-peer@1") {
    if (script?.protocolVersion === "3.1.1")
      return join(PEER_DIALECT_DIR, "asyncapi-mqtt311-native-1.schema.json");
    if (script?.protocolVersion === "5.0")
      return join(PEER_DIALECT_DIR, "asyncapi-mqtt5-native-1.schema.json");
    return undefined;
  }
  return NATIVE_DIALECT_SCHEMAS.get(dialect);
}

// Family directory → { exact identifier, rule prefix, spec path }.
const FAMILIES = {
  usage: {
    bindingSpec: "openbindings.usage@1",
    prefix: "USAGE",
    spec: join(SPEC_ROOT, "binding-specs", "usage", "openbindings.usage.md"),
  },
  "openapi-2.0": {
    bindingSpec: "openbindings.openapi-2.0@1",
    prefix: "OAPI20",
    spec: join(SPEC_ROOT, "binding-specs", "openapi-2.0", "openbindings.openapi-2.0.md"),
  },
  "openapi-3.0": {
    bindingSpec: "openbindings.openapi-3.0@1",
    prefix: "OAPI30",
    spec: join(SPEC_ROOT, "binding-specs", "openapi-3.0", "openbindings.openapi-3.0.md"),
  },
  "openapi-3.1": {
    bindingSpec: "openbindings.openapi-3.1@1",
    prefix: "OAPI31",
    spec: join(SPEC_ROOT, "binding-specs", "openapi-3.1", "openbindings.openapi-3.1.md"),
  },
  "openapi-3.2": {
    bindingSpec: "openbindings.openapi-3.2@1",
    prefix: "OAPI32",
    spec: join(SPEC_ROOT, "binding-specs", "openapi-3.2", "openbindings.openapi-3.2.md"),
  },
  mcp: {
    bindingSpec: "openbindings.mcp@1",
    prefix: "MCP",
    spec: join(SPEC_ROOT, "binding-specs", "mcp", "openbindings.mcp.md"),
  },
  grpc: {
    bindingSpec: "openbindings.grpc@1",
    prefix: "GRPC",
    spec: join(SPEC_ROOT, "binding-specs", "grpc", "openbindings.grpc.md"),
  },
  connect: {
    bindingSpec: "openbindings.connect@1",
    prefix: "CONN",
    spec: join(SPEC_ROOT, "binding-specs", "connect", "openbindings.connect.md"),
  },
  asyncapi: {
    bindingSpec: "openbindings.asyncapi@1",
    prefix: "ASYNC",
    spec: join(SPEC_ROOT, "binding-specs", "asyncapi", "openbindings.asyncapi.md"),
  },
  "asyncapi-3.1": {
    bindingSpec: "openbindings.asyncapi-3.1@1",
    prefix: "ASYNC31",
    spec: join(SPEC_ROOT, "binding-specs", "asyncapi-3.1", "openbindings.asyncapi-3.1.md"),
  },
  graphql: {
    bindingSpec: "openbindings.graphql@1",
    prefix: "GQL",
    spec: join(SPEC_ROOT, "binding-specs", "graphql", "openbindings.graphql.md"),
  },
};

const errors = [];
const runMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const tmp = runMain ? mkdtempSync(join(tmpdir(), "bs-verify-")) : undefined;
let counter = 0;

function ajvOk(schemaPath, dataObj) {
  const f = join(tmp, `d${counter++}.json`);
  writeFileSync(f, JSON.stringify(dataObj));
  const args = ["validate", "-s", schemaPath, "-d", f, "--spec=draft2020"];
  if (schemaPath === PROCESSOR_SCHEMA) args.push("-r", HTTP_RUNTIME_V2_SCHEMA);
  if (schemaPath === PROCESSOR_V7_PROBE_SCHEMA) args.push("-r", HTTP_PEER_V2_SCHEMA);
  const r = spawnSync(
    "ajv",
    args,
    { encoding: "utf8" }
  );
  if (r.error) {
    console.error(
      "Failed to run ajv. Install it with: npm i -g ajv-cli ajv-formats"
    );
    rmSync(tmp, { recursive: true, force: true });
    process.exit(2);
  }
  return { ok: r.status === 0, out: (r.stdout || "") + (r.stderr || "") };
}

function jsonPointerValue(document, pointer) {
  let value = document;
  for (const encoded of pointer.slice(1).split("/")) {
    const token = encoded.replace(/~1/g, "/").replace(/~0/g, "~");
    if (value === null || typeof value !== "object" || !Object.hasOwn(value, token))
      return { found: false };
    value = value[token];
  }
  return { found: true, value };
}

function hasUnpairedSurrogate(codeUnits) {
  for (let i = 0; i < codeUnits.length; i++) {
    const unit = codeUnits[i];
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = codeUnits[i + 1];
      if (next >= 0xdc00 && next <= 0xdfff) {
        i++;
        continue;
      }
      return true;
    }
    if (unit >= 0xdc00 && unit <= 0xdfff) return true;
  }
  return false;
}

function semanticAssertionFormatViolations(fixture, label) {
  if (
    fixture?.format === "openbindings.binding-spec-processor-scenarios@5"
    || fixture?.format === PROCESSOR_V6
    || fixture?.format === PROCESSOR_V7
  ) return [];
  if (!Array.isArray(fixture?.scenarios)) return [];
  const violations = [];
  for (const [scenarioIndex, scenario] of fixture.scenarios.entries()) {
    if (!Array.isArray(scenario?.expected)) continue;
    for (const [expectedIndex, expected] of scenario.expected.entries()) {
      if (!Array.isArray(expected?.assertions)) continue;
      for (const [assertionIndex, assertion] of expected.assertions.entries()) {
        if (assertion && typeof assertion === "object" && Object.hasOwn(assertion, "semanticEquals")) {
          violations.push(
          `${label}.scenarios[${scenarioIndex}].expected[${expectedIndex}].assertions[${assertionIndex}]: semanticEquals requires processor-scenario format @5, @6, or @7`
          );
        }
      }
    }
  }
  return violations;
}

const HTTP_V2_CONFIGURATION_NAMES = new Set([
  "serverVariables", "channelParameters", "http", "security", "tls",
]);
const HTTP_V2_NATIVE_NAMES = new Set(["connection-attempted", "request-started"]);

function newHttpSecurityConfiguration(value) {
  return value && typeof value === "object"
    && (Object.hasOwn(value, "server") || Object.hasOwn(value, "operation"));
}

function processorApparatusVersionViolations(fixture, label) {
  if (!Array.isArray(fixture?.scenarios)) return [];
  const violations = [];
  const revision7 = fixture.format === PROCESSOR_V7;
  if (revision7 && fixture.family !== "asyncapi-3.1")
    violations.push(`${label}: processor-scenario revision 7 is reserved to asyncapi-3.1`);
  if (!revision7 && fixture.family === "asyncapi-3.1")
    violations.push(`${label}: asyncapi-3.1 requires processor-scenario revision 7`);

  for (const [scenarioIndex, scenario] of fixture.scenarios.entries()) {
    const at = `${label}.scenarios[${scenarioIndex}]`;
    const peerDialect = scenario?.given?.peer?.dialect;
    const configuration = scenario?.given?.configuration;
    if (!revision7 && peerDialect === "openbindings.asyncapi-http-peer@2")
      violations.push(`${at}.given.peer.dialect: HTTP peer revision 2 requires processor-scenario revision 7`);

    if (!revision7 && configuration && typeof configuration === "object") {
      for (const key of Object.keys(configuration)) {
        const historicOpenApiSecurity = fixture.format === "openbindings.binding-spec-processor-scenarios@5"
          && key === "security"
          && !newHttpSecurityConfiguration(configuration.security);
        if (HTTP_V2_CONFIGURATION_NAMES.has(key) && !historicOpenApiSecurity)
          violations.push(`${at}.given.configuration.${key}: HTTP revision-2 configuration requires processor-scenario revision 7`);
      }
    }

    if (revision7) {
      if (peerDialect === "openbindings.asyncapi-http-peer@1")
        violations.push(`${at}.given.peer.dialect: AsyncAPI 3.1 HTTP cases under revision 7 require HTTP peer revision 2`);
      if (peerDialect === "openbindings.asyncapi-http-peer@2") {
        if (configuration !== undefined) {
          const runtimeShape = ajvOk(HTTP_RUNTIME_V2_SCHEMA, configuration);
          if (!runtimeShape.ok)
            violations.push(`${at}.given.configuration: HTTP peer revision 2 requires the closed HTTP runtime revision-2 shape\n${runtimeShape.out}`);
          else violations.push(...base64Violations(configuration, `${at}.given.configuration`));
        }
      } else if (configuration && typeof configuration === "object") {
        for (const key of Object.keys(configuration)) {
          if (HTTP_V2_CONFIGURATION_NAMES.has(key))
            violations.push(`${at}.given.configuration.${key}: HTTP revision-2 configuration requires HTTP peer revision 2`);
        }
      }
    }

    if (!revision7) {
      for (const [actionIndex, action] of (scenario?.given?.invocation?.actions || []).entries()) {
        if (action?.kind === "await-native" && HTTP_V2_NATIVE_NAMES.has(action.name))
          violations.push(`${at}.given.invocation.actions[${actionIndex}].name: '${action.name}' requires processor-scenario revision 7`);
      }
      for (const [expectedIndex, expected] of (scenario?.expected || []).entries()) {
        for (const [eventIndex, event] of (expected?.timeline || []).entries()) {
          if (event?.kind === "native" && HTTP_V2_NATIVE_NAMES.has(event.name))
            violations.push(`${at}.expected[${expectedIndex}].timeline[${eventIndex}].name: '${event.name}' requires processor-scenario revision 7`);
        }
      }
    }
  }
  return violations;
}

function synthesisApparatusVersionViolations(fixture, label) {
  const violations = [];
  if (fixture?.format === SYNTHESIS_V7 && fixture?.family !== "asyncapi-3.1")
    violations.push(`${label}: synthesis-scenario revision 7 is reserved to asyncapi-3.1`);
  if (fixture?.family === "asyncapi-3.1" && fixture?.format !== SYNTHESIS_V7)
    violations.push(`${label}: asyncapi-3.1 requires synthesis-scenario revision 7`);
  return violations;
}

function canonicalBase64(value) {
  if (typeof value !== "string") return false;
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
    return false;
  return Buffer.from(value, "base64").toString("base64") === value;
}

function base64Violations(value, at, out = []) {
  if (Array.isArray(value)) {
    value.forEach((member, index) => base64Violations(member, `${at}[${index}]`, out));
    return out;
  }
  if (!value || typeof value !== "object") return out;
  for (const [name, member] of Object.entries(value)) {
    const memberAt = `${at}.${name}`;
    if (typeof member === "string" && /(?:base64|Base64)$/.test(name)) {
      if (!canonicalBase64(member)) out.push(`${memberAt}: is not canonical Base64`);
      continue;
    }
    if (Array.isArray(member) && /(?:base64|Base64)$/.test(name)) {
      member.forEach((item, index) => {
        if (!canonicalBase64(item)) out.push(`${memberAt}[${index}]: is not canonical Base64`);
      });
      continue;
    }
    base64Violations(member, memberAt, out);
  }
  return out;
}

function resourceCarrierViolations(container, at) {
  const violations = [];
  const resources = container?.resources;
  const resourceBytes = container?.resourceBytes;
  if (resources && resourceBytes) {
    for (const uri of Object.keys(resources)) {
      if (Object.hasOwn(resourceBytes, uri))
        violations.push(`${at}: resource URI '${uri}' appears in both resources and resourceBytes`);
    }
  }
  for (const [uri, envelope] of Object.entries(resourceBytes || {})) {
    if (envelope?.format !== "openbindings.resource-bytes@1")
      violations.push(`${at}.resourceBytes.${uri}: byte resource must use openbindings.resource-bytes@1`);
    if (!canonicalBase64(envelope?.dataBase64))
      violations.push(`${at}.resourceBytes.${uri}.dataBase64: is not canonical Base64`);
  }
  return violations;
}


function losslessNodeContainsNumber(node) {
  if (!node) return false;
  if (node.kind === "number") return true;
  if (node.kind === "array") return node.members.some(losslessNodeContainsNumber);
  if (node.kind === "object") return [...node.members.values()].some(losslessNodeContainsNumber);
  return false;
}

function losslessFromJs(value) {
  const unsafe = (candidate) => {
    if (typeof candidate === "number")
      return !Number.isFinite(candidate) || (Number.isInteger(candidate) && !Number.isSafeInteger(candidate));
    if (Array.isArray(candidate)) return candidate.some(unsafe);
    if (candidate && typeof candidate === "object") return Object.values(candidate).some(unsafe);
    return false;
  };
  if (unsafe(value)) return { ok: false, error: "unsafe host number" };
  try {
    return parseLosslessJson(JSON.stringify(value));
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function containsJsonNumber(value) {
  if (typeof value === "number") return true;
  if (Array.isArray(value)) return value.some(containsJsonNumber);
  if (value && typeof value === "object") return Object.values(value).some(containsJsonNumber);
  return false;
}

function validKafkaOffset(value) {
  return typeof value === "string"
    && /^(?:0|[1-9][0-9]{0,18})$/.test(value)
    && BigInt(value) <= 9223372036854775807n;
}

function peerScriptEvents(dialect, script) {
  if (dialect === "openbindings.asyncapi-http-peer@1") return script ? [script] : [];
  return Array.isArray(script?.events) ? script.events : [];
}

function mappedPeerObservations(dialect, script) {
  return [
    ...implicitPeerNativeObservations(dialect, script),
    ...peerScriptEvents(dialect, script)
      .map((event) => peerEventNativeObservation(dialect, event, script))
      .filter((event) => event !== undefined),
  ];
}

function isPeerMappedNativeObservation(dialect, event) {
  if (event?.kind !== "native") return false;
  if (dialect === "openbindings.asyncapi-http-peer@1")
    return event.name === "acknowledgement"
      || (event.name === "connection-closed" && event.facts?.origin === "peer");
  if (dialect === "openbindings.asyncapi-websocket-peer@1")
    return ["connection-opened", "delivery"].includes(event.name)
      || (event.name === "connection-closed" && event.facts?.origin === "peer");
  if (dialect === "openbindings.asyncapi-kafka-peer@1")
    return ["acknowledgement", "delivery", "subscription-opened", "reconnected", "connection-closed"].includes(event.name);
  if (dialect === "openbindings.asyncapi-mqtt-peer@1")
    return ["connection-opened", "acknowledgement", "delivery", "reconnected"].includes(event.name)
      || (event.name === "connection-closed" && event.facts?.origin === "peer");
  return false;
}

function exactObservationListEqual(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((event, index) => jsonValueEqual(event, right[index]));
}

function jsonValueMutations(value) {
  const mutations = [];
  if (Array.isArray(value)) {
    if (value.length === 0) return [[null]];
    for (const [index, member] of value.entries()) {
      for (const changed of jsonValueMutations(member)) {
        const copy = structuredClone(value);
        copy[index] = changed;
        mutations.push(copy);
      }
      const removed = structuredClone(value);
      removed.splice(index, 1);
      mutations.push(removed);
    }
    return mutations;
  }
  if (value && typeof value === "object") {
    const withExtra = structuredClone(value);
    withExtra.__unexpected = true;
    mutations.push(withExtra);
    for (const [name, member] of Object.entries(value)) {
      const removed = structuredClone(value);
      delete removed[name];
      mutations.push(removed);
      for (const changed of jsonValueMutations(member)) {
        const copy = structuredClone(value);
        copy[name] = changed;
        mutations.push(copy);
      }
    }
    return mutations;
  }
  if (typeof value === "string") return [`${value}__changed`];
  if (typeof value === "number") return [value + 1];
  if (typeof value === "boolean") return [!value];
  return ["not-null"];
}

function peerMappingCoverageTokens(dialect, script) {
  const tokens = [];
  if (dialect === "openbindings.asyncapi-http-peer@1")
    tokens.push(`http:${script?.outcome}`);
  if (dialect === "openbindings.asyncapi-websocket-peer@1") {
    tokens.push(`websocket:handshake-${script?.handshake?.outcome}`);
    tokens.push(...(script?.events || []).map((event) => `websocket:${event.kind}`));
  }
  if (dialect === "openbindings.asyncapi-kafka-peer@1")
    tokens.push(...(script?.events || []).map((event) => `kafka:${event.kind}`));
  if (dialect === "openbindings.asyncapi-mqtt-peer@1") {
    const version = script?.protocolVersion;
    tokens.push(`mqtt-${version}:connection-${script?.connection?.accepted ? "accepted" : "rejected"}`);
    tokens.push(...(script?.events || []).map((event) => `mqtt-${version}:${event.kind}`));
  }
  return tokens;
}

function peerEventNativeObservation(dialect, event, script) {
  if (dialect === "openbindings.asyncapi-http-peer@1")
    return event?.outcome === "response"
      ? { kind: "native", name: "acknowledgement", facts: { status: event.status } }
      : { kind: "native", name: "connection-closed", facts: { origin: "peer" } };
  if (dialect === "openbindings.asyncapi-websocket-peer@1") {
    if (["text-message", "binary-message", "fragmented-message"].includes(event?.kind)) {
      let bytes;
      let opcode;
      let fragmentCount = 1;
      if (event.kind === "text-message") {
        bytes = Buffer.from(event.text, "utf8");
        opcode = "text";
      } else if (event.kind === "binary-message") {
        bytes = Buffer.from(event.base64, "base64");
        opcode = "binary";
      } else {
        bytes = Buffer.concat(event.fragmentsBase64.map((part) => Buffer.from(part, "base64")));
        opcode = event.opcode;
        fragmentCount = event.fragmentsBase64.length;
        if (opcode === "text") {
          try {
            new TextDecoder("utf-8", { fatal: true }).decode(bytes);
          } catch {
            return {
              kind: "native", name: "connection-closed",
              facts: { origin: "peer", clean: false, code: 1007, reason: "invalid-utf8-text" }
            };
          }
        }
      }
      return {
        kind: "native", name: "delivery",
        facts: { opcode, messageBase64: bytes.toString("base64"), fragmentCount }
      };
    }
    if (event?.kind === "invalid-frame")
      return {
        kind: "native", name: "connection-closed",
        facts: {
          origin: "peer", clean: false,
          code: event.violation === "invalid-utf8-text" ? 1007 : 1002,
          reason: event.violation,
        }
      };
    if (event?.kind === "close" && event.code === 1010)
      return {
        kind: "native", name: "connection-closed",
        facts: { origin: "peer", clean: false, code: 1002, reason: "peer-close-1010" }
      };
    if (event?.kind === "close")
      return {
        kind: "native", name: "connection-closed",
        facts: { origin: "peer", clean: true, code: event.code, reason: event.reason }
      };
    return {
      kind: "native", name: "connection-closed",
      facts: { origin: "peer", clean: false, code: null, reason: "" }
    };
  }
  if (dialect === "openbindings.asyncapi-kafka-peer@1") {
    if (event?.kind === "produce-ack") return {
      kind: "native", name: "acknowledgement",
      facts: {
        topic: event.topic, partition: event.partition, offset: event.offset,
        boundary: "broker-accepted"
      }
    };
    if (event?.kind === "record") return {
      kind: "native", name: "delivery",
      facts: {
        topic: event.topic, partition: event.partition, offset: event.offset,
        keyBase64: event.keyBase64 ?? null, valueBase64: event.valueBase64,
        headers: event.headers ?? [], redelivered: event.redelivered
      }
    };
    if (event?.kind === "reconnect")
      return { kind: "native", name: "reconnected", facts: { attempt: event.attempt } };
    if (event?.kind === "rebalance")
      return {
        kind: "native", name: "subscription-opened",
        facts: { topic: event.topic, partitions: event.partitions }
      };
    if (event?.kind === "disconnect")
      return { kind: "native", name: "connection-closed", facts: {} };
  }
  if (dialect === "openbindings.asyncapi-mqtt-peer@1") {
    if (["puback", "pubrec", "pubrel", "pubcomp", "suback", "unsuback"].includes(event?.kind)) {
      const facts = {
        packetType: event.kind.toUpperCase(), packetId: event.packetId
      };
      if (script?.protocolVersion === "3.1.1") facts.grantedQos = event.grantedQos ?? null;
      else {
        facts.reasonCode = event.reasonCode ?? 0;
        facts.properties = event.properties ?? [];
      }
      return { kind: "native", name: "acknowledgement", facts };
    }
    if (event?.kind === "publish") {
      const facts = {
        packetType: "PUBLISH", packetId: event.packetId ?? null, topic: event.topic,
        qos: event.qos, duplicate: event.duplicate, retain: event.retain,
        payloadBase64: event.payloadBase64
      };
      if (script?.protocolVersion === "5.0") facts.properties = event.properties ?? [];
      return { kind: "native", name: "delivery", facts };
    }
    if (event?.kind === "reconnect")
      return {
        kind: "native", name: "reconnected",
        facts: {
          attempt: event.attempt,
          sessionPresent: event.sessionPresent,
          ...(script?.protocolVersion === "5.0" ? { connect: event.connect, properties: event.properties } : {}),
        }
      };
    if (event?.kind === "disconnect") {
      const facts = {
          origin: "peer", packetType: "DISCONNECT",
          reasonCode: event.reasonCode ?? 0,
          properties: event.properties ?? [],
        };
      return { kind: "native", name: "connection-closed", facts };
    }
    if (event?.kind === "transport-loss")
      return {
        kind: "native", name: "connection-closed",
        facts: { origin: "peer", packetType: "TRANSPORT-LOSS" }
      };
  }
  return undefined;
}

function nativeCount(expected, name) {
  return (expected?.timeline || []).filter(
    (event) => event?.kind === "native" && event.name === name
  ).length;
}

function nthTimelinePosition(expected, predicate, count) {
  let seen = 0;
  for (const [index, event] of (expected?.timeline || []).entries()) {
    if (!predicate(event)) continue;
    seen++;
    if (seen === count) return index;
  }
  return -1;
}

function actionCompletionPosition(actions, actionIndex, expected) {
  const action = actions[actionIndex];
  if (!action) return -1;
  if (action.kind === "write") {
    const writeOrdinal = actions.slice(0, actionIndex + 1).filter((item) => item?.kind === "write").length;
    return nthTimelinePosition(expected, (event) => event?.kind === "input-accepted", writeOrdinal);
  }
  if (action.kind === "await-output")
    return nthTimelinePosition(expected, (event) => event?.kind === "output", action.count);
  if (action.kind === "await-native")
    return nthTimelinePosition(
      expected,
      (event) => event?.kind === "native" && event.name === action.name,
      action.count
    );
  if (action.kind === "half-close")
    return nthTimelinePosition(
      expected,
      (event) => event?.kind === "native" && event.name === "input-half-closed",
      1
    );
  if (action.kind === "cancel")
    return nthTimelinePosition(
      expected,
      (event) => event?.kind === "native" && event.name === "cancellation-propagated",
      1
    );
  return -1;
}

function deriveActionCompletionPositions(actions, expected, at, expectedIndex, violations) {
  const positions = [];
  let prior = -1;
  for (const [actionIndex, action] of actions.entries()) {
    const raw = actionCompletionPosition(actions, actionIndex, expected);
    if (raw < 0) {
      violations.push(`${at}.given.invocation.actions[${actionIndex}]: action has no completion boundary in expected alternative ${expectedIndex}`);
      positions.push(-1);
      continue;
    }
    if (["await-output", "await-native"].includes(action?.kind)) {
      const position = Math.max(prior, raw);
      positions.push(position);
      prior = position;
      continue;
    }
    if (raw <= prior)
      violations.push(`${at}.given.invocation.actions[${actionIndex}]: action completes before the preceding caller action in expected alternative ${expectedIndex}`);
    positions.push(raw);
    prior = Math.max(prior, raw);
  }
  return positions;
}

function implicitPeerNativeObservations(dialect, script) {
  if (dialect === "openbindings.asyncapi-websocket-peer@1") {
    if (script?.handshake?.outcome === "accepted") return [{
        kind: "native", name: "connection-opened",
        facts: {
          status: script.handshake.status,
          upgrade: script.handshake.upgrade,
          connectionTokens: script.handshake.connectionTokens,
          secWebSocketAccept: script.handshake.secWebSocketAccept,
          subprotocol: script.handshake.subprotocol,
          extensions: script.handshake.extensions,
        }
      }];
    return [{
        kind: "native", name: "connection-closed",
        facts: {
          origin: "peer", clean: false, code: null,
          reason: script?.handshake?.outcome === "protocol-error"
            ? `handshake-protocol-error:${script.handshake.error}`
            : "handshake-rejected"
        }
      }];
  }
  if (dialect === "openbindings.asyncapi-mqtt-peer@1") {
    const accepted = script?.connection?.accepted;
    let facts;
    if (script?.protocolVersion === "3.1.1") {
      facts = accepted
        ? { sessionPresent: script.connection.sessionPresent }
        : { origin: "peer", packetType: "CONNACK", returnCode: script.connection.returnCode, sessionPresent: false };
    } else {
      facts = accepted
        ? {
          reasonCode: script.connection.reasonCode,
          sessionPresent: script.connection.sessionPresent,
          properties: script.connection.properties,
        }
        : {
          origin: "peer",
          packetType: "CONNACK",
          reasonCode: script?.connection?.reasonCode,
          sessionPresent: false,
          properties: script?.connection?.properties,
        };
    }
    return [{
      kind: "native",
      name: accepted ? "connection-opened" : "connection-closed",
      facts,
    }];
  }
  return [];
}

function peerConnectionAttempted(dialect, expected) {
  if (dialect === "openbindings.asyncapi-websocket-peer@1")
    return (expected?.timeline || []).some((event) =>
      event?.kind === "native"
      && event.name === "dispatch"
      && event.facts?.frameType === "opening-request"
    );
  if (dialect === "openbindings.asyncapi-mqtt-peer@1")
    return (expected?.timeline || []).some((event) =>
      event?.kind === "native"
      && event.name === "dispatch"
      && event.facts?.packetType === "CONNECT"
    );
  return true;
}

function peerConnectionImplicitMappings(dialect, expected, script) {
  if (!peerConnectionAttempted(dialect, expected)) return [];
  const implicit = implicitPeerNativeObservations(dialect, script);
  const timeline = expected?.timeline || [];
  const boundaryPresent = implicit.every((mapped) => timeline.some((event) =>
    event?.kind === "native" && event.name === mapped.name
  ));
  if (boundaryPresent) return implicit;
  const dispatchIndex = timeline.findIndex((event) =>
    event?.kind === "native"
    && event.name === "dispatch"
    && (
      (dialect === "openbindings.asyncapi-websocket-peer@1" && event.facts?.frameType === "opening-request")
      || (dialect === "openbindings.asyncapi-mqtt-peer@1" && event.facts?.packetType === "CONNECT")
    )
  );
  const cancellationIndex = timeline.findIndex((event) =>
    event?.kind === "native" && event.name === "cancellation-propagated"
  );
  const localCloseIndex = timeline.findIndex((event) =>
    event?.kind === "native"
    && event.name === "connection-closed"
    && event.facts?.origin === "local"
  );
  return cancellationIndex > dispatchIndex || localCloseIndex > dispatchIndex ? [] : implicit;
}

function websocketHandshakeTimelineViolations(expected, script, at, configuration = {}) {
  const violations = [];
  const timeline = expected?.timeline || [];
  const openings = timeline
    .map((event, index) => ({ event, index }))
    .filter(({ event }) =>
      event?.kind === "native"
      && event.name === "dispatch"
      && event.facts?.frameType === "opening-request"
    );
  if (openings.length > 1)
    violations.push(`${at}: WebSocket timeline contains more than one opening-request dispatch`);
  if (openings.length === 0) {
    for (const [index, event] of timeline.entries()) {
      if (
        event?.kind === "output"
        || (event?.kind === "native" && (
          event.name === "delivery"
          || (event.name === "dispatch" && ["text", "binary"].includes(event.facts?.opcode))
        ))
      ) violations.push(`${at}.timeline[${index}]: WebSocket data/output exists without an opening request`);
    }
    return violations;
  }
  const opening = openings[0];
  const ordinaryHeaders = configuration?.websocketHeaders ?? [];
  if (!Array.isArray(ordinaryHeaders)) {
    violations.push(`${at}: configuration.websocketHeaders must be an ordered array`);
  } else {
    const reserved = new Set([
      "host", "connection", "upgrade", "sec-websocket-key", "sec-websocket-version",
      "sec-websocket-protocol", "sec-websocket-extensions", "authorization",
    ]);
    for (const [headerIndex, header] of ordinaryHeaders.entries()) {
      if (!HTTP_TOKEN_PATTERN.test(header?.name || "") || reserved.has(header?.name?.toLowerCase()))
        violations.push(`${at}.configuration.websocketHeaders[${headerIndex}].name: ordinary header name is unsafe or reserved`);
      if (!/^[0-9a-f]{64}$/u.test(header?.valueSha256 || ""))
        violations.push(`${at}.configuration.websocketHeaders[${headerIndex}].valueSha256: ordinary header value digest must be lowercase SHA-256`);
    }
    if (!jsonValueEqual(opening.event.facts.headers, ordinaryHeaders))
      violations.push(`${at}.timeline[${opening.index}].facts.headers: ordinary WebSocket headers do not exactly preserve the configured ordered name/digest evidence`);
  }
  const headerValueSafe = (value) => typeof value === "string" && !/[\u0000-\u001F\u007F]/u.test(value);
  const fieldNameSafe = (value) => typeof value === "string"
    && /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u.test(value);
  if (!headerValueSafe(opening.event.facts.host))
    violations.push(`${at}.timeline[${opening.index}].facts.host: Host must not contain HTTP control characters`);
  for (const [field, values] of [
    ["subprotocols", opening.event.facts.subprotocols],
    ["extensions", opening.event.facts.extensions],
  ]) {
    for (const [valueIndex, value] of (values || []).entries()) {
      if (!headerValueSafe(value))
        violations.push(`${at}.timeline[${opening.index}].facts.${field}[${valueIndex}]: handshake header value contains an HTTP control character`);
    }
  }
  for (const [headerIndex, header] of (opening.event.facts.apiKeyHeaders || []).entries()) {
    if (!fieldNameSafe(header?.name))
      violations.push(`${at}.timeline[${opening.index}].facts.apiKeyHeaders[${headerIndex}].name: API-key header name must be an HTTP field-name token`);
  }
  const key = opening.event.facts.secWebSocketKey;
  if (!canonicalBase64(key) || Buffer.from(key, "base64").length !== 16)
    violations.push(`${at}.timeline[${opening.index}].facts.secWebSocketKey: opening key must be canonical Base64 for exactly 16 octets`);
  if (script?.handshake?.status === 101 && canonicalBase64(key)) {
    const derived = createHash("sha1")
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`, "ascii")
      .digest("base64");
    if (script.handshake.outcome === "accepted" && script.handshake.secWebSocketAccept !== derived)
      violations.push(`${at}: Sec-WebSocket-Accept does not derive from the dispatched Sec-WebSocket-Key`);
    if (script.handshake.outcome === "protocol-error") {
      const wrongAccept = script.handshake.secWebSocketAccept !== derived;
      const selectedSubprotocol = typeof script.handshake.subprotocol === "string";
      const selectedExtension = script.handshake.extensions.length > 0;
      const validUpgrade = script.handshake.upgrade?.toLowerCase() === "websocket";
      const hasConnectionUpgrade = script.handshake.connectionTokens.some((token) => token.toLowerCase() === "upgrade");
      const consistent = (
        (script.handshake.error === "wrong-accept" && wrongAccept && validUpgrade && hasConnectionUpgrade && !selectedSubprotocol && !selectedExtension)
        || (script.handshake.error === "unauthorized-subprotocol" && !wrongAccept && validUpgrade && hasConnectionUpgrade && selectedSubprotocol && !selectedExtension)
        || (script.handshake.error === "unauthorized-extension" && !wrongAccept && validUpgrade && hasConnectionUpgrade && !selectedSubprotocol && selectedExtension)
        || (script.handshake.error === "missing-upgrade" && !wrongAccept && script.handshake.upgrade === null && hasConnectionUpgrade && !selectedSubprotocol && !selectedExtension)
        || (script.handshake.error === "wrong-upgrade" && !wrongAccept && typeof script.handshake.upgrade === "string" && !validUpgrade && hasConnectionUpgrade && !selectedSubprotocol && !selectedExtension)
        || (script.handshake.error === "missing-connection" && !wrongAccept && validUpgrade && script.handshake.connectionTokens.length === 0 && !selectedSubprotocol && !selectedExtension)
        || (script.handshake.error === "wrong-connection" && !wrongAccept && validUpgrade && script.handshake.connectionTokens.length > 0 && !hasConnectionUpgrade && !selectedSubprotocol && !selectedExtension)
      );
      if (!consistent)
        violations.push(`${at}: hostile 101 response does not match its declared protocol-error evidence`);
    }
  }
  const boundaryName = script?.handshake?.outcome === "accepted"
    ? "connection-opened"
    : "connection-closed";
  const boundary = timeline.findIndex((event) => event?.kind === "native" && event.name === boundaryName);
  const cancellation = timeline.findIndex((event) => event?.kind === "native" && event.name === "cancellation-propagated");
  if (boundary < 0 && cancellation > opening.index) {
    // Cancellation won the race after the request was dispatched but before a response.
  } else if (boundary <= opening.index)
    violations.push(`${at}: WebSocket handshake result does not follow its opening-request dispatch`);
  for (const [index, event] of timeline.entries()) {
    if (
      event?.kind === "native"
      && event.name === "connection-closed"
      && event.facts?.origin === "local"
    ) {
      const closeDispatch = timeline.findIndex((candidate, candidateIndex) =>
        candidateIndex < index
        && candidate?.kind === "native"
        && candidate.name === "dispatch"
        && candidate.facts?.frameType === "close"
      );
      if (event.facts.clean && closeDispatch < 0)
        violations.push(`${at}.timeline[${index}]: local WebSocket closure has no preceding client Close dispatch`);
      if (event.facts.clean && closeDispatch >= 0) {
        const dispatched = timeline[closeDispatch].facts;
        if (event.facts.code !== dispatched.code || event.facts.reason !== dispatched.reason)
          violations.push(`${at}.timeline[${index}]: local WebSocket closure does not preserve the dispatched Close code/reason`);
      }
    }
  }
  for (const [index, event] of timeline.entries()) {
    if (event?.kind === "native" && event.name === "dispatch" && event.facts?.frameType === "close")
      violations.push(...websocketCloseWireViolations(event.facts, `${at}.timeline[${index}].facts`));
  }
  let state = "initial";
  let peerCloseSuffix;
  for (const [index, event] of timeline.entries()) {
    if (event?.kind === "output") {
      if (state !== "open")
        violations.push(`${at}.timeline[${index}]: WebSocket output is forbidden in ${state} state`);
      continue;
    }
    if (event?.kind !== "native") continue;
    if (state === "closed") {
      if (
        peerCloseSuffix
        && event.name === "dispatch"
        && event.facts?.frameType === "close"
        && event.facts.code === peerCloseSuffix.code
        && event.facts.reason === peerCloseSuffix.reason
      ) {
        peerCloseSuffix = undefined;
        continue;
      }
      violations.push(`${at}.timeline[${index}]: native WebSocket activity follows terminal closed state`);
      continue;
    }
    if (state === "closing" && event.name !== "connection-closed") {
      violations.push(`${at}.timeline[${index}]: native WebSocket activity is forbidden while awaiting Close completion`);
      continue;
    }
    if (event.name === "dispatch" && event.facts?.frameType === "opening-request") {
      if (state !== "initial")
        violations.push(`${at}.timeline[${index}]: WebSocket opening-request follows ${state} state`);
      state = "opening";
    } else if (event.name === "connection-opened") {
      if (state !== "opening")
        violations.push(`${at}.timeline[${index}]: WebSocket connection-opened does not follow opening state`);
      state = "open";
    } else if (event.name === "delivery") {
      if (state !== "open")
        violations.push(`${at}.timeline[${index}]: WebSocket delivery is forbidden in ${state} state`);
    } else if (
      event.name === "dispatch"
      && ["text", "binary"].includes(event.facts?.opcode)
    ) {
      if (state !== "open")
        violations.push(`${at}.timeline[${index}]: WebSocket data dispatch is forbidden in ${state} state`);
      if (event.facts.opcode === "text") {
        try {
          new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(event.facts.messageBase64, "base64"));
        } catch {
          violations.push(`${at}.timeline[${index}].facts.messageBase64: outbound WebSocket text is not fatal UTF-8`);
        }
      }
    } else if (event.name === "dispatch" && event.facts?.frameType === "close") {
      if (state !== "open")
        violations.push(`${at}.timeline[${index}]: client WebSocket Close dispatch requires open state`);
      state = "closing";
    } else if (event.name === "connection-closed") {
      if (event.facts?.origin === "peer" && event.facts?.clean)
        peerCloseSuffix = { code: event.facts.code, reason: event.facts.reason };
      state = "closed";
    }
  }
  return violations;
}

function mqttConnectionTimelineViolations(expected, script, runtime, at) {
  const violations = [];
  const timeline = expected?.timeline || [];
  const connects = timeline
    .map((event, index) => ({ event, index }))
    .filter(({ event }) =>
      event?.kind === "native"
      && event.name === "dispatch"
      && event.facts?.packetType === "CONNECT"
    );
  if (connects.length > 1)
    violations.push(`${at}: MQTT timeline contains more than one CONNECT dispatch`);
  if (connects.length === 0) {
    for (const [index, event] of timeline.entries()) {
      const preInteractionOnly = event?.kind === "native"
        && ["cancellation-propagated", "input-half-closed"].includes(event.name);
      if (!preInteractionOnly)
        violations.push(`${at}.timeline[${index}]: MQTT activity requires client CONNECT followed by accepted CONNACK`);
    }
    return violations;
  }
  const connect = connects[0];
  const connectFacts = connect.event.facts;
  const usernameDigest = runtime?.mqttUsernameUtf8Sha256;
  const passwordDigest = runtime?.mqttPasswordBinarySha256;
  if (connectFacts.usernamePresent) {
    if (!usernameDigest || connectFacts.usernameSha256 !== usernameDigest)
      violations.push(`${at}.timeline[${connect.index}]: CONNECT username digest does not prove the exact configured UTF-8 username bytes`);
  } else if ((connectFacts.usernameSha256 !== undefined && connectFacts.usernameSha256 !== null) || usernameDigest !== undefined) {
    violations.push(`${at}.timeline[${connect.index}]: CONNECT claims no username but carries/configures username digest evidence`);
  }
  if (connectFacts.passwordPresent) {
    if (!passwordDigest || connectFacts.passwordSha256 !== passwordDigest)
      violations.push(`${at}.timeline[${connect.index}]: CONNECT password digest does not prove the exact configured binary password bytes`);
    if (!connectFacts.usernamePresent)
      violations.push(`${at}.timeline[${connect.index}]: MQTT password cannot be present without a username`);
  } else if ((connectFacts.passwordSha256 !== undefined && connectFacts.passwordSha256 !== null) || passwordDigest !== undefined) {
    violations.push(`${at}.timeline[${connect.index}]: CONNECT claims no password but carries/configures password digest evidence`);
  }
  const boundaryName = script?.connection?.accepted ? "connection-opened" : "connection-closed";
  const boundary = timeline.findIndex((event) => event?.kind === "native" && event.name === boundaryName);
  const cancellation = timeline.findIndex((event) => event?.kind === "native" && event.name === "cancellation-propagated");
  const localPreBoundaryClose = timeline.findIndex((event, index) =>
    index > connect.index
    && event?.kind === "native"
    && event.name === "connection-closed"
    && event.facts?.origin === "local"
    && (boundary < 0 || index < boundary)
  );
  if (boundary < 0 && (cancellation > connects[0].index || localPreBoundaryClose > connects[0].index)) {
    // Cancellation won the race after CONNECT but before CONNACK.
  } else if (boundary <= connects[0].index)
    violations.push(`${at}: MQTT CONNACK result does not follow its CONNECT dispatch`);
  const opened = timeline.findIndex((event) => event?.kind === "native" && event.name === "connection-opened");
  let effectiveClientId = connectFacts.clientId;
  let effectiveSessionExpiry = 0;
  if (opened >= 0) {
    const openedFacts = timeline[opened].facts;
    const clean = script?.protocolVersion === "3.1.1" ? connectFacts.cleanSession : connectFacts.cleanStart;
    if (openedFacts.sessionPresent && (clean || connectFacts.clientId === ""))
      violations.push(`${at}.timeline[${opened}]: resumed session requires a nonempty Client ID and clean flag false`);
    if (clean && openedFacts.sessionPresent)
      violations.push(`${at}.timeline[${opened}]: clean connection cannot resume a prior session`);
    if (script?.protocolVersion === "5.0" && connectFacts.clientId === "") {
      const assigned = (openedFacts.properties || []).filter((property) => property.name === "assigned-client-identifier");
      if (!connectFacts.cleanStart || assigned.length !== 1)
        violations.push(`${at}.timeline[${opened}]: empty MQTT 5 Client ID requires cleanStart and exactly one assigned-client-identifier CONNACK property`);
    } else if (script?.protocolVersion === "5.0") {
      const assigned = (openedFacts.properties || []).filter((property) => property.name === "assigned-client-identifier");
      if (assigned.length)
        violations.push(`${at}.timeline[${opened}]: assigned-client-identifier is forbidden when CONNECT supplied a nonempty Client ID`);
    }
    if (script?.protocolVersion === "5.0") {
      const connectProperties = connectFacts.properties || [];
      const connackProperties = openedFacts.properties || [];
      effectiveClientId = connectFacts.clientId || connackProperties
        .find((property) => property.name === "assigned-client-identifier")?.value;
      effectiveSessionExpiry = connackProperties
        .find((property) => property.name === "session-expiry-interval")?.value
        ?? connectProperties.find((property) => property.name === "session-expiry-interval")?.value
        ?? 0;
      const connectAuth = connectProperties.find((property) => property.name === "authentication-method")?.value;
      const connackAuth = connackProperties.find((property) => property.name === "authentication-method")?.value;
      if (connackAuth !== connectAuth)
        violations.push(`${at}.timeline[${opened}]: CONNACK authentication-method requires the identical CONNECT authentication-method`);
      const requestedResponseInformation = connectProperties.some((property) =>
        property.name === "request-response-information" && property.value === 1
      );
      if (
        connackProperties.some((property) => property.name === "response-information")
        && !requestedResponseInformation
      ) violations.push(`${at}.timeline[${opened}]: CONNACK Response Information requires CONNECT Request Response Information=1`);
    }
  }
  let reconnectAttempt = 0;
  let currentConnectSessionExpiry = script?.protocolVersion === "5.0"
    ? (connectFacts.properties || []).find((property) => property.name === "session-expiry-interval")?.value ?? 0
    : 0;
  for (const [index, event] of timeline.entries()) {
    if (event?.kind === "native" && event.name === "reconnected") {
      if (event.facts?.attempt <= reconnectAttempt)
        violations.push(`${at}.timeline[${index}].facts.attempt: reconnect attempts must increase strictly within one operation lifecycle`);
      reconnectAttempt = event.facts?.attempt;
      if (script?.protocolVersion === "5.0") {
        const reconnectConnect = event.facts?.connect || {};
        const reconnectConnectProperties = reconnectConnect.properties || [];
        const reconnectConnackProperties = event.facts?.properties || [];
        const assigned = reconnectConnackProperties.filter((property) => property.name === "assigned-client-identifier");
        if (event.facts?.sessionPresent) {
          if (reconnectConnect.cleanStart || reconnectConnect.clientId === "")
            violations.push(`${at}.timeline[${index}]: resumed reconnect requires nonempty Client ID and cleanStart false`);
          if (effectiveClientId && reconnectConnect.clientId !== effectiveClientId)
            violations.push(`${at}.timeline[${index}]: resumed reconnect Client ID does not identify the prior session`);
          if (effectiveSessionExpiry === 0)
            violations.push(`${at}.timeline[${index}]: resumed reconnect has no coherent prior nonzero session lifetime`);
        }
        if (reconnectConnect.clientId === "") {
          if (!reconnectConnect.cleanStart || assigned.length !== 1)
            violations.push(`${at}.timeline[${index}]: empty reconnect Client ID requires cleanStart and exactly one assigned-client-identifier`);
        } else if (assigned.length) {
          violations.push(`${at}.timeline[${index}]: reconnect assigned-client-identifier is forbidden for a nonempty Client ID`);
        }
        const connectAuth = reconnectConnectProperties
          .find((property) => property.name === "authentication-method")?.value;
        const connackAuth = reconnectConnackProperties
          .find((property) => property.name === "authentication-method")?.value;
        if (connackAuth !== connectAuth)
          violations.push(`${at}.timeline[${index}]: reconnect CONNACK authentication-method requires the identical CONNECT method`);
        const requestedResponseInformation = reconnectConnectProperties.some((property) =>
          property.name === "request-response-information" && property.value === 1
        );
        if (
          reconnectConnackProperties.some((property) => property.name === "response-information")
          && !requestedResponseInformation
        ) violations.push(`${at}.timeline[${index}]: reconnect Response Information requires CONNECT request-response-information=1`);
        if (reconnectConnect.usernamePresent) {
          if (!usernameDigest || reconnectConnect.usernameSha256 !== usernameDigest)
            violations.push(`${at}.timeline[${index}]: reconnect CONNECT username digest does not prove configured credentials`);
        } else if ((reconnectConnect.usernameSha256 !== undefined && reconnectConnect.usernameSha256 !== null) || usernameDigest !== undefined) {
          violations.push(`${at}.timeline[${index}]: reconnect CONNECT username presence/digest evidence is inconsistent`);
        }
        if (reconnectConnect.passwordPresent) {
          if (!passwordDigest || reconnectConnect.passwordSha256 !== passwordDigest)
            violations.push(`${at}.timeline[${index}]: reconnect CONNECT password digest does not prove configured credentials`);
          if (!reconnectConnect.usernamePresent)
            violations.push(`${at}.timeline[${index}]: reconnect CONNECT password requires username`);
        } else if ((reconnectConnect.passwordSha256 !== undefined && reconnectConnect.passwordSha256 !== null) || passwordDigest !== undefined) {
          violations.push(`${at}.timeline[${index}]: reconnect CONNECT password presence/digest evidence is inconsistent`);
        }
        effectiveClientId = reconnectConnect.clientId || assigned[0]?.value;
        effectiveSessionExpiry = reconnectConnackProperties
          .find((property) => property.name === "session-expiry-interval")?.value
          ?? reconnectConnectProperties.find((property) => property.name === "session-expiry-interval")?.value
          ?? 0;
        currentConnectSessionExpiry = reconnectConnectProperties
          .find((property) => property.name === "session-expiry-interval")?.value ?? 0;
      }
    }
    if (
      script?.connection?.accepted === false
      && event?.kind === "native"
      && ["delivery", "connection-opened", "reconnected", "subscription-opened"].includes(event.name)
    ) violations.push(`${at}.timeline[${index}]: MQTT activity follows rejected CONNACK terminal state`);
    if (
      event?.kind === "native"
      && event.name === "connection-closed"
      && event.facts?.origin === "local"
    ) {
      const disconnectDispatch = timeline.findIndex((candidate, candidateIndex) =>
        candidateIndex < index
        && candidate?.kind === "native"
        && candidate.name === "dispatch"
        && candidate.facts?.packetType === "DISCONNECT"
      );
      if (opened >= 0 && opened < index) {
        if (event.facts.cause !== "client-disconnect" || disconnectDispatch <= opened)
          violations.push(`${at}.timeline[${index}]: local MQTT closure after connection-opened requires a later client DISCONNECT dispatch and client-disconnect cause`);
      } else {
        if (disconnectDispatch >= 0)
          violations.push(`${at}.timeline[${index}]: client DISCONNECT cannot be sent while awaiting CONNACK`);
        if (event.facts.cause === "client-disconnect")
          violations.push(`${at}.timeline[${index}]: awaiting-CONNACK local closure must be cancellation or transport loss`);
        if (event.facts.cause === "cancellation") {
          const cancelBefore = timeline.findIndex((candidate, candidateIndex) =>
            candidateIndex < index && candidate?.kind === "native" && candidate.name === "cancellation-propagated"
          );
          if (cancelBefore < 0)
            violations.push(`${at}.timeline[${index}]: cancellation closure lacks a preceding cancellation-propagated boundary`);
        }
      }
    }
    if (
      event?.kind === "native" && event.name === "dispatch"
      && event.facts?.packetType === "DISCONNECT"
      && (opened < 0 || index <= opened)
    ) violations.push(`${at}.timeline[${index}]: client DISCONNECT precedes connection-opened`);
    if (
      script?.protocolVersion === "5.0"
      && event?.kind === "native"
      && event.name === "dispatch"
      && event.facts?.packetType === "DISCONNECT"
    ) {
      const disconnectExpiry = (event.facts.properties || []).find((property) => property.name === "session-expiry-interval")?.value;
      if (currentConnectSessionExpiry === 0 && disconnectExpiry > 0)
        violations.push(`${at}.timeline[${index}]: DISCONNECT cannot move CONNECT Session Expiry Interval from zero to nonzero`);
    }
  }
  let connectionState = "initial";
  for (const [index, event] of timeline.entries()) {
    if (event?.kind === "output") {
      if (connectionState !== "connected")
        violations.push(`${at}.timeline[${index}]: MQTT output requires an accepted CONNACK and connected state (was ${connectionState})`);
      continue;
    }
    if (event?.kind !== "native") continue;
    const packetType = event.facts?.packetType;
    if (connectionState === "terminal") {
      violations.push(`${at}.timeline[${index}]: native MQTT activity follows terminal connection state`);
      continue;
    }
    if (event.name === "dispatch" && packetType === "CONNECT") {
      connectionState = "connecting";
    } else if (event.name === "connection-opened") {
      if (connectionState !== "connecting")
        violations.push(`${at}.timeline[${index}]: MQTT connection-opened requires connecting state`);
      connectionState = "connected";
    } else if (event.name === "connection-closed") {
      if (packetType === "CONNACK" || event.facts?.origin === "local") connectionState = "terminal";
      else connectionState = "disconnected";
    } else if (event.name === "reconnected") {
      if (connectionState !== "disconnected")
        violations.push(`${at}.timeline[${index}]: MQTT reconnect requires disconnected state`);
      connectionState = "connected";
    } else if (event.name === "dispatch" && packetType === "DISCONNECT") {
      if (connectionState !== "connected")
        violations.push(`${at}.timeline[${index}]: client DISCONNECT requires connected state`);
      connectionState = "closing";
    } else if (
      ["dispatch", "acknowledgement", "delivery", "subscription-opened", "subscription-closed"].includes(event.name)
      && connectionState !== "connected"
    ) violations.push(`${at}.timeline[${index}]: MQTT packet/subscription activity requires connected state`);
  }
  return violations;
}

function stringHasUnpairedSurrogate(value) {
  if (typeof value !== "string") return false;
  const units = [];
  for (let index = 0; index < value.length; index++) units.push(value.charCodeAt(index));
  return hasUnpairedSurrogate(units);
}

const RFC6455_WIRE_CLOSE_CODES = new Set([
  1000, 1001, 1002, 1003, 1007, 1008, 1009, 1010, 1011,
]);

const HTTP_TOKEN_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u;

function websocketExtensionValueValid(value) {
  if (typeof value !== "string" || /[\u0000-\u001F\u007F]/u.test(value)) return false;
  const segments = value.split(";");
  if (!HTTP_TOKEN_PATTERN.test(segments.shift()?.trim() || "")) return false;
  return segments.every((segment) => {
    const [name, ...rest] = segment.trim().split("=");
    if (!HTTP_TOKEN_PATTERN.test(name || "") || rest.length > 1) return false;
    if (rest.length === 0) return true;
    const parameter = rest[0].trim();
    return HTTP_TOKEN_PATTERN.test(parameter)
      || (/^"[^"\u0000-\u001F\u007F]*"$/u.test(parameter));
  });
}

function websocketCloseWireViolations(event, at) {
  const violations = [];
  if (!RFC6455_WIRE_CLOSE_CODES.has(event?.code) && !(event?.code >= 3000 && event?.code <= 4999))
    violations.push(`${at}.code: ${event?.code} is not a status code an RFC 6455 Close frame may carry`);
  if (stringHasUnpairedSurrogate(event?.reason))
    violations.push(`${at}.reason: WebSocket Close reason must be a Unicode scalar-value sequence`);
  if (typeof event?.reason === "string" && Buffer.byteLength(event.reason, "utf8") > 123)
    violations.push(`${at}.reason: WebSocket Close reason exceeds the 123-octet control-frame limit`);
  return violations;
}

function websocketInvalidFrameViolations(event, at) {
  const bytes = canonicalBase64(event?.payloadBase64)
    ? Buffer.from(event.payloadBase64, "base64")
    : undefined;
  let invalidUtf8 = false;
  if (bytes) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      invalidUtf8 = true;
    }
  }
  const consistent = (
    (event?.violation === "invalid-utf8-text"
      && event.fin === true && event.opcode === "text" && event.masked === false && invalidUtf8)
    || (event?.violation === "unexpected-continuation"
      && event.opcode === "continuation" && event.masked === false)
    || (event?.violation === "fragmented-control"
      && ["close", "ping", "pong"].includes(event.opcode)
      && event.fin === false && event.masked === false && (bytes?.length ?? 126) <= 125)
    || (event?.violation === "masked-server-frame" && event.masked === true)
  );
  return consistent
    ? []
    : [`${at}: declared WebSocket protocol violation is not proved by the supplied frame structure and bytes`];
}

function mqttUtf8StringViolations(value, at) {
  const violations = [];
  if (typeof value !== "string") return violations;
  if (stringHasUnpairedSurrogate(value))
    violations.push(`${at}: MQTT UTF-8 field must be a Unicode scalar-value sequence`);
  if (Buffer.byteLength(value, "utf8") > 65535)
    violations.push(`${at}: MQTT UTF-8 field exceeds the 65535-octet encoded limit`);
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === 0) {
      violations.push(`${at}: MQTT UTF-8 field contains forbidden U+0000`);
      break;
    }
    if (
      (codePoint >= 0x0001 && codePoint <= 0x001f)
      || (codePoint >= 0x007f && codePoint <= 0x009f)
    ) {
      violations.push(`${at}: deterministic MQTT profile rejects control character U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`);
      break;
    }
    if (
      (codePoint >= 0xfdd0 && codePoint <= 0xfdef)
      || (codePoint & 0xffff) === 0xfffe
      || (codePoint & 0xffff) === 0xffff
    ) {
      violations.push(`${at}: deterministic MQTT profile rejects Unicode noncharacter U+${codePoint.toString(16).toUpperCase()}`);
      break;
    }
  }
  return violations;
}

function mqttPropertyBinaryViolations(properties, at) {
  const violations = [];
  for (const [index, property] of (properties || []).entries()) {
    if (
      Object.hasOwn(property || {}, "valueBase64")
      && canonicalBase64(property.valueBase64)
      && Buffer.from(property.valueBase64, "base64").length > 65535
    ) violations.push(`${at}[${index}].valueBase64: MQTT Binary Data exceeds the 65535-octet decoded limit`);
  }
  return violations;
}

function mqttUtf8StringValid(value) {
  return typeof value === "string" && mqttUtf8StringViolations(value, "MQTT string").length === 0;
}

function mqttTopicFilterSyntaxValid(filter) {
  if (!mqttUtf8StringValid(filter) || filter.length === 0) return false;
  const levels = filter.split("/");
  return levels.every((level, index) => (
    (level === "#" && index === levels.length - 1)
    || level === "+"
    || (!level.includes("#") && !level.includes("+"))
  ));
}

function mqttPropertyUtf8Violations(properties, at) {
  const violations = [];
  for (const [index, property] of (properties || []).entries()) {
    if (typeof property?.value === "string")
      violations.push(...mqttUtf8StringViolations(property.value, `${at}[${index}].value`));
    if (Array.isArray(property?.value)) {
      for (const [valueIndex, value] of property.value.entries()) {
        if (typeof value === "string")
          violations.push(...mqttUtf8StringViolations(value, `${at}[${index}].value[${valueIndex}]`));
      }
    }
  }
  return violations;
}

function mqttNativeUtf8Violations(event, at) {
  if (event?.kind !== "native") return [];
  const facts = event.facts || {};
  const violations = [];
  for (const field of ["clientId", "topic"]) {
    if (Object.hasOwn(facts, field))
      violations.push(...mqttUtf8StringViolations(facts[field], `${at}.facts.${field}`));
  }
  violations.push(...mqttPropertyUtf8Violations(facts.properties, `${at}.facts.properties`));
  violations.push(...mqttPropertyBinaryViolations(facts.properties, `${at}.facts.properties`));
  if (facts.connect) {
    violations.push(...mqttUtf8StringViolations(facts.connect.clientId, `${at}.facts.connect.clientId`));
    violations.push(...mqttPropertyUtf8Violations(facts.connect.properties, `${at}.facts.connect.properties`));
    violations.push(...mqttPropertyBinaryViolations(facts.connect.properties, `${at}.facts.connect.properties`));
  }
  return violations;
}

function mqtt5PropertyViolations(properties, singletonNames, at) {
  const violations = [];
  const counts = new Map();
  for (const property of properties || []) {
    const count = (counts.get(property?.name) || 0) + 1;
    counts.set(property?.name, count);
    if (singletonNames.has(property?.name) && count > 1)
      violations.push(`${at}: MQTT 5 property '${property.name}' is not repeatable in this packet`);
  }
  return violations;
}

const MQTT5_CONNACK_SINGLETON_PROPERTIES = new Set([
  "reason-string", "session-expiry-interval", "assigned-client-identifier",
  "receive-maximum", "topic-alias-maximum",
  "server-keep-alive", "maximum-qos", "retain-available",
  "wildcard-subscription-available", "subscription-identifier-available",
  "shared-subscription-available", "server-reference", "response-information",
  "authentication-method", "authentication-data",
]);

function mqtt5ConnackPropertyViolations(properties, reasonCode, at) {
  const violations = mqtt5PropertyViolations(properties, MQTT5_CONNACK_SINGLETON_PROPERTIES, at);
  const names = new Set((properties || []).map((property) => property.name));
  if (names.has("authentication-data") && !names.has("authentication-method"))
    violations.push(`${at}: authentication-data requires authentication-method in CONNACK`);
  if (reasonCode !== 0) {
    const successOnly = [...names].filter((name) => ![
      "reason-string", "user-property", "server-reference",
    ].includes(name));
    if (successOnly.length)
      violations.push(`${at}: unsuccessful CONNACK carries success-only property '${successOnly[0]}'`);
    if (names.has("server-reference") && ![156, 157].includes(reasonCode))
      violations.push(`${at}: server-reference is admitted only for Use Another Server or Server Moved CONNACK`);
  } else if (names.has("server-reference")) {
    violations.push(`${at}: successful CONNACK cannot carry server-reference`);
  }
  return violations;
}

function mqtt5ConnectPropertyViolations(properties, at) {
  const violations = mqtt5PropertyViolations(
    properties,
    new Set(["session-expiry-interval", "receive-maximum", "topic-alias-maximum", "request-response-information", "authentication-method", "authentication-data"]),
    at
  );
  const names = new Set((properties || []).map((property) => property.name));
  if (names.has("authentication-data") && !names.has("authentication-method"))
    violations.push(`${at}: CONNECT authentication-data requires authentication-method`);
  return violations;
}

function mqtt5DisconnectPropertyViolations(properties, reasonCode, at, origin) {
  const violations = mqtt5PropertyViolations(
    properties,
    new Set(["reason-string", "session-expiry-interval", "server-reference"]),
    at
  );
  const names = new Set((properties || []).map((property) => property.name));
  if (origin === "peer") {
    if (reasonCode === 4)
      violations.push(`${at}: MQTT 5 DISCONNECT reason 4 is client-only and cannot be peer-originated`);
    if (names.has("server-reference") && ![156, 157].includes(reasonCode))
      violations.push(`${at}: peer Server Reference requires Use Another Server or Server Moved`);
    if (names.has("session-expiry-interval"))
      violations.push(`${at}: server DISCONNECT cannot carry Session Expiry Interval`);
  } else if (names.has("server-reference")) {
    violations.push(`${at}: client DISCONNECT cannot carry Server Reference`);
  }
  return violations;
}

function mqtt5PublishPropertyViolations(properties, at, origin) {
  const violations = mqtt5PropertyViolations(
    properties,
    new Set(["content-type", "correlation-data", "message-expiry-interval", "payload-format-indicator", "response-topic", "topic-alias"]),
    at
  );
  for (const [index, property] of (properties || []).entries()) {
    if (property.name === "response-topic" && (property.value.includes("+") || property.value.includes("#")))
      violations.push(`${at}[${index}]: MQTT Response Topic must be a Topic Name without wildcards`);
    if (origin === "local" && property.name === "subscription-identifier")
      violations.push(`${at}[${index}]: client-originated PUBLISH cannot carry server-only Subscription Identifier`);
  }
  return violations;
}

function mqtt5SubscribePropertyViolations(properties, at) {
  const violations = mqtt5PropertyViolations(
    properties,
    new Set(["subscription-identifier"]),
    at
  );
  for (const [index, property] of (properties || []).entries()) {
    if (!["subscription-identifier", "user-property"].includes(property.name))
      violations.push(`${at}[${index}]: property '${property.name}' is not admitted on SUBSCRIBE`);
  }
  return violations;
}

const MQTT5_ACK_REASON_CODES = new Map([
  ["puback", new Set([0, 16, 128, 131, 135, 144, 145, 151, 153])],
  ["pubrec", new Set([0, 16, 128, 131, 135, 144, 145, 151, 153])],
  ["pubrel", new Set([0, 146])],
  ["pubcomp", new Set([0, 146])],
  ["suback", new Set([0, 1, 2, 128, 131, 135, 143, 145, 151, 158, 161, 162])],
  ["unsuback", new Set([0, 17, 128, 131, 135, 143, 145])],
]);

function mqtt5NativeFactViolations(event, at) {
  const facts = event?.facts || {};
  if (event?.kind !== "native") return [];
  if (event.name === "reconnected")
    return [
      ...mqtt5ConnectPropertyViolations(facts.connect?.properties, `${at}.facts.connect.properties`),
      ...mqtt5ConnackPropertyViolations(facts.properties, 0, `${at}.facts.properties`),
    ];
  if (event.name === "connection-opened" || (event.name === "connection-closed" && facts.packetType === "CONNACK"))
    return mqtt5ConnackPropertyViolations(facts.properties, facts.reasonCode, `${at}.facts.properties`);
  if (event.name === "connection-closed" && facts.packetType === "DISCONNECT")
    return mqtt5DisconnectPropertyViolations(facts.properties, facts.reasonCode, `${at}.facts.properties`, "peer");
  if (event.name === "dispatch" && facts.packetType === "CONNECT") {
    return mqtt5ConnectPropertyViolations(facts.properties, `${at}.facts.properties`);
  }
  if (event.name === "dispatch" && facts.packetType === "DISCONNECT")
    return mqtt5DisconnectPropertyViolations(facts.properties, facts.reasonCode, `${at}.facts.properties`, "local");
  if (facts.packetType === "PUBLISH")
    return mqtt5PublishPropertyViolations(facts.properties, `${at}.facts.properties`, event.name === "dispatch" ? "local" : "peer");
  if (event.name === "dispatch" && facts.packetType === "SUBSCRIBE")
    return mqtt5SubscribePropertyViolations(facts.properties, `${at}.facts.properties`);
  const packet = typeof facts.packetType === "string" ? facts.packetType.toLowerCase() : undefined;
  if (MQTT5_ACK_REASON_CODES.has(packet)) {
    const violations = mqtt5PropertyViolations(facts.properties, new Set(["reason-string"]), `${at}.facts.properties`);
    if (!MQTT5_ACK_REASON_CODES.get(packet).has(facts.reasonCode))
      violations.push(`${at}.facts.reasonCode: ${facts.reasonCode} is not admitted for ${facts.packetType}`);
    return violations;
  }
  return [];
}

function peerScriptViolations(dialect, script, at) {
  if (dialect === "openbindings.asyncapi-http-peer@2")
    return httpPeerV2Violations(script, at);
  const violations = [];
  const dialectSchema = PEER_DIALECT_SCHEMAS.get(dialect);
  if (!dialectSchema) return [`${at}: unknown revision-6 peer dialect '${dialect}'`];
  const peerShape = ajvOk(dialectSchema, script);
  if (!peerShape.ok)
    violations.push(`${at}: does not match ${basename(dialectSchema)}\n${peerShape.out}`);
  else {
    violations.push(...base64Violations(script, at));
    if (dialect === "openbindings.asyncapi-http-peer@1" && script?.outcome === "disconnect") {
      const beforeRequest = script.disconnectAt === "before-request";
      const trigger = script.after;
      if (beforeRequest && trigger?.kind !== "start")
        violations.push(`${at}.after: before-request disconnect must be released at start`);
      if (
        !beforeRequest
        && !(trigger?.kind === "native" && trigger.name === "dispatch")
      )
        violations.push(`${at}.after: ${script.disconnectAt} disconnect must be released after an HTTP dispatch`);
    }
    if (dialect === "openbindings.asyncapi-websocket-peer@1") {
      if (
        script?.handshake?.outcome === "accepted"
        && (
          !canonicalBase64(script.handshake.secWebSocketAccept)
          || Buffer.from(script.handshake.secWebSocketAccept, "base64").length !== 20
        )
      )
        violations.push(`${at}.handshake.secWebSocketAccept: accepted handshake requires the canonical Base64 SHA-1 result`);
      for (const [extensionIndex, extension] of (script?.handshake?.extensions || []).entries()) {
        if (!websocketExtensionValueValid(extension))
          violations.push(`${at}.handshake.extensions[${extensionIndex}]: selected extension does not match safe WebSocket extension grammar`);
      }
      if (script?.handshake?.outcome === "protocol-error") {
        const validUpgrade = script.handshake.upgrade?.toLowerCase() === "websocket";
        const hasUpgrade = script.handshake.connectionTokens.some((token) => token.toLowerCase() === "upgrade");
        const headerErrorConsistent = !script.handshake.error.includes("upgrade") && !script.handshake.error.includes("connection")
          ? validUpgrade && hasUpgrade
          : (
            (script.handshake.error === "missing-upgrade" && script.handshake.upgrade === null && hasUpgrade)
            || (script.handshake.error === "wrong-upgrade" && typeof script.handshake.upgrade === "string" && !validUpgrade && hasUpgrade)
            || (script.handshake.error === "missing-connection" && validUpgrade && script.handshake.connectionTokens.length === 0)
            || (script.handshake.error === "wrong-connection" && validUpgrade && script.handshake.connectionTokens.length > 0 && !hasUpgrade)
          );
        if (!headerErrorConsistent)
          violations.push(`${at}.handshake: protocol-error label does not match Upgrade/Connection wire evidence`);
      }
      if (script?.handshake?.outcome !== "accepted" && (script?.events || []).length)
        violations.push(`${at}.events: a rejected or protocol-error WebSocket handshake is terminal`);
      let terminal = script?.handshake?.outcome !== "accepted";
      for (const [eventIndex, event] of peerScriptEvents(dialect, script).entries()) {
        const eventAt = `${at}.events[${eventIndex}]`;
        if (terminal)
          violations.push(`${eventAt}: WebSocket peer event follows a terminal handshake or frame`);
        if (event?.kind === "text-message" && stringHasUnpairedSurrogate(event.text))
          violations.push(`${eventAt}.text: WebSocket text must be a Unicode scalar-value sequence`);
        if (event?.kind === "close")
          violations.push(...websocketCloseWireViolations(event, eventAt));
        if (event?.kind === "invalid-frame")
          violations.push(...websocketInvalidFrameViolations(event, eventAt));
        let fragmentedTextInvalid = false;
        if (event?.kind === "fragmented-message" && event.opcode === "text") {
          try {
            const bytes = Buffer.concat((event.fragmentsBase64 || []).map((part) => Buffer.from(part, "base64")));
            new TextDecoder("utf-8", { fatal: true }).decode(bytes);
          } catch {
            fragmentedTextInvalid = true;
          }
        }
        if (["close", "disconnect", "invalid-frame"].includes(event?.kind) || fragmentedTextInvalid)
          terminal = true;
      }
    }
    if (dialect === "openbindings.asyncapi-kafka-peer@1") {
      for (const [eventIndex, event] of peerScriptEvents(dialect, script).entries()) {
        if (Object.hasOwn(event, "offset") && !validKafkaOffset(event.offset))
          violations.push(`${at}.events[${eventIndex}].offset: Kafka offset must be an exact nonnegative signed-64-bit decimal string`);
      }
    }
    if (dialect === "openbindings.asyncapi-mqtt-peer@1") {
      violations.push(...mqttPropertyUtf8Violations(script?.connection?.properties, `${at}.connection.properties`));
      violations.push(...mqttPropertyBinaryViolations(script?.connection?.properties, `${at}.connection.properties`));
      if (script?.connection?.accepted === false && (script?.events || []).length)
        violations.push(`${at}.events: rejected CONNACK is terminal for this peer-script lifecycle`);
      let reconnectAttempt = 0;
      let connectionState = script?.connection?.accepted ? "connected" : "terminal";
      for (const [eventIndex, event] of peerScriptEvents(dialect, script).entries()) {
        const eventAt = `${at}.events[${eventIndex}]`;
        if (Object.hasOwn(event, "topic"))
          violations.push(...mqttUtf8StringViolations(event.topic, `${eventAt}.topic`));
        violations.push(...mqttPropertyUtf8Violations(event.properties, `${eventAt}.properties`));
        violations.push(...mqttPropertyBinaryViolations(event.properties, `${eventAt}.properties`));
        if (event.connect) {
          violations.push(...mqttUtf8StringViolations(event.connect.clientId, `${eventAt}.connect.clientId`));
          violations.push(...mqttPropertyUtf8Violations(event.connect.properties, `${eventAt}.connect.properties`));
          violations.push(...mqttPropertyBinaryViolations(event.connect.properties, `${eventAt}.connect.properties`));
        }
        if (event.kind === "reconnect") {
          if (connectionState !== "disconnected")
            violations.push(`${eventAt}: MQTT reconnect requires a preceding connection loss in this lifecycle`);
          if (event.attempt <= reconnectAttempt)
            violations.push(`${eventAt}.attempt: reconnect attempts must increase strictly within one peer-script lifecycle`);
          reconnectAttempt = event.attempt;
          connectionState = "connected";
        } else if (["transport-loss", "disconnect"].includes(event.kind)) {
          if (connectionState !== "connected")
            violations.push(`${eventAt}: MQTT connection loss requires connected state`);
          connectionState = "disconnected";
        } else if (connectionState !== "connected") {
          violations.push(`${eventAt}: MQTT packet activity requires connected state`);
        }
      }
    }
    if (dialect === "openbindings.asyncapi-mqtt-peer@1" && script?.protocolVersion === "3.1.1") {
      if (Object.hasOwn(script.connection || {}, "reasonCode"))
        violations.push(`${at}.connection: MQTT 3.1.1 cannot carry an MQTT 5 reason code`);
      for (const [eventIndex, event] of peerScriptEvents(dialect, script).entries()) {
        const eventAt = `${at}.events[${eventIndex}]`;
        if (Object.hasOwn(event, "reasonCode") || Object.hasOwn(event, "properties"))
          violations.push(`${eventAt}: MQTT 3.1.1 cannot carry MQTT 5 reason codes or properties`);
        if (event.kind === "suback" && !Object.hasOwn(event, "grantedQos"))
          violations.push(`${eventAt}: MQTT 3.1.1 SUBACK requires grantedQos`);
        if (Object.hasOwn(event, "subscribe"))
          violations.push(`${eventAt}: MQTT 3.1.1 peer evidence cannot carry MQTT 5 SUBSCRIBE properties`);
        if (event.kind !== "suback" && Object.hasOwn(event, "grantedQos"))
          violations.push(`${eventAt}: grantedQos is permitted only on MQTT 3.1.1 SUBACK`);
      }
    }
    if (dialect === "openbindings.asyncapi-mqtt-peer@1" && script?.protocolVersion === "5.0") {
      violations.push(...mqtt5ConnackPropertyViolations(
        script?.connection?.properties,
        script?.connection?.reasonCode,
        `${at}.connection.properties`
      ));
      for (const [eventIndex, event] of peerScriptEvents(dialect, script).entries()) {
        const eventAt = `${at}.events[${eventIndex}]`;
        if (Object.hasOwn(event, "grantedQos"))
          violations.push(`${eventAt}: MQTT 5 acknowledgements use reasonCode, not grantedQos`);
        if (event.kind === "suback") {
          if (!event.subscribe)
            violations.push(`${eventAt}: MQTT 5 SUBACK requires exact associated SUBSCRIBE evidence`);
          else {
            if (!mqttTopicFilterSyntaxValid(event.subscribe.topic))
              violations.push(`${eventAt}.subscribe.topic: invalid MQTT topic filter`);
            violations.push(...mqtt5SubscribePropertyViolations(
              event.subscribe.properties,
              `${eventAt}.subscribe.properties`
            ));
          }
        } else if (Object.hasOwn(event, "subscribe")) {
          violations.push(`${eventAt}: associated SUBSCRIBE evidence is permitted only on SUBACK`);
        }
        if (MQTT5_ACK_REASON_CODES.has(event.kind)) {
          const reasonCode = event.reasonCode ?? 0;
          if (!MQTT5_ACK_REASON_CODES.get(event.kind).has(reasonCode))
            violations.push(`${eventAt}.reasonCode: ${reasonCode} is not admitted for ${event.kind.toUpperCase()}`);
          violations.push(...mqtt5PropertyViolations(
            event.properties,
            new Set(["reason-string"]),
            `${eventAt}.properties`
          ));
        } else if (event.kind === "publish") {
          violations.push(...mqtt5PublishPropertyViolations(event.properties, `${eventAt}.properties`, "peer"));
        } else if (event.kind === "reconnect") {
          violations.push(...mqtt5ConnectPropertyViolations(event.connect?.properties, `${eventAt}.connect.properties`));
          violations.push(...mqtt5ConnackPropertyViolations(event.properties, 0, `${eventAt}.properties`));
          const assigned = (event.properties || []).filter((property) => property.name === "assigned-client-identifier");
          if (event.sessionPresent && (event.connect?.cleanStart || event.connect?.clientId === ""))
            violations.push(`${eventAt}: resumed reconnect requires nonempty Client ID and cleanStart false`);
          if (event.connect?.clientId === "") {
            if (!event.connect.cleanStart || assigned.length !== 1)
              violations.push(`${eventAt}: empty reconnect Client ID requires cleanStart and one assigned-client-identifier`);
          } else if (assigned.length) {
            violations.push(`${eventAt}: reconnect assigned-client-identifier is forbidden for nonempty Client ID`);
          }
          const connectAuth = (event.connect?.properties || [])
            .find((property) => property.name === "authentication-method")?.value;
          const connackAuth = (event.properties || [])
            .find((property) => property.name === "authentication-method")?.value;
          if (connackAuth !== connectAuth)
            violations.push(`${eventAt}: reconnect CONNACK authentication-method differs from CONNECT`);
          const requestedResponseInformation = (event.connect?.properties || []).some((property) =>
            property.name === "request-response-information" && property.value === 1
          );
          if ((event.properties || []).some((property) => property.name === "response-information") && !requestedResponseInformation)
            violations.push(`${eventAt}: reconnect Response Information was not requested by CONNECT`);
        } else if (event.kind === "disconnect") {
          violations.push(...mqtt5DisconnectPropertyViolations(
            event.properties,
            event.reasonCode ?? 0,
            `${eventAt}.properties`,
            "peer"
          ));
        }
      }
    }
  }
  return violations;
}

function httpPeerV2SemanticViolations(script, at) {
  const violations = [];
  const tls = script?.transport === "tls" && script?.tls && typeof script.tls === "object"
    ? script.tls
    : undefined;
  const hasTlsRequestActivity = tls && Array.isArray(script?.events) && script.events.some((event) =>
    event?.kind === "response-head"
    || event?.kind === "body-chunk"
    || (
      event?.kind === "disconnect"
      && (
        ["during-request", "before-response", "during-response"].includes(event.stage)
        || (
          event.after?.kind === "native"
          && ["dispatch", "request-started", "acknowledgement", "delivery"].includes(event.after.name)
        )
      )
    )
  );
  if (tls?.serverTlsVersionSelected === null && tls.serverAlpnSelected !== null)
    violations.push(`${at}.tls: a null TLS selection requires a null ALPN selection`);
  if (
    hasTlsRequestActivity
    && (tls.serverTlsVersionSelected !== "1.3" || tls.serverAlpnSelected !== "http/1.1")
  ) violations.push(`${at}.tls: TLS request activity requires TLS 1.3 and ALPN http/1.1 selections`);
  if (!Array.isArray(script?.events) || script.events.length === 0) return violations;
  let finalSeen = false;
  let terminal = false;
  for (const [index, event] of script.events.entries()) {
    const eventAt = `${at}.events[${index}]`;
    if (terminal) violations.push(`${eventAt}: HTTP peer activity follows a terminal event`);
    if (event.kind === "response-head") {
      if (finalSeen) violations.push(`${eventAt}: a second final response head is not admitted`);
      if (event.status === 101) terminal = true;
      else if (event.status >= 200) finalSeen = true;
    } else if (event.kind === "body-chunk" && !finalSeen) {
      violations.push(`${eventAt}: response body bytes require a preceding final response head`);
    } else if (event.kind === "disconnect") {
      terminal = true;
    }
  }
  if (!finalSeen && !terminal)
    violations.push(`${at}.events: script has neither a final response nor a terminal disconnect/protocol switch`);
  return violations;
}

function httpPeerV2Violations(script, at) {
  const shape = ajvOk(HTTP_PEER_V2_SCHEMA, script);
  return [
    ...(shape.ok
      ? base64Violations(script, at)
      : [`${at}: does not match ${basename(HTTP_PEER_V2_SCHEMA)}\n${shape.out}`]),
    ...httpPeerV2SemanticViolations(script, at),
  ];
}

// C20B deliberately parses the small certificate subset used by its fixed
// qualification hierarchy. Node supplies signature and key primitives; these
// DER helpers independently derive extension facts rather than trusting labels
// or invoking a platform certificate/path validator.
function derElement(bytes, offset = 0) {
  if (!Buffer.isBuffer(bytes) || offset < 0 || offset + 2 > bytes.length)
    throw new Error("truncated DER element");
  const tag = bytes[offset];
  let cursor = offset + 1;
  let length = bytes[cursor++];
  if (length & 0x80) {
    const count = length & 0x7f;
    if (count === 0 || count > 4 || cursor + count > bytes.length)
      throw new Error("unsupported DER length");
    length = 0;
    for (let index = 0; index < count; index++) length = length * 256 + bytes[cursor++];
    if (length < 128) throw new Error("nonminimal DER length");
  }
  const contentStart = cursor;
  const end = contentStart + length;
  if (end > bytes.length) throw new Error("truncated DER content");
  return { tag, offset, contentStart, end, next: end };
}

function derChildren(bytes, element) {
  const children = [];
  let offset = element.contentStart;
  while (offset < element.end) {
    const child = derElement(bytes, offset);
    children.push(child);
    offset = child.next;
  }
  if (offset !== element.end) throw new Error("DER child boundary mismatch");
  return children;
}

function derOid(bytes, element) {
  const value = bytes.subarray(element.contentStart, element.end);
  if (!value.length) throw new Error("empty DER OID");
  const arcs = [Math.floor(value[0] / 40), value[0] % 40];
  let current = 0;
  for (const byte of value.subarray(1)) {
    current = current * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) {
      arcs.push(current);
      current = 0;
    }
  }
  if (current !== 0) throw new Error("truncated DER OID");
  return arcs.join(".");
}

function derUnsignedInteger(bytes, element, label) {
  if (element.tag !== 0x02 && element.tag !== 0x80 && element.tag !== 0x81)
    throw new Error(`${label} is not an INTEGER`);
  const raw = bytes.subarray(element.contentStart, element.end);
  if (!raw.length || (raw[0] & 0x80) || (raw.length > 1 && raw[0] === 0 && !(raw[1] & 0x80)))
    throw new Error(`${label} is not a canonical nonnegative INTEGER`);
  let value = 0;
  for (const byte of raw) value = value * 256 + byte;
  if (!Number.isSafeInteger(value)) throw new Error(`${label} exceeds the apparatus integer range`);
  return value;
}

function c20bParseNameSubtrees(value, wrapper, label) {
  const constraints = [];
  for (const subtree of derChildren(value, wrapper)) {
    if (subtree.tag !== 0x30) throw new Error(`${label} GeneralSubtree is not a sequence`);
    const fields = derChildren(value, subtree);
    if (fields.length !== 1) throw new Error(`${label} only admits a GeneralName base with default minimum and absent maximum`);
    const base = fields[0];
    const raw = value.subarray(base.contentStart, base.end);
    if (base.tag === 0x82) {
      if (!raw.length || raw.some((byte) => byte > 0x7f)) throw new Error(`${label} dNSName is not nonempty ASCII`);
      constraints.push({ kind: "dns", value: raw.toString("ascii").toLowerCase() });
    } else if (base.tag === 0x87) {
      if (![8, 32].includes(raw.length)) throw new Error(`${label} iPAddress constraint is not address+mask`);
      const half = raw.length / 2;
      constraints.push({ kind: "ip", address: Buffer.from(raw.subarray(0, half)), mask: Buffer.from(raw.subarray(half)) });
    } else {
      throw new Error(`${label} contains an unhandled GeneralName type`);
    }
  }
  return constraints;
}

function c20bCertificateFacts(der) {
  const root = derElement(der, 0);
  if (root.tag !== 0x30 || root.end !== der.length) throw new Error("certificate is not one DER sequence");
  const certificateChildren = derChildren(der, root);
  if (certificateChildren.length !== 3 || certificateChildren[1]?.tag !== 0x30 || certificateChildren[2]?.tag !== 0x03)
    throw new Error("certificate DER is not the exact three-member Certificate sequence");
  const tbs = certificateChildren[0];
  if (!tbs || tbs.tag !== 0x30) throw new Error("certificate lacks TBSCertificate");
  const extensionWrapper = derChildren(der, tbs).find((child) => child.tag === 0xa3);
  if (!extensionWrapper) throw new Error("certificate lacks extensions");
  const extensionSequence = derChildren(der, extensionWrapper)[0];
  if (!extensionSequence || extensionSequence.tag !== 0x30) throw new Error("malformed certificate extensions");
  const facts = {
    basicConstraintsPresent: false,
    ca: false,
    pathLength: undefined,
    keyUsagePresent: false,
    keyUsage: new Set(),
    extendedKeyUsagePresent: false,
    extendedKeyUsage: new Set(),
    dnsNames: [],
    ipAddressHex: [],
    permittedNameSubtrees: [],
    excludedNameSubtrees: [],
    certificatePoliciesPresent: false,
    certificatePolicies: new Set(),
    policyMappings: [],
    requireExplicitPolicy: undefined,
    inhibitPolicyMapping: undefined,
    inhibitAnyPolicy: undefined,
    unsupportedCriticalExtensions: [],
  };
  const seenOids = new Set();
  const knownExtensions = new Set([
    "2.5.29.14", "2.5.29.15", "2.5.29.17", "2.5.29.19", "2.5.29.30",
    "2.5.29.32", "2.5.29.33", "2.5.29.35", "2.5.29.36", "2.5.29.37", "2.5.29.54",
  ]);
  for (const extension of derChildren(der, extensionSequence)) {
    const fields = derChildren(der, extension);
    if (fields.length < 2 || fields.length > 3 || fields[0]?.tag !== 0x06)
      throw new Error("malformed Extension sequence");
    const oid = derOid(der, fields[0]);
    if (seenOids.has(oid)) throw new Error(`duplicate extension ${oid}`);
    seenOids.add(oid);
    const hasCritical = fields.length === 3;
    if (hasCritical && fields[1].tag !== 0x01) throw new Error(`extension ${oid} has malformed critical flag`);
    const critical = hasCritical && der.subarray(fields[1].contentStart, fields[1].end).some((byte) => byte !== 0);
    const valueField = fields.at(-1);
    if (!valueField || valueField.tag !== 0x04) throw new Error(`extension ${oid} lacks OCTET STRING`);
    const value = der.subarray(valueField.contentStart, valueField.end);
    const inner = derElement(value, 0);
    if (inner.end !== value.length) throw new Error(`extension ${oid} has trailing DER`);
    if (critical && !knownExtensions.has(oid)) facts.unsupportedCriticalExtensions.push(oid);
    if (oid === "2.5.29.19") {
      facts.basicConstraintsPresent = true;
      const bc = derChildren(value, inner);
      if (bc[0]?.tag === 0x01) facts.ca = value[bc[0].contentStart] !== 0;
      const path = bc.find((child) => child.tag === 0x02);
      if (path) {
        let integer = 0;
        for (const byte of value.subarray(path.contentStart, path.end)) integer = integer * 256 + byte;
        facts.pathLength = integer;
      }
    } else if (oid === "2.5.29.15") {
      facts.keyUsagePresent = true;
      if (inner.tag !== 0x03 || inner.contentStart >= inner.end) throw new Error("malformed keyUsage");
      const bits = value.subarray(inner.contentStart + 1, inner.end);
      const names = ["digitalSignature", "nonRepudiation", "keyEncipherment", "dataEncipherment", "keyAgreement", "keyCertSign", "cRLSign", "encipherOnly", "decipherOnly"];
      for (let bit = 0; bit < names.length; bit++) {
        if (bits[Math.floor(bit / 8)] & (0x80 >> (bit % 8))) facts.keyUsage.add(names[bit]);
      }
    } else if (oid === "2.5.29.37") {
      facts.extendedKeyUsagePresent = true;
      for (const eku of derChildren(value, inner)) facts.extendedKeyUsage.add(derOid(value, eku));
    } else if (oid === "2.5.29.17") {
      for (const name of derChildren(value, inner)) {
        const raw = value.subarray(name.contentStart, name.end);
        if (name.tag === 0x82) facts.dnsNames.push(raw.toString("ascii").toLowerCase());
        if (name.tag === 0x87 && [4, 16].includes(raw.length)) facts.ipAddressHex.push(raw.toString("hex"));
      }
    } else if (oid === "2.5.29.30") {
      if (inner.tag !== 0x30) throw new Error("malformed nameConstraints");
      for (const wrapper of derChildren(value, inner)) {
        if (wrapper.tag === 0xa0) facts.permittedNameSubtrees.push(...c20bParseNameSubtrees(value, wrapper, "permittedSubtrees"));
        else if (wrapper.tag === 0xa1) facts.excludedNameSubtrees.push(...c20bParseNameSubtrees(value, wrapper, "excludedSubtrees"));
        else throw new Error("nameConstraints contains an unknown member");
      }
    } else if (oid === "2.5.29.32") {
      facts.certificatePoliciesPresent = true;
      if (inner.tag !== 0x30) throw new Error("malformed certificatePolicies");
      for (const policyInformation of derChildren(value, inner)) {
        if (policyInformation.tag !== 0x30) throw new Error("malformed PolicyInformation");
        const fields = derChildren(value, policyInformation);
        if (!fields[0] || fields[0].tag !== 0x06) throw new Error("PolicyInformation lacks policyIdentifier");
        facts.certificatePolicies.add(derOid(value, fields[0]));
      }
    } else if (oid === "2.5.29.33") {
      if (inner.tag !== 0x30) throw new Error("malformed policyMappings");
      for (const mapping of derChildren(value, inner)) {
        const fields = derChildren(value, mapping);
        if (mapping.tag !== 0x30 || fields.length !== 2 || fields.some((field) => field.tag !== 0x06))
          throw new Error("malformed PolicyMapping");
        facts.policyMappings.push({ issuer: derOid(value, fields[0]), subject: derOid(value, fields[1]) });
      }
    } else if (oid === "2.5.29.36") {
      if (inner.tag !== 0x30) throw new Error("malformed policyConstraints");
      for (const field of derChildren(value, inner)) {
        if (field.tag === 0x80) facts.requireExplicitPolicy = derUnsignedInteger(value, field, "requireExplicitPolicy");
        else if (field.tag === 0x81) facts.inhibitPolicyMapping = derUnsignedInteger(value, field, "inhibitPolicyMapping");
        else throw new Error("policyConstraints contains an unknown member");
      }
    } else if (oid === "2.5.29.54") {
      facts.inhibitAnyPolicy = derUnsignedInteger(value, inner, "inhibitAnyPolicy");
    }
  }
  return facts;
}

function c20bIpv4Bytes(value) {
  if (typeof value !== "string") return undefined;
  const parts = value.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^(?:0|[1-9][0-9]{0,2})$/.test(part) || Number(part) > 255)) return undefined;
  return Buffer.from(parts.map(Number));
}

function c20bIpv6Bytes(value) {
  if (typeof value !== "string" || value !== value.toLowerCase() || value.includes(".")) return undefined;
  const halves = value.split("::");
  if (halves.length > 2) return undefined;
  const parseHalf = (text) => text === "" ? [] : text.split(":").map((part) => /^[0-9a-f]{1,4}$/.test(part) ? Number.parseInt(part, 16) : NaN);
  const left = parseHalf(halves[0]);
  const right = halves.length === 2 ? parseHalf(halves[1]) : [];
  if ([...left, ...right].some(Number.isNaN)) return undefined;
  const zeros = halves.length === 2 ? 8 - left.length - right.length : 0;
  if ((halves.length === 2 && zeros < 1) || (halves.length === 1 && left.length !== 8)) return undefined;
  const groups = [...left, ...Array(zeros).fill(0), ...right];
  if (groups.length !== 8) return undefined;
  let bestStart = -1;
  let bestLength = 0;
  for (let index = 0; index < groups.length;) {
    if (groups[index] !== 0) { index++; continue; }
    let end = index;
    while (end < groups.length && groups[end] === 0) end++;
    if (end - index > bestLength && end - index >= 2) { bestStart = index; bestLength = end - index; }
    index = end;
  }
  const pieces = groups.map((group) => group.toString(16));
  const canonical = bestStart < 0
    ? pieces.join(":")
    : `${pieces.slice(0, bestStart).join(":")}::${pieces.slice(bestStart + bestLength).join(":")}`;
  if (canonical !== value) return undefined;
  const bytes = Buffer.alloc(16);
  groups.forEach((group, index) => bytes.writeUInt16BE(group, index * 2));
  return bytes;
}

function c20bIpBytes(value) {
  return c20bIpv4Bytes(value) || c20bIpv6Bytes(value);
}

const HTTP_TOKEN_RE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

// RFC 9110 media-type field-value grammar. OWS is admitted around the
// semicolon separator, but not around '=' (where it would be bad whitespace).
function httpMediaTypeFieldValue(value) {
  if (typeof value !== "string" || !c20bUnicodeScalarString(value)
    || /[\0\r\n\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) return false;
  let index = 0;
  const tokenAt = () => {
    const match = value.slice(index).match(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+/);
    if (!match) return false;
    index += match[0].length;
    return true;
  };
  if (!tokenAt() || value[index++] !== "/" || !tokenAt()) return false;
  while (index < value.length) {
    const whitespaceStart = index;
    while (value[index] === " " || value[index] === "\t") index++;
    if (index === value.length) return whitespaceStart === index;
    if (value[index++] !== ";") return false;
    while (value[index] === " " || value[index] === "\t") index++;
    if (index === value.length || value[index] === ";") continue;
    if (!tokenAt() || value[index++] !== "=") return false;
    if (value[index] === "\"") {
      index++;
      let closed = false;
      while (index < value.length) {
        const code = value.codePointAt(index);
        if (code === 0x22) { index++; closed = true; break; }
        if (code === 0x5c) {
          index++;
          if (index >= value.length) return false;
          const escaped = value.codePointAt(index);
          if (!(escaped === 0x09 || escaped === 0x20 || (escaped >= 0x21 && escaped !== 0x7f))) return false;
          index += escaped > 0xffff ? 2 : 1;
          continue;
        }
        if (!(code === 0x09 || code === 0x20 || code === 0x21
          || (code >= 0x23 && code <= 0x5b) || code >= 0x5d)) return false;
        index += code > 0xffff ? 2 : 1;
      }
      if (!closed) return false;
    } else if (!tokenAt()) return false;
  }
  return true;
}

function c20bCanonicalDnsName(value) {
  if (typeof value !== "string" || value !== value.toLowerCase() || value.length > 253) return false;
  const labels = value.split(".");
  return labels.length > 1 && labels.every((label) => label.length >= 1 && label.length <= 63
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label));
}

function c20bDnsConstraintMatches(name, constraint) {
  const lower = name.toLowerCase();
  const base = constraint.toLowerCase();
  return base.startsWith(".") ? lower.endsWith(base) && lower.length > base.length : lower === base || lower.endsWith(`.${base}`);
}

function c20bIpConstraintMatches(bytes, constraint) {
  if (bytes.length !== constraint.address.length || bytes.length !== constraint.mask.length) return false;
  for (let index = 0; index < bytes.length; index++) {
    if ((bytes[index] & constraint.mask[index]) !== (constraint.address[index] & constraint.mask[index])) return false;
  }
  return true;
}

function c20bApplyNameConstraints(path, at, reject) {
  const leaf = path[0];
  const constraints = path.slice(1).flatMap((certificate) => [
    ...certificate.facts.permittedNameSubtrees.map((entry) => ({ ...entry, disposition: "permitted" })),
    ...certificate.facts.excludedNameSubtrees.map((entry) => ({ ...entry, disposition: "excluded" })),
  ]);
  for (const [kind, values] of [["dns", leaf.facts.dnsNames], ["ip", leaf.facts.ipAddressHex.map((hex) => Buffer.from(hex, "hex"))]]) {
    const permitted = constraints.filter((entry) => entry.kind === kind && entry.disposition === "permitted");
    const excluded = constraints.filter((entry) => entry.kind === kind && entry.disposition === "excluded");
    for (const value of values) {
      const matches = (constraint) => kind === "dns"
        ? c20bDnsConstraintMatches(value, constraint.value)
        : c20bIpConstraintMatches(value, constraint);
      if (excluded.some(matches) || (permitted.length && !permitted.some(matches)))
        reject("TLS-NAME-CONSTRAINTS", `${at} leaf ${kind} SAN is outside the prospective path name constraints`);
    }
  }
}

function c20bApplyPolicyProcessing(path, at, reject) {
  const anyPolicy = "2.5.29.32.0";
  let requireExplicit = Infinity;
  let inhibitMapping = Infinity;
  let inhibitAny = Infinity;
  let viable = new Set([anyPolicy]);
  const forward = path.slice(0, -1).reverse();
  for (const [depth, certificate] of forward.entries()) {
    const facts = certificate.facts;
    for (const mapping of facts.policyMappings) {
      if (mapping.issuer === anyPolicy || mapping.subject === anyPolicy) {
        reject("TLS-POLICY-MAPPING", `${at} chain policy mapping uses anyPolicy`);
        return;
      }
    }
    if (facts.certificatePoliciesPresent) {
      const policies = new Set(facts.certificatePolicies);
      const next = new Set();
      const anyAllowed = inhibitAny > 0 && policies.has(anyPolicy);
      if (viable.has(anyPolicy)) {
        for (const policy of policies) if (policy !== anyPolicy) next.add(policy);
        if (anyAllowed) next.add(anyPolicy);
      } else {
        for (const policy of viable) if (policies.has(policy) || anyAllowed) next.add(policy);
      }
      viable = next;
    } else {
      viable = new Set();
    }
    if (facts.policyMappings.length && inhibitMapping === 0) {
      reject("TLS-POLICY-MAPPING-INHIBITED", `${at} chain policy mapping is inhibited`);
      return;
    }
    if (inhibitMapping > 0 && facts.policyMappings.length) {
      const mapped = new Set(viable);
      for (const mapping of facts.policyMappings) if (viable.has(mapping.issuer) || viable.has(anyPolicy)) mapped.add(mapping.subject);
      viable = mapped;
    }
    if (requireExplicit === 0 && viable.size === 0) {
      reject("TLS-EXPLICIT-POLICY", `${at} chain has no valid policy under requireExplicitPolicy`);
      return;
    }
    if (depth < forward.length - 1) {
      if (Number.isFinite(requireExplicit) && requireExplicit > 0) requireExplicit--;
      if (Number.isFinite(inhibitMapping) && inhibitMapping > 0) inhibitMapping--;
      if (Number.isFinite(inhibitAny) && inhibitAny > 0) inhibitAny--;
    }
    if (facts.requireExplicitPolicy !== undefined) requireExplicit = Math.min(requireExplicit, facts.requireExplicitPolicy);
    if (facts.inhibitPolicyMapping !== undefined) inhibitMapping = Math.min(inhibitMapping, facts.inhibitPolicyMapping);
    if (facts.inhibitAnyPolicy !== undefined) inhibitAny = Math.min(inhibitAny, facts.inhibitAnyPolicy);
  }
  if (requireExplicit === 0 && viable.size === 0) reject("TLS-EXPLICIT-POLICY", `${at} chain ends without a valid explicit policy`);
}

function c20bEpochSeconds(value, label, violations) {
  const milliseconds = new Date(value).getTime();
  if (!Number.isFinite(milliseconds) || milliseconds % 1000 !== 0) {
    violations.push(`${label}: certificate validity time is not an exact whole second`);
    return 0n;
  }
  return BigInt(milliseconds / 1000);
}

function c20bAssetState(assets, at) {
  const violations = [];
  let validationTime = 0n;
  try { validationTime = BigInt(assets.validationTimeUnixSeconds); }
  catch { violations.push(`${at}.validationTimeUnixSeconds: is not an exact integer`); }
  const certificates = new Map();
  const capabilities = new Map();
  const seenCertificates = new Set();
  const seenKeys = new Set();
  for (const [name, record] of Object.entries(assets?.certificates || {})) {
    try {
      if (!canonicalBase64(record.derBase64)) throw new Error("certificate Base64 is not canonical");
      const der = Buffer.from(record.derBase64, "base64");
      const digest = createHash("sha256").update(der).digest("hex");
      if (seenCertificates.has(digest)) throw new Error("duplicate certificate DER");
      seenCertificates.add(digest);
      const x509 = new X509Certificate(der);
      if (x509.publicKey.asymmetricKeyType !== "rsa" || x509.publicKey.asymmetricKeyDetails?.modulusLength !== 2048)
        throw new Error("certificate key is not RSA-2048");
      certificates.set(name, { der, digest, x509, facts: c20bCertificateFacts(der) });
    } catch (error) {
      violations.push(`${at}.certificates.${name}: ${error.message}`);
    }
  }
  for (const [token, record] of Object.entries(assets?.privateKeyCapabilities || {})) {
    try {
      if (!canonicalBase64(record.pkcs8DerBase64)) throw new Error("private-key Base64 is not canonical");
      const der = Buffer.from(record.pkcs8DerBase64, "base64");
      const digest = createHash("sha256").update(der).digest("hex");
      if (seenKeys.has(digest)) throw new Error("duplicate private-key bytes");
      seenKeys.add(digest);
      const key = createPrivateKey({ key: der, format: "der", type: "pkcs8" });
      if (key.asymmetricKeyType !== "rsa" || key.asymmetricKeyDetails?.modulusLength !== 2048)
        throw new Error("capability key is not PKCS8 RSA-2048");
      const certificate = certificates.get(record.certificate);
      if (!certificate) throw new Error("capability names an unavailable certificate");
      const keySpki = createPublicKey(key).export({ format: "der", type: "spki" });
      const certificateSpki = certificate.x509.publicKey.export({ format: "der", type: "spki" });
      if (!Buffer.from(keySpki).equals(Buffer.from(certificateSpki)))
        throw new Error("capability key does not match its named certificate");
      capabilities.set(token, { certificate: record.certificate, key });
    } catch (error) {
      violations.push(`${at}.privateKeyCapabilities.${token}: ${error.message}`);
    }
  }
  return { violations, certificates, capabilities, validationTime };
}

const c20bViolationCode = (violation) => violation.match(/^([A-Z0-9-]+):/)?.[1] || "UNSTABLE";
// JavaScript strings can contain isolated UTF-16 surrogate code units. Node's
// UTF-8 encoder replaces them with U+FFFD, which is not an injective encoding
// of the authored JSON value. Every C20B derivation checks this predicate
// before Buffer, digest, percent-encoding, comparison, or wire construction.
function c20bUnicodeScalarString(value) {
  if (typeof value !== "string") return false;
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index++;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}

function c20bPortableMaterialize(value) {
  if (Array.isArray(value)) return value.map(c20bPortableMaterialize);
  if (value && typeof value === "object") {
    if (value.format === "openbindings.utf16-code-units@1"
      && Array.isArray(value.codeUnits)
      && Object.keys(value).length === 2)
      return String.fromCharCode(...value.codeUnits);
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, c20bPortableMaterialize(child)]));
  }
  return value;
}

function c20bNonScalarStringPaths(value, at = "$", found = []) {
  if (typeof value === "string") {
    if (!c20bUnicodeScalarString(value)) found.push(at);
  } else if (Array.isArray(value)) {
    value.forEach((child, index) => c20bNonScalarStringPaths(child, `${at}[${index}]`, found));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (!c20bUnicodeScalarString(key)) found.push(`${at}{key}`);
      c20bNonScalarStringPaths(child, `${at}.${key}`, found);
    }
  }
  return found;
}

function c20bInvalidPortableMutationPaths(value, at = "$", found = []) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => c20bInvalidPortableMutationPaths(child, `${at}[${index}]`, found));
  } else if (value && typeof value === "object") {
    if (value.format === "openbindings.utf16-code-units@1") {
      const materialized = Array.isArray(value.codeUnits) ? String.fromCharCode(...value.codeUnits) : "";
      if (c20bUnicodeScalarString(materialized)) found.push(at);
    } else {
      for (const [key, child] of Object.entries(value))
        c20bInvalidPortableMutationPaths(child, `${at}.${key}`, found);
    }
  }
  return found;
}

function c20bPathViolations(names, anchorNames, capabilityToken, currentTime, usage, assetState, at, disabledGuard) {
  const violations = [];
  const guardHits = new Set();
  let pathUsable = true;
  let pathEvidenceAvailable = true;
  const reject = (code, message) => {
    if (code === disabledGuard) {
      guardHits.add(code);
      return false;
    }
    violations.push(`${code}: ${at}: ${message}`);
    return true;
  };
  const failPath = (code, message) => {
    const active = reject(code, message);
    if (active) pathUsable = false;
    return active;
  };
  const done = () => {
    Object.defineProperty(violations, "guardHits", { value: guardHits });
    Object.defineProperty(violations, "pathUsable", { value: pathUsable });
    Object.defineProperty(violations, "pathEvidenceAvailable", { value: pathEvidenceAvailable });
    return violations;
  };
  if (names.length === 0) failPath("TLS-CHAIN-EMPTY", "prospective chain is empty");
  if (anchorNames.length !== 1) failPath("TLS-ANCHOR-CARDINALITY", "exactly one anchor is required");
  const chain = names.map((name) => assetState.certificates.get(name));
  const anchor = assetState.certificates.get(anchorNames[0]);
  if (chain.some((entry) => !entry)) failPath("TLS-ASSET-MISSING", "chain names an unavailable certificate asset");
  if (!anchor) failPath("TLS-ASSET-MISSING", "trust anchor names an unavailable certificate asset");
  if (!chain.length || chain.some((entry) => !entry) || !anchor) {
    pathEvidenceAvailable = false;
    return done();
  }
  if (new Set(names).size !== names.length)
    failPath("TLS-CHAIN-DUPLICATE", "duplicate/alternate path certificates are not admitted");
  if (names.includes(anchorNames[0]))
    failPath("TLS-ANCHOR-IN-CHAIN", "the configured trust anchor must be excluded from the prospective leaf-first chain");
  if (!anchor.x509.ca || !anchor.facts.ca || !anchor.facts.keyUsage.has("keyCertSign") || !anchor.x509.verify(anchor.x509.publicKey))
    failPath("TLS-ANCHOR-INVALID", "anchor is not a self-signed certificate-signing CA");
  const path = [...chain, anchor];
  let chainConnected = true;
  for (let index = 0; index < chain.length; index++) {
    const certificate = chain[index];
    const issuer = path[index + 1];
    if (certificate.x509.issuer !== issuer.x509.subject || !certificate.x509.verify(issuer.x509.publicKey)) {
      if (failPath("TLS-SIGNATURE", `chain[${index}] issuer/signature does not match the next path certificate`))
        chainConnected = false;
    }
  }
  if (chainConnected) {
    for (let index = 1; index < chain.length; index++) {
      const certificate = chain[index];
      if (!certificate.facts.ca)
        failPath("TLS-INTERMEDIATE-CA", `chain[${index}] is not a CA`);
      if (!certificate.facts.keyUsagePresent || !certificate.facts.keyUsage.has("keyCertSign"))
        failPath("TLS-INTERMEDIATE-KU", `chain[${index}] does not carry keyCertSign`);
    }
    // The configured trust anchor is input to validation, not a certificate in
    // the prospective certification path; its certificate pathLen is therefore
    // not applied as though it were another intermediate.
    for (let index = 1; index < chain.length; index++) {
      const issuer = path[index];
      const caCertificatesBelow = path.slice(1, index).filter((entry) => entry.facts.ca).length;
      if (issuer.facts.pathLength !== undefined && caCertificatesBelow > issuer.facts.pathLength)
        failPath("TLS-PATHLEN", `chain[${index}] Basic Constraints path length is exceeded`);
    }
  }
  for (const [index, certificate] of chain.entries()) {
    const notBefore = c20bEpochSeconds(certificate.x509.validFrom, `${at}.chain[${index}]`, violations);
    const notAfter = c20bEpochSeconds(certificate.x509.validTo, `${at}.chain[${index}]`, violations);
    if (currentTime < notBefore || currentTime > notAfter)
      failPath("TLS-VALIDITY", `chain[${index}] certificate is outside its inclusive validity interval`);
    if (certificate.facts.unsupportedCriticalExtensions.length)
      failPath("TLS-UNSUPPORTED-CRITICAL", `chain[${index}] carries unsupported critical extension ${certificate.facts.unsupportedCriticalExtensions.join(",")}`);
  }
  if (chainConnected) {
    c20bApplyNameConstraints(path, at, failPath);
    c20bApplyPolicyProcessing(path, at, failPath);
  }
  const leaf = chain[0];
  if (chainConnected) {
    if (leaf.facts.ca) failPath("TLS-LEAF-CA", "chain[0] leaf is a CA");
    if (leaf.facts.keyUsagePresent && !leaf.facts.keyUsage.has("digitalSignature"))
      failPath("TLS-KU-DIGITAL-SIGNATURE", "TLS 1.3 leaf Key Usage is present without digitalSignature");
    const requiredEku = usage === "server" ? "1.3.6.1.5.5.7.3.1" : "1.3.6.1.5.5.7.3.2";
    if (leaf.facts.extendedKeyUsage.size && !leaf.facts.extendedKeyUsage.has(requiredEku))
      failPath("TLS-EKU", `leaf extendedKeyUsage does not permit ${usage} authentication`);
  }
  const capability = assetState.capabilities.get(capabilityToken);
  if (!capability || capability.certificate !== names[0])
    failPath("TLS-KEY-MATCH", "opaque capability does not match the leaf public key");
  return done();
}

function c20bTlsViolations(subject, assetState, at, disabledGuard) {
  const violations = [];
  const guardHits = new Set();
  Object.defineProperty(violations, "guardHits", { value: guardHits });
  const reject = (code, message) => {
    if (code === disabledGuard) {
      guardHits.add(code);
      return false;
    }
    violations.push(`${code}: ${at}: ${message}`);
    return true;
  };
  let currentTime;
  try { currentTime = BigInt(subject.validationTimeUnixSeconds); }
  catch { return [`TLS-TIME-SYNTAX: ${at}: validationTimeUnixSeconds is not an exact integer`]; }
  const serverPathViolations = c20bPathViolations(
    subject.serverChain,
    subject.trustAnchors,
    subject.serverPrivateKeyCapability,
    currentTime,
    "server",
    assetState,
    `${at}.server`,
    disabledGuard
  );
  violations.push(...serverPathViolations);
  for (const code of serverPathViolations.guardHits || []) guardHits.add(code);
  const versionUsable = jsonValueEqual(subject.tlsVersionsOffered, ["1.3"]) && subject.serverTlsVersionSelected === "1.3";
  const alpnUsable = jsonValueEqual(subject.alpnOffered, ["http/1.1"]) && subject.serverAlpnSelected === "http/1.1";
  if (!versionUsable)
    reject("TLS-VERSION", "TLS version offer/selection is not exactly 1.3");
  if (!alpnUsable)
    reject("TLS-ALPN", "ALPN offer/selection is not exactly http/1.1");
  const leaf = assetState.certificates.get(subject.serverChain[0]);
  const referenceScalar = c20bUnicodeScalarString(subject.referenceIdentity?.value);
  const sniScalar = subject.observedSni === null || c20bUnicodeScalarString(subject.observedSni);
  if (!referenceScalar)
    reject("TLS-IDENTITY-SYNTAX", "reference identity is not a Unicode scalar string");
  else if (!sniScalar)
    reject(subject.referenceIdentity.kind === "dns" ? "TLS-SNI" : "TLS-IP-SNI", "observed SNI is not a Unicode scalar string");
  if ((!referenceScalar || !sniScalar) && !violations.length) return violations;
  if (leaf && serverPathViolations.pathUsable && referenceScalar && sniScalar) {
    if (subject.referenceIdentity.kind === "dns") {
      const reference = subject.referenceIdentity.value;
      if (!c20bCanonicalDnsName(reference)) reject("TLS-IDENTITY-SYNTAX", "DNS reference identity is not exact lowercase A-label spelling");
      const matched = leaf.facts.dnsNames.some((name) => {
        if (name.startsWith("*.") && name.indexOf("*", 1) === -1) {
          const suffix = name.slice(2);
          return reference.endsWith(`.${suffix}`) && reference.split(".").length === suffix.split(".").length + 1;
        }
        return name.toLowerCase() === reference.toLowerCase();
      });
      if (c20bCanonicalDnsName(reference) && !matched)
        reject("TLS-DNS-ID", "DNS-ID does not match a SAN dNSName under single-label wildcard rules");
      else if (c20bCanonicalDnsName(reference) && subject.observedSni !== reference)
        reject("TLS-SNI", "DNS reference requires exact lowercase SNI wire spelling");
    } else {
      const referenceBytes = c20bIpBytes(subject.referenceIdentity.value);
      if (!referenceBytes) reject("TLS-IDENTITY-SYNTAX", "IP reference identity is not canonical IPv4/IPv6 spelling");
      else if (!leaf.facts.ipAddressHex.includes(referenceBytes.toString("hex"))) reject("TLS-IP-ID", "IP-ID does not exactly match a SAN iPAddress");
      if (subject.observedSni !== null) reject("TLS-IP-SNI", "IP reference does not send SNI");
    }
  }
  const expectedAnchorDigest = subject.trustAnchors.length === 1
    ? assetState.certificates.get(subject.trustAnchors[0])?.digest
    : undefined;
  if (serverPathViolations.pathUsable && expectedAnchorDigest && subject.observed.trustAnchorSha256 !== expectedAnchorDigest)
    reject("TLS-OBS-ANCHOR", "observed trust-anchor digest does not derive from configured anchor");
  const serverDigests = subject.serverChain.map((name) => assetState.certificates.get(name)?.digest).filter(Boolean);
  if (serverPathViolations.pathUsable && !jsonValueEqual(subject.observed.serverChainSha256, serverDigests))
    reject("TLS-OBS-SERVER-CHAIN", "observed server-chain digests do not derive from exact leaf-first chain");
  const clientNames = subject.client?.chain || [];
  const clientDigests = clientNames.map((name) => assetState.certificates.get(name)?.digest).filter(Boolean);
  let clientPathViolations = [];
  if (subject.client?.required) {
    if (!subject.client.chain.length || !subject.client.privateKeyCapability)
      reject("TLS-MTLS-MISSING", "required client certificate/capability is absent");
    else {
      clientPathViolations = c20bPathViolations(
      subject.client.chain,
      subject.client.trustAnchors,
      subject.client.privateKeyCapability,
      currentTime,
      "client",
      assetState,
      `${at}.client`,
      disabledGuard
      );
      violations.push(...clientPathViolations);
      for (const code of clientPathViolations.guardHits || []) guardHits.add(code);
    }
  }
  const clientPathUsable = subject.client?.required ? clientPathViolations.pathUsable === true : true;
  if (!violations.some((entry) => entry.startsWith("TLS-MTLS-MISSING:")) && clientPathUsable && !jsonValueEqual(subject.observed.clientChainSha256, clientDigests))
    reject("TLS-OBS-CLIENT-CHAIN", "observed client-chain digests do not derive from exact presented chain");
  if (!violations.length && serverPathViolations.pathUsable && serverPathViolations.pathEvidenceAvailable && clientPathUsable
    && versionUsable && alpnUsable && referenceScalar && sniScalar) {
    const attemptedFacts = {
      transport: "tls",
      scheme: "https",
      authority: subject.referenceIdentity.value,
      referenceIdentity: subject.referenceIdentity.value,
      sni: subject.observedSni,
      alpnOffered: subject.alpnOffered,
      tlsVersionsOffered: subject.tlsVersionsOffered,
      trustAnchorSha256: subject.observed.trustAnchorSha256,
      validationTimeUnixSeconds: subject.validationTimeUnixSeconds,
    };
    const openedFacts = {
      transport: "tls",
      tlsVersion: subject.serverTlsVersionSelected,
      sni: subject.observedSni,
      alpnSelected: subject.serverAlpnSelected,
      peerCertificateChainSha256: subject.observed.serverChainSha256,
    };
    if (subject.observed.clientChainSha256.length) {
      attemptedFacts.clientCertificateChainSha256 = subject.observed.clientChainSha256;
      openedFacts.clientCertificateChainSha256 = subject.observed.clientChainSha256;
    }
    for (const [name, facts] of [["connection-attempted", attemptedFacts], ["connection-opened", openedFacts]]) {
      const normalized = { kind: "native", name, facts };
      const shape = ajvOk(HTTP_NATIVE_V2_SCHEMA, normalized);
      if (!shape.ok) reject("TLS-NATIVE-SHAPE", `derived ${name} evidence is not admitted by HTTP native revision 2`);
    }
  }
  return violations;
}

function c20bPercentEncode(value) {
  if (!c20bUnicodeScalarString(value)) return undefined;
  return [...Buffer.from(value, "utf8")].map((byte) =>
    (byte >= 0x41 && byte <= 0x5a)
      || (byte >= 0x61 && byte <= 0x7a)
      || (byte >= 0x30 && byte <= 0x39)
      || [0x2d, 0x2e, 0x5f, 0x7e].includes(byte)
      ? String.fromCharCode(byte)
      : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`
  ).join("");
}

function c20bCredentialWire(selection) {
  if (selection.kind === "x509") return undefined;
  const strings = selection.kind === "basic"
    ? [selection.username, selection.secret]
    : selection.kind.startsWith("api-key-")
      ? [selection.name, selection.secret]
      : [selection.secret];
  if (!strings.every(c20bUnicodeScalarString)) return undefined;
  if (selection.kind === "api-key-query")
    return { location: "query", name: c20bPercentEncode(selection.name), value: c20bPercentEncode(selection.secret) };
  if (selection.kind === "api-key-header")
    return { location: "header", name: selection.name, value: selection.secret };
  const value = selection.kind === "basic"
    ? `Basic ${Buffer.from(`${selection.username}:${selection.secret}`, "utf8").toString("base64")}`
    : `Bearer ${selection.secret}`;
  return { location: "header", name: "Authorization", value };
}

function c20bSecurityV3Violations(subject, assetState, at, disabledGuard) {
  const violations = [];
  const guardHits = new Set();
  Object.defineProperty(violations, "guardHits", { value: guardHits });
  const reject = (code, message) => {
    if (code === disabledGuard) {
      guardHits.add(code);
      return false;
    }
    violations.push(`${code}: ${at}: ${message}`);
    return true;
  };
  const token = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
  const fieldValue = (value) => typeof value === "string"
    && c20bUnicodeScalarString(value)
    && !/[\0\r\n\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);
  const safeApiFieldValue = (value) => fieldValue(value) && value.length > 0 && value === value.trim() && !value.startsWith("\t") && !value.endsWith("\t");
  const encodedComponent = /^(?:[A-Za-z0-9._~-]|%[0-9A-F]{2})*$/;
  const safeEncoded = (value, allowEmpty) => {
    if (typeof value !== "string" || (!allowEmpty && !value) || !encodedComponent.test(value)) return false;
    try {
      const decoded = decodeURIComponent(value);
      return c20bUnicodeScalarString(decoded)
        && !/[\0-\x1f\x7f]/.test(decoded)
        && c20bPercentEncode(decoded) === value;
    } catch { return false; }
  };
  const decodableComponent = (value) => {
    if (!c20bUnicodeScalarString(value)) return undefined;
    try {
      const decoded = decodeURIComponent(value);
      return c20bUnicodeScalarString(decoded) && !/[\0-\x1f\x7f]/.test(decoded) ? decoded : undefined;
    } catch { return undefined; }
  };
  const byteCompare = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
  const asciiLower = (value) => value.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
  const reserved = new Set(["host", "content-length", "content-type", "transfer-encoding", "trailer", "connection", "expect", "authorization"]);
  const alternatives = subject.alternatives || { server: [], operation: [] };
  const inputs = subject.inputs || { artifact: { query: [], headers: [] }, caller: { query: [], headers: [] }, credentials: [] };
  const selections = inputs.credentials || [];
  const authorityScalar = c20bUnicodeScalarString(subject.dispatch?.authority);
  const pathScalar = c20bUnicodeScalarString(subject.dispatch?.path);
  const authorityGrammar = authorityScalar && subject.dispatch.authority.length > 0
    && fieldValue(subject.dispatch.authority) && !/[\s/?#]/.test(subject.dispatch.authority);
  const pathGrammar = pathScalar && !/[\0-\x1f\x7f]/.test(subject.dispatch.path);
  if (!authorityGrammar)
    reject("SEC-AUTHORITY-GRAMMAR", "dispatch authority cannot form one safe Host field value");
  if (!pathGrammar)
    reject("SEC-ORIGIN-GRAMMAR", "dispatch path is not a Unicode-scalar, control-free origin-form path");

  for (const layer of ["server", "operation"]) {
    for (const alternative of alternatives[layer] || []) {
      if (!alternative?.name) continue;
      const code = alternative.kind === "api-key-header" ? "SEC-HEADER-GRAMMAR" : "SEC-QUERY-GRAMMAR";
      if (!c20bUnicodeScalarString(alternative.name))
        reject(code, `${layer} alternative name is not a Unicode scalar string`);
    }
  }
  for (const layer of ["server", "operation"]) {
    const surviving = (alternatives[layer] || []).filter((entry) => entry !== null);
    const selected = selections.filter((entry) => entry.securityLayer === layer);
    if (surviving.length && selected.length !== 1)
      reject("SEC-LAYER-CARDINALITY", `${layer} layer has ${surviving.length} surviving alternatives but ${selected.length} selections`);
    if (!surviving.length && selected.length)
      reject("SEC-LAYER-CARDINALITY", `${layer} layer is empty but has a selection`);
  }

  let queryDerivable = pathScalar;
  let headerDerivable = authorityScalar;
  let nativeShapeDerivable = authorityGrammar && pathGrammar;
  for (const selection of selections) {
    if (selection.kind === "basic") {
      if (!c20bUnicodeScalarString(selection.username) || !/^[\x20-\x7e]*$/.test(selection.username) || selection.username.includes(":"))
        reject("SEC-BASIC-USERNAME", "Basic username must be printable ASCII without controls, DEL, or colon");
      if (!c20bUnicodeScalarString(selection.secret) || !/^[\x20-\x7e]*$/.test(selection.secret))
        reject("SEC-BASIC-PASSWORD", "Basic password must be printable ASCII without controls or DEL");
      if (![selection.username, selection.secret].every(c20bUnicodeScalarString)) headerDerivable = false;
    }
    if (["bearer", "oauth-bearer", "oidc-bearer"].includes(selection.kind)) {
      if (!c20bUnicodeScalarString(selection.secret) || !/^[A-Za-z0-9\-._~+/]+={0,}$/.test(selection.secret))
        reject("SEC-BEARER-TOKEN", "Bearer/OAuth/OIDC value is not exact b64token syntax");
      if (!c20bUnicodeScalarString(selection.secret)) headerDerivable = false;
    }
    if (selection.kind === "api-key-header") {
      const scalar = [selection.name, selection.secret].every(c20bUnicodeScalarString);
      const grammar = scalar && token.test(selection.name) && safeApiFieldValue(selection.secret);
      nativeShapeDerivable &&= grammar;
      if (!grammar)
        reject("SEC-HEADER-GRAMMAR", "header apiKey name/value is not a safe single field value");
      if (scalar && reserved.has(asciiLower(selection.name))) reject("SEC-RESERVED-HEADER", "header apiKey conflicts with an engine-controlled field");
      if (!scalar) headerDerivable = false;
    }
    if (selection.kind === "api-key-query") {
      const scalar = [selection.name, selection.secret].every(c20bUnicodeScalarString);
      if (!scalar || !safeEncoded(c20bPercentEncode(selection.name), false) || /[\0-\x1f\x7f]/.test(selection.name + selection.secret))
        reject("SEC-QUERY-GRAMMAR", "query apiKey name/value is unsafe or not a Unicode scalar string");
      if (!scalar) queryDerivable = false;
    }
  }

  for (const selection of selections) {
    const alternative = alternatives[selection.securityLayer]?.[selection.alternativeIndex];
    const namesComparable = alternative?.name === undefined || c20bUnicodeScalarString(selection.name);
    if (namesComparable && (!alternative || alternative.kind !== selection.kind || (alternative.name ?? null) !== (selection.name ?? null)))
      reject("SEC-ALTERNATIVE-IDENTITY", "selection does not identify exact original surviving alternative index");
  }

  const x509Selections = selections.filter((entry) => entry.kind === "x509");
  if (inputs.tlsClientCertificate && !x509Selections.length)
    reject("SEC-X509-SURPLUS", "TLS client certificate configuration requires an exact selected X509 alternative");
  if (x509Selections.length) {
    if (subject.dispatch.scheme !== "https") reject("SEC-X509-HTTPS", "X509 selection requires HTTPS");
    const tls = inputs.tlsClientCertificate;
    const leafName = tls?.chain?.[0];
    const capability = assetState.capabilities.get(tls?.privateKeyCapability);
    const pathViolations = tls?.chain?.length && tls?.trustAnchors?.length
      ? c20bPathViolations(tls.chain, tls.trustAnchors, tls.privateKeyCapability, assetState.validationTime, "client", assetState, `${at}.inputs.tlsClientCertificate`, disabledGuard)
      : ["missing"];
    for (const code of pathViolations.guardHits || []) guardHits.add(code);
    if (!tls?.chain?.length || !capability || capability.certificate !== leafName || pathViolations.length
      || !jsonValueEqual(tls.chainSha256, tls.chain.map((name) => assetState.certificates.get(name)?.digest).filter(Boolean)))
      reject("SEC-X509-MTLS", "X509 selection lacks matching client certificate capability/chain digest evidence");
  }

  const queryEntries = [];
  const headerEntries = authorityScalar
    ? [{ name: "Host", lowerName: "host", record: { kind: "value", name: "Host", value: subject.dispatch.authority }, wireValue: subject.dispatch.authority }]
    : [];
  for (const source of ["artifact", "caller"]) {
    for (const entry of inputs[source]?.query || []) {
      const scalar = [entry.nameEncoded, entry.valueEncoded].every(c20bUnicodeScalarString);
      const decodedName = decodableComponent(entry.nameEncoded);
      const decodedValue = decodableComponent(entry.valueEncoded);
      if (!scalar || decodedName === undefined || decodedValue === undefined
        || !safeEncoded(entry.nameEncoded, false) || !safeEncoded(entry.valueEncoded, true))
        reject("SEC-QUERY-GRAMMAR", `${source} query contribution is not canonical safe percent-encoded UTF-8`);
      if (!scalar || decodedName === undefined || decodedValue === undefined) queryDerivable = false;
      else queryEntries.push({ name: entry.nameEncoded, decodedName,
        record: { kind: "value", nameEncoded: entry.nameEncoded, valueEncoded: entry.valueEncoded }, wireValue: entry.valueEncoded });
    }
    for (const entry of inputs[source]?.headers || []) {
      const scalar = [entry.name, entry.value].every(c20bUnicodeScalarString);
      const lowerName = scalar ? asciiLower(entry.name) : "";
      const grammar = scalar && token.test(entry.name) && fieldValue(entry.value);
      nativeShapeDerivable &&= grammar;
      if (!grammar)
        reject("SEC-HEADER-GRAMMAR", `${source} header is not a valid field`);
      if (!scalar) headerDerivable = false;
      if (scalar && reserved.has(lowerName)) reject("SEC-RESERVED-HEADER", `${source} header '${entry.name}' is engine-controlled`);
      if (scalar) headerEntries.push({ name: entry.name, lowerName, record: { kind: "value", name: entry.name, value: entry.value }, wireValue: entry.value });
    }
  }
  for (const selection of selections) {
    const wire = c20bCredentialWire(selection);
    if (!wire) {
      if (selection.kind !== "x509") {
        if (selection.kind === "api-key-query") queryDerivable = false;
        else headerDerivable = false;
      }
      continue;
    }
    if (wire.location === "query") {
      const component = `${wire.name}=${wire.value}`;
      queryEntries.push({
        name: wire.name, decodedName: selection.name, wireValue: wire.value,
        record: { kind: "credential", securityLayer: selection.securityLayer, alternativeIndex: selection.alternativeIndex,
          nameEncoded: wire.name, valueSha256: createHash("sha256").update(wire.value, "utf8").digest("hex"),
          componentSha256: createHash("sha256").update(component, "utf8").digest("hex") },
      });
    } else {
      const lowerName = asciiLower(wire.name);
      const fieldLine = `${wire.name}: ${wire.value}\r\n`;
      headerEntries.push({
        name: wire.name, lowerName, wireValue: wire.value,
        record: { kind: "credential", securityLayer: selection.securityLayer, alternativeIndex: selection.alternativeIndex,
          name: wire.name, valueSha256: createHash("sha256").update(wire.value, "utf8").digest("hex"),
          fieldLineSha256: createHash("sha256").update(fieldLine, "utf8").digest("hex") },
      });
    }
  }
  if (queryDerivable) {
    queryEntries.sort((left, right) => byteCompare(left.decodedName, right.decodedName));
    for (let index = 1; index < queryEntries.length; index++) {
      if (queryEntries[index - 1].decodedName === queryEntries[index].decodedName
        || queryEntries[index - 1].name === queryEntries[index].name)
        reject("SEC-DESTINATION-UNIQUE", "duplicate decoded or canonical emitted query destination across public/credential inputs");
    }
    const query = queryEntries.map((entry) => entry.record);
    if (!jsonValueEqual(subject.dispatch.queryContributions, query))
      reject("SEC-QUERY-EVIDENCE", "query contributions are not globally sorted by decoded exact-name UTF-8 bytes");
    if (pathScalar) {
      const originForm = queryEntries.length
        ? `${subject.dispatch.path}?${queryEntries.map((entry) => `${entry.name}=${entry.wireValue}`).join("&")}`
        : subject.dispatch.path;
      if (subject.dispatch.originFormSha256 !== createHash("sha256").update(originForm, "utf8").digest("hex"))
        reject("SEC-ORIGIN-DIGEST", "origin-form digest/preimage differs from globally sorted query");
    }
  }
  if (headerDerivable) {
    headerEntries.sort((left, right) => left.lowerName === "host" ? -1 : right.lowerName === "host" ? 1
      : byteCompare(left.lowerName, right.lowerName) || byteCompare(left.name, right.name));
    for (let index = 1; index < headerEntries.length; index++) {
      if (headerEntries[index - 1].lowerName === headerEntries[index].lowerName)
        reject("SEC-DESTINATION-UNIQUE", "duplicate header destination across public/credential inputs");
    }
    const headers = headerEntries.map((entry) => entry.record);
    if (!jsonValueEqual(subject.dispatch.headerContributions, headers))
      reject("SEC-HEADER-EVIDENCE", "headers are not Host-first/global ASCII-name byte-sorted derived evidence");
    const headerBlock = `${headerEntries.map((entry) => `${entry.name}: ${entry.wireValue}\r\n`).join("")}\r\n`;
    if (subject.dispatch.headerBlockSha256 !== createHash("sha256").update(headerBlock, "utf8").digest("hex"))
      reject("SEC-HEADER-BLOCK-DIGEST", "header-block digest/preimage differs from Host-first sorted headers");
  }
  if (nativeShapeDerivable && queryDerivable && headerDerivable) {
    const normalized = { kind: "native", name: "dispatch", facts: subject.dispatch };
    const shape = ajvOk(HTTP_NATIVE_V2_SCHEMA, normalized);
    if (!shape.ok) reject("SEC-NATIVE-SHAPE", "derived dispatch is not admitted by HTTP native revision 2");
  }
  return violations;
}

function c20bResponseViolations(subject, at, disabledGuard) {
  const violations = [];
  const guardHits = new Set();
  Object.defineProperty(violations, "guardHits", { value: guardHits });
  const reject = (code, message) => {
    if (code === disabledGuard) {
      guardHits.add(code);
      return false;
    }
    violations.push(`${code}: ${at}: ${message}`);
    return true;
  };
  const token = HTTP_TOKEN_RE;
  const fieldValue = (value) => typeof value === "string"
    && c20bUnicodeScalarString(value)
    && !/[\0\r\n\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);
  const admittedMethods = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
  if (!admittedMethods.has(subject.method)) reject("HTTP-METHOD", "method is not one exact admitted uppercase token");
  let final;
  let finalIndex = -1;
  let peerTerminal = false;
  const bodies = [];
  const interim = [];
  let finalConnectionClose = false;
  let finalConnectionAvailable = true;
  const responseHeadFieldFacts = new Map();
  let bodyEventCount = 0;
  let bodySequenceAvailable = true;
  let framingEvaluable = true;
  let replyDispositionEvaluable = true;
  for (const [index, event] of subject.events.entries()) {
    const followsPeerTerminal = peerTerminal;
    let rawEventValid = true;
    let envelopeBlocksState = false;
    let facts;
    let contentLengthChecksUsable = true;
    let connectionChecksUsable = true;
    let statusFramingUsable = true;
    let bodyBeforeFinalActive = false;

    // Envelope chronology is decidable from kind/status/index and the prior
    // accepted state. It must remain visible even when this event's own bytes
    // or fields are malformed, but an after-terminal event never advances it.
    if (followsPeerTerminal)
      reject("HTTP-PEER-AFTER-TERMINAL", `peer event ${index} follows terminal disconnect or protocol switch`);
    if (event.kind === "head") {
      const statusValid = Number.isInteger(event.status) && event.status >= 100 && event.status <= 599;
      if (!statusValid) {
        reject("HTTP-STATUS", `response head ${index} has a status outside the integer 100..599 range`);
        rawEventValid = false;
      } else if (event.status === 101) {
        reject("HTTP-STATUS-101", `response head ${index} status 101 is a protocol failure`);
      } else if (event.status < 200 && final) {
        reject("HTTP-INTERIM-AFTER-FINAL", `interim response ${event.status} follows final response`);
        envelopeBlocksState = true;
      } else if (event.status >= 200 && final) {
        reject("HTTP-MULTIPLE-FINAL", `response head ${index} is a second final response`);
        envelopeBlocksState = true;
      }

      facts = event.headers.map((header) => {
        const nameAvailable = typeof header.name === "string" && c20bUnicodeScalarString(header.name) && token.test(header.name);
        const valueAvailable = fieldValue(header.value);
        const grammar = nameAvailable && valueAvailable;
        rawEventValid &&= grammar;
        if (!grammar)
          reject("HTTP-FIELD-GRAMMAR", `response head ${index} contains an invalid field name/value`);
        return { header, nameAvailable, valueAvailable, nameLower: nameAvailable ? header.name.toLowerCase() : undefined };
      });
      const named = (name) => facts.filter((fact) => fact.nameAvailable && fact.nameLower === name);
      const contentLengthFacts = named("content-length");
      const contentLengthValuesAvailable = contentLengthFacts.every((fact) => fact.valueAvailable);
      const contentLengthSyntaxValid = contentLengthFacts
        .filter((fact) => fact.valueAvailable)
        .every((fact) => /^(?:0|[1-9][0-9]*)$/.test(fact.header.value));
      if (contentLengthFacts.length > 1
        && reject("HTTP-CONTENT-LENGTH-DUPLICATE", `response head ${index} has duplicate Content-Length`))
        contentLengthChecksUsable = false;
      if (!contentLengthSyntaxValid
        && reject("HTTP-CONTENT-LENGTH-SYNTAX", `response head ${index} has a noncanonical Content-Length decimal`))
        contentLengthChecksUsable = false;
      if (named("transfer-encoding").length) reject("HTTP-TRANSFER-ENCODING", `response head ${index} uses Transfer-Encoding`);
      if (named("trailer").length) reject("HTTP-TRAILER", `response head ${index} uses Trailer`);
      if (named("content-encoding").length) reject("HTTP-CONTENT-ENCODING", `response head ${index} uses Content-Encoding`);

      if (statusValid && event.status !== 101 && event.status < 200 && contentLengthFacts.length)
        reject("HTTP-INTERIM-CONTENT-LENGTH", `interim response ${event.status} carries Content-Length`);
      const contentTypeFacts = named("content-type");
      if (contentTypeFacts.length > 1)
        reject("HTTP-CONTENT-TYPE-DUPLICATE", `response head ${index} has duplicate Content-Type`);
      if (contentTypeFacts.filter((fact) => fact.valueAvailable)
        .some((fact) => !httpMediaTypeFieldValue(fact.header.value)))
        reject("HTTP-CONTENT-TYPE-GRAMMAR", `response head ${index} has a malformed Content-Type field value`);

      const connectionFacts = named("connection");
      const validConnectionFields = connectionFacts.filter((fact) => fact.valueAvailable);
      const connectionValid = connectionFacts.every((fact) => fact.valueAvailable)
        && connectionFacts.length <= 1
        && !validConnectionFields.some((fact) => fact.header.value.trim().toLowerCase() !== "close");
      if (!connectionValid
        && reject("HTTP-CONNECTION-FIELD", `response head ${index} has duplicate or non-close Connection semantics`))
        connectionChecksUsable = false;
      const connectionClose = connectionValid && validConnectionFields.some((fact) => fact.header.value.split(",")
        .some((part) => part.trim().toLowerCase() === "close"));

      let contentLength;
      if (contentLengthFacts.length === 1 && contentLengthValuesAvailable && contentLengthSyntaxValid)
        contentLength = BigInt(contentLengthFacts[0].header.value);
      if (statusValid && event.status === 204 && contentLengthFacts.length
        && reject("HTTP-204-CONTENT-LENGTH", `response head ${index} status 204 forbids Content-Length`))
        statusFramingUsable = false;
      if (statusValid && event.status === 205
        && (contentLengthFacts.length !== 1 || contentLength !== 0n)
        && reject("HTTP-205-CONTENT-LENGTH", `response head ${index} status 205 requires exactly Content-Length: 0`))
        statusFramingUsable = false;

      responseHeadFieldFacts.set(event, {
        facts,
        contentLengthFacts,
        contentLengthValuesAvailable,
        contentLengthSyntaxValid,
        contentLengthChecksUsable,
        contentLength,
        connectionValid,
        connectionChecksUsable,
        connectionClose,
        statusFramingUsable,
      });
    } else if (event.kind === "body") {
      if (!final) {
        bodyBeforeFinalActive = reject("HTTP-BODY-BEFORE-FINAL", `body event ${index} precedes final response`);
        if (bodyBeforeFinalActive) bodySequenceAvailable = false;
      }
      rawEventValid = canonicalBase64(event.dataBase64);
      if (!rawEventValid) reject("HTTP-BODY-BASE64", `body event ${index} is not canonical Base64`);
    }

    // Locally malformed and post-terminal events are evidence only. Neither
    // can become a response head, append body octets, or move terminal state.
    if (followsPeerTerminal || !rawEventValid || envelopeBlocksState) continue;
    if (event.kind === "head") {
      if (event.status === 101) {
        peerTerminal = true;
      } else if (event.status < 200) {
        interim.push(event);
      } else if (event.status >= 200) {
        final = event;
        finalIndex = index;
      }
    } else if (event.kind === "body") {
      if (bodyBeforeFinalActive) continue;
      bodyEventCount += 1;
      bodies.push(Buffer.from(event.dataBase64, "base64"));
    } else if (event.kind === "disconnect") {
      peerTerminal = true;
    }
  }
  const nativeHasCancellation = subject.native.some((event) => event.name === "cancellation-propagated");
  if (subject.events.length && !final && !peerTerminal && !nativeHasCancellation) {
    reject("HTTP-PEER-INCOMPLETE", "peer script lacks final response, terminal disconnect, or explicit local cancellation");
  }
  if (!subject.events.length && !subject.native.some((event) => event.name === "cancellation-propagated")) {
    reject("HTTP-PEER-VACUOUS", "peer script is empty outside a stage-specific local cancellation");
  }
  const bodyBytes = Buffer.concat(bodies);
  const outputRequired = Boolean(final && final.status >= 200 && final.status <= 299 && subject.replySelected);
  if (final) {
    const finalFieldState = responseHeadFieldFacts.get(final) || {
      facts: [],
      contentLengthFacts: [],
      contentLengthValuesAvailable: true,
      contentLengthChecksUsable: true,
      contentLengthSyntaxValid: true,
      contentLength: undefined,
      connectionValid: true,
      connectionChecksUsable: true,
      connectionClose: false,
      statusFramingUsable: true,
    };
    const { contentLengthFacts, contentLengthValuesAvailable, contentLength } = finalFieldState;
    finalConnectionAvailable = finalFieldState.connectionValid;
    finalConnectionClose = finalFieldState.connectionClose;
    framingEvaluable &&= finalFieldState.contentLengthChecksUsable
      && finalFieldState.connectionChecksUsable
      && finalFieldState.statusFramingUsable;
    if (!contentLengthValuesAvailable) framingEvaluable = false;
    const payloadForbidden = subject.method === "HEAD" || [204, 205, 304].includes(final.status);
    if (payloadForbidden) {
      if (bodySequenceAvailable && bodyBytes.length) {
        if (reject("HTTP-PAYLOAD-FORBIDDEN", "payload bytes are forbidden for HEAD/204/205/304"))
          replyDispositionEvaluable = false;
      }
    } else {
      if (contentLength === undefined && contentLengthFacts.length === 0) {
        if (reject(finalConnectionClose ? "HTTP-CLOSE-DELIMITED" : "HTTP-CONTENT-LENGTH-MISSING", finalConnectionClose
          ? "Connection: close cannot delimit a response without exact Content-Length"
          : "ordinary response requires one Content-Length, including zero")) framingEvaluable = false;
      }
      const octets = BigInt(bodyBytes.length);
      // A response-stage cancellation may cut off a correctly declared body;
      // absence of the remaining octets is then the cancellation outcome, not
      // a framing contradiction.  All locally decidable head predicates still
      // ran in the prepass above.
      if (!nativeHasCancellation && bodySequenceAvailable && contentLength !== undefined && contentLength !== octets) {
        if (reject("HTTP-CONTENT-LENGTH-MISMATCH", "Content-Length does not match observed body octets"))
          framingEvaluable = false;
      }
    }
    const successful = final.status >= 200 && final.status <= 299;
    if (!successful && subject.replySelected) reject("HTTP-REPLY-STATUS", "non-2xx final response cannot select a Reply alternative");
    if (bodySequenceAvailable && successful && !subject.replySelected && bodyBytes.length) {
      if (reject("HTTP-NO-REPLY-BODY", "successful no-Reply response carries a nonempty body"))
        replyDispositionEvaluable = false;
    }
  }
  const native = subject.native;
  const names = native.map((event) => event.name);
  if (!native.length) reject("HTTP-NATIVE-VACUOUS", "native trace is empty");
  const count = (name) => names.filter((candidate) => candidate === name).length;
  const terminalIndexes = names.map((name, index) => name === "terminal" ? index : -1).filter((index) => index >= 0);
  const terminalCardinalityValid = terminalIndexes.length === 1;
  const terminalLastValid = terminalCardinalityValid && terminalIndexes[0] === native.length - 1;
  if (native.length) {
    if (terminalIndexes.length !== 1) {
      reject("HTTP-TERMINAL-CARDINALITY", "native trace requires exactly one terminal outcome");
    } else if (!terminalLastValid) {
      reject("HTTP-NATIVE-AFTER-TERMINAL", "native activity follows terminal outcome");
    }
  }
  const cancellation = native.filter((event) => event.name === "cancellation-propagated");
  const peerDisconnectIndex = subject.events.findIndex((event) => event.kind === "disconnect");
  const observedPeerDisconnect = peerDisconnectIndex < 0 ? undefined : subject.events[peerDisconnectIndex];
  const disconnectAfterFinal = Boolean(observedPeerDisconnect && final && peerDisconnectIndex > finalIndex);
  const shouldError = Boolean(cancellation.length || (peerTerminal && !disconnectAfterFinal) || (!final && subject.events.length));
  const terminal = terminalCardinalityValid ? native[terminalIndexes[0]] : undefined;
  if (terminal && terminal.outcome !== (shouldError ? "error" : "complete"))
    reject("HTTP-TERMINAL-OUTCOME", "terminal outcome does not match lifecycle disposition");
  if (cancellation.length > 1) reject("HTTP-CANCELLATION-CARDINALITY", "cancellation propagation occurs more than once");
  if (cancellation.length && peerTerminal)
    reject("HTTP-TERMINAL-CAUSE-CARDINALITY", "local cancellation and peer terminal stimulus are mutually exclusive without a represented cross-stream order");
  const peerDisconnect = cancellation.length ? undefined : observedPeerDisconnect;
  const peerCloseValid = !(peerTerminal && !final && !cancellation.length) || count("connection-closed") === 1;
  if (!peerCloseValid)
    reject("HTTP-CONNECTION-CLOSE", "peer disconnect/protocol failure requires one connection-closed fact");
  const finalCloseValid = !disconnectAfterFinal || count("connection-closed") === 1;
  if (!finalCloseValid)
    reject("HTTP-CONNECTION-CLOSE", "disconnect after completed framing requires exactly one connection-closed fact without erasing output");

  const attemptValid = count("connection-attempted") === 1 && names[0] === "connection-attempted";
  if (native.length && !attemptValid)
    reject("HTTP-ATTEMPT-CARDINALITY", "one connection attempt must begin the lifecycle; implicit retry is forbidden");
  const opened = names.indexOf("connection-opened");
  const started = names.indexOf("request-started");
  const dispatched = names.indexOf("dispatch");
  let peerDisconnectStageValid = true;
  if (peerDisconnect) {
    const preceding = subject.events.slice(0, peerDisconnectIndex);
    if (disconnectAfterFinal) {
      if (peerDisconnect.stage !== "terminal") {
        peerDisconnectStageValid = false;
        reject("HTTP-DISCONNECT-STAGE", "disconnect after a completely framed final response has terminal stage");
      }
    } else if (peerDisconnect.stage === "response") {
      if (final || preceding.some((event) => event.kind !== "head" || event.status < 100 || event.status >= 200 || event.status === 101)) {
        peerDisconnectStageValid = false;
        reject("HTTP-DISCONNECT-STAGE", "response-stage disconnect may follow only ordered interim heads before a final response");
      }
    } else if (peerDisconnect.stage === "terminal" || preceding.length) {
      peerDisconnectStageValid = false;
      reject("HTTP-DISCONNECT-STAGE", "pre-response disconnect stage conflicts with its peer-event position");
    }
  }
  const expectedPrefixForStage = (stage) => stage === "tls"
    ? ["connection-attempted"]
    : stage === "before-request"
      ? ["connection-attempted", "connection-opened"]
      : stage === "request"
        ? ["connection-attempted", "connection-opened", "request-started"]
        : ["connection-attempted", "connection-opened", "request-started", "dispatch",
          ...interim.map(() => "acknowledgement"), ...(final ? ["acknowledgement"] : [])];
  let branchStageValid = true;
  if (cancellation.length === 1 && !peerTerminal) {
    const cancelIndex = names.indexOf("cancellation-propagated");
    const stage = cancellation[0].stage;
    const expectedPrefix = expectedPrefixForStage(stage);
    const cancellationStageValid = jsonValueEqual(names.slice(0, cancelIndex), expectedPrefix);
    if (!cancellationStageValid) reject("HTTP-CANCELLATION-STAGE", "cancellation is not between the exact stage boundary events");
    const expectedCancellationCloses = stage === "tls" && subject.preOpenCancellationRequiresClose === false ? [0] : [1];
    const cancellationCloseValid = expectedCancellationCloses.includes(count("connection-closed"))
      && (count("connection-closed") === 0 || names[cancelIndex + 1] === "connection-closed");
    if (!cancellationCloseValid)
      reject("HTTP-CANCELLATION-CLOSE", "cancellation close cardinality does not match the mapper's concrete transport-open boundary");
    const afterCancelStart = cancelIndex + 1 + count("connection-closed");
    const activityAfterCancel = cancellationCloseValid && native.slice(afterCancelStart, terminalCardinalityValid ? terminalIndexes[0] : undefined).length > 0;
    if (activityAfterCancel) reject("HTTP-ACTIVITY-AFTER-CANCEL", "protocol/application activity follows cancellation close");
    branchStageValid = cancellationStageValid && cancellationCloseValid && !activityAfterCancel;
  } else if (peerDisconnect && !final && peerDisconnectStageValid) {
    const closeIndex = names.indexOf("connection-closed");
    const expectedPrefix = expectedPrefixForStage(peerDisconnect.stage);
    const disconnectStageValid = jsonValueEqual(names.slice(0, closeIndex), expectedPrefix);
    if (!disconnectStageValid) reject("HTTP-DISCONNECT-STAGE", "disconnect does not occur at its declared causal stage");
    const disconnectCloseValid = count("connection-closed") === 1;
    if (!disconnectCloseValid) reject("HTTP-CONNECTION-CLOSE", "peer disconnect requires exactly one connection-closed fact");
    const activityAfterDisconnect = disconnectCloseValid
      && native.slice(closeIndex + 1, terminalCardinalityValid ? terminalIndexes[0] : undefined).length > 0;
    if (activityAfterDisconnect) reject("HTTP-ACTIVITY-AFTER-DISCONNECT", "protocol/application activity follows peer disconnect close");
    branchStageValid = disconnectStageValid && disconnectCloseValid && !activityAfterDisconnect;
  } else if (native.length && !cancellation.length && (!peerDisconnect || final)) {
    const openValid = count("connection-opened") === 1
      && opened >= 0
      && (started < 0 || started === opened + 1)
      && (dispatched < 0 || opened < dispatched);
    if (!openValid) reject("HTTP-OPEN-ORDER", "ordinary trace requires one connection-opened before request activity");
    const requestStartValid = openValid && count("request-started") === 1 && started === opened + 1;
    if (openValid && !requestStartValid) reject("HTTP-REQUEST-START", "ordinary trace requires one request-started immediately after open");
    const dispatchValid = requestStartValid && count("dispatch") === 1 && dispatched === started + 1;
    if (requestStartValid && !dispatchValid) reject("HTTP-DISPATCH-ORDER", "ordinary trace requires one dispatch immediately after request-started");
    branchStageValid = dispatchValid;
  }
  const acknowledgements = native.filter((event) => event.name === "acknowledgement");
  const expectedAcks = [...interim.map((head) => ({ phase: "interim", status: head.status })), ...(final ? [{ phase: "final", status: final.status }] : [])];
  const acknowledgementsEvaluable = !native.length
    || jsonValueEqual(acknowledgements.map(({ phase, status }) => ({ phase, status })), expectedAcks);
  if (native.length && !acknowledgementsEvaluable)
    reject("HTTP-ACK-CORRESPONDENCE", "acknowledgements do not exactly follow peer interim/final heads");
  const deliveries = native.filter((event) => event.name === "delivery");
  const payloadForbidden = Boolean(final && (subject.method === "HEAD" || [204, 205, 304].includes(final.status)));
  const expectedDelivery = outputRequired && !payloadForbidden && bodyEventCount > 0 ? 1 : 0;
  const deliveryCardinalityValid = !bodySequenceAvailable || deliveries.length === expectedDelivery;
  if (native.length && bodySequenceAvailable && !deliveryCardinalityValid)
    reject("HTTP-DELIVERY-CARDINALITY", "delivery cardinality does not match completed framed body");
  if (bodySequenceAvailable && deliveryCardinalityValid && expectedDelivery === 1 && deliveries.length === 1) {
    const digest = createHash("sha256").update(bodyBytes).digest("hex");
    if (deliveries[0].octetLengthDecimal !== String(bodyBytes.length) || deliveries[0].bodySha256 !== digest)
      reject("HTTP-DELIVERY-EVIDENCE", "delivery does not derive from complete framed body bytes");
  }
  const outputCardinalityValid = count("output") === (outputRequired ? 1 : 0);
  if (native.length && !outputCardinalityValid)
    reject("HTTP-OUTPUT-CARDINALITY", "application output cardinality does not match selected Reply/no-content disposition");
  const deliveryIndex = names.indexOf("delivery");
  const outputIndex = names.indexOf("output");
  const finalAckIndex = native.findIndex((event) => event.name === "acknowledgement" && event.phase === "final");
  const deliveryOrderValid = !(deliveryIndex >= 0 && finalAckIndex >= 0 && deliveryIndex <= finalAckIndex);
  if (!deliveryOrderValid) reject("HTTP-DELIVERY-ORDER", "delivery precedes final acknowledgement/body completion");
  const outputOrderValid = !(outputIndex >= 0 && outputIndex <= Math.max(finalAckIndex, deliveryIndex));
  if (!outputOrderValid) reject("HTTP-OUTPUT-ORDER", "output precedes final acknowledgement/delivery");
  const suffixInputsValid = terminalCardinalityValid && terminalLastValid && attemptValid && branchStageValid
    && acknowledgementsEvaluable && framingEvaluable && replyDispositionEvaluable && bodySequenceAvailable
    && finalConnectionAvailable && deliveryCardinalityValid && outputCardinalityValid
    && deliveryOrderValid && outputOrderValid && peerDisconnectStageValid && peerCloseValid && finalCloseValid;
  if (!cancellation.length && final && suffixInputsValid) {
    const expectedNames = [
      "connection-attempted", "connection-opened", "request-started", "dispatch",
      ...expectedAcks.map(() => "acknowledgement"),
      ...(expectedDelivery ? ["delivery"] : []),
      ...(outputRequired ? ["output"] : []),
      ...(finalConnectionClose || disconnectAfterFinal ? ["connection-closed"] : []),
      "terminal",
    ];
    if (!jsonValueEqual(names, expectedNames)) reject("HTTP-NATIVE-SUFFIX", "native lifecycle contains an unexplained, omitted, or misordered post-dispatch fact");
  }
  return violations;
}

function mqttPacketFlowViolations(expected, at, protocolVersion, runtime = {}) {
  const violations = [];
  const outbound = new Map();
  const inbound = new Map();
  const pendingOpened = [];
  const pendingClosed = [];
  const activeSubscriptions = new Map();
  const subscriptionGenerationCounters = new Map();
  let subscriptionCorrelationStates = [{ frontiers: new Map(), flows: new Map() }];
  const preSubackSlots = [];
  let drainQueue = [];
  let availableOutputs = 0;
  let sawInboundPublish = false;
  let unsuccessfulSubscription = false;
  let bufferExhausted = false;
  let connectionState = "unknown";
  let mqtt5Capabilities = {
    receiveMaximum: 65535,
    maximumQos: 2,
    retainAvailable: true,
    wildcardSubscriptionAvailable: true,
    sharedSubscriptionAvailable: true,
    subscriptionIdentifierAvailable: true,
    topicAliasMaximum: 0,
  };
  let mqtt5ClientReceiveMaximum = 65535;
  let mqtt5ClientTopicAliasMaximum = 0;
  let outboundPublishOrdinal = 0;
  let pendingOutboundPublishResends = [];
  let outboundPubrecOrdinal = 0;
  let pendingInboundPubackDispatches = [];
  let pendingInboundPubrecDispatches = [];
  let pendingOutboundPubrelDispatches = [];
  const mqtt5CapabilitiesFrom = (properties) => {
    const propertyValue = (name, fallback) =>
      (properties || []).find((property) => property.name === name)?.value ?? fallback;
    return {
      receiveMaximum: propertyValue("receive-maximum", 65535),
      maximumQos: propertyValue("maximum-qos", 2),
      retainAvailable: propertyValue("retain-available", 1) === 1,
      wildcardSubscriptionAvailable: propertyValue("wildcard-subscription-available", 1) === 1,
      sharedSubscriptionAvailable: propertyValue("shared-subscription-available", 1) === 1,
      subscriptionIdentifierAvailable: propertyValue("subscription-identifier-available", 1) === 1,
      topicAliasMaximum: propertyValue("topic-alias-maximum", 0),
    };
  };
  const quotaCharge = (states, state, maximum, eventAt, direction) => {
    if (state.quotaCharged) return;
    if ([...states.values()].filter((candidate) => candidate.quotaCharged).length >= maximum)
      violations.push(`${eventAt}: active ${direction} QoS 1/2 PUBLISH flows exceed current-connection Receive Maximum ${maximum}`);
    state.quotaCharged = true;
  };
  const bufferLimit = Number.isInteger(runtime?.mqttPreSubackBufferLimit)
    && runtime.mqttPreSubackBufferLimit >= 0
    ? runtime.mqttPreSubackBufferLimit
    : Infinity;
  const begin = (states, id, state, eventAt) => {
    if (states.has(id)) {
      violations.push(`${eventAt}: MQTT packet identifier ${id} is already active in this direction`);
      return undefined;
    }
    states.set(id, state);
    return state;
  };
  const advance = (states, id, wanted, next, eventAt) => {
    const state = states.get(id);
    if (state?.expect !== wanted) {
      violations.push(`${eventAt}: MQTT packet identifier ${id} arrived at ${wanted} while flow expected ${state?.expect || "no packet"}`);
      return undefined;
    }
    if (next) states.set(id, { ...state, expect: next });
    else states.delete(id);
    return state;
  };
  const mqtt5Failure = (facts) => protocolVersion === "5.0" && facts.reasonCode >= 128;
  const pendingSubscribe = () => [...outbound.values()].find((state) => state.expect === "SUBACK");
  const retainedPublishFactViolations = (facts, stagedFacts, origin, eventAt) => {
    const result = [];
    const immutableFacts = (value) => {
      const copy = structuredClone(value);
      delete copy.duplicate;
      delete copy.properties;
      return copy;
    };
    if (!jsonValueEqual(immutableFacts(facts), immutableFacts(stagedFacts)))
      result.push(`${eventAt}: retained PUBLISH changed immutable packet, topic, QoS, retain, payload, or identifier facts`);
    const propertyParts = (properties) => {
      const expiry = (properties || []).find((property) => property.name === "message-expiry-interval");
      const immutable = (properties || []).filter((property) =>
        property.name !== "message-expiry-interval"
        && property.name !== "topic-alias"
        && !(origin === "peer" && property.name === "subscription-identifier")
      );
      return { expiry, immutable };
    };
    const staged = propertyParts(stagedFacts.properties);
    const current = propertyParts(facts.properties);
    if (!jsonValueEqual(current.immutable, staged.immutable))
      result.push(`${eventAt}: retained PUBLISH changed immutable ordered MQTT 5 properties`);
    if (Boolean(current.expiry) !== Boolean(staged.expiry))
      result.push(`${eventAt}: retained PUBLISH changed Message Expiry Interval presence`);
    else if (current.expiry && current.expiry.value > staged.expiry.value)
      result.push(`${eventAt}: retained PUBLISH increased Message Expiry Interval`);
    return result;
  };
  const peerSubscriptionIdentifierResult = (facts, flowKey, retainedFlow, eventAt) => {
    const result = [];
    const supplied = [];
    for (const property of facts?.properties || []) {
      if (property.name !== "subscription-identifier") continue;
      supplied.push(property.value);
    }
    const matching = [...activeSubscriptions.entries()]
      .filter(([filter]) => mqttTopicFilterMatches(filter, facts.topic))
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    const cloneGenerationState = (state) => new Map([...state].map(([filter, generation]) => [
      filter,
      {
        ...generation,
        carriedIdentifiers: new Set(generation.carriedIdentifiers),
      },
    ]));
    const cloneCorrelationState = (state) => ({
      frontiers: new Map([...state.frontiers].map(([filter, frontier]) => [filter, { ...frontier }])),
      flows: new Map([...state.flows].map(([key, flow]) => [key, {
        topic: flow.topic,
        generations: cloneGenerationState(flow.generations),
      }])),
    });
    const generationIdentity = (state) => [...state]
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([filter, generation]) => ({
        filter,
        generation: generation.generation,
        currentIdentifier: generation.currentIdentifier ?? null,
        carriedIdentifiers: [...generation.carriedIdentifiers].sort((left, right) => left - right),
      }));
    const stateIdentity = (state) => JSON.stringify({
      frontiers: [...state.frontiers]
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([filter, frontier]) => ({
          filter,
          generation: frontier.generation,
          currentIdentifier: frontier.currentIdentifier ?? null,
          currentObserved: frontier.currentObserved,
        })),
      flows: [...state.flows]
        .sort(([left], [right]) => String(left).localeCompare(String(right)))
        .map(([key, flow]) => ({ key, topic: flow.topic, generations: generationIdentity(flow.generations) })),
    });
    const nextByIdentity = new Map();
    const omissionForbidden = supplied.length === 0 && matching.length > 0
      && matching.every(([, subscription]) => subscription.subscriptionIdentifier !== undefined);
    for (const priorState of subscriptionCorrelationStates) {
      const evolved = cloneCorrelationState(priorState);
      if (!retainedFlow) evolved.flows.delete(flowKey);
      const flow = evolved.flows.get(flowKey) || { topic: facts.topic, generations: new Map() };
      evolved.flows.set(flowKey, flow);
      for (const [filter, subscription] of matching) {
        const priorFrontier = evolved.frontiers.get(filter);
        if (!priorFrontier || priorFrontier.generation !== subscription.generation) {
          evolved.frontiers.set(filter, {
            generation: subscription.generation,
            currentIdentifier: subscription.subscriptionIdentifier,
            currentObserved: false,
          });
        }
        const prior = flow.generations.get(filter);
        if (!prior || prior.generation !== subscription.generation) {
          flow.generations.set(filter, {
            generation: subscription.generation,
            currentIdentifier: subscription.subscriptionIdentifier,
            carriedIdentifiers: new Set(prior?.carriedIdentifiers || []),
          });
        }
      }
      if (omissionForbidden) continue;
      const slots = matching.map(([filter]) => {
        const generation = flow.generations.get(filter);
        const frontier = evolved.frontiers.get(filter);
        const allowedIdentifiers = new Set();
        if (generation.currentIdentifier !== undefined)
          allowedIdentifiers.add(generation.currentIdentifier);
        if (!frontier.currentObserved) {
          for (const identifier of generation.carriedIdentifiers)
            allowedIdentifiers.add(identifier);
        }
        return { filter, allowedIdentifiers };
      });
      const assignments = [];
      const enumerateAssignments = (suppliedIndex, usedSlots, assignment) => {
        if (suppliedIndex === supplied.length) {
          assignments.push([...assignment]);
          return;
        }
        for (const [slotIndex, slot] of slots.entries()) {
          if (usedSlots.has(slotIndex) || !slot.allowedIdentifiers.has(supplied[suppliedIndex])) continue;
          usedSlots.add(slotIndex);
          assignment.push(slotIndex);
          enumerateAssignments(suppliedIndex + 1, usedSlots, assignment);
          assignment.pop();
          usedSlots.delete(slotIndex);
        }
      };
      enumerateAssignments(0, new Set(), []);
      for (const assignment of assignments) {
        const advanced = cloneCorrelationState(evolved);
        for (const [suppliedIndex, slotIndex] of assignment.entries()) {
          const filter = slots[slotIndex].filter;
          const frontier = advanced.frontiers.get(filter);
          const generation = advanced.flows.get(flowKey).generations.get(filter);
          if (supplied[suppliedIndex] === generation.currentIdentifier) {
            frontier.currentObserved = true;
            for (const correlatedFlow of advanced.flows.values()) {
              if (!mqttTopicFilterMatches(filter, correlatedFlow.topic)) continue;
              correlatedFlow.generations.set(filter, {
                generation: frontier.generation,
                currentIdentifier: frontier.currentIdentifier,
                carriedIdentifiers: new Set([frontier.currentIdentifier]),
              });
            }
          }
        }
        if (facts.qos === 0) advanced.flows.delete(flowKey);
        nextByIdentity.set(stateIdentity(advanced), advanced);
      }
    }
    const states = [...nextByIdentity.values()];
    if (states.length === 0) {
      const counts = new Map();
      for (const identifier of supplied) counts.set(identifier, (counts.get(identifier) || 0) + 1);
      if (omissionForbidden)
        result.push(`${eventAt}: Subscription Identifier omission is forbidden because every matching active subscription has an identifier`);
      else
        result.push(`${eventAt}: Subscription Identifier multiset ${JSON.stringify([...counts])} has no viable correlated assignment to distinct active matching subscription generations`);
    }
    subscriptionCorrelationStates = states;
    return result;
  };
  const consumeStageOrder = (queue, id, stage, eventAt) => {
    if (queue[0] !== id)
      violations.push(`${eventAt}: ${stage} packet ${id} is out of cross-flow order; expected ${queue[0] ?? "no packet"}`);
    else
      queue.shift();
  };
  const mqttTopicFilterMatches = (filter, topic) => {
    if (typeof filter !== "string" || typeof topic !== "string") return false;
    if (topic.startsWith("$") && !filter.startsWith("$")) return false;
    const filterLevels = filter.split("/");
    const topicLevels = topic.split("/");
    let topicIndex = 0;
    for (let filterIndex = 0; filterIndex < filterLevels.length; filterIndex++) {
      const level = filterLevels[filterIndex];
      if (level === "#") return filterIndex === filterLevels.length - 1;
      if (topicIndex >= topicLevels.length) return false;
      if (level !== "+" && level !== topicLevels[topicIndex]) return false;
      topicIndex++;
    }
    return topicIndex === topicLevels.length;
  };
  const mqttTopicFilterValid = mqttTopicFilterSyntaxValid;
  const mqttTopicNameValid = (topic) =>
    mqttUtf8StringValid(topic) && topic.length > 0
    && !topic.includes("#") && !topic.includes("+");
  const completeInbound = (state) => {
    if (state?.slot) state.slot.ackComplete = true;
    else availableOutputs++;
  };
  for (const [index, event] of (expected?.timeline || []).entries()) {
    const eventAt = `${at}.timeline[${index}]`;
    if (event?.kind === "output") {
      if (["disconnected", "terminal", "closing"].includes(connectionState))
        violations.push(`${eventAt}: MQTT output is forbidden in ${connectionState} connection state`);
      if (preSubackSlots.length && pendingSubscribe())
        violations.push(`${eventAt}: pre-SUBACK publication leaked an operation output`);
      if (unsuccessfulSubscription)
        violations.push(`${eventAt}: lower/failed SUBACK leaked a buffered operation output`);
      if (drainQueue.length) {
        const slot = drainQueue[0];
        if (!slot.ackComplete)
          violations.push(`${eventAt}: buffered publication emitted before its MQTT acknowledgement flow completed`);
        if (slot.failure) {
          violations.push(`${eventAt}: stored pre-SUBACK failure was emitted as an operation output`);
        } else {
          drainQueue.shift();
        }
      } else if (sawInboundPublish) {
        if (availableOutputs <= 0)
          violations.push(`${eventAt}: MQTT output has no newly completed inbound publication`);
        else availableOutputs--;
      }
      continue;
    }
    if (event?.kind !== "native") continue;
    const facts = event.facts || {};
    if (protocolVersion === "5.0")
      violations.push(...mqtt5NativeFactViolations(event, eventAt));
    const id = facts.packetId;
    const packet = facts.packetType;
    if (event.name === "connection-opened") {
      connectionState = "connected";
      if (protocolVersion === "5.0")
        mqtt5Capabilities = mqtt5CapabilitiesFrom(facts.properties);
      for (const state of [...outbound.values(), ...inbound.values()]) state.quotaCharged = false;
      continue;
    }
    if (event.name === "connection-closed") {
      connectionState = packet === "CONNACK" || facts.origin === "local" ? "terminal" : "disconnected";
      continue;
    }
    if (event.name === "reconnected") {
      if (connectionState !== "disconnected")
        violations.push(`${eventAt}: MQTT reconnect requires disconnected state`);
      connectionState = "connected";
      if (protocolVersion === "5.0") {
        mqtt5Capabilities = mqtt5CapabilitiesFrom(facts.properties);
        const reconnectConnectProperties = facts.connect?.properties || [];
        mqtt5ClientReceiveMaximum = reconnectConnectProperties
          .find((property) => property.name === "receive-maximum")?.value ?? 65535;
        mqtt5ClientTopicAliasMaximum = reconnectConnectProperties
          .find((property) => property.name === "topic-alias-maximum")?.value ?? 0;
      }
      for (const state of [...outbound.values(), ...inbound.values()]) state.quotaCharged = false;
      pendingInboundPubackDispatches = [];
      pendingInboundPubrecDispatches = [];
      if (!facts.sessionPresent) {
        outbound.clear();
        inbound.clear();
        pendingOutboundPublishResends = [];
        pendingOutboundPubrelDispatches = [];
        pendingOpened.length = 0;
        pendingClosed.length = 0;
        activeSubscriptions.clear();
        subscriptionGenerationCounters.clear();
        subscriptionCorrelationStates = [{ frontiers: new Map(), flows: new Map() }];
        preSubackSlots.length = 0;
        drainQueue = drainQueue.filter((slot) => slot.ackComplete && !slot.failure);
      } else {
        for (const state of outbound.values()) {
          if (["PUBACK", "PUBREC"].includes(state.expect)) state.requiresResend = "PUBLISH";
          else if (state.expect === "PUBCOMP") state.requiresResend = "PUBREL";
        }
        for (const state of inbound.values()) {
          if (["PUBACK", "PUBREC"].includes(state.expect)) state.requiresResend = "PUBLISH";
          else if (state.expect === "PUBCOMP") state.requiresResend = "PUBREL";
        }
        pendingOutboundPublishResends = [...outbound.entries()]
          .filter(([, state]) => state.requiresResend === "PUBLISH")
          .sort(([, left], [, right]) => left.sendOrdinal - right.sendOrdinal)
          .map(([packetId]) => packetId);
        pendingOutboundPubrelDispatches = [...outbound.entries()]
          .filter(([, state]) => state.requiresResend === "PUBREL")
          .sort(([, left], [, right]) => left.pubrecOrdinal - right.pubrecOrdinal)
          .map(([packetId]) => packetId);
      }
      continue;
    }
    if (
      ["disconnected", "terminal", "closing"].includes(connectionState)
      && ["dispatch", "acknowledgement", "delivery", "subscription-opened", "subscription-closed"].includes(event.name)
    ) violations.push(`${eventAt}: MQTT packet/subscription activity is forbidden in ${connectionState} state`);
    if (event.name === "dispatch" && packet === "DISCONNECT") {
      connectionState = "closing";
      continue;
    }
    if (event.name === "dispatch") {
      if (packet === "CONNECT" && protocolVersion === "5.0") {
        mqtt5ClientReceiveMaximum = (facts.properties || [])
          .find((property) => property.name === "receive-maximum")?.value ?? 65535;
        mqtt5ClientTopicAliasMaximum = (facts.properties || [])
          .find((property) => property.name === "topic-alias-maximum")?.value ?? 0;
        continue;
      }
      if (packet === "PUBLISH") {
        if (protocolVersion === "5.0") {
          if (facts.qos > mqtt5Capabilities.maximumQos)
            violations.push(`${eventAt}: client PUBLISH QoS ${facts.qos} exceeds CONNACK Maximum QoS ${mqtt5Capabilities.maximumQos}`);
          if (facts.retain && !mqtt5Capabilities.retainAvailable)
            violations.push(`${eventAt}: retained client PUBLISH is forbidden by CONNACK Retain Available=0`);
          for (const property of facts.properties || []) {
            if (property.name === "topic-alias" && (property.value < 1 || property.value > mqtt5Capabilities.topicAliasMaximum))
              violations.push(`${eventAt}: client Topic Alias ${property.value} exceeds CONNACK Topic Alias Maximum ${mqtt5Capabilities.topicAliasMaximum}`);
          }
        }
      }
      if (packet === "PUBLISH" && [1, 2].includes(facts.qos)) {
        const retained = outbound.get(id);
        if (retained?.requiresResend === "PUBLISH") {
          if (pendingOutboundPublishResends[0] !== id)
            violations.push(`${eventAt}: retained outbound PUBLISH replay packet ${id} is out of original send order; expected ${pendingOutboundPublishResends[0] ?? "no packet"}`);
          else
            pendingOutboundPublishResends.shift();
          if (protocolVersion === "5.0")
            quotaCharge(outbound, retained, mqtt5Capabilities.receiveMaximum, eventAt, "client-to-server");
          if (facts.duplicate !== true)
            violations.push(`${eventAt}: retained outbound PUBLISH resend must set DUP=1`);
          violations.push(...retainedPublishFactViolations(facts, retained.publishFacts, "local", eventAt));
          retained.publishFacts = structuredClone(facts);
          delete retained.requiresResend;
        } else {
          if (facts.duplicate !== false)
            violations.push(`${eventAt}: a new outbound PUBLISH flow must set DUP=0`);
          const state = {
            expect: facts.qos === 1 ? "PUBACK" : "PUBREC",
            flow: "PUBLISH",
            publishFacts: structuredClone(facts),
            sendOrdinal: outboundPublishOrdinal++,
          };
          if (protocolVersion === "5.0")
            quotaCharge(outbound, state, mqtt5Capabilities.receiveMaximum, eventAt, "client-to-server");
          begin(outbound, id, state, eventAt);
        }
      }
      else if (packet === "SUBSCRIBE") {
        if (!mqttTopicFilterValid(facts.topic))
          violations.push(`${eventAt}: MQTT SUBSCRIBE topic is not a valid topic filter`);
        if (
          protocolVersion === "5.0"
          && !mqtt5Capabilities.sharedSubscriptionAvailable
          && facts.topic.startsWith("$share/")
        ) violations.push(`${eventAt}: shared SUBSCRIBE filter is forbidden by CONNACK Shared Subscription Available=0`);
        if (
          protocolVersion === "5.0"
          && !mqtt5Capabilities.wildcardSubscriptionAvailable
          && (facts.topic.includes("+") || facts.topic.includes("#"))
        ) violations.push(`${eventAt}: wildcard SUBSCRIBE filter is forbidden by CONNACK Wildcard Subscription Available=0`);
        const subscriptionIdentifiers = protocolVersion === "5.0"
          ? (facts.properties || []).filter((property) => property.name === "subscription-identifier")
          : [];
        if (subscriptionIdentifiers.length && !mqtt5Capabilities.subscriptionIdentifierAvailable)
          violations.push(`${eventAt}: Subscription Identifier is forbidden by CONNACK Subscription Identifier Available=0`);
        begin(outbound, id, {
          expect: "SUBACK", topic: facts.topic, qos: facts.qos,
          subscriptionIdentifier: subscriptionIdentifiers[0]?.value,
          properties: structuredClone(facts.properties || []),
        }, eventAt);
      } else if (packet === "UNSUBSCRIBE") {
        if (!mqttTopicFilterValid(facts.topic))
          violations.push(`${eventAt}: MQTT UNSUBSCRIBE topic is not a valid topic filter`);
        begin(outbound, id, {
          expect: "UNSUBACK",
          topic: facts.topic,
          qos: activeSubscriptions.get(facts.topic)?.qos,
        }, eventAt);
      }
      else if (packet === "PUBREL") {
        consumeStageOrder(pendingOutboundPubrelDispatches, id, "client PUBREL dispatch", eventAt);
        const retained = outbound.get(id);
        if (retained?.expect === "PUBCOMP" && retained.requiresResend === "PUBREL") {
          if (!jsonValueEqual(facts, retained.pubrelFacts))
            violations.push(`${eventAt}: retained outbound PUBREL resend changed staged packet facts`);
          delete retained.requiresResend;
        } else {
          const state = advance(outbound, id, "PUBREL", "PUBCOMP", eventAt);
          const advanced = outbound.get(id);
          if (state && advanced) advanced.pubrelFacts = structuredClone(facts);
        }
      }
      else if (packet === "PUBACK") {
        consumeStageOrder(pendingInboundPubackDispatches, id, "client PUBACK dispatch", eventAt);
        const retained = inbound.get(id);
        if (retained?.requiresResend)
          violations.push(`${eventAt}: retained inbound flow received client PUBACK before its required duplicate PUBLISH`);
        else {
          const state = advance(inbound, id, "PUBACK", undefined, eventAt);
          completeInbound(state);
        }
      } else if (packet === "PUBREC") {
        consumeStageOrder(pendingInboundPubrecDispatches, id, "client PUBREC dispatch", eventAt);
        const state = inbound.get(id);
        if (state?.requiresResend) {
          violations.push(`${eventAt}: retained inbound flow received client PUBREC before its required duplicate PUBLISH`);
        } else if (state?.expect === "PUBREL" && state.repeatPubrecDue > 0) {
          state.repeatPubrecDue--;
        } else {
          const advanced = advance(inbound, id, "PUBREC", mqtt5Failure(facts) ? undefined : "PUBREL", eventAt);
          if (advanced && mqtt5Failure(facts)) completeInbound(advanced);
        }
      } else if (packet === "PUBCOMP") {
        const retained = inbound.get(id);
        if (retained?.requiresResend === "PUBREL")
          violations.push(`${eventAt}: retained inbound flow received client PUBCOMP before required peer PUBREL replay`);
        else {
          const state = advance(inbound, id, "PUBCOMP", undefined, eventAt);
          completeInbound(state);
        }
      }
    } else if (event.name === "delivery" && packet === "PUBLISH") {
      sawInboundPublish = true;
      const active = id === null || id === undefined ? undefined : inbound.get(id);
      if (!mqttTopicNameValid(facts.topic))
        violations.push(`${eventAt}: MQTT PUBLISH topic is not a valid topic name`);
      if (protocolVersion === "5.0") {
        for (const property of facts.properties || []) {
          if (property.name === "topic-alias" && (property.value < 1 || property.value > mqtt5ClientTopicAliasMaximum))
            violations.push(`${eventAt}: server Topic Alias ${property.value} exceeds CONNECT Topic Alias Maximum ${mqtt5ClientTopicAliasMaximum}`);
        }
        violations.push(...peerSubscriptionIdentifierResult(
          facts,
          id ?? eventAt,
          Boolean(active),
          eventAt
        ));
      }
      if (facts.qos === 1 && active) {
        if (protocolVersion === "5.0")
          quotaCharge(inbound, active, mqtt5ClientReceiveMaximum, eventAt, "server-to-client");
        pendingInboundPubackDispatches.push(id);
        if (active.requiresResend !== "PUBLISH")
          violations.push(`${eventAt}: duplicate QoS 1 PUBLISH is not tied to this retained flow`);
        if (facts.duplicate !== true)
          violations.push(`${eventAt}: resumed QoS 1 PUBLISH must set DUP=1`);
        violations.push(...retainedPublishFactViolations(facts, active.publishFacts, "peer", eventAt));
        active.publishFacts = structuredClone(facts);
        delete active.requiresResend;
        continue;
      }
      if (facts.qos === 2 && active) {
        if (protocolVersion === "5.0")
          quotaCharge(inbound, active, mqtt5ClientReceiveMaximum, eventAt, "server-to-client");
        pendingInboundPubrecDispatches.push(id);
        if (!["PUBREC", "PUBREL"].includes(active.expect))
          violations.push(`${eventAt}: duplicate QoS 2 PUBLISH arrived while packet ${id} expected ${active.expect}`);
        if (facts.duplicate !== true)
          violations.push(`${eventAt}: retransmitted QoS 2 PUBLISH must set DUP=1`);
        violations.push(...retainedPublishFactViolations(facts, active.publishFacts, "peer", eventAt));
        active.publishFacts = structuredClone(facts);
        active.repeatPubrecDue = (active.repeatPubrecDue || 0) + 1;
        delete active.requiresResend;
        continue;
      }
      const subscription = pendingSubscribe();
      let slot;
      if (subscription) {
        slot = {
          topic: facts.topic,
          qos: facts.qos,
          ackComplete: facts.qos === 0,
          failure: !mqttTopicFilterMatches(subscription.topic, facts.topic) || facts.qos > subscription.qos,
        };
        if (preSubackSlots.length >= bufferLimit) {
          slot.failure = true;
          slot.bufferOverflow = true;
          bufferExhausted = true;
        }
        preSubackSlots.push(slot);
      } else if (facts.qos === 0) {
        availableOutputs++;
      }
      if ([1, 2].includes(facts.qos)) {
        if (facts.duplicate !== false)
          violations.push(`${eventAt}: a new inbound PUBLISH flow must set DUP=0`);
        const state = {
          expect: facts.qos === 1 ? "PUBACK" : "PUBREC",
          flow: "PUBLISH",
          publishFacts: structuredClone(facts),
          repeatPubrecDue: 0,
          slot,
        };
        if (facts.qos === 1) delete state.repeatPubrecDue;
        if (protocolVersion === "5.0")
          quotaCharge(inbound, state, mqtt5ClientReceiveMaximum, eventAt, "server-to-client");
        if (begin(inbound, id, state, eventAt)) {
          if (facts.qos === 1) pendingInboundPubackDispatches.push(id);
          else pendingInboundPubrecDispatches.push(id);
        }
      }
    } else if (event.name === "acknowledgement") {
      if (packet === "PUBACK") {
        if (outbound.get(id)?.requiresResend)
          violations.push(`${eventAt}: retained outbound flow received PUBACK before its required resend`);
        else advance(outbound, id, "PUBACK", undefined, eventAt);
      } else if (packet === "PUBREC") {
        if (outbound.get(id)?.requiresResend)
          violations.push(`${eventAt}: retained outbound flow received PUBREC before its required resend`);
        else {
          const state = advance(outbound, id, "PUBREC", mqtt5Failure(facts) ? undefined : "PUBREL", eventAt);
          if (state && !mqtt5Failure(facts)) {
            const advanced = outbound.get(id);
            advanced.pubrecOrdinal = outboundPubrecOrdinal++;
            pendingOutboundPubrelDispatches.push(id);
          }
        }
      } else if (packet === "PUBCOMP") {
        if (outbound.get(id)?.requiresResend)
          violations.push(`${eventAt}: retained outbound flow received PUBCOMP before its required PUBREL resend`);
        else advance(outbound, id, "PUBCOMP", undefined, eventAt);
      }
      else if (packet === "PUBREL") {
        const state = inbound.get(id);
        if (state?.expect === "PUBCOMP" && state.requiresResend === "PUBREL") {
          if (!jsonValueEqual(facts, state.pubrelFacts))
            violations.push(`${eventAt}: retained inbound PUBREL replay changed staged packet facts`);
          delete state.requiresResend;
        } else {
          if (state?.repeatPubrecDue > 0)
          violations.push(`${eventAt}: QoS 2 PUBREL arrived before every duplicate PUBLISH received its repeated PUBREC`);
          const prior = advance(inbound, id, "PUBREL", "PUBCOMP", eventAt);
          const advanced = inbound.get(id);
          if (prior && advanced) advanced.pubrelFacts = structuredClone(facts);
        }
      } else if (packet === "SUBACK") {
        const state = advance(outbound, id, "SUBACK", undefined, eventAt);
        const resultQos = protocolVersion === "5.0" ? facts.reasonCode : facts.grantedQos;
        if (state && resultQos >= 0 && resultQos <= 2 && resultQos === state.qos)
          pendingOpened.push({
            topic: state.topic, qos: resultQos, eventAt,
            subscriptionIdentifier: state.subscriptionIdentifier,
            properties: state.properties,
          });
        else if (state) {
          unsuccessfulSubscription = true;
          preSubackSlots.length = 0;
        }
      } else if (packet === "UNSUBACK") {
        const state = advance(outbound, id, "UNSUBACK", undefined, eventAt);
        const successful = protocolVersion === "3.1.1" || facts.reasonCode < 128;
        if (state && successful && state.qos !== undefined)
          pendingClosed.push({ topic: state.topic, qos: state.qos, eventAt });
      }
    } else if (event.name === "subscription-opened") {
      const pending = pendingOpened.shift();
      if (!pending)
        violations.push(`${eventAt}: subscription-opened has no successful matching SUBACK`);
      else if (facts.topic !== pending.topic || facts.qos !== pending.qos)
        violations.push(`${eventAt}: subscription-opened ${facts.topic}/QoS ${facts.qos} does not match SUBACK result ${pending.topic}/QoS ${pending.qos}`);
      else {
        const generation = (subscriptionGenerationCounters.get(facts.topic) || 0) + 1;
        subscriptionGenerationCounters.set(facts.topic, generation);
        activeSubscriptions.set(facts.topic, {
          qos: facts.qos,
          subscriptionIdentifier: pending.subscriptionIdentifier,
          properties: pending.properties,
          generation,
        });
        for (const slot of preSubackSlots) {
          if (!slot.ackComplete)
            violations.push(`${eventAt}: subscription opened before a buffered publication completed its MQTT acknowledgement flow`);
          if (!mqttTopicFilterMatches(facts.topic, slot.topic) || slot.qos > facts.qos) slot.failure = true;
        }
        drainQueue = [...preSubackSlots];
        preSubackSlots.length = 0;
      }
    } else if (event.name === "subscription-closed") {
      const pending = pendingClosed.shift();
      if (!pending)
        violations.push(`${eventAt}: subscription-closed has no successful matching UNSUBACK`);
      else if (facts.topic !== pending.topic || facts.qos !== pending.qos)
        violations.push(`${eventAt}: subscription-closed ${facts.topic}/QoS ${facts.qos} does not match UNSUBACK result ${pending.topic}/QoS ${pending.qos}`);
      else activeSubscriptions.delete(facts.topic);
    }
  }
  for (const [id, state] of inbound) {
    if (state.repeatPubrecDue > 0)
      violations.push(`${at}: MQTT packet identifier ${id} ended with ${state.repeatPubrecDue} duplicate PUBLISH acknowledgement(s) still due`);
    if (state.slot)
      violations.push(`${at}: terminal outcome preceded required acknowledgement of buffered MQTT packet ${id}`);
  }
  for (const slot of [...preSubackSlots, ...drainQueue]) {
    if (!slot.ackComplete)
      violations.push(`${at}: terminal outcome preceded required acknowledgement of a pre-SUBACK publication`);
  }
  if (bufferExhausted && expected?.disposition !== "error")
    violations.push(`${at}: exhausted pre-SUBACK buffer must terminate with an error disposition`);
  if (unsuccessfulSubscription && expected?.disposition !== "error")
    violations.push(`${at}: unsuccessful exact-SUBACK result must terminate with an error disposition`);
  const firstStoredFailure = drainQueue.findIndex((slot) => slot.failure);
  if (firstStoredFailure >= 0) {
    if (firstStoredFailure > 0)
      violations.push(`${at}: terminal outcome preceded output of every valid buffered publication before the first stored failure`);
    if (expected?.disposition !== "error")
      violations.push(`${at}: stored pre-SUBACK failure may not silently complete`);
  } else if (expected?.disposition === "complete" && drainQueue.length > 0) {
    violations.push(`${at}: completed before emitting every valid buffered publication in order`);
  }
  if (expected?.disposition === "complete") {
    for (const [id, state] of outbound)
      violations.push(`${at}: completed with outbound MQTT packet identifier ${id} still awaiting ${state.expect}`);
    for (const [id, state] of inbound)
      violations.push(`${at}: completed with inbound MQTT packet identifier ${id} still awaiting ${state.expect}`);
    for (const pending of pendingOpened)
      violations.push(`${at}: completed without subscription-opened for successful SUBACK ${pending.topic}/QoS ${pending.qos}`);
    for (const pending of pendingClosed)
      violations.push(`${at}: completed without subscription-closed for successful UNSUBACK ${pending.topic}/QoS ${pending.qos}`);
  }
  return violations;
}

function revisionSixProcessorViolations(fixture, label) {
  if (![PROCESSOR_V6, PROCESSOR_V7].includes(fixture?.format) || !Array.isArray(fixture?.scenarios)) return [];
  const violations = [];
  for (const [scenarioIndex, scenario] of fixture.scenarios.entries()) {
    const at = `${label}.scenarios[${scenarioIndex}]`;
    violations.push(...resourceCarrierViolations(scenario?.given, `${at}.given`));
    const citedRules = new Set(scenario?.rules || []);
    for (const [expectedIndex, expected] of (scenario?.expected || []).entries()) {
      const evidenceRules = new Set(expected?.rules || []);
      if (expected.trace && (fixture.family !== "asyncapi-3.1" || fixture.format !== PROCESSOR_V7
        || !async31C21Supports("processor", scenario.id)))
        violations.push(`${at}.expected[${expectedIndex}].trace: qualification is scoped to AsyncAPI 3.1 revision-7 C21`);
      for (const rule of citedRules) {
        if (!evidenceRules.has(rule))
          violations.push(`${at}.expected[${expectedIndex}].rules: cited rule '${rule}' has no owner on this expected alternative`);
      }
      for (const rule of evidenceRules) {
        if (!citedRules.has(rule))
          violations.push(`${at}.expected[${expectedIndex}].rules: evidence owner '${rule}' is not cited by the scenario`);
      }
    }
    const invocation = scenario?.given?.invocation;
    const actions = invocation?.actions;
    const invocationKeys = new Set([
      "inputPresent", "input", "inputJson", "inputMaterializations", "writes", "actions"
    ]);
    for (const key of Object.keys(invocation || {})) {
      if (!invocationKeys.has(key))
        violations.push(`${at}.given.invocation: revision 6 forbids extension member '${key}'`);
    }
    if (Object.hasOwn(invocation || {}, "input") && containsJsonNumber(invocation.input))
      violations.push(`${at}.given.invocation.input: revision-6 unary input containing a number must use inputJson`);
    if (Object.hasOwn(invocation || {}, "inputJson")) {
      const parsedInput = parseLosslessJson(invocation.inputJson);
      if (!parsedInput.ok || !losslessNodeContainsNumber(parsedInput.node))
        violations.push(`${at}.given.invocation.inputJson: unary input must be one complete lossless JSON value containing a number`);
    }
    if (Array.isArray(actions)) {
      if (invocation.inputPresent !== false || Object.hasOwn(invocation, "input") || Object.hasOwn(invocation, "inputJson"))
        violations.push(`${at}: actions require inputPresent:false and no unary input member`);
      if (Object.hasOwn(invocation, "writes") || Object.hasOwn(invocation, "inputMaterializations"))
        violations.push(`${at}: actions are mutually exclusive with writes and inputMaterializations`);
      let halfClosed = false;
      let cancelled = false;
      let outputBarrier = 0;
      const nativeBarriers = new Map();
      for (const [actionIndex, action] of actions.entries()) {
        const actionAt = `${at}.given.invocation.actions[${actionIndex}]`;
        if (!action || typeof action !== "object") {
          violations.push(`${actionAt}: action must be an object`);
          continue;
        }
        if (action.kind === "write" && Object.hasOwn(action, "value") && containsJsonNumber(action.value))
          violations.push(`${actionAt}.value: revision-6 write containing a number must use valueJson`);
        if (action.kind === "write" && Object.hasOwn(action, "valueJson")) {
          const parsedWrite = parseLosslessJson(action.valueJson);
          if (!parsedWrite.ok || !losslessNodeContainsNumber(parsedWrite.node))
            violations.push(`${actionAt}.valueJson: write must be one complete lossless JSON value containing a number`);
        }
        if (action.kind === "write" && (halfClosed || cancelled))
          violations.push(`${actionAt}: write follows ${cancelled ? "cancellation" : "input half-close"}`);
        if (action.kind === "half-close") {
          if (halfClosed) violations.push(`${actionAt}: duplicate input half-close`);
          if (cancelled) violations.push(`${actionAt}: input half-close follows cancellation`);
          halfClosed = true;
        }
        if (action.kind === "cancel") {
          if (cancelled) violations.push(`${actionAt}: duplicate cancellation`);
          if (actionIndex !== actions.length - 1)
            violations.push(`${actionAt}: cancellation must be the final caller action`);
          cancelled = true;
        }
        if (action.kind === "await-output") {
          if (action.count <= outputBarrier)
            violations.push(`${actionAt}: await-output count must increase cumulatively`);
          outputBarrier = action.count;
        }
        if (action.kind === "await-native") {
          const prior = nativeBarriers.get(action.name) || 0;
          if (action.count <= prior)
            violations.push(`${actionAt}: await-native count for '${action.name}' must increase cumulatively`);
          nativeBarriers.set(action.name, action.count);
        }
      }
    }
    if (scenario?.given?.peer) {
      const dialect = scenario.given.peer.dialect;
      if (fixture.format === PROCESSOR_V6 && dialect === "openbindings.asyncapi-http-peer@2")
        violations.push(`${at}.given.peer.dialect: HTTP peer revision 2 requires processor-scenario revision 7`);
      if (fixture.format === PROCESSOR_V7 && dialect === "openbindings.asyncapi-http-peer@1")
        violations.push(`${at}.given.peer.dialect: AsyncAPI 3.1 HTTP cases under revision 7 require HTTP peer revision 2`);
      let peerViolations = peerScriptViolations(dialect, scenario.given.peer.script, `${at}.given.peer.script`);
      // A C21 local cancellation supplies the terminal cause outside the peer
      // script.  Preserve every peer grammar/chronology check, but do not
      // misclassify its valid interim-only prefix as a standalone incomplete
      // exchange once the invocation contains that explicit cancellation.
      if (fixture.family === "asyncapi-3.1" && dialect === "openbindings.asyncapi-http-peer@2"
        && scenario.given.invocation?.actions?.some((action) => action.kind === "cancel")) {
        peerViolations = peerViolations.filter((violation) =>
          !violation.endsWith("script has neither a final response nor a terminal disconnect/protocol switch")
        );
      }
      violations.push(...peerViolations);
    }
    for (const [expectedIndex, expected] of (scenario.expected || []).entries()) {
      let inputIndex = 0;
      let outputIndex = 0;
      for (const [eventIndex, event] of [...(expected.timeline || []), ...(expected.trace?.afterTerminal || [])].entries()) {
        const eventAt = `${at}.expected[${expectedIndex}].timeline[${eventIndex}]`;
        if (!event || typeof event !== "object") {
          violations.push(`${eventAt}: timeline event must be an object`);
          continue;
        }
        if (event.kind === "input-accepted" && event.index !== inputIndex++)
          violations.push(`${eventAt}: input-accepted indexes must be contiguous from zero`);
        if (event.kind === "output") {
          if (event.index !== outputIndex++)
            violations.push(`${eventAt}: output indexes must be contiguous from zero`);
          if (Object.hasOwn(event, "value") && containsJsonNumber(event.value))
            violations.push(`${eventAt}: revision-6 output containing a number must use valueJson`);
          if (Object.hasOwn(event, "valueJson")) {
            const parsedOutput = parseLosslessJson(event.valueJson);
            if (!parsedOutput.ok || !losslessNodeContainsNumber(parsedOutput.node))
              violations.push(`${eventAt}.valueJson: output must be one complete lossless JSON value containing a number`);
          }
        }
        if (event.kind === "native" && scenario?.given?.peer?.dialect) {
          const nativeSchema = nativeDialectSchema(
            scenario.given.peer.dialect,
            scenario.given.peer.script
          );
          const nativeShape = nativeSchema && ajvOk(nativeSchema, event);
          if (!nativeShape?.ok)
            violations.push(
              `${eventAt}: does not match the native observation schema for ${scenario.given.peer.dialect}\n${nativeShape?.out || "missing native dialect schema"}`
            );
          violations.push(...base64Violations(event, eventAt));
          if (
            scenario.given.peer.dialect === "openbindings.asyncapi-kafka-peer@1"
            && event?.facts?.offset !== null
            && Object.hasOwn(event?.facts || {}, "offset")
            && !validKafkaOffset(event.facts.offset)
          )
            violations.push(`${eventAt}.facts.offset: Kafka offset must be an exact nonnegative signed-64-bit decimal string`);
          if (
            scenario.given.peer.dialect === "openbindings.asyncapi-mqtt-peer@1"
          ) {
            violations.push(...mqttNativeUtf8Violations(event, eventAt));
          }
          if (
            scenario.given.peer.dialect === "openbindings.asyncapi-mqtt-peer@1"
            && scenario.given.peer.script?.protocolVersion === "5.0"
          )
            violations.push(...mqtt5NativeFactViolations(event, eventAt));
        } else if (event.kind === "native") {
          violations.push(`${eventAt}: revision-6 native facts require a selected peer dialect`);
        }
      }
      const actionList = Array.isArray(actions) ? actions : [];
      const writeCount = Array.isArray(actions)
        ? actionList.filter((action) => action?.kind === "write").length
        : invocation?.inputPresent === true ? 1 : 0;
      const halfCloseCount = actionList.filter((action) => action?.kind === "half-close").length;
      const cancelCount = actionList.filter((action) => action?.kind === "cancel").length;
      const acceptedCount = (expected.timeline || []).filter((event) => event?.kind === "input-accepted").length;
      const halfClosedCount = nativeCount(expected, "input-half-closed");
      const cancelledCount = nativeCount(expected, "cancellation-propagated");
      const async31PredispatchInputRefusal = fixture.family === "asyncapi-3.1"
        && fixture.format === PROCESSOR_V7
        && expected.disposition === "refusal"
        && ["load", "resolution", "pre-dispatch"].includes(expected.phase);
      const async31CancellationPreempted = fixture.family === "asyncapi-3.1"
        && fixture.format === PROCESSOR_V7 && cancelCount === 1
        && expected.disposition === "error" && expected.phase === "response";
      const async31CancellationAlreadyComplete = fixture.family === "asyncapi-3.1"
        && fixture.format === PROCESSOR_V7 && cancelCount === 1
        && expected.disposition === "complete" && expected.phase === "completion";
      if (!async31PredispatchInputRefusal && acceptedCount !== writeCount)
        violations.push(`${at}.expected[${expectedIndex}]: timeline has ${acceptedCount} input-accepted events for ${writeCount} supplied inputs`);
      if (async31PredispatchInputRefusal && acceptedCount !== 0)
        violations.push(`${at}.expected[${expectedIndex}]: rejected AsyncAPI 3.1 input must not be accepted before refusal`);
      if (halfClosedCount !== halfCloseCount)
        violations.push(`${at}.expected[${expectedIndex}]: timeline has ${halfClosedCount} input-half-closed events for ${halfCloseCount} half-close actions`);
      if (!async31CancellationPreempted && !async31CancellationAlreadyComplete && cancelledCount !== cancelCount)
        violations.push(`${at}.expected[${expectedIndex}]: timeline has ${cancelledCount} cancellation-propagated events for ${cancelCount} cancel actions`);
      if (cancelCount === 1 && !async31CancellationPreempted && !async31CancellationAlreadyComplete
        && (expected.disposition !== "cancelled" || expected.phase !== "interaction"))
        violations.push(`${at}.expected[${expectedIndex}]: caller cancellation requires cancelled/interaction terminal outcome`);
      if (cancelCount === 0 && expected.disposition === "cancelled")
        violations.push(`${at}.expected[${expectedIndex}]: cancelled terminal outcome requires one caller cancel action`);
      for (const [assertionIndex, assertion] of (expected.assertions || []).entries()) {
        if (assertion.bytesEquals && !canonicalBase64(assertion.bytesEquals.base64))
          violations.push(`${at}.expected[${expectedIndex}].assertions[${assertionIndex}]: bytesEquals is not canonical Base64`);
        if (
          assertion.semanticEquals
          && Object.hasOwn(assertion.semanticEquals, "value")
          && containsJsonNumber(assertion.semanticEquals.value)
        )
          violations.push(`${at}.expected[${expectedIndex}].assertions[${assertionIndex}]: revision-6 semanticEquals containing a number must use valueJson`);
        if (assertion.semanticEquals) {
          const expectedJson = expectedSemanticJson(assertion.semanticEquals);
          if (!expectedJson.ok)
            violations.push(`${at}.expected[${expectedIndex}].assertions[${assertionIndex}]: semanticEquals expected JSON is not losslessly comparable`);
          if (Object.hasOwn(assertion.semanticEquals, "valueJson") && (!expectedJson.ok || !losslessNodeContainsNumber(expectedJson.node)))
            violations.push(`${at}.expected[${expectedIndex}].assertions[${assertionIndex}]: semanticEquals valueJson must contain a JSON number`);
        }
        if (Object.hasOwn(assertion, "equals") && containsJsonNumber(assertion.equals))
          violations.push(`${at}.expected[${expectedIndex}].assertions[${assertionIndex}]: revision-6 numeric structural equality must use a lossless semanticEquals mode`);
        if (Object.hasOwn(assertion, "oneOf") && assertion.oneOf.some(containsJsonNumber))
          violations.push(`${at}.expected[${expectedIndex}].assertions[${assertionIndex}]: revision-6 numeric oneOf candidates are not lossless`);
        if (Object.hasOwn(assertion, "setEquals") && assertion.setEquals.some(containsJsonNumber))
          violations.push(`${at}.expected[${expectedIndex}].assertions[${assertionIndex}]: revision-6 numeric setEquals candidates are not lossless`);
      }

      if (Array.isArray(actions) && !async31PredispatchInputRefusal
        && !async31CancellationPreempted && !async31CancellationAlreadyComplete) {
        var actionPositions = deriveActionCompletionPositions(
          actions, expected, at, expectedIndex, violations
        );
        for (const [actionIndex, action] of actions.entries()) {
          if (action?.kind === "await-output" && action.count > outputIndex)
            violations.push(`${at}.given.invocation.actions[${actionIndex}]: await-output ${action.count} is unreachable in expected alternative ${expectedIndex}`);
          if (action?.kind === "await-native" && action.count > nativeCount(expected, action.name))
            violations.push(`${at}.given.invocation.actions[${actionIndex}]: await-native ${action.name} ${action.count} is unreachable in expected alternative ${expectedIndex}`);
        }
      }

      const liveExpected = expected;
      if (scenario?.given?.peer?.dialect && !async31PredispatchInputRefusal && !async31CancellationPreempted) {
        // Only the explicit C21 trace axis contributes post-terminal native
        // facts to peer correspondence. Invocation/action checks above retain
        // the live prefix. Other families have no trace member.
        const expected = {...liveExpected, timeline: [...(liveExpected.timeline || []), ...(liveExpected.trace?.afterTerminal || [])]};
        const dialect = scenario.given.peer.dialect;
        const events = peerScriptEvents(dialect, scenario.given.peer.script);
        const script = scenario.given.peer.script;
        const mappedCounts = new Map();
        let priorMappedPosition = -1;
        const mappedPositions = [];
        const verifyMapped = (mapped, trigger, peerLabel) => {
          if (!mapped) return -1;
          const mappedOrdinal = (mappedCounts.get(mapped.name) || 0) + 1;
          mappedCounts.set(mapped.name, mappedOrdinal);
          const mappedPosition = nthTimelinePosition(
            expected,
            (event) => event?.kind === "native" && event.name === mapped.name,
            mappedOrdinal
          );
          const actual = mappedPosition < 0 ? undefined : expected.timeline[mappedPosition];
          if (!actual || !jsonValueEqual(actual, mapped))
            violations.push(`${at}.${peerLabel}: mapped native observation does not equal ${JSON.stringify(mapped)} in expected alternative ${expectedIndex}`);
          let triggerPosition = -1;
          if (trigger?.kind === "action")
            triggerPosition = Array.isArray(actions) ? actionPositions[trigger.index] : -1;
          if (trigger?.kind === "native")
            triggerPosition = nthTimelinePosition(
              expected,
              (event) => event?.kind === "native" && event.name === trigger.name,
              trigger.count
            );
          if (mappedPosition >= 0 && mappedPosition <= triggerPosition)
            violations.push(`${at}.${peerLabel}: mapped '${mapped.name}' observation does not occur after its trigger in expected alternative ${expectedIndex}`);
          if (mappedPosition <= priorMappedPosition)
            violations.push(`${at}.${peerLabel}: mapped peer observations are not recorded in script order across triggers in expected alternative ${expectedIndex}`);
          priorMappedPosition = Math.max(priorMappedPosition, mappedPosition);
          mappedPositions.push(mappedPosition);
          return mappedPosition;
        };
        const implicitMappings = peerConnectionImplicitMappings(dialect, expected, script);
        for (const [implicitIndex, mapped] of implicitMappings.entries())
          verifyMapped(mapped, { kind: "start" }, `given.peer implicit event ${implicitIndex}`);
        for (const [peerIndex, peerEvent] of events.entries()) {
          const trigger = peerEvent?.after;
          if (trigger?.kind === "action" && (!Array.isArray(actions) || trigger.index >= actions.length))
            violations.push(`${at}.given.peer event ${peerIndex}: action trigger ${trigger.index} is unreachable`);
          if (trigger?.kind === "native" && trigger.count > nativeCount(expected, trigger.name))
            violations.push(`${at}.given.peer event ${peerIndex}: native trigger ${trigger.name} ${trigger.count} is unreachable in expected alternative ${expectedIndex}`);
          const mappedPosition = verifyMapped(
            peerEventNativeObservation(dialect, peerEvent, script),
            trigger,
            `given.peer event ${peerIndex}`
          );
          if (
            dialect === "openbindings.asyncapi-mqtt-peer@1"
            && script?.protocolVersion === "5.0"
            && peerEvent?.kind === "suback"
          ) {
            let requestPosition = -1;
            for (let position = mappedPosition - 1; position >= 0; position--) {
              const candidate = expected.timeline?.[position];
              if (
                candidate?.kind === "native"
                && candidate.name === "dispatch"
                && candidate.facts?.packetType === "SUBSCRIBE"
                && candidate.facts.packetId === peerEvent.packetId
              ) {
                requestPosition = position;
                break;
              }
            }
            const requestFacts = requestPosition < 0 ? undefined : expected.timeline[requestPosition].facts;
            const associated = requestFacts && {
              topic: requestFacts.topic,
              qos: requestFacts.qos,
              properties: requestFacts.properties,
            };
            if (!associated || !jsonValueEqual(peerEvent.subscribe, associated))
              violations.push(`${at}.given.peer event ${peerIndex}: SUBACK associated SUBSCRIBE evidence does not exactly match its prior native dispatch`);
          }
        }
        for (const [name, count] of mappedCounts) {
          if (nativeCount(expected, name) !== count)
            violations.push(`${at}.expected[${expectedIndex}]: peer script releases exactly ${count} '${name}' observation(s), but the timeline records ${nativeCount(expected, name)}`);
        }
        const exactMapped = [
          ...implicitMappings,
          ...events
            .map((event) => peerEventNativeObservation(dialect, event, script))
            .filter((event) => event !== undefined),
        ];
        const timelineMapped = (expected.timeline || []).filter((event) =>
          isPeerMappedNativeObservation(dialect, event)
        );
        if (!exactObservationListEqual(timelineMapped, exactMapped))
          violations.push(`${at}.expected[${expectedIndex}]: peer-originated native observations are not the exact ordered mapping of the peer script`);
        if (dialect === "openbindings.asyncapi-http-peer@1" && script?.outcome === "disconnect") {
          const closePosition = mappedPositions[0] ?? -1;
          const dispatchPosition = nthTimelinePosition(
            expected,
            (event) => event?.kind === "native" && event.name === "dispatch",
            1
          );
          if (script.disconnectAt === "before-request" && dispatchPosition >= 0 && closePosition >= dispatchPosition)
            violations.push(`${at}.expected[${expectedIndex}]: before-request HTTP disconnect is not before dispatch`);
          if (script.disconnectAt !== "before-request" && (dispatchPosition < 0 || closePosition <= dispatchPosition))
            violations.push(`${at}.expected[${expectedIndex}]: ${script.disconnectAt} HTTP disconnect is not after dispatch`);
        }
        if (dialect === "openbindings.asyncapi-websocket-peer@1")
          violations.push(...websocketHandshakeTimelineViolations(
            expected,
            script,
            `${at}.expected[${expectedIndex}]`,
            scenario.given.configuration
          ));
        if (dialect === "openbindings.asyncapi-mqtt-peer@1") {
          violations.push(...mqttConnectionTimelineViolations(
            expected,
            script,
            scenario.given.runtime,
            `${at}.expected[${expectedIndex}]`
          ));
          violations.push(...mqttPacketFlowViolations(
            expected,
            `${at}.expected[${expectedIndex}]`,
            script?.protocolVersion,
            scenario.given.runtime
          ));
        }
      }
    }
  }
  return violations;
}

function jsonValueEqual(left, right) {
  const l = losslessFromJs(left);
  const r = losslessFromJs(right);
  return l.ok && r.ok && losslessJsonEqual(l.node, r.node);
}

function sortedJsonValue(value) {
  if (Array.isArray(value)) return value.map(sortedJsonValue);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedJsonValue(value[key])]));
  return value;
}

function sortedJsonSha256(value) {
  return createHash("sha256").update(JSON.stringify(sortedJsonValue(value)), "utf8").digest("hex");
}

function fileSha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function async31ArtifactIntegrityViolations(artifacts, label) {
  const violations = [];
  const actualPaths = Object.keys(artifacts).sort();
  if (!sameStringMultiset(actualPaths, ASYNC31_ARTIFACT_RELATIVE_PATHS))
    violations.push(`${label}: artifact path set is not exact`);
  const dExpected = [
    ["asyncapi-3.1/ASYNC31-D-01.json", "ASYNC31-D-01", ASYNC31_ARTIFACT_EXPECTED_COUNTS.d01Tests],
    ["asyncapi-3.1/ASYNC31-D-02.json", "ASYNC31-D-02", ASYNC31_ARTIFACT_EXPECTED_COUNTS.d02Tests],
    ["asyncapi-3.1/ASYNC31-D-03.json", "ASYNC31-D-03", ASYNC31_ARTIFACT_EXPECTED_COUNTS.d03Tests],
    ["asyncapi-3.1/ASYNC31-D-04.json", "ASYNC31-D-04", ASYNC31_ARTIFACT_EXPECTED_COUNTS.d04Tests],
    ["asyncapi-3.1/ASYNC31-D-05.json", "ASYNC31-D-05", ASYNC31_ARTIFACT_EXPECTED_COUNTS.d05Tests],
    ["asyncapi-3.1/ASYNC31-D-06.json", "ASYNC31-D-06", ASYNC31_ARTIFACT_EXPECTED_COUNTS.d06Tests],
    ["asyncapi-3.1/ASYNC31-D-07.json", "ASYNC31-D-07", ASYNC31_ARTIFACT_EXPECTED_COUNTS.d07Tests],
  ];
  for (const [path, rule, testCount] of dExpected) {
    const fixture = artifacts[path];
    if (fixture?.rule !== rule) violations.push(`${label}: ${path} does not own exact rule ${rule}`);
    if (fixture?.tests?.length !== testCount)
      violations.push(`${label}: ${path} has ${fixture?.tests?.length ?? "no"} tests; expected exactly ${testCount}`);
  }
  const pIds = artifacts["processor/asyncapi-3.1.json"]?.scenarios?.map((scenario) => scenario.id) || [];
  const expectedPIds = Array.from(
    { length: ASYNC31_ARTIFACT_EXPECTED_COUNTS.processorScenarios },
    (_, index) => `ASYNC31-PS-${String(index + 1).padStart(2, "0")}`
  );
  if (!sameStringMultiset(pIds, expectedPIds))
    violations.push(`${label}: processor case ID set/count is not the exact ASYNC31-PS-01..${ASYNC31_ARTIFACT_EXPECTED_COUNTS.processorScenarios} set`);
  const sIds = artifacts["synthesis/asyncapi-3.1.json"]?.scenarios?.map((scenario) => scenario.id) || [];
  const expectedSIds = Array.from(
    { length: ASYNC31_ARTIFACT_EXPECTED_COUNTS.synthesisScenarios },
    (_, index) => `ASYNC31-SS-${String(index + 1).padStart(2, "0")}`
  );
  if (!sameStringMultiset(sIds, expectedSIds))
    violations.push(`${label}: synthesis case ID set/count is not the exact ASYNC31-SS-01..${ASYNC31_ARTIFACT_EXPECTED_COUNTS.synthesisScenarios} set`);
  const actualRoot = sortedJsonSha256(artifacts);
  if (actualRoot !== ASYNC31_ARTIFACT_ROOT_SHA256)
    violations.push(`${label}: canonical artifact root is ${actualRoot}; expected ${ASYNC31_ARTIFACT_ROOT_SHA256}`);
  return violations;
}

function loadAsync31Artifacts() {
  const artifacts = {};
  for (const relativePath of ASYNC31_ARTIFACT_RELATIVE_PATHS) {
    const text = readFileSync(join(CORPUS, relativePath), "utf8");
    const lossless = parseLosslessJson(text);
    if (!lossless.ok) throw new Error(`${relativePath}: lossless JSON validation failed: ${lossless.error}`);
    const artifact = JSON.parse(text);
    const scalarJsonTree = (value, active = new Set()) => {
      if (typeof value === "string") return c20bUnicodeScalarString(value);
      if (value === null || typeof value !== "object") return true;
      if (active.has(value)) return false;
      active.add(value);
      const ok = Object.keys(value).every((key) => c20bUnicodeScalarString(key)
        && scalarJsonTree(value[key], active));
      active.delete(value);
      return ok;
    };
    if (!scalarJsonTree(artifact))
      throw new Error(`${relativePath}: portable artifact contains a non-Unicode-scalar JSON string or member name`);
    artifacts[relativePath] = artifact;
  }
  return artifacts;
}

function parseCompleteJsonText(text) {
  return parseLosslessJson(text);
}

function expectedSemanticJson(semanticEquals) {
  return Object.hasOwn(semanticEquals, "valueJson")
    ? parseLosslessJson(semanticEquals.valueJson)
    : losslessFromJs(semanticEquals.value);
}

function sameStringMultiset(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function decodePercentUtf8(raw, {
  plusAsSpace = false,
  canonicalQuery = false,
  formEncoding,
} = {}) {
  if (typeof raw !== "string") return { ok: false };
  const bytes = [];
  const unreserved = (byte) =>
    (byte >= 0x41 && byte <= 0x5a)
    || (byte >= 0x61 && byte <= 0x7a)
    || (byte >= 0x30 && byte <= 0x39)
    || [0x2d, 0x2e, 0x5f, 0x7e].includes(byte);
  const oas32Literal = (byte) =>
    (byte >= 0x41 && byte <= 0x5a)
    || (byte >= 0x61 && byte <= 0x7a)
    || (byte >= 0x30 && byte <= 0x39)
    || [0x2a, 0x2d, 0x2e, 0x5f].includes(byte);
  const permittedFormLiteral = (byte) =>
    formEncoding === "oas-3.2" ? oas32Literal(byte) : unreserved(byte);
  const permittedFormEscape = (byte) => {
    if (byte >= 0x80) return true;
    if (formEncoding === "oas-3.0") return !unreserved(byte) && byte !== 0x20;
    if (formEncoding === "oas-3.1") return !unreserved(byte) || byte === 0x7e || byte === 0x20;
    if (formEncoding === "oas-3.2") return !oas32Literal(byte) && byte !== 0x20;
    return false;
  };
  for (let index = 0; index < raw.length; index++) {
    const code = raw.charCodeAt(index);
    if (raw[index] === "%") {
      const hex = raw.slice(index + 1, index + 3);
      if (!/^[0-9A-F]{2}$/.test(hex)) return { ok: false };
      const byte = Number.parseInt(hex, 16);
      if (canonicalQuery && unreserved(byte)) return { ok: false };
      if (formEncoding && !permittedFormEscape(byte)) return { ok: false };
      bytes.push(byte);
      index += 2;
      continue;
    }
    if (raw[index] === "+" && plusAsSpace) {
      bytes.push(0x20);
      continue;
    }
    if (code > 0x7f) return { ok: false };
    if (canonicalQuery && !unreserved(code)) return { ok: false };
    if (formEncoding && !permittedFormLiteral(code)) return { ok: false };
    bytes.push(code);
  }
  try {
    return {
      ok: true,
      value: new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes)),
    };
  } catch {
    return { ok: false };
  }
}

function parseNamedContributions(raw, decodeOptions) {
  if (typeof raw !== "string" || raw === "") return { ok: false };
  const entries = [];
  for (const contribution of raw.split("&")) {
    const equals = contribution.indexOf("=");
    if (equals < 0) return { ok: false };
    const name = decodePercentUtf8(contribution.slice(0, equals), decodeOptions);
    const value = decodePercentUtf8(contribution.slice(equals + 1), decodeOptions);
    if (!name.ok || !value.ok) return { ok: false };
    entries.push({ name: name.value, value: value.value });
  }
  return { ok: true, entries };
}

function parseNamedJson(selected, semanticEquals, kind) {
  let raw;
  let options;
  if (kind === "form-json-field") {
    raw = selected;
    options = { plusAsSpace: true, formEncoding: semanticEquals.formEncoding };
  } else {
    if (typeof selected !== "string") return { ok: false };
    let url;
    try { url = new URL(selected); } catch { return { ok: false }; }
    if (!url.search) return { ok: false };
    raw = url.search.slice(1);
    options = { canonicalQuery: true };
  }
  const parsed = parseNamedContributions(raw, options);
  if (!parsed.ok) return parsed;
  const matches = parsed.entries.filter((entry) => entry.name === semanticEquals.name);
  if (matches.length !== 1 || !sameStringMultiset(
    parsed.entries.map((entry) => entry.name),
    semanticEquals.names
  )) return { ok: false };
  return parseCompleteJsonText(matches[0].value);
}

function headerValues(headers, wanted) {
  if (Array.isArray(headers))
    return headers
      .filter((header) => typeof header?.name === "string" && header.name.toLowerCase() === wanted)
      .map((header) => header.value);
  if (!headers || typeof headers !== "object") return [];
  const matches = Object.entries(headers)
    .filter(([name]) => name.toLowerCase() === wanted)
    .flatMap(([, value]) => Array.isArray(value) ? value : [value]);
  return matches.filter((value) => typeof value === "string");
}

function multipartBoundary(contentType) {
  if (typeof contentType !== "string") return undefined;
  const match = contentType.match(/^multipart\/form-data\s*;\s*boundary=(?:"([^"\\]*(?:\\.[^"\\]*)*)"|([!#$%&'*+.^_`|~0-9A-Za-z-]+))$/i);
  if (!match) return undefined;
  return match[1] === undefined ? match[2] : match[1].replace(/\\(.)/g, "$1");
}

function parseMultipartParts(dispatch) {
  if (!dispatch || typeof dispatch !== "object" || typeof dispatch.body !== "string")
    return { ok: false };
  const contentTypes = headerValues(dispatch.headers, "content-type");
  if (contentTypes.length !== 1) return { ok: false };
  const boundary = multipartBoundary(contentTypes[0]);
  if (!boundary) return { ok: false };
  const delimiter = `--${boundary}`;
  const body = dispatch.body;
  let cursor = 0;
  if (!body.startsWith(`${delimiter}\r\n`, cursor)) return { ok: false };
  cursor += delimiter.length + 2;
  const parts = [];
  while (true) {
    const headerEnd = body.indexOf("\r\n\r\n", cursor);
    if (headerEnd < 0) return { ok: false };
    const headers = new Map();
    for (const line of body.slice(cursor, headerEnd).split("\r\n")) {
      const colon = line.indexOf(":");
      if (colon <= 0) return { ok: false };
      const name = line.slice(0, colon).toLowerCase();
      const value = line.slice(colon + 1).trim();
      if (headers.has(name)) return { ok: false };
      headers.set(name, value);
    }
    cursor = headerEnd + 4;
    const next = body.indexOf(`\r\n${delimiter}`, cursor);
    if (next < 0) return { ok: false };
    const disposition = headers.get("content-disposition");
    const dispositionMatch = disposition?.match(/^form-data;\s*name="((?:[^"\\]|\\.)*)"$/i);
    if (!dispositionMatch) return { ok: false };
    const name = dispositionMatch[1].replace(/\\(.)/g, "$1");
    parts.push({ name, headers, body: body.slice(cursor, next) });
    cursor = next + 2 + delimiter.length;
    if (body.startsWith("--", cursor)) {
      cursor += 2;
      if (body.startsWith("\r\n", cursor)) cursor += 2;
      return cursor === body.length ? { ok: true, parts } : { ok: false };
    }
    if (!body.startsWith("\r\n", cursor)) return { ok: false };
    cursor += 2;
  }
}

function parseMultipartJson(selected, semanticEquals) {
  const parsed = parseMultipartParts(selected);
  if (!parsed.ok || !sameStringMultiset(
    parsed.parts.map((part) => part.name),
    semanticEquals.names
  )) return { ok: false };
  const matches = parsed.parts.filter((part) => part.name === semanticEquals.name);
  if (matches.length !== 1) return { ok: false };
  const contentTypes = matches[0].headers.has("content-type")
    ? [matches[0].headers.get("content-type")]
    : [];
  if (contentTypes.length !== 1 || !/^application\/json\s*$/i.test(contentTypes[0]))
    return { ok: false };
  return parseCompleteJsonText(matches[0].body);
}

function parseJsonFrames(selected, kind) {
  if (typeof selected !== "string" || selected === "") return { ok: false };
  const frames = [];
  if (kind === "json-lines") {
    if (!selected.endsWith("\n")) return { ok: false };
    const lines = selected.slice(0, -1).split("\n");
    if (lines.some((line) => line === "")) return { ok: false };
    frames.push(...lines);
  } else {
    let cursor = 0;
    while (cursor < selected.length) {
      if (selected[cursor] !== "\u001e") return { ok: false };
      const end = selected.indexOf("\n", cursor + 1);
      if (end < 0 || end === cursor + 1) return { ok: false };
      frames.push(selected.slice(cursor + 1, end));
      cursor = end + 1;
    }
  }
  const members = [];
  for (const frame of frames) {
    const parsed = parseCompleteJsonText(frame);
    if (!parsed.ok) return parsed;
    members.push(parsed.node);
  }
  return { ok: true, node: { kind: "array", members } };
}

function observedSemanticJson(selected, semanticEquals) {
  switch (semanticEquals.as) {
    case "form-json-field":
    case "query-json-parameter":
      return parseNamedJson(selected, semanticEquals, semanticEquals.as);
    case "multipart-json-part":
      return parseMultipartJson(selected, semanticEquals);
    case "querystring-json": {
      if (typeof selected !== "string") return { ok: false };
      let url;
      try { url = new URL(selected); } catch { return { ok: false }; }
      if (!url.search) return { ok: false };
      const decoded = decodePercentUtf8(url.search.slice(1), { canonicalQuery: true });
      return decoded.ok ? parseCompleteJsonText(decoded.value) : { ok: false };
    }
    case "json-lines":
    case "json-sequence":
      return parseJsonFrames(selected, semanticEquals.as);
    case "json-text":
      return parseCompleteJsonText(selected);
    case "json-base64-bytes": {
      if (!canonicalBase64(selected)) return { ok: false };
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(selected, "base64"));
        return parseCompleteJsonText(text);
      } catch {
        return { ok: false };
      }
    }
    default:
      return { ok: false };
  }
}

function revisionSixAssertionMatches(observation, assertion) {
  const selected = jsonPointerValue(observation, assertion.path);
  if (Object.hasOwn(assertion, "absent")) return !selected.found;
  if (!selected.found) return false;
  if (Object.hasOwn(assertion, "equals")) return jsonValueEqual(selected.value, assertion.equals);
  if (Object.hasOwn(assertion, "oneOf"))
    return assertion.oneOf.some((candidate) => jsonValueEqual(selected.value, candidate));
  if (Object.hasOwn(assertion, "setEquals")) {
    if (!Array.isArray(selected.value) || selected.value.length !== assertion.setEquals.length) return false;
    return assertion.setEquals.every((candidate) =>
      selected.value.some((value) => jsonValueEqual(value, candidate))
    );
  }
  if (Object.hasOwn(assertion, "contains"))
    return typeof selected.value === "string" && selected.value.includes(assertion.contains);
  if (Object.hasOwn(assertion, "notContains"))
    return typeof selected.value === "string" && !selected.value.includes(assertion.notContains);
  if (assertion.bytesEquals) {
    return canonicalBase64(selected.value)
      && canonicalBase64(assertion.bytesEquals.base64)
      && Buffer.from(selected.value, "base64").equals(Buffer.from(assertion.bytesEquals.base64, "base64"));
  }
  if (assertion.semanticEquals) {
    const parsed = observedSemanticJson(selected.value, assertion.semanticEquals);
    const expected = expectedSemanticJson(assertion.semanticEquals);
    return parsed.ok && expected.ok && losslessJsonEqual(parsed.node, expected.node);
  }
  return false;
}

function revisionSixAlternativeMatches(observation, expected) {
  return observation?.disposition === expected.disposition
    && observation?.phase === expected.phase
    && revisionSixTimelineEqual(observation?.timeline, expected.timeline)
    && (expected.assertions || []).every((assertion) =>
      revisionSixAssertionMatches(observation, assertion)
    );
}

function revisionSixTimelineEqual(observed, expected) {
  if (!Array.isArray(observed) || !Array.isArray(expected) || observed.length !== expected.length)
    return false;
  return expected.every((wanted, index) => {
    const actual = observed[index];
    if (wanted?.kind !== "output") return jsonValueEqual(actual, wanted);
    if (
      actual?.kind !== "output"
      || actual.index !== wanted.index
      || Object.keys(actual).some((key) => !["kind", "index", "value", "valueJson"].includes(key))
      || Object.hasOwn(actual, "value") === Object.hasOwn(actual, "valueJson")
    ) return false;
    if (Object.hasOwn(wanted, "valueJson")) {
      if (!Object.hasOwn(actual, "valueJson")) return false;
      const left = parseLosslessJson(actual.valueJson);
      const right = parseLosslessJson(wanted.valueJson);
      return left.ok && right.ok && losslessJsonEqual(left.node, right.node);
    }
    return Object.hasOwn(actual, "value") && jsonValueEqual(actual.value, wanted.value);
  });
}

function revisionSixSynthesisEvidenceRules(scenario) {
  if (scenario?.expected?.outcome === "refused")
    return [...(scenario.expected.rules || [])];
  return [...new Set(
    [
      ...(scenario?.expected?.coverage?.entries || []).map((entry) => entry?.rule),
      ...(scenario?.expected?.assertions || []).map((assertion) => assertion?.rule),
    ]
      .filter(Boolean)
  )];
}

function revisionSixCoverageInventory(entries) {
  return (entries || []).map((entry) => {
    const identity = {
      sourceIndex: entry.sourceIndex,
      sourceRef: entry.sourceRef,
      scope: entry.scope,
    };
    if (entry.operationKey !== undefined) identity.operationKey = entry.operationKey;
    if (entry.bindingSelector !== undefined) identity.bindingSelector = entry.bindingSelector;
    return identity;
  });
}

function jsonValueSetEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const unmatched = [...right];
  for (const candidate of left) {
    const index = unmatched.findIndex((value) => jsonValueEqual(value, candidate));
    if (index < 0) return false;
    unmatched.splice(index, 1);
  }
  return unmatched.length === 0;
}

function canonicalJsonPointer(pointer) {
  if (pointer === "") return true;
  if (typeof pointer !== "string" || !pointer.startsWith("/")) return false;
  for (const token of pointer.slice(1).split("/")) {
    for (let index = 0; index < token.length; index++) {
      if (token[index] !== "~") continue;
      if (!["0", "1"].includes(token[index + 1])) return false;
      index++;
    }
  }
  return true;
}

function async31InternalOwnerKind(sourceRef) {
  if (typeof sourceRef !== "string" || !sourceRef.startsWith("#")) return undefined;
  const pointer = sourceRef.slice(1);
  if (!canonicalJsonPointer(pointer)) return undefined;
  const parts = pointer.slice(1).split("/");
  if (parts.length === 1 && ["operations", "channels", "servers"].includes(parts[0]))
    return `${parts[0].slice(0, -1)}-root-container`;
  if (parts.length === 2 && ["operations", "channels", "servers"].includes(parts[0]))
    return parts[0].slice(0, -1);
  if (
    parts.length === 3
    && parts[0] === "components"
    && ["operations", "channels", "servers"].includes(parts[1])
  ) return parts[1].slice(0, -1);
  if (parts.length === 2 && parts[0] === "components" && ["operations", "channels", "servers"].includes(parts[1]))
    return `${parts[1].slice(0, -1)}-container`;
  return undefined;
}

function canonicalAsync31ExternalOwnerSourceRef(sourceRef) {
  if (typeof sourceRef !== "string" || sourceRef.startsWith("#")) return false;
  const hash = sourceRef.indexOf("#");
  if (hash < 0 || sourceRef.indexOf("#", hash + 1) >= 0) return false;
  const base = sourceRef.slice(0, hash);
  const parsedBase = async31ParseRfc3986Reference(base);
  if (!parsedBase?.scheme || parsedBase.fragment !== undefined) return false;
  const raw = sourceRef.slice(hash + 1);
  const bytes = [];
  const literal = (byte) =>
    (byte >= 0x41 && byte <= 0x5a)
    || (byte >= 0x61 && byte <= 0x7a)
    || (byte >= 0x30 && byte <= 0x39)
    || [0x2d, 0x2e, 0x5f, 0x7e, 0x2f].includes(byte);
  for (let index = 0; index < raw.length; index++) {
    if (raw[index] === "%") {
      const hex = raw.slice(index + 1, index + 3);
      if (!/^[0-9A-F]{2}$/.test(hex)) return false;
      const byte = Number.parseInt(hex, 16);
      if (literal(byte)) return false;
      bytes.push(byte);
      index += 2;
      continue;
    }
    const code = raw.charCodeAt(index);
    if (code > 0x7f || !literal(code)) return false;
    bytes.push(code);
  }
  try {
    const pointer = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
    return canonicalJsonPointer(pointer);
  } catch {
    return false;
  }
}

function async31CoverageAlgebraViolations(scenario, at) {
  const violations = [];
  if (scenario?.expected?.outcome !== "synthesized") return violations;
  const serverOwnerCounts = new Map();
  for (const [entryIndex, entry] of (scenario.expected.coverage?.entries || []).entries()) {
    const entryAt = `${at}.expected.coverage.entries[${entryIndex}]`;
    if (entry.rule === "ASYNC31-S-02") {
      const internalKind = async31InternalOwnerKind(entry.sourceRef);
      if (!internalKind && !canonicalAsync31ExternalOwnerSourceRef(entry.sourceRef))
        violations.push(`${entryAt}: invalid owner sourceRef is not a canonical internal/external owner identity`);
      if (entry.status !== "invalid" || entry.scope !== "target" || entry.bindingSelector !== undefined)
        violations.push(`${entryAt}: ASYNC31-S-02 requires invalid target coverage without bindingSelector`);
      if (["server", "server-container", "server-root-container", "operation-root-container"].includes(internalKind)) {
        if (entry.operationKey !== undefined)
          violations.push(`${entryAt}: invalid deduplicated Server/root-Operation container owner must not carry operationKey`);
        serverOwnerCounts.set(entry.sourceRef, (serverOwnerCounts.get(entry.sourceRef) || 0) + 1);
      } else if (["operation", "channel", "operation-container", "channel-container", "channel-root-container"].includes(internalKind) && entry.operationKey === undefined) {
        violations.push(`${entryAt}: invalid Operation/Channel owner requires the affected root operationKey`);
      }
    }
    if (entry.rule === "ASYNC31-S-05") {
      if (
        entry.status !== "excluded"
        || entry.scope !== "target"
        || entry.bindingSelector !== undefined
        || typeof entry.operationKey !== "string"
        || entry.sourceRef !== `#/operations/${entry.operationKey.replaceAll("~", "~0").replaceAll("/", "~1")}`
      ) violations.push(`${entryAt}: ASYNC31-S-05 target identity is not exact`);
    }
    if (entry.rule === "ASYNC31-S-06" && (
      entry.status !== "excluded"
      || entry.scope !== "target"
      || entry.bindingSelector !== undefined
      || typeof entry.operationKey !== "string"
    )) violations.push(`${entryAt}: ASYNC31-S-06 requires an operation-owned excluded target without bindingSelector`);
    if (entry.rule === "ASYNC31-S-07" && (
      entry.status !== "excluded"
      || entry.scope !== "target"
      || entry.bindingSelector !== undefined
      || !canonicalAsync31ExternalOwnerSourceRef(entry.sourceRef)
    )) violations.push(`${entryAt}: ASYNC31-S-07 requires a canonical excluded external-owner target`);
  }
  for (const [sourceRef, count] of serverOwnerCounts) {
    if (count !== 1) violations.push(`${at}: invalid Server owner '${sourceRef}' is not deduplicated`);
  }
  return violations;
}

// C21 is the first AsyncAPI 3.1 profile whose portable cases execute an
// interaction.  Keep the adapter here deliberately small and closed: it does
// not interpret any of the trait/schema/reply/security/parameter surface that
// the candidate still excludes.
const ASYNC31_C21_FIRST_PROCESSOR_ID = 108;
const ASYNC31_C21_FIRST_SYNTHESIS_ID = 28;

// One capability predicate governs execution and selective orchestration.
// The independent runner also checks a separately frozen exact identity set.
function async31C21Supports(kind, id) {
  const definitions = {processor:[/^ASYNC31-PS-(\d+)$/,ASYNC31_C21_FIRST_PROCESSOR_ID], synthesis:[/^ASYNC31-SS-(\d+)$/,ASYNC31_C21_FIRST_SYNTHESIS_ID]};
  if (!Object.hasOwn(definitions,kind)) throw new Error(`Unknown C21 capability kind: ${kind}`);
  const [pattern,first] = definitions[kind], number = Number(pattern.exec(id)?.[1]);
  return Number.isInteger(number) && number >= first;
}

function async31PointerToken(value) {
  return String(value).replaceAll("~", "~0").replaceAll("/", "~1");
}

function async31GeneratedKey(role, sourceIndex, value = "") {
  const sourceText = String(sourceIndex);
  const valueText = String(value);
  if (!c20bUnicodeScalarString(sourceText) || !c20bUnicodeScalarString(valueText)) return undefined;
  const sourceHex = Buffer.from(sourceText, "utf8").toString("hex");
  if (role === "source") return `asyncapi31.source.${sourceHex}`;
  return `asyncapi31.${role}.${sourceHex}00${Buffer.from(valueText, "utf8").toString("hex")}`;
}

function async31C21Path(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return false;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (value[index] === "%") {
      if (!/^[0-9A-F]{2}$/.test(value.slice(index + 1, index + 3))) return false;
      index += 2;
      continue;
    }
    if (code > 0x7f || !/[A-Za-z0-9\-._~!$&'()*+,;=:@/]/.test(value[index])) return false;
  }
  return true;
}

function async31Ipv6Bytes(value) {
  if (typeof value !== "string" || value === "") return undefined;
  const halves = value.split("::");
  if (halves.length > 2) return undefined;
  const parseHalf = (text, ipv4TerminalAllowed) => {
    if (text === "") return [];
    const raw = text.split(":");
    const groups = [];
    for (const [index, part] of raw.entries()) {
      if (part.includes(".")) {
        // RFC 3986's IPv4address form is the terminal ls32 production.  It
        // may finish an uncompressed address or the right side of `::`; a
        // dotted group on the left of `::` can never be terminal.
        if (!ipv4TerminalAllowed || index !== raw.length - 1) return undefined;
        const ipv4 = c20bIpv4Bytes(part);
        if (!ipv4) return undefined;
        groups.push(ipv4.readUInt16BE(0), ipv4.readUInt16BE(2));
      } else {
        if (!/^[0-9A-Fa-f]{1,4}$/.test(part)) return undefined;
        groups.push(Number.parseInt(part, 16));
      }
    }
    return groups;
  };
  const left = parseHalf(halves[0], halves.length === 1);
  const right = halves.length === 2 ? parseHalf(halves[1], true) : [];
  if (!left || !right) return undefined;
  const zeros = halves.length === 2 ? 8 - left.length - right.length : 0;
  if ((halves.length === 2 && zeros < 1) || (halves.length === 1 && left.length !== 8)) return undefined;
  const groups = [...left, ...Array(zeros).fill(0), ...right];
  if (groups.length !== 8) return undefined;
  const bytes = Buffer.alloc(16);
  groups.forEach((group, index) => bytes.writeUInt16BE(group, index * 2));
  return bytes;
}

function async31IpvFuture(value) {
  return typeof value === "string"
    && /^[vV][0-9A-Fa-f]+\.[A-Za-z0-9._~!$&'()*+,;=:-]+$/.test(value);
}

function async31C21Authority(value) {
  if (typeof value !== "string" || value === "" || /[\s\x00-\x1f\x7f\/?#@{}]/.test(value)) return false;
  let host = value;
  let port;
  if (value.startsWith("[")) {
    const match = /^\[([^\]]+)\](?::([0-9]+))?$/.exec(value);
    if (!match || !(async31Ipv6Bytes(match[1]) || async31IpvFuture(match[1]))) return false;
    host = `[${match[1]}]`;
    port = match[2];
  } else {
    const colon = value.lastIndexOf(":");
    if (colon >= 0) {
      if (value.indexOf(":") !== colon) return false;
      host = value.slice(0, colon);
      port = value.slice(colon + 1);
      if (!/^[0-9]+$/.test(port)) return false;
    }
    if (!host) return false;
    for (let index = 0; index < host.length; index++) {
      if (host[index] === "%") {
        if (!/^[0-9A-F]{2}$/.test(host.slice(index + 1, index + 3))) return false;
        index += 2;
        continue;
      }
      if (!/[A-Za-z0-9\-._~!$&'()*+,;=]/.test(host[index])) return false;
    }
  }
  return port === undefined || (BigInt(port) <= 65535n);
}

function async31C21JoinPath(pathname, address) {
  const base = pathname === undefined ? "/" : pathname;
  return `${base.endsWith("/") ? base.slice(0, -1) : base}${address}` || "/";
}

const ASYNC31_JSON_YAML_TAGS = new Set([
  "tag:yaml.org,2002:null",
  "tag:yaml.org,2002:bool",
  "tag:yaml.org,2002:int",
  "tag:yaml.org,2002:float",
  "tag:yaml.org,2002:str",
  "tag:yaml.org,2002:seq",
  "tag:yaml.org,2002:map",
]);

function async31YamlNodeValue(node, document, state, keyPosition = false) {
  if (node === null && keyPosition) return { ok: true, value: "" };
  if (YAML.isAlias(node)) {
    let target;
    try { target = node.resolve(document); } catch { return { ok: false }; }
    if (!target) return { ok: false };
    return async31YamlNodeValue(target, document, state, keyPosition);
  }
  if (!node || (node.tag && !ASYNC31_JSON_YAML_TAGS.has(node.tag))) return { ok: false };
  if (keyPosition) {
    if (!YAML.isScalar(node) || (node.tag && node.tag !== "tag:yaml.org,2002:str")) return { ok: false };
    if (node.type === "PLAIN") return { ok: true, value: node.source ?? "" };
    return typeof node.value === "string" ? { ok: true, value: node.value } : { ok: false };
  }
  if (YAML.isScalar(node)) {
    if (typeof node.value === "number" && !Number.isFinite(node.value)) return { ok: false };
    if (node.value !== null && !["string", "number", "boolean"].includes(typeof node.value)) return { ok: false };
    return { ok: true, value: node.value };
  }
  if (!YAML.isMap(node) && !YAML.isSeq(node)) return { ok: false };
  if (state.active.has(node)) return { ok: false };
  if (state.memo.has(node)) return { ok: true, value: state.memo.get(node) };
  state.active.add(node);
  if (YAML.isSeq(node)) {
    const value = [];
    state.memo.set(node, value);
    for (const item of node.items) {
      const converted = async31YamlNodeValue(item, document, state);
      if (!converted.ok) return { ok: false };
      value.push(converted.value);
    }
    state.active.delete(node);
    return { ok: true, value };
  }
  // YAML mapping keys are data.  A null-prototype target plus defineProperty
  // keeps __proto__, constructor, and prototype as exact own members rather
  // than invoking Object.prototype machinery.
  const value = Object.create(null);
  state.memo.set(node, value);
  for (const pair of node.items) {
    const key = async31YamlNodeValue(pair.key, document, state, true);
    const member = async31YamlNodeValue(pair.value, document, state);
    if (!key.ok || !member.ok || Object.hasOwn(value, key.value)) return { ok: false };
    Object.defineProperty(value, key.value, {
      value: member.value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  state.active.delete(node);
  return { ok: true, value };
}

// One parser and composer is used for entry content and every reached byte or
// textual resource. yaml@2.8.1 is the parser bundled by the already-required
// TypeSpec CLI; the explicit AST walk supplies the AsyncAPI Failsafe-key rule,
// JSON-compatible tag set, duplicate rejection, alias-cycle rejection, and
// finite JSON-image check instead of accepting the library's JS coercions.
function async31ParseYamlDocument(text) {
  if (typeof text !== "string" || !c20bUnicodeScalarString(text)) return { ok: false };
  // YAML 1.2.2 requires processors to reject an incompatible major version,
  // while a 1.x minor-version directive remains processable under this
  // implementation's pinned 1.2 rules. Unknown reserved directives are
  // ignored; yaml's BAD_DIRECTIVE warning is therefore classified from the
  // authored directive instead of being ignored wholesale.
  const yamlVersionDirectives = [...text.matchAll(/^(?:\uFEFF)?%YAML[ \t]+([^#\r\n]+?)[ \t]*(?:#.*)?$/gm)]
    .map((match) => match[1]);
  if (yamlVersionDirectives.some((version) => !/^1\.[0-9]+$/.test(version))) return { ok: false };
  let documents;
  try {
    documents = YAML.parseAllDocuments(text, {
      version: "1.2",
      schema: "core",
      uniqueKeys: false,
      merge: false,
      strict: true,
      prettyErrors: false,
    });
  } catch { return { ok: false }; }
  if (documents.length !== 1) return { ok: false };
  const document = documents[0];
  const fatalWarnings = document.warnings.filter((warning) => warning.code !== "BAD_DIRECTIVE"
    || (!/^Unknown directive /.test(warning.message)
      && !/^Unsupported YAML version 1\.[0-9]+/.test(warning.message)));
  if (document.errors.length || fatalWarnings.length) return { ok: false };
  return async31YamlNodeValue(document.contents, document, { active: new Set(), memo: new Map() });
}

function async31DecodeResourceBytes(envelope) {
  if (envelope?.format !== "openbindings.resource-bytes@1" || !canonicalBase64(envelope.dataBase64)) return { ok: false };
  const bytes = Buffer.from(envelope.dataBase64, "base64");
  let encoding = "utf8";
  let offset = 0;
  if (bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0xff, 0xfe, 0x00, 0x00]))) {
    encoding = "utf32le";
    offset = 4;
  } else if (bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x00, 0x00, 0xfe, 0xff]))) {
    encoding = "utf32be";
    offset = 4;
  } else if (bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
    offset = 3;
  } else if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = "utf16le";
    offset = 2;
  } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = "utf16be";
    offset = 2;
  } else if (bytes.length >= 4) {
    if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 0 && bytes[3] !== 0) encoding = "utf32be";
    else if (bytes[0] !== 0 && bytes[1] === 0 && bytes[2] === 0 && bytes[3] === 0) encoding = "utf32le";
    else if (bytes[0] === 0 && bytes[1] !== 0 && bytes[2] === 0 && bytes[3] !== 0) encoding = "utf16be";
    else if (bytes[0] !== 0 && bytes[1] === 0 && bytes[2] !== 0 && bytes[3] === 0) encoding = "utf16le";
  }
  let text;
  if (encoding === "utf32le" || encoding === "utf32be") {
    if ((bytes.length - offset) % 4) return { ok: false };
    const points = [];
    for (let index = offset; index < bytes.length; index += 4) {
      const point = encoding === "utf32le" ? bytes.readUInt32LE(index) : bytes.readUInt32BE(index);
      if (point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) return { ok: false };
      points.push(point);
    }
    try { text = String.fromCodePoint(...points); } catch { return { ok: false }; }
  } else {
    try {
      const label = encoding === "utf16le" ? "utf-16le" : encoding === "utf16be" ? "utf-16be" : "utf-8";
      text = new TextDecoder(label, { fatal: true }).decode(bytes.subarray(offset));
    } catch { return { ok: false }; }
  }
  if (text === undefined || !c20bUnicodeScalarString(text)) return { ok: false };
  const parsed = async31ParseYamlDocument(text);
  return parsed.ok ? { ok: true, value: parsed.value, encodingExcluded: encoding !== "utf8" } : { ok: false };
}

function async31OwnJsonImage(value, active = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return { ok: true, value };
  if (typeof value === "number") return Number.isFinite(value) ? { ok: true, value } : { ok: false };
  if (!value || typeof value !== "object" || active.has(value)) return { ok: false };
  active.add(value);
  if (Array.isArray(value)) {
    const output = [];
    for (const member of value) {
      const cloned = async31OwnJsonImage(member, active);
      if (!cloned.ok) return { ok: false };
      output.push(cloned.value);
    }
    active.delete(value);
    return { ok: true, value: output };
  }
  const output = Object.create(null);
  for (const key of Object.keys(value)) {
    const cloned = async31OwnJsonImage(value[key], active);
    if (!cloned.ok) return { ok: false };
    Object.defineProperty(output, key, { value: cloned.value, enumerable: true, configurable: true, writable: true });
  }
  active.delete(value);
  return { ok: true, value: output };
}

function async31LoadResource(given, identity) {
  const inParsed = Object.hasOwn(given?.resources || {}, identity);
  const inBytes = Object.hasOwn(given?.resourceBytes || {}, identity);
  if (inParsed && inBytes) return { ok: false };
  if (inBytes) return async31DecodeResourceBytes(given.resourceBytes[identity]);
  if (!inParsed) return { ok: false };
  const supplied = given.resources[identity];
  if (typeof supplied === "string") return async31ParseYamlDocument(supplied);
  const cloned = async31OwnJsonImage(supplied);
  return cloned.ok ? { ok: true, value: cloned.value, encodingExcluded: false } : { ok: false };
}

const ASYNC31_URI_UNRESERVED = "A-Za-z0-9\\-._~";
const ASYNC31_URI_SUBDELIMS = "!$&'()*+,;=";

function async31Rfc3986Component(value, extra = "") {
  if (typeof value !== "string" || !c20bUnicodeScalarString(value) || /[^\x00-\x7f]/.test(value)) return false;
  for (let index = 0; index < value.length; index++) {
    if (value[index] === "%") {
      if (!/^[0-9A-Fa-f]{2}$/.test(value.slice(index + 1, index + 3))) return false;
      index += 2;
      continue;
    }
    if (!new RegExp(`^[${ASYNC31_URI_UNRESERVED}${ASYNC31_URI_SUBDELIMS}:@${extra}]$`).test(value[index])) return false;
  }
  return true;
}

function async31Rfc3986Authority(authority) {
  if (typeof authority !== "string") return false;
  const at = authority.indexOf("@");
  if (at !== authority.lastIndexOf("@")) return false;
  const userinfo = at < 0 ? undefined : authority.slice(0, at);
  const hostPort = at < 0 ? authority : authority.slice(at + 1);
  if (userinfo !== undefined && !async31Rfc3986Component(userinfo)) return false;
  if (hostPort.startsWith("[")) {
    const close = hostPort.indexOf("]");
    if (close < 0 || hostPort.indexOf("[", 1) >= 0 || hostPort.indexOf("]", close + 1) >= 0) return false;
    const literal = hostPort.slice(1, close);
    const suffix = hostPort.slice(close + 1);
    return Boolean(async31Ipv6Bytes(literal) || async31IpvFuture(literal))
      && (suffix === "" || /^:[0-9]*$/.test(suffix));
  }
  if (hostPort.includes("[") || hostPort.includes("]")) return false;
  const colon = hostPort.lastIndexOf(":");
  if (colon !== hostPort.indexOf(":")) return false;
  const host = colon < 0 ? hostPort : hostPort.slice(0, colon);
  const port = colon < 0 ? undefined : hostPort.slice(colon + 1);
  if (port !== undefined && !/^[0-9]*$/.test(port)) return false;
  if (c20bIpv4Bytes(host)) return true;
  return async31Rfc3986Component(host);
}

function async31ParseRfc3986Reference(value) {
  if (typeof value !== "string" || !c20bUnicodeScalarString(value) || /[\u0000-\u0020\u007f-\uffff]/.test(value)) return undefined;
  const match = /^(?:([A-Za-z][A-Za-z0-9+.-]*):)?(?:(\/\/)([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/.exec(value);
  if (!match) return undefined;
  const [, scheme, authorityMarker, authority = "", path = "", query, fragment] = match;
  const authorityPresent = authorityMarker === "//";
  if (authorityPresent && path && !path.startsWith("/")) return undefined;
  if (!authorityPresent && !scheme && /^[^/]*:/.test(path)) return undefined;
  if ((authorityPresent && !async31Rfc3986Authority(authority))
    || !async31Rfc3986Component(path, "/")
    || (query !== undefined && !async31Rfc3986Component(query, "/?"))
    || (fragment !== undefined && !async31Rfc3986Component(fragment, "/?"))) return undefined;
  return { scheme, authorityPresent, authority, path, query, fragment };
}

function async31RemoveDotSegments(path) {
  let input = path;
  let output = "";
  while (input) {
    if (input.startsWith("../")) input = input.slice(3);
    else if (input.startsWith("./")) input = input.slice(2);
    else if (input.startsWith("/./")) input = `/${input.slice(3)}`;
    else if (input === "/.") input = "/";
    else if (input.startsWith("/../")) {
      input = `/${input.slice(4)}`;
      output = output.replace(/\/?[^/]*$/, "");
    } else if (input === "/..") {
      input = "/";
      output = output.replace(/\/?[^/]*$/, "");
    } else if (input === "." || input === "..") input = "";
    else {
      const segment = /^\/?[^/]*/.exec(input)[0];
      output += segment;
      input = input.slice(segment.length);
    }
  }
  return output;
}

function async31ComposeRfc3986(parts, includeFragment = true) {
  return `${parts.scheme ? `${parts.scheme}:` : ""}${parts.authorityPresent ? `//${parts.authority}` : ""}${parts.path}`
    + `${parts.query === undefined ? "" : `?${parts.query}`}`
    + `${!includeFragment || parts.fragment === undefined ? "" : `#${parts.fragment}`}`;
}

function async31ResolveRfc3986(baseValue, referenceValue) {
  const ref = async31ParseRfc3986Reference(referenceValue);
  if (!ref) return undefined;
  let target;
  if (ref.scheme) {
    target = { ...ref, path: async31RemoveDotSegments(ref.path) };
    return { ...target, absolute: async31ComposeRfc3986(target), document: async31ComposeRfc3986(target, false) };
  }
  const base = async31ParseRfc3986Reference(baseValue);
  if (!base?.scheme || base.fragment !== undefined) return undefined;
  if (ref.authorityPresent) {
    target = { ...ref, scheme: base.scheme, path: async31RemoveDotSegments(ref.path) };
  } else {
    let path;
    let query = ref.query;
    if (!ref.path) {
      path = base.path;
      if (query === undefined) query = base.query;
    } else {
      const merged = ref.path.startsWith("/") ? ref.path
        : base.authorityPresent && base.path === "" ? `/${ref.path}`
          : `${base.path.slice(0, base.path.lastIndexOf("/") + 1)}${ref.path}`;
      path = async31RemoveDotSegments(merged);
    }
    target = { scheme: base.scheme, authorityPresent: base.authorityPresent, authority: base.authority,
      path, query, fragment: ref.fragment };
  }
  return { ...target, absolute: async31ComposeRfc3986(target), document: async31ComposeRfc3986(target, false) };
}

function async31AbsoluteDocumentLocation(value) {
  if (typeof value !== "string" || value.includes("#")) return undefined;
  const parsed = async31ParseRfc3986Reference(value);
  return parsed?.scheme ? value : undefined;
}

function async31ApplyKeyMaterializations(given) {
  if (given?.keyMaterializations === undefined) return { ok: true, value: given };
  if (!Array.isArray(given.keyMaterializations) || given.keyMaterializations.length === 0) return { ok: false };
  const value = structuredClone(given);
  for (const materialization of value.keyMaterializations) {
    if (materialization?.kind !== "unpaired-utf16-key"
      || !Array.isArray(materialization.codeUnits)
      || !materialization.codeUnits.length
      || materialization.codeUnits.some((unit) => !Number.isInteger(unit) || unit < 0 || unit > 0xffff)
      || !hasUnpairedSurrogate(materialization.codeUnits)
      || !canonicalJsonPointer(materialization.path)
      || !async31KeyMaterializationPathAllowed(materialization.path)) return { ok: false };
    let map = value;
    for (const token of materialization.path.slice(1).split("/")
      .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))) {
      if (!map || typeof map !== "object" || Array.isArray(map) || !Object.hasOwn(map, token)) return { ok: false };
      map = map[token];
    }
    if (!map || typeof map !== "object" || Array.isArray(map)) return { ok: false };
    const key = String.fromCharCode(...materialization.codeUnits);
    if (Object.hasOwn(map, key)) return { ok: false };
    Object.defineProperty(map, key, {
      value: materialization.value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  delete value.keyMaterializations;
  return { ok: true, value };
}

function async31KeyMaterializationPathAllowed(path) {
  if (!canonicalJsonPointer(path)) return false;
  const tokens = path.slice(1).split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
  // Only already parsed source maps can receive an artificial UTF-16 key.
  // Byte envelopes are deliberately absent: resourceBytes becomes a source
  // tree only after encoding detection and YAML composition.
  return tokens[0] === "source" && tokens[1] === "content"
    || tokens[0] === "resources" && tokens.length >= 2 && tokens[1] !== "";
}

function async31KeyMaterializationViolations(root, materializations, at) {
  const violations = [];
  if (materializations === undefined) return violations;
  if (!Array.isArray(materializations) || !materializations.length)
    return [`${at}: keyMaterializations must be a nonempty array`];
  const identities = new Set();
  for (const [index, materialization] of materializations.entries()) {
    const itemAt = `${at}[${index}]`;
    if (materialization?.kind !== "unpaired-utf16-key"
      || !Array.isArray(materialization.codeUnits)
      || !hasUnpairedSurrogate(materialization.codeUnits))
      violations.push(`${itemAt}: codeUnits must contain an unpaired surrogate`);
    if (!canonicalJsonPointer(materialization?.path)) {
      violations.push(`${itemAt}: path must be a canonical JSON Pointer`);
      continue;
    }
    if (!async31KeyMaterializationPathAllowed(materialization.path)) {
      violations.push(`${itemAt}: path must remain inside source.content or one parsed resources entry`);
      continue;
    }
    const identity = `${materialization.path}\0${(materialization.codeUnits || []).join(",")}`;
    if (identities.has(identity)) violations.push(`${itemAt}: duplicate materialized key identity`);
    identities.add(identity);
    const target = jsonPointerValue(root, materialization.path);
    if (!target.found || !target.value || typeof target.value !== "object" || Array.isArray(target.value))
      violations.push(`${itemAt}: path must name an existing source map`);
    else if (Array.isArray(materialization.codeUnits)
      && Object.hasOwn(target.value, String.fromCharCode(...materialization.codeUnits)))
      violations.push(`${itemAt}: materialized key already exists in the JSON-safe template`);
  }
  return violations;
}

function async31C21LoadGiven(given) {
  const materialized = async31ApplyKeyMaterializations(given);
  if (!materialized.ok) return { ok: false };
  given = materialized.value;
  if (!given?.source || typeof given.source !== "object") return { ok: false };
  const hasLocation = Object.hasOwn(given.source, "location");
  const location = hasLocation ? async31AbsoluteDocumentLocation(given.source.location) : undefined;
  if (hasLocation && !location) return { ok: false };
  let content = given.source.content;
  if (content === undefined && location) {
    const loaded = async31LoadResource(given, location);
    if (!loaded.ok || loaded.encodingExcluded) return { ok: false };
    content = loaded.value;
  } else if (typeof content === "string") {
    const parsed = async31ParseYamlDocument(content);
    if (!parsed.ok) return { ok: false };
    content = parsed.value;
  } else {
    const cloned = async31OwnJsonImage(content);
    if (!cloned.ok) return { ok: false };
    content = cloned.value;
  }
  if (!content || typeof content !== "object" || Array.isArray(content)
    || content.asyncapi !== "3.1.0"
    || !content.info || typeof content.info !== "object" || Array.isArray(content.info)
    || typeof content.info.title !== "string" || typeof content.info.version !== "string"
    || ["servers", "channels", "operations", "components"].some((name) =>
      content[name] !== undefined && (!content[name] || typeof content[name] !== "object" || Array.isArray(content[name]))
    )) return { ok: false };
  return { ok: true, given: { ...given, source: { ...given.source, ...(location ? { location } : {}), content } } };
}

function async31C21Pointer(document, fragment) {
  let pointer;
  try { pointer = decodeURIComponent(fragment); } catch { return { ok: false }; }
  if (!canonicalJsonPointer(pointer)) return { ok: false };
  if (pointer === "") return { ok: true, value: document, pointer };
  let value = document;
  for (const raw of pointer.slice(1).split("/")) {
    const token = raw.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!c20bUnicodeScalarString(token)) return { ok: false };
    if (!value || typeof value !== "object" || !Object.hasOwn(value, token)) return { ok: false };
    value = value[token];
  }
  return { ok: true, value, pointer };
}

function async31C21ResolvedIdentity(resourceIdentity, pointer) {
  return { resourceIdentity, pointer };
}

function async31C21TypedPointerOwner(document, resourceIdentity, pointer) {
  const tokens = pointer === "" ? [] : pointer.slice(1).split("/")
    .map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"));
  if (resourceIdentity === "#entry" && ["operations", "channels", "servers"].includes(tokens[0])) {
    const container = document?.[tokens[0]];
    if (container && typeof container === "object" && !Array.isArray(container)
      && Object.keys(container).some((key) => !c20bUnicodeScalarString(key)))
      return async31C21ResolvedIdentity(resourceIdentity, `/${tokens[0]}`);
  }
  if (tokens[0] !== "components" || !["operations", "channels", "servers"].includes(tokens[1])) return undefined;
  const container = document?.components?.[tokens[1]];
  const containerPointer = `/components/${tokens[1]}`;
  if (!container || typeof container !== "object" || Array.isArray(container))
    return async31C21ResolvedIdentity(resourceIdentity, containerPointer);
  if (Object.keys(container).some((key) => !c20bUnicodeScalarString(key)))
    return async31C21ResolvedIdentity(resourceIdentity, containerPointer);
  if (tokens.length >= 3 && !/^[A-Za-z0-9._-]+$/.test(tokens[2]))
    return async31C21ResolvedIdentity(resourceIdentity, `${containerPointer}/${async31PointerToken(tokens[2])}`);
  return undefined;
}

function async31C21ResolveReference(given, reference, currentDocument, currentBase, options = {}) {
  if (!reference || typeof reference !== "object" || Array.isArray(reference) || typeof reference.$ref !== "string")
    return { ok: false, ledger: options.ledger || [], failureOwner: options.containingOwner };
  const ledger = options.ledger || [];
  const seen = options.seen || new Set();
  const containingOwner = options.containingOwner
    || async31C21ResolvedIdentity(currentDocument === given.source.content ? "#entry" : currentBase, "");
  let document = currentDocument;
  let base = currentBase;
  let fragment = "";
  let resourceIdentity = currentDocument === given.source.content ? "#entry" : currentBase;
  let encodingExcluded = Boolean(options.encodingExcluded);
  let encodingOwner = options.encodingOwner;
  const raw = reference.$ref;
  if (raw.startsWith("#")) {
    fragment = raw.slice(1);
  } else {
    const absolute = async31ResolveRfc3986(currentBase, raw);
    if (!absolute) return { ok: false, ledger, failureOwner: containingOwner };
    fragment = absolute.fragment ?? "";
    resourceIdentity = absolute.document;
    const entryIdentity = given?.source?.location;
    if (entryIdentity && entryIdentity === resourceIdentity) {
      document = given.source.content;
      base = resourceIdentity;
      resourceIdentity = "#entry";
    } else {
      let pointer;
      try { pointer = decodeURIComponent(fragment); } catch {
        return { ok: false, ledger, failureOwner: containingOwner };
      }
      if (!canonicalJsonPointer(pointer)) return { ok: false, ledger, failureOwner: containingOwner };
      const target = async31C21ResolvedIdentity(resourceIdentity, pointer);
      const nextLedger = [...ledger, { raw, containingOwner, target }];
      const loaded = async31LoadResource(given, resourceIdentity);
      if (!loaded.ok) return { ok: false, ledger: nextLedger, failureOwner: options.firstTarget || target };
      document = loaded.value;
      encodingExcluded = encodingExcluded || Boolean(loaded.encodingExcluded);
      if (loaded.encodingExcluded && !encodingOwner) encodingOwner = target;
      base = resourceIdentity;
    }
  }
  let decodedPointer;
  try { decodedPointer = decodeURIComponent(fragment); } catch {
    return { ok: false, ledger, failureOwner: containingOwner };
  }
  if (!canonicalJsonPointer(decodedPointer)) return { ok: false, ledger, failureOwner: containingOwner };
  const target = async31C21ResolvedIdentity(resourceIdentity, decodedPointer);
  const nextLedger = ledger.length && ledger.at(-1).raw === raw && ledger.at(-1).target.resourceIdentity === resourceIdentity
    && ledger.at(-1).target.pointer === decodedPointer ? ledger : [...ledger, { raw, containingOwner, target }];
  const firstTarget = options.firstTarget || target;
  const typedOwner = async31C21TypedPointerOwner(document, resourceIdentity, decodedPointer);
  if (typedOwner) return { ok: false, ledger: nextLedger, failureOwner: typedOwner };
  const selected = async31C21Pointer(document, fragment);
  if (!selected.ok) return { ok: false, ledger: nextLedger, failureOwner: firstTarget };
  const identity = `${resourceIdentity}#${selected.pointer}`;
  if (seen.has(identity)) return { ok: false, ledger: nextLedger, failureOwner: firstTarget };
  const nextSeen = new Set(seen).add(identity);
  if (selected.value && typeof selected.value === "object" && !Array.isArray(selected.value) && typeof selected.value.$ref === "string")
    return async31C21ResolveReference(given, selected.value, document, base, {
      ledger: nextLedger, seen: nextSeen, firstTarget,
      containingOwner: target, encodingExcluded, encodingOwner,
    });
  return { ok: true, value: selected.value, document, base, pointer: selected.pointer,
    resourceIdentity, encodingExcluded, encodingOwner, ledger: nextLedger, firstTarget };
}

function async31C21ResolveSlot(given, raw, document, base, pointer) {
  const resourceIdentity = document === given.source.content ? "#entry" : base;
  const typedOwner = async31C21TypedPointerOwner(document, resourceIdentity, pointer);
  if (typedOwner) return { ok: false, ledger: [], failureOwner: typedOwner };
  if (raw && typeof raw === "object" && !Array.isArray(raw) && typeof raw.$ref === "string")
    return async31C21ResolveReference(given, raw, document, base, {
      containingOwner: async31C21ResolvedIdentity(resourceIdentity, pointer),
    });
  return { ok: true, value: raw, document, base, pointer,
    resourceIdentity, ledger: [] };
}

function async31C21ComponentKeyValid(resolved, member) {
  if (!resolved?.ok || resolved.resourceIdentity !== "#entry") return true;
  const match = new RegExp(`^/components/${member}/([^/]+)$`).exec(resolved.pointer || "");
  if (!match) return true;
  const key = match[1].replaceAll("~1", "/").replaceAll("~0", "~");
  return /^[A-Za-z0-9._-]+$/.test(key);
}

function async31C21TraversesRootSlot(resolved, member) {
  const rootPattern = new RegExp(`^/${member}/[^/]+$`);
  return resolved?.resourceIdentity === "#entry" && rootPattern.test(resolved.pointer || "")
    || resolved?.ledger?.some((hop) => hop.target?.resourceIdentity === "#entry"
      && rootPattern.test(hop.target.pointer || ""));
}

function async31C21ServerStructurallyValid(resolved) {
  return resolved?.ok && resolved.value && typeof resolved.value === "object" && !Array.isArray(resolved.value)
    && typeof resolved.value.host === "string" && typeof resolved.value.protocol === "string";
}

function async31C21RootServerMembership(given, channelResolved) {
  const servers = channelResolved.value?.servers;
  if (servers === undefined || (Array.isArray(servers) && servers.length === 0))
    return { ok: true, keys: Object.keys(given.source.content?.servers || {}), rootInvalid: [], direct: [], directInvalid: [], directEncoding: [] };
  if (!Array.isArray(servers)) return { ok: false, keys: [], rootInvalid: [], direct: [], directInvalid: [], directEncoding: [] };
  const keys = [];
  const rootInvalid = [];
  const direct = [];
  const directInvalid = [];
  const directEncoding = [];
  for (const [index, serverRef] of servers.entries()) {
    if (!serverRef || typeof serverRef !== "object" || Array.isArray(serverRef) || typeof serverRef.$ref !== "string")
      return { ok: false, keys: [], rootInvalid: [], direct: [], directInvalid: [], directEncoding: [] };
    const resolved = async31C21ResolveReference(given, serverRef, channelResolved.document, channelResolved.base, {
      containingOwner: async31C21ResolvedIdentity(channelResolved.resourceIdentity, channelResolved.pointer),
    });
    const rootHop = resolved.ledger?.find((hop) => hop.target?.resourceIdentity === "#entry"
      && /^\/servers\/[^/]+$/.test(hop.target.pointer || ""));
    const rootTarget = rootHop?.target
      || (resolved.resourceIdentity === "#entry" && /^\/servers\/[^/]+$/.test(resolved.pointer || "") ? resolved : undefined);
    const match = rootTarget && /^\/servers\/([^/]+)$/.exec(rootTarget.pointer);
    if (match) {
      const key = match[1].replaceAll("~1", "/").replaceAll("~0", "~");
      if (!/^[A-Za-z0-9_-]+$/.test(key)) {
        rootInvalid.push({ index, raw: serverRef.$ref, resolved, owner: rootTarget });
        continue;
      }
      keys.push(key);
      if (!resolved.ok || !Object.hasOwn(given.source.content?.servers || {}, key))
        rootInvalid.push({ index, raw: serverRef.$ref, resolved });
      continue;
    }
    if (!resolved.firstTarget) return { ok: false, keys: [], rootInvalid: [], direct: [], directInvalid: [], directEncoding: [] };
    const occurrence = { index, raw: serverRef.$ref, resolved };
    if (!async31C21ServerStructurallyValid(resolved)) directInvalid.push(occurrence);
    else if (resolved.encodingExcluded) directEncoding.push(occurrence);
    else direct.push(occurrence);
  }
  const rootAuthored = async31C21TraversesRootSlot(channelResolved, "channels");
  if (rootAuthored && (direct.length || directInvalid.length || directEncoding.length))
    return { ok: false, keys: [], rootInvalid: [], direct: [], directInvalid: [], directEncoding: [] };
  return { ok: true, keys: [...new Set(keys)], rootInvalid, direct, directInvalid, directEncoding };
}

function async31C21Profile(given, operationKey, serverKey) {
  const source = given?.source?.content;
  const entryBase = given?.source?.location;
  if (!source || typeof source !== "object" || !Object.hasOwn(source?.operations || {}, operationKey)
    || !Object.hasOwn(source?.servers || {}, serverKey)) return { status: "resolution" };
  const operationResolved = async31C21ResolveSlot(
    given, source.operations[operationKey], source, entryBase, `/operations/${async31PointerToken(operationKey)}`
  );
  const serverResolved = async31C21ResolveSlot(
    given, source.servers[serverKey], source, entryBase, `/servers/${async31PointerToken(serverKey)}`
  );
  const operation = operationResolved.value;
  const server = serverResolved.value;
  if (!operationResolved.ok || !serverResolved.ok
    || !async31C21ComponentKeyValid(operationResolved, "operations")
    || !async31C21ComponentKeyValid(serverResolved, "servers") || !operation || !server
    || typeof operation !== "object" || Array.isArray(operation)
    || typeof server !== "object" || Array.isArray(server)
    || !["send", "receive"].includes(operation.action)
    || !operation.channel || typeof operation.channel.$ref !== "string"
    || typeof server.host !== "string" || typeof server.protocol !== "string") return { status: "resolution" };
  const channelResolved = async31C21ResolveReference(
    given, operation.channel, operationResolved.document, operationResolved.base, {
      containingOwner: async31C21ResolvedIdentity(operationResolved.resourceIdentity, operationResolved.pointer),
    }
  );
  const channel = channelResolved.value;
  if (!channelResolved.ok || !async31C21ComponentKeyValid(channelResolved, "channels")
    || !channel || typeof channel !== "object" || Array.isArray(channel))
    return { status: "resolution" };
  const operationIsRootConcrete = async31C21TraversesRootSlot(operationResolved, "operations");
  if (operationIsRootConcrete && !async31C21TraversesRootSlot(channelResolved, "channels"))
    return { status: "resolution" };
  const membership = async31C21RootServerMembership(given, channelResolved);
  if (!membership.ok) return { status: "resolution" };
  if (membership.direct.length && membership.keys.length === 0) return { status: "direct-membership" };
  if (!membership.keys.includes(serverKey)) return { status: "unavailable" };
  const operationHttp = operation.bindings?.http;
  const operationBindingExact = operation.bindings
    && Object.keys(operation.bindings).length === 1
    && operationHttp && typeof operationHttp === "object" && !Array.isArray(operationHttp)
    && Object.keys(operationHttp).every((key) => ["method", "bindingVersion"].includes(key))
    && (operationHttp.method === undefined || operationHttp.method === "POST")
    && (operationHttp.bindingVersion === undefined || operationHttp.bindingVersion === "0.3.0")
    && operationHttp.query === undefined;
  const messageEntries = channel.messages && typeof channel.messages === "object" && !Array.isArray(channel.messages)
    ? Object.entries(channel.messages) : [];
  const messageExact = messageEntries.length === 1
    && c20bUnicodeScalarString(messageEntries[0][0])
    && messageEntries[0][1] && typeof messageEntries[0][1] === "object"
    && !Array.isArray(messageEntries[0][1]) && Object.keys(messageEntries[0][1]).length === 0;
  const inlineHttpEmpty = (bindings) => bindings === undefined
    || (bindings && typeof bindings === "object" && !Array.isArray(bindings)
      && (Object.keys(bindings).length === 0
        || (Object.keys(bindings).length === 1 && bindings.http
          && typeof bindings.http === "object" && !Array.isArray(bindings.http)
          && Object.keys(bindings.http).length === 0)));
  const address = channel.address;
  const host = server.host;
  const serverExact = server.protocol === "http"
    && (server.protocolVersion === undefined || server.protocolVersion === "1.1")
    && async31C21Authority(host)
    && (server.pathname === undefined || async31C21Path(server.pathname))
    && server.variables === undefined && server.security === undefined
    && inlineHttpEmpty(server.bindings);
  const channelExact = async31C21Path(address)
    && channel.parameters === undefined && messageExact && inlineHttpEmpty(channel.bindings);
  const operationExact = operation.action === "receive"
    && operation.messages === undefined && operation.traits === undefined && operation.reply === undefined
    && (operation.security === undefined || (Array.isArray(operation.security) && operation.security.length === 0))
    && operationBindingExact;
  if (!serverExact || !channelExact || !operationExact) return { status: "excluded" };
  const messagePointer = `${channelResolved.pointer}/messages/${async31PointerToken(messageEntries[0][0])}`;
  const messageSourceRef = channelResolved.resourceIdentity === "#entry"
    ? `#${messagePointer}`
    : `${channelResolved.resourceIdentity}#${async31C21ExternalFragment(messagePointer)}`;
  return {
    status: "represented",
    profile: {
      operation, operationKey, server, serverKey, channel,
      messageKey: messageEntries[0][0], messageSourceRef,
      authority: host, path: async31C21JoinPath(server.pathname, address),
    },
  };
}

function async31C21ExternalFragment(pointer) {
  const bytes = Buffer.from(pointer, "utf8");
  let fragment = "";
  for (const byte of bytes) {
    const literal = (byte >= 0x41 && byte <= 0x5a) || (byte >= 0x61 && byte <= 0x7a)
      || (byte >= 0x30 && byte <= 0x39) || [0x2d, 0x2e, 0x5f, 0x7e, 0x2f].includes(byte);
    fragment += literal ? String.fromCharCode(byte) : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return fragment;
}

function async31C21OwnerSourceRef(resolved, fallbackPointer) {
  if (!resolved || resolved.resourceIdentity === "#entry") return `#${resolved?.pointer || fallbackPointer}`;
  const fragment = async31C21ExternalFragment(resolved.pointer || fallbackPointer);
  return `${resolved.resourceIdentity}#${fragment}`;
}

function async31C21MembershipSourceRef(operationKey, occurrence) {
  return `#/operations/${async31PointerToken(operationKey)}#server[${occurrence.index}]=${occurrence.raw}`;
}

function async31C21InvalidEntry(sourceRef, operationKey) {
  return { sourceIndex: 0, sourceRef, scope: "target", status: "invalid",
    ...(operationKey === undefined ? {} : { operationKey }), rule: "ASYNC31-S-02", requirements: [] };
}

function async31C21NoCellEntry(operationKey) {
  return { sourceIndex: 0, sourceRef: `#/operations/${async31PointerToken(operationKey)}`,
    scope: "target", status: "excluded", operationKey, rule: "ASYNC31-S-05", requirements: [] };
}

// One common-kernel evaluation feeds both processor selection and synthesis.
// It is deliberately limited to the §4 Operation/Channel/Server closure; all
// deferred subgraphs remain lazy and cannot poison a surviving sibling.
function async31C21Kernel(given) {
  const loaded = async31C21LoadGiven(given);
  if (!loaded.ok) return { status: "load", given, operations: [], cells: [], coverage: [] };
  given = loaded.given;
  const source = given.source.content;
  const operations = [];
  const cells = [];
  const coverage = [];
  const serverInvalidSeen = new Set();
  if (Object.keys(source.operations || {}).some((key) => !c20bUnicodeScalarString(key))) {
    coverage.push(async31C21InvalidEntry("#/operations"));
    return { status: "ok", given, operations: [], cells: [], coverage };
  }
  for (const operationKey of Object.keys(source.operations || {})) {
    const opPointer = `/operations/${async31PointerToken(operationKey)}`;
    if (!c20bUnicodeScalarString(operationKey)) {
      coverage.push(async31C21InvalidEntry("#/operations"));
      operations.push({ valid: false });
      continue;
    }
    const opResolved = async31C21ResolveSlot(given, source.operations[operationKey], source, given.source.location, opPointer);
    const operation = opResolved.value;
    if (!opResolved.ok || !async31C21ComponentKeyValid(opResolved, "operations")
      || !operation || typeof operation !== "object" || Array.isArray(operation)
      || !["send", "receive"].includes(operation.action)
      || !operation.channel || typeof operation.channel !== "object" || Array.isArray(operation.channel)
      || typeof operation.channel.$ref !== "string") {
      const owner = opResolved.ok ? opResolved : (opResolved.failureOwner || opResolved);
      coverage.push(async31C21InvalidEntry(async31C21OwnerSourceRef(owner, opPointer), operationKey));
      operations.push({ operationKey, valid: false });
      continue;
    }
    if (opResolved.encodingExcluded) {
      coverage.push({ sourceIndex: 0, sourceRef: async31C21OwnerSourceRef(opResolved.encodingOwner || opResolved, opPointer), scope: "target",
        status: "excluded", operationKey, rule: "ASYNC31-S-07", requirements: [] });
      coverage.push(async31C21NoCellEntry(operationKey));
      operations.push({ operationKey, valid: true, excludedEncoding: true });
      continue;
    }
    const channelResolved = async31C21ResolveReference(given, operation.channel, opResolved.document, opResolved.base, {
      containingOwner: async31C21ResolvedIdentity(opResolved.resourceIdentity, opResolved.pointer),
    });
    const channel = channelResolved.value;
    const rootConcrete = async31C21TraversesRootSlot(opResolved, "operations");
    const channelAtRoot = async31C21TraversesRootSlot(channelResolved, "channels");
    if (!channelResolved.ok || !async31C21ComponentKeyValid(channelResolved, "channels")
      || !channel || typeof channel !== "object" || Array.isArray(channel)
      || (rootConcrete && !channelAtRoot)) {
      const owner = rootConcrete && channelResolved.ok ? opResolved
        : channelResolved.ok ? channelResolved : (channelResolved.failureOwner || channelResolved);
      coverage.push(async31C21InvalidEntry(async31C21OwnerSourceRef(owner, opPointer), operationKey));
      operations.push({ operationKey, valid: false });
      continue;
    }
    const membership = async31C21RootServerMembership(given, channelResolved);
    if (!membership.ok) {
      coverage.push(async31C21InvalidEntry(async31C21OwnerSourceRef(channelResolved, opPointer), operationKey));
      operations.push({ operationKey, valid: false });
      continue;
    }
    if (channelResolved.encodingExcluded) {
      coverage.push({ sourceIndex: 0, sourceRef: async31C21OwnerSourceRef(channelResolved.encodingOwner || channelResolved, opPointer), scope: "target",
        status: "excluded", operationKey, rule: "ASYNC31-S-07", requirements: [] });
      coverage.push(async31C21NoCellEntry(operationKey));
      operations.push({ operationKey, valid: true, excludedEncoding: true, membership });
      continue;
    }
    for (const occurrence of membership.rootInvalid) {
      const ownerRef = async31C21OwnerSourceRef(
        occurrence.owner || occurrence.resolved.failureOwner || occurrence.resolved.ledger?.[0]?.target,
        channelResolved.pointer
      );
      if (!serverInvalidSeen.has(ownerRef)) {
        coverage.push(async31C21InvalidEntry(ownerRef));
        serverInvalidSeen.add(ownerRef);
      }
    }
    for (const occurrence of membership.direct)
      coverage.push({ sourceIndex: 0, sourceRef: async31C21MembershipSourceRef(operationKey, occurrence), scope: "target",
        status: "excluded", operationKey, rule: "ASYNC31-S-06", requirements: [] });
    for (const occurrence of membership.directInvalid) {
      const ownerRef = async31C21OwnerSourceRef(
        occurrence.resolved.ok ? occurrence.resolved : occurrence.resolved.failureOwner,
        channelResolved.pointer
      );
      if (!serverInvalidSeen.has(ownerRef)) {
        coverage.push(async31C21InvalidEntry(ownerRef));
        serverInvalidSeen.add(ownerRef);
      }
    }
    for (const occurrence of membership.directEncoding) {
      const ownerRef = async31C21OwnerSourceRef(occurrence.resolved.encodingOwner || occurrence.resolved, channelResolved.pointer);
      if (!serverInvalidSeen.has(ownerRef)) {
        coverage.push({ sourceIndex: 0, sourceRef: ownerRef, scope: "target", status: "excluded", rule: "ASYNC31-S-07", requirements: [] });
        serverInvalidSeen.add(ownerRef);
      }
    }
    let rootCellCount = 0;
    for (const serverKey of membership.keys) {
      if (!Object.hasOwn(source.servers || {}, serverKey)) continue;
      const serverPointer = `/servers/${async31PointerToken(serverKey)}`;
      const serverResolved = async31C21ResolveSlot(given, source.servers[serverKey], source, given.source.location, serverPointer);
      const server = serverResolved.value;
      if (!/^[A-Za-z0-9_-]+$/.test(serverKey) || !serverResolved.ok
        || !async31C21ComponentKeyValid(serverResolved, "servers") || !server
        || typeof server !== "object" || Array.isArray(server)
        || typeof server.host !== "string" || typeof server.protocol !== "string") {
        const serverOwner = serverResolved.ok ? serverResolved : (serverResolved.failureOwner || serverResolved);
        const ownerRef = async31C21OwnerSourceRef(serverOwner, serverPointer);
        if (!serverInvalidSeen.has(ownerRef)) {
          coverage.push(async31C21InvalidEntry(ownerRef));
          serverInvalidSeen.add(ownerRef);
        }
        continue;
      }
      if (serverResolved.encodingExcluded) {
        const ownerRef = async31C21OwnerSourceRef(serverResolved.encodingOwner || serverResolved, serverPointer);
        if (!serverInvalidSeen.has(ownerRef)) {
          coverage.push({ sourceIndex: 0, sourceRef: ownerRef, scope: "target", status: "excluded", rule: "ASYNC31-S-07", requirements: [] });
          serverInvalidSeen.add(ownerRef);
        }
        continue;
      }
      rootCellCount++;
      const result = async31C21Profile(given, operationKey, serverKey);
      cells.push({ operationKey, serverKey, selector: `#/servers/${serverKey}/operations/${async31PointerToken(operationKey)}`, result });
    }
    if (rootCellCount === 0) coverage.push(async31C21NoCellEntry(operationKey));
    operations.push({ operationKey, valid: true, operation: opResolved, channel: channelResolved, membership });
  }
  return { status: "ok", given, operations, cells, coverage };
}

function async31C21Selector(given, selector) {
  const kernel = async31C21Kernel(given);
  if (kernel.status !== "ok") return { status: "load" };
  if (selector !== undefined) {
    const match = /^#\/servers\/([A-Za-z0-9_-]+)\/operations\/((?:[^~]|~[01])*)$/.exec(selector);
    if (!match) return { status: "resolution" };
    const operationKey = match[2].replaceAll("~1", "/").replaceAll("~0", "~");
    if (!c20bUnicodeScalarString(operationKey)) return { status: "resolution" };
    const cell = kernel.cells.find((candidate) => candidate.operationKey === operationKey && candidate.serverKey === match[1]);
    if (!cell) return { status: "resolution" };
    return cell.result;
  }
  const profiles = kernel.cells.filter((candidate) => candidate.result.status === "represented").map((candidate) => candidate.result.profile);
  return profiles.length === 1 ? { status: "represented", profile: profiles[0] } : { status: "resolution" };
}

function async31C21DispatchFacts(profile) {
  const headerBlock = `Host: ${profile.authority}\r\n\r\n`;
  return {
    httpVersion: "1.1", method: "POST", scheme: "http",
    authority: profile.authority, path: profile.path,
    queryContributions: [],
    headerContributions: [{ kind: "value", name: "Host", value: profile.authority }],
    originFormSha256: createHash("sha256").update(profile.path, "utf8").digest("hex"),
    headerBlockSha256: createHash("sha256").update(headerBlock, "utf8").digest("hex"),
    body: { kind: "absent" },
  };
}

const ASYNC31_C21_INPUT_SCHEMA = Object.freeze({ type: "object", properties: {}, additionalProperties: false });

function async31C21ContractExact(scenario) {
  const operation = scenario.given?.operation;
  const binding = scenario.given?.binding;
  return operation && typeof operation === "object" && !Array.isArray(operation)
    && jsonValueEqual(operation.input, ASYNC31_C21_INPUT_SCHEMA)
    && !Object.hasOwn(operation, "output")
    && binding && !Object.hasOwn(binding, "inputTransform") && !Object.hasOwn(binding, "outputTransform");
}

function async31C21HeadLocallyValid(event, disabledGuard) {
  if (event?.httpVersion !== "1.1" || !Number.isInteger(event.status)
    || !Array.isArray(event.headers) || event.headers.some(h=>!h || typeof h!=="object")) return false;
  // Qualify a prospective head with the SAME C20B rules before acknowledging
  // it or satisfying a caller barrier. Only as-yet-unobserved completion/body
  // is deferred; missing framing and malformed fields are already decisive.
  const subject = {method:"POST",replySelected:false,events:[{kind:"head",status:event.status,headers:event.headers}],
    native:[],preOpenCancellationRequiresClose:false};
  const deferred = new Set(["HTTP-NATIVE-VACUOUS","HTTP-CONTENT-LENGTH-MISMATCH","HTTP-PEER-INCOMPLETE"]);
  return c20bResponseViolations(subject,"C21 prospective head",disabledGuard)
    .every(violation=>deferred.has(violation.split(":",1)[0]));
}

function async31C21Prefix(profile) {
  return [
    { kind: "input-accepted", index: 0 },
    { kind: "native", name: "connection-attempted", facts: { transport: "cleartext", scheme: "http", authority: profile.authority } },
    { kind: "native", name: "connection-opened", facts: { transport: "cleartext" } },
    { kind: "native", name: "request-started", facts: { httpVersion: "1.1", octetsSentDecimal: "1" } },
    { kind: "native", name: "dispatch", facts: async31C21DispatchFacts(profile) },
  ];
}

function async31C21TriggerMatches(trigger, kind, name, count = 1) {
  return trigger?.kind === kind && (kind !== "native" || (trigger.name === name && trigger.count === count));
}

function async31C21C20bSubject(events, timeline, terminalOutcome) {
  let final;
  let received = 0n;
  const c20Events = events.map((event) => {
    if (event.kind === "response-head") {
      if (event.status >= 200 && event.status <= 599) final = event;
      return { kind: "head", status: event.status, headers: event.headers };
    }
    if (event.kind === "body-chunk") {
      if (canonicalBase64(event.dataBase64)) received += BigInt(Buffer.from(event.dataBase64, "base64").length);
      return { kind: "body", dataBase64: event.dataBase64 };
    }
    const lengthField = final?.headers?.find((field) => typeof field.name === "string" && field.name.toLowerCase() === "content-length");
    const payloadForbidden = final && [204, 205, 304].includes(final.status);
    const expected = payloadForbidden ? 0n
      : lengthField && /^(?:0|[1-9][0-9]*)$/.test(lengthField.value) ? BigInt(lengthField.value) : undefined;
    const complete = final && expected !== undefined && received === expected;
    return { kind: "disconnect", stage: complete ? "terminal"
      : event.stage === "before-connect" || event.stage === "during-tls" ? "tls"
        : event.stage === "before-request" ? "before-request"
          : event.stage === "during-request" ? "request" : "response" };
  });
  const native = timeline.filter((event) => event.kind === "native").map((event) => {
    if (event.name === "acknowledgement")
      return { name: event.name, phase: event.facts.stage, status: event.facts.status };
    if (event.name === "cancellation-propagated") {
      const stage = event.facts.stage === "before-connect" ? "tls"
        : event.facts.stage === "before-request" ? "before-request"
          : event.facts.stage === "during-request" ? "request" : "response";
      return { name: event.name, stage };
    }
    return { name: event.name };
  });
  native.push({ name: "terminal", outcome: terminalOutcome });
  return { method: "POST", replySelected: false, events: c20Events, native,
    // The C21 cleartext mapper distinguishes a connection attempt from an
    // opened transport and therefore has nothing to close before open.
    preOpenCancellationRequiresClose: false };
}

// Caller actions and peer events are two ordered streams.  An await-native is
// the only boundary that admits peer evidence before a later caller cancel;
// once that boundary is satisfied, the next caller action wins over any
// unacknowledged peer-script suffix.  This makes every represented race
// deterministic without assigning wall-clock meaning to array order.
function async31C21ActionBoundary(actions, events, profile) {
  if (!Array.isArray(actions)) return { ok: true, cancelled: false };
  const writes = actions.filter((action) => action?.kind === "write");
  const cancels = actions.filter((action) => action?.kind === "cancel");
  if (writes.length !== 1 || actions[0]?.kind !== "write" || cancels.length > 1
    || (cancels.length === 1 && actions.at(-1)?.kind !== "cancel")
    || actions.some((action) => !["write", "await-native", "cancel"].includes(action?.kind)))
    return { ok: false, phase: "interaction", timeline: [{ kind: "input-accepted", index: 0 }] };
  let prefixLength = 2;
  let acknowledged = 0;
  let priorAckBarrier = 0;
  let priorNativeRank = 0;
  let peerPrefix = [];
  const acknowledgementTimeline = [];
  let completedFinal = false;
  const boundaryActions = cancels.length ? actions.slice(1, -1) : actions.slice(1);
  for (const action of boundaryActions) {
    if (completedFinal)
      return { ok: false, phase: "interaction", timeline: [
        ...async31C21Prefix(profile), ...acknowledgementTimeline,
      ] };
    if (action.kind !== "await-native" || !Number.isInteger(action.count) || action.count < 1)
      return { ok: false, phase: "interaction", timeline: async31C21Prefix(profile).slice(0, prefixLength) };
    if (["connection-attempted", "connection-opened", "request-started", "dispatch"].includes(action.name)) {
      const rank = {
        "connection-attempted": 2,
        "connection-opened": 3,
        "request-started": 4,
        dispatch: 5,
      }[action.name];
      if (action.count !== 1 || rank < priorNativeRank)
        return { ok: false, phase: "interaction", timeline: async31C21Prefix(profile).slice(0, prefixLength) };
      priorNativeRank = rank;
      prefixLength = Math.max(prefixLength, rank);
      continue;
    }
    if (action.name !== "acknowledgement" || action.count <= priorAckBarrier)
      return { ok: false, phase: "interaction", timeline: async31C21Prefix(profile).slice(0, prefixLength) };
    prefixLength = 5;
    priorNativeRank = 6;
    priorAckBarrier = action.count;
    let eventIndex = 0;
    acknowledged = 0;
    const nextTimeline = [];
    let final;
    while (eventIndex < events.length && acknowledged < action.count) {
      const event = events[eventIndex++];
      if (event.kind !== "response-head" || !async31C21HeadLocallyValid(event)
        || (final !== undefined)
        || !async31C21TriggerMatches(event.after, "native",
          acknowledged === 0 ? "dispatch" : "acknowledgement",
          acknowledged === 0 ? 1 : acknowledged)) {
        return { ok: false, phase: "response", timeline: [
          ...async31C21Prefix(profile), ...nextTimeline,
        ] };
      }
      acknowledged++;
      const stage = event.status < 200 ? "interim" : "final";
      nextTimeline.push({ kind: "native", name: "acknowledgement", facts: {
        httpVersion: "1.1", stage, status: event.status, headers: event.headers,
      } });
      if (stage === "final") final = event;
    }
    if (acknowledged !== action.count)
      return { ok: false, phase: "response", timeline: [
        ...async31C21Prefix(profile), ...nextTimeline,
      ] };
    peerPrefix = events.slice(0, eventIndex);
    acknowledgementTimeline.splice(0, acknowledgementTimeline.length, ...nextTimeline);
    if (final) {
      const lengths = final.headers.filter((field) => field.name.toLowerCase() === "content-length");
      completedFinal = [204, 205, 304].includes(final.status)
        || (lengths.length === 1 && lengths[0].value === "0");
    }
  }
  if (!cancels.length) return { ok: true, cancelled: false };
  const stage = prefixLength < 3 ? "before-connect"
    : prefixLength < 4 ? "before-request"
      : prefixLength < 5 ? "during-request" : "response";
  return { ok: true, cancelled: !completedFinal, completedFinal, prefixLength, stage,
    peerPrefix, acknowledgementTimeline };
}

// Shared HTTP peer@2 mapper for the represented AsyncAPI cell.  It consumes
// the dialect's peer script, validates the exact causal trigger available at
// each step, and exposes a closed mapped-observation classification plus
// coverage tokens.  C21 processing then consumes this result; it does not
// reinterpret the peer script in a profile-private response loop.
function httpPeerV2MappedObservation(events, profile) {
  const fullPrefix = async31C21Prefix(profile);
  const firstDisconnectTrigger = events[0]?.kind === "disconnect" ? events[0].after : undefined;
  const timeline = fullPrefix.slice(0,
    firstDisconnectTrigger?.name === "connection-attempted" ? 2
      : firstDisconnectTrigger?.name === "connection-opened" ? 3
        : firstDisconnectTrigger?.name === "request-started" ? 4 : fullPrefix.length
  );
  const coverageTokens = new Set(["http-peer@2:map"]);
  let finalStatus;
  let finalLength;
  let received = 0n;
  let invalid = false;
  let disconnected = false;
  let headCount = 0;
  for (const [eventIndex, event] of events.entries()) {
    const priorFinal = finalStatus !== undefined;
    if (event.kind === "response-head") {
      coverageTokens.add("http-peer@2:response-head");
      if (!async31C21HeadLocallyValid(event)) { invalid = true; break; }
      const triggerValid = headCount === 0
        ? async31C21TriggerMatches(event.after, "native", "dispatch", 1)
        : async31C21TriggerMatches(event.after, "native", "acknowledgement", headCount);
      if (!triggerValid || finalStatus !== undefined) { invalid = true; break; }
      headCount++;
      if (event.status < 200) {
        coverageTokens.add("http-peer@2:interim");
        timeline.push({ kind: "native", name: "acknowledgement", facts: {
          httpVersion: "1.1", stage: "interim", status: event.status, headers: event.headers,
        } });
      } else {
        coverageTokens.add("http-peer@2:final");
        finalStatus = event.status;
        const length = event.headers.find((field) => typeof field.name === "string"
          && field.name.toLowerCase() === "content-length");
        finalLength = event.status === 304 ? 0n
          : length && /^(?:0|[1-9][0-9]*)$/.test(length.value) ? BigInt(length.value) : 0n;
        timeline.push({ kind: "native", name: "acknowledgement", facts: {
          httpVersion: "1.1", stage: "final", status: event.status, headers: event.headers,
        } });
      }
    } else if (event.kind === "body-chunk") {
      coverageTokens.add("http-peer@2:body");
      if (finalStatus === undefined || !canonicalBase64(event.dataBase64)
        || !async31C21TriggerMatches(event.after, "native", "acknowledgement", headCount)) { invalid = true; break; }
      received += BigInt(Buffer.from(event.dataBase64, "base64").length);
    } else if (event.kind === "disconnect") {
      coverageTokens.add("http-peer@2:disconnect");
      const derived = event.after?.name === "connection-attempted" && event.after?.count === 1 && headCount === 0
        ? "before-connect"
        : event.after?.name === "connection-opened" && event.after?.count === 1 && headCount === 0
          ? "before-request"
          : event.after?.name === "request-started" && event.after?.count === 1 && headCount === 0
            ? "during-request"
            : event.after?.name === "dispatch" && event.after?.count === 1 && headCount === 0
              ? "before-response"
              : event.after?.name === "acknowledgement" && event.after?.count === headCount && headCount > 0
                ? "during-response" : undefined;
      if (!derived || event.stage !== derived) invalid = true;
      disconnected = true;
      const frameComplete = priorFinal && finalLength !== undefined && received === finalLength;
      const closeStage = frameComplete ? "terminal"
        : ["before-connect", "before-request"].includes(derived) ? "connect"
          : derived === "during-request" ? "request" : "response";
      timeline.push({ kind: "native", name: "connection-closed", facts: {
        origin: "peer", stage: closeStage, reason: "peer-disconnect",
      } });
      if (eventIndex !== events.length - 1) invalid = true;
      break;
    } else {
      invalid = true;
      break;
    }
  }
  const classification = invalid ? "protocol-error"
    : disconnected && finalStatus === undefined ? "peer-disconnect"
      : finalStatus === undefined ? "incomplete"
        : finalStatus >= 200 && finalStatus <= 299 ? "successful-final" : "unsuccessful-final";
  coverageTokens.add(`http-peer@2:${classification}`);
  return { timeline, finalStatus, finalLength, received, invalid, disconnected, headCount,
    classification, coverageTokens: [...coverageTokens].sort() };
}

function async31C21TraceObservation(scenario) {
  const refused = phase => ({disposition:"refusal",phase,timeline:[],outputs:[],traceStatus:"not-observed"});
  const selected = async31C21Selector(scenario.given, scenario.given?.binding?.selector);
  const configuration = scenario.given?.configuration;
  if (selected.status === "load")
    return refused("load");
  if (selected.status === "resolution" || selected.status === "unavailable")
    return refused("resolution");
  if (selected.status !== "represented"
    || (configuration !== undefined && (!configuration || Array.isArray(configuration) || Object.keys(configuration).length)))
    return refused("pre-dispatch");
  if (scenario.given?.peer?.dialect !== "openbindings.asyncapi-http-peer@2"
    || scenario.given?.peer?.script?.transport !== "cleartext")
    return refused("pre-dispatch");
  const profile = selected.profile;
  if (!async31C21ContractExact(scenario))
    return refused("pre-dispatch");

  const invocation = scenario.given.invocation || {};
  const actions = Array.isArray(invocation.actions) ? invocation.actions : undefined;
  const writes = actions ? actions.filter((action) => action?.kind === "write") : [];
  const supplied = actions ? writes.map((action) => action.value) : invocation.inputPresent ? [invocation.input] : [];
  if (supplied.length !== 1 || !jsonValueEqual(supplied[0], {}))
    return refused("pre-dispatch");
  const events = scenario.given.peer?.script?.events || [];
  const actionBoundary = async31C21ActionBoundary(actions, events, profile);
  if (!actionBoundary.ok)
    return { disposition: "error", phase: actionBoundary.phase, timeline: actionBoundary.timeline, outputs: [], traceStatus:"invalid", scheduled:true };
  if (actionBoundary.cancelled) {
    const full = async31C21Prefix(profile);
    const timeline = [
      ...full.slice(0, actionBoundary.prefixLength),
      ...actionBoundary.acknowledgementTimeline,
      { kind: "native", name: "cancellation-propagated", facts: { stage: actionBoundary.stage } },
    ];
    // A connection attempt is observable before open, but there is no opened
    // transport to close.  Every later cancellation closes exactly once.
    if (actionBoundary.prefixLength >= 3) timeline.push({ kind: "native", name: "connection-closed", facts: {
      origin: "local", stage: actionBoundary.stage === "response" ? "response" : "request", reason: "cancelled",
    } });
    const mappedPrefix = actionBoundary.peerPrefix.length
      ? httpPeerV2MappedObservation(actionBoundary.peerPrefix, profile) : undefined;
    if (mappedPrefix?.invalid)
      return { disposition: "error", phase: "response", timeline, outputs: [], traceStatus:"invalid", scheduled:true };
    const c20b = async31C21C20bSubject(actionBoundary.peerPrefix, timeline, "error");
    if (c20bResponseViolations(c20b, `${scenario.id}.C20B`).length)
      return { disposition: "error", phase: "response", timeline, outputs: [], traceStatus:"invalid", scheduled:true };
    return { disposition: "cancelled", phase: "interaction", timeline, outputs: [], traceStatus:"valid", scheduled:true };
  }

  const mapped = httpPeerV2MappedObservation(events, profile);
  const { timeline, finalStatus, finalLength, received, disconnected } = mapped;
  let invalid = mapped.invalid;
  const c20b = async31C21C20bSubject(events, timeline, disconnected && finalStatus === undefined ? "error" : "complete");
  const qualification = c20bResponseViolations(c20b, `${scenario.id}.C20B`);
  // End of an authored observation prefix is not a peer EOF. These are the
  // total-trace guards whose absence can still be supplied by a future event;
  // any locally decidable grammar/chronology/body failure remains terminal.
  const incompleteGuards = new Set(["HTTP-CONTENT-LENGTH-MISMATCH", "HTTP-PEER-INCOMPLETE", "HTTP-PEER-VACUOUS", "HTTP-TERMINAL-OUTCOME"]);
  if (!mapped.invalid && !disconnected && (finalStatus === undefined || received < finalLength)
    && qualification.every(v => incompleteGuards.has(v.split(":",1)[0])))
    return { disposition: "pending", phase: "response", timeline, outputs: [], traceStatus:"incomplete" };
  const awaitsClose = !mapped.invalid && !disconnected && finalStatus !== undefined && received === finalLength
    && qualification.length === 1 && qualification[0].startsWith("HTTP-NATIVE-SUFFIX:")
    && events.some(event=>event.kind==="response-head" && event.status>=200
      && event.headers.some(field=>field.name.toLowerCase()==="connection" && field.value.trim().toLowerCase()==="close"));
  if (qualification.length && !awaitsClose) invalid = true;
  if (disconnected && finalStatus === undefined)
    return { disposition: "error", phase: "interaction", timeline, outputs: [], traceStatus:invalid?"invalid":"valid" };
  if (invalid || finalStatus === undefined || (finalLength !== undefined && received !== finalLength)
    || (finalStatus >= 200 && finalStatus <= 299 && received !== 0n))
    return { disposition: "error", phase: "response", timeline, outputs: [], traceStatus:"invalid" };
  if (finalStatus >= 200 && finalStatus <= 299)
    return { disposition: "complete", phase: "completion", timeline, outputs: [], traceStatus:awaitsClose?"incomplete":"valid" };
  return { disposition: "error", phase: "completion", timeline, outputs: [], traceStatus:awaitsClose?"incomplete":"valid" };
}

// Reuse the qualified HTTP mapper/field/framing/FSM predicates for both axes.
// A finite whole-trace failure cannot overwrite a previously framed result.
function async31C21Observation(scenario) {
  const whole = async31C21TraceObservation(scenario);
  const qualify = ({traceStatus,scheduled,...live}) => {
    if (!revisionSixTimelineEqual(whole.timeline.slice(0,live.timeline.length),live.timeline))
      throw new Error('C21 live timeline is not an exact prefix of governed trace');
    return {...live, trace: {status:whole.traceStatus, afterTerminal:whole.timeline.slice(live.timeline.length)}};
  };
  if (whole.disposition === "refusal" || whole.scheduled) return qualify(whole);
  const events = scenario.given?.peer?.script?.events || [];
  const prefix = [];
  let remaining;
  for (const event of events) {
    let current = event;
    if (event.kind === "response-head" && event.status >= 200 && async31C21HeadLocallyValid(event)) {
      const length = event.headers.find(field => field.name.toLowerCase() === "content-length");
      remaining = event.status === 304 ? 0n : BigInt(length?.value ?? "0");
    } else if (event.kind === "body-chunk" && remaining !== undefined && canonicalBase64(event.dataBase64)) {
      const bytes = Buffer.from(event.dataBase64,"base64");
      // Split an overshooting read at the HTTP boundary, not the TCP/script
      // chunk boundary. No numeric conversion of an unbounded authored length.
      if (BigInt(bytes.length) > remaining)
        current = {...event, dataBase64: bytes.subarray(0,Number(remaining)).toString("base64")};
      remaining -= BigInt(Buffer.from(current.dataBase64,"base64").length);
    }
    prefix.push(current);
    // The full action boundary has already been validated. Cancellation and
    // malformed action prefixes returned above. Replay only the admitted HTTP
    // prefix, without inventing an unsatisfied future caller await in it.
    const candidate = async31C21TraceObservation({...scenario, given: {...scenario.given,
      invocation:{inputPresent:true,input:{}},
      peer: {...scenario.given.peer, script: {...scenario.given.peer.script, events: prefix}}}});
    if (candidate.disposition !== "pending") return qualify(candidate);
  }
  return qualify(whole);
}

function async31C21ProcessorViolations(scenario, at) {
  if (!async31C21Supports("processor", scenario.id)) return [];
  if (scenario.expected.some(expected=>!expected.trace))
    return [`${at}: C21 execution requires explicit finite-trace qualification on every alternative`];
  if (!scenario.rules.includes("ASYNC31-P-13") || scenario.expected.some(expected=>!expected.rules.includes("ASYNC31-P-13")))
    return [`${at}: every C21 trace assertion requires its ASYNC31-P-13 lifecycle owner`];
  const materializationViolations = async31KeyMaterializationViolations(
    scenario.given, scenario.given?.keyMaterializations, `${at}.given.keyMaterializations`
  );
  if (materializationViolations.length) return materializationViolations;
  const observation = async31C21Observation(scenario);
  return scenario.expected.some((expected) => revisionSixAlternativeMatches(observation, expected)
    && jsonValueEqual(observation.trace, expected.trace))
    ? [] : [`${at}: C21 interpreter outcome does not match any expected alternative`];
}

function async31C21Synthesis(scenario) {
  const given = { source: scenario.source, resources: scenario.resources, resourceBytes: scenario.resourceBytes,
    keyMaterializations: scenario.keyMaterializations };
  const kernel = async31C21Kernel(given);
  if (kernel.status !== "ok") return { outcome: "refused", operations: [], bindings: [], coverage: { exhaustive: true, fullyRepresented: false, entries: [] }, document: undefined };
  const source = kernel.given.source.content;
  const operations = [];
  const bindings = [];
  const entries = [...kernel.coverage];
  const sourceKey = async31GeneratedKey("source", 0);
  const document = { sources: { [sourceKey]: scenario.source }, operations: {}, bindings: {} };
  for (const rootOperationKey of Object.keys(source.operations || {})) {
    const candidates = kernel.cells.filter((cell) => cell.operationKey === rootOperationKey)
      .filter(({ result }) => result.status !== "unavailable" && result.status !== "resolution");
    const representedProfiles = candidates.filter(({ result }) => result.status === "represented")
      .map(({ result }) => result.profile);
    const generatedOperationKey = async31GeneratedKey("operation", 0, rootOperationKey);
    const outputOperationKey = representedProfiles.length ? generatedOperationKey : rootOperationKey;
    if (representedProfiles.length) {
      operations.push(generatedOperationKey);
      document.operations[generatedOperationKey] = { input: ASYNC31_C21_INPUT_SCHEMA };
    }
    for (const { serverKey, result } of candidates) {
      const selector = `#/servers/${serverKey}/operations/${async31PointerToken(rootOperationKey)}`;
      if (result.status === "represented") {
        bindings.push({ operationKey: generatedOperationKey, bindingSelector: selector });
        const bindingKey = async31GeneratedKey("binding", 0, selector);
        document.bindings[bindingKey] = { operation: generatedOperationKey, source: sourceKey, selector };
        entries.push({ sourceIndex: 0, sourceRef: selector, scope: "protocol-cell", status: "represented", operationKey: generatedOperationKey, bindingSelector: selector, rule: "ASYNC31-S-08", requirements: [] });
      } else {
        entries.push({ sourceIndex: 0, sourceRef: selector, scope: "protocol-cell", status: "excluded", operationKey: outputOperationKey, bindingSelector: selector, rule: "ASYNC31-S-03", requirements: [] });
      }
    }
    for (const profile of representedProfiles)
      entries.push({ sourceIndex: 0, sourceRef: profile.messageSourceRef, scope: "message-alternative", status: "represented", operationKey: generatedOperationKey, bindingSelector: `#/servers/${profile.serverKey}/operations/${async31PointerToken(rootOperationKey)}`, rule: "ASYNC31-S-11", requirements: [] });
  }
  return { operations, bindings, coverage: { exhaustive: true, fullyRepresented: entries.every((entry) => entry.status === "represented"), entries }, document };
}

function async31C21SynthesisViolations(scenario, at) {
  if (!async31C21Supports("synthesis", scenario.id)) return [];
  const violations = async31KeyMaterializationViolations(
    scenario, scenario.keyMaterializations, `${at}.keyMaterializations`
  );
  const actual = async31C21Synthesis(scenario);
  if (scenario.expected?.outcome !== "synthesized")
    return actual.outcome === "refused" ? violations : [...violations, `${at}: C21 expected synthesis refusal but common-kernel load succeeded`];
  if (actual.outcome === "refused") return [...violations, `${at}: C21 common-kernel load refused a synthesized scenario`];
  for (const key of ["operations", "bindings"])
    if (!jsonValueEqual(actual[key], scenario.expected[key])) violations.push(`${at}: C21 derived ${key} differs from expected evidence`);
  if (actual.coverage.exhaustive !== scenario.expected.coverage.exhaustive
    || actual.coverage.fullyRepresented !== scenario.expected.coverage.fullyRepresented
    || !jsonValueSetEqual(actual.coverage.entries, scenario.expected.coverage.entries))
    violations.push(`${at}: C21 derived coverage differs from expected evidence`);
  const actualS06 = actual.coverage.entries.filter((entry) => entry.rule === "ASYNC31-S-06");
  const expectedS06 = scenario.expected.coverage.entries.filter((entry) => entry.rule === "ASYNC31-S-06");
  if (!jsonValueEqual(actualS06, expectedS06))
    violations.push(`${at}: C21 direct-membership S06 occurrence order/identity differs from expected evidence`);
  for (const assertion of scenario.expected.assertions || []) {
    const matches = assertion.surface === "coverage-inventory"
      ? assertion.path === "/" && jsonValueSetEqual(assertion.setEquals, revisionSixCoverageInventory(actual.coverage.entries))
      : revisionSixAssertionMatches(actual.document, assertion);
    if (!matches) violations.push(`${at}: C21 emitted evidence assertion does not match (${assertion.path})`);
  }
  return violations;
}

function revisionSixSynthesisViolations(fixture, label) {
  if (![SYNTHESIS_V6, SYNTHESIS_V7].includes(fixture?.format) || !Array.isArray(fixture?.scenarios)) return [];
  const violations = [];
  for (const [scenarioIndex, scenario] of fixture.scenarios.entries()) {
    const at = `${label}.scenarios[${scenarioIndex}]`;
    violations.push(...resourceCarrierViolations(scenario, at));
    const citedRules = new Set(scenario?.rules || []);
    const evidenceRules = new Set(revisionSixSynthesisEvidenceRules(scenario));
    for (const rule of citedRules) {
      if (!evidenceRules.has(rule))
        violations.push(`${at}.rules: citation '${rule}' has no owned expected evidence`);
    }
    for (const rule of evidenceRules) {
      if (!citedRules.has(rule))
        violations.push(`${at}.rules: expected evidence owned by '${rule}' is not cited`);
    }
    if (scenario?.expected?.outcome !== "synthesized") continue;
    for (const [assertionIndex, assertion] of (scenario.expected.assertions || []).entries()) {
      if (!assertion.rule)
        violations.push(`${at}.expected.assertions[${assertionIndex}]: revision-6 synthesis assertions require a governing rule`);
      if (assertion.surface === "coverage-inventory") {
        if (assertion.path !== "/")
          violations.push(`${at}.expected.assertions[${assertionIndex}]: coverage-inventory assertions require path '/'`);
        const actualInventory = revisionSixCoverageInventory(scenario.expected.coverage?.entries);
        if (!jsonValueSetEqual(assertion.setEquals, actualInventory))
          violations.push(`${at}.expected.assertions[${assertionIndex}]: coverage-inventory assertion is not the exact normalized coverage identity set`);
      }
    }
    const operationKeys = new Set(scenario.expected.operations || []);
    const bindingIdentities = new Set();
    for (const binding of scenario.expected.bindings || []) {
      const identity = `${binding.operationKey}\0${binding.bindingSelector}`;
      if (bindingIdentities.has(identity))
        violations.push(`${at}: revision-6 synthesis contains a duplicate binding identity`);
      bindingIdentities.add(identity);
      if (!operationKeys.has(binding.operationKey))
        violations.push(`${at}: binding identity references operation '${binding.operationKey}' absent from expected.operations`);
    }
    const coverageIdentities = new Set();
    const representedBindingIdentities = new Set();
    const representedOperations = new Set();
    for (const [entryIndex, entry] of (scenario.expected.coverage?.entries || []).entries()) {
      const identity = [
        entry.sourceIndex,
        entry.sourceRef,
        entry.scope,
        entry.operationKey || "",
        entry.bindingSelector || "",
      ].join("\0");
      if (coverageIdentities.has(identity))
        violations.push(
          `${at}.expected.coverage.entries[${entryIndex}]: revision-6 synthesis duplicates a semantic coverage identity`
        );
      coverageIdentities.add(identity);
      if (!entry.rule)
        violations.push(
          `${at}.expected.coverage.entries[${entryIndex}]: revision-6 synthesis coverage entries require a governing rule`
        );
      if (entry.status === "represented" && entry.operationKey) {
        representedOperations.add(entry.operationKey);
        if (entry.bindingSelector !== undefined)
          representedBindingIdentities.add(`${entry.operationKey}\0${entry.bindingSelector}`);
      }
    }
    for (const identity of bindingIdentities) {
      if (!representedBindingIdentities.has(identity))
        violations.push(`${at}: expected binding identity has no represented coverage owner`);
    }
    for (const operationKey of operationKeys) {
      if (!representedOperations.has(operationKey))
        violations.push(`${at}: expected operation '${operationKey}' has no represented coverage owner`);
    }
    if (fixture.family === "asyncapi-3.1")
      violations.push(...async31CoverageAlgebraViolations(scenario, at));
  }
  return violations;
}

// Extracts family D-rule ids from a family spec's Conformance section. Older
// families use list items; the OpenAPI siblings use labeled paragraphs.
function extractFamilyRules(md, prefix) {
  const rules = new Set();
  const re = new RegExp(`\\*\\*(${prefix}-D-\\d+)\\*\\*`, "g");
  let m;
  while ((m = re.exec(md)) !== null) rules.add(m[1]);
  return rules;
}

// Extracts every rule identifier a family spec defines (D-, P-, and S-rules),
// for resolving corpus citations against their owning specification.
function extractAllRuleIds(md, prefix) {
  const ids = new Set();
  const re = new RegExp(`\\*\\*(${prefix}-[DPS]-\\d+)\\*\\*`, "g");
  let m;
  while ((m = re.exec(md)) !== null) ids.add(m[1]);
  return ids;
}

function extractFamilyPRules(md, prefix) {
  const rules = new Set();
  const re = new RegExp(`\\*\\*(${prefix}-P-\\d+)\\*\\*`, "g");
  let m;
  while ((m = re.exec(md)) !== null) rules.add(m[1]);
  return rules;
}

function extractCoreRules(md) {
  const rules = new Set();
  const re = /^\s*-\s*\*\*(OBI-[BDT]-\d+)\*\*[^:]*:/gm;
  let m;
  while ((m = re.exec(md)) !== null) rules.add(m[1]);
  return rules;
}

function extractCoreSpecificationVersion(md) {
  const matches = [
    ...md.matchAll(
      /^This is \*\*version (\d+\.\d+\.\d+)\*\* of the OpenBindings specification\./gm
    ),
  ];
  return matches.map((match) => match[1]);
}

function verifyOpenApiCoreAuthority(md, label, expectedVersion) {
  const declarations = [
    ...md.matchAll(
      /incorporates exactly version \*\*(\d+\.\d+\.\d+)\*\* of the \[OpenBindings Specification\]\(\.\.\/\.\.\/openbindings\.md\) as its Core authority\. Throughout this document, \*\*Core\*\* means that exact version; no other Core version is incorporated\./g
    ),
  ].map((match) => match[1]);
  if (declarations.length !== 1) {
    errors.push(
      `${label}: must declare exactly one versioned OpenBindings Core authority in §2 (found ${declarations.length})`
    );
  } else if (expectedVersion && declarations[0] !== expectedVersion) {
    errors.push(
      `${label}: declares OpenBindings Core ${declarations[0]}, but openbindings.md declares ${expectedVersion}`
    );
  }

  const sectionMatches = [...md.matchAll(/^## 13\. Normative references\s*$/gm)];
  if (sectionMatches.length !== 1) {
    errors.push(`${label}: must contain exactly one §13 Normative references section`);
    return;
  }
  const references = md.slice(sectionMatches[0].index);
  const coreReferences = [
    ...references.matchAll(
      /^- \[OpenBindings Specification (\d+\.\d+\.\d+)\]\(\.\.\/\.\.\/openbindings\.md\)$/gm
    ),
  ].map((match) => match[1]);
  if (coreReferences.length !== 1) {
    errors.push(
      `${label}: §13 must contain exactly one versioned OpenBindings Specification reference (found ${coreReferences.length})`
    );
  } else if (expectedVersion && coreReferences[0] !== expectedVersion) {
    errors.push(
      `${label}: §13 references OpenBindings ${coreReferences[0]}, but openbindings.md declares ${expectedVersion}`
    );
  }
  if (
    declarations.length === 1 &&
    coreReferences.length === 1 &&
    declarations[0] !== coreReferences[0]
  ) {
    errors.push(
      `${label}: §2 Core declaration and §13 Core reference name different versions`
    );
  }
}

function verifyAsync31CoreAuthority(md, label, expectedVersion) {
  const declarations = [...md.matchAll(
    /incorporates exactly version \*\*(\d+\.\d+\.\d+)\*\* of the\s+\[OpenBindings Specification\]\(\.\.\/\.\.\/openbindings\.md\) as its Core authority\.\s+Throughout this document, \*\*Core\*\* means that exact version; no other Core\s+version is incorporated\./g
  )].map((match) => match[1]);
  if (declarations.length !== 1)
    errors.push(`${label}: must declare exactly one versioned OpenBindings Core authority in §2 (found ${declarations.length})`);
  else if (expectedVersion && declarations[0] !== expectedVersion)
    errors.push(`${label}: declares OpenBindings Core ${declarations[0]}, but openbindings.md declares ${expectedVersion}`);
  const sectionMatches = [...md.matchAll(/^## 7\. Normative references\s*$/gm)];
  if (sectionMatches.length !== 1) {
    errors.push(`${label}: must contain exactly one §7 Normative references section`);
    return;
  }
  const references = md.slice(sectionMatches[0].index);
  const coreReferences = [...references.matchAll(
    /^- \*\*\[incorporated\]\*\* \[OpenBindings Specification (\d+\.\d+\.\d+)\]\(\.\.\/\.\.\/openbindings\.md\)$/gm
  )].map((match) => match[1]);
  if (coreReferences.length !== 1)
    errors.push(`${label}: §7 must contain exactly one versioned OpenBindings Specification reference (found ${coreReferences.length})`);
  else if (expectedVersion && coreReferences[0] !== expectedVersion)
    errors.push(`${label}: §7 references OpenBindings ${coreReferences[0]}, but openbindings.md declares ${expectedVersion}`);
  if (declarations.length === 1 && coreReferences.length === 1 && declarations[0] !== coreReferences[0])
    errors.push(`${label}: §2 Core declaration and §7 Core reference name different versions`);
}

const ASYNC31_REQUIRED_RULES = new Set([
  "ASYNC31-D-01", "ASYNC31-D-02", "ASYNC31-D-03", "ASYNC31-D-04",
  "ASYNC31-D-05", "ASYNC31-D-06", "ASYNC31-D-07",
  "ASYNC31-P-01", "ASYNC31-P-02", "ASYNC31-P-03", "ASYNC31-P-04",
  "ASYNC31-P-05", "ASYNC31-P-06", "ASYNC31-P-07", "ASYNC31-P-08",
  "ASYNC31-P-09", "ASYNC31-P-10", "ASYNC31-P-11", "ASYNC31-P-12", "ASYNC31-P-13",
  "ASYNC31-S-01", "ASYNC31-S-02", "ASYNC31-S-03", "ASYNC31-S-04",
  "ASYNC31-S-05", "ASYNC31-S-06", "ASYNC31-S-07", "ASYNC31-S-08",
  "ASYNC31-S-09", "ASYNC31-S-10", "ASYNC31-S-11",
]);

function async31RuleDefinitionAnalysis(md, label) {
  const definitions = new Map();
  const violations = [];
  let section;
  for (const [lineIndex, line] of md.split(/\r?\n/).entries()) {
    const heading = /^#{2,4}\s+(\d+(?:\.\d+)*)\.?\s/.exec(line);
    if (heading) section = heading[1];
    const definition = /^\*\*\[[^\]]+\]\*\* \*\*(ASYNC31-[DPS]-\d+)\*\* —\s/.exec(line);
    if (!definition) continue;
    const id = definition[1];
    if (definitions.has(id))
      violations.push(`${label}:${lineIndex + 1}: normative rule '${id}' is defined more than once`);
    else definitions.set(id, { section, line: lineIndex + 1 });
  }
  for (const required of ASYNC31_REQUIRED_RULES) {
    if (!definitions.has(required)) violations.push(`${label}: missing anchored normative definition '${required}'`);
  }
  for (const defined of definitions.keys()) {
    if (!ASYNC31_REQUIRED_RULES.has(defined)) violations.push(`${label}: unexpected anchored normative definition '${defined}'`);
  }
  return { definitions, violations };
}

function citedRuleSectionViolations(scenario, definitions, at) {
  const violations = [];
  // A scalar section anchors the first owner, not every owner of a
  // cross-section scenario. Secondary owners still require real definitions.
  for (const [index, rule] of (scenario.rules || []).entries()) {
    const definition = definitions?.get(rule);
    if (!definition)
      violations.push(`${at}.rules: '${rule}' has no anchored normative definition`);
    else if (index === 0 && scenario.section !== definition.section)
      violations.push(`${at}.section: '${scenario.section}' does not match ${rule}'s defining section '${definition.section}'`);
  }
  return violations;
}

function async31ReadmeInventoryViolations(readmeText, definitions, verdictCounts) {
  const violations = [];
  const familyRow = readmeText.split(/\r?\n/).find((line) => /^\|\s*asyncapi-3\.1\s*\|/.test(line));
  const pNumbers = [...(definitions?.keys() || [])]
    .map((id) => /^ASYNC31-P-(\d+)$/.exec(id))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);
  if (!familyRow) {
    violations.push("conformance/binding-specs/README.md: missing asyncapi-3.1 registration row");
  } else if (pNumbers.length) {
    const expectedRange = `ASYNC31-P-${String(pNumbers[0]).padStart(2, "0")}..${String(pNumbers.at(-1)).padStart(2, "0")}`;
    const foundRange = /ASYNC31-P-\d+\.\.\d+/.exec(familyRow)?.[0];
    if (foundRange !== expectedRange)
      violations.push(`conformance/binding-specs/README.md: asyncapi-3.1 row states ${foundRange || "no P range"}; definitions require ${expectedRange}`);
  }
  for (const rule of ["ASYNC31-D-01", "ASYNC31-D-02", "ASYNC31-D-03", "ASYNC31-D-04", "ASYNC31-D-05", "ASYNC31-D-06", "ASYNC31-D-07"]) {
    const row = new RegExp(`^\\|\\s*${rule}\\s*\\|\\s*(\\d+)\\/(\\d+)`, "m").exec(readmeText);
    const actual = verdictCounts.get(`asyncapi-3.1\0${rule}`);
    if (!row) {
      violations.push(`conformance/binding-specs/README.md: missing ${rule} verdict-count row`);
    } else if (!actual || Number(row[1]) !== actual.positive || Number(row[2]) !== actual.negative) {
      violations.push(`conformance/binding-specs/README.md: ${rule} row states ${row[1]}+/${row[2]}-; fixture holds ${actual ? `${actual.positive}+/${actual.negative}-` : "no counts"}`);
    }
  }
  return violations;
}

// Rows like `| USAGE-D-03 | **Deferred...` in the subcorpus README mark
// formally deferred rules.
function extractDeferredRules(readme) {
  const out = new Set();
  const re = /\|\s*((?:USAGE|OAPI(?:20|30|31|32)|MCP|GRPC|CONN|ASYNC(?:26|30|31)?|GQL)-D-\d+)\s*\|\s*\*\*Deferred/g;
  let m;
  while ((m = re.exec(readme)) !== null) out.add(m[1]);
  return out;
}

function sectionExists(specMd, section) {
  // The `section` field cites a family-spec section like "4" or "9.2";
  // accept the catalog's top-level `## 4.` and sibling `### 9.2` styles.
  const esc = section.replace(/\./g, "\\.");
  return new RegExp(`^#{2,4}\\s+${esc}\\.?\\s`, "m").test(specMd);
}

// Importing the existing evaluator must not launch the corpus orchestrator.
// These exports are the primary implementation, never the independent witness.
export { async31C21Observation, async31C21Synthesis,
  async31C21ProcessorViolations, async31C21SynthesisViolations, async31C21Supports, async31C21HeadLocallyValid,
  citedRuleSectionViolations, async31RuleDefinitionAnalysis };

if (runMain) {
const readme = readFileSync(README, "utf8");
const coreMd = readFileSync(CORE_SPEC_MD, "utf8");
const coreVersions = extractCoreSpecificationVersion(coreMd);
if (coreVersions.length !== 1) {
  errors.push(
    `openbindings.md: must declare exactly one specification version (found ${coreVersions.length})`
  );
}
const coreVersion = coreVersions[0];
const coreRules = extractCoreRules(coreMd);
const deferred = extractDeferredRules(readme);

const specTexts = {};
const familyRuleIds = {};
const familyRuleDefinitions = {};
const definedDRules = new Map(); // family-dir + rule id → { ruleId, dir }
const allRuleIds = new Set(coreRules);
for (const [dir, fam] of Object.entries(FAMILIES)) {
  const md = readFileSync(fam.spec, "utf8");
  specTexts[dir] = md;
  if (OPENAPI_FAMILY_DIRS.has(dir)) {
    // An unreleased page is a publication input and must track the companion
    // Core text that the publisher will archive. Once published, its mutable
    // mirror remains locked to that revision's own exact Core dependency even
    // while work on a later Core release begins.
    const expectedVersion = /^\*\*Status: unreleased /m.test(md) ? coreVersion : undefined;
    verifyOpenApiCoreAuthority(md, relative(SPEC_ROOT, fam.spec), expectedVersion);
  }
  if (dir === "asyncapi-3.1") {
    const expectedVersion = /^\*\*Status: unreleased /m.test(md) ? coreVersion : undefined;
    verifyAsync31CoreAuthority(md, relative(SPEC_ROOT, fam.spec), expectedVersion);
    const analysis = async31RuleDefinitionAnalysis(md, relative(SPEC_ROOT, fam.spec));
    errors.push(...analysis.violations);
    familyRuleDefinitions[dir] = analysis.definitions;
  }
  const ruleIds = familyRuleDefinitions[dir]
    ? new Set(familyRuleDefinitions[dir].keys())
    : extractAllRuleIds(md, fam.prefix);
  for (const id of [...ruleIds].filter((id) => id.includes("-D-"))) {
    definedDRules.set(`${dir}\0${id}`, { ruleId: id, dir });
  }
  familyRuleIds[dir] = ruleIds;
  for (const id of familyRuleIds[dir]) allRuleIds.add(id);
}

const fixtureRules = new Map(); // family-dir + rule id → relPath
const fixtureVerdictCounts = new Map(); // family-dir + rule id → exact positive/negative counts
let files = 0;
let tests = 0;
let positives = 0;
let negatives = 0;

for (const [dir, fam] of Object.entries(FAMILIES)) {
  const famDir = join(CORPUS, dir);
  if (!existsSync(famDir)) continue;
  for (const name of readdirSync(famDir).sort()) {
    if (!name.endsWith(".json")) continue;
    const relPath = `${dir}/${name}`;
    let fixture;
    try {
      const fixtureText = readFileSync(join(famDir, name), "utf8");
      const losslessFixture = parseLosslessJson(fixtureText);
      if (!losslessFixture.ok) throw new Error(`lossless JSON validation failed: ${losslessFixture.error}`);
      fixture = JSON.parse(fixtureText);
    } catch (e) {
      errors.push(`${relPath}: failed to parse JSON: ${e.message}`);
      continue;
    }
    files++;

    // 1. Shape via the shared fixture schema.
    const shape = ajvOk(FIXTURE_SCHEMA, fixture);
    if (!shape.ok) {
      errors.push(`${relPath}: does not match fixture.schema.json\n${shape.out}`);
      continue;
    }

    // 2. Identity: rule ↔ filename ↔ family directory ↔ bindingSpec.
    if (fixture.rule !== basename(name, ".json")) {
      errors.push(
        `${relPath}: rule '${fixture.rule}' does not match filename`
      );
    }
    if (!fixture.rule.startsWith(`${fam.prefix}-D-`)) {
      errors.push(
        `${relPath}: rule '${fixture.rule}' does not belong to family '${dir}' (expected prefix ${fam.prefix}-D-)`
      );
    }
    if (fixture.bindingSpec !== fam.bindingSpec) {
      errors.push(
        `${relPath}: bindingSpec '${fixture.bindingSpec}' is not this family's identifier '${fam.bindingSpec}'`
      );
    }
    const fixtureKey = `${dir}\0${fixture.rule}`;
    if (!definedDRules.has(fixtureKey)) {
      errors.push(
        `${relPath}: rule '${fixture.rule}' is not defined in the ${dir} specification's Conformance section`
      );
    }
    if (fixtureRules.has(fixtureKey)) {
      errors.push(
        `Multiple fixture files declare rule ${fixture.rule} for ${dir}: ${fixtureRules.get(fixtureKey)} and ${relPath}`
      );
    } else {
      fixtureRules.set(fixtureKey, relPath);
    }

    // 3. Cited family-spec section exists.
    if (!sectionExists(specTexts[dir], fixture.section)) {
      errors.push(
        `${relPath}: section '${fixture.section}' is not a heading in the ${dir} specification`
      );
    }
    if (familyRuleDefinitions[dir]) {
      const definition = familyRuleDefinitions[dir].get(fixture.rule);
      if (definition && fixture.section !== definition.section)
        errors.push(`${relPath}: section '${fixture.section}' does not match ${fixture.rule}'s defining section '${definition.section}'`);
    }

    // 5./6. Test-level checks.
    let pos = 0;
    let neg = 0;
    fixture.tests.forEach((t, i) => {
      tests++;
      if (t.valid) {
        pos++;
        if ("violates" in t) {
          errors.push(`${relPath}.tests[${i}]: positive test carries 'violates'`);
        }
      } else {
        neg++;
        if (!Array.isArray(t.violates) || t.violates.length === 0) {
          errors.push(`${relPath}.tests[${i}]: negative test carries no 'violates'`);
        } else {
          for (const v of t.violates) {
            if (!coreRules.has(v) && !familyRuleIds[dir].has(v)) {
              errors.push(
                `${relPath}.tests[${i}].violates: rule '${v}' is not defined by the core or the ${dir} family`
              );
            }
          }
          if (!t.violates.includes(fixture.rule)) {
            errors.push(
              `${relPath}.tests[${i}].violates: does not include the fixture's own rule ${fixture.rule}`
            );
          }
        }
      }
    });
    positives += pos;
    negatives += neg;
    fixtureVerdictCounts.set(fixtureKey, { positive: pos, negative: neg });
    if (fixture.coverage !== "positive-only" && (pos === 0 || neg === 0)) {
      errors.push(
        `${relPath}: needs at least one positive and one negative test (found ${pos}+/${neg}-) or a 'coverage' marker`
      );
    }
  }
}

// 4. Coverage: every defined family D-rule is fixtured or deferred.
for (const [fixtureKey, { ruleId, dir }] of definedDRules) {
  if (!fixtureRules.has(fixtureKey) && !deferred.has(ruleId)) {
    errors.push(
      `Rule ${ruleId} (${dir}) has no fixture file and is not listed as deferred in conformance/binding-specs/README.md`
    );
  }
}
for (const ruleId of deferred) {
  const covered = [...fixtureRules.entries()].filter(([key]) => key.endsWith(`\0${ruleId}`));
  if (covered.length) {
    errors.push(
      `Rule ${ruleId} is listed as deferred in the README but also has fixture file(s): ${covered.map(([, path]) => path).join(", ")}`
    );
  }
}

// Portable P-rule scenario files for all eleven family candidates. These files preserve permitted
// alternatives explicitly; the verifier checks shape, identity, citations,
// and distinct rule-id coverage, while family adapters execute them against SDKs.
const processorTargets = [
  "usage",
  "openapi-2.0",
  "openapi-3.0",
  "openapi-3.1",
  "openapi-3.2",
  "asyncapi",
  "asyncapi-3.1",
  "mcp",
  "grpc",
  "connect",
  "graphql",
];
const registeredProcessorTargets = new Set(processorTargets);
function familyRegistrationViolations(familyNames, targetNames, corpusDirectoryNames) {
  const violations = [];
  const families = new Set(familyNames);
  const targets = new Set(targetNames);
  for (const family of families) {
    if (!targets.has(family)) violations.push(`family '${family}' is registered but has no processor/synthesis target`);
  }
  for (const target of targets) {
    if (!families.has(target)) violations.push(`processor/synthesis target '${target}' has no family registration`);
  }
  for (const directory of corpusDirectoryNames) {
    if (!families.has(directory)) violations.push(`family corpus directory '${directory}' has no family registration`);
  }
  return violations;
}
function unregisteredFamilyFiles(filenames, registered) {
  return filenames
    .filter((name) => name.endsWith(".json"))
    .filter((name) => !registered.has(name.slice(0, -5)));
}
for (const [kind, directory] of [["processor", PROCESSOR_DIR], ["synthesis", SYNTHESIS_DIR]]) {
  for (const filename of unregisteredFamilyFiles(readdirSync(directory), registeredProcessorTargets)) {
    errors.push(`${kind}/${filename}: unregistered family file; add the sibling to FAMILIES and processorTargets in the same change`);
  }
}
if (unregisteredFamilyFiles(["asyncapi-3.2.json"], registeredProcessorTargets).length !== 1)
  errors.push("family-discovery mutation probe failed to reject an unregistered AsyncAPI sibling");
const corpusInfrastructureDirectories = new Set(["processor", "synthesis", "peer-dialects", "harness-probes"]);
const corpusFamilyDirectories = readdirSync(join(SPEC_ROOT, "conformance", "binding-specs"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !corpusInfrastructureDirectories.has(entry.name))
  .map((entry) => entry.name);
errors.push(...familyRegistrationViolations(Object.keys(FAMILIES), processorTargets, corpusFamilyDirectories));
if (familyRegistrationViolations([...Object.keys(FAMILIES), "asyncapi-3.2"], processorTargets, corpusFamilyDirectories).length === 0)
  errors.push("family-discovery mutation probe failed when a family registration lacked processor/synthesis targets");
if (familyRegistrationViolations(Object.keys(FAMILIES), processorTargets, [...corpusFamilyDirectories, "asyncapi-3.2"]).length === 0)
  errors.push("family-discovery mutation probe failed when a family corpus directory lacked registration");
const processorRuleCoverage = new Map();
const processorScenarioIds = new Set();
let processorFiles = 0;
let processorScenarios = 0;

for (const dir of processorTargets) {
  const fam = FAMILIES[dir];
  const path = join(PROCESSOR_DIR, `${dir}.json`);
  if (!existsSync(path)) {
    errors.push(`processor/${dir}.json: missing portable P-rule scenario file`);
    continue;
  }
  let fixture;
  try {
    const fixtureText = readFileSync(path, "utf8");
    const losslessFixture = parseLosslessJson(fixtureText);
    if (!losslessFixture.ok) throw new Error(`lossless JSON validation failed: ${losslessFixture.error}`);
    fixture = JSON.parse(fixtureText);
  } catch (e) {
    errors.push(`processor/${dir}.json: failed to parse JSON: ${e.message}`);
    continue;
  }
  processorFiles++;
  errors.push(...semanticAssertionFormatViolations(fixture, `processor/${dir}.json`));
  errors.push(...processorApparatusVersionViolations(fixture, `processor/${dir}.json`));
  const shape = ajvOk(PROCESSOR_SCHEMA, fixture);
  if (!shape.ok) {
    errors.push(`processor/${dir}.json: does not match processor-scenario.schema.json\n${shape.out}`);
    continue;
  }
  errors.push(...revisionSixProcessorViolations(fixture, `processor/${dir}.json`));
  if (fixture.family !== dir)
    errors.push(`processor/${dir}.json: family '${fixture.family}' does not match filename`);
  if (fixture.bindingSpec !== fam.bindingSpec)
    errors.push(`processor/${dir}.json: bindingSpec '${fixture.bindingSpec}' is not '${fam.bindingSpec}'`);

  for (const [i, scenario] of fixture.scenarios.entries()) {
    const at = `processor/${dir}.json.scenarios[${i}]`;
    processorScenarios++;
    if (processorScenarioIds.has(scenario.id))
      errors.push(`${at}: duplicate id '${scenario.id}'`);
    processorScenarioIds.add(scenario.id);
    if (!scenario.id.startsWith(`${fam.prefix}-PS-`))
      errors.push(`${at}: id '${scenario.id}' has the wrong family prefix`);
    if (!sectionExists(specTexts[dir], scenario.section))
      errors.push(`${at}: section '${scenario.section}' is not a heading in the ${dir} specification`);
    if (familyRuleDefinitions[dir])
      errors.push(...citedRuleSectionViolations(scenario, familyRuleDefinitions[dir], at));
    if (dir === "asyncapi-3.1")
      errors.push(...async31C21ProcessorViolations(scenario, at));
    const materializations = scenario.given.invocation.inputMaterializations || [];
    if (materializations.length) {
      if (!["openbindings.binding-spec-processor-scenarios@4", "openbindings.binding-spec-processor-scenarios@5"].includes(fixture.format))
        errors.push(`${at}: inputMaterializations require processor-scenario format @4 or later`);
      if (!scenario.given.invocation.inputPresent)
        errors.push(`${at}: inputMaterializations require inputPresent: true`);
      if (!Object.hasOwn(scenario.given.invocation, "input"))
        errors.push(`${at}: inputMaterializations require an input template`);
      const paths = new Set();
      for (const [materializationIndex, materialization] of materializations.entries()) {
        const materializationAt = `${at}.given.invocation.inputMaterializations[${materializationIndex}]`;
        if (paths.has(materialization.path))
          errors.push(`${materializationAt}: duplicate materialization path '${materialization.path}'`);
        paths.add(materialization.path);
        const target = jsonPointerValue(scenario.given.invocation.input, materialization.path);
        if (!target.found)
          errors.push(`${materializationAt}: path '${materialization.path}' does not resolve in the input template`);
        else if (target.value !== null)
          errors.push(`${materializationAt}: path '${materialization.path}' must name a null placeholder`);
        if (!hasUnpairedSurrogate(materialization.codeUnits))
          errors.push(`${materializationAt}: codeUnits must contain an unpaired surrogate so JSON-safe parsing cannot erase the hostile boundary`);
      }
    }
    for (const expected of scenario.expected) {
      for (const assertion of expected.assertions) {
        if (dir.startsWith("openapi-") && (assertion.path.startsWith("/context/") || assertion.path.startsWith("/error/")))
          errors.push(`${at}: portable OpenAPI evidence cannot assert project-interface path '${assertion.path}'`);
      }
    }
    for (const rule of scenario.rules) {
      if (!rule.startsWith(`${fam.prefix}-P-`) || !familyRuleIds[dir].has(rule))
        errors.push(`${at}: rule '${rule}' is not a defined ${dir} P-rule`);
      if (!processorRuleCoverage.has(rule)) processorRuleCoverage.set(rule, []);
      processorRuleCoverage.get(rule).push(scenario.id);
    }
  }
}

const processorPRules = new Map();
for (const dir of processorTargets) {
  const fam = FAMILIES[dir];
  const processorRules = familyRuleDefinitions[dir]
    ? [...familyRuleDefinitions[dir].keys()].filter((rule) => rule.includes("-P-"))
    : extractFamilyPRules(specTexts[dir], fam.prefix);
  for (const rule of processorRules) {
    if (!processorPRules.has(rule)) processorPRules.set(rule, []);
    processorPRules.get(rule).push(dir);
  }
}
for (const [rule, dirs] of processorPRules) {
  if (!processorRuleCoverage.has(rule))
    errors.push(`Processor rule ${rule} (${dirs.join(", ")}) has no portable processor scenario`);
}

// The stronger invocation-fidelity profile is kept separate from published
// family conformance. It reuses the semantic harness but may also cite the
// core binding-specification completeness floor.
const fidelityTargets = [
  "openapi-3.0",
  "openapi-3.1",
  "asyncapi",
  "grpc",
  "connect",
  "graphql",
  "mcp",
  "usage",
];
let fidelityScenarios = 0;
for (const dir of fidelityTargets) {
  const fam = FAMILIES[dir];
  const path = join(FIDELITY_DIR, `${dir}.json`);
  if (!existsSync(path)) {
    errors.push(`invocation-fidelity/${dir}.json: missing fidelity scenario file`);
    continue;
  }
  let fixture;
  try {
    const fixtureText = readFileSync(path, "utf8");
    const losslessFixture = parseLosslessJson(fixtureText);
    if (!losslessFixture.ok) throw new Error(`lossless JSON validation failed: ${losslessFixture.error}`);
    fixture = JSON.parse(fixtureText);
  } catch (e) {
    errors.push(`invocation-fidelity/${dir}.json: failed to parse JSON: ${e.message}`);
    continue;
  }
  const shape = ajvOk(FIDELITY_SCHEMA, fixture);
  if (!shape.ok) {
    errors.push(`invocation-fidelity/${dir}.json: does not match scenario.schema.json\n${shape.out}`);
    continue;
  }
  if (fixture.family !== dir)
    errors.push(`invocation-fidelity/${dir}.json: family '${fixture.family}' does not match filename`);
  if (fixture.bindingSpec !== fam.bindingSpec)
    errors.push(`invocation-fidelity/${dir}.json: bindingSpec '${fixture.bindingSpec}' is not '${fam.bindingSpec}'`);
  for (const [i, scenario] of fixture.scenarios.entries()) {
    fidelityScenarios++;
    if (!scenario.id.startsWith(`${fam.prefix}-FI-`))
      errors.push(`invocation-fidelity/${dir}.json.scenarios[${i}]: id '${scenario.id}' has the wrong family prefix`);
    if (!sectionExists(specTexts[dir], scenario.section))
      errors.push(`invocation-fidelity/${dir}.json.scenarios[${i}]: section '${scenario.section}' is not a heading in the ${dir} specification`);
    for (const rule of scenario.rules) {
      if (!coreRules.has(rule) && !familyRuleIds[dir].has(rule))
        errors.push(`invocation-fidelity/${dir}.json.scenarios[${i}]: rule '${rule}' is not defined by core or the family specification`);
    }
  }
}

// Portable synthesis scenarios prove artifact-inventory accounting and
// emitted target identity independently of either reference SDK's API.
const synthesisScenarioIds = new Set();
const synthesisRuleCoverage = new Map();
const synthesisStrictFamilies = new Set();
let synthesisFiles = 0;
let synthesisScenarios = 0;
for (const dir of processorTargets) {
  const fam = FAMILIES[dir];
  const path = join(SYNTHESIS_DIR, `${dir}.json`);
  if (!existsSync(path)) {
    errors.push(`synthesis/${dir}.json: missing portable synthesis scenario file`);
    continue;
  }
  let fixture;
  try {
    const fixtureText = readFileSync(path, "utf8");
    const losslessFixture = parseLosslessJson(fixtureText);
    if (!losslessFixture.ok) throw new Error(`lossless JSON validation failed: ${losslessFixture.error}`);
    fixture = JSON.parse(fixtureText);
  } catch (e) {
    errors.push(`synthesis/${dir}.json: failed to parse JSON: ${e.message}`);
    continue;
  }
  synthesisFiles++;
  errors.push(...synthesisApparatusVersionViolations(fixture, `synthesis/${dir}.json`));
  if (["openbindings.binding-spec-synthesis-scenarios@5", SYNTHESIS_V6, SYNTHESIS_V7].includes(fixture.format))
    synthesisStrictFamilies.add(dir);
  const shape = ajvOk(SYNTHESIS_SCHEMA, fixture);
  if (!shape.ok) {
    errors.push(`synthesis/${dir}.json: does not match synthesis-scenario.schema.json\n${shape.out}`);
    continue;
  }
  errors.push(...revisionSixSynthesisViolations(fixture, `synthesis/${dir}.json`));
  if (fixture.family !== dir)
    errors.push(`synthesis/${dir}.json: family '${fixture.family}' does not match filename`);
  if (fixture.bindingSpec !== fam.bindingSpec)
    errors.push(`synthesis/${dir}.json: bindingSpec '${fixture.bindingSpec}' is not '${fam.bindingSpec}'`);

  for (const [i, scenario] of fixture.scenarios.entries()) {
    synthesisScenarios++;
    const at = `synthesis/${dir}.json.scenarios[${i}]`;
    if (synthesisScenarioIds.has(scenario.id))
      errors.push(`${at}: duplicate id '${scenario.id}'`);
    synthesisScenarioIds.add(scenario.id);
    if (!scenario.id.startsWith(`${fam.prefix}-SS-`))
      errors.push(`${at}: id '${scenario.id}' has the wrong family prefix`);
    if (familyRuleDefinitions[dir])
      errors.push(...citedRuleSectionViolations(scenario, familyRuleDefinitions[dir], at));
    if (dir === "asyncapi-3.1")
      errors.push(...async31C21SynthesisViolations(scenario, at));
    for (const rule of scenario.rules || []) {
      if (!familyRuleIds[dir].has(rule))
        errors.push(`${at}: rule '${rule}' is not defined by the ${dir} family`);
      if (![SYNTHESIS_V6, SYNTHESIS_V7].includes(fixture.format)) {
        if (!synthesisRuleCoverage.has(rule)) synthesisRuleCoverage.set(rule, []);
        synthesisRuleCoverage.get(rule).push(scenario.id);
      }
    }
    if ([SYNTHESIS_V6, SYNTHESIS_V7].includes(fixture.format)) {
      for (const rule of revisionSixSynthesisEvidenceRules(scenario)) {
        if (!synthesisRuleCoverage.has(rule)) synthesisRuleCoverage.set(rule, []);
        synthesisRuleCoverage.get(rule).push(scenario.id);
      }
    }
    if (scenario.source.bindingSpec !== fam.bindingSpec)
      errors.push(`${at}: source bindingSpec '${scenario.source.bindingSpec}' is not '${fam.bindingSpec}'`);
    if (scenario.expected.outcome === "refused") {
      for (const rule of scenario.expected.rules) {
        if (!coreRules.has(rule) && !familyRuleIds[dir].has(rule))
          errors.push(`${at}: refusal rule '${rule}' is not defined by the core or the ${dir} family`);
      }
      continue;
    }
    if (!scenario.expected.coverage.exhaustive)
      errors.push(`${at}: portable synthesis evidence must claim an exhaustive inventory`);

    const operations = new Set(scenario.expected.operations);
    const bindings = new Set(
      scenario.expected.bindings.map((binding) => `${binding.operationKey}\0${binding.bindingSelector}`)
    );
    for (const binding of scenario.expected.bindings) {
      if (!operations.has(binding.operationKey))
        errors.push(`${at}: binding names undeclared operation '${binding.operationKey}'`);
    }
    for (const [entryIndex, entry] of scenario.expected.coverage.entries.entries()) {
      const entryAt = `${at}.expected.coverage.entries[${entryIndex}]`;
      if (dir.startsWith("openapi-") && Object.hasOwn(entry, "reasonCode"))
        errors.push(`${entryAt}: portable OpenAPI evidence cannot pin diagnostic reasonCode spelling`);
      if (entry.status === "represented") {
        if (
          entry.scope !== "dependency"
          && !bindings.has(`${entry.operationKey}\0${entry.bindingSelector}`)
        )
          errors.push(`${entryAt}: represented disposition has no expected binding identity`);
      }
      if (
        entry.rule
        && !coreRules.has(entry.rule)
        && !familyRuleIds[dir].has(entry.rule)
      ) {
        errors.push(`${entryAt}: rule '${entry.rule}' is not defined by the core or the ${dir} family`);
      }
    }
    const derivedFull = scenario.expected.coverage.entries.every(
      (entry) => entry.status === "represented"
    );
    if (scenario.expected.coverage.fullyRepresented !== derivedFull)
      errors.push(`${at}: fullyRepresented does not match the declared dispositions`);
  }
}

for (const dir of synthesisStrictFamilies) {
  const fam = FAMILIES[dir];
  for (const rule of familyRuleIds[dir]) {
    if (!rule.startsWith(`${fam.prefix}-S-`)) continue;
    if (!synthesisRuleCoverage.has(rule))
      errors.push(`Synthesizer rule ${rule} (${dir}) has no portable synthesis scenario citation`);
  }
}

// AsyncAPI 3.1 is still a bounded common-kernel candidate. Its portable D/P/S
// evidence is therefore locked as one exact review unit: count/ID checks catch
// structural deletion and the canonical root catches replacement under a live
// ID, including exchanges between cases that cite the same atomic rule.
try {
  const async31Artifacts = loadAsync31Artifacts();
  errors.push(...async31ArtifactIntegrityViolations(async31Artifacts, "AsyncAPI 3.1 artifact lock"));

  const deletedCase = structuredClone(async31Artifacts);
  deletedCase["processor/asyncapi-3.1.json"].scenarios = deletedCase["processor/asyncapi-3.1.json"].scenarios
    .filter((scenario) => scenario.id !== "ASYNC31-PS-89");
  if (async31ArtifactIntegrityViolations(deletedCase, "AsyncAPI 3.1 deleted-case mutant").length === 0)
    errors.push("AsyncAPI 3.1 artifact lock accepts deletion of a processor case");

  const replacedCase = structuredClone(async31Artifacts);
  const replacementCases = replacedCase["processor/asyncapi-3.1.json"].scenarios;
  const replacementTarget = replacementCases.find((scenario) => scenario.id === "ASYNC31-PS-75");
  const replacementSource = replacementCases.find((scenario) => scenario.id === "ASYNC31-PS-77");
  replacementTarget.given = structuredClone(replacementSource.given);
  replacementTarget.expected = structuredClone(replacementSource.expected);
  if (async31ArtifactIntegrityViolations(replacedCase, "AsyncAPI 3.1 same-rule replacement mutant").length === 0)
    errors.push("AsyncAPI 3.1 artifact lock accepts replacement of a case by same-rule evidence");

  const swappedCases = structuredClone(async31Artifacts);
  const swapScenarios = swappedCases["processor/asyncapi-3.1.json"].scenarios;
  const swapLeft = swapScenarios.find((scenario) => scenario.id === "ASYNC31-PS-75");
  const swapRight = swapScenarios.find((scenario) => scenario.id === "ASYNC31-PS-76");
  [swapLeft.given, swapRight.given] = [structuredClone(swapRight.given), structuredClone(swapLeft.given)];
  if (async31ArtifactIntegrityViolations(swappedCases, "AsyncAPI 3.1 same-rule swap mutant").length === 0)
    errors.push("AsyncAPI 3.1 artifact lock accepts a payload swap between same-rule cases");

  const serverOwnerOperationKey = structuredClone(async31Artifacts["synthesis/asyncapi-3.1.json"]);
  const serverOwnerEntry = serverOwnerOperationKey.scenarios
    .find((scenario) => scenario.id === "ASYNC31-SS-16")
    .expected.coverage.entries
    .find((entry) => entry.sourceRef === "#/components/servers/bad~1server");
  serverOwnerEntry.operationKey = "badServerSlot";
  if (revisionSixSynthesisViolations(serverOwnerOperationKey, "AsyncAPI 3.1 invalid Server owner mutant").length === 0)
    errors.push("AsyncAPI 3.1 coverage algebra accepts operationKey on a deduplicated invalid Server owner");

  const noncanonicalExternalOwner = structuredClone(async31Artifacts["synthesis/asyncapi-3.1.json"]);
  const externalScenario = noncanonicalExternalOwner.scenarios.find((scenario) => scenario.id === "ASYNC31-SS-18");
  const canonicalExternalRef = "https://example.test/bad%20resource.yaml#/op%20space";
  const noncanonicalExternalRef = "https://example.test/bad%20resource.yaml#%2fop%20space";
  externalScenario.expected.coverage.entries
    .find((entry) => entry.sourceRef === canonicalExternalRef)
    .sourceRef = noncanonicalExternalRef;
  externalScenario.expected.assertions[0].setEquals
    .find((entry) => entry.sourceRef === canonicalExternalRef)
    .sourceRef = noncanonicalExternalRef;
  if (revisionSixSynthesisViolations(noncanonicalExternalOwner, "AsyncAPI 3.1 external owner spelling mutant").length === 0)
    errors.push("AsyncAPI 3.1 coverage algebra accepts a noncanonical external owner sourceRef");

  const utf16Misclassified = structuredClone(async31Artifacts["synthesis/asyncapi-3.1.json"]);
  utf16Misclassified.scenarios
    .find((scenario) => scenario.id === "ASYNC31-SS-15")
    .expected.coverage.entries[0].status = "invalid";
  if (revisionSixSynthesisViolations(utf16Misclassified, "AsyncAPI 3.1 UTF-16 classification mutant").length === 0)
    errors.push("AsyncAPI 3.1 coverage algebra accepts a valid UTF-16 external resource as invalid");

  const nonMapOwnerMutant = structuredClone(async31Artifacts);
  const nonMapScenario = nonMapOwnerMutant["synthesis/asyncapi-3.1.json"].scenarios
    .find((scenario) => scenario.id === "ASYNC31-SS-22");
  nonMapScenario.expected.coverage.entries
    .find((entry) => entry.sourceRef === "#/components/operations")
    .sourceRef = "#/components/operations/0";
  nonMapScenario.expected.assertions[0].setEquals
    .find((entry) => entry.sourceRef === "#/components/operations")
    .sourceRef = "#/components/operations/0";
  if (async31ArtifactIntegrityViolations(nonMapOwnerMutant, "AsyncAPI 3.1 non-map container owner mutant").length === 0)
    errors.push("AsyncAPI 3.1 artifact lock accepts a slot identity for a non-map typed component container");

  const chainOwnerMutant = structuredClone(async31Artifacts);
  const chainScenario = chainOwnerMutant["synthesis/asyncapi-3.1.json"].scenarios
    .find((scenario) => scenario.id === "ASYNC31-SS-23");
  chainScenario.expected.coverage.entries
    .find((entry) => entry.sourceRef === "#/components/operations/a")
    .sourceRef = "#/components/operations/b";
  chainScenario.expected.assertions[0].setEquals
    .find((entry) => entry.sourceRef === "#/components/operations/a")
    .sourceRef = "#/components/operations/b";
  if (async31ArtifactIntegrityViolations(chainOwnerMutant, "AsyncAPI 3.1 chain owner mutant").length === 0)
    errors.push("AsyncAPI 3.1 artifact lock accepts a later pure-chain slot instead of the first entered target");

  const externalPhaseMutant = structuredClone(async31Artifacts);
  externalPhaseMutant["processor/asyncapi-3.1.json"].scenarios
    .find((scenario) => scenario.id === "ASYNC31-PS-90")
    .expected[0].phase = "load";
  if (async31ArtifactIntegrityViolations(externalPhaseMutant, "AsyncAPI 3.1 external UTF-16 phase mutant").length === 0)
    errors.push("AsyncAPI 3.1 artifact lock accepts a lazy external UTF-16 exclusion as entry load refusal");

  const utfPrecedenceMutant = structuredClone(async31Artifacts);
  const utfPrecedenceEntry = utfPrecedenceMutant["synthesis/asyncapi-3.1.json"].scenarios
    .find((scenario) => scenario.id === "ASYNC31-SS-24")
    .expected.coverage.entries
    .find((entry) => entry.sourceRef === "https://example.test/scalar.yaml#");
  utfPrecedenceEntry.status = "excluded";
  utfPrecedenceEntry.rule = "ASYNC31-S-07";
  if (async31ArtifactIntegrityViolations(utfPrecedenceMutant, "AsyncAPI 3.1 UTF-16 precedence mutant").length === 0)
    errors.push("AsyncAPI 3.1 artifact lock accepts a wrong-kind UTF-16 value as encoding-only exclusion");

  const duplicatedServerOwner = structuredClone(async31Artifacts);
  const serverScenario = duplicatedServerOwner["synthesis/asyncapi-3.1.json"].scenarios
    .find((scenario) => scenario.id === "ASYNC31-SS-27");
  serverScenario.expected.coverage.entries.push({
    ...structuredClone(serverScenario.expected.coverage.entries[0]),
    operationKey: "one",
  });
  serverScenario.expected.assertions[0].setEquals.push({
    sourceIndex: 0,
    sourceRef: "https://example.test/utf16-server.yaml#/server",
    scope: "target",
    operationKey: "one",
  });
  if (async31ArtifactIntegrityViolations(duplicatedServerOwner, "AsyncAPI 3.1 duplicate Server owner mutant").length === 0)
    errors.push("AsyncAPI 3.1 artifact lock accepts an operation-owned duplicate of a shared Server owner");

  const missingNoCellTarget = structuredClone(async31Artifacts);
  const missingTargetScenario = missingNoCellTarget["synthesis/asyncapi-3.1.json"].scenarios
    .find((scenario) => scenario.id === "ASYNC31-SS-27");
  missingTargetScenario.expected.coverage.entries = missingTargetScenario.expected.coverage.entries
    .filter((entry) => entry.sourceRef !== "#/operations/two");
  missingTargetScenario.expected.assertions[0].setEquals = missingTargetScenario.expected.assertions[0].setEquals
    .filter((entry) => entry.sourceRef !== "#/operations/two");
  if (async31ArtifactIntegrityViolations(missingNoCellTarget, "AsyncAPI 3.1 missing S-05 mutant").length === 0)
    errors.push("AsyncAPI 3.1 artifact lock accepts omission of a no-addressable-cell S-05 target");

  const c21Processor = async31Artifacts["processor/asyncapi-3.1.json"].scenarios;
  const c21AdmissionMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-108"));
  c21AdmissionMutant.given.source.content.operations.op.action = "send";
  if (async31C21ProcessorViolations(c21AdmissionMutant, "C21 admission branch mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 interpreter accepts a send operation under the receive-only HTTP profile");

  const c21InputMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-130"));
  c21InputMutant.given.invocation.input = null;
  if (async31C21ProcessorViolations(c21InputMutant, "C21 empty-input mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 interpreter accepts null as the direct empty Message value");

  const c21WireMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-137"));
  c21WireMutant.expected[0].timeline.find((event) => event.name === "dispatch").facts.originFormSha256 = "0".repeat(64);
  if (async31C21ProcessorViolations(c21WireMutant, "C21 request-wire mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 interpreter accepts an incorrect origin-form digest");

  const c21ResponseMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-141"));
  c21ResponseMutant.given.peer.script.events[0].status = 101;
  if (async31C21ProcessorViolations(c21ResponseMutant, "C21 101 response mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 interpreter accepts 101 as the expected successful completion");

  const c21Synthesis = async31Artifacts["synthesis/asyncapi-3.1.json"].scenarios;
  const c21KeyMutant = structuredClone(c21Synthesis.find((scenario) => scenario.id === "ASYNC31-SS-28"));
  c21KeyMutant.expected.operations[0] = "operation-op";
  if (async31C21SynthesisViolations(c21KeyMutant, "C21 generated-key mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 synthesis accepts a noninjective operation key");

  const c21AlternativeMutant = structuredClone(c21Synthesis.find((scenario) => scenario.id === "ASYNC31-SS-28"));
  c21AlternativeMutant.expected.coverage.entries = c21AlternativeMutant.expected.coverage.entries
    .filter((entry) => entry.scope !== "message-alternative");
  c21AlternativeMutant.expected.coverage.fullyRepresented = true;
  if (async31C21SynthesisViolations(c21AlternativeMutant, "C21 message-alternative deletion mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 synthesis accepts deletion of represented message-alternative coverage");

  const c21TargetMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-108"));
  c21TargetMutant.given.source.content.servers.s.host = "example.test/api";
  if (async31C21ProcessorViolations(c21TargetMutant, "C21 authority/path separation mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 interpreter accepts a path embedded in server.host");

  const c21MembershipMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-167"));
  c21MembershipMutant.given.binding.selector = "#/servers/t/operations/op";
  if (async31C21ProcessorViolations(c21MembershipMutant, "C21 channel membership mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 interpreter ignores effective channel-server membership");

  const c21TransformMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-108"));
  c21TransformMutant.given.binding.inputTransform = {};
  if (async31C21ProcessorViolations(c21TransformMutant, "C21 transform mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 interpreter accepts an input transform in the payloadless slice");

  const c21TriggerMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-108"));
  c21TriggerMutant.given.peer.script.events[0].after.name = "connection-opened";
  if (async31C21ProcessorViolations(c21TriggerMutant, "C21 peer trigger mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 interpreter accepts a response released before dispatch");

  const c21UnicodeMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-108"));
  c21UnicodeMutant.given.peer.script.events[0].headers = [{ name: "X-Test", value: "\ud800" }];
  if (async31C21ProcessorViolations(c21UnicodeMutant, "C21 response Unicode-scalar mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 interpreter accepts an unpaired surrogate in a response field value");

  const c21SourceMutant = structuredClone(c21Synthesis.find((scenario) => scenario.id === "ASYNC31-SS-28"));
  c21SourceMutant.expected.assertions.find((assertion) => assertion.path.startsWith("/sources/")).equals = {};
  if (async31C21SynthesisViolations(c21SourceMutant, "C21 source-provenance mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 synthesis accepts a source map entry without the exact source artifact");

  const c21TransformInsertionMutant = structuredClone(c21Synthesis.find((scenario) => scenario.id === "ASYNC31-SS-28"));
  c21TransformInsertionMutant.expected.assertions = c21TransformInsertionMutant.expected.assertions
    .filter((assertion) => !assertion.path.endsWith("/inputTransform"));
  c21TransformInsertionMutant.expected.assertions.push({
    rule: "ASYNC31-S-10",
    surface: "document",
    path: `/bindings/${async31GeneratedKey("binding", 0, "#/servers/s/operations/op")}/inputTransform`,
    equals: {},
  });
  if (async31C21SynthesisViolations(c21TransformInsertionMutant, "C21 transform insertion mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 synthesis accepts an inserted input transform");

  for (const id of [174, 175, 176, 177]) {
    const owned = c21Processor.find((scenario) => scenario.id === `ASYNC31-PS-${id}`);
    if (!jsonValueEqual(owned?.rules, ["ASYNC31-P-09", "ASYNC31-P-13"])
      || !jsonValueEqual(owned?.expected?.[0]?.rules, ["ASYNC31-P-09", "ASYNC31-P-13"]))
      errors.push(`AsyncAPI 3.1 ${owned?.id || id} is not owned exactly by ASYNC31-P-09 and ASYNC31-P-13`);
  }

  const c21YamlMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-109"));
  c21YamlMutant.given.source.content += "operations: {}\n";
  if (async31C21ProcessorViolations(c21YamlMutant, "C21 YAML duplicate mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 common loader accepts a duplicate-key YAML entry");

  const c21EditionMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-108"));
  c21EditionMutant.given.source.content.asyncapi = "3.0.0";
  if (async31C21ProcessorViolations(c21EditionMutant, "C21 edition mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 bypasses the common exact-edition load gate");

  const c21SecurityMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-190"));
  c21SecurityMutant.given.source.content.operations.op.security = [{}];
  if (async31C21ProcessorViolations(c21SecurityMutant, "C21 nonempty security mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 represents nonempty operation security in the payloadless slice");

  const c21ExternalPointerMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-198"));
  c21ExternalPointerMutant.given.source.content.operations.op.$ref = "ops.json#operation";
  if (async31C21ProcessorViolations(c21ExternalPointerMutant, "C21 external named-fragment mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 treats an external named fragment as a JSON Pointer");

  const c21MediaRepairMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-187"));
  c21MediaRepairMutant.given.peer.script.events[0].headers[0].value = "application/json; charset=utf-8";
  if (async31C21ProcessorViolations(c21MediaRepairMutant, "C21 Content-Type BWS repair mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 malformed Content-Type case remains failing after its sole BWS defect is repaired");

  const c21CompletionPhaseMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-144"));
  c21CompletionPhaseMutant.expected[0].phase = "response";
  if (async31C21ProcessorViolations(c21CompletionPhaseMutant, "C21 clean non-2xx phase mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 conflates clean unsuccessful completion with response-protocol failure");

  const c21CoverageCrossProductMutant = structuredClone(c21Synthesis.find((scenario) => scenario.id === "ASYNC31-SS-52"));
  c21CoverageCrossProductMutant.expected.coverage.entries = c21CoverageCrossProductMutant.expected.coverage.entries
    .filter((entry) => entry.rule !== "ASYNC31-S-05");
  if (async31C21SynthesisViolations(c21CoverageCrossProductMutant, "C21 S07/S05 cross-product mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 synthesis accepts deletion of S-05 beside an excluded UTF resource owner");

  const c21OriginIdentityMutant = structuredClone(c21Synthesis.find((scenario) => scenario.id === "ASYNC31-SS-53"));
  c21OriginIdentityMutant.expected.coverage.entries[1].sourceRef = c21OriginIdentityMutant.expected.coverage.entries[0].sourceRef;
  if (async31C21SynthesisViolations(c21OriginIdentityMutant, "C21 resource-origin identity mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 synthesis aliases equal external bytes from distinct retrieval origins");

  const c21RootKeyRepairMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-200"));
  c21RootKeyRepairMutant.given.source.content.servers.s = c21RootKeyRepairMutant.given.source.content.servers["bad.key"];
  delete c21RootKeyRepairMutant.given.source.content.servers["bad.key"];
  if (async31C21ProcessorViolations(c21RootKeyRepairMutant, "C21 root Server key repair mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 invalid-root-key case does not turn red when repaired to an addressable represented cell");

  const c21RootKeyNoCellMutant = structuredClone(c21Synthesis.find((scenario) => scenario.id === "ASYNC31-SS-54"));
  c21RootKeyNoCellMutant.expected.coverage.entries = c21RootKeyNoCellMutant.expected.coverage.entries
    .filter((entry) => entry.rule !== "ASYNC31-S-05");
  if (async31C21SynthesisViolations(c21RootKeyNoCellMutant, "C21 invalid root key S05 mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 invalid root Server coverage permits omission of the per-operation S-05 target");

  const c21ResourceBytesTwin = c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-166");
  if (async31C21ProcessorViolations(c21ResourceBytesTwin, "C21 represented UTF-8 resourceBytes twin").length)
    errors.push("AsyncAPI 3.1 C21 represented UTF-8 resourceBytes processor twin is not executable");

  const c21S06OrderMutant = structuredClone(c21Synthesis.find((scenario) => scenario.id === "ASYNC31-SS-55"));
  const s06Entries = c21S06OrderMutant.expected.coverage.entries.filter((entry) => entry.rule === "ASYNC31-S-06");
  const firstS06Index = c21S06OrderMutant.expected.coverage.entries.indexOf(s06Entries[0]);
  const secondS06Index = c21S06OrderMutant.expected.coverage.entries.indexOf(s06Entries[1]);
  [c21S06OrderMutant.expected.coverage.entries[firstS06Index], c21S06OrderMutant.expected.coverage.entries[secondS06Index]]
    = [c21S06OrderMutant.expected.coverage.entries[secondS06Index], c21S06OrderMutant.expected.coverage.entries[firstS06Index]];
  if (async31C21SynthesisViolations(c21S06OrderMutant, "C21 S06 occurrence-order mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 synthesis collapses authored S-06 membership occurrence order");

  const c21S06ReferentMutant = structuredClone(c21Synthesis.find((scenario) => scenario.id === "ASYNC31-SS-51"));
  c21S06ReferentMutant.expected.coverage.entries
    .find((entry) => entry.rule === "ASYNC31-S-06").sourceRef = "https://example.test/server.json#/server";
  if (async31C21SynthesisViolations(c21S06ReferentMutant, "C21 S06 referent-identity mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 synthesis substitutes a resolved referent for authored S-06 membership identity");

  const c21ExternalEncodingMutant = structuredClone(c21Synthesis.find((scenario) => scenario.id === "ASYNC31-SS-56"));
  c21ExternalEncodingMutant.expected.coverage.entries[0].sourceRef
    = "https://example.test/external.json#/!%27%28%29%2A%E9%9B%AA%25~1~0";
  if (async31C21SynthesisViolations(c21ExternalEncodingMutant, "C21 external sourceRef literal mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 synthesis leaves a non-unreserved external-owner byte literal");

  const c21PreOpenCloseMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-150"));
  c21PreOpenCloseMutant.expected[0].timeline.push({ kind: "native", name: "connection-closed",
    facts: { origin: "local", stage: "connect", reason: "cancelled" } });
  if (async31C21ProcessorViolations(c21PreOpenCloseMutant, "C21 pre-open invented-close mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 lifecycle invents a transport close before connection-opened");

  const c21IncompleteFinalMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-203"));
  c21IncompleteFinalMutant.expected[0].timeline = c21IncompleteFinalMutant.expected[0].timeline
    .filter((event) => event.name !== "acknowledgement");
  if (async31C21ProcessorViolations(c21IncompleteFinalMutant, "C21 incomplete-final cancellation mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 cancellation drops an already observed final acknowledgement");

  const c21RaceSuffixMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-204"));
  c21RaceSuffixMutant.expected[0].timeline.splice(-2, 0, { kind: "native", name: "acknowledgement",
    facts: { httpVersion: "1.1", stage: "final", status: 204, headers: [] } });
  if (async31C21ProcessorViolations(c21RaceSuffixMutant, "C21 unawaited peer-suffix mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 lifecycle consumes an unacknowledged peer suffix before the next caller action");

  const c21OwnMap = async31ParseYamlDocument("__proto__: p\nconstructor: c\nprototype: t\n");
  if (!c21OwnMap.ok || Object.getPrototypeOf(c21OwnMap.value) !== null
    || !["__proto__", "constructor", "prototype"].every((key) => Object.hasOwn(c21OwnMap.value, key)))
    errors.push("AsyncAPI 3.1 YAML composer does not preserve prototype-looking keys as null-prototype own data");
  if (!async31ParseYamlDocument("%FOO alpha beta\n---\na: b\n").ok)
    errors.push("AsyncAPI 3.1 YAML composer treats an unknown reserved directive as fatal");
  const inheritedRoot = Object.create({ operations: {
    op: { action: "receive", channel: { $ref: "#/channels/c" }, bindings: { http: {} } },
  } });
  Object.assign(inheritedRoot, {
    asyncapi: "3.1.0", info: { title: "Inherited", version: "1" },
    servers: { s: { host: "example.test", protocol: "http" } },
    channels: { c: { address: "/events", messages: { m: {} } } },
  });
  if (async31C21Selector({ source: { content: inheritedRoot } }, "#/servers/s/operations/op").status === "represented")
    errors.push("AsyncAPI 3.1 common loader observes an inherited root map member");

  if (async31AbsoluteDocumentLocation("https://example.test/a b") !== undefined
    || async31AbsoluteDocumentLocation("https://example.test/a%ZZ") !== undefined
    || async31ResolveRfc3986("x-test://EXAMPLE/a/b/main.yaml", "../../x/./op%2f.yaml#/op")?.absolute
      !== "x-test://EXAMPLE/x/op%2f.yaml#/op")
    errors.push("AsyncAPI 3.1 reference resolver does not apply exact authored-spelling RFC 3986 resolution");

  const c21EncodingHop = c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-211");
  if (async31C21ProcessorViolations(c21EncodingHop, "C21 cumulative encoding provenance").length)
    errors.push("AsyncAPI 3.1 C21 loses UTF-16/32 exclusion provenance across a Reference Object hop");
  const c21EncodingOwnerMutant = structuredClone(c21Synthesis.find((scenario) => scenario.id === "ASYNC31-SS-58"));
  c21EncodingOwnerMutant.expected.coverage.entries.find((entry) => entry.rule === "ASYNC31-S-07").sourceRef
    = "https://example.test/root/next.json#/operation";
  if (async31C21SynthesisViolations(c21EncodingOwnerMutant, "C21 encoding-origin owner mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 charges cumulative encoding exclusion to the later UTF-8 referent");

  const c21Alias = c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-212");
  if (async31C21ProcessorViolations(c21Alias, "C21 root-operation alias placement").length)
    errors.push("AsyncAPI 3.1 C21 loses root-authored placement through a root Operation alias");

  const c21StageLabelMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-182"));
  c21StageLabelMutant.given.peer.script.events.at(-1).stage = "before-response";
  if (async31C21ProcessorViolations(c21StageLabelMutant, "C21 peer stage-label mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 trusts a peer-declared disconnect stage over the derived prefix");
  const c21StaleTriggerMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-139"));
  c21StaleTriggerMutant.given.peer.script.events[1].after = { kind: "native", name: "dispatch", count: 1 };
  if (async31C21ProcessorViolations(c21StaleTriggerMutant, "C21 stale dispatch trigger mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 accepts a stale dispatch trigger after an interim response");
  const c21PostCompleteMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-182"));
  c21PostCompleteMutant.given.peer.script.events.push({ kind: "response-head",
    after: { kind: "native", name: "acknowledgement", count: 1 }, httpVersion: "1.1", status: 204, headers: [] });
  if (async31C21ProcessorViolations(c21PostCompleteMutant, "C21 post-completion activity mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 accepts peer activity after a complete final disposition");
  const c21ActionOrderMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-151"));
  c21ActionOrderMutant.given.invocation.actions.splice(1, 0,
    { kind: "await-native", name: "dispatch", count: 1 },
    { kind: "await-native", name: "connection-opened", count: 1 });
  if (async31C21ProcessorViolations(c21ActionOrderMutant, "C21 reversed await order mutant").length === 0)
    errors.push("AsyncAPI 3.1 C21 accepts a caller await sequence that moves backward through native chronology");

  for (const surrogate of ["\ud800", "\udc00"]) {
    if (async31GeneratedKey("source", surrogate) !== undefined
      || async31GeneratedKey("operation", 0, surrogate) !== undefined)
      errors.push("AsyncAPI 3.1 generated-key algebra replaces a lone surrogate instead of excluding it");
  }
  const replacementKey = async31GeneratedKey("operation", 0, "\ufffd");
  if (replacementKey !== "asyncapi31.operation.3000efbfbd")
    errors.push("AsyncAPI 3.1 generated-key algebra does not preserve literal U+FFFD distinctly");
  const scalarKeyBase = structuredClone(c21Synthesis.find((scenario) => scenario.id === "ASYNC31-SS-28"));
  for (const surrogate of ["\ud800", "\udc00"]) {
    const operationKeyMutant = structuredClone(scalarKeyBase);
    operationKeyMutant.source.content.operations[surrogate] = operationKeyMutant.source.content.operations.op;
    delete operationKeyMutant.source.content.operations.op;
    if (async31C21Synthesis(operationKeyMutant).operations.length !== 0)
      errors.push("AsyncAPI 3.1 synthesis emits an operation for a non-scalar root Operation key");
    const channelKeyMutant = structuredClone(scalarKeyBase);
    channelKeyMutant.source.content.channels[surrogate] = channelKeyMutant.source.content.channels.c;
    delete channelKeyMutant.source.content.channels.c;
    channelKeyMutant.source.content.operations.op.channel.$ref = `#/channels/${surrogate}`;
    if (async31C21Synthesis(channelKeyMutant).operations.length !== 0)
      errors.push("AsyncAPI 3.1 synthesis emits an operation for a non-scalar root Channel key");
    const serverKeyMutant = structuredClone(scalarKeyBase);
    serverKeyMutant.source.content.servers[surrogate] = serverKeyMutant.source.content.servers.s;
    delete serverKeyMutant.source.content.servers.s;
    if (async31C21Synthesis(serverKeyMutant).operations.length !== 0)
      errors.push("AsyncAPI 3.1 synthesis emits an operation for a non-scalar root Server key");
  }

  const validRfc3986Locations = [
    "x://user:pw@example.test:/a",
    "x://user@[2001:0DB8:0:0:0:0:192.0.2.1]:/a",
    "x://[V1.a:b]/a",
  ];
  if (validRfc3986Locations.some((location) => async31AbsoluteDocumentLocation(location) !== location)
    || ["x://a@b@c/a", "x://host:abc/a", "x://[xyz]/a", "x://[192.0.2.1::]/a", "x://[192.0.2.1::1]/a"].some((location) =>
      async31AbsoluteDocumentLocation(location) !== undefined))
    errors.push("AsyncAPI 3.1 RFC 3986 authority parser does not distinguish userinfo, empty port, IPv6/IPvFuture, and malformed authority syntax");
  if (async31ResolveRfc3986("x://user@[2001:db8::1]:/a/b", "../c#/op")?.absolute
      !== "x://user@[2001:db8::1]:/c#/op")
    errors.push("AsyncAPI 3.1 reached-reference resolver loses an exact RFC 3986 authority while rebasing");
  if (!async31Ipv6Bytes("::ffff:192.0.2.1")
    || async31Ipv6Bytes("192.0.2.1::")
    || async31Ipv6Bytes("192.0.2.1::1")
    || !async31C21Authority("[::ffff:192.0.2.1]")
    || async31C21Authority("[192.0.2.1::]")
    || async31C21Authority("[192.0.2.1::1]"))
    errors.push("AsyncAPI 3.1 IPv6 grammar permits a dotted IPv4 ls32 anywhere except the terminal position");

  if (async31ParseYamlDocument("%YAML 2.0\n---\na: b\n").ok
    || async31ParseYamlDocument("%YAML 0.9\n---\na: b\n").ok
    || !async31ParseYamlDocument("%YAML 1.3\n---\na: b\n").ok
    || !async31ParseYamlDocument("%FOO alpha\n---\na: b\n").ok)
    errors.push("AsyncAPI 3.1 YAML directive handling does not reject incompatible major versions while accepting compatible-minor and unknown reserved directives");

  const materializedKernel = (path, codeUnits, value, mutate = () => {}) => {
    const scenario = structuredClone(c21Synthesis.find((candidate) => candidate.id === "ASYNC31-SS-28"));
    mutate(scenario);
    scenario.keyMaterializations = [{ path, kind: "unpaired-utf16-key", codeUnits, value }];
    return async31C21Kernel({ source: scenario.source, resources: scenario.resources,
      resourceBytes: scenario.resourceBytes, keyMaterializations: scenario.keyMaterializations });
  };
  const rootOperationScalar = materializedKernel("/source/content/operations", [0xd800], {});
  if (!jsonValueEqual(rootOperationScalar.coverage, [async31C21InvalidEntry("#/operations")]))
    errors.push("AsyncAPI 3.1 non-scalar root Operation key is not charged once to the root Operations container");
  const rootChannelScalar = materializedKernel("/source/content/channels", [0xdc00], {});
  if (!rootChannelScalar.coverage.some((entry) => entry.sourceRef === "#/channels" && entry.operationKey === "op"))
    errors.push("AsyncAPI 3.1 non-scalar root Channel key is not charged to its canonical container per affected operation");
  const rootServerScalar = materializedKernel("/source/content/servers", [0xd800], {});
  if (rootServerScalar.coverage.filter((entry) => entry.sourceRef === "#/servers").length !== 1
    || !rootServerScalar.coverage.some((entry) => entry.rule === "ASYNC31-S-05"))
    errors.push("AsyncAPI 3.1 non-scalar root Server key is not deduplicated at the root Servers container beside S05");
  const componentOperationScalar = materializedKernel("/source/content/components/operations", [0xd800], {}, (scenario) => {
    scenario.source.content.components = { operations: { co: scenario.source.content.operations.op } };
    scenario.source.content.operations.op = { $ref: "#/components/operations/co" };
  });
  if (!componentOperationScalar.coverage.some((entry) => entry.sourceRef === "#/components/operations" && entry.operationKey === "op"))
    errors.push("AsyncAPI 3.1 non-scalar reached component Operation key is not charged to its typed map owner");
  const componentChannelScalar = materializedKernel("/source/content/components/channels", [0xdc00], {}, (scenario) => {
    scenario.source.content.components = { channels: { cc: scenario.source.content.channels.c } };
    scenario.source.content.channels.c = { $ref: "#/components/channels/cc" };
  });
  if (!componentChannelScalar.coverage.some((entry) => entry.sourceRef === "#/components/channels" && entry.operationKey === "op"))
    errors.push("AsyncAPI 3.1 non-scalar reached component Channel key is not charged to its typed map owner");
  const componentServerScalar = materializedKernel("/source/content/components/servers", [0xd800], {}, (scenario) => {
    scenario.source.content.components = { servers: { cs: scenario.source.content.servers.s } };
    scenario.source.content.servers.s = { $ref: "#/components/servers/cs" };
  });
  if (componentServerScalar.coverage.filter((entry) => entry.sourceRef === "#/components/servers").length !== 1
    || !componentServerScalar.coverage.some((entry) => entry.rule === "ASYNC31-S-05"))
    errors.push("AsyncAPI 3.1 non-scalar reached component Server key is not deduplicated beside S05");
  const multipleScalarKeys = structuredClone(c21Synthesis.find((candidate) => candidate.id === "ASYNC31-SS-28"));
  multipleScalarKeys.keyMaterializations = [
    { path: "/source/content/operations", kind: "unpaired-utf16-key", codeUnits: [0xd800], value: {} },
    { path: "/source/content/operations", kind: "unpaired-utf16-key", codeUnits: [0xdc00], value: {} },
  ];
  const multipleScalarCoverage = async31C21Synthesis(multipleScalarKeys).coverage.entries;
  if (multipleScalarCoverage.filter((entry) => entry.sourceRef === "#/operations").length !== 1)
    errors.push("AsyncAPI 3.1 multiple non-scalar root keys do not deduplicate to one typed-map owner");
  const messageScalar = materializedKernel("/source/content/channels/c/messages", [0xd800], {});
  if (!messageScalar.cells.some((cell) => cell.result.status === "excluded"))
    errors.push("AsyncAPI 3.1 non-scalar Message identifier is not excluded before identity serialization");
  const replacementScenario = structuredClone(c21Synthesis.find((candidate) => candidate.id === "ASYNC31-SS-28"));
  replacementScenario.source.content.operations["\ufffd"] = replacementScenario.source.content.operations.op;
  delete replacementScenario.source.content.operations.op;
  if (!async31C21Synthesis(replacementScenario).operations.includes("asyncapi31.operation.3000efbfbd"))
    errors.push("AsyncAPI 3.1 literal U+FFFD operation identity is not distinct from excluded UTF-16 surrogates");
  const externalMessageScalar = structuredClone(c21Synthesis.find((candidate) => candidate.id === "ASYNC31-SS-28"));
  externalMessageScalar.source.location = "https://example.test/root.json";
  externalMessageScalar.source.content.operations.op = { $ref: "channel.json#/operation" };
  externalMessageScalar.resources = {
    "https://example.test/channel.json": {
      operation: { action: "receive", channel: { $ref: "#/channel" }, bindings: { http: {} } },
      channel: { address: "/events", messages: { m: {} } },
    },
  };
  externalMessageScalar.keyMaterializations = [{
    path: "/resources/https:~1~1example.test~1channel.json/channel/messages",
    kind: "unpaired-utf16-key", codeUnits: [0xdc00], value: {},
  }];
  const externalMessageResult = async31C21Synthesis(externalMessageScalar);
  if (externalMessageResult.bindings.length || externalMessageResult.coverage.entries.some((entry) =>
    entry.sourceRef.includes("\udc00") || entry.sourceRef.includes("\ufffd")))
    errors.push("AsyncAPI 3.1 external non-scalar Message identity leaks or aliases into synthesis evidence");

  const membershipBase = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-108"));
  membershipBase.given.source.content.servers.s1 = { $ref: "#/components/servers/alias" };
  membershipBase.given.source.content.servers.s2 = membershipBase.given.source.content.servers.s;
  delete membershipBase.given.source.content.servers.s;
  membershipBase.given.source.content.components = { servers: { alias: { $ref: "#/servers/s2" } } };
  membershipBase.given.source.content.channels.c.servers = [{ $ref: "#/components/servers/alias" }];
  membershipBase.given.binding.selector = "#/servers/s2/operations/op";
  if (async31C21ProcessorViolations(membershipBase, "C21 full-ledger root membership").length)
    errors.push("AsyncAPI 3.1 full-ledger membership does not recognize the first traversed root Server slot after a component alias");
  const twoRootMembership = structuredClone(membershipBase);
  twoRootMembership.given.source.content.components.servers.alias.$ref = "#/servers/s1";
  twoRootMembership.given.source.content.servers.s1.$ref = "#/servers/s2";
  twoRootMembership.given.binding.selector = "#/servers/s1/operations/op";
  if (async31C21ProcessorViolations(twoRootMembership, "C21 first root-slot membership").length)
    errors.push("AsyncAPI 3.1 membership does not retain the first of two traversed root Server slots");
  twoRootMembership.given.binding.selector = "#/servers/s2/operations/op";
  if (async31C21Observation(twoRootMembership).phase !== "resolution")
    errors.push("AsyncAPI 3.1 membership incorrectly substitutes a later root Server referent for the first traversed slot");

  const mappedProfile = async31C21Selector(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-108").given,
    "#/servers/s/operations/op").profile;
  const mappedHttp = httpPeerV2MappedObservation([
    { kind: "response-head", after: { kind: "native", name: "dispatch", count: 1 }, httpVersion: "1.1", status: 103, headers: [] },
    { kind: "response-head", after: { kind: "native", name: "acknowledgement", count: 1 }, httpVersion: "1.1", status: 204, headers: [] },
  ], mappedProfile);
  if (mappedHttp.classification !== "successful-final"
    || !["http-peer@2:map", "http-peer@2:response-head", "http-peer@2:interim", "http-peer@2:final", "http-peer@2:successful-final"]
      .every((token) => mappedHttp.coverageTokens.includes(token)))
    errors.push("Generic HTTP peer@2 mapper lacks deterministic classification or coverage-token branches");
  const mappedTriggerHostile = httpPeerV2MappedObservation([
    { kind: "response-head", after: { kind: "native", name: "connection-opened", count: 1 }, httpVersion: "1.1", status: 204, headers: [] },
  ], mappedProfile);
  if (mappedTriggerHostile.classification !== "protocol-error")
    errors.push("Generic HTTP peer@2 mapper accepts a response whose mapped trigger is unavailable");
  for (const id of [235, 236]) {
    const boundary = c21Processor.find((scenario) => scenario.id === `ASYNC31-PS-${id}`);
    const observation = async31C21Observation(boundary);
    if (observation.disposition !== "refusal" || observation.phase !== "pre-dispatch" || observation.timeline.length)
      errors.push(`AsyncAPI 3.1 ${boundary.id} does not refuse the non-cleartext HTTP@2 boundary before dispatch`);
    const repaired = structuredClone(boundary);
    repaired.given.peer = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-108").given.peer);
    if (async31C21Observation(repaired).disposition !== "complete")
      errors.push(`AsyncAPI 3.1 ${boundary.id} does not become executable after its sole peer-boundary defect is repaired`);
  }

  const invalidFirstRootMembership = c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-237");
  const invalidFirstRootObservation = async31C21Observation(invalidFirstRootMembership);
  if (invalidFirstRootObservation.disposition !== "refusal" || invalidFirstRootObservation.phase !== "resolution")
    errors.push("AsyncAPI 3.1 invalid first root Server membership key is not rejected at resolution");
  const invalidFirstRootSynthesis = async31C21Synthesis(c21Synthesis.find((scenario) => scenario.id === "ASYNC31-SS-74"));
  if (!jsonValueEqual(invalidFirstRootSynthesis.coverage.entries, [
    { sourceIndex: 0, sourceRef: "#/servers/bad.key", scope: "target", status: "invalid", rule: "ASYNC31-S-02", requirements: [] },
    { sourceIndex: 0, sourceRef: "#/operations/op", scope: "target", status: "excluded", operationKey: "op", rule: "ASYNC31-S-05", requirements: [] },
  ]))
    errors.push("AsyncAPI 3.1 synthesis does not charge an invalid first root Server membership key to that exact authored slot");

  const validMaterializationPaths = ["/source/content", "/source/content/operations", "/resources/https:~1~1example.test~1x.json/value"];
  const invalidMaterializationPaths = [
    "/peer", "/invocation", "/operation", "/configuration", "/keyMaterializations", "/expected", "/resourceBytes/x", "/resources", "/source/location",
  ];
  if (validMaterializationPaths.some((path) => !async31KeyMaterializationPathAllowed(path))
    || invalidMaterializationPaths.some((path) => async31KeyMaterializationPathAllowed(path)))
    errors.push("AsyncAPI 3.1 keyMaterializations path-domain guard is incomplete");
  const keyPathSchemaMutant = structuredClone(async31Artifacts["processor/asyncapi-3.1.json"]);
  keyPathSchemaMutant.scenarios.find((scenario) => scenario.id === "ASYNC31-PS-225")
    .given.keyMaterializations[0].path = "/peer";
  if (ajvOk(PROCESSOR_SCHEMA, keyPathSchemaMutant).ok)
    errors.push("Processor @7 schema accepts keyMaterializations outside parsed source/resource descendants");
  const keyPathManualMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-225"));
  keyPathManualMutant.given.keyMaterializations[0].path = "/peer";
  if (async31KeyMaterializationViolations(keyPathManualMutant.given,
    keyPathManualMutant.given.keyMaterializations, "C21 key path mutant").length === 0)
    errors.push("AsyncAPI 3.1 manual validator accepts keyMaterializations outside parsed source/resource descendants");
  keyPathManualMutant.given.keyMaterializations[0].path = "/source/content/operations";
  if (async31KeyMaterializationViolations(keyPathManualMutant.given,
    keyPathManualMutant.given.keyMaterializations, "C21 repaired key path mutant").length)
    errors.push("AsyncAPI 3.1 manual validator rejects a repaired parsed-source keyMaterialization path");
  const keyMaterializationShapeMutant = structuredClone(c21Processor.find((scenario) => scenario.id === "ASYNC31-PS-225"));
  keyMaterializationShapeMutant.given.keyMaterializations[0].codeUnits = [0x41];
  if (async31C21ProcessorViolations(keyMaterializationShapeMutant, "C21 scalar-key wrapper mutant").length === 0)
    errors.push("AsyncAPI 3.1 scalar-key wrapper accepts code units without an unpaired surrogate");
  const legacyProcessorWithKeyMaterialization = JSON.parse(readFileSync(join(PROCESSOR_DIR, "asyncapi.json"), "utf8"));
  legacyProcessorWithKeyMaterialization.scenarios[0].given.keyMaterializations = [{
    path: "/source/content", kind: "unpaired-utf16-key", codeUnits: [0xd800], value: {},
  }];
  if (ajvOk(PROCESSOR_SCHEMA, legacyProcessorWithKeyMaterialization).ok)
    errors.push("Processor scenario formats before @7 accept AsyncAPI 3.1 keyMaterializations vocabulary");
  const legacySynthesisWithKeyMaterialization = JSON.parse(readFileSync(join(SYNTHESIS_DIR, "asyncapi.json"), "utf8"));
  legacySynthesisWithKeyMaterialization.scenarios[0].keyMaterializations = [{
    path: "/source/content", kind: "unpaired-utf16-key", codeUnits: [0xdc00], value: {},
  }];
  if (ajvOk(SYNTHESIS_SCHEMA, legacySynthesisWithKeyMaterialization).ok)
    errors.push("Synthesis scenario formats before @7 accept AsyncAPI 3.1 keyMaterializations vocabulary");
} catch (error) {
  errors.push(`AsyncAPI 3.1 artifact lock could not load its corpus: ${error.message}`);
}

let adjudicationCount = 0;
try {
  const adjudications = JSON.parse(readFileSync(ADJUDICATIONS, "utf8"));
  const shape = ajvOk(ADJUDICATION_SCHEMA, adjudications);
  if (!shape.ok) {
    errors.push(`adjudications.json: does not match adjudication.schema.json\n${shape.out}`);
  } else {
    const ids = new Set();
    adjudicationCount = adjudications.records.length;
    for (const [index, record] of adjudications.records.entries()) {
      const at = `adjudications.json.records[${index}]`;
      if (ids.has(record.id)) errors.push(`${at}: duplicate id '${record.id}'`);
      ids.add(record.id);
      for (const scenario of record.scenarios) {
        if (!synthesisScenarioIds.has(scenario))
          errors.push(`${at}: scenario '${scenario}' is not present in the live synthesis corpus`);
      }
      const scenarioPrefixes = new Set(
        record.scenarios.map((scenario) => scenario.slice(0, scenario.indexOf("-SS-")))
      );
      for (const rule of record.authority.coreRules) {
        if (!coreRules.has(rule))
          errors.push(`${at}: core authority rule '${rule}' is not defined by the core`);
      }
      for (const rule of record.authority.bindingRules) {
        const prefix = rule.slice(0, rule.indexOf("-"));
        if (!allRuleIds.has(rule) || !scenarioPrefixes.has(prefix))
          errors.push(`${at}: binding authority rule '${rule}' is not defined by a scenario family`);
      }
    }
  }
} catch (e) {
  errors.push(`adjudications.json: failed to parse or validate: ${e.message}`);
}

let alignmentLedgerEntries = 0;
try {
  const ledger = JSON.parse(readFileSync(ABSTRACTION_FIDELITY_LEDGER, "utf8"));
  const shape = ajvOk(ABSTRACTION_FIDELITY_SCHEMA, ledger);
  if (!shape.ok) {
    errors.push(`abstraction-fidelity/ledger.json: does not match ledger.schema.json\n${shape.out}`);
  } else {
    alignmentLedgerEntries = ledger.entries.length;
  }
} catch (e) {
  errors.push(`abstraction-fidelity/ledger.json: failed to parse or validate: ${e.message}`);
}

// --- Invocation-interface vocabulary containment -----------------------------
// A binding specification is a semantic authority consumable by ANY invocation
// surface; the project's invoker interfaces are one informative realization
// (binding-specs/README.md, "Authentication and credentials"). A binding-spec
// rule stated in the interfaces' vocabulary — its error-record members, its
// owned code spellings, its frame model — reads as a dependency on the project's
// tooling and gives a third-party implementer false grounds to think conformance
// requires our contracts. The discipline: state the operation-boundary fact
// abstractly (e.g. "admits application-authored failure data"), then scope any
// interface mention as one realization ("when the project's portable invocation
// interface is used, ..."). This check flags a paragraph that uses coupling
// vocabulary without a scoping marker.
{
  const couplingTokens = [
    [/\bERR_[A-Z][A-Z_]+\b/, "an interface-owned error-code spelling"],
    [/\bCONTEXT_REQUIRED\b|`context-required`/, "the context-negotiation code"],
    [/invocation error's|invocation error `data`|error `data` member|`data` member/, "the invocation error record's member"],
    [/\binvocation interface\b/, "the invocation interface"],
    [/\bbinding-invoker\b|\boperation-invoker\b/, "a project interface name"],
    [/\binvocation frames?\b|\bframe protocol\b/, "the interface frame model"],
  ];
  const scopingMarkers = [
    /informative/i,
    /portable invocation interface is used/,
    /under the project's portable invocation interface/,
    /that surface's contract/,
    /one such negotiation surface/,
    /\brealization\b/,
  ];
  const specPages = readdirSync(join(SPEC_ROOT, "binding-specs"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(SPEC_ROOT, "binding-specs", entry.name))
    .flatMap((dir) => readdirSync(dir).filter((f) => /^openbindings\..*\.md$/.test(f)).map((f) => join(dir, f)));
  for (const page of specPages) {
    const text = readFileSync(page, "utf8");
    let line = 1;
    for (const rawParagraph of text.split(/\n\s*\n/)) {
      const startLine = line;
      line += rawParagraph.split("\n").length + 1;
      // Hard-wrapped prose splits phrases across lines; match on the unwrapped text.
      const paragraph = rawParagraph.replace(/\s+/g, " ");
      const hit = couplingTokens.find(([token]) => token.test(paragraph));
      if (!hit) continue;
      if (scopingMarkers.some((marker) => marker.test(paragraph))) continue;
      errors.push(
        `${relative(SPEC_ROOT, page)}:${startLine}: paragraph uses ${hit[1]} without scoping it as an invocation-surface realization (state the binding-spec fact abstractly, then scope the interface mention)`
      );
    }
  }
}

// --- 11. The synthesis source shape still matches Core ----------------------
// Core requires a binding source to carry location or content. A constraint
// nothing exercises is not a constraint: every live scenario satisfies it, so
// the corpus alone cannot show the schema still carries it. These probes do —
// removing the `anyOf` turns the third one red.
{
  const synthesisSchema = JSON.parse(readFileSync(SYNTHESIS_SCHEMA, "utf8"));
  const probeFile = (source) => ({
    format: "openbindings.binding-spec-synthesis-scenarios@5",
    bindingSpec: "openbindings.openapi-3.1@1",
    family: "openapi-3.1",
    description: "verifier probe; not part of the corpus",
    scenarios: [
      {
        id: "OAPI31-SS-99",
        description: "verifier probe; not part of the corpus",
        source,
        expected: { outcome: "refused", rules: ["OAPI31-P-01"] },
      },
    ],
  });
  const probes = [
    ["carrying `content`", { bindingSpec: "openbindings.openapi-3.1@1", content: {} }, true],
    [
      "carrying `location`",
      { bindingSpec: "openbindings.openapi-3.1@1", location: "https://example.com/a.yaml" },
      true,
    ],
    ["carrying neither `location` nor `content`", { bindingSpec: "openbindings.openapi-3.1@1" }, false],
  ];
  for (const [what, source, shouldValidate] of probes) {
    const probe = ajvOk(SYNTHESIS_SCHEMA, probeFile(source));
    if (probe.ok === shouldValidate) continue;
    errors.push(
      shouldValidate
        ? `synthesis-scenario.schema.json rejects a scenario source ${what}, which Core admits\n${probe.out}`
        : `synthesis-scenario.schema.json accepts a scenario source ${what}; Core requires location or content (restore the 'anyOf' on the source object)`
    );
  }
}

// --- 12. Revision-5 assertion syntax stays version-gated --------------------
// A new evaluator cannot leak into a revision-1 family merely because the
// assertion union knows its shape. This probe independently exercises the
// schema gate and the family-neutral verifier check.
{
  const legacySemanticAssertion = {
    format: "openbindings.binding-spec-processor-scenarios@1",
    bindingSpec: "openbindings.asyncapi@1",
    family: "asyncapi",
    description: "verifier probe; not part of the corpus",
    scenarios: [
      {
        id: "ASYNC-PS-99",
        rules: ["ASYNC-P-01"],
        section: "1",
        description: "verifier probe; not part of the corpus",
        given: {
          source: {},
          binding: {},
          invocation: { inputPresent: false },
        },
        expected: [
          {
            disposition: "complete",
            phase: "completion",
            assertions: [
              {
                path: "/dispatch/body",
                semanticEquals: { as: "json-lines", value: [] },
              },
            ],
          },
        ],
      },
    ],
  };
  const probe = ajvOk(PROCESSOR_SCHEMA, legacySemanticAssertion);
  if (probe.ok)
    errors.push(
      "processor-scenario.schema.json accepts semanticEquals under format @1; revision-5 assertion syntax must remain version-gated"
    );
  const manualViolations = semanticAssertionFormatViolations(
    legacySemanticAssertion,
    "processor-scenario verifier probe"
  );
  if (manualViolations.length !== 1)
    errors.push(
      `semanticEquals format verifier probe expected one violation under format @1; observed ${manualViolations.length}`
    );
}

// --- 13. Revision-6 messaging semantics are executable and portable --------
// Matcher and peer-dialect qualification lives in one tracked exchange that
// external Go and TypeScript adapters can run unchanged. Verifier-only probes
// below cover schema/version isolation and synthesis invariants.
{
  let probes;
  try {
    const probeText = readFileSync(PROCESSOR_V6_PROBES, "utf8");
    const losslessProbe = parseLosslessJson(probeText);
    if (!losslessProbe.ok)
      throw new Error(`lossless JSON validation failed: ${losslessProbe.error}`);
    probes = JSON.parse(probeText);
  } catch (error) {
    errors.push(`harness-probes/processor-v6.json: failed to parse: ${error.message}`);
    probes = { matcherCases: [], peerCases: [], scenarioCases: [] };
  }
  const probeShape = ajvOk(PROCESSOR_V6_PROBE_SCHEMA, probes);
  if (!probeShape.ok)
    errors.push(`harness-probes/processor-v6.json: does not match its schema\n${probeShape.out}`);
  let semanticProbes;
  try {
    const semanticProbeText = readFileSync(PROCESSOR_V6_SEMANTIC_PROBES, "utf8");
    const losslessSemanticProbe = parseLosslessJson(semanticProbeText);
    if (!losslessSemanticProbe.ok)
      throw new Error(`lossless JSON validation failed: ${losslessSemanticProbe.error}`);
    semanticProbes = JSON.parse(semanticProbeText);
  } catch (error) {
    errors.push(`harness-probes/processor-v6-semantics.json: failed to parse: ${error.message}`);
    semanticProbes = { cases: [] };
  }
  const semanticProbeShape = ajvOk(PROCESSOR_V6_SEMANTIC_PROBE_SCHEMA, semanticProbes);
  if (!semanticProbeShape.ok)
    errors.push(`harness-probes/processor-v6-semantics.json: does not match its schema\n${semanticProbeShape.out}`);
  let semanticManifest;
  let semanticManifestText = "";
  try {
    semanticManifestText = readFileSync(PROCESSOR_V6_SEMANTIC_MANIFEST, "utf8");
    const losslessSemanticManifest = parseLosslessJson(semanticManifestText);
    if (!losslessSemanticManifest.ok)
      throw new Error(`lossless JSON validation failed: ${losslessSemanticManifest.error}`);
    semanticManifest = JSON.parse(semanticManifestText);
  } catch (error) {
    errors.push(`harness-probes/processor-v6-semantics.manifest.json: failed to parse: ${error.message}`);
    semanticManifest = { entries: [] };
  }
  const semanticManifestShape = ajvOk(PROCESSOR_V6_SEMANTIC_MANIFEST_SCHEMA, semanticManifest);
  if (!semanticManifestShape.ok)
    errors.push(`harness-probes/processor-v6-semantics.manifest.json: does not match its schema\n${semanticManifestShape.out}`);
  if (semanticManifestText) {
    const duplicateRootMember = semanticManifestText.replace(
      /"format"\s*:\s*"([^"]+)"/,
      '$&,\n  "format": "$1"'
    );
    if (parseLosslessJson(duplicateRootMember).ok)
      errors.push("portable semantic manifest lossless parser accepts a duplicate root member");
    const duplicateEntryMember = semanticManifestText.replace(
      /"caseId"\s*:\s*"([^"]+)"/,
      '$&,\n      "caseId": "$1"'
    );
    if (parseLosslessJson(duplicateEntryMember).ok)
      errors.push("portable semantic manifest lossless parser accepts a duplicate entry-object member");
  }
  if (semanticProbes.manifestFile !== basename(PROCESSOR_V6_SEMANTIC_MANIFEST))
    errors.push("portable semantic artifact does not reference its executed integrity manifest");

  const semanticIntegrityViolations = (artifact, manifest, at) => {
    const violations = [];
    if (sortedJsonSha256(manifest) !== PROCESSOR_V6_SEMANTIC_MANIFEST_ROOT_SHA256)
      violations.push(`${at}: semantic manifest does not match the verifier-owned trust-anchor root`);
    const manifestByKey = new Map();
    for (const [index, entry] of (manifest?.entries || []).entries()) {
      const key = `${entry.caseId}\0${entry.expectation}\0${entry.trialId}`;
      if (manifestByKey.has(key))
        violations.push(`${at}.manifest.entries[${index}]: duplicate manifest identity '${entry.trialId}'`);
      manifestByKey.set(key, entry);
    }
    const caseIds = new Set();
    const trialIds = new Set();
    const contentIdentities = new Map();
    const consumedManifestKeys = new Set();
    let acceptedCount = 0;
    let rejectedCount = 0;
    for (const semanticCase of artifact?.cases || []) {
      if (caseIds.has(semanticCase.id))
        violations.push(`${at}: duplicate case id '${semanticCase.id}'`);
      caseIds.add(semanticCase.id);
      for (const expectation of ["accepted", "rejected"]) {
        for (const trial of semanticCase[expectation] || []) {
          if (expectation === "accepted") acceptedCount++;
          else rejectedCount++;
          if (trialIds.has(trial.id))
            violations.push(`${at}: duplicate trial id '${trial.id}'`);
          trialIds.add(trial.id);
          const expectedTrialPrefix = `${semanticCase.id}-${expectation === "accepted" ? "A" : "R"}`;
          if (!trial.id.startsWith(expectedTrialPrefix))
            violations.push(`${at}: trial id '${trial.id}' is not stable within ${semanticCase.id}.${expectation}`);
          const contentIdentity = sortedJsonSha256({
            validator: semanticCase.validator,
            expectation,
            subject: trial.subject,
          });
          if (contentIdentities.has(contentIdentity))
            violations.push(`${at}: duplicate semantic trial content in '${contentIdentities.get(contentIdentity)}' and '${trial.id}'`);
          else contentIdentities.set(contentIdentity, trial.id);
          const key = `${semanticCase.id}\0${expectation}\0${trial.id}`;
          const entry = manifestByKey.get(key);
          if (!entry) {
            violations.push(`${at}: manifest entry missing for '${trial.id}'`);
            continue;
          }
          consumedManifestKeys.add(key);
          const digest = sortedJsonSha256({
            caseId: semanticCase.id,
            validator: semanticCase.validator,
            expectation,
            trial,
          });
          if (entry.sha256 !== digest)
            violations.push(`${at}: canonical content hash mismatch for '${trial.id}'`);
        }
      }
    }
    for (const [key, entry] of manifestByKey) {
      if (!consumedManifestKeys.has(key))
        violations.push(`${at}: manifest has orphan entry '${entry.trialId}'`);
    }
    const actualCounts = {
      cases: caseIds.size,
      accepted: acceptedCount,
      rejected: rejectedCount,
      trials: acceptedCount + rejectedCount,
    };
    for (const [name, expectedCount] of Object.entries(PROCESSOR_V6_SEMANTIC_EXPECTED_COUNTS)) {
      if (actualCounts[name] !== expectedCount)
        violations.push(`${at}: exact ${name} count is ${actualCounts[name]}, expected ${expectedCount}`);
    }
    for (const trialId of PROCESSOR_V6_REQUIRED_SEMANTIC_TRIAL_IDS) {
      if (!trialIds.has(trialId))
        violations.push(`${at}: required semantic trial id '${trialId}' is missing`);
    }
    for (const trialId of trialIds) {
      if (!PROCESSOR_V6_REQUIRED_SEMANTIC_TRIAL_IDS.has(trialId))
        violations.push(`${at}: unexpected semantic trial id '${trialId}' is not trust-anchored`);
    }
    return violations;
  };
  errors.push(...semanticIntegrityViolations(semanticProbes, semanticManifest, "harness-probes/processor-v6-semantics"));
  const portableSemanticViolations = (validator, subject, at) => {
    if (validator === "mqtt-packet-flow")
      return mqttPacketFlowViolations(subject.expected, at, subject.protocolVersion, subject.runtime);
    if (validator === "mqtt-connection-timeline")
      return mqttConnectionTimelineViolations(subject.expected, subject.peerScript, subject.configuration || {}, at);
    if (validator === "peer-script")
      return peerScriptViolations(subject.dialect, subject.script, at);
    if (validator === "native-event-schema") {
      const schema = nativeDialectSchema(subject.dialect, subject.peerScript || {});
      const shape = ajvOk(schema, subject.event);
      return shape.ok ? [] : [`${at}: native event schema rejected subject\n${shape.out}`];
    }
    return [`${at}: unknown portable semantic validator '${validator}'`];
  };
  const portableSemanticSubjectMatchesValidator = (validator, subject) => {
    if (validator === "mqtt-packet-flow")
      return typeof subject?.protocolVersion === "string" && subject?.expected && !subject?.peerScript;
    if (validator === "mqtt-connection-timeline")
      return subject?.peerScript && subject?.expected && !subject?.protocolVersion;
    if (validator === "peer-script")
      return typeof subject?.dialect === "string" && subject?.script && !subject?.event;
    if (validator === "native-event-schema")
      return typeof subject?.dialect === "string" && subject?.peerScript && subject?.event;
    return false;
  };
  const semanticCaseIds = new Set();
  let acceptedSemanticTrialCount = 0;
  let rejectedSemanticTrialCount = 0;
  for (const semanticCase of semanticProbes.cases || []) {
    if (semanticCaseIds.has(semanticCase.id))
      errors.push(`harness probe duplicates semantic case id '${semanticCase.id}'`);
    semanticCaseIds.add(semanticCase.id);
    for (const trial of semanticCase.accepted || []) {
      acceptedSemanticTrialCount++;
      if (!portableSemanticSubjectMatchesValidator(semanticCase.validator, trial.subject)) {
        errors.push(`${semanticCase.id}: accepted trial subject does not match validator '${semanticCase.validator}': ${trial.name}`);
        continue;
      }
      const trialViolations = portableSemanticViolations(
        semanticCase.validator,
        trial.subject,
        `${semanticCase.id}.accepted.${trial.name}`
      );
      if (trialViolations.length)
        errors.push(`${semanticCase.id}: accepted portable semantic trial rejected: ${trial.name}\n${trialViolations.join("\n")}`);
    }
    for (const trial of semanticCase.rejected || []) {
      rejectedSemanticTrialCount++;
      if (!portableSemanticSubjectMatchesValidator(semanticCase.validator, trial.subject)) {
        errors.push(`${semanticCase.id}: rejected trial subject does not match validator '${semanticCase.validator}': ${trial.name}`);
        continue;
      }
      const trialViolations = portableSemanticViolations(
        semanticCase.validator,
        trial.subject,
        `${semanticCase.id}.rejected.${trial.name}`
      );
      if (trialViolations.length === 0)
        errors.push(`${semanticCase.id}: rejected portable semantic trial accepted: ${trial.name}`);
    }
  }
  if (probes.semanticCasesFile !== basename(PROCESSOR_V6_SEMANTIC_PROBES))
    errors.push("processor-v6 harness semanticCasesFile does not reference the executed portable semantic artifact");
  if (
    semanticCaseIds.size !== PROCESSOR_V6_SEMANTIC_EXPECTED_COUNTS.cases
    || acceptedSemanticTrialCount !== PROCESSOR_V6_SEMANTIC_EXPECTED_COUNTS.accepted
    || rejectedSemanticTrialCount !== PROCESSOR_V6_SEMANTIC_EXPECTED_COUNTS.rejected
  ) errors.push(`processor-v6 semantic harness exact coverage drifted (found ${semanticCaseIds.size} cases, ${acceptedSemanticTrialCount} accepted, ${rejectedSemanticTrialCount} rejected)`);
  if (/\bconst gateC(?:[4-9]|10)/.test(readFileSync(fileURLToPath(import.meta.url), "utf8")))
    errors.push("Gate-C4 through Gate-C10 semantic qualification must not regress to verifier-private const corpora");

  const firstPacketCase = (semanticProbes.cases || []).find((entry) =>
    entry.validator === "mqtt-packet-flow" && entry.accepted?.length
  );
  if (firstPacketCase) {
    const emptyExpected = structuredClone(semanticProbes);
    const emptyExpectedCase = emptyExpected.cases.find((entry) => entry.id === firstPacketCase.id);
    emptyExpectedCase.accepted[0].subject.expected = {};
    if (ajvOk(PROCESSOR_V6_SEMANTIC_PROBE_SCHEMA, emptyExpected).ok)
      errors.push("portable semantic schema accepts MQTT subject expected:{}");

    const omittedTimeline = structuredClone(semanticProbes);
    const omittedTimelineCase = omittedTimeline.cases.find((entry) => entry.id === firstPacketCase.id);
    delete omittedTimelineCase.accepted[0].subject.expected.timeline;
    if (ajvOk(PROCESSOR_V6_SEMANTIC_PROBE_SCHEMA, omittedTimeline).ok)
      errors.push("portable semantic schema accepts a subject with omitted timeline");

    const runtimeTypo = structuredClone(semanticProbes);
    const runtimeTypoCase = runtimeTypo.cases.find((entry) => entry.id === firstPacketCase.id);
    runtimeTypoCase.accepted[0].subject.runtime = { mqttPreSubackBufferLimt: 1 };
    if (ajvOk(PROCESSOR_V6_SEMANTIC_PROBE_SCHEMA, runtimeTypo).ok)
      errors.push("portable semantic schema accepts a private/typo runtime field");

    const privateTimelineField = structuredClone(semanticProbes);
    const privateTimelineCase = privateTimelineField.cases.find((entry) => entry.id === firstPacketCase.id);
    privateTimelineCase.accepted[0].subject.expected.timeline[0].__private = true;
    if (ajvOk(PROCESSOR_V6_SEMANTIC_PROBE_SCHEMA, privateTimelineField).ok)
      errors.push("portable semantic schema accepts a private timeline-event field");

    const wrongValidator = structuredClone(semanticProbes);
    wrongValidator.cases.find((entry) => entry.id === firstPacketCase.id).validator = "peer-script";
    if (ajvOk(PROCESSOR_V6_SEMANTIC_PROBE_SCHEMA, wrongValidator).ok)
      errors.push("portable semantic schema accepts a wrong validator/subject pair");
  }
  const firstRejectedCase = (semanticProbes.cases || []).find((entry) => entry.rejected?.length);
  if (firstRejectedCase) {
    const guttedNegative = structuredClone(semanticProbes);
    const guttedCase = guttedNegative.cases.find((entry) => entry.id === firstRejectedCase.id);
    guttedCase.rejected[0].subject = structuredClone(
      (semanticProbes.cases || []).find((entry) => entry.accepted?.length)?.accepted[0].subject
      || guttedCase.rejected[0].subject
    );
    if (semanticIntegrityViolations(guttedNegative, semanticManifest, "gutted-negative mutant").length === 0)
      errors.push("portable semantic manifest accepts a gutted/swapped negative trial");

    const duplicateTrial = structuredClone(semanticProbes);
    const duplicateCase = duplicateTrial.cases.find((entry) => entry.id === firstRejectedCase.id);
    duplicateCase.rejected.push(structuredClone(duplicateCase.rejected[0]));
    if (semanticIntegrityViolations(duplicateTrial, semanticManifest, "duplicate-id mutant").length === 0)
      errors.push("portable semantic integrity accepts a duplicate trial id/content");

    const duplicateContent = structuredClone(semanticProbes);
    const duplicateContentCase = duplicateContent.cases.find((entry) => entry.id === firstRejectedCase.id);
    const copied = structuredClone(duplicateContentCase.rejected[0]);
    copied.id = `${firstRejectedCase.id}-R99`;
    duplicateContentCase.rejected.push(copied);
    if (semanticIntegrityViolations(duplicateContent, semanticManifest, "duplicate-content mutant").length === 0)
      errors.push("portable semantic integrity accepts duplicate content under a new id");

    const coordinatedDeletionArtifact = structuredClone(semanticProbes);
    const coordinatedDeletionManifest = structuredClone(semanticManifest);
    const deletionCase = coordinatedDeletionArtifact.cases.find((entry) => entry.id === firstRejectedCase.id);
    const [deletedTrial] = deletionCase.rejected.splice(0, 1);
    coordinatedDeletionManifest.entries = coordinatedDeletionManifest.entries.filter((entry) =>
      entry.trialId !== deletedTrial.id
    );
    const coordinatedDeletionViolations = semanticIntegrityViolations(
      coordinatedDeletionArtifact,
      coordinatedDeletionManifest,
      "coordinated-deletion mutant"
    );
    if (
      !coordinatedDeletionViolations.some((entry) => entry.includes("trust-anchor root"))
      || !coordinatedDeletionViolations.some((entry) => entry.includes("exact rejected count"))
      || !coordinatedDeletionViolations.some((entry) => entry.includes("required semantic trial id"))
    ) errors.push("portable semantic trust anchor does not reject coordinated artifact+manifest trial deletion");
  }
  const matcherIds = new Set();
  const semanticMatcherModes = new Set();
  const formMatcherEditions = new Set();
  const matcherFailureNames = new Set();
  let failingMatcherCount = 0;
  for (const probe of probes.matcherCases || []) {
    if (matcherIds.has(probe.id)) errors.push(`harness probe duplicates matcher id '${probe.id}'`);
    matcherIds.add(probe.id);
    for (const assertion of probe.expected?.assertions || []) {
      if (assertion?.semanticEquals?.as) semanticMatcherModes.add(assertion.semanticEquals.as);
      if (assertion?.semanticEquals?.as === "form-json-field")
        formMatcherEditions.add(assertion.semanticEquals.formEncoding);
    }
    if (!PEER_DIALECT_SCHEMAS.has(probe.dialect))
      errors.push(`${probe.id}: unknown matcher dialect '${probe.dialect}'`);
    const expectedFixture = {
      format: PROCESSOR_V6,
      bindingSpec: "openbindings.asyncapi-3.0@1",
      family: "asyncapi-3.0",
      description: "portable matcher qualification wrapper",
      scenarios: [{
        id: "ASYNC30-PS-99", rules: ["ASYNC30-P-1"], section: "1",
        description: "portable matcher qualification wrapper",
        given: { source: {}, binding: {}, invocation: { inputPresent: false } },
        expected: [{ ...probe.expected, rules: ["ASYNC30-P-1"] }]
      }]
    };
    const expectedShape = ajvOk(PROCESSOR_SCHEMA, expectedFixture);
    if (!expectedShape.ok)
      errors.push(`${probe.id}: expected alternative does not match processor revision 6\n${expectedShape.out}`);
    const nativeSchema = nativeDialectSchema(probe.dialect, probe.peerScript);
    for (const [index, event] of (probe.expected.timeline || []).entries()) {
      if (event.kind === "native" && !ajvOk(nativeSchema, event).ok)
        errors.push(`${probe.id}: expected timeline native event ${index} does not match ${probe.dialect}`);
    }
    if (!revisionSixAlternativeMatches(probe.passingObservation, probe.expected))
      errors.push(`${probe.id}: revision-6 matcher rejects its passing observation`);
    for (const failure of probe.failingObservations || []) {
      failingMatcherCount++;
      matcherFailureNames.add(`${probe.id}:${failure.name}`);
      if (revisionSixAlternativeMatches(failure.observation, probe.expected))
        errors.push(`${probe.id}: revision-6 matcher accepts failing observation '${failure.name}'`);
    }
  }
  const mappingIds = new Set();
  const mappingCoverage = new Set();
  let failingMappingCount = 0;
  let generatedMappingMutationCount = 0;
  for (const probe of probes.mappingCases || []) {
    if (mappingIds.has(probe.id)) errors.push(`harness probe duplicates mapping id '${probe.id}'`);
    mappingIds.add(probe.id);
    for (const token of peerMappingCoverageTokens(probe.dialect, probe.script))
      mappingCoverage.add(token);
    const scriptViolations = peerScriptViolations(probe.dialect, probe.script, `${probe.id}.script`);
    if (scriptViolations.length)
      errors.push(`${probe.id}: mapping script is not a valid peer script\n${scriptViolations.join("\n")}`);
    const mapped = mappedPeerObservations(probe.dialect, probe.script);
    if (!exactObservationListEqual(mapped, probe.expectedMappings))
      errors.push(`${probe.id}: peer mapping does not equal its tracked expected observation list`);
    const nativeSchema = nativeDialectSchema(probe.dialect, probe.script);
    for (const [index, event] of (probe.expectedMappings || []).entries()) {
      if (!nativeSchema || !ajvOk(nativeSchema, event).ok)
        errors.push(`${probe.id}: expected mapping ${index} does not match the selected native schema`);
    }
    for (const failure of probe.failingMappings || []) {
      failingMappingCount++;
      if (exactObservationListEqual(failure.mappedObservations, probe.expectedMappings))
        errors.push(`${probe.id}: exact mapping comparator accepts failing mapping '${failure.name}'`);
    }
    const removed = probe.expectedMappings.slice(1);
    generatedMappingMutationCount++;
    if (exactObservationListEqual(removed, probe.expectedMappings))
      errors.push(`${probe.id}: exact mapping comparator accepts removal of a mapped observation`);
    const duplicated = [...probe.expectedMappings, structuredClone(probe.expectedMappings.at(-1))];
    generatedMappingMutationCount++;
    if (exactObservationListEqual(duplicated, probe.expectedMappings))
      errors.push(`${probe.id}: exact mapping comparator accepts a duplicate mapped observation`);
    for (const [index, event] of probe.expectedMappings.entries()) {
      for (const mutatedEvent of jsonValueMutations(event)) {
        generatedMappingMutationCount++;
        const mutation = structuredClone(probe.expectedMappings);
        mutation[index] = mutatedEvent;
        if (exactObservationListEqual(mutation, probe.expectedMappings))
          errors.push(`${probe.id}: exact mapping comparator accepts a field mutation at expected mapping ${index}`);
      }
    }
  }
  const requiredMappingCoverage = [
    "http:response", "http:disconnect",
    "websocket:handshake-accepted", "websocket:handshake-rejected", "websocket:handshake-protocol-error",
    "websocket:text-message", "websocket:binary-message", "websocket:fragmented-message",
    "websocket:invalid-frame", "websocket:close", "websocket:disconnect",
    "kafka:produce-ack", "kafka:record", "kafka:rebalance", "kafka:reconnect", "kafka:disconnect",
    ...["3.1.1", "5.0"].flatMap((version) => {
      const eventKinds = ["puback", "pubrec", "pubrel", "pubcomp", "suback", "unsuback", "publish", "reconnect", "transport-loss"];
      if (version === "5.0") eventKinds.push("disconnect");
      return [
        `mqtt-${version}:connection-accepted`, `mqtt-${version}:connection-rejected`,
        ...eventKinds.map((kind) => `mqtt-${version}:${kind}`),
      ];
    }),
  ];
  for (const token of requiredMappingCoverage) {
    if (!mappingCoverage.has(token))
      errors.push(`processor-v6 harness has no exact peer-mapping qualification for '${token}'`);
  }
  if (mappingIds.size < 8 || failingMappingCount < 8 || generatedMappingMutationCount < 100)
    errors.push(`processor-v6 harness must contain at least 8 mapping cases, 8 tracked failing mappings, and 100 generated field mutations (found ${mappingIds.size}/${failingMappingCount}/${generatedMappingMutationCount})`);
  const peerIds = new Set();
  const peerFailureNames = new Set();
  let validPeerCount = 0;
  let invalidPeerCount = 0;
  for (const probe of probes.peerCases || []) {
    if (peerIds.has(probe.id)) errors.push(`harness probe duplicates peer id '${probe.id}'`);
    peerIds.add(probe.id);
    for (const [index, script] of (probe.valid || []).entries()) {
      validPeerCount++;
      const violations = peerScriptViolations(probe.dialect, script, `${probe.id}.valid[${index}]`);
      if (violations.length) errors.push(`${probe.id}: valid peer script rejected\n${violations.join("\n")}`);
    }
    for (const failure of probe.invalid || []) {
      invalidPeerCount++;
      peerFailureNames.add(`${probe.id}:${failure.name}`);
      if (peerScriptViolations(probe.dialect, failure.script, `${probe.id}.${failure.name}`).length === 0)
        errors.push(`${probe.id}: invalid peer script accepted: ${failure.name}`);
    }
  }
  const websocketWireMutations = [
    {
      handshake: { upgrade: "websocket", connectionTokens: ["Upgrade"], outcome: "accepted", status: 101, secWebSocketAccept: "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=", subprotocol: null, extensions: [] },
      events: [{ after: { kind: "start" }, kind: "close", code: 1005, reason: "" }],
    },
    {
      handshake: { upgrade: "websocket", connectionTokens: ["Upgrade"], outcome: "accepted", status: 101, secWebSocketAccept: "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=", subprotocol: null, extensions: [] },
      events: [{ after: { kind: "start" }, kind: "close", code: 1000, reason: "💥".repeat(31) }],
    },
    {
      handshake: { upgrade: "websocket", connectionTokens: ["Upgrade"], outcome: "accepted", status: 101, secWebSocketAccept: "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=", subprotocol: null, extensions: [] },
      events: [{ after: { kind: "start" }, kind: "close", code: 1000, reason: String.fromCharCode(0xd800) }],
    },
  ];
  for (const [index, script] of websocketWireMutations.entries()) {
    if (peerScriptViolations("openbindings.asyncapi-websocket-peer@1", script, `WebSocket wire mutation ${index}`).length === 0)
      errors.push(`WebSocket Close wire mutation ${index} was accepted`);
  }
  const httpChronologyMutations = [
    { after: { kind: "native", name: "dispatch", count: 1 }, outcome: "disconnect", disconnectAt: "before-request" },
    { after: { kind: "start" }, outcome: "disconnect", disconnectAt: "after-request" },
  ];
  for (const [index, script] of httpChronologyMutations.entries()) {
    if (peerScriptViolations("openbindings.asyncapi-http-peer@1", script, `HTTP chronology mutation ${index}`).length === 0)
      errors.push(`HTTP disconnectAt chronology mutation ${index} was accepted`);
  }
  const gateC3PeerMutations = [
    {
      name: "WebSocket handshake omits Upgrade and Connection evidence",
      dialect: "openbindings.asyncapi-websocket-peer@1",
      script: { handshake: { outcome: "accepted", status: 101, secWebSocketAccept: "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=", subprotocol: null, extensions: [] }, events: [] },
    },
    {
      name: "WebSocket selected subprotocol contains CRLF",
      dialect: "openbindings.asyncapi-websocket-peer@1",
      script: { handshake: { upgrade: "websocket", connectionTokens: ["Upgrade"], outcome: "protocol-error", error: "unauthorized-subprotocol", status: 101, secWebSocketAccept: "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=", subprotocol: "events\r\nInjected", extensions: [] }, events: [] },
    },
    {
      name: "WebSocket invalid UTF-8 proof is a nonfinal prefix",
      dialect: "openbindings.asyncapi-websocket-peer@1",
      script: { handshake: { upgrade: "websocket", connectionTokens: ["Upgrade"], outcome: "accepted", status: 101, secWebSocketAccept: "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=", subprotocol: null, extensions: [] }, events: [{ after: { kind: "start" }, kind: "invalid-frame", violation: "invalid-utf8-text", fin: false, opcode: "text", masked: false, payloadBase64: "/w==" }] },
    },
    {
      name: "MQTT reconnect occurs without a preceding loss",
      dialect: "openbindings.asyncapi-mqtt-peer@1",
      script: { protocolVersion: "3.1.1", connection: { accepted: true, sessionPresent: false }, events: [{ after: { kind: "start" }, kind: "reconnect", attempt: 1, sessionPresent: false }] },
    },
    {
      name: "MQTT PUBLISH occurs between loss and reconnect",
      dialect: "openbindings.asyncapi-mqtt-peer@1",
      script: { protocolVersion: "3.1.1", connection: { accepted: true, sessionPresent: false }, events: [{ after: { kind: "start" }, kind: "transport-loss" }, { after: { kind: "start" }, kind: "publish", topic: "orders", qos: 0, retain: false, duplicate: false, payloadBase64: "" }] },
    },
    {
      name: "MQTT topic exceeds the encoded UTF-8 limit",
      dialect: "openbindings.asyncapi-mqtt-peer@1",
      script: { protocolVersion: "5.0", connection: { accepted: true, reasonCode: 0, sessionPresent: false, properties: [] }, events: [{ after: { kind: "start" }, kind: "publish", topic: "a".repeat(65536), qos: 0, retain: false, duplicate: false, payloadBase64: "", properties: [] }] },
    },
    {
      name: "MQTT Binary Data property exceeds its decoded limit",
      dialect: "openbindings.asyncapi-mqtt-peer@1",
      script: { protocolVersion: "5.0", connection: { accepted: true, reasonCode: 0, sessionPresent: false, properties: [] }, events: [{ after: { kind: "start" }, kind: "publish", topic: "orders", qos: 0, retain: false, duplicate: false, payloadBase64: "", properties: [{ name: "correlation-data", valueBase64: Buffer.alloc(65536).toString("base64") }] }] },
    },
    {
      name: "MQTT 5 server DISCONNECT carries Session Expiry Interval",
      dialect: "openbindings.asyncapi-mqtt-peer@1",
      script: { protocolVersion: "5.0", connection: { accepted: true, reasonCode: 0, sessionPresent: false, properties: [] }, events: [{ after: { kind: "start" }, kind: "disconnect", reasonCode: 0, properties: [{ name: "session-expiry-interval", value: 0 }] }] },
    },
  ];
  for (const mutation of gateC3PeerMutations) {
    if (peerScriptViolations(mutation.dialect, mutation.script, mutation.name).length === 0)
      errors.push(`Gate-C3 counterexample accepted: ${mutation.name}`);
  }
  const gateC3PeerBoundaries = [
    {
      name: "MQTT topic at the encoded UTF-8 limit",
      script: { protocolVersion: "5.0", connection: { accepted: true, reasonCode: 0, sessionPresent: false, properties: [] }, events: [{ after: { kind: "start" }, kind: "publish", topic: "a".repeat(65535), qos: 0, retain: false, duplicate: false, payloadBase64: "", properties: [] }] },
    },
    {
      name: "MQTT Binary Data property at its decoded limit",
      script: { protocolVersion: "5.0", connection: { accepted: true, reasonCode: 0, sessionPresent: false, properties: [] }, events: [{ after: { kind: "start" }, kind: "publish", topic: "orders", qos: 0, retain: false, duplicate: false, payloadBase64: "", properties: [{ name: "correlation-data", valueBase64: Buffer.alloc(65535).toString("base64") }] }] },
    },
  ];
  for (const boundary of gateC3PeerBoundaries) {
    const violations = peerScriptViolations("openbindings.asyncapi-mqtt-peer@1", boundary.script, boundary.name);
    if (violations.length)
      errors.push(`Gate-C3 valid boundary rejected: ${boundary.name}\n${violations.join("\n")}`);
  }
  const mqtt5NativeSchema = nativeDialectSchema(
    "openbindings.asyncapi-mqtt-peer@1",
    { protocolVersion: "5.0" }
  );
  for (const packetType of ["SUBACK", "UNSUBACK"]) {
    const event = { kind: "native", name: "dispatch", facts: { packetType, packetId: 7, reasonCode: 0, properties: [] } };
    if (ajvOk(mqtt5NativeSchema, event).ok)
      errors.push(`Gate-C3 counterexample accepted: client-dispatched ${packetType}`);
  }
  const gateC3TimelineMutations = [
    {
      name: "WebSocket output follows peer Close",
      violations: () => websocketHandshakeTimelineViolations({ timeline: [
        { kind: "native", name: "dispatch", facts: { frameType: "opening-request", headers: [], method: "GET", target: "/", host: "example.test", connection: "Upgrade", upgrade: "websocket", secWebSocketKey: "dGhlIHNhbXBsZSBub25jZQ==", secWebSocketVersion: "13", subprotocols: [], extensions: [], authorizationSha256: null, apiKeyHeaders: [] } },
        { kind: "native", name: "connection-opened", facts: { status: 101, upgrade: "websocket", connectionTokens: ["Upgrade"], secWebSocketAccept: "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=", subprotocol: null, extensions: [] } },
        { kind: "native", name: "connection-closed", facts: { origin: "peer", clean: true, code: 1000, reason: "done" } },
        { kind: "output", index: 0, value: "late" },
      ] }, { handshake: { upgrade: "websocket", connectionTokens: ["Upgrade"], outcome: "accepted", status: 101, secWebSocketAccept: "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=", subprotocol: null, extensions: [] } }, "Gate-C3 WS output"),
    },
    {
      name: "MQTT output follows rejected CONNACK",
      violations: () => mqttConnectionTimelineViolations({ timeline: [
        { kind: "native", name: "dispatch", facts: { packetType: "CONNECT", clientId: "client", cleanSession: true, keepAlive: 0, usernamePresent: false, passwordPresent: false } },
        { kind: "native", name: "connection-closed", facts: { origin: "peer", packetType: "CONNACK", returnCode: 5, sessionPresent: false } },
        { kind: "output", index: 0, value: "late" },
      ] }, { protocolVersion: "3.1.1", connection: { accepted: false } }, {}, "Gate-C3 MQTT rejected"),
    },
    {
      name: "MQTT 5 client moves zero session expiry to nonzero on DISCONNECT",
      violations: () => mqttConnectionTimelineViolations({ timeline: [
        { kind: "native", name: "dispatch", facts: { packetType: "CONNECT", clientId: "client", cleanStart: true, keepAlive: 0, usernamePresent: false, passwordPresent: false, properties: [{ name: "session-expiry-interval", value: 0 }] } },
        { kind: "native", name: "connection-opened", facts: { reasonCode: 0, sessionPresent: false, properties: [] } },
        { kind: "native", name: "dispatch", facts: { packetType: "DISCONNECT", reasonCode: 0, properties: [{ name: "session-expiry-interval", value: 10 }] } },
        { kind: "native", name: "connection-closed", facts: { origin: "local", cause: "client-disconnect" } },
      ] }, { protocolVersion: "5.0", connection: { accepted: true } }, {}, "Gate-C3 MQTT expiry"),
    },
    {
      name: "MQTT 5 CONNACK authentication method was not requested",
      violations: () => mqttConnectionTimelineViolations({ timeline: [
        { kind: "native", name: "dispatch", facts: { packetType: "CONNECT", clientId: "client", cleanStart: true, keepAlive: 0, usernamePresent: false, passwordPresent: false, properties: [] } },
        { kind: "native", name: "connection-opened", facts: { reasonCode: 0, sessionPresent: false, properties: [{ name: "authentication-method", value: "token" }] } },
      ] }, { protocolVersion: "5.0", connection: { accepted: true } }, {}, "Gate-C3 MQTT auth"),
    },
    {
      name: "MQTT 5 Response Information was not requested",
      violations: () => mqttConnectionTimelineViolations({ timeline: [
        { kind: "native", name: "dispatch", facts: { packetType: "CONNECT", clientId: "client", cleanStart: true, keepAlive: 0, usernamePresent: false, passwordPresent: false, properties: [] } },
        { kind: "native", name: "connection-opened", facts: { reasonCode: 0, sessionPresent: false, properties: [{ name: "response-information", value: "reply" }] } },
      ] }, { protocolVersion: "5.0", connection: { accepted: true } }, {}, "Gate-C3 MQTT response information"),
    },
  ];
  for (const mutation of gateC3TimelineMutations) {
    if (mutation.violations().length === 0)
      errors.push(`Gate-C3 counterexample accepted: ${mutation.name}`);
  }
  const headerDigestA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const headerDigestB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const gateC3HeaderConfiguration = { websocketHeaders: [{ name: "X-Trace", valueSha256: headerDigestA }] };
  const gateC3HeaderTimeline = (headers) => ({ timeline: [
    { kind: "native", name: "dispatch", facts: { frameType: "opening-request", headers, method: "GET", target: "/", host: "example.test", connection: "Upgrade", upgrade: "websocket", secWebSocketKey: "dGhlIHNhbXBsZSBub25jZQ==", secWebSocketVersion: "13", subprotocols: [], extensions: [], authorizationSha256: null, apiKeyHeaders: [] } },
    { kind: "native", name: "connection-opened", facts: { status: 101, upgrade: "websocket", connectionTokens: ["Upgrade"], secWebSocketAccept: "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=", subprotocol: null, extensions: [] } },
  ] });
  const gateC3HeaderScript = { handshake: { upgrade: "websocket", connectionTokens: ["Upgrade"], outcome: "accepted", status: 101, secWebSocketAccept: "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=", subprotocol: null, extensions: [] } };
  const validHeaderEvidence = websocketHandshakeTimelineViolations(
    gateC3HeaderTimeline([{ name: "X-Trace", valueSha256: headerDigestA }]),
    gateC3HeaderScript,
    "Gate-C3 ordinary header positive",
    gateC3HeaderConfiguration
  );
  if (validHeaderEvidence.length)
    errors.push(`Gate-C3 valid ordinary WebSocket header evidence rejected\n${validHeaderEvidence.join("\n")}`);
  for (const [name, headers] of [
    ["ordinary WebSocket header dropped", []],
    ["ordinary WebSocket header added", [{ name: "X-Trace", valueSha256: headerDigestA }, { name: "X-Extra", valueSha256: headerDigestB }]],
    ["ordinary WebSocket header digest changed", [{ name: "X-Trace", valueSha256: headerDigestB }]],
  ]) {
    if (websocketHandshakeTimelineViolations(
      gateC3HeaderTimeline(headers), gateC3HeaderScript, `Gate-C3 ${name}`, gateC3HeaderConfiguration
    ).length === 0) errors.push(`Gate-C3 counterexample accepted: ${name}`);
  }
  const gateC3WsDataMutations = [
    ["WebSocket data dispatch precedes connection-opened", { timeline: [
      { kind: "native", name: "dispatch", facts: { opcode: "binary", messageBase64: "AA==", fragmentCount: 1 } },
      ...gateC3HeaderTimeline([]).timeline,
    ] }],
    ["WebSocket text dispatch contains invalid UTF-8", { timeline: [
      ...gateC3HeaderTimeline([]).timeline,
      { kind: "native", name: "dispatch", facts: { opcode: "text", messageBase64: "/w==", fragmentCount: 1 } },
    ] }],
  ];
  for (const [name, expected] of gateC3WsDataMutations) {
    if (websocketHandshakeTimelineViolations(expected, gateC3HeaderScript, `Gate-C3 ${name}`).length === 0)
      errors.push(`Gate-C3 counterexample accepted: ${name}`);
  }
  const gateC3PacketFlowMutations = [
    {
      name: "MQTT stale PUBACK survives sessionPresent false",
      expected: { disposition: "complete", timeline: [
        { kind: "native", name: "dispatch", facts: { packetType: "PUBLISH", packetId: 7, topic: "orders", qos: 1, duplicate: false, retain: false, payloadBase64: "", properties: [] } },
        { kind: "native", name: "connection-closed", facts: { origin: "peer", packetType: "TRANSPORT-LOSS" } },
        { kind: "native", name: "reconnected", facts: { attempt: 1, sessionPresent: false, connect: { clientId: "client1", cleanStart: true, keepAlive: 0, usernamePresent: false, passwordPresent: false, properties: [] }, properties: [] } },
        { kind: "native", name: "acknowledgement", facts: { packetType: "PUBACK", packetId: 7, reasonCode: 0, properties: [] } },
      ] },
    },
    {
      name: "MQTT outbound PUBLISH carries server-only Subscription Identifier",
      expected: { disposition: "complete", timeline: [
        { kind: "native", name: "dispatch", facts: { packetType: "PUBLISH", packetId: null, topic: "orders", qos: 0, duplicate: false, retain: false, payloadBase64: "", properties: [{ name: "subscription-identifier", value: 1 }] } },
      ] },
    },
    {
      name: "MQTT PUBLISH Response Topic contains wildcard",
      expected: { disposition: "complete", timeline: [
        { kind: "native", name: "dispatch", facts: { packetType: "PUBLISH", packetId: null, topic: "orders", qos: 0, duplicate: false, retain: false, payloadBase64: "", properties: [{ name: "response-topic", value: "reply/+" }] } },
      ] },
    },
  ];
  for (const mutation of gateC3PacketFlowMutations) {
    if (mqttPacketFlowViolations(mutation.expected, mutation.name, "5.0").length === 0)
      errors.push(`Gate-C3 counterexample accepted: ${mutation.name}`);
  }
  const resumedRedelivery = { disposition: "complete", timeline: [
    { kind: "native", name: "delivery", facts: { packetType: "PUBLISH", packetId: 7, topic: "orders", qos: 1, duplicate: false, retain: false, payloadBase64: "", properties: [] } },
    { kind: "native", name: "connection-closed", facts: { origin: "peer", packetType: "TRANSPORT-LOSS" } },
    { kind: "native", name: "reconnected", facts: { attempt: 1, sessionPresent: true, connect: { clientId: "client1", cleanStart: false, keepAlive: 0, usernamePresent: false, passwordPresent: false, properties: [] }, properties: [] } },
    { kind: "native", name: "delivery", facts: { packetType: "PUBLISH", packetId: 7, topic: "orders", qos: 1, duplicate: true, retain: false, payloadBase64: "", properties: [] } },
    { kind: "native", name: "dispatch", facts: { packetType: "PUBACK", packetId: 7, reasonCode: 0, properties: [] } },
    { kind: "output", index: 0, value: "one" },
  ] };
  const resumedViolations = mqttPacketFlowViolations(resumedRedelivery, "Gate-C3 resumed redelivery", "5.0");
  if (resumedViolations.length)
    errors.push(`Gate-C3 valid resumed redelivery rejected\n${resumedViolations.join("\n")}`);
  const resumedWithoutDup = structuredClone(resumedRedelivery);
  resumedWithoutDup.timeline[3].facts.duplicate = false;
  if (mqttPacketFlowViolations(resumedWithoutDup, "Gate-C3 resumed redelivery without DUP", "5.0").length === 0)
    errors.push("Gate-C3 counterexample accepted: resumed MQTT redelivery omits DUP");
  const scenarioIds = new Set();
  const scenarioFailureNames = new Set();
  let validScenarioCount = 0;
  let invalidScenarioCount = 0;
  const wrapScenarioTrial = (trial) => {
    const revisionSix = trial.format === PROCESSOR_V6;
    return {
      format: trial.format,
      bindingSpec: revisionSix ? "openbindings.asyncapi-3.0@1" : "openbindings.asyncapi@1",
      family: revisionSix ? "asyncapi-3.0" : "asyncapi",
      description: "portable revision-6 scenario qualification wrapper",
      scenarios: [{
        id: revisionSix ? "ASYNC30-PS-99" : "ASYNC-PS-99",
        rules: [revisionSix ? "ASYNC30-P-1" : "ASYNC-P-1"],
        section: "1",
        description: "portable revision-6 scenario qualification wrapper",
        given: trial.given,
        expected: revisionSix
          ? trial.expected.map((expected) => ({ ...expected, rules: ["ASYNC30-P-1"] }))
          : trial.expected,
      }],
    };
  };
  for (const probe of probes.scenarioCases || []) {
    if (scenarioIds.has(probe.id)) errors.push(`harness probe duplicates scenario id '${probe.id}'`);
    scenarioIds.add(probe.id);
    validScenarioCount++;
    const validFixture = wrapScenarioTrial(probe.valid);
    const validShape = ajvOk(PROCESSOR_SCHEMA, validFixture);
    const validViolations = revisionSixProcessorViolations(validFixture, `${probe.id}.valid`);
    if (!validShape.ok || validViolations.length)
      errors.push(`${probe.id}: valid scenario trial rejected\n${validShape.out}${validViolations.join("\n")}`);
    for (const failure of probe.invalid || []) {
      invalidScenarioCount++;
      scenarioFailureNames.add(`${probe.id}:${failure.name}`);
      const invalidFixture = wrapScenarioTrial(failure);
      const invalidShape = ajvOk(PROCESSOR_SCHEMA, invalidFixture);
      const invalidViolations = revisionSixProcessorViolations(invalidFixture, `${probe.id}.${failure.name}`);
      if (invalidShape.ok && invalidViolations.length === 0)
        errors.push(`${probe.id}: invalid scenario trial accepted: ${failure.name}`);
    }
  }
  const requiredSemanticMatcherModes = [
    "form-json-field", "multipart-json-part", "query-json-parameter", "querystring-json",
    "json-lines", "json-sequence", "json-text", "json-base64-bytes",
  ];
  for (const mode of requiredSemanticMatcherModes) {
    if (!semanticMatcherModes.has(mode))
      errors.push(`processor-v6 harness has no matcher qualification for semanticEquals mode '${mode}'`);
  }
  for (const edition of ["oas-3.0", "oas-3.1", "oas-3.2"]) {
    if (!formMatcherEditions.has(edition))
      errors.push(`processor-v6 harness has no form-json-field matcher qualification for '${edition}'`);
  }
  if (matcherIds.size < 14 || failingMatcherCount < 29)
    errors.push(`processor-v6 harness must contain at least 14 matcher cases and 29 failing observations (found ${matcherIds.size}/${failingMatcherCount})`);
  if (peerIds.size < 5 || validPeerCount < 5 || invalidPeerCount < 11)
    errors.push(`processor-v6 harness must contain at least 5 protocol peer cases with 5 valid and 11 invalid scripts (found ${peerIds.size}/${validPeerCount}/${invalidPeerCount})`);
  if (scenarioIds.size < 16 || validScenarioCount < 16 || invalidScenarioCount < 23)
    errors.push(`processor-v6 harness must contain at least 16 scenario cases with 16 valid and 23 invalid trials (found ${scenarioIds.size}/${validScenarioCount}/${invalidScenarioCount})`);
  const requiredMatcherIds = [
    "V6-MATCH-01", "V6-MATCH-02", "V6-MATCH-03", "V6-MATCH-04",
    "V6-MATCH-05", "V6-MATCH-06", "V6-MATCH-07", "V6-MATCH-08",
    "V6-MATCH-15", "V6-MATCH-16", "V6-MATCH-17"
  ];
  for (const id of requiredMatcherIds) {
    if (!matcherIds.has(id)) errors.push(`processor-v6 harness is missing required matcher case '${id}'`);
  }
  const requiredPeerIds = ["HTTP", "WS", "KAFKA", "MQTT311", "MQTT5"];
  for (const token of requiredPeerIds) {
    if (![...peerIds].some((id) => id.includes(token)))
      errors.push(`processor-v6 harness has no ${token} peer qualification case`);
  }
  const validPeerScripts = (probes.peerCases || []).flatMap((probe) =>
    (probe.valid || []).map((script) => ({ dialect: probe.dialect, script }))
  );
  if (!validPeerScripts.some(({ dialect, script }) =>
    dialect === "openbindings.asyncapi-websocket-peer@1"
    && script?.handshake?.outcome === "accepted"
    && script.handshake.upgrade === "WebSocket"
    && jsonValueEqual(script.handshake.connectionTokens, ["keep-alive", "upgrade"])
  )) errors.push("processor-v6 harness has no raw-preserving ASCII-case-insensitive WebSocket Upgrade/Connection qualification");
  for (const error of [
    "wrong-accept", "unauthorized-subprotocol", "unauthorized-extension",
    "missing-upgrade", "wrong-upgrade", "missing-connection", "wrong-connection",
  ]) {
    if (!validPeerScripts.some(({ dialect, script }) =>
      dialect === "openbindings.asyncapi-websocket-peer@1"
      && script?.handshake?.outcome === "protocol-error"
      && script.handshake.error === error
    )) errors.push(`processor-v6 harness has no executable hostile WebSocket 101 '${error}' qualification`);
    const qualified = validPeerScripts.find(({ dialect, script }) =>
      dialect === "openbindings.asyncapi-websocket-peer@1"
      && script?.handshake?.outcome === "protocol-error"
      && script.handshake.error === error
    );
    if (qualified) {
      const mapped = implicitPeerNativeObservations(qualified.dialect, qualified.script);
      if (
        mapped.length !== 1
        || mapped[0]?.name !== "connection-closed"
        || mapped[0]?.facts?.reason !== `handshake-protocol-error:${error}`
      ) errors.push(`processor-v6 hostile WebSocket 101 '${error}' does not normalize to exact failure evidence`);
    }
  }
  for (const violation of [
    "unexpected-continuation", "fragmented-control", "invalid-utf8-text", "masked-server-frame"
  ]) {
    if (!validPeerScripts.some(({ dialect, script }) =>
      dialect === "openbindings.asyncapi-websocket-peer@1"
      && (script?.events || []).some((event) => event.kind === "invalid-frame" && event.violation === violation)
    )) errors.push(`processor-v6 harness has no executable hostile WebSocket frame '${violation}' qualification`);
  }
  if (!validPeerScripts.some(({ dialect, script }) =>
    dialect === "openbindings.asyncapi-websocket-peer@1"
    && (script?.events || []).some((event) => event.kind === "close" && event.code === 1010)
  )) errors.push("processor-v6 harness has no executable server-origin WebSocket Close 1010 violation qualification");
  if (!validPeerScripts.some(({ dialect, script }) =>
    dialect === "openbindings.asyncapi-mqtt-peer@1"
    && script?.protocolVersion === "5.0"
    && (script?.events || []).some((event) => event.kind === "disconnect" && event.reasonCode === 161)
  )) errors.push("processor-v6 harness has no MQTT 5 peer DISCONNECT reason 161 qualification");
  const requiredScenarioTokens = [
    "ACTION-ORDER", "ACTION-BIJECTION", "HTTP-MAPPING", "WS-MAPPING", "KAFKA-MAPPING",
    "MQTT5-MAPPING", "TRIGGER-ORDER", "MQTT311-NATIVE", "MQTT311-QOS2",
    "MQTT311-ID-CAUSALITY", "MQTT311-QOS1-ID", "MQTT311-INBOUND-QOS2",
    "MQTT311-SUBSCRIPTION-ID", "MQTT5-NEGATIVE-PUBREC", "MQTT5-SUBSCRIPTION-RESULT",
    "CROSS-TRIGGER-ORDER", "HTTP-DISCONNECT-CHRONOLOGY",
    "MQTT311-EXACT-SUBACK", "MQTT5-EXACT-SUBACK", "MQTT311-QOS2-DUP",
    "MQTT311-PRESUBACK", "MQTT311-PRESUBACK-DRAIN", "MQTT311-LOWER-SUBACK",
    "MQTT311-BUFFER-LIMIT", "MQTT311-BUFFER-PREFIX", "MQTT311-QOS2-DUP-BEFORE-PUBREC",
    "WS-HANDSHAKE-CLOSE", "WS-CANCEL", "WS-HOSTILE-101", "WS-HOSTILE-FRAME",
    "MQTT311-CONNECTION", "MQTT5-CONNECTION", "MQTT-CANCEL", "MQTT311-CANCEL",
    "MQTT311-SESSION", "MQTT311-EMPTY-CLIENT-ID", "MQTT5-SESSION",
    "MQTT5-ASSIGNED-CLIENT-ID", "MQTT-PRECONNACK-LOCAL-CLOSE",
    "FORMAT-ISOLATION", "NUMERIC-INPUT", "NUMERIC-EXPECTATION"
  ];
  for (const token of requiredScenarioTokens) {
    if (![...scenarioIds].some((id) => id.includes(token)))
      errors.push(`processor-v6 harness has no ${token} scenario qualification case`);
  }
  const requiredMatcherFailures = [
    "V6-MATCH-15:OAS 3.0 rejects literal reserved slash",
    "V6-MATCH-15:OAS 3.0 rejects OAS 3.2 star tilde spelling",
    "V6-MATCH-16:OAS 3.1 rejects literal reserved slash",
    "V6-MATCH-16:OAS 3.1 rejects OAS 3.2 literal star",
    "V6-MATCH-17:OAS 3.2 rejects literal reserved slash",
    "V6-MATCH-17:OAS 3.2 rejects OAS 3.0 literal tilde",
  ];
  for (const name of requiredMatcherFailures) {
    if (!matcherFailureNames.has(name)) errors.push(`processor-v6 harness is missing matcher mutation '${name}'`);
  }
  const requiredPeerFailures = [
    "V6-PEER-HTTP-01:interim 101 is not a terminal response",
    "V6-PEER-WS-01:reserved no-status Close code",
    "V6-PEER-WS-01:unallocated protocol Close code",
    "V6-PEER-WS-01:Close reason exceeds 123 UTF-8 octets",
    "V6-PEER-WS-01:message follows clean Close",
    "V6-PEER-WS-01:message follows rejected handshake",
    "V6-PEER-WS-01:message follows protocol-error handshake",
    "V6-PEER-WS-01:invalid UTF-8 label has valid text bytes",
    "V6-PEER-MQTT311-01:PUBLISH follows rejected CONNACK",
    "V6-PEER-MQTT311-01:reconnect attempts decrease without lifecycle reset",
    "V6-PEER-MQTT311-01:PUBLISH topic contains MQTT control",
    "V6-PEER-MQTT5-01:peer DISCONNECT uses client-only reason 4",
    "V6-PEER-MQTT5-01:peer DISCONNECT Server Reference uses wrong reason",
    "V6-PEER-MQTT5-01:PUBLISH topic contains MQTT noncharacter",
  ];
  for (const name of requiredPeerFailures) {
    if (!peerFailureNames.has(name)) errors.push(`processor-v6 harness is missing peer mutation '${name}'`);
  }
  const requiredScenarioFailures = [
    "V6-SCENARIO-MQTT311-EXACT-SUBACK-01:MQTT 3.1.1 SUBACK grant exceeds requested QoS",
    "V6-SCENARIO-MQTT5-EXACT-SUBACK-01:MQTT 5 SUBACK grant exceeds requested QoS",
    "V6-SCENARIO-MQTT311-QOS2-DUP-01:QoS 2 retransmission keeps DUP zero",
    "V6-SCENARIO-MQTT311-QOS2-DUP-01:QoS 2 retransmission changes staged facts",
    "V6-SCENARIO-MQTT311-QOS2-DUP-01:QoS 2 retransmission omits repeated PUBREC",
    "V6-SCENARIO-MQTT311-QOS2-DUP-01:QoS 2 retransmission duplicates operation output",
    "V6-SCENARIO-MQTT311-PRESUBACK-01:pre-SUBACK publication emits output early",
    "V6-SCENARIO-MQTT311-PRESUBACK-01:downgraded SUBACK leaks a higher-QoS buffered publication",
    "V6-SCENARIO-MQTT311-PRESUBACK-01:stored pre-SUBACK topic failure is emitted out of order",
    "V6-SCENARIO-MQTT311-PRESUBACK-01:buffer exhaustion fails before acknowledging the received PUBLISH",
    "V6-SCENARIO-WS-HANDSHAKE-CLOSE-01:Sec-WebSocket-Accept is not derived from dispatched key",
    "V6-SCENARIO-WS-HANDSHAKE-CLOSE-01:local WebSocket closure omits client Close dispatch",
    "V6-SCENARIO-WS-HANDSHAKE-CLOSE-01:ordinary WebSocket header is dropped",
    "V6-SCENARIO-WS-HANDSHAKE-CLOSE-01:ordinary WebSocket header digest is wrong",
    "V6-SCENARIO-WS-HANDSHAKE-CLOSE-01:ordinary WebSocket header is added",
    "V6-SCENARIO-WS-HOSTILE-101-01:hostile 101 is normalized as connection-opened",
    "V6-SCENARIO-WS-HOSTILE-101-01:opening request omits Host evidence",
    "V6-SCENARIO-WS-HOSTILE-FRAME-01:invalid continuation frame is emitted as a message",
    "V6-SCENARIO-MQTT311-LOWER-SUBACK-01:lower SUBACK silently completes",
    "V6-SCENARIO-MQTT311-LOWER-SUBACK-01:lower SUBACK leaks buffered QoS 0 output",
    "V6-SCENARIO-MQTT311-PRESUBACK-DRAIN-01:stored wildcard failure silently completes",
    "V6-SCENARIO-MQTT311-PRESUBACK-DRAIN-01:output after first stored failure",
    "V6-SCENARIO-MQTT311-BUFFER-LIMIT-01:negative pre-SUBACK buffer limit",
    "V6-SCENARIO-MQTT311-BUFFER-PREFIX-01:buffer prefix output occurs before exact SUBACK",
    "V6-SCENARIO-MQTT311-BUFFER-PREFIX-01:buffer exhaustion suppresses admitted prefix",
    "V6-SCENARIO-MQTT311-BUFFER-PREFIX-01:revision 6 runtime accepts misspelled buffer limit",
    "V6-SCENARIO-MQTT311-QOS2-DUP-BEFORE-PUBREC-01:before-first-PUBREC retransmission keeps DUP zero",
    "V6-SCENARIO-MQTT311-QOS2-DUP-BEFORE-PUBREC-01:before-first-PUBREC retransmission changes facts",
    "V6-SCENARIO-MQTT311-QOS2-DUP-BEFORE-PUBREC-01:before-first-PUBREC retransmission omits repeated PUBREC",
    "V6-SCENARIO-MQTT311-CONNECTION-01:MQTT password present without username",
    "V6-SCENARIO-MQTT311-CONNECTION-01:MQTT CONNECT username digest is wrong",
    "V6-SCENARIO-MQTT5-CONNECTION-01:MQTT 5 password present without username",
    "V6-SCENARIO-MQTT311-SESSION-01:MQTT 3.1.1 clean session claims resumed CONNACK",
    "V6-SCENARIO-MQTT5-SESSION-01:MQTT 5 clean start claims resumed CONNACK",
    "V6-SCENARIO-MQTT5-SESSION-01:MQTT 5 CONNACK repeats Session Expiry Interval",
    "V6-SCENARIO-MQTT5-SESSION-01:MQTT 5 Client ID contains forbidden control",
    "V6-SCENARIO-MQTT5-ASSIGNED-CLIENT-ID-01:MQTT 5 empty Client ID lacks assigned identifier",
    "V6-SCENARIO-MQTT5-ASSIGNED-CLIENT-ID-01:MQTT 5 assigned identifier returned for nonempty Client ID",
    "V6-SCENARIO-MQTT311-EXACT-SUBACK-01:MQTT topic filter contains forbidden control",
    "V6-SCENARIO-WS-HOSTILE-101-01:opening Host contains CRLF",
    "V6-SCENARIO-WS-HOSTILE-101-01:opening API key header name contains CRLF",
    "V6-SCENARIO-MQTT-PRECONNACK-LOCAL-CLOSE-01:client DISCONNECT sent before CONNACK",
  ];
  for (const name of requiredScenarioFailures) {
    if (!scenarioFailureNames.has(name)) errors.push(`processor-v6 harness is missing scenario mutation '${name}'`);
  }

  const processorProbe = {
    format: PROCESSOR_V7,
    bindingSpec: "openbindings.asyncapi-3.1@1",
    family: "asyncapi-3.1",
    description: "verifier probe; not part of the corpus",
    scenarios: [{
      id: "ASYNC31-PS-99",
      rules: ["ASYNC31-P-1"],
      section: "1",
      description: "verifier probe; not part of the corpus",
      given: {
        source: {}, binding: {},
        invocation: { inputPresent: false, actions: [{ kind: "write", value: "one" }, { kind: "half-close" }] },
        peer: { dialect: "openbindings.asyncapi-kafka-peer@1", script: { events: [] } }
      },
      expected: [{
        disposition: "complete", phase: "completion",
        rules: ["ASYNC31-P-1"],
        timeline: [
          { kind: "input-accepted", index: 0 },
          { kind: "native", name: "input-half-closed", facts: {} }
        ],
        assertions: []
      }]
    }]
  };
  const processorShape = ajvOk(PROCESSOR_SCHEMA, processorProbe);
  if (!processorShape.ok)
    errors.push(`processor-scenario.schema.json rejects the valid revision-6 verifier probe\n${processorShape.out}`);
  const processorViolations = revisionSixProcessorViolations(processorProbe, "processor-v6 schema probe");
  if (processorViolations.length)
    errors.push(`valid revision-6 processor probe has semantic violations:\n${processorViolations.join("\n")}`);
  const processorResourceProbe = structuredClone(processorProbe);
  processorResourceProbe.scenarios[0].given.resources = { "https://example.test/text": "ok" };
  processorResourceProbe.scenarios[0].given.resourceBytes = {
    "https://example.test/bytes": { format: "openbindings.resource-bytes@1", dataBase64: "AA==" },
  };
  if (!ajvOk(PROCESSOR_SCHEMA, processorResourceProbe).ok || revisionSixProcessorViolations(processorResourceProbe, "processor resource carrier probe").length)
    errors.push("revision-6 processor resource carrier rejects disjoint parsed/text and exact-byte maps");
  const overlappingProcessorResources = structuredClone(processorResourceProbe);
  overlappingProcessorResources.scenarios[0].given.resourceBytes["https://example.test/text"] = {
    format: "openbindings.resource-bytes@1", dataBase64: "AA==",
  };
  if (revisionSixProcessorViolations(overlappingProcessorResources, "overlapping processor resources probe").length === 0)
    errors.push("revision-6 processor resource carrier accepts one URI in both resources and resourceBytes");
  const noncanonicalProcessorBytes = structuredClone(processorResourceProbe);
  noncanonicalProcessorBytes.scenarios[0].given.resourceBytes["https://example.test/bytes"].dataBase64 = "AB==";
  if (revisionSixProcessorViolations(noncanonicalProcessorBytes, "noncanonical processor bytes probe").length === 0)
    errors.push("revision-6 processor resource carrier accepts noncanonical Base64 octets");
  const badSchedule = structuredClone(processorProbe);
  badSchedule.scenarios[0].given.invocation.actions.push({ kind: "write", value: "two" });
  if (revisionSixProcessorViolations(badSchedule, "bad schedule probe").length === 0)
    errors.push("revision-6 temporal verifier accepts a write after input half-close");
  const unreachableBarrier = structuredClone(processorProbe);
  unreachableBarrier.scenarios[0].given.invocation.actions = [{ kind: "await-output", count: 1 }];
  if (revisionSixProcessorViolations(unreachableBarrier, "unreachable barrier probe").length === 0)
    errors.push("revision-6 temporal verifier accepts an unreachable await-output barrier");
  const legacyWithV6 = structuredClone(processorProbe);
  legacyWithV6.format = "openbindings.binding-spec-processor-scenarios@1";
  legacyWithV6.bindingSpec = "openbindings.asyncapi@1";
  legacyWithV6.family = "asyncapi";
  legacyWithV6.scenarios[0].id = "ASYNC-PS-99";
  legacyWithV6.scenarios[0].rules = ["ASYNC-P-1"];
  if (ajvOk(PROCESSOR_SCHEMA, legacyWithV6).ok)
    errors.push("processor-scenario.schema.json accepts revision-6 vocabulary under format @1");
  const legacyWithResourceBytes = structuredClone(legacyWithV6);
  legacyWithResourceBytes.scenarios[0].given.resourceBytes = {
    "https://example.test/bytes": { format: "openbindings.resource-bytes@1", dataBase64: "AA==" },
  };
  if (ajvOk(PROCESSOR_SCHEMA, legacyWithResourceBytes).ok)
    errors.push("processor-scenario.schema.json accepts resourceBytes under format @1");
  const legacyResourceOnly = {
    format: "openbindings.binding-spec-processor-scenarios@1",
    bindingSpec: "openbindings.asyncapi@1",
    family: "asyncapi",
    description: "verifier probe; not part of the corpus",
    scenarios: [{
      id: "ASYNC-PS-99", rules: ["ASYNC-P-1"], section: "1",
      description: "verifier probe; not part of the corpus",
      given: {
        source: {}, binding: {}, invocation: { inputPresent: false },
        resourceBytes: { "https://example.test/bytes": { format: "openbindings.resource-bytes@1", dataBase64: "AA==" } },
      },
      expected: [{ disposition: "refusal", phase: "load", assertions: [] }],
    }],
  };
  if (ajvOk(PROCESSOR_SCHEMA, legacyResourceOnly).ok)
    errors.push("processor-scenario.schema.json admits resourceBytes as the only revision-6 vocabulary under format @1");
  const missingExpectedOwner = structuredClone(processorProbe);
  delete missingExpectedOwner.scenarios[0].expected[0].rules;
  if (ajvOk(PROCESSOR_SCHEMA, missingExpectedOwner).ok || revisionSixProcessorViolations(missingExpectedOwner, "missing processor owner probe").length === 0)
    errors.push("revision-6 processor evidence accepts an expected alternative without atomic rule owners");
  const gratuitousProcessorCitation = structuredClone(processorProbe);
  gratuitousProcessorCitation.scenarios[0].rules.push("ASYNC31-P-2");
  if (revisionSixProcessorViolations(gratuitousProcessorCitation, "gratuitous processor citation probe").length === 0)
    errors.push("revision-6 processor evidence accepts a gratuitous scenario P-rule citation");
  const async31Definitions = familyRuleDefinitions["asyncapi-3.1"];
  const wrongSectionProbe = { rules: ["ASYNC31-P-01"], section: "4" };
  if (citedRuleSectionViolations(wrongSectionProbe, async31Definitions, "wrong section probe").length === 0)
    errors.push("AsyncAPI 3.1 rule ownership accepts evidence in the wrong specification section");
  const async31Spec = specTexts["asyncapi-3.1"];
  const deletedRuleSpec = async31Spec.replace(
    /^\*\*\[convention\]\*\* \*\*ASYNC31-P-07\*\* —[^\n]*(?:\n(?!\n)[^\n]*)*/m,
    ""
  );
  if (!async31RuleDefinitionAnalysis(deletedRuleSpec, "deleted rule probe").violations.some((entry) => entry.includes("ASYNC31-P-07")))
    errors.push("AsyncAPI 3.1 anchored-rule verifier accepts a deleted normative rule definition");

  const synthesisProbe = {
    format: SYNTHESIS_V7,
    bindingSpec: "openbindings.asyncapi-3.1@1",
    family: "asyncapi-3.1",
    description: "verifier probe; not part of the corpus",
    scenarios: [
      {
        id: "ASYNC31-SS-99",
        rules: ["ASYNC31-S-1"],
        section: "1",
        description: "verifier probe; not part of the corpus",
        source: { bindingSpec: "openbindings.asyncapi-3.1@1", content: {} },
        expected: {
          outcome: "synthesized",
          operations: ["op"],
          bindings: [{ operationKey: "op", bindingSelector: "#/servers/s/operations/op" }],
          assertions: [{ rule: "ASYNC31-S-1", path: "/operations/op", equals: {} }],
          coverage: {
            exhaustive: true,
            fullyRepresented: true,
            entries: [
              {
                sourceIndex: 0,
                sourceRef: "#/servers/s/operations/op",
                scope: "protocol-cell",
                status: "represented",
                operationKey: "op",
                bindingSelector: "#/servers/s/operations/op",
                rule: "ASYNC31-S-1",
                requirements: [],
              },
            ],
          },
        },
      },
    ],
  };
  const synthesisShape = ajvOk(SYNTHESIS_SCHEMA, synthesisProbe);
  if (!synthesisShape.ok)
    errors.push(`synthesis-scenario.schema.json rejects the valid revision-6 verifier probe\n${synthesisShape.out}`);
  if (revisionSixSynthesisViolations(synthesisProbe, "synthesis revision-6 verifier probe").length)
    errors.push("revision-6 synthesis verifier rejects the valid uniqueness probe");
  const synthesisResourceProbe = structuredClone(synthesisProbe);
  synthesisResourceProbe.scenarios[0].resources = { "https://example.test/text": "ok" };
  synthesisResourceProbe.scenarios[0].resourceBytes = {
    "https://example.test/bytes": { format: "openbindings.resource-bytes@1", dataBase64: "AA==" },
  };
  if (!ajvOk(SYNTHESIS_SCHEMA, synthesisResourceProbe).ok || revisionSixSynthesisViolations(synthesisResourceProbe, "synthesis resource carrier probe").length)
    errors.push("revision-6 synthesis resource carrier rejects disjoint parsed/text and exact-byte maps");
  const overlappingSynthesisResources = structuredClone(synthesisResourceProbe);
  overlappingSynthesisResources.scenarios[0].resourceBytes["https://example.test/text"] = {
    format: "openbindings.resource-bytes@1", dataBase64: "AA==",
  };
  if (revisionSixSynthesisViolations(overlappingSynthesisResources, "overlapping synthesis resources probe").length === 0)
    errors.push("revision-6 synthesis resource carrier accepts one URI in both resources and resourceBytes");
  const legacySynthesisResourceOnly = {
    format: "openbindings.binding-spec-synthesis-scenarios@4",
    bindingSpec: "openbindings.asyncapi@1",
    family: "asyncapi",
    description: "verifier probe; not part of the corpus",
    scenarios: [{
      id: "ASYNC-SS-99",
      description: "verifier probe; not part of the corpus",
      source: { bindingSpec: "openbindings.asyncapi@1", content: {} },
      resourceBytes: { "https://example.test/bytes": { format: "openbindings.resource-bytes@1", dataBase64: "AA==" } },
      expected: { outcome: "refused", rules: ["ASYNC-P-1"] },
    }],
  };
  if (ajvOk(SYNTHESIS_SCHEMA, legacySynthesisResourceOnly).ok)
    errors.push("synthesis-scenario.schema.json admits resourceBytes as the only revision-6 vocabulary under format @4");

  const noScenarioRules = structuredClone(synthesisProbe);
  delete noScenarioRules.scenarios[0].rules;
  if (ajvOk(SYNTHESIS_SCHEMA, noScenarioRules).ok)
    errors.push("synthesis-scenario.schema.json accepts revision 6 without scenario rule citations");
  const noEntryRule = structuredClone(synthesisProbe);
  delete noEntryRule.scenarios[0].expected.coverage.entries[0].rule;
  if (ajvOk(SYNTHESIS_SCHEMA, noEntryRule).ok)
    errors.push("synthesis-scenario.schema.json accepts revision-6 coverage without an owner rule");
  const noAssertionRule = structuredClone(synthesisProbe);
  delete noAssertionRule.scenarios[0].expected.assertions[0].rule;
  if (ajvOk(SYNTHESIS_SCHEMA, noAssertionRule).ok || revisionSixSynthesisViolations(noAssertionRule, "unowned assertion probe").length === 0)
    errors.push("revision-6 synthesis accepts an assertion without an owner rule");
  const extraScenarioCitation = structuredClone(synthesisProbe);
  extraScenarioCitation.scenarios[0].rules.push("ASYNC31-S-2");
  if (revisionSixSynthesisViolations(extraScenarioCitation, "extra synthesis citation probe").length === 0)
    errors.push("revision-6 synthesis verifier accepts a scenario citation with no owned evidence");
  const missingScenarioCitation = structuredClone(synthesisProbe);
  missingScenarioCitation.scenarios[0].rules = ["ASYNC31-S-2"];
  if (revisionSixSynthesisViolations(missingScenarioCitation, "missing synthesis citation probe").length === 0)
    errors.push("revision-6 synthesis verifier accepts owned evidence without its scenario citation");
  const refusedProbe = structuredClone(synthesisProbe);
  refusedProbe.scenarios[0].expected = { outcome: "refused", rules: ["ASYNC31-S-1"] };
  if (revisionSixSynthesisViolations(refusedProbe, "valid refused synthesis probe").length)
    errors.push("revision-6 synthesis verifier rejects aligned refused-source rule evidence");
  const refusedMismatch = structuredClone(refusedProbe);
  refusedMismatch.scenarios[0].expected.rules = ["ASYNC31-S-2"];
  if (revisionSixSynthesisViolations(refusedMismatch, "refused synthesis mismatch probe").length === 0)
    errors.push("revision-6 synthesis verifier accepts refused-source evidence owned by an uncited rule");
  const multiRuleProbe = structuredClone(synthesisProbe);
  multiRuleProbe.scenarios[0].rules.push("ASYNC31-S-2");
  multiRuleProbe.scenarios[0].expected.coverage.entries.push({
    sourceIndex: 1,
    sourceRef: "#/servers/s/operations/op/messages/m",
    scope: "message-alternative",
    status: "excluded",
    operationKey: "op",
    bindingSelector: "#/servers/s/operations/op",
    rule: "ASYNC31-S-2",
    requirements: [],
  });
  if (revisionSixSynthesisViolations(multiRuleProbe, "valid multi-rule synthesis probe").length)
    errors.push("revision-6 synthesis verifier rejects a valid multi-rule evidence union");
  const duplicateBinding = structuredClone(synthesisProbe);
  duplicateBinding.scenarios[0].expected.bindings.push(
    structuredClone(duplicateBinding.scenarios[0].expected.bindings[0])
  );
  if (revisionSixSynthesisViolations(duplicateBinding, "duplicate binding probe").length === 0)
    errors.push("revision-6 synthesis verifier accepts a duplicate binding identity");
  const duplicateCoverage = structuredClone(synthesisProbe);
  duplicateCoverage.scenarios[0].expected.coverage.entries.push({
    ...structuredClone(duplicateCoverage.scenarios[0].expected.coverage.entries[0]),
    status: "excluded",
  });
  if (revisionSixSynthesisViolations(duplicateCoverage, "duplicate coverage probe").length === 0)
    errors.push("revision-6 synthesis verifier accepts a duplicate semantic coverage identity");
  const ghostBinding = structuredClone(synthesisProbe);
  ghostBinding.scenarios[0].expected.operations.push("ghost");
  ghostBinding.scenarios[0].expected.bindings.push({ operationKey: "ghost", bindingSelector: "#/servers/s/operations/ghost" });
  if (revisionSixSynthesisViolations(ghostBinding, "ghost binding probe").length === 0)
    errors.push("revision-6 synthesis verifier accepts an expected binding without represented coverage");
  const ghostOperation = structuredClone(synthesisProbe);
  ghostOperation.scenarios[0].expected.operations.push("ghost");
  if (revisionSixSynthesisViolations(ghostOperation, "ghost operation probe").length === 0)
    errors.push("revision-6 synthesis verifier accepts an expected operation without represented coverage");
  const assertionOwnerMismatch = structuredClone(synthesisProbe);
  assertionOwnerMismatch.scenarios[0].expected.assertions[0].rule = "ASYNC31-S-2";
  if (revisionSixSynthesisViolations(assertionOwnerMismatch, "assertion owner mismatch probe").length === 0)
    errors.push("revision-6 synthesis verifier accepts assertion evidence owned by an uncited rule");
  const exactInventoryProbe = structuredClone(multiRuleProbe);
  const exactInventory = revisionSixCoverageInventory(exactInventoryProbe.scenarios[0].expected.coverage.entries);
  exactInventoryProbe.scenarios[0].expected.assertions[0] = {
    rule: "ASYNC31-S-1",
    surface: "coverage-inventory",
    path: "/",
    setEquals: [...exactInventory].reverse(),
  };
  if (!ajvOk(SYNTHESIS_SCHEMA, exactInventoryProbe).ok || revisionSixSynthesisViolations(exactInventoryProbe, "exact inventory probe").length)
    errors.push("revision-6 synthesis verifier rejects an exact reordered coverage-inventory identity set");
  const wrongInventoryProbe = structuredClone(exactInventoryProbe);
  wrongInventoryProbe.scenarios[0].expected.assertions[0].setEquals = [];
  if (revisionSixSynthesisViolations(wrongInventoryProbe, "wrong inventory probe").length === 0)
    errors.push("revision-6 synthesis verifier accepts an inexact coverage-inventory assertion");
  const orderedInventoryProbe = structuredClone(exactInventoryProbe);
  const orderedAssertion = orderedInventoryProbe.scenarios[0].expected.assertions[0];
  orderedAssertion.equals = orderedAssertion.setEquals;
  delete orderedAssertion.setEquals;
  if (ajvOk(SYNTHESIS_SCHEMA, orderedInventoryProbe).ok)
    errors.push("synthesis-scenario.schema.json accepts ordered equals for a revision-6 coverage-inventory assertion");

  const legacyScope = structuredClone(synthesisProbe);
  legacyScope.format = "openbindings.binding-spec-synthesis-scenarios@4";
  legacyScope.bindingSpec = "openbindings.asyncapi@1";
  legacyScope.family = "asyncapi";
  legacyScope.scenarios[0].id = "ASYNC-SS-99";
  legacyScope.scenarios[0].source.bindingSpec = "openbindings.asyncapi@1";
  delete legacyScope.scenarios[0].rules;
  delete legacyScope.scenarios[0].section;
  delete legacyScope.scenarios[0].expected.coverage.entries[0].rule;
  delete legacyScope.scenarios[0].expected.assertions[0].rule;
  if (ajvOk(SYNTHESIS_SCHEMA, legacyScope).ok)
    errors.push("synthesis-scenario.schema.json accepts revision-6 protocol-cell scope under format @4");
  const revisionSixLegacyScope = structuredClone(synthesisProbe);
  revisionSixLegacyScope.scenarios[0].expected.coverage.entries[0].scope = "alternative";
  if (ajvOk(SYNTHESIS_SCHEMA, revisionSixLegacyScope).ok)
    errors.push("synthesis-scenario.schema.json accepts legacy alternative scope under format @6");
}

// --- 14. Revision-7 / HTTP revision-2 scaffold is closed and isolated -------
// C20A qualifies only the apparatus vocabulary and its version boundaries. The
// protocol semantics, certificate path validation, and full HTTP trial matrix
// remain deliberately absent until the normative AsyncAPI HTTP slice lands.
{
  let probes;
  try {
    const probeText = readFileSync(PROCESSOR_V7_PROBES, "utf8");
    const lossless = parseLosslessJson(probeText);
    if (!lossless.ok) throw new Error(`lossless JSON validation failed: ${lossless.error}`);
    probes = JSON.parse(probeText);
  } catch (error) {
    errors.push(`harness-probes/processor-v7.json: failed to parse: ${error.message}`);
    probes = { cases: [] };
  }
  const probeShape = ajvOk(PROCESSOR_V7_PROBE_SCHEMA, probes);
  if (!probeShape.ok)
    errors.push(`harness-probes/processor-v7.json: does not match its schema\n${probeShape.out}`);

  for (const [path, expectedSha256] of PROCESSOR_V7_SCAFFOLD_SHA256) {
    if (!existsSync(path)) {
      errors.push(`${relative(CORPUS, path)}: missing required C20A scaffold artifact`);
      continue;
    }
    const actualSha256 = fileSha256(path);
    if (actualSha256 !== expectedSha256)
      errors.push(`${relative(CORPUS, path)}: C20A scaffold hash ${actualSha256} is not trust-anchored ${expectedSha256}`);
  }

  const scaffoldIntegrityViolations = (artifact, at) => {
    const violations = [];
    if (sortedJsonSha256(artifact) !== PROCESSOR_V7_PROBE_ROOT_SHA256)
      violations.push(`${at}: canonical scaffold root does not match the verifier-owned trust anchor`);
    const ids = new Set();
    for (const [index, entry] of (artifact?.cases || []).entries()) {
      if (ids.has(entry.id)) violations.push(`${at}.cases[${index}]: duplicate case id '${entry.id}'`);
      ids.add(entry.id);
    }
    if (ids.size !== PROCESSOR_V7_EXPECTED_CASE_IDS.size)
      violations.push(`${at}: exact case count is ${ids.size}, expected ${PROCESSOR_V7_EXPECTED_CASE_IDS.size}`);
    for (const id of PROCESSOR_V7_EXPECTED_CASE_IDS) {
      if (!ids.has(id)) violations.push(`${at}: required case id '${id}' is missing`);
    }
    for (const id of ids) {
      if (!PROCESSOR_V7_EXPECTED_CASE_IDS.has(id)) violations.push(`${at}: unexpected case id '${id}'`);
    }
    return violations;
  };
  errors.push(...scaffoldIntegrityViolations(probes, "harness-probes/processor-v7"));

  const scaffoldCaseViolations = (entry, at) => {
    if (entry.validator === "http-peer@2") return httpPeerV2Violations(entry.subject, at);
    if (entry.validator === "http-native@2") {
      const shape = ajvOk(HTTP_NATIVE_V2_SCHEMA, entry.subject);
      return shape.ok
        ? base64Violations(entry.subject, at)
        : [`${at}: does not match ${basename(HTTP_NATIVE_V2_SCHEMA)}\n${shape.out}`];
    }
    if (entry.validator === "http-runtime@2") {
      const shape = ajvOk(HTTP_RUNTIME_V2_SCHEMA, entry.subject);
      return shape.ok
        ? base64Violations(entry.subject, at)
        : [`${at}: does not match ${basename(HTTP_RUNTIME_V2_SCHEMA)}\n${shape.out}`];
    }
    if (entry.validator === "processor-scenario") {
      const shape = ajvOk(PROCESSOR_SCHEMA, entry.subject);
      return [
        ...(shape.ok ? [] : [`${at}: processor scenario schema rejected subject\n${shape.out}`]),
        ...processorApparatusVersionViolations(entry.subject, at),
        ...revisionSixProcessorViolations(entry.subject, at),
      ];
    }
    if (entry.validator === "synthesis-scenario") {
      const shape = ajvOk(SYNTHESIS_SCHEMA, entry.subject);
      return [
        ...(shape.ok ? [] : [`${at}: synthesis scenario schema rejected subject\n${shape.out}`]),
        ...synthesisApparatusVersionViolations(entry.subject, at),
        ...revisionSixSynthesisViolations(entry.subject, at),
      ];
    }
    if (entry.validator === "dialect-correlation") {
      return entry.subject?.peerDialect === "openbindings.asyncapi-http-peer@2"
        && entry.subject?.nativeDialect === "openbindings.asyncapi-http-native@2"
        ? []
        : [`${at}: HTTP peer/native dialect revisions do not correlate`];
    }
    if (entry.validator === "http-peer-mapper@2") {
      const mapped = httpPeerV2MappedObservation(entry.subject?.script?.events || [], {
        authority: "example.test", path: "/",
      });
      const expected = entry.subject?.expected;
      const violations = [];
      if (entry.subject?.script?.transport !== "cleartext")
        violations.push(`${at}: mapper qualification requires cleartext peer input`);
      if (mapped.classification !== expected?.classification)
        violations.push(`${at}: mapped classification is '${mapped.classification}', expected '${expected?.classification}'`);
      if (!jsonValueEqual(mapped.coverageTokens, [...(expected?.coverageTokens || [])].sort()))
        violations.push(`${at}: mapped coverage-token set is not exact`);
      return violations;
    }
    if (entry.validator === "key-materialization-path") {
      return async31KeyMaterializationPathAllowed(entry.subject?.path)
        ? [] : [`${at}: materialization path escapes parsed source content`];
    }
    return [`${at}: unknown C20A scaffold validator '${entry.validator}'`];
  };

  const caseIds = new Set();
  let validCount = 0;
  let invalidCount = 0;
  for (const [index, entry] of (probes.cases || []).entries()) {
    const at = `harness-probes/processor-v7.cases[${index}]`;
    if (caseIds.has(entry.id)) errors.push(`${at}: duplicate id '${entry.id}'`);
    caseIds.add(entry.id);
    if (entry.valid) validCount++;
    else invalidCount++;
    const violations = scaffoldCaseViolations(entry, `${entry.id}.subject`);
    if (entry.valid && violations.length)
      errors.push(`${entry.id}: valid C20A scaffold trial rejected\n${violations.join("\n")}`);
    if (!entry.valid && violations.length === 0)
      errors.push(`${entry.id}: invalid C20A scaffold trial accepted`);
  }
  if (validCount !== 23 || invalidCount !== 44)
    errors.push(`processor-v7 scaffold exact disposition count drifted (found ${validCount} valid/${invalidCount} invalid; expected 23/44)`);

  const mapperCases = (probes.cases || []).filter((entry) => entry.validator === "http-peer-mapper@2");
  const mappedClassifications = new Set(mapperCases.map((entry) => entry.subject.expected.classification));
  for (const classification of ["successful-final", "unsuccessful-final", "incomplete", "peer-disconnect", "protocol-error"]) {
    if (!mappedClassifications.has(classification))
      errors.push(`processor-v7 mapper qualification lacks '${classification}' classification coverage`);
  }
  for (const entry of mapperCases) {
    for (const token of entry.subject.expected.coverageTokens) {
      const deleted = structuredClone(entry);
      deleted.subject.expected.coverageTokens = deleted.subject.expected.coverageTokens.filter((candidate) => candidate !== token);
      if (scaffoldCaseViolations(deleted, `${entry.id}.deleted-${token}`).length === 0)
        errors.push(`${entry.id}: deleting required mapper token '${token}' is not detected`);
    }
    const replaced = structuredClone(entry);
    replaced.subject.expected.classification = entry.subject.expected.classification === "successful-final"
      ? "protocol-error" : "successful-final";
    if (scaffoldCaseViolations(replaced, `${entry.id}.replaced-classification`).length === 0)
      errors.push(`${entry.id}: replacing its mapper classification is not detected`);
  }
  const mapperBody = mapperCases.find((entry) => entry.id === "V7-SCAFFOLD-MAPPER-BODY-57");
  if (mapperBody) {
    const deletedBody = structuredClone(mapperBody);
    deletedBody.subject.script.events.pop();
    if (scaffoldCaseViolations(deletedBody, `${mapperBody.id}.deleted-body`).length === 0)
      errors.push(`${mapperBody.id}: deleting the body event does not invalidate tracked mapping evidence`);
  }
  const mapperUnsuccessful = mapperCases.find((entry) => entry.id === "V7-SCAFFOLD-MAPPER-UNSUCCESSFUL-52");
  if (mapperUnsuccessful) {
    const rewritten = structuredClone(mapperUnsuccessful);
    rewritten.subject.script.events[0].status = 204;
    rewritten.subject.script.events[0].headers = [];
    if (scaffoldCaseViolations(rewritten, `${mapperUnsuccessful.id}.successful-rewrite`).length === 0)
      errors.push(`${mapperUnsuccessful.id}: changing unsuccessful response to successful does not invalidate its classification evidence`);
  }
  for (const entry of (probes.cases || []).filter((candidate) => candidate.validator === "key-materialization-path" && !candidate.valid)) {
    const repaired = structuredClone(entry);
    repaired.subject.path = "/source/content";
    if (scaffoldCaseViolations(repaired, `${entry.id}.repair`).length)
      errors.push(`${entry.id}: restoring the path to source.content does not repair its sole boundary defect`);
  }

  const repairedSubjects = new Map();
  for (const id of [
    "V7-SCAFFOLD-NATIVE-DIGEST-08",
    "V7-SCAFFOLD-NATIVE-RAW-SECRET-09",
    "V7-SCAFFOLD-NATIVE-PRIVATE-KEY-10",
  ]) {
    const entry = (probes.cases || []).find((candidate) => candidate.id === id);
    if (entry) repairedSubjects.set(id, structuredClone(entry));
  }
  const digestRepair = repairedSubjects.get("V7-SCAFFOLD-NATIVE-DIGEST-08");
  if (digestRepair)
    digestRepair.subject.facts.originFormSha256 = digestRepair.subject.facts.originFormSha256.toLowerCase();
  const secretRepair = repairedSubjects.get("V7-SCAFFOLD-NATIVE-RAW-SECRET-09");
  if (secretRepair) delete secretRepair.subject.facts.queryContributions[0].value;
  const keyRepair = repairedSubjects.get("V7-SCAFFOLD-NATIVE-PRIVATE-KEY-10");
  if (keyRepair) delete keyRepair.subject.facts.privateKey;
  for (const [id, repaired] of repairedSubjects) {
    const violations = scaffoldCaseViolations(repaired, `${id}.single-fault-repair`);
    if (violations.length)
      errors.push(`${id}: removing its named sole defect does not produce a valid subject\n${violations.join("\n")}`);
  }

  const oldBody = (probes.cases || []).find((entry) => entry.id === "V7-SCAFFOLD-NATIVE-BODY-OLD-KIND-22");
  if (oldBody) {
    const repaired = structuredClone(oldBody);
    repaired.subject.facts.body.kind = "absent";
    if (scaffoldCaseViolations(repaired, `${oldBody.id}.repair`).length)
      errors.push(`${oldBody.id}: replacing the sole old body token does not produce a valid subject`);
  }
  const missingType = (probes.cases || []).find((entry) => entry.id === "V7-SCAFFOLD-NATIVE-BODY-MISSING-TYPE-23");
  if (missingType) {
    const repaired = structuredClone(missingType);
    repaired.subject.facts.body.contentType = "application/json";
    if (scaffoldCaseViolations(repaired, `${missingType.id}.repair`).length)
      errors.push(`${missingType.id}: supplying the sole missing body field does not produce a valid subject`);
  }

  const twoFinals = (probes.cases || []).find((entry) => entry.id === "V7-SCAFFOLD-PROCESSOR-TWO-FINALS-27");
  if (twoFinals) {
    const repaired = structuredClone(twoFinals);
    repaired.subject.scenarios[0].given.peer.script.events.pop();
    if (scaffoldCaseViolations(repaired, `${twoFinals.id}.repair`).length)
      errors.push(`${twoFinals.id}: removing the second final response does not repair the processor-shaped subject`);
  }
  const earlyBody = (probes.cases || []).find((entry) => entry.id === "V7-SCAFFOLD-PROCESSOR-EARLY-BODY-28");
  if (earlyBody) {
    const repaired = structuredClone(earlyBody);
    repaired.subject.scenarios[0].given.peer.script.events.reverse();
    if (scaffoldCaseViolations(repaired, `${earlyBody.id}.repair`).length)
      errors.push(`${earlyBody.id}: moving the chunk after the final response does not repair the processor-shaped subject`);
  }

  const legacyPeer = (probes.cases || []).find((entry) => entry.id === "V7-SCAFFOLD-PROCESSOR-V1-HTTP2-31");
  if (legacyPeer) {
    const repaired = structuredClone(legacyPeer);
    repaired.subject.scenarios[0].given.peer.dialect = "openbindings.asyncapi-http-peer@1";
    if (scaffoldCaseViolations(repaired, `${legacyPeer.id}.repair`).length)
      errors.push(`${legacyPeer.id}: replacing the sole revision-2 peer token does not restore a valid open legacy subject`);
  }
  const legacyTls = (probes.cases || []).find((entry) => entry.id === "V7-SCAFFOLD-PROCESSOR-V1-TLS-32");
  if (legacyTls) {
    const repaired = structuredClone(legacyTls);
    delete repaired.subject.scenarios[0].given.configuration.tls;
    if (scaffoldCaseViolations(repaired, `${legacyTls.id}.repair`).length)
      errors.push(`${legacyTls.id}: deleting the sole revision-2 configuration name does not restore a valid open legacy subject`);
  }

  for (const [id, repair] of [
    ["V7-SCAFFOLD-PEER-TLS-NULL-VERSION-ALPN-42", (subject) => { subject.tls.serverAlpnSelected = null; }],
    ["V7-SCAFFOLD-PEER-TLS-RESPONSE-NO-SELECTION-43", (subject) => {
      subject.tls.serverTlsVersionSelected = "1.3";
      subject.tls.serverAlpnSelected = "http/1.1";
    }],
    ["V7-SCAFFOLD-PEER-TLS-RESPONSE-NO-ALPN-44", (subject) => { subject.tls.serverAlpnSelected = "http/1.1"; }],
    ["V7-SCAFFOLD-PEER-TLS-REQUEST-DISCONNECT-NO-SELECTION-49", (subject) => {
      subject.tls.serverTlsVersionSelected = "1.3";
      subject.tls.serverAlpnSelected = "http/1.1";
    }],
  ]) {
    const entry = (probes.cases || []).find((candidate) => candidate.id === id);
    if (!entry) continue;
    const shape = ajvOk(HTTP_PEER_V2_SCHEMA, entry.subject);
    const manual = httpPeerV2SemanticViolations(entry.subject, `${id}.manual`);
    if (shape.ok || manual.length === 0)
      errors.push(`${id}: TLS selection defect is not rejected independently by schema and manual guards`);
    const repaired = structuredClone(entry.subject);
    repair(repaired);
    if (httpPeerV2Violations(repaired, `${id}.repair`).length)
      errors.push(`${id}: repairing the sole TLS/ALPN selection defect does not produce a valid peer script`);
  }

  const requestDisconnect = (probes.cases || []).find((entry) =>
    entry.id === "V7-SCAFFOLD-PEER-TLS-REQUEST-DISCONNECT-NO-SELECTION-49"
  );
  if (requestDisconnect) {
    const stageOnly = structuredClone(requestDisconnect.subject);
    stageOnly.events[0].after = { kind: "start" };
    if (
      ajvOk(HTTP_PEER_V2_SCHEMA, stageOnly).ok
      || httpPeerV2SemanticViolations(stageOnly, `${requestDisconnect.id}.stage-only`).length === 0
    ) errors.push(`${requestDisconnect.id}: request-stage selection guard is not independently schema/manual enforced`);
    const triggerOnly = structuredClone(requestDisconnect.subject);
    triggerOnly.events[0].stage = "during-tls";
    if (
      ajvOk(HTTP_PEER_V2_SCHEMA, triggerOnly).ok
      || httpPeerV2SemanticViolations(triggerOnly, `${requestDisconnect.id}.trigger-only`).length === 0
    ) errors.push(`${requestDisconnect.id}: request-trigger selection guard is not independently schema/manual enforced`);
    for (const name of ["acknowledgement", "delivery"]) {
      const activityTrigger = structuredClone(requestDisconnect.subject);
      activityTrigger.events[0].stage = "during-tls";
      activityTrigger.events[0].after.name = name;
      if (
        ajvOk(HTTP_PEER_V2_SCHEMA, activityTrigger).ok
        || httpPeerV2SemanticViolations(activityTrigger, `${requestDisconnect.id}.${name}-trigger`).length === 0
      ) errors.push(`${requestDisconnect.id}: ${name}-trigger selection guard is not independently schema/manual enforced`);
      activityTrigger.tls.serverTlsVersionSelected = "1.3";
      activityTrigger.tls.serverAlpnSelected = "http/1.1";
      if (httpPeerV2Violations(activityTrigger, `${requestDisconnect.id}.${name}-trigger-repair`).length)
        errors.push(`${requestDisconnect.id}: repairing the ${name}-trigger selection does not produce a valid peer script`);
    }
  }

  for (const [id, repair] of [
    ["V7-SCAFFOLD-PROCESSOR-V1-SERVER-VARIABLES-46", (subject) => {
      delete subject.scenarios[0].given.configuration.serverVariables;
    }],
    ["V7-SCAFFOLD-PROCESSOR-V1-CHANNEL-PARAMETERS-47", (subject) => {
      delete subject.scenarios[0].given.configuration.channelParameters;
    }],
    ["V7-SCAFFOLD-PROCESSOR-V5-LAYER-SECURITY-48", (subject) => {
      subject.scenarios[0].given.configuration.security = { index: 0 };
    }],
    ["V7-SCAFFOLD-PROCESSOR-V1-LAYER-SECURITY-50", (subject) => {
      delete subject.scenarios[0].given.configuration.security;
    }],
  ]) {
    const entry = (probes.cases || []).find((candidate) => candidate.id === id);
    if (!entry) continue;
    const shape = ajvOk(PROCESSOR_SCHEMA, entry.subject);
    const manual = processorApparatusVersionViolations(entry.subject, `${id}.manual`);
    if (shape.ok || manual.length === 0)
      errors.push(`${id}: pre-revision-7 configuration defect is not rejected independently by schema and manual guards`);
    const repaired = structuredClone(entry);
    repair(repaired.subject);
    if (scaffoldCaseViolations(repaired, `${id}.repair`).length)
      errors.push(`${id}: repairing the sole pre-revision-7 configuration defect does not preserve a valid historic subject`);
  }

  if ((probes.cases || []).length) {
    const deletion = structuredClone(probes);
    deletion.cases.pop();
    const deletionViolations = scaffoldIntegrityViolations(deletion, "processor-v7 deletion mutant");
    if (
      !deletionViolations.some((entry) => entry.includes("trust anchor"))
      || !deletionViolations.some((entry) => entry.includes("exact case count"))
      || !deletionViolations.some((entry) => entry.includes("required case id"))
    ) errors.push("processor-v7 scaffold integrity does not reject case deletion");

    const duplicate = structuredClone(probes);
    duplicate.cases.push(structuredClone(duplicate.cases[0]));
    const duplicateViolations = scaffoldIntegrityViolations(duplicate, "processor-v7 duplicate mutant");
    if (!duplicateViolations.some((entry) => entry.includes("duplicate case id")))
      errors.push("processor-v7 scaffold integrity does not reject duplicate case identity/content");

    const replacement = structuredClone(probes);
    replacement.cases[0].description += " replacement";
    if (!scaffoldIntegrityViolations(replacement, "processor-v7 replacement mutant").some((entry) => entry.includes("trust anchor")))
      errors.push("processor-v7 scaffold integrity does not reject same-id content replacement");
  }

  const v6Http2 = (probes.cases || []).find((entry) => entry.id === "V7-SCAFFOLD-PROCESSOR-V6-HTTP2-11");
  if (v6Http2) {
    const shape = ajvOk(PROCESSOR_SCHEMA, v6Http2.subject);
    const manual = processorApparatusVersionViolations(v6Http2.subject, "processor-v6 HTTP@2 isolation mutant");
    if (shape.ok || !manual.some((entry) => entry.includes("requires processor-scenario revision 7")))
      errors.push("HTTP peer revision 2 under processor revision 6 is not rejected by both schema and manual verifier");
  }
  const v7Legacy = (probes.cases || []).find((entry) => entry.id === "V7-SCAFFOLD-PROCESSOR-LEGACY-V7-12");
  if (v7Legacy && ajvOk(PROCESSOR_SCHEMA, v7Legacy.subject).ok)
    errors.push("processor-scenario revision 7 is not isolated from legacy family fixtures");
  const v7Http1 = (probes.cases || []).find((entry) => entry.id === "V7-SCAFFOLD-PROCESSOR-HTTP1-14");
  if (v7Http1) {
    const shape = ajvOk(PROCESSOR_SCHEMA, v7Http1.subject);
    const manual = processorApparatusVersionViolations(v7Http1.subject, "processor-v7 HTTP@1 downgrade mutant");
    if (shape.ok || !manual.some((entry) => entry.includes("require HTTP peer revision 2")))
      errors.push("HTTP peer revision 1 under processor revision 7 is not rejected by both schema and manual verifier");
  }
  const v6Runtime2 = (probes.cases || []).find((entry) => entry.id === "V7-SCAFFOLD-PROCESSOR-RUNTIME6-20");
  if (v6Runtime2) {
    const shape = ajvOk(PROCESSOR_SCHEMA, v6Runtime2.subject);
    const manual = processorApparatusVersionViolations(v6Runtime2.subject, "processor-v6 runtime@2 isolation mutant");
    if (shape.ok || !manual.some((entry) => entry.includes("requires processor-scenario revision 7")))
      errors.push("HTTP runtime revision-2 vocabulary under processor revision 6 is not rejected by both schema and manual verifier");
  }

  const v1Http2 = (probes.cases || []).find((entry) => entry.id === "V7-SCAFFOLD-PROCESSOR-V1-HTTP2-31");
  if (v1Http2) {
    const shape = ajvOk(PROCESSOR_SCHEMA, v1Http2.subject);
    const manual = processorApparatusVersionViolations(v1Http2.subject, "processor-v1 HTTP@2 isolation mutant");
    if (shape.ok || !manual.some((entry) => entry.includes("requires processor-scenario revision 7")))
      errors.push("HTTP peer revision 2 under open processor revision 1 is not rejected by both schema and manual verifier");
  }
  const v1Tls = (probes.cases || []).find((entry) => entry.id === "V7-SCAFFOLD-PROCESSOR-V1-TLS-32");
  if (v1Tls) {
    const shape = ajvOk(PROCESSOR_SCHEMA, v1Tls.subject);
    const manual = processorApparatusVersionViolations(v1Tls.subject, "processor-v1 runtime TLS isolation mutant");
    if (shape.ok || !manual.some((entry) => entry.includes("requires processor-scenario revision 7")))
      errors.push("HTTP runtime revision-2 vocabulary under open processor revision 1 is not rejected by both schema and manual verifier");
  }
  const async31V6 = (probes.cases || []).find((entry) => entry.id === "V7-SCAFFOLD-PROCESSOR-ASYNC31-V6-33");
  if (async31V6) {
    const shape = ajvOk(PROCESSOR_SCHEMA, async31V6.subject);
    const manual = processorApparatusVersionViolations(async31V6.subject, "AsyncAPI 3.1 processor revision-6 isolation mutant");
    if (shape.ok || !manual.some((entry) => entry.includes("requires processor-scenario revision 7")))
      errors.push("AsyncAPI 3.1 under processor revision 6 is not rejected by both schema and manual verifier");
  }
  const synthesisWrongFamily = (probes.cases || []).find((entry) => entry.id === "V7-SCAFFOLD-SYNTHESIS-WRONG-FAMILY-34");
  if (synthesisWrongFamily) {
    const shape = ajvOk(SYNTHESIS_SCHEMA, synthesisWrongFamily.subject);
    const manual = synthesisApparatusVersionViolations(synthesisWrongFamily.subject, "synthesis revision-7 wrong-family mutant");
    if (shape.ok || !manual.some((entry) => entry.includes("reserved to asyncapi-3.1")))
      errors.push("synthesis revision 7 wrong-family use is not rejected by both schema and manual verifier");
  }
}

// --- 15. C20B deterministic TLS/HTTPS apparatus qualification --------------
// This remains harness qualification only. It proves the closed evidence and
// state algebra needed before an HTTPS profile may become represented.
{
  let assets;
  let qualification;
  let manifest;
  const c20bArtifactPaths = [...PROCESSOR_V7_TLS_FILE_SHA256.keys()];
  const c20bArtifactDirectory = realpathSync(dirname(PROCESSOR_V7_TLS_ASSETS));
  const c20bFileIdentityViolations = (path, allowedDirectory = c20bArtifactDirectory) => {
    const violations = [];
    try {
      const status = lstatSync(path);
      if (status.isSymbolicLink() || !status.isFile())
        violations.push(`${relative(CORPUS, path)}: C20B artifact must be a regular non-symlink file`);
      const real = realpathSync(path);
      if (!(real === allowedDirectory || real.startsWith(`${allowedDirectory}/`)))
        violations.push(`${relative(CORPUS, path)}: C20B artifact realpath escapes its containing apparatus directory`);
    } catch (error) {
      violations.push(`${relative(CORPUS, path)}: C20B artifact identity cannot be established (${error.message})`);
    }
    return violations;
  };
  const c20bTypeAwareRoot = (paths) => {
    const records = paths.map((path) => {
      const status = lstatSync(path);
      const mode = (status.mode & 0o7777).toString(8).padStart(4, "0");
      return `${relative(CORPUS, path)}\0regular\0${mode}\0${fileSha256(path)}\n`;
    }).sort();
    return createHash("sha256").update(records.join(""), "utf8").digest("hex");
  };
  for (const path of c20bArtifactPaths) errors.push(...c20bFileIdentityViolations(path));
  if (!errors.some((entry) => entry.includes("C20B artifact identity"))
    && c20bTypeAwareRoot(c20bArtifactPaths) !== PROCESSOR_V7_TLS_TYPE_AWARE_ROOT_SHA256)
    errors.push("C20B type/mode/content artifact root does not match the verifier trust anchor");
  const readLosslessArtifact = (path, label) => {
    const octets = readFileSync(path);
    let source;
    try { source = new TextDecoder("utf-8", { fatal: true }).decode(octets); }
    catch { throw new Error(`${label}: bytes are not well-formed UTF-8`); }
    const lossless = parseLosslessJson(source);
    if (!lossless.ok) throw new Error(`${label}: ${lossless.error}`);
    const parsed = JSON.parse(source);
    const nonScalar = c20bNonScalarStringPaths(parsed);
    if (nonScalar.length) throw new Error(`${label}: JSON contains a non-Unicode-scalar string at ${nonScalar[0]}`);
    return parsed;
  };
  try {
    assets = readLosslessArtifact(PROCESSOR_V7_TLS_ASSETS, "C20B TLS assets");
    qualification = readLosslessArtifact(PROCESSOR_V7_TLS_SEMANTICS, "C20B qualification");
    manifest = readLosslessArtifact(PROCESSOR_V7_TLS_MANIFEST, "C20B manifest");
  } catch (error) {
    errors.push(`C20B artifact load failed: ${error.message}`);
    assets = { certificates: {}, privateKeyCapabilities: {} };
    qualification = { cases: [] };
    manifest = { entries: [] };
  }
  for (const [path, expectedSha256] of PROCESSOR_V7_TLS_FILE_SHA256) {
    if (!existsSync(path)) {
      errors.push(`${relative(CORPUS, path)}: missing required C20B artifact`);
      continue;
    }
    const actual = fileSha256(path);
    if (actual !== expectedSha256)
      errors.push(`${relative(CORPUS, path)}: C20B file hash ${actual} is not trust-anchored ${expectedSha256}`);
    const source = readFileSync(path, "utf8");
    const lossless = parseLosslessJson(source);
    if (!lossless.ok) errors.push(`${relative(CORPUS, path)}: is not lossless JSON (${lossless.error})`);
  }
  for (const [schema, value, label] of [
    [PROCESSOR_V7_TLS_ASSET_SCHEMA, assets, "processor-v7-tls-assets.json"],
    [PROCESSOR_V7_TLS_SEMANTIC_SCHEMA, qualification, "processor-v7-tls-semantics.json"],
    [PROCESSOR_V7_TLS_MANIFEST_SCHEMA, manifest, "processor-v7-tls-semantics.manifest.json"],
  ]) {
    const shape = ajvOk(schema, value);
    if (!shape.ok) errors.push(`${label}: does not match its closed schema\n${shape.out}`);
  }
  const assetState = c20bAssetState(assets, "processor-v7-tls-assets");
  errors.push(...assetState.violations);
  const invalidPortableMutations = c20bInvalidPortableMutationPaths(qualification);
  if (invalidPortableMutations.length)
    errors.push(`C20B portable UTF-16 mutation materializes a valid scalar string at ${invalidPortableMutations[0]}`);

  const c20bIntegrityViolations = (artifact, caseManifest, label) => {
    const violations = [];
    if (sortedJsonSha256(artifact) !== PROCESSOR_V7_TLS_ROOT_SHA256)
      violations.push(`${label}: qualification canonical root does not match the verifier trust anchor`);
    if (sortedJsonSha256(caseManifest) !== PROCESSOR_V7_TLS_MANIFEST_ROOT_SHA256)
      violations.push(`${label}: manifest canonical root does not match the verifier trust anchor`);
    const ids = new Set();
    let accepted = 0;
    let rejected = 0;
    for (const [index, entry] of (artifact.cases || []).entries()) {
      if (ids.has(entry.id)) violations.push(`${label}.cases[${index}]: duplicate case id '${entry.id}'`);
      ids.add(entry.id);
      if (entry.valid) accepted++; else rejected++;
    }
    if (ids.size !== 191 || accepted !== 43 || rejected !== 148)
      violations.push(`${label}: exact counts must be 191 total, 43 accepted, and 148 rejected`);
    for (const id of PROCESSOR_V7_TLS_EXPECTED_CASE_IDS) {
      if (!ids.has(id)) violations.push(`${label}: required case id '${id}' is missing`);
    }
    for (const id of ids) {
      if (!PROCESSOR_V7_TLS_EXPECTED_CASE_IDS.has(id)) violations.push(`${label}: unexpected case id '${id}'`);
    }
    if (
      caseManifest.caseCount !== 191
      || caseManifest.acceptedCount !== 43
      || caseManifest.rejectedCount !== 148
      || caseManifest.entries?.length !== 191
    ) violations.push(`${label}: manifest exact counts do not match the qualification`);
    const manifestIds = new Set();
    for (const [index, entry] of (caseManifest.entries || []).entries()) {
      if (manifestIds.has(entry.id)) violations.push(`${label}.manifest.entries[${index}]: duplicate case id '${entry.id}'`);
      manifestIds.add(entry.id);
      const trial = (artifact.cases || []).find((candidate) => candidate.id === entry.id);
      if (!trial || sortedJsonSha256(trial) !== entry.sha256)
        violations.push(`${label}.manifest.entries[${index}]: case digest does not match exact content`);
    }
    if (!sameStringMultiset([...manifestIds], [...ids]))
      violations.push(`${label}: manifest and qualification case identities differ`);
    return violations;
  };
  errors.push(...c20bIntegrityViolations(qualification, manifest, "C20B"));
  const c20bCorpusReadme = readFileSync(join(CORPUS, "README.md"), "utf8");
  const c20bPeerReadme = readFileSync(join(PEER_DIALECT_DIR, "README.md"), "utf8");
  if (!c20bCorpusReadme.includes("C20B/C20B14")
    || !c20bCorpusReadme.includes("191-case C20B14 TLS/HTTP suite")
    || !c20bCorpusReadme.includes("#c20b14-deterministic-tls-and-http-qualification")
    || !c20bPeerReadme.includes("## C20B14 deterministic TLS and HTTP qualification")
    || !c20bPeerReadme.includes("44 cross-lane pairs")
    || !c20bPeerReadme.includes("18 post-terminal pairs")
    || !c20bPeerReadme.includes("exactly 191 portable cases: 43 accepted and 148 rejected"))
    errors.push("C20B14 README phase/count/link contract drifted");

  const c20bCaseViolations = (entry, disabledGuard) => {
    const at = `${entry.id}.subject`;
    const subject = c20bPortableMaterialize(entry.subject);
    const validate = (guard) => entry.category === "tls"
      ? c20bTlsViolations(subject, assetState, at, guard)
      : entry.category === "http-security"
        ? c20bSecurityV3Violations(subject, assetState, at, guard)
        : entry.category === "http-response"
          ? c20bResponseViolations(subject, at, guard)
          : [`CASE-CATEGORY: ${at}: unknown qualification category`];
    const traversed = validate(disabledGuard);
    return traversed;
  };
  const c20bCodes = (violations) => [...new Set(violations.map((violation) => violation.match(/^([A-Z0-9-]+):/)?.[1] || "UNSTABLE"))];
  const c20bApplyRepairPatch = (subject, patch) => {
    const repaired = structuredClone(subject);
    if (patch.op === "replace" && patch.path === "") return structuredClone(patch.value);
    if (patch.op === "replace-server-path") {
      repaired.serverChain = structuredClone(patch.serverChain);
      repaired.serverPrivateKeyCapability = patch.serverPrivateKeyCapability;
      repaired.observed.serverChainSha256 = structuredClone(patch.serverChainSha256);
      return repaired;
    }
    if (patch.op === "replace-client-path") {
      repaired.client.chain = structuredClone(patch.clientChain);
      repaired.client.privateKeyCapability = patch.clientPrivateKeyCapability;
      repaired.observed.clientChainSha256 = structuredClone(patch.clientChainSha256);
      return repaired;
    }
    const segments = patch.path.slice(1).split("/").map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
    let parent = repaired;
    for (const segment of segments.slice(0, -1)) parent = parent[Array.isArray(parent) ? Number(segment) : segment];
    const key = segments.at(-1);
    if (patch.op === "remove") {
      if (Array.isArray(parent)) parent.splice(Number(key), 1); else delete parent[key];
    } else if (patch.op === "add") {
      if (Array.isArray(parent)) parent.splice(Number(key), 0, structuredClone(patch.value)); else parent[key] = structuredClone(patch.value);
    } else {
      parent[Array.isArray(parent) ? Number(key) : key] = structuredClone(patch.value);
    }
    return repaired;
  };
  const caseById = new Map((qualification.cases || []).map((entry) => [entry.id, entry]));
  const expectedGuardIds = new Set();
  let accepted = 0;
  let rejected = 0;
  for (const entry of qualification.cases || []) {
    const violations = c20bCaseViolations(entry);
    if (entry.valid) {
      accepted++;
      if (violations.length) errors.push(`${entry.id}: accepted C20B case rejected\n${violations.join("\n")}`);
    } else {
      rejected++;
      if (!violations.length) errors.push(`${entry.id}: rejected C20B case accepted`);
      const codes = c20bCodes(violations);
      if (!codes.includes(entry.expectedViolation))
        errors.push(`${entry.id}: expected stable violation '${entry.expectedViolation}', found ${codes.join(", ") || "none"}`);
      if (codes.length !== 1 || codes[0] !== entry.expectedViolation)
        errors.push(`${entry.id}: negative is not single-guard isolated (${codes.join(", ")})`);
      expectedGuardIds.add(entry.expectedViolation);
      const repair = caseById.get(entry.repairCaseId);
      if (!repair?.valid || repair.category !== entry.category)
        errors.push(`${entry.id}: repairCaseId does not name an accepted case in the same category`);
      else {
        const patched = c20bApplyRepairPatch(entry.subject, entry.repairPatch);
        if (!jsonValueEqual(patched, repair.subject))
          errors.push(`${entry.id}: explicit one-operation repairPatch does not reproduce repairCaseId`);
        const repairViolations = c20bCaseViolations(repair);
        if (repairViolations.length)
          errors.push(`${entry.id}: named repair case is not semantically valid`);
      }
      const branchDeletedViolations = c20bCaseViolations(entry, entry.expectedViolation);
      if (!branchDeletedViolations.guardHits.has(entry.expectedViolation))
        errors.push(`${entry.id}: named guard '${entry.expectedViolation}' was never actually executed`);
      if (branchDeletedViolations.length)
        errors.push(`${entry.id}: own-guard deletion does not admit isolated witness (${c20bCodes(branchDeletedViolations).join(", ")})`);
    }
  }
  for (const entry of qualification.cases || []) {
    if (entry.valid) continue;
    const unrelatedGuard = [...expectedGuardIds].find((guardId) => guardId !== entry.expectedViolation);
    if (unrelatedGuard && !c20bCodes(c20bCaseViolations(entry, unrelatedGuard)).includes(entry.expectedViolation))
      errors.push(`${entry.id}: unrelated guard deletion masks expected violation '${entry.expectedViolation}'`);
  }
  if (accepted !== 43 || rejected !== 148)
    errors.push(`C20B qualification disposition counts drifted (found ${accepted} accepted/${rejected} rejected)`);

  // Schema-hostile inputs remain portable verifier mutations rather than
  // semantic cases: the qualification artifact itself is required to satisfy
  // its closed schema, while each mutation has an exact one-operation repair.
  const c20bSchemaMutation = (label, caseId, mutate, repair, manualCode) => {
    const artifact = structuredClone(qualification);
    const entry = artifact.cases.find((candidate) => candidate.id === caseId);
    mutate(entry.subject);
    if (ajvOk(PROCESSOR_V7_TLS_SEMANTIC_SCHEMA, artifact).ok)
      errors.push(`${label}: schema-hostile mutation was accepted`);
    if (manualCode && !c20bCodes(c20bCaseViolations(entry)).includes(manualCode))
      errors.push(`${label}: manual verifier did not report ${manualCode}`);
    repair(entry.subject);
    if (!ajvOk(PROCESSOR_V7_TLS_SEMANTIC_SCHEMA, artifact).ok || c20bCaseViolations(entry).length)
      errors.push(`${label}: exact one-operation repair did not restore a valid subject`);
  };
  for (const method of ["head", "TRACE", "BREW", ""]) {
    c20bSchemaMutation(
      `C20B method '${method}'`,
      "C20B-HTTP-03",
      (subject) => { subject.method = method; },
      (subject) => { subject.method = "HEAD"; },
      "HTTP-METHOD"
    );
  }
  for (const status of [99, 600, 200.5]) {
    c20bSchemaMutation(
      `C20B response status '${status}'`,
      "C20B-HTTP-02",
      (subject) => { subject.events[0].status = status; },
      (subject) => { subject.events[0].status = 200; },
      "HTTP-STATUS"
    );
  }
  c20bSchemaMutation(
    "C20B lowercase query percent octet",
    "C20B-SEC-41",
    (subject) => { subject.inputs.caller.query[0].nameEncoded = "%2f"; },
    (subject) => { subject.inputs.caller.query[0].nameEncoded = "a"; },
    "SEC-QUERY-GRAMMAR"
  );
  const irrelevantCredentialFields = [
    ["bearer username", "C20B-SEC-01", (subject) => { subject.inputs.credentials[1].username = "alice"; }, (subject) => { delete subject.inputs.credentials[1].username; }],
    ["basic name", "C20B-SEC-02", (subject) => { subject.inputs.credentials[1].name = "unused"; }, (subject) => { delete subject.inputs.credentials[1].name; }],
    ["api-key username", "C20B-SEC-02", (subject) => { subject.inputs.credentials[0].username = "unused"; }, (subject) => { delete subject.inputs.credentials[0].username; }],
    ["x509 secret", "C20B-SEC-05", (subject) => { subject.inputs.credentials[0].secret = "forbidden"; }, (subject) => { delete subject.inputs.credentials[0].secret; }],
  ];
  for (const [label, caseId, mutate, repair] of irrelevantCredentialFields)
    c20bSchemaMutation(`C20B credential ${label}`, caseId, mutate, repair);
  c20bSchemaMutation(
    "C20B surplus TLS client certificate without X509 selection",
    "C20B-SEC-41",
    (subject) => { subject.inputs.tlsClientCertificate = structuredClone(caseById.get("C20B-SEC-05").subject.inputs.tlsClientCertificate); },
    (subject) => { delete subject.inputs.tlsClientCertificate; },
    "SEC-X509-SURPLUS"
  );
  c20bSchemaMutation(
    "C20B unselected X509 alternative smuggled name",
    "C20B-SEC-01",
    (subject) => { subject.alternatives.server[1].name = "smuggled"; },
    (subject) => { delete subject.alternatives.server[1].name; }
  );
  c20bSchemaMutation(
    "C20B raw credential normalized field",
    "C20B-SEC-01",
    (subject) => { subject.dispatch.queryContributions.find((entry) => entry.kind === "credential").value = "same.bytes"; },
    (subject) => { delete subject.dispatch.queryContributions.find((entry) => entry.kind === "credential").value; }
  );

  const doubleFault = structuredClone(caseById.get("C20B-SEC-02"));
  doubleFault.subject.inputs.credentials[1].username = "ali:ce";
  doubleFault.subject.inputs.credentials[1].secret = "bad\u007f";
  if (!c20bCodes(c20bCaseViolations(doubleFault, "SEC-BASIC-USERNAME")).includes("SEC-BASIC-PASSWORD")
    || !c20bCodes(c20bCaseViolations(doubleFault, "SEC-BASIC-PASSWORD")).includes("SEC-BASIC-USERNAME"))
    errors.push("C20B double-fault mutant was incorrectly admitted after deleting only one real guard");

  const postTerminalLocalPairs = [
    {
      label: "duplicate Content-Length",
      code: "HTTP-CONTENT-LENGTH-DUPLICATE",
      event: { kind: "head", status: 200, headers: [
        { name: "Content-Length", value: "0" },
        { name: "content-length", value: "0" },
      ] },
    },
    {
      label: "Transfer-Encoding",
      code: "HTTP-TRANSFER-ENCODING",
      event: { kind: "head", status: 200, headers: [
        { name: "Transfer-Encoding", value: "chunked" },
        { name: "Content-Length", value: "0" },
      ] },
    },
    {
      label: "Trailer",
      code: "HTTP-TRAILER",
      event: { kind: "head", status: 200, headers: [
        { name: "Trailer", value: "X-Later" },
        { name: "Content-Length", value: "0" },
      ] },
    },
    {
      label: "Content-Encoding",
      code: "HTTP-CONTENT-ENCODING",
      event: { kind: "head", status: 200, headers: [
        { name: "Content-Encoding", value: "gzip" },
        { name: "Content-Length", value: "0" },
      ] },
    },
    {
      label: "duplicate Content-Type",
      code: "HTTP-CONTENT-TYPE-DUPLICATE",
      event: { kind: "head", status: 200, headers: [
        { name: "Content-Type", value: "application/json" },
        { name: "content-type", value: "text/plain; charset=utf-8" },
        { name: "Content-Length", value: "0" },
      ] },
    },
    {
      label: "204 Content-Length",
      code: "HTTP-204-CONTENT-LENGTH",
      event: { kind: "head", status: 204, headers: [{ name: "Content-Length", value: "0" }] },
    },
    {
      label: "205 Content-Length",
      code: "HTTP-205-CONTENT-LENGTH",
      event: { kind: "head", status: 205, headers: [{ name: "Content-Length", value: "1" }] },
    },
    {
      label: "status outside 100..599",
      code: "HTTP-STATUS",
      event: { kind: "head", status: 600, headers: [] },
    },
    {
      label: "body before final",
      code: "HTTP-BODY-BEFORE-FINAL",
      event: { kind: "body", dataBase64: "" },
    },
  ].map(({ label, code, event }) => ({
    label: `post-terminal ${label}`,
    entry: (() => {
      const value = structuredClone(caseById.get("C20B-HTTP-09"));
      value.subject.events.push(event);
      return value;
    })(),
    first: "HTTP-PEER-AFTER-TERMINAL",
    second: code,
  }));
  postTerminalLocalPairs.push(
    {
      label: "post-terminal multiple final",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-76"));
        value.subject.events.push({ kind: "head", status: 201, headers: [{ name: "Content-Length", value: "0" }] });
        return value;
      })(),
      first: "HTTP-PEER-AFTER-TERMINAL",
      second: "HTTP-MULTIPLE-FINAL",
    },
    {
      label: "post-terminal interim after final",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-76"));
        value.subject.events.push({ kind: "head", status: 103, headers: [] });
        return value;
      })(),
      first: "HTTP-PEER-AFTER-TERMINAL",
      second: "HTTP-INTERIM-AFTER-FINAL",
    },
  );

  const crossStagePairs = [
    {
      label: "TLS signature/validity",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-TLS-12"));
        value.subject.serverChain[1] = "intermediate-a-wrong-key";
        value.subject.observed.serverChainSha256[1] = assetState.certificates.get("intermediate-a-wrong-key").digest;
        return value;
      })(),
      first: "TLS-SIGNATURE",
      second: "TLS-VALIDITY",
    },
    {
      label: "TLS signature/leaf Key Usage",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-TLS-16"));
        value.subject.serverChain[1] = "intermediate-a-wrong-key";
        value.subject.observed.serverChainSha256[1] = assetState.certificates.get("intermediate-a-wrong-key").digest;
        return value;
      })(),
      first: "TLS-SIGNATURE",
      second: "TLS-KU-DIGITAL-SIGNATURE",
    },
    {
      label: "TLS leaf Key Usage/DNS-ID",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-TLS-16"));
        value.subject.referenceIdentity.value = "wrong.example.test";
        value.subject.observedSni = "wrong.example.test";
        return value;
      })(),
      first: "TLS-KU-DIGITAL-SIGNATURE",
      second: "TLS-DNS-ID",
    },
    {
      label: "security username/header-block digest",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-SEC-22"));
        value.subject.dispatch.headerBlockSha256 = "0".repeat(64);
        return value;
      })(),
      first: "SEC-BASIC-USERNAME",
      second: "SEC-HEADER-BLOCK-DIGEST",
    },
    {
      label: "HTTP framing/FSM",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-02"));
        value.subject.events[0].headers.push({ name: "content-length", value: "0" });
        value.subject.native.shift();
        return value;
      })(),
      first: "HTTP-CONTENT-LENGTH-DUPLICATE",
      second: "HTTP-ATTEMPT-CARDINALITY",
    },
    {
      label: "request-header scalar/query evidence",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-SEC-53"));
        value.subject.dispatch.queryContributions = [];
        return value;
      })(),
      first: "SEC-HEADER-GRAMMAR",
      second: "SEC-QUERY-EVIDENCE",
    },
    {
      label: "response-field scalar/native attempt",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-82"));
        value.subject.native.shift();
        return value;
      })(),
      first: "HTTP-FIELD-GRAMMAR",
      second: "HTTP-ATTEMPT-CARDINALITY",
    },
    {
      label: "interim response-field scalar/final framing",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-01"));
        value.subject.events[0].headers.push({
          name: "X-Bad",
          value: { format: "openbindings.utf16-code-units@1", codeUnits: [0xd800] },
        });
        value.subject.events[2].headers.push({ name: "content-length", value: "2" });
        return value;
      })(),
      first: "HTTP-FIELD-GRAMMAR",
      second: "HTTP-CONTENT-LENGTH-DUPLICATE",
    },
    {
      label: "same-final response-field scalar/content-length duplicate",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-01"));
        value.subject.events[2].headers.push({
          name: "X-Bad",
          value: { format: "openbindings.utf16-code-units@1", codeUnits: [0xd800] },
        });
        value.subject.events[2].headers.push({ name: "content-length", value: "2" });
        return value;
      })(),
      first: "HTTP-FIELD-GRAMMAR",
      second: "HTTP-CONTENT-LENGTH-DUPLICATE",
    },
    {
      label: "invalid body Base64/body-before-final envelope",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-31"));
        value.subject.events[0].dataBase64 = "b2v=";
        return value;
      })(),
      first: "HTTP-BODY-BEFORE-FINAL",
      second: "HTTP-BODY-BASE64",
    },
    {
      label: "invalid response field/multiple-final envelope",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-29"));
        value.subject.events[1].headers.push({ name: "Bad Header", value: "0" });
        return value;
      })(),
      first: "HTTP-MULTIPLE-FINAL",
      second: "HTTP-FIELD-GRAMMAR",
    },
    {
      label: "invalid response field/status-101 envelope",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-32"));
        value.subject.events[0].headers.push({ name: "Bad Header", value: "0" });
        return value;
      })(),
      first: "HTTP-STATUS-101",
      second: "HTTP-FIELD-GRAMMAR",
    },
    {
      label: "invalid response field/interim-after-final envelope",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-28"));
        value.subject.events[1].headers.push({ name: "Bad Header", value: "0" });
        return value;
      })(),
      first: "HTTP-INTERIM-AFTER-FINAL",
      second: "HTTP-FIELD-GRAMMAR",
    },
    {
      label: "content-length syntax/terminal outcome",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-02"));
        value.subject.events[0].headers[0].value = "00";
        value.subject.native.find((event) => event.name === "terminal").outcome = "error";
        return value;
      })(),
      first: "HTTP-CONTENT-LENGTH-SYNTAX",
      second: "HTTP-TERMINAL-OUTCOME",
    },
    {
      label: "content-length duplicate/independent decimal syntax",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-02"));
        value.subject.events[0].headers.push({ name: "content-length", value: "00" });
        return value;
      })(),
      first: "HTTP-CONTENT-LENGTH-DUPLICATE",
      second: "HTTP-CONTENT-LENGTH-SYNTAX",
    },
    {
      label: "missing output/terminal outcome",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-03"));
        value.subject.native.splice(value.subject.native.findIndex((event) => event.name === "output"), 1);
        value.subject.native.find((event) => event.name === "terminal").outcome = "error";
        return value;
      })(),
      first: "HTTP-OUTPUT-CARDINALITY",
      second: "HTTP-TERMINAL-OUTCOME",
    },
    {
      label: "body Base64/terminal outcome",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-01"));
        value.subject.events.push({ kind: "body", dataBase64: "b2v=" });
        value.subject.native.find((event) => event.name === "terminal").outcome = "error";
        return value;
      })(),
      first: "HTTP-BODY-BASE64",
      second: "HTTP-TERMINAL-OUTCOME",
    },
    {
      label: "attempt cardinality/terminal outcome",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-02"));
        value.subject.native.shift();
        value.subject.native.find((event) => event.name === "terminal").outcome = "error";
        return value;
      })(),
      first: "HTTP-ATTEMPT-CARDINALITY",
      second: "HTTP-TERMINAL-OUTCOME",
    },
    {
      label: "attempt cardinality/dispatch order",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-02"));
        value.subject.native.splice(-1, 0, { name: "connection-attempted" });
        [value.subject.native[3], value.subject.native[4]] = [value.subject.native[4], value.subject.native[3]];
        return value;
      })(),
      first: "HTTP-ATTEMPT-CARDINALITY",
      second: "HTTP-DISPATCH-ORDER",
    },
    {
      label: "delivery order/terminal outcome",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-01"));
        const delivery = value.subject.native.splice(value.subject.native.findIndex((event) => event.name === "delivery"), 1)[0];
        value.subject.native.splice(4, 0, delivery);
        value.subject.native.find((event) => event.name === "terminal").outcome = "error";
        return value;
      })(),
      first: "HTTP-DELIVERY-ORDER",
      second: "HTTP-TERMINAL-OUTCOME",
    },
    {
      label: "delivery/output cardinality",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-01"));
        value.subject.native = value.subject.native.filter((event) => !["delivery", "output"].includes(event.name));
        return value;
      })(),
      first: "HTTP-DELIVERY-CARDINALITY",
      second: "HTTP-OUTPUT-CARDINALITY",
    },
    {
      label: "content-length mismatch/output cardinality",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-01"));
        value.subject.events[2].headers.find((header) => header.name === "Content-Length").value = "3";
        value.subject.native.splice(value.subject.native.findIndex((event) => event.name === "output"), 1);
        return value;
      })(),
      first: "HTTP-CONTENT-LENGTH-MISMATCH",
      second: "HTTP-OUTPUT-CARDINALITY",
    },
    {
      label: "delivery cardinality/terminal outcome",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-01"));
        value.subject.native.splice(value.subject.native.findIndex((event) => event.name === "delivery"), 1);
        value.subject.native.find((event) => event.name === "terminal").outcome = "error";
        return value;
      })(),
      first: "HTTP-DELIVERY-CARDINALITY",
      second: "HTTP-TERMINAL-OUTCOME",
    },
    {
      label: "incomplete peer/observed-prefix acknowledgement",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-66"));
        value.subject.native.find((event) => event.name === "acknowledgement").status = 100;
        return value;
      })(),
      first: "HTTP-PEER-INCOMPLETE",
      second: "HTTP-ACK-CORRESPONDENCE",
    },
    {
      label: "incomplete peer/unexpected delivery",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-66"));
        value.subject.native.splice(-1, 0, {
          name: "delivery",
          octetLengthDecimal: "0",
          bodySha256: createHash("sha256").update(Buffer.alloc(0)).digest("hex"),
        });
        return value;
      })(),
      first: "HTTP-PEER-INCOMPLETE",
      second: "HTTP-DELIVERY-CARDINALITY",
    },
    {
      label: "incomplete peer/unexpected output",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-66"));
        value.subject.native.splice(-1, 0, { name: "output" });
        return value;
      })(),
      first: "HTTP-PEER-INCOMPLETE",
      second: "HTTP-OUTPUT-CARDINALITY",
    },
    {
      label: "post-terminal response-field grammar",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-09"));
        value.subject.events.push({
          kind: "head",
          status: 200,
          headers: [{
            name: "X-Bad",
            value: { format: "openbindings.utf16-code-units@1", codeUnits: [0xd800] },
          }],
        });
        return value;
      })(),
      first: "HTTP-PEER-AFTER-TERMINAL",
      second: "HTTP-FIELD-GRAMMAR",
    },
    {
      label: "post-terminal body Base64",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-09"));
        value.subject.events.push({ kind: "body", dataBase64: "b2v=" });
        return value;
      })(),
      first: "HTTP-PEER-AFTER-TERMINAL",
      second: "HTTP-BODY-BASE64",
    },
    {
      label: "post-terminal interim Content-Length",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-09"));
        value.subject.events.push({ kind: "head", status: 103, headers: [{ name: "Content-Length", value: "0" }] });
        return value;
      })(),
      first: "HTTP-PEER-AFTER-TERMINAL",
      second: "HTTP-INTERIM-CONTENT-LENGTH",
    },
    {
      label: "post-terminal status 101",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-09"));
        value.subject.events.push({ kind: "head", status: 101, headers: [] });
        return value;
      })(),
      first: "HTTP-PEER-AFTER-TERMINAL",
      second: "HTTP-STATUS-101",
    },
    {
      label: "post-terminal malformed Content-Type",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-09"));
        value.subject.events.push({
          kind: "head",
          status: 200,
          headers: [
            { name: "Content-Type", value: "not-a-media-type" },
            { name: "Content-Length", value: "0" },
          ],
        });
        return value;
      })(),
      first: "HTTP-PEER-AFTER-TERMINAL",
      second: "HTTP-CONTENT-TYPE-GRAMMAR",
    },
    {
      label: "post-terminal non-close Connection",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-09"));
        value.subject.events.push({
          kind: "head",
          status: 200,
          headers: [
            { name: "Connection", value: "keep-alive" },
            { name: "Content-Length", value: "0" },
          ],
        });
        return value;
      })(),
      first: "HTTP-PEER-AFTER-TERMINAL",
      second: "HTTP-CONNECTION-FIELD",
    },
    {
      label: "post-terminal Content-Length syntax",
      entry: (() => {
        const value = structuredClone(caseById.get("C20B-HTTP-09"));
        value.subject.events.push({ kind: "head", status: 200, headers: [{ name: "Content-Length", value: "00" }] });
        return value;
      })(),
      first: "HTTP-PEER-AFTER-TERMINAL",
      second: "HTTP-CONTENT-LENGTH-SYNTAX",
    },
    ...postTerminalLocalPairs,
  ];
  const requiredPostTerminalLocalGuards = new Set([
    "HTTP-FIELD-GRAMMAR",
    "HTTP-BODY-BASE64",
    "HTTP-INTERIM-CONTENT-LENGTH",
    "HTTP-STATUS-101",
    "HTTP-CONTENT-TYPE-GRAMMAR",
    "HTTP-CONNECTION-FIELD",
    "HTTP-CONTENT-LENGTH-SYNTAX",
    "HTTP-CONTENT-LENGTH-DUPLICATE",
    "HTTP-TRANSFER-ENCODING",
    "HTTP-TRAILER",
    "HTTP-CONTENT-ENCODING",
    "HTTP-CONTENT-TYPE-DUPLICATE",
    "HTTP-204-CONTENT-LENGTH",
    "HTTP-205-CONTENT-LENGTH",
    "HTTP-BODY-BEFORE-FINAL",
    "HTTP-MULTIPLE-FINAL",
    "HTTP-INTERIM-AFTER-FINAL",
    "HTTP-STATUS",
  ]);
  const observedPostTerminalLocalGuards = new Set(crossStagePairs
    .filter(({ label }) => label.startsWith("post-terminal "))
    .map(({ second }) => second));
  if (crossStagePairs.length !== 44
    || observedPostTerminalLocalGuards.size !== requiredPostTerminalLocalGuards.size
    || [...requiredPostTerminalLocalGuards].some((guard) => !observedPostTerminalLocalGuards.has(guard)))
    errors.push("C20B14 exact 44-pair/18-post-terminal-local mutation matrix drifted");
  for (const { label, entry, first, second } of crossStagePairs) {
    if (!c20bCodes(c20bCaseViolations(entry, first)).includes(second)
      || !c20bCodes(c20bCaseViolations(entry, second)).includes(first))
      errors.push(`C20B cross-stage ${label} double fault did not survive both one-guard suppression orders`);
  }
  const verifierSource = readFileSync(import.meta.filename, "utf8");
  if (verifierSource.includes("C20B_GUARD_" + "DEPENDENCIES")
    || verifierSource.includes("c20bIndependent" + "Violations"))
    errors.push("C20B dependency-filter counter-mutant: global violation-code admission filtering reappeared");
  if (verifierSource.includes("HTTP-" + "ACK-ORDER")
    || verifierSource.includes("ackOrder" + "Valid"))
    errors.push("C20B unreachable acknowledgement-order guard/state was resurrected");

  const noncharacterCase = caseById.get("C20B-SEC-54");
  const noncharacterSubject = c20bPortableMaterialize(noncharacterCase?.subject);
  const containsUnicodeNoncharacter = (value) => {
    if (typeof value === "string") return [...value].some((character) => {
      const point = character.codePointAt(0);
      return (point >= 0xfdd0 && point <= 0xfdef) || (point & 0xffff) >= 0xfffe;
    });
    if (Array.isArray(value)) return value.some(containsUnicodeNoncharacter);
    return Boolean(value && typeof value === "object" && Object.values(value).some(containsUnicodeNoncharacter));
  };
  if (!containsUnicodeNoncharacter(noncharacterSubject) || c20bCaseViolations(noncharacterCase).length)
    errors.push("C20B noncharacter-rejection metamutant escaped: U+FDD0/U+10FFFF scalar evidence is not directly accepted");
  if (c20bNonScalarStringPaths(JSON.parse('{"value":"\\ud800"}')).length !== 1)
    errors.push("C20B raw unpaired-surrogate JSON metamutant escaped the scalar-only artifact invariant");

  if (qualification.cases?.length) {
    const deletionArtifact = structuredClone(qualification);
    const deleted = deletionArtifact.cases.pop();
    const deletionManifest = structuredClone(manifest);
    deletionManifest.entries = deletionManifest.entries.filter((entry) => entry.id !== deleted.id);
    deletionManifest.caseCount--;
    if (!c20bIntegrityViolations(deletionArtifact, deletionManifest, "C20B coordinated deletion mutant").some((entry) => entry.includes("trust anchor")))
      errors.push("C20B coordinated artifact/manifest deletion escaped the verifier trust anchors");
    const duplicateArtifact = structuredClone(qualification);
    duplicateArtifact.cases.push(structuredClone(duplicateArtifact.cases[0]));
    if (!c20bIntegrityViolations(duplicateArtifact, manifest, "C20B duplicate mutant").some((entry) => entry.includes("duplicate case id")))
      errors.push("C20B duplicate case identity/content escaped integrity checks");
    const replacementArtifact = structuredClone(qualification);
    replacementArtifact.cases[0].description += " replacement";
    if (!c20bIntegrityViolations(replacementArtifact, manifest, "C20B replacement mutant").some((entry) => entry.includes("trust anchor")))
      errors.push("C20B same-ID content replacement escaped the verifier trust anchor");
    const swappedDisposition = structuredClone(qualification);
    swappedDisposition.cases[0].valid = !swappedDisposition.cases[0].valid;
    if (!c20bIntegrityViolations(swappedDisposition, manifest, "C20B disposition swap mutant").some((entry) => entry.includes("trust anchor")))
      errors.push("C20B case disposition swap escaped the verifier trust anchor");
  }
  const certificateMutation = structuredClone(assets);
  certificateMutation.certificates["server-good"].derBase64 = "AA==";
  if (!c20bAssetState(certificateMutation, "C20B certificate mutation").violations.length)
    errors.push("C20B certificate DER mutation escaped derived asset validation");
  const capabilityMutation = structuredClone(assets);
  capabilityMutation.privateKeyCapabilities["c20b-key-server-good"].pkcs8DerBase64 =
    assets.privateKeyCapabilities["c20b-key-server-expired"].pkcs8DerBase64;
  if (!c20bAssetState(capabilityMutation, "C20B key mutation").violations.length)
    errors.push("C20B private-key/leaf mismatch escaped derived asset validation");
  const duplicateCertificateMutation = structuredClone(assets);
  duplicateCertificateMutation.certificates["server-no-ku"].derBase64 = assets.certificates["server-good"].derBase64;
  if (!c20bAssetState(duplicateCertificateMutation, "C20B duplicate certificate mutation").violations.some((entry) => entry.includes("duplicate certificate DER")))
    errors.push("C20B duplicate certificate bytes escaped asset validation");
  const noncanonicalKeyMutation = structuredClone(assets);
  noncanonicalKeyMutation.privateKeyCapabilities["c20b-key-server-good"].pkcs8DerBase64 = "b2v=";
  if (!c20bAssetState(noncanonicalKeyMutation, "C20B noncanonical key mutation").violations.some((entry) => entry.includes("not canonical")))
    errors.push("C20B noncanonical Base64 key mutation escaped asset validation");
  const symlinkDirectory = join(tmp, "c20b-symlink-mutant");
  mkdirSync(symlinkDirectory);
  const symlinkPath = join(symlinkDirectory, "processor-v7-tls-assets.json");
  symlinkSync(PROCESSOR_V7_TLS_ASSETS, symlinkPath);
  if (!c20bFileIdentityViolations(symlinkPath, realpathSync(symlinkDirectory)).some((entry) => entry.includes("regular non-symlink")))
    errors.push("C20B symlink-substitution mutant escaped file-type integrity validation");
  const manifestSource = readFileSync(PROCESSOR_V7_TLS_MANIFEST, "utf8");
  const duplicateManifestMember = manifestSource.replace(
    /("format"\s*:\s*"openbindings\.asyncapi-http-tls-qualification-manifest@2"\s*,)/,
    '$1"format":"openbindings.asyncapi-http-tls-qualification-manifest@2",'
  );
  if (parseLosslessJson(duplicateManifestMember).ok)
    errors.push("C20B duplicate manifest member escaped lossless JSON parsing");
  const reassociationMutation = structuredClone(qualification);
  const reassociated = reassociationMutation.cases.find((entry) => !entry.valid);
  if (reassociated) reassociated.repairCaseId = qualification.cases.find((entry) => entry.valid && entry.category === reassociated.category && entry.id !== reassociated.repairCaseId)?.id;
  if (!c20bIntegrityViolations(reassociationMutation, manifest, "C20B repair reassociation mutant").some((entry) => entry.includes("trust anchor")))
    errors.push("C20B repair-case reassociation escaped verifier-owned artifact root");
}

rmSync(tmp, { recursive: true, force: true });

// --- 10. The README's scenario counts are derived, not hand-maintained ------
// count-binding-spec-scenarios.mjs is the single derivation; this check makes
// the README's prose fail the build when it drifts from the corpus, which is
// how three stale numbers survived several corpus growths.
{
  const counts = countBindingSpecScenarios(SPEC_ROOT);

  const async31ReadmeViolations = async31ReadmeInventoryViolations(
    readme,
    familyRuleDefinitions["asyncapi-3.1"],
    fixtureVerdictCounts
  );
  errors.push(...async31ReadmeViolations);
  const pRangeMutation = readme.replace("ASYNC31-P-01..13", "ASYNC31-P-01..12");
  if (async31ReadmeInventoryViolations(pRangeMutation, familyRuleDefinitions["asyncapi-3.1"], fixtureVerdictCounts).length === 0)
    errors.push("AsyncAPI 3.1 README P-range mutation escaped the verifier");
  const d01Counts = fixtureVerdictCounts.get("asyncapi-3.1\0ASYNC31-D-01");
  const dCountMutation = readme.replace(
    /^(\|\s*ASYNC31-D-01\s*\|\s*)\d+\/\d+/m,
    `$1${d01Counts?.positive ?? 0}/${(d01Counts?.negative ?? 0) + 1}`
  );
  if (async31ReadmeInventoryViolations(dCountMutation, familyRuleDefinitions["asyncapi-3.1"], fixtureVerdictCounts).length === 0)
    errors.push("AsyncAPI 3.1 README D-count mutation escaped the verifier");

  // The verifier's own walk and the shared derivation must agree; otherwise a
  // number could be "asserted" against a second, silently different count.
  const crossChecks = [
    ["processor scenarios", counts.processor.scenarios, processorScenarios],
    ["distinct processor rules", counts.processor.coveredRules.length, processorRuleCoverage.size],
    ["synthesis scenarios", counts.synthesis.scenarios, synthesisScenarios],
  ];
  for (const [what, derived, walked] of crossChecks) {
    if (derived !== walked)
      errors.push(
        `count-binding-spec-scenarios.mjs counts ${derived} ${what}; this verifier's own walk counts ${walked}`
      );
  }

  // The README is hard-wrapped, so match against the unwrapped text.
  const prose = readme.replace(/\s+/g, " ");
  const stated = [
    {
      what: "portable processor scenarios",
      pattern: /The current corpus contains (\d+) scenarios/,
      shape: "The current corpus contains <N> scenarios",
      actual: counts.processor.scenarios,
    },
    {
      what: "distinct P-rules the processor scenarios cover",
      pattern: /\((\d+) distinct rules\)/,
      shape: "(<N> distinct rules)",
      actual: counts.processor.coveredRules.length,
    },
    {
      what: "portable synthesis scenarios",
      pattern: /The (\d+) scenarios exercise all eleven family candidates/,
      shape: "The <N> scenarios exercise all eleven family candidates",
      actual: counts.synthesis.scenarios,
    },
  ];
  for (const { what, pattern, shape, actual } of stated) {
    const found = prose.match(pattern);
    if (!found) {
      errors.push(
        `conformance/binding-specs/README.md: no sentence of the form "${shape}" states the ${what}; the verifier asserts that count and needs the sentence to stay matchable`
      );
      continue;
    }
    if (Number(found[1]) !== actual)
      errors.push(
        `conformance/binding-specs/README.md states ${found[1]} ${what}; the corpus holds ${actual} (run: node scripts/count-binding-spec-scenarios.mjs)`
      );
  }
}

console.log(`Family D-rules defined across eleven family candidates: ${definedDRules.size}`);
console.log(`Fixture files: ${files}`);
console.log(`Rules covered by fixtures: ${fixtureRules.size}`);
console.log(`Rules deferred per README: ${deferred.size}`);
console.log(
  `Tests: ${tests} (${positives} positive, ${negatives} negative)`
);
console.log(
  `Portable processor scenarios: ${processorScenarios} in ${processorFiles} files, citing ${processorRuleCoverage.size}/${processorPRules.size} distinct targeted P-rules`
);
console.log(`Invocation-fidelity scenarios: ${fidelityScenarios} across ${fidelityTargets.length} active family slice(s)`);
console.log(
  `Portable synthesis scenarios: ${synthesisScenarios} in ${synthesisFiles} files, covering ${synthesisFiles}/${processorTargets.length} family candidates`
);
console.log(`Conformance adjudications: ${adjudicationCount}`);
console.log(`Abstraction-fidelity ledger entries: ${alignmentLedgerEntries}`);

if (errors.length) {
  console.log(`\nErrors (${errors.length}):`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log("\nOK");
}
