import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { isJsonNumber, parseUniqueJson, strictUtf8 } from "./protojson-lossless.mjs";

type Action = { type: string };
type TimelineEvent = {
  event: string;
  action?: number;
  index?: number;
  disposition?: string;
  cause?: string;
};
type PeerEvent = {
  id: string;
  after: { action?: number };
  type: string;
  dataBase64?: string;
  endStream?: boolean;
  headers?: Array<{ name: string; values: string[] }>;
};
type Scenario = {
  id: string;
  given: {
    invocation: { actions: Action[] };
    peer: { events: PeerEvent[] };
  };
  expected: Array<{
    disposition: string;
    phase: string;
    timeline: TimelineEvent[];
    native: { requestMessages: Array<{ compressedFlag: 0 | 1; decodedLength: number; decodedPayloadBase64: string; frameBase64?: string; lengthMatchesEncodedPayload: true; gzipMemberValid?: true }>; leadingMetadata?: ObservedMetadata[]; trailingMetadata?: ObservedMetadata[] };
  }>;
};
type ObservedMetadata = { name: string; value: string | string[] };
type Corpus = { format: string; scenarios: Scenario[] };

function fail(message: string): never {
  throw new Error(message);
}

function canonicalBase64(value: string): Buffer {
  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value) fail(`noncanonical Base64 ${JSON.stringify(value)}`);
  return decoded;
}
function metadataBase64(value: string): Buffer {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1 || (value.includes("=") && value.length % 4 !== 0)) fail("invalid binary metadata Base64");
  const decoded = Buffer.from(value.padEnd(Math.ceil(value.length / 4) * 4, "="), "base64");
  const canonical = decoded.toString("base64");
  if (value.includes("=") ? value !== canonical : value !== canonical.replace(/=+$/, "")) fail("nonzero Base64 pad bits");
  return decoded;
}
function inboundMetadata(headers: Array<{ name: string; values: string[] }>, trailers = false): ObservedMetadata[] {
  const owned = new Set(trailers ? [":status", "content-type", "te", "grpc-status", "grpc-message", "grpc-status-details-bin"] : [":status", "content-type", "te", "grpc-encoding", "grpc-accept-encoding", "grpc-status", "grpc-message", "grpc-status-details-bin"]);
  const grouped = new Map<string, string[]>();
  for (const header of headers) {
    if (header.name.startsWith(":") || owned.has(header.name)) continue;
    if (header.name.startsWith("grpc-")) fail("unknown reserved response metadata");
    grouped.set(header.name, [...(grouped.get(header.name) ?? []), ...header.values]);
  }
  return [...grouped].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([name, values]) => {
    if (name.endsWith("-bin")) return { name, value: values.join(",").split(",").map((value) => metadataBase64(value).toString("base64")) };
    if (values.some((value) => value.length === 0 || !/^[\x20-\x7e]+$/.test(value))) fail("invalid ASCII response metadata");
    return { name, value: values.join(",") };
  });
}

function legalResponseHeaderBlock(headers: Array<{ name: string; values: string[] }>, trailers = false): boolean {
  let regularSeen = false;
  for (const header of headers) {
    const name = header.name;
    if (!/^(?::[a-z]+|[0-9a-z_.-]+)$/.test(name) || !Array.isArray(header.values) || header.values.length === 0 || header.values.some((value) => typeof value !== "string")) return false;
    if (name.startsWith(":")) {
      if (trailers || name !== ":status" || regularSeen) return false;
    } else regularSeen = true;
    if (trailers) {
      if (name.startsWith("grpc-") && !["grpc-status", "grpc-message", "grpc-status-details-bin"].includes(name)) return false;
      if (["content-type", "te"].includes(name)) return false;
    } else {
      if (name.startsWith("grpc-") && !["grpc-encoding", "grpc-accept-encoding", "grpc-status", "grpc-message", "grpc-status-details-bin"].includes(name)) return false;
      if (name === "te") return false;
    }
  }
  try { inboundMetadata(headers, trailers); return true; } catch { return false; }
}

