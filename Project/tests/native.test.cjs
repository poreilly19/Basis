const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','src','native_codec.js'),'utf8');
const context=vm.createContext({TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer,Blob,Response,DecompressionStream,crypto:require('node:crypto').webcrypto,Date,JSON,Map,Set,Error,Number,String,Promise});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src','scenario_settings.js'),'utf8'),context);
vm.runInContext(src,context);
const execute=(str)=>vm.runInContext(str,context);
const plain=value=>JSON.parse(JSON.stringify(value));
async function writeEntries(entries){context.archiveEntries=entries;return execute('basisZipWrite(archiveEntries)');}
async function readZip(file){context.archiveFile=file;return execute('basisZipRead(archiveFile)');}
async function rewriteArchive(file,change,refreshChecksums=false){const files=new Map(await readZip(file)),manifest=JSON.parse(Buffer.from(files.get('manifest.json')).toString('utf8'));change(manifest,files);
  if(refreshChecksums)manifest.checksums=Array.from(files,([name,data])=>{if(name==='manifest.json')return null;context.checkBytes=data;return {path:name,size:data.length,crc32:execute('basisHex(basisCrc32(checkBytes))'),sha256:require('node:crypto').createHash('sha256').update(data).digest('hex')};}).filter(Boolean);
  files.set('manifest.json',new TextEncoder().encode(JSON.stringify(manifest)));return new Blob([await writeEntries(Array.from(files,([name,data])=>({name,data})))]);}
async function readArchive(file){context.candidate=file;return execute('basisReadArchive(candidate)');}
function zipLayout(bytes){const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),end=bytes.length-22,central=view.getUint32(end+16,true),records=[];let p=central;
  for(let i=0;i<view.getUint16(end+10,true);i++){const local=view.getUint32(p+42,true),start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);records.push({central:p,local,start});p+=46+view.getUint16(p+28,true)+view.getUint16(p+30,true)+view.getUint16(p+32,true);}return {view,end,central,records};}
async function mutateZip(file,change){const bytes=new Uint8Array(await file.arrayBuffer());change(zipLayout(bytes),bytes);return new Blob([bytes]);}
async function singleEntry(name,data,method=0,declaredSize){const stored=await writeEntries([{name,data}]);if(method===0)return stored;const old=zipLayout(stored),entry=old.records[0],compressed=require('node:zlib').deflateRawSync(data),delta=compressed.length-data.length,bytes=new Uint8Array(stored.length+delta);
  bytes.set(stored.subarray(0,entry.start));bytes.set(compressed,entry.start);bytes.set(stored.subarray(old.central),old.central+delta);const view=new DataView(bytes.buffer),central=old.central+delta,end=old.end+delta;
  view.setUint16(entry.local+8,8,true);view.setUint32(entry.local+18,compressed.length,true);view.setUint32(entry.local+22,declaredSize??data.length,true);view.setUint16(central+10,8,true);view.setUint32(central+20,compressed.length,true);view.setUint32(central+24,declaredSize??data.length,true);view.setUint32(end+16,central,true);return bytes;}
async function descriptorZip(signature=true){const original=await singleEntry('entry.json',new TextEncoder().encode('{"ok":true}')),old=zipLayout(original),entry=old.records[0],length=signature?16:12,bytes=new Uint8Array(original.length+length);
  bytes.set(original.subarray(0,old.central));bytes.set(original.subarray(old.central),old.central+length);const view=new DataView(bytes.buffer),central=old.central+length,end=old.end+length;let p=old.central;
  if(signature){view.setUint32(p,0x08074b50,true);p+=4;}for(const [at,from] of [[0,14],[4,18],[8,22]])view.setUint32(p+at,old.view.getUint32(entry.local+from,true),true);
  view.setUint16(entry.local+6,0x808,true);for(const at of [14,18,22])view.setUint32(entry.local+at,0,true);view.setUint16(central+8,0x808,true);view.setUint32(end+16,central,true);return new Blob([bytes]);}
