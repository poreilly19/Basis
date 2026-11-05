// Build a bounded notice inventory from an existing `cargo metadata --locked`
// result. This is a Cargo package superset, not an SBOM or legal clearance.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const LIMITS=Object.freeze({metadata:32*1024*1024,packages:10000,file:2*1024*1024,total:64*1024*1024,archive:16*1024*1024,sourceTotal:128*1024*1024,filesPerPackage:100,depth:4});
const PERMISSIVE=new Set(['MIT','MIT-0','0BSD','Unlicense','Apache-2.0','BSD-2-Clause','BSD-3-Clause','ISC','Zlib','Unicode-3.0','Unicode-DFS-2016','CC0-1.0','CDLA-Permissive-2.0','OpenSSL','BSL-1.0']);
const REVIEW=new Set(['MPL-2.0']);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const SUPPLEMENTS=require('../docs/third_party/native-license-supplements.json');
const contained=(root,file)=>{const rel=path.relative(root,file);return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));};

function licenseExpression(value){
  if(typeof value!=='string'||!value.trim()||value.length>2000)throw Error('A package is missing a bounded SPDX license declaration.');
  // Cargo accepts older slash-separated dual declarations. Preserve the raw
  // value in the inventory and make this narrowly defined OR normalization clear.
  const normalized=value.replace(/([A-Za-z0-9][A-Za-z0-9.+-]*)\s*\/\s*(?=[A-Za-z0-9])/g,'$1 OR ');
  const tokens=normalized.match(/[A-Za-z0-9][A-Za-z0-9.+-]*|[()]/g)||[];
  if(tokens.join('')!==normalized.replace(/\s/g,''))throw Error('Unsupported SPDX license syntax: '+value);
  let index=0;const identifiers=new Set(),exceptions=new Set();
  const next=()=>tokens[index];
  const atom=()=>{
    if(next()==='('){index++;or();if(next()!==')')throw Error('Unbalanced SPDX license expression.');index++;if(next()==='WITH')throw Error('SPDX WITH must follow one license identifier.');return;}
    const id=tokens[index++];if(!id||['AND','OR','WITH',')'].includes(id))throw Error('Invalid SPDX license expression: '+value);
    if(!PERMISSIVE.has(id)&&!REVIEW.has(id))throw Error('License needs explicit review before distribution: '+id);
    identifiers.add(id);
    if(next()==='WITH'){index++;const exception=tokens[index++];if(id!=='Apache-2.0'||exception!=='LLVM-exception')throw Error('License exception needs explicit review: '+String(exception));exceptions.add(exception);}
  };
  const and=()=>{atom();while(next()==='AND'){index++;atom();}};
  const or=()=>{and();while(next()==='OR'){index++;and();}};
  or();if(index!==tokens.length)throw Error('Invalid SPDX license expression: '+value);
  return {identifiers:[...identifiers].sort(),exceptions:[...exceptions].sort(),normalizedExpression:normalized,legacySlashDeclaration:normalized!==value,requiresSourceAvailabilityReview:identifiers.has('MPL-2.0')};
}

function boundedText(file,limit=LIMITS.file){
  const stat=fs.lstatSync(file);if(stat.isSymbolicLink()||!stat.isFile()||stat.size<1||stat.size>limit)throw Error('Missing, linked or oversized notice file: '+path.basename(file));
  const bytes=fs.readFileSync(file);if(bytes.length<1||bytes.length>limit)throw Error('Notice file changed beyond its size limit.');let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch(error){throw Error('Notice file is not UTF-8: '+path.basename(file));}
  if(text.includes('\0'))throw Error('Notice file contains binary data: '+path.basename(file));
  return {bytes,text};
}

function safePackageFile(root,candidate){
  const absolute=path.resolve(root,candidate);if(!contained(root,absolute))throw Error('Package license path escapes its manifest directory.');
  let current=root;for(const segment of path.relative(root,absolute).split(path.sep).filter(Boolean)){current=path.join(current,segment);if(fs.lstatSync(current).isSymbolicLink())throw Error('Linked package license paths are not accepted.');}
  const real=fs.realpathSync(absolute);if(!contained(root,real))throw Error('Package license path escapes its manifest directory.');
  return real;
}

