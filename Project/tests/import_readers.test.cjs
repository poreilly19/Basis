const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'..','app/index.html'),'utf8');
function part(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a,'Import-reader extraction boundaries must exist');return html.slice(a,b);}
const source=[
  fs.readFileSync(path.join(__dirname,'..','src/image_safety.js'),'utf8'),
  part('const IREAD_LIMITS=','const intEnc='),
  part('/* BEGIN BASIS PDF READING */','/* END BASIS PDF READING */'),
  part('async function intFitImage(file,lim){','let _intLim='),
  part('async function intAdd(files){','// ---- what Claude is asked for ----'),
  part('async function axeReadTemplate(f){','async function axeBuild()'),
  part('async function axReadFile(f){','PANES["tools.workbook"]='),
  part('function pfOpen(st){','PANES["tools.file"]=')
].join('\n');
const MiB=1024*1024;
function deferred(){let resolve,reject;const promise=new Promise((accept,decline)=>{resolve=accept;reject=decline;});return {promise,resolve,reject};}
function setup(){
  const counters={draw:0,read:0,pdfPages:0,pdfDestroy:0,pdfLoads:0,stop:0};let uid=0;
  const context=vm.createContext({TextEncoder,Uint8Array,setTimeout,clearTimeout,AbortController,OFFICE_ZIP_LIMITS:{archive:64*MiB},INT_EXT:{txt:'Text',docx:'Word',pdf:'PDF'},INT:{docs:[],err:'',x:{}},AXE:{},AXU:{},PF_IMPORT:null,S:{name:'Active property'},
    drawPane:()=>counters.draw++,uid:()=>String(++uid),intBytes:text=>new TextEncoder().encode(text).length,
    intStopExtraction:()=>counters.stop++,officeFileBuffer:file=>file.arrayBuffer(),intUnzip:async data=>data,
    intDocx:async()=>'<document text>',intPptx:async()=>[{n:1,text:'Slide'}],intXlsx:async data=>[{name:'Input Assumptions Report',rows:[[data.name]]}],
    intLimits:async()=>null,intFitImage:async()=>new Uint8Array(),intRenderPage:async()=>new Uint8Array(),
    x4ReadTemplate:async data=>({property:data.name}),axInflate(){},axeSame:()=>false,x4slug:name=>name,
    axImport:rows=>({S:{name:rows[0][0]}}),axCashFlow:()=>null,axVerify:model=>({model}),x4Props:()=>[],axOpenX4(){},
    pfReadFile:file=>file.promise,pwAdopt:model=>{context.adopted=model;return Promise.resolve(model);}});
  const pdf={numPages:1,destroy:async()=>counters.pdfDestroy++,getPage:async()=>{counters.pdfPages++;return {getTextContent:async()=>({items:[{str:'A document text layer with enough content to avoid a scanned-page fallback.',transform:[1,0,0,1,0,0],width:100,height:10}]})};}};
  context.intPdfLib=async()=>({getDocument:()=>{counters.pdfLoads++;return {promise:Promise.resolve(pdf),destroy:async()=>counters.pdfDestroy++};}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/pdf_loader.js'),'utf8'),context);
  vm.runInContext(source,context,{filename:'basis-import-readers.js'});
  const run=code=>vm.runInContext(code,context);
  return {context,run,counters,pdf,file(name,size=1,text='Body'){return {name,size,text:async()=>{counters.read++;return text;},arrayBuffer:async()=>{counters.read++;return {name,byteLength:1};}};}};
}
async function until(predicate){for(let i=0;i<100&&!predicate();i++)await Promise.resolve();assert.ok(predicate(),'Expected document-reading boundary was reached');}
function readingTimers(context){
  const timers=new Map();let id=0;
  context.setTimeout=(callback,delay)=>{const key=++id;timers.set(key,{callback,delay});return key;};
  context.clearTimeout=key=>timers.delete(key);
  return {timers,expireDocument(){const entry=[...timers].find(([,timer])=>timer.delay===120000);assert.ok(entry,'Document deadline must be active');timers.delete(entry[0]);entry[1].callback();}};
}

test('non-Office oversized documents are rejected before text, image or PDF reads',async()=>{
  for(const ext of ['txt','csv','json','pdf','png']){
    const {context,run,counters,file}=setup();context.doc={ext,pages:[],images:[]};context.file=file('oversized.'+ext,32*MiB+1);
    await assert.rejects(run('intRead(doc,file)'),/32 MiB/);assert.equal(counters.read,0);assert.equal(counters.pdfLoads,0);
  }
  const {context,run,counters,file}=setup();context.files=[file('oversized.txt',32*MiB+1)];
  await run('intAdd(files)');assert.equal(counters.read,0);assert.equal(context.INT.docs.length,0);assert.match(context.INT.err,/32 MiB/);
});

test('ordinary documents and the existing 64 MiB Office allowance remain supported',async()=>{
  const {context,run,file}=setup();context.files=[file('notes.txt',32*MiB,'Café 東京'),file('lease.docx',64*MiB)];
  await run('intAdd(files)');assert.equal(context.INT.docs.length,2);assert.ok(context.INT.docs.every(doc=>doc.status==='ready'));
  assert.equal(context.INT.docs[0].pages[0].text,'Café 東京');assert.equal(context.INT.docs[1].pages[0].text,'<document text>');
});

test('intake reserves a 128 MiB total and 50-document budget before reading more files',async()=>{
  const {context,run,counters,file}=setup();context.INT.docs=[{size:96*MiB}];context.files=[file('last.txt',32*MiB),file('over.txt',1)];
  await run('intAdd(files)');assert.equal(counters.read,1);assert.equal(context.INT.docs.length,2);assert.match(context.INT.err,/128 MiB/);
  context.INT.docs=Array.from({length:50},()=>({size:1}));context.files=[file('too-many.txt')];
  await run('intAdd(files)');assert.equal(counters.read,1);assert.match(context.INT.err,/50 documents/);
});

test('concurrent intake batches share reserved bytes and clearing stops late reads and queued files',async()=>{
  const {context,run,counters,file}=setup(),first=deferred(),second=deferred();
  context.a={name:'one.docx',size:64*MiB,arrayBuffer:()=>first.promise};context.b={name:'two.docx',size:64*MiB,arrayBuffer:()=>second.promise};context.c=file('over.txt');
  const one=run('intAdd([a])'),two=run('intAdd([b])');await run('intAdd([c])');
  assert.equal(context.INT.docs.length,2);assert.equal(counters.read,0);assert.match(context.INT.err,/128 MiB/);
  run('iReadClearDocuments()');const afterClear=counters.draw;first.resolve(new ArrayBuffer(1));second.resolve(new ArrayBuffer(1));await Promise.all([one,two]);
  assert.equal(context.INT.docs.length,0);assert.equal(counters.draw,afterClear);assert.equal(counters.stop,1);
  const pending=deferred();context.files=[{name:'pending.txt',size:1,text:()=>pending.promise},file('queued.txt')];
  const batch=run('intAdd(files)');run('iReadClearDocuments()');pending.resolve('late text');await batch;
  assert.equal(context.INT.docs.length,0);assert.equal(counters.read,0);
});

test('a stalled text read reaches its deadline and later files in the batch still load',async()=>{
  const {context,run,file}=setup(),clock=readingTimers(context),blocked=deferred();let reads=0;
  context.files=[{name:'stalled.txt',size:1,text:()=>{reads++;return blocked.promise;}},file('next.txt',1,'Next file')];
  const pending=run('intAdd(files)');await until(()=>reads===1);clock.expireDocument();
  await until(()=>context.INT.docs[1]?.status==='ready');await pending;
  const failed=context.INT.docs[0];assert.equal(failed.status,'error');assert.match(failed.err,/Document reading.*time limit/);
  assert.equal(failed.pages.length,0);assert.equal(failed.readController,undefined);
  assert.equal(context.INT.docs[1].pages[0].text,'Next file');assert.equal(clock.timers.size,0);
  blocked.reject(Error('late browser read failure'));await Promise.resolve();
});

test('late non-cancellable reader writes cannot replace a timed-out document or its progress',async()=>{
  const {context,run,counters,file}=setup(),clock=readingTimers(context),blocked=deferred();let staged;
  const read=context.intRead;context.intRead=(doc,input,scope)=>input.name==='late.txt'?(staged=doc,blocked.promise.then(()=>{
    doc.pages.push({n:1,text:'Late content'});doc.images.push({n:1,blob:'Late image'});doc.scans=1;doc.warn='Late warning';doc.status='ready';
  })):read(doc,input,scope);
  context.files=[file('late.txt'),file('current.txt')];const pending=run('intAdd(files)');await until(()=>staged);clock.expireDocument();
  await until(()=>context.INT.docs[1]?.status==='ready');await pending;
  const failed=context.INT.docs[0],error=failed.err,renders=counters.draw;assert.notEqual(staged,failed);
  blocked.resolve();for(let i=0;i<20;i++)await Promise.resolve();
  assert.equal(failed.status,'error');assert.equal(failed.err,error);assert.equal(failed.pages.length,0);assert.equal(failed.images.length,0);assert.equal(failed.scans,0);assert.equal(failed.warn,'');
  assert.equal(counters.draw,renders);assert.equal(context.INT.docs[1].status,'ready');assert.equal(clock.timers.size,0);
});

test('removing a stalled document settles immediately and allows the remaining batch to proceed',async()=>{
  const {context,run,counters,file}=setup(),clock=readingTimers(context),blocked=deferred();let reads=0;
  context.files=[{name:'removed.txt',size:1,text:()=>{reads++;return blocked.promise;}},file('remaining.txt')];
  const pending=run('intAdd(files)');await until(()=>reads===1);const removed=context.INT.docs[0];context.removed=removed;
  run('iReadCancelDocument(removed)');await until(()=>context.INT.docs[0]?.status==='ready');await pending;
  assert.equal(context.INT.docs.length,1);assert.equal(context.INT.docs[0].name,'remaining.txt');assert.equal(removed.readController,undefined);
  const renders=counters.draw;blocked.resolve('Late removed content');for(let i=0;i<20;i++)await Promise.resolve();
  assert.equal(removed.pages.length,0);assert.equal(counters.draw,renders);assert.equal(clock.timers.size,0);
});

test('a whole-document deadline still destroys an in-flight PDF and permits the next file',async()=>{
  const {context,run,counters,pdf,file}=setup(),clock=readingTimers(context),blocked=deferred();let textReads=0,cleanups=0;
  pdf.getPage=async()=>({getTextContent(){textReads++;return blocked.promise;},cleanup(){cleanups++;}});
  context.files=[{name:'stalled.pdf',size:1,arrayBuffer:async()=>new ArrayBuffer(1)},file('after-pdf.txt')];
  const pending=run('intAdd(files)');await until(()=>textReads===1);clock.expireDocument();
  await until(()=>context.INT.docs[1]?.status==='ready');await pending;await until(()=>counters.pdfDestroy===1);
  assert.equal(context.INT.docs[0].status,'error');assert.equal(context.INT.docs[0].pages.length,0);assert.equal(cleanups,1);
  blocked.resolve({items:[]});for(let i=0;i<20;i++)await Promise.resolve();assert.equal(counters.pdfDestroy,1);assert.equal(clock.timers.size,0);
});

test('a scanned PDF waiting on provider limits is destroyed at the document deadline',async()=>{
  const {context,run,counters,pdf,file}=setup(),clock=readingTimers(context),blocked=deferred();let preparing=0,renders=0;
  pdf.getPage=async()=>({getTextContent:async()=>({items:[]}),cleanup(){}});
  context.intLimits=()=>{preparing++;return blocked.promise;};context.intRenderPage=async()=>{renders++;return 'Late scan';};
  context.files=[{name:'scan.pdf',size:1,arrayBuffer:async()=>new ArrayBuffer(1)},file('after-scan.txt')];
  const pending=run('intAdd(files)');await until(()=>preparing===1);clock.expireDocument();
  await until(()=>context.INT.docs[1]?.status==='ready');await pending;await until(()=>counters.pdfDestroy===1);
  assert.equal(context.INT.docs[0].status,'error');assert.equal(context.INT.docs[0].images.length,0);assert.equal(renders,0);
  blocked.resolve({images:{maxInputBytes:4000000}});for(let i=0;i<30;i++)await Promise.resolve();
  assert.equal(counters.pdfDestroy,1);assert.equal(renders,0);assert.equal(context.INT.docs[0].images.length,0);assert.equal(clock.timers.size,0);
});

test('PDF page limits reject oversized or malformed documents before extracting a page and clean resources',async()=>{
  for(const count of [301,1000000,0,NaN]){
    const {context,run,counters,pdf}=setup();pdf.numPages=count;context.bytes=new ArrayBuffer(1);
    await assert.rejects(run('intPdf(bytes)'),/300-page/);assert.equal(counters.pdfPages,0);assert.equal(counters.pdfDestroy,1);
  }
});

test('PDF intake releases its document after success and after extraction errors',async()=>{
  const {context,run,counters,pdf}=setup();context.doc={ext:'pdf',pages:[],images:[]};context.file={name:'valid.pdf',size:1,arrayBuffer:async()=>new ArrayBuffer(1)};
  await run('intRead(doc,file)');assert.equal(context.doc.pages.length,1);assert.equal(counters.pdfDestroy,1);
  const failing=setup();failing.context.doc={ext:'pdf',pages:[],images:[]};failing.context.file=context.file;
  failing.pdf.getPage=async()=>{throw Error('broken page');};
  await assert.rejects(failing.run('intRead(doc,file)'),/broken page/);assert.equal(failing.counters.pdfDestroy,1);
});

test('template selection publishes only the latest success/error and clearing invalidates pending reads',async()=>{
  const {context,run}=setup(),a=deferred(),b=deferred();context.a={name:'A.xlsx',arrayBuffer:()=>a.promise};context.b={name:'B.xlsx',arrayBuffer:()=>b.promise};
  const old=run('axeReadTemplate(a)'),latest=run('axeReadTemplate(b)');b.resolve({name:'B property'});await latest;a.resolve({name:'A property'});await old;
  assert.equal(context.AXE.file,'B.xlsx');assert.equal(context.AXE.T.property,'B property');assert.equal(context.AXE.busy,false);
  const stale=deferred();context.a={name:'old.xlsx',arrayBuffer:()=>stale.promise};const pending=run('axeReadTemplate(a)');run('iReadTemplateClear()');stale.reject(Error('late failure'));await pending;
  assert.equal(context.AXE.T,null);assert.equal(context.AXE.err,'');assert.equal(context.AXE.busy,false);
  context.a={name:'bad.xlsx',arrayBuffer:async()=>{throw Error('current failure');}};await run('axeReadTemplate(a)');assert.equal(context.AXE.err,'current failure');assert.equal(context.AXE.busy,false);
});

test('Workbook import selection ignores stale successes/errors and discard invalidates pending work',async()=>{
  const {context,run}=setup(),a=deferred(),b=deferred();context.a={name:'A.xlsx',arrayBuffer:()=>a.promise};context.b={name:'B.xlsx',arrayBuffer:()=>b.promise};
  const old=run('axReadFile(a)'),latest=run('axReadFile(b)');b.resolve({name:'B property'});await latest;a.resolve({name:'A property'});await old;
  assert.equal(context.AXU.file,'B.xlsx');assert.equal(context.AXU.I.S.name,'B property');assert.equal(context.AXU.busy,false);
  const stale=deferred();context.a={name:'old.xlsx',arrayBuffer:()=>stale.promise};const pending=run('axReadFile(a)');run('clearWorkbookImport()');stale.reject(Error('late failure'));await pending;
  assert.equal(context.AXU.I,null);assert.equal(context.AXU.err,'');assert.equal(context.AXU.busy,false);
});

test('shared-property previews correlate filenames/results and ignore completion after dismissal or open',async()=>{
  const {context,run}=setup(),a=deferred(),b=deferred();context.a={name:'A.json',promise:a.promise};context.b={name:'B.json',promise:b.promise};
  const old=run('iReadPropertyPreview(a)'),latest=run('iReadPropertyPreview(b)');b.resolve({property:'B'});await latest;a.resolve({property:'A'});await old;
  assert.equal(context.PF_IMPORT.file,'B.json');assert.equal(context.PF_IMPORT.r.property,'B');
  const stale=deferred();context.a={name:'old.json',promise:stale.promise};const pending=run('iReadPropertyPreview(a)');run('iReadPreviewClear()');stale.reject(Error('late failure'));await pending;assert.equal(context.PF_IMPORT,null);
  const opening=deferred();context.a={name:'opening.json',promise:opening.promise};const loading=run('iReadPropertyPreview(a)');await run(`pfOpen({name:'Chosen model'})`);opening.resolve({property:'late'});await loading;
  assert.equal(context.PF_IMPORT,null);assert.equal(context.adopted.name,'Chosen model');
});

test('pasted documents share byte/count budgets and retain the original paste after rejection',()=>{
  const {context,run}=setup();context.INT.paste='  Café 東京  ';
  assert.equal(run('iReadAddPastedText()'),true);assert.equal(context.INT.paste,'');
  assert.equal(context.INT.docs[0].pages[0].text,'Café 東京');assert.equal(context.INT.docs[0].size,new TextEncoder().encode('Café 東京').length);
  context.INT.docs=Array.from({length:50},()=>({size:1}));context.INT.paste='keep this';
  assert.equal(run('iReadAddPastedText()'),false);assert.equal(context.INT.paste,'keep this');assert.match(context.INT.err,/50 documents/);
  context.INT.docs=[];context.intBytes=()=>32*MiB+1;
  assert.equal(run('iReadAddPastedText()'),false);assert.equal(context.INT.paste,'keep this');assert.match(context.INT.err,/32 MiB/);assert.equal(context.INT.docs.length,0);
  context.intBytes=text=>new TextEncoder().encode(text).length;context.INT.docs=[{size:128*MiB-3}];context.INT.paste='€';
  assert.equal(run('iReadAddPastedText()'),true);assert.equal(context.INT.docs[1].size,3);
  context.INT.paste='a';assert.equal(run('iReadAddPastedText()'),false);assert.equal(context.INT.paste,'a');assert.match(context.INT.err,/128 MiB/);
});

test('image conversion closes its ImageBitmap after success or a drawing failure',async()=>{
  const {context,run}=setup();let closed=0,created=0;
  const header=new Uint8Array(33);header.set([137,80,78,71,13,10,26,10]);header.set([73,72,68,82],12);
  const view=new DataView(header.buffer);view.setUint32(8,13);view.setUint32(16,3400);view.setUint32(20,1700);
  context.createImageBitmap=async()=>{created++;return {width:3400,height:1700,close:()=>closed++};};
  context.intCanvasBlob=async draw=>{draw({drawImage(){}});return 'encoded image';};
  context.file=new Blob([header],{type:'image/png'});context.limits={images:{maxInputBytes:1,mediaTypes:['image/jpeg']}};
  assert.equal(await run('intFitImage(file,limits)'),'encoded image');assert.equal(created,1);assert.equal(closed,1);
  context.intCanvasBlob=async()=>{throw Error('drawing failed');};
  await assert.rejects(run('intFitImage(file,limits)'),/drawing failed/);assert.equal(closed,2);
  context.limits={images:{maxInputBytes:100,mediaTypes:['image/png']}};assert.equal(await run('intFitImage(file,limits)'),context.file);assert.equal(created,2);
});
