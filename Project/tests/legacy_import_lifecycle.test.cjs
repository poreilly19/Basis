const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const workspace=html.slice(html.indexOf('const PW={'),html.indexOf('/* =========================== PORTFOLIO PAGE'));
const members=html.slice(html.indexOf('PANES["portfolio.members"]=()=>{'),html.indexOf('function portfolioPeriodLabel('));
const model=name=>({name,areas:[],tenants:[],mlas:[],portfolio:[]});
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function setup(){
  const alerts=[],nodes=[],counts={read:0,dirty:0,draw:0};let id=0;
  const c=vm.createContext({TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,Response,DataView,Date,JSON,Map,Set,Promise,Error,Number,String,
    crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,console:{error(){}},uid:()=>String(++id),
    localStorage:{getItem:()=>null,setItem(){}},document:{addEventListener(){},createTextNode:text=>({text})},addEventListener(){},window:{},$:()=>null,
    kAlert:text=>alerts.push(text),blankState:()=>model('Blank'),calc:()=>({sf:100,pv:1000,ann:{noi:[60]}}),mKey:()=>'',
    num:value=>Number.isFinite(Number(value))?Number(value):0,recalc(){},renderKPI(){},drawPane:()=>counts.draw++,
    PANES:{},T1:'property',MODE:'inputs',sampleState:()=>model('Sample'),setMode(){},OFFICE_ZIP_LIMITS:{archive:2048},
    pfReadFile:async file=>{counts.read++;return file.result||await file.pending;},
    DIRTY:()=>counts.dirty++,grid:()=>({}),inp:()=>({}),titled:(_title,body)=>body,
    el:(tag,attrs={},children=[])=>{const node={tag,...attrs,children,listeners:{},append(...parts){this.children.push(...parts);},addEventListener(type,callback){this.listeners[type]=callback;}};nodes.push(node);return node;}});
  for(const file of ['scenario_settings.js','native_codec.js'])vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),c);
  vm.runInContext(workspace,c);vm.runInContext(fs.readFileSync(path.join(root,'src/native_ui.js'),'utf8'),c);
  const run=code=>vm.runInContext(code,c);
  run(`PW.ix={v:1,pfs:[{id:'A',name:'Portfolio A',scs:[{id:'A-base',name:'Base'}]},{id:'B',name:'Portfolio B',scs:[{id:'B-base',name:'Base'}]}],props:[]};PW.pf='A';PW.sc='A-base';PW.local={open:[],synced:{}};PW._done();PWS.kind='memory';var S={name:'Active A',areas:[],tenants:[],mlas:[],portfolio:[]};var R={sf:100,pv:1000,ann:{noi:[60]}};`);
  return {c,run,alerts,counts,nodes,file(name,text,size=1){return {name,size,text:async()=>{counts.read++;return text;}};},members(){vm.runInContext(members,c);run(`PANES['portfolio.members']()`);const input=nodes.find(node=>node.tag==='input'&&node.type==='file');return files=>input.listeners.change({target:{files,value:'selected files'}});}};
}
const portfolio=()=>({basis:'portfolio',v:1,name:'Legacy portfolio',scenarios:['Base'],properties:[{scenario:'Base',model:model('Legacy member')}]});
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('oversized legacy portfolio and property JSON are rejected before reading',async()=>{
  for(const value of [portfolio(),model('Property')]){
    const page=setup();page.c.files=[page.file('oversized.json',JSON.stringify(value),2049)];
    assert.equal(await page.run('pwImportFiles(files)'),0);assert.equal(page.counts.read,0);assert.equal(page.run('PW.ix.pfs.length'),2);assert.equal(page.run('PW.ix.props.length'),0);assert.match(page.alerts.join('\n'),/64 MiB/);
  }
});

test('JSON sniffing checks actual UTF-8 bytes before parsing an underreported file',async()=>{
  const page=setup(),value=portfolio();value.notes='€'.repeat(800);page.c.files=[page.file('underreported.json',JSON.stringify(value))];
  assert.equal(await page.run('pwImportFiles(files)'),0);assert.equal(page.counts.read,1);assert.equal(page.run('PW.ix.props.length'),0);assert.match(page.alerts.join('\n'),/64 MiB/);
});

