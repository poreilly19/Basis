const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

// Execute the deployable engine itself, without browser initialization or a
// duplicate implementation. Fail explicitly if a future extraction moves it.
const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
const begin = html.indexOf('const $=');
const end = html.indexOf('/* =========================== PROPERTY FILE');
assert.ok(begin >= 0 && end > begin, 'Financial engine boundaries must exist');
const context = vm.createContext({});
vm.runInContext(html.slice(begin, end), context, {filename: 'basis-engine.js', timeout: 5000});
const engine = vm.runInContext('({blankState, calc, calcPortfolio, buildDebt, pvFrom, irrMonthlyF, irrAnnualF, annuF, valAt})', context);
const close = (actual, expected, label, tolerance = 1e-7) => {
  assert.ok(Number.isFinite(actual), `${label}: expected a finite number, received ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}`);
};

// Independently specified economics: 1,000 SF at $12/SF/year; $2,400/year
// fixed operating expenses; no growth, vacancy, recovery or leasing costs.
// NOI is $800/month or $9,600/year. The sale is $9,600 / 8% = $120,000.
function fixture() {
  const state = engine.blankState();
  Object.assign(state, {
    startYear: 2026, startMonth: 1, years: 2,
    gvRate: 0, clRate: 0, inflExp: 0, inflRent: 0, inflCPI: 0,
    priceMode: 'amount', price: 120000, goingInCap: .08,
    exitCap: .08, costSale: 0, discount: .10, loanOn: false
  });
  state.infl.forEach(series => { series.rates = [0, 0, 0, 0]; });
  state.areas = [{id: 'area', name: 'Building', sf: 1000, basis: true}];
  state.tenants = [{
    id: 'tenant', name: 'Tenant', sf: 1000,
    start: '2026-01', end: '2035-12', rent: 12, step: 0, free: 0,
    rec: state.recs[1].id, mla: state.mlas[0].id, expiry: 'Vacate'
  }];
  state.ops = [{
    id: 'expense', name: 'Fixed expenses', amt: 2400,
    basis: 'amt', fixedPct: 1, infl: 0, recov: false
  }];
  return state;
}

test('contractual rent, occupancy, expenses and NOI match a flat lease', () => {
  const result = engine.calc(fixture());
  for (let year = 0; year <= 2; year++) {
    close(result.ann.gpr[year], 12000, 'annual rent');
    close(result.ann.occ[year], 1, 'occupancy');
    close(result.ann.op[year], 2400, 'operating expenses');
    close(result.ann.noi[year], 9600, 'NOI');
    close(result.ann.cfbds[year], 9600, 'cash before debt');
  }
});

test('four rent units express the same contractual cash flow', () => {
  for (const [rentBasis, rent] of [['psfyr', 12], ['psfmo', 1], ['yramt', 12000], ['moamt', 1000]]) {
    const state = fixture();
    Object.assign(state.tenants[0], {rentBasis, rent});
    close(engine.calc(state).ann.sched[0], 12000, rentBasis);
  }
});

test('anniversary rent steps and commencement free rent affect the correct year', () => {
  const state = fixture();
  Object.assign(state.tenants[0], {step: .05, free: 1});
  const result = engine.calc(state);
  close(result.ann.abate[0], 1000, 'one free month');
  close(result.ann.sched[0], 11000, 'first year collections');
  close(result.ann.sched[1], 12600, 'second year at 105%');
  close(result.ann.noi[0], 8600, 'first year NOI');
});

test('mid-month commencement prorates January once using actual calendar days', () => {
  const state = fixture();
  state.tenants[0].start = '2026-01-16';
  const result = engine.calc(state);
  close(result.monthly.sched[0], 1000 * 16 / 31, 'January collections');
  close(result.ann.sched[0], 11000 + 1000 * 16 / 31, 'annual collections');
});

