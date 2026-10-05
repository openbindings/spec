"""Fresh family-revision cases. Expectations below are native facts written
separately from the serializers; this file does not use a bridge decoder as an
oracle for its encoder. Existing streaming/scalar/querystring tests also run.
"""
import codecs
import copy
import decimal
import email.parser
import email.policy
import http.server
import json
from pathlib import Path
import threading
import unittest
import urllib.parse as url

from probe import *
from multipart_probe import compose_form_data,fixed_headers,string_domain
from tests import api,target,response,finish,obi_fixture

def family(binding_key):return obi_fixture('family.obi.json',binding_key+'.http')

def mount_fixture(entry_servers=None,item_servers=None,operation_servers=None,local_servers=None):
    operation={'responses':{'200':{'description':'ok','content':{'application/json':{}}}}}
    if operation_servers is not None:operation['servers']=operation_servers
    foreign={'openapi':'3.2.0','info':{'title':'Foreign','version':'1'},'$self':'https://identity.example/shared/identity',
        'servers':[{'url':'https://wrong-root.example/foreign'}],
        'security':[{'ForeignRoot':[]}],
        'components':{'pathItems':{'Mounted':{'get':operation}}}}
    if item_servers is not None:foreign['components']['pathItems']['Mounted']['servers']=item_servers
    entry=api('/mounted','get');entry['servers']=entry_servers or [{'url':'./entry-base'}]
    entry['security']=[{'EntryKey':[]}]
    entry['components']={'securitySchemes':{'EntryKey':{'type':'apiKey','in':'header','name':'X-Entry-Key'}}}
    entry['paths']['/mounted']={'$ref':'https://retrieval.example/foreign/path-items.json#/components/pathItems/Mounted'}
    if local_servers is not None:entry['paths']['/mounted']['servers']=local_servers
    obi={'openbindings':'0.2.0','operations':{'mounted':{}},'sources':{'api':{'kind':'openbindings.openapi-3.2@1',
        'content':{'document':entry,'location':'https://retrieval.example/entry/openapi.json'}}},
        'bindings':{'http':{'operation':'mounted','source':'api','content':{'target':target('/mounted','get')}}}}
    return obi,foreign

def mounted_request(obi,foreign,context=None):
    binding=obi['bindings']['http'];source_spec=obi['sources'][binding['source']]
    assert binding['operation'] in obi['operations']
    resolver=Resolver({'https://retrieval.example/foreign/path-items.json':foreign})
    s=Source(source_spec['content'],resolver)
    return request(s,binding['content'],{},context or {'credentials':{'EntryKey':'entry-secret'}}),resolver

def native_uri_oracle(uri):
    p=url.urlsplit(uri)
    segments=p.path.split('/')
    return p.scheme=='https' and p.netloc=='wire.example' and len(segments)==4 and segments[:3]==['','service','opaque'] \
        and url.unquote_to_bytes(segments[3])==b'A/~?&=Z' and url.parse_qsl(p.query,keep_blank_values=True)==[('q','A/~?&=Z')]

def parsed_parts(media,body):
    # Independent stdlib MIME parser; raw payload intentionally avoids CTE decode.
    message=email.parser.BytesParser(policy=email.policy.default).parsebytes(('Content-Type: '+media+'\r\nMIME-Version: 1.0\r\n\r\n').encode()+body)
    return [{'name':part.get_param('name',header='content-disposition'),
        'filename':part.get_filename(),'media':part.get_content_type(),
        'cte':part.get('Content-Transfer-Encoding'),'raw':part.get_payload(decode=False)} for part in message.iter_parts()]

