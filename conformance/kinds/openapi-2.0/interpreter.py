"""Fresh bounded interpreter from the pinned candidate. No production/library reuse.
Transport policy: loopback HTTP only; at most three preserving redirects; 2MiB bodies.
Schema duties: finite kind inspection, not general OAS/current-core validation.
"""
import base64, codecs, decimal, gzip, http.client, json, math, re, socket, subprocess, urllib.parse, urllib.request, zlib
from pathlib import Path

ABSENT = object()
KIND = 'openbindings.openapi-2.0@1'
TOKEN = r"[!#$%&'*+.^_`|~0-9A-Za-z-]+"
OWNED = {'host','content-length','content-type','connection','keep-alive','proxy-authorization','proxy-connection','te','trailer','transfer-encoding','upgrade'}
class Problem(Exception):
    def __init__(self, category, reason): self.category,self.reason=category,reason

def need(test, category, reason):
    if not test: raise Problem(category, reason)

def unicode_ok(v):
    if isinstance(v,str): need(not any(0xd800<=ord(c)<=0xdfff for c in v),'unsupported','unpaired-surrogate')
    elif isinstance(v,list):
        for x in v: unicode_ok(x)
    elif isinstance(v,dict):
        for k,x in v.items(): unicode_ok(k); unicode_ok(x)
    elif isinstance(v,float): need(math.isfinite(v),'unsupported','nonfinite-number')

def exact_float(spelling):
    value=float(spelling)
    need(math.isfinite(value) and decimal.Decimal(spelling)==decimal.Decimal(str(value)),'unsupported','decimal-precision-capability')
    return value

def text_bytes(raw):
    for sig,enc in [(codecs.BOM_UTF32_LE,'utf-32'),(codecs.BOM_UTF32_BE,'utf-32'),(codecs.BOM_UTF16_LE,'utf-16'),(codecs.BOM_UTF16_BE,'utf-16'),(codecs.BOM_UTF8,'utf-8-sig')]:
        if raw.startswith(sig): return raw.decode(enc)
    if raw[:3]==b'\x00\x00\x00': return raw.decode('utf-32-be')
    if len(raw)>3 and raw[1:4]==b'\x00\x00\x00': return raw.decode('utf-32-le')
    if len(raw)>1 and raw[0]==0: return raw.decode('utf-16-be')
    if len(raw)>1 and raw[1]==0: return raw.decode('utf-16-le')
    return raw.decode('utf-8')

def parse_document(raw):
    if isinstance(raw,bytes): raw=text_bytes(raw)
    need(isinstance(raw,str),'invalid','document-type')
    p=subprocess.run(['ruby',str(Path(__file__).with_name('yaml_ast.rb'))],input=raw,text=True,capture_output=True)
    need(p.returncode==0,'invalid','yaml-syntax')
    ast=json.loads(p.stdout)
    need(len(ast['children'])==1,'invalid','multiple-documents')
    def scalar(n,key=False):
        v=n['value']; tag=n.get('tag')
        if key: return v
        if tag=='tag:yaml.org,2002:str' or (not n.get('plain') and not tag): return v
        if v in ('null','Null','NULL','~',''): value=None
        elif v in ('true','True','TRUE'): value=True
        elif v in ('false','False','FALSE'): value=False
        elif re.fullmatch(r'[-+]?[0-9]+',v): value=int(v)
        elif re.fullmatch(r'0o[0-7]+',v): value=int(v[2:],8)
        elif re.fullmatch(r'0x[0-9a-fA-F]+',v): value=int(v[2:],16)
        elif re.fullmatch(r'[-+]?(?:[0-9]+\.[0-9]*|\.[0-9]+|[0-9]+[eE][-+]?[0-9]+)(?:[eE][-+]?[0-9]+)?',v):
            # JSON exact decimal text retained only where binary64 is exact enough for this bounded implementation.
            value=exact_float(v)
        elif re.fullmatch(r'[-+]?\.(?:inf|Inf|INF|nan|NaN|NAN)',v): raise Problem('invalid','yaml-non-json-number')
        else: value=v
        if tag:
            kinds={'tag:yaml.org,2002:null':type(None),'tag:yaml.org,2002:bool':bool,'tag:yaml.org,2002:int':int,'tag:yaml.org,2002:float':float}
            need(tag in kinds and type(value)==kinds[tag],'invalid','incompatible-tag')
        return value
    def walk(n):
        k=n['kind']; tag=n.get('tag')
        if k=='Scalar': return scalar(n)
        if k=='Alias': raise Problem('unsupported','yaml-alias-capability')
        if k=='Sequence':
            need(tag in (None,'tag:yaml.org,2002:seq'),'invalid','incompatible-tag'); return [walk(x) for x in n['children']]
        if k=='Mapping':
            need(tag in (None,'tag:yaml.org,2002:map'),'invalid','incompatible-tag'); out={}; ch=n['children']
            for a,b in zip(ch[::2],ch[1::2]):
                need(a['kind']=='Scalar','invalid','non-scalar-key'); key=scalar(a,True)
                need(key not in out,'invalid','duplicate-key'); out[key]=walk(b)
            return out
        if k=='Document': return walk(n['children'][0])
        raise Problem('invalid','yaml-node')
    value=walk(ast['children'][0]); unicode_ok(value); return value

