// A light parity check between the runtime's Pyodide and the version before
// it: the same SymPy operations that grading relies on must give the same
// results. The gate for a Pyodide change is the CTM Assessment parity harness
// (every exercise of the example sites and courses under both versions); this
// check runs on every push of ctm-libs. Run by .github/workflows/browser.yml.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const PREVIOUS = '0.27.2';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const runtime = fs.readFileSync(path.join(ROOT, '_extensions', 'ctm-libs', 'runtime', 'pyodide-runtime.js'), 'utf8');

// Results as srepr strings; unordered results are sorted first.
const BATTERY = String.raw`
import json, sys
import sympy as sp
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application, convert_xor
x, y, n, t = sp.symbols('x y n t')
T = standard_transformations + (implicit_multiplication_application, convert_xor)
cases = {
  'equivalent': sp.simplify((x + 1)**2 - (x**2 + 2*x + 1)),
  'pythagoras': sp.simplify(sp.sin(x)**2 + sp.cos(x)**2),
  'trig': sp.trigsimp(sp.sin(2*x) - 2*sp.sin(x)*sp.cos(x)),
  'factor': sp.factor(x**3 - x),
  'expand': sp.expand((x + y)**3),
  'together': sp.together(1/x + 1/y),
  'cancel': sp.cancel((x**2 - 1)/(x - 1)),
  'apart': sp.apart(1/(x**2 - 1)),
  'radical': sp.simplify(sp.sqrt(8)),
  'rational': sp.nsimplify(0.333333333333333),
  'parse': parse_expr('2x^2 + 3(x+1)', transformations=T),
  'integral': sp.integrate(x*sp.exp(x), x),
  'definite': sp.integrate(sp.sin(x), (x, 0, sp.pi)),
  'derivative': sp.diff(sp.sin(x)*x**2, x),
  'limit': sp.limit(sp.sin(x)/x, x, 0),
  'series': sp.summation(1/n**2, (n, 1, sp.oo)),
  'solve': sorted(sp.solve(x**2 - 2, x), key=sp.default_sort_key),
  'inverse': sp.Matrix([[1, 2], [3, 4]]).inv(),
  'eigen': sorted(sp.Matrix([[2, 1], [1, 2]]).eigenvals().items(), key=sp.default_sort_key),
  'rank': sp.Matrix([[1, 2, 3], [2, 4, 6], [1, 0, 1]]).rank(),
  'nullspace': sp.Matrix([[1, 2], [2, 4]]).nullspace(),
  'numeric': format(float(sp.N(sp.pi, 30)), '.15g'),
  'ode': sp.dsolve(sp.Derivative(sp.Function('f')(t), t) - sp.Function('f')(t)),
}
json.dumps({key: sp.srepr(value) if not isinstance(value, str) else value for key, value in cases.items()})
`;

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
  response.end(request.url === '/previous'
    ? `<!doctype html><html><head><script src="https://cdn.jsdelivr.net/pyodide/v${PREVIOUS}/full/pyodide.js"></script></head><body></body></html>`
    : '<!doctype html><html><head><script src="/runtime.js"></script><script src="/pyodide-worker.js"></script></head><body></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
async function run(route, load) {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}${route}`);
  return page.evaluate(async ({load, battery, previous}) => {
    const py = load === 'runtime'
      ? await globalThis.MathExerciseRuntime.ensurePyodide()
      : await globalThis.loadPyodide({indexURL: `https://cdn.jsdelivr.net/pyodide/v${previous}/full/`});
    await py.loadPackage('sympy');
    const version = await py.runPythonAsync('import sys, sympy; f"{sys.version_info.major}.{sys.version_info.minor} {sympy.__version__}"');
    return {version, results: JSON.parse(await py.runPythonAsync(battery))};
  }, {load, battery: BATTERY, previous: PREVIOUS});
}
try {
  const current = await run('/', 'runtime');
  const before = await run('/previous', 'previous');
  console.log('runtime:', current.version, '| previous', PREVIOUS + ':', before.version);
  assert.equal(current.version.split(' ')[1], before.version.split(' ')[1], 'the same SymPy version');
  const differences = Object.keys(before.results).filter(key => before.results[key] !== current.results[key]);
  for (const key of differences) console.error(key + ':\n  ' + PREVIOUS + ': ' + before.results[key] + '\n  runtime: ' + current.results[key]);
  assert.deepEqual(differences, []);
  console.log('SymPy parity:', Object.keys(current.results).length, 'operations give the same results.');
} finally {
  await browser.close();
  server.close();
}