function packageNoticeFiles(pkg){
  if(typeof pkg.manifest_path!=='string'||!path.isAbsolute(pkg.manifest_path))throw Error('Package manifest_path must be absolute.');
  const manifest=fs.lstatSync(pkg.manifest_path);if(manifest.isSymbolicLink()||!manifest.isFile())throw Error('Package manifest is missing or linked.');
  const root=fs.realpathSync(path.dirname(pkg.manifest_path)),found=new Set();
  const add=candidate=>{found.add(safePackageFile(root,candidate));if(found.size>LIMITS.filesPerPackage)throw Error('Too many notice files in one package.');};
  const walk=(directory,depth)=>{
    if(depth>LIMITS.depth)throw Error('Package notice directory is too deep.');
    const items=fs.readdirSync(directory,{withFileTypes:true});if(items.length>10000)throw Error('Package notice directory has too many entries.');
    for(const item of items){const absolute=path.join(directory,item.name);if(item.isSymbolicLink())throw Error('Linked package notice files are not accepted.');if(item.isDirectory())walk(absolute,depth+1);else if(item.isFile())add(absolute);}
  };
  if(pkg.license_file!=null){if(typeof pkg.license_file!=='string'||!pkg.license_file||pkg.license_file.length>4096)throw Error('Invalid package license_file.');add(pkg.license_file);}
  for(const item of fs.readdirSync(root,{withFileTypes:true})){
    if(!/^(?:licen[cs]e|unlicense|copying|notice)(?:$|[._-]|s$)/i.test(item.name))continue;
    const absolute=path.join(root,item.name);if(item.isSymbolicLink())throw Error('Linked package notice files are not accepted.');if(item.isDirectory())walk(absolute,0);else if(item.isFile())add(absolute);
  }
  const files=[...found].sort((a,b)=>path.relative(root,a).localeCompare(path.relative(root,b),'en'));
  if(!files.length){
    // The only explicitly permitted out-of-crate source is Basis's own MIT
    // license. Third-party crates never inherit the project's license.
    if(pkg.source==null&&pkg.name==='basis-desktop'&&path.resolve(pkg.manifest_path)===path.join(ROOT,'desktop/src-tauri/Cargo.toml'))return [{absolute:path.join(ROOT,'LICENSE'),relative:'Basis project LICENSE'}];
    const supplement=SUPPLEMENTS.packages.find(item=>item.name===pkg.name&&item.version===pkg.version&&item.license===pkg.license&&item.repository===pkg.repository);
    if(supplement&&pkg.source==='registry+https://github.com/rust-lang/crates.io-index'){
      let vcs;try{vcs=JSON.parse(boundedText(safePackageFile(root,'.cargo_vcs_info.json')).text);}catch(error){throw Error('Missing verified source commit for supplemental license: '+pkg.name);}
      if(vcs?.git?.sha1!==supplement.vcsCommit)throw Error('Source commit changed for supplemental license: '+pkg.name);
      if(pkg.name==='selectors'){const header=boundedText(safePackageFile(root,'lib.rs')).text.slice(0,400);if(!header.includes('Mozilla Public')||!header.includes('https://mozilla.org/MPL/2.0/'))throw Error('Reviewed selectors MPL source header changed.');}
      return supplement.files.map(file=>{
        if(!/^[A-Za-z0-9_.-]+$/.test(file.file))throw Error('Unsafe supplemental license filename.');
        const absolute=path.join(ROOT,'docs/third_party',file.file),text=boundedText(absolute);if(sha(text.bytes)!==file.sha256)throw Error('Supplemental upstream license does not match its pin: '+file.file);
        return {absolute,relative:'Distribution-supplied '+file.file,supplemental:true,upstream:file.upstream,sourceCommit:supplement.vcsCommit};
      });
    }
    throw Error('No license/notice text found for package '+pkg.name+' '+pkg.version+'.');
  }
  return files.map(absolute=>({absolute,relative:path.relative(root,absolute).split(path.sep).join('/')}));
}

function field(value,label,max=2048,{nullable=false}={}){
  if(nullable&&value==null)return null;
  if(typeof value!=='string'||!value||value.length>max||/[\0\r\n]/.test(value))throw Error('Invalid package '+label+'.');
  return value;
}

