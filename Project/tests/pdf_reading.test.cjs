const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');
const first = html.indexOf('/* BEGIN BASIS PDF READING */'), last = html.indexOf('/* END BASIS PDF READING */', first);
const checkFirst = html.indexOf('function iReadCheck(scope)'), checkLast = html.indexOf('function iReadCancelDocument(', checkFirst);
assert.ok(first >= 0 && last > first && checkFirst >= 0 && checkLast > checkFirst, 'PDF reading source boundaries must exist');
const source = fs.readFileSync(path.join(root, 'src/pdf_loader.js'), 'utf8') + '\n' + html.slice(checkFirst, checkLast) + '\n' + html.slice(first, last);
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return {promise, resolve, reject}; };
const flush = async () => { for (let i = 0; i < 32; i++) await Promise.resolve(); };
async function until(predicate) { for (let i = 0; i < 80 && !predicate(); i++) await Promise.resolve(); assert.ok(predicate(), 'Expected PDF operation boundary was reached'); }
const textItem = (str, x = 0, y = 100, width = 100) => ({str, transform: [1, 0, 0, 10, x, y], width});

function setup() {
  const timers = new Map(), canvases = [], pages = new Map(), progress = [];
  const counts = {load: 0, open: 0, taskDestroy: 0, pdfDestroy: 0, getPage: [], text: [], pageCleanup: [], render: 0, cancel: 0, fills: [], encoded: []};
  let timerId = 0;
  const handlers = {
    load: () => Promise.resolve(library), open: () => Promise.resolve(pdf),
    taskDestroy: () => Promise.resolve(), pdfDestroy: () => Promise.resolve(),
    getPage: n => Promise.resolve(page(n)),
    text: () => Promise.resolve({items: [textItem('A readable lease document with enough content to avoid scanned-page fallback.')]}),
    render: () => Promise.resolve(), encode: callback => callback(new Blob(['encoded'], {type: 'image/jpeg'})),
    context: () => ({fillRect: (...args) => counts.fills.push(args)})
  };
  function page(n) {
    if (!pages.has(n)) pages.set(n, {
      getTextContent() { counts.text.push(n); return handlers.text(n); },
      cleanup() { counts.pageCleanup.push(n); },
      getViewport({scale}) { return {width: 800 * scale, height: 600 * scale, scale}; },
      render(options) { counts.render++; counts.lastRender = options; return {promise: handlers.render(n), cancel() { counts.cancel++; }}; }
    });
    return pages.get(n);
  }
  const pdf = {numPages: 1, getPage(n) { counts.getPage.push(n); return handlers.getPage(n); },
    destroy() { counts.pdfDestroy++; return handlers.pdfDestroy(); }};
  const task = {get promise() { return handlers.open(); }, destroy() { counts.taskDestroy++; return handlers.taskDestroy(); }};
  const library = {getDocument(options) { counts.open++; counts.openOptions = options; return task; }};
  const context = vm.createContext({AbortController, Uint8Array, TextEncoder,
    IREAD_LIMITS: {file: 32 * 1024 * 1024, pdfPages: 300},
    intPdfLib() { counts.load++; return handlers.load(); },
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, {callback, delay}); return id; },
    clearTimeout(id) { timers.delete(id); },
    document: {createElement(tag) {
      assert.equal(tag, 'canvas');
      const canvas = {width: 0, height: 0, getContext: () => handlers.context(),
        toBlob(callback, mime, quality) { counts.encoded.push({mime, quality, width: canvas.width, height: canvas.height}); handlers.encode(callback); }};
      canvases.push(canvas); return canvas;
    }}
  });
  vm.runInContext(source, context, {filename: 'basis-pdf-reading.js', timeout: 5000});
  const api = vm.runInContext('({intPdf,intRenderPage,intCanvasBlob,intPdfCleanup})', context);
  function scope() {
    const controller = new AbortController();
    return {controller, active: () => !controller.signal.aborted, signal: controller.signal,
      pdfTimeouts: {load: 11, open: 13, page: 17, render: 19, dispose: 23}};
  }
  return {api, context, handlers, pdf, task, library, counts, canvases, timers, page, progress, scope,
    read: requestScope => api.intPdf(new ArrayBuffer(4), (n, total) => progress.push([n, total]), requestScope),
    hasTimer: delay => [...timers.values()].some(timer => timer.delay === delay),
    expire(delay) {
      const entry = [...timers].find(([, timer]) => timer.delay === delay);
      assert.ok(entry, `Expected active ${delay}ms PDF deadline`);
      timers.delete(entry[0]); entry[1].callback();
    }};
}
const named = name => error => error && error.name === name;

