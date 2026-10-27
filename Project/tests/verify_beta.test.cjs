'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http');
const {betaHeaders}=require('../scripts/build-beta.cjs');
const {LIMITS,verifyDirectory,verifyDeployment,deploymentURL,parseArgs}=require('../scripts/verify-beta.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function fixture(t){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'basis-verifier-'));t.after(()=>fs.rmSync(directory,{force:true,recursive:true}));
  const html='<!doctype html><title>Original verifier fixture</title><script>window.one=1;</script><script>window.two=2;</script><script>window.three=3;</script>';
  const headers=betaHeaders(html),files=new Map([
    ['index.html',Buffer.from(html)],['privacy.html',Buffer.from('<!doctype html><title>Privacy fixture</title>')],['limitations.html',Buffer.from('<!doctype html><title>Limitations fixture</title>')],
    ['THIRD_PARTY_NOTICES.txt',Buffer.from('Original test fixture')],['third_party/LICENSE.txt',Buffer.from('Original fixture text')],
    ['runtime-inventory.json',Buffer.from('{}\n')],['headers.json',Buffer.from(JSON.stringify(headers))],
    ['_headers',Buffer.from('/*\n'+Object.entries(headers).map(([k,v])=>'  '+k+': '+v).join('\n')+'\n')]
  ]);
  for(const [name,bytes]of files){const f=path.join(directory,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,bytes);}
  const release={generator:'basis-beta-static-v1',version:'0.7.26',channel:'beta-candidate',appSha256:sha(files.get('index.html')),accessControl:'Test hosting access separately.',files:Object.fromEntries([...files].map(([name,b])=>[name,{bytes:b.length,sha256:sha(b)}]))};
  const write=()=>fs.writeFileSync(path.join(directory,'release.json'),JSON.stringify(release));write();
  return {directory,release,write,headers,files};
}
function changeFile(f,name,bytes){bytes=Buffer.from(bytes);fs.writeFileSync(path.join(f.directory,name),bytes);f.release.files[name]={bytes:bytes.length,sha256:sha(bytes)};f.write();}
async function serve(t,local,alter){
  const observed=[],server=http.createServer(async(req,res)=>{
    observed.push(req.url);
    const name=req.url==='/'?'index.html':decodeURIComponent(req.url.slice(1));
    if(alter&&await alter(req,res,name))return;
    const bytes=local.buffers.get(name);if(!bytes){res.writeHead(404);res.end();return;}
    const headers={...local.headers,'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'};
    res.writeHead(200,headers);res.end(bytes);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  return {url:'http://127.0.0.1:'+server.address().port+'/',observed};
}
test('valid local bundle verifies exact inventory, fingerprints and policy without mutation',t=>{
  const f=fixture(t),before=fs.readFileSync(path.join(f.directory,'release.json'));const result=verifyDirectory(f.directory);
  assert.equal(result.release.appSha256,sha(f.files.get('index.html')));assert.equal(result.buffers.size,9);assert.deepEqual(result.headers,f.headers);
  assert.deepEqual(fs.readFileSync(path.join(f.directory,'release.json')),before);
});
test('tampered equal-length bytes reject even with valid lengths',t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.directory,'index.html'),Buffer.alloc(f.files.get('index.html').length,32));
  assert.throws(()=>verifyDirectory(f.directory),/Content does not match/);
});
test('missing files, unexpected files and empty directories reject',t=>{
  for(const mutate of [f=>fs.unlinkSync(path.join(f.directory,'privacy.html')),f=>fs.writeFileSync(path.join(f.directory,'.env'),'secret fixture'),f=>fs.mkdirSync(path.join(f.directory,'extra'))]){
    const f=fixture(t);mutate(f);assert.throws(()=>verifyDirectory(f.directory),/inventory|Unsafe|unexpected/);
  }
});
test('root and nested symlinks are rejected before file contents are accepted',t=>{
  const f=fixture(t),link=f.directory+'-link';t.after(()=>fs.rmSync(link,{force:true}));
  try{fs.symlinkSync(f.directory,link,'junction');}catch(e){if(['EPERM','EACCES'].includes(e.code)){t.skip('Host does not permit symlink creation');return;}throw e;}
  assert.throws(()=>verifyDirectory(link),/real directory/);
  fs.unlinkSync(path.join(f.directory,'privacy.html'));fs.symlinkSync(path.join(f.directory,'limitations.html'),path.join(f.directory,'privacy.html'));
  assert.throws(()=>verifyDirectory(f.directory),/symbolic link/);
});
test('manifest traversal, URL syntax, case collisions and prototype names reject',t=>{
  for(const name of ['../outside','/absolute','C:/path','third_party\\escape','%2e%2e/file','index.html?token=hidden','INDEX.html','__proto__','third_party/constructor','CON.txt','third_party/LPT1']){
    const f=fixture(t);Object.defineProperty(f.release.files,name,{value:{bytes:1,sha256:sha('x')},enumerable:true,configurable:true});f.write();
    assert.throws(()=>verifyDirectory(f.directory),/Unsafe|conflicting/);
  }
});
test('invalid manifest schema, missing required files and invalid fingerprints reject',t=>{
  for(const mutate of [r=>r.generator='other',r=>r.channel='production',r=>r.version=['0.7.26'],r=>r.appSha256='invalid',r=>r.files['index.html'].bytes=-1,r=>r.files['index.html'].bytes=1.5,r=>delete r.files['privacy.html'],r=>r.files['index.html'].sha256='z'.repeat(64)]){
    const f=fixture(t);mutate(f.release);f.write();assert.throws(()=>verifyDirectory(f.directory),/Invalid|required/);
  }
});
test('manifest and per-file declared sizes and file counts are bounded',t=>{
  let f=fixture(t);fs.writeFileSync(path.join(f.directory,'release.json'),' '.repeat(LIMITS.manifest+1));assert.throws(()=>verifyDirectory(f.directory),/size limit/);
  f=fixture(t);f.release.files['index.html'].bytes=LIMITS.file+1;f.write();assert.throws(()=>verifyDirectory(f.directory),/Invalid file size/);
  f=fixture(t);for(let i=0;i<LIMITS.entries;i++)f.release.files['file'+i]={bytes:0,sha256:sha('')};f.write();assert.throws(()=>verifyDirectory(f.directory),/file count/);
  f=fixture(t);for(let i=0;i<3;i++)f.release.files['large'+i]={bytes:LIMITS.file,sha256:sha('')};f.write();assert.throws(()=>verifyDirectory(f.directory),/bundle size/);
});
test('changed script with updated manifest still requires matching security hashes',t=>{
  const f=fixture(t),html=f.files.get('index.html').toString().replace('window.one=1','window.one=8');changeFile(f,'index.html',html);f.release.appSha256=sha(html);f.write();
  assert.throws(()=>verifyDirectory(f.directory),/security policy/);
});
test('updated manifest cannot hide weakened CSP or mismatched host configuration',t=>{
  let f=fixture(t);changeFile(f,'headers.json',JSON.stringify({...f.headers,'Content-Security-Policy':"default-src *; script-src 'unsafe-inline'"}));assert.throws(()=>verifyDirectory(f.directory),/security policy/);
  f=fixture(t);changeFile(f,'_headers','/*\n  X-Frame-Options: SAMEORIGIN\n');assert.throws(()=>verifyDirectory(f.directory),/_headers does not match/);
});
test('invalid UTF-8 manifest bytes and app fingerprint mismatches reject',t=>{
  let f=fixture(t);fs.writeFileSync(path.join(f.directory,'release.json'),Buffer.from([0xc3,0x28]));assert.throws(()=>verifyDirectory(f.directory),/UTF-8 JSON/);
  f=fixture(t);f.release.appSha256='0'.repeat(64);f.write();assert.throws(()=>verifyDirectory(f.directory),/App fingerprint/);
});
test('URL and command parsing rejects credential-bearing URLs, unsafe HTTP and ambiguous flags',()=>{
  for(const value of ['https://user:password@example.test/','https://example.test/?secret=hidden','https://example.test/#token','http://example.test/','file:///tmp/','https://example.test/path'])assert.throws(()=>deploymentURL(value,true));
  assert.equal(deploymentURL('https://example.test/beta/').pathname,'/beta/');
  for(const host of ['localhost','127.0.0.1','[::1]']){assert.throws(()=>deploymentURL('http://'+host+'/'));assert.equal(deploymentURL('http://'+host+'/',true).protocol,'http:');}
  for(const args of [['--url'],['--url','https://one/','--url','https://two/'],['--allow-http'],['--token','secret'],['--allow-http','--allow-http']])assert.throws(()=>parseArgs(args));
});
test('served bundle verifies against local bytes, response headers and default root',async t=>{
  const local=verifyDirectory(fixture(t).directory),s=await serve(t,local);const result=await verifyDeployment(local,s.url,{allowHttp:true});
  assert.equal(result.resources,local.buffers.size-1);assert.ok(s.observed.includes('/'));assert.ok(s.observed.includes('/release.json'));assert.ok(!s.observed.includes('/_headers'));assert.ok(!s.observed.includes('/index.html'));
});
test('served same-size tampered HTML cannot be blessed by its own manifest',async t=>{
  const local=verifyDirectory(fixture(t).directory),s=await serve(t,local,(req,res,name)=>{
    if(name!=='index.html')return false;res.writeHead(200,{...local.headers,'Content-Type':'text/html'});res.end(Buffer.alloc(local.buffers.get(name).length,32));return true;
  });await assert.rejects(verifyDeployment(local,s.url,{allowHttp:true}),/trusted local release/);
});
test('missing or weaker security headers fail on every served resource',async t=>{
  for(const header of ['Content-Security-Policy','X-Content-Type-Options','Cache-Control']){
    const local=verifyDirectory(fixture(t).directory),s=await serve(t,local,(req,res,name)=>{
      if(name!=='privacy.html')return false;const headers={...local.headers,'Content-Type':'text/html'};delete headers[header];res.writeHead(200,headers);res.end(local.buffers.get(name));return true;
    });await assert.rejects(verifyDeployment(local,s.url,{allowHttp:true}),new RegExp('Missing or mismatched '+header));
  }
});
test('same-origin and cross-origin redirects stop before following the location',async t=>{
  for(const target of ['/redirected','https://elsewhere.invalid/?secret=hidden']){
    const local=verifyDirectory(fixture(t).directory),s=await serve(t,local,(req,res)=>{res.writeHead(302,{Location:target});res.end();return true;});
    await assert.rejects(verifyDeployment(local,s.url,{allowHttp:true}),e=>/Redirect rejected/.test(e.message)&&!e.message.includes('secret'));
    assert.deepEqual(s.observed,['/']);
  }
});
test('missing responses, wrong content type and oversized streams fail closed',async t=>{
  for(const behavior of ['missing','type','announced','stream']){
    const local=verifyDirectory(fixture(t).directory),s=await serve(t,local,(req,res,name)=>{
      if(behavior==='missing'){res.writeHead(404);res.end();return true;}
      const headers={...local.headers,'Content-Type':behavior==='type'?'text/plain':'text/html'};
      if(behavior==='announced')headers['Content-Length']=local.buffers.get(name).length+1;
      res.writeHead(200,headers);res.end(Buffer.concat([local.buffers.get(name),behavior==='type'?Buffer.alloc(0):Buffer.from('x')]));return true;
    });await assert.rejects(verifyDeployment(local,s.url,{allowHttp:true}),/HTTP 404|content type|expected size/);
  }
});
test('transport failures are redacted and fetch never requests credentials or redirects',async t=>{
  const local=verifyDirectory(fixture(t).directory);let options;
  for(const message of ['Secret token: do-not-display','Redirect rejected SECRET','Missing or mismatched SECRET'])
    await assert.rejects(verifyDeployment(local,'https://example.test/',{fetch:async(url,opts)=>{options=opts;throw Error(message);}}),e=>e.message==='Unable to verify site root (network failure or timeout).');
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'manual');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.headers.Authorization,undefined);
});
test('Pages mode requests canonical HTML paths and validates custom missing-page bytes/status',async t=>{
  const f=fixture(t);changeFile(f,'404.html','<!doctype html><title>Missing original fixture</title>');const local=verifyDirectory(f.directory);
  const s=await serve(t,local,(req,res,name)=>{
    if(name==='privacy'||name==='limitations'||name.startsWith('__basis_missing_')){
      const missing=name.startsWith('__basis_missing_');res.writeHead(missing?404:200,{...local.headers,'Content-Type':'text/html'});res.end(local.buffers.get(missing?'404.html':name+'.html'));return true;
    }
    if(req.url!=='/'&&name.endsWith('.html')){res.writeHead(301,{Location:'/unexpected'});res.end();return true;}
    return false;
  });
  const result=await verifyDeployment(local,s.url,{allowHttp:true,cloudflarePages:true});assert.equal(result.resources,local.buffers.size-1);
  assert.ok(s.observed.includes('/privacy'));assert.ok(s.observed.includes('/limitations'));assert.ok(s.observed.some(n=>n.startsWith('/__basis_missing_')));
  assert.ok(!s.observed.includes('/404.html'));
});
test('Pages mode rejects SPA fallback or a substituted 404 body',async t=>{
  for(const behavior of ['spa','substitution']){
    const f=fixture(t);changeFile(f,'404.html','<!doctype html><title>Original missing page</title>');const local=verifyDirectory(f.directory);
    const s=await serve(t,local,(req,res,name)=>{
      if(name.startsWith('__basis_missing_')){res.writeHead(behavior==='spa'?200:404,{...local.headers,'Content-Type':'text/html'});res.end(local.buffers.get('index.html'));return true;}
      if(['privacy','limitations'].includes(name)){res.writeHead(200,{...local.headers,'Content-Type':'text/html'});res.end(local.buffers.get(name+'.html'));return true;}return false;
    });await assert.rejects(verifyDeployment(local,s.url,{allowHttp:true,cloudflarePages:true}),/missing route/);
  }
});
test('Access credentials are opt-in, HTTPS-only, complete and excluded from errors',async t=>{
  const local=verifyDirectory(fixture(t).directory),env={CF_ACCESS_CLIENT_ID:'original-test-id',CF_ACCESS_CLIENT_SECRET:'original-secret-do-not-print'};let calls=0;
  const fetch=async(url,options)=>{calls++;assert.equal(options.headers['CF-Access-Client-Id'],env.CF_ACCESS_CLIENT_ID);assert.equal(options.headers['CF-Access-Client-Secret'],env.CF_ACCESS_CLIENT_SECRET);throw Error(env.CF_ACCESS_CLIENT_SECRET);};
  await assert.rejects(verifyDeployment(local,'http://127.0.0.1/',{allowHttp:true,cloudflareAccess:true,env,fetch}),/credentials require HTTPS/);assert.equal(calls,0);
  for(const bad of [{},{CF_ACCESS_CLIENT_ID:'id'},{...env,CF_ACCESS_CLIENT_SECRET:'bad\nsecret'}])await assert.rejects(verifyDeployment(local,'https://example.test/',{cloudflareAccess:true,env:bad,fetch}),/Set valid CF_ACCESS/);
  assert.equal(calls,0);
  await assert.rejects(verifyDeployment(local,'https://example.test/',{cloudflareAccess:true,env,fetch}),e=>e.message==='Unable to verify site root (network failure or timeout).');assert.equal(calls,1);
});
test('Access credentials never follow redirects to a login or another host',async t=>{
  const local=verifyDirectory(fixture(t).directory),env={CF_ACCESS_CLIENT_ID:'test-id',CF_ACCESS_CLIENT_SECRET:'test-secret'};let calls=0;
  await assert.rejects(verifyDeployment(local,'https://example.test/',{cloudflareAccess:true,env,fetch:async(url,options)=>{
    calls++;assert.equal(options.redirect,'manual');return new Response('',{status:302,headers:{Location:'https://account.cloudflareaccess.com/cdn-cgi/access/login?token=test-secret'}});
  }}),e=>/Redirect rejected/.test(e.message)&&!e.message.includes('test-secret'));assert.equal(calls,1);
});
