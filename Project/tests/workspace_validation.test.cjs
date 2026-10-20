const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const workspace=html.slice(html.indexOf('const PW={'),html.indexOf('/* =========================== PORTFOLIO PAGE'))
  .replace(/\/\* BEGIN BASIS WORKSPACE VALIDATION \*\/[\s\S]*?\/\* END BASIS WORKSPACE VALIDATION \*\//,()=>fs.readFileSync(path.join(root,'src/workspace_validation.js'),'utf8').trim());
const clone=value=>value===undefined?undefined:structuredClone(value);
const model=name=>({name,areas:[],tenants:[],mlas:[]});
const index=()=>({v:1,rev:'saved-revision',pfs:[
  {id:'pf',name:'Portfolio',scs:[{id:'base',name:'Base'}]},
  {id:'other',name:'Other',scs:[{id:'other-base',name:'Other base'}]}
],props:[{id:'p',pf:'pf',sc:'base',name:'Current',inc:true,saved:1},{id:'q',pf:'pf',sc:'base',name:'Target',inc:true,saved:1}]});

// Model reads and commit callbacks run in IndexedDB request order. Each writable
// transaction publishes its private snapshot only when every request succeeds.
class Database{
  constructor(entries){this.data=new Map(entries.map(([key,value])=>[key,clone(value)]));this.queue=[];this.active=null;}
  connection(){return {transaction:(_store,mode)=>this.transaction(mode)};}
  transaction(mode){
    const database=this,requests=[];
    const tx={done:false,started:false,scheduled:false,error:null,view:null,
      objectStore(){return {get:key=>request('get',key),put:(value,key)=>request('put',key,value),delete:key=>request('delete',key)};},
      abort(){if(!tx.done){tx.error=tx.error||Error('Aborted');finish(false);}}
    };
    function request(operation,key,value){if(tx.done)throw Error('Inactive transaction');if(mode!=='readwrite'&&operation!=='get')throw Error('Read-only transaction');const result={result:undefined,error:null};requests.push({operation,key,value:clone(value),result});schedule();return result;}
    function schedule(){if(tx.started&&!tx.done&&!tx.scheduled){tx.scheduled=true;setImmediate(step);}}
    function finish(commit){if(tx.done)return;tx.done=true;if(commit&&mode==='readwrite')database.data=tx.view;setImmediate(()=>{if(commit){if(tx.oncomplete)tx.oncomplete({target:tx});}else if(tx.onabort)tx.onabort({target:tx});database.active=null;database.start();});}
    function step(){tx.scheduled=false;if(tx.done)return;const next=requests.shift();if(!next){finish(true);return;}const {operation,key,value,result}=next;if(operation==='get')result.result=clone(tx.view.get(key));else if(operation==='put'){tx.view.set(key,value);result.result=key;}else tx.view.delete(key);if(result.onsuccess)result.onsuccess({target:result});schedule();}
    tx.start=()=>{tx.started=true;tx.view=new Map([...database.data].map(([key,value])=>[key,clone(value)]));schedule();};this.queue.push(tx);this.start();return tx;
  }
  start(){if(!this.active&&this.queue.length){this.active=this.queue.shift();this.active.start();}}
}

let fixtureId=0;
function fixture(kind='memory'){
  const initial=index(),entries=[['pw_index',initial],...['p','q'].map(id=>['pwm_'+id,{v:1,n:1,enc:'json',saved:1,s:JSON.stringify(model(id==='p'?'Current':'Target'))}])];
  const database=new Database(entries),memory=new Map(entries.map(([key,value])=>[key,clone(value)])),remote=new Map(entries.map(([key,value])=>[key,clone(value)]));
  const local=new Map(),alerts=[],writes=[],prefix='validation-'+(++fixtureId)+'-';let sequence=0;
  const c=vm.createContext({TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,Response,DecompressionStream,DataView,Date,JSON,Map,Set,Promise,Error,Number,String,
    crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,btoa,atob,uid:()=>prefix+(++sequence),console:{error(){}},
    localStorage:{getItem:key=>local.get(key)||null,setItem:(key,value)=>local.set(key,value)},document:{addEventListener(){}},addEventListener(){},window:{},$:()=>null,
    kAlert:message=>alerts.push(message),kConfirm:async()=>true,blankState:()=>model('Blank'),calc:()=>({sf:100,pv:1000,ann:{noi:[60]}}),mKey:()=>'',num:Number,
    recalc(){},renderKPI(){},drawPane(){},PANES:{},T1:'property',MODE:'inputs',sampleState:()=>model('Sample'),setMode(){},initial:clone(initial),memory,idb:database.connection(),
    host:{doc:fullPath=>{const key=fullPath.split('/').pop();return {get:async()=>({exists:remote.has(key),data:()=>clone(remote.get(key))}),set:async value=>{writes.push(['put',key]);remote.set(key,clone(value));},delete:async()=>{writes.push(['delete',key]);remote.delete(key);}};}}
  });
  for(const file of ['scenario_settings.js','native_codec.js'])vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),c);
  vm.runInContext(workspace,c);const run=source=>vm.runInContext(source,c);
  run(`PW.ix=initial;PW.rev=pwRevision(initial);PW.pf='pf';PW.sc='base';PW.local={cur:null,pf:'pf',sc:'base',open:['p'],synced:{p:1,q:1},edited:0};PW._done();PWS.kind=${JSON.stringify(kind)};PWS.idb=idb;PWS.db=host;PWS.uid='user';PW.mem=memory;var S={name:'Current',areas:[],tenants:[],mlas:[]};var R={sf:100,pv:1000,ann:{noi:[60]}};`);
  const data=()=>kind==='idb'?database.data:kind==='db'?remote:memory;
  return {c,run,alerts,writes,data,snapshot:()=>JSON.stringify([...data()].sort(([a],[b])=>a.localeCompare(b)))};
}
const live=page=>page.run(`JSON.stringify({model:S,cur:PW.cur,pf:PW.pf,sc:PW.sc,ix:PW.ix,rev:PW.rev,local:PW.local,cache:[...PW.cache],cacheVersions:[...PW.cacheVersions],cacheClock:PW.cacheClock,objs:[...PW.objs]})`);
const invalid=/invalid|unsupported|reserved|duplicate|member|scenario|portfolio|property|model|chunk|key|version|encoding|incomplete|limit|size/i;
let passed=0;
async function test(name,fn){try{await fn();passed++;console.log('PASS',name);}catch(error){console.error('FAIL',name,error);process.exitCode=1;}}

