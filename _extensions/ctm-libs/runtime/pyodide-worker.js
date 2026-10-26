/* ctm-libs runtime/pyodide-worker.js — AGPL-3.0-or-later.
 * CTMWorker: Python (Pyodide) in a Web Worker for a page (HTML dependency
 * ctm-worker, a classic script after ctm-runtime). One implementation of the
 * worker and its RPC, moved from pyodide-interaktiv 1.8
 * (qpyodide-document-engine-initialization.js); a component adds its own
 * worker-side commands as a plugin (pyodide-interaktiv: runCell).
 *
 * Python runs in its own thread, so the page stays responsive during long
 * computations. Stopping a running computation:
 *   - cross-origin isolated page (COOP/COEP headers, or coi-serviceworker.js):
 *     a KeyboardInterrupt through a SharedArrayBuffer; variables are kept;
 *   - otherwise: the worker restarts (variables are lost).
 * input() works through Atomics.wait on a SharedArrayBuffer (isolated pages).
 *
 *   CTMWorker.start(options) -> Promise of the proxy (docs/api.md)
 *
 * The proxy is what `await qpyodideReady` and `mainPyodide` give other
 * components (publish: true): runPythonAsync, loadPackagesFromImports,
 * loadPackage, globals.set, toPy, isWorkerProxy, interrupt, clearInterrupt,
 * abortInput, provideInput, restart, the shared buffers, onStream,
 * onInputRequired, and the plugin's commands. */
