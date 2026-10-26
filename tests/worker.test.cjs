// CTMWorker (runtime/pyodide-worker.js), the Python worker moved from
// pyodide-interaktiv 1.8: the worker side with a fake Pyodide (its command
// queue, plugins, the control messages that bypass it) and the main-thread
// proxy with a fake Worker (its contract, the globals it publishes, restart).
// The real worker in a browser: tests/browser/worker.mjs.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const crypto = require('node:crypto');
const C = require('./helpers/ctm-libs.cjs');

const FILE = path.join(C.library, 'runtime', 'pyodide-worker.js');
const W = require('./helpers/worker.cjs');

test('the worker serializes other consumers around a plugin command\'s output capture and survives errors', async () => {
  // Moved from pyodide-interaktiv 1.8's tests/worker.test.cjs: a checker
  // from another component must not enter a document cell's stdout evidence.
  let release;
  const plugin = 'registerPlugin(api => ({commands: {runCell: async msg => {'
    + ' api.capture.start(); await api.pyodide().loadPackagesFromImports(msg.code); await api.pyodide().runPythonAsync(msg.code);'
    + ' return {entries: api.capture.entries()}; }}}));';
  const w = W.workerContext({plugin, pyodide: ctx => ({
    loadPackagesFromImports: () => new Promise(resolve => { release = resolve; }),
    runPythonAsync: async code => { if (code === 'FAIL') throw new Error('fail'); ctx.stdout(code); },
  })});
  await w.init();
  const first = w.send({id: 1, type: 'runCell', code: 'LEARNER_OUTPUT'});
  await W.tick();
  const other = w.send({id: 2, type: 'runPython', code: 'HIDDEN_TEST_OUTPUT'});
  await W.tick();
  assert.equal(w.results().length, 0);
  await w.send({id: 3, type: 'setInputBuffers', inputStatusBuf: null, inputDataBuf: null});
  assert.equal(w.results()[0].id, 3, 'control message must bypass a pending computation');
  release();
  await Promise.all([first, other]);
  assert.deepEqual(w.result(1).value.entries, [{type: 'stdout', message: 'LEARNER_OUTPUT'}]);
  await w.send({id: 4, type: 'runPython', code: 'FAIL'});
  await w.send({id: 5, type: 'runPython', code: 'AFTER_FAILURE'});
  assert.equal(w.result(4).type, 'error');
  assert.equal(w.result(5).type, 'result');
  await w.send({id: 6, type: 'noSuchCommand'});
  assert.equal(w.result(6).message, 'Unknown command: noSuchCommand');
});

test('a plugin\'s stage-1 Python runs once the interpreter is ready; setPrompt reaches input()\'s request', async () => {
  const ran = [];
  const plugin = 'registerPlugin(api => { self._test_set_prompt = api.setPrompt; return {stage1: "HOOK"}; });';
  const w = W.workerContext({plugin, pyodide: () => ({runPythonAsync: async code => { ran.push(code); }})});
  await w.init();
  assert.deepEqual(ran.filter(code => code === 'HOOK'), ['HOOK']);
  w.context.self._test_set_prompt('Name? ');
  const status = new Int32Array(new SharedArrayBuffer(4)), data = new Uint8Array(new SharedArrayBuffer(16));
  await w.send({id: 9, type: 'setInputBuffers', inputStatusBuf: status, inputDataBuf: data});
  status[0] = 3;  // aborted before the wait: Atomics.wait returns at once
  w.context.Atomics = {store() {}, wait() {}, load: () => 3};
  assert.equal(w.context.stdin(), null);
  assert.deepEqual(w.messages.find(m => m.type === 'inputRequired'), {type: 'inputRequired', prompt: 'Name? ', operationID: null});
});

