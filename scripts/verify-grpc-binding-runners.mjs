#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { gunzipSync, inflateRawSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const corpus = join(root, "conformance", "binding-specs", "processor", "grpc.json");
const tsRunner = join(root, "conformance", "binding-specs", "grpc-runners", "typescript", "runner.ts");
const goRunner = join(root, "conformance", "binding-specs", "grpc-runners", "go", "runner.go");
const goStrict = join(root, "conformance", "binding-specs", "grpc-runners", "go", "protojson_strict.go");
const apparatusManifest = join(root, "conformance", "binding-specs", "grpc-apparatus.manifest.json");

function run(command, args, env = process.env, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", env });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    process.exit(1);
  }
  return result.stdout.trim();
}

function runResult(command, args, env = process.env, cwd = root) {
  return spawnSync(command, args, { cwd, encoding: "utf8", env });
}

function canonicalBase64(value) {
  if (typeof value !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error("noncanonical Base64");
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) throw new Error("noncanonical Base64");
  return bytes;
}
function singleGzipMember(bytes) {
  if (bytes.length < 18 || bytes[0] !== 31 || bytes[1] !== 139 || bytes[2] !== 8 || (bytes[3] & 0xe0)) throw new Error("invalid gzip header");
  let offset = 10;
  if (bytes[3] & 4) { if (offset + 2 > bytes.length) throw new Error("gzip extra"); const length = bytes.readUInt16LE(offset); offset += 2 + length; }
  for (const bit of [8, 16]) if (bytes[3] & bit) { while (offset < bytes.length && bytes[offset++] !== 0) {} }
  if (bytes[3] & 2) offset += 2;
  if (offset > bytes.length - 8) throw new Error("gzip header length");
  const result = inflateRawSync(bytes.subarray(offset), { info: true });
  if (offset + result.engine.bytesWritten + 8 !== bytes.length) throw new Error("gzip is not exactly one complete member");
  const decoded = gunzipSync(bytes);
  if (!decoded.equals(result.buffer)) throw new Error("gzip integrity");
  return decoded;
}
function wireEntries(bytes) {
  const entries = []; let offset = 0;
  const varint = () => { let value = 0n, shift = 0n; while (offset < bytes.length && shift <= 63n) { const byte = BigInt(bytes[offset++]); value |= (byte & 127n) << shift; if (!(byte & 128n)) return value; shift += 7n; } throw new Error("truncated varint"); };
  while (offset < bytes.length) { const tag = varint(), number = Number(tag >> 3n), wire = Number(tag & 7n); let value; if (wire === 0) value = varint(); else if (wire === 2) { const length = Number(varint()); value = bytes.subarray(offset, offset + length); if (value.length !== length) throw new Error("truncated bytes"); offset += length; } else throw new Error("unexpected request wire type"); entries.push({ number, wire, value }); }
  return entries;
}
function encodeVarint(value) { let current=BigInt(value), out=[]; do { let byte=Number(current&127n); current>>=7n; if(current)byte|=128; out.push(byte); } while(current); return Buffer.from(out); }
function lengthField(number, value) { const bytes=Buffer.isBuffer(value)?value:Buffer.from(value); return Buffer.concat([encodeVarint(BigInt(number*8+2)),encodeVarint(bytes.length),bytes]); }
function metadataBase64(value) { if(typeof value!=="string"||!/^[A-Za-z0-9+/]*={0,2}$/.test(value)||value.length%4===1||(value.includes("=")&&value.length%4!==0))throw new Error("invalid binary metadata Base64");const bytes=Buffer.from(value.padEnd(Math.ceil(value.length/4)*4,"="),"base64"),encoded=bytes.toString("base64");if(value.includes("=")?value!==encoded:value!==encoded.replace(/=+$/,""))throw new Error("nonzero Base64 pad bits");return encoded; }
function inboundMetadata(headers, trailers=false) { const owned=new Set(trailers?[":status","content-type","te","grpc-status","grpc-message","grpc-status-details-bin"]:[":status","content-type","te","grpc-encoding","grpc-accept-encoding","grpc-status","grpc-message","grpc-status-details-bin"]),groups=new Map();for(const header of headers||[]){if(header.name.startsWith(":")||owned.has(header.name))continue;if(header.name.startsWith("grpc-"))throw new Error("reserved response metadata");groups.set(header.name,[...(groups.get(header.name)||[]),...header.values])}return[...groups].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([name,values])=>{if(name.endsWith("-bin"))return{name,value:values.join(",").split(",").map(metadataBase64)};if(values.some((value)=>value.length===0||!(/^[\x20-\x7e]+$/).test(value)))throw new Error("invalid ASCII metadata");return{name,value:values.join(",")}}); }
function validateOutboundImplementationHeaders(headers, label) {
  if (!Array.isArray(headers)) throw new Error(`${label}: request headers are absent`);
  if (headers.some((header) => header?.name === "grpc-message-type"))
    throw new Error(`${label}: grpc-message-type must be omitted`);
  const userAgent = headers.filter((header) => header?.name === "user-agent");
  if (userAgent.length > 1 || (userAgent.length === 1 && (
    !Array.isArray(userAgent[0].values) ||
    userAgent[0].values.length !== 1 ||
    typeof userAgent[0].values[0] !== "string" ||
    !/^[\x20-\x7e]+$/.test(userAgent[0].values[0])
  ))) throw new Error(`${label}: invalid implementation-owned user-agent`);
  return userAgent.length === 1;
}
function withoutImplementationOwnedUserAgent(headers) {
  return (headers || []).filter((header) => header.name !== "user-agent");
}
function grpcTimeoutHeader(nsText) {
  const ns=BigInt(nsText), units=[["n",1n],["u",1000n],["m",1000000n],["S",1000000000n],["M",60000000000n],["H",3600000000000n]];
  for (const [suffix,size] of units) { const value=(ns+size-1n)/size; if(value<=99999999n)return`${value}${suffix}`; }
  throw new Error("timeout unrepresentable");
}
function applicationTarget(source, configuration) {
  const location=source.location;
  if(location.startsWith("grpc://"))return{scheme:"http",authority:location.slice(7)};
  if(location.startsWith("grpcs://"))return{scheme:"https",authority:location.slice(8)};
  return{scheme:configuration.transport==="tls"?"https":"http",authority:location};
}
function configuredMetadataHeaders(groups) {
  return [...(groups || [])].sort((left,right)=>left.name<right.name?-1:left.name>right.name?1:0).map((group)=>({
    name:group.name,
    values:group.name.endsWith("-bin")?[group.values.map((entry)=>entry.base64).join(",")]:[...group.values],
  }));
}
function canonicalHeaderSet(headers) {
  return headers.map((header)=>({name:header.name,values:[...header.values]})).sort((left,right)=>{
    if(left.name!==right.name)return left.name<right.name?-1:1;
    const leftValues=JSON.stringify(left.values),rightValues=JSON.stringify(right.values);
    return leftValues<rightValues?-1:leftValues>rightValues?1:0;
  });
}
function expectedApplicationRequestHeaders(source, result) {
  const opened=result.timeline.some((event)=>event.event==="rpc-opened");
  const config=source.given.configuration??{}, measured=source.given.peer.metadataMeasurement;
  const stoppedAtMetadataLimit=measured&&config.limits?.maxMetadataBytes!==undefined&&measured.requestBytes>config.limits.maxMetadataBytes;
  if(!opened||stoppedAtMetadataLimit)return[];
  const target=applicationTarget(source.given.source,config), headers=[
    {name:":method",values:["POST"]},
    {name:":scheme",values:[target.scheme]},
    {name:":authority",values:[target.authority]},
    {name:":path",values:[`/${source.given.binding.selector}`]},
    {name:"te",values:["trailers"]},
    {name:"content-type",values:["application/grpc+proto"]},
    {name:"grpc-accept-encoding",values:["gzip"]},
  ];
  if(config.compression==="gzip")headers.push({name:"grpc-encoding",values:["gzip"]});
  if(config.timeoutNs!==undefined)headers.push({name:"grpc-timeout",values:[grpcTimeoutHeader(config.timeoutNs)]});
  headers.push(...configuredMetadataHeaders(config.metadata));
  return headers;
}
function validateSemanticEvidence(result, corpusDocument) {
  const sourceById = new Map(corpusDocument.scenarios.map((scenario) => [scenario.id, scenario]));
  for (const scenario of result.results) {
    const source = sourceById.get(scenario.id);
    const expected = source?.expected.find((alternative) => alternative.disposition === scenario.disposition && alternative.phase === scenario.phase && isDeepStrictEqual(alternative.timeline, scenario.timeline));
    if (!source || !expected) throw new Error(`${scenario.id}: semantic result has no exact corpus alternative`);
    const hasApplicationUserAgent=validateOutboundImplementationHeaders(scenario.native.requestHeaders, `${scenario.id} application`);
    const expectedApplicationHeaders=expectedApplicationRequestHeaders(source,scenario);
    if((expectedApplicationHeaders.length===0&&hasApplicationUserAgent)||
       !isDeepStrictEqual(canonicalHeaderSet(withoutImplementationOwnedUserAgent(scenario.native.requestHeaders)),canonicalHeaderSet(expectedApplicationHeaders)))
      throw new Error(`${scenario.id}: application request headers are not the exact governed set`);
    const sends = scenario.timeline.filter((event) => event.event === "request-message");
    if (sends.length !== scenario.native.requestMessages.length || sends.some((event, index) => event.index !== index) || expected.native.requestMessages.length !== scenario.native.requestMessages.length)
      throw new Error(`${scenario.id}: native request messages are not exactly bound to ordered corpus/timeline sends`);
    for (const message of scenario.native.requestMessages) {
      const decoded = canonicalBase64(message.decodedPayloadBase64), frame = canonicalBase64(message.frameBase64);
      if (decoded.length !== message.decodedLength || frame.length < 5 || frame[0] !== message.compressedFlag || frame.readUInt32BE(1) !== frame.length - 5 || message.lengthMatchesEncodedPayload !== true) throw new Error(`${scenario.id}: false request-frame evidence`);
      const payload = message.compressedFlag === 0 ? frame.subarray(5) : singleGzipMember(frame.subarray(5));
      if (!payload.equals(decoded) || (message.compressedFlag === 1) !== (message.gzipMemberValid === true)) throw new Error(`${scenario.id}: request-frame payload mismatch`);
    }
    expected.native.requestMessages.forEach((wanted, index) => {
      const actual = scenario.native.requestMessages[index];
      for (const [key, value] of Object.entries(wanted)) if (!isDeepStrictEqual(actual[key], value)) throw new Error(`${scenario.id}: request message ${index} differs at ${key}`);
    });
    if (scenario.native.reflection.length !== expected.native.reflection.length) throw new Error(`${scenario.id}: reflection request count differs from corpus`);
    for (const reflection of scenario.native.reflection) {
      validateOutboundImplementationHeaders(reflection.requestHeaders, `${scenario.id} reflection`);
      const entries = wireEntries(canonicalBase64(reflection.requestBase64));
      const text = (entry) => { if (!entry || entry.wire !== 2) throw new Error("reflection request string"); return new TextDecoder("utf-8", { fatal: true }).decode(entry.value); };
      const host = text(entries.filter((entry) => entry.number === 1).at(-1));
      const query = entries.filter((entry) => [4, 7].includes(entry.number)).at(-1);
      const kind = query?.number === 4 ? "file-containing-symbol" : query?.number === 7 ? "list-services" : undefined;
      if (host !== reflection.host || kind !== reflection.requestKind || text(query) !== reflection.requestValue) throw new Error(`${scenario.id}: reflection request raw/normalized mismatch`);
      const values = (name) => reflection.requestHeaders.filter((header) => header.name === name).flatMap((header) => header.values);
      const required = [[":method", "POST"], [":authority", reflection.host], [":path", `/grpc.reflection.${reflection.version}.ServerReflection/ServerReflectionInfo`], ["te", "trailers"], ["content-type", "application/grpc+proto"]];
      if (!required.every(([name, value]) => isDeepStrictEqual(values(name), [value])) || values(":scheme").length !== 1 || !["http", "https"].includes(values(":scheme")[0]) || values("grpc-encoding").length || values("grpc-accept-encoding").length) throw new Error(`${scenario.id}: incomplete or compressed reflection request headers`);
    }
    expected.native.reflection.forEach((wanted, index) => {
      const actual = scenario.native.reflection[index];
      const scheme = source.given.source.location.startsWith("grpcs://") || (!source.given.source.location.includes("://") && source.given.configuration?.transport === "tls") ? "https" : "http";
      const requestBytes = Buffer.concat([lengthField(1,wanted.host),lengthField(4,wanted.requestValue)]);
      const closed = {...wanted,requestBase64:requestBytes.toString("base64"),requestHeaders:[{name:":method",values:["POST"]},{name:":scheme",values:[scheme]},{name:":authority",values:[wanted.host]},{name:":path",values:[`/grpc.reflection.${wanted.version}.ServerReflection/ServerReflectionInfo`]},{name:"te",values:["trailers"]},{name:"content-type",values:["application/grpc+proto"]},...(wanted.requestHeaders??[])]};
      const comparable = {...actual, requestHeaders: canonicalHeaderSet(withoutImplementationOwnedUserAgent(actual.requestHeaders))};
      const canonicalClosed = {...closed, requestHeaders: canonicalHeaderSet(closed.requestHeaders)};
      if (!isDeepStrictEqual(comparable, canonicalClosed)) throw new Error(`${scenario.id}: reflection request ${index} is not the exact closed corpus request`);
    });
    const leadingMetadata=[],trailingMetadata=[];
    for(const event of source.given.peer.events){if(!["response-headers","trailers"].includes(event.type))continue;const trailers=event.type==="trailers"||(event.headers||[]).some((header)=>header.name==="grpc-status");(trailers?trailingMetadata:leadingMetadata).push(...inboundMetadata(event.headers,trailers));}
    if(!isDeepStrictEqual(scenario.native.leadingMetadata??[],leadingMetadata)||!isDeepStrictEqual(scenario.native.trailingMetadata??[],trailingMetadata))throw new Error(`${scenario.id}: normalized response metadata is not exactly bound to peer header events`);
    if(expected.native.leadingMetadata!==undefined&&!isDeepStrictEqual(scenario.native.leadingMetadata,expected.native.leadingMetadata))throw new Error(`${scenario.id}: leading metadata differs from corpus`);
    if(expected.native.trailingMetadata!==undefined&&!isDeepStrictEqual(scenario.native.trailingMetadata,expected.native.trailingMetadata))throw new Error(`${scenario.id}: trailing metadata differs from corpus`);
  }
}
function withoutRuntimeAndVariableFrames(value) {
  const copy = structuredClone(value); delete copy.runtime;
  for (const scenario of copy.results) {
    // User-Agent is the only implementation-owned outbound header. Preserve it
    // in each raw transcript, but remove it for cross-runtime equivalence.
    scenario.native.requestHeaders = canonicalHeaderSet(withoutImplementationOwnedUserAgent(scenario.native.requestHeaders));
    for (const reflection of scenario.native.reflection)
      reflection.requestHeaders = canonicalHeaderSet(withoutImplementationOwnedUserAgent(reflection.requestHeaders));
    for (const message of scenario.native.requestMessages) {
      delete message.frameBase64;
      // Protobuf field ordering is deliberately insignificant and deterministic
      // implementations need not choose identical legal encodings.
      delete message.decodedPayloadBase64;
    }
  }
  return copy;
}

