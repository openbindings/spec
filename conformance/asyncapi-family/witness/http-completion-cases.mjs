// Literal RFC/profile partitions frozen in GAP-R3-EXPECTATIONS.md. This module
// supplies bytes and authored peer events independently; it imports no parser.
const request = 'POST /api/events HTTP/1.1\r\nHost: example.test\r\n\r\n';
const trigger = (name='dispatch',count=1) => ({kind:'native',name,count});
const head = (status,headers=[],count=0) => ({kind:'response-head',after:trigger(count?'acknowledgement':'dispatch',count||1),httpVersion:'1.1',status,headers});
const body = (text,count=1) => ({kind:'body-chunk',after:trigger('acknowledgement',count),dataBase64:Buffer.from(text).toString('base64')});
const length = value => ({name:'Content-Length',value});
const expectation = (disposition,statuses,trace='valid',phase='completion') => ({disposition,phase,statuses,trace,request,connections:1});
const cancelAtHead = [{path:'/invocation',value:{inputPresent:false,actions:[{kind:'write',value:{}},{kind:'await-native',name:'acknowledgement',count:1},{kind:'cancel'}]}}];

const framed = [
  ['204',204,[], '', 'HTTP/1.1 204 No Content\r\n\r\n','complete'],
  ['200',200,[length('0')], '', 'HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n','complete'],
  ['205',205,[length('0')], '', 'HTTP/1.1 205 Reset Content\r\nContent-Length: 0\r\n\r\n','complete'],
  ['304',304,[length('1')], '', 'HTTP/1.1 304 Not Modified\r\nContent-Length: 1\r\n\r\n','error'],
  ['400',400,[length('1')], 'x', 'HTTP/1.1 400 Bad Request\r\nContent-Length: 1\r\n\r\nx','error'],
];
export const completionCases = framed.flatMap(([id,status,headers,content,response,disposition]) =>
  ['open','late-extra','coalesced-extra'].map(mode=>({
    id:`R3-${id}-${mode}`, rules:['ASYNC31-P-11','ASYNC31-P-12','ASYNC31-P-13'],
    response: response+(mode==='coalesced-extra'?'!':''),
    holdOpen: true, afterTerminal: mode==='late-extra'?'!':'',
    peerEvents:[head(status,headers),...(content?[body(content)]:[]),...(mode==='open'?[]:[body('!')])],
    expected:expectation(disposition,[status],mode==='open'?'valid':'invalid'),
  })));

for (const mode of ['late','coalesced']) completionCases.push({
  id:`R3-second-final-${mode}`,rules:['ASYNC31-P-13'],holdOpen:true,
  response:'HTTP/1.1 204 No Content\r\n\r\n'+(mode==='coalesced'?'HTTP/1.1 204 No Content\r\n\r\n':''),
  afterTerminal:mode==='late'?'HTTP/1.1 204 No Content\r\n\r\n':'',
  peerEvents:[head(204),head(204,[],1)],expected:expectation('complete',[204],'invalid'),
});
completionCases.push({
  id:'R3-split-interim-final',rules:['ASYNC31-P-11','ASYNC31-P-13'],holdOpen:true,
  responseChunks:['HTTP/1.1 103 Early Hints\r\n','\r\nHTTP/1.1 204 No Con','tent\r\n','\r\n'],
  peerEvents:[head(103),head(204,[],1)],expected:expectation('complete',[103,204]),
},{
  id:'R3-split-non2xx-body',rules:['ASYNC31-P-11','ASYNC31-P-13'],holdOpen:true,
  responseChunks:['HTTP/1.1 400 Bad Request\r\nContent-Length: 2\r\n\r\nx','y'],
  peerEvents:[head(400,[length('2')]),body('x'),body('y')],expected:expectation('error',[400]),
});
for (const [id,status,headers,,response,disposition] of framed.filter(x=>['204','304'].includes(x[0]))) completionCases.push({
  id:`R3-${id}-late-cancel`,rules:['ASYNC31-P-13'],holdOpen:true,response,changes:cancelAtHead,
  peerEvents:[head(status,headers)],expected:expectation(disposition,[status]),
});
for (const [id,status,headers,response] of [
  ['interim',103,[],'HTTP/1.1 103 Early Hints\r\n\r\n'],
  ['incomplete-final',400,[length('2')],'HTTP/1.1 400 Bad Request\r\nContent-Length: 2\r\n\r\n'],
]) completionCases.push({id:`R3-cancel-${id}`,rules:['ASYNC31-P-13'],response,changes:cancelAtHead,
  peerEvents:[head(status,headers)],expected:expectation('cancelled',[status],'valid','interaction')});

