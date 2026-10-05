#!/usr/bin/env python3
"""Independent expectations, deliberately literal rather than encode/decode loops."""
import copy
import decimal
import gzip
import hashlib
import http.server
import io
import json
import pathlib
import os
import socket
import threading
import unittest
import urllib.parse as url

from probe import *
import security_probe
from validated_data_probe import encode_checked_text

SPEC_ROOT=pathlib.Path(os.environ.get('SPEC_ROOT',str(pathlib.Path(__file__).resolve().parents[3])))
SPEC=SPEC_ROOT/'binding-specs/openapi-3.2/openbindings.openapi-3.2.md'
CORE=SPEC_ROOT/'openbindings.md'
EXPECTED_SPEC_SHA256='47ebae7d9a13274c639c22932025c2e3b3b609e3c2d47085b4131aaf6dcec4c8'
EXPECTED_CORE_SHA256='afaa04552f5330db6baa13deeb0516d8df0698ae57be26301e2f4bdd341dc1b5'

def api(path='/things/{id}',method='post',op=None):
    return {'openapi':'3.2.0','info':{'title':'Independent probe','version':'1'},
        'servers':[{'url':'https://wire.example/base'}],
        'paths':{path:{method:op or {'responses':{'200':{'description':'ok','content':{'application/json':{}}}}}}}}

def target(path='/things/{id}',method='post'):
    return '/paths/'+path.replace('~','~0').replace('/','~1')+'/'+method

def response(media='application/json',schema=None):
    return {'responses':{'200':{'description':'ok','content':{media:{} if schema is None else {'schema':schema}}}}}

def finish(op,data,media='application/json',binding=None,status=200,headers=None,method='GET'):
    return list(response_events(op,binding or {},status,headers or [('Content-Type',media)],[data],method))

def obi_fixture(name,binding_key):
    """Resolve only current-core same-document relationship keys, not schemas."""
    obi=json.loads(pathlib.Path(__file__).with_name(name).read_text())
    if obi['openbindings']!='0.2.0':raise Invalid('fixture must name current core line')
    b=obi['bindings'][binding_key]
    operation=obi['operations'][b['operation']]
    source=obi['sources'][b['source']]
    if source['kind']!='openbindings.openapi-3.2@1':raise Unsupported('different source kind')
    return obi,operation,Source(source['content']),b['content']

