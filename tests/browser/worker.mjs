// CTMWorker (runtime/pyodide-worker.js) in Chromium with real Pyodide (T3 of
// the step-3 design, §18.5). Pyodide comes from a local server that behaves
// like jsDelivr (CORS, CORP, immutable caching, strong ETags, byte ranges, an
// optional throttle shared by all responses); the page comes from a second
// server, with COOP/COEP headers (/h/) or without them and with ctm-libs'
// coi-serviceworker.js (/s/, as on GitHub Pages).
//
//   node tests/browser/worker.mjs [scenario ...]
//
// The distribution: PYODIDE_DIST=<folder with pyodide.mjs, the lock file and
// the wheels>, or the files are fetched from jsDelivr once and kept in
// PYODIDE_CACHE (default .pyodide-cache/). PYODIDE_OLD=0.27.2 also checks a
// project that pins an older Pyodide (base-url, build-variant; N5).
// Scenarios (all by default): cache, cdn, check, starvation, stall, restart, isolation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import zlib from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIB = path.join(ROOT, '_extensions', 'ctm-libs', 'runtime');
const VERSION = fs.readFileSync(path.join(LIB, 'pyodide-runtime.js'), 'utf8').match(/var indexURL = 'https:\/\/cdn\.jsdelivr\.net\/pyodide\/v([\d.]+)\/full\/';/)[1];
const CACHE = process.env.PYODIDE_CACHE || path.join(ROOT, '.pyodide-cache');
const BACKGROUND = {packages: ['pyodide_http', 'micropip', 'matplotlib'], run: 'import pyodide_http\npyodide_http.patch_all()'};
const all = ['cache', 'cdn', 'check', 'starvation', 'stall', 'restart', 'isolation'];
const scenarios = process.argv.slice(2).length ? process.argv.slice(2) : all;

// --- The CDN: /<version>/<file> ---------------------------------------------
function cdnServer() {
  // jsdelivr: every wheel response as jsDelivr sends it (set review, 21 Oct):
  // a weak ETag, Vary: Accept-Encoding and no Accept-Ranges; a full request
  // that accepts gzip gets the wheel gzip-encoded (Chromium asks for
  // identity on byte ranges, so ranges stay plain).
  const state = {rate: 0, latency: 0, log: [], stall: null, jsdelivr: false};
  const encoded = new Map();
  const active = new Set();
  setInterval(() => {
    if (!active.size) return;
    const share = state.rate ? Math.max(1, Math.floor(state.rate / 20 / active.size)) : Infinity;
    for (const job of [...active]) job.pump(share);
  }, 50).unref();
  async function file(version, name) {
    if (process.env.PYODIDE_DIST && version === VERSION) return path.join(process.env.PYODIDE_DIST, name);
    const target = path.join(CACHE, version, name);
    if (!fs.existsSync(target)) {
      const response = await fetch(`https://cdn.jsdelivr.net/pyodide/v${version}/full/${name}`);
      if (!response.ok) return null;
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.writeFileSync(target + '.part', Buffer.from(await response.arrayBuffer()));
      fs.renameSync(target + '.part', target);
    }
    return target;
  }
  const server = http.createServer(async (req, res) => {
    const [, version, name] = new URL(req.url, 'http://x').pathname.split('/');
    const where = name && /^[\w.+-]+$/.test(name) ? await file(version, name) : null;
    const cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Expose-Headers': '*'};
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    if (!where || !fs.existsSync(where)) { res.writeHead(404, cors); res.end(); return; }
    let body = fs.readFileSync(where);
    const stat = fs.statSync(where);
    const types = {'.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json'};
    const headers = {...cors, 'Content-Type': types[path.extname(where)] || 'application/octet-stream', 'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cache-Control': 'public, max-age=31536000, immutable', 'ETag': `"${stat.size}-${Math.floor(stat.mtimeMs)}"`,
      'Last-Modified': stat.mtime.toUTCString(), 'Accept-Ranges': 'bytes'};
    if (state.jsdelivr && name.endsWith('.whl')) {
      delete headers['Accept-Ranges'];
      Object.assign(headers, {'Vary': 'Accept-Encoding', 'ETag': `W/"${stat.size}-${Math.floor(stat.mtimeMs)}"`});
      if (!req.headers.range && /gzip/.test(req.headers['accept-encoding'] || '')) {
        if (!encoded.has(where)) encoded.set(where, zlib.gzipSync(body));
        body = encoded.get(where);
        headers['Content-Encoding'] = 'gzip';
      }
    }
    let start = 0, end = body.length - 1, status = 200;
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
    if (range) {
      start = Number(range[1]); end = range[2] ? Math.min(Number(range[2]), end) : end; status = 206;
      if (start >= body.length) { res.writeHead(416, {...headers, 'Content-Range': `bytes */${body.length}`}); res.end(); return; }
      headers['Content-Range'] = `bytes ${start}-${end}/${body.length}`;
    }
    const slice = body.subarray(start, end + 1);
    headers['Content-Length'] = slice.length;
    const entry = {t: Date.now(), method: req.method, version, file: name, range: req.headers.range || null, status, size: slice.length};
    state.log.push(entry);
    if (req.method === 'HEAD') { res.writeHead(status, headers); res.end(); return; }
    if (state.stall && name.startsWith(state.stall)) { entry.stalled = true; res.writeHead(status, headers); return; }   // headers, then silence
    setTimeout(() => {
      res.writeHead(status, headers);
      let sent = 0;
      const job = {pump(budget) {
        if (res.destroyed) { active.delete(job); return; }
        const n = Math.min(budget, slice.length - sent);
        if (n > 0) res.write(slice.subarray(sent, sent + n));
        sent += n;
        if (sent >= slice.length) { active.delete(job); res.end(); entry.ms = Date.now() - entry.t; }
      }};
      if (!state.rate) job.pump(Infinity); else active.add(job);
    }, state.latency);
  });
  return {server, state, file};
}

