"""Focused r3 contribution ownership and redirect decision probe.

Supports one direct Security Requirement alternative, direct entry-document
header apiKey schemes, scalar string Header parameters, and scalar string Cookie
parameters with style: cookie. No credential acquisition, auth protocol, HTTP
redirect executor, general cookie serializer, or security SDK is implied.
"""
from dataclasses import dataclass
import re
from urllib.parse import urlsplit

from probe import Invalid, Prerequisite, Unsupported, Unroutable, TOKEN, field

@dataclass(frozen=True)
class Contribution:
    name: str
    value: str
    owner: str

def cookie_pair(name,value):
    if not re.fullmatch(TOKEN,name): raise Unroutable('invalid cookie name')
    # RFC 6265 cookie-octet for the unquoted scalar subset used here.
    if not isinstance(value,str) or any(not (ord(c)==0x21 or 0x23<=ord(c)<=0x2b or 0x2d<=ord(c)<=0x3a or 0x3c<=ord(c)<=0x5b or 0x5d<=ord(c)<=0x7e) for c in value):
        raise Unroutable('unsupported cookie scalar')
    return name+'='+value

def raw_cookie(value):
    if not isinstance(value,str) or not value: raise Unroutable('complete Cookie string required')
    for pair in value.split('; '):
        if '=' not in pair: raise Unroutable('Cookie pair required')
        name,val=pair.split('=',1)
        cookie_pair(name,val)
    return value

def assemble(doc,operation,parameters=None,credentials=None,runtime_headers=None):
    """Return declared contributions or refuse before dispatch. No I/O occurs."""
    parameters=parameters or {};credentials=credentials or {};runtime_headers=runtime_headers or {}
    out=[]
    def add(name,value,owner):
        field(name,value)
        if any(c.name.lower()==name.lower() for c in out):
            raise Unroutable('competing contributions to '+name)
        out.append(Contribution(name,value,owner))
    declared={}
    cookies=[]
    for p in operation.get('parameters',[]):
        if '$ref' in p: raise Unsupported('reference parameter outside focused security probe')
        if p['name'] in declared: raise Unsupported('same-name locations outside focused security probe')
        if p['in']=='header' and p['name'].lower() in ('accept','content-type','authorization'): continue
        declared[p['name']]=p
    if set(parameters)-set(declared):raise Unroutable('unknown parameter')
    for name,p in declared.items():
        if name not in parameters:
            if p.get('required'):raise Unroutable('required parameter absent')
            continue
        value=parameters[name]
        if not isinstance(value,str):raise Unsupported('security probe parameter must be string')
        if p['in']=='cookie' and p.get('style')=='cookie':
            cookies.append(cookie_pair(name,value))
        elif p['in']=='header':
            if name.lower()=='cookie':raw_cookie(value)
            add(name,value,'header-parameter')
        else:raise Unsupported('parameter outside focused security probe')
    if cookies:add('Cookie','; '.join(cookies),'structured-cookie-parameter')
    requirements=operation.get('security',doc.get('security',[]))
    if len(requirements)>1:raise Unsupported('multiple security alternatives outside probe')
    selected=requirements[0] if requirements else {}
    if not isinstance(selected,dict):raise Invalid('security requirement object required')
    schemes=doc.get('components',{}).get('securitySchemes',{})
    forbidden={'host','content-length','content-type','content-encoding','connection','keep-alive',
        'proxy-authorization','proxy-connection','te','trailer','transfer-encoding','upgrade'}
    for key in selected:
        scheme=schemes.get(key)
        if not isinstance(scheme,dict) or scheme.get('type')!='apiKey' or scheme.get('in')!='header' or '$ref' in scheme:
            raise Unsupported('only direct entry header apiKey schemes supported')
        name=scheme['name']
        if name.lower() in forbidden:raise Unroutable('credential targets transport-owned field')
        if key not in credentials:raise Prerequisite('selected credential missing')
        value=credentials[key]
        if not isinstance(value,str):raise Unroutable('string credential required')
        if name.lower()=='cookie':raw_cookie(value)
        add(name,value,'header-api-key')
    for name,value in runtime_headers.items():
        if name.lower() not in ('accept','accept-encoding'):raise Unsupported('only negotiation runtime headers in probe')
        add(name,value,'runtime-negotiation')
    return out

def origin(uri):
    p=urlsplit(uri)
    if p.scheme.lower() not in ('http','https') or not p.hostname:raise Unroutable('absolute HTTP redirect URI required')
    return p.scheme.lower(),p.hostname.lower(),p.port or (443 if p.scheme.lower()=='https' else 80)

def redirect(source_uri,target_uri,contributions):
    """Choose permitted forwarded fields; caller supplies resolved Location.

    A preserving redirect is assumed. Returning Location unchanged means this
    function never appends old query parameters or selected query credentials.
    Same-origin forwarding is one permitted policy, not a requirement to forward.
    """
    same=origin(source_uri)==origin(target_uri)
    forwarded=[]
    for c in contributions:
        protected=c.name.lower()=='cookie' or c.owner=='header-api-key'
        if same or not protected:forwarded.append(c)
    return target_uri,forwarded

def headers(contributions):
    return {c.name.lower():c.value for c in contributions}
