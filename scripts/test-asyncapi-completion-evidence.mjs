import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,mkdtempSync,mkdirSync,rmSync,chmodSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dimensions,layers,checkerPaths,sha256,contractDigest,emptyHistory,validateEvidence,requireWholeFamily,isSubjectInput,canonicalRecord} from './asyncapi-completion-evidence.mjs';
import {validate} from './verify-asyncapi-family-completion.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const live=JSON.parse(readFileSync(join(root,'conformance/asyncapi-family/completion.json')));
const format=type=>`openbindings.asyncapi-acceptance-${type}@1`;
const encode=canonicalRecord;
const ruleFor=d=>`ASYNC31-${{definition:'D',synthesis:'S'}[d]||'P'}-01`;

// Synthetic documents, implementations, observations, authors and reviews.
// Never copy these accepted states or records into the real completion register.
// inventedFuture creates adversarial future specifications ONLY for refusal
// controls. They establish no edition identity, semantics or format authority.
function packet(inventedFuture=false) {
  const dir=mkdtempSync(join(tmpdir(),'asyncapi-r4-'));
  const reg=structuredClone(live);
  if(!inventedFuture)reg.entries=reg.entries.filter(e=>['AA31-source-carriage','AA31-http-lifecycle','AA31-mqtt5-exclusion','AA31-readiness'].includes(e.id));
  // Resolve actual exclusion ID without adding a new feature inventory.
  if(!inventedFuture && !reg.entries.some(e=>e.disposition==='excluded'))reg.entries.splice(2,0,structuredClone(live.entries.find(e=>e.edition==='3.1' && e.profile==='mqtt5')));
  const featureIds=reg.entries.map(e=>e.id);
  for(const e of reg.entries) {
    e.dependencies=e.id===featureIds[0]?[]:[featureIds[0]];
    e.state='accepted';e.findings=[];e.acceptedHistory=[];
    const pre={"3.1":"ASYNC31","3.0":"ASYNC30","2.6":"ASYNC26"}[e.edition];
    e.normativeRules=e.milestone==='M12'?[]:[`${pre}-D-01`,`${pre}-P-01`,`${pre}-S-01`];
  }
  const context={roots:{spec:dir,interfaces:join(dir,'interfaces')},revisions:{spec:'synthetic-test-only-spec',interfaces:'synthetic-test-only-interfaces'},contractDigest:contractDigest(reg),trustedHistory:emptyHistory(reg)};
  const artifacts=[];
  function file(path,bytes,roles,repository='spec') {
    const full=join(context.roots[repository],path);mkdirSync(dirname(full),{recursive:true});writeFileSync(full,bytes);chmodSync(full,0o644);
    artifacts.push({repository,path,type:'file',mode:0o644,sha256:sha256(bytes),roles});return `${repository}:${path}`;
  }
  const normative={};
  for(const edition of new Set(reg.entries.map(e=>e.edition))) {
    const pre={"3.1":"ASYNC31","3.0":"ASYNC30","2.6":"ASYNC26"}[edition];
    normative[edition]=file(`binding-specs/asyncapi-${edition}/openbindings.asyncapi-${edition}.md`,
      '# Synthetic R4 test authority, NOT a binding specification\n'+['D','P','S'].map(d=>`**[convention]** **${pre}-${d}-01** — Synthetic equality obligation.\n`).join(''),['normative']);
  }
  const core=file('openbindings.md','# Synthetic Core test input\n',['normative']);
  const authority=file('authority.txt','Synthetic pinned upstream input\n',['authority']);
  const policy=file('policy.txt','Synthetic governing policy\n',['policy']);
  const iface=file('invoke.json',encode({synthetic:true}),['interface'],'interfaces');
  const implementation=file('implementation.mjs','// Synthetic test-only implementation\nexport const value = 42;\n',['implementation']);
  const runner=file('runner.mjs','// Synthetic test-only runner\n',['runner']);
  file('dependencies.lock','Synthetic dependency lock\n',['dependency','build']);
  for(const path of checkerPaths)file(path,readFileSync(join(root,path)),['checker']);
  const cases=[],fixtures=[],dims=[];
  for(const e of reg.entries)for(const dimension of dimensions) {
    const applicable=e.milestone!=='M12' || !['definition','processor','synthesis'].includes(dimension);
    const id=`R4-TEST-${e.id}-${dimension}`;
    dims.push({feature:e.id,dimension,applicable,reason:applicable?'Synthetic applicable control.':'Readiness has no separate portable D/P/S behavior; reviewed through integration.',cases:applicable?[id]:[]});
    if(!applicable)continue;
    const rules=e.normativeRules.length?[ruleFor(dimension).replace('ASYNC31',{"3.1":"ASYNC31","3.0":"ASYNC30","2.6":"ASYNC26"}[e.edition])]:[];
    const pointer=`/scenarios/${fixtures.length}`;
    fixtures.push({id,rules,expected:{value:42}});
    cases.push({id,scenario:id,feature:e.id,dimension,rules,fixture:'spec:fixtures.json',pointer,
      capability:{artifact:'spec:capability.json',pointer:'/cases'},implementation,runner,assertions:[{id:'value',expected:'/expected/value'}]});
  }
  file('fixtures.json',encode({scenarios:fixtures}),['fixture']);file('capability.json',encode({cases:cases.map(c=>c.id)}),['capability']);
  // Independently walk actual files, not the subject's artifact selection.
  function walk(base,prefix='') {
    return readdirSync(join(base,prefix),{withFileTypes:true}).flatMap(e=>{
      const path=prefix?`${prefix}/${e.name}`:e.name;
      if(base===dir && path==='interfaces')return [];
      return e.isDirectory()?walk(base,path):isSubjectInput(path)?[path]:[];
    });
  }
  context.inventories=Object.fromEntries(Object.entries(context.roots).map(([id,base])=>[id,walk(base).sort()]));
  const allCaseIds=cases.map(c=>c.id);
  const obligations=layers.map(layer=>({id:`alignment-${layer}`,layer,applicable:true,reason:'Synthetic explicit applicable control.',source:{core,binding:normative[reg.entries[0].edition],interfaces:iface,architecture:implementation,project:policy}[layer],clause:'Synthetic clause 1',cases:[allCaseIds[0]]}));
  if(reg.entries.some(e=>e.milestone==='M12'))for(let i=1;i<=7;i++)obligations.push({id:`core-item-${i}`,layer:'core',applicable:true,reason:'Synthetic family-wide closure control.',source:core,clause:`OBI-B-02 item ${i}`,cases:[allCaseIds[0]]});
  const subject={format:format('subject'),contract:context.contractDigest,features:featureIds,authors:['synthetic-author'],repositories:Object.entries(context.revisions).map(([id,revision])=>({id,revision})),artifacts,dimensions:dims,obligations,
    decisions:[{id:reg.scopeDecision.id,features:featureIds,owner:'synthetic-owner',source:authority,clause:'Synthetic decision 1'}],cases};
  const observations={format:format('observations'),subject:'',cases:cases.map(c=>({id:c.id,scenario:c.scenario,fixtureSha256:artifacts.find(a=>a.path==='fixtures.json').sha256,status:'executed',assertions:[{id:'value',actual:42}]}))};
  const execution={format:format('execution'),subject:'',features:featureIds,implementation,runner,command:['node','runner.mjs'],environment:{toolchains:{node:process.version},platform:process.platform,architecture:process.arch},classification:'complete',exitCode:0,cases:allCaseIds,observations:null};
  const reviews=['authority','evidence'].map(role=>({format:format('review'),subject:'',features:featureIds,executions:[],role,reviewer:`synthetic-${role}-reviewer`,relationship:'non-author',decision:'accept',rationale:'Synthetic test-only non-authoring decision; no actual feature accepted.',findings:[],obligations:obligations.map(o=>o.id),dimensions:dims.map(d=>`${d.feature}:${d.dimension}`),paths:artifacts.map(a=>`${a.repository}:${a.path}`),decisions:[reg.scopeDecision.id]}));
  const decision={format:format('decision'),id:reg.scopeDecision.id,subject:'',features:featureIds,owner:'synthetic-owner',source:authority,clause:'Synthetic decision 1',decision:'approved',rationale:'Synthetic test-only ruling.'};
  function record(name,value) {
    const path=`conformance/asyncapi-family/evidence/${name}.json`, bytes=encode(value), full=join(dir,path);
    mkdirSync(dirname(full),{recursive:true});writeFileSync(full,bytes);return {path,sha256:sha256(bytes)};
  }
  // Recompute enclosing record references, not semantic values. Mutation hooks
  // run after linkage so each test can reach its intended individual guard.
  function seal(hooks={}) {
    const sr=record('subject',subject);
    observations.subject=sr.sha256;hooks.observations?.(observations);
    execution.subject=sr.sha256;execution.observations=record('observations',observations);hooks.execution?.(execution);
    let er=record('execution',execution);if(hooks.executionRef)er=hooks.executionRef(er);
    const reviewRefs=reviews.map((r,i)=>{r.subject=sr.sha256;r.executions=[er.sha256];hooks.review?.(r,i);return record(`review-${i}`,r);});
    decision.subject=sr.sha256;hooks.decision?.(decision);const dr=record('decision',decision);
    const eventRefs=new Map();
    for(const e of reg.entries) {
      for(const dimension of dimensions)e.evidence[dimension]=dims.find(d=>d.feature===e.id && d.dimension===dimension)?.applicable?[er]:[];
      const event={format:format('event'),id:`event-${e.id}`,feature:e.id,contract:context.contractDigest,subject:sr,executions:[er],reviews:reviewRefs,decisions:[dr],dependencies:e.dependencies.map(feature=>({feature,event:eventRefs.get(feature)?.sha256})),previous:null};
      hooks.event?.(event,e);
      const ref=record(`event-${e.id}`,event);e.acceptedHistory=[ref];eventRefs.set(e.id,ref);
    }
    hooks.register?.(reg);return {sr,er,eventRefs};
  }
  return {dir,reg,context,subject,observations,execution,reviews,decision,record,seal,close:()=>rmSync(dir,{recursive:true,force:true})};
}