// --- The page ----------------------------------------------------------------
function pageServer() {
  return http.createServer((req, res) => {
    const [, mode, name = 'index.html'] = new URL(req.url, 'http://x').pathname.split('/');
    const files = {'index.html': null, 'pyodide-worker.js': path.join(LIB, 'pyodide-worker.js'), 'pyodide-worker-core.js': path.join(LIB, 'pyodide-worker-core.js'), 'coi-serviceworker.js': path.join(LIB, 'coi-serviceworker.js')};
    if (!['h', 's'].includes(mode) || !(name in files)) { res.writeHead(404); res.end(); return; }
    const headers = {'Content-Type': name.endsWith('.js') ? 'text/javascript' : 'text/html', 'Cache-Control': 'no-store'};
    if (mode === 'h') { headers['Cross-Origin-Opener-Policy'] = 'same-origin'; headers['Cross-Origin-Embedder-Policy'] = 'credentialless'; }
    res.writeHead(200, headers);
    res.end(files[name] ? fs.readFileSync(files[name]) : '<!doctype html><html><head>' + (mode === 's' ? '<script src="coi-serviceworker.js"></script>' : '')
      + '<script src="pyodide-worker.js"></script></head><body><p>CTMWorker</p></body></html>');
  });
}

const cdn = cdnServer();
const pages = pageServer();
await new Promise(resolve => cdn.server.listen(0, '127.0.0.1', resolve));
await new Promise(resolve => pages.listen(0, '127.0.0.1', resolve));
const CDN = `http://127.0.0.1:${cdn.server.address().port}/`;
const PAGE = `http://127.0.0.1:${pages.address().port}/`;
const index = version => CDN + version + '/';
const lock = async version => JSON.parse(fs.readFileSync(await cdn.file(version, 'pyodide-lock.json'), 'utf8')).packages;
const size = async (version, name) => fs.statSync(await cdn.file(version, name)).size;
function closure(packages, names) {
  const canonical = name => name.toLowerCase().replace(/[-_.]+/g, '-');
  const byName = Object.fromEntries(Object.values(packages).map(entry => [canonical(entry.name), entry]));
  const seen = new Set(), files = [];
  const visit = name => { const key = canonical(name); if (seen.has(key)) return; seen.add(key); for (const dep of byName[key].depends) visit(dep); files.push(byName[key].file_name); };
  names.forEach(visit);
  return files;
}

