const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const workspace=html.slice(html.indexOf('const PW={'),html.indexOf('/* =========================== PORTFOLIO PAGE'));
const clone=value=>value===undefined?undefined:structuredClone(value);

// Requests run in browser order, with a private transaction snapshot. Aborting a
// later model/index write discards every earlier write in the same transaction.
class SharedDatabase{
  constructor(entries=[]){this.data=new Map(entries.map(([key,value])=>[key,clone(value)]));this.queue=[];this.active=null;this.failWrite=null;}
  connection(){return {transaction:(_name,mode)=>this.transaction(mode)};}
  transaction(mode){
    const database=this,requests=[];
    const tx={error:null,done:false,started:false,scheduled:false,view:null,
      objectStore(){return {get:key=>request('get',key),put:(value,key)=>request('put',key,value),delete:key=>request('delete',key)};},
      abort(){if(!tx.done){tx.error=tx.error||new Error('Transaction aborted');finish(false);}}
    };
    function request(operation,key,value){
      if(tx.done)throw new Error('Transaction inactive');
      if(mode!=='readwrite'&&operation!=='get')throw new Error('Read-only transaction');
      const result={result:undefined,error:null};requests.push({operation,key,value:clone(value),result});schedule();return result;
    }
    function schedule(){if(tx.started&&!tx.done&&!tx.scheduled){tx.scheduled=true;setImmediate(step);}}
    function finish(commit){
      if(tx.done)return;tx.done=true;if(commit&&mode==='readwrite')database.data=tx.view;
      setImmediate(()=>{if(commit){if(tx.oncomplete)tx.oncomplete({target:tx});}else if(tx.onabort)tx.onabort({target:tx});database.active=null;database.start();});
    }
    function step(){
      tx.scheduled=false;if(tx.done)return;const next=requests.shift();if(!next){finish(true);return;}
      const {operation,key,value,result}=next;
      if(operation==='put'&&database.failWrite&&database.failWrite(key,value)){
        const error=new Error('Simulated storage failure at '+key);error.name='QuotaExceededError';database.failWrite=null;
        tx.error=result.error=error;if(result.onerror)result.onerror({target:result});finish(false);return;
      }
      if(operation==='get')result.result=clone(tx.view.get(key));
      else if(operation==='put'){tx.view.set(key,clone(value));result.result=key;}else tx.view.delete(key);
      if(result.onsuccess)result.onsuccess({target:result});schedule();
    }
    tx.start=()=>{tx.started=true;tx.view=new Map([...database.data].map(([key,value])=>[key,clone(value)]));schedule();};
    database.queue.push(tx);database.start();return tx;
  }
  start(){if(!this.active&&this.queue.length){this.active=this.queue.shift();this.active.start();}}
  failNextWrite(key){this.failWrite=candidate=>candidate===key;}
  failNextModel(name){this.failWrite=(key,value)=>key.startsWith('pwm_')&&value&&typeof value.s==='string'&&value.s.includes(JSON.stringify(name));}
  snapshot(){return [...this.data].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,clone(value)]);}
}