class FamilyProbes(unittest.TestCase):
    def test_family_source_fragment_boundary_all_modes(self):
        doc=api('/x','get')
        yaml='openapi: 3.2.0\ninfo: {title: x, version: "1"}\npaths: {/x: {get: {}}}\n'
        forms=[{}, {'document':doc},{'document':json.dumps(doc)},{'document':yaml}]
        for form in forms:
            for fragment in ('/nested','%2Fnested','x','#'):
                resolver=Resolver({'memory:whole':doc})
                with self.subTest(form=list(form),fragment=fragment),self.assertRaises(Invalid):
                    Source({**form,'location':'memory:whole#'+fragment},resolver)
                self.assertEqual(resolver.calls,[])
            resolver=Resolver({'memory:whole':doc})
            source=Source({**form,'location':'memory:whole#'},resolver)
            self.assertEqual(source.retrieval,'memory:whole')
            self.assertEqual(resolver.calls,[] if form else ['memory:whole'])
            self.assertIn('/x',source.doc['paths'])
        r=Resolver({'memory:whole%23name':doc})
        self.assertEqual(Source({'location':'memory:whole%23name#'},r).retrieval,'memory:whole%23name')
        self.assertEqual(r.calls,['memory:whole%23name'])

    def test_family_impossible_union_branches_do_not_obscure_scalar(self):
        impossible={'allOf':[{'type':'string'},{'type':'number'}]}
        for keyword in ('anyOf','oneOf'):
            for branches in [[False,{'type':'number'}],[impossible,{'type':'number'}],
                [False,impossible,{'type':'null'},{'type':'integer'}],
                [False,{'type':'string'},{'type':'string'}]]:
                schema={keyword:branches}
                expected='integer' if {'type':'integer'} in branches else 'string' if {'type':'string'} in branches else 'number'
                self.assertEqual(inspected_type(schema),expected)
        for branches in [[False,impossible],[False,{'type':'null'}]]:
            with self.assertRaises(Unroutable):inspected_type({'anyOf':branches})
        for branches in [[False,{} ,{'type':'number'}],[False,{'type':'number'},{'type':'string'}]]:
            with self.assertRaises(Unsupported):inspected_type({'anyOf':branches})
        _,_,source,binding=family('numberXml')
        req,_=request(source,binding,7)
        self.assertEqual((req['headers']['Content-Type'],req['body']),('application/probe+xml',b'7'))

    def test_family_mount_inherits_entry_root_servers_and_security(self):
        obi,foreign=mount_fixture()
        (req,_),resolver=mounted_request(obi,foreign)
        self.assertEqual(req['url'],'https://retrieval.example/entry/entry-base/mounted')
        self.assertEqual(req['headers'],{'X-Entry-Key':'entry-secret'})
        self.assertEqual(resolver.calls,['https://retrieval.example/foreign/path-items.json'])
        self.assertNotIn('wrong-root',req['url'])
        # Scheme lookup scope is separate from entry-root inheritance.
        foreign['components']['securitySchemes']={'EntryKey':{'type':'apiKey','in':'header','name':'X-Referring-Key'}}
        (referring,_),_=mounted_request(obi,foreign,{'credentials':{'EntryKey':'selected-secret'},'scheme_scope':'referring'})
        self.assertEqual(referring['headers'],{'X-Referring-Key':'selected-secret'})
        self.assertEqual(referring['url'],'https://retrieval.example/entry/entry-base/mounted')
        # Foreign root auth is not inherited; root anonymous entry stays usable.
        obi['sources']['api']['content']['document']['security']=[]
        (req,_),_=mounted_request(obi,foreign,{'server':'https://explicit.example'})
        self.assertEqual(req['headers'],{})

    def test_family_mount_server_declaration_physical_base_and_precedence(self):
        cases=[({'item_servers':[{'url':'./path-base'}]},'https://retrieval.example/foreign/path-base/mounted'),
            ({'operation_servers':[{'url':'./operation-base'}]},'https://retrieval.example/foreign/operation-base/mounted'),
            ({'local_servers':[{'url':'./local-base'}]},'https://retrieval.example/entry/local-base/mounted'),
            ({'item_servers':[],'operation_servers':[]},'https://retrieval.example/entry/entry-base/mounted')]
        for kwargs,expected in cases:
            obi,foreign=mount_fixture(**kwargs)
            (req,_),_=mounted_request(obi,foreign)
            self.assertEqual(req['url'],expected)
            self.assertNotIn('identity.example',req['url'])
        # A local operation can inherit a referenced Path Item's relative server.
        obi,foreign=mount_fixture(item_servers=[{'url':'./path-base'}])
        foreign['components']['pathItems']['Mounted'].pop('get')
        obi['sources']['api']['content']['document']['paths']['/mounted']['get']={}
        self.assertEqual(mounted_request(obi,foreign)[0][0]['url'],'https://retrieval.example/foreign/path-base/mounted')

    def test_family_mount_relative_parameter_refs_keep_contributing_document(self):
        obi,foreign=mount_fixture()
        item=foreign['components']['pathItems']['Mounted']
        item['parameters']=[{'$ref':'params#/components/parameters/Tag'}]
        parameter_doc={'openapi':'3.2.0','components':{'parameters':{'Tag':{'name':'tag','in':'query','schema':{'type':'string'}}}}}
        r=Resolver({'https://retrieval.example/foreign/path-items.json':foreign,'https://identity.example/shared/params':parameter_doc})
        source=Source(obi['sources']['api']['content'],r)
        req,_=request(source,obi['bindings']['http']['content'],{'parameters':{'tag':'same-base'}},{'credentials':{'EntryKey':'entry-secret'}})
        self.assertEqual(req['url'],'https://retrieval.example/entry/entry-base/mounted?tag=same-base')
        self.assertEqual(r.calls,['https://retrieval.example/foreign/path-items.json','https://identity.example/shared/params'])

    def test_family_content_uri_spelling_variation_and_structure_negatives(self):
        _,_,source,binding=family('contentUri')
        req,_=request(source,binding,{'path':'A/~?&=Z','query':'A/~?&=Z'})
        self.assertEqual(req['url'],'https://wire.example/service/opaque/A%2F~%3F%26%3DZ?q=A%2F~%3F%26%3DZ')
        variants=[req['url'],req['url'].replace('A','%41').replace('Z','%5a').replace('~','%7E'),req['url'].replace('%2F','%2f')]
        for variant in variants:self.assertTrue(native_uri_oracle(variant))
        for bad in [req['url'].replace('%2F','/'),req['url'].replace('%26','&'),req['url'].replace('%3F','?')]:
            self.assertFalse(native_uri_oracle(bad))

    def test_family_deep_object_values_and_names_escaped_without_extra_members(self):
        _,_,source,binding=family('deep')
        req,_=request(source,binding,{'filters':{'a&b':'x=y&z','normal':'[still data]'}})
        pairs=url.parse_qsl(url.urlsplit(req['url']).query)
        self.assertEqual(pairs,[('filter[a&b]','x=y&z'),('filter[normal]','[still data]')])
        self.assertEqual(len(pairs),2)
        self.assertNotEqual(url.parse_qsl(url.urlsplit(req['url'].replace('%26','&')).query),pairs)
        for bad in [{'a[b]':'x'},{'a]':'x'}]:
            with self.assertRaises(Unsupported):request(source,binding,{'filters':bad})
        for bad in [{'a':{'nested':'x'}},{'a':['x']},{'a':None}]:
            with self.assertRaises(Unroutable):request(source,binding,{'filters':bad})

    def test_family_space_pipe_delimiter_scalar_boundary(self):
        for style,separator in [('spaceDelimited',' '),('pipeDelimited','|')]:
            doc=api('/x','get',{'parameters':[{'name':'q','in':'query','style':style,'schema':{'type':'array'}}]})
            s=Source({'document':doc});b={'target':target('/x','get')}
            req,_=request(s,b,{'parameters':{'q':['a','b&c']}})
            self.assertEqual(url.parse_qsl(url.urlsplit(req['url']).query),[('q','a'+separator+'b&c')])
            with self.assertRaises(Unsupported):request(s,b,{'parameters':{'q':['a'+separator+'b']}})

    def test_family_xml_receipt_encoding_precedence_and_metadata(self):
        declaration={'schema':{'type':'string'}}
        text='<?xml version="1.0"?><x>café &amp; tea</x>'
        self.assertEqual(decode('application/xml; charset=iso-8859-1',declaration,codecs.BOM_UTF8+text.encode()),text)
        self.assertEqual(decode('text/xml; charset=utf-8',declaration,codecs.BOM_UTF16_LE+text.encode('utf-16-le')),text)
        iso='<?xml version="1.0" encoding="ISO-8859-1"?><x>café</x>'
        self.assertEqual(decode('application/probe+xml',declaration,iso.encode('iso-8859-1')),iso)
        # MIME charset outranks a conflicting declaration on receipt.
        claimed='<?xml version="1.0" encoding="UTF-8"?><x>café</x>'
        self.assertEqual(decode('application/xml; charset=iso-8859-1',declaration,claimed.encode('iso-8859-1')),claimed)
        default='<x>雪</x>'
        self.assertEqual(decode('application/xml',declaration,default.encode()),default)
        # Exactly the encoding signature is stripped, never a second character.
        self.assertEqual(decode('application/xml',declaration,codecs.BOM_UTF8+'\ufeff<x/>'.encode()),'\ufeff<x/>')

    def test_family_xml_and_nonxml_common_scalar_correspondence(self):
        for media in ('text/plain','application/xml','application/probe+xml'):
            self.assertEqual(encode(media,{'schema':{'type':'boolean'}},True),b'true')
            self.assertEqual(decode(media,{'schema':{'type':'number'}},b' \t7.0\r\n'),decimal.Decimal('7.0'))
            self.assertEqual(decode(media,{'schema':{'type':'integer'}},b'1.5'),decimal.Decimal('1.5'))
            for invalid in [b'null',b'7 8',b'\x0b7',b'NaN']:
                with self.assertRaises((ValueError,Unsupported)):decode(media,{'schema':{'type':'number'}},invalid)
        self.assertEqual(decode('application/xml',{'schema':{'type':'boolean'}},codecs.BOM_UTF8+b'true'),True)
        with self.assertRaises(ValueError):decode('text/plain',{'schema':{'type':'boolean'}},codecs.BOM_UTF8+b'true')
        with self.assertRaises(ValueError):decode('application/xml',{'schema':{'type':'number'}},codecs.BOM_UTF8+codecs.BOM_UTF8+b'7')

    def test_family_xml_request_preserves_markup_and_codec_limits(self):
        _,_,source,binding=family('xml')
        text='<?xml version="1.0" encoding="ISO-8859-1"?><x>café &amp; tea</x>'
        req,_=request(source,binding,text)
        self.assertEqual(req['body'],b'<?xml version="1.0" encoding="ISO-8859-1"?><x>caf\xe9 &amp; tea</x>')
        self.assertNotEqual(req['body'],text.encode('utf-8'))
        markup='<!DOCTYPE x [<!ENTITY e SYSTEM "file:///not-read">]><x>&e;</x>'
        self.assertEqual(encode('application/xml',{'schema':{'type':'string'}},markup),markup.encode())
        self.assertEqual(decode('application/xml',{'schema':{'type':'string'}},markup.encode()),markup)
        with self.assertRaises(Unsupported):encode('application/xml',{'schema':{'type':'string'}},'<?xml encoding="x-unavailable"?><x/>')
        with self.assertRaises(Unsupported):decode('application/xml; charset=x-unavailable',{'schema':{'type':'string'}},b'<x/>')
        with self.assertRaises(Unroutable):encode('application/xml; charset=iso-8859-1',{'schema':{'type':'string'}},'<x>雪</x>')

    def test_family_fixed_headers_schema_form_content_form_and_case_agreement(self):
        doc=api('/x','get');doc['components']={'schemas':{'Language':{'enum':['en','fr']}}}
        source=Source({'document':doc})
        headers={'Content-Language':{'schema':{'allOf':[{'$ref':'#/components/schemas/Language'},{'const':'en'}]}},
            'content-language':{'schema':{'enum':['en']}},'Optional':{'schema':{'default':'not-fixed'}},
            'Content-Type':{'required':True,'schema':{'const':'ignored'}},
            'Content-Description':{'content':{'text/plain':{'schema':{'const':'not-a-raw-header'}}}}}
        self.assertEqual(fixed_headers(headers,source),{'Content-Language':'en'})
        for h in [{'Content-Language':{'required':True,'schema':{'default':'en'}}},
            {'Content-Description':{'required':True,'content':{'text/plain':{'schema':{'const':'fixed-body-not-header'}}}}}]:
            with self.assertRaises(Unsupported):fixed_headers(h,source)
        headers['content-language']['schema']={'const':'fr'}
        with self.assertRaises(Unroutable):fixed_headers(headers,source)

    def test_family_cte_annotation_alone_and_explicit_coherent_no_second_encoding(self):
        _,_,source,binding=family('parts')
        req,_=request(source,binding,{'payload':'SGk='})
        expected=[{'name':'payload','filename':None,'media':'text/plain','cte':'base64','raw':'SGk='}]
        self.assertEqual(parsed_parts(req['headers']['Content-Type'],req['body']),expected)
        self.assertNotEqual(parsed_parts(req['headers']['Content-Type'],req['body'].replace(b'SGk=',b'U0drPQ==')),expected)
        self.assertNotEqual(parsed_parts(req['headers']['Content-Type'],req['body'].replace(b'SGk=',b'Hi')),expected)
        alt,_=request(source,binding,{'payload':'SGk='},{'boundary':'another-permitted-boundary'})
        self.assertNotEqual(req['body'],alt['body'])
        self.assertEqual(parsed_parts(alt['headers']['Content-Type'],alt['body']),expected)
        # Annotation does not create CTE by itself.
        decl=copy.deepcopy(source.doc['paths']['/parts']['post']['requestBody']['content']['multipart/form-data'])
        decl['encoding']['payload']['headers']={}
        media,body=compose_form_data(decl,{'payload':'SGk='},source)
        self.assertEqual(parsed_parts(media,body),[{**expected[0],'cte':None}])

    def test_family_cte_incoherence_transform_and_part_rules_refuse(self):
        _,_,source,_=family('parts')
        base=source.doc['paths']['/parts']['post']['requestBody']['content']['multipart/form-data']
        bad=copy.deepcopy(base);bad['encoding']['payload']['headers']['Content-Transfer-Encoding']['schema']={'const':'quoted-printable'}
        with self.assertRaises(Unroutable):compose_form_data(bad,{'payload':'SGk='},source)
        bad=copy.deepcopy(base);bad['schema']['properties']['payload'].pop('contentEncoding')
        with self.assertRaises(Unsupported):compose_form_data(bad,{'payload':'SGk='},source)
        bad=copy.deepcopy(base);bad['encoding']['payload']['headers']['Content-Description']={'schema':{'const':'illegal-for-form-data'}}
        with self.assertRaises(Unsupported):compose_form_data(bad,{'payload':'SGk='},source)
        bad=copy.deepcopy(base);bad['encoding']['payload']['headers']['Content-Disposition']={'schema':{'const':'form-data; name="wrong"'}}
        with self.assertRaises(Unroutable):compose_form_data(bad,{'payload':'SGk='},source)

    def test_family_actual_http_acquisition_and_repaired_native_interactions(self):
        captured=[];retrieved=[]
        obi=json.loads(Path(__file__).with_name('family.obi.json').read_text())
        doc=obi['sources']['api']['content']['document']
        doc['servers']=[{'url':'../service'}]
        doc['security']=[{'EntryKey':[]}]
        doc['components']={'securitySchemes':{'EntryKey':{'type':'apiKey','in':'header','name':'X-Entry-Key'}}}
        doc['paths']['/mounted']={'$ref':'../refs/shared.json#/components/pathItems/Mounted'}
        doc['paths']['/mounted-physical']={'$ref':'../refs/shared.json#/components/pathItems/Physical'}
        for key in ('mounted','mounted-physical'):
            obi['operations'][key]={}
            obi['bindings'][key+'.http']={'operation':key,'source':'api','content':{'target':target('/'+key,'get')}}
        shared={'openapi':'3.2.0','info':{'title':'Mounted','version':'1'},'servers':[{'url':'/wrong-foreign-root'}],
            'security':[{'MissingForeignKey':[]}],'components':{'pathItems':{
                'Mounted':{'get':{'responses':response()['responses']}},
                'Physical':{'servers':[{'url':'./physical'}],'get':{'responses':response()['responses']}}}}}
        reply='<?xml version="1.0"?><reply>☃</reply>'
        class Handler(http.server.BaseHTTPRequestHandler):
            protocol_version='HTTP/1.1'
            def log_message(self,*args):pass
            def send(self,status,data,media='application/json'):
                self.send_response(status);self.send_header('Content-Type',media);self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
            def do_GET(self):
                if self.path=='/redirect':
                    retrieved.append(self.path);self.send_response(302);self.send_header('Location','/published/api.json');self.send_header('Content-Length','0');self.end_headers();return
                if self.path in ('/published/api.json','/refs/shared.json'):
                    retrieved.append(self.path);self.send(200,json.dumps(doc if self.path=='/published/api.json' else shared).encode());return
                captured.append({'method':'GET','path':self.path,'key':self.headers.get('X-Entry-Key')})
                self.send(200,b'{"ok":true}')
            def do_POST(self):
                data=self.rfile.read(int(self.headers.get('Content-Length',0)))
                captured.append({'method':'POST','path':self.path,'key':self.headers.get('X-Entry-Key'),'media':self.headers.get('Content-Type'),'body':data})
                if self.path=='/service/xml':self.send(200,codecs.BOM_UTF16_LE+reply.encode('utf-16-le'),'application/xml; charset=utf-8')
                else:self.send(200,b'{"ok":true}')
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
        base='http://127.0.0.1:'+str(server.server_port)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            # The source is selected through the complete OBI, then acquired over
            # real HTTP, including empty-fragment removal before acquisition.
            obi['sources']['api']['content']={'location':base+'/redirect#'}
            source=Source(obi['sources']['api']['content'],Resolver(http=True))
            self.assertEqual(source.retrieval,base+'/published/api.json')
            context={'credentials':{'EntryKey':'entry-secret'}}
            xml='<?xml version="1.0" encoding="ISO-8859-1"?><x>café &amp; tea</x>'
            for key,value,expected in [('xml',xml,[('value',reply),('complete',True)]),
                ('deep',{'filters':{'a&b':'x=y&z'}},[('value',{'ok':True}),('complete',True)]),
                ('contentUri',{'path':'A/~?&=Z','query':'A/~?&=Z'},[('value',{'ok':True}),('complete',True)]),
                ('parts',{'payload':'SGk='},[('value',{'ok':True}),('complete',True)]),
                ('mounted',{},[('value',{'ok':True}),('complete',True)]),
                ('mounted-physical',{},[('value',{'ok':True}),('complete',True)])]:
                link=obi['bindings'][key+'.http'];self.assertIn(link['operation'],obi['operations'])
                binding=link['content'];req,op=request(source,binding,value,context)
                self.assertEqual(dispatch(req,op,binding),expected)
            binding=obi['bindings']['contentUri.http']['content']
            alternate,op=request(source,binding,{'path':'A/~?&=Z','query':'A/~?&=Z'},context)
            alternate['url']=alternate['url'].replace('A','%41').replace('Z','%5a').replace('~','%7E')
            self.assertEqual(dispatch(alternate,op,binding),[('value',{'ok':True}),('complete',True)])
            self.assertEqual(captured[0]['body'],b'<?xml version="1.0" encoding="ISO-8859-1"?><x>caf\xe9 &amp; tea</x>')
            self.assertEqual(captured[0]['path'],'/service/xml')
            self.assertEqual(url.parse_qsl(url.urlsplit(captured[1]['path']).query),[('filter[a&b]','x=y&z')])
            self.assertEqual(captured[2]['path'],'/service/opaque/A%2F~%3F%26%3DZ?q=A%2F~%3F%26%3DZ')
            self.assertEqual(parsed_parts(captured[3]['media'],captured[3]['body']),[{'name':'payload','filename':None,'media':'text/plain','cte':'base64','raw':'SGk='}])
            self.assertEqual([c['path'] for c in captured[4:6]],['/service/mounted','/refs/physical/mounted-physical'])
            self.assertEqual(captured[6]['path'],'/service/opaque/%41%2F%7E%3F%26%3D%5a?q=%41%2F%7E%3F%26%3D%5a')
            self.assertEqual(url.unquote_to_bytes(url.urlsplit(captured[6]['path']).path.split('/')[-1]),b'A/~?&=Z')
            self.assertEqual(url.parse_qsl(url.urlsplit(captured[6]['path']).query),[('q','A/~?&=Z')])
            self.assertTrue(all(c['key']=='entry-secret' for c in captured))
            self.assertEqual(retrieved[:2],['/redirect','/published/api.json'])
            self.assertEqual(retrieved.count('/refs/shared.json'),2)
            # Persist native observed traces; bodies are represented without loss.
            record=[{**c,'body_hex':c['body'].hex()} if 'body' in c else c for c in captured]
            for c in record:c.pop('body',None)
            Path(__file__).with_name('family-http-trace.json').write_text(json.dumps({'candidate':__import__('tests').EXPECTED_SPEC_SHA256,'retrieval_paths':retrieved,'requests':record},indent=2)+'\n')
        finally:server.shutdown();server.server_close();thread.join(timeout=2)
