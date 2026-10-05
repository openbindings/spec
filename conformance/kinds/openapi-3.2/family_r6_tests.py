"""Final-family probes: literal native expectations, not encoder round trips."""
import copy
import http.server
import json
from pathlib import Path
import threading
import unittest
import urllib.parse as url

from probe import *
from family_tests import parsed_parts
from tests import obi_fixture

HERE=Path(__file__).parent

def load(name):return json.loads((HERE/name).read_text())
def save(name,value):(HERE/name).write_text(json.dumps(value,indent=2)+'\n')
def null_fixture(key):return obi_fixture('family-r6-null.obi.json',key+'.http')
def null_declaration(source,key,media='multipart/form-data'):
    return source.doc['paths']['/'+key]['post']['requestBody']['content'][media]

def observations(req):
    return [{'name':p['name'],'media':p['media'],'body_hex':p['raw'].encode().hex(),
        'filename':p['filename'],'cte':p['cte']} for p in parsed_parts(req['headers']['Content-Type'],req['body'])]

def grouped(parts):
    groups={}
    for part in parts:groups.setdefault(part['name'],[]).append(part)
    return groups

def reference_source():
    obi=load('family-r6-references.obi.json')
    resources={
        'https://refs.example/redirect/path-item.json':(load('family-r6-path-item.oas.json'),'https://refs.example/physical/path-item.json'),
        'https://refs.example/physical/parameter.json':load('family-r6-parameter.oas.json'),
        'https://refs.example/physical/reply-alias.json':(load('family-r6-response.oas.json'),'https://refs.example/physical/replies/response.json'),
        'https://refs.example/physical/replies/trace-header.json':load('family-r6-header.oas.json'),
        'https://refs.example/roots/shared.json':load('family-r6-shared.oas.json')}
    resolver=Resolver(resources)
    return obi,Source(obi['sources']['api']['content'],resolver),resolver

