const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'../src/xlsx_loader.js'),'utf8');
const URL='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
const SRI='sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT';
const methods=['book_new','aoa_to_sheet','encode_cell','encode_col','book_append_sheet','sheet_to_json'];
const library=()=>({version:'0.20.3',read(){},write(){},utils:Object.fromEntries(methods.map(method=>[method,()=>{}]))});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
function fixture(){
  const timers=new Map(),created=[],appended=[];let sequence=0;
  const document={createElement(tag){assert.equal(tag,'script');const node={removed:0,remove(){this.removed++;}};created.push(node);return node;},
    head:{append(node){appended.push(node);}}};
  const context=vm.createContext({AbortController,document,setTimeout:(callback,delay)=>{
    const id=++sequence;timers.set(id,{callback,delay});return id;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(source,context);
  return {context,created,appended,timers,create:vm.runInContext('basisCreateXlsxLoader',context),
    expire(){const [id,timer]=timers.entries().next().value;timers.delete(id);timer.callback();}};
}
const hasCode=code=>error=>error.code===code;

test('a complete existing library is reused without scripts, mutation or deadlines',async()=>{
  const {create,context,created,timers}=fixture(),lib=library();Object.freeze(lib.utils);Object.freeze(lib);context.XLSX=lib;
  const loader=create(),first=loader.load();assert.equal(await first,lib);assert.equal(loader.load(),first);
  assert.equal(created.length,0);assert.equal(timers.size,0);
});

test('concurrent requests share one bounded load and cannot bypass it when a global appears early',async()=>{
  const {create,context,timers}=fixture(),gate=deferred(),lib=library();let calls=0,settled=false;
  const loader=create({loadScript:(url,options)=>{calls++;assert.equal(url,URL);assert.equal(options.integrity,SRI);return gate.promise;}});
  const a=loader.load(),b=loader.load();assert.equal(a,b);await flush();assert.equal(calls,1);assert.equal(timers.size,1);
  a.then(()=>settled=true);context.XLSX=lib;assert.equal(loader.load(),a);await flush();assert.equal(settled,false);
  gate.resolve();assert.equal(await a,lib);assert.equal(timers.size,0);assert.equal(loader.load(),a);
});

test('wrong versions and every missing required API reject without caching a partial global',async()=>{
  const invalid=[lib=>lib.version='0.18.4',lib=>lib.version='0.18.5',lib=>lib.version='0.20.2',lib=>delete lib.read,lib=>delete lib.write,
    lib=>lib.utils=null,lib=>lib.utils=[],...methods.map(method=>lib=>delete lib.utils[method])];
  for(const mutate of invalid){
    const {create,context,timers}=fixture(),lib=library();mutate(lib);context.XLSX=lib;let calls=0;
    const loader=create({loadScript(){calls++;}});
    await assert.rejects(loader.load(),error=>error.code==='xlsx_load_failed'&&/complete import\/export API/.test(error.cause.message));
    await assert.rejects(loader.load(),hasCode('xlsx_load_failed'));assert.equal(calls,2);assert.equal(timers.size,0);
  }
});

test('script failure settles coalesced callers, preserves its cause and allows retry',async()=>{
  const {create,context,timers}=fixture(),cause=Error('Network failed'),lib=library();let fail=true,calls=0;
  const loader=create({loadScript(){calls++;if(fail)throw cause;context.XLSX=lib;}}),a=loader.load(),b=loader.load();
  assert.equal(a,b);await assert.rejects(a,error=>error.name==='XlsxLoadError'&&error.code==='xlsx_load_failed'&&error.cause===cause);
  assert.equal(timers.size,0);fail=false;assert.equal(await loader.load(),lib);assert.equal(calls,2);
});

test('a timeout aborts its importer and late completion cannot replace the next cached library reference',async()=>{
  const {create,context,timers,expire}=fixture(),old=deferred(),fresh=deferred(),oldLib=library(),freshLib=library();let calls=0,signal;
  const loader=create({timeoutMs:35,loadScript:(_url,options)=>{calls++;signal=options.signal;return calls===1?old.promise:fresh.promise;}});
  const first=loader.load(),rejected=assert.rejects(first,error=>error.name==='TimeoutError'&&error.code==='xlsx_load_timeout');
  await flush();assert.equal([...timers.values()][0].delay,35);expire();await rejected;assert.equal(signal.aborted,true);assert.equal(timers.size,0);
  const next=loader.load();await flush();context.XLSX=freshLib;fresh.resolve();assert.equal(await next,freshLib);
  context.XLSX=oldLib;old.resolve();await flush();assert.equal(await loader.load(),freshLib);assert.equal(calls,2);assert.equal(timers.size,0);
});

test('invalidate before the importer starts rejects immediately and prevents script injection',async()=>{
  const {create,timers}=fixture();let calls=0;
  const loader=create({loadScript(){calls++;}}),pending=loader.load(),rejected=assert.rejects(pending,
    error=>error.name==='AbortError'&&error.code==='xlsx_loader_invalidated');
  loader.invalidate();await rejected;await flush();assert.equal(calls,0);assert.equal(timers.size,0);
});

test('invalidated pending generations cannot publish late success or failure into a new load',async()=>{
  for(const rejectLate of [false,true]){
    const {create,context,timers}=fixture(),old=deferred(),fresh=deferred(),lib=library();let calls=0,oldSignal;
    const loader=create({loadScript:(_url,options)=>{calls++;if(calls===1)oldSignal=options.signal;return calls===1?old.promise:fresh.promise;}});
    const first=loader.load(),rejected=assert.rejects(first,hasCode('xlsx_loader_invalidated'));await flush();loader.invalidate();await rejected;
    assert.equal(oldSignal.aborted,true);const next=loader.load();await flush();
    if(rejectLate)old.reject(Error('Stale failure'));else old.resolve();await flush();assert.equal(timers.size,1);
    context.XLSX=lib;fresh.resolve();assert.equal(await next,lib);assert.equal(await loader.load(),lib);assert.equal(timers.size,0);
  }
});

test('invalidate clears a completed cache and rechecks the current global',async()=>{
  const {create,context}=fixture(),first=library(),fresh=library();context.XLSX=first;let calls=0;
  const loader=create({loadScript(){calls++;context.XLSX=fresh;}});assert.equal(await loader.load(),first);
  loader.invalidate();context.XLSX=undefined;assert.equal(await loader.load(),fresh);assert.equal(calls,1);
});

test('default DOM injection pins its URL, integrity and anonymous CORS then detaches after success',async()=>{
  const {create,context,created,appended,timers}=fixture(),lib=library(),loader=create(),pending=loader.load();await flush();
  assert.equal(created.length,1);const script=created[0];assert.equal(appended[0],script);
  assert.equal(script.src,URL);assert.equal(script.integrity,SRI);assert.equal(script.crossOrigin,'anonymous');assert.equal(script.async,true);
  context.XLSX=lib;script.onload();assert.equal(await pending,lib);assert.equal(timers.size,0);
  assert.equal(script.onload,null);assert.equal(script.onerror,null);assert.equal(script.removed,1);
});

test('DOM script errors detach listeners and remove the failed node before a fresh retry',async()=>{
  const {create,context,created,timers}=fixture(),loader=create(),first=loader.load();
  const rejected=assert.rejects(first,hasCode('xlsx_load_failed'));await flush();created[0].onerror();await rejected;
  assert.equal(created[0].onload,null);assert.equal(created[0].onerror,null);assert.equal(created[0].removed,1);assert.equal(timers.size,0);
  const next=loader.load();await flush();assert.equal(created.length,2);const lib=library();context.XLSX=lib;created[1].onload();assert.equal(await next,lib);
});

test('DOM deadlines detach and remove their node and queued old events cannot finish a retry',async()=>{
  const {create,context,created,expire,timers}=fixture(),loader=create(),first=loader.load();
  const rejected=assert.rejects(first,hasCode('xlsx_load_timeout'));await flush();const lateLoad=created[0].onload,lateError=created[0].onerror;
  expire();await rejected;assert.equal(created[0].removed,1);assert.equal(created[0].onload,null);assert.equal(created[0].onerror,null);
  const next=loader.load();await flush();lateLoad();lateError();await flush();assert.equal(timers.size,1);
  const lib=library();context.XLSX=lib;created[1].onload();assert.equal(await next,lib);assert.equal(timers.size,0);
});

test('DOM invalidation removes its node and an already queued load event remains harmless',async()=>{
  const {create,context,created,timers}=fixture(),loader=create(),first=loader.load();
  const rejected=assert.rejects(first,hasCode('xlsx_loader_invalidated'));await flush();const late=created[0].onload;loader.invalidate();await rejected;
  assert.equal(created[0].removed,1);assert.equal(created[0].onload,null);assert.equal(timers.size,0);
  const fresh=loader.load();await flush();late();await flush();assert.equal(timers.size,1);
  const lib=library();context.XLSX=lib;created[1].onload();assert.equal(await fresh,lib);
});

test('an unavailable DOM rejects cleanly and a later attempt can use a working DOM',async()=>{
  const {create,context,created,timers}=fixture(),document=context.document;context.document=undefined;const loader=create();
  await assert.rejects(loader.load(),hasCode('xlsx_load_failed'));assert.equal(timers.size,0);context.document=document;
  const pending=loader.load();await flush();const lib=library();context.XLSX=lib;
  created[0].onload();assert.equal(await pending,lib);assert.equal(timers.size,0);
});

test('a throwing library lookup or an importer returning a library cannot publish an invalid global',async()=>{
  const {create,timers}=fixture(),lib=library();let fail=true,calls=0;
  const loader=create({getLibrary(){if(fail)throw Error('Global unavailable');return lib;},loadScript(){calls++;return lib;}});
  await assert.rejects(loader.load(),error=>error.code==='xlsx_load_failed'&&error.cause.message==='Global unavailable');
  assert.equal(calls,1);assert.equal(timers.size,0);fail=false;assert.equal(await loader.load(),lib);assert.equal(calls,1);
  const other=create({getLibrary:()=>undefined,loadScript:()=>lib});await assert.rejects(other.load(),hasCode('xlsx_load_failed'));
});

test('invalid loader configuration is rejected before library lookup or injection',()=>{
  const {create}=fixture();
  for(const options of [{getLibrary:3},{loadScript:3},...[0,-1,NaN,Infinity,2147483648,'10'].map(timeoutMs=>({timeoutMs})),
    {url:''},{url:3},{integrity:''},{integrity:'sha384-unpinned'},{integrity:SRI+'extra'}]){
    assert.throws(()=>create(options),error=>error.name==='TypeError');
  }
});
