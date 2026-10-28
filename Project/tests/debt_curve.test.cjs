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
