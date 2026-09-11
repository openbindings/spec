#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

const here = dirname(fileURLToPath(import.meta.url));
const definition = protoLoader.loadSync(join(here, "stack.proto"), {
  defaults: false,
  enums: String,
  longs: String,
  oneofs: true
});
const loaded = grpc.loadPackageDefinition(definition);
const Stack = loaded.openbindings.test.Stack;

const implementation = {
  Unary(call, callback) {
    assert.deepEqual(call.metadata.get("x-openbindings"), ["stack"]);
    callback(null, { value: "unary" });
  },
  Server(call) {
    call.write({ value: "server-0" });
    call.write({ value: "server-1" });
    call.end();
  },
  Client(call, callback) {
    const values = [];
    call.on("data", (message) => values.push(message.value));
    call.on("end", () => callback(null, { value: values.join("+") }));
  },
  Bidi(call) {
    call.on("data", (message) => call.write({ value: `echo:${message.value}` }));
    call.on("end", () => call.end());
  }
};

const server = new grpc.Server({"grpc.default_compression_algorithm":grpc.compressionAlgorithms.gzip});
server.addService(Stack.service, implementation);
const address = await new Promise((resolve, reject) => server.bindAsync("127.0.0.1:0", grpc.ServerCredentials.createInsecure(), (error, port) => error ? reject(error) : resolve(`127.0.0.1:${port}`)));
const client = new Stack(address, grpc.credentials.createInsecure());
const gzipClient = new Stack(address,grpc.credentials.createInsecure(),{"grpc.default_compression_algorithm":grpc.compressionAlgorithms.gzip});
const metadata = new grpc.Metadata();
metadata.set("x-openbindings", "stack");
let tlsServer;

function unary(method, request, metadataValue = undefined) {
  return new Promise((resolve, reject) => client[method](request, metadataValue, (error, value) => error ? reject(error) : resolve(value)));
}
function collect(call) {
  return new Promise((resolve, reject) => { const values = []; call.on("data", (value) => values.push(value)); call.on("error", reject); call.on("end", () => resolve(values)); });
}

try {
  assert.equal((await unary("Unary", {}, metadata)).value, "unary");
  const gzipMetadata=new grpc.Metadata();gzipMetadata.set("x-openbindings","stack");gzipMetadata.set("x-compress","gzip");
  assert.equal((await new Promise((resolveValue,reject)=>gzipClient.Unary({},gzipMetadata,(error,value)=>error?reject(error):resolveValue(value)))).value,"unary");
  const serverValues = await collect(client.Server({}));
  assert.deepEqual(serverValues.map((value) => value.value), ["server-0", "server-1"]);

  const clientReply = new Promise((resolve, reject) => {
    const call = client.Client((error, value) => error ? reject(error) : resolve(value));
    call.write({ value: "a" }); call.write({ value: "b" }); call.end();
  });
  assert.equal((await clientReply).value, "a+b");

  const bidi = client.Bidi();
  const bidiValuesPromise = collect(bidi);
  bidi.write({ value: "x" }); bidi.write({ value: "y" }); bidi.end();
  const bidiValues = await bidiValuesPromise;
  assert.deepEqual(bidiValues.map((value) => value.value), ["echo:x", "echo:y"]);

  let missingStatus;
  try { await new Promise((resolve, reject) => client.makeUnaryRequest("/openbindings.test.Stack/Missing", (value) => value, (value) => value, Buffer.alloc(0), (error, value) => error ? reject(error) : resolve(value))); }
  catch (error) { missingStatus = error.code; }
  assert.equal(missingStatus, grpc.status.UNIMPLEMENTED);

  const fixtureRoot = resolve(here, "..", "..", "grpc-fixtures", "tls");
  const ca = readFileSync(join(fixtureRoot,"ca.pem"));
  const serverKey = readFileSync(join(fixtureRoot,"server-key.pem"));
  const serverCertificate = readFileSync(join(fixtureRoot,"server.pem"));
  const clientKey = readFileSync(join(fixtureRoot,"client-key.pem"));
  const clientCertificate = readFileSync(join(fixtureRoot,"client.pem"));
  tlsServer = new grpc.Server(); tlsServer.addService(Stack.service,implementation);
  const tlsAddress = await new Promise((resolveAddress,reject) => tlsServer.bindAsync("127.0.0.1:0",grpc.ServerCredentials.createSsl(ca,[{private_key:serverKey,cert_chain:serverCertificate}],true),(error,port)=>error?reject(error):resolveAddress(`127.0.0.1:${port}`)));
  const secureClient = new Stack(tlsAddress,grpc.credentials.createSsl(ca,clientKey,clientCertificate),{"grpc.ssl_target_name_override":"api.example.com","grpc.default_authority":"api.example.com"});
  assert.equal((await new Promise((resolveValue,reject)=>secureClient.Unary({},metadata,(error,value)=>error?reject(error):resolveValue(value)))).value,"unary");
  secureClient.close();
  const expectTlsFailure = async (label,credentials,options={}) => {
    const candidate = new Stack(tlsAddress,credentials,options);
    try { await new Promise((resolveValue,reject)=>candidate.Unary({},metadata,{deadline:Date.now()+1000},(error,value)=>error?reject(error):resolveValue(value))); throw new Error(`${label} unexpectedly succeeded`); }
    catch (error) { if (error.message?.includes("unexpectedly succeeded")) throw error; }
    finally { candidate.close(); }
  };
  await expectTlsFailure("wrong-name",grpc.credentials.createSsl(ca,clientKey,clientCertificate),{"grpc.ssl_target_name_override":"wrong.example.com","grpc.default_authority":"wrong.example.com"});
  await expectTlsFailure("missing-client",grpc.credentials.createSsl(ca),{"grpc.ssl_target_name_override":"api.example.com","grpc.default_authority":"api.example.com"});

  process.stdout.write(`${JSON.stringify({format:"openbindings.grpc-real-stack-result@1",runtime:"grpc-js",unary:1,gzipUnary:1,serverOutputs:serverValues.length,clientInputs:2,bidiInputs:2,bidiOutputs:bidiValues.length,status:"UNIMPLEMENTED",tlsUnary:1,tlsFailures:2})}\n`);
} finally {
  client.close();
  gzipClient.close();
  await new Promise((resolve) => server.tryShutdown(resolve));
  if (tlsServer) await new Promise((resolve) => tlsServer.tryShutdown(resolve));
}
