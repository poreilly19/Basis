const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {test}=require('node:test');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const workspace=html.slice(html.indexOf('const PW={'),html.indexOf('/* =========================== PORTFOLIO PAGE'));
const plain=value=>JSON.parse(JSON.stringify(value));
const defaults={version:1,portDisc:.075,portCap:.065,portSingleExit:false,portResaleNoi:'forward'};
function setup(){
  const local=new Map(),alerts=[],downloads=[];let id=0;
  const c=vm.createContext({TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,Response,DataView,Date,JSON,Map,Set,Promise,Error,Number,String,
    crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,console:{error(){}},uid:()=>String(++id),
    localStorage:{getItem:key=>local.get(key)||null,setItem:(key,value)=>local.set(key,value)},document:{addEventListener(){}},addEventListener(){},
    window:{},$:()=>null,kAlert:message=>alerts.push(message),blankState:()=>({name:'Blank',areas:[],tenants:[],mlas:[]}),
    calc:()=>({sf:100,pv:1000,ann:{noi:[60]}}),mKey:()=>'',num:value=>Number.isFinite(Number(value))?Number(value):0,recalc(){},renderKPI(){},basisRenderContext(){},drawPane(){},
    PANES:{},T1:'property',MODE:'inputs',sampleState:()=>({name:'Sample'}),setMode(){},offerFile:async(name,data)=>{downloads.push({name,data});return 'saved';}});
  for(const file of ['scenario_settings.js','native_codec.js'])vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),c);
  vm.runInContext(workspace,c);vm.runInContext(fs.readFileSync(path.join(root,'src/native_ui.js'),'utf8'),c);
  const run=source=>vm.runInContext(source,c);
  run(`PW.ix={v:1,pfs:[{id:'pf',name:'Portfolio',scs:[{id:'base',name:'Base'},{id:'up',name:'Upside'}]}],props:[]};PW.pf='pf';PW.sc='base';PW.local={open:[],synced:{}};PW._done();PWS.kind='memory';var S={name:'Active',portDisc:.99,portCap:.5,portSingleExit:true,portResaleNoi:'trailing'};var R={sf:100,pv:1000,ann:{noi:[60]}};`);
  return {c,run,local,alerts,downloads};
}
async function seed(page,entries){page.c.seed=entries;await page.run(`(async()=>{for(const entry of seed){PW.ix.props.push({id:entry.id,pf:'pf',sc:entry.sc||'base',name:entry.model.name,inc:entry.include!==false,saved:1});await pwPutModel(entry.id,JSON.stringify(entry.model),1);}await pwSet('pw_index',pwIxCopy());PW.rev=pwRevision(PW.mem.get('pw_index'));})()`);}

test('scenario migration selects first saved property in index order without rewriting models',async()=>{
  const page=setup();await seed(page,[{id:'first',include:false,model:{name:'First',portDisc:.11,portCap:.08,portSingleExit:false,portResaleNoi:'forward'}},{id:'second',model:{name:'Second',portDisc:.22,portCap:.09,portSingleExit:true,portResaleNoi:'trailing'}}]);
  const before=page.run(`JSON.stringify([...PW.mem].filter(([key])=>key.startsWith('pwm_')))`),props=page.run('JSON.stringify(PW.ix.props)');
  page.run(`PW.cur='second';PW.sort={k:'name',d:-1};S.portDisc=.9;`);
  assert.equal(await page.run('pwMigrateScenarioSettings()'),true);
  assert.equal(page.run('pwSc().settings.portDisc'),.11);
  assert.deepEqual(plain(page.run(`pwSc('pf','up').settings`)),defaults);
  assert.equal(page.run('S.portDisc'),.9);
  assert.equal(page.run('JSON.stringify(PW.ix.props)'),props);
  assert.equal(page.run(`JSON.stringify([...PW.mem].filter(([key])=>key.startsWith('pwm_')))`),before);
  const revision=page.run('PW.rev');assert.equal(await page.run('pwMigrateScenarioSettings()'),false);assert.equal(page.run('PW.rev'),revision);
});