const ts = run("node", [tsRunner, corpus]);
const go = run("go", ["run", goRunner, goStrict, corpus], {
  ...process.env,
  GOCACHE: "/private/tmp/openbindings-grpc-go-build-cache"
});
if (ts !== go) {
  console.error(`gRPC runner parity mismatch\nTypeScript: ${ts}\nGo: ${go}`);
  process.exit(1);
}
const result = JSON.parse(ts);
const manifest = JSON.parse(readFileSync(apparatusManifest, "utf8"));
for (const [key, value] of Object.entries(manifest.runnerExpectation)) {
  if (result[key] !== value) {
    console.error(`gRPC runner result ${key}=${JSON.stringify(result[key])}; apparatus requires ${JSON.stringify(value)}`);
    process.exit(1);
  }
}
const corpusSha256 = createHash("sha256").update(readFileSync(corpus)).digest("hex");
if (result.corpusSha256 !== corpusSha256) {
  console.error(`gRPC runner corpus digest ${result.corpusSha256}; actual ${corpusSha256}`);
  process.exit(1);
}
const goStackDir = join(root, "conformance", "binding-specs", "grpc-runners", "go");
const tsStackDir = join(root, "conformance", "binding-specs", "grpc-runners", "typescript");
const sourceCorpus = JSON.parse(readFileSync(corpus, "utf8"));
const mutationCorpus = structuredClone(sourceCorpus);
function stringifyCorpus(value) {
  const copy=structuredClone(value),marks=[];
  const preserve=(id,field,predicate,literal)=>{const input=copy.scenarios.find((scenario)=>scenario.id===id)?.given?.invocation?.input;if(input&&predicate(input[field])){const marker=`__OPENBINDINGS_NUMBER_${marks.length}__`;input[field]=marker;marks.push([marker,literal])}};
  preserve("GRPC-PS-116","precise",(number)=>Object.is(number,-0),"-0");
  preserve("GRPC-PS-117","ratio",(number)=>number===1e-50,"1e-50");
  preserve("GRPC-PS-118","ratio",(number)=>number===1.40129846e-45,"1.40129846e-45");
  preserve("GRPC-PS-119","ratio",(number)=>number===3.4028234663852886e38,"3.4028234663852886e38");
  preserve("GRPC-PS-120","ratio",(number)=>number===1e-50,"1e-50");
  preserve("GRPC-PS-129","ratio",(number)=>number===3.4028235e38,"3.4028235e38");
  preserve("GRPC-PS-133","value",(number)=>number===3.4028236e38,"3.4028236e38");
  let text=JSON.stringify(copy,null,2);
  for(const [marker,literal] of marks)text=text.replace(`"${marker}"`,literal);
  return `${text}\n`;
}
// JSON.parse cannot retain the one deliberate unsafe numeric token. The live
// direct run above proves that carrier; unrelated JSON-round-tripped mutants
// use its equivalent quoted ProtoJSON integer spelling.
{
  const scenario=mutationCorpus.scenarios.find((candidate)=>candidate.id==="GRPC-PS-90");
  scenario.given.invocation.input.big="9223372036854775807";
  scenario.expected[0].native.requestMessages[0].valueJson=scenario.expected[0].native.requestMessages[0].valueJson.replace('"big":9223372036854775807','"big":"9223372036854775807"');
}
const semanticGo = JSON.parse(run("go", ["run", "semantic.go", "protojson_strict.go", corpus], {
  ...process.env,
  GOCACHE: "/private/tmp/openbindings-grpc-go-build-cache"
}, goStackDir));
const semanticTs = JSON.parse(run("node", ["semantic.mjs", corpus], process.env, tsStackDir));
const withoutRuntime = ({ runtime, ...value }) => value;
validateSemanticEvidence(semanticGo, sourceCorpus);
validateSemanticEvidence(semanticTs, sourceCorpus);
if (!isDeepStrictEqual(withoutRuntimeAndVariableFrames(semanticGo), withoutRuntimeAndVariableFrames(semanticTs))) {
  console.error("gRPC semantic Go/TypeScript transcripts differ");
  process.exit(1);
}
// Exercise the one deliberately variable native header without making a
// processor scenario depend on either SDK's product token. The unnormalized
// transcripts retain distinct values; parity removes only User-Agent.
const semanticGoWithUserAgent = structuredClone(semanticGo);
const semanticTsWithUserAgent = structuredClone(semanticTs);
function addImplementationUserAgent(result, value) {
  result.results.find((scenario) => scenario.id === "GRPC-PS-01").native.requestHeaders.push({name:"user-agent",values:[value]});
  result.results.find((scenario) => scenario.id === "GRPC-PS-29").native.reflection[0].requestHeaders.push({name:"user-agent",values:[value]});
}
addImplementationUserAgent(semanticGoWithUserAgent, "grpc-go/controlled-peer");
addImplementationUserAgent(semanticTsWithUserAgent, "grpc-js/controlled-peer");
validateSemanticEvidence(semanticGoWithUserAgent, sourceCorpus);
validateSemanticEvidence(semanticTsWithUserAgent, sourceCorpus);
const retainedUserAgents = (result) => [
  result.results.find((scenario) => scenario.id === "GRPC-PS-01").native.requestHeaders.find((header) => header.name === "user-agent")?.values,
  result.results.find((scenario) => scenario.id === "GRPC-PS-29").native.reflection[0].requestHeaders.find((header) => header.name === "user-agent")?.values,
];
if (!isDeepStrictEqual(retainedUserAgents(semanticGoWithUserAgent), [["grpc-go/controlled-peer"],["grpc-go/controlled-peer"]]) ||
    !isDeepStrictEqual(retainedUserAgents(semanticTsWithUserAgent), [["grpc-js/controlled-peer"],["grpc-js/controlled-peer"]]) ||
    !isDeepStrictEqual(withoutRuntimeAndVariableFrames(semanticGoWithUserAgent), withoutRuntimeAndVariableFrames(semanticTsWithUserAgent)))
  throw new Error("implementation-owned user-agent was not preserved raw and normalized only for parity");