def pointer_tokens(p):
    need(isinstance(p,str) and (p=='' or p.startswith('/')) and not re.search(r'~(?![01])',p),'invalid','pointer')
    return [] if p=='' else [x.replace('~1','/').replace('~0','~') for x in p[1:].split('/')]

def select(v,p):
    for k in pointer_tokens(p):
        if isinstance(v,dict): v=v.get(k,ABSENT)
        elif isinstance(v,list) and re.fullmatch('0|[1-9][0-9]*',k): v=v[int(k)] if int(k)<len(v) else ABSENT
        else: return ABSENT
    return v

def mapping_check(m,depth=0):
    need(isinstance(m,dict),'invalid','mapping-object')
    forms=set(m)-{'up'}; need(len(forms)==1,'invalid','mapping-form'); f=next(iter(forms))
    need(f in {'at','literal','object','array','each'} and ('up' not in m or f=='at'),'invalid','mapping-members')
    if f=='at':
        pointer_tokens(m[f]); up=m.get('up',0); need(type(up)==int and 0<=up<=depth,'invalid','mapping-up')
    if f=='object':
        need(isinstance(m[f],dict),'invalid','mapping-object'); [mapping_check(x,depth) for x in m[f].values()]
    if f=='array':
        need(isinstance(m[f],list),'invalid','mapping-array'); [mapping_check(x,depth) for x in m[f]]
    if f=='each':
        e=m[f]; need(isinstance(e,dict) and set(e)=={'in','value'},'invalid','mapping-each')
        mapping_check(e['in'],depth); mapping_check(e['value'],depth+1)

def mapped(m,scope):
    if 'at' in m: return select(scope[m.get('up',0)],m['at'])
    if 'literal' in m: return m['literal']
    if 'object' in m: return {k:v for k,x in m['object'].items() if (v:=mapped(x,scope)) is not ABSENT}
    if 'array' in m:
        out=[mapped(x,scope) for x in m['array']]; need(all(x is not ABSENT for x in out),'mapping-failure','absent-array-member'); return out
    e=m['each']; col=mapped(e['in'],scope)
    if col is ABSENT: return ABSENT
    need(isinstance(col,list),'mapping-failure','each-non-array'); out=[mapped(e['value'],[x]+scope) for x in col]
    need(all(x is not ABSENT for x in out),'mapping-failure','absent-each-member'); return out

class Resolver:
    def __init__(self,ctx): self.docs={}; self.ctx=ctx; self.bases={}; self.roots={}; self.fetches=[]
    def register(self,v,base,root):
        if isinstance(v,(dict,list)):
            self.bases[id(v)]=base; self.roots[id(v)]=root
            for x in (v.values() if isinstance(v,dict) else v): self.register(x,base,root)
    def fetch(self,url):
        p=urllib.parse.urlsplit(url)
        need(p.scheme=='http' and p.hostname in ('127.0.0.1','localhost'),'unavailable','resolver-policy')
        need(url not in self.ctx.get('deny',[]),'unavailable','resolver-policy')
        try:
            with urllib.request.urlopen(url,timeout=3) as r:
                raw=r.read(2*1024*1024+1); final=r.url
            need(len(raw)<=2*1024*1024,'unsupported','artifact-size'); v=parse_document(raw)
        except Problem: raise
        except Exception as e: raise Problem('unavailable','artifact-acquisition:'+type(e).__name__)
        self.fetches.append({'requested':url,'final':final}); self.docs[url]=v; self.docs[final]=v; self.register(v,final,v); return v,final
    def source(self,s):
        need(isinstance(s,dict) and s and set(s)<={'document','location'},'invalid','source-content')
        base=s.get('location'); need('location' not in s or isinstance(base,str) and bool(urllib.parse.urlsplit(base).scheme),'invalid','source-location')
        if base is not None:
            need(not urllib.parse.urlsplit(base).fragment,'invalid','source-location-fragment'); base=urllib.parse.urldefrag(base)[0]
        if 'document' in s:
            doc=s['document']; need(isinstance(doc,(str,dict)),'invalid','source-document')
            v=parse_document(doc) if isinstance(doc,str) else doc
            self.register(v,base,v)
            if base: self.docs[base]=v
        else: v,base=self.fetch(base)
        need(isinstance(v,dict) and v.get('swagger')=='2.0','invalid','swagger-discriminator')
        return v,base
    def ref(self,v,seen=None):
        seen=set() if seen is None else seen
        while isinstance(v,dict) and '$ref' in v:
            need(id(v) not in seen,'unsupported','nonconsuming-ref-cycle'); seen.add(id(v))
            ref=v['$ref']; need(isinstance(ref,str),'invalid','ref-type'); base=self.bases.get(id(v)); root=self.roots.get(id(v))
            if ref.startswith('#') or ref=='': target=root; frag=ref[1:] if ref else ''
            else:
                need(bool(urllib.parse.urlsplit(ref).scheme) or base is not None,'missing-context','relative-ref-base')
                url=urllib.parse.urljoin(base or '',ref); docurl,frag=urllib.parse.urldefrag(url)
                target=self.docs.get(docurl)
                if target is None: target,_=self.fetch(docurl)
            v=select(target,urllib.parse.unquote(frag)); need(v is not ABSENT,'invalid','reference-target')
        return v