test('the main-thread proxy: the documented keys, the globals it publishes, the plugin\'s commands', async () => {
  const page = W.pageContext();
  const started = page.CTMWorker.start({indexURL: 'https://cdn.example/pyodide/', publish: true, commands: {runCell: ['code', 'wantPickle']},
    messages: {loading: 'LOADING'}, onStatus: text => page.statuses.push(text)});
  assert.equal(page.qpyodideReady, started);
  assert.equal(page.qpyodideInstance, started);
  assert.equal(page._qpyodideGetInstance(), started);
  assert.equal(page.mainPyodide, undefined);
  const worker = page.workers[0];
  const init = worker.posted[0];
  assert.equal(init.type, 'init');
  assert.equal(init.config.indexURL, 'https://cdn.example/pyodide/');
  worker.reply({type: 'status', text: 'FROM WORKER'});
  worker.reply({type: 'result', id: init.id, value: true});
  const proxy = await started;
  assert.equal(page.mainPyodide, proxy);
  assert.deepEqual(page.statuses, ['LOADING', 'FROM WORKER']);
  assert.deepEqual(Object.keys(proxy).sort(), W.PROXY_KEYS.concat(['runCell']).sort());
  assert.deepEqual(Object.keys(proxy.globals), ['set']);
  const call = proxy.runCell('print(1)', true);
  const sent = worker.posted.at(-1);
  assert.deepEqual({type: sent.type, code: sent.code, wantPickle: sent.wantPickle}, {type: 'runCell', code: 'print(1)', wantPickle: true});
  worker.reply({type: 'result', id: sent.id, value: 'done'});
  assert.equal(await call, 'done');
  const failing = proxy.runPythonAsync('x');
  worker.reply({type: 'error', id: worker.posted.at(-1).id, message: 'NameError'});
  await assert.rejects(failing, /NameError/);
  // Streams and input requests go to the proxy's callbacks.
  const seen = [];
  proxy.onStream = (text, kind) => seen.push([kind, text]);
  proxy.onInputRequired = prompt => seen.push(['input', prompt]);
  worker.reply({type: 'streamStdout', text: 'out'});
  worker.reply({type: 'streamStderr', text: 'err'});
  worker.reply({type: 'inputRequired', prompt: 'Name?'});
  assert.deepEqual(seen, [['stdout', 'out'], ['stderr', 'err'], ['input', 'Name?']]);
});

test('restart: the event, pending calls rejected, a new worker published, onRestart with its start', async () => {
  const page = W.pageContext();
  const restarts = [];
  let events = 0;
  page.addEventListener('qpyodide-runtime-restart', () => events++);
  const first = page.CTMWorker.start({indexURL: 'https://cdn.example/', publish: true, onRestart: again => restarts.push(again)});
  page.workers[0].reply({type: 'result', id: page.workers[0].posted[0].id, value: true});
  const proxy = await first;
  const waiting = proxy.runPythonAsync('while True: pass');
  const again = proxy.restart('Stopped.');
  assert.equal(events, 1);
  assert.equal(page.workers[0].terminated, true);
  await assert.rejects(waiting, /Stopped\./);
  assert.equal(page.qpyodideReady, again);
  assert.equal(page.qpyodideInstance, again);
  assert.equal(page.mainPyodide, undefined);
  assert.deepEqual(restarts, [again]);
  page.workers[1].reply({type: 'result', id: page.workers[1].posted[0].id, value: true});
  const second = await again;
  assert.notEqual(second, proxy);
  assert.equal(page.mainPyodide, second);
});

test('a start that is no longer the published one does not set mainPyodide when it ends', async () => {
  const page = W.pageContext();
  const first = page.CTMWorker.start({indexURL: 'https://cdn.example/', publish: true});
  const second = page.CTMWorker.start({indexURL: 'https://cdn.example/', publish: true});
  assert.equal(page.qpyodideReady, second);
  page.workers[1].reply({type: 'result', id: page.workers[1].posted[0].id, value: true});
  const current = await second;
  page.workers[0].reply({type: 'result', id: page.workers[0].posted[0].id, value: true});
  await first;
  assert.equal(page.mainPyodide, current);
});

// How a promise stands after `ms`: 'resolved', the rejection, or 'pending'.
const settle = (promise, ms = 200) => Promise.race([promise.then(() => 'resolved', error => error),
  new Promise(resolve => setTimeout(() => resolve('pending'), ms))]);

