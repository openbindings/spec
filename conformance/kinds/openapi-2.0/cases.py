"""Hand-authored probe cases and native expectations; imports no interpreter helpers.
Factories only reduce source duplication; runner saves each complete expanded OBI.
"""
import base64, codecs, copy, gzip, json, zlib
from synthesize import synthesize

C=[]
def blob(b): return base64.b64encode(b).decode()
def reply(body=b'{"ok":true}',status=200,ctype='application/json',**kw):
    return {'status':status,'headers':{} if ctype is None else {'Content-Type':ctype},'body_b64':blob(body),**kw}
def artifact(value): return {'body_b64':blob(json.dumps(value).encode()),'headers':{'Content-Type':'application/json'}}
def document(path='/invoke',method='post',parameters=None,schema=None):
    return {'swagger':'2.0','info':{'title':'Independent native fixture','version':'1'},'schemes':['http'],'host':'127.0.0.1:PORT','basePath':'/api','consumes':['application/json'],'produces':['application/json'],'paths':{path:{method:{'parameters':parameters or [],'responses':{'200':{'description':'Complete unary value','schema':schema if schema is not None else {'type':'object'}}}}}}}
def par(name,loc,typ='string',**kw): return {'name':name,'in':loc,'type':typ,**kw}
def bodypar(schema=None,required=True): return {'name':'documentation-only','in':'body','required':required,'schema':schema if schema is not None else {'type':'object'}}
def native(path='/api/invoke',method='POST',**kw): return {'path':path,'method':method,**kw}
def add(name,doc=None,caller='__ABSENT__',expect=None,result=None,context=None,source=None,binding=None,resp=None,artifacts=None,category=None,acquisitions=None,origin='hand-authored',obi=None):
    if doc is None: doc=document()
    if binding is None:
        p=next(iter(doc['paths'])); m=next(k for k in doc['paths'][p] if k in {'get','post','put','patch','delete','head','options'})
        binding={'target':'/paths/'+p.replace('~','~0').replace('/','~1')+'/'+m}
    if obi is None:
        input_schema=False if caller=='__ABSENT__' else {'const':caller}
        values=[{'ok':True}] if result is None and category is None else ([] if result is None else result)
        output_schema={'const':values[0]} if len(values)==1 else False
        obi={'openbindings':'0.2.0','name':'Independent '+name,'operations':{'invoke':{'input':input_schema,'output':output_schema}},'sources':{'oas':{'kind':'openbindings.openapi-2.0@1','content':source if source is not None else {'document':doc}}},'bindings':{'invoke.http':{'operation':'invoke','source':'oas','content':binding}}}
    out={'name':name,'origin':origin,'obi':obi,'caller':caller,'context':context or {},'native':expect if expect is not None else ([] if category else [native()]),'result':{'completion':'failure' if category else 'success','values':[] if category else ([{'ok':True}] if result is None else result)},'response':resp or reply(),'artifacts':artifacts or {}}
    if category: out['result']['category']=category
    if acquisitions is not None: out['acquisitions']=acquisitions
    C.append(out); return out

