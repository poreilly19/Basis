const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const zlib=require('node:zlib');
const {test}=require('node:test');
const {DOMParser,XMLSerializer}=require('./office_dom.cjs');

const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'src/office_zip.js'),'utf8'),html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const functionText=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a,'Office ZIP adapter boundaries must exist');return html.slice(a,b);};
const adapters=functionText('async function intUnzip(buf){','const intXML=')+functionText('const intXML=','// ---- Word:')+functionText('async function x4Unzip(buf){','// Assemble with verified workbook defaults')+functionText('function x4CellXml(','/* ---- XL4ADW input workbook');
function setup(overrides={}){
  const context=vm.createContext({TextEncoder,TextDecoder,Uint8Array,Uint32Array,ArrayBuffer,DataView,Blob,DecompressionStream,DOMParser,XMLSerializer,...overrides});
  vm.runInContext(source+'\n'+adapters,context,{filename:'basis-office-zip.js'});
  const run=s=>vm.runInContext(s,context);
  return {context,run,open:bytes=>{context.input=bytes;return run('officeZipOpen(input)');}};
}

// Independent binary fixtures: write ZIP records directly and use Node zlib,
// never the application's ZIP writer or its CRC implementation.
function crc32(bytes){let c=-1;for(const value of bytes){c^=value;for(let bit=0;bit<8;bit++)c=(c>>>1)^((c&1)*0xedb88320);}return(c^-1)>>>0;}
function zip(entries,{comment=''}={}){
  const locals=[],directory=[];let offset=0;
  for(const entry of entries){
    const name=Buffer.from(entry.name),data=Buffer.from(entry.data??''),method=entry.method??8,compressed=method===8?zlib.deflateRawSync(data):data;
    const flags=0x800|(entry.descriptor?8:0)|(entry.levelFlags??0),crc=entry.crc??crc32(data),raw=entry.raw??data.length,extra=Buffer.from(entry.extra??[]),note=Buffer.from(entry.comment??'');
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(flags,6);local.writeUInt16LE(method,8);
    if(!entry.descriptor){local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(raw,22);}
    local.writeUInt16LE(name.length,26);local.writeUInt16LE(extra.length,28);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(flags,8);central.writeUInt16LE(method,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(raw,24);central.writeUInt16LE(name.length,28);central.writeUInt16LE(extra.length,30);central.writeUInt16LE(note.length,32);central.writeUInt32LE(offset,42);
    let descriptor=Buffer.alloc(0);
    if(entry.descriptor){descriptor=Buffer.alloc(entry.descriptor==='unsigned'?12:16);let p=0;if(descriptor.length===16){descriptor.writeUInt32LE(0x08074b50,0);p=4;}descriptor.writeUInt32LE(crc,p);descriptor.writeUInt32LE(compressed.length,p+4);descriptor.writeUInt32LE(raw,p+8);}
    locals.push(local,name,extra,compressed,descriptor);directory.push(central,name,extra,note);offset+=local.length+name.length+extra.length+compressed.length+descriptor.length;
  }
  const end=Buffer.alloc(22),note=Buffer.from(comment),central=Buffer.concat(directory);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);end.writeUInt16LE(note.length,20);
  return Buffer.concat([...locals,central,end,note]);
}
function layout(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),end=bytes.length-22,central=view.getUint32(end+16,true),records=[];let p=central;
  for(let i=0;i<view.getUint16(end+10,true);i++){const local=view.getUint32(p+42,true),start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);records.push({central:p,local,start});p+=46+view.getUint16(p+28,true)+view.getUint16(p+30,true)+view.getUint16(p+32,true);}
  return {view,end,central,records};
}
function changed(bytes,fn){const copy=Buffer.from(bytes);fn(layout(copy),copy);return copy;}