const launchOptions = process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {};
const report = [];

async function withPage(mode, run, {persistent = true} = {}) {
  const dir = fs.mkdtempSync(path.join(ROOT, '.worker-profile-'));
  const context = persistent ? await chromium.launchPersistentContext(dir, {...launchOptions, headless: true, serviceWorkers: 'allow'})
    : await (await chromium.launch({...launchOptions, headless: true})).newContext({serviceWorkers: 'allow'});
  try {
    const page = await context.newPage();
    page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) console.error('browser:', message.text()); });
    page.on('pageerror', error => console.error('page error:', error.message));
    await page.goto(PAGE + mode + '/index.html');
    if (mode === 's') {
      // Once the service worker is active, the page is reloaded once (as
      // pyodide-interaktiv's status line does); then it is isolated.
      await page.waitForFunction(() => globalThis.qpyodideCoiOutcome === 'ready', null, {timeout: 30000});
      await page.reload();
      await page.waitForFunction(() => globalThis.crossOriginIsolated === true, null, {timeout: 30000});
    }
    return await run(page);
  } finally {
    await context.close();
    if (!persistent && context.browser()) await context.browser().close();
    fs.rmSync(dir, {recursive: true, force: true});
  }
}
// Starts the worker in the page; window.__w holds the proxy and timings.
async function start(page, options) {
  return page.evaluate(async options => {
    const t0 = performance.now();
    window.__w = {t0, events: []};
    const proxy = await CTMWorker.start({...options, publish: true, onStatus: text => window.__w.events.push(['status', text, performance.now() - t0])});
    window.__w.proxy = proxy;
    window.__w.ready = performance.now() - t0;
    proxy.whenSetup.then(() => { window.__w.setup = performance.now() - t0; }, error => { window.__w.setupError = error.message; window.__w.setup = performance.now() - t0; });
    return {ready: window.__w.ready, isolated: globalThis.crossOriginIsolated, shared: !!proxy.interruptBuffer};
  }, options);
}
const waitSetup = (page, ms = 300000) => page.waitForFunction(() => window.__w.setup !== undefined, null, {timeout: ms, polling: 200}).then(() => page.evaluate(() => ({setup: window.__w.setup, error: window.__w.setupError})));
const wheelRequests = since => cdn.state.log.slice(since).filter(entry => /\.(whl|zip|tar)$/.test(entry.file) && entry.file !== 'python_stdlib.zip');
const wheels = since => wheelRequests(since).filter(entry => entry.method === 'GET');

async function cacheScenario(mode, version, variant = 'full/') {
  // N5 and the browser cache: the prefetch requests exactly the URLs that
  // loadPackage requests, and loadPackage's requests come from the cache.
  const packages = await lock(version);
  const files = closure(packages, ['pyodide-http', 'micropip', 'matplotlib']);
  await withPage(mode, async page => {
    const mark = cdn.state.log.length;
    const ready = await start(page, {indexURL: index(version), background: BACKGROUND});
    const done = await waitSetup(page);
    assert.equal(done.error, undefined, done.error);
    const requests = wheels(mark);
    assert.deepEqual([...new Set(requests.map(entry => entry.file))].sort(), [...files].sort(), 'the closure, nothing else');
    assert.deepEqual(requests.filter(entry => !entry.range).map(entry => entry.file), [], 'every install took the verified prefetched bytes');
    const installed = await page.evaluate(() => window.__w.proxy.runPythonAsync('import importlib.util, json\njson.dumps([importlib.util.find_spec(m) is not None for m in ("matplotlib", "pyodide_http", "micropip")])'));
    assert.deepEqual(JSON.parse(installed), [true, true, true]);
    // pyodide_http.patch_all() ran: requests' adapter is pyodide_http's.
    const patched = await page.evaluate(() => window.__w.proxy.runPythonAsync('import urllib.request, pyodide_http\nurllib.request.urlopen.__module__'));
    assert.match(patched, /pyodide_http/);
    report.push(`cache ${mode} ${version}: ready ${Math.round(ready.ready)} ms, stage 2 ${Math.round(done.setup)} ms, ${requests.length} range GET payloads over ${files.length} files, 0 full GET payloads`);
  });
}

