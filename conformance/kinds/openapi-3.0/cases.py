"""Hand-authored source inputs, caller inputs, native expectations and responses.

This module imports no interpreter/encoder/decoder. Helpers only assemble fixture
JSON. Expected wire facts and completion values below are authored directly.
"""
import base64, codecs, copy, gzip, json
KIND='openbindings.openapi-3.0@1'
ORIGIN='http://127.0.0.1:__PORT__'
CASES=[]

def artifact(method='get',path='/check',*,params=None,body=None,resp=None,**fields):
    op={'responses':resp if resp is not None else {'200':{'description':'ok','content':{'application/json':{'schema':{}}}}}}
    if params is not None:op['parameters']=params
    if body is not None:op['requestBody']=body
    op.update(fields)
    return {'openapi':'3.0.4','info':{'title':'Independent native surface','version':'1'},'servers':[{'url':ORIGIN+'/api'}],'paths':{path:{method:op}}}
def target(path='/check',method='get'):return '/paths/'+path.replace('~','~0').replace('/','~1')+'/'+method
def obi(doc,content=None,source=None):
    # A complete OBI, with intentionally unconstrained honest operation schemas.
    return {'openbindings':'0.2.0','name':'Independent OAS 3.0 probe','operations':{'perform':{'description':'Invoke the fixture surface','input':True,'output':True}},'sources':{'native':{'kind':KIND,'content':source if source is not None else {'document':doc}}},'bindings':{'invoke':{'operation':'perform','source':'native','content':content if content is not None else {'target':target()}}}}
def response(body=b'{"native":true}',status=200,headers=None):return {'status':status,'headers':headers if headers is not None else [['Content-Type','application/json']],'body':body}
def expected(method='GET',path='/api/check',query=None,headers=None,body=None,**extra):
    return {'method':method,'path':path,'query':query or [],'headers':headers or {},'body_hex':(body or b'').hex(),**extra}
def add(name,doc=None,*,input=None,absent=False,context=None,binding=None,source=None,expect=None,result=None,native=None,error=None,resources=None,origin='hand-authored',authority='candidate §§2–10'):
    c={'id':name,'authority':authority,'origin':origin,'obi':obi(copy.deepcopy(doc or artifact()),copy.deepcopy(binding),copy.deepcopy(source)),'context':context or {},'expected_request':expect or expected(),'response':native or response(),'expected_completion':result or {'success':True,'values':[{'native':True}]},'resources':resources or {}}
    if not absent:c['input']={} if input is None else input
    if error:c['error']=error
    CASES.append(c);return c

def p(n,loc='query',schema=None,**kw):return {'name':n,'in':loc,'schema':schema or {'type':'string'},**kw}
def rb(mt='application/json',schema=None,required=False,encoding=None):
    decl={'schema':schema if schema is not None else {}}
    if encoding is not None:decl['encoding']=encoding
    return {'required':required,'content':{mt:decl}}
def rr(mt='application/json',schema=None,headers=None):
    return {'200':{'description':'ok','content':{mt:{'schema':schema if schema is not None else {}}},'headers':headers or {}}}
def error_case(name,error,**kw):return add(name,error=error,**kw)

# Admitted patches all acquire and dispatch a real request in native mode.
for patch in range(5):
    d=artifact();d['openapi']='3.0.'+str(patch);add('patch-'+str(patch),d,authority='§1')
d=artifact();add('source-json-text',source={'document':json.dumps(d)},authority='§2')
yaml_text='''openapi: 3.0.4
info: {title: Independent YAML, version: "1"}
servers: [{url: "'''+ORIGIN+'''/api"}]
x-core: {yes: yes, leading: 012, hex: 0x10, octal: 0o10, truth: TRUE}
paths:
  /check:
    get:
      responses:
        200: {description: okay, content: {application/json: {schema: {}}}}
'''
add('source-yaml-core',source={'document':yaml_text},authority='§2/YAML1.2.2 Core')
for name,wire in [('utf8',json.dumps(d).encode()),('utf16',json.dumps(d).encode('utf-16')),('yaml-utf8',yaml_text.encode())]:
    add('source-location-'+name,source={'location':ORIGIN+'/artifacts/entry'},resources={'/artifacts/entry':{'body':wire}},authority='§2')
for text in (False,True):add('source-both-'+('text' if text else 'object'),source={'document':json.dumps(d) if text else d,'location':ORIGIN+'/do-not-fetch'},authority='§2')
d2=artifact();d2['servers']=[{'url':'../api'}]
add('artifact-redirect-final-base',source={'location':ORIGIN+'/old'},resources={'/old':{'status':302,'headers':[['Location','/relocated/entry']]},'/relocated/entry':{'body':json.dumps(d2).encode()}},authority='§2/§5')
for name,src in [('absent',None),('null',None),('empty',{}),('unknown',{'document':d,'unexpected':True}),('document-null',{'document':None}),('location-relative',{'location':'relative.yaml'})]:
    c=error_case('invalid-source-'+name,'invalid',source=src)
    if name=='absent':del c['obi']['sources']['native']['content']
    elif name=='null':c['obi']['sources']['native']['content']=None
    elif name=='empty':c['obi']['sources']['native']['content']={}
for name,text in [('duplicate','openapi: 3.0.4\nopenapi: 3.0.4'),('nonscalar','? [a,b]\n: c'),('tag','openapi: !!bool 3.0.4'),('multidoc','---\na: b\n---\nc: d'),('nan','openapi: 3.0.4\nx: .NaN'),('nonobject','[a,b]')]:error_case('artifact-'+name,'invalid',source={'document':text})
for patch in ('3.0.5','3.1.0','3.2.0'):
    dd=artifact();dd['openapi']=patch;error_case('edition-'+patch,'invalid',doc=dd)
error_case('artifact-http-error-not-document','unavailable',source={'location':ORIGIN+'/broken'},resources={'/broken':{'status':404,'body':json.dumps(d).encode()}})
error_case('artifact-policy-denied','unavailable',source={'location':'https://example.invalid/artifact'})
for name,b in [('null',None),('empty',{}),('unknown',{'target':target(),'selector':'legacy'}),('fragment',{'target':'#'+target()}),('percent-pointer',{'target':'/paths/%2Fcheck/get'}),('bad-escape',{'target':'/paths/~2check/get'}),('upper-method',{'target':'/paths/~1check/GET'})]:
    c=error_case('binding-'+name,'invalid',binding=b)
    if name=='null':c['obi']['bindings']['invoke']['content']=None
    if name=='empty':c['obi']['bindings']['invoke']['content']={}
error_case('target-missing-operation','no-target',binding={'target':target('/check','post')})
add('literal-target-percent-and-tilde',artifact(path='/p%2Fq~1'),binding={'target':target('/p%2Fq~1')},expect=expected(path='/api/p%2Fq~1'),authority='§3/RFC6901')

