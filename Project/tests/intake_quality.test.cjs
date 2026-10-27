const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/intake/partial_abatement.json'),'utf8'));
const part=(a,b)=>{const start=html.indexOf(a),end=html.indexOf(b,start);assert.ok(start>=0&&end>start);return html.slice(start,end);};
const clone=x=>JSON.parse(JSON.stringify(x));
function setup(){
  const context=vm.createContext({TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer});
  for(const file of ['financial_engine.js','native_codec.js','number_inputs.js','intake_reconciliation.js','intake_amendments.js','intake_quality.js','intake_review.js'])vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),context);
  vm.runInContext(part('function parseMDY(','const DCAL=')+part('function basisIntakeValue(','function basisIntakeComparison(')+part('const iA=v=>','function intGaps()'),context);
  const run=source=>vm.runInContext(source,context);context.fixture=clone(fixture);
  run(`S=blankState();Object.assign(S,{startYear:2026,startMonth:1,years:2,gvRate:0,clRate:0});S.areas[0].sf=1000;S.infl.forEach(x=>x.rates=[0,0,0]);S.ops=[];
    S.tenants=[{id:'tenant',name:'North Labs LLC',suite:'100',sf:1000,start:'2026-01-01',end:'2030-12-31',rent:10,rentBasis:'psfyr',step:0,free:0,rec:S.recs[1].id,mla:S.mlas[0].id,expiry:'Vacate'}];
    function intGaps(){return [];}
    const docs=fixture.documents;let X=intMerge(docs),picks=intDefaultPicks(X);const key=X.tenants[0].key;
    const prepare=(review={},mode='merge')=>intPrepareApply(S,X,picks,mode,review);`);
  return run;
}
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`expected ${expected}, received ${actual}`);

test('valuation reports retain document precedence and evidence when marketing materials disagree',()=>{
  const run=setup();run(`const report={id:'model-report',name:'Valuation report.pdf',pages:[],results:[{
    docType:'valuation_report',property:{rentableSF:1000},valuation:{exitCap:0.06}}]};
    const brochure={id:'brochure',name:'Offering memorandum.pdf',pages:[],results:[{
      docType:'offering_memorandum',property:{rentableSF:1200},valuation:{exitCap:0.07}}]};`);
  for(const order of ['[report,brochure]','[brochure,report]']){
    const result=run(`intMerge(${order})`);
    assert.equal(result.property.rentableSF.v,1000);
    assert.equal(result.valuation.exitCap.v,0.06);
    assert.equal(result.valuation.exitCap.src.docType,'valuation_report');
    assert.equal(result.valuation.exitCap.src.doc,'Valuation report.pdf');
    assert.equal(result.conflicts.length,2);
    assert.ok(result.conflicts.every(c=>c.others.some(o=>o.src.doc==='Offering memorandum.pdf')));
  }
});

test('unrecognized report categories stay below recognized sources without rewriting raw extraction',()=>{
  const run=setup();run(`const future={id:'future',name:'Unrecognized report.pdf',pages:[],results:[{
    docType:'future_report',valuation:{exitCap:0.06}}]};
    const marketing={id:'marketing',name:'Offering memorandum.pdf',pages:[],results:[{
      docType:'offering_memorandum',valuation:{exitCap:0.07}}]};
    const beforeFuture=JSON.stringify(future.results);`);
  const result=run('intMerge([future,marketing])');
  assert.equal(result.valuation.exitCap.v,0.07);
  assert.equal(result.valuation.exitCap.src.docType,'offering_memorandum');
  assert.equal(result.conflicts[0].others[0].src.docType,'other');
  assert.equal(result.conflicts[0].others[0].src.doc,'Unrecognized report.pdf');
  assert.equal(run('JSON.stringify(future.results)'),run('beforeFuture'));
});

test('unknown and inherited document-type names cannot outrank a recognized valuation report',()=>{
  const run=setup();
  for(const type of ['unknown','future_report','constructor','__proto__','toString',null,17]){
    const result=run(`intMerge([
      {id:'unknown',name:'Unknown source',pages:[],results:[{docType:${JSON.stringify(type)},valuation:{exitCap:0.1}}]},
      {id:'report',name:'Valuation report.pdf',pages:[],results:[{docType:'valuation_report',valuation:{exitCap:0.06}}]}
    ])`);
    assert.equal(result.valuation.exitCap.v,0.06);
    assert.equal(result.conflicts[0].others[0].src.docType,'other');
  }
});

