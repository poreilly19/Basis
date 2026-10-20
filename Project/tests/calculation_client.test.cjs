const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'../src/calculation_client.js'),'utf8');

// Events and deadlines are controlled independently of the promise queue. In
// particular, a terminated worker can still deliver an already queued event.
function fixture(options={}){
  const workers=[],timers=new Map();let timerSequence=0;
  const context=vm.createContext({setTimeout:(callback,delay)=>{const id=++timerSequence;timers.set(id,{callback,delay});return id;},
    clearTimeout:id=>timers.delete(id),debtPayoffAt:(loans,index)=>loans.reduce((sum,loan)=>sum+(loan.bal[index]||0)*(1+loan.xf),0)});
  vm.runInContext(source,context);
  const createWorker=()=>{
    const worker={messages:[],terminated:0,postMessage(message){this.messages.push(message);},terminate(){this.terminated++;},
      reply(data){if(this.onmessage)this.onmessage({data});}};
    workers.push(worker);return worker;
  };
  const factory=vm.runInContext('basisCreateCalculationClient',context);
  const client=factory({createWorker,...options});
  return {client,workers,timers,factory,fireTimeout(){const [id,timer]=timers.entries().next().value;timers.delete(id);timer.callback();}};
}
const failsWith=code=>error=>error.code===code;
const request=worker=>worker.messages.at(-1);
function success(worker,result={},extra={}){worker.reply({id:request(worker).id,result,...extra});}

test('property replies retain structured values and regain their loan payoff helper',async()=>{
  const {client,workers,timers}=fixture(),model={name:'Structured inputs',discount:0.08};
  const pending=client.run('property',model),worker=workers[0];
  assert.equal(client.pending,true);assert.equal(worker.messages[0].model,model);
  assert.equal(worker.messages[0].kind,'property');assert.ok(Number.isSafeInteger(worker.messages[0].id)&&worker.messages[0].id>0);
  const result=structuredClone({loans:[{bal:new Float64Array([100,80]),xf:0.02}],cf:new Float64Array([1,Infinity]),ratio:Infinity});
  success(worker,result,{elapsedMs:12.5});
  const actual=await pending;
  assert.equal(actual,result);assert.equal(actual.cf[1],Infinity);assert.equal(actual.ratio,Infinity);
  assert.ok(actual.cf instanceof Float64Array);assert.equal(actual.payoff(1),81.6);
  assert.equal(client.lastElapsedMs,12.5);assert.equal(client.pending,false);assert.equal(timers.size,0);client.dispose();
});

test('a successful worker is reused and an empty portfolio remains null',async()=>{
  const {client,workers}=fixture();let pending=client.run('portfolio',{});success(workers[0],{pv:123});
  assert.equal((await pending).pv,123);
  const firstId=request(workers[0]).id;pending=client.run('portfolio',{});success(workers[0],null);
  assert.equal(await pending,null);assert.equal(workers.length,1);assert.ok(request(workers[0]).id>firstId);
  assert.equal(workers[0].terminated,0);client.dispose();assert.equal(workers[0].terminated,1);
});

test('a newer calculation rejects and terminates the older one before starting',async()=>{
  const {client,workers,timers}=fixture(),old=client.run('portfolio',{name:'Old'});
  const rejected=assert.rejects(old,error=>error.name==='AbortError'&&error.code==='calculation_cancelled');
  const oldWorker=workers[0],lateMessage=oldWorker.onmessage,lateError=oldWorker.onerror,lateCloneError=oldWorker.onmessageerror;
  const fresh=client.run('portfolio',{name:'New'});
  assert.equal(oldWorker.terminated,1);assert.equal(workers.length,2);assert.equal(timers.size,1);
  lateMessage({data:{id:request(oldWorker).id,result:{pv:-1}}});
  lateError({message:'Old failure'});lateCloneError();
  assert.equal(client.pending,true);assert.equal(workers[1].terminated,0);
  success(workers[1],{pv:456});assert.equal((await fresh).pv,456);await rejected;client.dispose();
});

