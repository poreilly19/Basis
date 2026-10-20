const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const crypto=require('node:crypto'),{test}=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'../src/pdf_integrity.js'),'utf8');
const encode=text=>new TextEncoder().encode(text),digest=bytes=>crypto.createHash('sha256').update(bytes).digest();
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
const lib=version=>({version,getDocument(){},GlobalWorkerOptions:class GlobalWorkerOptions{static workerSrc='';}});
function fixtures(){
  const artifacts={},bytes=new Map();
  for(const version of ['4.10.38','4.4.168']){
    artifacts[version]={};
    for(const kind of ['reader','worker']){
      const data=encode(`Original Basis ${kind} fixture ${version}.`),url=`https://fixture.invalid/${version}/${kind}.mjs`;
      bytes.set(url,data);artifacts[version][kind]={url,size:data.length,sha256:digest(data).toString('hex')};
    }
  }
  return {artifacts,bytes};
}
function response(data,options={}){
  const chunks=options.chunks||[data];let index=0;
  const stats={read:0,cancel:0,release:0,bodyCancel:0};
  const reader={read(){stats.read++;return options.read?options.read():Promise.resolve(index<chunks.length?{done:false,value:chunks[index++]}:{done:true});},
    cancel(){stats.cancel++;return options.cancel?options.cancel():Promise.resolve();},releaseLock(){stats.release++;}};
  const result={ok:true,type:'cors',body:{getReader:()=>reader,cancel(){stats.bodyCancel++;return Promise.resolve();}},stats,reader,...options};
  return result;
}
function setup(adapters={},globals={}){
  const {artifacts,bytes}=fixtures(),calls={fetch:[],digest:[],create:[],revoke:[],imports:[]},blobs=new Map();let sequence=0;
  const context=vm.createContext({URL,Blob,ArrayBuffer,Uint8Array,AbortController,crypto:crypto.webcrypto,...globals});
  vm.runInContext(source,context);
  const factory=vm.runInContext('basisCreatePdfTransport',context);
  const options={artifacts,fetchImpl:async(url,options)=>{calls.fetch.push({url,options});return response(bytes.get(url));},
    digestImpl:async data=>{calls.digest.push(data.slice());return digest(data);},
    createObjectURL:blob=>{const url='blob:fixture-'+(++sequence);blobs.set(url,blob);calls.create.push(url);return url;},
    revokeObjectURL:url=>{calls.revoke.push(url);},importModule:async url=>{
      calls.imports.push(url);const text=await blobs.get(url).text();
      return lib(text.includes('4.10.38')?'4.10.38':'4.4.168');
    },...adapters};
  const transport=factory(options);
  return {context,factory,transport,options,artifacts,bytes,calls,blobs};
}
const code=expected=>error=>error.code===expected;

test('all four deeply frozen production artifact pins exactly match the audited runtime manifest',()=>{
  const {context}=setup(),pins=vm.runInContext('BASIS_PDF_ARTIFACTS',context);
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/runtime_dependencies.json'),'utf8'));
  assert.equal(Object.isFrozen(pins),true);assert.deepEqual(Object.keys(pins),['4.10.38','4.4.168']);
  for(const version of Object.keys(pins)){
    assert.equal(Object.isFrozen(pins[version]),true);
    for(const kind of ['reader','worker']){
      const pin=pins[version][kind],artifact=manifest.artifacts.find(item=>item.url===pin.url);
      assert.ok(artifact);assert.equal(pin.size,artifact.size);assert.equal(pin.sha256,artifact.sha256);assert.equal(Object.isFrozen(pin),true);
    }
  }
});

