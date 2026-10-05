"""Independently authored bounded OAS 3.1 interpreter, maintained against public r5.

This is executable interpretation evidence, not a production client or a claim
of complete OAS/core conformance. See README for capabilities and exclusions.
"""
import base64
import copy
import codecs
import decimal
import gzip
import hashlib
import http.client
import json
import os
import re
import subprocess
import urllib.error
import urllib.parse as U
import urllib.request
from pathlib import Path

CANDIDATE_SHA256 = 'd7c3a65d9303696f11fb05ac589f098d17d32385d9bcd7534beeb4ec5a57a9a0'
CORE_SHA256 = hashlib.sha256((Path(os.environ.get('SPEC_ROOT', str(Path(__file__).resolve().parents[3]))) / 'openbindings.md').read_bytes()).hexdigest()
KIND = 'openbindings.openapi-3.1@1'
ABSENT = object()
METHODS = {'get','put','post','delete','options','head','patch','trace'}
TOKEN = re.compile(r"[!#$%&'*+.^_`|~0-9A-Za-z-]+\Z")
OWNED = {'host','content-length','connection','keep-alive','proxy-authorization',
         'proxy-connection','te','trailer','transfer-encoding','upgrade'}
IGNORED = {'accept','content-type','authorization'}
BASE_DIALECT = 'https://spec.openapis.org/oas/3.1/dialect/base'
SUPPORTED_DIALECTS = {BASE_DIALECT, 'https://spec.openapis.org/oas/3.1/dialect/2024-11-10'}

class Cannot(Exception):
    def __init__(self, category, detail):
        self.category, self.detail = category, detail
        super().__init__(category + ': ' + detail)

def fail(category, detail):
    raise Cannot(category, detail)

def require(condition, category, detail):
    if not condition:
        fail(category, detail)

def json_text(v):
    if v is None: return 'null'
    if v is True: return 'true'
    if v is False: return 'false'
    if isinstance(v, str):
        require(not any(0xD800 <= ord(c) <= 0xDFFF for c in v), 'unroutable', 'unpaired surrogate')
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, (int, decimal.Decimal)):
        require(not isinstance(v, decimal.Decimal) or v.is_finite(), 'unroutable', 'nonfinite number')
        return str(v)
    if isinstance(v, float):
        return json_text(decimal.Decimal(str(v)))
    if isinstance(v, list): return '[' + ','.join(map(json_text, v)) + ']'
    if isinstance(v, dict):
        require(all(isinstance(k, str) for k in v), 'invalid', 'non-string JSON key')
        return '{' + ','.join(json_text(k) + ':' + json_text(x) for k,x in v.items()) + '}'
    fail('invalid', 'non-JSON value')

def json_value(raw, duplicates=False):
    def pairs(xs):
        d = {}
        for k,v in xs:
            require(duplicates or k not in d, 'invalid', 'duplicate JSON key')
            d[k] = v
        return d
    try:
        v = json.loads(raw, parse_float=decimal.Decimal, object_pairs_hook=pairs,
                       parse_constant=lambda _: fail('invalid', 'nonfinite JSON number'))
        json_text(v)
        return v
    except (ValueError, UnicodeError) as e:
        fail('invalid', 'malformed JSON: ' + str(e))

def scalar(v):
    if v in ('null','Null','NULL','~',''): return None
    if v in ('true','True','TRUE'): return True
    if v in ('false','False','FALSE'): return False
    if re.fullmatch(r'[-+]?[0-9]+', v): return int(v)
    if re.fullmatch(r'0o[0-7]+', v): return int(v[2:], 8)
    if re.fullmatch(r'0x[0-9a-fA-F]+', v): return int(v[2:], 16)
    if re.fullmatch(r'[-+]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?', v):
        return decimal.Decimal(v)
    require(v.lower() not in ('.nan','.inf','+.inf','-.inf'), 'invalid', 'non-JSON YAML scalar')
    return v

def parse_artifact(raw):
    if isinstance(raw, bytes):
        try:
            if raw.startswith((b'\xff\xfe\0\0',b'\0\0\xfe\xff')): raw = raw.decode('utf-32')
            elif raw.startswith((b'\xff\xfe',b'\xfe\xff')): raw = raw.decode('utf-16')
            elif raw[:4:1] == b'\0\0\0{': raw = raw.decode('utf-32-be')
            elif raw[:4:1] == b'{\0\0\0': raw = raw.decode('utf-32-le')
            elif raw[:2] == b'\0{': raw = raw.decode('utf-16-be')
            elif raw[:2] == b'{\0': raw = raw.decode('utf-16-le')
            else: raw = raw.decode('utf-8-sig')
        except UnicodeError: fail('invalid','artifact character encoding')
    require(isinstance(raw, str), 'invalid', 'artifact is not text')
    # JSON is YAML too; the syntax-only tree retains duplicate keys either way.
    p = subprocess.run(['ruby', str(Path(__file__).with_name('yaml_nodes.rb'))],
                       input=raw.encode('utf-8'), capture_output=True)
    require(p.returncode == 0, 'invalid', 'malformed YAML')
    tree = json.loads(p.stdout)
    require(len(tree['children']) == 1, 'invalid', 'multiple/zero YAML documents')
    def value(n, key=False):
        kind, tag = n['kind'], n.get('tag')
        if kind == 'Unsupported': fail('capability', 'YAML aliases unsupported by bounded probe')
        if kind == 'Scalar':
            if key: return n['value']
            v = scalar(n['value']) if n['plain'] else n['value']
            if tag:
                known = {'tag:yaml.org,2002:str':str, 'tag:yaml.org,2002:int':int,
                         'tag:yaml.org,2002:bool':bool, 'tag:yaml.org,2002:null':type(None),
                         'tag:yaml.org,2002:float':decimal.Decimal}
                require(tag in known, 'invalid', 'incompatible explicit tag')
                if tag.endswith(':str'): v = n['value']
                else:
                    v = scalar(n['value'])
                    require(type(v) is known[tag] or (tag.endswith(':float') and type(v) is int),
                            'invalid', 'tag/value mismatch')
            return v
        if kind == 'Sequence':
            require(tag in (None,'tag:yaml.org,2002:seq'), 'invalid', 'non-JSON sequence tag')
            return [value(c) for c in n['children']]
        require(kind == 'Mapping', 'invalid', 'invalid YAML node')
        require(tag in (None,'tag:yaml.org,2002:map'), 'invalid', 'non-JSON mapping tag')
        d, cs = {}, n['children']
        for i in range(0,len(cs),2):
            require(cs[i]['kind'] == 'Scalar', 'invalid', 'non-scalar YAML key')
            k = value(cs[i], key=True)
            require(k not in d, 'invalid', 'duplicate YAML key')
            d[k] = value(cs[i+1])
        return d
    result = value(tree['children'][0]['children'][0])
    json_text(result)
    return result

