const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');

const root=path.join(__dirname,'..');
const engine=fs.readFileSync(path.join(root,'src/financial_engine.js'),'utf8');
const codec=fs.readFileSync(path.join(root,'src/native_codec.js'),'utf8');
const protocol=fs.readFileSync(path.join(root,'src/calculation_worker.js'),'utf8');
function setup(){
  const messages=[],self={postMessage:message=>messages.push(structuredClone(message))};
  const context=vm.createContext({self,TextEncoder,TextDecoder});
  vm.runInContext(engine+'\n'+codec+'\n'+protocol,context,{filename:'basis-worker.js',timeout:10000});
  const run=source=>vm.runInContext(source,context,{timeout:10000});
  const dispatch=request=>{const before=messages.length;self.onmessage({data:structuredClone(request)});assert.equal(messages.length,before+1,'Each request receives exactly one reply');return messages.at(-1);};
  return {context,run,dispatch,self};
}
function fixture(run){return structuredClone(run(`(() => {
  const model=sampleState();model.years=3;model.startYear=2026;model.startMonth=1;
  model.loans=[
    {id:'first',name:'Senior',sizing:'amount',amount:1200000,rateType:'fixed',rate:.05,amortYears:30,ioMonths:3,exitFeePct:.01},
    {id:'later',name:'Delayed funding',sizing:'amount',amount:200000,start:'2027-01',termMonths:12,rateType:'floating',curve:'3 4 5',spread:.02,ioAll:true,exitFeePct:.02}
  ];return model;
})()`));}

test('worker property results preserve every numeric output, typed arrays and shared references',()=>{
  const {context,run,dispatch}=setup(),model=fixture(run),before=structuredClone(model);context.fixture=model;
  const expected=run('calc(fixture)'),payoff=expected.payoff;delete expected.payoff;
  const response=dispatch({id:1,kind:'property',model});
  assert.equal(response.id,1);assert.equal(response.error,undefined);
  assert.ok(Number.isFinite(response.elapsedMs)&&response.elapsedMs>=0);
  assert.deepEqual(response.result,structuredClone(expected));
  assert.equal(Object.hasOwn(response.result,'payoff'),false);
  assert.ok(response.result.monthly.noi instanceof Float64Array);
  assert.equal(response.result.monthly.noi,response.result.noiM);
  assert.equal(response.result.monthly.cfbds,response.result.cfbds);
  assert.equal(response.result.loans[0].maturity,Infinity);
  context.wire=response.result;
  for(let k=0;k<response.result.nM;k++){
    context.month=k;
    assert.equal(run('debtPayoffAt(wire.loans,month)'),payoff(k),`Payoff month ${k}`);
  }
  assert.deepEqual(model,before,'Calculations do not mutate the supplied snapshot');
});

test('worker portfolio results match direct calculation and retain fiscal alignment',()=>{
  const {context,run,dispatch}=setup(),model=fixture(run),second=structuredClone(model);
  second.name='Later property';second.startYear=2027;second.startMonth=7;second.loanOn=false;
  const rollup={portDisc:.075,portCap:.065,portSingleExit:false,portfolio:[{name:'First',include:true,model},{name:'Second',include:true,model:second},{name:'Excluded',include:false}]};
  context.rollup=rollup;
  const response=dispatch({id:2,kind:'portfolio',model:rollup});
  assert.equal(response.error,undefined);
  assert.deepEqual(response.result,structuredClone(run('calcPortfolio(rollup)')));
  assert.equal(response.result.rows[1].offMonths,18);
  assert.equal(dispatch({id:3,kind:'portfolio',model:{portfolio:[]}}).result,null);
});