test('fixed and variable operating expenses use occupied area', () => {
  const state = fixture();
  state.tenants[0].sf = 500;
  state.ops[0].fixedPct = .25;
  const result = engine.calc(state);
  close(result.ann.sched[0], 6000, 'half-building rent');
  close(result.ann.op[0], 2400 * (.25 + .75 * .5), 'fixed and occupied variable expense');
  close(result.ann.noi[0], 4500, 'NOI');
});

test('NNN recovery reimburses a fully occupied recoverable expense pool', () => {
  const state = fixture();
  state.tenants[0].rec = state.recs[0].id;
  state.recs[0].adminFee = 0;
  state.ops[0].recov = true;
  const result = engine.calc(state);
  close(result.ann.reimb[0], 2400, 'recoveries');
  close(result.ann.noi[0], 12000, 'NOI after recovery');
});

test('annual DCF discounts two NOI payments and terminal proceeds at year end', () => {
  const state = fixture();
  state.pvMode = 'annual';
  const result = engine.calc(state);
  close(result.grossRev, 120000, 'terminal value');
  close(result.pvCF, 9600 / 1.1 + 9600 / 1.1 ** 2, 'PV of NOI');
  close(result.pvRev, 120000 / 1.1 ** 2, 'PV of sale');
  close(result.irrU, .08, 'annual unlevered IRR');
});

test('nominal and effective DCF discount monthly cash flows at their stated convention', () => {
  for (const pvMode of ['nominal', 'effective']) {
    const state = fixture();
    state.pvMode = pvMode;
    const result = engine.calc(state);
    const monthlyRate = pvMode === 'nominal' ? .10 / 12 : 1.10 ** (1 / 12) - 1;
    const factor = (1 + monthlyRate) ** -24;
    close(result.pvCF, 800 * (1 - factor) / monthlyRate, `${pvMode} annuity PV`);
    close(result.pvRev, 120000 * factor, `${pvMode} terminal PV`);
    close(result.irrU, pvMode === 'nominal' ? .08 : (1 + .08 / 12) ** 12 - 1, `${pvMode} IRR`);
  }
});

test('zero-discount DCF is the undiscounted sum of income and sale', () => {
  const state = fixture();
  state.discount = 0;
  close(engine.calc(state).pv, 139200, 'undiscounted value');
});

test('interest-only debt charges monthly interest and retains the principal', () => {
  const state = fixture();
  Object.assign(state, {loanOn: true, ltv: .5, rate: .06, ioOnly: true, loanFee: .01});
  const result = engine.calc(state);
  close(result.loan, 60000, 'loan');
  close(result.feeAmt, 600, 'fee');
  close(result.dsM[0], 300, 'monthly interest');
  close(result.dsTot[0], 3600, 'annual interest');
  close(result.balEnd, 60000, 'payoff');
  close(result.equity, 60600, 'initial equity including fee');
  close(result.cfads[0], 6000, 'annual cash after interest');
});

test('amortizing debt matches an independent level-payment annuity', () => {
  const state = fixture();
  Object.assign(state, {loanOn: true, ltv: .5, rate: .06, amortYears: 30, ioOnly: false, loanFee: 0});
  const result = engine.calc(state);
  const monthlyRate = .06 / 12;
  const payment = 60000 / ((1 - (1 + monthlyRate) ** -360) / monthlyRate);
  const balance12 = 60000 * (1 + monthlyRate) ** 12 - payment * (((1 + monthlyRate) ** 12 - 1) / monthlyRate);
  close(result.dsM[0], payment, 'payment');
  close(result.intM[0], 300, 'first interest');
  close(result.prinM[0], payment - 300, 'first principal');
  close(result.balM[11], balance12, 'year-one balance');
});

test('zero-interest amortizing debt repays equal principal every month', () => {
  const state = fixture();
  Object.assign(state, {loanOn: true, ltv: .5, rate: 0, amortYears: 10, ioOnly: false, loanFee: 0});
  const result = engine.calc(state);
  close(result.dsM[0], 500, 'zero-rate payment');
  close(result.prinM[0], 500, 'principal payment');
  close(result.balM[11], 54000, 'year-one balance');
  close(result.balEnd, 48000, 'two-year payoff');
});

