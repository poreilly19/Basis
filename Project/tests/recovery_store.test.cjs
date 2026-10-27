const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test'),root=path.join(__dirname,'..');
const context=vm.createContext({TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer,Date,JSON,Map,Set,Promise,Error,Number,String,Math,crypto:require('node:crypto').webcrypto});
vm.runInContext(fs.readFileSync(path.join(root,'src/scenario_settings.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'src/native_codec.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'src/recovery_store.js'),'utf8'),context);
const {basisCreateRecoveryStore,basisValidateModel}=vm.runInContext('({basisCreateRecoveryStore,basisValidateModel})',context);
class Storage{
  constructor(entries=[]){this.data=new Map(entries);this.quota=Infinity;this.failWrite=false;this.failRemove=false;}
  get length(){return this.data.size;}key(i){return [...this.data.keys()][i]??null;}getItem(k){return this.data.has(String(k))?this.data.get(String(k)):null;}
  setItem(k,v){k=String(k);v=String(v);const next=new Map(this.data);next.set(k,v);if(this.failWrite||[...next].reduce((n,[a,b])=>n+2*(a.length+b.length),0)>this.quota){const e=Error('Storage quota reached');e.name='QuotaExceededError';throw e;}this.data=next;}
  removeItem(k){if(this.failRemove)throw Error('Removal denied');this.data.delete(String(k));}
}
let n=0;const freshId=()=>`draft-${++n}`,model=(name,extra={})=>JSON.stringify({name,areas:[],tenants:[],mlas:[],...extra});
const store=(local=new Storage(),session=new Storage(),options={})=>basisCreateRecoveryStore({local,session,id:freshId,now:()=>12345,validateModel:basisValidateModel,...options});

