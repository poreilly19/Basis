/* BEGIN BASIS WORKSPACE PREFERENCES V1 */
/* Browser preferences are separate from property models and native exports. */
const BASIS_WORKSPACE_PREFERENCES_KEY='basis.preferences.v1';
const BASIS_WORKSPACE_PREFERENCES_DEFAULTS=Object.freeze({theme:'system',autosave:true,autoFitColumns:true});
function basisCreateWorkspacePreferences(options={}){
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  const valid=(key,value)=>key==='theme'?['system','light','dark'].includes(value):typeof value==='boolean';
  const snapshot=()=>({theme:current.theme,autosave:current.autosave,autoFitColumns:current.autoFitColumns});
  let storage,current={...BASIS_WORKSPACE_PREFERENCES_DEFAULTS},saved=true,error='';
  try{storage=own(options,'storage')?options.storage:typeof localStorage!=='undefined'?localStorage:null;}catch(e){}
  const legacyThemeKey=typeof options.legacyThemeKey==='string'&&options.legacyThemeKey?options.legacyThemeKey:'basis.theme';
  function status(){return {saved,error};}
  function persist(){
    try{
      if(!storage||typeof storage.setItem!=='function')throw Error();
      // Construct explicitly: unknown fields and credentials can never be persisted.
      storage.setItem(BASIS_WORKSPACE_PREFERENCES_KEY,JSON.stringify({v:1,...snapshot()}));
      saved=true;error='';
    }catch(e){
      saved=false;error='Workspace settings could not be saved in this browser. Changes will last for this session. Enable browser storage or free space, then change a setting to retry.';
    }
  }
  function load(){
    let raw;
    try{
      if(!storage||typeof storage.getItem!=='function')throw Error();
      raw=storage.getItem(BASIS_WORKSPACE_PREFERENCES_KEY);
      if(raw===null||raw===undefined){
        const legacyTheme=storage.getItem(legacyThemeKey);
        if(valid('theme',legacyTheme)){current.theme=legacyTheme;persist();}
        return;
      }
    }catch(e){saved=false;error='Workspace settings could not be read from browser storage. Defaults are in use; changes can still be made for this session.';return;}
    try{
      if(typeof raw!=='string'||raw.length>16384)throw Error();
      const value=JSON.parse(raw);
      if(!value||typeof value!=='object'||Array.isArray(value)||!own(value,'v')||value.v!==1)throw Error();
      if(['__proto__','constructor','prototype'].some(key=>own(value,key)))throw Error();
      let invalid=false;
      for(const key of Object.keys(BASIS_WORKSPACE_PREFERENCES_DEFAULTS)){
        if(!own(value,key))continue;
        if(valid(key,value[key]))current[key]=value[key];else invalid=true;
      }
      if(invalid){saved=false;error='Some saved workspace settings were invalid. Defaults are in use for those settings.';}
    }catch(e){saved=false;error='Saved workspace settings could not be read. Defaults are in use.';}
  }
  function update(patch){
    if(!patch||typeof patch!=='object'||Array.isArray(patch))throw TypeError('Workspace preferences update must be an object');
    const prototype=Object.getPrototypeOf(patch);
    if(prototype!==null&&Object.getPrototypeOf(prototype)!==null)throw TypeError('Workspace preferences update must be a plain object');
    const next=snapshot();
    // Validate the entire patch before changing memory or touching storage.
    for(const key of Reflect.ownKeys(patch)){
      if(typeof key!=='string'||!own(BASIS_WORKSPACE_PREFERENCES_DEFAULTS,key))throw TypeError('Unknown workspace preference');
      const field=Object.getOwnPropertyDescriptor(patch,key);
      if(!own(field,'value')||!valid(key,field.value))throw TypeError('Invalid workspace preference: '+key);
      next[key]=field.value;
    }
    current=next;persist();return {preferences:snapshot(),...status()};
  }
  load();
  return {get:snapshot,update,status};
}
/* END BASIS WORKSPACE PREFERENCES V1 */