(async()=>{
  await test('A model key without a property record resolves to its canonical header',()=>{
    const page=fixture();assert.equal(page.run(`basisWorkspaceModelKey('p',null)`),'pwm_p');
  });
  await test('Undefined optional derived metadata is accepted without relaxing required records',()=>{
    const page=fixture(),candidate=index();Object.assign(candidate.props[0],{sf:undefined,pv:undefined,noi:undefined});page.c.candidate=candidate;
    const before=clone(candidate);assert.equal(page.run('basisValidateWorkspaceIndex(candidate)===candidate'),true);assert.deepEqual(candidate,before);
    candidate.props[0].name=undefined;assert.throws(()=>page.run('basisValidateWorkspaceIndex(candidate)'),invalid);
    candidate.props[0].name='Current';candidate.props[1]=undefined;assert.throws(()=>page.run('basisValidateWorkspaceIndex(candidate)'),/JSON values|invalid/i);
  });
  await test('Workspace index validation preserves the original object and additive metadata',()=>{
    const page=fixture(),candidate=index();candidate.note={future:['kept']};candidate.props[0].storageKey='pwm_p';candidate.props[1].storageKey='pwm_q_generation-123';page.c.candidate=candidate;
    const before=JSON.stringify(candidate);assert.equal(page.run('basisValidateWorkspaceIndex(candidate)===candidate'),true);assert.equal(JSON.stringify(candidate),before);
  });
  await test('Legacy indexes may omit their version and reuse a scenario ID in different portfolios',()=>{
    const page=fixture(),candidate=index();delete candidate.v;candidate.pfs[1].scs[0].id='base';page.c.candidate=candidate;
    assert.equal(page.run('basisValidateWorkspaceIndex(candidate)===candidate'),true);
    page.c.candidate={pfs:[],props:[]};assert.equal(page.run('basisValidateWorkspaceIndex(candidate)===candidate'),true);
  });
  const invalidIndexes=[
    ['duplicate portfolio IDs',ix=>{ix.pfs[1].id=ix.pfs[0].id;}],
    ['duplicate scenario IDs within one portfolio',ix=>{ix.pfs[0].scs.push({...ix.pfs[0].scs[0]});}],
    ['duplicate property IDs',ix=>{ix.props[1].id=ix.props[0].id;}],
    ['null portfolio records',ix=>{ix.pfs[0]=null;}],
    ['null scenario records',ix=>{ix.pfs[0].scs[0]=null;}],
    ['null property records',ix=>{ix.props[0]=null;}],
    ['an empty scenario list',ix=>{ix.pfs[0].scs=[];}],
    ['orphan portfolio membership',ix=>{ix.props[0].pf='missing';}],
    ['scenario membership in another portfolio',ix=>{ix.props[0].sc='other-base';}],
    ['empty property IDs',ix=>{ix.props[0].id='';}],
    ['reserved property IDs',ix=>{ix.props[0].id='__proto__';}],
    ['an unsupported index version',ix=>{ix.v=999;}],
    ['a nonscalar portfolio name',ix=>{ix.pfs[0].name={};}],
    ['a storage key owned by a different property',ix=>{ix.props[0].storageKey='pwm_q';}],
    ['a canonical key disguised as another property generation',ix=>{ix.props[1].id='p_q';ix.props[0].storageKey='pwm_p_q';}],
    ['overlapping immutable header and legacy chunk namespaces',ix=>{ix.props[1].id='p_q';}],
    ['overlapping generated chunk and header namespaces',ix=>{ix.props[1].id='p_q_1';}],
    ['overlapping legacy chunk and header namespaces',ix=>{ix.props[1].id='p_1';}],
    ['overlapping final allowed generated chunk namespaces',ix=>{ix.props[1].id='p_generation-1_4095';}],
    ['a storage key outside the model namespace',ix=>{ix.props[0].storageKey='pw_index';}]
  ];
  for(const [label,mutate] of invalidIndexes)await test('Workspace index rejects '+label+' without mutation',()=>{
    const page=fixture(),candidate=index();mutate(candidate);page.c.candidate=candidate;const before=JSON.stringify(candidate);
    assert.throws(()=>page.run('basisValidateWorkspaceIndex(candidate)'),invalid);assert.equal(JSON.stringify(candidate),before);
  });
  await test('Namespace validation preserves unambiguous legacy IDs and ordinary generated IDs',()=>{
    const page=fixture();for(const id of ['other_property','p_generation_0','p_generation_01','p_generation_4096','p_generations_extra_text','p-other']){
      const candidate=index();candidate.props[1].id=id;page.c.candidate=candidate;const before=clone(candidate);
      assert.equal(page.run('basisValidateWorkspaceIndex(candidate)===candidate'),true);assert.deepEqual(candidate,before);
    }
  });
  await test('Namespace overlap detection is independent of property order and checks every underscore split',()=>{
    const page=fixture(),candidate=index();candidate.props[0].id='base_with_underscores';candidate.props[1].id='base_with_underscores_generation_1';candidate.props.reverse();page.c.candidate=candidate;
    const before=clone(candidate);assert.throws(()=>page.run('basisValidateWorkspaceIndex(candidate)'),/overlapping.*namespaces/i);assert.deepEqual(candidate,before);
  });

  const malformedModels=[['null','null'],['an array','[null]'],['a null tenant',JSON.stringify({name:'Bad',tenants:[null]})],['a reserved nested key','{"name":"Bad","details":{"__proto__":{"polluted":true}}}']];
  for(const kind of ['memory','idb','db'])for(const [label,json] of malformedModels)await test(kind+' stored '+label+' cannot activate or enter caches',async()=>{
    const page=fixture(kind);page.run(`PW.cur=PW.local.cur='p';pwCacheSet('p',JSON.stringify(S));pwSaveCur=async()=>{};`);page.data().set('pwm_q',{v:1,n:1,enc:'json',s:json});
    const before=live(page),stored=page.snapshot();await assert.rejects(page.run(`pwGetModel('q')`),invalid);await page.run(`pwOpen('q')`);
    assert.equal(live(page),before);assert.equal(page.snapshot(),stored);assert.ok(page.alerts.length>0);
  });

  const badHeaders=[
    ['an unsupported version',{v:999,n:1,enc:'json'}],['zero chunks',{v:1,n:0,enc:'json'}],['a fractional chunk count',{v:1,n:1.5,enc:'json'}],
    ['too many chunks',{v:1,n:4097,enc:'json'}],['an unknown encoding',{v:1,n:1,enc:'unknown'}],['a nonstring first chunk',{v:1,n:1,enc:'json',s:{}}],
    ['an invalid generation',{v:1,n:1,enc:'json',part:'invalid/generation'}],['an oversized first chunk',{v:1,n:1,enc:'json',s:'x'.repeat(180001)}],
    ['a missing later chunk',{v:1,n:2,enc:'json'}]
  ];
  for(const kind of ['memory','idb','db'])for(const [label,header] of badHeaders)await test(kind+' rejects '+label+' before changing the open model',async()=>{
    const page=fixture(kind);page.run(`PW.cur=PW.local.cur='p';pwCacheSet('p',JSON.stringify(S));pwSaveCur=async()=>{};`);
    page.data().set('pwm_q',{s:JSON.stringify(model('Target')),...header});const before=live(page),stored=page.snapshot();
    await assert.rejects(page.run(`pwGetModel('q')`),invalid);await page.run(`pwOpen('q')`);assert.equal(live(page),before);assert.equal(page.snapshot(),stored);
  });
  for(const kind of ['memory','idb','db'])await test(kind+' reads legacy headers with omitted version/count/encoding and legacy chunks',async()=>{
    const page=fixture(kind),json=JSON.stringify(model('Legacy'));page.data().set('pwm_q',{s:json});assert.equal((await page.run(`pwGetModel('q')`)).json,json);
    page.data().set('pwm_q',{n:2,s:json.slice(0,9)});page.data().set('pwm_q_1',{s:json.slice(9)});assert.equal((await page.run(`pwGetModel('q')`)).json,json);
  });
  await test('An owned immutable header generation remains readable',async()=>{
    const page=fixture(),key='pwm_q_generation-123',json=JSON.stringify(model('Immutable'));page.run(`pwRec('q').storageKey=${JSON.stringify(key)}`);page.data().set(key,{v:1,n:1,enc:'json',part:'generation-123',s:json});
    assert.equal((await page.run(`pwGetModel('q')`)).json,json);
  });
  await test('A memory model read captures all old chunks before a save replaces its generation',async()=>{
    const page=fixture(),oldJSON=JSON.stringify(model('Old generation')),newJSON=JSON.stringify(model('New generation'));
    page.data().set('pwm_q',{v:1,n:2,enc:'json',part:'old-generation',s:oldJSON.slice(0,9)});
    page.data().set('pwm_q_old-generation_1',{s:oldJSON.slice(9)});
    const reading=page.run(`pwGetModel('q')`);
    // Model publication and cleanup are synchronous in the memory adapter.
    page.data().set('pwm_q',{v:1,n:1,enc:'json',part:'new-generation',s:newJSON});
    page.data().delete('pwm_q_old-generation_1');
    assert.equal((await reading).json,oldJSON);
    assert.equal((await page.run(`pwGetModel('q')`)).json,newJSON);
  });
  await test('Compressed saved models retain Unicode JSON and reject corrupt base64',async()=>{
    const page=fixture(),json=JSON.stringify(model('Café 東京')),compressed=require('node:zlib').deflateRawSync(Buffer.from(json)).toString('base64');
    page.data().set('pwm_q',{v:1,n:1,enc:'dr64',s:compressed});assert.equal((await page.run(`pwGetModel('q')`)).json,json);
    page.data().set('pwm_q',{v:1,n:1,enc:'dr64',s:'!invalid base64!'});await assert.rejects(page.run(`pwGetModel('q')`),/encoding|invalid/i);
  });
  await test('Compressed model expansion stops at the decoded byte limit',async()=>{
    const page=fixture(),compressed=require('node:zlib').deflateRawSync(Buffer.alloc(24*1024*1024+1,120)).toString('base64');
    page.data().set('pwm_q',{v:1,n:1,enc:'dr64',s:compressed});page.run(`PW.cur=PW.local.cur='p';pwSaveCur=async()=>{};`);const before=live(page);
    await assert.rejects(page.run(`pwGetModel('q')`),/size|limit/i);await page.run(`pwOpen('q')`);assert.equal(live(page),before);
  });
  await test('The decoder limits encoded text before attempting base64 or decompression',async()=>{
    const page=fixture();page.c.largeText='A'.repeat(32*1024*1024+1);await assert.rejects(page.run(`basisDecodeWorkspaceModel(largeText,{enc:'dr64'})`),/size|limit/i);
  });
  await test('Uncompressed model size limits count UTF-8 bytes as well as text length',async()=>{
    const page=fixture();page.c.largeText=JSON.stringify({name:'Large',note:'é'.repeat(12*1024*1024)});await assert.rejects(page.run(`basisDecodeWorkspaceModel(largeText,{enc:'json'})`),/size|limit/i);
  });
  await test('Direct activation validates before changing the current model or session',()=>{
    const page=fixture();page.run(`PW.cur=PW.local.cur='p';pwCacheSet('p',JSON.stringify(S));`);const before=live(page);
    for(const [,json] of malformedModels){page.c.badJSON=json;assert.throws(()=>page.run(`pwActivate('q',JSON.parse(badJSON))`),invalid);assert.equal(live(page),before);}
  });
  await test('Cached objects validate before entering the rollup object cache',()=>{
    const page=fixture();for(const [,json] of malformedModels){page.c.badJSON=json;page.run(`PW.cache.set('q',badJSON)`);const before=live(page);assert.throws(()=>page.run(`pwObj('q')`),invalid);assert.equal(live(page),before);}
  });

  for(const kind of ['memory','idb','db']){
    await test(kind+' refuses an invalid draft index before writing any storage',async()=>{
      const page=fixture(kind);page.run(`var draft=pwIxCopy();draft.props[1].id=draft.props[0].id;`);const before=page.snapshot(),state=live(page);
      await assert.rejects(page.run(`pwCommit(draft,[{id:'p',json:JSON.stringify({name:'Replacement'}),saved:2}])`),invalid);
      assert.equal(page.snapshot(),before);assert.equal(live(page),state);assert.equal(page.writes.length,0);
    });
    await test(kind+' refuses an invalid saved index before deleting another property header',async()=>{
      const page=fixture(kind),saved=index();saved.props[1].storageKey='pwm_p';page.data().set('pw_index',saved);page.c.saved=saved;
      page.run(`PW.rev=pwRevision(saved);var draft=pwIxCopy();draft.props=draft.props.filter(p=>p.id!=='q');`);const before=page.snapshot(),state=live(page);
      await assert.rejects(page.run(`pwCommit(draft,[],['q'])`),invalid);assert.equal(page.snapshot(),before);assert.equal(live(page),state);assert.equal(page.writes.length,0);
    });
    await test(kind+' refuses invalid saved model JSON before publishing a replacement',async()=>{
      const page=fixture(kind),before=page.snapshot(),state=live(page);
      await assert.rejects(page.run(`pwCommit(pwIxCopy(),[{id:'q',json:'null',saved:2}])`),invalid);
      assert.equal(page.snapshot(),before);assert.equal(live(page),state);assert.equal(page.writes.length,0);
    });
  }
  for(const kind of ['memory','idb'])await test(kind+' rejects cleanup chunks that alias another property header',async()=>{
    const page=fixture(kind);page.run(`PW.ix.props.push({id:'p_q_1',pf:'pf',sc:'base',name:'Other property'});`);
    page.data().set('pw_index',JSON.parse(page.run('JSON.stringify(PW.ix)')));
    page.data().set('pwm_p',{v:1,n:2,enc:'json',part:'q',s:''});
    page.data().set('pwm_p_q_1',{v:1,n:1,enc:'json',s:JSON.stringify(model('Other property'))});
    const before=page.snapshot(),state=live(page);await assert.rejects(page.run(`pwRemove(['p'])`),/alias|key|property/i);
    assert.equal(page.snapshot(),before);assert.equal(live(page),state);
    assert.equal(JSON.parse((await page.run(`pwGetModel('p_q_1')`)).json).name,'Other property');
  });
  for(const kind of ['memory','idb'])for(const alias of ['p_1','p_q','p_q_1'])for(const removed of ['p',alias])await test(kind+' refuses deleting '+removed+' from overlapping '+alias+' storage namespaces',async()=>{
    const page=fixture(kind),saved=index();saved.props[1].id=alias;page.c.saved=saved;page.run(`PW.ix=saved;PW.rev=pwRevision(saved);`);page.data().set('pw_index',clone(saved));
    page.data().set('pwm_p',{v:1,n:2,enc:'json',...(alias==='p_1'?{}:{part:'q'}),s:''});
    page.data().set(alias==='p_1'?'pwm_p_1':'pwm_p_q_1',{s:JSON.stringify(model('Shared legacy header or chunk'))});
    if(alias==='p_q')page.data().set('pwm_p_q',{n:2,s:''});
    const before=page.snapshot(),state=live(page);page.c.removed=removed;
    await assert.rejects(page.run(`pwRemove([removed])`),/overlapping.*namespaces/i);
    assert.equal(page.snapshot(),before);assert.equal(live(page),state);assert.equal(page.writes.length,0);
    assert.equal(page.run('PW.ix.props.length'),2);
  });
  console.log('RESULT',passed,'workspace validation tests passed');
})();
