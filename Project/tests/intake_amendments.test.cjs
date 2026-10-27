const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/intake/amendment_schedule.json'),'utf8'));
const part=(a,b)=>{const start=html.indexOf(a),end=html.indexOf(b,start);assert.ok(start>=0&&end>start);return html.slice(start,end);};
const clone=x=>JSON.parse(JSON.stringify(x)),near=(n,e)=>assert.ok(Math.abs(n-e)<1e-7,`expected ${e}, received ${n}`);
function setup(){
  const context=vm.createContext({TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer});
  for(const file of ['financial_engine.js','native_codec.js','number_inputs.js','intake_quality.js','intake_reconciliation.js','intake_amendments.js','intake_review.js'])vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),context);
  vm.runInContext(part('function parseMDY(','const DCAL=')+part('function basisIntakeValue(','function basisIntakeComparison(')+part('const iA=v=>','function intGaps()'),context);
  context.fixture=clone(fixture);const run=s=>vm.runInContext(s,context);
  run(`S=blankState();Object.assign(S,{startYear:2026,startMonth:1,years:4,gvRate:0,clRate:0});S.areas[0].sf=1000;S.ops=[];S.infl.forEach(x=>x.rates=[0,0,0,0,0]);
    S.tenants=[{id:'tenant',name:'Harbor Research LLC',suite:'100',sf:1000,start:'2026-01-01',end:'2030-12-31',rent:12,rentBasis:'psfyr',step:0,free:0,rec:S.recs[1].id,mla:S.mlas[0].id,expiry:'Vacate'}];
    function intGaps(){return [];}const docs=fixture.documents;let X,picks,key;
    const merge=()=>{X=intMerge(docs);picks=intDefaultPicks(X);key=X.tenants[0].key;};merge();
    const prepare=(review={},mode='merge')=>intPrepareApply(S,X,picks,mode,review);
    const accept=review=>{const result=prepare(review);basisRequireAmendments(result);return result;};
    const amendment=()=>docs.find(d=>d.id==='amend').results[0].tenants[0];
    const base=()=>docs.find(d=>d.id==='base').results[0].tenants[0];`);
  return run;
}

