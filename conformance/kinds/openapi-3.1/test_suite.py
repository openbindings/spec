#!/usr/bin/env python3
"""Run from this directory: python3 test_suite.py. Uses loopback HTTP only."""
import base64
import copy
import hashlib
import http.server
import io
import json
import os
import pathlib
import re
import sys
import threading
import unittest
from interpreter import (ABSENT, CANDIDATE_SHA256, CORE_SHA256, KIND, Cannot,
                         Interpreter, Resolver, check_mapping, mapping,
                         parse_artifact, json_text, esc, synthesize_json_operation)
from native_oracle import assert_request

HERE=pathlib.Path(__file__).resolve().parent
SPEC_ROOT=pathlib.Path(os.environ.get('SPEC_ROOT',str(HERE.parents[2])))
RESULTS=[]
NETWORK_COUNTS={'acquisitions':0,'dispatches':0}
OFFLINE='--offline' in sys.argv

def fixture(oas=None,method='get',path='/probe',binding=None):
    if oas is None:oas=oas_doc(method=method,path=path)
    return {'openbindings':'0.2.0','operations':{'probe':{'input':True,'output':True}},
            'sources':{'api':{'kind':KIND,'content':{'document':oas}}},
            'bindings':{'native':{'operation':'probe','source':'api',
                        'content':binding or {'target':'/paths/'+esc(path)+'/'+method}}}}

def oas_doc(method='get',path='/probe',operation=None):
    return {'openapi':'3.1.2','info':{'title':'Fresh independent native fixture','version':'1'},
            'paths':{path:{method:operation or {'responses':{'200':{'description':'ok','content':{'application/json':{}}}}}}}}

def doc(o):return o['sources']['api']['content']['document']
def op(o,path='/probe',method='get'):return doc(o)['paths'][path][method]
def parameter(name,loc='query',schema=None,**more):
    return {'name':name,'in':loc,'schema':schema or {'type':'string'},**more}
def body_operation(mt='application/json',schema=None,**more):
    return {'requestBody':{'content':{mt:{'schema':schema} if schema is not None else {}}},
            'responses':{'200':{'description':'ok','content':{'application/json':{}}}},**more}

def json_safe(x):
    if isinstance(x,bytes):return {'base64':base64.b64encode(x).decode()}
    if x is ABSENT:return {'absent':True}
    if callable(x):return {'context_converter':'RFC8259 scalar spelling'}
    raise TypeError(type(x).__name__)

class NativeServer(http.server.ThreadingHTTPServer):
    daemon_threads=True
    def __init__(self):
        super().__init__(('127.0.0.1',0),Handler)
        self.origin='http://127.0.0.1:'+str(self.server_address[1])
        self.resources={}
        self.acquisition_paths=[]
        self.observed=[]
        self.reply=(200,[('Content-Type','application/json')],b'{"ok":true}')
        self.thread=threading.Thread(target=self.serve_forever,daemon=True)
        self.thread.start()

class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version='HTTP/1.1'
    def log_message(self,*args):pass
    def handle_one(self):
        length=int(self.headers.get('Content-Length','0'))
        body=self.rfile.read(length)
        resource=self.server.resources.get(self.path)
        if resource is not None:
            NETWORK_COUNTS['acquisitions']+=1
            self.server.acquisition_paths.append(self.path)
            status,headers,data=resource
        else:
            NETWORK_COUNTS['dispatches']+=1
            self.server.observed.append({'method':self.command,'target':self.path,
                'headers':list(self.headers.items()),'body':body})
            status,headers,data=self.server.reply
        self.send_response(status)
        for k,v in headers:self.send_header(k,v)
        if not any(k.lower()=='content-length' for k,v in headers):self.send_header('Content-Length',str(len(data)))
        self.send_header('Connection','close');self.end_headers()
        if self.command!='HEAD':self.wfile.write(data)
        self.close_connection=True
    do_GET=do_POST=do_PUT=do_DELETE=do_OPTIONS=do_HEAD=do_PATCH=do_TRACE=handle_one

class InMemoryServer:
    """Debug-only substitute; these results are never labeled HTTP evidence."""
    origin='http://127.0.0.1:41000'
    def __init__(self):self.resources={};self.acquisition_paths=[];self.observed=[];self.reply=(200,[],b'')
    def shutdown(self):pass
    def server_close(self):pass

class InMemoryResolver(Resolver):
    def __init__(self,server):super().__init__();self.server=server
    def fetch(self,url):
        import urllib.parse
        self.requests.append(url)
        parsed=urllib.parse.urlsplit(url);path=parsed.path+('?' + parsed.query if parsed.query else '')
        if path not in self.server.resources:raise Cannot('unavailable','in-memory resource absent')
        status,headers,raw=self.server.resources[path]
        if 300<=status<400:
            redirect=next(v for k,v in headers if k.lower()=='location')
            return self.fetch(urllib.parse.urljoin(url,redirect))
        if not 200<=status<300:raise Cannot('unavailable','in-memory unsuccessful acquisition')
        artifact=parse_artifact(raw);self.register(artifact,url)
        return artifact,url

class InMemoryInterpreter(Interpreter):
    def __init__(self,server):super().__init__(InMemoryResolver(server));self.server=server
    def invoke(self,obi,binding,value=ABSENT,ctx=None):
        import urllib.parse
        r=self.prepare(obi,binding,value,ctx);url=urllib.parse.urlsplit(r['url'])
        self.server.observed.append({'method':r['method'],'target':url.path+('?' + url.query if url.query else ''),
                 'headers':list(r['headers'].items()),'body':r['body'] or b''})
        status,headers,body=self.server.reply
        if r['method']=='HEAD':body=b''
        complete=all(k.lower()!='content-length' or int(v)==len(body) for k,v in headers)
        return self.complete(r,status,headers,body,complete)

class Probes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.server=InMemoryServer() if OFFLINE else NativeServer()
    @classmethod
    def tearDownClass(cls):cls.server.shutdown();cls.server.server_close()
    def setUp(self):
        self.i=InMemoryInterpreter(self.server) if OFFLINE else Interpreter()
        self.server.observed.clear();self.server.resources.clear();self.server.acquisition_paths.clear()
        self.server.reply=(200,[('Content-Type','application/json')],b'{"ok":true}')
        self.ctx={'server':self.server.origin}
    def rejected(self,fn,category=None):
        before=len(self.server.observed)
        with self.assertRaises(Cannot) as c:fn()
        if category:self.assertEqual(c.exception.category,category)
        self.assertEqual(len(self.server.observed),before,'interpretation failure must prevent dispatch')
    def native(self,obi,value,expected,result=None,ctx=None,binding='native'):
        if ctx is None:ctx=self.ctx
        out=self.i.invoke(obi,binding,value,ctx)
        self.assertTrue(self.server.observed,'real HTTP request was not observed')
        assert_request(self.server.observed[-1],expected)
        if result is None:result={'success':True,'outputs':[{'ok':True}]}
        for k,v in result.items():self.assertEqual(out[k],v)
        # Full expanded current-core fixtures are saved for every native case.
        case=self._testMethodName.removeprefix('test_')
        path=HERE/'fixtures'/('in-memory-debug' if OFFLINE else 'executed')/case
        path.mkdir(parents=True,exist_ok=True)
        (path/'interface.obi.json').write_text(json_text(obi)+'\n')
        metadata={'candidate_sha256':CANDIDATE_SHA256,'transport':'in-memory debug' if OFFLINE else 'actual loopback HTTP','input':value,'context':ctx,
                  'expected_native':expected,'expected_completion':result,
                  'observed':self.server.observed[-1],'completion':out,
                  'acquisition_resources':self.server.resources,
                  'resolver_request_urls':self.i.r.requests,'registered_resource_urls':list(self.i.r.docs),
                  'artifact_HTTP_paths':self.server.acquisition_paths}
        (path/'interaction.json').write_text(json.dumps(metadata,indent=2,default=json_safe)+'\n')
        return out

def case(name,fn):
    setattr(Probes,'test_'+name,fn)

def pinned(t):
    directory=SPEC_ROOT/'binding-specs/openapi-3.1'
    candidate=directory/'openbindings.openapi-3.1.md'
    core=SPEC_ROOT/'openbindings.md'
    t.assertEqual(hashlib.sha256(candidate.read_bytes()).hexdigest(),CANDIDATE_SHA256)
    (HERE/'candidate-pinned-r5.md').write_bytes(candidate.read_bytes())
case('000_pinned_inputs',pinned)

def hand(t):
    obi=json.loads((HERE/'fixtures/hand-authored.obi.json').read_text())
    t.server.reply=(201,[('Content-Type','Application/JSON')],b'{"metadata":{"unused":1},"job":{"id":"J9"}}')
    value={'key':'a/b','org':'North','labels':['first','second'],'session':'x/y',
           'groups':[{'name':'red','entries':['A','B']},{'name':'blue','entries':['C']}]}
    expected={'method':'POST','path':'/jobs/a%2Fb','query':{'labels':['first','second']},
              'headers':{'X-Mode':'batch','Cookie':'session=x%2Fy'},'media':'application/json',
              'json':{'organization':'North','groups':[
                {'group':'red','entries':[{'id':'A','group':'red','organization':'North'},{'id':'B','group':'red','organization':'North'}]},
                {'group':'blue','entries':[{'id':'C','group':'blue','organization':'North'}]}]}}
    t.native(obi,value,expected,{'success':True,'outputs':[{'id':'J9'}]},binding='submit.http')
case('hand_authored_nested_each_up_native',hand)

def synthesized(t):
    oas=oas_doc(method='post',path='/generated',operation=body_operation())
    obi=synthesize_json_operation(oas,'/generated','post','generated.submit')
    (HERE/'fixtures/synthesized.obi.json').write_text(json_text(obi)+'\n')
    t.native(obi,{'body':{'large':9007199254740991,'null':None,'ordered':['a','b']}},
             {'method':'POST','path':'/generated','query':{},'media':'application/json',
              'json':{'large':9007199254740991,'null':None,'ordered':['a','b']}})
case('synthesized_complete_obi_native',synthesized)