def inspected(res,s,seen=None):
    s=res.ref(s); need(isinstance(s,dict),'invalid','schema-object'); seen=set() if seen is None else set(seen)
    if id(s) in seen: return None,{}
    seen.add(id(s)); typ=None; members={}
    if 'type' in s:
        v=s['type']; a=v if isinstance(v,list) else [v]
        need(all(isinstance(x,str) and x in {'string','null','boolean','integer','number','object','array','file'} for x in a) and len(a)==len(set(a)),'invalid','schema-type')
        typ=set(a)
        if 'number' in typ: typ.add('integer')
    for k in ('format','readOnly'):
        if k in s: members[k]=s[k]
    for branch in s.get('allOf',[]):
        bt,bm=inspected(res,branch,seen)
        typ=bt if typ is None else typ if bt is None else typ & bt
        for k,v in bm.items():
            need(k not in members or members[k]==v,'unsupported','conflicting-inspected-member'); members[k]=v
    return typ,members

def request_duty(res,s,v,trail=None):
    s=res.ref(s); need(isinstance(s,dict),'invalid','schema-object'); trail=set() if trail is None else set(trail)
    pair=(id(s),id(v))
    if pair in trail: return
    trail.add(pair); typ,_=inspected(res,s)
    need(typ is None or bool(typ),'unsupported','empty-type-intersection')
    if isinstance(v,dict):
        properties={}; required=set()
        def declarations(n,visited):
            n=res.ref(n)
            if id(n) in visited: return
            visited.add(id(n)); required.update(n.get('required',[]))
            for k,p in n.get('properties',{}).items(): properties.setdefault(k,[]).append(p)
            for b in n.get('allOf',[]): declarations(b,visited)
        declarations(s,set())
        for k,schemas in properties.items():
            ro=any(inspected(res,p)[1].get('readOnly') is True for p in schemas)
            need(not(ro and (k in v or k in required)),'unsupported','readOnly-request')
            if k in v:
                for p in schemas: request_duty(res,p,v[k],trail)
        extra=s.get('additionalProperties')
        if isinstance(extra,dict):
            for k,x in v.items():
                if k not in s.get('properties',{}):
                    need(inspected(res,extra)[1].get('readOnly') is not True,'unsupported','readOnly-additional-property')
                    request_duty(res,extra,x,trail)
    if isinstance(v,list) and isinstance(s.get('items'),dict):
        for x in v: request_duty(res,s['items'],x,trail)
    for b in s.get('allOf',[]): request_duty(res,b,v,trail)

def media(s):
    need(isinstance(s,str),'unsupported','media-type')
    # Bounded RFC token/quoted parameter grammar, no comments.
    parts=re.split(r';(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)',s); mime=parts[0].strip().lower()
    need(re.fullmatch(TOKEN+'/'+TOKEN,mime) is not None,'unsupported','media-type'); params={}
    for part in parts[1:]:
        need('=' in part,'unsupported','media-parameter'); k,v=part.strip().split('=',1); k=k.lower(); v=v.strip()
        need(re.fullmatch(TOKEN,k) is not None and k not in params,'unsupported','media-parameter')
        if v.startswith('"') and v.endswith('"'): v=re.sub(r'\\(.)',r'\1',v[1:-1])
        else: need(re.fullmatch(TOKEN,v) is not None,'unsupported','media-parameter')
        params[k]=v.lower() if k=='charset' else v
    return mime,params

