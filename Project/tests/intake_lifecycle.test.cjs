const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');
function segment(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Intake boundaries must exist: ${start}`);
  return html.slice(a, b);
}
const stateSource = segment('const INT={', 'const INT_EXT=');
const lifecycleSource = segment('function intTargetSnapshot()', '// ---- normalizing what comes back ----');
const mappingSource = segment('const iA=v=>', 'function intGaps()');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return {promise, resolve, reject}; };
const clone = value => JSON.parse(JSON.stringify(value));
async function until(predicate) {
  for (let attempt = 0; attempt < 30 && !predicate(); attempt++) await Promise.resolve();
  assert.ok(predicate(), 'Expected asynchronous boundary was reached');
}
const response = (name = 'Acme Tenant') => ({docType: 'lease', property: {name: 'Active property'},
  tenants: [{name, suite: '100', sf: 1000, start: '2026-01-01', end: '2030-12-31',
    rent: [{from: '2026-01-01', amount: 12000, unit: 'annual'}],
    src: {page: 1, quote: 'Annual rent is $12,000.'}}]});
const document = name => ({name, kind: 'Text', unit: 'Page', status: 'ready', on: true,
  pages: [{n: 1, text: 'Lease fixture', off: false}], images: [], results: [{prior: true}], err: 'Previous error'});

function setup() {
  const calls = [], confirmations = [], adoptions = [], activations = [], statuses = [], timers = new Map();
  let timerId = 0, dirty = 0, sampleCalls = 0, renders = 0, run;
  const handlers = {
    sample: () => service,
    json: () => Promise.resolve(response()),
    plan: () => {
      const docs = run('INT.docs').filter(doc => doc.on);
      return {docs, jobs: docs.map(doc => ({d: doc, c: {images: [], parts: doc.pages.filter(page => !page.off).map(page => page.text)}, k: 0, K: 1}))};
    },
    confirm: () => Promise.resolve(true),
    checks: () => [],
    adopt: () => Promise.resolve('new-property')
  };
  const service = {json(input, options) { const call = {input: clone(input), options}; calls.push(call); return handlers.json(call); }};
  const context = vm.createContext({TextEncoder, TextDecoder, AbortController,
    PW: {cur: 'property-a', pf: 'portfolio-a', sc: 'scenario-a'}, basisCalculationInvalidators: [],
    setTimeout(callback, milliseconds) { const id = ++timerId; timers.set(id, {callback, milliseconds}); return id; },
    clearTimeout(id) { timers.delete(id); }, drawPane() { renders++; },
    getSample() { sampleCalls++; return handlers.sample(); }, intPlan() { return handlers.plan(); },
    intPrompt(doc, chunk, index, count, model) { return JSON.stringify({document: doc.name, model: model.name, parts: chunk.parts, index, count}); },
    kConfirm(message) { confirmations.push(message); return handlers.confirm(message); },
    intChecks(extraction, docs) { return handlers.checks(extraction, docs); }, intGaps() { return []; },
    DIRTY() { dirty++; }, pwStatus(message) { statuses.push(message); },
    pwAdopt(model, options) { const call = {model: clone(model), options: clone(options)}; adoptions.push(call); return handlers.adopt(call); },
    pwActivate(id, model) { activations.push({id, model: clone(model)}); context.activationModel = model; context.PW.cur = id; run('S=activationModel'); }
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'src/financial_engine.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(root, 'src/native_codec.js'), 'utf8'), context, {timeout: 5000});
  vm.runInContext(stateSource + '\n' + mappingSource + '\n' + lifecycleSource, context, {timeout: 5000});
  run = source => vm.runInContext(source, context, {timeout: 5000});
  run(`S=blankState();Object.assign(S,{name:'Active property',startYear:2026,startMonth:1,years:2});
    S.areas=[{id:'building',name:'Building',sf:1000,basis:true}];S.tenants=[];S.ops=[];`);
  context.docs = [document('lease.txt')];
  run('INT.docs=docs');
  return {context, run, handlers, service, calls, confirmations, adoptions, activations, statuses, timers,
    get dirty() { return dirty; }, get sampleCalls() { return sampleCalls; }, get renders() { return renders; },
    fireTimers() { const active = [...timers.values()]; timers.clear(); active.forEach(timer => timer.callback()); }};
}

test('successful extraction stages real normalized inputs and provenance without changing the model', async () => {
  const f = setup(), before = f.run('JSON.stringify(S)');
  assert.equal(await f.run('intExtract()'), true);
  assert.equal(f.calls.length, 1);
  assert.equal(JSON.parse(f.calls[0].input[0].content).model, 'Active property');
  assert.equal(f.run('INT.x.tenants[0].r.steps[0].annual'), 12000);
  assert.equal(f.run('INT.x.tenants[0].r.src.doc'), 'lease.txt');
  assert.equal(f.run('INT.target.propertyId'), 'property-a');
  assert.equal(f.run('JSON.stringify(S)'), before);
  assert.equal(f.run('INT.busy'), false);
  assert.equal(f.run('INT.run'), null);
});

test('synchronous busy ownership prevents duplicate extraction before service discovery resolves', async () => {
  const f = setup(), gate = deferred(); f.handlers.sample = () => gate.promise;
  const first = f.run('intExtract()');
  assert.equal(f.run('INT.busy'), true);
  assert.equal(await f.run('intExtract()'), false);
  assert.equal(f.sampleCalls, 1);
  gate.resolve(f.service);
  assert.equal(await first, true);
  assert.equal(f.calls.length, 1);
});

test('editing the model while discovering the service prevents any document request', async () => {
  const f = setup(), gate = deferred(); f.handlers.sample = () => gate.promise;
  const pending = f.run('intExtract()'); f.run(`S.name='Edited while preparing'`); gate.resolve(f.service);
  assert.equal(await pending, false);
  assert.equal(f.calls.length, 0);
  assert.equal(f.run('INT.x'), null);
  assert.match(f.run('INT.err'), /model changed/i);
});

test('property, portfolio and scenario changes while planning invalidate the target', async () => {
  for (const field of ['cur', 'pf', 'sc']) {
    const f = setup(), gate = deferred(); let entered = false;
    f.handlers.plan = () => { entered = true; return gate.promise; };
    const pending = f.run('intExtract()'); await until(() => entered);
    f.context.PW[field] = 'different-' + field;
    const doc = f.run('INT.docs[0]'); gate.resolve({docs: [doc], jobs: [{d: doc, c: {parts: ['lease'], images: []}, k: 0, K: 1}]});
    assert.equal(await pending, false, `Target ${field} must remain current`);
    assert.equal(f.calls.length, 0);
  }
});

test('a late service reply after a model edit cannot publish results or overwrite document history', async () => {
  const f = setup(), gate = deferred(); f.handlers.json = () => gate.promise;
  const pending = f.run('intExtract()'); await until(() => f.calls.length === 1);
  f.run(`S.name='Current edit'`); gate.resolve(response());
  assert.equal(await pending, false);
  assert.equal(f.run('S.name'), 'Current edit');
  assert.equal(f.run('INT.docs[0].results[0].prior'), true);
  assert.equal(f.run('INT.x'), null);
});

test('removed or deselected documents and pages invalidate an in-flight extraction plan', async () => {
  for (const change of ['INT.docs.pop()', 'INT.docs[1].on=false', 'INT.docs[1].pages[0].off=true']) {
    const f = setup(), gate = deferred();
    f.context.docs.push(document('second.txt'));
    f.handlers.json = () => gate.promise;
    const pending = f.run('intExtract()'); await until(() => f.calls.length === 1);
    f.run(change); gate.resolve(response());
    assert.equal(await pending, false, change);
    assert.equal(f.calls.length, 1, 'No later request may send an excluded document/page');
    assert.equal(f.run('INT.x'), null);
  }
});

test('Stop clears ownership immediately and old replies cannot clear or replace a newer job', async () => {
  const f = setup(), old = deferred(), fresh = deferred();
  f.handlers.json = () => f.calls.length === 1 ? old.promise : fresh.promise;
  const previous = f.run('intExtract()'); await until(() => f.calls.length === 1);
  f.run('intStopExtraction()');
  assert.equal(f.run('INT.busy'), false);
  assert.equal(f.calls[0].options.signal.aborted, true);
  const next = f.run('intExtract()'); await until(() => f.calls.length === 2);
  old.resolve(response('Old Tenant'));
  assert.equal(await previous, false);
  assert.equal(f.run('INT.busy'), true);
  fresh.resolve(response('Fresh Tenant'));
  assert.equal(await next, true);
  assert.equal(f.run('INT.x.tenants[0].r.name'), 'Fresh Tenant');
});

test('rate-limit delay is abortable and stopping it never sends a retry', async () => {
  const f = setup(); f.handlers.json = () => Promise.reject(Object.assign(Error('Rate limited'), {code: 'rate_limited'}));
  const pending = f.run('intExtract()'); await until(() => f.timers.size === 1);
  assert.equal([...f.timers.values()][0].milliseconds, 30000);
  f.run('intStopExtraction()');
  assert.equal(f.timers.size, 0);
  assert.equal(await pending, false);
  assert.equal(f.calls.length, 1);
});

test('rate limiting retries exactly once and reports a repeated failure without looping', async () => {
  for (const succeeds of [true, false]) {
    const f = setup(); f.handlers.json = () => f.calls.length === 2 && succeeds ? Promise.resolve(response()) :
      Promise.reject(Object.assign(Error('Rate limited'), {code: 'rate_limited'}));
    const pending = f.run('intExtract()'); await until(() => f.timers.size === 1); f.fireTimers();
    assert.equal(await pending, succeeds);
    assert.equal(f.calls.length, 2);
    assert.equal(f.timers.size, 0);
    if (!succeeds) assert.match(f.run('INT.err'), /rate limited/i);
  }
});

test('large-plan confirmation rechecks the target before sending and releases declined jobs', async () => {
  for (const action of ['decline', 'change']) {
    const f = setup(), gate = deferred(); f.handlers.confirm = () => gate.promise;
    f.handlers.plan = () => { const doc = f.run('INT.docs[0]'); return {docs: [doc], jobs: Array.from({length: 16}, (_, k) => ({d: doc, c: {parts: ['lease'], images: []}, k, K: 16}))}; };
    const pending = f.run('intExtract()'); await until(() => f.confirmations.length === 1);
    if (action === 'change') f.run(`S.name='Changed while confirming'`);
    gate.resolve(action !== 'decline');
    assert.equal(await pending, false);
    assert.equal(f.calls.length, 0);
    assert.equal(f.run('INT.busy'), false);
  }
});

test('malformed or reserved-key extraction responses never become selectable model inputs', async () => {
  for (const invalid of [null, [], JSON.parse('{"property":{"__proto__":{"polluted":true}}}')]) {
    const f = setup(), before = f.run('JSON.stringify(S)'); f.handlers.json = () => Promise.resolve(invalid);
    assert.equal(await f.run('intExtract()'), false);
    assert.equal(f.run('INT.x'), null);
    assert.equal(f.run('JSON.stringify(S)'), before);
    assert.equal(f.run('INT.docs[0].results[0].prior'), true);
  }
});

test('merge applies a complete validated model once with actual tenant mapping and source log', async () => {
  const f = setup(); assert.equal(await f.run('intExtract()'), true);
  assert.equal(await f.run('intApplySelected()'), true);
  assert.equal(f.run('S.tenants.length'), 1);
  assert.equal(f.run('S.tenants[0].name'), 'Acme Tenant');
  assert.equal(f.run('S.tenants[0].rent'), 12);
  assert.equal(f.run('S.tenants[0].start'), '2026-01-01');
  assert.ok(f.run('S.srcLog.length') >= 4);
  assert.equal(f.run('S.srcLog[0].doc'), 'lease.txt');
  assert.equal(f.dirty, 1);
  assert.equal(f.adoptions.length, 0);
  assert.equal(f.run('INT.x'), null);
  assert.equal(f.run('INT.applying'), false);
});

test('failed apply validation rolls back all staged rows, source logs and live object identity', async () => {
  for (const invalid of [{valuation: {holdYears: 1000}}, {capital: [{name: 'Too far away', amount: 1000, date: '2127-01-01'}]}]) {
    const f = setup(); f.handlers.json = () => Promise.resolve({...response(), ...invalid});
    assert.equal(await f.run('intExtract()'), true);
    const model = f.run('S'), before = f.run('JSON.stringify(S)'), extraction = f.run('INT.x');
    assert.equal(await f.run('intApplySelected()'), false);
    assert.equal(f.run('S'), model);
    assert.equal(f.run('JSON.stringify(S)'), before);
    assert.equal(f.run('INT.x'), extraction);
    assert.match(f.run('INT.err'), /years|100.year|capital date/i);
    assert.equal(f.dirty, 0);
    assert.equal(f.adoptions.length, 0);
  }
});

test('apply confirmation rechecks model and selected inputs and blocks duplicate apply', async () => {
  for (const change of [`S.name='Edit during confirmation'`, `INT.pick['t:'+INT.x.tenants[0].key]=false`]) {
    const f = setup(), gate = deferred(); await f.run('intExtract()');
    f.handlers.checks = () => [{sev: 'error', msg: 'Review this input'}]; f.handlers.confirm = () => gate.promise;
    const pending = f.run('intApplySelected()'); await until(() => f.confirmations.length === 1);
    assert.equal(await f.run('intApplySelected()'), false);
    f.run(change); const current = f.run('JSON.stringify(S)'); gate.resolve(true);
    assert.equal(await pending, false);
    assert.equal(f.run('JSON.stringify(S)'), current);
    assert.equal(f.dirty, 0);
    assert.equal(f.run('INT.applying'), false);
  }
});

test('replace stages final data before storage and conditionally activates after save or failure', async () => {
  for (const outcome of ['current', 'edit', 'scenario', 'selection', 'mode', 'failed']) {
    const f = setup(), gate = deferred(); await f.run('intExtract()'); f.run(`INT.mode='replace'`);
    f.handlers.adopt = () => gate.promise;
    const before = f.run('JSON.stringify(S)'), pending = f.run('intApplySelected()'); await until(() => f.adoptions.length === 1);
    assert.equal(f.run('JSON.stringify(S)'), before);
    assert.equal(f.adoptions[0].model.tenants[0].name, 'Acme Tenant');
    assert.deepEqual(f.adoptions[0].options, {quiet: true, pf: 'portfolio-a', sc: 'scenario-a'});
    assert.equal(f.activations.length, 0);
    if (outcome === 'edit') f.run(`S.name='Edits kept during save'`);
    if (outcome === 'scenario') f.context.PW.sc = 'scenario-b';
    if (outcome === 'selection') f.run(`INT.pick['t:'+INT.x.tenants[0].key]=false`);
    if (outcome === 'mode') f.run(`INT.mode='merge'`);
    if (outcome === 'failed') gate.reject(Error('Storage failed')); else gate.resolve('saved-copy');
    assert.equal(await pending, outcome !== 'failed');
    assert.equal(f.activations.length, outcome === 'current' ? 1 : 0, outcome);
    if (outcome === 'current') assert.equal(f.run('S.tenants[0].name'), 'Acme Tenant');
    if (outcome === 'edit') assert.equal(f.run('S.name'), 'Edits kept during save');
    if (outcome === 'scenario') assert.equal(f.context.PW.sc, 'scenario-b');
    if (outcome === 'selection' || outcome === 'mode') assert.notEqual(f.run('INT.x'), null, 'Changed review stays available');
    if (outcome === 'failed') { assert.equal(f.run('JSON.stringify(S)'), before); assert.match(f.run('INT.err'), /storage failed/i); }
    assert.equal(f.run('INT.applying'), false);
  }
});
