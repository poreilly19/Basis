/* BEGIN BASIS NATIVE ARCHIVE V1: independently specified .basiscre ZIP/JSON model. */
const BASIS_NATIVE_ID='org.basisstudio.cre-model';
const BASIS_NATIVE_EXT='.basiscre';
const BASIS_NATIVE_VERSION=1;
const BASIS_NATIVE_LIMIT=64*1024*1024;
const BASIS_NATIVE_ENTRY_LIMIT=24*1024*1024;
const basisUTF8=new TextEncoder(), basisText=new TextDecoder('utf-8',{fatal:true});
const basisEnc=x=>basisUTF8.encode(typeof x==='string'?x:JSON.stringify(x));
function basisCrc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^(c&1?0xedb88320:0);}return(c^0xffffffff)>>>0;}
const basisHex=n=>n.toString(16).padStart(8,'0');
async function basisSha256(bytes){if(typeof crypto==='undefined'||!crypto.subtle)return null;const h=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));return Array.from(h,b=>b.toString(16).padStart(2,'0')).join('');}
function basisPath(s){if(typeof s!=='string'||!s||s.length>180||s.startsWith('/')||s.includes('\\')||s.split('/').some(p=>!p||p==='.'||p==='..')||!/^[a-zA-Z0-9_./-]+$/.test(s))throw Error('Unsafe archive path');return s;}
function basisPlain(x){return x!==null&&typeof x==='object'&&!Array.isArray(x);}
function basisValidateJSON(root){let count=0;function visit(v,d){if(++count>300000||d>72)throw Error('Model nesting or size limit exceeded');if(typeof v==='number'&&!Number.isFinite(v))throw Error('Model includes non-finite number');if(typeof v==='object'&&v!==null){for(const k of Object.keys(v)){if(k==='__proto__'||k==='prototype'||k==='constructor')throw Error('Reserved model key is not supported');visit(v[k],d+1);}}}visit(root,0);}
/* Structural checks protect the application before it computes imported input. Optional
   fields stay optional; money/rates may retain legacy numeric text and additive fields. */
