const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

// Actual deployable engine plus its production model-validation boundary.
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');
const first = html.indexOf('/* BEGIN BASIS FINANCIAL ENGINE */');
const last = html.indexOf('/* END BASIS FINANCIAL ENGINE */', first);
assert.ok(first >= 0 && last > first);
const context = vm.createContext({TextEncoder, TextDecoder, Uint8Array, DataView, ArrayBuffer});
vm.runInContext(fs.readFileSync(path.join(root, 'src/native_codec.js'), 'utf8'), context);
vm.runInContext(html.slice(first, last), context);
const api = vm.runInContext('({blankState,calc,buildDebt,valAt,validateModel})', context);
const near = (actual, expected, label, tolerance = 1e-7) => {
  assert.ok(Number.isFinite(actual), `${label}: expected ${expected}, received ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, received ${actual}`);
};
const sum = values => Array.from(values).reduce((a, b) => a + b, 0);

// $12,000 annual base rent less $2,400 operating costs = $9,600 NOI;
// $120,000 purchase and sale, two years, no growth or leasing costs.
function flat(overrides = {}) {
  const s = api.blankState();
  Object.assign(s, {startYear: 2026, startMonth: 1, years: 2, gvRate: 0, clRate: 0,
    priceMode: 'amount', price: 120000, exitCap: .08, costSale: 0, discount: .1,
    pvMode: 'nominal', loanOn: false}, overrides);
  s.infl.forEach(series => { series.rates = [0, 0, 0, 0, 0]; });
  s.areas = [{id: 'building', name: 'Building', sf: 1000, basis: true}];
  s.recs = [{id: 'gross', name: 'Gross', method: 'GROSS'},
    {id: 'net', name: 'Net', method: 'NNN', denom: 'rentable', grossUp: .95, adminFee: 0}];
  s.tenants = [{id: 'tenant', name: 'Tenant', sf: 1000, start: '2026-01', end: '2035-12',
    rent: 12, rentBasis: 'psfyr', step: 0, free: 0, rec: 'gross', mla: s.mlas[0].id, expiry: 'Vacate'}];
  s.ops = [{id: 'cost', name: 'Operating costs', amt: 2400, basis: 'amt', fixedPct: 1, infl: 0, recov: false}];
  return s;
}
function loan(overrides = {}) {
  return {id: 'loan', name: 'Loan', sizing: 'amount', amount: 60000, rateType: 'fixed',
    rate: .06, ioAll: true, feePct: 0, exitFeePct: 0, ffMax: 0, ...overrides};
}

// Independent bisection oracle for these conventional cash flows: one initial
// negative investment followed by nonnegative receipts, hence one finite root.
function referenceMonthlyIrr(flows) {
  assert.ok(flows[0] < 0 && flows.slice(1).every(x => x >= 0));
  const npv = rate => flows.reduce((total, amount, i) => total + amount / (1 + rate) ** i, 0);
  let lower = -.05, upper = .05;
  assert.ok(npv(lower) > 0 && npv(upper) < 0);
  for (let k = 0; k < 100; k++) {
    const mid = (lower + upper) / 2;
    if (npv(mid) > 0) lower = mid; else upper = mid;
  }
  return (lower + upper) / 2;
}

for (const guMonthly of [true, false]) test(`95% expense gross-up works below 10% occupancy; monthly=${guMonthly}`, () => {
  for (const occupancy of [.001, .05, .10, .50, 1]) {
    const s = flat({guMonthly});
    Object.assign(s.tenants[0], {sf: 1000 * occupancy, rec: 'net'});
    Object.assign(s.ops[0], {amt: 10000, fixedPct: .2, recov: true});
    const r = api.calc(s);
    // Fixed costs never gross up; variable costs rise to 95% occupancy when lower.
    near(r.ann.op[0], 2000 + 8000 * occupancy, 'actual expense');
    near(r.ann.reimb[0], occupancy * (2000 + 8000 * Math.max(.95, occupancy)), 'tenant recovery');
  }
});