for patch in ('3.1.0','3.1.1','3.1.2'):
    for form in ('object','json_text','yaml_text','object_location','text_location','location_json','location_yaml','redirected_location'):
        def source_case(t,patch=patch,form=form):
            o=fixture();d=doc(o);d['openapi']=patch;d['servers']=[{'url':'/native'}]
            text=json_text(d)
            yaml=f'''openapi: {patch}\ninfo: {{title: Fresh, version: '1'}}\nservers:\n  - url: /native\npaths:\n  /probe:\n    get:\n      responses:\n        200:\n          description: ok\n          content:\n            application/json: {{}}\n'''
            location=t.server.origin+'/description/entry'
            if form=='object':c={'document':d};ctx=t.ctx
            elif form=='json_text':c={'document':text};ctx=t.ctx
            elif form=='yaml_text':c={'document':yaml};ctx=t.ctx
            elif form=='object_location':c={'document':d,'location':location};ctx={}
            elif form=='text_location':c={'document':yaml,'location':location};ctx={}
            else:
                t.server.resources['/description/entry']=(200,[],(yaml if form=='location_yaml' else text).encode())
                c={'location':location};ctx={}
                if form=='redirected_location':
                    d['servers']=[{'url':'../native'}]
                    t.server.resources['/description/entry']=(302,[('Location','/description/final/entry')],b'')
                    t.server.resources['/description/final/entry']=(200,[],json_text(d).encode())
            o['sources']['api']['content']=c
            path='/probe' if form in ('object','json_text','yaml_text') else '/description/native/probe' if form=='redirected_location' else '/native/probe'
            t.native(o,ABSENT,{'method':'GET','path':path,'query':{}},ctx=ctx)
            if form in ('object_location','text_location'):t.assertEqual(t.i.r.requests,[],'embedded document must win without retrieval')
        case('source_'+patch.replace('.','_')+'_'+form,source_case)

for patch in ('3.0.3','3.1.3','3.2.0','3.1',None):
    def patch_bad(t,patch=patch):
        o=fixture();doc(o)['openapi']=patch
        t.rejected(lambda:t.i.invoke(o,'native',{},t.ctx),'invalid')
    case('patch_reject_'+str(patch).replace('.','_'),patch_bad)

for label,content in [('absent',ABSENT),('null',None),('empty',{}),('string','x'),('array',[]),
    ('unknown',{'document':{},'extra':1}),('document_null',{'document':None}),
    ('location_number',{'location':2}),('location_relative',{'location':'relative.yaml'})]:
    def invalid_source(t,content=content):
        o=fixture()
        if content is ABSENT:o['sources']['api'].pop('content')
        else:o['sources']['api']['content']=copy.deepcopy(content)
        t.rejected(lambda:t.i.invoke(o,'native',{},t.ctx),'invalid')
    case('source_invalid_'+label,invalid_source)

for label,text in [('duplicate','openapi: 3.1.2\nopenapi: 3.1.1'),('multiple','---\n{}\n---\n{}'),
  ('complex_key','? [a,b]\n: c'),('infinite','value: .inf'),('bad_tag','value: !!int hello'),
  ('entry_array','[]'),('json_duplicate','{"openapi":"3.1.2","openapi":"3.1.2"}')]:
    def invalid_yaml(t,text=text):
        o=fixture();o['sources']['api']['content']={'document':text}
        t.rejected(lambda:t.i.invoke(o,'native',{},t.ctx),'invalid')
    case('text_invalid_'+label,invalid_yaml)

def yaml_core(t):
    t.assertEqual(parse_artifact('a: YES\nb: true\nc: 0o17\nd: 0x10\ne: +12\n200: null\n'),
                  {'a':'YES','b':True,'c':15,'d':16,'e':12,'200':None})
case('yaml_core_scalars_and_failsafe_keys',yaml_core)

for encoding in ('utf-8-sig','utf-16','utf-32'):
    def acquired_encoding(t,encoding=encoding):
        d=oas_doc();d['servers']=[{'url':t.server.origin}]
        t.server.resources['/description/encoded']=(200,[],json_text(d).encode(encoding))
        o=fixture();o['sources']['api']['content']={'location':t.server.origin+'/description/encoded'}
        t.native(o,{}, {'method':'GET','path':'/probe','query':{}},ctx={})
    case('acquisition_encoding_'+encoding.replace('-','_'),acquired_encoding)

def failed_acquisition(t):
    o=fixture();o['sources']['api']['content']={'location':t.server.origin+'/description/denied'}
    t.server.resources['/description/denied']=(403,[],json_text(oas_doc()).encode())
    t.rejected(lambda:t.i.invoke(o,'native',{},t.ctx),'unavailable')
case('unsuccessful_acquisition_body_is_not_artifact',failed_acquisition)

for target in ('#/paths/~1probe/get','/paths/~1probe/GET','/paths/~1probe/query','/webhooks/hook/post','/paths/~2probe/get',None):
    def target_bad(t,target=target):
        o=fixture();o['bindings']['native']['content']['target']=target
        t.rejected(lambda:t.i.invoke(o,'native',{},t.ctx),'invalid')
    case('target_invalid_'+re.sub(r'\W','_',str(target)),target_bad)

def pointer_once(t):
    o=fixture(path='/~1%2F');t.native(o,{}, {'method':'GET','path':'/~1%2F','query':{}})
case('literal_target_decode_once_no_percent_decode',pointer_once)
def no_target(t):
    o=fixture();o['bindings']['native']['content']['target']='/paths/~1missing/get'
    t.rejected(lambda:t.i.invoke(o,'native',{},t.ctx),'no-target')
case('well_formed_missing_target',no_target)

for label,m in [('up_outside',{'at':'','up':1}),('negative_up',{'at':'','up':-1}),('bool_up',{'at':'','up':True}),
                ('extra',{'literal':1,'up':0}),('two_forms',{'literal':1,'at':''}),
                ('bad_each',{'each':{'in':{'at':''},'value':{'at':''},'index':'n'}}),('bad_pointer',{'at':'#/x'})]:
    def invalid_map(t,m=m):
        o=fixture();o['bindings']['native']['content']['input']=m
        t.rejected(lambda:t.i.invoke(o,'native',{},t.ctx),'invalid')
    case('mapping_invalid_'+label,invalid_map)

for label,m,value,expected in [
 ('literal_null',{'literal':None},{},None),('absence_empty_pointer',{'at':''},ABSENT,ABSENT),
 ('object_omits_absent',{'object':{'x':{'at':'/missing'},'y':{'literal':None}}},{},{'y':None}),
 ('empty_each',{'each':{'in':{'at':''},'value':{'at':''}}},[],[]),
 ('missing_each',{'each':{'in':{'at':'/missing'},'value':{'at':''}}},{},ABSENT),
 ('array_literal',{'array':[{'literal':None},{'at':'/a'}]},{'a':3},[None,3]),
 ('literal_percent_key',{'at':'/a%2Fb'},{'a%2Fb':'yes','a/b':'wrong'},'yes')]:
    def map_semantics(t,m=m,value=value,expected=expected):
        check_mapping(m);actual=mapping(m,value)
        if expected is ABSENT:t.assertIs(actual,ABSENT)
        else:t.assertEqual(actual,expected)
    case('mapping_'+label,map_semantics)

for label,m,value in [('array_absent',{'array':[{'at':'/missing'}]},{}),
                      ('each_nonarray',{'each':{'in':{'at':''},'value':{'at':''}}},None),
                      ('each_absent_item',{'each':{'in':{'at':''},'value':{'at':'/missing'}}},[{}])]:
    def map_failure(t,m=m,value=value):
        o=fixture();o['bindings']['native']['content']['input']=m
        t.rejected(lambda:t.i.invoke(o,'native',value,t.ctx),'mapping')
    case('mapping_failure_'+label,map_failure)

for label,value in [('null',None),('array',[]),('scalar',3),('unknown',{'extra':1}),('null_parameters',{'parameters':None})]:
    def bad_input(t,value=value):t.rejected(lambda:t.i.invoke(fixture(),'native',value,t.ctx),'unroutable')
    case('request_invalid_'+label,bad_input)

def null_json(t):
    o=fixture(method='post',oas=oas_doc(method='post',operation=body_operation()))
    t.native(o,{'body':None},{'method':'POST','path':'/probe','query':{},'media':'application/json','json':None})
case('present_null_json_body_is_supplied',null_json)

def qualification(t):
    o=fixture(path='/items/{id}')
    op(o,'/items/{id}')['parameters']=[parameter('id','path',required=True),parameter('id'),parameter('X-Z','header')]
    t.native(o,{'parameters':{'path/id':'x','query/id':'y','header/X-Z':'z'}},
             {'method':'GET','path':'/items/x','query':{'id':['y']},'headers':{'X-Z':'z'}})
case('all_keys_qualified_after_effective_name_collision',qualification)

def removed_projection(t):
    o=fixture();op(o)['parameters']=[parameter('Accept','header',required=True),parameter('Accept'),parameter('Bad Name','header')]
    t.native(o,{'parameters':{'Accept':'query-value'}},{'method':'GET','path':'/probe','query':{'Accept':['query-value']}})
case('ignored_and_optional_invalid_projections_removed_before_qualification',removed_projection)

for name in ('Host','Content-Length','Bad Name'):
    def unavailable_header(t,name=name):
        o=fixture();op(o)['parameters']=[parameter(name,'header',required=True)]
        t.rejected(lambda:t.i.invoke(o,'native',{},t.ctx),'capability')
    case('required_unavailable_header_'+name.replace('-','_').replace(' ','_'),unavailable_header)

def override(t):
    o=fixture();doc(o)['paths']['/probe']['parameters']=[parameter('q',schema={'type':'array'},explode=False)]
    op(o)['parameters']=[parameter('q',schema={'type':'array'},explode=True)]
    t.native(o,{'parameters':{'q':['a','b']}},{'method':'GET','path':'/probe','query':{'q':['a','b']}})
case('operation_parameter_override',override)

for label,value in [('null',None),('empty_array',[]),('empty_object',{}),('empty_string','')]:
    def undefined_query(t,value=value):
        o=fixture();op(o)['parameters']=[parameter('color')]
        t.native(o,{'parameters':{'color':value}},{'method':'GET','path':'/probe','query':{} if isinstance(value,(list,dict)) else {'color':['']}})
    case('undefined_query_contribution_'+label,undefined_query)

def deep_object(t):
    o=fixture();op(o)['parameters']=[parameter('filter',style='deepObject',explode=True)]
    t.native(o,{'parameters':{'filter':{'q':'a&b=c','word':'a b'}}},
             {'method':'GET','path':'/probe','query':{'filter[q]':['a&b=c'],'filter[word]':['a b']}})
case('deepObject_encoded_ampersand_is_scalar_data',deep_object)

for label,style,explode,value in [('deep_default','deepObject',False,{'x':'a'}),
 ('deep_bracket','deepObject',True,{'x[y]':'a'}),('deep_nested','deepObject',True,{'x':{'y':'a'}}),
 ('space_separator','spaceDelimited',False,['a b','c']),('pipe_separator','pipeDelimited',False,['a|b','c']),
 ('pipe_scalar','pipeDelimited',False,'a'),('array_null','form',True,['a',None])]:
    def bad_serialization(t,style=style,explode=explode,value=value):
        o=fixture();op(o)['parameters']=[parameter('q',style=style,explode=explode)]
        t.rejected(lambda:t.i.invoke(o,'native',{'parameters':{'q':value}},t.ctx),'unroutable')
    case('serialization_unroutable_'+label,bad_serialization)

