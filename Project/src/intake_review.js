/* BEGIN BASIS INTAKE REVIEW */
const BASIS_REVIEW_GROUPS={
  rent:['rent','rentBasis','step','sched'],rec:['rec','baseYear','recAmt','recInfl'],
  end:['end','termMode'],abatement:['free','freeStart','freeBasis','freePct','freeType'],
  deposit:['sdOn','sdBasis','sdAmt'],improvements:['tiBasis','tiAmt'],commissions:['lcBasis','lcAmt'],
  option:['optTermYears','optTermMonths','optRentBasis','optRentAmt'],termination:['breakDate','breakFee','breakFeeBasis','breakOn'],
  percentage:['prOn','prRate','prSales','prSalesBasis','prBreakType','prBreak']
};
const BASIS_REVIEW_LABELS={name:'Tenant Name',suite:'Suite',sf:'Area (SF)',start:'Commencement',end:'Expiry',termMode:'Expiry Entry',rent:'Rent Terms',rentBasis:'Rent Unit',step:'Annual Step',sched:'Rent Schedule',rec:'Recoveries',mla:'Leasing Profile',ltype:'Lease Type',abatement:'Free Rent Terms',free:'Free Rent (Months)',freeStart:'Starts in Lease Month',freeBasis:'Free Rent From',freePct:'Share Abated (0.5 = 50%)',freeType:'Abatement Scope',note:'Notes',deposit:'Deposit',improvements:'Improvements',commissions:'Commissions',option:'Renewal Option',termination:'Termination Right',percentage:'Percentage Rent'};
const basisReviewClone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
function basisReviewGroups(before,proposed){
  const keys=[...new Set([...Object.keys(before),...Object.keys(proposed)])].filter(key=>key!=='id'&&JSON.stringify(before[key])!==JSON.stringify(proposed[key]));
  const seen=new Set();return keys.map(key=>Object.keys(BASIS_REVIEW_GROUPS).find(group=>BASIS_REVIEW_GROUPS[group].includes(key))||key).filter(key=>!seen.has(key)&&seen.add(key));
}
function basisReviewValue(key,value){
  if(key==='freePct'&&!(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1))throw Error('Use an abated share from 0 to 1.');
  if(['name','suite','start','end','note','rentBasis','ltype','mla','rec','baseYear','recInfl','termMode','freeBasis','freeType'].includes(key)){
    if(typeof value!=='string'||value.length>20000)throw Error('Enter valid text for '+key+'.');
    if(['start','end','baseYear'].includes(key)&&value&&!/^\d{4}-\d{2}(?:-\d{2})?$/.test(value))throw Error('Use YYYY-MM or YYYY-MM-DD for '+key+'.');
    if(['start','end','baseYear'].includes(key)&&value&&!parseMDY(value.length===7?value+'-01':value))throw Error('Enter a valid calendar date for '+key+'.');
    if(key==='name'&&!value.trim())throw Error('Tenant Name cannot be blank.');
    if(key==='rentBasis'&&!['psfyr','psfmo','yramt','moamt'].includes(value))throw Error('Choose a supported rent unit.');
    if(key==='termMode'&&!['date','term'].includes(value))throw Error('Choose Date or Existing Term Length.');
    if(key==='freeType'&&!['base','gross'].includes(value))throw Error('Choose Base Rent or Base Rent and Recoveries.');
    if(key==='freeBasis'&&!['months','market'].includes(value))throw Error('Choose Entered Months or Market Free Rent.');
  }else if(key==='sched'){
    if(!Array.isArray(value)||value.length>1000)throw Error('Rent Schedule must be an array with no more than 1,000 entries.');
    for(const row of value)if(!row||typeof row!=='object'||!Number.isFinite(row.amt)||!['psfyr','psfmo','yramt','moamt','pct','pctmkt'].includes(row.basis)||!row.date||!parseMDY(row.date.length===7?row.date+'-01':row.date))throw Error('Each schedule entry needs a valid date, numeric amount and rent unit.');
  }else if(typeof value==='number'){
    if(!Number.isFinite(value)||Math.abs(value)>1e15||['sf','rent','free','step'].includes(key)&&value<0)throw Error('Enter a valid nonnegative value for '+key+'.');
    if(key==='freePct'&&(value<0||value>1))throw Error('Use an abated share from 0 to 1.');
    if(['free','freeStart'].includes(key)&&(!Number.isInteger(value)||value<(key==='freeStart'?1:0)||value>1200))throw Error('Use a whole lease month from '+(key==='freeStart'?1:0)+' to 1200.');
  }else if(typeof value!=='boolean'&&value!==null)throw Error('Unsupported correction for '+key+'.');
  return value;
}
function basisMapReviewedTenant(tenant,record,key,review,log,notes){
  const before=basisReviewClone(tenant),{$target,...decisions}=review?.[key]||{},input=basisReviewClone(record),recs=new Set(S.recs.map(r=>r.id));
  for(const decision of Object.values(decisions))if(decision.mode==='edit'&&Object.keys(decision.invalid||{}).length)throw Error('Correct the highlighted review field before applying.');
  const area=decisions.sf;
  if(area?.mode==='keep')input.sf=null;
  if(area?.mode==='edit'&&Object.hasOwn(area.values||{},'sf')){tenant.sf=basisReviewValue('sf',area.values.sf);input.sf=null;}
  // Date-dependent proposals must use the same reviewed dates that Apply saves.
  for(const field of ['start','end']){const decision=decisions[field];
    if(decision?.mode==='keep')input[field]=null;
    else if(decision?.mode==='edit'&&Object.hasOwn(decision.values||{},field))input[field]=tenant[field]=basisReviewValue(field,decision.values[field]);
  }
  const inputs={rec:'rec',deposit:'sd',improvements:'ti',commissions:'lc',option:'opts',termination:'term',percentage:'pr',abatement:'free',free:'free',note:'other'};
  for(const [group,source] of Object.entries(inputs))if(decisions[group]?.mode==='keep')input[source]=source==='opts'?[]:null;
  const generated=[],mapped=intMapTenant(tenant,input,(...args)=>generated.push(args),notes),blocked=[];
  for(const [group,message]of Object.entries(mapped.amendmentBlocked||{})){const d=decisions[group];if(d?.mode==='keep'||d?.mode==='edit'&&(group==='rent'?Object.hasOwn(d.values||{},'sched'):typeof d.values?.rec==='string'&&recs.has(d.values.rec)))continue;blocked.push(message+' Choose Keep Current Value or enter a complete correction for '+(group==='rent'?'Rent Terms':'Recoveries')+'.');}
  const proposed=basisReviewClone(tenant);if(record.sf>0)proposed.sf=record.sf;
  for(const [group,decision] of Object.entries(decisions)){
    if(!BASIS_REVIEW_GROUPS[group]&&!Object.hasOwn(before,group)&&!Object.hasOwn(proposed,group))throw Error('Unsupported review field.');
    const fields=BASIS_REVIEW_GROUPS[group]||[group];
    if(fields.some(field=>['__proto__','constructor','prototype','id'].includes(field)))throw Error('Unsupported review field.');
    if(decision.mode==='keep')for(const field of fields){if(before[field]===undefined)delete tenant[field];else tenant[field]=basisReviewClone(before[field]);}
    else if(decision.mode==='edit'){
      for(const [field,value] of Object.entries(decision.values||{})){
        if(!fields.includes(field))throw Error('Correction does not match its field.');
        tenant[field]=basisReviewClone(basisReviewValue(field,value));
      }
      if(group==='rent'&&(Object.hasOwn(decision.values,'rent')||Object.hasOwn(decision.values,'rentBasis'))&&(tenant.sched||[]).length&&!Object.hasOwn(decision.values,'sched'))
        throw Error('The rent schedule controls the payable rent. Correct the Rent Schedule too, or enter [] to use the corrected base rent.');
    }else if(decision.mode!=='accept')throw Error('Unsupported review decision.');
  }
  // Discard only recovery structures just created for a rejected proposal.
  if(decisions.rec?.mode==='keep')S.recs=S.recs.filter(r=>recs.has(r.id)||r.id===tenant.rec||S.tenants.some(t=>t!==tenant&&t.rec===r.id));
  if(!Object.keys(decisions).length)for(const args of generated)log(...args);
  else for(const field of new Set([...Object.keys(before),...Object.keys(tenant)]))if(field!=='id'&&JSON.stringify(before[field])!==JSON.stringify(tenant[field])){
    const group=Object.keys(BASIS_REVIEW_GROUPS).find(g=>BASIS_REVIEW_GROUPS[g].includes(field))||field,edited=decisions[group]?.mode==='edit';
    log(tenant.name+' · '+field,(edited?'Manual correction: ':'')+basisReviewDisplay(tenant[field],field,tenant,S),basisIntakeFieldSources(mapped,field));
  }
  return {key,before,proposed,blocked,amendmentNotes:mapped.amendmentNotes||[],amendedGroups:[...(record.rentChanges?.length?['rent']:[]),...(record.recoveryChanges?.length?['rec']:[])],after:basisReviewClone(tenant),source:record.src,sources:record.srcs||[],fieldSources:mapped.fieldSources||{},annual:(()=>{const step=mapped.steps?.[0];return Number.isFinite(step?.psf)&&tenant.sf>0?step.psf*tenant.sf:step?.annual;})()};
}
function basisReviewDisplay(value,field,tenant,model){
  if(field==='rentBasis')return ({psfyr:'$/SF/Year',psfmo:'$/SF/Month',yramt:'$/Year',moamt:'$/Month'}[value]||(!value?'Default: $/SF/Year':String(value)));
  if(field==='termMode')return value==='term'?'Existing Term Length':'Explicit Date';
  if(field==='freeType')return value==='gross'?'Base Rent and Recoveries':'Base Rent';
  if(field==='freePct')return value==null||value===''?'100% (Default)':basisIntakeValue(value,'freePct');
  if(field==='freeBasis')return value==='market'?'Market Free Rent':'Entered Months';
  if(value===undefined)return '—';if(value===null)return 'Blank / Inherited';
  if(field==='rent')return basisFormatNumber(value,basisRentNumberFormat(tenant.rentBasis))+' '+({psfyr:'/SF/year',psfmo:'/SF/month',yramt:'/year',moamt:'/month'}[tenant.rentBasis||'psfyr']||tenant.rentBasis);
  if(field==='sf')return basisFormatNumber(value,'sf')+' SF';
  if(field==='rec'||field==='mla')return model[field==='rec'?'recs':'mlas']?.find(r=>r.id===value)?.name||String(value);
  if(typeof value==='object')return JSON.stringify(value,null,2);
  return basisIntakeValue(value,field);
}
function basisReviewEditControl(field,value,group,update,invalid,onInvalid){
  const change=node=>{let next=node.value;
    try{if(field==='sched')next=JSON.parse(next);else if(typeof value==='number'){next=basisParseNumber(next);if(!Number.isFinite(next))throw Error('Enter a complete number.');}else if(typeof value==='boolean')next=node.checked;
      basisValidateJSON(next);basisReviewValue(field,next);node.setCustomValidity('');node.removeAttribute('aria-invalid');update(field,next);
    }catch(error){node.setCustomValidity(error.message);node.setAttribute('aria-invalid','true');onInvalid(field,node.value,error.message);node.reportValidity();basisRefreshIntakeComparison();}};
  let control;
  if(field==='rentBasis'){control=el('select',{},['psfyr','psfmo','yramt','moamt'].map(v=>el('option',{value:v,text:{psfyr:'$/SF/Year',psfmo:'$/SF/Month',yramt:'$/Year',moamt:'$/Month'}[v]})));control.value=value;}
  else if(['termMode','freeBasis','freeType'].includes(field)){const values=field==='termMode'?['date','term']:field==='freeType'?['base','gross']:['months','market'];control=el('select',{},values.map(v=>el('option',{value:v,text:basisReviewDisplay(v,field,{},{})})));control.value=value||values[0];}
  else if(field==='sched')control=el('textarea',{rows:4,value:JSON.stringify(value||[],null,2),spellcheck:'false'});
  else if(['rec','mla','recInfl'].includes(field)){control=el('select',{},(S[field==='rec'?'recs':field==='mla'?'mlas':'infl']||[]).map(r=>el('option',{value:r.id,text:r.name})));if(field==='rec'&&![...control.options].some(option=>option.value===value)){control.prepend(el('option',{value:'__proposal__',text:'Proposed Recovery Structure'}));control.value='__proposal__';}else control.value=value;}
  else control=el('input',{type:typeof value==='boolean'?'checkbox':'text',value:typeof value==='boolean'?'':value??'',inputmode:typeof value==='number'?'decimal':null});
  if(typeof value==='boolean')control.checked=value;
  if(invalid){control.value=invalid.raw;control.setCustomValidity(invalid.message);control.setAttribute('aria-invalid','true');}
  if(control.matches('input[type=text],textarea'))control.maxLength=20000;
  control.setAttribute('aria-label','Correct '+(field==='rent'?'Base Rent':BASIS_REVIEW_LABELS[field]||field));control.onchange=()=>{if(field==='rec'&&control.value==='__proposal__')update(field,undefined);else change(control);};
  return control;
}
function basisTenantFieldReview(){
  const host=el('section',{class:'basis-tenant-field-review','aria-label':'Review Tenant Fields'});
  host.append(el('h4',{text:'Review Tenant Fields'}),el('p',{class:'hint',text:'Keep an existing value or correct a proposal before applying. Rent amount, unit, escalation and schedule are accepted together so their meanings stay consistent. Source quotes are evidence to review, not verification.'}));
  if(!INT.x||!INT.target)return host;
  try{
    let prepared;try{prepared=intPrepareApply(JSON.parse(INT.target.json),INT.x,INT.pick,INT.mode,INT.review||{});}catch(error){
      // Keep correction controls available while an incomplete draft blocks Apply.
      const display=basisReviewClone(INT.review||{});for(const groups of Object.values(display))for(const [key,decision] of Object.entries(groups)){if(key==='$target')continue;delete decision.invalid;if(decision.mode==='edit'&&key!=='sf')decision.values={};}
      prepared=intPrepareApply(JSON.parse(INT.target.json),INT.x,INT.pick,INT.mode,display);
    }
    const checks=intChecks(INT.x,INT.docs),priority=key=>checks.some(c=>c.key==='t:'+key&&c.sev==='error')?0:checks.some(c=>c.key==='t:'+key&&c.sev==='warn')?1:2;
    const reviews=prepared.tenantReviews.sort((a,b)=>priority(a.key)-priority(b.key));
    for(const review of reviews){
      const {$target,...decisions}=INT.review?.[review.key]||{},groups=[...new Set([...basisReviewGroups(review.before,review.proposed),...(review.amendedGroups||[]),...Object.keys(decisions)])];
      const details=el('details',{'data-review-tenant':review.key,open:reviews.length===1||priority(review.key)<2}),content=el('div');
      details.append(el('summary',{text:review.after.name+' · '+groups.length+' Fields to Review'}));
      content.append(basisSourceCell(review.source));
      for(const text of review.amendmentNotes)content.append(el('p',{class:'note',text}));
      if(Number.isFinite(review.annual)&&review.after.sf>0)content.append(el('p',{class:'note',text:'Extracted rent: '+basisFormatNumber(review.annual,'money')+'/year ÷ '+basisFormatNumber(review.after.sf,'sf')+' SF = '+basisFormatNumber(review.annual/review.after.sf,'psf')+'/SF/year. '+(decisions.rent?.mode==='keep'?'Keeping the existing rent terms.':decisions.rent?.mode==='edit'?'Your corrected rent terms take precedence.':'Area reflects your review decision.')}));
      for(const group of groups){
        const decision=decisions[group]||{mode:'accept'},fields=(BASIS_REVIEW_GROUPS[group]||[group]).filter(f=>review.proposed[f]!==undefined||review.before[f]!==undefined||group==='rent'&&f==='sched'&&review.amendedGroups?.includes('rent')),label=BASIS_REVIEW_LABELS[group]||group;
        const select=el('select',{'aria-label':'Decision for '+label},[['accept','Accept Proposal'],['keep','Keep Current Value'],['edit','Correct Proposal']].map(([value,text])=>el('option',{value,text})));select.value=decision.mode;
        const fieldset=el('fieldset',{'data-review-field':group}),editor=el('div',{class:'basis-review-values'});
        fieldset.append(el('legend',{text:label}),select,editor,el('details',{},[el('summary',{text:'Source Evidence for '+label}),...basisIntakeFieldSources({src:review.source,fieldSources:review.fieldSources},group).map(basisSourceCell)]));
        const update=(field,value)=>{INT.review=INT.review||{};INT.review[review.key]=INT.review[review.key]||{};const current=INT.review[review.key][group]||{mode:'edit',values:{}};current.mode='edit';if(current.invalid)delete current.invalid[field];current.values={...current.values};if(value===undefined)delete current.values[field];else current.values[field]=value;INT.review[review.key][group]=current;basisRefreshIntakeComparison(field==='sf');};
        const render=()=>{editor.replaceChildren();for(const field of fields){const current=el('p',{class:'hint',text:'Current '+(field==='rent'?'Base Rent':BASIS_REVIEW_LABELS[field]||field)+': '+basisReviewDisplay(review.before[field],field,review.before,S)});
          const chosen=INT.review?.[review.key]?.[group],value=chosen?.values&&Object.hasOwn(chosen.values,field)?chosen.values[field]:review.proposed[field];
          editor.append(current,select.value==='edit'?fieldLabel(field,basisReviewEditControl(field,value,group,update,chosen?.invalid?.[field],(field,raw,message)=>{const current=INT.review[review.key][group];current.invalid={...current.invalid,[field]:{raw,message}};})):el('pre',{class:'basis-proposed-value',text:(select.value==='keep'?'Keeping: ':'Proposed: ')+basisReviewDisplay(select.value==='keep'?review.before[field]:value,field,select.value==='keep'?review.before:review.proposed,prepared.model)}));}
        };
        const fieldLabel=(field,node)=>field==='sched'?el('details',{},[el('summary',{text:'Correct Rent Schedule (JSON)'}),el('p',{class:'hint',text:'Each entry needs date, basis and amt. Use [] to remove the schedule and use base rent.'}),node]):el('label',{},[document.createTextNode(field==='rent'?'Base Rent':field==='step'?'Annual Step (0.03 = 3%)':BASIS_REVIEW_LABELS[field]||field),node]);
        select.onchange=()=>{INT.review=INT.review||{};INT.review[review.key]=INT.review[review.key]||{};INT.review[review.key][group]={mode:select.value,values:INT.review[review.key][group]?.values||{},invalid:INT.review[review.key][group]?.invalid||{}};render();basisRefreshIntakeComparison(group==='sf');};
        render();content.append(fieldset);
      }
      details.append(content);host.append(details);
    }
    if(!reviews.length)host.append(el('p',{class:'hint',text:'Select a tenant above to review its individual fields.'}));
  }catch(error){host.append(el('p',{class:'note err',text:error.message}));}
  return host;
}
function basisViewSource(source,opener){
  document.querySelector('.basis-source-viewer')?.close();
  const doc=basisIntakeSourceDocument(source,INT.docs),dialog=el('dialog',{class:'basis-source-viewer','aria-label':'Source Document','aria-modal':'false'}),body=el('div'),urls=[];
  const page=el('select',{'aria-label':'Source Page'},(doc?.pages||[]).map(p=>el('option',{value:String(p.n),text:p.label||'Page '+p.n})));page.value=String(source?.page||doc?.pages?.[0]?.n||'');
  if(!page.value&&doc?.pages?.length)page.value=String(doc.pages[0].n);
  const render=()=>{for(const url of urls)URL.revokeObjectURL(url);urls.length=0;body.replaceChildren();const text=doc?.pages.find(p=>String(p.n)===page.value)?.text,scan=doc?.images?.find(p=>String(p.n)===page.value);
    if(text)body.append(el('pre',{text}));if(scan?.blob instanceof Blob){const url=URL.createObjectURL(scan.blob);urls.push(url);body.append(el('img',{src:url,alt:'Source page '+page.value}));}
    if(!text&&!scan?.blob)body.append(el('p',{class:'note',text:'This source page is not available in the uploaded content. Check the original document before accepting the proposal.'}));};
  page.onchange=render;dialog.append(el('div',{class:'bar'},[el('h2',{text:doc?.name||source?.doc||'Source Document'}),el('button',{class:'btn',text:'Close Source',onclick:()=>dialog.close()})]),source?.quote?el('blockquote',{text:source.quote}):null,page,el('p',{class:'hint',text:'Uploaded page text or scanned image. Text extraction may change layout; compare with the original file where needed.'}),body);
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();dialog.close();}event.stopPropagation();});dialog.addEventListener('close',()=>{for(const url of urls)URL.revokeObjectURL(url);dialog.remove();if(!document.querySelector('.basis-source-viewer[open]'))document.body.classList.remove('basis-source-open');if(opener?.isConnected)opener.focus();},{once:true});
  document.body.append(dialog);document.body.classList.add('basis-source-open');dialog.show();render();opener?.scrollIntoView({block:'nearest'});dialog.querySelector('button').focus({preventScroll:true});
}
function basisAfterTaskImport(prepared,origin){
  if(!origin||origin.context!==basisWorkspaceKey())return;
  const expenses=origin.kind==='expenses',key=expenses?'expenses.op':'tenants.rr';
  basisAppliedNotice={context:basisWorkspaceKey(),key,ids:expenses?prepared.expenseIds:prepared.tenantReviews.map(r=>r.after.id),text:'Applied reviewed inputs: '+(expenses?prepared.applied.cnt.eNew+' new and '+prepared.applied.cnt.eUpd+' updated expenses.':prepared.applied.cnt.tNew+' new and '+prepared.applied.cnt.tUpd+' updated tenants.')+' Highlighted rows contain the applied inputs. Review Model Checks next.'};
  basisImportOrigin=null;setMode('inputs');go(...key.split('.'));
}
/* END BASIS INTAKE REVIEW */
