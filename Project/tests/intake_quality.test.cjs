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

test('capital is placed in its fiscal analysis year rather than its calendar year',()=>{
  const run=setup();run(`S.startMonth=4;X=intMerge([{id:'cap',name:'Capital plan',pages:[],results:[{docType:'budget',capital:[{name:'Roof',amount:12000,date:'2027-01-01'}]}]}]);picks=intDefaultPicks(X)`);
  const result=run('prepare()');assert.equal(result.model.caps[0].amtYears,'12000; 0');
  near(run('calc(prepare().model).ann.cap[0]'),12000);near(run('calc(prepare().model).ann.cap[1]'),0);
  assert.equal(result.model.caps[0].timing,'Jan');const monthly=run('Array.from(calc(prepare().model).monthly.cap).slice(0,12)');
  monthly.forEach((amount,index)=>near(amount,index===9?12000:0));
});
test('selected analysis start controls imported capital and future tenant costs together',()=>{
  const run=setup();run(`X=intMerge([{id:'cap',name:'Capital plan',pages:[],results:[{docType:'budget',capital:[{name:'Roof',amount:12000,date:'2031-01-01'}],valuation:{analysisStart:'2030-04-01'}}]}]);picks=intDefaultPicks(X);picks['v:analysisStart']=true`);
  const result=run('prepare()');assert.deepEqual([result.model.startYear,result.model.startMonth],[2030,4]);assert.equal(result.model.caps[0].amtYears,'12000; 0');
  near(run('calc(prepare().model).ann.cap[0]'),12000);
});
test('capital outside the hold is retained in its actual year and missing dates are disclosed',()=>{
  const run=setup();run(`S.startMonth=4;X=intMerge([{id:'cap',name:'Capital plan',pages:[],results:[{docType:'budget',capital:[{name:'Future Roof',amount:12000,date:'2030-04-01'},{name:'Undated',amount:5000},{name:'Earlier',amount:1000,date:'2026-03-31'}]}]}]);picks=intDefaultPicks(X)`);
  assert.equal(run("picks['c:'+X.capital.find(c=>c.name==='Undated').key]"),false);run("picks['c:'+X.capital.find(c=>c.name==='Undated').key]=true");
  const result=run('prepare()');assert.equal(result.model.caps.length,1);assert.equal(result.model.caps[0].amtYears,'0; 0; 0; 0; 12000; 0');
  assert.ok(result.applied.notes.some(n=>n.includes('after the current hold')));assert.ok(result.applied.notes.some(n=>n.includes('date is missing or invalid')));assert.ok(result.applied.notes.some(n=>n.includes('dated before')));
  near(run('calc(prepare().model).ann.cap[0]'),0);near(run('calc(prepare().model).ann.cap[1]'),0);
});
test('partial profile grants preserve renewal terms, inflation overrides and source categories',()=>{
  const run=setup();run(`S.tis=[{id:'ti',name:'Existing TI',newPSF:10,renewPSF:5,infl:null,inflRef:'lcst',newInflRef:'gen',renewInflRef:'mkt'}];S.lcs=[{id:'lc',name:'Existing LC',newPct:.05,renewPct:.025,basis:'pct',infl:null,inflRef:'lcst'}];S.frees=[{id:'free',name:'Existing Free',newMo:4,renewMo:2}];Object.assign(S.mlas[0],{tiRef:'ti',lcRef:'lc',frRef:'free'});const originalTerms=JSON.stringify([S.tis,S.lcs,S.frees]);X=intMerge([{id:'terms',name:'Terms',pages:[],results:[{docType:'appraisal',market:{profiles:[{name:S.mlas[0].name,tiNewPSF:0,lcNewPct:0,freeRentNew:0}]}}]}]);picks=intDefaultPicks(X)`);
  const model=run('prepare().model'),profile=model.mlas[0],ti=model.tis.find(x=>x.id===profile.tiRef),lc=model.lcs.find(x=>x.id===profile.lcRef),fr=model.frees.find(x=>x.id===profile.frRef);
  assert.deepEqual([ti.newPSF,ti.renewPSF,lc.newPct,lc.renewPct,fr.newMo,fr.renewMo],[0,5,0,.025,0,2]);
  assert.deepEqual([ti.inflRef,ti.newInflRef,ti.renewInflRef,lc.inflRef],['lcst','gen','mkt','lcst']);assert.equal(run('JSON.stringify([S.tis,S.lcs,S.frees])'),run('originalTerms'));
});
test('partial profile grants retain local fallback values when no category is attached',()=>{
  const run=setup();run(`Object.assign(S.mlas[0],{tiRef:'',lcRef:'',frRef:'',tiNewLocal:20,tiRenewLocal:7,lcNewLocal:.04,lcRenewLocal:.02,lcBasisLocal:'pct',frNewLocal:3,frRenewLocal:1});X=intMerge([{id:'terms',name:'Terms',pages:[],results:[{docType:'appraisal',market:{profiles:[{name:S.mlas[0].name,tiRenewPSF:0,lcRenewPct:0,freeRentRenew:0}]}}]}]);picks=intDefaultPicks(X)`);
  const resolved=run('(()=>{const model=prepare().model;return resolveMLA(model.mlas[0],model)})()');assert.deepEqual([resolved.tiNew,resolved.tiRenew,resolved.lcNew,resolved.lcRenew,resolved.frNew,resolved.frRenew],[20,0,.04,0,3,0]);
});
test('a partial percentage commission cannot erase the other side of a per-SF category',()=>{
  const run=setup();run(`S.lcs=[{id:'lc',name:'Per-SF LC',basis:'psf',newPct:5,renewPct:3,infl:null}];S.mlas[0].lcRef='lc';X=intMerge([{id:'terms',name:'Terms',pages:[],results:[{docType:'appraisal',market:{profiles:[{name:S.mlas[0].name,lcNewPct:.05}]}}]}]);picks=intDefaultPicks(X)`);
  const result=run('prepare()');assert.equal(result.model.mlas[0].lcRef,'lc');assert.ok(result.applied.notes.some(n=>n.includes('partial percentage commission')));
  run('X.profiles[0].lcRenewPct=.02');const resolved=run('(()=>{const model=prepare().model;return resolveMLA(model.mlas[0],model)})()');assert.deepEqual([resolved.lcBasis,resolved.lcNew,resolved.lcRenew],['pct',.05,.02]);
});
test('imported annual market rent stays annual for every previous profile rent unit',()=>{
  for(const unit of ['psfmo','yramt','moamt']){const run=setup();run(`S.mlas[0].rentUnit='${unit}';X=intMerge([{id:'terms',name:'Terms',pages:[],results:[{docType:'appraisal',market:{profiles:[{name:S.mlas[0].name,marketRentPSF:24}]}}]}]);picks=intDefaultPicks(X)`);
    const model=run('prepare().model'),profile=model.mlas[0];assert.equal(profile.rentUnit,'psfyr');assert.equal(profile.mrNewRef,'');assert.equal(profile.mrRenewRef,'');near(run('resolveMLA(prepare().model.mlas[0],prepare().model).mktNew'),24);
  }
});
test('plain imported recoveries do not inherit a custom pool or occupied-area denominator',()=>{
  const run=setup();run(`S.ops=[{id:'tax',name:'Taxes',amt:1200,basis:'amt',recov:true,fixedPct:1,infl:0,group:'taxes'},{id:'insurance',name:'Insurance',amt:2400,basis:'amt',recov:true,fixedPct:1,infl:0}];S.recs=[{id:'custom',name:'Tax-only Net',method:'NNN',denom:'occupied',adminFee:0,grossUp:1,fixed:0,pool:'taxes'}];X=intMerge([{id:'lease',name:'Lease',pages:[],results:[{docType:'lease',tenants:[{name:'North Labs LLC',suite:'100',sf:1000,start:'2026-01-01',end:'2030-12-31',recovery:{type:'nnn',grossUpPct:1,adminFeePct:0}}]}]}]);picks=intDefaultPicks(X)`);
  const model=run('prepare().model'),rec=model.recs.find(x=>x.id===model.tenants[0].rec);assert.notEqual(rec.id,'custom');assert.equal(rec.pool,'');assert.equal(rec.denom,'rentable');near(run('calc(prepare().model).ann.reimb[0]'),3600);
});
test('an unstated gross-up uses the importer default instead of reusing another threshold',()=>{
  const run=setup();run(`S.recs=[{id:'half',name:'Different threshold',method:'NNN',denom:'rentable',adminFee:0,grossUp:.5,fixed:0,pool:''}];X=intMerge([{id:'lease',name:'Lease',pages:[],results:[{docType:'lease',tenants:[{name:'North Labs LLC',suite:'100',recovery:{type:'nnn',adminFeePct:0}}]}]}]);picks=intDefaultPicks(X)`);
  const model=run('prepare().model'),rec=model.recs.find(x=>x.id===model.tenants[0].rec);assert.notEqual(rec.id,'half');assert.equal(rec.grossUp,1);
});
test('strict extraction numbers retain exponent signs, accounting negatives and complete grouping',()=>{
  const run=setup();for(const [text,expected]of [['1e-3',.001],['-1e-3',-.001],['1.2e+3',1200],['($1,200.50)',-1200.5],['-$1,200.50',-1200.5],['$-1,200.50',-1200.5],['0',0]])near(run(`iN(${JSON.stringify(text)})`),expected);
  for(const value of ['1,2','1200 square feet','50%','1-2','($-12)','$1.2.3',true,[],{}])assert.equal(run(`iN(${JSON.stringify(value)})`),null);
  for(const [text,expected]of [['3%',.03],['(3%)',-.03],['250%',2.5],['1e-3',.001],['0.5%',.005]])near(run(`iP(${JSON.stringify(text)})`),expected);
  assert.equal(run("iP('$3%')"),null);
});
test('malformed area and money percentages are withheld with source-specific review warnings',()=>{
  const run=setup();run(`docs.splice(1);docs[0].results[0].tenants[0].sf='1,2';X=intMerge(docs);picks=intDefaultPicks(X)`);
  assert.equal(run('X.tenants[0].r.sf'),null);assert.equal(run('picks["t:"+X.tenants[0].key]'),false);assert.ok(run('X.warnings.some(w=>w.text.includes("unsupported numeric text"))'));
  run(`X=intMerge([{id:'debt',name:'Loan terms',pages:[],results:[{docType:'loan_terms',debt:[{name:'Bad amount',amount:'50%',rate:'6%'}]}]}])`);assert.equal(run('X.debt.length'),0);assert.ok(run('X.warnings.some(w=>w.text.includes("debt terms were not proposed"))'));
});
test('valid scientific loan principal and percentage rate remain exact without mutating extraction',()=>{
  const run=setup();run(`const source=[{id:'debt',name:'Loan terms',pages:[],results:[{docType:'loan_terms',debt:[{name:'Loan',amount:'1e6',rate:'6%',amortYears:30,ioMonths:0,termMonths:60,feePct:0}]}]}];const raw=JSON.stringify(source[0].results);X=intMerge(source);picks=intDefaultPicks(X)`);
  assert.equal(run('X.debt[0].amount'),1000000);near(run('X.debt[0].rate'),.06);assert.equal(run('JSON.stringify(source[0].results)'),run('raw'));
});
test('a percentage escalation is normalized once and malformed rules retain current rent',()=>{
  const run=setup();run(`docs.splice(1);docs[0].results[0].tenants[0].escalation={type:'pct',value:'3%'};X=intMerge(docs);picks=intDefaultPicks(X)`);near(run('prepare().model.tenants[0].step'),.03);
  run(`docs[0].results[0].tenants[0].escalation.value='1,2%';X=intMerge(docs);picks=intDefaultPicks(X);picks['t:'+X.tenants[0].key]=true`);assert.equal(run('prepare().model.tenants[0].rent'),10);assert.ok(run('prepare().applied.notes.some(n=>n.includes("rent terms were not applied"))'));
});

