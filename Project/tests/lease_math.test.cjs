const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/financial_engine.js'), 'utf8'), context);
const {blankState, calc} = vm.runInContext('({blankState, calc})', context);
function property(lease) {
  const s = blankState();
  Object.assign(s, {startYear: 2026, startMonth: 1, years: 1, gvRate: 0, clRate: 0});
  s.areas = [{id: 'space', sf: 2000, basis: true}];
  s.tenants = [{id: 'contract', name: 'Test lease', sf: 1000, rentBasis: 'moamt', rent: 3100,
    start: '2026-01-16', end: '2027-01-15', expiry: 'Vacate', mla: s.mlas[0].id,
    lcBasis: 'pct', lcAmt: .05, ...lease}];
  return s;
}
function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-7, `expected ${expected}, got ${actual}`);
}

test('term commission includes only occupied days and respects free rent and scheduled increases', () => {
  const s = property({free: 1, sched: [{date: '2026-07-16', mode: 'date', units: 'moamt', amt: 6200}]});
  // Commencement Jan 16 and expiry the following Jan 15. The July 16 step
  // makes two 6-month equivalents at $3,100 and $6,200. Free rent is Jan
  // 16–31 (16 / 31) and Feb 1–15 (15 / 28) at the first rate.
  const gross = 6 * 3100 + 6 * 6200;
  for (const net of [true, false]) {
    s.lcNetFree = net;
    near(calc(s).monthly.lc[0], .05 * (gross - (net ? 3100 * (16 / 31 + 15 / 28) : 0)));
  }
});

test('a leap-day lease earns one day of commissionable rent', () => {
  const s = property({start: '2028-02-29', end: '2028-02-29', rent: 2900});
  s.startYear = 2028;
  near(calc(s).monthly.lc[1], 5);
});

test('the full option term determines commission even when the option extends beyond the projection', () => {
  const s = property({end: '2026-12', expiry: 'Option', optTermYears: 3, optRentBasis: 'psf',
    optRentAmt: 24, optStep: .1, optFree: 2, optLC: .05, optThen: 'Vacate'});
  // On 1,000 SF, three full years of option base rent are $24k + $26.4k + $29.04k.
  for (const net of [true, false]) {
    s.lcNetFree = net;
    near(calc(s).monthly.lc[12], .05 * (24000 + 26400 + 29040 - (net ? 4000 : 0)));
  }
});

test('a whole-lease dollar rent schedule stays level across changes in leased area', () => {
  for (const field of ['basis', 'units']) {
    const s = property({start: '2026-01', end: '2026-12', rent: 0, lcBasis: 'none',
      areaSched: [{date: '2026-04', sf: 2000}, {date: '2026-10', sf: 500}],
      sched: [{mode: 'date', date: '2026-01', type: 'base', [field]: 'yramt', amt: 12000},
        {mode: 'date', date: '2026-07', type: 'base', [field]: 'moamt', amt: 3000}]});
    // The lease promises a fixed dollar payment, even as its SF changes.
    const result = calc(s);
    for (let month = 0; month < 12; month++) near(result.monthly.sched[month], month < 6 ? 1000 : 3000);
    near(result.ann.sched[0], 24000);
  }
});

test('reallocating a stepped dollar schedule preserves relative and additive rows', () => {
  const s = property({start: '2026-01', end: '2026-12', rent: 0, lcBasis: 'none',
    areaSched: [{date: '2026-04', sf: 2000}, {date: '2026-10', sf: 500}],
    sched: [{mode: 'date', date: '2026-01', type: 'base', units: 'moamt', amt: 1000},
      {mode: 'month', month: 2, type: 'inc', units: 'moamt', amt: 200},
      {mode: 'date', date: '2026-03', type: 'step', units: 'pct', amt: .1}]});
  const r = calc(s);
  near(r.monthly.sched[0], 1000);
  near(r.monthly.sched[1], 1200);
  for(let i=2;i<12;i++) near(r.monthly.sched[i], 1320);
});

test('renewal percentage uses the actual expiring rent even when market rents have grown', () => {
  const s=property({start:'2026-01',end:'2026-12',rentBasis:'psfyr',rent:12,lcBasis:'none',expiry:'Market'});
  Object.assign(s.mlas[0], {renewBasis:'prior', pctPrior:.9, renewProb:.75, downtime:0,
    mrNewRef:'', mrNewLocal:20, termYears:1, stepPct:0, frRef:'', frNewLocal:0});
  s.infl.find(i=>i.id==='mkt').rates=[0,.1,.1];
  // 75% of $10.80 (90% of contractual $12) and 25% of $22 (market $20 up 10%).
  near(calc(s).spaces[0].rollovers[0].rentPSF, 13.6);
  s.mlas[0].renewProb=1;
  s.mlas[0].pctPrior=0;
  near(calc(s).spaces[0].rollovers[0].rentPSF, 0);
});

test('upfront percentage commission covers only rent earned by each area band during its active months', () => {
  const s=property({start:'2026-01',end:'2026-12',rentBasis:'psfyr',rent:12,
    areaSched:[{date:'2026-04',sf:2000},{date:'2026-10',sf:500}]});
  // Three months at 1,000 SF, six at 2,000 and three at 500. $12/SF/year = $1/SF/month.
  near(calc(s).monthly.lc[0], .05 * (3*1000+6*2000+3*500));
  s.tenants[0].sched=[{date:'2026-01',units:'moamt',type:'base',amt:1000}];
  near(calc(s).monthly.lc[0], 600);
});

test('a maximum 100-year term commencing midmonth includes both partial calendar months', () => {
  const s=property({termMode:'term', termYears:100, termMonths:0, rentBasis:'moamt', rent:100});
  near(calc(s).monthly.lc[0], .05 * 1200 * 100);
});

test('successive renewals use the last occupied rate and disregard a step after the contract ends', () => {
  const s=property({start:'2026-01',end:'2026-12-15',rentBasis:'psfyr',rent:20,lcBasis:'none',expiry:'Renew',
    sched:[{date:'2026-12-01',units:'psfyr',amt:24},{date:'2027-01-01',units:'psfyr',amt:60}]});
  s.years=3;
  Object.assign(s.mlas[0], {renewBasis:'prior',pctPrior:.9,downtime:0,termYears:1,stepType:'none'});
  const rolls=calc(s).spaces[0].rollovers;
  near(rolls[0].rentPSF, .9*24);
  near(rolls[1].rentPSF, .9*.9*24);
});

test('a midmonth area change preserves whole-lease rent and its commission for entered and scheduled dollars', () => {
  for(const sf of [500, 2000]){
    for(const scheduled of [false, true]){
      const s=property({start:'2026-01',end:'2026-12',rentBasis:'moamt',rent:1000,
        areaSched:[{date:'2026-04-16',sf}],sched:scheduled?[{date:'2026-01',units:'moamt',amt:1000}]:[]});
      const r=calc(s);
      near(r.monthly.sched[3],1000);
      near(r.ann.sched[0],12000);
      near(r.monthly.lc[0],600);
    }
  }
});

test('annual steps continue throughout a supported 100-year lease', () => {
  const s = property({start: '2026-01', end: '2125-12', rent: 1000, step: .01, lcAmt: .05});
  // The commission is charged at commencement on all 100 annual rent payments.
  const expected = .05 * 12000 * Math.expm1(100 * Math.log1p(.01)) / .01;
  near(calc(s).monthly.lc[0], expected);
});