const models={p:{name:'Original A',areas:[],tenants:[],mlas:[]},q:{name:'Original B',areas:[],tenants:[],mlas:[]},x:{name:'Other property',areas:[],tenants:[],mlas:[]}};
function fixture(){
  const index={v:1,rev:'initial-revision',pfs:[
    {id:'pf',name:'Existing',scs:[{id:'base',name:'Base'},{id:'up',name:'Upside'}]},
    {id:'other',name:'Other portfolio',scs:[{id:'other-base',name:'Other base'}]}
  ],props:[{id:'p',pf:'pf',sc:'base',name:models.p.name,inc:true,saved:1},{id:'q',pf:'pf',sc:'base',name:models.q.name,inc:true,saved:1},{id:'x',pf:'other',sc:'other-base',name:models.x.name,inc:true,saved:1}]};
  const shared=new SharedDatabase([['pw_index',index],...Object.entries(models).map(([id,model])=>['pwm_'+id,{v:1,n:1,enc:'json',saved:1,s:JSON.stringify(model)}])]);
  return {shared,...page(shared,index)};
}
let pageId=0;
function page(shared,index=shared.data.get('pw_index')){
  const local=new Map(),alerts=[],prefix='actions'+(++pageId)+'-';let id=0;
  const c=vm.createContext({TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,Response,DataView,Date,JSON,Map,Set,Promise,Error,Number,String,
    crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,btoa,atob,console:{error(){}},uid:()=>prefix+(++id),
    localStorage:{getItem:key=>local.get(key)||null,setItem:(key,value)=>local.set(key,value)},document:{addEventListener(){}},addEventListener(){},
    window:{},$:()=>null,kAlert:message=>alerts.push(message),kConfirm:async()=>true,blankState:()=>({name:'Blank',areas:[],tenants:[],mlas:[]}),
    calc:()=>({sf:100,pv:1000,ann:{noi:[60]}}),mKey:()=>'',num:value=>Number.isFinite(Number(value))?Number(value):0,recalc(){},renderKPI(){},basisRenderContext(){},drawPane(){},
    PANES:{},T1:'property',MODE:'inputs',sampleState:()=>({name:'Sample'}),setMode(){},idb:shared.connection(),initial:clone(index),initialModels:clone(models)});
  for(const file of ['scenario_settings.js','native_codec.js'])vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),c);
  vm.runInContext(workspace,c);const run=source=>vm.runInContext(source,c);
  run(`PW.ix=initial;PW.rev=pwRevision(initial);PW.pf='pf';PW.sc='base';PW.local={cur:null,pf:'pf',sc:'base',open:['p','q'],synced:{p:1,q:1,x:1},edited:0};PW._done();PWS.kind='idb';PWS.idb=idb;var S={name:'Active',areas:[],tenants:[],mlas:[]};var R={sf:100,pv:1000,ann:{noi:[60]}};for(const [id,model]of Object.entries(initialModels))pwCacheSet(id,JSON.stringify(model));PW.objs.set('q',initialModels.q);PW.sel.add('p');`);
  return {c,run,alerts};
}
const live=page=>page.run(`JSON.stringify({ix:PW.ix,rev:PW.rev,cur:PW.cur,pf:PW.pf,sc:PW.sc,local:PW.local,cache:[...PW.cache],cacheVersions:[...PW.cacheVersions],cacheClock:PW.cacheClock,objs:[...PW.objs],sel:[...PW.sel],model:S})`);
async function unchangedAfterFailure(page,operation,pattern=/storage failure/){
  const before=page.shared.snapshot(),state=live(page);await assert.rejects(page.run(operation),pattern);
  assert.deepEqual(page.shared.snapshot(),before);assert.equal(live(page),state);
}
const membership=/chang|membership|confirm|again|stale/i;
let passed=0;
async function test(name,fn){try{await fn();passed++;console.log('PASS',name);}catch(error){console.error('FAIL',name,error);process.exitCode=1;}}