test('zero occupancy and disabled gross-up never invent tenant reimbursements', () => {
  const s = flat();
  Object.assign(s.ops[0], {amt: 10000, fixedPct: 0, recov: true});
  Object.assign(s.tenants[0], {sf: 50, rec: 'net'});
  s.recs[1].grossUp = 0;
  near(api.calc(s).ann.reimb[0], 25, '5% share of $500 actual variable cost');
  s.tenants = [];
  const r = api.calc(s);
  near(r.ann.reimb[0], 0, 'no tenants');
  near(r.ann.op[0], 0, 'no variable cost at zero occupancy');
});

for (const [capType, expected] of [['cum', [10000, 10500, 9000, 11576.25]], ['noncum', [10000, 10500, 9000, 9450]]]) {
  test(`${capType} recovery cap treats a declining expense year correctly`, () => {
    const s = flat({years: 4});
    s.tenants[0].rec = 'net';
    Object.assign(s.recs[1], {capType, capPct: .05});
    Object.assign(s.ops[0], {amtYears: '10000;20000;9000;20000;20000', recov: true});
    const r = api.calc(s);
    expected.forEach((amount, year) => near(r.ann.reimb[year], amount, `year ${year + 1}`));
  });
}

test('administration fees respect the selected side of a recovery ceiling', () => {
  const s = flat();
  s.tenants[0].rec = 'net';
  Object.assign(s.ops[0], {amt: 10000, recov: true});
  Object.assign(s.recs[1], {adminFee: .1, maxBasis: 'amt', maxAmt: 10000, adminBasis: 'pool'});
  near(api.calc(s).ann.reimb[0], 10000, 'fee before ceiling');
  s.recs[1].adminBasis = 'recovery';
  near(api.calc(s).ann.reimb[0], 11000, 'fee after ceiling');
});

test('annual expense stops net low and high months before applying the zero floor', () => {
  const s = flat();
  s.tenants[0].rec = 'net';
  Object.assign(s.recs[1], {method: 'STOPPSF', stopAmt: 10});
  Object.assign(s.ops[0], {amt: 5000, amt2: 15000, amt2Start: '2026-07', infl2: 0, recov: true});
  near(api.calc(s).ann.reimb[0], 0, '$10,000 annual expense against $10,000 stop');
  s.stopAnnual = false;
  near(api.calc(s).ann.reimb[0], 2500, 'six monthly excesses of $5,000/year');
});

test('a recoverable 3% management fee reconciles to its algebraic fixed point', () => {
  const s = flat();
  s.tenants[0].rec = 'net'; s.ops[0].recov = true;
  s.ops.push({id: 'fee', name: 'Management fee', basis: 'pctEGR', amt: .03, recov: true});
  const r = api.calc(s), fee = .03 * (12000 + 2400) / (1 - .03);
  near(r.ann.op[0], 2400 + fee, 'expense plus circular fee', 1e-5);
  near(r.ann.reimb[0], 2400 + fee, 'reimbursement', 1e-5);
  near(r.ann.noi[0], 12000, 'NOI after fully reimbursed expenses', 1e-5);
});

test('a midyear loan recognizes funding, origination fee, interest and maturity exactly once', () => {
  const s = flat({loanOn: true});
  s.loans = [loan({start: '2026-07', termMonths: 6, feePct: .01, exitFeePct: .02})];
  const r = api.calc(s);
  near(r.loan, 0, 'no acquisition loan');
  near(r.equity, 120000, 'initial equity before July funding');
  near(r.fundM[6], 59400, '$60,000 less $600 fee');
  near(r.dsTot[0], 1800, 'six $300 interest payments');
  near(r.balloonM[11], 61200, 'principal plus 2% exit fee');
  near(r.payoff(11), 0, 'no double payoff after balloon');
  near(r.cfads[0], 6000, 'year-one net equity cash');
  near(sum(r.dsM.slice(12)), 0, 'no debt service after maturity');
});

