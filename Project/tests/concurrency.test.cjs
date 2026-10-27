const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const workspace=html.slice(html.indexOf('const PW={'),html.indexOf('/* =========================== PORTFOLIO PAGE'));
const clone=value=>value===undefined?undefined:structuredClone(value);

// Independent pages share one IndexedDB database. Each read/write transaction gets a
// private copy, serializes with the next transaction, and publishes only on completion.
// Request callbacks can enqueue more requests, as they do in the browser API.
class SharedDatabase{
  constructor(entries=[]){this.data=new Map(entries.map(([key,value])=>[key,clone(value)]));this.queue=[];this.active=null;this.fail=null;}
  connection(){return {transaction:(_name,mode)=>this.transaction(mode)};}
  transaction(mode){
    const database=this,requests=[];
    const transaction={mode,error:null,done:false,started:false,scheduled:false,view:null,
      objectStore(){return {
        get:key=>request('get',key),put:(value,key)=>request('put',key,value),delete:key=>request('delete',key)
      };},
      abort(){if(transaction.done)return;transaction.error=transaction.error||new Error('Transaction aborted');finish(false);}
    };
    function request(operation,key,value){
      if(transaction.done)throw new Error('Transaction inactive');
      if(mode!=='readwrite'&&operation!=='get')throw new Error('Read-only transaction');
      const result={result:undefined,error:null};requests.push({operation,key,value:clone(value),result});schedule();return result;
    }
    function schedule(){if(transaction.started&&!transaction.done&&!transaction.scheduled){transaction.scheduled=true;setImmediate(step);}}
    function finish(commit){
      if(transaction.done)return;transaction.done=true;
      if(commit&&mode==='readwrite')database.data=transaction.view;
      setImmediate(()=>{
        if(commit){if(transaction.oncomplete)transaction.oncomplete({target:transaction});}
        else if(transaction.onabort)transaction.onabort({target:transaction});
        database.active=null;database.start();
      });
    }
    function step(){
      transaction.scheduled=false;if(transaction.done)return;
      const next=requests.shift();if(!next){finish(true);return;}
      const {operation,key,value,result}=next;
      if(database.fail&&database.fail.operation===operation&&database.fail.key===key){
        const error=new Error('Simulated storage failure at '+key);error.name='QuotaExceededError';database.fail=null;
        transaction.error=result.error=error;if(result.onerror)result.onerror({target:result});finish(false);return;
      }
      if(operation==='get')result.result=clone(transaction.view.get(key));
      else if(operation==='put'){transaction.view.set(key,clone(value));result.result=key;}
      else transaction.view.delete(key);
      if(result.onsuccess)result.onsuccess({target:result});schedule();
    }
    transaction.start=()=>{transaction.started=true;transaction.view=new Map([...database.data].map(([key,value])=>[key,clone(value)]));schedule();};
    database.queue.push(transaction);database.start();return transaction;
  }
  start(){if(!this.active&&this.queue.length){this.active=this.queue.shift();this.active.start();}}
  failNextWrite(key){this.fail={operation:'put',key};}
  snapshot(){return [...this.data].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,clone(value)]);}
}

const initialIndex=()=>({v:1,rev:'initial-revision',pfs:[{id:'pf',name:'Existing',scs:[{id:'base',name:'Base'}]}],
  props:[{id:'p',pf:'pf',sc:'base',name:'Original',inc:true,saved:1}]});
