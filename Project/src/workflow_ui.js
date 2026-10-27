/* BEGIN BASIS WORKFLOW UI */
// Presentation state stays out of property files, recovery drafts and exports.
let basisLeaseDrawer=null,basisTenantView=null;
const basisWorkspaceKey=()=>[PW.cur,PW.pf,PW.sc].join('|');
function basisGroupView(){
  const context=basisWorkspaceKey();
  if(!basisTenantView||basisTenantView.model!==S||basisTenantView.context!==context)
    basisTenantView={model:S,context,query:'',group:'',selected:new Set()};
  const view=basisTenantView,ids=new Set(S.tenants.map(t=>t.id));
  for(const id of view.selected)if(!ids.has(id))view.selected.delete(id);
  if(view.group&&!S.tgroups.some(g=>g.id===view.group))view.group='';
  return view;
}
function basisVisibleTenants(){
  const view=basisGroupView(),query=view.query.trim().toLowerCase();
  return S.tenants.filter(t=>(!query||[t.name,t.suite].some(value=>String(value||'').toLowerCase().includes(query)))&&
    (view.group===null?!basisTenantGroupIds(t).length:!view.group||basisTenantGroupIds(t).includes(view.group)));
}
function basisRentRollPresentation(table){
  const view=basisGroupView(),root=el('div',{class:'basis-rent-roll','data-mobile-layout':view.layout||'cards'});
  const layout=el('select',{'aria-label':'Rent Roll Layout',onchange:event=>{
    view.layout=event.target.value;root.dataset.mobileLayout=view.layout;
  }},[el('option',{value:'cards',text:'Tenant Cards'}),el('option',{value:'table',text:'Editable Table'})]);layout.value=view.layout||'cards';
  const tenants=basisVisibleTenants();
  const cards=el('div',{class:'basis-tenant-cards'},tenants.map(tenant=>{
    const unit=RENT_ALIAS[tenant.rentBasis]||tenant.rentBasis||'psfyr';
    const rent=unit==='mkt'?pc(tenant.rentPct===undefined||tenant.rentPct===''?1:num(tenant.rentPct))+' of Market':
      basisFormatNumber(num(tenant.rent),basisRentNumberFormat(unit))+' '+(RENT_UNIT_OPTS.find(option=>option.v===unit)?.t||unit).replace(/^\$\s*/, '');
    const groups=basisTenantGroupIds(tenant).map(id=>S.tgroups.find(group=>group.id===id)?.name||'Missing Group: '+id);
    const value=(label,text)=>el('div',{},[el('dt',{text:label}),el('dd',{text})]);
    return el('article',{class:'basis-tenant-card','aria-label':tenant.name||'Unnamed Tenant'},[
      el('header',{},[el('div',{},[el('h2',{text:tenant.name||'Unnamed Tenant'}),el('p',{class:'hint',text:[tenant.suite?'Suite '+tenant.suite:'No Suite',tenant.status||''].filter(Boolean).join(' · ')})]),
        el('button',{class:'btn','data-lease-edit':tenant.id,'aria-label':'Edit lease for '+tenant.name,text:'Edit Lease',onclick:event=>basisOpenLeaseDrawer(tenant,event.currentTarget)})]),
      el('dl',{},[value('Area',f0.format(num(tenant.sf))+' SF'),value('Base Rent',rent),value('Start',mdy(tenant.start,'s')||'Not Set'),value('Expiry',mdy(leaseEnd(tenant),'e')||'Not Set')]),
      groups.length?el('p',{class:'basis-card-groups',text:groups.join(' · ')}):null
    ]);
  }));
  if(!tenants.length)cards.append(el('p',{class:'note',text:S.tenants.length?'No tenants match these filters.':'Add a tenant or vacant space to start the rent roll.'}));
  root.append(el('label',{class:'basis-rent-layout'},[document.createTextNode('View '),layout]),cards,el('div',{class:'basis-rent-table'},[table]));
  return root;
}
function basisTenantFilters(){
  const view=basisGroupView();
  const redraw=control=>{const label=control.getAttribute('aria-label'),start=control.selectionStart;drawPane();
    const next=[...document.querySelectorAll('[aria-label]')].find(node=>node.getAttribute('aria-label')===label);
    if(next){next.focus({preventScroll:true});if(start!==null&&next.setSelectionRange)next.setSelectionRange(start,start);}};
  const search=el('input',{type:'search',value:view.query,'aria-label':'Search Tenants',placeholder:'Search Tenant or Suite',oninput:e=>{view.query=e.target.value;view.selected.clear();redraw(e.target);}});
  // Prefix real IDs so imported groups can never collide with All/Ungrouped.
  const filter=el('select',{'aria-label':'Filter by Tenant Group',onchange:e=>{const value=e.target.value;view.group=value==='ungrouped'?null:value.startsWith('group:')?value.slice(6):'';view.selected.clear();redraw(e.target);}},[
    el('option',{value:'all',text:'All Groups'}),el('option',{value:'ungrouped',text:'Ungrouped'}),...S.tgroups.map(g=>el('option',{value:'group:'+g.id,text:g.name}))]);filter.value=view.group===null?'ungrouped':view.group?'group:'+view.group:'all';
  return el('div',{class:'bar tenant-filter-bar'},[search,filter,el('span',{class:'hint',role:'status',text:basisVisibleTenants().length+' of '+S.tenants.length+' tenants'})]);
}
function basisGroupAssignments(){
  const view=basisGroupView(),visible=basisVisibleTenants();
  const status=el('span',{role:'status'}),toolbar=el('div',{class:'bar tenant-bulk-bar','aria-label':'Bulk Tenant Groups'});
  const selectAll=el('input',{type:'checkbox','aria-label':'Select All Visible Tenants'}),boxes=[];
  const sync=()=>{const n=view.selected.size;toolbar.hidden=!n;status.textContent=n+' Tenant'+(n===1?'':'s')+' Selected';
    selectAll.checked=!!visible.length&&visible.every(t=>view.selected.has(t.id));selectAll.indeterminate=visible.some(t=>view.selected.has(t.id))&&!selectAll.checked;};
  selectAll.disabled=!visible.length;
  selectAll.onchange=()=>{for(const t of visible)selectAll.checked?view.selected.add(t.id):view.selected.delete(t.id);for(const [box,t] of boxes)box.checked=view.selected.has(t.id);sync();};
  const table=grid([{t:'Select',w:'55px'},{t:'Tenant',w:'220px'},{t:'Suite',w:'90px'},{t:'Groups',w:'260px'}],visible,t=>{
    const box=el('input',{type:'checkbox','aria-label':'Select '+t.name,onchange:()=>{box.checked?view.selected.add(t.id):view.selected.delete(t.id);sync();}});box.checked=view.selected.has(t.id);boxes.push([box,t]);
    return [box,el('td',{text:t.name}),el('td',{text:t.suite||''}),el('td',{},[tenantGroupPicker(t)])];});
  table.querySelector('th').replaceChildren(selectAll);
  const group=el('select',{'aria-label':'Bulk Group'},S.tgroups.map(g=>el('option',{value:g.id,text:g.name})));
  toolbar.append(status,group,...['add','remove'].map(operation=>el('button',{class:'btn',text:operation==='add'?'Add Group':'Remove Group',disabled:!S.tgroups.length,
    onclick:e=>basisBulkGroupDialog(view,group.value,operation,e.currentTarget)})),el('button',{class:'btn',text:'Clear Selection',onclick:()=>{view.selected.clear();for(const [box] of boxes)box.checked=false;sync();}}));
  sync();return el('div',{},[basisTenantFilters(),el('p',{class:'hint',text:'Changing a filter clears the row selection. Select All applies to the visible tenants only.'}),toolbar,table,!visible.length?el('p',{class:'hint',text:'No tenants match these filters.'}):null]);
}
function basisBulkGroupDialog(view,groupId,operation,opener){
  const model=S,context=basisWorkspaceKey(),ids=[...view.selected],group=S.tgroups.find(g=>g.id===groupId);
  if(!group||!ids.length)return;
  const initial=ids.map(id=>{const tenant=S.tenants.find(t=>t.id===id);return {tenant,json:JSON.stringify(basisTenantGroupIds(tenant))};});
  const error=el('p',{class:'note err',role:'alert',hidden:true});
  const dialog=el('dialog',{class:'tenant-group-dialog','aria-label':'Review Bulk Group Change'},[
    el('h2',{text:(operation==='add'?'Add ':'Remove ')+group.name}),
    el('p',{text:(operation==='add'?'Add this group to ':'Remove this group from ')+ids.length+' selected tenants. All other memberships stay in place.'}),
    el('ul',{class:'tenant-group-options'},initial.map(({tenant})=>el('li',{text:tenant.name}))),error]);
  dialog.append(el('div',{class:'bar'},[el('button',{class:'btn',text:'Cancel',onclick:()=>dialog.close()}),el('button',{class:'btn p',text:'Apply to Selected Tenants',onclick:()=>{
    try{
      if(S!==model||context!==basisWorkspaceKey()||JSON.stringify([...view.selected])!==JSON.stringify(ids)||initial.some(({tenant,json})=>!S.tenants.includes(tenant)||json!==JSON.stringify(basisTenantGroupIds(tenant))))
        throw Error('The property, selection or memberships changed. Close this dialog and review the selection again.');
      histCommit();const changed=basisBulkTenantGroups(S,ids,groupId,operation);view.selected.clear();if(changed){DIRTY();histCommit();}dialog.close();drawPane();
    }catch(e){error.textContent=e.message;error.hidden=false;}
  }})]));
  dialog.addEventListener('keydown',e=>e.stopPropagation());
  dialog.addEventListener('close',()=>{dialog.remove();if(opener.isConnected)opener.focus();else document.querySelector('[aria-label="Select All Visible Tenants"]')?.focus();},{once:true});
  document.body.append(dialog);dialog.showModal();dialog.querySelector('button').focus();
}
function basisOpenLeaseDrawer(tenant,opener){
  if(basisLeaseDrawer)basisCloseLeaseDrawer(false);
  LEASE_SEL=tenant.id;
  const dialog=el('dialog',{class:'basis-lease-drawer','aria-label':'Lease Editor for '+tenant.name,'aria-modal':'false'});
  const title=el('h2',{text:tenant.name}),subtitle=el('p',{class:'hint'}),body=el('div',{class:'basis-lease-body'});
  const close=el('button',{class:'btn',text:'Close','aria-label':'Close Lease Editor',onclick:()=>basisCloseLeaseDrawer()});
  const previous=el('button',{class:'btn',text:'‹','aria-label':'Previous Tenant',onclick:()=>basisStepLease(-1)}),next=el('button',{class:'btn',text:'›','aria-label':'Next Tenant',onclick:()=>basisStepLease(1)}),position=el('span',{class:'hint',role:'status'});
  dialog.append(el('header',{class:'basis-lease-head'},[el('div',{},[el('span',{class:'hint',text:'Lease Editor'}),title,subtitle]),el('div',{class:'basis-lease-actions'},[previous,position,next,close])]),
    el('p',{class:'basis-lease-save hint',text:'Edits update this property as you leave each field. Workspace autosave settings apply.'}),body);
  basisLeaseDrawer={dialog,title,subtitle,body,tenant,opener,previous,next,position,model:S,context:basisWorkspaceKey(),open:new Set(['Lease Basics']),snapshot:'',result:null};
  const pointerEvents=new AbortController();basisLeaseDrawer.pointerEvents=pointerEvents;
  dialog.addEventListener('pointerdown',()=>{if(basisLeaseDrawer?.dialog===dialog)basisLeaseDrawer.pointerDown=true;},true);
  for(const type of ['pointerup','pointercancel'])window.addEventListener(type,()=>{const drawer=basisLeaseDrawer;if(drawer?.dialog!==dialog||!drawer.pointerDown)return;setTimeout(()=>{if(basisLeaseDrawer!==drawer)return;drawer.pointerDown=false;const force=drawer.needsRefresh;drawer.needsRefresh=false;basisSyncLeaseDrawer(force);},0);},{capture:true,signal:pointerEvents.signal});
  dialog.addEventListener('change',event=>{
    const drawer=basisLeaseDrawer;
    if(!drawer||drawer.model!==S||drawer.context!==basisWorkspaceKey()||!S.tenants.includes(drawer.tenant))event.stopImmediatePropagation();
  },true);
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();basisCloseLeaseDrawer();}event.stopPropagation();});
  dialog.addEventListener('change',()=>queueMicrotask(()=>basisSyncLeaseDrawer(true)));
  dialog.addEventListener('focusout',()=>setTimeout(()=>basisSyncLeaseDrawer(),0));
  document.body.append(dialog);dialog.show();basisSyncLeaseDrawer(true);opener.closest('tr')?.classList.add('basis-lease-selected');close.focus({preventScroll:true});
}
function basisStepLease(direction){
  const drawer=basisLeaseDrawer;if(!drawer||drawer.model!==S||drawer.context!==basisWorkspaceKey())return;
  const active=document.activeElement;if(drawer.dialog.contains(active))active.blur();
  const invalid=drawer.body.querySelector('[aria-invalid="true"]');if(invalid){invalid.focus();invalid.reportValidity?.();return;}
  const tenants=basisVisibleTenants(),index=tenants.indexOf(drawer.tenant),tenant=tenants[index+direction];if(index<0||!tenant)return;
  drawer.open=new Set([...drawer.body.querySelectorAll('details[open] > summary')].map(n=>n.textContent));
  document.querySelectorAll('.basis-lease-selected').forEach(n=>n.classList.remove('basis-lease-selected'));
  drawer.tenant=tenant;LEASE_SEL=tenant.id;
  drawer.opener=[...document.querySelectorAll('[data-lease-edit]')].find(n=>n.dataset.leaseEdit===tenant.id&&n.getClientRects().length)||drawer.opener;
  drawer.opener.closest('tr')?.classList.add('basis-lease-selected');basisSyncLeaseDrawer(true);
}
function basisCloseLeaseDrawer(restore=true){
  const drawer=basisLeaseDrawer;if(!drawer)return;
  const positions=[...document.querySelectorAll('#pane .scroll')].map(node=>[node.scrollLeft,node.scrollTop]);
  if(drawer.dialog.contains(document.activeElement))document.activeElement.blur();
  drawer.pointerEvents?.abort();basisLeaseDrawer=null;LEASE_SEL=null;drawer.dialog.close();drawer.dialog.remove();
  if(restore){drawPane();document.querySelectorAll('#pane .scroll').forEach((node,index)=>{if(positions[index]){node.scrollLeft=positions[index][0];node.scrollTop=positions[index][1];}});
    const target=drawer.opener.isConnected&&drawer.opener.getClientRects().length?drawer.opener:[...document.querySelectorAll('[data-lease-edit]')].find(button=>button.dataset.leaseEdit===drawer.tenant.id&&button.getClientRects().length);target?.focus({preventScroll:true});}
}
function basisLeaseSections(tenant,sections,chain){
  const root=el('div',{}),drawer=basisLeaseDrawer;
  for(const section of sections){const heading=section.querySelector('h3'),title=heading.textContent.replace(/\b[a-z]/g,c=>c.toUpperCase()).replace(/\b(And|Of|To)\b/g,word=>word.toLowerCase());heading.remove();
    const details=el('details',{class:'basis-lease-section','data-section':title},[el('summary',{text:title}),section]);details.open=drawer?.open.has(title)||false;
    details.addEventListener('toggle',()=>{if(details.isConnected&&basisLeaseDrawer===drawer)details.open?drawer.open.add(title):drawer.open.delete(title);});root.append(details);}
  const forecast=el('details',{class:'basis-lease-section'},[el('summary',{text:'Projected Lease Timeline'}),
    R?el('div',{class:'scroll'},[chain]):el('p',{class:'hint',text:'Recalculating the lease timeline…'})]);
  forecast.open=drawer?.open.has('Projected Lease Timeline')||false;
  forecast.addEventListener('toggle',()=>{if(forecast.isConnected&&basisLeaseDrawer===drawer)forecast.open?drawer.open.add('Projected Lease Timeline'):drawer.open.delete('Projected Lease Timeline');});root.append(forecast);
  return root;
}
function basisSyncLeaseDrawer(force=false){
  const drawer=basisLeaseDrawer;if(!drawer)return;
  if(drawer.model!==S||drawer.context!==basisWorkspaceKey()||!S.tenants.includes(drawer.tenant)||MODE!=='inputs'||T1!=='tenants'||T2!=='rr'){basisCloseLeaseDrawer(false);return;}
  if(drawer.pointerDown){drawer.needsRefresh=drawer.needsRefresh||force;return;}
  const active=document.activeElement,editing=drawer.dialog.contains(active)&&active.matches('input,select,textarea');
  if(editing&&!force)return;
  const snapshot=JSON.stringify(drawer.tenant);if(!force&&snapshot===drawer.snapshot&&R===drawer.result)return;
  const controls=()=>[...drawer.body.querySelectorAll('input,select,textarea,button')];
  const key=node=>node.getAttribute('aria-label')||node.closest('.f')?.querySelector('label > span')?.textContent||node.textContent;
  const label=editing?key(active):null,index=editing?controls().filter(node=>key(node)===label).indexOf(active):-1,scroll=drawer.body.scrollTop;
  // Read open states synchronously; native toggle events may not have run yet.
  drawer.open=new Set([...drawer.body.querySelectorAll(':scope > div > details[open] > summary')].map(node=>node.textContent));
  if(!drawer.body.firstChild)drawer.open.add('Lease Basics');
  drawer.body.replaceChildren(leaseDetailEditor());drawer.title.textContent=drawer.tenant.name;
  drawer.subtitle.textContent=[drawer.tenant.suite?'Suite '+drawer.tenant.suite:'',f0.format(num(drawer.tenant.sf))+' SF',S.name].filter(Boolean).join(' · ');
  drawer.dialog.setAttribute('aria-label','Lease Editor for '+drawer.tenant.name);
  drawer.snapshot=JSON.stringify(drawer.tenant);drawer.result=R;
  const tenants=basisVisibleTenants(),at=tenants.indexOf(drawer.tenant);drawer.previous.disabled=at<=0;drawer.next.disabled=at<0||at>=tenants.length-1;drawer.position.textContent=at<0?'Filtered Out':(at+1)+' / '+tenants.length;
  if(editing){const next=controls().filter(node=>key(node)===label)[index];next?.focus({preventScroll:true});}
  drawer.body.scrollTop=scroll;
}
function basisInlineAISetup(opener){
  let status=basisAIStatus();
  const dialog=el('dialog',{class:'tenant-group-dialog basis-ai-setup','aria-label':'Configure AI for Document Import'});
  const provider=el('select',{'aria-label':'AI Provider'},[['host','Host Integration'],['openai','OpenAI'],['anthropic','Anthropic']].map(([value,text])=>el('option',{value,text})));provider.value=status.provider;
  const model=el('input',{type:'text','aria-label':'AI Model',value:status.model||'',autocomplete:'off',spellcheck:'false'});
  const key=el('input',{type:'password','aria-label':'API Key',autocomplete:'off',spellcheck:'false',placeholder:status.configured?'Key configured for this session':'Paste your API key'});
  const modelRow=field('AI Model','Use a model available to your API account.',model),keyRow=field('API Key','Kept in memory for this tab. Reloading clears the key.',key),error=el('p',{class:'note err',role:'alert',hidden:true});
  const refresh=()=>{modelRow.hidden=keyRow.hidden=provider.value==='host';model.value=provider.value===status.provider?status.model:provider.value==='openai'?'gpt-4.1':'claude-sonnet-4-5';key.value='';};provider.onchange=refresh;refresh();
  dialog.append(el('h2',{text:'Connect AI'}),el('p',{text:'Your uploaded documents stay here while you configure extraction.'}),
    field('AI Provider','Use your own API account or an available host integration.',provider),modelRow,keyRow,
    el('p',{class:'hint',text:'Extract sends selected document text or images and limited property context directly to this provider. Your API account pays usage charges. Saving setup sends no documents.'}),
    INT.x?el('p',{class:'note',text:'Changing AI setup clears the current extraction review. Your uploaded documents are kept so you can extract again.'}):null,error,
    el('div',{class:'bar'},[el('button',{class:'btn',text:'Cancel',onclick:()=>dialog.close()}),el('button',{class:'btn p',text:'Use AI Setup',onclick:()=>{
      try{status=basisAIStatus();const options={provider:provider.value,model:model.value.trim()};
        if(key.value.trim()||provider.value!==status.provider||!status.configured)options.apiKey=key.value.trim();
        basisConfigureAI(options);key.value='';dialog.close();drawPane();
      }catch(e){error.textContent=e.message;error.hidden=false;}
    }})]));
  dialog.addEventListener('keydown',e=>e.stopPropagation());dialog.addEventListener('close',()=>{key.value='';dialog.remove();
    const target=opener?.isConnected?opener:document.querySelector('[data-intake-ai]');target?.focus({preventScroll:true});},{once:true});
  document.body.append(dialog);dialog.showModal();provider.focus();
}
function basisIntakeSteps(){
  const step=INT.x?1:INT.applied?2:0;
  return el('ol',{class:'basis-intake-steps','aria-label':'Document Import Progress'},['Upload','Review','Apply'].map((name,index)=>
    el('li',{'aria-current':index===step?'step':null,class:index<step?'complete':'',text:(index+1)+'. '+name})));
}
function basisSourceCell(source){
  return el('div',{class:'basis-source'},[el('span',{text:intSrcLabel(source)||'No source supplied'}),source?.quote?el('q',{text:source.quote}):null,source?.evidence?el('span',{class:'hint',text:BASIS_EVIDENCE_LABELS[source.evidence]||'Check the original source.'}):null,source?.scope==='tenant'?el('span',{class:'hint',text:'Tenant-level citation; confirm that it supports this field.'}):null,source&&source.evidence!=='model'?el('button',{class:'btn',text:'View Source',onclick:e=>basisViewSource(source,e.currentTarget)}):null]);
}
function basisCurrentInput(key){
  const map={name:'name',address:'addr',city:'city',state:'state',zip:'zip',submarket:'submarket',yearBuilt:'yearBuilt',type:'ptype',
    vacancyPct:'gvRate',creditLossPct:'clRate',rentGrowth:'inflRent',expenseGrowth:'inflExp',purchasePrice:'price',goingInCap:'goingInCap',exitCap:'exitCap',discountRate:'discount',holdYears:'years',saleCostPct:'costSale'};
  const model=INT.target?JSON.parse(INT.target.json):S;
  if(key==='rentableSF')return rentableSF(model);if(key==='analysisStart')return mKey(model.startYear,model.startMonth);
  return model[map[key]];
}
function basisIntakeValue(value,key){
  const percentages=new Set(['vacancyPct','creditLossPct','rentGrowth','expenseGrowth','exitCap','goingInCap','discountRate','saleCostPct',
    'gvRate','clRate','inflRent','inflExp','discount','costSale','step','freePct','optStep','optLC','breakProb','prRate','renewProb','lcNewPct','lcRenewPct','newPct','renewPct','ltv','rate','spread','feePct','exitFeePct']);
  if(value===undefined)return '—';if(value===null)return 'Inherited / Blank';
  if(typeof value==='boolean')return value?'Yes':'No';
  if(typeof value==='number'&&percentages.has(key))return Number((value*100).toFixed(6))+'%';
  return String(value);
}
function basisIntakeComparison(){
  const host=el('section',{class:'basis-intake-comparison','aria-label':'Selected Changes'});
  host.append(el('h4',{text:'Selected Changes'}),el('p',{class:'hint',text:'Current values are the property snapshot captured for this extraction. Proposed values come from the same mapping used by Apply. Use Review Tenant Fields to keep or correct individual proposals. Source quotes are attached to each selected item; review them against the original document.'}));
  if(!Object.values(INT.pick).some(Boolean)){host.append(el('p',{text:'Select at least one item to review its changes.'}));return host;}
  try{
    const before=JSON.parse(INT.target.json),prepared=intPrepareApply(before,INT.x,INT.pick,INT.mode,INT.review||{}),after=prepared.model,rows=[];
    const labels={tenants:'Tenant',ops:'Expense',misc:'Other Income',caps:'Capital',mlas:'Leasing Profile',recs:'Recovery Structure',tis:'Improvements',lcs:'Commissions',frees:'Free Rent',loans:'Loan',areas:'Area',name:'Name',addr:'Address',city:'City',state:'State',zip:'ZIP',ptype:'Property Type',yearBuilt:'Year Built',sf:'Area (SF)',rent:'Base Rent',rentBasis:'Rent Unit',step:'Annual Step',start:'Start',end:'Expiry',rec:'Recovery Structure',mla:'Leasing Profile',sched:'Rent Schedule',gvRate:'General Vacancy',clRate:'Credit Loss',inflRent:'Rent Growth',inflExp:'Expense Growth',price:'Purchase Price',priceMode:'Purchase Price Basis',exitCap:'Exit Cap',discount:'Discount Rate',years:'Hold Years',costSale:'Sale Costs',startYear:'Analysis Start Year',startMonth:'Analysis Start Month',amt:'Amount',recov:'Recoverable',basis:'Basis',suite:'Suite'};
    const label=key=>labels[key]||key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,s=>s.toUpperCase());
    const ref={rec:'recs',mla:'mlas',cpi:'cpis',tiRef:'tis',lcRef:'lcs',frRef:'frees',mrNewRef:'mrs',mrRenewRef:'mrs'};
    const value=(v,key,model)=>v&&typeof v==='object'?(Array.isArray(v)?v.length?v.map((item,index)=>'Entry '+(index+1)+': '+value(item,'',model)).join('\n'):'None':
      Object.entries(v).filter(([field])=>field!=='id').map(([field,item])=>label(field)+': '+value(item,field,model)).join('; ')):
      ref[key]&&typeof v==='string'?(model[ref[key]]||[]).find(item=>item.id===v)?.name||v||'None':basisIntakeValue(v,key);
    const sourceFor=(collection,item,field)=>{
      const X=INT.x;if(collection==='tenants')return prepared.tenantReviews.filter(r=>r.after.id===item.id).flatMap(r=>field?basisIntakeFieldSources({src:r.source,fieldSources:r.fieldSources},field):r.sources?.length?r.sources:[r.source]);
      if(collection==='ops')return X.expenses.filter(g=>INT.pick['e:'+g.key]&&(g.r.match===item.id||g.r.name===item.name)).map(g=>g.r.src);
      for(const [kind,prefix] of [['other','o'],['capital','c'],['profiles','pf'],['debt','d']])if({misc:'other',caps:'capital',mlas:'profiles',loans:'debt'}[collection]===kind)return X[kind].filter(g=>INT.pick[prefix+':'+g.key]&&g.name===item.name).map(g=>g.src);
      return [];
    };
    const sourcesNode=sources=>{const unique=[...new Map(sources.filter(Boolean).map(s=>[JSON.stringify(s),s])).values()];return unique.length?el('div',{},unique.map(basisSourceCell)):el('span',{class:'mut',text:'Derived by the selected import mapping'});};
    const add=(path,key,a,b,sources,current,proposed)=>{if(JSON.stringify(a)!==JSON.stringify(b))rows.push({cells:[path,key==='rent'||key==='sf'?basisReviewDisplay(a,key,current||{},before):value(a,key,before),key==='rent'||key==='sf'?basisReviewDisplay(b,key,proposed||{},after):value(b,key,after),sourcesNode(sources)]});};
    const topSource={addr:'address',ptype:'type',gvRate:'vacancyPct',clRate:'creditLossPct',inflRent:'rentGrowth',inflExp:'expenseGrowth',price:'purchasePrice',priceMode:'purchasePrice',discount:'discountRate',years:'holdYears',costSale:'saleCostPct',startYear:'analysisStart',startMonth:'analysisStart'};
    for(const key of new Set([...Object.keys(before),...Object.keys(after)])){
      if(key==='srcLog'||JSON.stringify(before[key])===JSON.stringify(after[key]))continue;
      const a=before[key],b=after[key],X=INT.x,sourceKey=topSource[key]||key;
      if(Array.isArray(a)&&Array.isArray(b)&&[...a,...b].every(item=>item&&typeof item==='object'&&item.id)){
        const old=new Map(a.map(item=>[item.id,item])),next=new Map(b.map(item=>[item.id,item]));
        for(const id of new Set([...old.keys(),...next.keys()])){const current=old.get(id),proposed=next.get(id),item=proposed||current,path=label(key)+' · '+(item.name||item.suite||id),sources=key==='areas'?[X.property.rentableSF?.src]:sourceFor(key,item);
          if(!proposed){add(path,'',current,undefined,[]);continue;}
          for(const field of new Set([...Object.keys(current||{}),...Object.keys(proposed)]))if(field!=='id')add(path+' · '+label(field),field,current?.[field],proposed[field],key==='tenants'?sourceFor(key,item,field):sources,current,proposed);
        }
      }else add(label(key),key,a,b,[X.property[sourceKey]?.src||X.market[sourceKey]?.src||X.valuation[sourceKey]?.src]);
    }
    host.append(INT.mode==='replace'?el('p',{class:'note',text:'Apply creates a new property. Removed rows shown below are removed from the copy; the original property stays in your library.'}):el('p',{class:'hint',text:'Apply updates the current property.'}),
      rows.length?intTable(['Input','Current','Proposed','Source for Selected Item'],rows):el('p',{text:'The selected values already match the model.'}));
    if(prepared.blocked?.length)host.append(el('p',{class:'note err',role:'alert',text:prepared.blocked.join(' ')}));
    if(prepared.applied.notes.length)host.append(el('h4',{text:'Follow-Up After Apply'}),el('ul',{},prepared.applied.notes.map(text=>el('li',{text}))));
  }catch(error){host.append(el('p',{class:'note err',role:'alert',text:'Cannot prepare these selected inputs: '+error.message}));}
  return host;
}
function basisRefreshIntakeComparison(refreshFields=false){
  if(refreshFields)document.querySelector('.basis-tenant-field-review')?.replaceWith(basisTenantFieldReview());
  document.querySelector('.basis-intake-comparison')?.replaceWith(basisIntakeComparison());
  const apply=document.querySelector('[data-intake-apply]');if(apply)apply.disabled=INT.busy||INT.applying||!intTargetCurrent(INT.target)||!Object.values(INT.pick).some(Boolean)||!!document.querySelector('.basis-tenant-field-review [aria-invalid="true"]')||!!document.querySelector('.basis-intake-comparison [role="alert"]');
}
/* END BASIS WORKFLOW UI */