(function (root) {
  'use strict';
  if (root.CTMWorker && typeof root.CTMWorker.start === 'function') return;

  var ownScriptURL = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : null;

  // ---------------------------------------------------------------------------
  // Worker source (runs in the background thread)
  // ---------------------------------------------------------------------------
  // Important: String.raw, so escape sequences arrive in the worker unchanged.
  // Don't use backticks or "dollar-curly-brace" in the worker source!
  var WORKER_SOURCE = String.raw`
// Pyodide worker of ctm-libs (CTMWorker)
let pyodide = null;
let runEntries = [];
let inputAllowed = true, learnerPhase = true;
let operationID = null, outputBytes = 0, outputPending = [], outputPendingBytes = 0;
let streamOutstanding = false, outputTruncated = false;
const OUTPUT_LIMIT = 262144, BATCH_LIMIT = 16384, ENTRY_LIMIT = 4096;
function flushOutput() {
  if (!outputPending.length || streamOutstanding) return;
  self.postMessage({type: 'streamBatch', operationID, entries: outputPending});
  outputPending = []; outputPendingBytes = 0; streamOutstanding = true;
}
function emitOutput(text, type) {
  text = String(text);
  if (!learnerPhase) return;
  if (outputTruncated) return;
  const bytes = new TextEncoder().encode(text).length;
  if (outputBytes + bytes > OUTPUT_LIMIT || runEntries.length >= ENTRY_LIMIT) {
    outputTruncated = true;
    outputPending.push({message: ((config && config.messages || {}).outputTruncated || 'Output truncated; Stop is still available.'), type: 'notice'});
    flushOutput(); return;
  }
  outputBytes += bytes;
  const entry = {message: text, type};
  runEntries.push(entry); outputPending.push(entry); outputPendingBytes += bytes;
  if (outputPendingBytes >= BATCH_LIMIT || outputPending.length === 1) flushOutput();
}
function resetOutput() {
  runEntries = []; outputBytes = 0; outputPending = []; outputPendingBytes = 0;
  streamOutstanding = false; outputTruncated = false;
}

// Input buffer for Atomics-based stdin (null if unavailable)
let inputStatusBuf = null;   // Int32Array(SharedArrayBuffer) 0=idle 1=waiting 2=ready 3=aborted
let inputDataBuf   = null;   // Uint8Array(SharedArrayBuffer) UTF-8-encoded input (null-terminated)

// Prompt text of the next input() call (set through the plugins' setPrompt)
let pendingInputPrompt = "";

// stdin: blocks the worker thread until the user enters something.
// Called by Pyodide as the stdin handler when Python executes input().
// First sends a request to the main thread, then the worker waits via
// Atomics.wait (blocks only the worker thread, not the page).
// If no SharedArrayBuffer is available, stdin returns null (EOF).
function stdin() {
  if (!inputStatusBuf || !inputDataBuf) throw new Error('Interactive input needs a secure, cross-origin isolated server.');
  const prompt = pendingInputPrompt;
  pendingInputPrompt = "";
  Atomics.store(inputStatusBuf, 0, 1);              // status: waiting
  self.postMessage({ type: "inputRequired", prompt, operationID }); // notify the main thread
  Atomics.wait(inputStatusBuf, 0, 1);               // block until status != 1
  const status = Atomics.load(inputStatusBuf, 0);
  Atomics.store(inputStatusBuf, 0, 0);              // status: idle
  if (status !== 2) return null;                    // aborted (status 3) -> EOF
  let end = 0;
  while (end < inputDataBuf.length && inputDataBuf[end] !== 0) end++;
  return new TextDecoder().decode(inputDataBuf.slice(0, end)) + "\n";
}

function postStatus(text) {
  self.postMessage({ type: "status", text: text });
}

// Plugins: a component's worker-side code calls registerPlugin(factory);
// factory(api) returns {commands: {name: async (message) => value},
// stage1: "<Python run once the interpreter is ready>"}.
// api.pyodide(): the interpreter; api.capture: the stdout/stderr evidence of
// a command (start() empties it, push(entry), entries()); api.setPrompt(text):
// the prompt of the next input() call (Pyodide's stdout is line-buffered, so
// a prompt without a newline would never reach the page otherwise).
const plugins = [];
const pluginCommands = {};
const pluginAPI = {
  pyodide: () => pyodide,
  capture: {
    start() { resetOutput(); },
    push(entry) { emitOutput(entry.message, entry.type); },
    entries() { return runEntries; }
  },
  setPrompt(text) {
    text = String(text);
    if (text.length > 4096) throw new Error('Python input prompt exceeds its display budget.');
    pendingInputPrompt = text;
  }
};
function registerPlugin(factory) {
  const plugin = factory(pluginAPI) || {};
  plugins.push(plugin);
  for (const name of Object.keys(plugin.commands || {})) pluginCommands[name] = plugin.commands[name];
}

// Start-up in two stages (D2, step-3 design §18.5). Stage 1 (init): the
// interpreter, the plugins' stage-1 Python and, when the page asks for them,
// micropip and its packages; then the proxy is ready and other components'
// checks run. Stage 2 (setup): the background packages (pyodide-interaktiv:
// pyodide_http, micropip, matplotlib) without ever making a check wait for
// their downloads: they are fetched in byte ranges outside Pyodide's package
// lock, paused while a command downloads, and installed one at a time, from
// the verified bytes (below), while nothing else runs.
let config = null;
async function init(cfg) {
  config = cfg;
  for (const url of config.pluginURLs || []) {
    const plugin = await import(url);
    registerPlugin(plugin.default);
  }
  // Shorter limits for tests only (tests/worker.test.cjs, tests/browser/worker.mjs).
  const timing = cfg.timing || {};
  if (timing.range) RANGE = timing.range;
  if (timing.resumeAfter !== undefined) RESUME_AFTER = timing.resumeAfter;
  if (timing.stall) STALL = timing.stall;
  if (timing.retryAfter) RETRY_AFTER = timing.retryAfter;
  if (timing.slowInstall) SLOW_INSTALL = timing.slowInstall;
  if (timing.installQuiet !== undefined) INSTALL_QUIET = timing.installQuiet;
  if (timing.installCeiling !== undefined) INSTALL_CEILING = timing.installCeiling;
  // Translated status texts come along from the main thread
  const msg = config.messages || {};
  const mod = await import(config.indexURL + "pyodide.mjs");

  postStatus(msg.loading || "Loading Python (Pyodide) ...");
  pyodide = await mod.loadPyodide({
    indexURL: config.indexURL,
    // Preserve the pre-0.28 JavaScript-null behaviour for existing lessons.
    convertNullToNone: true,
    env: config.env,
    stdin: stdin,
    stdout: function(text) {
      emitOutput(text, 'stdout');
    },
    stderr: function(text) {
      emitOutput(text, 'stderr');
    }
  });

  // Packages requested by the page (pyodide: packages: [...]): a check may
  // import them, so they belong to stage 1.
  if (config.packages && config.packages.length > 0) {
    postStatus(msg.initPackages || "Initialising Python packages ...");
    if (config.assetsMode === "local") {
      // Explicit packages were checked during the render; recheck against the
      // served subset before loading. Never ask micropip/PyPI in local mode.
      await readLock();
      const names = config.packages.map(canonical);
      for (const name of names) {
        if (!Object.prototype.hasOwnProperty.call(lockPackages, name)) {
          throw new Error("Package is outside the local Pyodide subset: " + name);
        }
      }
      const errors = [];
      await pyodide.loadPackage(names, {
        checkIntegrity: true,
        errorCallback: text => { errors.push(String(text)); }
      });
      // loadPackage can report a failed download without rejecting. Required
      // stage-1 packages must actually be loaded before publishing readiness.
      const missing = names.filter(name => !isLoaded(name));
      if (missing.length) {
        console.warn("CTMWorker: stage 1 could not install " + missing.join(", ") + ": " + (errors.join("\n") || "not loaded"));
        const reason = errors.find(text => !/^The following error occurred/.test(text)) || "not installed";
        throw new Error(missing.join(", ") + ": " + shortReason(reason));
      }
    } else {
      await pyodide.loadPackage("micropip");
      postStatus(msg.extraPackages || "Installing additional packages ...");
      const micropip = pyodide.pyimport("micropip");
      await micropip.install(config.packages);
      micropip.destroy();
    }
  }

  // Catch KeyboardInterrupt inside Python: BaseException escaping WebLoop
  // otherwise becomes an uncaught worker event and leaves its RPC unresolved.
  const rawRunPythonAsync = pyodide.runPythonAsync.bind(pyodide);
  await rawRunPythonAsync([
    'import sys as _ctm_sys, types as _ctm_types',
    '_ctm_executor = _ctm_types.ModuleType("_ctm_executor")',
    'exec("from pyodide.code import eval_code_async\\nasync def run(code, namespace):\\n    try:\\n        return await eval_code_async(code, namespace)\\n    except KeyboardInterrupt:\\n        raise RuntimeError(\\\"Python operation interrupted\\\") from None\\n    except Exception:\\n        raise\\n    except BaseException as error:\\n        raise RuntimeError(str(error)) from None", _ctm_executor.__dict__)',
    '_ctm_sys.modules["_ctm_executor"] = _ctm_executor',
    'del _ctm_sys, _ctm_types, _ctm_executor'
  ].join('\n'));
  const executorModule = pyodide.pyimport('_ctm_executor');
  const borrowedExecutor = executorModule.run;
  const execute = borrowedExecutor.copy ? borrowedExecutor.copy() : borrowedExecutor;
  executorModule.destroy();
  pyodide.runPythonAsync = async code => {
    const pending = execute(String(code), pyodide.globals);
    try { return await pending; }
    finally { pending?.destroy?.(); }
  };
  self._ctm_set_input_prompt = text => { if (text) pluginAPI.setPrompt(text); };
  self._ctm_input_available = () => !!inputStatusBuf && inputAllowed && learnerPhase;
  self._ctm_set_execution_phase = phase => { learnerPhase = phase === 'learner'; };
  self._ctm_emit_learner = text => emitOutput(text, 'stdout');
  await pyodide.runPythonAsync([
    'import builtins as _ctm_input_builtins',
    'def _ctm_input(prompt="", _original=_ctm_input_builtins.input, _unavailable=type("_CTMInputUnavailable", (BaseException,), {})):',
    '    from js import _ctm_set_input_prompt, _ctm_input_available',
    '    if not _ctm_input_available():',
    '        raise _unavailable(' + JSON.stringify('ctm-input-unavailable: ' + (msg.inputUnavailable || 'Interactive input needs a secure, cross-origin isolated server and a learner run.')) + ')',
    '    _ctm_set_input_prompt(str(prompt))',
    '    return _original("")',
    '_ctm_input_builtins.input = _ctm_input',
    'del _ctm_input_builtins, _ctm_input'
  ].join('\n'));
  for (const plugin of plugins) {
    if (plugin.stage1) await pyodide.runPythonAsync(plugin.stage1);
  }
}

// --- Commands that may download, and the queue's state ---------------------
// busy: commands queued or running; downloads: those of them that may
// download (loadPackage, loadPackagesFromImports of a package not yet
// loaded); lastDownload: when the last such command ended; lastCommand: when
// the last command of any kind ended.
let RANGE = 512 * 1024;          // bytes per prefetch request
let RESUME_AFTER = 2000;         // ms of quiet after a download command
let STALL = 30000;               // ms without a byte: the range is requested again
let RETRY_AFTER = [5000, 30000]; // then a third failure ends stage 2
let SLOW_INSTALL = 60000;        // an install this long is named in the status line
let INSTALL_QUIET = 300;         // ms of quiet after any command before an install
let INSTALL_CEILING = 5000;      // ms an install waits for that quiet at most
let busy = 0, downloads = 0, lastDownload = -Infinity, lastCommand = -Infinity;
let wakers = [];
function changed() {
  const list = wakers;
  wakers = [];
  for (const wake of list) wake();
}
// Resolves once ready() returns true; ready() may return a delay in ms to be
// asked again then, or false to be asked again when the queue changes.
function until(ready) {
  return new Promise(resolve => {
    const check = () => {
      const answer = ready();
      if (answer === true) resolve();
      else if (typeof answer === "number") setTimeout(check, answer);
      else wakers.push(check);
    };
    check();
  });
}
function quiet() {
  return until(() => {
    if (downloads > 0) return false;
    const left = lastDownload + RESUME_AFTER - performance.now();
    return left <= 0 ? true : left;
  });
}
// Runs task in the command queue once nothing is queued or running and no
// command has ended for INSTALL_QUIET ms; it is queued at that very moment,
// so a command arriving later waits for it. The quiet time keeps an install
// out of the gaps between a check's calls (each call is a round trip from
// the page), so a check of k calls meets at most one install, not k.
// Ceiling: commands that never leave INSTALL_QUIET ms between them would
// postpone the installs for as long as they go on, so a task that has waited
// INSTALL_CEILING ms takes the next moment nothing is queued or running.
// Each task's wait starts when the previous one has ended, so installs are
// at least INSTALL_CEILING ms apart, and a check shorter than that still
// meets at most one.
function whenIdle(task) {
  const since = performance.now();
  return until(() => {
    if (busy > 0 || operationID !== null) return false;
    const now = performance.now();
    if (now - since >= INSTALL_CEILING) return true;
    const left = Math.min(lastCommand + INSTALL_QUIET, since + INSTALL_CEILING) - now;
    return left <= 0 ? true : left;
  }).then(() => {
    const run = commandQueue.then(task);
    commandQueue = run.catch(() => {});
    return run;
  });
}

// --- Pyodide's lock file: packages, their files and imports ----------------
const canonical = name => String(name).toLowerCase().replace(/[-_.]+/g, "-");
let lockPackages = null, lockImports = null;
async function readLock() {
  if (lockPackages) return;
  // The URL loadPyodide read it from (start-up put it in the browser's cache).
  const response = await fetch(config.indexURL + "pyodide-lock.json");
  if (!response.ok) throw new Error("HTTP " + response.status + " for pyodide-lock.json");
  const lock = await response.json();
  const packages = {}, imports = {};
  for (const [key, entry] of Object.entries(lock.packages || {})) {
    const name = canonical(entry.name || key);
    packages[name] = entry;
    for (const module of entry.imports || []) imports[module] = name;
  }
  lockPackages = packages;
  lockImports = imports;
}
function isLoaded(name) {
  const wanted = canonical(name);
  return Object.keys(pyodide.loadedPackages || {}).some(loaded => canonical(loaded) === wanted);
}
// The packages and their dependencies, dependencies first.
function closure(names) {
  const order = [], seen = new Set();
  const visit = name => {
    const key = canonical(name);
    if (seen.has(key)) return;
    seen.add(key);
    const entry = lockPackages && lockPackages[key];
    for (const dependency of (entry && entry.depends) || []) visit(dependency);
    order.push(key);
  };
  names.forEach(visit);
  return order;
}
function mayDownload(msg) {
  if (msg.type === "loadPackage") return !pyodide || [].concat(msg.name).some(name => !isLoaded(name));
  if (msg.type !== "loadPackagesFromImports") return false;
  if (!pyodide || !lockImports) return true;
  try {
    const found = pyodide.code.find_imports(msg.code);
    const modules = found.toJs();
    found.destroy();
    return modules.some(module => lockImports[module] && !isLoaded(lockImports[module]));
  } catch (err) {
    return true;
  }
}

// --- Stage 2 -----------------------------------------------------------------
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// The wheels of stage 2 are installed from the bytes the prefetch received,
// once their SHA-256 equals the lock file's: the worker answers loadPackage's
// request for such a URL itself, so an install never downloads and never
// depends on whether the browser's HTTP cache serves a full request from
// cached byte ranges. With jsDelivr's wheel responses (a weak ETag,
// Vary: Accept-Encoding, no Accept-Ranges) Chromium did not: installs
// downloaded inside Pyodide's lock again, and in CI they failed with
// "Failed to fetch". Where the bytes can be verified and kept (crypto.subtle
// and the Cache Storage, i.e. a secure context) the prefetch bypasses the
// HTTP cache, and the Cache Storage "ctm-pyodide-wheels" keeps verified
// wheels for the next page; elsewhere (a plain-HTTP origin) the prefetch
// fills the HTTP cache, as before. A wheel that does not verify is fetched
// by loadPackage as usual.
const WHEEL_CACHE = "ctm-pyodide-wheels";
const verified = new Map();   // URL -> Uint8Array, until installed
const networkFetch = globalThis.fetch;
globalThis.fetch = function(input, init) {
  const url = typeof input === "string" ? input : (input && input.href) || (input && input.url) || String(input);
  const bytes = verified.get(url);
  if (bytes) return Promise.resolve(new Response(bytes, { status: 200, headers: { "Content-Type": "application/octet-stream" } }));
  return networkFetch(input, init);
};
// Verified bytes can be kept for the next page (secure contexts).
function keepsWheels() {
  return !!(globalThis.crypto && crypto.subtle && globalThis.caches);
}
async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
// Holds bytes for url when they are the lock file's wheel; true if so.
async function holdVerified(url, bytes, sha256) {
  try {
    if (!sha256 || !globalThis.crypto || !crypto.subtle || (await sha256Hex(bytes)) !== String(sha256).toLowerCase()) return false;
  } catch (err) {
    return false;
  }
  verified.set(url, bytes);
  return true;
}
async function cachedWheel(url) {
  try {
    if (!globalThis.caches) return null;
    const response = await (await caches.open(WHEEL_CACHE)).match(url);
    return response ? new Uint8Array(await response.arrayBuffer()) : null;
  } catch (err) {
    return null;
  }
}
async function keepWheel(url, bytes) {
  try {
    if (globalThis.caches) await (await caches.open(WHEEL_CACHE)).put(url, new Response(bytes));
  } catch (err) { /* only the next page's download is lost */ }
}
function joined(chunks, length) {
  const bytes = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength; }
  return bytes;
}
// One byte range; a request without a byte for STALL ms counts as failed.
// Returns the bytes received and the file's size when the server names it.
// Errors are short (the status line shows them); the URL goes to the console.
async function fetchRange(url, start, method = "GET") {
  const controller = new AbortController();
  let timer = null, stalled = false;
  const arm = () => { clearTimeout(timer); timer = setTimeout(() => { stalled = true; controller.abort(); }, STALL); };
  arm();
  try {
    const response = await networkFetch(url, { ...(method === "HEAD" ? {method} : {}), headers: method === "HEAD" || start === null ? {} : { Range: "bytes=" + start + "-" + (start + RANGE - 1) }, ...(keepsWheels() ? { cache: "no-store" } : {}), signal: controller.signal });
    const encoding = (response.headers.get("Content-Encoding") || "identity").trim().toLowerCase();
    if (method === "HEAD") {
      await response.arrayBuffer();
      if (response.status < 200 || response.status >= 300) return {encoded: true};
      const exposed = (response.headers.get("Access-Control-Expose-Headers") || "").toLowerCase().split(",").map(value => value.trim());
      const encodingVisible = response.type === "basic" || response.type === "default" ||
        exposed.includes("*") || exposed.includes("content-encoding");
      return {encoded: !encodingVisible || encoding !== "identity"};
    }
    if (response.status === 416) {
      await response.arrayBuffer();
      const total = /^bytes \*\/(\d+)$/.exec(response.headers.get("Content-Range") || "");
      if (start === null || (total && Number(total[1]) !== start)) throw new Error("Invalid unsatisfied byte range");
      return { received: 0, total: start, chunks: [] };
    }
    if (response.status !== 206 && response.status !== 200) throw new Error("HTTP " + response.status);
    if (response.status === 206 && start === null) {
      await response.arrayBuffer();
      throw new Error("Unexpected partial response to a whole-file request");
    }
    if (response.status === 206 && encoding !== "identity") {
      // The representation can change after HEAD. Consume the attempted
      // response, retaining decoder failures, then fetch the whole file once.
      try { await response.arrayBuffer(); }
      catch (error) { console.warn("CTMWorker: encoded partial response could not finish", error); }
      return {encoded: true};
    }
    const reader = response.body.getReader();
    let received = 0;
    const chunks = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      chunks.push(value);
      arm();
    }
    if (response.status === 200) return { received, total: received, chunks, whole: true };
    // Content-Range addresses the identity representation validated above.
    const header = response.headers.get("Content-Range");
    if (header) {
      const range = /^bytes (\d+)-(\d+)\/(\d+|\*)$/.exec(header.trim());
      if (!range) throw new Error("Invalid Content-Range");
      const from = Number(range[1]), to = Number(range[2]);
      const total = range[3] === "*" ? null : Number(range[3]);
      if (![from, to, ...(total === null ? [] : [total])].every(Number.isSafeInteger) ||
          from !== start || to < from || to >= start + RANGE ||
          (total !== null && to >= total) || received !== to - from + 1) {
        throw new Error("Byte range does not match its requested offset or received length");
      }
      return {received, total, chunks};
    }
    // Legacy CORS servers may hide Content-Range. A short range still ends
    // the file; a full range is followed until a short range or HTTP 416.
    if (received > RANGE) throw new Error("Byte range exceeds its requested length");
    return {received, total: received < RANGE ? start + received : null, chunks};
  } catch (err) {
    throw stalled ? new Error("no data for " + (STALL < 1000 ? STALL + " ms" : Math.round(STALL / 1000) + " s")) : err;
  } finally {
    clearTimeout(timer);
  }
}
// The error names the package once ("matplotlib: HTTP 404"), for the
// status line; the console gets the URL.
async function fetchRangeWithRetries(file, start) {
  for (let attempt = 0; ; attempt++) {
    await quiet();
    try {
      const result = await fetchRange(file.url, start);
      if (!result.whole && result.total != null && file.total != null && result.total !== file.total) {
        throw new Error("Byte range total changed during download");
      }
      return result;
    } catch (err) {
      if (attempt < RETRY_AFTER.length) { await sleep(RETRY_AFTER[attempt]); continue; }
      const reason = String((err && err.message) || err);
      console.warn("CTMWorker: stage 2 could not download " + file.url + " (bytes from " + start + ", " + (attempt + 1) + " tries): " + reason);
      throw new Error(file.name + ": " + reason);
    }
  }
}
// Every file of the named packages, from the URLs loadPackage will request,
// one range at a time, smallest file first (sizes are learnt from the first
// range of each); a wheel the Cache Storage has (verified) is not fetched.
// Each complete file is verified and held for its install (above).
async function prefetch(names) {
  const files = names.map(name => lockPackages[name]).filter(entry => entry && entry.file_name)
    .map(entry => ({ name: entry.name || entry.file_name, url: new URL(entry.file_name, config.indexURL).href, sha256: entry.sha256, next: 0, total: null, chunks: [] }));
  const finish = async file => {
    const bytes = joined(file.chunks, file.next);
    file.chunks = [];
    if (await holdVerified(file.url, bytes, file.sha256)) await keepWheel(file.url, bytes);
  };
  const open = [];
  for (const file of files) {
    const kept = await cachedWheel(file.url);
    if (kept && await holdVerified(file.url, kept, file.sha256)) continue;
    // HEAD negotiates the same representation without asking a decoder to
    // consume an incomplete gzip/Brotli stream. Unsupported HEAD falls back
    // to whole-file prefetch, which retains the same lock-file verification.
    await quiet();
    let encoded = true;
    try { encoded = (await fetchRange(file.url, 0, "HEAD")).encoded; }
    catch (error) { /* the ordinary whole-file GET remains authoritative */ }
    let got = await fetchRangeWithRetries(file, encoded ? null : 0);
    if (got.encoded) got = await fetchRangeWithRetries(file, null);
    file.next = got.received;
    file.total = got.total;
    file.chunks.push(...got.chunks);
    // A whole file (200), or the server's total reached (a small wheel).
    if (got.whole || (file.total !== null && file.next >= file.total)) await finish(file);
    else open.push(file);
  }
  open.sort((a, b) => (a.total === null ? Infinity : a.total) - (b.total === null ? Infinity : b.total));
  for (const file of open) {
    while (file.total === null || file.next < file.total) {
      let got = await fetchRangeWithRetries(file, file.next);
      if (got.encoded) got = await fetchRangeWithRetries(file, null);
      if (got.whole) {
        file.next = got.received; file.total = got.total; file.chunks = got.chunks;
        break;
      }
      if (got.received === 0) break;
      file.next += got.received;
      file.chunks.push(...got.chunks);
      if (got.total !== null) file.total = got.total;
    }
    await finish(file);
  }
}
// A failed loadPackage does not reject: Pyodide reports the error through
// errorCallback and goes on. The package is then not loaded, and stage 2
// fails with a short reason that names it ("matplotlib: Failed to load
// 'matplotlib-3.8.4-cp313-cp313-pyodide_2025_0_wasm32.whl': request
// failed."), file names instead of URLs; the console gets Pyodide's text.
function shortReason(text) {
  return String(text).split("\n")[0].replace(/https?:\/\/[^\s'"]*\/([^\s'"\/]+)/g, "$1").slice(0, 200);
}
async function install(name) {
  const entry = lockPackages && lockPackages[name];
  const label = (entry && entry.name) || name;
  const started = performance.now();
  const errors = [];
  const slow = setTimeout(() => {
    postStatus(((config.messages || {}).initPackages || "Initialising Python packages ...") + " (" + label + ")");
  }, SLOW_INSTALL);
  try {
    await pyodide.loadPackage(label, { checkIntegrity: true, errorCallback: text => { errors.push(String(text)); } });
  } finally {
    clearTimeout(slow);
  }
  if (entry && entry.file_name) verified.delete(new URL(entry.file_name, config.indexURL).href);
  if (!isLoaded(name)) {
    console.warn("CTMWorker: stage 2 could not install " + label + ": " + (errors.join("\n") || "not loaded"));
    const reason = errors.find(text => !/^The following error occurred/.test(text)) || "not installed";
    throw new Error(label + ": " + shortReason(reason));
  }
  return performance.now() - started;
}
let setupRunning = null;
async function setup() {
  const steps = config.background || {};
  const packages = steps.packages || [];
  if (packages.length || steps.run) postStatus((config.messages || {}).initPackages || "Initialising Python packages ...");
  if (packages.length) {
    let lock = true;
    try { await readLock(); } catch (err) { lock = false; }
    const wanted = closure(packages).filter(name => !isLoaded(name));
    // Without the lock file there is nothing to prefetch: the installs
    // download inside Pyodide's lock, one package at a time.
    if (lock) await prefetch(wanted);
    for (const name of wanted) {
      if (!isLoaded(name)) await whenIdle(() => install(name));
    }
  }
  if (steps.run) await whenIdle(() => pyodide.runPythonAsync(steps.run));
}
function startSetup() {
  if (setupRunning) return setupRunning;
  setupRunning = setup().then(
    () => { self.postMessage({ type: "setup", ok: true }); },
    err => { setupRunning = null; self.postMessage({ type: "setup", ok: false, message: String((err && err.message) || err) }); });
  return setupRunning;
}

// Raw Python call (RPC variant of runPythonAsync, e.g. for
// py-exercise). Result must be structured-clone-capable.
async function runPythonRaw(code) {
  const result = await pyodide.runPythonAsync(code);
  if (result && typeof result.toJs === "function") {
    let value;
    try {
      value = result.toJs({ dict_converter: Object.fromEntries, create_pyproxies: false });
    } catch (err) {
      value = String(result);
    }
    result.destroy();
    return value;
  }
  return result;
}

// Bound a result before structured cloning into the UI. Cycles and bigint
// remain supported; no JSON serialization or silent semantic truncation.
function assertMessageBudget(value) {
  const seen = new Set(), todo = [value]; let bytes = 0, nodes = 0;
  while (todo.length) {
    const item = todo.pop();
    if (++nodes > 1000000) throw new Error('Python result exceeds its message budget.');
    if (typeof item === 'string') bytes += item.length * 2;
    else if (typeof item === 'bigint') bytes += item.toString().length;
    else if (item && typeof item === 'object' && !seen.has(item)) {
      seen.add(item);
      if (ArrayBuffer.isView(item)) bytes += item.byteLength;
      else if (item instanceof ArrayBuffer) bytes += item.byteLength;
      else for (const key of Object.keys(item)) { bytes += key.length * 2; todo.push(item[key]); }
    }
    if (bytes > 33554432) throw new Error('Python result exceeds its message budget.');
  }
}

async function handleMessage(msg) {
  try {
    let value = true;
    switch (msg.type) {
      case "init":
        await init(msg.config);
        // Stage 2 starts once the answer to init is on its way.
        setTimeout(startSetup, 0);
        break;
      case "beginOperation":
        operationID = msg.operationID; inputAllowed = msg.allowInput === true; learnerPhase = true; resetOutput(); break;
      case "endOperation":
        streamOutstanding = false; flushOutput(); operationID = null; learnerPhase = true; inputAllowed = true; changed(); break;
      case "setInterrupt":
        pyodide.setInterruptBuffer(msg.buffer);
        break;
      case "setInputBuffers":
        inputStatusBuf = msg.inputStatusBuf;
        inputDataBuf   = msg.inputDataBuf;
        break;
      case "runPython":
        value = await runPythonRaw(msg.code);
        break;
      case "loadPackagesFromImports":
        await pyodide.loadPackagesFromImports(msg.code);
        break;
      case "loadPackage":
        await pyodide.loadPackage(msg.name);
        break;
      case "setGlobal":
        pyodide.globals.set(msg.name, pyodide.toPy(msg.value));
        break;
      default:
        if (!Object.prototype.hasOwnProperty.call(pluginCommands, msg.type)) throw new Error("Unknown command: " + msg.type);
        value = await pluginCommands[msg.type](msg);
    }
    assertMessageBudget(value);
    self.postMessage({ type: "result", id: msg.id, value: value });
  } catch (err) {
    const message = String((err && err.message) || err).slice(0, 16384);
    self.postMessage({ type: "error", id: msg.id, message,
      ...(message.includes('ctm-input-unavailable:') ? {code: 'input-unavailable'} : {}) });
  }
}

// Python has one interpreter and one output capture. Serialize mutations so a
// checker from another extension cannot enter a document cell's stdout evidence.
// Input/interrupt buffers are control messages, independent of this queue.
// The queue's state (busy, downloads) lets stage 2 yield to every command.
let commandQueue = Promise.resolve();
self.onmessage = function(event) {
  const msg = event.data;
  if (msg.type === "setInterrupt" || msg.type === "setInputBuffers") {
    return handleMessage(msg);
  }
  if (msg.type === 'streamAck') {
    if (msg.operationID === operationID) { streamOutstanding = false; flushOutput(); }
    return Promise.resolve();
  }
  if (msg.type === "setupRetry") {
    startSetup();
    return Promise.resolve();
  }
  const download = mayDownload(msg);
  busy++;
  if (download) downloads++;
  const pending = commandQueue.then(() => handleMessage(msg));
  commandQueue = pending.catch(() => {});
  const done = () => {
    busy--;
    lastCommand = performance.now();
    if (download) { downloads--; lastDownload = lastCommand; }
    changed();
  };
  pending.then(done, done);
  return pending;
};
`;

  // ---------------------------------------------------------------------------
  // Main thread: start the worker + provide the RPC proxy
  // ---------------------------------------------------------------------------

  // options (all optional but indexURL):
  //   indexURL      Pyodide's base URL (ctm.runtime.indexURL() or a project's base-url)
  //   env           the interpreter's environment ({HOME: ...})
  //   packages      micropip packages to install before the proxy is ready (stage 1)
  //   background    {packages: [names], run: "Python"}: stage 2, after the
  //                 proxy is ready (proxy.whenSetup); never in a check's way
  //   plugin        worker-side source that calls registerPlugin(...)
  //   commands      {name: [argument names]}: the plugin's commands on the proxy
  //   messages      {loading, initPackages, extraPackages}: status texts
  //   onStatus(text)        a status text from the worker
  //   onRestart(started)    after restart(): the new start's promise
  //   loadTimeout   initialization ceiling in milliseconds (default 180000)
  //   publish       true: qpyodideReady, qpyodideInstance, _qpyodideGetInstance
  //                 and mainPyodide (the globals other components use)
  // Test-only: globalThis.__ctmWorkerNoBackground = true skips stage 2 (the
  // loading measurements compare a page with and without it); options.timing
  // shortens stage 2's limits.
  function start(options = {}) {
    const messages = root.CTMLocales ? root.CTMLocales.table('common', root.document?.documentElement?.lang || 'en') : {};
    options = {...options, messages: {...messages, ...options.messages}};
    if (root.CTM_ASSETS && root.CTM_ASSETS.mode === "local") {
      options = {...options, indexURL: root.CTMAssets.url("pyodide"), assetsMode: "local"};
    }
    const started = bootPyodideWorker(options);
    if (options.publish) publish(started);
    return started;
  }

  function publish(started) {
    globalThis.mainPyodide = undefined;
    globalThis.qpyodideReady = started;

    // Compatibility alias: older extensions (e.g. py-exercise) expect
    // `qpyodideInstance` and `await` on it.
    globalThis.qpyodideInstance = started;

    // Create a function to retrieve the promise object.
    globalThis._qpyodideGetInstance = function() {
      return globalThis.qpyodideInstance;
    }

    // A failed start is the components' to report.
    started.catch(() => {});
  }

  function bootPyodideWorker(options) {
    const pending = new Map();
    const idleWaiters = new Set();
    let nextId = 1;
    const loadTimeout = options.loadTimeout ?? root.MathExerciseRuntime?.loadTimeout ?? 180000;
    if (!Number.isFinite(loadTimeout) || loadTimeout <= 0 || loadTimeout > 2147483647) {
      return Promise.reject(new TypeError('loadTimeout must be a positive finite number of milliseconds up to 2147483647'));
    }
    function notifyIdle() {
      if (pending.size) return;
      for (const resolve of idleWaiters) resolve();
      idleWaiters.clear();
    }

    const staticURL = options.workerURL || (ownScriptURL && new URL('pyodide-worker-core.js', ownScriptURL).href);
    const blobUrl = (!staticURL || options.plugin) ? URL.createObjectURL(
      new Blob([WORKER_SOURCE + (options.plugin ? "\n" + options.plugin + "\n" : "")], { type: "text/javascript" })
    ) : null;
    let blobReleased = false;
    function releaseBlob() {
      if (blobReleased) return;
      blobReleased = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    }
    let worker;
    try { worker = new Worker(blobUrl || staticURL, { type: "module" }); }
    catch (error) { releaseBlob(); return Promise.reject(error); }

    // After restart(): the restart's error. The worker is gone, so calls on
    // this proxy reject at once instead of waiting for an answer that never
    // comes.
    let gone = null, replacement = null;
    function failWorker(error) {
      if (gone) return;
      gone = error;
      worker.terminate();
      for (const entry of pending.values()) entry.reject(error);
      pending.clear();
      notifyIdle();
      setup?.reject(error);
      releaseBlob();
      if (error.workerFailed && !error.restarted) options.onFailure?.(error, proxy);
    }
    function rpc(type, payload = {}) {
      if (gone) return Promise.reject(gone);
      return new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        try { worker.postMessage({ type, id, ...payload }); }
        catch (error) { pending.delete(id); reject(error); notifyIdle(); }
      });
    }

    // Stage 2: proxy.whenSetup resolves (with the proxy) when the background
    // packages are installed, or rejects; proxy.retrySetup() tries the
    // missing steps again without restarting Python.
    let setup = null;
    function expectSetup() {
      setup = {};
      setup.promise = new Promise((resolve, reject) => { setup.resolve = resolve; setup.reject = reject; });
      setup.promise.catch(() => {});   // the components report it
      proxy.whenSetup = setup.promise;
      return setup.promise;
    }

    let operationSequence = 0, owner = null;
    worker.onmessage = (event) => {
      if (gone) return;
      const msg = event.data;
      if (msg.type === 'streamBatch') {
        if (owner && !owner.cancelled && msg.operationID === owner.id) {
          for (const entry of msg.entries) owner.handlers.onStream?.(entry.message, entry.type);
        } else if (!owner && msg.operationID == null) {
          for (const entry of msg.entries) proxy.onStream?.(entry.message, entry.type);
        }
        worker.postMessage({type: 'streamAck', operationID: msg.operationID});
        return;
      }
      if (msg.type === "setup")        { if (msg.ok) setup.resolve(proxy); else setup.reject(new Error(msg.message)); return; }
      if (msg.type === "status")      { options.onStatus?.(msg.text); return; }
      if (msg.type === "streamStdout") { proxy.onStream?.(msg.text, "stdout"); return; }
      if (msg.type === "streamStderr") { proxy.onStream?.(msg.text, "stderr"); return; }
      if (msg.type === "inputRequired") {
        if (owner && !owner.cancelled && msg.operationID === owner.id) owner.handlers.onInputRequired?.(msg.prompt ?? "");
        else if (!msg.operationID) proxy.onInputRequired?.(msg.prompt ?? "");
        return;
      }
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      if (msg.type === "error") {
        const error = new Error(msg.message);
        if (msg.code) error.code = msg.code;
        entry.reject(error);
      } else {
        entry.resolve(msg.value);
      }
      notifyIdle();
    };

    worker.onerror = (event) => {
      console.error("CTMWorker: error in the Pyodide worker", event);
      const error = event.error instanceof Error ? event.error
        : new Error(event.message || "The Python worker failed.");
      error.workerFailed = true;
      failWorker(error);
      // Keep the native error event visible; no preventDefault/true return.
    };
    worker.onmessageerror = (event) => {
      console.error("CTMWorker: invalid message from the Pyodide worker", event);
      const error = new Error("The Python worker message could not be decoded.");
      error.workerFailed = true;
      failWorker(error);
    };

    // Proxy object: what `await qpyodideReady` / `mainPyodide` resolves to.
    // The Pyodide-like methods are RPC variants, so that extensions like
    // py-exercise keep working (postMessage guarantees ordering, so e.g.
    // globals.set may be called without await before runPythonAsync).
    const proxy = {
      isWorkerProxy: true,
      cancelOperation() { if (owner) owner.cancelled = true; },
      async operation(run, handlers = {}) {
        if (owner) throw new Error('Nested Python operation');
        owner = {id: ++operationSequence, handlers};
        options.onBusy?.(true);
        try { await rpc('beginOperation', {operationID: owner.id, allowInput: typeof handlers.onInputRequired === 'function'}); return await run(); }
        finally {
          try { if (!gone) await rpc('endOperation'); } finally { owner = null; options.onBusy?.(false); }
        }
      },
      interruptBuffer: null,
      inputStatusBuf: null,     // Int32Array(SharedArrayBuffer) – input status
      inputDataBuf: null,       // Uint8Array(SharedArrayBuffer) – input data (UTF-8)
      onStream: null,           // Callback(text, type) – streamed stdout/stderr
      onInputRequired: null,    // Callback() – Python is waiting for input
      whenSetup: null,          // Promise: stage 2 done (see above)
      whenIdle: () => pending.size ? new Promise(resolve => idleWaiters.add(resolve)) : Promise.resolve(),
      // Release a private runtime whose page-side backend startup failed.
      // Unlike restart(), this never creates a replacement worker or event.
      terminate(reason) {
        if (options.publish) throw new Error('A published runtime must be stopped or restarted, not terminated privately.');
        const error = reason instanceof Error ? reason : new Error(reason || 'Python worker was terminated.');
        failWorker(error);
      },

      runPythonAsync: (code) => rpc("runPython", { code }),
      loadPackagesFromImports: (code) => rpc("loadPackagesFromImports", { code }),
      loadPackage: (name) => rpc("loadPackage", { name }),
      toPy: (value) => value,   // conversion happens worker-side
      globals: {
        set: (name, value) => rpc("setGlobal", { name, value })
      },

      /** Graceful abort (KeyboardInterrupt) – only with SharedArrayBuffer. */
      interrupt() {
        // Waking input already raises EOFError. A simultaneous SIGINT can
        // arrive while Python is handling that exception and escape WebLoop.
        // Abort the wait alone; code that catches EOF still gets the bounded
        // hard-restart fallback from MathExerciseRuntime.stop().
        if (this.inputStatusBuf && Atomics.compareExchange(this.inputStatusBuf, 0, 1, 3) === 1) {
          this.clearInterrupt();
          Atomics.notify(this.inputStatusBuf, 0, 1);
          return;
        }
        if (this.interruptBuffer) this.interruptBuffer[0] = 2;   // SIGINT
        this.abortInput();
      },
      clearInterrupt() {
        if (this.interruptBuffer) this.interruptBuffer[0] = 0;
      },

      /** Aborts a pending input() wait in the worker (status 3 = aborted). */
      abortInput() {
        if (this.inputStatusBuf && Atomics.load(this.inputStatusBuf, 0) === 1) {
          Atomics.store(this.inputStatusBuf, 0, 3);
          Atomics.notify(this.inputStatusBuf, 0, 1);
        }
      },

      /** Delivers an input value to the waiting worker (status 2 = ready). */
      provideInput(text) {
        if (!this.inputStatusBuf || !this.inputDataBuf) return;
        const encoded = new TextEncoder().encode(text);
        if (encoded.length >= this.inputDataBuf.length || text.includes('\0')) throw new Error('Input is too long or contains a null character.');
        this.inputDataBuf.fill(0);
        this.inputDataBuf.set(encoded);
        Atomics.store(this.inputStatusBuf, 0, 2);
        Atomics.notify(this.inputStatusBuf, 0, 1);
      },

      /**
       * Hard restart: terminate the worker, reject all pending calls and
       * whenSetup (error.restarted is true), and boot a fresh runtime
       * (options.onRestart: startup cells run again). Later calls on this
       * proxy reject at once; restarting it again returns the same new start.
       */
      restart(reason) {
        if (replacement) return replacement;
        if (options.publish) {
          const event = new Event("qpyodide-runtime-restart");
          event.detail = {proxy};
          root.dispatchEvent(event);
        }
        if (!gone) {
          const error = new Error(reason || "Python was restarted.");
          error.restarted = true;
          failWorker(error);
        }

        const again = bootPyodideWorker(options);
        replacement = again;
        if (options.publish) publish(again);
        options.onRestart?.(again);
        return again;
      },

      /** Stage 2 again, for the steps that are missing (Python keeps running). */
      retrySetup() {
        const promise = expectSetup();
        if (gone) setup.reject(gone);
        else {
          try { worker.postMessage({ type: "setupRetry" }); }
          catch (error) { setup.reject(error); }
        }
        return promise;
      }
    };

    // The plugin's commands, e.g. runCell: (code, wantPickle) => rpc("runCell", { code, wantPickle })
    for (const [name, args] of Object.entries(options.commands || {})) {
      proxy[name] = (...values) => rpc(name, Object.fromEntries(args.map((arg, i) => [arg, values[i]])));
    }
    expectSetup();

    const loadTimer = setTimeout(() => {
      const error = new Error('Python did not finish loading within ' + loadTimeout / 1000 + ' s');
      error.code = 'pyodide-timeout';
      failWorker(error);
    }, loadTimeout);
    const started = (async () => {
      if (options.messages?.loading) options.onStatus?.(options.messages.loading);

      try {
        await rpc("init", {
          config: {
            indexURL: options.indexURL,
            assetsMode: options.assetsMode,
            env: options.env || {},
            packages: options.packages || [],
            background: globalThis.__ctmWorkerNoBackground === true ? {} : (options.background || {}),
            messages: options.messages || {},
            timing: options.timing,
            pluginURLs: options.pluginURLs || []
          }
        });
      } finally {
        releaseBlob();
      }

      // Enable the shared buffer if the page is cross-origin isolated.
      // Interrupt buffer: graceful abort (KeyboardInterrupt).
      // Input buffer: Atomics-based input() (Python pauses via Atomics.wait).
      if (globalThis.crossOriginIsolated && typeof SharedArrayBuffer !== "undefined") {
        try {
          proxy.interruptBuffer = new Uint8Array(new SharedArrayBuffer(1));
          await rpc("setInterrupt", { buffer: proxy.interruptBuffer });

          proxy.inputStatusBuf = new Int32Array(new SharedArrayBuffer(4));
          proxy.inputDataBuf   = new Uint8Array(new SharedArrayBuffer(4096));
          await rpc("setInputBuffers", {
            inputStatusBuf: proxy.inputStatusBuf,
            inputDataBuf:   proxy.inputDataBuf
          });
        } catch (err) {
          proxy.interruptBuffer = null;
          proxy.inputStatusBuf  = null;
          proxy.inputDataBuf    = null;
          console.warn("CTMWorker: shared buffer unavailable", err);
        }
      }

      if (gone) throw gone;
      if (options.publish && globalThis.qpyodideReady === started) globalThis.mainPyodide = proxy;

      return proxy;
    })();
    started.then(() => clearTimeout(loadTimer), error => {
      clearTimeout(loadTimer);
      failWorker(error);
    });
    return started;
  }

  // Idempotent page broker; private STACK workers keep using start().
  let pageStarted = null;
  function page(options = {}) {
    if (pageStarted) return pageStarted;
    const text = root.CTMLocales ? root.CTMLocales.table('common', root.document?.documentElement?.lang || 'en') : {};
    let lamp = null, note = null, stopButton = null, retryButton = null, timer = null;
    function status(message) {
      if (!root.document?.body || options.showStatus === false) return;
      if (!lamp) {
        const existing = options.onStatus && document.getElementById('qpyodide-status-right');
        lamp = existing || document.createElement('div'); lamp.className = 'ctm-python-status';
        lamp.setAttribute('role', 'status'); lamp.setAttribute('aria-live', 'polite');
        note = existing ? null : document.createElement('span');
        stopButton = document.createElement('button'); stopButton.type = 'button'; stopButton.hidden = true;
        stopButton.textContent = text.stop || 'Stop';
        stopButton.onclick = () => {
          status(text.pythonRestarting || 'Stopping Python…');
          Promise.resolve(root.MathExerciseRuntime.stop(text.stopped || 'Stopped.')).catch(() => status(text.pythonFailed || 'Python failed.'));
        };
        retryButton = document.createElement('button'); retryButton.type = 'button'; retryButton.hidden = true;
        retryButton.textContent = text.retry || 'Retry';
        retryButton.onclick = () => {
          retryButton.hidden = true;
          if (pageProxy) { pageProxy.restart(text.pythonRestarting); return; }
          const again = pageStarted = start(configured);
          status(text.pythonLoading || 'Loading Python…');
          follow(again, false);
          callback?.(again);
        };
        if (note) lamp.append(note, ' ');
        lamp.append(stopButton, ' ', retryButton);
        if (!existing) {
          const header = document.getElementById('title-block-header');
          if (header) header.appendChild(lamp); else document.body.prepend(lamp);
        }
      }
      if (note) note.textContent = message;
    }
    const configured = {...options, publish: true};
    const callback = options.onRestart;
    configured.onStatus = message => { status(message); options.onStatus?.(message); };
    configured.onBusy = busy => {
      clearTimeout(timer);
      if (!busy) { if (stopButton) stopButton.hidden = true; }
      else timer = setTimeout(() => { if (stopButton) stopButton.hidden = false; }, (options.stopAfter || 20) * 1000);
      options.onBusy?.(busy);
    };
    let pageProxy = null;
    configured.onFailure = (error, proxy) => {
      pageProxy = proxy;
      status(text.pythonFailed || 'Python failed.');
      if (retryButton) retryButton.hidden = false;
      options.onFailure?.(error);
    };
    root.addEventListener?.('ctm-python-stop-state', event => {
      if (event.detail?.proxy !== pageProxy) return;
      const state = event.detail.state;
      const message = state === 'restarting' ? text.pythonRestarting : state === 'stopped' ? text.stopped : text.pythonStopping;
      if (message) { status(message); options.onStatus?.(message); }
    });
    function follow(started, restarted) {
      // A replacement that fails before Ready has no usable proxy. Never
      // retry through the previous proxy's cached replacement promise.
      pageProxy = null;
      started.then(proxy => { pageProxy = proxy; status(text.pythonReady || 'Python ready.'); }, () => {
        status(text.pythonFailed || 'Python failed.'); if (retryButton) retryButton.hidden = false;
      });
      if (restarted) status(text.pythonRestarting || 'Python is restarting; variables were reset.');
    }
    configured.onRestart = again => { pageStarted = again; follow(again, true); callback?.(again); };
    const started = pageStarted = start(configured);
    status(text.pythonLoading || 'Loading Python…');
    follow(started, false);
    return started;
  }

  root.CTMWorker = { start: start, page: page, source: WORKER_SOURCE };
})(globalThis);
