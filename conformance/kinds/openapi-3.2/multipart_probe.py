"""Bounded name-based form-data composer and fixed Encoding-header inspector.

Named scalars/arrays and flat positional multipart with explicit part media are
composed. This is not a complete MIME, Encoding Object, or schema implementation.
"""
import re
from probe import ABSENT,Prerequisite,Unsupported,Unroutable,encode,field,isjson,media_parts,media_select,inspected_type

def governing_member(schema,name):
    """Bounded JSON Schema property correspondence; no instance validation claim."""
    if schema is False:raise Unroutable('supplied forbidden multipart member')
    if schema is True:return {}
    if any(k in schema for k in ('$ref','$dynamicRef','anyOf','oneOf','if','not')):
        raise Unsupported('property schema interpretation outside bounded composer')
    declarations=[]
    if name in schema.get('properties',{}):declarations.append(schema['properties'][name])
    for pattern,child in schema.get('patternProperties',{}).items():
        if re.search(pattern,name):declarations.append(child)
    if not declarations:declarations.append(schema.get('additionalProperties',{}))
    for child in schema.get('allOf',[]):declarations.append(governing_member(child,name))
    if any(d is False for d in declarations):raise Unroutable('supplied forbidden multipart member')
    declarations=[d for d in declarations if d is not True and d!={}]
    if not declarations:return {}
    return declarations[0] if len(declarations)==1 else {'allOf':declarations}

def required_properties(schema):
    if not isinstance(schema,dict):return set()
    return set(schema.get('required',[])).union(*(required_properties(c) for c in schema.get('allOf',[])))

def item_schema(schema):
    if not isinstance(schema,dict):return {}
    declarations=([schema['items']] if 'items' in schema else [])
    declarations += [item_schema(c) for c in schema.get('allOf',[])]
    if any(s is False for s in declarations):return False
    declarations=[s for s in declarations if s is not True and s!={}]
    if not declarations:return {}
    return declarations[0] if len(declarations)==1 else {'allOf':declarations}

def intersection(a,b):
    if a is None:return b
    if b is None:return a
    return a & b

def string_domain(schema,source=None,seen=()):
    if schema is False:return set()
    if schema in (None,True):return None
    domain=None
    if '$ref' in schema:
        if source is None:raise Unsupported('schema reference requires source')
        ref=schema['$ref']
        if ref in seen:raise Unsupported('fixed-header cyclic schema inspection')
        resolved,_,_=source.ref({'$ref':ref},expected='schema')
        domain=string_domain(resolved,source,seen+(ref,))
    if '$dynamicRef' in schema:raise Unsupported('dynamic fixed-header inspection')
    if 'type' in schema:
        types=schema['type'] if isinstance(schema['type'],list) else [schema['type']]
        if 'string' not in types:domain=set()
    if 'const' in schema:
        domain=intersection(domain,{schema['const']} if isinstance(schema['const'],str) else set())
    if 'enum' in schema:domain=intersection(domain,{v for v in schema['enum'] if isinstance(v,str)})
    for child in schema.get('allOf',[]):domain=intersection(domain,string_domain(child,source,seen))
    if any(k in schema for k in ('anyOf','oneOf','if','not')):raise Unsupported('fixed-header union/conditional outside bounded inspector')
    return domain

def header_groups(declarations,source=None):
    groups={}
    for name,header in declarations.items():
        if name.lower()=='content-type':continue
        if '$ref' in header:
            if source is None:raise Unsupported('Header reference needs source')
            header,_,_=source.ref(header,expected='header')
        key=name.lower()
        group=groups.setdefault(key,{'name':name,'domain':None,'required':False})
        group['required']|=header.get('required',False)
        # A content-form Header has no fixed raw-string source. Its media schema
        # is deliberately never treated as a raw header schema.
        domain=string_domain(header.get('schema'),source) if 'schema' in header else None
        group['domain']=intersection(group['domain'],domain)
    return groups

def fixed_headers(declarations,source=None,subtype='mixed'):
    result={}
    for key,g in header_groups(declarations,source).items():
        domain=g['domain']
        if domain is not None and not domain:raise Unroutable('incoherent fixed raw-string header domain')
        if domain is None or len(domain)!=1:
            if g['required']:raise Unsupported('required Encoding header has no fixed field string')
            continue
        value=next(iter(domain));field(g['name'],value)
        if subtype=='form-data' and key not in ('content-disposition','content-transfer-encoding'):
            raise Unsupported('field not permitted by form-data subtype')
        result[g['name']]=value
    return result