test('Office readers preserve compressed XML, shared strings, comments, Unicode paths and directory entries',async()=>{
  const parts=[
    {name:'[Content_Types].xml',data:'<Types/>'},
    {name:'_rels/',method:0},{name:'xl/'},
    {name:'xl/workbook.xml',data:'<workbook/>'},
    {name:'xl/_rels/workbook.xml.rels',data:'<Relationships/>'},
    {name:'xl/sharedStrings.xml',data:'<sst><si><t>Café 東京 &amp; Co.</t></si></sst>'},
    {name:'xl/comments/comment1.xml',data:'<comments/>'},
    {name:'word/document.xml',data:'<document><body>Lease</body></document>'},
    {name:'ppt/slides/slide1.xml',data:'<slide/>'},
    {name:'docProps/東京.xml',data:'<properties/>',method:0}
  ];
  const bytes=zip(parts),{context,run}=setup();context.input=bytes;
  const intake=await run('intUnzip(input)');
  assert.deepEqual(Array.from(intake.names),parts.map(p=>p.name));
  for(const part of parts)assert.equal(await intake.text(part.name),part.data??'');
  assert.equal(await intake.text('missing.xml'),null);
  context.inflate=()=>{throw Error('Unbounded callback must not be used');};
  const workbook=await run('x4Unzip(input,inflate)');
  assert.deepEqual(Array.from(workbook,p=>({name:p.name,data:Buffer.from(p.data).toString()})),parts.map(p=>({name:p.name,data:p.data??''})));
});

test('Office ZIP supports signed/unsigned descriptors, benign extra fields and comments',async()=>{
  const {open}=setup();
  for(const descriptor of ['signed','unsigned']){
    const archive=open(zip([{name:'xl/workbook.xml',data:'<workbook/>',descriptor,levelFlags:2,extra:[0x55,0x54,1,0,0],comment:'part comment'}],{comment:'archive comment PK\u0005\u0006'}));
    assert.equal(Buffer.from(await archive.read('xl/workbook.xml')).toString(),'<workbook/>');
  }
});

test('Office ZIP rejects malformed end, directory and local ranges before decoding',()=>{
  const {open}=setup(),base=zip([{name:'xl/workbook.xml',data:'<workbook/>'}]);
  const changes=[
    ({view,end})=>view.setUint32(end+16,0xffffff00,true),
    ({view,end})=>view.setUint32(end+12,1,true),
    ({view,records})=>view.setUint16(records[0].central+28,65535,true),
    ({view,records})=>view.setUint32(records[0].central+42,0xffffff00,true),
    ({view,records})=>view.setUint32(records[0].central+20,0xffffff00,true),
    ({view,records})=>view.setUint16(records[0].local+26,65535,true)
  ];
  assert.throws(()=>open(base.subarray(0,10)),/Office ZIP/);
  assert.throws(()=>open(base.subarray(0,base.length-1)),/Office ZIP/);
  for(const mutate of changes)assert.throws(()=>open(changed(base,mutate)),/Office ZIP/);
});

test('Office ZIP verifies checksums, local metadata and data descriptors',async()=>{
  const {open}=setup(),stored=zip([{name:'xl/workbook.xml',data:'<workbook/>',method:0}]);
  const corrupt=changed(stored,({records},bytes)=>{bytes[records[0].start]^=1;});
  await assert.rejects(open(corrupt).read('xl/workbook.xml'),/checksum/);
  const mismatches=[
    ({view,records})=>view.setUint32(records[0].local+14,0,true),
    ({view,records})=>view.setUint32(records[0].local+22,99,true),
    ({view,records})=>view.setUint16(records[0].local+8,8,true),
    ({view,records})=>view.setUint16(records[0].local+6,1,true),
    ({records},bytes)=>{bytes[records[0].local+30]^=1;}
  ];
  for(const mutate of mismatches)assert.throws(()=>open(changed(stored,mutate)),/Office ZIP/);
  const descriptor=zip([{name:'word/document.xml',data:'<document/>',descriptor:'signed'}]);
  assert.throws(()=>open(changed(descriptor,({view,central})=>view.setUint32(central-4,0,true))),/data descriptor/);
  assert.throws(()=>open(changed(stored,({view,records})=>{view.setUint16(records[0].local+6,0x808,true);view.setUint16(records[0].central+8,0x808,true);})),/data descriptor/);
});

