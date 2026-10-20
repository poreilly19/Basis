/* BEGIN BASIS PDF INTEGRITY */
"use strict";
const BASIS_PDF_ARTIFACTS=Object.freeze({
  "4.10.38":Object.freeze({
    reader:Object.freeze({url:"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs",size:352645,sha256:"27fc2a057a00f92a4334ad06e17dbd7259912954e9fb7f76400bcca5fd190a9c"}),
    worker:Object.freeze({url:"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs",size:1375838,sha256:"1baa1844c89c80a5b2797c916e75ab29254be46d8e9cb53cb6364d7aad84be36"})
  }),
  "4.4.168":Object.freeze({
    reader:Object.freeze({url:"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs",size:327044,sha256:"895c72c332dbd608a07ae54003e5e42741c566ade52ddbd2a00c8e57ffa35d9d"}),
    worker:Object.freeze({url:"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs",size:1360964,sha256:"a7cf858ab0bbe21a00ef438c24a4ef5833c3d05935a294382c8d0773a8958f50"})
  })
});

// Successful reader/worker Blob URLs belong to this transport's lifetime, not
// to one loader attempt or one PDF. The app retains at most two verified pairs
// until its owner explicitly disposes the transport after all PDFs are done.
function basisCreatePdfTransport({artifacts=BASIS_PDF_ARTIFACTS,
  fetchImpl=(...args)=>{if(typeof fetch!=="function")throw Error("PDF verification requires Fetch.");return fetch(...args);},
  digestImpl=bytes=>{if(typeof crypto==="undefined"||!crypto.subtle||typeof crypto.subtle.digest!=="function")throw Error("PDF verification requires Web Crypto SHA-256.");return crypto.subtle.digest("SHA-256",bytes);},
  importModule=url=>import(url),
  createObjectURL=blob=>URL.createObjectURL(blob),revokeObjectURL=url=>URL.revokeObjectURL(url)}={}){
  for(const adapter of [fetchImpl,digestImpl,importModule,createObjectURL,revokeObjectURL]){
    if(typeof adapter!=="function")throw new TypeError("PDF integrity adapters must be functions.");
  }
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  const record=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
  const keys=(value,expected)=>record(value)&&Object.keys(value).length===expected.length&&expected.every(key=>own(value,key));
  if(!record(artifacts))throw new TypeError("PDF integrity metadata must be a version map.");
  const versions=Object.keys(artifacts),metadata=new Map(),urls=new Set();
  if(!versions.length||versions.length>2||versions.some(version=>!own(BASIS_PDF_ARTIFACTS,version))){
    throw new TypeError("PDF integrity metadata must contain one or two approved versions.");
  }
  for(const version of versions){
    const pair=artifacts[version];if(!keys(pair,["reader","worker"]))throw new TypeError("PDF integrity metadata requires a reader and worker.");
    const snapshot={};
    for(const kind of ["reader","worker"]){
      const artifact=pair[kind];
      if(!keys(artifact,["url","size","sha256"])||typeof artifact.url!=="string"||
        !Number.isSafeInteger(artifact.size)||artifact.size<1||artifact.size>4*1024*1024||
        typeof artifact.sha256!=="string"||!/^[0-9a-f]{64}$/.test(artifact.sha256)){
        throw new TypeError("PDF artifact metadata has an invalid URL, size or SHA-256.");
      }
      let parsed;try{parsed=new URL(artifact.url);}catch(_){throw new TypeError("PDF artifact URL must be HTTPS.");}
      if(parsed.protocol!=="https:"||parsed.username||parsed.password||parsed.hash||urls.has(artifact.url)){
        throw new TypeError("PDF artifact URLs must be distinct HTTPS URLs without credentials or fragments.");
      }
      urls.add(artifact.url);snapshot[kind]={url:artifact.url,size:artifact.size,sha256:artifact.sha256};
    }
    metadata.set(version,snapshot);
  }
  const pending=new Set(),cached=new Map();let disposed=false;
  function error(name,message,code,cause){const value=new Error(message);value.name=name;value.code=code;if(cause!==undefined)value.cause=cause;return value;}
  const aborted=reason=>error("AbortError",typeof reason==="string"&&reason?reason:
    reason&&typeof reason.message==="string"?reason.message:"PDF verification cancelled.","pdf_integrity_aborted",reason);
  function safely(work){try{Promise.resolve(work()).catch(()=>{});}catch(_){}}
  function revoke(job){for(const url of job.urls){safely(()=>revokeObjectURL(url));}job.urls.clear();}
  function cancelReader(entry,reason){
    if(entry.cancelled)return;entry.cancelled=true;safely(()=>entry.reader.cancel(reason));
    safely(()=>entry.reader.releaseLock());
  }
  function detach(job){pending.delete(job);if(job.signal&&job.onAbort){try{job.signal.removeEventListener("abort",job.onAbort);}catch(_){}}}
  function stop(job,reason){
    if(job.stopped||job.finished)return;job.stopped=true;job.error=reason;
    safely(()=>job.controller.abort(reason));
    for(const reader of job.readers)cancelReader(reader,reason);
    job.readers.clear();revoke(job);detach(job);job.reject(reason);
  }
  function check(job){if(job.stopped)throw job.error;if(disposed)throw error("Error","PDF integrity transport has been disposed.","pdf_integrity_disposed");}
  function cancelBody(response,reason){if(response&&response.body&&typeof response.body.cancel==="function")safely(()=>response.body.cancel(reason));}
  async function readArtifact(job,artifact){
    check(job);
    const response=await fetchImpl(artifact.url,{mode:"cors",credentials:"omit",redirect:"error",cache:"no-store",signal:job.controller.signal});
    try{check(job);}catch(reason){cancelBody(response,reason);throw reason;}
    if(!response||response.ok!==true||response.type==="opaque"||response.type==="opaqueredirect"){
      const reason=error("Error","PDF artifact request failed.","pdf_integrity_http");cancelBody(response,reason);throw reason;
    }
    if(!response.body||typeof response.body.getReader!=="function"){
      const reason=error("Error","PDF verification requires a readable response stream.","pdf_integrity_stream");cancelBody(response,reason);throw reason;
    }
    let reader;try{reader=response.body.getReader();}catch(cause){cancelBody(response,cause);throw cause;}
    if(!reader||typeof reader.read!=="function"||typeof reader.cancel!=="function"||typeof reader.releaseLock!=="function"){
      if(reader&&typeof reader.cancel==="function")safely(()=>reader.cancel());else cancelBody(response);
      if(reader&&typeof reader.releaseLock==="function")safely(()=>reader.releaseLock());
      throw error("Error","PDF artifact stream reader is invalid.","pdf_integrity_stream");
    }
    const entry={reader,cancelled:false};job.readers.add(entry);
    const bytes=new Uint8Array(artifact.size);let size=0,reads=0,complete=false;
    try{
      for(;;){
        check(job);if(++reads>65536)throw error("Error","PDF artifact stream has too many chunks.","pdf_integrity_size");
        const chunk=await reader.read();check(job);
        if(!record(chunk)||typeof chunk.done!=="boolean")throw error("Error","PDF artifact stream returned invalid data.","pdf_integrity_stream");
        if(chunk.done){complete=true;break;}
        if(!ArrayBuffer.isView(chunk.value)||Object.prototype.toString.call(chunk.value)!=="[object Uint8Array]"){
          throw error("Error","PDF artifact stream returned invalid bytes.","pdf_integrity_stream");
        }
        if(chunk.value.byteLength>artifact.size-size)throw error("Error","PDF artifact exceeds its pinned size.","pdf_integrity_size");
        bytes.set(chunk.value,size);size+=chunk.value.byteLength;
      }
      if(size!==artifact.size)throw error("Error","PDF artifact does not match its pinned size.","pdf_integrity_size");
    }finally{
      if(!complete)cancelReader(entry,job.error);else safely(()=>reader.releaseLock());
      job.readers.delete(entry);
    }
    check(job);const digest=await digestImpl(bytes);check(job);
    let hash;
    if(Object.prototype.toString.call(digest)==="[object ArrayBuffer]")hash=new Uint8Array(digest);
    else if(ArrayBuffer.isView(digest))hash=new Uint8Array(digest.buffer,digest.byteOffset,digest.byteLength);
    if(!hash||hash.byteLength!==32)throw error("Error","PDF SHA-256 verification returned an invalid digest.","pdf_integrity_digest");
    const actual=Array.from(hash,value=>value.toString(16).padStart(2,"0")).join("");
    if(actual!==artifact.sha256)throw error("Error","PDF artifact SHA-256 does not match its pin.","pdf_integrity_digest");
    return bytes;
  }
  function objectUrl(job,bytes){
    check(job);const url=createObjectURL(new Blob([bytes],{type:"text/javascript"}));
    if(typeof url!=="string"||!url.startsWith("blob:")||job.urls.has(url))throw error("Error","PDF verification requires distinct Blob module URLs.","pdf_integrity_url");
    job.urls.add(url);if(job.stopped||disposed){revoke(job);check(job);}return url;
  }
  async function execute(job,version){
    const pins=metadata.get(version),[readerBytes,workerBytes]=await Promise.all([
      readArtifact(job,pins.reader),readArtifact(job,pins.worker)
    ]);
    check(job);
    // Neither artifact can execute until both independently pass exact length
    // and SHA-256 verification. The worker is never imported into this window.
    if(cached.has(version)){const pair=cached.get(version).pair;job.finished=true;detach(job);job.resolve(pair);return;}
    const readerUrl=objectUrl(job,readerBytes),workerUrl=objectUrl(job,workerBytes);
    const lib=await importModule(readerUrl);check(job);
    if(!lib||lib.version!==version||typeof lib.getDocument!=="function"||
      !(record(lib.GlobalWorkerOptions)||typeof lib.GlobalWorkerOptions==="function")){
      throw error("Error","Verified PDF reader does not provide its pinned version and API.","pdf_integrity_api");
    }
    check(job);
    if(cached.has(version)){
      revoke(job);const pair=cached.get(version).pair;job.finished=true;detach(job);job.resolve(pair);return;
    }
    const pair=Object.freeze({lib,version,workerUrl,verified:true});
    cached.set(version,{pair,urls:new Set(job.urls)});job.urls.clear();job.finished=true;detach(job);job.resolve(pair);
  }
  function load(version,{signal}={}){
    if(disposed)return Promise.reject(error("Error","PDF integrity transport has been disposed.","pdf_integrity_disposed"));
    if(!metadata.has(version))return Promise.reject(error("Error","Unapproved PDF artifact version.","pdf_integrity_version"));
    if(signal&&(typeof signal.addEventListener!=="function"||typeof signal.removeEventListener!=="function"))return Promise.reject(new TypeError("PDF integrity signal must be an AbortSignal."));
    if(signal&&signal.aborted)return Promise.reject(aborted(signal.reason));
    if(cached.has(version))return Promise.resolve(cached.get(version).pair);
    let controller;try{controller=new AbortController();}catch(cause){return Promise.reject(error("Error","PDF verification requires AbortController.","pdf_integrity_unavailable",cause));}
    const job={controller,signal,onAbort:null,urls:new Set(),readers:new Set(),stopped:false,finished:false,error:null,resolve:null,reject:null};
    const promise=new Promise((resolve,reject)=>{job.resolve=resolve;job.reject=reject;});pending.add(job);
    if(signal){
      job.onAbort=()=>stop(job,aborted(signal.reason));
      try{signal.addEventListener("abort",job.onAbort,{once:true});if(signal.aborted)job.onAbort();}catch(cause){stop(job,cause);}
    }
    if(!job.stopped)Promise.resolve().then(()=>execute(job,version)).catch(reason=>stop(job,reason));
    return promise;
  }
  function dispose(){
    if(disposed)return;disposed=true;
    for(const job of [...pending])stop(job,aborted("PDF integrity transport disposed."));
    for(const entry of cached.values())revoke(entry);cached.clear();
  }
  return {load,dispose};
}
/* END BASIS PDF INTEGRITY */
