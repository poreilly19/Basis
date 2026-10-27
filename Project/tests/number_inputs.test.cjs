const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const context=vm.createContext({Intl});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/number_inputs.js'),'utf8'),context);
const {basisParseNumber:parse,basisFormatNumber:format,basisRentNumberFormat:rent}=vm.runInContext('({basisParseNumber,basisFormatNumber,basisRentNumberFormat})',context);

test('area is grouped and rounded only for display; per-SF rent always has cents',()=>{
  assert.equal(format(12345.6789,'sf'),'12,346');
  assert.equal(format(12,'psf'),'$12.00');
  assert.equal(format(1234.56789,'psf'),'$1,234.57');
  assert.equal(format(0,'sf'),'0');assert.equal(format(0,'psf'),'$0.00');
});
test('annual and monthly totals omit unused cents but retain entered cents',()=>{
  assert.equal(format(125000,'money'),'$125,000');
  assert.equal(format(125000.5,'money'),'$125,000.50');
  assert.equal(format(125000.125,'money'),'$125,000.13');
  assert.equal(format(-125000.25,'money'),'-$125,000.25');
  assert.equal(format(-0,'money'),'$0');
});
test('pasted US amounts, accounting negatives and decimal entry parse completely',()=>{
  for(const [raw,value] of [['12,345',12345],[' $12,345.50 ',12345.5],['-$1,234.25',-1234.25],['$-1,234.25',-1234.25],['($ 1,234.25)',-1234.25],['.75',.75],['12.',12],['1e-7',1e-7],['',0]])assert.equal(parse(raw),value,raw);
});
test('invalid or partial amounts cannot silently become zero or a different magnitude',()=>{
  for(const raw of ['1,23','12,34.56','1.234,56','1 234','12abc','10%','$','--5','$$12','(-123)','1e999','Infinity','NaN','<img src=x>'])assert.equal(parse(raw),null,raw);
  for(const raw of [undefined,null,true,{},NaN,Infinity])assert.equal(parse(raw),null);
});
test('full-precision editing values round-trip without display rounding',()=>{
  for(const value of [12345.67890123,19.125,125000.123456,1e-7,-.125,0,Number.MAX_VALUE,Number.MIN_VALUE])assert.equal(parse(String(value)),value);
  assert.equal(format(null,'sf'),'');assert.equal(format(undefined,'psf'),'');assert.equal(format('','money'),'');
  assert.equal(format('$12,345.50','money'),'$12,345.50');
  assert.equal(format('invalid legacy amount','money'),'invalid legacy amount');
});
test('current and legacy rent units select a display without changing unit magnitude',()=>{
  for(const unit of ['psfyr','psfmo','psf','psfyear','psfmonth',undefined])assert.equal(rent(unit),'psf');
  for(const unit of ['yramt','moamt','amt','annual','monthly','year','month','amtyr','amtmo'])assert.equal(rent(unit),'money');
});