test('floating interest follows the dated curve with rate floor and cap', () => {
  const s = flat({loanOn: true});
  s.loans = [loan({rateType: 'floating', curve: '1;9;3', spread: .02, floor: .04, cap: .08})];
  const r = api.calc(s);
  near(r.dsTot[0], 2400, '4% floor');
  near(r.dsTot[1], 4800, '8% cap');
  near(r.dsTot[2], 3000, '5% forward year');
  near(r.balEnd, 60000, 'interest-only principal');
});

test('future draws honor the funded share, total commitment and maturity', () => {
  const s = flat({loanOn: true});
  s.loans = [loan({ffMax: 1000, ffPct: .5, termMonths: 3, exitFeePct: .02})];
  const costs = new Float64Array(36); costs.set([600, 1200, 1000, 2000]);
  const d = api.buildDebt(s, 36, 2, 120000, costs);
  assert.deepEqual(Array.from(d.drawM.slice(0, 4)), [300, 600, 100, 0]);
  near(sum(d.drawM), 1000, 'commitment');
  near(d.dsM[0], 301.5, 'first draw accrues interest in funding month');
  near(d.dsM[2], 305, 'interest on full funded balance');
  near(d.balloonM[2], 62220, '$61,000 principal plus 2% exit fee');
  near(d.payoff(23), 0, 'matured facility');
});

function drawOnly() {
  const s = flat({loanOn: true});
  s.loans = [loan({amount: 0, ffMax: 1000, ffPct: 1})];
  s.caps = [{id: 'capital', name: 'July project', amt: 1000, basis: 'amt', year: 1, timing: 'Jul', infl: 0}];
  return s;
}
function drawOnlyFlows(price, months = 24) {
  const flows = [-price, ...Array.from({length: months}, (_, i) => i < 6 ? 800 : 795)];
  flows[months] += 119000; // $120,000 sale less $1,000 outstanding draw.
  return flows;
}
test('a facility with no initial advance still produces levered returns when it draws', () => {
  const r = api.calc(drawOnly());
  near(r.drawM[6], 1000, 'July draw');
  near(r.balEnd, 1000, 'sale payoff');
  near(r.cfads[0], 9570, 'first-year equity cash');
  near(r.cfads[1], 9540, 'second-year equity cash');
  near(r.equity, 120000, 'initial equity');
  near(r.irrL, referenceMonthlyIrr(drawOnlyFlows(120000)) * 12, 'levered IRR', 1e-9);
  near(r.mult, 138110 / 120000, 'equity multiple');
});

test('draw-only debt carries into price and hold sensitivities', () => {
  const s = drawOnly(), r = api.calc(s);
  for (const [price, hold] of [[120000, 2], [150000, 2], [120000, 1]]) {
    const v = api.valAt(r, s, {price, hold});
    near(v.equity, price, 'sensitivity equity');
    near(v.balance, 1000, 'sensitivity payoff');
    near(v.irrL, referenceMonthlyIrr(drawOnlyFlows(price, hold * 12)) * 12, 'sensitivity IRR', 1e-9);
  }
});

test('an unused zero-advance commitment has no levered result', () => {
  const s = drawOnly(); s.caps = [];
  const r = api.calc(s);
  near(sum(r.drawM), 0, 'no cost to fund');
  assert.equal(r.irrL, null); assert.equal(r.equity, null);
});

test('funding after the selected hold does not activate levered returns', () => {
  const s = flat({loanOn: true, years: 1});
  s.loans = [loan({start: '2027-01'})];
  const r = api.calc(s);
  near(r.fundM[12], 60000, 'forward-year funding remains in the schedule');
  assert.equal(r.irrL, null); assert.equal(r.equity, null);
  s.years = 2;
  const longer = api.calc(s);
  assert.ok(Number.isFinite(longer.irrL));
  const shorter = api.valAt(longer, s, {hold: 1});
  assert.equal(shorter.irrL, null); assert.equal(shorter.equity, null);
  const drawn = drawOnly(); drawn.caps[0].year = 2;
  const drawnResult = api.calc(drawn);
  assert.ok(Number.isFinite(drawnResult.irrL));
  assert.equal(api.valAt(drawnResult, drawn, {hold: 1}).irrL, null);
});