const model=name=>JSON.stringify({name,areas:[],tenants:[],mlas:[]});
function database(index=initialIndex()){
  return new SharedDatabase([['pw_index',index],['pwm_p',{v:1,n:1,enc:'json',saved:1,s:model('Original')}]]);
}
let pageId=0;
function page(shared,index=shared.data.get('pw_index')){
  const local=new Map(),alerts=[],downloads=[],prefix='page'+(++pageId)+'-',idb=shared.connection();let id=0;
  const c=vm.createContext({TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,Response,DataView,Date,JSON,Map,Set,Promise,Error,Number,String,
    crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,btoa,atob,console:{error(){}},uid:()=>prefix+(++id),
    localStorage:{getItem:key=>local.get(key)||null,setItem:(key,value)=>local.set(key,value)},document:{addEventListener(){}},addEventListener(){},
    window:{},$:()=>null,kAlert:message=>alerts.push(message),kConfirm:async()=>false,blankState:()=>({name:'Blank',areas:[],tenants:[],mlas:[]}),
    calc:()=>({sf:100,pv:1000,ann:{noi:[60]}}),mKey:()=>'',num:value=>Number.isFinite(Number(value))?Number(value):0,recalc(){},renderKPI(){},basisRenderContext(){},drawPane(){},
    PANES:{},T1:'property',MODE:'inputs',sampleState:()=>({name:'Sample'}),setMode(){},idb,initial:clone(index),
    offerFile:async(name,bytes)=>{downloads.push({name,bytes});return 'saved';}});
  vm.runInContext(fs.readFileSync(path.join(root,'src/scenario_settings.js'),'utf8'),c);
  vm.runInContext(fs.readFileSync(path.join(root,'src/native_codec.js'),'utf8'),c);
  vm.runInContext(workspace,c);vm.runInContext(fs.readFileSync(path.join(root,'src/native_ui.js'),'utf8'),c);
  const run=source=>vm.runInContext(source,c);
  run(`PW.ix=initial;PW.rev=pwRevision(initial);PW.pf='pf';PW.sc='base';PW.local={open:[],synced:{}};PW._done();PWS.kind='idb';PWS.idb=idb;var S={name:'Active',areas:[],tenants:[],mlas:[]};var R={sf:100,pv:1000,ann:{noi:[60]}};`);
  return {c,run,alerts,downloads};
}
function hostAccount(page,remote,failKey=null){
  const writes=[];
  page.c.host={doc:fullPath=>{const key=fullPath.split('/').pop();return {
    get:async()=>({exists:remote.has(key),data:()=>clone(remote.get(key))}),
    set:async value=>{if(key===failKey)throw Error('Simulated host failure at '+key);writes.push(['put',key]);remote.set(key,clone(value));},
    delete:async()=>{writes.push(['delete',key]);remote.delete(key);}
  };}};
  page.run(`PWS.kind='db';PWS.db=host;PWS.uid='user';`);return writes;
}
const conflict=/chang|conflict|newer|reload|revision|another|other (?:tab|device)/i;
let passed=0;
async function test(name,fn){try{await fn();passed++;console.log('PASS',name);}catch(error){console.error('FAIL',name,error);process.exitCode=1;}}

