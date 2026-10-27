const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/intake/reporting_periods.json'),'utf8'));
const clone=value=>JSON.parse(JSON.stringify(value));
const part=(a,b)=>{const start=html.indexOf(a),end=html.indexOf(b,start);assert.ok(start>=0&&end>start);return html.slice(start,end);};
function setup(){
  const context=vm.createContext({TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer});
  for(const file of ['financial_engine.js','native_codec.js','number_inputs.js','intake_reconciliation.js','intake_amendments.js','intake_quality.js','intake_review.js'])vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),context);
  vm.runInContext(part('function parseMDY(','const DCAL=')+part('function basisIntakeValue(','function basisIntakeComparison(')+part('const iA=v=>','function intGaps()')+part('const INT_RANGE=','function intReview('),context);
  context.fixture=clone(fixture);
  vm.runInContext(`S=blankState();Object.assign(S,{startYear:2026,startMonth:1,years:2,gvRate:0,clRate:0});S.areas[0].sf=1000;S.tenants=[];S.ops=[];S.misc=[];S.infl.forEach(x=>x.rates=[0,0,0]);
    function intGaps(){return [];}const docs=fixture.documents,roll=docs[0].results[0],pnl=docs[1].results[0];
    const checks=()=>basisIntakeDocumentChecks(docs),check=key=>checks().find(c=>c.metric===key),merge=()=>intMerge(docs);
    const prepare=()=>{const X=merge();return intPrepareApply(S,X,intDefaultPicks(X),'merge',{});};`,context);
  return source=>vm.runInContext(source,context);
}
test('rent reconciliation uses the rent roll date even beside a later P&L',()=>{
  const run=setup(),c=run("check('rentRollAnnualRent')");assert.equal(c.status,'match');assert.equal(c.read,12000);assert.equal(c.period,'As of 2026-01-01');
});
test('each roll uses its own date and all document ordering gives identical checks',()=>{
  const run=setup();run("const later=JSON.parse(JSON.stringify(docs[0]));later.id='later';later.results[0].asOf='2027-01-01';later.results[0].totals.rentRollAnnualRent=13200;docs.push(later)");
  assert.deepEqual(clone(run("checks().filter(c=>c.metric==='rentRollAnnualRent').map(c=>[c.status,c.read])")),[['match',12000],['match',13200]]);
  const before=run('JSON.stringify(checks().sort((a,b)=>(a.docId+a.metric).localeCompare(b.docId+b.metric)))');run('docs.reverse()');assert.equal(run('JSON.stringify(checks().sort((a,b)=>(a.docId+a.metric).localeCompare(b.docId+b.metric)))'),before);
});
test('missing or invalid snapshot dates do not use the model or another upload',()=>{
  for(const value of ['undefined',"'2026-02-30'","'1/1/2026'",'true']){const run=setup();run(`roll.asOf=${value}`);assert.equal(run("check('rentRollAnnualRent').status"),'incomplete');}
});
test('different snapshots in one file cannot be combined as one roll',()=>{
  const run=setup();run("docs[0].results.push({...roll,asOf:'2027-01-01',tenants:[]})");assert.equal(run("check('rentRollAnnualRent').status"),'incomplete');assert.equal(run("check('rentRollSF').status"),'incomplete');
});
test('vacant asking rents and uncommenced signed leases do not become current rent',()=>{
  const run=setup();run("roll.tenants.push({name:'Vacant',suite:'200',sf:100,status:'vacant',rent:[{amount:50000,unit:'annual'}]},{name:'Future Tenant',suite:'300',sf:100,status:'signed_future',start:'2026-07-01',rent:[{from:'2026-07-01',amount:60000,unit:'annual'}]})");assert.equal(run("check('rentRollAnnualRent').read"),12000);assert.equal(run("check('rentRollAnnualRent').status"),'match');
});
test('an entirely future schedule is not substituted for missing current rent',()=>{
  const run=setup();run('roll.tenants[0].rent.shift()');const c=run("check('rentRollAnnualRent')");assert.equal(c.status,'incomplete');assert.equal(c.read,0);
});
test('expired leases need explicit continuing occupancy before a rent comparison',()=>{
  const run=setup();run("roll.tenants[0].end='2025-12-31'");assert.equal(run("check('rentRollAnnualRent').status"),'incomplete');run("roll.tenants[0].status='holdover'");assert.equal(run("check('rentRollAnnualRent').status"),'match');
});
test('annual, monthly, per-SF annual and per-SF monthly rent reconcile equivalently',()=>{
  for(const [unit,amount]of [['annual',12000],['monthly',1000],['psf_year',12],['psf_month',1]]){const run=setup();run(`roll.tenants[0].rent=[{amount:${amount},unit:'${unit}'}]`);assert.equal(run("check('rentRollAnnualRent').read"),12000);assert.equal(run("check('rentRollAnnualRent').status"),'match');}
});
test('unknown rent units and missing per-SF area do not yield a false arithmetic match',()=>{
  for(const change of ["roll.tenants[0].rent[0].unit='weekly'","delete roll.tenants[0].rent[0].unit","roll.tenants[0].sf='1,0bad';roll.tenants[0].rent=[{amount:12,unit:'psf_year'}]"]){const run=setup();run(change);assert.equal(run("check('rentRollAnnualRent').status"),'incomplete');}
});
test('rule-based escalations cannot be presented as reconciled current rent',()=>{
  const run=setup();run("roll.tenants[0].escalation={type:'pct',value:.03}");assert.equal(run("check('rentRollAnnualRent').status"),'incomplete');
});
test('explicit zero area and rent totals remain checks rather than disappearing',()=>{
  const run=setup();run('roll.totals.rentRollSF=0;roll.totals.rentRollAnnualRent=0');assert.equal(run("check('rentRollSF').status"),'mismatch');assert.equal(run("check('rentRollAnnualRent').status"),'mismatch');assert.equal(run("check('vacantSF').status"),'match');
});
test('six-month expenses compare as reported while model inputs annualize once',()=>{
  const run=setup(),c=run("check('totalOperatingExpenses')");assert.equal(c.read,4000);assert.equal(c.status,'match');assert.deepEqual(clone(run('merge().expenses.map(e=>e.r.amount)')),fixture.expected.annualExpenseInputs);assert.equal(run('merge().other[0].annual'),1200);
  assert.ok(Math.abs(run('calc(prepare().model).ann.op[0]')-8000)<1e-7);
});
test('six-month per-SF expenses use file area for reconciliation and annual units for Apply',()=>{
  const run=setup();run("pnl.property={rentableSF:1000};pnl.expenses=[{name:'Insurance',amount:4,months:6,basis:'psf',recoverable:false}]");assert.equal(run("check('totalOperatingExpenses').read"),4000);assert.equal(run("check('totalOperatingExpenses').status"),'match');assert.equal(run('merge().expenses[0].r.amount'),8);assert.ok(Math.abs(run('calc(prepare().model).ann.op[0]')-8000)<1e-7);
});
test('per-SF reconciliation never borrows area from the model or a different upload',()=>{
  const run=setup();run("roll.property={rentableSF:1000};pnl.expenses=[{name:'Insurance',amount:4,months:6,basis:'psf'}]");assert.equal(run("check('totalOperatingExpenses').status"),'incomplete');
});
test('zero NOI and zero revenue are included in accounting reconciliation',()=>{
  const run=setup();run('pnl.totals.noi=0');assert.equal(run("check('noi').status"),'mismatch');run('pnl.totals.totalRevenue=0;pnl.totals.noi=-4000');assert.equal(run("check('noi').status"),'match');run('pnl.totals.totalOperatingExpenses=0;pnl.totals.noi=0');assert.equal(run("check('noi').status"),'match');
});
test('negative NOI and accounting credits preserve their signs',()=>{
  const run=setup();run('pnl.totals.totalRevenue=3000;pnl.totals.noi="(1,000)"');assert.equal(run("check('noi').status"),'match');assert.equal(run("basisStatementNumber('($1,234.50)')"),-1234.5);
});
test('line periods cannot silently differ from the stated-total period',()=>{
  const run=setup();run('pnl.expenses[0].months=12');assert.equal(run("check('totalOperatingExpenses').status"),'incomplete');assert.equal(run('merge().expenses.length'),2);assert.match(run('merge().warnings[0].text'),/different periods/);
});
test('months omitted on detail inherit a supported statement period',()=>{
  const run=setup();run('pnl.expenses.forEach(e=>delete e.months);delete pnl.otherIncome[0].months');assert.equal(run("check('totalOperatingExpenses').status"),'match');assert.deepEqual(clone(run('merge().expenses.map(e=>e.r.amount)')),[6000,3000,-1000]);assert.equal(run('merge().other[0].annual'),1200);
});
test('whole calendar periods can derive months, including a leap-year February',()=>{
  const run=setup();assert.equal(run("basisStatementPeriod({start:'2028-02-01',end:'2028-02-29'}).months"),1);assert.equal(run("basisStatementPeriod({start:'2027-07-01',end:'2028-06-30'}).months"),12);
});
test('invalid or inconsistent reporting dates and months cannot annualize a proposal',()=>{
  for(const reporting of ["{start:'2026-02-30',months:6}","{start:'2028-06-01',end:'2028-01-31',months:6}","{start:'2028-01-01',end:'2028-06-30',months:12}","{months:0}","{months:13}","{months:-6}"]){const run=setup();run(`pnl.reporting=${reporting}`);assert.equal(run('merge().expenses.length'),0);assert.equal(run('merge().other.length'),0);assert.equal(run("check('totalOperatingExpenses').status"),'incomplete');}
});
test('a missing period with no annual unit is withheld rather than assumed annual',()=>{
  const run=setup();run('delete pnl.reporting;pnl.expenses.forEach(e=>delete e.months);delete pnl.otherIncome[0].months');assert.equal(run('merge().expenses.length'),0);assert.equal(run('merge().other.length'),0);assert.equal(run("check('totalOperatingExpenses').status"),'incomplete');
});
test('explicit annual dollar unit remains a supported input alias',()=>{
  const run=setup();run("delete pnl.reporting;pnl.expenses=[{name:'Insurance',amount:24000,basis:'annual'}]");assert.equal(run('merge().expenses[0].r.amount'),24000);
});
test('invalid expense and income amounts or durations cannot yield partial numeric values',()=>{
  for(const change of ["amount:'1,2'","amount:'1200oops'","amount:true","amount:1e16","months:0","months:-6","months:1.5","months:'six'"]){const run=setup();run(`pnl.expenses=[{name:'Bad',amount:1200,months:6,basis:'total',${change}}];pnl.otherIncome=[{name:'Bad',amount:1200,months:6,${change}}]`);assert.equal(run('merge().expenses.length'),0);assert.equal(run('merge().other.length'),0);}
});
test('unknown expense bases and percentages outside the decimal contract are withheld',()=>{
  const run=setup();run("pnl.expenses=[{name:'Fee',amount:5,basis:'pct_egr',months:6},{name:'Tax',amount:3000,basis:'weekly',months:6}]");assert.equal(run('merge().expenses.length'),0);
});
test('a percentage fee is not reconciled using an assumed EGR equal to total revenue',()=>{
  const run=setup();run("pnl.expenses=[{name:'Management',amount:.03,basis:'pct_egr',months:6}]");assert.equal(run("check('totalOperatingExpenses').status"),'incomplete');assert.equal(run('merge().expenses[0].r.amount'),.03);
});
test('exact duplicate source rows across chunks are counted once',()=>{
  const run=setup();run('docs[0].results.push(JSON.parse(JSON.stringify(roll)));docs[1].results.push(JSON.parse(JSON.stringify(pnl)))');assert.ok(run('checks().every(c=>c.status==="match")'));assert.equal(run("check('totalOperatingExpenses').read"),4000);
});
test('same tenant identity without identical evidence is incomplete rather than silently deduplicated',()=>{
  const run=setup();run("const copy=JSON.parse(JSON.stringify(roll.tenants[0]));copy.src.page=2;roll.tenants.push(copy)");assert.equal(run("check('rentRollAnnualRent').status"),'incomplete');
});
test('two separate expenses with the same dollar amount remain separate detail rows',()=>{
  const run=setup();run("pnl.expenses=[{name:'Tax',amount:2000,months:6,basis:'total'},{name:'Insurance',amount:2000,months:6,basis:'total'}]");assert.equal(run("check('totalOperatingExpenses').read"),4000);assert.equal(run("check('totalOperatingExpenses').status"),'match');
});
test('conflicting chunk totals cannot silently use the first number',()=>{
  const run=setup();run("docs[0].results.push({docType:'rent_roll',asOf:roll.asOf,totals:{rentRollAnnualRent:13000}})");assert.equal(run("check('rentRollAnnualRent').status"),'incomplete');
});
test('part totals are not treated as full-document totals',()=>{
  const run=setup();run("roll.totals.scope='part'");assert.equal(run("check('rentRollAnnualRent').status"),'incomplete');
});
test('actual and budget or distinct reporting periods in one file are never added together',()=>{
  for(const reporting of ["{...pnl.reporting,column:'budget'}","{start:'2027-01-01',end:'2027-06-30',months:6,column:'actual'}"]){const run=setup();run(`docs[1].results.push({...pnl,reporting:${reporting},expenses:[]})`);assert.equal(run("check('totalOperatingExpenses').status"),'incomplete');assert.equal(run('merge().expenses.length'),0);}
});
test('subtotals cannot be imported as expense or other-income detail',()=>{
  const run=setup();run("pnl.expenses.push({name:'Total Operating Expenses',amount:4000,months:6,basis:'total'});pnl.otherIncome.push({name:'Total Income',amount:6000,months:6})");assert.equal(run('merge().expenses.length'),3);assert.equal(run('merge().other.length'),1);assert.equal(run("check('totalOperatingExpenses').status"),'incomplete');
});
test('files without stated totals explicitly disclose that completeness was not checked',()=>{
  const run=setup();run('delete roll.totals');assert.ok(run("checks().some(c=>c.docId==='rent-roll-jan'&&c.metric==='none'&&c.status==='incomplete')"));
});
test('a total citation stays attached to its own local document and field',()=>{
  const run=setup();run("pnl.totals.fieldSources={noi:{page:1,quote:'NOI $2,000.'}};docs[1].name=docs[0].name");const c=run("check('noi')");assert.equal(c.src.docId,'pnl-jun');assert.equal(c.src.quote,'NOI $2,000.');assert.equal(c.src.evidence,'matched');
});
test('checks and mapping leave uploaded facts and the current model unchanged',()=>{
  const run=setup(),before=run('JSON.stringify({S,facts:docs.map(d=>d.results)})');run('checks();merge();prepare()');assert.equal(run('JSON.stringify({S,facts:docs.map(d=>d.results)})'),before);
});
test('the integrated pre-Apply checks include document mismatches and missing coverage',()=>{
  const run=setup();run('pnl.totals.noi=0');assert.ok(run("intChecks(merge(),docs).some(c=>c.area==='Document Totals'&&c.msg.includes('Mismatch')&&c.src.docId==='pnl-jun')"));
});
test('extraction instructions keep actuals, budgets, periods, zeros and subtotals explicit',()=>{
  const text=part('const INT_SCHEMA=','function intChunks(');assert.match(text,/Never annualize reported amounts/);assert.match(text,/Do not choose a budget merely/);assert.match(text,/Preserve zero totals/);assert.match(text,/"reporting"/);assert.doesNotMatch(text,/use the budget for the year the analysis starts/);
});
