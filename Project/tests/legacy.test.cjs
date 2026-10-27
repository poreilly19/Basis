const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

// Exercise the deployable legacy readers, including their real defaults,
// exported table schema, coercion and checksum code, without browser startup.
const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
const start = html.indexOf('const $=');
const end = html.indexOf('/* ---------- input sensitivities:');
assert.ok(start >= 0 && end > start, 'Legacy reader extraction boundaries must exist');
function setup() {
  const context = vm.createContext({TextEncoder, TextDecoder});
  vm.runInContext(html.slice(start, end), context, {filename: 'basis-legacy.js', timeout: 5000});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/native_codec.js'), 'utf8'), context);
  return {context, run: source => vm.runInContext(source, context, {timeout: 5000})};
}
const plain = value => JSON.parse(JSON.stringify(value));
function assertUnpolluted(run) {
  assert.equal(run('Object.prototype.legacyPolluted'), undefined);
  assert.equal(run('Object.prototype.toString.legacyPolluted'), undefined);
  assert.equal(Object.prototype.legacyPolluted, undefined);
  assert.equal(Object.prototype.toString.legacyPolluted, undefined);
}

test('legacy plain JSON retains ordinary custom fields and merges defaults', () => {
  const {run} = setup();
  const result = run(`pfUnpackJSON({name:'Café & Co.',areas:[],mrents:[],custom:{zero:0,flag:false,value:1e-9}})`);
  assert.equal(result.version, 'legacy');
  assert.equal(result.props[0].st.name, 'Café & Co.');
  assert.deepEqual(plain(result.props[0].st.custom), {zero: 0, flag: false, value: 1e-9});
  assert.ok(Array.isArray(result.props[0].st.tenants));
});

test('versioned legacy JSON round-trips exported models and membership', () => {
  const {run} = setup();
  const result = run(`(() => {
    const model=blankState(); model.name='Host'; model.pid='host'; model.custom={flag:false,value:1e-9};
    model.portfolio=[{id:'member',name:'Member label',include:false,model:Object.assign(blankState(),{name:'Member',pid:'member'})}];
    const pkg=pfPackage(model,{results:false,members:true});
    return pfUnpackJSON(JSON.parse(JSON.stringify(pkg.json)));
  })()`);
  assert.equal(result.check, 'match');
  assert.equal(result.host, 'host');
  assert.equal(result.props.length, 2);
  assert.equal(result.props[0].st.portfolio[0].include, false);
  assert.equal(result.props[0].st.portfolio[0].model.name, 'Member');
  assert.deepEqual(plain(result.props[0].st.custom), {flag: false, value: 1e-9});
});

test('legacy workbook tables round-trip nested inputs, children and typed values', () => {
  const {run} = setup();
  const result = run(`(() => {
    const model=blankState(); model.name='Workbook'; model.pid='book';
    model.custom={flag:false,value:1e-9};
    model.tenants=[{id:'tenant',name:'Tenant & Co.',start:'2026-01',end:'2030-12',sf:1234.5,
      sched:[{id:'step',date:'2027-01-15',type:'step',units:'pct',amt:.025}],
      custom:[{zero:0,flag:false}]}];
    const pkg=pfPackage(model,{results:false});
    const book=Object.fromEntries(pkg.sheets.map(s=>[s.name,s.rows]));
    return pfUnpack(book);
  })()`);
  assert.equal(result.check, 'match');
  const model = result.props[0].st;
  assert.equal(model.name, 'Workbook');
  assert.deepEqual(plain(model.custom), {flag: false, value: 1e-9});
  assert.equal(model.tenants[0].sf, 1234.5);
  assert.equal(model.tenants[0].start, '2026-01');
  assert.equal(model.tenants[0].end, '2030-12');
  assert.equal(model.tenants[0].sched[0].date, '2027-01-15');
  assert.equal(model.tenants[0].sched[0].amt, .025);
  assert.deepEqual(plain(model.tenants[0].custom), [{zero: 0, flag: false}]);
});