async function cdnScenario(mode) {
  // Encoded jsDelivr responses: HEAD selects one complete prefetch per wheel,
  // then installation uses those verified bytes without another GET. A second
  // visit uses the worker's own cache with no GET or HEAD wheel requests.
  cdn.state.jsdelivr = true;
  const packages = await lock(VERSION);
  const files = closure(packages, ['pyodide-http', 'micropip', 'matplotlib']);
  try {
    await withPage(mode, async page => {
      const mark = cdn.state.log.length;
      await start(page, {indexURL: index(VERSION), background: BACKGROUND});
      const done = await waitSetup(page);
      assert.equal(done.error, undefined, done.error);
      const installed = await page.evaluate(() => window.__w.proxy.runPythonAsync('import importlib.util, json\njson.dumps([importlib.util.find_spec(m) is not None for m in ("matplotlib", "pyodide_http", "micropip", "packaging")])'));
      assert.deepEqual(JSON.parse(installed), [true, true, true, true]);
      const first = wheels(mark);
      assert.ok(first.every(entry => !entry.range), 'encoded representations use complete prefetches');
      assert.deepEqual(first.map(entry => entry.file).sort(), [...files].sort(), 'exactly one payload per wheel: installs never download again');
      const probes = wheelRequests(mark).filter(entry => entry.method === 'HEAD');
      assert.deepEqual(probes.map(entry => entry.file).sort(), [...files].sort(), 'one representation probe per wheel');
      await page.reload();
      if (mode === 's') await page.waitForFunction(() => globalThis.crossOriginIsolated === true, null, {timeout: 30000});
      const again = cdn.state.log.length;
      await start(page, {indexURL: index(VERSION), background: BACKGROUND});
      const second = await waitSetup(page);
      assert.equal(second.error, undefined, second.error);
      assert.deepEqual(wheelRequests(again).map(entry => entry.file), [], 'a second visit makes no GET or HEAD wheel request');
      report.push(`cdn ${mode} (jsDelivr's headers: weak ETag, Vary, no Accept-Ranges): stage 2 ${Math.round(done.setup)} ms with ${probes.length} HEAD probes and ${first.length} complete prefetch GETs, 0 duplicate install GETs; second visit ${Math.round(second.setup)} ms with 0 GET or HEAD wheel requests`);
    });
  } finally {
    cdn.state.jsdelivr = false;
  }
}

async function checkScenario() {
  // On a slow line (1.6 Mbit/s), a check's SymPy download during stage 2
  // shares the line with at most the rest of one 512 KB range.
  await withPage('h', async page => {
    await start(page, {indexURL: index(VERSION), background: BACKGROUND});
    cdn.state.rate = 200000; cdn.state.latency = 100;   // about 1.6 Mbit/s
    await page.waitForTimeout(1500);
    const took = await page.evaluate(async () => { const t = performance.now(); await window.__w.proxy.loadPackage('sympy'); return performance.now() - t; });
    const packages = await lock(VERSION);
    const bytes = (await size(VERSION, packages.sympy.file_name)) + (await size(VERSION, packages.mpmath.file_name));
    const alone = bytes / 200000 * 1000;
    report.push(`check: SymPy during stage 2 in ${Math.round(took)} ms (alone about ${Math.round(alone)} ms, one range ${Math.round(524288 / 200000 * 1000)} ms)`);
    assert.ok(took < alone + 524288 / 200000 * 1000 + 3000, `SymPy took ${took} ms`);
    cdn.state.rate = 0; cdn.state.latency = 0;
    await waitSetup(page);
  }, {persistent: false});
}