test('normal PDF text keeps row/column layout, scan detection, progress and caller-owned cleanup', async () => {
  const f = setup(); f.pdf.numPages = 2;
  f.handlers.text = n => Promise.resolve({items: n === 2 ? [] : [
    textItem('$12,000', 160, 80, 50), textItem('Annual rent', 160, 100, 80),
    textItem('Boston', 25, 60, 40), textItem('Tenant', 0, 100, 40),
    textItem('Acme Distribution', 0, 80, 110), textItem('City', 0, 60, 20)
  ]});
  f.page(2).cleanup = () => { f.counts.pageCleanup.push(2); return Promise.reject(Error('Late page cleanup rejection')); };
  const result = await f.read(f.scope());
  assert.equal(result.pdf, f.pdf);
  assert.deepEqual(structuredClone(result.pages), [{n: 1, text: 'Tenant | Annual rent\nAcme Distribution | $12,000\nCity Boston'}, {n: 2, text: ''}]);
  assert.deepEqual(Array.from(result.scans), [2]);
  assert.deepEqual(f.progress, [[1, 2], [2, 2]]);
  assert.deepEqual(f.counts.pageCleanup, [1, 2]);
  assert.equal(f.counts.pdfDestroy, 0, 'Caller may still render scanned pages');
  assert.equal(f.counts.openOptions.isEvalSupported, false);
  assert.equal(f.counts.openOptions.maxImageSize, 40000000);
  assert.ok(f.counts.openOptions.data instanceof Uint8Array);
  await f.api.intPdfCleanup(result.pdf, f.scope());
  assert.equal(f.counts.pdfDestroy, 1);
  assert.equal(f.timers.size, 0);
});

test('oversized and already-stopped PDF inputs never load or open a reader', async () => {
  const f = setup();
  await assert.rejects(f.api.intPdf({byteLength: 32 * 1024 * 1024 + 1}, null, f.scope()), /32 MiB/);
  const scope = f.scope(); scope.controller.abort();
  await assert.rejects(f.read(scope), named('AbortError'));
  await assert.rejects(f.read({...f.scope(), active: () => false}), named('AbortError'));
  assert.equal(f.counts.load, 0);
  assert.equal(f.counts.open, 0);
  assert.equal(f.timers.size, 0);
});

test('stalled PDF reader loading is bounded or aborted and late modules cannot open a document', async () => {
  for (const stop of ['timeout', 'abort']) {
    const f = setup(), gate = deferred(), scope = f.scope(); f.handlers.load = () => gate.promise;
    const pending = f.read(scope), rejected = assert.rejects(pending, named(stop === 'timeout' ? 'TimeoutError' : 'AbortError'));
    await until(() => f.hasTimer(11));
    if (stop === 'timeout') f.expire(11); else scope.controller.abort();
    await rejected; gate.resolve(f.library); await flush();
    assert.equal(f.counts.open, 0);
    assert.equal(f.timers.size, 0);
  }
});

test('pending PDF opening stops its loading task and destroys a late document', async () => {
  for (const stop of ['timeout', 'abort']) {
    const f = setup(), gate = deferred(), scope = f.scope(); f.handlers.open = () => gate.promise;
    const pending = f.read(scope), rejected = assert.rejects(pending, named(stop === 'timeout' ? 'TimeoutError' : 'AbortError'));
    await until(() => f.hasTimer(13));
    if (stop === 'timeout') f.expire(13); else scope.controller.abort();
    await rejected;
    assert.equal(f.counts.taskDestroy, 1);
    gate.resolve(f.pdf); await flush();
    assert.equal(f.counts.pdfDestroy, 1);
    assert.deepEqual(f.counts.getPage, []);
    assert.equal(f.timers.size, 0);
  }
});