# Reference context and declaration inheritance: external document is deliberately
# not an OAS entry document. Its unrelated data does not poison the reached value.
refdoc={'item':{'get':{'responses':rr()}},'unrelated':False,'servers':[{'url':ORIGIN+'/wrong'}]}
d=artifact(path='/mounted');d['paths']['/mounted']={'$ref':'parts.json#/item','description':'local annotation'}
add('mounted-entry-server',d,binding={'target':target('/mounted')},source={'document':d,'location':ORIGIN+'/artifacts/main'},resources={'/artifacts/parts.json':{'body':json.dumps(refdoc).encode()}},expect=expected(path='/api/mounted'),authority='§2–3')
rd=copy.deepcopy(refdoc);rd['item']['get']['servers']=[{'url':'../native/'}]
add('referenced-relative-server',d,binding={'target':target('/mounted')},source={'document':d,'location':ORIGIN+'/artifacts/main'},resources={'/artifacts/parts.json':{'body':json.dumps(rd).encode()}},expect=expected(path='/native/mounted'))
dc=copy.deepcopy(d);dc['paths']['/mounted']['get']={'responses':rr()}
error_case('Path-Item-used-collision','unavailable',doc=dc,binding={'target':target('/mounted')},source={'document':dc,'location':ORIGIN+'/artifacts/main'},resources={'/artifacts/parts.json':{'body':json.dumps(refdoc).encode()}})
du=copy.deepcopy(d);du['paths']['/mounted']['servers']=[{'url':ORIGIN+'/unused-local'}];rdu=copy.deepcopy(rd);rdu['item']['servers']=[{'url':ORIGIN+'/unused-remote'}]
add('Path-Item-overridden-collision-unused',du,binding={'target':target('/mounted')},source={'document':du,'location':ORIGIN+'/artifacts/main'},resources={'/artifacts/parts.json':{'body':json.dumps(rdu).encode()}},expect=expected(path='/native/mounted'))
error_case('Path-Item-missing-ref-local-no-replacement','unavailable',doc=dc,binding={'target':target('/mounted')},source={'document':dc,'location':ORIGIN+'/artifacts/main'})
error_case('relative-reference-no-OBI-base','missing-context',doc=d,binding={'target':target('/mounted')})
d=artifact(params=[{'$ref':'#/components/parameters/q','name':'wrong','in':'header'}]);d['components']={'parameters':{'q':p('q')}}
add('Reference-adjacent-ignored',d,input={'parameters':{'q':'right'}},expect=expected(query=[['q','right']]))
d=artifact();d['components']={'schemas':{'recursive':{'type':'object','properties':{'next':{'$ref':'#/components/schemas/recursive'}}}}}
add('unused-schema-cycle-does-not-poison',d)

# All mapping forms, nested scopes, absence/null, invalid mapping shape.
row_mapping = {'object': {
    'v': {'at': ''}, 'group': {'at': '/tag', 'up': 1},
    'tenant': {'at': '/tenant', 'up': 2}}}
group_mapping = {'object': {'tag': {'at': '/tag'},
    'items': {'each': {'in': {'at': '/rows'}, 'value': row_mapping}}}}
m = {'object': {'body': {'object': {
    'batch': {'each': {'in': {'at': '/groups'}, 'value': group_mapping}},
    'pair': {'array': [{'literal': None}, {'at': '/tenant'}]},
    'omit': {'at': '/missing'}}}}}

add('mapping-nested-each-up',artifact('post',body=rb()),input={'tenant':'T','groups':[{'tag':'A','rows':[2,3]},{'tag':'B','rows':[]}]},binding={'target':target(method='post'),'input':m,'output':{'object':{'result':{'at':'/native'},'missing':{'at':'/missing'}}}},expect=expected('POST',headers={'content-type':'application/json'},body_json={'batch':[{'tag':'A','items':[{'v':2,'group':'A','tenant':'T'},{'v':3,'group':'A','tenant':'T'}]},{'tag':'B','items':[]}],'pair':[None,'T']}),result={'success':True,'values':[{'result':True}]},authority='§4')
add('mapping-absent-input-empty-pointer',absent=True,binding={'target':target(),'input':{'at':''}})
add('mapping-absent-output-suppresses',binding={'target':target(),'output':{'at':'/missing'}},result={'success':True,'values':[]})
add('mapping-null-output-value',binding={'target':target(),'output':{'literal':None}},result={'success':True,'values':[None]})
add('mapping-absent-collection-omitted',artifact('post',body=rb()),input={},binding={'target':target(method='post'),'input':{'object':{'body':{'object':{'rows':{'each':{'in':{'at':'/missing'},'value':{'at':''}}}}}}}},expect=expected('POST',headers={'content-type':'application/json'},body_json={}))
for name,mp in [('up',{'at':'','up':1}),('negative-up',{'at':'','up':-1}),('bool-up',{'at':'','up':True}),('ambiguous',{'at':'','literal':None}),('each-extra',{'each':{'in':{'at':''},'value':{'at':''},'index':True}})]:error_case('mapping-invalid-'+name,'invalid',binding={'target':target(),'input':mp})
for name,mp in [('array-absence',{'array':[{'at':'/missing'}]}),('each-scalar',{'each':{'in':{'literal':3},'value':{'at':''}}}),('each-absence',{'each':{'in':{'literal':[{}]},'value':{'at':'/missing'}}})]:error_case('mapping-failure-'+name,'mapping',binding={'target':target(),'input':mp})
add('output-mapping-failure',binding={'target':target(),'output':{'array':[{'at':'/missing'}]}},result={'success':False,'values':[]})
error_case('request-null-envelope','unroutable',binding={'target':target(),'input':{'literal':None}})
error_case('request-unknown-member','unroutable',input={'alien':1})
error_case('request-null-parameters','unroutable',input={'parameters':None})

# Server/context choices, exact repeated slash preservation.
d=artifact();d['servers']=[{'url':ORIGIN+'/one'},{'url':ORIGIN+'/two'}]
error_case('server-choice-missing','missing-context',doc=d)
add('server-explicit-choice',d,context={'server_index':1},expect=expected(path='/two/check'))
add('server-complete-replacement',d,context={'server':ORIGIN+'/base//'},expect=expected(path='/base//check'))
d=artifact();d['servers']=[{'url':ORIGIN+'/{stage}','variables':{'stage':{'default':'prod','enum':['prod','dev']}}}]
add('server-variable-default',d,expect=expected(path='/prod/check'))
add('server-variable-substitution',d,context={'variables':{'stage':'dev'}},expect=expected(path='/dev/check'))
error_case('server-variable-enum','unroutable',doc=d,context={'variables':{'stage':'other'}})
d['servers'][0]['variables']={}
add('server-missing-variable-recovered',d,context={'variables':{'stage':'external'}},expect=expected(path='/external/check'))
for v in ('http://user@127.0.0.1:__PORT__/','http://127.0.0.1:__PORT__/?q=1','http://127.0.0.1:__PORT__/#f'):
    error_case('bad-server-'+str(len(CASES)),'unroutable',context={'server':v})

# Parameter destinations and serialization. Expected query values represent the
# native URI after percent decoding; repeated values retain per-name order.
add('parameter-qualified-keys',artifact(params=[p('id'),p('id','header'),p('a/b~','query')]),input={'parameters':{'query/id':'q','header/id':'h','query/a~1b~0':'literal'}},expect=expected(query=[['id','q'],['a/b~','literal']],headers={'id':'h'}))
d=artifact(params=[p('q',schema={'type':'array','items':{'type':'string'}})]);d['paths']['/check']['parameters']=[p('q','query',required=True)]
add('parameter-operation-override',d,input={'parameters':{'q':['a','b']}},expect=expected(query=[['q','a'],['q','b']]))
for style,explode,v,encoded in [('simple',False,['a','b'],'a,b'),('label',True,['a','b'],'.a.b'),('matrix',True,{'a':'x','b':'y'},';a=x;b=y')]:
    add('path-'+style,artifact(path='/p/{v}',params=[p('v','path',required=True,style=style,explode=explode)]),input={'parameters':{'v':v}},binding={'target':target('/p/{v}')},expect=expected(path='/api/p/'+encoded))
