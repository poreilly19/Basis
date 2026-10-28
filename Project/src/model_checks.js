/* BEGIN BASIS MODEL CHECKS */
function basisModelIssues(model=S,result=R){
  const issues=[];
  validateModel(model,result,(issue,target)=>issues.push({...issue,target}));
  return issues;
}
function basisCheckDestination(issue){
  const target=issue.target||{},routes={tenants:['tenants','rr'],areas:['property','desc'],infl:['market','infl'],ops:['expenses','op'],mlas:['market','ml'],loans:['investment','debt'],position:['valuation','pos']};
  const categories={'Analysis':['property','desc'],'Engine':['property','desc'],'Area':['property','desc'],'Inflation':['market','infl'],'Expenses':['expenses','op'],
    'Market leasing':['market','ml'],'Rent roll':['tenants','rr'],'Recoveries':['tenants','recov'],'Occupancy':['tenants','rr'],
    'Ground lease':['valuation','pos'],'Cash flow':['tenants','rr'],'Valuation':['valuation','pvset']};
  const route=target.collection==='property'?(target.field==='years'?['property','desc']:target.field==='exitCap'?['valuation','resale']:['valuation','pvset']):routes[target.collection]||categories[issue.area]||['property','desc'];
  return {...target,route};
}
function basisOpenChecks(){basisCloseLeaseDrawer(false);setMode('reports');go('audit','validate');basisCheckReturn=null;}
function basisGoToCheck(issue){
  const context=basisWorkspaceKey(),target=basisCheckDestination(issue);
  basisCheckReturn={context};setMode('inputs');
  if(target.collection==='tenants'){const view=basisGroupView();view.query='';view.group='';view.selected.clear();}
  go(...target.route);
  let root=document.getElementById('pane');
  if(target.collection==='tenants'&&target.record){
    const tenant=S.tenants.find(t=>t.id===target.record),opener=[...root.querySelectorAll('[data-lease-edit]')].find(n=>n.dataset.leaseEdit===target.record&&n.getClientRects().length);
    if(tenant&&opener){basisOpenLeaseDrawer(tenant,opener);root=basisLeaseDrawer.body;}
  }
  const fields=[...root.querySelectorAll('[data-field]')];
  let field=fields.find(n=>n.dataset.field===target.field&&(!target.record||n.dataset.record===target.record));
  if(!field&&target.record){const row=[...root.querySelectorAll('tr')].find(n=>n.__it?.id===target.record);field=row?.querySelector('input,select,button');}
  if(!field&&target.collection==='tenants')field=fields.find(n=>n.dataset.record===target.record);
  if(field){
    for(let node=field.parentElement;node&&node!==root;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
    field.classList.add('basis-check-field');field.scrollIntoView({block:'center',inline:'nearest'});field.focus({preventScroll:true});
  }else{const heading=root.querySelector('h2,h3,h4');if(heading){heading.tabIndex=-1;heading.focus();}}
}
function basisRenderChecks(){
  const root=el('section',{'aria-label':'Model Checks'}),issues=basisModelIssues();
  root.append(el('h2',{text:'Model Checks'}),el('p',{class:'hint',text:'Automated checks flag inconsistencies and assumptions to confirm. Passing them does not verify source documents or certify the valuation.'}));
  if(calcPending){root.append(el('p',{class:'note',role:'status',text:'Calculating the current model. Checks will update when it finishes.'}));return root;}
  const labels={error:'Errors',warn:'Warnings',info:'Items to Confirm'};
  root.append(el('div',{class:'bar'},Object.entries(labels).map(([severity,label])=>el('span',{class:'pill',text:issues.filter(i=>i.sev===severity).length+' '+label}))));
  for(const [severity,label] of Object.entries(labels)){
    const items=issues.filter(i=>i.sev===severity);if(!items.length)continue;
    root.append(el('h3',{text:label}),...items.map(issue=>el('article',{class:'basis-check-item','data-severity':severity},[
      el('div',{},[el('strong',{text:issue.area+' · '+issue.msg}),issue.detail?el('p',{class:'hint',text:issue.detail}):null]),
      el('button',{class:'btn',text:issue.target?.field?'Go to Field':'Review Inputs',onclick:()=>basisGoToCheck(issue)})
    ])));
  }
  if(!issues.length)root.append(el('p',{class:'note',text:'No automated findings. Confirm the source inputs and modeling assumptions before using these results.'}));
  return root;
}
let basisCheckSummaryCache=null;
function basisCheckSummary(valid){
  let button=document.getElementById('basisCheckSummary');
  if(!button){button=el('button',{id:'basisCheckSummary',class:'btn',onclick:basisOpenChecks});document.getElementById('basisSummaryHint').after(button);}
  button.hidden=!valid;button.disabled=!!calcPending;
  if(valid&&!calcPending&&(!basisCheckSummaryCache||basisCheckSummaryCache.result!==R||basisCheckSummaryCache.model!==S||basisCheckSummaryCache.epoch!==calcEpoch))basisCheckSummaryCache={result:R,model:S,epoch:calcEpoch,issues:basisModelIssues()};
  const issues=valid&&!calcPending?basisCheckSummaryCache.issues:[];
  button.textContent=calcPending?'Model Checks · Calculating…':'Model Checks · '+issues.filter(i=>i.sev==='error').length+' Errors · '+issues.filter(i=>i.sev==='warn').length+' Warnings · '+issues.filter(i=>i.sev==='info').length+' to Confirm';
}
/* END BASIS MODEL CHECKS */