def match_media(declarations,concrete):
    actual,ap=media(concrete); need('*' not in actual,'unsupported','concrete-media')
    for d in declarations:
        try: pattern,ps=media(d)
        except Problem: continue
        if all(ap.get(k)==v for k,v in ps.items()) and (pattern==actual or pattern=='*/*' or pattern.endswith('/*') and pattern.split('/')[0]==actual.split('/')[0]): return concrete
    raise Problem('unsupported','unmatched-media')

def choose_media(decls,ctx):
    if 'media' in ctx: return match_media(decls,ctx['media'])
    usable={}
    for d in decls:
        try: m,params=media(d)
        except Problem: continue
        if '*' in m: raise Problem('missing-context','media-range-choice')
        usable[(m,tuple(sorted(params.items())))]=d
    need(len(usable)==1,'missing-context' if usable else 'unsupported','media-choice'); return next(iter(usable.values()))

def base64_octets(v):
    need(isinstance(v,str),'unsupported','base64-type')
    try: out=base64.b64decode(v,validate=True)
    except Exception: raise Problem('unsupported','base64-syntax')
    need(base64.b64encode(out).decode()==v,'unsupported','noncanonical-base64'); return out

def character_codec(raw,mime,params):
    xml=mime in ('application/xml','text/xml') or mime.endswith('+xml')
    enc=params.get('charset','utf-8')
    if xml:
        for sig,c in [(codecs.BOM_UTF32_LE,'utf-32'),(codecs.BOM_UTF32_BE,'utf-32'),(codecs.BOM_UTF16_LE,'utf-16'),(codecs.BOM_UTF16_BE,'utf-16'),(codecs.BOM_UTF8,'utf-8-sig')]:
            if raw.startswith(sig): return c
        if 'charset' not in params:
            m=re.match(br'<\?xml[^>]*encoding=[\"\x27]([^\"\x27]+)',raw)
            if m: enc=m.group(1).decode('ascii')
    need(enc.lower() in {'utf-8','utf8','utf-8-sig','utf-16','utf-16le','utf-16be','us-ascii','ascii'},'unsupported','codec-capability')
    return enc

def representation(res,s,mt,value,encode=False,response_file=False):
    typ,mem=inspected(res,s); mime,params=media(mt)
    need(typ is None or bool(typ),'unsupported','empty-type-intersection')
    raw_mode=response_file and typ=={'file'}
    json_mode=mime=='application/json' or mime.endswith('+json')
    char_media=mime.startswith('text/') or mime=='application/xml' or mime.endswith('+xml')
    types=typ-{'null'} if typ is not None else None
    if raw_mode: pass
    elif json_mode:
        if encode:
            unicode_ok(value); return json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode('utf-8')
        try: out=json.loads(value.decode('utf-8-sig'),parse_float=exact_float,parse_constant=lambda s: (_ for _ in ()).throw(ValueError(s)))
        except Problem: raise
        except Exception: raise Problem('decode-failure','json')
        unicode_ok(out); return out
    elif mem.get('format')=='binary' and types=={'string'}: raw_mode=True
    elif char_media:
        need(types=={'string'},'unsupported','character-declared-type')
        try:
            if encode:
                need(isinstance(value,str),'unsupported','character-value'); unicode_ok(value)
                enc=character_codec(value.encode('utf-8'),mime,params); return value.encode(enc)
            enc=character_codec(value,mime,params); out=value.decode(enc); unicode_ok(out); return out
        except LookupError: raise Problem('unsupported','codec-capability')
        except UnicodeError: raise Problem('decode-failure','character-encoding')
    elif typ is None: raw_mode=True
    else: raise Problem('unsupported','media-data-combination')
    if encode: return base64_octets(value)
    return base64.b64encode(value).decode()

def header(name,value):
    need(isinstance(name,str) and re.fullmatch(TOKEN,name) is not None,'unsupported','header-name')
    need(isinstance(value,str) and not re.search(r'[\x00-\x08\x0a-\x1f\x7f]',value) and value==value.strip(' \t'),'unsupported','header-value')
    if name.lower()=='cookie':
        need(re.fullmatch(r"[!#$%&'*+.^_`|~0-9A-Za-z-]+=(?:[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*|\"[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*\")(?:; [!#$%&'*+.^_`|~0-9A-Za-z-]+=[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*)*",value) is not None,'unsupported','cookie-string')

def scalar(v,ctx):
    if isinstance(v,str): unicode_ok(v); return v
    need(v is None or type(v) in (bool,int,float),'unsupported','scalar-shape')
    need(ctx.get('scalar')=='json','missing-context','scalar-conversion')
    return json.dumps(v,allow_nan=False,separators=(',',':'))

