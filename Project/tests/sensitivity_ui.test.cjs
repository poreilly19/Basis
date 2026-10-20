const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const segment=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a,'Sensitivity source boundaries must exist');return html.slice(a,b);};
const helpers=segment('const SENS_INPUTS=','/* =========================== UI PRIMITIVES');
const valueSource=segment('let SENS_VALUE=','/* ---------- REPORTS ---------- */');
const marketSource=segment('// Market-leasing sensitivity: calculate snapshots','if(PANES["valuation.pvset"])');
function setup(){
  const calls=[],cancelled=[],clients=new Map();let handler;
  for(const key of ['value-sensitivity','market-sensitivity','grid-sensitivity'])clients.set(key,{cancel:()=>cancelled.push(key)});
  const node=(tag,attrs={},kids=[])=>({tag,attrs,kids:Array.from(kids),append(...children){this.kids.push(...children);}});
  const context=vm.createContext({TextEncoder,TextDecoder,PANES:{},MODE:'inputs',T1:'valuation',T2:'sens',calcEpoch:0,
    basisCalculationClients:clients,basisCalculationInvalidators:[],document:{getElementById:()=>null},drawPane(){},
    titled:(title,body)=>node('section',{title},[body]),
    basisRunCalculation:(kind,model,key)=>{const call={kind,model:structuredClone(model),key};calls.push(call);return handler(call);}});
  vm.runInContext(fs.readFileSync(path.join(root,'src/financial_engine.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/native_codec.js'),'utf8'),context);
  context.makeNode=node;
  vm.runInContext(`el=makeNode;S=blankState();Object.assign(S,{name:'Sensitivity fixture',startYear:2026,startMonth:1,years:2,gvRate:0,clRate:0,priceMode:'amount',price:120000,exitCap:.08,discount:.10,loanOn:false});
    S.areas=[{id:'area',sf:1000,basis:true}];S.tenants=[{id:'tenant',name:'Tenant',sf:1000,start:'2026-01',end:'2035-12',rent:12,step:0,free:0,rec:S.recs[1].id,mla:S.mlas[0].id,expiry:'Vacate'}];S.ops=[];`,context);
  vm.runInContext(helpers+'\n'+valueSource+'\n'+marketSource,context);
  const run=source=>vm.runInContext(source,context);
  const calculate=model=>{context.inputModel=model;return run('calc(inputModel)');};
  handler=call=>Promise.resolve(calculate(call.model));
  return {context,run,calls,cancelled,calculate,setHandler(fn){handler=fn;}};
}

test('rendering sensitivity panels starts no calculations and returns promise-bearing controls',()=>{
  const {run,calls}=setup();
  const panel=run('PANES["valuation.sens"]()');
  assert.equal(calls.length,0);
  const buttons=[];function visit(node){if(!node||typeof node!=='object')return;if(node.tag==='button')buttons.push(node);for(const child of node.kids||[])visit(child);}visit(panel);
  assert.equal(buttons.length,3);
  assert.deepEqual(buttons.map(b=>b.attrs.text),['Run value sensitivity','Run market sensitivities','Run grids']);
  for(const button of buttons)assert.equal(typeof button.attrs.onclick,'function');
});

test('the original 25-cell value sensitivity preserves all cap/rate steps and direct engine values',async()=>{
  const {run,calls,calculate}=setup();
  const result=await run('sensValueRun()');
  assert.equal(calls.length,25);assert.ok(calls.every(c=>c.kind==='property'&&c.key==='value-sensitivity'));
  for(let ri=0;ri<5;ri++)for(let ci=0;ci<5;ci++){
    const call=calls[ri*5+ci];assert.equal(call.model.exitCap,result.caps[ri]);assert.equal(call.model.discount,result.discs[ci]);
    assert.equal(result.values[ri][ci],calculate(call.model).pv);
  }
  assert.equal(run('SENS_VALUE_RUN'),null);assert.equal(run('S.exitCap'),.08);assert.equal(run('S.discount'),.10);
  const before=calls.length;run('PANES["valuation.sens"]()');assert.equal(calls.length,before,'Cached results render without recalculation');
});

test('market sensitivities preserve fifteen snapshot cases and report outputs',async()=>{
  const {run,calls,calculate}=setup(),result=await run('sensRun()');
  assert.equal(calls.length,15);assert.ok(calls.every(c=>c.key==='market-sensitivity'));
  let index=0;for(const table of result.t)for(const row of table.rows){const expected=calculate(calls[index++].model);assert.equal(row.pv,expected.pv);assert.equal(row.irr,expected.irrU);}
  assert.equal(run('SENS_RUN'),null);
});

