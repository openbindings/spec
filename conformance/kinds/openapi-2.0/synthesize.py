"""Independent narrow synthesis, not an OAS->JSON Schema general translator."""
import copy

def translate(s):
    safe={'type','properties','required','items','additionalProperties','enum','description'}
    if not isinstance(s,dict) or set(s)-safe: raise ValueError('cannot faithfully translate outside explicit shared subset')
    if s.get('type') not in ('object','array','string','integer','number','boolean','null'): raise ValueError('needs explicit supported type')
    out=copy.deepcopy(s)
    for k in ('items','additionalProperties'):
        if isinstance(out.get(k),dict): out[k]=translate(out[k])
    if 'properties' in out: out['properties']={k:translate(v) for k,v in out['properties'].items()}
    return out

def synthesize(document,path='/invoke',method='post'):
    op=document['paths'][path][method]
    if op.get('consumes',document.get('consumes'))!=['application/json'] or op.get('produces',document.get('produces'))!=['application/json']: raise ValueError('only JSON synthesis')
    params=op.get('parameters',[])
    if len(params)!=1 or params[0].get('in')!='body' or params[0].get('required') is not True: raise ValueError('one required body')
    if set(op['responses'])!={'200'}: raise ValueError('one 200 synthesis')
    ins=translate(params[0]['schema']); outs=translate(op['responses']['200']['schema'])
    return {'openbindings':'0.2.0','name':'Independent bounded synthesis','operations':{'invoke':{'input':{'type':'object','properties':{'body':ins},'required':['body'],'additionalProperties':False},'output':outs}},'sources':{'oas':{'kind':'openbindings.openapi-2.0@1','content':{'document':copy.deepcopy(document)}}},'bindings':{'invoke.http':{'operation':'invoke','source':'oas','content':{'target':'/paths/'+path.replace('~','~0').replace('/','~1')+'/'+method}}}}
