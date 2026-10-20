const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const source=name=>fs.readFileSync(path.join(root,'src',name),'utf8').trim();
const inline=text=>text.replace(/<\/script/gi,'<\\/script');
const workerStart='<!-- BEGIN BASIS CALCULATION WORKER BUNDLE -->',workerEnd='<!-- END BASIS CALCULATION WORKER BUNDLE -->';
assert.equal(html.split(workerStart).length-1,1,'App must contain one calculation worker bundle start');
assert.equal(html.split(workerEnd).length-1,1,'App must contain one calculation worker bundle end');
const start=html.indexOf(workerStart),end=html.indexOf(workerEnd,start);
assert.ok(end>start,'Calculation worker bundle markers are out of order');
const expectedWorker=inline(['financial_engine.js','scenario_settings.js','native_codec.js','calculation_worker.js'].map(source).join('\n\n'));
const bundle=html.slice(start,end+workerEnd.length);
assert.equal(bundle,workerStart+'\n<script id="basis-calculation-worker" type="application/x-basis-worker">\n'+expectedWorker+'\n</script>\n'+workerEnd,
  'Embedded calculation worker differs from its canonical module bundle');
assert.ok(start>html.lastIndexOf('</script>',start),'Worker bundle must follow the executable application scripts');
assert.ok(end<html.lastIndexOf('</body>'),'Calculation worker bundle must be inside the document body');
assert.equal((html.match(/\bid=["']basis-calculation-worker["']/g)||[]).length,1,'Calculation worker script ID must be unique');
assert.doesNotMatch(expectedWorker,/<\/script/i,'Worker source must escape closing script tags');
new vm.Script(expectedWorker,{filename:'calculation-worker.js'});
const application=html.slice(0,start)+html.slice(end+workerEnd.length),positions=new Map();
for(const name of ['financial_engine.js','scenario_settings.js','native_codec.js','recovery_store.js','native_ui.js','calculation_client.js','calculation_ui.js','office_zip.js','pdf_integrity.js','pdf_loader.js','image_safety.js','workspace_validation.js','xlsx_loader.js']){
  const text=inline(source(name)),at=application.indexOf(text);positions.set(name,at);
  assert.ok(at>=0,'app/index.html embedded module differs from src/'+name);
  assert.equal(application.indexOf(text,at+1),-1,'Canonical application module is duplicated: '+name);
}
for(const [before,after]of [['financial_engine.js','scenario_settings.js'],['scenario_settings.js','native_codec.js'],
  ['native_codec.js','recovery_store.js'],['recovery_store.js','native_ui.js'],['calculation_client.js','calculation_ui.js'],['pdf_integrity.js','pdf_loader.js']]){
  assert.ok(positions.get(before)<positions.get(after),before+' must be embedded before '+after);
}
const nativeUiStart=application.indexOf('/* Native model sharing —'),nativeUiEnd=application.indexOf('/* =========================== PORTFOLIOS',nativeUiStart);
assert.ok(nativeUiStart>=0&&nativeUiEnd>nativeUiStart,'Native UI region boundaries must be present');
for(const name of ['scenario_settings.js','recovery_store.js','calculation_client.js','calculation_ui.js']){
  assert.ok(positions.get(name)<nativeUiStart||positions.get(name)>=nativeUiEnd,name+' must be outside the replaceable native UI region');
}
assert.ok(application.includes('Save .basiscre')&&application.includes('basisImportFile'),'App is missing portfolio native export/import');
let scripts=0;
for(const m of application.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/g)){
  if(/\bsrc\s*=/.test(m[1]))continue;
  new vm.Script(m[2],{filename:'inline-'+(++scripts)+'.js'});
}
assert.ok(scripts>=1);
console.log('PASS app embeds thirteen matching canonical modules in dependency order');
console.log('PASS inert calculation worker exactly matches its four canonical source modules and parses');
console.log('PASS '+scripts+' inline script(s) parse successfully');
