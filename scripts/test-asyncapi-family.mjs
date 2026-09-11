#!/usr/bin/env node
// Selective orchestration. Neither the real peer nor the Go witness receives
// an expected outcome. Primary and independent results are compared separately.
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import {createHash} from 'node:crypto';
import { async31C21Observation, async31C21Synthesis,
  async31C21ProcessorViolations, async31C21SynthesisViolations, async31C21Supports } from './verify-binding-specs.mjs';
import {semantic, mutationVerdict, selectPrimary, mutateExactlyOnce} from './asyncapi-witness-verdicts.mjs';
import {completionCases} from '../conformance/asyncapi-family/witness/http-completion-cases.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = JSON.parse(readFileSync(join(root, 'conformance/asyncapi-family/witness/http-cases.json')));
assert.equal(fixture.format, 'openbindings.asyncapi-independent-witness@1');
assert.deepEqual(fixture.cases.map(t=>Number(/^M1-(\d+)-/.exec(t.id)?.[1])).sort((a,b)=>a-b), Array.from({length:45},(_,i)=>i+1), 'wire case deletion, duplicate or identity drift');
const gaps = JSON.parse(readFileSync(join(root,'conformance/asyncapi-family/witness/gap-cases.json')));
assert.equal(gaps.format,'openbindings.asyncapi-gap-wire-cases@1');
assert.deepEqual(gaps.cases.map(t=>t.id),['R2-01-missing-info','R2-02-info-null','R2-03-title-missing','R2-04-version-number','R2-05-root-container','R2-06-invalid-action','R2-07-missing-action','R2-08-valid-send','R2-09-bracketed-ipv4','R2-10-bracketed-ipv4-port']);
assert.equal(completionCases.length,50,'R3 partition count');
assert.equal(new Set(completionCases.map(t=>t.id)).size,50,'R3 identity uniqueness');
assert.deepEqual(completionCases.map(t=>t.id), [
  'R3-204-open','R3-204-late-extra','R3-204-coalesced-extra',
  'R3-200-open','R3-200-late-extra','R3-200-coalesced-extra',
  'R3-205-open','R3-205-late-extra','R3-205-coalesced-extra',
  'R3-304-open','R3-304-late-extra','R3-304-coalesced-extra',
  'R3-400-open','R3-400-late-extra','R3-400-coalesced-extra',
  'R3-second-final-late','R3-second-final-coalesced','R3-split-interim-final','R3-split-non2xx-body',
  'R3-204-late-cancel','R3-304-late-cancel','R3-cancel-interim','R3-cancel-incomplete-final',
  'R3-media-token','R3-media-suffix','R3-media-parameter','R3-media-separator-ows',
  'R3-media-quoted-separators','R3-media-escaped-quote','R3-media-empty-quoted','R3-media-empty-members',
  'R3-media-duplicate','R3-media-bws-before','R3-media-bws-after','R3-media-bws-tab','R3-media-empty-value',
  'R3-media-empty-name','R3-media-missing-equals','R3-media-unclosed-quote','R3-media-dangling-escape',
  'R3-media-quoted-control','R3-media-quoted-del','R3-media-bad-type','R3-media-comma',
  'R3-decisive-error-forbidden-success','R3-decisive-error-101','R3-decisive-error-malformed-head',
  'R3-cancel-missing-length','R3-close-header-completion','R3-cancel-invalid-connection',
], 'R3 locked case identities');
const wireTests = [...fixture.cases,...gaps.cases,...completionCases];
const args = process.argv.slice(2);
const suite = args.find(a => a.startsWith('--suite='))?.slice(8) ?? 'all';
const filter = args.find(a => a.startsWith('--case='))?.slice(7);
assert.ok(['all', 'primary', 'wire', 'synthesis'].includes(suite), 'Unknown suite');
assert.ok(args.every(a => ['--mutants','--clean'].includes(a) || a.startsWith('--suite=') || a.startsWith('--case=')), 'Unknown argument');
assert.ok(!filter || ['primary','wire'].includes(suite), '--case requires an explicitly partial primary or wire suite');
assert.ok(!args.includes('--mutants') || (!filter && suite !== 'primary'), '--mutants requires an unfiltered witness suite');
const lockedInventory = JSON.parse(readFileSync(join(root,'conformance/asyncapi-family/witness/primary-inventory.json')));
assert.equal(lockedInventory.format,'openbindings.asyncapi-witness-primary-inventory@1');
console.log(`Run scope: ${filter ? 'PARTIAL diagnostic (not acceptance evidence)' : `complete selected ${suite} suite (not milestone acceptance)`}.`);