def mixed_reserved(t):
    o=fixture();op(o)['parameters']=[parameter('regular'),parameter('reserved',allowReserved=True),parameter('❤️')]
    t.native(o,{'parameters':{'regular':'x/y','reserved':'x/y&a=b+c','❤️':'love'}},
             {'method':'GET','path':'/probe','query':{'regular':['x/y'],'reserved':['x/y&a=b+c'],'❤️':['love']}})
case('mixed_regular_reserved_and_illegal_template_name',mixed_reserved)

def scalar_context(t):
    o=fixture();op(o)['parameters']=[parameter('q',schema={'type':'array'})]
    t.rejected(lambda:t.i.invoke(o,'native',{'parameters':{'q':[True,12]}},t.ctx),'context')
    t.native(o,{'parameters':{'q':[True,12]}},{'method':'GET','path':'/probe','query':{'q':['true','12']}},
             ctx={**t.ctx,'scalar':json_text})
case('scalar_conversion_required_and_applies_to_array_members',scalar_context)

for patch in ('3.1.0','3.1.1','3.1.2'):
    def header_no_percent(t,patch=patch):
        o=fixture();doc(o)['openapi']=patch;op(o)['parameters']=[parameter('X-Text','header')]
        t.native(o,{'parameters':{'X-Text':'one/two %2F'}},{'method':'GET','path':'/probe','query':{},'headers':{'X-Text':'one/two %2F'}})
    case('header_no_URI_encoding_'+patch.replace('.','_'),header_no_percent)

for value in (' leading','trailing ','line\nbreak','\x00'):
    def invalid_header(t,value=value):
        o=fixture();op(o)['parameters']=[parameter('X-Text','header')]
        t.rejected(lambda:t.i.invoke(o,'native',{'parameters':{'X-Text':value}},t.ctx),'unroutable')
    case('header_invalid_'+str(ord(value[0]))+'_'+str(len(value)),invalid_header)

def header_case_collision(t):
    o=fixture();op(o)['parameters']=[parameter('X-A','header'),parameter('x-a','header')]
    t.native(o,{'parameters':{'X-A':'v'}},{'method':'GET','path':'/probe','query':{},'headers':{'X-A':'v'}})
    t.rejected(lambda:t.i.invoke(o,'native',{'parameters':{'X-A':'v','x-a':'v'}},t.ctx),'unroutable')
case('case_distinct_header_keys_single_vs_both',header_case_collision)

def cookies(t):
    o=fixture();op(o)['parameters']=[parameter('a','cookie'),parameter('b','cookie')]
    t.native(o,{'parameters':{'a':'x/y','b':'a+b'}},{'method':'GET','path':'/probe','query':{},
             'headers':{'Cookie':'b=a%2Bb; a=x%2Fy'}})
case('structured_cookies_join_and_retain_percent_encoding',cookies)

for explode,value in [(True,['a','b']),(False,['a','b']),(True,{'a':'1','b':'2'})]:
    def cookie_compound(t,explode=explode,value=value):
        o=fixture();op(o)['parameters']=[parameter('q','cookie',explode=explode)]
        t.rejected(lambda:t.i.invoke(o,'native',{'parameters':{'q':value}},t.ctx),'unroutable')
    case('cookie_multivalue_rejected_'+str(explode)+'_'+type(value).__name__,cookie_compound)

def content_parameter(t):
    o=fixture();op(o)['parameters']=[{'name':'q','in':'query','content':{'application/json':{}}},
      {'name':'X-Payload','in':'header','content':{'text/plain':{'schema':{'type':'string'}}}}]
    t.native(o,{'parameters':{'q':{'x':'a/b'},'X-Payload':'a/b'}},
             {'method':'GET','path':'/probe','query_json':{'q':{'x':'a/b'}},'headers':{'X-Payload':'a/b'}})
case('content_parameter_query_bytes_and_header_no_extra_encoding',content_parameter)

def form_doc(mt='application/x-www-form-urlencoded',extra_encoding=None):
    schema={'type':'object','properties':{'name':{'type':'string'},'count':{'type':'integer'},
        'enabled':{'type':'boolean'},'meta':{'type':'object'},'optional':{'type':['string','null']},
        'labels':{'type':'array','items':{'type':'string'}},'impossible':False}}
    operation=body_operation(mt,schema)
    if extra_encoding:operation['requestBody']['content'][mt]['encoding']=extra_encoding
    return fixture(method='post',oas=oas_doc(method='post',operation=operation))

def form_content(t):
    o=form_doc()
    t.native(o,{'body':{'name':'a b','count':12,'enabled':False,'meta':{'x':1},'optional':None}},
       {'method':'POST','path':'/probe','query':{},'media':'application/x-www-form-urlencoded',
        'form':{'name':['a b']},'form_json':{'count':12,'enabled':False,'meta':{'x':1}}})
case('form_content_defaults_number_boolean_json_optional_null',form_content)

def form_array(t):
    o=form_doc(extra_encoding={'labels':{'contentType':'application/json'}})
    t.native(o,{'body':{'labels':['a','b']}},{'method':'POST','path':'/probe','query':{},
      'form_json':{'labels':['a','b']}})
case('form_array_whole_value_with_explicit_JSON_choice',form_array)

for label,value in [('array_default',{'labels':['a','b']}),('null_body',None),('false_property',{'impossible':'x'})]:
    def invalid_form(t,value=value):
        t.rejected(lambda:t.i.invoke(form_doc(),'native',{'body':value},t.ctx))
    case('form_unrepresentable_'+label,invalid_form)

def form_required_null(t):
    o=form_doc();op(o,method='post')['requestBody']['content']['application/x-www-form-urlencoded']['schema']['required']=['optional']
    t.rejected(lambda:t.i.invoke(o,'native',{'body':{'optional':None}},t.ctx),'unroutable')
case('form_required_null_not_silently_dropped',form_required_null)

def form_style(t):
    o=form_doc(extra_encoding={'labels':{'explode':True,'contentType':'application/json'},'optional':{'explode':False}})
    t.native(o,{'body':{'labels':['a','b'],'optional':None}},{'method':'POST','path':'/probe','query':{},
      'form':{'labels':['a','b'],'optional':['']}})
case('form_style_explicit_controls_ignore_contentType',form_style)

def multipart_defaults(t):
    o=form_doc('multipart/form-data')
    t.native(o,{'body':{'name':'a b','labels':['first','second'],'meta':{'x':'y'},'optional':None}},
      {'method':'POST','path':'/probe','query':{},'media':'multipart/form-data','parts':{
       'name':[{'body':b'a b','headers':{'content-type':'text/plain'}}],
       'labels':[{'body':b'first','headers':{'content-type':'text/plain'}},{'body':b'second','headers':{'content-type':'text/plain'}}],
       'meta':[{'json':{'x':'y'},'headers':{'content-type':'application/json'}}]}})
case('multipart_named_defaults_array_order_and_optional_null',multipart_defaults)

def multipart_style(t):
    o=form_doc('multipart/form-data',{'name':{'style':'form','contentType':'application/json'}})
    t.native(o,{'body':{'name':'a/b & c'}},{'method':'POST','path':'/probe','query':{},'media':'multipart/form-data',
      'parts':{'name':[{'body':b'a/b & c','absent_headers':['content-type']}]}})
case('multipart_style_no_percent_encoding_no_generated_ContentType',multipart_style)

def mixed_ignores_style(t):
    o=form_doc('multipart/mixed',{'name':{'style':'form','explode':True,'contentType':'application/json'}})
    t.native(o,{'body':{'name':'a/b'}},{'method':'POST','path':'/probe','query':{},'media':'multipart/mixed',
      'parts':{'name':[{'json':'a/b','headers':{'content-type':'application/json'}}]}})
case('r2_multipart_mixed_ignores_style_controls',mixed_ignores_style)

for mt in ('multipart/mixed','multipart/form-data'):
    for explicit in (False,True):
        def artifact_encoded(t,mt=mt,explicit=explicit):
            schema={'type':'object','properties':{'data':{'type':'string','contentEncoding':'base64'}}}
            operation=body_operation(mt,schema)
            if explicit:operation['requestBody']['content'][mt]['encoding']={'data':{'headers':{
                'Content-Transfer-Encoding':{'schema':{'const':'base64'}}}}}
            o=fixture(method='post',oas=oas_doc(method='post',operation=operation))
            want={'body':b'YQ==','headers':{'content-type':'application/octet-stream'}}
            if explicit:want['headers']['content-transfer-encoding']='base64'
            else:want['absent_headers']=['content-transfer-encoding']
            t.native(o,{'body':{'data':'YQ=='}},{'method':'POST','path':'/probe','query':{},'media':mt,'parts':{'data':[want]}})
        case('r2_artifact_encoded_'+mt.split('/')[1].replace('-','_')+'_'+str(explicit),artifact_encoded)

def mismatched_cte(t):
    o=form_doc('multipart/mixed',{'name':{'headers':{'Content-Transfer-Encoding':{'schema':{'const':'base64'}}}}})
    t.rejected(lambda:t.i.invoke(o,'native',{'body':{'name':'not encoded'}},t.ctx),'unroutable')
case('r2_transfer_encoding_must_not_create_new_transform',mismatched_cte)

def fixed_part_header(t):
    o=form_doc('multipart/form-data',{'name':{'headers':{'X-Fixed':{'schema':{'enum':['v']}},
           'X-Optional':{'schema':{'type':'string'}},'Content-Type':{'schema':{'const':'wrong'}}}}})
    t.native(o,{'body':{'name':'x'}},{'method':'POST','path':'/probe','query':{},'parts':{
      'name':[{'body':b'x','headers':{'x-fixed':'v','content-type':'text/plain'},'absent_headers':['x-optional']}]}})
case('multipart_fixed_headers_and_ignored_ContentType',fixed_part_header)

def required_nonfixed_part_header(t):
    o=form_doc('multipart/form-data',{'name':{'headers':{'X-Needed':{'required':True,'schema':{'type':'string'}}}}})
    t.rejected(lambda:t.i.invoke(o,'native',{'body':{'name':'x'}},t.ctx),'capability')
case('multipart_required_nonfixed_header_is_contextless',required_nonfixed_part_header)

