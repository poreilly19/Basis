/* BEGIN BASIS REPORT EXPORT */
// Independently arranged report tables. Values come from one model/result snapshot.
const BASIS_REPORT_FORMATS={number:'#,##0',money:'"$"#,##0;("$"#,##0)',psf:'"$"0.00;("$"0.00)',percent:'0.00%'};
function basisBuildReportPackage(model,result,context={}){
  if(!model||!result||!result.ann||!Number.isInteger(result.nY)||result.nY<1)throw Error('Calculate a valid property before exporting reports.');
  const sheets=[],formats=[],currency=model.currency||'USD',area=model.areaUnit||'SF';let cells=0;
  const sheet=(name,rows,widths=[])=>{
    const width=rows.reduce((width,row)=>Math.max(width,row.length),0);
    cells+=rows.length*width;if(cells>2000000)throw Error('The report package exceeds two million cells. Reduce the analysis or export individual reports.');
    for(const row of rows)for(const value of row){
      if(value!==null&&value!==undefined&&!['string','number','boolean'].includes(typeof value))throw Error('A report cell has an unsupported value.');
      if(typeof value==='number'&&!Number.isFinite(value))throw Error('A report value is not finite. Check Model Checks before exporting.');
      if(typeof value==='string'&&value.length>32767)throw Error('A report cell exceeds Excel’s 32,767-character limit. Shorten the note or use a model backup.');
    }
    const item={name,rows,widths};sheets.push(item);return item;
  };
  const fmt=(name,r,c,type)=>formats.push([name,r,c,type]);
  const number=value=>value===undefined||value===null||value===''?0:Number(value);
  const finiteOrBlank=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
  const lookup=(key,id)=>(model[key]||[]).find(x=>x.id===id)?.name||id||'';
  const groups=t=>basisTenantGroupIds(t).map(id=>lookup('tgroups',id)).join('; ');
  const month=index=>{const serial=number(model.startYear)*12+(number(model.startMonth)||1)-1+index;return Math.floor(serial/12)+'-'+String(serial%12+1).padStart(2,'0');};
  const period=y=>'Year '+(y+1)+' · '+month(y*12)+' to '+month(y*12+11);
  sheet('README',[
    ['Field','Value'],['Package','Basis Report Workbook'],['Report Schema',1],['Property',model.name||'Untitled Property'],
    ['Portfolio',context.portfolio||''],['Scenario',context.scenario||''],['Generated UTC',context.generatedAt||''],
    ['Currency',currency],['Area Unit',area],['Analysis',month(0)+' to '+month(result.nY*12-1)],
    ['Contents','Calculated values and recorded assumptions. Amounts retain full numeric precision; display formats do not round saved values. Currency and area are model labels; no exchange or area conversion is performed. Non-USD amounts use neutral numeric formatting.'],
    ['Cash Flow','Analysis years begin in the model’s start month. Expense/outflow lines use negative values. Reference-only expense/capital records are excluded from cash-flow detail and retained in Input Assumptions. Forward NOI used for resale is separate from the hold-period cash flows.'],
    ['Tenant Summary','Year 1 modeled lease streams, including probability-weighted options. Property-level actual/budget overrides and vacancy may differ from tenant totals.'],
    ['Use','Review Model Checks, inputs and source documents before relying on results.'],
    ['Interchange','Report workbook only. Use .basiscre for an editable model backup or the separate XL4ADW template workflow to send inputs to ARGUS.']
  ],[24,110]);
  const summary=sheet('Property Summary',[
    ['Metric','Value','Unit'],['Property',model.name||'',null],['Rentable Area',result.sf,area],['Present Value',result.pv,currency],
    ['Year 1 NOI',result.noiY1,currency],['Unlevered IRR',finiteOrBlank(result.irrU),'Ratio'],['Levered IRR',finiteOrBlank(result.irrL),'Ratio'],
    ['Going-in Yield',finiteOrBlank(result.goingIn),'Ratio'],['Discount Rate',number(model.discount),'Ratio'],['Exit Cap Rate',number(model.exitCap),'Ratio'],
    ['Analysis Start',month(0),null],['Analysis Years',result.nY,'Years'],['Tenant Records',(model.tenants||[]).length,'Count']
  ],[30,40,16]);
  fmt(summary.name,2,1,'number');for(const r of [3,4])fmt(summary.name,r,1,'money');for(const r of [5,6,7,8,9])fmt(summary.name,r,1,'percent');
  const moneyLabel=currency==='USD'?'$':currency;
  const rentUnits={psfyr:moneyLabel+' / '+area+' / Year',psfmo:moneyLabel+' / '+area+' / Month',yramt:moneyLabel+' / Year',moamt:moneyLabel+' / Month',mkt:'Market Rent × Share'};
  const rentRows=[['Tenant','Suite','Area '+area,'Start','Expiry','Base Rent as Entered','Rent Unit','Market Rent Share','Annual Step','Free Rent Months','Upon Expiry','Recovery Structure','Market Leasing','Tenant Groups']];
  for(const t of model.tenants||[]){
    const unit=RENT_ALIAS[t.rentBasis]||t.rentBasis||'psfyr';
    rentRows.push([t.name||'',t.suite||'',number(t.sf),t.start||'',leaseEnd(t)||'',unit==='mkt'?null:number(t.rent),rentUnits[unit]||unit,unit==='mkt'?(t.rentPct==null?1:number(t.rentPct)):null,number(t.step),number(t.free),t.expiry||'',lookup('recs',t.rec),lookup('mlas',t.mla),groups(t)]);
    const r=rentRows.length-1;fmt('Tenant Rent Roll',r,2,'number');fmt('Tenant Rent Roll',r,5,unit.startsWith('psf')?'psf':'money');fmt('Tenant Rent Roll',r,7,'percent');fmt('Tenant Rent Roll',r,8,'percent');
  }
  sheet('Tenant Rent Roll',rentRows,[28,14,14,14,14,22,24,18,16,18,18,28,28,30]);
  const sumYear=values=>Array.from(values||[]).slice(0,12).reduce((sum,value)=>sum+value,0);
  const tenantRows=[['Tenant','Area '+area,'Year 1 Base Rent','Year 1 CPI','Year 1 Abatement','Year 1 Reimbursements','Year 1 Percentage Rent','Year 1 TI','Year 1 LC','Tenant Groups']];
  for(const stream of rStreams(model,result)){
    const t=(model.tenants||[]).find(t=>t.id===stream.tid);
    tenantRows.push([stream.name,stream.sf,sumYear(stream.base),sumYear(stream.cpi),-sumYear(stream.abate),sumYear(stream.reimb),sumYear(stream.pr),-sumYear(stream.ti),-sumYear(stream.lc),t?groups(t):'']);
    const r=tenantRows.length-1;fmt('Tenant Summary',r,1,'number');for(let c=2;c<9;c++)fmt('Tenant Summary',r,c,'money');
  }
  sheet('Tenant Summary',tenantRows,[34,14,22,22,22,24,24,20,20,30]);
  const A=result.ann,cash=[['Metric',...Array.from({length:result.nY},(_,y)=>period(y))]];
  const cashRow=(label,values,sign=1,type='money')=>{
    if(!values)throw Error('Calculated report data is missing: '+label);
    const row=[label,...Array.from({length:result.nY},(_,y)=>sign*Number(values[y]??0))];cash.push(row);
    for(let c=1;c<row.length;c++)fmt('Cash Flow',cash.length-1,c,type);
  };
  for(const [label,key,sign]of [
    ['Base Rental Revenue','gpr',1],['Absorption & Turnover Vacancy','turnover',-1],['Base Rent Abatements','abate',-1],['Scheduled Base Rental Revenue','sched',1],
    ['CPI Revenue','cpi',1],['Percentage Rent','pr',1],['Expense Reimbursements','reimb',1],['Parking Revenue','park',1],['Storage Revenue','stor',1],['Other Revenue','misc',1],
    ['Potential Gross Revenue','tpgr',1],['General Vacancy','genVac',-1],['Credit Loss','credit',-1],['Termination Fees','fee',1],['Effective Gross Revenue','egr',1]
  ])cashRow(label,A[key],sign);
  for(const expense of A.ops||[])if(!expense.ref)cashRow(expense.name,expense.v,-1);
  cashRow('Ground Rent — Operating',A.glOp,-1);cashRow('Total Operating Expenses',A.op,-1);cashRow('Net Operating Income',A.noi);
  for(const expense of A.nons||[])if(!expense.ref)cashRow(expense.name,expense.v,-1);
  cashRow('Ground Rent — Non-operating',A.glNon,-1);
  cashRow('Total Non-operating Expenses',A.non,-1);cashRow('Tenant Improvements',A.ti,-1);cashRow('Tenant Incentives',A.inc,-1);cashRow('Leasing Commissions',A.lc,-1);
  for(const capital of A.caps||[])if(!capital.ref)cashRow(capital.name,capital.v,-1);
  cashRow('Total Leasing & Capital Costs',A.leasing,-1);cashRow('Security Deposits — Net',A.sdNet);cashRow('Cash Flow Before Debt Service',A.cfbds);
  if(model.loanOn){
    cashRow('Debt Service',result.dsTot,-1);
    for(const [label,key,sign]of [['Loan Proceeds — Net of Fees','fundM',1],['Future Funding Draws','drawM',1],['Loan Repaid at Maturity','balloonM',-1]]){
      cashRow(label,Array.from({length:result.nY},(_,y)=>Array.from(result[key]||[]).slice(y*12,y*12+12).reduce((s,n)=>s+n,0)),sign);
    }
    cashRow('Cash Flow After Debt Service',result.cfads);
  }
  cashRow('Average Occupancy',A.occ,1,'percent');
  sheet('Cash Flow',cash,[42,...Array(result.nY).fill(27)]);
  const terms=[['Tenant','Suite','Field','Value']],assumptions=[['Section','Record','Field','Value']];let leaves=0;
  function flatten(value,path,emit,depth=0){
    if(depth>72||++leaves>300000)throw Error('Report assumptions exceed the supported size. Export a model backup instead.');
    if(value!==null&&typeof value==='object'){
      const keys=Object.keys(value);if(!keys.length){emit(path,Array.isArray(value)?'[]':'{}');return;}
      for(const key of keys)flatten(value[key],path?path+'.'+key:key,emit,depth+1);
    }else emit(path,value==null?'':value);
  }
  for(const t of model.tenants||[])flatten(t,'',(key,value)=>terms.push([t.name||'',t.suite||'',key,value]));
  for(const [key,value]of Object.entries(model)){
    if(['tenants','portfolio','srcLog'].includes(key))continue;
    if(Array.isArray(value))value.forEach((record,index)=>flatten(record,'',(field,item)=>assumptions.push([key,record&&typeof record==='object'?String(record.name||record.id||index+1):String(index+1),field,item])));
    else flatten(value,'',(field,item)=>assumptions.push(['Property','',field?key+'.'+field:key,item]));
  }
  sheet('All Terms Report',terms,[28,14,40,72]);sheet('Input Assumptions',assumptions,[24,28,40,72]);
  return {format:'basis-report-workbook',version:1,property:model.name||'',currency,area,sheets,formats};
}
function basisReportToXlsx(pkg,library){
  const wb=library.utils.book_new();
  for(const source of pkg.sheets){
    const ws=library.utils.aoa_to_sheet(source.rows);
    // Explicit primitive values keep formula-looking names and user text as text.
    for(const [address,cell]of Object.entries(ws)){if(address.startsWith('!'))continue;delete cell.f;delete cell.F;delete cell.l;}
    for(const [name,row,col,type]of pkg.formats)if(name===source.name){const cell=ws[library.utils.encode_cell({r:row,c:col})];if(cell?.t==='n')cell.z=pkg.currency!=='USD'&&(type==='money'||type==='psf')?(type==='psf'?'0.00;(0.00)':'#,##0;(#,##0)'):BASIS_REPORT_FORMATS[type];}
    ws['!cols']=source.widths.map(wch=>({wch}));
    library.utils.book_append_sheet(wb,ws,source.name);
  }
  wb.Props={Title:'Basis Report Workbook',Subject:pkg.property,Author:'Basis'};
  return new Uint8Array(library.write(wb,{bookType:'xlsx',type:'array',compression:true}));
}
const BASIS_REPORT_EXPORT={job:null,error:'',message:''};
function basisCancelReportExport(){const job=BASIS_REPORT_EXPORT.job;if(job){job.cancelled=true;basisCalculationClients.get('report-export')?.cancel('Report export cancelled.');BASIS_REPORT_EXPORT.message='Cancelling…';drawPane();}}
async function exportDumpXlsx(){return basisExportReport('xlsx');}
async function basisExportReport(format){
  if(BASIS_REPORT_EXPORT.job)return 'busy';
  const context=pwActionContext(),record=pwRec(PW.cur),job={cancelled:false};
  const valid=()=>{if(job.cancelled)throw Error('Report export cancelled.');if(!pwSameContext(context))throw Error('The property or scenario changed. Start a new report export for the current selection.');};
  BASIS_REPORT_EXPORT.error='';BASIS_REPORT_EXPORT.message='Preparing report…';BASIS_REPORT_EXPORT.job=job;drawPane();
  try{
    if(!record||record.pf!==PW.pf||record.sc!==PW.sc)throw Error('Open a property in the selected portfolio and scenario first.');
    const model=JSON.parse(context.json);basisValidateModel(model);
    const metadata={portfolio:pwPf().name,scenario:pwSc().name,generatedAt:new Date().toISOString()};
    const result=await basisRunCalculation('property',model,'report-export');valid();
    let bytes,suffix;
    if(format==='json'){
      bytes=JSON.stringify({format:'basis-reports',version:1,reports:buildDump(model,result)},null,2);suffix='_basis_reports.json';
    }else{
      const pkg=basisBuildReportPackage(model,result,metadata),library=await pfXlsxLib();valid();
      bytes=basisReportToXlsx(pkg,library);suffix='_Basis_Report_Package.xlsx';
    }
    valid();const status=await offerFile(basisSafeFilename(model.name)+suffix,bytes);
    BASIS_REPORT_EXPORT.message=status==='saved'?(format==='json'?'Report tables downloaded.':'Workbook downloaded.'):status==='declined'?'Export cancelled.':'Export did not complete. Try again.';return status;
  }catch(error){BASIS_REPORT_EXPORT.message='';BASIS_REPORT_EXPORT.error=error.message||'The workbook could not be exported.';return 'failed';}
  finally{if(BASIS_REPORT_EXPORT.job===job)BASIS_REPORT_EXPORT.job=null;drawPane();}
}
function basisReportExportPane(){
  const busy=!!BASIS_REPORT_EXPORT.job;
  return el('div',{class:'studio-panel'},[el('h2',{text:'Report Package'}),el('p',{text:'Download an Excel workbook containing Property Summary, Tenant Summary, Tenant Rent Roll, Cash Flow, All Terms Report, and Input Assumptions. All sheets use one current property snapshot.'}),
    el('p',{class:'hint',text:'This workbook contains calculated values and recorded assumptions. Use a .basiscre backup to reopen the complete model, or ARGUS / XL4ADW to fill an ARGUS input template.'}),
    el('div',{class:'bar'},[el('button',{class:'btn p',text:busy?'Preparing Workbook…':'Download Report Workbook (.xlsx)',disabled:busy,onclick:exportDumpXlsx}),
      el('button',{class:'btn',text:'Export report tables (.json)',disabled:busy,onclick:exportDumpJson}),busy?el('button',{class:'btn',text:'Cancel Export',onclick:basisCancelReportExport}):null]),
    BASIS_REPORT_EXPORT.error?el('p',{class:'note err',role:'alert',text:BASIS_REPORT_EXPORT.error}):null,
    BASIS_REPORT_EXPORT.message?el('p',{class:'hint',role:'status',text:BASIS_REPORT_EXPORT.message}):null]);
}
/* END BASIS REPORT EXPORT */
