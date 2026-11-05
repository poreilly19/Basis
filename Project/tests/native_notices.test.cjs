'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {licenseExpression,generateNotices,writeNotices,packageNoticeFiles,LIMITS}=require('../scripts/native-notices.cjs');
function fixture(t,{license='MIT OR Apache-2.0',files={'LICENSE-MIT':'Copyright Example\nPermission is hereby granted.\n','LICENSE-APACHE':'Apache License\nVersion 2.0\n'},...extra}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'basis-native-notices-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.writeFileSync(path.join(root,'Cargo.toml'),'[package]\nname="example"\n');for(const [name,text]of Object.entries(files)){const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
  return {root,pkg:{name:'example',version:'1.2.3',id:'registry+https://example.invalid/index#example@1.2.3',source:'registry+https://example.invalid/index',repository:'https://example.invalid/repo',license,license_file:null,manifest_path:path.join(root,'Cargo.toml'),...extra}};
}
function mplFixture(t){
  const original=fixture(t,{license:'MPL-2.0',files:{LICENSE:'Mozilla Public License Version 2.0\n'}}),root=original.root,pkgRoot=path.join(root,'registry/src/test/example-1.2.3'),cache=path.join(root,'registry/cache/test');fs.mkdirSync(pkgRoot,{recursive:true});fs.mkdirSync(cache,{recursive:true});for(const name of ['Cargo.toml','LICENSE'])fs.copyFileSync(path.join(root,name),path.join(pkgRoot,name));
  const archiveFile=path.join(cache,'example-1.2.3.crate'),source=Buffer.from('Original package source archive bytes'),checksum=crypto.createHash('sha256').update(source).digest('hex'),lockFile=path.join(root,'Cargo.lock');fs.writeFileSync(archiveFile,source);fs.writeFileSync(lockFile,'version = 3\n\n[[package]]\nname = "example"\nversion = "1.2.3"\nsource = "registry+https://github.com/rust-lang/crates.io-index"\nchecksum = "'+checksum+'"\n');
  return {root,lockFile,archiveFile,pkg:{...original.pkg,manifest_path:path.join(pkgRoot,'Cargo.toml'),source:'registry+https://github.com/rust-lang/crates.io-index'}};
}
test('accepts bounded audited SPDX syntax and flags MPL obligations separately',()=>{
  assert.deepEqual(licenseExpression('(MIT OR Apache-2.0) AND Unicode-3.0').identifiers,['Apache-2.0','MIT','Unicode-3.0']);
  assert.deepEqual(licenseExpression('Apache-2.0 WITH LLVM-exception').exceptions,['LLVM-exception']);assert.equal(licenseExpression('MPL-2.0').requiresSourceAvailabilityReview,true);
  assert.equal(licenseExpression('MIT/Apache-2.0').normalizedExpression,'MIT OR Apache-2.0');assert.equal(licenseExpression('MIT / Apache-2.0').legacySlashDeclaration,true);for(const id of ['0BSD','MIT-0','Unlicense'])assert.equal(licenseExpression(id).requiresSourceAvailabilityReview,false);
});
test('rejects unknown/disallowed identifiers and malformed SPDX expressions',()=>{
  for(const value of [null,'','GPL-3.0-only','MIT OR GPL-3.0-only','LicenseRef-Unknown','MIT AND','(MIT','MIT Apache-2.0','MIT WITH LLVM-exception','Apache-2.0 WITH Unknown','MIT//Apache-2.0'])assert.throws(()=>licenseExpression(value));
});
test('copies exact upstream notices with source/version/license records and stable hashes',t=>{
  const {pkg}=fixture(t);const result=generateNotices({packages:[pkg]}),again=generateNotices({packages:[pkg]});assert.deepEqual(result,again);assert.equal(result.inventory.packageCount,1);assert.equal(result.inventory.packages[0].repository,pkg.repository);assert.match(result.notice.toString(),/Copyright Example/);assert.match(result.notice.toString(),/Apache License/);assert.equal(result.inventory.noticeSha256,crypto.createHash('sha256').update(result.notice).digest('hex'));assert.equal(result.inventory.packages[0].licenseFiles.length,2);assert.match(result.inventory.scope,/not a complete SBOM/);
});
test('includes explicit license_file and nested notice directories without unrelated source files',t=>{
  const {pkg}=fixture(t,{license_file:'legal/terms.txt',files:{'legal/terms.txt':'MIT terms\n','LICENSES/additional/NOTICE.txt':'A required attribution\n','source.rs':'not a notice'}});const result=generateNotices({packages:[pkg]});assert.deepEqual(result.inventory.packages[0].licenseFiles.map(x=>x.path),['legal/terms.txt','LICENSES/additional/NOTICE.txt'].sort((a,b)=>a.localeCompare(b,'en')));assert.doesNotMatch(result.notice.toString(),/not a notice/);
});
test('rejects escaping license_file paths and linked notice files',t=>{
  const {root,pkg}=fixture(t);assert.throws(()=>generateNotices({packages:[{...pkg,license_file:'../outside.txt'}]}),/escapes/);const target=path.join(root,'legal.txt'),link=path.join(root,'NOTICE.txt');fs.writeFileSync(target,'private');try{fs.symlinkSync(target,link);}catch(error){if(error.code==='EPERM'){t.diagnostic('Symlink creation unavailable; traversal assertion retained.');return;}throw error;}assert.throws(()=>generateNotices({packages:[pkg]}),/Linked/);
});
test('rejects missing declarations, notice text, duplicate identities and oversized text',t=>{
  const {root,pkg}=fixture(t,{files:{}});assert.throws(()=>generateNotices({packages:[pkg]}),/No license\/notice text/);fs.writeFileSync(path.join(root,'LICENSE'),'MIT');assert.throws(()=>generateNotices({packages:[{...pkg,license:null}]}),/license/);assert.throws(()=>generateNotices({packages:[pkg,pkg]}),/Duplicate/);fs.truncateSync(path.join(root,'LICENSE'),LIMITS.file+1);assert.throws(()=>generateNotices({packages:[pkg]}),/oversized/);
});
test('MPL package includes real license text and an explicit source availability review flag',t=>{
  const {pkg,lockFile}=mplFixture(t),result=generateNotices({packages:[pkg]},undefined,{lockFile});assert.equal(result.inventory.sourceAvailabilityReviewRequired,true);assert.equal(result.inventory.packages[0].requiresSourceAvailabilityReview,true);assert.match(result.notice.toString(),/source-availability obligations require separate review/);assert.equal(result.inventory.sourceArchives[0].path,'native-sources/example-1.2.3.crate');assert.equal(result.sourceFiles[0].bytes.toString(),'Original package source archive bytes');
});
test('MPL source supplement fails if archive bytes differ from the locked checksum',t=>{
  const {pkg,lockFile,archiveFile}=mplFixture(t);fs.appendFileSync(archiveFile,'changed');assert.throws(()=>generateNotices({packages:[pkg]},undefined,{lockFile}),/does not match Cargo.lock/);
});
test('writes locked MPL source archives with the generated notices',t=>{
  const {root,pkg,lockFile,archiveFile}=mplFixture(t),metadata=path.join(root,'metadata.json'),out=path.join(root,'generated');fs.writeFileSync(metadata,JSON.stringify({packages:[pkg]}));const result=writeNotices(metadata,out,{lockFile});assert.equal(result.sourceArchiveCount,1);assert.deepEqual(fs.readFileSync(path.join(out,'native-sources/example-1.2.3.crate')),fs.readFileSync(archiveFile));
});
test('writes the complete pair from metadata and refuses invalid metadata without replacing outputs',t=>{
  const {root,pkg}=fixture(t),file=path.join(root,'metadata.json'),out=path.join(root,'generated');fs.writeFileSync(file,JSON.stringify({packages:[pkg]}));const result=writeNotices(file,out);assert.equal(result.packageCount,1);const old=fs.readFileSync(path.join(out,'NATIVE_THIRD_PARTY_NOTICES.txt'));fs.writeFileSync(file,'{"packages":[]}');assert.throws(()=>writeNotices(file,out),/nonempty/);assert.deepEqual(fs.readFileSync(path.join(out,'NATIVE_THIRD_PARTY_NOTICES.txt')),old);assert.equal(JSON.parse(fs.readFileSync(path.join(out,'native-license-inventory.json'))).packageCount,1);
});
test('an explicitly audited omitted license uses the pinned source commit and upstream text',t=>{
  const {pkg,root}=fixture(t,{name:'webview2-com',version:'0.39.1',license:'MIT',source:'registry+https://github.com/rust-lang/crates.io-index',repository:'https://github.com/wravery/webview2-rs',files:{'.cargo_vcs_info.json':JSON.stringify({git:{sha1:'edc2caf886175ccaebe86078c9cfe1ae2a187328'}})}});const files=packageNoticeFiles(pkg);assert.equal(files.length,1);assert.equal(files[0].supplemental,true);assert.match(files[0].upstream,/edc2caf886175ccaebe86078c9cfe1ae2a187328/);assert.match(fs.readFileSync(files[0].absolute,'utf8'),/Copyright \(c\) 2021 Bill Avery/);fs.writeFileSync(path.join(root,'.cargo_vcs_info.json'),JSON.stringify({git:{sha1:'0000000000000000000000000000000000000000'}}));assert.throws(()=>packageNoticeFiles(pkg),/Source commit changed/);
});
test('a future package version cannot inherit an older missing-license exception',t=>{
  const {pkg}=fixture(t,{name:'webview2-com',version:'99.0.0',license:'MIT',source:'registry+https://github.com/rust-lang/crates.io-index',repository:'https://github.com/wravery/webview2-rs',files:{}});assert.throws(()=>packageNoticeFiles(pkg),/No license\/notice text/);
});