for label,schema in [('false_branch',{'anyOf':[False,{'type':'string'}]}),
 ('empty_intersection',{'oneOf':[{'allOf':[{'type':'object'},{'type':'string'}]},{'type':'string'}]}),
 ('null_branch',{'anyOf':[{'type':'null'},{'type':'string'}]}),
 ('integer_intersection',{'allOf':[{'type':'number'},{'type':'integer'}]})]:
    def inspect_branch(t,schema=schema,label=label):
        if label=='integer_intersection':t.assertEqual(t.i.r.inspect(schema,None)['type'],'integer');return
        o=fixture(method='post',oas=oas_doc(method='post',operation=body_operation('text/plain',schema)))
        t.native(o,{'body':'hello'},{'method':'POST','path':'/probe','query':{},'media':'text/plain','bytes':b'hello'})
    case('r2_schema_inspection_'+label,inspect_branch)

for label,schema in [('unrestricted',{'anyOf':[{}, {'type':'string'}]}),
 ('unequal',{'anyOf':[{'type':'string'},{'type':'integer'}]}),('dynamic',{'$dynamicRef':'#node'}),
 ('foreign_dialect',{'$schema':'https://invalid.example/dialect','type':'string'})]:
    def unsupported_inspection(t,schema=schema):
        o=fixture(method='post',oas=oas_doc(method='post',operation=body_operation('text/plain',schema)))
        t.rejected(lambda:t.i.invoke(o,'native',{'body':'hello'},t.ctx),'capability')
    case('schema_inspection_unsupported_'+label,unsupported_inspection)

def json_opaque_schema(t):
    o=fixture(method='post',oas=oas_doc(method='post',operation=body_operation('application/json',{'$schema':'https://invalid.example/dialect','$dynamicRef':'#missing'})))
    t.native(o,{'body':{'x':1}},{'method':'POST','path':'/probe','query':{},'json':{'x':1}})
case('JSON_carriage_needs_no_schema_inspection',json_opaque_schema)

def context_server(t):
    o=fixture();doc(o)['servers']=[{'url':t.server.origin+'/first'},{'url':t.server.origin+'/second'}]
    t.rejected(lambda:t.i.invoke(o,'native',{},{}),'context')
    t.native(o,{}, {'method':'GET','path':'/second/probe','query':{}},ctx={'server_index':1})
case('multiple_servers_need_context',context_server)

def repeated_slash(t):
    o=fixture();t.native(o,{}, {'method':'GET','path':'/base///probe','query':{}},ctx={'server':t.server.origin+'/base///'})
case('server_base_removes_exactly_one_trailing_slash',repeated_slash)

def variables(t):
    o=fixture();doc(o)['servers']=[{'url':t.server.origin+'/{region}/{undeclared}',
      'variables':{'region':{'default':'east','enum':['east','west']}}}]
    t.rejected(lambda:t.i.invoke(o,'native',{},{}),'context')
    t.native(o,{}, {'method':'GET','path':'/east/v1/probe','query':{}},ctx={'variables':{'undeclared':'v1'}})
    t.rejected(lambda:t.i.invoke(o,'native',{}, {'variables':{'region':'other','undeclared':'v1'}}),'unroutable')
case('server_defaults_enum_and_explicit_missing_declaration',variables)

def server_relative(t):
    o=fixture();doc(o)['servers']=[{'url':'../api'}];doc(o)['$self']='https://wrong.invalid/root'
    t.rejected(lambda:t.i.invoke(o,'native',{},{}),'context')
    o['sources']['api']['content']['location']=t.server.origin+'/descriptions/entry'
    t.native(o,{}, {'method':'GET','path':'/api/probe','query':{}},ctx={})
case('relative_server_uses_retrieval_base_self_has_no_meaning',server_relative)

def external_item(t,override=False):
    o=fixture();d=doc(o);d['servers']=[{'url':t.server.origin+'/entry'}]
    d['security']=[{'key':[]}]
    d['components']={'securitySchemes':{'key':{'type':'apiKey','in':'header','name':'X-Entry'}}}
    external=oas_doc();external['servers']=[{'url':t.server.origin+'/WRONG'}];external['security']=[{'wrong':[]}]
    external['paths']={'/foreign':{'get':{'parameters':[{'$ref':'parts/parameter.json'}],
                'responses':{'200':{'description':'ok','content':{'application/json':{}}}}}}}
    if override:external['paths']['/foreign']['servers']=[{'url':'./service'}]
    t.server.resources['/description/other/entry.json']=(200,[],json_text(external).encode())
    t.server.resources['/description/other/parts/parameter.json']=(200,[],json_text(parameter('q')).encode())
    d['paths']['/probe']={'$ref':'other/entry.json#/paths/~1foreign'}
    o['sources']['api']['content']['location']=t.server.origin+'/description/entry.json'
    t.native(o,{'parameters':{'q':'value'}},{'method':'GET','path':'/description/other/service/probe' if override else '/entry/probe',
             'query':{'q':['value']},'headers':{'X-Entry':'secret'}},ctx={'credentials':{'key':'secret'}})
case('r2_mounted_item_inherits_entry_servers_security',lambda t:external_item(t))
case('r2_mounted_item_relative_override_keeps_contributor_base',lambda t:external_item(t,True))

def adjacent(t):
    o=fixture();d=doc(o);d['components']={'pathItems':{'base':{'get':{'responses':{'200':{'description':'ok','content':{'application/json':{}}}}}}}}
    d['paths']['/probe']={'$ref':'#/components/pathItems/base','summary':'local documentary text'}
    t.native(o,{}, {'method':'GET','path':'/probe','query':{}})
    d['paths']['/probe']['get']={}
    t.rejected(lambda:t.i.invoke(o,'native',{},t.ctx),'unavailable')
case('path_item_adjacent_noncollision_and_used_collision',adjacent)

def unavailable_item(t):
    o=fixture();doc(o)['paths']['/probe']['$ref']='#/missing'
    t.rejected(lambda:t.i.invoke(o,'native',{},t.ctx),'unavailable')
case('missing_path_item_ref_not_replaced_by_local_operation',unavailable_item)

def schema_anchor_id(t):
    o=fixture(method='post',oas=oas_doc(method='post',operation=body_operation('text/plain',{'$ref':'https://schemas.example/words#Word'})))
    doc(o)['components']={'schemas':{'Root':{'$id':'https://schemas.example/words','$defs':{'S':{'$anchor':'Word','type':'string'}}}}}
    t.native(o,{'body':'anchored'},{'method':'POST','path':'/probe','query':{},'bytes':b'anchored'})
    t.assertEqual(t.i.r.requests,[])
case('schema_id_and_plain_anchor_are_schema_resource_identity',schema_anchor_id)

def external_schema(t):
    o=fixture(method='post',oas=oas_doc(method='post',operation=body_operation('text/plain',{'$ref':'schema.json#/$defs/value'})))
    o['sources']['api']['content']['location']=t.server.origin+'/description/entry'
    t.server.resources['/description/schema.json']=(200,[],b'{"$defs":{"value":{"type":"string"}}}')
    t.native(o,{'body':'external'},{'method':'POST','path':'/probe','query':{},'bytes':b'external'})
case('referenced_root_schema_not_OAS_entry',external_schema)

def source_cycle_unused(t):
    o=fixture();doc(o)['components']={'schemas':{'Node':{'type':'object','properties':{'next':{'$ref':'#/components/schemas/Node'}}}}}
    t.native(o,{}, {'method':'GET','path':'/probe','query':{}})
case('uninspected_schema_reference_cycle_not_document_failure',source_cycle_unused)

def media_choice(t):
    o=fixture(method='post',oas=oas_doc(method='post',operation=body_operation()))
    rb=op(o,method='post')['requestBody'];rb['content']['text/plain']={'schema':{'type':'string'}}
    t.rejected(lambda:t.i.invoke(o,'native',{'body':'x'},t.ctx),'context')
    t.native(o,{'body':'x'},{'method':'POST','path':'/probe','query':{},'media':'text/plain; charset=utf-8','bytes':b'x'},ctx={**t.ctx,'media':'Text/Plain; Charset="UTF-8"'})
case('media_context_selection_equivalent_spelling',media_choice)

def normalized_duplicate(t):
    o=fixture(method='post',oas=oas_doc(method='post',operation=body_operation()))
    op(o,method='post')['requestBody']['content']={'application/json':{},'APPLICATION/JSON':{},'text/plain':{'schema':{'type':'string'}}}
    t.native(o,{'body':'clean'},{'method':'POST','path':'/probe','query':{},'media':'text/plain','bytes':b'clean'})
case('normalized_duplicate_media_keeps_clean_sibling',normalized_duplicate)

def security_o(schemes,requirements,params=None,method='get'):
    o=fixture(method=method);d=doc(o);d['components']={'securitySchemes':schemes};d['security']=requirements
    if params:op(o,method=method)['parameters']=params
    return o

def api_security(t):
    o=security_o({'q':{'type':'apiKey','in':'query','name':'a&b'},'c':{'type':'apiKey','in':'cookie','name':'sid'}},[{'q':[],'c':[]}])
    t.rejected(lambda:t.i.invoke(o,'native',{},t.ctx),'context')
    t.native(o,{}, {'method':'GET','path':'/probe','query':{'a&b':['x/y+z']},'headers':{'Cookie':'sid=x/y+z'}},
             ctx={**t.ctx,'credentials':{'q':'x/y+z','c':'x/y+z'}})
case('API_key_query_encoding_cookie_exact_and_AND_membership',api_security)

def security_choice(t):
    o=security_o({'a':{'type':'http','scheme':'bearer'}},[{'a':[]},{}])
    t.rejected(lambda:t.i.invoke(o,'native',{},t.ctx),'context')
    t.native(o,{}, {'method':'GET','path':'/probe','query':{},'absent_headers':['authorization']},ctx={**t.ctx,'security_index':1})
case('security_OR_choice_anonymous_does_not_merge_credentials',security_choice)

for scheme,cred,want in [('BaSiC',('alice','a:b'),'Basic YWxpY2U6YTpi'),('BEARER','abc+/==','Bearer abc+/==')]:
    def http_auth(t,scheme=scheme,cred=cred,want=want):
        o=security_o({'a':{'type':'http','scheme':scheme}},[{'a':[]}])
        t.native(o,{}, {'method':'GET','path':'/probe','query':{},'headers':{'Authorization':want}},ctx={**t.ctx,'credentials':{'a':cred}})
    case('HTTP_auth_'+scheme.lower(),http_auth)

def optional_collision(t):
    o=security_o({'a':{'type':'apiKey','in':'header','name':'X-Key'}},[{'a':[]}],[parameter('x-key','header')])
    ctx={**t.ctx,'credentials':{'a':'secret'}}
    t.native(o,{}, {'method':'GET','path':'/probe','query':{},'headers':{'X-Key':'secret'}},ctx=ctx)
    t.rejected(lambda:t.i.invoke(o,'native',{'parameters':{'x-key':'value'}},ctx),'unroutable')
