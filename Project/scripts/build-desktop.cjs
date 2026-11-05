// Package the same verified Basis application for Tauri with local PDF/Excel
// runtimes. The hosted web distribution is generated separately and retained.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const https=require('node:https'),http=require('node:http'),tls=require('node:tls');
const {buildBeta}=require('./build-beta.cjs');
const ROOT=path.join(__dirname,'..'),GENERATOR='basis-desktop-static-v1';
const RUNTIMES=['xlsx-0.20.3.min.js','pdf-4.10.38.min.mjs','pdf.worker-4.10.38.min.mjs'];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

function verifyArtifact(bytes,artifact){
  if(bytes.length!==artifact.size||sha(bytes)!==artifact.sha256)throw Error('Desktop runtime size/SHA-256 verification failed: '+artifact.file);
  return bytes;
}
function runtimeInventory(root){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/runtime_dependencies.json'),'utf8'));
  if(!Array.isArray(manifest.artifacts))throw Error('Invalid desktop runtime inventory.');
  return RUNTIMES.map(name=>{
    const matches=manifest.artifacts.filter(item=>item.file===name);
    if(matches.length!==1)throw Error('Desktop runtime inventory requires exactly one '+name);
    const item=matches[0];let url;try{url=new URL(item.url);}catch(_){throw Error('Invalid desktop runtime URL.');}
    if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search||
      !['cdn.sheetjs.com','cdnjs.cloudflare.com'].includes(url.hostname)||
      !Number.isSafeInteger(item.size)||item.size<1||item.size>4*1024*1024||!/^[a-f0-9]{64}$/.test(item.sha256)){
      throw Error('Invalid desktop runtime pin: '+name);
    }
    return {...item};
  });
}
// Node 20 does not automatically honor HTTPS_PROXY. Use an HTTP CONNECT agent
// when a proxy is configured, preserving inherited TLS certificate validation.
function downloadArtifact(artifact){
  return new Promise((resolve,reject)=>{
    const target=new URL(artifact.url),proxyValue=process.env.HTTPS_PROXY||process.env.https_proxy||process.env.HTTP_PROXY||process.env.http_proxy;
    let agent;
    if(proxyValue){
      let proxy;try{proxy=new URL(proxyValue);}catch(_){reject(Error('Invalid HTTPS proxy configuration.'));return;}
      if(!['http:','https:'].includes(proxy.protocol)){reject(Error('Desktop runtime download requires an HTTP(S) proxy.'));return;}
      agent=new https.Agent({keepAlive:false});
      agent.createConnection=(options,callback)=>{
        const headers={Host:target.hostname+':443'};
        if(proxy.username||proxy.password)headers['Proxy-Authorization']='Basic '+Buffer.from(decodeURIComponent(proxy.username)+':'+decodeURIComponent(proxy.password)).toString('base64');
        const connect=(proxy.protocol==='https:'?https:http).request({hostname:proxy.hostname,port:proxy.port||undefined,
          method:'CONNECT',path:target.hostname+':443',headers});
        let connected=false;
        connect.once('connect',(response,socket,head)=>{
          if(response.statusCode!==200){socket.destroy();callback(Error('The configured proxy rejected the runtime download.'));return;}
          connected=true;if(head.length)socket.unshift(head);
          const secure=tls.connect({socket,servername:target.hostname});
          secure.once('secureConnect',()=>callback(null,secure));secure.once('error',error=>{if(!secure.authorized)callback(error);});
        });
        connect.once('error',error=>{if(!connected)callback(error);});
        connect.setTimeout(15000,()=>connect.destroy(Error('Runtime proxy connection timed out.')));connect.end();
      };
    }
    let request;
    try{request=https.get(target,{agent,headers:{'User-Agent':'Basis-desktop-runtime-builder','Accept':'application/octet-stream'}},response=>{
      if(response.statusCode!==200){response.resume();reject(Error('Desktop runtime download failed (HTTP '+response.statusCode+'): '+artifact.file));return;}
      const chunks=[];let size=0;
      response.on('data',chunk=>{size+=chunk.length;if(size>artifact.size){response.destroy(Error('Desktop runtime exceeds its pinned size: '+artifact.file));return;}chunks.push(chunk);});
      response.once('error',reject);response.once('end',()=>{try{resolve(verifyArtifact(Buffer.concat(chunks),artifact));}catch(error){reject(error);}});
    });}catch(error){if(agent)agent.destroy();reject(error);return;}
    request.once('error',reject);request.setTimeout(30000,()=>request.destroy(Error('Desktop runtime download timed out: '+artifact.file)));
    request.once('close',()=>{if(agent)agent.destroy();});
  });
}
async function readRuntime(cache,artifact,offline){
  const filename=path.join(cache,artifact.file);
  if(fs.existsSync(filename)){
    if(!fs.lstatSync(filename).isFile()||fs.lstatSync(filename).isSymbolicLink())throw Error('Desktop runtime cache entry is not a regular file: '+artifact.file);
    return verifyArtifact(fs.readFileSync(filename),artifact);
  }
  if(offline)throw Error('Offline desktop build is missing a verified runtime: '+artifact.file);
  const bytes=await downloadArtifact(artifact);fs.mkdirSync(cache,{recursive:true});
  const temporary=path.join(cache,'.basis-runtime-'+crypto.randomBytes(12).toString('hex'));
  try{fs.writeFileSync(temporary,bytes,{flag:'wx'});fs.renameSync(temporary,filename);}finally{fs.rmSync(temporary,{force:true});}
  return bytes;
}
function validatePrevious(target){
  if(!fs.existsSync(target))return;
  if(fs.lstatSync(target).isSymbolicLink())throw Error('Refusing to replace a linked desktop distribution.');
  let prior;try{prior=JSON.parse(fs.readFileSync(path.join(target,'desktop-release.json'),'utf8'));}catch(_){}
  if(prior?.generator!==GENERATOR||!prior.files||typeof prior.files!=='object'||Array.isArray(prior.files)||Object.keys(prior.files).length>100){
    throw Error('Desktop output contains files not generated by this builder. Move it before building.');
  }
  const expected=new Set(['desktop-release.json']);
  for(const [name,record]of Object.entries(prior.files)){
    if(!/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(name)||name.split('/').some(piece=>piece==='.'||piece==='..')||
      name==='desktop-release.json'||!record||!Number.isSafeInteger(record.bytes)||record.bytes<0||record.bytes>16*1024*1024||!/^[a-f0-9]{64}$/.test(record.sha256)){
      throw Error('Invalid previous desktop distribution inventory.');
    }
    expected.add(name);
  }
  const found=new Set();
  function visit(directory,prefix=''){
    for(const name of fs.readdirSync(directory)){
      const relative=prefix+name,filename=path.join(directory,name),stat=fs.lstatSync(filename);
      if(stat.isSymbolicLink())throw Error('Modified desktop output contains a link. Move it before building.');
      if(stat.isDirectory()){
        if(![...expected].some(item=>item.startsWith(relative+'/')))throw Error('Modified desktop output contains an extra directory.');
        visit(filename,relative+'/');
      }else{
        if(!stat.isFile()||!expected.has(relative))throw Error('Modified desktop output contains extra files.');
        if(relative!=='desktop-release.json'&&(stat.size!==prior.files[relative].bytes||sha(fs.readFileSync(filename))!==prior.files[relative].sha256)){
          throw Error('Modified desktop output file: '+relative);
        }
        found.add(relative);
      }
    }
  }
  visit(target);if(found.size!==expected.size)throw Error('Previous desktop output has missing files.');
}
async function buildDesktop({root=ROOT,cache=path.join(root,'.cache/desktop-runtime'),offline=false,requireNativeNotices=false}={}){
  const artifacts=runtimeInventory(root),runtimeBytes=[];
  const nativeNames=['NATIVE_THIRD_PARTY_NOTICES.txt','native-license-inventory.json'],nativeFiles=new Map();
  for(const name of nativeNames){
    const filename=path.join(root,'desktop/src-tauri/generated',name);
    if(fs.existsSync(filename)){
      const stat=fs.lstatSync(filename);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>16*1024*1024)throw Error('Invalid generated native license notice: '+name);
      nativeFiles.set(name,fs.readFileSync(filename));
    }
  }
  if(nativeFiles.size!==nativeNames.length&&(requireNativeNotices||nativeFiles.size)){
    throw Error('Generate the complete native third-party notices before packaging the desktop release.');
  }
  if(nativeFiles.size){
    let inventory;try{inventory=JSON.parse(nativeFiles.get('native-license-inventory.json').toString('utf8'));}catch(_){}
    if(inventory?.schemaVersion!==1||inventory.noticeSha256!==sha(nativeFiles.get('NATIVE_THIRD_PARTY_NOTICES.txt'))){
      throw Error('The generated native license inventory does not match its notices. Regenerate both files.');
    }
    if(!Array.isArray(inventory.sourceArchives)||inventory.sourceArchives.length>100)throw Error('The native source archive inventory is invalid.');
    const seen=new Set();
    for(const archive of inventory.sourceArchives){
      if(!archive||!/^native-sources\/[A-Za-z0-9][A-Za-z0-9_.-]{0,160}\.crate$/.test(archive.path)||seen.has(archive.path)||
        !Number.isSafeInteger(archive.bytes)||archive.bytes<1||archive.bytes>16*1024*1024||!/^[a-f0-9]{64}$/.test(archive.sha256)){
        throw Error('The native source archive inventory contains an invalid record.');
      }
      seen.add(archive.path);
      const parent=path.join(root,'desktop/src-tauri/generated/native-sources'),filename=path.join(root,'desktop/src-tauri/generated',archive.path);
      if(!fs.existsSync(parent)||!fs.lstatSync(parent).isDirectory()||fs.lstatSync(parent).isSymbolicLink()||!fs.existsSync(filename))throw Error('A required native source archive is missing: '+archive.path);
      const stat=fs.lstatSync(filename);
      if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==archive.bytes)throw Error('A required native source archive is invalid: '+archive.path);
      const bytes=fs.readFileSync(filename);
      if(sha(bytes)!==archive.sha256)throw Error('A required native source archive failed SHA-256 verification: '+archive.path);
      nativeFiles.set(archive.path,bytes);
    }
  }
  // Verify every dependency before changing either distribution.
  for(const artifact of artifacts)runtimeBytes.push(await readRuntime(cache,artifact,offline));
  const dist=path.join(root,'dist'),target=path.join(dist,'basis-desktop');validatePrevious(target);
  const beta=buildBeta(root),files=new Map();
  for(const name of Object.keys(beta.release.files)){
    if(['_headers','headers.json','privacy.html','limitations.html'].includes(name))continue;
    files.set(name,fs.readFileSync(path.join(beta.directory,name)));
  }
  for(const [source,targetName]of [['docs/DESKTOP_PRIVACY.html','privacy.html'],['docs/DESKTOP_LIMITATIONS.html','limitations.html']]){
    files.set(targetName,fs.readFileSync(path.join(root,source)));
  }
  artifacts.forEach((artifact,index)=>files.set('vendor/'+artifact.file,runtimeBytes[index]));
  for(const [name,bytes]of nativeFiles)files.set(name,bytes);
  files.set('runtime-inventory.json',Buffer.from(JSON.stringify({scope:'Pinned offline PDF/Excel runtime artifacts bundled with the desktop edition; not a complete transitive SBOM',
    artifacts:artifacts.map(item=>({...item,bundledPath:'vendor/'+item.file}))},null,2)+'\n'));
  const release={generator:GENERATOR,version:beta.release.version,platform:'tauri-windows',appSha256:sha(files.get('index.html')),
    sharedApplication:true,offlineDocumentLibraries:true,nativeNoticesIncluded:nativeNames.every(name=>nativeFiles.has(name)),
    accessControl:'Desktop files use the signed-in operating-system account; Cloudflare Access applies only to the hosted web edition.',
    runtimes:artifacts.map(item=>({...item,bundledPath:'vendor/'+item.file})),
    files:Object.fromEntries([...files].map(([name,bytes])=>[name,{bytes:bytes.length,sha256:sha(bytes)}]))};
  files.set('desktop-release.json',Buffer.from(JSON.stringify(release,null,2)+'\n'));
  const staging=fs.mkdtempSync(path.join(dist,'.basis-desktop-'));
  try{
    for(const [name,bytes]of files){const filename=path.join(staging,name);fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,bytes);}
    if(fs.existsSync(target))fs.rmSync(target,{recursive:true});fs.renameSync(staging,target);
  }finally{fs.rmSync(staging,{recursive:true,force:true});}
  return {directory:target,release};
}
if(require.main===module){
  const args=process.argv.slice(2);let cache,offline=false,requireNativeNotices=false;
  for(let i=0;i<args.length;i++){
    if(args[i]==='--offline')offline=true;
    else if(args[i]==='--require-native-notices')requireNativeNotices=true;
    else if(args[i]==='--cache'&&args[i+1])cache=path.resolve(args[++i]);
    else throw Error('Usage: node scripts/build-desktop.cjs [--cache DIRECTORY] [--offline] [--require-native-notices]');
  }
  buildDesktop({cache,offline,requireNativeNotices}).then(result=>console.log(JSON.stringify({directory:result.directory,version:result.release.version,appSha256:result.release.appSha256,files:Object.keys(result.release.files).length+1},null,2)),error=>{console.error(error.message);process.exitCode=1;});
}
module.exports={buildDesktop,runtimeInventory,verifyArtifact,downloadArtifact};
