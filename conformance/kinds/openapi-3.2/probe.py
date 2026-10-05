"""Fresh, bounded semantic interpreter. This is NOT an OpenAPI SDK or validator.

Expected native traces are in tests.py, separately from this implementation.
Unhandled features raise Unsupported; a passing test proves only its listed case.
"""
import base64
import codecs
import copy
import decimal
import gzip
import http.client
import json
import re
import subprocess
import urllib.parse as url
import urllib.request
from pathlib import Path

ABSENT = object()
FIXED = ('get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace', 'query')
TOKEN = r"[!#$%&'*+.^_`|~0-9A-Za-z-]+"

class Invalid(Exception): pass
class Unavailable(Exception): pass
class Unsupported(Exception): pass
class Prerequisite(Exception): pass
class Unroutable(Exception): pass
class MappingFailure(Exception): pass

def pointer_tokens(s):
    if not isinstance(s, str) or (s and not s.startswith('/')) or re.search(r'~(?![01])', s):
        raise Invalid('literal string-form JSON Pointer required')
    return [] if not s else [p.replace('~1', '/').replace('~0', '~') for p in s[1:].split('/')]

def at(value, pointer):
    for part in pointer_tokens(pointer):
        if isinstance(value, dict): value = value.get(part, ABSENT)
        elif isinstance(value, list) and re.fullmatch(r'0|[1-9][0-9]*', part):
            value = value[int(part)] if int(part) < len(value) else ABSENT
        else: return ABSENT
    return value

def validate_mapping(m,depth=0):
    if not isinstance(m, dict): raise Invalid('mapping must be object')
    if 'at' in m:
        if set(m)-{'at','up'}:raise Invalid('at has unknown member')
        pointer_tokens(m['at'])
        up=m.get('up',0)
        if type(up) not in (int,float,decimal.Decimal) or up<0 or not decimal.Decimal(str(up)).is_finite() or int(up)!=up or up>depth:
            raise Invalid('up must select an existing scope by nonnegative integer')
        return
    if len(m) != 1: raise Invalid('mapping must have one form')
    key, v = next(iter(m.items()))
    if key == 'at': pointer_tokens(v)
    elif key == 'literal': pass
    elif key == 'object' and isinstance(v, dict):
        for child in v.values(): validate_mapping(child,depth)
    elif key == 'array' and isinstance(v, list):
        for child in v: validate_mapping(child,depth)
    elif key == 'each' and isinstance(v, dict) and set(v)=={'in','value'}:
        validate_mapping(v['in'],depth); validate_mapping(v['value'],depth+1)
    else: raise Invalid('malformed mapping')

def mapping(m, original, parents=()):
    validate_mapping(m,len(parents))
    if 'at' in m:
        up=int(m.get('up',0))
        return at(original if up==0 else parents[up-1],m['at'])
    key, v = next(iter(m.items()))
    if key == 'at': return at(original, v)
    if key == 'literal': return copy.deepcopy(v)
    if key == 'each':
        collection=mapping(v['in'],original,parents)
        if collection is ABSENT: return ABSENT
        if not isinstance(collection,list): raise MappingFailure('each collection is not array')
        out=[mapping(v['value'],item,(original,)+parents) for item in collection]
        if any(x is ABSENT for x in out): raise MappingFailure('each item result absent')
        return out
    if key == 'object':
        out = {}
        for name, child in v.items():
            value = mapping(child, original,parents)
            if value is not ABSENT: out[name] = value
        return out
    out = [mapping(child, original,parents) for child in v]
    if any(x is ABSENT for x in out): raise MappingFailure('array element absent')
    return out

def artifact_text(data):
    if isinstance(data, bytes):
        # YAML 1.2 encoding detection: BOM or initial octet pattern.
        if data.startswith(codecs.BOM_UTF32_LE) or data.startswith(codecs.BOM_UTF32_BE): enc = 'utf-32'
        elif data.startswith(codecs.BOM_UTF16_LE) or data.startswith(codecs.BOM_UTF16_BE): enc = 'utf-16'
        elif data.startswith(codecs.BOM_UTF8): enc = 'utf-8-sig'
        elif data[:3] == b'\0\0\0': enc = 'utf-32-be'
        elif len(data) >= 4 and data[1:4] == b'\0\0\0': enc = 'utf-32-le'
        elif data[:1] == b'\0': enc = 'utf-16-be'
        elif data[1:2] == b'\0': enc = 'utf-16-le'
        else: enc = 'utf-8'
        data = data.decode(enc)
    if not isinstance(data, str): raise Invalid('artifact text required')
    return data.lstrip('\ufeff')