test('rollup settings remain unchanged across property and scenario switches',async()=>{
  const page=setup();await seed(page,[{id:'a',model:{name:'A',portDisc:.1}},{id:'b',sc:'up',model:{name:'B',portDisc:.2}}]);await page.run('pwMigrateScenarioSettings()');
  assert.equal(page.run('pwRollup().portDisc'),.1);page.run('S.portDisc=.8');assert.equal(page.run('pwRollup().portDisc'),.1);
  page.run(`PW.sc='up';S.portDisc=.9`);assert.equal(page.run('pwRollup().portDisc'),.2);page.run(`PW.sc='base'`);assert.equal(page.run('pwRollup().portDisc'),.1);
});

test('migration failure publishes no partial settings and preserves the stored index',async()=>{
  const page=setup();await seed(page,[{id:'a',model:{name:'A',portDisc:.1}}]);const before=page.run('JSON.stringify(PW.mem.get("pw_index"))');
  page.run(`pwCommit=async()=>{throw Error('quota');}`);await assert.rejects(page.run('pwMigrateScenarioSettings()'),/quota/);
  assert.equal(page.run(`Object.hasOwn(pwSc(),'settings')`),false);assert.equal(page.run('JSON.stringify(PW.mem.get("pw_index"))'),before);
});

test('missing first property stops migration instead of selecting a different model',async()=>{
  const page=setup();await seed(page,[{id:'first',model:{name:'First',portDisc:.1}},{id:'later',model:{name:'Later',portDisc:.2}}]);page.run(`PW.mem.delete('pwm_first')`);
  await assert.rejects(page.run('pwMigrateScenarioSettings()'),/Missing model/);assert.equal(page.run(`Object.hasOwn(pwSc(),'settings')`),false);
});

test('settings publish only after commit and keep their original scenario during a switch',async()=>{
  const page=setup();await seed(page,[]);await page.run('pwMigrateScenarioSettings()');
  page.run(`var release,originalCommit=pwCommit;pwCommit=async(...args)=>{await new Promise(resolve=>{release=resolve;});return originalCommit(...args);}`);
  const updating=page.run('pwSetScenarioSettings({portDisc:.12})');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(page.run('pwSc().settings.portDisc'),.075);assert.equal(page.run(`PW.mem.get('pw_index').pfs[0].scs[0].settings.portDisc`),.075);
  page.run(`PW.sc='up';release()`);await updating;assert.equal(page.run(`pwSc('pf','base').settings.portDisc`),.12);assert.equal(page.run('pwSc().settings.portDisc'),.075);
});

test('queued settings edits merge without losing earlier committed fields',async()=>{
  const page=setup();await seed(page,[]);await page.run('pwMigrateScenarioSettings()');
  await Promise.all([page.run('pwSetScenarioSettings({portDisc:.12})'),page.run('pwSetScenarioSettings({portCap:.09})')]);
  assert.equal(page.run('pwSc().settings.portDisc'),.12);assert.equal(page.run('pwSc().settings.portCap'),.09);
  const before=page.run('JSON.stringify(pwSc())');page.run(`pwCommit=async()=>{throw Error('disk full')}`);
  await assert.rejects(page.run('pwSetScenarioSettings({portDisc:.2})'),/disk full/);assert.equal(page.run('JSON.stringify(pwSc())'),before);
});

test('stale settings commits preserve the newer stored library revision',async()=>{
  const page=setup();await seed(page,[]);await page.run('pwMigrateScenarioSettings()');
  page.run(`var newer=pwIxCopy();newer.rev='another-page';newer.pfs[0].scs[0].settings.portDisc=.3;PW.mem.set('pw_index',newer)`);
  await assert.rejects(page.run('pwSetScenarioSettings({portDisc:.2})'),/changed|library/i);
  assert.equal(page.run('pwSc().settings.portDisc'),.075);assert.equal(page.run(`PW.mem.get('pw_index').pfs[0].scs[0].settings.portDisc`),.3);
});