test('both artifact digests complete before creating any Blob and only the verified reader is imported',async()=>{
  const f=setup(),create=f.options.createObjectURL;
  f.options.createObjectURL=blob=>{assert.equal(f.calls.digest.length,2);return create(blob);};
  const transport=f.factory(f.options),pair=await transport.load('4.10.38');
  assert.equal(pair.version,'4.10.38');assert.equal(pair.verified,true);assert.equal(pair.lib.version,'4.10.38');
  assert.equal(f.calls.create.length,2);assert.deepEqual(f.calls.imports,[f.calls.create[0]]);assert.equal(pair.workerUrl,f.calls.create[1]);
  assert.equal(await f.blobs.get(f.calls.create[0]).text(),new TextDecoder().decode(f.bytes.get(f.artifacts['4.10.38'].reader.url)));
  assert.equal(await f.blobs.get(pair.workerUrl).text(),new TextDecoder().decode(f.bytes.get(f.artifacts['4.10.38'].worker.url)));
  for(const {url,options}of f.calls.fetch){assert.ok(url.startsWith('https:'));assert.equal(options.mode,'cors');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.ok(options.signal);}
  assert.equal(f.calls.revoke.length,0);transport.dispose();assert.equal(f.calls.revoke.length,2);
});

test('successful versions reuse their pairs and retain four URLs until explicit transport disposal',async()=>{
  const f=setup(),controller=new AbortController(),a=await f.transport.load('4.10.38',{signal:controller.signal});
  controller.abort('Loader invalidated later');assert.equal(await f.transport.load('4.10.38'),a);assert.equal(f.calls.revoke.length,0);
  const b=await f.transport.load('4.4.168');assert.notEqual(a,b);assert.equal(await f.transport.load('4.4.168'),b);
  assert.equal(f.calls.fetch.length,4);assert.equal(f.calls.create.length,4);assert.equal(f.calls.imports.length,2);
  f.transport.dispose();f.transport.dispose();assert.deepEqual(f.calls.revoke.sort(),f.calls.create.sort());
  await assert.rejects(f.transport.load('4.10.38'),code('pdf_integrity_disposed'));
});

test('reader or worker tampering at the exact expected length cannot create or execute either module',async()=>{
  for(const kind of ['reader','worker']){
    const f=setup(),url=f.artifacts['4.10.38'][kind].url,data=f.bytes.get(url).slice();data[0]^=1;f.bytes.set(url,data);
    await assert.rejects(f.transport.load('4.10.38'),code('pdf_integrity_digest'));
    assert.equal(f.calls.create.length,0);assert.equal(f.calls.imports.length,0);
  }
});

test('oversized streams stop before copying excess bytes and cancel other in-flight streams without awaiting cleanup',async()=>{
  const f=setup(),gate=deferred(),responses=[];
  f.options.fetchImpl=async url=>{
    const data=f.bytes.get(url),r=url.includes('reader')?
      response(data,{chunks:[data,new Uint8Array([1])],cancel:()=>new Promise(()=>{})}):
      response(data,{read:()=>gate.promise,cancel:()=>new Promise(()=>{})});responses.push(r);return r;
  };
  const transport=f.factory(f.options);
  await assert.rejects(transport.load('4.10.38'),code('pdf_integrity_size'));
  assert.equal(responses[0].stats.cancel,1);assert.equal(responses[1].stats.cancel,1);
  assert.equal(f.calls.create.length,0);gate.resolve({done:true});await flush();transport.dispose();
});

test('truncated artifacts fail their exact size check before hashing or module creation',async()=>{
  const f=setup(),url=f.artifacts['4.10.38'].worker.url;f.bytes.set(url,f.bytes.get(url).subarray(0,5));
  await assert.rejects(f.transport.load('4.10.38'),code('pdf_integrity_size'));assert.equal(f.calls.create.length,0);assert.equal(f.calls.imports.length,0);
});

test('HTTP and opaque responses fail closed and cancel their body',async()=>{
  for(const override of [{ok:false,status:503},{type:'opaque'},{type:'opaqueredirect'}]){
    const f=setup(),r=response(new Uint8Array(0),override);f.options.fetchImpl=async()=>r;
    const transport=f.factory(f.options);await assert.rejects(transport.load('4.10.38'),code('pdf_integrity_http'));
    assert.ok(r.stats.bodyCancel>0);assert.equal(r.stats.read,0);assert.equal(f.calls.create.length,0);transport.dispose();
  }
});