def parse_artifact(data, referenced_schema=False):
    if isinstance(data, dict): return copy.deepcopy(data)
    if type(data) is bool and referenced_schema: return data
    try:
        proc = subprocess.run(['ruby', str(Path(__file__).with_name('yaml_nodes.rb'))],
            input=artifact_text(data), text=True, capture_output=True)
        if proc.returncode: raise Invalid('invalid YAML syntax')
        tree = json.loads(proc.stdout)
        if len(tree['children']) != 1: raise Invalid('exactly one YAML document required')
        def scalar(n, key=False):
            raw, tag = n['value'], n.get('tag')
            if key: return raw
            if tag and tag not in ['tag:yaml.org,2002:'+t for t in ('str','null','bool','int','float')]:
                raise Invalid('incompatible explicit scalar tag')
            if tag == 'tag:yaml.org,2002:str' or (not n['plain'] and not tag): return raw
            if re.fullmatch(r'null|Null|NULL|~|', raw): value = None
            elif raw in ('true','True','TRUE'): value = True
            elif raw in ('false','False','FALSE'): value = False
            elif re.fullmatch(r'[-+]?[0-9]+', raw): value = int(raw)
            elif re.fullmatch(r'[-+]?0o[0-7]+', raw): value = int(raw.replace('0o',''),8)
            elif re.fullmatch(r'[-+]?0x[0-9a-fA-F]+', raw): value = int(raw,16)
            elif re.fullmatch(r'[-+]?(?:[0-9]*\.[0-9]+|[0-9]+\.?)(?:[eE][-+]?[0-9]+)?', raw): value = decimal.Decimal(raw)
            elif re.fullmatch(r'[-+]?\.(?:inf|Inf|INF|nan|NaN|NAN)', raw): raise Invalid('non-JSON number')
            else: value = raw
            expected = {'tag:yaml.org,2002:null': type(None), 'tag:yaml.org,2002:bool': bool,
                'tag:yaml.org,2002:int': int, 'tag:yaml.org,2002:float': (int,decimal.Decimal)}.get(tag)
            if expected and (type(value) not in (expected if isinstance(expected,tuple) else (expected,))):
                raise Invalid('explicit tag incompatible with scalar spelling')
            return value
        def build(n):
            if n['kind'] == 'scalar': return scalar(n)
            if n['kind'] == 'alias': raise Unsupported('YAML aliases not implemented by probe')
            if n.get('tag'): raise Unsupported('tagged collection not implemented by probe')
            if n['kind'] == 'sequence': return [build(c) for c in n['children']]
            if n['kind'] == 'mapping':
                out = {}
                children = n['children']
                for k,v in zip(children[::2],children[1::2]):
                    if k['kind'] != 'scalar': raise Invalid('non-scalar key')
                    name = scalar(k, key=True)
                    if name in out: raise Invalid('duplicate key')
                    out[name] = build(v)
                return out
            raise Invalid('unexpected YAML node')
        value = build(tree['children'][0]['children'][0])
        if not isinstance(value,dict) and not (referenced_schema and type(value) is bool): raise Invalid('document must be object')
        return value
    except (UnicodeError, IndexError, json.JSONDecodeError) as e: raise Invalid(str(e)) from e

class Resolver:
    """Explicit URI resources, with optional real loopback-only HTTP acquisition."""
    def __init__(self, resources=None, http=False):
        self.resources = resources or {}
        self.http = http
        self.calls = []
    def acquire(self, uri):
        self.calls.append(uri)
        if uri in self.resources:
            val = self.resources[uri]
            if isinstance(val, Exception): raise val
            return val if isinstance(val, tuple) else (val, uri)
        p = url.urlsplit(uri)
        if self.http and p.scheme == 'http' and p.hostname == '127.0.0.1':
            try:
                with urllib.request.urlopen(uri, timeout=3) as r: return r.read(), r.geturl()
            except Exception as e: raise Unavailable(str(e)) from e
        raise Unavailable('resource unavailable under probe resolver policy')

