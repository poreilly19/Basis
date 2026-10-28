'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/financial_engine.js'),'utf8'),context);
const {blankState,calc,calcPositions,validateModel}=vm.runInContext('({blankState,calc,calcPositions,validateModel})',context);
const near=(actual,expected,label)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<1e-7,`${label}: expected ${expected}, received ${actual}`);

// Independent economics: $12,000 rent less $2,400 operating costs = $9,600 NOI.
// One-year hold, zero discount, 8% exit cap, no selling costs. The position view's
// explicit 2% terminal growth gives $122,400 terminal value before capital costs.
function flat(){
 const s=blankState();Object.assign(s,{startYear:2026,startMonth:1,years:1,gvRate:0,clRate:0,
  discount:0,priceMode:'amount',price:120000,exitCap:.08,costSale:0,exitGrowth:.02});
 s.areas=[{id:'area',name:'Building',sf:1000,basis:true}];
 s.tenants=[{id:'tenant',name:'Tenant',sf:1000,start:'2026-01',end:'2035-12',rent:12,rentBasis:'psfyr',rec:s.recs[1].id,expiry:'Vacate'}];
 s.ops=[{id:'cost',name:'Expenses',amt:2400,basis:'amt',fixedPct:1,infl:0}];
 s.infl.forEach(series=>{series.rates=[0,0,0];});return s;
}
test('position fee-simple value deducts annual capital exactly once',()=>{
 const s=flat();s.caps=[{id:'capital',name:'Capital',amt:1000,basis:'amt',infl:0}];
 const r=calc(s),p=calcPositions(s,r);near(r.ann.cfbds[0],8600,'net cash');
 near(p.feeSimple,8600+122400,'fee simple after one capital deduction');
});
test('zero or negative position cash flow is retained instead of reverting to NOI',()=>{
 for(const [capital,cash]of [[4800,4800],[9600,0],[12000,-2400]]){
  const s=flat();s.caps=[{id:'capital',name:'Capital',amt:capital,basis:'amt',infl:0}];
  near(calcPositions(s,calc(s)).feeSimple,cash+122400,'capital '+capital);
 }
});
test('position cash and value are invariant to the operating classification of ground rent',()=>{
 for(const treatment of ['op','nonop']){
  const s=flat();s.groundLeases=[{id:'ground',rent:1200,rentBasis:'amt',start:'2026-01',termYears:10,treatment}];
  const p=calcPositions(s,calc(s));near(p.rows[0].noiPre,9600,'NOI before ground rent');
  near(p.rows[0].gr,1200,'ground rent');near(p.rows[0].lh,8400,'leasehold cash');
  near(p.feeSimple,132000,'fee simple');near(p.leasehold,8400+8400*1.02/.08,'leasehold value');
 }
});
test('an explicit zero terminal growth is distinct from the default growth',()=>{
 const s=flat();s.exitGrowth=0;near(calcPositions(s,calc(s)).feeSimple,9600+120000,'zero growth');
 for(const empty of [undefined,null,'']){s.exitGrowth=empty;near(calcPositions(s,calc(s)).feeSimple,132000,'default growth');}
});
test('a reset or CPI event outside the hold leaves contractual escalation intact',()=>{
 for(const pos of [{resetOn:true,resetFirst:10,resetEvery:10},{cpiOn:true,cpiEvery:10,cpiCap:.02}]){
  const s=flat();s.years=2;s.pos=pos;s.groundLeases=[{id:'ground',rent:1200,rentBasis:'amt',start:'2026-01',termYears:10,escal:.1,treatment:'op'}];
  const p=calcPositions(s,calc(s));assert.equal(p.events.length,0);near(p.rows[0].gr,1200,'first-year ground rent');
  near(p.rows[1].gr,1320,'second-year contractual escalation');near(p.rows[1].lh,8280,'second-year leasehold cash');
 }
});
test('actual reset events remain on the configured analysis years and preserve the post-event policy',()=>{
 const s=flat();s.years=4;s.groundLeases=[{id:'ground',rent:1200,rentBasis:'amt',start:'2026-01',termYears:10,escal:.1,treatment:'op'}];
 s.pos={resetOn:true,resetFirst:2,resetEvery:2,landValue:100000,resetRate:.02,landGrowth:0};
 const p=calcPositions(s,calc(s));assert.deepEqual(Array.from(p.events,e=>e.yr),[2028]);
 [1200,1320,2000,2000].forEach((amount,y)=>near(p.rows[y].gr,amount,'ground rent year '+y));
});
test('blank or zero recurrence intervals remain inactive',()=>{
 for(const interval of [undefined,null,'','  ',0,'0',' 0.0 ']){
  const s=flat();s.pos={resetOn:true,resetFirst:1,resetEvery:interval,cpiOn:true,cpiEvery:interval};
  const p=calcPositions(s,calc(s));assert.equal(p.events.length,0);assert.equal(p.timingIssues,undefined);
 }
});
test('negative or fractional position timing is bounded, skipped and reported as a model error',()=>{
 for(const [pos,key]of [
  [{resetOn:true,resetFirst:-1e300,resetEvery:1},'resetFirst'],
  [{resetOn:true,resetFirst:1,resetEvery:1e-300},'resetEvery'],
  [{resetOn:true,resetFirst:.5,resetEvery:1},'resetFirst'],
  [{cpiOn:true,cpiEvery:.5},'cpiEvery'],
  [{optOn:true,optYear:-1},'optYear'],[{optOn:true,optYear:1.5},'optYear']
 ]){
  const s=flat();s.pos=pos;
  const r=calc(s),p=calcPositions(s,r);assert.ok(p.timingIssues.some(issue=>issue.key===key));
  const issues=[];validateModel(s,r,(issue,target)=>issues.push({issue,target}));
  assert.ok(issues.some(({issue,target})=>target?.field===key&&issue.sev==='error'));
 }
});
