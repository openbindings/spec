"""Native observer independent of interpreter serialization/decoding helpers.

Expectations are authored operation by operation. Legal incidental choices are
normalized here; request meaning mutations must still fail the predicates.
"""
import collections
import decimal
import email.parser
import email.policy
import json
import re
import urllib.parse

def pairs(raw):
    out=collections.defaultdict(list)
    for k,v in urllib.parse.parse_qsl(raw,keep_blank_values=True,strict_parsing=True):out[k].append(v)
    return dict(out)

def pct_case(s):return re.sub(r'%[0-9a-fA-F]{2}',lambda m:m[0].upper(),s)

def unreserved_equivalent(s):
    def normalize(m):
        c=chr(int(m[0][1:],16))
        return c if c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~' else m[0].upper()
    return re.sub(r'%[0-9a-fA-F]{2}',normalize,s)

def xml_text(raw,content_type):
    """Independent native observer; retains all markup and entity references."""
    _,params=media(content_type)
    if raw.startswith(b'\xef\xbb\xbf'):return raw[3:].decode('utf-8')
    if raw.startswith((b'\xff\xfe',b'\xfe\xff')):return raw.decode('utf-16')
    encoding=params.get('charset')
    if encoding is None:
        prologue=raw.split(b'?>',1)[0]
        found=re.search(br'''\bencoding\s*=\s*["']([A-Za-z0-9._-]+)["']''',prologue)
        encoding=found[1].decode('ascii') if found else 'utf-8'
    return raw.decode(encoding)

def media(s):
    m=email.message.Message();m['Content-Type']=s
    return m.get_content_type(),{k.lower():v.lower() if k.lower()=='charset' else v for k,v in m.get_params()[1:]}

def multipart(content_type,body):
    raw=('Content-Type: '+content_type+'\r\nMIME-Version: 1.0\r\n\r\n').encode()+body
    msg=email.parser.BytesParser(policy=email.policy.default).parsebytes(raw)
    assert msg.is_multipart(),'not multipart'
    result=collections.defaultdict(list)
    for p in msg.iter_parts():
        assert p.get_content_disposition()=='form-data'
        name=p.get_param('name',header='content-disposition')
        assert name is not None
        # payload raw bytes: explicit CTE does not authorize an oracle to conceal
        # an accidental second encoding by decoding that header automatically.
        data=p.get_payload(decode=False)
        if isinstance(data,str):data=data.encode('utf-8','surrogateescape')
        result[name].append({'body':data,'headers':{k.lower():str(v) for k,v in p.items()},
                             'filename':p.get_filename()})
    return dict(result)

def assert_request(observed,expected):
    assert observed['method']==expected['method'],(observed,expected)
    url=urllib.parse.urlsplit(observed['target'])
    path_normalizer=unreserved_equivalent if expected.get('content_path_uri_equivalence') else pct_case
    assert path_normalizer(url.path)==path_normalizer(expected['path']),(url.path,expected['path'])
    if 'query' in expected or 'query_json' in expected:
        q=pairs(url.query)
        for k,v in expected.get('query_json',{}).items():
            assert len(q.get(k,[]))==1
            assert json.loads(q.pop(k)[0],parse_float=decimal.Decimal)==v
        assert q==expected.get('query',{}),(q,expected.get('query',{}))
    hs={k.lower():v for k,v in observed['headers']}
    for k,v in expected.get('headers',{}).items():
        actual=hs.get(k.lower())
        if k.lower()=='cookie':
            assert dict(x.split('=',1) for x in actual.split('; '))==dict(x.split('=',1) for x in v.split('; '))
        elif k.lower()=='authorization':
            a=actual.split(' ',1);b=v.split(' ',1)
            assert a[0].lower()==b[0].lower() and a[1:]==b[1:]
        else:assert actual==v,(k,actual,v)
    for k in expected.get('absent_headers',[]):assert k.lower() not in hs
    if 'media' in expected:
        actual,params=media(hs['content-type'])
        want,wp=media(expected['media'])
        assert actual==want and all(params.get(k)==v for k,v in wp.items())
    if 'json' in expected:
        assert json.loads(observed['body'],parse_float=decimal.Decimal)==expected['json']
    if 'form' in expected or 'form_json' in expected:
        f=pairs(observed['body'].decode())
        for k,v in expected.get('form_json',{}).items():
            assert len(f.get(k,[]))==1
            assert json.loads(f.pop(k)[0],parse_float=decimal.Decimal)==v
        assert f==expected.get('form',{}),(f,expected.get('form',{}))
    if 'bytes' in expected:assert observed['body']==expected['bytes']
    if 'xml_text' in expected:assert xml_text(observed['body'],hs['content-type'])==expected['xml_text']
    if 'parts' in expected:
        actual=multipart(hs['content-type'],observed['body'])
        assert set(actual)==set(expected['parts']),(actual,expected['parts'])
        for name,parts in expected['parts'].items():
            assert len(actual[name])==len(parts)
            for a,e in zip(actual[name],parts):
                if 'json' in e:assert json.loads(a['body'],parse_float=decimal.Decimal)==e['json']
                else:assert a['body']==e['body'],(a,e)
                assert a['filename']==e.get('filename')
                for h,v in e.get('headers',{}).items():
                    if h.lower()=='content-type':assert media(a['headers'][h])==media(v)
                    else:assert a['headers'].get(h.lower())==v
                for h in e.get('absent_headers',[]):assert h.lower() not in a['headers']