test('base lease plus amendment retains duration, percentage, expiry and each monthly cash flow',()=>{
  const run=setup(),before=run('JSON.stringify(S)'),result=run('prepare()'),t=result.model.tenants[0],expected=fixture.expected;
  assert.deepEqual([t.end,t.free,t.freeStart,t.freePct,t.freeType],[expected.expiry,expected.freeMonths,expected.freeStart,expected.freePct,expected.freeType]);
  const cash=run('calc(prepare().model)');cash.monthly.sched.slice(0,12).forEach((n,i)=>near(n,expected.monthlyRentYearOne[i]));
  near(cash.ann.sched[0],expected.yearOneRent);near(cash.ann.sched[1],expected.yearTwoRent);assert.equal(run('JSON.stringify(S)'),before);
});
test('gross partial abatement reduces recovery charges only when the clause says gross',()=>{
  const run=setup();run("S.tenants[0].rec=S.recs[0].id;S.recs[0].adminFee=0;S.ops=[{id:'cost',name:'Tax',amt:2400,basis:'amt',fixedPct:1,infl:0,recov:true}]");
  near(run('calc(prepare().model).monthly.reimb[6]'),200);
  run("X.tenants[0].r.free.scope='gross'");near(run('calc(prepare().model).monthly.reimb[6]'),100);near(run('calc(prepare().model).monthly.sched[6]'),500);
});
test('an explicit full base-rent grant resets stale partial and gross settings',()=>{
  const run=setup();run("Object.assign(S.tenants[0],{freePct:.25,freeType:'gross'});X.tenants[0].r.free.pct=1");
  const t=run('prepare().model.tenants[0]');assert.equal(t.freePct,1);assert.equal(t.freeType,'base');near(run('calc(prepare().model).monthly.sched[6]'),0);
});
test('keeping free rent preserves its percentage, scope and timing together',()=>{
  const run=setup();run("Object.assign(S.tenants[0],{free:2,freeStart:3,freePct:.25,freeType:'gross',freeBasis:'months'})");
  const t=run("prepare({[key]:{abatement:{mode:'keep'}}}).model.tenants[0]");assert.deepEqual([t.free,t.freeStart,t.freePct,t.freeType],[2,3,.25,'gross']);
});
test('invalid extracted shares or scopes preserve existing terms and produce a review note',()=>{
  for(const fragment of ["pct:50","pct:-.1","pct:'0.5junk'","scope:'everything'"]){const run=setup();run(`X.tenants[0].r.free={months:6,start:'2026-07-01',pct:.5,scope:'base',${fragment}}`);const result=run('prepare()');assert.equal(result.model.tenants[0].free,0);assert.ok(result.applied.notes.some(n=>n.includes('free rent was not applied')));}
});
test('review rejects an invalid abatement share and accepts a corrected fraction',()=>{
  const run=setup();for(const value of ['2','-.5','true',"'0.5'",'null'])assert.throws(()=>run(`prepare({[key]:{abatement:{mode:'edit',values:{freePct:${value}}}}})`));
  near(run("calc(prepare({[key]:{abatement:{mode:'edit',values:{freePct:.25}}}}).model).monthly.sched[6]"),750);
});
test('merged fields and source-log entries retain the document that supplied each value',()=>{
  const run=setup(),record=run('X.tenants[0].r'),log=run('prepare().model.srcLog');
  assert.equal(record.fieldSources.steps.docId,'base-lease');assert.equal(record.fieldSources.end.docId,'lease-amendment');
  assert.equal(record.fieldSources.steps.evidence,'matched');assert.equal(record.fieldSources.free.evidence,'matched');
  assert.equal(log.find(row=>row.target.endsWith(' · base rent')).docId,'base-lease');assert.equal(log.find(row=>row.target.endsWith(' · expiration')).docId,'lease-amendment');
  assert.equal(log.find(row=>row.target.endsWith(' · free rent')).docId,'lease-amendment');
});
test('manual corrections retain the relevant source and disclose that the value was corrected',()=>{
  const run=setup(),log=run("prepare({[key]:{rent:{mode:'edit',values:{rent:15}}}}).model.srcLog");
  const rent=log.find(x=>x.target.endsWith(' · rent'));assert.equal(rent.docId,'base-lease');assert.ok(rent.value.startsWith('Manual correction:'));
});
test('source checks distinguish a found quote, absent quote and nonexistent or excluded page',()=>{
  const run=setup();assert.equal(run("intSrc(docs[0],'lease',{page:'1',quote:'Annual base rent is $12,000.'}).evidence"),'matched');
  assert.equal(run("intSrc(docs[0],'lease',{page:1,quote:'Annual base rent is $99,000.'}).evidence"),'not_found');
  assert.equal(run("intSrc(docs[0],'lease',{page:99,quote:'Annual base rent is $12,000.'}).evidence"),'invalid_page');
  run('docs[0].pages[0].off=true');assert.equal(run("intSrc(docs[0],'lease',{page:1,quote:'Annual base rent is $12,000.'}).evidence"),'excluded');
});
test('scanned and weak citations are explicitly unverified and cannot choose another file ID',()=>{
  const run=setup();run("const scan={id:'local',name:'scan.pdf',pages:[{n:1,text:''}],images:[{n:1}]}");
  assert.equal(run("intSrc(scan,'lease',{page:1,quote:'Some full sentence',docId:'forged'}).docId"),'local');
  assert.equal(run("intSrc(scan,'lease',{page:1,quote:'Some full sentence'}).evidence"),'image');
  assert.equal(run("intSrc(scan,'lease',{page:1,quote:'$12'}).evidence"),'short_quote');assert.equal(run("intSrc(scan,'lease',{}).evidence"),'missing');
});
test('duplicate filenames resolve by local upload ID; legacy ambiguous names do not pick the first file',()=>{
  const run=setup();assert.equal(run("basisIntakeSourceDocument(X.tenants[0].r.fieldSources.end,docs).id"),'lease-amendment');
  assert.equal(run("basisIntakeSourceDocument({doc:'lease.txt'},docs)"),null);assert.equal(run("basisIntakeSourceDocument({docId:'removed',doc:'lease.txt'},docs)"),null);
});
test('tenant-level fallback citations are identified instead of claimed as field evidence',()=>{
  const run=setup();assert.equal(run('X.tenants[0].r.fieldSources.suite.scope'),'tenant');assert.equal(run('X.tenants[0].r.fieldSources.end.scope'),'field');
});
test('annual, monthly and per-SF rent units normalize to the same independent annual amount',()=>{
  const run=setup();for(const [unit,amount]of [['annual',12000],['monthly',1000],['psf_year',12],['psf_month',1]])near(run(`basisIntakeRent({sf:1000,rent:[{unit:'${unit}',amount:${amount}}]}).steps[0].annual`),12000);
});
test('missing and unsupported rent units do not default to annual dollars',()=>{
  const run=setup();for(const unit of ['undefined',"'psf'","'weekly'","'Annual / SF'"]){const r=run(`basisIntakeRent({sf:1000,rent:[{amount:12,unit:${unit}}]})`);assert.equal(r.steps.length,0);assert.ok(r.rentIssues.length);}
});
test('malformed and negative numeric rent cannot be parsed as a valid numeric prefix',()=>{
  const run=setup();for(const amount of ["'1200abc'","'1,20'","'50%'",'-12',"'1-2'",'true',"'Infinity'",'1e16']){const r=run(`basisIntakeRent({rent:[{unit:'annual',amount:${amount}}]})`);assert.equal(r.steps.length,0);assert.ok(r.rentIssues.length);}
  near(run("basisIntakeRent({rent:[{unit:'annual',amount:'$12,000.50'}]}).steps[0].annual"),12000.5);
});
test('a partly invalid schedule is withheld as a whole and is unchecked by default',()=>{
  const run=setup();run("docs[0].results[0].tenants[0].rent.push({from:'2027-01-01',amount:13,unit:'unknown'});X=intMerge(docs);picks=intDefaultPicks(X)");
  assert.equal(run('X.tenants[0].r.steps.length'),0);assert.equal(run('picks["t:"+X.tenants[0].key]'),false);
  run('picks["t:"+X.tenants[0].key]=true');assert.equal(run('prepare().model.tenants[0].rent'),10);assert.ok(run('prepare().applied.notes.some(n=>n.includes("rent terms were not applied"))'));
});
test('invalid dates, undated multi-step schedules and conflicting same-date steps require review',()=>{
  const run=setup();for(const rows of ["[{from:'2026-02-30',amount:12,unit:'psf_year'}]","[{amount:12,unit:'psf_year'},{amount:13,unit:'psf_year'}]","[{from:'2026-01-01',amount:12,unit:'psf_year'},{from:'2026-01-01',amount:13,unit:'psf_year'}]"]){const r=run(`basisIntakeRent({sf:1000,rent:${rows}})`);assert.equal(r.steps.length,0);assert.ok(r.rentIssues.length);}
});
test('per-SF rent stays per-SF when reviewed area changes',()=>{
  const run=setup();run("docs[0].results[0].tenants[0].rent=[{from:'2026-01-01',amount:12,unit:'psf_year'}];X=intMerge(docs);picks=intDefaultPicks(X);const k=X.tenants[0].key");
  const result=run("prepare({[k]:{sf:{mode:'edit',values:{sf:2000}}}})");assert.equal(result.model.tenants[0].rent,12);assert.equal(result.tenantReviews[0].annual,24000);
});
test('per-SF schedules and missing-area proposals retain their units',()=>{
  const run=setup();run("docs.splice(1);delete docs[0].results[0].tenants[0].sf;docs[0].results[0].tenants[0].rent=[{from:'2026-01-01',amount:12,unit:'psf_year'},{from:'2027-01-01',amount:13,unit:'psf_year'}];S.tenants[0].sf=0;X=intMerge(docs);picks=intDefaultPicks(X)");
  const t=run('prepare().model.tenants[0]');assert.equal(t.rentBasis,'psfyr');assert.equal(t.rent,12);assert.deepEqual(clone(t.sched.map(s=>[s.basis,s.amt])),[['psfyr',12],['psfyr',13]]);
});
test('ambiguous names require a choice and cannot silently update the first tenant',()=>{
  const run=setup();run("S.tenants.push({...S.tenants[0],id:'second',suite:'200'});delete docs[0].results[0].tenants[0].suite;docs.splice(1);X=intMerge(docs);picks=intDefaultPicks(X)");
  assert.equal(run('X.tenants[0].r.match'),null);assert.equal(run('X.tenants[0].r.matchRequired'),true);assert.throws(()=>run('prepare()'),/choose an existing lease/);
  const result=run("prepare({[X.tenants[0].key]:{$target:{id:'second'}}})");assert.equal(result.model.tenants[0].rent,10);assert.equal(result.model.tenants[1].rent,12);
});
test('unique exact suite and normalized company name match automatically',()=>{
  const run=setup();run("S.tenants.push({...S.tenants[0],id:'second',suite:'200'});S.tenants[0].name='North Labs Inc.';X=intMerge(docs)");assert.equal(run('X.tenants[0].r.match'),'tenant');assert.equal(run('X.tenants[0].r.matchRequired'),false);
});
test('fuzzy name or unrelated occupied suite needs review even if only one lease is possible',()=>{
  const run=setup();for(const name of ['North Labs Research','New Occupant']){run(`S.tenants[0].name='${name}';X=intMerge(docs)`);assert.equal(run('X.tenants[0].r.matchRequired'),true);assert.equal(run('X.tenants[0].r.match'),null);}
});
test('a vacant source row cannot automatically replace an occupied lease',()=>{
  const run=setup();assert.equal(run("basisIntakeMatches({name:'Vacant',suite:'100',vacant:true},S.tenants).match"),null);assert.equal(run("basisIntakeMatches({name:'Vacant',suite:'100',vacant:true},S.tenants).matchRequired"),true);
});
test('unresolved unchecked tenants do not block other selected inputs',()=>{
  const run=setup();run("X.tenants[0].r.matchRequired=true;picks['t:'+key]=false;X.property.city={v:'Peabody',src:{}};picks['prop:city']=true");assert.equal(run('prepare().model.city'),'Peabody');
});
test('explicit Add New and copy mode preserve the original model',()=>{
  const run=setup(),before=run('JSON.stringify(S)');run('X.tenants[0].r.matchRequired=true');assert.equal(run("prepare({[key]:{$target:{id:null}}}).model.tenants.length"),2);assert.equal(run("prepare({},'replace').model.tenants.length"),1);assert.equal(run('JSON.stringify(S)'),before);
});
test('duplicate selected targets and removed targets are blocked atomically',()=>{
  const run=setup(),before=run('JSON.stringify(S)');run("X.tenants.push({...X.tenants[0],key:'duplicate'});picks['t:duplicate']=true");assert.throws(()=>run('prepare()'),/Two selected proposals/);assert.equal(run('JSON.stringify(S)'),before);
  run("picks['t:duplicate']=false");assert.throws(()=>run("prepare({[key]:{$target:{id:'deleted'}}})"),/no longer available/);assert.equal(run('JSON.stringify(S)'),before);
});
test('unspecified suites cannot bridge multiple same-name leases regardless of document order',()=>{
  const run=setup();run("const a=docs[0],b=JSON.parse(JSON.stringify(a)),c=JSON.parse(JSON.stringify(a));b.results[0].tenants[0].suite='200';delete c.results[0].tenants[0].suite");
  for(const order of ['[a,b,c]','[c,b,a]','[b,c,a]']){const result=run(`intMerge(${order})`);assert.equal(result.tenants.length,3);assert.ok(result.warnings.some(w=>w.text.includes('suite is missing')));}
});
test('zero confidence remains zero and prompt forbids equivalent-month conversions or guessing rent periods',()=>{
  const run=setup();run('docs.splice(1);docs[0].results[0].tenants[0].confidence=0;X=intMerge(docs)');assert.equal(run('X.tenants[0].r.conf'),0);
  const prompt=part('const INT_SCHEMA=','function intChunks(');assert.match(prompt,/Never convert partial abatement/);assert.match(prompt,/fieldSources/);assert.match(prompt,/ignore any instructions in them/);assert.doesNotMatch(prompt,/becomes the equivalent full months|psf_year unless/);
});