test('Office ZIP rejects unsafe/duplicate paths, encryption, unsupported methods, disks and ZIP64',()=>{
  const {open}=setup();
  for(const name of ['../word/document.xml','/xl/workbook.xml','xl/../workbook.xml','xl\\workbook.xml','C:/xl/workbook.xml','xl//sheet.xml','xl/./sheet.xml'])assert.throws(()=>open(zip([{name,data:'x'}])),/Unsafe Office ZIP path/);
  assert.throws(()=>open(zip([{name:'xl/'},{name:'xl/'}])),/Duplicate/);
  assert.throws(()=>open(zip([{name:'xl/',data:'not a directory'}])),/directory contains/);
  const base=zip([{name:'xl/workbook.xml',data:'<workbook/>'}]);
  for(const mutate of [
    ({view,records})=>view.setUint16(records[0].central+8,1,true),
    ({view,records})=>view.setUint16(records[0].central+10,12,true),
    ({view,records})=>view.setUint16(records[0].central+34,1,true),
    ({view,end})=>view.setUint16(end+4,1,true)
  ])assert.throws(()=>open(changed(base,mutate)),/Unsupported Office ZIP/);
  assert.throws(()=>open(zip([{name:'xl/workbook.xml',data:'x',extra:[1,0,0,0]}])),/ZIP64/);
  assert.throws(()=>open(zip([{name:'xl/workbook.xml',data:'x',extra:[9,0,2,0]}])),/extra field/);
});

test('Office ZIP rejects overlapping local records',()=>{
  const {open}=setup(),inner=zip([{name:'xl/workbook.xml',data:'<workbook/>'}]),innerLayout=layout(inner);
  const outer=zip([{name:'payload.bin',data:inner.subarray(0,innerLayout.central),method:0},{name:'xl/workbook.xml',data:'<workbook/>'}]);
  assert.throws(()=>open(changed(outer,({view,records})=>view.setUint32(records[1].central+42,records[0].start,true))),/Overlapping/);
});

test('Office ZIP preflights compressed input, per-entry output, total output and entry count limits',()=>{
  const {open}=setup();
  assert.throws(()=>open(new Uint8Array(64*1024*1024+1)),/64 MiB/);
  assert.throws(()=>open(zip([{name:'xl/workbook.xml',raw:32*1024*1024+1}])),/32 MiB/);
  assert.throws(()=>open(zip(Array.from({length:5},(_,i)=>({name:`xl/part${i}.xml`,raw:32*1024*1024})))),/128 MiB/);
  const base=zip([{name:'xl/workbook.xml',data:'<workbook/>'}]);
  assert.throws(()=>open(changed(base,({view,end})=>{view.setUint16(end+8,4097,true);view.setUint16(end+10,4097,true);})),/entry count/);
});

test('Office ZIP stops DEFLATE expansion when it exceeds the declared raw size',async()=>{
  const {open}=setup(),archive=open(zip([{name:'xl/sharedStrings.xml',data:Buffer.alloc(1024*1024,97),raw:16}]));
  await assert.rejects(archive.read('xl/sharedStrings.xml'),/expanded size exceeds/);
});

test('Office ZIP rejects an undersized DEFLATE payload even when its CRC matches',async()=>{
  const {open}=setup(),archive=open(zip([{name:'xl/workbook.xml',data:'<workbook/>',raw:100}]));
  await assert.rejects(archive.read('xl/workbook.xml'),/checksum or size/);
});

test('Office ZIP caches concurrent reads and reports unsupported browser compression clearly',async()=>{
  let decoders=0;
  class CountedDecoder extends DecompressionStream{constructor(format){super(format);decoders++;}}
  const bytes=zip([{name:'xl/workbook.xml',data:'<workbook/>'}]),archive=setup({DecompressionStream:CountedDecoder}).open(bytes);
  const [first,second]=await Promise.all([archive.read('xl/workbook.xml'),archive.read('xl/workbook.xml')]);
  assert.equal(first,second);assert.equal(decoders,1);
  assert.equal(await archive.read('xl/workbook.xml'),first);assert.equal(decoders,1);
  await assert.rejects(setup({DecompressionStream:undefined}).open(bytes).read('xl/workbook.xml'),/not supported in this browser/);
});

test('Office file buffering rejects oversized inputs before reading and rechecks actual bytes',async()=>{
  const {context,run}=setup();let reads=0;
  context.file={size:64*1024*1024+1,arrayBuffer:async()=>{reads++;return new ArrayBuffer(0);}};
  await assert.rejects(run('officeFileBuffer(file)'),/64 MiB/);assert.equal(reads,0);
  context.file={size:1,arrayBuffer:async()=>{reads++;return new ArrayBuffer(64*1024*1024+1);}};
  await assert.rejects(run('officeFileBuffer(file)'),/64 MiB/);assert.equal(reads,1);
  const buffer=new ArrayBuffer(4);context.file={size:4,arrayBuffer:async()=>buffer};
  assert.equal(await run('officeFileBuffer(file)'),buffer);
});

