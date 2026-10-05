"""Independent bounded interpretation, written from the frozen candidate.

Not a production SDK, schema validator, or whole-kind support claim. Each failure
carries a distinction useful to this probe; these are not prescribed diagnostics.
"""
import base64, codecs, gzip, http.client, json, math, re, subprocess, urllib.parse
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

KIND = 'openbindings.openapi-3.0@1'
ABSENT = object()
ALL = frozenset(('null','boolean','string','integer','number','array','object'))
TOKEN = re.compile(r"^[!#$%&'*+.^_`|~0-9A-Za-z-]+$")
OWNED = set('host content-length connection keep-alive proxy-authorization proxy-connection te trailer transfer-encoding upgrade'.split())
CRED_OWNED = OWNED | {'content-type','content-encoding'}

class Cannot(Exception):
    def __init__(self, kind, message):
        self.kind, self.message = kind, message
        super().__init__(kind + ': ' + message)
def fail(kind, msg): raise Cannot(kind,msg)
def check(ok, kind, msg):
    if not ok: fail(kind,msg)
def escape(s): return s.replace('~','~0').replace('/','~1')
def pointer_tokens(p):
    check(isinstance(p,str) and (p == '' or p.startswith('/')) and not re.search(r'~(?![01])',p), 'invalid','pointer')
    return [] if not p else [x.replace('~1','/').replace('~0','~') for x in p[1:].split('/')]
def pointer(v,p):
    for k in pointer_tokens(p):
        if isinstance(v,dict): v=v.get(k,ABSENT)
        elif isinstance(v,list) and re.fullmatch(r'0|[1-9][0-9]*',k) and int(k)<len(v): v=v[int(k)]
        else: return ABSENT
    return v

def validate_mapping(m, depth=0):
    check(isinstance(m,dict),'invalid','mapping object')
    ks=set(m)
    if 'at' in m:
        check(ks <= {'at','up'},'invalid','at members'); pointer_tokens(m['at'])
        n=m.get('up',0); check(type(n) is int and 0<=n<=depth,'invalid','up scope')
    elif ks=={'literal'}: return
    elif ks=={'object'}:
        check(isinstance(m['object'],dict),'invalid','object mapping')
        for x in m['object'].values(): validate_mapping(x,depth)
    elif ks=={'array'}:
        check(isinstance(m['array'],list),'invalid','array mapping')
        for x in m['array']: validate_mapping(x,depth)
    elif ks=={'each'}:
        check(isinstance(m['each'],dict) and set(m['each'])=={'in','value'},'invalid','each members')
        validate_mapping(m['each']['in'],depth); validate_mapping(m['each']['value'],depth+1)
    else: fail('invalid','mapping form')
def mapping(m,v,scopes=()):
    if 'at' in m: return pointer(((v,)+scopes)[m.get('up',0)],m['at'])
    if 'literal' in m: return m['literal']
    if 'object' in m: return {k:x for k,a in m['object'].items() if (x:=mapping(a,v,scopes)) is not ABSENT}
    if 'array' in m:
        a=[mapping(x,v,scopes) for x in m['array']]; check(all(x is not ABSENT for x in a),'mapping','absent array element'); return a
    a=mapping(m['each']['in'],v,scopes)
    if a is ABSENT:return ABSENT
    check(isinstance(a,list),'mapping','nonarray each')
    out=[mapping(m['each']['value'],x,(v,)+scopes) for x in a]
    check(all(x is not ABSENT for x in out),'mapping','absent each item'); return out

def text_bytes(b):
    for bom,codec in ((codecs.BOM_UTF32_BE,'utf-32'),(codecs.BOM_UTF32_LE,'utf-32'),(codecs.BOM_UTF16_BE,'utf-16'),(codecs.BOM_UTF16_LE,'utf-16'),(codecs.BOM_UTF8,'utf-8-sig')):
        if b.startswith(bom):return b.decode(codec)
    if b[:4]==b'\x00\x00\x00{':return b.decode('utf-32-be')
    if b[:4]==b'{\x00\x00\x00':return b.decode('utf-32-le')
    if len(b)>1 and b[0]==0:return b.decode('utf-16-be')
    if len(b)>1 and b[1]==0:return b.decode('utf-16-le')
    return b.decode('utf-8')