function gateTest(name,gate,change,hooks) {
  test(name,()=>{const p=packet();try {change?.(p);p.seal(typeof hooks==='function'?hooks(p):hooks);assert.throws(()=>validateEvidence(p.reg,p.context),error=>{assert.match(error.message,new RegExp(gate));return true;});}finally{p.close();}});
}

function isolateFixture(p,c,metadata={},expectedText='42') {
  const path=`isolated-${c.dimension}.json`, body=`{"scenarios":[{"id":${JSON.stringify(c.scenario)},"rules":${JSON.stringify(c.rules)},"expected":{"value":${expectedText}}}],${Object.entries(metadata).map(([k,v])=>JSON.stringify(k)+':'+JSON.stringify(v)).join(',')}}`.replace(',}', '}');
  writeFileSync(join(p.dir,path),body);chmodSync(join(p.dir,path),0o644);
  const artifact={repository:'spec',path,type:'file',mode:0o644,sha256:sha256(body),roles:['fixture']};
  p.subject.artifacts.push(artifact);p.context.inventories.spec.push(path);p.reviews.forEach(r=>r.paths.push(`spec:${path}`));
  c.fixture=`spec:${path}`;c.pointer='/scenarios/0';p.observations.cases.find(o=>o.id===c.id).fixtureSha256=artifact.sha256;
}

