/* BEGIN BASIS CALCULATION WORKER: executed after the canonical engine and codec. */
"use strict";

// Requests contain model data only. Cancellation is performed by terminating
// the worker, since synchronous financial calculations cannot process messages.
function basisWorkerValidate(kind,model){
  if(kind==='property'){basisValidateModel(model);return;}
  if(kind!=='portfolio')throw Error('Unsupported calculation request kind');
  if(!basisPlain(model)||!Array.isArray(model.portfolio))throw Error('Portfolio calculation requires a portfolio model');
  basisValidateJSON(model);
  if(model.portfolio.length>1000)throw Error('Portfolio calculation exceeds the 1000-property limit');
  for(const member of model.portfolio){
    if(!basisPlain(member))throw Error('Portfolio calculation contains an invalid member');
    if(member.include!==undefined&&typeof member.include!=='boolean')throw Error('Portfolio inclusion flag must be boolean');
    if(member.include!==false)basisValidateModel(member.model);
  }
}

function basisWorkerPack(result,kind){
  let packed=result;
  if(kind==='property'){
    if(!basisPlain(result)||typeof result.payoff!=='function')throw Error('Calculation did not provide a debt payoff function');
    packed={...result};delete packed.payoff;
  }
  const pending=[packed],seen=new WeakSet();
  while(pending.length){
    const value=pending.pop(),type=typeof value;
    if(type==='function'||type==='symbol')throw Error('Calculation returned unsupported executable data');
    if(!value||type!=='object'||seen.has(value))continue;
    seen.add(value);
    if(ArrayBuffer.isView(value)||value instanceof ArrayBuffer)continue;
    if(value instanceof Map){for(const [key,item] of value){pending.push(key,item);}continue;}
    if(value instanceof Set){for(const item of value)pending.push(item);continue;}
    if(value instanceof WeakMap||value instanceof WeakSet)throw Error('Calculation returned unsupported data');
    for(const key of Object.keys(value))pending.push(value[key]);
  }
  return packed;
}

function basisWorkerError(error){
  const text=(value,max)=>{try{return String(value).slice(0,max);}catch(ignore){return 'Calculation failed';}};
  let name='Error',message='Calculation failed',issues;
  try{
    if(error&&typeof error.name==='string')name=text(error.name,100);
    message=text(error&&error.message!==undefined?error.message:error,16384);
    if(error&&Array.isArray(error.issues))issues=error.issues.slice(0,100).map(value=>text(value,1000));
  }catch(ignore){}
  return {name,message,...(issues?{issues}:{})};
}

self.onmessage=function(event){
  const request=event&&event.data;
  const id=request&&Number.isSafeInteger(request.id)&&request.id>0?request.id:null;
  try{
    if(id===null)throw Error('Calculation request id must be a positive safe integer');
    if(!basisPlain(request))throw Error('Invalid calculation request');
    if(request.kind!=='property'&&request.kind!=='portfolio')throw Error('Unsupported calculation request kind');
    basisWorkerValidate(request.kind,request.model);
    const start=Date.now();
    const result=request.kind==='property'?calc(request.model):calcPortfolio(request.model);
    self.postMessage({id,result:basisWorkerPack(result,request.kind),elapsedMs:Date.now()-start});
  }catch(error){self.postMessage({id,error:basisWorkerError(error)});}
};
/* END BASIS CALCULATION WORKER */