for v,n in [(None,'null'),([], 'empty-array'),({},'empty-object'),('', 'empty-string')]:
    add('parameter-undefined-'+n,artifact(params=[p('q')]),input={'parameters':{'q':v}},expect=expected(query=[] if isinstance(v,(list,dict)) else [['q','']]))
add('optional-parameter-absent',artifact(params=[p('q')]))
error_case('required-parameter-absent','unroutable',doc=artifact(params=[p('q',required=True)]))
add('query-deepObject-encoded-delimiters',artifact(params=[p('filter',style='deepObject',explode=True)]),input={'parameters':{'filter':{'x':'a&b=c'}}},expect=expected(query=[['filter[x]','a&b=c']]))
error_case('deepObject-bracket-key','unsupported',doc=artifact(params=[p('f',style='deepObject',explode=True)]),input={'parameters':{'f':{'x[y]':'z'}}})
for style,sep in [('spaceDelimited',' '),('pipeDelimited','|')]:
    add('query-'+style,artifact(params=[p('q',style=style)]),input={'parameters':{'q':['one','two']}},expect=expected(query=[['q','one'+sep+'two']]))
    error_case('query-'+style+'-separator-data','unsupported',doc=artifact(params=[p('q',style=style)]),input={'parameters':{'q':['one'+sep+'two']}})
add('scalar-context-json',artifact(params=[p('q')]),input={'parameters':{'q':[True,3]}},context={'scalar':'json'},expect=expected(query=[['q','true'],['q','3']]))
error_case('scalar-context-missing','missing-context',doc=artifact(params=[p('q')]),input={'parameters':{'q':True}})
add('mixed-reserved-ordinary-query',artifact(params=[p('r',allowReserved=True),p('s')]),input={'parameters':{'r':'https://x/y?a','s':'&x=y'}},expect=expected(query=[['r','https://x/y?a'],['s','&x=y']]))
add('header-corrected-no-percent-encoding',artifact(params=[p('X-Value','header')]),input={'parameters':{'X-Value':'café / ='}},expect=expected(headers={'x-value':'café / ='}),authority='§6/incorporated OAS3.1.2 AppendixD correction only')
for val in (' leading','trailing ','bad\r\nfield'):
    error_case('header-invalid-'+str(len(CASES)),'unroutable',doc=artifact(params=[p('X','header')]),input={'parameters':{'X':val}})
add('header-case-one-supplied',artifact(params=[p('X','header'),p('x','header')]),input={'parameters':{'X':'one'}},expect=expected(headers={'x':'one'}))
error_case('header-case-collision','unroutable',doc=artifact(params=[p('X','header'),p('x','header')]),input={'parameters':{'X':'one','x':'two'}})
add('ignored-headers-have-no-keys',artifact(params=[p('Accept','header',required=True),p('Content-Type','header'),p('Authorization','header')]))
error_case('ignored-header-input-key','unroutable',doc=artifact(params=[p('Accept','header')]),input={'parameters':{'Accept':'application/json'}})
add('optional-unavailable-projection',artifact(params=[p('Host','header'),p('bad name','header')]))
error_case('required-owned-projection','unsupported',doc=artifact(params=[p('Host','header',required=True)]))
add('cookie-schema-encoded',artifact(params=[p('session','cookie')]),input={'parameters':{'session':'a b'}},expect=expected(headers={'cookie':'session=a%20b'}))
add('cookie-single-array',artifact(params=[p('s','cookie')]),input={'parameters':{'s':['one']}},expect=expected(headers={'cookie':'s=one'}))
error_case('cookie-multiple-logical-values','unsupported',doc=artifact(params=[p('s','cookie')]),input={'parameters':{'s':['one','two']}})
add('raw-cookie-complete',artifact(params=[p('Cookie','header')]),input={'parameters':{'Cookie':'a=b; c=d'}},expect=expected(headers={'cookie':'a=b; c=d'}))
error_case('raw-cookie-invalid','unroutable',doc=artifact(params=[p('Cookie','header')]),input={'parameters':{'Cookie':'not-a-pair'}})
error_case('raw-cookie-structured-collision','unroutable',doc=artifact(params=[p('Cookie','header'),p('s','cookie')]),input={'parameters':{'Cookie':'a=b','s':'x'}})
add('content-query-JSON',artifact(params=[{'name':'payload','in':'query','content':{'application/json':{'schema':{}}}}]),input={'parameters':{'payload':{'x':'/&='}}},expect=expected(query=[['payload','{"x":"/&="}']]))
add('content-header-JSON',artifact(params=[{'name':'X-Json','in':'header','content':{'application/json':{'schema':{}}}}]),input={'parameters':{'X-Json':{'x':'/'}}},expect=expected(headers={'x-json':'{"x":"/"}'}))

# Media and schema inspection. A request body is explicitly supplied null here.
add('JSON-null-body',artifact('post',body=rb()),input={'body':None},binding={'target':target(method='post')},expect=expected('POST',headers={'content-type':'application/json'},body=b'null'))
for method in ('post','put','patch'):
    add('body-method-'+method,artifact(method,body=rb(required=True)),input={'body':{'a':1}},binding={'target':target(method=method)},expect=expected(method.upper(),headers={'content-type':'application/json'},body_json={'a':1}))
for method in ('get','head','delete','options','trace'):
    add('body-ignored-declaration-'+method,artifact(method,body=rb(required=True)),binding={'target':target(method=method)},expect=expected(method.upper()),native=response(b'' if method=='head' else b'{"native":true}'),result={'success':True,'values':[] if method=='head' else [{'native':True}]})
    error_case('body-forbidden-'+method,'unroutable',doc=artifact(method,body=rb()),input={'body':None},binding={'target':target(method=method)})
error_case('required-body-missing','unroutable',doc=artifact('post',body=rb(required=True)),binding={'target':target(method='post')})
multi=rb();multi['content']['text/plain']={'schema':{'type':'string'}}
error_case('media-choice-needed','missing-context',doc=artifact('post',body=multi),input={'body':'text'},binding={'target':target(method='post')})
add('media-choice-explicit',artifact('post',body=multi),input={'body':'text'},binding={'target':target(method='post')},context={'media':'text/plain'},expect=expected('POST',headers={'content-type':'text/plain'},body=b'text'))
add('media-range-explicit',artifact('post',body=rb('application/*')),input={'body':{'yes':True}},binding={'target':target(method='post')},context={'media':'application/problem+json'},expect=expected('POST',headers={'content-type':'application/problem+json'},body_json={'yes':True}))
add('binary-raw-octets',artifact('post',body=rb('application/octet-stream',{'type':'string','format':'binary'})),input={'body':'AP+A'},binding={'target':target(method='post')},expect=expected('POST',headers={'content-type':'application/octet-stream'},body=b'\x00\xff\x80'))
error_case('binary-noncanonical-pad-bits','unroutable',doc=artifact('post',body=rb('application/octet-stream',{'type':'string','format':'binary'})),input={'body':'Zh=='},binding={'target':target(method='post')})
add('byte-is-text-not-decoded',artifact('post',body=rb('text/plain',{'type':'string','format':'byte'})),input={'body':'Zg=='},binding={'target':target(method='post')},expect=expected('POST',headers={'content-type':'text/plain'},body=b'Zg=='))
add('later-contentEncoding-ignored',artifact('post',body=rb('text/plain',{'type':'string','contentEncoding':'base64'})),input={'body':'Zg=='},binding={'target':target(method='post')},expect=expected('POST',headers={'content-type':'text/plain'},body=b'Zg=='))
add('allOf-number-integer-form-inspection',artifact('post',body=rb('application/x-www-form-urlencoded',{'type':'object','properties':{'n':{'allOf':[{'type':'number'},{'type':'integer'}]}}})),input={'body':{'n':3}},binding={'target':target(method='post')},expect=expected('POST',headers={'content-type':'application/x-www-form-urlencoded'},form=[['n','3']]))
for name,schema in [('nullable-explicit',{'type':'string','nullable':True}),('anyOf-agree',{'anyOf':[{'type':'string'},{'type':'string'}]}),('oneOf-empty-branch',{'oneOf':[{'allOf':[{'type':'integer'},{'type':'string'}]},{'type':'string'}]})]:
    add('inspection-'+name,artifact('post',body=rb('text/plain',schema)),input={'body':'hello'},binding={'target':target(method='post')},expect=expected('POST',headers={'content-type':'text/plain'},body=b'hello'))