class Source:
    def __init__(self, content, resolver=None):
        if not isinstance(content,dict) or not content or set(content)-{'document','location'}:
            raise Invalid('invalid source content')
        location = content.get('location')
        if 'location' in content and (not isinstance(location,str) or not url.urlsplit(location).scheme):
            raise Invalid('location must be absolute URI')
        if location is not None:
            if url.urlsplit(location).fragment:raise Invalid('location identifies a whole document, not a fragment')
            location=url.urldefrag(location)[0]
        self.resolver = resolver or Resolver()
        if 'document' in content:
            if not isinstance(content['document'], (dict,str)): raise Invalid('document object/text required')
            doc = parse_artifact(content['document'])
        else:
            raw, location = self.resolver.acquire(location)
            doc = parse_artifact(raw)
        if doc.get('openapi') not in ('3.2.0','3.2.1'): raise Invalid('entry must be OAS 3.2.0 or 3.2.1')
        self.doc, self.retrieval = doc, location
        self.base = self.description_base(doc, location)
    @staticmethod
    def description_base(doc, retrieval):
        if not isinstance(doc,dict) or doc.get('openapi') not in ('3.2.0','3.2.1') or '$self' not in doc: return retrieval
        s = doc['$self']
        if url.urlsplit(s).scheme: return s
        if retrieval: return url.urljoin(retrieval,s)
        raise Prerequisite('relative $self without base')
    def ref(self, value, doc=None, retrieval=None, seen=None, expected=None):
        doc = self.doc if doc is None else doc
        retrieval = self.retrieval if retrieval is None else retrieval
        if not isinstance(value,dict) or '$ref' not in value: return scoped_object(value,doc,expected), doc, retrieval
        ref = value['$ref']; seen = set() if seen is None else seen
        base = self.description_base(doc,retrieval)
        absolute = url.urljoin(base or '',ref)
        if absolute in seen: raise Unsupported('probe cannot finish required reference cycle')
        seen.add(absolute)
        resource,frag = url.urldefrag(absolute)
        if ref.startswith('#') or (base and resource == url.urldefrag(base)[0]): root = doc
        else:
            if not url.urlsplit(resource).scheme: raise Prerequisite('relative reference lacks base')
            raw,retrieval = self.resolver.acquire(resource)
            root = parse_artifact(raw,referenced_schema=expected=='schema')
            standalone = not frag and expected in ('pathItem','parameter','response','requestBody','header')
            if expected!='schema' and not standalone and not ('openapi' in root or any(k in root for k in ('$id','$schema','type','$defs'))):
                raise Unsupported('referenced-root embedding not supported')
        # URI-fragment form references decode URI escapes; binding target does not.
        node = at(root,url.unquote(frag)) if frag else root
        if node is ABSENT: raise Unavailable('reference target absent')
        return self.ref(node,root,retrieval,seen,expected)
    def select(self, binding, context=None):
        context=context or {}
        if not isinstance(binding,dict) or 'target' not in binding or set(binding)-{'target','input','output'}:
            raise Invalid('invalid binding content')
        for k in ('input','output'):
            if k in binding: validate_mapping(binding[k])
        t = pointer_tokens(binding['target'])
        if len(t) not in (3,4) or t[0] != 'paths': raise Invalid('invalid target form')
        path = t[1]
        if len(t) == 3:
            if t[2] not in FIXED: raise Invalid('invalid fixed operation')
            method = t[2].upper()
        else:
            if t[2] != 'additionalOperations' or not re.fullmatch(TOKEN,t[3]): raise Invalid('invalid additional method')
            method = t[3]
            if method in [x.upper() for x in FIXED]: raise Invalid('fixed method in additionalOperations')
        if method == 'CONNECT': raise Unsupported('CONNECT tunnel')
        item = self.doc.get('paths',{}).get(path,ABSENT)
        if item is ABSENT: raise Unavailable('no selected path')
        item_doc,item_uri = self.doc,self.retrieval
        field_origins={key:(self.doc,self.retrieval) for key in item}
        if '$ref' in item:
            ref,refdoc,refuri = self.ref(item,expected='pathItem')
            selected_field = t[2]
            if selected_field=='additionalOperations':
                own=item.get(selected_field,{})
                remote=ref.get(selected_field,{})
                if t[3] in own and t[3] in remote: raise Unavailable('ambiguous selected method')
                chosen=own.get(t[3],remote.get(t[3],{}))
            else:
                if selected_field in item and selected_field in ref: raise Unavailable('ambiguous selected Path Item field')
                chosen=item.get(selected_field,ref.get(selected_field,{}))
            if 'servers' in item and 'servers' in ref and not chosen.get('servers') and not context.get('server'):
                raise Unavailable('ambiguous inherited servers')
            if 'parameters' in item and 'parameters' in ref:
                inherited={(p.get('in'),p.get('name')) for p in item['parameters']+ref['parameters']}
                replaced={(p.get('in'),p.get('name')) for p in chosen.get('parameters',[])}
                if not inherited <= replaced: raise Unavailable('ambiguous inherited parameters')
            field_origins={key:(refdoc,refuri) for key in ref}
            field_origins.update({key:(self.doc,self.retrieval) for key in item if key!='$ref'})
            merged = {**ref,**{k:v for k,v in item.items() if k != '$ref'}}
            if 'additionalOperations' in item or 'additionalOperations' in ref:
                merged['additionalOperations']={**ref.get('additionalOperations',{}),**item.get('additionalOperations',{})}
            local_selected=(t[3] in item.get('additionalOperations',{})) if selected_field=='additionalOperations' else selected_field in item
            if not local_selected:item_doc,item_uri=refdoc,refuri
            item = merged
        operation = at(item,'/'+ '/'.join(x.replace('~','~0').replace('/','~1') for x in t[2:]))
        if operation is ABSENT: raise Unavailable('no selected operation')
        if not isinstance(operation,dict): raise Invalid('operation must be object')
        self.selection_origins={'operation':(item_doc,item_uri),'item_fields':field_origins}
        return path,method,item,scoped_object(operation,item_doc),item_doc,item_uri