test('Office eager verification checks every part, including unused binary attachments',async()=>{
  const {context,run}=setup(),base=zip([{name:'xl/workbook.xml',data:'<workbook/>'},{name:'xl/media/image.bin',data:'binary attachment',method:0}]);
  context.input=changed(base,({records},bytes)=>{bytes[records[1].start]^=1;});
  await assert.rejects(run('officeZipVerify(input)'),/checksum/);
  context.input=base;const archive=await run('officeZipVerify(input)');
  assert.equal(archive.names.length,2);
});

const stringCell=(ref,text)=>`<c r="${ref}" t="inlineStr"><is><t>${text}</t></is></c>`;
function template(sheets={}){
  const names=['PropertyAssets','Leases'],parts=[
    {name:'xl/workbook.xml',data:`<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name,i)=>`<sheet name="${name}" r:id="r${i}"/>`).join('')}</sheets></workbook>`},
    {name:'xl/_rels/workbook.xml.rels',data:`<Relationships>${names.map((_,i)=>`<Relationship Id="r${i}" Target="worksheets/sheet${i}.xml"/>`).join('')}</Relationships>`}
  ];
  names.forEach((name,i)=>parts.push({name:`xl/worksheets/sheet${i}.xml`,data:`<worksheet><sheetData>${sheets[name]??`<row r="1">${stringCell('A1','COL')}${stringCell('B1','Name')}${stringCell('C1','Property_ExternalID')}</row><row r="2">${stringCell('B2',name==='PropertyAssets'?'Office Asset':'Tenant')}${stringCell('C2','asset')}</row>`}</sheetData></worksheet>`}));
  return zip(parts);
}
function readTemplate(bytes){const {context,run}=setup();context.input=bytes;return run('x4ReadTemplate(input)');}

test('XL4ADW parser keeps ordinary headers, typed cells, dates and property identifiers',async()=>{
  const model=await readTemplate(template());
  assert.equal(model.property,'Office Asset');assert.equal(model.propertyId,'asset');
  assert.deepEqual(Array.from(model.order),['PropertyAssets','Leases']);
  assert.deepEqual(Array.from(model.sheets.Leases.rows[0]),[null,'Tenant','asset']);
  const {run}=setup();
  const cells=run(`x4Cells('<c r="A1"><v>1e-9</v></c><c r="B1" s="1"><v>46000</v></c>',[],new Set([1]))`);
  assert.equal(cells[0].val,1e-9);
  assert.equal(cells[1].val.d,new Date(Date.UTC(1899,11,30)+46000*86400000).toISOString().slice(0,10));
  assert.deepEqual(Array.from(run(`x4Cells('<c><v>1</v></c><c><v>2</v></c>',[],new Set())`),c=>c.j),[0,1]);
});

test('XL4ADW parser rejects sparse, malformed, mismatched and duplicate references before allocation',async()=>{
  for(const xml of [
    '<row r="4000000000"><c r="A1"><v>1</v></c></row>',
    '<row r="1"><c r="ZZZZZZ1"><v>1</v></c></row>',
    '<row r="1"><c r="XFD1"><v>1</v></c></row>',
    '<row r="1"><c r="A100001"><v>1</v></c></row>',
    '<row r="1"><c r="A2"><v>1</v></c></row>',
    '<row r="1"><c r="A1"/><c r="A1"/></row>',
    '<row r="1"/><row r="1"/>',
    '<row r=""><c r="A1"/></row>',
    '<row r="1"><c r=""/></row>',
    '<row r="1"><c r=A1/></row>',
    '<row r=1><c r="A1"/></row>'
  ])await assert.rejects(readTemplate(template({PropertyAssets:xml})),/Workbook|workbook/);
});

test('XL4ADW parser applies one two-million-cell bounding budget across all sheets',async()=>{
  await assert.rejects(readTemplate(template({PropertyAssets:'<row r="100000"><c r="V100000"><v>1</v></c></row>'})),/two-million-cell/);
  await assert.rejects(readTemplate(template({
    PropertyAssets:'<row r="50000"><c r="T50000"><v>1</v></c></row>',
    Leases:'<row r="60000"><c r="T60000"><v>1</v></c></row>'
  })),/two-million-cell/);
});

