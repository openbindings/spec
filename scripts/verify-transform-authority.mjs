#!/usr/bin/env node
// Fixture/authority integrity only. Does not execute or certify an evaluator.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const suite=JSON.parse(read('conformance/transforms/language/scenarios.json'));
const ids=new Set();
for(const c of suite.cases) {
  assert(!ids.has(c.id)); ids.add(c.id);
  assert(c.authority.length && c.reason.length);
  for(const name of c.authority) assert(suite.sources[name], 'unknown authority '+name);
  JSON.parse(c.inputJSON);
  if(c.expected.status==='json') JSON.parse(c.expected.json);
  else assert.equal(c.expected.status,'failure');
}
for(const directory of ['agree','known-divergence']) {
  for(const name of readdirSync(resolve(root,'conformance/transforms',directory))) {
    if(!name.endsWith('.json')) continue;
    for(const c of JSON.parse(read('conformance/transforms/'+directory+'/'+name)).cases) {
      assert(!ids.has(c.id), 'duplicate ID '+c.id); ids.add(c.id);
    }
  }
}
const core=read('openbindings.md');
const transform=core.slice(core.indexOf('### 5.5.'),core.indexOf('### 5.6.'));
assert(transform.includes("Evaluation MUST follow the pinned language's syntax and semantics."));
assert(transform.includes('exactly one JSON value'));
assert(transform.includes('A tool MUST NOT extend it further'));
assert(!/binary64|Numerical latitude|significant-digit|implementation-contracts|normative.*tiebreak|clause 7/.test(transform));
assert(!/jsonata-js 2.1.1|clause 7/.test(core));
for(const required of ['LANG-06','LANG-12','LANG-16','LANG-18','LANG-22']) assert(ids.has(required));
console.log(JSON.stringify({status:'PASS',languageCases:suite.cases.length,
  totalUniqueCases:ids.size,evaluatorExecution:false,qualification:'FIXTURE_AND_AUTHORITY_INTEGRITY_ONLY'}));
