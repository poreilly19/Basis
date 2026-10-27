/* BEGIN BASIS INTAKE QUALITY */
// Local evidence checks establish where a quote occurs, not whether a proposed
// financial interpretation is correct. Never trust a provider-supplied file ID.
function basisIntakeSource(doc,docType,citation){
  const raw=typeof citation?.quote==='string'?citation.quote:'',quote=raw.slice(0,240);
  const pageNumber=typeof citation?.page==='number'?citation.page:/^\d+$/.test(String(citation?.page||''))?Number(citation.page):null;
  const page=Number.isSafeInteger(pageNumber)&&pageNumber>0?pageNumber:'';
  const local=(doc.pages||[]).find(p=>String(p.n)===String(page));
  const normalize=text=>String(text||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
  let evidence='missing';
  if(page&&!local)evidence='invalid_page';
  else if(local?.hidden||local?.off)evidence='excluded';
  else if(local){
    if(!raw.trim())evidence='missing';
    else if(normalize(raw).length<8)evidence='short_quote';
    else if(normalize(local.text))evidence=raw.length<=2000&&normalize(local.text).includes(normalize(raw))?'matched':'not_found';
    else evidence=(doc.images||[]).some(p=>String(p.n)===String(page))?'image':'unavailable';
  }
  return {doc:String(doc.name||''),docId:typeof doc.id==='string'?doc.id:'',docType,page,quote,evidence};
}
const BASIS_EVIDENCE_LABELS={model:'Retained from the current model; no uploaded clause is attached.',matched:'Quote found in uploaded page text; verify its meaning.',not_found:'Quote not found on this page. Compare with the original.',invalid_page:'Cited page is not in this upload.',excluded:'Cited page was excluded from extraction.',image:'Scanned page: check the quote against the image.',missing:'Page and exact quote needed for verification.',short_quote:'Quote is too short to check reliably.',unavailable:'Page text is unavailable; check the original.'};
function basisIntakeSourceDocument(source,docs){
  if(source?.docId)return docs.find(d=>d.id===source.docId)||null;
  const matches=docs.filter(d=>d.name===source?.doc||d.id===source?.doc);
  return matches.length===1?matches[0]:null;
}
const BASIS_INTAKE_SOURCE_KEYS={name:'name',suite:'suite',sf:'sf',start:'start',end:'end',steps:'rent',esc:'escalation',free:'freeRent',rec:'recovery',sd:'securityDeposit',ti:'ti',lc:'lc',opts:'renewalOptions',term:'termination',pr:'percentageRent',other:'other',leaseType:'leaseType',status:'status',rentChange:'rentChange',recoveryChange:'recoveryChange'};
function basisIntakeTenantSources(doc,docType,tenant){
  const sources={};
  for(const [key,field]of Object.entries(BASIS_INTAKE_SOURCE_KEYS)){
    const exact=tenant.fieldSources?.[field];sources[key]={...basisIntakeSource(doc,docType,exact||tenant.src),scope:exact?'field':'tenant'};
  }
  return sources;
}
function basisIntakeFieldSources(record,field){
  const map={rent:['steps','esc'],rentBasis:['steps'],step:['esc'],sched:['steps','esc'],ltype:['leaseType'],mla:['leaseType'],termMode:['end'],
    abatement:['free'],free:['free'],freeStart:['free'],freeBasis:['free'],freePct:['free'],freeType:['free'],rec:['rec'],baseYear:['rec'],recAmt:['rec'],recInfl:['rec'],
    deposit:['sd'],improvements:['ti'],commissions:['lc'],option:['opts'],termination:['term'],percentage:['pr'],note:['other']};
  const mapped=map[field]||(/^sd/.test(field)?['sd']:/^ti/.test(field)?['ti']:/^lc/.test(field)?['lc']:/^opt/.test(field)?['opts']:/^break/.test(field)?['term']:/^pr/.test(field)?['pr']:[field]);
  const sources=mapped.flatMap(key=>record.fieldSources?.[key]||[]);
  return [...new Map((sources.length?sources:[record.src]).filter(Boolean).map(source=>[JSON.stringify(source),source])).values()];
}
function basisIntakeNumber(value){
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value!=='string')return null;
  const s=value.trim();
  // Accept currency formatting, but never a numeric prefix followed by a unit
  // or prose, incomplete grouping, mixed signs, Infinity, or a percent of rent.
  if(!/^\$?[-+]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(s))return null;
  const n=Number(s.replace(/[$,]/g,''));return Number.isFinite(n)?n:null;
}
function basisIntakeRent(tenant){
  const steps=[],rentIssues=[],sf=iN(tenant.sf);
  for(const row of iA(tenant.rent)){
    const amount=basisIntakeNumber(row?.amount),unit=String(row?.unit||'').trim().toLowerCase();
    if(!['annual','monthly','psf_year','psf_month'].includes(unit)){rentIssues.push('A rent amount has no supported annual, monthly, or per-SF unit.');continue;}
    if(amount===null||amount<0||amount>1e15){rentIssues.push('A rent amount is invalid or outside the supported range.');continue;}
    const from=iD(row?.from);
    if(row?.from&&(typeof row.from!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.from.trim())||!from||!/^\d{4}-\d{2}-\d{2}$/.test(from)||!Number.isFinite(Date.parse(from+'T00:00:00Z'))||new Date(from+'T00:00:00Z').toISOString().slice(0,10)!==from)){
      rentIssues.push('A rent step has an invalid calendar date.');continue;
    }
    const psf=unit==='psf_year'?amount:unit==='psf_month'?amount*12:null;
    const annual=psf!==null?(sf>0?psf*sf:null):unit==='monthly'?amount*12:amount;
    if(annual!==null&&(!Number.isFinite(annual)||annual>1e15)){rentIssues.push('Annualized rent exceeds the supported range.');continue;}
    steps.push({from,annual,psf,unit,amount});
  }
  if(steps.length>1&&steps.some(step=>!step.from))rentIssues.push('Every step in a multi-step rent schedule needs a supported start date.');
  const dates=new Map();for(const step of steps)if(step.from){const prior=dates.get(step.from);if(prior&&(prior.unit!==step.unit||prior.amount!==step.amount))rentIssues.push('Conflicting rent steps use the same start date.');dates.set(step.from,step);}
  return {steps:rentIssues.length?[]:steps.sort((a,b)=>String(a.from||'').localeCompare(String(b.from||''))),rentIssues:[...new Set(rentIssues)]};
}
function basisIntakeGroupTenants(candidates,warnings){
  const groups=[],vacant=c=>c.status==='vacant'||/^vacant/i.test(c.name);
  // Known suites first, so an unspecified suite cannot bridge two leases just
  // because the provider happened to return the unspecified document first.
  for(const candidate of [...candidates].sort((a,b)=>Number(!!iSuite(b.suite))-Number(!!iSuite(a.suite)))){
    const suite=iSuite(candidate.suite),name=iK(candidate.name);
    let possible=groups.filter(group=>group.c.some(other=>iK(other.name)===name&&vacant(other)===vacant(candidate)&&(!suite||iSuite(other.suite)===suite)));
    if(!suite){const unspecified=possible.filter(group=>group.c.every(other=>!iSuite(other.suite)));if(unspecified.length)possible=unspecified;}
    if(possible.length!==1){
      if(possible.length>1)warnings.push({doc:candidate.src.doc,text:candidate.name+': the suite is missing and several leases have this name. Kept as a separate proposal; choose its target or leave it unchecked.'});
      const group={key:uid(),c:[]};groups.push(group);possible=[group];
    }
    possible[0].c.push(candidate);
  }
  return groups;
}
function basisIntakeMatches(record,tenants){
  const suite=iSuite(record.suite),name=iK(record.name),exact=[],possible=[];
  for(const tenant of tenants){
    const ts=iSuite(tenant.suite),sameName=!!name&&name===iK(tenant.name),sameSuite=!!suite&&suite===ts;
    const placeholder=(/^vacant/i.test(tenant.name||'')||!tenant.name)&&!tenant.start;
    const compatible=!suite||!ts||sameSuite;
    if((sameName&&compatible||sameSuite&&placeholder)&&!(record.vacant&&!placeholder))exact.push(tenant);
    if(sameSuite||compatible&&iSim(tenant.name,record.name)>=0.6)possible.push(tenant);
  }
  const specific=exact.filter(t=>suite&&iSuite(t.suite)===suite),strong=specific.length?specific:exact;
  const match=strong.length===1?strong[0].id:null;
  return {match,matchCandidates:[...new Set([...strong,...possible].map(t=>t.id))],matchRequired:!match&&(strong.length>0||possible.length>0)};
}
function basisIntakeTargets(extraction,picks,mode,review,model){
  const targets={},used=new Set();
  for(const group of extraction.tenants){if(!picks['t:'+group.key])continue;
    if(mode==='replace'){targets[group.key]=null;continue;}
    const choice=review?.[group.key]?.$target;
    if(choice!==undefined&&(!choice||typeof choice!=='object'||Array.isArray(choice)||!(choice.id===null||typeof choice.id==='string')))throw Error('Choose a valid tenant in Apply To.');
    if(!choice&&group.r.matchRequired)throw Error(group.r.name+': choose an existing lease or Add New Tenant in Apply To.');
    const target=choice?choice.id:group.r.match||null;
    if(target!==null&&!model.tenants.some(t=>t.id===target))throw Error(group.r.name+': the selected tenant is no longer available. Review Apply To.');
    if(target!==null&&used.has(target))throw Error('Two selected proposals target the same existing lease. Select one proposal or choose separate tenants in Apply To.');
    targets[group.key]=target;if(target!==null)used.add(target);
  }
  return targets;
}
function basisIntakeTargetControl(group){
  const record=group.r,choice=INT.review?.[group.key]?.$target;
  const select=el('select',{'aria-label':'Apply To for '+record.name,'data-intake-target':group.key,title:'Changing the target resets this tenant’s field-review decisions.'},[
    el('option',{value:'',text:'Choose a Lease…'}),el('option',{value:'new',text:'Add New Tenant'}),
    ...(S.tenants||[]).map(t=>el('option',{value:'id:'+t.id,text:t.name+(t.suite?' · Suite '+t.suite:'')+(t.start?' · '+t.start:'')}))]);
  select.value=INT.mode==='replace'?'new':choice?(choice.id===null?'new':'id:'+choice.id):record.match?'id:'+record.match:record.matchRequired?'':'new';
  select.disabled=INT.mode==='replace'||INT.applying;
  if(!select.value)select.setAttribute('aria-invalid','true');
  select.onchange=()=>{INT.review=INT.review||{};INT.review[group.key]=select.value?{$target:{id:select.value==='new'?null:select.value.slice(3)}}:{};drawPane();};
  return select;
}
/* END BASIS INTAKE QUALITY */
