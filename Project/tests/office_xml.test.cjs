const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const {DOMParser}=require('./office_dom.cjs');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
function part(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a,'Office XML extraction boundaries must exist');return html.slice(a,b);}
const source=fs.readFileSync(path.join(root,'src/office_zip.js'),'utf8')+'\n'+part('const intXML=','/* BEGIN BASIS PDF LOADER */')+'\n'+part('const x4unesc=','// Assemble with verified workbook defaults');
const REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const WORD='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function setup(parts={},overrides={}){
  const context=vm.createContext({DOMParser,TextDecoder,Uint8Array,ArrayBuffer,DataView,Blob,DecompressionStream,...overrides});
  context.z={text:async name=>Object.hasOwn(parts,name)?parts[name]:null};
  context.x4Unzip=async()=>Object.entries(parts).map(([name,data])=>({name,data:Buffer.from(data)}));
  vm.runInContext(source,context,{filename:'basis-office-xml.js'});
  return {context,run:code=>vm.runInContext(code,context)};
}
const paragraph=text=>'<w:p><w:r><w:t>'+text+'</w:t></w:r></w:p>';
const word=body=>'<w:document xmlns:w="'+WORD+'"><w:body>'+body+'</w:body></w:document>';
const relations=body=>'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+body+'</Relationships>';
const relation=(id,target,extra='')=>'<Relationship Id="'+id+'" Target="'+target+'" '+extra+'/>';
function presentation(prefix='r'){return '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:'+prefix+'="'+REL+'"><p:sldIdLst><p:sldId id="256" '+prefix+':id="slide1"/></p:sldIdLst></p:presentation>';}
const slide='<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Slide text</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>';
const cell=(ref,value)=>'<c r="'+ref+'" t="inlineStr"><is><t>'+value+'</t></is></c>';
const worksheet=name=>'<worksheet><sheetData><row r="1">'+cell('A1','COL')+cell('B1','Name')+'</row><row r="2">'+cell('B2',name)+'</row></sheetData></worksheet>';
function workbookParts(){return {
  'xl/workbook.xml':'<workbook xmlns:r="'+REL+'"><sheets><sheet name="PropertyAssets" r:id="a"/><sheet name="Leases" r:id="b"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':relations(relation('a','worksheets/a.xml')+relation('b','worksheets/b.xml')),
  'xl/worksheets/a.xml':worksheet('Property'),
  'xl/worksheets/b.xml':worksheet('Tenant')
};}

test('Office XML rejects missing, malformed, unexpected roots and unsupported declarations',()=>{
  const {context,run}=setup();
  for(const value of [undefined,null,'','  ','<document><body></document>','<document/><document/>']){
    context.xml=value;assert.throws(()=>run('intXML(xml,"Word document","document")'),/missing or empty|malformed XML/);
  }
  context.xml='<worksheet/>';assert.throws(()=>run('intXML(xml,"Word document","document")'),/unexpected XML root/);
  for(const xml of ['<!DOCTYPE document [<!ENTITY x "value">]><document>&x;</document>','<!ENTITY x "value"><document/>']){
    context.xml=xml;assert.throws(()=>run('intXML(xml)'),/unsupported XML declarations/);
  }
  context.xml='<document/>';assert.equal(run('intXML(xml,"Word document","document").documentElement.localName'),'document');
  context.xml='<document><!-- <!DOCTYPE example> --><![CDATA[<!DOCTYPE example>]]></document>';
  assert.equal(run('intXML(xml,"Word document","document").documentElement.textContent'),'<!DOCTYPE example>');
  let parses=0;
  const forced=setup({}, {DOMParser:class {parseFromString(){parses++;return new DOMParser().parseFromString('<parsererror/>');}}});
  forced.context.xml='<document/>';assert.throws(()=>forced.run('intXML(xml)'),/malformed XML/);assert.equal(parses,1);
});

test('Office relationship parts are required, validated and kept in a safe dictionary',async()=>{
  for(const xml of [null,'','<Relationships>','<document/>',relations(relation('a','one')+relation('a','two')),relations('<Relationship Id="a"/>')]){
    const parts=xml===null?{}:{rels:xml};await assert.rejects(setup(parts).run('intRels(z,"rels")'),/missing|malformed|unexpected|duplicate/);
  }
  const parts={rels:relations(relation('__proto__','slide.xml')+relation('external','slide.xml','TargetMode="External"'))};
  const result=await setup(parts).run('intRels(z,"rels")');assert.equal(Object.getPrototypeOf(result),null);assert.equal(result.__proto__,'slide.xml');assert.equal(result.external,undefined);
});