test('a JSON file at the UTF-8 byte limit remains supported',async()=>{
  const page=setup(),value=portfolio();value.notes='';const overhead=new TextEncoder().encode(JSON.stringify(value)).length;value.notes='x'.repeat(2048-overhead);
  const text=JSON.stringify(value);assert.equal(new TextEncoder().encode(text).length,2048);page.c.files=[page.file('boundary.json',text,2048)];
  assert.equal(await page.run('pwImportFiles(files)'),1);assert.equal(page.counts.read,1);assert.equal(page.alerts.length,0);
});

test('a failed JSON read is reported once without trying another reader',async()=>{
  const page=setup();page.c.files=[{name:'unreadable.json',size:1,text:async()=>{page.counts.read++;throw Error('file is no longer available');}}];
  assert.equal(await page.run('pwImportFiles(files)'),0);assert.equal(page.counts.read,1);assert.equal(page.run('PW.ix.props.length'),0);assert.match(page.alerts.join('\n'),/no longer available/);
});

test('legacy portfolio JSON remains additive and a failed file does not block the next valid file',async()=>{
  const page=setup();page.c.files=[page.file('too-large.json',JSON.stringify(portfolio()),2049),page.file('portfolio.json',JSON.stringify(portfolio()))];
  assert.equal(await page.run('pwImportFiles(files)'),1);assert.equal(page.counts.read,1);assert.equal(page.run('PW.ix.pfs.length'),3);assert.equal(page.run('PW.ix.props[0].name'),'Legacy member');assert.equal(page.run('S.name'),'Active A');
});

test('legacy property imports retain the selected portfolio/scenario throughout a multi-file batch',async()=>{
  const page=setup(),slow=deferred();page.c.files=[{name:'first.xlsx',size:1,pending:slow.promise},{name:'second.json',size:1,text:async()=>JSON.stringify(model('Second')),result:{props:[{st:model('Second')}]}}];
  const importing=page.run('pwImportFiles(files)');await tick();page.run(`PW.pf='B';PW.sc='B-base';S.name='Current B edits'`);slow.resolve({props:[{st:model('First')}]});
  assert.equal(await importing,2);assert.equal(page.run(`PW.ix.props.every(p=>p.pf==='A'&&p.sc==='A-base')`),true);assert.equal(page.run('PW.pf'),'B');assert.equal(page.run('S.name'),'Current B edits');
});

test('the destination is captured before waiting for workspace readiness',async()=>{
  const page=setup(),ready=deferred();page.c.delayedReady=ready.promise;page.run('PW.ready=delayedReady');page.c.files=[{name:'property.xlsx',size:1,result:{props:[{st:model('Queued before ready')}]}}];
  const importing=page.run('pwImportFiles(files)');page.run(`PW.pf='B';PW.sc='B-base'`);ready.resolve();assert.equal(await importing,1);assert.equal(page.run('PW.ix.props[0].pf'),'A');assert.equal(page.run('PW.ix.props[0].sc'),'A-base');
});

test('removing the captured destination rejects property publication without rerouting',async()=>{
  const page=setup(),slow=deferred();page.c.files=[{name:'property.xlsx',size:1,pending:slow.promise}];const importing=page.run('pwImportFiles(files)');await tick();
  page.run(`PW.ix.pfs=PW.ix.pfs.filter(p=>p.id!=='A');PW.pf='B';PW.sc='B-base'`);slow.resolve({props:[{st:model('Orphan attempt')}]});
  assert.equal(await importing,0);assert.equal(page.run('PW.ix.props.length'),0);assert.equal(page.run('PW.mem.size'),0);assert.equal(page.run('S.name'),'Active A');assert.match(page.alerts.join('\n'),/target portfolio|target scenario/);
});

test('native property imports retain their original target and preserve later switches or edits',async()=>{
  for(const [name,change] of [['property.basiscre',`PW.pf='B';PW.sc='B-base';S.name='Current B'`],['property.basiscre.zip',`S.name='Edited A during archive read'`],['property.ZIP',`PW.pf='B';PW.sc='B-base'`]]){
    const page=setup(),slow=deferred();page.c.archive=slow.promise;page.run('basisReadArchive=()=>archive');page.c.files=[{name:'property.basiscre',size:1}];
    page.c.files[0].name=name;
    const importing=page.run('pwImportFiles(files)');await tick();page.run(change);const current=page.run('S.name');slow.resolve({kind:'property',model:model('Native property')});
    assert.equal(await importing,1);assert.equal(page.run('PW.ix.props[0].pf'),'A');assert.equal(page.run('PW.ix.props[0].sc'),'A-base');assert.equal(page.run('S.name'),current);assert.equal(page.run('PW.cur'),null);
  }
});