test('page acquisition deadline closes the PDF and cleans a page that arrives late', async () => {
  const f = setup(), gate = deferred(); f.handlers.getPage = () => gate.promise;
  const pending = f.read(f.scope()), rejected = assert.rejects(pending, named('TimeoutError'));
  await until(() => f.hasTimer(17)); f.expire(17); await rejected;
  assert.equal(f.counts.pdfDestroy, 1);
  assert.deepEqual(f.counts.pageCleanup, []);
  gate.resolve(f.page(1)); await flush();
  assert.deepEqual(f.counts.pageCleanup, [1]);
  assert.deepEqual(f.counts.text, []);
  assert.equal(f.timers.size, 0);
});

test('pending text extraction is bounded or aborted and releases the page and document', async () => {
  for (const stop of ['timeout', 'abort']) {
    const f = setup(), gate = deferred(), scope = f.scope(); f.pdf.numPages = 2; f.handlers.text = () => gate.promise;
    const pending = f.read(scope), rejected = assert.rejects(pending, named(stop === 'timeout' ? 'TimeoutError' : 'AbortError'));
    await until(() => f.counts.text.length === 1 && f.hasTimer(17));
    if (stop === 'timeout') f.expire(17); else scope.controller.abort();
    await rejected; gate.resolve({items: []}); await flush();
    assert.deepEqual(f.counts.getPage, [1]);
    assert.deepEqual(f.counts.pageCleanup, [1]);
    assert.equal(f.counts.pdfDestroy, 1);
    assert.deepEqual(f.progress, []);
    assert.equal(f.timers.size, 0);
  }
});

test('cleanup is idempotent and a destroy promise that never settles cannot block forever', async () => {
  const f = setup(), gate = deferred(); f.handlers.pdfDestroy = () => gate.promise;
  const first = f.api.intPdfCleanup(f.pdf, f.scope()), second = f.api.intPdfCleanup(f.pdf, f.scope());
  assert.equal(first, second);
  assert.equal(f.counts.pdfDestroy, 1);
  await until(() => f.hasTimer(23)); f.expire(23); await Promise.all([first, second]);
  gate.reject(Error('Late cleanup failure')); await flush();
  assert.equal(f.timers.size, 0);
  const broken = setup(), destroy = deferred();
  broken.handlers.text = () => Promise.reject(Error('Text failed'));
  broken.handlers.pdfDestroy = () => destroy.promise;
  const pending = broken.read(broken.scope()), rejected = assert.rejects(pending, /Text failed/);
  await until(() => broken.hasTimer(23)); broken.expire(23); await rejected;
  assert.equal(broken.counts.pdfDestroy, 1);
  assert.equal(broken.timers.size, 0);
});

test('invalid page counts and excessive text item arrays fail before expensive traversal', async () => {
  for (const count of [0, -1, 1.5, 301, Infinity, '2']) {
    const f = setup(); f.pdf.numPages = count;
    await assert.rejects(f.read(f.scope()), /300.page|page.*limit/i);
    assert.deepEqual(f.counts.getPage, []);
    assert.equal(f.counts.pdfDestroy, 1);
  }
  for (const items of [null, {}, new Array(200001)]) {
    const f = setup(); f.handlers.text = () => Promise.resolve({items});
    await assert.rejects(f.read(f.scope()), /item budget/i);
    assert.deepEqual(f.counts.pageCleanup, [1]);
    assert.equal(f.counts.pdfDestroy, 1);
  }
});