test('same-caption expense details from one file cannot silently collapse into one applied cost',()=>{
  const run=setup();run(`const statement={id:'pnl',name:'Operating statement',pages:[],results:[{docType:'operating_statement',reporting:{months:12},expenses:[{name:'Insurance',amount:1200,months:12,basis:'total',recoverable:false},{name:'Insurance',amount:600,months:12,basis:'total',recoverable:false}],totals:{scope:'document',totalOperatingExpenses:1800}}]};X=intMerge([statement]);picks=intDefaultPicks(X)`);
  assert.equal(run("basisIntakeDocumentChecks([statement]).find(c=>c.metric==='totalOperatingExpenses').status"),'match');assert.equal(run('X.expenses[0].r.ambiguousRows'),true);assert.equal(run("picks['e:'+X.expenses[0].key]"),false);assert.equal(run('prepare().model.ops.length'),0);
  run("picks['e:'+X.expenses[0].key]=true");const before=run('JSON.stringify(S)');assert.throws(()=>run('prepare()'),/same-file expense rows need review/);assert.equal(run('JSON.stringify(S)'),before);
});
test('cross-document expense corroboration preserves priority without creating duplicate rows',()=>{
  const run=setup();run(`X=intMerge([{id:'low',name:'OM',pages:[],results:[{docType:'offering_memorandum',expenses:[{name:'Insurance',amount:1200,months:12,basis:'total',recoverable:false}]}]},{id:'high',name:'Budget',pages:[],results:[{docType:'budget',expenses:[{name:'Insurance',amount:1800,months:12,basis:'total',recoverable:false}]}]}]);picks=intDefaultPicks(X)`);
  assert.equal(run('X.expenses.length'),1);assert.equal(run('X.expenses[0].r.ambiguousRows'),false);assert.equal(run('prepare().model.ops[0].amt'),1800);
});
test('an exact repeated expense tied to the same source page and quote remains one reading',()=>{
  const run=setup();run(`const detail={name:'Insurance',amount:1200,months:12,basis:'total',recoverable:false,src:{page:1,quote:'Annual insurance premium is $1,200.'}};X=intMerge([{id:'pnl',name:'Statement',pages:[{n:1,text:'Annual insurance premium is $1,200.'}],results:[{docType:'operating_statement',expenses:[detail,JSON.parse(JSON.stringify(detail))]}]}]);picks=intDefaultPicks(X)`);
  assert.equal(run('X.expenses[0].c.length'),1);assert.equal(run('X.expenses[0].r.ambiguousRows'),false);assert.equal(run('prepare().model.ops[0].amt'),1200);
});
test('a principal-only loan is unchecked and cannot invent rate, amortization or fees on Apply',()=>{
  const run=setup();run(`X=intMerge([{id:'debt',name:'Loan terms',pages:[],results:[{docType:'loan_terms',debt:[{name:'Incomplete Loan',amount:100000}]}]}]);picks=intDefaultPicks(X)`);
  assert.equal(run("picks['d:'+X.debt[0].key]"),false);assert.equal(run('(prepare().model.loans||[]).length'),0);assert.ok(run('X.warnings.some(w=>w.text.includes("loan proposal is unchecked"))'));
  const before=run('JSON.stringify(S)');run("picks['d:'+X.debt[0].key]=true");assert.throws(()=>run('prepare()'),/loan was not applied.*fixed interest rate/);assert.equal(run('JSON.stringify(S)'),before);
});
test('explicit zero-rate interest-only financing retains zero amortization and fees',()=>{
  const run=setup();run(`X=intMerge([{id:'debt',name:'Loan terms',pages:[],results:[{docType:'loan_terms',debt:[{name:'Zero Loan',amount:100000,floating:false,rate:0,amortYears:0,ioMonths:0,termMonths:24,feePct:0}]}]}]);picks=intDefaultPicks(X)`);
  assert.equal(run("picks['d:'+X.debt[0].key]"),true);const loan=run('prepare().model.loans[0]');assert.deepEqual([loan.rate,loan.amortYears,loan.feePct],[0,0,0]);near(run('calc(prepare().model).intM[0]'),0);
});
test('a floating loan without an explicit index curve remains a manual-review proposal',()=>{
  const run=setup();run(`X=intMerge([{id:'debt',name:'Loan terms',pages:[],results:[{docType:'loan_terms',debt:[{name:'Floating Loan',amount:100000,floating:true,index:'SOFR',spread:.025,floor:0,amortYears:30,ioMonths:0,termMonths:60,feePct:0}]}]}]);picks=intDefaultPicks(X)`);
  assert.equal(run("picks['d:'+X.debt[0].key]"),false);run("picks['d:'+X.debt[0].key]=true");assert.throws(()=>run('prepare()'),/explicit floating index curve/);
});
test('an incomplete renewal option cannot invent a five-year term or market rent',()=>{
  const run=setup();run(`Object.assign(S.tenants[0],{optTermYears:3,optTermMonths:0,optRentBasis:'psf',optRentAmt:18});docs.splice(1);docs[0].results[0].tenants[0].renewalOptions=[{count:1}];X=intMerge(docs);picks=intDefaultPicks(X)`);
  assert.equal(run("picks['t:'+X.tenants[0].key]"),false);run("picks['t:'+X.tenants[0].key]=true");const result=run('prepare()'),tenant=result.model.tenants[0];assert.deepEqual([tenant.optTermYears,tenant.optRentBasis,tenant.optRentAmt],[3,'psf',18]);assert.ok(result.applied.notes.some(n=>n.includes('renewal option terms were not applied')));
});
test('an explicit zero fixed option rent remains zero instead of switching to market rent',()=>{
  const run=setup();run(`docs.splice(1);docs[0].results[0].tenants[0].renewalOptions=[{count:1,termYears:3,rent:'fixed_psf',value:0}];X=intMerge(docs);picks=intDefaultPicks(X)`);
  const tenant=run('prepare().model.tenants[0]');assert.deepEqual([tenant.optTermYears,tenant.optRentBasis,tenant.optRentAmt],[3,'psf',0]);
});