def pointer_parts(p):
    require(isinstance(p,str) and (p == '' or p.startswith('/')), 'invalid', 'literal JSON pointer required')
    require(not re.search(r'~(?:[^01]|$)',p), 'invalid', 'bad pointer escape')
    return [x.replace('~1','/').replace('~0','~') for x in p.split('/')[1:]]

def at(v,p):
    for k in pointer_parts(p):
        if isinstance(v,dict) and k in v: v = v[k]
        elif isinstance(v,list) and re.fullmatch(r'0|[1-9][0-9]*',k) and int(k) < len(v): v = v[int(k)]
        else: return ABSENT
    return v

# Shared test transport delegates expression semantics to upstream JSONata.
import sys as _sys
_sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'jsonata'))
from jsonata_probe import (validate as _validate_expression, evaluate as _evaluate_expression,
    InvalidExpression, EvaluationFailure, NumericLimit)

def check_mapping(expression):
    try: _validate_expression(expression)
    except InvalidExpression as exc: raise Cannot('invalid', str(exc)) from exc

def mapping(expression, value):
    try: return _evaluate_expression(expression, value, ABSENT)
    except InvalidExpression as exc: raise Cannot('invalid', str(exc)) from exc
    except EvaluationFailure as exc: raise Cannot('mapping', str(exc)) from exc
    except NumericLimit as exc: raise Cannot('unsupported', str(exc)) from exc

def esc(s): return s.replace('~','~0').replace('/','~1')
def pct(s): return U.quote(s,safe='-._~')