const nonUserAgentDifference = structuredClone(semanticTsWithUserAgent);
nonUserAgentDifference.results.find((scenario) => scenario.id === "GRPC-PS-01").native.requestHeaders
  .find((header) => header.name === "grpc-accept-encoding").values = ["identity"];
if (isDeepStrictEqual(withoutRuntimeAndVariableFrames(semanticGoWithUserAgent), withoutRuntimeAndVariableFrames(nonUserAgentDifference)))
  throw new Error("a governed outbound header was incorrectly normalized as implementation-owned");
const mutations = [
  ["status", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-14").given.peer.events.at(-1).headers[0].values[0] = "0"; }],
  ["cardinality", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-06").given.source.content = value.scenarios.find((scenario) => scenario.id === "GRPC-PS-06").given.source.content.replace("returns (stream Res)", "returns (Res)"); }],
  ["payload", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-06").given.peer.events[2].dataBase64 = "Am5vAAAAAAQKAm9r"; }],
  ["timeout", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-13").given.configuration.timeoutNs = "2"; }],
  ["self-cycle", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-01").given.peer.events[0].after = {native:"output-0"}; }],
  ["post-cancel-peer", (value) => { const scenario=value.scenarios.find((candidate) => candidate.id === "GRPC-PS-17"); scenario.given.peer.events.push({id:"late",after:{action:0},type:"data",dataBase64:"AAAAAAA=",endStream:false}); }],
  ["phase-discriminator", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-01").expected[0].phase = "response"; }],
  ["assertion-equals", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-10").expected[0].assertions[0].equals = "/wrong.Service/Method"; }],
  ["assertion-contains", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-10").expected[0].assertions[1].contains = {name:"te",values:["wrong"]}; }],
  ["assertion-not-contains", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-10").expected[0].assertions[2] = {path:"/native/requestHeaders",notContains:{name:"te",values:["trailers"]}}; }],
  ["assertion-absent", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-10").expected[0].assertions[3].path = "/native/requestHeaders"; }],
  ["data-before-headers", (value) => { const events=value.scenarios.find((scenario) => scenario.id === "GRPC-PS-01").given.peer.events; [events[0],events[1]]=[events[1],events[0]]; }],
  ["trailers-before-headers", (value) => { const events=value.scenarios.find((scenario) => scenario.id === "GRPC-PS-01").given.peer.events; events.unshift(events.pop()); }],
  ["duplicate-response-headers", (value) => { const events=value.scenarios.find((scenario) => scenario.id === "GRPC-PS-01").given.peer.events; events.splice(1,0,{...structuredClone(events[0]),id:"h2"}); }],
  ["data-after-data-end-stream", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-01").given.peer.events[1].endStream=true; }],
  ["data-after-headers-end-stream", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-01").given.peer.events[0].endStream=true; }],
  ["missing-http-status", (value) => { const headers=value.scenarios.find((scenario) => scenario.id === "GRPC-PS-01").given.peer.events[0].headers; headers.splice(headers.findIndex((header)=>header.name===":status"),1); }],
  ["duplicate-http-status", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-01").given.peer.events[0].headers.push({name:":status",values:["201"]}); }],
  ["malformed-http-status", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-01").given.peer.events[0].headers.find((header)=>header.name===":status").values=["2O0"]; }],
  ["reflection-valid-host-contradiction", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-29").given.peer.events[0].validHost="contradiction"; }],
  ["reflection-original-request-contradiction", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-29").given.peer.events[0].originalRequest.host="wrong.example:50051"; }],
  ["reflection-response-kind-contradiction", (value) => { const event=value.scenarios.find((scenario) => scenario.id === "GRPC-PS-29").given.peer.events[0]; event.responseKind="error-response"; event.errorResponse={errorCode:12,errorMessage:"normalized-only"}; }],
  ["reflection-unknown-only-variant", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-29").given.peer.events[0].messageBase64="Cg5zdGFibGUtY2FjaGUtYRIbChFhcGkuZXhhbXBsZTo1MDA1MSIGZGVtby5TmAYB"; }],
  ["response-pseudo-path", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-01").given.peer.events[0].headers.push({name:":path",values:["/wrong"]}); }],
  ["trailer-grpc-encoding", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-01").given.peer.events.at(-1).headers.push({name:"grpc-encoding",values:["gzip"]}); }],
  ["descriptor-packed-input", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-90").given.invocation.input.numbers=[1,3]; }],
  ["descriptor-any-output", (value) => { const scenario=value.scenarios.find((candidate) => candidate.id === "GRPC-PS-90");scenario.expected[0].timeline.find((event)=>event.event==="output").valueJson=scenario.expected[0].timeline.find((event)=>event.event==="output").valueJson.replace('"values":[2,3]','"values":[2,4]'); }],
  ["descriptor-custom-enum-input", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-100").given.invocation.input.state="unknown-value"; }],
  ["response-metadata-invalid-base64", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-90").given.peer.events[0].headers.find((header)=>header.name==="x-response-bin").values=["%%%"]; }],
  ["response-metadata-nonzero-pad-bits", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-90").given.peer.events[0].headers.find((header)=>header.name==="x-response-bin").values=["Zh"]; }],
  ["trailer-metadata-control", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-90").given.peer.events.at(-1).headers.find((header)=>header.name==="x-trailer").values=["bad\u0000value"]; }],
  ["protojson-timestamp-civil-date", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-103").given.invocation.input.value="2026-02-28T00:00:00Z"; }],
  ["protojson-timestamp-leap-date", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-104").given.invocation.input.value="2024-02-29T00:00:00Z"; }],
  ["protojson-timestamp-hour", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-105").given.invocation.input.value="2026-09-05T23:00:00Z"; }],
  ["protojson-field-mask-reversibility", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-106").given.invocation.input.value="goodName"; }],
  ["protojson-float-empty", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-107").given.invocation.input.value=0; }],
  ["protojson-float-whitespace", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-108").given.invocation.input.value=1; }],
  ["protojson-float-hex", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-109").given.invocation.input.value=16; }],
  ["protojson-any-missing-slash", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-110").given.invocation.input.value["@type"]="type.googleapis.com/anyurlhostile.Wire"; }],
  ["protojson-any-empty-final", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-111").given.invocation.input.value["@type"]="https://schemas.example/anyurlhostile.Wire"; }],
  ["protojson-output-timestamp-invariant", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-112").given.peer.events[1].dataBase64="AAAAAAA="; }],
  ["protojson-output-duration-invariant", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-113").given.peer.events[1].dataBase64="AAAAAAA="; }],
  ["protojson-output-field-mask-invariant", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-114").given.peer.events[1].dataBase64="AAAAAAA="; }],
  ["protojson-output-any-invariant", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-115").given.peer.events[1].dataBase64="AAAAAAA="; }],
  ["protojson-negative-zero-wire", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-116").given.invocation.input.precise=0; }],
  ["protojson-float32-underflow-wire", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-117").given.invocation.input.ratio=1e-45; }],
  ["protojson-float32-min-rounding-wire", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-118").given.invocation.input.ratio=2.80259692e-45; }],
  ["protojson-float32-max-rounding-wire", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-119").given.invocation.input.ratio=3e38; }],
  ["protojson-empty-bytes-wire", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-120").given.invocation.input.raw="AA=="; }],
  ["protojson-map-leading-zero-wire", (value) => { const input=value.scenarios.find((scenario) => scenario.id === "GRPC-PS-120").given.invocation.input;input.ints={"01":"x"}; }],
  ["protojson-direct-nullvalue-wire", (value) => { delete value.scenarios.find((scenario) => scenario.id === "GRPC-PS-120").given.invocation.input.nullValue; }],
  ["protojson-map-bool-kind", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-121").given.invocation.input.bools={"true":1}; }],
  ["protojson-map-integer-kind", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-122").given.invocation.input.ints={"1":"x"}; }],
  ["protojson-map-int32-range", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-123").given.invocation.input.ints={"2147483647":"x"}; }],
  ["protojson-map-uint64-range", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-124").given.invocation.input.uints={"18446744073709551615":"x"}; }],
  ["protojson-map-normalized-collision", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-125").given.invocation.input.ints={"1":"a"}; }],
  ["protojson-value-nan-output", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-126").given.peer.events[1].dataBase64="AAAAAAA="; }],
  ["protojson-value-positive-infinity-output", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-127").given.peer.events[1].dataBase64="AAAAAAA="; }],
  ["protojson-value-negative-infinity-output", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-128").given.peer.events[1].dataBase64="AAAAAAA="; }],
  ["protojson-null-json-fds", (value) => { delete value.scenarios.find((scenario) => scenario.id === "GRPC-PS-91").given.invocation.input.count; }],
  ["protojson-null-binary-fds", (value) => { delete value.scenarios.find((scenario) => scenario.id === "GRPC-PS-92").given.invocation.input.count; }],
  ["protojson-null-reflection-v1", (value) => { delete value.scenarios.find((scenario) => scenario.id === "GRPC-PS-93").given.invocation.input.count; }],
  ["protojson-null-reflection-v1alpha", (value) => { delete value.scenarios.find((scenario) => scenario.id === "GRPC-PS-94").given.invocation.input.count; }],
  ["protojson-float32-rounded-boundary-processor", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-129").given.invocation.input.ratio="3.4028236e38"; }],
  ["protojson-unsigned-negative-zero-processor", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-130").given.invocation.input.values={"0":"x"}; }],
  ["protojson-plus-collision-processor", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-131").given.invocation.input.values={"1":"b"}; }],
  ["protojson-unset-value-output-processor", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-132").given.peer.events[1].dataBase64="AAAAAAA="; }],
  ["protojson-float32-overflow-processor", (value) => { value.scenarios.find((scenario) => scenario.id === "GRPC-PS-133").given.invocation.input.value=3.4028235e38; }],
  ["protojson-any-envelope-type-collision", (value) => { const scenario=value.scenarios.find((candidate) => candidate.id === "GRPC-PS-134");scenario.given.source.content=scenario.given.source.content.replace('json_name = "@type"','json_name = "safe"'); }],
  ["protojson-duration-runtime-grammar", (value) => { const s=value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-135");s.given.invocation.input.duration="+1s";s.expected[0].native.requestMessages[0].valueJson=s.expected[0].native.requestMessages[0].valueJson.replace("1.0s","+1s"); }],
  ["protojson-any-output-envelope-collision", (value) => { const scenario=value.scenarios.find((candidate)=>candidate.id==="GRPC-PS-136");scenario.given.source.content=scenario.given.source.content.replace('json_name = "@type"','json_name = "safe"'); }],
  ["protojson-direct-envelope-spelling", (value) => { const scenario=value.scenarios.find((candidate)=>candidate.id==="GRPC-PS-137");scenario.given.source.content=scenario.given.source.content.replace('json_name = "@type"','json_name = "safe"'); }],
  ["protojson-alias-null-duplicate", (value) => { delete value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-138").given.invocation.input.snake_case; }],
  ["protojson-mixed-base64-standard-first", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-139").given.invocation.input.raw="+/8="; }],
  ["protojson-mixed-base64-url-first", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-140").given.invocation.input.raw="+/8="; }],
  ["protojson-wrapper-null-field", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-141").expected[0].native.requestMessages[0].decodedPayloadBase64="CgA="; }],
  ["protojson-value-null-oneof", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-141").expected[0].native.requestMessages[0].decodedPayloadBase64=""; }],
  ["protojson-enum-quoted-int32", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-142").given.invocation.input.state=123; }],
  ["protojson-closed-enum-singular-output", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-143").given.peer.events[1].dataBase64="AAAAAAIIAQ=="; }],
  ["protojson-closed-enum-expanded-output", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-144").given.peer.events[1].dataBase64="AAAAAAIQAQ=="; }],
  ["protojson-closed-enum-packed-output", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-145").given.peer.events[2].dataBase64="AAAAAAMaAQE="; }],
  ["protojson-closed-enum-input-wire", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-146").given.invocation.input={singular:"STATE_READY",expanded:["STATE_READY"],packed:["STATE_READY"]}; }],
  ["protojson-nested-invalid-utf8-output", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-147").given.peer.events[1].dataBase64="AAAAAAUaAwoBeA=="; }],
  ["protojson-any-invalid-utf8-output", (value) => { const event=value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-148").given.peer.events[1],data=Buffer.from(event.dataBase64,"base64");data[data.length-1]=0x78;event.dataBase64=data.toString("base64"); }],
  ["protojson-own-proto-key", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-149").given.invocation.input={}; }],
  ["protojson-closed-enum-composite", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-150").given.peer.events[1].dataBase64="AAAAABMQARABGgIBAQ=="; }],
  ["protojson-surviving-string-overwrite", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-151").given.peer.events[1].dataBase64="AAAAAAYKAXgKAf8="; }],
  ["protojson-wire-varint-bound", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-152").given.peer.events[1].dataBase64="AAAAAAIIAQ=="; }],
  ["protojson-enum-simple-atoi", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-153").given.invocation.input.state=123; }],
  ["protojson-enum-exponent-refusal", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-154").given.invocation.input.state=1; }],
  ["protojson-any-prefix-nonempty", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-155").given.invocation.input.any["@type"]="type.googleapis.com/final9any.Inner"; }],
  ["protojson-cross-field-collision-exclusion", (value) => { const s=value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-156");s.given.source.content=s.given.source.content.replace('json_name=\"other_original\"','json_name=\"chosen_json\"'); }],
  ["protojson-collision-sibling-confinement", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-157").given.binding.selector="final9names.S/BadCall"; }],
  ["protojson-edition-closed-unknown", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-158").given.peer.events[1].dataBase64="AAAAAAQIARAB"; }],
  ["protojson-base64-nonzero-bits", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-159").given.invocation.input.raw="Zg=="; }],
  ["protojson-explicit-json-name-default-camel", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-160").given.invocation.input={customName:"x"}; }],
  ["protojson-edition-enum-integral-number", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-161").given.invocation.input.state="1"; }],
  ["protojson-edition-enum-original-name", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-162").given.invocation.input={enumState:"STATE_READY"}; }],
  ["protojson-value-varint-context", (value) => { value.scenarios.find((scenario)=>scenario.id==="GRPC-PS-163").given.peer.events[1].dataBase64="AAAAABwI/////////////wASDgj///////////8CEgF4"; }],
];
const mutationRoot = mkdtempSync(join(tmpdir(), "openbindings-grpc-runner-mutants-"));
try {
  const structuralMutations = new Set(["data-before-headers","trailers-before-headers","duplicate-response-headers","data-after-data-end-stream","data-after-headers-end-stream","response-pseudo-path","trailer-grpc-encoding","response-metadata-invalid-base64","response-metadata-nonzero-pad-bits","trailer-metadata-control"]);
  for (const [name, mutate] of mutations) {
    const value = structuredClone(mutationCorpus); mutate(value);
    const path = join(mutationRoot, `${name}.json`); writeFileSync(path, stringifyCorpus(value));
    const goMutation = runResult("go", ["run", "semantic.go", "protojson_strict.go", path], {...process.env,GOCACHE:"/private/tmp/openbindings-grpc-go-build-cache"}, goStackDir);
    const tsMutation = runResult("node", ["semantic.mjs", path], process.env, tsStackDir);
    if (goMutation.status === 0 || tsMutation.status === 0) {
      console.error(`${name}: semantic mutation survived; go=${goMutation.status} typescript=${tsMutation.status}`);
      process.exit(1);
    }
    if (structuralMutations.has(name)) {
      const goStructure = runResult("go", ["run", goRunner, goStrict, path], {...process.env,GOCACHE:"/private/tmp/openbindings-grpc-go-build-cache"});
      const tsStructure = runResult("node", [tsRunner, path]);
      if (goStructure.status === 0 || tsStructure.status === 0) {
        console.error(`${name}: structural mutation survived; go=${goStructure.status} typescript=${tsStructure.status}`);
        process.exit(1);
      }
    }
  }
  const swapped = structuredClone(mutationCorpus), first=swapped.scenarios.find((scenario)=>scenario.id==="GRPC-PS-01"), second=swapped.scenarios.find((scenario)=>scenario.id==="GRPC-PS-03");
  [first.id,second.id]=[second.id,first.id];
  const swapPath=join(mutationRoot,"id-swap-accepted.json");writeFileSync(swapPath,stringifyCorpus(swapped));
  const swappedGo=JSON.parse(run("go",["run","semantic.go","protojson_strict.go",swapPath],{...process.env,GOCACHE:"/private/tmp/openbindings-grpc-go-build-cache"},goStackDir));
  const swappedTs=JSON.parse(run("node",["semantic.mjs",swapPath],process.env,tsStackDir));
  validateSemanticEvidence(swappedGo,swapped);validateSemanticEvidence(swappedTs,swapped);
  if(!isDeepStrictEqual(withoutRuntimeAndVariableFrames(swappedGo),withoutRuntimeAndVariableFrames(swappedTs)))throw new Error("scenario-ID swap changed runtime parity");
  const mergeValue=structuredClone(mutationCorpus),mergeEvent=mergeValue.scenarios.find((scenario)=>scenario.id==="GRPC-PS-29").given.peer.events[0],current=Buffer.from(mergeEvent.messageBase64,"base64"),earlyRequest=Buffer.concat([lengthField(1,"wrong.example:1"),lengthField(4,"wrong.S")]),earlyError=Buffer.concat([encodeVarint(8),encodeVarint(12),lengthField(2,"early")]);
  mergeEvent.messageBase64=Buffer.concat([lengthField(1,"earlier-valid-host"),lengthField(2,earlyRequest),lengthField(7,earlyError),current]).toString("base64");
  const mergePath=join(mutationRoot,"protobuf-merge-semantics-accepted.json");writeFileSync(mergePath,stringifyCorpus(mergeValue));
  const mergeGo=runResult("go",["run","semantic.go","protojson_strict.go",mergePath],{...process.env,GOCACHE:"/private/tmp/openbindings-grpc-go-build-cache"},goStackDir),mergeTs=runResult("node",["semantic.mjs",mergePath],process.env,tsStackDir);
  if(mergeGo.status!==0||mergeTs.status!==0)throw new Error(`Protobuf last-singular/last-oneof merge probe failed; go=${mergeGo.status} typescript=${mergeTs.status}`);
  const duplicateRaw=readFileSync(corpus,"utf8").replace(/^\{/,`{"format":"duplicate",`),duplicatePath=join(mutationRoot,"duplicate-key.json");writeFileSync(duplicatePath,duplicateRaw);
  if(runResult("go",["run","semantic.go","protojson_strict.go",duplicatePath],{...process.env,GOCACHE:"/private/tmp/openbindings-grpc-go-build-cache"},goStackDir).status===0||runResult("node",["semantic.mjs",duplicatePath],process.env,tsStackDir).status===0)throw new Error("duplicate JSON key survived semantic parsing");
  const rawCorpus=readFileSync(corpus,"utf8");
  for(const [name,rawMutation] of [
    ["json-trailing-source",`${rawCorpus}\ntrailing`],
    ["json-nested-duplicate",rawCorpus.replace('"clockStartNs": "0"','"clockStartNs": "0", "clockStartNs": "0"')],
    ["json-nbsp-whitespace",rawCorpus.replace('"format": ','"format":\u00a0')],
    ["json-line-separator-whitespace",rawCorpus.replace('"format": ','"format":\u2028')],
    ["json-lone-surrogate-value",rawCorpus.replace('"family": "grpc"','"family": "\\ud800"')],
    ["json-lone-surrogate-key",rawCorpus.replace('"family": "grpc"','"\\ud800": "ignored", "family": "grpc"')],
    ["json-invalid-utf8-source",Buffer.concat([Buffer.from(rawCorpus.replace('"family": "grpc"','"family": "gr'),"utf8"),Buffer.from([0xff]),Buffer.from('pc"','utf8')])],
    ["json-leading-bom",Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(rawCorpus,"utf8")])],
    ["json-outer-duplicate",rawCorpus.replace(/^\{/,`{"format":"duplicate",`)],
  ]){
    const path=join(mutationRoot,`${name}.json`);writeFileSync(path,rawMutation);
    const goSemantic=runResult("go",["run","semantic.go","protojson_strict.go",path],{...process.env,GOCACHE:"/private/tmp/openbindings-grpc-go-build-cache"},goStackDir),tsSemantic=runResult("node",["semantic.mjs",path],process.env,tsStackDir);
    const goStructure=runResult("go",["run",goRunner,goStrict,path],{...process.env,GOCACHE:"/private/tmp/openbindings-grpc-go-build-cache"}),tsStructure=runResult("node",[tsRunner,path]);
    if(goSemantic.status===0||tsSemantic.status===0||goStructure.status===0||tsStructure.status===0)throw new Error(`${name}: invalid JSON lexical mutation survived`);
  }
} finally { rmSync(mutationRoot,{recursive:true,force:true}); }

function expectEvidenceRejection(name, mutate) {
  const value=structuredClone(semanticTs);mutate(value);let rejected=false;try{validateSemanticEvidence(value,sourceCorpus)}catch{rejected=true}if(!rejected)throw new Error(`${name}: evidence mutation survived`);
}
function expectCoordinatedEvidenceRejection(name, mutate) {
  for (const source of [semanticGo,semanticTs]) {
    const value=structuredClone(source);mutate(value);let rejected=false;
    try{validateSemanticEvidence(value,sourceCorpus)}catch{rejected=true}
    if(!rejected)throw new Error(`${name}: coordinated evidence mutation survived`);
  }
}
const firstMessage=(value)=>value.results.find((scenario)=>scenario.native.requestMessages.length).native.requestMessages[0];
expectEvidenceRejection("missing-request-frame",(value)=>{delete firstMessage(value).frameBase64});
expectEvidenceRejection("request-frame-flag",(value)=>{const message=firstMessage(value),frame=Buffer.from(message.frameBase64,"base64");frame[0]=1;message.frameBase64=frame.toString("base64")});
expectEvidenceRejection("request-frame-prefix",(value)=>{const message=firstMessage(value),frame=Buffer.from(message.frameBase64,"base64");frame.writeUInt32BE(frame.readUInt32BE(1)+1,1);message.frameBase64=frame.toString("base64")});
expectEvidenceRejection("request-frame-payload",(value)=>{const message=firstMessage(value),frame=Buffer.from(message.frameBase64,"base64");frame[frame.length-1]^=1;message.frameBase64=frame.toString("base64")});
expectEvidenceRejection("request-frame-false-length-proof",(value)=>{firstMessage(value).lengthMatchesEncodedPayload=false});
expectEvidenceRejection("request-frame-false-gzip-proof",(value)=>{value.results.find((scenario)=>scenario.id==="GRPC-PS-32").native.requestMessages[0].gzipMemberValid=false});
expectEvidenceRejection("request-gzip-trailing-member",(value)=>{const message=value.results.find((scenario)=>scenario.id==="GRPC-PS-32").native.requestMessages[0],frame=Buffer.from(message.frameBase64,"base64"),changed=Buffer.concat([frame,Buffer.from([0])]);changed.writeUInt32BE(changed.length-5,1);message.frameBase64=changed.toString("base64")});
expectEvidenceRejection("request-message-reordered",(value)=>{value.results.find((scenario)=>scenario.id==="GRPC-PS-07").native.requestMessages.reverse()});
expectEvidenceRejection("request-message-ghost",(value)=>{const messages=value.results.find((scenario)=>scenario.id==="GRPC-PS-07").native.requestMessages;messages.push(structuredClone(messages[0]))});
expectEvidenceRejection("request-message-missing",(value)=>{value.results.find((scenario)=>scenario.id==="GRPC-PS-07").native.requestMessages.pop()});
expectEvidenceRejection("reflection-request-raw-host",(value)=>{const reflection=value.results.find((scenario)=>scenario.id==="GRPC-PS-29").native.reflection[0],raw=Buffer.from(reflection.requestBase64,"base64");reflection.requestBase64=Buffer.concat([raw,lengthField(1,"wrong.example:1")]).toString("base64")});
expectEvidenceRejection("reflection-request-raw-query",(value)=>{const reflection=value.results.find((scenario)=>scenario.id==="GRPC-PS-29").native.reflection[0],raw=Buffer.from(reflection.requestBase64,"base64");reflection.requestBase64=Buffer.concat([raw,lengthField(7,"*")]).toString("base64")});
expectEvidenceRejection("reflection-request-route",(value)=>{const reflection=value.results.find((scenario)=>scenario.id==="GRPC-PS-29").native.reflection[0];reflection.requestHeaders.find((header)=>header.name===":path").values=["/wrong"]});
expectEvidenceRejection("reflection-request-authority",(value)=>{const reflection=value.results.find((scenario)=>scenario.id==="GRPC-PS-29").native.reflection[0];reflection.requestHeaders.find((header)=>header.name===":authority").values=["wrong.example:1"]});
expectEvidenceRejection("reflection-request-content-type",(value)=>{const reflection=value.results.find((scenario)=>scenario.id==="GRPC-PS-29").native.reflection[0];reflection.requestHeaders.find((header)=>header.name==="content-type").values=["application/grpc+json"]});
expectEvidenceRejection("reflection-request-te",(value)=>{const reflection=value.results.find((scenario)=>scenario.id==="GRPC-PS-29").native.reflection[0];reflection.requestHeaders.find((header)=>header.name==="te").values=["wrong"]});
expectEvidenceRejection("reflection-request-compression-leak",(value)=>{const reflection=value.results.find((scenario)=>scenario.id==="GRPC-PS-29").native.reflection[0];reflection.requestHeaders.push({name:"grpc-accept-encoding",values:["gzip"]})});
expectEvidenceRejection("reflection-request-reordered",(value)=>{value.results.find((scenario)=>scenario.id==="GRPC-PS-02").native.reflection.reverse()});
expectEvidenceRejection("reflection-request-ghost",(value)=>{const requests=value.results.find((scenario)=>scenario.id==="GRPC-PS-29").native.reflection;requests.push(structuredClone(requests[0]))});
expectEvidenceRejection("reflection-request-header-ghost",(value)=>{value.results.find((scenario)=>scenario.id==="GRPC-PS-29").native.reflection[0].requestHeaders.push({name:"x-ghost",values:["1"]})});
const applicationHeaders=(value)=>value.results.find((scenario)=>scenario.id==="GRPC-PS-01").native.requestHeaders;
const reflectionHeaders=(value)=>value.results.find((scenario)=>scenario.id==="GRPC-PS-29").native.reflection[0].requestHeaders;
expectEvidenceRejection("application-user-agent-duplicate",(value)=>{applicationHeaders(value).push({name:"user-agent",values:["one"]},{name:"user-agent",values:["two"]})});
expectEvidenceRejection("application-user-agent-multiple-values",(value)=>{applicationHeaders(value).push({name:"user-agent",values:["one","two"]})});
expectEvidenceRejection("application-user-agent-empty",(value)=>{applicationHeaders(value).push({name:"user-agent",values:[""]})});
expectEvidenceRejection("application-user-agent-nonascii",(value)=>{applicationHeaders(value).push({name:"user-agent",values:["bad\u0080"]})});
expectEvidenceRejection("application-grpc-message-type",(value)=>{applicationHeaders(value).push({name:"grpc-message-type",values:["demo.Request"]})});
expectEvidenceRejection("reflection-user-agent-duplicate",(value)=>{reflectionHeaders(value).push({name:"user-agent",values:["one"]},{name:"user-agent",values:["two"]})});
expectEvidenceRejection("reflection-user-agent-multiple-values",(value)=>{reflectionHeaders(value).push({name:"user-agent",values:["one","two"]})});
expectEvidenceRejection("reflection-user-agent-empty",(value)=>{reflectionHeaders(value).push({name:"user-agent",values:[""]})});
expectEvidenceRejection("reflection-user-agent-nonascii",(value)=>{reflectionHeaders(value).push({name:"user-agent",values:["bad\u0080"]})});
expectEvidenceRejection("reflection-grpc-message-type",(value)=>{reflectionHeaders(value).push({name:"grpc-message-type",values:["grpc.reflection.v1.ServerReflectionRequest"]})});
expectCoordinatedEvidenceRejection("application-coordinated-header-ghost",(value)=>{applicationHeaders(value).push({name:"x-ghost",values:["same-in-both"]})});
expectCoordinatedEvidenceRejection("application-coordinated-unconfigured-grpc-field",(value)=>{applicationHeaders(value).push({name:"grpc-encoding",values:["gzip"]})});
expectCoordinatedEvidenceRejection("application-coordinated-duplicate-governed-header",(value)=>{applicationHeaders(value).push({name:"content-type",values:["application/grpc+proto"]})});
expectEvidenceRejection("leading-metadata-missing",(value)=>{value.results.find((scenario)=>scenario.id==="GRPC-PS-90").native.leadingMetadata.pop()});
expectEvidenceRejection("leading-metadata-ghost",(value)=>{value.results.find((scenario)=>scenario.id==="GRPC-PS-90").native.leadingMetadata.push({name:"z-ghost",value:"1"})});
expectEvidenceRejection("leading-metadata-reordered",(value)=>{value.results.find((scenario)=>scenario.id==="GRPC-PS-90").native.leadingMetadata.reverse()});
expectEvidenceRejection("leading-metadata-value",(value)=>{value.results.find((scenario)=>scenario.id==="GRPC-PS-90").native.leadingMetadata.find((group)=>group.name==="x-response-bin").value[0]="AA=="});
expectEvidenceRejection("trailing-metadata-missing",(value)=>{value.results.find((scenario)=>scenario.id==="GRPC-PS-90").native.trailingMetadata.pop()});
expectEvidenceRejection("trailing-metadata-reordered",(value)=>{value.results.find((scenario)=>scenario.id==="GRPC-PS-90").native.trailingMetadata.reverse()});
const goStack = JSON.parse(run("go", ["run", "stack.go"], {
  ...process.env,
  GOCACHE: "/private/tmp/openbindings-grpc-go-build-cache"
}, goStackDir));
const tsStack = JSON.parse(run("node", ["stack.mjs"], process.env, tsStackDir));
for (const [value, runtime] of [[goStack, "grpc-go"], [tsStack, "grpc-js"]]) {
  if (value.format !== "openbindings.grpc-real-stack-result@1") {
    console.error(`unexpected real-stack result ${JSON.stringify(value)}`);
    process.exit(1);
  }
  if (value.runtime !== runtime) {
    console.error(`unexpected real-stack runtime ${JSON.stringify(value.runtime)}; expected ${runtime}`);
    process.exit(1);
  }
}
const expectedStack = {
  bidiInputs: 2,
  bidiOutputs: 2,
  clientInputs: 2,
  format: "openbindings.grpc-real-stack-result@1",
  gzipUnary: 1,
  serverOutputs: 2,
  status: "UNIMPLEMENTED",
  tlsFailures: 2,
  tlsUnary: 1,
  unary: 1,
};
if (!isDeepStrictEqual(withoutRuntime(goStack), expectedStack) || !isDeepStrictEqual(withoutRuntime(tsStack), expectedStack)) {
  console.error(`gRPC real-stack parity mismatch\nGo: ${JSON.stringify(goStack)}\nTypeScript: ${JSON.stringify(tsStack)}`);
  process.exit(1);
}
console.log(`gRPC Go/TypeScript portable-apparatus parity: ${ts}`);
console.log(`gRPC Go/TypeScript semantic transcript parity: ${semanticGo.scenarioCount} scenarios; ${mutations.length} adversarial corpus mutations, duplicate-key parsing, merge semantics, ID independence, and normalized-evidence mutations verified`);
console.log(`gRPC Go/TypeScript real-stack parity: ${JSON.stringify(withoutRuntime(goStack))}`);
