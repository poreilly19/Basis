const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'src/desktop_bridge.js'),'utf8'),html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const copy=value=>JSON.parse(JSON.stringify(value));
function setup(invoke,extra={}){
  const local=new Map(),host=invoke?{__TAURI__:{core:{invoke}}}:{};
  const context=vm.createContext({window:host,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,Headers,Response,AbortController,Promise,Map,Set,Date,JSON,Error,
    setTimeout,clearTimeout,btoa:value=>Buffer.from(value,'binary').toString('base64'),console,
    localStorage:{getItem:key=>local.get(key)||null,setItem:(key,value)=>local.set(key,value),removeItem:key=>local.delete(key)},...extra});
  vm.runInContext(source,context);return {context,local,host,run:text=>vm.runInContext(text,context),bridge:vm.runInContext('BASIS_DESKTOP',context)};
}
function backend(initial={}){
  let state={schemaVersion:1,revision:'0',entries:copy(initial)},fail=false;const calls=[];
  const invoke=async(command,args)=>{calls.push({command,args:copy(args)});
    if(command==='desktop_store_read')return copy(state);
    if(command==='desktop_store_commit'){
      if(fail)throw Error('Disk full');if(args.expectedRevision!==state.revision)throw Error('The workspace changed. Reload before saving.');
      const entries=copy(state.entries);for(const key of args.deletes)delete entries[key];Object.assign(entries,args.puts);state={schemaVersion:1,revision:String(Number(state.revision)+1),entries};return copy(state);
    }
    throw Error('Unexpected command '+command);
  };
  return {invoke,calls,state:()=>copy(state),fail:value=>{fail=value;}};
}
function workspace(store){
  let id=0;const alerts=[];
  const env=setup(store.invoke,{crypto:require('node:crypto').webcrypto,uid:()=>String(++id),DataView,Number,String,
    document:{addEventListener(){}},addEventListener(){},$:()=>null,kAlert:value=>alerts.push(value),blankState:()=>({name:'Blank',areas:[],tenants:[],mlas:[]}),
    calc:()=>({sf:100,pv:1000,ann:{noi:[60]}}),mKey:()=>'',num:value=>Number.isFinite(Number(value))?Number(value):0,recalc(){},renderKPI(){},basisRenderContext(){},drawPane(){},
    PANES:{},T1:'property',MODE:'inputs',sampleState:()=>({name:'Sample'}),setMode(){}});
  for(const name of ['scenario_settings.js','native_codec.js'])vm.runInContext(fs.readFileSync(path.join(root,'src',name),'utf8'),env.context);
  vm.runInContext(html.slice(html.indexOf('const PW={'),html.indexOf('/* =========================== PORTFOLIO PAGE')),env.context);
  env.run(`PW.ix={v:1,pfs:[{id:'pf',name:'Desktop',scs:[{id:'base',name:'Base'}]}],props:[]};PW.pf='pf';PW.sc='base';PW.local={open:[],synced:{}};PW._done();PWS.kind='desktop';var S={name:'Active',areas:[],tenants:[],mlas:[]};var R={sf:100,pv:1000,ann:{noi:[60]}};`);
  return {...env,alerts};
}
test('Web edition has no native dependency and never invokes a desktop command',async()=>{
  const {bridge}=setup();assert.equal(bridge.available,false);await assert.rejects(bridge.readSnapshot(),/unavailable in this browser/);
});
test('Native snapshots reject malformed schema and storage keys without resetting data',async()=>{
  for(const value of [{schemaVersion:2,revision:'1',entries:{}},{schemaVersion:1,revision:'1',entries:{'../file':1}},{schemaVersion:1,revision:'',entries:{}}]){
    let reads=0;const {bridge}=setup(async command=>{assert.equal(command,'desktop_store_read');reads++;return value;});await assert.rejects(bridge.readSnapshot(),/invalid/);assert.equal(reads,1);
  }
});
test('Unreadable desktop storage retains its recovery backend for Reload Library',async()=>{
  const store=backend();let unreadable=true;const wrapped={invoke:(command,args)=>{if(unreadable&&command==='desktop_store_read')throw Error('Workspace is corrupt');return store.invoke(command,args);}};
  const {run,context}=workspace(wrapped);context.console={error(){}};await run('pwInit()');assert.equal(run('PWS.kind'),'memory');assert.equal(run('PW.recoverySource.kind'),'desktop');assert.equal(store.state().revision,'0');
  unreadable=false;assert.equal(await run('pwRefreshLibrary()'),true);assert.equal(run('PWS.kind'),'desktop');assert.equal(run('PW.recoverySource'),null);
});
test('Desktop workspace publishes model chunks and index in one native transaction',async()=>{
  const store=backend(),{run}=workspace(store);
  await run(`var ix=pwIxCopy();ix.props.push({id:'p',pf:'pf',sc:'base',name:'Long model'});pwCommit(ix,[{id:'p',saved:1,json:JSON.stringify({name:'Long model',areas:[],tenants:[],mlas:[],note:'X'.repeat(PW_PART+10)})}])`);
  const commits=store.calls.filter(call=>call.command==='desktop_store_commit');assert.equal(commits.length,1);assert.ok(commits[0].args.puts.pw_index);assert.ok(commits[0].args.puts.pwm_p);assert.ok(Object.keys(commits[0].args.puts).some(key=>key.startsWith('pwm_p_')));
  const model=await run(`pwGetModel('p')`);assert.equal(JSON.parse(model.json).note.length,run('PW_PART')+10);
});
test('Desktop model reads capture a single native snapshot for every chunk',async()=>{
  const store=backend(),{run}=workspace(store);await run(`var ix=pwIxCopy();ix.props.push({id:'p',pf:'pf',sc:'base',name:'Chunked'});pwCommit(ix,[{id:'p',saved:1,json:JSON.stringify({name:'Chunked',areas:[],tenants:[],mlas:[],note:'Y'.repeat(PW_PART+20)})}])`);
  const count=store.calls.length;await run(`pwGetModel('p')`);assert.deepEqual(store.calls.slice(count).map(call=>call.command),['desktop_store_read']);
});
test('Native failed writes preserve durable workspace and loaded revision',async()=>{
  const store=backend(),{run}=workspace(store);await run('pwCommit(pwIxCopy())');const prior=store.state(),revision=run('PW.rev');store.fail(true);
  await assert.rejects(run(`pwCommit({...pwIxCopy(),pfs:[{id:'pf',name:'Changed',scs:[{id:'base',name:'Base'}]}]})`),/Disk full/);assert.deepEqual(store.state(),prior);assert.equal(run('PW.rev'),revision);
});
test('Native rewrites and deletions remove obsolete model chunks in the index transaction',async()=>{
  const store=backend(),{run}=workspace(store);await run(`var ix=pwIxCopy();ix.props.push({id:'p',pf:'pf',sc:'base',name:'Chunked'});pwCommit(ix,[{id:'p',saved:1,json:JSON.stringify({name:'Chunked',areas:[],tenants:[],mlas:[],note:'Y'.repeat(PW_PART+20)})}])`);
  await run(`(async()=>{PW.ix=JSON.parse(JSON.stringify((await BASIS_DESKTOP.readSnapshot()).entries.pw_index));return pwCommit(pwIxCopy(),[{id:'p',saved:2,json:JSON.stringify({name:'Small',areas:[],tenants:[],mlas:[]})}]);})()`);
  assert.equal(Object.keys(store.state().entries).filter(key=>key.startsWith('pwm_p_')).length,0);assert.equal(JSON.parse(store.state().entries.pwm_p.s).name,'Small');
  await run(`(async()=>{PW.ix=JSON.parse(JSON.stringify((await BASIS_DESKTOP.readSnapshot()).entries.pw_index));var empty=pwIxCopy();empty.props=[];return pwCommit(empty,[],['p']);})()`);
  assert.equal(Object.keys(store.state().entries).some(key=>key.startsWith('pwm_p')),false);assert.equal(store.state().entries.pw_index.props.length,0);
});
test('Native revision conflict cannot publish a stale library',async()=>{
  const store=backend(),{run}=workspace(store);await run('pwCommit(pwIxCopy())');const latest=store.state();latest.entries.pw_index.rev='newer';
  await store.invoke('desktop_store_commit',{expectedRevision:latest.revision,puts:{pw_index:latest.entries.pw_index},deletes:[]});
  const before=store.state();await assert.rejects(run('pwCommit(pwIxCopy())'),/changed/);assert.deepEqual(store.state(),before);
});
test('Native save preserves UTF-8 and typed-array byte offsets and propagates cancellation',async()=>{
  const calls=[],{bridge}=setup(async(command,args)=>{calls.push({command,args});return 'declined';});
  assert.equal(await bridge.saveFile('Café.json','€1,234.56'),'declined');assert.equal(Buffer.from(calls[0].args.dataBase64,'base64').toString('utf8'),'€1,234.56');
  assert.equal(await bridge.saveFile('part.bin',new Uint8Array([9,1,2,8]).subarray(1,3)),'declined');assert.deepEqual([...Buffer.from(calls[1].args.dataBase64,'base64')],[1,2]);assert.equal(calls.length,2);
});
test('Saved native credentials are never forwarded as a bearer key',async()=>{
  const calls=[],{bridge}=setup(async(command,args)=>{calls.push({command,args});return {status:200,body:'{"ok":true}'};});
  const response=await bridge.fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+bridge.credentialMarker},body:'{}'});
  assert.deepEqual(await response.json(),{ok:true});assert.equal(calls[0].args.provider,'openai');assert.equal(Object.hasOwn(calls[0].args,'apiKey'),false);assert.equal(JSON.stringify(calls).includes(bridge.credentialMarker),false);
});
test('Session keys use the fixed native provider transport and unsupported URLs stay blocked',async()=>{
  const calls=[],{bridge}=setup(async(command,args)=>{calls.push({command,args});return {status:429,body:'{"error":"limited"}'};});
  const response=await bridge.fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':'session-test-key'},body:'{"model":"test"}'});
  assert.equal(response.status,429);assert.equal(calls[0].args.apiKey,'session-test-key');assert.equal(calls[0].args.provider,'anthropic');
  await assert.rejects(bridge.fetch('https://example.com',{method:'POST',body:'{}'}),/not supported/);assert.equal(calls.length,1);
});
test('AI cancellation stops the pending native request and suppresses late results',async()=>{
  const calls=[],{bridge}=setup((command,args)=>{calls.push({command,args});return command==='desktop_ai_request'?new Promise(()=>{}):Promise.resolve();});
  const controller=new AbortController(),pending=bridge.fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer test-key'},body:'{}',signal:controller.signal});
  await new Promise(resolve=>setImmediate(resolve));controller.abort();await assert.rejects(pending,{name:'AbortError'});await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.filter(call=>call.command==='desktop_ai_cancel').length,1);assert.equal(calls[0].args.requestId,calls[1].args.requestId);
});
test('Remembered setup contains provider/model only and restores through native key status',async()=>{
  const configured=[],{run,local,bridge}=setup(async(command,args)=>{assert.equal(command,'desktop_key_status');assert.equal(args.provider,'openai');return true;},{basisAIGeneration:0,basisConfigureAI:value=>configured.push(value)});
  run(`basisDesktopAIChoice({provider:'openai',model:'test-model',apiKey:'never-store-me'})`);assert.equal([...local.values()].some(value=>value.includes('never-store-me')),false);
  await run('basisDesktopRestoreAI()');assert.equal(configured.length,1);assert.equal(configured[0].apiKey,bridge.credentialMarker);
});
test('Native close waits for current save and blocks a failed save',async()=>{
  let handler,closes=0,saves=0,release;const alerts=[];
  const env=setup(async()=>{}, {PW:{ready:Promise.resolve(),q:Promise.resolve(),cur:'p',local:{edited:1}},pwSaveCur:async()=>{saves++;await new Promise(resolve=>{release=resolve;});env.context.PW.local.edited=0;},pwStatus(){},kAlert:value=>alerts.push(value)});
  env.host.__TAURI__.window={getCurrentWindow:()=>({onCloseRequested:async callback=>{handler=callback;},close:async()=>{closes++;}})};
  await env.run('basisDesktopInstallCloseGuard()');let prevented=0;const pending=handler({preventDefault:()=>{prevented++;}});await new Promise(resolve=>setImmediate(resolve));assert.equal(saves,1);assert.equal(closes,0);assert.equal(prevented,1);release();await pending;assert.equal(closes,1);assert.equal(alerts.length,0);
  // New window session: rejected persistence must keep the app open.
  closes=0;env.context.PW.local.edited=1;env.context.pwSaveCur=async()=>{throw Error('Disk full');};await env.run('basisDesktopInstallCloseGuard()');await handler({preventDefault(){}});assert.equal(closes,0);assert.match(alerts[0],/stayed open.*Disk full/);
});