def parse_artifact(value):
    if isinstance(value,dict):return value
    check(isinstance(value,(str,bytes)),'invalid','artifact must be object or text')
    try:
        s=text_bytes(value) if isinstance(value,bytes) else value.lstrip('\ufeff')
        p=subprocess.run(['ruby',str(Path(__file__).with_name('yaml_ast.rb'))],input=s,text=True,capture_output=True)
        check(p.returncode==0,'invalid','YAML syntax')
        ast=json.loads(p.stdout); check(len(ast['children'])==1,'invalid','one YAML document')
        anchors={}
        def scalar(n,key=False):
            t=n['value']; tag=n['tag']; short=(tag or '').replace('tag:yaml.org,2002:','')
            check(short in ('','str','int','float','bool','null'),'invalid','explicit scalar tag')
            if key: return t
            if short=='str' or n['quoted'] and not short:return t
            if t in ('','~','null','Null','NULL'):v=None
            elif t in ('true','True','TRUE'):v=True
            elif t in ('false','False','FALSE'):v=False
            elif re.fullmatch(r'[-+]?0o[0-7]+',t):v=int(t.replace('0o',''),8)
            elif re.fullmatch(r'[-+]?0x[0-9a-fA-F]+',t):v=int(t,16)
            elif re.fullmatch(r'[-+]?[0-9]+',t):v=int(t,10)
            elif re.fullmatch(r'[-+]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?',t):v=exact_float(t)
            else:v=t
            check(t.lower() not in ('.inf','+.inf','-.inf','.nan'),'invalid','non-JSON number')
            expected={'str':str,'int':int,'float':(int,float),'bool':bool,'null':type(None)}
            if short: check(isinstance(v,expected[short]) and not(short in ('int','float') and isinstance(v,bool)),'invalid','incompatible explicit tag')
            return v
        def build(n):
            kind=n['node']
            if kind=='Alias':
                check(n['anchor'] in anchors,'unsupported','forward/cyclic YAML alias');return anchors[n['anchor']]
            if kind=='Scalar':v=scalar(n)
            elif kind=='Sequence':
                check(n['tag'] in (None,'tag:yaml.org,2002:seq'),'invalid','sequence tag');v=[build(x) for x in n['children']]
            elif kind=='Mapping':
                check(n['tag'] in (None,'tag:yaml.org,2002:map'),'invalid','mapping tag');v={}
                c=n['children']
                for a,b in zip(c[::2],c[1::2]):
                    check(a['node']=='Scalar','invalid','nonscalar key');k=scalar(a,True)
                    check(k not in v,'invalid','duplicate artifact key');v[k]=build(b)
            elif kind=='Document':
                check(len(n['children'])==1,'invalid','empty document');return build(n['children'][0])
            else:fail('invalid','AST node')
            if n['anchor']:anchors[n['anchor']]=v
            return v
        out=build(ast['children'][0]);check(isinstance(out,dict),'invalid','object artifact');return out
    except (UnicodeError,ValueError) as e:fail('invalid',str(e))

class Resources:
    def __init__(self,fetch):self.fetch,self.docs,self.origins=fetch,{},{}
    def mark(self,v,url):
        if isinstance(v,(dict,list)):
            self.origins[id(v)]=url
            for x in (v.values() if isinstance(v,dict) else v):self.mark(x,url)
    def source(self,c):
        check(isinstance(c,dict) and bool(c) and set(c)<={'document','location'},'invalid','source members')
        loc=c.get('location','')
        if 'location' in c:check(isinstance(loc,str) and bool(urllib.parse.urlsplit(loc).scheme),'invalid','absolute location')
        if 'document' in c: d=parse_artifact(c['document'])
        else:
            raw,loc=self.fetch(loc);d=parse_artifact(raw)
        self.docs[loc]=d;self.mark(d,loc)
        check(d.get('openapi') in ['3.0.'+str(i) for i in range(5)],'invalid','edition')
        return d
    def ref(self,n):
        visited=set()
        while isinstance(n,dict) and '$ref' in n:
            base=self.origins.get(id(n),'');ref=n['$ref'];check(isinstance(ref,str),'invalid','ref type')
            check(bool(base) or ref.startswith('#'),'missing-context','reference base')
            url=urllib.parse.urljoin(base,ref);docurl,frag=urllib.parse.urldefrag(url)
            key=(docurl,frag);check(key not in visited,'unsupported','nonproductive ref cycle');visited.add(key)
            if docurl not in self.docs:
                raw,final=self.fetch(docurl);self.docs[docurl]=parse_artifact(raw);self.mark(self.docs[docurl],final)
            n=pointer(self.docs[docurl],urllib.parse.unquote(frag))
            check(n is not ABSENT,'unavailable','reference target')
        return n
    def base(self,n):return self.origins.get(id(n),'')