case('credential_optional_parameter_collision_only_when_both_present',optional_collision)

def raw_cookie(t):
    o=fixture();op(o)['parameters']=[parameter('Cookie','header'),parameter('session','cookie')]
    t.native(o,{'parameters':{'Cookie':'a=x; b=y'}},{'method':'GET','path':'/probe','query':{},'headers':{'Cookie':'b=y; a=x'}})
    t.rejected(lambda:t.i.invoke(o,'native',{'parameters':{'Cookie':'a=x','session':'v'}},t.ctx),'unroutable')
    t.rejected(lambda:t.i.invoke(o,'native',{'parameters':{'Cookie':'not-a-cookie'}},t.ctx),'unroutable')
case('raw_Cookie_grammar_and_structured_collision',raw_cookie)

def trace(t):
    o=fixture(method='trace');op(o,method='trace')['requestBody']={'required':True,'content':{'application/json':{}}}
    t.native(o,{}, {'method':'TRACE','path':'/probe','query':{}})
    t.rejected(lambda:t.i.invoke(o,'native',{'body':None},t.ctx),'unroutable')
case('TRACE_declared_body_creates_no_obligation_supplied_body_rejected',trace)

for method in ('get','delete','head'):
    def unusual_body(t,method=method):
        o=fixture(method=method,oas=oas_doc(method=method,operation=body_operation()))
        expected_result={'success':True,'outputs':[]} if method=='head' else None
        t.native(o,{'body':{'x':1}},{'method':method.upper(),'path':'/probe','query':{},'json':{'x':1}},result=expected_result)
    case('declared_body_preserved_'+method,unusual_body)

def response_req(t,content=None,headers=None):
    o=fixture();op(o)['responses']={'200':{'description':'ok','content':content or {'application/json':{}},'headers':headers or {}}}
    return t.i.prepare(o,'native',{},t.ctx)

for label,status,headers,payload,want in [
 ('JSON_null',200,[('Content-Type','application/json')],b'null',[None]),
 ('empty_JSON',200,[('Content-Type','application/json')],b'',[]),
 ('JSON_duplicate_last',200,[('Content-Type','application/json')],b'{"a":1,"a":2}',[{'a':2}]),
 ('JSON_BOM',200,[('Content-Type','application/json')],b'\xef\xbb\xbf{"a":1}',[{'a':1}]),
 ('safe_integer_max',200,[('Content-Type','application/json')],b'9007199254740991',[9007199254740991]),
 ('safe_integer_min',200,[('Content-Type','application/json')],b'-9007199254740991',[-9007199254740991])]:
    def response_value(t,status=status,headers=headers,payload=payload,want=want):
        r=response_req(t);out=t.i.complete(r,status,headers,payload)
        t.assertEqual(out,{'success':True,'outputs':want})
    case('response_'+label,response_value)

for label,status,headers,payload in [
 ('failure_JSON',422,[('Content-Type','application/json')],b'{"problem":"bad"}'),
 ('failure_bad_JSON',500,[('Content-Type','application/json')],b'{bad'),
 ('redirect',302,[],b''),('upgrade',101,[],b''),
 ('bad_JSON',200,[('Content-Type','application/json')],b'{bad'),
 ('unpaired_surrogate',200,[('Content-Type','application/json')],b'"\\ud800"'),
 ('ambiguous_ContentType',200,[('Content-Type','application/json'),('Content-Type','text/plain')],b'null'),
 ('unmatched_ContentType',200,[('Content-Type','image/png')],b'abc'),
 ('unavailable_codec',200,[('Content-Type','application/json'),('Content-Encoding','unknown')],b'null')]:
    def response_fail(t,status=status,headers=headers,payload=payload):
        r=response_req(t);r['binding']['output']={'literal':'must not escape'}
        out=t.i.complete(r,status,headers,payload)
        t.assertFalse(out['success']);t.assertEqual(out['outputs'],[])
    case('response_unsuccessful_'+label,response_fail)

def sse(t):
    o=fixture();op(o)['responses']['200']['content']={'text/event-stream':{'schema':{'type':'string'},'itemSchema':{'type':'object'}}}
    whole='data: {"a":1}\n\ndata: {"a":2}\n\n'
    t.server.reply=(200,[('Content-Type','text/event-stream')],whole.encode())
    t.native(o,{}, {'method':'GET','path':'/probe','query':{}}, {'success':True,'outputs':[whole]})
case('unary_text_event_stream_whole_representation_itemSchema_no_effect',sse)

def sse_item_mapping(t):
    r=response_req(t,{'text/event-stream':{'schema':{'type':'string'}}})
    r['binding']['output']={'each':{'in':{'at':''},'value':{'at':'/data'}}}
    out=t.i.complete(r,200,[('Content-Type','text/event-stream')],b'data: {"a":1}\n\n')
    t.assertFalse(out['success']);t.assertEqual(out['outputs'],[])
case('unary_does_not_supply_items_to_each_output_mapping',sse_item_mapping)

def truncated(t):
    t.server.reply=(200,[('Content-Type','application/json'),('Content-Length','100')],b'{"part":1}')
    t.native(fixture(),{}, {'method':'GET','path':'/probe','query':{}},{'success':False,'outputs':[]})
case('actual_truncated_unary_HTTP_response_emits_nothing',truncated)

def output_absence(t):
    r=response_req(t);r['binding']['output']={'at':'/absent'}
    t.assertEqual(t.i.complete(r,200,[('Content-Type','application/json')],b'{}'),{'success':True,'outputs':[]})
    r['binding']['output']={'literal':None}
    t.assertEqual(t.i.complete(r,200,[('Content-Type','application/json')],b'{}'),{'success':True,'outputs':[None]})
case('output_mapping_absence_and_null_distinct',output_absence)

def response_status_precedence(t):
    o=fixture();op(o)['responses']={'200':{'description':'exact','content':{'text/plain':{'schema':{'type':'string'}}}},
      '2XX':{'description':'range','content':{'application/json':{}}},'default':{'description':'default','content':{'application/octet-stream':{}}}}
    r=t.i.prepare(o,'native',{},t.ctx)
    out=t.i.complete(r,200,[('Content-Type','application/json')],b'{}')
    t.assertFalse(out['success'],'unusable exact response cannot fall back to range')
    t.assertEqual(t.i.complete(r,201,[('Content-Type','application/json')],b'[]')['outputs'],[[]])
case('response_exact_range_default_precedence_no_invalid_fallback',response_status_precedence)

def no_content_headers(t):
    r=response_req(t,headers={'X-Required':{'required':True,'schema':{'type':'string'}},'Content-Type':{'required':True}})
    t.assertFalse(t.i.complete(r,200,[],b'')['success'])
    t.assertTrue(t.i.complete(r,200,[('X-Required','yes')],b'')['success'])
    r['op']['responses']['204']=r['op']['responses'].pop('200')
    t.assertEqual(t.i.complete(r,204,[('X-Required','yes'),('Content-Encoding','unavailable')],b''),{'success':True,'outputs':[]})
    t.assertFalse(t.i.complete(r,204,[('X-Required','yes')],b'x')['success'])
case('no_content_checks_required_headers_ignores_ContentType_no_decoder',no_content_headers)

def raw_response(t):
    r=response_req(t,{'application/octet-stream':{}})
    t.assertEqual(t.i.complete(r,200,[],b'\x00\xff'),{'success':True,'outputs':['AP8=']})
case('missing_response_ContentType_defaults_raw_octets',raw_response)

def raw_request(t):
    o=fixture(method='post',oas=oas_doc(method='post',operation=body_operation('application/octet-stream')))
    t.native(o,{'body':'AP8='},{'method':'POST','path':'/probe','query':{},'bytes':b'\x00\xff'})
    t.rejected(lambda:t.i.invoke(o,'native',{'body':'AP9='},t.ctx),'unroutable')
case('canonical_Base64_raw_exact_octets_nonzero_pad_bits_rejected',raw_request)

def gzip_stack(t):
    import gzip
    o=fixture(method='post',oas=oas_doc(method='post',operation=body_operation()))
    op(o,method='post')['parameters']=[parameter('Content-Encoding','header')]
    op(o,method='post')['responses']['200']['headers']={'Content-Encoding':{'schema':{'const':'gzip, gzip'}}}
    t.server.reply=(200,[('Content-Type','application/json'),('Content-Encoding','gzip'),('Content-Encoding','gzip')],
                    gzip.compress(gzip.compress(b'{"decoded":true}')))
    out=t.i.invoke(o,'native',{'parameters':{'Content-Encoding':'gzip, gzip'},'body':{'x':1}},t.ctx)
    observed=t.server.observed[-1]
    t.assertEqual(json.loads(gzip.decompress(gzip.decompress(observed['body']))),{'x':1})
    t.assertEqual(out,{'success':True,'outputs':[{'decoded':True}]})
case('ordered_content_coding_stack_and_combined_response_field_constraint',gzip_stack)

def oracle_variation(t):
    expected={'method':'POST','path':'/a%2Fb','query':{'q':['1','2'],'other':['x']},
              'media':'application/json; charset=utf-8','json':{'a':1,'b':2},
              'headers':{'Cookie':'a=x; b=y'}}
    native={'method':'POST','target':'/a%2fb?other=x&q=1&q=2',
            'headers':[('content-type','Application/JSON; CHARSET="UTF-8"'),('cookie','b=y; a=x')],
            'body':b'{ "b":2, "a":1 }'}
    assert_request(native,expected)
    for label,mutate in [('method',lambda x:x.update(method='GET')),
       ('path',lambda x:x.update(target='/a/b?other=x&q=1&q=2')),
       ('array_order',lambda x:x.update(target='/a%2fb?q=2&q=1&other=x')),
       ('array_loss',lambda x:x.update(target='/a%2fb?q=1&other=x')),
       ('body_value',lambda x:x.update(body=b'{"a":1,"b":3}')),
       ('cookie_value',lambda x:x.update(headers=[('Content-Type','application/json; charset=utf-8'),('Cookie','a=WRONG; b=y')]))]:
        changed=copy.deepcopy(native);mutate(changed)
        with t.assertRaises(AssertionError,msg='survived semantic mutation: '+label):assert_request(changed,expected)
case('oracle_accepts_variation_rejects_six_native_semantic_mutations',oracle_variation)