test('missing streaming support and invalid stream chunks fail without executing modules',async()=>{
  for(const r of [{ok:true,body:null},{ok:true,body:{}},response(new Uint8Array(1),{read:async()=>({done:false,value:'not bytes'})}),
    response(new Uint8Array(1),{read:async()=>({done:1})})]){
    const f=setup({fetchImpl:async()=>r});await assert.rejects(f.transport.load('4.10.38'),code('pdf_integrity_stream'));assert.equal(f.calls.create.length,0);
  }
});

test('failed reads cancel and release readers before rejecting',async()=>{
  const cause=Error('Connection interrupted'),r=response(new Uint8Array(0),{read:async()=>{throw cause;}}),f=setup({fetchImpl:async()=>r});
  await assert.rejects(f.transport.load('4.10.38'),error=>error===cause);assert.ok(r.stats.cancel>0);assert.ok(r.stats.release>0);assert.equal(f.calls.create.length,0);
});

test('missing Fetch or Web Crypto and invalid digest output fail closed without fallback imports',async()=>{
  for(const options of [{fetchImpl:undefined},{digestImpl:undefined},{digestImpl:async()=>new Uint8Array(31)},
    {digestImpl:async()=> '0'.repeat(64)},{digestImpl:async()=>{throw Error('Digest unavailable');}}]){
    const f=setup(options,{crypto:undefined,fetch:undefined});await assert.rejects(f.transport.load('4.10.38'));
    assert.equal(f.calls.create.length,0);assert.equal(f.calls.imports.length,0);
  }
});

test('the default Web Crypto adapter verifies the exact pinned SHA-256 bytes',async()=>{
  const f=setup({digestImpl:undefined});assert.equal((await f.transport.load('4.10.38')).verified,true);
  assert.equal(f.calls.create.length,2);f.transport.dispose();
});

test('an incomplete stream-reader API still releases every available resource',async()=>{
  let cancelled=0,released=0;
  const f=setup({fetchImpl:async()=>({ok:true,body:{getReader:()=>({cancel(){cancelled++;},releaseLock(){released++;}})}})});
  await assert.rejects(f.transport.load('4.10.38'),code('pdf_integrity_stream'));
  assert.equal(cancelled,2);assert.equal(released,2);assert.equal(f.calls.create.length,0);
});

test('a stream that never makes byte progress stops at a finite chunk budget',async()=>{
  const f=setup(),empty=new Uint8Array(0);let reads=0,cancelled=0;
  f.options.fetchImpl=async url=>url.includes('reader')?response(empty,{
    read:async()=>{reads++;return {done:false,value:empty};},cancel(){cancelled++;}
  }):response(f.bytes.get(url));
  const transport=f.factory(f.options);await assert.rejects(transport.load('4.10.38'),code('pdf_integrity_size'));
  assert.equal(reads,65536);assert.equal(cancelled,1);assert.equal(f.calls.create.length,0);transport.dispose();
});

test('already-aborted callers cause no fetch and cannot revoke previously cached URLs',async()=>{
  const f=setup(),controller=new AbortController();controller.abort('Already cancelled');
  await assert.rejects(f.transport.load('4.10.38',{signal:controller.signal}),error=>error.name==='AbortError');assert.equal(f.calls.fetch.length,0);
  const pair=await f.transport.load('4.10.38');await assert.rejects(f.transport.load('4.10.38',{signal:controller.signal}),error=>error.name==='AbortError');
  assert.equal(await f.transport.load('4.10.38'),pair);assert.equal(f.calls.revoke.length,0);f.transport.dispose();
});

