const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'../src/pdf_loader.js'),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
const versionOf=url=>/pdf\.js\/([^/]+)\//.exec(url)[1];
const isWorker=url=>url.endsWith('/pdf.worker.min.mjs');
const pair=version=>({lib:{version,getDocument(){},GlobalWorkerOptions:{}},worker:{WorkerMessageHandler:{setup(){}}}});
function fixture(){
  const timers=new Map(),sentinel={previous:'worker global'};let sequence=0;
  const context=vm.createContext({AbortController,pdfjsWorker:sentinel,
    setTimeout:(callback,delay)=>{const id=++sequence;timers.set(id,{callback,delay});return id;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(source,context);
  return {timers,context,sentinel,create:vm.runInContext('basisCreatePdfLoader',context),wait:vm.runInContext('basisPdfWait',context),
    expire(){const [id,timer]=timers.entries().next().value;timers.delete(id);timer.callback();}};
}
const hasCode=code=>error=>error.code===code;

test('concurrent loads share one complete version pair, install its URL and cache without global worker mutation',async()=>{
  const {create,timers,context,sentinel}=fixture(),lib=deferred(),worker=deferred(),calls=[];
  const loader=create({loadModule:url=>{calls.push(url);return isWorker(url)?worker.promise:lib.promise;}});
  const first=loader.load(),second=loader.load();assert.equal(first,second);await flush();
  assert.equal(calls.length,2);assert.ok(calls.every(url=>url.includes('/4.10.38/')&&url.endsWith('.mjs')));
  const modules=pair('4.10.38');let settled=false;first.then(()=>settled=true);
  lib.resolve(modules.lib);await flush();assert.equal(settled,false);assert.equal(modules.lib.GlobalWorkerOptions.workerSrc,undefined);
  worker.resolve(modules.worker);const result=await first;
  assert.equal(result.lib,modules.lib);assert.equal(result.worker,modules.worker);assert.equal(result.version,'4.10.38');
  assert.equal(result.workerUrl,calls.find(isWorker));assert.equal(result.lib.GlobalWorkerOptions.workerSrc,result.workerUrl);
  assert.equal(await loader.load(),result);assert.equal(calls.length,2);assert.equal(timers.size,0);assert.equal(context.pdfjsWorker,sentinel);
});

test('a worker import failure cannot use the successful reader and falls back to the matching approved pair',async()=>{
  const {create}=fixture(),first=pair('4.10.38'),second=pair('4.4.168'),calls=[];
  const loader=create({loadModule:url=>{
    calls.push(url);if(versionOf(url)==='4.10.38'){if(isWorker(url))throw Error('Worker import blocked');return first.lib;}
    return isWorker(url)?second.worker:second.lib;
  }});
  const result=await loader.load();assert.equal(result.version,'4.4.168');assert.equal(result.lib,second.lib);
  assert.equal(first.lib.GlobalWorkerOptions.workerSrc,undefined);assert.equal(calls.length,4);
  assert.ok(calls.every(url=>url.endsWith('.mjs')&&!url.includes('/3.')));
});

test('PDF.js class-shaped GlobalWorkerOptions accepts and installs its static workerSrc API',async()=>{
  const {create}=fixture();
  class GlobalWorkerOptions{
    static #workerSrc='';
    static get workerSrc(){return this.#workerSrc;}
    static set workerSrc(value){if(typeof value!=='string')throw Error('Invalid workerSrc type');this.#workerSrc=value;}
  }
  const lib={version:'4.10.38',getDocument(){},GlobalWorkerOptions},worker={WorkerMessageHandler:class WorkerMessageHandler{}};
  const loader=create({loadModule:url=>isWorker(url)?worker:lib});
  const loaded=await loader.load();
  assert.equal(loaded.lib,lib);assert.equal(loaded.worker,worker);
  assert.equal(GlobalWorkerOptions.workerSrc,'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs');
  assert.equal(await loader.load(),loaded);
});

test('invalid reader APIs, version mismatches, invalid workers and unconfigurable worker URLs never enter the cache',async()=>{
  const mutations=[p=>p.lib.version='4.4.168',p=>delete p.lib.getDocument,p=>p.lib.GlobalWorkerOptions=null,
    p=>p.lib.GlobalWorkerOptions=[],p=>delete p.worker.WorkerMessageHandler,p=>p.worker.WorkerMessageHandler=null,
    p=>p.worker.WorkerMessageHandler=[],p=>Object.freeze(p.lib.GlobalWorkerOptions)];
  for(const mutate of mutations){
    const {create,timers}=fixture(),modules=pair('4.10.38');mutate(modules);let calls=0;
    const loader=create({candidates:['4.10.38'],loadModule:url=>{calls++;return isWorker(url)?modules.worker:modules.lib;}});
    await assert.rejects(loader.load(),error=>error.code==='pdf_load_failed'&&error.attempts.length===1);
    await assert.rejects(loader.load(),hasCode('pdf_load_failed'));assert.equal(calls,4);assert.equal(timers.size,0);
  }
});

test('all failed imports settle every coalesced caller and allow an explicit retry',async()=>{
  const {create,timers}=fixture(),modules=pair('4.10.38');let fail=true,calls=0;
  const loader=create({loadModule:url=>{calls++;if(fail)return Promise.reject(Error('Offline'));return isWorker(url)?modules.worker:modules.lib;}});
  const a=loader.load(),b=loader.load(),c=loader.load();assert.equal(a,b);assert.equal(b,c);
  await assert.rejects(a,error=>error.name==='PdfLoadError'&&error.code==='pdf_load_failed'&&error.attempts.length===2);
  assert.equal(timers.size,0);assert.equal(calls,4);fail=false;
  const retried=loader.load();assert.notEqual(retried,a);assert.equal((await retried).version,'4.10.38');assert.equal(calls,6);
});

test('a stalled import reaches its candidate deadline, falls back and ignores the late first-version module',async()=>{
  const {create,timers,expire}=fixture(),first=pair('4.10.38'),second=pair('4.4.168'),late=deferred();
  const loader=create({timeoutMs:40,loadModule:url=>versionOf(url)==='4.10.38'?
    (isWorker(url)?first.worker:late.promise):(isWorker(url)?second.worker:second.lib)});
  const pending=loader.load();await flush();assert.equal([...timers.values()][0].delay,40);
  expire();const result=await pending;assert.equal(result.version,'4.4.168');
  late.resolve(first.lib);await flush();assert.equal(first.lib.GlobalWorkerOptions.workerSrc,undefined);
  assert.equal(await loader.load(),result);assert.equal(timers.size,0);
});

test('both never-settling candidates fail within their two deadlines for all concurrent callers',async()=>{
  const {create,timers,expire}=fixture();let calls=0;
  const loader=create({timeoutMs:25,loadModule(){calls++;return new Promise(()=>{});}}),a=loader.load(),b=loader.load();
  const rejected=assert.rejects(a,error=>error.code==='pdf_load_failed'&&error.cause.name==='TimeoutError'&&
    error.attempts.length===2&&error.attempts.every(attempt=>attempt.name==='TimeoutError'));
  assert.equal(a,b);await flush();assert.equal(timers.size,1);expire();await flush();
  assert.equal(timers.size,1);expire();await rejected;assert.equal(timers.size,0);assert.equal(calls,4);
});

test('invalidate promptly rejects pending callers, clears the deadline and prevents old completion from publishing',async()=>{
  const {create,timers}=fixture(),old=pair('4.10.38'),fresh=pair('4.10.38'),oldLib=deferred(),oldWorker=deferred();let generation=0;
  const loader=create({loadModule:url=>generation===0?(isWorker(url)?oldWorker.promise:oldLib.promise):
    (isWorker(url)?fresh.worker:fresh.lib)});
  const first=loader.load(),joined=loader.load(),rejected=assert.rejects(first,error=>error.name==='AbortError'&&error.code==='pdf_loader_invalidated');
  await flush();assert.equal(first,joined);loader.invalidate();assert.equal(timers.size,0);await rejected;
  generation++;const next=loader.load();assert.notEqual(next,first);const result=await next;
  oldLib.resolve(old.lib);oldWorker.resolve(old.worker);await flush();
  assert.equal(old.lib.GlobalWorkerOptions.workerSrc,undefined);assert.equal(result.lib,fresh.lib);assert.equal(await loader.load(),result);
});

test('invalidate clears a completed cache and the next load configures a newly loaded pair',async()=>{
  const {create}=fixture();let modules=pair('4.10.38'),calls=0;
  const loader=create({loadModule:url=>{calls++;return isWorker(url)?modules.worker:modules.lib;}});
  const old=await loader.load();loader.invalidate();modules=pair('4.10.38');const next=await loader.load();
  assert.notEqual(next,old);assert.notEqual(next.lib,old.lib);assert.equal(calls,4);assert.equal(next.lib.GlobalWorkerOptions.workerSrc,next.workerUrl);
});

test('configuration permits only a copied nonempty list of the two approved 4.x versions',async()=>{
  const {create}=fixture();
  for(const options of [{loadModule:3},{timeoutMs:0},{timeoutMs:Infinity},{timeoutMs:'10'},
    {candidates:[]},{candidates:['3.11.174']},{candidates:['4.0.0']},{candidates:['4.10.38','4.10.38']},{candidates:'4.10.38'}]){
    assert.throws(()=>create(options),error=>error.name==='TypeError');
  }
  const candidates=['4.4.168'],modules=pair('4.4.168'),calls=[];
  const loader=create({candidates,loadModule:url=>{calls.push(url);return isWorker(url)?modules.worker:modules.lib;}});
  candidates[0]='3.11.174';assert.equal((await loader.load()).version,'4.4.168');assert.ok(calls.every(url=>versionOf(url)==='4.4.168'));
});

test('function worker handlers remain valid and invalidation during worker URL installation cannot publish stale data',async()=>{
  const {create}=fixture(),modules=pair('4.10.38');modules.worker.WorkerMessageHandler=function WorkerMessageHandler(){};
  let loader,stored;Object.defineProperty(modules.lib.GlobalWorkerOptions,'workerSrc',{get:()=>stored,set(value){stored=value;loader.invalidate();}});
  loader=create({loadModule:url=>isWorker(url)?modules.worker:modules.lib});
  await assert.rejects(loader.load(),hasCode('pdf_loader_invalidated'));
  const fresh=pair('4.10.38');modules.lib=fresh.lib;modules.worker=fresh.worker;
  assert.equal((await loader.load()).lib,fresh.lib);
});

test('PDF wait preserves ordinary results and errors, clears listeners and calls no stop cleanup',async()=>{
  const {wait,timers}=fixture(),listeners=new Set();let stops=0;
  const signal={aborted:false,addEventListener:(_type,listener)=>listeners.add(listener),removeEventListener:(_type,listener)=>listeners.delete(listener)};
  const value={numPages:2};assert.equal(await wait(Promise.resolve(value),{signal,onStop(){stops++;}}),value);
  assert.equal(timers.size,0);assert.equal(listeners.size,0);
  const cause=Error('Invalid PDF');await assert.rejects(wait(()=>{throw cause;},{signal,onStop(){stops++;}}),error=>error===cause);
  assert.equal(stops,0);assert.equal(timers.size,0);assert.equal(listeners.size,0);
});

test('PDF wait deadlines stop once without awaiting cleanup and ignore late results and aborts',async()=>{
  const {wait,timers,expire}=fixture(),work=deferred(),controller=new AbortController();let stops=0,stopError;
  const pending=wait(work.promise,{timeoutMs:50,signal:controller.signal,label:'PDF page text',onStop(error){
    stops++;stopError=error;return new Promise(()=>{});
  }}),rejected=assert.rejects(pending,error=>error.name==='TimeoutError'&&error.code==='pdf_operation_timeout'&&/PDF page text/.test(error.message));
  assert.equal([...timers.values()][0].delay,50);expire();await rejected;
  work.resolve({text:'too late'});controller.abort('After deadline');await flush();
  assert.equal(stops,1);assert.equal(stopError.name,'TimeoutError');assert.equal(timers.size,0);
});

test('an early abort skips lazy work, consumes late promise rejection and ignores cleanup rejection',async()=>{
  const {wait,timers}=fixture(),controller=new AbortController();controller.abort('User cancelled PDF');let starts=0,stops=0;
  await assert.rejects(wait(()=>{starts++;},{signal:controller.signal,onStop(){stops++;return Promise.reject(Error('Cleanup rejected'));}}),
    error=>error.name==='AbortError'&&error.message==='User cancelled PDF');
  assert.equal(starts,0);assert.equal(stops,1);assert.equal(timers.size,0);
  const started=deferred(),pending=wait(started.promise,{signal:controller.signal});
  await assert.rejects(pending,error=>error.name==='AbortError');started.reject(Error('Uncancellable work rejected later'));await flush();
});

test('mid-operation abort settles immediately despite throwing cleanup and ignores a later work rejection',async()=>{
  const {wait,timers}=fixture(),controller=new AbortController(),work=deferred();let stops=0;
  const pending=wait(work.promise,{signal:controller.signal,onStop(){stops++;throw Error('Cleanup failed');}});
  const rejected=assert.rejects(pending,error=>error.name==='AbortError'&&error.code==='pdf_operation_aborted');
  await flush();controller.abort(Error('Import replaced'));await rejected;
  work.reject(Error('Late parser failure'));await flush();assert.equal(stops,1);assert.equal(timers.size,0);
});

test('PDF wait validates deadlines and options without starting lazy work',async()=>{
  const {wait,timers}=fixture();let starts=0;
  for(const options of [...[0,-1,NaN,Infinity,2147483648,'20'].map(timeoutMs=>({timeoutMs})),
    {label:''},{label:3},{onStop:true},{signal:{aborted:false}}]){
    await assert.rejects(wait(()=>{starts++;},options),error=>error.name==='TypeError');
  }
  assert.equal(starts,0);assert.equal(timers.size,0);
});

const verifiedPair=version=>({lib:pair(version).lib,version,workerUrl:'blob:verified-worker-'+version,verified:true});

test('the default path requires one verified transport and shares its complete Blob pair',async()=>{
  const {create,context,timers}=fixture(),gate=deferred(),value=verifiedPair('4.10.38');let factories=0,calls=0;
  context.basisCreatePdfTransport=()=>{factories++;return {load(version,{signal}){
    calls++;assert.equal(version,'4.10.38');assert.equal(signal.aborted,false);return gate.promise;
  }};};
  const loader=create(),a=loader.load(),b=loader.load();assert.equal(a,b);await flush();assert.equal(calls,1);
  gate.resolve(value);assert.equal(await a,value);assert.equal(await loader.load(),value);
  assert.equal(value.lib.GlobalWorkerOptions.workerSrc,value.workerUrl);assert.equal(factories,1);assert.equal(timers.size,0);
});

test('a verified transport deadline aborts the old fetch before fallback and ignores its late pair',async()=>{
  const {create,expire,timers}=fixture(),late=deferred(),first=verifiedPair('4.10.38'),second=verifiedPair('4.4.168'),signals=[];
  const loader=create({timeoutMs:30,transport:{load(version,{signal}){
    signals.push(signal);if(version==='4.10.38')return late.promise;
    assert.equal(signals[0].aborted,true);return second;
  }}});
  const pending=loader.load();await flush();expire();assert.equal(await pending,second);
  late.resolve(first);await flush();assert.equal(first.lib.GlobalWorkerOptions.workerSrc,undefined);
  assert.equal(await loader.load(),second);assert.equal(timers.size,0);
});

test('failed integrity transport work is aborted before the next approved version',async()=>{
  const {create}=fixture(),signals=[];
  const loader=create({transport:{load(version,{signal}){
    signals.push(signal);if(version==='4.10.38')throw Error('Digest mismatch');
    assert.equal(signals[0].aborted,true);return verifiedPair(version);
  }}});
  assert.equal((await loader.load()).version,'4.4.168');assert.equal(signals.length,2);
});

test('unverified, mismatched and remote-worker transport results fail closed and are not cached',async()=>{
  for(const mutate of [p=>p.verified=false,p=>p.version='4.4.168',p=>p.workerUrl='https://example.invalid/worker.mjs',
    p=>delete p.workerUrl,p=>delete p.lib.getDocument]){
    const {create}=fixture();let calls=0;
    const loader=create({candidates:['4.10.38'],transport:{load(){calls++;const p=verifiedPair('4.10.38');mutate(p);return p;}}});
    await assert.rejects(loader.load(),hasCode('pdf_load_failed'));await assert.rejects(loader.load(),hasCode('pdf_load_failed'));assert.equal(calls,2);
  }
});

test('invalidation aborts verified transport work and never publishes its late result',async()=>{
  const {create,timers}=fixture(),gate=deferred(),old=verifiedPair('4.10.38'),fresh=verifiedPair('4.10.38');let calls=0,signal;
  const loader=create({transport:{load(_version,options){calls++;if(calls===1){signal=options.signal;return gate.promise;}return fresh;}}});
  const pending=loader.load(),rejected=assert.rejects(pending,hasCode('pdf_loader_invalidated'));await flush();loader.invalidate();await rejected;
  assert.equal(signal.aborted,true);assert.equal(await loader.load(),fresh);gate.resolve(old);await flush();
  assert.equal(old.lib.GlobalWorkerOptions.workerSrc,undefined);assert.equal(await loader.load(),fresh);assert.equal(timers.size,0);
});

test('transport configuration cannot silently replace the verified production path with a module importer',()=>{
  const {create}=fixture();
  for(const options of [{transport:null},{transport:{}},{transport:{load:3}},
    {transport:{load(){}},loadModule(){}}])assert.throws(()=>create(options),error=>error.name==='TypeError');
});
