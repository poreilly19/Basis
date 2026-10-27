const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const part=(a,b)=>{const start=html.indexOf(a),end=html.indexOf(b,start);assert.ok(start>=0&&end>start);return html.slice(start,end);};
function setup(){
  const context=vm.createContext({TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer});
  for(const file of ['financial_engine.js','native_codec.js','number_inputs.js','intake_reconciliation.js','intake_amendments.js','intake_quality.js','intake_review.js'])
    vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),context);
  vm.runInContext(part('function parseMDY(','const DCAL=')+part('function basisIntakeValue(','function basisIntakeComparison(')+part('const iA=v=>','function intGaps()'),context);
  vm.runInContext(`S=blankState();Object.assign(S,{startYear:2026,startMonth:1,years:2,gvRate:0,clRate:0});
    S.areas[0].sf=1000;S.tenants=[{id:'tenant',name:'Tenant',suite:'100',sf:1000,start:'2026-01-01',end:'2030-12-31',rent:12,rentBasis:'psfyr',step:0,free:0,rec:S.recs[1].id,mla:S.mlas[0].id,expiry:'Vacate'}];
    function intGaps(){return [];}
    const record={name:'Tenant',suite:'100',sf:1000,start:'2026-01-01',end:'2030-12-31',steps:[{from:'2026-01-01',annual:12000}],opts:[],match:'tenant',src:{doc:'lease',page:1,quote:'$12,000 annual rent'},srcs:[]};
    const extraction={property:{},tenants:[{key:'tenant',r:record}],expenses:[],other:[],capital:[],market:{},profiles:[],valuation:{},debt:[]};
    const prepare=review=>intPrepareApply(S,extraction,{'t:tenant':true},'merge',review||{});`,context);
  return source=>vm.runInContext(source,context);
}
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`expected ${expected}, received ${actual}`);

test('an imported explicit expiry overrides a previously term-based lease',()=>{
  const run=setup();run("Object.assign(S.tenants[0],{termMode:'term',termYears:1,termMonths:0});record.end='2028-12-31'");
  const result=run('prepare()');assert.equal(result.model.tenants[0].termMode,'date');
  assert.equal(run('leaseEnd(prepare().model.tenants[0])'),'2028-12-31');
  assert.equal(result.model.tenants[0].termYears,1,'inactive term input is retained');
  near(run('calc(prepare().model).ann.sched[1]'),12000);
});
test('keeping expiry preserves both the original date and term-entry mode',()=>{
  const run=setup();run("Object.assign(S.tenants[0],{termMode:'term',termYears:1,termMonths:0});record.end='2028-12-31'");
  const result=run("prepare({tenant:{end:{mode:'keep'}}})");
  assert.equal(result.model.tenants[0].end,'2030-12-31');assert.equal(result.model.tenants[0].termMode,'term');
  assert.equal(run("leaseEnd(prepare({tenant:{end:{mode:'keep'}}}).model.tenants[0])"),'2026-12-31');
});
test('free rent beginning in July abates July instead of January',()=>{
  const run=setup();run("record.free={months:1,start:'2026-07-01'}");
  const result=run('prepare()'),t=result.model.tenants[0];
  assert.equal(t.freeStart,7);assert.equal(t.freeBasis,'months');
  near(run('calc(prepare().model).monthly.sched[0]'),1000);
  near(run('calc(prepare().model).monthly.sched[6]'),0);
  near(run('calc(prepare().model).ann.sched[0]'),11000);
  assert.ok(result.model.srcLog.some(x=>x.value.includes('lease month 7')));
});
test('reviewed commencement drives the imported free-rent month and rent step dates',()=>{
  const run=setup();run("record.free={months:1,start:'2026-07-01'};record.esc={type:'fixed_psf',value:1}");
  const result=run("prepare({tenant:{start:{mode:'edit',values:{start:'2026-02-01'}}}})"),t=result.model.tenants[0];
  assert.equal(t.freeStart,6);assert.equal(t.sched[0].date,'2026-02-01');assert.equal(t.sched[1].date,'2027-02-01');
  near(run("calc(prepare({tenant:{start:{mode:'edit',values:{start:'2026-02-01'}}}}).model).monthly.sched[6]"),0);
});
test('explicit zero free rent removes a prior grant and its market override',()=>{
  const run=setup();run("Object.assign(S.tenants[0],{free:3,freeStart:5,freeBasis:'market'});record.free={months:0}");
  const result=run('prepare()'),t=result.model.tenants[0];
  assert.equal(t.free,0);assert.equal(t.freeBasis,'months');assert.equal(t.freeStart,1);
  near(run('calc(prepare().model).ann.abate[0]'),0);
});
test('imported free months use entered months and reset a stale commencement offset',()=>{
  const run=setup();run("Object.assign(S.tenants[0],{free:3,freeStart:8,freeBasis:'market'});record.free={months:1}");
  const t=run('prepare().model.tenants[0]');assert.equal(t.freeStart,1);assert.equal(t.freeBasis,'months');
  near(run('calc(prepare().model).ann.abate[0]'),1000);
});
test('keeping free-rent terms preserves amount, start and selected basis together',()=>{
  const run=setup();run("Object.assign(S.tenants[0],{free:2,freeStart:4,freeBasis:'months'});record.free={months:1,start:'2026-07-01'}");
  const t=run("prepare({tenant:{abatement:{mode:'keep'}}}).model.tenants[0]");
  assert.deepEqual([t.free,t.freeStart,t.freeBasis],[2,4,'months']);
});
test('unrepresentable document free-rent timing is not silently moved or rounded',()=>{
  for(const proposed of ["{months:1,start:'2026-07-16'}","{months:1,start:'2025-12-01'}","{months:1,start:'2026-02-30'}","{months:1.5,start:'2026-07-01'}"]){
    const run=setup();run(`record.free=${proposed}`);const before=run('JSON.stringify(S)'),result=run('prepare()');
    assert.equal(result.model.tenants[0].free,0);assert.equal(run('JSON.stringify(S)'),before);
    assert.ok(result.applied.notes.some(x=>/free rent was not applied/i.test(x)),JSON.stringify(result.applied.notes));
  }
});
test('dependent review corrections reject invalid free-rent units and offsets',()=>{
  const run=setup();run("record.free={months:1,start:'2026-07-01'}");
  for(const values of ["{freeBasis:'unknown'}","{freeStart:0}","{free:1.5}","{termMode:'unknown'}"]){
    const group=values.includes('termMode')?'end':'abatement';
    assert.throws(()=>run(`prepare({tenant:{${group}:{mode:'edit',values:${values}}}})`));
  }
});