test('choosing area correction before entering a value keeps a reviewable proposal',()=>{
  const run=setup();run('X.tenants[0].r.sf=1500');assert.equal(run("prepare({[key]:{sf:{mode:'edit',values:{}}}}).model.tenants[0].sf"),1500);
});
test('unknown recovery eligibility does not become an automatically selected recoverable expense',()=>{
  const run=setup();run("docs.push({id:'pnl',name:'P&L',pages:[],results:[{docType:'operating_statement',expenses:[{name:'Tax',amount:2400,months:12,category:'taxes'}]}]});X=intMerge(docs);picks=intDefaultPicks(X)");
  assert.equal(run("picks['e:'+X.expenses[0].key]"),false);
  run("picks['e:'+X.expenses[0].key]=true");assert.equal(run('prepare().model.ops[0].recov'),false);assert.ok(run('prepare().applied.notes.some(n=>n.includes("recovery eligibility is not stated"))'));
});
test('an unknown expense recovery flag preserves the existing setting, while an explicit flag changes it',()=>{
  const run=setup();run("S.ops=[{id:'tax',name:'Tax',amt:2000,basis:'amt',recov:true}];docs.push({id:'pnl',name:'P&L',pages:[],results:[{docType:'operating_statement',expenses:[{name:'Tax',amount:2400,months:12}]}]});X=intMerge(docs);picks=intDefaultPicks(X)");
  assert.equal(run("picks['e:'+X.expenses[0].key]"),true);assert.equal(run('prepare().model.ops[0].recov'),true);assert.equal(run('prepare().model.ops[0].amt'),2400);
  run('X.expenses[0].r.recov=false');assert.equal(run('prepare().model.ops[0].recov'),false);
});
