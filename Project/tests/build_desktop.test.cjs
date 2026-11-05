const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {buildDesktop,runtimeInventory,verifyArtifact}=require('../scripts/build-desktop.cjs');
const ROOT=path.join(__dirname,'..'),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'basis-desktop-build-')),cache=path.join(root,'cache');
  for(const name of ['app/index.html','package.json','LICENSE','docs/BETA_404.html','docs/BETA_PRIVACY.html','docs/BETA_LIMITATIONS.html',
    'docs/THIRD_PARTY_NOTICES.md','docs/third_party/SHEETJS_LICENSE_0_20_3.txt','docs/third_party/PDFJS_LICENSE_4_10_38.txt']){
    const target=path.join(root,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(ROOT,name),target);
  }
  for(const name of ['DESKTOP_PRIVACY.html','DESKTOP_LIMITATIONS.html'])fs.writeFileSync(path.join(root,'docs',name),'<!doctype html><title>Desktop disclosure fixture</title>');
  fs.mkdirSync(cache);const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/fixtures/runtime_dependencies.json')));
  const selected=new Set(['xlsx-0.20.3.min.js','pdf-4.10.38.min.mjs','pdf.worker-4.10.38.min.mjs']);
  for(const artifact of manifest.artifacts)if(selected.has(artifact.file)){
    const bytes=Buffer.from('Independently known offline fixture for '+artifact.file);artifact.size=bytes.length;artifact.sha256=sha(bytes);fs.writeFileSync(path.join(cache,artifact.file),bytes);
  }
  fs.mkdirSync(path.join(root,'tests/fixtures'),{recursive:true});fs.writeFileSync(path.join(root,'tests/fixtures/runtime_dependencies.json'),JSON.stringify(manifest));
  return {root,cache,manifest,dispose:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('desktop bundle shares application bytes, retains web output and inventories exact local runtimes/licenses',async()=>{
  const f=fixture();try{
    fs.writeFileSync(path.join(f.cache,'do-not-package.txt'),'private cache item');
    const output=await buildDesktop({...f,offline:true}),release=output.release,first=fs.readFileSync(path.join(output.directory,'desktop-release.json'));
    assert.deepEqual(fs.readFileSync(path.join(output.directory,'index.html')),fs.readFileSync(path.join(f.root,'app/index.html')));
    assert.equal(release.sharedApplication,true);assert.equal(release.offlineDocumentLibraries,true);assert.equal(release.runtimes.length,3);
    for(const [name,record]of Object.entries(release.files)){const bytes=fs.readFileSync(path.join(output.directory,name));assert.equal(bytes.length,record.bytes);assert.equal(sha(bytes),record.sha256);}
    for(const name of ['LICENSE.txt','THIRD_PARTY_NOTICES.txt','third_party/SHEETJS_LICENSE_0_20_3.txt','third_party/PDFJS_LICENSE_4_10_38.txt'])assert.ok(release.files[name]);
    for(const name of ['_headers','headers.json','release.json','vendor/xlsx-0.18.5.reference.min.js','do-not-package.txt'])assert.equal(fs.existsSync(path.join(output.directory,name)),false);
    assert.ok(!release.runtimes.some(item=>item.file.includes('4.4.168')));
    const webManifest=fs.readFileSync(path.join(f.root,'dist/basis-beta/release.json'));
    await buildDesktop({...f,offline:true});assert.deepEqual(fs.readFileSync(path.join(output.directory,'desktop-release.json')),first);
    assert.deepEqual(fs.readFileSync(path.join(f.root,'dist/basis-beta/release.json')),webManifest);
  }finally{f.dispose();}
});
test('offline build rejects a missing runtime before changing either distribution',async()=>{
  const f=fixture();try{
    fs.unlinkSync(path.join(f.cache,'pdf-4.10.38.min.mjs'));
    await assert.rejects(buildDesktop({...f,offline:true}),/missing a verified runtime/);assert.equal(fs.existsSync(path.join(f.root,'dist')),false);
  }finally{f.dispose();}
});
test('corrupt cached bytes fail closed even when their length still matches',async()=>{
  const f=fixture();try{
    const filename=path.join(f.cache,'xlsx-0.20.3.min.js'),bytes=fs.readFileSync(filename);bytes[0]^=1;fs.writeFileSync(filename,bytes);
    await assert.rejects(buildDesktop({...f,offline:true}),/SHA-256 verification failed/);assert.equal(fs.existsSync(path.join(f.root,'dist')),false);
    assert.deepEqual(fs.readFileSync(filename),bytes);
  }finally{f.dispose();}
});
for(const kind of ['unowned','extra','edited','missing'])test('desktop rebuild preserves '+kind+' user output',async()=>{
  const f=fixture();try{
    const target=path.join(f.root,'dist/basis-desktop');
    if(kind==='unowned'){fs.mkdirSync(target,{recursive:true});fs.writeFileSync(path.join(target,'keep.txt'),'user data');}
    else{
      await buildDesktop({...f,offline:true});
      if(kind==='extra')fs.writeFileSync(path.join(target,'keep.txt'),'user data');
      if(kind==='edited')fs.writeFileSync(path.join(target,'index.html'),'user edit');
      if(kind==='missing')fs.unlinkSync(path.join(target,'privacy.html'));
    }
    await assert.rejects(buildDesktop({...f,offline:true}),/not generated|Modified desktop|missing files/);
    if(kind==='extra'||kind==='unowned')assert.equal(fs.readFileSync(path.join(target,'keep.txt'),'utf8'),'user data');
    if(kind==='edited')assert.equal(fs.readFileSync(path.join(target,'index.html'),'utf8'),'user edit');
  }finally{f.dispose();}
});
test('desktop inventory rejects duplicate or unsafe download records and validates independent bytes',()=>{
  const f=fixture();try{
    const file=path.join(f.root,'tests/fixtures/runtime_dependencies.json'),first=f.manifest.artifacts[0];
    assert.equal(verifyArtifact(Buffer.from('abc'),{file:'x',size:3,sha256:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'}).toString(),'abc');
    f.manifest.artifacts.push({...first});fs.writeFileSync(file,JSON.stringify(f.manifest));assert.throws(()=>runtimeInventory(f.root),/exactly one/);
    f.manifest.artifacts.pop();first.url='https://unreviewed.example/runtime.js';fs.writeFileSync(file,JSON.stringify(f.manifest));assert.throws(()=>runtimeInventory(f.root),/Invalid desktop runtime pin/);
  }finally{f.dispose();}
});
test('release packaging requires both native notices and inventories their exact bytes',async()=>{
  const f=fixture();try{
    await assert.rejects(buildDesktop({...f,offline:true,requireNativeNotices:true}),/native third-party notices/);
    const generated=path.join(f.root,'desktop/src-tauri/generated');fs.mkdirSync(generated,{recursive:true});
    const notice=Buffer.from('Independent native notice fixture');fs.writeFileSync(path.join(generated,'NATIVE_THIRD_PARTY_NOTICES.txt'),notice);
    await assert.rejects(buildDesktop({...f,offline:true}),/complete native/);
    fs.writeFileSync(path.join(generated,'native-license-inventory.json'),JSON.stringify({schemaVersion:1,noticeSha256:'0'.repeat(64)}));
    await assert.rejects(buildDesktop({...f,offline:true}),/does not match its notices/);
    fs.writeFileSync(path.join(generated,'native-license-inventory.json'),JSON.stringify({schemaVersion:1,noticeSha256:sha(notice),sourceArchives:[]}));
    const output=await buildDesktop({...f,offline:true,requireNativeNotices:true});assert.equal(output.release.nativeNoticesIncluded,true);
    for(const name of ['NATIVE_THIRD_PARTY_NOTICES.txt','native-license-inventory.json']){
      assert.deepEqual(fs.readFileSync(path.join(output.directory,name)),fs.readFileSync(path.join(generated,name)));assert.ok(output.release.files[name]);
    }
  }finally{f.dispose();}
});
test('native source supplements are required, hash-verified and packaged within their declared path',async()=>{
  const f=fixture();try{
    const generated=path.join(f.root,'desktop/src-tauri/generated');fs.mkdirSync(generated,{recursive:true});
    const notice=Buffer.from('Source supplement fixture'),source=Buffer.from('Original independent source archive bytes'),relative='native-sources/original-fixture-1.0.0.crate';
    const inventory={schemaVersion:1,noticeSha256:sha(notice),sourceArchives:[{path:relative,bytes:source.length,sha256:sha(source)}]};
    fs.writeFileSync(path.join(generated,'NATIVE_THIRD_PARTY_NOTICES.txt'),notice);
    fs.writeFileSync(path.join(generated,'native-license-inventory.json'),JSON.stringify(inventory));
    await assert.rejects(buildDesktop({...f,offline:true,requireNativeNotices:true}),/source archive is missing/);
    fs.mkdirSync(path.dirname(path.join(generated,relative)),{recursive:true});fs.writeFileSync(path.join(generated,relative),Buffer.alloc(source.length));
    await assert.rejects(buildDesktop({...f,offline:true,requireNativeNotices:true}),/SHA-256 verification/);
    fs.writeFileSync(path.join(generated,relative),source);
    const output=await buildDesktop({...f,offline:true,requireNativeNotices:true});assert.equal(output.release.nativeNoticesIncluded,true);
    assert.deepEqual(fs.readFileSync(path.join(output.directory,relative)),source);assert.equal(output.release.files[relative].sha256,sha(source));
    inventory.sourceArchives[0].path='../escape.crate';fs.writeFileSync(path.join(generated,'native-license-inventory.json'),JSON.stringify(inventory));
    await assert.rejects(buildDesktop({...f,offline:true,requireNativeNotices:true}),/invalid record/);
  }finally{f.dispose();}
});