for name,schema,kind in [('type-array',{'type':['string','null']},'invalid'),('boolean',True,'invalid'),('nullable-alone',{'nullable':True},'unsupported'),('union-unrestricted',{'anyOf':[{}, {'type':'string'}]},'unsupported'),('not-no-static-type',{'not':{'type':'integer'}},'unsupported')]:
    error_case('inspection-'+name,kind,doc=artifact('post',body=rb('text/plain',schema)),input={'body':'hello'},binding={'target':target(method='post')})

# Form and multipart independent native expectations use standard MIME parser.
form_schema={'type':'object','properties':{'title':{'type':'string'},'n':{'type':'number'},'ok':{'type':'boolean'},'data':{'type':'object'},'omit':{'type':'string','nullable':True}}}
add('form-content-based',artifact('post',body=rb('application/x-www-form-urlencoded',form_schema)),input={'body':{'title':'two words','n':2.5,'ok':True,'data':{'x':1},'omit':None}},binding={'target':target(method='post')},expect=expected('POST',headers={'content-type':'application/x-www-form-urlencoded'},form=[['title','two words'],['n','2.5'],['ok','true'],['data','{"x":1}']]))
add('form-style-overrides-contentType',artifact('post',body=rb('application/x-www-form-urlencoded',{'type':'object','properties':{'tags':{'type':'array','items':{'type':'string'}}}},encoding={'tags':{'explode':True,'contentType':'application/json'}})),input={'body':{'tags':['red','blue']}},binding={'target':target(method='post')},expect=expected('POST',headers={'content-type':'application/x-www-form-urlencoded'},form=[['tags','red'],['tags','blue']]))
error_case('form-required-null','unroutable',doc=artifact('post',body=rb('application/x-www-form-urlencoded',{'type':'object','required':['s'],'properties':{'s':{'type':'string','nullable':True}}})),input={'body':{'s':None}},binding={'target':target(method='post')})
add('form-additionalProperties-route',artifact('post',body=rb('application/x-www-form-urlencoded',{'type':'object','additionalProperties':{'type':'string'}})),input={'body':{'extra':'yes'}},binding={'target':target(method='post')},expect=expected('POST',headers={'content-type':'application/x-www-form-urlencoded'},form=[['extra','yes']]))
error_case('form-patternProperties-no-route','unroutable',doc=artifact('post',body=rb('application/x-www-form-urlencoded',{'type':'object','additionalProperties':False,'patternProperties':{'.*':{'type':'string'}}})),input={'body':{'extra':'yes'}},binding={'target':target(method='post')})
error_case('form-array-item-default-not-whole-array','unsupported',doc=artifact('post',body=rb('application/x-www-form-urlencoded',{'type':'object','properties':{'tags':{'type':'array','items':{'type':'string'}}}})),input={'body':{'tags':['a','b']}},binding={'target':target(method='post')})
add('form-array-explicit-json',artifact('post',body=rb('application/x-www-form-urlencoded',{'type':'object','properties':{'tags':{'type':'array','items':{'type':'string'}}}},encoding={'tags':{'contentType':'application/json'}})),input={'body':{'tags':['a','b']}},binding={'target':target(method='post')},expect=expected('POST',headers={'content-type':'application/x-www-form-urlencoded'},form=[['tags','["a","b"]']]))
mp_schema={'type':'object','properties':{'label':{'type':'string'},'chunks':{'type':'array','items':{'type':'string','format':'binary'}},'byte':{'type':'string','format':'byte'}}}
mp_enc={'label':{'style':'deepObject','explode':False,'headers':{'X-Fixed':{'schema':{'type':'string','enum':['chosen']}},'X-Optional':{'schema':{'type':'string','default':'not-fixed'}}}},'byte':{'headers':{'Content-Transfer-Encoding':{'schema':{'type':'string','enum':['base64']}}}}}
mp_parts=[{'name':'label','body_hex':b'hello'.hex(),'headers':{'x-fixed':'chosen'},'absent_headers':['x-optional']},{'name':'chunks','body_hex':'00ff'},{'name':'chunks','body_hex':'4142'},{'name':'byte','body_hex':b'Zg=='.hex(),'headers':{'content-transfer-encoding':'base64'}}]
for subtype in ('form-data','mixed'):
    add('multipart-'+subtype,artifact('post',body=rb('multipart/'+subtype,mp_schema,encoding=mp_enc)),input={'body':{'label':'hello','chunks':['AP8=','QUI='],'byte':'Zg=='}},binding={'target':target(method='post')},expect=expected('POST',parts=mp_parts,media='multipart/'+subtype))
add('multipart-byte-no-generated-CTE',artifact('post',body=rb('multipart/form-data',{'type':'object','properties':{'byte':{'type':'string','format':'byte'}}})),input={'body':{'byte':'Zg=='}},binding={'target':target(method='post')},expect=expected('POST',parts=[{'name':'byte','body_hex':b'Zg=='.hex(),'absent_headers':['content-transfer-encoding']}],media='multipart/form-data'))
for name,hd in [('const-does-not-fix',{'schema':{'type':'string','const':'x'},'required':True}),('default-does-not-fix',{'schema':{'type':'string','default':'x'},'required':True}),('content-does-not-fix',{'content':{'text/plain':{'schema':{'type':'string','enum':['x']}}},'required':True})]:
    error_case('multipart-'+name,'unsupported',doc=artifact('post',body=rb('multipart/form-data',{'type':'object','properties':{'s':{'type':'string'}}},encoding={'s':{'headers':{'X':hd}}})),input={'body':{'s':'v'}},binding={'target':target(method='post')})
add('multipart-enum-allOf-fixed',artifact('post',body=rb('multipart/form-data',{'type':'object','properties':{'s':{'type':'string'}}},encoding={'s':{'headers':{'X':{'schema':{'allOf':[{'enum':['a','b']},{'enum':['b','c']}]}}}}})),input={'body':{'s':'v'}},binding={'target':target(method='post')},expect=expected('POST',media='multipart/form-data',parts=[{'name':'s','body_hex':'76','headers':{'x':'b'}}]))
error_case('multipart-transfer-transform-unsupported','unsupported',doc=artifact('post',body=rb('multipart/form-data',mp_schema,encoding={'byte':{'headers':{'Content-Transfer-Encoding':{'schema':{'enum':['quoted-printable']}}}}})),input={'body':{'byte':'Zg=='}},binding={'target':target(method='post')})

# Security alternatives, ownership, scope and credential grammar.
def secured(schemes,security,params=None,method='get'):
    d=artifact(method,params=params,security=security);d['components']={'securitySchemes':schemes};return d
