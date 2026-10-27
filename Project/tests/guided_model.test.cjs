const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const read=name=>fs.readFileSync(path.join(root,'src',name),'utf8');
const part=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
function setup(){
  const context=vm.createContext({TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer,Blob,Response,DecompressionStream});
  for(const file of ['financial_engine.js','native_codec.js','number_inputs.js','intake_reconciliation.js','intake_amendments.js','intake_quality.js','intake_review.js','model_checks.js'])vm.runInContext(read(file),context);
  vm.runInContext(part('function parseMDY(', 'const DCAL=')+part('function basisIntakeValue(', 'function basisIntakeComparison(')+part('const iA=v=>','function intGaps()'),context);
  vm.runInContext(`S=sampleState();function intGaps(){return [];}
    S.tenants=S.tenants.slice(0,1);Object.assign(S.tenants[0],{name:'Existing',suite:'100',sf:1000,rent:10,rentBasis:'psfyr',sched:[],start:'2026-01-01',end:'2030-12-31'});
    const record={name:'Proposed',suite:'100',sf:2000,start:'2027-01-01',end:'2032-12-31',steps:[{from:'2027-01-01',annual:12000}],opts:[],match:S.tenants[0].id,src:{doc:'fixture',page:1,quote:'Annual rent $12,000'},srcs:[]};
    const extraction={property:{},tenants:[{key:'tenant',r:record}],expenses:[],other:[],capital:[],market:{},profiles:[],valuation:{},debt:[]};
    const prepare=review=>intPrepareApply(S,extraction,{'t:tenant':true},'merge',review||{});
  `,context);
  return code=>vm.runInContext(code,context);
}
const clone=value=>JSON.parse(JSON.stringify(value));
test('review preview is pure and annual rent normalization uses the accepted area',()=>{
  const run=setup(),before=run('JSON.stringify(S)'),result=run('prepare()');
  assert.equal(result.model.tenants[0].rent,6);assert.equal(result.model.tenants[0].sf,2000);
  assert.equal(run('JSON.stringify(S)'),before);assert.equal(result.tenantReviews[0].before.name,'Existing');
});
test('keeping name, area and dates preserves exact values while accepting other fields',()=>{
  const run=setup(),r=run(`prepare({tenant:{name:{mode:'keep'},sf:{mode:'keep'},start:{mode:'keep'}}})`),t=r.model.tenants[0];
  assert.equal(t.name,'Existing');assert.equal(t.sf,1000);assert.equal(t.rent,12);assert.equal(t.start,'2026-01-01');assert.equal(t.end,'2032-12-31');
  assert.equal(r.model.srcLog.some(x=>x.target.endsWith(' · sf')),false);
});
test('retained fractional SF is not rounded before normalization',()=>{
  const run=setup();run('S.tenants[0].sf=1000.25');const r=run(`prepare({tenant:{sf:{mode:'keep'}}})`);
  assert.equal(r.model.tenants[0].sf,1000.25);assert.equal(r.model.tenants[0].rent,12000/1000.25);
});
test('correcting area normalizes annual rent using the corrected amount',()=>{
  const run=setup(),r=run(`prepare({tenant:{sf:{mode:'edit',values:{sf:500}}}})`);
  assert.equal(r.model.tenants[0].sf,500);assert.equal(r.model.tenants[0].rent,24);
  assert.ok(r.model.srcLog.find(x=>x.target.endsWith(' · sf')).value.includes('Manual correction'));
});
test('rent amount and unit can be corrected together without hidden conversion',()=>{
  const run=setup(),r=run(`prepare({tenant:{rent:{mode:'edit',values:{rent:14250.25,rentBasis:'yramt'}}}})`);
  assert.equal(r.model.tenants[0].rent,14250.25);assert.equal(r.model.tenants[0].rentBasis,'yramt');
  assert.ok(r.model.srcLog.find(x=>x.target.endsWith(' · rent')).value.includes('$14,250.25 /year'));
});
test('keeping rent restores the existing amount, unit, escalation and schedule together',()=>{
  const run=setup();run(`Object.assign(S.tenants[0],{rent:1200,rentBasis:'moamt',step:.04,sched:[{id:'old',mode:'date',date:'2029-01',basis:'moamt',amt:1300}]})`);
  const before=clone(run('S.tenants[0]')),after=clone(run(`prepare({tenant:{rent:{mode:'keep'}}}).model.tenants[0]`));
  for(const field of ['rent','rentBasis','step','sched'])assert.deepEqual(after[field],before[field]);
});
test('a scheduled rent correction cannot silently be overridden by an imported schedule',()=>{
  const run=setup();run(`record.steps.push({from:'2028-01-01',annual:14000})`);
  assert.throws(()=>run(`prepare({tenant:{rent:{mode:'edit',values:{rent:18}}}})`),/schedule controls/);
  const r=run(`prepare({tenant:{rent:{mode:'edit',values:{rent:18,sched:[]}}}})`);
  assert.equal(r.model.tenants[0].rent,18);assert.equal(r.model.tenants[0].sched.length,0);
});
test('rejecting recoveries creates no unused structure or misleading source log',()=>{
  const run=setup();run(`record.rec={type:'fixed',fixedPSF:3,adminFeePct:.15}`);const rec=run('S.tenants[0].rec'),structures=run('JSON.stringify(S.recs)');
  const r=run(`prepare({tenant:{rec:{mode:'keep'}}})`);
  assert.equal(r.model.tenants[0].rec,rec);assert.equal(JSON.stringify(r.model.recs),structures);
  assert.equal(r.model.srcLog.some(x=>x.target.endsWith(' · rec')),false);
});
test('invalid dates, units, negative area and arbitrary fields fail without modifying the model',()=>{
  for(const correction of ["sf:{mode:'edit',values:{sf:-1}}","start:{mode:'edit',values:{start:'2026-02-30'}}","rent:{mode:'edit',values:{rentBasis:'per-unicorn'}}","unknown:{mode:'edit',values:{unknown:5}}"]){
    const run=setup(),before=run('JSON.stringify(S)');assert.throws(()=>run(`prepare({tenant:{${correction}}})`));assert.equal(run('JSON.stringify(S)'),before);
  }
});
test('correction JSON rejects prototype keys and non-finite amounts',()=>{
  const run=setup();assert.throws(()=>run(`prepare(JSON.parse('{"tenant":{"__proto__":{"mode":"keep"}}}'))`),/Reserved/);
  assert.throws(()=>run(`prepare({tenant:{sf:{mode:'edit',values:{sf:Infinity}}}})`),/non-finite/);
});
test('new tenant and replacement reviews keep stable extraction keys without altering inputs',()=>{
  const run=setup();run('record.match=null');const a=run('prepare()'),b=run('prepare()');
  assert.equal(a.tenantReviews[0].key,'tenant');assert.equal(b.tenantReviews[0].key,'tenant');assert.equal(run('S.tenants.length'),1);
  assert.equal(a.model.tenants.length,2);assert.equal(a.applied.cnt.tNew,1);
});
test('validation metadata leaves original findings and calculations unchanged',()=>{
  const run=setup();run('const result=calc(S);const oldFindings=validateModel(S,result);const collected=[];const nextFindings=validateModel(S,result,(issue,target)=>collected.push({issue,target}));');
  assert.equal(run('JSON.stringify(oldFindings)'),run('JSON.stringify(nextFindings)'));
  assert.equal(run('JSON.stringify(oldFindings)'),run('JSON.stringify(collected.map(r=>r.issue))'));
  assert.equal(run('JSON.stringify(result)'),run('JSON.stringify(calc(S))'));
});
test('duplicate tenant names have unambiguous record and field targets',()=>{
  const run=setup();run(`S.tenants.push({...S.tenants[0],id:'duplicate',sf:0});`);
  const issues=run('basisModelIssues(S,calc(S))'),issue=issues.find(i=>i.msg.includes('has zero area'));
  assert.deepEqual(clone(issue.target),{collection:'tenants',record:'duplicate',field:'sf'});
});
test('area, rent units, dates, inflation and expense checks carry structured targets',()=>{
  const run=setup();run(`S.areas[0].sf=0;S.tenants[0].rentBasis='invalid';S.tenants[0].end='2025-01';S.infl[1].rates=[0];S.ops.push({id:'electric',name:'Tenant Electric',amt:100,basis:'amt',fixedPct:1});`);
  const issues=run('basisModelIssues(S,calc(S))');
  for(const [finding,field] of [['Rentable area is zero','sf'],['rent unit','rentBasis'],['ends before','end'],['is zero throughout','rates'],['Tenant electric','fixedPct']]){
    const issue=issues.find(i=>i.msg.includes(finding));assert.ok(issue,finding);assert.equal(issue.target.field,field);
  }
});
test('annual rent without SF retains dollar-per-year units and remains correct when area is supplied',()=>{
  const run=setup();run('S.tenants[0].sf=0;record.sf=null');const r=run('prepare()');
  assert.equal(r.model.tenants[0].rent,12000);assert.equal(r.model.tenants[0].rentBasis,'yramt');
  assert.ok(r.applied.notes.some(note=>note.includes('annual rent is retained')));
  run('S=prepare().model;S.tenants[0].sf=1000;S.tenants[0].step=0;S.tenants[0].start="2026-01";S.startYear=2026;S.startMonth=1;');
  assert.equal(run('calc(S).spaces.find(x=>x.tid===S.tenants[0].id).rent.slice(0,12).reduce((a,b)=>a+b,0)'),12000);
});
test('fixed per-SF escalations with no area are flagged without invented square footage',()=>{
  const run=setup();run("S.tenants[0].sf=0;record.sf=null;record.esc={type:'fixed_psf',value:1}");const r=run('prepare()');
  assert.equal(r.model.tenants[0].rentBasis,'yramt');assert.equal(r.model.tenants[0].rent,12000);assert.equal(r.model.tenants[0].sched.length,0);
  assert.ok(r.applied.notes.some(note=>note.includes('fixed $/SF escalation needs a confirmed area')));
});
test('long imported holds remain preserved and carry an actionable limit finding',()=>{
  const run=setup();run('S.years=60');const issues=run('basisModelIssues(S,calc(S))'),issue=issues.find(i=>i.area==='Analysis');
  assert.equal(run('S.years'),60);assert.equal(run('calc(S).nY'),40);assert.equal(issue.sev,'error');assert.equal(issue.target.field,'years');
  assert.deepEqual(clone(run('basisCheckDestination(basisModelIssues(S,calc(S)).find(i=>i.area==="Analysis")).route')),['property','desc']);
});
test('fractional source SF and annual-to-per-SF conversion keep their precision',()=>{
  const run=setup();run('record.sf=1000.25;record.steps[0].annual=12345.67');const r=run('prepare()');
  assert.equal(r.model.tenants[0].sf,1000.25);assert.equal(r.model.tenants[0].rent,12345.67/1000.25);
  assert.ok(Math.abs(r.model.tenants[0].rent*r.model.tenants[0].sf-12345.67)<1e-8);
});
test('imported expense rates, annual schedules and building area are not rounded on storage',()=>{
  const run=setup();run(`extraction.property.rentableSF={v:1000.25};record.steps.push({from:'2028-01-01',annual:12345.6789});
    extraction.expenses=[{key:'a',r:{name:'Per SF cost',amount:3.45678,basis:'psf',recov:true,cat:'cam'}},{key:'b',r:{name:'Fee',amount:.0123456,basis:'pct',recov:false,cat:'management'}}];`);
  const r=run(`intPrepareApply(S,extraction,{'prop:rentableSF':true,'t:tenant':true,'e:a':true,'e:b':true},'merge')`);
  assert.equal(r.model.areas[0].sf,1000.25);assert.equal(r.model.ops.find(o=>o.name==='Per SF cost').amt,3.45678);assert.equal(r.model.ops.find(o=>o.name==='Fee').amt,.0123456);
  assert.equal(r.model.tenants[0].sched[1].amt,12345.6789);
});