test('abort during Fetch settles immediately and cancels a response that arrives later',async()=>{
  const f=setup(),gate=deferred(),controller=new AbortController(),late=response(f.bytes.get(f.artifacts['4.10.38'].reader.url));
  f.options.fetchImpl=url=>url.includes('reader')?gate.promise:Promise.resolve(response(f.bytes.get(url)));
  const transport=f.factory(f.options),pending=transport.load('4.10.38',{signal:controller.signal}),rejected=assert.rejects(pending,error=>error.name==='AbortError');
  await flush();controller.abort('No longer needed');await rejected;gate.resolve(late);await flush();
  assert.equal(late.stats.bodyCancel,1);assert.equal(late.stats.read,0);assert.equal(f.calls.create.length,0);transport.dispose();
});

test('abort during a pending body read cancels once and ignores late chunks',async()=>{
  const f=setup(),gate=deferred(),controller=new AbortController(),responses=[];
  f.options.fetchImpl=async()=>{const r=response(new Uint8Array(0),{read:()=>gate.promise,cancel:()=>new Promise(()=>{})});responses.push(r);return r;};
  const transport=f.factory(f.options),pending=transport.load('4.10.38',{signal:controller.signal}),rejected=assert.rejects(pending,error=>error.name==='AbortError');
  await flush();controller.abort();await rejected;assert.ok(responses.every(r=>r.stats.cancel===1));
  gate.resolve({done:false,value:new Uint8Array([1])});await flush();assert.equal(f.calls.create.length,0);transport.dispose();
});

test('abort during digest ignores late verification results and never creates module URLs',async()=>{
  const f=setup(),gate=deferred(),controller=new AbortController();let digests=0;
  f.options.digestImpl=()=>{digests++;return gate.promise;};const transport=f.factory(f.options);
  const pending=transport.load('4.10.38',{signal:controller.signal}),rejected=assert.rejects(pending,error=>error.name==='AbortError');
  await flush();assert.equal(digests,2);controller.abort();await rejected;gate.resolve(new Uint8Array(32));await flush();
  assert.equal(f.calls.create.length,0);assert.equal(f.calls.imports.length,0);transport.dispose();
});

test('abort during reader import revokes both URLs promptly and late import cannot poison retry cache',async()=>{
  const f=setup(),gate=deferred(),controller=new AbortController();let attempts=0;
  const original=f.options.importModule;f.options.importModule=url=>{attempts++;return attempts===1?gate.promise:original(url);};
  const transport=f.factory(f.options),pending=transport.load('4.10.38',{signal:controller.signal}),rejected=assert.rejects(pending,error=>error.name==='AbortError');
  await flush();assert.equal(attempts,1);controller.abort();await rejected;assert.equal(f.calls.revoke.length,2);
  gate.resolve(lib('4.10.38'));await flush();const fresh=await transport.load('4.10.38');assert.equal(fresh.verified,true);assert.equal(attempts,2);
  assert.equal(f.calls.create.length,4);assert.equal(f.calls.revoke.length,2);transport.dispose();assert.equal(f.calls.revoke.length,4);
});

test('reader import failure and wrong module APIs revoke their pair and remain retryable',async()=>{
  for(const bad of [()=>Promise.reject(Error('Blob import blocked')),()=>Promise.resolve(lib('4.4.168')),
    ()=>Promise.resolve({version:'4.10.38',GlobalWorkerOptions:{}})]){
    const f=setup(),original=f.options.importModule;let first=true;
    f.options.importModule=url=>{if(first){first=false;return bad();}return original(url);};const transport=f.factory(f.options);
    await assert.rejects(transport.load('4.10.38'));assert.equal(f.calls.revoke.length,2);
    assert.equal((await transport.load('4.10.38')).version,'4.10.38');transport.dispose();assert.equal(f.calls.revoke.length,4);
  }
});

