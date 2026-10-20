/* BEGIN BASIS CALCULATION CLIENT */
"use strict";

// A request owns its worker until it settles. Superseding, aborting or timing out
// a synchronous calculation terminates that worker; no computation falls back
// to the UI thread here. Successful workers can serve subsequent requests.
function basisCreateCalculationClient({createWorker,timeoutMs=30000,hydrate}={}){
  if(typeof createWorker!=="function")throw new TypeError("A calculation worker factory is required.");
  const validTimeout=value=>typeof value==="number"&&Number.isFinite(value)&&value>0&&value<=2147483647;
  if(!validTimeout(timeoutMs))throw new TypeError("Calculation timeout must be a positive number no greater than 2147483647 milliseconds.");
  if(hydrate!==undefined&&typeof hydrate!=="function")throw new TypeError("Calculation hydration must be a function.");
  let worker=null,active=null,sequence=0,disposed=false,lastElapsedMs=null;
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  function failure(name,message,code,cause){
    const error=new Error(message);error.name=name;error.code=code;
    if(cause!==undefined)error.cause=cause;
    return error;
  }
  function abortError(reason){
    const message=typeof reason==="string"&&reason?reason:
      reason&&typeof reason.message==="string"?reason.message:"Calculation cancelled.";
    return failure("AbortError",message,"calculation_cancelled",reason);
  }
  function stopWorker(){
    const previous=worker;worker=null;
    if(!previous)return;
    // Detach as well as terminate: queued events and injected workers can still
    // deliver callbacks after termination, and must not affect the next run.
    for(const name of ["onmessage","onerror","onmessageerror"]){try{previous[name]=null;}catch(_){}}
    try{previous.terminate();}catch(_){}
  }
  function settle(request,error,result){
    if(active!==request)return;
    active=null;
    if(request.timer!==null)clearTimeout(request.timer);
    if(request.signal&&request.abort){try{request.signal.removeEventListener("abort",request.abort);}catch(_){}}
    if(error)request.reject(error);else request.resolve(result);
  }
  function failWorker(error){
    const request=active;stopWorker();
    if(request)settle(request,error);
  }
  function receive(source,event){
    const request=active;
    if(worker!==source||!request)return;
    const reply=event&&event.data;
    // A late reply from a completed request is harmless. An uncorrelated event
    // cannot finish the active request; its existing deadline still applies.
    if(!reply||typeof reply!=="object"||!Number.isSafeInteger(reply.id)||reply.id!==request.id)return;
    if(own(reply,"result")===own(reply,"error")){
      failWorker(failure("Error","Calculation worker returned an invalid response.","worker_protocol"));return;
    }
    if(own(reply,"error")){
      const detail=reply.error;
      if(!detail||typeof detail!=="object"||typeof detail.name!=="string"||typeof detail.message!=="string"||
        (own(detail,"issues")&&!Array.isArray(detail.issues))){
        failWorker(failure("Error","Calculation worker returned an invalid error.","worker_protocol"));return;
      }
      const error=failure(detail.name||"Error",detail.message,"calculation_error");
      if(own(detail,"issues"))error.issues=detail.issues;
      settle(request,error);return;
    }
    // A property must have an object result. Empty portfolios intentionally
    // produce null, which is part of the existing portfolio engine contract.
    if((reply.result===null&&request.kind!=="portfolio")||
      (reply.result!==null&&(typeof reply.result!=="object"||Array.isArray(reply.result)))){
      failWorker(failure("Error","Calculation worker returned an invalid result.","worker_protocol"));return;
    }
    let result=reply.result;
    try{
      if(hydrate){const restored=hydrate(result,request.kind);if(restored!==undefined)result=restored;}
      else if(request.kind==="property"&&typeof debtPayoffAt==="function"){
        result.payoff=index=>debtPayoffAt(result.loans,index);
      }
    }catch(error){
      failWorker(failure("Error","Calculation results could not be restored.","worker_hydration",error));return;
    }
    lastElapsedMs=typeof reply.elapsedMs==="number"&&Number.isFinite(reply.elapsedMs)&&reply.elapsedMs>=0?reply.elapsedMs:null;
    settle(request,null,result);
  }
  function ensureWorker(){
    if(worker)return;
    let created;
    try{
      created=createWorker();
      if(!created||typeof created.postMessage!=="function"||typeof created.terminate!=="function"){
        throw new TypeError("Calculation worker factory returned an invalid worker.");
      }
      worker=created;
      created.onmessage=event=>receive(created,event);
      created.onerror=event=>{
        if(worker!==created)return;
        if(event&&typeof event.preventDefault==="function")event.preventDefault();
        failWorker(failure("Error",event&&typeof event.message==="string"&&event.message?
          event.message:"Calculation worker failed.","worker_error"));
      };
      created.onmessageerror=()=>{
        if(worker===created)failWorker(failure("DataCloneError","Calculation worker returned unreadable data.","worker_messageerror"));
      };
    }catch(error){
      if(worker===created)stopWorker();
      else if(created&&typeof created.terminate==="function"){try{created.terminate();}catch(_){}}
      throw failure("Error","Background calculations are unavailable in this browser.","worker_unavailable",error);
    }
  }
  function cancel(reason){
    if(!active)return false;
    const request=active;stopWorker();settle(request,abortError(reason));return true;
  }
  function run(kind,model,options={}){
    if(disposed)return Promise.reject(failure("Error","Calculation client has been disposed.","disposed"));
    if(kind!=="property"&&kind!=="portfolio")return Promise.reject(new TypeError("Unknown calculation kind."));
    if(!options||typeof options!=="object")return Promise.reject(new TypeError("Calculation options must be an object."));
    const limit=options.timeoutMs===undefined?timeoutMs:options.timeoutMs,signal=options.signal;
    if(!validTimeout(limit))return Promise.reject(new TypeError("Calculation timeout must be a positive number no greater than 2147483647 milliseconds."));
    if(signal&&(typeof signal.addEventListener!=="function"||typeof signal.removeEventListener!=="function")){
      return Promise.reject(new TypeError("Calculation signal must be an AbortSignal."));
    }
    if(signal&&signal.aborted)return Promise.reject(abortError(signal.reason));
    cancel("Calculation superseded by a newer request.");
    if(sequence===Number.MAX_SAFE_INTEGER){stopWorker();sequence=0;}
    let resolve,reject;
    const promise=new Promise((accept,decline)=>{resolve=accept;reject=decline;});
    const request={id:++sequence,kind,resolve,reject,timer:null,signal,abort:null};active=request;
    try{
      ensureWorker();
      request.timer=setTimeout(()=>{
        if(active===request)failWorker(failure("TimeoutError","Calculation exceeded its time limit.","calculation_timeout"));
      },limit);
      if(signal){
        request.abort=()=>{if(active===request)cancel(signal.reason);};
        signal.addEventListener("abort",request.abort,{once:true});
        if(signal.aborted){request.abort();return promise;}
      }
      worker.postMessage({id:request.id,kind,model});
    }catch(error){
      if(active===request)failWorker(error&&error.code==="worker_unavailable"?error:
        failure(error&&error.name==="DataCloneError"?"DataCloneError":"Error",
          "Calculation could not be sent to the background worker.","worker_postmessage",error));
    }
    return promise;
  }
  return {run,cancel,dispose(){if(disposed)return;disposed=true;cancel("Calculation client disposed.");stopWorker();},
    get pending(){return active!==null;},get disposed(){return disposed;},get lastElapsedMs(){return lastElapsedMs;}};
}
/* END BASIS CALCULATION CLIENT */