test('replace-from amendment preserves earlier months and replaces only future steps',()=>{
  const run=setup(),before=run('JSON.stringify(S)'),r=run('accept()'),cash=run('calc(accept().model)');
  assert.deepEqual(clone(r.model.tenants[0].sched.map(s=>s.date)),fixture.expected.stepDates);
  cash.ann.sched.slice(0,4).forEach((n,i)=>near(n,fixture.expected.yearlyRent[i]));cash.monthly.sched.slice(12,24).forEach((n,i)=>near(n,fixture.expected.yearTwoMonthlyRent[i]));assert.equal(run('JSON.stringify(S)'),before);
});
test('listed-step treatment retains unmentioned future rent dates',()=>{
  const run=setup();run("amendment().rentChange.mode='listed_steps';merge()");
  assert.ok(run("accept().model.tenants[0].sched.some(s=>s.date==='2028-01-01'&&s.amt===14400)"));near(run('calc(accept().model).ann.sched[2]'),14400);
});
test('a complete amendment can establish rent from commencement without a base lease',()=>{
  const run=setup();run("docs.splice(0,1);amendment().rent=[{from:'2026-01-01',amount:24000,unit:'annual'}];amendment().rentChange={mode:'complete',effectiveDate:'2026-01-01'};S.tenants=[];merge()");
  // The amendment must state the dates/area as well when creating a new lease.
  run("Object.assign(X.tenants[0].r,{sf:1000,start:'2026-01-01',end:'2030-12-31'})");near(run('calc(accept().model).ann.sched[0]'),24000);
});
test('an isolated future amendment retains the existing flat rent before its date',()=>{
  const run=setup();run('docs.splice(0,1);merge()');near(run('calc(accept().model).ann.sched[0]'),12000);near(run('calc(accept().model).ann.sched[1]'),15000);
});
test('existing annual escalation is retained up to a replacement date',()=>{
  const run=setup();run('docs.splice(0,1);S.tenants[0].step=.1;merge()');near(run('calc(accept().model).ann.sched[1]'),15600);near(run('calc(accept().model).ann.sched[2]'),18000);
});
test('base-document percentage escalation is expanded only before replacement',()=>{
  const run=setup();run("base().rent.splice(1);base().escalation={type:'pct',value:.1};merge()");near(run('calc(accept().model).ann.sched[1]'),15600);
});
test('fixed per-SF escalation from a documented base survives before replacement',()=>{
  const run=setup();run("base().rent=[{from:'2026-01-01',amount:12,unit:'psf_year'}];base().escalation={type:'fixed_psf',value:1};merge()");near(run('calc(accept().model).ann.sched[1]'),15500);
});
test('pre-commencement native steps are not overwritten by the inactive flat input',()=>{
  const run=setup();run("docs.splice(0,1);S.tenants[0].sched=[{date:'2025-01-01',mode:'date',basis:'yramt',amt:9600}];merge()");near(run('calc(accept().model).ann.sched[0]'),9600);
});
test('existing absolute mixed-unit schedules retain the same earlier cash flow',()=>{
  const run=setup();run("docs.splice(0,1);S.tenants[0].sched=[{date:'2026-01-01',mode:'date',basis:'moamt',amt:1000},{date:'2027-01-01',mode:'date',basis:'psfyr',amt:13.2}];merge()");near(run('calc(accept().model).ann.sched[1]'),15600);
});
test('multiple amendments use execution dates, independently of upload order and confidence',()=>{
  for(const reverse of [false,true]){const run=setup();run("const later=JSON.parse(JSON.stringify(docs[1]));later.id='later';later.name='Amendment 2';later.results[0].amendmentDate='2027-10-01';Object.assign(later.results[0].tenants[0],{confidence:.1,rentChange:{mode:'replace_from',effectiveDate:'2028-07-01'},rent:[{from:'2028-07-01',amount:21000,unit:'annual'}]});amendment().confidence=.99;docs.push(later)");if(reverse)run('docs.reverse()');run('merge()');near(run('calc(accept().model).ann.sched[2]'),19500);near(run('calc(accept().model).ann.sched[3]'),21000);}
});
test('exact duplicate chunks of the same amendment do not create duplicate steps',()=>{
  const run=setup();run('docs[1].results.push(JSON.parse(JSON.stringify(docs[1].results[0])));merge()');assert.equal(run('accept().model.tenants[0].sched.length'),4);
});
test('unclear amendment ordering blocks and is not replaced by confidence or as-of dates',()=>{
  const run=setup();run("const later=JSON.parse(JSON.stringify(docs[1]));later.id='later';delete later.results[0].amendmentDate;later.results[0].asOf='2030-01-01';later.results[0].tenants[0].rent[0].amount=30000;docs.push(later);merge()");assert.equal(run("picks['t:'+key]"),false);run("picks['t:'+key]=true");assert.throws(()=>run('accept()'),/distinct execution dates/);
});
test('same-day conflicting amendments are blocked rather than ordered by provider confidence',()=>{
  const run=setup();run('const other=JSON.parse(JSON.stringify(docs[1]));other.id="other";other.results[0].tenants[0].rent[0].amount=30000;docs.push(other);merge();picks["t:"+key]=true');assert.throws(()=>run('accept()'),/distinct execution dates/);
});
test('missing treatment or invalid effective date retains current rent and blocks Apply',()=>{
  for(const change of ['null',"{mode:'replace_from',effectiveDate:'2027-02-30'}","{mode:'guessed',effectiveDate:'2027-07-01'}"]){const run=setup();run(`amendment().rentChange=${change};merge();picks['t:'+key]=true`);const result=run('prepare()');assert.equal(result.model.tenants[0].rent,12);assert.ok(result.blocked.length);assert.throws(()=>run('accept()'),/valid effective date/);}
});
test('future complete schedule and mismatched first step cannot backdate new rent',()=>{
  for(const change of ["{mode:'complete',effectiveDate:'2027-07-01'}","{mode:'replace_from',effectiveDate:'2027-01-01'}"]){const run=setup();run(`amendment().rentChange=${change};merge()`);assert.throws(()=>run('accept()'));near(run('calc(prepare().model).ann.sched[0]'),12000);}
});
test('missing earlier rent cannot create a zero-dollar history in a new tenant',()=>{
  const run=setup();run('docs.splice(0,1);S.tenants=[];Object.assign(amendment(),{sf:1000,start:"2026-01-01",end:"2030-12-31"});merge()');assert.throws(()=>run('accept()'),/Earlier rent is missing/);
});
test('advanced native CPI, changing area, relative and additive steps remain intact when blocked',()=>{
  for(const setting of ["cpi:'cpi'","areaSched:[{date:'2027-01-01',sf:1200}]","sched:[{date:'2027-01-01',basis:'pct',amt:.1}]","sched:[{date:'2027-01-01',type:'step',basis:'yramt',amt:1000}]"]){const run=setup();run(`docs.splice(0,1);Object.assign(S.tenants[0],{${setting}});merge()`);const before=run('JSON.stringify(S)');assert.throws(()=>run('accept()'));assert.equal(run('JSON.stringify(S)'),before);}
});
test('listed-step changes with ongoing source or native escalation require a complete correction',()=>{
  for(const native of [false,true]){const run=setup();run("amendment().rentChange.mode='listed_steps'");if(native)run('docs.splice(0,1);S.tenants[0].step=.03');else run("base().rent.splice(1);base().escalation={type:'pct',value:.03}");run('merge()');assert.throws(()=>run('accept()'),/escalation/);}
});
test('an escalation-only amendment is flagged rather than silently discarded',()=>{
  const run=setup();run("delete amendment().rent;amendment().escalation={type:'pct',value:.05};merge()");assert.equal(run('X.tenants[0].r.rentChanges.length'),1);run("picks['t:'+key]=true");assert.throws(()=>run('accept()'),/missing rent steps/);
});
test('keeping current rent explicitly resolves a blocked amendment without losing other fields',()=>{
  const run=setup();run("delete amendment().rentChange;amendment().end='2032-12-31';merge();picks['t:'+key]=true");const r=run("accept({[key]:{rent:{mode:'keep'}}})");assert.equal(r.model.tenants[0].rent,12);assert.equal(r.model.tenants[0].end,'2032-12-31');
});
test('a complete manual rent schedule resolves a blocker but merely opening Correct does not',()=>{
  const run=setup();run("delete amendment().rentChange;merge();picks['t:'+key]=true");assert.throws(()=>run("accept({[key]:{rent:{mode:'edit',values:{}}}})"));
  near(run("calc(accept({[key]:{rent:{mode:'edit',values:{rent:20,rentBasis:'psfyr',sched:[]}}}}).model).ann.sched[0]"),20000);
});
test('combined rent review and source logs retain both base and amended evidence',()=>{
  const run=setup(),r=run('accept()'),sources=r.tenantReviews[0].fieldSources.steps;assert.ok(sources.some(s=>s.docId==='base'));assert.ok(sources.some(s=>s.docId==='amend'));
  const entry=r.model.srcLog.find(s=>s.target.endsWith(' · rent schedule'));assert.ok(entry.sources.some(s=>s.docId==='base'));assert.ok(entry.sources.some(s=>s.docId==='amend'));
});
test('dated later amendments outrank earlier expiry statements without trusting confidence',()=>{
  const run=setup();run("amendment().end='2031-12-31';amendment().confidence=.99;const later=JSON.parse(JSON.stringify(docs[1]));later.id='later';later.results[0].amendmentDate='2027-01-01';Object.assign(later.results[0].tenants[0],{end:'2033-12-31',confidence:.1});delete later.results[0].tenants[0].rent;delete later.results[0].tenants[0].rentChange;docs.push(later);merge()");assert.equal(run('accept().model.tenants[0].end'),'2033-12-31');
});
function recovery(){const run=setup();run("delete amendment().rent;delete amendment().rentChange;base().recovery={type:'base_year',baseYear:2024,adminFeePct:.1,grossUpPct:.95,capPct:.05,capCumulative:false};amendment().recovery={adminFeePct:0,capPct:0};amendment().recoveryChange={mode:'patch',effectiveDate:'2026-01-01'};merge()");return run;}
test('a partial recovery amendment preserves base year, gross-up and unmodified terms',()=>{
  const run=recovery(),r=run('accept()'),t=r.model.tenants[0],rec=r.model.recs.find(s=>s.id===t.rec);assert.equal(t.baseYear,'2024');assert.equal(rec.method,'STOP');assert.equal(rec.grossUp,.95);assert.equal(rec.adminFee,0);assert.equal(rec.capPct||0,0);
});
test('a partial recovery amendment can retain a supported existing native structure',()=>{
  const run=recovery();run("delete base().recovery;const rec=S.recs[0];Object.assign(rec,{method:'STOP',adminFee:.1,grossUp:.9,capPct:.05,capType:'noncum'});S.tenants[0].rec=rec.id;S.tenants[0].baseYear='2023';merge()");const r=run('accept()');assert.equal(r.model.tenants[0].baseYear,'2023');assert.equal(r.model.recs.find(x=>x.id===r.model.tenants[0].rec).grossUp,.9);
});
test('removing a recovery fee produces the independently expected monthly reimbursement',()=>{
  const run=recovery();run("base().recovery={type:'nnn',adminFeePct:.1,grossUpPct:1};S.ops=[{id:'tax',name:'Tax',amt:2400,basis:'amt',recov:true,fixedPct:1,infl:0}];merge()");near(run('calc(accept().model).monthly.reimb[0]'),200);near(run('calc(accept().model).ann.reimb[0]'),2400);
});
test('a stop patch retains its stop amount and allows explicit false cumulative caps',()=>{
  const run=recovery();run("base().recovery={type:'expense_stop',stopPSF:12,capPct:.05,capCumulative:true};amendment().recovery={capCumulative:false};merge()");const r=run('accept()'),rec=r.model.recs.find(x=>x.id===r.model.tenants[0].rec);assert.equal(rec.stopAmt,12);assert.equal(rec.capPct,.05);assert.equal(rec.capType,'noncum');
});
test('future recovery changes do not retroactively change earlier modeled months',()=>{
  const run=recovery();run("amendment().recoveryChange.effectiveDate='2026-07-01';merge()");const before=run('S.tenants[0].rec');assert.throws(()=>run('accept()'),/after the analysis begins/);assert.equal(run('prepare().model.tenants[0].rec'),before);assert.doesNotThrow(()=>run("accept({[key]:{rec:{mode:'keep'}}})"));
});
test('missing recovery timing, method changes and incomplete replacement clauses are blocked',()=>{
  for(const action of ["delete amendment().recoveryChange","amendment().recovery.type='nnn'","amendment().recoveryChange.mode='replace'"]){const run=recovery();run(action+';merge();picks["t:"+key]=true');assert.throws(()=>run('accept()'));}
});
test('custom native recovery pools and line rules are preserved rather than flattened',()=>{
  for(const extra of ["pool:'custom'","lines:[{method:'NNN'}]","denom:'occupied'"]){const run=recovery();run(`delete base().recovery;S.tenants[0].rec=S.recs[0].id;Object.assign(S.recs[0],{${extra}});merge()`);const before=run('JSON.stringify(S.recs)');assert.throws(()=>run('accept()'),/custom pools/);assert.equal(run('JSON.stringify(S.recs)'),before);}
});
test('a manual existing recovery choice resolves a blocker without mutating shared structures',()=>{
  const run=recovery();run("amendment().recoveryChange.effectiveDate='2027-01-01';merge()");const before=run('JSON.stringify(S.recs)');assert.doesNotThrow(()=>run("accept({[key]:{rec:{mode:'edit',values:{rec:S.recs[0].id}}}})"));assert.equal(run('JSON.stringify(S.recs)'),before);
});
test('recovery patches preserve zero and reject impossible percentages or conflicting amount units',()=>{
  for(const recovery of ["{adminFeePct:50}","{grossUpPct:-1}","{type:'expense_stop',stopAmount:12000}"]){const run=recoverySetup();run(`amendment().recovery=${recovery};merge()`);assert.throws(()=>run('accept()'));}
  function recoverySetup(){const run=recovery();run("base().recovery={type:'expense_stop',stopPSF:12}");return run;}
});
test('new copy mode does not borrow rent history from a property it leaves unchanged',()=>{
  const run=setup();run('docs.splice(0,1);Object.assign(amendment(),{sf:1000,start:"2026-01-01",end:"2030-12-31"});merge()');const result=run("prepare({},'replace')");assert.ok(result.blocked.some(s=>s.includes('Earlier rent is missing')));
});