key={'type':'apiKey','in':'query','name':'api/key'}
add('security-query-key-exact',secured({'key':key},[{'key':[]}]),context={'credentials':{'key':'a+b&c'}},expect=expected(query=[['api/key','a+b&c']]))
add('security-Basic-ASCII',secured({'b':{'type':'http','scheme':'BaSiC'}},[{'b':[]}]),context={'credentials':{'b':['user','pass']}},expect=expected(headers={'authorization':'Basic dXNlcjpwYXNz'}))
for typ in ('bearer','oauth2','openIdConnect'):
    scheme={'type':'http','scheme':'bearer'} if typ=='bearer' else {'type':typ,'flows':{}} if typ=='oauth2' else {'type':typ,'openIdConnectUrl':'https://identity.invalid'}
    add('security-'+typ,secured({'auth':scheme},[{'auth':['exact:scope']}]),context={'credentials':{'auth':'abc-._~+/=='}},expect=expected(headers={'authorization':'Bearer abc-._~+/=='}))
error_case('security-missing-credential','missing-context',doc=secured({'key':key},[{'key':[]}]))
error_case('security-OR-choice','missing-context',doc=secured({'key':key},[{}, {'key':[]}]))
add('security-anonymous-explicit',secured({'key':key},[{}, {'key':[]}]),context={'security_index':0})
error_case('security-AND-incomplete','missing-context',doc=secured({'one':key,'two':{'type':'apiKey','in':'header','name':'X-Key'}},[{'one':[],'two':[]}]),context={'credentials':{'one':'a'}})
add('security-invalid-sibling-preserves-anonymous',secured({'mtls':{'type':'mutualTLS'}},[{'mtls':[]},{}]))
error_case('security-owned-header','unsupported',doc=secured({'key':{'type':'apiKey','in':'header','name':'Content-Encoding'}},[{'key':[]}]),context={'credentials':{'key':'gzip'}})
add('security-optional-collision-omitted',secured({'key':{'type':'apiKey','in':'header','name':'X-Key'}},[{'key':[]}],params=[p('x-key','header')]),context={'credentials':{'key':'secret'}},expect=expected(headers={'x-key':'secret'}))
error_case('security-optional-collision-supplied','unroutable',doc=secured({'key':{'type':'apiKey','in':'header','name':'X-Key'}},[{'key':[]}],params=[p('x-key','header')]),input={'parameters':{'x-key':'caller'}},context={'credentials':{'key':'secret'}})
error_case('security-cookie-no-invented-escaping','unroutable',doc=secured({'key':{'type':'apiKey','in':'cookie','name':'k'}},[{'key':[]}]),context={'credentials':{'key':'a b'}})
add('security-negotiation-owner-runtime-omitted',secured({'key':{'type':'apiKey','in':'header','name':'Accept'}},[{'key':[]}]),context={'credentials':{'key':'secret'}},expect=expected(headers={'accept':'secret'}))
error_case('security-negotiation-collision','unroutable',doc=secured({'key':{'type':'apiKey','in':'header','name':'Accept'}},[{'key':[]}]),context={'credentials':{'key':'secret'},'negotiation':{'accept':'application/json'}})
error_case('TRACE-sensitive-security','unroutable',doc=secured({'key':key},[{'key':[]}],method='trace'),binding={'target':target(method='trace')},context={'credentials':{'key':'secret'}})

# Native response fixtures authored independently of the representation encoder.
add('response-JSON-duplicate-last-BOM',native=response(b'\xef\xbb\xbf{"x":1,"x":2}'),result={'success':True,'values':[{'x':2}]})
add('response-JSON-safe-large-integer',native=response(b'9007199254740991'),result={'success':True,'values':[9007199254740991]})
add('response-null-is-value',native=response(b'null'),result={'success':True,'values':[None]})
add('response-empty-is-no-value',native=response(b''),result={'success':True,'values':[]})
add('response-unpaired-surrogate-fails',native=response(b'"\\ud800"'),result={'success':False,'values':[]})
add('response-truncated-unary',native={**response(b'{"x":'), 'truncated':True},result={'success':False,'values':[]})
add('response-failure-no-output',native=response(b'{"error":"bad"}',400),binding={'target':target(),'output':{'literal':'would-leak'}},result={'success':False,'values':[]})
add('response-invalid-failure-diagnostics',native=response(b'not JSON',500),result={'success':False,'values':[]})
add('response-101-upgrade',native=response(b'',101),result={'success':False,'values':[]})
add('response-redirect-not-followed',native=response(b'',307,[['Location','/elsewhere']]),result={'success':False,'values':[]})
add('response-text-event-stream-one-value',artifact(resp=rr('text/event-stream',{'type':'string'})),native=response(b'data: one\n\ndata: two\n\n',headers=[['Content-Type','text/event-stream']]),result={'success':True,'values':['data: one\n\ndata: two\n\n']})
add('response-default-octet-stream',artifact(resp=rr('application/octet-stream',{})),native=response(b'\x00\xff',headers=[]),result={'success':True,'values':['AP8=']})
add('response-byte-text',artifact(resp=rr('application/octet-stream',{'type':'string','format':'byte'})),native=response(b'Zg==',headers=[['Content-Type','application/octet-stream']]),result={'success':True,'values':['Zg==']})
add('response-form-object-unsupported',artifact(resp=rr('application/x-www-form-urlencoded',{'type':'object'})),native=response(b'a=b',headers=[['Content-Type','application/x-www-form-urlencoded']]),result={'success':False,'values':[]})
xml='<?xml version="1.0" encoding="UTF-16"?><v>é</v>'
add('response-XML-BOM-precedes-MIME',artifact(resp=rr('application/xml',{'type':'string'})),native=response(xml.encode('utf-16'),headers=[['Content-Type','application/xml; charset=utf-8']]),result={'success':True,'values':[xml]})
add('response-XML-entity-unexpanded',artifact(resp=rr('application/xml',{'type':'string'})),native=response(b'<!DOCTYPE x [<!ENTITY a "text">]><x>&a;</x>',headers=[['Content-Type','application/xml']]),result={'success':True,'values':['<!DOCTYPE x [<!ENTITY a "text">]><x>&a;</x>']})
add('request-XML-preserves-declaration',artifact('post',body=rb('application/xml',{'type':'string'})),input={'body':xml},binding={'target':target(method='post')},expect=expected('POST',headers={'content-type':'application/xml'},xml_text=xml))
add('response-media-specificity',artifact(resp={'200':{'description':'ok','content':{'*/*':{},'application/*':{},'application/json':{'schema':{}}}}}),native=response(b'{"chosen":"json"}'),result={'success':True,'values':[{'chosen':'json'}]})
add('response-media-normalized-duplicate',artifact(resp={'200':{'description':'ok','content':{'application/json':{},'APPLICATION/JSON':{}}}}),result={'success':False,'values':[]})
add('response-media-charset-case',artifact(resp=rr('text/plain; charset=UTF-8',{'type':'string'})),native=response('café'.encode(),headers=[['Content-Type','Text/Plain; charset="utf-8"']]),result={'success':True,'values':['café']})
add('response-media-parameter-value-exact',artifact(resp=rr('application/json; profile=A')),native=response(b'{}',headers=[['Content-Type','application/json; profile=a']]),result={'success':False,'values':[]})
add('response-multiple-content-type',native=response(b'{}',headers=[['Content-Type','application/json'],['Content-Type','text/plain']]),result={'success':False,'values':[]})
add('response-exact-invalid-no-range-fallback',artifact(resp={'200':None,'2XX':{'description':'ok','content':{'application/json':{}}}}),result={'success':False,'values':[]})
add('response-range-before-default',artifact(resp={'2XX':{'description':'ok','content':{'application/json':{}}},'default':{'description':'fallback','content':{'text/plain':{'schema':{'type':'string'}}}}}))
for name,responses in [('absent',None),('empty',{}),('extension-only',{'x-note':'none'})]:
    d=artifact();op=d['paths']['/check']['get']
    if name=='absent':del op['responses']
    else:op['responses']=responses
    error_case('response-required-'+name,'unsupported',doc=d)