(async()=>{
  await test('Overlapping adoptions never publish another operation\'s failed property record',async()=>{
    const page=fixture();page.shared.failNextModel('Second adoption fails');
    const results=await Promise.allSettled([
      page.run(`pwAdopt({name:'First adoption succeeds',areas:[],tenants:[],mlas:[]},{quiet:true})`),
      page.run(`pwAdopt({name:'Second adoption fails',areas:[],tenants:[],mlas:[]},{quiet:true})`)
    ]);
    assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected');assert.match(String(results[1].reason),/storage failure/);
    const index=page.shared.data.get('pw_index');assert.equal(index.props.length,4);
    assert.equal(index.props.some(property=>property.name==='Second adoption fails'),false);
    assert.equal(page.run(`PW.ix.props.some(p=>p.name==='Second adoption fails')`),false);
    for(const property of index.props)assert.ok(page.shared.data.has(property.storageKey||'pwm_'+property.id),'Stored index references a missing model');
    assert.deepEqual(JSON.parse(page.run('JSON.stringify(PW.ix)')),index);
  });
  await test('A failed multi-property copy preserves the library and every local selection/cache',async()=>{
    const page=fixture();page.shared.failNextWrite('pw_index');
    await unchangedAfterFailure(page,`pwCopy(['p','q'],'other','other-base',true)`);
  });
  await test('A later copied model failure rolls back the entire new scenario and its properties',async()=>{
    const page=fixture();page.shared.failNextModel('Original B');
    await unchangedAfterFailure(page,`pwCreateScenario('pf','base','Failed copied scenario',true)`);
  });
  await test('A failed portfolio delete preserves parent, children, models, and dirty active state',async()=>{
    const page=fixture();page.run(`PW.cur=PW.local.cur='p';S={...initialModels.p,name:'Dirty active A'};PW.local.edited=20;pwCacheSet('p',JSON.stringify(S));`);
    page.shared.failNextWrite('pw_index');await unchangedAfterFailure(page,`pwDeletePortfolio('pf',['p','q'])`);
  });
  await test('A failed scenario delete preserves parent, children, models, and dirty active state',async()=>{
    const page=fixture();page.run(`PW.cur=PW.local.cur='p';S={...initialModels.p,name:'Dirty active A'};PW.local.edited=20;pwCacheSet('p',JSON.stringify(S));`);
    page.shared.failNextWrite('pw_index');await unchangedAfterFailure(page,`pwDeleteScenario('pf','base',['p','q'])`);
  });
  await test('Confirmed portfolio deletion accepts reordered IDs and removes parent and children together',async()=>{
    const page=fixture();assert.equal(await page.run(`pwDeletePortfolio('pf',['q','p'])`),true);
    const index=page.shared.data.get('pw_index');assert.deepEqual(index.pfs.map(pf=>pf.id),['other']);
    assert.deepEqual(index.props.map(property=>property.id),['x']);
    assert.equal(page.shared.data.has('pwm_p'),false);assert.equal(page.shared.data.has('pwm_q'),false);assert.equal(page.shared.data.has('pwm_x'),true);
    assert.deepEqual(JSON.parse(page.run('JSON.stringify(PW.ix)')),index);
  });
  await test('A changed portfolio membership requires fresh confirmation without deleting any child',async()=>{
    const page=fixture();await page.run(`pwMove(['x'],'pf','base')`);
    await unchangedAfterFailure(page,`pwDeletePortfolio('pf',['p','q'])`,membership);
  });
  await test('Scenario confirmation rejects a same-count replacement of its property IDs',async()=>{
    const page=fixture();await page.run(`pwMove(['q'],'other','other-base')`);await page.run(`pwMove(['x'],'pf','base')`);
    await unchangedAfterFailure(page,`pwDeleteScenario('pf','base',['p','q'])`,membership);
  });
  await test('An empty confirmation cannot delete a scenario that gained a property',async()=>{
    const page=fixture();await page.run(`pwMove(['x'],'pf','up')`);
    await unchangedAfterFailure(page,`pwDeleteScenario('pf','up',[])`,membership);
  });
  await test('Deletion checks confirmation membership after earlier queued moves have committed',async()=>{
    const page=fixture();page.run(`var releaseQueue;pwEnq(()=>new Promise(resolve=>{releaseQueue=resolve;}));`);
    await new Promise(resolve=>setImmediate(resolve));
    const moving=page.run(`pwMove(['x'],'pf','base')`),deleting=page.run(`pwDeletePortfolio('pf',['p','q'])`);
    const rejected=assert.rejects(deleting,membership);page.run('releaseQueue()');await moving;await rejected;
    const index=page.shared.data.get('pw_index');assert.ok(index.pfs.some(pf=>pf.id==='pf'));
    assert.deepEqual(index.props.filter(property=>property.pf==='pf').map(property=>property.id).sort(),['p','q','x']);
    for(const id of ['p','q','x'])assert.ok(page.shared.data.has('pwm_'+id));
  });
  for(const [label,operation] of [
    ['portfolio creation',`pwCreatePortfolio('Failed portfolio','Base')`],
    ['scenario creation',`pwCreateScenario('pf','base','Failed empty scenario',false)`],
    ['portfolio rename',`pwRenameRecord('portfolio','pf','Failed portfolio rename')`],
    ['scenario rename',`pwRenameRecord('scenario','base','Failed scenario rename','pf')`],
    ['property move',`pwMove(['p','q'],'other','other-base')`]
  ])await test('Failed '+label+' leaves live and persisted libraries unchanged',async()=>{
    const page=fixture();page.shared.failNextWrite('pw_index');await unchangedAfterFailure(page,operation);
  });
  await test('Overlapping copies allocate distinct names and preserve each full model',async()=>{
    const page=fixture();const results=await Promise.all([
      page.run(`pwCopy(['p'],'pf','base',true)`),page.run(`pwCopy(['p'],'pf','base',true)`)
    ]);
    assert.equal(results[0].length,1);assert.equal(results[1].length,1);assert.notEqual(results[0][0],results[1][0]);
    const index=page.shared.data.get('pw_index'),copies=index.props.filter(property=>results.flat().includes(property.id));
    assert.deepEqual(copies.map(property=>property.name).sort(),['Copy of Original A','Copy of Original A (2)']);
    for(const property of copies){const stored=JSON.parse(page.shared.data.get('pwm_'+property.id).s);assert.deepEqual(stored,{...models.p,name:property.name});}
    assert.deepEqual(JSON.parse(page.shared.data.get('pwm_p').s),models.p);
  });
  await test('Copying an active property captures its current model before waiting on other saves',async()=>{
    const page=fixture();page.run(`PW.cur=PW.local.cur='p';S={...initialModels.p,name:'Captured current model',note:'Snapshot at click'};var releaseQueue;pwEnq(()=>new Promise(resolve=>{releaseQueue=resolve;}));`);
    await new Promise(resolve=>setImmediate(resolve));
    const copying=page.run(`pwCopy(['p'],'other','other-base',false)`);
    page.run(`S.name='Edits made while copy waits';S.note='Still editing';releaseQueue();`);
    const [id]=await copying,stored=JSON.parse(page.shared.data.get('pwm_'+id).s);
    assert.equal(stored.name,'Captured current model');assert.equal(stored.note,'Snapshot at click');
    assert.equal(page.run('S.name'),'Edits made while copy waits');assert.equal(page.run('S.note'),'Still editing');assert.equal(page.run('PW.cur'),'p');
  });
  await test('Copied workspace metrics describe the same edited snapshot as the saved model',async()=>{
    const engineContext=vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(root,'src/financial_engine.js'),'utf8'),engineContext);
    const engine=vm.runInContext('({blankState,calc})',engineContext),source=engine.blankState();
    Object.assign(source,{name:'Current source',startYear:2026,startMonth:1,years:2,gvRate:0,clRate:0,
      inflExp:0,inflRent:0,inflCPI:0,loanOn:false,exitCap:0.08,costSale:0,discount:0});
    source.infl.forEach(series=>{series.rates=[0,0,0,0];});
    source.areas=[{id:'area',name:'Building',sf:1000,basis:true}];
    source.tenants=[{id:'tenant',name:'Tenant',sf:1000,start:'2026-01',end:'2035-12',
      rent:12,step:0,free:0,rec:source.recs[1].id,mla:source.mlas[0].id,expiry:'Vacate'}];
    source.ops=[];
    // Independent economics: $12,000 annual NOI for two years, then a
    // $150,000 sale at 8%. With zero discount, value is $174,000.
    const before=engine.calc(source);assert.equal(before.sf,1000);assert.equal(before.ann.noi[0],12000);assert.equal(before.pv,174000);
    const page=fixture();page.c.calc=engine.calc;page.c.copySource=clone(source);
    page.shared.data.get('pwm_p').s=JSON.stringify(source);
    page.run(`PW.cur=PW.local.cur='p';S=JSON.parse(JSON.stringify(copySource));
      Object.assign(pwRec('p'),{sf:1000,pv:174000,noi:12000});
      S.areas[0].sf=2000;S.tenants[0].sf=2000;S.name='Edited before copying';`);
    const [id]=await page.run(`pwCopy(['p'],'other','other-base',true)`);
    const stored=JSON.parse(page.shared.data.get('pwm_'+id).s),record=page.shared.data.get('pw_index').props.find(p=>p.id===id);
    assert.equal(stored.areas[0].sf,2000);assert.equal(stored.tenants[0].sf,2000);
    assert.deepEqual([record.sf,record.noi,record.pv],[2000,24000,348000]);
    assert.deepEqual(JSON.parse(page.run(`JSON.stringify([pwRec('${id}').sf,pwRec('${id}').noi,pwRec('${id}').pv])`)),[2000,24000,348000]);
  });
  await test('A captured copy never rolls back a newer successful save of its current source',async()=>{
    const page=fixture();page.run(`PW.cur=PW.local.cur='p';S={...initialModels.p,name:'Old copy snapshot'};var releaseQueue;pwEnq(()=>new Promise(resolve=>{releaseQueue=resolve;}));`);
    await new Promise(resolve=>setImmediate(resolve));
    const copying=page.run(`pwCopy(['p'],'other','other-base',false)`);
    const saving=page.run(`S.name='Newer source saved';pwSaveCur()`);
    page.run('releaseQueue()');const [[id]]=await Promise.all([copying,saving]);
    assert.equal(JSON.parse(page.shared.data.get('pwm_'+id).s).name,'Old copy snapshot');
    assert.equal(JSON.parse(page.shared.data.get('pwm_p').s).name,'Newer source saved');
    assert.equal(page.run(`JSON.parse(PW.cache.get('p')).name`),'Newer source saved');assert.equal(page.run('S.name'),'Newer source saved');
  });
  await test('A queued inclusion toggle survives another action publishing a replacement index',async()=>{
    const page=fixture();page.run(`var enteredResolve,entered=new Promise(resolve=>{enteredResolve=resolve;}),releaseCommit,firstCommit=true,originalCommit=pwCommit;pwCommit=async(...args)=>{if(firstCommit){firstCommit=false;await new Promise(resolve=>{releaseCommit=resolve;enteredResolve();});}return originalCommit(...args);};`);
    const adding=page.run(`pwAdopt({name:'Blocking adoption',areas:[],tenants:[],mlas:[]},{quiet:true})`);
    await page.run('entered');const including=page.run(`pwSetIncluded('p',false)`);
    page.run('releaseCommit()');const [id]=await Promise.all([adding,including]);
    assert.equal(page.run(`pwRec('p').inc`),false);assert.equal(page.shared.data.get('pw_index').props.find(property=>property.id==='p').inc,false);
    assert.ok(page.shared.data.get('pw_index').props.some(property=>property.id===id));assert.ok(page.shared.data.has('pwm_'+id));
  });
  await test('A failed inclusion commit preserves the prior live and persisted inclusion',async()=>{
    const page=fixture();page.shared.failNextWrite('pw_index');await unchangedAfterFailure(page,`pwSetIncluded('p',false)`);
  });
  await test('Failed recalculation leaves metadata, caches, selection, and stored models unchanged',async()=>{
    const page=fixture();page.c.calc=()=>({sf:987654,pv:1234567,ann:{noi:[54321]}});page.shared.failNextWrite('pw_index');
    await unchangedAfterFailure(page,'pwRecalcAll()');
  });
  await test('Recalculation saves a dirty current snapshot and its metrics atomically with autosave off',async()=>{
    const page=fixture();page.c.calc=model=>({sf:model.areas[0]?.sf||0,pv:(model.areas[0]?.sf||0)*100,ann:{noi:[(model.areas[0]?.sf||0)*5]}});
    page.run(`var BASIS_PREFS={get:()=>({autosave:false})};PW.cur=PW.local.cur='p';PW.local.edited=20;
      S={...initialModels.p,name:'Manually edited current',areas:[{id:'area',sf:200,basis:true}]};`);
    const other=clone(page.shared.data.get('pwm_x')),neighbor=clone(page.shared.data.get('pwm_q'));
    await page.run('pwRecalcAll()');
    const record=page.shared.data.get('pw_index').props.find(p=>p.id==='p'),stored=JSON.parse(page.shared.data.get('pwm_p').s);
    assert.equal(stored.name,'Manually edited current');assert.equal(stored.areas[0].sf,200);
    assert.deepEqual([record.name,record.sf,record.pv,record.noi],['Manually edited current',200,20000,1000]);
    assert.equal(page.run('PW.local.edited'),0);assert.equal(page.run('PW.timer'),null);
    assert.deepEqual(page.shared.data.get('pwm_x'),other);assert.deepEqual(page.shared.data.get('pwm_q'),neighbor);
    await page.run('pwRefreshLibrary()');
    assert.equal(page.run('S.name'),'Manually edited current');assert.equal(page.run('S.areas[0].sf'),200);
  });
  await test('Failed recalculation with unsaved manual edits preserves durable models and live edits',async()=>{
    const page=fixture();page.c.calc=model=>({sf:model.areas[0]?.sf||0,pv:20000,ann:{noi:[1000]}});
    page.run(`var BASIS_PREFS={get:()=>({autosave:false})};PW.cur=PW.local.cur='p';PW.local.edited=20;
      S={...initialModels.p,name:'Keep unsaved manual edits',areas:[{id:'area',sf:200,basis:true}]};`);
    page.shared.failNextWrite('pw_index');await unchangedAfterFailure(page,'pwRecalcAll()');
    assert.equal(page.run('S.name'),'Keep unsaved manual edits');assert.equal(page.run('PW.local.edited'),20);
    assert.equal(JSON.parse(page.shared.data.get('pwm_p').s).name,'Original A');
  });
  await test('Edits made while recalculation reads another model cancel the pending publication',async()=>{
    const page=fixture();page.run(`PW.cur=PW.local.cur='p';S={...initialModels.p,name:'Captured recalculation'};PW.local.edited=20;
      PW.cache.delete('q');var releaseRead,readEnteredResolve,readEntered=new Promise(resolve=>{readEnteredResolve=resolve;}),originalGetModel=pwGetModel;
      pwGetModel=async(...args)=>{const result=await originalGetModel(...args);return new Promise(resolve=>{releaseRead=()=>resolve(result);readEnteredResolve();});};`);
    const before=page.shared.snapshot(),recalculating=page.run('pwRecalcAll()'),rejected=assert.rejects(recalculating,/current property or scenario changed/);
    await page.run('readEntered');page.run(`S.name='Typed while recalculation waits';releaseRead();`);await rejected;
    assert.deepEqual(page.shared.snapshot(),before);assert.equal(page.run('S.name'),'Typed while recalculation waits');assert.equal(page.run('PW.local.edited'),20);
  });
  await test('A finishing copy cannot replace the newer cache owned by an outgoing property save',async()=>{
    const page=fixture();page.run(`PW.cur=PW.local.cur='p';S={...initialModels.p,name:'Old context'};var enteredResolve,entered=new Promise(resolve=>{enteredResolve=resolve;}),releaseCommit,firstCommit=true,originalCommit=pwCommit;pwCommit=async(...args)=>{if(firstCommit){firstCommit=false;await new Promise(resolve=>{releaseCommit=resolve;enteredResolve();});}return originalCommit(...args);};`);
    const copying=page.run(`pwCopy(['p'],'other','other-base',false)`);await page.run('entered');
    const opening=page.run(`S.name='New current edits';pwOpen('q')`);page.run('releaseCommit()');await Promise.all([copying,opening]);
    assert.equal(page.run('PW.cur'),'q');assert.equal(JSON.parse(page.shared.data.get('pwm_p').s).name,'New current edits');
    assert.equal(page.run(`JSON.parse(PW.cache.get('p')).name`),'New current edits');
    await page.run(`pwOpen('p')`);assert.equal(page.run('S.name'),'New current edits');
  });
  await test('A failed later embedded-member write preserves the entire source and library',async()=>{
    const page=fixture();page.run(`PW.cur=PW.local.cur='p';S={...initialModels.p,portfolio:[{model:initialModels.q},{model:initialModels.x}]};`);page.shared.failNextModel('Other property');
    await unchangedAfterFailure(page,'pwAdoptMembers()');
  });
  await test('Embedded members and their source update publish in one commit',async()=>{
    const page=fixture();page.run(`PW.cur=PW.local.cur='p';S={...initialModels.p,portfolio:[{model:initialModels.q},{model:initialModels.x}]};var commits=0,realCommit=pwCommit;pwCommit=(...args)=>{commits++;return realCommit(...args);};`);
    await page.run('pwAdoptMembers()');assert.equal(page.run('commits'),1);assert.equal(page.run('PW.ix.props.length'),5);assert.equal(page.run('S.portfolio.length'),0);
    assert.equal(JSON.parse(page.shared.data.get('pwm_p').s).portfolio.length,0);for(const record of page.shared.data.get('pw_index').props)assert.ok(page.shared.data.has('pwm_'+record.id));
  });
  console.log('RESULT',passed,'library action tests passed');
})();