test('worker rejects invalid ids, unknown kinds and malformed models without executing code',()=>{
  const {run,dispatch}=setup(),model=fixture(run);
  for(const id of [0,-1,1.5,'1',NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
    const response=dispatch({id,kind:'property',model});
    assert.equal(response.id,null);assert.match(response.error.message,/positive safe integer/);assert.equal(response.result,undefined);
  }
  for(const kind of ['eval','constructor','sensitivity',null]){
    const response=dispatch({id:4,kind,model,code:'self.compromised=true'});
    assert.match(response.error.message,/Unsupported calculation request kind/);
  }
  assert.equal(run('self.compromised'),undefined);
  for(const invalid of [{...model,years:1000000},{...model,tenants:{}},null,JSON.parse('{"name":"Unsafe","__proto__":{"bad":true}}')]){
    assert.ok(dispatch({id:5,kind:'property',model:invalid}).error);
  }
  assert.match(dispatch({id:6,kind:'portfolio',model:{portfolio:[{include:'false',model}]}}).error.message,/inclusion flag/);
  assert.match(dispatch({id:7,kind:'portfolio',model:{portfolio:Array(1001).fill({include:false})}}).error.message,/1000-property/);
});

test('worker remains usable after a failed request and does not retain mutable input state',()=>{
  const {run,dispatch}=setup(),model=fixture(run);
  assert.ok(dispatch({id:1,kind:'property',model:{...model,years:0}}).error);
  const first=dispatch({id:2,kind:'property',model});assert.equal(first.error,undefined);
  const changed=structuredClone(model);changed.tenants[0].rent=Number(changed.tenants[0].rent)+10;
  const second=dispatch({id:3,kind:'property',model:changed});assert.equal(second.error,undefined);
  assert.notEqual(second.result.pv,first.result.pv);
  const third=dispatch({id:4,kind:'property',model});assert.equal(third.result.pv,first.result.pv);
});

test('result packing removes only the property payoff and rejects other executable data',()=>{
  const {run}=setup();
  const result=run(`basisWorkerPack({payoff(){return 0;},value:42},'property')`);
  assert.deepEqual(structuredClone(result),{value:42});
  for(const source of [
    `basisWorkerPack({payoff(){},nested:{execute(){}}},'property')`,
    `basisWorkerPack({payoff(){},nested:new Map([['key',()=>0]])},'property')`,
    `basisWorkerPack({payoff(){},nested:new Set([Symbol('key')])},'property')`,
    `basisWorkerPack({payoff(){}},'portfolio')`,
    `basisWorkerPack({payoff(){},nested:new WeakMap()},'property')`
  ])assert.throws(()=>run(source),/unsupported/);
  assert.throws(()=>run(`basisWorkerPack({value:42},'property')`),/payoff function/);
});

test('worker returns bounded named errors and portfolio issue details',()=>{
  const {context,run,dispatch}=setup(),model=fixture(run);
  run(`calcPortfolio=()=>{const error=new RangeError('Portfolio could not be valued');error.issues=['First property: invalid model','Second property: missing inputs'];throw error;}`);
  const response=dispatch({id:1,kind:'portfolio',model:{portfolio:[]}});
  assert.deepEqual(response.error,{name:'RangeError',message:'Portfolio could not be valued',issues:['First property: invalid model','Second property: missing inputs']});
  context.error={name:'N'.repeat(1000),message:'M'.repeat(20000),issues:Array(101).fill('I'.repeat(2000))};
  const bounded=run('basisWorkerError(error)');
  assert.equal(bounded.name.length,100);assert.equal(bounded.message.length,16384);assert.equal(bounded.issues.length,100);assert.equal(bounded.issues[0].length,1000);
  assert.equal(dispatch({id:2,kind:'property',model}).error,undefined);
});

test('worker converts a postMessage clone failure into a named error reply',()=>{
  const {run,dispatch,self}=setup(),model=fixture(run),post=self.postMessage;
  self.postMessage=message=>{if(Object.hasOwn(message,'result')){const error=Error('Could not clone result');error.name='DataCloneError';throw error;}post(message);};
  const response=dispatch({id:1,kind:'property',model});
  assert.equal(response.error.name,'DataCloneError');assert.match(response.error.message,/Could not clone/);
});