test('independent tabs retain their own snapshots and session workspace state',()=>{
  const local=new Storage(),a=store(local),b=store(local),aJson=model('A'),bJson=model('B');
  a.saveState({cur:'a',open:['a']});b.saveState({cur:'b',open:['b']});
  const aid=a.capture(aJson,{propertyId:'a'}).id,bid=b.capture(bJson,{propertyId:'b'}).id;
  assert.notEqual(aid,bid);assert.notEqual(a.tabId,b.tabId);assert.equal(a.get(aid).model.name,'A');assert.equal(b.get(bid).model.name,'B');
  assert.equal(a.list().length,2);assert.equal(a.loadState().cur,'a');assert.equal(b.loadState().cur,'b');
});
test('reloads keep tab identity while cloned session storage receives independent document writers',()=>{
  const local=new Storage(),session=new Storage(),a=store(local,session);a.saveState({cur:'original'});const first=a.capture(model('First')).id;
  const clone=new Storage([...session.data]),duplicate=store(local,clone),reload=store(local,session);
  assert.equal(duplicate.tabId,a.tabId);assert.equal(reload.tabId,a.tabId);assert.notEqual(duplicate.writerId,a.writerId);assert.notEqual(reload.writerId,a.writerId);
  duplicate.capture(model('Duplicated tab'));reload.capture(model('Reloaded tab'));assert.equal(a.get(first).model.name,'First');assert.equal(reload.list().length,3);assert.equal(reload.loadState().cur,'original');
});
test('only the exact successfully saved model acknowledges its own property draft',()=>{
  const local=new Storage(),a=store(local),b=store(local),before=model('Before'),after=model('After');
  const aid=a.capture(before,{propertyId:'p'}).id,bid=b.capture(model('Other'),{propertyId:'p'}).id;
  a.capture(after,{propertyId:'p'});assert.equal(a.acknowledge(before,'p'),false);assert.equal(a.acknowledge(after,'wrong'),false);assert.equal(a.list().length,2);
  assert.equal(a.acknowledge(after,'p'),true);assert.equal(a.list().length,1);assert.equal(a.get(bid).model.name,'Other');assert.throws(()=>a.get(aid),/malformed/);
});
test('quota failures preserve the last durable draft and expose the current draft in memory',()=>{
  const local=new Storage(),a=store(local),original=model('Durable'),id=a.capture(original,{propertyId:'p'}).id,raw=local.getItem('basis.draft.v1.'+id);
  local.failWrite=true;const result=a.capture(model('Latest edits'),{propertyId:'p'});assert.equal(result.saved,false);assert.equal(result.memoryOnly,true);assert.match(a.status().error,/quota/i);
  assert.equal(local.getItem('basis.draft.v1.'+id),raw);assert.equal(a.get(id).model.name,'Latest edits');assert.equal(a.list()[0].memoryOnly,true);
  const afterCrash=store(local);assert.equal(afterCrash.get(id).model.name,'Durable');
});
test('count, total-byte and per-entry limits preserve other unsaved drafts without eviction',()=>{
  const local=new Storage(),a=store(local),id=a.capture(model('Keep')).id,raw=local.getItem('basis.draft.v1.'+id);
  for(const limits of [{maxRecords:1},{maxBytes:50},{maxEntryBytes:50}]){const b=store(local,new Storage(),limits),result=b.capture(model('New'));assert.equal(result.saved,false);assert.match(result.error,/limit|full/i);assert.equal(local.getItem('basis.draft.v1.'+id),raw);assert.equal(b.list().find(x=>x.id===id).readable,true);}
});
test('failed removals keep durable and in-memory drafts recoverable',()=>{
  const local=new Storage(),a=store(local),id=a.capture(model('Keep me')).id;local.failRemove=true;
  assert.throws(()=>a.discard(id),/Could not remove/);assert.equal(a.get(id).model.name,'Keep me');assert.equal(a.acknowledge(model('Keep me'),null),false);assert.equal(a.list().length,1);
});
test('legacy migration copies a candidate once and preserves the original shared keys',()=>{
  const json=model('Legacy'),legacyState=JSON.stringify({cur:'old',open:['old']}),local=new Storage([['basis.model',json],['basis.pw',legacyState]]),a=store(local);
  const migrated=a.migrateLegacy();assert.equal(migrated.migrated,true);assert.equal(a.list()[0].source,'legacy');assert.equal(a.get(migrated.id).model.name,'Legacy');assert.equal(local.getItem('basis.model'),json);assert.equal(local.getItem('basis.pw'),legacyState);
  assert.equal(a.migrateLegacy().migrated,false);const b=store(local);assert.equal(b.migrateLegacy().migrated,false);assert.equal(b.loadState().cur,'old');b.saveState({cur:'new'});assert.equal(local.getItem('basis.pw'),legacyState);
  b.discard(migrated.id);assert.equal(store(local).migrateLegacy().migrated,false);assert.equal(local.getItem('basis.model'),json);
});
test('malformed, unsafe or oversized legacy models do not mutate old data or existing drafts',()=>{
  for(const bad of ['{bad',model('Bad',{areas:{}}),'null',model('Bad',{tenants:[null]}),'{"name":"Bad","__proto__":{"polluted":true}}']){
    const local=new Storage([['basis.model',bad]]),a=store(local);assert.equal(a.migrateLegacy().migrated,false);assert.equal(local.getItem('basis.model'),bad);assert.equal([...local.data.keys()].filter(k=>k.startsWith('basis.draft.v1.')).length,0);
  }
  const json=model('Too large',{extra:'x'.repeat(1000)}),local=new Storage([['basis.model',json]]),a=store(local,new Storage(),{maxEntryBytes:100});assert.match(a.migrateLegacy().error,/limit/i);assert.equal(local.getItem('basis.model'),json);
});
test('unreadable stored drafts remain listed and cannot be restored without validation',()=>{
  const local=new Storage([['basis.draft.v1.broken','{"v":1}']]),a=store(local);assert.equal(a.list()[0].readable,false);assert.throws(()=>a.get('broken'),/malformed/);
  const id=a.capture(model('Bad',{areas:{}})).id;assert.throws(()=>a.get(id),/areas/i);assert.equal({}.polluted,undefined);assert.throws(()=>a.get('../escape'),/identifier/);
});
test('session failures retain tab state in memory and local recovery remains usable',()=>{
  const local=new Storage(),session=new Storage();session.failWrite=true;const a=store(local,session);assert.equal(a.saveState({cur:'current'}).saved,false);assert.equal(a.loadState().cur,'current');assert.match(a.status().error,/quota/i);const id=a.capture(model('Local draft')).id;assert.equal(a.get(id).model.name,'Local draft');
});
test('malformed capture does not replace a previously recoverable model',()=>{
  const a=store(),id=a.capture(model('Safe')).id;assert.equal(a.capture('{invalid').saved,false);assert.equal(a.get(id).model.name,'Safe');
});
test('legacy candidates stay available when quota prevents copying them into the draft namespace',()=>{
  const json=model('Legacy quota'),local=new Storage([['basis.model',json]]);local.failWrite=true;const a=store(local),result=a.migrateLegacy();
  assert.equal(result.migrated,false);assert.match(result.error,/quota/i);assert.equal(a.list()[0].memoryOnly,true);assert.equal(a.get(result.id).model.name,'Legacy quota');assert.equal(local.getItem('basis.model'),json);
});

