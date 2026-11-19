'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/financial_engine.js'),'utf8'),context);
const api=vm.runInContext('({blankState,buildDebt,calc,validateModel,basisNormalizeDebtCurve})',context);
function fixture(curve){const s=api.blankState();Object.assign(s,{startYear:2026,startMonth:1,years:2,loanOn:true});
 s.loans=[{id:'loan',name:'Floating loan',sizing:'amount',amount:60000,rateType:'floating',curve,spread:0,ioAll:true}];return s;}
const sum=arr=>Array.from(arr).reduce((a,b)=>a+b,0);
const near=(actual,expected)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<1e-8,`expected ${expected}, received ${actual}`);
test('explicit fractional percent curves produce independently specified interest',()=>{
 const s=fixture('0.5%;0.25%;1%'),d=api.buildDebt(s,36,2,120000,new Float64Array(36));
 // $60,000 principal at 0.5%, 0.25% and 1% gives $300, $150 and $600 annual interest.
 [300,150,600].forEach((expected,y)=>near(sum(d.intM.slice(y*12,y*12+12)),expected));
});
test('legacy unmarked fractions preserve their rates and create a review warning',()=>{
 const s=fixture('0.005;0.0025;1'),d=api.buildDebt(s,36,2,120000,new Float64Array(36));
 [300,150,600].forEach((expected,y)=>near(sum(d.intM.slice(y*12,y*12+12)),expected));
 const issues=[];api.validateModel(s,api.calc(s),(issue,target)=>issues.push({issue,target}));
 assert.ok(issues.some(({issue,target})=>issue.sev==='warn'&&/ambiguous fractional index/.test(issue.msg)&&target?.field==='curve'));
 s.loans[0].curve='0.5%;0.25%;1%';
 assert.ok(!api.validateModel(s,api.calc(s)).some(issue=>/ambiguous fractional index/.test(issue.msg)));
});
test('new percentage input records units explicitly, preserving zero and negative rates',()=>{
 assert.equal(api.basisNormalizeDebtCurve('0.5; 0.25; 1'),'0.5%; 0.25%; 1%');
 assert.equal(api.basisNormalizeDebtCurve('0%; -0.5%; .25 %'),'0%; -0.5%; 0.25%');
 const s=fixture(api.basisNormalizeDebtCurve('0.5;0;1')),d=api.buildDebt(s,36,2,120000,new Float64Array(36));
 [300,0,600].forEach((expected,y)=>near(sum(d.intM.slice(y*12,y*12+12)),expected));
 for(const blank of [undefined,null,'','  '])assert.equal(api.basisNormalizeDebtCurve(blank),'');
});
test('malformed or non-finite rate tokens fail visibly rather than becoming zero or being dropped',()=>{
 for(const input of ['0.5%; junk; 1%','1foo','NaN','Infinity','1e999','%','0.5%%',{},[]]){
  assert.throws(()=>api.basisNormalizeDebtCurve(input),/curve|index|rates/i);
  assert.throws(()=>api.buildDebt(fixture(input),36,2,120000,new Float64Array(36)),/curve|index|rates/i);
 }
});

test('negative interest reconciles with principal and debt service', () => {
  const model = fixture('-0.5%');
  const result = api.calc(model);
  // A $60,000 interest-only loan earns a $25 monthly borrower credit and
  // leaves $60,000 outstanding. The credit is entirely interest.
  for (let month = 0; month < 24; month++) {
    near(result.intM[month], -25);
    near(result.prinM[month], 0);
    near(result.dsM[month], -25);
    near(result.loans[0].prin[month], 0);
    near(result.balM[month], 60000);
  }
  near(result.balEnd, 60000);

  // At -1% per month, a two-month loan of $199 has two payments of $98.01:
  // period 1 interest -$1.99, principal $100; period 2 interest -$0.99, principal $99.
  Object.assign(model.loans[0], {curve: '-12%', amount: 199, ioAll: false, amortYears: 2 / 12});
  const amortizing = api.calc(model);
  for (const [month, interest, principal, closing] of [[0, -1.99, 100, 99], [1, -.99, 99, 0]]) {
    near(amortizing.intM[month], interest);
    near(amortizing.prinM[month], principal);
    near(amortizing.dsM[month], 98.01);
    near(amortizing.balM[month], closing);
  }
});

test('effectively zero coupons pay down a two-year loan over all 24 installments', () => {
  // At either coupon the total interest on $60,000 is less than one cent
  // over the entire loan. Principal is $2,500 each month to the nearest cent.
  for (const curve of ['1e-14%', '-1e-14%']) {
    const model = fixture(curve);
    Object.assign(model.loans[0], {ioAll: false, amortYears: 2});
    const result = api.calc(model);
    for (let month = 0; month < 24; month++) {
      near(result.dsM[month], 2500);
      near(result.balM[month], 60000 - (month + 1) * 2500);
    }
    near(result.balEnd, 0);
  }
});

test('a loan maturing during the reported forward year stops after its balloon', () => {
  const model = fixture('6%');
  Object.assign(model, {years: 1});
  Object.assign(model.loans[0], {termMonths: 14, exitFeePct: .02});
  const result = api.calc(model);
  near(result.balEnd, 61200); // Sale in month 12 would retire the $60,000 loan plus $1,200 exit fee.
  near(result.balloonM[13], 61200);
  near(result.dsTot[1], 600); // Two $300 interest payments in the forward year.
  near(sum(result.dsM.slice(14)), 0);
  near(sum(result.balM.slice(13)), 0);
  near(result.cfads[1], result.ann.cfbds[1] - 600 - 61200);
});
