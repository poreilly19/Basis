const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'../app/index.html'),'utf8');
const from=html.indexOf('function spreadsheetText('),end=html.indexOf('/* END SPREADSHEET TEXT EXPORT */',from);
assert.ok(from>=0&&end>from);
const ctx=vm.createContext({});
vm.runInContext(html.slice(from,end),ctx);
vm.runInContext(html.match(/function tsvOf\(rows\)\{[^\n]+/)[0],ctx);
const {rCSV,tsvOf,spreadsheetText}=vm.runInContext('({rCSV,tsvOf,spreadsheetText})',ctx);
test('CSV quotes multiline, carriage-return, comma and quote text',()=>{
  assert.equal(rCSV([['A,B','x"y','first\nsecond','first\rsecond',null,12,-12]]),'"A,B","x""y","first\nsecond","first\rsecond",,12,-12');
});
test('CSV and clipboard exports neutralize model-controlled spreadsheet formulas',()=>{
  for(const value of ['=1+1','+1','-1','@SUM(A1)','  =HYPERLINK("https://invalid")','\t=1','\r=1','\n=1']){
    assert.equal(spreadsheetText(value),"'"+value);
    assert.ok(rCSV([[value]]).replace(/^"/,'').startsWith("'"));
    assert.ok(tsvOf([[value]]).startsWith("'"));
  }
  assert.equal(rCSV([[12,-12,.3,'Ordinary tenant']]),'12,-12,0.3,Ordinary tenant');
});
test('clipboard data keeps rows and cells intact when names contain separators',()=>{
  assert.equal(tsvOf([['Name\twith\r\nnewlines',5],['Other',-10]]),'Name with  newlines\t5\nOther\t-10');
});
