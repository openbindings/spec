#!/usr/bin/env python3
"""Run offline debug or real loopback-only native probes. No external networking."""
import argparse, base64, copy, gzip, hashlib, http.client, http.server, json, os, re, threading, urllib.parse
from collections import Counter
from email import policy
from email.parser import BytesParser
from pathlib import Path
from cases import CASES
from interpreter import ABSENT, Cannot, Interpreter, complete, parse_artifact

HERE=Path(__file__).resolve().parent
CANDIDATE_HASH='1f4b76b52706996f5061ec8f81a01fc3852d7599b0a34d8d07440daae0cd986b'

def authority_root():
    return Path(os.environ.get('SPEC_ROOT',str(HERE.parents[2])))
def verify_hashes():
    root=authority_root()
    candidate='binding-specs/openapi-3.0/openbindings.openapi-3.0.md'
    for path,want in [(candidate,CANDIDATE_HASH)]:
        actual=hashlib.sha256((root/path).read_bytes()).hexdigest()
        assert actual==want,(path,actual,want)
        if path==candidate:(HERE/'candidate-pinned-r4.md').write_bytes((root/path).read_bytes())
    return {'candidate_sha256':CANDIDATE_HASH,'core_sha256':hashlib.sha256((root/'openbindings.md').read_bytes()).hexdigest()}
def portable(v):
    if isinstance(v,bytes):return {'$bytes_base64':base64.b64encode(v).decode()}
    if isinstance(v,dict):return {k:portable(x) for k,x in v.items()}
    if isinstance(v,list):return [portable(x) for x in v]
    return v
def materialize(v,port):
    if isinstance(v,str):return v.replace('__PORT__',str(port))
    if isinstance(v,bytes):
        for codec in ('utf-8','utf-16-le','utf-16-be'):
            v=v.replace('__PORT__'.encode(codec),str(port).encode(codec))
        return v
    if isinstance(v,dict):return {k:materialize(x,port) for k,x in v.items()}
    if isinstance(v,list):return [materialize(x,port) for x in v]
    return v

def query_pairs(q):
    return [(urllib.parse.unquote(x.split('=',1)[0]),urllib.parse.unquote(x.split('=',1)[1] if '=' in x else '')) for x in q.split('&') if x]
def pair_groups(pairs):
    out={}
    for n,v in pairs:out.setdefault(n,[]).append(v)
    return out

def observe(method,url,headers,body):
    p=urllib.parse.urlsplit(url)
    hs={n.lower():v for n,v in headers.items()}
    return {'method':method,'path':p.path,'query':query_pairs(p.query),'headers':hs,'body':body}

