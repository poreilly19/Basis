const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const workspace=html.slice(html.indexOf('const PW={'),html.indexOf('/* =========================== PORTFOLIO PAGE'));
const clone=value=>value===undefined?undefined:structuredClone(value);

class Storage{
  constructor(){this.data=new Map();}
  get length(){return this.data.size;}key(index){return [...this.data.keys()][index]??null;}
  getItem(key){return this.data.get(String(key))??null;}setItem(key,value){this.data.set(String(key),String(value));}removeItem(key){this.data.delete(String(key));}
}
// Each connection shares serial transactions with atomic publication and browser-
// style request callbacks; startup must not write while examining saved records.
class SharedDatabase{
  constructor(entries=[]){this.data=new Map(entries.map(([key,value])=>[key,clone(value)]));this.queue=[];this.active=null;this.commits=0;}
  connection(){return {transaction:(_store,mode)=>this.transaction(mode)};}
  transaction(mode){
    const database=this,requests=[];
    const tx={error:null,done:false,started:false,scheduled:false,view:null,
      objectStore(){return {get:key=>request('get',key),put:(value,key)=>request('put',key,value),delete:key=>request('delete',key)};},
      abort(){if(!tx.done){tx.error=tx.error||Error('Transaction aborted');finish(false);}}
    };
    function request(operation,key,value){if(tx.done)throw Error('Transaction inactive');if(mode!=='readwrite'&&operation!=='get')throw Error('Read-only transaction');const result={result:undefined,error:null};requests.push({operation,key,value:clone(value),result});schedule();return result;}
    function schedule(){if(tx.started&&!tx.done&&!tx.scheduled){tx.scheduled=true;setImmediate(step);}}
    function finish(commit){if(tx.done)return;tx.done=true;if(commit&&mode==='readwrite'){database.data=tx.view;database.commits++;}setImmediate(()=>{if(commit){if(tx.oncomplete)tx.oncomplete({target:tx});}else if(tx.onabort)tx.onabort({target:tx});database.active=null;database.start();});}
    function step(){tx.scheduled=false;if(tx.done)return;const next=requests.shift();if(!next){finish(true);return;}const {operation,key,value,result}=next;if(operation==='get')result.result=clone(tx.view.get(key));else if(operation==='put'){tx.view.set(key,clone(value));result.result=key;}else tx.view.delete(key);if(result.onsuccess)result.onsuccess({target:result});schedule();}
    tx.start=()=>{tx.started=true;tx.view=new Map([...database.data].map(([key,value])=>[key,clone(value)]));schedule();};database.queue.push(tx);database.start();return tx;
  }
  start(){if(!this.active&&this.queue.length){this.active=this.queue.shift();this.active.start();}}
  snapshot(){return [...this.data].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,clone(value)]);}
}
const settings={version:1,portDisc:.075,portCap:.065,portSingleExit:false,portResaleNoi:'forward'};
const model=name=>({name,areas:[],tenants:[],mlas:[]});
function savedIndex(){return {v:1,rev:'original-revision',pfs:[{id:'pf',name:'Saved portfolio',scs:[{id:'base',name:'Base',settings:clone(settings)}]}],props:[{id:'p',pf:'pf',sc:'base',name:'Preferred saved model',inc:true,saved:1},{id:'q',pf:'pf',sc:'base',name:'Healthy saved model',inc:true,saved:1}]};}
let pageId=0;
function setup({index=savedIndex(),missingPreferred=false,invalidPreferred=false}={}){
  const entries=[['pw_index',index],...index.props.map(record=>['pwm_'+record.id,{v:1,n:1,enc:'json',saved:1,s:JSON.stringify(model(record.name))}])];
  const shared=new SharedDatabase(entries);if(missingPreferred)shared.data.delete('pwm_p');if(invalidPreferred)shared.data.get('pwm_p').s='null';
  const local=new Storage(),session=new Storage(),alerts=[],prefix='lifecycle'+(++pageId)+'-';let id=0;
  local.setItem('basis.pw',JSON.stringify({cur:'p',pf:'pf',sc:'base',open:['p','q'],synced:{p:1,q:1},edited:0}));
  const c=vm.createContext({TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,Response,DataView,Date,JSON,Map,Set,Promise,Error,Number,String,Math,
    crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,btoa,atob,console:{error(){}},uid:()=>prefix+(++id),localStorage:local,sessionStorage:session,
    document:{addEventListener(){}},addEventListener(){},window:{},$:()=>null,kAlert:message=>alerts.push(String(message)),kConfirm:async()=>true,
    blankState:()=>model('Blank'),sampleState:()=>model('Demo sample'),calc:()=>({sf:100,pv:1000,ann:{noi:[60]}}),mKey:()=>'',num:value=>Number(value)||0,
    recalc(){},renderKPI(){},basisRenderContext(){},drawPane(){},PANES:{},T1:'property',MODE:'inputs',setMode(){},idb:shared.connection()});
  for(const file of ['scenario_settings.js','native_codec.js','recovery_store.js'])vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),c);
  // The deployable app may embed validation before or inside the extracted PW block.
  // Either arrangement must provide one copy of the real boundary validator.
  if(!workspace.includes('/* BEGIN BASIS WORKSPACE VALIDATION */'))vm.runInContext(fs.readFileSync(path.join(root,'src/workspace_validation.js'),'utf8'),c);
  vm.runInContext(workspace,c);const run=source=>vm.runInContext(source,c);
  run(`var S={name:'Demo sample',areas:[],tenants:[],mlas:[]};var R={sf:100,pv:1000,ann:{noi:[60]}};PW.localModelLoaded=false;PWS.kind='idb';PWS.idb=idb;pwInitStore=async()=>{};PW.drafts=basisCreateRecoveryStore({local:localStorage,session:sessionStorage,id:()=>uid(),now:()=>12345,validateModel:basisValidateModel});`);
  return {shared,c,run,local,session,alerts};
}
const live=page=>page.run(`JSON.stringify({ix:PW.ix,rev:PW.rev,cur:PW.cur,pf:PW.pf,sc:PW.sc,local:PW.local,cache:[...PW.cache],cacheVersions:[...PW.cacheVersions],cacheClock:PW.cacheClock,objs:[...PW.objs],sel:[...PW.sel],model:S})`);
function assertIsolated(page){assert.equal(page.run('PWS.kind'),'memory');assert.equal(page.run('PW.rev'),null);assert.equal(page.run('PW.mem.size'),0);assert.equal(page.run('PW.cur'),null);assert.equal(page.run('PW.ix.props.length'),0);assert.equal(page.run('!!PW.recoverySource'),true);assert.equal(page.run(`basisValidateWorkspaceIndex(PW.ix)===PW.ix`),true);}
let passed=0;
async function test(name,fn){try{await fn();passed++;console.log('PASS',name);}catch(error){console.error('FAIL',name,error);process.exitCode=1;}}

