'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {PATHS,targetOrigin,loginTeam,validLoginRedirect,checkAccess}=require('./check-access.cjs');
const team='basis-fixture.cloudflareaccess.com',site='https://basis-fixture.pages.dev/';
const response=(status=302,location='https://'+team+'/cdn-cgi/access/login/basis-fixture.pages.dev')=>new Response(null,{status,headers:location?{location}:{}});
test('gate probe restricts origins and has explicit loopback-only HTTP test mode',()=>{
  assert.equal(targetOrigin(site),'https://basis-fixture.pages.dev');
  for(const url of ['http://site.example/','https://name:password@site.example/','https://site.example/path','https://site.example/?token=secret','https://site.example/#secret','file:///tmp/file'])assert.throws(()=>targetOrigin(url,true));
  assert.throws(()=>targetOrigin('http://127.0.0.1:9876/'));
  assert.equal(targetOrigin('http://127.0.0.1:9876/',true),'http://127.0.0.1:9876');
});
test('team hostname must be exact rather than a URL or suffix trick',()=>{
  assert.equal(loginTeam(team),team);
  for(const bad of ['https://'+team,'x.cloudflareaccess.com.attacker.test','foo.bar.cloudflareaccess.com','',undefined])assert.throws(()=>loginTeam(bad));
});
test('anonymous probes visit every declared route without credentials or redirect following',async()=>{
  const calls=[];const result=await checkAccess(site,team,{fetchImpl:async(url,options)=>{calls.push({url,options});return response();}});
  assert.deepEqual(result.pathsChecked,PATHS);assert.equal(calls.length,PATHS.length);
  for(const {url,options}of calls){assert.ok(url.startsWith(site));assert.equal(options.redirect,'manual');assert.equal(options.credentials,'omit');assert.equal(options.method,'GET');assert.equal(options.headers.Authorization,undefined);assert.equal(options.headers.Cookie,undefined);}
});
test('public files, 403/404, failures and arbitrary redirects never count as protected',async()=>{
  for(const r of [response(200,''),response(403,''),response(404,''),response(503,''),response(302,'https://wrong.cloudflareaccess.com/cdn-cgi/access/login/site'),response(302,'https://'+team+'/other'),response(302,'http://'+team+'/cdn-cgi/access/login/site'),response(302,'https://name:secret@'+team+'/cdn-cgi/access/login/site'),response(302,'/cdn-cgi/access/login/site')]){
    assert.equal(validLoginRedirect(r,team),false);await assert.rejects(checkAccess(site,team,{fetchImpl:async()=>r}),/not confirmed/);
  }
});
test('an unprotected subsidiary asset fails even when the root is protected',async()=>{
  let calls=0;await assert.rejects(checkAccess(site,team,{fetchImpl:async()=>++calls===1?response():response(200,'')}),/release\.json/);assert.equal(calls,2);
});
test('network exceptions are redacted and ignored aborts still have a deadline',async()=>{
  await assert.rejects(checkAccess(site,team,{fetchImpl:async()=>{throw Error('secret internal proxy failure');}}),e=>!e.message.includes('secret')&&e.message.includes('not confirmed'));
  let signal;await assert.rejects(checkAccess(site,team,{timeoutMs:10,fetchImpl:async(url,options)=>{signal=options.signal;return new Promise(()=>{});}}),/not confirmed/);assert.equal(signal.aborted,true);
});