add('response-required-header-missing',artifact(resp=rr(headers={'X-Required':{'required':True,'schema':{'type':'string'}}})),result={'success':False,'values':[]})
add('response-required-header-case',artifact(resp=rr(headers={'X-Required':{'required':True,'schema':{'type':'integer'}}})),native=response(headers=[['Content-Type','application/json'],['x-required','not-deserialized']]))
add('response-content-type-required-ignored',artifact(resp={'204':{'description':'none','headers':{'Content-Type':{'required':True}}}}),native=response(b'',204,[]),result={'success':True,'values':[]})
add('response-gzip-stack',artifact(resp=rr(headers={'Content-Encoding':{'required':True,'schema':{'allOf':[{'enum':['gzip, gzip','br']},{'enum':['gzip, gzip']}]}}})),native=response(gzip.compress(gzip.compress(b'{"coded":true}',mtime=0),mtime=0),headers=[['Content-Type','application/json'],['Content-Encoding','gzip'],['Content-Encoding','gzip']]),result={'success':True,'values':[{'coded':True}]})
add('response-gzip-invalid',native=response(b'not gzip',headers=[['Content-Type','application/json'],['Content-Encoding','gzip']]),result={'success':False,'values':[]})
add('response-no-content-no-codec-needed',artifact(resp={'204':{'description':'none','headers':{'Content-Encoding':{'schema':{'enum':['unknown']}}}}}),native=response(b'',204,[['Content-Encoding','unknown']]),result={'success':True,'values':[]})
add('request-gzip-content-coding',artifact('post',params=[p('Content-Encoding','header')],body=rb()),input={'parameters':{'Content-Encoding':'gzip'},'body':{'zip':True}},binding={'target':target(method='post')},expect=expected('POST',headers={'content-type':'application/json','content-encoding':'gzip'},gzip_json={'zip':True}))
error_case('request-content-coding-no-body','unroutable',doc=artifact(params=[p('Content-Encoding','header')]),input={'parameters':{'Content-Encoding':'gzip'}})

# Synthesis fixture chooses a real contract and maps native names. No invocation
# encoder is involved in generator construction, and expected requests are literal.
def synthesize_subset():
    native=artifact('post','/things/{thingId}',params=[p('thingId','path',required=True)],body=rb('application/json',{'type':'object','properties':{'label':{'type':'string'}},'required':['label']}),resp=rr('application/json',{'type':'object','properties':{'accepted':{'type':'boolean'}}}))
    out=obi(native,{'target':target('/things/{thingId}','post'),'input':{'object':{'parameters':{'object':{'thingId':{'at':'/id'}}},'body':{'object':{'label':{'at':'/name'}}}}},'output':{'at':'/accepted'}})
    out['operations']={'perform':{'description':'Store the named thing','input':{'type':'object','properties':{'id':{'type':'string'},'name':{'type':'string'}},'required':['id','name'],'additionalProperties':False},'output':{'type':'boolean'}}}
    return out
c=add('generated-current-core-OBI',input={'id':'a/b','name':'native label'},expect=expected('POST',path='/api/things/a%2Fb',headers={'content-type':'application/json'},body_json={'label':'native label'}),native=response(b'{"accepted":true}'),result={'success':True,'values':[True]},origin='generated subset',authority='§11/core§5–6');c['obi']=synthesize_subset()

# Focused additional bridge checks following the first successful native run.
remote={'item':{'get':{'security':[{'key':[]}],'responses':rr()}},'components':{'securitySchemes':{'key':{'type':'apiKey','in':'header','name':'X-Remote-Key'}}}}
d=artifact(path='/mounted');d['components']={'securitySchemes':{'key':{'type':'apiKey','in':'header','name':'X-Entry-Key'}}};d['paths']['/mounted']={'$ref':'parts.json#/item'}
for scope,header in [('entry','x-entry-key'),('referring','x-remote-key')]:
    add('security-external-scope-'+scope,d,source={'document':d,'location':ORIGIN+'/artifacts/entry'},binding={'target':target('/mounted')},resources={'/artifacts/parts.json':{'body':json.dumps(remote).encode()}},context={'security_scope':scope,'credentials':{'key':'native-secret'}},expect=expected(path='/api/mounted',headers={header:'native-secret'}))
uri_key='https://keys.invalid/component'
add('security-URI-looking-component-literal',secured({uri_key:{'type':'apiKey','in':'header','name':'X-Key'}},[{uri_key:[]}]),context={'credentials':{uri_key:'literal-secret'}},expect=expected(headers={'x-key':'literal-secret'}))
error_case('multipart-supplied-null-needs-media-choice','missing-context',doc=artifact('post',body=rb('multipart/form-data',{'type':'object','properties':{'optional':{'type':'string','nullable':True},'s':{'type':'string'}}},encoding={'optional':{'contentType':'text/*'}})),input={'body':{'optional':None,'s':'v'}},binding={'target':target(method='post')},expect=expected('POST',media='multipart/form-data',parts=[{'name':'s','body_hex':'76'}]))
error_case('multipart-case-alias-domain-conflict','unsupported',doc=artifact('post',body=rb('multipart/form-data',{'type':'object','properties':{'s':{'type':'string'}}},encoding={'s':{'headers':{'X-Enum':{'schema':{'enum':['fixed']}},'x-enum':{'schema':{'enum':['other','else']}}}}})),input={'body':{'s':'v'}},binding={'target':target(method='post')})
error_case('multipart-byte-nonfixed-domain-rejects-base64','unsupported',doc=artifact('post',body=rb('multipart/form-data',{'type':'object','properties':{'b':{'type':'string','format':'byte'}}},encoding={'b':{'headers':{'Content-Transfer-Encoding':{'schema':{'enum':['identity','quoted-printable']}}}}})),input={'body':{'b':'Zg=='}},binding={'target':target(method='post')})
add('form-unused-impossible-property',artifact('post',body=rb('application/x-www-form-urlencoded',{'type':'object','properties':{'impossible':{'allOf':[{'type':'string'},{'type':'integer'}]},'s':{'type':'string'}}})),input={'body':{'s':'v'}},binding={'target':target(method='post')},expect=expected('POST',headers={'content-type':'application/x-www-form-urlencoded'},form=[['s','v']]))
error_case('form-used-impossible-property','unroutable',doc=artifact('post',body=rb('application/x-www-form-urlencoded',{'type':'object','properties':{'impossible':{'allOf':[{'type':'string'},{'type':'integer'}]}}})),input={'body':{'impossible':'v'}},binding={'target':target(method='post')})
add('multipart-safe-boundary-replacement',artifact('post',body=rb('multipart/form-data; boundary=declared',{'type':'object','properties':{'s':{'type':'string'}}})),input={'body':{'s':'v'}},binding={'target':target(method='post')},context={'boundary':'different-safe-boundary'},expect=expected('POST',media='multipart/form-data',parts=[{'name':'s','body_hex':'76'}]))
add('response-equal-specificity-ambiguity',artifact(resp={'200':{'description':'ok','content':{'application/json; a=1':{},'application/json; b=2':{}}}}),native=response(b'{}',headers=[['Content-Type','application/json; a=1; b=2']]),result={'success':False,'values':[]})
add('response-normalized-duplicate-clean-sibling',artifact(resp={'200':{'description':'ok','content':{'application/json':{},'APPLICATION/JSON':{},'text/plain':{'schema':{'type':'string'}}}}}),native=response(b'clean',headers=[['Content-Type','text/plain']]),result={'success':True,'values':['clean']})
add('response-XML-UTF8-equivalent',artifact(resp=rr('application/xml',{'type':'string'})),native=response(b'\xef\xbb\xbf<x>native</x>',headers=[['Content-Type','application/xml']]),result={'success':True,'values':['<x>native</x>']})
add('response-XML-UTF16-equivalent',artifact(resp=rr('application/xml',{'type':'string'})),native=response('<x>native</x>'.encode('utf-16'),headers=[['Content-Type','application/xml']]),result={'success':True,'values':['<x>native</x>']})