test('B1: a restart during stage 2 rejects the old whenSetup; calls on the old proxy reject at once; a second restart of it returns the same start', async () => {
  // A cell waits for whenSetup before it sends its command; a restart then
  // has no pending call to reject, so the wait itself must end.
  const page = W.pageContext();
  const first = page.CTMWorker.start({indexURL: 'https://cdn.example/', publish: true, commands: {runCell: ['code']}});
  page.workers[0].reply({type: 'result', id: page.workers[0].posted[0].id, value: true});
  const proxy = await first;
  const waiting = proxy.whenSetup;
  assert.equal(await settle(waiting, 20), 'pending', 'stage 2 is running');
  const again = proxy.restart('Stopped.');
  const stopped = await settle(waiting);
  assert.ok(stopped instanceof Error, 'the old whenSetup must reject, not stay ' + stopped);
  assert.equal(stopped.message, 'Stopped.');
  assert.equal(stopped.restarted, true, 'a restart is told apart from a failed stage 2');
  const posted = page.workers[0].posted.length;
  for (const call of [proxy.runPythonAsync('1'), proxy.runCell('print(1)'), proxy.loadPackage('sympy'), proxy.retrySetup()]) {
    const outcome = await settle(call);
    assert.ok(outcome instanceof Error && outcome.restarted, 'a call on the old proxy rejects at once: ' + outcome);
  }
  assert.equal(page.workers[0].posted.length, posted, 'nothing is sent to the terminated worker');
  // A second Stop on the same old proxy boots no third worker.
  assert.equal(proxy.restart('Again.'), again);
  assert.equal(page.workers.length, 2);
  // The new start is unaffected: its stage 2 resolves with its proxy.
  page.workers[1].reply({type: 'result', id: page.workers[1].posted[0].id, value: true});
  const second = await again;
  page.workers[1].reply({type: 'setup', ok: true});
  assert.equal(await second.whenSetup, second);
  // A failed stage 2 is not a restart.
  const third = page.CTMWorker.start({indexURL: 'https://cdn.example/'});
  page.workers[2].reply({type: 'result', id: page.workers[2].posted[0].id, value: true});
  const failed = (await third).whenSetup;
  page.workers[2].reply({type: 'setup', ok: false, message: 'x: HTTP 404'});
  const failure = await settle(failed);
  assert.equal(failure.message, 'x: HTTP 404');
  assert.equal(failure.restarted, undefined);
});

test('cross-origin isolated pages get the interrupt and input buffers; a failure leaves them off', async () => {
  for (const fail of [false, true]) {
    const page = W.pageContext({crossOriginIsolated: true});
    const started = page.CTMWorker.start({indexURL: 'https://cdn.example/'});
    const worker = page.workers[0];
    worker.reply({type: 'result', id: worker.posted[0].id, value: true});
    await W.tick();
    const interrupt = worker.posted.find(m => m.type === 'setInterrupt');
    worker.reply({type: fail ? 'error' : 'result', id: interrupt.id, value: true, message: 'no'});
    await W.tick();
    if (!fail) {
      const buffers = worker.posted.find(m => m.type === 'setInputBuffers');
      worker.reply({type: 'result', id: buffers.id, value: true});
    }
    const proxy = await started;
    assert.equal(!!proxy.interruptBuffer, !fail);
    assert.equal(!!proxy.inputStatusBuf, !fail);
    if (!fail) {
      proxy.interrupt();
      assert.equal(proxy.interruptBuffer[0], 2);
      proxy.clearInterrupt();
      assert.equal(proxy.interruptBuffer[0], 0);
      proxy.inputStatusBuf[0] = 1;
      proxy.provideInput('Ada');
      assert.equal(proxy.inputStatusBuf[0], 2);
      assert.equal(new TextDecoder().decode(proxy.inputDataBuf.slice(0, 3)), 'Ada');
    }
  }
});

test('coi-serviceworker.js retains the original file except native HEAD response pass-through', () => {
  const current = fs.readFileSync(path.join(C.library, 'runtime', 'coi-serviceworker.js'), 'utf8');
  const patch = 'if (resp.status === 0 || request.method === "HEAD") return resp;';
  assert.equal(current.split(patch).length, 2);
  const bytes = current.replace(patch, 'if (resp.status === 0) return resp;');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), '36a89bee3a89a96d6f8540713bfb74543db77e658d27738972b430b438d54a5e');
});