for(const dimension of ['definition','processor','synthesis'])for(const field of ['bindingSpec','family'])
  gateTest(`R4 review: ${dimension} authored ${field} cannot name another edition`,'case.fixture-scope',p=>{
    const c=p.subject.cases.find(c=>c.dimension===dimension);
    isolateFixture(p,c,{[field]:field==='bindingSpec'?'openbindings.asyncapi-2.6@1':'asyncapi-2.6'});
  });
for(const dimension of ['processor','synthesis'])gateTest(`R4 review: ${dimension} corpus format cannot name another kind`,'case.fixture-format',p=>{
  const c=p.subject.cases.find(c=>c.dimension===dimension);
  isolateFixture(p,c,{format:`openbindings.binding-spec-${dimension==='processor'?'synthesis':'processor'}-scenarios@7`});
});
gateTest('R4 review: cached subject still validates every reference','reference.subject',null,{event:(r,e)=>{if(e.profile==='http')r.subject={...r.subject,path:'conformance/asyncapi-family/evidence/missing.json'};}});
gateTest('R4 review: lossy integer cannot compare equal','case.fixture-lossless',p=>{
  const c=p.subject.cases[0];isolateFixture(p,c,{},'9007199254740993');p.observations.cases[0].assertions[0].actual=9007199254740992;
});
gateTest('R4 review: duplicate fixture key is not last-key-wins','case.fixture-lossless',p=>isolateFixture(p,p.subject.cases[0],{},'41,"value":42'));
gateTest('R4 review: a rounded decimal cannot compare equal','case.fixture-lossless',p=>{
  isolateFixture(p,p.subject.cases[0],{},'0.10000000000000001');p.observations.cases[0].assertions[0].actual=0.1;
});
test('R4 review: correct portable fixture metadata is accepted',()=>{
  for(const dimension of ['processor','synthesis']) {
    const p=packet();try {
      isolateFixture(p,p.subject.cases.find(c=>c.dimension===dimension),{bindingSpec:'openbindings.asyncapi-3.1@1',family:'asyncapi-3.1',format:`openbindings.binding-spec-${dimension}-scenarios@7`});
      p.seal();validateEvidence(p.reg,p.context);
    }finally{p.close();}
  }
});
gateTest('R4 review: invalid UTF-8 cannot masquerade as canonical record bytes','record.execution.encoding',null,p=>({executionRef:ref=>{
  const path=join(p.dir,ref.path),bytes=readFileSync(path),at=bytes.indexOf(Buffer.from(p.execution.environment.platform));
  assert.ok(at>=0);bytes[at]=0xff;writeFileSync(path,bytes);return {...ref,sha256:sha256(bytes)};
}}));
gateTest('R4 review: independent execution needs its principal dimension','dimension.case',p=>{
  const a=p.subject.dimensions.find(d=>d.dimension==='independentExecution'), b=p.subject.dimensions.find(d=>d.dimension==='boundary');
  [a.cases,b.cases]=[b.cases,a.cases];
});
gateTest('R4 review: normative independent case needs a rule','case.rules',p=>{p.subject.cases.find(c=>c.dimension==='independentExecution').rules=[];});