class Resolver:
    def __init__(self):
        self.docs = {}
        self.requests = []
        self.schema_resources = {}
        self.schema_bases = {}
        self.schema_dialects = {}
        self.anchors = {}

    def fetch(self,url):
        require(bool(U.urlsplit(url).scheme), 'context', 'relative reference has no retrieval base')
        self.requests.append(url)
        try:
            with urllib.request.urlopen(url, timeout=3) as f:
                result, final = parse_artifact(f.read()), f.geturl()
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            fail('unavailable',str(e))
        self.register(result,final)
        self.docs[url] = result
        return result,final

    def register_schema(self,s,base,dialect=BASE_DIALECT):
        if not isinstance(s,dict): return
        dialect = s.get('$schema',dialect)
        self.schema_dialects[id(s)] = dialect
        if '$id' in s:
            base = U.urljoin(base or '', s['$id'])
            self.schema_resources[U.urldefrag(base)[0]] = s
        self.schema_bases[id(s)] = base
        if '$anchor' in s: self.anchors[(U.urldefrag(base or '')[0],s['$anchor'])] = s
        for key in ('properties','patternProperties','$defs','dependentSchemas'):
            for c in s.get(key,{}).values(): self.register_schema(c,base,dialect)
        for key in ('items','additionalProperties','not','if','then','else','contains'):
            if key in s: self.register_schema(s[key],base,dialect)
        for key in ('allOf','anyOf','oneOf','prefixItems'):
            for c in s.get(key,[]): self.register_schema(c,base,dialect)

    def register(self,doc,base):
        self.docs[base or ''] = doc
        if not isinstance(doc,dict): return
        if 'openapi' not in doc:
            # External schemas are registered in schema-reference context below.
            return
        dialect = doc.get('jsonSchemaDialect',BASE_DIALECT)
        for s in doc.get('components',{}).get('schemas',{}).values(): self.register_schema(s,base,dialect)
        # Only schema positions, not arbitrary x-/example/literal embeddings.
        def obj(o):
            if not isinstance(o,dict): return
            if 'schema' in o: self.register_schema(o['schema'],base,dialect)
            for p in o.get('parameters',[]): obj(p)
            for m in o.get('content',{}).values(): obj(m)
            for h in o.get('headers',{}).values(): obj(h)
            if 'requestBody' in o: obj(o['requestBody'])
            for r in o.get('responses',{}).values(): obj(r)
        for pi in doc.get('paths',{}).values():
            if isinstance(pi,dict):
                obj(pi)
                for method in METHODS: obj(pi.get(method))
        for section in ('parameters','requestBodies','responses','headers'):
            for o in doc.get('components',{}).get(section,{}).values(): obj(o)

    def source(self,content):
        require(isinstance(content,dict) and bool(content) and set(content)<={'document','location'},
                'invalid','source content shape')
        base = content.get('location')
        if 'location' in content:
            require(isinstance(base,str) and bool(U.urlsplit(base).scheme), 'invalid','absolute location required')
            require(not U.urlsplit(base).fragment, 'invalid','source location must identify a whole document')
            base = U.urldefrag(base)[0]
        if 'document' in content:
            d = content['document']
            require(isinstance(d,(dict,str)), 'invalid','document must be object/text')
            d = parse_artifact(d) if isinstance(d,str) else d
            self.register(d,base)
        else: d,base = self.fetch(base)
        require(isinstance(d,dict), 'invalid','entry artifact must be object')
        require(d.get('openapi') in ('3.1.0','3.1.1','3.1.2'), 'invalid','patch admission')
        return d,base

    def ref(self,ref,base,schema=False):
        require(isinstance(ref,str),'invalid','reference string')
        uri = U.urljoin(base or '',ref)
        resource, fragment = U.urldefrag(uri)
        if not resource: resource = U.urldefrag(base or '')[0]
        if schema and resource in self.schema_resources: root = self.schema_resources[resource]
        elif resource in self.docs: root = self.docs[resource]
        else: root,_ = self.fetch(resource)
        if schema and isinstance(root,dict) and 'openapi' not in root and id(root) not in self.schema_dialects:
            self.register_schema(root,resource)
        fragment = U.unquote(fragment)
        if fragment == '' or fragment.startswith('/'): out = at(root,fragment)
        elif schema: out = self.anchors.get((resource,fragment),ABSENT)
        else: fail('invalid','non-schema reference requires pointer')
        require(out is not ABSENT,'unavailable','reference has no target')
        return out, self.schema_bases.get(id(out),resource) if schema else resource

    def deref(self,o,base):
        seen = set()
        while isinstance(o,dict) and '$ref' in o:
            marker = (base,o['$ref'])
            require(marker not in seen,'capability','nonproductive reference cycle')
            seen.add(marker)
            o,base = self.ref(o['$ref'],base)
        return o,base

    def inspect(self,s,base,seen=()):
        if s is False: fail('unroutable','false inspected schema')
        if s is True or s is None: return {}
        require(isinstance(s,dict),'invalid','schema shape')
        base = self.schema_bases.get(id(s),base)
        require(s.get('$schema',self.schema_dialects.get(id(s),BASE_DIALECT)) in SUPPORTED_DIALECTS,'capability','unsupported schema dialect')
        require('$dynamicRef' not in s,'capability','static dynamicRef unavailable')
        require(id(s) not in seen,'capability','static schema cycle')
        seen = seen+(id(s),)
        results = [{k:v for k,v in s.items() if k not in ('$ref','allOf','anyOf','oneOf')}]
        if '$ref' in s:
            r,rb = self.ref(s['$ref'],base,schema=True)
            results.append(self.inspect(r,rb,seen))
        results += [self.inspect(x,base,seen) for x in s.get('allOf',[])]
        for key in ('anyOf','oneOf'):
            if key in s:
                arms = []
                for x in s[key]:
                    try: arms.append(self.inspect(x,base,seen))
                    except Cannot as e:
                        if e.detail not in ('false inspected schema','empty type intersection'): raise
                arms = [x for x in arms if x.get('type') not in ('null',['null'])]
                require(bool(arms),'unroutable','only null candidates')
                require(all(x==arms[0] for x in arms), 'capability','needed union declarations disagree')
                results.append(arms[0])
        out,types = {},None
        for r in results:
            if 'type' in r:
                ts = set(r['type'] if isinstance(r['type'],list) else [r['type']])
                if 'number' in ts: ts.add('integer')
                types = ts if types is None else types & ts
            for k,v in r.items():
                if k in ('type','$id','$schema','$anchor','description','title'): continue
                if k in out and out[k] != v: fail('capability','combined member declarations disagree: '+k)
                out[k] = v
        if types is not None:
            require(bool(types),'unroutable','empty type intersection')
            if 'number' in types: types.discard('integer')
            if types != {'null'}: types.discard('null')
            if len(types)==1: out['type'] = next(iter(types))
            elif len(types)>1: fail('capability','no unique needed type')
        return out

def media_identity(s):
    require(isinstance(s,str),'invalid','media string')
    # Bounded parser: quoted parameter values without embedded semicolons.
    parts = s.split(';')
    ty = parts.pop(0).strip().lower()
    require(re.fullmatch(r'[\w!#$&^.+*-]+/[\w!#$&^.+*-]+',ty) is not None,'invalid','media type')
    ps = {}
    for p in parts:
        require('=' in p,'invalid','media parameter')
        k,v = p.split('=',1); k,v = k.strip().lower(),v.strip().strip('"')
        require(k not in ps,'invalid','duplicate media parameter')
        ps[k] = v.lower() if k=='charset' else v
    return ty,ps

def choose_media(content,choice=None):
    require(isinstance(content,dict),'invalid','content map')
    parsed = []
    for k,v in content.items():
        try: parsed.append((k,v,media_identity(k)))
        except Cannot: pass
    counts = {}
    for _,_,(t,p) in parsed:
        ident = (t,tuple(sorted(p.items())))
        counts[ident] = counts.get(ident,0)+1
    parsed = [x for x in parsed if counts[(x[2][0],tuple(sorted(x[2][1].items())))]==1]
    if choice is None:
        require(len(parsed)==1 and '*' not in parsed[0][2][0], 'context','request media choice')
        choice = parsed[0][0]
    ct,cp = media_identity(choice)
    require('*' not in ct,'context','concrete media choice required')
    matches = []
    for k,v,(t,p) in parsed:
        if (t==ct or t=='*/*' or t.endswith('/*') and t.split('/')[0]==ct.split('/')[0]) and all(cp.get(n)==x for n,x in p.items()):
            matches.append(((2 if t==ct else 0 if t=='*/*' else 1,len(p)),v))
    require(bool(matches),'unroutable','unmatched media')
    top = max(x[0] for x in matches)
    values = [v for rank,v in matches if rank==top]
    require(len(values)==1,'unroutable','ambiguous media')
    return choice,values[0]

