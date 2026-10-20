/* BEGIN BASIS XLSX LOADER */
"use strict";

// The optional spreadsheet library is loaded only when requested. Keeping the
// returned reference avoids depending on a global that another classic script
// could later replace. Removing a pending script is best-effort cancellation;
// it does not guarantee that already downloaded JavaScript will not execute.
function basisCreateXlsxLoader({getLibrary=()=>globalThis.XLSX,loadScript,timeoutMs=10000,
  url="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js",
  integrity="sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT"}={}){
  if(typeof getLibrary!=="function")throw new TypeError("Spreadsheet library lookup must be a function.");
  if(loadScript!==undefined&&typeof loadScript!=="function")throw new TypeError("Spreadsheet script loading must be a function.");
  if(typeof timeoutMs!=="number"||!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>2147483647){
    throw new TypeError("Spreadsheet timeout must be a positive number no greater than 2147483647 milliseconds.");
  }
  if(typeof url!=="string"||!url.trim())throw new TypeError("Spreadsheet script URL must be a nonempty string.");
  if(typeof integrity!=="string"||!/^sha384-[A-Za-z0-9+/]{64}$/.test(integrity)){
    throw new TypeError("Spreadsheet script integrity must be a SHA-384 SRI value.");
  }
  const methods=["book_new","aoa_to_sheet","encode_cell","encode_col","book_append_sheet","sheet_to_json"];
  const holder=value=>value!==null&&(typeof value==="object"||typeof value==="function")&&!Array.isArray(value);
  function validate(lib){
    if(!holder(lib)||lib.version!=="0.20.3"||typeof lib.read!=="function"||typeof lib.write!=="function"||
      !holder(lib.utils)||methods.some(name=>typeof lib.utils[name]!=="function")){
      throw new Error("The spreadsheet library must provide version 0.20.3 and its complete import/export API.");
    }
    return lib;
  }
  if(loadScript===undefined)loadScript=(src,{integrity:checksum,signal})=>new Promise((resolve,reject)=>{
    let script=null,done=false;
    function complete(error){
      if(done)return;done=true;
      if(signal){try{signal.removeEventListener("abort",abort);}catch(_){}}
      if(script){script.onload=null;script.onerror=null;try{script.remove();}catch(_){}}
      if(error)reject(error);else resolve();
    }
    function abort(){const error=new Error("Spreadsheet script loading stopped.");error.name="AbortError";complete(error);}
    if(signal&&signal.aborted){abort();return;}
    try{
      script=document.createElement("script");script.async=true;script.integrity=checksum;script.crossOrigin="anonymous";
      script.onload=()=>complete();script.onerror=()=>complete(new Error("The spreadsheet script could not load."));
      script.src=src;
      if(signal){signal.addEventListener("abort",abort,{once:true});if(signal.aborted){abort();return;}}
      document.head.append(script);
    }catch(error){complete(error);}
  });
  let generation=0,active=null,cached=null,cachedPromise=null;
  const current=request=>active===request&&request.generation===generation;
  function finish(request,error,lib){
    if(!current(request))return;
    active=null;if(request.timer!==null)clearTimeout(request.timer);
    if(error){request.controller.abort(error);request.reject(error);}
    else{cached=lib;cachedPromise=request.promise;request.resolve(lib);}
  }
  function load(){
    // A partial global appearing during a load cannot bypass that load's
    // completion, validation or deadline.
    if(active)return active.promise;
    if(cached)return cachedPromise;
    try{cached=validate(getLibrary());cachedPromise=Promise.resolve(cached);return cachedPromise;}catch(_){}
    const request={generation,controller:new AbortController(),timer:null,promise:null,resolve:null,reject:null};
    request.promise=new Promise((resolve,reject)=>{request.resolve=resolve;request.reject=reject;});active=request;
    try{
      request.timer=setTimeout(()=>{
        const error=new Error("The spreadsheet library took too long to load. Check the connection or try again.");
        error.name="TimeoutError";error.code="xlsx_load_timeout";finish(request,error);
      },timeoutMs);
    }catch(error){finish(request,error);return request.promise;}
    // The importer may be injected by tests or the host. It must resolve after
    // the script's load event; its return value is not treated as a library.
    Promise.resolve().then(()=>{
      if(current(request))return loadScript(url,{integrity,signal:request.controller.signal});
    }).then(()=>{
      if(!current(request))return;
      const lib=validate(getLibrary());
      if(current(request))finish(request,null,lib);
    }).catch(cause=>{
      if(!current(request))return;
      const error=new Error("The spreadsheet library could not load. Check the connection or try again.");
      error.name="XlsxLoadError";error.code="xlsx_load_failed";error.cause=cause;finish(request,error);
    });
    return request.promise;
  }
  function invalidate(){
    generation++;cached=null;cachedPromise=null;
    const previous=active;active=null;
    if(previous){
      if(previous.timer!==null)clearTimeout(previous.timer);
      const error=new Error("Spreadsheet library load invalidated.");error.name="AbortError";error.code="xlsx_loader_invalidated";
      previous.controller.abort(error);previous.reject(error);
    }
  }
  return {load,invalidate};
}
/* END BASIS XLSX LOADER */