function basisValidateModel(s){
  if(!basisPlain(s))throw Error('Property model must be a JSON object');basisValidateJSON(s);
  const collections='areas groundLeases infl mlas mrents frees cpis tis lcs misc parking storage parks stors ops nonops caps egroups tenants recs tgroups acqCosts indices ranges payTimes actuals budgets saleAdj saleDed dcAdj classes ties portfolio absorb loans srcLog'.split(' ');
  const references='rec optRec recRef mla cpi optCpi cpiRef pool mrNewRef mrRenewRef frRef tiRef lcRef inflRef inflRef2 minInfl maxInfl tiInflRef growthRef prGrowthRef tenant ofLine group reabsorbTo crOf tiTiming lcTiming incTiming paySched'.split(' ');
  const amounts='sf rent step free freeStart freePct termYears termMonths optTermYears optTermMonths optFree hoMonths amt amt2 rate pct spaces units occ every leases sfPer months downtime mrNewLocal mrRenewLocal renewProb stepPct newMo renewMo newPSF renewPSF newPct renewPct firstAfter everyN pass floor cap fixed grossUp adminFee sales breakpoint rate2 break2 from to'.split(' ');
  const monthLimit=1200,leaseLimit=10000;
  const invalid=(label,message)=>{throw Error(label+' '+message);};
  const scalar=(record,label)=>{
    if(record.name!==undefined&&record.name!==null&&(typeof record.name!=='string'||record.name.length>1000))invalid(label+'.name','must be a string up to 1000 characters');
    for(const key of references)if(record[key]!==undefined&&record[key]!==null&&typeof record[key]!=='string')invalid(label+'.'+key,'must be a string reference');
    for(const key of amounts){const value=record[key];if(value!==undefined&&value!==null&&typeof value!=='number'&&typeof value!=='string')invalid(label+'.'+key,'must be a number or numeric text');}
  };
  const date=(value,label)=>{
    if(value===undefined||value===null||value==='')return;
    if(typeof value!=='string')invalid(label,'must be a calendar date');
    const match=/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/.exec(value),year=match?+match[1]:0,month=match?+match[2]:0,day=match&&match[3]?+match[3]:1;
    const days=[31,year%4===0&&(year%100!==0||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
    if(!match||year<1000||month<1||month>12||day<1||day>days[month-1])invalid(label,'must be a valid YYYY-MM or YYYY-MM-DD calendar date');
  };
  // Existing workbook/document importers store recovery base years as YYYY.
  const baseYear=(value,label)=>{if((typeof value==='string'&&/^[1-9]\d{3}$/.test(value))||(Number.isInteger(value)&&value>=1000&&value<=9999))return;date(value,label);};
  const rows=(owner,key,label,dates=[])=>{
    if(owner[key]===undefined)return [];
    if(!Array.isArray(owner[key]))invalid(label+'.'+key,'must be an array');
    const ids=new Set();for(const [index,record] of owner[key].entries()){const at=label+'.'+key+'['+index+']';if(!basisPlain(record))invalid(at,'must be an object');
      if(record.id!==undefined){if(typeof record.id!=='string'||!record.id||record.id.length>1000)invalid(at+'.id','must be a nonempty string up to 1000 characters');if(ids.has(record.id))invalid(label+'.'+key,'contains duplicate IDs');ids.add(record.id);}
      scalar(record,at);for(const key of dates)date(record[key],at+'.'+key);}
    return owner[key];
  };
  // Match the engine's legacy numeric-text coercion for the fields that drive work.
  const number=(value,label)=>{if(value===undefined||value===null||value==='')return 0;if(typeof value!=='number'&&typeof value!=='string')invalid(label,'must be numeric');
    const text=typeof value==='string'?value.replace(/[$,\s%]/g,''):value,n=typeof text==='number'?text:parseFloat(text);if(text==='')return 0;if(!Number.isFinite(n))invalid(label,'must be finite numeric input');return n;};
  const months=(value,label,scale=1)=>{const n=number(value,label)*scale;if(!Number.isFinite(n)||Math.abs(n)>monthLimit)invalid(label,'exceeds the 1200-month computation limit');return n;};
  const term=(record,label,prefix='')=>{const y=prefix?prefix+'TermYears':'termYears',m=prefix?prefix+'TermMonths':'termMonths';
    const total=months(record[y],label+'.'+y,12)+months(record[m],label+'.'+m);if(Math.abs(total)>monthLimit)invalid(label,'term exceeds the 1200-month computation limit');};
  const check=(model,label)=>{
    if(!basisPlain(model))invalid(label,'must be a JSON object');
    if(typeof model.name!=='string'||model.name.length>1000)invalid(label,'name is required and must be a string up to 1000 characters');
    if(model.years!==undefined&&(!Number.isInteger(model.years)||model.years<1||model.years>100))invalid(label+'.years','must be an integer from 1 to 100');
    if(model.startYear!==undefined&&(!Number.isInteger(model.startYear)||model.startYear<1000||model.startYear>9899))invalid(label+'.startYear','must be an integer from 1000 to 9899');
    if(model.startMonth!==undefined&&(!Number.isInteger(model.startMonth)||model.startMonth<1||model.startMonth>12))invalid(label+'.startMonth','must be an integer from 1 to 12');
    for(const key of 'purchaseDate reportStart reportEnd actEnd budEnd valDate ib_misc ib_op ib_cap ib_non ib_mkt'.split(' '))date(model[key],label+'.'+key);
    if(model.pos!==undefined&&model.pos!==null&&!basisPlain(model.pos))invalid(label+'.pos','must be an object');
    for(const key of collections)rows(model,key,label);
    for(const key of ['misc','parking','storage','groundLeases','loans','absorb','tenants'])for(const [i,record] of (model[key]||[]).entries())for(const field of (key==='absorb'?['start','avail']:key==='tenants'?['start','end','mtmEnd','breakDate','tiDate','lcDate','incDate','availDate']:['start','end']))date(record[field],label+'.'+key+'['+i+'].'+field);
    for(const key of ['ops','nonops','caps'])for(const [i,record] of (model[key]||[]).entries())date(record.amt2Start,label+'.'+key+'['+i+'].amt2Start');
    for(const [key,children] of [['areas',['sched']],['mlas',['sched']],['tenants',['sched','areaSched','miscRents','freeList','prCats']],['recs',['lines']],['ranges',['entries']]])for(const [i,record] of (model[key]||[]).entries()){
      const at=label+'.'+key+'['+i+']';for(const child of children){const dates=child==='sched'||child==='areaSched'?['date']:child==='miscRents'?['start','end']:[];
        for(const [j,row] of rows(record,child,at,dates).entries())if(child==='sched')months(row.month,at+'.'+child+'['+j+'].month');}
    }
    for(const [i,series] of (model.infl||[]).entries())if(series.rates!==undefined){if(!Array.isArray(series.rates))invalid(label+'.infl['+i+'].rates','must be an array');for(const value of series.rates)if(value!==null&&typeof value!=='number'&&typeof value!=='string')invalid(label+'.infl['+i+'].rates','must contain numbers or numeric text');}
    for(const [i,profile] of (model.mlas||[]).entries()){const at=label+'.mlas['+i+']';term(profile,at);months(profile.downtime,at+'.downtime');}
    for(const [i,tenant] of (model.tenants||[]).entries()){const at=label+'.tenants['+i+']';baseYear(tenant.baseYear,at+'.baseYear');term(tenant,at);term(tenant,at,'opt');months(tenant.hoMonths,at+'.hoMonths');
      if(tenant.groups!==undefined){const groups=tenant.groups;
        if(!Array.isArray(groups)||groups.length>1000||groups.some(id=>typeof id!=='string'||!id||id.length>1000))invalid(at+'.groups','must be an array of at most 1000 nonempty string references');
        if(new Set(groups).size!==groups.length)invalid(at+'.groups','contains duplicate group IDs');}
      if(tenant.start&&tenant.end){const month=value=>+value.slice(0,4)*12+Number(value.split('-')[1]);if(month(tenant.end)-month(tenant.start)+1>monthLimit)invalid(at,'lease dates exceed the 1200-month computation limit');}}
    for(const [i,schedule] of (model.payTimes||[]).entries())if(schedule.mode==='spread')months(schedule.months,label+'.payTimes['+i+'].months');
    let generated=0;for(const [i,block] of (model.absorb||[]).entries()){const at=label+'.absorb['+i+']';if(block.on===false||!block.start)continue;
      const sf=number(block.sf,at+'.sf');if(sf<=0)continue;months(block.every,at+'.every');const per=number(block.sfPer,at+'.sfPer'),bySF=block.sizeBy==='sf'&&per>0;
      const count=bySF?Math.max(1,Math.ceil(sf/per-1e-9)):Math.max(1,Math.round(number(block.leases,at+'.leases')||1));generated+=count;
      const size=bySF?per:sf/count;for(const tenant of (model.tenants||[]))if(tenant.expiry==='Reabsorb'&&tenant.reabsorbTo===block.id){let area=number(tenant.sf,at+' linked tenant area');
        const changes=(tenant.areaSched||[]).filter(x=>x.date).slice().sort((a,b)=>a.date<b.date?-1:1);if(changes.length)area=number(changes[changes.length-1].sf,at+' linked tenant area');if(area>0)generated+=Math.max(1,Math.ceil(area/size));}
      if(!Number.isFinite(generated)||generated>leaseLimit)invalid(at,'exceeds the 10000 generated-lease computation limit');}
    for(const [i,member] of (model.portfolio||[]).entries()){if(member.include!==undefined&&typeof member.include!=='boolean')invalid(label+'.portfolio['+i+'].include','must be boolean');if(member.model!==undefined&&member.model!==null)check(member.model,label+'.portfolio['+i+'].model');}
    return model;
  };
  return check(s,'Property');}
/* ZIP writer uses method 0 (STORE), for full browser portability and external unzip compatibility.
   Every entry includes a normal ZIP CRC-32; optional SHA-256 digests protect content integrity. */
function basisZipWrite(entries){if(entries.length>256)throw Error('Too many ZIP entries');let offset=0,total=0;const locals=[],centrals=[],names=new Set();
  const u16=(v,x,n)=>v.setUint16(x,n,true),u32=(v,x,n)=>v.setUint32(x,n>>>0,true);
  for(const it of entries){const name=basisPath(it.name);if(names.has(name))throw Error('Duplicate ZIP path');names.add(name);
    const nb=basisEnc(name),data=it.data instanceof Uint8Array?it.data:basisEnc(it.data),len=data.length;
    total+=len;if(len>BASIS_NATIVE_ENTRY_LIMIT||total>BASIS_NATIVE_LIMIT)throw Error('Archive exceeds size limits');
    const crc=basisCrc32(data),lh=new Uint8Array(30+nb.length),lv=new DataView(lh.buffer);
    u32(lv,0,0x04034b50);u16(lv,4,20);u16(lv,6,0x800);u16(lv,8,0);u16(lv,10,0);u16(lv,12,0x21);
    u32(lv,14,crc);u32(lv,18,len);u32(lv,22,len);u16(lv,26,nb.length);u16(lv,28,0);lh.set(nb,30);locals.push(lh,data);
    const ch=new Uint8Array(46+nb.length),cv=new DataView(ch.buffer);
    u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0x800);u16(cv,10,0);u16(cv,12,0);u16(cv,14,0x21);
    u32(cv,16,crc);u32(cv,20,len);u32(cv,24,len);u16(cv,28,nb.length);u16(cv,30,0);u16(cv,32,0);u16(cv,34,0);u16(cv,36,0);u32(cv,38,0);u32(cv,42,offset);ch.set(nb,46);centrals.push(ch);
    offset+=lh.length+len;}
  const centralSize=centrals.reduce((n,u)=>n+u.length,0),end=new Uint8Array(22),dv=new DataView(end.buffer);
  u32(dv,0,0x06054b50);u16(dv,4,0);u16(dv,6,0);u16(dv,8,entries.length);u16(dv,10,entries.length);u32(dv,12,centralSize);u32(dv,16,offset);u16(dv,20,0);
  const result=new Uint8Array(offset+centralSize+22);let p=0;for(const part of [...locals,...centrals,end]){result.set(part,p);p+=part.length;}return result;}
async function basisZipRead(file){if(file.size>BASIS_NATIVE_LIMIT+2*1024*1024)throw Error('Archive is too large');
  const u=new Uint8Array(await file.arrayBuffer()),d=new DataView(u.buffer,u.byteOffset,u.byteLength);if(u.length>BASIS_NATIVE_LIMIT+2*1024*1024)throw Error('Archive is too large');if(u.length<22)throw Error('Invalid ZIP archive');
  let end=-1;for(let i=u.length-22;i>=Math.max(0,u.length-65557);i--){if(d.getUint32(i,true)===0x06054b50&&i+22+d.getUint16(i+20,true)===u.length){end=i;break;}}
  if(end<0)throw Error('Invalid ZIP end record');const n=d.getUint16(end+10,true),nDisk=d.getUint16(end+8,true),csize=d.getUint32(end+12,true),centralStart=d.getUint32(end+16,true);let p=centralStart;
  if(n!==nDisk||n>256||d.getUint16(end+4,true)!==0||d.getUint16(end+6,true)!==0||p+csize!==end)throw Error('Unsupported ZIP structure');
  const entries=[],names=new Set(),expectedEnd=p+csize;let total=0;
  const extra=(start,len)=>{const end=start+len;while(start<end){if(start+4>end)throw Error('Invalid ZIP extra field');const id=d.getUint16(start,true),size=d.getUint16(start+2,true);start+=4;if(id===1)throw Error('ZIP64 is not supported');if(start+size>end)throw Error('Invalid ZIP extra field');start+=size;}};
  for(let i=0;i<n;i++){
    if(p+46>expectedEnd||d.getUint32(p,true)!==0x02014b50)throw Error('Damaged ZIP directory');
    const flags=d.getUint16(p+8,true),method=d.getUint16(p+10,true),crc=d.getUint32(p+16,true),compressed=d.getUint32(p+20,true),raw=d.getUint32(p+24,true),nl=d.getUint16(p+28,true),ex=d.getUint16(p+30,true),comment=d.getUint16(p+32,true),local=d.getUint32(p+42,true);
    const allowedFlags=0x808|(method===8?6:0);
    if(flags&~allowedFlags||![0,8].includes(method)||d.getUint16(p+34,true)!==0||raw>BASIS_NATIVE_ENTRY_LIMIT||compressed>BASIS_NATIVE_ENTRY_LIMIT||raw>(compressed||1)*200)throw Error('Unsupported or oversized ZIP entry');
    if(p+46+nl+ex+comment>expectedEnd)throw Error('Truncated ZIP directory');
    extra(p+46+nl,ex);const name=basisPath(basisText.decode(u.subarray(p+46,p+46+nl)));if(names.has(name))throw Error('Duplicate ZIP file');names.add(name);
    if(local+30>centralStart||d.getUint32(local,true)!==0x04034b50||d.getUint16(local+6,true)!==flags||d.getUint16(local+8,true)!==method)throw Error('Damaged ZIP entry');
    const lnl=d.getUint16(local+26,true),lex=d.getUint16(local+28,true),s=local+30+lnl+lex;
    if(s+compressed>centralStart||basisText.decode(u.subarray(local+30,local+30+lnl))!==name)throw Error('Invalid ZIP entry location');
    extra(local+30+lnl,lex);let entryEnd=s+compressed;
    for(const [at,value] of [[14,crc],[18,compressed],[22,raw]]){const actual=d.getUint32(local+at,true);if(actual!==value&&(!(flags&8)||actual!==0))throw Error('ZIP local header mismatch');}
    if(flags&8){let q=entryEnd;if(q+12>centralStart)throw Error('Missing ZIP data descriptor');
      // CRC itself can equal the optional signature, so test both descriptor layouts.
      const matches=at=>at+12<=centralStart&&d.getUint32(at,true)===crc&&d.getUint32(at+4,true)===compressed&&d.getUint32(at+8,true)===raw;
      if(d.getUint32(q,true)===0x08074b50&&matches(q+4))q+=4;else if(!matches(q))throw Error('Invalid ZIP data descriptor');entryEnd=q+12;}
    total+=raw;if(total>BASIS_NATIVE_LIMIT)throw Error('Archive expansion limit exceeded');entries.push({name,method,crc,raw,s,compressed,local,end:entryEnd});p+=46+nl+ex+comment;
  }
  if(p!==expectedEnd)throw Error('Unexpected ZIP directory bytes');
  const ranges=[...entries].sort((a,b)=>a.local-b.local);for(let i=1;i<ranges.length;i++)if(ranges[i].local<ranges[i-1].end)throw Error('Overlapping ZIP entries');
  const out=new Map();for(const entry of entries){const {name,method,crc,raw,s,compressed}=entry,bytes=u.subarray(s,s+compressed);let plain;
    if(method===0){if(raw!==compressed)throw Error('Invalid STORE entry');plain=bytes;}
    else{if(typeof DecompressionStream==='undefined')throw Error('Compressed ZIP not supported in this browser');
      const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),chunks=[];let length=0;
      try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>raw)throw Error('ZIP expanded size limit exceeded for '+name);chunks.push(value);}}
      catch(e){try{await reader.cancel();}catch(ignore){}throw e;}finally{reader.releaseLock();}
      plain=new Uint8Array(length);let offset=0;for(const chunk of chunks){plain.set(chunk,offset);offset+=chunk.length;}}
    if(plain.length!==raw||basisCrc32(plain)!==crc)throw Error('ZIP checksum mismatch for '+name);out.set(name,plain);
  }
  return out;}