def inspect_schema(s,r):
    s=r.ref(s);check(isinstance(s,dict),'invalid','Schema Object required')
    typ=s.get('type');check(typ is None or isinstance(typ,str) and typ in ALL-{'null'},'invalid','OAS type')
    cats=ALL if typ is None else frozenset(('integer','number') if typ=='number' else (typ,))
    if typ and s.get('nullable') is True:cats=cats|{'null'}
    result={k:v for k,v in s.items() if k in ('format','properties','items','additionalProperties','required')}
    enums=[set(v for v in s['enum'] if isinstance(v,str))] if 'enum' in s else []
    for a in s.get('allOf',[]):
        c,m,e=inspect_schema(a,r);cats=cats&c;enums+=e
        for k,v in m.items():
            if k=='properties':
                p=result.setdefault(k,{})
                p=dict(p);result[k]=p
                for name,decl in v.items():p[name]={'allOf':[p[name],decl]} if name in p else decl
            elif k=='required':result[k]=list(set(result.get(k,[]))|set(v))
            elif k in result and result[k]!=v:fail('unsupported','conflicting inspected declaration '+k)
            else:result[k]=v
    for union in ('anyOf','oneOf'):
        if union in s:
            branches=[]
            for a in s[union]:
                c,m,e=inspect_schema(a,r);c=c&cats
                if c-{'null'}:branches.append((c,m,e))
            check(bool(branches),'unsupported','empty inspected union')
            first=branches[0]
            check(all((c-{'null'},m)==(first[0]-{'null'},first[1]) for c,m,e in branches),'unsupported','ambiguous inspected union')
            cats=cats&frozenset().union(*(c for c,_,_ in branches));result.update(first[1])
    return cats,result,enums

def sole_type(s,r):
    c,m,e=inspect_schema(s,r); c=c-{'null'}
    if c=={'number','integer'}:return 'number',m
    return (next(iter(c)) if len(c)==1 else None),m

def media(s):
    check(isinstance(s,str),'invalid','media string')
    # Bounded RFC media parser: token and quoted-string parameters, no comments.
    pieces=re.split(r';(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)',s)
    typ=pieces[0].strip().lower();check(re.fullmatch(r'[\w!#$&^.+*-]+/[\w!#$&^.+*-]+',typ),'unsupported','media grammar')
    params={}
    for x in pieces[1:]:
        check('=' in x,'unsupported','media parameter');k,v=x.strip().split('=',1);k=k.lower();v=v.strip()
        if v.startswith('"') and v.endswith('"'):v=re.sub(r'\\(.)',r'\1',v[1:-1])
        check(k not in params,'unsupported','duplicate media parameter');params[k]=v.lower() if k=='charset' else v
    return typ,params

def select_media(decls,chosen=None):
    check(isinstance(decls,dict) and bool(decls),'unsupported','no media alternative')
    identities={};clean=[]
    for name,decl in decls.items():
        try:t,p=media(name)
        except Cannot:continue
        key=(t,tuple(sorted(p.items())));identities.setdefault(key,[]).append((name,decl))
    for key,vals in identities.items():
        if len(vals)==1:clean.append((key,vals[0]))
    if chosen is None:
        concrete=[n for (t,p),(n,d) in clean if '*' not in t]
        check(len(clean)==len(concrete)==1,'missing-context','media selection');chosen=concrete[0]
    t,p=media(chosen);check('*' not in t,'invalid','concrete media needed');matches=[]
    for (dt,ps),(name,decl) in clean:
        dp=dict(ps)
        if all(p.get(k)==v for k,v in dp.items()) and (dt==t or dt=='*/*' or dt==t.split('/')[0]+'/*'):
            matches.append(((2 if dt==t else 0 if dt=='*/*' else 1,len(dp)),decl))
    check(bool(matches),'unsupported','unmatched media');matches.sort(key=lambda x:x[0],reverse=True)
    check(len(matches)==1 or matches[0][0]!=matches[1][0],'unsupported','ambiguous media')
    return chosen,matches[0][1]

def canonical_b64(v):
    check(isinstance(v,str),'unroutable','Base64 string')
    try:b=base64.b64decode(v,validate=True)
    except Exception:fail('unroutable','invalid Base64')
    check(base64.b64encode(b).decode()==v,'unroutable','noncanonical Base64');return b

def exact_float(s):
    number=float(s)
    check(math.isfinite(number) and Decimal.from_float(number)==Decimal(s),'unsupported','non-binary-exact decimal capability')
    return number

def json_load(b):
    try:
        value=json.loads(b.decode('utf-8-sig'),parse_float=exact_float,parse_constant=lambda s:fail('decode','nonJSON number'))
        json.dumps(value,ensure_ascii=False).encode('utf-8');return value
    except (UnicodeError,ValueError):fail('decode','JSON')
def json_dump(v):
    try:return json.dumps(v,ensure_ascii=False,allow_nan=False,separators=(',',':')).encode('utf-8')
    except (ValueError,UnicodeError):fail('unroutable','JSON value')