def media_parts(s):
    # Concrete tested subset: tokens and quoted parameter strings without escapes.
    chunks = [v.strip() for v in s.split(';')]
    if not re.fullmatch(r'(?:'+TOKEN+r'|\*)/(?:'+TOKEN+r'|\*)',chunks[0]): raise Unsupported('invalid media syntax')
    ty,sub = chunks[0].lower().split('/')
    params = {}
    for chunk in chunks[1:]:
        if '=' not in chunk: raise Unsupported('invalid media parameter')
        k,v = chunk.split('=',1); k=k.lower(); v=v.strip('"')
        if k in params: raise Unsupported('duplicate media parameter')
        params[k] = v.lower() if k == 'charset' else v
    return ty,sub,params

def media_select(content, actual):
    a,b,p = media_parts(actual)
    entries = []
    identities = {}
    for name,schema in content.items():
        try:
            x,y,q = media_parts(name)
            identity = (x,y,tuple(sorted(q.items())))
            identities.setdefault(identity,[]).append((name,schema))
        except Unsupported: continue
    for (x,y,params),values in identities.items():
        if len(values) != 1: continue
        q = dict(params)
        if (x in (a,'*')) and (y in (b,'*')) and all(p.get(k)==v for k,v in q.items()):
            entries.append(((int(x!='*')+int(y!='*'),len(q)),*values[0]))
    if not entries: raise Unsupported('unmatched media')
    entries.sort(key=lambda e:e[0],reverse=True)
    if len(entries)>1 and entries[0][0] == entries[1][0]: raise Unsupported('ambiguous media match')
    return entries[0][1],entries[0][2]

DEFAULT_DIALECT = 'https://spec.openapis.org/oas/3.2/dialect/2025-09-17'

def scoped_object(node, document, expected=None):
    """Carry dialect context into a selected OAS object without editing the artifact."""
    if not isinstance(node,dict): return node
    dialect=document.get('jsonSchemaDialect',DEFAULT_DIALECT) if isinstance(document,dict) else DEFAULT_DIALECT
    if dialect==DEFAULT_DIALECT:return node
    if expected=='schema':
        return {'$schema':dialect,**node}
    result=copy.deepcopy(node)
    def walk(o):
        if not isinstance(o,dict): return
        if isinstance(o.get('schema'),dict):o['schema']={'$schema':dialect,**o['schema']}
        for p in o.get('parameters',[]):walk(p)
        for field in ('content','responses','headers'):
            for child in o.get(field,{}).values():walk(child)
        if 'requestBody' in o:walk(o['requestBody'])
    walk(result)
    return result

def inspected_type(schema, dialect=DEFAULT_DIALECT):
    if schema is False: raise Unroutable('false schema at inspected position')
    if schema in (None,True) or schema == {}: return None
    if '$dynamicRef' in schema or '$ref' in schema: raise Unsupported('probe schema reference inspection not implemented')
    dialect=schema.get('$schema',dialect)
    if dialect != DEFAULT_DIALECT:
        raise Unsupported('unsupported schema dialect')
    def categories(t): return {'integer','fractional'} if t=='number' else {t}
    known = None
    if 'type' in schema:
        ts=schema['type'] if isinstance(schema['type'],list) else [schema['type']]
        known=set().union(*(categories(t) for t in ts))
    for child in schema.get('allOf',[]):
        t = inspected_type(child,dialect)
        if t is not None: known = categories(t) if known is None else known & categories(t)
    for kw in ('anyOf','oneOf'):
        if kw in schema:
            choices=[]
            for child in schema[kw]:
                try:choices.append(inspected_type(child,dialect))
                except Unroutable:pass  # statically impossible branch admits no candidate
            choices = [x for x in choices if x != 'null']
            if not choices:raise Unroutable('no non-null possible union branch')
            if any(c is None for c in choices) or len(set(choices)) != 1: raise Unsupported('nonunique union declaration')
            known = categories(choices[0]) if known is None else known & categories(choices[0])
    if known is not None and not known: raise Unroutable('empty type intersection')
    nonnull = known-{'null'} if known else known
    if nonnull=={'integer','fractional'}: return 'number'
    if nonnull and len(nonnull)>1: raise Unsupported('nonunique type')
    return next(iter(nonnull)) if nonnull else ('null' if known else None)

