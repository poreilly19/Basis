const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const ctx=vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const $='),html.indexOf('/* =========================== PROPERTY FILE')),ctx);
vm.runInContext(html.slice(html.indexOf('const rTenName='),html.indexOf('function rWALT(')),ctx);
vm.runInContext(fs.readFileSync(path.join(root,'src/report_export.js'),'utf8'),ctx);
const api=vm.runInContext('({blankState,calc,basisBuildReportPackage,basisReportToXlsx})',ctx);
function model(){
 const s=api.blankState();Object.assign(s,{name:'Beta Fixture',startYear:2026,startMonth:4,years:2,gvRate:0,clRate:0,inflExp:0,inflRent:0,inflCPI:0,priceMode:'amount',price:120000,exitCap:.08,costSale:0,discount:.1,loanOn:false});
 s.infl.forEach(i=>i.rates=[0,0,0,0]);s.areas=[{id:'a',name:'Building',sf:1000,basis:true}];
 s.tenants=[{id:'t',name:'Tenant',suite:'001',sf:1000,start:'2026-04',end:'2035-12',rent:12,step:0,free:0,rec:s.recs[1].id,mla:s.mlas[0].id,expiry:'Vacate'}];
 s.ops=[{id:'o',name:'Operating Costs',amt:2400,basis:'amt',fixedPct:1,infl:0,recov:false}];return s;
}
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} differs from ${expected}`);
const report=s=>api.basisBuildReportPackage(s,api.calc(s),{portfolio:'Fixture Portfolio',scenario:'Base',generatedAt:'2026-10-27T00:00:00.000Z'});
const rows=(p,name)=>p.sheets.find(s=>s.name===name).rows;
const row=(p,name,label)=>rows(p,name).find(r=>r[0]===label);
test('report workbook has all original report sheets and explicit guide/input tables',()=>{
 const p=report(model());assert.deepEqual(Array.from(p.sheets,s=>s.name),['README','Property Summary','Tenant Rent Roll','Tenant Summary','Cash Flow','All Terms Report','Input Assumptions']);
 assert.equal(row(p,'README','Portfolio')[1],'Fixture Portfolio');assert.match(row(p,'README','Interchange')[1],/Report workbook only/);
});
test('independent flat rent/expense case exports raw dollars and correct signs',()=>{
 const p=report(model());row(p,'Cash Flow','Base Rental Revenue').slice(1).forEach(v=>close(v,12000));
 row(p,'Cash Flow','Operating Costs').slice(1).forEach(v=>close(v,-2400));
 row(p,'Cash Flow','Net Operating Income').slice(1).forEach(v=>close(v,9600));
 row(p,'Cash Flow','Cash Flow Before Debt Service').slice(1).forEach(v=>close(v,9600));
 close(row(p,'Property Summary','Year 1 NOI')[1],9600);
 close(rows(p,'Tenant Summary')[1][2],12000);
});
test('reference-only expense and capital records stay out of cash-flow details but remain in assumptions',()=>{
 const s=model();
 s.ops.push({id:'ref-op',name:'Reference Op',amt:9000,basis:'amt',fixedPct:1,infl:0,refOnly:true});
 s.nonops=[{id:'ref-non',name:'Reference Nonop',amt:6000,basis:'amt',infl:0,refOnly:true}];
 s.caps=[{id:'ref-cap',name:'Reference Cap',amt:3000,basis:'amt',infl:0,refOnly:true}];
 const p=report(s);
 for(const name of ['Reference Op','Reference Nonop','Reference Cap']){
  assert.equal(row(p,'Cash Flow',name),undefined);
  assert.ok(rows(p,'Input Assumptions').some(r=>r[1]===name&&r[2]==='refOnly'&&r[3]===true));
 }
 for(let y=1;y<=2;y++){
  close(row(p,'Cash Flow','Total Operating Expenses')[y],-2400);
  close(row(p,'Cash Flow','Total Non-operating Expenses')[y],0);
  close(row(p,'Cash Flow','Total Leasing & Capital Costs')[y],0);
  close(row(p,'Cash Flow','Cash Flow Before Debt Service')[y],9600);
 }
});
test('operating and non-operating ground rent are separate reconciling cash-flow details',()=>{
 const s=model();s.nonops=[{id:'non',name:'Nonop Cost',amt:300,basis:'amt',infl:0}];
 s.groundLeases=[{id:'op',rent:1200,rentBasis:'amt',start:'2026-04',termYears:10,escal:0,treatment:'op'},
  {id:'non',rent:600,rentBasis:'amt',start:'2026-04',termYears:10,escal:0,treatment:'nonop'}];
 const p=report(s);
 for(let y=1;y<=2;y++){
  close(row(p,'Cash Flow','Ground Rent — Operating')[y],-1200);
  close(row(p,'Cash Flow','Total Operating Expenses')[y],-3600);
  close(row(p,'Cash Flow','Net Operating Income')[y],8400);
  close(row(p,'Cash Flow','Ground Rent — Non-operating')[y],-600);
  close(row(p,'Cash Flow','Total Non-operating Expenses')[y],-900);
  close(row(p,'Cash Flow','Cash Flow Before Debt Service')[y],7500);
 }
});
test('cash-flow subtotals reconcile signed credits, ground rent, leasing costs, capital and debt',()=>{
 const s=model();s.ops.push({id:'credit',name:'Expense Credit',amt:-120,basis:'amt',fixedPct:1,infl:0});
 s.nonops=[{id:'non',name:'Nonop Cost',amt:600,basis:'amt',infl:0}];
 s.caps=[{id:'cap',name:'Capital Project',amt:1200,basis:'amt',infl:0}];
 s.groundLeases=[{id:'op',rent:240,rentBasis:'amt',start:'2026-04',termYears:10,treatment:'op'},
  {id:'non',rent:120,rentBasis:'amt',start:'2026-04',termYears:10,treatment:'nonop'}];
 Object.assign(s.tenants[0],{tiBasis:'amt',tiAmt:600,lcBasis:'amt',lcAmt:360,incBasis:'amt',incAmt:240});
 s.loanOn=true;s.loans=[{id:'loan',name:'Interest Only',sizing:'amount',amount:60000,rateType:'fixed',rate:.06,ioAll:true,feePct:0,exitFeePct:0}];
 const p=report(s),at=(label,y)=>row(p,'Cash Flow',label)[y];
 for(let y=1;y<=2;y++){
  close(at('Expense Credit',y),120);
  close(at('Total Operating Expenses',y),-2520);
  close(at('Total Operating Expenses',y),at('Operating Costs',y)+at('Expense Credit',y)+at('Ground Rent — Operating',y));
  close(at('Net Operating Income',y),9480);
  close(at('Net Operating Income',y),at('Effective Gross Revenue',y)+at('Total Operating Expenses',y));
  close(at('Total Non-operating Expenses',y),-720);
  close(at('Total Non-operating Expenses',y),at('Nonop Cost',y)+at('Ground Rent — Non-operating',y));
  close(at('Total Leasing & Capital Costs',y),y===1?-2400:-1200);
  close(at('Total Leasing & Capital Costs',y),at('Tenant Improvements',y)+at('Tenant Incentives',y)+at('Leasing Commissions',y)+at('Capital Project',y));
  close(at('Cash Flow Before Debt Service',y),y===1?6360:7560);
  close(at('Cash Flow Before Debt Service',y),at('Net Operating Income',y)+at('Total Non-operating Expenses',y)+at('Total Leasing & Capital Costs',y)+at('Security Deposits — Net',y));
  close(at('Debt Service',y),-3600);
  close(at('Cash Flow After Debt Service',y),y===1?2760:3960);
  close(at('Cash Flow After Debt Service',y),at('Cash Flow Before Debt Service',y)+at('Debt Service',y)+at('Loan Proceeds — Net of Fees',y)+at('Future Funding Draws',y)+at('Loan Repaid at Maturity',y));
 }
});
test('analysis-year headers use the actual start month and keep the forward year out',()=>{
 const p=report(model());assert.deepEqual(Array.from(rows(p,'Cash Flow')[0]),['Metric','Year 1 · 2026-04 to 2027-03','Year 2 · 2027-04 to 2028-03']);
 for(const r of rows(p,'Cash Flow'))assert.equal(r.length,3);
});
test('all rent units stay explicit and per-SF rents retain cents',()=>{
 for(const [basis,value,label]of [['psfyr',12.75,'$ / SF / Year'],['psfmo',1.0625,'$ / SF / Month'],['yramt',12750,'$ / Year'],['moamt',1062.5,'$ / Month']]){
  const s=model();Object.assign(s.tenants[0],{rentBasis:basis,rent:value});const p=report(s),r=rows(p,'Tenant Rent Roll')[1];assert.equal(r[5],value);assert.equal(r[6],label);close(row(p,'Cash Flow','Base Rental Revenue')[1],12750);
 }
});
test('market rent is not misrepresented as a fixed entered amount',()=>{
 const s=model();Object.assign(s.tenants[0],{rentBasis:'mkt',rent:999,rentPct:.8});const r=rows(report(s),'Tenant Rent Roll')[1];assert.equal(r[5],null);assert.equal(r[6],'Market Rent × Share');assert.equal(r[7],.8);
});
test('currency and area labels are explicit without converting entered values',()=>{
 const s=model();s.currency='EUR';s.areaUnit='SM';const p=report(s);
 assert.equal(p.currency,'EUR');assert.equal(p.area,'SM');assert.equal(rows(p,'Tenant Rent Roll')[0][2],'Area SM');
 assert.equal(rows(p,'Tenant Rent Roll')[1][6],'EUR / SM / Year');close(row(p,'Cash Flow','Base Rental Revenue')[1],12000);
});
test('all group memberships, detailed terms, zeros and false values survive export',()=>{
 const s=model();s.tgroups=[{id:'a',name:'Industrial'},{id:'b',name:'Credit'}];Object.assign(s.tenants[0],{groups:['a','b'],noCredit:false,rentSched:[{date:'2027-04',amt:0,type:'set'}]});
 const p=report(s);assert.equal(rows(p,'Tenant Rent Roll')[1].at(-1),'Industrial; Credit');assert.equal(rows(p,'Tenant Summary')[1].at(-1),'Industrial; Credit');
 assert.equal(rows(p,'All Terms Report').find(r=>r[2]==='noCredit')[3],false);assert.equal(rows(p,'All Terms Report').find(r=>r[2]==='rentSched.0.amt')[3],0);
});
test('unavailable IRRs remain blank and core nonfinite values reject',()=>{
 const s=model(),r=api.calc(s);r.irrU=NaN;r.irrL=null;let p=api.basisBuildReportPackage(s,r);assert.equal(row(p,'Property Summary','Unlevered IRR')[1],null);r.pv=Infinity;assert.throws(()=>api.basisBuildReportPackage(s,r),/not finite/);
});
test('building reports never mutates model data or exposes source logs',()=>{
 const s=model();s.srcLog=[{quote:'PRIVATE SOURCE QUOTE'}];const before=JSON.stringify(s);const p=report(s);assert.equal(JSON.stringify(s),before);assert.ok(!JSON.stringify(p).includes('PRIVATE SOURCE QUOTE'));
});
test('oversized Excel text is rejected explicitly instead of silently truncating',()=>{
 const s=model();s.tenants[0].notes='a'.repeat(32768);assert.throws(()=>report(s),/32,767/);
});