test('portfolio adoption preserves explicit metadata and seeds only missing incoming settings',async()=>{
  const page=setup();page.c.incoming={name:'Imported',scenarios:[{id:'old-base',name:'Base',notes:{future:[0,false]},settings:{...defaults,portDisc:.15}},{id:'old-up',name:'Upside'}],properties:[{scenarioId:'old-base',include:true,model:{name:'A',portDisc:.9}},{scenarioId:'old-up',include:false,model:{name:'B',portDisc:.2}}]};
  assert.equal(await page.run('pwImportPortfolio(incoming)'),2);const imported=plain(page.run('PW.ix.pfs[1]'));
  assert.notEqual(imported.scs[0].id,'old-base');assert.equal(imported.scs[0].settings.portDisc,.15);assert.deepEqual(imported.scs[0].notes,{future:[0,false]});assert.equal(imported.scs[1].settings.portDisc,.2);
  assert.equal(page.run('incoming.scenarios[1].settings'),undefined);assert.equal(page.run(`JSON.parse(PW.mem.get('pwm_'+PW.ix.props[0].id).s).portDisc`),.9);
});

test('invalid incoming settings fail before saving current edits or creating records',async()=>{
  const page=setup();page.c.incoming={name:'Invalid',scenarios:[{id:'base',name:'Base',settings:{...defaults,version:2}}],properties:[{scenarioId:'base',model:{name:'A'}}]};
  page.run(`PW.cur='active';var writes=0;pwSaveCur=async()=>{writes++;}`);await assert.rejects(page.run('pwImportPortfolio(incoming)'),/version/);assert.equal(page.run('writes'),0);assert.equal(page.run('PW.ix.pfs.length'),1);
});

test('native portfolio backup carries scenario metadata and unchanged legacy property fields',async()=>{
  const page=setup();await seed(page,[{id:'a',model:{name:'A',portDisc:.3}}]);await page.run('pwMigrateScenarioSettings()');await page.run('pwSetScenarioSettings({portDisc:.12})');page.run(`pwSc().notes={future:true}`);
  assert.equal(await page.run('basisSavePortfolio()'),'saved');page.c.backup=new Blob([page.downloads[0].data]);const decoded=plain(await page.run('basisReadArchive(backup)'));
  assert.equal(decoded.portfolio.scenarios[0].settings.portDisc,.12);assert.deepEqual(decoded.portfolio.scenarios[0].notes,{future:true});assert.equal(decoded.portfolio.properties[0].model.portDisc,.3);
});

test('legacy portfolio JSON retains name-based membership and additive scenario settings',async()=>{
  const page=setup();await seed(page,[{id:'a',model:{name:'A',portDisc:.3}}]);await page.run('pwMigrateScenarioSettings()');await page.run('pwSetScenarioSettings({portDisc:.12})');page.run(`pwSc().notes={future:true}`);
  assert.equal(await page.run('pwExportPf()'),'saved');const exported=JSON.parse(page.downloads[0].data);assert.deepEqual(exported.scenarios,['Base','Upside']);assert.equal(exported.scenarioSettings[0].settings.portDisc,.12);
  const restored=setup();restored.c.files=[{name:'portfolio.json',text:async()=>JSON.stringify(exported)}];assert.equal(await restored.run('pwImportFiles(files)'),1);
  assert.equal(restored.run('PW.ix.pfs[1].scs[0].settings.portDisc'),.12);assert.equal(restored.run('PW.ix.pfs[1].scs[0].notes.future'),true);assert.equal(restored.run(`JSON.parse(PW.mem.get('pwm_'+PW.ix.props[0].id).s).portDisc`),.3);
});

