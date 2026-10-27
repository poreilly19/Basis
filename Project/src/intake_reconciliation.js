/* BEGIN BASIS INTAKE RECONCILIATION */
// These checks reconcile extracted numbers, not the accuracy of the AI reading.
// Never fill gaps with another upload's date, area, period, or reported totals.
function basisIntakeCalendarDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const ms=Date.parse(value+'T00:00:00Z');
  return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===value?value:null;
}
function basisStatementNumber(value){
  const negative=typeof value==='string'&&/^\(\$?[\d,.]+\)$/.test(value.trim());
  const number=basisIntakeNumber(negative?value.trim().slice(1,-1):value);
  return number!==null&&Math.abs(number)<=1e15?(negative?-number:number):null;
}
function basisStatementPeriod(raw){
  const r=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{},issues=[];
  const has=v=>v!==null&&v!==undefined&&v!=='';
  const start=basisIntakeCalendarDate(r.start),end=basisIntakeCalendarDate(r.end);
  let months=has(r.months)?basisIntakeNumber(r.months):null;
  if(has(r.start)&&!start||has(r.end)&&!end||start&&end&&end<start)issues.push('The reporting dates are invalid.');
  if(has(r.months)&&(!Number.isInteger(months)||months<1||months>12)){months=null;issues.push('The reporting period needs 1–12 whole months.');}
  if(start&&end&&end>=start){
    const first=new Date(start+'T00:00:00Z'),last=new Date(end+'T00:00:00Z'),next=new Date(last.getTime()+86400000);
    if(first.getUTCDate()===1&&next.getUTCDate()===1){
      const span=(next.getUTCFullYear()-first.getUTCFullYear())*12+next.getUTCMonth()-first.getUTCMonth();
      if(span<1||span>12||months!==null&&months!==span)issues.push('The dates and reporting months do not describe the same supported period.');
      else if(months===null)months=span;
    }
  }
  const column=has(r.column)?String(r.column).toLowerCase():null;
  if(column&&!['actual','budget','forecast'].includes(column))issues.push('The actual, budget, or forecast column is unclear.');
  return {start,end,months,column,issues};
}
function basisStatementContext(results){
  const rows=results.filter(r=>r&&typeof r==='object'),periods=rows.map(r=>basisStatementPeriod(r.reporting)),issues=periods.flatMap(p=>p.issues),context={issues};
  for(const key of ['start','end','months','column']){
    const values=[...new Set(periods.map(p=>p[key]).filter(v=>v!==null))];
    if(values.length>1)issues.push('Different reporting periods or columns were read from this file.');
    context[key]=values.length===1?values[0]:null;
  }
  const combined=basisStatementPeriod(context);issues.push(...combined.issues);
  if(context.months===null&&!issues.length)context.months=combined.months;
  const dates=[...new Set(rows.map(r=>r.asOf).filter(v=>v!==null&&v!==undefined&&v!==''))];
  context.asOf=dates.length===1?basisIntakeCalendarDate(dates[0]):null;
  context.dateIssue=dates.length>1?'Different rent-roll dates were read from this file.':!context.asOf?'A valid rent-roll as-of date is missing.':null;
  context.issues=[...new Set(issues)];
  context.label=[context.column?context.column[0].toUpperCase()+context.column.slice(1):'',context.start&&context.end?context.start+' to '+context.end:context.end?'Through '+context.end:'',context.months!==null?context.months+' Months':''].filter(Boolean).join(' · ');
  return context;
}
function basisStatementRows(results,key){
  const rows=[],seen=new Set(),issues=[];
  const canonical=value=>value&&typeof value==='object'?Array.isArray(value)?value.map(canonical):Object.fromEntries(Object.keys(value).sort().filter(k=>!['confidence','fieldSources'].includes(k)).map(k=>[k,canonical(value[k])])):value;
  for(const result of results)for(const row of Array.isArray(result?.[key])?result[key]:[]){
    if(!row||typeof row!=='object'||Array.isArray(row)){issues.push('An extracted row is malformed.');continue;}
    // Only collapse an exact repeated row tied to the same page and quote.
    // Equal amounts or names alone do not establish duplicate source evidence.
    const source=row.src,canDeduplicate=Number.isSafeInteger(Number(source?.page))&&Number(source.page)>0&&typeof source?.quote==='string'&&source.quote.trim().length>=8;
    const fingerprint=JSON.stringify(canonical(row));
    if(canDeduplicate&&seen.has(fingerprint))continue;
    if(canDeduplicate)seen.add(fingerprint);
    rows.push(row);
  }
  return {rows,issues};
}
function basisStatementSubtotal(row){
  return ['subtotal','total'].includes(String(row?.rowType||'').toLowerCase())||/^(?:sub[ -]?total|grand total|total (?:operating )?expenses|total revenue|total income|net operating income|noi)$/i.test(String(row?.name||'').trim());
}
function basisStatementInput(row,context,income=false){
  const issues=[...context.issues],raw=basisStatementNumber(row?.amount);
  const unit=income?'total':row?.basis===undefined?'total':String(row.basis).toLowerCase();
  const basis=unit==='annual'?'total':unit==='pct_egr'?'pct':unit;
  const months=row?.months===undefined?context.months??(unit==='annual'?12:null):basisIntakeNumber(row.months);
  if(basisStatementSubtotal(row))issues.push('A subtotal or total cannot be imported as a detail line.');
  if(raw===null)issues.push('The amount is missing or is not a supported number.');
  if(!['total','psf','pct'].includes(basis))issues.push('The expense basis is unsupported.');
  if(basis==='pct'&&(raw===null||raw<0||raw>1))issues.push('A percentage fee must be a decimal share from 0 to 1.');
  if(basis!=='pct'&&(!Number.isInteger(months)||months<1||months>12))issues.push('The amount needs a stated period of 1–12 whole months.');
  if(context.months!==null&&months!==null&&months!==context.months)issues.push('The line and statement cover different periods.');
  if(unit==='annual'&&months!==12)issues.push('An annual amount cannot also cover a partial-year period.');
  const amount=basis==='pct'?raw:raw!==null&&months>0?raw*12/months:null;
  if(amount===null||!Number.isFinite(amount)||Math.abs(amount)>1e15)issues.push('The annual amount is outside the supported range.');
  return {amount,basis,months,annualized:basis!=='pct'&&months!==null&&months<12,issues:[...new Set(issues)]};
}
function basisIntakeDocumentChecks(docs){
  const checks=[],array=value=>Array.isArray(value)?value:[],money=n=>(n<0?'-$':'$')+new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(Math.abs(n));
  for(const doc of docs||[]){
    const results=array(doc.results).filter(r=>r&&typeof r==='object'),context=basisStatementContext(results);
    if(!results.length)continue;
    const relevant=results.some(r=>['rent_roll','operating_statement','budget'].includes(r.docType)||r.totals&&Object.keys(r.totals).length);
    if(!relevant)continue;
    const totalKeys=['rentRollSF','occupiedSF','vacantSF','rentRollAnnualRent','totalRevenue','totalOperatingExpenses','noi'],totals={};
    for(const key of totalKeys){
      const entries=results.filter(r=>r.totals&&r.totals[key]!==undefined&&r.totals[key]!==null&&r.totals[key]!=='');
      const values=entries.map(r=>basisStatementNumber(r.totals[key])),valid=[...new Set(values)],first=entries[0];
      totals[key]={present:!!first,value:valid.length===1?valid[0]:null,issues:[],src:first?basisIntakeSource(doc,first.docType,first.totals.fieldSources?.[key]||first.totals.src):null};
      if(valid.includes(null))totals[key].issues.push('The stated total is not a supported number.');
      if(valid.length>1)totals[key].issues.push('Different totals for this measure were read from this file.');
      if(entries.some(r=>r.totals.scope&&r.totals.scope!=='document'))totals[key].issues.push('The total covers only part of the file or its scope is unclear.');
    }
    const emit=(metric,label,read,stated,issues,source,period,tolerance=1)=>{
      const reasons=[...new Set(issues)];
      if(read!==null&&(!Number.isFinite(read)||Math.abs(read)>1e15))reasons.push('The calculated total exceeds the supported range.');
      const status=reasons.length||read===null||stated===null?'incomplete':Math.abs(read-stated)<=tolerance?'match':'mismatch';
      const unit=metric.endsWith('SF')?'sf':'money',format=n=>n===null?'—':unit==='sf'?new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n)+' SF':money(n);
      const detail=status==='incomplete'?(reasons.join(' ')||'The document does not supply enough comparable values.'):
        status==='match'?'Extracted amounts match within '+format(tolerance)+'. Compare the source before applying.':
        'The extracted rows give '+format(read)+'; the stated total is '+format(stated)+'. Check missing rows, duplicate rows, units, and the selected column.';
      checks.push({docId:doc.id||'',doc:doc.name||'Document',metric,label,read,stated,status,detail,src:source||null,period:period||'Period Not Stated',unit,tolerance});
    };
    const tenants=basisStatementRows(results,'tenants'),expenses=basisStatementRows(results,'expenses');
    const identityCounts=new Map();
    for(const row of tenants.rows){const id=String(row.name||'').trim().toLowerCase()+'|'+String(row.suite||'').trim().toLowerCase();identityCounts.set(id,(identityCounts.get(id)||0)+1);}
    const tenantIssues=[...tenants.issues];
    if([...identityCounts.values()].some(n=>n>1))tenantIssues.push('Repeated tenant/suite rows need review; they may be duplicate readings or separate leases.');
    const vacant=row=>row.status==='vacant'||/^vacant\b/i.test(String(row.name||''));
    for(const [key,label,filter]of [['rentRollSF','Rent-Roll Area',()=>true],['occupiedSF','Occupied Area',row=>!vacant(row)],['vacantSF','Vacant Area',vacant]]){
      const total=totals[key];if(!total.present)continue;
      const issues=[...tenantIssues,...total.issues],selected=tenants.rows.filter(filter);let sum=0;
      if(!tenants.rows.length)issues.push('No tenant or vacant-suite rows were read.');
      if(results.some(r=>r.asOf)&&context.dateIssue)issues.push(context.dateIssue);
      for(const row of selected){const sf=basisStatementNumber(row.sf);if(sf===null||sf<0)issues.push('A suite area is missing or invalid.');else sum+=sf;}
      if(key!=='rentRollSF'&&tenants.rows.some(row=>!vacant(row)&&!['in_place','signed_future','month_to_month','holdover'].includes(row.status)))issues.push('Occupancy status is missing or unclear.');
      if(key!=='rentRollSF'&&tenants.rows.some(row=>row.status==='signed_future'))issues.push('Signed-future space may overlap current occupied or vacant space; verify the area classification.');
      emit(key,label,sum,total.value,issues,total.src,context.asOf?'As of '+context.asOf:'Date Not Stated',1);
    }
    const rentTotal=totals.rentRollAnnualRent;
    if(rentTotal.present){
      const issues=[...tenantIssues,...rentTotal.issues];if(context.dateIssue)issues.push(context.dateIssue);
      if(!tenants.rows.length)issues.push('No tenant rent rows were read.');let sum=0;
      for(const row of tenants.rows){
        if(vacant(row))continue;
        const start=basisIntakeCalendarDate(row.start),end=basisIntakeCalendarDate(row.end);
        if(row.start&&!start||row.end&&!end){issues.push('A lease date is invalid.');continue;}
        if(context.asOf&&start&&start>context.asOf)continue;
        if(row.status==='signed_future'&&!start){issues.push('A future lease has no supported commencement date.');continue;}
        if(end&&context.asOf&&end<context.asOf&&!['holdover','month_to_month'].includes(row.status)){issues.push('An expired lease needs a stated holdover or month-to-month status.');continue;}
        const sf=basisStatementNumber(row.sf),normalized=basisIntakeRent({...row,sf}),steps=normalized.steps;
        issues.push(...normalized.rentIssues);
        let current=null;for(const step of steps)if(!step.from||context.asOf&&step.from<=context.asOf)current=step;
        if(!current||current.annual===null){issues.push('A current rent amount, effective date, or per-SF area is missing.');continue;}
        // A rule needs its actual effective-date calculation; this check must
        // not treat the first stated rent as current after an escalation.
        if(row.escalation&&row.escalation.type!=='none'&&basisStatementNumber(row.escalation.value)!==0){issues.push('Rule-based rent escalation needs a dated current rent before totals can be compared.');continue;}
        sum+=current.annual;
      }
      emit('rentRollAnnualRent','Current Annual Base Rent',sum,rentTotal.value,issues,rentTotal.src,context.asOf?'As of '+context.asOf:'Date Not Stated',1);
    }
    const opTotal=totals.totalOperatingExpenses;
    if(opTotal.present){
      const issues=[...context.issues,...expenses.issues,...opTotal.issues];let sum=0;
      if(!expenses.rows.length)issues.push('No expense detail rows were read.');
      if(context.months===null)issues.push('The statement total needs a supported reporting period.');
      const areaValues=[...new Set(results.map(r=>basisStatementNumber(r.property?.rentableSF)).filter(v=>v!==null))],sf=areaValues.length===1?areaValues[0]:null;
      for(const row of expenses.rows){
        if(basisStatementSubtotal(row)){issues.push('A subtotal was returned as an expense row; exclude it and review the detail.');continue;}
        const amount=basisStatementNumber(row.amount),months=row.months===undefined?context.months:basisIntakeNumber(row.months);
        if(amount===null){issues.push('An expense amount is invalid.');continue;}
        if(months===null||months!==context.months){issues.push('Expense lines and the stated total cover different or unknown periods.');continue;}
        if(row.basis==='total')sum+=amount;
        else if(row.basis==='psf'&&sf>0)sum+=amount*sf;
        else if(row.basis==='psf')issues.push('Per-SF expenses need building area from this document.');
        else if(row.basis==='pct_egr')issues.push('A fee rate needs its stated dollar amount and revenue base to reconcile expenses.');
        else issues.push('An expense basis is missing or unsupported.');
      }
      emit('totalOperatingExpenses','Reported Operating Expenses',sum,opTotal.value,issues,opTotal.src,context.label,1);
    }
    if([totals.totalRevenue,opTotal,totals.noi].some(t=>t.present)){
      const all=[totals.totalRevenue,opTotal,totals.noi],issues=[...context.issues,...all.flatMap(t=>t.issues)];
      if(all.some(t=>!t.present))issues.push('Revenue, operating expenses, and NOI are all needed for this comparison.');
      if(context.months===null)issues.push('The totals need a supported reporting period.');
      const read=all.slice(0,2).every(t=>t.value!==null)?totals.totalRevenue.value-opTotal.value:null;
      emit('noi','Revenue Less Expenses = NOI',read,totals.noi.value,issues,totals.noi.src||opTotal.src,context.label,1);
    }
    if(!totalKeys.some(key=>totals[key].present))emit('none','Document Totals',null,null,['No stated totals were extracted; completeness could not be checked.'],null,context.asOf?'As of '+context.asOf:context.label);
  }
  return checks;
}
function basisIntakeReconciliationView(checks){
  if(!checks.length)return null;
  const label={match:'Totals Match',mismatch:'Mismatch',incomplete:'Not Fully Checked'};
  const format=(value,unit)=>value===null?'—':new Intl.NumberFormat('en-US',{minimumFractionDigits:0,maximumFractionDigits:2,...(unit==='money'?{style:'currency',currency:'USD'}:{})}).format(value)+(unit==='sf'?' SF':'');
  const count=state=>checks.filter(c=>c.status===state).length;
  return el('details',{class:'ichecks','data-intake-reconciliation':'',open:count('mismatch')||count('incomplete')?true:null},[
    el('summary',{text:'Document Totals · '+count('match')+' Match · '+count('mismatch')+' Mismatch · '+count('incomplete')+' Not Fully Checked'}),
    el('p',{class:'hint',text:'Arithmetic checks use each file’s own date, reporting period, and stated totals. A match does not verify the AI reading or establish that every source row was extracted.'}),
    intTable(['Document / Period','Check','Rows / Calculation','Stated','Result'],checks.map(c=>({cells:[
      el('span',{},[document.createTextNode(c.doc),el('br'),el('small',{class:'mut',text:c.period})]),el('span',{text:c.label,style:'white-space:normal'}),format(c.read,c.unit),format(c.stated,c.unit),
      el('span',{},[el('b',{text:label[c.status]}),el('br'),document.createTextNode(c.detail),c.src?el('details',{},[el('summary',{text:'Source Evidence'}),basisSourceCell(c.src)]):null])]})))
  ]);
}
/* END BASIS INTAKE RECONCILIATION */