class Probes(unittest.TestCase):
    def test_current_core_hash(self):
        self.assertEqual(hashlib.sha256(CORE.read_bytes()).hexdigest(),EXPECTED_CORE_SHA256)
    def test_final_candidate_hash(self):
        self.assertEqual(hashlib.sha256(SPEC.read_bytes()).hexdigest(),EXPECTED_SPEC_SHA256)

    def test_mapping_absence_null_and_original_input(self):
        self.assertIs(mapping({'at':''},ABSENT),ABSENT)
        self.assertIsNone(mapping({'at':''},None))
        self.assertIs(mapping({'at':'/a'},{}),ABSENT)
        self.assertEqual(mapping({'object':{'keep':{'at':'/a'},'missing':{'at':'/b'},'nil':{'literal':None}}},{'a':False}),{'keep':False,'nil':None})
        self.assertEqual(mapping({'object':{'nested':{'object':{'x':{'at':'/x'}}}}},{'x':7}),{'nested':{'x':7}})
        self.assertEqual(mapping({'array':[{'at':'/b'},{'at':'/a'}, {'literal':None}]},{'a':1,'b':2}),[2,1,None])
        with self.assertRaises(MappingFailure): mapping({'array':[{'at':'/missing'}]}, {})

    def test_mapping_pointer_is_literal_and_decodes_once(self):
        value={'a/b':1,'a~1b':2,'%2F':3,'array':[4,5]}
        for pointer,expected in [('/a~1b',1),('/a~01b',2),('/%2F',3),('/array/1',5)]:
            self.assertEqual(mapping({'at':pointer},value),expected)
        for pointer in ['/array/01','/array/-','/array/2','/array/-1']:
            self.assertIs(mapping({'at':pointer},value),ABSENT)
        for pointer in ['#/a','abc','/bad~2']:
            with self.assertRaises(Invalid): mapping({'at':pointer},value)

    def test_malformed_mappings_rejected_even_in_unreached_member(self):
        for m in [None,{},[],{'at':'','literal':1},{'array':{}},{'object':[]},{'unknown':1},{'object':{'x':{'bad':0}}}]:
            with self.subTest(m=m),self.assertRaises(Invalid): validate_mapping(m)

    def test_all_source_content_modes(self):
        doc=api('/ok','get')
        text=json.dumps(doc)
        yaml='openapi: 3.2.0\ninfo: {title: Test, version: "1"}\npaths:\n  /ok:\n    get:\n      responses:\n        200: {description: yes}\nservers:\n  - url: https://wire.example/base\n'
        resolver=Resolver({'memory:entry':text})
        for content in [{'document':doc},{'document':text},{'document':yaml},{'location':'memory:entry'},
            {'document':doc,'location':'https://retrieval.example/spec.json'},
            {'document':yaml,'location':'https://retrieval.example/spec.yaml'}]:
            with self.subTest(content=content):
                s=Source(content,resolver)
                self.assertEqual(s.select({'target':target('/ok','get')})[:2],('/ok','GET'))
        self.assertEqual(resolver.calls,['memory:entry'])

    def test_yaml_core_scalar_keys_and_invalid_representations(self):
        parsed=parse_artifact('a: yes\nb: True\nc: 0o17\n200: ok\n"200x": on\n')
        self.assertEqual(parsed,{'a':'yes','b':True,'c':15,'200':'ok','200x':'on'})
        for raw in ['a: 1\na: 2','200: x\n"200": y','? [a,b]\n: c','a: .nan','a: !!binary YQ==','a: !!int nope','---\na: 1\n---\nb: 2','[1,2]','null']:
            with self.subTest(raw=raw),self.assertRaises(Invalid): parse_artifact(raw)
        for encoding in ('utf-8-sig','utf-16','utf-32','utf-16-be','utf-16-le','utf-32-be','utf-32-le'):
            with self.subTest(encoding=encoding): self.assertEqual(parse_artifact('a: 1'.encode(encoding)),{'a':1})

    def test_source_invalid_vs_unavailable(self):
        for content in [None,{},[],{'unknown':1},{'document':None},{'document':[]},{'location':'relative.json'},{'location':None}, {'document':{'openapi':'3.2.1'}}]:
            with self.subTest(content=content),self.assertRaises(Invalid): Source(content)
        for reason in [Unavailable('policy denied'),Unavailable('404'),Unavailable('transport failed')]:
            with self.assertRaises(Unavailable): Source({'location':'https://a.example/doc'},Resolver({'https://a.example/doc':reason}))
        r=Resolver({'https://ignored.example/doc':Unavailable('not fetched')})
        self.assertEqual(Source({'document':api('/a','get'),'location':'https://ignored.example/doc'},r).doc['openapi'],'3.2.0')
        self.assertEqual(r.calls,[])

    def test_server_base_is_retrieval_not_self_or_obi(self):
        doc=api('/ok','get');doc['$self']='https://identity.example/elsewhere/oas';doc['servers']=[{'url':'../v1'}]
        s=Source({'document':doc,'location':'https://retrieval.example/spec/openapi.json'})
        req,_=request(s,{'target':target('/ok','get')},{})
        self.assertEqual(req['url'],'https://retrieval.example/v1/ok')
        with self.assertRaises(Prerequisite): request(Source({'document':doc}),{'target':target('/ok','get')},{})
        r=Resolver({'https://initial.example/doc':(doc,'https://final.example/nested/openapi.json')})
        req,_=request(Source({'location':'https://initial.example/doc'},r),{'target':target('/ok','get')},{})
        self.assertEqual(req['url'],'https://final.example/v1/ok')

    def test_targets_fixed_additional_exact_case_and_percent_literal(self):
        doc=api('/%2F~1','get');doc['paths']['/%2F~1']['additionalOperations']={'pOsT':{},'connect':{},'CONNECT':{},'POST':{}}
        s=Source({'document':doc})
        self.assertEqual(s.select({'target':'/paths/~1%2F~01/get'})[:2],('/%2F~1','GET'))
        for method in ('pOsT','connect'):
            self.assertEqual(s.select({'target':target('/%2F~1','additionalOperations/'+method)})[1],method)
        with self.assertRaises(Unsupported): s.select({'target':target('/%2F~1','additionalOperations/CONNECT')})
        with self.assertRaises(Invalid): s.select({'target':target('/%2F~1','additionalOperations/POST')})
        for t in ['#/paths/~1%2F~01/get','/paths/~1%2F~01/GET','/webhooks/h/get','/paths/~1%2F~01/get/x']:
            with self.subTest(t=t),self.assertRaises(Invalid): s.select({'target':t})
        with self.assertRaises(Unavailable): s.select({'target':'/paths/~1~1~01/get'})

    def test_fixed_query_and_trace_body_semantics(self):
        op={'requestBody':{'required':True,'content':{'application/json':{}}}}
        for method in ('query','get','delete'):
            req,_=request(Source({'document':api('/x',method,op)}),{'target':target('/x',method)},{'body':{'q':'test'}})
            self.assertEqual((req['method'],req['body']),(method.upper(),b'{"q":"test"}'))
        s=Source({'document':api('/x','trace',op)})
        req,_=request(s,{'target':target('/x','trace')},{})
        self.assertIs(req['body'],ABSENT)
        with self.assertRaises(Unroutable):request(s,{'target':target('/x','trace')},{'body':None})

    def test_path_item_ref_local_and_remote_and_noncolliding_field(self):
        doc=api('/x','get');doc['paths']['/x']={'$ref':'#/components/pathItems/Base','post':{}}
        doc['components']={'pathItems':{'Base':{'get':{'operationId':'remote'}}}}
        s=Source({'document':doc})
        self.assertEqual(s.select({'target':target('/x','get')})[3]['operationId'],'remote')
        self.assertEqual(s.select({'target':target('/x','post')})[3],{})
        remote={'openapi':'3.2.0','components':{'pathItems':{'Base':{'get':{'operationId':'external'}}}}}
        doc['$self']='https://identity.example/spec/root';doc['paths']['/x']={'$ref':'shared#/components/pathItems/Base'}
        r=Resolver({'https://identity.example/spec/shared':remote})
        s=Source({'document':doc,'location':'https://retrieval.example/doc'},r)
        self.assertEqual(s.select({'target':target('/x','get')})[3]['operationId'],'external')
        self.assertEqual(r.calls,['https://identity.example/spec/shared'])
        doc['paths']['/x']['get']={}
        with self.assertRaises(Unavailable): Source({'document':doc},r).select({'target':target('/x','get')})

    def test_parameter_override_qualification_and_ignored_names(self):
        op={'parameters':[{'in':'query','name':'id','schema':{'type':'string'}},{'in':'header','name':'Accept','required':True,'schema':{}}]}
        doc=api('/things/{id}','get',op)
        doc['paths']['/things/{id}']['parameters']=[{'in':'path','name':'id','required':True,'schema':{}},{'in':'query','name':'id','required':True,'schema':{}}]
        s=Source({'document':doc});b={'target':target('/things/{id}','get')}
        req,_=request(s,b,{'parameters':{'path/id':'a/b'}})
        self.assertEqual(req['url'],'https://wire.example/base/things/a%2Fb')
        for p in [{'id':'a'},{'path/id':'a','Accept':'x'}]:
            with self.assertRaises(Unroutable):request(s,b,{'parameters':p})

    def test_envelope_absence_null_and_required(self):
        doc=api('/x','post',{'requestBody':{'required':True,'content':{'application/json':{}}}})
        s=Source({'document':doc});b={'target':target('/x','post')}
        for v in [ABSENT,{},None,{'parameters':None},{'wrong':1}]:
            with self.subTest(v=str(v)),self.assertRaises(Unroutable):request(s,b,v)
        self.assertEqual(request(s,b,{'body':None})[0]['body'],b'null')
        b['input']={'array':[{'at':'/missing'}]}
        with self.assertRaises(MappingFailure):request(s,b,{})

    def test_hand_authored_mapping_native_request(self):
        _,_,caller=hand_authored()
        obi,operation,source,binding=obi_fixture('hand-authored.obi.json','submitTask.http')
        self.assertNotIn('output',operation)
        req,_=request(source,binding,caller,{'scalar':lambda v:'true' if v is True else str(v)})
        self.assertTrue(native_request_oracle(req))
        self.assertEqual(req['body'],b'{"title":"alpha","done":false,"note":null}')
        # Intentional wrong-meaning results rejected by independent native oracle.
        for replacement in [{'method':'GET'},{'url':req['url'].replace('a%2Fb','a/b')},
            {'body':b'{"title":"alpha","done":false}'},{'body':b'{"title":"alpha","done":true,"note":null}'}]:
            bad={**req,**replacement};self.assertFalse(native_request_oracle(bad))

    def test_semantic_variation_accepts_equal_meaning(self):
        _,_,caller=hand_authored()
        _,_,source,binding=obi_fixture('hand-authored.obi.json','submitTask.http')
        req,_=request(source,binding,caller,{'scalar':lambda v:'true' if v is True else str(v)})
        variants=[req,{**req,'url':req['url'].replace('a%2Fb','a%2fb')},
            {**req,'url':'https://wire.example/base/things/a%2Fb?tag=x%20y&flag=true&tag=z'},
            {**req,'body':b' { "note": null, "done": false, "title": "alpha" } ',
             'headers':{**req['headers'],'Content-Type':'Application/JSON'}}]
        for variant in variants:self.assertTrue(native_request_oracle(variant))
        self.assertFalse(native_request_oracle({**req,'url':req['url'].replace('tag=x%20y&tag=z','tag=z&tag=x%20y')}))

    def test_scalar_parameter_conversion_is_context(self):
        doc=api('/x','get',{'parameters':[{'in':'query','name':'enabled','schema':{'type':'boolean'}}]})
        b={'target':target('/x','get')};s=Source({'document':doc})
        with self.assertRaises(Prerequisite): request(s,b,{'parameters':{'enabled':True}})
        req,_=request(s,b,{'parameters':{'enabled':True}},{'scalar':lambda v:'YES' if v else 'NO'})
        self.assertEqual(req['url'],'https://wire.example/base/x?enabled=YES')

    def test_querystring_present_empty_and_content_percent_bytes(self):
        op={'parameters':[{'in':'querystring','name':'all','content':{'text/plain':{'schema':{'type':'string'}}}}]}
        s=Source({'document':api('/x','get',op)});b={'target':target('/x','get')}
        self.assertEqual(request(s,b,{})[0]['url'],'https://wire.example/base/x')
        self.assertEqual(request(s,b,{'parameters':{'all':''}})[0]['url'],'https://wire.example/base/x?')
        self.assertEqual(request(s,b,{'parameters':{'all':'a=1&b=é'}})[0]['url'],'https://wire.example/base/x?a%3D1%26b%3D%C3%A9')
        op['parameters'][0]={'in':'query','name':'obj','content':{'application/json':{}}}
        s=Source({'document':api('/x','get',op)})
        self.assertEqual(request(s,b,{'parameters':{'obj':{'x':1}}})[0]['url'],'https://wire.example/base/x?obj=%7B%22x%22%3A1%7D')

    def test_server_scope_empty_fallback_variables_and_replacement(self):
        doc=api('/x','get',{'servers':[]});doc['paths']['/x']['servers']=[]
        doc['servers']=[{'url':'https://{region}.example/{version}','variables':{'region':{'default':'east','enum':['east','west']}}}]
        s=Source({'document':doc});b={'target':target('/x','get')}
        with self.assertRaises(Prerequisite):request(s,b,{})
        self.assertEqual(request(s,b,{}, {'variables':{'version':'v3'}})[0]['url'],'https://east.example/v3/x')
        with self.assertRaises(Unroutable):request(s,b,{}, {'variables':{'version':'v3','region':'bad'}})
        self.assertEqual(request(s,b,{}, {'server':'https://replacement.example/base'})[0]['url'],'https://replacement.example/base/x')
        for base in ['https:///x','http://a.example/?q=1','http://user@a.example','ftp://a.example','https://a.example/#f']:
            with self.subTest(base=base),self.assertRaises(Unroutable):request(s,b,{}, {'server':base})

    def test_media_specificity_ambiguity_duplicates_and_parameters(self):
        content={'*/*':{'x':0},'text/*':{'x':1},'text/plain':{'x':2},'text/plain; charset=UTF-8':{'x':3}}
        self.assertEqual(media_select(content,'TEXT/PLAIN; charset="utf-8"')[1],{'x':3})
        self.assertEqual(media_select(content,'text/plain; charset=ascii')[1],{'x':2})
        self.assertEqual(media_select(content,'text/html')[1],{'x':1})
        with self.assertRaises(Unsupported):media_select({'text/plain;a=x':{},'text/plain;b=y':{}},'text/plain;a=x;b=y')
        with self.assertRaises(Unsupported):media_select({'text/plain':{},'Text/Plain':{}},'text/plain')
        self.assertEqual(media_select({'text/plain':{},'Text/Plain':{},'application/json':{'x':1}},'application/json')[1],{'x':1})
        with self.assertRaises(Unsupported):media_select({'text/plain; profile=A':{}},'text/plain; profile=a')

    def test_media_choice_body_free_and_multi_alternative(self):
        op={'requestBody':{'content':{'application/json':{},'text/plain':{'schema':{'type':'string'}}}}}
        s=Source({'document':api('/x','post',op)});b={'target':target('/x','post')}
        self.assertIs(request(s,b,{})[0]['body'],ABSENT)
        with self.assertRaises(Prerequisite):request(s,b,{'body':'hello'})
        self.assertEqual(request(s,b,{'body':'hello'},{'media':'text/plain'})[0]['body'],b'hello')

    def test_json_number_duplicate_bom_surrogate_rules(self):
        self.assertEqual(finish(response(),b'\xef\xbb\xbf{"x":1,"x":2}'),[('value',{'x':2}),('complete',True)])
        value=decimal.Decimal('0.123456789012345678901234567890')
        self.assertEqual(finish(response(),b'0.123456789012345678901234567890'),[('value',value),('complete',True)])
        for raw in [br'"\ud800"',b'{"x":',b'NaN',b'1 2']:
            with self.subTest(raw=raw): self.assertEqual(finish(response(),raw),[('complete',False)])

    def test_character_scalar_raw_and_schema_annotations(self):
        self.assertEqual(finish(response('text/plain',{'type':'integer'}),b'1.5','text/plain'),[('value',decimal.Decimal('1.5')),('complete',True)])
        self.assertEqual(finish(response('application/xml',{'type':'string'}),b'<x>opaque</x>','application/xml'),[('value','<x>opaque</x>'),('complete',True)])
        for raw in [b'null',b'true false',b'\xef\xbb\xbftrue']:
            self.assertEqual(finish(response('text/plain',{'type':'boolean'}),raw,'text/plain'),[('complete',False)])
        self.assertEqual(encode('application/octet-stream',{},'AP8='),b'\0\xff')
        self.assertEqual(decode('application/octet-stream',{},b'\0\xff'),'AP8=')
        for b64 in ['AP9=','AP8','AP8=\n','AP8_']:
            with self.subTest(b64=b64),self.assertRaises(Unroutable):encode('application/octet-stream',{},b64)
        schema={'schema':{'type':'string','contentEncoding':'base64'}}
        self.assertEqual(encode('application/json',schema,'AP8='),b'"AP8="')
        self.assertEqual(encode('application/json',{'schema':{'default':{'x':1},'properties':{'x':{'readOnly':True}}}},{'x':4}),b'{"x":4}')

    def test_inspection_boundaries_and_json_schema_independence(self):
        self.assertEqual(inspected_type({'allOf':[{}, {'type':'number'}]}),'number')
        self.assertEqual(inspected_type({'anyOf':[{'type':'null'},{'type':'boolean'}]}),'boolean')
        for schema in [False,{'allOf':[{'type':'number'},{'type':'string'}]}]:
            with self.assertRaises(Unroutable):inspected_type(schema)
        for schema in [{'$dynamicRef':'#node'},{'type':['string','boolean']},{'anyOf':[{'type':'string'},{}]}]:
            with self.assertRaises(Unsupported):inspected_type(schema)
        self.assertEqual(encode('application/json',{'schema':{'$schema':'https://unsupported.example/schema'}},{'x':1}),b'{"x":1}')
        # This is value carriage only; it does not claim general schema validation.

    def test_headers_ownership_and_content_coding(self):
        op={'parameters':[{'in':'header','name':'Content-Encoding','schema':{'type':'string'}}],
            'requestBody':{'content':{'application/json':{}}}}
        s=Source({'document':api('/x','post',op)});b={'target':target('/x','post')}
        req,_=request(s,b,{'parameters':{'Content-Encoding':'gzip'},'body':{'x':1}})
        self.assertEqual(gzip.decompress(req['body']),b'{"x":1}')
        with self.assertRaises(Unroutable):request(s,b,{'parameters':{'Content-Encoding':'gzip'}})
        for name,value in [('Host','evil'),('X-N',' bad'),('X-N','bad\nvalue')]:
            doc=api('/x','get',{'parameters':[{'in':'header','name':name,'schema':{}}]})
            with self.subTest(name=name,value=value),self.assertRaises(Unroutable):request(Source({'document':doc}),{'target':target('/x','get')},{'parameters':{name:value}})
        double=gzip.compress(gzip.compress(b'{"x":2}'))
        self.assertEqual(finish(response(),double,headers=[('Content-Type','application/json'),('Content-Encoding','gzip'),('Content-Encoding','gzip')]),[('value',{'x':2}),('complete',True)])

    def test_response_status_priority_no_fallback(self):
        op={'responses':{'200':{'content':{'text/plain':{'schema':{'type':'string'}}}},'2XX':{'content':{'application/json':{}}},'default':{'content':{'application/octet-stream':{}}}}}
        self.assertEqual(finish(op,b'"x"'),[('complete',False)])
        self.assertEqual(finish(op,b'"x"',status=201),[('value','x'),('complete',True)])
        op['responses']['200']=None
        self.assertEqual(finish(op,b'"x"'),[('complete',False)])
        self.assertEqual(finish(response(),b'anything',status=101),[('complete',False)])

    def test_response_empty_null_head_required_header_and_unmatched(self):
        self.assertEqual(finish(response(),b''),[('complete',True)])
        self.assertEqual(finish(response(),b'null'),[('value',None),('complete',True)])
        self.assertEqual(finish(response(),b'',method='HEAD',headers=[('Content-Encoding','unavailable')]),[('complete',True)])
        self.assertEqual(finish(response(),b'null',method='HEAD'),[('complete',False)])
        self.assertEqual(finish(response(),b'null',headers=[('Content-Type','application/json'),('Content-Type','text/plain')]),[('complete',False)])
        op=response();op['responses']['200']['headers']={'X-Proof':{'required':True,'schema':{'type':'string'}}}
        self.assertEqual(finish(op,b''),[('complete',False)])
        self.assertEqual(finish(op,b'',headers=[('x-proof','ok')]),[('complete',True)])
        self.assertEqual(finish(response(),b'x','image/png'),[('complete',False)])

    def test_output_mapping_absence_null_each_value_and_failure(self):
        self.assertEqual(finish(response(),b'{"x":null}',binding={'output':{'at':'/x'}}),[('value',None),('complete',True)])
        self.assertEqual(finish(response(),b'{}',binding={'output':{'at':'/x'}}),[('complete',True)])
        self.assertEqual(finish(response(),b'{}',binding={'output':{'array':[{'at':'/x'}]}}),[('complete',False)])
        op=response('application/x-ndjson')
        self.assertEqual(finish(op,b'{"x":1}\n{}\n{"x":null}\n','application/x-ndjson',{'output':{'at':'/x'}}),[('value',1),('value',None),('complete',True)])

    def test_sequences_late_parse_mapping_transport_failures(self):
        op=response('application/x-ndjson')
        for chunks in [[b'1\n2\r\n3'],[b'1',b'\n2\r',b'\n3'],[b'1\n2\r\n3\n']]:
            self.assertEqual(list(response_events(op,{},200,[('Content-Type','application/x-ndjson')],chunks)),[('value',1),('value',2),('value',3),('complete',True)])
        for data in [b'1\n{bad',b'1\n\n2\n',b'1\n  \n2\n']:
            self.assertEqual(finish(op,data,'application/x-ndjson'),[('value',1),('complete',False)])
        self.assertEqual(finish(op,b'{"x":1}\n{}\n','application/x-ndjson',{'output':{'array':[{'at':'/x'}]}}),[('value',[1]),('complete',False)])
        def broken():
            yield b'1\n'
            yield b'2'
            raise OSError('truncated transfer')
        self.assertEqual(list(response_events(op,{},200,[('Content-Type','application/x-ndjson')],broken())),[('value',1),('complete',False)])
        self.assertEqual(list(response_events(response(),{},200,[('Content-Type','application/json')],broken())),[('complete',False)])

    def test_failure_data_never_becomes_success(self):
        op={'responses':{'400':{'content':{'application/json':{}}}}}
        self.assertEqual(finish(op,b'{"error":"bad"}',binding={'output':{'literal':'forged-success'}},status=400),[('complete',False)])
        self.assertEqual(finish(op,b'broken',status=400),[('complete',False)])
        self.assertEqual(finish(op,b'1\n2\n','application/x-ndjson',status=400),[('complete',False)])

    def test_synthesis_independently_checked_finite_native_domain(self):
        native={'type':'object','properties':{'mode':{'enum':['fast','safe']},'payload':{'enum':[None,'é',{'n':2}]}},'required':['mode','payload'],'additionalProperties':False}
        doc=api('/submit','post',{'requestBody':{'required':True,'content':{'application/json':{'schema':native}}},'responses':{'200':{'content':{'application/json':{}}}}})
        generated=synthesize_named_json_body(doc,'/submit','post')
        obi,operation,source,binding=obi_fixture('synthesized.obi.json','http')
        self.assertEqual(generated,obi)
        self.assertEqual(obi['operations']['call'],{'input':native})
        self.assertNotIn('output',obi['operations']['call'])
        cases=[({'mode':m,'payload':p},m,p) for m in ('fast','safe') for p in (None,'é',{'n':2})]
        for caller,mode,payload in cases:
            req,_=request(source,binding,caller)
            # Expected native shape was independently enumerated above, not decoded
            # by the bridge decoder or reconstituted from generated schema.
            self.assertEqual((req['method'],req['url']),('POST','https://wire.example/base/submit'))
            self.assertEqual(json.loads(req['body']),{'mode':mode,'payload':payload})
            wrong=copy.deepcopy(binding);wrong['input']={'object':{'body':{'at':'/payload'}}}
            bad,_=request(source,wrong,caller)
            self.assertNotEqual(json.loads(bad['body']),{'mode':mode,'payload':payload})
        doc['paths']['/submit']['post']['requestBody']['content']['application/json']['schema']['unevaluatedProperties']=False
        with self.assertRaises(Unsupported):synthesize_named_json_body(doc,'/submit','post')

    def test_synthesis_per_item_output_claim_counterexample(self):
        events=finish(response('application/x-ndjson'),b'1\n2\n','application/x-ndjson')
        emitted=[v for tag,v in events if tag=='value']
        self.assertEqual(emitted,[1,2])
        self.assertTrue(all(type(v) is int for v in emitted))
        # A generator that copies aggregate `type: array` as the per-value output
        # contract contradicts the independently derived two scalar values.
        self.assertFalse(all(isinstance(v,list) for v in emitted))

    def test_r2_each_mapping_collection_and_item_scope(self):
        m={'each':{'in':{'at':'/rows'},'value':{'object':{'native':{'at':'/x'},'outer':{'at':'/outer'}}}}}
        self.assertEqual(mapping(m,{'outer':'secret','rows':[{'x':2},{'x':None}]}),[{'native':2},{'native':None}])
        self.assertEqual(mapping(m,{'rows':[]}),[])
        self.assertIs(mapping(m,{}),ABSENT)
        for collection in [None,{},'text']:
            with self.assertRaises(MappingFailure):mapping(m,{'rows':collection})
        with self.assertRaises(MappingFailure):mapping({'each':{'in':{'at':''},'value':{'at':'/missing'}}},[{}])
        nested={'each':{'in':{'at':''},'value':{'each':{'in':{'at':'/rows'},'value':{'at':'/x'}}}}}
        self.assertEqual(mapping(nested,[{'rows':[{'x':1},{'x':2}]},{'rows':[]}]),[[1,2],[]])
        for m in [{'each':{'in':{'at':''}}},{'each':{'in':{'at':''},'value':{'at':''},'index':'i'}}]:
            with self.assertRaises(Invalid):validate_mapping(m)

    def test_r2_each_hand_authored_body_and_output_collection(self):
        doc=api('/bulk','post',{'requestBody':{'content':{'application/json':{}}},'responses':{'200':{'content':{'application/json':{}}}}})
        b={'target':target('/bulk','post'),'input':{'object':{'body':{'each':{'in':{'at':'/items'},'value':{'object':{'title':{'at':'/label'}}}}}}},
            'output':{'each':{'in':{'at':'/results'},'value':{'at':'/id'}}}}
        req,op=request(Source({'document':doc}),b,{'items':[{'label':'first'},{'label':'second'}]})
        self.assertEqual(req['body'],b'[{"title":"first"},{"title":"second"}]')
        self.assertEqual(finish(op,b'{"results":[{"id":3},{"id":4}]}',binding=b),[('value',[3,4]),('complete',True)])
        self.assertEqual(finish(op,b'{"results":[{"id":3},{}]}',binding=b),[('complete',False)])

    def test_r2_path_item_additional_merge_selected_conflict_and_overrides(self):
        doc=api('/x','get');doc['components']={'pathItems':{'Base':{'additionalOperations':{'ONE':{'operationId':'one'},'SAME':{}},'servers':[{'url':'https://remote.example'}]}}}
        doc['paths']['/x']={'$ref':'#/components/pathItems/Base','additionalOperations':{'TWO':{'operationId':'two','servers':[{'url':'https://op.example'}]},'SAME':{}},'servers':[{'url':'https://local.example'}]}
        s=Source({'document':doc})
        self.assertEqual(s.select({'target':target('/x','additionalOperations/TWO')})[3]['operationId'],'two')
        self.assertEqual(s.select({'target':target('/x','additionalOperations/ONE')},{'server':'https://explicit.example'})[3]['operationId'],'one')
        with self.assertRaises(Unavailable):s.select({'target':target('/x','additionalOperations/SAME')})
        with self.assertRaises(Unavailable):s.select({'target':target('/x','additionalOperations/ONE')})
        doc['paths']['/x']={'$ref':'https://missing.example/path','get':{}}
        with self.assertRaises(Unavailable):Source({'document':doc}).select({'target':target('/x','get')})

    def test_r2_slashes_not_collapsed(self):
        s=Source({'document':api('//x//y','get')});b={'target':target('//x//y','get')}
        self.assertEqual(request(s,b,{}, {'server':'https://a.example/base//'})[0]['url'],'https://a.example/base///x//y')

    def test_r2_schema_category_consensus_boolean_root_and_numeric_minimum(self):
        self.assertEqual(inspected_type({'allOf':[{'type':'number'},{'type':'integer'}]}),'integer')
        self.assertEqual(inspected_type({'anyOf':[{'type':'string'},{'type':'string'},{'type':'null'}]}),'string')
        self.assertEqual(inspected_type({'oneOf':[{'type':'boolean'},{'type':'boolean'}]}),'boolean')
        r=Resolver({'memory:false':'false','memory:true':'true','memory:empty':'{}'})
        s=Source({'document':api('/x','get')},r)
        self.assertIs(s.ref({'$ref':'memory:false'},expected='schema')[0],False)
        self.assertIs(s.ref({'$ref':'memory:true'},expected='schema')[0],True)
        self.assertEqual(s.ref({'$ref':'memory:empty'},expected='schema')[0],{})
        for n in [-(2**53)+1,-1,0,1,(2**53)-1]:
            self.assertEqual(encode('application/json',{},n),str(n).encode())
            self.assertEqual(finish(response(),str(n).encode()),[('value',n),('complete',True)])

    def test_r2_unavailable_parameter_projection_does_not_qualify_keys(self):
        doc=api('/x','get',{'parameters':[{'name':'Host','in':'header','schema':{}},{'name':'Host','in':'query','schema':{}},
            {'name':'X-ID','in':'header','schema':{}},{'name':'x-id','in':'header','schema':{}}]})
        s=Source({'document':doc});b={'target':target('/x','get')}
        self.assertEqual(request(s,b,{'parameters':{'Host':'yes'}})[0]['url'],'https://wire.example/base/x?Host=yes')
        for parameters in [{'header/Host':'evil'},{'X-ID':'x','x-id':'y'}]:
            with self.assertRaises(Unroutable):request(s,b,{'parameters':parameters})
        doc['paths']['/x']['get']['parameters'][0]['required']=True
        with self.assertRaises(Unroutable):request(Source({'document':doc}),b,{})

    def test_r2_undefined_query_values_and_header_content_bytes(self):
        doc=api('/x','get',{'parameters':[{'name':'q','in':'query','schema':{}},
            {'name':'X-Data','in':'header','content':{'application/json':{}}}]})
        s=Source({'document':doc});b={'target':target('/x','get')}
        for val in [None,[],{},'']:
            self.assertEqual(request(s,b,{'parameters':{'q':val}})[0]['url'],'https://wire.example/base/x?q=')
        self.assertEqual(request(s,b,{'parameters':{'X-Data':{'a':'b c'}}})[0]['headers']['X-Data'],'{"a":"b c"}')

    def test_r2_accept_is_context_and_response_content_type_header_ignored(self):
        doc=api('/x','get',response('text/plain; q=literal',{'type':'string'}));s=Source({'document':doc});b={'target':target('/x','get')}
        req,op=request(s,b,{})
        self.assertNotIn('Accept',req['headers'])
        self.assertEqual(request(s,b,{}, {'accept':'application/json'})[0]['headers']['Accept'],'application/json')
        self.assertEqual(finish(op,b'hello','text/plain; q=literal'),[('value','hello'),('complete',True)])
        op=response('application/octet-stream');op['responses']['200']['headers']={'Content-Type':{'required':True}}
        self.assertEqual(list(response_events(op,{},200,[],[b'abc'])),[('value','YWJj'),('complete',True)])

    def test_r3_each_parent_batch_and_nested_scopes(self):
        doc=api('/batch','post',{'requestBody':{'content':{'application/json':{}}}})
        b={'target':target('/batch','post'),'input':{'object':{'body':{'each':{'in':{'at':'/items'},'value':{'object':{
            'batch':{'at':'/batch','up':1},'name':{'at':'/label'}}}}}}}}
        caller={'batch':'batch-7','items':[{'label':'a'},{'label':'b'}]}
        req,_=request(Source({'document':doc}),b,caller)
        native=[{'batch':'batch-7','name':'a'},{'batch':'batch-7','name':'b'}]
        self.assertEqual(json.loads(req['body']),native)
        wrong=copy.deepcopy(b)
        wrong['input']['object']['body']['each']['value']['object']['batch']['up']=0
        self.assertNotEqual(json.loads(request(Source({'document':doc}),wrong,caller)[0]['body']),native)
        nested={'each':{'in':{'at':'/groups'},'value':{'each':{'in':{'at':'/rows'},'value':{'object':{
            'root':{'at':'/batch','up':2},'group':{'at':'/name','up':1},'value':{'at':''}}}}}}}
        self.assertEqual(mapping(nested,{'batch':'b','groups':[{'name':'g','rows':[3,4]}]}),[[{'root':'b','group':'g','value':3},{'root':'b','group':'g','value':4}]])
        with_float={'each':{'in':{'at':''},'value':{'at':'','up':1.0}}}
        self.assertEqual(mapping(with_float,[1]),[[1]])

    def test_r3_up_binding_validation_is_static(self):
        for bad in [{'at':'','up':-1},{'at':'','up':0.5},{'at':'','up':True},{'at':'','up':'0'},
            {'at':'','up':1},{'literal':1,'up':0},
            {'object':{'a':{'at':'','up':1}}},
            {'each':{'in':{'at':'','up':1},'value':{'at':''}}},
            {'each':{'in':{'literal':[]},'value':{'at':'','up':2}}}]:
            with self.subTest(bad=bad),self.assertRaises(Invalid):validate_mapping(bad)
        self.assertEqual(mapping({'at':'','up':0},None),None)

    def test_r3_case_distinct_header_single_contribution(self):
        doc=api('/x','get',{'parameters':[{'name':'X-Tag','in':'header','schema':{}},{'name':'x-tag','in':'header','schema':{}}]})
        s=Source({'document':doc});b={'target':target('/x','get')}
        self.assertEqual(request(s,b,{'parameters':{'X-Tag':'upper'}})[0]['headers'],{'X-Tag':'upper'})
        self.assertEqual(request(s,b,{'parameters':{'x-tag':'lower'}})[0]['headers'],{'x-tag':'lower'})
        self.assertEqual(request(s,b,{})[0]['headers'],{})
        with self.assertRaises(Unroutable):request(s,b,{'parameters':{'X-Tag':'upper','x-tag':'lower'}})
        doc['paths']['/x']['get']['parameters'][0]['required']=True
        with self.assertRaises(Unroutable):request(Source({'document':doc}),b,{'parameters':{'x-tag':'lower'}})

    def test_complete_obi_fixtures_have_current_core_relationships(self):
        authored_doc,authored_binding,_=hand_authored()
        hand,operation,source,binding=obi_fixture('hand-authored.obi.json','submitTask.http')
        self.assertEqual(source.doc,authored_doc)
        self.assertEqual(binding,authored_binding)
        self.assertEqual(set(hand['operations']),{'submitTask'})
        self.assertEqual(operation['input']['required'],['key','name','labels','enabled','note'])
        synthesized,operation,source,binding=obi_fixture('synthesized.obi.json','http')
        self.assertEqual(synthesized['bindings']['http']['operation'],'call')
        self.assertEqual(synthesized['bindings']['http']['source'],'api')
        self.assertNotIn('output',operation)
        # These checks establish linkage and the displayed fixture shape, not a
        # claim that every current-core document rule was evaluated.

    def test_security_accept_and_accept_encoding_sole_credential_fields(self):
        for name in ('Accept','Accept-Encoding'):
            doc=api('/x','get',{'security':[{'Key':[]}]})
            doc['components']={'securitySchemes':{'Key':{'type':'apiKey','in':'header','name':name}}}
            op=doc['paths']['/x']['get']
            credential='application/key' if name=='Accept' else 'x-key'
            competing='application/json' if name=='Accept' else 'gzip'
            actual=security_probe.assemble(doc,op,credentials={'Key':credential})
            self.assertEqual(security_probe.headers(actual),{name.lower():credential})
            # Runtime choice to emit nothing permits the credential above.
            # A separately generated negotiation field cannot overwrite it.
            with self.assertRaises(Unroutable):
                security_probe.assemble(doc,op,credentials={'Key':credential},runtime_headers={name.swapcase():competing})
            other='Accept-Encoding' if name=='Accept' else 'Accept'
            other_value='gzip' if other=='Accept-Encoding' else 'application/json'
            combined=security_probe.assemble(doc,op,credentials={'Key':credential},runtime_headers={other:other_value})
            self.assertEqual(security_probe.headers(combined),{name.lower():credential,other.lower():other_value})
        for name in ('Host','Content-Type','Content-Encoding'):
            doc=api('/x','get',{'security':[{'Key':[]}]})
            doc['components']={'securitySchemes':{'Key':{'type':'apiKey','in':'header','name':name}}}
            with self.assertRaises(Unroutable):security_probe.assemble(doc,doc['paths']['/x']['get'],credentials={'Key':'opaque-key'})

    def test_security_redirect_removes_every_cookie_and_selected_header_credential(self):
        for cookie_parameter,cookie_input in [
            ({'name':'sid','in':'cookie','style':'cookie','schema':{'type':'string'}},{'sid':'ordinary'}),
            ({'name':'cOoKiE','in':'header','schema':{'type':'string'}},{'cOoKiE':'sid=raw'})]:
            doc=api('/x','get',{'security':[{'Key':[],'Auth':[]}],'parameters':[cookie_parameter,{'name':'X-Note','in':'header','schema':{'type':'string'}}]})
            doc['components']={'securitySchemes':{
                'Key':{'type':'apiKey','in':'header','name':'X-Api-Key'},
                'Auth':{'type':'apiKey','in':'header','name':'Authorization'}}}
            op=doc['paths']['/x']['get']
            contributions=security_probe.assemble(doc,op,parameters={**cookie_input,'X-Note':'public'},credentials={'Key':'header-secret','Auth':'auth-secret'})
            original=security_probe.headers(contributions)
            expected_cookie='sid=ordinary' if cookie_parameter['in']=='cookie' else 'sid=raw'
            self.assertEqual(original,{'cookie':expected_cookie,'x-note':'public','x-api-key':'header-secret','authorization':'auth-secret'})
            # Scheme, host and effective port govern origin, not textual spelling.
            for destination in ('https://EXAMPLE.test:443/next','https://example.test/elsewhere'):
                uri,permitted=security_probe.redirect('https://example.test/start',destination,contributions)
                self.assertEqual(uri,destination)
                self.assertEqual(security_probe.headers(permitted),original)
            for destination in ('https://other.test/next?from=location','http://example.test/next','https://example.test:444/next'):
                uri,permitted=security_probe.redirect('https://example.test/start?old=not-copied',destination,contributions)
                self.assertEqual(uri,destination)
                self.assertEqual(security_probe.headers(permitted),{'x-note':'public'})
                # A mutant retaining ordinary Cookie or either credential is
                # a wrong native forwarding decision even if it drops the rest.
                for forbidden in ('cookie','x-api-key','authorization'):
                    wrong={'x-note':'public',forbidden:original[forbidden]}
                    self.assertNotEqual(security_probe.headers(permitted),wrong)

    def test_security_raw_and_structured_cookie_contributions_cannot_combine(self):
        doc=api('/x','get',{'parameters':[{'name':'sid','in':'cookie','style':'cookie','schema':{'type':'string'}},
            {'name':'Cookie','in':'header','schema':{'type':'string'}}]})
        op=doc['paths']['/x']['get']
        with self.assertRaises(Unroutable):security_probe.assemble(doc,op,parameters={'sid':'a','Cookie':'other=b'})

    def test_optional_validated_data_type_determination_has_independent_evidence(self):
        schema={'type':['string','number'],'enum':[7,'seven']}
        declaration={'schema':schema}
        calls=[]
        def independently_checked_fixture_domain(actual,value):
            # This exact predicate separately establishes both schema keywords
            # for this finite domain. It does not call inspected_type or encode.
            self.assertEqual(actual,{'type':['string','number'],'enum':[7,'seven']})
            calls.append(value)
            return (type(value) in (int,float) and value==7) or (type(value) is str and value=='seven')
        with self.assertRaises(Unsupported):encode_checked_text(declaration,7)
        self.assertEqual(encode_checked_text(declaration,7,independently_checked_fixture_domain),b'7')
        self.assertEqual(encode_checked_text(declaration,'seven',independently_checked_fixture_domain),b'seven')
        with self.assertRaises(Unroutable):encode_checked_text(declaration,7,independently_checked_fixture_domain,claimed_type='string')
        with self.assertRaises(Unroutable):encode_checked_text(declaration,'not-in-domain',independently_checked_fixture_domain,claimed_type='string')
        with self.assertRaises(Unroutable):encode_checked_text(declaration,True,independently_checked_fixture_domain)
        self.assertEqual(calls,[7,'seven',7,'not-in-domain',True])

    def test_actual_loopback_acquisition_dispatch_and_stream(self):
        captured=[]
        class Handler(http.server.BaseHTTPRequestHandler):
            protocol_version='HTTP/1.1'
            def log_message(self,*args): pass
            def do_GET(self):
                if self.path=='/redirect':
                    self.send_response(302);self.send_header('Location','/dir/api.json');self.send_header('Content-Length','0');self.end_headers();return
                if self.path=='/missing':
                    body=b'{"openapi":"3.2.0"}';self.send_response(404)
                else:
                    body=json.dumps(server_doc).encode();self.send_response(200)
                self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
            def do_POST(self):
                body=self.rfile.read(int(self.headers.get('Content-Length',0)))
                captured.append((self.command,self.path,self.headers.get('Content-Type'),json.loads(body)))
                payload=b'{"answer":1}\n{"answer":2}\n'
                self.send_response(200);self.send_header('Content-Type','application/x-ndjson');self.send_header('Content-Length',str(len(payload)));self.end_headers();self.wfile.write(payload)
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
        base='http://127.0.0.1:'+str(server.server_port)
        server_doc=api('/submit','post',{'requestBody':{'content':{'application/json':{}}},'responses':{'200':{'content':{'application/x-ndjson':{}}}}})
        server_doc['servers']=[{'url':'../service'}]
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            source=Source({'location':base+'/redirect'},Resolver(http=True))
            self.assertEqual(source.retrieval,base+'/dir/api.json')
            binding={'target':target('/submit','post'),'input':{'object':{'body':{'at':'/payload'}}},'output':{'at':'/answer'}}
            req,op=request(source,binding,{'payload':{'native':'value'}})
            self.assertEqual(dispatch(req,op,binding),[('value',1),('value',2),('complete',True)])
            self.assertEqual(captured,[('POST','/service/submit','application/json',{'native':'value'})])
            with self.assertRaises(Unavailable):Source({'location':base+'/missing'},Resolver(http=True))
        finally:server.shutdown();server.server_close();thread.join(timeout=2)

