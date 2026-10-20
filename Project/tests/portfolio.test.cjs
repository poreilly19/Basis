const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
const first = html.indexOf('const $=');
const last = html.indexOf('/* =========================== PROPERTY FILE');
assert.ok(first >= 0 && last > first);
const context = vm.createContext({});
vm.runInContext(html.slice(first, last), context, {timeout: 5000});
const {blankState, calcPortfolio} = vm.runInContext('({blankState,calcPortfolio})', context);
const close = (actual, expected, name = 'value', tolerance = 1e-7) => {
  assert.ok(Number.isFinite(actual), `${name} must be finite; received ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${name}: expected ${expected}, received ${actual}`);
};
const plain = value => JSON.parse(JSON.stringify(value));

// Independent flat-asset economics: 1,000 SF * $12/SF/year = $1,000/month
// rent, less $200/month expenses = $800/month NOI. At an 8% terminal cap,
// twelve months' NOI gives $120,000 sale proceeds before any selling costs.
function asset(options = {}) {
  const state = blankState();
  Object.assign(state, {
    name: 'Asset', startYear: 2026, startMonth: 1, years: 1,
    gvRate: 0, clRate: 0, inflExp: 0, inflRent: 0, inflCPI: 0,
    pvMode: 'annual', priceMode: 'amount', price: 120000,
    discount: .10, exitCap: .08, costSale: 0, loanOn: false
  }, options);
  state.infl.forEach(series => { series.rates = [0, 0, 0]; });
  state.areas = [{id: 'area', name: 'Building', sf: 1000, basis: true}];
  state.tenants = [{
    id: 'tenant', name: 'Tenant', sf: 1000, start: `${state.startYear}-${String(state.startMonth).padStart(2, '0')}`,
    end: '2099-12', rent: 12, step: 0, free: 0,
    rec: state.recs[1].id, mla: state.mlas[0].id, expiry: 'Vacate'
  }];
  state.ops = [{id: 'expense', name: 'Expenses', amt: 2400, basis: 'amt', fixedPct: 1, infl: 0, recov: false}];
  return state;
}
const portfolio = (models, options = {}) => ({
  portfolio: models.map(model => ({name: model.name, model})),
  portDisc: .10, portCap: .08, portSingleExit: false, ...options
});

test('no included portfolio members returns no roll-up', () => {
  assert.equal(calcPortfolio(portfolio([])), null);
  assert.equal(calcPortfolio({portfolio: [{model: {}, include: false}]}), null);
});

test('aligned annual portfolio retains ordinary valuation and cash flow', () => {
  const result = calcPortfolio(portfolio([asset(), asset()]));
  close(result.ann.noi[0], 19200, 'annual NOI');
  close(result.pv, (19200 + 240000) / 1.1, 'annual PV');
  close(result.irr, .10, 'IRR at present value');
  close(result.sumPVatPortDate, result.pv, 'standalone annual reconciliation');
});

test('Jan and Jul starts align actual cash flows and exits without rounding', () => {
  const result = calcPortfolio(portfolio([asset({name: 'January'}), asset({name: 'July', startMonth: 7})]));
  assert.equal(result.nM, 18);
  assert.equal(result.nY, 2);
  assert.equal(result.startMonth, 1);
  assert.equal(result.startDate, '2026-01');
  assert.equal(result.endDate, '2027-06');
  close(result.ann.noi[0], 14400, 'first portfolio year NOI');
  close(result.ann.noi[1], 4800, 'final six months NOI');
  [...new Array(6).fill(800), ...new Array(6).fill(1600), ...new Array(6).fill(800)]
    .forEach((value, month) => close(result.monthly.noi[month], value, `monthly NOI ${month}`));
  close(result.revM[11], 120000, 'December sale');
  close(result.revM[17], 120000, 'June sale');
  close(result.cashFlowPaymentsM[11], 9600, 'January member annual payment');
  close(result.cashFlowPaymentsM[17], 9600, 'July member annual payment');
  close(result.pv, 129600 / 1.1 + 129600 / 1.1 ** 1.5, 'fractional-date PV');
  close(result.sumPVatPortDate, result.pv, 'fractional-date standalone reconciliation');
  close(result.irr, .10, 'date-consistent IRR');
  assert.deepEqual(plain(result.periods), [
    {start: '2026-01', end: '2026-12', months: 12},
    {start: '2027-01', end: '2027-06', months: 6}
  ]);
  assert.equal(result.rows[1].offMonths, 6);
  close(result.rows[1].off, .5, 'fractional year offset');
  assert.equal(result.rows[1].exitDate, '2027-06');
});

