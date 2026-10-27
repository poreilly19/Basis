/* BEGIN BASIS INTAKE AMENDMENTS */
function basisAmendmentDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value.trim()))return null;
  const date=value.trim(),time=Date.parse(date+'T00:00:00Z');
  return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===date?date:null;
}
function basisAmendmentCandidates(candidates,field){
  const priority=c=>field==='sf'?c.priSF:c.pri,groups=new Map();
  for(const candidate of candidates){const rank=priority(candidate);if(!groups.has(rank))groups.set(rank,[]);groups.get(rank).push(candidate);}
  // Use dates only where every equally ranked statement has a known amendment
  // execution date. Pairwise date/confidence fallback would be non-transitive.
  const dated=new Set([...groups].filter(([,items])=>items.every(c=>c.src?.docType==='amendment'&&c.amendmentDate)).map(([rank])=>rank));
  return [...candidates].sort((a,b)=>priority(b)-priority(a)||(dated.has(priority(a))?b.amendmentDate.localeCompare(a.amendmentDate):0)||b.conf-a.conf);
}
function basisAmendmentSignature(value){
  if(Array.isArray(value))return value.map(basisAmendmentSignature);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,basisAmendmentSignature(value[key])]));
  return value;
}
const basisAmendmentCopy=value=>JSON.parse(JSON.stringify(value));
const basisModelSource=()=>({doc:'Current Model',docId:'',page:'',quote:'',evidence:'model'});
function basisAmendmentSources(sources){return [...new Map(sources.flat(Infinity).filter(Boolean).map(source=>[JSON.stringify(source),source])).values()];}
function basisAmendmentPlans(candidates,kind){
  const plans=[],signatures=new Map();
  for(const candidate of candidates||[]){
    const change=candidate[kind==='rent'?'rentChange':'recoveryChange']||{},date=basisAmendmentDate(change.effectiveDate);
    const modes=kind==='rent'?['replace_from','listed_steps','complete']:['patch','replace'];
    if(!modes.includes(change.mode)||!date)throw Error((kind==='rent'?'Rent':'Recovery')+' amendment needs an explicit treatment and valid effective date.');
    if(kind==='rent'&&(candidate.rentIssues?.length||!candidate.steps?.length))throw Error('Rent amendment has unsupported or missing rent steps.');
    const value=kind==='rent'?candidate.steps.map(({from,unit,amount,annual,psf})=>({from,unit,amount,annual,psf})):candidate.rec;
    const signature=JSON.stringify(basisAmendmentSignature({date,amendmentDate:candidate.amendmentDate,mode:change.mode,value,esc:kind==='rent'?candidate.esc:null}));
    const source=basisAmendmentSources([candidate.fieldSources?.[kind==='rent'?'steps':'rec']||candidate.src,candidate.fieldSources?.[kind==='rent'?'rentChange':'recoveryChange']]);
    if(signatures.has(signature)){signatures.get(signature).sources.push(...source);continue;}
    const plan={candidate,date,mode:change.mode,sources:source};plans.push(plan);signatures.set(signature,plan);
  }
  if(plans.length>1){
    const dates=plans.map(p=>p.candidate.amendmentDate);
    if(dates.some(d=>!d)||new Set(dates).size!==dates.length)throw Error('Several different '+kind+' amendments lack distinct execution dates. Confirm their order or enter a complete correction.');
    plans.sort((a,b)=>a.candidate.amendmentDate.localeCompare(b.candidate.amendmentDate));
  }
  return plans;
}
function basisAmendmentIssues(record){
  const issues=[];for(const [kind,changes]of [['rent',record.rentChanges],['recovery',record.recoveryChanges]]){
    try{basisAmendmentPlans(changes,kind);}catch(error){issues.push(error.message);}
  }
  return issues;
}
function basisAmendmentStep(from,amount,unit,src){
  const normalized=basisIntakeRent({rent:[{from,amount,unit}]}),step=normalized.steps[0];
  if(!step||normalized.rentIssues.length)throw Error('The earlier rent schedule contains unsupported amounts, dates or units.');
  return {...step,src};
}
function basisAmendmentModelRent(tenant,record,cutoff){
  if(!record.modelBaseline)throw Error('Earlier rent is missing. Upload the base lease or enter a complete rent schedule.');
  if(tenant.cpi||(tenant.areaSched||[]).length)throw Error('The existing lease uses CPI or changing area. Review its rent schedule manually before combining amendments.');
  const start=basisAmendmentDate(iD(tenant.start));if(!start)throw Error('A confirmed lease commencement is needed to retain earlier rent.');
  const unit={psfyr:'psf_year',psfmo:'psf_month',yramt:'annual',moamt:'monthly'}[tenant.rentBasis||'psfyr'];
  if(!unit)throw Error('The existing rent basis needs a manual amendment review.');
  const first=basisAmendmentStep(start,tenant.rent,unit,basisModelSource()),rows=[first],schedule=tenant.sched||[];
  if(schedule.length){
    const scheduled=[];for(const row of schedule){
      if(row.type&&row.type!=='base'||row.mode&&row.mode!=='date'||row.units&&row.basis&&row.units!==row.basis)throw Error('Relative, additive or reviewed rent steps need a manual amendment review.');
      const u={psfyr:'psf_year',psfmo:'psf_month',yramt:'annual',moamt:'monthly'}[row.units||row.basis||'psfyr'];
      if(!u||!basisAmendmentDate(row.date))throw Error('The existing rent schedule needs absolute dated steps before combining amendments.');
      scheduled.push(basisAmendmentStep(row.date,row.amt,u,basisModelSource()));
    }
    // The engine uses flat base only until its first scheduled base begins.
    if(!scheduled.some(row=>row.from<=start))scheduled.unshift(first);
    return [...new Map(scheduled.sort((a,b)=>a.from.localeCompare(b.from)).map(row=>[row.from,row])).values()];
  }
  return basisAmendmentExpand(rows,{type:'pct',value:tenant.step||0},start,cutoff);
}
function basisAmendmentExpand(rows,escalation,start,cutoff){
  if(rows.length!==1||!escalation||escalation.type==='none')return rows;
  const type=escalation.type,value=type==='pct'?iP(escalation.value):basisIntakeNumber(escalation.value);
  if(!['pct','fixed_psf'].includes(type)||value===null||value<0||value>100)throw Error('The earlier escalation rule needs a manual rent-schedule review.');
  if(!value)return rows;
  if(rows[0].from!==start)throw Error('The escalation anchor is unclear; confirm the complete earlier rent schedule.');
  if(type==='fixed_psf'&&!Number.isFinite(rows[0].psf))throw Error('The fixed per-SF escalation needs a per-SF starting rent before combining amendments.');
  const result=[...rows],first=rows[0],origin=sSer(start);
  for(let year=1;year<80;year++){
    const from=serISO(addMo(origin,year*12));if(cutoff&&from>=cutoff)break;
    const step=type==='pct'?{...first,from,annual:first.annual===null?null:first.annual*Math.pow(1+value,year),psf:first.psf===null?null:first.psf*Math.pow(1+value,year)}:
      {...first,from,annual:null,psf:first.psf+year*value};
    if([step.annual,step.psf].some(v=>v!==null&&(!Number.isFinite(v)||v>1e15)))throw Error('An earlier escalation exceeds the supported amount range.');result.push(step);
  }
  if(cutoff&&cutoff>serISO(addMo(origin,80*12)))throw Error('The earlier escalation exceeds the supported schedule horizon.');
  return result;
}
function basisComposeAmendedRent(tenant,record){
  if(tenant.cpi||(tenant.areaSched||[]).length||record.esc?.type==='cpi')throw Error('CPI or changing-area rent requires manual amendment review, including when a base lease is uploaded.');
  const plans=basisAmendmentPlans(record.rentChanges,'rent'),start=basisAmendmentDate(iD(tenant.start));
  if(!start)throw Error('A confirmed lease commencement is required for rent amendments.');
  let rows=(record.steps||[]).map(row=>({...row,from:row.from||start,src:record.fieldSources?.steps||record.src}));
  const firstPlan=plans[0];
  if(firstPlan.mode!=='complete'){
    if(!rows.length){
      if(firstPlan.mode==='listed_steps'&&!(tenant.sched||[]).length&&num(tenant.step))throw Error('Listed-step changes cannot infer how the current annual escalation should continue. Enter a complete schedule.');
      rows=basisAmendmentModelRent(tenant,record,firstPlan.mode==='replace_from'?firstPlan.date:null);
    }
    else{
      if(rows[0].from>start){const old=basisAmendmentModelRent(tenant,record,rows[0].from);rows=[...old.filter(row=>row.from<rows[0].from),...rows];}
      if(firstPlan.mode==='listed_steps'&&record.esc&&record.esc.type!=='none'&&iN(record.esc.value))throw Error('Listed-step changes cannot infer how an ongoing escalation rule should continue. Enter a complete schedule.');
      rows=basisAmendmentExpand(rows,record.esc,start,firstPlan.mode==='replace_from'?firstPlan.date:null);
    }
  }
  const notices=[];let escalation=null;
  for(const plan of plans){
    const added=plan.candidate.steps.map(step=>({...step,src:plan.sources}));
    if(added.some(step=>!basisAmendmentDate(step.from)))throw Error('Each amended rent step needs its own explicit date.');
    if(plan.mode==='complete'){
      if(added[0].from>start||plan.date>start)throw Error('A complete replacement must establish rent from lease commencement.');
      rows=added;
    }else{
      if(added[0].from!==plan.date||added.some(step=>step.from<plan.date)||plan.date<start)throw Error('The first amended rent step must match its effective date and cannot precede commencement.');
      if(!rows.some(step=>step.from<=start))throw Error('Earlier rent is not established from commencement. Enter a complete schedule.');
      rows=plan.mode==='replace_from'?rows.filter(step=>step.from<plan.date):rows.filter(step=>!added.some(next=>next.from===step.from));
      rows.push(...added);
    }
    const rule=plan.candidate.esc;
    if(rule&&rule.type!=='none'&&iN(rule.value))throw Error('An amendment with a continuing escalation rule needs explicit dated steps before combining schedules.');
    rows.sort((a,b)=>a.from.localeCompare(b.from));escalation={type:'none',value:0};
    notices.push((plan.mode==='replace_from'?'Replace rent from ':plan.mode==='listed_steps'?'Change only listed rent steps from ':'Use a complete rent schedule from ')+plan.date+' · '+plan.candidate.src.doc+'.');
  }
  if(rows.length>1000)throw Error('The combined rent schedule exceeds 1,000 steps.');
  const sources=basisAmendmentSources([...plans].reverse().flatMap(plan=>plan.sources).concat(rows.flatMap(row=>row.src||[])));
  return {steps:rows.map(row=>({...row,annual:Number.isFinite(row.psf)&&tenant.sf>0?row.psf*tenant.sf:row.annual})),esc:escalation,sources,notices};
}
function basisAmendmentModelRecovery(tenant,record){
  if(!record.modelBaseline)throw Error('A recovery patch needs a base lease clause or an existing recovery structure.');
  const rec=S.recs.find(item=>item.id===tenant.rec);
  const allowed=new Set(['id','name','method','denom','adminFee','grossUp','fixed','pool','capPct','capType','stopAmt']);
  if(!rec||rec.lines||rec.pool||rec.denom&&rec.denom!=='rentable'||Object.keys(rec).some(k=>!allowed.has(k)&&rec[k]!==null&&rec[k]!==''&&rec[k]!==undefined))throw Error('The current recovery structure has custom pools, lines or rules. Review the amendment manually.');
  const type={NNN:'nnn',GROSS:'full_service',STOP:'base_year',STOPPSF:'expense_stop',STOPAMT:'expense_stop',FIXED:'fixed',FIXEDAMT:'fixed'}[rec.method];
  if(!type)throw Error('The current recovery method needs a manual amendment review.');
  const value={type,adminFeePct:rec.adminFee??0,grossUpPct:rec.grossUp??1,capPct:rec.capPct??0,capCumulative:rec.capType!=='noncum'};
  if(rec.method==='STOP')value.baseYear=tenant.baseYear;
  if(rec.method==='STOPPSF')value.stopPSF=rec.stopAmt;if(rec.method==='STOPAMT')value.stopAmount=rec.stopAmt;
  if(rec.method==='FIXED')value.fixedPSF=rec.fixed;if(rec.method==='FIXEDAMT')value.fixedAmount=rec.fixed;
  return value;
}
function basisCheckAmendedRecovery(value){
  if(!['nnn','base_year','expense_stop','modified_gross','full_service','fixed','none'].includes(value.type))throw Error('A supported recovery type is required.');
  if(value.type==='base_year'&&!/^\d{4}$/.test(String(value.baseYear||'')))throw Error('The base year is missing or invalid.');
  const amount=key=>value[key]!==undefined&&value[key]!==null&&basisIntakeNumber(value[key])!==null&&basisIntakeNumber(value[key])>=0;
  if(value.type==='expense_stop'&&!amount('stopPSF')&&!amount('stopAmount'))throw Error('The expense-stop amount is missing or invalid.');
  if(value.type==='fixed'&&!amount('fixedPSF')&&!amount('fixedAmount'))throw Error('The fixed recovery amount is missing or invalid.');
  for(const key of ['adminFeePct','grossUpPct','capPct','proRataShare'])if(value[key]!=null){const n=basisIntakeNumber(value[key]);if(n===null||n<0||n>1)throw Error('The recovery '+key+' must be a decimal from 0 to 1.');}
  if(value.capCumulative!=null&&typeof value.capCumulative!=='boolean')throw Error('The recovery cap treatment must be explicit.');
  if(value.type==='expense_stop'&&amount('stopPSF')&&amount('stopAmount')||value.type==='fixed'&&amount('fixedPSF')&&amount('fixedAmount'))throw Error('The recovery clause contains conflicting amount units.');
}
function basisComposeAmendedRecovery(tenant,record){
  const plans=basisAmendmentPlans(record.recoveryChanges,'recovery'),analysis=record.analysisStart||mKey(S.startYear,S.startMonth)+'-01';
  let value=record.rec?basisAmendmentCopy(record.rec):null,sources=value?[record.fieldSources?.rec||record.src]:[],notices=[];
  for(const plan of plans){
    if(plan.date>analysis)throw Error('Recovery amendment starts '+plan.date+', after the analysis begins. This model cannot date a change to one lease’s recovery structure; keep current recoveries or model the change separately.');
    const supplied=Object.fromEntries(Object.entries(plan.candidate.rec).filter(([,v])=>v!==null&&v!==undefined&&v!==''));
    if(plan.mode==='patch'){
      if(!value){value=basisAmendmentModelRecovery(tenant,record);sources.push(basisModelSource());}
      if(supplied.type&&supplied.type!==value.type)throw Error('A recovery patch changes the method; a complete supported replacement clause is required.');
      value={...value,...supplied};
    }else value=supplied;
    basisCheckAmendedRecovery(value);sources.unshift(...plan.sources);
    notices.push((plan.mode==='patch'?'Retain unchanged recovery terms and amend the listed fields':'Replace the recovery clause')+' · effective '+plan.date+' · '+plan.candidate.src.doc+'.');
  }
  return {value,sources:basisAmendmentSources(sources),notices};
}
function basisApplyAmendments(tenant,record,notes){
  record.amendmentBlocked={};record.amendmentNotes=[];
  for(const [kind,changes]of [['rent',record.rentChanges],['rec',record.recoveryChanges]]){
    if(!changes?.length)continue;
    try{
      if(kind==='rent'){
        const result=basisComposeAmendedRent(tenant,record);record.steps=result.steps;record.esc=result.esc;record.rentIssues=[];
        record.fieldSources={...record.fieldSources,steps:result.sources,esc:result.sources};record.amendmentNotes.push(...result.notices);
      }else{
        const result=basisComposeAmendedRecovery(tenant,record);record.rec=result.value;record.fieldSources={...record.fieldSources,rec:result.sources};record.amendmentNotes.push(...result.notices);
      }
    }catch(error){
      const message=tenant.name+': '+(kind==='rent'?'rent':'recovery')+' amendment was not applied. '+error.message;
      record.amendmentBlocked[kind]=message;record.amendmentNotes.push(message);notes.push(message);
      if(kind==='rent'){record.steps=[];record.esc=null;}else record.rec=null;
      record.fieldSources={...record.fieldSources,[kind==='rent'?'steps':'rec']:basisAmendmentSources(changes.flatMap(change=>change.fieldSources?.[kind==='rent'?'steps':'rec']||change.src))};
    }
  }
}
function basisRequireAmendments(prepared){if(prepared.blocked?.length)throw Error(prepared.blocked.join(' '));}
/* END BASIS INTAKE AMENDMENTS */