function changed(base, changes = []) {
  const value = structuredClone(base);
  for (const change of changes) {
    const parts = change.path.slice(1).split('/').map(p => p.replaceAll('~1', '/').replaceAll('~0', '~'));
    const name = parts.pop(); let parent = value;
    for (const p of parts) parent = parent[p];
    if (change.remove) delete parent[name]; else parent[name] = structuredClone(change.value);
  }
  return value;
}
function execute(binary, input, onTerminal = () => {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', final;
    const terminals = [];
    const timeout = setTimeout(() => child.kill('SIGKILL'), 7000);
    const shape = value => value && ['refusal','complete','error','cancelled','synthesized','witness-unsupported'].includes(value.disposition)
      && typeof value.phase === 'string' && typeof value.request === 'string'
      && ['outputs','events','statuses'].every(field=>Array.isArray(value[field]));
    child.stdout.on('data', b => {
      stdout += b;
      try {
        while (stdout.includes('\n')) {
          const end = stdout.indexOf('\n'), value = JSON.parse(stdout.slice(0,end));
          stdout = stdout.slice(end+1);
          if (final) throw new Error('Witness record after final report');
          if (value.kind === 'terminal') {
            if (!shape(value.value)) throw new Error('Malformed witness terminal exchange');
            terminals.push(value.value); onTerminal(value.value);
          } else {
            if (!shape(value)) throw new Error('Malformed witness final exchange');
            final = value;
          }
        }
      } catch (error) { child.kill('SIGKILL'); reject(error); }
    }); child.stderr.on('data', b => stderr += b);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.stdin.on('error', reject);
    child.on('close', code => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error(`Witness exit ${code}: ${stderr}`));
      try {
        if (stdout.trim() || !final) throw new Error('Incomplete witness exchange');
        resolve({...final, terminals});
      } catch (e) { reject(e); }
    });
    child.stdin.end(JSON.stringify(input));
  });
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k,canonical(value[k])]));
  return value;
}
function compareSynthesis(actual, expected) {
  // Only these set-valued arrays are unordered. Arrays inside the exact source
  // document retain authored order and are compared with deepStrictEqual.
  for (const field of ['operations', 'bindings']) assert.deepEqual(canonical(actual[field]), canonical(expected[field]), field);
  assert.equal(actual.coverage.exhaustive, expected.coverage.exhaustive);
  assert.equal(actual.coverage.fullyRepresented, expected.coverage.fullyRepresented);
  semantic('synthesis.coverage',()=>assert.deepEqual(canonical(actual.coverage.entries), canonical(expected.coverage.entries)));
  if (expected.document) semantic('synthesis.document',()=>assert.deepEqual(actual.document, expected.document));
}
async function wireCase(binary, test) {
  let connections = 0; const chunks = [], sockets = new Set(), closed = [];
  let responseSocket, terminalObserved = false, peerEnded = false;
  const sent = [];
  const server = net.createServer(socket => {
    connections++; sockets.add(socket); let request = Buffer.alloc(0), replied = false;
    closed.push(new Promise(resolve => socket.once('close', resolve)));
    socket.on('error', () => {});
    socket.on('data', chunk => {
      chunks.push(chunk); request = Buffer.concat([request, chunk]);
      if (!replied && request.includes('\r\n\r\n') && (test.response || test.responseChunks)) {
        replied = true;
        responseSocket = socket;
        // Actual bytes from a local TCP peer, not a reported expected timeline.
        const writes = test.responseChunks || [test.response];
        const send = index => {
          if (index === writes.length) {
            if (!test.holdOpen) {peerEnded = true; socket.end();}
            return;
          }
          sent.push(writes[index]); socket.write(Buffer.from(writes[index],'utf8'));
          setImmediate(()=>send(index+1));
        };
        send(0);
      }
    });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const given = changed(fixture.base, test.changes);
    const actual = await execute(binary, {given, peerAddress: `127.0.0.1:${server.address().port}`}, () => {
      terminalObserved = true;
      if (test.holdOpen) {
        semantic('wire.terminal-before-peer-EOF',()=>assert.equal(peerEnded,false));
        if (!responseSocket) throw new Error('Terminal without dispatched peer request');
        peerEnded = true;
        if (test.afterTerminal) sent.push(test.afterTerminal);
        responseSocket.end(Buffer.from(test.afterTerminal || '','utf8'));
      }
    });
    await Promise.all(closed);
    if (actual.disposition === 'witness-unsupported' || actual.limitation) throw new Error(`Witness capability/apparatus failure: ${actual.limitation}`);
    semantic('wire.terminal-count',()=>assert.equal(actual.terminals.length,1));
    semantic('wire.terminal-immutable',()=>assert.deepEqual(Object.fromEntries(['disposition','phase','outputs','events','statuses','request'].map(k=>[k,actual[k]])),actual.terminals[0]));
    for (const field of ['disposition', 'phase', 'statuses']) semantic(`wire.${field}`,()=>assert.deepEqual(actual[field], test.expected[field], field));
    assert.deepEqual(actual.outputs, []);
    if (test.expected.trace) semantic('wire.trace',()=>assert.equal(actual.trace.status,test.expected.trace));
    if (test.holdOpen) {
      assert.equal(terminalObserved,true,'actual terminal causal barrier reached');
      assert.equal(sent.join(''),(test.response ?? test.responseChunks.join(''))+(test.afterTerminal || ''),'actual peer write sequence');
      if (test.expected.trace === 'invalid') assert.equal(actual.trace.connectionPoisoned,true,'unsolicited bytes forbid reuse');
    }
    semantic('wire.request',()=>assert.equal(actual.request, test.expected.request, 'witness request'));
    assert.equal(Buffer.concat(chunks).toString('utf8'), test.expected.request, 'peer-observed bytes');
    assert.equal(connections, test.expected.connections, 'connection count/no retry');
    if (test.expected.closeCount !== undefined) assert.equal(actual.events.filter(e => e === 'connection-closed').length, test.expected.closeCount);
    if (test.expected.disposition === 'refusal') assert.deepEqual(actual.events, [], 'no activity on refusal');
    if (connections) assert.deepEqual(actual.events.slice(0,3), ['input-accepted', 'connection-attempted', 'connection-opened']);
    const primaryGiven = {...given, peer: {dialect: 'openbindings.asyncapi-http-peer@2', script: {transport: 'cleartext', events: test.peerEvents}}};
    const primary = async31C21Observation({id: test.id, given: primaryGiven});
    assert.equal(primary.disposition, test.expected.disposition, 'primary disposition');
    assert.equal(primary.phase, test.expected.phase, 'primary phase');
    if (test.expected.trace) assert.equal(primary.trace.status,test.expected.trace,'primary trace qualification');
    assert.deepEqual(primary.outputs, []);
    return actual;
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
  }
}

function primarySuite() {
  const executed = [];
  for (const kind of ['processor', 'synthesis']) {
    const corpus = JSON.parse(readFileSync(join(root, `conformance/binding-specs/${kind}/asyncapi-3.1.json`)));
    for (const scenario of selectPrimary(corpus.scenarios,lockedInventory[kind],id=>async31C21Supports(kind,id),filter)) {
      const violations = kind === 'processor' ? async31C21ProcessorViolations(scenario, scenario.id) : async31C21SynthesisViolations(scenario, scenario.id);
      assert.deepEqual(violations, [], scenario.id); executed.push(scenario.id);
    }
  }
  assert.ok(executed.length, 'No primary cases selected');
  console.log(JSON.stringify({suite:'primary',scope:filter?'partial':'complete',executed}));
  console.log(`Primary C21 semantic regression: ${executed.length} selected cases passed (structural/integrity gates remain in full verifier).`);
}

async function synthesisSuite(binary) {
  const input = fixture.base;
  // Literal independently stated generated identities and coverage, not values
  // exported from the primary or the witness under test.
  const op = 'asyncapi31.operation.30006f70', src = 'asyncapi31.source.30';
  const binding = 'asyncapi31.binding.3000232f736572766572732f732f6f7065726174696f6e732f6f70';
  const selector = '#/servers/s/operations/op';
  const expected = {
    operations: [op], bindings: [{operationKey: op, bindingSelector: selector}],
    document: {sources: {[src]: input.source}, operations: {[op]: {input: {type:'object',properties:{},additionalProperties:false}}}, bindings: {[binding]: {operation:op,source:src,selector}}},
    coverage: {exhaustive:true,fullyRepresented:true,entries:[
      {sourceIndex:0,sourceRef:selector,scope:'protocol-cell',status:'represented',operationKey:op,bindingSelector:selector,rule:'ASYNC31-S-08',requirements:[]},
      {sourceIndex:0,sourceRef:'#/channels/c/messages/m',scope:'message-alternative',status:'represented',operationKey:op,bindingSelector:selector,rule:'ASYNC31-S-11',requirements:[]}
    ]}
  };
  compareSynthesis((await execute(binary,{mode:'synthesis',given:input})).synthesis, expected);
  compareSynthesis(async31C21Synthesis({source:input.source}), expected);
  const excluded = changed(input,[{path:'/source/content/operations/op/bindings',remove:true}]);
  const excludedExpected = {operations:[],bindings:[],document:{sources:{[src]:excluded.source},operations:{},bindings:{}},coverage:{exhaustive:true,fullyRepresented:false,entries:[{sourceIndex:0,sourceRef:selector,scope:'protocol-cell',status:'excluded',operationKey:'op',bindingSelector:selector,rule:'ASYNC31-S-03',requirements:[]}]}};
  compareSynthesis((await execute(binary,{mode:'synthesis',given:excluded})).synthesis,excludedExpected);
  compareSynthesis(async31C21Synthesis({source:excluded.source}),excludedExpected);
  const corpus = JSON.parse(readFileSync(join(root, 'conformance/binding-specs/synthesis/asyncapi-3.1.json')));
  const supported = [...Array.from({length:15},(_,i)=>i+30),46,47,48,60,61,70,75];
  for (const number of supported) {
    const scenario = corpus.scenarios.find(s=>s.id===`ASYNC31-SS-${number}`);
    assert.ok(scenario, `Missing registered witness scenario SS-${number}`);
    const actual = await execute(binary,{mode:'synthesis',given:{source:scenario.source}});
    assert.notEqual(actual.disposition,'witness-unsupported',`${scenario.id}: ${actual.limitation}`);
    compareSynthesis(actual.synthesis,scenario.expected);
    // Corpus assertions state exact source, input/output absence and bindings;
    // use them independently, not just primary/witness agreement.
    for (const assertion of scenario.expected.assertions ?? []) {
      if (assertion.surface !== 'document') continue;
      const parts = assertion.path.slice(1).split('/').map(p=>p.replaceAll('~1','/').replaceAll('~0','~'));
      let found = actual.synthesis.document;
      for (const p of parts) found=found?.[p];
      if (assertion.absent) assert.equal(found,undefined,scenario.id);
      else if (Object.hasOwn(assertion,'equals')) assert.deepEqual(found,assertion.equals,scenario.id);
      else throw new Error(`${scenario.id}: unsupported document assertion`);
    }
    compareSynthesis(actual.synthesis,async31C21Synthesis(scenario));
  }
  console.log(`Independent synthesis: literal represented/excluded pair plus ${supported.length} frozen corpus cases passed, including aliases, membership, Unicode keys and mixed profiles.`);
}

async function ownerSynthesis(binary) {
  const source=structuredClone(fixture.base.source);
  source.content.operations.bad={action:'invalid',channel:{$ref:'#/channels/c'},bindings:{http:{}}};
  const op='asyncapi31.operation.30006f70', selector='#/servers/s/operations/op';
  const expected={operations:[op],bindings:[{operationKey:op,bindingSelector:selector}],
    document:{sources:{'asyncapi31.source.30':source},operations:{[op]:{input:{type:'object',properties:{},additionalProperties:false}}},bindings:{'asyncapi31.binding.3000232f736572766572732f732f6f7065726174696f6e732f6f70':{operation:op,source:'asyncapi31.source.30',selector}}},
    coverage:{exhaustive:true,fullyRepresented:false,entries:[
      {sourceIndex:0,sourceRef:'#/operations/bad',scope:'target',status:'invalid',operationKey:'bad',rule:'ASYNC31-S-02',requirements:[]},
      {sourceIndex:0,sourceRef:selector,scope:'protocol-cell',status:'represented',operationKey:op,bindingSelector:selector,rule:'ASYNC31-S-08',requirements:[]},
      {sourceIndex:0,sourceRef:'#/channels/c/messages/m',scope:'message-alternative',status:'represented',operationKey:op,bindingSelector:selector,rule:'ASYNC31-S-11',requirements:[]}
    ]}};
  compareSynthesis((await execute(binary,{mode:'synthesis',given:{source}})).synthesis,expected);
  compareSynthesis(async31C21Synthesis({source}),expected);
}

const work = mkdtempSync(join(tmpdir(), 'asyncapi-witness-'));
try {
  const qualification = spawnSync(process.execPath,['--test',join(root,'scripts/test-asyncapi-witness-verdicts.mjs'),join(root,'scripts/test-asyncapi-http-completion.mjs')],{encoding:'utf8'});
  assert.equal(qualification.status,0,qualification.stdout+qualification.stderr);
  console.log('Runner qualification: inventory and mutation-verdict positive/negative controls passed.');
  if (suite === 'primary' || suite === 'all') primarySuite();
  if (suite !== 'primary') {
    const dir = join(root, 'conformance/asyncapi-family/witness/go');
    const binary = join(work, 'witness');
    const env = {...process.env, GOTOOLCHAIN:'local', GOCACHE:args.includes('--clean') ? join(work,'go-cache') : join(tmpdir(),'asyncapi-witness-go-cache')};
    const build = spawnSync('go',['build','-trimpath','-o',binary,'.'],{cwd:dir,env,encoding:'utf8'});
    assert.equal(build.status,0,build.stderr);
    const unit = spawnSync('go',['test','-count=1','./...'],{cwd:dir,env,encoding:'utf8'});
    assert.equal(unit.status,0,unit.stdout+unit.stderr);
    console.log(`Independent runtime: ${spawnSync('go',['version'],{encoding:'utf8'}).stdout.trim()}; no external Go dependencies.`);
    if (suite === 'all' || suite === 'wire') {
      const selected = wireTests.filter(t => !filter || t.id.includes(filter));
      assert.ok(selected.length, 'No wire cases selected');
      for (const test of selected) {try {await wireCase(binary,test);} catch(e) {throw new Error(`${test.id}: ${e.message}`,{cause:e});}}
      console.log(JSON.stringify({suite:'wire',scope:filter?'partial':'complete',executed:selected.map(t=>t.id)}));
      console.log(`Independent real-TCP witness: ${selected.length} cases passed against literal expectations and primary outcomes.`);
    }
    if (suite === 'all' || suite === 'synthesis') { await synthesisSuite(binary); await ownerSynthesis(binary); }
    if (args.includes('--mutants')) {
      const original = readFileSync(join(dir,'main.go'),'utf8');
      const mutations = [
        ['method', 'wire := "POST "', 'wire := "GET "', 'M1-01','wire.request',['ASYNC31-P-10']],
        ['input', 'len(values) != 1 || !empty(values[0])', 'len(values) != 1', 'M1-15','wire.disposition',['ASYNC31-P-09']],
        ['success-body', 'resp.StatusCode < 300 && length != 0', 'false', 'M1-27','wire.disposition',['ASYNC31-P-11','ASYNC31-P-12']],
        ['synthesis-input', '"additionalProperties": false', '"additionalProperties": true', 'synthesis','synthesis.document',['ASYNC31-S-09']],
        ['load-envelope','if !loadEnvelope(obj(source["content"]))','if false','R2-01','wire.disposition',['ASYNC31-P-02']],
        ['invalid-action-classification','op["action"] != "send" && op["action"] != "receive"','false','R2-06','wire.phase',['ASYNC31-P-04']],
        ['bracketed-ipv4','strings.Contains(host, ":") && net.ParseIP(host) != nil','net.ParseIP(host) != nil','R2-09','wire.disposition',['ASYNC31-P-08']],
        ['invalid-operation-owner','invalidOwner: "#" + opResolved.pointer','invalidOwner: "#/operations/wrong"','owner-synthesis','synthesis.coverage',['ASYNC31-S-02']],
        ['media-grammar','!mediaGrammar.MatchString(value)','false','R3-media-bws-before','wire.disposition',['ASYNC31-P-11']],
        ['304-metadata-as-body','if status == 304 {\n\t\treturn 0, true','if status == 304 {\n\t\treturn length, true','R3-304-coalesced-extra','wire.trace',['ASYNC31-P-11','ASYNC31-P-13']],
        ['premature-framing','io.CopyN(io.Discard, reader, length)','io.CopyN(io.Discard, reader, 0)','R3-split-non2xx-body','wire.trace',['ASYNC31-P-11','ASYNC31-P-13']],
        ['missing-length-cancel','return length, length >= 0','return 0, true','R3-cancel-missing-length','wire.disposition',['ASYNC31-P-11','ASYNC31-P-13']],
        ['connection-field-cancel','!strings.EqualFold(connection[0], "close")','false','R3-cancel-invalid-connection','wire.disposition',['ASYNC31-P-11','ASYNC31-P-13']],
        ['terminal-rewrite','r.Trace = object{"status": "invalid", "connectionPoisoned": true}','r.Phase = "response"; r.Trace = object{"status": "invalid", "connectionPoisoned": true}','R3-204-late-extra','wire.terminal-immutable',['ASYNC31-P-13']]
      ];
      const sha = bytes=>createHash('sha256').update(bytes).digest('hex');
      const buildMutant = (source,binary) => {
        const built=spawnSync('go',['build','-trimpath','-o',binary,source],{cwd:dir,env,encoding:'utf8'});
        if (built.status!==0) throw new Error(`Mutant compilation infrastructure-error: ${built.error?.message ?? built.stderr}`);
      };
      for (const [name,from,to,testID,assertionId,rules] of mutations) {
        const run = candidate => testID === 'synthesis' ? synthesisSuite(candidate) : testID === 'owner-synthesis' ? ownerSynthesis(candidate) : wireCase(candidate,wireTests.find(t=>t.id.startsWith(testID)));
        await run(binary); // Same-case control must pass before a kill is admissible.
        const changed=mutateExactlyOnce(original,from,to);
        writeFileSync(join(work,'mutant.go'),changed);
        const mutant = join(work,`mutant-${name}`);
        const matchesActual = actual => testID === 'synthesis'
          ? actual?.operations?.['asyncapi31.operation.30006f70']?.input?.additionalProperties === true
          : testID === 'owner-synthesis' ? actual?.some(e=>e.sourceRef==='#/operations/wrong' && e.rule==='ASYNC31-S-02')
          : name === 'terminal-rewrite' ? actual?.phase === 'response'
          : actual === (name === 'premature-framing' ? 'invalid' : name === '304-metadata-as-body' ? 'valid' : name === 'method' ? 'GET /api/events HTTP/1.1\r\nHost: example.test\r\n\r\n'
            : name === 'invalid-action-classification' ? 'pre-dispatch' : 'complete');
        const verdict = await mutationVerdict(()=>{buildMutant(join(work,'mutant.go'),mutant);return run(mutant);},assertionId,matchesActual);
        console.log(JSON.stringify({mutant:name,sourcePath:'conformance/asyncapi-family/witness/go/main.go',sourceSha256:sha(original),match:{text:from,byteOffset:Buffer.byteLength(original.slice(0,original.indexOf(from))),cardinality:1},replacement:to,mutatedSourceSha256:sha(changed),rules,case:testID,expectedAssertionId:assertionId,...verdict}));
        assert.equal(verdict.status,'killed',`${name}: ${JSON.stringify(verdict)}`);
      }
      const noOp = await mutationVerdict(()=>wireCase(binary,fixture.cases[0]),'wire.request');
      assert.equal(noOp.status,'survived','unchanged binary must survive');
      const missing = await mutationVerdict(()=>wireCase(join(work,'nonexistent-witness'),fixture.cases[0]),'wire.request');
      assert.equal(missing.status,'infrastructure-error','missing executable is not a kill');
      writeFileSync(join(work,'invalid-go.go'),'package main\nfunc invalid(\n');
      const invalidBuild=await mutationVerdict(()=>buildMutant(join(work,'invalid-go.go'),join(work,'invalid-go')),'wire.request');
      console.log(JSON.stringify({qualification:'actual-invalid-go-build',...invalidBuild}));
      assert.equal(invalidBuild.status,'infrastructure-error','actual compile failure is not a kill');
      console.log(`Independent semantic mutations: ${mutations.length} killed at registered assertions with the expected wrong values; unchanged binary survived; missing executable and actual compile failure classified as infrastructure errors.`);
    }
  }
} finally { rmSync(work,{recursive:true,force:true}); }