test('offsets around half-year and year boundaries remain exact months', () => {
  for (const offset of [5, 6, 7, 11, 12, 13]) {
    const second = asset({startYear: 2026 + Math.floor(offset / 12), startMonth: offset % 12 + 1});
    const result = calcPortfolio(portfolio([asset(), second]));
    assert.equal(result.rows[1].offMonths, offset);
    assert.equal(result.nM, offset + 12);
    for (let month = 0; month < result.nM; month++) {
      const count = (month < 12 ? 1 : 0) + (month >= offset && month < offset + 12 ? 1 : 0);
      close(result.monthly.noi[month], count * 800, `offset ${offset}, month ${month}`);
    }
    close(result.pv, 129600 / 1.1 + 129600 / 1.1 ** (1 + offset / 12), `offset ${offset} PV`);
  }
});

test('non-January portfolio years show actual month ranges and exit year', () => {
  const result = calcPortfolio(portfolio([asset({startMonth: 7})]));
  assert.equal(result.startMonth, 7);
  assert.deepEqual(plain(result.periods), [{start: '2026-07', end: '2027-06', months: 12}]);
  assert.equal(result.rows[0].exitDate, '2027-06');
  assert.equal(result.rows[0].exitYear, 2027);
});

test('different separate hold periods stop cash and pay each sale on its own date', () => {
  const result = calcPortfolio(portfolio([asset({years: 1}), asset({years: 2})]));
  close(result.ann.noi[0], 19200);
  close(result.ann.noi[1], 9600);
  close(result.revM[11], 120000);
  close(result.revM[23], 120000);
  close(result.pv, (19200 + 120000) / 1.1 + (9600 + 120000) / 1.1 ** 2);
});

test('portfolio value respects each member non-operating valuation policy', () => {
  const model = asset();
  model.nonops = [{id: 'nonop', name: 'Non-operating expense', amt: 1200, basis: 'amt', infl: 0}];
  const excluded = calcPortfolio(portfolio([model]));
  close(excluded.ann.cfbds[0], 8400, 'reported cash');
  close(excluded.monthly.valuation[0], 800, 'cash valued with non-op addback');
  close(excluded.pv, 129600 / 1.1, 'non-op excluded from valuation');
  model.nonOpInPV = true;
  const included = calcPortfolio(portfolio([model]));
  close(included.monthly.valuation[0], 700, 'cash valued after non-op');
  close(included.pv, 128400 / 1.1, 'non-op included in valuation');
});

test('single exit holds every asset to the common date without mutating inputs', () => {
  const input = portfolio([asset({years: 1}), asset({years: 2})], {portSingleExit: true});
  const before = JSON.stringify(input);
  const result = calcPortfolio(input);
  assert.equal(JSON.stringify(input), before);
  close(result.ann.noi[0], 19200);
  close(result.ann.noi[1], 19200, 'both assets contribute in year two');
  close(result.fwd, 19200, 'all assets forward NOI');
  close(result.singleGrossRev, 240000);
  close(result.singleRev, 240000);
  close(result.revM[11], 0, 'no early sale');
  close(result.revM[23], 240000, 'common sale');
  close(result.pv, 19200 / 1.1 + (19200 + 240000) / 1.1 ** 2);
});

test('single exit uses forward NOI by default and has an explicit trailing policy', () => {
  const model = asset({years: 2});
  model.tenants[0].step = .10;
  model.resaleNoi = 'trailing'; // A property policy must not select the portfolio policy.
  const input = portfolio([model], {portSingleExit: true});
  const forward = calcPortfolio(input);
  close(forward.fwd, 12120, 'following twelve months NOI');
  close(forward.trailingNoi, 10800, 'preceding twelve months NOI');
  close(forward.terminalNoi, 12120, 'forward terminal NOI');
  close(forward.singleRev, 151500, 'forward terminal value');
  input.portResaleNoi = 'trailing';
  const trailing = calcPortfolio(input);
  close(trailing.fwd, 12120);
  close(trailing.terminalNoi, 10800);
  close(trailing.singleRev, 135000, 'trailing terminal value');
});