test('workbook date and numeric errors are recoverable instead of producing invalid dates',()=>{
  const {run,context}=setup();
  for(const value of ['1e999','not-a-number','-1','2958466']){
    context.xml=`<c r="A1" s="1"><v>${value}</v></c>`;
    assert.throws(()=>run('x4Cells(xml,[],new Set([1]))'),/invalid numeric cell|invalid Excel date serial/);
  }
  assert.throws(()=>run(`officeSheetDate(Infinity)`),/invalid Excel date/);
  assert.throws(()=>run(`officeSheetDate(NaN)`),/invalid Excel date/);
});

// Independently specified OOXML parts; the ZIP fixture writer above is separate
// from Basis. Expected dates below are calendar facts, not parser round trips.
function epochTemplate(setting='0',{serial=45000,style=1}={}){
  const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships',names=['PropertyAssets','Leases'];
  return zip([
    {name:'[Content_Types].xml',data:'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'},
    {name:'xl/workbook.xml',data:`<workbook xmlns="${ns}" xmlns:r="${rel}">${setting===null?'':`<workbookPr date1904="${setting}"/>`}<sheets>${names.map((name,i)=>`<sheet name="${name}" r:id="r${i}" sheetId="${i+1}"/>`).join('')}</sheets></workbook>`},
    {name:'xl/_rels/workbook.xml.rels',data:`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_,i)=>`<Relationship Id="r${i}" Type="${rel}/worksheet" Target="worksheets/sheet${i}.xml"/>`).join('')}</Relationships>`},
    {name:'xl/styles.xml',data:`<styleSheet xmlns="${ns}"><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>`},
    ...names.map((name,i)=>({name:`xl/worksheets/sheet${i}.xml`,data:`<worksheet xmlns="${ns}"><sheetData><row r="1">${stringCell('A1','COL')}${stringCell('B1','Name')}${stringCell('C1','Property_ExternalID')}${stringCell('D1','Date')}</row><row r="2">${stringCell('B2',name)}${stringCell('C2','asset')}<c r="D2" s="${style}"><v>${serial}</v></c></row></sheetData></worksheet>`}))
  ]);
}

test('date epochs use OOXML booleans and independent calendar dates without changing 1900 behavior',()=>{
  const {context,run}=setup();
  for(const [serial,date1904,expected] of [[0,false,'1899-12-30'],[60,false,'1900-02-28'],[61,false,'1900-03-01'],[45000,false,'2023-03-15'],[0,true,'1904-01-01'],[1,true,'1904-01-02'],[45000,true,'2027-03-16'],[2957003,true,'9999-12-31']]){
    context.args={serial,date1904};assert.equal(run('officeSheetDate(args.serial,false,args.date1904)'),expected);
  }
  for(const [setting,expected] of [[null,false],[undefined,false],['0',false],['false',false],['1',true],['true',true],[' true ',true]]){
    context.setting=setting;assert.equal(run('officeSheetDate1904(setting)'),expected);
  }
  for(const setting of ['', 'TRUE','yes','2']){context.setting=setting;assert.throws(()=>run('officeSheetDate1904(setting)'),/invalid date1904/);}
  assert.equal(run('officeSheetDate(45000.75,false,true)'),'2027-03-16');
  assert.equal(run('officeSheetDate(45000.75,true,true)'),'2027-03-17');
  for(const serial of [-1,2957004,Infinity,NaN]){context.serial=serial;assert.throws(()=>run('officeSheetDate(serial,false,true)'),/invalid Excel date/);}
});

test('independent 1904 OOXML workbooks import dates in both custom readers and keep ordinary numbers',async()=>{
  for(const setting of ['1','true','0','false',null]){
    const {context,run}=setup();context.input=epochTemplate(setting);
    const template=await run('x4ReadTemplate(input)'),sheets=await run('(async()=>intXlsx(await intUnzip(input)))()');
    const expected=setting==='1'||setting==='true'?'2027-03-16':'2023-03-15';
    assert.equal(template.sheets.Leases.rows[0][3].d,expected);
    assert.equal(sheets.find(s=>s.name==='Leases').rows[1][3],expected);
    context.input=epochTemplate(setting,{style:0});
    const ordinary=await run('x4ReadTemplate(input)'),text=await run('(async()=>intXlsx(await intUnzip(input)))()');
    assert.equal(ordinary.sheets.Leases.rows[0][3],45000);assert.equal(text[1].rows[1][3],'45000');
  }
  for(const serial of [0,1]){const {context,run}=setup();context.input=epochTemplate('1',{serial});
    const parsed=await run('(async()=>intXlsx(await intUnzip(input)))()');assert.equal(parsed[1].rows[1][3],serial?'1904-01-02':'1904-01-01');}
  for(const setting of ['', 'yes','TRUE'])await assert.rejects(readTemplate(epochTemplate(setting)),/invalid date1904/);
  await assert.rejects(readTemplate(epochTemplate('true',{serial:2957004})),/invalid Excel date/);
});

