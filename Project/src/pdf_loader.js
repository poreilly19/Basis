/* BEGIN BASIS PDF LOADER */
"use strict";

// Deadline/abort handling does not await cleanup. Dynamic imports and some PDF
// operations cannot be cancelled; their late completions never settle this wait.
function basisPdfWait(work,{timeoutMs=30000,signal,label="PDF operation",onStop}={}){
  const validLimit=typeof timeoutMs==="number"&&Number.isFinite(timeoutMs)&&timeoutMs>0&&timeoutMs<=2147483647;
  if(!validLimit)return Promise.reject(new TypeError("PDF timeout must be a positive number no greater than 2147483647 milliseconds."));
  if(typeof label!=="string"||!label.trim())return Promise.reject(new TypeError("PDF operation label must be a nonempty string."));
  if(onStop!==undefined&&typeof onStop!=="function")return Promise.reject(new TypeError("PDF cleanup must be a function."));
  if(signal&&(typeof signal.addEventListener!=="function"||typeof signal.removeEventListener!=="function")){
    return Promise.reject(new TypeError("PDF operation signal must be an AbortSignal."));
  }
  return new Promise((resolve,reject)=>{
    let settled=false,timer=null;
    // A caller may already have started a promise before observing an abort.
    // Consume its eventual rejection even if this wait stops before its first
    // microtask; lazy functions remain uninvoked after an early stop.
    const promised=typeof work==="function"?null:Promise.resolve(work);
    if(promised)promised.catch(()=>{});
    const finish=(error,value,stopped=false)=>{
      if(settled)return;settled=true;
      if(timer!==null)clearTimeout(timer);
      if(signal){try{signal.removeEventListener("abort",abort);}catch(_){}}
      if(stopped&&onStop){try{Promise.resolve(onStop(error)).catch(()=>{});}catch(_){}}
      if(error)reject(error);else resolve(value);
    };
    const abort=()=>{
      const reason=signal&&signal.reason,error=new Error(typeof reason==="string"&&reason?reason:
        reason&&typeof reason.message==="string"?reason.message:label+" cancelled.");
      error.name="AbortError";error.code="pdf_operation_aborted";
      if(reason!==undefined)error.cause=reason;
      finish(error,undefined,true);
    };
    if(signal&&signal.aborted){abort();return;}
    try{
      timer=setTimeout(()=>{
        const error=new Error(label+" exceeded its time limit.");error.name="TimeoutError";error.code="pdf_operation_timeout";
        finish(error,undefined,true);
      },timeoutMs);
      if(signal){signal.addEventListener("abort",abort,{once:true});if(signal.aborted){abort();return;}}
    }catch(error){finish(error);return;}
    Promise.resolve().then(()=>settled?undefined:typeof work==="function"?work():promised).then(
      value=>finish(null,value),error=>finish(error));
  });
}