def multipart_oracle_variation(t):
    expected={'method':'POST','path':'/m','parts':{
      'words':[{'body':b'a'},{'body':b'b'}], 'title':[{'body':b'hello world'}]}}
    def frame(boundary,order,quoted=False):
        out=b'preamble ignored\r\n'
        for name,v in order:
            name='"'+name+'"' if quoted else name
            out+=('--'+boundary+'\r\nContent-Disposition: form-data; name='+name+'\r\n\r\n').encode()+v+b'\r\n'
        return out+('--'+boundary+'--\r\nepilogue ignored').encode()
    for boundary,ordered in [('first',[('words',b'a'),('title',b'hello world'),('words',b'b')]),
                            ('other',[('title',b'hello world'),('words',b'a'),('words',b'b')])]:
        n={'method':'POST','target':'/m','headers':[('Content-Type','multipart/form-data; boundary="'+boundary+'"')],
           'body':frame(boundary,ordered,True)}
        assert_request(n,expected)
        n['body']=frame(boundary,[('title',b'hello world'),('words',b'b'),('words',b'a')])
        with t.assertRaises(AssertionError):assert_request(n,expected)
case('oracle_multipart_boundary_property_order_free_repeated_order_fixed',multipart_oracle_variation)

for label,content in [('null',None),('missing_target',{}),('unknown',{'target':'/paths/~1probe/get','extra':True})]:
    def invalid_binding(t,content=content):
        o=fixture();o['bindings']['native']['content']=content
        t.rejected(lambda:t.i.invoke(o,'native',{},t.ctx),'invalid')
    case('binding_content_invalid_'+label,invalid_binding)

def exact_kind(t):
    o=fixture();o['sources']['api']['kind']='OpenBindings.openapi-3.1@1'
    t.rejected(lambda:t.i.invoke(o,'native',{},t.ctx),'capability')
case('kind_comparison_exact_case',exact_kind)

for style,explode,want in [('simple',False,'a,b'),('simple',True,'a,b'),
                         ('label',False,'.a,b'),('label',True,'.a.b'),
                         ('matrix',False,';p=a,b'),('matrix',True,';p=a;p=b')]:
    def path_styles(t,style=style,explode=explode,want=want):
        o=fixture(path='/items/{p}');op(o,'/items/{p}')['parameters']=[parameter('p','path',schema={'type':'array'},required=True,style=style,explode=explode)]
        t.native(o,{'parameters':{'p':['a','b']}},{'method':'GET','path':'/items/'+want,'query':{}})
    case('path_array_'+style+'_'+str(explode),path_styles)

def empty_servers(t):
    o=fixture();doc(o)['servers']=[{'url':t.server.origin+'/root'}]
    doc(o)['paths']['/probe']['servers']=[];op(o)['servers']=[]
    t.native(o,{}, {'method':'GET','path':'/root/probe','query':{}},ctx={})
case('empty_operation_path_server_lists_fall_through',empty_servers)

def property_media_context(t):
    o=form_doc(extra_encoding={'meta':{'contentType':'application/*'}})
    value={'body':{'meta':{'x':1}}}
    t.rejected(lambda:t.i.invoke(o,'native',value,t.ctx),'context')
    t.native(o,value,{'method':'POST','path':'/probe','query':{},'form_json':{'meta':{'x':1}}},
             ctx={**t.ctx,'property_media':{'meta':'application/json'}})
case('form_property_wildcard_media_requires_context',property_media_context)

def trace_auth(t):
    o=security_o({'a':{'type':'http','scheme':'bearer'}},[{'a':[]}],method='trace')
    t.rejected(lambda:t.i.invoke(o,'native',{}, {**t.ctx,'credentials':{'a':'secret'}}),'unroutable')
case('TRACE_sensitive_auth_prevents_dispatch',trace_auth)

def forbidden_credential(t):
    o=security_o({'a':{'type':'apiKey','in':'header','name':'Content-Encoding'}},[{'a':[]}])
    t.rejected(lambda:t.i.invoke(o,'native',{}, {**t.ctx,'credentials':{'a':'gzip'}}),'capability')
case('credential_cannot_claim_transport_ContentEncoding',forbidden_credential)

def json_inside_carriers_variation(t):
    n={'method':'POST','target':'/p?q=%7B%20%22b%22%3A2%2C%22a%22%3A1%20%7D','headers':[],
       'body':b'n=12.0&meta=%7B%22x%22%3A+1%7D'}
    e={'method':'POST','path':'/p','query_json':{'q':{'a':1,'b':2}},'form_json':{'n':12,'meta':{'x':1}}}
    assert_request(n,e)
    n['body']=b'n=13.0&meta=%7B%22x%22%3A+1%7D'
    with t.assertRaises(AssertionError):assert_request(n,e)
case('oracle_nested_JSON_and_number_spellings_accepts_meaning_mutation_rejected',json_inside_carriers_variation)

def referenced_false_root(t):
    o=fixture(method='post',oas=oas_doc(method='post',operation=body_operation('text/plain',{'$ref':'false.json'})))
    o['sources']['api']['content']['location']=t.server.origin+'/description/entry'
    t.server.resources['/description/false.json']=(200,[],b'false')
    t.rejected(lambda:t.i.invoke(o,'native',{'body':'x'},t.ctx),'unroutable')
case('referenced_boolean_schema_root_inspected_false',referenced_false_root)

def response_form_unsupported(t):
    r=response_req(t,{'multipart/form-data':{'schema':{'type':'object','properties':{'x':{'type':'string'}}}}})
    out=t.i.complete(r,200,[('Content-Type','multipart/form-data; boundary=x')],b'--x--\r\n')
    t.assertFalse(out['success']);t.assertEqual(out['outputs'],[])
case('multipart_response_object_decode_not_in_kind',response_form_unsupported)

def model_has_no_contract_channel_for_transport(t):
    o=fixture();t.server.reply=(200,[('Content-Type','application/json'),('X-Secret','transport-only')],b'{"id":1}')
    o['bindings']['native']['content']['output']={'object':{'id':{'at':'/id'},'status':{'at':'/status'},'header':{'at':'/X-Secret'}}}
    t.native(o,{}, {'method':'GET','path':'/probe','query':{}},{'success':True,'outputs':[{'id':1}]})
case('mapping_cannot_access_status_headers',model_has_no_contract_channel_for_transport)

for all_bytes in (False,True):
    def uri_content(t,all_bytes=all_bytes):
        o=fixture(path='/content/{value}')
        text={'text/plain':{'schema':{'type':'string'}}}
        op(o,'/content/{value}')['parameters']=[
          {'name':'value','in':'path','required':True,'content':text},
          {'name':'query','in':'query','content':text},
          {'name':'X-Text','in':'header','content':text},
          {'name':'cookie','in':'cookie','content':text}]
        t.i.content_uri_all_bytes=all_bytes
        t.native(o,{'parameters':{'value':'A/b?','query':'A/b&c=d','X-Text':'A/b','cookie':'A/b'}},
          {'method':'GET','path':'/content/A%2Fb%3F','content_path_uri_equivalence':True,
           'query':{'query':['A/b&c=d']},'headers':{'X-Text':'A/b','Cookie':'cookie=A/b'}})
        observed=t.server.observed[-1]
        t.assertIn('%41%2F%62%3F' if all_bytes else 'A%2Fb%3F',observed['target'])
    case('r3_content_URI_unreserved_'+('encoded' if all_bytes else 'literal')+'_native',uri_content)

def uri_equivalence_oracle(t):
    e={'method':'GET','path':'/content/A%2Fb%3F','content_path_uri_equivalence':True,
       'query':{'q':['A/b&c=d']}}
    n={'method':'GET','target':'/content/%41%2f%62%3f?q=%41%2fb%26c%3dd','headers':[],'body':b''}
    assert_request(n,e)
    for target in ('/content/A/b%3F?q=A%2Fb%26c%3Dd',
                   '/content/A%252Fb%3F?q=A%2Fb%26c%3Dd',
                   '/content/A%2Fb%3F?q=A%2Fb&c=d',
                   '/content/A%2Fb%3F?q=A%2Fb%26c%3De'):
        mutated={**n,'target':target}
        with t.assertRaises(AssertionError):assert_request(mutated,e)
case('r3_URI_oracle_accepts_unreserved_equivalence_rejects_reserved_structure_mutants',uri_equivalence_oracle)

XML_TEXT_LATIN='<?xml version="1.0" encoding="ISO-8859-1"?><item>café &amp; &#65;</item>'
XML_TEXT_UTF16='<?xml version="1.0" encoding="UTF-16"?><item>東京</item>'
XML_TEXT_UTF8='<?xml version="1.0" encoding="UTF-8"?><item>café</item>'
XML_ENTITY='<!DOCTYPE item [<!ENTITY external SYSTEM "https://example.invalid/entity">]><item>&external;</item>'

for label,mt,value in [
 ('default_UTF8','application/xml','<item>café</item>'),
 ('declaration_latin1','application/xml',XML_TEXT_LATIN),
 ('MIME_latin1','application/xml; charset=iso-8859-1','<item>café</item>'),
 ('declared_UTF16','application/xml',XML_TEXT_UTF16),
 ('text_xml_alias','text/xml',XML_TEXT_LATIN),
 ('suffix_xml','application/example+xml',XML_TEXT_UTF8),
 ('entity_reference_opaque','application/xml',XML_ENTITY)]:
    def xml_request(t,mt=mt,value=value):
        o=fixture(method='post',oas=oas_doc(method='post',operation=body_operation(mt,{'type':'string'})))
        t.native(o,{'body':value},{'method':'POST','path':'/probe','query':{},'media':mt,'xml_text':value})
        t.assertEqual(t.i.r.requests,[],'XML text must not cause entity acquisition')
    case('r3_XML_request_'+label,xml_request)

for label,mt,raw,value in [
 ('default_UTF8','application/xml',b'<item>caf\xc3\xa9</item>','<item>café</item>'),
 ('declaration_latin1','application/xml',XML_TEXT_LATIN.encode('iso-8859-1'),XML_TEXT_LATIN),
 ('MIME_over_declaration','application/xml; charset=iso-8859-1',XML_TEXT_UTF8.encode('iso-8859-1'),XML_TEXT_UTF8),
 ('BOM_over_MIME_and_declaration','application/xml; charset=us-ascii',b'\xef\xbb\xbf'+XML_TEXT_LATIN.encode('utf-8'),XML_TEXT_LATIN),
 ('BOM_over_unavailable_MIME','application/xml; charset=x-unavailable',b'\xef\xbb\xbf<item>caf\xc3\xa9</item>','<item>café</item>'),
 ('UTF16_BOM_over_MIME','application/xml; charset=utf-8',XML_TEXT_UTF16.encode('utf-16'),XML_TEXT_UTF16),
 ('text_xml_alias','text/xml',XML_TEXT_LATIN.encode('iso-8859-1'),XML_TEXT_LATIN),
 ('suffix_xml_BOM','application/example+xml',b'\xef\xbb\xbf'+XML_TEXT_UTF8.encode('utf-8'),XML_TEXT_UTF8),
 ('opaque_entity','application/xml',XML_ENTITY.encode('utf-8'),XML_ENTITY)]:
    def xml_response(t,mt=mt,raw=raw,value=value):
        o=fixture();base_media=mt.split(';')[0]
        op(o)['responses']['200']['content']={base_media:{'schema':{'type':'string'}}}
        t.server.reply=(200,[('Content-Type',mt)],raw)
        t.native(o,{}, {'method':'GET','path':'/probe','query':{}},{'success':True,'outputs':[value]})
        t.assertEqual(t.i.r.requests,[],'XML text must not cause entity acquisition')
    case('r3_XML_response_'+label,xml_response)

