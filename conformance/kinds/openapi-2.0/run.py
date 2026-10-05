"""Run only this directory's fresh probe suite. Requires Python stdlib, Ruby/Psych, loopback socket permission."""
import base64, copy, hashlib, json, os, sys, time, traceback
from pathlib import Path
from interpreter import Interpreter, ABSENT
from native_oracle import NativeFixture, native_check, operation_check, equal
from cases import build
from synthesize import translate

HERE=Path(__file__).resolve().parent
SPEC_ROOT=Path(os.environ.get('SPEC_ROOT',HERE.parents[2]))
CANDIDATE=SPEC_ROOT/'binding-specs/openapi-2.0/openbindings.openapi-2.0.md'
CORE=SPEC_ROOT/'openbindings.md'
POLICY=SPEC_ROOT/'binding-specs/PROJECT-POLICY.md'
PINS={'candidate':'397afbf81fec6e41d279e7e47e5b7f52558d1ec1dacca63e3221cb0f52842b8d','core':'afaa04552f5330db6baa13deeb0516d8df0698ae57be26301e2f4bdd341dc1b5','policy':'b580affc92223d5f0e75d66d17363c8befa1951ed7c4c8ad825a8470dd7a0b3c'}
def write(name,value): (HERE/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def replace_ports(v,port,other):
    if isinstance(v,str): return v.replace('OTHERPORT',str(other)).replace('PORT',str(port))
    if isinstance(v,list): return [replace_ports(x,port,other) for x in v]
    if isinstance(v,dict): return {k:replace_ports(x,port,other) for k,x in v.items()}
    return v

def materialize(case,port,other):
    case=replace_ports(case,port,other)
    for art in case['artifacts'].values():
        raw=base64.b64decode(art.get('body_b64',''))
        if raw.startswith(b'\xff\xfe') or raw.startswith(b'\xfe\xff'):
            raw=raw.decode('utf-16').replace('OTHERPORT',str(other)).replace('PORT',str(port)).encode('utf-16')
        else: raw=raw.replace(b'OTHERPORT',str(other).encode()).replace(b'PORT',str(port).encode())
        art['body_b64']=base64.b64encode(raw).decode()
    return case

def execute(case,fixture,other,mutation=None):
    fixture.records=[]; other.records=[]; fixture.acquisitions=[]; other.acquisitions=[]
    fixture.artifacts=case['artifacts']; fixture.response=[case['response'],case['redirect_response']] if 'redirect_response' in case else case['response']; other.response=case.get('other_response',case['response'])
    caller=ABSENT if case['caller']=='__ABSENT__' else case['caller']; interpreter=Interpreter(mutation)
    result=interpreter.run(case['obi'],caller,case['context']); records=fixture.records+other.records; acquisitions=fixture.acquisitions+other.acquisitions
    error=None
    try:
        native_check(records,case['native'])
        for k,v in case['result'].items(): equal(result.get(k),v,'operation '+k)
        equal(result['dispatches'],len(records),'dispatch accounting')
        if 'acquisitions' in case: equal(acquisitions,case['acquisitions'],'artifact acquisitions')
        if 'expected_operation' in case: equal(case['obi']['operations']['invoke'],case['expected_operation'],'independent synthesized schema')
        operation_check(case['obi'],case['caller'],result['values'])
    except Exception as e: error=str(e)
    return {'name':case['name'],'origin':case['origin'],'pass':error is None,'error':error,'actual':result,'native_observations':records,'artifact_acquisitions':acquisitions}

def main():
    hashes={k:hashlib.sha256(p.read_bytes()).hexdigest() for k,p in [('candidate',CANDIDATE),('core',CORE),('policy',POLICY)]}
    equal(hashes,PINS,'exact public text pins')
    (HERE/'candidate-pinned.md').write_bytes(CANDIDATE.read_bytes())
    write('pins.json',{'applied':hashes,'initial_candidate_read':'c112468784fff85d38c020108cbe8c1c6851d272fe6b93e3f07575ab1347151b','revision_note':'Complete r2 public candidate reread before final execution; no historical specifications, corpora, SDKs, author notes or reviews were read.'})
    fixture=NativeFixture(); other=NativeFixture(); results=[]
    try:
        cases=[materialize(c,fixture.port,other.port) for c in build()]; write('expanded-cases.json',cases)
        obi_dir=HERE/'obis'; obi_dir.mkdir(exist_ok=True)
        for case in cases:
            write('obis/'+case['name']+'.json',case['obi'])
            try: result=execute(case,fixture,other)
            except Exception as e: result={'name':case['name'],'pass':False,'error':traceback.format_exc()}
            results.append(result)
            print(('PASS ' if result['pass'] else 'FAIL ')+case['name']+((': '+result['error']) if not result['pass'] else ''),flush=True)
        byname={c['name']:c for c in cases}; mutations=[]
        for name,mutation in [('parameter-qualified-names-path-utf8','path-data-becomes-separator'),('schema-closed-vocabulary-unknown-no-behavior','drop-body-member'),('parameter-collection-multi','query-reverse'),('response-empty-no-value','null-for-absence')]:
            result=execute(byname[name],fixture,other,mutation); result['mutation']=mutation; result['detected']=not result['pass']; mutations.append(result)
        write('mutation-results.json',mutations)
        # A permitted request variation really executes natively: order across distinct query names.
        variation=copy.deepcopy(byname['parameter-qualified-names-path-utf8']); variation['name']='permitted-query-order-and-percent-case'
        original=Interpreter.exchange
        def altered(self,req):
            from urllib.parse import urlsplit,urlunsplit
            p=urlsplit(req['url']); segments=p.query.split('&'); grouped={}
            for segment in segments: grouped.setdefault(segment.split('=')[0],[]).append(segment)
            query='&'.join(x for group in reversed(list(grouped.values())) for x in group)
            req['url']=urlunsplit((p.scheme,p.netloc,p.path.replace('%2F','%2f'),query,'')); return original(self,req)
        Interpreter.exchange=altered
        vr=execute(variation,fixture,other); Interpreter.exchange=original
        variations=[vr]
        # Independently observe percent-20 form spacing and RFC7578 default nonfile part metadata.
        for case_name,label in [('form-urlencoded-preserves-newline-space-plus','permitted-form-space-percent20'),('form-multipart-ascii-for-default-variation','permitted-multipart-default-text-headers')]:
            case=copy.deepcopy(byname[case_name]); case['name']=label
            def alternate(self,req):
                if label=='permitted-form-space-percent20': req['body']=req['body'].replace(b'+',b'%20')
                else: req['body']=req['body'].replace(b'Content-Type: text/plain; charset=UTF-8\r\n',b'')
                return original(self,req)
            Interpreter.exchange=alternate; variations.append(execute(case,fixture,other)); Interpreter.exchange=original
        # Conservative synthesis refusal: draft04 exclusiveMinimum boolean must not silently become 2020-12.
        refusal=[]
        for schema in [{'type':'number','minimum':0,'exclusiveMinimum':True},{'type':'object','readOnly':True},{'type':'string','pattern':'x'}]:
            try: translate(schema); refused=False
            except ValueError: refused=True
            refusal.append({'source_schema':schema,'refused':refused})
        write('permitted-variation-results.json',variations); write('synthesis-refusals.json',refusal)
        write('results.json',results)
        summary={'public_text_hashes':hashes,'cases':len(results),'passed':sum(r['pass'] for r in results),'failed':[r['name'] for r in results if not r['pass']],'positive_successes':sum(c['result']['completion']=='success' for c in cases),'predispatch_negatives':sum(not c['native'] for c in cases),'postdispatch_failures':sum(c['result']['completion']=='failure' and bool(c['native']) for c in cases),'synthesized_cases':sum(c['origin']=='synthesized' for c in cases),'native_service_requests':sum(len(r.get('native_observations',[])) for r in results),'artifact_http_acquisitions':sum(len(r.get('artifact_acquisitions',[])) for r in results),'mutation_cases':len(mutations),'mutations_detected':sum(r['detected'] for r in mutations),'permitted_variations':len(variations),'permitted_variations_passed':sum(v['pass'] for v in variations),'synthesis_refusals':sum(r['refused'] for r in refusal),'python':sys.version,'loopback_ports':[fixture.port,other.port]}
        write('summary.json',summary); print(json.dumps(summary,indent=2))
        return bool(summary['failed'] or summary['mutations_detected']!=4 or not all(v['pass'] for v in variations))
    finally: fixture.close(); other.close()
if __name__=='__main__': sys.exit(main())
