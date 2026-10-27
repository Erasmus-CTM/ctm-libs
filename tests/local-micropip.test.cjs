// Local assets (offline and exam builds): micropip installs only what the
// served lock has; it never asks PyPI (offline design §5). The worker puts a
// meta-path finder in place that points micropip's package index at a path of
// the site that does not exist, whenever micropip is imported.
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('./helpers/worker.cjs');

const INDEX = 'https://course.test/_ctm-assets/pyodide/0.28.3/';

test('a local-asset worker confines micropip to the site before any package loads; a CDN worker does not', async () => {
  const net = W.fakeNet({base: INDEX});
  const local = W.workerContext({globals: {fetch: net.fetch}});
  await local.init({assetsMode: 'local', indexURL: INDEX});
  assert.equal(local.result(0).type, 'result');
  assert.equal(local.ctx.runPython.length, 1);
  assert.match(local.ctx.runPython[0], /set_index_urls\(\[self\.index\]\)/);
  assert.ok(local.ctx.runPython[0].includes('_ctm_confine_micropip("' + INDEX + 'no-package-index")'));
  const cdn = W.workerContext();
  await cdn.init({});
  assert.equal(cdn.ctx.runPython, undefined);
});

// The same code in Pyodide 0.28.3 (the npm package of package.json), with every
// request outside the site's Pyodide folder refused. micropip comes from
// jsDelivr or PYODIDE_PACKAGES (a package cache folder); outside CI the test
// skips when it cannot be loaded.
test('Pyodide: with the finder, micropip.install of a package outside the lock asks only the site; locked installs work', {timeout: 300000}, async t => {
  const local = W.workerContext({globals: {fetch: W.fakeNet({base: INDEX}).fetch}});
  await local.init({assetsMode: 'local', indexURL: INDEX});
  const code = local.ctx.runPython[0];
  const {loadPyodide} = require('pyodide');
  const realFetch = globalThis.fetch, seen = [];
  let pyodide;
  try {
    pyodide = await loadPyodide(process.env.PYODIDE_PACKAGES ? {packageCacheDir: process.env.PYODIDE_PACKAGES} : {});
    await pyodide.loadPackage('micropip');
    // loadPackage reports a failed download without rejecting.
    if (!pyodide.loadedPackages.micropip) throw new Error('micropip was not loaded');
  } catch (error) {
    if (process.env.CI) throw error;
    t.skip('micropip unavailable here: ' + error.message);
    return;
  }
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    seen.push(url);
    if (url.startsWith(INDEX)) return new Response('', {status: 404});
    throw new TypeError('network refused: ' + url);
  };
  try {
    pyodide.runPython(code);
    // A name in no Pyodide lock, so micropip asks its package index.
    await assert.rejects(pyodide.runPythonAsync('import micropip\nawait micropip.install("ctm-not-in-the-lock")'), /Can't fetch metadata for 'ctm-not-in-the-lock'/);
    assert.deepEqual(seen, [INDEX + 'no-package-index/ctm-not-in-the-lock/']);
    seen.length = 0;
    await pyodide.runPythonAsync('import micropip\nawait micropip.install("micropip")');
    assert.deepEqual(seen, []);
  } finally {
    globalThis.fetch = realFetch;
  }
});
