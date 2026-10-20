const assert=require('node:assert/strict'),path=require('node:path'),cp=require('node:child_process');
const {test}=require('node:test');
const {runPython,VERSION_PROBE}=require('../scripts/run-python.cjs');
const probe=version=>({status:0,stdout:version});
const missing=()=>({status:null,error:Object.assign(Error('Not found'),{code:'ENOENT'})});
function fixture(responses,options={}){
  const calls=[],messages=[];
  return {calls,messages,run(args=['-c','print("fixture")']){
    return runPython(args,{platform:'linux',env:{},cwd:'/fixture',stderr:{write:message=>messages.push(message)},
      spawnSync:(command,args,config)=>{calls.push({command,args,config});const response=responses.shift();
        if(response instanceof Error)throw response;if(response===undefined)throw Error('Unexpected extra spawn');return response;},...options});
  }};
}

test('POSIX chooses python3 first and forwards each argument without shell interpretation',()=>{
  const f=fixture([probe('3.12'),{status:0}]),args=['script with spaces.py','$(not-a-command)','a; b','*browser_test.py'];
  assert.equal(f.run(args),0);assert.deepEqual(f.calls.map(call=>call.command),['python3','python3']);
  assert.deepEqual(f.calls[0].args,['-c',VERSION_PROBE]);assert.deepEqual(f.calls[1].args,args);
  assert.equal(f.calls[0].config.shell,false);assert.equal(f.calls[0].config.timeout,5000);
  assert.equal(f.calls[0].config.maxBuffer,4096);assert.equal(f.calls[1].config.shell,false);assert.equal(f.calls[1].config.stdio,'inherit');
});

test('POSIX falls back to python when python3 is missing or too old',()=>{
  for(const first of [missing(),probe('3.9'),probe('2.7')]){
    const f=fixture([first,probe('3.10'),{status:0}]);assert.equal(f.run(),0);
    assert.deepEqual(f.calls.map(call=>call.command),['python3','python','python']);
  }
});

test('macOS supports an installation that exposes only python3',()=>{
  const f=fixture([probe('3.13'),{status:0}],{platform:'darwin'});assert.equal(f.run(),0);
  assert.deepEqual(f.calls.map(call=>call.command),['python3','python3']);
});

test('Windows chooses python before trying the py launcher',()=>{
  const f=fixture([probe('3.12'),{status:0}],{platform:'win32'});assert.equal(f.run(),0);
  assert.deepEqual(f.calls.map(call=>call.command),['python','python']);
});

test('Windows py fallback retains its -3 selector for probing and the real command',()=>{
  const f=fixture([missing(),probe('3.11'),{status:0}],{platform:'win32'}),args=['-m','unittest','discover'];
  assert.equal(f.run(args),0);assert.deepEqual(f.calls.map(call=>call.command),['python','py','py']);
  assert.deepEqual(f.calls[1].args,['-3','-c',VERSION_PROBE]);assert.deepEqual(f.calls[2].args,['-3',...args]);
});

test('Windows tries python3 after unavailable python and py candidates',()=>{
  const f=fixture([missing(),missing(),probe('3.14'),{status:0}],{platform:'win32'});assert.equal(f.run(),0);
  assert.deepEqual(f.calls.map(call=>call.command),['python','py','python3','python3']);
});

test('BASIS_PYTHON uses one exact executable path including spaces',()=>{
  const command='C:\\Program Files\\Python312\\python.exe',env={BASIS_PYTHON:command,PATH:'unchanged'};
  const f=fixture([probe('3.12'),{status:0}],{platform:'win32',env});assert.equal(f.run(),0);
  assert.deepEqual(f.calls.map(call=>call.command),[command,command]);assert.equal(f.calls[0].config.env,env);assert.equal(f.calls[1].config.env,env);
});

test('an unavailable or old explicit interpreter fails without trying other installations',()=>{
  for(const response of [missing(),probe('3.8')]){
    const f=fixture([response],{env:{BASIS_PYTHON:'/specific/python'}});assert.equal(f.run(),2);
    assert.equal(f.calls.length,1);assert.match(f.messages.join(''),/Python 3\.10/);
  }
});

test('empty explicit paths and missing arguments fail before any process is started',()=>{
  const f=fixture([],{env:{BASIS_PYTHON:''}});assert.equal(f.run(),2);assert.equal(f.calls.length,0);
  const other=fixture([]);assert.equal(other.run([]),2);assert.equal(other.calls.length,0);assert.match(other.messages.join(''),/Usage:/);
});

test('timed-out, malformed and failed probes are bounded and do not qualify an interpreter',()=>{
  for(const bad of [{status:null,error:Object.assign(Error('Timed out'),{code:'ETIMEDOUT'})},
    {status:1,stdout:'3.12'},probe('not Python'),probe('3.9.99'),new Error('Probe could not start')]){
    const f=fixture([bad,probe('3.12'),{status:0}]);assert.equal(f.run(),0);
    assert.equal(f.calls[0].config.timeout,5000);assert.equal(f.calls[1].command,'python');
  }
});

test('a nonzero test exit status is forwarded without any interpreter retry',()=>{
  const f=fixture([probe('3.12'),{status:23}]);assert.equal(f.run(),23);assert.equal(f.calls.length,2);
});

test('a real command launch error is reported without re-probing another Python',()=>{
  const f=fixture([probe('3.12'),missing()]);assert.equal(f.run(),127);assert.equal(f.calls.length,2);
  const thrown=fixture([probe('3.12'),new Error('Execution failed')]);assert.equal(thrown.run(),1);assert.equal(thrown.calls.length,2);
});

test('signal termination has a nonzero conventional exit status without retry',()=>{
  const f=fixture([probe('3.12'),{status:null,signal:'SIGTERM'}]);assert.equal(f.run(),143);assert.equal(f.calls.length,2);
});

test('no supported Python produces an actionable setup failure',()=>{
  const f=fixture([missing(),probe('3.8')]);assert.equal(f.run(),2);assert.equal(f.calls.length,2);
  assert.match(f.messages.join(''),/set BASIS_PYTHON/);
});

test('the actual local launcher forwards output and the selected Python exit status',()=>{
  const script=path.join(__dirname,'../scripts/run-python.cjs');
  const result=cp.spawnSync(process.execPath,[script,'-c',
    'import json,sys;print(json.dumps(sys.argv[1:]));sys.exit(7)','argument with spaces','*browser_test.py','$(literal)'],{encoding:'utf8',shell:false});
  assert.equal(result.error,undefined);assert.equal(result.status,7,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),['argument with spaces','*browser_test.py','$(literal)']);
});