def choose_media(enc,choice=ABSENT):
    if any(k in enc for k in ('style','explode','allowReserved')):
        raise Unsupported('style-based multipart outside bounded composer')
    declared=enc.get('contentType')
    if not isinstance(declared,str):raise Unsupported('probe requires explicit part media')
    alternatives=[x.strip() for x in declared.split(',')]
    if choice is ABSENT:
        if len(alternatives)!=1 or '*' in media_parts(alternatives[0])[:2]:
            raise Prerequisite('part requires a concrete context media choice')
        choice=alternatives[0]
    if '*' in media_parts(choice)[:2]:raise Prerequisite('part media choice must be concrete')
    media_select({m:{} for m in alternatives},choice)
    return choice

def append_part(out,boundary,headers,data):
    marker=('--'+boundary).encode()
    if marker in data:raise Unsupported('chosen boundary occurs in content')
    out.append(marker+b'\r\n')
    for k,v in headers.items():out.append((k+': '+v+'\r\n').encode('utf-8'))
    out.append(b'\r\n'+data+b'\r\n')

def check_boundary(boundary):
    if not boundary or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-' for c in boundary):
        raise Unsupported('probe boundary alphabet')

def part_headers(enc,member,value,source,subtype,name=None):
    headers=fixed_headers(enc.get('headers',{}),source,subtype)
    groups=header_groups(enc.get('headers',{}),source)
    transfer=next((v for k,v in headers.items() if k.lower()=='content-transfer-encoding'),None)
    declared=member.get('contentEncoding') if isinstance(member,dict) else None
    transfer_domain=groups.get('content-transfer-encoding',{}).get('domain')
    if declared is not None and transfer_domain is not None and declared not in transfer_domain:
        raise Unroutable('transfer header rejects schema contentEncoding')
    if transfer is not None:
        if not isinstance(value,str) or declared is None or transfer.lower()!=declared.lower():
            raise Unsupported('transfer encoding would require another transformation')
        if transfer.lower()!='base64':raise Unsupported('probe covers coherent Base64 transfer only')
    if name is not None:
        disposition=next((v for k,v in headers.items() if k.lower()=='content-disposition'),None)
        if disposition is None:
            if any(c in name for c in '\r\n"\\'):raise Unsupported('probe simple quoted property names only')
            headers['Content-Disposition']='form-data; name="'+name+'"'
        elif 'filename*=' in disposition.lower() or 'name="'+name+'"' not in disposition:
            raise Unroutable('fixed disposition does not preserve property name')
    return headers

def compose_form_data(declaration,body,source=None,boundary='independent-family-boundary',choices=None):
    if not isinstance(body,dict):raise Unroutable('named multipart body must be object')
    check_boundary(boundary);choices=choices or {}
    schema=declaration.get('schema',{})
    required=required_properties(schema)
    out=[]
    for name,value in body.items():
        member=governing_member(schema,name)
        if member is False:raise Unroutable('supplied impossible multipart member')
        array_declared=inspected_type(member)=='array'
        part_schema=item_schema(member) if array_declared else member
        enc=declaration.get('encoding',{}).get(name,{})
        # Select before null omission. Whole-property null is one value, even
        # when its declaration names an array. Actual array items never omit.
        media=choose_media(enc,choices.get(name,ABSENT))
        expanded=array_declared and isinstance(value,list)
        values=value if expanded else [value]
        for part in values:
            if part_schema is False:raise Unroutable('supplied impossible multipart item')
            if part is None and not isjson(media):
                if expanded or name in required:raise Unsupported('part null has no selected-media correspondence')
                continue
            headers=part_headers(enc,part_schema,part,source,'form-data',name)
            headers['Content-Type']=media
            append_part(out,boundary,headers,encode(media,{'schema':part_schema},part))
    out.append(('--'+boundary+'--\r\n').encode())
    return 'multipart/form-data; boundary='+boundary,b''.join(out)

def compose_positional(declaration,body,source=None,boundary='independent-family-boundary',choices=None,subtype='mixed'):
    if not isinstance(body,list):raise Unroutable('positional multipart body must be array')
    check_boundary(boundary);choices=choices or {}
    schema=declaration.get('schema',{})
    prefix=schema.get('prefixItems',[]);encodings=declaration.get('prefixEncoding',[])
    out=[]
    for i,value in enumerate(body):
        member=prefix[i] if i<len(prefix) else schema.get('items',{})
        enc=encodings[i] if i<len(encodings) else declaration.get('itemEncoding',{})
        if member is False:raise Unroutable('supplied impossible positional item')
        name=None
        if subtype=='form-data':
            if not isinstance(value,dict) or len(value)!=1:raise Unroutable('positional form-data item must have one member')
            name,value=next(iter(value.items()))
            member=governing_member(member,name)
        media=choose_media(enc,choices.get(i,ABSENT))
        if value is None and not isjson(media):raise Unsupported('positional null has no selected-media correspondence')
        headers=part_headers(enc,member,value,source,subtype,name)
        headers['Content-Type']=media
        append_part(out,boundary,headers,encode(media,{'schema':member},value))
    out.append(('--'+boundary+'--\r\n').encode())
    return 'multipart/'+subtype+'; boundary='+boundary,b''.join(out)