test('dispose aborts in-flight fetches and no late work can create URLs after disposal',async()=>{
  const f=setup(),gate=deferred();let signal;
  f.options.fetchImpl=(_url,options)=>{signal=options.signal;return gate.promise;};const transport=f.factory(f.options),pending=transport.load('4.10.38');
  const rejected=assert.rejects(pending,error=>error.name==='AbortError');await flush();transport.dispose();await rejected;assert.equal(signal.aborted,true);
  const r=response(new Uint8Array(0));gate.resolve(r);await flush();assert.equal(f.calls.create.length,0);assert.ok(r.stats.bodyCancel>0);
  await assert.rejects(transport.load('4.10.38'),code('pdf_integrity_disposed'));
});

test('concurrent loads keep independent cancellation and one retained pair per version',async()=>{
  const f=setup(),a=await Promise.all([f.transport.load('4.10.38'),f.transport.load('4.10.38')]);assert.equal(a[0],a[1]);
  assert.equal(f.calls.create.length-f.calls.revoke.length,2);f.transport.dispose();assert.deepEqual(f.calls.revoke.sort(),f.calls.create.sort());
  const g=setup(),controller=new AbortController(),pending=g.transport.load('4.10.38',{signal:controller.signal});
  const rejected=assert.rejects(pending,error=>error.name==='AbortError'),other=g.transport.load('4.4.168');controller.abort();await rejected;
  assert.equal((await other).version,'4.4.168');g.transport.dispose();
});

test('metadata is snapshotted so callers cannot replace URLs or hashes during a load',async()=>{
  const f=setup(),original=f.artifacts['4.10.38'].reader.url;
  f.artifacts['4.10.38'].reader.url='https://changed.invalid/untrusted.mjs';f.artifacts['4.10.38'].reader.sha256='0'.repeat(64);
  const pair=await f.transport.load('4.10.38');assert.equal(pair.verified,true);assert.equal(f.calls.fetch[0].url,original);f.transport.dispose();
});

test('invalid artifact schema, unsafe URLs and unbounded sizes are rejected before any requests',()=>{
  const {factory}=setup();
  for(const mutate of [a=>a['3.11.174']=a['4.10.38'],a=>a['4.10.38'].extra=true,
    a=>a['4.10.38'].reader.size=0,a=>a['4.10.38'].reader.size=4194305,a=>a['4.10.38'].reader.size=1.5,
    a=>a['4.10.38'].reader.sha256='F'.repeat(64),a=>a['4.10.38'].reader.url='http://fixture.invalid/file',
    a=>a['4.10.38'].reader.url='https://user:password@fixture.invalid/file',a=>a['4.10.38'].reader.url+='\x23fragment',
    a=>a['4.10.38'].worker.url=a['4.10.38'].reader.url,a=>delete a['4.10.38'].worker]){
    const {artifacts}=fixtures();mutate(artifacts);assert.throws(()=>factory({artifacts}),error=>error.name==='TypeError');
  }
  for(const artifacts of [null,{},[],{'4.10.38':null}])assert.throws(()=>factory({artifacts}),error=>error.name==='TypeError');
  for(const name of ['fetchImpl','digestImpl','importModule','createObjectURL','revokeObjectURL'])assert.throws(()=>factory({[name]:null}),error=>error.name==='TypeError');
});

test('module URL adapters cannot redirect execution to an original or unverified HTTPS URL',async()=>{
  const f=setup(),create=f.options.createObjectURL;let number=0;
  f.options.createObjectURL=blob=>++number===1?create(blob):'https://fixture.invalid/unverified.mjs';const transport=f.factory(f.options);
  await assert.rejects(transport.load('4.10.38'),code('pdf_integrity_url'));assert.equal(f.calls.imports.length,0);assert.equal(f.calls.revoke.length,1);transport.dispose();
});

test('unsupported versions and malformed abort signals fail before fetching',async()=>{
  const f=setup();await assert.rejects(f.transport.load('3.11.174'),code('pdf_integrity_version'));
  await assert.rejects(f.transport.load('4.10.38',{signal:{aborted:false}}),error=>error.name==='TypeError');assert.equal(f.calls.fetch.length,0);f.transport.dispose();
});