for(const name of ['subject','execution','observations','review-0','decision'])test(`R4 review: historical ${name} record must remain verifiable`,()=>{
  const p=packet();try {
    p.seal();p.context.trustedHistory=Object.fromEntries(p.reg.entries.map(e=>[e.id,structuredClone(e.acceptedHistory)]));
    p.reg.entries.forEach(e=>e.state='verified');rmSync(join(p.dir,`conformance/asyncapi-family/evidence/${name}.json`));
    assert.throws(()=>validateEvidence(p.reg,p.context),/reference\./);
  }finally{p.close();}
});

test('R4 review: trusted checkpoint encoding is checked before use',()=>{
  const dir=mkdtempSync(join(tmpdir(),'asyncapi-r4-canonical-'));
  try {
    const value={format:format('history'),contract:contractDigest(live),histories:emptyHistory(live)},canonical=encode(value),path=join(dir,'prior.json');
    for(const bytes of [' '+canonical,canonical.replace('{','{\n  "format": "discarded-duplicate",'),JSON.stringify(value),JSON.stringify(value,null,2)+'\n']) {
      writeFileSync(path,bytes);
      const result=spawnSync(process.execPath,['scripts/verify-asyncapi-family-completion.mjs',`--trusted-history=${path}`,`--trusted-history-sha256=${sha256(bytes)}`],{cwd:root,encoding:'utf8'});
      assert.notEqual(result.status,0);assert.match(result.stderr,/history.encoding/);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('R4 positive: non-vacuous typed graph and universal readiness',()=>{
  const p=packet();try{p.seal();validateEvidence(p.reg,p.context);requireWholeFamily(p.reg);}finally{p.close();}
});
test('R4 existing D fixture identity and equality projection need no corpus rewrite',()=>{
  const p=packet();try {
    const path='actual-definition.json',bytes=readFileSync(join(root,'conformance/binding-specs/asyncapi-3.1/ASYNC31-D-01.json'));
    writeFileSync(join(p.dir,path),bytes);chmodSync(join(p.dir,path),0o644);
    const artifact={repository:'spec',path,type:'file',mode:0o644,sha256:sha256(bytes),roles:['fixture']};
    p.subject.artifacts.push(artifact);p.context.inventories.spec.push(path);
    const c=p.subject.cases[0];c.fixture=`spec:${path}`;c.pointer='/tests/0';c.scenario='ASYNC31-D-01#/tests/0';c.assertions[0].expected='/valid';
    const capability=p.subject.artifacts.find(a=>a.path==='capability.json');
    const cap=JSON.parse(readFileSync(join(p.dir,capability.path)));cap.cases.push(c.scenario);
    const capBytes=encode(cap);writeFileSync(join(p.dir,capability.path),capBytes);capability.sha256=sha256(capBytes);
    p.reviews.forEach(r=>r.paths.push(`spec:${path}`));
    p.seal({observations:o=>{o.cases[0].scenario=c.scenario;o.cases[0].fixtureSha256=artifact.sha256;o.cases[0].assertions[0].actual=true;}});
    validateEvidence(p.reg,p.context);
  }finally{p.close();}
});
gateTest('unrelated hashed README is not execution','record.execution.format',null,p=>({executionRef:()=>p.record('README',{verdict:'pass'})}));
gateTest('invented case rule cannot resolve','rule.applicability',p=>p.subject.cases[0].rules=['ASYNC31-D-999']);
gateTest('wrong edition rule cannot resolve','rule.applicability',p=>p.subject.cases[0].rules=['ASYNC30-D-01']);
gateTest('invented register normative rule cannot resolve','rule.resolution',p=>{p.reg.entries[0].normativeRules.push('ASYNC31-D-999');p.context.contractDigest=contractDigest(p.reg);p.subject.contract=p.context.contractDigest;});
gateTest('unmatched subject cannot qualify execution','execution.subject',null,{execution:r=>r.subject='0'.repeat(64)});
for(const [label,repository,path] of [['implementation','spec','implementation.mjs'],['runner','spec','runner.mjs'],['dependency','spec','dependencies.lock'],['adopted contract','interfaces','invoke.json']])
  gateTest(`changed ${label} invalidates current acceptance`,'subject.bytes',p=>writeFileSync(join(p.context.roots[repository],path),'changed\n'));
gateTest('deleted artifact is not accepted','subject.file',p=>rmSync(join(p.dir,'implementation.mjs')));
gateTest('retyped artifact is not accepted','subject.file',p=>{rmSync(join(p.dir,'implementation.mjs'));symlinkSync('runner.mjs',join(p.dir,'implementation.mjs'));});
gateTest('changed file mode is not accepted','subject.mode',p=>chmodSync(join(p.dir,'implementation.mjs'),0o755));
gateTest('missing checker input is not accepted','subject.inventory',p=>p.subject.artifacts=p.subject.artifacts.filter(a=>a.path!==checkerPaths[0]));
gateTest('additional unsealed checkout input is rejected','subject.inventory',p=>{writeFileSync(join(p.dir,'new-implementation.mjs'),'new code');p.context.inventories.spec.push('new-implementation.mjs');});
gateTest('wrong profile cannot reuse a subject','contract.identity',p=>p.reg.entries[0].profile='websocket');
gateTest('changed repository revision is not accepted','subject.revision',p=>p.context.revisions.interfaces='different-checkout');
gateTest('old fixture with new observations is rejected','observation.fixture',null,{observations:r=>r.cases[0].fixtureSha256='0'.repeat(64)});
gateTest('invented scenario is not a fixture case','case.resolution',p=>p.subject.cases[0].scenario='invented');
gateTest('unsupported capability cannot count as execution','case.capability',p=>p.subject.cases[0].capability.pointer='/missing');
gateTest('wrong expected value is not a pass','observation.value',null,{observations:r=>r.cases[0].assertions[0].actual=43});
gateTest('partial run is not complete','execution.complete',null,{execution:r=>r.classification='partial'});
gateTest('failed apparatus is not successful execution','execution.exit',null,{execution:r=>r.exitCode=1});
for(const status of ['skipped','unsupported','infrastructure-error'])gateTest(`${status} is not executed`,'observation.executed',null,{observations:r=>r.cases[0].status=status});
gateTest('missing required scenario is rejected','execution.required-cases',null,{execution:r=>r.cases=r.cases.slice(1),observations:r=>r.cases=r.cases.slice(1)});
gateTest('missing required assertion is rejected','observation.assertion-inventory',null,{observations:r=>r.cases[0].assertions=[]});
gateTest('wrong execution feature scope is rejected','execution.scope',null,{execution:r=>r.features=[]});
gateTest('wrong review scope is rejected','review.scope',null,{review:(r,i)=>{if(i===0)r.features=[];}});
gateTest('stale review subject is rejected','review.subject',null,{review:(r,i)=>{if(i===0)r.subject='0'.repeat(64);}});
gateTest('stale review execution linkage is rejected','review.executions',null,{review:(r,i)=>{if(i===0)r.executions=['0'.repeat(64)];}});
gateTest('same reviewer twice is not independent','review.independence',null,{review:r=>r.reviewer='same-reviewer'});
gateTest('author cannot be a non-author reviewer','review.independence',null,{review:r=>r.reviewer='synthetic-author'});
gateTest('omitted alignment layer is rejected','alignment.layers',p=>p.subject.obligations=p.subject.obligations.filter(o=>o.layer!=='interfaces'));
gateTest('unreviewed obligation is rejected','review.obligations',null,{review:r=>r.obligations=r.obligations.slice(1)});
gateTest('missing D/P/S dimension is rejected','dimension.inventory',p=>p.subject.dimensions=p.subject.dimensions.slice(1));
gateTest('unjustified N/A is rejected','dimension.reason',p=>{const d=p.subject.dimensions.find(d=>!d.applicable);d.reason='';});
gateTest('unreviewed N/A is rejected','review.dimensions',null,{review:r=>r.dimensions=r.dimensions.slice(0,-1)});
gateTest('wrong-scope maintainer decision is rejected','decision.scope',null,{decision:r=>r.features=[]});
gateTest('missing maintainer decision is rejected','decision.required',null,{event:r=>r.decisions=[]});
gateTest('excluded profile must carry the frozen scope decision','decision.exclusion',p=>p.subject.decisions=[]);
gateTest('unaccepted dependency is rejected','dependency.accepted',null,{register:r=>{r.entries[0].state='verified';r.entries[0].acceptedHistory=[];}});
gateTest('stale dependency event is rejected','dependency.current',null,{event:r=>{if(r.dependencies.length)r.dependencies[0].event='0'.repeat(64);}});
gateTest('unknown execution fields fail closed','record.execution.shape',null,{execution:r=>r.syntheticPass=true});
gateTest('wrong observed scenario cannot impersonate a selected case','observation.scenario',null,{observations:r=>r.cases[0].scenario='invented'});

test('R4 history: trusted prefix survives demotion; deletion, rewrite and duplicate events fail',()=>{
  const p=packet();try {
    p.seal();validateEvidence(p.reg,p.context);
    p.context.trustedHistory=Object.fromEntries(p.reg.entries.map(e=>[e.id,structuredClone(e.acceptedHistory)]));
    p.reg.entries.forEach(e=>e.state='verified');
    writeFileSync(join(p.dir,'implementation.mjs'),'changed after historical acceptance\n');
    validateEvidence(p.reg,p.context);
    const e=p.reg.entries[0], old=structuredClone(e.acceptedHistory);
    for(const bad of [[],[{...old[0],sha256:'0'.repeat(64)}]]) {e.acceptedHistory=bad;assert.throws(()=>validateEvidence(p.reg,p.context),/history.append-only/);}
    e.acceptedHistory=[...old,...old];assert.throws(()=>validateEvidence(p.reg,p.context),/history.unique/);
    e.acceptedHistory=old;delete p.context.trustedHistory[e.id];assert.throws(()=>validateEvidence(p.reg,p.context),/history.denominator/);
  }finally{p.close();}
});

test('R4 history: a genuine linked supersession is accepted; a fork is rejected',()=>{
  const p=packet();try {
    p.seal();p.context.trustedHistory=Object.fromEntries(p.reg.entries.map(e=>[e.id,structuredClone(e.acceptedHistory)]));
    // Supersede the leaf exclusion; dependents do not consume that leaf.
    const e=p.reg.entries.find(e=>e.disposition==='excluded'),old=e.acceptedHistory[0];
    const event=JSON.parse(readFileSync(join(p.dir,old.path)));event.id+='-superseding';event.previous=old.sha256;
    e.acceptedHistory.push(p.record('superseding',event));validateEvidence(p.reg,p.context);
    event.previous=null;e.acceptedHistory[1]=p.record('fork',event);assert.throws(()=>validateEvidence(p.reg,p.context),/history.chain/);
  }finally{p.close();}
});

test('R4 full-denominator readiness: every one of the live 120 cells matters',()=>{
  // State-predicate qualification, NOT all-edition evidence acceptance. Leave
  // every actual edition, rule, dependency and exclusion unchanged in the copy.
  const reg=structuredClone(live);reg.entries.forEach(e=>e.state='accepted');
  requireWholeFamily(reg);assert.equal(reg.entries.length,live.entries.length);
  for(const e of reg.entries) {e.state='verified';assert.throws(()=>requireWholeFamily(reg),error=>{assert.match(error.message,/readiness.universal/);assert.ok(error.message.includes(e.id));return true;});e.state='accepted';}
});

for(const edition of ['3.0','2.6'])test(`R4 pending ${edition} cannot acquire acceptance from invented future authority`,()=>{
  const p=packet(true);try {
    p.subject.features.sort((a,b)=>Number(p.reg.entries.find(e=>e.id===b).edition===edition)-Number(p.reg.entries.find(e=>e.id===a).edition===edition));
    p.seal();assert.throws(()=>validateEvidence(p.reg,p.context),/unimplemented-sibling/);
  }finally{p.close();}
});

gateTest('R4 superseded shared candidate is not the 3.1 sibling','case.fixture-scope',p=>{
  const source=JSON.parse(readFileSync(join(root,'conformance/binding-specs/processor/asyncapi.json')));
  assert.equal(source.bindingSpec,'openbindings.asyncapi@1');
  isolateFixture(p,p.subject.cases.find(c=>c.dimension==='processor'),{bindingSpec:source.bindingSpec,family:source.family,format:source.format});
});

test('R4 readiness cannot rely on the narrower composition dependency graph',()=>{
  const p=packet();try {
    p.seal();const omitted=p.reg.entries.find(e=>e.profile==='http');omitted.state='verified';omitted.acceptedHistory=[];
    assert.throws(()=>validateEvidence(p.reg,p.context),/readiness.prerequisites/);
  }finally{p.close();}
});

gateTest('an unaccepted cell cannot append fabricated acceptance history','history.append-state',null,{register:r=>r.entries[0].state='verified'});

test('R4 records reject duplicate-key and noncanonical encodings',()=>{
  const p=packet();try {
    p.seal();const e=p.reg.entries[0], ref=e.acceptedHistory[0];
    const original=readFileSync(join(p.dir,ref.path),'utf8');
    const duplicated=original.replace('{','{\n  "id": "discarded-by-JSON.parse",');
    writeFileSync(join(p.dir,ref.path),duplicated);ref.sha256=sha256(duplicated);
    assert.throws(()=>validateEvidence(p.reg,p.context),/record.event.encoding/);
  }finally{p.close();}
});

test('R4 production register stays unaccepted and CLI fails closed without history trust',()=>{
  validate(live);assert.ok(live.entries.every(e=>e.state!=='accepted' && e.acceptedHistory.length===0));
  const result=spawnSync(process.execPath,['scripts/verify-asyncapi-family-completion.mjs','--ready'],{cwd:root,encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/history.trust/);
  const claimed=structuredClone(live);claimed.status='family-ready';assert.throws(()=>validate(claimed),/history.trust/);
});

test('R4 CLI validates an independently supplied genesis checkpoint; candidate cannot select one',()=>{
  const dir=mkdtempSync(join(tmpdir(),'asyncapi-r4-trust-'));
  try {
    const checkpoint={format:format('history'),contract:contractDigest(live),histories:emptyHistory(live)},bytes=encode(checkpoint),path=join(dir,'prior.json');
    writeFileSync(path,bytes);
    const args=['scripts/verify-asyncapi-family-completion.mjs',`--trusted-history=${path}`,`--trusted-history-sha256=${sha256(bytes)}`];
    const positive=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8'});
    assert.equal(positive.status,0,positive.stderr);assert.match(positive.stdout,/trusted-history checks passed/);
    args[2]=`--trusted-history-sha256=${'0'.repeat(64)}`;
    const stale=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8'});
    assert.notEqual(stale.status,0);assert.match(stale.stderr,/trusted history digest mismatch/);
    const candidate=structuredClone(live);candidate.trustedHistory=checkpoint.histories;
    assert.throws(()=>validateEvidence(candidate),/history.trust/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