function application(local=new Storage(),session=new Storage()){
  const html=fs.readFileSync(path.join(root,'app/index.html'),'utf8'),source=html.slice(html.indexOf('const PW={'),html.indexOf('/* =========================== PORTFOLIO PAGE'));
  const c=vm.createContext({TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,Date,JSON,Map,Set,Promise,Error,Number,String,Math,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,
    localStorage:local,sessionStorage:session,uid:freshId,document:{addEventListener(){}},addEventListener(){},console:{error(){}},window:{},$:()=>null,kAlert(){},
    blankState:()=>({name:'Blank',areas:[],tenants:[],mlas:[]}),calc:()=>({sf:100,pv:1000,ann:{noi:[60]}}),mKey:()=>'',num:value=>Number.isFinite(Number(value))?Number(value):0,recalc(){},renderKPI(){},basisRenderContext(){},drawPane(){},PANES:{},T1:'property',MODE:'inputs',setMode(){}});
  for(const file of ['scenario_settings.js','native_codec.js','recovery_store.js'])vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),c);
  vm.runInContext(source,c);const run=s=>vm.runInContext(s,c);
  run(`PW.ix={v:1,pfs:[{id:'pf',name:'Library',scs:[{id:'base',name:'Base'}]}],props:[{id:'existing',pf:'pf',sc:'base',name:'Active'}]};PW.pf='pf';PW.sc='base';PW.cur='existing';PW.local={open:['existing'],synced:{}};PWS.kind='memory';PW._done();var S={name:'Active',areas:[],tenants:[],mlas:[]};var R={sf:100,pv:1000,ann:{noi:[60]}};PW.mem.set('pw_index',pwIxCopy());PW.rev=pwRevision(PW.ix);PW.mem.set('pwm_existing',{v:1,n:1,enc:'json',saved:1,s:JSON.stringify(S)});`);
  return {run,c,local,session};
}
test('restoring a recovery candidate creates a new property and retains the active and original models',async()=>{
  const local=new Storage(),origin=store(local),id=origin.capture(model('Crash snapshot'),{propertyId:'existing'}).id,a=application(local),before=a.run('JSON.stringify(S)'),original=a.run(`PW.mem.get('pwm_existing').s`);
  a.c.draftId=id;const pid=await a.run('pwRecoveryRestore(draftId)');assert.notEqual(pid,'existing');assert.equal(a.run('PW.ix.props.length'),2);assert.equal(a.run('PW.cur'),'existing');assert.equal(a.run('JSON.stringify(S)'),before);assert.equal(a.run(`PW.mem.get('pwm_existing').s`),original);
  assert.equal(a.run(`PW.ix.props.find(p=>p.id!=='existing').name`),'Crash snapshot (recovered)');assert.equal(origin.get(id).model.name,'Crash snapshot');assert.equal(a.run('pwRecoveryList().length'),1);
});
test('a failed library save leaves the independently captured draft available for recovery',async()=>{
  const a=application();a.run(`S.name='Unsaved changes';pwCaptureDraft(JSON.stringify(S));pwCommit=async()=>{throw Error('quota');};`);await assert.rejects(a.run('pwSaveCur()'),/quota/);
  assert.equal(a.run('S.name'),'Unsaved changes');assert.equal(a.run('pwRecoveryList().length'),1);assert.equal(a.run('PW.drafts.get(pwRecoveryList()[0].id).model.name'),'Unsaved changes');
});
test('a completed older save does not delete a newer draft captured while it was pending',async()=>{
  const a=application();a.run(`pwCaptureDraft(JSON.stringify(S));var release,commit=pwCommit;pwCommit=async(...args)=>{await new Promise(r=>{release=r;});return commit(...args);};`);
  const saving=a.run('pwSaveCur()');await new Promise(r=>setImmediate(r));a.run(`S.name='Typed after save began';pwCaptureDraft(JSON.stringify(S));release();`);await saving;
  assert.equal(a.run('pwRecoveryList().length'),1);assert.equal(a.run('PW.drafts.get(pwRecoveryList()[0].id).model.name'),'Typed after save began');
});
test('successful saves acknowledge their draft without altering another tab recovery snapshot',async()=>{
  const local=new Storage(),other=store(local),otherId=other.capture(model('Other tab'),{propertyId:'existing'}).id,a=application(local);a.run(`pwCaptureDraft(JSON.stringify(S));`);assert.equal(a.run('pwRecoveryList().length'),2);await a.run('pwSaveCur()');
  assert.equal(a.run('pwRecoveryList().length'),1);assert.equal(other.get(otherId).model.name,'Other tab');
});
test('application tab state writes never modify shared legacy workspace and model keys',()=>{
  const legacyState=JSON.stringify({cur:'legacy',open:[]}),legacyModel=model('Legacy'),local=new Storage([['basis.pw',legacyState],['basis.model',legacyModel]]),a=application(local),b=application(local);
  a.run(`PW.local.cur='tab-a';pwLocalSave();`);b.run(`PW.local.cur='tab-b';pwLocalSave();`);assert.equal(a.run('pwLocalLoad().cur'),'tab-a');assert.equal(b.run('pwLocalLoad().cur'),'tab-b');assert.equal(local.getItem('basis.pw'),legacyState);assert.equal(local.getItem('basis.model'),legacyModel);
});