test('Basis workbook and JSON model files retain multiple and legacy tenant groups',()=>{
  const {run}=setup();
  const result=plain(run(`(()=>{
    const model=blankState();model.pid='groups';model.tgroups=[{id:'a',name:'Industrial'},{id:'b',name:'Credit'}];
    model.tenants=[{id:'one',group:'a',groups:['a','b','missing']},{id:'two',group:'b'},{id:'three',group:'',groups:[]}];
    const pkg=pfPackage(model,{results:false}),book=Object.fromEntries(pkg.sheets.map(s=>[s.name,s.rows]));
    const display=book.Tenants[0].indexOf('groups (name)'),text=book.Tenants[1][display];
    book.Tenants[1][display]='This display label must not replace the IDs';
    return {original:model.tenants,text,table:pfUnpack(book).props[0].st.tenants,json:pfUnpackJSON(pkg.json).props[0].st.tenants};
  })()`));
  assert.deepEqual(result.table.map(t=>({id:t.id,group:t.group||'',...(t.groups===undefined?{}:{groups:t.groups})})),result.original);
  assert.deepEqual(result.json,result.original);
  assert.equal(result.text,'Industrial; Credit; (not found)');
});

test('workbooks without a dictionary distinguish a blank groups cell from an explicit empty list',()=>{
  const {run}=setup();
  const tenants=plain(run(`pfUnpack({Properties:[['Property_ID'],['p']],Tenants:[['Property_ID','id','group','groups'],['p','legacy','a',''],['p','cleared','a','[]'],['p','many','a','["a","b"]']]}).props[0].st.tenants`));
  assert.equal(Object.hasOwn(tenants[0],'groups'),false);
  assert.deepEqual(tenants[1].groups,[]);
  assert.deepEqual(tenants[2].groups,['a','b']);
});

test('legacy JSON and typed workbook cells reject malformed tenant memberships',()=>{
  const {run}=setup();
  for(const value of [null,'a',['a','a'],[2]]){
    const source=JSON.stringify(value);
    assert.throws(()=>run(`pfUnpackJSON({...blankState(),tenants:[{id:'t',groups:${source}}]})`),/groups/);
    assert.throws(()=>run(`pfUnpack({Properties:[['Property_ID'],['p']],Tenants:[['Property_ID','id','groups'],['p','t',${JSON.stringify(source)}]],Dictionary:[['Sheet','Column','Type'],['Tenants','groups','json']]})`),/groups/);
  }
});

test('JSON readers reject reserved keys at every depth before merging models', () => {
  for (const key of ['__proto__', 'constructor', 'prototype', 'safe.__proto__.legacyPolluted']) {
    for (const wrapped of [false, true]) {
      const {run, context} = setup();
      const model = JSON.parse(`{"areas":[],"mrents":[],"nested":{"${key}":{"legacyPolluted":true}}}`);
      context.input = wrapped ? {format: 'basis-property', version: '1.0', properties: [{propertyId: 'p', model}]} : model;
      assert.throws(() => run('pfUnpackJSON(input)'), /Unsafe property key/);
      assertUnpolluted(run);
    }
  }
  const {run} = setup();
  assert.throws(() => run(`pfUnpackJSON(JSON.parse('{"areas":[],"mrents":[],"__proto__":{"legacyPolluted":true}}'))`), /Unsafe property key/);
  assertUnpolluted(run);
});

test('dotted paths reject reserved and empty segments without changing targets', () => {
  for (const path of ['__proto__.legacyPolluted', 'constructor.prototype.legacyPolluted',
    'safe.__proto__', 'safe.constructor.value', 'safe.prototype.value', '.value', 'safe..value', 'safe.']) {
    const {run, context} = setup();
    context.path = path;
    run('var target={}');
    assert.throws(() => run('pfSetPath(target,path,true)'), /Unsafe property key|Invalid property path/);
    assert.equal(run('Object.keys(target).length'), 0);
    assertUnpolluted(run);
  }
});

test('dotted paths create own objects instead of traversing inherited functions', () => {
  const {run} = setup();
  assert.equal(run(`(() => {const target={};pfSetPath(target,'toString.legacyPolluted',true);return target.toString.legacyPolluted;})()`), true);
  assertUnpolluted(run);
});

test('workbook headers, manifest keys, dictionary keys and Other sheets reject reserved paths', () => {
  const badBooks = [
    {Properties: [['Property_ID', '__proto__.legacyPolluted'], ['p', true]]},
    {Properties: [['Property_ID', 'constructor.prototype.legacyPolluted'], ['p', true]]},
    {Properties: [['Property_ID', 'safe..value'], ['p', true]]},
    {Properties: [['Property_ID'], ['p']], Manifest: [['Key', 'Value'], ['__proto__', true]]},
    {Properties: [['Property_ID'], ['p']], Dictionary: [['Sheet', 'Column', 'Type'], ['__proto__', 'legacyPolluted', 'boolean']]},
    {Properties: [['Property_ID'], ['p']], Dictionary: [['Sheet', 'Column', 'Type'], ['Properties', '__proto__', 'json']]},
    {Properties: [['Property_ID'], ['p']], Other___proto__: [['Property_ID', 'value'], ['p', true]]},
    {Properties: [['Property_ID'], ['p']], Other_constructor: [['Property_ID', 'value'], ['p', true]]}
  ];
  for (const book of badBooks) {
    const {run, context} = setup();
    context.book = book;
    assert.throws(() => run('pfUnpack(book)'), /Unsafe property key|Invalid property path/);
    assertUnpolluted(run);
  }
});