test('removed scenarios reject both native and legacy property imports without an orphan record',async()=>{
  for(const native of [false,true]){
    const page=setup(),slow=deferred();page.c.archive=slow.promise;page.run('basisReadArchive=()=>archive');page.c.files=[{name:native?'property.zip':'property.xlsx',size:1,pending:slow.promise}];
    const importing=page.run('pwImportFiles(files)');await tick();page.run(`PW.ix.pfs[0].scs=[{id:'replacement',name:'Replacement'}];PW.sc='replacement'`);
    slow.resolve(native?{kind:'property',model:model('Missing scenario')}:{props:[{st:model('Missing scenario')}]});
    assert.equal(await importing,0);assert.equal(page.run('PW.ix.props.length'),0);assert.equal(page.run('PW.mem.size'),0);assert.match(page.alerts.join('\n'),/target scenario/);
  }
});

test('an unchanged native import still opens the new property and native portfolios remain additive',async()=>{
  const page=setup();page.c.native={kind:'property',model:model('Native active')};page.run('basisReadArchive=async()=>native');page.c.files=[{name:'property.zip',size:1}];
  assert.equal(await page.run('pwImportFiles(files)'),1);assert.equal(page.run('S.name'),'Native active');assert.equal(page.run('PW.ix.props.length'),1);
  page.c.native={kind:'portfolio',portfolio:{name:'Native portfolio',scenarios:[{id:'base',name:'Base'}],properties:[{scenarioId:'base',model:model('Native member')}]}};
  assert.equal(await page.run('pwImportFiles(files)'),1);assert.equal(page.run('PW.ix.pfs.length'),3);assert.equal(page.run('S.name'),'Native active');
});

test('member-file imports do not publish into a different active model',async()=>{
  const page=setup(),slow=deferred(),add=page.members();const importing=add([{name:'member.xlsx',pending:slow.promise}]);
  page.run(`var original=S;S={name:'Active B',areas:[],tenants:[],mlas:[],portfolio:[]};PW.cur='B-property'`);slow.resolve({props:[{st:model('Late member')}]});await importing;
  assert.equal(page.run('S.portfolio.length'),0);assert.equal(page.run('original.portfolio.length'),0);assert.equal(page.counts.dirty,0);assert.equal(page.counts.draw,0);assert.match(page.alerts.join('\n'),/changed|choose.*again/i);
});

test('member-file imports retain edits and publish no partial selection after context changes',async()=>{
  const page=setup(),slow=deferred(),add=page.members();const importing=add([{name:'first.xlsx',result:{props:[{st:model('First member')}]}},{name:'second.xlsx',pending:slow.promise}]);await tick();
  assert.equal(page.run('S.portfolio.length'),0);page.run(`S.name='Typed while reading'`);slow.resolve({props:[{st:model('Second member')}]});await importing;
  assert.equal(page.run('S.name'),'Typed while reading');assert.equal(page.run('S.portfolio.length'),0);assert.equal(page.counts.dirty,0);assert.equal(page.counts.draw,0);assert.match(page.alerts.join('\n'),/changed|choose.*again/i);
});

test('unchanged member imports publish independent models once and a canceled selection stays clean',async()=>{
  const page=setup(),add=page.members();await add([]);assert.equal(page.counts.dirty,0);assert.equal(page.counts.draw,0);
  const incoming=model('Imported member');await add([{name:'members.xlsx',result:{props:[{st:incoming},{st:model('Second member')}]}}]);
  assert.equal(page.run('S.portfolio.length'),2);assert.equal(page.counts.dirty,1);assert.equal(page.counts.draw,1);incoming.name='Changed source';assert.equal(page.run('S.portfolio[0].model.name'),'Imported member');
});

test('a malformed member file contributes no partial members while valid files can still be added',async()=>{
  const page=setup(),add=page.members();await add([{name:'invalid.xlsx',result:{props:[{st:model('Should not appear')},{st:null}]}},{name:'valid.xlsx',result:{props:[{st:model('Valid member')}]}}]);
  assert.equal(page.run('S.portfolio.length'),1);assert.equal(page.run('S.portfolio[0].name'),'Valid member');assert.equal(page.counts.dirty,1);assert.equal(page.counts.draw,1);assert.match(page.alerts.join('\n'),/invalid.xlsx.*Property model/);
});
