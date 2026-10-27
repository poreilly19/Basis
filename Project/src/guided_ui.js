/* BEGIN BASIS GUIDED UI */
const BASIS_PROPERTY_TYPES=['Industrial','Flex / R&D','Lab','Office','Retail','Multifamily','Mixed use','Land','Other'];
let basisPropertyAdvancedOpen=false,basisCheckReturn=null,basisImportOrigin=null,basisAppliedNotice=null;
function basisMarkField(node,object,key){
  const input=node.matches?.('input,select,textarea')?node:node.querySelector?.('input,select,textarea');
  if(input){input.dataset.field=key;if(object?.id)input.dataset.record=object.id;}return node;
}
function basisNewProperty(opener=document.activeElement){
  const context=pwActionContext(),draft=blankState();draft.name=pwUniq('New Property',pwList().map(p=>p.name));draft.areas[0].sf=0;
  const dialog=el('dialog',{class:'basis-task-dialog','aria-label':'Create Property'}),form=el('form'),error=el('p',{class:'note err',role:'alert',hidden:true});
  let busy=false;
  const text=(key)=>{const n=el('input',{type:'text',value:draft[key]||'',oninput:()=>draft[key]=n.value});return n;};
  const name=text('name');name.required=true;name.maxLength=1000;
  const area=basisNumberInput(()=>draft.areas[0].sf||'',v=>draft.areas[0].sf=v,'sf');
  const start=el('input',{type:'date',value:mKey(draft.startYear,draft.startMonth)+'-01',required:true});
  const years=el('input',{type:'number',min:1,max:40,step:1,value:draft.years,required:true});
  const type=el('select',{},BASIS_PROPERTY_TYPES.map(value=>el('option',{value,text:value})));type.value=draft.ptype;
  const entry=el('select',{'aria-label':'Next Step'},[el('option',{value:'manual',text:'Enter Leases Manually'}),el('option',{value:'documents',text:'Start From Documents'})]);
  const submit=el('button',{type:'submit',class:'btn p',text:'Create and Continue'});
  form.append(el('h2',{text:'Create Property'}),el('p',{class:'hint',text:'In '+pwPf().name+' · '+pwSc().name+'. Add the basics now; review the model assumptions as you go.'}),
    el('div',{class:'basis-basics-grid'},[field('Property Name','',name),field('Property Type','',type),field('Street Address','',text('addr')),
      field('City','',text('city')),field('State','',text('state')),field('ZIP','',text('zip')),field('Rentable Area (SF)','Leave blank if you will confirm it from documents.',area),
      field('Analysis Start','The analysis begins in this month.',start),field('Hold Period (Years)','Whole years, from 1 to 40.',years)]),
    field('Next Step','',entry),error,el('div',{class:'bar'},[el('button',{type:'button',class:'btn',text:'Cancel',onclick:()=>{if(!busy)dialog.close();}}),submit]));
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;document.activeElement?.blur();if(!form.reportValidity())return;
    try{
      if(!pwSameContext(context))throw Error('The active property or scenario changed. Close and reopen Create Property.');
      draft.name=pwActionName(name.value);draft.ptype=type.value;
      const date=parseMDY(start.value);if(!date||date.y<1900||date.y>2200)throw Error('Choose an analysis date between 1900 and 2200.');
      draft.startYear=date.y;draft.startMonth=date.m;draft.years=Number(years.value);
      if(!Number.isInteger(draft.years)||draft.years<1||draft.years>40)throw Error('Enter a whole hold period from 1 to 40 years.');
      if(!Number.isFinite(draft.areas[0].sf)||draft.areas[0].sf<0)throw Error('Rentable area must be zero or greater.');
      basisValidateModel(draft);busy=true;submit.disabled=true;error.hidden=true;
      const id=await pwAdopt(draft,{pf:context.pf,sc:context.sc});dialog.close();
      if(PW.cur===id){setMode('inputs');if(entry.value==='documents')basisOpenTaskImport('property');else go('tenants','rr');}
    }catch(e){error.textContent=e.message;error.hidden=false;}finally{busy=false;submit.disabled=false;}
  });
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  dialog.addEventListener('close',()=>{dialog.remove();if(opener?.isConnected)opener.focus();},{once:true});
  dialog.append(form);document.body.append(dialog);dialog.showModal();name.focus();name.select();return dialog;
}
function basisPropertyBasics(advanced){
  const model=S;
  const area=basisNumberInput(()=>rentableSF(model),value=>{if(S!==model)return;let measure=S.areas.find(a=>a.basis)||S.areas[0];if(!measure){measure={id:uid(),name:'Rentable',sf:0,basis:true};S.areas.push(measure);}if(num(measure.sf)!==value){measure.sf=value;DIRTY();}},'sf');
  basisMarkField(area,(S.areas.find(a=>a.basis)||S.areas[0]),'sf');
  const years=el('input',{type:'number',min:1,max:40,step:1,value:S.years});basisMarkField(years,S,'years');
  years.addEventListener('change',()=>{if(S!==model)return;const value=Number(years.value);if(!Number.isInteger(value)||value<1||value>40){years.setCustomValidity('Enter whole years from 1 to 40.');years.setAttribute('aria-invalid','true');years.reportValidity();return;}years.setCustomValidity('');years.removeAttribute('aria-invalid');S.years=value;DIRTY();});
  const monthText=()=>f0.format(clamp(Math.round(num(S.years))||10,1,40)*12)+' Months'+(num(S.years)>40?' Modeled ('+S.years+' Years Entered)':'');
  const months=el('output',{'data-analysis-months':'',text:monthText()});
  years.addEventListener('change',()=>{months.textContent=monthText();});
  const advancedPane=advanced(),basicLabels=new Set(['Property name','Property type','Analysis begin date','Analysis length, years','Analysis length, months','Building area']);
  for(const row of advancedPane.querySelectorAll('.f'))if(basicLabels.has(row.querySelector('label > span')?.textContent))row.remove();
  const more=el('details',{class:'basis-advanced'},[el('summary',{text:'Advanced Property Settings'}),advancedPane]);more.open=basisPropertyAdvancedOpen;
  more.addEventListener('toggle',()=>{if(more.isConnected)basisPropertyAdvancedOpen=more.open;});
  return el('div',{},[el('section',{class:'studio-panel'},[el('h2',{text:'Property Basics'}),el('div',{class:'basis-basics-grid'},[
    field('Property Name','',inp(S,'name',{type:'text'})),field('Property Type','',sel(S,'ptype',BASIS_PROPERTY_TYPES.map(v=>({v,t:v})))),
    field('Street Address','',inp(S,'addr',{type:'text'})),field('City','',inp(S,'city',{type:'text'})),field('State','',inp(S,'state',{type:'text'})),field('ZIP','',inp(S,'zip',{type:'text'})),
    field('Rentable Area (SF)','Used for per-SF values and recovery shares.',area),
    field('Analysis Start','Analysis starts in this month.',dInp(S,'_start',{store:'month',required:true,redraw:true,get:()=>mKey(S.startYear,S.startMonth),set:v=>{const d=parseM(v);S.startYear=d.y;S.startMonth=d.m;}})),
    field('Hold Period (Years)','',years),field('Analysis Length (Months)','',months)]),
    el('div',{class:'bar'},[el('button',{class:'btn p',text:'Continue to Rent Roll',onclick:()=>go('tenants','rr')}),el('button',{class:'btn',text:'Start From Documents',onclick:()=>basisOpenTaskImport('property')})])]),more]);
}
function basisSaveLabel(status=PW.status){
  if(status!=='Saved')return status||'Ready';
  if(PW.local.edited)return 'Unsaved Changes';
  const saved=pwRec(PW.cur)?.saved,time=saved?new Date(saved).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';
  const where=PWS.kind==='db'?'Saved to Your Basis Account':PWS.kind==='idb'?'Saved in This Browser':'In Memory Only — Download a Backup';
  return where+(time?' · '+time:'');
}
function basisOpenExport(opener=document.activeElement,scope='property'){
  const context=pwActionContext(),dialog=el('dialog',{class:'basis-task-dialog','aria-label':'Export and Backup'}),error=el('p',{class:'note err',role:'alert',hidden:true});
  const choices=scope==='portfolio'?[['backup','Editable Portfolio Backup (.basiscre)'],['json','Legacy Portfolio JSON']]:[
    ['backup','Editable Model Backup (.basiscre)'],['xlsx','Excel Workbook (.basis.xlsx)'],['json','Model Data (.basis.json)'],...(MODE==='reports'?[['report','Current Report (.csv)']]:[])];
  const purpose=el('select',{'aria-label':'Export Type'},choices.map(([value,text])=>el('option',{value,text})));
  const content=el('select',{'aria-label':'Workbook Contents'},[el('option',{value:'full',text:'Full Editable Model'}),el('option',{value:'results',text:'Results Only'})]);
  const contentRow=field('Contents','Full models include assumptions and lease terms. Results-only exports contain calculated outputs.',content);
  const refresh=()=>{contentRow.hidden=!['xlsx','json'].includes(purpose.value)||scope==='portfolio';};purpose.onchange=refresh;refresh();
  let busy=false;const download=el('button',{class:'btn p',text:'Download',onclick:async()=>{
    if(busy)return;busy=true;download.disabled=true;
    try{
      if(!pwSameContext(context))throw Error('The property or scenario changed. Reopen Export for the current selection.');
      let status;
      if(scope==='portfolio')status=purpose.value==='backup'?await basisSavePortfolio():await pwExportPf();
      else if(purpose.value==='backup')status=await basisSaveCurrent();
      else if(purpose.value==='report'){const rep=RB[T2]?.(S,R);if(!rep)throw Error('This report is unavailable.');const rows=T2==='validate'?[['Severity','Area','Finding','Why It Matters'],...basisModelIssues().map(i=>[i.sev,i.area,i.msg,i.detail])]:rRows(rep);if(T2==='validate'&&rows.length===1)rows.push(['info','Model','No automated findings. Source review is still required.','']);if(rows.length<2)throw Error('This view has no tabular report to export. Choose an Excel Workbook for the model results.');status=await offerFile(fname('_'+T2+'.csv'),rCSV(rows));}
      else{const previous=PF_OPTS.mode;try{PF_OPTS.mode=content.value==='results'?'results':'full';status=await pfExport(purpose.value);}finally{PF_OPTS.mode=previous;}}
      if(status==='failed')throw Error('The download did not complete. Try again.');if(status==='saved')dialog.close();
    }catch(e){error.textContent=e.message;error.hidden=false;}finally{busy=false;download.disabled=false;}
  }});
  dialog.append(el('h2',{text:scope==='portfolio'?'Export Portfolio':'Export '+S.name}),el('p',{text:'Saving keeps edits in '+(PWS.kind==='db'?'your Basis account':PWS.kind==='idb'?'this browser':'this tab’s memory')+'. Download a backup to keep a separate editable copy.'}),
    field('Export Type','',purpose),contentRow,error,el('div',{class:'bar'},[el('button',{class:'btn',text:'Close',onclick:()=>{if(!busy)dialog.close();}}),download]));
  dialog.addEventListener('keydown',e=>e.stopPropagation());dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  dialog.addEventListener('close',()=>{dialog.remove();if(opener?.isConnected)opener.focus();},{once:true});document.body.append(dialog);dialog.showModal();purpose.focus();
}
function basisSelectionActions(){
  const selected=pwSelIds(),bar=el('div',{class:'bar basis-property-selection','aria-label':'Selected Properties',hidden:!selected.length});
  bar.append(el('strong',{text:selected.length+' Selected'}),...[
    ['Duplicate Selected',pwActCopy],['Copy to Scenario',pwActCopyTo],['Move Selected',pwActMoveTo],['Delete Selected',pwActDelete],
    ['Clear Selection',()=>{PW.sel.clear();drawPane();}]
  ].map(([text,onclick])=>el('button',{class:'btn',text,onclick})));return bar;
}
function basisSyncPropertySelection(){document.querySelector('.basis-property-selection')?.replaceWith(basisSelectionActions());}
function basisScenarioActions(){return el('details',{class:'basis-action-menu'},[el('summary',{class:'btn',text:'Scenario Actions'}),el('div',{class:'bar'},[
  ['New Scenario',pwNewSc],['Rename Scenario',pwRenameSc],['Delete Scenario',pwDeleteSc],['Rename Portfolio',pwRenamePf],['Delete Portfolio',pwDeletePf],['Recalculate All',pwRecalcAll]
].map(([text,onclick])=>el('button',{class:'btn',text,onclick})))]);}
function basisOpenTaskImport(kind){
  if(INT.busy||INT.applying){kAlert('Finish or stop the current document task before starting another.');return;}
  basisImportOrigin={context:basisWorkspaceKey(),kind,mode:MODE,group:T1,page:T2};
  setMode('inputs');go('tools','import');
}
function basisTaskImportButton(kind){return el('button',{class:'btn',text:kind==='expenses'?'Upload Operating Statement':'Upload Lease / Rent Roll',onclick:()=>basisOpenTaskImport(kind)});}
function basisTaskPageEnhancements(host,key){
  if(key==='expenses.op'&&!host.querySelector('[data-task-upload]')){const bar=host.querySelector('.bar'),button=basisTaskImportButton('expenses');button.dataset.taskUpload='';(bar||host).append(button);}
  if(key==='tools.import'&&basisImportOrigin?.context===basisWorkspaceKey())host.prepend(el('p',{class:'note',text:'Adding '+(basisImportOrigin.kind==='expenses'?'operating statements':basisImportOrigin.kind==='leases'?'leases and rent rolls':'property documents')+' to '+S.name+'. Review each proposed change before applying.'}));
  if(basisCheckReturn?.context===basisWorkspaceKey()&&key!=='audit.validate')host.prepend(el('div',{class:'bar'},[el('button',{class:'btn',text:'Return to Model Checks',onclick:()=>basisOpenChecks()})]));
  if(basisAppliedNotice?.context===basisWorkspaceKey()&&basisAppliedNotice.key===key){
    const notice=basisAppliedNotice;host.prepend(el('div',{class:'note',role:'status'},[el('span',{text:notice.text}),el('button',{class:'btn',text:'Dismiss',onclick:()=>{basisAppliedNotice=null;drawPane();}})]));
    for(const row of host.querySelectorAll('tr'))if(notice.ids.includes(row.__it?.id))row.classList.add('basis-import-changed');
  }
  if(/^(tenants\.rr|market\.|expenses\.)/.test(key)){
    for(const root of [...host.children]){const hints=[...root.children].filter(n=>n.matches('p.hint')&&n.textContent.length>110);if(hints.length)root.append(el('details',{class:'basis-help'},[el('summary',{text:'Help and Modeling Notes'}),...hints]));}
  }
}
let basisReportPrefs=null;
function basisReportChoices(){return RNAV.flatMap(g=>g.subs.map(([id,name])=>({id,name,group:g.id})));}
function basisReportState(){
  if(basisReportPrefs)return basisReportPrefs;
  let saved={};try{const raw=localStorage.getItem('basis.report-shortcuts.v1')||'{}';if(raw.length<=16384)saved=JSON.parse(raw);}catch(e){}
  if(!saved||typeof saved!=='object'||Array.isArray(saved))saved={};
  const valid=new Set(basisReportChoices().map(r=>r.id)),clean=x=>Array.isArray(x)?[...new Set(x.filter(id=>typeof id==='string'&&valid.has(id)))].slice(0,6):[];
  return basisReportPrefs={pinned:clean(saved.pinned===undefined?['propsum','cf','rr']:saved.pinned),recent:clean(saved.recent)};
}
function basisSaveReportState(){try{localStorage.setItem('basis.report-shortcuts.v1',JSON.stringify(basisReportPrefs));}catch(e){/* Shortcuts remain usable in this tab. */}}
function basisReportShortcuts(){
  if(MODE!=='reports')return null;
  const state=basisReportState();if(!state.recent.includes(T2)||state.recent[0]!==T2){state.recent=[T2,...state.recent.filter(id=>id!==T2)].slice(0,6);basisSaveReportState();}
  const all=basisReportChoices(),select=el('select',{'aria-label':'Pinned and Recent Reports'},[el('option',{value:'',text:'Pinned and Recent Reports'})]);
  for(const [label,ids] of [['Pinned',state.pinned],['Recent',state.recent.filter(id=>!state.pinned.includes(id))]]){const group=el('optgroup',{label});for(const id of ids){const report=all.find(r=>r.id===id);if(report)group.append(el('option',{value:id,text:report.name}));}if(group.children.length)select.append(group);}
  select.onchange=()=>{const report=all.find(r=>r.id===select.value);if(report)go(report.group,report.id);};
  return el('div',{class:'bar basis-report-shortcuts'},[select,el('button',{class:'btn',text:state.pinned.includes(T2)?'Unpin Report':'Pin Report','aria-pressed':String(state.pinned.includes(T2)),onclick:()=>{
    state.pinned=state.pinned.includes(T2)?state.pinned.filter(id=>id!==T2):[T2,...state.pinned].slice(0,6);basisSaveReportState();drawPane();}}),
    el('button',{class:'btn',text:'Export / Backup',onclick:e=>basisOpenExport(e.currentTarget)})]);
}
/* END BASIS GUIDED UI */