test('weighted market rollover shifts free rent, TI and commission to commencement', () => {
  const s = flat({years: 4});
  Object.assign(s.tenants[0], {end: '2026-12', expiry: 'Market'});
  Object.assign(s.mlas[0], {mrNewRef: '', mrRenewRef: '', mrNewLocal: 24, mrRenewLocal: 20,
    renewBasis: 'separate', renewProb: .75, downtime: 12, termYears: 3, stepPct: 0,
    frRef: '', frNewLocal: 4, frRenewLocal: 0, tiRef: '', tiNewLocal: 10, tiRenewLocal: 2,
    lcRef: '', lcNewLocal: .05, lcRenewLocal: .025, lcBasisLocal: 'pct', recRef: 'gross'});
  const r = api.calc(s), rollover = r.spaces[0].rollovers[0];
  near(rollover.month, 15, 'April 2027 commencement after three months downtime');
  near(rollover.rentPSF, 21, 'probability-weighted rent');
  near(r.ann.sched[1], 14000, 'eight collected months at $1,750');
  near(r.monthly.abate[15], 1750, 'one weighted free month at commencement');
  near(r.monthly.ti[15], 4000, 'weighted improvements');
  near(r.monthly.lc[15], 1914.0625, '3.125% of $61,250 net term rent');
});

test('a midmonth option joins the old lease without overlapping occupancy or rent', () => {
  const s = flat();
  Object.assign(s.tenants[0], {start: '2025-01', end: '2026-01-15', expiry: 'Option',
    optTermYears: 1, optRentBasis: 'psf', optRentAmt: 24, optStep: 0, optThen: 'Vacate'});
  const r = api.calc(s);
  near(r.monthly.sched[0], 1000 * 15 / 31 + 2000 * 16 / 31, 'January transition');
  near(r.occRate[0], 1, 'January occupancy');
  near(r.monthly.sched[12], 2000 * 15 / 31, 'final January through the 15th');
  near(r.monthly.sched[13], 0, 'vacant after option');
});

test('a one-day leap-year lease recognizes one of 29 February days', () => {
  const s = flat({startYear: 2028});
  Object.assign(s.tenants[0], {start: '2028-02-29', end: '2028-02-29', rentBasis: 'moamt', rent: 2900});
  const r = api.calc(s);
  near(r.monthly.sched[1], 100, 'February one-day rent');
  near(r.ann.sched[0], 100, 'annual collections');
  near(r.occRate[1], 1 / 29, 'February occupancy');
});

test('within-start-month valuation-date adjustment follows the stated fractional-month convention', () => {
  for (const pvMode of ['nominal', 'effective', 'annual']) {
    const s = flat({pvMode}), initial = api.calc(s);
    Object.assign(s, {valDays: true, valDate: '2026-01-16'});
    const r = api.calc(s), fractionalMonth = 15 / 31;
    const factor = pvMode === 'nominal' ? (1 + .1 / 12) ** fractionalMonth : 1.1 ** (fractionalMonth / 12);
    near(r.pv, initial.pv * factor, pvMode);
    near(api.valAt(r, s).pv, r.pv, 'sensitivity convention');
  }
});

test('a valuation date in another month receives an actionable finding without rewriting inputs', () => {
  const s = flat({valDays: true, valDate: '2026-07-16'}), findings = [];
  api.validateModel(s, api.calc(s), (issue, target) => findings.push({issue, target}));
  const found = findings.find(x => x.issue.msg.includes('Valuation date is outside'));
  assert.ok(found); assert.equal(found.issue.sev, 'error');
  assert.equal(found.target.collection, 'property'); assert.equal(found.target.field, 'valDate');
  assert.equal(s.valDate, '2026-07-16');
  s.valDate = '2026-01-16';
  assert.equal(api.validateModel(s, api.calc(s)).some(x => x.msg.includes('Valuation date is outside')), false);
});