test('cancel is idempotent, clears its deadline and allows a fresh worker',async()=>{
  const {client,workers,timers}=fixture(),pending=client.run('portfolio',{});
  const rejected=assert.rejects(pending,error=>error.name==='AbortError'&&/User stopped/.test(error.message));
  assert.equal(client.cancel('User stopped this calculation.'),true);assert.equal(client.cancel(),false);
  assert.equal(client.pending,false);assert.equal(timers.size,0);assert.equal(workers[0].terminated,1);await rejected;
  const fresh=client.run('portfolio',{});success(workers[1],{pv:20});assert.equal((await fresh).pv,20);client.dispose();
});

test('timeout terminates work, rejects distinctly and permits restart',async()=>{
  const {client,workers,timers,fireTimeout}=fixture({timeoutMs:75}),pending=client.run('portfolio',{});
  assert.equal([...timers.values()][0].delay,75);
  const rejected=assert.rejects(pending,error=>error.name==='TimeoutError'&&error.code==='calculation_timeout');
  const lateMessage=workers[0].onmessage;fireTimeout();await rejected;
  assert.equal(workers[0].terminated,1);assert.equal(client.pending,false);assert.equal(timers.size,0);
  const fresh=client.run('portfolio',{}, {timeoutMs:123});assert.equal([...timers.values()][0].delay,123);
  lateMessage({data:{id:request(workers[0]).id,result:{pv:-1}}});success(workers[1],{pv:30});
  assert.equal((await fresh).pv,30);client.dispose();
});

test('dispose rejects in-flight work and permanently prevents worker creation',async()=>{
  const {client,workers,timers}=fixture(),pending=client.run('portfolio',{});
  const rejected=assert.rejects(pending,error=>error.name==='AbortError'&&/disposed/.test(error.message));
  client.dispose();client.dispose();await rejected;
  assert.equal(client.disposed,true);assert.equal(client.pending,false);assert.equal(workers[0].terminated,1);assert.equal(timers.size,0);
  await assert.rejects(client.run('portfolio',{}),failsWith('disposed'));assert.equal(workers.length,1);
});

test('disposing an idle client terminates its reusable worker',async()=>{
  const {client,workers}=fixture(),pending=client.run('portfolio',{});success(workers[0],{});await pending;
  client.dispose();assert.equal(workers[0].terminated,1);assert.equal(client.disposed,true);
});

test('worker creation failure is explicit and never computes on the caller thread',async()=>{
  let attempts=0;const cause=new Error('Content security policy refused the worker.');
  const {client,timers}=fixture({createWorker(){attempts++;throw cause;}});
  await assert.rejects(client.run('property',{get years(){throw Error('Main-thread calculation attempted');}}),error=>
    error.code==='worker_unavailable'&&error.cause===cause);
  assert.equal(client.pending,false);assert.equal(timers.size,0);
  await assert.rejects(client.run('portfolio',{}),failsWith('worker_unavailable'));assert.equal(attempts,2);client.dispose();
});

test('an invalid worker factory result is rejected and its resources are released',async()=>{
  let terminated=0;const {client}=fixture({createWorker:()=>({terminate(){terminated++;}})});
  await assert.rejects(client.run('portfolio',{}),failsWith('worker_unavailable'));
  assert.equal(terminated,1);assert.equal(client.pending,false);client.dispose();
});

test('input DataCloneError rejects and terminates the worker without poisoning later requests',async()=>{
  const {client,workers,timers}=fixture();const pending=client.run('portfolio',{});success(workers[0],{});await pending;
  const cause=Object.assign(new Error('Cannot clone function.'),{name:'DataCloneError'});
  workers[0].postMessage=()=>{throw cause;};
  await assert.rejects(client.run('property',{callback(){}}),error=>
    error.name==='DataCloneError'&&error.code==='worker_postmessage'&&error.cause===cause);
  assert.equal(timers.size,0);assert.equal(workers[0].terminated,1);assert.equal(client.pending,false);
  const fresh=client.run('portfolio',{});success(workers[1],{pv:40});assert.equal((await fresh).pv,40);client.dispose();
});

