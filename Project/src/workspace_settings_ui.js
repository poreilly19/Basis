/* BEGIN BASIS WORKSPACE SETTINGS UI */
const BASIS_PREFS=basisCreateWorkspacePreferences();
function studioUpdateSaveButton(){
  const button=document.querySelector('#basisSaveChanges');if(!button)return;
  button.hidden=BASIS_PREFS.get().autosave||typeof PW==='undefined'||!PW.cur||!PW.local||!PW.local.edited;
}
function studioApplyColumnPreferences(root=document){
  const tables=[];if(root.matches&&root.matches('.scroll > table'))tables.push(root);
  if(root.querySelectorAll)tables.push(...root.querySelectorAll('.scroll > table'));
  for(const table of tables){let count=1;for(const row of table.rows){let columns=0;for(const cell of row.cells)if(!cell.hidden&&cell.style.display!=='none')columns+=cell.colSpan||1;count=Math.max(count,columns);}table.style.setProperty('--basis-column-count',String(count));}
}
function studioApplyPreferences(){
  const prefs=BASIS_PREFS.get(),root=document.documentElement;
  if(prefs.theme==='system')root.removeAttribute('data-theme');else root.setAttribute('data-theme',prefs.theme);
  root.setAttribute('data-auto-fit-columns',String(prefs.autoFitColumns));
  if(typeof PW!=='undefined'&&!prefs.autosave){clearTimeout(PW.timer);PW.timer=null;}
  studioApplyColumnPreferences();studioUpdateSaveButton();
}
function studioSetPreference(patch){
  const previous=BASIS_PREFS.get(),result=BASIS_PREFS.update(patch);studioApplyPreferences();
  if(!previous.autosave&&result.preferences.autosave&&PW.cur&&PW.local&&PW.local.edited){clearTimeout(PW.timer);PW.timer=setTimeout(pwSaveCur,1200);}
  if(MODE==='portfolio'&&PWV.sub==='settings')drawPane();return result;
}
function studioOpenSettings(){PWV.bs=false;PWV.sub='settings';setMode('portfolio');drawPane();}
function studioOpenDocumentImport(){PWV.sub='import';setMode('portfolio');drawPane();}
function studioDocumentPane(){
  const record=pwRec(PW.cur);
  if(!record||record.pf!==PW.pf||record.sc!==PW.sc)return el('div',{},[
    el('p',{text:'Open a property in this portfolio and scenario before extracting documents into its model.'}),
    studioBtn('Choose a Property',()=>{PWV.sub='props';drawPane();})]);
  return el('div',{},[el('p',{class:'note',text:'Review extracted inputs for '+record.name+' before applying them to this property.'}),PANES['tools.import']()]);
}
function studioSettingsPane(existing){
  // Reuse the live controls so an unrelated preference update or background
  // redraw does not discard an unapplied provider/model/key or keyboard focus.
  if(existing&&existing.basisRefresh){existing.basisRefresh();return existing;}
  const prefs=BASIS_PREFS.get(),storage=BASIS_PREFS.status();
  const control=(label,help,input)=>{input.setAttribute('aria-label',label);return field(label,help,input);};
  const theme=el('select',{onchange:e=>studioSetPreference({theme:e.target.value})},[['system','Use System Setting'],['light','Light'],['dark','Dark']].map(([value,text])=>el('option',{value,text})));theme.value=prefs.theme;
  const autosave=el('input',{type:'checkbox',onchange:e=>studioSetPreference({autosave:e.target.checked})});autosave.checked=prefs.autosave;
  const fit=el('input',{type:'checkbox',onchange:e=>studioSetPreference({autoFitColumns:e.target.checked})});fit.checked=prefs.autoFitColumns;
  const storageMessage=el('p',{class:'note err',role:'status',hidden:!storage.error,text:storage.error||''});
  const general=el('section',{class:'card'},[el('h3',{text:'Workspace Preferences'}),el('div',{class:'body'},[
    control('Appearance','Choose Light, Dark, or follow your device.',theme),
    control('Autosave While Editing','Save after a short pause. Switching properties and explicit library actions still save. Recovery drafts stay enabled.',autosave),
    control('Fit Columns to Content','Turn off to use uniform column widths in scrollable tables.',fit),
    el('p',{class:'hint',text:'These preferences apply in this browser and are separate from your property files.'}),
    storageMessage])]);
  let status=basisAIStatus(),editingAI=false,setupError='',connectionController=null,connectionGeneration=0;
  const provider=el('select',{'aria-label':'AI Provider'},[['host','Host Integration'],['openai','OpenAI'],['anthropic','Anthropic']].map(([value,text])=>el('option',{value,text})));provider.value=status.provider;
  const model=el('input',{type:'text','aria-label':'AI Model',value:status.model||'',placeholder:'Model ID',autocomplete:'off',spellcheck:'false',style:'width:min(100%,300px)'});
  const key=el('input',{type:'password','aria-label':'API Key',autocomplete:'off',placeholder:status.configured&&status.provider!=='host'?'Key configured for this session':'Paste your API key',spellcheck:'false',style:'width:min(100%,300px)'});
  const message=el('p',{class:'hint',role:'status','aria-live':'polite'});
  const connectionResult=el('p',{class:'hint',role:'status','aria-live':'polite','data-ai-connection-status':''});
  const stopConnection=()=>{connectionGeneration++;connectionController?.abort();connectionController=null;connectionResult.textContent='';};
  const updateMessage=()=>{
    const selected=provider.value,same=selected===status.provider,label=selected==='openai'?'OpenAI':selected==='anthropic'?'Anthropic':'Host Integration';
    message.className=setupError?'note err':'hint';
    message.textContent=setupError||(selected==='host'
      ?same&&status.configured?'Ready: Host Integration':'No compatible host AI service detected. Select OpenAI or Anthropic for a standalone browser session.'
      :editingAI&&(key.value.trim()||same&&status.configured)?'AI setup has unapplied changes. Choose Use AI Setup to use '+label+'.'
      :same&&status.configured?'Configured for This Session: '+label+'. Use Test AI Connection before importing documents.'
      :'Enter your '+label+' API key, then choose Use AI Setup.');
    testConnection.disabled=!!connectionController||editingAI||!status.configured||status.provider==='host';cancelConnection.hidden=!connectionController;
    key.placeholder=same&&status.configured&&selected!=='host'?'Key configured for this session':'Paste your API key';
  };
  const configure=()=>{stopConnection();try{status=basisAIStatus();const options={provider:provider.value,model:model.value.trim()};if(key.value.trim()||provider.value!==status.provider||!status.configured)options.apiKey=key.value.trim();basisConfigureAI(options);key.value='';editingAI=false;setupError='';drawPane();}catch(error){setupError=error.message||'AI setup could not be updated.';updateMessage();}};
  const modelRow=control('AI Model','Use a model available to your API account.',model),keyRow=control('API Key','Kept in memory for this tab; enter it again after reloading.',key);
  const updateFields=()=>{const host=provider.value==='host';modelRow.hidden=host;keyRow.hidden=host;model.value=provider.value===status.provider?status.model:provider.value==='openai'?'gpt-4.1':provider.value==='anthropic'?'claude-sonnet-4-5':'';key.value='';updateMessage();};
  provider.onchange=()=>{stopConnection();editingAI=true;setupError='';updateFields();};
  model.oninput=key.oninput=()=>{stopConnection();editingAI=true;setupError='';updateMessage();};
  const clearKey=studioBtn('Clear API Key',()=>{stopConnection();const current=basisAIStatus();basisConfigureAI({provider:current.provider,model:current.model,apiKey:''});key.value='';editingAI=false;setupError='';drawPane();});
  const testConnection=studioBtn('Test AI Connection',async()=>{
    if(editingAI||connectionController||!basisAIStatus().configured||basisAIStatus().provider==='host')return;
    const ctl=new AbortController(),run=++connectionGeneration,generation=basisAIGeneration;connectionController=ctl;
    connectionResult.textContent='Testing your API key and selected model…';updateMessage();
    const timer=setTimeout(()=>ctl.abort(),15000);
    try{await BASIS_AI.testConnection({signal:ctl.signal});if(run===connectionGeneration&&generation===basisAIGeneration)connectionResult.textContent='Connection Successful. Your key and model responded. Document accuracy still needs review.';}
    catch(error){if(run===connectionGeneration)connectionResult.textContent=ctl.signal.aborted?'Connection test stopped or timed out. Try again.':error.message||'The connection test failed.';}
    finally{clearTimeout(timer);if(run===connectionGeneration){connectionController=null;updateMessage();}}
  });
  const cancelConnection=studioBtn('Cancel Connection Test',()=>{stopConnection();connectionResult.textContent='Connection test cancelled.';updateMessage();});
  const ai=el('section',{class:'card'},[el('h3',{text:'AI Document Extraction'}),el('div',{class:'body'},[
    el('p',{text:'Read leases, rent rolls, and operating statements, then review suggested inputs before applying them.'}),
    control('AI Provider','Use your API account or an available host integration.',provider),modelRow,keyRow,message,
    el('p',{class:'hint',text:'Extract sends selected document text or images and limited property context directly to the selected provider. Your API account pays any usage charges. Saving this setup sends no documents.'}),
    el('div',{class:'bar'},[
      studioBtn('Use AI Setup',configure,true),
      clearKey,testConnection,cancelConnection,
      studioBtn('Open Document Import',studioOpenDocumentImport)]),
    el('p',{class:'hint',text:'Test AI Connection sends a short test message to your configured API provider and may incur a small usage charge. It sends no documents or property data.'}),connectionResult])]);
  const pane=el('div',{class:'grid2',id:'basisWorkspaceSettings'},[general,ai]);
  pane.basisRefresh=()=>{
    const current=BASIS_PREFS.get(),saved=BASIS_PREFS.status();theme.value=current.theme;autosave.checked=current.autosave;fit.checked=current.autoFitColumns;
    storageMessage.hidden=!saved.error;storageMessage.textContent=saved.error||'';status=basisAIStatus();
    if(!editingAI){provider.value=status.provider;updateFields();}else updateMessage();
    clearKey.hidden=status.provider==='host'||!status.configured;
  };
  pane.basisRefresh();return pane;
}
// Column sizing also applies to tables rendered asynchronously after navigation.
const studioTableObserver=new MutationObserver(records=>{
  const tables=new Set();for(const record of records){if(record.target.nodeType===1){const table=record.target.closest('.scroll > table');if(table)tables.add(table);}for(const node of record.addedNodes)if(node.nodeType===1)studioApplyColumnPreferences(node);}
  for(const table of tables)studioApplyColumnPreferences(table);
});
studioTableObserver.observe(document.body,{childList:true,subtree:true});
document.querySelector('#basisSaveChanges')?.addEventListener('click',()=>pwSaveCur().catch(()=>{}));
/* END BASIS WORKSPACE SETTINGS UI */
