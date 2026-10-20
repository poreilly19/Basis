/* BEGIN BASIS SCENARIO SETTINGS V1 */
/* Pure scenario metadata helpers. Reading never migrates or changes a model/index. */
const BASIS_SCENARIO_SETTINGS_VERSION=1;
const BASIS_SCENARIO_SETTINGS_DEFAULTS=Object.freeze({version:1,portDisc:0.075,portCap:0.065,portSingleExit:false,portResaleNoi:'forward'});
function basisScenarioClone(value){
  let nodes=0;const ancestors=new Set();
  const copy=(item,depth)=>{
    if(++nodes>300000||depth>72)throw Error('Scenario metadata nesting or size limit exceeded');
    if(item===null||typeof item==='string'||typeof item==='boolean')return item;
    if(typeof item==='number'){if(!Number.isFinite(item))throw Error('Scenario metadata includes a non-finite number');return item;}
    if(!item||typeof item!=='object'||Object.prototype.toString.call(item)!=='[object Object]'&&!Array.isArray(item))throw Error('Scenario metadata must contain JSON values');
    if(ancestors.has(item))throw Error('Scenario metadata includes a circular reference');ancestors.add(item);
    let result;
    if(Array.isArray(item)){result=[];for(const entry of item)result.push(copy(entry,depth+1));}
    else{result={};for(const key of Object.keys(item)){if(key==='__proto__'||key==='prototype'||key==='constructor')throw Error('Reserved scenario metadata key is not supported');result[key]=copy(item[key],depth+1);}}
    ancestors.delete(item);return result;
  };
  return copy(value,0);
}
function basisValidateScenarioSettings(settings){
  if(!settings||typeof settings!=='object'||Array.isArray(settings))throw Error('Scenario settings must be an object');
  const result=basisScenarioClone(settings);
  if(result.version!==BASIS_SCENARIO_SETTINGS_VERSION)throw Error('Unsupported scenario settings version '+String(result.version));
  if(typeof result.portDisc!=='number'||!Number.isFinite(result.portDisc)||result.portDisc<=-1)throw Error('Scenario discount rate must be finite and greater than -100%');
  if(typeof result.portCap!=='number'||!Number.isFinite(result.portCap)||result.portCap<0)throw Error('Scenario exit cap rate must be finite and non-negative');
  if(typeof result.portSingleExit!=='boolean')throw Error('Scenario single-exit setting must be boolean');
  if(result.portSingleExit&&result.portCap<=0)throw Error('A single scenario exit requires a positive cap rate');
  if(!['forward','trailing'].includes(result.portResaleNoi))throw Error('Scenario terminal NOI must be forward or trailing');
  return result;
}
function basisScenarioSettings(scenario,fallback){
  if(scenario&&Object.prototype.hasOwnProperty.call(scenario,'settings'))return basisValidateScenarioSettings(scenario.settings);
  const result={...BASIS_SCENARIO_SETTINGS_DEFAULTS},source=fallback&&typeof fallback==='object'?fallback:{};
  // Older property snapshots can contain numeric text. Coerce only these known
  // legacy fields; invalid values use defaults and the snapshots remain untouched.
  for(const [key,minimum] of [['portDisc',-1],['portCap',0]]){
    const raw=source[key];if(typeof raw!=='number'&&(typeof raw!=='string'||!raw.trim()))continue;
    const value=Number(raw);if(Number.isFinite(value)&&(key==='portDisc'?value>minimum:value>=minimum))result[key]=value;
  }
  if(typeof source.portSingleExit==='boolean')result.portSingleExit=source.portSingleExit;
  if(['forward','trailing'].includes(source.portResaleNoi))result.portResaleNoi=source.portResaleNoi;
  if(result.portSingleExit&&result.portCap<=0)result.portCap=BASIS_SCENARIO_SETTINGS_DEFAULTS.portCap;
  return result;
}
function basisSaveScenarioSettings(scenario,patch,fallback){
  if(!scenario||typeof scenario!=='object'||Array.isArray(scenario))throw Error('Scenario must be an object');
  if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Scenario settings update must be an object');
  const update=basisScenarioClone(patch),allowed=new Set(Object.keys(BASIS_SCENARIO_SETTINGS_DEFAULTS));
  for(const key of Object.keys(update))if(!allowed.has(key))throw Error('Unknown scenario settings field: '+key);
  if(Object.prototype.hasOwnProperty.call(update,'version')&&update.version!==BASIS_SCENARIO_SETTINGS_VERSION)throw Error('Unsupported scenario settings version '+String(update.version));
  const result=basisScenarioClone(scenario),current=basisScenarioSettings(scenario,fallback);
  result.settings=basisValidateScenarioSettings({...current,...update});return result;
}
/* END BASIS SCENARIO SETTINGS V1 */
