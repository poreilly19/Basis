#!/usr/bin/env node
'use strict';
// Read-only verification. The locally built manifest is the trust anchor; this
// command never accepts deployment-provided hashes or changes hosting settings.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {betaHeaders}=require('./build-beta.cjs');
const LIMITS=Object.freeze({manifest:65536,file:16*1024*1024,total:32*1024*1024,entries:64,depth:4,requestMs:10000,totalMs:60000});
const REQUIRED=['index.html','privacy.html','limitations.html','THIRD_PARTY_NOTICES.txt','headers.json','_headers','runtime-inventory.json'];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const keysEqual=(object,keys)=>plain(object)&&Object.keys(object).sort().join('\n')===[...keys].sort().join('\n');
class VerificationError extends Error{}
function fail(message){throw new VerificationError(message);}
function safeName(name){
  return typeof name==='string'&&name.length<=200&&name.split('/').length<=LIMITS.depth&&
    name.split('/').every(part=>/^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(part)&&!['__proto__','constructor','prototype'].includes(part)&&!part.endsWith('.')&&!/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part));
}
function readBounded(file,maximum,label){
  let stat;try{stat=fs.lstatSync(file);}catch{fail('Missing '+label+'.');}
  if(!stat.isFile()||stat.isSymbolicLink())fail(label+' must be a regular file, not a link.');
  if(stat.size>maximum)fail(label+' exceeds its size limit.');
  const flags=fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0);
  const fd=fs.openSync(file,flags);
  try{
    const opened=fs.fstatSync(fd);if(!opened.isFile()||opened.size>maximum||opened.ino!==stat.ino||opened.dev!==stat.dev)fail(label+' changed during verification.');
    const bytes=Buffer.alloc(opened.size),read=fs.readSync(fd,bytes,0,bytes.length,0),extra=Buffer.alloc(1);
    if(read!==bytes.length||fs.readSync(fd,extra,0,1,bytes.length)!==0)fail(label+' changed during verification.');
    return bytes;
  }finally{fs.closeSync(fd);}
}
function parse(bytes,label){try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail(label+' is not valid UTF-8 JSON.');}}
function verifyDirectory(directory=path.join(__dirname,'../dist/basis-beta')){
  directory=path.resolve(directory);
  let root;try{root=fs.lstatSync(directory);}catch{fail('The beta directory does not exist. Run npm run build:beta first.');}
  if(root.isSymbolicLink()||!root.isDirectory())fail('The beta directory must be a real directory, not a link.');
  const releaseBytes=readBounded(path.join(directory,'release.json'),LIMITS.manifest,'release.json'),release=parse(releaseBytes,'release.json');
  if(!keysEqual(release,['generator','version','channel','appSha256','accessControl','files'])||release.generator!=='basis-beta-static-v1'||release.channel!=='beta-candidate'||
    typeof release.version!=='string'||!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(release.version)||typeof release.accessControl!=='string'||!release.accessControl.trim()||
    typeof release.appSha256!=='string'||!/^[a-f0-9]{64}$/.test(release.appSha256)||!plain(release.files))fail('Invalid beta release manifest.');
  const names=Object.keys(release.files),seenCase=new Set();let declared=releaseBytes.length;
  if(!names.length||names.length>=LIMITS.entries)fail('Manifest file count exceeds its limit.');
  for(const name of names){
    const record=release.files[name];
    if(!safeName(name)||name==='release.json'||seenCase.has(name.toLowerCase()))fail('Unsafe or conflicting manifest path.');
    seenCase.add(name.toLowerCase());
    if(!keysEqual(record,['bytes','sha256'])||!Number.isSafeInteger(record.bytes)||record.bytes<0||record.bytes>LIMITS.file||typeof record.sha256!=='string'||!/^[a-f0-9]{64}$/.test(record.sha256))fail('Invalid file size or digest for '+name+'.');
    declared+=record.bytes;if(declared>LIMITS.total)fail('Declared bundle size exceeds its limit.');
  }
  if(REQUIRED.some(name=>!Object.hasOwn(release.files,name)))fail('The manifest omits a required beta file.');
  const actual=[],directories=new Set();let entries=0;
  function walk(folder,prefix=''){
    for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
      if(++entries>LIMITS.entries)fail('Bundle entry count exceeds its limit.');
      const name=prefix+entry.name;if(!safeName(name))fail('Unsafe bundle path.');
      if(entry.isSymbolicLink())fail('Bundle contains a symbolic link.');
      if(entry.isDirectory()){directories.add(name);walk(path.join(folder,entry.name),name+'/');}
      else if(entry.isFile())actual.push(name);
      else fail('Bundle contains a non-regular entry.');
    }
  }
  walk(directory);
  const expected=[...names,'release.json'].sort();
  if(actual.sort().join('\n')!==expected.join('\n'))fail('Bundle inventory does not match release.json (missing or unexpected files).');
  for(const dir of directories)if(!names.some(name=>name.startsWith(dir+'/')))fail('Bundle contains an unexpected directory.');
  const buffers=new Map([['release.json',releaseBytes]]);
  for(const name of names){
    const bytes=readBounded(path.join(directory,...name.split('/')),release.files[name].bytes,name);
    if(bytes.length!==release.files[name].bytes||sha(bytes)!==release.files[name].sha256)fail('Content does not match release.json: '+name+'.');
    buffers.set(name,bytes);
  }
  if(sha(buffers.get('index.html'))!==release.appSha256)fail('App fingerprint does not match release.json.');
  const headers=parse(buffers.get('headers.json'),'headers.json');
  let canonical;try{canonical=betaHeaders(new TextDecoder('utf-8',{fatal:true}).decode(buffers.get('index.html')));}catch{fail('App scripts cannot produce the approved beta security policy.');}
  if(!keysEqual(headers,Object.keys(canonical))||Object.entries(canonical).some(([key,value])=>headers[key]!==value))fail('headers.json does not match the app security policy.');
  const headerFile='/*\n'+Object.entries(canonical).map(([key,value])=>'  '+key+': '+value).join('\n')+'\n';
  if(!buffers.get('_headers').equals(Buffer.from(headerFile)))fail('_headers does not match headers.json.');
  return {directory,release,headers,buffers};
}
function deploymentURL(value,allowHttp=false){
  let url;try{url=new URL(value);}catch{fail('Use an absolute HTTPS deployment URL.');}
  if(url.username||url.password||url.search||url.hash)fail('Deployment URLs cannot contain credentials, query parameters or fragments.');
  const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(url.protocol!=='https:'&&!(allowHttp&&url.protocol==='http:'&&loopback))fail('Deployment verification requires HTTPS; --allow-http permits only loopback tests.');
  if(!url.pathname.endsWith('/'))fail('The deployment base URL must end with /.');
  return url;
}
async function verifyDeployment(local,urlValue,options={}){
  const base=deploymentURL(urlValue,options.allowHttp),deadline=Date.now()+LIMITS.totalMs;
  const fetcher=options.fetch||globalThis.fetch;
  const requestHeaders={'Accept-Encoding':'identity','Cache-Control':'no-cache'};
  if(options.cloudflareAccess){
    if(base.protocol!=='https:')fail('Cloudflare Access credentials require HTTPS.');
    const env=options.env||process.env,id=env.CF_ACCESS_CLIENT_ID,secret=env.CF_ACCESS_CLIENT_SECRET;
    if(typeof id!=='string'||typeof secret!=='string'||!id||!secret||id.length>1024||secret.length>1024||/[\s\x00-\x1f\x7f]/.test(id+secret))fail('Set valid CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET environment variables for Cloudflare Access.');
    requestHeaders['CF-Access-Client-Id']=id;requestHeaders['CF-Access-Client-Secret']=secret;
  }
  // _headers is host configuration and may be consumed instead of served.
  // Pages canonicalizes HTML to extensionless paths and index.html to /.
  // Request those directly; never forward credentials through a redirect.
  const resources=[{name:'site root',route:'',bytes:local.buffers.get('index.html'),status:200,html:true}];
  for(const [name,bytes]of local.buffers){
    if(name==='_headers'||name==='index.html')continue;
    if(options.cloudflarePages&&name==='404.html')resources.push({name:'missing route',route:'__basis_missing_'+local.release.appSha256+'__',bytes,status:404,html:true});
    else resources.push({name,route:options.cloudflarePages&&name.endsWith('.html')?name.slice(0,-5):name,bytes,status:200,html:name.endsWith('.html')});
  }
  for(const {name,route,bytes:expected,status,html}of resources){
    const remaining=deadline-Date.now();if(remaining<=0)fail('Deployment verification exceeded its total deadline.');
    const url=new URL(route.split('/').map(encodeURIComponent).join('/'),base),ctl=new AbortController();
    const timer=setTimeout(()=>ctl.abort(),Math.min(remaining,LIMITS.requestMs));let response,reader;
    const label=name;
    try{
      response=await fetcher(url,{redirect:'manual',credentials:'omit',referrerPolicy:'no-referrer',signal:ctl.signal,headers:requestHeaders});
      if(response.status>=300&&response.status<400)fail('Redirect rejected for '+label+'; verify the final deployment URL directly.');
      if(response.status!==status)fail('Deployment did not serve '+label+' (HTTP '+Number(response.status)+', expected '+status+').');
      if(response.url&&new URL(response.url).href!==url.href)fail('Unexpected response URL for '+label+'.');
      for(const [key,value]of Object.entries(local.headers))if(response.headers.get(key)!==value)fail('Missing or mismatched '+key+' on '+label+'.');
      if(html){
        if(!/^text\/html(?:\s*;|$)/i.test(response.headers.get('content-type')||''))fail('Wrong HTML content type for '+label+'.');
      }
      const length=response.headers.get('content-length');
      if(length!==null&&(!/^\d+$/.test(length)||Number(length)>expected.length))fail('Response exceeds the expected size for '+label+'.');
      if(!response.body)fail('Empty response body for '+label+'.');
      reader=response.body.getReader();let count=0;const digest=crypto.createHash('sha256');
      for(;;){const {done,value}=await reader.read();if(done)break;count+=value.byteLength;if(count>expected.length)fail('Response exceeds the expected size for '+label+'.');digest.update(value);}
      if(count!==expected.length||digest.digest('hex')!==sha(expected))fail('Deployed content differs from the trusted local release: '+label+'.');
    }catch(error){
      // Transport errors can contain signed URLs, proxy details or credentials.
      if(error instanceof VerificationError)throw error;
      fail('Unable to verify '+label+' (network failure or timeout).');
    }finally{clearTimeout(timer);ctl.abort();if(reader)try{await reader.cancel();}catch{}else if(response?.body)try{await response.body.cancel();}catch{}}
  }
  return {resources:resources.length};
}
function parseArgs(args){
  const result={};
  for(let i=0;i<args.length;i++){
    const name=args[i];if(name==='--help'){result.help=true;continue;}
    const boolean=name==='--allow-http'?'allowHttp':name==='--cloudflare-pages'?'cloudflarePages':name==='--cloudflare-access'?'cloudflareAccess':null;
    if(boolean){if(result[boolean])fail('Duplicate option.');result[boolean]=true;continue;}
    const key=name==='--directory'?'directory':name==='--url'?'url':null;
    if(!key||result[key]!==undefined||!args[i+1]||args[i+1].startsWith('--'))fail('Unknown, duplicate or incomplete option. Use --help.');
    result[key]=args[++i];
  }
  if(result.allowHttp&&!result.url)fail('--allow-http requires --url.');
  if((result.cloudflarePages||result.cloudflareAccess)&&!result.url)fail('Cloudflare options require --url.');
  return result;
}
async function main(args=process.argv.slice(2)){
  try{
    const options=parseArgs(args);
    if(options.help){console.log('Usage: node scripts/verify-beta.cjs [--directory dist/basis-beta] [--url https://beta.example/] [--cloudflare-pages] [--cloudflare-access] [--allow-http]\nRead-only: verify local release bytes, exact inventory and security policy; optionally verify the served release.\n--cloudflare-pages uses canonical extensionless HTML URLs and verifies the custom 404.\n--cloudflare-access reads CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET from the environment; HTTPS only.\n--allow-http permits only loopback test servers. No redirects or URL credentials are accepted.');return 0;}
    const local=verifyDirectory(options.directory);let served;
    if(options.url)served=await verifyDeployment(local,options.url,options);
    console.log(JSON.stringify({verified:true,version:local.release.version,appSha256:local.release.appSha256,localFiles:local.buffers.size,servedResources:served?.resources||0,scope:served?'Local release and served bytes/security headers; access enforcement and browser behavior require separate tests.':'Local release only; hosting, access control and browser behavior are not verified.'},null,2));return 0;
  }catch(error){console.error('Beta verification failed: '+error.message);return 1;}
}
if(require.main===module)main().then(code=>{process.exitCode=code;});
module.exports={LIMITS,verifyDirectory,verifyDeployment,deploymentURL,parseArgs,main};
