const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const workspace=html.slice(html.indexOf('const PW={'),html.indexOf('/* =========================== PORTFOLIO PAGE'));
const clone=value=>JSON.parse(JSON.stringify(value));
const settings={version:1,portDisc:.1,portCap:.08,portSingleExit:false,portResaleNoi:'forward'};
function initial(){const index={v:1,rev:'initial',pfs:[{id:'pf',name:'Portfolio',scs:[{id:'base',name:'Base',settings:clone(settings)}]}],props:['a','b'].map(id=>({id,pf:'pf',sc:'base',name:id.toUpperCase(),inc:true,saved:1}))};
  const map=new Map([['pw_index',index]]);for(const id of ['a','b'])map.set('pwm_'+id,{v:1,n:1,enc:'json',saved:1,s:JSON.stringify({name:id.toUpperCase(),cohort:'old'})});return map;}
let pageId=0;
function page(memory=initial()){
  const downloads=[],alerts=[],prefix='export-page-'+(++pageId)+'-';let id=0;
  const c=vm.createContext({TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer,Blob,Response,Date,JSON,Map,Set,Promise,Error,Number,String,
    crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,console:{error(){}},uid:()=>prefix+(++id),
    localStorage:{getItem:()=>null,setItem(){}},document:{addEventListener(){}},addEventListener(){},window:{},$:()=>null,
    kAlert:message=>alerts.push(message),blankState:()=>({name:'Blank',areas:[],tenants:[],mlas:[]}),calc:()=>({sf:100,pv:1000,ann:{noi:[60]}}),num:Number,mKey:()=>'',
    recalc(){},renderKPI(){},drawPane(){},PANES:{},T1:'property',MODE:'inputs',setMode(){},shared:memory,index:clone(memory.get('pw_index')),
    offerFile:async(name,data)=>{downloads.push({name,data});return 'saved';}});
  for(const file of ['scenario_settings.js','native_codec.js'])vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),c);
  vm.runInContext(workspace,c);vm.runInContext(fs.readFileSync(path.join(root,'src/native_ui.js'),'utf8'),c);
  const run=source=>vm.runInContext(source,c);
  run(`PW.ix=index;PW.rev=pwRevision(index);PW.mem=shared;PWS.kind='memory';PW.pf='pf';PW.sc='base';PW.local={open:[],synced:{}};PW._done();var S={name:'Active'};var R={sf:100,pv:1000,ann:{noi:[60]}};`);
  return {c,run,downloads,alerts,memory};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function decode(page,kind){if(kind==='legacy')return JSON.parse(page.downloads[0].data);page.c.backup=new Blob([page.downloads[0].data]);return (await page.run('basisReadArchive(backup)')).portfolio;}
async function pauseSecondRead(page){page.run(`var release,originalRead=pwGetModel;pwGetModel=async(...args)=>{if(args[0]==='b')await new Promise(resolve=>{release=resolve;});return originalRead(...args);};`);}
async function waitForPause(page){for(let i=0;i<100&&!page.run(`typeof release==='function'`);i++)await tick();assert.equal(page.run(`typeof release==='function'`),true);}
async function commitNewGeneration(page){await page.run(`pwEnq(()=>{const ix=pwIxCopy();ix.pfs[0].scs[0].settings.portDisc=.2;return pwCommit(ix,['a','b'].map(id=>({id,json:JSON.stringify({name:id.toUpperCase(),cohort:'new'}),saved:2})));})`);}

for(const kind of ['native','legacy']){
  const action=kind==='native'?'basisSavePortfolio()':'pwExportPf()';
  test(`${kind} export refuses mixed model generations after another page commits`,async()=>{
    const memory=initial(),a=page(memory),b=page(memory);await pauseSecondRead(a);const exporting=a.run(action);await waitForPause(a);await commitNewGeneration(b);a.run('release()');
    assert.equal(await exporting,'failed');assert.equal(a.downloads.length,0);assert.match(a.alerts[0],/saved library changed/);
  });
  test(`${kind} export freezes current model, scenario metadata and filename while loading other properties`,async()=>{
    const a=page();a.run(`PW.cur='a';S={name:'A local',cohort:'local'};`);await pauseSecondRead(a);const exporting=a.run(action);await waitForPause(a);
    a.run(`S={name:'B active',cohort:'later'};PW.cur='b';pwPf().name='Renamed during export';pwSc().settings.portDisc=.9;PW.ix.props[0].inc=false;release()`);
    assert.equal(await exporting,'saved');const backup=await decode(a,kind);assert.equal(backup.name,'Portfolio');assert.equal(backup.properties[0].model.name,'A local');assert.equal(backup.properties[0].include,true);
    const policy=kind==='native'?backup.scenarios[0].settings:backup.scenarioSettings[0].settings;assert.equal(policy.portDisc,.1);assert.match(a.downloads[0].name,/^Portfolio_portfolio\./);
  });
  test(`${kind} backup remains available from a fully loaded view after an existing save conflict`,async()=>{
    const memory=initial(),a=page(memory),b=page(memory);a.run(`PW.cur='a';S={name:'Local edits',cohort:'local'};pwCacheSet('b',JSON.stringify({name:'B cached',cohort:'old'}));`);await commitNewGeneration(b);
    assert.equal(await a.run(action),'saved');const backup=await decode(a,kind);assert.deepEqual(backup.properties.map(p=>p.model.cohort),['local','old']);assert.equal(a.run('S.name'),'Local edits');
  });
  test(`${kind} backup fails visibly when stale uncached inputs cannot be reconstructed`,async()=>{
    const memory=initial(),a=page(memory),b=page(memory);await commitNewGeneration(b);assert.equal(await a.run(action),'failed');assert.equal(a.downloads.length,0);assert.match(a.alerts[0],/reload the library/);
  });
}

test('native current-property filename stays tied to the frozen model during hashing',async()=>{
  const a=page();a.run(`S={name:'Original asset'};var release,archive=basisCreateArchive;basisCreateArchive=async input=>{await new Promise(resolve=>{release=resolve;});return archive(input);};`);
  const saving=a.run('basisSaveCurrent()');await tick();a.run(`S={name:'Another asset'};release()`);assert.equal(await saving,'saved');assert.equal(a.downloads[0].name,'Original_asset.basiscre');
  a.c.backup=new Blob([a.downloads[0].data]);assert.equal((await a.run('basisReadArchive(backup)')).model.name,'Original asset');
});

test('genuine quota failure still permits a frozen local portfolio backup',async()=>{
  const a=page();a.run(`PW.cur='a';S={name:'Unsaved A',cohort:'local'};pwCacheSet('b',JSON.stringify({name:'B cached',cohort:'old'}));pwCommit=async()=>{throw Error('quota full');};`);
  assert.equal(await a.run('basisSavePortfolio()'),'saved');const backup=await decode(a,'native');assert.deepEqual(backup.properties.map(p=>p.model.cohort),['local','old']);
});

test('uncached model reads require a complete verifiable saved index',async()=>{
  const a=page();a.memory.delete('pw_index');assert.equal(await a.run('basisSavePortfolio()'),'failed');assert.equal(a.downloads.length,0);assert.match(a.alerts[0],/saved library changed/);
});
