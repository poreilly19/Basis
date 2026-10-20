/* Native model sharing — operates on the existing Basis Studio portfolio model. */
const basisSafeFilename=s=>String(s||'Basis_Model').replace(/[^A-Za-z0-9._-]+/g,'_').slice(0,100)||'Basis_Model';
async function basisSaveCurrent(){try{const model=JSON.parse(JSON.stringify(S)),name=model.name,bytes=await basisCreateArchive({kind:'property',model});const status=await offerFile(basisSafeFilename(name)+BASIS_NATIVE_EXT,bytes);if(status==='saved')pwStatus('Native model exported');return status;}
  catch(err){kAlert('Could not save native model: '+(err.message||err));return 'failed';}}
/* Freeze one loaded view before asynchronous model reads. Cached/current inputs can
   still be backed up after a failed save. Uncached inputs need a verified saved
   revision so another page cannot create a mixed-generation portfolio archive. */
async function basisCollectPortfolioSnapshot({requireLegacyNames=false}={}){
  await PW.ready;const requested=pwPf();if(!requested)throw Error('No active portfolio');const portfolioId=requested.id;
  if(PW.cur)try{await pwSaveCur();}catch(saveError){/* Keep local edits available for backup. */}await PW.q;
  const pf=pwPf(portfolioId);if(!pf)throw Error('The portfolio was removed while the backup was starting');
  const name=pf.name,scenarios=pf.scs.map(sc=>basisScenarioClone(sc));
  if(requireLegacyNames){const names=scenarios.map(sc=>sc.name);if(names.some(value=>typeof value!=='string'||!value)||new Set(names).size!==names.length)throw Error('Legacy portfolio export requires unique nonempty scenario names; use a native portfolio archive to retain distinct scenario IDs');}
  const currentId=PW.cur,currentJSON=currentId?JSON.stringify(S):null,loadedRevision=PW.rev;
  const records=PW.ix.props.filter(p=>p.pf===portfolioId).map(p=>({id:p.id,sc:p.sc,inc:p.inc,name:p.name,storageKey:p.storageKey}));
  const local=new Map();for(const record of records){if(record.id===currentId)local.set(record.id,currentJSON);else{const json=PW.cache.get(record.id);if(json!==undefined)local.set(record.id,json);}}
  const uncached=records.filter(record=>!local.has(record.id)),stale=()=>Error('The saved library changed while the portfolio backup was being collected. Export the current property or reload the library before trying the portfolio backup again.');
  let savedRevision=null;if(uncached.length){savedRevision=pwRevision(await pwGet('pw_index'));if(savedRevision!==null&&savedRevision!==loadedRevision)throw stale();}
  const properties=[];for(const record of records){let json=local.get(record.id);
    if(!local.has(record.id)){const saved=await pwGetModel(record.id,record);json=saved&&saved.json;}
    if(typeof json!=='string'||!json)throw Error('Missing model '+record.name);properties.push({id:record.id,scenarioId:record.sc,include:record.inc!==false,model:JSON.parse(json)});}
  if(uncached.length&&(savedRevision===null||pwRevision(await pwGet('pw_index'))!==savedRevision))throw stale();
  return {name,scenarios,properties};
}
async function basisSavePortfolio(){try{const portfolio=await basisCollectPortfolioSnapshot(),bytes=await basisCreateArchive({kind:'portfolio',portfolio});
  const status=await offerFile(basisSafeFilename(portfolio.name)+'_portfolio'+BASIS_NATIVE_EXT,bytes);if(status==='saved')pwStatus('Portfolio exported');return status;
  }catch(err){pwStatus('Export failed');kAlert('Could not export portfolio: '+(err.message||err));return 'failed';}}
/* Import performs a complete decode, manifest/integrity check and structural validation
   before it creates any property or portfolio records. Imported models never overwrite existing ones. */
async function basisImportFile(file){const data=await basisReadArchive(file);await PW.ready;
  if(data.kind==='property'){await pwAdopt(data.model,{quiet:false});return 1;}
  return pwImportPortfolio(data.portfolio);}