for label,mt,value,category in [
 ('unknown_MIME_codec','application/xml; charset=x-unavailable','<x/>','capability'),
 ('unavailable_declaration_codec','application/xml','<?xml version="1.0" encoding="KOI8-R"?><x/>','capability'),
 ('unrepresentable_characters','application/xml; charset=iso-8859-1','<x>東京</x>','unroutable'),
 ('object_not_XML_conversion','application/xml',{'x':'value'},'unroutable')]:
    def bad_xml_request(t,mt=mt,value=value,category=category):
        o=fixture(method='post',oas=oas_doc(method='post',operation=body_operation(mt,{'type':'string'})))
        t.rejected(lambda:t.i.invoke(o,'native',{'body':value},t.ctx),category)
    case('r3_XML_request_failure_'+label,bad_xml_request)

for label,mt,raw in [
 ('unknown_MIME_codec','application/xml; charset=x-unavailable',b'<x/>'),
 ('unavailable_declaration_codec','application/xml',b'<?xml version="1.0" encoding="KOI8-R"?><x/>'),
 ('unavailable_BOM_codec','application/xml; charset=utf-8',b'\xff\xfe\0\0'+b'<\0\0\0x\0\0\0/\0\0\0>\0\0\0'),
 ('invalid_UTF8','application/xml',b'<x>\xff</x>')]:
    def bad_xml_response(t,mt=mt,raw=raw):
        o=fixture();op(o)['responses']['200']['content']={'application/xml':{'schema':{'type':'string'}}}
        t.server.reply=(200,[('Content-Type',mt)],raw)
        t.native(o,{}, {'method':'GET','path':'/probe','query':{}},{'success':False,'outputs':[]})
    case('r3_XML_response_failure_'+label,bad_xml_response)

def xml_oracle_variants(t):
    e={'method':'POST','path':'/xml','xml_text':XML_TEXT_UTF16}
    for raw in (b'\xff\xfe'+XML_TEXT_UTF16.encode('utf-16-le'),b'\xfe\xff'+XML_TEXT_UTF16.encode('utf-16-be')):
        n={'method':'POST','target':'/xml','headers':[('Content-Type','application/xml')],'body':raw}
        assert_request(n,e)
    e={'method':'POST','path':'/xml','xml_text':XML_TEXT_UTF8}
    for raw in (XML_TEXT_UTF8.encode(),b'\xef\xbb\xbf'+XML_TEXT_UTF8.encode()):
        n={'method':'POST','target':'/xml','headers':[('Content-Type','application/xml')],'body':raw}
        assert_request(n,e)
    for changed in (XML_TEXT_UTF8.replace('UTF-8','utf-8'),XML_TEXT_UTF8.replace('café','cafe')):
        n['body']=changed.encode()
        with t.assertRaises(AssertionError):assert_request(n,e)
case('r3_XML_oracle_accepts_legal_BOM_endianness_rejects_markup_character_rewrites',xml_oracle_variants)

def encoding_content_header_optional(t):
    o=form_doc('multipart/form-data',{'name':{'headers':{
      'X-Content':{'content':{'text/plain':{'schema':{'const':'not-a-fixed-field'}}}},
      'X-Raw':{'schema':{'const':'raw field value'}},
      'X-Example':{'schema':{'type':'string','default':'no'},'example':'no'}}}})
    t.native(o,{'body':{'name':'x'}},{'method':'POST','path':'/probe','query':{},'parts':{
      'name':[{'body':b'x','headers':{'x-raw':'raw field value'},'absent_headers':['x-content','x-example']}]}})
case('r3_Encoding_headers_schema_raw_const_only_content_const_and_examples_not_fixed',encoding_content_header_optional)

def encoding_content_header_required(t):
    o=form_doc('multipart/form-data',{'name':{'headers':{
      'X-Content':{'required':True,'content':{'text/plain':{'schema':{'const':'not-a-fixed-field'}}}}}}})
    t.rejected(lambda:t.i.invoke(o,'native',{'body':{'name':'x'}},t.ctx),'capability')
case('r3_Encoding_required_content_form_header_has_no_fixed_value',encoding_content_header_required)

# Public r4 source-fragment maintenance by a new agent; original r3 files and
# complete fixtures remain in archive-r3. Expectations were recorded first.
def fragment_record(t,o,expected,actual):
    path=HERE/'fixtures'/('in-memory-debug' if OFFLINE else 'executed')/t._testMethodName.removeprefix('test_')
    path.mkdir(parents=True,exist_ok=True)
    (path/'interface.obi.json').write_text(json_text(o)+'\n')
    (path/'source-fragment-boundary.json').write_text(json.dumps({'candidate_sha256':CANDIDATE_SHA256,'expected':expected,'actual':actual},indent=2)+'\n')

for form in ('location_only','embedded_object','embedded_text'):
    for label,fragment in [('pointer','/nested'),('name','anchor'),('encoded','%2Fnested')]:
        def bad_fragment(t,form=form,fragment=fragment):
            o=fixture();d=doc(o);source={'location':t.server.origin+'/fragment/no-fetch#'+fragment}
            if form!='location_only':source['document']=d if form=='embedded_object' else json_text(d)
            o['sources']['api']['content']=source
            before=NETWORK_COUNTS.copy()
            t.rejected(lambda:t.i.invoke(o,'native',{},{}),'invalid')
            t.assertEqual(t.i.r.requests,[]);t.assertEqual(t.i.r.docs,{})
            t.assertEqual(t.server.acquisition_paths,[]);t.assertEqual(NETWORK_COUNTS,before)
            fragment_record(t,o,{'category':'invalid','resolver_calls':[],'artifact_HTTP_paths':[],'dispatches':0},{'category':'invalid','resolver_calls':t.i.r.requests,'artifact_HTTP_paths':t.server.acquisition_paths,'dispatches':len(t.server.observed)})
        case('r4_source_nonempty_fragment_'+form+'_'+label,bad_fragment)

for form in ('location_only','embedded_object','embedded_text'):
    def good_fragment(t,form=form):
        o=fixture(path='/mounted');d=doc(o);d['servers']=[{'url':'../../wrong-entry-base'}]
        d['paths']['/mounted']={'$ref':'parts/item.json#/item'}
        item={'item':{'get':{'servers':[{'url':'../../native-physical'}],'responses':{'200':{'description':'ok','content':{'application/json':{}}}}}}}
        location=t.server.origin+'/fragment/physical/entry.json'
        source={'location':location+'#'};expected_fetch=[];expected_paths=[]
        if form=='location_only':
            t.server.resources['/fragment/physical/entry.json']=(200,[],json_text(d).encode());expected_fetch.append(location);expected_paths.append('/fragment/physical/entry.json')
        else:source['document']=d if form=='embedded_object' else json_text(d)
        t.server.resources['/fragment/physical/parts/item.json']=(200,[],json_text(item).encode())
        expected_fetch.append(t.server.origin+'/fragment/physical/parts/item.json');expected_paths.append('/fragment/physical/parts/item.json')
        o['sources']['api']['content']=source
        t.native(o,{}, {'method':'GET','path':'/fragment/native-physical/mounted','query':{}},ctx={})
        t.assertEqual(t.i.r.requests,expected_fetch)
        t.assertEqual(list(t.i.r.docs),[location,t.server.origin+'/fragment/physical/parts/item.json'])
        if not OFFLINE:t.assertEqual(t.server.acquisition_paths,expected_paths)
        fragment_record(t,o,{'resolver_calls':expected_fetch,'artifact_HTTP_paths':expected_paths,'registered_resource_urls':[location,t.server.origin+'/fragment/physical/parts/item.json']},{'resolver_calls':t.i.r.requests,'artifact_HTTP_paths':t.server.acquisition_paths,'registered_resource_urls':list(t.i.r.docs)})
    case('r4_source_empty_fragment_'+form+'_physical_reference',good_fragment)

def redirected_empty_fragment(t):
    o=fixture();d=doc(o);d['servers']=[{'url':'../physical-native'}]
    o['sources']['api']['content']={'location':t.server.origin+'/fragment/start#'}
    t.server.resources['/fragment/start']=(302,[('Location','/fragment/final/entry.json')],b'')
    t.server.resources['/fragment/final/entry.json']=(200,[],json_text(d).encode())
    t.native(o,{}, {'method':'GET','path':'/fragment/physical-native/probe','query':{}},ctx={})
    # Offline resolver exposes its internal redirect fetch too; native urllib's
    # redirect is observed independently at the HTTP server instead.
    wanted=[t.server.origin+'/fragment/start']+([t.server.origin+'/fragment/final/entry.json'] if OFFLINE else [])
    t.assertEqual(t.i.r.requests,wanted)
    if not OFFLINE:t.assertEqual(t.server.acquisition_paths,['/fragment/start','/fragment/final/entry.json'])
    t.assertIn(t.server.origin+'/fragment/final/entry.json',t.i.r.docs)
    t.assertTrue(all('#' not in key for key in t.i.r.docs))
    fragment_record(t,o,{'resolver_calls':wanted,'artifact_HTTP_paths':['/fragment/start','/fragment/final/entry.json']},{'resolver_calls':t.i.r.requests,'artifact_HTTP_paths':t.server.acquisition_paths,'registered_resource_urls':list(t.i.r.docs)})
case('r4_source_empty_fragment_redirect_final_physical_base',redirected_empty_fragment)

