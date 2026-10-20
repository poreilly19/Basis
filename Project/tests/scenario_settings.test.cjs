const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/scenario_settings.js'), 'utf8'), context);
const helpers = vm.runInContext('({basisScenarioSettings,basisSaveScenarioSettings,basisValidateScenarioSettings})', context);
const plain = value => JSON.parse(JSON.stringify(value));
const defaults = {version: 1, portDisc: .075, portCap: .065, portSingleExit: false, portResaleNoi: 'forward'};
const settings = overrides => ({...defaults, ...overrides});

test('reading a legacy scenario uses stable defaults without creating metadata', () => {
  const scenario = {id: 'base', name: 'Base'}, before = plain(scenario);
  for (const source of [{portDisc: .2}, {portDisc: .01}]) {
    context.S = source;
    assert.deepEqual(plain(helpers.basisScenarioSettings(scenario)), defaults);
  }
  assert.deepEqual(scenario, before);
  assert.equal(Object.hasOwn(scenario, 'settings'), false);
});

test('legacy fallback is explicit, typed and leaves property fields untouched', () => {
  const property = Object.freeze({name: 'Existing', portDisc: '0.12', portCap: '0.08', portSingleExit: true, portResaleNoi: 'trailing'});
  const result = helpers.basisScenarioSettings({id: 'base'}, property);
  assert.deepEqual(plain(result), settings({portDisc: .12, portCap: .08, portSingleExit: true, portResaleNoi: 'trailing'}));
  assert.equal(property.portDisc, '0.12');
  assert.equal(property.portCap, '0.08');
});

test('invalid legacy fields individually fall back to safe constants', () => {
  for (const value of [undefined, null, '', ' ', 'invalid', true, {}, [], NaN, Infinity, -Infinity]) {
    assert.equal(helpers.basisScenarioSettings(null, {portDisc: value}).portDisc, defaults.portDisc);
    assert.equal(helpers.basisScenarioSettings(null, {portCap: value}).portCap, defaults.portCap);
  }
  assert.equal(helpers.basisScenarioSettings(null, {portDisc: -1}).portDisc, defaults.portDisc);
  assert.equal(helpers.basisScenarioSettings(null, {portCap: -1}).portCap, defaults.portCap);
  assert.equal(helpers.basisScenarioSettings(null, {portSingleExit: 'true'}).portSingleExit, false);
  assert.equal(helpers.basisScenarioSettings(null, {portResaleNoi: 'other'}).portResaleNoi, 'forward');
  assert.equal(helpers.basisScenarioSettings(null, {portCap: 0, portSingleExit: true}).portCap, defaults.portCap);
});

test('an explicit first update can seed remaining fields from a legacy snapshot', () => {
  const scenario = {id: 'base', name: 'Base'}, legacy = {portDisc: .1, portCap: .08, portSingleExit: true, portResaleNoi: 'trailing'};
  const result = helpers.basisSaveScenarioSettings(scenario, {portDisc: .12}, legacy);
  assert.deepEqual(plain(result.settings), settings({...legacy, portDisc: .12}));
  assert.deepEqual(scenario, {id: 'base', name: 'Base'});
  assert.deepEqual(legacy, {portDisc: .1, portCap: .08, portSingleExit: true, portResaleNoi: 'trailing'});
});

test('stored scenario valuation is independent of the active property or fallback', () => {
  const migrated = helpers.basisSaveScenarioSettings({id: 'base'}, {}, {portDisc: .14, portCap: .09});
  const result = helpers.basisScenarioSettings(migrated, {portDisc: .01, portCap: .02, portSingleExit: true});
  assert.deepEqual(plain(result), settings({portDisc: .14, portCap: .09}));
  assert.equal(helpers.basisSaveScenarioSettings(migrated, {portResaleNoi: 'trailing'}, {portDisc: .7}).settings.portDisc, .14);
});