def build():
    C.clear()
    # Every accepted source member combination, both embedded text grammars.
    d=document()
    yaml='''swagger: "2.0"
info: {title: Fresh, version: "1"}
schemes: [http]
host: "127.0.0.1:PORT"
basePath: /api
produces: [application/json]
paths:
  /invoke:
    post:
      responses:
        200:
          description: yes
          schema: {type: object}
'''
    for mode,embedded in [('object',d),('json',json.dumps(d)),('yaml',yaml)]:
        add('source-'+mode,source={'document':embedded},acquisitions=[])
        add('source-'+mode+'-and-location',source={'document':embedded,'location':'http://127.0.0.1:PORT/not-fetched.json'},acquisitions=[])
    add('source-location',source={'location':'http://127.0.0.1:PORT/docs/entry.json'},artifacts={'/docs/entry.json':artifact(d)},acquisitions=['/docs/entry.json'])
    add('source-retrieved-yaml-utf16',source={'location':'http://127.0.0.1:PORT/docs/utf16'},artifacts={'/docs/utf16':{'body_b64':blob(yaml.encode('utf-16'))}},acquisitions=['/docs/utf16'])
    implicit=copy.deepcopy(d); implicit.pop('host'); implicit.pop('schemes')
    add('source-redirect-final-base',source={'location':'http://127.0.0.1:PORT/start'},artifacts={'/start':{'status':302,'headers':{'Location':'/final/entry'},'body_b64':''},'/final/entry':artifact(implicit)},acquisitions=['/start','/final/entry'])
    for name,value in [('empty',{}),('null',None),('array',[]),('unknown',{'document':d,'extra':1}),('wrong-document',{'document':1}),('relative-location',{'location':'api.json'})]:
        case=add('source-invalid-'+name,category='invalid'); case['obi']['sources']['oas']['content']=value
    case=add('source-absent',category='invalid'); del case['obi']['sources']['oas']['content']
    for name,text in [('duplicate','swagger: "2.0"\nswagger: "2.0"'),('non-scalar','? [a,b]\n: 2'),('multi','swagger: "2.0"\n---\nswagger: "2.0"'),('nonfinite','swagger: "2.0"\nx: .nan'),('tag','swagger: !!int "2.0"'),('entry-array','[]')]:
        add('source-parse-'+name,source={'document':text},category='invalid')
    wrong=copy.deepcopy(d); wrong['swagger']=2.0; add('source-wrong-edition',doc=wrong,category='invalid')
    add('source-acquisition-404-is-unavailable',source={'location':'http://127.0.0.1:PORT/missing'},artifacts={'/missing':{'status':404,**artifact(d)}},category='unavailable')
    add('source-policy-denied-is-unavailable',source={'location':'https://denied.invalid/a'},category='unavailable')
    case=add('exact-kind-spelling',category='unsupported'); case['obi']['sources']['oas']['kind']='openbindings.openapi-2.0@01'
    for name,target in [('hash-prefix','#/paths/~1invoke/post'),('bad-escape','/paths/~2invoke/post'),('wrong-method','/paths/~1invoke/trace'),('missing-operation','/paths/~1invoke/get')]:
        add('target-'+name,binding={'target':target},category='no-target' if name=='missing-operation' else 'invalid')
    pct=document('/literal%2Fsegment'); add('target-pointer-no-percent-decoding',doc=pct,expect=[native('/api/literal%2Fsegment')])
    tilde=document('/~1'); add('target-pointer-single-tilde-decode',doc=tilde,expect=[native('/api/~1')])
    odd=document('/a//b'); odd['basePath']='/api//'; add('url-preserves-repeated-slashes',doc=odd,expect=[native('/api//a//b')])
    add('context-server-replaces-root',context={'server':'http://127.0.0.1:PORT/replacement/'},expect=[native('/replacement/invoke')])
    for base in ['http://u@127.0.0.1:PORT/x','http://127.0.0.1:PORT/x?q=1','http://127.0.0.1:PORT/x#f']:
        add('context-invalid-server-'+str(len(C)),context={'server':base},category='unsupported')
    multi=copy.deepcopy(d); multi['schemes']=['http','https']; add('context-multiple-schemes',doc=multi,category='missing-context'); add('context-scheme-selected',doc=multi,context={'scheme':'http'})
    no=copy.deepcopy(d); no['schemes']=[]; add('context-empty-scheme',doc=no,category='missing-context'); add('context-empty-scheme-replacement',doc=no,context={'server':'http://127.0.0.1:PORT/api'})
    badpath=document('/x?y'); add('url-literal-query-boundary',doc=badpath,category='unsupported')
    # Mapping lexical scope, absence, shape, failure and output cardinality.
    maps={'target':'/paths/~1invoke/post','input':'($root := $; {"body": {"groups": ($exists($lookup($root, "groups")) ? ($count($lookup($root, "groups")) = 0 ? [] : $map($lookup($root, "groups"), function($item1) { ($exists($lookup($item1, "items")) ? ($count($lookup($item1, "items")) = 0 ? [] : $map($lookup($item1, "items"), function($item2) { {"item": $item2, "group": $lookup($item1, "id"), "root": $lookup($root, "root"), "literal": null, "absent": $lookup($item2, "missing")} })[])) })[]))}})','output':'{"answer": $lookup($, "ok"), "fixed": ["x", null]}'}
    request={'root':'ROOT','groups':[{'id':'g1','items':['a','b']},{'id':'g2','items':[]}]}
    nativebody={'groups':[[{'item':'a','group':'g1','root':'ROOT','literal':None},{'item':'b','group':'g1','root':'ROOT','literal':None}],[]]}
    add('jsonata-nested-lexical-scope',doc=document(parameters=[bodypar()]),caller=request,binding=maps,expect=[native(body_kind='json',body=nativebody)],result=[{'answer':True,'fixed':['x',None]}])
    add('jsonata-absent-input',binding={'target':'/paths/~1invoke/post','input':'$'})
    add('mapping-array-missing-prevents-dispatch',binding={'target':'/paths/~1invoke/post','input':'($assert($exists(missing)); [missing])'},category='mapping-failure')
    add('jsonata-author-array-assertion',caller={'x':1},binding={'target':'/paths/~1invoke/post','input':'($assert($type(x) = "array"); ($exists(x) ? ($count(x) = 0 ? [] : $map(x, function($v){$v})[])))'},category='mapping-failure')
    add('jsonata-rejects-legacy-object',binding={'target':'/paths/~1invoke/post','input':{'at':'','up':1}},category='invalid')
    add('mapping-output-absence',binding={'target':'/paths/~1invoke/post','output':'$lookup($, "missing")'},result=[])
    add('mapping-output-null',binding={'target':'/paths/~1invoke/post','output':'null'},result=[None])
    add('mapping-output-failure',binding={'target':'/paths/~1invoke/post','output':'($assert($exists(missing)); [missing])'},expect=[native()],category='mapping-failure')
    # References: schema/parameter/response replacement, contextual closure and mounts.
    selfdoc=document(parameters=[{'$ref':'#/parameters/P','required':False}]); selfdoc['parameters']={'P':par('q','query',required=True)}
    add('reference-parameter-siblings-ignored',doc=selfdoc,caller={'parameters':{'q':'a/b?'}},expect=[native(query={'q':['a/b?']})])
    add('reference-parameter-required-not-overridden',doc=selfdoc,category='unsupported')
    ext={'post':{'parameters':[bodypar({'$ref':'schema.json#/S','readOnly':False})],'responses':{'200':{'$ref':'responses.json#/ok','schema':False}}}}
    root=document('/slot'); root['paths']['/slot']={'$ref':'foreign/item.json#/item'}; root['basePath']='/mount'; root['securityDefinitions']={'Key':{'type':'apiKey','in':'header','name':'X-Root-Key'}}; root['security']=[{'Key':[]}]
    arts={'/foreign/item.json':artifact({'item':ext,'host':'wrong.invalid','securityDefinitions':{'Key':{'type':'basic'}}}),'/foreign/schema.json':artifact({'S':{'type':'object','properties':{'keep':{'type':'string'}}},'unrelated':False}),'/foreign/responses.json':artifact({'ok':{'schema':{'type':'object'}},'other':{'schema':False}})}
    mountbinding={'target':'/paths/~1slot/post'}
    add('reference-mounted-provenance-inheritance',doc=root,source={'document':root,'location':'http://127.0.0.1:PORT/entry.json'},binding=mountbinding,caller={'body':{'keep':'yes'}},context={'credentials':{'Key':'root-secret'}},artifacts=arts,expect=[native('/mount/slot',headers={'x-root-key':'root-secret'},body_kind='json',body={'keep':'yes'})],acquisitions=['/foreign/item.json','/foreign/schema.json','/foreign/responses.json'])
    add('reference-relative-no-obi-base',doc=root,binding=mountbinding,category='missing-context')
    local=copy.deepcopy(root); local['paths']['/slot']['post']={'responses':{'200':{'schema':{'type':'object'}}}}
    add('reference-path-item-used-collision',doc=local,source={'document':local,'location':'http://127.0.0.1:PORT/entry.json'},binding=mountbinding,artifacts=arts,category='unsupported')
    unused=copy.deepcopy(root); unused['paths']['/slot']['get']={'broken':True}
    add('reference-path-item-unused-adjacency',doc=unused,source={'document':unused,'location':'http://127.0.0.1:PORT/entry.json'},binding=mountbinding,caller={'body':{}},context={'credentials':{'Key':'root-secret'}},artifacts=arts,expect=[native('/mount/slot',headers={'x-root-key':'root-secret'},body_kind='json',body={})])
    add('reference-missing-item-local-cannot-replace',doc=local,source={'document':local,'location':'http://127.0.0.1:PORT/entry.json'},binding=mountbinding,artifacts={'/foreign/item.json':{'status':404,'body_b64':''}},category='unavailable')
    # Finite schema declaration inspection and deep readOnly duties.
    for name,schema,body in [
        ('property',{'type':'object','properties':{'secret':{'type':'string','readOnly':True}}},{'secret':'x'}),
        ('nested-array',{'type':'array','items':{'type':'object','properties':{'secret':{'type':'string','readOnly':True}}}},[{'secret':'x'}]),
        ('additional',{'type':'object','additionalProperties':{'type':'object','properties':{'secret':{'readOnly':True}}}},{'any':{'secret':1}}),
        ('allof-cross-required',{'allOf':[{'required':['s']},{'properties':{'s':{'readOnly':True}}}]},{}),
        ('empty-intersection',{'allOf':[{'type':'string'},{'type':'object'}]},'x')]:
        add('schema-readonly-'+name,doc=document(parameters=[bodypar(schema)]),caller={'body':body},category='unsupported')
    optional={'type':'object','properties':{'nested':{'required':['s'],'properties':{'s':{'readOnly':True}}}}}
    add('schema-readonly-absent-optional-enclosing',doc=document(parameters=[bodypar(optional)]),caller={'body':{}},expect=[native(body_kind='json',body={})])
    recursive=document(parameters=[bodypar({'$ref':'#/definitions/N'})]); recursive['definitions']={'N':{'type':'object','properties':{'child':{'$ref':'#/definitions/N'},'value':{'type':'string'}}}}
    add('schema-consuming-reference-cycle',doc=recursive,caller={'body':{'child':{'value':'leaf'}}},expect=[native(body_kind='json',body={'child':{'value':'leaf'}})])
    ignored={'type':'object','properties':{'keep':{'type':'string'}},'oneOf':[False],'nullable':False,'id':'https://ignored.invalid/x'}
    add('schema-closed-vocabulary-unknown-no-behavior',doc=document(parameters=[bodypar(ignored)]),caller={'body':{'keep':'yes'}},expect=[native(body_kind='json',body={'keep':'yes'})])
    for name,schema in [('typeless',{}),('union',{'type':['string','object']}),('boolean',True)]:
        td=document(parameters=[bodypar(schema)]); td['consumes']=['text/plain']; add('schema-character-'+name,doc=td,caller={'body':'text'},category='invalid' if name=='boolean' else 'unsupported')
    td=document(parameters=[bodypar({'allOf':[{'type':['string','null']},{'type':'string'}]})]); td['consumes']=['text/plain']; add('schema-allof-character-string',doc=td,caller={'body':'héllo'},expect=[native(body_b64='aMOpbGxv')])
    # Parameters, locations, overrides, collection formats and envelope routing.
    pd=document('/p/{id}/{id}',parameters=[par('id','path',required=True),par('id','query'),par('tags','query','array',items={'type':'string'},collectionFormat='multi'),par('X-Note','header')])
    add('parameter-qualified-names-path-utf8',doc=pd,caller={'parameters':{'path/id':'a/b?#','query/id':'q &+','query/tags':['first','sécond'],'header/X-Note':'café'}},expect=[native('/api/p/a%2Fb%3F%23/a%2Fb%3F%23',query={'id':['q &+'],'tags':['first','sécond']},headers={'x-note':'café'})])
    for fmt,expected in [('csv','a,b'),('ssv','a b'),('tsv','a\tb'),('pipes','a|b'),('multi',None)]:
        pd=document(parameters=[par('a','query','array',items={'type':'string'},collectionFormat=fmt)])
        add('parameter-collection-'+fmt,doc=pd,caller={'parameters':{'a':['a','b']}},expect=[native(query={'a':['a','b'] if fmt=='multi' else [expected]})])
    for val in ('',[]):
        pd=document(parameters=[par('a','query','array' if isinstance(val,list) else 'string',items={'type':'string'},allowEmptyValue=True)])
        add('parameter-empty-allowed-'+str(type(val).__name__),doc=pd,caller={'parameters':{'a':val}},expect=[native(query={'a':['']})]); pd=copy.deepcopy(pd); pd['paths']['/invoke']['post']['parameters'][0].pop('allowEmptyValue'); add('parameter-empty-refused-'+str(type(val).__name__),doc=pd,caller={'parameters':{'a':val}},category='unsupported')
    pd=document(parameters=[par('a','query','array',items={'type':'string'})]); add('parameter-whole-null-array-conversion',doc=pd,caller={'parameters':{'a':None}},context={'scalar':'json'},expect=[native(query={'a':['null']})]); add('parameter-scalar-context-missing',doc=pd,caller={'parameters':{'a':None}},category='missing-context')
    add('parameter-delimiter-ambiguous',doc=pd,caller={'parameters':{'a':['a,b','c']}},category='unsupported')
    nested=document(parameters=[par('a','query','array',items={'type':'array','items':{'type':'string'}})]); add('parameter-omitted-unsupported-shape',doc=nested); add('parameter-supplied-nested-array',doc=nested,caller={'parameters':{'a':[['x']]}},category='unsupported')
    for name,params,caller in [
        ('unknown-key',[],{'parameters':{'bad':1}}),('envelope-null',[],None),('unknown-envelope',[],{'q':'x'}),('body-undeclared',[],{'body':None}),
        ('header-case-collision',[par('X-Foo','header'),par('x-foo','header')],{'parameters':{'X-Foo':'a','x-foo':'b'}}),
        ('header-control',[par('X-Foo','header')],{'parameters':{'X-Foo':'a\r\nb'}}),('header-boundary-space',[par('X-Foo','header')],{'parameters':{'X-Foo':' a'}}),
        ('cookie-incomplete',[par('Cookie','header')],{'parameters':{'Cookie':'x'}}),('owned-header-required',[par('Host','header',required=True)],{}),
        ('body-and-form',[bodypar(),par('x','formData')],{}),('two-body',[bodypar(),{'name':'second','in':'body','schema':{}}],{})]:
        add('parameter-negative-'+name,doc=document(parameters=params),caller=caller,category='unsupported')
    dup=document(parameters=[par('q','query'),par('q','query')]); add('parameter-duplicate-identity',doc=dup,category='invalid')
    over=document(parameters=[par('q','query',required=True)]); over['paths']['/invoke']['parameters']=[par('q','query','array',items={'type':'string'})]; add('parameter-operation-overrides-path',doc=over,caller={'parameters':{'q':'simple'}},expect=[native(query={'q':['simple']})])
    owned=document(parameters=[par('Host','header'),par('q','query',default='insert-me')]); add('parameter-optional-unavailable-default-omitted',doc=owned,expect=[native(absent_headers=['content-type'])])
    head=document(parameters=[par('Authorization','header'),par('Accept','header'),par('Cookie','header')]); add('parameter-ordinary-auth-accept-cookie',doc=head,caller={'parameters':{'Authorization':'Custom exact','Accept':'text/plain','Cookie':'a=1; b=two'}},context={'accept':'application/json'},expect=[native(headers={'authorization':'Custom exact','accept':'text/plain','cookie':'a=1; b=two'})])
    # FormData and body media, Base64/file and coding.
    form=document(parameters=[par('label','formData'),par('tags','formData','array',items={'type':'string'},collectionFormat='multi'),par('empty','formData',allowEmptyValue=True)]); form['consumes']=['application/x-www-form-urlencoded']
    add('form-urlencoded-preserves-newline-space-plus',doc=form,caller={'parameters':{'label':'a b+\n','tags':['one','two'],'empty':''}},expect=[native(body_kind='form',body={'label':['a b+\n'],'tags':['one','two'],'empty':['']})])
    add('form-optional-omitted-no-entity',doc=form,expect=[native(absent_headers=['content-type'])])
    mp=copy.deepcopy(form); mp['consumes']=['multipart/form-data; boundary=declared']; mp['paths']['/invoke']['post']['parameters'].append(par('upload','formData','file'))
    mpbody={'label':[{'octets':'aMOp','type':'text/plain','charset':'utf-8'}],'tags':[{'octets':'eA==','type':'text/plain','charset':'utf-8'},{'octets':'eQ==','type':'text/plain','charset':'utf-8'}],'empty':[{'octets':'','type':'text/plain','charset':'utf-8'}],'upload':[{'octets':'AP9B','type':'application/octet-stream','charset':None}]}
    add('form-multipart-file-exact-octets',doc=mp,caller={'parameters':{'label':'hé','tags':['x','y'],'empty':'','upload':'AP9B'}},expect=[native(body_kind='multipart',body=mpbody)])
    fp=document(parameters=[par('f','formData','file')]); fp['consumes']=['application/x-www-form-urlencoded']; add('form-file-urlencoded-unavailable',doc=fp,caller={'parameters':{'f':'AA=='}},category='unsupported')
    raw=document(parameters=[bodypar({'type':'string','format':'binary'})]); raw['consumes']=['application/octet-stream']; add('body-binary-base64',doc=raw,caller={'body':'AP8='},expect=[native(body_b64='AP8=')]); add('body-binary-noncanonical-padbits',doc=raw,caller={'body':'AB=='},category='unsupported')
    byte=document(parameters=[bodypar({'type':'string','format':'byte'})]); byte['consumes']=['text/plain']; add('body-byte-format-retains-base64-text',doc=byte,caller={'body':'AP8='},expect=[native(body_b64='QVA4PQ==')])
    jd=document(parameters=[bodypar({'type':'string','format':'binary'})]); add('body-json-overrides-binary-format',doc=jd,caller={'body':'AP8='},expect=[native(body_kind='json',body='AP8=')])
    for method in ['get','delete','head','options','patch','put']:
        payload=document(method=method,parameters=[bodypar()]); add('body-http-method-'+method,doc=payload,caller={'body':{'keep':True}},expect=[native(method=method.upper(),body_kind='json',body={'keep':True})],result=[] if method=='head' else None)
    emptyconsume=document(parameters=[bodypar()]); emptyconsume['paths']['/invoke']['post']['consumes']=[]; add('media-operation-empty-clears-root',doc=emptyconsume,caller={'body':{}},category='unsupported')
    choices=document(parameters=[bodypar({'type':'string'})]); choices['consumes']=['application/json','text/plain']; add('media-multiple-needs-context',doc=choices,caller={'body':'x'},category='missing-context'); add('media-context-choice',doc=choices,caller={'body':'x'},context={'media':'text/plain'},expect=[native(body_b64='eA==')])
    ranged=document(parameters=[bodypar({'type':'string'})]); ranged['consumes']=['text/*; charset=UTF-8']; add('media-range-context',doc=ranged,caller={'body':'hé'},context={'media':'text/plain; charset=utf-8'},expect=[native(body_b64='aMOp')]); add('media-parameter-mismatch',doc=ranged,caller={'body':'hé'},context={'media':'text/plain; charset=us-ascii'},category='unsupported')
    duplicates=document(parameters=[bodypar()]); duplicates['consumes']=['application/json','Application/JSON','text/plain']; add('media-normalized-duplicates-one-alternative',doc=duplicates,caller={'body':{}},context={'media':'application/json'},expect=[native(body_kind='json',body={})])
    coded=document(parameters=[bodypar(),par('Content-Encoding','header')]); add('coding-request-stack',doc=coded,caller={'body':{'keep':'value'},'parameters':{'Content-Encoding':'gzip, deflate'}},expect=[native(body_kind='json',body={'keep':'value'},headers={'content-encoding':'gzip, deflate'})]); add('coding-request-unknown',doc=coded,caller={'body':{},'parameters':{'Content-Encoding':'unknown'}},category='unsupported')
    nob=document(parameters=[par('Content-Encoding','header')]); add('coding-body-free-refused',doc=nob,caller={'parameters':{'Content-Encoding':'gzip'}},category='unsupported')
    # Security OR/AND, entry-root names, credential ownership and missing context.
    secure=document(); secure['securityDefinitions']={'B':{'type':'basic'},'Q':{'type':'apiKey','in':'query','name':'token'},'O':{'type':'oauth2','flow':'password','tokenUrl':'http://example.invalid/token','scopes':{'read':'Read'}}}
    secure['security']=[{'B':[],'Q':[]}]
    add('security-basic-and-query-key',doc=secure,context={'credentials':{'B':['user','pass'],'Q':'a &b'}},expect=[native(headers={'authorization':'Basic dXNlcjpwYXNz'},query={'token':['a &b']})])
    add('security-missing-credentials',doc=secure,category='missing-context')
    oauth=copy.deepcopy(secure); oauth['security']=[{'O':['read']}]; add('security-oauth-bearer',doc=oauth,context={'credentials':{'O':'ab._~+/9=='}},expect=[native(headers={'authorization':'Bearer ab._~+/9=='})]); add('security-oauth-invalid-token',doc=oauth,context={'credentials':{'O':'bad token'}},category='unsupported')
    alternatives=copy.deepcopy(secure); alternatives['security']=[{'B':[]},{}]; add('security-multiple-needs-choice',doc=alternatives,category='missing-context'); add('security-anonymous-choice',doc=alternatives,context={'security':1})
    malformed=copy.deepcopy(secure); malformed['securityDefinitions']['Bad']={'type':'apiKey','in':'cookie','name':'x'}; malformed['security']=[{'Bad':[]},{}]; add('security-malformed-sibling-survives',doc=malformed)
    collision=copy.deepcopy(secure); collision['security']=[{'Q':[]}]; collision['paths']['/invoke']['post']['parameters']=[par('token','query')]
    add('security-optional-collision-omitted',doc=collision,context={'credentials':{'Q':'credential'}},expect=[native(query={'token':['credential']})]); add('security-optional-collision-supplied',doc=collision,caller={'parameters':{'token':'parameter'}},context={'credentials':{'Q':'credential'}},category='unsupported')
    cleared=copy.deepcopy(secure); cleared['paths']['/invoke']['post']['security']=[]; add('security-operation-empty-clears-root',doc=cleared)
    owned=copy.deepcopy(secure); owned['securityDefinitions']={'Q':{'type':'apiKey','in':'header','name':'Content-Encoding'}}; owned['security']=[{'Q':[]}]; add('security-owned-destination',doc=owned,context={'credentials':{'Q':'gzip'}},category='unsupported')
    # Complete unary native responses and independent decoded expectations.
    add('response-json-null',resp=reply(b'null'),result=[None])
    add('response-json-empty-array-one-value',resp=reply(b'[]'),result=[[]])
    add('response-json-bom-last-duplicate',resp=reply(codecs.BOM_UTF8+b'{"x":0,"x":1}'),result=[{'x':1}])
    add('response-json-large-integer-preserved',resp=reply(b'9007199254740991'),result=[9007199254740991])
    add('response-json-unpaired-surrogate',resp=reply(b'"\\ud800"'),expect=[native()],category='unsupported')
    add('response-empty-no-value',resp=reply(b''),result=[])
    no_content=document(); no_content['paths']['/invoke']['post']['responses']={'204':{'description':'none','headers':{'Content-Encoding':{'type':'string','enum':['unknown']}}}}
    plan=reply(b'',204,None); plan['headers']['Content-Encoding']='unknown'; add('response-204-no-decoder',doc=no_content,resp=plan,result=[])
    hd=document(method='head'); plan=reply(b'ignored'); plan['headers']['Content-Encoding']='unknown'; add('response-head-no-decoder',doc=hd,resp=plan,expect=[native(method='HEAD')],result=[])
    default=document(); default['paths']['/invoke']['post']['responses']={'default':{'schema':{'type':'object'}}}; add('response-default-only-2xx',doc=default)
    specific=copy.deepcopy(default); specific['paths']['/invoke']['post']['responses']['200']={}; add('response-defective-exact-no-fallback',doc=specific,expect=[native()],category='decode-failure')
    invalidkey=document(); invalidkey['paths']['/invoke']['post']['responses']['2XX']={'schema':False}; add('response-invalid-range-clean-sibling',doc=invalidkey)
    add('response-non2xx-no-output-no-output-mapping',resp=reply(b'not-json',422),binding={'target':'/paths/~1invoke/post','output':'{"would": "leak"}'},expect=[native()],category='http-failure')
    add('response-truncated-no-partial',resp=reply(b'{"ok":true}',truncate=9),expect=[native()],category='decode-failure')
    add('response-interim-then-final',resp=reply(interim=True))
    add('response-101-refused',resp=reply(b'',101,None),expect=[native()],category='unsupported')
    add('response-malformed-json',resp=reply(b'{bad'),expect=[native()],category='decode-failure')
    add('response-unmatched-media',resp=reply(b'hello',ctype='text/plain'),expect=[native()],category='unsupported')
    many=reply(); many['headers']['Content-Type']=['application/json','text/plain']; add('response-multiple-content-types',resp=many,expect=[native()],category='decode-failure')
    rawresp=document(schema={}); rawresp['produces']=['application/octet-stream']; add('response-missing-type-raw',doc=rawresp,resp=reply(b'\x00\xffA',ctype=None),result=['AP9B'])
    filedoc=document(schema={'type':'file'}); filedoc['produces']=['application/json']; add('response-root-file-overrides-json',doc=filedoc,resp=reply(b'not-json'),result=['bm90LWpzb24='])
    textdoc=document(schema={'type':'string'}); textdoc['produces']=['text/event-stream']; add('response-event-stream-whole-string',doc=textdoc,resp=reply(b'data: one\n\ndata: two\n\n',ctype='text/event-stream'),result=['data: one\n\ndata: two\n\n'])
    xml=document(schema={'allOf':[{'type':['string','null']},{'type':'string'}]}); xml['produces']=['application/xml']; add('response-xml-bom-precedence',doc=xml,resp=reply('<x>é</x>'.encode('utf-16'),ctype='application/xml; charset=utf-8'),result=['<x>é</x>'])
    codingdoc=document(); codingdoc['paths']['/invoke']['post']['responses']['200']['headers']={'Content-Encoding':{'type':'string','enum':['gzip, deflate']},'content-encoding':{'type':'string','enum':['gzip, deflate','gzip']}}
    plan=reply(zlib.compress(gzip.compress(b'{"ok":true}',mtime=0))); plan['headers']['Content-Encoding']=['gzip','deflate']; add('response-coding-stack-inline-enum',doc=codingdoc,resp=plan)
    badcode=reply(); badcode['headers']['Content-Encoding']='weird'; add('response-unknown-coding',resp=badcode,expect=[native()],category='unsupported')
    mismatch=reply(gzip.compress(b'{"ok":true}',mtime=0)); mismatch['headers']['Content-Encoding']='gzip'; add('response-coding-enum-intersection',doc=codingdoc,resp=mismatch,expect=[native()],category='decode-failure')
    # Redirects: preserve body, do not follow rewriting, cross-origin secrecy.
    redirect=document(parameters=[bodypar()]); add('redirect-307-preserves-body',doc=redirect,caller={'body':{'keep':'yes'}},context={'follow':True},resp=reply(b'',307,None),expect=[native(body_kind='json',body={'keep':'yes'}),native('/next',body_kind='json',body={'keep':'yes'})]); C[-1]['response']['headers']['Location']='/next'; C[-1]['redirect_response']=reply()
    add('redirect-rewriting-302-stops-interaction',resp={'status':302,'headers':{'Location':'/next'},'body_b64':''},context={'follow':True},expect=[native()],category='http-failure')
    secrets=copy.deepcopy(secure); secrets['security']=[{'B':[],'Q':[]}]; secrets['paths']['/invoke']['post']['parameters']=[par('Cookie','header')]
    add('redirect-cross-origin-strips-secret-headers-no-query-reappend',doc=secrets,caller={'parameters':{'Cookie':'a=1'}},context={'follow':True,'credentials':{'B':['user','pass'],'Q':'secret'}},resp={'status':307,'headers':{'Location':'http://127.0.0.1:OTHERPORT/destination?plain=1'},'body_b64':''},expect=[native(headers={'authorization':'Basic dXNlcjpwYXNz','cookie':'a=1'},query={'token':['secret']}),native('/destination',query={'plain':['1']},absent_headers=['authorization','cookie'])]); C[-1]['other_response']=reply()
    # Five deliberately narrow synthesized complete current-core OBIs, expectations authored independently.
    synths=[('string',{'type':'string'},'native-text'),('integer',{'type':'integer'},12),('boolean',{'type':'boolean'},True),('array',{'type':'array','items':{'type':'string'}},['a','b']),('object',{'type':'object','properties':{'keep':{'type':'string'}},'required':['keep'],'additionalProperties':False},{'keep':'yes'})]
    for name,schema,value in synths:
        source=document(parameters=[bodypar(schema)],schema=schema); obi=synthesize(source)
        add('synthesis-'+name,doc=source,obi=obi,caller={'body':value},expect=[native(body_kind='json',body=value)],resp=reply(json.dumps(value).encode()),result=[value],origin='synthesized')
        C[-1]['expected_operation']={'input':{'type':'object','properties':{'body':copy.deepcopy(schema)},'required':['body'],'additionalProperties':False},'output':copy.deepcopy(schema)}
    # Public r2 changed source-fragment and media-list semantics.
    add('source-nonempty-location-fragment',source={'location':'http://127.0.0.1:PORT/doc#/nested'},category='invalid')
    add('source-embedded-nonempty-location-fragment',source={'document':document(),'location':'http://127.0.0.1:PORT/doc#/nested'},category='invalid')
    add('source-empty-fragment-removed',source={'location':'http://127.0.0.1:PORT/doc#'},artifacts={'/doc':artifact(document())},acquisitions=['/doc'])
    repeated=document(parameters=[bodypar()]); repeated['consumes']=['application/json','APPLICATION/JSON']
    add('media-duplicates-auto-select-one',doc=repeated,caller={'body':{}},expect=[native(body_kind='json',body={})])
    overlap=document(); overlap['produces']=['application/*','application/json','APPLICATION/JSON','*/*']
    add('media-overlapping-matches-one-correspondence',doc=overlap)
    add('response-204-forbidden-actual-content',doc=no_content,resp=reply(b'illegal',204,None),expect=[native()],category='decode-failure')
    add('source-wrong-location-type',source={'document':document(),'location':None},category='invalid')
    add('numeric-response-insufficient-precision-capability',resp=reply(b'1.0000000000000001'),expect=[native()],category='unsupported')
    add('numeric-response-exponent-preserved',resp=reply(b'1.25e2'),result=[125.0])
    add('cancellation-before-dispatch',context={'cancel_before':True},category='cancelled')
    add('local-abandonment-after-native-response',context={'abandon_after_response':True},expect=[native()],category='cancelled')
    static=document(parameters=[par('token','query',required=True)]); static['securityDefinitions']={'Q':{'type':'apiKey','in':'query','name':'token'}}; static['security']=[{'Q':[]},{}]
    add('security-required-collision-clean-anonymous-sibling',doc=static,caller={'parameters':{'token':'parameter'}},expect=[native(query={'token':['parameter']})])
    numeric=document(parameters=[par('n','query','number'),par('b','header','boolean')])
    add('parameter-number-boolean-context',doc=numeric,caller={'parameters':{'n':1.5,'b':True}},context={'scalar':'json'},expect=[native(query={'n':['1.5']},headers={'b':'true'})])
    stringrefs=document(parameters=[bodypar({'$ref':'#/definitions/S','readOnly':True})]); stringrefs['definitions']={'S':{'type':'object','properties':{'keep':{'type':'string'}}}}
    add('schema-reference-sibling-readonly-ignored',doc=stringrefs,caller={'body':{'keep':'yes'}},expect=[native(body_kind='json',body={'keep':'yes'})])
    mpascii=copy.deepcopy(mp); ascii_parts=copy.deepcopy(mpbody); ascii_parts['label'][0]['octets']='aGk='
    add('form-multipart-ascii-for-default-variation',doc=mpascii,caller={'parameters':{'label':'hi','tags':['x','y'],'empty':'','upload':'AP9B'}},expect=[native(body_kind='multipart',body=ascii_parts)])
    add('synthesis-readonly-response-does-not-affect-input',doc=document(schema={'type':'object','properties':{'ok':{'type':'boolean','readOnly':True}}}))
    return copy.deepcopy(C)