test('ordinary postMessage failure rejects explicitly and releases the worker',async()=>{
  const worker={postMessage(){throw Error('Worker is closed.');},terminate(){this.terminated=true;}};
  const {client,timers}=fixture({createWorker:()=>worker});
  await assert.rejects(client.run('portfolio',{}),failsWith('worker_postmessage'));
  assert.equal(worker.terminated,true);assert.equal(timers.size,0);client.dispose();
});

test('worker execution errors are recoverable and cannot cancel a later worker',async()=>{
  const {client,workers}=fixture(),pending=client.run('portfolio',{});let prevented=false;
  const rejected=assert.rejects(pending,error=>error.code==='worker_error'&&error.message==='Unexpected worker failure');
  const oldError=workers[0].onerror;oldError({message:'Unexpected worker failure',preventDefault(){prevented=true;}});
  await rejected;assert.equal(prevented,true);assert.equal(workers[0].terminated,1);
  const fresh=client.run('portfolio',{});oldError({message:'Queued old failure'});success(workers[1],{pv:50});
  assert.equal((await fresh).pv,50);client.dispose();
});

test('messageerror rejects distinctly, removes its deadline and terminates the worker',async()=>{
  const {client,workers,timers}=fixture(),pending=client.run('portfolio',{});
  const rejected=assert.rejects(pending,error=>error.name==='DataCloneError'&&error.code==='worker_messageerror');
  workers[0].onmessageerror({});await rejected;assert.equal(workers[0].terminated,1);assert.equal(timers.size,0);client.dispose();
});

test('wrong, missing and malformed identifiers cannot settle an active calculation',async()=>{
  const {client,workers}=fixture(),pending=client.run('portfolio',{}),worker=workers[0],id=request(worker).id;
  for(const reply of [null,{},'bad',{id:null,result:{}},{id:String(id),result:{}},{id:id+1,result:{}},{id:Infinity,result:{}}])worker.reply(reply);
  assert.equal(client.pending,true);assert.equal(worker.terminated,0);success(worker,{pv:60});assert.equal((await pending).pv,60);client.dispose();
});

test('a completed request cannot supply the result for the next request on a reused worker',async()=>{
  const {client,workers}=fixture(),first=client.run('portfolio',{}),worker=workers[0],oldId=request(worker).id;
  success(worker,{pv:1});await first;
  const second=client.run('portfolio',{});worker.reply({id:oldId,error:{name:'Error',message:'Late error'}});
  worker.reply({id:oldId,result:{pv:-1}});assert.equal(client.pending,true);
  success(worker,{pv:2});assert.equal((await second).pv,2);client.dispose();
});

test('a correlated response must contain exactly one result or error',async()=>{
  for(const body of [{},{result:{},error:{name:'Error',message:'Ambiguous'}},{result:undefined},{result:[]},{result:4}]){
    const {client,workers,timers}=fixture(),pending=client.run('portfolio',{});
    const rejected=assert.rejects(pending,failsWith('worker_protocol'));
    workers[0].reply({id:request(workers[0]).id,...body});await rejected;
    assert.equal(workers[0].terminated,1);assert.equal(client.pending,false);assert.equal(timers.size,0);client.dispose();
  }
});

test('malformed remote errors fail the protocol instead of hanging the request',async()=>{
  for(const error of [null,'failure',{name:'Error'},{name:'Error',message:9},{name:'Error',message:'Invalid model',issues:{}}]){
    const {client,workers}=fixture(),pending=client.run('portfolio',{});
    const rejected=assert.rejects(pending,failsWith('worker_protocol'));
    workers[0].reply({id:request(workers[0]).id,error});await rejected;assert.equal(workers[0].terminated,1);client.dispose();
  }
});

test('ordinary calculation errors retain validation issues and leave the worker reusable',async()=>{
  const {client,workers,timers}=fixture(),pending=client.run('property',{}),issues=['Model: years must be an integer.'];
  const rejected=assert.rejects(pending,error=>error.name==='ValidationError'&&error.message==='Invalid model'&&
    error.code==='calculation_error'&&error.issues===issues);
  workers[0].reply({id:request(workers[0]).id,error:{name:'ValidationError',message:'Invalid model',issues}});await rejected;
  assert.equal(workers[0].terminated,0);assert.equal(timers.size,0);
  const fresh=client.run('portfolio',{});success(workers[0],{});await fresh;assert.equal(workers.length,1);client.dispose();
});

