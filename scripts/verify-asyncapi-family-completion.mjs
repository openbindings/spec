#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {dimensions,validateEvidence,requireWholeFamily,contractDigest,sha256,isSubjectInput,canonicalRecord} from './asyncapi-completion-evidence.mjs';

// Semantic projection of the existing 120-cell revision-one contract. This
// includes rules, authority, exclusions and criteria, not only graph edges.
export const CONTRACT_DIGEST = 'a752e1db4789bb3bb106734acf33686f8c37571e21d4bd143903c0deb66bd2b2';

export function validate(register, context) {
  assert.equal(register.format, 'openbindings.asyncapi-family-completion@1');
  assert.ok(['execution-in-progress','family-ready'].includes(register.status),'unknown completion status');
  const states = ['planned', 'authority-ready', 'specified', 'implemented', 'verified', 'accepted'];
  assert.equal(contractDigest(register),CONTRACT_DIGEST,'revision-one semantic contract drift');
  const ids = new Set(register.entries.map(e => e.id));
  assert.equal(ids.size, register.entries.length, 'duplicate feature identity');
  // Freeze the denominator and dependency/applicability contract, independently
  // of mutable progress/evidence. A scope change requires deliberate re-locking.
  assert.equal(createHash('sha256').update(JSON.stringify(register.entries.map(e=>[e.id,e.edition,e.profile,e.disposition,e.dependencies]).sort())).digest('hex'),
    'c21d1c994ebfeaa6db97d14109f9e1b667a498ab5bc90ab04ede1597c1fa9472', 'revision-one behavior contract drift');
  for (const e of register.entries) {
    assert.ok(['3.1', '3.0', '2.6'].includes(e.edition), e.id);
    assert.ok(['required', 'excluded'].includes(e.disposition), `${e.id}: unresolved admission`);
    assert.ok(states.includes(e.state), e.id);
    for (const field of ['owner', 'title', 'acceptanceCriterion']) assert.ok(e[field]?.length, `${e.id}: ${field}`);
    assert.ok(e.authority.length, `${e.id}: authority`);
    for (const d of e.dependencies) assert.ok(ids.has(d) && d !== e.id, `${e.id}: missing dependency ${d}`);
    assert.ok(Array.isArray(e.findings) && Array.isArray(e.acceptedHistory));
    for (const dimension of dimensions) {
      assert.ok(Array.isArray(e.evidence[dimension]), `${e.id}: ${dimension}`);
    }
    if (e.disposition === 'excluded') for (const key of ['rationale', 'owner', 'propagation', 'observable', 'reopen']) assert.ok(e.exclusion?.[key]?.length, `${e.id}: exclusion ${key}`);
    if (e.state === 'accepted') {
      assert.equal(e.findings.length, 0, `${e.id}: unresolved finding`);
      assert.ok(e.acceptedHistory.length, `${e.id}: no frozen acceptance`);
      for (const d of e.dependencies) assert.equal(register.entries.find(x => x.id === d).state, 'accepted', `${e.id}: dependency not accepted`);
    }
  }
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    assert.ok(!visiting.has(id), `dependency cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const d of register.entries.find(e => e.id === id).dependencies) visit(d);
    visiting.delete(id); visited.add(id);
  }
  for (const id of ids) visit(id);
  if(context) {
    assert.equal(context.contractDigest,CONTRACT_DIGEST,'trusted context contract drift');
    validateEvidence(register,context);
  } else {
    // Without an externally selected prior anchor this is progress inspection,
    // never current acceptance or proof of append-only history.
    assert.ok(register.entries.every(e=>e.state!=='accepted' && e.acceptedHistory.length===0),
      'history.trust: acceptance/history validation requires a trusted prior checkpoint');
  }
  if(register.status==='family-ready') {
    assert.ok(context,'history.trust: readiness requires trusted prior checkpoint');
    requireWholeFamily(register);
  }
}

export function render(register) {
  const lines = ['# AsyncAPI family completion register', '', 'Generated from `completion.json`; counts measure accepted behavior cells, not tests.', '',
    'The accepted historical C21 slice remains a regression baseline. No cell below is promoted merely because that baseline passed. MQTT5 and Kafka have recorded exclusion dispositions whose evidence and review are still open.', '',
    '| Edition | Profile | Accepted / required | Exclusions awaiting acceptance |', '| --- | --- | --- | --- |'];
  for (const edition of ['3.1', '3.0', '2.6']) for (const profile of ['common', 'http', 'websocket', 'mqtt311', 'mqtt5', 'kafka']) {
    const entries = register.entries.filter(e => e.edition === edition && e.profile === profile);
    const required = entries.filter(e => e.disposition === 'required');
    lines.push(`| ${edition} | ${profile} | ${required.filter(e => e.state === 'accepted').length} / ${required.length} | ${entries.filter(e => e.disposition === 'excluded' && e.state !== 'accepted').length} |`);
  }
  lines.push('', '| Behavior ID | Milestone | Disposition | State | Acceptance criterion |', '| --- | --- | --- | --- | --- |');
  for (const e of register.entries) lines.push(`| ${e.id} | ${e.milestone} | ${e.disposition} | ${e.state} | ${e.acceptanceCriterion.replaceAll('|', '\\|')} |`);
  return lines.join('\n') + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = new URL('../conformance/asyncapi-family/', import.meta.url);
  const register = JSON.parse(readFileSync(new URL('completion.json', base), 'utf8'));
  const args=process.argv.slice(2), roots={spec:fileURLToPath(new URL('../',import.meta.url))};
  let priorPath, priorHash;
  for(const arg of args) {
    if(arg==='--print' || arg==='--ready')continue;
    if(arg.startsWith('--trusted-history=')) {assert.equal(priorPath,undefined,'duplicate history argument');priorPath=arg.slice(18);}
    else if(arg.startsWith('--trusted-history-sha256=')) {assert.equal(priorHash,undefined,'duplicate history hash');priorHash=arg.slice(25);}
    else if(arg.startsWith('--repository=')) {
      const value=arg.slice(13), i=value.indexOf('='), id=value.slice(0,i), path=value.slice(i+1);
      assert.ok(i>0 && /^[a-z][a-z0-9-]*$/.test(id) && path && !Object.hasOwn(roots,id) && !['constructor','prototype'].includes(id),'unique repository=id=path required');roots[id]=resolve(path);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  assert.equal(Boolean(priorPath),Boolean(priorHash),'trusted history requires path and externally supplied SHA-256');
  let context;
  if(priorPath) {
    const bytes=readFileSync(resolve(priorPath));assert.equal(sha256(bytes),priorHash,'trusted history digest mismatch');
    const prior=JSON.parse(bytes);assert.deepEqual(bytes,Buffer.from(canonicalRecord(prior)),'history.encoding: canonical UTF-8 checkpoint required');
    assert.equal(prior.format,'openbindings.asyncapi-acceptance-history@1');
    assert.deepEqual(Object.keys(prior).sort(),['contract','format','histories']);assert.equal(prior.contract,CONTRACT_DIGEST);
    const revisions=Object.fromEntries(Object.entries(roots).map(([id,path])=>[id,execFileSync('git',['-C',path,'rev-parse','HEAD'],{encoding:'utf8'}).trim()]));
    const inventories=Object.fromEntries(Object.entries(roots).map(([id,path])=>[id,[...new Set(execFileSync('git',['-C',path,'ls-files','-z','--cached','--others','--exclude-standard'],{encoding:'utf8'}).split('\0').filter(Boolean).filter(isSubjectInput))].sort()]));
    context={roots,revisions,inventories,contractDigest:CONTRACT_DIGEST,trustedHistory:prior.histories};
  }
  validate(register,context);
  if(args.includes('--ready')) {assert.ok(context,'history.trust: readiness requires trusted prior checkpoint');requireWholeFamily(register);}
  if (process.argv.includes('--print')) process.stdout.write(render(register));
  else {
    assert.equal(readFileSync(new URL('COMPLETION.md', base), 'utf8'), render(register), 'generated completion table drift');
    for (const mutation of [r => r.entries.push(r.entries[0]), r => r.entries.pop(), r => r.entries[0].state = 'accepted', r => r.entries[0].dependencies.push('missing'), r => r.entries[0].disposition = 'conditional']) {
      const mutant = structuredClone(register); mutation(mutant); assert.throws(() => validate(mutant));
    }
    console.log(`Completion register: ${register.entries.length} cells; contract/progress checks passed. ${context?'Typed evidence and trusted-history checks passed.':'Progress inspection only: no acceptance/history qualification without an external prior checkpoint.'}`);
  }
}
