const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {test}=require('node:test');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function setup(){
  const context=vm.createContext({TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer,Blob,Response,DecompressionStream,crypto:require('node:crypto').webcrypto});
  for(const name of ['financial_engine','tenant_groups','scenario_settings','native_codec'])
    vm.runInContext(fs.readFileSync(path.join(root,'src',name+'.js'),'utf8'),context);
  return {context,run:source=>vm.runInContext(source,context,{timeout:5000})};
}

test('legacy single memberships are read without migrating saved data',()=>{
  const {run}=setup();
  assert.deepEqual(plain(run(`(()=>{const t={group:'a'},before=JSON.stringify(t);return {ids:basisTenantGroupIds(t),unchanged:before===JSON.stringify(t)};})()`)),{ids:['a'],unchanged:true});
  assert.deepEqual(plain(run('basisTenantGroupIds({})')),[]);
});
test('explicit multiple or empty memberships override the legacy primary',()=>{
  const {run}=setup();
  assert.deepEqual(plain(run("basisTenantGroupIds({group:'old',groups:['b','a','b']})")),['b','a']);
  assert.deepEqual(plain(run("basisTenantGroupIds({group:'old',groups:[]})")),[]);
});
test('assignments copy and deduplicate IDs and mirror the primary for older readers',()=>{
  const {run}=setup();
  assert.deepEqual(plain(run(`(()=>{const t={},ids=['a','b','a'];basisSetTenantGroups(t,ids);ids.push('c');return t;})()`)),{groups:['a','b'],group:'a'});
  assert.deepEqual(plain(run("(()=>{const t={group:'a'};basisSetTenantGroups(t,[]);return t;})()")),{groups:[],group:''});
});
test('invalid group assignments fail before changing the tenant',()=>{
  const {context,run}=setup();
  for(const invalid of [null,'a',{},[''],[2],['a'.repeat(1001)],Array(1001).fill('a')]){
    context.invalid=invalid;run("var tenant={group:'kept'}");
    assert.throws(()=>run('basisSetTenantGroups(tenant,invalid)'),/group/i);
    assert.deepEqual(plain(run('tenant')),{group:'kept'});
  }
});
test('group deletion preserves other memberships and counts each tenant once per group',()=>{
  const {run}=setup();
  const result=plain(run(`(()=>{
    const m={tgroups:[{id:'a'},{id:'b'}],tenants:[{id:'one',sf:100,group:'a',groups:['a','b']},{id:'two',sf:200,group:'b'},{id:'three',sf:50,group:'missing'}]};
    const counts=['a','b'].map(id=>basisTenantGroupMembers(m,id).reduce((n,t)=>n+t.sf,0));
    basisRemoveTenantGroup(m,'a');return {counts,m};})()`));
  assert.deepEqual(result.counts,[100,300]);
  assert.deepEqual(result.m.tenants[0],{id:'one',sf:100,group:'b',groups:['b']});
  assert.deepEqual(result.m.tenants[1],{id:'two',sf:200,group:'b'});
  assert.deepEqual(result.m.tenants[2],{id:'three',sf:50,group:'missing'});
  assert.deepEqual(result.m.tgroups,[{id:'b'}]);
});
test('deleting a stale primary cannot resurrect cleared authoritative assignments',()=>{
  const {run}=setup();
  assert.deepEqual(plain(run("(()=>{const m={tenants:[{group:'a',groups:[]}],tgroups:[{id:'a'}]};basisRemoveTenantGroup(m,'a');return m.tenants[0];})()")),{group:'',groups:[]});
});
test('native property and portfolio files preserve multiple, empty, legacy and unresolved memberships',async()=>{
  const {run,context}=setup();
  const model={name:'Groups',tgroups:[{id:'a',name:'Industrial'},{id:'b',name:'Credit'}],tenants:[{id:'one',group:'a',groups:['a','b','unknown'],future:{kept:true}},{id:'two',group:'',groups:[]},{id:'three',group:'b'}]};
  const portfolio={name:'Portfolio',scenarios:[{id:'base',name:'Base'},{id:'down',name:'Downside'}],properties:[{id:'p',scenarioId:'base',include:true,model},{id:'q',scenarioId:'down',include:false,model:{...model,tenants:[{id:'one',groups:['b'],group:'b'}]}}]};
  for(const specification of [{kind:'property',model},{kind:'portfolio',portfolio}]){
    context.specification=specification;
    const result=await run('basisCreateArchive(specification).then(bytes=>basisReadArchive(new Blob([bytes])))');
    assert.deepEqual(plain(result[specification.kind==='property'?'model':'portfolio']),specification[specification.kind==='property'?'model':'portfolio']);
  }
});
test('native writers and archive readers reject malformed group arrays including nested properties',async()=>{
  const {run,context}=setup();
  for(const groups of [null,'a',{},[''],[1],['a','a'],['a'.repeat(1001)],Array.from({length:1001},(_,i)=>String(i))]){
    for(const nested of [false,true]){
      const child={name:'Invalid',tenants:[{id:'t',groups}]};
      context.candidate=nested?{name:'Host',portfolio:[{id:'child',model:child}]}:child;
      const before=JSON.stringify(context.candidate);
      await assert.rejects(run("basisCreateArchive({kind:'property',model:candidate})"),/groups/);
      // A valid ZIP with an older manifest still must validate all model fields.
      await assert.rejects(run(`basisReadArchive(new Blob([basisZipWrite([{name:'manifest.json',data:JSON.stringify({format:BASIS_NATIVE_ID,schemaVersion:0})},{name:'assets/model.json',data:JSON.stringify(candidate)}])]))`),/groups/);
      assert.equal(JSON.stringify(context.candidate),before);
    }
  }
});
test('multiple memberships leave all calculated property results unchanged',()=>{
  const {run}=setup();
  assert.equal(run(`(()=>{const m=sampleState();for(const t of m.tenants)t.group='a';const before=JSON.stringify(calc(m));for(const t of m.tenants)basisSetTenantGroups(t,['a','b']);return JSON.stringify(calc(m))===before;})()`),true);
});
test('bulk add and remove preserve unrelated, legacy and unresolved memberships',()=>{
  const {run}=setup();
  const result=plain(run(`(()=>{const m={tgroups:[{id:'a'},{id:'b'}],tenants:[{id:'1',group:'a'},{id:'2',groups:['missing','b']},{id:'3',group:'a'}]};
    const added=basisBulkTenantGroups(m,['1','2'],'b','add'),removed=basisBulkTenantGroups(m,['1','2'],'b','remove');return {added,removed,m};})()`));
  assert.equal(result.added,1);assert.equal(result.removed,2);
  assert.deepEqual(result.m.tenants,[{id:'1',group:'a',groups:['a']},{id:'2',group:'missing',groups:['missing']},{id:'3',group:'a'}]);
});
test('invalid or stale bulk selections leave every tenant unchanged',()=>{
  const {run,context}=setup();
  for(const [ids,group,operation] of [[[],'a','add'],[['1','missing'],'a','add'],[['1','1'],'a','add'],[['1'],'deleted','remove'],[['1'],'a','replace']]){
    context.ids=ids;context.group=group;context.operation=operation;
    run("var m={tgroups:[{id:'a'}],tenants:[{id:'1',group:'old'}]},before=JSON.stringify(m)");
    assert.throws(()=>run('basisBulkTenantGroups(m,ids,group,operation)'));
    assert.equal(run('JSON.stringify(m)===before'),true);
  }
});
test('a group limit failure late in a bulk add never partially updates earlier tenants',()=>{
  const {run}=setup();
  run("var m={tgroups:[{id:'new'}],tenants:[{id:'1',group:'old'},{id:'2',groups:Array.from({length:1000},(_,i)=>'g'+i)}]},before=JSON.stringify(m)");
  assert.throws(()=>run("basisBulkTenantGroups(m,['1','2'],'new','add')"),/1000/);
  assert.equal(run('JSON.stringify(m)===before'),true);
});
test('bulk no-ops retain original legacy serialization and leave calculated values unchanged',()=>{
  const {run}=setup();
  assert.equal(run(`(()=>{const m=sampleState();m.tgroups=[{id:'a'},{id:'b'}];m.tenants.forEach(t=>t.group='a');const old=JSON.stringify(m),cash=JSON.stringify(calc(m)),ids=m.tenants.map(t=>t.id);
    if(basisBulkTenantGroups(m,ids,'a','add')!==0||JSON.stringify(m)!==old)return false;
    basisBulkTenantGroups(m,ids,'b','add');return JSON.stringify(calc(m))===cash;})()`),true);
});
test('bulk report rows match headers and include all group names',()=>{
  const {run}=setup(),from=html.indexOf('function buildDump('),end=html.indexOf('function tsvOf(',from);
  assert.ok(from>=0&&end>from,'Report helpers must be present in the standalone app');
  run(html.slice(from,end));
  const reports=plain(run(`S=sampleState();S.tenants[0].groups=['a','b'];S.tgroups=[{id:'a',name:'Industrial'},{id:'b',name:'Credit'}];R=calc(S);buildDump()`));
  for(const rows of Object.values(reports))for(const row of rows)assert.equal(row.length,rows[0].length);
  assert.equal(reports['Tenant Rent Roll'][1].at(-1),'Industrial; Credit');
  assert.equal(reports['Cash Flow'][1].length,run('R.nY+1'));
});