test('decoded PDF text enforces UTF-8 page and document budgets and validates text positions', async () => {
  async function readItems(items, limits, numPages = 1) {
    const f = setup(), scope = f.scope(); scope.pdfTextLimits = limits; f.pdf.numPages = numPages;
    f.handlers.text = () => Promise.resolve({items});
    return {f, scope, pending: f.read(scope)};
  }
  const boundary = await readItems([
    {type: 'beginMarkedContentProps', id: 'mc'},
    {...textItem('東京'), transform: new Float64Array([1, 0, 0, 10, 0, 100])}
  ], {page: 6, document: 12}, 2);
  const result = await boundary.pending;
  assert.deepEqual(structuredClone(result.pages), [{n: 1, text: '東京'}, {n: 2, text: '東京'}]);
  assert.equal(boundary.f.counts.pdfDestroy, 0);
  await boundary.f.api.intPdfCleanup(result.pdf, boundary.scope);

  const columns = [textItem('A', 0, 100, 1), textItem('B', 100, 100, 1)];
  for (const [items, limits, numPages, failedPage = numPages] of [
    [[textItem('東京')], {page: 5, document: 100}, 1], // Two characters occupy six UTF-8 bytes.
    [[textItem('abcdef')], {page: 5, document: 100}, 1], // Reject before encoding an oversized string.
    [[textItem('      ')], {page: 5, document: 100}, 1], // Whitespace counts before trimming.
    [columns, {page: 4, document: 100}, 1], // Added " | " separators count after formatting.
    [[textItem('東京')], {page: 8, document: 11}, 2],
    [columns, {page: 20, document: 8}, 2], // Formatted cumulative bytes exceed raw item bytes.
    [[textItem(' A ')], {page: 5, document: 5}, 3, 2] // Trimming must not erase prior decoded bytes.
  ]) {
    const {f, pending} = await readItems(items, limits, numPages);
    await assert.rejects(pending, /byte budget/);
    assert.equal(f.counts.pdfDestroy, 1);
    assert.deepEqual(f.counts.pageCleanup, Array.from({length: failedPage}, (_, i) => i + 1));
    assert.deepEqual(f.progress, Array.from({length: failedPage - 1}, (_, i) => [i + 1, numPages]));
    assert.equal(f.timers.size, 0);
  }
  const invalidItems = [null, {str: 12}, {...textItem('x'), transform: undefined},
    {...textItem('x'), transform: [1, 0, 0, 10, 0]},
    {...textItem('x'), transform: [1, 0, 0, 10, 0, 100, 1]},
    {...textItem('x'), transform: [1, 0, 0, 10, Infinity, 100]},
    {...textItem('x'), transform: [1, 0, 0, 10, 0, NaN]},
    {...textItem('x'), transform: [1, 0, 0, 10, '0', 100]},
    {...textItem('x'), width: Infinity}, {...textItem('x'), width: '12'}];
  for (const item of invalidItems) {
    const {f, pending} = await readItems([item], {page: 64, document: 128});
    await assert.rejects(pending, /invalid text (data|positioning data)/);
    assert.deepEqual(f.counts.pageCleanup, [1]);
    assert.equal(f.counts.pdfDestroy, 1);
    assert.equal(f.timers.size, 0);
  }
  for (const limits of [{page: 0, document: 8}, {page: 1.5, document: 8}, {page: 8, document: Infinity}]) {
    const {f, pending} = await readItems([], limits);
    await assert.rejects(pending, /Invalid PDF text budget/);
    assert.deepEqual(f.counts.getPage, []);
    assert.equal(f.counts.pdfDestroy, 1);
    assert.equal(f.timers.size, 0);
  }
});

test('normal scanned-page rendering scales its viewport, encodes JPEG and releases canvas dimensions', async () => {
  const f = setup(), result = await f.api.intRenderPage(f.pdf, 1, f.scope());
  assert.equal(result.type, 'image/jpeg');
  assert.equal(f.counts.render, 1);
  assert.equal(f.counts.cancel, 0);
  assert.equal(f.counts.lastRender.viewport.width, 1700);
  assert.equal(f.counts.lastRender.viewport.height, 1275);
  assert.deepEqual(f.counts.encoded, [{mime: 'image/jpeg', quality: .82, width: 1700, height: 1275}]);
  assert.deepEqual(f.counts.pageCleanup, [1]);
  assert.equal(f.counts.pdfDestroy, 0);
  assert.equal(f.canvases[0].width, 0);
  assert.equal(f.canvases[0].height, 0);
  assert.equal(f.timers.size, 0);
});