function cargoChecksums(lockFile){
  const text=boundedText(lockFile,8*1024*1024).text,checksums=new Map();
  for(const block of text.split(/^\[\[package\]\]\s*$/m).slice(1)){
    const values={};for(const key of ['name','version','source','checksum']){const match=block.match(new RegExp('^'+key+' = ("[^"\\r\\n]*")\\s*$','m'));if(match)values[key]=JSON.parse(match[1]);}
    if(values.source&&values.checksum){if(!/^[a-f0-9]{64}$/.test(values.checksum))throw Error('Invalid Cargo.lock source checksum.');const key=JSON.stringify([values.name,values.version,values.source]);if(checksums.has(key))throw Error('Duplicate Cargo.lock package checksum.');checksums.set(key,values.checksum);}
  }
  if(!checksums.size)throw Error('Cargo.lock contains no package checksums.');return checksums;
}

function sourceArchive(pkg,checksums){
  if(pkg.source!=='registry+https://github.com/rust-lang/crates.io-index'||!/^[A-Za-z0-9_-]+$/.test(pkg.name)||!/^[A-Za-z0-9.+-]+$/.test(pkg.version))throw Error('MPL source archive requires a reviewed crates.io package source.');
  const expected=checksums.get(JSON.stringify([pkg.name,pkg.version,pkg.source]));if(!expected)throw Error('MPL source archive has no matching Cargo.lock checksum: '+pkg.name);
  const root=fs.realpathSync(path.dirname(pkg.manifest_path)),registry=path.basename(path.dirname(root)),name=pkg.name+'-'+pkg.version+'.crate';
  const file=path.resolve(root,'..','..','..','cache',registry,name),stat=fs.lstatSync(file);
  if(stat.isSymbolicLink()||!stat.isFile()||stat.size<1||stat.size>LIMITS.archive)throw Error('MPL source archive is linked, empty or too large: '+name);
  const bytes=fs.readFileSync(file);if(bytes.length>LIMITS.archive||sha(bytes)!==expected)throw Error('MPL source archive does not match Cargo.lock: '+name);
  return {bytes,record:{path:'native-sources/'+name,bytes:bytes.length,sha256:expected,upstream:'https://crates.io/api/v1/crates/'+pkg.name+'/'+pkg.version+'/download'}};
}

function generateNotices(metadata,metadataBytes=Buffer.from(JSON.stringify(metadata)),options={}){
  if(!metadata||typeof metadata!=='object'||!Array.isArray(metadata.packages)||!metadata.packages.length||metadata.packages.length>LIMITS.packages)throw Error('Cargo metadata must contain a bounded, nonempty packages array.');
  const sorted=[...metadata.packages].sort((a,b)=>String(a.name).localeCompare(String(b.name),'en')||String(a.version).localeCompare(String(b.version),'en')||String(a.source).localeCompare(String(b.source),'en'));
  const packages=[],sections=[],seen=new Set(),sourceFiles=[];let total=0,sourceTotal=0,checksums;
  for(const pkg of sorted){
    const name=field(pkg.name,'name',200),version=field(pkg.version,'version',200),id=field(pkg.id,'id',4096),source=field(pkg.source,'source',4096,{nullable:true}),repository=field(pkg.repository,'repository',4096,{nullable:true});
    if(seen.has(id))throw Error('Duplicate package identifier in Cargo metadata.');seen.add(id);
    const license=field(pkg.license,'license',2000),review=licenseExpression(license),files=[];
    sections.push('\n'+'='.repeat(72)+'\n'+name+' '+version+'\nLicense: '+license+'\nSource: '+(source||'Local workspace package')+'\nRepository: '+(repository||'Not declared')+'\n');
    let archive;
    if(review.requiresSourceAvailabilityReview){
      if(!checksums)checksums=cargoChecksums(options.lockFile||path.join(ROOT,'desktop/src-tauri/Cargo.lock'));
      archive=sourceArchive(pkg,checksums);sourceTotal+=archive.bytes.length;if(sourceTotal>LIMITS.sourceTotal)throw Error('MPL source archive total exceeds its size limit.');sourceFiles.push(archive);
      sections.push('MPL-2.0: source-availability obligations require separate review. The exact upstream source archive accompanies this distribution at '+archive.record.path+'. Its checksum is verified against Cargo.lock; the declared repository and public download location are also recorded. This inventory does not establish broader legal compliance.\n');
    }
    for(const item of packageNoticeFiles(pkg)){
      const data=boundedText(item.absolute);total+=data.bytes.length;if(total>LIMITS.total)throw Error('Native license text total exceeds the size limit.');
      files.push({path:item.relative,bytes:data.bytes.length,sha256:sha(data.bytes),...(item.supplemental?{distributionSupplied:true,upstream:item.upstream,sourceCommit:item.sourceCommit}: {})});
      sections.push('\n--- '+item.relative+' ---\n'+data.text.replace(/\r\n/g,'\n')+'\n');
      if(item.supplemental)sections.push('License supplied by this distribution from '+item.upstream+'; crate source commit '+item.sourceCommit+'.\n');
    }
    packages.push({name,version,license,normalizedLicenseExpression:review.normalizedExpression,legacySlashDeclaration:review.legacySlashDeclaration,source,repository,licenseIdentifiers:review.identifiers,licenseExceptions:review.exceptions,requiresSourceAvailabilityReview:review.requiresSourceAvailabilityReview,licenseFiles:files,...(archive?{sourceArchive:archive.record}:{})});
  }
  const notice=Buffer.from('Basis Desktop — Native Dependency Notices\n\n'+
    'This file includes the packages reported by cargo metadata --locked. It is a\n'+
    'superset covering build, target-specific and runtime dependencies; inclusion\n'+
    'does not mean every package is linked into this Windows executable.\n'+
    'Package declarations and copied upstream notices are factual evidence, not\n'+
    'a complete SBOM, provenance audit or legal clearance. JavaScript runtime\n'+
    'notices and the Basis MIT license are distributed separately.\n'+
    'MPL-2.0 packages are flagged separately for source-availability review.\n'+sections.join(''));
  const inventory={schemaVersion:1,scope:'Cargo metadata package superset, including build and target-specific dependencies; not a complete SBOM or legal clearance',metadataSha256:sha(metadataBytes),noticeSha256:sha(notice),packageCount:packages.length,sourceAvailabilityReviewRequired:packages.some(pkg=>pkg.requiresSourceAvailabilityReview),sourceArchives:sourceFiles.map(file=>file.record),packages};
  return {notice,inventory,sourceFiles};
}

