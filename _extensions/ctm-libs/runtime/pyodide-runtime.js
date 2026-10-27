// Page-wide Python runtime of CTM Assessment (ctm-libs; HTML dependency
// ctm-runtime, a classic script loaded once per page), used by math-exercise
// and py-exercise. stack-sympy vendors a pinned revision (see its
// vendor/provenance.json).
(function (root) {
  'use strict';

  // Register initial component UI work synchronously, before window.load.
  // The work must not wait for Python or authored startup cells: the COI
  // decision can hold Python startup until this UI is safe to leave.
  var initialUI = [], initialUIClosed = false, initialUIReady = null;
  if (typeof document !== 'undefined') {
    initialUIClosed = document.readyState === 'complete';
    if (!initialUIClosed) root.addEventListener('load', function () { initialUIClosed = true; }, {once: true});
  }
  function trackInitialUI(promise) {
    if (initialUIClosed) throw new Error('Initial UI work must be registered before window.load');
    // Observe failures immediately, before load, without an unhandled race.
    // Keep them visible even when no COI reload is needed, and make the
    // barrier reject with the original error rather than call failed UI ready.
    initialUI.push(Promise.resolve(promise).then(function () { return null; }, function (error) {
      console.error('CTM: initial UI failed', error);
      return {error: error};
    }));
    return promise;
  }
  function whenInitialUIReady() {
    if (initialUIReady) return initialUIReady;
    initialUIReady = (async function () {
      if (typeof document === 'undefined') return;
      if (document.readyState !== 'complete') {
        await new Promise(function (resolve) { root.addEventListener('load', resolve, {once: true}); });
      }
      // load dispatch finishes before this continuation. Initial component
      // modules have registered all their asynchronous UI work by then.
      initialUIClosed = true;
      var results = await Promise.all(initialUI);
      var failed = results.find(function (result) { return result; });
      if (failed) throw failed.error;
      if (root.MathJax && root.MathJax.startup && root.MathJax.startup.promise) {
        await root.MathJax.startup.promise;
      }
      // Typesetting/editor construction can discover fonts after load.
      if (document.fonts) await document.fonts.ready;
    })();
    return initialUIReady;
  }

  // Standalone pages share the existing bounded COI reload protocol. The
  // IDE has its own coordinator; never compete with it or reload edited work.
  if (typeof document !== 'undefined' && typeof root.addEventListener === 'function' && !root.__ctmStandaloneCoiRegistered) {
    root.__ctmStandaloneCoiRegistered = true;
    var touched = false;
    ['pointerdown', 'keydown', 'input'].forEach(function (name) {
      root.addEventListener(name, function () { touched = true; }, {capture: true});
    });
    root.addEventListener('coi-sw-ready', function () {
      (root.MathExerciseRuntime?.whenInitialUIReady || whenInitialUIReady)().then(function () {
        if (root.qpyodideCoiSettled || root.crossOriginIsolated || touched || !root.location) return;
        try { root.sessionStorage.setItem('qpyodide-coi-reload-pending', '1'); }
        catch (error) { return; }  // blocked storage: no unbounded reload
        root.location.reload();
      }).catch(function (error) { console.error('CTM: cross-origin isolation reload failed', error); });
    });
  }

  // Call after editor.main: this module is already inside Monaco's pinned AMD
  // bundle. Do not ask its loader to fetch a separate, nonexistent source file.
  function prepareMonacoClipboard() {
    var module = root.require('vs/platform/clipboard/browser/clipboardService');
    var prototype = module && module.BrowserClipboardService && module.BrowserClipboardService.prototype;
    if (!prototype || prototype.__ctmClipboardGuarded || typeof prototype.installWebKitWriteTextWorkaround !== 'function') return;
    var install = prototype.installWebKitWriteTextWorkaround;
    prototype.installWebKitWriteTextWorkaround = function () {
      // Monaco 0.46 proactively writes promised clipboard data on each WebKit
      // click/key. Missing APIs and denied exam access produce uncaught errors.
      // Leave its ordinary writeText/execCommand copy fallback in place.
      if (!root.qpyodideExamOutput && root.navigator && root.navigator.clipboard &&
          typeof root.navigator.clipboard.write === 'function' && typeof root.ClipboardItem === 'function')
        return install.apply(this, arguments);
    };
    Object.defineProperty(prototype, '__ctmClipboardGuarded', {value: true});
  }

  // Preserve an already-loaded runtime's live state; add only the readiness
  // contract when an older component copy did not provide it.
  if (root.MathExerciseRuntime && typeof root.MathExerciseRuntime.ensureCheckers === 'function') {
    if (typeof root.MathExerciseRuntime.prepareMonacoClipboard !== 'function') root.MathExerciseRuntime.prepareMonacoClipboard = prepareMonacoClipboard;
    if (typeof root.MathExerciseRuntime.trackInitialUI !== 'function' ||
        typeof root.MathExerciseRuntime.whenInitialUIReady !== 'function') {
      root.MathExerciseRuntime.trackInitialUI = trackInitialUI;
      root.MathExerciseRuntime.whenInitialUIReady = whenInitialUIReady;
    }
    return;
  }

  // This script's own URL (on a page), for workers that load the runtime
  // themselves with importScripts.
  var scriptURL = typeof document !== 'undefined' && document && document.currentScript && document.currentScript.src
    ? document.currentScript.src : undefined;

  var indexURL = 'https://cdn.jsdelivr.net/pyodide/v0.28.3/full/';
  // Keep the line above as the single version source for Lua and the builder.
  // Resolve lazily: Quarto can emit the page configuration after dependency tags.
  function selectedIndexURL() {
    if (workerIndexURL) return workerIndexURL;
    return root.CTMAssets && typeof root.CTMAssets.url === 'function' ? root.CTMAssets.url('pyodide') : indexURL;
  }
  // A worker has no page configuration and cannot tell local assets from the
  // CDN: it loads Pyodide only from the base its page gives ensurePyodide.
  var workerIndexURL;
  function useWorkerIndexURL(requested) {
    if (requested === undefined) {
      if (workerIndexURL || (root.CTMAssets && typeof root.CTMAssets.url === 'function')) return;
      throw new Error('Pyodide in a worker: pass the page\'s MathExerciseRuntime.indexURL as ensurePyodide({indexURL}).');
    }
    if (typeof requested !== 'string' || !/^https?:\/\/[^\/?#\s][^?#\s]*\/$/.test(requested)) {
      throw new Error('Pyodide in a worker: indexURL must be an absolute URL of a folder (ending in /).');
    }
    if (workerIndexURL && workerIndexURL !== requested) {
      throw new Error('Pyodide in this worker already uses ' + workerIndexURL);
    }
    workerIndexURL = requested;
  }
  var LOAD_TIMEOUT = root.__qExercisePyodideTimeout || 180000; // override for tests

  function loadScript(src) {
    if (src === selectedIndexURL() + 'pyodide.js' && typeof root.loadPyodide === 'function') {
      return Promise.resolve();
    }

    if (typeof document === 'undefined') {
      if (typeof root.importScripts !== 'function') {
        return Promise.reject(new Error('Cannot load Pyodide: no document or importScripts'));
      }
      try {
        root.importScripts(src);
        return Promise.resolve();
      } catch (error) {
        return Promise.reject(error);
      }
    }

    return new Promise(function (resolve, reject) {
      var script = document.querySelector('script[src="' + src + '"]');
      if (script && script.dataset.qLoaded === '1') { resolve(); return; }

      function loaded() {
        script.dataset.qLoaded = '1';
        resolve();
      }
      function failed() {
        // A failed tag must not trap a later attempt waiting for an event that
        // will never fire. This also permits a retry after a temporary outage.
        if (typeof script.remove === 'function') script.remove();
        reject(new Error('Failed to load: ' + src));
      }

      if (script) {
        script.addEventListener('load', loaded, { once: true });
        script.addEventListener('error', failed, { once: true });
        return;
      }
      script = document.createElement('script');
      script.src = src;
      script.onload = loaded;
      script.onerror = failed;
      document.head.appendChild(script);
    });
  }

  // Waits for Python at most LOAD_TIMEOUT: a load that never finishes ends
  // with an error a later attempt can retry, instead of waiting forever.
  function withLoadLimit(promise) {
    if (typeof setTimeout !== 'function') return Promise.resolve(promise);
    var timer;
    var timeout = new Promise(function (resolve, reject) {
      timer = setTimeout(function () {
        var error = new Error('Python did not finish loading within ' + LOAD_TIMEOUT / 1000 + ' s');
        error.code = 'pyodide-timeout';
        reject(error);
      }, LOAD_TIMEOUT);
    });
    return Promise.race([Promise.resolve(promise), timeout]).finally(function () { clearTimeout(timer); });
  }

  async function ensurePyodide(options) {
    // Some Quarto integrations declare these with top-level `let`, which is
    // visible to classic scripts but is not a property of globalThis.
    var coatless = typeof qpyodideInstance !== 'undefined'
      ? qpyodideInstance : root.qpyodideInstance;
    if (typeof coatless !== 'undefined') {
      // pyodide-interaktiv's worker may still be starting.
      root.mainPyodide = await withLoadLimit(coatless);
      return root.mainPyodide;
    }
    var existing = typeof mainPyodide !== 'undefined'
      ? mainPyodide : root.mainPyodide;
    if (typeof existing !== 'undefined') {
      root.mainPyodide = await withLoadLimit(existing);
      return root.mainPyodide;
    }

    // P13: document consumers always use the page worker. Worker/native callers
    // below still initialize Pyodide locally; never spawn recursively.
    if (typeof document !== 'undefined') {
      if (!root.CTMWorker || typeof root.CTMWorker.page !== 'function') {
        throw new Error('The Python worker dependency is missing. Reinstall CTM Assessment.');
      }
      return withLoadLimit(root.CTMWorker.page({indexURL: selectedIndexURL()}));
    }

    // Share the in-flight initialization with all consumers on this page or
    // worker. Install the promise before either extension can start another.
    useWorkerIndexURL(options && options.indexURL);
    if (!root.__qExercisePyodide) {
      root.__qExercisePyodide = (async function () {
        var selected = selectedIndexURL();
        await loadScript(selected + 'pyodide.js');
        // A failed WebAssembly download leaves loadPyodide() pending forever;
        // give up after LOAD_TIMEOUT so that a later attempt can start again.
        return withLoadLimit(root.loadPyodide({ indexURL: selected }));
      })();
    }
    var pending = root.__qExercisePyodide;
    try {
      root.mainPyodide = await pending;
      return root.mainPyodide;
    } catch (error) {
      if (root.__qExercisePyodide === pending) root.__qExercisePyodide = undefined;
      throw error;
    }
  }

  // Interpreter state that code run by one component on the page must not
  // change for the others (learner code in py-exercise, answers parsed by
  // math-exercise): `snapshot()` before, `restore(state)` after.
  var GUARD_PY = [
    'import builtins as _builtins, os as _os, sys as _sys',
    '_MISSING = object()',
    '',
    'def snapshot():',
    '    return {',
    '        "builtins": dict(_builtins.__dict__),',
    '        "streams": (_sys.stdin, _sys.stdout, _sys.stderr),',
    '        "hooks": (_sys.displayhook, _sys.excepthook),',
    '        "recursion": _sys.getrecursionlimit(),',
    '        "path": list(_sys.path),',
    '        "path_list": _sys.path,',
    '        "cwd": _os.getcwd(),',
    '        "modules": {k: v for k, v in _sys.modules.items() if k.startswith(("_ctm_", "ctm_checkers"))},',
    '    }',
    '',
    'def restore(state):',
    '    # Each item on its own: one that fails must not leave the others changed.',
    '    def builtins_():',
    '        current = _builtins.__dict__',
    '        for key in [k for k in current if k not in state["builtins"]]:',
    '            del current[key]',
    '        for key, value in state["builtins"].items():',
    '            if current.get(key, _MISSING) is not value:',
    '                current[key] = value',
    '    def streams():',
    '        _sys.stdin, _sys.stdout, _sys.stderr = state["streams"]',
    '        _sys.displayhook, _sys.excepthook = state["hooks"]',
    '    def path():',
    '        _sys.path = state["path_list"]',
    '        _sys.path[:] = state["path"]',
    '    for step in (builtins_, streams, lambda: _sys.setrecursionlimit(state["recursion"]), path,',
    '                 lambda: _os.chdir(state["cwd"]), lambda: _sys.modules.update(state["modules"])):',
    '        try:',
    '            step()',
    '        except Exception:',
    '            pass',
  ].join('\n');

  // What a runtime has installed: once per runtime and name, calls for the
  // same name share one install, and a failed install is forgotten so that a
  // later call tries again.
  var installed = typeof WeakMap === 'function' ? new WeakMap() : null;
  function once(py, name, start) {
    var done = installed && installed.get(py);
    if (done && done[name]) return done[name];
    var install;
    try { install = Promise.resolve(start()); } catch (error) { install = Promise.reject(error); }
    if (installed) {
      if (!done) { done = {}; installed.set(py, done); }
      done[name] = install;
      install.catch(function () { if (done[name] === install) delete done[name]; });
    }
    return install;
  }

  // Installs a Python source as a private module (not in the interpreter's
  // global namespace, which learner code shares), once per runtime. Each
  // module passes its source under its own name, so concurrent installs of
  // different modules cannot mix.
  function installModule(py, name, source) {
    var variable = '_ctm_source_' + name.replace(/[^A-Za-z0-9_]/g, '_');
    return once(py, name, async function () {
      await py.globals.set(variable, source);
      await py.runPythonAsync([
        'import sys as _ctm_sys, types as _ctm_types',
        '_ctm_module = _ctm_types.ModuleType("' + name + '")',
        'exec(' + variable + ', _ctm_module.__dict__)',
        '_ctm_sys.modules["' + name + '"] = _ctm_module',
        'del _ctm_sys, _ctm_types, _ctm_module, ' + variable,
      ].join('\n'));
    });
  }
  // Forget what a runtime has installed (for example after learner code in
  // another cell removed it); the next install runs again.
  function forgetModules(py) {
    if (installed) installed.delete(py);
    if (checkerHeld) checkerHeld.delete(py);
  }
  function ensureGuard(py) { return installModule(py, '_ctm_guard', GUARD_PY); }

  // The names the install code of ctm-checkers 0.1 (CTM Assessment 0.10.0)
  // leaves in the namespace for its own call text (_ctm_import,
  // _ctm_globals; later versions leave none): this runtime's call text,
  // below, needs none of them, so they go (no lookups: assign, then delete).
  var CHECKERS_LEFTOVERS = '_ctm_import = None\ndel _ctm_import\n_ctm_globals = None\ndel _ctm_globals';
  // After the install, every module of ctm_checkers is imported, so that no
  // call reads the wheel file again: learner code may delete or overwrite
  // /tmp/ctm-checkers (math-exercise 0.10 kept its checker module in memory
  // too). A module that cannot be imported yet (a package not loaded) is
  // imported on its first use instead. The walk sees what the page's scripts
  // installed: from ctm-checkers 0.2 the STACK engine has a wheel and page
  // script of its own (ctm-checkers-stack.js), so a page with math-exercise
  // alone loads no STACK module.
  var CHECKERS_LOAD = [
    'def _ctm_checkers_load():',
    '    import builtins, importlib, pkgutil',
    '    package = importlib.import_module("ctm_checkers")',
    '    for module in pkgutil.walk_packages(package.__path__, "ctm_checkers.", onerror=lambda name: None):',
    '        if not module.name.endswith(".__main__"):',
    '            try:',
    '                importlib.import_module(module.name)',
    '            except builtins.Exception:',
    '                pass',
    'try:',
    '    _ctm_checkers_load()',
    'finally:',
    '    del _ctm_checkers_load',
    CHECKERS_LEFTOVERS,
  ].join('\n');

  // Runtimes that were stopped or restarted. A runtime is `gone` only on
  // evidence of that: this runtime's stop() restarted it;
  // pyodide-interaktiv's restart() announced it with its
  // `qpyodide-runtime-restart` event, which it sends before it terminates
  // the worker and rejects the pending calls (`mainPyodide` is still that
  // runtime then); or a call was rejected with exactly the error that
  // restart() gives without a reason (RESTARTED). No other error marks a
  // runtime gone, whatever its text (a Python error may come without a
  // traceback: sys.tracebacklimit = 0). pyodide-interaktiv's terminated
  // worker never answers a later call, so ensureCheckers and callCheckers
  // send a gone runtime nothing and fail at once (the caller moves to the
  // new runtime).
  var gone = typeof WeakMap === 'function' ? new WeakMap() : null;
  var RESTARTED = 'Python was restarted.';
  function markGone(py, reason) {
    if (gone && py && (typeof py === 'object' || typeof py === 'function') && !gone.has(py)) {
      gone.set(py, new Error(reason || RESTARTED));
    }
  }
  if (typeof root.addEventListener === 'function') {
    root.addEventListener('qpyodide-runtime-restart', function (event) {
      if (event.detail && event.detail.proxy === root.mainPyodide) {
        var py = event.detail.proxy;
        if (!gone.has(py)) { stops++; runtimeStops.set(py, (runtimeStops.get(py) || 0) + 1); }
        markGone(py);
      }
    });
  }

  // Installs ctm-checkers, the Python checker library, into the runtime `py`,
  // once per runtime and payload like the modules above (forgetModules
  // forgets it too). `payload` defaults to the page's ctm-checkers.js
  // (globalThis.CTMCheckers, HTML dependency "ctm-checkers"); another is
  // ctm-checkers-stack.js (globalThis.CTMCheckersStack), whose install
  // installs ctm-checkers and its STACK engine. Its own install code does the
  // work with py.globals.set and py.runPythonAsync only (ctm-checkers
  // docs/api.md): it checks the wheel's SHA-256 and imports ctm_checkers from
  // the wheel. Then the whole library is loaded (CHECKERS_LOAD).
  //
  // A part's payload (`part`, such as ctm-checkers-stack.js) installs
  // ctm-checkers too, so after "ctm-checkers, then its STACK engine" the
  // ctm-checkers wheel was installed twice; that is all it costs. The other
  // way round, ctm-checkers' own install replaces the whole package
  // (ctm_checkers.* and its wheels' paths), the parts installed before
  // included: so it makes the runtime forget them, and the next call that
  // needs a part installs it again. The installs and the calls of one
  // runtime run one after another, in one queue (checkersQueue), so that what
  // a runtime holds is what it last installed and no call runs while an
  // install replaces the package: ensureCheckers and callCheckers work in
  // any order, also when a component installs directly (ensureCheckers
  // outside callCheckers) while another's call waits.
  function checkersKey(checkers) {
    return (checkers && typeof checkers.name === 'string' && checkers.name) || 'ctm-checkers';
  }
  function checkersPayload(payload) {
    var checkers = payload || root.CTMCheckers;
    if (!checkers || typeof checkers.install !== 'function') {
      throw new Error('ctm-checkers is not loaded on this page: its script ctm-checkers.js is missing');
    }
    return checkers;
  }
  // The runtime's queue: each task starts when the one before it has ended.
  var checkerQueues = typeof WeakMap === 'function' ? new WeakMap() : null;
  function checkersQueue(py, task) {
    var previous = (checkerQueues && checkerQueues.get(py)) || Promise.resolve();
    var result = previous.then(task);
    if (checkerQueues) checkerQueues.set(py, result.catch(function () {}));
    return result;
  }
  // The payloads each runtime holds: installed, and not replaced since.
  var checkerHeld = typeof WeakMap === 'function' ? new WeakMap() : null;
  function heldBy(py) {
    var held = checkerHeld && checkerHeld.get(py);
    if (!held) { held = {}; if (checkerHeld) checkerHeld.set(py, held); }
    return held;
  }
  // Installs a payload unless the runtime holds it; runs in the queue only.
  function installCheckers(py, checkers) {
    var failure = gone && gone.get(py);
    if (failure) return Promise.reject(failure);
    var key = checkersKey(checkers), held = heldBy(py);
    if (held[key]) return Promise.resolve();
    if (!checkers.part) {
      // ctm-checkers replaces the package: the parts installed before go
      // (also when the install fails half-way).
      var done = installed && installed.get(py);
      Object.keys(held).forEach(function (other) { delete held[other]; if (done) delete done[other]; });
    }
    return Promise.resolve(checkers.install(py)).then(function () {
      return py.runPythonAsync(CHECKERS_LOAD);
    }).then(function () { held[key] = true; });
  }
  function ensureCheckers(py, payload) {
    var checkers;
    try { checkers = checkersPayload(payload); } catch (error) { return Promise.reject(error); }
    var failure = gone && gone.get(py);
    if (failure) return Promise.reject(failure);
    return once(py, checkersKey(checkers), function () {
      return transaction(py, function () {
        return checkersQueue(py, function () { return installCheckers(py, checkers); });
      });
    });
  }

  // The call text: it looks up no name in the runtime's namespace, which
  // learner code shares (it may rebind __import__, globals or any _ctm_ name
  // there); an import statement finds the builtins without a lookup. The
  // request and the call use the same namespace (the runtime's globals).
  function checkersCall(name) {
    return 'import builtins as _ctm_builtins\n'
      + '_ctm_builtins.__import__("ctm_checkers.browser", fromlist=["call"]).call(' + JSON.stringify(name)
      + ', _ctm_builtins.globals())';
  }
  // After a call: removes the request, the call text's own name and the
  // install code's leftovers, so that nothing of a call stays in the
  // namespace learner code shares, and tells whether the request was still
  // there (True). ctm-checkers' call takes the request out of the namespace
  // before anything else (browser.py), so a request still there means that
  // the call text failed before it reached the call: learner code removed
  // ctm-checkers or rebound what the import uses, and installing again
  // repairs it. Without it, an error is the call's own (the answer to the
  // request, for example a learner string the admission rule rejects).
  // This needs no traceback, which learner code may turn off
  // (sys.tracebacklimit = 0). Its only lookup is the import statement, as in
  // the call text.
  var CHECKERS_CLEANUP = [
    'import builtins as _ctm_builtins',
    '_ctm_namespace = _ctm_builtins.globals()',
    'del _ctm_builtins',
    '_ctm_namespace.pop("_ctm_import", None)',
    '_ctm_namespace.pop("_ctm_globals", None)',
    '_ctm_namespace.pop("_ctm_namespace").pop("_ctm_request", None) is not None',
  ].join('\n');

  // Runs ctm-checkers' call `name` (for example "math_exercise.check") on
  // `request` (an object; ctm-checkers docs/api.md) in the runtime `py` and
  // returns the JSON text it returns. Installs ctm-checkers first (once per
  // runtime). The calls of one runtime run one after another, since the
  // request travels in one global (_ctm_request), and in the same queue as
  // the installs, so that no install replaces the package during a call;
  // pass the runtime object that ensurePyodide returned, so that every caller
  // queues on the same one. A runtime that hangs holds up only its own calls
  // and installs. After the call, the cleanup removes the request and the
  // call text's names. When the call text failed before it reached
  // ctm-checkers' call (the request was still there), ctm-checkers is
  // installed again and the call is repeated once; the second failure and an
  // error the call itself raised reach the caller. When the runtime was
  // stopped or restarted meanwhile (a stop on the page, or the runtime is
  // gone), nothing more is sent to it: no cleanup and no repeat, and the
  // later calls and installs for a gone runtime, also those waiting behind
  // this one, fail at once.
  function callCheckers(py, name, request, payload, handlers) {
    var text = typeof request === 'string' ? request : JSON.stringify(request);
    var epoch = stopCount({runtime: py});
    async function run() {
      var checkers = checkersPayload(payload);
      for (var tries = 0; ; tries++) {
        await installCheckers(py, checkers);
        var result, failure = null;
        try {
          await py.globals.set('_ctm_request', text);
          result = await py.runPythonAsync(checkersCall(name));
        } catch (error) {
          failure = error || new Error('ctm-checkers call failed');
          if (failure.message === RESTARTED) markGone(py, RESTARTED);
        }
        if (stopCount({runtime: py}) !== epoch || (gone && gone.has(py))) {
          if (failure) throw failure;
          return result;
        }
        var requestLeft = null;
        try { requestLeft = await py.runPythonAsync(CHECKERS_CLEANUP); } catch (ignored) { /* removed by the next call's cleanup */ }
        if (!failure) return result;
        if (requestLeft !== true || tries > 0) throw failure;
        // Install that payload again: the runtime no longer holds it.
        var key = checkersKey(checkers), done = installed && installed.get(py);
        delete heldBy(py)[key];
        if (done) delete done[key];
      }
    }
    return transaction(py, function () { return checkersQueue(py, run); }, handlers);
  }

  // One logical transaction queue per interpreter, shared by all consumers.
  // A stopped operation never enters a replacement interpreter or runs later.
  var transactions = new WeakMap();
  function transaction(py, run, handlers) {
    var epoch = stopCount({runtime: py});
    var previous = transactions.get(py) || Promise.resolve();
    var current = previous.catch(function () {}).then(async function () {
      if (gone && gone.has(py)) throw gone.get(py);
      if (stopCount({runtime: py}) !== epoch) {
        var error = new Error('Python operation was cancelled.'); error.cancelled = true; throw error;
      }
      var execute = async function () {
        if (stopCount({runtime: py}) !== epoch) {
          var cancelled = new Error('Python operation was cancelled.'); cancelled.cancelled = true; throw cancelled;
        }
        if (handlers && handlers.onStart) handlers.onStart();
        var result = await run();
        if (stopCount({runtime: py}) !== epoch) {
          var error = new Error('Python operation was cancelled.'); error.cancelled = true; throw error;
        }
        return result;
      };
      return py.operation ? py.operation(execute, handlers) : execute();
    });
    transactions.set(py, current);
    current.finally(function () { if (transactions.get(py) === current) transactions.delete(py); }).catch(function () {});
    return current;
  }

  // Standalone and IDE pages receive a stoppable CTMWorker proxy. Native
  // interpreter objects used inside a worker are not page-side Stop handles.
  function selectedRuntime(options) {
    return options && Object.prototype.hasOwnProperty.call(options, 'runtime') ? options.runtime : root.mainPyodide;
  }
  function canStop(options) {
    var py = selectedRuntime(options);
    return !!(py && typeof py.restart === 'function');
  }
  var stops = 0;
  var runtimeStops = new WeakMap(), stopping = new WeakMap();
  function stop(reason, options) {
    var py = selectedRuntime(options);
    if (!canStop({runtime: py})) return;
    if (stopping.has(py)) return stopping.get(py);
    if (!options || !Object.prototype.hasOwnProperty.call(options, 'runtime')) stops++;
    runtimeStops.set(py, (runtimeStops.get(py) || 0) + 1);
    if (typeof py.cancelOperation === 'function') py.cancelOperation();
    var message = reason || 'Stopped by the learner';
    function announce(state) {
      if (root.dispatchEvent && typeof root.CustomEvent === 'function') root.dispatchEvent(new root.CustomEvent('ctm-python-stop-state', {detail: {proxy: py, state: state}}));
    }
    announce('stopping');
    function restart() { announce('restarting'); markGone(py, message); return py.restart(message); }
    if (!root.crossOriginIsolated || !py.interruptBuffer || typeof py.interrupt !== 'function' || typeof py.whenIdle !== 'function') {
      return restart();
    }
    // An interrupt is scoped to this proxy. Keep its session if the active
    // RPCs settle within two seconds; otherwise replace only this worker.
    py.interrupt();
    var timer;
    var done = new Promise(function (resolve) {
      timer = setTimeout(function () { resolve(false); }, 2000);
      Promise.resolve(py.whenIdle()).then(function () { resolve(true); }, function () { resolve(false); });
    }).then(function (idle) {
      clearTimeout(timer);
      if (!idle) return restart();
      if (typeof py.clearInterrupt === 'function') py.clearInterrupt();
      announce('stopped');
    });
    stopping.set(py, done);
    done.then(function () { stopping.delete(py); }, function () { stopping.delete(py); });
    return done;
  }
  function stopCount(options) { return options ? (runtimeStops.get(selectedRuntime(options)) || 0) : stops; }
  // Calls onSlow once when a run has taken `ms` and the runtime can be
  // stopped (a worker that is still starting becomes stoppable later).
  // Returns a function that cancels it.
  function whenSlow(ms, onSlow, options) {
    var timer = null, cancelled = false;
    function check() {
      if (cancelled) return;
      if (canStop(options)) { onSlow(); return; }
      timer = setTimeout(check, 1000);
    }
    timer = setTimeout(check, Math.min(ms, 2147483647));  // larger delays overflow to 0
    return function () { cancelled = true; clearTimeout(timer); };
  }

  root.MathExerciseRuntime = {
    get indexURL() { return selectedIndexURL(); },
    loadTimeout: LOAD_TIMEOUT,
    loadScript: loadScript,
    ensurePyodide: ensurePyodide,
    trackInitialUI: trackInitialUI,
    whenInitialUIReady: whenInitialUIReady,
    prepareMonacoClipboard: prepareMonacoClipboard,
    scriptURL: scriptURL,
    installModule: installModule,
    forgetModules: forgetModules,
    ensureGuard: ensureGuard,
    ensureCheckers: ensureCheckers,
    callCheckers: callCheckers,
    transaction: transaction,
    canStop: canStop,
    stop: stop,
    stopCount: stopCount,
    whenSlow: whenSlow
  };
})(globalThis);

// Monaco 0.46 supports Promise<Worker> from its public getWorker hook. Keep
// editor construction independent of COI: only the lazy worker must wait for
// the document's stay/reload decision (a retired document never resolves it).
(function (root) {
  'use strict';
  if (!root.document || typeof root.Worker !== 'function') return;
  var environment = root.MonacoEnvironment || (root.MonacoEnvironment = {});
  if (environment.getWorker && environment.getWorker.ctmCoiGate) return;
  var authoredWorker = environment.getWorker;
  var authoredURL = environment.getWorkerUrl;
  var authoredPolicy = environment.createTrustedTypesPolicy;
  var workerPolicy;

  // Capture Monaco's own policy, without creating a second policy or changing
  // its names, options or error handling. The shared runtime runs in the head,
  // before either CTM component loads editor.main and its default factory.
  environment.createTrustedTypesPolicy = function () {
    var policy = authoredPolicy ? authoredPolicy.apply(this, arguments)
      : root.trustedTypes && root.trustedTypes.createPolicy.apply(root.trustedTypes, arguments);
    if (arguments[0] === 'defaultWorkerFactory') workerPolicy = policy;
    return policy;
  };

  function gatedWorker(workerId, label) {
    var receiver = this, args = arguments;
    function createWorker() {
      if (typeof authoredWorker === 'function') return authoredWorker.apply(receiver, args);
      function construct(url) {
        return new root.Worker(workerPolicy ? workerPolicy.createScriptURL(url) : url, {name: label});
      }
      if (typeof authoredURL === 'function') return construct(authoredURL.apply(receiver, args));
      return new Promise(function (resolve, reject) {
        // Reuse the pinned AMD factory's bootstrap URL: it preserves CDN Blob
        // baseUrl/importScripts, same-origin COI parameters and the worker label.
        // This exported AMD helper is version-bound, unlike the public hook.
        root.require(['require', 'vs/base/browser/defaultWorkerFactory'], function (amdRequire, factory) {
          try {
            if (typeof factory.getWorkerBootstrapUrl !== 'function') throw new Error('Monaco worker bootstrap API is unavailable');
            var url = factory.getWorkerBootstrapUrl(amdRequire.toUrl('vs/base/worker/workerMain.js'), label);
            resolve(construct(url));
          } catch (error) { reject(error); }
        }, reject);
      });
    }
    var decision = root.qpyodideCoiSettled;
    return decision ? Promise.resolve(decision).then(createWorker) : createWorker();
  }
  gatedWorker.ctmCoiGate = true;
  environment.getWorker = gatedWorker;
})(globalThis);