test('page acquisition, render-task and encoding deadlines close the PDF and clean late resources', async () => {
  for (const stage of ['page', 'render', 'encode']) {
    const f = setup(), gate = deferred();
    if (stage === 'page') f.handlers.getPage = () => gate.promise;
    else if (stage === 'render') f.handlers.render = () => gate.promise;
    else f.handlers.encode = () => {};
    const pending = f.api.intRenderPage(f.pdf, 1, f.scope()), rejected = assert.rejects(pending, named('TimeoutError'));
    await until(() => f.hasTimer(19) && (stage === 'page' || stage === 'render' && f.counts.render === 1 || stage === 'encode' && f.counts.encoded.length === 1)); f.expire(19); await rejected;
    assert.equal(f.counts.pdfDestroy, 1);
    if (stage === 'page') gate.resolve(f.page(1)); else gate.resolve();
    await flush();
    assert.deepEqual(f.counts.pageCleanup, [1]);
    if (stage !== 'page') { assert.ok(f.counts.cancel >= 1); assert.equal(f.canvases[0].width, 0); assert.equal(f.canvases[0].height, 0); }
    assert.equal(f.timers.size, 0);
  }
});

test('Stop during rendering or JPEG encoding settles immediately and releases allocated resources', async () => {
  for (const stage of ['render', 'encode']) {
    const f = setup(), gate = deferred(), scope = f.scope();
    if (stage === 'render') f.handlers.render = () => gate.promise; else f.handlers.encode = () => {};
    let settled = false, resultError;
    const pending = f.api.intRenderPage(f.pdf, 1, scope).then(() => { settled = true; }, error => { settled = true; resultError = error; });
    await until(() => stage === 'render' ? f.counts.render === 1 : f.counts.encoded.length === 1);
    scope.controller.abort(); await flush();
    const stoppedPromptly = settled;
    // Let a broken implementation finish after its encoding timeout so this
    // regression fails as an assertion, without leaving pending test promises.
    if (!settled && f.hasTimer(15000)) { f.expire(15000); await flush(); }
    await pending;
    assert.equal(stoppedPromptly, true, `${stage} must not wait for a callback/deadline after Stop`);
    assert.equal(resultError && resultError.name, 'AbortError');
    assert.equal(f.counts.pdfDestroy, 1);
    assert.deepEqual(f.counts.pageCleanup, [1]);
    assert.equal(f.canvases[0].width, 0);
    assert.equal(f.canvases[0].height, 0);
    assert.equal(f.timers.size, 0);
    gate.resolve();
  }
});

test('canvas budgets, failed drawing, unavailable contexts and encoding failures always release dimensions', async () => {
  for (const [width, height] of [[0, 1], [-1, 1], [Infinity, 1], [1, NaN], [2001, 2000]]) {
    const f = setup(); await assert.rejects(f.api.intCanvasBlob(() => {}, width, height), /canvas size budget/);
    assert.equal(f.canvases.length, 0);
  }
  for (const width of [0, Infinity, NaN]) {
    const f = setup(); f.page(1).getViewport = () => ({width, height: 100});
    await assert.rejects(f.api.intRenderPage(f.pdf, 1, f.scope()), /invalid preview dimensions/);
    assert.equal(f.canvases.length, 0);
    assert.equal(f.counts.pdfDestroy, 1);
    assert.deepEqual(f.counts.pageCleanup, [1]);
  }
  for (const failure of ['draw', 'context', 'null', 'timeout']) {
    const f = setup(); let draw = () => {};
    if (failure === 'draw') draw = () => { throw Error('Drawing failed'); };
    if (failure === 'context') f.handlers.context = () => null;
    if (failure === 'null') f.handlers.encode = callback => callback(null);
    if (failure === 'timeout') f.handlers.encode = () => {};
    const pending = f.api.intCanvasBlob(draw, 100.5, 50.2), rejected = assert.rejects(pending, /Drawing failed|unavailable|encoded|time limit/);
    if (failure === 'timeout') { await until(() => f.hasTimer(15000)); f.expire(15000); }
    await rejected;
    assert.equal(f.canvases[0].width, 0);
    assert.equal(f.canvases[0].height, 0);
    assert.equal(f.timers.size, 0);
  }
});