test('single exit dates final partial member-year cash at the common sale', () => {
  const result = calcPortfolio(portfolio([asset(), asset({startMonth: 7})], {portSingleExit: true}));
  assert.equal(result.nM, 18);
  close(result.ann.noi[0], 14400);
  close(result.ann.noi[1], 9600, 'both assets retained for final six months');
  close(result.cashFlowPaymentsM[11], 9600);
  close(result.cashFlowPaymentsM[17], 14400, 'six months A plus twelve months B');
  close(result.revM[17], 240000);
  close(result.pv, 9600 / 1.1 + (14400 + 240000) / 1.1 ** 1.5);
});

test('a joint sale between anniversaries uses the following twelve actual NOI months', () => {
  const first = asset();
  first.tenants[0].step = .10;
  const result = calcPortfolio(portfolio([first, asset({startMonth: 7})], {portSingleExit: true}));
  // A contributes six months at $900 NOI and six at $1,010 after the sale;
  // B contributes twelve flat $800 months. No rounded full-year NOI is used.
  close(result.fwd, 6 * 900 + 6 * 1010 + 12 * 800);
  close(result.singleGrossRev, 21060 / .08);
});

test('single exit retains each property selling costs and fixed adjustments', () => {
  const first = asset({costSale: .02});
  first.saleAdj = [{name: 'Adjustment', basis: 'amt', amt: 1000, dir: 'add'}];
  first.saleDed = [{name: 'Deduction', basis: 'amt', amt: 100}];
  const second = asset({costSale: .10});
  const result = calcPortfolio(portfolio([first, second], {portSingleExit: true}));
  close(result.singleGrossRev, 240000);
  close(result.singleRev, (120000 + 1000) * .98 - 100 + 120000 * .90);
  close(result.revM[11], result.singleRev);
});

test('zero discount values the complete actual dated operating and sale stream', () => {
  const result = calcPortfolio(portfolio([asset(), asset({startMonth: 7})], {portDisc: 0}));
  close(result.pvCF, 19200);
  close(result.pvRev, 240000);
  close(result.pv, 259200);
  close(result.irr, 0);
});

test('excluded invalid members cannot change dates or poison a valid portfolio', () => {
  const input = portfolio([asset()]);
  input.portfolio.push({model: {startYear: 1, startMonth: 99}, include: false});
  const result = calcPortfolio(input);
  assert.equal(result.startDate, '2026-01');
  close(result.pv, 129600 / 1.1);
});

test('standalone comparison identifies differing timing, rates and common-sale assumptions', () => {
  const same = calcPortfolio(portfolio([asset()]));
  assert.equal(same.comparisonComparable, true);
  for (const model of [asset({pvMode: 'nominal'}), asset({discount: .11}), asset({valDays: true})]) {
    const result = calcPortfolio(portfolio([model]));
    assert.equal(result.comparisonComparable, false);
    assert.ok(result.comparisonReasons.length > 0);
  }
  assert.equal(calcPortfolio(portfolio([asset()], {portSingleExit: true})).comparisonComparable, false);
});

test('included invalid dates and failed member calculations produce explicit errors', () => {
  for (const startMonth of [0, 13, .5, 'bad']) {
    assert.throws(() => calcPortfolio(portfolio([asset(), asset({startMonth})])), /start|date|month/i);
  }
  const broken = asset({name: 'Broken Asset'});
  broken.tenants = [null];
  assert.throws(() => calcPortfolio(portfolio([asset(), broken])), /Broken Asset.*calculat|calculat.*Broken Asset/i);
  assert.throws(() => calcPortfolio(portfolio([broken])), /Broken Asset.*calculat|calculat.*Broken Asset/i);
  assert.throws(() => calcPortfolio({portfolio: [{name: 'Missing Asset', model: null}]}), /Missing Asset.*model/i);
});

test('invalid portfolio discount and common-exit cap are rejected', () => {
  for (const portDisc of [-1, -1.5, Infinity, 'not a rate']) {
    assert.throws(() => calcPortfolio(portfolio([asset()], {portDisc})), /discount|rate/i);
  }
  assert.throws(() => calcPortfolio(portfolio([asset()], {portSingleExit: true, portCap: 0})), /cap/i);
});

test('single-exit projection beyond forty years fails without dropping early assets', () => {
  const input = portfolio([asset(), asset({startYear: 2066})], {portSingleExit: true});
  assert.throws(() => calcPortfolio(input), /40.year|40 year|forty/i);
});