def xml_codec(b,params):
    for bom,codec in ((codecs.BOM_UTF32_LE,'utf-32'),(codecs.BOM_UTF32_BE,'utf-32'),(codecs.BOM_UTF16_LE,'utf-16'),(codecs.BOM_UTF16_BE,'utf-16'),(codecs.BOM_UTF8,'utf-8-sig')):
        if b.startswith(bom):return codec
    if 'charset' in params:return params['charset']
    m=re.match(br'<\?xml[^>]*encoding\s*=\s*[\"\x27]([^\"\x27]+)',b)
    return m.group(1).decode('ascii') if m else 'utf-8'

def representation(mt,decl,value,r,decode=False,property_value=False):
    t,p=media(mt);s=decl.get('schema',{});typ,m=sole_type(s,r);cats,_,_=inspect_schema(s,r)
    check(bool(cats),'unroutable','empty schema category')
    check(not(t.startswith('multipart/') or t=='application/x-www-form-urlencoded'),'unsupported','form correspondence')
    if t=='application/json' or t.endswith('+json'):
        return json_load(value) if decode else json_dump(value)
    if m.get('format')=='byte' and typ=='string':
        if decode:
            try:return value.decode(p.get('charset','utf-8'))
            except (UnicodeError,LookupError):fail('decode','byte text')
        check(isinstance(value,str),'unroutable','byte text');return value.encode('utf-8')
    isxml=t in ('application/xml','text/xml') or t.endswith('+xml')
    character=t.startswith('text/') or isxml
    if m.get('format')!='binary' and character:
        if property_value and typ in ('number','integer','boolean') and t=='text/plain' and not decode:return json_dump(value)
        check(typ=='string','unsupported','character declaration')
        try:
            if decode:return value.decode(xml_codec(value,p) if isxml else p.get('charset','utf-8'))
            check(isinstance(value,str),'unroutable','character value')
            codec=p.get('charset','utf-8')
            if isxml:
                match=re.match(r'<\?xml[^>]*encoding\s*=\s*[\"\x27]([^\"\x27]+)',value)
                if match and 'charset' not in p:codec=match.group(1)
            return value.encode(codec)
        except (UnicodeError,LookupError):fail('unsupported','character codec')
    check(typ is None or typ=='string' and m.get('format')=='binary','unsupported','raw declaration')
    return base64.b64encode(value).decode() if decode else canonical_b64(value)

def field(name,value):
    check(bool(TOKEN.fullmatch(name)),'unroutable','field name')
    check(isinstance(value,str) and value==value.strip(' \t') and all(ord(c)>=32 and ord(c)!=127 for c in value),'unroutable','field value')
    return value

def cookie(name,value):
    check(bool(TOKEN.fullmatch(name)) and bool(name),'unroutable','cookie name')
    check(isinstance(value,str) and all(ord(c)==33 or 35<=ord(c)<=43 or 45<=ord(c)<=58 or 60<=ord(c)<=91 or 93<=ord(c)<=126 for c in value),'unroutable','cookie value')
    return name+'='+value

def convert(v,ctx):
    if isinstance(v,str):return v
    check(type(v) in (int,float,bool),'unsupported','compound scalar')
    check('scalar' in ctx,'missing-context','scalar converter')
    if ctx['scalar']=='json':return json.dumps(v,separators=(',',':'))
    if ctx['scalar']=='upper':return str(v).upper() if isinstance(v,bool) else str(v)
    fail('unsupported','converter capability')