function validate(corpus: Corpus): object {
  if (corpus.format !== "openbindings.binding-spec-processor-scenarios@7") fail("wrong format");
  const ids = new Set<string>();
  let actionCount = 0;
  let peerDataBytes = 0;
  let semanticOutputCount = 0;
  let terminalCount = 0;
  for (const scenario of corpus.scenarios) {
    if (ids.has(scenario.id)) fail(`duplicate scenario ${scenario.id}`);
    ids.add(scenario.id);
    const actions = scenario.given.invocation.actions;
    actionCount += actions.length;
    const peerIds = new Set<string>();
    let wire = Buffer.alloc(0);
    let peerEnded = false;
    let responseStarted = false;
    const protocolExpected = scenario.expected.every((alternative) =>
      alternative.disposition === "error" && alternative.timeline.at(-1)?.cause === "protocol"
    );
    for (const event of scenario.given.peer.events) {
      if (peerEnded) fail(`${scenario.id}: peer effect after end of stream`);
      if (peerIds.has(event.id)) fail(`${scenario.id}: duplicate peer id ${event.id}`);
      peerIds.add(event.id);
      if (event.after.action !== undefined && event.after.action >= actions.length)
        fail(`${scenario.id}: peer trigger action out of range`);
      if (event.type === "response-headers") {
        if (!legalResponseHeaderBlock(event.headers ?? []) && !protocolExpected) fail(`${scenario.id}: illegal initial response header block`);
        if (responseStarted && !protocolExpected) fail(`${scenario.id}: duplicate initial response headers`);
        responseStarted = true;
      }
      if (event.type === "trailers" && !legalResponseHeaderBlock(event.headers ?? [], true) && !protocolExpected)
        fail(`${scenario.id}: illegal trailer block`);
      if ((event.type === "data" || event.type === "trailers") && !responseStarted && !protocolExpected)
        fail(`${scenario.id}: response event precedes initial response headers`);
      if (event.type === "data") {
        const chunk = canonicalBase64(event.dataBase64 ?? "");
        peerDataBytes += chunk.length;
        wire = Buffer.concat([wire, chunk]);
        while (wire.length >= 5) {
          const flag = wire[0];
          if (flag !== 0 && flag !== 1) fail(`${scenario.id}: invalid gRPC compressed flag`);
          const length = wire.readUInt32BE(1);
          if (wire.length < 5 + length) break;
          wire = wire.subarray(5 + length);
        }
        if (event.endStream) peerEnded = true;
      }
      if (event.type === "trailers" || (event.type === "response-headers" && event.endStream)) peerEnded = true;
    }
    for (const alternative of scenario.expected) {
      const terminals = alternative.timeline.filter((event) => event.event === "terminal");
      if (terminals.length !== 1) fail(`${scenario.id}: terminal cardinality`);
      if (terminals[0].disposition !== alternative.disposition) fail(`${scenario.id}: terminal mismatch`);
      terminalCount += terminals.length;
      const outputs = alternative.timeline.filter((event) => event.event === "output");
      outputs.forEach((event, index) => {
        if (event.index !== index) fail(`${scenario.id}: output order`);
      });
      semanticOutputCount += outputs.length;
      const sends = alternative.timeline.filter((event) => event.event === "request-message");
      if (sends.length !== alternative.native.requestMessages.length || sends.some((event, index) => event.index !== index))
        fail(`${scenario.id}: native request messages are not exactly bound to ordered timeline sends`);
      let leading: ObservedMetadata[] = [], trailing: ObservedMetadata[] = [];
      try {
        leading = scenario.given.peer.events.filter((event) => event.type === "response-headers" && !(event.headers ?? []).some((header) => header.name === "grpc-status")).flatMap((event) => inboundMetadata(event.headers ?? [], false));
        trailing = scenario.given.peer.events.filter((event) => event.type === "trailers" || (event.type === "response-headers" && (event.headers ?? []).some((header) => header.name === "grpc-status"))).flatMap((event) => inboundMetadata(event.headers ?? [], true));
      } catch { if (!protocolExpected) throw new Error(`${scenario.id}: invalid response metadata`); }
      if (!protocolExpected || alternative.native.leadingMetadata !== undefined || alternative.native.trailingMetadata !== undefined) {
        if (JSON.stringify(alternative.native.leadingMetadata ?? []) !== JSON.stringify(leading)) fail(`${scenario.id}: leading metadata evidence mismatch`);
        if (JSON.stringify(alternative.native.trailingMetadata ?? []) !== JSON.stringify(trailing)) fail(`${scenario.id}: trailing metadata evidence mismatch`);
      }
      const results = new Set<number>();
      for (const event of alternative.timeline) {
        if (["input-accepted", "input-rejected", "input-half-closed", "cancelled", "action-failed"].includes(event.event) && event.action !== undefined) {
          if (results.has(event.action)) fail(`${scenario.id}: duplicate action result`);
          results.add(event.action);
        }
      }
      actions.forEach((action, index) => {
        if (!["advance-clock", "await-output", "await-native"].includes(action.type) && !results.has(index)) fail(`${scenario.id}: missing action result ${index}`);
      });
      for (const message of alternative.native.requestMessages) {
        const decoded = message.decodedPayloadBase64 === undefined ? undefined : canonicalBase64(message.decodedPayloadBase64);
        if (decoded !== undefined && decoded.length !== message.decodedLength) fail(`${scenario.id}: decoded request length mismatch`);
        if (message.lengthMatchesEncodedPayload !== true) fail(`${scenario.id}: encoded request length is unproved`);
        if (message.compressedFlag === 1 && message.gzipMemberValid !== true) fail(`${scenario.id}: compressed request gzip member is unproved`);
        if (message.compressedFlag === 0 && message.gzipMemberValid !== undefined) fail(`${scenario.id}: identity request claims gzip evidence`);
        if (message.frameBase64 !== undefined) {
          const frame = canonicalBase64(message.frameBase64);
          if (frame.length < 5 || frame[0] !== message.compressedFlag || frame.readUInt32BE(1) !== frame.length - 5)
            fail(`${scenario.id}: request frame does not prove its flag and encoded length`);
          if (message.compressedFlag === 0 && decoded !== undefined && !frame.subarray(5).equals(decoded))
            fail(`${scenario.id}: identity request frame differs from decoded payload`);
        }
      }
      if (peerEnded && wire.length !== 0 && !(terminals[0].cause === "protocol" && alternative.disposition === "error"))
        fail(`${scenario.id}: truncated peer frame is not a protocol failure`);
    }
  }
  return {
    format: "openbindings.grpc-runner-result@1",
    corpusSha256: createHash("sha256").update(raw).digest("hex"),
    scenarioCount: corpus.scenarios.length,
    actionCount,
    peerDataBytes,
    semanticOutputCount,
    terminalCount
  };
}

const file = process.argv[2];
if (!file) fail("usage: node runner.ts <processor-grpc.json>");
const raw = readFileSync(file);
const ordinaryJson = (value: unknown): unknown => isJsonNumber(value)
  ? Number(value.token)
  : Array.isArray(value)
    ? value.map(ordinaryJson)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).map(([key,item]) => [key,ordinaryJson(item)]))
      : value;
const corpus = ordinaryJson(parseUniqueJson(strictUtf8(raw, "processor corpus UTF-8"))) as Corpus;
process.stdout.write(`${JSON.stringify(validate(corpus))}\n`);
