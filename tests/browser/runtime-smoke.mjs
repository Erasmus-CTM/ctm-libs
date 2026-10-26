// The runtime of ctm-libs in Chromium: it loads Pyodide from jsDelivr, installs
// its guard and imports SymPy, the versions the components' grading depends on.
// Run by .github/workflows/browser.yml (needs the network and Playwright).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const EXPECTED = {pyodide: '0.28.3', python: '3.13', sympy: '1.13.3'};
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const runtime = fs.readFileSync(path.join(ROOT, '_extensions', 'ctm-libs', 'runtime', 'pyodide-runtime.js'), 'utf8');

const server = http.createServer((request, response) => {
  if (request.url === '/runtime.js') {
    response.writeHead(200, {'content-type': 'text/javascript'});
    response.end(runtime);
    return;
  }
  const workerName = request.url.slice(1);
  if (['pyodide-worker.js', 'pyodide-worker-core.js'].includes(workerName)) {
    response.writeHead(200, {'content-type': 'text/javascript'});
    response.end(fs.readFileSync(path.join(ROOT, '_extensions/ctm-libs/runtime', workerName)));
    return;
  }
  response.writeHead(200, {'content-type': 'text/html'});
  response.end('<!doctype html><html><head><script src="/runtime.js"></script><script src="/pyodide-worker.js"></script></head><body><p>runtime</p></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
try {
  const page = await browser.newPage();
  page.on('console', message => { if (message.type() === 'error') console.error('browser:', message.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const started = Date.now();
  const result = await page.evaluate(async () => {
    const R = globalThis.MathExerciseRuntime;
    const py = await R.ensurePyodide();
    await py.loadPackage('sympy');
    await R.ensureGuard(py);
    const report = await py.runPythonAsync([
      'import json, sys, sympy',
      'x = sympy.Symbol("x")',
      'json.dumps({"python": f"{sys.version_info.major}.{sys.version_info.minor}", "sympy": sympy.__version__,',
      '            "zero": str(sympy.simplify((x + 1)**2 - (x**2 + 2*x + 1)))})',
    ].join('\n'));
    return {indexURL: R.indexURL, guard: await py.runPythonAsync("import sys; '_ctm_guard' in sys.modules"), worker: py.isWorkerProxy, ...JSON.parse(report)};
  });
  console.log('Loaded in', Math.round((Date.now() - started) / 1000), 's:', JSON.stringify(result));
  assert.equal(result.indexURL, `https://cdn.jsdelivr.net/pyodide/v${EXPECTED.pyodide}/full/`);
  assert.equal(result.python, EXPECTED.python);
  assert.equal(result.sympy, EXPECTED.sympy);
  assert.equal(result.zero, '0');
  assert.equal(result.guard, true);
  assert.equal(result.worker, true);
  console.log('Runtime smoke test passed.');
} finally {
  await browser.close();
  server.close();
}
