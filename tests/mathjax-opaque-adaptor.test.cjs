'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,
  '../_extensions/ctm-libs/runtime/mathjax-opaque-adaptor.js'), 'utf8');

function preloader(origin, config, transport) {
  const context = vm.createContext({self: {origin}, window: {MathJax: config},
    document: {currentScript: {getAttribute() { return transport; }}}});
  vm.runInContext(source, context);
  return context;
}

test('ordinary origins retain their original config and native startup', () => {
  for (const origin of ['https://example.test', 'http://localhost:8000']) {
    const config = {startup: {typeset: false}};
    assert.equal(preloader(origin, config).window.MathJax, config);
    assert.deepEqual(config, {startup: {typeset: false}});
  }
});

test('opaque contexts preserve authored ready functions and selected adaptors', () => {
  const ready = function () { return this.marker; };
  for (const startup of [{ready, marker: 17}, {adaptor: 'custom'}, {adaptor: 'none'}]) {
    const config = {startup};
    assert.equal(preloader('null', config).window.MathJax, config);
    assert.equal(config.startup, startup);
    if (startup.ready) assert.equal(config.startup.ready(), 17);
  }
});

for (const transport of [undefined, 'cors']) test('data transport preserves worker, maps and listener: ' + transport, async () => {
  const config = {startup: {typeset: false}, browserAdaptor: {custom: 7},
    options: {enableSpeech: true, enableBraille: true}};
  const context = preloader('null', config, transport);
  const vendorSource = 'self.vendorLoaded = true; // exact official bytes\n';
  const fetched = [];
  context.fetch = async (url, options) => {
    fetched.push({url, options});
    return {ok: true, text: async () => vendorSource};
  };
  const workerURLs = [];
  const nativeAdaptor = {kind: 'original DOM adaptor'};
  let factoryOptions, selected, readyCalls = 0, factory;
  config.startup.adaptor = 'browserAdaptor';
  const browserAdaptor = options => { factoryOptions = options; return nativeAdaptor; };
  context.MathJax = {config, _: {adaptors: {browserAdaptor: {browserAdaptor}}}, startup: {
    constructors: {browserAdaptor},
    registerConstructor(name, value) { assert.equal(name, 'ctmOpaqueWorkerAdaptor'); factory = value; },
    useAdaptor(name, force) { selected = [name, force]; },
    defaultReady() { readyCalls++; return 'native ready result'; }
  }};
  context.Worker = class {
    constructor(url) { workerURLs.push(url); }
  };
  assert.equal(config.startup.ready(), 'native ready result');
  assert.equal(readyCalls, 1);
  assert.deepEqual(selected, ['ctmOpaqueWorkerAdaptor', true]);
  const adaptor = factory();
  assert.equal(adaptor, nativeAdaptor);
  assert.equal(factoryOptions, config.browserAdaptor);
  const options = {path: "https://assets.test/mathjax@4.1.3/sre/quoted'\n\u2028",
    worker: 'speech-worker.js?x="value"', maps: "https://assets.test/maps/\\'\n\u2029"};
  const listener = () => {};
  const worker = await adaptor.createWorker(listener, options);
  assert.equal(worker.onmessage, listener);
  assert.equal(workerURLs.length, 1);
  assert.match(workerURLs[0], /^data:text\/javascript;charset=utf-8,/);
  const imports = [], scope = {self: {}, importScripts(value) { imports.push(value); }};
  vm.runInNewContext(decodeURIComponent(workerURLs[0].split(',')[1]), scope);
  assert.equal(scope.self.maps, options.maps);
  if (transport === 'cors') {
    assert.equal(fetched.length, 1);
    assert.equal(fetched[0].url, options.path + '/' + options.worker);
    assert.equal(fetched[0].options.mode, 'cors');
    assert.equal(fetched[0].options.credentials, 'omit');
    assert.equal(decodeURIComponent(imports[0].split(',')[1]), vendorSource);
    context.fetch = async () => ({ok: false, status: 404});
    await assert.rejects(adaptor.createWorker(listener, options), /Cannot load MathJax worker: 404/);
    context.fetch = async () => { throw new Error('CORS denied'); };
    await assert.rejects(adaptor.createWorker(listener, options), /CORS denied/);
    assert.equal(workerURLs.length, 1, 'failures create no orphan worker');
  } else {
    assert.equal(fetched.length, 0);
    assert.deepEqual(imports, [options.path + '/' + options.worker]);
  }
  assert.deepEqual(config.options, {enableSpeech: true, enableBraille: true});
});

test('opt-in loader uses CORS, retains custom loaders, and propagates load errors', async () => {
  const config = {};
  const context = preloader('null', config, 'cors');
  const inserted = [];
  context.document.createElement = name => { assert.equal(name, 'script'); return {}; };
  context.document.head = {appendChild(script) { inserted.push(script); }};
  const loaded = config.loader.require('https://assets.test/dynamic.js');
  assert.equal(inserted[0].src, 'https://assets.test/dynamic.js');
  assert.equal(inserted[0].crossOrigin, 'anonymous');
  inserted[0].onload(); await loaded;
  const failed = config.loader.require('https://assets.test/missing.js');
  inserted[1].onerror(); await assert.rejects(failed, /Cannot load MathJax component/);
  const require = () => 17;
  const custom = {loader: {require}};
  preloader('null', custom, 'cors');
  assert.equal(custom.loader.require, require);
  const ordinary = {};
  preloader('https://example.test', ordinary, 'cors');
  assert.equal(ordinary.loader, undefined);
});

test('a later component selection retains its own adaptor', () => {
  const context = preloader('null', {});
  const config = context.window.MathJax;
  config.startup.adaptor = 'selected-later';
  let readyCalls = 0;
  context.MathJax = {config, startup: {
    defaultReady() { readyCalls++; return 23; },
    registerConstructor() { assert.fail('must preserve the selected adaptor'); }
  }};
  assert.equal(config.startup.ready(), 23);
  assert.equal(readyCalls, 1);
});

test('a replacement browser adaptor factory remains in control', () => {
  const context = preloader('null', {});
  const config = context.window.MathJax;
  config.startup.adaptor = 'browserAdaptor';
  let readyCalls = 0;
  context.MathJax = {config,
    _: {adaptors: {browserAdaptor: {browserAdaptor() {}}}},
    startup: {constructors: {browserAdaptor() {}},
      defaultReady() { readyCalls++; return 31; },
      registerConstructor() { assert.fail('must preserve the replacement factory'); }}
  };
  assert.equal(config.startup.ready(), 31);
  assert.equal(readyCalls, 1);
});