test('Word paragraphs and nested table contents are extracted once in reading order',async()=>{
  const nested='<w:tbl><w:tr><w:tc>'+paragraph('Outer')+'<w:tbl><w:tr><w:tc>'+paragraph('Inner')+'</w:tc></w:tr></w:tbl><w:p/></w:tc><w:tc>'+paragraph('Right')+'</w:tc></w:tr></w:tbl>';
  const text=await setup({'word/document.xml':word(paragraph('Before')+nested+paragraph('After'))}).run('intDocx(z)');
  assert.equal(text,'Before\nOuter\nInner | Right\nAfter');
  assert.equal(text.split('Inner').length-1,1);
  let deep='';for(let i=30;i>0;i--)deep='<w:tbl><w:tr><w:tc>'+paragraph('LEVEL_'+String(i).padStart(2,'0'))+deep+'<w:p/></w:tc></w:tr></w:tbl>';
  const input=word(deep),output=await setup({'word/document.xml':input}).run('intDocx(z)');
  assert.equal(output.split('LEVEL_30').length-1,1);assert.equal(output.split('\n').length,30);assert.ok(output.length<input.length);
});

test('Word readers report missing parts, missing body and malformed XML',async()=>{
  for(const xml of [null,'','<document/>','<document><body></document>','<worksheet/>']){
    await assert.rejects(setup(xml===null?{}:{'word/document.xml':xml}).run('intDocx(z)'),/missing|malformed|unexpected/);
  }
});

test('PowerPoint slide relationships use their namespace with any prefix',async()=>{
  for(const prefix of ['r','rel']){
    const parts={'ppt/presentation.xml':presentation(prefix),'ppt/_rels/presentation.xml.rels':relations(relation('slide1','slides/slide1.xml')),'ppt/slides/slide1.xml':slide};
    const output=await setup(parts).run('intPptx(z)');assert.equal(output.length,1);assert.equal(output[0].text,'Slide text');
  }
});

test('PowerPoint rejects malformed/missing presentations, relationships and referenced slides',async()=>{
  const baseline={'ppt/presentation.xml':presentation(),'ppt/_rels/presentation.xml.rels':relations(relation('slide1','slides/slide1.xml')),'ppt/slides/slide1.xml':slide};
  for(const name of Object.keys(baseline))for(const replacement of [null,'','<broken>']){
    const parts={...baseline};if(replacement===null)delete parts[name];else parts[name]=replacement;
    await assert.rejects(setup(parts).run('intPptx(z)'),/missing|malformed/);
  }
  const external={...baseline,'ppt/_rels/presentation.xml.rels':relations(relation('slide1','slides/slide1.xml','TargetMode="External"'))};
  await assert.rejects(setup(external).run('intPptx(z)'),/missing or external/);
});

test('Workbook readers reject malformed present ancillary XML while allowing absent optional parts',async()=>{
  const baseline=workbookParts();
  for(const call of ['intXlsx(z)','x4ReadTemplate(null)']){
    const result=await setup(baseline).run(call);assert.ok(result);
    for(const [name,xml] of [['xl/sharedStrings.xml','<sst>'],['xl/styles.xml','<styleSheet>'],['xl/sharedStrings.xml',''],['xl/styles.xml','']]){
      await assert.rejects(setup({...baseline,[name]:xml}).run(call),/malformed|missing or empty/);
    }
  }
});

test('XL4ADW preflight rejects missing and malformed required XML before regex extraction',async()=>{
  const baseline=workbookParts();
  for(const name of Object.keys(baseline))for(const replacement of [null,'','<broken>']){
    const parts={...baseline};if(replacement===null)delete parts[name];else parts[name]=replacement;
    await assert.rejects(setup(parts).run('x4ReadTemplate(null)'),/missing|malformed/);
  }
  const truncated={...baseline,'xl/worksheets/a.xml':baseline['xl/worksheets/a.xml'].replace('</worksheet>','')};
  await assert.rejects(setup(truncated).run('x4ReadTemplate(null)'),/malformed XML/);
});