def contributions(p,v,ctx):
    typ=p.get('type'); loc=p['in']; fmt=p.get('collectionFormat','csv')
    need(typ in {'string','number','integer','boolean','array','file'},'unsupported','parameter-type')
    if v is None: vals=[scalar(v,ctx)]
    elif typ=='array':
        need(isinstance(v,list),'unsupported','array-shape'); it=p.get('items')
        need(isinstance(it,dict) and it.get('type') in {'string','number','integer','boolean'},'unsupported','items-type')
        need(fmt in {'csv','ssv','tsv','pipes','multi'} and (fmt!='multi' or loc in {'query','formData'}),'unsupported','collection-format')
        parts=[scalar(x,ctx) for x in v]
        if fmt=='multi': vals=parts or ['']
        else:
            sep={'csv':',','ssv':' ','tsv':'\t','pipes':'|'}[fmt]
            need(all(sep not in x for x in parts),'unsupported','array-delimiter'); vals=[sep.join(parts)]
    else: vals=[scalar(v,ctx)]
    need(loc not in {'query','formData'} or all(x!='' for x in vals) or p.get('allowEmptyValue') is True,'unsupported','empty-not-allowed')
    return vals

def coding(raw,names,encode=False):
    sequence=names if encode else list(reversed(names))
    for name in sequence:
        try:
            if name=='gzip': raw=gzip.compress(raw,mtime=0) if encode else gzip.decompress(raw)
            elif name=='deflate': raw=zlib.compress(raw) if encode else zlib.decompress(raw)
            else: raise Problem('unsupported','content-coding:'+name)
        except (OSError,zlib.error,EOFError): raise Problem('decode-failure','content-coding')
    return raw