function basisRequireJSON(files,name){basisPath(name);const b=files.get(name);if(!b)throw Error('Missing required file: '+name);let v;try{v=JSON.parse(basisText.decode(b));}catch(e){throw Error('Invalid JSON in '+name);}basisValidateJSON(v);return v;}
/* Version migration registry. Draft prototype v0 had one model reference rather than portfolio.json.
   Version 1 is canonical. Migration never alters rent assumptions or financial model fields. */
function basisUpgradeManifest(m){if(!basisPlain(m)||m.format!==BASIS_NATIVE_ID)throw Error('Not a Basis CRE model archive');let v=m.schemaVersion;
  if(v===0){m={...m,schemaVersion:1,kind:'property',modelFile:m.modelFile||'assets/model.json'};v=1;}
  if(v!==BASIS_NATIVE_VERSION)throw Error('Unsupported model format version '+String(v)+'. Upgrade Basis before opening this file.');
  if(!['property','portfolio'].includes(m.kind))throw Error('Invalid model kind');const reference=m.kind==='property'?'modelFile':'portfolioFile';if(typeof m[reference]!=='string')throw Error('Manifest requires '+reference);basisPath(m[reference]);return m;}
function basisValidatePortfolio(meta,models=false){
  if(!basisPlain(meta)||typeof meta.name!=='string'||!Array.isArray(meta.scenarios)||!Array.isArray(meta.properties)||meta.properties.length>1000)throw Error('Invalid portfolio index');
  const scenarioIds=new Set(),propertyIds=new Set();
  const scenarios=meta.scenarios.map(s=>{if(!basisPlain(s)||typeof s.id!=='string'||!s.id||typeof s.name!=='string')throw Error('Invalid scenario');if(scenarioIds.has(s.id))throw Error('Invalid or duplicate scenario IDs');scenarioIds.add(s.id);basisValidateJSON(s);
    const scenario={...s};if(Object.prototype.hasOwnProperty.call(s,'settings'))scenario.settings=basisValidateScenarioSettings(s.settings);return scenario;});
  if(!scenarios.length)throw Error('Invalid or duplicate scenario IDs');
  const properties=meta.properties.map(p=>{if(!basisPlain(p)||typeof p.id!=='string'||!p.id||typeof p.scenarioId!=='string'||!scenarioIds.has(p.scenarioId))throw Error('Invalid property membership');
    if(propertyIds.has(p.id))throw Error('Duplicate property IDs');propertyIds.add(p.id);if(p.include!==undefined&&typeof p.include!=='boolean')throw Error('Invalid property inclusion flag');
    return models?{id:p.id,scenarioId:p.scenarioId,include:p.include!==false,model:basisValidateModel(p.model)}:{id:p.id,scenarioId:p.scenarioId,include:p.include!==false,file:basisPath(p.file)};});
  return {name:meta.name,scenarios,properties};}
