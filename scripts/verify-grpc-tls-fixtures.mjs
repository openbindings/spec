#!/usr/bin/env node

import { createHash, X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tls from "node:tls";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = join(ROOT, "conformance", "binding-specs", "grpc-fixtures", "tls");
const EXPECTED = {
  "ca.pem": "51ab7fb0ea47fa278756cf55332f2113edf6430af403045e4cac1210d212b10e",
  "server.pem": "8664a0b09a9140f02a9c1c96372144dc284c0437fa5e757e73a3b143e96549cd",
  "server-key.pem": "22c944ba7aa3bbcb60cee404ed41ea161a95fc96a622d6916e2cc10e36b5cb02",
  "client.pem": "ac61ddd2d48c00e538c9bd331efaddb62f0ec649188c64b981313bb03ae0d2b9",
  "client-key.pem": "93a9a4a4fedba527cdf902fd4c903943e07e1cb8ba517c792a7f6a918055ba53",
  "ip-ca.pem": "7c5959f6e0dcbfcd8ca3cd569d6f417a682d8686c094cbad60f1ab884f17467e",
  "ip-server.pem": "ffbef5f42ca3ebdadad6ad5a75e8ae61e62eccb3dc64f3675682e797eccdf1c7",
};

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const bytes = Object.fromEntries(
  Object.entries(EXPECTED).map(([name, digest]) => {
    const value = readFileSync(join(FIXTURES, name));
    if (sha256(value) !== digest) throw new Error(`${name}: fixture digest mismatch`);
    return [name, value];
  })
);

const serverCertificate = new X509Certificate(bytes["server.pem"]);
if (serverCertificate.checkHost("api.example.com") !== "api.example.com") {
  throw new Error("server certificate does not prove api.example.com");
}
if (serverCertificate.checkHost("wrong.example.com") !== undefined) {
  throw new Error("server certificate unexpectedly proves wrong.example.com");
}
const ipServerCertificate = new X509Certificate(bytes["ip-server.pem"]);
if (ipServerCertificate.checkIP("127.0.0.1") !== "127.0.0.1") {
  throw new Error("IP server certificate does not prove 127.0.0.1");
}

async function handshake({ serverRequiresClient = false, clientName = "api.example.com", trust = true, clientIdentity = false, serverCertificateName = "server.pem", clientTrustName = "ca.pem" }) {
  const observations = {};
  let resolveServerHandshake;
  let rejectServerHandshake;
  const serverHandshake = new Promise((resolveHandshake, rejectHandshake) => {
    resolveServerHandshake = resolveHandshake;
    rejectServerHandshake = rejectHandshake;
  });
  const server = tls.createServer(
    {
      key: bytes["server-key.pem"],
      cert: bytes[serverCertificateName],
      ca: bytes["ca.pem"],
      requestCert: serverRequiresClient,
      rejectUnauthorized: serverRequiresClient,
      minVersion: "TLSv1.3",
      maxVersion: "TLSv1.3",
      ALPNProtocols: ["h2"],
      SNICallback(servername, callback) {
        observations.sni = servername;
        callback(null, tls.createSecureContext({ key: bytes["server-key.pem"], cert: bytes[serverCertificateName], ca: bytes["ca.pem"] }));
      },
    },
    (socket) => {
      observations.serverAlpn = socket.alpnProtocol;
      observations.serverAuthorizedClient = socket.authorized;
      observations.serverSni = socket.servername;
      socket.end();
      resolveServerHandshake();
    }
  );
  server.on("tlsClientError", rejectServerHandshake);

  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  try {
    const clientHandshake = new Promise((resolveClient, rejectClient) => {
      const connectOptions = {
        host: "127.0.0.1",
        port: address.port,
        ca: trust ? bytes[clientTrustName] : undefined,
        cert: clientIdentity ? bytes["client.pem"] : undefined,
        key: clientIdentity ? bytes["client-key.pem"] : undefined,
        rejectUnauthorized: true,
        minVersion: "TLSv1.3",
        maxVersion: "TLSv1.3",
        ALPNProtocols: ["h2"],
      };
      if (clientName !== null) connectOptions.servername = clientName;
      const socket = tls.connect(connectOptions);
      socket.once("secureConnect", () => {
        observations.clientAlpn = socket.alpnProtocol;
        observations.clientAuthorizedServer = socket.authorized;
        observations.protocol = socket.getProtocol();
        socket.end();
        resolveClient();
      });
      socket.once("error", rejectClient);
    });
    await Promise.all([clientHandshake, serverHandshake]);
    await new Promise((resolveClose) => server.close(resolveClose));
    return observations;
  } catch (error) {
    await new Promise((resolveClose) => server.close(resolveClose));
    throw error;
  }
}

async function expectFailure(label, options) {
  try {
    await handshake(options);
  } catch {
    return;
  }
  throw new Error(`${label}: handshake unexpectedly succeeded`);
}

const ordinary = await handshake({});
if (
  ordinary.protocol !== "TLSv1.3" ||
  ordinary.clientAlpn !== "h2" ||
  ordinary.serverAlpn !== "h2" ||
  ordinary.sni !== "api.example.com" ||
  ordinary.clientAuthorizedServer !== true
) {
  throw new Error(`ordinary TLS observations differ: ${JSON.stringify(ordinary)}`);
}

await expectFailure("wrong DNS identity", { clientName: "wrong.example.com" });
await expectFailure("untrusted chain", { trust: false });
await expectFailure("required client identity absent", { serverRequiresClient: true });

const mutual = await handshake({ serverRequiresClient: true, clientIdentity: true });
if (mutual.serverAuthorizedClient !== true) {
  throw new Error(`mutual TLS did not authorize the client: ${JSON.stringify(mutual)}`);
}

const ipReference = await handshake({
  clientName: null,
  serverCertificateName: "ip-server.pem",
  clientTrustName: "ip-ca.pem",
});
if (
  ipReference.protocol !== "TLSv1.3" ||
  ipReference.clientAlpn !== "h2" ||
  ipReference.serverSni !== false ||
  Object.hasOwn(ipReference, "sni")
) {
  throw new Error(`IP-reference TLS emitted SNI or lost TLS/ALPN evidence: ${JSON.stringify(ipReference)}`);
}

console.log(
  `gRPC TLS fixtures: TLS 1.3, h2 ALPN, DNS SNI, IP no-SNI, DNS/IP identity, trust, and mutual TLS: OK (${sha256(serverCertificate.raw)})`
);