class Interpreter:
    def __init__(self,mutation=None): self.mutation=mutation; self.dispatches=0; self.res=None
    def prepare(self,obi,caller,ctx):
        need(obi.get('openbindings')=='0.2.0','invalid','core-version')
        bindings=list(obi.get('bindings',{}).values()); need(len(bindings)==1,'unsupported','bounded-one-binding')
        b=bindings[0]; need(b.get('operation') in obi.get('operations',{}),'invalid','core-operation')
        src=obi.get('sources',{}).get(b.get('source')); need(isinstance(src,dict),'invalid','core-source')
        need(src.get('kind')==KIND,'unsupported','exact-kind'); bc=b.get('content')
        need(isinstance(bc,dict) and set(bc)<={'target','input','output'} and 'target' in bc,'invalid','binding-content')
        for key in ('input','output'):
            if key in bc: mapping_check(bc[key])
        self.res=res=Resolver(ctx); root,retrieval=res.source(src.get('content'))
        tokens=pointer_tokens(bc['target']); need(len(tokens)==3 and tokens[0]=='paths' and tokens[1].startswith('/') and tokens[2] in {'get','put','post','delete','options','head','patch'},'invalid','target-form')
        path,method=tokens[1:]; item=root.get('paths',{}).get(path); need(isinstance(item,dict),'no-target','path-item')
        if '$ref' in item:
            inherited=res.ref(item); need(isinstance(inherited,dict),'invalid','path-item-reference')
            for key in set(item)&set(inherited)-{'$ref'}:
                used=key==method or key=='parameters' and 'parameters' not in item.get(method,inherited.get(method,{}))
                need(not used,'unsupported','path-item-collision')
            item={**inherited,**{k:v for k,v in item.items() if k!='$ref'}}
        op=item.get(method); need(isinstance(op,dict),'no-target','operation')
        responses=op.get('responses'); need(isinstance(responses,dict) and any(k=='default' or re.fullmatch('[1-5][0-9]{2}',k) for k in responses),'invalid','responses-object')
        effective=[]
        for level in (item.get('parameters',[]),op.get('parameters',[])):
            seen=set()
            for raw in level:
                p=res.ref(raw); need(isinstance(p,dict) and isinstance(p.get('name'),str) and p.get('in') in {'path','query','header','formData','body'},'invalid','parameter-declaration')
                ident=(p['name'],p['in']); need(ident not in seen,'invalid','duplicate-parameter'); seen.add(ident)
                effective=[x for x in effective if (x['name'],x['in'])!=ident]+[p]
        bodies=[p for p in effective if p['in']=='body']; forms=[p for p in effective if p['in']=='formData']
        need(len(bodies)<=1 and not(bodies and forms),'unsupported','body-form-conflict')
        paths=[p for p in effective if p['in']=='path']; expr=re.findall(r'\{([^{}]+)\}',path)
        need(set(expr)=={p['name'] for p in paths} and all(p.get('required') is True for p in paths),'invalid','path-parameters')
        for p in effective:
            if p['in']=='header' and (not re.fullmatch(TOKEN,p['name']) or p['name'].lower() in OWNED):
                need(not p.get('required'),'unsupported','required-unavailable-header')
        effective=[p for p in effective if not(p['in']=='header' and (not re.fullmatch(TOKEN,p['name']) or p['name'].lower() in OWNED))]
        value=mapped(bc['input'],[caller]) if 'input' in bc else caller
        if value is ABSENT: value={}
        need(isinstance(value,dict) and set(value)<={'parameters','body'},'unsupported','request-envelope')
        supplied=value.get('parameters',{}); need(isinstance(supplied,dict),'unsupported','parameter-envelope')
        nonbody=[p for p in effective if p['in']!='body']; names=[p['name'] for p in nonbody]; qualified=len(names)!=len(set(names))
        def key(p): return p['in']+'/'+p['name'].replace('~','~0').replace('/','~1') if qualified else p['name']
        need(set(supplied)<={key(p) for p in nonbody},'unsupported','unknown-parameter')
        need('body' not in value or bool(bodies),'unsupported','undeclared-body')
        if bodies: need(not bodies[0].get('required') or 'body' in value,'unsupported','required-body')
        query=[]; heads={}; parts=[]
        for p in nonbody:
            k=key(p); need(not p.get('required') or k in supplied,'unsupported','required-parameter')
            if k not in supplied: continue
            if p.get('type')=='file':
                need(p['in']=='formData','unsupported','file-location'); parts.append((p['name'],base64_octets(supplied[k]),True)); continue
            vals=contributions(p,supplied[k],ctx); loc=p['in']
            if loc=='path':
                path=path.replace('{'+p['name']+'}',urllib.parse.quote(vals[0],safe=',|'+(' ' if False else '')))
            elif loc=='query': query.extend((p['name'],v) for v in vals)
            elif loc=='header':
                name=p['name'].lower(); need(name not in heads,'unsupported','header-collision'); header(p['name'],vals[0]); heads[name]=vals[0]
            elif loc=='formData': parts.extend((p['name'],v.encode('utf-8'),False) for v in vals)
        for k in ('accept','accept-encoding'):
            if k not in heads and k in ctx: header(k,ctx[k]); heads[k]=ctx[k]
        self.security(root,op,ctx,nonbody,supplied,key,query,heads)
        if 'server' in ctx: base=ctx['server']
        else:
            rp=urllib.parse.urlsplit(retrieval or ''); schemes=op.get('schemes',root.get('schemes',[rp.scheme] if rp.scheme else [])); usable=[x for x in schemes if x in ('http','https')]
            scheme=ctx.get('scheme',usable[0] if len(usable)==1 else None); need(scheme in usable,'missing-context','server-scheme')
            host=root.get('host',rp.netloc); need(bool(host),'missing-context','server-host'); bp=root.get('basePath',''); need(not bp or bp.startswith('/'),'invalid','base-path'); base=scheme+'://'+host+bp
        parsed=urllib.parse.urlsplit(base)
        need(parsed.scheme in ('http','https') and parsed.hostname and not parsed.username and not parsed.password and not parsed.query and not parsed.fragment,'unsupported','server-base')
        need('?' not in path and '#' not in path,'unsupported','literal-path-boundary')
        url=base[:-1] if base.endswith('/') else base; url+=path
        if query: url+='?'+urllib.parse.urlencode(query,quote_via=urllib.parse.quote,safe=',|')
        body=b''; mt=None
        if 'body' in value or parts:
            mt=choose_media(op.get('consumes',root.get('consumes',[])),ctx)
            if parts:
                mime,params=media(mt)
                if mime=='application/x-www-form-urlencoded':
                    need(not any(isfile for _,_,isfile in parts),'unsupported','urlencoded-file'); body=urllib.parse.urlencode([(n,v.decode()) for n,v,_ in parts]).encode()
                elif mime=='multipart/form-data':
                    boundary='ob-independent-bounded-boundary'; chunks=[]
                    for n,v,isfile in parts:
                        need(not re.search(r'[\r\n\x00]',n),'unsupported','multipart-name'); name=n.replace('\\','\\\\').replace('"','\\"')
                        pm=ctx.get('file_media','application/octet-stream') if isfile else 'text/plain; charset=UTF-8'; media(pm)
                        chunks.append(('--'+boundary+'\r\nContent-Disposition: form-data; name="'+name+'"\r\nContent-Type: '+pm+'\r\n\r\n').encode()+v+b'\r\n')
                    body=b''.join(chunks)+('--'+boundary+'--\r\n').encode(); mt='multipart/form-data; boundary='+boundary
                else: raise Problem('unsupported','form-media')
            else:
                schema=bodies[0].get('schema'); request_duty(res,schema,value['body']); body=representation(res,schema,mt,value['body'],True)
            heads['content-type']=mt
        if 'content-encoding' in heads:
            need(mt is not None,'unsupported','body-free-content-encoding'); names=self.coding_names(heads['content-encoding']); body=coding(body,names,True)
        need(parsed.scheme=='http','unsupported','https-transport-capability')
        return {'url':url,'method':method.upper(),'headers':heads,'body':body,'op':op,'root':root,'binding':bc}
    def security(self,root,op,ctx,params,supplied,key,query,heads):
        alternatives=op.get('security',root.get('security',[]))
        if not alternatives: return
        definitions=root.get('securityDefinitions',{}); usable=[]
        for index,req in enumerate(alternatives):
            valid=isinstance(req,dict)
            for name,scopes in req.items():
                s=definitions.get(name,{})
                valid &= isinstance(scopes,list) and s.get('type') in {'basic','apiKey','oauth2'}
                if s.get('type')=='apiKey': valid &= s.get('in') in ('query','header') and isinstance(s.get('name'),str) and not(s.get('in')=='header' and s.get('name','').lower() in OWNED|{'content-encoding'})
                if s.get('type')!='oauth2': valid &= scopes==[]
                if s.get('type')=='oauth2': valid &= all(x in s.get('scopes',{}) for x in scopes) and s.get('flow') in {'implicit','password','application','accessCode'}
            claimed=set()
            for name in req:
                scheme=definitions.get(name,{})
                destination=(scheme.get('in'),scheme.get('name')) if scheme.get('type')=='apiKey' else ('header','authorization')
                loc,dest=destination
                if loc=='header' and isinstance(dest,str): dest=dest.lower()
                destination=(loc,dest)
                valid &= destination not in claimed; claimed.add(destination)
                for parameter in params:
                    pn=parameter['name'].lower() if parameter['in']=='header' else parameter['name']
                    if parameter.get('required') and (parameter['in'],pn)==destination: valid=False
            if valid: usable.append((index,req))
        if 'security' in ctx: chosen=[r for i,r in usable if i==ctx['security']]
        else: chosen=[r for i,r in usable] if len(usable)==1 else []
        need(chosen and len(chosen)==1,'missing-context' if usable else 'unsupported','security-choice')
        for name,scopes in chosen[0].items():
            s=definitions[name]; cred=ctx.get('credentials',{}).get(name,ABSENT); need(cred is not ABSENT,'missing-context','credential')
            typ=s['type']; loc='header'; dest='Authorization'
            if typ=='basic':
                need(isinstance(cred,list) and len(cred)==2 and all(isinstance(x,str) and all(32<=ord(c)<=126 for c in x) for x in cred) and ':' not in cred[0],'unsupported','basic-credential')
                val='Basic '+base64.b64encode(':'.join(cred).encode()).decode()
            elif typ=='oauth2':
                need(isinstance(cred,str) and re.fullmatch(r'[A-Za-z0-9\-._~+/]+=*',cred),'unsupported','bearer-token'); val='Bearer '+cred
            else: loc=s['in']; dest=s['name']; val=cred; need(isinstance(val,str),'unsupported','api-key')
            if loc=='query': need(dest not in [k for k,v in query],'unsupported','credential-collision'); query.append((dest,val))
            else:
                dest=dest.lower(); need(dest not in heads,'unsupported','credential-collision'); header(dest,val); heads[dest]=val
    def coding_names(self,value):
        names=[x.strip().lower() for x in value.split(',')]; need(all(re.fullmatch(TOKEN,n) for n in names),'decode-failure','content-coding-grammar'); return names
    def exchange(self,req):
        p=urllib.parse.urlsplit(req['url']); need(p.hostname in {'127.0.0.1','localhost'},'unavailable','invocation-policy')
        self.dispatches+=1
        target=urllib.parse.urlunsplit(('', '',p.path,p.query,''))
        lines=[req['method']+' '+target+' HTTP/1.1','Host: '+p.netloc,'Connection: close','Content-Length: '+str(len(req['body']))]+[k+': '+v for k,v in req['headers'].items()]
        try:
            with socket.create_connection((p.hostname,p.port or 80),timeout=3) as conn:
                conn.sendall(('\r\n'.join(lines)+'\r\n\r\n').encode('utf-8')+req['body']); chunks=[]; total=0
                while True:
                    chunk=conn.recv(65536)
                    if not chunk: break
                    total+=len(chunk); need(total<=2*1024*1024,'unsupported','response-size'); chunks.append(chunk)
            wire=b''.join(chunks)
            while True:
                head,sep,raw=wire.partition(b'\r\n\r\n'); need(sep,'decode-failure','response-framing'); lines=head.split(b'\r\n'); status=int(lines[0].split()[1]); headers=[]
                for line in lines[1:]:
                    name,sep,val=line.partition(b':'); need(sep,'decode-failure','response-field'); headers.append((name.decode('ascii'),val.strip(b' \t').decode('latin1')))
                if 100<=status<200 and status!=101: wire=raw; continue
                break
            fields={}
            for k,v in headers: fields.setdefault(k.lower(),[]).append(v)
            need('transfer-encoding' not in fields,'unsupported','chunked-transport-capability')
            if req['method']=='HEAD' or status in (204,304): need(not raw,'decode-failure','forbidden-content')
            elif 'content-length' in fields: need(len(fields['content-length'])==1 and len(raw)==int(fields['content-length'][0]),'decode-failure','truncated-response')
            return status,headers,raw
        except Problem: raise
        except (OSError,ValueError,UnicodeError) as e: raise Problem('transport-failure',type(e).__name__)
    def complete(self,req,status,headers,raw):
        need(status!=101,'unsupported','upgrade-response')
        if not 200<=status<=299: raise Problem('http-failure','status:'+str(status))
        response=req['op']['responses'].get(str(status),req['op']['responses'].get('default',ABSENT)); need(response is not ABSENT,'decode-failure','missing-response')
        response=self.res.ref(response); need(isinstance(response,dict),'decode-failure','response-object')
        fields={}
        for k,v in headers: fields.setdefault(k.lower(),[]).append(v)
        coding_value=', '.join(fields.get('content-encoding',[])); names=self.coding_names(coding_value) if coding_value else []
        for k,decl in response.get('headers',{}).items():
            if k.lower()=='content-encoding' and coding_value and isinstance(decl,dict) and 'enum' in decl: need(coding_value in decl['enum'],'decode-failure','coding-header-enum')
        if req['method']=='HEAD' or status==204:
            need(not raw,'decode-failure','forbidden-content'); return []
        raw=coding(raw,names)
        if not raw: return []
        need('schema' in response,'decode-failure','missing-response-schema')
        ct=fields.get('content-type',['application/octet-stream']); need(len(ct)==1,'decode-failure','multiple-content-types')
        match_media(req['op'].get('produces',req['root'].get('produces',[])),ct[0])
        value=representation(self.res,response['schema'],ct[0],raw,response_file=True)
        if 'output' in req['binding']: value=mapped(req['binding']['output'],[value])
        return [] if value is ABSENT else [value]
    def run(self,obi,caller=ABSENT,ctx=None):
        ctx=ctx or {}; self.dispatches=0
        try:
            req=self.prepare(obi,caller,ctx)
            need(not ctx.get('cancel_before'),'cancelled','local-cancellation-before-dispatch')
            if self.mutation=='path-data-becomes-separator': req['url']=req['url'].replace('%2F','/')
            if self.mutation=='drop-body-member':
                v=json.loads(req['body']); v.pop('keep',None); req['body']=json.dumps(v).encode()
            if self.mutation=='query-reverse':
                p=urllib.parse.urlsplit(req['url']); req['url']=urllib.parse.urlunsplit((p.scheme,p.netloc,p.path,'&'.join(reversed(p.query.split('&'))),''))
            status,headers,raw=self.exchange(req)
            for attempt in range(3):
                if not(ctx.get('follow') and status in (307,308)): break
                location=next((v for k,v in headers if k.lower()=='location'),None); need(location,'http-failure','redirect-location')
                old=urllib.parse.urlsplit(req['url']); url=urllib.parse.urljoin(req['url'],location); new=urllib.parse.urlsplit(url)
                if (old.scheme,old.hostname,old.port or 80)!=(new.scheme,new.hostname,new.port or 80):
                    secret={'authorization','cookie'}
                    for s in req['root'].get('securityDefinitions',{}).values():
                        if s.get('type')=='apiKey' and s.get('in')=='header': secret.add(s['name'].lower())
                    req['headers']={k:v for k,v in req['headers'].items() if k not in secret}
                req['url']=url; status,headers,raw=self.exchange(req)
            need(not ctx.get('abandon_after_response'),'cancelled','local-abandonment-after-response')
            values=self.complete(req,status,headers,raw)
            if self.mutation=='null-for-absence' and not values: values=[None]
            return {'completion':'success','values':values,'dispatches':self.dispatches,'acquisitions':self.res.fetches}
        except Problem as e: return {'completion':'failure','category':e.category,'reason':e.reason,'values':[],'dispatches':self.dispatches,'acquisitions':self.res.fetches if self.res else []}
