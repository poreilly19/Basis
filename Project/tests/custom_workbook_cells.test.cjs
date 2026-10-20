const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const {DOMParser}=require('./office_dom.cjs');

const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
function part(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a,'Custom workbook reader extraction boundaries must exist');return html.slice(a,b);}
const source=[
  fs.readFileSync(path.join(root,'src/financial_engine.js'),'utf8'),
  fs.readFileSync(path.join(root,'src/office_zip.js'),'utf8'),
  part('async function intUnzip(buf){','const intXML='),
  part('const intXML=','/* BEGIN BASIS PDF INTEGRITY */'),
  part('const X4_DEF=','const AXE=')
].join('\n');
function setup(bytes){
  const context=vm.createContext({DOMParser,TextEncoder,TextDecoder,Uint8Array,Uint32Array,ArrayBuffer,DataView,Blob,Response,DecompressionStream});
  vm.runInContext(source,context,{filename:'basis-custom-workbook-cells.js'});context.input=bytes;
  return {run:code=>vm.runInContext(code,context),context};
}

// Original test fixtures use independent STORE records and the standard CRC-32
// polynomial. No application ZIP writer, worksheet writer, or CRC helper is used.
function crc32(data){let crc=0xffffffff;for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function zip(parts){
  const records=[],directory=[];let offset=0;
  for(const [pathname,text] of Object.entries(parts)){
    const name=Buffer.from(pathname),data=Buffer.from(text),crc=crc32(data),local=Buffer.alloc(30),central=Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);
    central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);
    records.push(local,name,data);directory.push(central,name);offset+=local.length+name.length+data.length;
  }
  const end=Buffer.alloc(22),central=Buffer.concat(directory),count=Object.keys(parts).length;
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(count,8);end.writeUInt16LE(count,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...records,central,end]);
}
const MAIN='http://schemas.openxmlformats.org/spreadsheetml/2006/main',REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const xmlText=text=>String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const textCell=(ref,text,extra='')=>'<c r="'+ref+'" t="inlineStr"'+extra+'><is><t>'+xmlText(text)+'</t></is></c>';
const sheet=rows=>'<worksheet xmlns="'+MAIN+'"><sheetData>'+rows+'</sheetData></worksheet>';
function workbook({inputCell='<c r="D3"><v>1250000</v></c>',sharedStrings,styles,informationalCell,headerText='PurchasePrice',literalCell,date1904=false}={}){
  const propertyRows='<row r="1">'+textCell('A1','VERSION')+textCell('B1','=2+2')+'</row>'+
    '<row r="2">'+textCell('A2','COL')+textCell('B2','Property_ExternalID')+textCell('C2','Name')+textCell('D2',headerText)+textCell('E2','Comments')+'</row>'+
    '<row r="3">'+textCell('B3','asset1')+textCell('C3','Fixture property')+inputCell+(literalCell||textCell('E3','Fixture comment'))+'</row>';
  const names=['PropertyAssets','Leases'];if(informationalCell!==undefined)names.push('Report');
  const parts={
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
    'xl/workbook.xml':'<workbook xmlns="'+MAIN+'" xmlns:r="'+REL+'"><workbookPr date1904="'+(date1904?'1':'0')+'"/><sheets>'+names.map((name,i)=>'<sheet name="'+name+'" sheetId="'+(i+1)+'" r:id="r'+i+'"/>').join('')+'</sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+names.map((_name,i)=>'<Relationship Id="r'+i+'" Type="'+REL+'/worksheet" Target="worksheets/sheet'+i+'.xml"/>').join('')+'</Relationships>',
    'xl/worksheets/sheet0.xml':sheet(propertyRows),
    'xl/worksheets/sheet1.xml':sheet('<row r="2">'+textCell('A2','COL')+textCell('B2','Property_ExternalID')+textCell('C2','Name')+'</row>')
  };
  if(sharedStrings!==undefined)parts['xl/sharedStrings.xml']='<sst xmlns="'+MAIN+'">'+sharedStrings+'</sst>';
  if(styles!==undefined)parts['xl/styles.xml']=styles;
  if(informationalCell!==undefined)parts['xl/worksheets/sheet2.xml']=sheet('<row r="1">'+textCell('A1','Information only')+informationalCell+'</row>');
  return zip(parts);
}
const readers={intXlsx:'intXlsx(await intUnzip(input),{keepRows:true})',x4ReadTemplate:'x4ReadTemplate(input)'};
async function rejectsAt(bytes,sheetName,cellRef,pattern){
  for(const [name,expression] of Object.entries(readers)){
    await assert.rejects(setup(bytes).run('(async()=>'+expression+')()'),error=>{
      assert.match(error.message,pattern,name+' must explain the rejected cell');
      assert.ok(error.message.includes(sheetName),name+' must name worksheet '+sheetName+': '+error.message);
      assert.ok(error.message.includes(cellRef),name+' must name cell '+cellRef+': '+error.message);return true;
    });
  }
}
async function readBoth(bytes){
  const page=setup(bytes);const T=await page.run('x4ReadTemplate(input)'),sheets=await page.run('(async()=>intXlsx(await intUnzip(input),{keepRows:true}))()');
  return {page,T,sheets,value:T.sheets.PropertyAssets.rows[0][3],text:sheets.find(s=>s.name==='PropertyAssets').rows[2][3]??''};
}