test('recovery timing uses the analysis date selected in the same import',()=>{
  const run=recovery();run("X.valuation.analysisStart={v:'2025-01-01',src:{}};picks['v:analysisStart']=true");assert.throws(()=>run('accept()'),/after the analysis begins/);
  run("X.valuation.analysisStart.v='2027-01-01';amendment().recoveryChange.effectiveDate='2026-07-01';merge();X.valuation.analysisStart={v:'2027-01-01',src:{}};picks['v:analysisStart']=true");assert.doesNotThrow(()=>run('accept()'));
});

test('mixed dated and undated scalar candidates have a stable ordering, not a cyclic comparator',()=>{
  const run=setup();run("const rows=[{pri:7,conf:.9,amendmentDate:'2026-01-01',src:{docType:'amendment'},name:'early'},{pri:7,conf:.1,amendmentDate:'2027-01-01',src:{docType:'amendment'},name:'late'},{pri:7,conf:.5,amendmentDate:null,src:{docType:'amendment'},name:'undated'}]");
  const expected=['early','undated','late'];for(const order of ['rows','[rows[2],rows[0],rows[1]]','[rows[1],rows[2],rows[0]]'])assert.deepEqual(clone(run(`basisAmendmentCandidates(${order},'end').map(r=>r.name)`)),expected);
});
test('duplicate recovery chunks ignore object-key order without losing explicit zero',()=>{
  const run=recovery();run("docs[1].results.push(JSON.parse(JSON.stringify(docs[1].results[0])));docs[1].results[1].tenants[0].recovery={capPct:0,adminFeePct:0};merge()");assert.doesNotThrow(()=>run('accept()'));
});

test('an uploaded base lease does not bypass CPI or changing-area amendment safeguards',()=>{
  for(const setting of ["S.tenants[0].cpi='CPI'","S.tenants[0].areaSched=[{date:'2027-01-01',sf:1200}]","base().escalation={type:'cpi'}"]){const run=setup();run(setting+';merge()');assert.throws(()=>run('accept()'),/manual amendment review/);}
});
