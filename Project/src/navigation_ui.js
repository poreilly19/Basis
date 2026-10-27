/* BEGIN BASIS NAVIGATION UI */
// These controls hold presentation state only; property files and preferences stay unchanged.
const basisNavigation={initialized:false,mode:'',route:'',groups:new Map(),returnToRoute:false};
function basisInitNavigation(){
  if(basisNavigation.initialized)return;
  basisNavigation.initialized=true;
  const dialog=$('#basisNavigationDialog'),media=matchMedia('(max-width:900px)');basisNavigation.media=media;
  $('#basisSidebarToggle').onclick=()=>dialog.close();
  media.addEventListener('change',()=>{if(!media.matches&&dialog.open)dialog.close();});
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>{
    const target=basisNavigation.returnToRoute?$('#basisLocation'):media.matches?$('#basisSectionsOpen'):$('#nav1 [aria-selected="true"]');
    basisNavigation.returnToRoute=false;
    $('#basisSectionsOpen')?.setAttribute('aria-expanded','false');
    if(target?.getClientRects().length)target.focus({preventScroll:true});
  });
  const summary=$('#basisSummary');
  summary.addEventListener('toggle',()=>{if(summary.open)renderKPI();});
  summary.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();summary.open=false;summary.querySelector('summary').focus();}});
  document.addEventListener('click',event=>{if(summary.open&&!summary.contains(event.target))summary.open=false;});
}
function basisOpenNavigation(){
  if(MODE==='portfolio'||!basisNavigation.media?.matches)return;
  basisNavigation.returnToRoute=false;
  basisNavigation.route='';basisRenderNavigation();
  const dialog=$('#basisNavigationDialog');dialog.showModal();
  $('#basisSectionsOpen').setAttribute('aria-expanded','true');
  const current=$('#basisSections [aria-current="page"]');
  (current||$('#basisSidebarToggle')).focus({preventScroll:true});
  current?.scrollIntoView({block:'nearest'});
}
function basisKeepTabVisible(tab){
  if(!tab?.getClientRects().length)return;
  const bar=tab.closest('[role="tablist"]'),bounds=tab.getBoundingClientRect(),viewport=bar?.getBoundingClientRect();
  if(!viewport)return;
  if(bounds.left<viewport.left+8)bar.scrollLeft-=viewport.left+8-bounds.left;
  else if(bounds.right>viewport.right-8)bar.scrollLeft+=bounds.right-viewport.right+8;
}
function basisTabKeys(event){
  if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  const tabs=[...event.currentTarget.querySelectorAll('[role="tab"]')].filter(tab=>!tab.disabled),at=tabs.indexOf(event.target);
  if(at<0||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();event.stopPropagation();
  const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(at+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  tabs.forEach((tab,index)=>tab.tabIndex=index===next?0:-1);
  tabs[next].focus({preventScroll:true});basisKeepTabVisible(tabs[next]);
}
function basisRenderDesktopTabs(groups){
  const sections=$('#nav1'),pages=$('#nav2'),group=groups.find(g=>g.id===T1)||groups[0];
  sections.setAttribute('aria-label',MODE==='reports'?'Reports Sections':'Inputs Sections');
  if(sections.dataset.mode!==MODE){
    sections.dataset.mode=MODE;sections.replaceChildren(...groups.map(g=>el('button',{type:'button',role:'tab',id:'basisSection-'+MODE+'-'+g.id,'data-section':g.id,'aria-controls':'basisPages',text:g.label,
      onclick:()=>go(g.id,g.id===T1?T2:g.subs[0][0])})));sections.onkeydown=basisTabKeys;
  }
  const pageGroup=MODE+'/'+group.id;
  if(pages.dataset.group!==pageGroup){
    pages.dataset.group=pageGroup;pages.setAttribute('aria-label',group.label+' Pages');
    pages.replaceChildren(...group.subs.map(([id,label])=>el('button',{type:'button',role:'tab',id:'basisPage-'+MODE+'-'+group.id+'-'+id,'data-page':id,'aria-controls':'pane',text:label,onclick:()=>go(group.id,id)})));
    pages.onkeydown=basisTabKeys;
  }
  for(const [bar,key,value]of [[sections,'section',T1],[pages,'page',T2]])for(const tab of bar.querySelectorAll('[role="tab"]')){
    const active=tab.dataset[key]===value;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;
  }
  $('#basisPages').setAttribute('aria-labelledby','basisSection-'+MODE+'-'+group.id);
  $('#pane').setAttribute('aria-labelledby','basisPage-'+MODE+'-'+group.id+'-'+T2);
  const route=MODE+'/'+T1+'/'+T2;
  if(basisNavigation.desktopRoute!==route){basisNavigation.desktopRoute=route;basisKeepTabVisible(sections.querySelector('[aria-selected="true"]'));basisKeepTabVisible(pages.querySelector('[aria-selected="true"]'));}
}
function basisRenderNavigation(){
  basisInitNavigation();
  const summary=$('#basisSummary');summary.hidden=MODE==='portfolio';
  $('#basisHeaderKpis').hidden=MODE==='portfolio'||!basisSummaryContext()||!R;
  if(MODE==='portfolio'){
    summary.open=false;if($('#basisNavigationDialog').open)$('#basisNavigationDialog').close();return;
  }
  const nav=$('#basisSections'),groups=MODE==='reports'?RNAV:NAV,route=MODE+'/'+T1+'/'+T2;
  basisRenderDesktopTabs(groups);
  $('#basisSidebarTitle').textContent=MODE==='reports'?'Reports':'Inputs';
  nav.setAttribute('aria-label',MODE==='reports'?'Reports Sections':'Inputs Sections');
  if(basisNavigation.mode!==MODE){
    basisNavigation.mode=MODE;nav.replaceChildren();
    for(const group of groups){
      const key=MODE+'/'+group.id,children=el('div',{id:'basisMobileSection-'+group.id,class:'basis-section-links'});
      const heading=el('button',{class:'basis-section-heading','data-section':group.id,'aria-label':group.label,'aria-controls':children.id,text:group.label,
        onclick:()=>{const open=heading.getAttribute('aria-expanded')!=='true';for(const item of groups)basisNavigation.groups.set(MODE+'/'+item.id,false);basisNavigation.groups.set(key,open);basisRenderNavigation();}});
      children.append(...group.subs.map(([id,label])=>el('button',{class:'basis-section-link','data-group':group.id,'data-page':id,text:label,
        onclick:()=>{go(group.id,id);if($('#basisNavigationDialog').open){basisNavigation.returnToRoute=true;$('#basisNavigationDialog').close();}}})));
      nav.append(el('div',{class:'basis-section'},[heading,children]));
    }
  }
  if(basisNavigation.route!==route){for(const item of groups)basisNavigation.groups.set(MODE+'/'+item.id,item.id===T1);basisNavigation.route=route;}
  for(const heading of nav.querySelectorAll('[data-section]')){
    const open=!!basisNavigation.groups.get(MODE+'/'+heading.dataset.section);
    heading.setAttribute('aria-expanded',String(open));heading.nextElementSibling.hidden=!open;
    heading.classList.toggle('is-current',heading.dataset.section===T1);
  }
  for(const link of nav.querySelectorAll('[data-page]')){
    if(link.dataset.group===T1&&link.dataset.page===T2)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  }
}
function basisSummaryContext(){
  const active=PW.ix?pwRec(PW.cur):null;
  return !active||active.pf===PW.pf&&active.sc===PW.sc;
}
function basisUpdateSummary(){
  const valid=basisSummaryContext();
  $('#basisSummaryProperty').textContent=valid?(S.name||'Untitled Property'):'Choose a Property';
  $('#basisSummaryContext').textContent=[pwPf()?.name,pwSc()?.name].filter(Boolean).join(' · ');
  $('#basisSummaryHint').textContent=!valid?'Open a property in the selected portfolio and scenario.':!R?(calcPending?'Calculating the current model…':calcIssue||'No calculated results available.'):'Modeled results. Check source inputs and assumptions before relying on them.';
  $('#kpis').hidden=!valid||!R;
  const header=$('#basisHeaderKpis');header.hidden=MODE==='portfolio'||!valid||!R;
  header.setAttribute('aria-label','Current Property Metrics'+(valid?' — '+(S.name||'Untitled Property'):''));
  basisCheckSummary(valid);return valid;
}
function basisRenderContext(){
  basisInitNavigation();
  const bar=$('#pwbar');
  if(!PW.ix){bar.textContent='Loading Portfolios…';basisUpdateSummary();return;}
  const contextKey=[PW.cur,PW.pf,PW.sc,MODE].join('|');
  if(basisNavigation.context!==contextKey){$('#basisSummary').open=false;basisNavigation.context=contextKey;}
  if(!$('#basisPropertyPick')){
    bar.replaceChildren();
    const pick=el('select',{id:'basisPropertyPick',class:'basis-property-pick','aria-label':'Switch property',title:'Switch property (Alt+PageUp / Alt+PageDown)'});
    pick.onchange=async()=>{
      const target=pick.value;
      // Keep the visible name on the model actually displayed while storage is read.
      pick.value=pwList().some(p=>p.id===PW.cur)?PW.cur:'';
      try{if(target)await pwOpen(target);}finally{basisRenderContext();}
    };
    const actions=kBarBtns(),status=actions.pop();
    actions[0].textContent='↶';actions[1].textContent='↷';
    bar.append(el('div',{class:'basis-context-main'},[
      el('button',{id:'basisSectionsOpen',class:'btn basis-sections-open',text:'Sections','aria-haspopup':'dialog','aria-controls':'basisNavigationDialog','aria-expanded':'false',onclick:basisOpenNavigation}),
      el('button',{id:'basisContextChange',class:'btn basis-context-change','aria-label':'Change Portfolio or Scenario','aria-haspopup':'dialog',onclick:e=>basisContextDialog(e.currentTarget)}),
      el('div',{id:'basisPropertyTabs',class:'pwtabs',role:'tablist','aria-label':'Open Properties'}),
      el('label',{class:'basis-property-label'},[el('span',{text:'All Properties'}),pick]),
      el('div',{class:'basis-context-actions'},actions)
    ]),el('div',{class:'basis-context-detail'},[
      el('div',{id:'basisLocation',class:'basis-location',tabindex:'-1'}),
      el('span',{id:'pwst',class:'pwst',role:'status'}),status
    ]));
  }
  const pick=$('#basisPropertyPick'),list=PW.ix?pwList():[],current=list.find(p=>p.id===PW.cur);
  const entries=list.map(p=>[p.id,p.id===PW.cur?(S.name||p.name):p.name]);
  if(!current)entries.unshift(['',PW.cur?'Choose a Property':PW.ix?'Unsaved Property':'Loading Properties…']);
  const options=JSON.stringify(entries);
  if(pick.dataset.options!==options){pick.replaceChildren(...entries.map(([value,text])=>el('option',{value,text})));pick.dataset.options=options;}
  pick.value=current?PW.cur:'';pick.disabled=!list.length;
  pick.title=(current?(S.name||current.name):'Choose a Property')+' — Switch Property (Alt+PageUp / Alt+PageDown)';
  const context=$('#basisContextChange'),label=[pwPf()?.name,pwSc()?.name].filter(Boolean).join(' · ');
  context.textContent=label||'Portfolio · Scenario';context.title=label+' — Change Portfolio or Scenario';context.disabled=!PW.ix;
  const group=(MODE==='reports'?RNAV:NAV).find(g=>g.id===T1),page=group?.subs.find(([id])=>id===T2);
  const location=$('#basisLocation');location.replaceChildren(el('span',{text:group?.label||''}),el('strong',{text:page?.[1]||''}));
  basisRenderPropertyTabs();basisUpdateSummary();pwStatus(PW.status);histBtns();
}
function basisRenderPropertyTabs(){
  const tabs=$('#basisPropertyTabs');if(!tabs)return;
  const allowed=new Set(pwList().map(p=>p.id)),ids=[...new Set(PW.local.open)].filter(id=>allowed.has(id));
  // Returning to Model explicitly reopens its current property after the last tab was closed.
  if(MODE!=='portfolio'&&allowed.has(PW.cur)&&!ids.includes(PW.cur)){ids.push(PW.cur);PW.local.open.push(PW.cur);pwLocalSave();}
  const signature=JSON.stringify(ids);
  if(tabs.dataset.ids!==signature){
    const oldFocus=tabs.contains(document.activeElement)?document.activeElement.dataset.property:null;
    tabs.replaceChildren(...ids.map(id=>el('div',{class:'pwtab','data-open-property':id},[
      el('button',{type:'button',class:'pwt',role:'tab','data-property':id,'aria-controls':'basisModelView',onclick:()=>pwOpen(id)}),
      el('button',{type:'button',class:'pwx',text:'×','data-close-property':id,onclick:async()=>{if(await pwCloseTab(id)){const target=[tabs.querySelector('[aria-selected="true"]'),$('#basisPropertyPick'),$('#modePf')].find(node=>node?.getClientRects().length);target?.focus({preventScroll:true});}}})
    ])));
    tabs.dataset.ids=signature;tabs.onkeydown=basisTabKeys;
    if(oldFocus){const target=[...tabs.querySelectorAll('[data-property]')].find(tab=>tab.dataset.property===oldFocus);target?.focus({preventScroll:true});}
  }
  for(const row of tabs.children){
    const id=row.dataset.openProperty,p=pwRec(id),active=id===PW.cur,name=(active?S.name:p?.name)||'Untitled Property';
    row.classList.toggle('on',active);row.title=name;
    const tab=row.querySelector('[role="tab"]');tab.id='basisPropertyTab-'+id;tab.textContent=name;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active||!allowed.has(PW.cur)&&id===ids[0]?0:-1;
    const close=row.querySelector('.pwx');close.setAttribute('aria-label','Close '+name);close.title='Close Tab';
  }
  const view=$('#basisModelView'),active=tabs.querySelector('[aria-selected="true"]');
  if(active)view.setAttribute('aria-labelledby',active.id);else view.removeAttribute('aria-labelledby');
  if(basisNavigation.propertyTab!==PW.cur){basisNavigation.propertyTab=PW.cur;basisKeepTabVisible(active);}
}
function basisContextDialog(opener){
  if(!PW.ix)return;
  const portfolio=el('select',{'aria-label':'Portfolio'},PW.ix.pfs.map(p=>el('option',{value:p.id,text:p.name}))),scenario=el('select',{'aria-label':'Scenario'});
  portfolio.value=PW.pf;
  const fill=()=>{const pf=pwPf(portfolio.value);scenario.replaceChildren(...(pf?.scs||[]).map(s=>el('option',{value:s.id,text:s.name})));
    const remembered=portfolio.value===PW.pf?PW.sc:PW.local.scOf?.[portfolio.value];if(pf?.scs.some(s=>s.id===remembered))scenario.value=remembered;};
  portfolio.onchange=fill;fill();
  const error=el('p',{class:'note err',role:'alert',hidden:true});
  const dialog=el('dialog',{class:'tenant-group-dialog basis-context-dialog','aria-label':'Change Portfolio or Scenario'},[
    el('h2',{text:'Portfolio and Scenario'}),el('p',{class:'hint',text:'The property picker only shows properties in this selection.'}),
    el('label',{class:'basis-context-field'},[el('span',{text:'Portfolio'}),portfolio]),el('label',{class:'basis-context-field'},[el('span',{text:'Scenario'}),scenario]),error]);
  dialog.append(el('div',{class:'bar'},[el('button',{class:'btn',text:'Cancel',onclick:()=>dialog.close()}),el('button',{class:'btn p',text:'Use Selection',onclick:()=>{
    if(!pwSc(portfolio.value,scenario.value)){error.textContent='This scenario is no longer available. Close and reopen the selection.';error.hidden=false;return;}
    const changed=PW.pf!==portfolio.value||PW.sc!==scenario.value;
    dialog.close();
    if(changed){PW.pf=PW.local.pf=portfolio.value;PW.sc=PW.local.sc=scenario.value;(PW.local.scOf=PW.local.scOf||{})[PW.pf]=PW.sc;
      PW.sel.clear();pwLocalSave();drawPane();pwOpenMatch();}
  }})]));
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  dialog.addEventListener('close',()=>{dialog.remove();if(opener.isConnected)opener.focus({preventScroll:true});},{once:true});
  document.body.append(dialog);dialog.showModal();portfolio.focus();
}
/* END BASIS NAVIGATION UI */