def valid_field(name,value):
    require(isinstance(name,str) and TOKEN.fullmatch(name),'unroutable','HTTP field name')
    require(isinstance(value,str) and value==value.strip(' \t') and
            all(ord(c)>=32 or c=='\t' for c in value) and '\x7f' not in value,
            'unroutable','HTTP field value')
    return value

def valid_cookie(name,value):
    require(TOKEN.fullmatch(name) is not None,'unroutable','cookie name')
    val = value[1:-1] if value.startswith('"') and value.endswith('"') else value
    require(all(ord(c)==33 or 35<=ord(c)<=43 or 45<=ord(c)<=58 or 60<=ord(c)<=91 or 93<=ord(c)<=126 for c in val),
            'unroutable','cookie value')

def convert(v,ctx):
    if isinstance(v,str): return v
    require(v is not None and not isinstance(v,(list,dict)), 'unroutable','undefined/nested member')
    require('scalar' in ctx,'context','scalar conversion required')
    x = ctx['scalar'](v)
    require(isinstance(x,str),'context','converter must return string')
    return x

def serialize_parameter(p,v,ctx,uri=True):
    name,loc = p['name'],p['in']
    style = p.get('style','form' if loc in ('query','cookie') else 'simple')
    explode = p.get('explode',style=='form')
    allowed = {'path':{'simple','label','matrix'},'query':{'form','spaceDelimited','pipeDelimited','deepObject'},
               'header':{'simple'},'cookie':{'form'}}
    require(style in allowed.get(loc,set()),'capability','unsupported parameter style')
    reserved = p.get('allowReserved',False) and loc=='query'
    def enc(x):
        x = convert(x,ctx)
        if not uri or loc=='header': return x
        if reserved:
            x = re.sub(r'%(?![0-9a-fA-F]{2})','%25',x)
            return U.quote(x,safe="-._~:/?@!$'()*,;%")
        return pct(x)
    n = pct(name) if uri and loc!='header' else name
    undefined = v is None or v==[] or v=={}
    if style in ('spaceDelimited','pipeDelimited','deepObject'):
        require(not undefined,'unroutable','undefined serialization cell')
    if style in ('spaceDelimited','pipeDelimited'):
        require(not explode and isinstance(v,(list,dict)),'unroutable','unsupported delimited cell')
        values = v if isinstance(v,list) else [z for k,x in v.items() for z in (k,x)]
        delim = ' ' if style=='spaceDelimited' else '|'
        require(all(delim not in convert(x,ctx) for x in values),'unroutable','structural separator in value')
        return [(n,('%20' if delim==' ' else '%7C').join(enc(x) for x in values))]
    if style=='deepObject':
        require(explode and isinstance(v,dict),'unroutable','unsupported deepObject cell')
        require(all('[' not in k and ']' not in k for k in v),'unroutable','deepObject structural key')
        return [(pct(name+'['+k+']'),enc(x)) for k,x in v.items()]
    if loc=='cookie' and isinstance(v,(list,dict)):
        require(len(v)<=1,'unroutable','multiple logical cookie values')
    if undefined:
        if style=='form': return [] if isinstance(v,(list,dict)) else [(n,'')]
        return ''
    elif isinstance(v,list):
        xs=[enc(x) for x in v]; plain=','.join(xs)
        pairs=[(n,x) for x in xs] if explode else [(n,plain)]
    elif isinstance(v,dict):
        pairs=[(enc(k),enc(x)) for k,x in v.items()]
        plain=','.join(k+'='+x for k,x in pairs) if explode else ','.join(z for pair in pairs for z in pair)
        if not explode: pairs=[(n,plain)]
    else: plain=enc(v); pairs=[(n,plain)]
    if style=='form': return pairs
    if style=='simple': return plain
    if style=='label':
        if explode and isinstance(v,list): plain='.'.join(enc(x) for x in v)
        if explode and isinstance(v,dict): plain='.'.join(k+'='+x for k,x in pairs)
        return '.'+plain
    if undefined: return ';'+n
    if explode: return ''.join(';'+k+('='+x if x else '') for k,x in pairs)
    return ';'+n+('='+plain if plain else '')