test('custom hydration can restore a result or mutate it in place',async()=>{
  const kinds=[];const {client,workers}=fixture({hydrate(result,kind){kinds.push(kind);result.restored=true;return kind==='property'?{...result,value:2}:undefined;}});
  let pending=client.run('property',{});success(workers[0],{value:1});assert.equal((await pending).value,2);
  pending=client.run('portfolio',{});success(workers[0],{value:3});assert.equal((await pending).restored,true);
  assert.deepEqual(kinds,['property','portfolio']);client.dispose();
});

test('hydration errors reject cleanly and terminate the worker',async()=>{
  const cause=new Error('Unexpected result shape'),{client,workers,timers}=fixture({hydrate(){throw cause;}});
  const pending=client.run('property',{}),rejected=assert.rejects(pending,error=>error.code==='worker_hydration'&&error.cause===cause);
  success(workers[0],{});await rejected;assert.equal(workers[0].terminated,1);assert.equal(timers.size,0);client.dispose();
});

test('AbortSignal cancellation terminates ongoing work and allows reuse of the client',async()=>{
  const {client,workers,timers}=fixture(),controller=new AbortController();
  const pending=client.run('portfolio',{}, {signal:controller.signal});
  const rejected=assert.rejects(pending,error=>error.name==='AbortError'&&error.message==='Route changed');
  controller.abort('Route changed');await rejected;
  assert.equal(workers[0].terminated,1);assert.equal(timers.size,0);
  const fresh=client.run('portfolio',{});success(workers[1],{});await fresh;client.dispose();
});

test('an already aborted request leaves existing work undisturbed',async()=>{
  const {client,workers}=fixture(),pending=client.run('portfolio',{}),controller=new AbortController();controller.abort();
  await assert.rejects(client.run('portfolio',{}, {signal:controller.signal}),error=>error.name==='AbortError');
  assert.equal(workers.length,1);assert.equal(workers[0].terminated,0);assert.equal(client.pending,true);
  success(workers[0],{});await pending;client.dispose();
});

test('settled request abort listeners cannot cancel a subsequent calculation',async()=>{
  const {client,workers}=fixture(),controller=new AbortController(),first=client.run('portfolio',{}, {signal:controller.signal});
  success(workers[0],{});await first;
  const second=client.run('portfolio',{});controller.abort('Late abort');assert.equal(client.pending,true);
  assert.equal(workers[0].terminated,0);success(workers[0],{});await second;client.dispose();
});

test('invalid request options reject before cancelling existing valid work',async()=>{
  const {client,workers}=fixture(),pending=client.run('portfolio',{});
  for(const run of [()=>client.run('unknown',{}),()=>client.run('portfolio',{},null),
    ...[0,-1,NaN,Infinity,2147483648,'10'].map(timeoutMs=>()=>client.run('portfolio',{}, {timeoutMs})),
    ()=>client.run('portfolio',{}, {signal:{aborted:false}})]){
    await assert.rejects(run(),error=>error.name==='TypeError');
  }
  assert.equal(workers.length,1);assert.equal(workers[0].terminated,0);assert.equal(client.pending,true);
  success(workers[0],{});await pending;client.dispose();
});

test('invalid client configuration fails before starting workers',()=>{
  const {factory}=fixture();
  for(const options of [{},{createWorker:5},{createWorker(){},timeoutMs:0},{createWorker(){},timeoutMs:Infinity},
    {createWorker(){},timeoutMs:'20'},{createWorker(){},hydrate:true}])assert.throws(()=>factory(options),error=>error.name==='TypeError');
});

test('malformed timing metadata is ignored without changing the calculation result',async()=>{
  const {client,workers}=fixture();
  for(const elapsedMs of [undefined,-1,NaN,Infinity,'20']){
    const pending=client.run('portfolio',{});success(workers[0],{pv:70},{elapsedMs});assert.equal((await pending).pv,70);
    assert.equal(client.lastElapsedMs,null);
  }
  client.dispose();
});
