// Private acceptance-record validation, not a portable binding or SDK API.
import assert from 'node:assert/strict';
import {readFileSync,lstatSync,realpathSync} from 'node:fs';
import {resolve,relative,isAbsolute,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {parseLosslessJson,losslessJsonEqual} from './lossless-json.mjs';

export const dimensions = Object.freeze(['definition','processor','synthesis','independentDerivation','independentExecution','boundary','mutation','integration']);
export const layers = Object.freeze(['core','binding','interfaces','architecture','project']);
export const checkerPaths = Object.freeze(['scripts/verify-asyncapi-family-completion.mjs','scripts/asyncapi-completion-evidence.mjs','scripts/lossless-json.mjs']);
const prefix = 'openbindings.asyncapi-acceptance-';
const reportDirectory = 'conformance/asyncapi-family/evidence/';
// Only implemented sibling authority/corpus identities belong here. An edition
// number cannot predict a future binding identifier or scenario format version.
const implementedEditions = Object.freeze({
  '3.1': Object.freeze({path:'binding-specs/asyncapi-3.1/openbindings.asyncapi-3.1.md',
    bindingSpec:'openbindings.asyncapi-3.1@1',family:'asyncapi-3.1',rulePrefix:'ASYNC31-',
    processor:'openbindings.binding-spec-processor-scenarios@7',
    synthesis:'openbindings.binding-spec-synthesis-scenarios@7'}),
});
function editionIdentity(edition) {
  check(Object.hasOwn(implementedEditions,edition),'subject.unimplemented-sibling',`${edition}: actual sibling specification and corpus qualification required`);
  return implementedEditions[edition];
}
export function isSubjectInput(path) {
  return !path.startsWith(reportDirectory) && !['conformance/asyncapi-family/completion.json','conformance/asyncapi-family/COMPLETION.md'].includes(path);
}
const hashPattern = /^[a-f0-9]{64}$/;
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function canonicalRecord(value) {
  const order=x=>Array.isArray(x)?x.map(order):x && typeof x==='object'
    ?Object.fromEntries(Object.keys(x).sort().map(k=>[k,order(x[k])])):x;
  return JSON.stringify(order(value),null,2)+'\n';
}
const digest = value => sha256(JSON.stringify(value));
function check(condition, gate, detail='') { assert.ok(condition, `${gate}: ${detail}`); }
function text(value, gate) { check(typeof value==='string' && value.trim().length>0,gate,'nonempty string required'); }
function list(value, gate) { check(Array.isArray(value),gate,'array required'); return value; }
function unique(value, gate) { list(value,gate);check(new Set(value).size===value.length,gate,'duplicate identity');return value; }
function equal(a,b,gate) { assert.deepEqual(a,b,gate); }
function setEqual(a,b,gate) { equal([...unique(a,gate)].sort(),[...unique(b,gate)].sort(),gate); }
function shape(value, fields, gate) {
  check(value && typeof value==='object' && !Array.isArray(value),gate,'object required');
  setEqual(Object.keys(value),fields.split(' '),`${gate}.shape`);
}
function typed(value,type,fields) {
  shape(value,`format ${fields}`,`record.${type}`);
  equal(value.format,`${prefix}${type}@1`,`record.${type}.format`);
}
function hash(value,gate) { check(typeof value==='string' && hashPattern.test(value),gate,'SHA-256 required'); }
function relativePath(path,gate) {
  text(path,gate);
  check(!isAbsolute(path) && !path.includes('\\') && !path.split('/').some(p=>!p || p==='.' || p==='..'),gate,'canonical relative path required');
}
function safeFile(root,path,gate) {
  relativePath(path,gate);text(root,gate);
  let base,full,real;
  try {base=realpathSync(root);full=resolve(base,path);real=realpathSync(full);}catch {check(false,gate,'missing artifact');}
  const rel=relative(base,real);
  check(rel && !isAbsolute(rel) && rel!=='..' && !rel.startsWith(`..${sep}`),gate,'path escapes repository');
  // Semantic inputs and evidence are regular files. Symlinked parent directories
  // are rejected too; no unstated alias/target dependency is followed.
  let cursor=base;
  for(const component of path.split('/')) { cursor=resolve(cursor,component);check(!lstatSync(cursor).isSymbolicLink(),gate,'symlink unsupported'); }
  check(lstatSync(full).isFile(),gate,'regular file required');
  return full;
}
function pointer(value,path,gate) {
  check(typeof path==='string' && (path==='' || path.startsWith('/')),gate,'JSON pointer required');
  if(path==='')return value;
  for(const part of path.slice(1).split('/')) {
    check(!/~(?:[^01]|$)/.test(part),gate,'bad escape');
    const key=part.replaceAll('~1','/').replaceAll('~0','~');
    check(value!==null && typeof value==='object' && Object.hasOwn(value,key),gate,`missing ${path}`);
    value=value[key];
  }
  return value;
}
export function behaviorContract(register) {
  // Progress, reports and history cannot carry semantic configuration.
  return {contractVersion:register.contractVersion,scopeDecision:register.scopeDecision,
    entries:register.entries.map(({state,evidence,findings,acceptedHistory,...contract})=>contract).sort((a,b)=>a.id.localeCompare(b.id))};
}
export const contractDigest = register => digest(behaviorContract(register));
export function emptyHistory(register) { return Object.fromEntries(register.entries.map(e=>[e.id,[]])); }

export function requireWholeFamily(register) {
  const unfinished=register.entries.filter(e=>e.state!=='accepted').map(e=>e.id);
  check(unfinished.length===0,'readiness.universal',unfinished.join(', '));
}

// Context roots, contract digest and trusted prior history come from the caller,
// never from the candidate register or its evidence. See ACCEPTANCE-EVIDENCE.md.
export function validateEvidence(register,context) {
  check(context && context.roots && context.trustedHistory,'history.trust','trusted caller context required');
  equal(contractDigest(register),context.contractDigest,'contract.identity');
  const entries=new Map(register.entries.map(e=>[e.id,e]));
  setEqual(Object.keys(context.trustedHistory),[...entries.keys()],'history.denominator');
  const cache=new Map(), subjects=new Map(), events=new Map();
  function record(ref,type) {
    shape(ref,'path sha256',`reference.${type}`);relativePath(ref.path,`reference.${type}`);hash(ref.sha256,`reference.${type}`);
    check(ref.path.startsWith(reportDirectory),`reference.${type}`,'record outside evidence directory');
    const path=safeFile(context.roots.spec,ref.path,`reference.${type}`);
    const bytes=readFileSync(path);
    equal(sha256(bytes),ref.sha256,`reference.${type}.digest`);
    const key=`${type}:${ref.sha256}`;
    if(cache.has(key))return cache.get(key);
    let value;
    try {value=JSON.parse(bytes);}catch {check(false,`record.${type}.json`,'JSON record required');}
    check(value?.format===`${prefix}${type}@1`,`record.${type}.format`,'typed record required');
    equal(bytes,Buffer.from(canonicalRecord(value)),`record.${type}.encoding`);
    cache.set(key,value);return value;
  }
  function subject(ref) {
    const s=record(ref,'subject');
    if(subjects.has(ref.sha256))return subjects.get(ref.sha256);
    typed(s,'subject','contract features authors repositories artifacts dimensions obligations decisions cases');
    equal(s.contract,context.contractDigest,'subject.contract');
    unique(s.features,'subject.features');check(s.features.length>0,'subject.features');
    for(const id of s.features) {check(entries.has(id),'subject.features',id);editionIdentity(entries.get(id).edition);}
    unique(s.authors,'subject.authors');check(s.authors.length>0,'subject.authors');s.authors.forEach(a=>text(a,'subject.authors'));
    unique(s.repositories.map(r=>r.id),'subject.repositories');
    for(const r of s.repositories) {shape(r,'id revision','subject.repository');equal(r.revision,context.revisions?.[r.id],'subject.revision');text(r.revision,'subject.revision');}
    const artifacts=new Map();
    for(const a of list(s.artifacts,'subject.artifacts')) {
      shape(a,'repository path type mode sha256 roles','subject.artifact');
      text(a.repository,'subject.repository');check(Object.hasOwn(context.roots,a.repository),'subject.repository',a.repository);
      relativePath(a.path,'subject.path');check(!a.path.startsWith(reportDirectory),'subject.cycle','reports cannot be subject inputs');
      check(!['conformance/asyncapi-family/completion.json','conformance/asyncapi-family/COMPLETION.md'].includes(a.path),'subject.cycle','progress is not a semantic input');
      const key=`${a.repository}:${a.path}`;check(!artifacts.has(key),'subject.inventory','duplicate path');
      equal(a.type,'file','subject.type');check(Number.isInteger(a.mode) && a.mode>=0 && a.mode<=4095,'subject.mode');hash(a.sha256,'subject.digest');
      const path=safeFile(context.roots[a.repository],a.path,'subject.file'), bytes=readFileSync(path);
      equal(lstatSync(path).mode&4095,a.mode,'subject.mode');equal(sha256(bytes),a.sha256,'subject.bytes');
      unique(a.roles,'subject.roles');check(a.roles.length>0,'subject.roles');
      for(const role of a.roles)check(['normative','authority','interface','policy','implementation','dependency','fixture','runner','capability','build','checker','supporting'].includes(role),'subject.roles',role);
      artifacts.set(key,{...a,bytes});
    }
    setEqual(s.repositories.map(r=>r.id),[...new Set(s.artifacts.map(a=>a.repository))],'subject.repositories');
    for(const r of s.repositories)setEqual(s.artifacts.filter(a=>a.repository===r.id).map(a=>a.path),
      context.inventories?.[r.id],'subject.inventory');
    function artifact(key,role) {const a=artifacts.get(key);check(a && (!role || a.roles.includes(role)),'subject.input',`${key} (${role})`);return a;}
    const decoded=new Map();
    function jsonArtifact(key,role,gate) {
      const raw=artifact(key,role);
      if(decoded.has(key))return decoded.get(key);
      const sourceText=raw.bytes.toString('utf8');equal(raw.bytes,Buffer.from(sourceText),`${gate}-encoding`);
      let value;try{value=JSON.parse(sourceText);}catch{check(false,gate,'JSON input required');}
      const lossless=parseLosslessJson(sourceText);
      check(lossless.ok && losslessJsonEqual(lossless.node,parseLosslessJson(JSON.stringify(value)).node),`${gate}-lossless`,'decode would lose a value or duplicate key');
      decoded.set(key,value);return value;
    }
    for(const path of checkerPaths)artifact(`spec:${path}`,'checker');
    for(const role of ['normative','authority','policy','implementation','dependency','fixture','runner','capability','build'])
      check([...artifacts.values()].some(a=>a.roles.includes(role)),'subject.roles',`missing ${role}`);
    const obligations=list(s.obligations,'alignment.obligations');
    unique(obligations.map(o=>o.id),'alignment.obligations');
    setEqual([...new Set(obligations.map(o=>o.layer))],layers,'alignment.layers');
    for(const o of obligations) {
      shape(o,'id layer applicable reason source clause cases','alignment.obligation');
      text(o.id,'alignment.id');text(o.reason,'alignment.reason');text(o.clause,'alignment.clause');
      check(typeof o.applicable==='boolean','alignment.applicability');artifact(o.source);
      unique(o.cases,'alignment.cases');check(o.applicable?o.cases.length>0:o.cases.length===0,'alignment.applicability');
      if(o.layer==='interfaces' && o.applicable)artifact(o.source,'interface');
    }
    const dims=list(s.dimensions,'dimension.inventory');
    setEqual(dims.map(d=>`${d.feature}:${d.dimension}`),s.features.flatMap(f=>dimensions.map(d=>`${f}:${d}`)),'dimension.inventory');
    for(const d of dims) {
      shape(d,'feature dimension applicable reason cases','dimension');
      text(d.reason,'dimension.reason');check(typeof d.applicable==='boolean','dimension.applicability');unique(d.cases,'dimension.cases');
      check(d.applicable?d.cases.length>0:d.cases.length===0,'dimension.applicability');
    }
    const rules=new Map();
    for(const id of s.features) {
      const e=entries.get(id), identity=editionIdentity(e.edition), specKey=`spec:${identity.path}`;
      const md=artifact(specKey,'normative').bytes.toString('utf8');
      const definitions=[...md.matchAll(/^\*\*\[[^\]]+\]\*\* \*\*(ASYNC\d+-[DPS]-\d+)\*\* —/gm)].map(m=>m[1]);
      unique(definitions,'rule.definitions');const defined=new Set(definitions);rules.set(id,defined);
      for(const rule of e.normativeRules)check(rule.startsWith(identity.rulePrefix) && defined.has(rule),'rule.resolution',`${id}/${rule}`);
    }
    const cases=new Map();
    for(const c of list(s.cases,'case.inventory')) {
      shape(c,'id scenario feature dimension rules fixture pointer capability implementation runner assertions','case');
      text(c.id,'case.id');check(!cases.has(c.id),'case.inventory','duplicate case');check(s.features.includes(c.feature),'case.scope');
      check(dimensions.includes(c.dimension),'case.dimension');unique(c.rules,'case.rules');
      check(entries.get(c.feature).normativeRules.length===0 || c.rules.length>0,'case.rules','normative feature requires an owning rule');
      for(const rule of c.rules)check(rules.get(c.feature).has(rule) && entries.get(c.feature).normativeRules.includes(rule),'rule.applicability',rule);
      const raw=artifact(c.fixture,'fixture'), source=jsonArtifact(c.fixture,'fixture','case.fixture');
      const identity=editionIdentity(entries.get(c.feature).edition);
      if(Object.hasOwn(source,'bindingSpec'))equal(source.bindingSpec,identity.bindingSpec,'case.fixture-scope');
      if(Object.hasOwn(source,'family'))equal(source.family,identity.family,'case.fixture-scope');
      const kind=/-PS-\d+$/.test(c.scenario)?'processor':/-SS-\d+$/.test(c.scenario)?'synthesis':['processor','synthesis'].includes(c.dimension)?c.dimension:undefined;
      if(Object.hasOwn(source,'format') && (kind || String(source.format).startsWith('openbindings.binding-spec-')))
        equal(source.format,kind?identity[kind]:undefined,'case.fixture-format');
      const fixture=pointer(source,c.pointer,'case.fixture');
      // Resolve the authored case identity and rule owners, not a caller's label.
      const definitionCase=c.dimension==='definition' && /^\/tests\/(0|[1-9]\d*)$/.test(c.pointer) && typeof source.rule==='string';
      equal(definitionCase?`${source.rule}#${c.pointer}`:fixture.id,c.scenario,'case.resolution');text(c.scenario,'case.resolution');
      const owners=definitionCase?[source.rule]:fixture.rules;
      check(Array.isArray(owners),'case.rules','fixture requires explicit owners');
      for(const rule of c.rules)check(owners.includes(rule),'case.rules',rule);
      const letter={definition:'D',processor:'P',synthesis:'S'}[c.dimension];
      if(letter)check(c.rules.some(r=>r.includes(`-${letter}-`)),'case.dimension-rule',c.id);
      shape(c.capability,'artifact pointer','case.capability');
      const capability=jsonArtifact(c.capability.artifact,'capability','case.capability');
      const supported=pointer(capability,c.capability.pointer,'case.capability');
      check(Array.isArray(supported) && supported.includes(c.scenario),'case.capability',c.scenario);
      artifact(c.implementation,'implementation');artifact(c.runner,'runner');
      unique(c.assertions.map(a=>a.id),'case.assertions');check(c.assertions.length>0,'case.assertions');
      for(const a of c.assertions) {shape(a,'id expected','case.assertion');text(a.id,'case.assertion');pointer(fixture,a.expected,'case.expected');}
      cases.set(c.id,{...c,fixtureValue:fixture,fixtureSha256:raw.sha256});
    }
    check(cases.size>0,'case.inventory','nonempty evidence required');
    for(const d of dims)for(const id of d.cases) {const c=cases.get(id);check(c && c.feature===d.feature && (['boundary','mutation','integration'].includes(d.dimension) || c.dimension===d.dimension),'dimension.case',id);}
    setEqual([...new Set(dims.flatMap(d=>d.cases))],[...cases.keys()],'dimension.coverage');
    for(const o of obligations)for(const id of o.cases)check(cases.has(id),'alignment.case',id);
    for(const f of s.features)for(const rule of entries.get(f).normativeRules)
      check([...cases.values()].some(c=>c.feature===f && c.rules.includes(rule)),'rule.coverage',`${f}/${rule}`);
    for(const d of list(s.decisions,'decision.inventory')) {
      shape(d,'id features owner source clause','decision.requirement');text(d.id,'decision.id');text(d.owner,'decision.owner');text(d.clause,'decision.clause');artifact(d.source);
      unique(d.features,'decision.features');check(d.features.length>0 && d.features.every(f=>s.features.includes(f)),'decision.scope');
    }
    unique(s.decisions.map(d=>d.id),'decision.inventory');
    for(const f of s.features)if(entries.get(f).disposition==='excluded')
      check(s.decisions.some(d=>d.id===register.scopeDecision.id && d.features.includes(f)),'decision.exclusion',f);
    const result={s,artifacts,artifact,cases,dims};subjects.set(ref.sha256,result);return result;
  }
  // Every historical event is checked, even after demotion. Only current
  // acceptance requires current bytes; old subjects remain historical.
  for(const e of register.entries) {
    const prior=context.trustedHistory[e.id];list(prior,'history.prior');list(e.acceptedHistory,'history.current');
    equal(e.acceptedHistory.slice(0,prior.length),prior,'history.append-only');
    let previous=null;
    for(const [index,ref] of e.acceptedHistory.entries()) {
      const event=record(ref,'event');
      typed(event,'event','id feature contract subject executions reviews decisions dependencies previous');
      text(event.id,'history.id');check(!events.has(event.id),'history.unique',event.id);events.set(event.id,{event,ref,trusted:index<prior.length});
      equal(event.feature,e.id,'history.feature');equal(event.previous,previous,'history.chain');
      hash(event.contract,'event.contract');list(event.executions,'event.executions');list(event.reviews,'event.reviews');list(event.decisions,'event.decisions');list(event.dependencies,'event.dependencies');
      previous=ref.sha256;
    }
    if(e.acceptedHistory.length>prior.length) {
      check(e.state==='accepted','history.append-state','new historical events must pass current acceptance');
      equal(e.acceptedHistory.length,prior.length+1,'history.append-count');
    }
  }
  // Trusted history preserves report bytes and their entire reference closure,
  // not the old input checkout. Do not call subject(): old input bytes may have
  // legitimately changed and historical acceptance is not current acceptance.
  for(const {event,trusted} of events.values()) {
    if(!trusted)continue; // Newly appended events undergo current validation below.
    const s=record(event.subject,'subject');
    for(const ref of event.executions) {
      const run=record(ref,'execution');equal(run.subject,event.subject.sha256,'execution.subject');
      setEqual(run.features,s.features,'execution.scope');
      const observations=record(run.observations,'observations');equal(observations.subject,event.subject.sha256,'observation.subject');
    }
    for(const ref of event.reviews) {
      const review=record(ref,'review');equal(review.subject,event.subject.sha256,'review.subject');
      setEqual(review.features,s.features,'review.scope');setEqual(review.executions,event.executions.map(r=>r.sha256),'review.executions');
    }
    for(const ref of event.decisions) {
      const decision=record(ref,'decision');equal(decision.subject,event.subject.sha256,'decision.subject');
    }
    for(const d of event.dependencies)check([...events.values()].some(x=>x.event.feature===d.feature && x.ref.sha256===d.event),'dependency.current','unretained dependency event');
  }
  for(const e of register.entries.filter(e=>e.state==='accepted')) {
    check(e.findings.length===0,'acceptance.findings',e.id);check(e.acceptedHistory.length>0,'acceptance.history',e.id);
    const event=record(e.acceptedHistory.at(-1),'event');equal(event.contract,context.contractDigest,'event.contract');
    const {s,artifact,cases,dims}=subject(event.subject);check(s.features.includes(e.id),'event.scope',e.id);
    const executed=new Set(), executionHashes=[], evidenceByDimension=new Map(dimensions.map(d=>[d,[]]));
    for(const ref of event.executions) {
      const run=record(ref,'execution');typed(run,'execution','subject features implementation runner command environment classification exitCode cases observations');
      equal(run.subject,event.subject.sha256,'execution.subject');setEqual(run.features,s.features,'execution.scope');
      artifact(run.implementation,'implementation');artifact(run.runner,'runner');
      list(run.command,'execution.command');check(run.command.length>0,'execution.command');run.command.forEach(v=>text(v,'execution.command'));
      shape(run.environment,'toolchains platform architecture','execution.environment');text(run.environment.platform,'execution.environment');text(run.environment.architecture,'execution.environment');
      check(Object.keys(run.environment.toolchains||{}).length>0,'execution.environment');Object.values(run.environment.toolchains).forEach(v=>text(v,'execution.environment'));
      equal(run.classification,'complete','execution.complete');equal(run.exitCode,0,'execution.exit');
      unique(run.cases,'execution.inventory');check(run.cases.length>0,'execution.inventory');
      const observations=record(run.observations,'observations');typed(observations,'observations','subject cases');equal(observations.subject,event.subject.sha256,'observation.subject');
      setEqual(observations.cases.map(c=>c.id),run.cases,'observation.inventory');
      for(const result of observations.cases) {
        shape(result,'id scenario fixtureSha256 status assertions','observation.case');
        const c=cases.get(result.id);check(c && !executed.has(c.id),'execution.inventory',result.id);executed.add(c.id);
        equal(run.implementation,c.implementation,'execution.implementation');equal(run.runner,c.runner,'execution.runner');
        equal(result.scenario,c.scenario,'observation.scenario');
        equal(result.fixtureSha256,c.fixtureSha256,'observation.fixture');equal(result.status,'executed','observation.executed');
        setEqual(result.assertions.map(a=>a.id),c.assertions.map(a=>a.id),'observation.assertion-inventory');
        for(const a of result.assertions) {shape(a,'id actual','observation.assertion');const planned=c.assertions.find(x=>x.id===a.id);equal(a.actual,pointer(c.fixtureValue,planned.expected,'case.expected'),'observation.value');}
        for(const d of dims.filter(d=>d.feature===e.id && d.cases.includes(c.id)))
          if(!evidenceByDimension.get(d.dimension).some(x=>x.sha256===ref.sha256))evidenceByDimension.get(d.dimension).push(ref);
      }
      executionHashes.push(ref.sha256);
    }
    setEqual([...executed],[...cases.keys()],'execution.required-cases');unique(executionHashes,'execution.records');
    for(const d of dimensions)equal(e.evidence[d],evidenceByDimension.get(d),'acceptance.evidence');
    const decisionIds=[];
    for(const ref of event.decisions) {
      const d=record(ref,'decision');typed(d,'decision','id subject features owner source clause decision rationale');
      const requirement=s.decisions.find(x=>x.id===d.id);check(requirement,'decision.required',d.id);
      equal(d.subject,event.subject.sha256,'decision.subject');setEqual(d.features,requirement.features,'decision.scope');
      for(const k of ['owner','source','clause'])equal(d[k],requirement[k],'decision.correspondence');
      equal(d.decision,'approved','decision.verdict');text(d.rationale,'decision.rationale');decisionIds.push(d.id);
    }
    setEqual(decisionIds,s.decisions.map(d=>d.id),'decision.required');
    const reviewers=[],roles=[];
    for(const ref of event.reviews) {
      const r=record(ref,'review');typed(r,'review','subject features executions role reviewer relationship decision rationale findings obligations dimensions paths decisions');
      equal(r.subject,event.subject.sha256,'review.subject');setEqual(r.features,s.features,'review.scope');setEqual(r.executions,executionHashes,'review.executions');
      check(['authority','evidence'].includes(r.role),'review.role');roles.push(r.role);text(r.reviewer,'review.identity');reviewers.push(r.reviewer);
      equal(r.relationship,'non-author','review.independence');check(!s.authors.includes(r.reviewer),'review.independence','author cannot review own subject');
      equal(r.decision,'accept','review.verdict');equal(r.findings,[],'review.findings');text(r.rationale,'review.rationale');
      setEqual(r.obligations,s.obligations.map(o=>o.id),'review.obligations');setEqual(r.dimensions,dims.map(d=>`${d.feature}:${d.dimension}`),'review.dimensions');
      setEqual(r.paths,s.artifacts.map(a=>`${a.repository}:${a.path}`),'review.paths');setEqual(r.decisions,decisionIds,'review.decisions');
    }
    setEqual(roles,['authority','evidence'],'review.roles');unique(reviewers,'review.independence');
    setEqual(event.dependencies.map(d=>d.feature),e.dependencies,'dependency.inventory');
    for(const d of event.dependencies) {
      shape(d,'feature event','dependency');const dependency=entries.get(d.feature);
      check(dependency?.state==='accepted','dependency.accepted',d.feature);equal(d.event,dependency.acceptedHistory.at(-1)?.sha256,'dependency.current');
    }
    if(e.milestone==='M12') {
      check(register.entries.filter(x=>x.milestone!=='M12').every(x=>x.state==='accepted'),'readiness.prerequisites','all behavior and exclusion cells required');
      for(let item=1;item<=7;item++)check(s.obligations.some(o=>o.layer==='core' && o.applicable && o.source==='spec:openbindings.md' && o.clause===`OBI-B-02 item ${item}`),'readiness.core',`item ${item}`);
    }
  }
}