test('old legacy portfolio JSON without settings migrates from incoming models',async()=>{
  const page=setup();page.c.files=[{name:'old.json',text:async()=>JSON.stringify({basis:'portfolio',v:1,name:'Old',scenarios:['Base'],properties:[{scenario:'Base',model:{name:'A',portDisc:.16}}]})}];
  assert.equal(await page.run('pwImportFiles(files)'),1);assert.equal(page.run('PW.ix.pfs[1].scs[0].settings.portDisc'),.16);
});

test('legacy settings metadata rejects ambiguity and malformed values before importing',async()=>{
  for(const metadata of [[{name:'Base',settings:{...defaults,version:2}}],[{name:'Base',settings:defaults},{name:'Base',settings:defaults}],[{name:'Unknown',settings:defaults}]]){
    const page=setup();page.c.files=[{name:'bad.json',text:async()=>JSON.stringify({basis:'portfolio',v:1,scenarios:['Base'],scenarioSettings:metadata,properties:[{scenario:'Base',model:{name:'A'}}]})}];
    assert.equal(await page.run('pwImportFiles(files)'),0);assert.equal(page.run('PW.ix.pfs.length'),1);assert.ok(page.alerts.length);
  }
});

test('duplicate scenario names block ambiguous legacy export while native export keeps IDs',async()=>{
  const page=setup();page.run(`PW.ix.pfs[0].scs[1].name='Base'`);assert.equal(await page.run('pwExportPf()'),'failed');assert.equal(page.downloads.length,0);assert.match(page.alerts[0],/unique.*scenario names/);
  assert.equal(await page.run('basisSavePortfolio()'),'saved');page.c.backup=new Blob([page.downloads[0].data]);const decoded=await page.run('basisReadArchive(backup)');assert.notEqual(decoded.portfolio.scenarios[0].id,decoded.portfolio.scenarios[1].id);
});

test('new scenarios use defaults and copied scenarios inherit source policy instead of active property fields',async()=>{
  const page=setup();await seed(page,[{id:'a',model:{name:'A',portDisc:.1}}]);await page.run('pwMigrateScenarioSettings()');await page.run('pwSetScenarioSettings({portDisc:.12})');page.run(`pwSc().notes={future:true}`);
  page.c.document.createTextNode=text=>({text});page.c.el=(_tag,attributes={})=>({...attributes,checked:attributes.type==='checkbox'?page.c.copyChoice:attributes.checked});page.c.pwFld=(_label,input)=>input;
  page.run('pwDialog=async()=>true');vm.runInContext(html.slice(html.indexOf('async function pwNewSc()'),html.indexOf('async function pwPickDlg(')),page.c);
  page.c.copyChoice=true;await page.run('pwNewSc()');await page.run('PW.q');assert.equal(page.run('pwSc().settings.portDisc'),.12);assert.equal(page.run('pwSc().notes.future'),true);assert.equal(page.run('pwList().length'),1);
  page.c.copyChoice=false;await page.run('pwNewSc()');await page.run('PW.q');assert.deepEqual(plain(page.run('pwSc().settings')),defaults);assert.equal(page.run('pwSc().notes'),undefined);assert.equal(page.run('pwList().length'),0);assert.equal(page.run('S.portDisc'),.99);
});

test('workspace initialization completes explicit scenario migration before returning',async()=>{
  const page=setup();await seed(page,[{id:'a',model:{name:'A',portDisc:.13}}]);page.local.set('basis.pw',JSON.stringify({cur:'a',pf:'pf',sc:'base',open:['a'],synced:{a:1}}));
  page.run('pwInitStore=async()=>{};PW.localModelLoaded=false');await page.run('pwInit2()');assert.equal(page.run('pwSc().settings.portDisc'),.13);assert.equal(page.run(`PW.mem.get('pw_index').pfs[0].scs[0].settings.portDisc`),.13);
});