(async()=>{
  await test('A malformed saved index falls back to writable isolated memory without touching its source',async()=>{
    const index=savedIndex();index.pfs[0].scs=[null];const page=setup({index}),source=page.shared.snapshot();
    await page.run('pwInit()');assertIsolated(page);
    const id=await page.run(`pwAdopt({name:'Safe recovery work',areas:[],tenants:[],mlas:[]},{quiet:true})`);
    assert.equal(page.run('PW.ix.props.length'),1);assert.equal(page.run(`PW.mem.has('pwm_'+${JSON.stringify(id)})`),true);
    assert.deepEqual(page.shared.snapshot(),source);assert.equal(page.shared.commits,0);
  });
  for(const [label,options]of [['missing',{missingPreferred:true}],['invalid',{invalidPreferred:true}]])await test('A '+label+' preferred model can reload a healthy source model after isolated fallback',async()=>{
    const page=setup(options),source=page.shared.snapshot();await page.run('pwInit()');assertIsolated(page);
    assert.equal(await page.run('pwRefreshLibrary()'),true);assert.equal(page.run('PWS.kind'),'idb');assert.equal(page.run('PW.cur'),'q');
    assert.equal(page.run('S.name'),'Healthy saved model');assert.equal(page.run('basisValidateModel(S)===S'),true);
    assert.equal(page.run('PW.ix.props.length'),2);assert.equal(page.run(`PW.ix.props.some(p=>p.id==='p')`),true);
    assert.equal(page.run('PW.rev'),page.run(`pwRevision(PW.ix)`));
    assert.match(page.run('PW.status')+' '+page.alerts.join(' '),/unavailable|missing|could not|not open/i);
    assert.deepEqual(page.shared.snapshot(),source);assert.equal(page.shared.commits,0);
  });
  await test('Invalid reload indexes never change the live library, active model, caches, or selection',async()=>{
    for(const corrupt of [index=>{index.pfs[0].scs=[null];},index=>{index.props[0].pf='missing-portfolio';},index=>{index.props[0].sc='missing-scenario';}]){
      const page=setup();await page.run('pwInit()');page.run(`PW.sel.add('q');pwCacheSet('q',JSON.stringify({name:'Cached healthy',areas:[],tenants:[],mlas:[]}));PW.objs.set('q',{name:'Cached object'});`);
      const before=live(page),index=clone(page.shared.data.get('pw_index'));corrupt(index);index.rev='corrupt-revision';page.shared.data.set('pw_index',index);const source=page.shared.snapshot();
      await assert.rejects(page.run('pwRefreshLibrary()'),/saved|scenario|portfolio|invalid|orphan/i);
      assert.equal(live(page),before);assert.equal(page.run('PWS.kind'),'idb');assert.deepEqual(page.shared.snapshot(),source);
    }
  });
  await test('An existing empty saved library stays empty across initialization and reload without writes',async()=>{
    const index=savedIndex();index.props=[];const page=setup({index}),source=page.shared.snapshot();
    await page.run('pwInit()');await page.run('PW.q');assert.equal(page.run('PW.cur'),null);assert.equal(page.run('PW.ix.props.length'),0);
    assert.equal(page.run('PW.ix.rev'),'original-revision');assert.deepEqual(page.shared.snapshot(),source);assert.equal(page.shared.commits,0);
    assert.equal(await page.run('pwRefreshLibrary()'),true);assert.equal(page.run('PW.cur'),null);assert.equal(page.run('PW.ix.props.length'),0);
    assert.deepEqual(page.shared.snapshot(),source);assert.equal(page.shared.commits,0);
  });
  await test('Recovery requested before startup waits and restores a new isolated property while retaining its draft',async()=>{
    const index=savedIndex();index.props[0].sc='orphan-scenario';const page=setup({index}),source=page.shared.snapshot();
    const draftId=page.run(`PW.drafts.capture(JSON.stringify({name:'Draft to rescue',areas:[],tenants:[],mlas:[]}),{propertyId:'p'}).id`);page.c.draftId=draftId;
    let settled=false;const restoring=page.run('pwRecoveryRestore(draftId)');restoring.then(()=>{settled=true;},()=>{settled=true;});
    await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false);assert.equal(page.run('PW.ix'),null);assert.equal(page.shared.commits,0);
    await page.run('pwInit()');const id=await restoring;assert.notEqual(id,'p');assert.equal(page.run('PWS.kind'),'memory');assert.equal(page.run('PW.cur'),null);
    assert.equal(page.run('PW.ix.props.length'),1);assert.equal(page.run(`PW.ix.props[0].name`),'Draft to rescue (recovered)');
    assert.equal(page.run('PW.drafts.get(draftId).model.name'),'Draft to rescue');assert.equal(page.run('PW.drafts.list().some(draft=>draft.id===draftId)'),true);
    assert.deepEqual(page.shared.snapshot(),source);assert.equal(page.shared.commits,0);
  });
  console.log('RESULT',passed,'initialization lifecycle tests passed');
})();