def parameter(p,v,ctx,r):
    name,loc=p['name'],p['in']
    if 'content' in p:
        check(len(p['content'])==1,'unsupported','parameter content alternatives')
        mt,d=next(iter(p['content'].items()));b=representation(mt,d,v,r)
        try:s=b.decode('utf-8')
        except UnicodeError:fail('unsupported','nonUTF8 content parameter probe capability')
        if loc in ('query','path'):s=urllib.parse.quote_from_bytes(b,safe='-._~')
        return [(urllib.parse.quote(name,safe='-._~'),s)] if loc=='query' else s
    style=p.get('style',{'path':'simple','header':'simple','query':'form','cookie':'form'}[loc]);explode=p.get('explode',style=='form')
    check(style in {'path':['simple','label','matrix'],'header':['simple'],'query':['form','spaceDelimited','pipeDelimited','deepObject'],'cookie':['form']}[loc],'unsupported','style location')
    safe='-._~' + (":/?@!$'()*+,;" if p.get('allowReserved') and loc=='query' else '')
    q=lambda x: convert(x,ctx) if loc=='header' else urllib.parse.quote(convert(x,ctx),safe=safe)
    n=urllib.parse.quote(name,safe='-._~')
    undefined=v is None or v==[] or v=={}
    if undefined:
        check(style in ('simple','label','matrix','form'),'unsupported','undefined style cell')
        return {'simple':'','label':'.','matrix':';'+n,'form':[(n,'')]}[style]
    if style in ('spaceDelimited','pipeDelimited'):
        check(not explode and isinstance(v,(list,dict)),'unsupported','delimited cell')
        delim=' ' if style=='spaceDelimited' else '|';a=v if isinstance(v,list) else [z for kv in v.items() for z in kv]
        check(all(delim not in convert(x,ctx) for x in a),'unsupported','separator data')
        return [(n,('%20' if delim==' ' else '%7C').join(q(x) for x in a))]
    if style=='deepObject':
        check(explode and isinstance(v,dict),'unsupported','deepObject cell')
        check(all('[' not in k and ']' not in k for k in v),'unsupported','deepObject key')
        return [(urllib.parse.quote(name+'['+k+']',safe='-._~'),q(x)) for k,x in v.items()]
    if loc=='cookie' and isinstance(v,(list,dict)):check(len(v)<=1,'unsupported','multiple logical cookie values')
    if isinstance(v,list):vals=[q(x) for x in v];pairs=[(n,x) for x in vals]
    elif isinstance(v,dict):
        vals=[z for k,x in v.items() for z in (q(k),q(x))];pairs=[(q(k),q(x)) for k,x in v.items()]
    else:vals=[q(v)];pairs=[(n,vals[0])]
    if style=='form':return pairs if explode else [(n,','.join(vals))]
    if style=='simple':return ','.join(k+'='+x for k,x in pairs) if isinstance(v,dict) and explode else ','.join(vals)
    if style=='label':return '.'+('.'.join(k+'='+x for k,x in pairs) if isinstance(v,dict) and explode else ('.' if explode else ',').join(vals))
    if style=='matrix':return ''.join(';'+k+'='+x for k,x in pairs) if explode else ';'+n+'='+','.join(vals)

@dataclass
class Request:
    method:str
    url:str
    headers:dict
    body:bytes
    operation:dict
    binding:dict
    resources:Resources
    protected_headers:set

