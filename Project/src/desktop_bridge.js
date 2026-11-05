/* BEGIN BASIS DESKTOP BRIDGE */
// The browser edition never invokes native commands. Desktop permissions are
// limited further by the local window capability and the Rust command handlers.
function basisCreateDesktopBridge(options={}){
  const host=options.host===undefined?(typeof window!=='undefined'?window:globalThis):options.host;
  const native=options.invoke||host?.__TAURI__?.core?.invoke;
  const available=typeof native==='function',credentialMarker='basis-desktop-saved-credential',providers=new Set(['openai','anthropic']);
  const invoke=(command,args={})=>{if(!available)return Promise.reject(Error('Desktop support is unavailable in this browser.'));return Promise.resolve().then(()=>native(command,args));};
  const provider=value=>{if(!providers.has(value))throw Error('Choose OpenAI or Anthropic.');return value;};
  const snapshot=value=>{
    if(!value||value.schemaVersion!==1||typeof value.revision!=='string'||!value.revision||!value.entries||typeof value.entries!=='object'||Array.isArray(value.entries))throw Error('The desktop workspace is invalid. Restore a backup before continuing.');
    for(const key of Object.keys(value.entries))if(!/^[A-Za-z0-9_.-]{1,160}$/.test(key))throw Error('The desktop workspace contains an invalid storage key.');
    return value;
  };
  let requestSequence=0;
  const fetchNative=async(url,request={})=>{
    const selected=url==='https://api.openai.com/v1/responses'?'openai':url==='https://api.anthropic.com/v1/messages'?'anthropic':null;
    if(!selected||request.method!=='POST'||typeof request.body!=='string')throw Error('This desktop request is not supported.');
    const headers=new Headers(request.headers||{}),authorization=headers.get('authorization')||'',key=selected==='openai'?authorization.replace(/^Bearer\s+/i,''):headers.get('x-api-key')||'';
    if(!key)throw Error('An API key is required.');
    const requestId='desktop-'+Date.now().toString(36)+'-'+(++requestSequence).toString(36),signal=request.signal;
    const cancelled=()=>Object.assign(Error('The AI request was cancelled.'),{name:'AbortError'});
    if(signal?.aborted)throw cancelled();
    let rejectAbort,stopped=false;
    const aborted=new Promise((resolve,reject)=>{rejectAbort=reject;});
    const abort=()=>{if(stopped)return;stopped=true;invoke('desktop_ai_cancel',{requestId}).catch(()=>{});rejectAbort(cancelled());};
    signal?.addEventListener('abort',abort,{once:true});
    try{
      if(signal?.aborted)throw cancelled();
      const args={provider:selected,body:request.body,requestId};if(key!==credentialMarker)args.apiKey=key;
      const response=await Promise.race([invoke('desktop_ai_request',args),aborted]);
      if(signal?.aborted)throw cancelled();
      if(!response||!Number.isInteger(response.status)||response.status<200||response.status>599||typeof response.body!=='string')throw Error('The desktop AI response was invalid.');
      return new Response(response.body,{status:response.status,headers:{'content-type':'application/json'}});
    }finally{stopped=true;signal?.removeEventListener('abort',abort);}
  };
  const readSnapshot=async()=>snapshot(await invoke('desktop_store_read'));
  const commit=async(expectedRevision,puts,deletes=[])=>snapshot(await invoke('desktop_store_commit',{expectedRevision,puts,deletes}));
  const read=async key=>{const state=await readSnapshot();return Object.prototype.hasOwnProperty.call(state.entries,key)?state.entries[key]:null;};
  const write=async(key,value)=>{const state=await readSnapshot();await commit(state.revision,{[key]:value});};
  const remove=async key=>{const state=await readSnapshot();await commit(state.revision,{},[key]);};
  const saveFile=async(filename,data)=>{
    let bytes;if(typeof data==='string')bytes=new TextEncoder().encode(data);else if(data instanceof Blob)bytes=new Uint8Array(await data.arrayBuffer());else if(data instanceof ArrayBuffer)bytes=new Uint8Array(data);else if(ArrayBuffer.isView(data))bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength);else throw Error('The export contains unsupported file data.');
    if(bytes.length>64*1024*1024)throw Error('The desktop export exceeds the 64 MiB file limit.');
    let binary='';for(let offset=0;offset<bytes.length;offset+=32768)binary+=String.fromCharCode(...bytes.subarray(offset,offset+32768));
    const status=await invoke('desktop_save_file',{filename,dataBase64:btoa(binary)});
    if(!['saved','declined'].includes(status))throw Error('The desktop file could not be saved.');return status;
  };
  return {available,credentialMarker,readSnapshot,commit,read,write,remove,saveFile,fetch:fetchNative,
    info:()=>invoke('desktop_store_info'),createBackup:()=>invoke('desktop_backup_create'),openBackupFolder:()=>invoke('desktop_open_backup_folder'),
    keyStatus:selected=>invoke('desktop_key_status',{provider:provider(selected)}),
    storeKey:(selected,apiKey)=>invoke('desktop_key_store',{provider:provider(selected),apiKey}),
    deleteKey:selected=>invoke('desktop_key_delete',{provider:provider(selected)}),
    listenClose:async callback=>{const current=host?.__TAURI__?.window?.getCurrentWindow?.();if(!available||!current?.onCloseRequested)throw Error('Desktop close protection is unavailable.');return current.onCloseRequested(callback);},
    close:()=>host.__TAURI__.window.getCurrentWindow().close()};
}
const BASIS_DESKTOP=basisCreateDesktopBridge();
const BASIS_DESKTOP_AI_PREFERENCE='basis.desktop.ai.v1';
function basisDesktopAIChoice(value){
  if(!BASIS_DESKTOP.available)return;
  try{if(value)localStorage.setItem(BASIS_DESKTOP_AI_PREFERENCE,JSON.stringify({provider:value.provider,model:value.model}));else localStorage.removeItem(BASIS_DESKTOP_AI_PREFERENCE);}catch(error){/* A saved key remains available through Use Saved Key. */}
}
async function basisDesktopRestoreAI(){
  if(!BASIS_DESKTOP.available)return;
  const generation=basisAIGeneration;
  try{const choice=JSON.parse(localStorage.getItem(BASIS_DESKTOP_AI_PREFERENCE)||'null');
    if(!choice||!['openai','anthropic'].includes(choice.provider)||typeof choice.model!=='string'||!choice.model||choice.model.length>160)return;
    if(await BASIS_DESKTOP.keyStatus(choice.provider)&&generation===basisAIGeneration)basisConfigureAI({provider:choice.provider,model:choice.model,apiKey:BASIS_DESKTOP.credentialMarker});
  }catch(error){/* Manual AI setup remains available if the credential store is locked. */}
}
async function basisDesktopInstallCloseGuard(){
  if(!BASIS_DESKTOP.available)return;
  let approved=false,busy=false;
  await BASIS_DESKTOP.listenClose(async event=>{
    if(approved)return;event.preventDefault();if(busy)return;busy=true;
    try{
      await PW.ready;await PW.q;
      if(PW.cur)await pwSaveCur();await PW.q;
      if(PW.local?.edited)throw Error('The latest edits have not been saved. Save them or export a backup before closing.');
      approved=true;await BASIS_DESKTOP.close();
    }catch(error){approved=false;pwStatus('Not saved');kAlert('Basis stayed open because it could not save: '+(error.message||error));}
    finally{busy=false;}
  });
}
function basisDesktopSettingsPane(){
  const status=el('p',{class:'hint',role:'status','aria-live':'polite',text:'Loading desktop storage…'}),paths=el('div',{});
  let busy=false;
  const refresh=async()=>{try{const info=await BASIS_DESKTOP.info();paths.replaceChildren(
    el('p',{class:'hint',text:'Workspace: '+info.dataDirectory}),el('p',{class:'hint',text:'Backups: '+info.backupDirectory}));
    status.textContent=(info.backups?.length||0)+' local backup'+(info.backups?.length===1?'':'s')+' available.';
  }catch(error){status.textContent='Could not read desktop storage details: '+(error.message||error);}};
  const backup=studioBtn('Back Up Workspace Now',async()=>{if(busy)return;busy=true;backup.disabled=true;status.textContent='Saving the workspace and creating a backup…';
    try{await PW.ready;await PW.q;if(PW.cur)await pwSaveCur();await PW.q;const name=await BASIS_DESKTOP.createBackup();await refresh();status.textContent='Backup created: '+name;}
    catch(error){status.textContent='Backup failed: '+(error.message||error);}finally{busy=false;backup.disabled=false;}});
  const open=studioBtn('Open Backup Folder',async()=>{try{await BASIS_DESKTOP.openBackupFolder();}catch(error){status.textContent='Could not open the backup folder: '+(error.message||error);}});
  const card=el('section',{class:'card','data-desktop-settings':''},[el('h3',{text:'Desktop Storage & Backups'}),el('div',{class:'body'},[
    el('p',{text:'Models are saved on this computer. Automatic backups retain previous saved workspace versions. Keep a separate .basiscre portfolio export before upgrades.'}),paths,
    el('div',{class:'bar'},[backup,open]),status,
    el('p',{class:'hint',text:'Web and desktop libraries are separate. Export a .basiscre portfolio from one edition and import it into the other. Desktop copies do not use the website’s Access login or synchronize automatically.'})])]);
  refresh();return card;
}
/* END BASIS DESKTOP BRIDGE */