def json_load(data):
    text = data.decode('utf-8-sig')
    value = json.loads(text,parse_float=decimal.Decimal,parse_constant=lambda x: (_ for _ in ()).throw(ValueError(x)))
    def check(v):
        if isinstance(v,str) and any(0xd800<=ord(c)<=0xdfff for c in v): raise ValueError('unpaired surrogate')
        if isinstance(v,dict):
            for k,x in v.items(): check(k);check(x)
        if isinstance(v,list):
            for x in v: check(x)
    check(value)
    return value

def isjson(media):
    a,b,_ = media_parts(media)
    return (a,b)==('application','json') or b.endswith('+json')

def encode(media, decl, value):
    if isjson(media):
        try:
            result = json.dumps(value,ensure_ascii=False,allow_nan=False,separators=(',',':')).encode('utf-8')
            json_load(result)
            return result
        except (UnicodeError,ValueError,TypeError) as e: raise Unroutable(str(e)) from e
    a,b,p = media_parts(media)
    t = inspected_type(decl.get('schema'))
    if (a=='text' or b=='xml' or b.endswith('+xml')) and t in ('string','boolean','number','integer'):
        if t=='string' and isinstance(value,str): text = value
        elif t=='boolean' and type(value) is bool: text = 'true' if value else 'false'
        elif t in ('number','integer') and type(value) in (int,float): text = json.dumps(value,allow_nan=False)
        else: raise Unroutable('wrong scalar type')
        if b=='xml' or b.endswith('+xml'):
            from xml_probe import encode_characters
            return encode_characters(text,p.get('charset'))
        if p.get('charset','utf-8') != 'utf-8': raise Unsupported('probe non-XML text supports UTF-8 only')
        return text.encode('utf-8')
    if t is None and a!='multipart' and b!='x-www-form-urlencoded':
        try:
            raw=base64.b64decode(value,validate=True)
            if base64.b64encode(raw).decode() != value: raise ValueError('noncanonical Base64')
            return raw
        except (ValueError,TypeError) as e: raise Unroutable(str(e)) from e
    raise Unsupported('media encoding outside probe subset')

def decode(media,decl,data):
    if isjson(media): return json_load(data)
    a,b,p=media_parts(media); t=inspected_type(decl.get('schema'))
    if (a=='text' or b=='xml' or b.endswith('+xml')) and t in ('string','boolean','number','integer'):
        if b=='xml' or b.endswith('+xml'):
            from xml_probe import decode_characters
            text=decode_characters(data,p.get('charset'))
        else:
            if p.get('charset','utf-8')!='utf-8': raise Unsupported('probe non-XML text supports UTF-8 only')
            text=data.decode('utf-8')
        if t=='string': return text
        if text.startswith('\ufeff'): raise ValueError('scalar BOM')
        val=json.loads(text,parse_float=decimal.Decimal)
        if t=='boolean' and type(val) is bool: return val
        if t in ('number','integer') and type(val) in (int,decimal.Decimal): return val
        raise ValueError('wrong scalar token')
    if t is None and a!='multipart' and b!='x-www-form-urlencoded': return base64.b64encode(data).decode()
    raise Unsupported('media decoding outside probe subset')

def scalar(v,context):
    if isinstance(v,str): return v
    if type(v) in (int,float,bool):
        if 'scalar' not in context: raise Prerequisite('scalar conversion required')
        result=context['scalar'](v)
        if not isinstance(result,str): raise Prerequisite('converter must return string')
        return result
    if v is None: return ''
    raise Unroutable('nested compound serialization unsupported')

def field(name,value):
    if not re.fullmatch(TOKEN,name): raise Unroutable('invalid field name')
    if value.strip(' \t') != value or any(ord(c)<32 and c!='\t' or ord(c)==127 for c in value):
        raise Unroutable('invalid field value')
    return name,value

class OperationContext(dict):
    """Keep physical reference scope without adding fields to an OAS object."""
    def __init__(self,operation,source,doc,retrieval):
        super().__init__(operation)
        self.reference_context=(source,doc,retrieval)

