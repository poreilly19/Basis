const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../src/workspace_preferences.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source, context);
const create = vm.runInContext('basisCreateWorkspacePreferences', context);
const key = 'basis.preferences.v1';
const defaults = {theme: 'system', autosave: true, autoFitColumns: true};
const plain = value => JSON.parse(JSON.stringify(value));
function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries)), writes = [];
  return {values, writes, getItem: name => values.get(name) ?? null,
    setItem(name, value) {writes.push([name, value]); values.set(name, String(value));}};
}
const stored = patch => JSON.stringify({v: 1, ...defaults, ...patch});

test('fresh preferences preserve automatic table sizing, autosave and the system theme', () => {
  const storage = memoryStorage(), preferences = create({storage});
  assert.deepEqual(plain(preferences.get()), defaults);
  assert.deepEqual(plain(preferences.status()), {saved: true, error: ''});
  assert.equal(storage.writes.length, 0);
});

test('legacy light and dark themes migrate without altering their old key or models', () => {
  for (const theme of ['light', 'dark']) {
    const storage = memoryStorage({'basis.theme': theme, 'basis.model': 'model bytes'});
    assert.equal(create({storage}).get().theme, theme);
    assert.equal(storage.values.get('basis.theme'), theme);
    assert.equal(storage.values.get('basis.model'), 'model bytes');
    assert.deepEqual(JSON.parse(storage.values.get(key)), {v: 1, ...defaults, theme});
    assert.deepEqual(storage.writes.map(([name]) => name), [key]);
  }
});

test('versioned system theme takes precedence over the legacy theme', () => {
  const storage = memoryStorage({[key]: stored({}), 'basis.theme': 'dark'});
  assert.deepEqual(plain(create({storage}).get()), defaults);
  assert.equal(storage.writes.length, 0);
});

test('missing or invalid legacy themes retain the system default', () => {
  for (const theme of [undefined, '', 'auto', 'DARK', 'true', '"dark"']) {
    const storage = memoryStorage(theme === undefined ? {} : {'basis.theme': theme});
    assert.equal(create({storage}).get().theme, 'system');
    assert.equal(storage.writes.length, 0);
  }
});

test('known preferences persist together and round-trip without model dependencies', () => {
  const storage = memoryStorage(), preferences = create({storage});
  const result = preferences.update({theme: 'dark', autosave: false, autoFitColumns: false});
  const expected = {theme: 'dark', autosave: false, autoFitColumns: false};
  assert.deepEqual(plain(result), {preferences: expected, saved: true, error: ''});
  assert.deepEqual(plain(create({storage}).get()), expected);
  assert.deepEqual(JSON.parse(storage.values.get(key)), {v: 1, ...expected});
});

test('getters, results and statuses do not expose mutable working state', () => {
  const preferences = create({storage: memoryStorage()});
  preferences.get().theme = 'dark';
  const result = preferences.update({autosave: false});
  result.preferences.autoFitColumns = false; result.error = 'changed';
  preferences.status().saved = false;
  assert.deepEqual(plain(preferences.get()), {...defaults, autosave: false});
  assert.deepEqual(plain(preferences.status()), {saved: true, error: ''});
});

test('invalid stored fields fall back individually while valid fields survive', () => {
  const storage = memoryStorage({[key]: stored({theme: 'sepia', autosave: false, autoFitColumns: 'false'})});
  const preferences = create({storage});
  assert.deepEqual(plain(preferences.get()), {...defaults, autosave: false});
  assert.equal(preferences.status().saved, false);
  assert.match(preferences.status().error, /invalid.*Defaults/);
  assert.equal(storage.writes.length, 0);
});

test('missing fields in a versioned record use defaults', () => {
  const preferences = create({storage: memoryStorage({[key]: '{"v":1,"theme":"light"}'})});
  assert.deepEqual(plain(preferences.get()), {...defaults, theme: 'light'});
});

test('malformed, oversized and unsupported records recover without overwriting storage', () => {
  for (const raw of ['{', 'null', '[]', 'true', '{}', '{"v":2,"theme":"dark"}', '{"v":"1"}', 'x'.repeat(17000)]) {
    const storage = memoryStorage({[key]: raw, 'basis.theme': 'dark'});
    const preferences = create({storage});
    assert.deepEqual(plain(preferences.get()), defaults);
    assert.equal(preferences.status().saved, false);
    assert.match(preferences.status().error, /could not be read.*Defaults/);
    assert.equal(storage.values.get(key), raw);
    assert.equal(storage.writes.length, 0);
  }
});

test('unsafe stored prototype keys are rejected without changing any prototype', () => {
  for (const reserved of ['__proto__', 'prototype', 'constructor']) {
    const raw = `{"v":1,"theme":"dark","${reserved}":{"polluted":true}}`;
    const preferences = create({storage: memoryStorage({[key]: raw})});
    assert.deepEqual(plain(preferences.get()), defaults);
    assert.equal(preferences.status().saved, false);
  }
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(vm.runInContext('Object.prototype.polluted', context), undefined);
});

