const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/financial_engine.js'), 'utf8');
const codec = fs.readFileSync(path.join(root, 'src/native_codec.js'), 'utf8');
const fixturePath = path.join(__dirname, 'fixtures/engine-parity.json');
const begin = '/* BEGIN BASIS FINANCIAL ENGINE */';
const end = '/* END BASIS FINANCIAL ENGINE */';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');

function load(text) {
  const math = Object.create(Math);
  let seed = 123456789;
  math.random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  const context = vm.createContext({Math: math, TextEncoder, TextDecoder, Uint8Array, DataView, ArrayBuffer,
    Blob, Response, DecompressionStream, crypto: crypto.webcrypto});
  vm.runInContext(codec, context, {timeout: 5000});
  vm.runInContext(text, context, {timeout: 5000});
  return vm.runInContext('({blankState,sampleState,calc,calcPortfolio,calcPositions,scrubMetrics,validateModel,valAt,buildDebt,' +
    'debtPayoffAt:typeof debtPayoffAt==="function"?debtPayoffAt:null})', context);
}

// Keep exact IEEE-754 edge values, typed-array types, object aliases and field
// presence. JSON.stringify(result) alone loses these behaviorally useful facts.
function canonical(value) {
  const seen = new Map();
  const walk = item => {
    if (typeof item === 'function') return {$function: item.name};
    if (item === undefined) return {$undefined: true};
    if (typeof item === 'number' && (!Number.isFinite(item) || Object.is(item, -0))) return {$number: String(item === 0 ? '-0' : item)};
    if (item === null || typeof item !== 'object') return item;
    if (seen.has(item)) return {$ref: seen.get(item)};
    const id = seen.size;
    seen.set(item, id);
    if (ArrayBuffer.isView(item)) return {$id: id, $typed: Object.prototype.toString.call(item), values: Array.from(item, walk)};
    if (Array.isArray(item)) return {$id: id, $array: item.map(walk)};
    return {$id: id, $object: Object.keys(item).map(key => [key, walk(item[key])])};
  };
  return JSON.stringify(walk(value));
}

function freeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Object.values(value).forEach(item => freeze(item, seen));
  return Object.freeze(value);
}

function flat(api, options = {}) {
  const state = api.blankState();
  Object.assign(state, {name: 'Parity asset', startYear: 2026, startMonth: 1, years: 2,
    gvRate: 0, clRate: 0, inflExp: 0, inflRent: 0, inflCPI: 0, loanOn: false,
    priceMode: 'amount', price: 120000, goingInCap: .08, exitCap: .08,
    costSale: 0, discount: .10, pvMode: 'annual'}, options);
  state.infl.forEach(series => { series.rates = [0, 0, 0, 0]; });
  state.areas = [{id: 'building', name: 'Building', sf: 1000, basis: true}];
  state.tenants = [{id: 'tenant', name: 'Tenant', sf: 1000, start: '2026-01', end: '2035-12',
    rent: 12, step: 0, free: 0, rec: state.recs[1].id, mla: state.mlas[0].id, expiry: 'Vacate'}];
  state.ops = [{id: 'expense', name: 'Expenses', amt: 2400, basis: 'amt', fixedPct: 1, infl: 0, recov: false}];
  return state;
}