test('JSON-typed workbook cells reject reserved nested keys after parsing', () => {
  const {run, context} = setup();
  context.book = {
    Properties: [['Property_ID', 'custom'], ['p', '{"nested":{"__proto__":{"legacyPolluted":true}}}']],
    Dictionary: [['Sheet', 'Column', 'Type'], ['Properties', 'custom', 'json']]
  };
  assert.throws(() => run('pfUnpack(book)'), /Unsafe property key/);
  assert.throws(() => run(`pfCoerce('json','custom','{"constructor":{"legacyPolluted":true}}')`), /Unsafe property key/);
  assertUnpolluted(run);
});

test('workbook dictionaries safely handle ordinary keys matching inherited names', () => {
  const {run, context} = setup();
  context.book = {
    Properties: [['Property_ID', 'toString'], ['p', 123]],
    Dictionary: [['Sheet', 'Column', 'Type'], ['toString', 'legacyPolluted', 'boolean']]
  };
  assert.equal(run('pfUnpack(book).props[0].st.toString'), 123);
  assertUnpolluted(run);
});

test('legacy JSON and workbook imports enforce structural and computation bounds', () => {
  const {run} = setup();
  assert.throws(()=>run("pfUnpackJSON({...blankState(),tenants:[null]})"), /must be an object/);
  assert.throws(()=>run("pfUnpackJSON({...blankState(),mlas:[{id:'huge',termYears:1e12}]})"), /1200-month/);
  assert.throws(()=>run("pfUnpack({Properties:[['Property_ID','name','startMonth'],['p','Bad',13]]})"), /startMonth/);
});

test('legacy duplicate property IDs are rejected rather than overwriting models', () => {
  const {run} = setup();
  assert.throws(()=>run("pfUnpack({Properties:[['Property_ID','name'],['p','First'],['p','Second']]})"), /Duplicate workbook Property_ID/);
  assert.throws(()=>run("pfUnpackJSON({format:PF_FORMAT,properties:[{propertyId:'p',model:{name:'First'}},{propertyId:'p',model:{name:'Second'}}]})"), /Duplicate legacy property ID/);
});

test('legacy membership cannot create cyclic model references', () => {
  const {run} = setup();
  assert.throws(()=>run("pfUnpack({Properties:[['Property_ID','name'],['p','Self']],Portfolio:[['Host_Property_ID','Property_ID'],['p','p']]})"), /nesting or size limit/);
  assert.throws(()=>run("pfUnpackJSON({format:PF_FORMAT,properties:[{propertyId:'p',model:{name:'Self'}}],portfolio:{host:'p',members:[{propertyId:'p',memberId:'self'}]}})"), /nesting or size limit/);
});

test('year-only expense stops remain years through legacy workbook tables', () => {
  const {run} = setup();
  for(const value of ['2024',2024,'2024-01','2024-01-15']){
    const result=run(`(() => {const model=blankState();model.tenants=[{id:'tenant',name:'Tenant',baseYear:${JSON.stringify(value)}}];
      const pkg=pfPackage(model,{results:false});return pfUnpack(Object.fromEntries(pkg.sheets.map(s=>[s.name,s.rows]))).props[0].st.tenants[0].baseYear;})()`);
    assert.equal(String(result),String(value));
  }
});

test('1904 workbook date serials use the workbook epoch without shifting money or base years', () => {
  const {run,context}=setup();
  for(const [serial,expected] of [[0,'1904-01'],[59,'1904-02-29'],[45000,'2027-03-16']]){
    context.serial=serial;
    const result=run(`pfUnpack({Properties:[['Property_ID','name'],['p','1904 fixture']],
      Tenants:[['Property_ID','id','start','rent','baseYear'],['p','tenant',serial,45000,2024]]},{date1904:true})`);
    assert.equal(result.props[0].st.tenants[0].start,expected);
    assert.equal(result.props[0].st.tenants[0].rent,45000);
    assert.equal(result.props[0].st.tenants[0].baseYear,2024);
  }
});