test('uncached scalar, shared and array formula anchors fail with worksheet/cell context',async()=>{
  for(const formula of ['<f>1+1</f>','<f t="shared" si="0" ref="D3:D4">1+1</f>','<f t="shared" si="0"/>','<f t="array" ref="D3:D4">ROW(D3:D4)</f>']){
    await rejectsAt(workbook({inputCell:'<c r="D3">'+formula+'</c>'}),'PropertyAssets','D3',/formula|cached|recalculat/i);
  }
  for(const type of ['b','str'])await rejectsAt(workbook({inputCell:'<c r="D3" t="'+type+'"><f>1+1</f></c>'}),'PropertyAssets','D3',/formula|cached|recalculat/i);
  for(const contents of [
    '<f>1+1</f><!-- <v>999</v> -->',
    '<f>1+1</f><![CDATA[<v>999</v>]]>',
    '<s:f xmlns:s="'+MAIN+'">1+1</s:f>'
  ])await rejectsAt(workbook({inputCell:'<c r="D3">'+contents+'</c>'}),'PropertyAssets','D3',/formula|cached|recalculat/i);
});

test('formula numeric and boolean caches cannot be empty or nonfinite',async()=>{
  for(const [type,value] of [['n',''],['n','NaN'],['n','Infinity'],['b','']]){
    await rejectsAt(workbook({inputCell:'<c r="D3" t="'+type+'"><f>1+1</f><v>'+value+'</v></c>'}),'PropertyAssets','D3',/formula|cached|numeric|recalculat/i);
  }
});