test('equal-cost capital projects in different years remain separate dated projects',()=>{
  const run=setup();run(`S.years=5;X=intMerge([{id:'capital',name:'Plan',pages:[],results:[{docType:'budget',capital:[{name:'Roof',amount:12000,date:'2027-01-01'},{name:'Roof',amount:12000,date:'2030-01-01'}]}]}]);picks=intDefaultPicks(X)`);
  assert.equal(run('X.capital.length'),2);assert.equal(run('prepare().model.caps.length'),2);const annual=run('calc(prepare().model).ann.cap');near(annual[1],12000);near(annual[4],12000);near(annual[0],0);
});
test('negative amortization years and fractional or negative loan months cannot be applied',()=>{
  for(const patch of [{amortYears:-30},{ioMonths:-1},{termMonths:-60},{ioMonths:1.5},{termMonths:60.5}]){
    const run=setup();run(`X=intMerge([{id:'debt',name:'Terms',pages:[],results:[{docType:'loan_terms',debt:[{name:'Invalid loan',amount:100000,floating:false,rate:.06,amortYears:30,ioMonths:0,termMonths:60,feePct:0,...${JSON.stringify(patch)}}]}]}]);picks=intDefaultPicks(X)`);
    assert.equal(run("picks['d:'+X.debt[0].key]"),false);run("picks['d:'+X.debt[0].key]=true");assert.throws(()=>run('prepare()'),/loan was not applied.*nonnegative/);
  }
});
test('an unknown recovery type cannot become net recoveries and can be explicitly kept or corrected',()=>{
  const run=setup();run(`docs.splice(1);docs[0].results[0].tenants[0].recovery={type:'unsupported'};X=intMerge(docs);picks=intDefaultPicks(X);const k=X.tenants[0].key;const currentRecovery=S.tenants[0].rec`);
  assert.equal(run("picks['t:'+k]"),false);run("picks['t:'+k]=true");const result=run('prepare()');assert.equal(result.model.tenants[0].rec,run('currentRecovery'));assert.ok(result.tenantReviews[0].amendedGroups.includes('rec'));
  assert.throws(()=>run('basisRequireAmendments(prepare())'),/unsupported recovery type/);
  const kept=run("prepare({[k]:{rec:{mode:'keep'}}})");assert.equal(kept.blocked.length,0);assert.equal(kept.model.tenants[0].rec,run('currentRecovery'));
  const corrected=run("prepare({[k]:{rec:{mode:'edit',values:{rec:S.recs[0].id}}}})");assert.equal(corrected.blocked.length,0);assert.equal(corrected.model.tenants[0].rec,run('S.recs[0].id'));
});
test('multiple existing same-name expense targets require an explicit valid correction',()=>{
  const run=setup();run(`S.ops=[{id:'a',name:'Insurance',amt:1000,basis:'amt',recov:false,fixedPct:1,infl:0},{id:'b',name:'Insurance',amt:500,basis:'amt',recov:false,fixedPct:1,infl:0}];X=intMerge([{id:'budget',name:'Budget',pages:[],results:[{docType:'budget',expenses:[{name:'Insurance',amount:1800,basis:'total',months:12,recoverable:false}]}]}]);picks=intDefaultPicks(X)`);
  assert.equal(run('X.expenses[0].r.ambiguousTargets'),true);assert.equal(run("picks['e:'+X.expenses[0].key]"),false);run("picks['e:'+X.expenses[0].key]=true");const before=run('JSON.stringify(S)');assert.throws(()=>run('prepare()'),/several existing expense lines match/);assert.equal(run('JSON.stringify(S)'),before);
  run("X.expenses[0].r.match='b'");assert.deepEqual(clone(run('prepare().model.ops.map(o=>[o.id,o.amt])')),[['a',1000],['b',1800]]);
  run("X.expenses[0].r.match='not-a-candidate'");assert.throws(()=>run('prepare()'),/valid explicit target/);
});
test('multiple fuzzy expense targets are held without overriding an exact unique match',()=>{
  const run=setup();run(`S.ops=[{id:'a',name:'Common Area Maintenance East',amt:1000,basis:'amt',recov:false,fixedPct:1,infl:0},{id:'b',name:'Common Area Maintenance West',amt:500,basis:'amt',recov:false,fixedPct:1,infl:0}];X=intMerge([{id:'budget',name:'Budget',pages:[],results:[{docType:'budget',expenses:[{name:'Common Area Maintenance',amount:1800,basis:'total',months:12,recoverable:false}]}]}]);picks=intDefaultPicks(X)`);
  assert.equal(run('X.expenses[0].r.ambiguousTargets'),true);run("S.ops.push({id:'exact',name:'Common Area Maintenance',amt:0,basis:'amt',recov:false,fixedPct:1,infl:0});X=intMerge([{id:'budget',name:'Budget',pages:[],results:[{docType:'budget',expenses:[{name:'Common Area Maintenance',amount:1800,basis:'total',months:12,recoverable:false}]}]}]);picks=intDefaultPicks(X)");assert.equal(run('X.expenses[0].r.match'),'exact');assert.equal(run('X.expenses[0].r.ambiguousTargets'),false);assert.equal(run('prepare().model.ops.find(o=>o.id===\'exact\').amt'),1800);
});