# Redirect following is an explicit runtime policy, preserving body and method.
# The second native request has independently authored expectations.
for cross in (False,True):
    sec={'auth':{'type':'http','scheme':'bearer'},'header':{'type':'apiKey','in':'header','name':'X-Api'},'query':{'type':'apiKey','in':'query','name':'secret'}}
    d=secured(sec,[{'auth':[],'header':[],'query':[]}],params=[p('session','cookie')],method='post');d['paths']['/check']['post']['requestBody']=rb()
    c=add('redirect-'+('cross-origin-strips' if cross else 'same-origin-preserves'),d,input={'parameters':{'session':'cookie'},'body':{'sent':1}},binding={'target':target(method='post')},context={'follow_redirect':True,'credentials':{'auth':'token','header':'key','query':'qsecret'}},expect=expected('POST',query=[['secret','qsecret']],headers={'authorization':'Bearer token','x-api':'key','cookie':'session=cookie','content-type':'application/json'},body_json={'sent':1}))
    dest=('http://localhost:__PORT__' if cross else ORIGIN)+'/redirected?destination=yes'
    c['responses_sequence']=[response(b'',307,[['Location',dest]]),response()]
    c['expected_followup']=expected('POST',path='/redirected',query=[['destination','yes']],headers={'content-type':'application/json',**({} if cross else {'authorization':'Bearer token','x-api':'key','cookie':'session=cookie'})},absent_headers=['authorization','x-api','cookie'] if cross else [],body_json={'sent':1})
add('security-required-fixed-collision-keeps-clean-alternative',secured({'k':{'type':'apiKey','in':'header','name':'X-Key'}},[{'k':[]},{}],params=[p('x-key','header',required=True)]),input={'parameters':{'x-key':'caller'}},expect=expected(headers={'x-key':'caller'}))
add('security-required-query-collision-keeps-clean-alternative',secured({'k':{'type':'apiKey','in':'query','name':'q'}},[{'k':[]},{}],params=[p('q',required=True)]),input={'parameters':{'q':'caller'}},expect=expected(query=[['q','caller']]))
d=artifact(path='/mounted');d['paths']['/mounted']={'$ref':'parts.json#/item','parameters':[p('q')]}
remote={'item':{'parameters':[p('q',schema={'type':'integer'})],'get':{'parameters':[p('q')],'responses':rr()}}}
add('Path-Item-parameter-collision-overridden',d,source={'document':d,'location':ORIGIN+'/artifacts/entry'},binding={'target':target('/mounted')},resources={'/artifacts/parts.json':{'body':json.dumps(remote).encode()}},input={'parameters':{'q':'operation'}},expect=expected(path='/api/mounted',query=[['q','operation']]))
add('inspection-oneOf-null-only-branch',artifact('post',body=rb('text/plain',{'oneOf':[{'allOf':[{'type':'string','nullable':True},{'type':'integer','nullable':True}]},{'type':'string'}]})),input={'body':'hello'},binding={'target':target(method='post')},expect=expected('POST',headers={'content-type':'text/plain'},body=b'hello'))
add('request-annotations-do-not-rewrite-JSON',artifact('post',body=rb('application/json',{'type':'object','properties':{'readonly':{'type':'string','readOnly':True},'defaulted':{'type':'string','default':'not-inserted'}}})),input={'body':{'readonly':'preserved'}},binding={'target':target(method='post')},expect=expected('POST',headers={'content-type':'application/json'},body_json={'readonly':'preserved'}))

# The callback generator is intentionally a bounded subset translation. It keeps
# two distinct consumption points and emits no kind constraint or receiver.
d=artifact('post',body=rb('application/json',{'type':'object'}))
callback_path={'post':{'requestBody':rb('application/json',{'type':'object','properties':{'event':{'type':'string'}},'required':['event']}),'responses':{'200':{'description':'ack','content':{'application/json':{'schema':{'type':'boolean'}}}}}}}
d['paths']['/check']['post']['callbacks']={'first':{'{$request.body#/first}':copy.deepcopy(callback_path)},'second':{'{$request.body#/second}':copy.deepcopy(callback_path)}}
c=add('generated-callback-dependencies',d,input={'body':{'first':'https://receiver.invalid/a','second':'https://receiver.invalid/b'}},binding={'target':target(method='post')},expect=expected('POST',headers={'content-type':'application/json'},body_json={'first':'https://receiver.invalid/a','second':'https://receiver.invalid/b'}),origin='generated callbacks subset',authority='§11/core§5.5')
c['obi']['operations']['receive']={'description':'Consume a service event and acknowledge it','input':{'type':'object','properties':{'event':{'type':'string'}},'required':['event']},'output':{'type':'boolean'}}
c['obi']['dependencies']={'first-event':{'operation':'receive'},'second-event':{'operation':'receive'}}
error_case('callback-not-parent-target','invalid',doc=d,binding={'target':'/paths/~1check/post/callbacks/first'})
add('response-decimal-capability-no-substitution',native=response(b'0.10000000000000001'),result={'success':False,'values':[]})

# Follow-up maintenance by a new agent, derived from public r3 §2 before reading
# this existing interpreter. Original r2 source/results preserved in archive-r2.
# Expectations below use only authored physical URLs/native paths, never resolver helpers.
for form in ('location-only','embedded-object','embedded-text'):
    for label,fragment in [('pointer','/nested'),('name','anchor'),('encoded','%2Fnested')]:
        location=ORIGIN+'/fragment/no-fetch#'+fragment
        source={'location':location}
        if form!='location-only':source['document']=artifact() if form=='embedded-object' else json.dumps(artifact())
        c=error_case('source-fragment-'+form+'-'+label,'invalid',source=source,origin='maintained-r3-fragment-boundary',authority='public r3 §2')
        c['expected_fetch_urls']=[];c['expected_artifact_paths']=[];c['expected_resource_urls']=[]

fragment_doc=artifact(path='/mounted')
fragment_doc['servers']=[{'url':'../../wrong-entry-base'}]
fragment_doc['paths']['/mounted']={'$ref':'parts/item.json#/item'}
fragment_part={'item':{'get':{'servers':[{'url':'../../native-physical'}],'responses':rr()}}}
for form in ('location-only','embedded-object','embedded-text'):
    source={'location':ORIGIN+'/fragment/physical/entry.json#'}
    resources={'/fragment/physical/parts/item.json':{'body':json.dumps(fragment_part).encode()}}
    fetched=[];paths=[]
    if form=='location-only':resources['/fragment/physical/entry.json']={'body':json.dumps(fragment_doc).encode()};fetched.append(ORIGIN+'/fragment/physical/entry.json');paths.append('/fragment/physical/entry.json')
    else:source['document']=copy.deepcopy(fragment_doc) if form=='embedded-object' else json.dumps(fragment_doc)
    fetched.append(ORIGIN+'/fragment/physical/parts/item.json');paths.append('/fragment/physical/parts/item.json')
    c=add('source-empty-fragment-'+form+'-physical-reference',fragment_doc,source=source,binding={'target':target('/mounted')},resources=resources,expect=expected(path='/fragment/native-physical/mounted'),origin='maintained-r3-fragment-boundary',authority='public r3 §2/§3/§5')
    c['expected_fetch_urls']=fetched;c['expected_artifact_paths']=paths;c['expected_resource_urls']=[ORIGIN+'/fragment/physical/entry.json',ORIGIN+'/fragment/physical/parts/item.json']