async function basisCreateArchive(data){const kind=data.kind;if(!['property','portfolio'].includes(kind))throw Error('Invalid archive kind');
  const createdAt=new Date().toISOString(),parts=[],put=(name,x)=>{const bytes=basisEnc(x);parts.push({name,data:bytes});};
  if(kind==='property'){basisValidateModel(data.model);put('assets/model.json',data.model);}
  else{const portfolio=basisValidatePortfolio(data.portfolio,true);
    const models=portfolio.properties.map((r,i)=>{const file='assets/property_'+String(i+1).padStart(4,'0')+'.json';put(file,r.model);return {id:r.id,scenarioId:r.scenarioId,include:r.include,file};});
    put('portfolio.json',{name:portfolio.name,scenarios:portfolio.scenarios,properties:models});}
  put('audit.json',{events:[{type:'archive-export',at:createdAt,note:'Archive metadata, not an edit-history assertion'}]});
  const checks=[];for(const e of parts)checks.push({path:e.name,size:e.data.length,crc32:basisHex(basisCrc32(e.data)),sha256:await basisSha256(e.data)});
  const manifest={format:BASIS_NATIVE_ID,schemaVersion:BASIS_NATIVE_VERSION,kind,createdAt,producer:'Basis Studio',modelFile:kind==='property'?'assets/model.json':undefined,portfolioFile:kind==='portfolio'?'portfolio.json':undefined,checksums:checks};
  return basisZipWrite([{name:'manifest.json',data:basisEnc(manifest)},...parts]);}