const cases = [
  ...['nominal', 'effective', 'annual'].map(pvMode => ({name: `sample-${pvMode}`, model: api => Object.assign(api.sampleState(), {pvMode})})),
  {name: 'flat-annual', model: api => flat(api)},
  {name: 'rent-step-and-free', model: api => { const s = flat(api); Object.assign(s.tenants[0], {step: .05, free: 1}); return s; }},
  {name: 'midmonth-commencement', model: api => { const s = flat(api); s.tenants[0].start = '2026-01-16'; return s; }},
  {name: 'occupied-variable-expense', model: api => { const s = flat(api); s.tenants[0].sf = 500; s.ops[0].fixedPct = .25; return s; }},
  {name: 'nnn-recovery', model: api => { const s = flat(api); s.tenants[0].rec = s.recs[0].id; s.recs[0].adminFee = 0; s.ops[0].recov = true; return s; }},
  {name: 'base-year-fixture', model: () => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/base-year-model.json'), 'utf8'))},
  {name: 'zero-discount', model: api => flat(api, {discount: 0})},
  {name: 'interest-only', model: api => flat(api, {loanOn: true, ltv: .5, rate: .06, ioOnly: true, loanFee: .01})},
  {name: 'amortizing-debt', model: api => flat(api, {loanOn: true, ltv: .5, rate: .06, amortYears: 30, loanFee: 0})},
  {name: 'zero-interest-debt', model: api => flat(api, {loanOn: true, ltv: .5, rate: 0, amortYears: 10, loanFee: 0})},
  {name: 'fully-amortized-debt', model: api => flat(api, {loanOn: true, ltv: .5, rate: .06, amortYears: 1, loanFee: 0})},
  {name: 'future-floating-maturing-debt', model: api => {
    const s = flat(api, {loanOn: true});
    s.loans = [{id: 'floating', name: 'Floating', sizing: 'amount', amount: 60000, rateType: 'floating',
      curve: '3;4;5', spread: .02, floor: .04, cap: .08, amortYears: 20, start: '2026-07',
      termMonths: 15, feePct: .01, exitFeePct: .02, ffMax: 2000, ffPct: .5}];
    s.caps = [{id: 'capital', name: 'Capital', amt: 2400, basis: 'amt', year: 1, infl: 0}];
    return s;
  }},
  {name: 'area-index-inflation-start', model: api => {
    const s = flat(api);
    s.tenants[0].areaSched = [{date: '2027-01', sf: 800}];
    s.indices = [{id: 'index', name: 'Expense index', data: '2026-01:100;2027-01:110;2028-01:121', after: .1}];
    s.infl.push({id: 'indexed', name: 'Indexed expense', indexRef: 'index', rates: [0, .1, .1]});
    delete s.ops[0].infl;
    s.ops[0].inflRef = 'indexed';
    s.useInflBegins = true;
    s.ib_op = '2026-07';
    return s;
  }},
  ...[false, true].map(portSingleExit => ({name: `staggered-portfolio-${portSingleExit ? 'joint' : 'separate'}`, portfolio: true,
    model: api => ({portfolio: [{model: flat(api, {years: 1})}, {model: flat(api, {startMonth: 7})}],
      portDisc: .10, portCap: .08, portSingleExit})}))
];

function evaluate(api, item, useFreeze = true) {
  const model = item.model(api), before = JSON.stringify(model);
  if (useFreeze) freeze(model);
  if (item.portfolio) {
    const result = api.calcPortfolio(model);
    assert.equal(JSON.stringify(model), before, `${item.name} mutated input`);
    return {input: model, output: result};
  }
  const result = api.calc(model);
  const output = {result, positions: api.calcPositions(model, result), scrub: api.scrubMetrics(model, result),
    diagnostics: api.validateModel(model, result), valuation: api.valAt(result, model),
    payoffProbes: payoffIndices(result).map(month => [month, result.payoff(month)])};
  assert.equal(JSON.stringify(model), before, `${item.name} mutated input`);
  return {input: model, output};
}

function payoffIndices(result) {
  return [-1, -0, 0, .5, 11, 11.5, 12, 23, result.nY * 12 - 1, result.nM - 1, result.nM, result.nM + 1,
    undefined, null, '11', Infinity, -Infinity, NaN,
    ...result.loans.flatMap(loan => [loan.start - 1, loan.start, loan.start + .5,
      loan.maturity - 1, loan.maturity, loan.maturity + .5, loan.maturity + 1])];
}

// Recording requires an explicit pre-extraction source path; ordinary test runs
// can only read the committed fingerprints and cannot silently replace them.
if (process.argv[2] === '--capture-original') {
  assert.ok(process.argv[3], 'Supply the saved original engine source');
  const original = fs.readFileSync(process.argv[3], 'utf8');
  const fingerprints = Object.fromEntries(cases.map(item => {
    const value = evaluate(load(original), item);
    return [item.name, {inputSha256: sha(canonical(value.input)), outputSha256: sha(canonical(value.output))}];
  }));
  fs.writeFileSync(fixturePath, JSON.stringify({sourceSha256: sha(original), cases: fingerprints}, null, 2) + '\n');
  console.log(`Captured ${cases.length} pre-extraction exact-output fingerprints`);
} else {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const corrections = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/engine-parity-corrections-0_7_29.json'), 'utf8'));
  test('reviewed numerical corrections retain the original pre-extraction fixture unchanged', () => {
    assert.equal(sha(fs.readFileSync(fixturePath)), corrections.baselineFixtureSha256);
    assert.deepEqual(Object.keys(corrections.cases).sort(), ['sample-nominal','sample-effective','sample-annual','future-floating-maturing-debt'].sort());
    for (const [name, correction] of Object.entries(corrections.cases))
      assert.equal(correction.originalOutputSha256, fixture.cases[name].outputSha256);
  });
  test('canonical financial source is embedded verbatim and evaluates without browser globals', () => {
    const document = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');
    // The inert worker intentionally receives another verbatim copy. This
    // assertion checks the active application; check-build verifies its bundle.
    const html = document.split('<!-- BEGIN BASIS CALCULATION WORKER BUNDLE -->')[0];
    const a = html.indexOf(begin), b = html.indexOf(end, a);
    assert.ok(a >= 0 && b > a);
    assert.equal(html.indexOf(begin, a + begin.length), -1);
    assert.equal(html.indexOf(end, b + end.length), -1);
    assert.equal(html.slice(a, b + end.length), source.trim());
    assert.equal(typeof load(source).calc, 'function');
  });
  for (const item of cases) test(`${corrections.cases[item.name] ? 'reviewed financial correction with exact remaining parity' : 'exact pre/post extraction parity'} and frozen input: ${item.name}`, () => {
    const value = evaluate(load(source), item);
    assert.equal(sha(canonical(value.input)), fixture.cases[item.name].inputSha256, 'Shared input changed');
    const correction=corrections.cases[item.name];
    if (!correction) assert.equal(sha(canonical(value.output)), fixture.cases[item.name].outputSha256, 'Full result graph changed');
    else {
      const {capital,originalPositions}=correction, positions=value.output.positions;
      let restoredCapitalPV=0;
      for(let y=0;y<capital.payments;y++) restoredCapitalPV+=capital.annualAmount*(1+capital.annualGrowth)**y/(1+capital.discountRate)**(y+1);
      const near=(actual,expected,label)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<1e-7,`${label}: expected ${expected}, received ${actual}`);
      near(positions.feeSimple-originalPositions.feeSimple,restoredCapitalPV,'Restored duplicate capital deduction');
      near(positions.gap,originalPositions.gap-restoredCapitalPV,'Position gap after the same capital correction');
      // Restore only the two independently reviewed numeric fields for this
      // comparison. The unchanged original hash still checks every other value,
      // key, typed array and alias in the complete result graph.
      const current={feeSimple:positions.feeSimple,gap:positions.gap};
      try{
        Object.assign(positions,originalPositions);
        assert.equal(sha(canonical(value.output)),fixture.cases[item.name].outputSha256,'An unreviewed result field changed');
      }finally{Object.assign(positions,current);}
    }
  });
  test('result data retains typed arrays, aliases and infinite maturity across structured clone', () => {
    const api = load(source), model = api.sampleState(), result = api.calc(model);
    assert.throws(() => structuredClone(result), {name: 'DataCloneError'});
    const {payoff, ...data} = result;
    const copy = structuredClone(data);
    assert.equal(canonical(copy), canonical(data));
    assert.ok(copy.noiM instanceof Float64Array);
    assert.equal(copy.noiM, copy.monthly.noi);
    assert.equal(copy.cfbds, copy.monthly.cfbds);
    assert.equal(copy.loans[0].maturity, Infinity);
    assert.equal(typeof payoff, 'function');
    assert.equal(typeof copy.payoff, 'undefined');
  });
  test('the canonical engine keeps the same optional external validation boundary', () => {
    const api = load(source), invalid = flat(api);
    invalid.tenants = [null];
    assert.throws(() => api.calc(invalid), /tenants\[0\]/i);
  });
  test('pure debt payoff and hydrated cloned loans match original arbitrary-index probes', () => {
    for (const item of cases.filter(item => !item.portfolio)) {
      const api = load(source), result = api.calc(item.model(api));
      const copiedLoans = structuredClone(result.loans);
      assert.equal(typeof api.debtPayoffAt, 'function');
      for (const month of payoffIndices(result)) {
        assert.ok(Object.is(api.debtPayoffAt(copiedLoans, month), result.payoff(month)), `${item.name}: index ${String(month)}`);
      }
    }
  });
}