async function starvationScenario() {
  // N2: on the slow line, with a check every 20 s, stage 2 still completes.
  await withPage('h', async page => {
    // The slow line from the start: stage 2 is measured from the end of stage 1.
    cdn.state.rate = 200000; cdn.state.latency = 100;
    const ready = await start(page, {indexURL: index(VERSION), background: BACKGROUND});
    await page.evaluate(() => {
      window.__checks = 0;
      const proxy = window.__w.proxy;
      window.__timer = setInterval(() => { proxy.loadPackage('sympy').then(() => proxy.runPythonAsync('import sympy\nsympy.Symbol("x") + 1')).then(() => { window.__checks++; }); }, 20000);
    });
    const done = await waitSetup(page, 200000);
    await page.evaluate(() => clearInterval(window.__timer));
    cdn.state.rate = 0; cdn.state.latency = 0;
    assert.equal(done.error, undefined, done.error);
    const checks = await page.evaluate(() => window.__checks);
    const stage2 = done.setup - ready.ready;
    // Everything the line carries meanwhile: stage 2's files and the first
    // check's SymPy (later checks download nothing and do not pause stage 2).
    const packages = await lock(VERSION);
    let bytes = 0;
    for (const file of closure(packages, ['pyodide-http', 'micropip', 'matplotlib', 'sympy'])) bytes += await size(VERSION, file);
    const line = bytes / 200000 * 1000;
    report.push(`starvation: stage 2 done ${Math.round(stage2 / 1000)} s after stage 1 on the slow line (its files and SymPy: ${Math.round(line / 1000)} s of line), with ${checks} checks, one every 20 s`);
    assert.ok(checks >= 2, 'the checks ran');
    assert.ok(stage2 < line + 30000, `stage 2 within the line time + 30 s (${Math.round(stage2 / 1000)} s)`);
  });
}

async function stallScenario() {
  // A stalled range is requested again; three failures reject whenSetup,
  // commands keep working, and Retry finishes without restarting Python.
  await withPage('h', async page => {
    cdn.state.stall = 'matplotlib-';
    await start(page, {indexURL: index(VERSION), background: BACKGROUND, timing: {stall: 1500, retryAfter: [300, 600]}});
    const done = await waitSetup(page, 60000);
    assert.equal(done.error, 'matplotlib: no data for 2 s', 'the package once, no URL');
    assert.equal(cdn.state.log.filter(entry => entry.stalled).length, 3);
    assert.equal(await page.evaluate(() => window.__w.proxy.runPythonAsync('1 + 1')), 2);
    cdn.state.stall = null;
    const retried = await page.evaluate(() => window.__w.proxy.retrySetup().then(() => 'ok', error => error.message));
    assert.equal(retried, 'ok');
    assert.equal(await page.evaluate(() => window.__w.proxy.runPythonAsync('import matplotlib\nmatplotlib.__name__')), 'matplotlib');
    report.push('stall: three tries, whenSetup rejected, Python kept working, Retry completed stage 2');
  }, {persistent: false});
}

