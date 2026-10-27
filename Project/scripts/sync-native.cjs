// Keep the standalone HTML distributable and its inert worker bundle in sync
// with the canonical modules. Read and write the HTML synchronously so updates
// elsewhere in the application are preserved by this single build operation.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const file = path.join(root, 'app/index.html');
let html = fs.readFileSync(file, 'utf8');
const workerStart='<!-- BEGIN BASIS CALCULATION WORKER BUNDLE -->';
const workerEnd='<!-- END BASIS CALCULATION WORKER BUNDLE -->';
const workerSources=['financial_engine.js','scenario_settings.js','native_codec.js','calculation_worker.js'];
const source=name=>fs.readFileSync(path.join(root,'src',name),'utf8').trim();
const inline=text=>text.replace(/<\/script/gi,'<\\/script');
const occurrences=text=>html.split(text).length-1;
if(occurrences(workerStart)||occurrences(workerEnd)){
  const start=html.indexOf(workerStart),end=html.indexOf(workerEnd);
  if(occurrences(workerStart)!==1||occurrences(workerEnd)!==1||end<start)throw Error('Missing or duplicate calculation worker bundle markers');
  html=html.slice(0,start)+html.slice(end+workerEnd.length);
}
const regions = [
  ['beta_ui.js','/* BEGIN BASIS BETA UI */','/* END BASIS BETA UI */','const studioBtn='],
  ['report_export.js','/* BEGIN BASIS REPORT EXPORT */','/* END BASIS REPORT EXPORT */','/* Basis report tables:'],
  ['intake_reconciliation.js','/* BEGIN BASIS INTAKE RECONCILIATION */','/* END BASIS INTAKE RECONCILIATION */','const studioBtn='],
  ['intake_amendments.js','/* BEGIN BASIS INTAKE AMENDMENTS */','/* END BASIS INTAKE AMENDMENTS */','const studioBtn='],
  ['intake_quality.js','/* BEGIN BASIS INTAKE QUALITY */','/* END BASIS INTAKE QUALITY */','const studioBtn='],
  ['intake_review.js','/* BEGIN BASIS INTAKE REVIEW */','/* END BASIS INTAKE REVIEW */','const studioBtn='],
  ['model_checks.js','/* BEGIN BASIS MODEL CHECKS */','/* END BASIS MODEL CHECKS */','const studioBtn='],
  ['guided_ui.js','/* BEGIN BASIS GUIDED UI */','/* END BASIS GUIDED UI */','const studioBtn='],
  ['number_inputs.js','/* BEGIN BASIS NUMBER INPUTS */','/* END BASIS NUMBER INPUTS */','function inp(o,k,p={})'],
  ['navigation_ui.js','/* BEGIN BASIS NAVIGATION UI */','/* END BASIS NAVIGATION UI */','const studioBtn='],
  ['workflow_ui.js','/* BEGIN BASIS WORKFLOW UI */','/* END BASIS WORKFLOW UI */','const studioBtn='],
  ['tenant_groups.js','/* BEGIN BASIS TENANT GROUPS */','/* END BASIS TENANT GROUPS */','/* =========================== PROPERTY FILE'],
  ['workspace_preferences.js','/* BEGIN BASIS WORKSPACE PREFERENCES V1 */','/* END BASIS WORKSPACE PREFERENCES V1 */','/* Basis Studio workspace. Presentation only;'],
  ['workspace_settings_ui.js','/* BEGIN BASIS WORKSPACE SETTINGS UI */','/* END BASIS WORKSPACE SETTINGS UI */','const studioBtn='],
  ['ai_provider.js','/* BEGIN BASIS AI PROVIDER */','/* END BASIS AI PROVIDER */','const AI={text:'],
  ['financial_engine.js','/* BEGIN BASIS FINANCIAL ENGINE */','/* END BASIS FINANCIAL ENGINE */'],
  ['scenario_settings.js','/* BEGIN BASIS SCENARIO SETTINGS V1 */','/* END BASIS SCENARIO SETTINGS V1 */','/* BEGIN BASIS NATIVE ARCHIVE V1:'],
  ['native_codec.js','/* BEGIN BASIS NATIVE ARCHIVE V1:','/* END BASIS NATIVE ARCHIVE V1 */'],
  ['recovery_store.js','/* BEGIN BASIS DRAFT RECOVERY:','/* END BASIS DRAFT RECOVERY */','/* Native model sharing —'],
  ['native_ui.js','/* Native model sharing —','/* =========================== PORTFOLIOS',null,true],
  ['calculation_client.js','/* BEGIN BASIS CALCULATION CLIENT */','/* END BASIS CALCULATION CLIENT */','/* BEGIN BASIS CALCULATION UI */'],
  ['calculation_ui.js','/* BEGIN BASIS CALCULATION UI */','/* END BASIS CALCULATION UI */'],
  ['office_zip.js','/* BEGIN BASIS OFFICE ZIP:','/* END BASIS OFFICE ZIP */'],
  ['pdf_integrity.js','/* BEGIN BASIS PDF INTEGRITY */','/* END BASIS PDF INTEGRITY */','/* BEGIN BASIS PDF LOADER */'],
  ['pdf_loader.js','/* BEGIN BASIS PDF LOADER */','/* END BASIS PDF LOADER */','// ---- PDF: paired module loading'],
  ['image_safety.js','/* BEGIN BASIS IMAGE SAFETY */','/* END BASIS IMAGE SAFETY */','async function intFitImage(file,lim)'],
  ['workspace_validation.js','/* BEGIN BASIS WORKSPACE VALIDATION */','/* END BASIS WORKSPACE VALIDATION */','const pwId='],
  ['xlsx_loader.js','/* BEGIN BASIS XLSX LOADER */','/* END BASIS XLSX LOADER */','const PF_OPTS='],
];
for(const [name,start,end,anchor,keepEnd]of regions){
  const text=inline(source(name));
  if(!occurrences(start)&&anchor){
    if(occurrences(anchor)!==1)throw Error('Missing or duplicate module insertion point: '+name);
    const at=html.indexOf(anchor);html=html.slice(0,at)+text+'\n\n'+html.slice(at);continue;
  }
  const a=html.indexOf(start),b=html.indexOf(end,a);
  if(a<0||b<0||occurrences(start)!==1||occurrences(end)!==1)throw Error('Missing or duplicate canonical region: '+name);
  html=html.slice(0,a)+text+(keepEnd?'\n\n':'')+html.slice(b+(keepEnd?0:end.length));
}
const bodyEnd=html.lastIndexOf('</body>');
if(bodyEnd<0)throw Error('Cannot insert calculation worker bundle without a closing body');
const bundle=workerStart+'\n<script id="basis-calculation-worker" type="application/x-basis-worker">\n'+
  inline(workerSources.map(source).join('\n\n'))+'\n</script>\n'+workerEnd+'\n';
// Normalize only the gap around the generated bundle, keeping repeated builds
// byte-identical and leaving the surrounding application source intact.
html=html.slice(0,bodyEnd).replace(/\s*$/,'\n')+bundle+html.slice(bodyEnd);
fs.writeFileSync(file, html);
console.log('Synchronized canonical application modules and calculation worker into app/index.html');