export const mediaPartitions = [
  ['token','text/plain',true], ['suffix','application/vnd.example+json',true],
  ['parameter','text/plain; charset=utf-8',true], ['separator-ows','text/plain \t;\t charset=utf-8',true],
  ['quoted-separators','text/plain; a="x;y=z"',true], ['escaped-quote','text/plain; a="x\\"y"',true],
  ['empty-quoted','text/plain; a=""',true], ['empty-members','text/plain; ;\t;',true],
  ['duplicate','text/plain; charset=a; charset=b',true],
  ['bws-before','text/plain; charset =utf-8',false], ['bws-after','text/plain; charset= utf-8',false],
  ['bws-tab','text/plain; charset\t=utf-8',false], ['empty-value','text/plain; charset=',false],
  ['empty-name','text/plain; =utf-8',false], ['missing-equals','text/plain; charset',false],
  ['unclosed-quote','text/plain; a="unterminated',false], ['dangling-escape','text/plain; a="x\\',false],
  ['quoted-control','text/plain; a="x\x01y"',false], ['quoted-del','text/plain; a="x\x7fy"',false],
  ['bad-type','text /plain',false], ['comma','text/plain; a=x,y',false],
];
for (const [id,value,valid] of mediaPartitions) completionCases.push({
  id:`R3-media-${id}`,rules:['ASYNC31-P-11','ASYNC31-P-13'],
  response:`HTTP/1.1 204 No Content\r\nContent-Type: ${value}\r\n\r\n`,
  peerEvents:[head(204,[{name:'Content-Type',value}])],
  expected:expectation(valid?'complete':'error',valid?[204]:[],valid?'valid':'invalid',valid?'completion':'response'),
});
for (const [id,response,events,statuses] of [
  ['forbidden-success','HTTP/1.1 200 OK\r\nContent-Length: 1\r\n\r\nx!', [head(200,[length('1')]),body('x!')],[200]],
  ['101','HTTP/1.1 101 Switching Protocols\r\n\r\nHTTP/1.1 204 No Content\r\n\r\n',[head(101),head(204,[],1)],[]],
  ['malformed-head','HTTP/1.1 204 No Content\r\nContent-Type: broken\r\n\r\nHTTP/1.1 204 No Content\r\n\r\n',[head(204,[{name:'Content-Type',value:'broken'}]),head(204,[],1)],[]],
]) completionCases.push({id:`R3-decisive-error-${id}`,rules:['ASYNC31-P-11','ASYNC31-P-12','ASYNC31-P-13'],
  response,peerEvents:events,expected:expectation('error',statuses,'invalid','response')});
completionCases.push({
  id:'R3-cancel-missing-length',rules:['ASYNC31-P-11','ASYNC31-P-13'],changes:cancelAtHead,
  response:'HTTP/1.1 200 OK\r\n\r\n',peerEvents:[head(200)],expected:expectation('error',[],'invalid','response'),
},{
  id:'R3-close-header-completion',rules:['ASYNC31-P-11','ASYNC31-P-13'],changes:cancelAtHead,holdOpen:true,
  response:'HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n',
  peerEvents:[head(204,[{name:'Connection',value:'close'}]),{kind:'disconnect',after:trigger('acknowledgement'),stage:'during-response'}],
  expected:expectation('complete',[204]),
},{
  id:'R3-cancel-invalid-connection',rules:['ASYNC31-P-11','ASYNC31-P-13'],changes:cancelAtHead,
  response:'HTTP/1.1 204 No Content\r\nConnection: close, foo\r\n\r\n',
  peerEvents:[head(204,[{name:'Connection',value:'close, foo'}])],expected:expectation('error',[],'invalid','response'),
});