function writeNotices(metadataFile,output=path.join(ROOT,'desktop/src-tauri/generated'),options={}){
  const metadataBytes=boundedText(metadataFile,LIMITS.metadata).bytes;let metadata;try{metadata=JSON.parse(metadataBytes.toString('utf8'));}catch(error){throw Error('Cargo metadata is not valid JSON.');}
  const result=generateNotices(metadata,metadataBytes,options),directory=path.resolve(output);fs.mkdirSync(directory,{recursive:true});if(fs.lstatSync(directory).isSymbolicLink())throw Error('Refusing linked notice output directory.');
  for(const file of result.sourceFiles){const target=path.join(directory,file.record.path);fs.mkdirSync(path.dirname(target),{recursive:true});if(fs.lstatSync(path.dirname(target)).isSymbolicLink()||(fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink()))throw Error('Refusing linked source output.');fs.writeFileSync(target,file.bytes);}
  const outputs=[['NATIVE_THIRD_PARTY_NOTICES.txt',result.notice],['native-license-inventory.json',Buffer.from(JSON.stringify(result.inventory,null,2)+'\n')]];
  for(const [name,bytes]of outputs){const target=path.join(directory,name);if(fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink())throw Error('Refusing linked notice output file.');const temp=path.join(directory,'.'+name+'.'+crypto.randomBytes(8).toString('hex')+'.tmp');try{fs.writeFileSync(temp,bytes,{flag:'wx'});fs.renameSync(temp,target);}finally{try{fs.unlinkSync(temp);}catch(ignore){}}}
  return {directory,packageCount:result.inventory.packageCount,sourceArchiveCount:result.inventory.sourceArchives.length,sourceAvailabilityReviewRequired:result.inventory.sourceAvailabilityReviewRequired};
}

if(require.main===module){
  try{let metadataFile,output,lockFile;const args=process.argv.slice(2);for(let i=0;i<args.length;i++){const flag=args[i];if(flag==='--metadata'&&args[i+1])metadataFile=args[++i];else if(flag==='--output'&&args[i+1])output=args[++i];else if(flag==='--lock'&&args[i+1])lockFile=args[++i];else throw Error('Usage: node scripts/native-notices.cjs --metadata FILE [--output DIRECTORY] [--lock Cargo.lock]');}if(!metadataFile)throw Error('Provide --metadata from cargo metadata --locked --format-version 1.');console.log(JSON.stringify(writeNotices(path.resolve(metadataFile),output,{lockFile})));}catch(error){console.error('Native notices: '+error.message);process.exitCode=1;}
}
module.exports={licenseExpression,generateNotices,writeNotices,packageNoticeFiles,cargoChecksums,LIMITS};