redirect_doc=artifact();redirect_doc['servers']=[{'url':'../physical-native'}]
c=add('source-empty-fragment-redirect-final-base',source={'location':ORIGIN+'/fragment/start#'},resources={'/fragment/start':{'status':302,'headers':[['Location','/fragment/final/entry.json']]},'/fragment/final/entry.json':{'body':json.dumps(redirect_doc).encode()}},expect=expected(path='/fragment/physical-native/check'),origin='maintained-r3-fragment-boundary',authority='public r3 §2/§5')
c['expected_fetch_urls']=[ORIGIN+'/fragment/start'];c['expected_artifact_paths']=['/fragment/start','/fragment/final/entry.json'];c['expected_resource_urls']=[ORIGIN+'/fragment/final/entry.json']
for label,location,resource_path,expected_api in [('encoded-path',ORIGIN+'/fragment/data%23root/entry#','/fragment/data%23root/entry','/fragment/native/check'),('encoded-query',ORIGIN+'/fragment/entry?marker=%23#','/fragment/entry','/native/check')]:
    doc=artifact();doc['servers']=[{'url':'../native'}]
    c=add('source-empty-fragment-'+label,source={'location':location},resources={resource_path:{'body':json.dumps(doc).encode()}},expect=expected(path=expected_api),origin='maintained-r3-fragment-boundary',authority='public r3 §2/RFC3986')
    c['expected_fetch_urls']=[location[:-1]];c['expected_artifact_paths']=[resource_path+('?marker=%23' if label=='encoded-query' else '')];c['expected_resource_urls']=[location[:-1]]

# Public r4 content-null cases, independently authored native octets/form values.
def r4_null_form(name,mt,prop,value,required=False,encoding=None,expected_values=None,error=None,context=None,expected_part_media='application/json'):
    schema={'type':'object','properties':{'value':prop,'keep':{'type':'string'}}}
    if required:schema['required']=['value']
    d=artifact('post',body=rb(mt,schema,encoding={'value':encoding} if encoding is not None else None))
    kwargs={'input':{'body':{'value':value,'keep':'v'}},'binding':{'target':target(method='post')},'context':context,'origin':'maintained-r4-content-null','authority':'public r4 §8/§8.1'}
    if error:return error_case('r4-'+name,error,doc=d,**kwargs)
    if mt=='application/x-www-form-urlencoded':
        ex=expected('POST',form=([['value',x] for x in expected_values] if expected_values else [])+[['keep','v']])
    else:
        ex=expected('POST',media=mt,parts=([{'name':'value','body_hex':x.encode().hex(),'headers':{'content-type':expected_part_media}} for x in expected_values] if expected_values else [])+[{'name':'keep','body_hex':'76'}])
    return add('r4-'+name,d,expect=ex,**kwargs)

for mt,label in [('application/x-www-form-urlencoded','urlencoded'),('multipart/form-data','multipart-formdata'),('multipart/mixed','multipart-mixed')]:
    for required in (False,True):
        for mode,prop,encoding in [('explicit-json',{'type':'string','nullable':True},{'contentType':'application/json'}),('default-json',{'type':'object','nullable':True},None)]:
            r4_null_form(label+'-'+mode+'-null-'+str(required),mt,prop,None,required,encoding,['null'])
    for mode,encoding in [('explicit-json',{'contentType':'application/json'}),('default-json',None)]:
        prop={'type':'array','nullable':True,'items':{'type':'object','nullable':True}}
        r4_null_form(label+'-'+mode+'-whole-array-property-null',mt,prop,None,True,encoding,['null'])
        r4_null_form(label+'-'+mode+'-preserve-array-null-items',mt,prop,[None,{'x':1},None],False,encoding,['[null,{"x":1},null]'] if label=='urlencoded' else ['null','{"x":1}','null'])
    r4_null_form(label+'-json-suffix-null',mt,{'type':'string','nullable':True},None,True,{'contentType':'application/example+json'},['null'],expected_part_media='application/example+json')
    r4_null_form(label+'-text-null-optional-omitted',mt,{'type':'string','nullable':True},None,False,None,[])
    r4_null_form(label+'-text-null-required-refused',mt,{'type':'string','nullable':True},None,True,None,error='unroutable')
    if label!='urlencoded':
        r4_null_form(label+'-text-array-null-item-refused',mt,{'type':'array','items':{'type':'string','nullable':True}},[None,'after'],False,None,error='unroutable')
    for required in (False,True):
        r4_null_form(label+'-raw-null-'+str(required),mt,{'type':'string','format':'binary','nullable':True},None,required,{'contentType':'application/octet-stream'},[],error='unroutable' if required else None)

# Style rules are unchanged: URL-encoded explicit controls beat contentType;
# OAS 3.0 multipart ignores those same controls and remains content based.
r4_null_form('urlencoded-style-null-undefined-not-json', 'application/x-www-form-urlencoded',{'type':'string','nullable':True},None,True,{'style':'form','contentType':'application/json'},[''])
for mt in ('multipart/form-data','multipart/mixed'):
    r4_null_form(mt.replace('/','-')+'-style-ignored-json-null',mt,{'type':'string','nullable':True},None,True,{'style':'form','contentType':'application/json'},['null'])
for typename in ('number','boolean'):
    r4_null_form('text-'+typename+'-null-optional-no-invented-spelling','application/x-www-form-urlencoded',{'type':typename,'nullable':True},None,False,None,[])
    r4_null_form('text-'+typename+'-null-required-refused','application/x-www-form-urlencoded',{'type':typename,'nullable':True},None,True,None,error='unroutable')
r4_null_form('supplied-null-media-context-json','multipart/form-data',{'type':'string','nullable':True},None,True,{'contentType':'application/json, text/plain'},['null'],context={'property_media':{'value':'application/json'}})
r4_null_form('supplied-null-media-context-text-omitted','multipart/form-data',{'type':'string','nullable':True},None,False,{'contentType':'application/json, text/plain'},[],context={'property_media':{'value':'text/plain'}})
r4_null_form('supplied-null-media-choice-missing','multipart/form-data',{'type':'string','nullable':True},None,False,{'contentType':'application/json, text/plain'},error='missing-context')
d=artifact('post',body=rb('multipart/form-data',{'type':'object','properties':{'absent':{'type':'string'},'keep':{'type':'string'}}},encoding={'absent':{'contentType':'*/*'}}))
add('r4-absent-property-needs-no-media-choice',d,input={'body':{'keep':'v'}},binding={'target':target(method='post')},expect=expected('POST',media='multipart/form-data',parts=[{'name':'keep','body_hex':'76'}]),origin='maintained-r4-content-null',authority='public r4 §8.1')
error_case('r4-null-entire-form-body-not-object','unroutable',doc=d,input={'body':None},binding={'target':target(method='post')},origin='maintained-r4-content-null',authority='public r4 §8.1')