async function basisReadArchive(file){const files=await basisZipRead(file),originalManifest=basisRequireJSON(files,'manifest.json'),legacy=basisPlain(originalManifest)&&originalManifest.schemaVersion===0,m=basisUpgradeManifest(originalManifest);
  if(files.size>256)throw Error('Too many archive files');
  if(!Array.isArray(m.checksums)&&!(legacy&&m.checksums===undefined))throw Error('Manifest checksums are required');
  if(Array.isArray(m.checksums)){const checked=new Set();for(const check of m.checksums){if(!basisPlain(check)||typeof check.path!=='string'||!Number.isSafeInteger(check.size)||check.size<0||typeof check.crc32!=='string'||!/^[0-9a-f]{8}$/.test(check.crc32)||(check.sha256!==null&&check.sha256!==undefined&&(typeof check.sha256!=='string'||!/^[0-9a-f]{64}$/.test(check.sha256))))throw Error('Invalid manifest checksum');
    const name=basisPath(check.path);if(name==='manifest.json'||checked.has(name))throw Error('Duplicate or invalid manifest checksum path');checked.add(name);const b=files.get(name);if(!b)throw Error('Archive is missing '+name);
    if(b.length!==check.size||basisHex(basisCrc32(b))!==check.crc32)throw Error('File checksum mismatch: '+name);
    if(check.sha256){const actual=await basisSha256(b);if(actual&&actual!==check.sha256)throw Error('SHA-256 mismatch: '+name);}}
    for(const name of files.keys())if(name!=='manifest.json'&&!checked.has(name))throw Error('Missing manifest checksum: '+name);}
  if(m.kind==='property')return {kind:'property',model:basisValidateModel(basisRequireJSON(files,basisPath(m.modelFile))),manifest:m};
  const meta=basisValidatePortfolio(basisRequireJSON(files,basisPath(m.portfolioFile)));
  return {kind:'portfolio',portfolio:{name:meta.name,scenarios:meta.scenarios,properties:meta.properties.map(p=>({id:p.id,scenarioId:p.scenarioId,include:p.include,model:basisValidateModel(basisRequireJSON(files,p.file))}))},manifest:m};}
/* END BASIS NATIVE ARCHIVE V1 */