test('separate scenarios retain distinct settings without shared object aliases', () => {
  const base = helpers.basisSaveScenarioSettings({id: 'base'}, {portDisc: .08});
  const downside = helpers.basisSaveScenarioSettings({...plain(base), id: 'down'}, {portDisc: .12, portSingleExit: true, portCap: .09});
  downside.settings.portDisc = .2;
  assert.equal(base.settings.portDisc, .08);
  const read = helpers.basisScenarioSettings(base);
  read.portDisc = .6;
  assert.equal(base.settings.portDisc, .08);
});

test('unknown additive scenario and settings data survive known-field edits', () => {
  const scenario = {id: 'base', name: 'Base', metadata: {tag: ['future', 0, false]}, settings: settings({future: {key: ['kept']}})};
  const result = helpers.basisSaveScenarioSettings(scenario, {portDisc: .11});
  assert.deepEqual(plain(result.metadata), scenario.metadata);
  assert.deepEqual(plain(result.settings.future), scenario.settings.future);
  result.metadata.tag.push('new');
  result.settings.future.key.push('new');
  assert.deepEqual(scenario.metadata.tag, ['future', 0, false]);
  assert.deepEqual(scenario.settings.future.key, ['kept']);
});

test('stored settings require a supported version and all four known typed fields', () => {
  for (const invalid of [null, [], 1, 'settings', {}, settings({version: 0}), settings({version: 2}), settings({version: '1'})]) {
    assert.throws(() => helpers.basisValidateScenarioSettings(invalid), /settings|version/);
  }
  for (const key of ['portDisc', 'portCap', 'portSingleExit', 'portResaleNoi']) {
    const candidate = settings(); delete candidate[key];
    assert.throws(() => helpers.basisScenarioSettings({settings: candidate}), /discount|cap|boolean|NOI/);
  }
});

test('known settings reject numeric text, invalid rates, truthy flags and unknown NOI modes', () => {
  for (const candidate of [settings({portDisc: '0.1'}), settings({portCap: '0.08'}), settings({portDisc: -1}), settings({portDisc: NaN}), settings({portCap: Infinity}), settings({portCap: -0.01}), settings({portSingleExit: 'false'}), settings({portResaleNoi: 'other'})]) {
    assert.throws(() => helpers.basisValidateScenarioSettings(candidate), /Scenario|scenario/);
  }
});

test('zero rates and negative discount rates retain the supported financial domain', () => {
  assert.equal(helpers.basisValidateScenarioSettings(settings({portDisc: 0})).portDisc, 0);
  assert.equal(helpers.basisValidateScenarioSettings(settings({portDisc: -.99})).portDisc, -.99);
  assert.equal(helpers.basisValidateScenarioSettings(settings({portCap: 0})).portCap, 0);
  assert.throws(() => helpers.basisValidateScenarioSettings(settings({portSingleExit: true, portCap: 0})), /positive cap/);
  assert.equal(helpers.basisValidateScenarioSettings(settings({portDisc: 5, portCap: 2, portSingleExit: true})).portCap, 2);
});

test('failed updates are recoverable and leave the original scenario unchanged', () => {
  const scenario = {id: 'base', settings: settings({portCap: 0})}, before = plain(scenario);
  for (const patch of [{portSingleExit: true}, {portDisc: -1}, {version: 2}, {portDiscc: .1}, null, []]) {
    assert.throws(() => helpers.basisSaveScenarioSettings(scenario, patch), /scenario|Scenario|cap|version/);
    assert.deepEqual(scenario, before);
  }
});

test('unsafe or non-JSON additive metadata is rejected without altering prototypes', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const candidate = JSON.parse(JSON.stringify(settings()).replace(/}$/, `,"future":{"${key}":true}}`));
    assert.throws(() => helpers.basisValidateScenarioSettings(candidate), /Reserved scenario/);
  }
  for (const value of [new Date(), undefined, () => {}, NaN]) assert.throws(() => helpers.basisValidateScenarioSettings(settings({future: value})), /JSON|non-finite/);
  const circular = settings(); circular.future = circular;
  assert.throws(() => helpers.basisValidateScenarioSettings(circular), /circular/);
  assert.equal(Object.prototype.future, undefined);
});