for label,relative,expected_path in [('encoded_path','/fragment/data%23root/entry','/fragment/native/probe'),('encoded_query','/fragment/entry?marker=%23','/native/probe')]:
    def encoded_hash(t,relative=relative,expected_path=expected_path):
        o=fixture();d=doc(o);d['servers']=[{'url':'../native'}]
        url=t.server.origin+relative
        o['sources']['api']['content']={'location':url+'#'}
        t.server.resources[relative]=(200,[],json_text(d).encode())
        t.native(o,{}, {'method':'GET','path':expected_path,'query':{}},ctx={})
        t.assertEqual(t.i.r.requests,[url]);t.assertIn(url,t.i.r.docs)
        if not OFFLINE:t.assertEqual(t.server.acquisition_paths,[relative])
        fragment_record(t,o,{'resolver_calls':[url],'artifact_HTTP_paths':[relative]},{'resolver_calls':t.i.r.requests,'artifact_HTTP_paths':t.server.acquisition_paths,'registered_resource_urls':list(t.i.r.docs)})
    case('r4_source_empty_fragment_'+label+'_data',encoded_hash)

def schema_id_separate_physical(t):
    o=fixture(method='post',oas=oas_doc(method='post',operation=body_operation('text/plain',{'$ref':'#/components/schemas/Text'})))
    d=doc(o);d['servers']=[{'url':'../native'}];d['$self']='https://ignored.invalid/wrong'
    d['components']={'schemas':{'Text':{'$id':t.server.origin+'/logical/root.json','allOf':[{'$ref':'child.json'}]}}}
    o['sources']['api']['content']['location']=t.server.origin+'/fragment/physical/entry#'
    t.server.resources['/logical/child.json']=(200,[],b'{"type":"string"}')
    t.native(o,{'body':'logical-schema-physical-server'},{'method':'POST','path':'/fragment/native/probe','query':{},'bytes':b'logical-schema-physical-server'},ctx={})
    t.assertEqual(t.i.r.requests,[t.server.origin+'/logical/child.json'])
    t.assertIn(t.server.origin+'/fragment/physical/entry',t.i.r.docs)
    if not OFFLINE:t.assertEqual(t.server.acquisition_paths,['/logical/child.json'])
    fragment_record(t,o,{'resolver_calls':[t.server.origin+'/logical/child.json'],'native_path':'/fragment/native/probe'},{'resolver_calls':t.i.r.requests,'registered_resource_urls':list(t.i.r.docs),'native_path':t.server.observed[-1]['target']})
case('r4_empty_source_fragment_schema_id_distinct_from_physical_server_base',schema_id_separate_physical)

# Public r5 content-null maintenance; independent native values below are never
# derived by importing this interpreter's encoders or schema-inspection helpers.
def r5_null_case(name,mt,prop,value,required=False,encoding=None,expected_values=None,error=None,extra_context=None,style=False,expected_part_media='application/json'):
    def check(t):
        schema={'type':'object','properties':{'value':copy.deepcopy(prop),'keep':{'type':'string'}}}
        if required:schema['required']=['value']
        operation=body_operation(mt,schema)
        if encoding is not None:operation['requestBody']['content'][mt]['encoding']={'value':copy.deepcopy(encoding)}
        o=fixture(method='post',oas=oas_doc(method='post',operation=operation))
        ctx={**t.ctx,**(extra_context or {})};caller={'body':{'value':copy.deepcopy(value),'keep':'v'}}
        if error:
            t.rejected(lambda:t.i.invoke(o,'native',caller,ctx),error)
            path=HERE/'fixtures'/('in-memory-debug' if OFFLINE else 'executed')/t._testMethodName.removeprefix('test_');path.mkdir(parents=True,exist_ok=True)
            (path/'interface.obi.json').write_text(json_text(o)+'\n')
            (path/'null-boundary.json').write_text(json.dumps({'candidate_sha256':CANDIDATE_SHA256,'input':caller,'context':ctx,'expected_category':error,'observed_dispatches':len(t.server.observed)},indent=2)+'\n')
            return
        expected={'method':'POST','path':'/probe','query':{},'media':mt}
        if mt=='application/x-www-form-urlencoded':
            expected['form']={'keep':['v']}
            if expected_values is not None:
                if style:expected['form']['value']=['']
                else:expected['form_json']={'value':expected_values[0]}
        else:
            expected['parts']={'keep':[{'body':b'v','headers':{'content-type':'text/plain'}}]}
            if expected_values is not None:
                expected['parts']['value']=[{'body':b'','absent_headers':['content-type']}] if style else [{'json':v,'headers':{'content-type':expected_part_media}} for v in expected_values]
        t.native(o,caller,expected,ctx=ctx)
    case('r5_'+name,check)

for mt,label in [('application/x-www-form-urlencoded','urlencoded'),('multipart/form-data','multipart_formdata'),('multipart/mixed','multipart_mixed')]:
    for required in (False,True):
        for mode,prop,encoding in [('explicit_json',{'type':['string','null']},{'contentType':'application/json'}),('default_json',{'type':['object','null']},None)]:
            r5_null_case(label+'_'+mode+'_null_'+str(required),mt,prop,None,required,encoding,[None])
    for mode,encoding in [('explicit_json',{'contentType':'application/json'}),('default_json',None)]:
        prop={'type':['array','null'],'items':{'type':['object','null']}}
        r5_null_case(label+'_'+mode+'_whole_array_property_null',mt,prop,None,True,encoding,[None])
        r5_null_case(label+'_'+mode+'_preserve_array_null_items',mt,prop,[None,{'x':1},None],False,encoding,[[None,{'x':1},None]] if label=='urlencoded' else [None,{'x':1},None])
    r5_null_case(label+'_json_suffix_null',mt,{'type':['string','null']},None,True,{'contentType':'application/example+json'},[None],expected_part_media='application/example+json')
    r5_null_case(label+'_text_null_optional_omitted',mt,{'type':['string','null']},None)
    r5_null_case(label+'_text_null_required_refused',mt,{'type':['string','null']},None,True,error='unroutable')
    if label!='urlencoded':r5_null_case(label+'_text_array_null_item_refused',mt,{'type':'array','items':{'type':['string','null']}},[None,'after'],error='unroutable')
    for required in (False,True):r5_null_case(label+'_raw_null_'+str(required),mt,{},None,required,{'contentType':'application/octet-stream'},error='unroutable' if required else None)

# Explicit style in form-data is meaningful in 3.1, unlike 3.0. Mixed ignores it.
for mt,label in [('application/x-www-form-urlencoded','urlencoded'),('multipart/form-data','multipart_formdata')]:
    r5_null_case(label+'_style_null_undefined_not_json',mt,{'type':['string','null']},None,True,{'style':'form','contentType':'application/json'},[''],style=True)
r5_null_case('multipart_mixed_style_ignored_json_null','multipart/mixed',{'type':['string','null']},None,True,{'style':'form','contentType':'application/json'},[None])
for typename in ('number','boolean'):
    r5_null_case('text_'+typename+'_null_optional_no_invented_spelling','application/x-www-form-urlencoded',{'type':[typename,'null']},None)
    r5_null_case('text_'+typename+'_null_required_refused','application/x-www-form-urlencoded',{'type':[typename,'null']},None,True,error='unroutable')
r5_null_case('supplied_null_media_context_json','multipart/form-data',{'type':['string','null']},None,True,{'contentType':'application/json, text/plain'},[None],extra_context={'property_media':{'value':'application/json'}})
r5_null_case('supplied_null_media_context_text_omitted','multipart/form-data',{'type':['string','null']},None,False,{'contentType':'application/json, text/plain'},extra_context={'property_media':{'value':'text/plain'}})
r5_null_case('supplied_null_media_choice_missing','multipart/form-data',{'type':['string','null']},None,False,{'contentType':'application/json, text/plain'},error='context')

def r5_absent_no_choice(t):
    o=form_doc('multipart/form-data',{'optional':{'contentType':'*/*'}})
    t.native(o,{'body':{'name':'v'}},{'method':'POST','path':'/probe','query':{},'parts':{'name':[{'body':b'v'}]}})
case('r5_absent_property_needs_no_media_choice',r5_absent_no_choice)

def r5_null_whole_body(t):
    o=form_doc('multipart/form-data');t.rejected(lambda:t.i.invoke(o,'native',{'body':None},t.ctx),'unroutable')
    path=HERE/'fixtures'/('in-memory-debug' if OFFLINE else 'executed')/t._testMethodName.removeprefix('test_');path.mkdir(parents=True,exist_ok=True)
    (path/'interface.obi.json').write_text(json_text(o)+'\n');(path/'null-boundary.json').write_text(json.dumps({'input':{'body':None},'expected_category':'unroutable','observed_dispatches':len(t.server.observed)},indent=2)+'\n')
case('r5_null_entire_form_body_not_object',r5_null_whole_body)

def r5_null_mutations(t):
    expectation={'method':'POST','path':'/probe','query':{},'form':{'keep':['v']},'form_json':{'value':None}}
    observed={'method':'POST','target':'/probe','headers':[('Content-Type','application/x-www-form-urlencoded')],'body':b'keep=v&value=null'}
    assert_request(observed,expectation)
    for body in (b'keep=v',b'keep=v&value=%22null%22',b'keep=v&value='):
        with t.assertRaises((AssertionError, ValueError)):assert_request({**observed,'body':body},expectation)
case('r5_null_oracle_rejects_omission_string_null_and_empty_value',r5_null_mutations)

class EvidenceResult(unittest.TextTestResult):
    def addSuccess(self,test):
        super().addSuccess(test);RESULTS.append({'case':test._testMethodName,'outcome':'passed'})
    def addFailure(self,test,err):
        super().addFailure(test,err);RESULTS.append({'case':test._testMethodName,'outcome':'failed','detail':self._exc_info_to_string(err,test)})
    def addError(self,test,err):
        super().addError(test,err);RESULTS.append({'case':str(test),'outcome':'error','detail':self._exc_info_to_string(err,test)})

if __name__=='__main__':
    import shutil
    generated=HERE/'fixtures'/('in-memory-debug' if OFFLINE else 'executed')
    if generated.exists():shutil.rmtree(generated)
    log=io.StringIO()
    result=unittest.TextTestRunner(stream=log,verbosity=2,resultclass=EvidenceResult).run(unittest.defaultTestLoader.loadTestsFromTestCase(Probes))
    (HERE/('results-offline.txt' if OFFLINE else 'results.txt')).write_text(log.getvalue())
    report={'candidate_sha256':CANDIDATE_SHA256,'core_sha256':CORE_SHA256,
            'core_release':'0.2.0 unreleased working draft, observed content hash',
            'transport':'in-memory debug' if OFFLINE else 'actual loopback HTTP',
            'tests_run':result.testsRun,'successful':result.wasSuccessful(),
            'network':NETWORK_COUNTS,'cases':RESULTS}
    (HERE/('results-offline.json' if OFFLINE else 'results.json')).write_text(json.dumps(report,indent=2)+'\n')
    print(log.getvalue())
    print(json.dumps({k:v for k,v in report.items() if k!='cases'},indent=2))
    raise SystemExit(0 if result.wasSuccessful() else 1)
