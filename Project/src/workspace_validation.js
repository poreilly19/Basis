/* BEGIN BASIS WORKSPACE VALIDATION */
/* Saved-library boundaries are independent of financial assumptions. Validation
   never repairs or mutates persisted data; callers can preserve it for recovery. */
const BASIS_WORKSPACE_MODEL_LIMIT=24*1024*1024;
const BASIS_WORKSPACE_ENCODED_LIMIT=32*1024*1024;
const BASIS_WORKSPACE_PART_LIMIT=180000;
const basisWorkspacePlain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.prototype.toString.call(value)==='[object Object]';
function basisWorkspaceJSON(value){
  let nodes=0,characters=0;const ancestors=new Set();
  const visit=(item,depth)=>{if(++nodes>300000||depth>72)throw Error('Saved library nesting or size limit exceeded');
    if(item===null||typeof item==='boolean')return;
    if(typeof item==='string'){characters+=item.length;if(characters>BASIS_WORKSPACE_ENCODED_LIMIT)throw Error('Saved library size limit exceeded');return;}
    if(typeof item==='number'){if(!Number.isFinite(item))throw Error('Saved library includes a non-finite number');return;}
    if(!basisWorkspacePlain(item)&&!Array.isArray(item))throw Error('Saved library must contain JSON values');
    if(ancestors.has(item))throw Error('Saved library includes a circular reference');ancestors.add(item);
    for(const key of Object.keys(item)){characters+=key.length;if(characters>BASIS_WORKSPACE_ENCODED_LIMIT)throw Error('Saved library size limit exceeded');if(['__proto__','prototype','constructor'].includes(key))throw Error('Reserved saved library key is not supported');
      // Optional in-memory metadata is omitted by the commit's JSON snapshot.
      if(item[key]===undefined&&!Array.isArray(item))continue;visit(item[key],depth+1);}
    ancestors.delete(item);
  };visit(value,0);return value;
}
function basisWorkspaceId(value,label='ID'){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,200}$/.test(value)||['__proto__','prototype','constructor'].includes(value))throw Error('Invalid saved library '+label);return value;}
function basisWorkspaceModelKey(id,record){
  basisWorkspaceId(id,'property ID');if(record&&record.id!==undefined&&record.id!==id)throw Error('Stored property ID does not match its record');
  const base='pwm_'+id,key=record?record.storageKey:undefined;
  if(key===undefined)return base;
  if(typeof key!=='string'||key!==base&&(!key.startsWith(base+'_')||! /^[A-Za-z0-9-]{1,200}$/.test(key.slice(base.length+1))))throw Error('Stored model key does not belong to its property');
  return key;
}
function basisValidateWorkspaceIndex(ix){
  basisWorkspaceJSON(ix);if(!basisWorkspacePlain(ix)||ix.v!==undefined&&ix.v!==1||!Array.isArray(ix.pfs)||!Array.isArray(ix.props))throw Error('The saved portfolio index is invalid');
  if(ix.rev!==undefined&&(typeof ix.rev!=='string'||!ix.rev||ix.rev.length>1000))throw Error('The saved library revision is invalid');
  const name=(record,label)=>{if(typeof record.name!=='string'||record.name.length>1000)throw Error('Invalid saved '+label+' name');};
  const portfolios=new Map(),properties=new Set(),keys=new Map();
  for(const pf of ix.pfs){if(!basisWorkspacePlain(pf))throw Error('Invalid saved portfolio');basisWorkspaceId(pf.id,'portfolio ID');name(pf,'portfolio');if(portfolios.has(pf.id))throw Error('Duplicate saved portfolio IDs');
    if(!Array.isArray(pf.scs)||!pf.scs.length)throw Error('The saved portfolio scenarios are invalid');const scenarios=new Set();
    for(const sc of pf.scs){if(!basisWorkspacePlain(sc))throw Error('Invalid saved scenario');basisWorkspaceId(sc.id,'scenario ID');name(sc,'scenario');if(scenarios.has(sc.id))throw Error('Duplicate saved scenario IDs');scenarios.add(sc.id);
      if(sc.settings!==undefined)basisValidateScenarioSettings(sc.settings);}
    portfolios.set(pf.id,scenarios);
  }
  for(const record of ix.props){if(!basisWorkspacePlain(record))throw Error('Invalid saved property record');basisWorkspaceId(record.id,'property ID');name(record,'property');if(properties.has(record.id))throw Error('Duplicate saved property IDs');properties.add(record.id);
    basisWorkspaceId(record.pf,'property portfolio');basisWorkspaceId(record.sc,'property scenario');if(!portfolios.has(record.pf)||!portfolios.get(record.pf).has(record.sc))throw Error('Saved property has an orphan portfolio or scenario');
    if(record.inc!==undefined&&typeof record.inc!=='boolean')throw Error('Saved property inclusion must be boolean');
    if(record.saved!==undefined&&(typeof record.saved!=='number'||!Number.isFinite(record.saved)||record.saved<0))throw Error('Saved property timestamp is invalid');
    for(const field of ['by','ext','type','city','state','begin'])if(record[field]!==undefined&&(typeof record[field]!=='string'||record[field].length>1000))throw Error('Saved property '+field+' must be text');
    const key=basisWorkspaceModelKey(record.id,record);if(keys.has(key)&&keys.get(key)!==record.id)throw Error('Saved model keys refer to different properties');keys.set(key,record.id);
  }
  // An immutable key can look like another property's ordinary header key.
  for(const record of ix.props){const owner=keys.get('pwm_'+record.id);if(owner!==undefined&&owner!==record.id)throw Error('Saved model key aliases another property');}
  // Headers and chunks share a legacy key namespace. Check each possible ID
  // prefix rather than comparing every property pair. A generation suffix can
  // alias an immutable header or make two properties share the same chunk.
  for(const id of properties)for(let at=id.indexOf('_');at>=0;at=id.indexOf('_',at+1)){
    if(!properties.has(id.slice(0,at)))continue;const suffix=id.slice(at+1),chunk=/^([A-Za-z0-9-]{1,200})_([1-9][0-9]{0,3})$/.exec(suffix);
    if(/^[A-Za-z0-9-]{1,200}$/.test(suffix)||chunk&&Number(chunk[2])<=4095)throw Error('Saved property IDs have overlapping model storage namespaces; the saved data was not changed');
  }
  return ix;
}
function basisValidateWorkspaceHeader(header){
  if(!basisWorkspacePlain(header))throw Error('Stored model header is invalid');
  if(header.v!==undefined&&header.v!==1)throw Error('Unsupported stored model version');
  if(header.enc!==undefined&&!['json','dr64'].includes(header.enc))throw Error('Unsupported stored model encoding');
  const count=header.n===undefined?1:header.n;if(!Number.isInteger(count)||count<1||count>4096)throw Error('Stored model chunk count is invalid');
  if(typeof header.s!=='string'||header.s.length>BASIS_WORKSPACE_PART_LIMIT)throw Error('Stored model header text is invalid or oversized');
  if(header.part!==undefined&&(typeof header.part!=='string'||!/^[A-Za-z0-9-]{1,200}$/.test(header.part)))throw Error('Stored model generation is invalid');
  if(header.saved!==undefined&&(typeof header.saved!=='number'||!Number.isFinite(header.saved)||header.saved<0))throw Error('Stored model timestamp is invalid');
  return count;
}
function basisValidateWorkspacePart(part){if(!basisWorkspacePlain(part)||typeof part.s!=='string'||part.s.length>BASIS_WORKSPACE_PART_LIMIT)throw Error('Stored model chunk is invalid or oversized');return part.s;}
async function basisDecodeWorkspaceModel(text,header){
  if(typeof text!=='string'||text.length>BASIS_WORKSPACE_ENCODED_LIMIT)throw Error('Stored model encoded size limit exceeded');let json=text;
  if(header.enc==='dr64'){
    if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text))throw Error('Stored model encoding is invalid');
    if(typeof DecompressionStream==='undefined')throw Error('Compressed stored models are not supported in this browser');
    const binary=atob(text),bytes=Uint8Array.from(binary,character=>character.charCodeAt(0)),reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),chunks=[];let length=0;
    try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>BASIS_WORKSPACE_MODEL_LIMIT)throw Error('Stored model expanded size limit exceeded');chunks.push(value);}}
    catch(error){try{await reader.cancel();}catch(ignore){}throw error;}finally{reader.releaseLock();}
    const plain=new Uint8Array(length);let offset=0;for(const chunk of chunks){plain.set(chunk,offset);offset+=chunk.length;}json=new TextDecoder('utf-8',{fatal:true}).decode(plain);
  }else if(text.length>BASIS_WORKSPACE_MODEL_LIMIT||new TextEncoder().encode(text).length>BASIS_WORKSPACE_MODEL_LIMIT)throw Error('Stored model size limit exceeded');
  let model;try{model=JSON.parse(json);}catch(error){throw Error('Stored model JSON is invalid');}basisValidateModel(model);return json;
}
/* END BASIS WORKSPACE VALIDATION */
