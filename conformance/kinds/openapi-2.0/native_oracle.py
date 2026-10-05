"""Independent native fixture and semantic oracle. Imports no interpreter/synthesizer helpers."""
import base64, gzip, http.server, json, re, threading, urllib.parse, zlib
from email import policy
from email.parser import BytesParser

class NativeFixture:
    def __init__(self):
        self.records=[]; self.acquisitions=[]; self.artifacts={}; self.response={}; self.server=None
        owner=self
        class Handler(http.server.BaseHTTPRequestHandler):
            protocol_version='HTTP/1.1'
            def log_message(self,*args): pass
            def go(self):
                if self.path in owner.artifacts:
                    owner.acquisitions.append(self.path); art=owner.artifacts[self.path]
                    body=base64.b64decode(art.get('body_b64','')); self.send_response(art.get('status',200))
                    for k,v in art.get('headers',{}).items(): self.send_header(k,v)
                    self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body); return
                body=self.rfile.read(int(self.headers.get('Content-Length','0')))
                owner.records.append({'method':self.command,'target':self.path,'headers':list(self.headers.items()),'body_b64':base64.b64encode(body).decode()})
                plan=owner.response
                if isinstance(plan,list): plan=plan[min(len(owner.records)-1,len(plan)-1)]
                if plan.get('interim'): self.wfile.write(b'HTTP/1.1 100 Continue\r\n\r\n')
                status=plan.get('status',200); raw=base64.b64decode(plan.get('body_b64',''))
                self.send_response(status)
                for k,v in plan.get('headers',{}).items():
                    for val in v if isinstance(v,list) else [v]: self.send_header(k,val)
                self.send_header('Content-Length',str(len(raw)+plan.get('truncate',0))); self.send_header('Connection','close'); self.end_headers()
                if self.command!='HEAD': self.wfile.write(raw)
                self.close_connection=True
            do_GET=do_POST=do_PUT=do_PATCH=do_DELETE=do_HEAD=do_OPTIONS=go
        self.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
        self.port=self.server.server_port; self.thread=threading.Thread(target=self.server.serve_forever,daemon=True); self.thread.start()
    def close(self): self.server.shutdown(); self.server.server_close()

def equal(observed,expected,label):
    if observed!=expected: raise AssertionError(f'{label}: observed {observed!r}; expected {expected!r}')

def native_check(records,expected):
    equal(len(records),len(expected),'native request count')
    for r,e in zip(records,expected):
        equal(r['method'],e.get('method','POST'),'native method')
        split=urllib.parse.urlsplit(r['target'])
        # Hex spelling is free, but encoded '/' remains distinct from a path separator.
        normalize=lambda s:re.sub('%[0-9a-fA-F]{2}',lambda m:m[0].upper(),s)
        equal(normalize(split.path),normalize(e['path']),'native path')
        pairs=urllib.parse.parse_qsl(split.query,keep_blank_values=True,encoding='utf-8',errors='strict')
        groups={}
        for k,v in pairs: groups.setdefault(k,[]).append(v)
        equal(groups,e.get('query',{}),'native query groups preserving repeated order')
        heads={}
        for k,v in r['headers']: heads.setdefault(k.lower(),[]).append(v.encode('latin1').decode('utf-8'))
        for k,v in e.get('headers',{}).items(): equal(heads.get(k.lower()),[v],'native header '+k)
        for k in e.get('absent_headers',[]): equal(k.lower() in heads,False,'absent header '+k)
        data=base64.b64decode(r['body_b64'])
        for coding in reversed([x.strip() for x in heads.get('content-encoding',[''])[0].split(',') if x]):
            if coding=='gzip': data=gzip.decompress(data)
            elif coding=='deflate': data=zlib.decompress(data)
            else: raise AssertionError('native unknown coding')
        mode=e.get('body_kind','bytes')
        if mode=='json': equal(json.loads(data),e['body'],'native JSON')
        elif mode=='form':
            groups={}
            for k,v in urllib.parse.parse_qsl(data.decode('utf-8'),keep_blank_values=True): groups.setdefault(k,[]).append(v)
            equal(groups,e['body'],'native form')
        elif mode=='multipart':
            message=BytesParser(policy=policy.default).parsebytes(('Content-Type: '+heads['content-type'][0]+'\r\nMIME-Version: 1.0\r\n\r\n').encode()+data)
            groups={}
            for part in message.iter_parts():
                equal(part.get_content_disposition(),'form-data','part disposition'); equal(part.get_filename(),None,'no invented filename')
                name=part.get_param('name',header='Content-Disposition'); octets=part.get_payload(decode=True); charset=part.get_content_charset()
                if part.get_content_type()=='text/plain' and charset is None and octets.isascii(): charset='utf-8'  # ASCII is identical under allowed default; compare interpreted text, not redundant metadata.
                groups.setdefault(name,[]).append({'octets':base64.b64encode(octets).decode(),'type':part.get_content_type(),'charset':charset})
            equal(groups,e['body'],'native parts')
        else: equal(base64.b64encode(data).decode(),e.get('body_b64',''),'native octets')

def operation_check(obi,caller,values):
    """Independent checker only for the explicit simple current-core schemas emitted here."""
    op=next(iter(obi['operations'].values()))
    def check(schema,value):
        if isinstance(schema,bool): equal(schema,True,'boolean operation schema'); return
        if 'const' in schema: equal(value,schema['const'],'operation const'); return
        if '$ref' in schema:
            s=obi
            for x in schema['$ref'][2:].split('/'): s=s[x]
            return check(s,value)
        typ=schema.get('type')
        if typ:
            valid={'object':isinstance(value,dict),'array':isinstance(value,list),'string':isinstance(value,str),'integer':type(value)==int,'number':type(value) in (float,int),'boolean':type(value)==bool,'null':value is None}
            equal(valid[typ],True,'operation type')
        if isinstance(value,dict):
            for k in schema.get('required',[]): equal(k in value,True,'operation required')
            for k,v in value.items():
                if k in schema.get('properties',{}): check(schema['properties'][k],v)
                elif schema.get('additionalProperties') is False: raise AssertionError('unexpected operation property '+k)
        if isinstance(value,list) and 'items' in schema:
            for v in value: check(schema['items'],v)
        if 'enum' in schema: equal(value in schema['enum'],True,'operation enum')
    if caller!='__ABSENT__' and 'input' in op: check(op['input'],caller)
    for v in values:
        if 'output' in op: check(op['output'],v)