def request(source,binding,value=ABSENT,context=None):
    context=context or {}
    path,method,item,op,doc,retrieval=source.select(binding,context)
    value=mapping(binding['input'],value) if 'input' in binding else value
    if value is ABSENT: value={}
    if not isinstance(value,dict) or set(value)-{'parameters','body'}: raise Unroutable('invalid request envelope')
    supplied=value.get('parameters',{})
    if not isinstance(supplied,dict): raise Unroutable('parameters must be object')
    if context.get('server'):
        base=context['server']
    else:
        if op.get('servers'):
            servers=op['servers'];server_uri=retrieval
        elif item.get('servers'):
            servers=item['servers'];_,server_uri=source.selection_origins['item_fields']['servers']
        else:
            servers=source.doc.get('servers') or [{'url':'/'}];server_uri=source.retrieval
        if len(servers)!=1: raise Prerequisite('server choice required')
        server=servers[0]; base=server['url']
        for var in re.findall(r'\{([^}]+)\}',base):
            declaration=server.get('variables',{}).get(var,{})
            replacement=context.get('variables',{}).get(var,declaration.get('default',ABSENT))
            if replacement is ABSENT: raise Prerequisite('server variable required')
            if 'enum' in declaration and replacement not in declaration['enum']: raise Unroutable('server variable enum')
            base=base.replace('{'+var+'}',replacement)
        if not url.urlsplit(base).scheme:
            if server_uri is None: raise Prerequisite('relative server lacks retrieval URI')
            base=url.urljoin(server_uri,base)
    parsed=url.urlsplit(base)
    if parsed.scheme not in ('http','https') or not parsed.hostname or parsed.username or parsed.query or parsed.fragment:
        raise Unroutable('invalid server base')
    params={}
    item_param_origin=source.selection_origins['item_fields'].get('parameters',(source.doc,source.retrieval))
    for scope,(param_doc,param_uri) in ((item,item_param_origin),(op,(doc,retrieval))):
        local=set()
        for p in scope.get('parameters',[]):
            p,_,_=source.ref(p,param_doc,param_uri,expected='parameter')
            if p['in']=='cookie' and p.get('explode') is False:raise Invalid('cookie explode:false')
            ident=(p['in'],p['name'])
            if ident in local: raise Invalid('duplicate parameter')
            local.add(ident)
            if p['in']=='header' and p['name'].lower() in ('accept','content-type','authorization'): continue
            params[ident]=p
    names=[p['name'] for p in params.values()]
    unavailable=set()
    forbidden={'host','content-length','connection','keep-alive','proxy-authorization','proxy-connection','te','trailer','transfer-encoding','upgrade'}
    for ident,p in params.items():
        if p['in']=='header':
            if not re.fullmatch(TOKEN,p['name']) or p['name'].lower() in forbidden:unavailable.add(ident)
    if any(params[i].get('required') for i in unavailable): raise Unroutable('required unavailable projection')
    params={i:p for i,p in params.items() if i not in unavailable}
    names=[p['name'] for p in params.values()]
    qualified=len(set(names))!=len(names)
    keys={(loc+'/'+name.replace('~','~0').replace('/','~1') if qualified else name):p for (loc,name),p in params.items()}
    if set(supplied)-set(keys): raise Unroutable('unknown parameter key')
    headers={}; query=[]; whole=ABSENT
    if any(p['in']=='querystring' for p in params.values()) and any(p['in']=='query' for p in params.values()):
        raise Unsupported('querystring/query coexistence')
    for key,p in keys.items():
        if key not in supplied:
            if p.get('required'): raise Unroutable('required parameter absent')
            continue
        v=supplied[key]; name=p['name']; loc=p['in']; style=p.get('style',{'query':'form','header':'simple','path':'simple'}.get(loc))
        if loc=='header' and any(n.lower()==name.lower() for n in headers): raise Unroutable('case-colliding supplied header contributions')
        if 'content' in p:
            if len(p['content'])!=1: raise Invalid('parameter media requires one entry')
            media,decl=next(iter(p['content'].items())); data=encode(media,decl,v)
            if loc=='querystring': whole=url.quote_from_bytes(data,safe='-._~'); continue
            if loc=='query': query.append(url.quote(name,safe='-._~')+'='+url.quote_from_bytes(data,safe='-._~')); continue
            if loc=='header': headers.update([field(name,data.decode('utf-8'))]); continue
            if loc=='path':path=path.replace('{'+name+'}',url.quote_from_bytes(data,safe='-._~'));continue
            raise Unsupported('content parameter destination outside subset')
        if loc=='header':
            if name.lower() in ('host','content-length','connection','keep-alive','proxy-authorization','proxy-connection','te','trailer','transfer-encoding','upgrade'):
                raise Unroutable('transport-owned field')
            if any(n.lower()==name.lower() for n in headers): raise Unsupported('case-ambiguous header')
            if style!='simple' or isinstance(v,(dict,list)): raise Unsupported('only scalar simple headers in probe')
            headers.update([field(name,scalar(v,context))]); continue
        if loc=='path' and style in ('simple','matrix','label'):
            if v is None or v==[] or v=={}:part=''
            else:
                part=url.quote(scalar(v,context),safe='-._~')
                if style=='label':part='.'+part
                elif style=='matrix':part=';'+url.quote(name,safe='-._~')+('='+part if part else '')
            path=path.replace('{'+name+'}',part);continue
        if loc=='query' and style=='deepObject':
            if not isinstance(v,dict) or not v:raise Unroutable('deepObject probe requires nonempty object')
            for member,member_value in v.items():
                if '[' in member or ']' in member:raise Unsupported('structural bracket in deepObject property name')
                if member_value is None or isinstance(member_value,(dict,list)):raise Unroutable('undefined/nested deepObject member')
                query.append(url.quote(name+'['+member+']',safe='-._~')+'='+url.quote(scalar(member_value,context),safe='-._~'))
            continue
        if loc=='query' and style in ('spaceDelimited','pipeDelimited'):
            if not isinstance(v,list) or not v or p.get('explode',False):raise Unsupported('delimited probe supports nonempty non-exploded arrays')
            separator=' ' if style=='spaceDelimited' else '|'
            values=[scalar(x,context) for x in v]
            if any(separator in x for x in values):raise Unsupported('structural separator in delimited scalar')
            query.append(url.quote(name,safe='-._~')+'='+url.quote(separator.join(values),safe='-._~'));continue
        if loc=='query' and style=='form':
            if v==[] or v=={}: continue
            if v is None:
                query.append(url.quote(name,safe='-._~')+'=');continue
            values=v if isinstance(v,list) else [v]
            if isinstance(v,dict): raise Unsupported('object form query outside probe subset')
            if not p.get('explode',True): values=[','.join(scalar(x,context) for x in values)]
            for x in values:
                s=scalar(x,context)
                safe='-._~:/?[]@!$\'()*+,;' if p.get('allowReserved') else '-._~'
                query.append(url.quote(name,safe='-._~')+'='+url.quote(s,safe=safe))
            continue
        raise Unsupported('parameter style outside probe subset')
    if '{' in path: raise Unroutable('unfilled path expression')
    target=(base[:-1] if base.endswith('/') else base)+path
    if whole is not ABSENT: target+='?'+whole
    elif query: target+='?'+'&'.join(query)
    body=ABSENT
    rb=op.get('requestBody',{})
    rb,_,_=source.ref(rb,doc,retrieval,expected='requestBody')
    if method=='TRACE':
        if 'body' in value: raise Unroutable('TRACE cannot carry body')
    elif 'body' in value:
        content=rb.get('content',{})
        media=context.get('media')
        if media is None:
            if len(content)!=1: raise Prerequisite('request media choice required')
            media=next(iter(content))
            if '*' in media_parts(media)[:2]: raise Prerequisite('concrete media choice required')
        _,decl=media_select(content,media)
        if media_parts(media)[:2]==('multipart','form-data'):
            from multipart_probe import compose_form_data
            media,body=compose_form_data(decl,value['body'],source=source,boundary=context.get('boundary','independent-family-boundary'),choices=context.get('property_media',{}))
        elif media_parts(media)[:2]==('multipart','mixed'):
            from multipart_probe import compose_positional
            media,body=compose_positional(decl,value['body'],source=source,boundary=context.get('boundary','independent-family-boundary'),choices=context.get('position_media',{}))
        else:body=encode(media,decl,value['body'])
        headers['Content-Type']=media
    elif rb.get('required'): raise Unroutable('required body absent')
    codings=[v for k,v in headers.items() if k.lower()=='content-encoding']
    if codings:
        if body is ABSENT: raise Unroutable('coding without body')
        for coding in ','.join(codings).split(','):
            if coding.strip().lower()=='gzip': body=gzip.compress(body,mtime=0)
            else: raise Unsupported('coding unavailable')
    if 'accept' in context: headers['Accept']=context['accept']
    effective_security=op.get('security',source.doc.get('security',[]))
    if effective_security:
        if 'credentials' not in context:raise Unsupported('header apiKey prerequisite outside supplied context')
        import security_probe
        lookup_doc=doc if context.get('scheme_scope')=='referring' else source.doc
        contributions=security_probe.assemble(lookup_doc,{'security':effective_security},credentials=context['credentials'])
        for contribution in contributions:
            if any(k.lower()==contribution.name.lower() for k in headers):raise Unroutable('credential contribution collision')
            headers[contribution.name]=contribution.value
    return {'method':method,'url':target,'headers':headers,'body':body},OperationContext(op,source,doc,retrieval)

