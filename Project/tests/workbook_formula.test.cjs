const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'../app/index.html'),'utf8');
const from=html.indexOf('function pfWorkbookTables('),end=html.indexOf('function pfReadFile(',from);
assert.ok(from>=0&&end>from);
function fixture(name='Tenants',cells={}){
  let converted=0;
  const context=vm.createContext({PF_SHEETS:[['tenants','Tenants'],['loans','Loans']],PF_CHILD:[['tenants','sched','RentSteps','Tenant_ID']],pfSafeKey(){},
    XLSX:{utils:{sheet_to_json(){converted++;return [['Property_ID'],['original']];}}},
    workbook:{SheetNames:[name],Sheets:{[name]:{'!ref':'A1:B2',...cells}}}});
  vm.runInContext(html.slice(from,end),context);
  return {context,run:()=>vm.runInContext('pfWorkbookTables(workbook)',context),converted:()=>converted};
}

test('missing or unusable scalar formula caches fail before table conversion',()=>{
  for(const cell of [{t:'n',f:'12*2'},{t:'n',f:'12*2',v:null},{t:'z',f:'12*2',v:0}]){
    const page=fixture('Tenants',{B2:cell});
    assert.throws(page.run,/Tenants!B2.*no usable cached value.*Recalculate/);
    assert.equal(page.converted(),0);
  }
});

test('Excel errors in imported cells cannot silently become blank model inputs',()=>{
  for(const cell of [{t:'e',f:'1/0',v:7},{t:'e',v:42}]){
    const page=fixture('Loans',{B2:cell});assert.throws(page.run,/Loans!B2.*Excel error/);assert.equal(page.converted(),0);
  }
});

test('valid cached numbers, zero, booleans and empty strings are retained without evaluation or mutation',()=>{
  for(const [type,value] of [['n',24],['n',0],['b',false],['s',''],['s','=literal']]){
    const page=fixture('Tenants',{B2:{t:type,f:'NOT_EVALUATED()',v:value}}),before=JSON.stringify(page.context.workbook);
    assert.equal(page.run().Tenants[1][0],'original');assert.equal(page.converted(),1);assert.equal(JSON.stringify(page.context.workbook),before);
  }
});

test('array formula cache checks include child cells without an anchor formula',()=>{
  const page=fixture('Tenants',{B2:{t:'n',F:'A2:B2'}});assert.throws(page.run,/formula Tenants!B2.*cached value/);assert.equal(page.converted(),0);
});

test('all consumed metadata, child and additive sheets require usable formula values',()=>{
  for(const name of ['Properties','Portfolio','InflationRates','Manifest','Dictionary','RentSteps','Other_custom']){
    const page=fixture(name,{B2:{t:'n',f:'40+2'}});assert.throws(page.run,/no usable cached value/);assert.equal(page.converted(),0);
  }
});

test('unused result and informational sheets do not block model input import',()=>{
  for(const name of ['Results_CashFlow','README','Notes']){
    const page=fixture(name,{A1:{t:'n',f:'40+2'},B2:{t:'e',v:7}});assert.equal(page.run()[name][1][0],'original');assert.equal(page.converted(),1);
  }
});

test('sparse range budgets still fail before formula scanning or table expansion',()=>{
  const page=fixture('Tenants',{B2:{t:'n',f:'40+2'}});page.context.workbook.Sheets.Tenants['!ref']='A1:XFD1048576';
  assert.throws(page.run,/range exceeds/);assert.equal(page.converted(),0);
});

test('non-finite numeric formula caches fail with the input cell location',()=>{
  for(const value of [NaN,Infinity,-Infinity]){
    const page=fixture('Tenants',{B2:{t:'n',f:'40+2',v:value}});assert.throws(page.run,/Tenants!B2.*no usable cached value/);assert.equal(page.converted(),0);
  }
});