test('Excel error cells reject with worksheet/cell context even without a formula',async()=>{
  for(const formula of ['', '<f>1/0</f>']){
    await rejectsAt(workbook({inputCell:'<c r="D3" t="e">'+formula+'<v>#DIV/0!</v></c>'}),'PropertyAssets','D3',/Excel error|#DIV\/0!/i);
  }
});

test('shared-string references reject missing tables and invalid indexes instead of becoming empty or zero',async()=>{
  const variants=[
    {index:'0'},
    {index:'0',sharedStrings:''},
    {index:'2',sharedStrings:'<si><t>Only value</t></si>'},
    {index:'-1',sharedStrings:'<si><t>Only value</t></si>'},
    {index:'0.5',sharedStrings:'<si><t>Only value</t></si>'},
    {index:'not-an-index',sharedStrings:'<si><t>Only value</t></si>'},
    {index:'',sharedStrings:'<si><t>Only value</t></si>'},
    {sharedStrings:'<si><t>Only value</t></si>'},
    {index:'1',sharedStrings:'<!-- <si><t>Fake entry</t></si> --><si><t>Only real entry</t></si>'},
    {index:'1',sharedStrings:'<![CDATA[<si><t>Fake entry</t></si>]]><si><t>Only real entry</t></si>'}
  ];
  for(const item of variants){
    const inputCell='<c r="D3" t="s">'+(item.index===undefined?'':'<v>'+item.index+'</v>')+'</c>';
    await rejectsAt(workbook({inputCell,sharedStrings:item.sharedStrings}),'PropertyAssets','D3',/shared.string|index/i);
  }
});

test('cached zero, false and empty string formula results remain valid',async()=>{
  const styles='<styleSheet xmlns="'+MAIN+'"><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="0"/></cellXfs></styleSheet>';
  for(const [type,cache,expected,text] of [['n','0',0,'0'],['b','0',false,'FALSE'],['str','', '', '']])for(const quote of ['"',"'"]){
    const formula=type==='str'?'""':type==='b'?'FALSE()':'0';
    const result=await readBoth(workbook({inputCell:'<c r='+quote+'D3'+quote+' t='+quote+type+quote+' s='+quote+'1'+quote+'><f>'+formula+'</f><v>'+cache+'</v></c>',styles}));
    assert.equal(result.value,expected);assert.equal(result.text,text);assert.equal(result.T.sheets.PropertyAssets.style[3],1);
  }
  for(const value of ['<v/>','<v />','<v attr="value"></v>']){
    const result=await readBoth(workbook({inputCell:'<c r="D3" t="str"><f>""</f>'+value+'</c>'}));
    assert.equal(result.value,'');assert.equal(result.text,'');
  }
  for(const [value,expected,text] of [[' 1 ',true,'TRUE'],[' 0 ',false,'FALSE']]){
    const result=await readBoth(workbook({inputCell:'<c r="D3" t="b"><f>TRUE()</f><v>'+value+'</v></c>'}));
    assert.equal(result.value,expected);assert.equal(result.text,text);
  }
});

test('cached shared and array formula anchors retain their values',async()=>{
  for(const attrs of ['t="shared" si="0" ref="D3:D4"','t="array" ref="D3:D4"']){
    const result=await readBoth(workbook({inputCell:'<c r="D3"><f '+attrs+'>1+1</f><v>2</v></c>'}));
    assert.equal(result.value,2);assert.equal(result.text,'2');
  }
});

test('a legal empty shared string is accepted and populated shared strings remain exact',async()=>{
  for(const [entry,expected] of [
    ['<si><t></t></si>',''],
    ['<si><t>Café &amp; Co.</t></si>','Café & Co.'],
    ['<si><r><t>Café </t></r><rPh sb="0" eb="4"><t>Phonetic annotation</t></rPh><r><t>&amp; Co.</t></r></si>','Café & Co.'],
    ['<si><!-- <t>Fake text</t> --><t>Only real text</t></si>','Only real text']
  ]){
    const result=await readBoth(workbook({inputCell:'<c r="D3" t="s"><v>0</v></c>',sharedStrings:entry}));
    assert.equal(result.value,expected);assert.equal(result.text,expected);
  }
  for(const index of ['&#48;','&#x30;']){
    let result;await assert.doesNotReject(async()=>{result=await readBoth(workbook({inputCell:'<c r="D3" t="s"><v>'+index+'</v></c>',sharedStrings:'<si><t>Entity string</t></si>'}));},'shared-string index '+index);
    assert.equal(result.value,'Entity string');assert.equal(result.text,'Entity string');
  }
});

test('numeric character references and CDATA decode consistently before reading a cached number',async()=>{
  for(const [value,expected] of [['&#49;&#50;&#51;',123],['&#x31;&#x32;&#x33;',123],['<![CDATA[42]]>',42]]){
    let result;await assert.doesNotReject(async()=>{result=await readBoth(workbook({inputCell:'<c r="D3"><f>'+expected+'</f><v>'+value+'</v></c>'}));},'numeric value '+value);
    assert.equal(result.value,expected);assert.equal(result.text,String(expected));
  }
});

test('formula-like header, metadata and string text stays literal without an actual formula element',async()=>{
  const literal='=SUM(A1) <f>literal text</f>',header='=Header formula text';
  const literalCell=textCell('E3',literal,' formula="metadata"').replace('</c>','<!-- <f t="shared" si="0">1+1</f> --></c>');
  const result=await readBoth(workbook({headerText:header,literalCell}));
  assert.equal(result.T.version,'=2+2');assert.equal(result.T.sheets.PropertyAssets.cols[3],header);
  assert.equal(result.T.sheets.PropertyAssets.rows[0][4],literal);assert.equal(result.sheets[0].rows[2][4],literal);
});

test('informational sheets without COL do not block XL4ADW templates but document intake validates their cells',async()=>{
  for(const cell of ['<c r="B1"><f>1+1</f></c>','<c r="B1" t="e"><v>#N/A</v></c>','<c r="B1" t="s"><v>99</v></c>']){
    const bytes=workbook({informationalCell:cell}),page=setup(bytes),T=await page.run('x4ReadTemplate(input)');
    assert.equal(T.sheets.Report.adw,false);assert.equal(T.sheets.PropertyAssets.rows[0][3],1250000);
    await assert.rejects(page.run('(async()=>intXlsx(await intUnzip(input)))()'),error=>{
      assert.ok(error.message.includes('Report'),error.message);assert.ok(error.message.includes('B1'),error.message);return true;
    });
  }
});

test('XL4ADW model import preserves the independently cached PurchasePrice',async()=>{
  const page=setup(workbook({inputCell:'<c r="D3"><f>1250000+1</f><v>1250001</v></c>'}));
  const result=await page.run('(async()=>x4Import(await x4ReadTemplate(input),"asset1"))()');
  assert.equal(result.S.name,'Fixture property');assert.equal(result.S.price,1250001);
});

test('equivalent built-in date styles retain exact dates and imported analysis starts in both epochs',async()=>{
  const variants=[
    '<styleSheet xmlns="'+MAIN+'"><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>',
    "<styleSheet xmlns='"+MAIN+"'><cellXfs><xf numFmtId='0'/><xf applyNumberFormat='1' numFmtId='14'/></cellXfs></styleSheet>",
    '<s:styleSheet xmlns:s="'+MAIN+'"><s:cellXfs><s:xf numFmtId="0"/><s:xf numFmtId="14" applyNumberFormat="1"/></s:cellXfs></s:styleSheet>'
  ];
  for(const styles of variants)for(const date1904 of [false,true]){
    const page=setup(workbook({styles,date1904,headerText:'AnalysisBegin',inputCell:'<c r="D3" s="1"><v>45000</v></c>',literalCell:'<c r="E3" s="0"><v>45000</v></c>'}));
    const result=await page.run('(async()=>{const T=await x4ReadTemplate(input),I=x4Import(T,"asset1"),sheets=await intXlsx(await intUnzip(input),{keepRows:true});return {date:T.sheets.PropertyAssets.rows[0][3].d,year:I.S.startYear,month:I.S.startMonth,money:T.sheets.PropertyAssets.rows[0][4],text:sheets[0].rows[2][3]};})()');
    const expected=date1904?'2027-03-16':'2023-03-15';
    assert.deepEqual(JSON.parse(JSON.stringify(result)),{date:expected,year:date1904?2027:2023,month:3,money:45000,text:expected});
  }
});

test('custom date styles honor attribute order, XML quotes and namespace prefixes',async()=>{
  const variants=[
    '<styleSheet xmlns="'+MAIN+'"><numFmts><numFmt formatCode="yyyy-mm-dd" numFmtId="164"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>',
    "<styleSheet xmlns='"+MAIN+"'><numFmts><numFmt numFmtId='164' formatCode='&quot;posted&quot; yyyy-mm-dd'/></numFmts><cellXfs><xf numFmtId='0'/><xf numFmtId='164'/></cellXfs></styleSheet>",
    '<s:styleSheet xmlns:s="'+MAIN+'"><s:numFmts><s:numFmt formatCode="yyyy-mm-dd" numFmtId="164"/></s:numFmts><s:cellXfs><s:xf numFmtId="0"/><s:xf numFmtId="164"/></s:cellXfs></s:styleSheet>'
  ];
  for(const styles of variants)for(const date1904 of [false,true]){
    const result=await readBoth(workbook({styles,date1904,inputCell:'<c r="D3" s="1"><v>45000</v></c>'}));
    assert.equal(result.value.d,date1904?'2027-03-16':'2023-03-15');assert.equal(result.text,result.value.d);
  }
});

test('quoted date-like words in custom monetary formats do not convert amounts to dates',async()=>{
  const styles='<styleSheet xmlns="'+MAIN+'"><numFmts><numFmt formatCode="0.00 &quot;USD&quot;" numFmtId="164"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>';
  const result=await readBoth(workbook({styles,inputCell:'<c r="D3" s="1"><v>45000</v></c>'}));
  assert.equal(result.value,45000);assert.equal(result.text,'45000');
});