def response_events(op,binding,status,headers,chunks,method='GET'):
    """Yields value then completion records; chunks may raise to model late I/O."""
    values=[]
    try:
        h={}
        for name,value in headers:
            field(name,value); h.setdefault(name.lower(),[]).append(value)
        if status==101: raise Unsupported('protocol upgrade')
        if status<200: raise Unsupported('probe consumes final status only')
        responses=op.get('responses',{})
        selected=responses.get(str(status),responses.get(str(status//100)+'XX',responses.get('default',{})))
        reference_context=getattr(op,'reference_context',None)
        if reference_context:
            source,doc,retrieval=reference_context
            selected,doc,retrieval=source.ref(selected,doc,retrieval,expected='response')
        if not isinstance(selected,dict): raise Invalid('invalid exact response declaration')
        for name,decl in selected.get('headers',{}).items():
            if reference_context:decl,_,_=source.ref(decl,doc,retrieval,expected='header')
            if name.lower()=='content-type': continue
            if decl.get('required') and name.lower() not in h: raise ValueError('required response header absent')
            if name.lower()=='content-encoding' and name.lower() in h:
                combined=', '.join(h[name.lower()]); schema=decl.get('schema',{})
                if 'const' in schema and combined!=schema['const']: raise ValueError('coding const mismatch')
                if 'enum' in schema and combined not in schema['enum']: raise ValueError('coding enum mismatch')
        if len(h.get('content-type',[]))>1: raise ValueError('multiple Content-Type')
        actual=h.get('content-type',['application/octet-stream'])[0]
        no_content=method=='HEAD' or status in (204,304)
        success=200<=status<300
        sequential=media_parts(actual)[:2] in [('application','x-ndjson'),('application','jsonl')]
        coding=', '.join(h.get('content-encoding',[]))
        if no_content:
            if any(chunk for chunk in chunks): raise ValueError('forbidden actual content')
            yield ('complete',success); return
        if not success:
            data=b''.join(chunks)
            failure=ABSENT
            try:
                _,decl=media_select(selected.get('content',{}),actual)
                if data: failure=decode(actual,decl,data)
            except Exception: pass
            # Any decoded failure is diagnostic only, never operation output.
            yield ('complete',False); return
        if sequential and not coding:
            _,decl=media_select(selected.get('content',{}),actual)
            pending=b''
            for chunk in chunks:
                pending+=chunk
                while b'\n' in pending:
                    line,pending=pending.split(b'\n',1)
                    if line.endswith(b'\r'): line=line[:-1]
                    v=json_load(line)
                    v=mapping(binding['output'],v) if 'output' in binding else v
                    if v is not ABSENT: yield ('value',v)
            if pending:
                v=json_load(pending)
                v=mapping(binding['output'],v) if 'output' in binding else v
                if v is not ABSENT: yield ('value',v)
        else:
            data=b''.join(chunks)
            if data:
                for code in reversed(coding.split(',') if coding else []):
                    if code.strip().lower()=='gzip': data=gzip.decompress(data)
                    else: raise Unsupported('coding unavailable')
            if data:
                _,decl=media_select(selected.get('content',{}),actual)
                v=decode(actual,decl,data)
                v=mapping(binding['output'],v) if 'output' in binding else v
                if v is not ABSENT: yield ('value',v)
        yield ('complete',True)
    except Exception:
        yield ('complete',False)

def dispatch(req,op,binding):
    p=url.urlsplit(req['url'])
    if p.scheme!='http' or p.hostname!='127.0.0.1': raise Unsupported('probe transport is loopback HTTP only')
    conn=http.client.HTTPConnection(p.hostname,p.port,timeout=3)
    target=p.path+('?' + p.query if '?' in req['url'] else '')
    conn.request(req['method'],target,body=None if req['body'] is ABSENT else req['body'],headers=req['headers'])
    r=conn.getresponse()
    def chunks():
        while True:
            chunk=r.read(3)
            if not chunk: return
            yield chunk
    try: return list(response_events(op,binding,r.status,r.getheaders(),chunks(),req['method']))
    finally: conn.close()

def synthesize_named_json_body(doc,path,method):
    """Intentional tiny generator: one JSON body, no parameter adaptation.

    Output remains unspecified because runtime does not validate native schemas.
    Tests independently enumerate source values and check generated binding traces.
    """
    op=doc['paths'][path][method]
    rb=op['requestBody']
    if set(rb['content'])!={'application/json'}: raise Unsupported('generator supports one JSON media')
    native=rb['content']['application/json'].get('schema',{})
    allowed={'type','enum','const','properties','required','additionalProperties','items','minItems','maxItems'}
    def check(s):
        if isinstance(s,bool): return
        if set(s)-allowed: raise Unsupported('generator refuses unhandled schema keyword')
        for c in s.get('properties',{}).values(): check(c)
        if 'items' in s: check(s['items'])
    check(native)
    return {'openbindings':'0.2.0','operations':{'call':{'input':copy.deepcopy(native)}},
        'sources':{'api':{'kind':'openbindings.openapi-3.2@1','content':{'document':copy.deepcopy(doc)}}},
        'bindings':{'http':{'operation':'call','source':'api','content':{
            'target':'/paths/'+path.replace('~','~0').replace('/','~1')+'/'+method,
            'input':{'object':{'body':{'at':''}}}}}}}