def compare_native(actual,want):
    assert actual['method']==want['method'],('method',actual['method'],want['method'])
    # Percent-encoded unreserved octets may vary, but a changed reserved delimiter
    # changes structure. This oracle deliberately does not decode %2F into '/'.
    unreserved=re.compile(r'%([0-9A-Fa-f]{2})')
    def norm(s):return unreserved.sub(lambda m:chr(int(m[1],16)) if chr(int(m[1],16)) in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~' else '%'+m[1].upper(),s)
    assert norm(actual['path'])==norm(want['path']),('path',actual['path'],want['path'])
    assert pair_groups(actual['query'])==pair_groups(want['query']),('query',actual['query'],want['query'])
    h=actual['headers'];body=actual['body']
    for n,v in want['headers'].items():assert h.get(n)==v,('header',n,h.get(n),v)
    for n in want.get('absent_headers',[]):assert n not in h,('unexpected header',n)
    if 'body_json' in want:assert json.loads(body)==want['body_json'],('JSON body',body)
    elif 'gzip_json' in want:assert json.loads(gzip.decompress(body))==want['gzip_json']
    elif 'form' in want:assert pair_groups(urllib.parse.parse_qsl(body.decode(),keep_blank_values=True))==pair_groups(want['form']),('form',body)
    elif 'parts' in want:
        assert h.get('content-type','').split(';')[0].lower()==want['media']
        msg=BytesParser(policy=policy.default).parsebytes(('Content-Type: '+h['content-type']+'\r\nMIME-Version: 1.0\r\n\r\n').encode()+body)
        assert msg.is_multipart(),'multipart framing'
        got=[]
        for part in msg.iter_parts():
            # Do not decode Content-Transfer-Encoding: native body bytes themselves
            # carry format:byte text; this is an independent wire assertion.
            payload=part.get_payload(decode=False)
            data=payload.encode('utf-8','surrogateescape') if isinstance(payload,str) else payload
            if part.get_content_charset() is None:
                # email policy may replace non-ASCII octets in decoded text; its
                # decode=True path is exact for parts without transfer encoding.
                if not part.get('Content-Transfer-Encoding'):data=part.get_payload(decode=True)
            got.append({'name':part.get_param('name',header='content-disposition'),'body_hex':data.hex(),'headers':{k.lower():v for k,v in part.items()}})
            assert part.get_filename() is None,'generated filename not authorized'
        assert len(got)==len(want['parts']),('part count',len(got),len(want['parts']))
        # Property ordering is free, ordering of repeated same-name parts remains.
        groups={}
        for x in got:groups.setdefault(x['name'],[]).append(x)
        for w in want['parts']:
            assert groups.get(w['name']),('missing part',w['name'])
            g=groups[w['name']].pop(0);assert g['body_hex']==w['body_hex'],('part bytes',g,w)
            for n,v in w.get('headers',{}).items():assert g['headers'].get(n)==v,('part header',n,g,w)
            for n in w.get('absent_headers',[]):assert n not in g['headers'],('part unexpected header',n)
    elif 'xml_text' in want:
        # This fixture has a UTF-16 XML declaration. BOM and text are independent
        # native facts; no interpreter decoding is used as an oracle.
        assert body.startswith((b'\xff\xfe',b'\xfe\xff'))
        assert body.decode('utf-16')==want['xml_text']
    else:assert body.hex()==want['body_hex'],('body',body.hex(),want['body_hex'])

def structural_obi_check(o):
    # Bounded check for the emitted fixture subset, not a whole-core validator.
    assert o['openbindings']=='0.2.0' and isinstance(o['operations'],dict)
    for mapname in ('operations','sources','bindings'):
        assert all(re.fullmatch(r'[A-Za-z0-9_][A-Za-z0-9_.-]*',k) for k in o[mapname])
    for b in o['bindings'].values():
        assert b['operation'] in o['operations'] and b['source'] in o['sources']
        assert set(b)<={'operation','source','content'}
    for s in o['sources'].values():assert set(s)<={'kind','content'} and isinstance(s['kind'],str)
    for dep in o.get('dependencies',{}).values():
        assert dep['operation'] in o['operations'] and set(dep)<={'operation','description','kinds'}
    for op in o['operations'].values():
        assert set(op)<={'description','input','output'}
        for key in ('input','output'):assert isinstance(op[key],(dict,bool))

class Harness:
    def __init__(self,native):
        self.native=native;self.current=None;self.requests=[];self.acquisitions=[];self.fetch_urls=[];self.server=None
        if native:
            owner=self
            class Handler(http.server.BaseHTTPRequestHandler):
                protocol_version='HTTP/1.1'
                def log_message(self,*args):pass
                def handle_request(self):
                    path=urllib.parse.urlsplit(self.path).path
                    # Artifact paths are selected by fixture resource map, never
                    # inferred from the candidate interpreter's source output.
                    if self.command=='GET' and path in owner.current['resources']:
                        res=owner.current['resources'][path];owner.acquisitions.append(self.path)
                    elif self.command=='GET' and path in owner.pending_artifacts:
                        res={'status':404,'body':b'not available'};owner.acquisitions.append(self.path)
                    else:
                        n=int(self.headers.get('Content-Length','0'));body=self.rfile.read(n)
                        hdr={k:v.encode('latin-1').decode('utf-8') for k,v in self.headers.items()}
                        owner.requests.append(observe(self.command,self.path,hdr,body))
                        index=owner.current.get('_dispatch_count',0);owner.current['_dispatch_count']=index+1
                        res=owner.current.get('responses_sequence',[owner.current['response']])[index]
                    self.send_response(res.get('status',200))
                    for k,v in res.get('headers',[]):self.send_header(k,v)
                    data=res.get('body',b'');self.send_header('Content-Length',str(len(data)+(20 if res.get('truncated') else 0)))
                    self.send_header('Connection','close');self.end_headers()
                    if self.command!='HEAD':self.wfile.write(data)
                    self.close_connection=True
                do_GET=do_POST=do_PUT=do_PATCH=do_DELETE=do_OPTIONS=do_HEAD=do_TRACE=handle_request
            self.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
            self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start();self.port=self.server.server_port
        else:self.port=18080
        self.pending_artifacts=set()
    def close(self):
        if self.server:self.server.shutdown();self.server.server_close();self.thread.join()
    def fetch(self,url):
        self.fetch_urls.append(url)
        parsed=urllib.parse.urlsplit(url)
        if parsed.scheme!='http' or parsed.hostname not in ('127.0.0.1','localhost') or parsed.port!=self.port:raise Cannot('unavailable','loopback acquisition policy')
        for i in range(5):
            parsed=urllib.parse.urlsplit(url);path=parsed.path or '/';self.pending_artifacts.add(path)
            if self.native:
                conn=http.client.HTTPConnection(parsed.hostname,parsed.port,timeout=3);conn.request('GET',path+('?' + parsed.query if parsed.query else ''));res=conn.getresponse();status=res.status;headers=dict(res.getheaders());raw=res.read();conn.close()
            else:
                res=self.current['resources'].get(path,{'status':404});status=res.get('status',200);headers=dict(res.get('headers',[]));raw=res.get('body',b'')
            if status in (301,302,303,307,308):
                url=urllib.parse.urljoin(url,headers['Location']);n=urllib.parse.urlsplit(url)
                if n.hostname not in ('127.0.0.1','localhost') or n.port!=self.port:raise Cannot('unavailable','redirect acquisition policy')
                continue
            if not 200<=status<300:raise Cannot('unavailable','HTTP acquisition status')
            return raw,url
        raise Cannot('unavailable','artifact redirect limit')
    def dispatch(self,req):
        url=req.url;headers=dict(req.headers);observations=[]
        def origin(u):
            p=urllib.parse.urlsplit(u);return p.scheme,p.hostname,p.port or (443 if p.scheme=='https' else 80)
        for index in range(5):
            if not self.native:
                observations.append(observe(req.method,url,headers,req.body))
                f=self.current.get('responses_sequence',[self.current['response']])[index]
                status,hs,b,truncated=f['status'],f['headers'],f['body'],f.get('truncated',False)
            else:
                parsed=urllib.parse.urlsplit(url)
                assert parsed.scheme=='http' and parsed.hostname in ('127.0.0.1','localhost') and parsed.port==self.port,'loopback-only dispatch policy'
                conn=http.client.HTTPConnection(parsed.hostname,parsed.port,timeout=3)
                conn.putrequest(req.method,parsed.path+('?' + parsed.query if parsed.query else ''))
                for k,v in headers.items():conn.putheader(k.encode('ascii'),v.encode('utf-8'))
                if req.body:conn.putheader('Content-Length',str(len(req.body)))
                conn.endheaders(req.body if req.body else None)
                res=conn.getresponse();truncated=False
                try:b=res.read()
                except http.client.IncompleteRead as e:b=e.partial;truncated=True
                observations.append(self.requests[-1]);status,hs=res.status,res.getheaders();conn.close()
            if status in (307,308) and self.current['context'].get('follow_redirect'):
                dest=urllib.parse.urljoin(url,dict(hs)['Location'])
                if origin(dest)!=origin(url):headers={k:v for k,v in headers.items() if k.lower() not in req.protected_headers}
                url=dest
                continue
            self.observed=observations[0];self.followups=observations[1:]
            return status,hs,b,truncated
        raise RuntimeError('redirect runtime policy limit')

def unit_probes():
    rows=[]
    for name,source,expected in [('YAML-Core-exact-scalars','a: 012\nb: 0o10\nc: 0x10\nd: TRUE\ne: yes\nf: null\n200: okay',{'a':12,'b':8,'c':16,'d':True,'e':'yes','f':None,'200':'okay'}),('YAML-string-key-spelling','true: yes\n01: one',{'true':'yes','01':'one'}),('YAML-explicit-compatible-quoted-tags','a: !!int \"3\"\nb: !!bool \"true\"',{'a':3,'b':True})]:
        try:assert parse_artifact(source)==expected;rows.append({'id':name,'pass':True,'category':'parser-value'})
        except Exception as e:rows.append({'id':name,'pass':False,'error':str(e)})
    fixture=materialize(copy.deepcopy(CASES[0]),18080)
    req=Interpreter(lambda url: (_ for _ in ()).throw(Cannot('unavailable','unit fetch'))).prepare(fixture['obi'],{})
    cases=[('cancelled-no-output',200,[],b'{"native":true}',{'cancelled':True}),
           ('204-forbidden-actual-content',204,[],b'forbidden',{}),
           ('no-content-required-header-failure',204,[],b'',{}),
           ('no-content-invalid-field-grammar',204,[('X',' bad')],b'',{})]
    for name,status,headers,body,kw in cases:
        q=copy.copy(req);q.operation={'responses':{'204':{'description':'none','headers':{'X':{'required':True}}}}} if name=='no-content-required-header-failure' else {'responses':{'200':{'description':'ok','content':{'application/json':{}}},'204':{'description':'none'}}}
        result=complete(q,status,headers,body,**kw)
        rows.append({'id':name,'category':'direct-completion-boundary','pass':result['success'] is False and result['values']==[],'result':result})
    return rows

def variation_and_mutation_probes():
    rows=[];base={'method':'POST','path':'/x~a','query':[('q','a b'),('q','c'),('other','x')],'headers':{'x-v':'native'},'body':b'{"x":1}'}
    want={'method':'POST','path':'/x~a','query':[['other','x'],['q','a b'],['q','c']],'headers':{'x-v':'native'},'body_json':{'x':1}}
    variants=[('URI-unreserved-and-JSON-whitespace',{**base,'path':'/x%7ea','body':b'{ "x" : 1 }'}),('query-independent-name-order',{**base,'query':[('other','x'),('q','a b'),('q','c')]})]
    for name,v in variants:
        try:compare_native(v,want);rows.append({'id':name,'pass':True,'category':'permitted-variation'})
        except Exception as e:rows.append({'id':name,'pass':False,'error':str(e)})
    mutations=[('changed-method',{**base,'method':'GET'}),('changed-target',{**base,'path':'/y~a'}),('changed-query-value',{**base,'query':[('q','wrong'),('q','c'),('other','x')]}),('changed-array-order',{**base,'query':[('q','c'),('q','a b'),('other','x')]}),('changed-header-credential-destination',{**base,'headers':{'different':'native'}}),('changed-body-value',{**base,'body':b'{"x":2}'})]
    for name,v in mutations:
        try:compare_native(v,want);rows.append({'id':name,'pass':False,'error':'semantic mutation accepted'})
        except AssertionError:rows.append({'id':name,'pass':True,'category':'semantic-mutation-killed'})
    # Form spelling alternatives deliberately use a separate standards parser.
    formwant={'method':'POST','path':'/form','query':[],'headers':{},'form':[['title','two words'],['x','/']]}
    for name,b in [('form-plus-uppercase',b'title=two+words&x=%2F'),('form-percent20-lowercase',b'x=%2f&title=two%20words')]:
        try:compare_native({'method':'POST','path':'/form','query':[],'headers':{},'body':b},formwant);rows.append({'id':name,'pass':True,'category':'permitted-variation'})
        except Exception as e:rows.append({'id':name,'pass':False,'error':str(e)})
    return rows

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--native',action='store_true');ap.add_argument('--only');args=ap.parse_args()
    hashes=verify_hashes();h=Harness(args.native);rows=[];counts=Counter();allcases=[c for c in CASES if args.only is None or args.only in c['id']]
    (HERE/'fixtures.json').write_text(json.dumps(portable(CASES),ensure_ascii=False,indent=2)+'\n')
    (HERE/'generated.obi.json').write_text(json.dumps(next(c['obi'] for c in CASES if c['id']=='generated-current-core-OBI'),indent=2)+'\n')
    (HERE/'hand-authored.obi.json').write_text(json.dumps(next(c['obi'] for c in CASES if c['id']=='jsonata-nested-lexical-scope'),indent=2)+'\n')
    (HERE/'generated-callbacks.obi.json').write_text(json.dumps(next(c['obi'] for c in CASES if c['id']=='generated-callback-dependencies'),indent=2)+'\n')
    try:
        for original in allcases:
            c=materialize(copy.deepcopy(original),h.port);h.current=c;before=len(h.requests);before_art=len(h.acquisitions);before_fetch=len(h.fetch_urls)
            row={'id':c['id'],'authority':c['authority'],'origin':c['origin']}
            try:
                structural_obi_check(c['obi']);interp=Interpreter(h.fetch)
                try:req=interp.prepare(c['obi'],c.get('input',ABSENT),c['context'])
                except Cannot as e:
                    assert 'error' in c,('unexpected refusal',str(e))
                    assert e.kind==c['error'],('wrong distinction',e.kind,c['error'],e.message)
                    assert len(h.requests)==before,'refused input dispatched'
                    row.update(pass_=True,category='pre-dispatch-refusal',classification=e.kind);counts['pre_dispatch_refusals']+=1
                else:
                    assert 'error' not in c,('expected refusal',c.get('error'))
                    status,headers,body,trunc=h.dispatch(req);compare_native(h.observed,c['expected_request'])
                    if 'expected_followup' in c:
                        assert len(h.followups)==1
                        compare_native(h.followups[0],c['expected_followup'])
                    else:assert not h.followups
                    result=complete(req,status,headers,body,truncated=trunc)
                    assert {k:result[k] for k in ('success','values')}==c['expected_completion'],('completion',result,c['expected_completion'])
                    row.update(pass_=True,category='native-request-and-completion' if args.native else 'offline-prepared-request-and-simulated-completion',observed_request=portable(h.observed),observed_followups=portable(h.followups),completion=result)
                    counts['native_requests' if args.native else 'offline_prepared_requests']+=1
                    # Two boundary mutations against each authored completion.
                    wrong_success={**result,'success':not result['success']}
                    wrong_values={**result,'values':result['values']+[None]}
                    for mutant in (wrong_success,wrong_values):assert {k:mutant[k] for k in ('success','values')}!=c['expected_completion']
                    counts['completion_mutations_killed']+=2
                if 'expected_fetch_urls' in c:assert h.fetch_urls[before_fetch:]==c['expected_fetch_urls'],('source resolver arguments',h.fetch_urls[before_fetch:],c['expected_fetch_urls'])
                if 'expected_artifact_paths' in c and args.native:assert h.acquisitions[before_art:]==c['expected_artifact_paths'],('native artifact paths',h.acquisitions[before_art:],c['expected_artifact_paths'])
                if 'expected_resource_urls' in c:assert list(interp.r.docs)==c['expected_resource_urls'],('physical resource bases',list(interp.r.docs),c['expected_resource_urls'])
                row['pass']=row.pop('pass_')
            except Exception as e:
                row.update({'pass':False,'error':repr(e)});print('FAIL',c['id'],repr(e))
            row['resolver_request_urls']=h.fetch_urls[before_fetch:]
            row['registered_resource_urls']=list(interp.r.docs)
            row['artifact_HTTP_acquisitions']=len(h.acquisitions)-before_art
            row['artifact_HTTP_paths']=h.acquisitions[before_art:]
            rows.append(row)
        rows+=unit_probes()+variation_and_mutation_probes()
    finally:h.close()
    counts['artifact_HTTP_acquisitions']=len(h.acquisitions);counts['actual_HTTP_dispatches']=len(h.requests)
    manifest={name:hashlib.sha256((HERE/name).read_bytes()).hexdigest() for name in ('interpreter.py','yaml_ast.rb','cases.py','run.py','fixtures.json','hand-authored.obi.json','generated.obi.json','generated-callbacks.obi.json')}
    (HERE/'evidence-hashes.json').write_text(json.dumps(manifest,indent=2)+'\n')
    summary={**hashes,'evidence_sha256':manifest,'mode':'loopback-native' if args.native else 'offline-only-zero-network','passed':sum(r['pass'] for r in rows),'failed':sum(not r['pass'] for r in rows),'total':len(rows),'counts':dict(counts),'limitations_file':'README.md','results':rows}
    output=HERE/('results-native.json' if args.native else 'results-offline.json');output.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in summary.items() if k!='results'},indent=2))
    return 1 if summary['failed'] else 0
if __name__=='__main__':raise SystemExit(main())