(async()=>{
  await test('A stale library save cannot erase a property added by another page',async()=>{
    const shared=database(),a=page(shared),b=page(shared);
    const added=await a.run(`pwAdopt({name:'Added elsewhere',areas:[],tenants:[],mlas:[]},{quiet:true})`);
    b.run(`PW.ix.pfs[0].name='Stale rename'`);
    await assert.rejects(b.run('pwSaveIndex()'),conflict);
    assert.equal(shared.data.get('pw_index').pfs[0].name,'Existing');
    assert.equal(shared.data.get('pw_index').props.length,2);
    assert.ok(shared.data.has('pwm_'+added));
    assert.match(b.run('PW.status'),/^Not saved/);
  });
  await test('A stale same-property save preserves the newer stored model and metadata',async()=>{
    const shared=database(),a=page(shared),b=page(shared);
    await a.run(`pwSaveModel('p',JSON.stringify({name:'Newer model'}),{name:'Newer model'})`);
    const committed=shared.snapshot(),revision=b.run('PW.rev');
    await assert.rejects(b.run(`pwSaveModel('p',JSON.stringify({name:'Stale model'}),{name:'Stale model'})`),conflict);
    assert.deepEqual(shared.snapshot(),committed);
    assert.equal(b.run('PW.rev'),revision);
    assert.equal(shared.data.get('pw_index').props[0].name,'Newer model');
  });
  await test('Simultaneous saves from two pages commit exactly one complete version',async()=>{
    const shared=database(),a=page(shared),b=page(shared);
    const results=await Promise.allSettled([
      a.run(`pwSaveModel('p',JSON.stringify({name:'Version A'}),{name:'Version A'})`),
      b.run(`pwSaveModel('p',JSON.stringify({name:'Version B'}),{name:'Version B'})`)
    ]);
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
    const rejection=results.find(result=>result.status==='rejected');assert.match(String(rejection.reason),conflict);
    const stored=await a.run(`pwGetModel('p')`),index=shared.data.get('pw_index');
    assert.equal(JSON.parse(stored.json).name,index.props[0].name);
    assert.equal(stored.saved,index.props[0].saved);
    const winner=results[0].status==='fulfilled'?a:b;
    assert.equal(winner.run('PW.rev'),winner.run('pwRevision(PW.ix)'));
    assert.equal(winner.run('PW.ix.rev'),index.rev);
  });
  await test('Simultaneous commits into shared memory publish exactly one complete version',async()=>{
    const shared=database(),a=page(shared),b=page(shared);
    for(const context of [a,b]){context.c.sharedMemory=shared.data;context.run(`PWS.kind='memory';PW.mem=sharedMemory;`);}
    const results=await Promise.allSettled([
      a.run(`(()=>{const ix=pwIxCopy();ix.props[0].name='Memory A';ix.props[0].saved=2;return pwCommit(ix,[{id:'p',json:JSON.stringify({name:'Memory A'}),saved:2}]);})()`),
      b.run(`(()=>{const ix=pwIxCopy();ix.props[0].name='Memory B';ix.props[0].saved=3;return pwCommit(ix,[{id:'p',json:JSON.stringify({name:'Memory B'}),saved:3}]);})()`)
    ]);
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
    assert.match(String(results.find(result=>result.status==='rejected').reason),conflict);
    const stored=await a.run(`pwGetModel('p')`),property=shared.data.get('pw_index').props[0];
    assert.equal(JSON.parse(stored.json).name,property.name);assert.equal(stored.saved,property.saved);
  });
  await test('A chunked model read remains complete while another page replaces its chunks',async()=>{
    const shared=database(),oldJson=JSON.stringify({name:'Large old model',large:'A'.repeat(360005)}),partSize=180000;
    shared.data.set('pwm_p',{v:1,n:Math.ceil(oldJson.length/partSize),enc:'json',saved:1,part:'old-generation',s:oldJson.slice(0,partSize)});
    for(let offset=partSize,part=1;offset<oldJson.length;offset+=partSize,part++)shared.data.set('pwm_p_old-generation_'+part,{s:oldJson.slice(offset,offset+partSize)});
    const writer=page(shared),reader=page(shared),newJson=JSON.stringify({name:'Large new model',large:'B'.repeat(360005)});
    writer.c.newJson=newJson;
    // The writer queues behind the reader's header transaction. Reading chunks in
    // later transactions would let the writer delete those old chunks first.
    const reading=reader.run(`pwGetModel('p')`),writing=writer.run(`pwSaveModel('p',newJson,{name:'Large new model'})`);
    const [stored]=await Promise.all([reading,writing]);
    assert.equal(stored.json,oldJson);assert.equal((await reader.run(`pwGetModel('p')`)).json,newJson);
  });
  await test('A failed later model write rolls back every model, chunk, and index write',async()=>{
    const shared=database(),a=page(shared),before=shared.snapshot(),revision=a.run('PW.rev');
    shared.failNextWrite('pwm_other');
    await assert.rejects(a.run(`(()=>{const ix=pwIxCopy();ix.props.push({id:'other',pf:'pf',sc:'base',name:'Other'});return pwCommit(ix,[{id:'p',json:JSON.stringify({name:'Changed',large:'X'.repeat(PW_PART*2+5)}),saved:2},{id:'other',json:JSON.stringify({name:'Other'}),saved:2}]);})()`),/storage failure/);
    assert.deepEqual(shared.snapshot(),before);assert.equal(a.run('PW.rev'),revision);
    assert.equal(JSON.parse((await a.run(`pwGetModel('p')`)).json).name,'Original');
  });
  await test('A failed index write rolls back newly written model headers and chunks',async()=>{
    const shared=database(),a=page(shared),before=shared.snapshot(),revision=a.run('PW.rev');
    shared.failNextWrite('pw_index');
    await assert.rejects(a.run(`pwCommit(pwIxCopy(),[{id:'p',json:JSON.stringify({name:'Changed',large:'Y'.repeat(PW_PART*2+5)}),saved:2}])`),/storage failure/);
    assert.deepEqual(shared.snapshot(),before);assert.equal(a.run('PW.rev'),revision);
  });
  await test('A failed deletion commit preserves the original model and all of its chunks',async()=>{
    const shared=database();
    shared.data.set('pwm_p',{v:1,n:2,enc:'json',saved:1,s:'{"name":"Original",'});
    shared.data.set('pwm_p_1',{s:'"areas":[]}'});
    const a=page(shared),before=shared.snapshot();shared.failNextWrite('pw_index');
    await assert.rejects(a.run(`(()=>{const ix=pwIxCopy();ix.props=[];return pwCommit(ix,[],['p']);})()`),/storage failure/);
    assert.deepEqual(shared.snapshot(),before);
    assert.equal(JSON.parse((await a.run(`pwGetModel('p')`)).json).name,'Original');
  });
  await test('A stale deletion cannot remove another page\'s newer property',async()=>{
    const shared=database(),a=page(shared),b=page(shared);
    await a.run(`pwSaveModel('p',JSON.stringify({name:'Retained newer model'}),{name:'Retained newer model'})`);
    const before=shared.snapshot();
    await assert.rejects(b.run(`pwRemove(['p'])`),conflict);
    assert.deepEqual(shared.snapshot(),before);assert.equal(b.run(`!!pwRec('p')`),true);
  });
  await test('A detected stale host account revision is rejected before any remote mutation',async()=>{
    const shared=database(),a=page(shared),remote=new Map(shared.snapshot());
    remote.get('pw_index').rev='newer-remote-revision';
    const writes=hostAccount(a,remote),before=[...remote];
    await assert.rejects(a.run(`pwSaveModel('p',JSON.stringify({name:'Stale remote model'}),{name:'Stale remote model'})`),conflict);
    assert.equal(writes.length,0);assert.deepEqual([...remote],before);
  });
  await test('Ordinary host editing publishes immutable models and retains prior recovery snapshots',async()=>{
    const shared=database(),a=page(shared),remote=new Map(shared.snapshot());hostAccount(a,remote);
    await a.run(`pwSaveModel('p',JSON.stringify({name:'First host edit'}),{name:'First host edit'})`);
    const firstKey=remote.get('pw_index').props[0].storageKey,firstRevision=remote.get('pw_index').rev;
    assert.ok(firstKey);assert.notEqual(firstKey,'pwm_p');
    assert.equal(JSON.parse((await a.run(`pwGetModel('p')`)).json).name,'First host edit');
    await a.run(`pwSaveModel('p',JSON.stringify({name:'Second host edit'}),{name:'Second host edit'})`);
    assert.notEqual(remote.get('pw_index').props[0].storageKey,firstKey);
    assert.equal(JSON.parse((await a.run(`pwGetModel('p')`)).json).name,'Second host edit');
    assert.equal(JSON.parse(remote.get(firstKey).s).name,'First host edit');
    assert.equal(remote.get('pwi_'+firstRevision).props[0].storageKey,firstKey);
  });
  await test('A failed host index publish preserves the current library without broken recovery snapshots',async()=>{
    const shared=database(),a=page(shared),remote=new Map(shared.snapshot()),before=clone(remote.get('pw_index'));
    hostAccount(a,remote,'pw_index');
    await assert.rejects(a.run(`pwSaveModel('p',JSON.stringify({name:'Unpublished host edit'}),{name:'Unpublished host edit'})`),/host failure/);
    assert.deepEqual(remote.get('pw_index'),before);
    assert.equal(JSON.parse((await a.run(`pwGetModel('p')`)).json).name,'Original');
    for(const [key,snapshot] of remote)if(key.startsWith('pwi_'))for(const property of snapshot.props)
      assert.ok(remote.has(property.storageKey||'pwm_'+property.id),'Recovery snapshot '+key+' references a missing model');
  });
  await test('Reloading the latest revision lets a previously stale page save successfully',async()=>{
    const shared=database(),a=page(shared),b=page(shared);
    await a.run(`pwSaveModel('p',JSON.stringify({name:'First edit'}),{name:'First edit'})`);
    await assert.rejects(b.run(`pwSaveModel('p',JSON.stringify({name:'Stale edit'}),{})`),conflict);
    const reloaded=page(shared),loadedRevision=reloaded.run('PW.rev');
    await reloaded.run(`pwSaveModel('p',JSON.stringify({name:'After reload'}),{name:'After reload'})`);
    assert.notEqual(reloaded.run('PW.rev'),loadedRevision);
    assert.equal(JSON.parse((await reloaded.run(`pwGetModel('p')`)).json).name,'After reload');
    assert.equal(shared.data.get('pw_index').props[0].name,'After reload');
  });
  await test('Canceling a dirty library refresh preserves live edits, cache, and loaded revision',async()=>{
    const shared=database(),a=page(shared),b=page(shared);let confirmations=0;
    b.run(`PW.cur=PW.local.cur='p';S.name='Unsaved local edit';PW.local.edited=100;PW.local.synced.p=1;pwCacheSet('p',JSON.stringify(S));`);
    await a.run(`pwSaveModel('p',JSON.stringify({name:'Saved elsewhere'}),{name:'Saved elsewhere'})`);
    await assert.rejects(b.run('pwSaveCur()'),conflict);
    const stored=shared.snapshot(),live=b.run('JSON.stringify(S)'),revision=b.run('PW.rev'),cached=b.run(`PW.cache.get('p')`);
    b.c.kConfirm=async()=>{confirmations++;return false;};
    assert.equal(await b.run('pwRefreshLibrary()'),false);assert.equal(confirmations,1);
    assert.equal(b.run('JSON.stringify(S)'),live);assert.equal(b.run('PW.rev'),revision);
    assert.equal(b.run(`PW.cache.get('p')`),cached);assert.equal(b.run('PW.conflict'),true);
    assert.deepEqual(shared.snapshot(),stored);
  });
  await test('Refreshing a conflicted library loads the latest model and permits subsequent saves',async()=>{
    const shared=database(),a=page(shared),b=page(shared);
    b.run(`PW.cur=PW.local.cur='p';S.name='Old local model';PW.local.open=['p','ghost'];pwCacheSet('p',JSON.stringify(S));pwCacheSet('ghost','{}');PW.objs.set('ghost',{});PW.sel.add('ghost');`);
    await a.run(`pwSaveModel('p',JSON.stringify({name:'Newest saved model'}),{name:'Newest saved model'})`);
    await assert.rejects(b.run('pwSaveCur()'),conflict);b.c.kConfirm=async()=>true;
    assert.equal(await b.run('pwRefreshLibrary()'),true);
    assert.equal(b.run('PW.ix.rev'),shared.data.get('pw_index').rev);assert.equal(b.run('PW.rev'),b.run('pwRevision(PW.ix)'));
    assert.equal(b.run('S.name'),'Newest saved model');assert.equal(b.run(`JSON.parse(PW.cache.get('p')).name`),'Newest saved model');
    assert.equal(b.run(`PW.cache.has('ghost')`),false);assert.equal(b.run('PW.objs.size'),0);assert.equal(b.run('PW.sel.size'),0);
    assert.equal(b.run('PW.conflict'),false);assert.equal(b.run('PW.err'),'');
    b.run(`S.name='Saved after refresh'`);await b.run('pwSaveCur()');
    assert.equal(JSON.parse((await b.run(`pwGetModel('p')`)).json).name,'Saved after refresh');
  });
  await test('Native backup retains the current model\'s local edits after a save conflict',async()=>{
    const shared=database(),a=page(shared),b=page(shared);
    b.run(`PW.cur=PW.local.cur='p';S.name='Local edits to keep';PW.local.edited=100;`);
    await a.run(`pwSaveModel('p',JSON.stringify({name:'Newer stored model'}),{name:'Newer stored model'})`);
    await assert.rejects(b.run('pwSaveCur()'),conflict);const stored=shared.snapshot();
    assert.equal(await b.run('basisSavePortfolio()'),'saved');assert.equal(b.downloads.length,1);
    b.c.exportedBytes=b.downloads[0].bytes;const backup=await b.run('basisReadArchive(new Blob([exportedBytes]))');
    assert.equal(backup.kind,'portfolio');assert.equal(backup.portfolio.properties[0].model.name,'Local edits to keep');
    assert.equal(b.run('S.name'),'Local edits to keep');assert.deepEqual(shared.snapshot(),stored);
  });
  await test('Older indexes without revision fields also reject stale saves after migration',async()=>{
    const index=initialIndex();delete index.rev;
    const shared=database(index),a=page(shared),b=page(shared);
    a.run(`PW.ix.pfs[0].name='Migrated name'`);await a.run('pwSaveIndex()');
    assert.equal(typeof shared.data.get('pw_index').rev,'string');
    b.run(`PW.ix.pfs[0].name='Stale legacy name'`);await assert.rejects(b.run('pwSaveIndex()'),conflict);
    assert.equal(shared.data.get('pw_index').pfs[0].name,'Migrated name');
  });
  await test('Two first-time pages cannot overwrite each other\'s newly created library',async()=>{
    const shared=new SharedDatabase(),index=initialIndex();delete index.rev;
    const a=page(shared,index),b=page(shared,index);a.run('PW.rev=null');b.run('PW.rev=null');
    const results=await Promise.allSettled([
      a.run(`pwSaveModel('p',JSON.stringify({name:'First library A'}),{name:'First library A'})`),
      b.run(`pwSaveModel('p',JSON.stringify({name:'First library B'}),{name:'First library B'})`)
    ]);
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
    assert.equal(JSON.parse((await a.run(`pwGetModel('p')`)).json).name,shared.data.get('pw_index').props[0].name);
  });
  console.log('RESULT',passed,'concurrency tests passed');
})();