test('value and IRR grid retains its original six full calculations and valuation formulas',async()=>{
  const {context,run,calls}=setup(),result=await run('sensGridRun()');
  assert.equal(calls.length,6);assert.ok(calls.every(c=>c.key==='grid-sensitivity'));
  assert.equal(result.complete,true);assert.equal(result.busy,false);assert.equal(result.pv.length,5);assert.equal(result.irr.length,5);
  context.result=result;
  const expected=run(`(() => {const snapshot=JSON.parse(JSON.stringify(S)),base=calc(snapshot),pv=[],irr=[];
    for(const delta of SENS_GRID_STEPS.cap){const flexed=Object.assign({},snapshot,{exitCap:num(snapshot.exitCap)+delta}),r=calc(flexed);
      pv.push(SENS_GRID_STEPS.dr.map(d=>pvFrom(flexed,r.pvM,r.pvA,r.netRev,r.nY,num(snapshot.discount)+d).pv));
      irr.push(SENS_GRID_STEPS.px.map(d=>{const price=base.price*(1+d);return irrFrom(flexed,r.pvM,r.pvA,r.netRev,r.nY,price,closingFor(flexed,price));}));}
    return {pv,irr};})()`);
  assert.deepEqual(structuredClone(result.pv),structuredClone(expected.pv));assert.deepEqual(structuredClone(result.irr),structuredClone(expected.irr));
});

test('explicit cancellation terminates each channel and ignores late replies',async()=>{
  for(const [start,cancel,state,result,key] of [
    ['sensValueRun','sensValueCancel','SENS_VALUE_RUN','SENS_VALUE','value-sensitivity'],
    ['sensRun','sensCancel','SENS_RUN','SENS_RES','market-sensitivity'],
    ['sensGridRun','sensGridCancel','SENS_GRID.busy','SENS_GRID.complete','grid-sensitivity']
  ]){
    const {run,setHandler,cancelled,calls}=setup();let resolve;
    setHandler(()=>new Promise(accept=>{resolve=accept;}));
    const pending=run(start+'()');assert.equal(calls.length,1);run(cancel+'()');resolve({pv:42,irrU:.05,price:100,sf:1000});
    assert.equal(await pending,null);assert.ok(cancelled.includes(key));
    assert.ok(!run(state));assert.ok(!run(result));assert.equal(calls.length,1);
  }
});

test('model invalidation cancels all sensitivity jobs and prevents results from another revision',async()=>{
  const {run,setHandler,cancelled,calls}=setup(),resolve=[];
  setHandler(()=>new Promise(accept=>resolve.push(accept)));
  const pending=[run('sensValueRun()'),run('sensRun()'),run('sensGridRun()')];
  run(`S.name='Different property';calcEpoch++;for(const invalidate of basisCalculationInvalidators)invalidate('Model changed');`);
  for(const accept of resolve)accept({pv:42,irrU:.05,price:100,sf:1000});
  await Promise.all(pending);assert.equal(calls.length,3);assert.equal(cancelled.length,3);
  for(const name of ['SENS_VALUE','SENS_VALUE_RUN','SENS_RES','SENS_RUN','SENS_GRID'])assert.equal(run(name),null);
});

test('snapshot checks block unannounced in-place model mutations',async()=>{
  const {run,setHandler,calls}=setup();let resolve;
  setHandler(()=>new Promise(accept=>{resolve=accept;}));const pending=run('sensValueRun()');
  run('S.tenants[0].rent=999');resolve({pv:42});
  assert.equal(await pending,null);assert.equal(run('SENS_VALUE'),null);assert.equal(run('SENS_VALUE_RUN'),null);assert.equal(calls.length,1);
});

test('worker failures clear busy state and display recoverable errors in every panel',async()=>{
  for(const [start,busy,error] of [['sensValueRun','SENS_VALUE_RUN','SENS_VALUE_ERROR'],['sensRun','SENS_RUN','SENS_ERROR'],['sensGridRun','SENS_GRID.busy','SENS_GRID.error']]){
    const {run,setHandler}=setup();setHandler(()=>{const e=Error('timeout');e.name='TimeoutError';return Promise.reject(e);});
    assert.equal(await run(start+'()'),null);assert.ok(!run(busy));assert.match(run(error),/took too long/);
    run('PANES["valuation.sens"]()');
  }
});
