/* BEGIN BASIS CALCULATION UI */
let R=null,tmr=null,calcMs=0,calcPending=false,calcIssue='',calcEpoch=0,calcJob=null;
const basisCalculationClients=new Map(),basisCalculationInvalidators=[];
let basisPaneRefreshPending=false;
function basisEditingPane(){
  const active=document.activeElement,pane=document.getElementById('pane');
  return !!(active&&pane&&pane.contains(active)&&active.matches('input,select,textarea,[contenteditable="true"]'));
}
function basisRefreshCalculatedPane(){
  // Rendering an input pane can replace its controls. Keep uncommitted text and
  // the caret intact; refresh derived fields after focus leaves those controls.
  if(MODE==='inputs'&&basisEditingPane()){basisPaneRefreshPending=true;return;}
  basisPaneRefreshPending=false;drawPane();
}
document.addEventListener('focusout',()=>{
  if(basisPaneRefreshPending)setTimeout(()=>{if(basisPaneRefreshPending&&R&&!basisEditingPane())basisRefreshCalculatedPane();},0);
});
function basisCreateAppWorker(){
  const source=document.getElementById('basis-calculation-worker');
  if(typeof Worker==='undefined'||!source)throw Error('Background calculation is unavailable in this viewer.');
  const url=URL.createObjectURL(new Blob([source.textContent],{type:'text/javascript'}));
  try{const worker=new Worker(url),terminate=worker.terminate.bind(worker);
    worker.terminate=()=>{URL.revokeObjectURL(url);terminate();};
    setTimeout(()=>URL.revokeObjectURL(url),60000);return worker;
  }catch(error){URL.revokeObjectURL(url);throw error;}
}
function basisCalculationClient(key='model'){
  if(!basisCalculationClients.has(key))basisCalculationClients.set(key,basisCreateCalculationClient({createWorker:basisCreateAppWorker}));
  return basisCalculationClients.get(key);
}
function basisRunCalculation(kind,model,key='model',options){return basisCalculationClient(key).run(kind,model,options);}
function basisInvalidateCalculations(reason='Model changed'){
  calcEpoch++;for(const client of basisCalculationClients.values())client.cancel(reason);
  calcJob=null;calcPending=false;basisPaneRefreshPending=false;
  for(const invalidate of basisCalculationInvalidators)invalidate(reason);
}
function basisPopulateCalcStatus(node){
  if(!node)return;node.replaceChildren();node.append(document.createTextNode(calcPending?'Calculating…':calcIssue));
  if(calcPending)node.append(el('button',{class:'btn kb',text:'Cancel',title:'Cancel calculation','aria-label':'Cancel calculation',onclick:basisCancelCalculation}));
  else if(calcIssue)node.append(el('button',{class:'btn kb',text:'Recalculate',onclick:()=>recalcInBackground()}));
}
function basisCalculationStatusNode(){const node=el('span',{id:'calcSt',class:'pwst kcalc',role:'status','aria-live':'polite'});basisPopulateCalcStatus(node);return node;}
function calcBusy(on){calcPending=!!on;basisPopulateCalcStatus(typeof document==='undefined'?null:document.getElementById('calcSt'));}
const recalcDelay=()=>calcMs>250?Math.min(1500,Math.max(400,Math.round(calcMs*0.6))):60;
function basisCancelCalculation(){
  clearTimeout(tmr);basisInvalidateCalculations('Calculation cancelled');calcIssue='Calculation cancelled. ';calcBusy(false);renderKPI();
  if(MODE==='reports')drawPane();
}
// The synchronous entry point remains for startup, switching and established
// integrations. Edits and explicit sensitivity runs use background workers.
function recalc(){
  clearTimeout(tmr);basisInvalidateCalculations('New model calculation');calcIssue='';const start=Date.now();
  try{R=calc(S);}catch(error){console.error(error);R=null;calcIssue=error.message||String(error);}
  calcMs=Date.now()-start;calcBusy(false);return R;
}
async function recalcInBackground(){
  clearTimeout(tmr);tmr=null;
  const snapshot=JSON.stringify(S);basisInvalidateCalculations('New model calculation');
  const epoch=calcEpoch,start=Date.now();calcIssue='';R=null;calcBusy(true);renderKPI();
  const work=basisRunCalculation('property',JSON.parse(snapshot));calcJob=work;
  try{
    const result=await work;if(epoch!==calcEpoch)return null;
    // A legacy pane may initialize an optional input while rendering without
    // calling DIRTY. Recalculate that normalized snapshot instead of silently
    // dropping the only result and leaving an empty, idle output area.
    if(snapshot!==JSON.stringify(S))return recalcInBackground();
    R=result;calcMs=Date.now()-start;calcIssue='';
    if(typeof pwRec==='function'&&PW.cur){const record=pwRec(PW.cur);if(record)Object.assign(record,pwMetaOf(S,R));}
    return result;
  }catch(error){
    if(epoch!==calcEpoch)return null;
    R=null;calcIssue=error.name==='AbortError'?'Calculation cancelled. ':error.name==='TimeoutError'?'Calculation took too long; reduce the model or try again. ':error.message||String(error);
    return null;
  }finally{
    if(epoch===calcEpoch){calcJob=null;calcBusy(false);renderKPI();
      basisRefreshCalculatedPane();}
  }
}
function DIRTY(){
  let json='';try{json=JSON.stringify(S);if(typeof pwCaptureDraft==='function')pwCaptureDraft(json);}catch(error){}
  if(typeof histMark==='function')histMark(json);if(typeof pwTouch==='function')pwTouch();
  clearTimeout(tmr);basisInvalidateCalculations();calcIssue='';R=null;calcBusy(true);renderKPI();
  tmr=setTimeout(()=>{tmr=null;void recalcInBackground();},recalcDelay());
}
/* END BASIS CALCULATION UI */