test('legacy tables retain the default epoch and ISO text in 1904 workbooks', () => {
  const {run}=setup();
  assert.equal(run(`pfUnpack({Properties:[['Property_ID'],['p']],Tenants:[['Property_ID','id','start'],['p','t',45000]]}).props[0].st.tenants[0].start`),'2023-03-15');
  assert.equal(run(`pfUnpack({Properties:[['Property_ID'],['p']],Tenants:[['Property_ID','id','start'],['p','t','2026-01-15']]},{date1904:true}).props[0].st.tenants[0].start`),'2026-01-15');
});

test('loan starts and remaining model date columns accept Excel serials in either workbook epoch',()=>{
  const {run}=setup();
  for(const date1904 of [false,true]){
    const result=run(`pfUnpack({Properties:[['Property_ID','actEnd','budEnd','valDate'],['p',45000,45000,45000]],
      Loans:[['Property_ID','id','start'],['p','loan',45000]],
      Tenants:[['Property_ID','id','incDate','availDate'],['p','tenant',45000,45000]],
      GroundLeases:[['Property_ID','id','end'],['p','ground',45000]],
      AreaDetails:[['Property_ID','Tenant_ID','date','sf'],['p','tenant',45000,100]],
      MiscellaneousRents:[['Property_ID','Tenant_ID','start','end'],['p','tenant',45000,45000]]
    },{date1904:${date1904}}).props[0].st`),expected=date1904?'2027-03-16':'2023-03-15';
    for(const value of [result.actEnd,result.budEnd,result.valDate,result.loans[0].start,result.tenants[0].incDate,
      result.tenants[0].availDate,result.groundLeases[0].end,result.tenants[0].areaSched[0].date,
      result.tenants[0].miscRents[0].start,result.tenants[0].miscRents[0].end])assert.equal(value,expected);
  }
});

function inflationBook(rows,series=[['p','curve','Fixture curve']],properties=[['p','Fixture property']]){
  return {Properties:[['Property_ID','name'],...properties],
    InflationSeries:[['Property_ID','id','name'],...series],
    InflationRates:[['Property_ID','Series_ID','Year_Index','Rate'],...rows]};
}
test('inflation year indices reject huge, malformed and fractional inputs before sparse expansion',()=>{
  for(const value of [4294967294,1e12,100000,-1,1.5,'1.5','bad','',null,true]){
    const {run,context}=setup();context.book=inflationBook([['p','curve',value,.03]]);
    assert.throws(()=>run('pfUnpack(book)'),/InflationRates Year_Index.*integer from 0 to 99999/);
  }
});
test('sparse inflation schedules preserve zeroes, order, numeric text indices and rates',()=>{
  const {run,context}=setup();context.book=inflationBook([['p','curve','3',.025],['p','curve',0,0],['p','curve',' 1 ',.03]]);
  assert.deepEqual(plain(run('pfUnpack(book).props[0].st.infl[0].rates')),[0,.03,0,.025]);
});
test('duplicate inflation year indices reject instead of overwriting a rate',()=>{
  const {run,context}=setup();context.book=inflationBook([['p','curve',1,.03],['p','curve','1',.04]]);
  assert.throws(()=>run('pfUnpack(book)'),/InflationRates Year_Index.*duplicate index 1/);
});
test('the largest supported inflation index is bounded and retains its rate',()=>{
  const {run,context}=setup();context.book=inflationBook([['p','curve',99999,.025]]);
  const result=run('pfUnpack(book).props[0].st.infl[0].rates');
  assert.equal(result.length,100000);assert.equal(result[0],0);assert.equal(result[99998],0);assert.equal(result[99999],.025);
});
test('inflation expansion has one workbook-wide budget across series and properties',()=>{
  const {run,context}=setup();
  context.book=inflationBook([['p','a',99999,.03],['p','b',99999,.04]], [['p','a','A'],['p','b','B']]);
  assert.equal(run('pfUnpack(book).props[0].st.infl.reduce((total,series)=>total+series.rates.length,0)'),200000);
  context.book=inflationBook([['p','a',99999,.03],['q','b',99999,.04],['q','c',0,.05]],
    [['p','a','A'],['q','b','B'],['q','c','C']],[['p','First'],['q','Second']]);
  assert.throws(()=>run('pfUnpack(book)'),/InflationRates.*200000-value expansion limit/);
});