def hand_authored():
    op={'parameters':[{'in':'path','name':'id','required':True,'schema':{'type':'string'}},
        {'in':'query','name':'tag','schema':{'type':'array','items':{'type':'string'}}},
        {'in':'query','name':'flag','schema':{'type':'boolean'}}],
        'requestBody':{'required':True,'content':{'application/json':{}}},'responses':{'200':{'content':{'application/json':{}}}}}
    binding={'target':target(),'input':{'object':{'parameters':{'object':{'id':{'at':'/key'},'tag':{'at':'/labels'},'flag':{'at':'/enabled'}}},
        'body':{'object':{'title':{'at':'/name'},'done':{'literal':False},'note':{'at':'/note'},'omitted':{'at':'/notThere'}}}}},'output':{'at':'/result'}}
    caller={'key':'a/b','name':'alpha','labels':['x y','z'],'enabled':True,'note':None}
    return api(op=op),binding,caller

def native_request_oracle(req):
    """A separately written service-side expectation, not probe.py decoding."""
    try:
        p=url.urlsplit(req['url'])
        normalized=re.sub(r'%[0-9a-fA-F]{2}',lambda m:m[0].upper(),p.path)
        pairs=url.parse_qsl(p.query,keep_blank_values=True)
        header={k.lower():v for k,v in req['headers'].items()}
        return req['method']=='POST' and (p.scheme,p.netloc,normalized)==('https','wire.example','/base/things/a%2Fb') \
            and [v for k,v in pairs if k=='tag']==['x y','z'] and [v for k,v in pairs if k=='flag']==['true'] \
            and len(pairs)==3 and header['content-type'].lower()=='application/json' \
            and json.loads(req['body'])=={'title':'alpha','done':False,'note':None}
    except Exception:return False

