const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
const first = html.indexOf('const $='), last = html.indexOf('/* =========================== PROPERTY FILE');
assert.ok(first >= 0 && last > first);
const context = vm.createContext({});
vm.runInContext(html.slice(first, last), context, {timeout: 5000});
const {blankState, calc, pD} = vm.runInContext('({blankState,calc,pD})', context);
const close = (actual, expected) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-7,
  `expected ${expected}, received ${actual}`);

// $2,400 annual recoverable expenses rise by exactly 10% each analysis year:
// 2026 $2,400, 2027 $2,640, 2028 $2,904. A fully occupied tenant over a
// 2026 expense stop pays $240 in 2027 and $504 in 2028.
function model(baseYear, fiscal = false) {
  const state = blankState();
  Object.assign(state, {startYear: 2026, startMonth: fiscal ? 7 : 1, years: 3,
    gvRate: 0, clRate: 0, exitCap: .08, costSale: 0, loanOn: false,
    recYear: fiscal ? 'fiscal' : 'calendar'});
  state.areas = [{id: 'building', name: 'Building', sf: 1000, basis: true}];
  state.recs = [{id: 'stop', name: 'Expense base-year stop', method: 'STOP', denom: 'rentable',
    adminFee: 0, grossUp: 1, pool: '', baseYearOffset: 0}];
  state.tenants = [{id: 'tenant', name: 'Tenant', sf: 1000,
    start: fiscal ? '2027-07' : '2027-01', end: '2035-12',
    rent: 12, step: 0, free: 0, rec: 'stop', mla: state.mlas[0].id,
    expiry: 'Vacate', baseYear}];
  state.ops = [{id: 'expenses', name: 'Recoverable expenses', basis: 'amt', amt: 2400,
    infl: .10, fixedPct: 1, recov: true}];
  return state;
}

test('year-only string and numeric expense stops preserve the stated base year', () => {
  for (const baseYear of ['2026', 2026]) {
    const result = calc(model(baseYear));
    close(result.ann.reimb[0], 0);
    close(result.ann.reimb[1], 240);
    close(result.ann.reimb[2], 504);
  }
});

test('month and day base-year dates retain existing recovery behavior', () => {
  for (const baseYear of ['2026-01', '2026-01-15']) {
    const result = calc(model(baseYear));
    close(result.ann.reimb[1], 240);
    close(result.ann.reimb[2], 504);
  }
  assert.equal(pD('2026'), null, 'general lease date parsing still requires a month');
});

test('a fiscal year-only base year identifies the fiscal label without guessing January', () => {
  const state = model('2027', true);
  state.tenants[0].start = '2026-07';
  const result = calc(state);
  close(result.ann.reimb[0], 0);
  close(result.ann.reimb[1], 0);
  close(result.ann.reimb[2], 264);
  // A dated January 2027 base year belongs to fiscal 2026 under this policy.
  state.tenants[0].baseYear = '2027-01';
  const dated = calc(state);
  close(dated.ann.reimb[1], 240);
  close(dated.ann.reimb[2], 504);
});

test('an option retaining the original stop also retains a year-only override', () => {
  const state = model('2026');
  Object.assign(state.tenants[0], {end: '2027-12', expiry: 'Option',
    optTermYears: 1, optRentBasis: 'psf', optRentAmt: 12,
    optRec: 'stop', optResetBase: false, optThen: 'Vacate'});
  const result = calc(state);
  close(result.ann.reimb[1], 240);
  close(result.ann.reimb[2], 504);
});

test('a pre-analysis base year keeps the existing first-year expense proxy', () => {
  const result = calc(model('2024'));
  close(result.ann.reimb[1], 240);
  close(result.ann.reimb[2], 504);
});