test('XL4ADW exports preserve each template epoch and write the corresponding date serial',async()=>{
  for(const setting of ['1','true','0','false',null]){
    const {context,run}=setup();context.input=epochTemplate(setting);context.T=await run('x4ReadTemplate(input)');
    const epoch1904=setting==='1'||setting==='true';
    context.expected='2027-03-16';
    assert.match(run('x4CellXml("D2",{d:expected},1,T)'),new RegExp(`<v>${epoch1904?45000:46462}</v>`));
    context.A={sheets:{PropertyAssets:[[null,'PropertyAssets','asset',{d:context.expected}]],Leases:[[null,'Leases','asset',{d:context.expected}]]}};
    context.output=await run('x4WriteWorkbook(T,A,null)');
    const updated=await run('x4ReadTemplate(output)');
    assert.equal(updated.date1904,epoch1904);assert.equal(updated.sheets.Leases.rows[0][3].d,'2027-03-16');
    const archive=run('officeZipOpen(output)'),workbook=Buffer.from(await archive.read('xl/workbook.xml')).toString();
    assert.equal(workbook.includes(`date1904="${setting}"`),setting!==null);
  }
});

test('template export replaces old rows once across XML variants and preserves unrelated workbook metadata',async()=>{
  const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',pkg='http://schemas.openxmlformats.org/package/2006/relationships',rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const mc='http://schemas.openxmlformats.org/markup-compatibility/2006';
  const sheet=`<worksheet xmlns="${ns}"><sheetPr codeName="KeepThis"/><dimension ref="A1:D6"/><cols><col min="2" max="2" width="25" customWidth="1"/></cols><sheetData xmlns:mc="${mc}" xmlns:custom="urn:producer" mc:Ignorable="custom" custom:meta="keep-sheetData">`+
    `<row r="1" custom:note="keep-header">${stringCell('A1','VERSION')}${stringCell('B1','15.0')}</row>`+
    `<row r="4">${stringCell('A4','TIMESTAMP')}${stringCell('B4','OLD STAMP')}</row>`+
    `<row r="5">${stringCell('A5','COL')}${stringCell('B5','Name')}${stringCell('C5','Property_ExternalID')}${stringCell('D5','Amount')}</row>`+
    `<row r="6">${stringCell('B6','OLD DATA')}${stringCell('C6','asset')}<c r="D6" s="1"><v>10</v></c></row></sheetData>`+
    `<dataValidations count="1"><dataValidation type="list" sqref="B6:B9"><formula1>Values!$A$1:$A$2</formula1></dataValidation></dataValidations>`+
    `<extLst><ext uri="urn:fixture"><f:marker xmlns:f="urn:metadata" f:value="keep">Unchanged</f:marker></ext></extLst></worksheet>`;
  const baseline={
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/calcChain.xml" ContentType="application/test-chain"/><Override PartName="/xl/styles.xml" ContentType="application/test-styles"/></Types>',
    'xl/workbook.xml':`<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets><sheet name="PropertyAssets" sheetId="1" r:id="property"/><sheet name="Leases" sheetId="2" r:id="leases"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':`<Relationships xmlns="${pkg}"><Relationship Id="property" Type="${rel}/worksheet" Target="worksheets/property.xml"/><Relationship Id="leases" Type="${rel}/worksheet" Target="worksheets/leases.xml"/><Relationship Id="style" Type="${rel}/styles" Target="styles.xml"/><Relationship Id="chain" Type="${rel}/calcChain" Target="calcChain.xml"/></Relationships>`,
    'xl/worksheets/property.xml':sheet,'xl/worksheets/leases.xml':sheet,
    'xl/styles.xml':`<styleSheet xmlns="${ns}"><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="0"/></cellXfs></styleSheet>`,
    'xl/calcChain.xml':`<calcChain xmlns="${ns}"/>`
  };
  const prefix=(xml,tag)=>xml.replace('xmlns=','xmlns:'+tag+'=').replace(/<(\/?)([A-Za-z_][\w.-]*)(?=[\s/>])/g,'<$1'+tag+':$2');
  const variants=[baseline,
    Object.fromEntries(Object.entries(baseline).map(([name,xml])=>[name,xml.replace(/"/g,"'")])),
    {...baseline,'xl/workbook.xml':baseline['xl/workbook.xml'].replace(/<sheet\b([^>]*?)\/>/g,'<sheet$1></sheet>'),'xl/_rels/workbook.xml.rels':baseline['xl/_rels/workbook.xml.rels'].replace(/<Relationship\b([^>]*?)\/>/g,'<Relationship$1></Relationship>')},
    Object.fromEntries(Object.entries(baseline).map(([name,xml])=>[name,prefix(xml,'s')])),
    {...baseline,'xl/worksheets/property.xml':sheet.replace('<row r="1"','<row'),'xl/worksheets/leases.xml':sheet.replace('<row r="1"','<row')},
    {...baseline,'xl/_rels/workbook.xml.rels':baseline['xl/_rels/workbook.xml.rels'].replace(/Target="worksheets\//g,'Target="./worksheets/')}
  ];
  for(const parts of variants){
    const {context,run}=setup();context.input=zip(Object.entries(parts).map(([name,data])=>({name,data})));
    context.T=await run('x4ReadTemplate(input)');context.A={sheets:{PropertyAssets:[[null,'New & <Name>','new-asset',1250.75]],Leases:[[null,'New Tenant','new-asset',12.75]]}};
    context.output=await run('x4WriteWorkbook(T,A,null,"NEW & <STAMP>")');
    const result=await run('x4ReadTemplate(output)');
    assert.equal(result.sheets.PropertyAssets.rows.length,1);assert.equal(result.sheets.Leases.rows.length,1);
    assert.equal(result.sheets.PropertyAssets.rows[0][1],'New & <Name>');assert.equal(result.sheets.PropertyAssets.rows[0][3],1250.75);
    assert.equal(result.sheets.Leases.rows[0][1],'New Tenant');assert.equal(result.sheets.Leases.rows[0][3],12.75);
    assert.equal(result.sheets.PropertyAssets.head.VERSION,'15.0');assert.equal(result.sheets.PropertyAssets.head.TIMESTAMP,'NEW & <STAMP>');
    assert.equal(result.sheets.PropertyAssets.style[3],1);
    const archive=run('officeZipOpen(output)'),read=async name=>Buffer.from(await archive.read(name)).toString();
    const xml=await read('xl/worksheets/property.xml');assert.ok(!xml.includes('OLD DATA'));
    const doc=new DOMParser().parseFromString(xml),tags=name=>doc.getElementsByTagNameNS('*',name);
    assert.equal(tags('sheetData')[0].getAttribute('xmlns:mc'),mc);assert.equal(tags('sheetData')[0].getAttribute('xmlns:custom'),'urn:producer');
    assert.equal(tags('sheetData')[0].getAttributeNS(mc,'Ignorable'),'custom');assert.equal(tags('sheetData')[0].getAttributeNS('urn:producer','meta'),'keep-sheetData');
    assert.equal(tags('row')[0].getAttributeNS('urn:producer','note'),'keep-header');
    assert.equal(tags('row').filter(row=>row.getAttribute('r')==='6').length,1);
    assert.equal(tags('dimension')[0].getAttribute('ref'),'A1:D6');assert.equal(tags('sheetPr')[0].getAttribute('codeName'),'KeepThis');
    assert.equal(tags('col')[0].getAttribute('width'),'25');assert.equal(tags('dataValidation')[0].getAttribute('sqref'),'B6:B9');assert.equal(tags('formula1')[0].textContent,'Values!$A$1:$A$2');
    assert.equal(tags('marker')[0].getAttributeNS('urn:metadata','value'),'keep');assert.equal(tags('marker')[0].textContent,'Unchanged');
    assert.equal(await read('xl/styles.xml'),parts['xl/styles.xml']);assert.ok(!archive.names.includes('xl/calcChain.xml'));
    const types=new DOMParser().parseFromString(await read('[Content_Types].xml')).getElementsByTagNameNS('*','Override');assert.equal(types.length,1);assert.equal(types[0].getAttribute('PartName'),'/xl/styles.xml');
    const rels=new DOMParser().parseFromString(await read('xl/_rels/workbook.xml.rels')).getElementsByTagNameNS('*','Relationship');assert.equal(rels.length,3);assert.ok(rels.some(r=>r.getAttribute('Id')==='style'));
  }
});