test('unknown stored fields are ignored and never copied into later persistence', () => {
  const storage = memoryStorage({[key]: stored({theme: 'dark', unknown: {value: 1}, apiKey: 'discard-me'})});
  const preferences = create({storage});
  assert.deepEqual(Object.keys(preferences.get()).sort(), Object.keys(defaults).sort());
  preferences.update({autosave: false});
  assert.deepEqual(JSON.parse(storage.values.get(key)), {v: 1, ...defaults, theme: 'dark', autosave: false});
});

test('invalid updates reject atomically and never persist partial changes or credentials', () => {
  const storage = memoryStorage(), preferences = create({storage});
  for (const patch of [null, [], 'dark', new Date(), {theme: 'DARK'}, {theme: null}, {autosave: 0}, {autoFitColumns: 'true'}, {theme: 'dark', apiKey: 'do-not-store'}, {autosave: false, version: 1}, {[Symbol('hidden')]: true}]) {
    assert.throws(() => preferences.update(patch), /Workspace|workspace/);
    assert.deepEqual(plain(preferences.get()), defaults);
    assert.equal(storage.writes.length, 0);
  }
  for (const reserved of ['__proto__', 'prototype', 'constructor']) {
    assert.throws(() => preferences.update(JSON.parse(`{"${reserved}":true}`)), /Unknown workspace preference/);
  }
  assert.equal(storage.writes.length, 0);
});

test('accessor patches are rejected without executing their getters', () => {
  let calls = 0;
  const patch = Object.defineProperty({}, 'theme', {enumerable: true, get() {calls++; return 'dark';}});
  const storage = memoryStorage(), preferences = create({storage});
  assert.throws(() => preferences.update(patch), /Invalid workspace preference/);
  assert.equal(calls, 0);
  assert.deepEqual(plain(preferences.get()), defaults);
  assert.equal(storage.writes.length, 0);
});

test('plain patches from other realms and objects without prototypes are supported', () => {
  const preferences = create({storage: memoryStorage()});
  preferences.update({theme: 'light'});
  preferences.update(Object.assign(Object.create(null), {autosave: false}));
  assert.deepEqual(plain(preferences.get()), {...defaults, theme: 'light', autosave: false});
});

test('unavailable or blocked browser storage keeps settings usable for the session', () => {
  for (const storage of [null, {getItem() {throw Error('blocked');}, setItem() {throw Error('blocked');}}]) {
    const preferences = create({storage});
    assert.deepEqual(plain(preferences.get()), defaults);
    assert.equal(preferences.status().saved, false);
    assert.match(preferences.status().error, /session/);
    const result = preferences.update({theme: 'dark', autosave: false});
    assert.equal(result.saved, false);
    assert.match(result.error, /could not be saved.*session.*retry/);
    assert.deepEqual(plain(preferences.get()), {...defaults, theme: 'dark', autosave: false});
  }
});

test('default browser-storage lookup also handles a throwing localStorage getter', () => {
  const isolated = vm.createContext({});
  Object.defineProperty(isolated, 'localStorage', {get() {throw Error('denied');}});
  vm.runInContext(source, isolated);
  const preferences = vm.runInContext('basisCreateWorkspacePreferences()', isolated);
  assert.deepEqual(plain(preferences.get()), defaults);
  assert.equal(preferences.update({autosave: false}).saved, false);
});

test('quota failures preserve the latest working preferences and the previous durable copy', () => {
  const storage = memoryStorage({[key]: stored({theme: 'light'})});
  const previous = storage.values.get(key), write = storage.setItem;
  storage.setItem = () => {throw Error('quota exceeded');};
  const preferences = create({storage});
  let result = preferences.update({autosave: false});
  assert.equal(result.saved, false);
  assert.deepEqual(plain(preferences.get()), {...defaults, theme: 'light', autosave: false});
  assert.equal(storage.values.get(key), previous);
  result = preferences.update({autoFitColumns: false});
  assert.equal(result.saved, false);
  assert.deepEqual(plain(preferences.get()), {theme: 'light', autosave: false, autoFitColumns: false});
  storage.setItem = write;
  result = preferences.update({});
  assert.equal(result.saved, true);
  assert.equal(result.error, '');
  assert.deepEqual(plain(create({storage}).get()), {theme: 'light', autosave: false, autoFitColumns: false});
});

test('a legacy theme remains usable when its migration cannot be saved', () => {
  const storage = memoryStorage({'basis.theme': 'dark'});
  storage.setItem = () => {throw Error('quota');};
  const preferences = create({storage});
  assert.equal(preferences.get().theme, 'dark');
  assert.equal(preferences.status().saved, false);
  assert.match(preferences.status().error, /session/);
  assert.equal(storage.values.get('basis.theme'), 'dark');
  assert.equal(storage.values.has(key), false);
});

test('a user update repairs malformed saved settings after a recoverable read error', () => {
  const storage = memoryStorage({[key]: '{bad'}), preferences = create({storage});
  assert.equal(preferences.status().saved, false);
  assert.equal(preferences.update({theme: 'light'}).saved, true);
  assert.deepEqual(plain(create({storage}).get()), {...defaults, theme: 'light'});
  assert.equal(preferences.status().error, '');
});