test('template workbook metadata accepts equivalent XML quotes, tag forms, namespaces and relative targets',async()=>{
  const baseline=workbookParts();
  const variants=[
    {...baseline,'xl/workbook.xml':baseline['xl/workbook.xml'].replace(/"/g,"'"),'xl/_rels/workbook.xml.rels':baseline['xl/_rels/workbook.xml.rels'].replace(/"/g,"'")},
    {...baseline,'xl/workbook.xml':baseline['xl/workbook.xml'].replace(/\/>/g,'></sheet>')},
    {...baseline,'xl/workbook.xml':baseline['xl/workbook.xml'].replace('xmlns:r=', 'xmlns:rel=').replace(/r:id/g,'rel:id')},
    {...baseline,'xl/workbook.xml':baseline['xl/workbook.xml'].replace('<workbook ', '<s:workbook xmlns:s="urn:workbook-fixture" ').replace('</workbook>','</s:workbook>').replace(/<(\/?)(sheets|sheet)(?=[\s>])/g,'<$1s:$2')},
    {...baseline,'xl/_rels/workbook.xml.rels':relations(relation('a','./worksheets/a.xml')+relation('b','../xl/worksheets/b.xml'))},
    {...baseline,'xl/_rels/workbook.xml.rels':relations(relation('a','/xl/worksheets/a.xml')+relation('b','/xl/worksheets/b.xml'))}
  ];
  for(const parts of variants){
    const result=await setup(parts).run('x4ReadTemplate(null)');
    assert.deepEqual(Array.from(result.order),['PropertyAssets','Leases']);
    assert.equal(result.sheets.PropertyAssets.path,'xl/worksheets/a.xml');
    assert.equal(result.sheets.Leases.path,'xl/worksheets/b.xml');
    assert.equal(result.sheets.PropertyAssets.rows[0][1],'Property');
    assert.equal(result.sheets.Leases.rows[0][1],'Tenant');
  }
});

test('template workbook names use XML-decoded attributes and external or missing relationships still reject',async()=>{
  const baseline=workbookParts(),unicode={...baseline,
    'xl/workbook.xml':baseline['xl/workbook.xml'].replace('</sheets>','<sheet name="Reference &#x1F3E2; &amp; Notes" r:id="reference"/></sheets>'),
    'xl/_rels/workbook.xml.rels':relations(relation('a','worksheets/a.xml')+relation('b','worksheets/b.xml')+relation('reference','worksheets/reference.xml')),
    'xl/worksheets/reference.xml':'<worksheet><sheetData/></worksheet>'};
  const result=await setup(unicode).run('x4ReadTemplate(null)');
  assert.equal(result.order[2],'Reference 🏢 & Notes');
  for(const rels of [relations(relation('b','worksheets/b.xml')),relations(relation('a','https://example.invalid/a.xml','TargetMode="External"')+relation('b','worksheets/b.xml'))]){
    await assert.rejects(setup({...baseline,'xl/_rels/workbook.xml.rels':rels}).run('x4ReadTemplate(null)'),/missing or external/);
  }
  await assert.rejects(setup({...baseline,'xl/workbook.xml':baseline['xl/workbook.xml'].replace('r:id="a"','r:id="unknown"')}).run('x4ReadTemplate(null)'),/missing or external/);
});

test('numeric worksheet text keeps representable precision through structured report import',async()=>{
  const samples=[['1234567890.12345',1234567890.12345],['123456789012.34',123456789012.34],
    ['0.000000123456789012345',0.000000123456789012345],['1.23456789012345e9',1234567890.12345],['0',0],['12.125',12.125]];
  for(const [serial,expected] of samples){
    const xml='<worksheet><sheetData><row r="1">'+cell('A1','Expenses - Operating Expenses')+'</row>'+
      '<row r="2">'+cell('A2','Name')+cell('B2','How Input')+cell('C2','Amount1')+'</row>'+
      '<row r="3">'+cell('A3','Operating')+cell('B3','Amount')+'<c r="C3"><v>0</v></c></row>'+
      '<row r="4">'+cell('A4','Investment - Property Purchase')+'</row>'+
      '<row r="5">'+cell('A5','Purchase Date')+cell('B5','Purchase Price')+'</row>'+
      '<row r="6">'+cell('A6','1/1/2026')+'<c r="B6"><v>'+serial+'</v></c></row></sheetData></worksheet>';
    const parts={'xl/workbook.xml':'<workbook xmlns:r="'+REL+'"><sheets><sheet name="Input Assumptions Report" r:id="a"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels':relations(relation('a','worksheets/a.xml')),'xl/worksheets/a.xml':xml};
    const {context,run}=setup(parts);
    vm.runInContext(fs.readFileSync(path.join(root,'src/financial_engine.js'),'utf8')+'\n'+part('const AX_SEC=','/* =========================== DOCUMENT INTAKE'),context);
    const sheets=await run('intXlsx(z,{keepRows:true})');context.importRows=sheets[0].rows;
    assert.equal(Number(sheets[0].rows[5][1]),expected,'worksheet numeric text must not lose decimal precision');
    assert.equal(run('axImport(importRows).S.price'),expected,'structured import must retain the representable value');
  }
});

test('report numeric parsing preserves exponent signs and supported accounting, currency and percent conventions',()=>{
  const {context,run}=setup();vm.runInContext(part('const AX_SEC=','/* =========================== DOCUMENT INTAKE'),context);
  for(const [text,expected] of [['1e-3',0.001],['1e+3',1000],['-1.25e-3',-0.00125],['+1.25E+3',1250],
    ['$1,234.56',1234.56],['-$1,234.56',-1234.56],['$-1,234.56',-1234.56],['(1,234.56)',-1234.56],['($1,234.56)',-1234.56],['$ (1,234.56)',-1234.56],
    ['3.5%',0.035],['-3.5%',-0.035],['(3.5%)',-0.035],['(3.5)%',-0.035],['1e-3%',0.00001],['0',0],['- 12.125',-12.125]]){
    context.numericText=text;assert.equal(run('axN(numericText)'),expected,text);
  }
  for(const text of ['',null,undefined,'None','N/A','Varies','1e','1e--3','1,2','1,000oops','12 dollars','--12','12-3','NaN','Infinity','3%%','($$3)']){
    context.numericText=text;assert.equal(run('axN(numericText)'),null,String(text));
  }
});