function clock(page,value){page.c.Date=class extends Date{static now(){return value;}};}
function declineReload(page){let calls=0;page.c.kConfirm=async()=>{calls++;return false;};return ()=>calls;}
test('same-millisecond, backwards and zero-clock edits require confirmation before library reload',async()=>{
  for(const editedAt of [1000,999,0]){
    const a=application();clock(a,1000);await a.run('pwSaveCur()');clock(a,editedAt);
    const confirms=declineReload(a);a.run(`S.name='Unsaved clock collision';pwTouch();`);
    const before=a.run('JSON.stringify(S)');assert.equal(await a.run('pwRefreshLibrary()'),false);
    assert.equal(confirms(),1);assert.equal(a.run('JSON.stringify(S)'),before);assert.ok(a.run('PW.local.edited')>0);
    a.run('clearTimeout(PW.timer)');
  }
});
test('a successful save of the exact active snapshot makes a clean reload prompt-free',async()=>{
  const a=application();clock(a,1000);a.run(`S.name='Saved snapshot';pwTouch();`);await a.run('pwSaveCur()');
  assert.equal(a.run('PW.local.edited'),0);a.c.kConfirm=async()=>{throw Error('A clean model must not prompt');};
  assert.equal(await a.run('pwRefreshLibrary()'),true);assert.equal(a.run('S.name'),'Saved snapshot');assert.equal(a.run('PW.local.edited'),0);
});
test('a failed save does not make its uncommitted cache snapshot clean',async()=>{
  const a=application();clock(a,1000);await a.run('pwSaveCur()');const confirms=declineReload(a);
  a.run(`S.name='Failed save edits';pwTouch();pwCommit=async()=>{throw Error('Simulated save failure');};`);
  await assert.rejects(a.run('pwSaveCur()'),/Simulated save failure/);
  assert.equal(a.run('PW.cache.get(PW.cur)'),a.run('JSON.stringify(S)'));
  assert.equal(await a.run('pwRefreshLibrary()'),false);assert.equal(confirms(),1);assert.equal(a.run('S.name'),'Failed save edits');
});
test('an older pending save cannot clear edits made at the same timestamp while it commits',async()=>{
  const a=application();clock(a,1000);const confirms=declineReload(a);
  a.run(`S.name='Captured snapshot';pwTouch();var release,commit=pwCommit;pwCommit=async(...args)=>{await new Promise(resolve=>{release=resolve;});return commit(...args);};`);
  const saving=a.run('pwSaveCur()');await new Promise(resolve=>setImmediate(resolve));
  a.run(`S.name='Newer same-millisecond edits';pwTouch();release();`);await saving;
  assert.ok(a.run('PW.local.edited')>0);assert.equal(await a.run('pwRefreshLibrary()'),false);
  assert.equal(confirms(),1);assert.equal(a.run('S.name'),'Newer same-millisecond edits');a.run('clearTimeout(PW.timer)');
});
test('metadata-only actions and another property save cannot acknowledge active edits',async()=>{
  const a=application();clock(a,1000);const confirms=declineReload(a);
  a.run(`PW.ix.props.push({id:'other',pf:'pf',sc:'base',name:'Other'});PW.mem.set('pw_index',pwIxCopy());PW.rev=pwRevision(PW.ix);S.name='Keep active edits';pwTouch();`);
  await a.run(`pwSaveModel('other',JSON.stringify({name:'Other saved',areas:[],tenants:[],mlas:[]}))`);
  assert.ok(a.run('PW.local.edited')>0);await a.run(`pwRenameRecord('scenario','base','Renamed scenario','pf')`);
  assert.ok(a.run('PW.local.edited')>0);assert.equal(await a.run('pwRefreshLibrary()'),false);
  assert.equal(confirms(),1);assert.equal(a.run('S.name'),'Keep active edits');a.run('clearTimeout(PW.timer)');
});
test('model-writing actions acknowledge only their exact successfully committed active snapshot',async()=>{
  const a=application();clock(a,1000);a.run(`S.name='Copied exact edits';pwTouch();`);
  await a.run(`pwCopy(['existing'],'pf','base',true)`);assert.equal(a.run('PW.local.edited'),0);
  const confirms=declineReload(a);a.run(`S.name='Older copied snapshot';pwTouch();var release,commit=pwCommit;pwCommit=async(...args)=>{await new Promise(resolve=>{release=resolve;});return commit(...args);};`);
  const copying=a.run(`pwCopy(['existing'],'pf','base',true)`);await new Promise(resolve=>setImmediate(resolve));
  a.run(`S.name='Edits after copy began';pwTouch();release();`);await copying;
  assert.ok(a.run('PW.local.edited')>0);assert.equal(await a.run('pwRefreshLibrary()'),false);
  assert.equal(confirms(),1);assert.equal(a.run('S.name'),'Edits after copy began');a.run('clearTimeout(PW.timer)');
});
