import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {mutationVerdict, semantic, selectPrimary, mutateExactlyOnce} from './asyncapi-witness-verdicts.mjs';
import {async31C21Supports} from './verify-binding-specs.mjs';

test('G08: evaluator capability boundary is shared with execution without widening malformed IDs', () => {
  for (const [kind,prefix,first] of [['processor','PS',108],['synthesis','SS',28]]) {
    assert.equal(async31C21Supports(kind,`ASYNC31-${prefix}-${first}`),true);
    for (const id of [`ASYNC31-${prefix}-${first-1}`,'garbage',`ASYNC31-${prefix}-${'9'.repeat(400)}`]) assert.equal(async31C21Supports(kind,id),false);
  }
  assert.throws(()=>async31C21Supports('unknown','ASYNC31-SS-28'),/Unknown/);
});

test('G09: only the named semantic assertion is a kill', async () => {
  const mismatch = id => () => semantic(id,()=>assert.equal('actual','expected'));
  assert.deepEqual(await mutationVerdict(mismatch('wire.request'),'wire.request'),{status:'killed',assertionId:'wire.request'});
  assert.equal((await mutationVerdict(mismatch('wire.disposition'),'wire.request')).status,'unexplained-failure');
  assert.equal((await mutationVerdict(mismatch('wire.request'),'wire.request',value=>value==='unrelated')).status,'unexplained-failure');
  assert.equal((await mutationVerdict(mismatch('wire.request'),'wire.request',value=>value==='actual')).status,'killed');
  assert.equal((await mutationVerdict(()=>assert.fail('untagged'),'wire.request')).status,'unexplained-failure');
  assert.deepEqual(await mutationVerdict(()=>{},'wire.request'),{status:'survived'});
  for (const message of ['compile failed','timeout','blocked listen','missing executable','missing fixture','runner crash']) {
    assert.equal((await mutationVerdict(()=>{throw new Error(message);},'wire.request')).status,'infrastructure-error');
  }
  assert.equal((await mutationVerdict(()=>JSON.parse('{'),'wire.request')).status,'infrastructure-error');
  assert.equal((await mutationVerdict(()=>semantic('wire.request',()=>{throw new TypeError('broken apparatus');}),'wire.request')).status,'infrastructure-error');
});

test('G09: mutation location is exact; a no-op does not imply a kill', () => {
  assert.equal(mutateExactlyOnce('before needle after','needle','needle'),'before needle after');
  assert.throws(()=>mutateExactlyOnce('needle needle','needle','changed'),/cardinality/);
  assert.throws(()=>mutateExactlyOnce('absent','needle','changed'),/cardinality/);
});

test('G08: independently locked selection rejects missing, extra and duplicate identities', () => {
  const scenarios=[{id:'a'},{id:'b'},{id:'unsupported'}], required=['a','b'];
  const supports=id=>id!=='unsupported';
  assert.deepEqual(selectPrimary(scenarios,required,supports).map(s=>s.id),required);
  assert.deepEqual(selectPrimary(scenarios,required,supports,'b').map(s=>s.id),['b']);
  assert.throws(()=>selectPrimary(scenarios.slice(1),required,supports),/inventory mismatch/);
  assert.throws(()=>selectPrimary([...scenarios,{id:'unknown'}],required,supports),/inventory mismatch/);
  assert.throws(()=>selectPrimary([...scenarios,scenarios[0]],required,supports),/duplicate corpus/);
  assert.throws(()=>selectPrimary(scenarios,['a','a'],supports),/duplicate locked/);
  assert.throws(()=>selectPrimary(scenarios,required,id=>id==='b'),/inventory mismatch/);
});

test('G08: locked corpus includes both omitted synthesis cases and the new direct S03 regression', () => {
  const inventory=JSON.parse(readFileSync(new URL('../conformance/asyncapi-family/witness/primary-inventory.json',import.meta.url)));
  assert.equal(inventory.processor.length,133);
  assert.equal(inventory.synthesis.length,48);
  assert.ok(inventory.synthesis.includes('ASYNC31-SS-28'));
  assert.ok(inventory.synthesis.includes('ASYNC31-SS-29'));
  assert.ok(inventory.synthesis.includes('ASYNC31-SS-75'));
});