test('debt service stops after a loan fully amortizes', () => {
  for (const rate of [0, .06]) {
    const state = fixture();
    Object.assign(state, {loanOn: true, ltv: .5, rate, amortYears: 1, ioOnly: false, loanFee: 0});
    const result = engine.calc(state);
    close(result.prinM.reduce((sum, value) => sum + value, 0), 60000, 'total principal');
    close(result.dsM[12], 0, 'month thirteen debt service');
    close(result.dsTot[1], 0, 'second year debt service');
    close(result.balEnd, 0, 'fully amortized balance');
  }
});

test('annual IRR handles ordinary, zero, high-return and deep-loss cash flows', () => {
  for (const [flows, expected] of [[[-100, 110], .10], [[-100, 100], 0], [[-100, 1000], 9], [[-100, 1], -.99]]) {
    close(engine.irrAnnualF(flows), expected, `annual IRR ${flows}`);
  }
});

test('monthly IRR handles ordinary, high-return and deep-loss cash flows', () => {
  for (const [flows, expected] of [[[-100, 101], .01], [[-100, 1000], 9], [[-100, 1], -.99]]) {
    close(engine.irrMonthlyF(flows), expected, `monthly IRR ${flows}`);
  }
});

test('leading and trailing zero cash-flow padding does not alter a deep-loss IRR', () => {
  const zeros = new Array(479).fill(0);
  for (const flows of [[-100, 1, ...zeros], [...zeros, -100, 1], [...zeros, -100, 1, ...zeros]]) {
    close(engine.irrMonthlyF(flows), -.99, 'monthly IRR with zero padding');
    close(engine.irrAnnualF(flows), -.99, 'annual IRR with zero padding');
  }
});

test('IRR is undefined without both an investment and a return', () => {
  for (const solve of [engine.irrAnnualF, engine.irrMonthlyF]) {
    for (const flows of [[], [0], [0, 0], [-100, 0], [100, 200], [-100, -200], [-100, NaN]]) {
      assert.equal(solve(flows), null, `IRR ${flows}`);
    }
  }
});

test('valuation sensitivity with unchanged inputs equals the model run', () => {
  const state = fixture();
  Object.assign(state, {loanOn: true, ltv: .5, rate: .06, amortYears: 30});
  const result = engine.calc(state);
  const value = engine.valAt(result, state);
  for (const key of ['pv', 'pvCF', 'pvRev', 'irrU', 'irrL', 'loan', 'equity']) {
    close(value[key], result[key], key);
  }
});

test('high-return annual valuation and sensitivity use the same IRR solver', () => {
  const state = fixture();
  Object.assign(state, {years: 1, pvMode: 'annual', price: 12960});
  const result = engine.calc(state);
  // One year receives $9,600 income + $120,000 sale = $129,600.
  close(result.irrU, 9, 'model high-return IRR');
  close(engine.valAt(result, state).irrU, 9, 'sensitivity high-return IRR');
});

test('aligned portfolio aggregates income and uses the same annual IRR solver', () => {
  const state = fixture();
  const second = fixture();
  const portfolio = {
    portfolio: [{model: state}, {model: second}],
    portDisc: 9, portCap: .08, portSingleExit: false
  };
  const result = engine.calcPortfolio(portfolio);
  close(result.ann.noi[0], 19200, 'combined NOI');
  close(result.pv, 19200 / 10 + (19200 + 240000) / 100, 'annual portfolio PV');
  close(result.irr, 9, 'portfolio high-return IRR');
});

test('a portfolio with no investment or proceeds has no IRR', () => {
  const state = fixture();
  state.tenants = [];
  state.ops = [];
  const result = engine.calcPortfolio({portfolio: [{model: state}], portDisc: .10});
  close(result.pv, 0, 'empty portfolio value');
  assert.equal(result.irr, null);
});