class Interpreter:
    def __init__(self,fetch):self.r=Resources(fetch)
    def prepare(self,obi,value=ABSENT,ctx=None):
        ctx=ctx or {}; b=obi['bindings']['invoke'];source=obi['sources'][b['source']]
        check(source['kind']==KIND,'unsupported','exact kind')
        c=b.get('content',ABSENT);check(isinstance(c,dict) and 'target' in c and set(c)<={'target','input','output'},'invalid','binding content')
        for key in ('input','output'):
            if key in c:validate_mapping(c[key])
        toks=pointer_tokens(c['target']);check(len(toks)==3 and toks[0]=='paths' and toks[1].startswith('/') and toks[2] in ('get','put','post','delete','options','head','patch','trace'),'invalid','target form')
        d=self.r.source(source.get('content',ABSENT));path,method=toks[1:];item=d.get('paths',{}).get(path,ABSENT)
        check(isinstance(item,dict),'no-target','Path Item');local=item
        if '$ref' in item:
            remote=self.r.ref(item);check(isinstance(remote,dict),'invalid','Path Item ref')
            merged={**remote,**{k:v for k,v in item.items() if k!='$ref'}};op=merged.get(method,{})
            for k in set(remote)&(set(item)-{'$ref'}):
                used=k==method or k=='servers' and not op.get('servers')
                if k=='parameters':
                    overridden={(self.r.ref(p).get('in'),self.r.ref(p).get('name')) for p in op.get('parameters',[])}
                    used=any((self.r.ref(p).get('in'),self.r.ref(p).get('name')) not in overridden for p in remote[k]+item[k])
                check(not used,'unavailable','ambiguous Path Item '+k)
            item=merged
        op=item.get(method,ABSENT);check(isinstance(op,dict),'no-target','operation')
        responses=op.get('responses',{})
        check(isinstance(responses,dict) and any(k=='default' or re.fullmatch(r'[1-5](?:[0-9]{2}|XX)',k) for k in responses),'unsupported','Responses Object required')
        req=mapping(c['input'],value) if 'input' in c else value
        if req is ABSENT:req={}
        check(isinstance(req,dict) and set(req)<={'parameters','body'},'unroutable','request envelope')
        params=req.get('parameters',{});check(isinstance(params,dict),'unroutable','parameters object')
        if 'server' in ctx:server=ctx['server']
        else:
            servers=op.get('servers') or item.get('servers') or d.get('servers') or [{'url':'/'}]
            check(len(servers)==1 or 'server_index' in ctx,'missing-context','server choice')
            srv=servers[ctx.get('server_index',0)];server=srv.get('url','')
            for key in re.findall(r'\{([^{}]+)\}',server):
                var=srv.get('variables',{}).get(key,{});v=ctx.get('variables',{}).get(key,var.get('default',ABSENT))
                check(v is not ABSENT,'missing-context','server variable');check('enum' not in var or v in var['enum'],'unroutable','server enum');server=server.replace('{'+key+'}',str(v))
            if not urllib.parse.urlsplit(server).scheme:
                base=self.r.base(srv) or self.r.base(op) or self.r.base(local) or self.r.base(d)
                check(bool(base),'missing-context','server base');server=urllib.parse.urljoin(base,server)
        u=urllib.parse.urlsplit(server)
        check(u.scheme in ('http','https') and bool(u.hostname) and u.username is None and not u.query and not u.fragment,'unroutable','server URL')
        contributions={};required_unavailable=False
        for raw in list(item.get('parameters',[]))+list(op.get('parameters',[])):
            p=self.r.ref(raw);check(isinstance(p,dict),'invalid','parameter declaration')
            contributions[(p.get('in'),p.get('name'))]=p
        effective=[]
        for (loc,n),p in contributions.items():
            check(loc in ('path','query','header','cookie') and isinstance(n,str),'invalid','parameter identity')
            if loc=='header' and n.lower() in ('accept','content-type','authorization'):continue
            bad=(loc=='header' and (not TOKEN.fullmatch(n) or n.lower() in OWNED)) or (loc=='cookie' and not TOKEN.fullmatch(n))
            if bad:
                check(not p.get('required'),'unsupported','required unavailable projection');continue
            effective.append(p)
        protected={'authorization','cookie'}
        names=[p['name'] for p in effective];qualified=len(names)!=len(set(names));known={};query=[];headers={};cookies=[]
        def add_header(n,v):
            field(n,v);check(n.lower() not in {x.lower() for x in headers},'unroutable','header collision');headers[n]=v
        def add_query(n,v):
            check(n not in {a for a,b in query},'unroutable','query contribution collision');query.append((n,v))
        for p in effective:
            n,loc=p['name'],p['in'];key=loc+'/'+escape(n) if qualified else n;known[key]=p
            if key not in params:check(not p.get('required'),'unroutable','required parameter');continue
            out=parameter(p,params[key],ctx,self.r)
            if loc=='path':path=path.replace('{'+n+'}',out)
            elif loc=='header':add_header(n,out)
            elif loc=='query':
                check(not {a for a,b in out}&{a for a,b in query},'unroutable','query contribution collision');query+=out
            else:
                for cn,cv in out:cookie(cn,cv);cookies.append((cn,cv))
        check(set(params)<=set(known),'unroutable','unknown parameter key');check(not re.search(r'\{[^}]*\}',path),'unroutable','missing path parameter')
        security=op.get('security',d.get('security',[]));choices=[]
        for reqs in security:
            schemes={};bad=False
            security_doc=d
            if ctx.get('security_scope')=='referring':security_doc=self.r.docs.get(self.r.base(op),d)
            for name in reqs:
                s=security_doc.get('components',{}).get('securitySchemes',{}).get(name)
                if not isinstance(s,dict) or s.get('type') not in ('apiKey','http','oauth2','openIdConnect'):bad=True;break
                s=self.r.ref(s)
                if s.get('type')=='apiKey' and (s.get('in') not in ('query','header','cookie') or not isinstance(s.get('name'),str) or s.get('in')=='header' and s['name'].lower() in CRED_OWNED):bad=True;break
                schemes[name]=s
            destinations=set()
            for scheme in schemes.values():
                loc,n=(scheme.get('in'),scheme.get('name')) if scheme.get('type')=='apiKey' else ('header','Authorization')
                destination=(loc,n.lower() if loc=='header' else n)
                if destination in destinations:bad=True
                destinations.add(destination)
                for par in effective:
                    pl,pn=par['in'],par['name']
                    # A required ordinary scalar query or header has a fixed
                    # destination; expanded object destinations depend on values.
                    pt,_=sole_type(par.get('schema',{}),self.r)
                    fixed=pl in ('header','cookie') or pl=='query' and pt not in ('object','array',None)
                    pd=(pl,pn.lower() if pl=='header' else pn)
                    if par.get('required') and fixed and pd==destination:bad=True
                    if par.get('required') and pl=='header' and pn.lower()=='cookie' and loc=='cookie':bad=True
            if not bad:choices.append((reqs,schemes))
        if security:
            check(bool(choices),'unsupported','security alternatives')
            check(len(choices)==1 or 'security_index' in ctx,'missing-context','security choice')
            reqs,schemes=choices[ctx.get('security_index',0)]
            for name,s in schemes.items():
                cred=ctx.get('credentials',{}).get(name,ABSENT);check(cred is not ABSENT,'missing-context','credential '+name)
                check(method!='trace','unroutable','TRACE sensitive credential')
                if s['type']=='apiKey':
                    loc,n=s['in'],s['name']
                    if loc=='query':add_query(urllib.parse.quote(n,safe='-._~'),urllib.parse.quote(cred,safe='-._~'))
                    elif loc=='header':add_header(n,cred);protected.add(n.lower())
                    else:cookie(n,cred);check(n not in {k for k,v in cookies},'unroutable','cookie collision');cookies.append((n,cred))
                elif s['type']=='http' and s.get('scheme','').lower()=='basic':
                    check(isinstance(cred,list) and len(cred)==2 and ':' not in cred[0] and all(all(32<=ord(c)<=126 for c in x) for x in cred),'unroutable','Basic ASCII')
                    add_header('Authorization','Basic '+base64.b64encode(':'.join(cred).encode()).decode())
                else:
                    check(s['type']!='http' or s.get('scheme','').lower()=='bearer','unsupported','HTTP auth capability')
                    check(isinstance(cred,str) and re.fullmatch(r'[A-Za-z0-9\-._~+/]+=*',cred),'unroutable','Bearer syntax');add_header('Authorization','Bearer '+cred)
        for n in ('Accept','Accept-Encoding'):
            if n.lower() in ctx.get('negotiation',{}):add_header(n,ctx['negotiation'][n.lower()])
        raw_cookie=next((v for k,v in headers.items() if k.lower()=='cookie'),None)
        if raw_cookie is not None:
            check(not cookies,'unroutable','raw/structured Cookie collision')
            for pair in raw_cookie.split('; '):
                check('=' in pair,'unroutable','cookie-string');cookie(*pair.split('=',1))
        if cookies:add_header('Cookie','; '.join(cookie(n,v) for n,v in cookies))
        check(method!='trace' or not any(k.lower() in ('cookie','authorization') for k in headers),'unroutable','TRACE cookie')
        body=b''
        body_decl=self.r.ref(op.get('requestBody',{}))
        if method in ('get','head','delete','options','trace'):check('body' not in req,'unroutable','method body forbidden')
        elif 'body' in req:
            check(bool(body_decl),'unroutable','undeclared body')
            mt,decl=select_media(body_decl.get('content',{}),ctx.get('media'))
            if media(mt)[0].startswith('multipart/') or media(mt)[0]=='application/x-www-form-urlencoded':body,mt=self.form(mt,decl,req['body'],ctx)
            else:body=representation(mt,decl,req['body'],self.r)
            add_header('Content-Type',mt)
        else:check(not body_decl.get('required'),'unroutable','required body')
        coding=next((v for k,v in headers.items() if k.lower()=='content-encoding'),None)
        if coding:
            check('body' in req,'unroutable','body-free content coding')
            for code in coding.split(','):
                check(code.strip().lower()=='gzip','unsupported','request coding');body=gzip.compress(body,mtime=0)
        return Request(method.upper(),server[:-1]+path if server.endswith('/') else server+path,headers,body,op,c,self.r,protected) if not query else Request(method.upper(),(server[:-1] if server.endswith('/') else server)+path+'?'+'&'.join(n+'='+v for n,v in query),headers,body,op,c,self.r,protected)

    def form(self,mt,decl,value,ctx):
        check(isinstance(value,dict),'unroutable','form object');typ,s=sole_type(decl.get('schema',{}),self.r)
        check(typ=='object','unsupported','form schema');multipart=media(mt)[0].startswith('multipart/');parts=[];pairs=[]
        for name,v in value.items():
            prop=s.get('properties',{}).get(name,s.get('additionalProperties',True))
            check(prop is not False,'unroutable','undeclared form property')
            prop={} if prop is True else prop
            enc=decl.get('encoding',{}).get(name,{})
            style=not multipart and bool(set(enc)&{'style','explode','allowReserved'})
            if style:
                pairs+=parameter({'name':name,'in':'query',**{k:x for k,x in enc.items() if k in ('style','explode','allowReserved')}},v,ctx,self.r);continue
            if v is None:
                check(name not in s.get('required',[]),'unroutable','required null form property');continue
            pt,ps=sole_type(prop,self.r)
            check(bool(inspect_schema(prop,self.r)[0]),'unroutable','empty property categories')
            vs=v if multipart and pt=='array' else [v]
            pdecl=ps.get('items',{}) if multipart and pt=='array' else prop
            default_schema=ps.get('items',{}) if pt=='array' else prop
            dt,ds=sole_type(default_schema,self.r)
            default='application/octet-stream' if ds.get('format') in ('binary','byte') else 'application/json' if dt=='object' else 'text/plain' if dt in ('string','number','integer','boolean') else None
            names=[x.strip() for x in enc['contentType'].split(',')] if 'contentType' in enc else [default] if default else []
            if names:pm,_=select_media({x:{} for x in names},ctx.get('property_media',{}).get(name))
            else:fail('missing-context','property media')
            for item in vs:
                data=representation(pm,{'schema':pdecl},item,self.r,property_value=True)
                if not multipart:pairs.append((urllib.parse.quote(name,safe=''),urllib.parse.quote_from_bytes(data,safe='')));continue
                h={};domains={}
                for hn,raw in enc.get('headers',{}).items():
                    if hn.lower()=='content-type':continue
                    hd=self.r.ref(raw);fixed=None;enums=[]
                    if 'schema' in hd:
                        _,_,enums=inspect_schema(hd['schema'],self.r)
                        domain=set.intersection(*enums) if enums else None
                        if domain is not None and len(domain)==1:fixed=next(iter(domain))
                    check(fixed is not None or not hd.get('required'),'unsupported','required nonfixed Encoding header')
                    if fixed is not None:
                        field(hn,fixed);low=hn.lower()
                        check(low not in h or h[low]==fixed,'unsupported','conflicting fixed Encoding headers');h[low]=fixed
                    if enums:domains.setdefault(hn.lower(),[]).extend(enums)
                for hn,eds in domains.items():
                    if hn in h:check(all(h[hn] in d for d in eds),'unsupported','Encoding enum intersection')
                pt2,ps2=sole_type(pdecl,self.r)
                cte=h.get('content-transfer-encoding')
                if pt2=='string' and ps2.get('format')=='byte':
                    check(all(any(v.lower()=='base64' for v in domain) for domain in domains.get('content-transfer-encoding',[])),'unsupported','byte transfer domain rejects base64')
                if cte:check(cte.lower()=='base64' and pt2=='string' and ps2.get('format')=='byte','unsupported','transfer encoding transformation')
                check('\r' not in name and '\n' not in name,'unroutable','part name')
                disposition='form-data; name="'+name.replace('\\','\\\\').replace('"','\\"')+'"'
                if 'content-disposition' in h:
                    from email.message import Message
                    msg=Message();msg['Content-Disposition']=h['content-disposition']
                    check(msg.get_content_disposition()=='form-data' and msg.get_param('name',header='content-disposition')==name and 'filename*=' not in h['content-disposition'].lower(),'unsupported','fixed disposition')
                    disposition=h.pop('content-disposition')
                parts.append((disposition,pm,h,data))
        if not multipart:return '&'.join(n+'='+v for n,v in pairs).encode(),mt
        boundary=ctx.get('boundary','independent-boundary-47');body=b''
        for disposition,pm,h,data in parts:
            body+=('--'+boundary+'\r\nContent-Disposition: '+disposition+'\r\nContent-Type: '+pm+'\r\n'+''.join(k+': '+v+'\r\n' for k,v in h.items())+'\r\n').encode()+data+b'\r\n'
        body+=('--'+boundary+'--\r\n').encode()
        return body,media(mt)[0]+'; boundary="'+boundary+'"'

