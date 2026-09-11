import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {async31C21Observation,async31C21ProcessorViolations,async31C21HeadLocallyValid,citedRuleSectionViolations,async31RuleDefinitionAnalysis} from './verify-binding-specs.mjs';
const corpus = fileURLToPath(new URL('../conformance/binding-specs/',import.meta.url));
const fixture = JSON.parse(readFileSync(join(corpus,'processor/asyncapi-3.1.json')));
const scenario = n => structuredClone(fixture.scenarios.find(s=>s.id===`ASYNC31-PS-${n}`));

test('R3: cross-section trace ownership preserves the primary citation',()=>{
  const spec=readFileSync(new URL('../binding-specs/asyncapi-3.1/openbindings.asyncapi-3.1.md',import.meta.url),'utf8');
  const {definitions}=async31RuleDefinitionAnalysis(spec,'candidate');
  for(const s of fixture.scenarios) assert.deepEqual(citedRuleSectionViolations(s,definitions,s.id),[]);
  const control=scenario(191);
  assert.equal(control.section,'3');
  assert.ok(control.rules.includes('ASYNC31-P-13'));
  const wrong=structuredClone(control);wrong.section='5';
  assert.match(citedRuleSectionViolations(wrong,definitions,wrong.id).join('\n'),/defining section '3'/);
  const unresolved=new Map(definitions);unresolved.delete('ASYNC31-P-13');
  assert.match(citedRuleSectionViolations(control,unresolved,control.id).join('\n'),/no anchored normative definition/);
});

test('R3 review: decisive framing failure precedes acknowledgement and cancellation',()=>{
  const s=scenario(238), head=s.given.peer.script.events[0];
  assert.deepEqual(async31C21ProcessorViolations(s,s.id),[]);
  assert.equal(async31C21HeadLocallyValid(head),false);
  assert.equal(async31C21HeadLocallyValid(head,'HTTP-CONTENT-LENGTH-MISSING'),true,'actual shared framing guard deletion permits wrong acknowledgement');
  const wrong=structuredClone(s);
  wrong.expected[0].timeline.push(...scenario(179).expected[0].timeline.slice(5));
  wrong.expected[0].timeline[5].facts={httpVersion:'1.1',stage:'final',status:200,headers:[]};
  assert.ok(async31C21ProcessorViolations(wrong,wrong.id).length,'incorrect acknowledgement/cancel/close result is rejected');
  const noCancel=structuredClone(s);noCancel.given.invocation={inputPresent:true,input:{}};
  assert.deepEqual(async31C21Observation(noCancel),async31C21Observation(s),'later cancellation does not alter prior decisive error');
  for (const n of [239,240]) {
    const c=scenario(n);assert.deepEqual(async31C21ProcessorViolations(c,c.id),[]);
    assert.equal(async31C21HeadLocallyValid(c.given.peer.script.events[0]),n===239);
  }
  const close=scenario(239);close.given.peer.script.events.pop();
  const open=async31C21Observation(close);
  assert.equal(open.disposition,'complete');assert.equal(open.phase,'completion');assert.equal(open.trace.status,'incomplete');
  for(const scope of ['scenario','alternative']){
    const wrong=structuredClone(s), target=scope==='scenario'?wrong:wrong.expected[0];
    target.rules=target.rules.filter(r=>r!=='ASYNC31-P-13');
    assert.match(async31C21ProcessorViolations(wrong,wrong.id).join('\n'),/lifecycle owner/);
  }
});

test('R3: exact trace status and suffix cannot be removed or relabeled',()=>{
  for (const n of [108,182,186]) {
    const control = scenario(n);
    assert.deepEqual(async31C21ProcessorViolations(control,control.id),[]);
    for (const change of [e=>delete e.trace, e=>e.trace.status='invented', e=>e.trace.status=e.trace.status==='valid'?'invalid':'valid',
      e=>e.trace.afterTerminal=[{kind:'native',name:'acknowledgement',facts:{}}]]) {
      const s=structuredClone(control); change(s.expected[0]);
      assert.ok(async31C21ProcessorViolations(s,s.id).length);
    }
  }
  const s=scenario(182); s.expected[0].trace.afterTerminal=[];
  assert.ok(async31C21ProcessorViolations(s,s.id).length,'clean post-terminal closure remains exact evidence');
});

test('R3: script end is neither peer EOF nor an invocation terminal',()=>{
  const s=scenario(155); s.given.peer.script.events.pop();
  const actual=async31C21Observation(s);
  assert.equal(actual.disposition,'pending');
  assert.equal(actual.trace.status,'incomplete');
  assert.ok(async31C21ProcessorViolations(s,s.id).length,'pending evidence cannot satisfy an expected portable terminal');
});

test('R3: overshooting chunks and later heads cannot rewrite a decisive live prefix',()=>{
  const s=scenario(108);
  const head={kind:'response-head',after:{kind:'native',name:'dispatch',count:1},httpVersion:'1.1',status:400,headers:[{name:'Content-Length',value:'1'}]};
  const body=text=>({kind:'body-chunk',after:{kind:'native',name:'acknowledgement',count:1},dataBase64:Buffer.from(text).toString('base64')});
  for (const status of [200,400]) {
    head.status=status;
    const observations=[];
    for (const events of [[head,body('x!')],[head,body('x'),body('!')]]) {
      s.given.peer.script.events=events;
      observations.push(async31C21Observation(s));
    }
    assert.deepEqual(observations[0],observations[1]);
    assert.equal(observations[0].phase,status===200?'response':'completion');
    assert.equal(observations[0].trace.status,'invalid');
    assert.deepEqual(observations[0].outputs,[]);
  }
});

test('R3: schema confines trace vocabulary and preserves revision-6 isolation',()=>{
  const work=mkdtempSync(join(tmpdir(),'asyncapi-trace-shape-'));
  try {
    const check=f=>{
      const path=join(work,'fixture.json');writeFileSync(path,JSON.stringify(f));
      const run=spawnSync('ajv',['validate','--spec=draft2020','-s',join(corpus,'processor-scenario.schema.json'),'-r',join(corpus,'peer-dialects/asyncapi-http-runtime-2.schema.json'),'-d',path],{encoding:'utf8'});
      if (run.error) throw run.error;
      return {valid:run.status===0,output:run.stdout+run.stderr};
    };
    const base={...fixture,scenarios:[scenario(182)]};
    assert.equal(check(base).valid,true);
    for (const change of [
      t=>t.afterTerminal.push(t.afterTerminal[0]),
      t=>t.afterTerminal[0].facts.stage='response',
      t=>t.afterTerminal[0]={kind:'output',index:0,value:{}},
      t=>t.afterTerminal[0].name='cancellation-propagated',
      t=>t.status='incomplete',
    ]) {
      const f=structuredClone(base);change(f.scenarios[0].expected[0].trace);
      const actual=check(f);assert.equal(actual.valid,false);assert.match(actual.output,/trace/);
    }
    const legacy=JSON.parse(readFileSync(join(corpus,'processor/openapi-3.1.json')));
    legacy.scenarios=legacy.scenarios.slice(0,1);
    assert.equal(check(legacy).valid,true);
    legacy.scenarios[0].expected[0].trace={status:'valid',afterTerminal:[]};
    const actual=check(legacy);assert.equal(actual.valid,false);assert.match(actual.output,/allOf\/0\/else/);
  } finally {rmSync(work,{recursive:true,force:true});}
});