function basisCreatePdfLoader({loadModule,transport,timeoutMs=10000,candidates=["4.10.38","4.4.168"]}={}){
  if(loadModule!==undefined&&typeof loadModule!=="function")throw new TypeError("PDF module loading must be a function.");
  if(transport!==undefined&&(!transport||typeof transport.load!=="function"))throw new TypeError("PDF transport must provide load().");
  if(transport!==undefined&&loadModule!==undefined)throw new TypeError("Choose either a PDF transport or a trusted injected module loader.");
  if(typeof timeoutMs!=="number"||!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>2147483647){
    throw new TypeError("PDF module timeout must be a positive number no greater than 2147483647 milliseconds.");
  }
  const approved=new Set(["4.10.38","4.4.168"]);
  if(!Array.isArray(candidates)||!candidates.length||candidates.length>approved.size||
    candidates.some(version=>!approved.has(version))||new Set(candidates).size!==candidates.length){
    throw new TypeError("PDF reader candidates must be distinct approved 4.x versions: 4.10.38 and 4.4.168.");
  }
  // Production always uses the pinned transport. loadModule is an explicit
  // trusted test/host adapter, never a recovery path after verification fails.
  const verifiedTransport=loadModule===undefined?(transport||basisCreatePdfTransport()):null;
  const versions=candidates.slice();let generation=0,active=null,cached=null;
  const current=request=>active===request&&request.generation===generation;
  const isObject=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
  function validate(pair,version){
    const lib=pair&&pair.lib;
    if(!lib||lib.version!==version||typeof lib.getDocument!=="function"||
      !(typeof lib.GlobalWorkerOptions==="function"||isObject(lib.GlobalWorkerOptions))){
      throw new Error("PDF reader module does not match version "+version+" or its required API.");
    }
    if(verifiedTransport){
      if(pair.verified!==true||pair.version!==version||typeof pair.workerUrl!=="string"||!pair.workerUrl.startsWith("blob:"))
        throw new Error("PDF transport did not return a verified matching worker Blob URL.");
    }else{
      const handler=pair.worker&&pair.worker.WorkerMessageHandler;
      if(typeof handler!=="function"&&!isObject(handler))throw new Error("PDF worker module is missing its message handler.");
    }
  }
  async function attempt(request){
    const attempts=[];let last;
    for(const version of versions){
      if(!current(request))return;
      const base="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/"+version+"/",workerUrl=base+"pdf.worker.min.mjs",
        candidate=new AbortController(),abort=()=>candidate.abort(request.controller.signal.reason);
      request.controller.signal.addEventListener("abort",abort,{once:true});
      if(request.controller.signal.aborted)abort();
      try{
        const work=()=>verifiedTransport?verifiedTransport.load(version,{signal:candidate.signal}):Promise.all([
          Promise.resolve().then(()=>loadModule(base+"pdf.min.mjs")),
          Promise.resolve().then(()=>loadModule(workerUrl))
        ]).then(([lib,worker])=>({lib,worker,version,workerUrl,verified:false}));
        const pair=await basisPdfWait(work,{timeoutMs,signal:request.controller.signal,label:"PDF.js "+version+" modules",
          onStop:error=>candidate.abort(error)});
        if(!current(request))return;
        validate(pair,version);
        pair.lib.GlobalWorkerOptions.workerSrc=pair.workerUrl;
        if(pair.lib.GlobalWorkerOptions.workerSrc!==pair.workerUrl)throw new Error("PDF worker URL could not be configured.");
        if(!current(request))return;
        cached=pair;active=null;request.resolve(pair);return;
      }catch(error){
        candidate.abort(error);
        if(!current(request))return;
        last=error;attempts.push({version,name:error&&error.name||"Error",message:error&&error.message||String(error)});
      }finally{request.controller.signal.removeEventListener("abort",abort);}
    }
    if(!current(request))return;
    active=null;
    const error=new Error("The PDF reader and its worker could not load or verify. Check the connection or try again.");
    error.name="PdfLoadError";error.code="pdf_load_failed";error.attempts=attempts;
    if(last!==undefined)error.cause=last;
    request.reject(error);
  }
  function load(){
    if(cached)return Promise.resolve(cached);
    if(active)return active.promise;
    const request={generation,controller:new AbortController(),resolve:null,reject:null,promise:null};
    request.promise=new Promise((resolve,reject)=>{request.resolve=resolve;request.reject=reject;});active=request;
    Promise.resolve().then(()=>attempt(request)).catch(error=>{
      if(current(request)){active=null;request.reject(error);}
    });
    return request.promise;
  }
  function invalidate(){
    generation++;cached=null;
    const previous=active;active=null;
    if(previous){
      const error=new Error("PDF reader load invalidated.");error.name="AbortError";error.code="pdf_loader_invalidated";
      previous.reject(error);previous.controller.abort(error);
    }
  }
  return {load,invalidate};
}
/* END BASIS PDF LOADER */