class Interpreter:
    def __init__(self,resolver=None):
        self.r = resolver or Resolver()
        # Runtime capabilities and an internal legal serialization choice.
        self.xml_codecs={'utf-8','utf-16','utf-16-le','utf-16-be','iso8859-1','ascii'}
        self.content_uri_all_bytes=False

    def xml_media(self,value,parameters,decode):
        """Character encoding only: never parse elements or expand XML entities."""
        def declaration(text):
            m=re.match(r'''<\?xml\s+[^?]*\bencoding\s*=\s*(["'])([A-Za-z][A-Za-z0-9._-]*)\1''',text)
            return m[2] if m else None
        def supported(label):
            try:canonical=codecs.lookup(label).name
            except LookupError:fail('capability','XML codec unavailable: '+label)
            require(canonical in self.xml_codecs,'capability','XML codec unavailable: '+label)
            return canonical
        if decode:
            # Longest signatures first: UTF-32LE must not be mistaken for UTF-16LE.
            signatures=[(b'\xff\xfe\0\0','utf-32-le'),(b'\0\0\xfe\xff','utf-32-be'),
                        (b'\xef\xbb\xbf','utf-8'),(b'\xff\xfe','utf-16-le'),(b'\xfe\xff','utf-16-be')]
            bom=next(((sig,enc) for sig,enc in signatures if value.startswith(sig)),None)
            if bom:
                sig,enc=bom;value=value[len(sig):];codec=supported(enc)
            elif 'charset' in parameters:codec=supported(parameters['charset'])
            else:
                # The bounded reader recognizes non-ASCII signatures but does
                # not guess a default UTF-8 interpretation of their NUL bytes.
                signature=next((enc for prefix,enc in [(b'\0<\0?','utf-16-be'),(b'<\0?\0','utf-16-le'),
                    (b'\0\0\0<','utf-32-be'),(b'<\0\0\0','utf-32-le')] if value.startswith(prefix)),None)
                if signature:
                    initial=supported(signature)
                    try:prologue=value.decode(initial)
                    except UnicodeError:fail('unroutable','invalid XML character bytes')
                    declared=declaration(prologue)
                    require(declared is not None,'capability','XML non-UTF8 signature without supported declaration')
                    codec=supported(declared)
                else:
                    # Encoding pseudo-attribute is ASCII in the supported 8-bit
                    # encodings; undecoded later bytes never replace characters.
                    prologue=value.split(b'?>',1)[0].decode('ascii',errors='ignore')
                    codec=supported(declaration(prologue) or 'utf-8')
            try:return value.decode(codec)
            except UnicodeError:fail('unroutable','invalid XML character bytes')
        require(isinstance(value,str),'unroutable','XML media needs string')
        declared=declaration(value)
        codec=supported(parameters.get('charset') or declared or 'utf-8')
        # Producer declarations are preserved. For conflicting indications this
        # bounded producer declines instead of changing markup or guessing.
        if declared and 'charset' in parameters:
            dc=supported(declared)
            compatible=dc==codec or (dc=='utf-16' and codec in ('utf-16-le','utf-16-be'))
            require(compatible,'capability','conflicting XML producer encoding indications')
        try:return value.encode(codec)
        except UnicodeError:fail('unroutable','XML characters unrepresentable in chosen codec')

    def media(self,value,mt,decl,base,ctx,decode=False,form_scalar=False):
        ty,ps=media_identity(mt)
        if ty=='application/json' or ty.endswith('+json'):
            if decode: return json_value(value.decode('utf-8-sig'),duplicates=True)
            return json_text(value).encode('utf-8')
        require(ty!='application/x-www-form-urlencoded' and not ty.startswith('multipart/'),
                'capability','form response or missing property correspondence')
        s=self.r.inspect(decl.get('schema'),base)
        t=s.get('type')
        if form_scalar and ty=='text/plain' and t in ('integer','number','boolean'):
            return json_text(value).encode('utf-8')
        if t=='string' and (ty in ('application/xml','text/xml') or ty.endswith('+xml')):
            return self.xml_media(value,ps,decode)
        if t=='string' and (ty.startswith('text/') or 'contentEncoding' in s):
            charset=ps.get('charset','utf-8')
            require(charset.lower() in ('utf-8','utf8'),'capability','only UTF-8 codec supported')
            if decode:
                try:return value.decode('utf-8')
                except UnicodeError:fail('unroutable','invalid UTF-8')
            require(isinstance(value,str),'unroutable','string media needs string')
            return value.encode('utf-8')
        if t is None:
            if decode:return base64.b64encode(value).decode('ascii')
            require(isinstance(value,str),'unroutable','raw carriage needs Base64 string')
            try:b=base64.b64decode(value,validate=True)
            except (ValueError,TypeError):fail('unroutable','invalid Base64')
            require(base64.b64encode(b).decode()==value,'unroutable','noncanonical Base64')
            return b
        fail('capability','unsupported media/declaration')

    def forms(self,value,mt,decl,base,ctx):
        require(isinstance(value,dict),'unroutable','form body requires object')
        schema=self.r.inspect(decl.get('schema'),base)
        require(schema.get('type')=='object','capability','form object declaration required')
        multipart=media_identity(mt)[0].startswith('multipart/')
        pairs,parts=[],[]
        required=schema.get('required',[])
        for name in required: require(name in value,'unroutable','required form property')
        for name,v in value.items():
            governing=[]
            if name in schema.get('properties',{}): governing.append(schema['properties'][name])
            matches=[s for pat,s in schema.get('patternProperties',{}).items() if re.search(pat,name)]
            governing += matches
            if not governing: governing=[schema.get('additionalProperties',{})]
            ps=self.r.inspect(governing[0] if len(governing)==1 else {'allOf':governing},base)
            en=decl.get('encoding',{}).get(name,{})
            style=media_identity(mt)[0] in ('application/x-www-form-urlencoded','multipart/form-data') and any(k in en for k in ('style','explode','allowReserved'))
            if style:
                p={'name':name,'in':'query',**{k:x for k,x in en.items() if k in ('style','explode','allowReserved')}}
                items=serialize_parameter(p,v,ctx,uri=not multipart)
                require(isinstance(items,list),'capability','form style must produce named values')
                if multipart: parts += [(n,x.encode('utf-8'),{}) for n,x in items]
                else: pairs += items
                continue
            typ=ps.get('type')
            item=self.r.inspect(ps.get('items'),base) if typ=='array' else ps
            deftyp=item.get('type')
            default='application/octet-stream' if deftyp is None or (deftyp=='string' and 'contentEncoding' in item) else 'application/json' if deftyp=='object' else 'text/plain'
            alternatives={x.strip():{} for x in en.get('contentType',default).split(',')}
            chosen,_=choose_media(alternatives,ctx.get('property_media',{}).get(name))
            expanded=multipart and typ=='array' and isinstance(v,list)
            vals=v if expanded else [v]
            for val in vals:
                chosen_type=media_identity(chosen)[0]
                if val is None and not(chosen_type=='application/json' or chosen_type.endswith('+json')):
                    require(not expanded and name not in required,'unroutable','null has no selected media correspondence')
                    continue
                payload=self.media(val,chosen,{'schema':item if expanded else ps},base,ctx,form_scalar=True)
                if not multipart: pairs.append((pct(name),U.quote_from_bytes(payload,safe='-._~'))); continue
                hs={'Content-Type':chosen}
                for hn,hd in en.get('headers',{}).items():
                    if hn.lower()=='content-type': continue
                    hd,hb=self.r.deref(hd,base)
                    if 'schema' not in hd:
                        require(not hd.get('required'),'capability','required part header not fixed')
                        continue
                    sch=self.r.inspect(hd.get('schema'),hb)
                    fixed=sch.get('const',ABSENT)
                    if fixed is ABSENT and len(sch.get('enum',[]))==1: fixed=sch['enum'][0]
                    if fixed is ABSENT or not isinstance(fixed,str):
                        require(not hd.get('required'), 'capability','required part header not fixed'); continue
                    if 'enum' in sch: require(fixed in sch['enum'],'unroutable','fixed part header enum')
                    valid_field(hn,fixed)
                    existing=next((k for k in hs if k.lower()==hn.lower()),None)
                    require(existing is None or hs[existing]==fixed,'unroutable','part header collision')
                    hs[hn]=fixed
                transfer=next((v for k,v in hs.items() if k.lower()=='content-transfer-encoding'),None)
                if transfer is not None:
                    carried=item if multipart and typ=='array' else ps
                    require(carried.get('type')=='string' and transfer==carried.get('contentEncoding'),
                            'unroutable','transfer encoding requires transformation or disagrees')
                parts.append((name,payload,hs))
        if not multipart: return '&'.join(k+'='+v for k,v in pairs).encode(),mt
        boundary='independent-'+hashlib.sha256(json_text(value).encode()).hexdigest()[:20]
        out=b''
        for name,payload,hs in parts:
            require('\r' not in name and '\n' not in name,'unroutable','part name')
            require('content-disposition' not in {k.lower() for k in hs},'capability','fixed disposition outside probe')
            disp='form-data; name="'+name.replace('\\','\\\\').replace('"','\\"')+'"'
            headers={'Content-Disposition':disp,**hs}
            out += ('--'+boundary+'\r\n').encode()
            out += ''.join(k+': '+v+'\r\n' for k,v in headers.items()).encode('utf-8')
            out += b'\r\n'+payload+b'\r\n'
        out += ('--'+boundary+'--\r\n').encode()
        return out,media_identity(mt)[0]+'; boundary='+boundary

    def prepare(self,obi,binding,value=ABSENT,ctx=None):
        ctx=ctx or {}
        require(obi.get('openbindings')=='0.2.0','invalid','probe supports current 0.2.0 core')
        b=obi['bindings'][binding]
        require(b['operation'] in obi['operations'],'invalid','binding operation key')
        src=obi['sources'][b['source']]
        require(src.get('kind')==KIND,'capability','exact kind not supported')
        c=b.get('content')
        require(isinstance(c,dict) and 'target' in c and set(c)<={'target','input','output'},'invalid','binding content')
        for key in ('input','output'):
            if key in c: check_mapping(c[key])
        toks=pointer_parts(c['target'])
        require(len(toks)==3 and toks[0]=='paths' and toks[1].startswith('/') and toks[2] in METHODS,
                'invalid','operation target form')
        doc,base=self.r.source(src.get('content'))
        path,method=toks[1:]
        pi=doc.get('paths',{}).get(path,ABSENT)
        require(isinstance(pi,dict),'no-target','missing path item')
        origins={k:base for k in pi}
        if '$ref' in pi:
            inherited,ib=self.r.ref(pi['$ref'],base)
            inherited,ib=self.r.deref(inherited,ib)
            require(isinstance(inherited,dict),'unavailable','referenced Path Item shape')
            provisional=pi.get(method,inherited.get(method,{}))
            needed={method}
            if 'servers' not in provisional or not provisional['servers']: needed.add('servers')
            needed.add('parameters')
            require(not (set(pi)&set(inherited)&needed),'unavailable','ambiguous Path Item adjacent field')
            origins={**{k:ib for k in inherited},**origins}
            pi={**inherited,**pi}
        op=pi.get(method)
        require(isinstance(op,dict),'no-target','missing operation')
        obase=origins.get(method,base)
        req=mapping(c['input'],value) if 'input' in c else value
        if req is ABSENT: req={}
        require(isinstance(req,dict) and set(req)<={'parameters','body'},'unroutable','request envelope')
        supplied=req.get('parameters',{})
        require(isinstance(supplied,dict),'unroutable','parameters shape')
        effective={}
        for group,gb in ((pi.get('parameters',[]),origins.get('parameters',base)),(op.get('parameters',[]),obase)):
            for p in group:
                p,pb=self.r.deref(p,gb)
                require(isinstance(p,dict) and isinstance(p.get('name'),str) and p.get('in') in ('path','query','header','cookie'),
                        'invalid','parameter declaration')
                effective[(p['in'],p['name'])]=(p,pb)
        projections=[]
        for (loc,name),(p,pb) in effective.items():
            if loc=='header' and name.lower() in IGNORED: continue
            unavailable=(loc=='header' and (not TOKEN.fullmatch(name) or name.lower() in OWNED)) or (loc=='cookie' and not TOKEN.fullmatch(name))
            if unavailable:
                require(not p.get('required'),'capability','required unavailable projection'); continue
            projections.append((loc,name,p,pb))
        names=[x[1] for x in projections]; qualify=len(names)!=len(set(names))
        keys={(loc+'/'+esc(n) if qualify else n):(loc,n,p,pb) for loc,n,p,pb in projections}
        require(set(supplied)<=set(keys),'unroutable','unknown parameter key')
        hs,query,cookies={},[],[]
        owners={'header':set(),'query':set(),'cookie':set()}
        def add(loc,n,v):
            nn=n.lower() if loc=='header' else n
            require(nn not in owners[loc],'unroutable','contribution collision')
            owners[loc].add(nn)
            if loc=='header': hs[n]=valid_field(n,v)
            elif loc=='query': query.append((pct(n),pct(v)))
            else: valid_cookie(n,v); cookies.append((n,v))
        for k,(loc,name,p,pb) in keys.items():
            require(k in supplied or not p.get('required',loc=='path'),'unroutable','missing required parameter')
            if k not in supplied:continue
            v=supplied[k]
            if 'content' in p:
                require('schema' not in p and len(p['content'])==1,'invalid','parameter content alternative')
                mt,md=next(iter(p['content'].items()))
                val=self.media(v,mt,md,pb,ctx)
                if loc in ('path','query'):
                    encoded=''.join('%'+format(b,'02X') for b in val) if self.content_uri_all_bytes else U.quote_from_bytes(val,safe='-._~')
                else:encoded=val.decode('utf-8')
                contribution=[(pct(name),encoded)] if loc in ('query','cookie') else encoded
            else:
                require('schema' in p,'invalid','parameter requires schema/content')
                contribution=serialize_parameter(p,v,ctx)
            if loc=='path':
                require('{'+name+'}' in path,'unroutable','path parameter without placeholder')
                path=path.replace('{'+name+'}',contribution)
            elif loc=='header':add('header',name,contribution)
            else:
                current=[]
                for kn,kv in contribution:
                    native_name=U.unquote(kn)
                    require(native_name not in owners[loc],'unroutable','expanded parameter collision')
                    current.append(native_name)
                    if loc=='cookie':valid_cookie(native_name,kv); cookies.append((native_name,kv))
                    else:query.append((kn,kv))
                owners[loc].update(current)
        require('{' not in path and '}' not in path,'unroutable','unresolved path variable')
        if 'server' in ctx: server=ctx['server']
        else:
            servers=op.get('servers') or pi.get('servers') or doc.get('servers') or [{'url':'/'}]
            require(len(servers)==1 or 'server_index' in ctx,'context','server alternative choice')
            server=servers[ctx.get('server_index',0)]['url']
            declared=servers[ctx.get('server_index',0)].get('variables',{})
            for var in re.findall(r'\{([^}]+)\}',server):
                val=ctx.get('variables',{}).get(var,declared.get(var,{}).get('default',ABSENT))
                require(val is not ABSENT,'context','server variable')
                require(isinstance(val,str) and ('enum' not in declared.get(var,{}) or val in declared[var]['enum']),
                        'unroutable','server variable enum')
                server=server.replace('{'+var+'}',val)
            sb=obase if op.get('servers') else origins.get('servers',base) if pi.get('servers') else base
            if not U.urlsplit(server).scheme:
                require(bool(sb),'context','relative server base unavailable')
                server=U.urljoin(sb,server)
        us=U.urlsplit(server)
        require(us.scheme in ('http','https') and bool(us.hostname) and not us.username and not us.password and not us.query and not us.fragment,
                'unroutable','invalid server base')
        security=op.get('security',doc.get('security',[]))
        if security:
            require(len(security)==1 or 'security_index' in ctx,'context','security alternative choice')
            selected=security[ctx.get('security_index',0)]
            for name in selected:
                scheme=doc.get('components',{}).get('securitySchemes',{}).get(name)
                require(isinstance(scheme,dict),'capability','missing security component')
                cred=ctx.get('credentials',{}).get(name,ABSENT)
                require(cred is not ABSENT,'context','credential missing')
                if scheme.get('type')=='apiKey':
                    loc,n=scheme.get('in'),scheme.get('name')
                    require(loc in ('header','query','cookie') and isinstance(n,str),'capability','malformed API key')
                    require(not(loc=='header' and n.lower() in OWNED|{'content-type','content-encoding'}),'capability','credential transport field')
                    add(loc,n,cred)
                elif scheme.get('type')=='http' and scheme.get('scheme','').lower() in ('basic','bearer'):
                    if scheme['scheme'].lower()=='basic':
                        user,password=cred
                        require(':' not in user and all(32<=ord(x)<=126 for x in user+password),'unroutable','Basic credential grammar')
                        h='Basic '+base64.b64encode((user+':'+password).encode()).decode()
                    else:
                        require(re.fullmatch(r'[A-Za-z0-9\-._~+/]+=*',cred) is not None,'unroutable','Bearer grammar')
                        h='Bearer '+cred
                    add('header','Authorization',h)
                else:fail('capability','unsupported security scheme in bounded probe')
        raw_cookie=next((v for k,v in hs.items() if k.lower()=='cookie'),None)
        require(not(raw_cookie is not None and cookies),'unroutable','raw/structured Cookie collision')
        if raw_cookie is not None:
            for p in raw_cookie.split('; '):
                require('=' in p,'unroutable','raw Cookie grammar')
                n,v=p.split('=',1);valid_cookie(n,v)
        if cookies: hs['Cookie']='; '.join(n+'='+v for n,v in cookies)
        if method=='trace':
            require('body' not in req,'unroutable','TRACE body')
            require(not any(k.lower() in ('authorization','cookie') for k in hs),'unroutable','TRACE sensitive field')
        body=None
        rb=op.get('requestBody')
        if rb is not None:rb,rbb=self.r.deref(rb,obase)
        if method!='trace':
            require('body' in req or not (rb or {}).get('required'),'unroutable','required body')
        if 'body' in req:
            require(isinstance(rb,dict),'unroutable','body undeclared')
            mt,md=choose_media(rb.get('content',{}),ctx.get('media'))
            if media_identity(mt)[0]=='application/x-www-form-urlencoded' or mt.lower().startswith('multipart/'):
                body,mt=self.forms(req['body'],mt,md,rbb,ctx)
            else: body=self.media(req['body'],mt,md,rbb,ctx)
            hs['Content-Type']=mt
        coding=next((v for k,v in hs.items() if k.lower()=='content-encoding'),None)
        if coding is not None:
            require(body is not None,'unroutable','Content-Encoding without body')
            for codec in coding.split(','):
                require(codec.strip().lower()=='gzip','capability','only gzip supported')
                body=gzip.compress(body)
        url=(server[:-1] if server.endswith('/') else server)+path
        if query:url+='?'+'&'.join(k+'='+v for k,v in query)
        return {'method':method.upper(),'url':url,'headers':hs,'body':body,'op':op,'base':obase,'binding':c}

    def complete(self,request,status,headers,body,complete=True):
        if not complete:return {'success':False,'outputs':[],'reason':'truncated'}
        if status==101:return {'success':False,'outputs':[],'reason':'unsupported upgrade'}
        if not 200<=status<300:return {'success':False,'outputs':[],'reason':'HTTP failure'}
        try:
            hs={}
            for k,v in headers:
                valid_field(k,v);hs.setdefault(k.lower(),[]).append(v)
            op=request['op']; responses=op.get('responses',ABSENT)
            rd={}
            if responses is not ABSENT:
                require(any(k=='default' or re.fullmatch(r'[1-5](?:[0-9]{2}|XX)',k) for k in responses),'invalid','empty Responses Object')
                key=next((k for k in (str(status),str(status//100)+'XX','default') if k in responses),None)
                if key is not None: rd,rb=self.r.deref(responses[key],request['base'])
                else:rb=request['base']
                require(isinstance(rd,dict),'invalid','governing response declaration')
            else:rb=request['base']
            for name,hd in rd.get('headers',{}).items():
                if name.lower()=='content-type':continue
                hd,hb=self.r.deref(hd,rb)
                require(not hd.get('required') or name.lower() in hs,'unroutable','required response header')
                if name.lower()=='content-encoding' and name.lower() in hs:
                    s=self.r.inspect(hd.get('schema'),hb)
                    actual=', '.join(hs[name.lower()])
                    require('const' not in s or s['const']==actual,'unroutable','coding const')
                    require('enum' not in s or actual in s['enum'],'unroutable','coding enum')
            no_content=request['method']=='HEAD' or status in (204,205)
            if no_content:
                require(not body,'unroutable','forbidden content')
                return {'success':True,'outputs':[]}
            for codec in reversed(','.join(hs.get('content-encoding',[])).split(',')):
                if not codec:continue
                require(codec.strip().lower()=='gzip','capability','response codec unavailable')
                body=gzip.decompress(body)
            if not body:return {'success':True,'outputs':[]}
            ct=hs.get('content-type',['application/octet-stream'])
            require(len(ct)==1,'unroutable','multiple Content-Type values')
            mt,md=choose_media(rd.get('content',{}),ct[0])
            output=self.media(body,mt,md,rb,{},decode=True)
            if 'output' in request['binding']:output=mapping(request['binding']['output'],output)
            return {'success':True,'outputs':[] if output is ABSENT else [output]}
        except (Cannot,ValueError,UnicodeError,OSError,EOFError) as e:
            return {'success':False,'outputs':[],'reason':str(e)}

    def invoke(self,obi,binding,value=ABSENT,ctx=None):
        r=self.prepare(obi,binding,value,ctx)
        u=U.urlsplit(r['url'])
        connection=(http.client.HTTPSConnection if u.scheme=='https' else http.client.HTTPConnection)(u.hostname,u.port,timeout=3)
        target=u.path or '/'
        if u.query:target+='?'+u.query
        try:
            connection.request(r['method'],target,r['body'],{k:v.encode('utf-8') for k,v in r['headers'].items()})
            response=connection.getresponse()
            try:body=response.read();complete=True
            except http.client.IncompleteRead as e:body=e.partial;complete=False
            return self.complete(r,response.status,response.getheaders(),body,complete)
        finally:connection.close()

def synthesize_json_operation(oas,path,method,name='generated'):
    """Narrow synthesis: schema-free JSON carriage, true contracts, one target.

    No claim to copy or translate arbitrary OAS schemas. An unconstrained output
    contract is faithful to JSON carriage; source metadata remains in content.
    """
    return {'openbindings':'0.2.0','operations':{name:{'input':True,'output':True}},
            'sources':{'artifact':{'kind':KIND,'content':{'document':copy.deepcopy(oas)}}},
            'bindings':{'native':{'operation':name,'source':'artifact',
                                  'content':{'target':'/paths/'+esc(path)+'/'+method}}}}