if __name__=='__main__':
    suite=unittest.defaultTestLoader.loadTestsFromTestCase(Probes)
    from family_tests import FamilyProbes
    from family_r6_tests import FinalFamilyProbes
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(FamilyProbes))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(FinalFamilyProbes))
    result=unittest.TextTestRunner(verbosity=2).run(suite)
    metadata={'spec_sha256':hashlib.sha256(SPEC.read_bytes()).hexdigest(),'pilot_sha256':'7ed075b2fc0d20bd017e496b89a030c86aa5e9fd8eb388e063c0105eb27b20b2','target_spec_sha256':EXPECTED_SPEC_SHA256,
        'core_sha256':hashlib.sha256(CORE.read_bytes()).hexdigest(),'target_core_sha256':EXPECTED_CORE_SHA256,
        'tests_run':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),
        'skipped':len(result.skipped),'success':result.wasSuccessful(),
        'claim':'Independent focused probes only; not full kind or core conformance.',
        'test_names':unittest.defaultTestLoader.getTestCaseNames(Probes)+unittest.defaultTestLoader.getTestCaseNames(FamilyProbes)+unittest.defaultTestLoader.getTestCaseNames(FinalFamilyProbes),
        'executed_artifact_sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in pathlib.Path(__file__).parent.iterdir()
            if p.suffix in ('.py','.rb') or p.name.endswith(('.obi.json','.oas.json','native-expectations.json'))}}
    pathlib.Path(__file__).with_name('results.json').write_text(json.dumps(metadata,indent=2)+'\n')
    raise SystemExit(not result.wasSuccessful())