async function restartScenario() {
  // A restart during stage 2 runs both stages again and rejects pending
  // calls. B1: a second restart while the new stage 2 runs (Stop on a cell
  // that waits for it) rejects that start's whenSetup and the calls on its
  // proxy at once, and the third start works.
  await withPage('h', async page => {
    cdn.state.rate = 400000;
    await start(page, {indexURL: index(VERSION), background: BACKGROUND});
    await page.waitForTimeout(1000);
    const result = await page.evaluate(async () => {
      const settle = (promise, ms) => Promise.race([promise.then(() => 'resolved', error => (error.restarted ? 'restarted: ' : '') + error.message),
        new Promise(resolve => setTimeout(() => resolve('pending'), ms))]);
      const old = window.__w.proxy;
      const pending = old.runPythonAsync('import time\ntime.sleep(5)\n1').then(() => 'resolved', error => error.message);
      const again = old.restart('Restarted by the test.');
      const proxy = await again;
      const waiting = proxy.whenSetup;
      const during = await settle(waiting, 100);
      const third = proxy.restart('Stopped during stage 2.');
      const oldSetup = await settle(waiting, 2000);
      const oldCall = await settle(proxy.runPythonAsync('1'), 2000);
      const latest = await third;
      const setup = await latest.whenSetup.then(() => 'ok', error => error.message);
      return {pending: await pending, during, oldSetup, oldCall, setup, fresh: latest !== proxy && latest !== old, published: globalThis.mainPyodide === latest,
        value: await latest.runPythonAsync('6 * 7')};
    });
    cdn.state.rate = 0;
    assert.deepEqual(result, {pending: 'Restarted by the test.', during: 'pending', oldSetup: 'restarted: Stopped during stage 2.',
      oldCall: 'restarted: Stopped during stage 2.', setup: 'ok', fresh: true, published: true, value: 42});
    report.push('restart: during stage 2, both stages again, the pending call rejected; a second restart during the new stage 2 ends its whenSetup and calls at once (B1)');
  }, {persistent: false});
}

async function isolationScenario() {
  // Through coi-serviceworker.js (no headers): isolated, interrupt and input().
  await withPage('s', async page => {
    const hook = ['import builtins as _b', 'def _i(prompt="", _o=_b.input):', '    import js', '    js._test_prompt(str(prompt))', '    return _o("")',
      '_b.input = _i', 'del _b, _i'].join('\n');
    const plugin = 'registerPlugin(api => { self._test_prompt = api.setPrompt; return {stage1: ' + JSON.stringify(hook) + '}; });';
    const ready = await start(page, {indexURL: index(VERSION), plugin});
    assert.deepEqual([ready.isolated, ready.shared], [true, true]);
    const result = await page.evaluate(async () => {
      const proxy = window.__w.proxy;
      proxy.onInputRequired = prompt => { window.__prompt = prompt; proxy.provideInput('Ada'); };
      const answer = await proxy.runPythonAsync('input("Name? ")');
      const looping = proxy.runPythonAsync('while True:\n    pass').then(() => 'finished', error => error.message);
      await new Promise(resolve => setTimeout(resolve, 500));
      proxy.interrupt();
      const stopped = await looping;
      proxy.clearInterrupt();
      return {answer, prompt: window.__prompt, stopped: /KeyboardInterrupt/.test(stopped), after: await proxy.runPythonAsync('2 + 2')};
    });
    assert.deepEqual(result, {answer: 'Ada', prompt: 'Name? ', stopped: true, after: 4});
    report.push('isolation: coi-serviceworker.js, input() with its prompt, Stop by interrupt');
  });
}

try {
  for (const scenario of scenarios) {
    console.log('scenario', scenario);
    if (scenario === 'cache') {
      await cacheScenario('h', VERSION);
      await cacheScenario('s', VERSION);
      if (process.env.PYODIDE_OLD) await cacheScenario('h', process.env.PYODIDE_OLD);
    } else if (scenario === 'cdn') {
      await cdnScenario('h');
      await cdnScenario('s');
    } else if (scenario === 'check') await checkScenario();
    else if (scenario === 'starvation') await starvationScenario();
    else if (scenario === 'stall') await stallScenario();
    else if (scenario === 'restart') await restartScenario();
    else if (scenario === 'isolation') await isolationScenario();
    else throw new Error('unknown scenario ' + scenario);
  }
  for (const line of report) console.log(line);
  console.log('CTMWorker browser tests passed.');
} finally {
  cdn.server.close();
  pages.close();
}