class FinalFamilyProbes(unittest.TestCase):
    def test_r6_named_required_optional_json_null_exact_bytes(self):
        _,_,source,binding=null_fixture('named')
        req,_=request(source,binding,{'requiredNull':None,'optionalNull':None})
        expected=load('family-r6-native-expectations.json')['null_pair']
        self.assertEqual(observations(req),expected)
        self.assertEqual([len(bytes.fromhex(p['body_hex'])) for p in expected],[4,4])
        self.assertTrue(all(p['media']=='application/json' for p in expected))
        for mutation in [expected[:1],[{**expected[0],'body_hex':'226e756c6c22'},expected[1]],
                [{**expected[0],'body_hex':''},expected[1]]]:
            self.assertNotEqual(grouped(mutation),grouped(expected))

    def test_r6_named_array_null_order_and_whole_null_one_part(self):
        _,_,source,binding=null_fixture('named')
        req,_=request(source,binding,{'requiredNull':None,'items':[1,None,2],'whole':None})
        actual=observations(req);expected=load('family-r6-native-expectations.json')['named_array']
        self.assertEqual(actual,expected)
        self.assertEqual([x['body_hex'] for x in actual if x['name']=='items'],['31','6e756c6c','32'])
        self.assertEqual(len([x for x in actual if x['name']=='whole']),1)
        for wrong in [[actual[0],actual[2],actual[1],*actual[3:]],actual[:2]+actual[3:],
                [actual[0],{**actual[1],'body_hex':'5b312c6e756c6c2c325d'},actual[-1]]]:
            self.assertNotEqual(grouped(wrong),grouped(expected))

    def test_r6_json_null_permitted_media_boundary_and_named_order_variation(self):
        _,_,source,binding=null_fixture('named')
        decl=null_declaration(source,'named')
        decl['encoding']['optionalNull']['contentType']='Application/JSON'
        req,_=request(source,binding,{'optionalNull':None,'requiredNull':None},{'boundary':'Different-Boundary-82'})
        self.assertEqual(grouped(observations(req)),grouped(load('family-r6-native-expectations.json')['null_pair']))
        self.assertIn(b'Content-Type: Application/JSON\r\n',req['body'])

    def test_r6_nonjson_null_omission_required_and_array_item_refusal(self):
        _,_,source,binding=null_fixture('plain')
        req,_=request(source,binding,{'requiredNull':'present','optionalNull':None})
        self.assertEqual(observations(req),load('family-r6-native-expectations.json')['plain_omission'])
        with self.assertRaises(Unsupported):request(source,binding,{'requiredNull':None})
        for values in ([None],[1,None]):
            with self.assertRaises(Unsupported):request(source,binding,{'requiredNull':'present','items':values})
        # Raw bytes media also has no invented null spelling.
        null_declaration(source,'plain')['encoding']['optionalNull']['contentType']='application/octet-stream'
        req,_=request(source,binding,{'requiredNull':'present','optionalNull':None})
        self.assertEqual(observations(req),load('family-r6-native-expectations.json')['plain_omission'])
        null_declaration(source,'plain')['encoding']['requiredNull']['contentType']='application/octet-stream'
        with self.assertRaises(Unsupported):request(source,binding,{'requiredNull':None})

    def test_r6_null_still_needs_media_choice_absence_does_not(self):
        _,_,source,binding=null_fixture('choice')
        req,_=request(source,binding,{})
        self.assertEqual(observations(req),[])
        with self.assertRaises(Prerequisite):request(source,binding,{'optionalNull':None})
        req,_=request(source,binding,{'optionalNull':None},{'property_media':{'optionalNull':'application/json'}})
        self.assertEqual(observations(req),load('family-r6-native-expectations.json')['null_pair'][1:])
        req,_=request(source,binding,{'optionalNull':None},{'property_media':{'optionalNull':'text/plain'}})
        self.assertEqual(observations(req),[])
        with self.assertRaises(Unsupported):request(source,binding,{'optionalNull':None},{'property_media':{'optionalNull':'image/png'}})
        decl=null_declaration(source,'choice');decl['encoding']['optionalNull']['contentType']='application/*'
        with self.assertRaises(Prerequisite):request(source,binding,{'optionalNull':None})
        req,_=request(source,binding,{'optionalNull':None},{'property_media':{'optionalNull':'application/problem+json'}})
        self.assertEqual(observations(req)[0]['body_hex'],'6e756c6c')

    def test_r6_positional_null_preserves_positions_and_rejects_nonjson(self):
        _,_,source,binding=null_fixture('positional')
        req,_=request(source,binding,[None,7,None])
        expected=load('family-r6-native-expectations.json')['positional']
        self.assertEqual(observations(req),expected)
        self.assertNotEqual(expected[1:],expected)
        self.assertNotEqual([expected[1],expected[0],expected[2]],expected)
        decl=null_declaration(source,'positional','multipart/mixed')
        decl['prefixEncoding'][2]['contentType']='text/plain'
        with self.assertRaises(Unsupported):request(source,binding,[None,7,None])
        # An unused position needs no media choice or null conversion.
        decl['prefixEncoding'][2]['contentType']='application/*'
        req,_=request(source,binding,[None,7])
        self.assertEqual(observations(req),expected[:2])
        with self.assertRaises(Prerequisite):request(source,binding,[None,7,None])

    def test_r6_whole_form_null_refuses_and_style_null_remains_undefined(self):
        for key in ('named','positional'):
            _,_,source,binding=null_fixture(key)
            with self.assertRaises(Unroutable):request(source,binding,None)
        _,_,source,binding=null_fixture('style')
        req,_=request(source,binding,{'parameters':{'q':None}})
        self.assertEqual(req['url'],'https://refs.example/entry/service/style?q=')
        req,_=request(source,binding,{'parameters':{}})
        self.assertEqual(req['url'],'https://refs.example/entry/service/style')

    def test_r6_expected_standalone_roots_and_physical_redirect_bases(self):
        obi,source,resolver=reference_source();binding=obi['bindings']['mounted.http']['content']
        req,op=request(source,binding,{'parameters':{'q':'x&y'}})
        self.assertEqual(req['url'],'https://refs.example/physical/dispatch/mounted?q=x%26y')
        self.assertEqual(list(response_events(op,binding,200,[('Content-Type','application/json'),('X-Trace','witness')],[b'{"mounted":true}'])),[('value',{'mounted':True}),('complete',True)])
        self.assertEqual(resolver.calls,[
            'https://refs.example/redirect/path-item.json','https://refs.example/physical/parameter.json',
            'https://refs.example/physical/reply-alias.json','https://refs.example/physical/replies/trace-header.json'])
        self.assertFalse(any('unused-unavailable' in x for x in resolver.calls))
        # Wrong response scope would miss the required Header and cannot succeed.
        self.assertEqual(list(response_events(op,binding,200,[('Content-Type','application/json')],[b'{"mounted":true}'])),[('complete',False)])
        self.assertNotEqual(req['url'],'https://refs.example/redirect/dispatch/mounted?q=x%26y')

    def test_r6_one_root_multiple_expected_types_and_untyped_embedding_limit(self):
        obi,source,resolver=reference_source();binding=obi['bindings']['shared.http']['content']
        req,op=request(source,binding,{'parameters':{'q':7}})
        self.assertEqual(req['url'],'https://refs.example/entry/service/shared?q=7')
        self.assertEqual(list(response_events(op,binding,200,[('Content-Type','application/json')],[b'7'])),[('value',7),('complete',True)])
        self.assertEqual(resolver.calls,['https://refs.example/roots/shared.json']*2)
        # No persistent classifier makes the first Parameter reading erase the
        # Response interpretation of the same node (or vice versa).
        response_root=source.ref({'$ref':'https://refs.example/roots/shared.json'},expected='response')[0]
        parameter_root=source.ref({'$ref':'https://refs.example/roots/shared.json'},expected='parameter')[0]
        self.assertEqual(response_root['content'],{'application/json':{}})
        self.assertEqual((parameter_root['in'],parameter_root['name']),('query','q'))
        resolver.resources['https://refs.example/untyped']={'nested':load('family-r6-parameter.oas.json')}
        with self.assertRaises(Unsupported):source.ref({'$ref':'https://refs.example/untyped#/nested'},expected='parameter')
        with self.assertRaises(Unsupported):source.ref({'$ref':'https://refs.example/roots/shared.json'})

    def test_r6_actual_http_null_parts_and_typed_standalone_roots(self):
        null_obi=load('family-r6-null.obi.json');ref_obi=load('family-r6-references.obi.json')
        documents={'/entry/null.json':null_obi['sources']['api']['content']['document'],
            '/entry/api.json':ref_obi['sources']['api']['content']['document'],
            '/physical/path-item.json':load('family-r6-path-item.oas.json'),
            '/physical/parameter.json':load('family-r6-parameter.oas.json'),
            '/physical/replies/response.json':load('family-r6-response.oas.json'),
            '/physical/replies/trace-header.json':load('family-r6-header.oas.json'),
            '/roots/shared.json':load('family-r6-shared.oas.json')}
        redirects={'/redirect/path-item.json':'/physical/path-item.json','/physical/reply-alias.json':'/physical/replies/response.json'}
        acquired=[];captured=[]
        class Handler(http.server.BaseHTTPRequestHandler):
            protocol_version='HTTP/1.1'
            def log_message(self,*args):pass
            def send(self,status,data,extra=False):
                self.send_response(status)
                if status!=204:self.send_header('Content-Type','application/json')
                if extra:self.send_header('X-Trace','witness')
                self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
            def do_GET(self):
                if self.path in redirects:
                    acquired.append(self.path);self.send_response(302);self.send_header('Location',redirects[self.path]);self.send_header('Content-Length','0');self.end_headers();return
                if self.path in documents:
                    acquired.append(self.path);self.send(200,json.dumps(documents[self.path]).encode());return
                captured.append({'method':'GET','path':self.path})
                if self.path=='/physical/dispatch/mounted?q=x%26y':self.send(200,b'{"mounted":true}',True)
                elif self.path=='/entry/service/shared?q=7':self.send(200,b'7')
                else:self.send(404,b'{"wrong":"target"}')
            def do_POST(self):
                body=self.rfile.read(int(self.headers.get('Content-Length',0)))
                captured.append({'method':'POST','path':self.path,'media':self.headers.get('Content-Type'),'body_hex':body.hex()})
                self.send(204,b'')
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
        base='http://127.0.0.1:'+str(server.server_port)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            null_obi['sources']['api']['content']={'location':base+'/entry/null.json'}
            ref_obi['sources']['api']['content']={'location':base+'/entry/api.json'}
            save('family-r6-live-null.obi.json',null_obi);save('family-r6-live-references.obi.json',ref_obi)
            nsource=Source(null_obi['sources']['api']['content'],Resolver(http=True))
            rsource=Source(ref_obi['sources']['api']['content'],Resolver(http=True))
            expected=load('family-r6-native-expectations.json')
            for key,value,ctx,expectation in [
                ('named',{'requiredNull':None,'optionalNull':None},{},'null_pair'),
                ('named',{'requiredNull':None,'items':[1,None,2],'whole':None},{'boundary':'Live-Variant-39'},'named_array'),
                ('positional',[None,7,None],{},'positional'),
                ('plain',{'requiredNull':'present','optionalNull':None},{},'plain_omission'),
                ('choice',{'optionalNull':None},{'property_media':{'optionalNull':'application/json'}},'selected_null')]:
                link=null_obi['bindings'][key+'.http'];self.assertIn(link['operation'],null_obi['operations'])
                self.assertEqual(link['source'],'api');binding=link['content']
                req,op=request(nsource,binding,value,ctx)
                self.assertEqual(dispatch(req,op,binding),[('complete',True)])
                native=captured[-1]
                self.assertEqual(native['path'],'/entry/service/'+key)
                self.assertEqual(observations({'headers':{'Content-Type':native['media']},'body':bytes.fromhex(native['body_hex'])}),expected[expectation])
            for key,value,native_output in [('mounted',{'parameters':{'q':'x&y'}},{'mounted':True}),('shared',{'parameters':{'q':7}},7)]:
                link=ref_obi['bindings'][key+'.http'];self.assertIn(link['operation'],ref_obi['operations'])
                self.assertEqual(link['source'],'api');binding=link['content']
                req,op=request(rsource,binding,value)
                self.assertEqual(dispatch(req,op,binding),[('value',native_output),('complete',True)])
            self.assertEqual([x['path'] for x in captured[-2:]],['/physical/dispatch/mounted?q=x%26y','/entry/service/shared?q=7'])
            self.assertEqual(acquired,[
                '/entry/null.json','/entry/api.json','/redirect/path-item.json','/physical/path-item.json',
                '/physical/parameter.json','/physical/reply-alias.json','/physical/replies/response.json',
                '/physical/replies/trace-header.json','/roots/shared.json','/roots/shared.json'])
            save('family-r6-http-trace.json',{'candidate':__import__('tests').EXPECTED_SPEC_SHA256,'acquisition_paths':acquired,'requests':captured})
        finally:server.shutdown();server.server_close();thread.join(timeout=2)