def complete(req,status,header_pairs,body,*,truncated=False,cancelled=False):
    try:
        check(not cancelled,'completion','cancelled');check(not truncated,'completion','truncated unary');check(status!=101,'completion','upgrade')
        check(200<=status<300,'completion','HTTP failure')
        declarations=req.operation['responses'];key=str(status) if str(status) in declarations else str(status)[0]+'XX' if str(status)[0]+'XX' in declarations else 'default'
        check(key in declarations,'completion','undeclared response');response=req.resources.ref(declarations[key]);check(isinstance(response,dict),'completion','response object')
        hs={}
        for n,v in header_pairs:field(n,v);hs.setdefault(n.lower(),[]).append(v)
        for hn,raw in response.get('headers',{}).items():
            if hn.lower()=='content-type':continue
            hd=req.resources.ref(raw)
            check(not hd.get('required') or hn.lower() in hs,'completion','required response header')
            if hn.lower()=='content-encoding' and hn.lower() in hs and 'schema' in hd:
                _,_,enums=inspect_schema(hd['schema'],req.resources);actual=', '.join(hs[hn.lower()]);check(all(actual in d for d in enums),'completion','Content-Encoding enum')
        no_content=req.method=='HEAD' or status in (204,205,304)
        if no_content:check(not body,'completion','forbidden response content');return {'success':True,'values':[]}
        for coding in reversed(','.join(hs.get('content-encoding',[])).split(',')):
            if not coding.strip():continue
            check(coding.strip().lower()=='gzip','completion','coding capability')
            try:body=gzip.decompress(body)
            except Exception:fail('completion','coding failure')
        if not body:return {'success':True,'values':[]}
        ct=hs.get('content-type',['application/octet-stream']);check(len(ct)==1,'completion','multiple Content-Type')
        mt,decl=select_media(response.get('content',{}),ct[0]);value=representation(mt,decl,body,req.resources,decode=True)
        if 'output' in req.binding:value=mapping(req.binding['output'],value)
        return {'success':True,'values':[] if value is ABSENT else [value]}
    except Cannot as e:return {'success':False,'values':[],'reason':str(e)}