let pass=0;const test=async(title,fn)=>{try{await fn();pass++;console.log('PASS',title)}catch(e){console.error('FAIL',title,e);process.exitCode=1;}};
(async()=>{
  const model={name:'Logistics Hub',areas:[{id:'a',name:'Warehouse',sf:103000,basis:true}],tenants:[{id:'1',name:'Tenant X',base:14.35,steps:[{month:12,pct:.03}]}],mlas:[],years:10,exitCap:0.0675,discount:0.08,currency:'USD',custom:{futureFeature:'kept',zero:0,bool:false,nullable:null}};
  context.original=model;
  const portfolio={name:'New England Assets',scenarios:[{id:'sc-base',name:'Base Case'},{id:'sc-up',name:'Upside'}],properties:[{id:'a',scenarioId:'sc-base',include:true,model},{id:'b',scenarioId:'sc-up',include:false,model:{...model,name:'R&D Flex',tenants:[]}}]};context.samplePf=portfolio;
  await test('Property ZIP export/import preserves every input',async()=>{
    const bytes=await execute("basisCreateArchive({kind:'property',model:original})");
    context.bfile=new Blob([bytes]); const out=await execute('basisReadArchive(bfile)');assert.equal(out.kind,'property');assert.deepEqual(JSON.parse(JSON.stringify(out.model)),model);
    assert.equal(bytes[0],80);assert.equal(bytes[1],75);});
  await test('Portfolio ZIP retains names, memberships, inclusions and all model data',async()=>{
    const bytes=await execute("basisCreateArchive({kind:'portfolio',portfolio:samplePf})");context.pfile=new Blob([bytes]);const out=await execute('basisReadArchive(pfile)');
    assert.equal(out.kind,'portfolio');assert.deepEqual(JSON.parse(JSON.stringify(out.portfolio)),portfolio);
    assert.equal(bytes[0],80);assert.equal(bytes[1],75);});
  await test('ZIP corruption is rejected with CRC verification',async()=>{
    const b=new Uint8Array(await context.pfile.arrayBuffer());const hit=Buffer.from(b).indexOf(Buffer.from('New England Assets'));assert.ok(hit>0);b[hit]^=4;context.tampered=new Blob([b]);
    await assert.rejects(execute('basisReadArchive(tampered)'),/checksum/i);});
  await test('Future schema versions do not silently downgrade',async()=>{
    context.badVersion=await execute("basisZipWrite([{name:'manifest.json',data:JSON.stringify({format:BASIS_NATIVE_ID,schemaVersion:99,kind:'property'})}])");
    context.badBlob=new Blob([context.badVersion]);await assert.rejects(execute('basisReadArchive(badBlob)'),/Unsupported model format version/);});
  await test('Version 0 prototype manifest migrates to version 1 reader',async()=>{
    const legacy={format:'org.basisstudio.cre-model',schemaVersion:0,modelFile:'assets/model.json'};
    context.oldManifest=legacy;const bytes=await execute("basisZipWrite([{name:'manifest.json',data:JSON.stringify(oldManifest)},{name:'assets/model.json',data:JSON.stringify(original)}])");context.oldFile=new Blob([bytes]);
    const out=await execute('basisReadArchive(oldFile)');assert.equal(out.manifest.schemaVersion,1);assert.equal(out.model.name,model.name);});
  await test('Path traversal entries are forbidden',async()=>{
    assert.throws(()=>execute("basisZipWrite([{name:'../bad.json',data:'{}'}])"),/Unsafe archive path/);});
  await test('Prototype pollution markers are rejected',async()=>{
    context.badModel=JSON.parse('{"name":"Bad", "areas":[], "tenants":[], "mlas":[], "__proto__":{"admin":true}}');
    await assert.rejects(execute("basisCreateArchive({kind:'property',model:badModel})"),/Reserved model key/);});
  await test('Bad portfolio membership is rejected before any import',async()=>{
    context.badPf={...portfolio,properties:[{...portfolio.properties[0],scenarioId:'missing'}]};
    await assert.rejects(execute("basisCreateArchive({kind:'portfolio',portfolio:badPf})"),/membership/);
    const file=await rewriteArchive(context.pfile,(_manifest,files)=>{const meta=JSON.parse(Buffer.from(files.get('portfolio.json')));meta.properties[0].scenarioId='missing';files.set('portfolio.json',new TextEncoder().encode(JSON.stringify(meta)));},true);
    await assert.rejects(readArchive(file),/membership/);});
  await test('Model scientific notation and unicode round-trip',async()=>{
    context.uni={...model,name:'Café – Warehouse',custom:{min:1e-9,max:1e15,text:'東京'}};
    const bytes=await execute("basisCreateArchive({kind:'property',model:uni})");context.uniFile=new Blob([bytes]);
    const x=await execute('basisReadArchive(uniFile)');assert.deepEqual(JSON.parse(JSON.stringify(x.model)),context.uni);});
  await test('Every v1 payload requires one manifest checksum',async()=>{
    for(const change of [m=>{delete m.checksums;},m=>{m.checksums=[];},m=>{m.checksums=m.checksums.filter(x=>x.path!=='assets/model.json');},m=>{m.checksums.push(m.checksums[0]);}])await assert.rejects(readArchive(await rewriteArchive(context.bfile,change)),/checksum/i);
  });
  await test('Checksum metadata rejects malformed sizes, CRC and SHA even without Web Crypto',async()=>{
    const crypto=context.crypto;context.crypto=undefined;try{for(const change of [c=>{c.size='1';},c=>{c.size=1.5;},c=>{c.crc32=123;},c=>{c.sha256='invalid';},c=>{c.sha256=true;}])await assert.rejects(readArchive(await rewriteArchive(context.bfile,m=>change(m.checksums[0]))),/Invalid manifest checksum/);}finally{context.crypto=crypto;}
  });
  await test('Manifest CRC and SHA detect repacked payload tampering',async()=>{
    const change=(_m,files)=>{const model=JSON.parse(Buffer.from(files.get('assets/model.json')));model.name='Forged';files.set('assets/model.json',new TextEncoder().encode(JSON.stringify(model)));};
    await assert.rejects(readArchive(await rewriteArchive(context.bfile,change)),/File checksum mismatch/);
    const file=await rewriteArchive(context.bfile,(m,files)=>{change(m,files);const bytes=files.get('assets/model.json');context.checkBytes=bytes;const check=m.checksums.find(c=>c.path==='assets/model.json');check.size=bytes.length;check.crc32=execute('basisHex(basisCrc32(checkBytes))');});
    await assert.rejects(readArchive(file),/SHA-256 mismatch/);
  });
  await test('Version 1 requires an explicit model reference',async()=>{
    await assert.rejects(readArchive(await rewriteArchive(context.bfile,m=>{delete m.modelFile;})),/Manifest requires modelFile/);
  });
  await test('Portfolio export rejects duplicate IDs and malformed inclusion flags',async()=>{
    for(const candidate of [{...portfolio,scenarios:[portfolio.scenarios[0],portfolio.scenarios[0]]},{...portfolio,properties:[portfolio.properties[0],portfolio.properties[0]]},{...portfolio,properties:[{...portfolio.properties[0],include:'false'}]}]){context.invalidPortfolio=candidate;await assert.rejects(execute("basisCreateArchive({kind:'portfolio',portfolio:invalidPortfolio})"),/duplicate|Duplicate|inclusion/);}
  });
  await test('Portfolio import rejects duplicate IDs and malformed inclusion flags',async()=>{
    for(const change of [m=>{m.scenarios.push(m.scenarios[0]);},m=>{m.properties.push(m.properties[0]);},m=>{m.properties[0].include='false';}]){const file=await rewriteArchive(context.pfile,(_manifest,files)=>{const meta=JSON.parse(Buffer.from(files.get('portfolio.json')));change(meta);files.set('portfolio.json',new TextEncoder().encode(JSON.stringify(meta)));},true);await assert.rejects(readArchive(file),/duplicate|Duplicate|inclusion/);}
  });
  await test('ZIP local flags, sizes and CRC must match the directory',async()=>{
    for(const change of [({view,records})=>view.setUint16(records[0].local+6,1,true),({view,records})=>view.setUint32(records[0].local+14,0,true),({view,records})=>view.setUint32(records[0].local+22,1,true)])await assert.rejects(readZip(await mutateZip(context.bfile,change)),/Damaged ZIP entry|local header mismatch/);
  });
  await test('Unsupported flags, per-entry disks and central-directory gaps are rejected',async()=>{
    for(const change of [({view,records})=>view.setUint16(records[0].central+8,0x840,true),({view,records})=>view.setUint16(records[0].central+34,1,true),({view,end})=>view.setUint32(end+12,view.getUint32(end+12,true)-1,true)])await assert.rejects(readZip(await mutateZip(context.bfile,change)),/Unsupported/);
  });
  await test('ZIP payloads cannot overlap the central directory',async()=>{
    await assert.rejects(readZip(await mutateZip(context.bfile,({view,records,central})=>{view.setUint32(records[0].central+20,central,true);view.setUint32(records[0].central+24,central,true);})),/Invalid ZIP entry location/);
  });
  await test('Overlapping local entry ranges are rejected',async()=>{
    const data=new TextEncoder().encode('{"inner":true}'),inner=await singleEntry('inner.json',data),innerLayout=zipLayout(inner),outer=await writeEntries([{name:'wrapper.json',data:inner.subarray(0,innerLayout.central)},{name:'inner.json',data}]),layout=zipLayout(outer);
    layout.view.setUint32(layout.records[1].central+42,layout.records[0].start,true);await assert.rejects(readZip(new Blob([outer])),/Overlapping ZIP entries/);
  });
  await test('Both normal ZIP data-descriptor layouts remain interoperable',async()=>{
    for(const signature of [true,false]){const out=await readZip(await descriptorZip(signature));assert.equal(Buffer.from(out.get('entry.json')).toString(),'{"ok":true}');}
  });
  await test('Damaged ZIP data descriptors are rejected',async()=>{
    await assert.rejects(readZip(await mutateZip(await descriptorZip(),({view,central})=>view.setUint32(central-4,0,true))),/data descriptor/);
  });
  await test('ZIP64 and malformed extra fields are rejected',async()=>{
    for(const [id,size] of [[1,0],[0x9999,1]]){const original=await singleEntry('entry.json',new TextEncoder().encode('{}')),old=zipLayout(original),at=old.central+46+old.view.getUint16(old.central+28,true),bytes=new Uint8Array(original.length+4);
      bytes.set(original.subarray(0,at));bytes.set(original.subarray(at),at+4);const view=new DataView(bytes.buffer);view.setUint16(old.central+30,4,true);view.setUint16(at,id,true);view.setUint16(at+2,size,true);view.setUint32(old.end+4+12,old.view.getUint32(old.end+12,true)+4,true);await assert.rejects(readZip(new Blob([bytes])),/ZIP64|extra field/);}
  });
  await test('Descriptor flags require a matching data descriptor',async()=>{
    await assert.rejects(readZip(await mutateZip(new Blob([await singleEntry('entry.json',new TextEncoder().encode('{}'))]),({view,records})=>{view.setUint16(records[0].local+6,0x808,true);view.setUint16(records[0].central+8,0x808,true);})),/Missing ZIP data descriptor/);
  });
  await test('DEFLATE entries decode with CRC verification',async()=>{
    const data=new TextEncoder().encode(JSON.stringify(model)),file=new Blob([await singleEntry('entry.json',data,8)]),files=await readZip(file);assert.deepEqual(Buffer.from(files.get('entry.json')),Buffer.from(data));
  });
  await test('DEFLATE expansion stops at its declared size',async()=>{
    const compressed=await singleEntry('bomb.json',new Uint8Array(1024*1024).fill(97),8,16);await assert.rejects(readZip(new Blob([compressed])),/expanded size limit/);
  });
  await test('Reader rejects unsafe ZIP paths independently of writer validation',async()=>{
    const bytes=await singleEntry('safe.json',new TextEncoder().encode('{}')),layout=zipLayout(bytes),name=new TextEncoder().encode('../x.json');bytes.set(name,layout.records[0].local+30);bytes.set(name,layout.records[0].central+46);await assert.rejects(readZip(new Blob([bytes])),/Unsafe archive path/);
  });
  await test('Deep JSON is rejected with a recoverable error',async()=>{
    let nested={};for(let i=0;i<74;i++)nested={child:nested};context.deepModel={...model,custom:nested};await assert.rejects(execute("basisCreateArchive({kind:'property',model:deepModel})"),/nesting or size limit/);
  });
  await test('Version 0 default model path and optional integrity table remain compatible',async()=>{
    const manifest={format:'org.basisstudio.cre-model',schemaVersion:0},parts=[{name:'manifest.json',data:JSON.stringify(manifest)},{name:'assets/model.json',data:JSON.stringify(model)}];
    const file=new Blob([await writeEntries(parts)]),out=await readArchive(file);assert.equal(out.model.name,model.name);assert.equal(out.manifest.modelFile,'assets/model.json');await assert.rejects(readArchive(await rewriteArchive(file,m=>{m.checksums=[];})),/Missing manifest checksum/);
  });
  await test('Omitted portfolio inclusion flags default to true',async()=>{
    context.defaultInclusion={...portfolio,properties:[{id:'one',scenarioId:'sc-base',model}]};const bytes=await execute("basisCreateArchive({kind:'portfolio',portfolio:defaultInclusion})"),out=await readArchive(new Blob([bytes]));assert.equal(out.portfolio.properties[0].include,true);
  });
  await test('Checked-in sample archives still load',async()=>{
    for(const name of ['sample-property.basiscre','sample-portfolio.basiscre']){const out=await readArchive(new Blob([fs.readFileSync(path.join(__dirname,'..','samples',name))]));assert.ok(['property','portfolio'].includes(out.kind));}
  });
  await test('SHA remains optional when Web Crypto is unavailable',async()=>{
    const crypto=context.crypto;context.crypto=undefined;try{const bytes=await execute("basisCreateArchive({kind:'property',model:original})"),out=await readArchive(new Blob([bytes]));assert.deepEqual(plain(out.model),model);assert.equal(out.manifest.checksums[0].sha256,null);}finally{context.crypto=crypto;}
  });
  const rejectsModel=async(candidate,pattern)=>{context.invalidModel=candidate;await assert.rejects(execute("basisCreateArchive({kind:'property',model:invalidModel})"),pattern);
    const forged=await rewriteArchive(context.bfile,(_m,files)=>files.set('assets/model.json',new TextEncoder().encode(JSON.stringify(candidate))),true);await assert.rejects(readArchive(forged),pattern);};
  await test('Analysis dates and periods reject fractional, unsafe and impossible components',async()=>{
    for(const [key,values] of [['years',[0,1.5,101,'10']],['startMonth',[0,1.5,13,'1']],['startYear',[999,2026.5,9900,1e300,'2026']]])for(const value of values)await rejectsModel({...model,[key]:value},new RegExp(key));
  });
  await test('All engine record collections reject null members and invalid array shapes',async()=>{
    for(const key of 'areas groundLeases infl mlas mrents frees cpis tis lcs misc parking storage ops nonops caps egroups tenants recs tgroups acqCosts indices ranges payTimes actuals budgets saleAdj saleDed dcAdj classes ties portfolio absorb loans srcLog'.split(' '))for(const value of [null,{},[null],[[]],['record']])await rejectsModel({...model,[key]:value},new RegExp(key));
  });
  await test('Present record IDs must be nonempty strings unique within their collection',async()=>{
    for(const key of ['areas','tenants','mlas','ops','recs','infl'])for(const rows of [[{id:''}],[{id:null}],[{id:12}],[{id:'same'},{id:'same'}]])await rejectsModel({...model,[key]:rows},/id|duplicate IDs/);
  });
  await test('Known child lists reject malformed schedules, windows and recovery lines',async()=>{
    for(const [parent,child] of [['areas','sched'],['mlas','sched'],['tenants','sched'],['tenants','areaSched'],['tenants','miscRents'],['tenants','freeList'],['tenants','prCats'],['recs','lines'],['ranges','entries']])for(const value of [null,{},[null],[[]]])await rejectsModel({...model,[parent]:[{id:'parent',[child]:value}]},new RegExp(child));
    await rejectsModel({...model,tenants:[{id:'parent',sched:[{id:'same'},{id:'same'}]}]},/duplicate IDs/);
  });
  await test('Known dates reject invalid calendars and non-scalar values before compute',async()=>{
    for(const value of ['2026','2026-13','2026-00','2026-02-29','2024-02-30','2026-01-00','10000-01','2026-01-01 trailing',{},42])await rejectsModel({...model,tenants:[{id:'t',start:value}]},/calendar date/);
    await rejectsModel({...model,purchaseDate:'2026-02-31'},/purchaseDate/);
    await rejectsModel({...model,areas:[{id:'a',sched:[{date:'2026-14',sf:5}]}]},/calendar date/);
  });
  await test('Known numeric inputs, references and inflation rates reject object payloads',async()=>{
    for(const candidate of [{...model,tenants:[{sf:{value:5}}]},{...model,tenants:[{mla:{id:'m'}}]},{...model,mlas:[{name:12}]},{...model,infl:[{id:'i',rates:{year1:.03}}]},{...model,infl:[{id:'i',rates:[{}]}]},{...model,pos:[]}])await rejectsModel(candidate,/number|string|array|object/);
  });
  await test('Work-driving lease terms, downtime and payment spreads are bounded',async()=>{
    for(const candidate of [{...model,mlas:[{termYears:1e300}]},{...model,mlas:[{termYears:'1e300'}]},{...model,mlas:[{termYears:100,termMonths:1}]},{...model,mlas:[{downtime:1e300}]},{...model,tenants:[{termYears:1e300}]},{...model,tenants:[{optTermMonths:1e300}]},{...model,tenants:[{hoMonths:1e300}]},{...model,tenants:[{sched:[{month:1e300}]}]},{...model,payTimes:[{mode:'spread',months:1e300}]},{...model,tenants:[{start:'2026-01',end:'2126-01'}]}])await rejectsModel(candidate,/1200-month/);
  });
  await test('Absorption rejects huge counts, tiny units and non-progressing reabsorption',async()=>{
    const block={id:'block',start:'2026-01',sf:100,leases:1};
    for(const candidate of [{...model,absorb:[{...block,leases:1e300}]},{...model,absorb:[{...block,sizeBy:'sf',sfPer:1e-300}]},{...model,absorb:[{...block,sf:1e-300}],tenants:[{id:'t',expiry:'Reabsorb',reabsorbTo:'block',sf:100,start:'2025-01',end:'2025-12'}]},{...model,absorb:[{...block,every:1e300}]}])await rejectsModel(candidate,/computation limit/);
  });
  await test('Embedded property models receive the same structural checks',async()=>{
    await rejectsModel({...model,portfolio:[{id:'member',model:{name:'Child',tenants:[null]}}]},/portfolio.*tenants/);
    await rejectsModel({...model,portfolio:[{id:'member',include:'false',model:{name:'Child'}}]},/include.*boolean/);
  });
  await test('Partial models, legacy numeric text and unknown additive data still round-trip',async()=>{
    for(const candidate of [{name:'Name-only snapshot'},{...model,startYear:2026,startMonth:2,years:100,custom:{records:[null,{},42],future:{month:1e100}},tenants:[{name:'Partial tenant',sf:'1,000',rent:'$14.35',step:'3%',start:'2024-02-29',end:'2030-01',sched:[{date:'2025-01',amt:'$15.50',custom:{nested:true}}]}],areas:[{id:'same',sf:'1,000',basis:true}],mlas:[{id:'same',termYears:'5',termMonths:'6',downtime:'3'}],infl:[{id:'none',rates:[0,'3%',null]}],groundLeases:[{id:'g',termYears:150}],portfolio:[{id:'child',include:false,model:{name:'Child'}}]}]){context.compatibleModel=candidate;const bytes=await execute("basisCreateArchive({kind:'property',model:compatibleModel})"),out=await readArchive(new Blob([bytes]));assert.deepEqual(plain(out.model),candidate);}
  });
  await test('Current full blank and sample application states remain valid native models',async()=>{
    const html=fs.readFileSync(path.join(__dirname,'..','app','index.html'),'utf8'),start=html.indexOf('const $='),end=html.indexOf('/* =========================== PROPERTY FILE');assert.ok(start>=0&&end>start);
    const engine=vm.createContext({});vm.runInContext(html.slice(start,end),engine,{timeout:5000});
    for(const factory of ['blankState','sampleState']){const state=vm.runInContext(factory+'()',engine,{timeout:5000});context.fullModel=plain(state);const bytes=await execute("basisCreateArchive({kind:'property',model:fullModel})"),out=await readArchive(new Blob([bytes]));assert.deepEqual(plain(out.model),plain(state));}
  });
  await test('Importer-generated year-only recovery base years round-trip unchanged',async()=>{
    const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','base-year-model.json'),'utf8'));context.baseYearFixture=fixture;
    const bytes=await execute("basisCreateArchive({kind:'property',model:baseYearFixture})"),out=await readArchive(new Blob([bytes]));assert.deepEqual(plain(out.model),fixture);
    for(const baseYear of [2024,'2024-01','2024-02-29',null,'']){context.baseYearFixture={...fixture,tenants:[{...fixture.tenants[0],baseYear}]};const bytes=await execute("basisCreateArchive({kind:'property',model:baseYearFixture})"),out=await readArchive(new Blob([bytes]));assert.equal(out.model.tenants[0].baseYear,baseYear);}
  });
  await test('Base-year compatibility keeps invalid years and ordinary year-only dates rejected',async()=>{
    for(const baseYear of ['999','0999','10000',999,2024.5,10000,'2024-13',{},false])await rejectsModel({...model,tenants:[{baseYear}]},/baseYear/);
    for(const key of ['start','end','breakDate','tiDate','availDate'])await rejectsModel({...model,tenants:[{[key]:'2024'}]},new RegExp(key));
    await rejectsModel({...model,purchaseDate:'2024'},/purchaseDate/);
  });
  await test('Native portfolios retain independent versioned scenario settings and additive metadata',async()=>{
    const settings={version:1,portDisc:.12,portCap:.08,portSingleExit:true,portResaleNoi:'trailing',future:{flag:false,value:0}};
    const expected={...portfolio,scenarios:[{...portfolio.scenarios[0],settings,notes:{future:['kept']}},{...portfolio.scenarios[1],settings:{version:1,portDisc:0,portCap:0,portSingleExit:false,portResaleNoi:'forward'}}],properties:portfolio.properties.map(p=>({...p,model:{...p.model,portDisc:.33,portCap:.22,portSingleExit:false,portResaleNoi:'forward'}}))};
    context.settingsPortfolio=expected;const bytes=await execute("basisCreateArchive({kind:'portfolio',portfolio:settingsPortfolio})"),out=await readArchive(new Blob([bytes]));assert.deepEqual(plain(out.portfolio),expected);
  });
  await test('Legacy native scenarios remain unmigrated and preserve unknown additive fields on read',async()=>{
    const expected={...portfolio,scenarios:portfolio.scenarios.map(s=>({...s,future:{metadata:0}}))};context.settingsPortfolio=expected;
    const bytes=await execute("basisCreateArchive({kind:'portfolio',portfolio:settingsPortfolio})"),out=await readArchive(new Blob([bytes]));assert.deepEqual(plain(out.portfolio),expected);assert.equal(Object.hasOwn(out.portfolio.scenarios[0],'settings'),false);
  });
  await test('Native export and import reject unsupported or malformed stored scenario settings',async()=>{
    const valid={version:1,portDisc:.1,portCap:.08,portSingleExit:false,portResaleNoi:'forward'};
    for(const settings of [null,{}, {...valid,version:2},{...valid,portDisc:'0.1'},{...valid,portDisc:-1},{...valid,portCap:-.01},{...valid,portSingleExit:'false'},{...valid,portSingleExit:true,portCap:0},{...valid,portResaleNoi:'unknown'}]){
      context.settingsPortfolio={...portfolio,scenarios:portfolio.scenarios.map((s,i)=>i?s:{...s,settings})};await assert.rejects(execute("basisCreateArchive({kind:'portfolio',portfolio:settingsPortfolio})"),/settings|Scenario|scenario|version/);
      const file=await rewriteArchive(context.pfile,(_manifest,files)=>{const meta=JSON.parse(Buffer.from(files.get('portfolio.json')));meta.scenarios[0].settings=settings;files.set('portfolio.json',new TextEncoder().encode(JSON.stringify(meta)));},true);await assert.rejects(readArchive(file),/settings|Scenario|scenario|version/);
    }
  });
  console.log('RESULT',pass,'tests passed');
})();
