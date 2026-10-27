// The page-wide Python runtime (runtime/pyodide-runtime.js, global
// MathExerciseRuntime). Moved here with the file from math-exercise
// (tests/shared-runtime.test.mjs at bf6caf3, its runtime cases).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ctmLibs = require('./helpers/ctm-libs.cjs');

const PYODIDE = '0.28.3';
const source = fs.readFileSync(path.join(ctmLibs.library, 'runtime', 'pyodide-runtime.js'), 'utf8');
const cdn = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE}/full/`;

function runtime(globals = {}) {
  const events = new EventTarget();
  const context = vm.createContext({
    addEventListener: events.addEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
    ...globals
  });
  vm.runInContext(source, context);
  return context;
}

function documentStub(onAppend) {
  const scripts = [];
  return {
    scripts,
    readyState: 'loading',
    querySelector(selector) {
      return scripts.find((script) => selector === `script[src="${script.src}"]`) ?? null;
    },
    createElement() {
      const listeners = {};
      return {
        dataset: {}, listeners,
        addEventListener(event, listener) { (listeners[event] ??= []).push(listener); },
        dispatch(event) {
          for (const listener of listeners[event] ?? []) listener();
          this[`on${event}`]?.();
        },
        remove() { scripts.splice(scripts.indexOf(this), 1); },
      };
    },
    head: {
      appendChild(script) { scripts.push(script); onAppend(script); },
    },
  };
}

test('the runtime loads Pyodide ' + PYODIDE + ' from jsDelivr', () => {
  assert.equal(runtime().MathExerciseRuntime.indexURL, cdn);
});

test('reuses an existing coatless promise or a ready main instance', async () => {
  const coatless = { loadPackage() {} };
  const fromCoatless = runtime({ qpyodideInstance: Promise.resolve(coatless) });
  assert.equal(await fromCoatless.MathExerciseRuntime.ensurePyodide(), coatless);
  assert.equal(fromCoatless.mainPyodide, coatless);

  const main = { runPythonAsync() {} };
  const fromMain = runtime({ mainPyodide: main });
  assert.equal(await fromMain.MathExerciseRuntime.ensurePyodide(), main);
  assert.equal(fromMain.__qExercisePyodide, undefined);
});

test('reuses top-level lexical instances from another classic script', async () => {
  const context = runtime({ instance: { from: 'lexical' } });
  vm.runInContext('let qpyodideInstance = Promise.resolve(instance)', context);
  assert.equal(await context.MathExerciseRuntime.ensurePyodide(), context.instance);
  assert.equal(context.mainPyodide, context.instance);
  assert.equal(context.qpyodideInstance, undefined);
});

test('standalone browser calls share the page worker and never load main-thread Python', async () => {
  let started = null, loads = 0;
  const instance = {isWorkerProxy: true};
  const document = documentStub(() => { throw new Error('main-thread script loaded'); });
  const context = runtime({document, loadPyodide() { throw new Error('main-thread Python'); },
    CTMWorker: {page() { if (!started) { loads++; started = Promise.resolve(instance); } return started; }}});
  const api = context.MathExerciseRuntime;
  assert.deepEqual(await Promise.all([api.ensurePyodide(), api.ensurePyodide()]), [instance, instance]);
  assert.equal(loads, 1);
  assert.equal(document.scripts.length, 0);
});

test('a browser missing its worker dependency fails without a main-thread fallback', async () => {
  const context = runtime({document: documentStub(() => {}), loadPyodide() { throw new Error('must not run'); }});
  await assert.rejects(context.MathExerciseRuntime.ensurePyodide(), /worker dependency is missing/);
});

test('a failed browser worker start can be retried by the broker', async () => {
  let attempts = 0;
  const instance = {isWorkerProxy: true};
  const context = runtime({document: documentStub(() => {}), CTMWorker: {page() {
    return ++attempts === 1 ? Promise.reject(new Error('Worker failed')) : Promise.resolve(instance);
  }}});
  await assert.rejects(context.MathExerciseRuntime.ensurePyodide(), /Worker failed/);
  assert.equal(await context.MathExerciseRuntime.ensurePyodide(), instance);
});

test('worker imports Pyodide from the base its page gives, without reading document or window', async () => {
  const local = 'https://course.test/_ctm-assets/pyodide/1/';
  const instance = { worker: true };
  const imports = [];
  const context = runtime({
    importScripts(src) {
      imports.push(src);
      context.loadPyodide = async ({ indexURL }) => {
        assert.equal(indexURL, local);
        return instance;
      };
    },
  });
  assert.equal(await context.MathExerciseRuntime.ensurePyodide({ indexURL: local }), instance);
  assert.deepEqual(imports, [local + 'pyodide.js']);
  assert.equal(context.mainPyodide, instance);
  assert.equal(context.MathExerciseRuntime.indexURL, local);
  assert.equal(await context.MathExerciseRuntime.ensurePyodide(), instance);
});

test('a worker without its page\'s base loads nothing: no silent CDN fallback', async () => {
  const imports = [];
  const context = runtime({ importScripts(src) { imports.push(src); }, loadPyodide() { throw new Error('loaded'); } });
  const R = context.MathExerciseRuntime;
  await assert.rejects(R.ensurePyodide(), /pass the page's MathExerciseRuntime.indexURL/);
  for (const bad of ['', 'pyodide/', '/pyodide/', 'https://course.test/pyodide', 'https://course.test/p/?x=/', 'blob:https://course.test/1/', 'javascript:alert(1)//', 'https:///', 'https://course.test/a b/', 42]) {
    await assert.rejects(R.ensurePyodide({ indexURL: bad }), /absolute URL of a folder/, String(bad));
  }
  assert.deepEqual(imports, []);
  assert.equal(context.__qExercisePyodide, undefined);
});

test('a worker keeps the first base: another one is refused, the same one shares the load', async () => {
  const instance = {};
  let loads = 0;
  const context = runtime({ importScripts() {}, loadPyodide: async () => { loads++; return instance; } });
  const R = context.MathExerciseRuntime;
  const first = R.ensurePyodide({ indexURL: cdn });
  await assert.rejects(R.ensurePyodide({ indexURL: 'https://course.test/_ctm-assets/pyodide/1/' }), new RegExp('already uses ' + cdn));
  assert.deepEqual(await Promise.all([first, R.ensurePyodide({ indexURL: cdn }), R.ensurePyodide()]), [instance, instance, instance]);
  assert.equal(loads, 1);
});

test('a load that never finishes (failed WebAssembly) times out and can be retried', async () => {
  let calls = 0;
  const ready = { runPythonAsync() {} };
  const context = runtime({ setTimeout, clearTimeout, __qExercisePyodideTimeout: 50,
    loadPyodide: () => (++calls === 1 ? new Promise(() => {}) : Promise.resolve(ready)) });
  await assert.rejects(context.MathExerciseRuntime.ensurePyodide({ indexURL: cdn }), error => error.code === 'pyodide-timeout');
  assert.equal(context.__qExercisePyodide, undefined);
  assert.equal(await context.MathExerciseRuntime.ensurePyodide(), ready);
  assert.equal(calls, 2);
});

test('concurrent installs of different modules keep their own sources, and repeated installs run once', async () => {
  const globals = new Map(), runs = [];
  const py = { globals: { set: async (k, v) => { await new Promise(r => setTimeout(r, 5)); globals.set(k, v); } },
    runPythonAsync: async code => { runs.push(code); const name = code.match(/ModuleType\("([^"]+)"\)/)[1]; const variable = code.match(/exec\((\w+),/)[1];
      assert.equal(globals.get(variable), 'source of ' + name); } };
  const context = runtime({ setTimeout, clearTimeout, WeakMap });
  const R = context.MathExerciseRuntime;
  await Promise.all([R.installModule(py, '_ctm_a', 'source of _ctm_a'), R.installModule(py, '_ctm_b', 'source of _ctm_b'), R.installModule(py, '_ctm_a', 'source of _ctm_a')]);
  assert.equal(runs.length, 2);
});

test('whenSlow waits until the runtime can be stopped; very long delays do not overflow', async () => {
  const context = runtime({ setTimeout, clearTimeout });
  const R = context.MathExerciseRuntime;
  let fired = 0;
  R.whenSlow(10, () => { fired++; });
  await new Promise(r => setTimeout(r, 40));
  assert.equal(fired, 0);                       // no stoppable runtime yet
  context.mainPyodide = { restart() {} };
  await new Promise(r => setTimeout(r, 1100));
  assert.equal(fired, 1);
  let early = 0;
  const cancel = R.whenSlow(99999999 * 1000, () => { early++; });
  await new Promise(r => setTimeout(r, 20));
  cancel();
  assert.equal(early, 0);
});

test('a copy with the current interface replaces an older runtime that loaded first', () => {
  const older = { indexURL: 'x', loadScript() {}, ensurePyodide() {} };
  const context = runtime({ MathExerciseRuntime: older });
  assert.notEqual(context.MathExerciseRuntime, older);
  assert.equal(typeof context.MathExerciseRuntime.stopCount, 'function');
  const current = context.MathExerciseRuntime;
  vm.runInContext(source, context);
  assert.equal(context.MathExerciseRuntime, current);
});
